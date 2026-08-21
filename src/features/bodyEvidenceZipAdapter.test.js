import test from 'node:test';
import assert from 'node:assert/strict';
import * as fflate from 'fflate';

import {
  discoverSampleIds,
  importBodyEvidenceZip,
  isAlignResultPath,
  isAlignResultPayload,
  mapAlignResultToCalibration,
  resolvePackageArtifacts,
  unzipArchive,
} from './bodyEvidenceZipAdapter.js';

function createSyntheticZip(files) {
  const zipInput = {};
  for (const [path, content] of Object.entries(files)) {
    if (typeof content === 'string') {
      zipInput[path] = fflate.strToU8(content);
    } else if (content instanceof Uint8Array) {
      zipInput[path] = content;
    } else {
      zipInput[path] = fflate.strToU8(JSON.stringify(content));
    }
  }
  return fflate.zipSync(zipInput);
}

test('discoverSampleIds detects sample subdirectories across result prefixes', () => {
  const filesMap = new Map([
    ['pose_results/subject_001/front_pose.json', new Uint8Array()],
    ['seg_result/subject_001/front_seg.json', new Uint8Array()],
    ['pointmap_results/subject_001/front_pointmap.json', new Uint8Array()],
  ]);

  const samples = discoverSampleIds(filesMap);
  assert.deepEqual(samples, ['subject_001']);
});

test('discoverSampleIds detects multiple samples when present', () => {
  const filesMap = new Map([
    ['pose_results/subject_001/front_pose.json', new Uint8Array()],
    ['pose_results/subject_002/front_pose.json', new Uint8Array()],
  ]);

  const samples = discoverSampleIds(filesMap);
  assert.equal(samples.length, 2);
  assert.equal(samples.includes('subject_001'), true);
  assert.equal(samples.includes('subject_002'), true);
});

test('resolvePackageArtifacts filters preview PNGs and resolves Front/Side artifacts', () => {
  const frontPoseJson = {
    view: 'front',
    keypoints_named: [{ name: 'neck', x: 100, y: 100, score: 0.9 }],
  };
  const sidePoseJson = {
    view: 'side',
    keypoints_named: [{ name: 'neck', x: 100, y: 100, score: 0.9 }],
  };

  const filesMap = new Map([
    ['pose_results/sub_1/front_pose.json', fflate.strToU8(JSON.stringify(frontPoseJson))],
    ['pose_results/sub_1/side_pose.json', fflate.strToU8(JSON.stringify(sidePoseJson))],
    ['pose_results/sub_1/front_pose_overlay.png', new Uint8Array([1, 2, 3])], // preview png to ignore
    ['seg_result/sub_1/seg_preview.png', new Uint8Array([1, 2, 3])], // preview png to ignore
    ['images/front_input.png', new Uint8Array([10, 20])],
    ['images/side_input.png', new Uint8Array([30, 40])],
  ]);

  const { front, side } = resolvePackageArtifacts(filesMap, 'sub_1');

  assert.equal(Boolean(front.pose), true);
  assert.equal(Boolean(side.pose), true);
  assert.equal(Boolean(front.image), true);
  assert.equal(front.image.filename, 'front_input.png');
  assert.equal(Boolean(side.image), true);
  assert.equal(side.image.filename, 'side_input.png');
});

test('importBodyEvidenceZip rejects multiple samples in archive with descriptive error', async () => {
  const zipBytes = createSyntheticZip({
    'pose_results/sample_A/front.json': { view: 'front', keypoints: [] },
    'pose_results/sample_B/front.json': { view: 'front', keypoints: [] },
  });

  const result = await importBodyEvidenceZip(zipBytes);
  assert.equal(result.ok, false);
  assert.equal(result.package, null);
  assert.equal(result.error.includes('Multiple sample directories found in ZIP archive'), true);
  assert.equal(result.error.includes('Batch import is deferred in v0'), true);
});

test('importBodyEvidenceZip successfully imports valid single-sample ZIP into normalized package', async () => {
  const frontPose = {
    view: 'front',
    keypoints_named: [
      { name: 'neck', x: 1000, y: 500, score: 0.95 },
      { name: 'left_shoulder', x: 800, y: 600, score: 0.9 },
    ],
  };

  const frontSeg = {
    model: 'schp',
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 4, skin: 0 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: 'AAAAAA==' },
  };

  const frontPointmap = {
    model: 'pointmap-v1',
    view: 'front',
    shape: [2, 2, 3],
    dtype: 'float32',
    units: 'meters',
    scale: 0.001,
  };

  const frontNormals = {
    model: 'normals-v1',
    view: 'front',
    shape: [2, 2, 3],
    dtype: 'float32',
    range: [-1, 1],
  };

  const sidePose = {
    view: 'side',
    keypoints_named: [
      { name: 'neck', x: 1000, y: 500, score: 0.95 },
    ],
  };

  const zipBytes = createSyntheticZip({
    'pose_results/subject_01/front_pose.json': frontPose,
    'pose_results/subject_01/side_pose.json': sidePose,
    'seg_result/subject_01/front_seg.json': frontSeg,
    'pointmap_results/subject_01/front_pointmap.json': frontPointmap,
    'normal_results/subject_01/front_normals.json': frontNormals,
    'images/subject_01_front.png': new Uint8Array([1, 2, 3, 4]),
    'images/subject_01_side.jpg': new Uint8Array([5, 6, 7, 8]),
  });

  const result = await importBodyEvidenceZip(zipBytes);
  assert.equal(result.ok, true);
  assert.equal(result.sampleId, 'subject_01');
  assert.equal(result.error, null);

  const pkg = result.package;
  assert.equal(pkg.sampleId, 'subject_01');
  assert.equal(pkg.front.image.present, true);
  assert.equal(pkg.front.pose.core, 2);
  assert.equal(pkg.front.segmentation.qa.valid, true);
  assert.equal(pkg.front.pointmap.present, true);
  assert.equal(pkg.front.pointmap.declaredUnits, 'meters');
  assert.equal(pkg.front.pointmap.coordinateFrame, 'unvalidated');
  assert.equal(pkg.front.normals.present, true);
  assert.equal(pkg.front.normals.coordinateFrame, 'unvalidated');
  assert.equal(pkg.side.image.present, true);
  assert.equal(pkg.side.pose.core, 1);

  assert.equal(pkg.qa.status, 'pass');
  assert.equal(pkg.qa.views.front, true);
  assert.equal(pkg.qa.views.side, true);
});

test('importBodyEvidenceZip returns error on empty ZIP or ZIP with no evidence', async () => {
  const emptyZip = createSyntheticZip({});
  const res1 = await importBodyEvidenceZip(emptyZip);
  assert.equal(res1.ok, false);
  assert.equal(res1.error.includes('empty'), true);

  const noEvidenceZip = createSyntheticZip({
    'readme.txt': 'Hello World',
  });
  const res2 = await importBodyEvidenceZip(noEvidenceZip);
  assert.equal(res2.ok, false);
  assert.equal(res2.error.includes('No matching Body Evidence artifacts'), true);
});

// ==================================================================================
// Align Artifact Recognition Tests
// ==================================================================================

/** Real Align result.json fixture (matches actual upstream output structure). */
function createRealAlignResult() {
  return {
    client_id: '1a1a1a1a1',
    feature: 'body',
    stage: 'Align',
    created_at: '2026-07-17T16:50:40.131227+00:00',
    height_cm: 169.0,
    pixels_per_cm: 10.0,
    canvas_size: 2000,
    views: {
      front: {
        crop: {
          original_size: { width: 768, height: 1376 },
          cropped_size: { width: 564, height: 1283 },
        },
        scale: {
          scale_factor: 1.3172252533125488,
          original_size: { width: 564, height: 1283 },
          scaled_size: { width: 743, height: 1690 },
          target_body_height_px: 1690,
          real_height_cm: 169.0,
          pixels_per_cm: 10.0,
          validation: { expected_height_px: 1690, actual_height_px: 1690, error_px: 0 },
        },
        canvas: {
          paste_position: { x: 628, y: 310 },
          canvas_size: { width: 2000, height: 2000 },
        },
      },
      side: {
        crop: {
          original_size: { width: 880, height: 1206 },
          cropped_size: { width: 386, height: 1133 },
        },
        scale: {
          scale_factor: 1.4916151809355693,
          original_size: { width: 386, height: 1133 },
          scaled_size: { width: 576, height: 1690 },
          target_body_height_px: 1690,
          real_height_cm: 169.0,
          pixels_per_cm: 10.0,
          validation: { expected_height_px: 1690, actual_height_px: 1690, error_px: 0 },
        },
        canvas: {
          paste_position: { x: 712, y: 310 },
          canvas_size: { width: 2000, height: 2000 },
        },
      },
    },
  };
}

test('isAlignResultPath recognizes body/Align/result.json', () => {
  assert.equal(isAlignResultPath('body/Align/result.json'), true);
});

test('isAlignResultPath recognizes with leading root folder', () => {
  assert.equal(isAlignResultPath('output/body/Align/result.json'), true);
  assert.equal(isAlignResultPath('some/deep/path/body/Align/result.json'), true);
});

test('isAlignResultPath is case-insensitive', () => {
  assert.equal(isAlignResultPath('Body/ALIGN/Result.JSON'), true);
  assert.equal(isAlignResultPath('BODY/align/RESULT.json'), true);
});

test('isAlignResultPath rejects non-Align paths', () => {
  assert.equal(isAlignResultPath('body/Apose/result.json'), false);
  assert.equal(isAlignResultPath('pose_results/000001/front_pose.json'), false);
  assert.equal(isAlignResultPath('result.json'), false);
  assert.equal(isAlignResultPath('body/Align/other.json'), false);
});

test('isAlignResultPayload validates real Align result structure', () => {
  const real = createRealAlignResult();
  assert.equal(isAlignResultPayload(real), true);
});

test('isAlignResultPayload rejects unrelated JSON payloads', () => {
  assert.equal(isAlignResultPayload(null), false);
  assert.equal(isAlignResultPayload({}), false);
  assert.equal(isAlignResultPayload({ stage: 'Apose', height_cm: 169 }), false);
  assert.equal(isAlignResultPayload({ stage: 'Align' }), false); // missing required fields
  assert.equal(isAlignResultPayload({ view: 'front', keypoints_named: [] }), false);
  assert.equal(isAlignResultPayload({ pixels_per_cm: 10, height_cm: 169 }), false); // missing stage
});

test('mapAlignResultToCalibration maps package-level fields correctly', () => {
  const align = createRealAlignResult();
  const { packageCalibration } = mapAlignResultToCalibration(align);

  assert.equal(packageCalibration.pixels_per_cm, 10.0);
  assert.equal(packageCalibration.subject_height_cm, 169.0);
  assert.equal(packageCalibration.standardized_canvas_width, 2000);
  assert.equal(packageCalibration.standardized_canvas_height, 2000);
  assert.equal(packageCalibration.declaredScaleModel, 'uniform_scalar');
  assert.equal(packageCalibration.isIsotropic, undefined);
  assert.equal(packageCalibration.calibrated, true);
  assert.equal(packageCalibration.metricScaleSource, 'known_subject_height');
  assert.equal(packageCalibration.standardizationSource, 'body-pipeline-align-v0');
  assert.equal(packageCalibration._alignStage, 'Align');
});

test('mapAlignResultToCalibration maps Front view fields correctly', () => {
  const align = createRealAlignResult();
  const { frontCalibration } = mapAlignResultToCalibration(align);

  assert.equal(frontCalibration.view, 'front');
  assert.equal(frontCalibration.originalImageWidthPx, 564);
  assert.equal(frontCalibration.originalImageHeightPx, 1283);
  assert.equal(frontCalibration.scaleFactor, 1.3172252533125488);
  assert.equal(frontCalibration.scaledWidthPx, 743);
  assert.equal(frontCalibration.scaledHeightPx, 1690);
  assert.equal(frontCalibration.offsetX, 628);
  assert.equal(frontCalibration.offsetY, 310);
  // Upstream provenance preserved
  assert.equal(frontCalibration._targetBodyHeightPx, 1690);
  assert.equal(frontCalibration._realHeightCm, 169.0);
  assert.equal(frontCalibration._validationErrorPx, 0);
});

test('mapAlignResultToCalibration maps Side view fields correctly', () => {
  const align = createRealAlignResult();
  const { sideCalibration } = mapAlignResultToCalibration(align);

  assert.equal(sideCalibration.view, 'side');
  assert.equal(sideCalibration.originalImageWidthPx, 386);
  assert.equal(sideCalibration.originalImageHeightPx, 1133);
  assert.equal(sideCalibration.scaleFactor, 1.4916151809355693);
  assert.equal(sideCalibration.scaledWidthPx, 576);
  assert.equal(sideCalibration.scaledHeightPx, 1690);
  assert.equal(sideCalibration.offsetX, 712);
  assert.equal(sideCalibration.offsetY, 310);
  assert.equal(sideCalibration._validationErrorPx, 0);
});

test('resolvePackageArtifacts recognizes body/Align/result.json and populates calibration', () => {
  const alignResult = createRealAlignResult();
  const filesMap = new Map([
    ['body/Align/result.json', fflate.strToU8(JSON.stringify(alignResult))],
    ['pose_results/000001/front_pose.json', fflate.strToU8(JSON.stringify({ view: 'front', keypoints_named: [{ name: 'neck', x: 100, y: 100, score: 0.9 }] }))],
  ]);

  const { front, side, calibration } = resolvePackageArtifacts(filesMap, '000001');

  // Package calibration should be populated from the Align result
  assert.notEqual(calibration, null);
  assert.equal(calibration.pixels_per_cm, 10.0);
  assert.equal(calibration.subject_height_cm, 169.0);

  // Front/Side view calibrations should be populated
  assert.notEqual(front.calibration, null);
  assert.equal(front.calibration.originalImageWidthPx, 564);
  assert.notEqual(side.calibration, null);
  assert.equal(side.calibration.originalImageWidthPx, 386);

  // Front pose should also be found
  assert.notEqual(front.pose, null);
});

test('resolvePackageArtifacts recognizes Align with leading root folder', () => {
  const alignResult = createRealAlignResult();
  const filesMap = new Map([
    ['output/body/Align/result.json', fflate.strToU8(JSON.stringify(alignResult))],
  ]);

  const { calibration } = resolvePackageArtifacts(filesMap, null);
  assert.notEqual(calibration, null);
  assert.equal(calibration.subject_height_cm, 169.0);
});

test('resolvePackageArtifacts does not recognize unrelated JSON as Align calibration', () => {
  // A random JSON at the Align path but with wrong schema should not be recognized
  const notAlign = { model: '1b', view: 'front', keypoints_named: [] };
  const filesMap = new Map([
    ['body/Align/result.json', fflate.strToU8(JSON.stringify(notAlign))],
  ]);

  const { calibration } = resolvePackageArtifacts(filesMap, null);
  assert.equal(calibration, null);
});

test('legacy archive with no Align calibration produces unvalidated calibration provenance', async () => {
  const frontPose = { view: 'front', keypoints_named: [{ name: 'neck', x: 100, y: 100, score: 0.9 }] };
  const zipBytes = createSyntheticZip({
    'pose_results/sample_1/front_pose.json': frontPose,
  });

  const result = await importBodyEvidenceZip(zipBytes);
  assert.equal(result.ok, true);
  assert.equal(result.package.calibration, null);
});

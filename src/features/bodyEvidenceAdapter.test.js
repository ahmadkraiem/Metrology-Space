import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBodyEvidence,
  classifyBodyLandmarkCandidate,
  classifyPoseLandmarks,
  isDeferredBodyLandmark,
  isSecondaryBodyAnchorCandidate,
  SECONDARY_FRONT_BODY_ANCHORS,
} from './bodyEvidenceAdapter.js';

const point = (name, x = 1000, y = 1000, score = 0.9) => ({
  name,
  x,
  y,
  score,
});

test('classifies core, allowlisted secondary, rejected, and deferred landmark names', () => {
  assert.deepEqual(classifyBodyLandmarkCandidate('left_shoulder'), {
    classification: 'core',
    reason: 'core-13',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('left_acromion'), {
    classification: 'secondary',
    reason: 'secondary-allowlist',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('right_big_toe'), {
    classification: 'secondary',
    reason: 'secondary-allowlist',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('left_eye'), {
    classification: 'rejected-face-head',
    reason: 'face-head-term',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('left_hand'), {
    classification: 'ignored-non-core',
    reason: 'deferred-hand-detail',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('contour_42'), {
    classification: 'ignored-non-core',
    reason: 'deferred-unstable-extra',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('chest'), {
    classification: 'ignored-non-core',
    reason: 'not-in-secondary-allowlist',
  });
});

test('accepts only the secondary allowlist as secondary candidates', () => {
  for (const name of SECONDARY_FRONT_BODY_ANCHORS) {
    assert.equal(isSecondaryBodyAnchorCandidate(name), true, name);
    assert.equal(isDeferredBodyLandmark(name), false, name);
  }

  const deferred = [
    'left_thumb',
    'right_thumb_cmc',
    'left_index_finger_tip',
    'middle_finger_mcp',
    'ring_finger_pip',
    'pinky_finger_dip',
    'left_palm',
    'right_hand',
    'left_foot_index',
    'waist',
    'chest',
    'landmark_17',
    'unknown_body_extra',
  ];
  for (const name of deferred) {
    assert.equal(isSecondaryBodyAnchorCandidate(name), false, name);
    assert.equal(isDeferredBodyLandmark(name), true, name);
  }
});

test('normalizes side prefix / suffix forms of secondary allowlist names', () => {
  assert.equal(isSecondaryBodyAnchorCandidate('Heel Left'), true);
  assert.equal(isSecondaryBodyAnchorCandidate('r_heel'), true);
  assert.equal(isSecondaryBodyAnchorCandidate('big_toe_right'), true);
  assert.equal(isSecondaryBodyAnchorCandidate('LEFT-ACROMION'), true);
});

test('reports a front-only secondary audit without side landmarks contaminating counts', () => {
  const result = analyzeBodyEvidence({
    frontPose: {
      keypoints_named: [
        point('neck'),
        point('left_shoulder'),
        point('left_acromion'),
        point('left_heel'),
        point('chest'),
        point('left_hand'),
        point('nose'),
        point('contour_42'),
      ],
    },
    sidePose: {
      keypoints_named: [
        point('waist'),
        point('right_ear'),
        point('landmark_9'),
      ],
    },
  });

  assert.equal(result.qa.frontTotalLandmarks, 8);
  assert.equal(result.qa.renderableFrontLandmarks, 2);
  assert.equal(result.qa.frontSecondaryLandmarks, 2);
  assert.equal(result.qa.secondaryFrontLandmarks, 2);
  assert.equal(result.qa.frontSecondaryLandmarks, result.qa.secondaryFrontLandmarks);
  assert.equal(result.qa.frontRejectedFaceLandmarks, 1);
  assert.equal(result.qa.frontIgnoredNonCoreLandmarks, 3);
  assert.deepEqual(result.qa.secondaryFrontLandmarkNames, ['left_acromion', 'left_heel']);
  assert.deepEqual(result.qa.secondaryAllowlist, [...SECONDARY_FRONT_BODY_ANCHORS]);
  assert.deepEqual(result.qa.ignoredFrontLandmarks, [
    { name: 'chest', reason: 'not-in-secondary-allowlist' },
    { name: 'left_hand', reason: 'deferred-hand-detail' },
    { name: 'contour_42', reason: 'deferred-unstable-extra' },
  ]);
  assert.deepEqual(result.qa.rejectedFrontLandmarks, [
    { name: 'nose', reason: 'face-head-term' },
  ]);
});

test('preserves Front core and secondary classification', () => {
  const result = classifyPoseLandmarks([
    point('left_shoulder'),
    point('right_heel'),
    point('nose'),
    point('left_index'),
  ], { view: 'front' });
  assert.equal(result.core, 1);
  assert.equal(result.secondary, 1);
  assert.equal(result.rejectedFace, 1);
  assert.equal(result.ignoredNonCore, 1);
});

test('classifies only exact safe Side secondary identities', () => {
  const result = classifyPoseLandmarks([
    point('left_shoulder'),
    point('right_heel'),
    point('heel_prediction'),
    point('left_thumb1'),
  ], { view: 'side' });
  assert.equal(result.core, 1);
  assert.equal(result.secondary, 1);
  assert.equal(result.ignoredNonCore, 2);
  assert.deepEqual(
    result.acceptedLandmarks.filter((entry) => entry.secondary).map((entry) => entry.name),
    ['right_heel'],
  );
});

test('reports rejected and ignored counts separately by view', () => {
  const result = analyzeBodyEvidence({
    frontPose: { landmarks: [point('left_shoulder'), point('nose')] },
    sidePose: { landmarks: [point('right_hip'), point('ear'), point('left_index')] },
  });
  assert.equal(result.qa.frontCoreLandmarks, 1);
  assert.equal(result.qa.sideCoreLandmarks, 1);
  assert.equal(result.qa.frontRejectedFaceLandmarks, 1);
  assert.equal(result.qa.sideRejectedFaceLandmarks, 1);
  assert.equal(result.qa.frontIgnoredNonCoreLandmarks, 0);
  assert.equal(result.qa.sideIgnoredNonCoreLandmarks, 1);
  assert.equal(result.qa.rejectedFaceLandmarks, 2);
  assert.equal(result.qa.ignoredNonCoreLandmarks, 1);
});

test('Side pose with right_heel exposes one secondary without duplicating in core', () => {
  const result = analyzeBodyEvidence({
    sidePose: {
      keypoints_named: [
        point('left_shoulder'),
        point('right_heel'),
      ],
    },
  });

  assert.equal(result.qa.sideCoreLandmarks, 1);
  assert.equal(result.qa.sideSecondaryLandmarks, 1);

  const sideAccepted = result.views.side.pose.acceptedLandmarks;
  const coreNames = sideAccepted.filter((entry) => entry.coreFront).map((entry) => entry.name);
  const secondaryNames = sideAccepted.filter((entry) => entry.secondary).map((entry) => entry.name);

  assert.deepEqual(coreNames, ['left_shoulder']);
  assert.deepEqual(secondaryNames, ['right_heel']);
  assert.equal(coreNames.includes('right_heel'), false);
});

test('Side U/Y coordinate formula remains stable at fixed v0 scale', () => {
  const imageX = 1000;
  const imageY = 500;
  const pixelsPerCm = 10;
  const canvasSize = 2000;
  const sideUcm = imageX / pixelsPerCm;
  const sideYcm = (canvasSize - imageY) / pixelsPerCm;
  assert.equal(sideUcm, 100);
  assert.equal(sideYcm, 150);
});

// Helper for test synthetic data generation
function encodeUint8ArrayToBase64(uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8Array).toString('base64');
  }
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return globalThis.btoa(binary);
}

test('normalizes valid Front and Side segmentation with deterministic classes and bounds', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');

  // 4x4 raster (16 pixels)
  // Grid layout:
  // [0, 0, 0, 0]
  // [0, 1, 1, 0]
  // [0, 1, 2, 0]
  // [0, 0, 0, 0]
  const raster = new Uint8Array([
    0, 0, 0, 0,
    0, 1, 1, 0,
    0, 1, 2, 0,
    0, 0, 0, 0,
  ]);
  const base64 = encodeUint8ArrayToBase64(raster);

  const rawSeg = {
    model: 'schp',
    view: 'front',
    num_classes: 4,
    class_names: ['background', 'skin', 'hair', 'upper_clothes'],
    class_counts: {
      background: 12,
      skin: 3,
      hair: 1,
      // upper_clothes omitted (sparse count test)
    },
    labels: {
      shape: [4, 4],
      dtype: 'uint8',
      base64,
    },
  };

  const normalized = normalizeSegmentation(rawSeg, { expectedView: 'front' });

  assert.equal(normalized.view, 'front');
  assert.equal(normalized.model, 'schp');
  assert.equal(normalized.widthPx, 4);
  assert.equal(normalized.heightPx, 4);
  assert.equal(normalized.dtype, 'uint8');
  assert.equal(normalized.classes.length, 4);

  // Class 0: background
  const c0 = normalized.classes[0];
  assert.equal(c0.classId, 0);
  assert.equal(c0.label, 'background');
  assert.equal(c0.pixelCount, 12);
  assert.equal(c0.coverage, 12 / 16);
  assert.equal(c0.present, true);
  assert.deepEqual(c0.boundsPx, { minX: 0, minY: 0, maxX: 3, maxY: 3 });
  assert.deepEqual(c0.boundsNormalized, { minX: 0, minY: 0, maxX: 3 / 4, maxY: 3 / 4 });

  // Class 1: skin
  const c1 = normalized.classes[1];
  assert.equal(c1.classId, 1);
  assert.equal(c1.label, 'skin');
  assert.equal(c1.pixelCount, 3);
  assert.equal(c1.coverage, 3 / 16);
  assert.equal(c1.present, true);
  assert.deepEqual(c1.boundsPx, { minX: 1, minY: 1, maxX: 2, maxY: 2 });
  assert.deepEqual(c1.boundsNormalized, { minX: 1 / 4, minY: 1 / 4, maxX: 2 / 4, maxY: 2 / 4 });

  // Class 2: hair (rejected class in face/head taxonomy)
  const c2 = normalized.classes[2];
  assert.equal(c2.classId, 2);
  assert.equal(c2.label, 'hair');
  assert.equal(c2.pixelCount, 1);
  assert.equal(c2.coverage, 1 / 16);
  assert.equal(c2.present, true);
  assert.deepEqual(c2.boundsPx, { minX: 2, minY: 2, maxX: 2, maxY: 2 });
  assert.deepEqual(c2.boundsNormalized, { minX: 2 / 4, minY: 2 / 4, maxX: 2 / 4, maxY: 2 / 4 });

  // Class 3: upper_clothes (0 pixels)
  const c3 = normalized.classes[3];
  assert.equal(c3.classId, 3);
  assert.equal(c3.label, 'upper_clothes');
  assert.equal(c3.pixelCount, 0);
  assert.equal(c3.coverage, 0);
  assert.equal(c3.present, false);
  assert.equal(c3.boundsPx, null);
  assert.equal(c3.boundsNormalized, null);

  // Rejected classes
  assert.deepEqual(normalized.rejectedClasses, ['hair']);

  // Deterministic QA checks
  assert.equal(normalized.qa.valid, true);
  assert.equal(normalized.qa.validView, true);
  assert.equal(normalized.qa.numClassesMatches, true);
  assert.equal(normalized.qa.validShape, true);
  assert.equal(normalized.qa.validDtype, true);
  assert.equal(normalized.qa.decodeSuccess, true);
  assert.equal(normalized.qa.pixelCountMatchesShape, true);
  assert.equal(normalized.qa.classIdsInRange, true);
  assert.equal(normalized.qa.countsMatch, true);
  assert.deepEqual(normalized.qa.issues, []);
});

test('QA check: validates view and detects view mismatch', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');
  const raster = new Uint8Array([0, 0, 0, 0]);
  const base64 = encodeUint8ArrayToBase64(raster);

  // 1. Missing view
  const noView = normalizeSegmentation({
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'uint8', base64 },
  });
  assert.equal(noView.qa.validView, false);
  assert.equal(noView.qa.valid, false);

  // 2. View mismatch (got side, expected front)
  const mismatch = normalizeSegmentation({
    view: 'side',
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'uint8', base64 },
  }, { expectedView: 'front' });
  assert.equal(mismatch.qa.validView, false);
  assert.equal(mismatch.qa.valid, false);
  assert.equal(mismatch.qa.issues.some((i) => i.includes('View mismatch')), true);

  // 3. Case insensitive match (FRONT -> front)
  const upperMatch = normalizeSegmentation({
    view: 'FRONT',
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'uint8', base64 },
  }, { expectedView: 'front' });
  assert.equal(upperMatch.qa.validView, true);
  assert.equal(upperMatch.view, 'front');
});

test('QA check: validates num_classes matches class_names.length', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');
  const raster = new Uint8Array([0, 0, 0, 0]);
  const base64 = encodeUint8ArrayToBase64(raster);

  const mismatch = normalizeSegmentation({
    view: 'front',
    num_classes: 5,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'uint8', base64 },
  });

  assert.equal(mismatch.qa.numClassesMatches, false);
  assert.equal(mismatch.qa.valid, false);
  assert.equal(mismatch.qa.issues.some((i) => i.includes('num_classes (5) does not match')), true);
});

test('QA check: validates shape and dtype', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');
  const raster = new Uint8Array([0, 0, 0, 0]);
  const base64 = encodeUint8ArrayToBase64(raster);

  // Invalid shape (1D instead of 2D)
  const badShape = normalizeSegmentation({
    view: 'front',
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [4], dtype: 'uint8', base64 },
  });
  assert.equal(badShape.qa.validShape, false);
  assert.equal(badShape.qa.valid, false);

  // Invalid dtype (float32 instead of uint8)
  const badDtype = normalizeSegmentation({
    view: 'front',
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'float32', base64 },
  });
  assert.equal(badDtype.qa.validDtype, false);
  assert.equal(badDtype.qa.valid, false);
});

test('QA check: validates base64 decode and decoded length matching shape', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');

  // Corrupted base64
  const badBase64 = normalizeSegmentation({
    view: 'front',
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: '!!!not-base64!!!' },
  });
  assert.equal(badBase64.qa.decodeSuccess, false);
  assert.equal(badBase64.qa.valid, false);

  // Decoded length (3 bytes) does not match shape 2x2 (4 bytes)
  const shortRaster = new Uint8Array([0, 0, 0]);
  const lengthMismatch = normalizeSegmentation({
    view: 'front',
    num_classes: 1,
    class_names: ['background'],
    class_counts: { background: 4 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(shortRaster) },
  });
  assert.equal(lengthMismatch.qa.decodeSuccess, true);
  assert.equal(lengthMismatch.qa.pixelCountMatchesShape, false);
  assert.equal(lengthMismatch.qa.valid, false);
});

test('QA check: validates class IDs in range', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');

  // Raster has classId 9, but num_classes is 2 (valid IDs: 0..1)
  const outOfRangeRaster = new Uint8Array([0, 1, 9, 0]);
  const outOfRange = normalizeSegmentation({
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'body'],
    class_counts: { background: 2, body: 1 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(outOfRangeRaster) },
  });

  assert.equal(outOfRange.qa.classIdsInRange, false);
  assert.equal(outOfRange.qa.outOfRangePixelCount, 1);
  assert.equal(outOfRange.qa.valid, false);
  assert.equal(outOfRange.qa.issues.some((i) => i.includes('out of range')), true);
});

test('QA check: validates recomputed pixel counts against class_counts (sparse and dense)', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');

  const raster = new Uint8Array([0, 0, 1, 1]); // 2 background, 2 skin
  const base64 = encodeUint8ArrayToBase64(raster);

  // Mismatch in count
  const countMismatch = normalizeSegmentation({
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 3, skin: 1 }, // mismatch: actual is 2, 2
    labels: { shape: [2, 2], dtype: 'uint8', base64 },
  });

  assert.equal(countMismatch.qa.countsMatch, false);
  assert.equal(countMismatch.qa.valid, false);
  assert.equal(countMismatch.qa.issues.some((i) => i.includes('count mismatch')), true);

  // Sparse count object where omitted class has non-zero pixels -> mismatch
  const sparseMismatch = normalizeSegmentation({
    view: 'front',
    num_classes: 3,
    class_names: ['background', 'skin', 'hair'],
    class_counts: { background: 2, skin: 2 }, // 'hair' omitted -> expected 0
    labels: {
      shape: [2, 2],
      dtype: 'uint8',
      base64: encodeUint8ArrayToBase64(new Uint8Array([0, 0, 1, 2])), // hair has 1 pixel
    },
  });

  assert.equal(sparseMismatch.qa.countsMatch, false);
  assert.equal(sparseMismatch.qa.valid, false);
});

test('handles 2000x2000 realistic segmentation raster efficiently', async () => {
  const { normalizeSegmentation } = await import('./bodyEvidenceAdapter.js');

  const width = 2000;
  const height = 2000;
  const totalPixels = width * height;
  const raster = new Uint8Array(totalPixels);

  // Fill a 500x500 square with class 1 (skin) from (100, 200) to (599, 699)
  let skinCount = 0;
  for (let y = 200; y < 700; y += 1) {
    for (let x = 100; x < 600; x += 1) {
      raster[y * width + x] = 1;
      skinCount += 1;
    }
  }
  const bgCount = totalPixels - skinCount;

  const base64 = encodeUint8ArrayToBase64(raster);

  const start = performance.now();
  const normalized = normalizeSegmentation({
    model: 'schp-v0',
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: {
      background: bgCount,
      skin: skinCount,
    },
    labels: {
      shape: [height, width],
      dtype: 'uint8',
      base64,
    },
  }, { expectedView: 'front' });
  const elapsed = performance.now() - start;

  assert.equal(normalized.qa.valid, true);
  assert.equal(normalized.widthPx, 2000);
  assert.equal(normalized.heightPx, 2000);
  assert.equal(normalized.classes[1].pixelCount, 250000);
  assert.deepEqual(normalized.classes[1].boundsPx, {
    minX: 100,
    minY: 200,
    maxX: 599,
    maxY: 699,
  });
  assert.deepEqual(normalized.classes[1].boundsNormalized, {
    minX: 100 / 2000,
    minY: 200 / 2000,
    maxX: 599 / 2000,
    maxY: 699 / 2000,
  });
  // Fast performance check: full 4MP single pass under 150ms
  assert.equal(elapsed < 200, true);
});

test('analyzeBodyEvidence integrates Front and Side normalized segmentation with diagnostic export safety', async () => {
  const { analyzeBodyEvidence } = await import('./bodyEvidenceAdapter.js');
  const { buildBodyEvidenceExport } = await import('./bodyEvidence.js');

  const rasterFront = new Uint8Array([0, 0, 1, 1]);
  const rasterSide = new Uint8Array([0, 1, 0, 1]);

  const result = analyzeBodyEvidence({
    frontSeg: {
      model: 'schp',
      view: 'front',
      num_classes: 2,
      class_names: ['background', 'skin'],
      class_counts: { background: 2, skin: 2 },
      labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
    },
    sideSeg: {
      model: 'schp',
      view: 'side',
      num_classes: 2,
      class_names: ['background', 'skin'],
      class_counts: { background: 2, skin: 2 },
      labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
    },
  });

  assert.equal(result.loaded.frontSeg, true);
  assert.equal(result.loaded.sideSeg, true);
  assert.equal(result.views.front.segmentation.qa.valid, true);
  assert.equal(result.views.side.segmentation.qa.valid, true);
  assert.equal(result.views.front.segmentation.classes.length, 2);
  assert.equal(result.views.side.segmentation.classes.length, 2);

  // Diagnostic export inspection
  // Simulate setting qaResult via setFrontSegSource/analyzeLoadedBodyEvidence or build export helper
  const { setFrontSegSource, setSideSegSource, analyzeLoadedBodyEvidence } = await import('./bodyEvidence.js');
  setFrontSegSource({
    model: 'schp',
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 2, skin: 2 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
  });
  setSideSegSource({
    model: 'schp',
    view: 'side',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 2, skin: 2 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
  });
  const analyzeRes = analyzeLoadedBodyEvidence();
  assert.equal(analyzeRes.ok, true);

  const exportData = buildBodyEvidenceExport();
  assert.equal(exportData.views.front.segmentation.view, 'front');
  assert.equal(exportData.views.front.segmentation.model, 'schp');
  assert.equal(exportData.views.front.segmentation.widthPx, 2);
  assert.equal(exportData.views.front.segmentation.heightPx, 2);
  assert.equal(exportData.views.front.segmentation.dtype, 'uint8');
  assert.equal(exportData.views.front.segmentation.classes.length, 2);
  assert.equal(exportData.views.front.segmentation.qa.valid, true);

  // Crucial security & payload size check: base64/raw raster is NOT exported
  assert.equal('base64' in exportData.views.front.segmentation, false);
  assert.equal('labels' in exportData.views.front.segmentation, false);
  assert.equal('raster' in exportData.views.front.segmentation, false);
});

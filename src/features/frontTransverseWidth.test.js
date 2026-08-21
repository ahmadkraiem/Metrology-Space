import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FRONT_TRANSVERSE_WIDTH_CONTRACT,
  FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
  FRONT_RUN_SELECTION_POLICIES,
  FRONT_TRANSVERSE_WIDTH_STATUS,
  SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0,
  interpretFrontTransverseWidth,
} from './frontTransverseWidth.js';
import {
  sampleFrontHorizontalRasterSlice,
} from './frontRasterSlice.js';

test('Front Transverse Width Contract v0 exports contract metadata and supported definitions', () => {
  assert.equal(FRONT_TRANSVERSE_WIDTH_CONTRACT, 'front-transverse-width-v0');
  assert.equal(FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION, 'front-transverse-width-v0');

  assert.equal(FRONT_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED, 'single_run_required');
  assert.equal(FRONT_TRANSVERSE_WIDTH_STATUS.VALID, 'valid');
  assert.equal(FRONT_TRANSVERSE_WIDTH_STATUS.UNAVAILABLE, 'unavailable');
  assert.equal(FRONT_TRANSVERSE_WIDTH_STATUS.AMBIGUOUS, 'ambiguous');
  assert.equal(FRONT_TRANSVERSE_WIDTH_STATUS.INVALID, 'invalid');

  const defs = SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0;
  assert.ok(defs.torso_width_at_shoulder_level);
  assert.equal(defs.torso_width_at_shoulder_level.id, 'torso_width_at_shoulder_level');
  assert.equal(defs.torso_width_at_shoulder_level.name, 'Torso Transverse Width at Shoulder Level');
  assert.equal(defs.torso_width_at_shoulder_level.sourceLevel, 'shoulder');
  assert.equal(defs.torso_width_at_shoulder_level.targetPolicy, 'trunk_core_support_v0');
  assert.equal(defs.torso_width_at_shoulder_level.supportPolicyId, 'trunk_core_support_v0');
  assert.deepEqual(defs.torso_width_at_shoulder_level.targetClassIds, [22, 23]);
  assert.equal(defs.torso_width_at_shoulder_level.runSelectionPolicy, 'single_run_required');

  assert.ok(defs.torso_width_at_hip_level);
  assert.equal(defs.torso_width_at_hip_level.id, 'torso_width_at_hip_level');
  assert.equal(defs.torso_width_at_hip_level.name, 'Torso Transverse Width at Hip Level');
  assert.equal(defs.torso_width_at_hip_level.sourceLevel, 'hip');
  assert.equal(defs.torso_width_at_hip_level.targetPolicy, 'pelvic_core_support_v0');
  assert.equal(defs.torso_width_at_hip_level.supportPolicyId, 'pelvic_core_support_v0');
  assert.deepEqual(defs.torso_width_at_hip_level.targetClassIds, [12, 13, 21, 22]);
  assert.equal(defs.torso_width_at_hip_level.runSelectionPolicy, 'single_run_required');
});

test('interprets a valid single Torso run into a valid transverse width with exact metric span', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    version: 'front-horizontal-raster-slice-v0',
    view: 'front',
    requestedYcm: 150.0,
    sampledRow: 500,
    rowNormalizedV: 0.25,
    targetClassIds: [22, 23],
    runs: [
      {
        startCol: 800,
        endCol: 1199,
        pixelCount: 400,
        boundsNormalized: { minU: 0.4, maxU: 0.6 },
        boundsCm: { minX: 80.0, maxX: 120.0 },
        encounteredClassIds: [22],
      },
    ],
    summary: { runCount: 1, totalMatchedPixels: 400 },
    issues: [],
  };

  const level = { id: 'shoulder', status: 'ready', yCm: 150.0 };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'torso_width_at_shoulder_level',
    level,
  });

  assert.equal(result.contract, 'front-transverse-width-v0');
  assert.equal(result.version, 'front-transverse-width-v0');
  assert.equal(result.view, 'front');
  assert.equal(result.id, 'torso_width_at_shoulder_level');
  assert.equal(result.name, 'Torso Transverse Width at Shoulder Level');
  assert.equal(result.type, 'transverse_width');
  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 40.0); // 120.0 - 80.0

  assert.equal(result.provenance.sourceLevel, 'shoulder');
  assert.equal(result.provenance.levelYcm, 150.0);
  assert.equal(result.provenance.sampledPixelRow, 500);
  assert.equal(result.provenance.sourceSliceContract, 'front-horizontal-raster-slice-v0');
  assert.equal(result.provenance.targetPolicy, 'trunk_core_support_v0');
  assert.equal(result.provenance.supportPolicyId, 'trunk_core_support_v0');
  assert.deepEqual(result.provenance.targetClassIds, [22, 23]);
  assert.deepEqual(result.provenance.actualClassIdsUsed, [22]);
  assert.deepEqual(result.provenance.clothingClassIdsUsed, []);
  assert.equal(result.provenance.usedClothingEvidence, false);
  assert.equal(result.provenance.runSelectionPolicy, 'single_run_required');
  assert.equal(result.provenance.selectedRunIndex, 0);
  assert.equal(result.provenance.leftXcm, 80.0);
  assert.equal(result.provenance.rightXcm, 120.0);
  assert.equal(result.issues.length, 0);
});

test('returns unavailable when source anatomical level is partial or missing', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [{ boundsCm: { minX: 80.0, maxX: 120.0 } }],
  };

  // Partial level
  const resPartial = interpretFrontTransverseWidth(sliceResult, {
    definition: 'torso_width_at_shoulder_level',
    level: { id: 'shoulder', status: 'partial', yCm: null },
  });
  assert.equal(resPartial.status, 'unavailable');
  assert.equal(resPartial.valueCm, null);
  assert.ok(resPartial.issues.some((i) => i.includes('partial')));

  // Missing level
  const resMissing = interpretFrontTransverseWidth(sliceResult, {
    definition: 'torso_width_at_shoulder_level',
    level: { id: 'shoulder', status: 'missing', yCm: null },
  });
  assert.equal(resMissing.status, 'unavailable');
  assert.equal(resMissing.valueCm, null);
  assert.ok(resMissing.issues.some((i) => i.includes('missing')));
});

test('returns unavailable when zero runs are found on sampled row', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [],
    summary: { runCount: 0, totalMatchedPixels: 0 },
    issues: [],
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'torso_width_at_hip_level',
    level: { id: 'hip', status: 'ready', yCm: 90.0 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.valueCm, null);
  assert.equal(result.provenance.selectedRunIndex, null);
  assert.ok(result.issues.some((i) => i.includes('No matching segmentation runs')));
});

test('returns ambiguous and valueCm null when multiple runs exist under single_run_required', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [
      { boundsCm: { minX: 20.0, maxX: 40.0 } }, // left arm
      { boundsCm: { minX: 80.0, maxX: 120.0 } }, // torso
      { boundsCm: { minX: 160.0, maxX: 180.0 } }, // right arm
    ],
    summary: { runCount: 3, totalMatchedPixels: 800 },
    issues: [],
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'torso_width_at_shoulder_level',
    level: { id: 'shoulder', status: 'ready', yCm: 150.0 },
  });

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.valueCm, null);
  assert.equal(result.provenance.selectedRunIndex, null);
  assert.equal(result.provenance.leftXcm, null);
  assert.equal(result.provenance.rightXcm, null);
  assert.ok(result.issues.some((i) => i.includes('Multiple separated runs')));
});

test('returns invalid for malformed bounds, invalid contracts, or unsupported policies', () => {
  // Negative / zero span
  const resBadBounds = interpretFrontTransverseWidth(
    {
      contract: 'front-horizontal-raster-slice-v0',
      runs: [{ boundsCm: { minX: 100.0, maxX: 90.0 } }],
    },
    { definition: 'torso_width_at_shoulder_level', level: { status: 'ready', yCm: 150 } },
  );
  assert.equal(resBadBounds.status, 'invalid');
  assert.equal(resBadBounds.valueCm, null);

  // Non-finite bounds
  const resNaN = interpretFrontTransverseWidth(
    {
      contract: 'front-horizontal-raster-slice-v0',
      runs: [{ boundsCm: { minX: NaN, maxX: 100.0 } }],
    },
    { definition: 'torso_width_at_shoulder_level', level: { status: 'ready', yCm: 150 } },
  );
  assert.equal(resNaN.status, 'invalid');

  // Unsupported selection policy
  const resBadPolicy = interpretFrontTransverseWidth(
    { contract: 'front-horizontal-raster-slice-v0', runs: [] },
    { runSelectionPolicy: 'outermost_union_merge' },
  );
  assert.equal(resBadPolicy.status, 'invalid');
  assert.ok(resBadPolicy.issues.some((i) => i.includes('Unsupported runSelectionPolicy')));

  // Invalid slice contract
  const resBadContract = interpretFrontTransverseWidth(
    { contract: 'wrong-contract', runs: [] },
    { definition: 'torso_width_at_shoulder_level' },
  );
  assert.equal(resBadContract.status, 'invalid');
});

test('bodyEvidence.js getFrontTransverseWidth and getFrontTransverseWidths integrate with active runtime state', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getFrontTransverseWidth,
    getFrontTransverseWidths,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 10x10 image
  // Row 2 (yCm = 150 -> row 2.5 clamped to 2): col 3..6 are Torso (22)
  const rasterFront = new Uint8Array(100);
  for (let c = 3; c <= 6; c += 1) {
    rasterFront[2 * 10 + c] = 22; // Row 2: cols 3, 4, 5, 6
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 96, Torso: 4 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });

  setBodyEvidencePackage(pkg);

  const mockAnnotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 30, y: 150, z: 200 } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 70, y: 150, z: 200 } },
  ];

  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  // Single width getter with ready shoulder level
  const shoulderWidth = getFrontTransverseWidth({
    id: 'torso_width_at_shoulder_level',
    annotations: mockAnnotations,
  });
  assert.ok(shoulderWidth);
  assert.equal(shoulderWidth.contract, 'front-transverse-width-v0');
  assert.equal(shoulderWidth.status, 'valid');
  assert.equal(shoulderWidth.valueCm, 80.0); // cols 3..6 -> minX = 3/10*200 = 60, maxX = 7/10*200 = 140 -> 80 cm
  assert.equal(shoulderWidth.provenance.sourceLevel, 'shoulder');
  assert.equal(shoulderWidth.provenance.levelYcm, 150.0);

  // Hip level has no hip landmarks promoted yet -> unavailable
  const hipWidth = getFrontTransverseWidth({
    id: 'torso_width_at_hip_level',
    annotations: mockAnnotations,
  });
  assert.ok(hipWidth);
  assert.equal(hipWidth.status, 'unavailable');
  assert.equal(hipWidth.valueCm, null);

  // Report getter
  const report = getFrontTransverseWidths({ annotations: mockAnnotations });
  assert.ok(report);
  assert.equal(report.contract, 'front-transverse-widths-report-v0');
  assert.equal(report.widths.length, 2);
  assert.equal(report.widths[0].status, 'valid');
  assert.equal(report.widths[1].status, 'unavailable');

  // Reset
  setBodyEvidencePackage(null);
  assert.equal(getFrontTransverseWidths({ annotations: mockAnnotations }), null);
});


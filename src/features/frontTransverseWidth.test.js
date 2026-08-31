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
  assert.ok(defs.neck_transverse_width_at_neck_level);
  assert.equal(defs.neck_transverse_width_at_neck_level.id, 'neck_transverse_width_at_neck_level');
  assert.equal(defs.neck_transverse_width_at_neck_level.name, 'Neck Transverse Width at Neck Level');
  assert.equal(defs.neck_transverse_width_at_neck_level.sourceLevel, 'neck');
  assert.equal(defs.neck_transverse_width_at_neck_level.targetPolicy, 'neck_core_support_v0');
  assert.equal(defs.neck_transverse_width_at_neck_level.supportPolicyId, 'neck_core_support_v0');
  assert.deepEqual(defs.neck_transverse_width_at_neck_level.targetClassIds, [3, 22, 23]);
  assert.equal(defs.neck_transverse_width_at_neck_level.runSelectionPolicy, 'single_run_required');

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

test('interprets a valid single Neck Face_Neck (3) run into a valid transverse width with exact metric span', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    version: 'front-horizontal-raster-slice-v0',
    view: 'front',
    requestedYcm: 155.0,
    sampledRow: 450,
    rowNormalizedV: 0.225,
    targetClassIds: [3, 22, 23],
    runs: [
      {
        startCol: 900,
        endCol: 1099,
        pixelCount: 200,
        boundsNormalized: { minU: 0.45, maxU: 0.55 },
        boundsCm: { minX: 90.0, maxX: 110.0 },
        encounteredClassIds: [3],
      },
    ],
    summary: { runCount: 1, totalMatchedPixels: 200 },
    issues: [],
  };

  const level = { id: 'neck', status: 'ready', yCm: 155.0 };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level,
  });

  assert.equal(result.contract, 'front-transverse-width-v0');
  assert.equal(result.version, 'front-transverse-width-v0');
  assert.equal(result.view, 'front');
  assert.equal(result.id, 'neck_transverse_width_at_neck_level');
  assert.equal(result.name, 'Neck Transverse Width at Neck Level');
  assert.equal(result.type, 'transverse_width');
  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 20.0); // 110.0 - 90.0

  assert.equal(result.provenance.sourceLevel, 'neck');
  assert.equal(result.provenance.levelYcm, 155.0);
  assert.equal(result.provenance.sampledPixelRow, 450);
  assert.equal(result.provenance.sourceSliceContract, 'front-horizontal-raster-slice-v0');
  assert.equal(result.provenance.targetPolicy, 'neck_core_support_v0');
  assert.equal(result.provenance.supportPolicyId, 'neck_core_support_v0');
  assert.deepEqual(result.provenance.targetClassIds, [3, 22, 23]);
  assert.deepEqual(result.provenance.actualClassIdsUsed, [3]);
  assert.deepEqual(result.provenance.clothingClassIdsUsed, []);
  assert.equal(result.provenance.usedClothingEvidence, false);
  assert.equal(result.provenance.runSelectionPolicy, 'single_run_required');
  assert.equal(result.provenance.selectedRunIndex, 0);
  assert.equal(result.provenance.leftXcm, 90.0);
  assert.equal(result.provenance.rightXcm, 110.0);
  assert.equal(result.issues.length, 0);
});

test('interprets Neck with Class 22 (Torso) support correctly without clothing flag', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [
      {
        startCol: 880,
        endCol: 1119,
        boundsCm: { minX: 88.0, maxX: 112.0 },
        encounteredClassIds: [22],
      },
    ],
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'ready', yCm: 152.0 },
  });

  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 24.0);
  assert.deepEqual(result.provenance.actualClassIdsUsed, [22]);
  assert.deepEqual(result.provenance.clothingClassIdsUsed, []);
  assert.equal(result.provenance.usedClothingEvidence, false);
});

test('interprets Neck with Class 23 (Upper_Clothing) collar support and records clothing provenance', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [
      {
        startCol: 870,
        endCol: 1129,
        boundsCm: { minX: 87.0, maxX: 113.0 },
        encounteredClassIds: [23],
      },
    ],
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'ready', yCm: 150.0 },
  });

  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 26.0);
  assert.deepEqual(result.provenance.actualClassIdsUsed, [23]);
  assert.deepEqual(result.provenance.clothingClassIdsUsed, [23]);
  assert.equal(result.provenance.usedClothingEvidence, true);
});

test('interprets Neck with mixed contiguous classes 3, 22, 23 in one run as valid with complete provenance', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [
      {
        startCol: 850,
        endCol: 1149,
        boundsCm: { minX: 85.0, maxX: 115.0 },
        encounteredClassIds: [3, 22, 23],
      },
    ],
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'ready', yCm: 153.0 },
  });

  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 30.0);
  assert.deepEqual(result.provenance.actualClassIdsUsed, [3, 22, 23]);
  assert.deepEqual(result.provenance.clothingClassIdsUsed, [23]);
  assert.equal(result.provenance.usedClothingEvidence, true);
});

test('returns unavailable for Neck when level is missing or partial', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [{ boundsCm: { minX: 90.0, maxX: 110.0 } }],
  };

  // Missing level
  const resMissing = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'missing', yCm: null },
  });
  assert.equal(resMissing.status, 'unavailable');
  assert.equal(resMissing.valueCm, null);

  // Partial level
  const resPartial = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'partial', yCm: null },
  });
  assert.equal(resPartial.status, 'unavailable');
  assert.equal(resPartial.valueCm, null);
});

test('returns unavailable for Neck when zero runs found', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [],
    summary: { runCount: 0 },
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'ready', yCm: 155.0 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.valueCm, null);
});

test('returns ambiguous for Neck when multiple separated runs exist under single_run_required', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [
      { boundsCm: { minX: 70.0, maxX: 80.0 } },
      { boundsCm: { minX: 90.0, maxX: 110.0 } },
    ],
  };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level: { id: 'neck', status: 'ready', yCm: 155.0 },
  });

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.valueCm, null);
});

test('returns invalid for Neck when bounds are inverted or non-finite', () => {
  const resInverted = interpretFrontTransverseWidth(
    {
      contract: 'front-horizontal-raster-slice-v0',
      runs: [{ boundsCm: { minX: 110.0, maxX: 90.0 } }],
    },
    { definition: 'neck_transverse_width_at_neck_level', level: { status: 'ready', yCm: 155 } },
  );
  assert.equal(resInverted.status, 'invalid');
  assert.equal(resInverted.valueCm, null);

  const resEqual = interpretFrontTransverseWidth(
    {
      contract: 'front-horizontal-raster-slice-v0',
      runs: [{ boundsCm: { minX: 100.0, maxX: 100.0 } }],
    },
    { definition: 'neck_transverse_width_at_neck_level', level: { status: 'ready', yCm: 155 } },
  );
  assert.equal(resEqual.status, 'invalid');
  assert.equal(resEqual.valueCm, null);
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
  // Row 1 (yCm = 170 -> row 1.5 clamped to 1): col 4..5 are Face_Neck (3)
  // Row 2 (yCm = 150 -> row 2.5 clamped to 2): col 3..6 are Torso (22)
  const rasterFront = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) {
    rasterFront[1 * 10 + c] = 3; // Row 1: cols 4, 5 (Face_Neck)
  }
  for (let c = 3; c <= 6; c += 1) {
    rasterFront[2 * 10 + c] = 22; // Row 2: cols 3, 4, 5, 6 (Torso)
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[3] = 'Face_Neck';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 94, Face_Neck: 2, Torso: 4 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });

  setBodyEvidencePackage(pkg);

  const mockAnnotations = [
    { type: 'body_landmark', name: 'neck', point: { x: 50, y: 170, z: 200 } },
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 30, y: 150, z: 200 } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 70, y: 150, z: 200 } },
  ];

  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  // Neck width getter with ready neck level
  const neckWidth = getFrontTransverseWidth({
    id: 'neck_transverse_width_at_neck_level',
    annotations: mockAnnotations,
  });
  assert.ok(neckWidth);
  assert.equal(neckWidth.contract, 'front-transverse-width-v0');
  assert.equal(neckWidth.status, 'valid');
  assert.equal(neckWidth.valueCm, 40.0); // cols 4..5 -> minX = 4/10*200 = 80, maxX = 6/10*200 = 120 -> 40 cm
  assert.equal(neckWidth.provenance.sourceLevel, 'neck');
  assert.equal(neckWidth.provenance.levelYcm, 170.0);
  assert.equal(neckWidth.provenance.targetPolicy, 'neck_core_support_v0');

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

  // Report getter includes all 3 registered front transverse widths (neck, shoulder, hip)
  const report = getFrontTransverseWidths({ annotations: mockAnnotations });
  assert.ok(report);
  assert.equal(report.contract, 'front-transverse-widths-report-v0');
  assert.equal(report.widths.length, 3);
  assert.equal(report.widths[0].id, 'neck_transverse_width_at_neck_level');
  assert.equal(report.widths[0].status, 'valid');
  assert.equal(report.widths[1].id, 'torso_width_at_shoulder_level');
  assert.equal(report.widths[1].status, 'valid');
  assert.equal(report.widths[2].id, 'torso_width_at_hip_level');
  assert.equal(report.widths[2].status, 'unavailable');

  // Reset
  setBodyEvidencePackage(null);
  assert.equal(getFrontTransverseWidths({ annotations: mockAnnotations }), null);
});

test('confirms Neck Transverse Width valueCm is strictly rightXcm - leftXcm without landmark or diagonal chord calculation', () => {
  const sliceResult = {
    contract: 'front-horizontal-raster-slice-v0',
    runs: [
      {
        startCol: 850,
        endCol: 1150,
        boundsCm: { minX: 85.0, maxX: 115.0 },
        encounteredClassIds: [3],
      },
    ],
  };

  const level = { id: 'neck', status: 'ready', yCm: 155.0 };

  const result = interpretFrontTransverseWidth(sliceResult, {
    definition: 'neck_transverse_width_at_neck_level',
    level,
  });

  assert.equal(result.status, 'valid');
  assert.equal(result.provenance.leftXcm, 85.0);
  assert.equal(result.provenance.rightXcm, 115.0);
  assert.equal(result.valueCm, 115.0 - 85.0); // 30.0
  assert.equal(result.valueCm, 30.0);
});


import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_PROFILE_SPAN_CONTRACT,
  SIDE_PROFILE_SPAN_CONTRACT_VERSION,
  SIDE_RUN_SELECTION_POLICIES,
  SIDE_PROFILE_SPAN_STATUS,
  SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0,
  interpretSideProfileSpan,
} from './sideProfileSpan.js';
import {
  sampleSideHorizontalRasterSlice,
} from './sideRasterSlice.js';

test('Side Profile Span Contract v0 exports contract metadata and supported definitions', () => {
  assert.equal(SIDE_PROFILE_SPAN_CONTRACT, 'side-profile-span-v0');
  assert.equal(SIDE_PROFILE_SPAN_CONTRACT_VERSION, 'side-profile-span-v0');

  assert.equal(SIDE_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED, 'single_run_required');
  assert.equal(SIDE_PROFILE_SPAN_STATUS.VALID, 'valid');
  assert.equal(SIDE_PROFILE_SPAN_STATUS.UNAVAILABLE, 'unavailable');
  assert.equal(SIDE_PROFILE_SPAN_STATUS.AMBIGUOUS, 'ambiguous');
  assert.equal(SIDE_PROFILE_SPAN_STATUS.INVALID, 'invalid');

  const defs = SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0;
  assert.ok(defs.torso_profile_span_at_shoulder_level);
  assert.equal(defs.torso_profile_span_at_shoulder_level.id, 'torso_profile_span_at_shoulder_level');
  assert.equal(defs.torso_profile_span_at_shoulder_level.name, 'Torso Profile Span at Shoulder Level');
  assert.equal(defs.torso_profile_span_at_shoulder_level.sourceLevel, 'shoulder');
  assert.equal(defs.torso_profile_span_at_shoulder_level.targetPolicy, 'torso_only');
  assert.deepEqual(defs.torso_profile_span_at_shoulder_level.targetClassIds, [22]);
  assert.equal(defs.torso_profile_span_at_shoulder_level.runSelectionPolicy, 'single_run_required');

  assert.ok(defs.torso_profile_span_at_hip_level);
  assert.equal(defs.torso_profile_span_at_hip_level.id, 'torso_profile_span_at_hip_level');
  assert.equal(defs.torso_profile_span_at_hip_level.name, 'Torso Profile Span at Hip Level');
  assert.equal(defs.torso_profile_span_at_hip_level.sourceLevel, 'hip');
  assert.equal(defs.torso_profile_span_at_hip_level.targetPolicy, 'torso_only');
  assert.deepEqual(defs.torso_profile_span_at_hip_level.targetClassIds, [22]);
  assert.equal(defs.torso_profile_span_at_hip_level.runSelectionPolicy, 'single_run_required');
});

test('interprets a valid single Torso run into a valid profile span with exact metric span', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    version: 'side-horizontal-raster-slice-v0',
    view: 'side',
    requestedYcm: 150.0,
    sampledRow: 500,
    rowNormalizedV: 0.25,
    targetClassIds: [22],
    runs: [
      {
        startCol: 800,
        endCol: 1199,
        pixelCount: 400,
        boundsNormalized: { minU: 0.4, maxU: 0.6 },
        boundsCm: { minU: 80.0, maxU: 120.0 },
      },
    ],
    summary: { runCount: 1, totalMatchedPixels: 400 },
    issues: [],
  };

  const level = { id: 'shoulder', status: 'ready', yCm: 150.0 };

  const result = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_shoulder_level',
    level,
  });

  assert.equal(result.contract, 'side-profile-span-v0');
  assert.equal(result.version, 'side-profile-span-v0');
  assert.equal(result.view, 'side');
  assert.equal(result.id, 'torso_profile_span_at_shoulder_level');
  assert.equal(result.name, 'Torso Profile Span at Shoulder Level');
  assert.equal(result.type, 'profile_span');
  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 40.0); // 120.0 - 80.0
  assert.equal(result.minUcm, 80.0);
  assert.equal(result.maxUcm, 120.0);

  assert.equal(result.provenance.sourceLevel, 'shoulder');
  assert.equal(result.provenance.levelYcm, 150.0);
  assert.equal(result.provenance.sampledPixelRow, 500);
  assert.equal(result.provenance.sourceSliceContract, 'side-horizontal-raster-slice-v0');
  assert.equal(result.provenance.targetPolicy, 'torso_only');
  assert.deepEqual(result.provenance.targetClassIds, [22]);
  assert.equal(result.provenance.runSelectionPolicy, 'single_run_required');
  assert.equal(result.provenance.selectedRunIndex, 0);
  assert.equal(result.provenance.minUcm, 80.0);
  assert.equal(result.provenance.maxUcm, 120.0);
  assert.equal(result.issues.length, 0);
});

test('interprets hip-level valid single run with exact maxUcm - minUcm span', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    version: 'side-horizontal-raster-slice-v0',
    view: 'side',
    requestedYcm: 90.0,
    sampledRow: 1100,
    rowNormalizedV: 0.55,
    targetClassIds: [22],
    runs: [
      {
        startCol: 600,
        endCol: 999,
        pixelCount: 400,
        boundsNormalized: { minU: 0.3, maxU: 0.5 },
        boundsCm: { minU: 60.0, maxU: 100.0 },
      },
    ],
    summary: { runCount: 1, totalMatchedPixels: 400 },
    issues: [],
  };

  const level = { id: 'hip', status: 'ready', yCm: 90.0 };

  const result = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_hip_level',
    level,
  });

  assert.equal(result.status, 'valid');
  assert.equal(result.valueCm, 40.0);
  assert.equal(result.minUcm, 60.0);
  assert.equal(result.maxUcm, 100.0);
  assert.equal(result.provenance.sourceLevel, 'hip');
  assert.equal(result.provenance.levelYcm, 90.0);
});

test('returns unavailable when source anatomical level is partial or missing', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    runs: [{ boundsCm: { minU: 80.0, maxU: 120.0 } }],
  };

  // Partial level
  const resPartial = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_shoulder_level',
    level: { id: 'shoulder', status: 'partial', yCm: null },
  });
  assert.equal(resPartial.status, 'unavailable');
  assert.equal(resPartial.valueCm, null);
  assert.equal(resPartial.minUcm, null);
  assert.equal(resPartial.maxUcm, null);
  assert.ok(resPartial.issues.some((i) => i.includes('partial')));

  // Missing level
  const resMissing = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_shoulder_level',
    level: { id: 'shoulder', status: 'missing', yCm: null },
  });
  assert.equal(resMissing.status, 'unavailable');
  assert.equal(resMissing.valueCm, null);
  assert.equal(resMissing.minUcm, null);
  assert.equal(resMissing.maxUcm, null);
  assert.ok(resMissing.issues.some((i) => i.includes('missing')));
});

test('returns unavailable when zero runs are found on sampled row', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    runs: [],
    summary: { runCount: 0, totalMatchedPixels: 0 },
    issues: [],
  };

  const result = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_hip_level',
    level: { id: 'hip', status: 'ready', yCm: 90.0 },
  });

  assert.equal(result.status, 'unavailable');
  assert.equal(result.valueCm, null);
  assert.equal(result.minUcm, null);
  assert.equal(result.maxUcm, null);
  assert.equal(result.provenance.selectedRunIndex, null);
  assert.ok(result.issues.some((i) => i.includes('No matching segmentation runs')));
});

test('returns ambiguous and valueCm null when multiple runs exist under single_run_required', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    runs: [
      { boundsCm: { minU: 20.0, maxU: 40.0 } }, // arm or appendage
      { boundsCm: { minU: 80.0, maxU: 120.0 } }, // torso
      { boundsCm: { minU: 160.0, maxU: 180.0 } }, // other appendage
    ],
    summary: { runCount: 3, totalMatchedPixels: 800 },
    issues: [],
  };

  const result = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_shoulder_level',
    level: { id: 'shoulder', status: 'ready', yCm: 150.0 },
  });

  assert.equal(result.status, 'ambiguous');
  assert.equal(result.valueCm, null);
  assert.equal(result.minUcm, null);
  assert.equal(result.maxUcm, null);
  assert.equal(result.provenance.selectedRunIndex, null);
  assert.equal(result.provenance.minUcm, null);
  assert.equal(result.provenance.maxUcm, null);
  assert.ok(result.issues.some((i) => i.includes('Multiple separated runs')));
});

test('returns invalid for malformed bounds, invalid contracts, or unsupported policies', () => {
  // Negative / zero span
  const resBadBounds = interpretSideProfileSpan(
    {
      contract: 'side-horizontal-raster-slice-v0',
      runs: [{ boundsCm: { minU: 100.0, maxU: 90.0 } }],
    },
    { definition: 'torso_profile_span_at_shoulder_level', level: { status: 'ready', yCm: 150 } },
  );
  assert.equal(resBadBounds.status, 'invalid');
  assert.equal(resBadBounds.valueCm, null);

  // Non-finite bounds
  const resNaN = interpretSideProfileSpan(
    {
      contract: 'side-horizontal-raster-slice-v0',
      runs: [{ boundsCm: { minU: NaN, maxU: 100.0 } }],
    },
    { definition: 'torso_profile_span_at_shoulder_level', level: { status: 'ready', yCm: 150 } },
  );
  assert.equal(resNaN.status, 'invalid');

  // Unsupported selection policy
  const resBadPolicy = interpretSideProfileSpan(
    { contract: 'side-horizontal-raster-slice-v0', runs: [] },
    { runSelectionPolicy: 'outermost_union_merge' },
  );
  assert.equal(resBadPolicy.status, 'invalid');
  assert.ok(resBadPolicy.issues.some((i) => i.includes('Unsupported runSelectionPolicy')));

  // Invalid slice contract
  const resBadContract = interpretSideProfileSpan(
    { contract: 'wrong-contract', runs: [] },
    { definition: 'torso_profile_span_at_shoulder_level' },
  );
  assert.equal(resBadContract.status, 'invalid');
});

test('interpretSideProfileSpan is pure and deterministic and does not mutate inputs', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    runs: [{ boundsCm: { minU: 50.0, maxU: 90.0 } }],
    issues: ['test slice issue'],
  };
  const sliceCopy = JSON.parse(JSON.stringify(sliceResult));
  const level = { id: 'shoulder', status: 'ready', yCm: 150.0 };
  const levelCopy = JSON.parse(JSON.stringify(level));

  const res1 = interpretSideProfileSpan(sliceResult, { definition: 'torso_profile_span_at_shoulder_level', level });
  const res2 = interpretSideProfileSpan(sliceResult, { definition: 'torso_profile_span_at_shoulder_level', level });

  assert.deepEqual(res1, res2);
  assert.deepEqual(sliceResult, sliceCopy);
  assert.deepEqual(level, levelCopy);
});

test('bodyEvidence.js getSideProfileSpan and getSideProfileSpans integrate with active Side runtime state', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getSideProfileSpan,
    getSideProfileSpans,
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
  const rasterSide = new Uint8Array(100);
  for (let c = 3; c <= 6; c += 1) {
    rasterSide[2 * 10 + c] = 22; // Row 2: cols 3, 4, 5, 6
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    side: {
      segmentation: {
        model: 'schp',
        view: 'side',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 96, Torso: 4 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
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

  // Single profile span getter with ready shoulder level
  const shoulderSpan = getSideProfileSpan({
    id: 'torso_profile_span_at_shoulder_level',
    annotations: mockAnnotations,
  });
  assert.ok(shoulderSpan);
  assert.equal(shoulderSpan.contract, 'side-profile-span-v0');
  assert.equal(shoulderSpan.view, 'side');
  assert.equal(shoulderSpan.status, 'valid');
  assert.equal(shoulderSpan.valueCm, 80.0); // cols 3..6 -> minU = 3/10*200 = 60, maxU = 7/10*200 = 140 -> 80 cm
  assert.equal(shoulderSpan.minUcm, 60.0);
  assert.equal(shoulderSpan.maxUcm, 140.0);
  assert.equal(shoulderSpan.provenance.sourceLevel, 'shoulder');
  assert.equal(shoulderSpan.provenance.levelYcm, 150.0);

  // Hip level has no hip landmarks promoted yet -> unavailable
  const hipSpan = getSideProfileSpan({
    id: 'torso_profile_span_at_hip_level',
    annotations: mockAnnotations,
  });
  assert.ok(hipSpan);
  assert.equal(hipSpan.status, 'unavailable');
  assert.equal(hipSpan.valueCm, null);
  assert.equal(hipSpan.minUcm, null);
  assert.equal(hipSpan.maxUcm, null);

  // Report getter
  const report = getSideProfileSpans({ annotations: mockAnnotations });
  assert.ok(report);
  assert.equal(report.contract, 'side-profile-spans-report-v0');
  assert.equal(report.view, 'side');
  assert.equal(report.spans.length, 2);
  assert.equal(report.spans[0].status, 'valid');
  assert.equal(report.spans[1].status, 'unavailable');

  // Reset
  setBodyEvidencePackage(null);
  assert.equal(getSideProfileSpans({ annotations: mockAnnotations }), null);
});

test('Side profile span maintains strict guardrail: no Front dependency or geometric 3D fusion', () => {
  const sliceResult = {
    contract: 'side-horizontal-raster-slice-v0',
    runs: [{ boundsCm: { minU: 60.0, maxU: 100.0 } }],
  };
  const result = interpretSideProfileSpan(sliceResult, {
    definition: 'torso_profile_span_at_shoulder_level',
    level: { id: 'shoulder', status: 'ready', yCm: 150.0 },
  });

  assert.equal(result.view, 'side');
  assert.equal(result.type, 'profile_span');
  assert.equal(result.valueCm, 40.0);
  assert.equal('leftXcm' in result.provenance, false);
  assert.equal('rightXcm' in result.provenance, false);
  assert.equal('z' in result, false);
  assert.equal('depthCm' in result, false);
});

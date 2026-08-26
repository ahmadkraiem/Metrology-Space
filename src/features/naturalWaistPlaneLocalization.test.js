import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NATURAL_WAIST_PLANE_CONTRACT,
  NATURAL_WAIST_PLANE_CONTRACT_VERSION,
  NATURAL_WAIST_PLANE_STATUS,
  NATURAL_WAIST_PLANE_BLOCKER_CODES,
  applySymmetricSmoothing,
  evaluateBilateralContourQa,
  evaluateNaturalWaistPlaneLocalization,
} from './naturalWaistPlaneLocalization.js';

import {
  evaluateTorsoArbitraryYEvidenceScan,
} from './torsoArbitraryYEvidenceScan.js';

function createMockScanCandidate({
  yCm = 115.0,
  rasterRow = 85,
  frontWidthCm = 30.0,
  frontStatus = 'valid',
  frontRunCount = 1,
  isFrontSingleRun = true,
  minXcm = 35.0,
  maxXcm = 65.0,
  sideProfileSpanCm = 20.0,
  sideQualifiedApDepthCm = 20.0,
  sideStatus = 'valid',
  sideRunCount = 1,
  isSideSingleRun = true,
  isSideDepthQualified = true,
  modeledPerimeterScoreCm = 80.0,
} = {}) {
  return {
    yCm,
    rasterRow,
    rowNormalizedV: (rasterRow + 0.5) / 200.0,
    front: {
      status: frontStatus,
      runCount: frontRunCount,
      widthCm: frontWidthCm,
      minXcm,
      maxXcm,
      encounteredClassIds: [22],
      isSingleSupportedRun: isFrontSingleRun,
    },
    side: {
      status: sideStatus,
      runCount: sideRunCount,
      profileSpanCm: sideProfileSpanCm,
      minUcm: 40.0,
      maxUcm: 40.0 + sideProfileSpanCm,
      encounteredClassIds: [22],
      isSingleSupportedRun: isSideSingleRun,
      qualifiedApDepthCm: sideQualifiedApDepthCm,
      depthQualificationStatus: isSideDepthQualified ? 'qualified' : 'disqualified',
      isQualified: isSideDepthQualified,
      qualificationChecks: [],
    },
    modeledPerimeterScoreCm,
    perimeterModel: {
      implementation: 'ellipse_ramanujan_ii',
      semiMajorAxisCm: frontWidthCm / 2,
      semiMinorAxisCm: (sideQualifiedApDepthCm ?? 20.0) / 2,
      hParameter: 0.05,
    },
    isCandidateValid: isFrontSingleRun && isSideSingleRun && isSideDepthQualified,
  };
}

function createMockTorsoScanReport({
  status = 'completed',
  shoulderYcm = 140.0,
  shoulderRasterRow = 60,
  hipYcm = 90.0,
  hipRasterRow = 110,
  candidates = [],
} = {}) {
  return {
    contract: 'torso-arbitrary-y-evidence-scan-v0',
    version: 'torso-arbitrary-y-evidence-scan-v0',
    status,
    scanDirection: 'downward',
    supportPolicyId: 'trunk_core_support_v0',
    targetClassIds: [22, 23],
    upperBound: {
      yCm: shoulderYcm,
      rasterRow: shoulderRasterRow,
      sourceLevel: 'shoulder',
    },
    lowerBound: {
      yCm: hipYcm,
      rasterRow: hipRasterRow,
      sourceLevel: 'hip',
    },
    candidateCount: candidates.length,
    validCandidateCount: candidates.filter((c) => c.isCandidateValid).length,
    candidates,
    prerequisites: {},
    blockers: [],
    warnings: [],
    issues: [],
  };
}

test('Natural Waist: successfully localizes clear stable waist constriction (status: ready)', () => {
  // Generate a smooth parabolic torso shape narrowing around Y = 115 cm (row 85)
  // Shoulder Y=140 (row 60, width 38cm), Waist Y=115 (row 85, width 28cm), Hip Y=90 (row 110, width 36cm)
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    // Parabolic narrowing centered at row 85
    const rowDelta = Math.abs(row - 85);
    const frontWidthCm = Number((28.0 + 0.016 * Math.pow(rowDelta, 2)).toFixed(2));
    const sideDepthCm = Number((18.0 + 0.008 * Math.pow(rowDelta, 2)).toFixed(2));
    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
      sideProfileSpanCm: sideDepthCm,
      sideQualifiedApDepthCm: sideDepthCm,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.contract, NATURAL_WAIST_PLANE_CONTRACT);
  assert.equal(result.version, NATURAL_WAIST_PLANE_CONTRACT_VERSION);
  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.READY);
  assert.equal(result.rasterRow, 85);
  assert.equal(result.selectedCandidate.rasterRow, 85);
  assert.ok(result.yCm >= 114.0 && result.yCm <= 116.0);
  assert.equal(result.selectedCandidate.frontWidthCm, 28.0);
  assert.equal(result.selectedCandidate.bilateralContourQa.status, 'symmetric');
  assert.equal(result.frontEvidence.status, 'valid');
  assert.equal(result.sideEvidence.corroboration, 'corroborated');
  assert.equal(result.semantics.isCircumference, false);
  assert.equal(result.semantics.isNaturalWaistPlaneCandidate, true);
  assert.equal(result.provenance.sliceHighlightCoordinates.frontRasterRow, 85);
});

test('Natural Waist: rejects isolated raster spike / 1-row notch', () => {
  // Broad 36cm torso with a single anomalous 1-row spike at row 80 (width drops to 20cm),
  // but true anatomical waist is a smooth stable constriction at row 95 (width 28cm)
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    let frontWidthCm = 36.0;

    // True gentle valley at row 95 (28cm)
    const rowDelta = Math.abs(row - 95);
    frontWidthCm = Number((28.0 + 0.02 * Math.pow(rowDelta, 2)).toFixed(2));

    // Isolated single-row raster glitch at row 75
    if (row === 75) {
      frontWidthCm = 20.0;
    }

    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.READY);
  // Must NOT select isolated spike at row 75
  assert.notEqual(result.rasterRow, 75);
  assert.equal(result.rasterRow, 95);
});

test('Natural Waist: detects multiple competing valleys as ambiguous', () => {
  // Two equally deep constriction valleys at row 75 (width 28cm) and row 95 (width 28cm), separated by a crest at row 85 (width 36cm)
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    let frontWidthCm = 36.0;
    if (row <= 85) {
      // Valley 1 at row 75
      const d1 = Math.abs(row - 75);
      frontWidthCm = Number((28.0 + 0.08 * Math.pow(d1, 2)).toFixed(2));
    } else {
      // Valley 2 at row 95
      const d2 = Math.abs(row - 95);
      frontWidthCm = Number((28.0 + 0.08 * Math.pow(d2, 2)).toFixed(2));
    }

    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.AMBIGUOUS);
  assert.equal(result.yCm, null);
  assert.equal(result.selectedCandidate, null);
  assert.ok(result.valleys.length >= 2);
  assert.ok(result.blockers.includes(NATURAL_WAIST_PLANE_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_CONSTRICTIONS));
});

test('Natural Waist: monotonic or flat profile returns status unavailable (no constriction)', () => {
  // Monotonically expanding profile from shoulder (28cm) to hip (40cm)
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    const frontWidthCm = Number((28.0 + (row - 60) * 0.24).toFixed(2));
    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE);
  assert.equal(result.yCm, null);
  assert.ok(result.blockers.includes(NATURAL_WAIST_PLANE_BLOCKER_CODES.NO_LOCAL_CONSTRICTION_DETECTED));
});

test('Natural Waist: missing input scan report returns status unavailable', () => {
  const result = evaluateNaturalWaistPlaneLocalization(null);
  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE);
  assert.ok(result.blockers.includes(NATURAL_WAIST_PLANE_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE));
});

test('Natural Waist: invalid scan status propagates as invalid status', () => {
  const scanReport = createMockTorsoScanReport({ status: 'invalid' });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);
  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.INVALID);
});

test('Natural Waist: Front segmentation fragmentation (multi-run rows) are filtered from eligible candidates', () => {
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    const isFragmented = row >= 70 && row <= 73;

    const rowDelta = Math.abs(row - 85);
    const frontWidthCm = Number((28.0 + 0.016 * Math.pow(rowDelta, 2)).toFixed(2));
    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
      frontStatus: isFragmented ? 'ambiguous' : 'valid',
      frontRunCount: isFragmented ? 3 : 1,
      isFrontSingleRun: !isFragmented,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.READY);
  assert.equal(result.rasterRow, 85);
  // Total candidate count is 51, but eligible candidate count is 51 - 4 = 47
  assert.equal(result.candidateCount, 51);
  assert.equal(result.eligibleCandidateCount, 47);
});

test('Natural Waist: partial scan without Side raster evaluates Front narrowing with advisory warning', () => {
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    const rowDelta = Math.abs(row - 85);
    const frontWidthCm = Number((28.0 + 0.016 * Math.pow(rowDelta, 2)).toFixed(2));
    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
      sideStatus: 'unavailable',
      sideRunCount: 0,
      isSideSingleRun: false,
      isSideDepthQualified: false,
      sideQualifiedApDepthCm: null,
      modeledPerimeterScoreCm: null,
    }));
  }

  const scanReport = createMockTorsoScanReport({ status: 'partial', candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.READY);
  assert.equal(result.rasterRow, 85);
  assert.ok(result.warnings.some((w) => w.includes('Side segmentation raster was unavailable')));
});

test('Natural Waist: multi-row flat plateau resolves to deterministic center index', () => {
  // Constant minimum 28.0 cm width across 5 rows: 83, 84, 85, 86, 87
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    let frontWidthCm = 36.0;
    if (row >= 83 && row <= 87) {
      frontWidthCm = 28.0;
    } else if (row < 83) {
      frontWidthCm = Number((28.0 + (83 - row) * 0.4).toFixed(2));
    } else {
      frontWidthCm = Number((28.0 + (row - 87) * 0.4).toFixed(2));
    }

    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.READY);
  // Plateau is rows 83..87 (length 5). Center is index Math.floor(4/2) = 2 -> row 85
  assert.equal(result.rasterRow, 85);
  assert.ok(result.warnings.some((w) => w.includes('plateau')));
});

test('Natural Waist: deterministic repeatability (same input produces identical output)', () => {
  const candidates = [];
  for (let row = 60; row <= 110; row += 1) {
    const yCm = Number((((200 - (row + 0.5)) / 200) * 200).toFixed(4));
    const rowDelta = Math.abs(row - 85);
    const frontWidthCm = Number((28.0 + 0.016 * Math.pow(rowDelta, 2)).toFixed(2));
    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push(createMockScanCandidate({
      yCm,
      rasterRow: row,
      frontWidthCm,
      minXcm,
      maxXcm,
    }));
  }

  const scanReport = createMockTorsoScanReport({ candidates });
  const result1 = evaluateNaturalWaistPlaneLocalization(scanReport);
  const result2 = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.deepEqual(result1, result2);
});

test('Natural Waist: helper applySymmetricSmoothing preserves array length and handles bounds', () => {
  assert.deepEqual(applySymmetricSmoothing([]), []);
  assert.deepEqual(applySymmetricSmoothing([10]), [10]);
  assert.deepEqual(applySymmetricSmoothing([10, 20]), [10, 20]);

  const raw = [30, 30, 20, 30, 30];
  const smoothed = applySymmetricSmoothing(raw, 1);
  assert.equal(smoothed.length, 5);
  // Central spike is dampened
  assert.ok(smoothed[2] > 20);
});

test('Natural Waist: helper evaluateBilateralContourQa correctly classifies symmetry and unilateral indentation', () => {
  const candidate = {
    front: { minXcm: 36.0, maxXcm: 64.0 },
  };
  // Baseline bounds: minX = 30.0, maxX = 70.0 -> left indentation = 6.0, right indentation = 6.0
  const symQa = evaluateBilateralContourQa(candidate, 30.0, 70.0);
  assert.equal(symQa.status, 'symmetric');
  assert.equal(symQa.leftIndentationCm, 6.0);
  assert.equal(symQa.rightIndentationCm, 6.0);
  assert.equal(symQa.asymmetryDeltaCm, 0.0);

  // Unilateral left (left indents, right does not)
  const unilatLeftCandidate = {
    front: { minXcm: 36.0, maxXcm: 70.0 },
  };
  const unilatQa = evaluateBilateralContourQa(unilatLeftCandidate, 30.0, 70.0);
  assert.equal(unilatQa.status, 'unilateral_left');
});

test('Natural Waist: cross-resolution scan report preserves distinct Front and Side raster rows in provenance', () => {
  const candidates = [];
  for (let row = 600; row <= 1100; row += 1) {
    const yCm = Number((((2000 - (row + 0.5)) / 2000) * 200).toFixed(4));
    const sideRow = Math.round(((200.0 - yCm) / 200.0) * 1500 - 0.5);

    const rowDelta = Math.abs(row - 850);
    const frontWidthCm = Number((28.0 + 0.00016 * Math.pow(rowDelta, 2)).toFixed(2));
    const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
    const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));

    candidates.push({
      ...createMockScanCandidate({
        yCm,
        rasterRow: row,
        frontWidthCm,
        minXcm,
        maxXcm,
      }),
      sideRasterRow: sideRow,
      side: {
        rasterRow: sideRow,
        status: 'valid',
        runCount: 1,
        profileSpanCm: 20.0,
        minUcm: 40.0,
        maxUcm: 60.0,
        isQualified: true,
        qualifiedApDepthCm: 20.0,
      },
    });
  }

  const scanReport = createMockTorsoScanReport({
    shoulderYcm: 140.0,
    shoulderRasterRow: 600,
    hipYcm: 90.0,
    hipRasterRow: 1100,
    candidates,
  });

  const result = evaluateNaturalWaistPlaneLocalization(scanReport);

  assert.equal(result.status, NATURAL_WAIST_PLANE_STATUS.READY);
  assert.equal(result.rasterRow, 850);
  assert.equal(result.selectedCandidate.rasterRow, 850);
  // Check that sideRasterRow is preserved from candidate, not identical to front rasterRow
  assert.notEqual(result.selectedCandidate.sideRasterRow, result.selectedCandidate.rasterRow);
  assert.equal(result.selectedCandidate.sideRasterRow, 637);
  assert.equal(result.provenance.sliceHighlightCoordinates.frontRasterRow, 850);
  assert.equal(result.provenance.sliceHighlightCoordinates.sideRasterRow, 637);
});

test('Natural Waist: metric smoothing window produces consistent localization across low and high raster sampling densities', () => {
  // Same physical parabola centered at Y = 115.0 cm, evaluated at 200 rows vs 2000 rows
  const generateProfile = (heightPx) => {
    const cands = [];
    const startRow = Math.round(((200 - 140) / 200) * heightPx);
    const endRow = Math.round(((200 - 90) / 200) * heightPx);
    for (let r = startRow; r <= endRow; r += 1) {
      const yCm = Number((((heightPx - (r + 0.5)) / heightPx) * 200).toFixed(4));
      const distCm = Math.abs(yCm - 115.0);
      const frontWidthCm = Number((28.0 + 0.02 * Math.pow(distCm, 2)).toFixed(2));
      const minXcm = Number((50.0 - frontWidthCm / 2).toFixed(2));
      const maxXcm = Number((50.0 + frontWidthCm / 2).toFixed(2));
      cands.push(createMockScanCandidate({
        yCm,
        rasterRow: r,
        frontWidthCm,
        minXcm,
        maxXcm,
      }));
    }
    return cands;
  };

  const lowResCands = generateProfile(200);
  const highResCands = generateProfile(2000);

  const lowResReport = createMockTorsoScanReport({ shoulderYcm: 140, shoulderRasterRow: 60, hipYcm: 90, hipRasterRow: 110, candidates: lowResCands });
  const highResReport = createMockTorsoScanReport({ shoulderYcm: 140, shoulderRasterRow: 600, hipYcm: 90, hipRasterRow: 1100, candidates: highResCands });

  const lowResResult = evaluateNaturalWaistPlaneLocalization(lowResReport, { smoothingWindowCm: 2.0 });
  const highResResult = evaluateNaturalWaistPlaneLocalization(highResReport, { smoothingWindowCm: 2.0 });

  assert.equal(lowResResult.status, NATURAL_WAIST_PLANE_STATUS.READY);
  assert.equal(highResResult.status, NATURAL_WAIST_PLANE_STATUS.READY);

  // Both localize to within discrete pixel grid spacing of physical Y = 115.0 cm
  assert.ok(Math.abs(lowResResult.yCm - 115.0) <= 0.6);
  assert.ok(Math.abs(highResResult.yCm - 115.0) <= 0.6);

  // Provenance reports metric smoothingWindowCm and derived samples
  assert.equal(lowResResult.provenance.smoothingWindowCm, 2.0);
  assert.equal(highResResult.provenance.smoothingWindowCm, 2.0);
  assert.equal(lowResResult.provenance.smoothingRadiusSamples, 1); // 1.0 cm spacing -> radius 1 sample
  assert.equal(highResResult.provenance.smoothingRadiusSamples, 10); // 0.1 cm spacing -> radius 10 samples
});

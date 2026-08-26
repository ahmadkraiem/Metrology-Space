import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAXIMUM_SEAT_PLANE_CONTRACT,
  MAXIMUM_SEAT_PLANE_CONTRACT_VERSION,
  MAXIMUM_SEAT_PLANE_STATUS,
  MAXIMUM_SEAT_PLANE_BLOCKER_CODES,
  isSeatPlaneCandidateEligible,
  evaluateMaximumSeatPlaneLocalization,
} from './maximumSeatPlaneLocalization.js';

import {
  evaluatePelvicArbitraryYEvidenceScan,
  PELVIC_ARBITRARY_Y_SCAN_STATUS,
} from './pelvicArbitraryYEvidenceScan.js';

import {
  getModeledCrossSectionPerimeter,
} from './bodyEvidence.js';

function createMockValidCalibration() {
  return {
    contract: 'metric-calibration-provenance-v0',
    status: 'validated',
    metricProjectedEligibility: true,
    summary: { scaleCmPerPx: 0.1 },
    scaleCmPerPx: 0.1,
  };
}

function createMockValidPose() {
  return {
    contract: 'side-pose-qualification-v0',
    status: 'qualified',
    isQualified: true,
    issues: [],
    warnings: [],
    summary: { dominantArm: 'left' },
  };
}

function createMockValidOrientation() {
  return {
    contract: 'side-view-orientation-qualification-v0',
    status: 'qualified',
    isQualified: true,
    issues: [],
    warnings: [],
    summary: { aggregateCollapseRatio: 0.12 },
  };
}

function createMockValidClothing() {
  return {
    status: 'validated',
    clothingParticipationValidated: true,
    garmentFitStatus: 'fitted_activewear',
    dimensions: {
      garmentFit: { status: 'qualified' },
    },
  };
}

function createMockScanCandidate({
  yCm = 80.0,
  rasterRow = 100,
  frontWidthCm = 40.0,
  frontStatus = 'valid',
  frontRunCount = 1,
  isFrontSingleRun = true,
  frontClasses = [13],
  sideProfileSpanCm = 25.0,
  sideQualifiedApDepthCm = 25.0,
  sideStatus = 'valid',
  sideRunCount = 1,
  isSideSingleRun = true,
  isSideDepthQualified = true,
  sideClasses = [13],
  modeledPerimeterScoreCm = 105.0,
} = {}) {
  return {
    yCm,
    rasterRow,
    rowNormalizedV: 0.5,
    front: {
      status: frontStatus,
      runCount: frontRunCount,
      widthCm: frontWidthCm,
      minXcm: 30.0,
      maxXcm: 30.0 + frontWidthCm,
      encounteredClassIds: frontClasses,
      isSingleSupportedRun: isFrontSingleRun,
    },
    side: {
      status: sideStatus,
      runCount: sideRunCount,
      profileSpanCm: sideProfileSpanCm,
      minUcm: 40.0,
      maxUcm: 40.0 + sideProfileSpanCm,
      encounteredClassIds: sideClasses,
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
      semiMinorAxisCm: (sideQualifiedApDepthCm ?? 25.0) / 2,
      hParameter: 0.05,
    },
    isCandidateValid: isFrontSingleRun && isSideSingleRun && isSideDepthQualified,
  };
}

function createMockScanReport({
  status = 'completed',
  hipAnchorYcm = 86.0,
  firstSplitRow = 150,
  firstSplitYcm = 75.0,
  candidates = [],
} = {}) {
  return {
    contract: 'pelvic-arbitrary-y-evidence-scan-v0',
    version: 'pelvic-arbitrary-y-evidence-scan-v0',
    status,
    upperBound: { yCm: hipAnchorYcm, rasterRow: 50, sourceLevel: 'hip' },
    lowerBoundaryEvidence: {
      status: 'transition_detected',
      firstSplitRow,
      firstSplitYcm,
      splitReason: 'front_silhouette_split_into_multiple_runs',
      transitionRows: [],
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

test('1. Highest eligible modeled perimeter is localized', () => {
  const candidates = [
    createMockScanCandidate({ yCm: 84.0, rasterRow: 60, modeledPerimeterScoreCm: 108.0 }),
    createMockScanCandidate({ yCm: 82.0, rasterRow: 80, modeledPerimeterScoreCm: 112.5 }),
    createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 110.0 }),
  ];

  const report = createMockScanReport({ candidates, firstSplitRow: 150 });
  const result = evaluateMaximumSeatPlaneLocalization(report);

  assert.equal(result.contract, MAXIMUM_SEAT_PLANE_CONTRACT);
  assert.equal(result.version, MAXIMUM_SEAT_PLANE_CONTRACT_VERSION);
  assert.equal(result.status, MAXIMUM_SEAT_PLANE_STATUS.LOCALIZED);
  assert.equal(result.selectedYcm, 82.0);
  assert.equal(result.selectedRasterRow, 80);
  assert.equal(result.peakScoreCm, 112.5);
});

test('2 & 3. Multi-row maximum plateau is detected and center representative is chosen (odd row count)', () => {
  const candidates = [
    createMockScanCandidate({ yCm: 82.0, rasterRow: 80, modeledPerimeterScoreCm: 110.0 }),
    createMockScanCandidate({ yCm: 81.0, rasterRow: 90, modeledPerimeterScoreCm: 114.2 }),
    createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 114.2 }), // middle row
    createMockScanCandidate({ yCm: 79.0, rasterRow: 110, modeledPerimeterScoreCm: 114.2 }),
    createMockScanCandidate({ yCm: 78.0, rasterRow: 120, modeledPerimeterScoreCm: 111.0 }),
  ];

  const report = createMockScanReport({ candidates, firstSplitRow: 150 });
  const result = evaluateMaximumSeatPlaneLocalization(report);

  assert.equal(result.status, MAXIMUM_SEAT_PLANE_STATUS.LOCALIZED);
  assert.equal(result.plateau.rowCount, 3);
  assert.equal(result.plateau.startRow, 90);
  assert.equal(result.plateau.endRow, 110);
  assert.equal(result.plateau.startYcm, 81.0);
  assert.equal(result.plateau.endYcm, 79.0);

  // Center row (index 1 of 3) is selected (Row 100, Y=80.0 cm), NOT the first row (Row 90)
  assert.equal(result.selectedRasterRow, 100);
  assert.equal(result.selectedYcm, 80.0);
  assert.equal(result.peakScoreCm, 114.2);
});

test('4. Deterministic tie-breaking for even plateau row counts', () => {
  // Even length 2: Math.floor((2-1)/2) = 0
  const candidatesEven2 = [
    createMockScanCandidate({ yCm: 81.0, rasterRow: 90, modeledPerimeterScoreCm: 115.0 }),
    createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 115.0 }),
  ];

  const report2 = createMockScanReport({ candidates: candidatesEven2, firstSplitRow: 150 });
  const result2 = evaluateMaximumSeatPlaneLocalization(report2);
  assert.equal(result2.plateau.rowCount, 2);
  assert.equal(result2.selectedRasterRow, 90); // index 0

  // Even length 4: Math.floor((4-1)/2) = 1
  const candidatesEven4 = [
    createMockScanCandidate({ yCm: 82.0, rasterRow: 80, modeledPerimeterScoreCm: 115.0 }),
    createMockScanCandidate({ yCm: 81.0, rasterRow: 90, modeledPerimeterScoreCm: 115.0 }), // index 1
    createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 115.0 }),
    createMockScanCandidate({ yCm: 79.0, rasterRow: 110, modeledPerimeterScoreCm: 115.0 }),
  ];

  const report4 = createMockScanReport({ candidates: candidatesEven4, firstSplitRow: 150 });
  const result4 = evaluateMaximumSeatPlaneLocalization(report4);
  assert.equal(result4.plateau.rowCount, 4);
  assert.equal(result4.selectedRasterRow, 90); // index 1
});

test('5. Candidate after Front split is NOT eligible', () => {
  const candidates = [
    createMockScanCandidate({ yCm: 82.0, rasterRow: 80, modeledPerimeterScoreCm: 110.0 }),
    // Row 150 is the first split row -> row 160 is strictly after split
    createMockScanCandidate({ yCm: 74.0, rasterRow: 160, modeledPerimeterScoreCm: 120.0 }),
  ];

  const report = createMockScanReport({ candidates, firstSplitRow: 150 });
  const result = evaluateMaximumSeatPlaneLocalization(report);

  // Row 160 cannot be selected even if it has a higher score
  assert.equal(result.selectedRasterRow, 80);
  assert.equal(result.selectedYcm, 82.0);
  assert.equal(result.peakScoreCm, 110.0);
});

test('6 & 7. Candidates without qualified Side AP depth or modeled perimeter score are not eligible', () => {
  const unqualSide = createMockScanCandidate({
    yCm: 82.0,
    rasterRow: 80,
    isSideDepthQualified: false,
    sideQualifiedApDepthCm: null,
    modeledPerimeterScoreCm: null,
  });
  assert.equal(isSeatPlaneCandidateEligible(unqualSide), false);

  const noPerimeter = createMockScanCandidate({
    yCm: 80.0,
    rasterRow: 100,
    modeledPerimeterScoreCm: null,
  });
  assert.equal(isSeatPlaneCandidateEligible(noPerimeter), false);
});

test('8. Candidate with multi-run Front evidence is not eligible', () => {
  const multiRunFront = createMockScanCandidate({
    yCm: 80.0,
    rasterRow: 100,
    frontStatus: 'ambiguous',
    frontRunCount: 2,
    isFrontSingleRun: false,
  });
  assert.equal(isSeatPlaneCandidateEligible(multiRunFront), false);
});

test('9. Upper_Leg classes alone do NOT invalidate an otherwise eligible row', () => {
  const upperLegCandidate = createMockScanCandidate({
    yCm: 79.0,
    rasterRow: 110,
    frontClasses: [12, 13, 21], // Left_Upper_Leg, Lower_Clothing, Right_Upper_Leg
    sideClasses: [12, 21],
    modeledPerimeterScoreCm: 114.0,
  });

  assert.equal(isSeatPlaneCandidateEligible(upperLegCandidate), true);

  const report = createMockScanReport({ candidates: [upperLegCandidate], firstSplitRow: 150 });
  const result = evaluateMaximumSeatPlaneLocalization(report);
  assert.equal(result.status, MAXIMUM_SEAT_PLANE_STATUS.LOCALIZED);
  assert.equal(result.selectedCandidate.encounteredFrontClassIds.includes(12), true);
  assert.equal(result.selectedCandidate.encounteredFrontClassIds.includes(21), true);
});

test('10 & 11. Same metric Y is preserved across Front and Side provenance; row IDs may differ in theory', () => {
  const cand = createMockScanCandidate({
    yCm: 80.05,
    rasterRow: 1199,
    frontWidthCm: 44.3,
    sideQualifiedApDepthCm: 27.4,
    modeledPerimeterScoreCm: 114.1959,
  });

  const report = createMockScanReport({ candidates: [cand], firstSplitRow: 1227 });
  const result = evaluateMaximumSeatPlaneLocalization(report);

  assert.equal(result.selectedYcm, 80.05);
  assert.equal(result.selectedCandidate.yCm, 80.05);
  assert.equal(result.provenance.sliceHighlightCoordinates.yCm, 80.05);
  assert.equal(result.provenance.sliceHighlightCoordinates.frontRasterRow, 1199);
  assert.equal(result.provenance.sliceHighlightCoordinates.sideRasterRow, 1199);
});

test('12, 13, 14, 15. No fixed anthropometric offsets, stature percentages, or smoothing heuristics', () => {
  // Candidate at 85.9 cm (only 0.1 cm below hip 86.0) is localized purely because it has the peak score
  const candidates = [
    createMockScanCandidate({ yCm: 85.9, rasterRow: 51, modeledPerimeterScoreCm: 116.0 }),
    createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 110.0 }),
  ];

  const report = createMockScanReport({ candidates, hipAnchorYcm: 86.0, firstSplitRow: 150, firstSplitYcm: 75.0 });
  const result = evaluateMaximumSeatPlaneLocalization(report);

  assert.equal(result.selectedYcm, 85.9);
  assert.equal(result.provenance.offsetBelowHipCm, 0.1);
});

test('16 & 17. Existing pelvic scan and Hip Landmark perimeter remain unchanged', () => {
  const perimeter = getModeledCrossSectionPerimeter();
  assert.ok(perimeter);
  assert.equal(perimeter.contract, 'modeled-cross-section-perimeter-v0');
  assert.equal(perimeter.sourceLevel, 'hip');
});

test('18 & 19. Semantics: Candidate seat plane is NOT Hip Circumference, NOT 3D reconstruction', () => {
  const cand = createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 114.0 });
  const report = createMockScanReport({ candidates: [cand], firstSplitRow: 150 });
  const result = evaluateMaximumSeatPlaneLocalization(report);

  assert.equal(result.semantics.isMaximumSeatPlaneCandidate, true);
  assert.equal(result.semantics.isModeledLocalization, true);
  assert.equal(result.semantics.isMeasuredCircumference, false);
  assert.equal(result.semantics.isAnthropometricHipCircumference, false);
  assert.equal(result.semantics.is3dReconstruction, false);
  assert.equal(result.hipCircumferenceCm, undefined);
});

test('20. Input scan report object is not mutated', () => {
  const cand = createMockScanCandidate({ yCm: 80.0, rasterRow: 100, modeledPerimeterScoreCm: 114.0 });
  const report = createMockScanReport({ candidates: [cand], firstSplitRow: 150 });

  const beforeJson = JSON.stringify(report);
  evaluateMaximumSeatPlaneLocalization(report);
  const afterJson = JSON.stringify(report);

  assert.equal(beforeJson, afterJson);
});

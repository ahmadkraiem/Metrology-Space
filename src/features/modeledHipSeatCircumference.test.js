import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT,
  MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT_VERSION,
  MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID,
  MODELED_HIP_SEAT_CIRCUMFERENCE_DISPLAY_NAME,
  MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS,
  MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS,
  evaluateModeledHipSeatCircumference,
} from './modeledHipSeatCircumference.js';

import {
  getModeledCrossSectionPerimeter,
  getModeledHipSeatCircumference,
} from './bodyEvidence.js';

function createMockValidLocalization({
  yCm = 79.95,
  rasterRow = 1200,
  frontWidthCm = 44.3,
  sideQualifiedApDepthCm = 27.4,
  modeledPerimeterScoreCm = 114.1959,
  peakScoreCm = 114.1959,
  status = 'localized',
  hipAnchorYcm = 86.25,
  firstSplitYcm = 77.25,
  plateauStartYcm = 80.05,
  plateauEndYcm = 79.85,
  plateauRowCount = 3,
} = {}) {
  return {
    contract: 'maximum-seat-plane-localization-v0',
    version: 'maximum-seat-plane-localization-v0',
    status,
    selectedYcm: yCm,
    selectedRasterRow: rasterRow,
    selectionMethod: 'plateau_center_v0',
    peakScoreCm,
    plateau: {
      startYcm: plateauStartYcm,
      endYcm: plateauEndYcm,
      startRow: 1199,
      endRow: 1201,
      rowCount: plateauRowCount,
      candidates: [],
    },
    selectedCandidate: {
      yCm,
      rasterRow,
      sideRasterRow: rasterRow,
      frontWidthCm,
      frontMinXcm: 58.0,
      frontMaxXcm: 102.3,
      sideRawProfileSpanCm: sideQualifiedApDepthCm,
      sideQualifiedApDepthCm,
      sideMinUcm: 70.0,
      sideMaxUcm: 97.4,
      encounteredFrontClassIds: [12, 13, 21],
      encounteredSideClassIds: [12, 21],
      modeledPerimeterScoreCm,
      perimeterModel: {
        implementation: 'ellipse_ramanujan_ii',
        semiMajorAxisCm: 22.15,
        semiMinorAxisCm: 13.7,
        hParameter: 0.055557,
      },
    },
    provenance: {
      hipAnchorYcm,
      offsetBelowHipCm: Number((hipAnchorYcm - yCm).toFixed(4)),
      firstSplitYcm,
      clearanceAboveFirstSplitCm: Number((yCm - firstSplitYcm).toFixed(4)),
      totalCandidateCount: 101,
      eligibleCandidateCount: 90,
      sourceScanContract: 'pelvic-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: 'completed',
      sliceHighlightCoordinates: {
        yCm,
        frontRasterRow: rasterRow,
        sideRasterRow: rasterRow,
        frontBoundsCm: { minX: 58.0, maxX: 102.3 },
        sideBoundsCm: { minU: 70.0, maxU: 97.4 },
      },
    },
    semantics: {
      statement: 'Deterministic Maximum Seat Plane localization candidate',
      isMaximumSeatPlaneCandidate: true,
      isModeledLocalization: true,
      isMeasuredCircumference: false,
      isAnthropometricHipCircumference: false,
      is3dReconstruction: false,
    },
    blockers: [],
    warnings: [],
    issues: [],
  };
}

test('1 & 2. Successful localized seat plane produces modeled circumference equaling peak score', () => {
  const localization = createMockValidLocalization({
    modeledPerimeterScoreCm: 114.1959,
    frontWidthCm: 44.3,
    sideQualifiedApDepthCm: 27.4,
  });

  const result = evaluateModeledHipSeatCircumference(localization);

  assert.equal(result.contract, MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT);
  assert.equal(result.version, MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT_VERSION);
  assert.equal(result.id, MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID);
  assert.equal(result.name, MODELED_HIP_SEAT_CIRCUMFERENCE_DISPLAY_NAME);
  assert.equal(result.status, MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.MODELED);
  assert.equal(result.isModeled, true);
  assert.equal(result.isQualified, true);
  assert.equal(result.valueCm, 114.1959);
  assert.equal(result.levelYcm, 79.95);
});

test('3, 4, 5, 6. Provenance preserves selected Y, Front width, Side AP depth, and plateau', () => {
  const localization = createMockValidLocalization();
  const result = evaluateModeledHipSeatCircumference(localization);

  assert.equal(result.provenance.selectedYcm, 79.95);
  assert.equal(result.provenance.frontTransverseWidthCm, 44.3);
  assert.equal(result.provenance.sideQualifiedApDepthCm, 27.4);
  assert.equal(result.provenance.plateauStartYcm, 80.05);
  assert.equal(result.provenance.plateauEndYcm, 79.85);
  assert.equal(result.provenance.plateauRowCount, 3);
  assert.equal(result.provenance.hipAnchorYcm, 86.25);
  assert.equal(result.provenance.offsetBelowHipCm, 6.3);
  assert.equal(result.provenance.firstSplitYcm, 77.25);
  assert.equal(result.provenance.clearanceAboveFirstSplitCm, 2.7);
  assert.deepEqual(result.provenance.encounteredFrontClassIds, [12, 13, 21]);
  assert.deepEqual(result.provenance.encounteredSideClassIds, [12, 21]);
  assert.ok(result.provenance.sliceHighlightCoordinates);
});

test('7 & 8. Missing or invalid localization returns unavailable/blocked without numeric value', () => {
  const nullResult = evaluateModeledHipSeatCircumference(null);
  assert.equal(nullResult.status, MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.UNAVAILABLE);
  assert.equal(nullResult.valueCm, null);
  assert.equal(nullResult.isModeled, false);
  assert.equal(nullResult.blockers.includes(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.MAXIMUM_SEAT_PLANE_UNAVAILABLE), true);

  const blockedLoc = { status: 'blocked', selectedCandidate: null };
  const blockedResult = evaluateModeledHipSeatCircumference(blockedLoc);
  assert.equal(blockedResult.status, MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.UNAVAILABLE);
  assert.equal(blockedResult.valueCm, null);
});

test('9 & 10. Missing Front width or qualified Side AP depth blocks output', () => {
  const badFront = createMockValidLocalization();
  badFront.selectedCandidate.frontWidthCm = null;
  const badFrontResult = evaluateModeledHipSeatCircumference(badFront);
  assert.equal(badFrontResult.status, MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.BLOCKED);
  assert.equal(badFrontResult.valueCm, null);
  assert.equal(badFrontResult.blockers.includes(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID), true);

  const badSide = createMockValidLocalization();
  badSide.selectedCandidate.sideQualifiedApDepthCm = -1;
  const badSideResult = evaluateModeledHipSeatCircumference(badSide);
  assert.equal(badSideResult.status, MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.BLOCKED);
  assert.equal(badSideResult.valueCm, null);
  assert.equal(badSideResult.blockers.includes(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID), true);
});

test('11. Evaluator does NOT perform independent seat plane localization', () => {
  const loc = createMockValidLocalization({ yCm: 81.5, modeledPerimeterScoreCm: 112.0 });
  const result = evaluateModeledHipSeatCircumference(loc);
  // Evaluator directly trusts the provided localization level without searching
  assert.equal(result.levelYcm, 81.5);
  assert.equal(result.valueCm, 112.0);
});

test('12 & 13. Existing Hip Landmark perimeter and new Seat Circumference remain separate definitions', () => {
  const hipLandmarkPerimeter = getModeledCrossSectionPerimeter();
  assert.ok(hipLandmarkPerimeter);
  assert.equal(hipLandmarkPerimeter.id, 'torso_modeled_perimeter_at_hip_landmark_level');
  assert.equal(hipLandmarkPerimeter.name, 'Torso Modeled Perimeter Estimate at Hip Landmark Level');
  assert.equal(hipLandmarkPerimeter.sourceLevel, 'hip');

  assert.notEqual(hipLandmarkPerimeter.id, MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID);
  assert.notEqual(hipLandmarkPerimeter.name, MODELED_HIP_SEAT_CIRCUMFERENCE_DISPLAY_NAME);
});

test('14, 15, 16, 17. Guardrail: No U->Z, no 3D reconstruction, no tape-measured ground truth claim', () => {
  const loc = createMockValidLocalization();
  const result = evaluateModeledHipSeatCircumference(loc);

  assert.equal(result.semantics.isModeled, true);
  assert.equal(result.semantics.isEstimatedCircumference, true);
  assert.equal(result.semantics.isMeasuredContour, false);
  assert.equal(result.semantics.isTapeMeasuredGroundTruth, false);
  assert.equal(result.semantics.is3dReconstruction, false);
  assert.equal(result.semantics.isBodyVolume, false);
  assert.equal(result.semantics.isValidatedAgainstGroundTruth, false);
});

test('18. Input localization evidence is not mutated', () => {
  const loc = createMockValidLocalization();
  const beforeJson = JSON.stringify(loc);
  evaluateModeledHipSeatCircumference(loc);
  const afterJson = JSON.stringify(loc);
  assert.equal(beforeJson, afterJson);
});

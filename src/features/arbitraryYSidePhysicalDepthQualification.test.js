import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT,
  ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
  ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS,
  evaluateArbitraryYSidePhysicalDepthQualification,
} from './arbitraryYSidePhysicalDepthQualification.js';

import {
  evaluateSidePhysicalDepthQualification,
  SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0,
} from './sidePhysicalDepthQualification.js';

import {
  evaluatePelvicArbitraryYEvidenceScan,
  PELVIC_ARBITRARY_Y_SCAN_STATUS,
} from './pelvicArbitraryYEvidenceScan.js';

import {
  computeRamanujanEllipsePerimeter,
} from './modeledCrossSectionPerimeter.js';

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

function createSyntheticRaster({ widthPx = 100, heightPx = 100, shapes = [] }) {
  const raster = new Uint8Array(widthPx * heightPx);
  for (const { minX, maxX, minY, maxY, classId } of shapes) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (x >= 0 && x < widthPx && y >= 0 && y < heightPx) {
          raster[y * widthPx + x] = classId;
        }
      }
    }
  }
  return raster;
}

test('1 & 2. Valid arbitrary-Y Side candidate qualifies AP depth equal to profileSpanCm', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 28.5,
    minUcm: 70.0,
    maxUcm: 98.5,
    encounteredClassIds: [13],
    isSingleSupportedRun: true,
    yCm: 84.5,
    rasterRow: 580,
  };

  const result = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });

  assert.equal(result.contract, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT);
  assert.equal(result.version, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION);
  assert.equal(result.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
  assert.equal(result.isQualified, true);
  assert.equal(result.profileSpanCm, 28.5);
  assert.equal(result.qualifiedApDepthCm, 28.5);
  assert.equal(result.yCm, 84.5);
  assert.equal(result.rasterRow, 580);
});

test('3. Arbitrary-Y candidate does not require a fake named definition ID', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 25.0,
    minUcm: 60.0,
    maxUcm: 85.0,
    encounteredClassIds: [12, 13],
    isSingleSupportedRun: true,
    yCm: 81.25,
    rasterRow: 600,
  };

  // Calling evaluateArbitraryYSidePhysicalDepthQualification with no named ID
  const result = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });

  assert.equal(result.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
  assert.equal(result.isQualified, true);
  assert.equal(result.qualifiedApDepthCm, 25.0);
  assert.equal(result.provenance.isArbitraryY, true);
});

test('4 & 5. Existing named Hip and Shoulder Side-depth behavior remains unchanged', () => {
  assert.ok(SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0.torso_profile_span_at_hip_level);
  assert.ok(SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0.torso_profile_span_at_shoulder_level);

  // Calling evaluateSidePhysicalDepthQualification on unknown string ID still fails as expected
  const unsupportedResult = evaluateSidePhysicalDepthQualification('arbitrary_y_random_id');
  assert.equal(unsupportedResult.status, 'disqualified');
  assert.equal(unsupportedResult.qualifiedDepthEstimateCm, null);
  assert.equal(unsupportedResult.qualificationTier, 'unqualified');
});

test('6. Invalid or multi-run Side candidate cannot qualify', () => {
  const multiRunObs = {
    status: 'ambiguous',
    runCount: 2,
    profileSpanCm: 30.0,
    minUcm: 50.0,
    maxUcm: 80.0,
    encounteredClassIds: [12, 21],
    isSingleSupportedRun: false,
    yCm: 75.0,
    rasterRow: 650,
  };

  const result = evaluateArbitraryYSidePhysicalDepthQualification(multiRunObs, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });

  assert.equal(result.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
  assert.equal(result.isQualified, false);
  assert.equal(result.qualifiedApDepthCm, null);
});

test('7. Missing or invalid calibration blocks qualification', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 27.0,
    minUcm: 70.0,
    maxUcm: 97.0,
    encounteredClassIds: [13],
    isSingleSupportedRun: true,
    yCm: 85.0,
    rasterRow: 570,
  };

  const noCalib = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: null,
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });
  assert.equal(noCalib.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
  assert.equal(noCalib.isQualified, false);
  assert.equal(noCalib.qualifiedApDepthCm, null);

  const invalidCalib = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: { status: 'invalid', metricProjectedEligibility: false },
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });
  assert.equal(invalidCalib.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
  assert.equal(invalidCalib.isQualified, false);
  assert.equal(invalidCalib.qualifiedApDepthCm, null);
});

test('8. Failed approximately-lateral orientation blocks qualification', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 27.0,
    minUcm: 70.0,
    maxUcm: 97.0,
    encounteredClassIds: [13],
    isSingleSupportedRun: true,
    yCm: 85.0,
    rasterRow: 570,
  };

  const disqualifiedOrient = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: { status: 'disqualified', issues: ['Severe rotation'] },
    clothingSemantics: createMockValidClothing(),
  });
  assert.equal(disqualifiedOrient.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
  assert.equal(disqualifiedOrient.isQualified, false);
  assert.equal(disqualifiedOrient.qualifiedApDepthCm, null);
});

test('9. Failed pose qualification blocks qualification; advisory elbow warnings pass', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 27.0,
    minUcm: 70.0,
    maxUcm: 97.0,
    encounteredClassIds: [13],
    isSingleSupportedRun: true,
    yCm: 85.0,
    rasterRow: 570,
  };

  // Disqualified pose
  const disqualifiedPose = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: { status: 'disqualified', issues: ['Arms at sides'] },
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });
  assert.equal(disqualifiedPose.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
  assert.equal(disqualifiedPose.isQualified, false);
  assert.equal(disqualifiedPose.qualifiedApDepthCm, null);

  // Advisory warning pose (elbow deviation <= 45°)
  const advisoryPose = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: {
      status: 'warning',
      issues: [],
      warnings: ['Moderate projected elbow deviation (35°)'],
      summary: { dominantArm: 'left' },
    },
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });
  assert.equal(advisoryPose.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
  assert.equal(advisoryPose.isQualified, true);
  assert.equal(advisoryPose.qualifiedApDepthCm, 27.0);
});

test('10 & 11. Disqualified clothing blocks qualification; zero clothing offset applied', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 27.0,
    minUcm: 70.0,
    maxUcm: 97.0,
    encounteredClassIds: [13],
    isSingleSupportedRun: true,
    yCm: 85.0,
    rasterRow: 570,
  };

  const disqualifiedClothing = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: { dimensions: { garmentFit: { status: 'disqualified' } } },
  });
  assert.equal(disqualifiedClothing.status, ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
  assert.equal(disqualifiedClothing.isQualified, false);
  assert.equal(disqualifiedClothing.qualifiedApDepthCm, null);

  // Valid fitted activewear clothing produces exact span without offsets
  const validClothing = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });
  assert.equal(validClothing.qualifiedApDepthCm, 27.0);
});

test('12. Semantics guardrail: U is NOT canonical Z and no 3D reconstruction', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 26.0,
    minUcm: 60.0,
    maxUcm: 86.0,
    encounteredClassIds: [13],
    isSingleSupportedRun: true,
    yCm: 83.0,
    rasterRow: 590,
  };

  const result = evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });

  assert.equal(result.semantics.isCanonicalZ, false);
  assert.equal(result.semantics.is3dReconstruction, false);
  assert.equal(result.semantics.isFrontSideFusion, false);
  assert.equal(result.semantics.isCircumference, false);
  assert.equal(result.semantics.isArbitraryY, true);
});

test('13. Source evidence object is not mutated by qualification', () => {
  const sideObservation = {
    status: 'valid',
    runCount: 1,
    profileSpanCm: 26.0,
    minUcm: 60.0,
    maxUcm: 86.0,
    encounteredClassIds: Object.freeze([13]),
    isSingleSupportedRun: true,
    yCm: 83.0,
    rasterRow: 590,
  };

  const copyBefore = JSON.stringify(sideObservation);
  evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
    metricCalibrationProvenance: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemantics: createMockValidClothing(),
  });
  const copyAfter = JSON.stringify(sideObservation);

  assert.equal(copyBefore, copyAfter);
});

test('14 & 16. Pelvic scan candidates receive qualifiedApDepthCm and modeledPerimeterScoreCm when eligible', () => {
  const hipY = 100.0;
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: hipY, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: hipY, z: 200 } },
  ];

  // Width = 40.0 cm (cols 30..70), Side span = 20.0 cm (cols 40..60)
  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 60, classId: 13 },
      { minX: 30, maxX: 45, minY: 61, maxY: 70, classId: 12 },
      { minX: 55, maxX: 70, minY: 61, maxY: 70, classId: 21 },
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 40, maxX: 60, minY: 50, maxY: 70, classId: 13 },
    ],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
    metricCalibrationFront: createMockValidCalibration(),
    metricCalibrationSide: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: createMockValidOrientation(),
    clothingSemanticsSide: createMockValidClothing(),
    options: { workspaceExtentCm: 200 },
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.COMPLETED);
  const firstCandidate = result.candidates[0];
  assert.equal(firstCandidate.front.isSingleSupportedRun, true);
  assert.equal(firstCandidate.front.widthCm, 82.0); // (70 - 30 + 1) / 100 * 200 = 82 cm
  assert.equal(firstCandidate.side.isSingleSupportedRun, true);
  assert.equal(firstCandidate.side.profileSpanCm, 42.0); // (60 - 40 + 1) / 100 * 200 = 42 cm
  assert.equal(firstCandidate.side.qualifiedApDepthCm, 42.0);
  assert.equal(firstCandidate.side.depthQualificationStatus, 'qualified');
  assert.equal(firstCandidate.side.isQualified, true);

  // Ramanujan II ellipse perimeter for 82 cm width and 42 cm depth
  const expectedPerimeter = computeRamanujanEllipsePerimeter(82.0, 42.0).perimeterCm;
  assert.ok(firstCandidate.modeledPerimeterScoreCm > 0);
  assert.equal(firstCandidate.modeledPerimeterScoreCm, Number(expectedPerimeter.toFixed(4)));
});

test('15. Pelvic scan candidate keeps raw profile span when qualification fails', () => {
  const hipY = 100.0;
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: hipY, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: hipY, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 30, maxX: 70, minY: 50, maxY: 60, classId: 13 }],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 40, maxX: 60, minY: 50, maxY: 60, classId: 13 }],
  });

  // Disqualified orientation
  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
    metricCalibrationFront: createMockValidCalibration(),
    metricCalibrationSide: createMockValidCalibration(),
    sidePoseQualification: createMockValidPose(),
    sideViewOrientationQualification: { status: 'disqualified', issues: ['Yaw mismatch'] },
    clothingSemanticsSide: createMockValidClothing(),
    options: { workspaceExtentCm: 200 },
  });

  const candidate = result.candidates[0];
  assert.equal(candidate.side.profileSpanCm, 42.0); // raw span preserved
  assert.equal(candidate.side.qualifiedApDepthCm, null); // qualified depth null
  assert.equal(candidate.side.depthQualificationStatus, 'disqualified');
  assert.equal(candidate.modeledPerimeterScoreCm, null); // perimeter score null
});

test('17. computeRamanujanEllipsePerimeter is reused directly', () => {
  const res = computeRamanujanEllipsePerimeter(40, 20);
  assert.ok(res.perimeterCm > 0);
  assert.equal(res.semiMajorAxisCm, 20);
  assert.equal(res.semiMinorAxisCm, 10);
});

test('18. Pelvic scan does NOT select candidate maximum or seat plane', () => {
  const hipY = 100.0;
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: hipY, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: hipY, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 30, maxX: 70, minY: 50, maxY: 60, classId: 13 }],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 40, maxX: 60, minY: 50, maxY: 60, classId: 13 }],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
    options: { workspaceExtentCm: 200 },
  });

  assert.equal(result.maximumSeatPlane, undefined);
  assert.equal(result.selectedPlane, undefined);
  assert.equal(result.hipCircumferenceCm, undefined);
});

test('19. Existing Hip Landmark Perimeter result contract remains unchanged', () => {
  const perimeter = getModeledCrossSectionPerimeter();
  assert.ok(perimeter);
  assert.equal(perimeter.contract, 'modeled-cross-section-perimeter-v0');
  assert.equal(perimeter.sourceLevel, 'hip');
});

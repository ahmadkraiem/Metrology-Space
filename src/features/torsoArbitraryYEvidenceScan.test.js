import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TORSO_ARBITRARY_Y_SCAN_CONTRACT,
  TORSO_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
  TORSO_ARBITRARY_Y_SCAN_STATUS,
  TORSO_SCAN_BLOCKER_CODES,
  evaluateTorsoArbitraryYEvidenceScan,
} from './torsoArbitraryYEvidenceScan.js';

import {
  getTorsoArbitraryYEvidenceScan,
  getTorsoArbitraryYEvidenceScanReport,
} from './bodyEvidence.js';

function createMockAnnotations({ shoulderY = 140.0, hipY = 90.0 } = {}) {
  return [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 40, y: shoulderY } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 60, y: shoulderY } },
    { type: 'body_landmark', name: 'left_hip', point: { x: 42, y: hipY } },
    { type: 'body_landmark', name: 'right_hip', point: { x: 58, y: hipY } },
  ];
}

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

/**
 * Creates a synthetic raster buffer with a configurable torso pattern.
 */
function createSyntheticTorsoRaster({
  widthPx = 100,
  heightPx = 200,
  torsoClassId = 22,
  getSpanForRow = (r) => ({ startCol: 35, endCol: 65 }),
} = {}) {
  const buffer = new Uint8Array(widthPx * heightPx);

  for (let r = 0; r < heightPx; r += 1) {
    const span = getSpanForRow(r);
    if (span) {
      for (let c = span.startCol; c <= span.endCol; c += 1) {
        if (c >= 0 && c < widthPx) {
          buffer[r * widthPx + c] = torsoClassId;
        }
      }
    }
  }

  return buffer;
}

test('Torso Scan: successfully scans trunk region between Shoulder and Hip levels', () => {
  const widthPx = 100;
  const heightPx = 200;
  const annotations = createMockAnnotations({ shoulderY: 140.0, hipY: 90.0 });

  // Shoulder Y=140 in 200cm space -> row 60. Hip Y=90 in 200cm space -> row 110.
  const frontRaster = createSyntheticTorsoRaster({ widthPx, heightPx, torsoClassId: 22 });
  const sideRaster = createSyntheticTorsoRaster({ widthPx, heightPx, torsoClassId: 22 });

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx, heightPx },
    sideSegmentation: { widthPx, heightPx },
    annotations,
    metricCalibrationFront: createMockValidCalibration(),
    metricCalibrationSide: createMockValidCalibration(),
    sideViewOrientationQualification: createMockValidOrientation(),
    sidePoseQualification: createMockValidPose(),
    clothingSemanticsSide: createMockValidClothing(),
  });

  assert.equal(result.contract, TORSO_ARBITRARY_Y_SCAN_CONTRACT);
  assert.equal(result.version, TORSO_ARBITRARY_Y_SCAN_CONTRACT_VERSION);
  assert.equal(result.status, TORSO_ARBITRARY_Y_SCAN_STATUS.COMPLETED);
  assert.equal(result.upperBound.yCm, 140.0);
  assert.equal(result.lowerBound.yCm, 90.0);
  assert.equal(result.upperBound.sourceLevel, 'shoulder');
  assert.equal(result.lowerBound.sourceLevel, 'hip');
  assert.equal(result.supportPolicyId, 'trunk_core_support_v0');
  assert.deepEqual(result.targetClassIds, [22, 23]);

  // Expected rows: row 60 to row 110 inclusive -> 51 rows
  assert.equal(result.candidateCount, 51);
  assert.equal(result.validCandidateCount, 51);

  const firstCandidate = result.candidates[0];
  assert.equal(firstCandidate.rasterRow, 60);
  assert.equal(firstCandidate.front.status, 'valid');
  assert.equal(firstCandidate.front.isSingleSupportedRun, true);
  assert.equal(firstCandidate.side.status, 'valid');
  assert.equal(firstCandidate.side.isQualified, true);
  assert.ok(typeof firstCandidate.modeledPerimeterScoreCm === 'number');
  assert.ok(firstCandidate.modeledPerimeterScoreCm > 0);
});

test('Torso Scan: missing Shoulder anchor returns status unavailable', () => {
  const widthPx = 100;
  const heightPx = 200;
  const frontRaster = createSyntheticTorsoRaster({ widthPx, heightPx });
  // Only hip landmark provided
  const annotations = [
    { type: 'body_landmark', name: 'left_hip', point: { x: 42, y: 90 } },
    { type: 'body_landmark', name: 'right_hip', point: { x: 58, y: 90 } },
  ];

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    frontSegmentation: { widthPx, heightPx },
    annotations,
  });

  assert.equal(result.status, TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE);
  assert.ok(result.blockers.includes(TORSO_SCAN_BLOCKER_CODES.SHOULDER_ANCHOR_LEVEL_UNAVAILABLE));
  assert.equal(result.candidateCount, 0);
});

test('Torso Scan: missing Hip anchor returns status unavailable', () => {
  const widthPx = 100;
  const heightPx = 200;
  const frontRaster = createSyntheticTorsoRaster({ widthPx, heightPx });
  // Only shoulder landmark provided
  const annotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 40, y: 140 } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 60, y: 140 } },
  ];

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    frontSegmentation: { widthPx, heightPx },
    annotations,
  });

  assert.equal(result.status, TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE);
  assert.ok(result.blockers.includes(TORSO_SCAN_BLOCKER_CODES.HIP_ANCHOR_LEVEL_UNAVAILABLE));
});

test('Torso Scan: inverted anatomical levels (Shoulder <= Hip) returns status invalid', () => {
  const widthPx = 100;
  const heightPx = 200;
  const frontRaster = createSyntheticTorsoRaster({ widthPx, heightPx });
  const annotations = createMockAnnotations({ shoulderY: 80.0, hipY: 120.0 });

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    frontSegmentation: { widthPx, heightPx },
    annotations,
  });

  assert.equal(result.status, TORSO_ARBITRARY_Y_SCAN_STATUS.INVALID);
  assert.ok(result.blockers.includes(TORSO_SCAN_BLOCKER_CODES.INVALID_ANATOMICAL_LEVEL_ORDERING));
});

test('Torso Scan: missing Side raster produces partial scan with valid Front evidence', () => {
  const widthPx = 100;
  const heightPx = 200;
  const annotations = createMockAnnotations({ shoulderY: 140.0, hipY: 90.0 });
  const frontRaster = createSyntheticTorsoRaster({ widthPx, heightPx });

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    sideRaster: null,
    frontSegmentation: { widthPx, heightPx },
    sideSegmentation: null,
    annotations,
    metricCalibrationFront: createMockValidCalibration(),
  });

  assert.equal(result.status, TORSO_ARBITRARY_Y_SCAN_STATUS.PARTIAL);
  assert.ok(result.candidateCount > 0);
  assert.equal(result.candidates[0].front.status, 'valid');
  assert.equal(result.candidates[0].side.status, 'unavailable');
  assert.equal(result.candidates[0].side.isQualified, false);
});

test('Torso Scan: Front and Side candidate observations share identical canonical Y', () => {
  const widthPx = 100;
  const heightPx = 200;
  const annotations = createMockAnnotations({ shoulderY: 140.0, hipY: 90.0 });
  const frontRaster = createSyntheticTorsoRaster({ widthPx, heightPx });
  const sideRaster = createSyntheticTorsoRaster({ widthPx, heightPx });

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx, heightPx },
    sideSegmentation: { widthPx, heightPx },
    annotations,
    metricCalibrationFront: createMockValidCalibration(),
    metricCalibrationSide: createMockValidCalibration(),
    sideViewOrientationQualification: createMockValidOrientation(),
    sidePoseQualification: createMockValidPose(),
    clothingSemanticsSide: createMockValidClothing(),
  });

  for (const candidate of result.candidates) {
    const expectedContinuousY = ((heightPx - (candidate.rasterRow + 0.5)) / heightPx) * 200.0;
    assert.equal(candidate.yCm, Number(expectedContinuousY.toFixed(4)));
  }
});

test('Torso Scan: Front and Side rasters with unequal resolutions map to same canonical Y with distinct pixel rows', () => {
  const frontWidthPx = 1000;
  const frontHeightPx = 2000;
  const sideWidthPx = 750;
  const sideHeightPx = 1500;
  const workspaceExtentCm = 200.0;

  const annotations = createMockAnnotations({ shoulderY: 140.0, hipY: 90.0 });
  const frontRaster = createSyntheticTorsoRaster({ widthPx: frontWidthPx, heightPx: frontHeightPx, torsoClassId: 22 });
  const sideRaster = createSyntheticTorsoRaster({ widthPx: sideWidthPx, heightPx: sideHeightPx, torsoClassId: 22 });

  const result = evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: frontWidthPx, heightPx: frontHeightPx },
    sideSegmentation: { widthPx: sideWidthPx, heightPx: sideHeightPx },
    annotations,
    metricCalibrationFront: createMockValidCalibration(),
    metricCalibrationSide: createMockValidCalibration(),
    sideViewOrientationQualification: createMockValidOrientation(),
    sidePoseQualification: createMockValidPose(),
    clothingSemanticsSide: createMockValidClothing(),
    options: { workspaceExtentCm },
  });

  assert.equal(result.status, TORSO_ARBITRARY_Y_SCAN_STATUS.COMPLETED);
  assert.ok(result.candidateCount > 0);

  // Check candidate rows across unequal resolutions
  const firstCandidate = result.candidates[0];
  assert.ok(typeof firstCandidate.rasterRow === 'number');
  assert.ok(typeof firstCandidate.sideRasterRow === 'number');
  // Since frontHeightPx (2000) != sideHeightPx (1500), front row != side row
  assert.notEqual(firstCandidate.rasterRow, firstCandidate.sideRasterRow);
  assert.equal(firstCandidate.rasterRow, 600); // 140cm in 2000px height -> row 600
  assert.equal(firstCandidate.sideRasterRow, 450); // 140cm in 1500px height -> row 450
  assert.equal(firstCandidate.side.rasterRow, 450);

  // Verify that both rows correspond to the same physical elevation within mapping tolerance
  const frontMappedY = ((frontHeightPx - (firstCandidate.rasterRow + 0.5)) / frontHeightPx) * workspaceExtentCm;
  const sideMappedY = ((sideHeightPx - (firstCandidate.sideRasterRow + 0.5)) / sideHeightPx) * workspaceExtentCm;
  assert.ok(Math.abs(frontMappedY - sideMappedY) < 0.2); // within sub-pixel mapping resolution
});

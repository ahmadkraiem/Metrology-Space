import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PELVIC_ARBITRARY_Y_SCAN_CONTRACT,
  PELVIC_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
  PELVIC_ARBITRARY_Y_SCAN_STATUS,
  PELVIC_SCAN_BLOCKER_CODES,
  evaluatePelvicArbitraryYEvidenceScan,
} from './pelvicArbitraryYEvidenceScan.js';

import {
  getMeasurementSupportPolicy,
  MEASUREMENT_SUPPORT_POLICIES_V0,
} from './measurementSupportPolicy.js';

import {
  setBodyEvidencePackage,
  getPelvicArbitraryYEvidenceScan,
  getPelvicArbitraryYEvidenceScanReport,
  getModeledCrossSectionPerimeter,
} from './bodyEvidence.js';

import { canonicalYToPixelRow } from '../core/pixelMetrologyMapping.js';

/**
 * Creates a synthetic raster buffer with specific regions.
 * Default 100x100 px (100 px over 200 cm = 2 cm/px).
 */
function createSyntheticRaster({
  widthPx = 100,
  heightPx = 100,
  fillClass = 0,
  shapes = [],
} = {}) {
  const buffer = new Uint8Array(widthPx * heightPx);
  buffer.fill(fillClass);

  for (const shape of shapes) {
    const { minX, maxX, minY, maxY, classId } = shape;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (x >= 0 && x < widthPx && y >= 0 && y < heightPx) {
          buffer[y * widthPx + x] = classId;
        }
      }
    }
  }

  return buffer;
}

test('Milestone 4.6C-1: Contract metadata, status taxonomy, and blocker codes exist', () => {
  assert.equal(PELVIC_ARBITRARY_Y_SCAN_CONTRACT, 'pelvic-arbitrary-y-evidence-scan-v0');
  assert.equal(PELVIC_ARBITRARY_Y_SCAN_CONTRACT_VERSION, 'pelvic-arbitrary-y-evidence-scan-v0');

  assert.deepEqual(Object.keys(PELVIC_ARBITRARY_Y_SCAN_STATUS).sort(), [
    'COMPLETED',
    'INVALID',
    'PARTIAL',
    'UNAVAILABLE',
  ]);
  assert.equal(PELVIC_ARBITRARY_Y_SCAN_STATUS.COMPLETED, 'completed');
  assert.equal(PELVIC_ARBITRARY_Y_SCAN_STATUS.PARTIAL, 'partial');
  assert.equal(PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE, 'unavailable');
  assert.equal(PELVIC_ARBITRARY_Y_SCAN_STATUS.INVALID, 'invalid');

  assert.equal(PELVIC_SCAN_BLOCKER_CODES.HIP_ANCHOR_LEVEL_UNAVAILABLE, 'hip_anchor_level_unavailable');
  assert.equal(PELVIC_SCAN_BLOCKER_CODES.FRONT_SEGMENTATION_UNAVAILABLE, 'front_segmentation_unavailable');
  assert.equal(PELVIC_SCAN_BLOCKER_CODES.SIDE_SEGMENTATION_UNAVAILABLE, 'side_segmentation_unavailable');
  assert.equal(PELVIC_SCAN_BLOCKER_CODES.METRIC_CALIBRATION_UNAVAILABLE, 'metric_calibration_unavailable');
  assert.equal(PELVIC_SCAN_BLOCKER_CODES.OUT_OF_BOUNDS_SCAN_INTERVAL, 'out_of_bounds_scan_interval');
});

test('1. Upper Bound: Scan starts exactly at ready Hip Landmark Y without fixed offsets', () => {
  // Hip landmark at 86.0 cm in 200 cm domain with 100 rows
  const hipY = 86.0;
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: hipY, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: hipY, z: 200 } },
  ];

  const expectedStartRow = canonicalYToPixelRow(hipY, 100, 200).row;
  assert.equal(expectedStartRow, 56);

  // Front raster: single pelvic band at rows 56..65, then split legs at rows 66..70
  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      // Pelvic block: single run cols 30..70
      { minX: 30, maxX: 70, minY: 56, maxY: 65, classId: 13 }, // Lower_Clothing
      // Split legs: two runs cols 30..45 and 55..70
      { minX: 30, maxX: 45, minY: 66, maxY: 75, classId: 12 }, // Left_Upper_Leg
      { minX: 55, maxX: 70, minY: 66, maxY: 75, classId: 21 }, // Right_Upper_Leg
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      // Side profile block: single run cols 40..60
      { minX: 40, maxX: 60, minY: 56, maxY: 75, classId: 13 },
    ],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
    options: { workspaceExtentCm: 200 },
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.COMPLETED);
  assert.equal(result.upperBound.yCm, hipY);
  assert.equal(result.upperBound.rasterRow, expectedStartRow);
  assert.equal(result.upperBound.sourceLevel, 'hip');

  // Verify the very first candidate row is exactly at startRow (row 56)
  assert.equal(result.candidates[0].rasterRow, expectedStartRow);
  // continuousY at center of row 56: ((100 - 56.5) / 100) * 200 = 87.0 cm
  assert.equal(result.candidates[0].yCm, 87.0);
});

test('2 & 3. Candidate rows are generated from native raster row mapping downwards', () => {
  const hipY = 100.0;
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  // At 100 cm in 100 rows: startRow is 50
  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 55, classId: 22 }, // Torso
      { minX: 30, maxX: 45, minY: 56, maxY: 65, classId: 12 }, // Split legs
      { minX: 55, maxX: 70, minY: 56, maxY: 65, classId: 21 },
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 40, maxX: 60, minY: 50, maxY: 65, classId: 22 },
    ],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
  });

  assert.equal(result.scanDirection, 'downward');
  assert.ok(result.candidates.length >= 6);

  // Check that row indices strictly increase (50, 51, 52, ...)
  for (let i = 0; i < result.candidates.length; i += 1) {
    assert.equal(result.candidates[i].rasterRow, 50 + i);
    // Y strictly decreases as row index increases downwards
    if (i > 0) {
      assert.ok(result.candidates[i].yCm < result.candidates[i - 1].yCm);
    }
  }
});

test('4. Pelvic support policy: Reuses pelvic_core_support_v0 directly', () => {
  const policy = getMeasurementSupportPolicy('pelvic_core_support_v0');
  assert.ok(policy);
  assert.deepEqual(Array.from(policy.acceptedClassIds), [12, 13, 21, 22]);

  const hipY = 100.0;
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  // Include an unaccepted class like upper arm (class 11) or background (class 0) adjacent to pelvic block
  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 52, classId: 13 }, // Accepted Lower_Clothing
      { minX: 10, maxX: 20, minY: 50, maxY: 52, classId: 11 }, // Ignored Left_Upper_Arm
      { minX: 30, maxX: 45, minY: 53, maxY: 60, classId: 12 },
      { minX: 55, maxX: 70, minY: 53, maxY: 60, classId: 21 },
    ],
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
  });

  assert.equal(result.supportPolicyId, 'pelvic_core_support_v0');
  assert.deepEqual(result.targetClassIds, [12, 13, 21, 22]);

  // Candidate row 50 should only match the accepted pelvic region (cols 30..70), ignoring class 11
  const row50 = result.candidates.find((c) => c.rasterRow === 50);
  assert.ok(row50);
  assert.equal(row50.front.runCount, 1);
  assert.deepEqual(row50.front.encounteredClassIds, [13]);
  // cols 30..70 in 100 px over 200 cm: minX = (30/100)*200 = 60 cm, maxX = (71/100)*200 = 142 cm, width = 82 cm
  assert.equal(row50.front.minXcm, 60.0);
  assert.equal(row50.front.maxXcm, 142.0);
  assert.equal(row50.front.widthCm, 82.0);
});

test('5 & 6. Front single-run vs multi-run: Multi-run rows are preserved and not merged', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      // Single run at row 50: cols 30..70
      { minX: 30, maxX: 70, minY: 50, maxY: 50, classId: 22 },
      // Split 2 runs at row 51: cols 30..40 and 60..70
      { minX: 30, maxX: 40, minY: 51, maxY: 55, classId: 12 },
      { minX: 60, maxX: 70, minY: 51, maxY: 55, classId: 21 },
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 40, maxX: 60, minY: 50, maxY: 55, classId: 22 }],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
  });

  const row50 = result.candidates.find((c) => c.rasterRow === 50);
  assert.equal(row50.front.status, 'valid');
  assert.equal(row50.front.isSingleSupportedRun, true);
  assert.equal(row50.front.runCount, 1);
  assert.equal(row50.front.widthCm, 82.0);

  const row51 = result.candidates.find((c) => c.rasterRow === 51);
  assert.equal(row51.front.status, 'ambiguous');
  assert.equal(row51.front.isSingleSupportedRun, false);
  assert.equal(row51.front.runCount, 2);
  assert.equal(row51.front.widthCm, null);
  assert.deepEqual(row51.front.encounteredClassIds, [12, 21]);
});

test('7 & 8. Side profile evidence sampled at matching Y without U->Z promotion', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 52, classId: 13 },
      { minX: 30, maxX: 45, minY: 53, maxY: 58, classId: 12 },
      { minX: 55, maxX: 70, minY: 53, maxY: 58, classId: 21 },
    ],
  });

  // Side raster with profile spanning cols 35..65
  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 35, maxX: 65, minY: 50, maxY: 58, classId: 13 }],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
  });

  const row50 = result.candidates.find((c) => c.rasterRow === 50);
  assert.ok(row50);
  assert.equal(row50.side.status, 'valid');
  assert.equal(row50.side.isSingleSupportedRun, true);
  // minU = 35/100 * 200 = 70.0 cm, maxU = 66/100 * 200 = 132.0 cm, span = 62.0 cm
  assert.equal(row50.side.minUcm, 70.0);
  assert.equal(row50.side.maxUcm, 132.0);
  assert.equal(row50.side.profileSpanCm, 62.0);

  // Side fields must strictly remain U / profile span, not Z
  assert.equal(row50.side.zCm, undefined);
  assert.equal(row50.side.canonicalZ, undefined);
  assert.equal(row50.side.qualifiedApDepthCm, null);
  assert.equal(row50.side.depthQualificationStatus, 'disqualified');
});

test('9 & 15. AP depth qualification and modeled perimeter score remain null when prerequisites not provided', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 52, classId: 13 },
      { minX: 30, maxX: 45, minY: 53, maxY: 58, classId: 12 },
      { minX: 55, maxX: 70, minY: 53, maxY: 58, classId: 21 },
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 35, maxX: 65, minY: 50, maxY: 58, classId: 13 }],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
  });

  for (const c of result.candidates) {
    assert.equal(c.side.qualifiedApDepthCm, null);
    assert.ok(c.side.depthQualificationStatus === 'disqualified' || c.side.depthQualificationStatus === 'unavailable');
    assert.equal(c.modeledPerimeterScoreCm, null);
  }
});

test('10. Missing Hip anchor safely returns status unavailable with blocker', () => {
  const frontRaster = createSyntheticRaster({ widthPx: 100, heightPx: 100 });
  const sideRaster = createSyntheticRaster({ widthPx: 100, heightPx: 100 });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations: [], // No hip landmarks
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE);
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.candidates, []);
  assert.ok(result.blockers.includes(PELVIC_SCAN_BLOCKER_CODES.HIP_ANCHOR_LEVEL_UNAVAILABLE));
});

test('11. Missing segmentation safely returns status unavailable with blocker', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster: null,
    frontSegmentation: null,
    annotations,
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE);
  assert.ok(result.blockers.includes(PELVIC_SCAN_BLOCKER_CODES.FRONT_SEGMENTATION_UNAVAILABLE));
});

test('12. Source segmentation buffers and evidence are not mutated', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 30, maxX: 70, minY: 50, maxY: 55, classId: 13 }],
  });
  const copyFront = new Uint8Array(frontRaster);

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 40, maxX: 60, minY: 50, maxY: 55, classId: 13 }],
  });
  const copySide = new Uint8Array(sideRaster);

  evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
  });

  assert.deepEqual(frontRaster, copyFront);
  assert.deepEqual(sideRaster, copySide);
});

test('13 & 14. Lower Boundary: Crotch/leg split transition evidence is preserved without premature anatomical label', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  // Start at row 50 (100 cm). Single runs at 50, 51, 52. Split at 53.
  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 52, classId: 13 },
      { minX: 30, maxX: 45, minY: 53, maxY: 65, classId: 12 },
      { minX: 55, maxX: 70, minY: 53, maxY: 65, classId: 21 },
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 40, maxX: 60, minY: 50, maxY: 65, classId: 13 }],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
    options: { transitionObservationBufferRows: 4 },
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.COMPLETED);
  assert.ok(result.lowerBoundaryEvidence);
  assert.equal(result.lowerBoundaryEvidence.status, 'transition_detected');
  assert.equal(result.lowerBoundaryEvidence.firstSplitRow, 53);
  assert.equal(result.lowerBoundaryEvidence.splitReason, 'front_silhouette_split_into_multiple_runs');
  assert.ok(typeof result.lowerBoundaryEvidence.firstSplitYcm === 'number');

  // Verify transitionRows contains the neighboring transition rows
  assert.ok(result.lowerBoundaryEvidence.transitionRows.length >= 1);
  assert.equal(result.lowerBoundaryEvidence.transitionRows[0].rasterRow, 53);

  // Strictly assert absence of premature anatomical names
  assert.equal(result.lowerBoundaryEvidence.crotchY, undefined);
  assert.equal(result.lowerBoundaryEvidence.crotchLevel, undefined);
  assert.equal(result.lowerBoundaryEvidence.anatomicalCrotch, undefined);
  assert.equal(result.lowerBoundaryEvidence.qualifiedCrotchPlane, undefined);
});

test('16. Pointmap and normals are not required dependencies', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 52, classId: 13 },
      { minX: 30, maxX: 45, minY: 53, maxY: 56, classId: 12 },
      { minX: 55, maxX: 70, minY: 53, maxY: 56, classId: 21 },
    ],
  });

  const sideRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [{ minX: 40, maxX: 60, minY: 50, maxY: 56, classId: 13 }],
  });

  // Execute without any pointmap or normals passed
  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: { widthPx: 100, heightPx: 100 },
    annotations,
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.COMPLETED);
  assert.ok(result.candidates.length > 0);
});

test('17. Existing Hip Landmark Perimeter behavior remains unchanged', () => {
  // Verify that existing Hip Landmark Perimeter API remains functional and unchanged
  const perimeter = getModeledCrossSectionPerimeter();
  assert.ok(perimeter);
  assert.equal(perimeter.contract, 'modeled-cross-section-perimeter-v0');
  assert.equal(perimeter.status, 'unavailable');
});

test('18. Partial Status: Front valid but Side raster unavailable yields status partial', () => {
  const annotations = [
    { name: 'left_hip', type: 'body_landmark', position: { x: 40, y: 100.0, z: 200 } },
    { name: 'right_hip', type: 'body_landmark', position: { x: 60, y: 100.0, z: 200 } },
  ];

  const frontRaster = createSyntheticRaster({
    widthPx: 100,
    heightPx: 100,
    shapes: [
      { minX: 30, maxX: 70, minY: 50, maxY: 52, classId: 13 },
      { minX: 30, maxX: 45, minY: 53, maxY: 56, classId: 12 },
      { minX: 55, maxX: 70, minY: 53, maxY: 56, classId: 21 },
    ],
  });

  const result = evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster: null, // Missing side raster
    frontSegmentation: { widthPx: 100, heightPx: 100 },
    sideSegmentation: null,
    annotations,
  });

  assert.equal(result.status, PELVIC_ARBITRARY_Y_SCAN_STATUS.PARTIAL);
  assert.ok(result.candidates.length > 0);
  assert.ok(result.warnings.some((w) => w.includes('Side segmentation raster is unavailable')));
  for (const c of result.candidates) {
    assert.equal(c.side.status, 'unavailable');
    assert.equal(c.side.profileSpanCm, null);
    assert.equal(c.isCandidateValid, false); // cannot be valid without side
  }
});

test('19. Runtime Store: getPelvicArbitraryYEvidenceScan integrates with bodyEvidence store', () => {
  setBodyEvidencePackage(null);

  const initialScan = getPelvicArbitraryYEvidenceScan();
  assert.equal(initialScan, null);

  const reportScan = getPelvicArbitraryYEvidenceScanReport();
  assert.equal(reportScan, null);
});

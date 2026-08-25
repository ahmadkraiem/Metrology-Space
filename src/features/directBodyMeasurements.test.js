import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECT_BODY_MEASUREMENTS_CONTRACT,
  DIRECT_BODY_MEASUREMENTS_CONTRACT_VERSION,
  DIRECT_MEASUREMENT_STATUS,
  DIRECT_MEASUREMENT_SEMANTICS,
  DIRECT_MEASUREMENT_GROUPS,
  SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0,
  DIRECT_MEASUREMENT_IDS_V0,
  evaluateDirectBodyMeasurements,
  evaluateDirectBodyMeasurement,
} from './directBodyMeasurements.js';

const VALID_FRONT_CALIBRATION = Object.freeze({
  status: 'validated',
  metricProjectedEligibility: true,
  scaleCmPerPx: 0.1,
});

const UNVALIDATED_FRONT_CALIBRATION = Object.freeze({
  status: 'unvalidated',
  metricProjectedEligibility: false,
  scaleCmPerPx: null,
});

/**
 * Standard complete promoted body landmark annotation fixture (Front view, cm coordinates).
 */
function createStandardPromotedAnnotationsFixture({ yOffset = 0 } = {}) {
  return [
    { type: 'body_landmark', name: 'neck', point: { x: 100, y: 150 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 115, y: 140 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 85, y: 140 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'left_elbow', point: { x: 125, y: 115 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'right_elbow', point: { x: 75, y: 115 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'left_wrist', point: { x: 130, y: 90 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'right_wrist', point: { x: 70, y: 90 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'left_hip', point: { x: 110, y: 90 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'right_hip', point: { x: 90, y: 90 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'left_knee', point: { x: 110, y: 50 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'right_knee', point: { x: 90, y: 50 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'left_ankle', point: { x: 110, y: 10 + yOffset, z: 200 } },
    { type: 'body_landmark', name: 'right_ankle', point: { x: 90, y: 10 + yOffset, z: 200 } },
  ];
}

test('directBodyMeasurements: supports exactly 19 Batch A definitions in registry', () => {
  assert.equal(DIRECT_MEASUREMENT_IDS_V0.length, 19);
  assert.equal(Object.keys(SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0).length, 19);
});

test('directBodyMeasurements: calculates all 5 vertical inter-level distances correctly', () => {
  const annotations = createStandardPromotedAnnotationsFixture();
  const report = evaluateDirectBodyMeasurements({
    annotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  assert.equal(report.contract, 'direct-body-measurements-report-v0');
  assert.equal(report.summary.total, 19);
  assert.equal(report.summary.valid, 19);
  assert.equal(report.summary.unavailable, 0);
  assert.equal(report.summary.invalid, 0);

  // 1. Neck (150) to Hip (90) = 60 cm
  const torsoLen = report.measurementsById.vertical_torso_length_neck_to_hip;
  assert.equal(torsoLen.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(torsoLen.valueCm, 60.0);
  assert.equal(torsoLen.outputSemantics, DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE);

  // 2. Neck (150) to Shoulder (140) = 10 cm
  const shoulderDrop = report.measurementsById.vertical_shoulder_drop_neck_to_shoulder;
  assert.equal(shoulderDrop.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(shoulderDrop.valueCm, 10.0);

  // 3. Hip (90) to Knee (50) = 40 cm
  const thighVert = report.measurementsById.vertical_thigh_length_hip_to_knee;
  assert.equal(thighVert.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(thighVert.valueCm, 40.0);

  // 4. Knee (50) to Ankle (10) = 40 cm
  const lowerLegVert = report.measurementsById.vertical_lower_leg_length_knee_to_ankle;
  assert.equal(lowerLegVert.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(lowerLegVert.valueCm, 40.0);

  // 5. Hip (90) to Ankle (10) = 80 cm
  const totalLegVert = report.measurementsById.vertical_total_leg_length_hip_to_ankle;
  assert.equal(totalLegVert.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(totalLegVert.valueCm, 80.0);
});

test('directBodyMeasurements: relative vertical deltas are invariant to canvas placement Y offsets', () => {
  const baseAnnotations = createStandardPromotedAnnotationsFixture({ yOffset: 0 });
  const offsetAnnotations = createStandardPromotedAnnotationsFixture({ yOffset: 25.7 });

  const reportBase = evaluateDirectBodyMeasurements({
    annotations: baseAnnotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  const reportOffset = evaluateDirectBodyMeasurements({
    annotations: offsetAnnotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  const verticalIds = [
    'vertical_torso_length_neck_to_hip',
    'vertical_shoulder_drop_neck_to_shoulder',
    'vertical_thigh_length_hip_to_knee',
    'vertical_lower_leg_length_knee_to_ankle',
    'vertical_total_leg_length_hip_to_ankle',
  ];

  for (const id of verticalIds) {
    assert.equal(
      reportBase.measurementsById[id].valueCm,
      reportOffset.measurementsById[id].valueCm,
      `Vertical measurement ${id} must be invariant to global Y placement offset.`,
    );
  }
});

test('directBodyMeasurements: calculates projected arm segment and chord measurements without bilateral averaging', () => {
  // Asymmetric arm coordinates
  const annotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 115, y: 140, z: 200 } },
    { type: 'body_landmark', name: 'left_elbow', point: { x: 125, y: 115, z: 200 } },
    { type: 'body_landmark', name: 'left_wrist', point: { x: 130, y: 90, z: 200 } },
    // Right arm with different reach/geometry
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 85, y: 140, z: 200 } },
    { type: 'body_landmark', name: 'right_elbow', point: { x: 70, y: 115, z: 200 } },
    { type: 'body_landmark', name: 'right_wrist', point: { x: 60, y: 85, z: 200 } },
  ];

  const report = evaluateDirectBodyMeasurements({
    annotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  // Left upper arm: dx = 10, dy = 25 -> sqrt(100 + 625) = sqrt(725) ≈ 26.93 cm
  const leftUpper = report.measurementsById.left_upper_arm_segment_length_projected;
  assert.equal(leftUpper.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftUpper.valueCm, 26.93);

  // Right upper arm: dx = -15, dy = 25 -> sqrt(225 + 625) = sqrt(850) ≈ 29.15 cm
  const rightUpper = report.measurementsById.right_upper_arm_segment_length_projected;
  assert.equal(rightUpper.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(rightUpper.valueCm, 29.15);

  // Left forearm: dx = 5, dy = 25 -> sqrt(25 + 625) = sqrt(650) ≈ 25.50 cm
  const leftForearm = report.measurementsById.left_forearm_segment_length_projected;
  assert.equal(leftForearm.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftForearm.valueCm, 25.50);

  // Right forearm: dx = -10, dy = 30 -> sqrt(100 + 900) = sqrt(1000) ≈ 31.62 cm
  const rightForearm = report.measurementsById.right_forearm_segment_length_projected;
  assert.equal(rightForearm.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(rightForearm.valueCm, 31.62);

  // Left direct chord: shoulder (115, 140) to wrist (130, 90) -> dx = 15, dy = 50 -> sqrt(225 + 2500) = sqrt(2725) ≈ 52.20 cm
  const leftChord = report.measurementsById.left_direct_arm_chord_projected;
  assert.equal(leftChord.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftChord.valueCm, 52.20);

  // Right direct chord: shoulder (85, 140) to wrist (60, 85) -> dx = -25, dy = 55 -> sqrt(625 + 3025) = sqrt(3650) ≈ 60.42 cm
  const rightChord = report.measurementsById.right_direct_arm_chord_projected;
  assert.equal(rightChord.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(rightChord.valueCm, 60.42);

  // Left arm chain = 26.93 + 25.50 = 52.43 cm
  const leftArmChain = report.measurementsById.left_total_arm_chain_length_projected;
  assert.equal(leftArmChain.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftArmChain.valueCm, 52.43);

  // Right arm chain = 29.15 + 31.62 = 60.77 cm
  const rightArmChain = report.measurementsById.right_total_arm_chain_length_projected;
  assert.equal(rightArmChain.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(rightArmChain.valueCm, 60.77);

  // Verify left and right remain distinct
  assert.notEqual(leftUpper.valueCm, rightUpper.valueCm);
  assert.notEqual(leftForearm.valueCm, rightForearm.valueCm);
  assert.notEqual(leftArmChain.valueCm, rightArmChain.valueCm);
});

test('directBodyMeasurements: calculates projected leg segment and kinematic chain measurements', () => {
  const annotations = [
    { type: 'body_landmark', name: 'left_hip', point: { x: 110, y: 90, z: 200 } },
    { type: 'body_landmark', name: 'left_knee', point: { x: 112, y: 50, z: 200 } },
    { type: 'body_landmark', name: 'left_ankle', point: { x: 115, y: 10, z: 200 } },
    { type: 'body_landmark', name: 'right_hip', point: { x: 90, y: 90, z: 200 } },
    { type: 'body_landmark', name: 'right_knee', point: { x: 88, y: 50, z: 200 } },
    { type: 'body_landmark', name: 'right_ankle', point: { x: 85, y: 10, z: 200 } },
  ];

  const report = evaluateDirectBodyMeasurements({
    annotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  // Left thigh: dx = 2, dy = 40 -> sqrt(4 + 1600) = sqrt(1604) ≈ 40.05 cm
  const leftThigh = report.measurementsById.left_thigh_segment_length_projected;
  assert.equal(leftThigh.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftThigh.valueCm, 40.05);

  // Left lower leg: dx = 3, dy = 40 -> sqrt(9 + 1600) = sqrt(1609) ≈ 40.11 cm
  const leftLowerLeg = report.measurementsById.left_lower_leg_segment_length_projected;
  assert.equal(leftLowerLeg.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftLowerLeg.valueCm, 40.11);

  // Left total leg chain: 40.05 + 40.11 = 80.16 cm
  const leftLegChain = report.measurementsById.left_total_leg_chain_length_projected;
  assert.equal(leftLegChain.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(leftLegChain.valueCm, 80.16);
  assert.equal(leftLegChain.outputSemantics, DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_CHAIN_LENGTH);
});

test('directBodyMeasurements: missing landmark resolves to unavailable without throwing', () => {
  // Missing left_wrist
  const annotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 115, y: 140, z: 200 } },
    { type: 'body_landmark', name: 'left_elbow', point: { x: 125, y: 115, z: 200 } },
  ];

  const report = evaluateDirectBodyMeasurements({
    annotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  const upper = report.measurementsById.left_upper_arm_segment_length_projected;
  assert.equal(upper.status, DIRECT_MEASUREMENT_STATUS.VALID);

  const forearm = report.measurementsById.left_forearm_segment_length_projected;
  assert.equal(forearm.status, DIRECT_MEASUREMENT_STATUS.UNAVAILABLE);
  assert.equal(forearm.valueCm, null);
  assert.match(forearm.reason, /missing: left_wrist/);

  // Kinematic chain must also become unavailable if one constituent segment is missing
  const chain = report.measurementsById.left_total_arm_chain_length_projected;
  assert.equal(chain.status, DIRECT_MEASUREMENT_STATUS.UNAVAILABLE);
  assert.equal(chain.valueCm, null);
  assert.match(chain.reason, /unavailable/);
});

test('directBodyMeasurements: missing anatomical level resolves to unavailable', () => {
  // Only neck is present, hip is missing
  const annotations = [
    { type: 'body_landmark', name: 'neck', point: { x: 100, y: 150, z: 200 } },
  ];

  const report = evaluateDirectBodyMeasurements({
    annotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  const torsoLen = report.measurementsById.vertical_torso_length_neck_to_hip;
  assert.equal(torsoLen.status, DIRECT_MEASUREMENT_STATUS.UNAVAILABLE);
  assert.equal(torsoLen.valueCm, null);
  assert.match(torsoLen.reason, /hip/);
});

test('directBodyMeasurements: unvalidated calibration makes all measurements unavailable', () => {
  const annotations = createStandardPromotedAnnotationsFixture();
  const report = evaluateDirectBodyMeasurements({
    annotations,
    metricCalibrationFront: UNVALIDATED_FRONT_CALIBRATION,
  });

  assert.equal(report.summary.valid, 0);
  assert.equal(report.summary.unavailable, 19);

  for (const m of report.measurements) {
    assert.equal(m.status, DIRECT_MEASUREMENT_STATUS.UNAVAILABLE);
    assert.equal(m.valueCm, null);
    assert.ok(
      /calibration/i.test(m.reason) || /unavailable/i.test(m.reason),
      `Expected reason to mention calibration or constituent unavailability: ${m.reason}`,
    );
  }
});

test('directBodyMeasurements: corrupted or non-finite coordinates resolve to invalid', () => {
  const corruptedAnnotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 115, y: NaN, z: 200 } },
    { type: 'body_landmark', name: 'left_elbow', point: { x: 125, y: 115, z: 200 } },
  ];

  const report = evaluateDirectBodyMeasurements({
    annotations: corruptedAnnotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  const upper = report.measurementsById.left_upper_arm_segment_length_projected;
  assert.equal(upper.status, DIRECT_MEASUREMENT_STATUS.INVALID);
  assert.equal(upper.valueCm, null);
  assert.match(upper.reason, /corrupted/i);
});

test('directBodyMeasurements: evaluateDirectBodyMeasurement retrieves single definition by ID', () => {
  const annotations = createStandardPromotedAnnotationsFixture();
  const single = evaluateDirectBodyMeasurement('vertical_torso_length_neck_to_hip', {
    annotations,
    metricCalibrationFront: VALID_FRONT_CALIBRATION,
  });

  assert.ok(single);
  assert.equal(single.id, 'vertical_torso_length_neck_to_hip');
  assert.equal(single.status, DIRECT_MEASUREMENT_STATUS.VALID);
  assert.equal(single.valueCm, 60.0);

  // Unknown ID returns null
  assert.equal(evaluateDirectBodyMeasurement('unknown_measurement_id'), null);
});

test('directBodyMeasurements: canonical naming and display naming are strictly formatted', () => {
  for (const [id, def] of Object.entries(SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0)) {
    assert.ok(def.canonicalName && def.canonicalName.length > 0);
    assert.ok(def.displayName && def.displayName.length > 0);
    assert.ok(def.anatomicalRegion && def.anatomicalRegion.length > 0);
    assert.ok(def.outputSemantics && def.outputSemantics.length > 0);

    // Canonical names for projected measurements must explicitly include "Projected"
    if (def.outputSemantics.includes('projected')) {
      assert.ok(def.canonicalName.includes('Projected'), `Canonical name "${def.canonicalName}" must contain "Projected"`);
    }
    // Vertical measurements must be relative vertical distance
    if (def.geometryType === 'vertical_inter_level_delta') {
      assert.equal(def.outputSemantics, DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE);
    }
  }
});

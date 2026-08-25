import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_T_POSE_CONTRACT,
  SIDE_T_POSE_CONTRACT_VERSION,
  SIDE_T_POSE_STATUS,
  SIDE_T_POSE_THRESHOLDS,
  extractSideLandmarksMap,
  evaluateSidePoseQualification,
} from './sidePoseQualification.js';

describe('sidePoseQualification v0', () => {
  // Helper to construct a synthetic clean Side T-pose landmark map
  function createSyntheticSideTPose({
    leftShoulderU = 100,
    leftShoulderY = 140,
    leftElbowU = 70,
    leftElbowY = 140,
    leftWristU = 40,
    leftWristY = 140,
    rightShoulderU = 100,
    rightShoulderY = 140,
    rightElbowU = 130,
    rightElbowY = 140,
    rightWristU = 160,
    rightWristY = 140,
    hipY = 95,
    confidence = 0.95,
  } = {}) {
    return [
      { name: 'neck', sideUcm: 100, sideYcm: 155, score: confidence },
      { name: 'left_shoulder', sideUcm: leftShoulderU, sideYcm: leftShoulderY, score: confidence },
      { name: 'left_elbow', sideUcm: leftElbowU, sideYcm: leftElbowY, score: confidence },
      { name: 'left_wrist', sideUcm: leftWristU, sideYcm: leftWristY, score: confidence },
      { name: 'right_shoulder', sideUcm: rightShoulderU, sideYcm: rightShoulderY, score: confidence },
      { name: 'right_elbow', sideUcm: rightElbowU, sideYcm: rightElbowY, score: confidence },
      { name: 'right_wrist', sideUcm: rightWristU, sideYcm: rightWristY, score: confidence },
      { name: 'left_hip', sideUcm: 100, sideYcm: hipY, score: confidence },
      { name: 'right_hip', sideUcm: 100, sideYcm: hipY, score: confidence },
      { name: 'left_ankle', sideUcm: 100, sideYcm: 15, score: confidence },
      { name: 'right_ankle', sideUcm: 100, sideYcm: 15, score: confidence },
    ];
  }

  it('1. Clean Side T-pose evaluates to status: qualified with all checks passing', () => {
    const landmarks = createSyntheticSideTPose();
    const result = evaluateSidePoseQualification(landmarks);

    assert.equal(result.contract, SIDE_T_POSE_CONTRACT);
    assert.equal(result.version, SIDE_T_POSE_CONTRACT_VERSION);
    assert.equal(result.view, 'side');
    assert.equal(result.status, SIDE_T_POSE_STATUS.QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.issues.length, 0);
    assert.ok(result.summary.evaluatedArms.length >= 1);
    assert.ok(result.checks.length > 0);
  });

  it('2. Bent elbow produces warning or disqualification according to bend severity', () => {
    // Moderate bend (~37 degrees): elbow at (70, 140), wrist bent down to (50, 125)
    const moderateBentLandmarks = createSyntheticSideTPose({
      leftShoulderU: 100, leftShoulderY: 140,
      leftElbowU: 70, leftElbowY: 140,
      leftWristU: 50, leftWristY: 125,
      rightShoulderU: 100, rightShoulderY: 140,
      rightElbowU: 130, rightElbowY: 140,
      rightWristU: 150, rightWristY: 125,
    });
    const modResult = evaluateSidePoseQualification(moderateBentLandmarks);
    assert.equal(modResult.status, SIDE_T_POSE_STATUS.WARNING);
    assert.equal(modResult.qualified, false);
    assert.ok(modResult.warnings.some((w) => w.toLowerCase().includes('bent')));

    // Severe bend (~90 degrees): elbow at (70, 140), wrist at (70, 110)
    const severeBentLandmarks = createSyntheticSideTPose({
      leftShoulderU: 100, leftShoulderY: 140,
      leftElbowU: 70, leftElbowY: 140,
      leftWristU: 70, leftWristY: 110,
      rightShoulderU: 100, rightShoulderY: 140,
      rightElbowU: 130, rightElbowY: 140,
      rightWristU: 130, rightWristY: 110,
    });
    const severeResult = evaluateSidePoseQualification(severeBentLandmarks);
    assert.equal(severeResult.status, SIDE_T_POSE_STATUS.DISQUALIFIED);
    assert.equal(severeResult.qualified, false);
    assert.ok(severeResult.issues.some((iss) => iss.toLowerCase().includes('bent') || iss.toLowerCase().includes('extended')));
  });

  it('3. Arms significantly lowered evaluates to status: disqualified', () => {
    // Lowered arm: shoulder (100, 140), elbow (90, 110), wrist (85, 80) -> mostly vertical
    const loweredLandmarks = createSyntheticSideTPose({
      leftShoulderU: 100, leftShoulderY: 140,
      leftElbowU: 90, leftElbowY: 110,
      leftWristU: 85, leftWristY: 80,
      rightShoulderU: 100, rightShoulderY: 140,
      rightElbowU: 110, rightElbowY: 110,
      rightWristU: 115, rightWristY: 80,
    });
    const result = evaluateSidePoseQualification(loweredLandmarks);
    assert.equal(result.status, SIDE_T_POSE_STATUS.DISQUALIFIED);
    assert.equal(result.qualified, false);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('lowered') || iss.toLowerCase().includes('extended')));
  });

  it('4. Missing required arm landmarks evaluates to status: unavailable', () => {
    const missingArm = [
      { name: 'neck', sideUcm: 100, sideYcm: 155, score: 0.9 },
      { name: 'left_shoulder', sideUcm: 100, sideYcm: 140, score: 0.9 },
      { name: 'left_hip', sideUcm: 100, sideYcm: 95, score: 0.9 },
      { name: 'right_hip', sideUcm: 100, sideYcm: 95, score: 0.9 },
    ];
    const result = evaluateSidePoseQualification(missingArm);
    assert.equal(result.status, SIDE_T_POSE_STATUS.UNAVAILABLE);
    assert.equal(result.qualified, false);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('missing complete arm')));
  });

  it('5. Bilateral shoulder elevation tilt triggers warning check', () => {
    // Left shoulder at 145, right shoulder at 135 on torso height 45 -> tilt ratio = 10 / 45 = 0.22 > 0.15
    const tiltedShoulders = createSyntheticSideTPose({
      leftShoulderU: 100, leftShoulderY: 145,
      leftElbowU: 70, leftElbowY: 145,
      leftWristU: 40, leftWristY: 145,
      rightShoulderU: 100, rightShoulderY: 135,
      rightElbowU: 130, rightElbowY: 135,
      rightWristU: 160, rightWristY: 135,
      hipY: 95,
    });
    const result = evaluateSidePoseQualification(tiltedShoulders);
    assert.equal(result.status, SIDE_T_POSE_STATUS.WARNING);
    assert.ok(result.warnings.some((w) => w.toLowerCase().includes('shoulder elevation')));
  });

  it('6. Threshold boundaries: angle <= 20 is qualified, 20 < angle <= 35 is warning', () => {
    // Angle ~10 degrees: reach = 60, totalDeltaY = 10 -> angle = atan2(10, 60) * 180 / PI = 9.46 deg
    const cleanAngle = createSyntheticSideTPose({
      leftShoulderU: 100, leftShoulderY: 140,
      leftElbowU: 70, leftElbowY: 145,
      leftWristU: 40, leftWristY: 150,
      rightShoulderU: 100, rightShoulderY: 140,
      rightElbowU: 130, rightElbowY: 145,
      rightWristU: 160, rightWristY: 150,
    });
    const cleanRes = evaluateSidePoseQualification(cleanAngle);
    assert.equal(cleanRes.status, SIDE_T_POSE_STATUS.QUALIFIED);

    // Angle ~25 degrees: reach = 60, totalDeltaY = 28 -> angle = atan2(28, 60) * 180 / PI = 25.0 deg
    const warningAngle = createSyntheticSideTPose({
      leftShoulderU: 100, leftShoulderY: 140,
      leftElbowU: 70, leftElbowY: 154,
      leftWristU: 40, leftWristY: 168,
      rightShoulderU: 100, rightShoulderY: 140,
      rightElbowU: 130, rightElbowY: 154,
      rightWristU: 160, rightWristY: 168,
    });
    const warnRes = evaluateSidePoseQualification(warningAngle);
    assert.equal(warnRes.status, SIDE_T_POSE_STATUS.WARNING);
  });

  it('extractSideLandmarksMap handles various input structures cleanly', () => {
    // Array format
    const arr = [{ name: 'neck', sideUcm: 100, sideYcm: 150, score: 0.9 }];
    const mapArr = extractSideLandmarksMap(arr);
    assert.equal(mapArr.get('neck')?.u, 100);

    // Object with pose.acceptedLandmarks
    const obj = { pose: { acceptedLandmarks: [{ name: 'neck', imageX: 500, imageY: 200, score: 0.8 }] } };
    const mapObj = extractSideLandmarksMap(obj);
    assert.equal(mapObj.get('neck')?.u, 500);

    // Null / empty
    assert.equal(extractSideLandmarksMap(null).size, 0);
  });
});

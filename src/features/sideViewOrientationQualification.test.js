import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_VIEW_ORIENTATION_CONTRACT,
  SIDE_VIEW_ORIENTATION_CONTRACT_VERSION,
  SIDE_VIEW_ORIENTATION_STATUS,
  SIDE_LATERAL_ORIENTATION_THRESHOLDS,
  STABLE_BILATERAL_LANDMARK_PAIRS,
  evaluateSideViewOrientationQualification,
} from './sideViewOrientationQualification.js';

describe('sideViewOrientationQualification v0', () => {
  // Helper to build synthetic Front & Side poses
  function createSyntheticFrontAndSidePoses({
    shoulderFrontSep = 36,
    shoulderSideSep = 3.0,
    hipFrontSep = 32,
    hipSideSep = 2.5,
    kneeFrontSep = 20,
    kneeSideSep = 2.0,
    ankleFrontSep = 16,
    ankleSideSep = 1.5,
    confidence = 0.95,
  } = {}) {
    const frontPose = [
      { name: 'left_shoulder', spaceX: 100 - shoulderFrontSep / 2, spaceY: 140, score: confidence },
      { name: 'right_shoulder', spaceX: 100 + shoulderFrontSep / 2, spaceY: 140, score: confidence },
      { name: 'left_hip', spaceX: 100 - hipFrontSep / 2, spaceY: 95, score: confidence },
      { name: 'right_hip', spaceX: 100 + hipFrontSep / 2, spaceY: 95, score: confidence },
      { name: 'left_knee', spaceX: 100 - kneeFrontSep / 2, spaceY: 55, score: confidence },
      { name: 'right_knee', spaceX: 100 + kneeFrontSep / 2, spaceY: 55, score: confidence },
      { name: 'left_ankle', spaceX: 100 - ankleFrontSep / 2, spaceY: 15, score: confidence },
      { name: 'right_ankle', spaceX: 100 + ankleFrontSep / 2, spaceY: 15, score: confidence },
      // Wrists and elbows in Front A-pose (arms down)
      { name: 'left_wrist', spaceX: 70, spaceY: 90, score: confidence },
      { name: 'right_wrist', spaceX: 130, spaceY: 90, score: confidence },
    ];

    const sidePose = [
      { name: 'left_shoulder', sideUcm: 100 - shoulderSideSep / 2, sideYcm: 140, score: confidence },
      { name: 'right_shoulder', sideUcm: 100 + shoulderSideSep / 2, sideYcm: 140, score: confidence },
      { name: 'left_hip', sideUcm: 100 - hipSideSep / 2, sideYcm: 95, score: confidence },
      { name: 'right_hip', sideUcm: 100 + hipSideSep / 2, sideYcm: 95, score: confidence },
      { name: 'left_knee', sideUcm: 100 - kneeSideSep / 2, sideYcm: 55, score: confidence },
      { name: 'right_knee', sideUcm: 100 + kneeSideSep / 2, sideYcm: 55, score: confidence },
      { name: 'left_ankle', sideUcm: 100 - ankleSideSep / 2, sideYcm: 15, score: confidence },
      { name: 'right_ankle', sideUcm: 100 + ankleSideSep / 2, sideYcm: 15, score: confidence },
      // Wrists and elbows in Side T-pose (arms extended horizontally)
      { name: 'left_wrist', sideUcm: 40, sideYcm: 140, score: confidence },
      { name: 'right_wrist', sideUcm: 160, sideYcm: 140, score: confidence },
    ];

    return { frontPose, sidePose };
  }

  it('7. Strong bilateral collapse across stable pairs evaluates to status: qualified', () => {
    const { frontPose, sidePose } = createSyntheticFrontAndSidePoses();
    const result = evaluateSideViewOrientationQualification({
      frontPoseSource: frontPose,
      sidePoseSource: sidePose,
    });

    assert.equal(result.contract, SIDE_VIEW_ORIENTATION_CONTRACT);
    assert.equal(result.version, SIDE_VIEW_ORIENTATION_CONTRACT_VERSION);
    assert.equal(result.status, SIDE_VIEW_ORIENTATION_STATUS.QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.orientationSemantics, 'approximately_lateral');
    assert.equal(result.summary.usablePairsCount, 4);
    assert.equal(result.summary.passedPairsCount, 4);
    assert.ok(result.summary.aggregateCollapseRatio < SIDE_LATERAL_ORIENTATION_THRESHOLDS.MAX_COLLAPSE_RATIO_QUALIFIED);
    assert.equal(result.issues.length, 0);
  });

  it('8. Side separations remaining Front-like evaluates to status: disqualified', () => {
    // Uncollapsed Side pose where Side separations match Front separations (frontal view labeled as side)
    const { frontPose, sidePose } = createSyntheticFrontAndSidePoses({
      shoulderSideSep: 34, // ratio = 34 / 36 = 0.94
      hipSideSep: 30,      // ratio = 30 / 32 = 0.94
      kneeSideSep: 19,     // ratio = 19 / 20 = 0.95
      ankleSideSep: 15,    // ratio = 15 / 16 = 0.94
    });

    const result = evaluateSideViewOrientationQualification({
      frontPoseSource: frontPose,
      sidePoseSource: sidePose,
    });

    assert.equal(result.status, SIDE_VIEW_ORIENTATION_STATUS.DISQUALIFIED);
    assert.equal(result.qualified, false);
    assert.equal(result.orientationSemantics, 'unqualified');
    assert.ok(result.summary.failedPairsCount >= 2);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('front-like')));
  });

  it('9. One noisy pair with strong multi-pair consensus produces warning / provisional qualification', () => {
    // 3 pairs collapse cleanly (< 0.10), but 1 noisy pair (e.g. ankles) has a higher separation
    const { frontPose, sidePose } = createSyntheticFrontAndSidePoses({
      shoulderSideSep: 2.0, // ratio 2/36 = 0.05 (pass)
      hipSideSep: 2.0,      // ratio 2/32 = 0.06 (pass)
      kneeSideSep: 1.5,     // ratio 1.5/20 = 0.07 (pass)
      ankleSideSep: 14.0,   // ratio 14/16 = 0.87 (noisy/occluded pair fail)
    });

    const result = evaluateSideViewOrientationQualification({
      frontPoseSource: frontPose,
      sidePoseSource: sidePose,
    });

    // Aggregate ratio = (0.055 + 0.0625 + 0.075 + 0.875) / 4 = 0.267 <= 0.40
    assert.equal(result.status, SIDE_VIEW_ORIENTATION_STATUS.WARNING);
    assert.equal(result.orientationSemantics, 'provisional_approximately_lateral');
    assert.equal(result.summary.passedPairsCount, 3);
    assert.equal(result.summary.failedPairsCount, 1);
    assert.ok(result.warnings.some((w) => w.toLowerCase().includes('noisy') || w.toLowerCase().includes('warning')));
  });

  it('10. Insufficient bilateral pairs evaluates to status: unavailable', () => {
    // Front has only 1 landmark pair
    const frontPose = [
      { name: 'left_shoulder', spaceX: 82, spaceY: 140, score: 0.9 },
      { name: 'right_shoulder', spaceX: 118, spaceY: 140, score: 0.9 },
    ];
    const sidePose = [
      { name: 'left_shoulder', sideUcm: 98, sideYcm: 140, score: 0.9 },
      { name: 'right_shoulder', sideUcm: 102, sideYcm: 140, score: 0.9 },
    ];

    const result = evaluateSideViewOrientationQualification({
      frontPoseSource: frontPose,
      sidePoseSource: sidePose,
    });

    // 1 pair is below MIN_USABLE_BILATERAL_PAIRS = 2
    assert.equal(result.status, SIDE_VIEW_ORIENTATION_STATUS.WARNING);
    assert.ok(result.warnings.some((w) => w.includes('Only 1 usable bilateral landmark pair')));

    // 0 pairs -> unavailable
    const emptyResult = evaluateSideViewOrientationQualification({
      frontPoseSource: [],
      sidePoseSource: [],
    });
    assert.equal(emptyResult.status, SIDE_VIEW_ORIENTATION_STATUS.UNAVAILABLE);
  });

  it('11. Front A-pose / Side T-pose does not invalidate stable-pair lateral checking (wrists/elbows excluded)', () => {
    // In our synthetic pose, Front wrists are separated by 60 cm (A-pose) and Side wrists by 120 cm (T-pose).
    // STABLE_BILATERAL_LANDMARK_PAIRS explicitly contains only shoulders, hips, knees, ankles.
    const pairIds = STABLE_BILATERAL_LANDMARK_PAIRS.map((p) => p.id);
    assert.deepEqual(pairIds, ['shoulders', 'hips', 'knees', 'ankles']);
    assert.ok(!pairIds.includes('wrists'));
    assert.ok(!pairIds.includes('elbows'));

    const { frontPose, sidePose } = createSyntheticFrontAndSidePoses();
    const result = evaluateSideViewOrientationQualification({
      frontPoseSource: frontPose,
      sidePoseSource: sidePose,
    });

    assert.equal(result.status, SIDE_VIEW_ORIENTATION_STATUS.QUALIFIED);
    // None of the evaluated pairs are wrists or elbows
    assert.ok(result.pairEvaluations.every((p) => p.pairId !== 'wrists' && p.pairId !== 'elbows'));
  });

  it('12. Guardrail: No exact 90° or exact yaw claim in output provenance', () => {
    const { frontPose, sidePose } = createSyntheticFrontAndSidePoses();
    const result = evaluateSideViewOrientationQualification({
      frontPoseSource: frontPose,
      sidePoseSource: sidePose,
    });

    assert.equal(result.provenance.exactYawClaimed, null);
    assert.equal(result.provenance.cameraYawDegrees, null);
    assert.equal(result.orientationSemantics, 'approximately_lateral');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT,
  SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT_VERSION,
  SIDE_ORIENTATION_STATUS,
  FACING_DIRECTION,
  SIDE_U_ENDPOINT,
  SIDE_ORIENTATION_BLOCKER_CODES,
  SIDE_ORIENTATION_THRESHOLDS,
  extractAllSideLandmarksMap,
  evaluateSideAnteriorPosteriorOrientation,
} from './sideAnteriorPosteriorOrientation.js';

describe('Side Anterior / Posterior Orientation Semantics v0', () => {
  // Mock lateral qualification that passes
  const qualifiedLateral = {
    status: 'qualified',
    qualified: true,
    orientationSemantics: 'approximately_lateral',
  };

  // Mock lateral qualification that fails
  const disqualifiedLateral = {
    status: 'disqualified',
    qualified: false,
    orientationSemantics: 'unqualified',
  };

  describe('1. Clear positive-U facing direction', () => {
    it('determines positive_u facing direction and maps anterior to max_u when nose is to the right of ears', () => {
      // In Side view metrology space (0..200 cm):
      // Nose at U=110 cm, Ears at U=100 cm -> deltaU = +10 cm (facing positive U)
      const landmarks = [
        { name: 'nose', u: 110.0, y: 165.0, score: 0.95 },
        { name: 'left_ear', u: 100.0, y: 166.0, score: 0.90 },
        { name: 'right_ear', u: 100.0, y: 166.0, score: 0.90 },
        { name: 'left_shoulder', u: 98.0, y: 140.0, score: 0.90 },
        { name: 'right_shoulder', u: 98.0, y: 140.0, score: 0.90 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.contract, SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT);
      assert.equal(result.version, SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT_VERSION);
      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.isQualified, true);
      assert.equal(result.facingDirection, FACING_DIRECTION.POSITIVE_U);
      assert.equal(result.anteriorSide, SIDE_U_ENDPOINT.MAX_U);
      assert.equal(result.posteriorSide, SIDE_U_ENDPOINT.MIN_U);
      assert.equal(result.evidence.headCue.status, 'valid');
      assert.equal(result.evidence.headCue.deltaU, 10.0);
      assert.equal(result.evidence.headCue.direction, FACING_DIRECTION.POSITIVE_U);
    });
  });

  describe('2. Clear negative-U facing direction', () => {
    it('determines negative_u facing direction and maps anterior to min_u when nose is to the left of ears', () => {
      // Nose at U=90 cm, Ears at U=100 cm -> deltaU = -10 cm (facing negative U)
      const landmarks = [
        { name: 'nose', u: 90.0, y: 165.0, score: 0.95 },
        { name: 'left_ear', u: 100.0, y: 166.0, score: 0.90 },
        { name: 'right_ear', u: 100.0, y: 166.0, score: 0.90 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.isQualified, true);
      assert.equal(result.facingDirection, FACING_DIRECTION.NEGATIVE_U);
      assert.equal(result.anteriorSide, SIDE_U_ENDPOINT.MIN_U);
      assert.equal(result.posteriorSide, SIDE_U_ENDPOINT.MAX_U);
      assert.equal(result.evidence.headCue.deltaU, -10.0);
      assert.equal(result.evidence.headCue.direction, FACING_DIRECTION.NEGATIVE_U);
    });
  });

  describe('3. Flipped/mirrored Side input semantics', () => {
    it('correctly flips anterior/posterior mapping when coordinates are horizontally mirrored', () => {
      const normalPose = [
        { name: 'nose', u: 120.0, y: 160.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 160.0, score: 0.9 },
      ];

      const mirroredPose = normalPose.map((lm) => ({
        ...lm,
        u: 200.0 - lm.u, // 200 - 120 = 80, 200 - 100 = 100
      }));

      const resNormal = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: normalPose,
        sideViewOrientationQualification: qualifiedLateral,
      });
      const resMirrored = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: mirroredPose,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(resNormal.facingDirection, FACING_DIRECTION.POSITIVE_U);
      assert.equal(resNormal.anteriorSide, SIDE_U_ENDPOINT.MAX_U);
      assert.equal(resNormal.posteriorSide, SIDE_U_ENDPOINT.MIN_U);

      assert.equal(resMirrored.facingDirection, FACING_DIRECTION.NEGATIVE_U);
      assert.equal(resMirrored.anteriorSide, SIDE_U_ENDPOINT.MIN_U);
      assert.equal(resMirrored.posteriorSide, SIDE_U_ENDPOINT.MAX_U);
    });
  });

  describe('4. Primary head cue + agreeing foot cue', () => {
    it('corroborates orientation when head cue and foot cue both indicate positive_u', () => {
      const landmarks = [
        { name: 'nose', u: 115.0, y: 165.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
        { name: 'left_big_toe', u: 125.0, y: 10.0, score: 0.85 },
        { name: 'left_heel', u: 95.0, y: 10.0, score: 0.85 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.POSITIVE_U);
      assert.equal(result.anteriorSide, SIDE_U_ENDPOINT.MAX_U);
      assert.equal(result.evidence.consensus.isCorroborated, true);
      assert.equal(result.evidence.footCue.status, 'valid');
      assert.equal(result.evidence.footCue.direction, FACING_DIRECTION.POSITIVE_U);
      assert.equal(result.evidence.footCue.deltaU, 30.0);
    });
  });

  describe('5. Primary head cue valid + foot cue unavailable', () => {
    it('evaluates ready from authoritative head cue with advisory warning when foot landmarks are absent', () => {
      const landmarks = [
        { name: 'nose', u: 80.0, y: 165.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.NEGATIVE_U);
      assert.equal(result.anteriorSide, SIDE_U_ENDPOINT.MIN_U);
      assert.equal(result.evidence.footCue.status, 'unavailable');
      assert.equal(result.warnings.some((w) => w.includes('foot orientation cue unavailable')), true);
    });
  });

  describe('6. Conflicting head and foot cues -> ambiguous', () => {
    it('returns status ambiguous when head points positive_u but feet point negative_u', () => {
      const landmarks = [
        { name: 'nose', u: 115.0, y: 165.0, score: 0.9 }, // positive_u
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
        { name: 'left_big_toe', u: 80.0, y: 10.0, score: 0.85 }, // negative_u
        { name: 'left_heel', u: 110.0, y: 10.0, score: 0.85 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.AMBIGUOUS);
      assert.equal(result.facingDirection, null);
      assert.equal(result.anteriorSide, null);
      assert.equal(result.posteriorSide, null);
      assert.ok(result.blockers.includes(SIDE_ORIENTATION_BLOCKER_CODES.CONTRADICTING_DIRECTION_CUES));
      assert.ok(result.issues.some((i) => i.includes('contradict each other')));
    });
  });

  describe('7. Head cue inside dead-zone', () => {
    it('marks head cue indeterminate when displacement is below metric dead-zone threshold (2.0 cm)', () => {
      // deltaU = 100.5 - 100.0 = 0.5 cm < 2.0 cm deadZone
      const landmarks = [
        { name: 'nose', u: 100.5, y: 165.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.UNAVAILABLE);
      assert.equal(result.facingDirection, null);
      assert.equal(result.evidence.headCue.status, 'inside_dead_zone');
      assert.ok(result.blockers.includes(SIDE_ORIENTATION_BLOCKER_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE));
    });
  });

  describe('8. All direction cues unavailable', () => {
    it('returns status unavailable when no head or foot landmarks are present', () => {
      const landmarks = [
        { name: 'left_hip', u: 100.0, y: 100.0, score: 0.9 },
        { name: 'right_hip', u: 100.0, y: 100.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.UNAVAILABLE);
      assert.equal(result.facingDirection, null);
      assert.equal(result.evidence.headCue.status, 'unavailable');
      assert.equal(result.evidence.footCue.status, 'unavailable');
      assert.ok(result.blockers.includes(SIDE_ORIENTATION_BLOCKER_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE));
    });
  });

  describe('9. Malformed / non-finite landmark evidence', () => {
    it('returns status invalid when landmark coordinates contain NaN', () => {
      const landmarks = [
        { name: 'nose', u: NaN, y: 165.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.INVALID);
      assert.ok(result.blockers.includes(SIDE_ORIENTATION_BLOCKER_CODES.NON_FINITE_LANDMARK_COORDINATES));
    });
  });

  describe('10. Non-lateral Side qualification blocks orientation authority', () => {
    it('blocks orientation authority when sideViewOrientationQualification is disqualified', () => {
      const landmarks = [
        { name: 'nose', u: 120.0, y: 165.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: disqualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.UNAVAILABLE);
      assert.equal(result.facingDirection, null);
      assert.equal(result.anteriorSide, null);
      assert.ok(result.blockers.includes(SIDE_ORIENTATION_BLOCKER_CODES.SIDE_VIEW_NOT_QUALIFIED_LATERAL));
    });
  });

  describe('11. Extraction from various pose container shapes', () => {
    it('extracts landmarks from keypoints_named object map', () => {
      const poseObj = {
        keypoints_named: {
          nose: [115.0, 160.0, 0.9],
          left_ear: [100.0, 160.0, 0.9],
        },
      };

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: poseObj,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.POSITIVE_U);
    });

    it('extracts landmarks from instances[0] parallel arrays', () => {
      const poseObj = {
        keypoint_names: ['nose', 'left_ear', 'right_ear'],
        instances: [
          {
            keypoints: [[115.0, 160.0], [100.0, 160.0], [100.0, 160.0]],
            keypoint_scores: [0.95, 0.90, 0.90],
          },
        ],
      };

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: poseObj,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.POSITIVE_U);
    });

    it('extracts landmarks from Map instance', () => {
      const map = new Map();
      map.set('nose', { u: 80.0, y: 160.0, score: 0.9 });
      map.set('neck', { u: 100.0, y: 150.0, score: 0.9 });

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: map,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.NEGATIVE_U);
      assert.equal(result.anteriorSide, SIDE_U_ENDPOINT.MIN_U);
    });
  });

  describe('12. Fallback to eye or neck/shoulder when nose/ear are absent', () => {
    it('uses bilateral eyes and neck when nose and ears are missing', () => {
      const landmarks = [
        { name: 'left_eye', u: 112.0, y: 165.0, score: 0.9 },
        { name: 'right_eye', u: 112.0, y: 165.0, score: 0.9 },
        { name: 'neck', u: 100.0, y: 150.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.POSITIVE_U);
      assert.equal(result.evidence.headCue.facialAnchor.name, 'eyes_bilateral_mean');
      assert.equal(result.evidence.headCue.cranialReference.name, 'neck');
    });

    it('uses secondary foot cue when head cues are completely absent', () => {
      const landmarks = [
        { name: 'left_big_toe', u: 80.0, y: 10.0, score: 0.9 },
        { name: 'left_heel', u: 105.0, y: 10.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.status, SIDE_ORIENTATION_STATUS.READY);
      assert.equal(result.facingDirection, FACING_DIRECTION.NEGATIVE_U);
      assert.equal(result.anteriorSide, SIDE_U_ENDPOINT.MIN_U);
      assert.ok(result.warnings.some((w) => w.includes('Primary head profile cue unavailable')));
    });
  });

  describe('13. Strict guardrails validation', () => {
    it('ensures semantics statement explicitly disclaims canonical Z and 3D reconstruction', () => {
      const landmarks = [
        { name: 'nose', u: 115.0, y: 165.0, score: 0.9 },
        { name: 'left_ear', u: 100.0, y: 165.0, score: 0.9 },
      ];

      const result = evaluateSideAnteriorPosteriorOrientation({
        sidePoseSource: landmarks,
        sideViewOrientationQualification: qualifiedLateral,
      });

      assert.equal(result.semantics.is2dProfileSemanticsOnly, true);
      assert.equal(result.semantics.isCanonicalZ, false);
      assert.equal(result.semantics.is3dReconstruction, false);
      assert.ok(!JSON.stringify(result).includes('"canonicalZ"'));
      assert.ok(!JSON.stringify(result).includes('"pointmap"'));
      assert.ok(!JSON.stringify(result).includes('"normals"'));
    });
  });
});

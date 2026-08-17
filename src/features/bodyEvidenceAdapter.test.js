import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeBodyEvidence,
  classifyBodyLandmarkCandidate,
  isDeferredBodyLandmark,
  isSecondaryBodyAnchorCandidate,
  SECONDARY_FRONT_BODY_ANCHORS,
} from './bodyEvidenceAdapter.js';

const point = (name, x = 1000, y = 1000, score = 0.9) => ({
  name,
  x,
  y,
  score,
});

test('classifies core, allowlisted secondary, rejected, and deferred landmark names', () => {
  assert.deepEqual(classifyBodyLandmarkCandidate('left_shoulder'), {
    classification: 'core',
    reason: 'core-13',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('left_acromion'), {
    classification: 'secondary',
    reason: 'secondary-allowlist',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('right_big_toe'), {
    classification: 'secondary',
    reason: 'secondary-allowlist',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('left_eye'), {
    classification: 'rejected-face-head',
    reason: 'face-head-term',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('left_hand'), {
    classification: 'ignored-non-core',
    reason: 'deferred-hand-detail',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('contour_42'), {
    classification: 'ignored-non-core',
    reason: 'deferred-unstable-extra',
  });
  assert.deepEqual(classifyBodyLandmarkCandidate('chest'), {
    classification: 'ignored-non-core',
    reason: 'not-in-secondary-allowlist',
  });
});

test('accepts only the secondary allowlist as secondary candidates', () => {
  for (const name of SECONDARY_FRONT_BODY_ANCHORS) {
    assert.equal(isSecondaryBodyAnchorCandidate(name), true, name);
    assert.equal(isDeferredBodyLandmark(name), false, name);
  }

  const deferred = [
    'left_thumb',
    'right_thumb_cmc',
    'left_index_finger_tip',
    'middle_finger_mcp',
    'ring_finger_pip',
    'pinky_finger_dip',
    'left_palm',
    'right_hand',
    'left_foot_index',
    'waist',
    'chest',
    'landmark_17',
    'unknown_body_extra',
  ];
  for (const name of deferred) {
    assert.equal(isSecondaryBodyAnchorCandidate(name), false, name);
    assert.equal(isDeferredBodyLandmark(name), true, name);
  }
});

test('normalizes side prefix / suffix forms of secondary allowlist names', () => {
  assert.equal(isSecondaryBodyAnchorCandidate('Heel Left'), true);
  assert.equal(isSecondaryBodyAnchorCandidate('r_heel'), true);
  assert.equal(isSecondaryBodyAnchorCandidate('big_toe_right'), true);
  assert.equal(isSecondaryBodyAnchorCandidate('LEFT-ACROMION'), true);
});

test('reports a front-only secondary audit without side landmarks contaminating counts', () => {
  const result = analyzeBodyEvidence({
    frontPose: {
      keypoints_named: [
        point('neck'),
        point('left_shoulder'),
        point('left_acromion'),
        point('left_heel'),
        point('chest'),
        point('left_hand'),
        point('nose'),
        point('contour_42'),
      ],
    },
    sidePose: {
      keypoints_named: [
        point('waist'),
        point('right_ear'),
        point('landmark_9'),
      ],
    },
  });

  assert.equal(result.qa.frontTotalLandmarks, 8);
  assert.equal(result.qa.renderableFrontLandmarks, 2);
  assert.equal(result.qa.secondaryFrontLandmarks, 2);
  assert.equal(result.qa.frontRejectedFaceLandmarks, 1);
  assert.equal(result.qa.frontIgnoredNonCoreLandmarks, 3);
  assert.deepEqual(result.qa.secondaryFrontLandmarkNames, ['left_acromion', 'left_heel']);
  assert.deepEqual(result.qa.secondaryAllowlist, [...SECONDARY_FRONT_BODY_ANCHORS]);
  assert.deepEqual(result.qa.ignoredFrontLandmarks, [
    { name: 'chest', reason: 'not-in-secondary-allowlist' },
    { name: 'left_hand', reason: 'deferred-hand-detail' },
    { name: 'contour_42', reason: 'deferred-unstable-extra' },
  ]);
  assert.deepEqual(result.qa.rejectedFrontLandmarks, [
    { name: 'nose', reason: 'face-head-term' },
  ]);
});

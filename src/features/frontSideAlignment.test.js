import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALIGNMENT_STATUS,
  CANONICAL_LANDMARK_ORDER,
  DEFAULT_ALIGNMENT_TOLERANCE_CM,
  FRONT_SIDE_ALIGNMENT_CONTRACT,
  FRONT_SIDE_ALIGNMENT_VERSION,
  compareLandmarkIdentities,
  computeFrontSideAlignment,
} from './frontSideAlignment.js';
import {
  CORE_FRONT_BODY_ANCHORS,
  SECONDARY_FRONT_BODY_ANCHORS,
} from './bodyEvidenceAdapter.js';

test('1. Same identity in Front and Side produces one matched pair', () => {
  const frontCandidates = [
    { name: 'left_shoulder', spaceX: 120.0, spaceY: 150.0 },
  ];
  const sideCandidates = [
    { name: 'left_shoulder', sideUcm: 95.0, sideYcm: 152.0 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  assert.equal(report.contract, FRONT_SIDE_ALIGNMENT_CONTRACT);
  assert.equal(report.version, FRONT_SIDE_ALIGNMENT_VERSION);
  assert.equal(report.summary.totalMatched, 1);
  assert.equal(report.summary.totalFront, 1);
  assert.equal(report.summary.totalSide, 1);
  assert.equal(report.summary.frontOnlyCount, 0);
  assert.equal(report.summary.sideOnlyCount, 0);
  assert.equal(report.matchedPairs.length, 1);

  const pair = report.matchedPairs[0];
  assert.equal(pair.identity, 'left_shoulder');
  assert.deepEqual(pair.front, { x: 120.0, y: 150.0 });
  assert.deepEqual(pair.side, { u: 95.0, y: 152.0 });
});

test('2. verticalDeltaCm is calculated correctly and evaluates QA status', () => {
  const frontCandidates = [
    { name: 'left_shoulder', spaceX: 120, spaceY: 150.0 },
    { name: 'right_shoulder', spaceX: 80, spaceY: 150.0 },
    { name: 'left_elbow', spaceX: 135, spaceY: 120.0 },
    { name: 'neck', spaceX: 100, spaceY: null },
  ];
  const sideCandidates = [
    { name: 'left_shoulder', sideUcm: 95, sideYcm: 153.5 }, // delta = 3.5 <= 5.0 -> aligned
    { name: 'right_shoulder', sideUcm: 95, sideYcm: 142.0 }, // delta = 8.0 > 5.0 -> warning
    { name: 'left_elbow', sideUcm: 90, sideYcm: 120.0 }, // delta = 0.0 -> aligned
    { name: 'neck', sideUcm: 100, sideYcm: 160.0 }, // front has null y -> unavailable
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates, { toleranceCm: 5.0 });

  const leftShoulder = report.matchedPairs.find((p) => p.identity === 'left_shoulder');
  assert.equal(leftShoulder.verticalDeltaCm, 3.5);
  assert.equal(leftShoulder.status, ALIGNMENT_STATUS.ALIGNED);

  const rightShoulder = report.matchedPairs.find((p) => p.identity === 'right_shoulder');
  assert.equal(rightShoulder.verticalDeltaCm, 8.0);
  assert.equal(rightShoulder.status, ALIGNMENT_STATUS.WARNING);

  const leftElbow = report.matchedPairs.find((p) => p.identity === 'left_elbow');
  assert.equal(leftElbow.verticalDeltaCm, 0.0);
  assert.equal(leftElbow.status, ALIGNMENT_STATUS.ALIGNED);

  const neck = report.matchedPairs.find((p) => p.identity === 'neck');
  assert.equal(neck.verticalDeltaCm, null);
  assert.equal(neck.status, ALIGNMENT_STATUS.UNAVAILABLE);

  assert.equal(report.summary.alignedCount, 2);
  assert.equal(report.summary.warningCount, 1);
  assert.equal(report.summary.unavailableCount, 1);
});

test('3. Front-only identity is reported correctly', () => {
  const frontCandidates = [
    { name: 'left_wrist', spaceX: 140, spaceY: 90 },
    { name: 'right_wrist', spaceX: 60, spaceY: 90 },
  ];
  const sideCandidates = [
    { name: 'left_wrist', sideUcm: 85, sideYcm: 91 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  assert.equal(report.summary.frontOnlyCount, 1);
  assert.deepEqual(report.frontOnly.map((item) => item.identity), ['right_wrist']);
  assert.equal(report.frontOnly.length, 1);

  const frontOnlyWrist = report.frontOnly[0];
  assert.equal(frontOnlyWrist.identity, 'right_wrist');
  assert.equal(frontOnlyWrist.classification, 'core');
  assert.deepEqual(frontOnlyWrist.front, { x: 60, y: 90 });
  assert.equal(frontOnlyWrist.status, 'unavailable');
  assert.equal(frontOnlyWrist.reason, 'missing-in-side');
});

test('4. Side-only identity is reported correctly', () => {
  const frontCandidates = [
    { name: 'neck', spaceX: 100, spaceY: 160 },
  ];
  const sideCandidates = [
    { name: 'neck', sideUcm: 100, sideYcm: 160 },
    { name: 'right_knee', sideUcm: 102, sideYcm: 50 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  assert.equal(report.summary.sideOnlyCount, 1);
  assert.deepEqual(report.sideOnly.map((item) => item.identity), ['right_knee']);
  assert.equal(report.sideOnly.length, 1);

  const sideOnlyKnee = report.sideOnly[0];
  assert.equal(sideOnlyKnee.identity, 'right_knee');
  assert.equal(sideOnlyKnee.classification, 'core');
  assert.deepEqual(sideOnlyKnee.side, { u: 102, y: 50 });
  assert.equal(sideOnlyKnee.status, 'unavailable');
  assert.equal(sideOnlyKnee.reason, 'missing-in-front');
});

test('does not emit redundant derived identity lists in alignment report', () => {
  const frontCandidates = [
    { name: 'neck', x: 100, y: 160 },
    { name: 'left_shoulder', x: 120, y: 150 },
  ];
  const sideCandidates = [
    { name: 'neck', u: 100, y: 160 },
    { name: 'right_shoulder', u: 95, y: 150 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  assert.ok(!('frontOnlyIdentities' in report));
  assert.ok(!('sideOnlyIdentities' in report));
  assert.equal(report.frontOnlyIdentities, undefined);
  assert.equal(report.sideOnlyIdentities, undefined);

  // Deriving lists from frontOnly and sideOnly works as expected
  assert.deepEqual(report.frontOnly.map((item) => item.identity), ['left_shoulder']);
  assert.deepEqual(report.sideOnly.map((item) => item.identity), ['right_shoulder']);
});

test('5. Core/Secondary classification is preserved', () => {
  const frontCandidates = [
    { name: 'left_shoulder', spaceX: 120, spaceY: 150 }, // Core 13
    { name: 'left_acromion', spaceX: 125, spaceY: 152 }, // Secondary allowlist
    { name: 'right_heel', spaceX: 85, spaceY: 8 }, // Secondary allowlist
  ];
  const sideCandidates = [
    { name: 'left_shoulder', sideUcm: 95, sideYcm: 150 },
    { name: 'left_acromion', sideUcm: 96, sideYcm: 151 },
    { name: 'right_heel', sideUcm: 80, sideYcm: 8 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  assert.equal(report.summary.coreMatchedCount, 1);
  assert.equal(report.summary.secondaryMatchedCount, 2);

  const shoulderPair = report.matchedPairs.find((p) => p.identity === 'left_shoulder');
  assert.equal(shoulderPair.classification, 'core');

  const acromionPair = report.matchedPairs.find((p) => p.identity === 'left_acromion');
  assert.equal(acromionPair.classification, 'secondary');

  const heelPair = report.matchedPairs.find((p) => p.identity === 'right_heel');
  assert.equal(heelPair.classification, 'secondary');
});

test('6. No z, depth, or canonical 3D position is emitted (Strict Geometry Guardrail)', () => {
  const frontCandidates = [
    { name: 'neck', x: 100, y: 160 },
    { name: 'left_shoulder', x: 120, y: 150 },
    { name: 'left_acromion', x: 125, y: 152 },
  ];
  const sideCandidates = [
    { name: 'neck', u: 100, y: 160 },
    { name: 'left_shoulder', u: 95, y: 151 },
    { name: 'right_shoulder', u: 95, y: 151 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  // Check top-level report keys
  assert.ok(!('z' in report));
  assert.ok(!('depth' in report));
  assert.ok(!('position' in report));
  assert.ok(!('point' in report));

  // Check each matched pair
  for (const pair of report.matchedPairs) {
    assert.ok(!('z' in pair));
    assert.ok(!('depth' in pair));
    assert.ok(!('position' in pair));
    assert.ok(!('point' in pair));

    // Front coordinates must only have x and y
    assert.deepEqual(Object.keys(pair.front).sort(), ['x', 'y']);
    assert.ok(!('z' in pair.front));
    assert.ok(!('depth' in pair.front));

    // Side coordinates must only have u and y
    assert.deepEqual(Object.keys(pair.side).sort(), ['u', 'y']);
    assert.ok(!('z' in pair.side));
    assert.ok(!('depth' in pair.side));
  }

  // Check front-only and side-only items
  for (const item of report.frontOnly) {
    assert.deepEqual(Object.keys(item.front).sort(), ['x', 'y']);
    assert.ok(!('z' in item.front));
  }
  for (const item of report.sideOnly) {
    assert.deepEqual(Object.keys(item.side).sort(), ['u', 'y']);
    assert.ok(!('z' in item.side));
  }
});

test('7. Input objects are not mutated', () => {
  const frontCand1 = Object.freeze({ name: 'left_hip', spaceX: 110, spaceY: 90 });
  const frontCand2 = Object.freeze({ name: 'right_hip', spaceX: 90, spaceY: 90 });
  const sideCand1 = Object.freeze({ name: 'left_hip', sideUcm: 100, sideYcm: 91 });
  const sideCand2 = Object.freeze({ name: 'right_hip', sideUcm: 100, sideYcm: 89 });

  const frontList = Object.freeze([frontCand1, frontCand2]);
  const sideList = Object.freeze([sideCand1, sideCand2]);

  const report = computeFrontSideAlignment(frontList, sideList);

  assert.equal(report.summary.totalMatched, 2);
  assert.equal(frontList.length, 2);
  assert.equal(sideList.length, 2);
  assert.equal(frontCand1.spaceX, 110);
  assert.equal(sideCand1.sideUcm, 100);
});

test('8. Output ordering is deterministic regardless of input permutation', () => {
  const frontA = [
    { name: 'right_ankle', spaceX: 85, spaceY: 10 },
    { name: 'neck', spaceX: 100, spaceY: 160 },
    { name: 'left_shoulder', spaceX: 120, spaceY: 150 },
    { name: 'left_acromion', spaceX: 125, spaceY: 152 },
    { name: 'right_heel', spaceX: 85, spaceY: 8 },
  ];
  const sideA = [
    { name: 'left_acromion', sideUcm: 95, sideYcm: 152 },
    { name: 'left_shoulder', sideUcm: 95, sideYcm: 150 },
    { name: 'right_heel', sideUcm: 85, sideYcm: 8 },
    { name: 'right_ankle', sideUcm: 85, sideYcm: 10 },
    { name: 'neck', sideUcm: 100, sideYcm: 160 },
  ];

  const frontB = [...frontA].reverse();
  const sideB = [...sideA].reverse();

  const reportA = computeFrontSideAlignment(frontA, sideA);
  const reportB = computeFrontSideAlignment(frontB, sideB);

  const identitiesA = reportA.matchedPairs.map((p) => p.identity);
  const identitiesB = reportB.matchedPairs.map((p) => p.identity);

  assert.deepEqual(identitiesA, [
    'neck',
    'left_shoulder',
    'right_ankle',
    'left_acromion',
    'right_heel',
  ]);
  assert.deepEqual(identitiesA, identitiesB);
});

test('supports alternative calling formats and handles empty inputs safely', () => {
  const emptyReport = computeFrontSideAlignment([], []);
  assert.equal(emptyReport.summary.totalMatched, 0);
  assert.equal(emptyReport.summary.totalFront, 0);
  assert.equal(emptyReport.summary.totalSide, 0);
  assert.equal(emptyReport.matchedPairs.length, 0);
  assert.equal(emptyReport.frontOnly.length, 0);
  assert.equal(emptyReport.sideOnly.length, 0);

  const objectArgReport = computeFrontSideAlignment({
    frontCandidates: [{ name: 'neck', x: 100, y: 160 }],
    sideCandidates: [{ name: 'neck', u: 100, y: 160 }],
    toleranceCm: 2.5,
  });
  assert.equal(objectArgReport.toleranceCm, 2.5);
  assert.equal(objectArgReport.summary.totalMatched, 1);
});

test('normalizes landmark name variants (e.g. prefix, suffix, casing)', () => {
  const frontCandidates = [
    { name: 'Left Shoulder', x: 120, y: 150 },
    { name: 'l_elbow', x: 135, y: 120 },
    { name: 'wrist_left', x: 140, y: 90 },
  ];
  const sideCandidates = [
    { name: 'left_shoulder', u: 95, y: 150 },
    { name: 'left_elbow', u: 90, y: 120 },
    { name: 'left_wrist', u: 85, y: 90 },
  ];

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  assert.equal(report.summary.totalMatched, 3);
  assert.deepEqual(
    report.matchedPairs.map((p) => p.identity),
    ['left_shoulder', 'left_elbow', 'left_wrist'],
  );
});

test('canonical landmark order includes all Core 13 and Secondary allowlist', () => {
  assert.equal(CANONICAL_LANDMARK_ORDER.length, 21);
  assert.deepEqual(
    CANONICAL_LANDMARK_ORDER.slice(0, 13),
    [...CORE_FRONT_BODY_ANCHORS],
  );
  assert.deepEqual(
    CANONICAL_LANDMARK_ORDER.slice(13),
    [...SECONDARY_FRONT_BODY_ANCHORS],
  );
});

test('compareLandmarkIdentities handles known and unknown landmark identities', () => {
  assert.ok(compareLandmarkIdentities('neck', 'left_shoulder') < 0);
  assert.ok(compareLandmarkIdentities('left_shoulder', 'neck') > 0);
  assert.ok(compareLandmarkIdentities('right_ankle', 'left_acromion') < 0); // Core comes before secondary
  assert.ok(compareLandmarkIdentities('left_acromion', 'unknown_extra') < 0); // Known comes before unknown
  assert.ok(compareLandmarkIdentities('alpha', 'beta') < 0); // Lexicographical for unknowns
  assert.equal(compareLandmarkIdentities('neck', 'neck'), 0);
});

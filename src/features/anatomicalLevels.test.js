import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANATOMICAL_DERIVATION_METHOD,
  ANATOMICAL_LEVEL_DEFINITIONS_V0,
  ANATOMICAL_LEVEL_IDS_V0,
  ANATOMICAL_LEVEL_STATUS,
  ANATOMICAL_LEVELS_CONTRACT_VERSION,
  ANATOMICAL_LEVELS_VIEW,
  computeAnatomicalLevels,
} from './anatomicalLevels.js';

const landmark = (name, y = 100, x = 100, z = 200, id = name) => ({
  id,
  name,
  type: 'body_landmark',
  point: { x, y, z },
});

const restoredLandmark = (name, y = 100, x = 100, z = 200, id = name) => ({
  id,
  name,
  type: 'body_landmark',
  position: { x, y, z },
});

test('Anatomical Level Contract v0 exports contract metadata and exact 7 levels', () => {
  assert.equal(ANATOMICAL_LEVELS_CONTRACT_VERSION, 'anatomical-levels-v0');
  assert.equal(ANATOMICAL_LEVELS_VIEW, 'front');
  assert.equal(ANATOMICAL_LEVEL_DEFINITIONS_V0.length, 7);
  assert.deepEqual([...ANATOMICAL_LEVEL_IDS_V0], [
    'neck',
    'shoulder',
    'elbow',
    'wrist',
    'hip',
    'knee',
    'ankle',
  ]);
});

test('empty annotations yield all 7 levels as missing with summary counts', () => {
  const report = computeAnatomicalLevels([]);

  assert.equal(report.contract, 'anatomical-levels-v0');
  assert.equal(report.view, 'front');
  assert.equal(report.levels.length, 7);
  assert.deepEqual(
    report.levels.map((lvl) => lvl.id),
    ['neck', 'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'],
  );
  assert.ok(report.levels.every((lvl) => lvl.status === ANATOMICAL_LEVEL_STATUS.MISSING));
  assert.ok(report.levels.every((lvl) => lvl.yCm === null && lvl.elevationDeltaCm === null));
  assert.ok(report.levels.every((lvl) => lvl.derivation.method === null));
  assert.ok(report.levels.every((lvl) => lvl.issues.length === 0));

  assert.deepEqual(report.summary, {
    total: 7,
    ready: 0,
    partial: 0,
    missing: 7,
  });
});

test('neck ready derives single landmark Y and null elevationDeltaCm', () => {
  const report = computeAnatomicalLevels([
    landmark('neck', 152.4),
  ]);

  const neckLevel = report.levels.find((lvl) => lvl.id === 'neck');
  assert.equal(neckLevel.status, 'ready');
  assert.deepEqual(neckLevel.requiredAnchors, ['neck']);
  assert.deepEqual(neckLevel.presentAnchors, ['neck']);
  assert.deepEqual(neckLevel.missingAnchors, []);
  assert.equal(neckLevel.yCm, 152.4);
  assert.equal(neckLevel.elevationDeltaCm, null);
  assert.equal(neckLevel.derivation.method, ANATOMICAL_DERIVATION_METHOD.SINGLE_LANDMARK_Y);
  assert.deepEqual(neckLevel.issues, []);

  assert.equal(report.summary.ready, 1);
  assert.equal(report.summary.missing, 6);
});

test('shoulder ready derives bilateral mean Y and elevationDeltaCm', () => {
  const report = computeAnatomicalLevels([
    landmark('left_shoulder', 142.0),
    landmark('right_shoulder', 138.0),
  ]);

  const shoulderLevel = report.levels.find((lvl) => lvl.id === 'shoulder');
  assert.equal(shoulderLevel.status, 'ready');
  assert.deepEqual(shoulderLevel.requiredAnchors, ['left_shoulder', 'right_shoulder']);
  assert.deepEqual(shoulderLevel.presentAnchors, ['left_shoulder', 'right_shoulder']);
  assert.deepEqual(shoulderLevel.missingAnchors, []);
  assert.equal(shoulderLevel.yCm, 140.0);
  assert.equal(shoulderLevel.elevationDeltaCm, 4.0);
  assert.equal(shoulderLevel.derivation.method, ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y);
  assert.deepEqual(shoulderLevel.issues, []);
});

test('all bilateral levels compute correct bilateral mean Y and elevation delta', () => {
  const annotations = [
    landmark('neck', 150.0),
    landmark('left_shoulder', 140.0),
    landmark('right_shoulder', 142.0),
    landmark('left_elbow', 110.0),
    landmark('right_elbow', 108.0),
    landmark('left_wrist', 85.0),
    landmark('right_wrist', 85.0),
    landmark('left_hip', 92.0),
    landmark('right_hip', 90.0),
    landmark('left_knee', 50.0),
    landmark('right_knee', 52.0),
    landmark('left_ankle', 12.0),
    landmark('right_ankle', 10.0),
  ];

  const report = computeAnatomicalLevels(annotations);
  assert.equal(report.summary.total, 7);
  assert.equal(report.summary.ready, 7);
  assert.equal(report.summary.partial, 0);
  assert.equal(report.summary.missing, 0);

  const levelMap = new Map(report.levels.map((lvl) => [lvl.id, lvl]));

  assert.equal(levelMap.get('shoulder').yCm, 141.0);
  assert.equal(levelMap.get('shoulder').elevationDeltaCm, 2.0);

  assert.equal(levelMap.get('elbow').yCm, 109.0);
  assert.equal(levelMap.get('elbow').elevationDeltaCm, 2.0);

  assert.equal(levelMap.get('wrist').yCm, 85.0);
  assert.equal(levelMap.get('wrist').elevationDeltaCm, 0.0);

  assert.equal(levelMap.get('hip').yCm, 91.0);
  assert.equal(levelMap.get('hip').elevationDeltaCm, 2.0);

  assert.equal(levelMap.get('knee').yCm, 51.0);
  assert.equal(levelMap.get('knee').elevationDeltaCm, 2.0);

  assert.equal(levelMap.get('ankle').yCm, 11.0);
  assert.equal(levelMap.get('ankle').elevationDeltaCm, 2.0);
});

test('exactly one bilateral anchor produces partial with null yCm and null elevationDeltaCm (no single-side fallback)', () => {
  const report = computeAnatomicalLevels([
    landmark('left_shoulder', 140.0),
  ]);

  const shoulder = report.levels.find((lvl) => lvl.id === 'shoulder');
  assert.equal(shoulder.status, 'partial');
  assert.deepEqual(shoulder.presentAnchors, ['left_shoulder']);
  assert.deepEqual(shoulder.missingAnchors, ['right_shoulder']);
  assert.equal(shoulder.yCm, null);
  assert.equal(shoulder.elevationDeltaCm, null);
  assert.equal(shoulder.derivation.method, null);
  assert.deepEqual(shoulder.issues, []);

  assert.equal(report.summary.ready, 0);
  assert.equal(report.summary.partial, 1);
  assert.equal(report.summary.missing, 6);
});

test('non-finite Y in neck produces partial with null yCm and explicit issue', () => {
  const report = computeAnatomicalLevels([
    landmark('neck', NaN),
  ]);

  const neck = report.levels.find((lvl) => lvl.id === 'neck');
  assert.equal(neck.status, 'partial');
  assert.deepEqual(neck.presentAnchors, []);
  assert.deepEqual(neck.missingAnchors, ['neck']);
  assert.equal(neck.yCm, null);
  assert.equal(neck.elevationDeltaCm, null);
  assert.equal(neck.derivation.method, null);
  assert.equal(neck.issues.length, 1);
  assert.ok(neck.issues[0].includes('Non-finite Y coordinate for anchor "neck"'));
});

test('non-finite Y in bilateral anchor produces partial with explicit issue', () => {
  const report = computeAnatomicalLevels([
    landmark('left_elbow', 110.0),
    landmark('right_elbow', Infinity),
  ]);

  const elbow = report.levels.find((lvl) => lvl.id === 'elbow');
  assert.equal(elbow.status, 'partial');
  assert.deepEqual(elbow.presentAnchors, ['left_elbow']);
  assert.deepEqual(elbow.missingAnchors, ['right_elbow']);
  assert.equal(elbow.yCm, null);
  assert.equal(elbow.elevationDeltaCm, null);
  assert.equal(elbow.derivation.method, null);
  assert.equal(elbow.issues.length, 1);
  assert.ok(elbow.issues[0].includes('Non-finite Y coordinate for anchor "right_elbow"'));
});

test('duplicate neck anchor makes level ambiguous (status partial, yCm null, explicit issue)', () => {
  const report = computeAnatomicalLevels([
    landmark('neck', 150.0, 100, 200, 'neck-1'),
    landmark('neck', 152.0, 100, 200, 'neck-2'),
  ]);

  const neck = report.levels.find((lvl) => lvl.id === 'neck');
  assert.equal(neck.status, 'partial');
  assert.deepEqual(neck.presentAnchors, []);
  assert.deepEqual(neck.missingAnchors, ['neck']);
  assert.equal(neck.yCm, null);
  assert.equal(neck.derivation.method, null);
  assert.equal(neck.issues.length, 1);
  assert.ok(neck.issues[0].includes('Duplicate promoted landmark for anchor "neck" (2 found)'));
});

test('duplicate bilateral anchor makes level ambiguous (status partial, yCm null, explicit issue)', () => {
  const report = computeAnatomicalLevels([
    landmark('left_hip', 90.0, 100, 200, 'hip-l1'),
    landmark('left_hip', 91.0, 100, 200, 'hip-l2'),
    landmark('right_hip', 90.0, 100, 200, 'hip-r'),
  ]);

  const hip = report.levels.find((lvl) => lvl.id === 'hip');
  assert.equal(hip.status, 'partial');
  assert.deepEqual(hip.presentAnchors, ['right_hip']);
  assert.deepEqual(hip.missingAnchors, ['left_hip']);
  assert.equal(hip.yCm, null);
  assert.equal(hip.elevationDeltaCm, null);
  assert.equal(hip.derivation.method, null);
  assert.equal(hip.issues.length, 1);
  assert.ok(hip.issues[0].includes('Duplicate promoted landmark for anchor "left_hip" (2 found)'));
});

test('duplicate anchor on one side when other side is missing produces partial with explicit issue', () => {
  const report = computeAnatomicalLevels([
    landmark('left_knee', 50.0, 100, 200, 'knee-l1'),
    landmark('left_knee', 52.0, 100, 200, 'knee-l2'),
  ]);

  const knee = report.levels.find((lvl) => lvl.id === 'knee');
  assert.equal(knee.status, 'partial');
  assert.deepEqual(knee.presentAnchors, []);
  assert.deepEqual(knee.missingAnchors, ['left_knee', 'right_knee']);
  assert.equal(knee.yCm, null);
  assert.equal(knee.issues.length, 1);
  assert.ok(knee.issues[0].includes('Duplicate promoted landmark for anchor "left_knee" (2 found)'));
});

test('supports restored/serialized position: { x, y, z } format seamlessly', () => {
  const report = computeAnatomicalLevels([
    restoredLandmark('neck', 155.0),
    restoredLandmark('left_ankle', 14.0),
    restoredLandmark('right_ankle', 12.0),
  ]);

  const neck = report.levels.find((lvl) => lvl.id === 'neck');
  assert.equal(neck.status, 'ready');
  assert.equal(neck.yCm, 155.0);

  const ankle = report.levels.find((lvl) => lvl.id === 'ankle');
  assert.equal(ankle.status, 'ready');
  assert.equal(ankle.yCm, 13.0);
  assert.equal(ankle.elevationDeltaCm, 2.0);
});

test('normalizes landmark name variants (casing, spaces, prefixes, suffixes)', () => {
  const report = computeAnatomicalLevels([
    landmark('Neck', 150.0),
    landmark('Left Shoulder', 140.0),
    landmark('r_shoulder', 138.0),
    landmark('wrist_l', 80.0),
    landmark('right_wrist', 82.0),
  ]);

  const neck = report.levels.find((lvl) => lvl.id === 'neck');
  assert.equal(neck.status, 'ready');
  assert.equal(neck.yCm, 150.0);

  const shoulder = report.levels.find((lvl) => lvl.id === 'shoulder');
  assert.equal(shoulder.status, 'ready');
  assert.equal(shoulder.yCm, 139.0);

  const wrist = report.levels.find((lvl) => lvl.id === 'wrist');
  assert.equal(wrist.status, 'ready');
  assert.equal(wrist.yCm, 81.0);
});

test('strictly filters by type === body_landmark and ignores other annotation types', () => {
  const report = computeAnatomicalLevels([
    { id: 1, name: 'neck', type: 'custom', point: { x: 100, y: 150, z: 200 } },
    { id: 2, name: 'neck', type: 'reference_point', point: { x: 100, y: 150, z: 200 } },
    { id: 3, name: 'left_shoulder', type: 'garment_landmark', point: { x: 80, y: 140, z: 200 } },
    { id: 4, name: 'right_shoulder', type: 'measurement_point', point: { x: 120, y: 140, z: 200 } },
    landmark('neck', 155.0),
  ]);

  const neck = report.levels.find((lvl) => lvl.id === 'neck');
  assert.equal(neck.status, 'ready');
  assert.equal(neck.yCm, 155.0);
  assert.deepEqual(neck.issues, []);

  const shoulder = report.levels.find((lvl) => lvl.id === 'shoulder');
  assert.equal(shoulder.status, 'missing');
});

test('deferred anatomy and unpromoted secondary landmarks do not create extra levels or pollute v0 levels', () => {
  const report = computeAnatomicalLevels([
    landmark('chest', 130.0),
    landmark('bust', 128.0),
    landmark('underbust', 125.0),
    landmark('waist', 105.0),
    landmark('abdomen', 100.0),
    landmark('pelvis', 95.0),
    landmark('crotch', 88.0),
    landmark('left_acromion', 142.0),
    landmark('left_heel', 5.0),
    landmark('neck', 150.0),
  ]);

  assert.equal(report.levels.length, 7);
  assert.deepEqual(
    report.levels.map((lvl) => lvl.id),
    ['neck', 'shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'],
  );
  assert.equal(report.levels.find((lvl) => lvl.id === 'neck').status, 'ready');
  assert.equal(report.levels.find((lvl) => lvl.id === 'shoulder').status, 'missing');
});

test('does not mutate input annotations array or objects', () => {
  const originalPoint = { x: 10, y: 20, z: 30 };
  const input = [
    { id: 1, name: 'neck', type: 'body_landmark', point: originalPoint },
    { id: 2, name: 'left_shoulder', type: 'body_landmark', point: { x: 40, y: 50, z: 60 } },
  ];
  const inputCopy = JSON.parse(JSON.stringify(input));

  computeAnatomicalLevels(input);

  assert.deepEqual(input, inputCopy);
  assert.equal(input[0].point, originalPoint);
});

test('summary counts accurately track mixed readiness states', () => {
  const annotations = [
    landmark('neck', 150.0), // Ready
    landmark('left_shoulder', 140.0), // Partial (missing right)
    // elbow: Missing
    landmark('left_wrist', 80.0),
    landmark('right_wrist', 80.0), // Ready
    landmark('left_hip', 90.0),
    landmark('right_hip', NaN), // Partial (non-finite right)
    // knee: Missing
    // ankle: Missing
  ];

  const report = computeAnatomicalLevels(annotations);
  assert.equal(report.summary.total, 7);
  assert.equal(report.summary.ready, 2); // neck, wrist
  assert.equal(report.summary.partial, 2); // shoulder, hip
  assert.equal(report.summary.missing, 3); // elbow, knee, ankle
  assert.equal(
    report.summary.ready + report.summary.partial + report.summary.missing,
    report.summary.total,
  );
});

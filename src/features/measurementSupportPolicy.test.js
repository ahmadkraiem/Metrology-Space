import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MEASUREMENT_SUPPORT_POLICY_CONTRACT,
  MEASUREMENT_SUPPORT_POLICY_CONTRACT_VERSION,
  MEASUREMENT_SUPPORT_POLICIES_V0,
  MEASUREMENT_DEFINITION_SUPPORT_MAPPING_V0,
  getMeasurementSupportPolicy,
  resolveMeasurementSupportPolicy,
} from './measurementSupportPolicy.js';

test('Measurement Support Policy Contract v0 exports contract metadata and registry', () => {
  assert.equal(MEASUREMENT_SUPPORT_POLICY_CONTRACT, 'measurement-support-policy-v0');
  assert.equal(MEASUREMENT_SUPPORT_POLICY_CONTRACT_VERSION, 'measurement-support-policy-v0');
  assert.ok(MEASUREMENT_SUPPORT_POLICIES_V0);
  assert.ok(MEASUREMENT_DEFINITION_SUPPORT_MAPPING_V0);
});

test('trunk_core_support_v0 defines exact minimal torso and upper clothing classes', () => {
  const trunkPolicy = MEASUREMENT_SUPPORT_POLICIES_V0.trunk_core_support_v0;
  assert.ok(trunkPolicy);
  assert.equal(trunkPolicy.id, 'trunk_core_support_v0');
  assert.deepEqual(trunkPolicy.anatomicalClassIds, [22]);
  assert.deepEqual(trunkPolicy.clothingBridgeClassIds, [23]);
  assert.deepEqual(trunkPolicy.acceptedClassIds, [22, 23]);
});

test('pelvic_core_support_v0 defines exact minimal upper legs, lower clothing, and torso classes', () => {
  const pelvicPolicy = MEASUREMENT_SUPPORT_POLICIES_V0.pelvic_core_support_v0;
  assert.ok(pelvicPolicy);
  assert.equal(pelvicPolicy.id, 'pelvic_core_support_v0');
  assert.deepEqual(pelvicPolicy.anatomicalClassIds, [12, 21, 22]);
  assert.deepEqual(pelvicPolicy.clothingBridgeClassIds, [13]);
  assert.deepEqual(pelvicPolicy.acceptedClassIds, [12, 13, 21, 22]);
});

test('trunk_pelvic_transition_support_v0 defines exact transition upper legs, lower clothing, upper clothing, and torso classes', () => {
  const transitionPolicy = MEASUREMENT_SUPPORT_POLICIES_V0.trunk_pelvic_transition_support_v0;
  assert.ok(transitionPolicy);
  assert.equal(transitionPolicy.id, 'trunk_pelvic_transition_support_v0');
  assert.deepEqual(transitionPolicy.anatomicalClassIds, [12, 21, 22]);
  assert.deepEqual(transitionPolicy.clothingBridgeClassIds, [13, 23]);
  assert.deepEqual(transitionPolicy.acceptedClassIds, [12, 13, 21, 22, 23]);

  // Explicitly excludes upper arms (11, 20), lower arms (7, 16), and background (0)
  assert.ok(!transitionPolicy.acceptedClassIds.includes(0));
  assert.ok(!transitionPolicy.acceptedClassIds.includes(7));
  assert.ok(!transitionPolicy.acceptedClassIds.includes(11));
  assert.ok(!transitionPolicy.acceptedClassIds.includes(16));
  assert.ok(!transitionPolicy.acceptedClassIds.includes(20));
});

test('resolveMeasurementSupportPolicy maps supported measurement definitions to expected policies', () => {
  const shoulderWidthPolicy = resolveMeasurementSupportPolicy('torso_width_at_shoulder_level');
  assert.ok(shoulderWidthPolicy);
  assert.equal(shoulderWidthPolicy.id, 'trunk_core_support_v0');

  const shoulderProfilePolicy = resolveMeasurementSupportPolicy('torso_profile_span_at_shoulder_level');
  assert.ok(shoulderProfilePolicy);
  assert.equal(shoulderProfilePolicy.id, 'trunk_core_support_v0');

  const hipWidthPolicy = resolveMeasurementSupportPolicy('torso_width_at_hip_level');
  assert.ok(hipWidthPolicy);
  assert.equal(hipWidthPolicy.id, 'pelvic_core_support_v0');

  const hipProfilePolicy = resolveMeasurementSupportPolicy('torso_profile_span_at_hip_level');
  assert.ok(hipProfilePolicy);
  assert.equal(hipProfilePolicy.id, 'pelvic_core_support_v0');

  assert.equal(resolveMeasurementSupportPolicy('unknown_definition'), null);
  assert.equal(resolveMeasurementSupportPolicy(null), null);
});

test('getMeasurementSupportPolicy looks up by policy ID safely and handles unknown inputs', () => {
  const trunk = getMeasurementSupportPolicy('trunk_core_support_v0');
  assert.ok(trunk);
  assert.equal(trunk.id, 'trunk_core_support_v0');

  const pelvic = getMeasurementSupportPolicy('pelvic_core_support_v0');
  assert.ok(pelvic);
  assert.equal(pelvic.id, 'pelvic_core_support_v0');

  assert.equal(getMeasurementSupportPolicy('non_existent'), null);
  assert.equal(getMeasurementSupportPolicy(null), null);
  assert.equal(getMeasurementSupportPolicy(undefined), null);
});

test('policy objects and class arrays are frozen and immutable', () => {
  const trunk = MEASUREMENT_SUPPORT_POLICIES_V0.trunk_core_support_v0;
  assert.ok(Object.isFrozen(trunk));
  assert.ok(Object.isFrozen(trunk.anatomicalClassIds));
  assert.ok(Object.isFrozen(trunk.clothingBridgeClassIds));
  assert.ok(Object.isFrozen(trunk.acceptedClassIds));
});

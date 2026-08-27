/**
 * Measurement Support Policy Contract v0
 *
 * Pure deterministic domain contract that defines which canonical segmentation classes
 * constitute the observed measurement-support silhouette for each supported measurement definition.
 *
 * Contract: 'measurement-support-policy-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Defines the observed supported silhouette (outer contour formed by accepted anatomical and garment pixels).
 * - A valid single supported run confirms topological validity under the measurement-support policy.
 * - Does NOT imply true unclothed physical body surface measurement. True physical body semantics
 *   remain independently gated under physical-measurement-semantics-v0.
 * - Explicitly partitions support sets into anatomicalClassIds, clothingBridgeClassIds, and acceptedClassIds.
 */

export const MEASUREMENT_SUPPORT_POLICY_CONTRACT = 'measurement-support-policy-v0';
export const MEASUREMENT_SUPPORT_POLICY_CONTRACT_VERSION = 'measurement-support-policy-v0';

/**
 * Authoritative registry of supported measurement-support policies (v0).
 * Minimal evidence-backed definitions derived from the authoritative 29-class segmentation ontology.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   description: string,
 *   anatomicalClassIds: readonly number[],
 *   clothingBridgeClassIds: readonly number[],
 *   acceptedClassIds: readonly number[],
 * }>>}
 */
export const MEASUREMENT_SUPPORT_POLICIES_V0 = Object.freeze({
  trunk_core_support_v0: Object.freeze({
    id: 'trunk_core_support_v0',
    name: 'Trunk Core Measurement Support Policy',
    description: 'Observed trunk silhouette support spanning exposed torso skin (22) and upper garments (23), strictly excluding upper arms (11, 20) and background.',
    anatomicalClassIds: Object.freeze([22]),
    clothingBridgeClassIds: Object.freeze([23]),
    acceptedClassIds: Object.freeze([22, 23]),
  }),
  pelvic_core_support_v0: Object.freeze({
    id: 'pelvic_core_support_v0',
    name: 'Pelvic Core Measurement Support Policy',
    description: 'Observed pelvic silhouette support spanning upper legs (12, 21), lower garments (13), and torso (22), strictly excluding hanging lower arms (7, 16) and background.',
    anatomicalClassIds: Object.freeze([12, 21, 22]),
    clothingBridgeClassIds: Object.freeze([13]),
    acceptedClassIds: Object.freeze([12, 13, 21, 22]),
  }),
  trunk_pelvic_transition_support_v0: Object.freeze({
    id: 'trunk_pelvic_transition_support_v0',
    name: 'Trunk-Pelvic Transition Measurement Support Policy',
    description: 'Observed outer silhouette support across the lower-torso / abdominal-pelvic transition where anatomical torso and upper-leg surfaces may be bridged by upper or lower fitted clothing.',
    anatomicalClassIds: Object.freeze([12, 21, 22]),
    clothingBridgeClassIds: Object.freeze([13, 23]),
    acceptedClassIds: Object.freeze([12, 13, 21, 22, 23]),
  }),
});

/**
 * Mapping from measurement definition ID to default measurement support policy ID.
 * @type {Readonly<Record<string, string>>}
 */
export const MEASUREMENT_DEFINITION_SUPPORT_MAPPING_V0 = Object.freeze({
  torso_width_at_shoulder_level: 'trunk_core_support_v0',
  torso_transverse_width_at_shoulder_level: 'trunk_core_support_v0',
  torso_profile_span_at_shoulder_level: 'trunk_core_support_v0',
  torso_width_at_hip_level: 'pelvic_core_support_v0',
  torso_transverse_width_at_hip_level: 'pelvic_core_support_v0',
  torso_profile_span_at_hip_level: 'pelvic_core_support_v0',
});

/**
 * Look up a measurement support policy definition by its policy ID.
 *
 * @param {string|null|undefined} policyId
 * @returns {typeof MEASUREMENT_SUPPORT_POLICIES_V0[keyof typeof MEASUREMENT_SUPPORT_POLICIES_V0]|null}
 */
export function getMeasurementSupportPolicy(policyId) {
  if (!policyId || typeof policyId !== 'string') return null;
  return MEASUREMENT_SUPPORT_POLICIES_V0[policyId] ?? null;
}

/**
 * Resolves the measurement support policy definition for a given measurement definition ID.
 *
 * @param {string|null|undefined} definitionId
 * @returns {typeof MEASUREMENT_SUPPORT_POLICIES_V0[keyof typeof MEASUREMENT_SUPPORT_POLICIES_V0]|null}
 */
export function resolveMeasurementSupportPolicy(definitionId) {
  if (!definitionId || typeof definitionId !== 'string') return null;
  const policyId = MEASUREMENT_DEFINITION_SUPPORT_MAPPING_V0[definitionId];
  if (!policyId) return null;
  return MEASUREMENT_SUPPORT_POLICIES_V0[policyId] ?? null;
}

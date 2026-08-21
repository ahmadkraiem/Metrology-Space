/**
 * Cross-view Measurement Correspondence Contract v0
 *
 * Pure deterministic domain correspondence layer that pairs existing Front transverse width
 * and Side profile span observations only when they refer to the same validated anatomical source level.
 *
 * Contract: 'cross-view-measurement-correspondence-v0'
 *
 * STRICT GUARDRAILS:
 * - Association / evidence pairing only: does NOT convert Side U to canonical Z or physical depth.
 * - 'ready' status indicates correspondence-readiness only, NOT validated physical depth or 3D geometry.
 * - Zero geometry fusion: no U -> Z, no depthCm/zCm/physicalDepthCm fields, no ellipse/circumference/cross-section/volume calculations.
 * - Pure and deterministic: consumes pre-computed Front and Side observations; does NOT read runtime state.
 * - Registry-driven: strictly pairs recognized definitions; does not permissively guess pairings.
 * - Invalid source evidence has precedence and propagates status 'invalid'.
 */

export const CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT = 'cross-view-measurement-correspondence-v0';
export const CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION = 'cross-view-measurement-correspondence-v0';

/**
 * 4-state status enum for cross-view measurement correspondences.
 * @readonly
 * @enum {string}
 */
export const CROSS_VIEW_CORRESPONDENCE_STATUS = Object.freeze({
  READY: 'ready',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Authoritative registry of supported Cross-view measurement correspondences (v0).
 * Strictly registry-driven: maps a correspondence ID to expected Front definition ID,
 * expected Side definition ID, and shared anatomical source level.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   sourceLevel: 'shoulder'|'hip',
 *   frontDefinitionId: string,
 *   sideDefinitionId: string,
 * }>>}
 */
export const SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0 = Object.freeze({
  torso_shoulder_cross_view_correspondence: Object.freeze({
    id: 'torso_shoulder_cross_view_correspondence',
    name: 'Torso Shoulder Cross-View Measurement Correspondence',
    sourceLevel: 'shoulder',
    frontDefinitionId: 'torso_width_at_shoulder_level',
    sideDefinitionId: 'torso_profile_span_at_shoulder_level',
  }),
  torso_hip_cross_view_correspondence: Object.freeze({
    id: 'torso_hip_cross_view_correspondence',
    name: 'Torso Hip Cross-View Measurement Correspondence',
    sourceLevel: 'hip',
    frontDefinitionId: 'torso_width_at_hip_level',
    sideDefinitionId: 'torso_profile_span_at_hip_level',
  }),
});

/**
 * @typedef {{
 *   contract: 'cross-view-measurement-correspondence-v0',
 *   version: 'cross-view-measurement-correspondence-v0',
 *   id: string,
 *   name: string,
 *   type: 'cross_view_measurement_correspondence',
 *   sourceLevel: string|null,
 *   status: 'ready'|'partial'|'unavailable'|'invalid',
 *   frontDefinitionId: string|null,
 *   sideDefinitionId: string|null,
 *   frontObservation: object|null,
 *   sideObservation: object|null,
 *   provenance: {
 *     sourceLevel: string|null,
 *     frontLevelYcm: number|null,
 *     sideLevelYcm: number|null,
 *     frontSampledPixelRow: number|null,
 *     sideSampledPixelRow: number|null,
 *     frontContract: string|null,
 *     sideContract: string|null,
 *   },
 *   issues: string[],
 * }} CrossViewMeasurementCorrespondenceResultV0
 */

/**
 * Builds a pure deterministic cross-view measurement correspondence from supplied Front and Side observations.
 *
 * @param {object|null|undefined} frontObservation - Pre-computed Front transverse width observation
 * @param {object|null|undefined} sideObservation - Pre-computed Side profile span observation
 * @param {{
 *   definition?: typeof SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0[keyof typeof SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0]|string|null,
 * }} [options]
 * @returns {CrossViewMeasurementCorrespondenceResultV0}
 */
export function buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
  definition = null,
} = {}) {
  const issues = [];

  // 1. Registry-driven Definition Resolution
  const resolvedDef = (typeof definition === 'string')
    ? (SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0[definition] ?? null)
    : (definition && typeof definition === 'object' ? definition : null);

  if (!resolvedDef || !resolvedDef.id || !resolvedDef.frontDefinitionId || !resolvedDef.sideDefinitionId || !resolvedDef.sourceLevel) {
    issues.push(`Invalid or unsupported correspondence definition: '${typeof definition === 'string' ? definition : resolvedDef?.id ?? 'null'}'. Correspondence must be registry-driven.`);
    return {
      contract: CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT,
      version: CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION,
      id: typeof definition === 'string' ? definition : (resolvedDef?.id ?? 'custom_correspondence'),
      name: resolvedDef?.name ?? 'Invalid Correspondence',
      type: 'cross_view_measurement_correspondence',
      sourceLevel: resolvedDef?.sourceLevel ?? null,
      status: CROSS_VIEW_CORRESPONDENCE_STATUS.INVALID,
      frontDefinitionId: resolvedDef?.frontDefinitionId ?? null,
      sideDefinitionId: resolvedDef?.sideDefinitionId ?? null,
      frontObservation: frontObservation ?? null,
      sideObservation: sideObservation ?? null,
      provenance: {
        sourceLevel: resolvedDef?.sourceLevel ?? null,
        frontLevelYcm: frontObservation?.provenance?.levelYcm ?? null,
        sideLevelYcm: sideObservation?.provenance?.levelYcm ?? null,
        frontSampledPixelRow: frontObservation?.provenance?.sampledPixelRow ?? null,
        sideSampledPixelRow: sideObservation?.provenance?.sampledPixelRow ?? null,
        frontContract: frontObservation?.contract ?? null,
        sideContract: sideObservation?.contract ?? null,
      },
      issues,
    };
  }

  let isInvalid = false;

  // 2. Contract and View Validation
  if (frontObservation) {
    if (typeof frontObservation !== 'object' || frontObservation.contract !== 'front-transverse-width-v0' || frontObservation.view !== 'front') {
      issues.push(`Invalid Front observation: expected contract 'front-transverse-width-v0' with view 'front', received '${frontObservation.contract}' view '${frontObservation.view}'.`);
      isInvalid = true;
    }
  }

  if (sideObservation) {
    if (typeof sideObservation !== 'object' || sideObservation.contract !== 'side-profile-span-v0' || sideObservation.view !== 'side') {
      issues.push(`Invalid Side observation: expected contract 'side-profile-span-v0' with view 'side', received '${sideObservation.contract}' view '${sideObservation.view}'.`);
      isInvalid = true;
    }
  }

  // 3. Definition ID & Source Level Matching
  if (frontObservation && frontObservation.contract === 'front-transverse-width-v0') {
    if (frontObservation.id !== resolvedDef.frontDefinitionId) {
      issues.push(`Mismatched Front definition ID: expected '${resolvedDef.frontDefinitionId}', received '${frontObservation.id}'.`);
      isInvalid = true;
    }
    const frontSourceLevel = frontObservation.provenance?.sourceLevel;
    if (frontSourceLevel && frontSourceLevel !== resolvedDef.sourceLevel) {
      issues.push(`Mismatched Front sourceLevel: expected '${resolvedDef.sourceLevel}', received '${frontSourceLevel}'.`);
      isInvalid = true;
    }
  }

  if (sideObservation && sideObservation.contract === 'side-profile-span-v0') {
    if (sideObservation.id !== resolvedDef.sideDefinitionId) {
      issues.push(`Mismatched Side definition ID: expected '${resolvedDef.sideDefinitionId}', received '${sideObservation.id}'.`);
      isInvalid = true;
    }
    const sideSourceLevel = sideObservation.provenance?.sourceLevel;
    if (sideSourceLevel && sideSourceLevel !== resolvedDef.sourceLevel) {
      issues.push(`Mismatched Side sourceLevel: expected '${resolvedDef.sourceLevel}', received '${sideSourceLevel}'.`);
      isInvalid = true;
    }
  }

  // 4. Invalid Source Evidence Precedence
  if (frontObservation?.status === 'invalid') {
    issues.push(`Front observation has invalid status: ${frontObservation.issues?.join('; ') || 'invalid'}`);
    isInvalid = true;
  }

  if (sideObservation?.status === 'invalid') {
    issues.push(`Side observation has invalid status: ${sideObservation.issues?.join('; ') || 'invalid'}`);
    isInvalid = true;
  }

  // 5. Y-level Provenance Consistency Check
  const frontY = frontObservation?.provenance?.levelYcm;
  const sideY = sideObservation?.provenance?.levelYcm;
  const hasFiniteFrontY = typeof frontY === 'number' && Number.isFinite(frontY);
  const hasFiniteSideY = typeof sideY === 'number' && Number.isFinite(sideY);

  if (hasFiniteFrontY && hasFiniteSideY) {
    if (Math.abs(frontY - sideY) > 1e-4) {
      issues.push(`Contradictory Y-level provenance: Front levelYcm (${frontY}) does not match Side levelYcm (${sideY}).`);
      isInvalid = true;
    }
  }

  // 6. Status Resolution
  let status;
  if (isInvalid) {
    status = CROSS_VIEW_CORRESPONDENCE_STATUS.INVALID;
  } else {
    const frontValid = frontObservation?.status === 'valid';
    const sideValid = sideObservation?.status === 'valid';

    if (frontValid && sideValid) {
      status = CROSS_VIEW_CORRESPONDENCE_STATUS.READY;
    } else if (frontValid || sideValid) {
      status = CROSS_VIEW_CORRESPONDENCE_STATUS.PARTIAL;
    } else {
      status = CROSS_VIEW_CORRESPONDENCE_STATUS.UNAVAILABLE;
    }
  }

  return {
    contract: CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT,
    version: CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION,
    id: resolvedDef.id,
    name: resolvedDef.name,
    type: 'cross_view_measurement_correspondence',
    sourceLevel: resolvedDef.sourceLevel,
    status,
    frontDefinitionId: resolvedDef.frontDefinitionId,
    sideDefinitionId: resolvedDef.sideDefinitionId,
    frontObservation: frontObservation ?? null,
    sideObservation: sideObservation ?? null,
    provenance: {
      sourceLevel: resolvedDef.sourceLevel,
      frontLevelYcm: hasFiniteFrontY ? frontY : null,
      sideLevelYcm: hasFiniteSideY ? sideY : null,
      frontSampledPixelRow: frontObservation?.provenance?.sampledPixelRow ?? null,
      sideSampledPixelRow: sideObservation?.provenance?.sampledPixelRow ?? null,
      frontContract: frontObservation?.contract ?? null,
      sideContract: sideObservation?.contract ?? null,
    },
    issues,
  };
}

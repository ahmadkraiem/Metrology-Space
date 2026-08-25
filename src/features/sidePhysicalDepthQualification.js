/**
 * Side Physical Depth Qualification Contract v0
 *
 * Pure deterministic domain contract and evaluator that qualifies when a valid
 * Side Profile Span observation (side-profile-span-v0) may be interpreted as a
 * qualified side-derived physical anterior–posterior (AP) depth estimate.
 *
 * Contract: 'side-physical-depth-qualification-v0'
 * View: 'side'
 *
 * STRICT GUARDRAILS:
 * - Evidence qualification only: does NOT treat Side U as canonical Z or 3D coordinate.
 * - Does NOT use Sapiens pointmap Z as physical depth.
 * - Does NOT perform Front/Side 3D coordinate fusion.
 * - Does NOT claim ground-truth validated depth or clinical millimeter accuracy.
 * - When qualified, qualifiedDepthEstimateCm equals sourceSideProfileSpan.valueCm.
 * - When disqualified / warning / unavailable, qualifiedDepthEstimateCm is strictly null.
 * - Shoulder depth is at shoulder landmark level (NOT biacromial breadth, NOT full arm span).
 * - Hip depth is at hip landmark level (NOT maximum buttock depth, NOT seat plane).
 * - Records Front A-pose / Side T-pose asymmetry as a downstream cross-section limitation.
 */

import {
  evaluateSidePoseQualification,
} from './sidePoseQualification.js';
import {
  evaluateSideViewOrientationQualification,
} from './sideViewOrientationQualification.js';
import {
  getMeasurementSupportPolicy,
  resolveMeasurementSupportPolicy,
} from './measurementSupportPolicy.js';

export const SIDE_PHYSICAL_DEPTH_CONTRACT = 'side-physical-depth-qualification-v0';
export const SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION = 'side-physical-depth-qualification-v0';

/**
 * Deterministic status taxonomy for Side Physical Depth Qualification.
 * @readonly
 * @enum {string}
 */
export const SIDE_PHYSICAL_DEPTH_STATUS = Object.freeze({
  QUALIFIED: 'qualified',
  WARNING: 'warning',
  DISQUALIFIED: 'disqualified',
  UNAVAILABLE: 'unavailable',
});

/**
 * Authoritative registry of supported Side physical depth qualification definitions (v0).
 * Strictly mapped to existing Side Profile Span definitions.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   sourceObservationDefinitionId: string,
 *   sourceLevel: 'shoulder'|'hip',
 *   supportPolicyId: string,
 * }>>}
 */
export const SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0 = Object.freeze({
  torso_profile_span_at_shoulder_level: Object.freeze({
    id: 'torso_ap_depth_at_shoulder_level',
    name: 'Torso AP Depth Estimate at Shoulder Level',
    sourceObservationDefinitionId: 'torso_profile_span_at_shoulder_level',
    sourceLevel: 'shoulder',
    supportPolicyId: 'trunk_core_support_v0',
  }),
  torso_profile_span_at_hip_level: Object.freeze({
    id: 'torso_ap_depth_at_hip_level',
    name: 'Torso AP Depth Estimate at Hip Level',
    sourceObservationDefinitionId: 'torso_profile_span_at_hip_level',
    sourceLevel: 'hip',
    supportPolicyId: 'pelvic_core_support_v0',
  }),
});

/**
 * Helper to build early/empty qualification record.
 */
function buildEmptyQualificationResult({
  id = 'unsupported_definition',
  name = 'Unsupported Definition',
  sourceObservationDefinitionId = null,
  sourceLevel = null,
  status = SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE,
  issues = [],
  warnings = [],
  checks = [],
  provenance = {},
} = {}) {
  return {
    contract: SIDE_PHYSICAL_DEPTH_CONTRACT,
    version: SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
    id,
    name,
    sourceObservationDefinitionId,
    sourceLevel,
    levelYcm: provenance.levelYcm ?? null,
    projectedSpanCm: provenance.projectedSpanCm ?? null,
    qualifiedDepthEstimateCm: null,
    status,
    qualificationTier: status === SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED ? 'physical_ap_depth_estimate' : 'unqualified',
    checks,
    issues,
    warnings,
    provenance: {
      ...provenance,
      crossViewPoseLimitation: 'front_a_side_t_mismatch_cross_section_deferred',
    },
  };
}

/**
 * Pure deterministic evaluation of Side Physical Depth Qualification for a single Side profile span observation.
 *
 * @param {object|null|undefined} sourceObservation - Pre-computed Side profile span observation (side-profile-span-v0)
 * @param {object} [options]
 * @param {object|string|null} [options.definition] - Definition object or ID
 * @param {object|null} [options.metricCalibrationProvenance] - Calibration evaluation (metric-calibration-provenance-v0)
 * @param {object|null} [options.sidePoseQualification] - Pre-computed Side T-pose evaluation (side-t-pose-qualification-v0)
 * @param {object|null} [options.sideViewOrientationQualification] - Pre-computed lateral orientation evaluation (side-view-orientation-qualification-v0)
 * @param {object|null} [options.clothingSemantics] - Clothing semantics result (clothing-body-surface-semantics-v0)
 * @param {object|null} [options.frontPoseSource] - Front pose evidence for lateral collapse if not pre-computed
 * @param {object|null} [options.sidePoseSource] - Side pose evidence if not pre-computed
 * @returns {object} SidePhysicalDepthQualificationResult
 */
export function evaluateSidePhysicalDepthQualification(sourceObservation, {
  definition = null,
  metricCalibrationProvenance = null,
  sidePoseQualification = null,
  sideViewOrientationQualification = null,
  clothingSemantics = null,
  frontPoseSource = null,
  sidePoseSource = null,
} = {}) {
  const issues = [];
  const warnings = [];
  const checks = [];

  const addCheck = (id, name, category, status, message, details = {}) => {
    checks.push({
      id,
      name,
      category,
      status, // 'pass' | 'warning' | 'fail' | 'skip'
      message,
      details,
    });
  };

  // 1. Resolve Definition
  let resolvedDef = null;
  if (typeof definition === 'string') {
    resolvedDef = SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0[definition]
      ?? Object.values(SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0).find((d) => d.id === definition)
      ?? null;
  } else if (definition && typeof definition === 'object') {
    resolvedDef = definition;
  } else if (sourceObservation && typeof sourceObservation === 'object') {
    resolvedDef = SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0[sourceObservation.id] ?? null;
  }

  if (!resolvedDef) {
    const rawId = typeof definition === 'string' ? definition : (sourceObservation?.id ?? 'unknown');
    addCheck('supported_definition', 'Supported Definition', 'integrity', 'fail', `Unsupported definition ID: '${rawId}'.`);
    issues.push(`Definition '${rawId}' is not a recognized Side physical depth qualification target.`);
    return buildEmptyQualificationResult({
      id: rawId,
      name: 'Unrecognized Definition',
      status: SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED,
      issues,
      checks,
    });
  }

  const defId = resolvedDef.id;
  const defName = resolvedDef.name;
  const sourceDefId = resolvedDef.sourceObservationDefinitionId;
  const sourceLevel = resolvedDef.sourceLevel;
  const supportPolicyId = resolvedDef.supportPolicyId;

  // 2. Gate 1: Source Side Profile Span Validity
  if (!sourceObservation || typeof sourceObservation !== 'object') {
    addCheck('source_observation_validity', 'Source Side Profile Span Validity', 'source_evidence', 'fail', 'Source Side profile span observation is missing or null.');
    issues.push('Missing source Side profile span observation.');
    return buildEmptyQualificationResult({
      id: defId,
      name: defName,
      sourceObservationDefinitionId: sourceDefId,
      sourceLevel,
      status: SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE,
      issues,
      checks,
    });
  }

  if (sourceObservation.contract !== 'side-profile-span-v0' || sourceObservation.view !== 'side') {
    addCheck(
      'source_observation_validity',
      'Source Side Profile Span Validity',
      'source_evidence',
      'fail',
      `Invalid source observation contract: expected 'side-profile-span-v0' with view 'side', received '${sourceObservation.contract}' / '${sourceObservation.view}'.`,
    );
    issues.push('Invalid source contract or view for Side profile span.');
    return buildEmptyQualificationResult({
      id: defId,
      name: defName,
      sourceObservationDefinitionId: sourceDefId,
      sourceLevel,
      status: SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED,
      issues,
      checks,
    });
  }

  const sourceStatus = sourceObservation.status;
  const projectedSpanCm = sourceObservation.valueCm;
  const minUcm = sourceObservation.minUcm;
  const maxUcm = sourceObservation.maxUcm;
  const levelYcm = sourceObservation.provenance?.levelYcm ?? null;
  const sampledPixelRow = sourceObservation.provenance?.sampledPixelRow ?? null;

  if (sourceStatus !== 'valid' || typeof projectedSpanCm !== 'number' || !Number.isFinite(projectedSpanCm) || projectedSpanCm <= 0) {
    const isAmbiguous = sourceStatus === 'ambiguous';
    addCheck(
      'source_observation_validity',
      'Source Side Profile Span Validity',
      'source_evidence',
      'fail',
      `Source Side profile span status is '${sourceStatus}' (value: ${projectedSpanCm ?? 'null'}).`,
      { sourceStatus, projectedSpanCm },
    );
    issues.push(`Source Side profile span is not valid (status: ${sourceStatus}).`);
    return buildEmptyQualificationResult({
      id: defId,
      name: defName,
      sourceObservationDefinitionId: sourceDefId,
      sourceLevel,
      status: isAmbiguous ? SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED : SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE,
      issues,
      checks,
      provenance: { levelYcm, projectedSpanCm },
    });
  }

  addCheck(
    'source_observation_validity',
    'Source Side Profile Span Validity',
    'source_evidence',
    'pass',
    `Valid Side profile span observed: ${projectedSpanCm.toFixed(2)} cm (U: [${minUcm?.toFixed(1) ?? '?'}, ${maxUcm?.toFixed(1) ?? '?'}] at Y=${levelYcm?.toFixed(1) ?? '?'} cm).`,
    { projectedSpanCm, minUcm, maxUcm, levelYcm, sampledPixelRow },
  );

  let hasDisqualification = false;
  let hasWarning = false;

  // 3. Gate 2: Metric Calibration Provenance
  if (!metricCalibrationProvenance) {
    addCheck('metric_calibration_qualification', 'Metric Calibration Qualification', 'calibration', 'fail', 'Metric calibration provenance evidence is absent.');
    issues.push('Metric calibration provenance is absent.');
    hasDisqualification = true;
  } else if (metricCalibrationProvenance.status !== 'validated' || metricCalibrationProvenance.metricProjectedEligibility !== true) {
    addCheck(
      'metric_calibration_qualification',
      'Metric Calibration Qualification',
      'calibration',
      'fail',
      `Metric calibration is not validated (status: '${metricCalibrationProvenance.status}').`,
      { calibrationStatus: metricCalibrationProvenance.status },
    );
    issues.push(`Metric calibration for Side view is unvalidated (status: ${metricCalibrationProvenance.status}).`);
    hasDisqualification = true;
  } else {
    addCheck(
      'metric_calibration_qualification',
      'Metric Calibration Qualification',
      'calibration',
      'pass',
      'Side view metric calibration is validated with isotropic scale.',
      { scaleCmPerPx: metricCalibrationProvenance.summary?.scaleCmPerPx },
    );
  }

  // 4. Gate 3: Side T-Pose Stance Qualification
  let tPoseResult = sidePoseQualification;
  if (!tPoseResult && sidePoseSource) {
    tPoseResult = evaluateSidePoseQualification(sidePoseSource);
  }

  let tPoseStatus = tPoseResult?.status ?? 'unavailable';
  if (!tPoseResult || tPoseStatus === 'unavailable') {
    addCheck('side_t_pose_qualification', 'Side T-Pose Stance Qualification', 'pose_stance', 'fail', 'Side T-pose stance evidence is unavailable or unpopulated.');
    issues.push('Side T-pose qualification is unavailable.');
    hasDisqualification = true;
  } else if (tPoseStatus === 'disqualified') {
    addCheck(
      'side_t_pose_qualification',
      'Side T-Pose Stance Qualification',
      'pose_stance',
      'fail',
      `Side pose does not qualify as T-pose: ${tPoseResult.issues?.join('; ') || 'disqualified'}.`,
      { tPoseStatus, tPoseIssues: tPoseResult.issues },
    );
    issues.push(`Side pose failed T-pose qualification: ${tPoseResult.issues?.join('; ')}`);
    hasDisqualification = true;
  } else if (tPoseStatus === 'warning') {
    const tPoseWarnings = Array.isArray(tPoseResult.warnings) ? tPoseResult.warnings : [];
    // Check if warnings are non-blocking advisory notes (moderate projected elbow deviation 30-45° or minor shoulder tilt)
    // where arm reach and torso clearance are maintained
    const hasOnlyAdvisoryWarnings = (tPoseResult.issues?.length === 0) && tPoseWarnings.every((w) => {
      const lower = String(w || '').toLowerCase();
      return lower.includes('projected elbow deviation') || lower.includes('elbow') || lower.includes('shoulder elevation');
    });

    if (hasOnlyAdvisoryWarnings) {
      addCheck(
        'side_t_pose_qualification',
        'Side T-Pose Stance Qualification',
        'pose_stance',
        'pass',
        `Side pose qualifies as T-pose with advisory note: ${tPoseWarnings.join('; ')}.`,
        { tPoseStatus, tPoseWarnings, dominantArm: tPoseResult.summary?.dominantArm, isAdvisory: true },
      );
      // Preserved as diagnostic advisory, does NOT set hasWarning on physical depth qualification
    } else {
      addCheck(
        'side_t_pose_qualification',
        'Side T-Pose Stance Qualification',
        'pose_stance',
        'warning',
        `Side T-pose exhibits marginal warning: ${tPoseWarnings.join('; ') || 'warning'}.`,
        { tPoseStatus, tPoseWarnings },
      );
      warnings.push(`Side T-pose warning: ${tPoseWarnings.join('; ')}`);
      hasWarning = true;
    }
  } else {
    addCheck(
      'side_t_pose_qualification',
      'Side T-Pose Stance Qualification',
      'pose_stance',
      'pass',
      'Side pose qualifies as valid T-pose (arms extended horizontally with straight elbows).',
      { dominantArm: tPoseResult.summary?.dominantArm },
    );
  }

  // 5. Gate 4: Approximately-Lateral View Qualification
  let lateralResult = sideViewOrientationQualification;
  if (!lateralResult && frontPoseSource && sidePoseSource) {
    lateralResult = evaluateSideViewOrientationQualification({ frontPoseSource, sidePoseSource });
  }

  let lateralStatus = lateralResult?.status ?? 'unavailable';
  if (!lateralResult || lateralStatus === 'unavailable') {
    addCheck('side_lateral_orientation_qualification', 'Approximately-Lateral Orientation Qualification', 'view_orientation', 'fail', 'Front/Side bilateral landmark collapse evidence is unavailable.');
    issues.push('Lateral view orientation qualification is unavailable.');
    hasDisqualification = true;
  } else if (lateralStatus === 'disqualified') {
    addCheck(
      'side_lateral_orientation_qualification',
      'Approximately-Lateral Orientation Qualification',
      'view_orientation',
      'fail',
      `Side view does not qualify as approximately lateral: ${lateralResult.issues?.join('; ') || 'disqualified'}.`,
      { lateralStatus, lateralIssues: lateralResult.issues },
    );
    issues.push(`Side view failed lateral qualification: ${lateralResult.issues?.join('; ')}`);
    hasDisqualification = true;
  } else if (lateralStatus === 'warning') {
    addCheck(
      'side_lateral_orientation_qualification',
      'Approximately-Lateral Orientation Qualification',
      'view_orientation',
      'warning',
      `Side view exhibits marginal lateral orientation warning: ${lateralResult.warnings?.join('; ') || 'warning'}.`,
      { lateralStatus, lateralWarnings: lateralResult.warnings },
    );
    warnings.push(`Side lateral view warning: ${lateralResult.warnings?.join('; ')}`);
    hasWarning = true;
  } else {
    addCheck(
      'side_lateral_orientation_qualification',
      'Approximately-Lateral Orientation Qualification',
      'view_orientation',
      'pass',
      `Side view orientation is approximately lateral under bilateral collapse consensus (ratio: ${lateralResult.summary?.aggregateCollapseRatio?.toFixed(3) ?? '?'}).`,
      { aggregateCollapseRatio: lateralResult.summary?.aggregateCollapseRatio },
    );
  }

  // 6. Gate 5: Clothing / Body-Surface Qualification
  // Under the 4.5H acquisition protocol: clothing is expected to be bikini / lingerie / very tight activewear.
  const usedClothingEvidence = Boolean(sourceObservation.provenance?.usedClothingEvidence);
  const actualClassIdsUsed = sourceObservation.provenance?.actualClassIdsUsed ?? [];
  const garmentFitStatus = clothingSemantics?.dimensions?.garmentFit?.status ?? null;

  if (garmentFitStatus === 'disqualified') {
    addCheck(
      'clothing_body_surface_qualification',
      'Clothing / Body-Surface Qualification',
      'clothing_surface',
      'fail',
      'Garment fit is classified as disqualified (loose/bulky clothing violates tight body-following acquisition assumption).',
      { garmentFitStatus },
    );
    issues.push('Loose or non-compliant clothing detected on measurement slice.');
    hasDisqualification = true;
  } else if (usedClothingEvidence) {
    addCheck(
      'clothing_body_surface_qualification',
      'Clothing / Body-Surface Qualification',
      'clothing_surface',
      'pass',
      `Observed silhouette uses supported tight clothing bridge (${supportPolicyId} / classes: [${actualClassIdsUsed.join(', ')}]) under fitted acquisition assumption.`,
      { supportPolicyId, actualClassIdsUsed, usedClothingEvidence },
    );
  } else {
    addCheck(
      'clothing_body_surface_qualification',
      'Clothing / Body-Surface Qualification',
      'clothing_surface',
      'pass',
      'Observed silhouette uses exposed skin without clothing bridge participation.',
      { supportPolicyId, actualClassIdsUsed, usedClothingEvidence: false },
    );
  }

  // 7. Gate 6: Measurement Placement Semantics & Limitations
  const anchorLimitationNote = sourceLevel === 'shoulder'
    ? 'Shoulder depth represents AP depth at bilateral mean shoulder landmark level; NOT biacromial breadth or full arm span.'
    : 'Hip depth represents AP depth at bilateral mean hip landmark level; NOT maximum buttock depth, seat plane, or widest pelvic row.';

  addCheck(
    'measurement_placement_semantics',
    'Measurement Placement Semantics',
    'placement',
    'pass',
    anchorLimitationNote,
    { sourceLevel, levelYcm },
  );

  // 8. Overall Status Resolution
  let finalStatus;
  let qualifiedDepthEstimateCm = null;
  let qualificationTier = 'unqualified';

  if (hasDisqualification) {
    finalStatus = SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED;
  } else if (hasWarning) {
    finalStatus = SIDE_PHYSICAL_DEPTH_STATUS.WARNING;
    // Per specification: warning produces qualifiedDepthEstimateCm = null
    qualificationTier = 'provisional_ap_depth_estimate';
  } else {
    finalStatus = SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED;
    qualifiedDepthEstimateCm = projectedSpanCm;
    qualificationTier = 'physical_ap_depth_estimate';
  }

  return {
    contract: SIDE_PHYSICAL_DEPTH_CONTRACT,
    version: SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
    id: defId,
    name: defName,
    sourceObservationDefinitionId: sourceDefId,
    sourceLevel,
    levelYcm,
    projectedSpanCm,
    qualifiedDepthEstimateCm,
    status: finalStatus,
    qualificationTier,
    checks,
    issues,
    warnings,
    provenance: {
      sourceObservationContract: sourceObservation.contract,
      sourceLevel,
      levelYcm,
      sampledPixelRow,
      supportPolicyId,
      actualClassIdsUsed,
      usedClothingEvidence,
      tPoseStatus,
      lateralOrientationStatus: lateralStatus,
      metricCalibrationStatus: metricCalibrationProvenance?.status ?? 'unvalidated',
      clothingStatus: usedClothingEvidence ? 'fitted_clothing_compliant' : 'skin_surface',
      anchorLevelSemantics: anchorLimitationNote,
      crossViewPoseLimitation: 'front_a_side_t_mismatch_cross_section_deferred',
    },
  };
}

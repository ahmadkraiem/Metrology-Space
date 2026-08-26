/**
 * Arbitrary-Y Side Physical Depth Qualification Contract v0
 *
 * Pure deterministic domain contract that qualifies whether a Side pelvic profile span
 * observation at an arbitrary candidate vertical coordinate Y (cm) can be interpreted
 * as a qualified Side-derived physical anterior-posterior (AP) depth estimate.
 *
 * Contract: 'arbitrary-y-side-physical-depth-qualification-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Pure generalization: evaluates the exact same 6 qualification gates as named-level
 *   sidePhysicalDepthQualification (source evidence validity, metric calibration, T-pose
 *   stance, approximately-lateral orientation, clothing fit, placement semantics) without
 *   requiring or injecting fake static registry definitions.
 * - Side U remains a 2D profile coordinate in Side Metrology space. U is NOT canonical Z.
 * - The result is a qualified Side-derived physical AP depth estimate from calibrated
 *   approximately-lateral Side profile evidence, NOT reconstructed 3D geometry or spatial fusion.
 * - No synthetic clothing thickness offsets or garment deductions are applied.
 * - No circumference or 3D contour is calculated by this contract.
 */

export const ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT = 'arbitrary-y-side-physical-depth-qualification-v0';
export const ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION = 'arbitrary-y-side-physical-depth-qualification-v0';

/**
 * Authoritative qualification status taxonomy.
 * @type {Readonly<{
 *   QUALIFIED: 'qualified',
 *   WARNING: 'warning',
 *   DISQUALIFIED: 'disqualified',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS = Object.freeze({
  QUALIFIED: 'qualified',
  WARNING: 'warning',
  DISQUALIFIED: 'disqualified',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Builds an empty or fallback qualification record.
 */
function buildEmptyArbitraryYQualificationResult({
  yCm = null,
  rasterRow = null,
  profileSpanCm = null,
  supportPolicyId = 'pelvic_core_support_v0',
  status = ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE,
  issues = [],
  warnings = [],
  checks = [],
  provenance = {},
} = {}) {
  return {
    contract: ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT,
    version: ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
    yCm,
    rasterRow,
    profileSpanCm,
    qualifiedApDepthCm: null,
    status,
    isQualified: status === ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED
      || status === ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.WARNING,
    qualificationTier: status === ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED
      || status === ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.WARNING
      ? 'physical_ap_depth_estimate'
      : 'unqualified',
    supportPolicyId,
    checks,
    issues,
    warnings,
    provenance: {
      ...provenance,
      isArbitraryY: true,
      crossViewPoseLimitation: 'front_a_side_t_mismatch_cross_section_deferred',
    },
    semantics: {
      statement: 'Arbitrary-Y Side-derived physical AP depth estimate from calibrated approximately-lateral Side profile evidence. NOT canonical Z, NOT reconstructed 3D geometry, NOT Front/Side coordinate fusion, NOT circumference.',
      isCanonicalZ: false,
      is3dReconstruction: false,
      isFrontSideFusion: false,
      isCircumference: false,
      isArbitraryY: true,
    },
  };
}

/**
 * Evaluates pure deterministic physical AP depth qualification for a Side profile span
 * at an arbitrary candidate Y coordinate.
 *
 * @param {object|null|undefined} sideObservation - Candidate Side profile evidence or slice
 * @param {{
 *   metricCalibrationProvenance?: object|null,
 *   sidePoseQualification?: object|null,
 *   sideViewOrientationQualification?: object|null,
 *   clothingSemantics?: object|null,
 *   yCm?: number|null,
 *   rasterRow?: number|null,
 *   supportPolicyId?: string,
 * }} [options]
 * @returns {object} ArbitraryYSidePhysicalDepthQualificationResultV0
 */
export function evaluateArbitraryYSidePhysicalDepthQualification(sideObservation, {
  metricCalibrationProvenance = null,
  sidePoseQualification = null,
  sideViewOrientationQualification = null,
  clothingSemantics = null,
  yCm = null,
  rasterRow = null,
  supportPolicyId = 'pelvic_core_support_v0',
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

  // 1. Resolve Candidate Coordinates & Span
  const candidateYcm = typeof sideObservation?.yCm === 'number' && Number.isFinite(sideObservation.yCm)
    ? sideObservation.yCm
    : (typeof yCm === 'number' && Number.isFinite(yCm) ? yCm : (sideObservation?.provenance?.levelYcm ?? null));

  const candidateRow = typeof sideObservation?.rasterRow === 'number' && Number.isInteger(sideObservation.rasterRow)
    ? sideObservation.rasterRow
    : (typeof rasterRow === 'number' && Number.isInteger(rasterRow) ? rasterRow : (sideObservation?.provenance?.sampledPixelRow ?? null));

  // 2. Gate 1: Source Side Profile Span Evidence Validity
  if (!sideObservation || typeof sideObservation !== 'object') {
    addCheck('source_observation_validity', 'Source Side Profile Span Validity', 'source_evidence', 'fail', 'Source Side profile observation is missing or null.');
    issues.push('Missing source Side profile observation.');
    return buildEmptyArbitraryYQualificationResult({
      yCm: candidateYcm,
      rasterRow: candidateRow,
      supportPolicyId,
      status: ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE,
      issues,
      checks,
    });
  }

  const rawSpan = sideObservation.profileSpanCm ?? sideObservation.valueCm ?? null;
  const isSingleRun = sideObservation.isSingleSupportedRun === true
    || (sideObservation.runCount === 1 && typeof rawSpan === 'number' && rawSpan > 0)
    || (sideObservation.status === 'valid' && typeof rawSpan === 'number' && rawSpan > 0);

  const minUcm = sideObservation.minUcm ?? null;
  const maxUcm = sideObservation.maxUcm ?? null;
  const runCount = typeof sideObservation.runCount === 'number' ? sideObservation.runCount : (isSingleRun ? 1 : 0);
  const sideStatus = sideObservation.status ?? (isSingleRun ? 'valid' : 'ambiguous');

  if (!isSingleRun || typeof rawSpan !== 'number' || !Number.isFinite(rawSpan) || rawSpan <= 0) {
    const isAmbiguous = runCount > 1 || sideStatus === 'ambiguous';
    addCheck(
      'source_observation_validity',
      'Source Side Profile Span Validity',
      'source_evidence',
      'fail',
      `Source Side profile span status is '${sideStatus}' (runs: ${runCount}, span: ${rawSpan ?? 'null'}).`,
      { sideStatus, runCount, rawSpan },
    );
    issues.push(`Source Side profile span is not a valid single run (status: ${sideStatus}, runCount: ${runCount}).`);
    return buildEmptyArbitraryYQualificationResult({
      yCm: candidateYcm,
      rasterRow: candidateRow,
      profileSpanCm: typeof rawSpan === 'number' && Number.isFinite(rawSpan) ? rawSpan : null,
      supportPolicyId,
      status: isAmbiguous ? ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED : ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE,
      issues,
      checks,
      provenance: { minUcm, maxUcm, runCount, sideStatus },
    });
  }

  addCheck(
    'source_observation_validity',
    'Source Side Profile Span Validity',
    'source_evidence',
    'pass',
    `Valid single-run Side profile span observed: ${rawSpan.toFixed(2)} cm (U: [${minUcm?.toFixed(1) ?? '?'}, ${maxUcm?.toFixed(1) ?? '?'}] at Y=${candidateYcm?.toFixed(1) ?? '?'} cm, row ${candidateRow ?? '?'}).`,
    { profileSpanCm: rawSpan, minUcm, maxUcm, yCm: candidateYcm, rasterRow: candidateRow },
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
      { scaleCmPerPx: metricCalibrationProvenance.summary?.scaleCmPerPx ?? metricCalibrationProvenance.scaleCmPerPx },
    );
  }

  // 4. Gate 3: Side T-Pose Stance Qualification
  const tPoseStatus = sidePoseQualification?.status ?? 'unavailable';
  if (!sidePoseQualification || tPoseStatus === 'unavailable') {
    addCheck('side_t_pose_qualification', 'Side T-Pose Stance Qualification', 'pose_stance', 'fail', 'Side T-pose stance evidence is unavailable or unpopulated.');
    issues.push('Side T-pose qualification is unavailable.');
    hasDisqualification = true;
  } else if (tPoseStatus === 'disqualified') {
    addCheck(
      'side_t_pose_qualification',
      'Side T-Pose Stance Qualification',
      'pose_stance',
      'fail',
      `Side pose does not qualify as T-pose: ${sidePoseQualification.issues?.join('; ') || 'disqualified'}.`,
      { tPoseStatus, tPoseIssues: sidePoseQualification.issues },
    );
    issues.push(`Side pose failed T-pose qualification: ${sidePoseQualification.issues?.join('; ')}`);
    hasDisqualification = true;
  } else if (tPoseStatus === 'warning') {
    const tPoseWarnings = Array.isArray(sidePoseQualification.warnings) ? sidePoseQualification.warnings : [];
    const hasOnlyAdvisoryWarnings = (sidePoseQualification.issues?.length === 0) && tPoseWarnings.every((w) => {
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
        { tPoseStatus, tPoseWarnings, isAdvisory: true },
      );
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
      { dominantArm: sidePoseQualification.summary?.dominantArm },
    );
  }

  // 5. Gate 4: Approximately-Lateral View Orientation Qualification
  const lateralStatus = sideViewOrientationQualification?.status ?? 'unavailable';
  if (!sideViewOrientationQualification || lateralStatus === 'unavailable') {
    addCheck('side_lateral_orientation_qualification', 'Approximately-Lateral Orientation Qualification', 'view_orientation', 'fail', 'Front/Side bilateral landmark collapse evidence is unavailable.');
    issues.push('Lateral view orientation qualification is unavailable.');
    hasDisqualification = true;
  } else if (lateralStatus === 'disqualified') {
    addCheck(
      'side_lateral_orientation_qualification',
      'Approximately-Lateral Orientation Qualification',
      'view_orientation',
      'fail',
      `Side view does not qualify as approximately lateral: ${sideViewOrientationQualification.issues?.join('; ') || 'disqualified'}.`,
      { lateralStatus, lateralIssues: sideViewOrientationQualification.issues },
    );
    issues.push(`Side view failed lateral qualification: ${sideViewOrientationQualification.issues?.join('; ')}`);
    hasDisqualification = true;
  } else if (lateralStatus === 'warning') {
    addCheck(
      'side_lateral_orientation_qualification',
      'Approximately-Lateral Orientation Qualification',
      'view_orientation',
      'warning',
      `Side view exhibits marginal lateral orientation warning: ${sideViewOrientationQualification.warnings?.join('; ') || 'warning'}.`,
      { lateralStatus, lateralWarnings: sideViewOrientationQualification.warnings },
    );
    warnings.push(`Side lateral view warning: ${sideViewOrientationQualification.warnings?.join('; ')}`);
    hasWarning = true;
  } else {
    addCheck(
      'side_lateral_orientation_qualification',
      'Approximately-Lateral Orientation Qualification',
      'view_orientation',
      'pass',
      `Side view orientation is approximately lateral under bilateral collapse consensus (ratio: ${sideViewOrientationQualification.summary?.aggregateCollapseRatio?.toFixed(3) ?? '?'}).`,
      { aggregateCollapseRatio: sideViewOrientationQualification.summary?.aggregateCollapseRatio },
    );
  }

  // 6. Gate 5: Clothing / Body-Surface Qualification
  const garmentFitStatus = clothingSemantics?.dimensions?.garmentFit?.status
    ?? clothingSemantics?.garmentQualification?.garmentFitStatus
    ?? null;
  const encounteredClassIds = sideObservation.encounteredClassIds ?? [];
  const usedClothingEvidence = encounteredClassIds.includes(13) || Boolean(sideObservation.usedClothingEvidence);

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
      `Observed silhouette uses supported tight clothing bridge (${supportPolicyId} / classes: [${encounteredClassIds.join(', ')}]) under fitted acquisition assumption. Zero offset applied.`,
      { supportPolicyId, encounteredClassIds, usedClothingEvidence: true },
    );
  } else {
    addCheck(
      'clothing_body_surface_qualification',
      'Clothing / Body-Surface Qualification',
      'clothing_surface',
      'pass',
      'Observed silhouette uses exposed skin without clothing bridge participation. Zero offset applied.',
      { supportPolicyId, encounteredClassIds, usedClothingEvidence: false },
    );
  }

  // 7. Gate 6: Arbitrary-Y Placement Semantics & Limitations
  addCheck(
    'measurement_placement_semantics',
    'Measurement Placement Semantics',
    'placement',
    'pass',
    `Arbitrary-Y candidate level Y=${candidateYcm?.toFixed(2) ?? '?'} cm (raster row ${candidateRow ?? '?'}) under ${supportPolicyId}. Evaluated as Side-derived AP depth estimate; NOT canonical Z.`,
    { candidateYcm, candidateRow, supportPolicyId },
  );

  // 8. Overall Status Resolution
  let finalStatus;
  let qualifiedDepthEstimateCm = null;
  let isQualified = false;
  let qualificationTier = 'unqualified';

  if (hasDisqualification) {
    finalStatus = ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED;
  } else if (hasWarning) {
    finalStatus = ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.WARNING;
    qualifiedDepthEstimateCm = Number(rawSpan.toFixed(4));
    isQualified = true;
    qualificationTier = 'physical_ap_depth_estimate';
  } else {
    finalStatus = ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED;
    qualifiedDepthEstimateCm = Number(rawSpan.toFixed(4));
    isQualified = true;
    qualificationTier = 'physical_ap_depth_estimate';
  }

  return {
    contract: ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT,
    version: ARBITRARY_Y_SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
    yCm: candidateYcm,
    rasterRow: candidateRow,
    profileSpanCm: Number(rawSpan.toFixed(4)),
    qualifiedApDepthCm: qualifiedDepthEstimateCm,
    status: finalStatus,
    isQualified,
    qualificationTier,
    supportPolicyId,
    checks,
    issues,
    warnings,
    provenance: {
      minUcm: typeof minUcm === 'number' ? Number(minUcm.toFixed(4)) : null,
      maxUcm: typeof maxUcm === 'number' ? Number(maxUcm.toFixed(4)) : null,
      runCount,
      encounteredClassIds,
      usedClothingEvidence,
      isArbitraryY: true,
      scaleCmPerPx: metricCalibrationProvenance?.summary?.scaleCmPerPx ?? metricCalibrationProvenance?.scaleCmPerPx ?? null,
      lateralCollapseRatio: sideViewOrientationQualification?.summary?.aggregateCollapseRatio ?? null,
      dominantArm: sidePoseQualification?.summary?.dominantArm ?? null,
      crossViewPoseLimitation: 'front_a_side_t_mismatch_cross_section_deferred',
    },
    semantics: {
      statement: 'Arbitrary-Y Side-derived physical AP depth estimate from calibrated approximately-lateral Side profile evidence. NOT canonical Z, NOT reconstructed 3D geometry, NOT Front/Side coordinate fusion, NOT circumference.',
      isCanonicalZ: false,
      is3dReconstruction: false,
      isFrontSideFusion: false,
      isCircumference: false,
      isArbitraryY: true,
    },
  };
}

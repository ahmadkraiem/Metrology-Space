/**
 * Modeled Bust Circumference Contract v0
 *
 * Pure deterministic domain contract that evaluates the Modeled Bust Circumference
 * estimate from an already-localized Bust Apex Plane candidate.
 *
 * Contract: 'modeled-bust-circumference-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Authoritative apex plane: consumes the output of 'bust-apex-plane-localization-v0'
 *   without independently relocalizing, rescanning rasters, or averaging candidate Ys.
 * - Deterministic ellipse model: evaluates the Ramanujan II ellipse perimeter approximation
 *   from calibrated Front transverse width (transverse diameter) and qualified Side physical AP
 *   depth (conjugate AP depth) at the exact same canonical Y.
 * - Strict Front-only rejection: Front-only localization (or unqualified Side depth)
 *   MUST NOT produce a modeled circumference. Qualified Side physical AP depth is mandatory.
 * - Strict semantic separation:
 *   - Modeled deterministic ellipse cross-sectional perimeter.
 *   - NOT tape-measured ground truth.
 *   - NOT a measured body contour.
 *   - NOT a reconstructed 3D circumference or dense-geometry perimeter.
 *   - NOT a pointmap-derived perimeter.
 *   - NOT normals-derived.
 *   - NOT body volume.
 *   - The ellipse is explicitly a modeling assumption.
 * - Zero Side U -> canonical Z conversion, zero pointmap/normal reads, zero dense fusion.
 */

import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

export const MODELED_BUST_CIRCUMFERENCE_CONTRACT = 'modeled-bust-circumference-v0';
export const MODELED_BUST_CIRCUMFERENCE_CONTRACT_VERSION = 'modeled-bust-circumference-v0';

export const MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID = 'torso_modeled_bust_circumference_at_bust_apex_plane';
export const MODELED_BUST_CIRCUMFERENCE_DISPLAY_NAME = 'Modeled Bust Circumference';

/**
 * Authoritative measurement status taxonomy.
 * @type {Readonly<{
 *   MODELED: 'modeled',
 *   UNAVAILABLE: 'unavailable',
 *   BLOCKED: 'blocked',
 *   INVALID: 'invalid',
 * }>}
 */
export const MODELED_BUST_CIRCUMFERENCE_STATUS = Object.freeze({
  MODELED: 'modeled',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Modeled Bust Circumference.
 * @type {Readonly<Record<string, string>>}
 */
export const MODELED_BUST_CIRCUMFERENCE_BLOCKERS = Object.freeze({
  BUST_APEX_PLANE_UNAVAILABLE: 'bust_apex_plane_unavailable',
  BUST_APEX_PLANE_AMBIGUOUS: 'bust_apex_plane_ambiguous',
  FRONT_WIDTH_INVALID: 'front_width_invalid',
  SIDE_AP_DEPTH_UNAVAILABLE: 'side_ap_depth_unavailable',
  SIDE_AP_DEPTH_NOT_QUALIFIED: 'side_ap_depth_not_qualified',
  SIDE_AP_DEPTH_INVALID: 'side_ap_depth_invalid',
  SAME_Y_MISMATCH: 'same_y_mismatch',
  MODELED_PERIMETER_INVALID: 'modeled_perimeter_invalid',
  STRUCTURAL_CONTRACT_INVALID: 'structural_contract_invalid',
});

/**
 * Builds an empty or unavailable modeled bust circumference record.
 */
function buildEmptyModeledBustCircumference({
  status = MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  levelYcm = null,
  sourcePlane = null,
  crossSectionEvidence = null,
  provenance = null,
} = {}) {
  return {
    contract: MODELED_BUST_CIRCUMFERENCE_CONTRACT,
    version: MODELED_BUST_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_BUST_CIRCUMFERENCE_DISPLAY_NAME,
    status,
    isModeled: status === MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED,
    isQualified: status === MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED,
    valueCm: null,
    yCm: levelYcm,
    levelYcm,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      semiMajorAxisCm: null,
      semiMinorAxisCm: null,
      transverseWidthCm: null,
      apDepthCm: null,
      frontDiameterCm: null,
      sideDiameterCm: null,
      hParameter: null,
    },
    sourcePlane: sourcePlane ?? {
      contract: 'bust-apex-plane-localization-v0',
      yCm: levelYcm,
      status: 'unavailable',
    },
    crossSectionEvidence,
    provenance,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Bust Circumference at localized Bust Apex Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT dense-geometry perimeter, NOT pointmap-derived perimeter, NOT body volume.',
      isModeled: true,
      isModeledEstimate: true,
      isEstimatedCircumference: true,
      isMeasuredContour: false,
      isTapeMeasuredGroundTruth: false,
      is3dReconstruction: false,
      isBodyVolume: false,
      isValidatedAgainstGroundTruth: false,
    },
  };
}

/**
 * Evaluates pure deterministic Modeled Bust Circumference from a
 * Bust Apex Plane Localization result.
 *
 * @param {object|null|undefined} bustApexPlaneLocalization - Result of evaluateBustApexPlaneLocalization
 * @param {object} [options]
 * @returns {object} ModeledBustCircumferenceResultV0
 */
export function evaluateModeledBustCircumference(bustApexPlaneLocalization, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  // Gate 1 — Input availability
  if (!bustApexPlaneLocalization || typeof bustApexPlaneLocalization !== 'object') {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE);
    issues.push('Bust Apex Plane localization report is missing or null.');
    return buildEmptyModeledBustCircumference({
      status: MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  // Gate 2 — Structural contract validity
  if (
    bustApexPlaneLocalization.contract
    && bustApexPlaneLocalization.contract !== 'bust-apex-plane-localization-v0'
  ) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);
    issues.push(`Invalid localization contract: expected 'bust-apex-plane-localization-v0', received '${bustApexPlaneLocalization.contract}'.`);
    return buildEmptyModeledBustCircumference({
      status: MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings,
      issues,
    });
  }

  // Gate 3 — Localization state
  const localizationStatus = bustApexPlaneLocalization.status;
  const isReady = localizationStatus === 'ready';

  if (localizationStatus === 'ambiguous') {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_AMBIGUOUS);
    issues.push('Bust Apex Plane localization status is ambiguous; cannot compute modeled circumference without a unique localized plane.');
    return buildEmptyModeledBustCircumference({
      status: MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings: bustApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm: bustApexPlaneLocalization.yCm ?? null,
      sourcePlane: {
        contract: bustApexPlaneLocalization.contract ?? 'bust-apex-plane-localization-v0',
        yCm: bustApexPlaneLocalization.yCm ?? null,
        status: localizationStatus,
      },
    });
  }

  if (!isReady || !bustApexPlaneLocalization.selectedPeak) {
    const isInvalid = localizationStatus === 'invalid';
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE);
    issues.push(`Bust Apex Plane localization status is '${localizationStatus}' (not ready).`);
    return buildEmptyModeledBustCircumference({
      status: isInvalid
        ? MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID
        : MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings: bustApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm: bustApexPlaneLocalization.yCm ?? null,
      sourcePlane: {
        contract: bustApexPlaneLocalization.contract ?? 'bust-apex-plane-localization-v0',
        yCm: bustApexPlaneLocalization.yCm ?? null,
        status: localizationStatus,
      },
    });
  }

  const selectedPeak = bustApexPlaneLocalization.selectedPeak;
  const levelYcm = bustApexPlaneLocalization.yCm ?? selectedPeak.yCm;

  // Validate Level Y
  if (typeof levelYcm !== 'number' || !Number.isFinite(levelYcm) || levelYcm <= 0) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE);
    issues.push(`Bust Apex Plane level Y is invalid or non-positive (${levelYcm ?? 'null'}).`);
    return buildEmptyModeledBustCircumference({
      status: MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings,
      issues,
      levelYcm,
    });
  }

  // Cross-validate selectedPeak Y vs localization Y
  if (typeof selectedPeak.yCm === 'number' && Math.abs(selectedPeak.yCm - levelYcm) > 1e-4) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH);
    issues.push(`Same-Y mismatch: localized plane Y (${levelYcm}) does not match selectedPeak Y (${selectedPeak.yCm}).`);
  }

  // Gate 4 — Front Width Gate
  const frontEvidence = bustApexPlaneLocalization.frontEvidence;
  const frontWidthCm = frontEvidence?.widthCm ?? selectedPeak.frontWidthCm ?? null;
  const frontMinXcm = frontEvidence?.minXcm ?? selectedPeak.frontMinXcm ?? null;
  const frontMaxXcm = frontEvidence?.maxXcm ?? selectedPeak.frontMaxXcm ?? null;

  // Cross-validate frontEvidence vs selectedPeak duplicate fields if both present
  if (
    typeof frontEvidence?.widthCm === 'number'
    && typeof selectedPeak.frontWidthCm === 'number'
    && Math.abs(frontEvidence.widthCm - selectedPeak.frontWidthCm) > 1e-4
  ) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);
    issues.push(`Structural inconsistency: frontEvidence width (${frontEvidence.widthCm}) disagrees with selectedPeak frontWidthCm (${selectedPeak.frontWidthCm}).`);
  }

  const hasValidFrontEndpoints = typeof frontMinXcm === 'number' && Number.isFinite(frontMinXcm)
    && typeof frontMaxXcm === 'number' && Number.isFinite(frontMaxXcm)
    && frontMinXcm < frontMaxXcm;

  const hasValidFrontWidth = typeof frontWidthCm === 'number' && Number.isFinite(frontWidthCm) && frontWidthCm > 0 && hasValidFrontEndpoints;

  const isFrontSingleRun = frontEvidence?.runCount === undefined || frontEvidence?.runCount === null || frontEvidence.runCount === 1;
  const isFrontSingleSupportedRun = frontEvidence?.isSingleSupportedRun === undefined || frontEvidence?.isSingleSupportedRun === null || frontEvidence.isSingleSupportedRun === true;
  const isFrontStatusValid = !frontEvidence?.status || frontEvidence.status === 'valid';

  if (!hasValidFrontWidth || !isFrontSingleRun || !isFrontSingleSupportedRun || !isFrontStatusValid) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID);
    issues.push(`Front transverse width at Bust Apex Plane is invalid, malformed, non-positive, or multi-run (width: ${frontWidthCm ?? 'null'}, minX: ${frontMinXcm ?? 'null'}, maxX: ${frontMaxXcm ?? 'null'}, runCount: ${frontEvidence?.runCount ?? 'null'}).`);
  }

  // Gate 5 — Side AP Depth Gate (MANDATORY GATE: Front-only or unqualified depth MUST NOT produce circumference)
  const sideEvidence = bustApexPlaneLocalization.sideEvidence;
  const rawSideQualifiedApDepth = sideEvidence?.qualifiedApDepthCm ?? selectedPeak.qualifiedApDepthCm ?? null;

  // Cross-validate sideEvidence vs selectedPeak duplicate fields if both present
  if (
    typeof sideEvidence?.qualifiedApDepthCm === 'number'
    && typeof selectedPeak.qualifiedApDepthCm === 'number'
    && Math.abs(sideEvidence.qualifiedApDepthCm - selectedPeak.qualifiedApDepthCm) > 1e-4
  ) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);
    issues.push(`Structural inconsistency: sideEvidence qualified depth (${sideEvidence.qualifiedApDepthCm}) disagrees with selectedPeak qualifiedApDepthCm (${selectedPeak.qualifiedApDepthCm}).`);
  }

  const isSideAbsent = !sideEvidence
    || sideEvidence.status === 'unavailable'
    || (selectedPeak.sideProfileSpanCm === null && selectedPeak.qualifiedApDepthCm === null && (sideEvidence?.qualifiedApDepthCm === null || sideEvidence?.qualifiedApDepthCm === undefined));

  const sideMinUcm = sideEvidence?.minUcm ?? selectedPeak.sideMinUcm ?? null;
  const sideMaxUcm = sideEvidence?.maxUcm ?? selectedPeak.sideMaxUcm ?? null;

  let isSideQualified = false;
  let sideQualifiedApDepthCm = null;

  if (isSideAbsent) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE);
    issues.push('Side evidence is unavailable at Bust Apex Plane. Front-only localization cannot produce a modeled circumference.');
  } else if (
    rawSideQualifiedApDepth !== null
    && (typeof rawSideQualifiedApDepth !== 'number' || !Number.isFinite(rawSideQualifiedApDepth) || rawSideQualifiedApDepth <= 0)
  ) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Qualified Side AP depth at Bust Apex Plane is malformed or non-positive (${rawSideQualifiedApDepth}).`);
  } else if (
    typeof sideMinUcm === 'number'
    && typeof sideMaxUcm === 'number'
    && sideMinUcm >= sideMaxUcm
  ) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Side profile endpoints are malformed (minU: ${sideMinUcm}, maxU: ${sideMaxUcm}).`);
  } else if (
    (sideEvidence?.isQualified === true || selectedPeak.isSideDepthQualified === true)
    && typeof rawSideQualifiedApDepth === 'number'
    && rawSideQualifiedApDepth > 0
  ) {
    isSideQualified = true;
    sideQualifiedApDepthCm = rawSideQualifiedApDepth;
  } else {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED);
    issues.push(`Side physical AP depth at Bust Apex Plane is not qualified (status: '${sideEvidence?.depthQualificationStatus ?? sideEvidence?.status ?? 'unqualified'}'). Raw profile span cannot be used as physical depth.`);
  }

  // Gate 6 — Same-Y Consistency Verification
  const highlightY = bustApexPlaneLocalization.provenance?.sliceHighlightCoordinates?.yCm;
  if (typeof highlightY === 'number' && Math.abs(highlightY - levelYcm) > 1e-4) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH);
    issues.push(`Same-Y mismatch: localized plane Y (${levelYcm}) does not match slice coordinate Y (${highlightY}).`);
  }

  const sourcePlaneRecord = {
    contract: bustApexPlaneLocalization.contract ?? 'bust-apex-plane-localization-v0',
    yCm: levelYcm,
    status: localizationStatus,
    rasterRow: selectedPeak.rasterRow ?? bustApexPlaneLocalization.rasterRow ?? null,
    sideRasterRow: selectedPeak.sideRasterRow ?? bustApexPlaneLocalization.sideRasterRow ?? null,
    selectionMethod: bustApexPlaneLocalization.selectionMethod ?? null,
  };

  const crossSectionEvidenceRecord = {
    contract: 'bust-cross-section-evidence-v0',
    version: 'bust-cross-section-evidence-v0',
    yCm: levelYcm,
    status: (hasValidFrontWidth && isSideQualified && blockers.length === 0) ? 'qualified' : 'unqualified',
    isQualified: hasValidFrontWidth && isSideQualified && blockers.length === 0,
    supportPolicyId: bustApexPlaneLocalization.provenance?.supportPolicyId ?? 'trunk_core_support_v0',
    targetClassIds: [...(bustApexPlaneLocalization.provenance?.targetClassIds ?? [22, 23])],
    front: {
      transverseWidthCm: frontWidthCm,
      minXcm: frontMinXcm,
      maxXcm: frontMaxXcm,
      rasterRow: selectedPeak.rasterRow ?? bustApexPlaneLocalization.rasterRow ?? null,
      status: frontEvidence?.status ?? 'valid',
      runCount: frontEvidence?.runCount ?? 1,
      isSingleSupportedRun: frontEvidence?.isSingleSupportedRun ?? true,
      encounteredClassIds: [...(frontEvidence?.encounteredClassIds ?? selectedPeak.encounteredFrontClassIds ?? [])],
    },
    side: {
      qualifiedApDepthCm: typeof sideQualifiedApDepthCm === 'number' && Number.isFinite(sideQualifiedApDepthCm) ? sideQualifiedApDepthCm : null,
      rawProfileSpanCm: sideEvidence?.profileSpanCm ?? selectedPeak.sideProfileSpanCm ?? null,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      rasterRow: selectedPeak.sideRasterRow ?? bustApexPlaneLocalization.sideRasterRow ?? null,
      depthQualificationStatus: sideEvidence?.depthQualificationStatus ?? (isSideQualified ? 'qualified' : 'unqualified'),
      isQualified: Boolean(isSideQualified),
      encounteredClassIds: [...(sideEvidence?.encounteredClassIds ?? selectedPeak.encounteredSideClassIds ?? [])],
    },
    sameYConsistency: {
      yCm: levelYcm,
      isConsistent: !blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH),
    },
  };

  // If any blockers exist, return empty/blocked/invalid result
  if (blockers.length > 0) {
    const isInvalid = blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID)
      || blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH)
      || blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID)
      || blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);

    const isUnavailable = blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE)
      || blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE);

    const fallbackStatus = isInvalid
      ? MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID
      : (isUnavailable ? MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE : MODELED_BUST_CIRCUMFERENCE_STATUS.BLOCKED);

    return buildEmptyModeledBustCircumference({
      status: fallbackStatus,
      blockers,
      warnings: bustApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm,
      sourcePlane: sourcePlaneRecord,
      crossSectionEvidence: crossSectionEvidenceRecord,
      provenance: {
        selectedYcm: levelYcm,
        supportPolicyId: bustApexPlaneLocalization.provenance?.supportPolicyId ?? 'trunk_core_support_v0',
        targetClassIds: [...(bustApexPlaneLocalization.provenance?.targetClassIds ?? [22, 23])],
        sourceLocalizationContract: bustApexPlaneLocalization.contract ?? 'bust-apex-plane-localization-v0',
        sourceLocalizationStatus: localizationStatus,
      },
    });
  }

  // Gate 7 — Evaluate Ramanujan II Ellipse Perimeter
  const ellipseCalc = computeRamanujanEllipsePerimeter(frontWidthCm, sideQualifiedApDepthCm);
  if (!ellipseCalc || typeof ellipseCalc.perimeterCm !== 'number' || !Number.isFinite(ellipseCalc.perimeterCm) || ellipseCalc.perimeterCm <= 0) {
    blockers.push(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.MODELED_PERIMETER_INVALID);
    issues.push(`Failed to calculate Ramanujan II ellipse perimeter from Front width (${frontWidthCm}) and Side depth (${sideQualifiedApDepthCm}).`);
    return buildEmptyModeledBustCircumference({
      status: MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings: bustApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm,
      sourcePlane: sourcePlaneRecord,
      crossSectionEvidence: crossSectionEvidenceRecord,
    });
  }

  const valueCm = Number(ellipseCalc.perimeterCm.toFixed(4));
  const semiMajorAxisCm = Number(ellipseCalc.semiMajorAxisCm.toFixed(4));
  const semiMinorAxisCm = Number(ellipseCalc.semiMinorAxisCm.toFixed(4));
  const hParameter = Number(ellipseCalc.hParameter.toFixed(6));

  const inheritedWarnings = Array.isArray(bustApexPlaneLocalization.warnings)
    ? bustApexPlaneLocalization.warnings
    : [];

  const provenance = {
    measurementDefinitionId: MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID,
    selectedYcm: levelYcm,
    frontRasterRow: selectedPeak.rasterRow ?? bustApexPlaneLocalization.rasterRow ?? null,
    sideRasterRow: selectedPeak.sideRasterRow ?? bustApexPlaneLocalization.sideRasterRow ?? null,
    frontTransverseWidthCm: frontWidthCm,
    frontMinXcm,
    frontMaxXcm,
    sideRawProfileSpanCm: sideEvidence?.profileSpanCm ?? selectedPeak.sideProfileSpanCm ?? null,
    sideQualifiedApDepthCm,
    sideMinUcm,
    sideMaxUcm,
    prominenceCm: selectedPeak.prominenceCm ?? null,
    rawAnteriorUcm: selectedPeak.rawAnteriorUcm ?? null,
    smoothedAnteriorUcm: selectedPeak.smoothedAnteriorUcm ?? null,
    baselineUcm: selectedPeak.baselineUcm ?? null,
    shoulderAnchorYcm: bustApexPlaneLocalization.provenance?.shoulderYcm ?? null,
    offsetBelowShoulderCm: bustApexPlaneLocalization.provenance?.offsetBelowShoulderCm ?? null,
    naturalWaistSuperiorCrestYcm: bustApexPlaneLocalization.provenance?.naturalWaistSuperiorCrestYcm ?? null,
    elevationAboveWaistCrestCm: bustApexPlaneLocalization.provenance?.elevationAboveWaistCrestCm ?? null,
    supportPolicyId: bustApexPlaneLocalization.provenance?.supportPolicyId ?? 'trunk_core_support_v0',
    targetClassIds: [...(bustApexPlaneLocalization.provenance?.targetClassIds ?? [22, 23])],
    sourceScanContract: bustApexPlaneLocalization.provenance?.sourceScanContract ?? 'torso-arbitrary-y-evidence-scan-v0',
    sourceLocalizationContract: bustApexPlaneLocalization.contract ?? 'bust-apex-plane-localization-v0',
    sourceLocalizationStatus: localizationStatus,
    encounteredFrontClassIds: [...(frontEvidence?.encounteredClassIds ?? selectedPeak.encounteredFrontClassIds ?? [])],
    encounteredSideClassIds: [...(sideEvidence?.encounteredClassIds ?? selectedPeak.encounteredSideClassIds ?? [])],
    sliceHighlightCoordinates: bustApexPlaneLocalization.provenance?.sliceHighlightCoordinates
      ? { ...bustApexPlaneLocalization.provenance.sliceHighlightCoordinates }
      : null,
  };

  return {
    contract: MODELED_BUST_CIRCUMFERENCE_CONTRACT,
    version: MODELED_BUST_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_BUST_CIRCUMFERENCE_DISPLAY_NAME,
    status: MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED,
    isModeled: true,
    isQualified: true,
    valueCm,
    yCm: levelYcm,
    levelYcm,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      semiMajorAxisCm,
      semiMinorAxisCm,
      transverseWidthCm: frontWidthCm,
      apDepthCm: sideQualifiedApDepthCm,
      frontDiameterCm: frontWidthCm,
      sideDiameterCm: sideQualifiedApDepthCm,
      hParameter,
    },
    sourcePlane: sourcePlaneRecord,
    crossSectionEvidence: crossSectionEvidenceRecord,
    provenance,
    blockers: [],
    warnings: [...inheritedWarnings],
    issues: [],
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Bust Circumference at localized Bust Apex Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT dense-geometry perimeter, NOT pointmap-derived perimeter, NOT body volume.',
      isModeled: true,
      isModeledEstimate: true,
      isEstimatedCircumference: true,
      isMeasuredContour: false,
      isTapeMeasuredGroundTruth: false,
      is3dReconstruction: false,
      isBodyVolume: false,
      isValidatedAgainstGroundTruth: false,
    },
  };
}

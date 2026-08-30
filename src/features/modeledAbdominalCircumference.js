/**
 * Modeled Abdominal Circumference Contract v0
 *
 * Pure deterministic domain contract that evaluates the Modeled Abdominal Circumference
 * estimate from an already-localized Abdominal Apex Plane candidate.
 *
 * Contract: 'modeled-abdominal-circumference-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Authoritative apex plane: consumes the output of 'abdominal-apex-plane-localization-v0'
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

export const MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT = 'modeled-abdominal-circumference-v0';
export const MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT_VERSION = 'modeled-abdominal-circumference-v0';

export const MODELED_ABDOMINAL_CIRCUMFERENCE_DEFINITION_ID = 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane';
export const MODELED_ABDOMINAL_CIRCUMFERENCE_DISPLAY_NAME = 'Modeled Abdominal Circumference';

/**
 * Authoritative measurement status taxonomy.
 * @type {Readonly<{
 *   MODELED: 'modeled',
 *   UNAVAILABLE: 'unavailable',
 *   BLOCKED: 'blocked',
 *   INVALID: 'invalid',
 * }>}
 */
export const MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS = Object.freeze({
  MODELED: 'modeled',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Modeled Abdominal Circumference.
 * @type {Readonly<Record<string, string>>}
 */
export const MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS = Object.freeze({
  ABDOMINAL_APEX_PLANE_UNAVAILABLE: 'abdominal_apex_plane_unavailable',
  ABDOMINAL_APEX_PLANE_AMBIGUOUS: 'abdominal_apex_plane_ambiguous',
  FRONT_WIDTH_INVALID: 'front_width_invalid',
  SIDE_AP_DEPTH_UNAVAILABLE: 'side_ap_depth_unavailable',
  SIDE_AP_DEPTH_NOT_QUALIFIED: 'side_ap_depth_not_qualified',
  SIDE_AP_DEPTH_INVALID: 'side_ap_depth_invalid',
  SAME_Y_MISMATCH: 'same_y_mismatch',
  MODELED_PERIMETER_INVALID: 'modeled_perimeter_invalid',
  STRUCTURAL_CONTRACT_INVALID: 'structural_contract_invalid',
});

/**
 * Builds an empty or unavailable modeled abdominal circumference record.
 */
function buildEmptyModeledAbdominalCircumference({
  status = MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  levelYcm = null,
  sourcePlane = null,
  crossSectionEvidence = null,
  provenance = null,
} = {}) {
  return {
    contract: MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT,
    version: MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_ABDOMINAL_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_ABDOMINAL_CIRCUMFERENCE_DISPLAY_NAME,
    status,
    isModeled: status === MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED,
    isQualified: status === MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED,
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
      contract: 'abdominal-apex-plane-localization-v0',
      yCm: levelYcm,
      status: 'unavailable',
    },
    crossSectionEvidence,
    provenance,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Abdominal Circumference at localized Abdominal Apex Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT dense-geometry perimeter, NOT pointmap-derived perimeter, NOT body volume.',
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
 * Evaluates pure deterministic Modeled Abdominal Circumference from an
 * Abdominal Apex Plane Localization result.
 *
 * @param {object|null|undefined} abdominalApexPlaneLocalization - Result of evaluateAbdominalApexPlaneLocalization
 * @param {object} [options]
 * @returns {object} ModeledAbdominalCircumferenceResultV0
 */
export function evaluateModeledAbdominalCircumference(abdominalApexPlaneLocalization, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  // Gate 1 — Input availability
  if (!abdominalApexPlaneLocalization || typeof abdominalApexPlaneLocalization !== 'object') {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE);
    issues.push('Abdominal Apex Plane localization report is missing or null.');
    return buildEmptyModeledAbdominalCircumference({
      status: MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  // Gate 2 — Structural contract validity
  const contractId = abdominalApexPlaneLocalization.contract;
  const isV1Contract = contractId === 'abdominal-point-plane-localization-v1';
  const isV0Contract = contractId === 'abdominal-apex-plane-localization-v0';
  if (contractId && !isV1Contract && !isV0Contract) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);
    issues.push(`Invalid localization contract: expected 'abdominal-point-plane-localization-v1' or 'abdominal-apex-plane-localization-v0', received '${contractId}'.`);
    return buildEmptyModeledAbdominalCircumference({
      status: MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings,
      issues,
    });
  }

  // Gate 3 — Localization state
  const localizationStatus = abdominalApexPlaneLocalization.status;
  const isReady = localizationStatus === 'ready';
  const selectedFeature = abdominalApexPlaneLocalization.selectedPlateau
    ?? abdominalApexPlaneLocalization.selectedDome
    ?? abdominalApexPlaneLocalization.selectedPeak
    ?? null;

  if (localizationStatus === 'ambiguous') {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_AMBIGUOUS);
    issues.push('Abdominal localization status is ambiguous; cannot compute modeled circumference without a unique localized plane.');
    return buildEmptyModeledAbdominalCircumference({
      status: MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.BLOCKED,
      blockers,
      warnings: abdominalApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm: abdominalApexPlaneLocalization.yCm ?? null,
      sourcePlane: {
        contract: contractId ?? 'abdominal-point-plane-localization-v1',
        yCm: abdominalApexPlaneLocalization.yCm ?? null,
        status: localizationStatus,
      },
    });
  }

  if (!isReady || (!selectedFeature && typeof abdominalApexPlaneLocalization.yCm !== 'number')) {
    const isInvalid = localizationStatus === 'invalid';
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE);
    issues.push(`Abdominal localization status is '${localizationStatus}' (not ready).`);
    return buildEmptyModeledAbdominalCircumference({
      status: isInvalid
        ? MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID
        : MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings: abdominalApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm: abdominalApexPlaneLocalization.yCm ?? null,
      sourcePlane: {
        contract: contractId ?? 'abdominal-point-plane-localization-v1',
        yCm: abdominalApexPlaneLocalization.yCm ?? null,
        status: localizationStatus,
      },
    });
  }

  const selectedPeak = selectedFeature ?? {};
  const levelYcm = abdominalApexPlaneLocalization.yCm ?? selectedPeak.yCm ?? selectedPeak.representativeYcm;

  // Validate Level Y
  if (typeof levelYcm !== 'number' || !Number.isFinite(levelYcm) || levelYcm <= 0) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE);
    issues.push(`Abdominal Apex Plane level Y is invalid or non-positive (${levelYcm ?? 'null'}).`);
    return buildEmptyModeledAbdominalCircumference({
      status: MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings,
      issues,
      levelYcm,
    });
  }

  // Gate 4 — Front Width Gate
  const frontWidthCm = selectedPeak.frontWidthCm ?? abdominalApexPlaneLocalization.frontEvidence?.widthCm ?? null;
  const frontMinXcm = selectedPeak.frontMinXcm ?? abdominalApexPlaneLocalization.frontEvidence?.minXcm ?? null;
  const frontMaxXcm = selectedPeak.frontMaxXcm ?? abdominalApexPlaneLocalization.frontEvidence?.maxXcm ?? null;

  const hasValidFrontEndpoints = typeof frontMinXcm === 'number' && Number.isFinite(frontMinXcm)
    && typeof frontMaxXcm === 'number' && Number.isFinite(frontMaxXcm)
    && frontMinXcm < frontMaxXcm;

  const hasValidFrontWidth = typeof frontWidthCm === 'number' && Number.isFinite(frontWidthCm) && frontWidthCm > 0 && hasValidFrontEndpoints;

  if (!hasValidFrontWidth) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID);
    issues.push(`Front transverse width at Abdominal Apex Plane is invalid, malformed, or non-positive (width: ${frontWidthCm ?? 'null'}, minX: ${frontMinXcm ?? 'null'}, maxX: ${frontMaxXcm ?? 'null'}).`);
  }

  // Gate 5 — Side AP Depth Gate (MANDATORY GATE: Front-only or unqualified depth MUST NOT produce circumference)
  const sideEvidence = abdominalApexPlaneLocalization.sideEvidence;
  const rawSideQualifiedApDepth = selectedPeak.qualifiedApDepthCm
    ?? (sideEvidence?.isQualified === true ? sideEvidence.qualifiedApDepthCm : null);

  const isSideAbsent = !sideEvidence
    || sideEvidence.status === 'unavailable'
    || (selectedPeak.sideProfileSpanCm === null && selectedPeak.qualifiedApDepthCm === null && (sideEvidence?.qualifiedApDepthCm === null || sideEvidence?.qualifiedApDepthCm === undefined));

  const sideMinUcm = selectedPeak.sideMinUcm ?? sideEvidence?.minUcm ?? null;
  const sideMaxUcm = selectedPeak.sideMaxUcm ?? sideEvidence?.maxUcm ?? null;

  let isSideQualified = false;
  let sideQualifiedApDepthCm = null;

  if (isSideAbsent) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE);
    issues.push('Side evidence is unavailable at Abdominal Apex Plane. Front-only localization cannot produce a modeled circumference.');
  } else if (
    rawSideQualifiedApDepth !== null
    && (typeof rawSideQualifiedApDepth !== 'number' || !Number.isFinite(rawSideQualifiedApDepth) || rawSideQualifiedApDepth <= 0)
  ) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Qualified Side AP depth at Abdominal Apex Plane is malformed or non-positive (${rawSideQualifiedApDepth}).`);
  } else if (
    typeof sideMinUcm === 'number'
    && typeof sideMaxUcm === 'number'
    && sideMinUcm >= sideMaxUcm
  ) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Side profile endpoints are malformed (minU: ${sideMinUcm}, maxU: ${sideMaxUcm}).`);
  } else if (
    (sideEvidence?.isQualified === true || selectedPeak.isSideDepthQualified === true)
    && typeof rawSideQualifiedApDepth === 'number'
    && rawSideQualifiedApDepth > 0
  ) {
    isSideQualified = true;
    sideQualifiedApDepthCm = rawSideQualifiedApDepth;
  } else {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED);
    issues.push(`Side physical AP depth at Abdominal Apex Plane is not qualified (status: '${sideEvidence?.depthQualificationStatus ?? sideEvidence?.status ?? 'unqualified'}'). Raw profile span cannot be used as physical depth.`);
  }

  // Gate 6 — Same-Y Consistency Verification
  const highlightY = abdominalApexPlaneLocalization.provenance?.sliceHighlightCoordinates?.yCm;
  if (typeof highlightY === 'number' && Math.abs(highlightY - levelYcm) > 1e-4) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH);
    issues.push(`Same-Y mismatch: localized plane Y (${levelYcm}) does not match slice coordinate Y (${highlightY}).`);
  }

  const sourcePlaneRecord = {
    contract: abdominalApexPlaneLocalization.contract ?? 'abdominal-apex-plane-localization-v0',
    yCm: levelYcm,
    status: localizationStatus,
    rasterRow: selectedPeak.rasterRow ?? abdominalApexPlaneLocalization.rasterRow ?? null,
    sideRasterRow: selectedPeak.sideRasterRow ?? abdominalApexPlaneLocalization.sideRasterRow ?? null,
    selectionMethod: abdominalApexPlaneLocalization.selectionMethod ?? null,
  };

  const crossSectionEvidenceRecord = {
    contract: 'abdominal-apex-cross-section-evidence-v0',
    yCm: levelYcm,
    status: (hasValidFrontWidth && isSideQualified && blockers.length === 0) ? 'qualified' : 'unqualified',
    isQualified: hasValidFrontWidth && isSideQualified && blockers.length === 0,
    supportPolicyId: abdominalApexPlaneLocalization.provenance?.supportPolicyId ?? 'trunk_pelvic_transition_support_v0',
    targetClassIds: [...(abdominalApexPlaneLocalization.provenance?.targetClassIds ?? [12, 13, 21, 22, 23])],
    front: {
      transverseWidthCm: frontWidthCm,
      minXcm: frontMinXcm,
      maxXcm: frontMaxXcm,
      rasterRow: selectedPeak.rasterRow ?? abdominalApexPlaneLocalization.rasterRow ?? null,
      status: abdominalApexPlaneLocalization.frontEvidence?.status ?? 'valid',
      encounteredClassIds: [...(selectedPeak.encounteredFrontClassIds ?? abdominalApexPlaneLocalization.frontEvidence?.encounteredClassIds ?? [])],
    },
    side: {
      qualifiedApDepthCm: typeof sideQualifiedApDepthCm === 'number' && Number.isFinite(sideQualifiedApDepthCm) ? sideQualifiedApDepthCm : null,
      rawProfileSpanCm: selectedPeak.sideProfileSpanCm ?? sideEvidence?.profileSpanCm ?? null,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      rasterRow: selectedPeak.sideRasterRow ?? abdominalApexPlaneLocalization.sideRasterRow ?? null,
      depthQualificationStatus: sideEvidence?.depthQualificationStatus ?? (isSideQualified ? 'qualified' : 'unqualified'),
      isQualified: Boolean(isSideQualified),
      encounteredClassIds: [...(selectedPeak.encounteredSideClassIds ?? sideEvidence?.encounteredClassIds ?? [])],
    },
    sameYConsistency: {
      yCm: levelYcm,
      isConsistent: !blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH),
    },
  };

  // If any blockers exist, return empty/blocked/invalid result
  if (blockers.length > 0) {
    const isInvalid = blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID)
      || blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH)
      || blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID)
      || blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);

    const isUnavailable = blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE)
      || blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE);

    const fallbackStatus = isInvalid
      ? MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID
      : (isUnavailable ? MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE : MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.BLOCKED);

    return buildEmptyModeledAbdominalCircumference({
      status: fallbackStatus,
      blockers,
      warnings: abdominalApexPlaneLocalization.warnings ?? [],
      issues,
      levelYcm,
      sourcePlane: sourcePlaneRecord,
      crossSectionEvidence: crossSectionEvidenceRecord,
      provenance: {
        selectedYcm: levelYcm,
        supportPolicyId: abdominalApexPlaneLocalization.provenance?.supportPolicyId ?? 'trunk_pelvic_transition_support_v0',
        targetClassIds: [...(abdominalApexPlaneLocalization.provenance?.targetClassIds ?? [12, 13, 21, 22, 23])],
        sourceLocalizationContract: abdominalApexPlaneLocalization.contract ?? 'abdominal-apex-plane-localization-v0',
        sourceLocalizationStatus: localizationStatus,
      },
    });
  }

  // Gate 7 — Evaluate Ramanujan II Ellipse Perimeter
  const ellipseCalc = computeRamanujanEllipsePerimeter(frontWidthCm, sideQualifiedApDepthCm);
  if (!ellipseCalc || typeof ellipseCalc.perimeterCm !== 'number' || !Number.isFinite(ellipseCalc.perimeterCm) || ellipseCalc.perimeterCm <= 0) {
    blockers.push(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.MODELED_PERIMETER_INVALID);
    issues.push(`Failed to calculate Ramanujan II ellipse perimeter from Front width (${frontWidthCm}) and Side depth (${sideQualifiedApDepthCm}).`);
    return buildEmptyModeledAbdominalCircumference({
      status: MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings: abdominalApexPlaneLocalization.warnings ?? [],
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

  const inheritedWarnings = Array.isArray(abdominalApexPlaneLocalization.warnings)
    ? abdominalApexPlaneLocalization.warnings
    : [];

  const provenance = {
    measurementDefinitionId: MODELED_ABDOMINAL_CIRCUMFERENCE_DEFINITION_ID,
    selectedYcm: levelYcm,
    frontRasterRow: selectedPeak.rasterRow ?? abdominalApexPlaneLocalization.rasterRow ?? null,
    sideRasterRow: selectedPeak.sideRasterRow ?? abdominalApexPlaneLocalization.sideRasterRow ?? null,
    frontTransverseWidthCm: frontWidthCm,
    frontMinXcm,
    frontMaxXcm,
    sideRawProfileSpanCm: selectedPeak.sideProfileSpanCm ?? sideEvidence?.profileSpanCm ?? null,
    sideQualifiedApDepthCm,
    sideMinUcm,
    sideMaxUcm,
    prominenceCm: selectedPeak.prominenceCm ?? null,
    rawAnteriorUcm: selectedPeak.rawAnteriorUcm ?? null,
    smoothedAnteriorUcm: selectedPeak.smoothedAnteriorUcm ?? null,
    baselineUcm: selectedPeak.baselineUcm ?? null,
    upperWaistBoundaryYcm: abdominalApexPlaneLocalization.provenance?.upperYcm ?? null,
    offsetBelowWaistCm: abdominalApexPlaneLocalization.provenance?.offsetBelowWaistCm ?? null,
    lowerHipBoundaryYcm: abdominalApexPlaneLocalization.provenance?.lowerYcm ?? null,
    elevationAboveHipCm: abdominalApexPlaneLocalization.provenance?.elevationAboveHipCm ?? null,
    supportPolicyId: abdominalApexPlaneLocalization.provenance?.supportPolicyId ?? 'trunk_pelvic_transition_support_v0',
    targetClassIds: [...(abdominalApexPlaneLocalization.provenance?.targetClassIds ?? [12, 13, 21, 22, 23])],
    sourceScanContract: abdominalApexPlaneLocalization.provenance?.sourceScanContract ?? 'torso-arbitrary-y-evidence-scan-v0',
    sourceLocalizationContract: abdominalApexPlaneLocalization.contract ?? 'abdominal-apex-plane-localization-v0',
    sourceLocalizationStatus: localizationStatus,
    encounteredFrontClassIds: [...(selectedPeak.encounteredFrontClassIds ?? abdominalApexPlaneLocalization.frontEvidence?.encounteredClassIds ?? [])],
    encounteredSideClassIds: [...(selectedPeak.encounteredSideClassIds ?? sideEvidence?.encounteredClassIds ?? [])],
    sliceHighlightCoordinates: abdominalApexPlaneLocalization.provenance?.sliceHighlightCoordinates
      ? { ...abdominalApexPlaneLocalization.provenance.sliceHighlightCoordinates }
      : null,
  };

  return {
    contract: MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT,
    version: MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_ABDOMINAL_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_ABDOMINAL_CIRCUMFERENCE_DISPLAY_NAME,
    status: MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED,
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
      statement: 'Pure deterministic ellipse-modeled Abdominal Circumference at localized Abdominal Apex Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT dense-geometry perimeter, NOT pointmap-derived perimeter, NOT body volume.',
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

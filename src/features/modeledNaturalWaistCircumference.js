/**
 * Modeled Natural Waist Circumference Estimate Contract v0
 *
 * Pure deterministic domain contract that evaluates the Modeled Natural Waist Circumference
 * estimate from an already-localized Natural Waist Plane candidate.
 *
 * Contract: 'modeled-natural-waist-circumference-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Authoritative waist plane: consumes the output of 'natural-waist-plane-localization-v0'
 *   without independently relocalizing, rescanning rasters, or averaging candidate Ys.
 * - Deterministic ellipse model: evaluates the Ramanujan II ellipse perimeter approximation
 *   from calibrated Front transverse width (transverse diameter) and qualified Side physical AP
 *   depth (conjugate AP diameter) at the exact same canonical Y.
 * - Strict Front-only rejection: Front-only Natural Waist localization (ready with warning)
 *   MUST NOT produce a modeled circumference. Qualified Side physical AP depth is mandatory.
 * - Strict semantic separation:
 *   - NOT tape-measured ground truth.
 *   - NOT a measured body contour.
 *   - NOT a reconstructed 3D circumference or dense-geometry perimeter.
 *   - NOT a pointmap-derived perimeter.
 *   - The ellipse is explicitly a modeling assumption.
 * - Zero Side U -> canonical Z conversion, zero pointmap/normal reads, zero dense fusion.
 */

import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT = 'modeled-natural-waist-circumference-v0';
export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT_VERSION = 'modeled-natural-waist-circumference-v0';

export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_DEFINITION_ID = 'torso_modeled_natural_waist_circumference_at_natural_waist_plane';
export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_DISPLAY_NAME = 'Modeled Natural Waist Circumference';

/**
 * Authoritative measurement status taxonomy.
 * @type {Readonly<{
 *   MODELED: 'modeled',
 *   UNAVAILABLE: 'unavailable',
 *   BLOCKED: 'blocked',
 *   INVALID: 'invalid',
 * }>}
 */
export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS = Object.freeze({
  MODELED: 'modeled',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Modeled Natural Waist Circumference.
 * @type {Readonly<Record<string, string>>}
 */
export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS = Object.freeze({
  NATURAL_WAIST_PLANE_UNAVAILABLE: 'natural_waist_plane_unavailable',
  NATURAL_WAIST_PLANE_AMBIGUOUS: 'natural_waist_plane_ambiguous',
  FRONT_WIDTH_INVALID: 'front_width_invalid',
  SIDE_AP_DEPTH_UNAVAILABLE: 'side_ap_depth_unavailable',
  SIDE_AP_DEPTH_NOT_QUALIFIED: 'side_ap_depth_not_qualified',
  SIDE_AP_DEPTH_INVALID: 'side_ap_depth_invalid',
  SAME_Y_MISMATCH: 'same_y_mismatch',
  MODELED_PERIMETER_INVALID: 'modeled_perimeter_invalid',
  STRUCTURAL_CONTRACT_INVALID: 'structural_contract_invalid',
});

/**
 * Builds an empty or unavailable modeled natural waist circumference record.
 */
function buildEmptyModeledNaturalWaistCircumference({
  status = MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  levelYcm = null,
  sourcePlane = null,
  crossSectionEvidence = null,
  provenance = null,
} = {}) {
  return {
    contract: MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT,
    version: MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_NATURAL_WAIST_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_NATURAL_WAIST_CIRCUMFERENCE_DISPLAY_NAME,
    status,
    isModeled: status === MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.MODELED,
    isQualified: status === MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.MODELED,
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
      contract: 'natural-waist-plane-localization-v0',
      yCm: levelYcm,
      status: 'unavailable',
    },
    crossSectionEvidence,
    provenance,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Natural Waist circumference estimate at localized Natural Waist Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT dense-geometry perimeter, NOT pointmap-derived perimeter.',
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
 * Evaluates pure deterministic Modeled Natural Waist Circumference Estimate from a
 * Natural Waist Plane Localization result.
 *
 * @param {object|null|undefined} naturalWaistPlaneLocalization - Result of evaluateNaturalWaistPlaneLocalization
 * @param {object} [options]
 * @returns {object} ModeledNaturalWaistCircumferenceResultV0
 */
export function evaluateModeledNaturalWaistCircumference(naturalWaistPlaneLocalization, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  // 1. Validate Input Localization Report
  if (!naturalWaistPlaneLocalization || typeof naturalWaistPlaneLocalization !== 'object') {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_UNAVAILABLE);
    issues.push('Natural Waist Plane localization report is missing or null.');
    return buildEmptyModeledNaturalWaistCircumference({
      status: MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  // Contract verification
  if (
    naturalWaistPlaneLocalization.contract
    && naturalWaistPlaneLocalization.contract !== 'natural-waist-plane-localization-v0'
  ) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);
    issues.push(`Invalid localization contract: expected 'natural-waist-plane-localization-v0', received '${naturalWaistPlaneLocalization.contract}'.`);
    return buildEmptyModeledNaturalWaistCircumference({
      status: MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings,
      issues,
    });
  }

  const localizationStatus = naturalWaistPlaneLocalization.status;
  const isReady = localizationStatus === 'ready';

  if (localizationStatus === 'ambiguous') {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_AMBIGUOUS);
    issues.push('Natural Waist Plane localization status is ambiguous; cannot compute modeled circumference without a unique localized plane.');
    return buildEmptyModeledNaturalWaistCircumference({
      status: MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings: naturalWaistPlaneLocalization.warnings ?? [],
      issues,
      levelYcm: naturalWaistPlaneLocalization.yCm ?? null,
      sourcePlane: {
        contract: naturalWaistPlaneLocalization.contract ?? 'natural-waist-plane-localization-v0',
        yCm: naturalWaistPlaneLocalization.yCm ?? null,
        status: localizationStatus,
      },
    });
  }

  if (!isReady || !naturalWaistPlaneLocalization.selectedCandidate) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_UNAVAILABLE);
    issues.push(`Natural Waist Plane localization status is '${localizationStatus}' (not ready).`);
    return buildEmptyModeledNaturalWaistCircumference({
      status: localizationStatus === 'invalid'
        ? MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID
        : MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings: naturalWaistPlaneLocalization.warnings ?? [],
      issues,
      levelYcm: naturalWaistPlaneLocalization.yCm ?? null,
      sourcePlane: {
        contract: naturalWaistPlaneLocalization.contract ?? 'natural-waist-plane-localization-v0',
        yCm: naturalWaistPlaneLocalization.yCm ?? null,
        status: localizationStatus,
      },
    });
  }

  const candidate = naturalWaistPlaneLocalization.selectedCandidate;
  const levelYcm = candidate.yCm ?? naturalWaistPlaneLocalization.yCm;

  // Validate Level Y
  if (typeof levelYcm !== 'number' || !Number.isFinite(levelYcm) || levelYcm <= 0) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_UNAVAILABLE);
    issues.push(`Natural Waist Plane level Y is invalid or non-positive (${levelYcm ?? 'null'}).`);
    return buildEmptyModeledNaturalWaistCircumference({
      status: MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings,
      issues,
      levelYcm,
    });
  }

  // 2. Validate Front Transverse Width Evidence
  const frontWidthCm = candidate.frontWidthCm ?? naturalWaistPlaneLocalization.frontEvidence?.widthCm ?? null;
  const frontMinXcm = candidate.frontMinXcm ?? naturalWaistPlaneLocalization.frontEvidence?.minXcm ?? null;
  const frontMaxXcm = candidate.frontMaxXcm ?? naturalWaistPlaneLocalization.frontEvidence?.maxXcm ?? null;

  const hasValidFrontEndpoints = typeof frontMinXcm === 'number' && Number.isFinite(frontMinXcm)
    && typeof frontMaxXcm === 'number' && Number.isFinite(frontMaxXcm)
    && frontMinXcm < frontMaxXcm;

  const hasValidFrontWidth = typeof frontWidthCm === 'number' && Number.isFinite(frontWidthCm) && frontWidthCm > 0 && hasValidFrontEndpoints;

  if (!hasValidFrontWidth) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID);
    issues.push(`Front transverse width at Natural Waist Plane is invalid, malformed, or non-positive (width: ${frontWidthCm ?? 'null'}, minX: ${frontMinXcm ?? 'null'}, maxX: ${frontMaxXcm ?? 'null'}).`);
  }

  // 3. Validate Side AP Depth & Physical Depth Qualification (MANDATORY GATE: Front-only MUST NOT produce circumference)
  const sideEvidence = naturalWaistPlaneLocalization.sideEvidence;
  const rawSideQualifiedApDepth = candidate.sideQualifiedApDepthCm
    ?? (sideEvidence?.isQualified === true ? sideEvidence.qualifiedApDepthCm : null);

  const isSideAbsent = !sideEvidence
    || sideEvidence.status === 'unavailable'
    || (candidate.sideRawProfileSpanCm === null && candidate.sideQualifiedApDepthCm === null && (sideEvidence?.qualifiedApDepthCm === null || sideEvidence?.qualifiedApDepthCm === undefined));

  const sideMinUcm = candidate.sideMinUcm ?? sideEvidence?.minUcm ?? null;
  const sideMaxUcm = candidate.sideMaxUcm ?? sideEvidence?.maxUcm ?? null;

  let isSideQualified = false;
  let sideQualifiedApDepthCm = null;

  if (isSideAbsent) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE);
    issues.push('Side evidence is unavailable at Natural Waist Plane. Front-only localization cannot produce a modeled circumference.');
  } else if (
    rawSideQualifiedApDepth !== null
    && (typeof rawSideQualifiedApDepth !== 'number' || !Number.isFinite(rawSideQualifiedApDepth) || rawSideQualifiedApDepth <= 0)
  ) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Qualified Side AP depth at Natural Waist Plane is malformed or non-positive (${rawSideQualifiedApDepth}).`);
  } else if (
    typeof sideMinUcm === 'number'
    && typeof sideMaxUcm === 'number'
    && sideMinUcm >= sideMaxUcm
  ) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Side profile endpoints are malformed (minU: ${sideMinUcm}, maxU: ${sideMaxUcm}).`);
  } else if (
    (sideEvidence?.isQualified === true || candidate.sideQualifiedApDepthCm !== null)
    && typeof rawSideQualifiedApDepth === 'number'
    && rawSideQualifiedApDepth > 0
  ) {
    isSideQualified = true;
    sideQualifiedApDepthCm = rawSideQualifiedApDepth;
  } else {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED);
    issues.push(`Side physical AP depth at Natural Waist Plane is not qualified (status: '${sideEvidence?.depthQualificationStatus ?? sideEvidence?.status ?? 'unqualified'}'). Raw profile span cannot be used as physical depth.`);
  }

  // 4. Same-Y Consistency Verification
  const highlightY = naturalWaistPlaneLocalization.provenance?.sliceHighlightCoordinates?.yCm;
  if (typeof highlightY === 'number' && Math.abs(highlightY - levelYcm) > 1e-4) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH);
    issues.push(`Same-Y mismatch: localized plane Y (${levelYcm}) does not match slice coordinate Y (${highlightY}).`);
  }

  const sourcePlaneRecord = {
    contract: naturalWaistPlaneLocalization.contract ?? 'natural-waist-plane-localization-v0',
    yCm: levelYcm,
    status: localizationStatus,
    rasterRow: candidate.rasterRow ?? naturalWaistPlaneLocalization.rasterRow ?? null,
    sideRasterRow: candidate.sideRasterRow ?? null,
    selectionMethod: naturalWaistPlaneLocalization.selectionMethod ?? null,
  };

  const crossSectionEvidenceRecord = {
    contract: 'natural-waist-cross-section-evidence-v0',
    yCm: levelYcm,
    status: (hasValidFrontWidth && isSideQualified && blockers.length === 0) ? 'qualified' : 'unqualified',
    isQualified: hasValidFrontWidth && isSideQualified && blockers.length === 0,
    front: {
      transverseWidthCm: frontWidthCm,
      minXcm: frontMinXcm,
      maxXcm: frontMaxXcm,
      rasterRow: candidate.rasterRow ?? naturalWaistPlaneLocalization.rasterRow ?? null,
      status: naturalWaistPlaneLocalization.frontEvidence?.status ?? 'valid',
      encounteredClassIds: [...(candidate.encounteredFrontClassIds ?? naturalWaistPlaneLocalization.frontEvidence?.encounteredClassIds ?? [])],
    },
    side: {
      qualifiedApDepthCm: typeof sideQualifiedApDepthCm === 'number' && Number.isFinite(sideQualifiedApDepthCm) ? sideQualifiedApDepthCm : null,
      rawProfileSpanCm: candidate.sideRawProfileSpanCm ?? sideEvidence?.profileSpanCm ?? null,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      rasterRow: candidate.sideRasterRow ?? null,
      depthQualificationStatus: sideEvidence?.depthQualificationStatus ?? (isSideQualified ? 'qualified' : 'unqualified'),
      isQualified: Boolean(isSideQualified),
      encounteredClassIds: [...(candidate.encounteredSideClassIds ?? [])],
    },
    sameYConsistency: {
      yCm: levelYcm,
      isConsistent: !blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH),
    },
  };

  // If any blockers exist, return empty/blocked result
  if (blockers.length > 0) {
    const isInvalid = blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID)
      || blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH)
      || blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID)
      || blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);

    const isUnavailable = blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE)
      || blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_UNAVAILABLE)
      || blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_AMBIGUOUS);

    const fallbackStatus = isInvalid
      ? MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID
      : (isUnavailable ? MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE : MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.BLOCKED);

    return buildEmptyModeledNaturalWaistCircumference({
      status: fallbackStatus,
      blockers,
      warnings: naturalWaistPlaneLocalization.warnings ?? [],
      issues,
      levelYcm,
      sourcePlane: sourcePlaneRecord,
      crossSectionEvidence: crossSectionEvidenceRecord,
      provenance: {
        selectedYcm: levelYcm,
        sourceLocalizationContract: naturalWaistPlaneLocalization.contract ?? 'natural-waist-plane-localization-v0',
        sourceLocalizationStatus: localizationStatus,
      },
    });
  }

  // 5. Compute Ramanujan II Ellipse Perimeter
  const ellipseCalc = computeRamanujanEllipsePerimeter(frontWidthCm, sideQualifiedApDepthCm);
  if (!ellipseCalc || typeof ellipseCalc.perimeterCm !== 'number' || !Number.isFinite(ellipseCalc.perimeterCm) || ellipseCalc.perimeterCm <= 0) {
    blockers.push(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.MODELED_PERIMETER_INVALID);
    issues.push(`Failed to calculate Ramanujan II ellipse perimeter from Front width (${frontWidthCm}) and Side depth (${sideQualifiedApDepthCm}).`);
    return buildEmptyModeledNaturalWaistCircumference({
      status: MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID,
      blockers,
      warnings: naturalWaistPlaneLocalization.warnings ?? [],
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

  const inheritedWarnings = Array.isArray(naturalWaistPlaneLocalization.warnings)
    ? naturalWaistPlaneLocalization.warnings
    : [];

  const provenance = {
    measurementDefinitionId: MODELED_NATURAL_WAIST_CIRCUMFERENCE_DEFINITION_ID,
    selectedYcm: levelYcm,
    frontRasterRow: candidate.rasterRow ?? naturalWaistPlaneLocalization.rasterRow ?? null,
    sideRasterRow: candidate.sideRasterRow ?? null,
    frontTransverseWidthCm: frontWidthCm,
    frontMinXcm,
    frontMaxXcm,
    sideRawProfileSpanCm: candidate.sideRawProfileSpanCm ?? sideEvidence?.profileSpanCm ?? null,
    sideQualifiedApDepthCm,
    sideMinUcm,
    sideMaxUcm,
    shoulderAnchorYcm: naturalWaistPlaneLocalization.provenance?.shoulderAnchorYcm ?? null,
    offsetBelowShoulderCm: naturalWaistPlaneLocalization.provenance?.offsetBelowShoulderCm ?? null,
    hipAnchorYcm: naturalWaistPlaneLocalization.provenance?.hipAnchorYcm ?? null,
    elevationAboveHipCm: naturalWaistPlaneLocalization.provenance?.elevationAboveHipCm ?? null,
    constrictionProminenceCm: candidate.constrictionProminenceCm ?? null,
    bilateralContourQa: candidate.bilateralContourQa ?? null,
    sourceScanContract: naturalWaistPlaneLocalization.provenance?.sourceScanContract ?? 'torso-arbitrary-y-evidence-scan-v0',
    sourceLocalizationContract: naturalWaistPlaneLocalization.contract ?? 'natural-waist-plane-localization-v0',
    sourceLocalizationStatus: localizationStatus,
    encounteredFrontClassIds: [...(candidate.encounteredFrontClassIds ?? [])],
    encounteredSideClassIds: [...(candidate.encounteredSideClassIds ?? [])],
    sliceHighlightCoordinates: naturalWaistPlaneLocalization.provenance?.sliceHighlightCoordinates
      ? { ...naturalWaistPlaneLocalization.provenance.sliceHighlightCoordinates }
      : null,
  };

  return {
    contract: MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT,
    version: MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_NATURAL_WAIST_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_NATURAL_WAIST_CIRCUMFERENCE_DISPLAY_NAME,
    status: MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.MODELED,
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
      statement: 'Pure deterministic ellipse-modeled Natural Waist circumference estimate at localized Natural Waist Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT dense-geometry perimeter, NOT pointmap-derived perimeter.',
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

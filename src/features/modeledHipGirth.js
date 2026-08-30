/**
 * Modeled Hip Girth Estimate Contract v1
 *
 * Pure deterministic domain contract that evaluates the Modeled Hip Girth
 * estimate from an already-localized Buttock Point / Hip Girth Plane candidate (v1).
 *
 * Contract: 'modeled-hip-girth-v1'
 *
 * SEMANTIC PRINCIPLES (ISO 8559-1:2017 Clause 5.3.13 / ISO 18825-2:2016 Clause 4.2.14 / ASTM D5219-15):
 * - Target Semantic: Hip Girth is the horizontal circumference of the body measured at the Hip Level
 *   (the level of greatest posterior projection of the buttocks).
 * - Authoritative plane: consumes the output of 'buttock-point-plane-localization-v1'
 *   without independently relocalizing, rescanning rasters, or averaging candidate Ys.
 * - Deterministic ellipse model: evaluates the Ramanujan II ellipse perimeter approximation
 *   from calibrated Front transverse width (transverse diameter) and qualified Side physical AP
 *   depth (conjugate AP depth) at the exact same canonical Y.
 * - Strict Front-only / Unqualified-Side rejection: If Front evidence is invalid or Side AP depth
 *   is unqualified, Modeled Hip Girth MUST return 'blocked' or 'unavailable'.
 * - Strict Semantic Separation:
 *   - 'Modeled Hip Girth' (~111.12 cm at Y ≈ 86.15 cm) measures the ISO-aligned Buttock Point Plane.
 *   - 'Modeled Maximum Seat Circumference' (~114.20 cm at Y = 79.95 cm) measures the ISO Maximum Hip Girth / Seat Plane.
 *   - Both coexist cleanly as independent measurements.
 * - Pure deterministic ellipse-modeled estimate. NOT tape-measured ground truth, NOT measured body contour,
 *   NOT 3D vertex reconstruction, NOT body volume.
 */

import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';
import { BUTTOCK_POINT_PLANE_STATUS } from './buttockPointPlaneLocalization.js';

export const MODELED_HIP_GIRTH_CONTRACT = 'modeled-hip-girth-v1';
export const MODELED_HIP_GIRTH_CONTRACT_VERSION = 'modeled-hip-girth-v1';
export const MODELED_HIP_GIRTH_DEFINITION_ID = 'torso_modeled_hip_girth_at_buttock_point_plane';
export const MODELED_HIP_GIRTH_DISPLAY_NAME = 'Modeled Hip Girth';

/**
 * Authoritative measurement status taxonomy.
 * @type {Readonly<{
 *   MODELED: 'modeled',
 *   UNAVAILABLE: 'unavailable',
 *   BLOCKED: 'blocked',
 *   INVALID: 'invalid',
 * }>}
 */
export const MODELED_HIP_GIRTH_STATUS = Object.freeze({
  MODELED: 'modeled',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Modeled Hip Girth.
 * @type {Readonly<Record<string, string>>}
 */
export const MODELED_HIP_GIRTH_BLOCKERS = Object.freeze({
  BUTTOCK_POINT_PLANE_UNAVAILABLE: 'buttock_point_plane_unavailable',
  BUTTOCK_POINT_PLANE_AMBIGUOUS: 'buttock_point_plane_ambiguous',
  FRONT_WIDTH_INVALID: 'front_width_invalid',
  SIDE_AP_DEPTH_UNAVAILABLE: 'side_ap_depth_unavailable',
  SIDE_AP_DEPTH_NOT_QUALIFIED: 'side_ap_depth_not_qualified',
  SIDE_AP_DEPTH_INVALID: 'side_ap_depth_invalid',
  SAME_Y_MISMATCH: 'same_y_mismatch',
  MODELED_PERIMETER_INVALID: 'modeled_perimeter_invalid',
  STRUCTURAL_CONTRACT_INVALID: 'structural_contract_invalid',
});

/**
 * Builds an empty or unavailable modeled hip girth record.
 */
function buildEmptyModeledHipGirth({
  status = MODELED_HIP_GIRTH_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  levelYcm = null,
  sourcePlane = null,
  crossSectionEvidence = null,
  provenance = null,
} = {}) {
  return {
    contract: MODELED_HIP_GIRTH_CONTRACT,
    version: MODELED_HIP_GIRTH_CONTRACT_VERSION,
    id: MODELED_HIP_GIRTH_DEFINITION_ID,
    name: MODELED_HIP_GIRTH_DISPLAY_NAME,
    status,
    isModeled: status === MODELED_HIP_GIRTH_STATUS.MODELED,
    isQualified: status === MODELED_HIP_GIRTH_STATUS.MODELED,
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
      contract: 'buttock-point-plane-localization-v1',
      yCm: levelYcm,
      status: 'unavailable',
    },
    crossSectionEvidence,
    provenance,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Hip Girth at localized Buttock Point Plane. Standard ISO 8559-1 Clause 5.3.13 / ISO 18825-2 Hip Girth. NOT Maximum Seat Girth (ISO 8559-1 Clause 5.3.14), NOT tape-measured ground truth, NOT measured body contour, NOT 3D vertex reconstruction, NOT body volume.',
      isModeled: true,
      isModeledEstimate: true,
      isEstimatedCircumference: true,
      isStandardsAlignedHipGirth: true,
      isMaximumSeatGirth: false,
      isMeasuredContour: false,
      isTapeMeasuredGroundTruth: false,
      is3dReconstruction: false,
      isBodyVolume: false,
      isValidatedAgainstGroundTruth: false,
    },
  };
}

/**
 * Evaluates pure deterministic Modeled Hip Girth from a localized Buttock Point Plane report.
 *
 * @param {object|null|undefined} buttockPointReport
 * @param {object} [options={}]
 * @returns {object} ModeledHipGirthResultV1
 */
export function evaluateModeledHipGirth(buttockPointReport, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  if (!buttockPointReport || typeof buttockPointReport !== 'object') {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.BUTTOCK_POINT_PLANE_UNAVAILABLE);
    issues.push('Buttock Point plane localization report is missing or null.');
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const planeStatus = buttockPointReport.status;
  const canonicalY = typeof buttockPointReport.yCm === 'number' && Number.isFinite(buttockPointReport.yCm)
    ? buttockPointReport.yCm
    : (typeof buttockPointReport.levelYcm === 'number' && Number.isFinite(buttockPointReport.levelYcm) ? buttockPointReport.levelYcm : null);

  const sourcePlaneSummary = {
    contract: buttockPointReport.contract ?? 'buttock-point-plane-localization-v1',
    id: buttockPointReport.id ?? 'torso_buttock_point_plane_localization_v1',
    version: buttockPointReport.version ?? 'buttock-point-plane-localization-v1',
    status: planeStatus,
    yCm: canonicalY,
    levelYcm: canonicalY,
    rasterRow: buttockPointReport.rasterRow ?? null,
    sideRasterRow: buttockPointReport.sideRasterRow ?? null,
    selectedPlateau: buttockPointReport.selectedPlateau ?? null,
  };

  if (planeStatus === BUTTOCK_POINT_PLANE_STATUS.AMBIGUOUS) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.BUTTOCK_POINT_PLANE_AMBIGUOUS);
    issues.push(`Buttock Point plane localization is ambiguous (${(buttockPointReport.issues ?? []).join('; ') || 'multiple candidate domes'}).`);
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.BLOCKED,
      sourcePlane: sourcePlaneSummary,
      levelYcm: canonicalY,
      blockers,
      warnings,
      issues,
    });
  }

  if (planeStatus === BUTTOCK_POINT_PLANE_STATUS.INVALID) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.STRUCTURAL_CONTRACT_INVALID);
    issues.push(`Buttock Point plane localization returned invalid status (${(buttockPointReport.issues ?? []).join('; ')}).`);
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.INVALID,
      sourcePlane: sourcePlaneSummary,
      levelYcm: canonicalY,
      blockers,
      warnings,
      issues,
    });
  }

  if (planeStatus !== BUTTOCK_POINT_PLANE_STATUS.READY) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.BUTTOCK_POINT_PLANE_UNAVAILABLE);
    issues.push(`Buttock Point plane localization status is '${planeStatus}' (not ready).`);
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.UNAVAILABLE,
      sourcePlane: sourcePlaneSummary,
      levelYcm: canonicalY,
      blockers,
      warnings,
      issues,
    });
  }

  if (canonicalY === null || !Number.isFinite(canonicalY) || canonicalY <= 0) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.BUTTOCK_POINT_PLANE_UNAVAILABLE);
    issues.push(`Invalid canonical Y coordinate on Buttock Point plane (${canonicalY}).`);
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.INVALID,
      sourcePlane: sourcePlaneSummary,
      levelYcm: canonicalY,
      blockers,
      warnings,
      issues,
    });
  }

  // Extract Front transverse width
  const front = buttockPointReport.frontEvidence ?? null;
  const frontWidthCm = front && typeof front.widthCm === 'number' && Number.isFinite(front.widthCm)
    ? front.widthCm
    : null;
  const isFrontValid = front && front.status === 'valid' && (front.isSingleSupportedRun === true || front.runCount === 1) && frontWidthCm !== null && frontWidthCm > 0;

  if (!isFrontValid || frontWidthCm === null || frontWidthCm <= 0) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.FRONT_WIDTH_INVALID);
    issues.push(`Front transverse width is invalid or unavailable at Y=${canonicalY} cm (${frontWidthCm} cm).`);
  }

  // Extract Side qualified AP depth
  const side = buttockPointReport.sideEvidence ?? null;
  const sideQualifiedApDepthCm = side && typeof side.qualifiedApDepthCm === 'number' && Number.isFinite(side.qualifiedApDepthCm)
    ? side.qualifiedApDepthCm
    : null;
  const isSideQualified = side && (side.isQualified === true || side.depthQualificationStatus === 'qualified') && sideQualifiedApDepthCm !== null && sideQualifiedApDepthCm > 0;

  if (sideQualifiedApDepthCm === null || sideQualifiedApDepthCm <= 0) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE);
    issues.push(`Side AP depth is missing or non-positive at Y=${canonicalY} cm.`);
  } else if (!isSideQualified) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED);
    issues.push(`Side AP depth at Y=${canonicalY} cm is not qualified under physical measurement semantics.`);
  }

  const crossSectionEvidence = {
    canonicalYcm: canonicalY,
    front: {
      widthCm: frontWidthCm,
      minXcm: front?.minXcm ?? null,
      maxXcm: front?.maxXcm ?? null,
      rasterRow: front?.rasterRow ?? buttockPointReport.rasterRow ?? null,
      status: front?.status ?? 'unavailable',
      isSingleSupportedRun: front?.isSingleSupportedRun ?? false,
    },
    side: {
      qualifiedApDepthCm: sideQualifiedApDepthCm,
      profileSpanCm: side?.profileSpanCm ?? null,
      minUcm: side?.minUcm ?? null,
      maxUcm: side?.maxUcm ?? null,
      rasterRow: side?.rasterRow ?? buttockPointReport.sideRasterRow ?? null,
      status: side?.status ?? 'unavailable',
      isQualified: isSideQualified,
      qualificationStatus: side?.depthQualificationStatus ?? 'evaluated',
    },
  };

  if (blockers.length > 0) {
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.BLOCKED,
      sourcePlane: sourcePlaneSummary,
      crossSectionEvidence,
      levelYcm: canonicalY,
      blockers,
      warnings,
      issues,
      provenance: {
        sliceHighlightCoordinates: buttockPointReport.provenance?.sliceHighlightCoordinates ?? null,
      },
    });
  }

  // Calculate Ramanujan II Ellipse Perimeter
  const perimeterResult = computeRamanujanEllipsePerimeter(frontWidthCm, sideQualifiedApDepthCm);

  if (!perimeterResult || typeof perimeterResult.perimeterCm !== 'number' || !Number.isFinite(perimeterResult.perimeterCm) || perimeterResult.perimeterCm <= 0) {
    blockers.push(MODELED_HIP_GIRTH_BLOCKERS.MODELED_PERIMETER_INVALID);
    issues.push('Ramanujan II perimeter calculation returned invalid result.');
    return buildEmptyModeledHipGirth({
      status: MODELED_HIP_GIRTH_STATUS.INVALID,
      sourcePlane: sourcePlaneSummary,
      crossSectionEvidence,
      levelYcm: canonicalY,
      blockers,
      warnings,
      issues,
    });
  }

  const finalValueCm = Number(perimeterResult.perimeterCm.toFixed(2));

  return {
    contract: MODELED_HIP_GIRTH_CONTRACT,
    version: MODELED_HIP_GIRTH_CONTRACT_VERSION,
    id: MODELED_HIP_GIRTH_DEFINITION_ID,
    name: MODELED_HIP_GIRTH_DISPLAY_NAME,
    status: MODELED_HIP_GIRTH_STATUS.MODELED,
    isModeled: true,
    isQualified: true,
    valueCm: finalValueCm,
    yCm: canonicalY,
    levelYcm: canonicalY,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      semiMajorAxisCm: perimeterResult.semiMajorAxisCm,
      semiMinorAxisCm: perimeterResult.semiMinorAxisCm,
      transverseWidthCm: frontWidthCm,
      apDepthCm: sideQualifiedApDepthCm,
      frontDiameterCm: frontWidthCm,
      sideDiameterCm: sideQualifiedApDepthCm,
      hParameter: perimeterResult.hParameter,
    },
    sourcePlane: sourcePlaneSummary,
    crossSectionEvidence,
    provenance: {
      supportPolicyId: buttockPointReport.provenance?.supportPolicyId ?? 'trunk_pelvic_transition_support_v0',
      sliceHighlightCoordinates: buttockPointReport.provenance?.sliceHighlightCoordinates ?? null,
      calculationMethod: 'ramanujan_ii_approximation',
      corroborativePoseHipDeltaYcm: buttockPointReport.provenance?.corroborativePoseHipDeltaYcm ?? null,
    },
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Hip Girth at localized Buttock Point Plane. Standard ISO 8559-1 Clause 5.3.13 / ISO 18825-2 Hip Girth. NOT Maximum Seat Girth (ISO 8559-1 Clause 5.3.14), NOT tape-measured ground truth, NOT measured body contour, NOT 3D vertex reconstruction, NOT body volume.',
      isModeled: true,
      isModeledEstimate: true,
      isEstimatedCircumference: true,
      isStandardsAlignedHipGirth: true,
      isMaximumSeatGirth: false,
      isMeasuredContour: false,
      isTapeMeasuredGroundTruth: false,
      is3dReconstruction: false,
      isBodyVolume: false,
      isValidatedAgainstGroundTruth: false,
    },
    blockers: [],
    warnings,
    issues: [],
  };
}

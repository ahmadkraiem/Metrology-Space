/**
 * Modeled Hip / Seat Circumference Estimate Contract v0
 *
 * Pure deterministic domain contract that evaluates the Modeled Hip / Seat Circumference
 * estimate from an already-localized Maximum Seat Plane candidate.
 *
 * Contract: 'modeled-hip-seat-circumference-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Authoritative seat plane: consumes the output of maximum-seat-plane-localization-v0
 *   without independently relocalizing or re-sampling image evidence.
 * - Single source value: valueCm is derived strictly from the Ramanujan II ellipse modeled
 *   perimeter associated with the localized Maximum Seat Plane candidate.
 * - Strict semantic separation:
 *   - 'Torso Modeled Perimeter Estimate at Hip Landmark Level' (~110.98 cm) measures the
 *     hip landmark plane.
 *   - 'Modeled Hip / Seat Circumference Estimate' (~114.20 cm) measures the localized
 *     Maximum Seat Plane.
 *   - Both coexist cleanly and neither is claimed to be tape-measured ground truth.
 * - Output preserves complete 2D slice highlight coordinates and segmentation class
 *   provenance for future UI inspection.
 */

export const MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT = 'modeled-hip-seat-circumference-v0';
export const MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT_VERSION = 'modeled-hip-seat-circumference-v0';

export const MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID = 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane';
export const MODELED_HIP_SEAT_CIRCUMFERENCE_DISPLAY_NAME = 'Modeled Hip / Seat Circumference Estimate';

/**
 * Authoritative measurement status taxonomy.
 * @type {Readonly<{
 *   MODELED: 'modeled',
 *   UNAVAILABLE: 'unavailable',
 *   BLOCKED: 'blocked',
 *   INVALID: 'invalid',
 * }>}
 */
export const MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS = Object.freeze({
  MODELED: 'modeled',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Modeled Hip / Seat Circumference.
 * @type {Readonly<Record<string, string>>}
 */
export const MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS = Object.freeze({
  MAXIMUM_SEAT_PLANE_UNAVAILABLE: 'maximum_seat_plane_unavailable',
  FRONT_WIDTH_INVALID: 'front_width_invalid',
  SIDE_AP_DEPTH_INVALID: 'side_ap_depth_invalid',
  MODELED_PERIMETER_INVALID: 'modeled_perimeter_invalid',
});

/**
 * Builds an empty or unavailable modeled circumference record.
 */
function buildEmptyModeledHipSeatCircumference({
  status = MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  levelYcm = null,
  provenance = null,
} = {}) {
  return {
    contract: MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT,
    version: MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_HIP_SEAT_CIRCUMFERENCE_DISPLAY_NAME,
    status,
    isModeled: status === MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.MODELED,
    isQualified: status === MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.MODELED,
    valueCm: null,
    levelYcm,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      semiMajorAxisCm: null,
      semiMinorAxisCm: null,
      transverseWidthCm: null,
      apDepthCm: null,
      hParameter: null,
    },
    provenance,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Hip/Seat Circumference estimate at localized Maximum Seat Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT body volume, NOT validated against ground truth.',
      isModeled: true,
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
 * Evaluates pure deterministic Modeled Hip / Seat Circumference Estimate from a
 * Maximum Seat Plane Localization result.
 *
 * @param {object|null|undefined} maximumSeatPlaneLocalization - Result of evaluateMaximumSeatPlaneLocalization
 * @param {object} [options]
 * @returns {object} ModeledHipSeatCircumferenceResultV0
 */
export function evaluateModeledHipSeatCircumference(maximumSeatPlaneLocalization, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  // 1. Validate Input Localization Report
  if (!maximumSeatPlaneLocalization || typeof maximumSeatPlaneLocalization !== 'object') {
    blockers.push(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.MAXIMUM_SEAT_PLANE_UNAVAILABLE);
    issues.push('Maximum Seat Plane localization report is missing or null.');
    return buildEmptyModeledHipSeatCircumference({
      status: MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const localizationStatus = maximumSeatPlaneLocalization.status;
  const isLocalized = localizationStatus === 'localized';

  if (!isLocalized || !maximumSeatPlaneLocalization.selectedCandidate) {
    blockers.push(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.MAXIMUM_SEAT_PLANE_UNAVAILABLE);
    issues.push(`Maximum Seat Plane localization status is '${localizationStatus}' (not localized).`);
    return buildEmptyModeledHipSeatCircumference({
      status: localizationStatus === 'invalid'
        ? MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.INVALID
        : MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      levelYcm: maximumSeatPlaneLocalization.selectedYcm ?? null,
      provenance: {
        sourceLocalizationContract: maximumSeatPlaneLocalization.contract ?? 'maximum-seat-plane-localization-v0',
        sourceLocalizationStatus: localizationStatus,
      },
    });
  }

  const candidate = maximumSeatPlaneLocalization.selectedCandidate;
  const levelYcm = candidate.yCm;
  const frontWidthCm = candidate.frontWidthCm;
  const sideApDepthCm = candidate.sideQualifiedApDepthCm;
  const modeledPerimeterScoreCm = candidate.modeledPerimeterScoreCm ?? maximumSeatPlaneLocalization.peakScoreCm;

  // 2. Validate Front Width
  if (typeof frontWidthCm !== 'number' || !Number.isFinite(frontWidthCm) || frontWidthCm <= 0) {
    blockers.push(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID);
    issues.push(`Front transverse width at Maximum Seat Plane is invalid or non-positive (${frontWidthCm ?? 'null'}).`);
  }

  // 3. Validate Side AP Depth
  if (typeof sideApDepthCm !== 'number' || !Number.isFinite(sideApDepthCm) || sideApDepthCm <= 0) {
    blockers.push(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID);
    issues.push(`Qualified Side AP depth at Maximum Seat Plane is invalid or non-positive (${sideApDepthCm ?? 'null'}).`);
  }

  // 4. Validate Modeled Perimeter Score
  if (typeof modeledPerimeterScoreCm !== 'number' || !Number.isFinite(modeledPerimeterScoreCm) || modeledPerimeterScoreCm <= 0) {
    blockers.push(MODELED_HIP_SEAT_CIRCUMFERENCE_BLOCKERS.MODELED_PERIMETER_INVALID);
    issues.push(`Modeled perimeter score at Maximum Seat Plane is invalid or non-positive (${modeledPerimeterScoreCm ?? 'null'}).`);
  }

  if (blockers.length > 0) {
    return buildEmptyModeledHipSeatCircumference({
      status: MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.BLOCKED,
      blockers,
      warnings,
      issues,
      levelYcm,
      provenance: {
        selectedYcm: levelYcm,
        sourceLocalizationContract: maximumSeatPlaneLocalization.contract ?? 'maximum-seat-plane-localization-v0',
        sourceLocalizationStatus: localizationStatus,
      },
    });
  }

  const valueCm = Number(modeledPerimeterScoreCm.toFixed(4));
  const semiMajorAxisCm = candidate.perimeterModel?.semiMajorAxisCm
    ?? Number((Math.max(frontWidthCm, sideApDepthCm) / 2).toFixed(4));
  const semiMinorAxisCm = candidate.perimeterModel?.semiMinorAxisCm
    ?? Number((Math.min(frontWidthCm, sideApDepthCm) / 2).toFixed(4));
  const hParameter = candidate.perimeterModel?.hParameter ?? null;

  const provenance = {
    measurementDefinitionId: MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID,
    selectedYcm: levelYcm,
    frontRasterRow: candidate.rasterRow,
    sideRasterRow: candidate.sideRasterRow ?? candidate.rasterRow,
    frontTransverseWidthCm: frontWidthCm,
    frontMinXcm: candidate.frontMinXcm ?? null,
    frontMaxXcm: candidate.frontMaxXcm ?? null,
    sideRawProfileSpanCm: candidate.sideRawProfileSpanCm ?? null,
    sideQualifiedApDepthCm: sideApDepthCm,
    sideMinUcm: candidate.sideMinUcm ?? null,
    sideMaxUcm: candidate.sideMaxUcm ?? null,
    plateauStartYcm: maximumSeatPlaneLocalization.plateau?.startYcm ?? null,
    plateauEndYcm: maximumSeatPlaneLocalization.plateau?.endYcm ?? null,
    plateauRowCount: maximumSeatPlaneLocalization.plateau?.rowCount ?? 1,
    hipAnchorYcm: maximumSeatPlaneLocalization.provenance?.hipAnchorYcm ?? null,
    offsetBelowHipCm: maximumSeatPlaneLocalization.provenance?.offsetBelowHipCm ?? null,
    firstSplitYcm: maximumSeatPlaneLocalization.provenance?.firstSplitYcm ?? null,
    clearanceAboveFirstSplitCm: maximumSeatPlaneLocalization.provenance?.clearanceAboveFirstSplitCm ?? null,
    sourceScanContract: maximumSeatPlaneLocalization.provenance?.sourceScanContract ?? 'pelvic-arbitrary-y-evidence-scan-v0',
    sourceLocalizationContract: maximumSeatPlaneLocalization.contract ?? 'maximum-seat-plane-localization-v0',
    sourceLocalizationStatus: localizationStatus,
    encounteredFrontClassIds: [...(candidate.encounteredFrontClassIds ?? [])],
    encounteredSideClassIds: [...(candidate.encounteredSideClassIds ?? [])],
    sliceHighlightCoordinates: maximumSeatPlaneLocalization.provenance?.sliceHighlightCoordinates
      ? { ...maximumSeatPlaneLocalization.provenance.sliceHighlightCoordinates }
      : null,
  };

  const inheritedWarnings = Array.isArray(maximumSeatPlaneLocalization.warnings)
    ? maximumSeatPlaneLocalization.warnings
    : [];

  return {
    contract: MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT,
    version: MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT_VERSION,
    id: MODELED_HIP_SEAT_CIRCUMFERENCE_DEFINITION_ID,
    name: MODELED_HIP_SEAT_CIRCUMFERENCE_DISPLAY_NAME,
    status: MODELED_HIP_SEAT_CIRCUMFERENCE_STATUS.MODELED,
    isModeled: true,
    isQualified: true,
    valueCm,
    levelYcm,
    model: {
      family: 'ellipse',
      implementation: candidate.perimeterModel?.implementation ?? 'ellipse_ramanujan_ii',
      semiMajorAxisCm,
      semiMinorAxisCm,
      transverseWidthCm: frontWidthCm,
      apDepthCm: sideApDepthCm,
      hParameter,
    },
    provenance,
    blockers: [],
    warnings: [...inheritedWarnings],
    issues: [],
    semantics: {
      statement: 'Pure deterministic ellipse-modeled Hip/Seat Circumference estimate at localized Maximum Seat Plane. NOT tape-measured ground truth, NOT measured body contour, NOT 3D reconstruction, NOT body volume, NOT validated against ground truth.',
      isModeled: true,
      isEstimatedCircumference: true,
      isMeasuredContour: false,
      isTapeMeasuredGroundTruth: false,
      is3dReconstruction: false,
      isBodyVolume: false,
      isValidatedAgainstGroundTruth: false,
    },
  };
}

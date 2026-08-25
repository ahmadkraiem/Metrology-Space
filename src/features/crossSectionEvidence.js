/**
 * Cross-Section Evidence Contract v0
 *
 * Pure deterministic domain contract that combines already-qualified Front transverse width
 * and Side AP physical depth observations at the same validated anatomical level into a
 * structured paired physical observation record.
 *
 * Contract: 'cross-section-evidence-v0'
 *
 * STRICT GUARDRAILS:
 * - Evidence pairing only: does NOT calculate or estimate circumference.
 * - Does NOT assume an ellipse model or use Ramanujan / perimeter formulas.
 * - Does NOT set semi-axes a = width/2, b = depth/2.
 * - Does NOT reconstruct a 3D slice, closed contour, or body volume.
 * - Does NOT fuse pointmaps or convert Side U to canonical Z.
 * - Does NOT synthesize missing values (no width-from-depth or depth-from-width inference).
 * - Supported for shared validated anatomical levels only: 'shoulder' and 'hip'.
 * - Reuses existing upstream contracts:
 *   - 'front-transverse-width-v0'
 *   - 'side-physical-depth-qualification-v0'
 *   - 'cross-view-measurement-correspondence-v0'
 *   - 'cross-view-comparability-qa-v0'
 *   - 'metric-calibration-provenance-v0'
 * - Preserves corrected Side T-pose semantics: advisory projected elbow deviation warnings
 *   in the 30°–45° range do NOT independently block Cross-Section Evidence when Side AP depth
 *   itself is already qualified.
 */

export const CROSS_SECTION_EVIDENCE_CONTRACT = 'cross-section-evidence-v0';
export const CROSS_SECTION_EVIDENCE_CONTRACT_VERSION = 'cross-section-evidence-v0';

/**
 * Exact 5-state status enum for Cross-Section Evidence.
 * @readonly
 * @enum {string}
 */
export const CROSS_SECTION_EVIDENCE_STATUS = Object.freeze({
  QUALIFIED: 'qualified',
  WARNING: 'warning',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Standard machine-readable blocker codes for Cross-Section Evidence.
 * @readonly
 * @enum {string}
 */
export const CROSS_SECTION_BLOCKER_CODES = Object.freeze({
  FRONT_WIDTH_UNAVAILABLE: 'front_width_unavailable',
  FRONT_WIDTH_NOT_VALID: 'front_width_not_valid',
  SIDE_DEPTH_UNAVAILABLE: 'side_depth_unavailable',
  SIDE_DEPTH_NOT_QUALIFIED: 'side_depth_not_qualified',
  CROSS_VIEW_CORRESPONDENCE_NOT_READY: 'cross_view_correspondence_not_ready',
  CROSS_VIEW_COMPARABILITY_FAILED: 'cross_view_comparability_failed',
  ANATOMICAL_LEVEL_MISMATCH: 'anatomical_level_mismatch',
  CALIBRATION_UNVALIDATED: 'calibration_unvalidated',
  CALIBRATION_INCOMPATIBLE: 'calibration_incompatible',
});

/**
 * Authoritative registry of supported Cross-Section Evidence definitions (v0).
 * Strictly mapped to existing validated Shoulder and Hip levels.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   sourceLevel: 'shoulder'|'hip',
 *   frontDefinitionId: string,
 *   sideDepthDefinitionId: string,
 *   sideProfileSpanDefinitionId: string,
 *   correspondenceId: string,
 *   supportPolicyId: string,
 * }>>}
 */
export const SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0 = Object.freeze({
  torso_cross_section_evidence_at_shoulder_level: Object.freeze({
    id: 'torso_cross_section_evidence_at_shoulder_level',
    name: 'Torso Cross-Section Evidence at Shoulder Level',
    sourceLevel: 'shoulder',
    frontDefinitionId: 'torso_width_at_shoulder_level',
    sideDepthDefinitionId: 'torso_ap_depth_at_shoulder_level',
    sideProfileSpanDefinitionId: 'torso_profile_span_at_shoulder_level',
    correspondenceId: 'torso_shoulder_cross_view_correspondence',
    supportPolicyId: 'trunk_core_support_v0',
  }),
  torso_cross_section_evidence_at_hip_level: Object.freeze({
    id: 'torso_cross_section_evidence_at_hip_level',
    name: 'Torso Cross-Section Evidence at Hip Level',
    sourceLevel: 'hip',
    frontDefinitionId: 'torso_width_at_hip_level',
    sideDepthDefinitionId: 'torso_ap_depth_at_hip_level',
    sideProfileSpanDefinitionId: 'torso_profile_span_at_hip_level',
    correspondenceId: 'torso_hip_cross_view_correspondence',
    supportPolicyId: 'pelvic_core_support_v0',
  }),
});

/**
 * Helper to build an empty / fallback cross-section evidence object.
 */
function buildEmptyCrossSectionEvidence({
  id = 'unsupported_cross_section_evidence',
  name = 'Unsupported Cross-Section Evidence',
  sourceLevel = null,
  levelYcm = null,
  status = CROSS_SECTION_EVIDENCE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  frontObservation = null,
  sideObservation = null,
  correspondence = null,
  calibrationCompatibility = null,
} = {}) {
  return {
    contract: CROSS_SECTION_EVIDENCE_CONTRACT,
    version: CROSS_SECTION_EVIDENCE_CONTRACT_VERSION,
    id,
    name,
    sourceLevel,
    levelYcm,
    frontObservation,
    sideObservation,
    correspondence,
    calibrationCompatibility,
    status,
    isQualified: status === CROSS_SECTION_EVIDENCE_STATUS.QUALIFIED,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Paired orthogonal physical observations (Front transverse width + Side AP depth) at matching anatomical level. NOT a reconstructed 3D slice, ellipse, or circumference.',
      isCircumferenceCalculated: false,
      isEllipseAssumed: false,
      is3dReconstruction: false,
    },
  };
}

/**
 * Evaluates pure deterministic Cross-Section Evidence from pre-computed constituent evidence objects.
 *
 * @param {{
 *   frontObservation?: object|null,
 *   sideDepthQualification?: object|null,
 *   correspondence?: object|null,
 *   comparabilityQa?: object|null,
 *   metricCalibrationFront?: object|null,
 *   metricCalibrationSide?: object|null,
 * }} evidence
 * @param {{
 *   definition?: typeof SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0[keyof typeof SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0]|string|null,
 * }} [options]
 * @returns {object} CrossSectionEvidenceResultV0
 */
export function evaluateCrossSectionEvidence({
  frontObservation = null,
  sideDepthQualification = null,
  correspondence = null,
  comparabilityQa = null,
  metricCalibrationFront = null,
  metricCalibrationSide = null,
} = {}, {
  definition = null,
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  // 1. Resolve Definition from Registry
  let resolvedDef = null;
  if (typeof definition === 'string') {
    resolvedDef = SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0[definition]
      ?? Object.values(SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0).find(
        (d) => d.id === definition || d.sourceLevel === definition || d.correspondenceId === definition,
      )
      ?? null;
  } else if (definition && typeof definition === 'object') {
    resolvedDef = definition;
  } else {
    // Try to infer from correspondence, frontObservation, or sideDepthQualification
    const candidateLevel = correspondence?.sourceLevel
      ?? frontObservation?.provenance?.sourceLevel
      ?? sideDepthQualification?.sourceLevel
      ?? null;
    if (candidateLevel) {
      resolvedDef = Object.values(SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0).find(
        (d) => d.sourceLevel === candidateLevel,
      ) ?? null;
    }
  }

  if (!resolvedDef || !resolvedDef.id || !resolvedDef.sourceLevel) {
    const rawDefName = typeof definition === 'string' ? definition : 'unknown';
    issues.push(`Definition '${rawDefName}' is not a recognized Cross-Section Evidence target.`);
    blockers.push(CROSS_SECTION_BLOCKER_CODES.ANATOMICAL_LEVEL_MISMATCH);
    return buildEmptyCrossSectionEvidence({
      id: typeof definition === 'string' ? definition : 'unrecognized_definition',
      name: 'Unrecognized Definition',
      sourceLevel: null,
      status: CROSS_SECTION_EVIDENCE_STATUS.INVALID,
      blockers,
      issues,
    });
  }

  const defId = resolvedDef.id;
  const defName = resolvedDef.name;
  const expectedLevel = resolvedDef.sourceLevel;

  let isStructuralInvalid = false;
  let isMissingEvidence = false;

  // 2. Evaluate Front Observation (front-transverse-width-v0)
  let frontRecord = null;
  let isFrontValid = false;

  if (!frontObservation || typeof frontObservation !== 'object') {
    blockers.push(CROSS_SECTION_BLOCKER_CODES.FRONT_WIDTH_UNAVAILABLE);
    isMissingEvidence = true;
  } else {
    const fContract = frontObservation.contract;
    const fView = frontObservation.view;
    const fStatus = frontObservation.status;
    const fWidthCm = (typeof frontObservation.valueCm === 'number' && Number.isFinite(frontObservation.valueCm) && frontObservation.valueCm > 0)
      ? frontObservation.valueCm
      : null;
    const fLevel = frontObservation.provenance?.sourceLevel ?? frontObservation.sourceLevel ?? null;
    const fLevelYcm = frontObservation.provenance?.levelYcm ?? null;

    if (fContract !== 'front-transverse-width-v0' || fView !== 'front') {
      issues.push(`Invalid Front observation: expected contract 'front-transverse-width-v0' view 'front', received '${fContract}' view '${fView}'.`);
      isStructuralInvalid = true;
    }

    if (fLevel && fLevel !== expectedLevel) {
      issues.push(`Mismatched Front observation sourceLevel: expected '${expectedLevel}', received '${fLevel}'.`);
      isStructuralInvalid = true;
    }

    if (fStatus === 'valid' && fWidthCm !== null) {
      isFrontValid = true;
    } else if (fStatus === 'unavailable') {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.FRONT_WIDTH_UNAVAILABLE);
      isMissingEvidence = true;
    } else {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.FRONT_WIDTH_NOT_VALID);
      issues.push(`Front transverse width observation is not valid (status: '${fStatus}').`);
    }

    frontRecord = {
      view: 'front',
      id: frontObservation.id ?? resolvedDef.frontDefinitionId,
      name: frontObservation.name ?? 'Front Transverse Width',
      type: 'transverse_width',
      transverseWidthCm: fWidthCm,
      status: fStatus ?? 'unavailable',
      isPhysicallyQualified: isFrontValid,
      provenance: {
        sourceLevel: fLevel,
        levelYcm: fLevelYcm,
        sampledPixelRow: frontObservation.provenance?.sampledPixelRow ?? null,
        supportPolicyId: frontObservation.provenance?.supportPolicyId ?? resolvedDef.supportPolicyId,
        actualClassIdsUsed: frontObservation.provenance?.actualClassIdsUsed ?? [],
        clothingClassIdsUsed: frontObservation.provenance?.clothingClassIdsUsed ?? [],
        usedClothingEvidence: Boolean(frontObservation.provenance?.usedClothingEvidence),
        leftXcm: frontObservation.provenance?.leftXcm ?? null,
        rightXcm: frontObservation.provenance?.rightXcm ?? null,
      },
    };
  }

  // 3. Evaluate Side AP Depth Qualification (side-physical-depth-qualification-v0)
  let sideRecord = null;
  let isSideQualified = false;

  if (!sideDepthQualification || typeof sideDepthQualification !== 'object') {
    blockers.push(CROSS_SECTION_BLOCKER_CODES.SIDE_DEPTH_UNAVAILABLE);
    isMissingEvidence = true;
  } else {
    const sContract = sideDepthQualification.contract;
    const sStatus = sideDepthQualification.status;
    const sDepthCm = (typeof sideDepthQualification.qualifiedDepthEstimateCm === 'number'
      && Number.isFinite(sideDepthQualification.qualifiedDepthEstimateCm)
      && sideDepthQualification.qualifiedDepthEstimateCm > 0)
      ? sideDepthQualification.qualifiedDepthEstimateCm
      : null;
    const sProjectedSpanCm = (typeof sideDepthQualification.projectedSpanCm === 'number' && Number.isFinite(sideDepthQualification.projectedSpanCm))
      ? sideDepthQualification.projectedSpanCm
      : null;
    const sLevel = sideDepthQualification.sourceLevel ?? sideDepthQualification.provenance?.sourceLevel ?? null;
    const sLevelYcm = sideDepthQualification.levelYcm ?? sideDepthQualification.provenance?.levelYcm ?? null;

    if (sContract !== 'side-physical-depth-qualification-v0') {
      issues.push(`Invalid Side depth qualification: expected contract 'side-physical-depth-qualification-v0', received '${sContract}'.`);
      isStructuralInvalid = true;
    }

    if (sLevel && sLevel !== expectedLevel) {
      issues.push(`Mismatched Side depth qualification sourceLevel: expected '${expectedLevel}', received '${sLevel}'.`);
      isStructuralInvalid = true;
    }

    if (sStatus === 'qualified' && sDepthCm !== null) {
      isSideQualified = true;
      // Forward any advisory diagnostic warnings from Side depth (e.g. moderate projected elbow bend 30-45°)
      if (Array.isArray(sideDepthQualification.warnings) && sideDepthQualification.warnings.length > 0) {
        for (const w of sideDepthQualification.warnings) {
          warnings.push(w);
        }
      }
    } else if (sStatus === 'unavailable') {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.SIDE_DEPTH_UNAVAILABLE);
      isMissingEvidence = true;
    } else {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.SIDE_DEPTH_NOT_QUALIFIED);
      issues.push(`Side physical depth is not qualified (status: '${sStatus}').`);
      if (Array.isArray(sideDepthQualification.issues) && sideDepthQualification.issues.length > 0) {
        for (const is of sideDepthQualification.issues) {
          issues.push(`Side depth issue: ${is}`);
        }
      }
    }

    sideRecord = {
      view: 'side',
      id: sideDepthQualification.id ?? resolvedDef.sideDepthDefinitionId,
      name: sideDepthQualification.name ?? 'Torso AP Depth Estimate',
      type: 'physical_ap_depth_estimate',
      apDepthCm: sDepthCm,
      projectedSpanCm: sProjectedSpanCm,
      status: sStatus ?? 'unavailable',
      isPhysicallyQualified: isSideQualified,
      provenance: {
        sourceLevel: sLevel,
        levelYcm: sLevelYcm,
        sampledPixelRow: sideDepthQualification.provenance?.sampledPixelRow ?? null,
        supportPolicyId: sideDepthQualification.provenance?.supportPolicyId ?? resolvedDef.supportPolicyId,
        actualClassIdsUsed: sideDepthQualification.provenance?.actualClassIdsUsed ?? [],
        clothingClassIdsUsed: sideDepthQualification.provenance?.clothingClassIdsUsed ?? [],
        usedClothingEvidence: Boolean(sideDepthQualification.provenance?.usedClothingEvidence),
        tPoseStatus: sideDepthQualification.provenance?.tPoseStatus ?? null,
        lateralOrientationStatus: sideDepthQualification.provenance?.lateralOrientationStatus ?? null,
        metricCalibrationStatus: sideDepthQualification.provenance?.metricCalibrationStatus ?? null,
      },
    };
  }

  // 4. Evaluate Cross-View Correspondence & Comparability
  let correspondenceRecord = null;
  let isCorrespondenceReady = false;
  let isComparabilityPassed = false;

  const frontY = frontRecord?.provenance?.levelYcm ?? null;
  const sideY = sideRecord?.provenance?.levelYcm ?? null;
  const hasFrontY = typeof frontY === 'number' && Number.isFinite(frontY);
  const hasSideY = typeof sideY === 'number' && Number.isFinite(sideY);
  let deltaYcm = null;

  if (hasFrontY && hasSideY) {
    deltaYcm = Math.abs(frontY - sideY);
    if (deltaYcm > 1e-4) {
      issues.push(`Contradictory vertical Y provenance: Front levelYcm (${frontY}) does not match Side levelYcm (${sideY}).`);
      isStructuralInvalid = true;
    }
  }

  const corrStatus = correspondence?.status ?? null;
  const qaStatus = comparabilityQa?.status ?? null;

  if (correspondence) {
    if (correspondence.contract !== 'cross-view-measurement-correspondence-v0') {
      issues.push(`Invalid correspondence contract: expected 'cross-view-measurement-correspondence-v0', received '${correspondence.contract}'.`);
      isStructuralInvalid = true;
    }
    if (correspondence.sourceLevel && correspondence.sourceLevel !== expectedLevel) {
      issues.push(`Correspondence sourceLevel '${correspondence.sourceLevel}' mismatch for expected '${expectedLevel}'.`);
      isStructuralInvalid = true;
    }
    if (corrStatus === 'ready') {
      isCorrespondenceReady = true;
    } else if (corrStatus === 'unavailable') {
      isMissingEvidence = true;
    } else {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_CORRESPONDENCE_NOT_READY);
      issues.push(`Cross-view correspondence is not ready (status: '${corrStatus}').`);
    }
  } else if (!isMissingEvidence) {
    // If correspondence object was not passed directly, but front and side observations exist and match
    if (isFrontValid && isSideQualified && !isStructuralInvalid) {
      isCorrespondenceReady = true;
    } else {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_CORRESPONDENCE_NOT_READY);
    }
  }

  if (comparabilityQa) {
    if (comparabilityQa.contract !== 'cross-view-comparability-qa-v0') {
      issues.push(`Invalid comparability QA contract: expected 'cross-view-comparability-qa-v0', received '${comparabilityQa.contract}'.`);
      isStructuralInvalid = true;
    }
    if (qaStatus === 'pass') {
      isComparabilityPassed = true;
    } else if (qaStatus === 'warning') {
      isComparabilityPassed = true;
      if (Array.isArray(comparabilityQa.warnings) && comparabilityQa.warnings.length > 0) {
        for (const w of comparabilityQa.warnings) {
          warnings.push(w);
        }
      }
    } else if (qaStatus === 'unavailable') {
      isMissingEvidence = true;
    } else {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_COMPARABILITY_FAILED);
      issues.push(`Cross-view comparability QA failed (status: '${qaStatus}').`);
    }
  } else if (!isMissingEvidence) {
    // If comparability object was not passed directly, default to pass if correspondence is ready and structure is valid
    if (isCorrespondenceReady && !isStructuralInvalid) {
      isComparabilityPassed = true;
    }
  }

  correspondenceRecord = {
    id: correspondence?.id ?? resolvedDef.correspondenceId,
    status: corrStatus ?? (isCorrespondenceReady ? 'ready' : (isMissingEvidence ? 'unavailable' : 'invalid')),
    comparabilityQaStatus: qaStatus ?? (isComparabilityPassed ? 'pass' : (isMissingEvidence ? 'unavailable' : 'fail')),
    frontLevelYcm: frontY,
    sideLevelYcm: sideY,
    deltaYcm,
    isCompatible: isCorrespondenceReady && isComparabilityPassed && !isStructuralInvalid,
  };

  // 5. Evaluate Metric Calibration Compatibility
  let isCalibrationCompatible = true;
  let frontCalStatus = metricCalibrationFront?.status ?? null;
  let sideCalStatus = metricCalibrationSide?.status ?? null;

  if (metricCalibrationFront) {
    if (frontCalStatus !== 'validated' || metricCalibrationFront.metricProjectedEligibility !== true) {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_UNVALIDATED);
      issues.push(`Front metric calibration is not validated (status: '${frontCalStatus}').`);
      isCalibrationCompatible = false;
    }
  }

  if (metricCalibrationSide) {
    if (sideCalStatus !== 'validated' || metricCalibrationSide.metricProjectedEligibility !== true) {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_UNVALIDATED);
      issues.push(`Side metric calibration is not validated (status: '${sideCalStatus}').`);
      isCalibrationCompatible = false;
    }
  }

  if (metricCalibrationFront && metricCalibrationSide && frontCalStatus === 'validated' && sideCalStatus === 'validated') {
    const fScale = metricCalibrationFront.summary?.scaleCmPerPx ?? metricCalibrationFront.calibration?.scaleCmPerPx;
    const sScale = metricCalibrationSide.summary?.scaleCmPerPx ?? metricCalibrationSide.calibration?.scaleCmPerPx;
    if (typeof fScale === 'number' && typeof sScale === 'number' && Math.abs(fScale - sScale) > 1e-4) {
      blockers.push(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_INCOMPATIBLE);
      issues.push(`Metric calibration scale factor mismatch between Front (${fScale}) and Side (${sScale}).`);
      isCalibrationCompatible = false;
    }
  }

  const calibrationRecord = {
    frontStatus: frontCalStatus ?? 'validated',
    sideStatus: sideCalStatus ?? 'validated',
    isCompatible: isCalibrationCompatible,
  };

  // 6. Overall Status Resolution
  const resolvedLevelYcm = hasFrontY ? frontY : (hasSideY ? sideY : null);

  let finalStatus;
  let isQualified = false;

  const hasActiveDisqualification = blockers.includes(CROSS_SECTION_BLOCKER_CODES.FRONT_WIDTH_NOT_VALID)
    || blockers.includes(CROSS_SECTION_BLOCKER_CODES.SIDE_DEPTH_NOT_QUALIFIED)
    || blockers.includes(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_COMPARABILITY_FAILED)
    || (isFrontValid && isSideQualified && (
      blockers.includes(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_UNVALIDATED)
      || blockers.includes(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_INCOMPATIBLE)
      || blockers.includes(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_CORRESPONDENCE_NOT_READY)
    ));

  if (isStructuralInvalid) {
    finalStatus = CROSS_SECTION_EVIDENCE_STATUS.INVALID;
  } else if (isFrontValid && isSideQualified && isCorrespondenceReady && isComparabilityPassed && isCalibrationCompatible) {
    finalStatus = CROSS_SECTION_EVIDENCE_STATUS.QUALIFIED;
    isQualified = true;
  } else if (hasActiveDisqualification) {
    finalStatus = CROSS_SECTION_EVIDENCE_STATUS.BLOCKED;
  } else if (isMissingEvidence || !frontObservation || !sideDepthQualification) {
    finalStatus = CROSS_SECTION_EVIDENCE_STATUS.UNAVAILABLE;
  } else {
    finalStatus = CROSS_SECTION_EVIDENCE_STATUS.BLOCKED;
  }

  return {
    contract: CROSS_SECTION_EVIDENCE_CONTRACT,
    version: CROSS_SECTION_EVIDENCE_CONTRACT_VERSION,
    id: defId,
    name: defName,
    sourceLevel: expectedLevel,
    levelYcm: resolvedLevelYcm,
    frontObservation: frontRecord,
    sideObservation: sideRecord,
    correspondence: correspondenceRecord,
    calibrationCompatibility: calibrationRecord,
    status: finalStatus,
    isQualified,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Paired orthogonal physical observations (Front transverse width + Side AP depth) at matching anatomical level. NOT a reconstructed 3D slice, ellipse, or circumference.',
      isCircumferenceCalculated: false,
      isEllipseAssumed: false,
      is3dReconstruction: false,
    },
  };
}

/**
 * Modeled Cross-Section Perimeter Contract v0
 *
 * Pure deterministic domain contract that estimates a modeled cross-sectional
 * perimeter at the validated Hip Landmark Level using an ellipse model
 * (Ramanujan II perimeter approximation) over already-qualified Cross-Section Evidence.
 *
 * Contract: 'modeled-cross-section-perimeter-v0'
 *
 * STRICT GUARDRAILS:
 * - Pure downstream interpretation: consumes pre-computed 'cross-section-evidence-v0';
 *   does NOT rescan rasters, re-read buffers, re-run calibration, re-align, or fuse 3D coordinates.
 * - Modeled perimeter only: NOT a measured contour length, NOT a reconstructed 3D slice,
 *   NOT a reconstructed body contour, NOT canonical Z geometry, and NOT body volume.
 * - NOT anthropometric Hip Circumference and NOT maximum Hip/Seat Circumference (the current
 *   bilateral hip landmark level is not qualified as the maximum buttock / seat plane).
 * - Supported for Hip Landmark Level only ('torso_modeled_perimeter_at_hip_landmark_level').
 * - Shoulder is explicitly UNSUPPORTED and produces no numeric perimeter.
 * - Does NOT introduce Side U -> Z, pointmap Z, surface normals, anthropometric priors,
 *   BMI/body-type priors, empirical correction factors, or clothing offsets.
 */

export const MODELED_CROSS_SECTION_PERIMETER_CONTRACT = 'modeled-cross-section-perimeter-v0';
export const MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION = 'modeled-cross-section-perimeter-v0';

/**
 * 4-state deterministic status enum for Modeled Cross-Section Perimeter.
 * @readonly
 * @enum {string}
 */
export const MODELED_CROSS_SECTION_PERIMETER_STATUS = Object.freeze({
  MODELED: 'modeled',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Authoritative registry of supported Modeled Cross-Section Perimeter definitions (v0).
 * Exactly ONE definition is supported: Hip Landmark Level.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   sourceLevel: 'hip',
 *   sourceCrossSectionDefinitionId: string,
 *   modelFamily: 'ellipse',
 *   modelImplementation: 'ellipse_ramanujan_ii',
 * }>>}
 */
export const SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0 = Object.freeze({
  torso_modeled_perimeter_at_hip_landmark_level: Object.freeze({
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    name: 'Torso Modeled Perimeter Estimate at Hip Landmark Level',
    sourceLevel: 'hip',
    sourceCrossSectionDefinitionId: 'torso_cross_section_evidence_at_hip_level',
    modelFamily: 'ellipse',
    modelImplementation: 'ellipse_ramanujan_ii',
  }),
});

/**
 * Computes Ramanujan II ellipse perimeter approximation from semi-axes or diameters.
 *
 * Let:
 *   a = width / 2
 *   b = depth / 2
 *   h = ((a - b) ** 2) / ((a + b) ** 2)
 *
 * P = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
 *
 * @param {number} widthCm - Front transverse width in cm (> 0, finite)
 * @param {number} depthCm - Qualified Side AP depth estimate in cm (> 0, finite)
 * @returns {{ perimeterCm: number, semiMajorAxisCm: number, semiMinorAxisCm: number, hParameter: number }|null}
 */
export function computeRamanujanEllipsePerimeter(widthCm, depthCm) {
  if (
    typeof widthCm !== 'number'
    || !Number.isFinite(widthCm)
    || widthCm <= 0
    || typeof depthCm !== 'number'
    || !Number.isFinite(depthCm)
    || depthCm <= 0
  ) {
    return null;
  }

  const a = widthCm / 2;
  const b = depthCm / 2;
  const sum = a + b;
  const diff = a - b;
  const h = (diff ** 2) / (sum ** 2);

  const denominator = 10 + Math.sqrt(4 - 3 * h);
  const factor = 1 + (3 * h) / denominator;
  const perimeterCm = Math.PI * sum * factor;

  return {
    perimeterCm,
    semiMajorAxisCm: Math.max(a, b),
    semiMinorAxisCm: Math.min(a, b),
    hParameter: h,
  };
}

/**
 * Helper to build empty / fallback modeled cross-section perimeter result.
 */
function buildEmptyModeledCrossSectionPerimeter({
  id = 'unsupported_modeled_cross_section_perimeter',
  name = 'Unsupported Modeled Cross-Section Perimeter',
  sourceLevel = null,
  levelYcm = null,
  status = MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  model = null,
  provenance = null,
} = {}) {
  return {
    contract: MODELED_CROSS_SECTION_PERIMETER_CONTRACT,
    version: MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION,
    id,
    name,
    sourceLevel,
    levelYcm,
    status,
    isModeled: status === MODELED_CROSS_SECTION_PERIMETER_STATUS.MODELED,
    isQualified: status === MODELED_CROSS_SECTION_PERIMETER_STATUS.MODELED,
    valueCm: null,
    model,
    provenance,
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Pure deterministic ellipse-modeled perimeter estimate at hip landmark level. NOT measured contour length, NOT 3D slice, NOT canonical Z, NOT anthropometric Hip Circumference, NOT maximum Hip/Seat Circumference, NOT maximum buttock plane.',
      isModeledQuantity: true,
      isMeasuredContour: false,
      isAnthropometricHipCircumference: false,
      isMaximumSeatPlane: false,
      is3dReconstruction: false,
      isBodyVolume: false,
    },
  };
}

/**
 * Evaluates pure deterministic Modeled Cross-Section Perimeter from pre-computed Cross-Section Evidence.
 *
 * @param {object|null} crossSectionEvidence - CrossSectionEvidenceResultV0 ('cross-section-evidence-v0')
 * @param {{
 *   definition?: typeof SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0[keyof typeof SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0]|string|null,
 * }} [options]
 * @returns {object} ModeledCrossSectionPerimeterResultV0
 */
export function evaluateModeledCrossSectionPerimeter(crossSectionEvidence, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const targetDefinition = options?.definition ?? null;

  // 1. Resolve Definition from Registry
  let resolvedDef = null;
  if (typeof targetDefinition === 'string') {
    resolvedDef = SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0[targetDefinition]
      ?? Object.values(SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0).find(
        (d) => d.id === targetDefinition || d.sourceLevel === targetDefinition || d.sourceCrossSectionDefinitionId === targetDefinition,
      )
      ?? null;
  } else if (targetDefinition && typeof targetDefinition === 'object' && targetDefinition.id) {
    resolvedDef = SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0[targetDefinition.id] ?? targetDefinition;
  } else if (!targetDefinition) {
    // If no explicit definition passed, infer from crossSectionEvidence or default to single v0 Hip definition
    const candidateLevel = crossSectionEvidence?.sourceLevel ?? null;
    if (candidateLevel) {
      resolvedDef = Object.values(SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0).find(
        (d) => d.sourceLevel === candidateLevel,
      ) ?? null;
    } else {
      resolvedDef = SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0.torso_modeled_perimeter_at_hip_landmark_level;
    }
  }

  // Handle explicit Shoulder request or any other unsupported definition
  const rawTargetName = typeof targetDefinition === 'string'
    ? targetDefinition
    : (targetDefinition?.id ?? crossSectionEvidence?.id ?? 'unknown');

  if (
    rawTargetName.includes('shoulder')
    || targetDefinition === 'shoulder'
    || crossSectionEvidence?.sourceLevel === 'shoulder'
  ) {
    issues.push('Shoulder modeled perimeter is unsupported. Shoulder cross-section geometry cannot be assumed as an ellipse model.');
    return buildEmptyModeledCrossSectionPerimeter({
      id: typeof targetDefinition === 'string' ? targetDefinition : (crossSectionEvidence?.id ? 'torso_modeled_perimeter_at_shoulder_level' : 'unsupported_definition'),
      name: 'Torso Modeled Perimeter at Shoulder Level (Unsupported)',
      sourceLevel: 'shoulder',
      levelYcm: crossSectionEvidence?.levelYcm ?? null,
      status: MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID,
      blockers: ['shoulder_perimeter_unsupported'],
      issues,
    });
  }

  if (!resolvedDef || !resolvedDef.id || resolvedDef.sourceLevel !== 'hip') {
    issues.push(`Definition '${rawTargetName}' is not a recognized Modeled Cross-Section Perimeter target.`);
    return buildEmptyModeledCrossSectionPerimeter({
      id: typeof targetDefinition === 'string' ? targetDefinition : 'unrecognized_definition',
      name: 'Unrecognized Definition',
      sourceLevel: null,
      status: MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID,
      blockers: ['definition_unsupported'],
      issues,
    });
  }

  const defId = resolvedDef.id;
  const defName = resolvedDef.name;
  const expectedLevel = resolvedDef.sourceLevel; // 'hip'

  // 2. Validate source Cross-Section Evidence
  if (!crossSectionEvidence || typeof crossSectionEvidence !== 'object') {
    blockers.push('cross_section_evidence_unavailable');
    return buildEmptyModeledCrossSectionPerimeter({
      id: defId,
      name: defName,
      sourceLevel: expectedLevel,
      status: MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE,
      blockers,
      issues: ['Source cross-section evidence is missing.'],
    });
  }

  // Contract check
  if (crossSectionEvidence.contract !== 'cross-section-evidence-v0') {
    issues.push(`Invalid source contract: expected 'cross-section-evidence-v0', received '${crossSectionEvidence.contract}'.`);
    return buildEmptyModeledCrossSectionPerimeter({
      id: defId,
      name: defName,
      sourceLevel: expectedLevel,
      status: MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID,
      blockers: ['cross_section_contract_invalid'],
      issues,
    });
  }

  // Level check
  if (crossSectionEvidence.sourceLevel !== expectedLevel) {
    issues.push(`Source cross-section level mismatch: expected '${expectedLevel}', received '${crossSectionEvidence.sourceLevel}'.`);
    return buildEmptyModeledCrossSectionPerimeter({
      id: defId,
      name: defName,
      sourceLevel: crossSectionEvidence.sourceLevel ?? expectedLevel,
      status: MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID,
      blockers: ['source_level_mismatch'],
      issues,
    });
  }

  // Propagate upstream warnings
  if (Array.isArray(crossSectionEvidence.warnings) && crossSectionEvidence.warnings.length > 0) {
    for (const w of crossSectionEvidence.warnings) {
      warnings.push(w);
    }
  }

  const isUpstreamQualified = crossSectionEvidence.status === 'qualified' && crossSectionEvidence.isQualified === true;
  const widthCm = crossSectionEvidence.frontObservation?.transverseWidthCm ?? null;
  const depthCm = crossSectionEvidence.sideObservation?.apDepthCm ?? null;
  const levelYcm = crossSectionEvidence.levelYcm ?? null;

  const hasValidWidth = typeof widthCm === 'number' && Number.isFinite(widthCm) && widthCm > 0;
  const hasValidDepth = typeof depthCm === 'number' && Number.isFinite(depthCm) && depthCm > 0;

  if (!hasValidWidth) {
    issues.push(`Front transverse width is invalid or missing: ${widthCm}.`);
  }
  if (!hasValidDepth) {
    issues.push(`Side AP depth is invalid or missing: ${depthCm}.`);
  }

  const provenance = {
    sourceCrossSectionContract: crossSectionEvidence.contract,
    sourceCrossSectionId: crossSectionEvidence.id,
    sourceCrossSectionStatus: crossSectionEvidence.status,
    sourceLevel: expectedLevel,
    levelYcm,
    frontObservationId: crossSectionEvidence.frontObservation?.id ?? null,
    frontTransverseWidthCm: widthCm,
    frontObservationStatus: crossSectionEvidence.frontObservation?.status ?? null,
    sideObservationId: crossSectionEvidence.sideObservation?.id ?? null,
    sideApDepthCm: depthCm,
    sideObservationStatus: crossSectionEvidence.sideObservation?.status ?? null,
    correspondenceId: crossSectionEvidence.correspondence?.id ?? null,
    isCorrespondenceCompatible: Boolean(crossSectionEvidence.correspondence?.isCompatible),
  };

  // Status resolution
  if (!isUpstreamQualified || !hasValidWidth || !hasValidDepth) {
    let fallbackStatus;
    if (crossSectionEvidence.status === 'unavailable') {
      fallbackStatus = MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE;
      blockers.push('cross_section_evidence_unavailable');
    } else if (crossSectionEvidence.status === 'invalid' || !hasValidWidth || !hasValidDepth) {
      fallbackStatus = MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID;
      blockers.push('cross_section_evidence_invalid');
    } else {
      fallbackStatus = MODELED_CROSS_SECTION_PERIMETER_STATUS.BLOCKED;
      blockers.push('cross_section_evidence_not_qualified');
      if (Array.isArray(crossSectionEvidence.blockers)) {
        for (const b of crossSectionEvidence.blockers) {
          blockers.push(`upstream_${b}`);
        }
      }
    }

    return {
      contract: MODELED_CROSS_SECTION_PERIMETER_CONTRACT,
      version: MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION,
      id: defId,
      name: defName,
      sourceLevel: expectedLevel,
      levelYcm,
      status: fallbackStatus,
      isModeled: false,
      isQualified: false,
      valueCm: null,
      model: {
        family: resolvedDef.modelFamily,
        implementation: resolvedDef.modelImplementation,
        semiMajorAxisCm: null,
        semiMinorAxisCm: null,
        transverseWidthCm: widthCm,
        apDepthCm: depthCm,
        hParameter: null,
      },
      provenance,
      blockers,
      warnings,
      issues: [...issues, ...(crossSectionEvidence.issues ?? [])],
      semantics: {
        statement: 'Pure deterministic ellipse-modeled perimeter estimate at hip landmark level. NOT measured contour length, NOT 3D slice, NOT canonical Z, NOT anthropometric Hip Circumference, NOT maximum Hip/Seat Circumference, NOT maximum buttock plane.',
        isModeledQuantity: true,
        isMeasuredContour: false,
        isAnthropometricHipCircumference: false,
        isMaximumSeatPlane: false,
        is3dReconstruction: false,
        isBodyVolume: false,
      },
    };
  }

  // 3. Compute Ramanujan II Ellipse Perimeter
  const ellipseCalc = computeRamanujanEllipsePerimeter(widthCm, depthCm);
  if (!ellipseCalc) {
    issues.push(`Failed to calculate Ramanujan II ellipse perimeter from width (${widthCm}) and depth (${depthCm}).`);
    return buildEmptyModeledCrossSectionPerimeter({
      id: defId,
      name: defName,
      sourceLevel: expectedLevel,
      levelYcm,
      status: MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID,
      blockers: ['calculation_failed'],
      issues,
      provenance,
    });
  }

  return {
    contract: MODELED_CROSS_SECTION_PERIMETER_CONTRACT,
    version: MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION,
    id: defId,
    name: defName,
    sourceLevel: expectedLevel,
    levelYcm,
    status: MODELED_CROSS_SECTION_PERIMETER_STATUS.MODELED,
    isModeled: true,
    isQualified: true,
    valueCm: ellipseCalc.perimeterCm,
    model: {
      family: resolvedDef.modelFamily,
      implementation: resolvedDef.modelImplementation,
      semiMajorAxisCm: ellipseCalc.semiMajorAxisCm,
      semiMinorAxisCm: ellipseCalc.semiMinorAxisCm,
      transverseWidthCm: widthCm,
      apDepthCm: depthCm,
      hParameter: ellipseCalc.hParameter,
    },
    provenance,
    blockers: [],
    warnings,
    issues: [],
    semantics: {
      statement: 'Pure deterministic ellipse-modeled perimeter estimate at hip landmark level. NOT measured contour length, NOT 3D slice, NOT canonical Z, NOT anthropometric Hip Circumference, NOT maximum Hip/Seat Circumference, NOT maximum buttock plane.',
      isModeledQuantity: true,
      isMeasuredContour: false,
      isAnthropometricHipCircumference: false,
      isMaximumSeatPlane: false,
      is3dReconstruction: false,
      isBodyVolume: false,
    },
  };
}

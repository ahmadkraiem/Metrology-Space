/**
 * Physical Measurement Semantics Contract v0
 *
 * Pure deterministic qualification layer determining whether a 2D metric projected measurement
 * (Front transverse width or Side profile span) may be promoted to a validated physical anatomical dimension.
 *
 * Contract: 'physical-measurement-semantics-v0'
 *
 * STRICT GUARDRAILS:
 * - Decoupled from metric calibration: evaluates capture protocol, view categorization, and physical evidence paths.
 * - Authoritative evidence path required: boolean flags are strictly rejected; recognized evidence contracts only.
 * - 'physicalEligibility: true' populates physicalSpanCm as a 1D scalar body dimension in cm.
 * - Does NOT convert Side U to canonical Z, does NOT fuse Front/Side coordinates, and does NOT compute 3D geometry.
 */

export const PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT = 'physical-measurement-semantics-v0';
export const PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT_VERSION = 'physical-measurement-semantics-v0';

/**
 * Deterministic status taxonomy for Physical Measurement Semantics.
 * @readonly
 * @enum {string}
 */
export const PHYSICAL_SEMANTICS_STATUS = Object.freeze({
  VALIDATED: 'validated',
  PROJECTED_METRIC_ONLY: 'projected_metric_only',
  UNVALIDATED: 'unvalidated',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

/**
 * Registry of recognized structured physical evidence contract identifiers.
 * Physical eligibility requires at least one recognized contract with valid status.
 */
export const SUPPORTED_PHYSICAL_EVIDENCE_CONTRACTS = Object.freeze([
  'controlled-capture-protocol-v0',
  'calibrated-camera-projection-v0',
  'metric-reference-fiducial-v0',
  'empirical-body-capture-calibration-v0',
  'validated-dense-geometry-v0',
]);

/**
 * Authoritative registry of supported Front and Side physical measurement definitions.
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   view: 'front'|'side',
 *   sourceLevel: 'shoulder'|'hip',
 *   domainType: 'transverse_width'|'profile_span',
 *   expectedObservationContract: string,
 * }>>}
 */
export const SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0 = Object.freeze({
  torso_width_at_shoulder_level: Object.freeze({
    id: 'torso_width_at_shoulder_level',
    name: 'Torso Transverse Width at Shoulder Level',
    view: 'front',
    sourceLevel: 'shoulder',
    domainType: 'transverse_width',
    expectedObservationContract: 'front-transverse-width-v0',
  }),
  torso_transverse_width_at_shoulder_level: Object.freeze({
    id: 'torso_transverse_width_at_shoulder_level',
    name: 'Torso Transverse Width at Shoulder Level',
    view: 'front',
    sourceLevel: 'shoulder',
    domainType: 'transverse_width',
    expectedObservationContract: 'front-transverse-width-v0',
  }),
  torso_width_at_hip_level: Object.freeze({
    id: 'torso_width_at_hip_level',
    name: 'Torso Transverse Width at Hip Level',
    view: 'front',
    sourceLevel: 'hip',
    domainType: 'transverse_width',
    expectedObservationContract: 'front-transverse-width-v0',
  }),
  torso_transverse_width_at_hip_level: Object.freeze({
    id: 'torso_transverse_width_at_hip_level',
    name: 'Torso Transverse Width at Hip Level',
    view: 'front',
    sourceLevel: 'hip',
    domainType: 'transverse_width',
    expectedObservationContract: 'front-transverse-width-v0',
  }),
  torso_profile_span_at_shoulder_level: Object.freeze({
    id: 'torso_profile_span_at_shoulder_level',
    name: 'Torso Profile Span at Shoulder Level',
    view: 'side',
    sourceLevel: 'shoulder',
    domainType: 'profile_span',
    expectedObservationContract: 'side-profile-span-v0',
  }),
  torso_profile_span_at_hip_level: Object.freeze({
    id: 'torso_profile_span_at_hip_level',
    name: 'Torso Profile Span at Hip Level',
    view: 'side',
    sourceLevel: 'hip',
    domainType: 'profile_span',
    expectedObservationContract: 'side-profile-span-v0',
  }),
});

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   status: 'pass'|'fail'|'warning'|'skip',
 *   message: string,
 * }} PhysicalSemanticsCheckResult
 */

/**
 * @typedef {{
 *   contract: 'physical-measurement-semantics-v0',
 *   version: 'physical-measurement-semantics-v0',
 *   id: string,
 *   name: string,
 *   view: 'front'|'side'|string,
 *   sourceLevel: string|null,
 *   domainType: 'transverse_width'|'profile_span'|string,
 *   status: 'validated'|'projected_metric_only'|'unvalidated'|'invalid'|'unavailable',
 *   metricProjectedEligibility: boolean,
 *   physicalEligibility: boolean,
 *   workspaceSpanCm: number|null,
 *   metricProjectedSpanCm: number|null,
 *   physicalSpanCm: number|null,
 *   summary: {
 *     totalChecks: number,
 *     passedChecks: number,
 *     failedChecks: number,
 *     warnedChecks: number,
 *     skippedChecks: number,
 *   },
 *   checks: Record<string, PhysicalSemanticsCheckResult>,
 *   validatedPhysicalEvidencePaths: string[],
 *   missingPhysicalRequirements: string[],
 *   issues: string[],
 *   warnings: string[],
 * }} PhysicalMeasurementSemanticsResultV0
 */

/**
 * Evaluates pure deterministic physical measurement semantics for an observation.
 *
 * @param {object|null|undefined} observation - Source measurement observation (Front transverse width or Side profile span)
 * @param {{
 *   calibrationProvenance?: object|null,
 *   viewCalibration?: object|null,
 *   physicalEvidencePaths?: Array<object>|object|null,
 *   definition?: typeof SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[keyof typeof SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0]|string|null,
 * }} [options]
 * @returns {PhysicalMeasurementSemanticsResultV0}
 */
export function evaluatePhysicalMeasurementSemantics(observation, {
  calibrationProvenance = null,
  viewCalibration = null,
  physicalEvidencePaths = null,
  definition = null,
} = {}) {
  const issues = [];
  const warnings = [];
  const checks = {};

  const resolvedDef = (typeof definition === 'string')
    ? (SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[definition] ?? null)
    : (definition && typeof definition === 'object' ? definition : null)
    ?? (observation?.id ? SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[observation.id] ?? null : null);

  const defId = resolvedDef?.id ?? observation?.id ?? 'custom_measurement';
  const defName = resolvedDef?.name ?? observation?.name ?? 'Physical Measurement';
  const defView = resolvedDef?.view ?? observation?.view ?? 'unspecified';
  const defLevel = resolvedDef?.sourceLevel ?? observation?.provenance?.sourceLevel ?? null;
  const defDomainType = resolvedDef?.domainType ?? observation?.type ?? 'measurement';

  function recordCheck(checkId, name, checkStatus, message) {
    checks[checkId] = {
      id: checkId,
      name,
      status: checkStatus,
      message,
    };
    if (checkStatus === 'fail') {
      issues.push(`[${checkId}] ${message}`);
    } else if (checkStatus === 'warning') {
      warnings.push(`[${checkId}] ${message}`);
    }
  }

  // 1. Definition Match & Contract Validity
  if (!resolvedDef) {
    recordCheck(
      'supported_definition',
      'Supported Physical Measurement Definition',
      'fail',
      `Unsupported measurement definition ID: '${defId}'. Evaluation must be registry-driven.`,
    );
  } else {
    recordCheck(
      'supported_definition',
      'Supported Physical Measurement Definition',
      'pass',
      `Registered definition '${resolvedDef.id}' for view '${resolvedDef.view}' level '${resolvedDef.sourceLevel}'.`,
    );
  }

  // 2. Source Observation Status
  const obsStatus = observation?.status;
  const rawSpanCm = (typeof observation?.valueCm === 'number' && Number.isFinite(observation.valueCm))
    ? observation.valueCm
    : null;

  if (!observation || typeof observation !== 'object') {
    recordCheck(
      'source_observation_valid',
      'Source Observation Validity',
      'skip',
      'Observation is absent/null.',
    );
  } else if (resolvedDef && observation.contract !== resolvedDef.expectedObservationContract) {
    recordCheck(
      'source_observation_valid',
      'Source Observation Validity',
      'fail',
      `Contract mismatch: expected '${resolvedDef.expectedObservationContract}', received '${observation.contract}'.`,
    );
  } else if (obsStatus === 'valid' && rawSpanCm !== null && rawSpanCm > 0) {
    recordCheck(
      'source_observation_valid',
      'Source Observation Validity',
      'pass',
      `Valid source observation with span ${rawSpanCm} cm.`,
    );
  } else if (obsStatus === 'unavailable' || obsStatus === 'ambiguous') {
    recordCheck(
      'source_observation_valid',
      'Source Observation Validity',
      'skip',
      `Source observation is ${obsStatus}.`,
    );
  } else {
    recordCheck(
      'source_observation_valid',
      'Source Observation Validity',
      'fail',
      `Invalid source observation: status '${obsStatus}'.`,
    );
  }

  // 3. Metric Calibration Provenance (Layer 1)
  const calibStatus = calibrationProvenance?.status;
  const isMetricEligible = calibrationProvenance?.metricProjectedEligibility === true && obsStatus === 'valid';

  if (!calibrationProvenance) {
    recordCheck(
      'metric_calibration_provenance',
      'Metric Calibration Provenance',
      'skip',
      'No metric calibration provenance provided.',
    );
  } else if (calibStatus === 'validated' && calibrationProvenance.metricProjectedEligibility === true) {
    recordCheck(
      'metric_calibration_provenance',
      'Metric Calibration Provenance',
      'pass',
      `Metric calibration provenance validated (${calibrationProvenance.calibration?.pixelsPerCm} px/cm).`,
    );
  } else if (calibStatus === 'invalid') {
    recordCheck(
      'metric_calibration_provenance',
      'Metric Calibration Provenance',
      'fail',
      `Metric calibration provenance is invalid: ${calibrationProvenance.issues?.join('; ') || 'invalid'}`,
    );
  } else {
    recordCheck(
      'metric_calibration_provenance',
      'Metric Calibration Provenance',
      'warning',
      `Metric calibration provenance is ${calibStatus}.`,
    );
  }

  // 4. View Categorization Check
  const viewCategoryValidated = viewCalibration?.viewCategoryValidated;
  let viewCategoryPass = true;
  if (viewCategoryValidated === false) {
    recordCheck(
      'view_category_validated',
      'View Categorization Verification',
      'fail',
      `View categorization failed for view '${defView}'. Subject stance does not match required profile/frontal criteria.`,
    );
    viewCategoryPass = false;
  } else if (viewCategoryValidated === true) {
    recordCheck(
      'view_category_validated',
      'View Categorization Verification',
      'pass',
      `View categorization confirmed for view '${defView}'.`,
    );
  } else {
    recordCheck(
      'view_category_validated',
      'View Categorization Verification',
      'skip',
      `View categorization unrecorded for view '${defView}'.`,
    );
  }

  // 5. Physical Evidence Paths Evaluation (Layer 2)
  const validatedPhysicalEvidencePaths = [];
  const missingPhysicalRequirements = [];

  const rawEvidencePaths = Array.isArray(physicalEvidencePaths)
    ? physicalEvidencePaths
    : (physicalEvidencePaths && typeof physicalEvidencePaths === 'object' ? [physicalEvidencePaths] : []);

  let hasValidPhysicalEvidence = false;
  for (const evidence of rawEvidencePaths) {
    if (!evidence || typeof evidence !== 'object') {
      continue;
    }
    const contract = evidence.contract;
    const version = evidence.version;
    const status = evidence.status;

    if (SUPPORTED_PHYSICAL_EVIDENCE_CONTRACTS.includes(contract) && version && (status === 'validated' || status === 'pass')) {
      hasValidPhysicalEvidence = true;
      validatedPhysicalEvidencePaths.push(contract);
    }
  }

  if (hasValidPhysicalEvidence) {
    recordCheck(
      'physical_evidence_path_validated',
      'Physical Evidence Path Validation',
      'pass',
      `Validated physical evidence contracts: [${validatedPhysicalEvidencePaths.join(', ')}].`,
    );
  } else {
    missingPhysicalRequirements.push('authoritative_physical_evidence_contract');
    recordCheck(
      'physical_evidence_path_validated',
      'Physical Evidence Path Validation',
      'skip',
      'No authoritative physical evidence contract supplied; physical AP/width dimension cannot be certified.',
    );
  }

  // Summary counts
  const allChecks = Object.values(checks);
  const totalChecks = allChecks.length;
  const passedChecks = allChecks.filter((c) => c.status === 'pass').length;
  const failedChecks = allChecks.filter((c) => c.status === 'fail').length;
  const warnedChecks = allChecks.filter((c) => c.status === 'warning').length;
  const skippedChecks = allChecks.filter((c) => c.status === 'skip').length;

  // Status & Eligibility Derivation
  let status;
  let metricProjectedEligibility = false;
  let physicalEligibility = false;
  let metricProjectedSpanCm = null;
  let physicalSpanCm = null;

  if (!observation || obsStatus === 'unavailable' || obsStatus === 'ambiguous') {
    status = PHYSICAL_SEMANTICS_STATUS.UNAVAILABLE;
  } else if (obsStatus === 'invalid' || checks.supported_definition.status === 'fail' || checks.source_observation_valid.status === 'fail') {
    status = PHYSICAL_SEMANTICS_STATUS.INVALID;
  } else if (!viewCategoryPass) {
    status = PHYSICAL_SEMANTICS_STATUS.INVALID;
    // Preserve metric projection if calibration was valid
    if (isMetricEligible) {
      metricProjectedEligibility = true;
      metricProjectedSpanCm = rawSpanCm;
    }
  } else if (calibStatus === 'invalid') {
    status = PHYSICAL_SEMANTICS_STATUS.INVALID;
  } else if (calibStatus === 'validated' && isMetricEligible) {
    metricProjectedEligibility = true;
    metricProjectedSpanCm = rawSpanCm;

    if (hasValidPhysicalEvidence) {
      status = PHYSICAL_SEMANTICS_STATUS.VALIDATED;
      physicalEligibility = true;
      physicalSpanCm = rawSpanCm;
    } else {
      status = PHYSICAL_SEMANTICS_STATUS.PROJECTED_METRIC_ONLY;
      physicalEligibility = false;
      physicalSpanCm = null;
    }
  } else {
    status = PHYSICAL_SEMANTICS_STATUS.UNVALIDATED;
    metricProjectedEligibility = false;
    physicalEligibility = false;
  }

  return {
    contract: PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT,
    version: PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT_VERSION,
    id: defId,
    name: defName,
    view: defView,
    sourceLevel: defLevel,
    domainType: defDomainType,
    status,
    metricProjectedEligibility,
    physicalEligibility,
    workspaceSpanCm: rawSpanCm,
    metricProjectedSpanCm,
    physicalSpanCm,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
    },
    checks,
    validatedPhysicalEvidencePaths,
    missingPhysicalRequirements,
    issues,
    warnings,
  };
}

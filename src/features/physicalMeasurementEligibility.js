/**
 * Physical Measurement Eligibility Contract v0
 *
 * Authoritative deterministic qualification layer determining whether a 2D metric-projected
 * measurement (Front transverse width or Side profile span) satisfies all physical constraints
 * (structural integrity, metric calibration, view/pose semantics, clothing attribution, and
 * authoritative physical capture evidence) to be consumed downstream as a validated physical body scalar.
 *
 * Contract: 'physical-measurement-eligibility-v0'
 * Paired Contract: 'paired-cross-view-eligibility-v0'
 *
 * STRICT GUARDRAILS:
 * - Downstream consumer gate: consumes 4.5C metric calibration & semantics without redefining them.
 * - Multi-blocker preservation: primary status follows strict precedence, while all active blockers are preserved.
 * - Zero assumption on garments: clothing presence without recognized authorization blocks physical promotion.
 * - Value separation: physicalMeasurementCm is NEVER copied automatically from metricProjectedSpanCm;
 *   it must be explicitly supplied/authorized by a recognized authoritative physical evidence evaluator.
 * - 4.5D does NOT calculate garment offsets, perspective corrections, or 3D body reconstructions.
 * - Zero coordinate fusion: does NOT convert Side U to canonical Z, does NOT fuse Front/Side geometry,
 *   and does NOT compute circumference or cross-section.
 */

import {
  PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT,
  SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0,
  evaluatePhysicalMeasurementSemantics,
} from './physicalMeasurementSemantics.js';

import {
  getMeasurementSupportPolicy,
  resolveMeasurementSupportPolicy,
} from './measurementSupportPolicy.js';

import {
  CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT,
  CROSS_VIEW_CORRESPONDENCE_STATUS,
  SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0,
} from './crossViewMeasurementCorrespondence.js';

import {
  CROSS_VIEW_COMPARABILITY_QA_CONTRACT,
  CROSS_VIEW_COMPARABILITY_QA_STATUS,
} from './crossViewComparabilityQa.js';

import {
  evaluateClothingBodySurfaceSemantics,
} from './clothingBodySurfaceSemantics.js';

export const PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT = 'physical-measurement-eligibility-v0';
export const PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT_VERSION = 'physical-measurement-eligibility-v0';

export const PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT = 'paired-cross-view-eligibility-v0';
export const PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT_VERSION = 'paired-cross-view-eligibility-v0';

/**
 * Deterministic status taxonomy for Individual Physical Measurement Eligibility (Tier 1).
 * @readonly
 * @enum {string}
 */
export const PHYSICAL_ELIGIBILITY_STATUS = Object.freeze({
  ELIGIBLE: 'eligible',
  BLOCKED_BY_CLOTHING: 'blocked_by_clothing',
  METRIC_PROJECTED_ONLY: 'metric_projected_only',
  UNVALIDATED: 'unvalidated',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

/**
 * Deterministic status taxonomy for Paired Cross-View Physical Eligibility (Tier 2).
 * @readonly
 * @enum {string}
 */
export const PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS = Object.freeze({
  ELIGIBLE: 'eligible',
  PARTIAL: 'partial',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
});

/**
 * Standard blocker error / gate codes.
 * @readonly
 * @enum {string}
 */
export const ELIGIBILITY_BLOCKER_CODES = Object.freeze({
  SOURCE_OBSERVATION_UNAVAILABLE: 'source_observation_unavailable',
  SOURCE_STRUCTURAL_INTEGRITY_FAILED: 'source_structural_integrity_failed',
  METRIC_CALIBRATION_UNVALIDATED: 'metric_calibration_unvalidated',
  CLOTHING_AUTHORIZATION_MISSING: 'clothing_authorization_missing',
  VIEW_POSE_SEMANTICS_MISSING: 'view_pose_semantics_missing',
  AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING: 'authoritative_physical_evidence_missing',
});

/**
 * Recognized structured physical evidence contract identifiers.
 */
export const RECOGNIZED_PHYSICAL_EVALUATOR_CONTRACTS = Object.freeze([
  'controlled-capture-protocol-v0',
  'calibrated-camera-projection-v0',
  'metric-reference-fiducial-v0',
  'empirical-body-capture-calibration-v0',
  'validated-dense-geometry-v0',
  'fitted-garment-offset-compensation-v0',
]);

/**
 * Currently implemented authoritative evaluators in production runtime.
 * Empty in production until future authoritative capture/pose modules are developed.
 * @type {readonly string[]}
 */
export const IMPLEMENTED_PHYSICAL_EVALUATORS = Object.freeze([]);

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   dimension: 'source_integrity'|'metric_readiness'|'view_pose'|'clothing'|'physical_evidence',
 *   status: 'pass'|'fail'|'warning'|'skip',
 *   message: string,
 * }} PhysicalEligibilityCheckResult
 */

/**
 * @typedef {{
 *   contract: 'physical-measurement-eligibility-v0',
 *   version: 'physical-measurement-eligibility-v0',
 *   id: string,
 *   name: string,
 *   view: 'front'|'side'|string,
 *   sourceLevel: 'shoulder'|'hip'|string|null,
 *   domainType: 'transverse_width'|'profile_span'|string,
 *   status: 'eligible'|'blocked_by_clothing'|'metric_projected_only'|'unvalidated'|'invalid'|'unavailable',
 *   physicalEligibility: boolean,
 *   metricProjectedEligibility: boolean,
 *   workspaceSpanCm: number|null,
 *   metricProjectedSpanCm: number|null,
 *   physicalMeasurementCm: number|null,
 *   physicalValueProvenance: {
 *     evaluatorContract: string|null,
 *     evaluatorId: string|null,
 *     interpretation: 'direct_equivalence'|'corrected_physical_measurement'|'none',
 *     uncertaintyToleranceCm: number|null,
 *   }|null,
 *   sourceObservationSummary: {
 *     status: string,
 *     measurementRowY: number|null,
 *     runCount: number,
 *     startPx: number|null,
 *     endPx: number|null,
 *   }|null,
 *   supportPolicyProvenance: {
 *     policyId: string|null,
 *     anatomicalClassIds: readonly number[],
 *     clothingBridgeClassIds: readonly number[],
 *     usedClothingEvidence: boolean,
 *     clothingClassIdsUsed: readonly number[],
 *   }|null,
 *   metricCalibrationSummary: {
 *     calibrationStatus: string,
 *     scaleCmPerPx: number|null,
 *     calibrationMethod: string|null,
 *   }|null,
 *   viewPoseSemanticsSummary: {
 *     status: 'validated'|'unvalidated'|'missing'|'skipped'|'invalid',
 *     evaluatorId: string|null,
 *   },
 *   clothingDependenceSummary: {
 *     usedClothingEvidence: boolean,
 *     clothingClassIdsUsed: readonly number[],
 *     authorizationStatus: 'authorized'|'unauthorized'|'not_applicable',
 *     evaluatorId: string|null,
 *   },
 *   physicalEvidenceSummary: {
 *     validatedEvaluatorCount: number,
 *     activeEvidenceContracts: string[],
 *   },
 *   checks: Record<string, PhysicalEligibilityCheckResult>,
 *   summary: {
 *     totalChecks: number,
 *     passedChecks: number,
 *     failedChecks: number,
 *     warnedChecks: number,
 *     skippedChecks: number,
 *   },
 *   blockers: string[],
 *   missingPhysicalRequirements: string[],
 *   warnings: string[],
 *   issues: string[],
 * }} PhysicalMeasurementEligibilityResultV0
 */

/**
 * Evaluates pure deterministic physical measurement eligibility for a single Front or Side observation.
 *
 * @param {object|null|undefined} observation - Source measurement observation (Front transverse width or Side profile span)
 * @param {{
 *   metricCalibrationResult?: object|null,
 *   physicalSemanticsResult?: object|null,
 *   viewPoseValidationResult?: object|null,
 *   clothingAuthorizationResult?: object|null,
 *   authoritativePhysicalEvidenceResults?: Array<object>|object|null,
 *   definition?: typeof SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[keyof typeof SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0]|string|null,
 * }} [options]
 * @returns {PhysicalMeasurementEligibilityResultV0}
 */
export function evaluatePhysicalMeasurementEligibility(observation, {
  metricCalibrationResult = null,
  physicalSemanticsResult = null,
  viewPoseValidationResult = null,
  clothingAuthorizationResult = null,
  authoritativePhysicalEvidenceResults = null,
  definition = null,
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];
  const missingPhysicalRequirements = [];
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

  function recordCheck(checkId, name, dimension, checkStatus, message) {
    checks[checkId] = {
      id: checkId,
      name,
      dimension,
      status: checkStatus,
      message,
    };
    if (checkStatus === 'fail') {
      issues.push(`[${checkId}] ${message}`);
    } else if (checkStatus === 'warning') {
      warnings.push(`[${checkId}] ${message}`);
    }
  }

  // ==========================================
  // DIMENSION A: SOURCE MEASUREMENT INTEGRITY
  // ==========================================
  let sourcePresent = false;
  let sourceValid = false;
  let structuralValid = true;

  if (!observation || typeof observation !== 'object') {
    recordCheck(
      'source_observation_present',
      'Source Observation Presence',
      'source_integrity',
      'fail',
      'Observation object is null or missing.',
    );
    structuralValid = false;
  } else {
    sourcePresent = true;
    recordCheck(
      'source_observation_present',
      'Source Observation Presence',
      'source_integrity',
      'pass',
      `Observation object present for definition '${defId}'.`,
    );
  }

  if (sourcePresent) {
    if (!resolvedDef) {
      recordCheck(
        'source_definition_registered',
        'Registered Measurement Definition',
        'source_integrity',
        'fail',
        `Unregistered measurement definition ID: '${defId}'.`,
      );
      structuralValid = false;
    } else {
      recordCheck(
        'source_definition_registered',
        'Registered Measurement Definition',
        'source_integrity',
        'pass',
        `Registered measurement definition '${resolvedDef.id}'.`,
      );
    }

    const obsStatus = observation.status;
    const rawSpanCm = (typeof observation.valueCm === 'number' && Number.isFinite(observation.valueCm))
      ? observation.valueCm
      : null;

    if (obsStatus === 'valid' && rawSpanCm !== null && rawSpanCm > 0) {
      sourceValid = true;
      recordCheck(
        'source_observation_status',
        'Source Observation Status',
        'source_integrity',
        'pass',
        `Source observation status is valid with span ${rawSpanCm} cm.`,
      );
    } else if (obsStatus === 'unavailable' || obsStatus === 'ambiguous') {
      recordCheck(
        'source_observation_status',
        'Source Observation Status',
        'source_integrity',
        'skip',
        `Source observation status is ${obsStatus}.`,
      );
      structuralValid = false;
    } else {
      recordCheck(
        'source_observation_status',
        'Source Observation Status',
        'source_integrity',
        'fail',
        `Source observation status is '${obsStatus}'.`,
      );
      structuralValid = false;
    }

    // Anatomical level match
    const obsLevel = observation.sourceLevel ?? observation.provenance?.sourceLevel ?? null;
    if (resolvedDef && obsLevel && obsLevel !== resolvedDef.sourceLevel) {
      recordCheck(
        'anatomical_level_match',
        'Anatomical Level Conformance',
        'source_integrity',
        'fail',
        `Anatomical level mismatch: expected '${resolvedDef.sourceLevel}', received '${obsLevel}'.`,
      );
      structuralValid = false;
    } else if (resolvedDef && obsLevel) {
      recordCheck(
        'anatomical_level_match',
        'Anatomical Level Conformance',
        'source_integrity',
        'pass',
        `Anatomical level confirmed as '${obsLevel}'.`,
      );
    } else {
      recordCheck(
        'anatomical_level_match',
        'Anatomical Level Conformance',
        'source_integrity',
        'skip',
        'Anatomical level unrecorded on observation.',
      );
    }

    // Support policy topology
    const policyId = observation.provenance?.supportPolicyId
      ?? observation.provenance?.supportPolicy?.id
      ?? null;
    const policy = policyId
      ? getMeasurementSupportPolicy(policyId)
      : resolveMeasurementSupportPolicy(defId);

    const runCount = observation.provenance?.runCount
      ?? (observation.startPx !== undefined && observation.endPx !== undefined
        ? 1
        : (observation.status === 'valid' ? 1 : 0));

    if (policy && runCount === 1) {
      recordCheck(
        'support_policy_conformance',
        'Support Policy Topology Conformance',
        'source_integrity',
        'pass',
        `Conforms to policy '${policy.id}' with valid single continuous run.`,
      );
    } else if (policy && runCount > 1) {
      recordCheck(
        'support_policy_conformance',
        'Support Policy Topology Conformance',
        'source_integrity',
        'fail',
        `Multi-run topology detected (${runCount} runs) under single-run policy '${policy.id}'.`,
      );
      structuralValid = false;
    } else if (!policy) {
      recordCheck(
        'support_policy_conformance',
        'Support Policy Topology Conformance',
        'source_integrity',
        'warning',
        `No standard support policy registered for definition '${defId}'.`,
      );
    } else {
      recordCheck(
        'support_policy_conformance',
        'Support Policy Topology Conformance',
        'source_integrity',
        'skip',
        'No runs detected on sampled row.',
      );
      structuralValid = false;
    }
  }

  // ==========================================
  // DIMENSION B: METRIC SEMANTIC READINESS (4.5C)
  // ==========================================
  // If physicalSemanticsResult was not passed, evaluate it deterministically
  const semantics = physicalSemanticsResult ?? (sourcePresent ? evaluatePhysicalMeasurementSemantics(observation, {
    calibrationProvenance: metricCalibrationResult,
    definition: resolvedDef,
  }) : null);

  let metricReady = false;
  let metricCalibrationStatus = semantics?.checks?.metric_calibration_provenance?.status ?? 'unavailable';
  let scaleCmPerPx = metricCalibrationResult?.calibration?.scaleCmPerPx
    ?? metricCalibrationResult?.scaleCmPerPx
    ?? null;

  if (scaleCmPerPx === null && metricCalibrationResult?.calibration?.pixelsPerCm) {
    scaleCmPerPx = 1 / metricCalibrationResult.calibration.pixelsPerCm;
  }

  if (semantics?.metricProjectedEligibility === true && semantics?.metricProjectedSpanCm !== null && semantics?.metricProjectedSpanCm > 0) {
    metricReady = true;
    recordCheck(
      'metric_semantic_readiness',
      'Metric Calibration & Semantic Readiness',
      'metric_readiness',
      'pass',
      `Validated metric projected measurement available (${semantics.metricProjectedSpanCm} cm).`,
    );
  } else if (semantics?.status === 'unvalidated' || !metricCalibrationResult) {
    recordCheck(
      'metric_semantic_readiness',
      'Metric Calibration & Semantic Readiness',
      'metric_readiness',
      'skip',
      'Metric calibration is absent or unvalidated.',
    );
  } else if (semantics?.status === 'invalid') {
    recordCheck(
      'metric_semantic_readiness',
      'Metric Calibration & Semantic Readiness',
      'metric_readiness',
      'fail',
      `Metric calibration is structurally invalid: ${semantics.issues.join('; ')}`,
    );
  } else {
    recordCheck(
      'metric_semantic_readiness',
      'Metric Calibration & Semantic Readiness',
      'metric_readiness',
      'skip',
      'Metric projected measurement unavailable.',
    );
  }

  // View alignment with calibration
  if (metricCalibrationResult?.view && defView !== 'unspecified' && metricCalibrationResult.view !== defView) {
    recordCheck(
      'metric_view_consistency',
      'Metric Calibration View Consistency',
      'metric_readiness',
      'fail',
      `Calibration view '${metricCalibrationResult.view}' does not match observation view '${defView}'.`,
    );
    metricReady = false;
  } else if (metricCalibrationResult?.view) {
    recordCheck(
      'metric_view_consistency',
      'Metric Calibration View Consistency',
      'metric_readiness',
      'pass',
      `Calibration view '${metricCalibrationResult.view}' matches observation view.`,
    );
  }

  // ==========================================
  // DIMENSION C: VIEW / POSE SEMANTICS
  // ==========================================
  let viewPoseAuthorized = false;
  let viewPoseSummaryStatus = 'missing';
  let viewPoseEvaluatorId = null;

  if (viewPoseValidationResult && typeof viewPoseValidationResult === 'object') {
    viewPoseEvaluatorId = viewPoseValidationResult.evaluatorId ?? viewPoseValidationResult.contract ?? 'custom_pose_evaluator';
    const isAuthorized = viewPoseValidationResult.authorized === true
      || (viewPoseValidationResult.authorized !== false && (viewPoseValidationResult.status === 'validated' || viewPoseValidationResult.status === 'pass'));

    if (isAuthorized && (viewPoseValidationResult.status === 'validated' || viewPoseValidationResult.status === 'pass')) {
      const poseViewMatches = !viewPoseValidationResult.targetView
        || viewPoseValidationResult.targetView === 'both'
        || viewPoseValidationResult.targetView === defView;

      if (poseViewMatches) {
        viewPoseAuthorized = true;
        viewPoseSummaryStatus = 'validated';
        recordCheck(
          'view_pose_authorization',
          'Authoritative View / Pose Authorization',
          'view_pose',
          'pass',
          `Authoritative posture/stance validated by '${viewPoseEvaluatorId}' for view '${defView}'.`,
        );
      } else {
        viewPoseSummaryStatus = 'invalid';
        recordCheck(
          'view_pose_authorization',
          'Authoritative View / Pose Authorization',
          'view_pose',
          'fail',
          `Posture evaluator targetView '${viewPoseValidationResult.targetView}' mismatch for view '${defView}'.`,
        );
      }
    } else if (viewPoseValidationResult.status === 'partial') {
      viewPoseSummaryStatus = 'partial';
      recordCheck(
        'view_pose_authorization',
        'Authoritative View / Pose Authorization',
        'view_pose',
        'skip',
        `View/pose structural sanity established by '${viewPoseEvaluatorId}' for view '${defView}', but authoritative physical orientation certification is missing.`,
      );
    } else if (viewPoseValidationResult.status === 'fail' || viewPoseValidationResult.status === 'invalid') {
      viewPoseSummaryStatus = 'invalid';
      recordCheck(
        'view_pose_authorization',
        'Authoritative View / Pose Authorization',
        'view_pose',
        'fail',
        `Posture validation failed for view '${defView}': ${viewPoseValidationResult.message ?? 'unqualified pose'}`,
      );
    } else {
      viewPoseSummaryStatus = 'unvalidated';
      recordCheck(
        'view_pose_authorization',
        'Authoritative View / Pose Authorization',
        'view_pose',
        'skip',
        `Posture validation is unvalidated for view '${defView}'.`,
      );
    }
  } else {
    recordCheck(
      'view_pose_authorization',
      'Authoritative View / Pose Authorization',
      'view_pose',
      'skip',
      `No authoritative view/pose validation result supplied for view '${defView}'.`,
    );
  }

  if (!viewPoseAuthorized) {
    missingPhysicalRequirements.push('authoritative_view_pose_validation');
  }

  // ==========================================
  // DIMENSION D: CLOTHING DEPENDENCE (4.5F)
  // ==========================================
  const clothingResult = clothingAuthorizationResult ?? (sourcePresent
    ? evaluateClothingBodySurfaceSemantics(observation, { measurementId: defId, view: defView })
    : null);

  const usedClothingEvidence = Boolean(
    clothingResult?.clothingEvidence?.usedClothingEvidence
    ?? observation?.provenance?.usedClothingEvidence
    ?? (observation?.provenance?.clothingClassIdsUsed && observation.provenance.clothingClassIdsUsed.length > 0)
  );
  const clothingClassIdsUsed = clothingResult?.clothingEvidence?.clothingClassIdsUsed
    ?? observation?.provenance?.clothingClassIdsUsed
    ?? [];

  let clothingAuthorized = false;
  let clothingAuthorizationStatus = 'not_applicable';
  let clothingEvaluatorId = null;

  if (usedClothingEvidence) {
    clothingAuthorizationStatus = 'unauthorized';
    if (clothingResult && typeof clothingResult === 'object') {
      clothingEvaluatorId = clothingResult.evaluatorId ?? clothingResult.contract ?? 'custom_clothing_evaluator';
      const isConstraintSatisfied = clothingResult.dimensions?.clothingConstraintSatisfied === true
        || clothingResult.status === 'authorized'
        || clothingResult.status === 'validated'
        || clothingResult.status === 'pass';

      if (isConstraintSatisfied) {
        clothingAuthorized = true;
        clothingAuthorizationStatus = 'authorized';
        recordCheck(
          'clothing_non_interference',
          'Clothing Interference & Authorization',
          'clothing',
          'pass',
          `Clothing presence authorized by evaluator '${clothingEvaluatorId}' for classes [${clothingClassIdsUsed.join(', ')}].`,
        );
      } else if (clothingResult.status === 'partial') {
        clothingAuthorizationStatus = 'partial';
        recordCheck(
          'clothing_non_interference',
          'Clothing Interference & Authorization',
          'clothing',
          'skip',
          `Clothing participation verified for classes [${clothingClassIdsUsed.join(', ')}], but visual fit qualification and empirical body-surface authorization are unresolved.`,
        );
      } else {
        recordCheck(
          'clothing_non_interference',
          'Clothing Interference & Authorization',
          'clothing',
          'fail',
          `Clothing authorization failed for classes [${clothingClassIdsUsed.join(', ')}].`,
        );
      }
    } else {
      recordCheck(
        'clothing_non_interference',
        'Clothing Interference & Authorization',
        'clothing',
        'fail',
        `Measurement relies on garment evidence (class [${clothingClassIdsUsed.join(', ')}]) without recognized clothing authorization.`,
      );
    }
  } else {
    // Unclothed body surface / pure anatomical classes
    clothingAuthorized = true;
    clothingAuthorizationStatus = 'authorized';
    recordCheck(
      'clothing_non_interference',
      'Clothing Interference & Authorization',
      'clothing',
      'pass',
      'No clothing classes contributed to observed measurement silhouette.',
    );
  }

  if (usedClothingEvidence && !clothingAuthorized) {
    missingPhysicalRequirements.push('clothing_authorization');
  }

  // ==========================================
  // DIMENSION E: AUTHORITATIVE PHYSICAL EVIDENCE & PROVENANCE
  // ==========================================
  const rawEvidenceList = Array.isArray(authoritativePhysicalEvidenceResults)
    ? authoritativePhysicalEvidenceResults
    : (authoritativePhysicalEvidenceResults && typeof authoritativePhysicalEvidenceResults === 'object'
      ? [authoritativePhysicalEvidenceResults]
      : []);

  let physicalEvidenceAuthorized = false;
  let authoritativePhysicalValue = null;
  let physicalValueProvenance = null;
  const activeEvidenceContracts = [];

  for (const evidence of rawEvidenceList) {
    if (!evidence || typeof evidence !== 'object') continue;

    const contract = evidence.contract;
    const status = evidence.status;
    const isRecognized = RECOGNIZED_PHYSICAL_EVALUATOR_CONTRACTS.includes(contract)
      || IMPLEMENTED_PHYSICAL_EVALUATORS.includes(evidence.evaluatorId)
      || (evidence.evaluatorId && evidence.isAuthorizedEvaluator === true);

    if (isRecognized && (status === 'validated' || status === 'pass')) {
      const levelMatches = !evidence.applicableLevels
        || evidence.applicableLevels.includes('all')
        || (defLevel && evidence.applicableLevels.includes(defLevel));

      const domainMatches = !evidence.applicableDomains
        || evidence.applicableDomains.includes('all')
        || (defDomainType && evidence.applicableDomains.includes(defDomainType));

      const viewMatches = !evidence.targetView
        || evidence.targetView === 'both'
        || evidence.targetView === defView;

      if (levelMatches && domainMatches && viewMatches) {
        physicalEvidenceAuthorized = true;
        activeEvidenceContracts.push(contract || evidence.evaluatorId);

        // Separate value provenance resolution:
        // Must come directly from the authoritative physical evidence result
        const candidateScalar = (typeof evidence.physicalMeasurementCm === 'number' && Number.isFinite(evidence.physicalMeasurementCm))
          ? evidence.physicalMeasurementCm
          : (typeof evidence.physicalValue?.physicalMeasurementCm === 'number' && Number.isFinite(evidence.physicalValue.physicalMeasurementCm))
            ? evidence.physicalValue.physicalMeasurementCm
            : (evidence.interpretation === 'direct_equivalence' && typeof evidence.authorizedScalarCm === 'number')
              ? evidence.authorizedScalarCm
              : null;

        if (candidateScalar !== null && candidateScalar > 0) {
          authoritativePhysicalValue = candidateScalar;
          physicalValueProvenance = {
            evaluatorContract: contract ?? null,
            evaluatorId: evidence.evaluatorId ?? null,
            interpretation: evidence.interpretation ?? 'direct_equivalence',
            uncertaintyToleranceCm: (typeof evidence.uncertaintyToleranceCm === 'number')
              ? evidence.uncertaintyToleranceCm
              : null,
          };
        }
      }
    }
  }

  if (physicalEvidenceAuthorized && authoritativePhysicalValue !== null) {
    recordCheck(
      'authoritative_physical_evidence',
      'Authoritative Physical Evidence Qualification',
      'physical_evidence',
      'pass',
      `Physical body dimension certified by [${activeEvidenceContracts.join(', ')}] (${authoritativePhysicalValue} cm, ${physicalValueProvenance?.interpretation}).`,
    );
  } else if (physicalEvidenceAuthorized && authoritativePhysicalValue === null) {
    recordCheck(
      'authoritative_physical_evidence',
      'Authoritative Physical Evidence Qualification',
      'physical_evidence',
      'fail',
      `Physical evidence evaluator [${activeEvidenceContracts.join(', ')}] did not provide a valid physicalMeasurementCm scalar.`,
    );
    physicalEvidenceAuthorized = false;
    missingPhysicalRequirements.push('authoritative_physical_scalar_value');
  } else {
    recordCheck(
      'authoritative_physical_evidence',
      'Authoritative Physical Evidence Qualification',
      'physical_evidence',
      'skip',
      'No authoritative physical capture/projection evidence supplied.',
    );
    missingPhysicalRequirements.push('authoritative_physical_evidence');
  }

  // ==========================================
  // BLOCKER ACCUMULATION & PRECEDENCE RESOLUTION
  // ==========================================
  if (!sourcePresent) {
    blockers.push(ELIGIBILITY_BLOCKER_CODES.SOURCE_OBSERVATION_UNAVAILABLE);
  }
  if (!structuralValid) {
    blockers.push(ELIGIBILITY_BLOCKER_CODES.SOURCE_STRUCTURAL_INTEGRITY_FAILED);
  }
  if (!metricReady) {
    blockers.push(ELIGIBILITY_BLOCKER_CODES.METRIC_CALIBRATION_UNVALIDATED);
  }
  if (usedClothingEvidence && !clothingAuthorized) {
    blockers.push(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING);
  }
  if (!viewPoseAuthorized) {
    blockers.push(ELIGIBILITY_BLOCKER_CODES.VIEW_POSE_SEMANTICS_MISSING);
  }
  if (!physicalEvidenceAuthorized) {
    blockers.push(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING);
  }

  // Determine overall Tier 1 Status following strict deterministic precedence
  let resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.UNAVAILABLE;
  let physicalEligibility = false;
  let physicalMeasurementCm = null;

  if (!sourcePresent) {
    resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.UNAVAILABLE;
  } else if (!structuralValid) {
    resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.INVALID;
  } else if (!metricReady) {
    resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.UNVALIDATED;
  } else if (usedClothingEvidence && !clothingAuthorized) {
    resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.BLOCKED_BY_CLOTHING;
  } else if (!viewPoseAuthorized || !physicalEvidenceAuthorized) {
    resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.METRIC_PROJECTED_ONLY;
  } else {
    // All dimensions passed!
    resolvedStatus = PHYSICAL_ELIGIBILITY_STATUS.ELIGIBLE;
    physicalEligibility = true;
    physicalMeasurementCm = authoritativePhysicalValue;
  }

  // Counts for summary
  let passedChecks = 0;
  let failedChecks = 0;
  let warnedChecks = 0;
  let skippedChecks = 0;
  for (const ch of Object.values(checks)) {
    if (ch.status === 'pass') passedChecks += 1;
    else if (ch.status === 'fail') failedChecks += 1;
    else if (ch.status === 'warning') warnedChecks += 1;
    else if (ch.status === 'skip') skippedChecks += 1;
  }

  return {
    contract: PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT,
    version: PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT_VERSION,
    id: defId,
    name: defName,
    view: defView,
    sourceLevel: defLevel,
    domainType: defDomainType,
    status: resolvedStatus,
    physicalEligibility,
    metricProjectedEligibility: metricReady,
    workspaceSpanCm: observation?.valueCm ?? null,
    metricProjectedSpanCm: metricReady ? semantics?.metricProjectedSpanCm : null,
    physicalMeasurementCm,
    physicalValueProvenance: physicalEligibility ? physicalValueProvenance : null,
    sourceObservationSummary: sourcePresent ? {
      status: observation.status,
      measurementRowY: observation.rowY ?? observation.provenance?.sampledPixelRow ?? observation.provenance?.measurementRowY ?? null,
      runCount: observation.provenance?.runCount ?? (observation.startPx !== undefined && observation.endPx !== undefined ? 1 : (observation.status === 'valid' ? 1 : 0)),
      startPx: observation.startPx ?? null,
      endPx: observation.endPx ?? null,
    } : null,
    supportPolicyProvenance: {
      policyId: observation?.provenance?.supportPolicyId ?? null,
      anatomicalClassIds: observation?.provenance?.supportPolicy?.anatomicalClassIds ?? [],
      clothingBridgeClassIds: observation?.provenance?.supportPolicy?.clothingBridgeClassIds ?? [],
      usedClothingEvidence,
      clothingClassIdsUsed,
    },
    metricCalibrationSummary: {
      calibrationStatus: metricCalibrationStatus,
      scaleCmPerPx,
      calibrationMethod: metricCalibrationResult?.provenance?.calibrationMethod ?? null,
    },
    viewPoseSemanticsSummary: {
      status: viewPoseSummaryStatus,
      evaluatorId: viewPoseEvaluatorId,
    },
    clothingDependenceSummary: {
      usedClothingEvidence,
      clothingClassIdsUsed,
      authorizationStatus: clothingAuthorizationStatus,
      evaluatorId: clothingEvaluatorId,
    },
    physicalEvidenceSummary: {
      validatedEvaluatorCount: activeEvidenceContracts.length,
      activeEvidenceContracts,
    },
    checks,
    summary: {
      totalChecks: Object.keys(checks).length,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
    },
    blockers,
    missingPhysicalRequirements,
    warnings,
    issues,
  };
}

/**
 * Evaluates pure deterministic paired cross-view physical eligibility (Tier 2).
 *
 * @param {object|string|null|undefined} correspondence - 4.5A correspondence object or ID
 * @param {{
 *   frontEligibilityResult?: PhysicalMeasurementEligibilityResultV0|null,
 *   sideEligibilityResult?: PhysicalMeasurementEligibilityResultV0|null,
 *   comparabilityQaResult?: object|null,
 * }} [options]
 * @returns {object} PairedCrossViewEligibilityResultV0
 */
export function evaluatePairedCrossViewEligibility(correspondence, {
  frontEligibilityResult = null,
  sideEligibilityResult = null,
  comparabilityQaResult = null,
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];
  const checks = {};

  const corrId = (typeof correspondence === 'string')
    ? correspondence
    : (correspondence?.id ?? 'custom_correspondence');

  const registeredCorr = SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0[corrId] ?? null;
  const sourceLevel = registeredCorr?.sourceLevel ?? correspondence?.sourceLevel ?? null;

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

  // 1. Correspondence Integrity & 4.5A Status
  const corrStatus = correspondence?.status;
  if (!correspondence || typeof correspondence !== 'object') {
    recordCheck(
      'paired_correspondence_present',
      'Cross-view Correspondence Presence',
      'fail',
      'Correspondence object is missing or null.',
    );
    blockers.push('correspondence_unavailable');
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.READY) {
    recordCheck(
      'paired_correspondence_present',
      'Cross-view Correspondence Presence',
      'pass',
      `4.5A Cross-view correspondence is ready for level '${sourceLevel}'.`,
    );
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.PARTIAL) {
    recordCheck(
      'paired_correspondence_present',
      'Cross-view Correspondence Presence',
      'skip',
      `4.5A Cross-view correspondence is partial (one view missing).`,
    );
    blockers.push('correspondence_partial');
  } else {
    recordCheck(
      'paired_correspondence_present',
      'Cross-view Correspondence Presence',
      'fail',
      `4.5A Cross-view correspondence status is '${corrStatus}'.`,
    );
    blockers.push('correspondence_invalid');
  }

  // 2. 4.5B Comparability QA Status
  const qaStatus = comparabilityQaResult?.status;
  if (!comparabilityQaResult) {
    recordCheck(
      'paired_comparability_qa',
      'Cross-view Comparability QA',
      'skip',
      'No 4.5B comparability QA result provided.',
    );
    blockers.push('comparability_qa_missing');
  } else if (qaStatus === CROSS_VIEW_COMPARABILITY_QA_STATUS.PASS) {
    recordCheck(
      'paired_comparability_qa',
      'Cross-view Comparability QA',
      'pass',
      '4.5B Comparability QA passed.',
    );
  } else if (qaStatus === CROSS_VIEW_COMPARABILITY_QA_STATUS.WARNING) {
    recordCheck(
      'paired_comparability_qa',
      'Cross-view Comparability QA',
      'warning',
      `4.5B Comparability QA passed with warnings: ${comparabilityQaResult.warnings?.join('; ') || 'warning'}`,
    );
  } else {
    recordCheck(
      'paired_comparability_qa',
      'Cross-view Comparability QA',
      'fail',
      `4.5B Comparability QA failed: ${comparabilityQaResult.issues?.join('; ') || 'failed'}`,
    );
    blockers.push('comparability_qa_failed');
  }

  // 3. Front and Side Individual Tier 1 Evaluations
  const frontOk = frontEligibilityResult?.physicalEligibility === true;
  const sideOk = sideEligibilityResult?.physicalEligibility === true;

  const frontMetricOk = frontEligibilityResult?.metricProjectedEligibility === true;
  const sideMetricOk = sideEligibilityResult?.metricProjectedEligibility === true;

  if (frontEligibilityResult?.status) {
    recordCheck(
      'front_tier1_eligibility',
      'Front Physical Eligibility',
      frontOk ? 'pass' : (frontMetricOk ? 'warning' : 'fail'),
      `Front Tier 1 status: '${frontEligibilityResult.status}' (physical: ${frontOk}).`,
    );
  } else {
    recordCheck(
      'front_tier1_eligibility',
      'Front Physical Eligibility',
      'skip',
      'Front Tier 1 eligibility result unavailable.',
    );
    blockers.push('front_tier1_unavailable');
  }

  if (sideEligibilityResult?.status) {
    recordCheck(
      'side_tier1_eligibility',
      'Side Physical Eligibility',
      sideOk ? 'pass' : (sideMetricOk ? 'warning' : 'fail'),
      `Side Tier 1 status: '${sideEligibilityResult.status}' (physical: ${sideOk}).`,
    );
  } else {
    recordCheck(
      'side_tier1_eligibility',
      'Side Physical Eligibility',
      'skip',
      'Side Tier 1 eligibility result unavailable.',
    );
    blockers.push('side_tier1_unavailable');
  }

  // Paired metric eligibility: Both Front & Side have valid metric projections + 4.5A ready + 4.5B pass/warning
  const pairedMetricProjectedEligibility = Boolean(
    frontMetricOk &&
    sideMetricOk &&
    corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.READY &&
    (qaStatus === CROSS_VIEW_COMPARABILITY_QA_STATUS.PASS || qaStatus === CROSS_VIEW_COMPARABILITY_QA_STATUS.WARNING)
  );

  // Paired physical eligibility: BOTH Tier 1 pass + 4.5A ready + 4.5B pass
  const pairedPhysicalEligibility = Boolean(
    frontOk &&
    sideOk &&
    corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.READY &&
    qaStatus === CROSS_VIEW_COMPARABILITY_QA_STATUS.PASS
  );

  // Status resolution
  let pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.UNAVAILABLE;
  if (!correspondence || !frontEligibilityResult || !sideEligibilityResult) {
    pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.UNAVAILABLE;
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.INVALID || qaStatus === CROSS_VIEW_COMPARABILITY_QA_STATUS.FAIL) {
    pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED;
  } else if (pairedPhysicalEligibility) {
    pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.ELIGIBLE;
  } else if (pairedMetricProjectedEligibility) {
    // Both sides are metric-projected valid, but physical eligibility is blocked (e.g. clothing or missing physical evidence)
    pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED;
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.PARTIAL || (frontMetricOk !== sideMetricOk)) {
    pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.PARTIAL;
  } else {
    pairedStatus = PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED;
  }

  return {
    contract: PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT,
    version: PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT_VERSION,
    correspondenceId: corrId,
    sourceLevel,
    pairedStatus,
    pairedPhysicalEligibility,
    pairedMetricProjectedEligibility,
    frontMetricSpanCm: frontEligibilityResult?.metricProjectedSpanCm ?? null,
    sideMetricSpanCm: sideEligibilityResult?.metricProjectedSpanCm ?? null,
    frontPhysicalMeasurementCm: frontEligibilityResult?.physicalMeasurementCm ?? null,
    sidePhysicalMeasurementCm: sideEligibilityResult?.physicalMeasurementCm ?? null,
    upstreamCorrespondenceStatus: corrStatus ?? null,
    upstreamComparabilityQaStatus: qaStatus ?? null,
    frontTier1Result: frontEligibilityResult,
    sideTier1Result: sideEligibilityResult,
    checks,
    blockers,
    issues,
    warnings,
  };
}

/**
 * Bulk evaluator for all canonical physical measurement definitions.
 *
 * @param {Record<string, object>|Array<object>} observations
 * @param {object} [options]
 * @returns {Array<PhysicalMeasurementEligibilityResultV0>}
 */
export function evaluateAllPhysicalMeasurementEligibilities(observations, options = {}) {
  const canonicalIds = [
    'torso_transverse_width_at_shoulder_level',
    'torso_transverse_width_at_hip_level',
    'torso_profile_span_at_shoulder_level',
    'torso_profile_span_at_hip_level',
  ];

  const obsMap = Array.isArray(observations)
    ? Object.fromEntries(observations.map((o) => [o.id, o]))
    : (observations && typeof observations === 'object' ? observations : {});

  return canonicalIds.map((id) => {
    const obs = obsMap[id]
      ?? obsMap[id.replace('torso_transverse_width_', 'torso_width_')]
      ?? null;
    return evaluatePhysicalMeasurementEligibility(obs, {
      ...options,
      definition: id,
    });
  });
}

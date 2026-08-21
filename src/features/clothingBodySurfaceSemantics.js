/**
 * clothingBodySurfaceSemantics.js
 *
 * Milestone 4.5F — Clothing / Body-Surface Authorization v0
 *
 * Pure, deterministic domain contract and evaluation layer determining whether
 * clothing participation in an observation is qualified and authorized to represent
 * the true physical body surface under declared uncertainty bounds.
 *
 * Strictly separates:
 *   - Layer A: Clothing Participation & Provenance (deterministic now from segmentation support)
 *   - Layer B: Garment Type & Fit Qualification (visual/observational qualification; unresolved in v0)
 *   - Layer C: Body-Surface Authorization (authoritative physical ground-truth validation; unresolved in v0)
 *   - Derived Final Gate: clothingConstraintSatisfied (consumed by 4.5D to clear clothing_authorization_missing)
 *
 * Strict Guardrails:
 *   - Does NOT infer garment fit from segmentation alone.
 *   - Does NOT accept user declarations as authoritative.
 *   - Does NOT calculate garment thickness or offset corrections.
 *   - Does NOT mutate input objects or global state.
 */

export const CLOTHING_BODY_SURFACE_CONTRACT = 'clothing-body-surface-semantics-v0';
export const CLOTHING_BODY_SURFACE_CONTRACT_VERSION = 'clothing-body-surface-semantics-v0';

/**
 * Status taxonomy for overall clothing/body-surface semantics.
 */
export const CLOTHING_BODY_SURFACE_STATUS = Object.freeze({
  AUTHORIZED: 'authorized',
  PARTIAL: 'partial',
  UNVALIDATED: 'unvalidated',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

/**
 * Canonical Layer B garment fit status taxonomy.
 */
export const GARMENT_FIT_STATUS = Object.freeze({
  QUALIFIED: 'qualified',
  DISQUALIFIED: 'disqualified',
  AMBIGUOUS: 'ambiguous',
  UNRESOLVED: 'unresolved',
  NOT_APPLICABLE: 'not_applicable',
});

/**
 * Evaluator registry for Layer A participation evaluation.
 */
export const IMPLEMENTED_PARTICIPATION_EVALUATORS = Object.freeze([
  'body-pipeline-clothing-participation-evaluator-v0',
]);

/**
 * Evaluator registry for Layer B visual garment qualification.
 * Production v0 contains no implemented visual evaluators.
 */
export const IMPLEMENTED_VISUAL_GARMENT_EVALUATORS = Object.freeze([]);

/**
 * Evaluator registry for Layer C empirical body-surface authorization.
 * Production v0 contains no implemented body-surface evaluators.
 */
export const IMPLEMENTED_BODY_SURFACE_EVALUATORS = Object.freeze([]);

/**
 * Reserved evaluator IDs for future extensions.
 */
export const RESERVED_FUTURE_VISUAL_GARMENT_EVALUATORS = Object.freeze([
  'vlm-garment-fit-classifier-v0',
  'rgb-garment-segmentation-classifier-v0',
  'standard-capture-garment-protocol-v0',
]);

export const RESERVED_FUTURE_BODY_SURFACE_EVALUATORS = Object.freeze([
  'empirical-activewear-ground-truth-v0',
  'controlled-capture-unclothed-protocol-v0',
  'statistical-garment-offset-model-v0',
]);

/**
 * Internal registries for controlled test-only evaluators.
 */
const TEST_ONLY_GARMENT_EVALUATORS = new Set();
const TEST_ONLY_BODY_SURFACE_EVALUATORS = new Set();

/**
 * Registers a test-only visual garment evaluator ID.
 * Exclusively for unit tests; not exposed to production callers.
 *
 * @param {string} evaluatorId
 */
export function _registerTestGarmentEvaluator(evaluatorId) {
  if (typeof evaluatorId === 'string' && evaluatorId.trim()) {
    TEST_ONLY_GARMENT_EVALUATORS.add(evaluatorId.trim());
  }
}

/**
 * Registers a test-only empirical body-surface evaluator ID.
 * Exclusively for unit tests; not exposed to production callers.
 *
 * @param {string} evaluatorId
 */
export function _registerTestBodySurfaceEvaluator(evaluatorId) {
  if (typeof evaluatorId === 'string' && evaluatorId.trim()) {
    TEST_ONLY_BODY_SURFACE_EVALUATORS.add(evaluatorId.trim());
  }
}

/**
 * Clears registered test-only clothing evaluators.
 */
export function _clearTestClothingEvaluators() {
  TEST_ONLY_GARMENT_EVALUATORS.clear();
  TEST_ONLY_BODY_SURFACE_EVALUATORS.clear();
}

/**
 * Helper to build a standardized check result.
 *
 * @param {string} id
 * @param {string} name
 * @param {'integrity'|'support_policy'|'participation'|'garment_fit'|'body_surface'|'provenance'} category
 * @param {'pass'|'fail'|'warning'|'skip'} status
 * @param {string} message
 * @param {string} provenance
 * @returns {object}
 */
function createCheckResult(id, name, category, status, message, provenance = 'clothing-body-surface-semantics-v0') {
  return {
    id,
    name,
    category,
    status,
    message,
    provenance,
  };
}

/**
 * Helper to build a standardized ClothingBodySurfaceValidationResult object.
 *
 * @param {object} params
 * @returns {object}
 */
function buildValidationResult({
  measurementId = null,
  view = null,
  supportPolicyId = null,
  status = CLOTHING_BODY_SURFACE_STATUS.UNAVAILABLE,
  authorized = false,
  evaluatorId = null,
  clothingParticipationValidated = false,
  clothingConstraintSatisfied = false,
  garmentFitQualified = false,
  candidateForMetrologyValidation = false,
  bodySurfaceAuthorized = false,
  usedClothingEvidence = false,
  clothingClassIdsUsed = [],
  actualClassIdsUsed = [],
  garmentType = null,
  garmentFit = null,
  garmentFitStatus = GARMENT_FIT_STATUS.UNRESOLVED,
  authorizationMode = 'none',
  declaredUncertaintyCm = null,
  checks = {},
  issues = [],
  warnings = [],
}) {
  const checkList = Object.values(checks);
  const totalChecks = checkList.length;
  const passedChecks = checkList.filter((c) => c.status === 'pass').length;
  const failedChecks = checkList.filter((c) => c.status === 'fail').length;
  const warnedChecks = checkList.filter((c) => c.status === 'warning').length;
  const skippedChecks = checkList.filter((c) => c.status === 'skip').length;

  return Object.freeze({
    contract: CLOTHING_BODY_SURFACE_CONTRACT,
    version: CLOTHING_BODY_SURFACE_CONTRACT_VERSION,
    measurementId,
    view,
    supportPolicyId,
    status,
    authorized,
    evaluatorId,
    dimensions: Object.freeze({
      clothingParticipationValidated,
      clothingConstraintSatisfied,
      garmentFitQualified,
      candidateForMetrologyValidation,
      bodySurfaceAuthorized,
    }),
    clothingEvidence: Object.freeze({
      usedClothingEvidence,
      clothingClassIdsUsed: Object.freeze([...clothingClassIdsUsed]),
      actualClassIdsUsed: Object.freeze([...actualClassIdsUsed]),
    }),
    garmentQualification: Object.freeze({
      evaluatorId: garmentType || garmentFit ? evaluatorId : null,
      garmentType,
      garmentFit,
      garmentFitStatus,
      garmentFitQualified,
      candidateForMetrologyValidation,
    }),
    bodySurfaceAuthorization: Object.freeze({
      evaluatorId: bodySurfaceAuthorized ? evaluatorId : null,
      authorizationMode,
      declaredUncertaintyCm,
      authorized: bodySurfaceAuthorized,
    }),
    summary: Object.freeze({
      totalChecks,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
    }),
    checks: Object.freeze({ ...checks }),
    issues: Object.freeze([...issues]),
    warnings: Object.freeze([...warnings]),
  });
}

/**
 * Evaluates clothing and body-surface semantics for a given measurement observation.
 *
 * @param {object|null|undefined} observation Measurement observation record (from 4.3 or 4.4)
 * @param {object} [options={}]
 * @param {object|null} [options.garmentEvaluationResult=null] Recognized Layer B visual evaluator result
 * @param {object|null} [options.bodySurfaceAuthorizationResult=null] Recognized Layer C empirical body-surface evaluator result
 * @param {string} [options.measurementId] Optional fallback measurement definition ID
 * @param {string} [options.view] Optional fallback view
 * @returns {object} Canonical ClothingBodySurfaceValidationResult
 */
export function evaluateClothingBodySurfaceSemantics(observation, options = {}) {
  const measurementId = observation?.definition?.id ?? observation?.id ?? options.measurementId ?? null;
  const view = observation?.view ?? options.view ?? null;
  const checks = {};
  const issues = [];
  const warnings = [];

  // 1. Source Integrity Check
  if (!observation) {
    checks.source_integrity = createCheckResult(
      'source_integrity',
      'Source Observation Integrity',
      'integrity',
      'fail',
      'Measurement observation is null or absent.',
    );
    issues.push('Measurement observation is missing.');

    return buildValidationResult({
      measurementId,
      view,
      status: CLOTHING_BODY_SURFACE_STATUS.UNAVAILABLE,
      authorized: false,
      checks,
      issues,
      warnings,
    });
  }

  checks.source_integrity = createCheckResult(
    'source_integrity',
    'Source Observation Integrity',
    'integrity',
    'pass',
    `Measurement observation is present for definition '${measurementId ?? 'unknown'}'.`,
  );

  // 2. Support Policy Provenance Check
  const supportPolicyId = observation.supportPolicyId
    ?? observation.provenance?.supportPolicyId
    ?? observation.slice?.supportPolicyId
    ?? null;
  const actualClassIdsUsed = Array.isArray(observation.actualClassIdsUsed)
    ? observation.actualClassIdsUsed
    : (Array.isArray(observation.provenance?.actualClassIdsUsed)
      ? observation.provenance.actualClassIdsUsed
      : (Array.isArray(observation.slice?.actualClassIdsUsed) ? observation.slice.actualClassIdsUsed : []));
  const clothingClassIdsUsed = Array.isArray(observation.clothingClassIdsUsed)
    ? observation.clothingClassIdsUsed
    : (Array.isArray(observation.provenance?.clothingClassIdsUsed)
      ? observation.provenance.clothingClassIdsUsed
      : (Array.isArray(observation.slice?.clothingClassIdsUsed) ? observation.slice.clothingClassIdsUsed : []));
  const usedClothingEvidence = typeof observation.usedClothingEvidence === 'boolean'
    ? observation.usedClothingEvidence
    : (typeof observation.provenance?.usedClothingEvidence === 'boolean'
      ? observation.provenance.usedClothingEvidence
      : (typeof observation.slice?.usedClothingEvidence === 'boolean'
        ? observation.slice.usedClothingEvidence
        : clothingClassIdsUsed.length > 0));

  if (!supportPolicyId) {
    checks.support_policy_provenance = createCheckResult(
      'support_policy_provenance',
      'Support Policy Provenance',
      'support_policy',
      'warning',
      'Support policy ID is absent on the source observation.',
    );
    warnings.push('Support policy ID is unrecorded.');
  } else {
    checks.support_policy_provenance = createCheckResult(
      'support_policy_provenance',
      'Support Policy Provenance',
      'support_policy',
      'pass',
      `Measurement is grounded in supported silhouette policy '${supportPolicyId}'.`,
    );
  }

  // 3. Contradictory Evidence Check
  if (!usedClothingEvidence && clothingClassIdsUsed.length > 0) {
    checks.clothing_participation = createCheckResult(
      'clothing_participation',
      'Clothing Participation Evidence',
      'participation',
      'fail',
      `Contradictory evidence: usedClothingEvidence is false but clothingClassIdsUsed contains [${clothingClassIdsUsed.join(', ')}].`,
    );
    issues.push('Contradictory clothing participation metadata.');

    return buildValidationResult({
      measurementId,
      view,
      supportPolicyId,
      status: CLOTHING_BODY_SURFACE_STATUS.INVALID,
      authorized: false,
      clothingParticipationValidated: false,
      clothingConstraintSatisfied: false,
      usedClothingEvidence,
      clothingClassIdsUsed,
      actualClassIdsUsed,
      checks,
      issues,
      warnings,
    });
  }

  // 4. Layer A — Clothing Participation Evaluation
  let clothingParticipationValidated = true;
  let clothingConstraintSatisfied = false;
  let garmentFitStatus = GARMENT_FIT_STATUS.UNRESOLVED;
  let garmentFitQualified = false;
  let candidateForMetrologyValidation = false;
  let bodySurfaceAuthorized = false;
  let authorizationMode = 'none';
  let declaredUncertaintyCm = null;
  let evaluatorId = 'body-pipeline-clothing-participation-evaluator-v0';

  if (!usedClothingEvidence) {
    // Clothing-Free Path
    clothingConstraintSatisfied = true;
    garmentFitStatus = GARMENT_FIT_STATUS.NOT_APPLICABLE;
    garmentFitQualified = false;
    candidateForMetrologyValidation = false;

    checks.clothing_participation = createCheckResult(
      'clothing_participation',
      'Clothing Participation Evidence',
      'participation',
      'pass',
      'Measurement silhouette contains 0 clothing pixels (100% bare anatomical classes).',
      evaluatorId,
    );

    checks.garment_fit_qualification = createCheckResult(
      'garment_fit_qualification',
      'Garment Fit Qualification',
      'garment_fit',
      'skip',
      'No clothing participated in this measurement; garment fit qualification is not applicable.',
      evaluatorId,
    );

    // Layer C: Clothing-free does NOT automatically prove true physical body surface
    const cResult = options.bodySurfaceAuthorizationResult;
    if (cResult && typeof cResult === 'object') {
      const cEvalId = cResult.evaluatorId;
      const isRecognizedC = IMPLEMENTED_BODY_SURFACE_EVALUATORS.includes(cEvalId) || TEST_ONLY_BODY_SURFACE_EVALUATORS.has(cEvalId);
      if (isRecognizedC && cResult.authorized === true) {
        bodySurfaceAuthorized = true;
        authorizationMode = cResult.authorizationMode ?? 'direct_equivalence';
        declaredUncertaintyCm = typeof cResult.declaredUncertaintyCm === 'number' ? cResult.declaredUncertaintyCm : null;
        evaluatorId = cEvalId;

        checks.body_surface_authorization = createCheckResult(
          'body_surface_authorization',
          'Body-Surface Authorization',
          'body_surface',
          'pass',
          `Authoritative body-surface evaluator '${cEvalId}' certified physical body surface.`,
          cEvalId,
        );
      } else {
        checks.body_surface_authorization = createCheckResult(
          'body_surface_authorization',
          'Body-Surface Authorization',
          'body_surface',
          'fail',
          `Provided body-surface evaluator '${cEvalId ?? 'unknown'}' is unrecognized or unauthorized.`,
        );
        issues.push(`Unrecognized body-surface evaluator '${cEvalId}'.`);
      }
    } else {
      checks.body_surface_authorization = createCheckResult(
        'body_surface_authorization',
        'Body-Surface Authorization',
        'body_surface',
        'skip',
        'Measurement contour is free of clothing interference, but authoritative empirical body-surface validation is uncertified.',
        evaluatorId,
      );
    }

    checks.evaluator_provenance = createCheckResult(
      'evaluator_provenance',
      'Evaluator Provenance Qualification',
      'provenance',
      'pass',
      `Evaluated by recognized participation evaluator '${evaluatorId}'.`,
      evaluatorId,
    );

    const finalStatus = bodySurfaceAuthorized
      ? CLOTHING_BODY_SURFACE_STATUS.AUTHORIZED
      : CLOTHING_BODY_SURFACE_STATUS.PARTIAL;

    return buildValidationResult({
      measurementId,
      view,
      supportPolicyId,
      status: finalStatus,
      authorized: bodySurfaceAuthorized,
      evaluatorId,
      clothingParticipationValidated,
      clothingConstraintSatisfied,
      garmentFitQualified,
      candidateForMetrologyValidation,
      bodySurfaceAuthorized,
      usedClothingEvidence,
      clothingClassIdsUsed,
      actualClassIdsUsed,
      garmentFitStatus,
      authorizationMode,
      declaredUncertaintyCm,
      checks,
      issues,
      warnings,
    });
  }

  // 5. Clothing-Present Path
  checks.clothing_participation = createCheckResult(
    'clothing_participation',
    'Clothing Participation Evidence',
    'participation',
    'pass',
    `Clothing pixels participated in supported silhouette: class IDs [${clothingClassIdsUsed.join(', ')}].`,
    evaluatorId,
  );

  // Layer B — Visual Garment Qualification
  let recognizedGarmentEvaluator = null;
  const bResult = options.garmentEvaluationResult;

  if (bResult && typeof bResult === 'object') {
    const bEvalId = bResult.evaluatorId;
    const isRecognizedB = IMPLEMENTED_VISUAL_GARMENT_EVALUATORS.includes(bEvalId) || TEST_ONLY_GARMENT_EVALUATORS.has(bEvalId);

    if (isRecognizedB) {
      recognizedGarmentEvaluator = bEvalId;
      garmentFitStatus = bResult.garmentFitStatus ?? (bResult.garmentFitQualified ? GARMENT_FIT_STATUS.QUALIFIED : GARMENT_FIT_STATUS.DISQUALIFIED);
      garmentFitQualified = bResult.garmentFitQualified === true || garmentFitStatus === GARMENT_FIT_STATUS.QUALIFIED;
      candidateForMetrologyValidation = bResult.candidateForMetrologyValidation === true || garmentFitQualified;

      if (garmentFitQualified) {
        checks.garment_fit_qualification = createCheckResult(
          'garment_fit_qualification',
          'Garment Fit Qualification',
          'garment_fit',
          'pass',
          `Visual garment evaluator '${bEvalId}' qualified garment fit (${bResult.garmentType ?? 'garment'} / ${bResult.garmentFit ?? 'fit'}) as candidate for metrology validation.`,
          bEvalId,
        );
      } else {
        checks.garment_fit_qualification = createCheckResult(
          'garment_fit_qualification',
          'Garment Fit Qualification',
          'garment_fit',
          'fail',
          `Visual garment evaluator '${bEvalId}' disqualified garment fit (${bResult.garmentType ?? 'garment'} / ${bResult.garmentFit ?? 'fit'}).`,
          bEvalId,
        );
        issues.push(`Garment fit disqualified by evaluator '${bEvalId}'.`);
      }
    } else {
      garmentFitStatus = GARMENT_FIT_STATUS.UNRESOLVED;
      checks.garment_fit_qualification = createCheckResult(
        'garment_fit_qualification',
        'Garment Fit Qualification',
        'garment_fit',
        'fail',
        `Caller supplied unverified visual garment evaluator '${bEvalId ?? 'unknown'}'. Arbitrary objects are strictly rejected.`,
      );
      issues.push(`Unrecognized visual garment evaluator '${bEvalId}'.`);
    }
  } else {
    garmentFitStatus = GARMENT_FIT_STATUS.UNRESOLVED;
    checks.garment_fit_qualification = createCheckResult(
      'garment_fit_qualification',
      'Garment Fit Qualification',
      'garment_fit',
      'skip',
      'Visual garment type and fit qualification (Layer B) is unresolved in current upstream evidence.',
      evaluatorId,
    );
  }

  // Layer C — Empirical Body-Surface Authorization
  const cResult = options.bodySurfaceAuthorizationResult;

  if (cResult && typeof cResult === 'object') {
    const cEvalId = cResult.evaluatorId;
    const isRecognizedC = IMPLEMENTED_BODY_SURFACE_EVALUATORS.includes(cEvalId) || TEST_ONLY_BODY_SURFACE_EVALUATORS.has(cEvalId);

    if (isRecognizedC) {
      if (cResult.authorized === true && garmentFitQualified) {
        bodySurfaceAuthorized = true;
        clothingConstraintSatisfied = true;
        authorizationMode = cResult.authorizationMode ?? 'direct_equivalence';
        declaredUncertaintyCm = typeof cResult.declaredUncertaintyCm === 'number' ? cResult.declaredUncertaintyCm : null;
        evaluatorId = cEvalId;

        checks.body_surface_authorization = createCheckResult(
          'body_surface_authorization',
          'Body-Surface Authorization',
          'body_surface',
          'pass',
          `Authoritative empirical body-surface evaluator '${cEvalId}' certified physical body surface.`,
          cEvalId,
        );
      } else {
        checks.body_surface_authorization = createCheckResult(
          'body_surface_authorization',
          'Body-Surface Authorization',
          'body_surface',
          'fail',
          `Body-surface evaluator '${cEvalId}' did not authorize physical surface (garmentFitQualified=${garmentFitQualified}, authorized=${cResult.authorized}).`,
          cEvalId,
        );
        issues.push(`Body-surface authorization rejected by '${cEvalId}'.`);
      }
    } else {
      checks.body_surface_authorization = createCheckResult(
        'body_surface_authorization',
        'Body-Surface Authorization',
        'body_surface',
        'fail',
        `Caller supplied unverified body-surface evaluator '${cEvalId ?? 'unknown'}'. Arbitrary objects are strictly rejected.`,
      );
      issues.push(`Unrecognized body-surface evaluator '${cEvalId}'.`);
    }
  } else {
    checks.body_surface_authorization = createCheckResult(
      'body_surface_authorization',
      'Body-Surface Authorization',
      'body_surface',
      'skip',
      'Authoritative empirical physical body-surface authorization (Layer C) is uncertified in current upstream evidence.',
      evaluatorId,
    );
  }

  // Provenance check
  const hasProvenanceIssues = issues.some((iss) => iss.includes('Unrecognized'));
  checks.evaluator_provenance = createCheckResult(
    'evaluator_provenance',
    'Evaluator Provenance Qualification',
    'provenance',
    hasProvenanceIssues ? 'fail' : 'pass',
    hasProvenanceIssues
      ? 'Unrecognized evaluator provenance encountered.'
      : `Evaluation executed under recognized participation evaluator '${evaluatorId}'.`,
    evaluatorId,
  );

  let finalStatus = CLOTHING_BODY_SURFACE_STATUS.PARTIAL;
  if (hasProvenanceIssues) {
    finalStatus = CLOTHING_BODY_SURFACE_STATUS.INVALID;
  } else if (bodySurfaceAuthorized && clothingConstraintSatisfied) {
    finalStatus = CLOTHING_BODY_SURFACE_STATUS.AUTHORIZED;
  }

  return buildValidationResult({
    measurementId,
    view,
    supportPolicyId,
    status: finalStatus,
    authorized: bodySurfaceAuthorized,
    evaluatorId,
    clothingParticipationValidated,
    clothingConstraintSatisfied,
    garmentFitQualified,
    candidateForMetrologyValidation,
    bodySurfaceAuthorized,
    usedClothingEvidence,
    clothingClassIdsUsed,
    actualClassIdsUsed,
    garmentType: bResult?.garmentType ?? null,
    garmentFit: bResult?.garmentFit ?? null,
    garmentFitStatus,
    authorizationMode,
    declaredUncertaintyCm,
    checks,
    issues,
    warnings,
  });
}

/**
 * Evaluates clothing and body-surface semantics across a set of measurement observations.
 *
 * @param {object} [options={}]
 * @param {Array<object>} [options.observations=[]]
 * @param {Map|object} [options.garmentEvaluationResults]
 * @param {Map|object} [options.bodySurfaceAuthorizationResults]
 * @returns {object} Summary report of all evaluated observations
 */
export function evaluateClothingBodySurfaceSemanticsReport(options = {}) {
  const observations = Array.isArray(options.observations) ? options.observations : [];
  const garmentResults = options.garmentEvaluationResults ?? {};
  const bodySurfaceResults = options.bodySurfaceAuthorizationResults ?? {};

  const results = [];
  let authorizedCount = 0;
  let partialCount = 0;
  let unvalidatedCount = 0;
  let invalidCount = 0;
  let unavailableCount = 0;
  let clothingConstraintSatisfiedCount = 0;

  for (const obs of observations) {
    const id = obs?.definition?.id ?? obs?.id ?? null;
    const gRes = garmentResults instanceof Map ? garmentResults.get(id) : garmentResults[id];
    const bRes = bodySurfaceResults instanceof Map ? bodySurfaceResults.get(id) : bodySurfaceResults[id];

    const val = evaluateClothingBodySurfaceSemantics(obs, {
      garmentEvaluationResult: gRes,
      bodySurfaceAuthorizationResult: bRes,
    });

    results.push(val);

    if (val.status === CLOTHING_BODY_SURFACE_STATUS.AUTHORIZED) authorizedCount++;
    else if (val.status === CLOTHING_BODY_SURFACE_STATUS.PARTIAL) partialCount++;
    else if (val.status === CLOTHING_BODY_SURFACE_STATUS.UNVALIDATED) unvalidatedCount++;
    else if (val.status === CLOTHING_BODY_SURFACE_STATUS.INVALID) invalidCount++;
    else unavailableCount++;

    if (val.dimensions.clothingConstraintSatisfied) clothingConstraintSatisfiedCount++;
  }

  return Object.freeze({
    contract: 'clothing-body-surface-semantics-report-v0',
    version: CLOTHING_BODY_SURFACE_CONTRACT_VERSION,
    summary: Object.freeze({
      total: results.length,
      authorizedCount,
      partialCount,
      unvalidatedCount,
      invalidCount,
      unavailableCount,
      clothingConstraintSatisfiedCount,
    }),
    results: Object.freeze(results),
  });
}

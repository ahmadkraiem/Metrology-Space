/**
 * Cross-view Comparability QA Module v0
 *
 * Pure deterministic QA evaluation layer over established 4.5A Cross-view Measurement Correspondence evidence.
 * Assesses whether a Front/Side correspondence pair is sufficiently qualified and internally consistent for later cross-view use.
 *
 * Contract: 'cross-view-comparability-qa-v0'
 *
 * STRICT GUARDRAILS:
 * - A 'pass' status certifies comparability ONLY at the current 2D evidence-contract level.
 * - 'pass' does NOT validate physical depth, does NOT equate Side U with canonical Z,
 *   does NOT approve 3D geometry fusion, and does NOT certify circumference or cross-section readiness.
 * - Pure and stateless: operates ONLY on the supplied 4.5A correspondence; does NOT read runtime state,
 *   re-scan segmentation, or re-sample raster rows.
 * - No new alignment algorithms, tolerance corrections, or remapping.
 */

import {
  CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT,
  CROSS_VIEW_CORRESPONDENCE_STATUS,
  SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0,
} from './crossViewMeasurementCorrespondence.js';

export const CROSS_VIEW_COMPARABILITY_QA_CONTRACT = 'cross-view-comparability-qa-v0';
export const CROSS_VIEW_COMPARABILITY_QA_CONTRACT_VERSION = 'cross-view-comparability-qa-v0';

/**
 * Deterministic status taxonomy for Cross-view comparability QA.
 * @readonly
 * @enum {string}
 */
export const CROSS_VIEW_COMPARABILITY_QA_STATUS = Object.freeze({
  PASS: 'pass',
  WARNING: 'warning',
  FAIL: 'fail',
  UNAVAILABLE: 'unavailable',
});

/**
 * Availability state for Cross-view comparability QA.
 * @readonly
 * @enum {string}
 */
export const CROSS_VIEW_COMPARABILITY_AVAILABILITY = Object.freeze({
  AVAILABLE: 'available',
  UNAVAILABLE: 'unavailable',
});

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   status: 'pass'|'fail'|'warning'|'skip',
 *   message: string,
 * }} CrossViewComparabilityCheckResult
 */

/**
 * @typedef {{
 *   contract: 'cross-view-comparability-qa-v0',
 *   version: 'cross-view-comparability-qa-v0',
 *   correspondenceId: string|null,
 *   sourceLevel: string|null,
 *   availability: 'available'|'unavailable',
 *   status: 'pass'|'warning'|'fail'|'unavailable',
 *   summary: {
 *     totalChecks: number,
 *     passedChecks: number,
 *     failedChecks: number,
 *     warnedChecks: number,
 *     skippedChecks: number,
 *   },
 *   checks: Record<string, CrossViewComparabilityCheckResult>,
 *   correspondence: object|null,
 *   issues: string[],
 *   warnings: string[],
 * }} CrossViewComparabilityQaResult
 */

/**
 * Evaluates pure deterministic comparability QA over a supplied 4.5A cross-view measurement correspondence.
 *
 * @param {object|null|undefined} correspondence - Cross-view measurement correspondence object (v0)
 * @param {{ id?: string|null }} [options]
 * @returns {CrossViewComparabilityQaResult}
 */
export function evaluateCrossViewComparabilityQa(correspondence, { id = null } = {}) {
  const issues = [];
  const warnings = [];
  const checks = {};

  const resolvedId = correspondence?.id ?? id ?? null;
  const supportedDef = resolvedId ? SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0[resolvedId] ?? null : null;
  const resolvedSourceLevel = correspondence?.sourceLevel ?? supportedDef?.sourceLevel ?? null;

  // Helper to record check result
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

  // 1. Correspondence Contract Validity Check
  if (!correspondence || typeof correspondence !== 'object') {
    recordCheck(
      'correspondence_contract_valid',
      'Correspondence Contract Validity',
      'fail',
      'Missing or malformed correspondence object: expected object with contract cross-view-measurement-correspondence-v0.',
    );
  } else if (correspondence.contract !== CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT) {
    recordCheck(
      'correspondence_contract_valid',
      'Correspondence Contract Validity',
      'fail',
      `Invalid correspondence contract: expected '${CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT}', received '${correspondence.contract}'.`,
    );
  } else {
    recordCheck(
      'correspondence_contract_valid',
      'Correspondence Contract Validity',
      'pass',
      `Valid correspondence contract '${CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT}'.`,
    );
  }

  // 2. Supported Definition Check
  if (!supportedDef) {
    recordCheck(
      'supported_definition',
      'Supported Registry Definition',
      'fail',
      `Unsupported or unregistered correspondence ID: '${resolvedId}'. Correspondence must be registry-driven.`,
    );
  } else {
    recordCheck(
      'supported_definition',
      'Supported Registry Definition',
      'pass',
      `Registered correspondence definition '${supportedDef.id}' for source level '${supportedDef.sourceLevel}'.`,
    );
  }

  // 3. Correspondence Status Check
  const corrStatus = correspondence?.status;
  if (!corrStatus || corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.INVALID) {
    const issueList = Array.isArray(correspondence?.issues) && correspondence.issues.length > 0
      ? correspondence.issues.join('; ')
      : 'Correspondence status is invalid or missing.';
    recordCheck(
      'correspondence_status',
      'Correspondence Status',
      'fail',
      `Correspondence status is invalid: ${issueList}`,
    );
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.READY) {
    recordCheck(
      'correspondence_status',
      'Correspondence Status',
      'pass',
      'Correspondence status is ready.',
    );
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.PARTIAL) {
    recordCheck(
      'correspondence_status',
      'Correspondence Status',
      'warning',
      'Correspondence status is partial: only one observation is valid.',
    );
  } else if (corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.UNAVAILABLE) {
    recordCheck(
      'correspondence_status',
      'Correspondence Status',
      'skip',
      'Correspondence status is unavailable.',
    );
  } else {
    recordCheck(
      'correspondence_status',
      'Correspondence Status',
      'fail',
      `Unknown correspondence status '${corrStatus}'.`,
    );
  }

  const isUnavailable = !correspondence || corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.UNAVAILABLE;
  const isPartial = corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.PARTIAL;
  const isReady = corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.READY;

  const frontObs = correspondence?.frontObservation ?? null;
  const sideObs = correspondence?.sideObservation ?? null;

  // 4. Front Observation Validity Check
  if (isUnavailable && !frontObs) {
    recordCheck(
      'front_observation_valid',
      'Front Observation Validity',
      'skip',
      'Front observation unavailable.',
    );
  } else if (!frontObs || typeof frontObs !== 'object') {
    if (isPartial) {
      recordCheck(
        'front_observation_valid',
        'Front Observation Validity',
        'warning',
        'Front observation is missing in partial correspondence.',
      );
    } else {
      recordCheck(
        'front_observation_valid',
        'Front Observation Validity',
        'fail',
        'Missing Front observation.',
      );
    }
  } else if (frontObs.contract !== 'front-transverse-width-v0' || frontObs.view !== 'front') {
    recordCheck(
      'front_observation_valid',
      'Front Observation Validity',
      'fail',
      `Invalid Front observation contract/view: expected 'front-transverse-width-v0' view 'front', received '${frontObs.contract}' view '${frontObs.view}'.`,
    );
  } else if (frontObs.status === 'valid') {
    recordCheck(
      'front_observation_valid',
      'Front Observation Validity',
      'pass',
      `Front observation '${frontObs.id}' is valid.`,
    );
  } else if (frontObs.status === 'unavailable' || frontObs.status === 'ambiguous') {
    if (isPartial) {
      recordCheck(
        'front_observation_valid',
        'Front Observation Validity',
        'warning',
        `Front observation is ${frontObs.status}.`,
      );
    } else if (isUnavailable) {
      recordCheck(
        'front_observation_valid',
        'Front Observation Validity',
        'skip',
        `Front observation is ${frontObs.status}.`,
      );
    } else {
      recordCheck(
        'front_observation_valid',
        'Front Observation Validity',
        'fail',
        `Front observation is ${frontObs.status} when correspondence was expected ready.`,
      );
    }
  } else {
    recordCheck(
      'front_observation_valid',
      'Front Observation Validity',
      'fail',
      `Front observation has invalid status: ${frontObs.issues?.join('; ') || 'invalid'}`,
    );
  }

  // 5. Side Observation Validity Check
  if (isUnavailable && !sideObs) {
    recordCheck(
      'side_observation_valid',
      'Side Observation Validity',
      'skip',
      'Side observation unavailable.',
    );
  } else if (!sideObs || typeof sideObs !== 'object') {
    if (isPartial) {
      recordCheck(
        'side_observation_valid',
        'Side Observation Validity',
        'warning',
        'Side observation is missing in partial correspondence.',
      );
    } else {
      recordCheck(
        'side_observation_valid',
        'Side Observation Validity',
        'fail',
        'Missing Side observation.',
      );
    }
  } else if (sideObs.contract !== 'side-profile-span-v0' || sideObs.view !== 'side') {
    recordCheck(
      'side_observation_valid',
      'Side Observation Validity',
      'fail',
      `Invalid Side observation contract/view: expected 'side-profile-span-v0' view 'side', received '${sideObs.contract}' view '${sideObs.view}'.`,
    );
  } else if (sideObs.status === 'valid') {
    recordCheck(
      'side_observation_valid',
      'Side Observation Validity',
      'pass',
      `Side observation '${sideObs.id}' is valid.`,
    );
  } else if (sideObs.status === 'unavailable' || sideObs.status === 'ambiguous') {
    if (isPartial) {
      recordCheck(
        'side_observation_valid',
        'Side Observation Validity',
        'warning',
        `Side observation is ${sideObs.status}.`,
      );
    } else if (isUnavailable) {
      recordCheck(
        'side_observation_valid',
        'Side Observation Validity',
        'skip',
        `Side observation is ${sideObs.status}.`,
      );
    } else {
      recordCheck(
        'side_observation_valid',
        'Side Observation Validity',
        'fail',
        `Side observation is ${sideObs.status} when correspondence was expected ready.`,
      );
    }
  } else {
    recordCheck(
      'side_observation_valid',
      'Side Observation Validity',
      'fail',
      `Side observation has invalid status: ${sideObs.issues?.join('; ') || 'invalid'}`,
    );
  }

  // 6. Source Level Consistency Check
  const frontSourceLevel = frontObs?.provenance?.sourceLevel;
  const sideSourceLevel = sideObs?.provenance?.sourceLevel;
  const expectedSourceLevel = supportedDef?.sourceLevel ?? resolvedSourceLevel;

  if (expectedSourceLevel && correspondence?.sourceLevel && correspondence.sourceLevel !== expectedSourceLevel) {
    recordCheck(
      'source_level_consistent',
      'Source Anatomical Level Consistency',
      'fail',
      `Correspondence sourceLevel '${correspondence.sourceLevel}' does not match expected definition source level '${expectedSourceLevel}'.`,
    );
  } else if (frontSourceLevel && frontSourceLevel !== expectedSourceLevel) {
    recordCheck(
      'source_level_consistent',
      'Source Anatomical Level Consistency',
      'fail',
      `Front observation sourceLevel '${frontSourceLevel}' does not match expected level '${expectedSourceLevel}'.`,
    );
  } else if (sideSourceLevel && sideSourceLevel !== expectedSourceLevel) {
    recordCheck(
      'source_level_consistent',
      'Source Anatomical Level Consistency',
      'fail',
      `Side observation sourceLevel '${sideSourceLevel}' does not match expected level '${expectedSourceLevel}'.`,
    );
  } else if (!expectedSourceLevel) {
    recordCheck(
      'source_level_consistent',
      'Source Anatomical Level Consistency',
      'fail',
      'Missing expected anatomical source level.',
    );
  } else {
    recordCheck(
      'source_level_consistent',
      'Source Anatomical Level Consistency',
      'pass',
      `Source anatomical level '${expectedSourceLevel}' is consistent across Front and Side.`,
    );
  }

  // 7. Y-level Provenance Consistency Check (Reusing exact 4.5A consistency rule)
  const frontY = correspondence?.provenance?.frontLevelYcm ?? frontObs?.provenance?.levelYcm ?? null;
  const sideY = correspondence?.provenance?.sideLevelYcm ?? sideObs?.provenance?.levelYcm ?? null;
  const hasFiniteFrontY = typeof frontY === 'number' && Number.isFinite(frontY);
  const hasFiniteSideY = typeof sideY === 'number' && Number.isFinite(sideY);

  if (hasFiniteFrontY && hasFiniteSideY) {
    if (Math.abs(frontY - sideY) > 1e-4) {
      recordCheck(
        'y_provenance_consistent',
        'Y-level Provenance Consistency',
        'fail',
        `Contradictory Y-level provenance: Front levelYcm (${frontY}) does not match Side levelYcm (${sideY}).`,
      );
    } else {
      recordCheck(
        'y_provenance_consistent',
        'Y-level Provenance Consistency',
        'pass',
        `Front and Side levelYcm agree at ${frontY} cm.`,
      );
    }
  } else if (isReady) {
    recordCheck(
      'y_provenance_consistent',
      'Y-level Provenance Consistency',
      'fail',
      'Missing finite Y-level provenance on ready correspondence.',
    );
  } else if (hasFiniteFrontY || hasFiniteSideY) {
    recordCheck(
      'y_provenance_consistent',
      'Y-level Provenance Consistency',
      'pass',
      `Partial Y-level provenance present (Front: ${frontY}, Side: ${sideY}).`,
    );
  } else if (isUnavailable) {
    recordCheck(
      'y_provenance_consistent',
      'Y-level Provenance Consistency',
      'skip',
      'Y-level provenance unavailable.',
    );
  } else {
    recordCheck(
      'y_provenance_consistent',
      'Y-level Provenance Consistency',
      'skip',
      'No Y-level provenance recorded.',
    );
  }

  // 8. Front Measurement Evidence Completeness Check
  if (frontObs?.status === 'valid') {
    const val = frontObs.valueCm;
    const leftX = frontObs.provenance?.leftXcm;
    const rightX = frontObs.provenance?.rightXcm;
    const hasValidVal = typeof val === 'number' && Number.isFinite(val) && val > 0;
    const hasValidEndpoints = typeof leftX === 'number' && Number.isFinite(leftX)
      && typeof rightX === 'number' && Number.isFinite(rightX)
      && leftX < rightX;

    if (hasValidVal && hasValidEndpoints) {
      recordCheck(
        'front_measurement_evidence_complete',
        'Front Measurement Evidence Completeness',
        'pass',
        `Front transverse width complete: ${val} cm (X: ${leftX} to ${rightX} cm).`,
      );
    } else {
      recordCheck(
        'front_measurement_evidence_complete',
        'Front Measurement Evidence Completeness',
        'fail',
        `Incomplete Front measurement evidence on valid observation: valueCm=${val}, leftXcm=${leftX}, rightXcm=${rightX}.`,
      );
    }
  } else if (isPartial && frontObs?.status !== 'valid') {
    recordCheck(
      'front_measurement_evidence_complete',
      'Front Measurement Evidence Completeness',
      'warning',
      'Front measurement evidence not available in partial correspondence.',
    );
  } else if (isUnavailable) {
    recordCheck(
      'front_measurement_evidence_complete',
      'Front Measurement Evidence Completeness',
      'skip',
      'Front measurement evidence unavailable.',
    );
  } else {
    recordCheck(
      'front_measurement_evidence_complete',
      'Front Measurement Evidence Completeness',
      'fail',
      'Front measurement evidence missing or incomplete.',
    );
  }

  // 9. Side Profile Evidence Completeness Check
  if (sideObs?.status === 'valid') {
    const val = sideObs.valueCm;
    const minU = sideObs.minUcm ?? sideObs.provenance?.minUcm;
    const maxU = sideObs.maxUcm ?? sideObs.provenance?.maxUcm;
    const hasValidVal = typeof val === 'number' && Number.isFinite(val) && val > 0;
    const hasValidEndpoints = typeof minU === 'number' && Number.isFinite(minU)
      && typeof maxU === 'number' && Number.isFinite(maxU)
      && minU < maxU;

    if (hasValidVal && hasValidEndpoints) {
      recordCheck(
        'side_profile_evidence_complete',
        'Side Profile Evidence Completeness',
        'pass',
        `Side profile span complete: ${val} cm (U: ${minU} to ${maxU} cm).`,
      );
    } else {
      recordCheck(
        'side_profile_evidence_complete',
        'Side Profile Evidence Completeness',
        'fail',
        `Incomplete Side profile evidence on valid observation: valueCm=${val}, minUcm=${minU}, maxUcm=${maxU}.`,
      );
    }
  } else if (isPartial && sideObs?.status !== 'valid') {
    recordCheck(
      'side_profile_evidence_complete',
      'Side Profile Evidence Completeness',
      'warning',
      'Side profile evidence not available in partial correspondence.',
    );
  } else if (isUnavailable) {
    recordCheck(
      'side_profile_evidence_complete',
      'Side Profile Evidence Completeness',
      'skip',
      'Side profile evidence unavailable.',
    );
  } else {
    recordCheck(
      'side_profile_evidence_complete',
      'Side Profile Evidence Completeness',
      'fail',
      'Side profile evidence missing or incomplete.',
    );
  }

  // 10. Source Slice Provenance Completeness Check (Structural provenance only; no pixel scanning)
  let sliceProvFail = false;
  if (frontObs?.status === 'valid') {
    const row = frontObs.provenance?.sampledPixelRow;
    const contract = frontObs.provenance?.sourceSliceContract;
    if (typeof row !== 'number' || !Number.isInteger(row) || row < 0 || contract !== 'front-horizontal-raster-slice-v0') {
      sliceProvFail = true;
    }
  }
  if (sideObs?.status === 'valid') {
    const row = sideObs.provenance?.sampledPixelRow;
    const contract = sideObs.provenance?.sourceSliceContract;
    if (typeof row !== 'number' || !Number.isInteger(row) || row < 0 || contract !== 'side-horizontal-raster-slice-v0') {
      sliceProvFail = true;
    }
  }

  if (sliceProvFail) {
    recordCheck(
      'source_slice_provenance_complete',
      'Source Slice Provenance Completeness',
      'fail',
      'Missing or malformed source slice provenance on valid observation.',
    );
  } else if (isReady) {
    recordCheck(
      'source_slice_provenance_complete',
      'Source Slice Provenance Completeness',
      'pass',
      'Source slice provenance complete for Front and Side.',
    );
  } else if (isPartial) {
    recordCheck(
      'source_slice_provenance_complete',
      'Source Slice Provenance Completeness',
      'pass',
      'Source slice provenance complete for available observation.',
    );
  } else if (isUnavailable) {
    recordCheck(
      'source_slice_provenance_complete',
      'Source Slice Provenance Completeness',
      'skip',
      'Source slice provenance unavailable.',
    );
  } else {
    recordCheck(
      'source_slice_provenance_complete',
      'Source Slice Provenance Completeness',
      'fail',
      'Missing source slice provenance.',
    );
  }

  // Summary statistics calculation
  const allCheckValues = Object.values(checks);
  const totalChecks = allCheckValues.length;
  const passedChecks = allCheckValues.filter((c) => c.status === 'pass').length;
  const failedChecks = allCheckValues.filter((c) => c.status === 'fail').length;
  const warnedChecks = allCheckValues.filter((c) => c.status === 'warning').length;
  const skippedChecks = allCheckValues.filter((c) => c.status === 'skip').length;

  // Overall status resolution
  let overallStatus;
  let availability;

  if (!correspondence || corrStatus === CROSS_VIEW_CORRESPONDENCE_STATUS.UNAVAILABLE) {
    if (failedChecks > 0) {
      overallStatus = CROSS_VIEW_COMPARABILITY_QA_STATUS.FAIL;
      availability = CROSS_VIEW_COMPARABILITY_AVAILABILITY.AVAILABLE;
    } else {
      overallStatus = CROSS_VIEW_COMPARABILITY_QA_STATUS.UNAVAILABLE;
      availability = CROSS_VIEW_COMPARABILITY_AVAILABILITY.UNAVAILABLE;
    }
  } else {
    availability = CROSS_VIEW_COMPARABILITY_AVAILABILITY.AVAILABLE;
    if (failedChecks > 0) {
      overallStatus = CROSS_VIEW_COMPARABILITY_QA_STATUS.FAIL;
    } else if (warnedChecks > 0 || isPartial) {
      overallStatus = CROSS_VIEW_COMPARABILITY_QA_STATUS.WARNING;
    } else {
      overallStatus = CROSS_VIEW_COMPARABILITY_QA_STATUS.PASS;
    }
  }

  return {
    contract: CROSS_VIEW_COMPARABILITY_QA_CONTRACT,
    version: CROSS_VIEW_COMPARABILITY_QA_CONTRACT_VERSION,
    correspondenceId: resolvedId,
    sourceLevel: resolvedSourceLevel,
    availability,
    status: overallStatus,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
    },
    checks,
    correspondence: correspondence ?? null,
    issues,
    warnings,
  };
}

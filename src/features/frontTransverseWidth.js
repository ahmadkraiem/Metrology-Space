/**
 * Front Transverse Width Interpretation Contract v0
 *
 * Pure deterministic domain contract that interprets Front horizontal raster slice
 * evidence at an anatomical reference level into explicit transverse width observations
 * under a strictly defined run-selection policy.
 *
 * Contract: 'front-transverse-width-v0'
 * View: 'front'
 *
 * STRICT GUARDRAILS:
 * - Evidence interpretation only: consumes pre-computed front-horizontal-raster-slice-v0
 *   results and anatomical-levels-v0 reports; does NOT rescan rasters or decode buffers.
 * - Does not modify or replace landmark-to-landmark chord distances in bodyMeasurementLines.js.
 * - Uses single_run_required policy in v0: multi-run slices are marked 'ambiguous' (valueCm: null);
 *   no automatic merging or heuristic selection.
 * - Torso class 22 only in v0: does not merge apparel/clothing classes into body width.
 * - Front only: does not use Side evidence, Pointmap, or Normals.
 */

import { FRONT_RASTER_SLICE_POLICIES } from './frontRasterSlice.js';
import {
  MEASUREMENT_SUPPORT_POLICIES_V0,
  getMeasurementSupportPolicy,
  resolveMeasurementSupportPolicy,
} from './measurementSupportPolicy.js';

export const FRONT_TRANSVERSE_WIDTH_CONTRACT = 'front-transverse-width-v0';
export const FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION = 'front-transverse-width-v0';

/**
 * Supported run selection policies.
 * @readonly
 * @enum {string}
 */
export const FRONT_RUN_SELECTION_POLICIES = Object.freeze({
  SINGLE_RUN_REQUIRED: 'single_run_required',
});

/**
 * Exact 4-state status enum for transverse width observations.
 * @readonly
 * @enum {string}
 */
export const FRONT_TRANSVERSE_WIDTH_STATUS = Object.freeze({
  VALID: 'valid',
  UNAVAILABLE: 'unavailable',
  AMBIGUOUS: 'ambiguous',
  INVALID: 'invalid',
});

/**
 * Authoritative registry of supported Front transverse width definitions (v0).
 * Grounded in validated anatomical-levels-v0 (shoulder, hip) and measurement-support-policy-v0.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   sourceLevel: 'shoulder'|'hip',
 *   targetPolicy: string,
 *   supportPolicyId: string,
 *   targetClassIds: readonly number[],
 *   runSelectionPolicy: 'single_run_required',
 * }>>}
 */
export const SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0 = Object.freeze({
  torso_width_at_shoulder_level: Object.freeze({
    id: 'torso_width_at_shoulder_level',
    name: 'Torso Transverse Width at Shoulder Level',
    sourceLevel: 'shoulder',
    targetPolicy: 'trunk_core_support_v0',
    supportPolicyId: 'trunk_core_support_v0',
    targetClassIds: MEASUREMENT_SUPPORT_POLICIES_V0.trunk_core_support_v0.acceptedClassIds,
    runSelectionPolicy: FRONT_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED,
  }),
  torso_width_at_hip_level: Object.freeze({
    id: 'torso_width_at_hip_level',
    name: 'Torso Transverse Width at Hip Level',
    sourceLevel: 'hip',
    targetPolicy: 'pelvic_core_support_v0',
    supportPolicyId: 'pelvic_core_support_v0',
    targetClassIds: MEASUREMENT_SUPPORT_POLICIES_V0.pelvic_core_support_v0.acceptedClassIds,
    runSelectionPolicy: FRONT_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED,
  }),
});

/**
 * @typedef {{
 *   contract: 'front-transverse-width-v0',
 *   version: 'front-transverse-width-v0',
 *   view: 'front',
 *   id: string,
 *   name: string,
 *   type: 'transverse_width',
 *   status: 'valid'|'unavailable'|'ambiguous'|'invalid',
 *   valueCm: number|null,
 *   provenance: {
 *     sourceLevel: string|null,
 *     levelYcm: number|null,
 *     sampledPixelRow: number|null,
 *     sourceSliceContract: string|null,
 *     targetPolicy: string|null,
 *     supportPolicyId: string|null,
 *     targetClassIds: number[],
 *     actualClassIdsUsed: number[],
 *     clothingClassIdsUsed: number[],
 *     usedClothingEvidence: boolean,
 *     runSelectionPolicy: string,
 *     selectedRunIndex: number|null,
 *     leftXcm: number|null,
 *     rightXcm: number|null,
 *   },
 *   issues: string[],
 * }} FrontTransverseWidthResultV0
 */

/**
 * Interprets a Front horizontal raster slice result into a formal transverse width observation.
 *
 * @param {object|null|undefined} sliceResult - Output from sampleFrontHorizontalRasterSlice
 * @param {{
 *   definition?: typeof SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0[keyof typeof SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0]|string|null,
 *   level?: { id?: string, status?: string, yCm?: number|null }|null,
 *   runSelectionPolicy?: string,
 *   targetPolicy?: string,
 *   supportPolicyId?: string,
 * }} [options]
 * @returns {FrontTransverseWidthResultV0}
 */
export function interpretFrontTransverseWidth(sliceResult, {
  definition = null,
  level = null,
  runSelectionPolicy = FRONT_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED,
  targetPolicy = 'trunk_core_support_v0',
  supportPolicyId = null,
} = {}) {
  const issues = [];

  // Resolve definition object if string ID or preset was provided
  const resolvedDef = (typeof definition === 'string')
    ? (SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0[definition] ?? null)
    : (definition && typeof definition === 'object' ? definition : null);

  const id = resolvedDef?.id ?? (typeof definition === 'string' ? definition : 'custom_transverse_width');
  const name = resolvedDef?.name ?? (resolvedDef?.id ?? id);
  const sourceLevel = resolvedDef?.sourceLevel ?? (level?.id ?? null);
  const effectiveRunPolicy = resolvedDef?.runSelectionPolicy ?? runSelectionPolicy;
  const effectiveTargetPolicy = resolvedDef?.targetPolicy ?? targetPolicy;

  // Resolve measurement support policy definition
  const resolvedSupportPolicy = getMeasurementSupportPolicy(resolvedDef?.supportPolicyId ?? supportPolicyId)
    ?? resolveMeasurementSupportPolicy(id);
  const effectiveSupportPolicyId = resolvedSupportPolicy?.id ?? resolvedDef?.supportPolicyId ?? supportPolicyId ?? null;

  // Helper to build early/empty provenance
  const buildEmptyProvenance = (selectedRunIndex = null, leftXcm = null, rightXcm = null) => ({
    sourceLevel,
    levelYcm: level?.yCm ?? sliceResult?.requestedYcm ?? null,
    sampledPixelRow: sliceResult?.sampledRow ?? null,
    sourceSliceContract: sliceResult?.contract ?? null,
    targetPolicy: effectiveTargetPolicy,
    supportPolicyId: effectiveSupportPolicyId,
    targetClassIds: sliceResult?.targetClassIds ?? [],
    actualClassIdsUsed: [],
    clothingClassIdsUsed: [],
    usedClothingEvidence: false,
    runSelectionPolicy: effectiveRunPolicy,
    selectedRunIndex,
    leftXcm,
    rightXcm,
  });

  // Validate supported run selection policy
  if (effectiveRunPolicy !== FRONT_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED) {
    issues.push(`Unsupported runSelectionPolicy: '${effectiveRunPolicy}'. Only 'single_run_required' is supported in v0.`);
    return {
      contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
      version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
      view: 'front',
      id,
      name,
      type: 'transverse_width',
      status: FRONT_TRANSVERSE_WIDTH_STATUS.INVALID,
      valueCm: null,
      provenance: buildEmptyProvenance(),
      issues,
    };
  }

  // Check Anatomical Level Readiness
  if (level) {
    if (level.status === 'missing' || level.status === 'partial') {
      issues.push(`Source anatomical level '${sourceLevel}' status is '${level.status}'. Width calculation requires a ready level.`);
      return {
        contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
        version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
        view: 'front',
        id,
        name,
        type: 'transverse_width',
        status: FRONT_TRANSVERSE_WIDTH_STATUS.UNAVAILABLE,
        valueCm: null,
        provenance: buildEmptyProvenance(),
        issues,
      };
    }
  }

  // Check Slice Result Presence and Contract
  if (!sliceResult || typeof sliceResult !== 'object') {
    issues.push('Missing or invalid sliceResult: expected a front-horizontal-raster-slice-v0 result object.');
    return {
      contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
      version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
      view: 'front',
      id,
      name,
      type: 'transverse_width',
      status: FRONT_TRANSVERSE_WIDTH_STATUS.UNAVAILABLE,
      valueCm: null,
      provenance: buildEmptyProvenance(),
      issues,
    };
  }

  if (sliceResult.contract !== 'front-horizontal-raster-slice-v0' || !Array.isArray(sliceResult.runs)) {
    issues.push(`Invalid sliceResult contract: '${sliceResult.contract}'. Expected 'front-horizontal-raster-slice-v0'.`);
    return {
      contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
      version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
      view: 'front',
      id,
      name,
      type: 'transverse_width',
      status: FRONT_TRANSVERSE_WIDTH_STATUS.INVALID,
      valueCm: null,
      provenance: buildEmptyProvenance(),
      issues,
    };
  }

  // Forward any issues from the slice
  if (Array.isArray(sliceResult.issues) && sliceResult.issues.length > 0) {
    for (const is of sliceResult.issues) {
      issues.push(`Slice issue: ${is}`);
    }
  }

  const runs = sliceResult.runs;

  // Single Run Required Policy
  if (runs.length === 0) {
    issues.push('No matching segmentation runs found on sampled row.');
    return {
      contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
      version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
      view: 'front',
      id,
      name,
      type: 'transverse_width',
      status: FRONT_TRANSVERSE_WIDTH_STATUS.UNAVAILABLE,
      valueCm: null,
      provenance: buildEmptyProvenance(),
      issues,
    };
  }

  if (runs.length > 1) {
    issues.push(`Multiple separated runs (${runs.length}) found on row under '${effectiveRunPolicy}' policy. Width is ambiguous.`);
    return {
      contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
      version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
      view: 'front',
      id,
      name,
      type: 'transverse_width',
      status: FRONT_TRANSVERSE_WIDTH_STATUS.AMBIGUOUS,
      valueCm: null,
      provenance: buildEmptyProvenance(),
      issues,
    };
  }

  // Exactly 1 run
  const selectedRun = runs[0];
  const leftXcm = selectedRun.boundsCm?.minX;
  const rightXcm = selectedRun.boundsCm?.maxX;

  if (
    typeof leftXcm !== 'number'
    || !Number.isFinite(leftXcm)
    || typeof rightXcm !== 'number'
    || !Number.isFinite(rightXcm)
    || rightXcm <= leftXcm
  ) {
    issues.push(`Invalid run metric bounds: minX (${leftXcm}), maxX (${rightXcm}).`);
    return {
      contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
      version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
      view: 'front',
      id,
      name,
      type: 'transverse_width',
      status: FRONT_TRANSVERSE_WIDTH_STATUS.INVALID,
      valueCm: null,
      provenance: buildEmptyProvenance(0, typeof leftXcm === 'number' ? leftXcm : null, typeof rightXcm === 'number' ? rightXcm : null),
      issues,
    };
  }

  const valueCm = rightXcm - leftXcm;

  // Extract class provenance from the run
  const actualClassIdsUsed = Array.isArray(selectedRun.encounteredClassIds) && selectedRun.encounteredClassIds.length > 0
    ? selectedRun.encounteredClassIds
    : (sliceResult.targetClassIds ?? []);

  const clothingClassIdsUsed = actualClassIdsUsed.filter(
    (cid) => resolvedSupportPolicy?.clothingBridgeClassIds?.includes(cid),
  );
  const usedClothingEvidence = clothingClassIdsUsed.length > 0;

  return {
    contract: FRONT_TRANSVERSE_WIDTH_CONTRACT,
    version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
    view: 'front',
    id,
    name,
    type: 'transverse_width',
    status: FRONT_TRANSVERSE_WIDTH_STATUS.VALID,
    valueCm,
    provenance: {
      sourceLevel,
      levelYcm: level?.yCm ?? sliceResult.requestedYcm ?? null,
      sampledPixelRow: sliceResult.sampledRow ?? null,
      sourceSliceContract: sliceResult.contract,
      targetPolicy: effectiveTargetPolicy,
      supportPolicyId: effectiveSupportPolicyId,
      targetClassIds: sliceResult.targetClassIds ?? [],
      actualClassIdsUsed,
      clothingClassIdsUsed,
      usedClothingEvidence,
      runSelectionPolicy: effectiveRunPolicy,
      selectedRunIndex: 0,
      leftXcm,
      rightXcm,
    },
    issues,
  };
}


/**
 * Side Profile Span Interpretation Contract v0
 *
 * Pure deterministic domain contract that interprets Side horizontal raster slice
 * evidence at an anatomical reference level into explicit profile span observations
 * under a strictly defined run-selection policy.
 *
 * Contract: 'side-profile-span-v0'
 * View: 'side'
 *
 * STRICT GUARDRAILS:
 * - Evidence interpretation only: consumes pre-computed side-horizontal-raster-slice-v0
 *   results and anatomical-levels-v0 reports; does NOT rescan rasters or decode buffers.
 * - Side U is 2D profile coordinate evidence only; it is NOT canonical Z or validated physical depth.
 * - No U -> Z conversion, no cross-view calculations, and no Front/Side fusion.
 * - Uses single_run_required policy in v0: multi-run slices are marked 'ambiguous' (valueCm: null);
 *   no automatic merging or heuristic selection.
 * - Torso class 22 only in v0: does not merge apparel/clothing classes into body profile span.
 * - Side only: does not consume Front evidence, Pointmap, or Normals.
 */

import { SIDE_RASTER_SLICE_POLICIES } from './sideRasterSlice.js';

export const SIDE_PROFILE_SPAN_CONTRACT = 'side-profile-span-v0';
export const SIDE_PROFILE_SPAN_CONTRACT_VERSION = 'side-profile-span-v0';

/**
 * Supported run selection policies.
 * @readonly
 * @enum {string}
 */
export const SIDE_RUN_SELECTION_POLICIES = Object.freeze({
  SINGLE_RUN_REQUIRED: 'single_run_required',
});

/**
 * Exact 4-state status enum for profile span observations.
 * @readonly
 * @enum {string}
 */
export const SIDE_PROFILE_SPAN_STATUS = Object.freeze({
  VALID: 'valid',
  UNAVAILABLE: 'unavailable',
  AMBIGUOUS: 'ambiguous',
  INVALID: 'invalid',
});

/**
 * Authoritative registry of supported Side profile span definitions (v0).
 * Grounded in validated anatomical-levels-v0 (shoulder, hip) and TORSO_ONLY class 22.
 *
 * @type {Readonly<Record<string, {
 *   id: string,
 *   name: string,
 *   sourceLevel: 'shoulder'|'hip',
 *   targetPolicy: 'torso_only',
 *   targetClassIds: readonly number[],
 *   runSelectionPolicy: 'single_run_required',
 * }>>}
 */
export const SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0 = Object.freeze({
  torso_profile_span_at_shoulder_level: Object.freeze({
    id: 'torso_profile_span_at_shoulder_level',
    name: 'Torso Profile Span at Shoulder Level',
    sourceLevel: 'shoulder',
    targetPolicy: 'torso_only',
    targetClassIds: SIDE_RASTER_SLICE_POLICIES.TORSO_ONLY,
    runSelectionPolicy: SIDE_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED,
  }),
  torso_profile_span_at_hip_level: Object.freeze({
    id: 'torso_profile_span_at_hip_level',
    name: 'Torso Profile Span at Hip Level',
    sourceLevel: 'hip',
    targetPolicy: 'torso_only',
    targetClassIds: SIDE_RASTER_SLICE_POLICIES.TORSO_ONLY,
    runSelectionPolicy: SIDE_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED,
  }),
});

/**
 * @typedef {{
 *   contract: 'side-profile-span-v0',
 *   version: 'side-profile-span-v0',
 *   view: 'side',
 *   id: string,
 *   name: string,
 *   type: 'profile_span',
 *   status: 'valid'|'unavailable'|'ambiguous'|'invalid',
 *   valueCm: number|null,
 *   minUcm: number|null,
 *   maxUcm: number|null,
 *   provenance: {
 *     sourceLevel: string|null,
 *     levelYcm: number|null,
 *     sampledPixelRow: number|null,
 *     sourceSliceContract: string|null,
 *     targetPolicy: string|null,
 *     targetClassIds: number[],
 *     runSelectionPolicy: string,
 *     selectedRunIndex: number|null,
 *     minUcm: number|null,
 *     maxUcm: number|null,
 *   },
 *   issues: string[],
 * }} SideProfileSpanResultV0
 */

/**
 * Interprets a Side horizontal raster slice result into a formal profile span observation.
 * Pure and deterministic.
 *
 * @param {object|null|undefined} sliceResult - Output from sampleSideHorizontalRasterSlice
 * @param {{
 *   definition?: typeof SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0[keyof typeof SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0]|string|null,
 *   level?: { id?: string, status?: string, yCm?: number|null }|null,
 *   runSelectionPolicy?: string,
 *   targetPolicy?: string,
 * }} [options]
 * @returns {SideProfileSpanResultV0}
 */
export function interpretSideProfileSpan(sliceResult, {
  definition = null,
  level = null,
  runSelectionPolicy = SIDE_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED,
  targetPolicy = 'torso_only',
} = {}) {
  const issues = [];

  // Resolve definition object if string ID or preset was provided
  const resolvedDef = (typeof definition === 'string')
    ? (SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0[definition] ?? null)
    : (definition && typeof definition === 'object' ? definition : null);

  const id = resolvedDef?.id ?? (typeof definition === 'string' ? definition : 'custom_profile_span');
  const name = resolvedDef?.name ?? (resolvedDef?.id ?? id);
  const sourceLevel = resolvedDef?.sourceLevel ?? (level?.id ?? null);
  const effectiveRunPolicy = resolvedDef?.runSelectionPolicy ?? runSelectionPolicy;
  const effectiveTargetPolicy = resolvedDef?.targetPolicy ?? targetPolicy;

  // Validate supported run selection policy
  if (effectiveRunPolicy !== SIDE_RUN_SELECTION_POLICIES.SINGLE_RUN_REQUIRED) {
    issues.push(`Unsupported runSelectionPolicy: '${effectiveRunPolicy}'. Only 'single_run_required' is supported in v0.`);
    return {
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
      view: 'side',
      id,
      name,
      type: 'profile_span',
      status: SIDE_PROFILE_SPAN_STATUS.INVALID,
      valueCm: null,
      minUcm: null,
      maxUcm: null,
      provenance: {
        sourceLevel,
        levelYcm: level?.yCm ?? null,
        sampledPixelRow: sliceResult?.sampledRow ?? null,
        sourceSliceContract: sliceResult?.contract ?? null,
        targetPolicy: effectiveTargetPolicy,
        targetClassIds: sliceResult?.targetClassIds ?? [],
        runSelectionPolicy: effectiveRunPolicy,
        selectedRunIndex: null,
        minUcm: null,
        maxUcm: null,
      },
      issues,
    };
  }

  // Check Anatomical Level Readiness
  if (level) {
    if (level.status === 'missing' || level.status === 'partial') {
      issues.push(`Source anatomical level '${sourceLevel}' status is '${level.status}'. Profile span calculation requires a ready level.`);
      return {
        contract: SIDE_PROFILE_SPAN_CONTRACT,
        version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
        view: 'side',
        id,
        name,
        type: 'profile_span',
        status: SIDE_PROFILE_SPAN_STATUS.UNAVAILABLE,
        valueCm: null,
        minUcm: null,
        maxUcm: null,
        provenance: {
          sourceLevel,
          levelYcm: level.yCm ?? null,
          sampledPixelRow: sliceResult?.sampledRow ?? null,
          sourceSliceContract: sliceResult?.contract ?? null,
          targetPolicy: effectiveTargetPolicy,
          targetClassIds: sliceResult?.targetClassIds ?? [],
          runSelectionPolicy: effectiveRunPolicy,
          selectedRunIndex: null,
          minUcm: null,
          maxUcm: null,
        },
        issues,
      };
    }
  }

  // Check Slice Result Presence and Contract
  if (!sliceResult || typeof sliceResult !== 'object') {
    issues.push('Missing or invalid sliceResult: expected a side-horizontal-raster-slice-v0 result object.');
    return {
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
      view: 'side',
      id,
      name,
      type: 'profile_span',
      status: SIDE_PROFILE_SPAN_STATUS.UNAVAILABLE,
      valueCm: null,
      minUcm: null,
      maxUcm: null,
      provenance: {
        sourceLevel,
        levelYcm: level?.yCm ?? null,
        sampledPixelRow: null,
        sourceSliceContract: null,
        targetPolicy: effectiveTargetPolicy,
        targetClassIds: [],
        runSelectionPolicy: effectiveRunPolicy,
        selectedRunIndex: null,
        minUcm: null,
        maxUcm: null,
      },
      issues,
    };
  }

  if (sliceResult.contract !== 'side-horizontal-raster-slice-v0' || !Array.isArray(sliceResult.runs)) {
    issues.push(`Invalid sliceResult contract: '${sliceResult.contract}'. Expected 'side-horizontal-raster-slice-v0'.`);
    return {
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
      view: 'side',
      id,
      name,
      type: 'profile_span',
      status: SIDE_PROFILE_SPAN_STATUS.INVALID,
      valueCm: null,
      minUcm: null,
      maxUcm: null,
      provenance: {
        sourceLevel,
        levelYcm: level?.yCm ?? sliceResult.requestedYcm ?? null,
        sampledPixelRow: sliceResult.sampledRow ?? null,
        sourceSliceContract: sliceResult.contract ?? null,
        targetPolicy: effectiveTargetPolicy,
        targetClassIds: sliceResult.targetClassIds ?? [],
        runSelectionPolicy: effectiveRunPolicy,
        selectedRunIndex: null,
        minUcm: null,
        maxUcm: null,
      },
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
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
      view: 'side',
      id,
      name,
      type: 'profile_span',
      status: SIDE_PROFILE_SPAN_STATUS.UNAVAILABLE,
      valueCm: null,
      minUcm: null,
      maxUcm: null,
      provenance: {
        sourceLevel,
        levelYcm: level?.yCm ?? sliceResult.requestedYcm ?? null,
        sampledPixelRow: sliceResult.sampledRow ?? null,
        sourceSliceContract: sliceResult.contract,
        targetPolicy: effectiveTargetPolicy,
        targetClassIds: sliceResult.targetClassIds ?? [],
        runSelectionPolicy: effectiveRunPolicy,
        selectedRunIndex: null,
        minUcm: null,
        maxUcm: null,
      },
      issues,
    };
  }

  if (runs.length > 1) {
    issues.push(`Multiple separated runs (${runs.length}) found on row under '${effectiveRunPolicy}' policy. Profile span is ambiguous.`);
    return {
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
      view: 'side',
      id,
      name,
      type: 'profile_span',
      status: SIDE_PROFILE_SPAN_STATUS.AMBIGUOUS,
      valueCm: null,
      minUcm: null,
      maxUcm: null,
      provenance: {
        sourceLevel,
        levelYcm: level?.yCm ?? sliceResult.requestedYcm ?? null,
        sampledPixelRow: sliceResult.sampledRow ?? null,
        sourceSliceContract: sliceResult.contract,
        targetPolicy: effectiveTargetPolicy,
        targetClassIds: sliceResult.targetClassIds ?? [],
        runSelectionPolicy: effectiveRunPolicy,
        selectedRunIndex: null,
        minUcm: null,
        maxUcm: null,
      },
      issues,
    };
  }

  // Exactly 1 run
  const selectedRun = runs[0];
  const minUcm = selectedRun.boundsCm?.minU;
  const maxUcm = selectedRun.boundsCm?.maxU;

  if (
    typeof minUcm !== 'number'
    || !Number.isFinite(minUcm)
    || typeof maxUcm !== 'number'
    || !Number.isFinite(maxUcm)
    || maxUcm <= minUcm
  ) {
    issues.push(`Invalid run metric bounds: minU (${minUcm}), maxU (${maxUcm}).`);
    return {
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
      view: 'side',
      id,
      name,
      type: 'profile_span',
      status: SIDE_PROFILE_SPAN_STATUS.INVALID,
      valueCm: null,
      minUcm: typeof minUcm === 'number' ? minUcm : null,
      maxUcm: typeof maxUcm === 'number' ? maxUcm : null,
      provenance: {
        sourceLevel,
        levelYcm: level?.yCm ?? sliceResult.requestedYcm ?? null,
        sampledPixelRow: sliceResult.sampledRow ?? null,
        sourceSliceContract: sliceResult.contract,
        targetPolicy: effectiveTargetPolicy,
        targetClassIds: sliceResult.targetClassIds ?? [],
        runSelectionPolicy: effectiveRunPolicy,
        selectedRunIndex: 0,
        minUcm: typeof minUcm === 'number' ? minUcm : null,
        maxUcm: typeof maxUcm === 'number' ? maxUcm : null,
      },
      issues,
    };
  }

  const valueCm = maxUcm - minUcm;

  return {
    contract: SIDE_PROFILE_SPAN_CONTRACT,
    version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
    view: 'side',
    id,
    name,
    type: 'profile_span',
    status: SIDE_PROFILE_SPAN_STATUS.VALID,
    valueCm,
    minUcm,
    maxUcm,
    provenance: {
      sourceLevel,
      levelYcm: level?.yCm ?? sliceResult.requestedYcm ?? null,
      sampledPixelRow: sliceResult.sampledRow ?? null,
      sourceSliceContract: sliceResult.contract,
      targetPolicy: effectiveTargetPolicy,
      targetClassIds: sliceResult.targetClassIds ?? [],
      runSelectionPolicy: effectiveRunPolicy,
      selectedRunIndex: 0,
      minUcm,
      maxUcm,
    },
    issues,
  };
}

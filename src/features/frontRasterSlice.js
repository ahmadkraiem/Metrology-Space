/**
 * Front Horizontal Raster Slice Contract v0
 *
 * Pure deterministic domain contract that samples the Front segmentation raster
 * at a canonical vertical Y level (cm) and returns contiguous horizontal class runs
 * in strictly left-to-right order.
 *
 * Contract: 'front-horizontal-raster-slice-v0'
 * View: 'front'
 * Performance: O(W) single-row streaming scan without buffer re-decoding or copying.
 *
 * STRICT GUARDRAILS:
 * - Evidence only, NOT final body measurements (no width, depth, circumference, or contour clipping).
 * - Does not implicitly merge separated runs (e.g. arm | gap | torso | gap | arm).
 * - Does not select largest or central run by default.
 * - Does not infer apparel-to-body surface transitions.
 * - Front only: does not consume Side evidence, Pointmap, or Normals.
 */

import {
  DEFAULT_WORKSPACE_EXTENT_CM,
  canonicalYToPixelRow,
  pixelColumnSpanToFrontMetrology,
} from '../core/pixelMetrologyMapping.js';
import {
  BODY_ANATOMICAL_CLASS_IDS,
  CANONICAL_SEGMENTATION_CLASSES_V0,
} from './anatomicalRegions.js';

export const FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT = 'front-horizontal-raster-slice-v0';
export const FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION = 'front-horizontal-raster-slice-v0';

/**
 * Standard named target-class policy selectors derived authoritatively from anatomicalRegions.js.
 * @readonly
 */
export const FRONT_RASTER_SLICE_POLICIES = Object.freeze({
  /** Torso class 22 only */
  TORSO_ONLY: Object.freeze([22]),

  /** All 13 canonical metrology-eligible body_anatomical classes */
  BODY_ANATOMICAL: Object.freeze([...BODY_ANATOMICAL_CLASS_IDS]),

  /** All non-background classes (1..28) */
  FOREGROUND: Object.freeze(
    CANONICAL_SEGMENTATION_CLASSES_V0
      .filter((c) => c.classId !== 0)
      .map((c) => c.classId),
  ),
});

/**
 * @typedef {{
 *   startCol: number,
 *   endCol: number,
 *   pixelCount: number,
 *   boundsNormalized: {
 *     minU: number,
 *     maxU: number,
 *   },
 *   boundsCm: {
 *     minX: number,
 *     maxX: number,
 *   },
 * }} FrontRasterSliceRunV0
 */

/**
 * @typedef {{
 *   contract: 'front-horizontal-raster-slice-v0',
 *   version: 'front-horizontal-raster-slice-v0',
 *   view: 'front',
 *   requestedYcm: number|null,
 *   sampledRow: number|null,
 *   rowNormalizedV: number|null,
 *   targetClassIds: number[],
 *   runs: FrontRasterSliceRunV0[],
 *   summary: {
 *     runCount: number,
 *     totalMatchedPixels: number,
 *   },
 *   issues: string[],
 * }} FrontHorizontalRasterSliceResultV0
 */

/**
 * Pure deterministic single-row horizontal raster scan.
 *
 * @param {ArrayLike<number>|null|undefined} raster - Decoded 1D segmentation raster of class IDs (H*W)
 * @param {{
 *   widthPx?: number|null,
 *   heightPx?: number|null,
 *   yCm?: number|null,
 *   targetClassIds?: Iterable<number>|null,
 *   workspaceExtentCm?: number,
 * }} [options]
 * @returns {FrontHorizontalRasterSliceResultV0}
 */
export function sampleFrontHorizontalRasterSlice(raster, {
  widthPx = null,
  heightPx = null,
  yCm = null,
  targetClassIds = null,
  workspaceExtentCm = DEFAULT_WORKSPACE_EXTENT_CM,
} = {}) {
  const issues = [];

  // 1. Dimension Validation
  const validWidth = typeof widthPx === 'number' && Number.isFinite(widthPx) && Number.isInteger(widthPx) && widthPx > 0;
  const validHeight = typeof heightPx === 'number' && Number.isFinite(heightPx) && Number.isInteger(heightPx) && heightPx > 0;

  if (!validWidth || !validHeight) {
    issues.push(`Invalid raster dimensions: widthPx (${widthPx}) and heightPx (${heightPx}) must be positive finite integers.`);
    return {
      contract: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'front',
      requestedYcm: (typeof yCm === 'number' && Number.isFinite(yCm)) ? yCm : null,
      sampledRow: null,
      rowNormalizedV: null,
      targetClassIds: [],
      runs: [],
      summary: { runCount: 0, totalMatchedPixels: 0 },
      issues,
    };
  }

  // 2. Raster Buffer Validation
  const expectedMinLength = widthPx * heightPx;
  if (!raster || typeof raster.length !== 'number' || raster.length < expectedMinLength) {
    issues.push(`Invalid or missing raster buffer: expected length >= ${expectedMinLength}, received ${raster?.length ?? 'null'}.`);
    return {
      contract: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'front',
      requestedYcm: (typeof yCm === 'number' && Number.isFinite(yCm)) ? yCm : null,
      sampledRow: null,
      rowNormalizedV: null,
      targetClassIds: [],
      runs: [],
      summary: { runCount: 0, totalMatchedPixels: 0 },
      issues,
    };
  }

  // 3. Y cm Coordinate Validation & Row Mapping
  const rowMapping = canonicalYToPixelRow(yCm, heightPx, workspaceExtentCm);
  if (!rowMapping) {
    issues.push(`Requested yCm (${yCm}) is outside valid metrology domain [0, ${workspaceExtentCm}].`);
    return {
      contract: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'front',
      requestedYcm: (typeof yCm === 'number' && Number.isFinite(yCm)) ? yCm : null,
      sampledRow: null,
      rowNormalizedV: null,
      targetClassIds: [],
      runs: [],
      summary: { runCount: 0, totalMatchedPixels: 0 },
      issues,
    };
  }

  const { row: sampledRow, normalizedV: rowNormalizedV } = rowMapping;

  // 4. Target Class Set Validation
  const targetClassList = Array.isArray(targetClassIds)
    ? targetClassIds
    : (targetClassIds instanceof Set ? Array.from(targetClassIds) : (targetClassIds ? Array.from(targetClassIds) : []));

  const validTargetClassIds = targetClassList.filter((c) => typeof c === 'number' && Number.isFinite(c) && Number.isInteger(c));

  if (validTargetClassIds.length === 0) {
    issues.push('No valid targetClassIds provided for raster slice.');
    return {
      contract: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'front',
      requestedYcm: yCm,
      sampledRow,
      rowNormalizedV,
      targetClassIds: [],
      runs: [],
      summary: { runCount: 0, totalMatchedPixels: 0 },
      issues,
    };
  }

  const targetClassSet = new Set(validTargetClassIds);

  // 5. O(W) Streaming Single-Row Scan
  const runs = [];
  let inRun = false;
  let startCol = 0;
  let totalMatchedPixels = 0;
  let encounteredClasses = new Set();
  const rowOffset = sampledRow * widthPx;

  for (let c = 0; c < widthPx; c += 1) {
    const classId = raster[rowOffset + c];
    if (targetClassSet.has(classId)) {
      if (!inRun) {
        startCol = c;
        inRun = true;
        encounteredClasses = new Set([classId]);
      } else {
        encounteredClasses.add(classId);
      }
    } else if (inRun) {
      const endCol = c - 1;
      const pixelCount = endCol - startCol + 1;
      totalMatchedPixels += pixelCount;
      const spanMapping = pixelColumnSpanToFrontMetrology(startCol, endCol, widthPx, workspaceExtentCm);
      runs.push({
        startCol,
        endCol,
        pixelCount,
        boundsNormalized: spanMapping.boundsNormalized,
        boundsCm: spanMapping.boundsCm,
        encounteredClassIds: Array.from(encounteredClasses).sort((a, b) => a - b),
      });
      inRun = false;
    }
  }

  if (inRun) {
    const endCol = widthPx - 1;
    const pixelCount = endCol - startCol + 1;
    totalMatchedPixels += pixelCount;
    const spanMapping = pixelColumnSpanToFrontMetrology(startCol, endCol, widthPx, workspaceExtentCm);
    runs.push({
      startCol,
      endCol,
      pixelCount,
      boundsNormalized: spanMapping.boundsNormalized,
      boundsCm: spanMapping.boundsCm,
      encounteredClassIds: Array.from(encounteredClasses).sort((a, b) => a - b),
    });
  }

  return {
    contract: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT,
    version: FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
    view: 'front',
    requestedYcm: yCm,
    sampledRow,
    rowNormalizedV,
    targetClassIds: validTargetClassIds,
    runs,
    summary: {
      runCount: runs.length,
      totalMatchedPixels,
    },
    issues,
  };
}

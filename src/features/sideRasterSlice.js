/**
 * Side Horizontal Raster Slice Contract v0
 *
 * Pure deterministic domain contract that samples the Side segmentation raster
 * at a canonical vertical Y level (cm) and returns contiguous horizontal class runs
 * in strictly left-to-right order.
 *
 * Contract: 'side-horizontal-raster-slice-v0'
 * View: 'side'
 * Performance: O(W) single-row streaming scan without buffer re-decoding or copying.
 *
 * STRICT GUARDRAILS:
 * - Evidence only, NOT final body measurements (no width, depth, circumference, or contour clipping).
 * - Side coordinates are strictly U / Y in metrology space (200 cm domain).
 * - Side U is profile coordinate only, NOT canonical Z.
 * - Never calls U a validated physical depth; no U -> Z conversion.
 * - Does not implicitly merge separated runs.
 * - Does not select largest or central run by default.
 * - Does not infer apparel-to-body surface transitions.
 * - Side only: does not consume Front evidence, Pointmap, or Normals.
 */

import {
  DEFAULT_WORKSPACE_EXTENT_CM,
  canonicalYToPixelRow,
  pixelColumnSpanToSideMetrology,
} from '../core/pixelMetrologyMapping.js';
import {
  BODY_ANATOMICAL_CLASS_IDS,
  CANONICAL_SEGMENTATION_CLASSES_V0,
} from './anatomicalRegions.js';

export const SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT = 'side-horizontal-raster-slice-v0';
export const SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION = 'side-horizontal-raster-slice-v0';

/**
 * Standard named target-class policy selectors derived authoritatively from anatomicalRegions.js.
 * @readonly
 */
export const SIDE_RASTER_SLICE_POLICIES = Object.freeze({
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
 *     minU: number,
 *     maxU: number,
 *   },
 * }} SideRasterSliceRunV0
 */

/**
 * @typedef {{
 *   contract: 'side-horizontal-raster-slice-v0',
 *   version: 'side-horizontal-raster-slice-v0',
 *   view: 'side',
 *   requestedYcm: number|null,
 *   sampledRow: number|null,
 *   rowNormalizedV: number|null,
 *   targetClassIds: number[],
 *   runs: SideRasterSliceRunV0[],
 *   summary: {
 *     runCount: number,
 *     totalMatchedPixels: number,
 *   },
 *   issues: string[],
 * }} SideHorizontalRasterSliceResultV0
 */

/**
 * Pure deterministic single-row horizontal raster scan for Side segmentation.
 *
 * @param {ArrayLike<number>|null|undefined} raster - Decoded 1D segmentation raster of class IDs (H*W)
 * @param {{
 *   widthPx?: number|null,
 *   heightPx?: number|null,
 *   yCm?: number|null,
 *   targetClassIds?: Iterable<number>|null,
 *   workspaceExtentCm?: number,
 * }} [options]
 * @returns {SideHorizontalRasterSliceResultV0}
 */
export function sampleSideHorizontalRasterSlice(raster, {
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
      contract: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'side',
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
      contract: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'side',
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
      contract: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'side',
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
      contract: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT,
      version: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
      view: 'side',
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
      const spanMapping = pixelColumnSpanToSideMetrology(startCol, endCol, widthPx, workspaceExtentCm);
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
    const spanMapping = pixelColumnSpanToSideMetrology(startCol, endCol, widthPx, workspaceExtentCm);
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
    contract: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT,
    version: SIDE_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
    view: 'side',
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

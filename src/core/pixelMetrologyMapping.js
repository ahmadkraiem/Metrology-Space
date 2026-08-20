/**
 * Pixel-to-Metrology Mapping Core Contract (v0)
 *
 * Pure, resolution-independent mapping contract between segmentation/image
 * raster coordinates and metrology-space coordinates.
 *
 * Grounded in:
 * - Front Metrology Space: X (width) / Y (height) in cm, bottom-left origin (0, 0).
 * - Side Metrology Space: U (profile depth evidence) / Y (height) in cm, bottom-left origin (0, 0).
 * - Image Space: Continuous [0, W] x [0, H] and discrete pixel grid [0..W-1] x [0..H-1], top-left origin (0, 0).
 * - Workspace Extent: Fixed 200 cm domain (ROOM_SIZE = 200).
 *
 * Preserves strict geometry guardrails:
 * - Front = X/Y, Side = U/Y.
 * - Side U remains 2D profile evidence only.
 * - No U->Z conversion, no depth inference, no Front/Side geometry fusion.
 */

import { ROOM_SIZE } from './constants.js';

export const PIXEL_METROLOGY_CONTRACT_VERSION = 'pixel-metrology-v0';
export const PIXEL_METROLOGY_CONTRACT_NAME = 'pixel-metrology-v0';
export const DEFAULT_WORKSPACE_EXTENT_CM = ROOM_SIZE;

/**
 * Validates raster dimensions.
 * @param {number} widthPx
 * @param {number} heightPx
 */
function validateRasterDimensions(widthPx, heightPx) {
  if (
    typeof widthPx !== 'number'
    || !Number.isFinite(widthPx)
    || typeof heightPx !== 'number'
    || !Number.isFinite(heightPx)
    || widthPx <= 0
    || heightPx <= 0
  ) {
    throw new RangeError(
      `Invalid raster dimensions: widthPx (${widthPx}) and heightPx (${heightPx}) must be positive finite numbers.`,
    );
  }
  if (!Number.isInteger(widthPx) || !Number.isInteger(heightPx)) {
    throw new TypeError(
      `Invalid raster dimensions: widthPx (${widthPx}) and heightPx (${heightPx}) must be integers.`,
    );
  }
}

/**
 * Validates workspace extent in cm.
 * @param {number} workspaceExtentCm
 */
function validateWorkspaceExtent(workspaceExtentCm) {
  if (
    typeof workspaceExtentCm !== 'number'
    || !Number.isFinite(workspaceExtentCm)
    || workspaceExtentCm <= 0
  ) {
    throw new RangeError(
      `Invalid workspace extent: workspaceExtentCm (${workspaceExtentCm}) must be a positive finite number.`,
    );
  }
}

/**
 * Validates discrete pixel index (col, row).
 * @param {number} col
 * @param {number} row
 * @param {number} widthPx
 * @param {number} heightPx
 */
function validatePixelIndex(col, row, widthPx, heightPx) {
  if (
    typeof col !== 'number'
    || !Number.isFinite(col)
    || typeof row !== 'number'
    || !Number.isFinite(row)
    || !Number.isInteger(col)
    || !Number.isInteger(row)
  ) {
    throw new TypeError(
      `Invalid pixel index: col (${col}) and row (${row}) must be finite integers.`,
    );
  }
  if (col < 0 || col >= widthPx || row < 0 || row >= heightPx) {
    throw new RangeError(
      `Pixel index out of bounds: col (${col}) must be in [0, ${widthPx - 1}] and row (${row}) must be in [0, ${heightPx - 1}].`,
    );
  }
}

/**
 * Validates continuous image coordinates (x, y) within [0, widthPx] x [0, heightPx].
 * @param {number} x
 * @param {number} y
 * @param {number} widthPx
 * @param {number} heightPx
 */
function validateContinuousPoint(x, y, widthPx, heightPx) {
  if (
    typeof x !== 'number'
    || !Number.isFinite(x)
    || typeof y !== 'number'
    || !Number.isFinite(y)
  ) {
    throw new TypeError(
      `Invalid continuous image coordinates: x (${x}) and y (${y}) must be finite numbers.`,
    );
  }
  if (x < 0 || x > widthPx || y < 0 || y > heightPx) {
    throw new RangeError(
      `Continuous image coordinate out of bounds: x (${x}) must be in [0, ${widthPx}] and y (${y}) must be in [0, ${heightPx}].`,
    );
  }
}

/**
 * Validates metrology coordinates within [0, workspaceExtentCm] x [0, workspaceExtentCm].
 * @param {number} h Horizontal coordinate (X or U)
 * @param {number} v Vertical coordinate (Y)
 * @param {number} workspaceExtentCm
 */
function validateMetrologyCoordinates(h, v, workspaceExtentCm) {
  if (
    typeof h !== 'number'
    || !Number.isFinite(h)
    || typeof v !== 'number'
    || !Number.isFinite(v)
  ) {
    throw new TypeError(
      `Invalid metrology coordinates: horizontal (${h}) and vertical (${v}) must be finite numbers.`,
    );
  }
  if (h < 0 || h > workspaceExtentCm || v < 0 || v > workspaceExtentCm) {
    throw new RangeError(
      `Metrology coordinate out of bounds: horizontal (${h}) and vertical (${v}) must be in [0, ${workspaceExtentCm}].`,
    );
  }
}

/**
 * Validates inclusive bounding box pixel indices.
 * @param {unknown} boundsPx
 * @param {number} widthPx
 * @param {number} heightPx
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function validateBoundsPx(boundsPx, widthPx, heightPx) {
  if (!boundsPx || typeof boundsPx !== 'object') {
    throw new TypeError('Invalid boundsPx: must be an object containing minX, minY, maxX, maxY.');
  }

  const { minX, minY, maxX, maxY } = boundsPx;

  if (
    typeof minX !== 'number' || !Number.isFinite(minX) || !Number.isInteger(minX)
    || typeof minY !== 'number' || !Number.isFinite(minY) || !Number.isInteger(minY)
    || typeof maxX !== 'number' || !Number.isFinite(maxX) || !Number.isInteger(maxX)
    || typeof maxY !== 'number' || !Number.isFinite(maxY) || !Number.isInteger(maxY)
  ) {
    throw new TypeError(
      `Invalid boundsPx: minX (${minX}), minY (${minY}), maxX (${maxX}), maxY (${maxY}) must be finite integers.`,
    );
  }

  if (minX < 0 || maxX >= widthPx || minX > maxX) {
    throw new RangeError(
      `Invalid horizontal boundsPx: require 0 <= minX (${minX}) <= maxX (${maxX}) < widthPx (${widthPx}).`,
    );
  }

  if (minY < 0 || maxY >= heightPx || minY > maxY) {
    throw new RangeError(
      `Invalid vertical boundsPx: require 0 <= minY (${minY}) <= maxY (${maxY}) < heightPx (${heightPx}).`,
    );
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Unwraps point arguments supporting both (x, y, W, H, L) and ({ x, y }, W, H, L).
 */
function unwrapPointArgs(arg1, arg2, arg3, arg4, arg5) {
  if (arg1 && typeof arg1 === 'object') {
    const x = arg1.x ?? arg1.u ?? arg1.h ?? arg1.col;
    const y = arg1.y ?? arg1.v ?? arg1.row;
    return {
      x,
      y,
      widthPx: arg2,
      heightPx: arg3,
      workspaceExtentCm: arg4 ?? DEFAULT_WORKSPACE_EXTENT_CM,
    };
  }
  return {
    x: arg1,
    y: arg2,
    widthPx: arg3,
    heightPx: arg4,
    workspaceExtentCm: arg5 ?? DEFAULT_WORKSPACE_EXTENT_CM,
  };
}

/**
 * Unwraps pixel center arguments supporting both (col, row, W, H, L) and ({ col, row }, W, H, L).
 */
function unwrapPixelArgs(arg1, arg2, arg3, arg4, arg5) {
  if (arg1 && typeof arg1 === 'object') {
    const col = arg1.col ?? arg1.x;
    const row = arg1.row ?? arg1.y;
    return {
      col,
      row,
      widthPx: arg2,
      heightPx: arg3,
      workspaceExtentCm: arg4 ?? DEFAULT_WORKSPACE_EXTENT_CM,
    };
  }
  return {
    col: arg1,
    row: arg2,
    widthPx: arg3,
    heightPx: arg4,
    workspaceExtentCm: arg5 ?? DEFAULT_WORKSPACE_EXTENT_CM,
  };
}

/**
 * Unwraps metrology coordinates supporting both (h, v, W, H, L) and ({ x|u, y }, W, H, L).
 */
function unwrapMetrologyArgs(arg1, arg2, arg3, arg4, arg5) {
  if (arg1 && typeof arg1 === 'object') {
    const h = arg1.x ?? arg1.u ?? arg1.h;
    const v = arg1.y ?? arg1.v;
    return {
      h,
      v,
      widthPx: arg2,
      heightPx: arg3,
      workspaceExtentCm: arg4 ?? DEFAULT_WORKSPACE_EXTENT_CM,
    };
  }
  return {
    h: arg1,
    v: arg2,
    widthPx: arg3,
    heightPx: arg4,
    workspaceExtentCm: arg5 ?? DEFAULT_WORKSPACE_EXTENT_CM,
  };
}

/**
 * Maps a continuous image point/edge (x, y) into Front Metrology coordinates (X, Y in cm).
 *
 * Formula:
 *   X = (x / widthPx) * workspaceExtentCm
 *   Y = ((heightPx - y) / heightPx) * workspaceExtentCm
 *
 * @param {number|{ x: number, y: number }} xOrPoint
 * @param {number} [yOrWidth]
 * @param {number} [widthPx]
 * @param {number} [heightPx]
 * @param {number} [workspaceExtentCm]
 * @returns {{ x: number, y: number }}
 */
export function imagePointToFrontMetrology(xOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm) {
  const args = unwrapPointArgs(xOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm);
  validateRasterDimensions(args.widthPx, args.heightPx);
  validateWorkspaceExtent(args.workspaceExtentCm);
  validateContinuousPoint(args.x, args.y, args.widthPx, args.heightPx);

  const x = (args.x * args.workspaceExtentCm) / args.widthPx;
  const y = ((args.heightPx - args.y) * args.workspaceExtentCm) / args.heightPx;

  return { x, y };
}

/**
 * Maps a continuous image point/edge (x, y) into Side Metrology coordinates (U, Y in cm).
 *
 * Formula:
 *   U = (x / widthPx) * workspaceExtentCm
 *   Y = ((heightPx - y) / heightPx) * workspaceExtentCm
 *
 * @param {number|{ x: number, y: number }} xOrPoint
 * @param {number} [yOrWidth]
 * @param {number} [widthPx]
 * @param {number} [heightPx]
 * @param {number} [workspaceExtentCm]
 * @returns {{ u: number, y: number }}
 */
export function imagePointToSideMetrology(xOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm) {
  const args = unwrapPointArgs(xOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm);
  validateRasterDimensions(args.widthPx, args.heightPx);
  validateWorkspaceExtent(args.workspaceExtentCm);
  validateContinuousPoint(args.x, args.y, args.widthPx, args.heightPx);

  const u = (args.x * args.workspaceExtentCm) / args.widthPx;
  const y = ((args.heightPx - args.y) * args.workspaceExtentCm) / args.heightPx;

  return { u, y };
}

/**
 * Maps a discrete pixel index center (col, row) into Front Metrology coordinates (X, Y in cm).
 *
 * Formula:
 *   X = ((col + 0.5) / widthPx) * workspaceExtentCm
 *   Y = ((heightPx - (row + 0.5)) / heightPx) * workspaceExtentCm
 *
 * @param {number|{ col: number, row: number }} colOrPixel
 * @param {number} [rowOrWidth]
 * @param {number} [widthPx]
 * @param {number} [heightPx]
 * @param {number} [workspaceExtentCm]
 * @returns {{ x: number, y: number }}
 */
export function pixelCenterToFrontMetrology(colOrPixel, rowOrWidth, widthPx, heightPx, workspaceExtentCm) {
  const args = unwrapPixelArgs(colOrPixel, rowOrWidth, widthPx, heightPx, workspaceExtentCm);
  validateRasterDimensions(args.widthPx, args.heightPx);
  validateWorkspaceExtent(args.workspaceExtentCm);
  validatePixelIndex(args.col, args.row, args.widthPx, args.heightPx);

  const continuousX = args.col + 0.5;
  const continuousY = args.row + 0.5;

  const x = (continuousX * args.workspaceExtentCm) / args.widthPx;
  const y = ((args.heightPx - continuousY) * args.workspaceExtentCm) / args.heightPx;

  return { x, y };
}

/**
 * Maps a discrete pixel index center (col, row) into Side Metrology coordinates (U, Y in cm).
 *
 * Formula:
 *   U = ((col + 0.5) / widthPx) * workspaceExtentCm
 *   Y = ((heightPx - (row + 0.5)) / heightPx) * workspaceExtentCm
 *
 * @param {number|{ col: number, row: number }} colOrPixel
 * @param {number} [rowOrWidth]
 * @param {number} [widthPx]
 * @param {number} [heightPx]
 * @param {number} [workspaceExtentCm]
 * @returns {{ u: number, y: number }}
 */
export function pixelCenterToSideMetrology(colOrPixel, rowOrWidth, widthPx, heightPx, workspaceExtentCm) {
  const args = unwrapPixelArgs(colOrPixel, rowOrWidth, widthPx, heightPx, workspaceExtentCm);
  validateRasterDimensions(args.widthPx, args.heightPx);
  validateWorkspaceExtent(args.workspaceExtentCm);
  validatePixelIndex(args.col, args.row, args.widthPx, args.heightPx);

  const continuousX = args.col + 0.5;
  const continuousY = args.row + 0.5;

  const u = (continuousX * args.workspaceExtentCm) / args.widthPx;
  const y = ((args.heightPx - continuousY) * args.workspaceExtentCm) / args.heightPx;

  return { u, y };
}

/**
 * Maps inclusive pixel bounding box { minX, minY, maxX, maxY } into Front outer metric bounds (cm).
 *
 * Outer pixel edges:
 *   minX_cm = (minX / widthPx) * workspaceExtentCm
 *   maxX_cm = ((maxX + 1) / widthPx) * workspaceExtentCm
 *   minY_cm = ((heightPx - (maxY + 1)) / heightPx) * workspaceExtentCm
 *   maxY_cm = ((heightPx - minY) / heightPx) * workspaceExtentCm
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} boundsPx
 * @param {number} widthPx
 * @param {number} heightPx
 * @param {number} [workspaceExtentCm]
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
export function boundsPxToFrontMetrology(
  boundsPx,
  widthPx,
  heightPx,
  workspaceExtentCm = DEFAULT_WORKSPACE_EXTENT_CM,
) {
  validateRasterDimensions(widthPx, heightPx);
  validateWorkspaceExtent(workspaceExtentCm);
  const validBounds = validateBoundsPx(boundsPx, widthPx, heightPx);

  const minX = (validBounds.minX * workspaceExtentCm) / widthPx;
  const maxX = ((validBounds.maxX + 1) * workspaceExtentCm) / widthPx;
  const minY = ((heightPx - (validBounds.maxY + 1)) * workspaceExtentCm) / heightPx;
  const maxY = ((heightPx - validBounds.minY) * workspaceExtentCm) / heightPx;

  return { minX, maxX, minY, maxY };
}

/**
 * Maps inclusive pixel bounding box { minX, minY, maxX, maxY } into Side outer metric bounds (cm).
 *
 * Outer pixel edges:
 *   minU_cm = (minX / widthPx) * workspaceExtentCm
 *   maxU_cm = ((maxX + 1) / widthPx) * workspaceExtentCm
 *   minY_cm = ((heightPx - (maxY + 1)) / heightPx) * workspaceExtentCm
 *   maxY_cm = ((heightPx - minY) / heightPx) * workspaceExtentCm
 *
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} boundsPx
 * @param {number} widthPx
 * @param {number} heightPx
 * @param {number} [workspaceExtentCm]
 * @returns {{ minU: number, maxU: number, minY: number, maxY: number }}
 */
export function boundsPxToSideMetrology(
  boundsPx,
  widthPx,
  heightPx,
  workspaceExtentCm = DEFAULT_WORKSPACE_EXTENT_CM,
) {
  validateRasterDimensions(widthPx, heightPx);
  validateWorkspaceExtent(workspaceExtentCm);
  const validBounds = validateBoundsPx(boundsPx, widthPx, heightPx);

  const minU = (validBounds.minX * workspaceExtentCm) / widthPx;
  const maxU = ((validBounds.maxX + 1) * workspaceExtentCm) / widthPx;
  const minY = ((heightPx - (validBounds.maxY + 1)) * workspaceExtentCm) / heightPx;
  const maxY = ((heightPx - validBounds.minY) * workspaceExtentCm) / heightPx;

  return { minU, maxU, minY, maxY };
}

/**
 * Converts Front Metrology coordinates (X, Y in cm) back to continuous image coordinates (x, y in px).
 *
 * Inverse formula:
 *   x = (X / workspaceExtentCm) * widthPx
 *   y = ((workspaceExtentCm - Y) / workspaceExtentCm) * heightPx
 *
 * @param {number|{ x: number, y: number }} xOrPoint
 * @param {number} [yOrWidth]
 * @param {number} [widthPx]
 * @param {number} [heightPx]
 * @param {number} [workspaceExtentCm]
 * @returns {{ x: number, y: number }}
 */
export function frontMetrologyToImagePoint(xOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm) {
  const args = unwrapMetrologyArgs(xOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm);
  validateRasterDimensions(args.widthPx, args.heightPx);
  validateWorkspaceExtent(args.workspaceExtentCm);
  validateMetrologyCoordinates(args.h, args.v, args.workspaceExtentCm);

  const x = (args.h * args.widthPx) / args.workspaceExtentCm;
  const y = ((args.workspaceExtentCm - args.v) * args.heightPx) / args.workspaceExtentCm;

  return { x, y };
}

/**
 * Converts Side Metrology coordinates (U, Y in cm) back to continuous image coordinates (x, y in px).
 *
 * Inverse formula:
 *   x = (U / workspaceExtentCm) * widthPx
 *   y = ((workspaceExtentCm - Y) / workspaceExtentCm) * heightPx
 *
 * @param {number|{ u: number, y: number }} uOrPoint
 * @param {number} [yOrWidth]
 * @param {number} [widthPx]
 * @param {number} [heightPx]
 * @param {number} [workspaceExtentCm]
 * @returns {{ x: number, y: number }}
 */
export function sideMetrologyToImagePoint(uOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm) {
  const args = unwrapMetrologyArgs(uOrPoint, yOrWidth, widthPx, heightPx, workspaceExtentCm);
  validateRasterDimensions(args.widthPx, args.heightPx);
  validateWorkspaceExtent(args.workspaceExtentCm);
  validateMetrologyCoordinates(args.h, args.v, args.workspaceExtentCm);

  const x = (args.h * args.widthPx) / args.workspaceExtentCm;
  const y = ((args.workspaceExtentCm - args.v) * args.heightPx) / args.workspaceExtentCm;

  return { x, y };
}

/**
 * Maps a canonical vertical coordinate (Y in cm) into a discrete image raster row index and normalized V.
 *
 * Mapping semantics:
 * - Canonical Y increases upward in [0, workspaceExtentCm].
 * - Image pixel row increases downward in [0, heightPx - 1].
 * - Valid boundary Y=0 maps to row heightPx - 1.
 * - Valid boundary Y=workspaceExtentCm maps to row 0.
 * - Values outside [0, workspaceExtentCm] return null.
 *
 * @param {number} yCm
 * @param {number} heightPx
 * @param {number} [workspaceExtentCm]
 * @returns {{ row: number, normalizedV: number }|null}
 */
export function canonicalYToPixelRow(yCm, heightPx, workspaceExtentCm = DEFAULT_WORKSPACE_EXTENT_CM) {
  if (
    typeof yCm !== 'number'
    || !Number.isFinite(yCm)
    || yCm < 0
    || yCm > workspaceExtentCm
    || typeof heightPx !== 'number'
    || !Number.isFinite(heightPx)
    || heightPx <= 0
    || !Number.isInteger(heightPx)
  ) {
    return null;
  }

  const normalizedV = (workspaceExtentCm - yCm) / workspaceExtentCm;
  const continuousY = normalizedV * heightPx;

  let row = Math.floor(continuousY);
  if (row >= heightPx) {
    row = heightPx - 1;
  }
  if (row < 0) {
    row = 0;
  }

  return { row, normalizedV };
}

/**
 * Maps a discrete horizontal pixel column span [startCol, endCol] (inclusive) into Front Metrology coordinates.
 *
 * Outer pixel edges:
 *   minU = startCol / widthPx
 *   maxU = (endCol + 1) / widthPx
 *   minX_cm = (startCol / widthPx) * workspaceExtentCm
 *   maxX_cm = ((endCol + 1) / widthPx) * workspaceExtentCm
 *
 * @param {number} startCol
 * @param {number} endCol
 * @param {number} widthPx
 * @param {number} [workspaceExtentCm]
 * @returns {{
 *   boundsNormalized: { minU: number, maxU: number },
 *   boundsCm: { minX: number, maxX: number },
 * }|null}
 */
export function pixelColumnSpanToFrontMetrology(
  startCol,
  endCol,
  widthPx,
  workspaceExtentCm = DEFAULT_WORKSPACE_EXTENT_CM,
) {
  if (
    typeof startCol !== 'number'
    || !Number.isFinite(startCol)
    || !Number.isInteger(startCol)
    || typeof endCol !== 'number'
    || !Number.isFinite(endCol)
    || !Number.isInteger(endCol)
    || typeof widthPx !== 'number'
    || !Number.isFinite(widthPx)
    || widthPx <= 0
    || !Number.isInteger(widthPx)
    || startCol < 0
    || endCol >= widthPx
    || startCol > endCol
  ) {
    return null;
  }

  const minU = startCol / widthPx;
  const maxU = (endCol + 1) / widthPx;
  const minX = (startCol * workspaceExtentCm) / widthPx;
  const maxX = ((endCol + 1) * workspaceExtentCm) / widthPx;

  return {
    boundsNormalized: { minU, maxU },
    boundsCm: { minX, maxX },
  };
}

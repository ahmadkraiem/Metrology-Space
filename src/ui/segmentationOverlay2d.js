/**
 * Segmentation Region Preview 2D Overlay (v0)
 *
 * Renders dense semantic segmentation rasters as read-only, translucent overlays
 * on the Front (X/Y) and Side (U/Y) 2D navigators. Uses the retained runtime
 * Uint8Array directly with zero per-frame redraw cost during panning/zooming.
 */

import {
  getBodyEvidenceQa,
  getFrontSegmentationRaster,
  getSideSegmentationRaster,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  isFrontSegmentationSettingEnabled,
  isSideSegmentationSettingEnabled,
  subscribeViewSettingChange,
} from './viewControls.js';

const SEGMENTATION_ALPHA = 95; // ~37% opacity (95 / 255) for translucent visibility

/**
 * Curated, high-contrast, harmonious palette for semantic classes.
 * Background (class 0) is always fully transparent.
 */
const BASE_PALETTE_RGB = [
  [34, 211, 238],  // 1: Cyan
  [251, 146, 60],  // 2: Orange
  [232, 121, 249], // 3: Fuchsia
  [52, 211, 153],  // 4: Emerald
  [129, 140, 248], // 5: Indigo
  [244, 114, 182], // 6: Pink
  [250, 204, 21],  // 7: Amber
  [56, 189, 248],  // 8: Sky Blue
  [248, 113, 113], // 9: Rose
  [192, 132, 252], // 10: Purple
  [45, 212, 191],  // 11: Teal
  [251, 113, 36],  // 12: Deep Orange
  [163, 230, 53],  // 13: Lime
  [167, 139, 250], // 14: Violet
  [236, 72, 153],  // 15: Magenta
  [20, 184, 166],  // 16: Dark Teal
];

/**
 * Creates an endian-safe 32-bit packed color lookup table (Uint32Array(256)).
 * Index 0 (background) is transparent [0,0,0,0].
 *
 * @param {number} [alpha]
 * @returns {Uint32Array}
 */
export function createColorLookupTable(alpha = SEGMENTATION_ALPHA) {
  const table = new Uint32Array(256);
  const buf = new ArrayBuffer(4);
  const u8 = new Uint8ClampedArray(buf);
  const u32 = new Uint32Array(buf);

  // Class 0: transparent background
  table[0] = 0;

  for (let c = 1; c < 256; c += 1) {
    const rgb = BASE_PALETTE_RGB[(c - 1) % BASE_PALETTE_RGB.length];
    u8[0] = rgb[0];
    u8[1] = rgb[1];
    u8[2] = rgb[2];
    u8[3] = alpha;
    table[c] = u32[0];
  }

  return table;
}

export const COLOR_LOOKUP_TABLE = createColorLookupTable(SEGMENTATION_ALPHA);

/** @type {Uint8Array | null} */
let cachedFrontRaster = null;
/** @type {Uint8Array | null} */
let cachedSideRaster = null;

/** @type {(() => void) | null} */
let requestFrontRefreshFn = null;
/** @type {(() => void) | null} */
let requestSideRefreshFn = null;

export function clearSegmentationOverlayCache() {
  cachedFrontRaster = null;
  cachedSideRaster = null;
}

/**
 * Renders the Front segmentation raster onto the front canvas element.
 *
 * @param {HTMLCanvasElement | null} canvasEl
 */
export function renderFrontSegmentationOverlay(canvasEl) {
  if (!canvasEl) {
    return;
  }

  const enabled = isFrontSegmentationSettingEnabled();
  const raster = getFrontSegmentationRaster();
  const qa = getBodyEvidenceQa();
  const seg = qa?.views?.front?.segmentation;

  const shouldRender = Boolean(enabled && raster && raster.length > 0 && seg?.widthPx && seg?.heightPx);

  if (!shouldRender) {
    canvasEl.hidden = true;
    if (raster === null && cachedFrontRaster !== null) {
      if (typeof canvasEl.getContext === 'function') {
        const ctx = canvasEl.getContext('2d');
        ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      cachedFrontRaster = null;
    }
    return;
  }

  const width = seg.widthPx;
  const height = seg.heightPx;

  // Redraw into canvas only when raster payload changes
  if (cachedFrontRaster !== raster) {
    if (typeof canvasEl.getContext === 'function') {
      if (canvasEl.width !== width) canvasEl.width = width;
      if (canvasEl.height !== height) canvasEl.height = height;

      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        const out = new Uint32Array(imgData.data.buffer);
        const len = raster.length;
        for (let i = 0; i < len; i += 1) {
          out[i] = COLOR_LOOKUP_TABLE[raster[i]];
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }
    cachedFrontRaster = raster;
  }

  canvasEl.hidden = false;
}

/**
 * Renders the Side segmentation raster onto the side canvas element.
 *
 * @param {HTMLCanvasElement | null} canvasEl
 */
export function renderSideSegmentationOverlay(canvasEl) {
  if (!canvasEl) {
    return;
  }

  const enabled = isSideSegmentationSettingEnabled();
  const raster = getSideSegmentationRaster();
  const qa = getBodyEvidenceQa();
  const seg = qa?.views?.side?.segmentation;

  const shouldRender = Boolean(enabled && raster && raster.length > 0 && seg?.widthPx && seg?.heightPx);

  if (!shouldRender) {
    canvasEl.hidden = true;
    if (raster === null && cachedSideRaster !== null) {
      if (typeof canvasEl.getContext === 'function') {
        const ctx = canvasEl.getContext('2d');
        ctx?.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      cachedSideRaster = null;
    }
    return;
  }

  const width = seg.widthPx;
  const height = seg.heightPx;

  // Redraw into canvas only when raster payload changes
  if (cachedSideRaster !== raster) {
    if (typeof canvasEl.getContext === 'function') {
      if (canvasEl.width !== width) canvasEl.width = width;
      if (canvasEl.height !== height) canvasEl.height = height;

      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        const out = new Uint32Array(imgData.data.buffer);
        const len = raster.length;
        for (let i = 0; i < len; i += 1) {
          out[i] = COLOR_LOOKUP_TABLE[raster[i]];
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }
    cachedSideRaster = raster;
  }

  canvasEl.hidden = false;
}

/**
 * Sets up change subscriptions for Body Evidence and View settings.
 *
 * @param {(() => void) | null} [requestFrontRefresh]
 * @param {(() => void) | null} [requestSideRefresh]
 */
export function setupSegmentationOverlay2d(requestFrontRefresh = null, requestSideRefresh = null) {
  requestFrontRefreshFn = typeof requestFrontRefresh === 'function' ? requestFrontRefresh : null;
  requestSideRefreshFn = typeof requestSideRefresh === 'function' ? requestSideRefresh : null;

  const onUpdate = () => {
    requestFrontRefreshFn?.();
    requestSideRefreshFn?.();
  };

  subscribeBodyEvidenceChange(onUpdate);
  subscribeViewSettingChange(onUpdate);
}

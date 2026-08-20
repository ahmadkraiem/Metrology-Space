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
  getSelectedFrontSegClassId,
  getSelectedSideSegClassId,
  getSideSegmentationRaster,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  isFrontSegmentationSettingEnabled,
  isSideSegmentationSettingEnabled,
  subscribeViewSettingChange,
} from './viewControls.js';
import {
  grid2dSegmentationCanvasEl,
  sideSegmentationCanvasEl,
} from './domRefs.js';

const SEGMENTATION_ALPHA = 95; // ~37% opacity (95 / 255) for translucent visibility
const EMPHASIS_ALPHA = 220; // ~86% opacity for emphasized selected class
const DIMMED_ALPHA = 20; // ~8% opacity for dimmed unselected classes

/**
 * Curated, high-contrast, harmonious palette for semantic classes.
 * Background (class 0) is always fully transparent.
 */
export const BASE_PALETTE_RGB = [
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

/**
 * Creates a specialized lookup table where the selected class is emphasized
 * and non-selected classes are dimmed. If selectedClassId is null, returns
 * standard COLOR_LOOKUP_TABLE.
 *
 * @param {number|null|undefined} selectedClassId
 * @returns {Uint32Array}
 */
export function createHighlightColorLookupTable(selectedClassId) {
  if (selectedClassId === null || selectedClassId === undefined) {
    return COLOR_LOOKUP_TABLE;
  }

  const targetId = Number(selectedClassId);
  const table = new Uint32Array(256);
  const buf = new ArrayBuffer(4);
  const u8 = new Uint8ClampedArray(buf);
  const u32 = new Uint32Array(buf);

  // Background class 0
  if (targetId === 0) {
    u8[0] = 220;
    u8[1] = 220;
    u8[2] = 220;
    u8[3] = 180;
    table[0] = u32[0];
  } else {
    table[0] = 0;
  }

  for (let c = 1; c < 256; c += 1) {
    const rgb = BASE_PALETTE_RGB[(c - 1) % BASE_PALETTE_RGB.length];
    u8[0] = rgb[0];
    u8[1] = rgb[1];
    u8[2] = rgb[2];
    u8[3] = c === targetId ? EMPHASIS_ALPHA : DIMMED_ALPHA;
    table[c] = u32[0];
  }

  return table;
}

/** @type {Uint8Array | null} */
let cachedFrontRaster = null;
/** @type {number | null} */
let cachedFrontSegClassId = null;

/** @type {Uint8Array | null} */
let cachedSideRaster = null;
/** @type {number | null} */
let cachedSideSegClassId = null;

/** @type {(() => void) | null} */
let requestFrontRefreshFn = null;
/** @type {(() => void) | null} */
let requestSideRefreshFn = null;

export function clearSegmentationOverlayCache() {
  cachedFrontRaster = null;
  cachedFrontSegClassId = null;
  cachedSideRaster = null;
  cachedSideSegClassId = null;
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
  const selectedClassId = getSelectedFrontSegClassId();
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
      cachedFrontSegClassId = null;
    }
    return;
  }

  const width = seg.widthPx;
  const height = seg.heightPx;

  // Redraw into canvas when raster payload OR selected class changes
  if (cachedFrontRaster !== raster || cachedFrontSegClassId !== selectedClassId) {
    if (typeof canvasEl.getContext === 'function') {
      if (canvasEl.width !== width) canvasEl.width = width;
      if (canvasEl.height !== height) canvasEl.height = height;

      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        const lut = createHighlightColorLookupTable(selectedClassId);
        const imgData = ctx.createImageData(width, height);
        const out = new Uint32Array(imgData.data.buffer);
        const len = raster.length;
        for (let i = 0; i < len; i += 1) {
          out[i] = lut[raster[i]];
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }
    cachedFrontRaster = raster;
    cachedFrontSegClassId = selectedClassId;
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
  const selectedClassId = getSelectedSideSegClassId();
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
      cachedSideSegClassId = null;
    }
    return;
  }

  const width = seg.widthPx;
  const height = seg.heightPx;

  // Redraw into canvas when raster payload OR selected class changes
  if (cachedSideRaster !== raster || cachedSideSegClassId !== selectedClassId) {
    if (typeof canvasEl.getContext === 'function') {
      if (canvasEl.width !== width) canvasEl.width = width;
      if (canvasEl.height !== height) canvasEl.height = height;

      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        const lut = createHighlightColorLookupTable(selectedClassId);
        const imgData = ctx.createImageData(width, height);
        const out = new Uint32Array(imgData.data.buffer);
        const len = raster.length;
        for (let i = 0; i < len; i += 1) {
          out[i] = lut[raster[i]];
        }
        ctx.putImageData(imgData, 0, 0);
      }
    }
    cachedSideRaster = raster;
    cachedSideSegClassId = selectedClassId;
  }

  canvasEl.hidden = false;
}

/**
 * Synchronizes the Front segmentation overlay visibility with view settings.
 * If the raster is already cached and rendered, this simply toggles canvas
 * visibility in O(1) time without re-rasterizing or triggering a full grid refresh.
 *
 * @param {HTMLCanvasElement | null} [canvasEl]
 */
export function syncFrontSegmentationVisibility(canvasEl = grid2dSegmentationCanvasEl) {
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
    return;
  }

  const selectedClassId = getSelectedFrontSegClassId();
  if (cachedFrontRaster === raster && cachedFrontSegClassId === selectedClassId) {
    canvasEl.hidden = false;
    return;
  }

  renderFrontSegmentationOverlay(canvasEl);
}

/**
 * Synchronizes the Side segmentation overlay visibility with view settings.
 * If the raster is already cached and rendered, this simply toggles canvas
 * visibility in O(1) time without re-rasterizing or triggering a full grid refresh.
 *
 * @param {HTMLCanvasElement | null} [canvasEl]
 */
export function syncSideSegmentationVisibility(canvasEl = sideSegmentationCanvasEl) {
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
    return;
  }

  const selectedClassId = getSelectedSideSegClassId();
  if (cachedSideRaster === raster && cachedSideSegClassId === selectedClassId) {
    canvasEl.hidden = false;
    return;
  }

  renderSideSegmentationOverlay(canvasEl);
}

let isSubscribed = false;

/**
 * Sets up change subscriptions for Body Evidence and View settings.
 *
 * @param {(() => void) | null} [requestFrontRefresh]
 * @param {(() => void) | null} [requestSideRefresh]
 */
export function setupSegmentationOverlay2d(requestFrontRefresh = null, requestSideRefresh = null) {
  if (typeof requestFrontRefresh === 'function') {
    requestFrontRefreshFn = requestFrontRefresh;
  }
  if (typeof requestSideRefresh === 'function') {
    requestSideRefreshFn = requestSideRefresh;
  }

  if (!isSubscribed) {
    isSubscribed = true;

    // Dedicated lightweight listener for View menu toggles (instant show/hide)
    subscribeViewSettingChange(() => {
      syncFrontSegmentationVisibility();
      syncSideSegmentationVisibility();
    });

    // Listener for evidence source analysis / class selection changes (repaint canvas)
    subscribeBodyEvidenceChange(() => {
      if (grid2dSegmentationCanvasEl) {
        renderFrontSegmentationOverlay(grid2dSegmentationCanvasEl);
      }
      if (sideSegmentationCanvasEl) {
        renderSideSegmentationOverlay(sideSegmentationCanvasEl);
      }
      requestFrontRefreshFn?.();
      requestSideRefreshFn?.();
    });
  }
}

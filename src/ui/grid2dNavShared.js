/**
 * Shared pure helpers for Front and Side 2D navigators.
 *
 * Owns no DOM, no Front/Side semantic coupling, and no measurement state.
 * Callers supply domain axes meaning (Front X/Y vs Side U/Y).
 */

import { ROOM_SIZE } from '../core/constants.js';
import { FIELD_INSET_PX, plotPercentFromRatio } from './grid2dPlotArea.js';

export const MODE_PICK = 'pick';
export const MODE_REGION = 'region';

export const BASE_DOMAIN = { hMin: 0, hMax: ROOM_SIZE, vMin: 0, vMax: ROOM_SIZE };
export const BASE_STEP = 10;
export const MIN_DETAIL_STEP = 5;
export const MIN_DRAG_PX = 4;
export const PICK_HIT_RADIUS_PX = 10;
export const MIN_VISUAL_ZOOM = 1;
export const MAX_VISUAL_ZOOM = 8;
export const WHEEL_ZOOM_FACTOR = 1.12;

export function cloneBounds(bounds) {
  return {
    hMin: bounds.hMin,
    hMax: bounds.hMax,
    vMin: bounds.vMin,
    vMax: bounds.vMax,
  };
}

export function formatRangeValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatAxisReadout(axis, value) {
  return `${axis.toUpperCase()}: ${formatRangeValue(value)} cm`;
}

export function generatePointsForBounds(bounds, step) {
  const points = [];
  const hStart = Math.ceil(bounds.hMin / step) * step;
  const vStart = Math.ceil(bounds.vMin / step) * step;

  for (let h = hStart; h <= bounds.hMax; h += step) {
    for (let v = vStart; v <= bounds.vMax; v += step) {
      points.push({ h, v, step });
    }
  }

  return points;
}

export function dedupePoints(points) {
  const pointMap = new Map();

  for (const point of points) {
    const key = `${point.h},${point.v}`;
    const existing = pointMap.get(key);

    if (!existing || point.step < existing.step) {
      pointMap.set(key, point);
    }
  }

  return Array.from(pointMap.values());
}

export function boundsOverlap(a, b) {
  return !(
    a.hMax < b.hMin
    || a.hMin > b.hMax
    || a.vMax < b.vMin
    || a.vMin > b.vMax
  );
}

export function getSelectionBounds(points) {
  if (!points.length) {
    return null;
  }

  let hMin = Infinity;
  let hMax = -Infinity;
  let vMin = Infinity;
  let vMax = -Infinity;

  for (const point of points) {
    hMin = Math.min(hMin, point.h);
    hMax = Math.max(hMax, point.h);
    vMin = Math.min(vMin, point.v);
    vMax = Math.max(vMax, point.v);
  }

  return { hMin, hMax, vMin, vMax };
}

export function isInDomain(h, v, domain = BASE_DOMAIN) {
  return (
    h >= domain.hMin
    && h <= domain.hMax
    && v >= domain.vMin
    && v <= domain.vMax
  );
}

export function hasRefinementInBounds(refinedRegions, bounds) {
  return refinedRegions.some((region) => boundsOverlap(bounds, region));
}

/**
 * Single-pass 10→5 cm refinement decision shared by Front and Side lattices.
 */
export function classifySplitSelection({
  activeMode,
  selectedRegionPoints,
  refinedRegions,
  detailStep = MIN_DETAIL_STEP,
}) {
  if (activeMode !== MODE_REGION || selectedRegionPoints.length < 2) {
    return { canSplit: false, message: null, action: null };
  }

  const bounds = getSelectionBounds(selectedRegionPoints);

  if (hasRefinementInBounds(refinedRegions, bounds)) {
    return { canSplit: false, message: 'Already refined at 5 cm.', action: null };
  }

  return {
    canSplit: true,
    message: null,
    action: { step: detailStep, bounds },
  };
}

export function createVisualTransform() {
  return { scale: 1, panX: 0, panY: 0 };
}

export function clampPanForZoom(visualTransform, width, height) {
  if (width <= 0 || height <= 0) {
    return visualTransform;
  }

  const maxPanX = ((visualTransform.scale - 1) * width) / 2;
  const maxPanY = ((visualTransform.scale - 1) * height) / 2;
  visualTransform.panX = Math.min(Math.max(visualTransform.panX, -maxPanX), maxPanX);
  visualTransform.panY = Math.min(Math.max(visualTransform.panY, -maxPanY), maxPanY);
  return visualTransform;
}

/**
 * Wheel zoom toward a field-local point. Mutates and returns visualTransform.
 */
export function applyWheelZoom(visualTransform, {
  fieldX,
  fieldY,
  width,
  height,
  zoomIn,
  minZoom = MIN_VISUAL_ZOOM,
  maxZoom = MAX_VISUAL_ZOOM,
  factor = WHEEL_ZOOM_FACTOR,
}) {
  const nextFactor = zoomIn ? factor : 1 / factor;
  const nextScale = Math.min(
    Math.max(visualTransform.scale * nextFactor, minZoom),
    maxZoom,
  );

  if (nextScale === visualTransform.scale) {
    return { changed: false, visualTransform };
  }

  const cx = width / 2;
  const cy = height / 2;
  const scaleRatio = nextScale / visualTransform.scale;

  visualTransform.panX = fieldX - cx - (fieldX - cx - visualTransform.panX) * scaleRatio;
  visualTransform.panY = fieldY - cy - (fieldY - cy - visualTransform.panY) * scaleRatio;
  visualTransform.scale = nextScale;
  clampPanForZoom(visualTransform, width, height);

  return { changed: true, visualTransform };
}

export function worldToPlotPx(h, v, metrics, domain = BASE_DOMAIN) {
  const { padLeft, padTop, plotW, plotH } = metrics;
  const spanH = domain.hMax - domain.hMin;
  const spanV = domain.vMax - domain.vMin;
  const u = (h - domain.hMin) / spanH;
  const t = (v - domain.vMin) / spanV;

  return {
    px: padLeft + u * plotW,
    py: padTop + (1 - t) * plotH,
  };
}

export function worldToScreen2d(h, v, metrics, visualTransform, domain = BASE_DOMAIN) {
  const { width, height } = metrics;
  const { px, py } = worldToPlotPx(h, v, metrics, domain);
  const cx = width / 2;
  const cy = height / 2;

  return {
    x: cx + (px - cx) * visualTransform.scale + visualTransform.panX,
    y: cy + (py - cy) * visualTransform.scale + visualTransform.panY,
  };
}

export function projectToPercent(h, v, metrics, domain = BASE_DOMAIN) {
  const spanH = domain.hMax - domain.hMin;
  const spanV = domain.vMax - domain.vMin;

  return plotPercentFromRatio(
    metrics,
    (h - domain.hMin) / spanH,
    (v - domain.vMin) / spanV,
  );
}

export function getWrapperLocalPoint(wrapperEl, clientX, clientY) {
  const rect = wrapperEl.getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

export function getScreenPointForWorld(wrapperEl, h, v, metrics, visualTransform, domain = BASE_DOMAIN) {
  const screen = worldToScreen2d(h, v, metrics, visualTransform, domain);
  const wrapperRect = wrapperEl.getBoundingClientRect();
  return {
    x: wrapperRect.left + FIELD_INSET_PX + screen.x,
    y: wrapperRect.top + FIELD_INSET_PX + screen.y,
  };
}

export function findNearestDisplayPoint({
  clientX,
  clientY,
  points,
  wrapperEl,
  metrics,
  visualTransform,
  domain = BASE_DOMAIN,
  hitRadiusPx = PICK_HIT_RADIUS_PX,
}) {
  let nearest = null;
  let nearestDistance = hitRadiusPx;

  for (const point of points) {
    const screen = getScreenPointForWorld(
      wrapperEl,
      point.h,
      point.v,
      metrics,
      visualTransform,
      domain,
    );
    const dx = clientX - screen.x;
    const dy = clientY - screen.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearest;
}

export function getPointsInsideSelectionRect({
  dragSelectState,
  wrapperEl,
  points,
  metrics,
  visualTransform,
  domain = BASE_DOMAIN,
  minDragPx = MIN_DRAG_PX,
}) {
  if (!dragSelectState) {
    return [];
  }

  const start = getWrapperLocalPoint(wrapperEl, dragSelectState.startX, dragSelectState.startY);
  const end = getWrapperLocalPoint(wrapperEl, dragSelectState.currentX, dragSelectState.currentY);
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  if (right - left < minDragPx && bottom - top < minDragPx) {
    return [];
  }

  const wrapperRect = wrapperEl.getBoundingClientRect();
  const rect = {
    left: wrapperRect.left + left,
    top: wrapperRect.top + top,
    right: wrapperRect.left + right,
    bottom: wrapperRect.top + bottom,
  };

  const nextSelection = [];

  for (const point of points) {
    const screen = getScreenPointForWorld(
      wrapperEl,
      point.h,
      point.v,
      metrics,
      visualTransform,
      domain,
    );

    if (
      screen.x >= rect.left
      && screen.x <= rect.right
      && screen.y >= rect.top
      && screen.y <= rect.bottom
    ) {
      nextSelection.push({ h: point.h, v: point.v, step: point.step });
    }
  }

  return nextSelection;
}

export function applyVisualZoomTransform(fieldEl, visualTransform) {
  if (!fieldEl) {
    return;
  }
  fieldEl.style.transform = (
    `translate(${visualTransform.panX}px, ${visualTransform.panY}px)`
    + ` scale(${visualTransform.scale})`
  );
}

export function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return tagName === 'INPUT'
    || tagName === 'TEXTAREA'
    || tagName === 'SELECT'
    || target.isContentEditable;
}

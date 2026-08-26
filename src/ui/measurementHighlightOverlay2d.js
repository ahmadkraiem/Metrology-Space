/**
 * Measurement Highlight 2D Overlay Primitives v0
 *
 * Pure declarative UI rendering layer that visualizes normalized measurement provenance
 * ('measurement-visualization-provenance-v0') on Front and Side 2D workspace navigators.
 *
 * STRICT GUARDRAILS:
 * - Read-only renderer consuming normalized visualization instructions.
 * - Does not recompute measurement math, seat planes, perimeters, or endpoints.
 * - Non-destructive: renders on dedicated highlight layers without affecting annotations,
 *   lattice points, segmentations, or manual distance graphics.
 * - Metric Y (cm) is the authoritative cross-view synchronization key.
 */

import {
  VISUALIZATION_TYPES,
  VISUALIZATION_STATUS,
} from '../features/measurementVisualizationProvenance.js';
import {
  grid2dMeasurementHighlightLayerEl,
  sideMeasurementHighlightLayerEl,
} from './domRefs.js';
import { formatDistance } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';

/** @type {object|null} */
let activeVisualization = null;

/** @type {boolean} */
let highlightVisible = true;

/** @type {Set<(vis: object|null) => void>} */
const changeListeners = new Set();

/** @type {(() => void)|null} */
let refreshFrontNavigatorFn = null;
/** @type {(() => void)|null} */
let refreshSideNavigatorFn = null;

/**
 * Registers 2D navigator refresh callbacks for automatic redraw on highlight change.
 * @param {{ refreshFrontNavigator?: (() => void)|null, refreshSideNavigator?: (() => void)|null }} callbacks
 */
export function setupMeasurementHighlightOverlay({
  refreshFrontNavigator = null,
  refreshSideNavigator = null,
} = {}) {
  if (typeof refreshFrontNavigator === 'function') {
    refreshFrontNavigatorFn = refreshFrontNavigator;
  }
  if (typeof refreshSideNavigator === 'function') {
    refreshSideNavigatorFn = refreshSideNavigator;
  }
}

function notifyHighlightChange() {
  for (const listener of changeListeners) {
    try {
      listener(activeVisualization);
    } catch (err) {
      console.error('[RVEacity] Error in measurement highlight listener:', err);
    }
  }
  if (typeof refreshFrontNavigatorFn === 'function') {
    refreshFrontNavigatorFn();
  }
  if (typeof refreshSideNavigatorFn === 'function') {
    refreshSideNavigatorFn();
  }
}

/**
 * Subscribes to measurement highlight changes.
 * @param {(visualization: object|null) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeMeasurementHighlightChange(callback) {
  if (typeof callback === 'function') {
    changeListeners.add(callback);
    return () => changeListeners.delete(callback);
  }
  return () => {};
}

/**
 * Gets the current active measurement visualization record.
 * @returns {object|null}
 */
export function getMeasurementHighlight() {
  return activeVisualization;
}

/**
 * Sets the active measurement visualization highlight.
 * Replaces any previous highlight without mutating the input object.
 * @param {object|null} visualization
 */
export function setMeasurementHighlight(visualization) {
  if (!visualization || typeof visualization !== 'object') {
    clearMeasurementHighlight();
    return;
  }
  activeVisualization = { ...visualization };
  notifyHighlightChange();
}

/**
 * Clears the active measurement highlight.
 */
export function clearMeasurementHighlight() {
  if (activeVisualization !== null) {
    activeVisualization = null;
    notifyHighlightChange();
  }
}

/**
 * Checks whether measurement highlight rendering is enabled.
 * @returns {boolean}
 */
export function isMeasurementHighlightVisible() {
  return highlightVisible;
}

/**
 * Sets visibility of the measurement highlight overlay.
 * @param {boolean} visible
 */
export function setMeasurementHighlightVisible(visible) {
  highlightVisible = Boolean(visible);
  notifyHighlightChange();
}

// ── DOM Helper Primitives ──

function createHighlightLine(pA, pB, className = 'grid2d-highlight-line') {
  const dx = pB.px - pA.px;
  const dy = pB.py - pA.py;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;

  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const line = document.createElement('div');
  line.className = className;
  line.style.left = `${pA.px}px`;
  line.style.top = `${pA.py}px`;
  line.style.width = `${length}px`;
  line.style.transform = `rotate(${angleDeg}deg)`;
  line.setAttribute('aria-hidden', 'true');
  return line;
}

function createHighlightDot(point) {
  const dot = document.createElement('div');
  dot.className = 'grid2d-highlight-dot';
  dot.style.left = `${point.px}px`;
  dot.style.top = `${point.py}px`;
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

function createHighlightBadge(point, text) {
  const badge = document.createElement('div');
  badge.className = 'grid2d-highlight-badge';
  badge.textContent = text;
  badge.style.left = `${point.px}px`;
  badge.style.top = `${point.py}px`;
  badge.setAttribute('aria-hidden', 'true');
  return badge;
}

function createHorizontalGuide(py) {
  const guide = document.createElement('div');
  guide.className = 'grid2d-highlight-level-guide';
  guide.style.top = `${py}px`;
  guide.setAttribute('aria-hidden', 'true');
  return guide;
}

// ── Specialized Visualization Renderers ──

function renderFrontHorizontalSlice(fragment, geometry, worldToPlotPx) {
  const yCm = geometry.yCm;
  const minX = geometry.front?.minXcm;
  const maxX = geometry.front?.maxXcm;
  const width = geometry.front?.widthCm;

  if (typeof yCm !== 'number' || typeof minX !== 'number' || typeof maxX !== 'number') {
    return;
  }

  const pA = worldToPlotPx(minX, yCm);
  const pB = worldToPlotPx(maxX, yCm);

  const line = createHighlightLine(pA, pB);
  if (line) fragment.appendChild(line);
  fragment.appendChild(createHighlightDot(pA));
  fragment.appendChild(createHighlightDot(pB));

  const displaySpan = width ?? Math.abs(maxX - minX);
  const midPoint = { px: (pA.px + pB.px) / 2, py: pA.py };
  fragment.appendChild(createHighlightBadge(midPoint, `${formatDistance(displaySpan)} cm`));
}

function renderSideHorizontalSlice(fragment, geometry, worldToPlotPx) {
  const yCm = geometry.yCm;
  const minU = geometry.side?.minUcm;
  const maxU = geometry.side?.maxUcm;
  const depth = geometry.side?.depthCm;

  if (typeof yCm !== 'number' || typeof minU !== 'number' || typeof maxU !== 'number') {
    return;
  }

  const pA = worldToPlotPx(minU, yCm);
  const pB = worldToPlotPx(maxU, yCm);

  const line = createHighlightLine(pA, pB);
  if (line) fragment.appendChild(line);
  fragment.appendChild(createHighlightDot(pA));
  fragment.appendChild(createHighlightDot(pB));

  const displayDepth = depth ?? Math.abs(maxU - minU);
  const midPoint = { px: (pA.px + pB.px) / 2, py: pA.py };
  fragment.appendChild(createHighlightBadge(midPoint, `${formatDistance(displayDepth)} cm`));
}

function renderCrossViewHorizontalSlice(fragment, view, geometry, worldToPlotPx) {
  const yCm = geometry.yCm;
  if (typeof yCm !== 'number') return;

  if (view === 'front') {
    const minX = geometry.front?.minXcm;
    const maxX = geometry.front?.maxXcm;
    const width = geometry.front?.widthCm;

    if (typeof minX === 'number' && typeof maxX === 'number') {
      const pA = worldToPlotPx(minX, yCm);
      const pB = worldToPlotPx(maxX, yCm);

      const line = createHighlightLine(pA, pB);
      if (line) fragment.appendChild(line);
      fragment.appendChild(createHighlightDot(pA));
      fragment.appendChild(createHighlightDot(pB));

      const displaySpan = width ?? Math.abs(maxX - minX);
      const midPoint = { px: (pA.px + pB.px) / 2, py: pA.py };
      fragment.appendChild(createHighlightBadge(midPoint, `${formatDistance(displaySpan)} cm`));
    }
  } else if (view === 'side') {
    const minU = geometry.side?.minUcm;
    const maxU = geometry.side?.maxUcm;
    const depth = geometry.side?.depthCm;

    if (typeof minU === 'number' && typeof maxU === 'number') {
      const pA = worldToPlotPx(minU, yCm);
      const pB = worldToPlotPx(maxU, yCm);

      const line = createHighlightLine(pA, pB);
      if (line) fragment.appendChild(line);
      fragment.appendChild(createHighlightDot(pA));
      fragment.appendChild(createHighlightDot(pB));

      const displayDepth = depth ?? Math.abs(maxU - minU);
      const midPoint = { px: (pA.px + pB.px) / 2, py: pA.py };
      fragment.appendChild(createHighlightBadge(midPoint, `${formatDistance(displayDepth)} cm`));
    }
  }
}

function renderLandmarkSegment(fragment, geometry, worldToPlotPx) {
  const epA = geometry.endpointA;
  const epB = geometry.endpointB;
  const dist = geometry.distanceCm;

  if (!epA || !epB || typeof epA.xCm !== 'number' || typeof epB.xCm !== 'number'
    || typeof epA.yCm !== 'number' || typeof epB.yCm !== 'number') {
    return;
  }

  const pA = worldToPlotPx(epA.xCm, epA.yCm);
  const pB = worldToPlotPx(epB.xCm, epB.yCm);

  const line = createHighlightLine(pA, pB);
  if (line) fragment.appendChild(line);
  fragment.appendChild(createHighlightDot(pA));
  fragment.appendChild(createHighlightDot(pB));

  const displayDist = dist ?? Math.hypot(epB.xCm - epA.xCm, epB.yCm - epA.yCm);
  const midPoint = { px: (pA.px + pB.px) / 2, py: (pA.py + pB.py) / 2 };
  fragment.appendChild(createHighlightBadge(midPoint, `${formatDistance(displayDist)} cm`));
}

function renderLandmarkChain(fragment, geometry, worldToPlotPx) {
  const points = geometry.points;
  const total = geometry.totalLengthCm;

  if (!Array.isArray(points) || points.length < 2) return;

  for (let i = 0; i < points.length - 1; i++) {
    const ptA = points[i];
    const ptB = points[i + 1];
    if (typeof ptA.xCm !== 'number' || typeof ptA.yCm !== 'number'
      || typeof ptB.xCm !== 'number' || typeof ptB.yCm !== 'number') {
      continue;
    }

    const pA = worldToPlotPx(ptA.xCm, ptA.yCm);
    const pB = worldToPlotPx(ptB.xCm, ptB.yCm);

    const line = createHighlightLine(pA, pB);
    if (line) fragment.appendChild(line);
    fragment.appendChild(createHighlightDot(pA));
  }

  const lastPt = points[points.length - 1];
  if (typeof lastPt.xCm === 'number' && typeof lastPt.yCm === 'number') {
    fragment.appendChild(createHighlightDot(worldToPlotPx(lastPt.xCm, lastPt.yCm)));
  }

  if (typeof total === 'number' && Number.isFinite(total)) {
    const midIdx = Math.floor(points.length / 2);
    const midPt = points[midIdx];
    const pMid = worldToPlotPx(midPt.xCm, midPt.yCm);
    fragment.appendChild(createHighlightBadge({ px: pMid.px + 14, py: pMid.py - 10 }, `${formatDistance(total)} cm`));
  }
}

function renderVerticalLevelInterval(fragment, geometry, worldToPlotPx) {
  const upperY = geometry.upperYcm;
  const lowerY = geometry.lowerYcm;
  const dist = geometry.distanceCm;

  if (typeof upperY !== 'number' || typeof lowerY !== 'number') {
    return;
  }

  const centerX = 100;
  const tickHalfWidthCm = 15;

  const pUpperLeft = worldToPlotPx(centerX - tickHalfWidthCm, upperY);
  const pUpperRight = worldToPlotPx(centerX + tickHalfWidthCm, upperY);
  const pLowerLeft = worldToPlotPx(centerX - tickHalfWidthCm, lowerY);
  const pLowerRight = worldToPlotPx(centerX + tickHalfWidthCm, lowerY);

  const pCenterUpper = worldToPlotPx(centerX, upperY);
  const pCenterLower = worldToPlotPx(centerX, lowerY);

  const upperTick = createHighlightLine(pUpperLeft, pUpperRight, 'grid2d-highlight-tick');
  const lowerTick = createHighlightLine(pLowerLeft, pLowerRight, 'grid2d-highlight-tick');
  const verticalLine = createHighlightLine(pCenterUpper, pCenterLower, 'grid2d-highlight-vertical-line');

  if (upperTick) fragment.appendChild(upperTick);
  if (lowerTick) fragment.appendChild(lowerTick);
  if (verticalLine) fragment.appendChild(verticalLine);

  fragment.appendChild(createHighlightDot(pCenterUpper));
  fragment.appendChild(createHighlightDot(pCenterLower));

  const displayDist = dist ?? Math.abs(upperY - lowerY);
  const midPoint = { px: pCenterUpper.px, py: (pCenterUpper.py + pCenterLower.py) / 2 };
  fragment.appendChild(createHighlightBadge(midPoint, `${formatDistance(displayDist)} cm`));
}

function renderFrontHorizontalLevel(fragment, geometry, worldToPlotPx, displayName) {
  const yCm = geometry.yCm;
  const anchors = geometry.anchors;
  const levelId = geometry.levelId;

  if (typeof yCm !== 'number') return;

  const pCenter = worldToPlotPx(100, yCm);
  fragment.appendChild(createHorizontalGuide(pCenter.py));

  if (Array.isArray(anchors)) {
    for (const anchor of anchors) {
      if (typeof anchor.xCm === 'number' && typeof anchor.yCm === 'number') {
        fragment.appendChild(createHighlightDot(worldToPlotPx(anchor.xCm, anchor.yCm)));
      }
    }
  }

  const labelText = formatLandmarkDisplayName(levelId) || displayName || 'Level';
  fragment.appendChild(createHighlightBadge({ px: pCenter.px, py: pCenter.py - 12 }, labelText));
}

/**
 * Renders declarative 2D measurement highlight primitives onto the target view's overlay layer.
 *
 * @param {{
 *   view: 'front'|'side',
 *   worldToPlotPx: (h: number, v: number) => { px: number, py: number },
 * }} options
 */
export function renderMeasurementHighlight2d({ view = 'front', worldToPlotPx, layerEl = null }) {
  const resolvedLayer = layerEl
    ?? (view === 'front' ? grid2dMeasurementHighlightLayerEl : sideMeasurementHighlightLayerEl)
    ?? (typeof document !== 'undefined'
      ? (view === 'front'
        ? document.getElementById('grid2d-measurement-highlight-layer')
        : document.getElementById('side-evidence-measurement-highlight-layer'))
      : null);

  if (!resolvedLayer || typeof worldToPlotPx !== 'function') {
    return;
  }

  if (!highlightVisible || !activeVisualization || activeVisualization.status !== VISUALIZATION_STATUS.READY) {
    resolvedLayer.replaceChildren();
    return;
  }

  const targetViews = activeVisualization.targetViews ?? [];
  if (!targetViews.includes(view)) {
    resolvedLayer.replaceChildren();
    return;
  }

  const geometry = activeVisualization.geometry;
  if (!geometry || typeof geometry !== 'object') {
    resolvedLayer.replaceChildren();
    return;
  }

  const fragment = document.createDocumentFragment();
  const visType = activeVisualization.visualizationType;
  const displayName = activeVisualization.displayName;

  switch (visType) {
    case VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE:
      if (view === 'front') {
        renderFrontHorizontalSlice(fragment, geometry, worldToPlotPx, displayName);
      }
      break;

    case VISUALIZATION_TYPES.SIDE_HORIZONTAL_SLICE:
      if (view === 'side') {
        renderSideHorizontalSlice(fragment, geometry, worldToPlotPx, displayName);
      }
      break;

    case VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE:
      renderCrossViewHorizontalSlice(fragment, view, geometry, worldToPlotPx, displayName);
      break;

    case VISUALIZATION_TYPES.LANDMARK_SEGMENT:
      if (view === 'front') {
        renderLandmarkSegment(fragment, geometry, worldToPlotPx, displayName);
      }
      break;

    case VISUALIZATION_TYPES.LANDMARK_CHAIN:
      if (view === 'front') {
        renderLandmarkChain(fragment, geometry, worldToPlotPx, displayName);
      }
      break;

    case VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL:
      if (view === 'front') {
        renderVerticalLevelInterval(fragment, geometry, worldToPlotPx, displayName);
      }
      break;

    case VISUALIZATION_TYPES.FRONT_HORIZONTAL_LEVEL:
      if (view === 'front') {
        renderFrontHorizontalLevel(fragment, geometry, worldToPlotPx, displayName);
      }
      break;

    default:
      break;
  }

  layerEl.replaceChildren(fragment);
}

/**
 * Front view convenience renderer.
 * @param {{ worldToPlotPx: (h: number, v: number) => { px: number, py: number }, layerEl?: HTMLElement|null }} options
 */
export function renderFrontMeasurementHighlight({ worldToPlotPx, layerEl = null }) {
  renderMeasurementHighlight2d({ view: 'front', worldToPlotPx, layerEl });
}

/**
 * Side view convenience renderer.
 * @param {{ worldToPlotPx: (h: number, v: number) => { px: number, py: number }, layerEl?: HTMLElement|null }} options
 */
export function renderSideMeasurementHighlight({ worldToPlotPx, layerEl = null }) {
  renderMeasurementHighlight2d({ view: 'side', worldToPlotPx, layerEl });
}

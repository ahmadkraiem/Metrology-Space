import { HOVER_TOOLTIP_OFFSET, ROOM_SIZE } from '../core/constants.js';
import { formatCoordinate, formatDistance } from '../core/formatters.js';
import {
  advanceFrontSurfaceMeasurement,
  getActiveFrontSurfaceMeasurement,
} from '../features/frontSurfaceMeasurement.js';
import {
  formatFrontSurfacePointCoords,
  frontSurfaceTo3d,
  isOnFrontSurface,
} from '../core/frontSurface.js';
import { isAnnotateMode } from '../features/appMode.js';
import { selectPoint, subscribeSelectionChange } from '../features/selection.js';
import { getMeasurement3dLinesVisible } from '../features/measurement.js';
import {
  applyMarkerSizeStyle,
  applyMeasureMarkerSizeStyle,
  getLatticeBaseSizePxForStep,
  MEASURE_EMPHASIS_MULTIPLIER,
  updateLatticeStepLookup,
} from './grid2dMarkerSizing.js';
import {
  getGrid2dViewConfig,
  getProjectedAnnotationsVisible,
  getProjectedReferenceMarkersVisible,
  hideProjectionLinkingTooltip,
  renderProjectionMarkers,
} from '../features/projectionLinking.js';
import { getAnnotations } from '../features/annotations.js';
import {
  hideBodyEvidenceOverlayTooltip,
  isBodyEvidenceMarkerHovered,
  renderBodyEvidenceOverlay2d,
} from './bodyEvidenceOverlay2d.js';
import {
  renderFrontSegmentationOverlay,
  setupSegmentationOverlay2d,
} from './segmentationOverlay2d.js';
import { renderBodyMeasurementPreview2d } from '../features/bodyMeasurementPreview.js';
import {
  FIELD_INSET_PX,
  applyPlotAreaCssVars,
  computePlotMetrics,
  renderPlotAxisLabels,
} from './grid2dPlotArea.js';
import {
  MODE_PICK,
  MODE_REGION,
  BASE_DOMAIN,
  BASE_STEP,
  MIN_DETAIL_STEP,
  MIN_DRAG_PX,
  applyVisualZoomTransform,
  applyWheelZoom,
  classifySplitSelection as classifySplitSelectionShared,
  clampPanForZoom,
  cloneBounds,
  createVisualTransform,
  dedupePoints,
  findNearestDisplayPoint,
  formatAxisReadout,
  formatGridStateLabel,
  formatRangeValue,
  generatePointsForBounds,
  getPointsInsideSelectionRect as getPointsInsideSelectionRectShared,
  getScreenPointForWorld as getScreenPointForWorldShared,
  getSelectionBounds,
  getWrapperLocalPoint as getWrapperLocalPointShared,
  isInDomain,
  isTypingTarget as isTypingTargetShared,
  projectToPercent as projectToPercentShared,
  worldToPlotPx as worldToPlotPxShared,
} from './grid2dNavShared.js';
import {
  grid2dBackBtn,
  grid2dResetBtn,
  grid2dSplitBtn,
  grid2dSelectedReadout,
  grid2dStatusMessageEl,
  grid2dGridWrapperEl,
  grid2dFieldEl,
  grid2dLatticePointsEl,
  grid2dSelectionRectEl,
  grid2dSelectedRegionEl,
  grid2dHoverTooltipEl,
  grid2dLegendEl,
  grid2dAxisLabelsEl,
  grid2dSegmentationCanvasEl,
  viewportEl,
} from './domRefs.js';
import { updateSceneGraph } from './sceneGraphPanel.js';

/**
 * The 2D field is the cube's Front Surface (X/Y only). Pick, refinement, and
 * the shared front-surface measurement all operate on it. The base step matches
 * the 3D visible surface grid interval (10 cm).
 */

/**
 * Refinement stack. With a 10 cm base grid there is a single refinement level
 * (5 cm), so every entry is one rectangular region filled at `MIN_DETAIL_STEP`
 * and regions never nest.
 * @type {{ hMin: number, hMax: number, vMin: number, vMax: number, step: number }[]}
 */
let refinedRegions = [];
let active2dMode = MODE_PICK;
/** @type {{ h: number, v: number } | null} */
let selectedPoint2d = null;
/** @type {{ h: number, v: number, step: number }[]} */
let selectedRegionPoints = [];
/** @type {{ pointA: { x: number, y: number, z: number } | null, pointB: { x: number, y: number, z: number } | null }} */
let lastFrontSurfaceMeasurement = { pointA: null, pointB: null };
let visualTransform = createVisualTransform();
/** @type {{ startX: number, startY: number, currentX: number, currentY: number, pointerId: number } | null} */
let dragSelectState = null;
/** @type {{ startX: number, startY: number, startPanX: number, startPanY: number, pointerId: number } | null} */
let panState = null;
let grid2dPointsVisible = true;

function getActiveViewConfig() {
  return getGrid2dViewConfig();
}

function hideGrid2dHoverTooltip() {
  if (!grid2dHoverTooltipEl) {
    return;
  }

  grid2dHoverTooltipEl.hidden = true;
  hideProjectionLinkingTooltip();
  hideBodyEvidenceOverlayTooltip();
}

function updateGrid2dHoverTooltip(point, clientX, clientY) {
  if (!grid2dHoverTooltipEl || !point) {
    hideGrid2dHoverTooltip();
    return;
  }

  const view = getActiveViewConfig();
  const coordH = formatCoordinate(point.h);
  const coordV = formatCoordinate(point.v);
  grid2dHoverTooltipEl.innerHTML = [
    `${view.hAxis.toUpperCase()}: ${coordH} cm`,
    `${view.vAxis.toUpperCase()}: ${coordV} cm`,
  ].join('<br>');

  const rect = grid2dGridWrapperEl.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  grid2dHoverTooltipEl.hidden = false;
  grid2dHoverTooltipEl.style.visibility = 'hidden';
  grid2dHoverTooltipEl.style.left = '0px';
  grid2dHoverTooltipEl.style.top = '0px';

  const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = grid2dHoverTooltipEl;

  let left = mouseX + HOVER_TOOLTIP_OFFSET;
  let top = mouseY + HOVER_TOOLTIP_OFFSET;

  if (left + tooltipWidth > rect.width) {
    left = mouseX - tooltipWidth - HOVER_TOOLTIP_OFFSET;
  }
  if (top + tooltipHeight > rect.height) {
    top = mouseY - tooltipHeight - HOVER_TOOLTIP_OFFSET;
  }

  left = Math.max(0, Math.min(left, rect.width - tooltipWidth));
  top = Math.max(0, Math.min(top, rect.height - tooltipHeight));

  grid2dHoverTooltipEl.style.left = `${left}px`;
  grid2dHoverTooltipEl.style.top = `${top}px`;
  grid2dHoverTooltipEl.style.visibility = 'visible';
}

function syncGrid2dHoverTooltip(clientX, clientY) {
  if (panState || dragSelectState || !isGrid2dWorkspaceVisible()) {
    hideGrid2dHoverTooltip();
    return;
  }

  // A hovered body evidence marker owns the tooltip; the coordinate readout
  // steps aside instead of competing with it.
  if (isBodyEvidenceMarkerHovered()) {
    grid2dHoverTooltipEl.hidden = true;
    return;
  }

  const point = getPointAtScreenPosition(clientX, clientY);

  if (!point) {
    hideGrid2dHoverTooltip();
    return;
  }

  updateGrid2dHoverTooltip(point, clientX, clientY);
}

function getSelectionHint() {
  return 'No selection';
}

function getBasePoints() {
  return generatePointsForBounds(BASE_DOMAIN, BASE_STEP);
}

function getRefinedPoints() {
  const points = [];

  for (const region of refinedRegions) {
    for (const point of generatePointsForBounds(region, region.step)) {
      points.push({ h: point.h, v: point.v, step: region.step });
    }
  }

  return points;
}

function getAllDisplayPoints() {
  return dedupePoints([...getBasePoints(), ...getRefinedPoints()]);
}

function getFieldInnerSize() {
  const width = Math.max(0, grid2dGridWrapperEl.clientWidth - FIELD_INSET_PX * 2);
  const height = Math.max(0, grid2dGridWrapperEl.clientHeight - FIELD_INSET_PX * 2);
  return { width, height };
}

function getPlotMetrics() {
  return computePlotMetrics(
    grid2dGridWrapperEl.clientWidth,
    grid2dGridWrapperEl.clientHeight,
  );
}

function worldToPlotPx(h, v) {
  return worldToPlotPxShared(h, v, getPlotMetrics(), BASE_DOMAIN);
}

function updatePlotAreaCss() {
  applyPlotAreaCssVars(grid2dFieldEl, getPlotMetrics());
}

function applyVisualZoom() {
  applyVisualZoomTransform(grid2dFieldEl, visualTransform);
}

function resetVisualZoom() {
  visualTransform = createVisualTransform();
  applyVisualZoom();
}

function projectToPercent(h, v) {
  return projectToPercentShared(h, v, getPlotMetrics(), BASE_DOMAIN);
}

function hideActiveRegionSelectionVisuals() {
  grid2dSelectedRegionEl.classList.remove('grid2d-selected-region--active');
  grid2dSelectedRegionEl.hidden = true;
  grid2dSelectionRectEl.hidden = true;
  grid2dSelectionRectEl.style.left = '';
  grid2dSelectionRectEl.style.top = '';
  grid2dSelectionRectEl.style.width = '';
  grid2dSelectionRectEl.style.height = '';
  grid2dGridWrapperEl.classList.remove('grid2d-grid-wrapper--selecting');
}

function clearRegionSelection() {
  selectedRegionPoints = [];
  dragSelectState = null;
  hideActiveRegionSelectionVisuals();
}

function clearPointSelection() {
  selectedPoint2d = null;
}

function isSelected2dPoint(measurementPoint) {
  return Boolean(
    measurementPoint
    && selectedPoint2d
    && selectedPoint2d.h === measurementPoint.x
    && selectedPoint2d.v === measurementPoint.y,
  );
}

/**
 * Drops the 2D selected point when it belongs to a front-surface measurement
 * point that was just cleared (including clears from the main Distance
 * Measurement panel). Returns whether it cleared.
 * @param {({ x: number, y: number } | null)[]} measurementPoints
 */
function clearPointSelectionForClearedMeasurement(measurementPoints) {
  if (!measurementPoints.some((point) => isSelected2dPoint(point))) {
    return false;
  }

  clearPointSelection();
  return true;
}

function isSameMeasurementPoint(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y && a.z === b.z);
}

/**
 * When shared A/B changes (including main-panel clears), drop any 2D pick that
 * was tied to a measurement point that no longer exists.
 */
function syncPointSelectionWithMeasurementChange() {
  const current = getActiveFrontSurfaceMeasurement();
  const clearedPoints = [];

  if (
    lastFrontSurfaceMeasurement.pointA
    && !isSameMeasurementPoint(lastFrontSurfaceMeasurement.pointA, current.pointA)
    && !isSameMeasurementPoint(lastFrontSurfaceMeasurement.pointA, current.pointB)
  ) {
    clearedPoints.push(lastFrontSurfaceMeasurement.pointA);
  }

  if (
    lastFrontSurfaceMeasurement.pointB
    && !isSameMeasurementPoint(lastFrontSurfaceMeasurement.pointB, current.pointA)
    && !isSameMeasurementPoint(lastFrontSurfaceMeasurement.pointB, current.pointB)
  ) {
    clearedPoints.push(lastFrontSurfaceMeasurement.pointB);
  }

  if (clearedPoints.length) {
    clearPointSelectionForClearedMeasurement(clearedPoints);
  }

  lastFrontSurfaceMeasurement = {
    pointA: current.pointA,
    pointB: current.pointB,
  };
}

function clearAllSelection() {
  clearRegionSelection();
  clearPointSelection();
}

function hideStatusMessage() {
  grid2dStatusMessageEl.hidden = true;
  grid2dStatusMessageEl.textContent = '';
}

function showStatusMessage(message) {
  grid2dStatusMessageEl.textContent = message;
  grid2dStatusMessageEl.hidden = false;
}

function getWrapperLocalPoint(clientX, clientY) {
  return getWrapperLocalPointShared(grid2dGridWrapperEl, clientX, clientY);
}

function getScreenPointForWorld(h, v) {
  return getScreenPointForWorldShared(
    grid2dGridWrapperEl,
    h,
    v,
    getPlotMetrics(),
    visualTransform,
    BASE_DOMAIN,
  );
}

function getPointAtScreenPosition(clientX, clientY) {
  return findNearestDisplayPoint({
    clientX,
    clientY,
    points: getAllDisplayPoints(),
    wrapperEl: grid2dGridWrapperEl,
    metrics: getPlotMetrics(),
    visualTransform,
    domain: BASE_DOMAIN,
  });
}

function getPointsInsideSelectionRect() {
  return getPointsInsideSelectionRectShared({
    dragSelectState,
    wrapperEl: grid2dGridWrapperEl,
    points: getAllDisplayPoints(),
    metrics: getPlotMetrics(),
    visualTransform,
    domain: BASE_DOMAIN,
  });
}

function updateSelectionRectUI() {
  if (!dragSelectState || active2dMode !== MODE_REGION) {
    grid2dSelectionRectEl.hidden = true;
    return;
  }

  const start = getWrapperLocalPoint(dragSelectState.startX, dragSelectState.startY);
  const end = getWrapperLocalPoint(dragSelectState.currentX, dragSelectState.currentY);
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (width < MIN_DRAG_PX && height < MIN_DRAG_PX) {
    grid2dSelectionRectEl.hidden = true;
    return;
  }

  grid2dSelectionRectEl.hidden = false;
  grid2dSelectionRectEl.style.left = `${left}px`;
  grid2dSelectionRectEl.style.top = `${top}px`;
  grid2dSelectionRectEl.style.width = `${width}px`;
  grid2dSelectionRectEl.style.height = `${height}px`;
}

function renderSelectedRegionOutline() {
  const hasActiveRegionSelection = (
    active2dMode === MODE_REGION
    && selectedRegionPoints.length > 0
  );
  const selectionBounds = hasActiveRegionSelection
    ? getSelectionBounds(selectedRegionPoints)
    : null;

  if (!selectionBounds) {
    hideActiveRegionSelectionVisuals();
    return;
  }

  const topLeft = projectToPercent(selectionBounds.hMin, selectionBounds.vMax);
  const bottomRight = projectToPercent(selectionBounds.hMax, selectionBounds.vMin);
  const left = parseFloat(topLeft.left);
  const top = parseFloat(topLeft.top);
  const right = parseFloat(bottomRight.left);
  const bottom = parseFloat(bottomRight.top);

  grid2dSelectedRegionEl.style.left = `${left}%`;
  grid2dSelectedRegionEl.style.top = `${top}%`;
  grid2dSelectedRegionEl.style.width = `${Math.max(0, right - left)}%`;
  grid2dSelectedRegionEl.style.height = `${Math.max(0, bottom - top)}%`;
  grid2dSelectedRegionEl.hidden = false;
  grid2dSelectedRegionEl.classList.add('grid2d-selected-region--active');
}

function finalizeDragSelection() {
  if (!dragSelectState || active2dMode !== MODE_REGION) {
    dragSelectState = null;
    grid2dSelectionRectEl.hidden = true;
    return;
  }

  const dx = Math.abs(dragSelectState.currentX - dragSelectState.startX);
  const dy = Math.abs(dragSelectState.currentY - dragSelectState.startY);

  if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) {
    dragSelectState = null;
    grid2dSelectionRectEl.hidden = true;
    return;
  }

  selectedRegionPoints = getPointsInsideSelectionRect();
  clearPointSelection();
  dragSelectState = null;
  grid2dSelectionRectEl.hidden = true;
  refreshGrid2dNavigator();
}

let activeSelectionHighlight = null;

function finalizePickSelection(clientX, clientY) {
  const point = getPointAtScreenPosition(clientX, clientY);

  if (!point) {
    return;
  }

  selectedPoint2d = { h: point.h, v: point.v };
  clearRegionSelection();
  hideStatusMessage();

  if (isAnnotateMode()) {
    const point3d = frontSurfaceTo3d(point);
    selectPoint(point3d.x, point3d.y, point3d.z, activeSelectionHighlight);
  } else if (!advanceFrontSurfaceMeasurement(point)) {
    showStatusMessage('Switch to Inspect & Measure to measure.');
  }

  refreshGrid2dNavigator();
}

function updateModeUI() {
  const isPick = active2dMode === MODE_PICK;

  grid2dGridWrapperEl.classList.toggle('grid2d-grid-wrapper--pick', isPick);
  grid2dGridWrapperEl.classList.toggle('grid2d-grid-wrapper--region', !isPick);
}

function isGrid2dWorkspaceVisible() {
  const mode = viewportEl.dataset.workspaceMode;
  return mode === '2d' || mode === 'split';
}

function isTypingTarget(target) {
  return isTypingTargetShared(target);
}

function toggleActive2dMode() {
  setActive2dMode(active2dMode === MODE_PICK ? MODE_REGION : MODE_PICK);
}

function updateLegend() {
  if (!grid2dLegendEl) {
    return;
  }

  const measurement = getActiveFrontSurfaceMeasurement();
  const refVisible = getProjectedReferenceMarkersVisible();
  const annotationsVisible = getProjectedAnnotationsVisible();
  const hasSessionAnnotations = getAnnotations().length > 0;

  const show = {
    lattice: Boolean(grid2dPointsVisible),
    selected: Boolean(selectedPoint2d || selectedRegionPoints.length > 0),
    'measure-a': Boolean(measurement.pointA),
    'measure-b': Boolean(measurement.pointB),
    ref: Boolean(refVisible),
    annotation: Boolean(annotationsVisible && hasSessionAnnotations),
  };

  for (const item of grid2dLegendEl.querySelectorAll('[data-legend-type]')) {
    const type = item.dataset.legendType;
    item.hidden = !show[type];
  }
}

/**
 * Classifies the current region selection into a split decision. Refinement is
 * a single pass: a 10 cm selection can be filled once at 5 cm, and a selection
 * that already touches a refined region cannot be refined again.
 * @returns {{ canSplit: boolean, message: string | null,
 *   action: { step: number, bounds: object } | null }}
 */
function classifySplitSelection() {
  return classifySplitSelectionShared({
    activeMode: active2dMode,
    selectedRegionPoints,
    refinedRegions,
    detailStep: MIN_DETAIL_STEP,
  });
}

function updateChrome() {
  const view = getActiveViewConfig();
  renderProjectionMarkers({ projectToPercent });
  renderBodyEvidenceOverlay2d({ projectToPercent });
  renderFrontSegmentationOverlay(grid2dSegmentationCanvasEl);
  renderBodyMeasurementPreview2d({ worldToPlotPx });
  const selectionBounds = getSelectionBounds(selectedRegionPoints);
  const split = classifySplitSelection();
  const selectionBlock = grid2dSelectedReadout.closest('.grid2d-selection-block');

  const refinementStatusEl = document.getElementById('grid2d-refinement-status');
  if (refinementStatusEl) {
    refinementStatusEl.textContent = formatGridStateLabel(refinedRegions.length);
  }

  grid2dBackBtn.disabled = refinedRegions.length === 0;
  grid2dSplitBtn.disabled = !split.canSplit;

  let hasSelectionDetails = false;

  if (active2dMode === MODE_PICK) {
    if (selectedPoint2d) {
      grid2dSelectedReadout.innerHTML = [
        formatAxisReadout(view.hAxis, selectedPoint2d.h),
        formatAxisReadout(view.vAxis, selectedPoint2d.v),
      ].join('<br>');
      grid2dSelectedReadout.classList.remove('grid2d-selected-readout--empty');
      hasSelectionDetails = true;
    } else {
      grid2dSelectedReadout.textContent = getSelectionHint();
      grid2dSelectedReadout.classList.add('grid2d-selected-readout--empty');
    }
  } else if (selectedRegionPoints.length > 0 && selectionBounds) {
    grid2dSelectedReadout.innerHTML = [
      `Selected points: ${selectedRegionPoints.length}`,
      `${view.hAxis.toUpperCase()}: ${formatRangeValue(selectionBounds.hMin)}–${formatRangeValue(selectionBounds.hMax)} cm`,
      `${view.vAxis.toUpperCase()}: ${formatRangeValue(selectionBounds.vMin)}–${formatRangeValue(selectionBounds.vMax)} cm`,
    ].join('<br>');
    grid2dSelectedReadout.classList.remove('grid2d-selected-readout--empty');
    hasSelectionDetails = true;

    if (split.message) {
      showStatusMessage(split.message);
    } else {
      hideStatusMessage();
    }
  } else {
    grid2dSelectedReadout.textContent = getSelectionHint();
    grid2dSelectedReadout.classList.add('grid2d-selected-readout--empty');
    hideStatusMessage();
  }

  if (selectionBlock) {
    selectionBlock.classList.toggle('grid2d-selection-block--empty', !hasSelectionDetails);
  }

  updateModeUI();
  updateLegend();
  updateSceneGraph();
}

function renderAxisLabels() {
  const view = getActiveViewConfig();

  renderPlotAxisLabels(grid2dAxisLabelsEl, {
    hAxis: view.hAxis,
    vAxis: view.vAxis,
    maxLabel: `${ROOM_SIZE}`,
  });
}

function renderLatticePoints() {
  grid2dLatticePointsEl.replaceChildren();
  grid2dLatticePointsEl.hidden = !grid2dPointsVisible;

  if (!grid2dPointsVisible) {
    return;
  }

  const points = getAllDisplayPoints();
  updateLatticeStepLookup(points);
  const fragment = document.createDocumentFragment();
  const measurement = getActiveFrontSurfaceMeasurement();

  for (const point of points) {
    const el = document.createElement('div');
    el.className = 'grid2d-lattice-point';
    el.dataset.h = String(point.h);
    el.dataset.v = String(point.v);
    el.dataset.step = String(point.step);

    if (point.step < BASE_STEP) {
      el.classList.add('grid2d-lattice-point--refined');
    }

    if (point.step === MIN_DETAIL_STEP) {
      el.classList.add('grid2d-lattice-point--fine');
    }

    const isRegionSelected = (
      active2dMode === MODE_REGION
      && selectedRegionPoints.length > 0
      && selectedRegionPoints.some(
        (selected) => selected.h === point.h && selected.v === point.v,
      )
    );
    const isPointSelected = selectedPoint2d
      && selectedPoint2d.h === point.h
      && selectedPoint2d.v === point.v;
    const isMeasureA = isOnFrontSurface(measurement.pointA)
      && measurement.pointA.x === point.h
      && measurement.pointA.y === point.v;
    const isMeasureB = isOnFrontSurface(measurement.pointB)
      && measurement.pointB.x === point.h
      && measurement.pointB.y === point.v;

    if (isRegionSelected) {
      el.classList.add('grid2d-lattice-point--selected');
    }

    if (isPointSelected) {
      el.classList.add('grid2d-lattice-point--picked');
    }

    if (isMeasureA) {
      el.classList.add('grid2d-lattice-point--measure-a');
    }

    if (isMeasureB) {
      el.classList.add('grid2d-lattice-point--measure-b');
    }

    const pos = projectToPercent(point.h, point.v);
    el.style.left = pos.left;
    el.style.top = pos.top;
    const basePx = getLatticeBaseSizePxForStep(point.step);
    if (isMeasureA || isMeasureB) {
      applyMarkerSizeStyle(el, basePx, { emphasisMultiplier: MEASURE_EMPHASIS_MULTIPLIER });
    } else {
      applyMarkerSizeStyle(el, basePx);
    }

    fragment.appendChild(el);
  }

  grid2dLatticePointsEl.appendChild(fragment);
}

function appendFrontSurfaceMarker(point, variant) {
  const marker = document.createElement('div');
  marker.className = `grid2d-measure-marker grid2d-measure-marker--${variant}`;

  if (!isOnFrontSurface(point)) {
    marker.classList.add('grid2d-measure-marker--off-surface');
  }

  const pos = projectToPercent(point.x, point.y);
  marker.style.left = pos.left;
  marker.style.top = pos.top;
  applyMeasureMarkerSizeStyle(marker, point.x, point.y);
  grid2dFieldEl.appendChild(marker);
}

/**
 * Draws the shared measurement on the front surface. Points created by 3D
 * clicks off the front face are shown dimmed at their X/Y position so the 2D
 * and 3D readouts never disagree.
 */
function renderFrontSurfaceMeasurementOverlay() {
  const previous = grid2dFieldEl.querySelectorAll(
    '.grid2d-measure-marker, .grid2d-measure-line, .grid2d-measure-label',
  );
  previous.forEach((node) => node.remove());

  const measurement = getActiveFrontSurfaceMeasurement();
  const showLines = getMeasurement3dLinesVisible();

  if (measurement.pointA) {
    appendFrontSurfaceMarker(measurement.pointA, 'a');
  }

  if (measurement.pointB) {
    appendFrontSurfaceMarker(measurement.pointB, 'b');
  }

  if (showLines && measurement.pointA && measurement.pointB) {
    const a = worldToPlotPx(measurement.pointA.x, measurement.pointA.y);
    const b = worldToPlotPx(measurement.pointB.x, measurement.pointB.y);
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const length = Math.hypot(dx, dy);
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    const line = document.createElement('div');
    line.className = 'grid2d-measure-line';
    line.style.left = `${a.px}px`;
    line.style.top = `${a.py}px`;
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angleDeg}deg)`;
    grid2dFieldEl.appendChild(line);

    const label = document.createElement('div');
    label.className = 'grid2d-measure-label';
    label.textContent = `${formatDistance(measurement.distanceCm)} cm`;
    label.title = [
      `A: ${formatFrontSurfacePointCoords(measurement.pointA)}`,
      `B: ${formatFrontSurfacePointCoords(measurement.pointB)}`,
    ].join('\n');
    label.style.left = `${(a.px + b.px) / 2}px`;
    label.style.top = `${(a.py + b.py) / 2}px`;
    grid2dFieldEl.appendChild(label);
  }
}

export function isGrid2dPointsVisible() {
  return grid2dPointsVisible;
}

export function setGrid2dPointsVisible(visible) {
  grid2dPointsVisible = Boolean(visible);
  refreshGrid2dNavigator();
}

export function refreshGrid2dNavigator() {
  if (!grid2dGridWrapperEl || !grid2dFieldEl) {
    return;
  }

  syncPointSelectionWithMeasurementChange();

  if (selectedPoint2d && !isInDomain(selectedPoint2d.h, selectedPoint2d.v)) {
    clearPointSelection();
  }

  selectedRegionPoints = selectedRegionPoints.filter(
    (point) => isInDomain(point.h, point.v),
  );

  updateLatticeStepLookup(getAllDisplayPoints());
  updatePlotAreaCss();
  renderAxisLabels();
  renderLatticePoints();
  renderFrontSurfaceMeasurementOverlay();
  renderSelectedRegionOutline();
  updateChrome();

  if (!isGrid2dWorkspaceVisible()) {
    hideGrid2dHoverTooltip();
  }
}

export function hideGrid2dHoverCoordinateTooltip() {
  hideGrid2dHoverTooltip();
}

function splitSelectedRegion() {
  const { canSplit, action } = classifySplitSelection();

  if (!canSplit || !action) {
    return;
  }

  refinedRegions.push({
    step: action.step,
    ...cloneBounds(action.bounds),
  });

  clearRegionSelection();
  hideStatusMessage();
  grid2dSplitBtn.disabled = true;
  refreshGrid2dNavigator();
}

function undoLastRefinement() {
  if (!refinedRegions.length) {
    return;
  }

  refinedRegions.pop();
  clearRegionSelection();
  hideStatusMessage();
  refreshGrid2dNavigator();
}

function reset2dNavigator() {
  refinedRegions = [];
  clearAllSelection();
  resetVisualZoom();
  hideStatusMessage();
  refreshGrid2dNavigator();
}

function setActive2dMode(mode) {
  if (mode !== MODE_PICK && mode !== MODE_REGION) {
    return;
  }

  if (mode === active2dMode) {
    return;
  }

  active2dMode = mode;
  dragSelectState = null;
  grid2dSelectionRectEl.hidden = true;

  if (mode === MODE_PICK) {
    clearRegionSelection();
  } else {
    clearPointSelection();
  }

  hideStatusMessage();
  refreshGrid2dNavigator();
}

function clampPanForZoomLocal() {
  const { width, height } = getFieldInnerSize();
  clampPanForZoom(visualTransform, width, height);
}

function handleWheelZoom(event) {
  event.preventDefault();

  const local = getWrapperLocalPoint(event.clientX, event.clientY);
  const fieldX = local.x - FIELD_INSET_PX;
  const fieldY = local.y - FIELD_INSET_PX;
  const { width, height } = getFieldInnerSize();
  const { changed } = applyWheelZoom(visualTransform, {
    fieldX,
    fieldY,
    width,
    height,
    zoomIn: event.deltaY < 0,
  });

  if (!changed) {
    return;
  }

  applyVisualZoom();
}

function setupPointerInteraction() {
  grid2dGridWrapperEl.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      event.preventDefault();
      hideGrid2dHoverTooltip();
      panState = {
        startX: event.clientX,
        startY: event.clientY,
        startPanX: visualTransform.panX,
        startPanY: visualTransform.panY,
        pointerId: event.pointerId,
      };
      grid2dGridWrapperEl.setPointerCapture(event.pointerId);
      grid2dGridWrapperEl.classList.add('grid2d-grid-wrapper--panning');
      return;
    }

    if (event.button !== 0) {
      return;
    }

    hideGrid2dHoverTooltip();
    grid2dGridWrapperEl.focus({ preventScroll: true });

    if (active2dMode === MODE_REGION) {
      dragSelectState = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        pointerId: event.pointerId,
      };
      grid2dGridWrapperEl.setPointerCapture(event.pointerId);
      grid2dGridWrapperEl.classList.add('grid2d-grid-wrapper--selecting');
      updateSelectionRectUI();
      return;
    }

    dragSelectState = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      pointerId: event.pointerId,
    };
    grid2dGridWrapperEl.setPointerCapture(event.pointerId);
  });

  grid2dGridWrapperEl.addEventListener('pointermove', (event) => {
    if (panState && event.pointerId === panState.pointerId) {
      visualTransform.panX = panState.startPanX + (event.clientX - panState.startX);
      visualTransform.panY = panState.startPanY + (event.clientY - panState.startY);
      clampPanForZoomLocal();
      applyVisualZoom();
      hideGrid2dHoverTooltip();
      return;
    }

    if (dragSelectState && event.pointerId === dragSelectState.pointerId) {
      dragSelectState.currentX = event.clientX;
      dragSelectState.currentY = event.clientY;

      if (active2dMode === MODE_REGION) {
        updateSelectionRectUI();
      }

      hideGrid2dHoverTooltip();
      return;
    }

    syncGrid2dHoverTooltip(event.clientX, event.clientY);
  });

  const endPointerInteraction = (event) => {
    if (panState && event.pointerId === panState.pointerId) {
      panState = null;
      grid2dGridWrapperEl.classList.remove('grid2d-grid-wrapper--panning');
      if (grid2dGridWrapperEl.hasPointerCapture(event.pointerId)) {
        grid2dGridWrapperEl.releasePointerCapture(event.pointerId);
      }
      syncGrid2dHoverTooltip(event.clientX, event.clientY);
      return;
    }

    if (dragSelectState && event.pointerId === dragSelectState.pointerId) {
      if (active2dMode === MODE_REGION) {
        finalizeDragSelection();
        grid2dGridWrapperEl.classList.remove('grid2d-grid-wrapper--selecting');
      } else {
        const dx = Math.abs(dragSelectState.currentX - dragSelectState.startX);
        const dy = Math.abs(dragSelectState.currentY - dragSelectState.startY);

        if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) {
          finalizePickSelection(event.clientX, event.clientY);
        }
      }

      dragSelectState = null;

      if (grid2dGridWrapperEl.hasPointerCapture(event.pointerId)) {
        grid2dGridWrapperEl.releasePointerCapture(event.pointerId);
      }

      syncGrid2dHoverTooltip(event.clientX, event.clientY);
    }
  };

  grid2dGridWrapperEl.addEventListener('pointerup', endPointerInteraction);
  grid2dGridWrapperEl.addEventListener('pointercancel', endPointerInteraction);

  grid2dGridWrapperEl.addEventListener('pointerleave', () => {
    if (panState || dragSelectState) {
      return;
    }

    hideGrid2dHoverTooltip();
  });

  grid2dGridWrapperEl.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  grid2dGridWrapperEl.addEventListener('wheel', handleWheelZoom, { passive: false });
}

function setupModeKeyboardToggle() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Control' || event.altKey || event.metaKey) {
      return;
    }

    if (!isGrid2dWorkspaceVisible()) {
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (!grid2dGridWrapperEl.contains(document.activeElement)
      && document.activeElement !== grid2dGridWrapperEl) {
      return;
    }

    if (event.repeat) {
      return;
    }

    event.preventDefault();
    toggleActive2dMode();
  });
}

export function setupGrid2dNavigator(selectionHighlight = null) {
  activeSelectionHighlight = selectionHighlight;

  grid2dBackBtn.addEventListener('click', () => {
    undoLastRefinement();
  });

  grid2dResetBtn.addEventListener('click', () => {
    reset2dNavigator();
  });

  const preventGridPointerBleed = (event) => {
    event.stopPropagation();

    if (grid2dGridWrapperEl.hasPointerCapture(event.pointerId)) {
      grid2dGridWrapperEl.releasePointerCapture(event.pointerId);
    }

    dragSelectState = null;
    grid2dSelectionRectEl.hidden = true;
    grid2dGridWrapperEl.classList.remove('grid2d-grid-wrapper--selecting');
  };

  for (const actionBtn of [
    grid2dBackBtn,
    grid2dResetBtn,
    grid2dSplitBtn,
  ]) {
    actionBtn.addEventListener('pointerdown', preventGridPointerBleed);
  }

  grid2dSplitBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    splitSelectedRegion();
  });

  grid2dGridWrapperEl.setAttribute('tabindex', '0');

  setupPointerInteraction();
  setupModeKeyboardToggle();
  subscribeSelectionChange((point) => {
    if (!point) {
      if (selectedPoint2d) {
        clearPointSelection();
        refreshGrid2dNavigator();
      }
    } else if (isOnFrontSurface(point)) {
      selectedPoint2d = { h: point.x, v: point.y };
      refreshGrid2dNavigator();
    } else if (selectedPoint2d) {
      clearPointSelection();
      refreshGrid2dNavigator();
    }
  });
  resetVisualZoom();
  setupSegmentationOverlay2d(refreshGrid2dNavigator, null);
  refreshGrid2dNavigator();
}

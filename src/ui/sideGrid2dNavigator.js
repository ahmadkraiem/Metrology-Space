/**
 * Side Evidence Grid Navigator (v0)
 *
 * Interaction parity with Front Grid Navigator; semantic separation preserved:
 * U/Y evidence plane only — no canonical Z, promotion, shared A/B, Body Graph,
 * or Scene State export of Side-local navigator state.
 */

import { HOVER_TOOLTIP_OFFSET, ROOM_SIZE } from '../core/constants.js';
import { formatCoordinate, formatDistance } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  clearSideEvidenceSelection,
  getBodyEvidenceQa,
  getSelectedSideEvidenceLandmark,
  hasAnalyzedBodyEvidence,
  hasSidePoseSource,
  isSideCoreBodyEvidenceVisible,
  isSideSecondaryBodyEvidenceVisible,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { isInspectMeasureMode } from '../features/appMode.js';
import {
  WORKFLOW_MEASUREMENT,
  getInspectorWorkflow,
} from './inspectorWorkflowState.js';
import {
  advanceSideMeasurement,
  clearSideMeasurement,
  getActiveSideMeasurement,
  subscribeSideMeasurementChange,
} from '../features/sideMeasurement.js';
import {
  hideSideEvidenceTooltip,
  isSideEvidenceMarkerHovered,
  renderSideBodyEvidenceOverlay,
  setupBodyEvidenceOverlaySide2d,
} from './bodyEvidenceOverlaySide2d.js';
import {
  renderSideSegmentationOverlay,
  setupSegmentationOverlay2d,
} from './segmentationOverlay2d.js';
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
  formatRangeValue,
  generatePointsForBounds,
  getPointsInsideSelectionRect as getPointsInsideSelectionRectShared,
  getSelectionBounds,
  getWrapperLocalPoint as getWrapperLocalPointShared,
  isInDomain,
  isTypingTarget,
  projectToPercent as projectToPercentShared,
  worldToPlotPx as worldToPlotPxShared,
} from './grid2dNavShared.js';
import {
  applyMarkerSizeStyle,
  applyMeasureMarkerSizeStyle,
  getLatticeBaseSizePxForStep,
  MEASURE_EMPHASIS_MULTIPLIER,
  updateLatticeStepLookup,
} from './grid2dMarkerSizing.js';
import { formatSideEvidenceStatus } from './sideEvidenceStatus.js';
import {
  sideGridBackBtn,
  sideGridResetBtn,
  sideGridSplitBtn,
  sideEvidenceAxisLabelsEl,
  sideEvidenceFieldEl,
  sideEvidenceHoverTooltipEl,
  sideEvidenceInspectEl,
  sideEvidenceLatticePointsEl,
  sideEvidenceLegendEl,
  sideEvidenceModeReadoutEl,
  sideEvidenceSelectedRegionEl,
  sideEvidenceSelectionRectEl,
  sideEvidenceSourceStatusEl,
  sideEvidenceStatusMessageEl,
  sideEvidenceViewReadoutEl,
  sideEvidenceViewportEl,
  sideSegmentationCanvasEl,
  viewportEl,
} from './domRefs.js';

const SIDE_H_AXIS = 'u';
const SIDE_V_AXIS = 'y';

/** @type {{ hMin: number, hMax: number, vMin: number, vMax: number, step: number }[]} */
let refinedRegions = [];
let active2dMode = MODE_PICK;
/** @type {{ h: number, v: number } | null} */
let selectedPoint2d = null;
/** @type {{ h: number, v: number, step: number }[]} */
let selectedRegionPoints = [];
let visualTransform = createVisualTransform();
/** @type {{ startX: number, startY: number, currentX: number, currentY: number, pointerId: number } | null} */
let dragSelectState = null;
/** @type {{ startX: number, startY: number, startPanX: number, startPanY: number, pointerId: number } | null} */
let panState = null;
let sideGridPointsVisible = true;

function getSelectionHint() {
  return 'Click a point or drag a region';
}

function updateSideEvidenceStatus() {
  if (!sideEvidenceSourceStatusEl) {
    return;
  }

  const qa = getBodyEvidenceQa()?.qa ?? {};
  sideEvidenceSourceStatusEl.textContent = formatSideEvidenceStatus({
    sidePoseLoaded: hasSidePoseSource(),
    analyzed: hasAnalyzedBodyEvidence(),
    coreCount: qa.sideCoreLandmarks ?? 0,
    secondaryCount: qa.sideSecondaryLandmarks ?? 0,
  });
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
  const width = Math.max(0, sideEvidenceViewportEl.clientWidth - FIELD_INSET_PX * 2);
  const height = Math.max(0, sideEvidenceViewportEl.clientHeight - FIELD_INSET_PX * 2);
  return { width, height };
}

function getPlotMetrics() {
  return computePlotMetrics(
    sideEvidenceViewportEl.clientWidth,
    sideEvidenceViewportEl.clientHeight,
  );
}

function worldToPlotPx(h, v) {
  return worldToPlotPxShared(h, v, getPlotMetrics(), BASE_DOMAIN);
}

function updatePlotAreaCss() {
  applyPlotAreaCssVars(sideEvidenceFieldEl, getPlotMetrics());
}

function applyVisualZoom() {
  applyVisualZoomTransform(sideEvidenceFieldEl, visualTransform);
}

function resetVisualZoom() {
  visualTransform = createVisualTransform();
  applyVisualZoom();
}

function projectToPercent(h, v) {
  return projectToPercentShared(h, v, getPlotMetrics(), BASE_DOMAIN);
}

function hideActiveRegionSelectionVisuals() {
  sideEvidenceSelectedRegionEl?.classList.remove('grid2d-selected-region--active');
  if (sideEvidenceSelectedRegionEl) {
    sideEvidenceSelectedRegionEl.hidden = true;
  }
  if (sideEvidenceSelectionRectEl) {
    sideEvidenceSelectionRectEl.hidden = true;
    sideEvidenceSelectionRectEl.style.left = '';
    sideEvidenceSelectionRectEl.style.top = '';
    sideEvidenceSelectionRectEl.style.width = '';
    sideEvidenceSelectionRectEl.style.height = '';
  }
  sideEvidenceViewportEl?.classList.remove('grid2d-grid-wrapper--selecting');
}

function clearRegionSelection() {
  selectedRegionPoints = [];
  dragSelectState = null;
  hideActiveRegionSelectionVisuals();
}

function clearPointSelection() {
  selectedPoint2d = null;
}

function clearAllSelection() {
  clearRegionSelection();
  clearPointSelection();
}

let lastSideMeasurement = { pointA: null, pointB: null };

function isSelectedSidePoint(measurementPoint) {
  return Boolean(
    measurementPoint
    && selectedPoint2d
    && selectedPoint2d.h === measurementPoint.u
    && selectedPoint2d.v === measurementPoint.y,
  );
}

function clearPointSelectionForClearedMeasurement(measurementPoints) {
  if (!measurementPoints.some((point) => isSelectedSidePoint(point))) {
    return false;
  }

  clearPointSelection();
  return true;
}

function isSameSideMeasurementPoint(a, b) {
  return Boolean(a && b && a.u === b.u && a.y === b.y);
}

function syncPointSelectionWithMeasurementChange() {
  const current = getActiveSideMeasurement();
  const clearedPoints = [];

  if (
    lastSideMeasurement.pointA
    && !isSameSideMeasurementPoint(lastSideMeasurement.pointA, current.pointA)
    && !isSameSideMeasurementPoint(lastSideMeasurement.pointA, current.pointB)
  ) {
    clearedPoints.push(lastSideMeasurement.pointA);
  }

  if (
    lastSideMeasurement.pointB
    && !isSameSideMeasurementPoint(lastSideMeasurement.pointB, current.pointA)
    && !isSameSideMeasurementPoint(lastSideMeasurement.pointB, current.pointB)
  ) {
    clearedPoints.push(lastSideMeasurement.pointB);
  }

  if (clearedPoints.length) {
    clearPointSelectionForClearedMeasurement(clearedPoints);
  }

  lastSideMeasurement = {
    pointA: current.pointA,
    pointB: current.pointB,
  };
}

function hideStatusMessage() {
  if (!sideEvidenceStatusMessageEl) {
    return;
  }
  sideEvidenceStatusMessageEl.hidden = true;
  sideEvidenceStatusMessageEl.textContent = '';
}

function showStatusMessage(message) {
  if (!sideEvidenceStatusMessageEl) {
    return;
  }
  sideEvidenceStatusMessageEl.textContent = message;
  sideEvidenceStatusMessageEl.hidden = false;
}

function getWrapperLocalPoint(clientX, clientY) {
  return getWrapperLocalPointShared(sideEvidenceViewportEl, clientX, clientY);
}

function getPointAtScreenPosition(clientX, clientY) {
  return findNearestDisplayPoint({
    clientX,
    clientY,
    points: getAllDisplayPoints(),
    wrapperEl: sideEvidenceViewportEl,
    metrics: getPlotMetrics(),
    visualTransform,
    domain: BASE_DOMAIN,
  });
}

function getPointsInsideSelectionRect() {
  return getPointsInsideSelectionRectShared({
    dragSelectState,
    wrapperEl: sideEvidenceViewportEl,
    points: getAllDisplayPoints(),
    metrics: getPlotMetrics(),
    visualTransform,
    domain: BASE_DOMAIN,
  });
}

function hideSideHoverTooltip() {
  if (sideEvidenceHoverTooltipEl) {
    sideEvidenceHoverTooltipEl.hidden = true;
  }
  hideSideEvidenceTooltip();
}

function updateSideHoverTooltip(point, clientX, clientY) {
  if (!sideEvidenceHoverTooltipEl || !point) {
    hideSideHoverTooltip();
    return;
  }

  sideEvidenceHoverTooltipEl.innerHTML = [
    `U: ${formatCoordinate(point.h)} cm`,
    `Y: ${formatCoordinate(point.v)} cm`,
  ].join('<br>');

  const rect = sideEvidenceViewportEl.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  sideEvidenceHoverTooltipEl.hidden = false;
  sideEvidenceHoverTooltipEl.style.visibility = 'hidden';
  sideEvidenceHoverTooltipEl.style.left = '0px';
  sideEvidenceHoverTooltipEl.style.top = '0px';

  const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = sideEvidenceHoverTooltipEl;

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

  sideEvidenceHoverTooltipEl.style.left = `${left}px`;
  sideEvidenceHoverTooltipEl.style.top = `${top}px`;
  sideEvidenceHoverTooltipEl.style.visibility = 'visible';
}

function isSideWorkspaceVisible() {
  const mode = viewportEl?.dataset.workspaceMode;
  return mode === '2d' || mode === 'split';
}

function syncSideHoverTooltip(clientX, clientY) {
  if (panState || dragSelectState || !isSideWorkspaceVisible()) {
    hideSideHoverTooltip();
    return;
  }

  if (isSideEvidenceMarkerHovered()) {
    if (sideEvidenceHoverTooltipEl) {
      sideEvidenceHoverTooltipEl.hidden = true;
    }
    return;
  }

  const point = getPointAtScreenPosition(clientX, clientY);
  if (!point) {
    hideSideHoverTooltip();
    return;
  }

  updateSideHoverTooltip(point, clientX, clientY);
}

function updateSelectionRectUI() {
  if (!sideEvidenceSelectionRectEl || !dragSelectState || active2dMode !== MODE_REGION) {
    if (sideEvidenceSelectionRectEl) {
      sideEvidenceSelectionRectEl.hidden = true;
    }
    return;
  }

  const start = getWrapperLocalPoint(dragSelectState.startX, dragSelectState.startY);
  const end = getWrapperLocalPoint(dragSelectState.currentX, dragSelectState.currentY);
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (width < MIN_DRAG_PX && height < MIN_DRAG_PX) {
    sideEvidenceSelectionRectEl.hidden = true;
    return;
  }

  sideEvidenceSelectionRectEl.hidden = false;
  sideEvidenceSelectionRectEl.style.left = `${left}px`;
  sideEvidenceSelectionRectEl.style.top = `${top}px`;
  sideEvidenceSelectionRectEl.style.width = `${width}px`;
  sideEvidenceSelectionRectEl.style.height = `${height}px`;
}

function renderSelectedRegionOutline() {
  if (!sideEvidenceSelectedRegionEl) {
    return;
  }

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

  sideEvidenceSelectedRegionEl.style.left = `${left}%`;
  sideEvidenceSelectedRegionEl.style.top = `${top}%`;
  sideEvidenceSelectedRegionEl.style.width = `${Math.max(0, right - left)}%`;
  sideEvidenceSelectedRegionEl.style.height = `${Math.max(0, bottom - top)}%`;
  sideEvidenceSelectedRegionEl.hidden = false;
  sideEvidenceSelectedRegionEl.classList.add('grid2d-selected-region--active');
}

function finalizeDragSelection() {
  if (!dragSelectState || active2dMode !== MODE_REGION) {
    dragSelectState = null;
    if (sideEvidenceSelectionRectEl) {
      sideEvidenceSelectionRectEl.hidden = true;
    }
    return;
  }

  const dx = Math.abs(dragSelectState.currentX - dragSelectState.startX);
  const dy = Math.abs(dragSelectState.currentY - dragSelectState.startY);

  if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) {
    dragSelectState = null;
    sideEvidenceSelectionRectEl.hidden = true;
    return;
  }

  selectedRegionPoints = getPointsInsideSelectionRect();
  clearPointSelection();
  clearSideEvidenceSelection();
  dragSelectState = null;
  sideEvidenceSelectionRectEl.hidden = true;
  refreshSideGrid2dNavigator();
}

function finalizePickSelection(clientX, clientY) {
  const point = getPointAtScreenPosition(clientX, clientY);

  if (!point) {
    return;
  }

  selectedPoint2d = { h: point.h, v: point.v };
  clearRegionSelection();
  clearSideEvidenceSelection();
  hideStatusMessage();

  if (isInspectMeasureMode() && getInspectorWorkflow() === WORKFLOW_MEASUREMENT) {
    advanceSideMeasurement({ u: point.h, y: point.v });
  } else {
    showStatusMessage('Switch to Inspect & Measure to measure.');
  }

  refreshSideGrid2dNavigator();
}

function updateModeUI() {
  const isPick = active2dMode === MODE_PICK;

  sideEvidenceViewportEl?.classList.toggle('grid2d-grid-wrapper--pick', isPick);
  sideEvidenceViewportEl?.classList.toggle('grid2d-grid-wrapper--region', !isPick);

  if (sideEvidenceModeReadoutEl) {
    sideEvidenceModeReadoutEl.textContent = `Mode: ${isPick ? 'Pick Point' : 'Select Region'}`;
  }
}

function classifySplitSelection() {
  return classifySplitSelectionShared({
    activeMode: active2dMode,
    selectedRegionPoints,
    refinedRegions,
    detailStep: MIN_DETAIL_STEP,
  });
}

function updateLegend() {
  if (!sideEvidenceLegendEl) {
    return;
  }

  const measurement = getActiveSideMeasurement();
  const show = {
    lattice: Boolean(sideGridPointsVisible),
    selected: Boolean(selectedPoint2d || selectedRegionPoints.length > 0),
    'measure-a': Boolean(measurement.pointA),
    'measure-b': Boolean(measurement.pointB),
    landmark: Boolean(isSideCoreBodyEvidenceVisible()),
    'landmark-secondary': Boolean(isSideSecondaryBodyEvidenceVisible()),
  };

  for (const item of sideEvidenceLegendEl.querySelectorAll('[data-legend-type]')) {
    const type = item.dataset.legendType;
    item.hidden = !show[type];
  }
}

function formatSidePointCoords(point) {
  return `U ${formatCoordinate(point.u)} · Y ${formatCoordinate(point.y)} cm`;
}

function updateChrome() {
  const selectionBounds = getSelectionBounds(selectedRegionPoints);
  const split = classifySplitSelection();
  const selectionBlock = sideEvidenceInspectEl?.closest('.grid2d-selection-block');
  const measurement = getActiveSideMeasurement();
  const selectedLandmark = getSelectedSideEvidenceLandmark();

  const statusParts = [`Step ${BASE_STEP} cm`];
  if (refinedRegions.length > 0) {
    statusParts.push(`Refined ${refinedRegions.length}`);
  }
  if (sideEvidenceViewReadoutEl) {
    sideEvidenceViewReadoutEl.textContent = statusParts.join(' · ');
  }

  if (sideGridBackBtn) {
    sideGridBackBtn.disabled = refinedRegions.length === 0;
  }
  if (sideGridSplitBtn) {
    sideGridSplitBtn.disabled = !split.canSplit;
  }

  let hasSelectionDetails = false;
  const lines = [];

  if (selectedLandmark) {
    const displayName = formatLandmarkDisplayName(selectedLandmark.name)
      || selectedLandmark.name;
    const score = typeof selectedLandmark.score === 'number'
      && Number.isFinite(selectedLandmark.score)
      ? selectedLandmark.score.toFixed(2)
      : 'n/a';
    lines.push(`Source: Side`);
    lines.push(displayName);
    lines.push(formatAxisReadout(SIDE_H_AXIS, selectedLandmark.sideUcm));
    lines.push(formatAxisReadout(SIDE_V_AXIS, selectedLandmark.sideYcm));
    lines.push(`Confidence: ${score}`);
    hasSelectionDetails = true;
  } else if (active2dMode === MODE_PICK) {
    if (selectedPoint2d) {
      lines.push('Source: Side');
      lines.push(formatAxisReadout(SIDE_H_AXIS, selectedPoint2d.h));
      lines.push(formatAxisReadout(SIDE_V_AXIS, selectedPoint2d.v));
      hasSelectionDetails = true;
    }
  } else if (selectedRegionPoints.length > 0 && selectionBounds) {
    lines.push(`Selected points: ${selectedRegionPoints.length}`);
    lines.push(
      `U: ${formatRangeValue(selectionBounds.hMin)}–${formatRangeValue(selectionBounds.hMax)} cm`,
    );
    lines.push(
      `Y: ${formatRangeValue(selectionBounds.vMin)}–${formatRangeValue(selectionBounds.vMax)} cm`,
    );
    hasSelectionDetails = true;

    if (split.message) {
      showStatusMessage(split.message);
    } else {
      hideStatusMessage();
    }
  }

  if (measurement.pointA || measurement.pointB) {
    if (measurement.pointA) {
      lines.push(`A: ${formatSidePointCoords(measurement.pointA)}`);
    }
    if (measurement.pointB) {
      lines.push(`B: ${formatSidePointCoords(measurement.pointB)}`);
    }
    if (measurement.distanceCm != null) {
      lines.push(`Side dist: ${formatDistance(measurement.distanceCm)} cm`);
    }
    hasSelectionDetails = true;
  }

  if (sideEvidenceInspectEl) {
    if (lines.length > 0) {
      sideEvidenceInspectEl.innerHTML = (
        `<p class="grid2d-selected-readout">${lines.join('<br>')}</p>`
      );
    } else {
      sideEvidenceInspectEl.innerHTML = (
        `<p class="grid2d-selected-readout grid2d-selected-readout--empty">${getSelectionHint()}</p>`
      );
      if (active2dMode === MODE_REGION) {
        hideStatusMessage();
      }
    }
  }

  if (selectionBlock) {
    selectionBlock.classList.toggle('grid2d-selection-block--empty', !hasSelectionDetails);
  }

  updateSideEvidenceStatus();

  updateModeUI();
  updateLegend();
}

function renderAxisLabels() {
  renderPlotAxisLabels(sideEvidenceAxisLabelsEl, {
    hAxis: SIDE_H_AXIS,
    vAxis: SIDE_V_AXIS,
    maxLabel: `${ROOM_SIZE}`,
  });
}

function renderLatticePoints() {
  if (!sideEvidenceLatticePointsEl) {
    return;
  }

  sideEvidenceLatticePointsEl.replaceChildren();
  sideEvidenceLatticePointsEl.hidden = !sideGridPointsVisible;

  if (!sideGridPointsVisible) {
    return;
  }

  const points = getAllDisplayPoints();
  updateLatticeStepLookup(points);
  const fragment = document.createDocumentFragment();
  const measurement = getActiveSideMeasurement();

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
    const isMeasureA = measurement.pointA
      && measurement.pointA.u === point.h
      && measurement.pointA.y === point.v;
    const isMeasureB = measurement.pointB
      && measurement.pointB.u === point.h
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

  sideEvidenceLatticePointsEl.appendChild(fragment);
}

function appendSideMeasureMarker(point, variant) {
  const marker = document.createElement('div');
  marker.className = `grid2d-measure-marker grid2d-measure-marker--${variant} grid2d-measure-marker--side`;
  const pos = projectToPercent(point.u, point.y);
  marker.style.left = pos.left;
  marker.style.top = pos.top;
  applyMeasureMarkerSizeStyle(marker, point.u, point.y);
  sideEvidenceFieldEl.appendChild(marker);
}

function renderSideMeasurementOverlay() {
  const previous = sideEvidenceFieldEl.querySelectorAll(
    '.grid2d-measure-marker, .grid2d-measure-line, .grid2d-measure-label',
  );
  previous.forEach((node) => node.remove());

  const measurement = getActiveSideMeasurement();

  if (measurement.pointA) {
    appendSideMeasureMarker(measurement.pointA, 'a');
  }
  if (measurement.pointB) {
    appendSideMeasureMarker(measurement.pointB, 'b');
  }

  if (measurement.pointA && measurement.pointB && measurement.distanceCm != null) {
    const a = worldToPlotPx(measurement.pointA.u, measurement.pointA.y);
    const b = worldToPlotPx(measurement.pointB.u, measurement.pointB.y);
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const length = Math.hypot(dx, dy);
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    const line = document.createElement('div');
    line.className = 'grid2d-measure-line grid2d-measure-line--side';
    line.style.left = `${a.px}px`;
    line.style.top = `${a.py}px`;
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angleDeg}deg)`;
    sideEvidenceFieldEl.appendChild(line);

    const label = document.createElement('div');
    label.className = 'grid2d-measure-label grid2d-measure-label--side';
    label.textContent = `${formatDistance(measurement.distanceCm)} cm`;
    label.title = [
      `Side A: ${formatSidePointCoords(measurement.pointA)}`,
      `Side B: ${formatSidePointCoords(measurement.pointB)}`,
    ].join('\n');
    label.style.left = `${(a.px + b.px) / 2}px`;
    label.style.top = `${(a.py + b.py) / 2}px`;
    sideEvidenceFieldEl.appendChild(label);
  }
}

export function isSideGrid2dPointsVisible() {
  return sideGridPointsVisible;
}

export function setSideGrid2dPointsVisible(visible) {
  sideGridPointsVisible = Boolean(visible);
  refreshSideGrid2dNavigator();
}

export function refreshSideGrid2dNavigator() {
  if (!sideEvidenceViewportEl || !sideEvidenceFieldEl) {
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
  renderSideBodyEvidenceOverlay({ projectToPercent });
  renderSideSegmentationOverlay(sideSegmentationCanvasEl);
  renderSideMeasurementOverlay();
  renderSelectedRegionOutline();
  updateChrome();

  if (!isSideWorkspaceVisible()) {
    hideSideHoverTooltip();
  }
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
  if (sideGridSplitBtn) {
    sideGridSplitBtn.disabled = true;
  }
  refreshSideGrid2dNavigator();
}

function undoLastRefinement() {
  if (!refinedRegions.length) {
    return;
  }
  refinedRegions.pop();
  clearRegionSelection();
  hideStatusMessage();
  refreshSideGrid2dNavigator();
}

function resetSideNavigator() {
  refinedRegions = [];
  clearAllSelection();
  clearSideEvidenceSelection();
  clearSideMeasurement();
  resetVisualZoom();
  hideStatusMessage();
  refreshSideGrid2dNavigator();
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
  if (sideEvidenceSelectionRectEl) {
    sideEvidenceSelectionRectEl.hidden = true;
  }

  if (mode === MODE_PICK) {
    clearRegionSelection();
  } else {
    clearPointSelection();
  }

  hideStatusMessage();
  refreshSideGrid2dNavigator();
}

function toggleActive2dMode() {
  setActive2dMode(active2dMode === MODE_PICK ? MODE_REGION : MODE_PICK);
}

function clampPanForZoomLocal() {
  const { width, height } = getFieldInnerSize();
  clampPanForZoom(visualTransform, width, height);
}

function handleWheelZoom(event) {
  event.preventDefault();
  event.stopPropagation();

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
  sideEvidenceViewportEl.addEventListener('pointerdown', (event) => {
    if (event.button === 2) {
      event.preventDefault();
      hideSideHoverTooltip();
      panState = {
        startX: event.clientX,
        startY: event.clientY,
        startPanX: visualTransform.panX,
        startPanY: visualTransform.panY,
        pointerId: event.pointerId,
      };
      sideEvidenceViewportEl.setPointerCapture(event.pointerId);
      sideEvidenceViewportEl.classList.add('grid2d-grid-wrapper--panning');
      return;
    }

    if (event.button !== 0) {
      return;
    }

    hideSideHoverTooltip();
    sideEvidenceViewportEl.focus({ preventScroll: true });

    if (active2dMode === MODE_REGION) {
      dragSelectState = {
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        pointerId: event.pointerId,
      };
      sideEvidenceViewportEl.setPointerCapture(event.pointerId);
      sideEvidenceViewportEl.classList.add('grid2d-grid-wrapper--selecting');
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
    sideEvidenceViewportEl.setPointerCapture(event.pointerId);
  });

  sideEvidenceViewportEl.addEventListener('pointermove', (event) => {
    if (panState && event.pointerId === panState.pointerId) {
      visualTransform.panX = panState.startPanX + (event.clientX - panState.startX);
      visualTransform.panY = panState.startPanY + (event.clientY - panState.startY);
      clampPanForZoomLocal();
      applyVisualZoom();
      hideSideHoverTooltip();
      return;
    }

    if (dragSelectState && event.pointerId === dragSelectState.pointerId) {
      dragSelectState.currentX = event.clientX;
      dragSelectState.currentY = event.clientY;
      if (active2dMode === MODE_REGION) {
        updateSelectionRectUI();
      }
      hideSideHoverTooltip();
      return;
    }

    syncSideHoverTooltip(event.clientX, event.clientY);
  });

  const endPointerInteraction = (event) => {
    if (panState && event.pointerId === panState.pointerId) {
      panState = null;
      sideEvidenceViewportEl.classList.remove('grid2d-grid-wrapper--panning');
      if (sideEvidenceViewportEl.hasPointerCapture(event.pointerId)) {
        sideEvidenceViewportEl.releasePointerCapture(event.pointerId);
      }
      syncSideHoverTooltip(event.clientX, event.clientY);
      return;
    }

    if (dragSelectState && event.pointerId === dragSelectState.pointerId) {
      if (active2dMode === MODE_REGION) {
        finalizeDragSelection();
        sideEvidenceViewportEl.classList.remove('grid2d-grid-wrapper--selecting');
      } else {
        const dx = Math.abs(dragSelectState.currentX - dragSelectState.startX);
        const dy = Math.abs(dragSelectState.currentY - dragSelectState.startY);

        if (dx < MIN_DRAG_PX && dy < MIN_DRAG_PX) {
          finalizePickSelection(event.clientX, event.clientY);
        }
      }

      dragSelectState = null;

      if (sideEvidenceViewportEl.hasPointerCapture(event.pointerId)) {
        sideEvidenceViewportEl.releasePointerCapture(event.pointerId);
      }

      syncSideHoverTooltip(event.clientX, event.clientY);
    }
  };

  sideEvidenceViewportEl.addEventListener('pointerup', endPointerInteraction);
  sideEvidenceViewportEl.addEventListener('pointercancel', endPointerInteraction);

  sideEvidenceViewportEl.addEventListener('pointerleave', () => {
    if (panState || dragSelectState) {
      return;
    }
    hideSideHoverTooltip();
  });

  sideEvidenceViewportEl.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  sideEvidenceViewportEl.addEventListener('wheel', handleWheelZoom, { passive: false });
}

function setupModeKeyboardToggle() {
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Control' || event.altKey || event.metaKey) {
      return;
    }

    if (!isSideWorkspaceVisible()) {
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (!sideEvidenceViewportEl.contains(document.activeElement)
      && document.activeElement !== sideEvidenceViewportEl) {
      return;
    }

    if (event.repeat) {
      return;
    }

    event.preventDefault();
    toggleActive2dMode();
  });
}

export function setupSideGrid2dNavigator() {
  if (!sideEvidenceViewportEl || !sideEvidenceFieldEl) {
    return;
  }

  setupBodyEvidenceOverlaySide2d(refreshSideGrid2dNavigator);
  subscribeBodyEvidenceChange(() => {
    refreshSideGrid2dNavigator();
  });
  subscribeSideMeasurementChange(() => {
    refreshSideGrid2dNavigator();
  });

  sideGridBackBtn?.addEventListener('click', () => {
    undoLastRefinement();
  });

  sideGridResetBtn?.addEventListener('click', () => {
    resetSideNavigator();
  });

  sideGridSplitBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    splitSelectedRegion();
  });

  const preventGridPointerBleed = (event) => {
    event.stopPropagation();
    if (sideEvidenceViewportEl.hasPointerCapture(event.pointerId)) {
      sideEvidenceViewportEl.releasePointerCapture(event.pointerId);
    }
    dragSelectState = null;
    if (sideEvidenceSelectionRectEl) {
      sideEvidenceSelectionRectEl.hidden = true;
    }
    sideEvidenceViewportEl.classList.remove('grid2d-grid-wrapper--selecting');
  };

  for (const actionBtn of [
    sideGridBackBtn,
    sideGridResetBtn,
    sideGridSplitBtn,
  ]) {
    actionBtn?.addEventListener('pointerdown', preventGridPointerBleed);
  }

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      refreshSideGrid2dNavigator();
    });
    observer.observe(sideEvidenceViewportEl);
  }

  sideEvidenceViewportEl.setAttribute('tabindex', '0');
  setupPointerInteraction();
  setupModeKeyboardToggle();
  resetVisualZoom();
  setupSegmentationOverlay2d(null, refreshSideGrid2dNavigator);
  refreshSideGrid2dNavigator();
}

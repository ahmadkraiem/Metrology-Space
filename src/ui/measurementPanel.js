import { formatCoordinate, formatDistance, formatPointCoords } from '../core/formatters.js';
import { calculateDistance } from '../core/math.js';
import {
  clearSideMeasurement,
  clearSideMeasurementPointA,
  clearSideMeasurementPointB,
  formatSideMeasurementInspectPoint,
  getSideMeasurementState,
  subscribeSideMeasurementChange,
} from '../features/sideMeasurement.js';
import {
  clearMeasurementBtn,
  clearPointABtn,
  clearPointBBtn,
  clearSideMeasurementBtn,
  clearSidePointABtn,
  clearSidePointBBtn,
  historyEmptyEl,
  historyListEl,
  measurementDistanceEl,
  pointACoordsEl,
  pointBCoordsEl,
  sideMeasurementDistanceEl,
  sidePointACoordsEl,
  sidePointBCoordsEl,
} from './domRefs.js';
import { updateSceneGraph } from './sceneGraphPanel.js';
import { highlightMeasurement } from '../features/sceneGraphHighlight.js';
import {
  areAllOnFrontSurface,
  FRONT_SURFACE_TYPE_LABEL,
} from '../core/frontSurface.js';

export function updateMeasurementPanel(measurement) {
  if (measurement?.pointA) {
    renderMeasurementPointDisplay(pointACoordsEl, measurement.pointA);
  } else if (pointACoordsEl) {
    pointACoordsEl.textContent = '—';
  }

  if (measurement?.pointB) {
    renderMeasurementPointDisplay(pointBCoordsEl, measurement.pointB);
    if (measurementDistanceEl) {
      measurementDistanceEl.textContent = measurement.pointA
        ? formatDistance(calculateDistance(measurement.pointA, measurement.pointB))
        : '—';
    }
  } else {
    if (pointBCoordsEl) {
      pointBCoordsEl.textContent = '—';
    }
    if (measurementDistanceEl) {
      measurementDistanceEl.textContent = '—';
    }
  }

  setClearEnabled(clearPointABtn, Boolean(measurement?.pointA));
  setClearEnabled(clearPointBBtn, Boolean(measurement?.pointB));
  setClearEnabled(clearMeasurementBtn, Boolean(measurement?.pointA || measurement?.pointB));

  updateSideMeasurementInspector();
  updateSceneGraph();
}

function renderSideMeasurementPoint(targetEl, point) {
  if (!targetEl) {
    return;
  }
  const lines = formatSideMeasurementInspectPoint(point);
  if (!lines) {
    targetEl.textContent = '—';
    return;
  }

  const fragments = lines.map((line) => {
    const lineEl = document.createElement('span');
    lineEl.className = 'measurement-point-coords';
    lineEl.textContent = line;
    return lineEl;
  });
  targetEl.replaceChildren(...fragments);
}

function setClearEnabled(button, enabled) {
  if (!button) {
    return;
  }
  button.disabled = !enabled;
  button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
}

export function updateSideMeasurementInspector() {
  const state = getSideMeasurementState();
  renderSideMeasurementPoint(sidePointACoordsEl, state.pointA);
  renderSideMeasurementPoint(sidePointBCoordsEl, state.pointB);

  if (sideMeasurementDistanceEl) {
    sideMeasurementDistanceEl.textContent = state.distanceCm == null
      ? '—'
      : formatDistance(state.distanceCm);
  }

  setClearEnabled(clearSidePointABtn, Boolean(state.pointA));
  setClearEnabled(clearSidePointBBtn, Boolean(state.pointB));
  setClearEnabled(clearSideMeasurementBtn, Boolean(state.pointA || state.pointB));
}

export function setupSideMeasurementInspector() {
  clearSidePointABtn?.addEventListener('click', () => {
    clearSideMeasurementPointA();
  });
  clearSidePointBBtn?.addEventListener('click', () => {
    clearSideMeasurementPointB();
  });
  clearSideMeasurementBtn?.addEventListener('click', () => {
    clearSideMeasurement();
  });

  subscribeSideMeasurementChange(() => {
    updateSideMeasurementInspector();
  });
  updateSideMeasurementInspector();
}

/**
 * Session-local label (e.g. body landmark name) is display-only and optional.
 * Coordinates remain the authoritative measurement value.
 * Name and coordinates are stacked so long landmark names cannot widen the panel.
 * @param {HTMLElement} targetEl
 * @param {{ x: number, y: number, z: number, label?: string }} point
 */
function renderMeasurementPointDisplay(targetEl, point) {
  const coordsEl = document.createElement('span');
  coordsEl.className = 'measurement-point-coords';
  coordsEl.textContent = formatStackedPointCoords(point);

  const name = typeof point.label === 'string' ? point.label.trim() : '';
  if (!name) {
    targetEl.replaceChildren(coordsEl);
    return;
  }

  const nameEl = document.createElement('span');
  nameEl.className = 'measurement-point-name';
  nameEl.textContent = name;
  nameEl.title = name;

  targetEl.replaceChildren(nameEl, coordsEl);
}

function formatStackedPointCoords(point) {
  return `X: ${formatCoordinate(point.x)} cm · Y: ${formatCoordinate(point.y)} cm · Z: ${formatCoordinate(point.z)} cm`;
}

export function applyHistoryItemHighlightBehavior(item, entry, highlightFn = highlightMeasurement) {
  item.classList.add('history-item--clickable');
  item.setAttribute('role', 'button');
  item.tabIndex = 0;

  const activate = (event) => {
    event?.stopPropagation?.();
    highlightFn(entry.pointA, entry.pointB);
  };

  item.addEventListener('click', activate);
  item.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    activate(event);
  });
}

/**
 * Renders the single measurement history. Front-surface measurements (driven
 * from the 2D workspace) live in the same list as measurements taken in 3D.
 * Pass current history from measurement.js to avoid import cycles.
 */
export function renderMeasurementHistory(measurementHistory) {
  if (!historyListEl || !historyEmptyEl) {
    return;
  }

  historyListEl.replaceChildren();

  if (measurementHistory.length === 0) {
    historyEmptyEl.hidden = false;
    updateSceneGraph();
    return;
  }

  historyEmptyEl.hidden = true;

  measurementHistory.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const title = document.createElement('div');
    title.className = 'history-item-title';
    title.textContent = `#${entry.number} · ${formatDistance(entry.distance)} cm`;

    item.append(title);

    if (areAllOnFrontSurface([entry.pointA, entry.pointB])) {
      const typeRow = document.createElement('div');
      typeRow.className = 'history-item-row history-item-row--meta';
      typeRow.textContent = FRONT_SURFACE_TYPE_LABEL;
      item.append(typeRow);
    }

    const rowA = document.createElement('div');
    rowA.className = 'history-item-row';
    rowA.textContent = `A: ${formatPointCoords(entry.pointA)}`;

    const rowB = document.createElement('div');
    rowB.className = 'history-item-row';
    rowB.textContent = `B: ${formatPointCoords(entry.pointB)}`;

    item.append(rowA, rowB);
    applyHistoryItemHighlightBehavior(item, entry);
    historyListEl.append(item);
  });

  updateSceneGraph();
}

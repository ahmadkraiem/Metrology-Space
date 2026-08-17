import { formatAnnotationTypeLabel, normalizeAnnotationType } from '../core/annotationTypes.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import { buildSceneState } from '../features/sceneExport.js';
import { activateProjectionLink } from '../features/projectionLinking.js';
import { getActiveLinkedNodeId, subscribeLinkedSelection } from '../features/linkedSelection.js';
import {
  highlightMeasurement,
} from '../features/sceneGraphHighlight.js';
import { formatDistance } from '../core/formatters.js';
import {
  areAllOnFrontSurface,
  FRONT_SURFACE_TYPE_LABEL,
} from '../core/frontSurface.js';
import { sceneGraphTreeEl } from './domRefs.js';

const MODE_LABELS = {
  'inspect-measure': 'Inspect & Measure',
  annotate: 'Annotate',
};

const ORIGIN_POSITION = { x: 0, y: 0, z: 0 };
const CENTER_POSITION = { x: 100, y: 100, z: 100 };

let measurementRef = null;

function formatCompactPoint(point) {
  if (!point) {
    return null;
  }

  return `(${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)})`;
}

function createRow(key, value, valueClass = '') {
  const row = document.createElement('div');
  row.className = 'scene-graph-row';

  const keyEl = document.createElement('span');
  keyEl.className = 'scene-graph-key';
  keyEl.textContent = key;

  const valueEl = document.createElement('span');
  valueEl.className = valueClass ? `scene-graph-value ${valueClass}` : 'scene-graph-value';
  valueEl.textContent = value;

  row.append(keyEl, valueEl);
  return row;
}

function createClickableRow(key, value, valueClass, onActivate, linkId = null) {
  const row = createRow(key, value, valueClass);
  row.className = 'scene-graph-row scene-graph-row--clickable';
  row.setAttribute('role', 'button');
  row.tabIndex = 0;

  if (linkId) {
    row.dataset.linkId = linkId;
  }

  const activate = (event) => {
    event.stopPropagation();
    onActivate();
  };

  row.addEventListener('click', activate);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate(event);
    }
  });

  return row;
}

function createEmptyState(text) {
  const empty = document.createElement('div');
  empty.className = 'scene-graph-empty';
  empty.textContent = text;
  return empty;
}

function createGroup(title, bodyChildren, open = true) {
  const details = document.createElement('details');
  details.className = 'scene-graph-group';
  if (open) {
    details.open = true;
  }

  const summary = document.createElement('summary');
  summary.className = 'scene-graph-summary';
  summary.textContent = title;

  const body = document.createElement('div');
  body.className = 'scene-graph-body';
  body.append(...bodyChildren);

  details.append(summary, body);
  return details;
}

function syncSceneGraphLinkedActive() {
  if (!sceneGraphTreeEl) {
    return;
  }

  const activeId = getActiveLinkedNodeId();
  sceneGraphTreeEl.querySelectorAll('[data-link-id]').forEach((row) => {
    row.classList.toggle('scene-graph-row--linked-active', row.dataset.linkId === activeId);
  });
}

function createCompactHistoryRows(entries) {
  return entries.map((entry) => createClickableRow(
    `#${entry.number}`,
    `${formatDistance(entry.distanceCm)} cm`,
    'scene-graph-value--data',
    () => highlightMeasurement(entry.pointA, entry.pointB),
  ));
}

function createCompactAnnotationRows(entries) {
  const grouped = new Map();

  entries.forEach((entry) => {
    const type = normalizeAnnotationType(entry.type);
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type).push(entry);
  });

  const typeKeys = [...grouped.keys()].sort();
  const useGrouping = typeKeys.length > 1;

  const buildRow = (entry) => {
    const linkId = `projection-annotation-${entry.id}`;
    const displayName = formatLandmarkDisplayName(entry.name) || entry.name;
    return createClickableRow(
      displayName,
      useGrouping
        ? formatCompactPoint(entry.position)
        : `${formatAnnotationTypeLabel(entry.type)} · ${formatCompactPoint(entry.position)}`,
      useGrouping
        ? 'scene-graph-value--data scene-graph-value--indented'
        : 'scene-graph-value--data',
      () => activateProjectionLink(linkId, {
        kind: 'annotation',
        position3d: entry.position,
      }),
      linkId,
    );
  };

  if (!useGrouping) {
    return entries.map((entry) => buildRow(entry));
  }

  const rows = [];
  typeKeys.forEach((type) => {
    const typeEntries = grouped.get(type);
    rows.push(createRow(
      formatAnnotationTypeLabel(type),
      String(typeEntries.length),
      'scene-graph-value--muted',
    ));
    typeEntries.forEach((entry) => {
      rows.push(buildRow(entry));
    });
  });

  return rows;
}

/**
 * One shared active measurement section. Front-surface measurements driven from
 * the 2D workspace and measurements taken in 3D are the same state, so the
 * graph reports a single node with the plane it belongs to.
 */
function buildActiveMeasurementChildren(activeMeasurement) {
  const activeChildren = [];

  if (!activeMeasurement.pointA && !activeMeasurement.pointB) {
    activeChildren.push(createEmptyState('No active measurement'));
    return activeChildren;
  }

  const onFrontSurface = areAllOnFrontSurface([
    activeMeasurement.pointA,
    activeMeasurement.pointB,
  ]);

  activeChildren.push(createRow(
    'Type',
    onFrontSurface ? FRONT_SURFACE_TYPE_LABEL : 'Volume 3D',
    'scene-graph-value--muted',
  ));

  if (activeMeasurement.pointA && activeMeasurement.pointB) {
    activeChildren.push(createClickableRow(
      'Measurement',
      'Highlight A · B · line',
      'scene-graph-value--data',
      () => highlightMeasurement(activeMeasurement.pointA, activeMeasurement.pointB),
    ));
  }

  if (activeMeasurement.pointA) {
    activeChildren.push(createClickableRow(
      'A',
      formatCompactPoint(activeMeasurement.pointA),
      'scene-graph-value--data',
      () => activateProjectionLink('projection-point-a', {
        kind: 'point-a',
        position3d: activeMeasurement.pointA,
      }),
      'projection-point-a',
    ));
  }

  if (activeMeasurement.pointB) {
    activeChildren.push(createClickableRow(
      'B',
      formatCompactPoint(activeMeasurement.pointB),
      'scene-graph-value--data',
      () => activateProjectionLink('projection-point-b', {
        kind: 'point-b',
        position3d: activeMeasurement.pointB,
      }),
      'projection-point-b',
    ));
  }

  if (activeMeasurement.distanceCm !== null) {
    activeChildren.push(createRow(
      'Distance',
      `${formatDistance(activeMeasurement.distanceCm)} cm`,
      'scene-graph-value--data',
    ));
  }

  return activeChildren;
}

function renderSceneGraph() {
  const state = buildSceneState(measurementRef);
  const { metadata, sceneScale, appMode, referenceMarkers, activeMeasurement } = state;
  const modeLabel = MODE_LABELS[appMode.currentMode] ?? appMode.currentMode;

  const metadataGroup = createGroup('Scene Metadata', [
    createRow('App', metadata.appName),
    createRow('Mode', modeLabel),
    createRow('Unit', sceneScale.unit),
    createRow(
      'Cube size',
      `${sceneScale.cubeSizeCm.x} × ${sceneScale.cubeSizeCm.y} × ${sceneScale.cubeSizeCm.z}`,
    ),
  ]);

  const referenceGroup = createGroup('Reference Markers', [
    createClickableRow(
      'Origin',
      formatCompactPoint(referenceMarkers.origin),
      'scene-graph-value--data',
      () => activateProjectionLink('projection-origin', {
        kind: 'origin',
        position3d: ORIGIN_POSITION,
      }),
      'projection-origin',
    ),
    createClickableRow(
      'Center',
      formatCompactPoint(referenceMarkers.center),
      'scene-graph-value--data',
      () => activateProjectionLink('projection-center', {
        kind: 'center',
        position3d: CENTER_POSITION,
      }),
      'projection-center',
    ),
  ]);

  const activeMeasurementGroup = createGroup(
    'Active Measurement',
    buildActiveMeasurementChildren(activeMeasurement),
  );

  const historyChildren = [
    createRow('Total', String(state.measurementHistory.length)),
  ];
  if (state.measurementHistory.length === 0) {
    historyChildren.push(createEmptyState('No completed measurements'));
  } else {
    historyChildren.push(...createCompactHistoryRows(state.measurementHistory));
  }

  const historyGroup = createGroup(
    `Measurement History (${state.measurementHistory.length})`,
    historyChildren,
    false,
  );

  const annotationChildren = [
    createRow('Total', String(state.annotations.length)),
  ];
  if (state.annotations.length === 0) {
    annotationChildren.push(createEmptyState('No annotations'));
  } else {
    annotationChildren.push(...createCompactAnnotationRows(state.annotations));
  }

  const annotationsGroup = createGroup(
    `Annotations (${state.annotations.length})`,
    annotationChildren,
    false,
  );

  sceneGraphTreeEl.replaceChildren(
    metadataGroup,
    referenceGroup,
    activeMeasurementGroup,
    historyGroup,
    annotationsGroup,
  );

  syncSceneGraphLinkedActive();
}

export function setupSceneGraphPanel(measurement) {
  measurementRef = measurement;
  subscribeLinkedSelection(syncSceneGraphLinkedActive);
  renderSceneGraph();
}

export function updateSceneGraph() {
  if (measurementRef) {
    renderSceneGraph();
  }
}

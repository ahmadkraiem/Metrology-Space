import { formatAnnotationTypeLabel } from '../core/annotationTypes.js';
import { ROOM_SIZE } from '../core/constants.js';
import { frontSurfaceFrom3d } from '../core/frontSurface.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import { isInspectMeasureMode } from './appMode.js';
import { getAnnotations, setAnnotationsChangeHandler } from './annotations.js';
import { advanceSharedMeasurement } from './frontSurfaceMeasurement.js';
import { getActiveLinkedNodeId, setActiveLinkedNode, subscribeLinkedSelection } from './linkedSelection.js';
import { setMeasurement3dChangeHandler } from './measurement.js';
import {
  highlightActivePointA,
  highlightActivePointB,
  highlightAnnotation,
  highlightReferenceMarker,
} from './sceneGraphHighlight.js';
import {
  grid2dMarkersEl,
  grid2dProjectionTooltipEl,
  grid2dNavViewModeEl,
} from '../ui/domRefs.js';
import { applyProjectionMarkerSizeStyle } from '../ui/grid2dMarkerSizing.js';

/** Front Surface is the only active 2D workspace plane (X horizontal, Y vertical). */
export const GRID2D_VIEW_FRONT = 'front';

export const GRID2D_FRONT_VIEW_CONFIG = {
  title: 'Front Surface',
  axisLabel: 'X/Y',
  hAxis: 'x',
  vAxis: 'y',
  buttonLabel: 'Canonical Front Surface · X / Y',
};

const ORIGIN_3D = { x: 0, y: 0, z: 0 };
const CENTER_3D = { x: ROOM_SIZE / 2, y: ROOM_SIZE / 2, z: ROOM_SIZE / 2 };

/**
 * Active Point A / Point B are not projected here: the 2D workspace renders the
 * shared front-surface measurement natively, so projecting them again would
 * duplicate the same markers.
 */
const MARKER_CLASS_BY_KIND = {
  origin: 'grid2d-marker--origin',
  center: 'grid2d-marker--center',
  annotation: 'grid2d-marker--annotation',
};

/** @type {(() => void) | null} */
let refreshGrid2dNavigatorFn = null;
let projectedReferenceMarkersVisible = true;
let projectedAnnotationsVisible = true;

export function getProjectedReferenceMarkersVisible() {
  return projectedReferenceMarkersVisible;
}

export function getProjectedAnnotationsVisible() {
  return projectedAnnotationsVisible;
}

export function setProjectedReferenceMarkersVisible(visible) {
  projectedReferenceMarkersVisible = Boolean(visible);
  hideProjectionTooltip();
  requestGrid2dRefresh();
}

export function setProjectedAnnotationsVisible(visible) {
  projectedAnnotationsVisible = Boolean(visible);
  hideProjectionTooltip();
  requestGrid2dRefresh();
}

export function formatViewDisplayLabel() {
  return GRID2D_FRONT_VIEW_CONFIG.buttonLabel;
}

/**
 * Maps a 3D point onto the Front Surface grid (X→h, Y→v).
 * Depth is dropped; this is display mapping only.
 * @param {{ x: number, y: number, z: number }} point
 */
export function project3dToGrid2d(point) {
  return frontSurfaceFrom3d(point);
}

export function getGrid2dView() {
  return GRID2D_VIEW_FRONT;
}

export function getGrid2dViewConfig() {
  return GRID2D_FRONT_VIEW_CONFIG;
}

function requestGrid2dRefresh() {
  if (refreshGrid2dNavigatorFn) {
    refreshGrid2dNavigatorFn();
  }
}

function formatOriginalCoords(point) {
  return `X: ${Math.round(point.x)} cm · Y: ${Math.round(point.y)} cm · Z: ${Math.round(point.z)} cm`;
}

function escapeTooltipHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Front Surface projection is X/Y of the same 3D point, so a separate
 * projected-coordinate row would only repeat the X/Y already shown.
 */
function buildProjectionTooltipHtml(item) {
  if (item.kind === 'annotation') {
    const displayName = formatLandmarkDisplayName(item.name) || item.name;
    const rows = [
      ['name', displayName],
      ['type', item.typeLabel],
      ['xyz', formatOriginalCoords(item.position3d)],
      ['source', item.sourceLabel || 'annotation'],
    ];

    return (
      `<div class="projection-annotation-tooltip">`
      + rows.map(([label, value]) => (
        `<div class="projection-annotation-tooltip-row">`
        + `<span class="projection-annotation-tooltip-label">${escapeTooltipHtml(label)}</span>`
        + `<span class="projection-annotation-tooltip-value">${escapeTooltipHtml(value)}</span>`
        + `</div>`
      )).join('')
      + `</div>`
    );
  }

  const lines = [
    `Node: ${item.nodeTypeLabel}`,
    formatOriginalCoords(item.position3d),
    'Source: 3D projection',
  ];
  return escapeTooltipHtml(lines.join('\n')).replaceAll('\n', '<br>');
}

function hideProjectionTooltip() {
  if (!grid2dProjectionTooltipEl) {
    return;
  }

  grid2dProjectionTooltipEl.hidden = true;
}

function showProjectionTooltip(item, clientX, clientY) {
  if (!grid2dProjectionTooltipEl) {
    return;
  }

  grid2dProjectionTooltipEl.innerHTML = buildProjectionTooltipHtml(item);

  const wrapper = grid2dMarkersEl?.closest('.grid2d-grid-wrapper');
  if (!wrapper) {
    return;
  }

  const rect = wrapper.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  grid2dProjectionTooltipEl.hidden = false;
  grid2dProjectionTooltipEl.style.visibility = 'hidden';
  grid2dProjectionTooltipEl.style.left = '0px';
  grid2dProjectionTooltipEl.style.top = '0px';

  const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = grid2dProjectionTooltipEl;

  let left = mouseX + 18;
  let top = mouseY + 18;

  if (left + tooltipWidth > rect.width) {
    left = mouseX - tooltipWidth - 18;
  }
  if (top + tooltipHeight > rect.height) {
    top = mouseY - tooltipHeight - 18;
  }

  left = Math.max(0, Math.min(left, rect.width - tooltipWidth));
  top = Math.max(0, Math.min(top, rect.height - tooltipHeight));

  grid2dProjectionTooltipEl.style.left = `${left}px`;
  grid2dProjectionTooltipEl.style.top = `${top}px`;
  grid2dProjectionTooltipEl.style.visibility = 'visible';
}

function triggerProjectionHighlight(item) {
  switch (item.kind) {
    case 'origin':
      highlightReferenceMarker('origin');
      return;
    case 'center':
      highlightReferenceMarker('center');
      return;
    case 'point-a':
      highlightActivePointA(item.position3d);
      return;
    case 'point-b':
      highlightActivePointB(item.position3d);
      return;
    case 'annotation':
      highlightAnnotation(item.position3d);
      return;
    default:
      break;
  }
}

export function activateProjectionLink(linkId, highlightItem = null) {
  setActiveLinkedNode(linkId);
  if (highlightItem) {
    triggerProjectionHighlight(highlightItem);
  }
  requestGrid2dRefresh();
}

/**
 * @returns {Array<{ id: string, kind: string, nodeTypeLabel: string, position3d: { x: number, y: number, z: number }, markerClass: string, name?: string, typeLabel?: string }>}
 */
export function collectProjectionItems() {
  const items = [];

  if (projectedReferenceMarkersVisible) {
    items.push(
      {
        id: 'projection-origin',
        kind: 'origin',
        nodeTypeLabel: 'Origin',
        position3d: { ...ORIGIN_3D },
        markerClass: MARKER_CLASS_BY_KIND.origin,
      },
      {
        id: 'projection-center',
        kind: 'center',
        nodeTypeLabel: 'Center',
        position3d: { ...CENTER_3D },
        markerClass: MARKER_CLASS_BY_KIND.center,
      },
    );
  }

  if (projectedAnnotationsVisible) {
    for (const annotation of getAnnotations()) {
      const isBodyLandmark = annotation.type === 'body_landmark';
      items.push({
        id: `projection-annotation-${annotation.id}`,
        kind: 'annotation',
        nodeTypeLabel: formatAnnotationTypeLabel(annotation.type),
        name: annotation.name,
        typeLabel: formatAnnotationTypeLabel(annotation.type),
        sourceLabel: isBodyLandmark ? 'promoted body landmark' : 'manual annotation',
        isBodyLandmark,
        position3d: {
          x: annotation.point.x,
          y: annotation.point.y,
          z: annotation.point.z,
        },
        markerClass: MARKER_CLASS_BY_KIND.annotation,
      });
    }
  }

  return items;
}

/**
 * @param {object} options
 * @param {(h: number, v: number) => { left: string, top: string }} options.projectToPercent
 */
export function renderProjectionMarkers({ projectToPercent }) {
  if (!grid2dMarkersEl || typeof projectToPercent !== 'function') {
    return;
  }

  const items = collectProjectionItems();
  const activeLinkedId = getActiveLinkedNodeId();
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const projected = project3dToGrid2d(item.position3d);
    const pos = projectToPercent(projected.h, projected.v);
    const marker = document.createElement('div');
    marker.className = `grid2d-marker grid2d-projection-marker ${item.markerClass}`;
    if (item.kind === 'annotation') {
      marker.classList.add('grid2d-projection-marker--annotation-hit');
    }
    marker.dataset.projectionId = item.id;
    marker.dataset.linkId = item.id;
    marker.style.left = pos.left;
    marker.style.top = pos.top;
    applyProjectionMarkerSizeStyle(marker, projected.h, projected.v);

    if (item.id === activeLinkedId) {
      marker.classList.add('grid2d-projection-marker--linked-active');
    }

    const ariaName = item.kind === 'annotation'
      ? (formatLandmarkDisplayName(item.name) || item.name)
      : item.nodeTypeLabel;
    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute('aria-label', `${ariaName} (3D projection)`);

    marker.addEventListener('mouseenter', (event) => {
      showProjectionTooltip(item, event.clientX, event.clientY);
    });

    marker.addEventListener('mousemove', (event) => {
      showProjectionTooltip(item, event.clientX, event.clientY);
    });

    marker.addEventListener('mouseleave', () => {
      hideProjectionTooltip();
    });

    marker.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    marker.addEventListener('click', (event) => {
      event.stopPropagation();
      event.preventDefault();

      // Inspect & Measure: promoted body_landmark markers advance shared A/B.
      // Annotate mode and non-body_landmark annotations keep projection-link only.
      if (
        item.kind === 'annotation'
        && item.isBodyLandmark
        && isInspectMeasureMode()
      ) {
        const label = formatLandmarkDisplayName(item.name) || item.name;
        advanceSharedMeasurement({
          x: item.position3d.x,
          y: item.position3d.y,
          z: item.position3d.z,
          label,
        });
      }

      activateProjectionLink(item.id, item);
    });

    marker.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (
        item.kind === 'annotation'
        && item.isBodyLandmark
        && isInspectMeasureMode()
      ) {
        const label = formatLandmarkDisplayName(item.name) || item.name;
        advanceSharedMeasurement({
          x: item.position3d.x,
          y: item.position3d.y,
          z: item.position3d.z,
          label,
        });
      }

      activateProjectionLink(item.id, item);
    });

    fragment.appendChild(marker);
  }

  grid2dMarkersEl.replaceChildren(fragment);
}

export function hideProjectionLinkingTooltip() {
  hideProjectionTooltip();
}

function updateViewLabelUI() {
  if (grid2dNavViewModeEl) {
    grid2dNavViewModeEl.textContent = formatViewDisplayLabel();
  }
}

export function setupProjectionLinking(refreshGrid2dNavigator) {
  refreshGrid2dNavigatorFn = refreshGrid2dNavigator;

  setMeasurement3dChangeHandler(() => {
    requestGrid2dRefresh();
  });

  setAnnotationsChangeHandler(() => {
    requestGrid2dRefresh();
  });

  subscribeLinkedSelection(() => {
    requestGrid2dRefresh();
  });

  updateViewLabelUI();
}

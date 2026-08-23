/**
 * Body Evidence Front Surface overlay (v0)
 * Visual-only markers for accepted FRONT body landmarks on the existing
 * Front Surface (X/Y) field. Supports inspect/select highlight only —
 * never touches measurement, annotation, Scene Graph, or Scene State.
 */

import { ROOM_SIZE } from '../core/constants.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  ASSUMED_IMAGE_SIZE_PX,
  clearSideEvidenceSelection,
  getBodyEvidenceScaleInfo,
  getRenderableFrontBodyLandmarks,
  getSecondaryFrontBodyLandmarks,
  isBodyEvidenceOverlayVisible,
  isSecondaryBodyEvidenceVisible,
  isSelectedBodyEvidenceLandmark,
  selectBodyEvidenceLandmark,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  bodyEvidenceOverlayLayerEl,
  bodyEvidenceOverlayTooltipEl,
} from './domRefs.js';
import { applyProjectionMarkerSizeStyle } from './grid2dMarkerSizing.js';

const TOOLTIP_OFFSET_PX = 18;

/** @type {(() => void) | null} */
let requestGrid2dRefreshFn = null;
/** @type {string | null} */
let hoveredMarkerId = null;

function clampToRoom(value) {
  return Math.min(Math.max(value, 0), ROOM_SIZE);
}

function formatCm(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Image pixels → Front Surface cm.
 * Uses canvasSize for the Y flip. Body Evidence Import v0 uses fixed
 * 2000×2000 / 10 px/cm (not Result JSON, not height-normalized to 200 cm).
 * X keeps image direction; Y is flipped because image Y grows downward while
 * the Front Surface Y axis grows upward.
 */
function mapImagePointToFrontSurface(imageX, imageY, pixelsPerCm, canvasSize = ASSUMED_IMAGE_SIZE_PX) {
  const size = Number.isFinite(canvasSize) && canvasSize > 0
    ? canvasSize
    : ASSUMED_IMAGE_SIZE_PX;
  return {
    h: clampToRoom(imageX / pixelsPerCm),
    v: clampToRoom((size - imageY) / pixelsPerCm),
  };
}

function describeScaleSource(_source, pixelsPerCm) {
  return `fixed Body Evidence v0 assumption (${pixelsPerCm} px/cm)`;
}

/** Display-only short scale line for the 2D marker tooltip. */
function formatShortScaleTooltip(status, _source, pixelsPerCm) {
  return `Scale: ${status ?? 'fixed'} · fixed v0 · ${pixelsPerCm} px/cm`;
}

/**
 * Map accepted front landmark records into inspect/select candidate rows
 * (shared Front Surface image→cm mapping).
 * @param {Array<{ name: string, imageX: number|null, imageY: number|null, score: number|null, lowConfidence?: boolean }>} landmarks
 * @param {string} idPrefix
 * @param {'core'|'secondary'} candidateType
 */
function mapFrontLandmarksToCandidates(landmarks, idPrefix, candidateType) {
  const scaleInfo = getBodyEvidenceScaleInfo();
  const { pixelsPerCm, canvasSize, source, status } = scaleInfo;
  const scaleSource = describeScaleSource(source, pixelsPerCm);
  const scaleTooltip = formatShortScaleTooltip(status, source, pixelsPerCm);

  return landmarks
    .filter((landmark) => (
      (candidateType === 'secondary' || !landmark.lowConfidence)
      && Number.isFinite(landmark.imageX)
      && Number.isFinite(landmark.imageY)
    ))
    .map((landmark, index) => {
      const mapped = mapImagePointToFrontSurface(
        landmark.imageX,
        landmark.imageY,
        pixelsPerCm,
        canvasSize,
      );
      return {
        id: `${idPrefix}-${index}-${landmark.name}`,
        name: landmark.name,
        candidateType,
        view: 'front',
        imageX: landmark.imageX,
        imageY: landmark.imageY,
        score: landmark.score,
        lowConfidence: Boolean(landmark.lowConfidence),
        scaleStatus: status,
        scaleSource,
        scaleTooltip,
        pixelsPerCm,
        canvasSize,
        spaceX: mapped.h,
        spaceY: mapped.v,
        h: mapped.h,
        v: mapped.v,
      };
    });
}

/**
 * Renderable front landmarks that can actually be drawn: restricted to the
 * core 13 front body anchors (positive whitelist), with finite image
 * coordinates and low-confidence entries excluded (core behavior unchanged).
 */
export function getFrontOverlayLandmarks() {
  return mapFrontLandmarksToCandidates(
    getRenderableFrontBodyLandmarks(),
    'body-evidence-front',
    'core',
  );
}

/**
 * Secondary Body Landmark Candidates (list/select/promote only).
 * Same Front Surface mapping as core candidates. Secondary confidence is shown
 * for manual QA rather than suppressing otherwise-stable named body points.
 */
export function getSecondaryCandidateLandmarks() {
  return mapFrontLandmarksToCandidates(
    getSecondaryFrontBodyLandmarks(),
    'body-evidence-secondary',
    'secondary',
  );
}

export function isBodyEvidenceMarkerHovered() {
  return hoveredMarkerId !== null;
}

function escapeTooltipHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildTooltipHtml(landmark) {
  const score = typeof landmark.score === 'number'
    ? landmark.score.toFixed(2)
    : 'n/a';
  const scaleLine = landmark.scaleTooltip
    || `Scale: ${landmark.scaleStatus ?? 'fixed'} · ${landmark.pixelsPerCm} px/cm`;

  // Raw image pixel coordinates are omitted: the mapped Front Surface cm values
  // describe the same point and are the ones the workspace actually uses.
  const rows = [
    ['name', formatLandmarkDisplayName(landmark.name) || landmark.name],
    ['front', `X ${formatCm(landmark.h)} · Y ${formatCm(landmark.v)} cm`],
    ['score', score],
    ['scale', scaleLine.replace(/^Scale:\s*/i, '')],
    ['source', 'body evidence · conceptual'],
  ];

  return (
    `<div class="body-evidence-tooltip">`
    + rows.map(([label, value]) => (
      `<div class="body-evidence-tooltip-row">`
      + `<span class="body-evidence-tooltip-label">${escapeTooltipHtml(label)}</span>`
      + `<span class="body-evidence-tooltip-value">${escapeTooltipHtml(value)}</span>`
      + `</div>`
    )).join('')
    + `</div>`
  );
}

export function hideBodyEvidenceOverlayTooltip() {
  if (bodyEvidenceOverlayTooltipEl) {
    bodyEvidenceOverlayTooltipEl.hidden = true;
  }
  hoveredMarkerId = null;
}

function showTooltip(landmark, clientX, clientY) {
  if (!bodyEvidenceOverlayTooltipEl || !bodyEvidenceOverlayLayerEl) {
    return;
  }

  const wrapper = bodyEvidenceOverlayLayerEl.closest('.grid2d-grid-wrapper');
  if (!wrapper) {
    return;
  }

  bodyEvidenceOverlayTooltipEl.innerHTML = buildTooltipHtml(landmark);
  bodyEvidenceOverlayTooltipEl.classList.add('grid2d-body-evidence-tooltip');

  const rect = wrapper.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  bodyEvidenceOverlayTooltipEl.hidden = false;
  bodyEvidenceOverlayTooltipEl.style.visibility = 'hidden';
  bodyEvidenceOverlayTooltipEl.style.left = '0px';
  bodyEvidenceOverlayTooltipEl.style.top = '0px';

  const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = bodyEvidenceOverlayTooltipEl;

  let left = mouseX + TOOLTIP_OFFSET_PX;
  let top = mouseY + TOOLTIP_OFFSET_PX;

  if (left + tooltipWidth > rect.width) {
    left = mouseX - tooltipWidth - TOOLTIP_OFFSET_PX;
  }
  if (top + tooltipHeight > rect.height) {
    top = mouseY - tooltipHeight - TOOLTIP_OFFSET_PX;
  }

  left = Math.max(0, Math.min(left, rect.width - tooltipWidth));
  top = Math.max(0, Math.min(top, rect.height - tooltipHeight));

  bodyEvidenceOverlayTooltipEl.style.left = `${left}px`;
  bodyEvidenceOverlayTooltipEl.style.top = `${top}px`;
  bodyEvidenceOverlayTooltipEl.style.visibility = 'visible';
}

function requestGrid2dRefresh() {
  if (requestGrid2dRefreshFn) {
    requestGrid2dRefreshFn();
  }
}

/**
 * Marker interaction is inspect/select only. Pointer events are stopped so the
 * Front Surface picker never sees them and A/B stays untouched.
 */
function wireMarkerInteraction(marker, landmark) {
  marker.addEventListener('mouseenter', (event) => {
    hoveredMarkerId = landmark.id;
    showTooltip(landmark, event.clientX, event.clientY);
  });

  marker.addEventListener('mousemove', (event) => {
    hoveredMarkerId = landmark.id;
    showTooltip(landmark, event.clientX, event.clientY);
  });

  marker.addEventListener('mouseleave', () => {
    hideBodyEvidenceOverlayTooltip();
  });

  marker.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  marker.addEventListener('pointerup', (event) => {
    event.stopPropagation();
  });

  marker.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    clearSideEvidenceSelection();
    selectBodyEvidenceLandmark(landmark);
    document.dispatchEvent(new CustomEvent('body-evidence-selection-focus'));
  });

  marker.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    clearSideEvidenceSelection();
    selectBodyEvidenceLandmark(landmark);
    document.dispatchEvent(new CustomEvent('body-evidence-selection-focus'));
  });
}

/**
 * @param {object} options
 * @param {(h: number, v: number) => { left: string, top: string }} options.projectToPercent
 */
export function renderBodyEvidenceOverlay2d({ projectToPercent }) {
  if (!bodyEvidenceOverlayLayerEl || typeof projectToPercent !== 'function') {
    return;
  }

  const coreVisible = isBodyEvidenceOverlayVisible();
  const secondaryVisible = isSecondaryBodyEvidenceVisible();
  const visible = coreVisible || secondaryVisible;
  bodyEvidenceOverlayLayerEl.hidden = !visible;

  if (!visible) {
    bodyEvidenceOverlayLayerEl.replaceChildren();
    hideBodyEvidenceOverlayTooltip();
    return;
  }

  const landmarks = [
    ...(coreVisible ? getFrontOverlayLandmarks() : []),
    ...(secondaryVisible ? getSecondaryCandidateLandmarks() : []),
  ];
  const fragment = document.createDocumentFragment();

  for (const landmark of landmarks) {
    const marker = document.createElement('div');
    marker.className = 'grid2d-body-evidence-marker';
    if (landmark.candidateType === 'secondary') {
      marker.classList.add('grid2d-body-evidence-marker--secondary');
    }
    marker.dataset.bodyEvidenceId = landmark.id;

    const pos = projectToPercent(landmark.h, landmark.v);
    marker.style.left = pos.left;
    marker.style.top = pos.top;
    applyProjectionMarkerSizeStyle(marker, landmark.h, landmark.v);

    if (isSelectedBodyEvidenceLandmark(landmark.id)) {
      marker.classList.add('grid2d-body-evidence-marker--active');
      marker.setAttribute('aria-pressed', 'true');
    } else {
      marker.setAttribute('aria-pressed', 'false');
    }

    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute(
      'aria-label',
      `${formatLandmarkDisplayName(landmark.name) || landmark.name} (${landmark.candidateType} body evidence, front)`,
    );

    wireMarkerInteraction(marker, landmark);
    fragment.appendChild(marker);
  }

  bodyEvidenceOverlayLayerEl.replaceChildren(fragment);
}

export function setupBodyEvidenceOverlay2d(refreshGrid2dNavigator) {
  requestGrid2dRefreshFn = refreshGrid2dNavigator;

  subscribeBodyEvidenceChange(() => {
    hideBodyEvidenceOverlayTooltip();
    requestGrid2dRefresh();
  });
}

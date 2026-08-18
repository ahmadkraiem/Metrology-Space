/**
 * Side Body Evidence overlay (v0)
 * Visual/inspect markers for accepted SIDE body landmarks on the Side
 * Evidence Navigator (U/Y). Selection is Side-local and never promotable.
 * Does not own lattice, measurement, Split, or zoom/pan.
 */

import { ROOM_SIZE } from '../core/constants.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  ASSUMED_IMAGE_SIZE_PX,
  clearBodyEvidenceSelection,
  getBodyEvidenceScaleInfo,
  getRenderableSideBodyLandmarks,
  getSecondarySideBodyLandmarks,
  hasAnalyzedBodyEvidence,
  isSelectedSideEvidenceLandmark,
  isSideCoreBodyEvidenceVisible,
  isSideSecondaryBodyEvidenceVisible,
  selectSideEvidenceLandmark,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  sideEvidenceLandmarksEl,
  sideEvidenceTooltipEl,
  sideEvidenceViewportEl,
} from './domRefs.js';
import { applyProjectionMarkerSizeStyle } from './grid2dMarkerSizing.js';

const TOOLTIP_OFFSET_PX = 18;

/** @type {(() => void) | null} */
let requestSideRefreshFn = null;
/** @type {string | null} */
let hoveredMarkerId = null;

function clampToRoom(value) {
  return Math.min(Math.max(value, 0), ROOM_SIZE);
}

function formatCm(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Image pixels → Side Evidence U/Y cm (evidence plane only; not canonical Z).
 */
export function mapImagePointToSideEvidence(imageX, imageY, pixelsPerCm, canvasSize = ASSUMED_IMAGE_SIZE_PX) {
  const size = Number.isFinite(canvasSize) && canvasSize > 0
    ? canvasSize
    : ASSUMED_IMAGE_SIZE_PX;
  return {
    u: clampToRoom(imageX / pixelsPerCm),
    y: clampToRoom((size - imageY) / pixelsPerCm),
  };
}

function describeScaleSource(_source, pixelsPerCm) {
  return `fixed Body Evidence v0 assumption (${pixelsPerCm} px/cm)`;
}

/**
 * Map accepted side landmark records into Side Evidence candidate rows.
 * @param {Array<{ name: string, imageX: number|null, imageY: number|null, score: number|null, lowConfidence?: boolean, profile?: string }>} landmarks
 * @param {string} idPrefix
 * @param {'core'|'secondary'} candidateType
 */
function mapSideLandmarksToCandidates(landmarks, idPrefix, candidateType) {
  const scaleInfo = getBodyEvidenceScaleInfo();
  const { pixelsPerCm, canvasSize, source, status } = scaleInfo;
  const scaleSource = describeScaleSource(source, pixelsPerCm);

  return landmarks
    .filter((landmark) => (
      Number.isFinite(landmark.imageX)
      && Number.isFinite(landmark.imageY)
    ))
    .map((landmark, index) => {
      const mapped = mapImagePointToSideEvidence(
        landmark.imageX,
        landmark.imageY,
        pixelsPerCm,
        canvasSize,
      );
      return {
        id: `${idPrefix}-${index}-${landmark.name}`,
        name: landmark.name,
        candidateType,
        view: 'side',
        imageX: landmark.imageX,
        imageY: landmark.imageY,
        score: landmark.score ?? null,
        lowConfidence: Boolean(landmark.lowConfidence),
        profile: landmark.profile ?? 'Unknown',
        sideUcm: mapped.u,
        sideYcm: mapped.y,
        scaleStatus: status,
        scaleSource,
        pixelsPerCm,
        canvasSize,
        status: 'Side Evidence / inspect-only',
      };
    });
}

/**
 * Side core overlay landmarks (respects core visibility flag).
 */
export function getSideCoreOverlayLandmarks() {
  if (!hasAnalyzedBodyEvidence() || !isSideCoreBodyEvidenceVisible()) {
    return [];
  }
  return mapSideLandmarksToCandidates(
    getRenderableSideBodyLandmarks(),
    'body-evidence-side-core',
    'core',
  );
}

/**
 * Side secondary overlay landmarks (respects secondary visibility flag).
 */
export function getSideSecondaryOverlayLandmarks() {
  if (!hasAnalyzedBodyEvidence() || !isSideSecondaryBodyEvidenceVisible()) {
    return [];
  }
  return mapSideLandmarksToCandidates(
    getSecondarySideBodyLandmarks(),
    'body-evidence-side-secondary',
    'secondary',
  );
}

/**
 * Map accepted side core and secondary landmarks into Side Evidence overlay candidates.
 */
export function getSideOverlayLandmarks() {
  return [
    ...getSideCoreOverlayLandmarks(),
    ...getSideSecondaryOverlayLandmarks(),
  ];
}

/** All Side candidates for the left inspector list (ignores overlay visibility). */
export function getSideCandidateLandmarks({ layer } = {}) {
  if (!hasAnalyzedBodyEvidence()) {
    return [];
  }

  if (layer === 'core') {
    return mapSideLandmarksToCandidates(
      getRenderableSideBodyLandmarks(),
      'body-evidence-side-core',
      'core',
    );
  }
  if (layer === 'secondary') {
    return mapSideLandmarksToCandidates(
      getSecondarySideBodyLandmarks(),
      'body-evidence-side-secondary',
      'secondary',
    );
  }

  return [
    ...mapSideLandmarksToCandidates(
      getRenderableSideBodyLandmarks(),
      'body-evidence-side-core',
      'core',
    ),
    ...mapSideLandmarksToCandidates(
      getSecondarySideBodyLandmarks(),
      'body-evidence-side-secondary',
      'secondary',
    ),
  ];
}

function escapeTooltipHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildTooltipHtml(landmark) {
  const displayName = formatLandmarkDisplayName(landmark.name) || landmark.name;
  const score = typeof landmark.score === 'number' && Number.isFinite(landmark.score)
    ? landmark.score.toFixed(2)
    : 'n/a';
  const rows = [
    ['U', `${formatCm(landmark.sideUcm)} cm`],
    ['Y', `${formatCm(landmark.sideYcm)} cm`],
    ['source', 'Side'],
    ['confidence', score],
  ];

  return (
    `<div class="grid2d-projection-tooltip-title">${escapeTooltipHtml(displayName)}</div>`
    + rows.map(([key, value]) => (
      `<div class="grid2d-projection-tooltip-row">`
      + `<span class="grid2d-projection-tooltip-key">${escapeTooltipHtml(key)}</span>`
      + `<span class="grid2d-projection-tooltip-value">${escapeTooltipHtml(value)}</span>`
      + `</div>`
    )).join('')
  );
}

export function hideSideEvidenceTooltip() {
  hoveredMarkerId = null;
  if (sideEvidenceTooltipEl) {
    sideEvidenceTooltipEl.hidden = true;
  }
}

export function isSideEvidenceMarkerHovered() {
  return hoveredMarkerId != null;
}

function showSideEvidenceTooltip(landmark, clientX, clientY) {
  if (!sideEvidenceTooltipEl || !sideEvidenceViewportEl) {
    return;
  }

  sideEvidenceTooltipEl.innerHTML = buildTooltipHtml(landmark);
  sideEvidenceTooltipEl.classList.add('side-evidence-tooltip');

  const rect = sideEvidenceViewportEl.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  sideEvidenceTooltipEl.hidden = false;
  sideEvidenceTooltipEl.style.visibility = 'hidden';
  sideEvidenceTooltipEl.style.left = '0px';
  sideEvidenceTooltipEl.style.top = '0px';

  const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = sideEvidenceTooltipEl;

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

  sideEvidenceTooltipEl.style.left = `${left}px`;
  sideEvidenceTooltipEl.style.top = `${top}px`;
  sideEvidenceTooltipEl.style.visibility = 'visible';
}

function wireMarker(marker, landmark) {
  marker.addEventListener('pointerenter', (event) => {
    hoveredMarkerId = landmark.id;
    showSideEvidenceTooltip(landmark, event.clientX, event.clientY);
  });

  marker.addEventListener('pointermove', (event) => {
    if (hoveredMarkerId !== landmark.id) {
      return;
    }
    showSideEvidenceTooltip(landmark, event.clientX, event.clientY);
  });

  marker.addEventListener('pointerleave', () => {
    if (hoveredMarkerId === landmark.id) {
      hideSideEvidenceTooltip();
    }
  });

  marker.addEventListener('click', (event) => {
    event.stopPropagation();
    clearBodyEvidenceSelection();
    selectSideEvidenceLandmark(landmark);
    document.dispatchEvent(new CustomEvent('body-evidence-selection-focus'));
    requestSideRefreshFn?.();
  });

  marker.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    clearBodyEvidenceSelection();
    selectSideEvidenceLandmark(landmark);
    document.dispatchEvent(new CustomEvent('body-evidence-selection-focus'));
    requestSideRefreshFn?.();
  });
}

/**
 * @param {{ projectToPercent: (h: number, v: number) => { left: string, top: string } }} helpers
 */
export function renderSideBodyEvidenceOverlay({ projectToPercent }) {
  if (!sideEvidenceLandmarksEl) {
    return;
  }

  const landmarks = getSideOverlayLandmarks();
  const fragment = document.createDocumentFragment();

  for (const landmark of landmarks) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'side-evidence-marker';
    marker.dataset.sideEvidenceId = landmark.id;

    const pos = projectToPercent(landmark.sideUcm, landmark.sideYcm);
    marker.style.left = pos.left;
    marker.style.top = pos.top;
    applyProjectionMarkerSizeStyle(marker, landmark.sideUcm, landmark.sideYcm);

    if (isSelectedSideEvidenceLandmark(landmark.id)) {
      marker.classList.add('side-evidence-marker--active');
    }
    if (landmark.candidateType === 'secondary') {
      marker.classList.add('side-evidence-marker--secondary');
    } else {
      marker.classList.add('side-evidence-marker--core');
    }

    const displayName = formatLandmarkDisplayName(landmark.name) || landmark.name;
    marker.title = `${displayName} (${landmark.candidateType} side evidence)`;
    marker.setAttribute('aria-label', `${displayName}, Side ${landmark.candidateType} evidence landmark`);

    wireMarker(marker, landmark);
    fragment.appendChild(marker);
  }

  sideEvidenceLandmarksEl.replaceChildren(fragment);
  sideEvidenceLandmarksEl.hidden = landmarks.length === 0;

  if (landmarks.length === 0) {
    hideSideEvidenceTooltip();
  }
}

export function setupBodyEvidenceOverlaySide2d(requestSideRefresh) {
  requestSideRefreshFn = typeof requestSideRefresh === 'function'
    ? requestSideRefresh
    : null;

  subscribeBodyEvidenceChange(() => {
    requestSideRefreshFn?.();
  });
}

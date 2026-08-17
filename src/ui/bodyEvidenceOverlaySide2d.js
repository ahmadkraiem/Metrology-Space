/**
 * Side Evidence view (v0)
 * Evidence-plane U/Y overlay for accepted SIDE body landmarks.
 * Inspection / selection only — no A/B, annotation, promotion, Split, or Z.
 *
 * Conceptual layers (future-ready; only landmark + inspection are active):
 *   source image → segmentation → landmarks [now] → alignment guides → inspection [now]
 */

import { ROOM_SIZE } from '../core/constants.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  ASSUMED_IMAGE_SIZE_PX,
  clearSideEvidenceSelection,
  getBodyEvidenceScaleInfo,
  getRenderableSideBodyLandmarks,
  getSelectedSideEvidenceLandmark,
  hasAnalyzedBodyEvidence,
  isSelectedSideEvidenceLandmark,
  selectSideEvidenceLandmark,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  sideEvidenceAxisLabelsEl,
  sideEvidenceClearSelectionBtn,
  sideEvidenceCountReadoutEl,
  sideEvidenceEmptyEl,
  sideEvidenceFieldEl,
  sideEvidenceInspectEl,
  sideEvidenceLandmarksEl,
  sideEvidenceTooltipEl,
  sideEvidenceViewportEl,
} from './domRefs.js';
import { applyProjectionMarkerSizeStyle } from './grid2dMarkerSizing.js';
import {
  applyPlotAreaCssVars,
  computePlotMetrics,
  plotPercentFromRatio,
  renderPlotAxisLabels,
} from './grid2dPlotArea.js';

const TOOLTIP_OFFSET_PX = 18;

/** @type {ResizeObserver | null} */
let viewportResizeObserver = null;

function clampToRoom(value) {
  return Math.min(Math.max(value, 0), ROOM_SIZE);
}

function formatCm(value) {
  return Math.round(value * 10) / 10;
}

/**
 * Image pixels → Side Evidence U/Y cm (evidence plane only; not canonical Z).
 * Y flips because image Y grows downward while the evidence Y axis grows upward.
 */
function mapImagePointToSideEvidence(imageX, imageY, pixelsPerCm, canvasSize = ASSUMED_IMAGE_SIZE_PX) {
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
 * Map accepted side core landmarks into inspect-only Side Evidence candidates.
 * Partial / occluded sets are valid — no mirroring or fabrication.
 */
function getSideOverlayLandmarks() {
  if (!hasAnalyzedBodyEvidence()) {
    return [];
  }

  const scaleInfo = getBodyEvidenceScaleInfo();
  const { pixelsPerCm, canvasSize, source, status } = scaleInfo;
  const scaleSource = describeScaleSource(source, pixelsPerCm);

  return getRenderableSideBodyLandmarks()
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
        id: `body-evidence-side-${index}-${landmark.name}`,
        name: landmark.name,
        view: 'side',
        candidateType: 'core',
        imageX: landmark.imageX,
        imageY: landmark.imageY,
        score: landmark.score,
        lowConfidence: Boolean(landmark.lowConfidence),
        // No reliable orientation metadata in current parse path.
        profile: 'Unknown',
        scaleStatus: status,
        scaleSource,
        pixelsPerCm,
        canvasSize,
        sideUcm: mapped.u,
        sideYcm: mapped.y,
        u: mapped.u,
        y: mapped.y,
      };
    });
}

/** Same reserved gutters / plot framing as the Front pane. */
function getSidePlotMetrics() {
  if (!sideEvidenceViewportEl) {
    return computePlotMetrics(0, 0);
  }
  return computePlotMetrics(
    sideEvidenceViewportEl.clientWidth,
    sideEvidenceViewportEl.clientHeight,
  );
}

function projectSideToPercent(metrics, u, y) {
  return plotPercentFromRatio(metrics, u / ROOM_SIZE, y / ROOM_SIZE);
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
  const rows = [
    ['name', formatLandmarkDisplayName(landmark.name) || landmark.name],
    ['side', `U ${formatCm(landmark.sideUcm)} · Y ${formatCm(landmark.sideYcm)} cm`],
    ['score', score],
    ['source', 'side pose · evidence'],
    ['profile', landmark.profile ?? 'Unknown'],
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

export function hideSideEvidenceTooltip() {
  if (sideEvidenceTooltipEl) {
    sideEvidenceTooltipEl.hidden = true;
  }
}

function showTooltip(landmark, clientX, clientY) {
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

function wireMarkerInteraction(marker, landmark) {
  marker.addEventListener('mouseenter', (event) => {
    showTooltip(landmark, event.clientX, event.clientY);
  });

  marker.addEventListener('mousemove', (event) => {
    showTooltip(landmark, event.clientX, event.clientY);
  });

  marker.addEventListener('mouseleave', () => {
    hideSideEvidenceTooltip();
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
    selectSideEvidenceLandmark(landmark);
  });

  marker.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectSideEvidenceLandmark(landmark);
  });
}

function renderAxisLabels() {
  renderPlotAxisLabels(sideEvidenceAxisLabelsEl, {
    hAxis: 'u',
    vAxis: 'y',
    maxLabel: `${ROOM_SIZE}`,
  });
}

function renderInspectCard() {
  if (!sideEvidenceInspectEl) {
    return;
  }

  const selected = getSelectedSideEvidenceLandmark();
  const selectionBlock = sideEvidenceInspectEl.closest('.grid2d-selection-block');

  if (!selected) {
    sideEvidenceInspectEl.innerHTML = (
      '<p class="grid2d-selected-readout grid2d-selected-readout--empty">Click a Side landmark to inspect</p>'
    );
    selectionBlock?.classList.add('grid2d-selection-block--empty');
    return;
  }

  selectionBlock?.classList.remove('grid2d-selection-block--empty');

  const displayName = formatLandmarkDisplayName(selected.name) || selected.name;
  const score = typeof selected.score === 'number'
    ? selected.score.toFixed(2)
    : 'n/a';

  sideEvidenceInspectEl.innerHTML = (
    `<p class="grid2d-selected-readout">${escapeTooltipHtml(displayName)}</p>`
    + `<dl class="side-evidence-inspect-grid">`
    + `<div class="side-evidence-inspect-row"><dt>U</dt><dd>${formatCm(selected.sideUcm)} cm</dd></div>`
    + `<div class="side-evidence-inspect-row"><dt>Y</dt><dd>${formatCm(selected.sideYcm)} cm</dd></div>`
    + `<div class="side-evidence-inspect-row"><dt>Source</dt><dd>side pose</dd></div>`
    + `<div class="side-evidence-inspect-row"><dt>Score</dt><dd>${escapeTooltipHtml(score)}</dd></div>`
    + `<div class="side-evidence-inspect-row"><dt>Profile</dt><dd>${escapeTooltipHtml(selected.profile ?? 'Unknown')}</dd></div>`
    + `</dl>`
  );
}

function renderLandmarks(landmarks) {
  if (!sideEvidenceLandmarksEl) {
    return;
  }

  const metrics = getSidePlotMetrics();
  const fragment = document.createDocumentFragment();

  for (const landmark of landmarks) {
    const marker = document.createElement('div');
    marker.className = 'side-evidence-marker';
    marker.dataset.sideEvidenceId = landmark.id;

    const pos = projectSideToPercent(metrics, landmark.sideUcm, landmark.sideYcm);
    marker.style.left = pos.left;
    marker.style.top = pos.top;
    applyProjectionMarkerSizeStyle(marker, landmark.sideUcm, landmark.sideYcm);

    if (isSelectedSideEvidenceLandmark(landmark.id)) {
      marker.classList.add('side-evidence-marker--active');
      marker.setAttribute('aria-pressed', 'true');
    } else {
      marker.setAttribute('aria-pressed', 'false');
    }

    marker.setAttribute('role', 'button');
    marker.setAttribute('tabindex', '0');
    marker.setAttribute(
      'aria-label',
      `${formatLandmarkDisplayName(landmark.name) || landmark.name} (side evidence)`,
    );

    wireMarkerInteraction(marker, landmark);
    fragment.appendChild(marker);
  }

  sideEvidenceLandmarksEl.replaceChildren(fragment);
}

function syncEmptyState(landmarkCount) {
  if (!sideEvidenceEmptyEl || !sideEvidenceViewportEl) {
    return;
  }

  const hasLandmarks = landmarkCount > 0;
  sideEvidenceEmptyEl.hidden = hasLandmarks;
  sideEvidenceViewportEl.classList.toggle('side-evidence-viewport--empty', !hasLandmarks);

  if (!hasAnalyzedBodyEvidence()) {
    sideEvidenceEmptyEl.textContent = 'No side pose landmarks yet — load Side Pose JSON and Analyze.';
  } else if (!hasLandmarks) {
    sideEvidenceEmptyEl.textContent = 'Side pose analyzed — no core body landmarks available to display.';
  }
}

function syncCountReadout(landmarkCount) {
  if (sideEvidenceCountReadoutEl) {
    sideEvidenceCountReadoutEl.textContent = `Landmarks ${landmarkCount}`;
  }
}

/** Inspect-only control: clears the Side selection, nothing else. */
function syncClearSelectionButton() {
  if (!sideEvidenceClearSelectionBtn) {
    return;
  }
  const hasSelection = getSelectedSideEvidenceLandmark() != null;
  sideEvidenceClearSelectionBtn.disabled = !hasSelection;
  sideEvidenceClearSelectionBtn.setAttribute('aria-disabled', hasSelection ? 'false' : 'true');
}

function renderSideEvidenceView() {
  if (!sideEvidenceLandmarksEl) {
    return;
  }

  const landmarks = getSideOverlayLandmarks();

  applyPlotAreaCssVars(sideEvidenceFieldEl, getSidePlotMetrics());
  renderAxisLabels();
  renderLandmarks(landmarks);
  renderInspectCard();
  syncEmptyState(landmarks.length);
  syncCountReadout(landmarks.length);
  syncClearSelectionButton();

  if (landmarks.length === 0) {
    hideSideEvidenceTooltip();
  }
}

export function refreshSideEvidenceView() {
  hideSideEvidenceTooltip();
  renderSideEvidenceView();
}

export function setupBodyEvidenceOverlaySide2d() {
  subscribeBodyEvidenceChange(() => {
    refreshSideEvidenceView();
  });

  if (sideEvidenceViewportEl && typeof ResizeObserver !== 'undefined') {
    viewportResizeObserver = new ResizeObserver(() => {
      renderSideEvidenceView();
    });
    viewportResizeObserver.observe(sideEvidenceViewportEl);
  }

  sideEvidenceViewportEl?.addEventListener('click', (event) => {
    if (event.target === sideEvidenceViewportEl || event.target === sideEvidenceFieldEl) {
      selectSideEvidenceLandmark(null);
    }
  });

  sideEvidenceClearSelectionBtn?.addEventListener('click', () => {
    clearSideEvidenceSelection();
  });

  renderSideEvidenceView();
}
/**
 * Modeled ellipse cross-section preview (visual only).
 *
 * Renders the same Front-width × Side-AP-depth ellipse already used by the
 * selected Hip / Seat circumference result. This panel is a display of that
 * deterministic model, not a body outline or fused spatial reconstruction.
 */

import { formatDistance } from '../core/formatters.js';
import { escapeHtml } from './badgeUi.js';
import {
  getModeledHipSeatCircumference,
  getModeledNaturalWaistCircumference,
} from '../features/bodyEvidence.js';
import {
  getMeasurementHighlight,
  subscribeMeasurementHighlightChange,
} from './measurementHighlightOverlay2d.js';

export const MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID = 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane';
export const MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID = 'torso_modeled_natural_waist_circumference_at_natural_waist_plane';
export const MODELED_ELLIPSE_PREVIEW_DISCLAIMER = 'Ellipse model — not measured contour';

const PREVIEW_CONTAINER_ID = 'modeled-cross-section-preview';

let previewSetupDone = false;

function formatGeometryNumber(value) {
  return String(Number(Number(value).toFixed(4)));
}

function isFinitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function getPreviewContainer() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return null;
  }
  return document.getElementById(PREVIEW_CONTAINER_ID);
}

/**
 * Extracts the modeled ellipse preview from the existing Hip/Seat or Natural Waist contract.
 * Does not recompute perimeter or plane localization.
 *
 * @param {object|null|undefined} record
 * @returns {object|null}
 */
export function resolveModeledEllipsePreviewModel(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const isHipSeat = record.id === MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID
    || record.contract === 'modeled-hip-seat-circumference-v0';
  const isNaturalWaist = record.id === MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID
    || record.contract === 'modeled-natural-waist-circumference-v0';

  if ((!isHipSeat && !isNaturalWaist) || record.status !== 'modeled') {
    return null;
  }

  const widthCm = record.model?.transverseWidthCm
    ?? record.model?.frontDiameterCm
    ?? record.provenance?.frontTransverseWidthCm
    ?? null;
  const depthCm = record.model?.apDepthCm
    ?? record.model?.sideDiameterCm
    ?? record.provenance?.sideQualifiedApDepthCm
    ?? null;
  const perimeterCm = record.valueCm ?? null;
  const levelYcm = record.levelYcm ?? record.yCm ?? record.provenance?.selectedYcm ?? null;

  if (!isFinitePositive(widthCm) || !isFinitePositive(depthCm)) {
    return null;
  }

  const defaultId = isNaturalWaist ? MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID : MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID;

  return {
    measurementId: record.id ?? defaultId,
    planeLabel: isNaturalWaist ? 'Waist Plane Y' : 'Seat Plane Y',
    widthCm,
    depthCm,
    perimeterCm,
    levelYcm,
    semiAxisACm: widthCm / 2,
    semiAxisBCm: depthCm / 2,
    disclaimer: MODELED_ELLIPSE_PREVIEW_DISCLAIMER,
    isModeled: true,
    isMeasuredContour: false,
    is3dReconstruction: false,
  };
}

/**
 * Uniformly scales the ellipse so it fits the viewport while preserving
 * the true width:depth aspect ratio.
 *
 * @param {{ widthCm: number, depthCm: number, viewportWidth: number, viewportHeight: number, padding?: number }} options
 */
export function computeEllipsePreviewLayout({
  widthCm,
  depthCm,
  viewportWidth,
  viewportHeight,
  padding = 16,
} = {}) {
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const scalePxPerCm = Math.min(availableWidth / widthCm, availableHeight / depthCm);
  const ellipseWidthPx = widthCm * scalePxPerCm;
  const ellipseHeightPx = depthCm * scalePxPerCm;

  return {
    scalePxPerCm,
    ellipseWidthPx,
    ellipseHeightPx,
    rxPx: ellipseWidthPx / 2,
    ryPx: ellipseHeightPx / 2,
    cxPx: viewportWidth / 2,
    cyPx: viewportHeight / 2,
    aspectRatio: widthCm / depthCm,
  };
}

/**
 * @param {object|null} model
 * @returns {string}
 */
export function buildModeledEllipsePreviewHtml(model) {
  if (!model) {
    return '';
  }

  const widthCm = model.widthCm;
  const depthCm = model.depthCm;
  const rx = formatGeometryNumber(model.semiAxisACm);
  const ry = formatGeometryNumber(model.semiAxisBCm);
  const cx = formatGeometryNumber(widthCm / 2);
  const cy = formatGeometryNumber(depthCm / 2);
  const padX = widthCm * 0.16;
  const padY = depthCm * 0.22;
  const viewMinX = formatGeometryNumber(-padX);
  const viewMinY = formatGeometryNumber(-padY);
  const viewWidth = formatGeometryNumber(widthCm + padX * 2);
  const viewHeight = formatGeometryNumber(depthCm + padY * 2);
  const widthLabel = typeof model.widthCm === 'number' ? `${formatDistance(model.widthCm)} cm` : '—';
  const depthLabel = typeof model.depthCm === 'number' ? `${formatDistance(model.depthCm)} cm` : '—';
  const perimeterLabel = typeof model.perimeterCm === 'number' ? `${formatDistance(model.perimeterCm)} cm` : '—';
  const yLabel = typeof model.levelYcm === 'number' ? `${formatDistance(model.levelYcm)} cm` : '—';

  return `
    <div class="modeled-cross-section-preview-stage">
      <svg
        class="modeled-cross-section-preview-svg"
        viewBox="${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Modeled ellipse cross-section"
      >
        <ellipse
          class="modeled-cross-section-preview-ellipse"
          cx="${cx}"
          cy="${cy}"
          rx="${rx}"
          ry="${ry}"
          vector-effect="non-scaling-stroke"
        ></ellipse>
        <line
          class="modeled-cross-section-preview-diameter modeled-cross-section-preview-diameter--width"
          x1="0"
          y1="${cy}"
          x2="${formatGeometryNumber(widthCm)}"
          y2="${cy}"
          vector-effect="non-scaling-stroke"
        ></line>
        <line
          class="modeled-cross-section-preview-diameter modeled-cross-section-preview-diameter--depth"
          x1="${cx}"
          y1="0"
          x2="${cx}"
          y2="${formatGeometryNumber(depthCm)}"
          vector-effect="non-scaling-stroke"
        ></line>
      </svg>
    </div>
    <div class="modeled-cross-section-preview-copy">
      <p class="modeled-cross-section-preview-title">Modeled Cross-Section</p>
      <p class="modeled-cross-section-preview-row">Front Width: ${escapeHtml(widthLabel)}</p>
      <p class="modeled-cross-section-preview-row">AP Depth: ${escapeHtml(depthLabel)}</p>
      <p class="modeled-cross-section-preview-row">Modeled Perimeter: ${escapeHtml(perimeterLabel)}</p>
      <p class="modeled-cross-section-preview-row">${escapeHtml(model.planeLabel ?? 'Plane Y')}: ${escapeHtml(yLabel)}</p>
      <p class="modeled-cross-section-preview-disclaimer">${escapeHtml(model.disclaimer)}</p>
    </div>
  `;
}

/**
 * @param {HTMLElement|{ innerHTML: string, hidden: boolean, setAttribute: Function, removeAttribute?: Function }} containerEl
 * @param {object|null} model
 */
export function renderModeledEllipsePreview(containerEl, model) {
  if (!containerEl) {
    return;
  }

  if (!model) {
    containerEl.innerHTML = '';
    containerEl.hidden = true;
    if (typeof containerEl.setAttribute === 'function') {
      containerEl.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  containerEl.innerHTML = buildModeledEllipsePreviewHtml(model);
  containerEl.hidden = false;
  if (typeof containerEl.setAttribute === 'function') {
    containerEl.setAttribute('aria-hidden', 'false');
  }
  if (typeof containerEl.removeAttribute === 'function') {
    containerEl.removeAttribute('hidden');
  }
}

/**
 * @param {object|null} visualization
 * @param {object|null} [record]
 */
export function syncModeledEllipsePreviewFromHighlight(visualization, record = null) {
  const container = getPreviewContainer();
  if (!container) {
    return;
  }

  const isSelectedHipSeat = visualization
    && visualization.measurementId === MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID
    && visualization.status === 'ready';

  const isSelectedNaturalWaist = visualization
    && visualization.measurementId === MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID
    && visualization.status === 'ready';

  if (!isSelectedHipSeat && !isSelectedNaturalWaist) {
    renderModeledEllipsePreview(container, null);
    return;
  }

  let sourceRecord = record;
  if (!sourceRecord) {
    if (isSelectedNaturalWaist) {
      sourceRecord = getModeledNaturalWaistCircumference();
    } else {
      sourceRecord = getModeledHipSeatCircumference();
    }
  }

  renderModeledEllipsePreview(container, resolveModeledEllipsePreviewModel(sourceRecord));
}

export function setupModeledEllipseCrossSectionPreview() {
  if (previewSetupDone) {
    syncModeledEllipsePreviewFromHighlight(getMeasurementHighlight());
    return;
  }
  previewSetupDone = true;
  subscribeMeasurementHighlightChange((visualization) => {
    syncModeledEllipsePreviewFromHighlight(visualization);
  });
  syncModeledEllipsePreviewFromHighlight(getMeasurementHighlight());
}

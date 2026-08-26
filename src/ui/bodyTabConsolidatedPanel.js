/**
 * Body / Anchor Diagnostics (Stage 2).
 *
 * Preserves annotation-only measurement previews and the Front–Side
 * Alignment inspector after the Body tab was removed. Does not mutate
 * Body Evidence, annotations, measurements, or export/import schema.
 */

import { formatDistance } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import {
  buildBodyAnchorAudit,
  getNaturalWaistPlaneLocalization,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { buildAnatomicalMeasurementLines } from '../features/bodyMeasurementLines.js';
import { renderFrontSideAlignmentQa } from './frontSideAlignmentPanel.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { bodyMeasurementReadinessEl } from './domRefs.js';
import {
  selectMeasurement,
  getSelectedMeasurementId,
} from './derivedMeasurementDeck.js';
import { subscribeMeasurementHighlightChange } from './measurementHighlightOverlay2d.js';

const DASH = '—';

function formatCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
}

function formatAnchorLabel(name) {
  return formatLandmarkDisplayName(name) || name || DASH;
}

function formatAnchorList(names) {
  if (!Array.isArray(names) || names.length === 0) {
    return 'None';
  }
  return names.map(formatAnchorLabel).join(', ');
}

function renderReadinessMetric(label, count) {
  return (
    '<div class="body-readiness-metric">'
    + `<span class="body-readiness-metric-label">${escapeHtml(label)}</span>`
    + `<span class="body-readiness-metric-value">${escapeHtml(formatCount(count))}</span>`
    + '</div>'
  );
}

function renderMeasurementCandidate(line) {
  const statusTone = line.status === 'Ready' ? 'ok' : 'warn';
  const fromLabel = formatAnchorLabel(line.from);
  const toLabel = formatAnchorLabel(line.to);
  const pairText = `${fromLabel} → ${toLabel}`;
  const badgeLabel = line.status === 'Ready' ? 'Metric Projected' : line.status;

  let detailHtml;
  if (line.status === 'Ready' && Number.isFinite(line.distanceCm)) {
    detailHtml = (
      `<div class="body-readiness-line-detail">`
      + `<span>From: ${escapeHtml(fromLabel)}</span>`
      + `<span>To: ${escapeHtml(toLabel)}</span>`
      + `<span>Metric Projected: ${escapeHtml(formatDistance(line.distanceCm))} cm</span>`
      + `</div>`
    );
  } else {
    detailHtml = (
      `<div class="body-readiness-line-detail">`
      + `<span>Missing: ${escapeHtml(formatAnchorList(line.missingAnchors))}</span>`
      + `<span class="body-readiness-line-pair">${escapeHtml(pairText)}</span>`
      + `</div>`
    );
  }

  return (
    `<div class="body-readiness-line" data-line-id="${escapeHtml(line.id)}">`
    + `<div class="body-readiness-line-header">`
    + `<span class="body-readiness-line-name">${escapeHtml(line.name)}</span>`
    + renderBadge(badgeLabel, statusTone)
    + `</div>`
    + detailHtml
    + `</div>`
  );
}

function renderNaturalWaistPlaneSection(annotations) {
  const waistReport = getNaturalWaistPlaneLocalization({ annotations });
  if (!waistReport) return '';

  const status = waistReport.status ?? 'unavailable';
  const isReady = status === 'ready';
  const tone = isReady ? 'ok' : (status === 'ambiguous' || status === 'partial' || status === 'warning' ? 'warn' : 'muted');
  const isSelected = getSelectedMeasurementId() === 'natural_waist_plane_localization';
  const yCm = waistReport.yCm;
  const frontWidth = waistReport.selectedCandidate?.frontWidthCm;
  const sideDepth = waistReport.selectedCandidate?.sideQualifiedApDepthCm ?? waistReport.selectedCandidate?.sideRawProfileSpanCm;

  const yDisplay = typeof yCm === 'number' ? `Y ${formatDistance(yCm)} cm` : '—';
  const frontSpanDisplay = typeof frontWidth === 'number' ? `${formatDistance(frontWidth)} cm` : '—';
  const sideSpanDisplay = typeof sideDepth === 'number' ? `${formatDistance(sideDepth)} cm` : (waistReport.sideEvidence?.status === 'unavailable' ? 'Unavailable' : '—');

  return (
    `<div class="body-readiness-line natural-waist-plane-diagnostic ${isSelected ? 'is-selected' : ''}"`
    + ` data-localization-id="natural_waist_plane_localization"`
    + ` data-measurement-id="natural_waist_plane_localization"`
    + ` role="button"`
    + ` tabindex="0"`
    + ` aria-selected="${isSelected ? 'true' : 'false'}"`
    + ` aria-label="Natural Waist Plane Localization: ${escapeHtml(yDisplay)}">`
    + `<div class="body-readiness-line-header">`
    + `<span class="body-readiness-line-name">Natural Waist Plane</span>`
    + renderBadge(isReady ? 'Localized' : status.toUpperCase(), tone)
    + `</div>`
    + `<div class="body-readiness-line-detail">`
    + `<span>Elevation: <strong>${escapeHtml(yDisplay)}</strong></span>`
    + `<span>Front Span: ${escapeHtml(frontSpanDisplay)}</span>`
    + `<span>Side Span: ${escapeHtml(sideSpanDisplay)}</span>`
    + `</div>`
    + `</div>`
  );
}

function renderBodyMeasurementReadiness() {
  if (!bodyMeasurementReadinessEl) {
    return;
  }

  const annotations = getAnnotations();
  const audit = buildBodyAnchorAudit(annotations);
  const { lines } = buildAnatomicalMeasurementLines(annotations);
  const statusTone = audit.status === 'Ready' ? 'ok' : 'warn';
  const overallBadgeLabel = audit.status === 'Ready' ? 'Anchors Qualified' : audit.status;

  bodyMeasurementReadinessEl.innerHTML = [
    '<div class="body-readiness-overview">',
    `<div class="body-readiness-overall">${renderBadge(overallBadgeLabel, statusTone)}</div>`,
    '<div class="body-readiness-metrics">',
    renderReadinessMetric('Missing core anchors', audit.missingCoreAnchors.length),
    renderReadinessMetric('Duplicate body anchor names', audit.duplicateNames.length),
    renderReadinessMetric('Out of bounds', audit.outOfBounds.length),
    renderReadinessMetric('Front-surface Z warnings', audit.frontSurfaceZWarnings.length),
    '</div>',
    '</div>',
    renderNaturalWaistPlaneSection(annotations),
    '<div class="body-readiness-lines">',
    lines.map(renderMeasurementCandidate).join(''),
    '</div>',
  ].join('');
}

export function setupBodyTabConsolidatedPanel() {
  subscribeBodyEvidenceChange(renderFrontSideAlignmentQa);
  subscribeBodyEvidenceChange(renderBodyMeasurementReadiness);
  subscribeAnnotationsChange(renderBodyMeasurementReadiness);
  subscribeMeasurementHighlightChange(renderBodyMeasurementReadiness);

  if (bodyMeasurementReadinessEl && !bodyMeasurementReadinessEl.dataset.waistListenerBound) {
    bodyMeasurementReadinessEl.dataset.waistListenerBound = 'true';
    bodyMeasurementReadinessEl.addEventListener('click', (e) => {
      const card = e.target.closest('[data-localization-id="natural_waist_plane_localization"]');
      if (card) {
        selectMeasurement('natural_waist_plane_localization');
      }
    });
    bodyMeasurementReadinessEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('[data-localization-id="natural_waist_plane_localization"]');
        if (card) {
          e.preventDefault();
          selectMeasurement('natural_waist_plane_localization');
        }
      }
    });
  }

  renderFrontSideAlignmentQa();
  renderBodyMeasurementReadiness();
}

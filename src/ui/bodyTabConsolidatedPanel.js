/**
 * Body / Anchor Diagnostics (Stage 2 / D1 Cleanup).
 *
 * Preserves anchor health metrics (missing core anchors, duplicate names,
 * out-of-bounds, front-surface Z) and the Front–Side Alignment inspector.
 * Does not mutate Body Evidence, annotations, measurements, or export/import schema.
 */

import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import {
  buildBodyAnchorAudit,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { renderFrontSideAlignmentQa } from './frontSideAlignmentPanel.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { bodyMeasurementReadinessEl } from './domRefs.js';

function formatCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
}

function renderReadinessMetric(label, count) {
  return (
    '<div class="body-readiness-metric">'
    + `<span class="body-readiness-metric-label">${escapeHtml(label)}</span>`
    + `<span class="body-readiness-metric-value">${escapeHtml(formatCount(count))}</span>`
    + '</div>'
  );
}

export function renderBodyMeasurementReadiness(targetEl = bodyMeasurementReadinessEl || (typeof document !== 'undefined' ? document.getElementById('body-measurement-readiness') : null)) {
  if (!targetEl) {
    return;
  }

  const annotations = getAnnotations();
  const audit = buildBodyAnchorAudit(annotations);
  const statusTone = audit.status === 'Ready' ? 'ok' : 'warn';
  const overallBadgeLabel = audit.status === 'Ready' ? 'Anchors Qualified' : audit.status;

  targetEl.innerHTML = [
    '<div class="body-readiness-overview">',
    `<div class="body-readiness-overall">${renderBadge(overallBadgeLabel, statusTone)}</div>`,
    '<div class="body-readiness-metrics">',
    renderReadinessMetric('Missing core anchors', audit.missingCoreAnchors.length),
    renderReadinessMetric('Duplicate body anchor names', audit.duplicateNames.length),
    renderReadinessMetric('Out of bounds', audit.outOfBounds.length),
    renderReadinessMetric('Front-surface Z warnings', audit.frontSurfaceZWarnings.length),
    '</div>',
    '</div>',
  ].join('');
}

export function setupBodyTabConsolidatedPanel() {
  subscribeBodyEvidenceChange(renderFrontSideAlignmentQa);
  subscribeBodyEvidenceChange(renderBodyMeasurementReadiness);
  subscribeAnnotationsChange(renderBodyMeasurementReadiness);

  renderFrontSideAlignmentQa();
  renderBodyMeasurementReadiness();
}

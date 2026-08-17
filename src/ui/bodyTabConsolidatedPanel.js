/**
 * Body Tab Consolidation v0 (Session Data → Body).
 *
 * Compact read-only layout:
 * 1. Body Evidence Status (+ collapsed Advanced Evidence Details)
 * 2. Promoted Body Anchors (table)
 * 3. Body Measurement Readiness (audit summary + measurement candidates)
 *
 * Reuses existing compute helpers. Does not mutate Body Evidence, annotations,
 * measurements, or export/import schema. Does not write readiness distances
 * into measurement history.
 */

import { formatCoordinate, formatDistance } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import {
  buildBodyAnchorAudit,
  getBodyEvidenceQa,
  PROMOTED_BODY_LANDMARK_TYPE,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { CORE_FRONT_BODY_ANCHORS } from '../features/bodyEvidenceAdapter.js';
import { buildAnatomicalMeasurementLines } from '../features/bodyMeasurementLines.js';
import {
  sessionBodyEvidenceStatusEl,
  bodyMeasurementReadinessEl,
  promotedBodyAnchorsCountEl,
  promotedBodyAnchorsEmptyEl,
  promotedBodyAnchorsListEl,
} from './domRefs.js';

const EMPTY_EVIDENCE = '<p class="session-empty-state">No body evidence analyzed.</p>';
const DASH = '—';
const CORE_ANCHOR_TOTAL = CORE_FRONT_BODY_ANCHORS.length;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function badgeClassForTone(tone) {
  if (tone === 'ok') {
    return 'body-evidence-badge body-evidence-badge--ok';
  }
  if (tone === 'warn') {
    return 'body-evidence-badge body-evidence-badge--warn';
  }
  return 'body-evidence-badge body-evidence-badge--muted';
}

function renderBadge(label, tone) {
  return `<span class="${badgeClassForTone(tone)}">${escapeHtml(label)}</span>`;
}

function formatCount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '0';
}

function formatText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || DASH;
}

function formatShape(shape) {
  if (!Array.isArray(shape) || shape.length === 0) {
    return DASH;
  }
  return shape.join(' × ');
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

function countLoadedFiles(loaded = {}) {
  return ['frontPose', 'sidePose', 'frontSeg', 'sideSeg']
    .filter((key) => Boolean(loaded[key]))
    .length;
}

function renderSummaryRow(key, valueHtml) {
  return (
    '<div class="body-tab-summary-row">'
    + `<span class="body-tab-summary-key">${escapeHtml(key)}</span>`
    + `<span class="body-tab-summary-value">${valueHtml}</span>`
    + '</div>'
  );
}

function renderTextSummaryRow(key, value) {
  return renderSummaryRow(key, escapeHtml(value));
}

function renderLoadedIndicator(label, loaded) {
  return (
    `<span class="body-tab-loaded-chip${loaded ? ' body-tab-loaded-chip--on' : ''}">`
    + `${escapeHtml(label)}`
    + '</span>'
  );
}

function renderAdvancedRow(key, value) {
  return (
    '<div class="body-evidence-qa-row">'
    + `<span class="body-evidence-qa-key">${escapeHtml(key)}</span>`
    + `<span class="body-evidence-qa-value">${escapeHtml(value)}</span>`
    + '</div>'
  );
}

function renderAdvancedLoadedRow(key, loaded) {
  return (
    '<div class="body-evidence-qa-row">'
    + `<span class="body-evidence-qa-key">${escapeHtml(key)}</span>`
    + `<span class="body-evidence-qa-value">${renderBadge(loaded ? 'loaded' : 'none', loaded ? 'ok' : 'muted')}</span>`
    + '</div>'
  );
}

function hasLabelMetadata(segmentation) {
  return Boolean(segmentation?.labelShape || segmentation?.labelDtype);
}

/**
 * Long landmark-name lists render as vertical items inside their own
 * collapsible subsection instead of one cramped inline paragraph.
 * @param {Array<{ text: string, meta?: string, title?: string }>} items
 */
function renderNameListItems(items) {
  return items.map((item) => (
    `<li class="body-evidence-name-item" title="${escapeHtml(item.title ?? item.text)}">`
    + `<span class="body-evidence-name-text">${escapeHtml(item.text)}</span>`
    + (item.meta ? `<span class="body-evidence-name-meta">${escapeHtml(item.meta)}</span>` : '')
    + '</li>'
  )).join('');
}

function renderNameListSubsection(title, items) {
  const label = `${title} (${items.length})`;
  if (items.length === 0) {
    return (
      '<div class="body-evidence-qa-subgroup body-evidence-qa-subgroup--empty">'
      + `<span class="body-evidence-qa-subgroup-label">${escapeHtml(label)}</span>`
      + `<span class="body-evidence-qa-subgroup-none">${DASH}</span>`
      + '</div>'
    );
  }

  return (
    '<details class="body-evidence-qa-subgroup">'
    + `<summary class="body-evidence-qa-subgroup-summary">${escapeHtml(label)}</summary>`
    + `<ul class="body-evidence-name-list">${renderNameListItems(items)}</ul>`
    + '</details>'
  );
}

function nameItemsFromNames(names) {
  return (Array.isArray(names) ? names : [])
    .filter(Boolean)
    .map((name) => ({ text: formatAnchorLabel(name), title: name }));
}

function nameItemsFromEntries(entries, { withReason = false } = {}) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.name)
    .map((entry) => ({
      text: formatAnchorLabel(entry.name),
      meta: withReason && entry.reason ? entry.reason : '',
      title: entry.name,
    }));
}

function renderAdvancedEvidenceDetails(result) {
  const loaded = result.loaded ?? {};
  const qa = result.qa ?? {};
  const scale = result.scale ?? {};
  const views = result.views ?? {};

  const canvas = Number.isFinite(scale.canvasSize)
    ? `${scale.canvasSize} × ${scale.canvasSize}`
    : '2000 × 2000';
  const pixelsPerCm = Number.isFinite(scale.pixelsPerCm)
    ? String(scale.pixelsPerCm)
    : '10';
  const source = scale.source === 'body-evidence-v0-fixed' || scale.status === 'fixed'
    ? 'fixed Body Evidence v0 assumption'
    : formatText(scale.source);

  const advancedRows = [
    renderAdvancedLoadedRow('Front Pose', loaded.frontPose),
    renderAdvancedLoadedRow('Side Pose', loaded.sidePose),
    renderAdvancedLoadedRow('Front Segmentation', loaded.frontSeg),
    renderAdvancedLoadedRow('Side Segmentation', loaded.sideSeg),
    renderAdvancedRow('Total landmarks', formatCount(qa.totalLandmarks)),
    renderAdvancedRow('Front pose landmarks', formatCount(qa.frontTotalLandmarks)),
    renderAdvancedRow('Accepted body', formatCount(qa.acceptedBodyLandmarks)),
    renderAdvancedRow('Rejected face / head', formatCount(qa.rejectedFaceLandmarks)),
    renderAdvancedRow('Low confidence', formatCount(qa.lowConfidenceLandmarks)),
    renderAdvancedRow('Front accepted', formatCount(qa.frontAcceptedCount)),
    renderAdvancedRow('Side accepted', formatCount(qa.sideAcceptedCount)),
    renderAdvancedRow('Renderable front (core 13)', formatCount(qa.renderableFrontLandmarks)),
    renderAdvancedRow('Secondary front candidates', formatCount(qa.secondaryFrontLandmarks)),
    renderAdvancedRow('Front ignored / deferred', formatCount(qa.frontIgnoredNonCoreLandmarks)),
    renderAdvancedRow('Scale status', formatText(scale.status)),
    renderAdvancedRow('Scale source', source),
    renderAdvancedRow('Canvas size', canvas),
    renderAdvancedRow('Pixels / cm', pixelsPerCm),
    renderAdvancedRow('Segmentation classes', formatCount(qa.segmentationClassCount)),
  ];

  const labelViews = [
    ['Front', views.front?.segmentation],
    ['Side', views.side?.segmentation],
  ].filter(([, segmentation]) => hasLabelMetadata(segmentation));

  if (labelViews.length === 0) {
    advancedRows.push(renderAdvancedRow('Label shape', DASH));
    advancedRows.push(renderAdvancedRow('Label dtype', DASH));
  } else {
    labelViews.forEach(([label, segmentation]) => {
      advancedRows.push(renderAdvancedRow(`${label} label shape`, formatShape(segmentation.labelShape)));
      advancedRows.push(renderAdvancedRow(`${label} label dtype`, formatText(segmentation.labelDtype)));
    });
  }

  const nameSubsections = [
    renderNameListSubsection(
      'Secondary Candidates',
      nameItemsFromNames(qa.secondaryFrontLandmarkNames),
    ),
    renderNameListSubsection(
      'Ignored / Deferred',
      nameItemsFromEntries(qa.ignoredFrontLandmarks, { withReason: true }),
    ),
    renderNameListSubsection(
      'Rejected Face / Head',
      nameItemsFromEntries(qa.rejectedFrontLandmarks),
    ),
    renderNameListSubsection(
      'Rejected Segmentation Classes',
      nameItemsFromNames(qa.rejectedSegmentationClasses),
    ),
  ].join('');

  return (
    '<details class="body-evidence-qa-group body-tab-advanced-details">'
    + '<summary class="body-evidence-qa-summary">Advanced Evidence Details</summary>'
    + `<div class="body-evidence-qa-body">${advancedRows.join('')}</div>`
    + `<div class="body-evidence-qa-sublists">${nameSubsections}</div>`
    + '</details>'
  );
}

function renderBodyEvidenceStatus() {
  if (!sessionBodyEvidenceStatusEl) {
    return;
  }

  const result = getBodyEvidenceQa();
  if (!result) {
    sessionBodyEvidenceStatusEl.innerHTML = EMPTY_EVIDENCE;
    return;
  }

  const loaded = result.loaded ?? {};
  const qa = result.qa ?? {};
  const loadedCount = countLoadedFiles(loaded);
  const acceptedCore = formatCount(qa.renderableFrontLandmarks);

  const loadedChips = [
    renderLoadedIndicator('Front Pose', loaded.frontPose),
    renderLoadedIndicator('Side Pose', loaded.sidePose),
    renderLoadedIndicator('Front Seg', loaded.frontSeg),
    renderLoadedIndicator('Side Seg', loaded.sideSeg),
  ].join('');

  sessionBodyEvidenceStatusEl.innerHTML = [
    '<div class="body-tab-status-card">',
    renderSummaryRow('Evidence', renderBadge('Loaded', 'ok')),
    renderTextSummaryRow('Loaded files', `${loadedCount} / 4`),
    `<div class="body-tab-loaded-chips" aria-label="Loaded file indicators">${loadedChips}</div>`,
    renderTextSummaryRow('Primary / core candidates', `${acceptedCore} / ${CORE_ANCHOR_TOTAL}`),
    renderTextSummaryRow('Secondary candidates', formatCount(qa.secondaryFrontLandmarks)),
    renderTextSummaryRow('Ignored / deferred', formatCount(qa.frontIgnoredNonCoreLandmarks)),
    renderTextSummaryRow('Rejected face / head', formatCount(qa.frontRejectedFaceLandmarks)),
    renderTextSummaryRow('Low confidence', formatCount(qa.lowConfidenceLandmarks)),
    renderTextSummaryRow('Scale', '10 px/cm fixed'),
    renderTextSummaryRow('Segmentation', 'QA only'),
    '</div>',
    renderAdvancedEvidenceDetails(result),
  ].join('');
}

function getPromotedBodyAnchors() {
  return getAnnotations().filter((entry) => entry.type === PROMOTED_BODY_LANDMARK_TYPE);
}

function renderPromotedBodyAnchorRow(entry) {
  const displayName = formatLandmarkDisplayName(entry.name) || entry.name || DASH;
  const point = entry.point ?? {};
  const x = Number.isFinite(point.x) ? formatCoordinate(point.x) : DASH;
  const y = Number.isFinite(point.y) ? formatCoordinate(point.y) : DASH;
  const z = Number.isFinite(point.z) ? formatCoordinate(point.z) : DASH;
  const source = typeof entry.source === 'string' ? entry.source.trim() : '';

  const sourceHtml = source
    ? `<div class="promoted-body-anchor-source">${escapeHtml(source)}</div>`
    : '';

  return (
    `<div class="promoted-body-anchor-row" title="${escapeHtml(entry.name || '')}">`
    + `<div class="promoted-body-anchor-name-cell">`
    + `<span class="promoted-body-anchor-name">${escapeHtml(displayName)}</span>`
    + sourceHtml
    + `</div>`
    + `<span class="promoted-body-anchor-coord">${escapeHtml(x)}</span>`
    + `<span class="promoted-body-anchor-coord">${escapeHtml(y)}</span>`
    + `<span class="promoted-body-anchor-coord">${escapeHtml(z)}</span>`
    + `</div>`
  );
}

function renderPromotedBodyAnchors() {
  if (!promotedBodyAnchorsCountEl || !promotedBodyAnchorsEmptyEl || !promotedBodyAnchorsListEl) {
    return;
  }

  const anchors = getPromotedBodyAnchors();
  promotedBodyAnchorsCountEl.textContent = `Total: ${anchors.length}`;

  if (anchors.length === 0) {
    promotedBodyAnchorsEmptyEl.hidden = false;
    promotedBodyAnchorsListEl.replaceChildren();
    return;
  }

  promotedBodyAnchorsEmptyEl.hidden = true;
  promotedBodyAnchorsListEl.innerHTML = [
    '<div class="promoted-body-anchors-table" role="table" aria-label="Promoted body anchors">',
    '<div class="promoted-body-anchors-header" role="row">',
    '<span role="columnheader">Name</span>',
    '<span role="columnheader">X</span>',
    '<span role="columnheader">Y</span>',
    '<span role="columnheader">Z</span>',
    '</div>',
    anchors.map(renderPromotedBodyAnchorRow).join(''),
    '</div>',
  ].join('');
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

  let detailHtml;
  if (line.status === 'Ready' && Number.isFinite(line.distanceCm)) {
    detailHtml = (
      `<div class="body-readiness-line-detail">`
      + `<span>From: ${escapeHtml(fromLabel)}</span>`
      + `<span>To: ${escapeHtml(toLabel)}</span>`
      + `<span>Distance: ${escapeHtml(formatDistance(line.distanceCm))} cm</span>`
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
    + renderBadge(line.status, statusTone)
    + `</div>`
    + detailHtml
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

  bodyMeasurementReadinessEl.innerHTML = [
    '<div class="body-readiness-overview">',
    `<div class="body-readiness-overall">${renderBadge(audit.status, statusTone)}</div>`,
    '<div class="body-readiness-metrics">',
    renderReadinessMetric('Missing core anchors', audit.missingCoreAnchors.length),
    renderReadinessMetric('Duplicate body anchor names', audit.duplicateNames.length),
    renderReadinessMetric('Out of bounds', audit.outOfBounds.length),
    renderReadinessMetric('Front-surface Z warnings', audit.frontSurfaceZWarnings.length),
    '</div>',
    '</div>',
    '<div class="body-readiness-lines">',
    lines.map(renderMeasurementCandidate).join(''),
    '</div>',
  ].join('');
}

function renderAnnotationDrivenBodySummaries() {
  renderPromotedBodyAnchors();
  renderBodyMeasurementReadiness();
}

export function setupBodyTabConsolidatedPanel() {
  subscribeBodyEvidenceChange(renderBodyEvidenceStatus);
  subscribeAnnotationsChange(renderAnnotationDrivenBodySummaries);
  renderBodyEvidenceStatus();
  renderAnnotationDrivenBodySummaries();
}

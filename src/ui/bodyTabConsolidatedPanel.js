/**
 * Body Tab Consolidation v0 (Session Data → Body).
 *
 * Compact read-only layout:
 * 1. Body Evidence Status (loaded chips + per-view QA totals, Advanced Details)
 * 2. Promoted Body Anchors (annotation-only table)
 * 3. Body Measurement Readiness (annotation-only audit + six candidates)
 *
 * Reuses existing compute helpers. Does not mutate Body Evidence, annotations,
 * measurements, or export/import schema. Does not write readiness distances
 * into measurement history. Promoted/readiness stay annotation-only.
 */

import { formatCoordinate, formatDistance } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import {
  buildBodyAnchorAudit,
  getBodyEvidencePackage,
  getBodyEvidenceQa,
  PROMOTED_BODY_LANDMARK_TYPE,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { renderBodyEvidencePackageQaHtml } from './bodyEvidencePackageQaUi.js';
import { CORE_FRONT_BODY_ANCHORS } from '../features/bodyEvidenceAdapter.js';
import { buildAnatomicalMeasurementLines } from '../features/bodyMeasurementLines.js';
import { renderFrontSideAlignmentQa } from './frontSideAlignmentPanel.js';
import { escapeHtml, badgeClassForTone, renderBadge } from './badgeUi.js';
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

function getViewPose(result, view) {
  return result.views?.[view]?.pose ?? {
    core: 0,
    secondary: 0,
    rejectedFace: 0,
    ignoredNonCore: 0,
    lowConfidence: 0,
    acceptedLandmarks: [],
    rejectedLandmarks: [],
    ignoredLandmarks: [],
  };
}

function nameItemsFromCore(landmarks) {
  return nameItemsFromEntries(
    (Array.isArray(landmarks) ? landmarks : []).filter((entry) => entry?.coreFront),
  );
}

function nameItemsFromLowConfidence(landmarks) {
  return (Array.isArray(landmarks) ? landmarks : [])
    .filter((entry) => entry?.lowConfidence && entry.name)
    .map((entry) => ({
      text: formatAnchorLabel(entry.name),
      meta: Number.isFinite(entry.score) ? `score ${entry.score}` : 'low confidence',
      title: entry.name,
    }));
}

function formatCoreCount(count) {
  return `${formatCount(count)} / ${CORE_ANCHOR_TOTAL}`;
}

function formatScaleLabel(scale) {
  const pixelsPerCm = Number.isFinite(scale?.pixelsPerCm) ? scale.pixelsPerCm : 10;
  return `${pixelsPerCm} px/cm · fixed`;
}

function formatSegmentationStatus(qa, loaded) {
  if (!loaded.frontSeg && !loaded.sideSeg) {
    return 'none';
  }
  const classCount = typeof qa.segmentationClassCount === 'number'
    ? qa.segmentationClassCount
    : 0;
  return classCount > 0 ? `QA · ${classCount} classes` : 'QA only';
}

function renderViewBreakdown(label, {
  core,
  secondary,
  rejected,
  ignored,
  lowConfidence,
  coreItems,
  secondaryItems,
  rejectedItems,
  ignoredItems,
  lowConfidenceItems,
}) {
  return (
    `<section class="body-tab-advanced-view" aria-label="${escapeHtml(label)} evidence">`
    + `<h4 class="body-tab-advanced-view-title">${escapeHtml(label)}</h4>`
    + renderAdvancedRow('Core', formatCount(core))
    + renderAdvancedRow('Secondary', formatCount(secondary))
    + renderAdvancedRow('Rejected', formatCount(rejected))
    + renderAdvancedRow('Ignored / Deferred', formatCount(ignored))
    + renderAdvancedRow('Low Confidence', formatCount(lowConfidence))
    + '<div class="body-evidence-qa-sublists">'
    + renderNameListSubsection('Core', coreItems)
    + renderNameListSubsection('Secondary', secondaryItems)
    + renderNameListSubsection('Rejected', rejectedItems)
    + renderNameListSubsection('Ignored / Deferred', ignoredItems)
    + renderNameListSubsection('Low Confidence', lowConfidenceItems)
    + '</div>'
    + '</section>'
  );
}

function renderSegmentationDetails(result) {
  const loaded = result.loaded ?? {};
  const qa = result.qa ?? {};
  const views = result.views ?? {};

  const rows = [
    renderAdvancedLoadedRow('Front Segmentation', loaded.frontSeg),
    renderAdvancedLoadedRow('Side Segmentation', loaded.sideSeg),
    renderAdvancedRow('Classes', formatCount(qa.segmentationClassCount)),
  ];

  const labelViews = [
    ['Front', views.front?.segmentation],
    ['Side', views.side?.segmentation],
  ];

  let hasAnyLabelMetadata = false;
  labelViews.forEach(([label, segmentation]) => {
    if (!hasLabelMetadata(segmentation)) {
      return;
    }
    hasAnyLabelMetadata = true;
    rows.push(renderAdvancedRow(`${label} label shape`, formatShape(segmentation.labelShape)));
    rows.push(renderAdvancedRow(`${label} label dtype`, formatText(segmentation.labelDtype)));
  });

  if (!hasAnyLabelMetadata) {
    rows.push(renderAdvancedRow('Label shape', DASH));
    rows.push(renderAdvancedRow('Label dtype', DASH));
  }

  return (
    '<details class="body-evidence-qa-subgroup body-tab-seg-details">'
    + '<summary class="body-evidence-qa-subgroup-summary">Segmentation metadata</summary>'
    + `<div class="body-evidence-qa-body">${rows.join('')}</div>`
    + '<div class="body-evidence-qa-sublists">'
    + renderNameListSubsection(
      'Rejected Classes',
      nameItemsFromNames(qa.rejectedSegmentationClasses),
    )
    + '</div>'
    + '</details>'
  );
}

function renderAdvancedEvidenceDetails(result) {
  const qa = result.qa ?? {};
  const frontPose = getViewPose(result, 'front');
  const sidePose = getViewPose(result, 'side');

  const frontBreakdown = renderViewBreakdown('Front', {
    core: qa.frontCoreLandmarks ?? frontPose.core,
    secondary: qa.frontSecondaryLandmarks ?? frontPose.secondary,
    rejected: qa.frontRejectedFaceLandmarks ?? frontPose.rejectedFace,
    ignored: qa.frontIgnoredNonCoreLandmarks ?? frontPose.ignoredNonCore,
    lowConfidence: frontPose.lowConfidence,
    coreItems: nameItemsFromCore(frontPose.acceptedLandmarks),
    secondaryItems: nameItemsFromNames(qa.secondaryFrontLandmarkNames),
    rejectedItems: nameItemsFromEntries(qa.rejectedFrontLandmarks ?? frontPose.rejectedLandmarks),
    ignoredItems: nameItemsFromEntries(
      qa.ignoredFrontLandmarks ?? frontPose.ignoredLandmarks,
      { withReason: true },
    ),
    lowConfidenceItems: nameItemsFromLowConfidence(frontPose.acceptedLandmarks),
  });

  const sideBreakdown = renderViewBreakdown('Side', {
    core: qa.sideCoreLandmarks ?? sidePose.core,
    secondary: qa.sideSecondaryLandmarks ?? sidePose.secondary,
    rejected: qa.sideRejectedFaceLandmarks ?? sidePose.rejectedFace,
    ignored: qa.sideIgnoredNonCoreLandmarks ?? sidePose.ignoredNonCore,
    lowConfidence: sidePose.lowConfidence,
    coreItems: nameItemsFromCore(sidePose.acceptedLandmarks),
    secondaryItems: nameItemsFromNames(qa.secondarySideLandmarkNames),
    rejectedItems: nameItemsFromEntries(qa.rejectedSideLandmarks ?? sidePose.rejectedLandmarks),
    ignoredItems: nameItemsFromEntries(
      qa.ignoredSideLandmarks ?? sidePose.ignoredLandmarks,
      { withReason: true },
    ),
    lowConfidenceItems: nameItemsFromLowConfidence(sidePose.acceptedLandmarks),
  });

  return (
    '<details class="body-evidence-qa-group body-tab-advanced-details">'
    + '<summary class="body-evidence-qa-summary">Advanced Evidence Details</summary>'
    + `<div class="body-tab-advanced-body">${frontBreakdown}${sideBreakdown}${renderSegmentationDetails(result)}</div>`
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

  const loadedChips = [
    renderLoadedIndicator('Front Pose', loaded.frontPose),
    renderLoadedIndicator('Side Pose', loaded.sidePose),
    renderLoadedIndicator('Front Seg', loaded.frontSeg),
    renderLoadedIndicator('Side Seg', loaded.sideSeg),
  ].join('');

  const pkg = getBodyEvidencePackage();
  const packageQaCard = pkg ? renderBodyEvidencePackageQaHtml(pkg) : '';

  sessionBodyEvidenceStatusEl.innerHTML = [
    packageQaCard,
    '<div class="body-tab-status-card">',
    `<div class="body-tab-loaded-chips" aria-label="Loaded file indicators">${loadedChips}</div>`,
    renderTextSummaryRow('Front Core', formatCoreCount(qa.frontCoreLandmarks)),
    renderTextSummaryRow('Front Secondary', formatCount(qa.frontSecondaryLandmarks)),
    renderTextSummaryRow('Side Core', formatCoreCount(qa.sideCoreLandmarks)),
    renderTextSummaryRow('Side Secondary', formatCount(qa.sideSecondaryLandmarks)),
    renderTextSummaryRow('Rejected Total', formatCount(qa.rejectedFaceLandmarks)),
    renderTextSummaryRow('Ignored / Deferred Total', formatCount(qa.ignoredNonCoreLandmarks)),
    renderTextSummaryRow('Low Confidence', formatCount(qa.lowConfidenceLandmarks)),
    renderTextSummaryRow('Scale', formatScaleLabel(result.scale)),
    renderTextSummaryRow('Segmentation', formatSegmentationStatus(qa, loaded)),
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

function renderEvidenceDrivenBodySummaries() {
  renderBodyEvidenceStatus();
  renderFrontSideAlignmentQa();
}

function renderAnnotationDrivenBodySummaries() {
  renderPromotedBodyAnchors();
  renderBodyMeasurementReadiness();
}

export function setupBodyTabConsolidatedPanel() {
  subscribeBodyEvidenceChange(renderEvidenceDrivenBodySummaries);
  subscribeAnnotationsChange(renderAnnotationDrivenBodySummaries);
  renderEvidenceDrivenBodySummaries();
  renderAnnotationDrivenBodySummaries();
}

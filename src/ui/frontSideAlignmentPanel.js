/**
 * Front–Side Alignment QA presentation panel (v0)
 *
 * Read-only Diagnostics → Front–Side Alignment inspector.
 * Renders the deterministic Front–Side Alignment v0 report in compact form:
 * - Summary counts & tolerance (always visible)
 * - Collapsible Core Pairs (N)
 * - Collapsible Secondary Pairs (N)
 * - Collapsible Issues (N) (warnings, unavailables, front-only, side-only)
 *
 * STRICT GUARDRAIL:
 * Presentation only. Does not convert U to Z, infer depth, reconstruct 3D,
 * promote side candidates, compute volumes, or mutate evidence/annotation state.
 */

import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import { hasAnalyzedBodyEvidence } from '../features/bodyEvidence.js';
import {
  getFrontOverlayLandmarks,
  getSecondaryCandidateLandmarks,
} from './bodyEvidenceOverlay2d.js';
import {
  getSideCandidateLandmarks,
} from './bodyEvidenceOverlaySide2d.js';
import {
  computeFrontSideAlignment,
} from '../features/frontSideAlignment.js';
import { frontSideAlignmentQaEl } from './domRefs.js';
import { escapeHtml, badgeClassForTone, renderBadge } from './badgeUi.js';

function formatCm(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return String(Math.round(value * 10) / 10);
}

function formatDelta(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'ΔY —';
  }
  return `ΔY ${(Math.round(value * 10) / 10).toFixed(1)} cm`;
}

function renderClassificationBadge(classification) {
  const isCore = classification === 'core';
  const label = isCore ? 'Core' : 'Secondary';
  const tone = isCore ? 'ok' : 'muted';
  return renderBadge(label, tone, `${label} landmark`);
}

function renderStatusBadge(status) {
  if (status === 'aligned') {
    return renderBadge('aligned', 'ok', 'Vertical Y delta is within tolerance');
  }
  if (status === 'warning') {
    return renderBadge('warning', 'warn', 'Vertical Y delta exceeds tolerance');
  }
  return renderBadge('unavailable', 'muted', 'Vertical Y coordinate unavailable or incomplete');
}

function renderSummaryRow(key, valueHtml) {
  return (
    '<div class="body-tab-summary-row">'
    + `<span class="body-tab-summary-key">${escapeHtml(key)}</span>`
    + `<span class="body-tab-summary-value">${valueHtml}</span>`
    + '</div>'
  );
}

function renderSummaryCard(report) {
  const { summary, toleranceCm } = report;
  const toleranceLabel = `${toleranceCm.toFixed(1)} cm`;

  return (
    '<div class="body-tab-status-card front-side-alignment-card">'
    + renderSummaryRow('Tolerance', escapeHtml(toleranceLabel))
    + renderSummaryRow('Matched', escapeHtml(String(summary.totalMatched)))
    + renderSummaryRow('Aligned', renderBadge(String(summary.alignedCount), summary.alignedCount > 0 ? 'ok' : 'muted'))
    + renderSummaryRow('Warnings', renderBadge(String(summary.warningCount), summary.warningCount > 0 ? 'warn' : 'muted'))
    + renderSummaryRow('Unavailable', renderBadge(String(summary.unavailableCount), summary.unavailableCount > 0 ? 'warn' : 'muted'))
    + renderSummaryRow('Core Matched', escapeHtml(String(summary.coreMatchedCount)))
    + renderSummaryRow('Secondary Matched', escapeHtml(String(summary.secondaryMatchedCount)))
    + '<div class="front-side-alignment-notice">'
    + `<p class="front-side-alignment-note">Vertical Y agreement only · tolerance ${escapeHtml(toleranceLabel)}</p>`
    + '<p class="front-side-alignment-note front-side-alignment-note--guardrail">Side U is profile evidence — NOT depth Z</p>'
    + '</div>'
    + '</div>'
  );
}

function renderCompactPairRow(pair) {
  const displayName = formatLandmarkDisplayName(pair.identity) || pair.name || pair.identity;
  const frontCoords = `X ${formatCm(pair.front?.x)} · Y ${formatCm(pair.front?.y)}`;
  const sideCoords = `U ${formatCm(pair.side?.u)} · Y ${formatCm(pair.side?.y)}`;
  const deltaText = formatDelta(pair.verticalDeltaCm);

  return (
    `<div class="front-side-alignment-compact-row front-side-alignment-compact-row--${escapeHtml(pair.status)}" data-landmark="${escapeHtml(pair.identity)}">`
    + '<div class="front-side-alignment-compact-line1">'
    + `<span class="front-side-alignment-compact-name">${escapeHtml(displayName)}</span>`
    + '<div class="front-side-alignment-compact-meta">'
    + renderClassificationBadge(pair.classification)
    + `<span class="front-side-alignment-compact-delta${pair.status === 'warning' ? ' front-side-alignment-compact-delta--warn' : ''}">${escapeHtml(deltaText)}</span>`
    + renderStatusBadge(pair.status)
    + '</div>'
    + '</div>'
    + '<div class="front-side-alignment-compact-line2">'
    + `<span class="front-side-alignment-coord-segment"><span class="front-side-alignment-coord-tag">Front:</span> <span class="front-side-alignment-coord-val">${escapeHtml(frontCoords)}</span></span>`
    + '<span class="front-side-alignment-coord-sep" aria-hidden="true">·</span>'
    + `<span class="front-side-alignment-coord-segment"><span class="front-side-alignment-coord-tag">Side:</span> <span class="front-side-alignment-coord-val">${escapeHtml(sideCoords)}</span></span>`
    + '</div>'
    + '</div>'
  );
}

function renderFrontOnlyIssueRow(item) {
  const displayName = formatLandmarkDisplayName(item.identity) || item.name || item.identity;
  const frontCoords = `X ${formatCm(item.front?.x)} · Y ${formatCm(item.front?.y)}`;

  return (
    `<div class="front-side-alignment-compact-row front-side-alignment-compact-row--unavailable" data-landmark="${escapeHtml(item.identity)}">`
    + '<div class="front-side-alignment-compact-line1">'
    + `<span class="front-side-alignment-compact-name">${escapeHtml(displayName)}</span>`
    + '<div class="front-side-alignment-compact-meta">'
    + renderClassificationBadge(item.classification)
    + renderBadge(item.reason, 'warn', 'Missing in Side view')
    + renderStatusBadge('unavailable')
    + '</div>'
    + '</div>'
    + '<div class="front-side-alignment-compact-line2">'
    + `<span class="front-side-alignment-coord-segment"><span class="front-side-alignment-coord-tag">Front:</span> <span class="front-side-alignment-coord-val">${escapeHtml(frontCoords)}</span></span>`
    + '<span class="front-side-alignment-coord-sep" aria-hidden="true">·</span>'
    + '<span class="front-side-alignment-coord-segment"><span class="front-side-alignment-coord-tag">Side:</span> <span class="front-side-alignment-coord-val">missing</span></span>'
    + '</div>'
    + '</div>'
  );
}

function renderSideOnlyIssueRow(item) {
  const displayName = formatLandmarkDisplayName(item.identity) || item.name || item.identity;
  const sideCoords = `U ${formatCm(item.side?.u)} · Y ${formatCm(item.side?.y)}`;

  return (
    `<div class="front-side-alignment-compact-row front-side-alignment-compact-row--unavailable" data-landmark="${escapeHtml(item.identity)}">`
    + '<div class="front-side-alignment-compact-line1">'
    + `<span class="front-side-alignment-compact-name">${escapeHtml(displayName)}</span>`
    + '<div class="front-side-alignment-compact-meta">'
    + renderClassificationBadge(item.classification)
    + renderBadge(item.reason, 'warn', 'Missing in Front view')
    + renderStatusBadge('unavailable')
    + '</div>'
    + '</div>'
    + '<div class="front-side-alignment-compact-line2">'
    + '<span class="front-side-alignment-coord-segment"><span class="front-side-alignment-coord-tag">Front:</span> <span class="front-side-alignment-coord-val">missing</span></span>'
    + '<span class="front-side-alignment-coord-sep" aria-hidden="true">·</span>'
    + `<span class="front-side-alignment-coord-segment"><span class="front-side-alignment-coord-tag">Side:</span> <span class="front-side-alignment-coord-val">${escapeHtml(sideCoords)}</span></span>`
    + '</div>'
    + '</div>'
  );
}

function renderIssueRow(issue) {
  if (issue.issueType === 'frontOnly') {
    return renderFrontOnlyIssueRow(issue);
  }
  if (issue.issueType === 'sideOnly') {
    return renderSideOnlyIssueRow(issue);
  }
  return renderCompactPairRow(issue);
}

function renderCollapsibleGroup(title, count, innerHtml) {
  return (
    '<details class="body-evidence-qa-subgroup">'
    + `<summary class="body-evidence-qa-subgroup-summary">${escapeHtml(title)} (${count})</summary>`
    + `<div class="front-side-alignment-compact-list">${innerHtml}</div>`
    + '</details>'
  );
}

function renderGroupedSections(report) {
  const matchedPairs = Array.isArray(report?.matchedPairs) ? report.matchedPairs : [];
  const frontOnly = Array.isArray(report?.frontOnly) ? report.frontOnly : [];
  const sideOnly = Array.isArray(report?.sideOnly) ? report.sideOnly : [];

  const corePairs = matchedPairs.filter((pair) => pair.classification === 'core');
  const secondaryPairs = matchedPairs.filter((pair) => pair.classification === 'secondary');

  const matchedIssues = matchedPairs.filter((pair) => pair.status === 'warning' || pair.status === 'unavailable');
  const issueItems = [
    ...matchedIssues,
    ...frontOnly.map((item) => ({ ...item, issueType: 'frontOnly' })),
    ...sideOnly.map((item) => ({ ...item, issueType: 'sideOnly' })),
  ];

  const coreHtml = corePairs.length > 0
    ? corePairs.map(renderCompactPairRow).join('')
    : '<p class="session-empty-state">No core matched pairs.</p>';

  const secondaryHtml = secondaryPairs.length > 0
    ? secondaryPairs.map(renderCompactPairRow).join('')
    : '<p class="session-empty-state">No secondary matched pairs.</p>';

  const issuesHtml = issueItems.length > 0
    ? issueItems.map(renderIssueRow).join('')
    : '<p class="session-empty-state">No alignment issues found.</p>';

  return (
    '<div class="front-side-alignment-groups">'
    + renderCollapsibleGroup('Core Pairs', corePairs.length, coreHtml)
    + renderCollapsibleGroup('Secondary Pairs', secondaryPairs.length, secondaryHtml)
    + renderCollapsibleGroup('Issues', issueItems.length, issuesHtml)
    + '</div>'
  );
}

/**
 * Build the Front–Side Alignment QA HTML string from a report object.
 *
 * @param {object} report
 * @param {{ hasAnalyzed?: boolean, frontCount?: number, sideCount?: number }} [context]
 * @returns {string}
 */
export function buildFrontSideAlignmentHtml(
  report,
  { hasAnalyzed = true, frontCount = 0, sideCount = 0 } = {},
) {
  if (!hasAnalyzed) {
    return '<p class="session-empty-state">No body evidence analyzed.</p>';
  }

  if (!report || (frontCount === 0 && sideCount === 0)) {
    return '<p class="session-empty-state">No body landmark candidates found in analyzed evidence.</p>';
  }

  if (frontCount > 0 && sideCount === 0) {
    return (
      '<div class="body-tab-status-card front-side-alignment-card">'
      + `<p class="front-side-alignment-note">Front evidence analyzed (<strong>${frontCount}</strong> candidates), but no Side candidates available.</p>`
      + '<p class="front-side-alignment-note front-side-alignment-note--guardrail">Load Side Pose to evaluate vertical Y alignment.</p>'
      + '</div>'
      + renderGroupedSections(report)
    );
  }

  if (frontCount === 0 && sideCount > 0) {
    return (
      '<div class="body-tab-status-card front-side-alignment-card">'
      + `<p class="front-side-alignment-note">Side evidence analyzed (<strong>${sideCount}</strong> candidates), but no Front candidates available.</p>`
      + '<p class="front-side-alignment-note front-side-alignment-note--guardrail">Load Front Pose to evaluate vertical Y alignment.</p>'
      + '</div>'
      + renderGroupedSections(report)
    );
  }

  return (
    renderSummaryCard(report)
    + renderGroupedSections(report)
  );
}

/**
 * Render the Front–Side Alignment QA section into targetEl.
 *
 * @param {HTMLElement|null} [targetEl]
 */
export function renderFrontSideAlignmentQa(targetEl = frontSideAlignmentQaEl) {
  if (!targetEl) {
    return;
  }

  const analyzed = hasAnalyzedBodyEvidence();
  if (!analyzed) {
    targetEl.innerHTML = '<p class="session-empty-state">No body evidence analyzed.</p>';
    return;
  }

  const frontCandidates = [
    ...getFrontOverlayLandmarks(),
    ...getSecondaryCandidateLandmarks(),
  ];
  const sideCandidates = getSideCandidateLandmarks();

  const report = computeFrontSideAlignment(frontCandidates, sideCandidates);

  targetEl.innerHTML = buildFrontSideAlignmentHtml(report, {
    hasAnalyzed: true,
    frontCount: frontCandidates.length,
    sideCount: sideCandidates.length,
  });
}

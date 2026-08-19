/**
 * Front–Side Alignment QA presentation panel (v0)
 *
 * Read-only Session Data → Body tab inspector section.
 * Renders the deterministic Front–Side Alignment v0 report:
 * - Summary counts & tolerance
 * - Pair-level vertical delta (ΔY) audit table
 * - Front-only & Side-only subsections
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatCm(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return String(Math.round(value * 10) / 10);
}

function formatDelta(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  return `${(Math.round(value * 10) / 10).toFixed(1)} cm`;
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

function renderBadge(label, tone = 'default', title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<span class="${badgeClassForTone(tone)}"${titleAttr}>${escapeHtml(label)}</span>`;
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

function renderMatchedPairRow(pair) {
  const displayName = formatLandmarkDisplayName(pair.identity) || pair.name || pair.identity;
  const frontCoords = `X ${formatCm(pair.front.x)} · Y ${formatCm(pair.front.y)}`;
  const sideCoords = `U ${formatCm(pair.side.u)} · Y ${formatCm(pair.side.y)}`;
  const deltaText = formatDelta(pair.verticalDeltaCm);

  return (
    `<div class="front-side-alignment-row front-side-alignment-row--${escapeHtml(pair.status)}" data-landmark="${escapeHtml(pair.identity)}">`
    + '<div class="front-side-alignment-row-header">'
    + `<span class="front-side-alignment-row-name">${escapeHtml(displayName)}</span>`
    + '<div class="front-side-alignment-row-badges">'
    + renderClassificationBadge(pair.classification)
    + renderStatusBadge(pair.status)
    + '</div>'
    + '</div>'
    + '<div class="front-side-alignment-row-details">'
    + '<div class="front-side-alignment-row-coords">'
    + '<span class="front-side-alignment-coord-tag">Front:</span>'
    + `<span class="front-side-alignment-coord-val">${escapeHtml(frontCoords)}</span>`
    + '</div>'
    + '<div class="front-side-alignment-row-coords">'
    + '<span class="front-side-alignment-coord-tag">Side:</span>'
    + `<span class="front-side-alignment-coord-val">${escapeHtml(sideCoords)}</span>`
    + '</div>'
    + '<div class="front-side-alignment-row-delta">'
    + '<span class="front-side-alignment-delta-label">ΔY:</span>'
    + `<span class="front-side-alignment-delta-value${pair.status === 'warning' ? ' front-side-alignment-delta-value--warn' : ''}">${escapeHtml(deltaText)}</span>`
    + '</div>'
    + '</div>'
    + '</div>'
  );
}

function renderMatchedPairsList(matchedPairs) {
  if (!Array.isArray(matchedPairs) || matchedPairs.length === 0) {
    return '<p class="session-empty-state">No matching landmark identities found between Front and Side.</p>';
  }

  return (
    '<div class="front-side-alignment-pairs-list" role="feed" aria-label="Matched landmark alignment pairs">'
    + matchedPairs.map(renderMatchedPairRow).join('')
    + '</div>'
  );
}

function renderFrontOnlyItem(item) {
  const displayName = formatLandmarkDisplayName(item.identity) || item.name || item.identity;
  const coords = `X ${formatCm(item.front.x)} · Y ${formatCm(item.front.y)}`;

  return (
    `<div class="front-side-unmatched-item" title="${escapeHtml(item.name || item.identity)}">`
    + '<div class="front-side-unmatched-header">'
    + `<span class="front-side-unmatched-name">${escapeHtml(displayName)}</span>`
    + '<div class="front-side-alignment-row-badges">'
    + renderClassificationBadge(item.classification)
    + renderBadge(item.reason, 'muted')
    + '</div>'
    + '</div>'
    + '<div class="front-side-unmatched-coords">'
    + '<span class="front-side-alignment-coord-tag">Front:</span> '
    + `<span class="front-side-alignment-coord-val">${escapeHtml(coords)}</span>`
    + '</div>'
    + '</div>'
  );
}

function renderSideOnlyItem(item) {
  const displayName = formatLandmarkDisplayName(item.identity) || item.name || item.identity;
  const coords = `U ${formatCm(item.side.u)} · Y ${formatCm(item.side.y)}`;

  return (
    `<div class="front-side-unmatched-item" title="${escapeHtml(item.name || item.identity)}">`
    + '<div class="front-side-unmatched-header">'
    + `<span class="front-side-unmatched-name">${escapeHtml(displayName)}</span>`
    + '<div class="front-side-alignment-row-badges">'
    + renderClassificationBadge(item.classification)
    + renderBadge(item.reason, 'muted')
    + '</div>'
    + '</div>'
    + '<div class="front-side-unmatched-coords">'
    + '<span class="front-side-alignment-coord-tag">Side:</span> '
    + `<span class="front-side-alignment-coord-val">${escapeHtml(coords)}</span>`
    + '</div>'
    + '</div>'
  );
}

function renderUnmatchedSubsections(report) {
  const { frontOnly = [], sideOnly = [] } = report;
  const sections = [];

  if (frontOnly.length > 0) {
    sections.push(
      '<details class="body-evidence-qa-subgroup front-side-unmatched-subgroup">'
      + `<summary class="body-evidence-qa-subgroup-summary">Front Only (${frontOnly.length})</summary>`
      + `<div class="front-side-unmatched-list">${frontOnly.map(renderFrontOnlyItem).join('')}</div>`
      + '</details>',
    );
  }

  if (sideOnly.length > 0) {
    sections.push(
      '<details class="body-evidence-qa-subgroup front-side-unmatched-subgroup">'
      + `<summary class="body-evidence-qa-subgroup-summary">Side Only (${sideOnly.length})</summary>`
      + `<div class="front-side-unmatched-list">${sideOnly.map(renderSideOnlyItem).join('')}</div>`
      + '</details>',
    );
  }

  return sections.join('');
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
      + renderUnmatchedSubsections(report)
    );
  }

  if (frontCount === 0 && sideCount > 0) {
    return (
      '<div class="body-tab-status-card front-side-alignment-card">'
      + `<p class="front-side-alignment-note">Side evidence analyzed (<strong>${sideCount}</strong> candidates), but no Front candidates available.</p>`
      + '<p class="front-side-alignment-note front-side-alignment-note--guardrail">Load Front Pose to evaluate vertical Y alignment.</p>'
      + '</div>'
      + renderUnmatchedSubsections(report)
    );
  }

  return (
    renderSummaryCard(report)
    + renderMatchedPairsList(report.matchedPairs)
    + renderUnmatchedSubsections(report)
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

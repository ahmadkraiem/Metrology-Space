/**
 * Compact Body Evidence candidate list renderer.
 * Rows show readable name, confidence, and Front Promoted only.
 * Coordinates stay in title / Selection, never in visible row text.
 * Side rows never include a Promote badge or action.
 */

import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatCmValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }
  return String(Math.round(value * 10) / 10);
}

function formatScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 'n/a';
  }
  return score.toFixed(2);
}

function badgeClassForTone(tone) {
  if (tone === 'ok') {
    return 'body-evidence-badge body-evidence-badge--ok';
  }
  if (tone === 'warn') {
    return 'body-evidence-badge body-evidence-badge--warn';
  }
  if (tone === 'muted') {
    return 'body-evidence-badge body-evidence-badge--muted';
  }
  return 'body-evidence-badge';
}

function renderBadge(label, tone = 'default', title = '') {
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<span class="${badgeClassForTone(tone)}"${titleAttr}>${escapeHtml(label)}</span>`;
}

function coordLabel(landmark, source) {
  if (source === 'side') {
    return `U ${formatCmValue(landmark.sideUcm)} / Y ${formatCmValue(landmark.sideYcm)}`;
  }
  return `X ${formatCmValue(landmark.spaceX)} / Y ${formatCmValue(landmark.spaceY)}`;
}

function emptyMessage(source, layer) {
  if (source === 'side') {
    return layer === 'secondary'
      ? 'No side secondary body landmark candidates.'
      : 'No side body landmark candidates.';
  }
  return layer === 'secondary'
    ? 'No secondary body candidates found.'
    : 'No front body landmark candidates.';
}

function promotedNameSet(promotedNames) {
  if (promotedNames instanceof Set) {
    return promotedNames;
  }
  return new Set(promotedNames ?? []);
}

function renderCandidateRow(landmark, { source, selectedId, promotedNames }) {
  const selected = Boolean(selectedId) && landmark.id === selectedId;
  const displayName = formatLandmarkDisplayName(landmark.name) || landmark.name;
  const scoreLabel = formatScore(landmark.score);
  const scoreBadge = scoreLabel === 'n/a'
    ? ''
    : `<span class="body-evidence-candidate-score">${renderBadge(
      scoreLabel,
      landmark.lowConfidence ? 'warn' : 'ok',
      `Score / confidence: ${scoreLabel}${landmark.lowConfidence ? ' (low)' : ''}`,
    )}</span>`;
  const showPromoted = source !== 'side' && promotedNames.has(landmark.name);
  const promotedBadge = showPromoted
    ? `<span class="body-evidence-candidate-promoted">${renderBadge('Promoted', 'ok', 'Already promoted to a body_landmark annotation')}</span>`
    : '';
  const coords = coordLabel(landmark, source);
  const typeClass = landmark.candidateType === 'secondary'
    ? ' body-evidence-candidate-row--secondary'
    : ' body-evidence-candidate-row--core';
  const sourceClass = source === 'side' ? ' body-evidence-candidate-row--side' : '';
  const rowClass = selected
    ? `body-evidence-candidate-row${sourceClass}${typeClass} is-selected`
    : `body-evidence-candidate-row${sourceClass}${typeClass}`;
  const titleSuffix = source === 'side' ? ' · Side (no promote)' : '';

  return (
    `<button type="button" class="${rowClass}" role="option"`
    + ` data-body-evidence-id="${escapeHtml(landmark.id)}"`
    + ` data-body-evidence-view="${escapeHtml(source)}"`
    + ` aria-selected="${selected ? 'true' : 'false'}"`
    + ` title="${escapeHtml(`${landmark.name} · ${coords}${titleSuffix}`)}">`
    + `<span class="body-evidence-candidate-main">`
    + `<span class="body-evidence-candidate-name">${escapeHtml(displayName)}</span>`
    + `</span>`
    + `<span class="body-evidence-candidate-meta">`
    + scoreBadge
    + promotedBadge
    + `</span>`
    + `</button>`
  );
}

/**
 * Render a compact evidence candidate list into `container`.
 * @param {{
 *   container: { innerHTML: string, querySelectorAll?: Function },
 *   landmarks: Array<object>,
 *   source: 'front'|'side',
 *   selectedId?: string|null,
 *   promotedNames?: Set<string>|string[],
 *   onSelect?: (landmark: object) => void,
 *   layer?: 'core'|'secondary',
 * }} options
 */
export function renderEvidenceCandidateList({
  container,
  landmarks = [],
  source,
  selectedId = null,
  promotedNames,
  onSelect,
  layer,
} = {}) {
  if (!container) {
    return;
  }

  const view = source === 'side' ? 'side' : 'front';
  const names = promotedNameSet(promotedNames);
  const rows = Array.isArray(landmarks) ? landmarks : [];

  if (rows.length === 0) {
    container.innerHTML = (
      `<p class="body-evidence-candidates-empty">${escapeHtml(emptyMessage(view, layer))}</p>`
    );
    return;
  }

  container.innerHTML = rows
    .map((landmark) => renderCandidateRow(landmark, {
      source: view,
      selectedId,
      promotedNames: names,
    }))
    .join('');

  const byId = new Map(rows.map((landmark) => [landmark.id, landmark]));

  if (typeof container.querySelectorAll === 'function') {
    container.querySelectorAll('[data-body-evidence-id]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const landmarkId = btn.dataset.bodyEvidenceId;
        const landmark = byId.get(landmarkId);
        if (landmark && typeof onSelect === 'function') {
          onSelect(landmark);
        }
      });
    });
  }
}


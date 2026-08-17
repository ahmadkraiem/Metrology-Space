/**
 * Body Evidence panel (v0)
 * Left Metrology Inspector — load/analyze/clear body-processing JSON.
 * Evidence UI only — does not mutate scene or measurement state.
 * Compact summary counts render here; full QA name lists live in the Session
 * Data Body tab (Advanced Evidence Details). Diagnostic JSON remains available
 * via Download Body Evidence JSON.
 * Promote Selected Landmark creates a normal annotation via the shared
 * annotation helper; Body Evidence evidence state is unchanged.
 */

import {
  analyzeLoadedBodyEvidence,
  clearBodyEvidence,
  clearBodyEvidenceSelection,
  downloadBodyEvidenceJson,
  getBodyEvidenceError,
  getBodyEvidenceQa,
  getBodyEvidenceScaleInfo,
  getSelectedBodyEvidenceLandmark,
  hasAnalyzedBodyEvidence,
  hasAnyBodyEvidenceSource,
  isBodyEvidenceOverlayVisible,
  isBodyLandmarkPromoted,
  isSecondaryBodyEvidenceVisible,
  isSelectedBodyEvidenceLandmark,
  promoteSelectedBodyEvidenceLandmark,
  selectBodyEvidenceLandmark,
  setBodyEvidenceOverlayVisible,
  setSecondaryBodyEvidenceVisible,
  setFrontPoseSource,
  setFrontSegSource,
  setSidePoseSource,
  setSideSegSource,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { subscribeAnnotationsChange } from '../features/annotations.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getFrontOverlayLandmarkCount,
  getFrontOverlayLandmarks,
  getSecondaryCandidateLandmarkCount,
  getSecondaryCandidateLandmarks,
} from './bodyEvidenceOverlay2d.js';
import {
  analyzeBodyEvidenceBtn,
  bodyEvidenceAnalysisStatusEl,
  bodyEvidenceCandidatesEl,
  bodyEvidenceIgnoredCountEl,
  bodyEvidenceOverlayCountEl,
  bodyEvidenceOverlayScaleEl,
  bodyEvidencePromoteStatusEl,
  bodyEvidenceRejectedCountEl,
  bodyEvidenceSecondaryCandidatesGroupEl,
  bodyEvidenceSecondaryCandidatesCountEl,
  bodyEvidenceSecondaryCandidatesEl,
  bodyEvidenceSecondaryCountEl,
  bodyEvidenceSelectedEl,
  bodyEvidenceSourceSummaryEl,
  bodyEvidenceStatusEl,
  clearBodyEvidenceBtn,
  clearBodyLandmarkSelectionBtn,
  downloadBodyEvidenceJsonBtn,
  loadFrontPoseJsonInput,
  loadFrontSegJsonInput,
  loadSidePoseJsonInput,
  loadSideSegJsonInput,
  promoteSelectedBodyLandmarkBtn,
  showBodyEvidenceOverlayCheckbox,
  showSecondaryBodyCandidatesCheckbox,
} from './domRefs.js';

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

function scaleStatusTone(status) {
  if (status === 'fixed' || status === 'detected') {
    return 'ok';
  }
  if (status === 'partial') {
    return 'warn';
  }
  return 'muted';
}

function showStatus(message, type = 'info') {
  if (!bodyEvidenceStatusEl) {
    return;
  }
  bodyEvidenceStatusEl.textContent = message;
  bodyEvidenceStatusEl.hidden = !message;
  if (message) {
    bodyEvidenceStatusEl.dataset.status = type;
  } else {
    delete bodyEvidenceStatusEl.dataset.status;
  }
}

function hideStatus() {
  showStatus('');
}

function showPromoteStatus(message, type = 'info') {
  if (!bodyEvidencePromoteStatusEl) {
    return;
  }
  bodyEvidencePromoteStatusEl.textContent = message;
  bodyEvidencePromoteStatusEl.hidden = !message;
  if (message) {
    bodyEvidencePromoteStatusEl.dataset.status = type;
  } else {
    delete bodyEvidencePromoteStatusEl.dataset.status;
  }
}

function hidePromoteStatus() {
  showPromoteStatus('');
}

function syncDownloadButton() {
  if (!downloadBodyEvidenceJsonBtn) {
    return;
  }
  const available = hasAnalyzedBodyEvidence();
  downloadBodyEvidenceJsonBtn.disabled = !available;
  downloadBodyEvidenceJsonBtn.hidden = false;
  downloadBodyEvidenceJsonBtn.setAttribute('aria-disabled', available ? 'false' : 'true');
}

function setSummaryValue(el, html, title = '') {
  if (!el) {
    return;
  }
  el.innerHTML = html;
  if (title) {
    el.setAttribute('title', title);
  } else {
    el.removeAttribute('title');
  }
}

function syncOverlayControls() {
  const analyzed = hasAnalyzedBodyEvidence();
  const count = analyzed ? getFrontOverlayLandmarkCount() : 0;
  const secondaryCount = analyzed ? getSecondaryCandidateLandmarkCount() : 0;
  const qa = getBodyEvidenceQa();

  if (showBodyEvidenceOverlayCheckbox) {
    showBodyEvidenceOverlayCheckbox.checked = isBodyEvidenceOverlayVisible();
    showBodyEvidenceOverlayCheckbox.disabled = !analyzed || count === 0;
  }

  if (showSecondaryBodyCandidatesCheckbox) {
    showSecondaryBodyCandidatesCheckbox.checked = isSecondaryBodyEvidenceVisible();
    showSecondaryBodyCandidatesCheckbox.disabled = !analyzed || secondaryCount === 0;
    showSecondaryBodyCandidatesCheckbox.setAttribute(
      'aria-disabled',
      showSecondaryBodyCandidatesCheckbox.disabled ? 'true' : 'false',
    );
  }

  if (bodyEvidenceOverlayCountEl) {
    const label = analyzed ? `${count} / 13` : '0 / 13';
    bodyEvidenceOverlayCountEl.textContent = label;
    bodyEvidenceOverlayCountEl.setAttribute('title', `Primary/core front candidates: ${count} / 13`);
  }

  if (bodyEvidenceSecondaryCountEl) {
    bodyEvidenceSecondaryCountEl.textContent = String(secondaryCount);
  }
  if (bodyEvidenceRejectedCountEl) {
    bodyEvidenceRejectedCountEl.textContent = String(qa?.qa?.frontRejectedFaceLandmarks ?? 0);
  }
  if (bodyEvidenceIgnoredCountEl) {
    bodyEvidenceIgnoredCountEl.textContent = String(qa?.qa?.frontIgnoredNonCoreLandmarks ?? 0);
  }

  if (bodyEvidenceOverlayScaleEl) {
    if (!analyzed) {
      setSummaryValue(bodyEvidenceOverlayScaleEl, renderBadge('—', 'muted'), 'Scale not analyzed');
    } else {
      const scaleInfo = getBodyEvidenceScaleInfo();
      const status = scaleInfo.status ?? 'fixed';
      const px = `${scaleInfo.pixelsPerCm} px/cm fixed`;
      const label = `${status} · ${px}`;
      setSummaryValue(
        bodyEvidenceOverlayScaleEl,
        renderBadge(label, scaleStatusTone(status), scaleInfo.sourceLabel ?? label),
        scaleInfo.sourceLabel ?? label,
      );
    }
  }

  if (bodyEvidenceAnalysisStatusEl) {
    if (analyzed) {
      setSummaryValue(
        bodyEvidenceAnalysisStatusEl,
        renderBadge('analyzed', 'ok'),
        'Body Evidence analyzed',
      );
    } else if (hasAnyBodyEvidenceSource()) {
      setSummaryValue(
        bodyEvidenceAnalysisStatusEl,
        renderBadge('loaded', 'warn', 'Sources loaded — not analyzed'),
        'Sources loaded — not analyzed',
      );
    } else {
      setSummaryValue(
        bodyEvidenceAnalysisStatusEl,
        renderBadge('not analyzed', 'muted'),
        'Body Evidence not analyzed',
      );
    }
  }

  if (bodyEvidenceSourceSummaryEl) {
    if (!analyzed) {
      setSummaryValue(bodyEvidenceSourceSummaryEl, renderBadge('—', 'muted'), 'Source unknown');
    } else {
      const conceptual = qa?.isMockData !== false;
      const label = conceptual ? 'conceptual' : 'live';
      setSummaryValue(
        bodyEvidenceSourceSummaryEl,
        renderBadge(label, conceptual ? 'muted' : 'ok', label),
        label,
      );
    }
  }
}

function syncClearSelectionButton() {
  if (!clearBodyLandmarkSelectionBtn) {
    return;
  }
  const hasSelection = getSelectedBodyEvidenceLandmark() != null;
  clearBodyLandmarkSelectionBtn.disabled = !hasSelection;
  clearBodyLandmarkSelectionBtn.setAttribute('aria-disabled', hasSelection ? 'false' : 'true');
}

function syncPromoteButton() {
  if (!promoteSelectedBodyLandmarkBtn) {
    return;
  }
  const hasSelection = getSelectedBodyEvidenceLandmark() != null;
  promoteSelectedBodyLandmarkBtn.disabled = !hasSelection;
  promoteSelectedBodyLandmarkBtn.setAttribute('aria-disabled', hasSelection ? 'false' : 'true');
}

/**
 * Candidate rows use the same mapped front overlay landmarks as 2D markers,
 * so row selection and marker selection share one inspect id/state.
 */
function renderCandidateRow(landmark) {
  const selected = isSelectedBodyEvidenceLandmark(landmark.id);
  const promoted = isBodyLandmarkPromoted(landmark.name);
  const displayName = formatLandmarkDisplayName(landmark.name) || landmark.name;
  const scoreLabel = formatScore(landmark.score);
  const scoreBadge = scoreLabel === 'n/a'
    ? ''
    : `<span class="body-evidence-candidate-score">${renderBadge(
      scoreLabel,
      landmark.lowConfidence ? 'warn' : 'ok',
      `Score / confidence: ${scoreLabel}${landmark.lowConfidence ? ' (low)' : ''}`,
    )}</span>`;
  const promotedBadge = promoted
    ? `<span class="body-evidence-candidate-promoted">${renderBadge('Promoted', 'ok', 'Already promoted to a body_landmark annotation')}</span>`
    : '';
  const coords = `X ${formatCmValue(landmark.spaceX)} / Y ${formatCmValue(landmark.spaceY)}`;
  const candidateTypeClass = landmark.candidateType === 'secondary'
    ? ' body-evidence-candidate-row--secondary'
    : '';
  const rowClass = selected
    ? `body-evidence-candidate-row${candidateTypeClass} is-selected`
    : `body-evidence-candidate-row${candidateTypeClass}`;

  return (
    `<button type="button" class="${rowClass}" role="option"`
    + ` data-body-evidence-id="${escapeHtml(landmark.id)}"`
    + ` aria-selected="${selected ? 'true' : 'false'}"`
    + ` title="${escapeHtml(`${landmark.name} · ${coords}`)}">`
    + `<span class="body-evidence-candidate-main">`
    + `<span class="body-evidence-candidate-name">${escapeHtml(displayName)}</span>`
    + `<span class="body-evidence-candidate-coords">${escapeHtml(coords)}</span>`
    + `</span>`
    + `<span class="body-evidence-candidate-meta">`
    + scoreBadge
    + promotedBadge
    + `</span>`
    + `</button>`
  );
}

function renderCandidateList() {
  if (!bodyEvidenceCandidatesEl) {
    return;
  }

  const landmarks = hasAnalyzedBodyEvidence() ? getFrontOverlayLandmarks() : [];
  if (landmarks.length === 0) {
    bodyEvidenceCandidatesEl.innerHTML = (
      '<p class="body-evidence-candidates-empty">No front body landmark candidates.</p>'
    );
    return;
  }

  bodyEvidenceCandidatesEl.innerHTML = landmarks.map(renderCandidateRow).join('');
}

function renderSecondaryCandidateList() {
  if (!bodyEvidenceSecondaryCandidatesEl) {
    return;
  }

  const analyzed = hasAnalyzedBodyEvidence();
  const landmarks = analyzed ? getSecondaryCandidateLandmarks() : [];
  const visible = isSecondaryBodyEvidenceVisible();

  if (bodyEvidenceSecondaryCandidatesGroupEl) {
    bodyEvidenceSecondaryCandidatesGroupEl.hidden = analyzed && landmarks.length > 0 && !visible;
  }
  if (bodyEvidenceSecondaryCandidatesCountEl) {
    bodyEvidenceSecondaryCandidatesCountEl.textContent = String(landmarks.length);
  }

  if (landmarks.length === 0) {
    bodyEvidenceSecondaryCandidatesEl.innerHTML = (
      '<p class="body-evidence-candidates-empty">No secondary body candidates found.</p>'
    );
    return;
  }

  bodyEvidenceSecondaryCandidatesEl.innerHTML = landmarks.map(renderCandidateRow).join('');
}

function findCandidateLandmarkById(landmarkId) {
  return getFrontOverlayLandmarks().find((entry) => entry.id === landmarkId)
    ?? getSecondaryCandidateLandmarks().find((entry) => entry.id === landmarkId)
    ?? null;
}

function onCandidateListClick(event) {
  const row = event.target.closest('.body-evidence-candidate-row');
  if (!row) {
    return;
  }
  const inCoreList = Boolean(bodyEvidenceCandidatesEl?.contains(row));
  const inSecondaryList = Boolean(bodyEvidenceSecondaryCandidatesEl?.contains(row));
  if (!inCoreList && !inSecondaryList) {
    return;
  }

  event.preventDefault();
  const landmarkId = row.dataset.bodyEvidenceId;
  if (!landmarkId) {
    return;
  }

  const landmark = findCandidateLandmarkById(landmarkId);
  if (!landmark) {
    return;
  }

  // Same inspect path as Front Surface marker clicks — never touches A/B.
  selectBodyEvidenceLandmark(landmark);
}

function refreshCandidateLists() {
  renderCandidateList();
  renderSecondaryCandidateList();
}

function renderCoordCell(axisLabel, value) {
  return (
    `<div class="body-evidence-coord-cell">`
    + `<span class="body-evidence-coord-axis">${escapeHtml(axisLabel)}</span>`
    + `<span class="body-evidence-coord-value">${escapeHtml(value)}</span>`
    + `</div>`
  );
}

/** Compact inspect card: display name, score, promotion state, Front Surface X/Y. */
function renderSelectedLandmark() {
  if (!bodyEvidenceSelectedEl) {
    return;
  }

  const selected = getSelectedBodyEvidenceLandmark();
  if (!selected) {
    bodyEvidenceSelectedEl.innerHTML = '<p class="body-evidence-selected-empty">No body landmark selected.</p>';
    syncClearSelectionButton();
    syncPromoteButton();
    return;
  }

  const promoted = isBodyLandmarkPromoted(selected.name);
  const displayName = formatLandmarkDisplayName(selected.name) || selected.name;
  const scoreLabel = formatScore(selected.score);
  const promotedBadge = renderBadge(
    promoted ? 'Promoted' : 'Not promoted',
    promoted ? 'ok' : 'muted',
  );

  bodyEvidenceSelectedEl.innerHTML = (
    `<div class="body-evidence-inspect-header">`
    + `<div class="body-evidence-inspect-name" title="${escapeHtml(selected.name)}">${escapeHtml(displayName)}</div>`
    + `<div class="body-evidence-inspect-header-badges">`
    + `${renderBadge(scoreLabel, 'ok')}`
    + `${promotedBadge}`
    + `</div>`
    + `</div>`
    + `<div class="body-evidence-coord-grid">`
    + renderCoordCell('X', `${formatCmValue(selected.spaceX)} cm`)
    + renderCoordCell('Y', `${formatCmValue(selected.spaceY)} cm`)
    + `</div>`
  );

  syncClearSelectionButton();
  syncPromoteButton();
}

async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

function wireFileInput(input, setter, label) {
  if (!input) {
    return;
  }
  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const hadAnalysis = hasAnalyzedBodyEvidence();
      const data = await readJsonFile(file);
      setter(data);
      hideStatus();
      // Sources changed — prior analysis is stale until Analyze runs again.
      showStatus(
        hadAnalysis ? `${label} loaded — re-run Analyze.` : `${label} loaded: ${file.name}`,
        'ok',
      );
      syncDownloadButton();
      syncOverlayControls();
      refreshCandidateLists();
      renderSelectedLandmark();
    } catch (error) {
      const message = error instanceof SyntaxError
        ? `Invalid JSON in ${label}`
        : `Failed to read ${label}`;
      console.warn('[REVacity] Body evidence load failed:', message, error);
      showStatus(message, 'error');
    }
  });
}

function onAnalyze() {
  const { ok, error } = analyzeLoadedBodyEvidence();
  if (!ok) {
    showStatus(error ?? getBodyEvidenceError() ?? 'Analyze failed.', 'error');
    syncDownloadButton();
    syncOverlayControls();
    refreshCandidateLists();
    renderSelectedLandmark();
    return;
  }
  hideStatus();
  syncDownloadButton();
  syncOverlayControls();
  refreshCandidateLists();
  renderSelectedLandmark();
  showStatus('Body evidence analyzed.', 'ok');
}

function onClear() {
  clearBodyEvidence();
  syncDownloadButton();
  syncOverlayControls();
  refreshCandidateLists();
  renderSelectedLandmark();
  hideStatus();
  hidePromoteStatus();
  showStatus('Body evidence cleared.', 'ok');
}

function onClearSelection() {
  clearBodyEvidenceSelection();
  hidePromoteStatus();
  refreshCandidateLists();
  renderSelectedLandmark();
}

function onPromoteSelected() {
  const { ok, alreadyPromoted, message } = promoteSelectedBodyEvidenceLandmark();
  if (ok) {
    showStatus(message || 'Promoted to annotation.', 'ok');
    showPromoteStatus(message || 'Promoted to annotation.', 'ok');
  } else if (alreadyPromoted) {
    showStatus(message || 'Already promoted.', 'warn');
    showPromoteStatus(message || 'Already promoted.', 'warn');
  } else {
    showStatus(message || 'Promotion failed.', 'error');
    showPromoteStatus(message || 'Promotion failed.', 'error');
  }
  // Keep selection; refresh badges. Annotation list / Scene Graph refresh via addAnnotation.
  refreshCandidateLists();
  renderSelectedLandmark();
}

function onToggleOverlay() {
  setBodyEvidenceOverlayVisible(Boolean(showBodyEvidenceOverlayCheckbox?.checked));
  syncOverlayControls();
}

function onToggleSecondaryCandidates() {
  setSecondaryBodyEvidenceVisible(Boolean(showSecondaryBodyCandidatesCheckbox?.checked));
}

function onDownload() {
  const { ok, error } = downloadBodyEvidenceJson();
  if (!ok) {
    showStatus(error ?? 'Download failed.', 'error');
    syncDownloadButton();
    return;
  }
  showStatus('Body Evidence JSON downloaded.', 'ok');
}

export function setupBodyEvidencePanel() {
  wireFileInput(loadFrontPoseJsonInput, setFrontPoseSource, 'Front Pose JSON');
  wireFileInput(loadSidePoseJsonInput, setSidePoseSource, 'Side Pose JSON');
  wireFileInput(loadFrontSegJsonInput, setFrontSegSource, 'Front Seg JSON');
  wireFileInput(loadSideSegJsonInput, setSideSegSource, 'Side Seg JSON');

  analyzeBodyEvidenceBtn?.addEventListener('click', onAnalyze);
  clearBodyEvidenceBtn?.addEventListener('click', onClear);
  clearBodyLandmarkSelectionBtn?.addEventListener('click', onClearSelection);
  promoteSelectedBodyLandmarkBtn?.addEventListener('click', onPromoteSelected);
  downloadBodyEvidenceJsonBtn?.addEventListener('click', onDownload);
  showBodyEvidenceOverlayCheckbox?.addEventListener('change', onToggleOverlay);
  showSecondaryBodyCandidatesCheckbox?.addEventListener('change', onToggleSecondaryCandidates);
  bodyEvidenceCandidatesEl?.addEventListener('click', onCandidateListClick);
  bodyEvidenceSecondaryCandidatesEl?.addEventListener('click', onCandidateListClick);

  subscribeBodyEvidenceChange(() => {
    refreshCandidateLists();
    renderSelectedLandmark();
    syncOverlayControls();
  });

  // Keep Promoted badges in sync when annotations are added/deleted elsewhere.
  subscribeAnnotationsChange(() => {
    refreshCandidateLists();
    renderSelectedLandmark();
  });

  syncDownloadButton();
  syncOverlayControls();
  refreshCandidateLists();
  renderSelectedLandmark();
  hidePromoteStatus();
}

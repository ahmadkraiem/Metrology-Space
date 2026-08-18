/**
 * Body Evidence panel (v0)
 * Left Metrology Inspector — load/analyze/clear body-processing JSON.
 * Tabbed workflow: Front / Side / Selection.
 * Evidence UI only — does not mutate scene or measurement state.
 * Compact summary counts render in Session Data > Body.
 * File load remains available through the File menu (hidden inputs).
 * Promote Selected Landmark creates a normal annotation via the shared
 * annotation helper; Body Evidence evidence state is unchanged.
 * Side remains U/Y evidence and is never promotable.
 */

import {
  analyzeLoadedBodyEvidence,
  clearBodyEvidence,
  clearBodyEvidenceSelection,
  clearSideEvidenceSelection,
  downloadBodyEvidenceJson,
  getBodyEvidenceError,
  getSelectedBodyEvidenceLandmark,
  getSelectedSideEvidenceLandmark,
  hasAnalyzedBodyEvidence,
  isBodyLandmarkPromoted,
  promoteSelectedBodyEvidenceLandmark,
  selectBodyEvidenceLandmark,
  selectSideEvidenceLandmark,
  setFrontPoseSource,
  setFrontSegSource,
  setSidePoseSource,
  setSideSegSource,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { subscribeAnnotationsChange } from '../features/annotations.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getFrontOverlayLandmarks,
  getSecondaryCandidateLandmarks,
} from './bodyEvidenceOverlay2d.js';
import {
  getSideCandidateLandmarks,
} from './bodyEvidenceOverlaySide2d.js';
import { renderEvidenceCandidateList } from './bodyEvidenceCandidateList.js';
import { focusBodyEvidenceWorkflow } from './inspectorWorkflow.js';
import {
  analyzeBodyEvidenceBtn,
  bodyEvidenceFrontCandidatesEl,
  bodyEvidenceFrontListCountEl,
  bodyEvidenceFrontListLabelEl,
  bodyEvidencePromoteStatusEl,
  bodyEvidenceSelectedEl,
  bodyEvidenceSideCandidatesEl,
  bodyEvidenceSideListCountEl,
  bodyEvidenceSideListLabelEl,
  bodyEvidenceStatusEl,
  clearBodyEvidenceBtn,
  clearBodyLandmarkSelectionBtn,
  downloadBodyEvidenceJsonBtn,
  loadFrontPoseJsonInput,
  loadFrontSegJsonInput,
  loadSidePoseJsonInput,
  loadSideSegJsonInput,
  promoteSelectedBodyLandmarkBtn,
} from './domRefs.js';

const BODY_EVIDENCE_TABS = Object.freeze(['front', 'side', 'selection']);
const CANDIDATE_LAYERS = Object.freeze(['core', 'secondary']);

/** @type {'front'|'side'|'selection'} */
let activeBodyEvidenceTab = 'front';
/** @type {'core'|'secondary'} */
let frontCandidateLayer = 'core';
/** @type {'core'|'secondary'} */
let sideCandidateLayer = 'core';
let lastSelectionKey = '';

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

function currentSelectionKey() {
  const selectedFront = getSelectedBodyEvidenceLandmark();
  if (selectedFront) {
    return `front:${selectedFront.id}`;
  }
  const selectedSide = getSelectedSideEvidenceLandmark();
  if (selectedSide) {
    return `side:${selectedSide.id}`;
  }
  return '';
}

function syncTabUi() {
  document.querySelectorAll('[data-body-evidence-tab]').forEach((button) => {
    const selected = button.dataset.bodyEvidenceTab === activeBodyEvidenceTab;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-body-evidence-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.bodyEvidencePanel !== activeBodyEvidenceTab;
  });
}

function syncLayerUi(source) {
  const layer = source === 'side' ? sideCandidateLayer : frontCandidateLayer;
  document.querySelectorAll(
    `[data-body-evidence-source="${source}"][data-body-evidence-layer]`,
  ).forEach((button) => {
    const pressed = button.dataset.bodyEvidenceLayer === layer;
    button.classList.toggle('is-active', pressed);
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });
}

export function setBodyEvidencePanelTab(tab) {
  if (!BODY_EVIDENCE_TABS.includes(tab)) {
    return;
  }
  activeBodyEvidenceTab = tab;
  syncTabUi();
}

export function setBodyEvidenceCandidateLayer(source, layer) {
  if (layer !== 'core' && layer !== 'secondary') {
    return;
  }
  if (source === 'front') {
    frontCandidateLayer = layer;
  } else if (source === 'side') {
    sideCandidateLayer = layer;
  } else {
    return;
  }
  syncLayerUi(source);
  refreshCandidateLists();
}

function maybeFocusSelectionTab() {
  const key = currentSelectionKey();
  if (key && key !== lastSelectionKey) {
    setBodyEvidencePanelTab('selection');
  }
  lastSelectionKey = key;
}

function syncClearSelectionButton() {
  if (!clearBodyLandmarkSelectionBtn) {
    return;
  }
  const hasSelection = (
    getSelectedBodyEvidenceLandmark() != null
    || getSelectedSideEvidenceLandmark() != null
  );
  clearBodyLandmarkSelectionBtn.disabled = !hasSelection;
  clearBodyLandmarkSelectionBtn.setAttribute('aria-disabled', hasSelection ? 'false' : 'true');
}

function syncPromoteButton() {
  if (!promoteSelectedBodyLandmarkBtn) {
    return;
  }
  // Promote is Front-only. Side selection must never show or enable Promote.
  const hasFrontSelection = getSelectedBodyEvidenceLandmark() != null;
  promoteSelectedBodyLandmarkBtn.hidden = !hasFrontSelection;
  promoteSelectedBodyLandmarkBtn.disabled = !hasFrontSelection;
  promoteSelectedBodyLandmarkBtn.setAttribute('aria-disabled', hasFrontSelection ? 'false' : 'true');
}

function promotedNamesFor(landmarks) {
  const names = new Set();
  for (const landmark of landmarks) {
    if (isBodyLandmarkPromoted(landmark.name)) {
      names.add(landmark.name);
    }
  }
  return names;
}

function findCandidateLandmarkById(landmarkId) {
  return getFrontOverlayLandmarks().find((entry) => entry.id === landmarkId)
    ?? getSecondaryCandidateLandmarks().find((entry) => entry.id === landmarkId)
    ?? null;
}

function findSideCandidateLandmarkById(landmarkId) {
  return getSideCandidateLandmarks().find((entry) => entry.id === landmarkId) ?? null;
}

function resolveCandidateType(selected, source) {
  if (selected?.candidateType === 'secondary' || selected?.candidateType === 'core') {
    return selected.candidateType;
  }
  const found = source === 'side'
    ? findSideCandidateLandmarkById(selected?.id)
    : findCandidateLandmarkById(selected?.id);
  return found?.candidateType === 'secondary' ? 'secondary' : 'core';
}

function onFrontCandidateSelect(landmark) {
  clearSideEvidenceSelection();
  selectBodyEvidenceLandmark(landmark);
  setBodyEvidencePanelTab('selection');
}

function onSideCandidateSelect(landmark) {
  clearBodyEvidenceSelection();
  selectSideEvidenceLandmark(landmark);
  setBodyEvidencePanelTab('selection');
}

function refreshCandidateLists() {
  const analyzed = hasAnalyzedBodyEvidence();
  const selectedFront = getSelectedBodyEvidenceLandmark();
  const selectedSide = getSelectedSideEvidenceLandmark();

  const frontLandmarks = !analyzed
    ? []
    : (frontCandidateLayer === 'secondary'
      ? getSecondaryCandidateLandmarks()
      : getFrontOverlayLandmarks());
  if (bodyEvidenceFrontListLabelEl) {
    bodyEvidenceFrontListLabelEl.textContent = (
      frontCandidateLayer === 'secondary' ? 'Front Secondary' : 'Front Core'
    );
  }
  if (bodyEvidenceFrontListCountEl) {
    bodyEvidenceFrontListCountEl.textContent = String(frontLandmarks.length);
  }
  renderEvidenceCandidateList({
    container: bodyEvidenceFrontCandidatesEl,
    landmarks: frontLandmarks,
    source: 'front',
    selectedId: selectedFront?.id ?? null,
    promotedNames: promotedNamesFor(frontLandmarks),
    onSelect: onFrontCandidateSelect,
    layer: frontCandidateLayer,
  });

  const sideLandmarks = analyzed
    ? getSideCandidateLandmarks({ layer: sideCandidateLayer })
    : [];
  if (bodyEvidenceSideListLabelEl) {
    bodyEvidenceSideListLabelEl.textContent = (
      sideCandidateLayer === 'secondary' ? 'Side Secondary' : 'Side Core'
    );
  }
  if (bodyEvidenceSideListCountEl) {
    bodyEvidenceSideListCountEl.textContent = String(sideLandmarks.length);
  }
  renderEvidenceCandidateList({
    container: bodyEvidenceSideCandidatesEl,
    landmarks: sideLandmarks,
    source: 'side',
    selectedId: selectedSide?.id ?? null,
    promotedNames: new Set(),
    onSelect: onSideCandidateSelect,
    layer: sideCandidateLayer,
  });
}

function renderCoordCell(axisLabel, value) {
  return (
    `<div class="body-evidence-coord-cell">`
    + `<span class="body-evidence-coord-axis">${escapeHtml(axisLabel)}</span>`
    + `<span class="body-evidence-coord-value">${escapeHtml(value)}</span>`
    + `</div>`
  );
}

/** Compact inspect card: Front (promotable) or Side (evidence-only). */
function renderSelectedLandmark() {
  if (!bodyEvidenceSelectedEl) {
    return;
  }

  const selectedFront = getSelectedBodyEvidenceLandmark();
  const selectedSide = getSelectedSideEvidenceLandmark();

  if (!selectedFront && !selectedSide) {
    bodyEvidenceSelectedEl.innerHTML = '<p class="body-evidence-selected-empty">No body landmark selected.</p>';
    syncClearSelectionButton();
    syncPromoteButton();
    return;
  }

  if (selectedFront) {
    const promoted = isBodyLandmarkPromoted(selectedFront.name);
    const displayName = formatLandmarkDisplayName(selectedFront.name) || selectedFront.name;
    const scoreLabel = formatScore(selectedFront.score);
    const candidateType = resolveCandidateType(selectedFront, 'front');
    const typeLabel = candidateType === 'secondary' ? 'Secondary' : 'Core';
    const promotedBadge = renderBadge(
      promoted ? 'Promoted' : 'Not promoted',
      promoted ? 'ok' : 'muted',
    );

    bodyEvidenceSelectedEl.innerHTML = (
      `<div class="body-evidence-inspect-header">`
      + `<div class="body-evidence-inspect-name" title="${escapeHtml(selectedFront.name)}">${escapeHtml(displayName)}</div>`
      + `<div class="body-evidence-inspect-header-badges">`
      + `${renderBadge('Front', 'ok')}`
      + `${renderBadge(typeLabel, candidateType === 'secondary' ? 'muted' : 'ok')}`
      + `${renderBadge(scoreLabel, 'ok', 'Confidence')}`
      + `${promotedBadge}`
      + `</div>`
      + `</div>`
      + `<div class="body-evidence-coord-grid">`
      + renderCoordCell('X', `${formatCmValue(selectedFront.spaceX)} cm`)
      + renderCoordCell('Y', `${formatCmValue(selectedFront.spaceY)} cm`)
      + `</div>`
    );
  } else {
    // Side is evidence-only — never show Front promote feedback on Selection.
    hidePromoteStatus();

    const displayName = formatLandmarkDisplayName(selectedSide.name) || selectedSide.name;
    const scoreLabel = formatScore(selectedSide.score);
    const candidateType = resolveCandidateType(selectedSide, 'side');
    const typeLabel = candidateType === 'secondary' ? 'Secondary' : 'Core';

    bodyEvidenceSelectedEl.innerHTML = (
      `<div class="body-evidence-inspect-header">`
      + `<div class="body-evidence-inspect-name" title="${escapeHtml(selectedSide.name)}">${escapeHtml(displayName)}</div>`
      + `<div class="body-evidence-inspect-header-badges">`
      + `${renderBadge('Side', 'muted')}`
      + `${renderBadge(typeLabel, candidateType === 'secondary' ? 'muted' : 'ok')}`
      + `${renderBadge(scoreLabel, 'ok', 'Confidence')}`
      + `</div>`
      + `</div>`
      + `<div class="body-evidence-coord-grid">`
      + renderCoordCell('U', `${formatCmValue(selectedSide.sideUcm)} cm`)
      + renderCoordCell('Y', `${formatCmValue(selectedSide.sideYcm)} cm`)
      + `</div>`
    );
  }

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

export function openFrontPoseFilePicker() {
  loadFrontPoseJsonInput?.click();
}

export function openSidePoseFilePicker() {
  loadSidePoseJsonInput?.click();
}

export function openFrontSegFilePicker() {
  loadFrontSegJsonInput?.click();
}

export function openSideSegFilePicker() {
  loadSideSegJsonInput?.click();
}

export function runAnalyzeBodyEvidenceAction() {
  const { ok, error } = analyzeLoadedBodyEvidence();
  if (!ok) {
    showStatus(error ?? getBodyEvidenceError() ?? 'Analyze failed.', 'error');
    syncDownloadButton();
    refreshCandidateLists();
    renderSelectedLandmark();
    return;
  }
  hideStatus();
  syncDownloadButton();
  refreshCandidateLists();
  renderSelectedLandmark();
  showStatus('Body evidence analyzed.', 'ok');
}

export function runClearBodyEvidenceAction() {
  clearBodyEvidence();
  syncDownloadButton();
  refreshCandidateLists();
  renderSelectedLandmark();
  hideStatus();
  hidePromoteStatus();
  showStatus('Body evidence cleared.', 'ok');
}

function onClearSelection() {
  clearBodyEvidenceSelection();
  clearSideEvidenceSelection();
  hidePromoteStatus();
  refreshCandidateLists();
  renderSelectedLandmark();
}

export function runPromoteFrontEvidenceAction() {
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

export function runDownloadBodyEvidenceAction() {
  const { ok, error } = downloadBodyEvidenceJson();
  if (!ok) {
    showStatus(error ?? 'Download failed.', 'error');
    syncDownloadButton();
    return;
  }
  showStatus('Body Evidence JSON downloaded.', 'ok');
}

/**
 * Focus Body Evidence workflow and switch to the requested internal tab.
 * @param {'front'|'side'|'selection'} tab
 */
export function focusBodyEvidenceTab(tab) {
  if (!BODY_EVIDENCE_TABS.includes(tab)) {
    return;
  }
  setBodyEvidencePanelTab(tab);
  focusBodyEvidenceWorkflow();
}

export function getBodyEvidencePanelTab() {
  return activeBodyEvidenceTab;
}

function onTabButtonClick(event) {
  const tab = event.currentTarget?.dataset?.bodyEvidenceTab;
  setBodyEvidencePanelTab(tab);
}

function onLayerButtonClick(event) {
  const source = event.currentTarget?.dataset?.bodyEvidenceSource;
  const layer = event.currentTarget?.dataset?.bodyEvidenceLayer;
  if (!CANDIDATE_LAYERS.includes(layer)) {
    return;
  }
  setBodyEvidenceCandidateLayer(source, layer);
}

export function setupBodyEvidencePanel() {
  wireFileInput(loadFrontPoseJsonInput, setFrontPoseSource, 'Front Pose JSON');
  wireFileInput(loadSidePoseJsonInput, setSidePoseSource, 'Side Pose JSON');
  wireFileInput(loadFrontSegJsonInput, setFrontSegSource, 'Front Seg JSON');
  wireFileInput(loadSideSegJsonInput, setSideSegSource, 'Side Seg JSON');

  analyzeBodyEvidenceBtn?.addEventListener('click', runAnalyzeBodyEvidenceAction);
  clearBodyEvidenceBtn?.addEventListener('click', runClearBodyEvidenceAction);
  clearBodyLandmarkSelectionBtn?.addEventListener('click', onClearSelection);
  promoteSelectedBodyLandmarkBtn?.addEventListener('click', runPromoteFrontEvidenceAction);
  downloadBodyEvidenceJsonBtn?.addEventListener('click', runDownloadBodyEvidenceAction);

  document.querySelectorAll('[data-body-evidence-tab]').forEach((button) => {
    button.addEventListener('click', onTabButtonClick);
  });
  document.querySelectorAll('[data-body-evidence-layer]').forEach((button) => {
    button.addEventListener('click', onLayerButtonClick);
  });

  document.addEventListener('body-evidence-selection-focus', () => {
    setBodyEvidencePanelTab('selection');
  });

  lastSelectionKey = currentSelectionKey();

  subscribeBodyEvidenceChange(() => {
    refreshCandidateLists();
    renderSelectedLandmark();
    maybeFocusSelectionTab();
  });

  // Keep Promoted badges in sync when annotations are added/deleted elsewhere.
  subscribeAnnotationsChange(() => {
    refreshCandidateLists();
    renderSelectedLandmark();
  });

  syncTabUi();
  syncLayerUi('front');
  syncLayerUi('side');
  syncDownloadButton();
  refreshCandidateLists();
  renderSelectedLandmark();
  hidePromoteStatus();
}

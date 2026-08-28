/**
 * Body Evidence panel (v0)
 * Left Metrology Inspector — inspect Front/Side Body Evidence candidates & segmentation classes.
 * Tabbed workflow: Front / Side / Selection.
 * Evidence UI only — does not mutate scene or measurement state.
 * Compact diagnostic counts render in Diagnostics when needed.
 * Package import available through File > Upload Body Evidence Package…
 * Promote Selected Landmark creates a normal annotation via the shared
 * annotation helper; Body Evidence evidence state is unchanged.
 * Side remains U/Y evidence and is never promotable.
 */

import {
  analyzeLoadedBodyEvidence,
  clearAllBodyEvidenceSelections,
  clearBodyEvidenceSelection,
  clearSideEvidenceSelection,
  downloadBodyEvidenceJson,
  getBodyEvidenceQa,
  getSelectedBodyEvidenceLandmark,
  getSelectedFrontSegClass,
  getSelectedFrontSegClassId,
  getSelectedSideEvidenceLandmark,
  getSelectedSideSegClass,
  getSelectedSideSegClassId,
  hasAnalyzedBodyEvidence,
  isBodyLandmarkPromoted,
  promoteSelectedBodyEvidenceLandmark,
  promoteAllFrontCoreLandmarks,
  selectBodyEvidenceLandmark,
  selectFrontSegClass,
  selectSideEvidenceLandmark,
  selectSideSegClass,
  setBodyEvidencePackage,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { importBodyEvidenceZip } from '../features/bodyEvidenceZipAdapter.js';
import { subscribeAnnotationsChange } from '../features/annotations.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getFrontOverlayLandmarks,
  getSecondaryCandidateLandmarks,
} from './bodyEvidenceOverlay2d.js';
import {
  setWorkspace,
  WORKSPACE_SPLIT,
} from './workspaceLayout.js';
import {
  getSideCandidateLandmarks,
} from './bodyEvidenceOverlaySide2d.js';
import { BASE_PALETTE_RGB } from './segmentationOverlay2d.js';
import { renderEvidenceCandidateList } from './bodyEvidenceCandidateList.js';
import {
  bodyEvidenceFrontCandidatesEl,
  bodyEvidenceFrontListCountEl,
  bodyEvidenceFrontListLabelEl,
  bodyEvidenceFrontSegClassesEl,
  bodyEvidenceFrontSegCountEl,
  bodyEvidenceFrontSegLabelEl,
  bodyEvidencePromoteStatusEl,
  bodyEvidenceSelectedEl,
  bodyEvidenceSideCandidatesEl,
  bodyEvidenceSideListCountEl,
  bodyEvidenceSideListLabelEl,
  bodyEvidenceSideSegClassesEl,
  bodyEvidenceSideSegCountEl,
  bodyEvidenceSideSegLabelEl,
  bodyEvidenceStatusEl,
  clearBodyLandmarkSelectionBtn,
  importBodyEvidencePackageZipInput,
  promoteSelectedBodyLandmarkBtn,
  promoteAllFrontCoreLandmarksBtn,
} from './domRefs.js';

import { escapeHtml, renderBadge } from './badgeUi.js';

const BODY_EVIDENCE_TABS = Object.freeze(['front', 'side', 'selection']);
const CANDIDATE_LAYERS = Object.freeze(['core', 'secondary']);
const SEGMENTATION_FILTERS = Object.freeze(['present', 'absent']);

/** @type {'front'|'side'|'selection'} */
let activeBodyEvidenceTab = 'front';
/** @type {'core'|'secondary'} */
let frontCandidateLayer = 'core';
/** @type {'core'|'secondary'} */
let sideCandidateLayer = 'core';
/** @type {'present'|'absent'} */
let frontSegFilter = 'present';
/** @type {'present'|'absent'} */
let sideSegFilter = 'present';
let lastSelectionKey = '';

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

function getSegClassSwatchColor(classId) {
  if (classId === 0) {
    return 'rgba(148, 163, 184, 0.6)';
  }
  const rgb = BASE_PALETTE_RGB[(classId - 1) % BASE_PALETTE_RGB.length];
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
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

function currentSelectionKey() {
  const parts = [];
  const selectedFront = getSelectedBodyEvidenceLandmark();
  if (selectedFront) {
    parts.push(`front-lm:${selectedFront.id}`);
  }
  const selectedSide = getSelectedSideEvidenceLandmark();
  if (selectedSide) {
    parts.push(`side-lm:${selectedSide.id}`);
  }
  const selectedFrontSeg = getSelectedFrontSegClassId();
  if (selectedFrontSeg !== null) {
    parts.push(`front-seg:${selectedFrontSeg}`);
  }
  const selectedSideSeg = getSelectedSideSegClassId();
  if (selectedSideSeg !== null) {
    parts.push(`side-seg:${selectedSideSeg}`);
  }
  return parts.join('|');
}

function syncTabUi() {
  if (typeof document === 'undefined') {
    return;
  }
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
  if (typeof document === 'undefined') {
    return;
  }
  const layer = source === 'side' ? sideCandidateLayer : frontCandidateLayer;
  document.querySelectorAll(
    `[data-body-evidence-source="${source}"][data-body-evidence-layer]`,
  ).forEach((button) => {
    const pressed = button.dataset.bodyEvidenceLayer === layer;
    button.classList.toggle('is-active', pressed);
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  });
}

function syncSegFilterUi(source) {
  if (typeof document === 'undefined') {
    return;
  }
  const filter = source === 'side' ? sideSegFilter : frontSegFilter;
  document.querySelectorAll(
    `[data-body-evidence-seg-source="${source}"][data-body-evidence-seg-filter]`,
  ).forEach((button) => {
    const pressed = button.dataset.bodyEvidenceSegFilter === filter;
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

export function setBodyEvidenceSegFilter(source, filter) {
  if (!SEGMENTATION_FILTERS.includes(filter)) {
    return;
  }
  if (source === 'front') {
    frontSegFilter = filter;
  } else if (source === 'side') {
    sideSegFilter = filter;
  } else {
    return;
  }
  syncSegFilterUi(source);
  refreshCandidateLists();
}

export function getBodyEvidenceSegFilter(source) {
  return source === 'side' ? sideSegFilter : frontSegFilter;
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
    || getSelectedFrontSegClassId() != null
    || getSelectedSideSegClassId() != null
  );
  clearBodyLandmarkSelectionBtn.disabled = !hasSelection;
  clearBodyLandmarkSelectionBtn.setAttribute('aria-disabled', hasSelection ? 'false' : 'true');
}

function syncPromoteButton() {
  if (!promoteSelectedBodyLandmarkBtn) {
    return;
  }
  // Promote is Front landmark only.
  const hasFrontLandmarkSelection = getSelectedBodyEvidenceLandmark() != null;
  promoteSelectedBodyLandmarkBtn.hidden = !hasFrontLandmarkSelection;
  promoteSelectedBodyLandmarkBtn.disabled = !hasFrontLandmarkSelection;
  promoteSelectedBodyLandmarkBtn.setAttribute('aria-disabled', hasFrontLandmarkSelection ? 'false' : 'true');
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

export function onFrontCandidateSelect(landmark) {
  clearSideEvidenceSelection();
  selectBodyEvidenceLandmark(landmark);
  setBodyEvidencePanelTab('selection');
}

export function onSideCandidateSelect(landmark) {
  clearBodyEvidenceSelection();
  selectSideEvidenceLandmark(landmark);
  setBodyEvidencePanelTab('selection');
}

/**
 * Renders a list of normalized segmentation classes with class swatch, label,
 * pixel count, coverage percentage, and present/absent badge.
 */
export function renderSegmentationClassList({
  container,
  classes = [],
  view = 'front',
  selectedClassId = null,
  emptyMessage,
  onSelect,
}) {
  if (!container) {
    return;
  }
  if (!Array.isArray(classes) || classes.length === 0) {
    const msg = emptyMessage || `No ${escapeHtml(view)} segmentation classes.`;
    container.innerHTML = `<p class="body-evidence-candidates-empty">${escapeHtml(msg)}</p>`;
    return;
  }

  const itemsHtml = classes.map((c) => {
    const isSelected = selectedClassId !== null && selectedClassId === c.classId;
    const isAbsent = !c.present;
    const swatchColor = getSegClassSwatchColor(c.classId);
    const displayName = formatLandmarkDisplayName(c.label) || c.label;
    const metaText = `#${c.classId} · ${c.pixelCount.toLocaleString()} px · ${(c.coverage * 100).toFixed(1)}%`;
    const presentBadge = c.present
      ? renderBadge('Present', 'ok')
      : renderBadge('Absent', 'muted');

    const itemClasses = [
      'body-evidence-class-item',
      isAbsent ? 'body-evidence-class-item--absent' : '',
      isSelected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');

    return (
      `<button type="button" class="${itemClasses}" data-seg-view="${escapeHtml(view)}" data-seg-class-id="${c.classId}" aria-selected="${isSelected ? 'true' : 'false'}" title="Class ${c.classId}: ${escapeHtml(c.label)} (${c.present ? 'Present' : 'Absent'})">`
      + `<span class="body-evidence-class-swatch" style="background-color: ${swatchColor};"></span>`
      + `<span class="body-evidence-class-info">`
      + `<span class="body-evidence-class-name">${escapeHtml(displayName)}</span>`
      + `<span class="body-evidence-class-meta">${escapeHtml(metaText)}</span>`
      + `</span>`
      + `${presentBadge}`
      + `</button>`
    );
  }).join('');

  container.innerHTML = itemsHtml;

  container.querySelectorAll('[data-seg-class-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rawId = btn.dataset.segClassId;
      const classId = rawId !== undefined ? Number(rawId) : null;
      if (typeof onSelect === 'function') {
        onSelect(classId);
      }
    });
  });
}

function refreshCandidateLists() {
  const analyzed = hasAnalyzedBodyEvidence();
  const qa = getBodyEvidenceQa();
  const selectedFront = getSelectedBodyEvidenceLandmark();
  const selectedSide = getSelectedSideEvidenceLandmark();
  const selectedFrontSegId = getSelectedFrontSegClassId();
  const selectedSideSegId = getSelectedSideSegClassId();

  // 1. Front Pose Landmarks
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

  // 2. Front Segmentation Classes (Filtered by Present / Absent)
  const allFrontSegClasses = analyzed ? (qa?.views?.front?.segmentation?.classes ?? []) : [];
  const filteredFrontSegClasses = allFrontSegClasses.filter((c) => (
    frontSegFilter === 'present' ? c.present : !c.present
  ));
  if (bodyEvidenceFrontSegLabelEl) {
    bodyEvidenceFrontSegLabelEl.textContent = (
      frontSegFilter === 'absent' ? 'Front Seg (Absent)' : 'Front Seg (Present)'
    );
  }
  if (bodyEvidenceFrontSegCountEl) {
    bodyEvidenceFrontSegCountEl.textContent = String(filteredFrontSegClasses.length);
  }
  renderSegmentationClassList({
    container: bodyEvidenceFrontSegClassesEl,
    classes: filteredFrontSegClasses,
    view: 'front',
    selectedClassId: selectedFrontSegId,
    emptyMessage: `No ${frontSegFilter} front segmentation classes.`,
    onSelect: (classId) => {
      if (selectedFrontSegId === classId) {
        clearFrontSegClass();
      } else {
        selectFrontSegClass(classId);
        setBodyEvidencePanelTab('selection');
      }
    },
  });

  // 3. Side Pose Landmarks
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

  // 4. Side Segmentation Classes (Filtered by Present / Absent)
  const allSideSegClasses = analyzed ? (qa?.views?.side?.segmentation?.classes ?? []) : [];
  const filteredSideSegClasses = allSideSegClasses.filter((c) => (
    sideSegFilter === 'present' ? c.present : !c.present
  ));
  if (bodyEvidenceSideSegLabelEl) {
    bodyEvidenceSideSegLabelEl.textContent = (
      sideSegFilter === 'absent' ? 'Side Seg (Absent)' : 'Side Seg (Present)'
    );
  }
  if (bodyEvidenceSideSegCountEl) {
    bodyEvidenceSideSegCountEl.textContent = String(filteredSideSegClasses.length);
  }
  renderSegmentationClassList({
    container: bodyEvidenceSideSegClassesEl,
    classes: filteredSideSegClasses,
    view: 'side',
    selectedClassId: selectedSideSegId,
    emptyMessage: `No ${sideSegFilter} side segmentation classes.`,
    onSelect: (classId) => {
      if (selectedSideSegId === classId) {
        clearSideSegClass();
      } else {
        selectSideSegClass(classId);
        setBodyEvidencePanelTab('selection');
      }
    },
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

function renderFrontLandmarkCardHtml(selectedFront) {
  const promoted = isBodyLandmarkPromoted(selectedFront.name);
  const displayName = formatLandmarkDisplayName(selectedFront.name) || selectedFront.name;
  const scoreLabel = formatScore(selectedFront.score);
  const candidateType = resolveCandidateType(selectedFront, 'front');
  const typeLabel = candidateType === 'secondary' ? 'Secondary' : 'Core';
  const promotedBadge = renderBadge(
    promoted ? 'Promoted' : 'Not promoted',
    promoted ? 'ok' : 'muted',
  );

  return (
    `<div class="body-evidence-inspect-card-section" data-inspect-target="front-landmark">`
    + `<div class="body-evidence-inspect-header">`
    + `<div class="body-evidence-inspect-name" title="${escapeHtml(selectedFront.name)}">${escapeHtml(displayName)}</div>`
    + `<div class="body-evidence-inspect-header-badges">`
    + `${renderBadge('Front Landmark', 'ok')}`
    + `${renderBadge(typeLabel, candidateType === 'secondary' ? 'muted' : 'ok')}`
    + `${renderBadge(scoreLabel, 'ok', 'Confidence')}`
    + `${promotedBadge}`
    + `</div>`
    + `</div>`
    + `<div class="body-evidence-coord-grid">`
    + renderCoordCell('X', `${formatCmValue(selectedFront.spaceX)} cm`)
    + renderCoordCell('Y', `${formatCmValue(selectedFront.spaceY)} cm`)
    + `</div>`
    + `</div>`
  );
}

function renderSideLandmarkCardHtml(selectedSide) {
  const displayName = formatLandmarkDisplayName(selectedSide.name) || selectedSide.name;
  const scoreLabel = formatScore(selectedSide.score);
  const candidateType = resolveCandidateType(selectedSide, 'side');
  const typeLabel = candidateType === 'secondary' ? 'Secondary' : 'Core';

  return (
    `<div class="body-evidence-inspect-card-section" data-inspect-target="side-landmark">`
    + `<div class="body-evidence-inspect-header">`
    + `<div class="body-evidence-inspect-name" title="${escapeHtml(selectedSide.name)}">${escapeHtml(displayName)}</div>`
    + `<div class="body-evidence-inspect-header-badges">`
    + `${renderBadge('Side Landmark', 'muted')}`
    + `${renderBadge(typeLabel, candidateType === 'secondary' ? 'muted' : 'ok')}`
    + `${renderBadge(scoreLabel, 'ok', 'Confidence')}`
    + `</div>`
    + `</div>`
    + `<div class="body-evidence-coord-grid">`
    + renderCoordCell('U', `${formatCmValue(selectedSide.sideUcm)} cm`)
    + renderCoordCell('Y', `${formatCmValue(selectedSide.sideYcm)} cm`)
    + `</div>`
    + `</div>`
  );
}

function renderSegmentationCardHtml(segClass) {
  const isFront = segClass.view === 'front';
  const displayName = formatLandmarkDisplayName(segClass.label) || segClass.label;
  const swatchColor = getSegClassSwatchColor(segClass.classId);
  const coveragePercent = (segClass.coverage * 100).toFixed(2) + '%';
  const presentBadge = renderBadge(
    segClass.present ? 'Present' : 'Absent',
    segClass.present ? 'ok' : 'muted',
  );

  const pxX = segClass.boundsPx
    ? `${segClass.boundsPx.minX} .. ${segClass.boundsPx.maxX}`
    : '—';
  const pxY = segClass.boundsPx
    ? `${segClass.boundsPx.minY} .. ${segClass.boundsPx.maxY}`
    : '—';

  const normX = segClass.boundsNormalized
    ? `${segClass.boundsNormalized.minX.toFixed(3)} .. ${segClass.boundsNormalized.maxX.toFixed(3)}`
    : '—';
  const normY = segClass.boundsNormalized
    ? `${segClass.boundsNormalized.minY.toFixed(3)} .. ${segClass.boundsNormalized.maxY.toFixed(3)}`
    : '—';

  const qa = segClass.qa;
  const qaValid = Boolean(qa?.valid);
  const qaStatusBadge = renderBadge(qaValid ? 'Valid' : 'Needs review', qaValid ? 'ok' : 'warn');

  let qaIssuesHtml = '';
  if (qa && Array.isArray(qa.issues) && qa.issues.length > 0) {
    qaIssuesHtml = `<div class="body-evidence-qa-issues">`
      + qa.issues.map((issue) => `<div class="body-evidence-qa-issue-item">⚠️ ${escapeHtml(issue)}</div>`).join('')
      + `</div>`;
  }

  return (
    `<div class="body-evidence-inspect-card-section" data-seg-inspect-view="${escapeHtml(segClass.view)}">`
    + `<div class="body-evidence-inspect-header">`
    + `<div class="body-evidence-inspect-name-row">`
    + `<span class="body-evidence-class-swatch body-evidence-class-swatch--large" style="background-color: ${swatchColor};"></span>`
    + `<div class="body-evidence-inspect-name" title="${escapeHtml(segClass.label)}">${escapeHtml(displayName)}</div>`
    + `</div>`
    + `<div class="body-evidence-inspect-header-badges">`
    + `${renderBadge(isFront ? 'Front Seg' : 'Side Seg', isFront ? 'ok' : 'muted')}`
    + `${renderBadge(`Class ${segClass.classId}`, 'ok')}`
    + `${presentBadge}`
    + `</div>`
    + `</div>`
    + `<div class="body-evidence-coord-grid">`
    + renderCoordCell('Pixels', `${segClass.pixelCount.toLocaleString()} px`)
    + renderCoordCell('Coverage', coveragePercent)
    + `</div>`
    + `<div class="body-evidence-bounds-box">`
    + `<div class="body-evidence-bounds-title">Bounding Box</div>`
    + `<div class="body-evidence-bounds-table">`
    + `<div class="body-evidence-bounds-table-row">`
    + `<span class="body-evidence-bounds-type">Pixels</span>`
    + `<span class="body-evidence-bounds-cell"><span class="body-evidence-bounds-axis">X:</span>${escapeHtml(pxX)}</span>`
    + `<span class="body-evidence-bounds-cell"><span class="body-evidence-bounds-axis">Y:</span>${escapeHtml(pxY)}</span>`
    + `</div>`
    + `<div class="body-evidence-bounds-table-row">`
    + `<span class="body-evidence-bounds-type">0..1</span>`
    + `<span class="body-evidence-bounds-cell"><span class="body-evidence-bounds-axis">X:</span>${escapeHtml(normX)}</span>`
    + `<span class="body-evidence-bounds-cell"><span class="body-evidence-bounds-axis">Y:</span>${escapeHtml(normY)}</span>`
    + `</div>`
    + `</div>`
    + `</div>`
    + `<div class="body-evidence-qa-summary-box">`
    + `<div class="body-evidence-qa-summary-header">`
    + `<span class="body-evidence-qa-summary-title">Segmentation QA · ${isFront ? 'Front' : 'Side'}</span>`
    + `${qaStatusBadge}`
    + `</div>`
    + `<div class="body-evidence-qa-grid">`
    + `<div class="body-evidence-qa-item"><span class="body-evidence-qa-key">Shape:</span> <span class="body-evidence-qa-val">${segClass.widthPx ?? '—'}×${segClass.heightPx ?? '—'}</span></div>`
    + `<div class="body-evidence-qa-item"><span class="body-evidence-qa-key">Dtype:</span> <span class="body-evidence-qa-val">${escapeHtml(segClass.dtype ?? '—')}</span></div>`
    + `<div class="body-evidence-qa-item"><span class="body-evidence-qa-key">Classes:</span> <span class="body-evidence-qa-val">${qa?.numClassesMatches ? 'Matches' : 'Mismatch'}</span></div>`
    + `<div class="body-evidence-qa-item"><span class="body-evidence-qa-key">Counts:</span> <span class="body-evidence-qa-val">${qa?.countsMatch ? 'Matches' : 'Mismatch'}</span></div>`
    + `</div>`
    + qaIssuesHtml
    + `</div>`
    + `</div>`
  );
}

/**
 * Renders the inspection card in the Selection tab.
 * Shows cards for whatever is currently selected:
 * - Front Landmark (if selected)
 * - Side Landmark (if selected)
 * - Front Segmentation Class (if selected)
 * - Side Segmentation Class (if selected)
 * If both Front and Side are selected, renders both independently.
 */
function renderSelectedLandmark() {
  if (!bodyEvidenceSelectedEl) {
    return;
  }

  const selectedFront = getSelectedBodyEvidenceLandmark();
  const selectedSide = getSelectedSideEvidenceLandmark();
  const selectedFrontSeg = getSelectedFrontSegClass();
  const selectedSideSeg = getSelectedSideSegClass();

  const hasAnySelection = (
    selectedFront != null
    || selectedSide != null
    || selectedFrontSeg != null
    || selectedSideSeg != null
  );

  if (!hasAnySelection) {
    bodyEvidenceSelectedEl.innerHTML = '<p class="body-evidence-selected-empty">No body landmark or segmentation class selected.</p>';
    syncClearSelectionButton();
    syncPromoteButton();
    return;
  }

  const cards = [];

  if (selectedFront) {
    cards.push(renderFrontLandmarkCardHtml(selectedFront));
  }
  if (selectedSide) {
    cards.push(renderSideLandmarkCardHtml(selectedSide));
  }
  if (selectedFrontSeg) {
    cards.push(renderSegmentationCardHtml(selectedFrontSeg));
  }
  if (selectedSideSeg) {
    cards.push(renderSegmentationCardHtml(selectedSideSeg));
  }

  bodyEvidenceSelectedEl.innerHTML = cards.join('<div class="body-evidence-card-divider"></div>');

  syncClearSelectionButton();
  syncPromoteButton();
}

export function openBodyEvidencePackageFilePicker() {
  importBodyEvidencePackageZipInput?.click();
}

function onClearSelection() {
  clearAllBodyEvidenceSelections();
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

export function runPromoteAllFrontCoreLandmarksAction() {
  const result = promoteAllFrontCoreLandmarks();
  if (result.promotedCount > 0) {
    showStatus(result.message, 'ok');
    showPromoteStatus(result.message, 'ok');
  } else if (result.alreadyPromotedCount > 0) {
    showStatus(result.message, 'info');
    showPromoteStatus(result.message, 'info');
  } else {
    showStatus(result.message || 'No front core landmarks to promote.', 'warn');
    showPromoteStatus(result.message || 'No front core landmarks to promote.', 'warn');
  }
  refreshCandidateLists();
  renderSelectedLandmark();
}

export function runDownloadBodyEvidenceAction() {
  const { ok, error } = downloadBodyEvidenceJson();
  if (!ok) {
    showStatus(error ?? 'Download failed.', 'error');
    return;
  }
  showStatus('Body Evidence JSON downloaded.', 'ok');
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

function onSegFilterButtonClick(event) {
  const source = event.currentTarget?.dataset?.bodyEvidenceSegSource;
  const filter = event.currentTarget?.dataset?.bodyEvidenceSegFilter;
  if (!SEGMENTATION_FILTERS.includes(filter)) {
    return;
  }
  setBodyEvidenceSegFilter(source, filter);
}

export function setupBodyEvidencePanel() {
  if (importBodyEvidencePackageZipInput) {
    importBodyEvidencePackageZipInput.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      showStatus(`Importing ${file.name}…`, 'info');
      try {
        const res = await importBodyEvidenceZip(file);
        if (!res.ok) {
          showStatus(res.error || 'Failed to import Body Evidence package.', 'error');
          console.warn('[TWENTY EIGHT] Body evidence package import failed:', res.error);
          return;
        }
        setBodyEvidencePackage(res.package);
        const analyzeRes = analyzeLoadedBodyEvidence();
        if (!analyzeRes.ok) {
          showStatus(analyzeRes.error ?? 'Analyze failed after package import.', 'error');
        } else {
          const sampleTag = res.sampleId ? ` [${res.sampleId}]` : '';
          showStatus(`Body Evidence Package loaded${sampleTag}.`, 'ok');
          setWorkspace(WORKSPACE_SPLIT);
        }
        refreshCandidateLists();
        renderSelectedLandmark();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error importing ZIP package.';
        console.warn('[TWENTY EIGHT] Body evidence ZIP import failed:', err);
        showStatus(msg, 'error');
      }
    });
  }

  clearBodyLandmarkSelectionBtn?.addEventListener('click', onClearSelection);
  promoteSelectedBodyLandmarkBtn?.addEventListener('click', runPromoteFrontEvidenceAction);
  promoteAllFrontCoreLandmarksBtn?.addEventListener('click', runPromoteAllFrontCoreLandmarksAction);

  if (typeof document !== 'undefined') {
    document.querySelectorAll('[data-body-evidence-tab]').forEach((button) => {
      button.addEventListener('click', onTabButtonClick);
    });
    document.querySelectorAll('[data-body-evidence-layer]').forEach((button) => {
      button.addEventListener('click', onLayerButtonClick);
    });
    document.querySelectorAll('[data-body-evidence-seg-filter]').forEach((button) => {
      button.addEventListener('click', onSegFilterButtonClick);
    });

    document.addEventListener('body-evidence-selection-focus', () => {
      setBodyEvidencePanelTab('selection');
    });
  }

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
  syncSegFilterUi('front');
  syncSegFilterUi('side');
  refreshCandidateLists();
  renderSelectedLandmark();
  hidePromoteStatus();
}



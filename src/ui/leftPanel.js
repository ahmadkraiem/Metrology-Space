/**
 * Persistent Left Panel Management (Stage 3)
 *
 * Unifies the Left Sidebar into a persistent, scan-friendly architecture:
 * 1. Subject / Evidence Package summary
 * 2. Anatomical Reference Levels (7 validated levels with dynamic Y cm)
 * 3. Contextual Selection & Annotation
 * 4. Manual Distance Measurement
 * 5. Advanced Evidence (Drawer)
 *
 * Consumes existing read-only runtime contracts without mutating domain state.
 */

import {
  getBodyEvidencePackage,
  getMetricCalibrationProvenance,
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import { computeAnatomicalLevels } from '../features/anatomicalLevels.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';
import {
  importBodyEvidencePackageZipInput,
} from './domRefs.js';

function renderModalityDot(present, title) {
  const toneClass = present ? 'modality-dot--present' : 'modality-dot--missing';
  const symbol = present ? '✓' : '✗';
  return `<span class="modality-item" title="${escapeHtml(title)}: ${present ? 'Present' : 'Missing'}"><span class="modality-dot ${toneClass}">${symbol}</span> ${escapeHtml(title)}</span>`;
}

export function renderSubjectPackageCard(containerEl) {
  if (!containerEl) {
    return;
  }

  const pkg = getBodyEvidencePackage();
  if (!pkg || !hasAnalyzedBodyEvidence()) {
    containerEl.innerHTML = `
      <div class="subject-package-empty">
        <p class="subject-package-empty-text">No Body Evidence Package Loaded</p>
        <button type="button" id="subject-package-upload-btn" class="panel-button panel-button--compact">Upload Evidence Package (.zip)</button>
      </div>
    `;
    const uploadBtn = containerEl.querySelector?.('#subject-package-upload-btn');
    uploadBtn?.addEventListener?.('click', () => {
      importBodyEvidencePackageZipInput?.click();
    });
    return;
  }

  const sampleId = pkg.sampleId || pkg.id || 'Standard Subject';
  const provenance = getMetricCalibrationProvenance();
  const calLabel = provenance.isIsotropic ? `${provenance.frontPxPerCm || 10} px/cm (Isotropic)` : 'Uncalibrated';

  const front = pkg.front || {};
  const side = pkg.side || {};

  containerEl.innerHTML = `
    <div class="subject-package-details">
      <div class="info-row">
        <span class="info-label">Sample ID</span>
        <span class="info-value info-value--data">${escapeHtml(sampleId)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Calibration</span>
        <span class="info-value">${escapeHtml(calLabel)}</span>
      </div>

      <div class="subject-modalities-matrix">
        <div class="subject-modality-col">
          <span class="subject-modality-header">Front View</span>
          ${renderModalityDot(Boolean(front.image?.present), 'Image')}
          ${renderModalityDot(Boolean(front.pose?.total > 0), 'Pose')}
          ${renderModalityDot(Boolean(front.segmentation?.raster), 'Segmentation')}
          ${renderModalityDot(Boolean(front.pointmap?.present), 'Pointmap')}
          ${renderModalityDot(Boolean(front.normals?.present), 'Normals')}
        </div>
        <div class="subject-modality-col">
          <span class="subject-modality-header">Side View</span>
          ${renderModalityDot(Boolean(side.image?.present), 'Image')}
          ${renderModalityDot(Boolean(side.pose?.total > 0), 'Pose')}
          ${renderModalityDot(Boolean(side.segmentation?.raster), 'Segmentation')}
          ${renderModalityDot(Boolean(side.pointmap?.present), 'Pointmap')}
          ${renderModalityDot(Boolean(side.normals?.present), 'Normals')}
        </div>
      </div>
      <button type="button" id="subject-package-replace-btn" class="panel-button panel-button--compact" style="margin-top:6px; width:100%;">Replace Package (.zip)</button>
    </div>
  `;

  const replaceBtn = containerEl.querySelector?.('#subject-package-replace-btn');
  replaceBtn?.addEventListener?.('click', () => {
    importBodyEvidencePackageZipInput?.click();
  });
}

export function renderAnatomicalLevelsCard(containerEl) {
  if (!containerEl) {
    return;
  }

  const annotations = getAnnotations();
  const levelsResult = computeAnatomicalLevels(annotations);
  const { levels } = levelsResult;

  if (!levels || levels.length === 0) {
    containerEl.innerHTML = '<p class="session-empty-state">No anatomical levels available.</p>';
    return;
  }

  const rows = levels.map((lvl) => {
    let yDisplay = '—';
    let tone = 'muted';

    if (lvl.status === 'ready' && typeof lvl.yCm === 'number') {
      yDisplay = `Y ${formatDistance(lvl.yCm)} cm`;
      tone = 'ok';
    } else if (lvl.status === 'partial') {
      yDisplay = 'Partial';
      tone = 'warn';
    } else {
      yDisplay = 'Missing';
      tone = 'muted';
    }

    return `
      <div class="anatomy-level-row" data-level-id="${escapeHtml(lvl.id)}">
        <span class="anatomy-level-name">${escapeHtml(lvl.name)}</span>
        <div class="anatomy-level-meta">
          <span class="anatomy-level-y">${escapeHtml(yDisplay)}</span>
          ${renderBadge(lvl.status, tone)}
        </div>
      </div>
    `;
  });

  containerEl.innerHTML = `
    <div class="anatomy-levels-list">
      ${rows.join('')}
    </div>
  `;
}

export function setupLeftPanel() {
  const summaryEl = document.getElementById('subject-package-summary');
  const levelsEl = document.getElementById('anatomy-levels-list');

  const updateAll = () => {
    renderSubjectPackageCard(summaryEl);
    renderAnatomicalLevelsCard(levelsEl);
  };

  subscribeBodyEvidenceChange(updateAll);
  subscribeAnnotationsChange(updateAll);
  updateAll();
}

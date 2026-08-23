/**
 * Body Evidence Package QA Summary HTML helper (v0).
 *
 * Reusable read-only renderer for the normalized Full Body Evidence Package QA
 * contract. Not currently mounted in the live Diagnostics accordion (Advanced QA
 * shows intake + calibration only). Kept for tests and as the Package QA HTML
 * surface if that card is remounted later.
 *
 * Reuses getBodyEvidencePackage() without recomputing or duplicating QA logic.
 */

import { getBodyEvidencePackage } from '../features/bodyEvidence.js';
import { escapeHtml } from './badgeUi.js';

function renderStatusBadge(label, type) {
  const baseClass = 'body-evidence-qa-pill';
  return `<span class="${baseClass} ${baseClass}--${type}">${escapeHtml(label)}</span>`;
}

function getModalityStatusBadge(present, qaStatus) {
  if (!present) {
    return renderStatusBadge('Missing', 'missing');
  }
  const status = (qaStatus || 'pass').toLowerCase();
  if (status === 'fail') {
    return renderStatusBadge('FAIL', 'fail');
  }
  if (status === 'warning' || status === 'warn') {
    return renderStatusBadge('WARNING', 'warn');
  }
  return renderStatusBadge('PASS', 'ok');
}

function getImageStatusBadge(imageEvidence) {
  if (!imageEvidence || !imageEvidence.present) {
    return renderStatusBadge('Missing', 'missing');
  }
  return renderStatusBadge('Present', 'ok');
}

function getPoseStatusBadge(poseEvidence, modalityPresent) {
  if (!modalityPresent || !poseEvidence || poseEvidence.total === 0) {
    return renderStatusBadge('Missing', 'missing');
  }
  if (poseEvidence.accepted === 0 && poseEvidence.total > 0) {
    return renderStatusBadge('FAIL', 'fail');
  }
  if (poseEvidence.lowConfidence > 0) {
    return renderStatusBadge('WARNING', 'warn');
  }
  return renderStatusBadge('PASS', 'ok');
}

function getSegStatusBadge(segEvidence, modalityPresent) {
  if (!modalityPresent || !segEvidence || !segEvidence.raster) {
    return renderStatusBadge('Missing', 'missing');
  }
  const valid = segEvidence.qa?.valid ?? (segEvidence.qa?.status === 'pass');
  if (!valid) {
    return renderStatusBadge('FAIL', 'fail');
  }
  if (segEvidence.qa?.warnings && segEvidence.qa.warnings.length > 0) {
    return renderStatusBadge('WARNING', 'warn');
  }
  return renderStatusBadge('PASS', 'ok');
}

function getRasterCompatBadge(rasterCompatibility) {
  const status = rasterCompatibility?.status?.toLowerCase() ?? 'pass';
  if (status === 'fail') {
    return renderStatusBadge('FAIL', 'fail');
  }
  return renderStatusBadge('PASS', 'ok');
}

function renderViewSection(viewTitle, viewEvidence) {
  const imageBadge = getImageStatusBadge(viewEvidence?.image);
  const poseBadge = getPoseStatusBadge(viewEvidence?.pose, viewEvidence?.qa?.modalities?.pose);
  const segBadge = getSegStatusBadge(viewEvidence?.segmentation, viewEvidence?.qa?.modalities?.segmentation);
  const pointmapBadge = getModalityStatusBadge(viewEvidence?.pointmap?.present, viewEvidence?.pointmap?.qa?.status);
  const normalsBadge = getModalityStatusBadge(viewEvidence?.normals?.present, viewEvidence?.normals?.qa?.status);
  const rasterBadge = getRasterCompatBadge(viewEvidence?.qa?.rasterCompatibility);

  return `
    <div class="body-package-qa-view-group">
      <div class="body-package-qa-view-title">${escapeHtml(viewTitle)}</div>
      <div class="body-package-qa-row"><span>Image</span>${imageBadge}</div>
      <div class="body-package-qa-row"><span>Pose</span>${poseBadge}</div>
      <div class="body-package-qa-row"><span>Segmentation</span>${segBadge}</div>
      <div class="body-package-qa-row"><span>Pointmap Numeric QA</span>${pointmapBadge}</div>
      <div class="body-package-qa-row"><span>Normal Numeric QA</span>${normalsBadge}</div>
      <div class="body-package-qa-row"><span>Raster Compatibility</span>${rasterBadge}</div>
    </div>
  `;
}

/**
 * Generates the HTML markup for the Body Evidence Package QA Summary.
 * Returns empty string if no package is loaded.
 *
 * @param {object|null} [pkg]
 * @returns {string} HTML string
 */
export function renderBodyEvidencePackageQaHtml(pkg = getBodyEvidencePackage()) {
  if (!pkg || typeof pkg !== 'object') {
    return '';
  }

  const pkgStatus = (pkg.qa?.status || 'pass').toLowerCase();
  const overallBadgeType = pkgStatus === 'fail' ? 'fail' : (pkgStatus === 'warning' || pkgStatus === 'warn' ? 'warn' : 'ok');
  const overallBadgeLabel = pkgStatus.toUpperCase();

  const frontHtml = renderViewSection('Front', pkg.front);
  const sideHtml = renderViewSection('Side', pkg.side);

  return `
    <div class="body-evidence-package-qa-card" aria-label="Body Evidence Package QA">
      <div class="body-package-qa-header">
        <span class="body-package-qa-title">Package QA</span>
        ${renderStatusBadge(overallBadgeLabel, overallBadgeType)}
      </div>
      <div class="body-package-qa-grid">
        ${frontHtml}
        ${sideHtml}
      </div>
      <div class="body-package-qa-deferred">
        <div class="body-package-qa-deferred-title">Authoritative Physical Pointmap Geometry</div>
        <div class="body-package-qa-row">
          <span>Physical Pointmap Interpretation</span>
          ${renderStatusBadge('VALIDATION PENDING', 'unvalidated')}
        </div>
        <div class="body-package-qa-row">
          <span>Sapiens Runtime Audit</span>
          ${renderStatusBadge('DEFERRED', 'unvalidated')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Advanced QA + Why This Result Is Blocked (Stage 2)
 *
 * Advanced QA is the deepest technical layer: package identity and metric
 * calibration provenance. Eligibility / blocker detail lives once in
 * Diagnostics → Why This Result Is Blocked.
 *
 * Strict Guardrails:
 * - Read-only from existing runtime domain contracts.
 * - Display de-duplication only; getters and eligibility computation stay intact.
 * - No claims of coronal/sagittal certified orientation unless supported by runtime.
 */

import {
  getBodyEvidencePackage,
  getBodyEvidenceQa,
  getMetricCalibrationProvenance,
  getPairedCrossViewEligibilityReport,
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { mapBlockerToHumanLabel } from './derivedMeasurementDeck.js';

function toneForStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'pass' || s === 'ok' || s === 'ready' || s === 'validated' || s === 'eligible') {
    return 'ok';
  }
  if (s === 'warning' || s === 'warn' || s === 'partial' || s === 'blocked') {
    return 'warn';
  }
  if (s === 'fail' || s === 'invalid' || s === 'error') {
    return 'fail';
  }
  return 'muted';
}

function renderIntakeSection(pkg, qa) {
  const sampleId = pkg?.sampleId || pkg?.id || 'Standard Subject';
  const version = pkg?.version || qa?.version || 'v0';
  const format = pkg?.sourceFormat || qa?.sourceFormat || 'REVacity Package';
  const statusBadge = pkg ? renderBadge('Loaded', 'ok') : renderBadge('Unavailable', 'muted');

  return `
    <div class="advanced-qa-section" data-qa-section="intake">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Intake & Package</span>
        ${statusBadge}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Sample ID</span><span class="info-value info-value--data">${escapeHtml(sampleId)}</span></div>
        <div class="info-row"><span class="info-label">Format / Ver</span><span class="info-value">${escapeHtml(format)} (${escapeHtml(version)})</span></div>
      </div>
    </div>
  `;
}

function renderCalibrationSection(provenance) {
  const calStatus = provenance?.status || 'unavailable';
  const isIsotropic = provenance?.calibration?.isIsotropic ?? provenance?.isIsotropic;
  const pixelsPerCm = provenance?.calibration?.pixelsPerCm
    ?? provenance?.frontPxPerCm
    ?? null;
  const calBadge = provenance
    ? renderBadge(String(calStatus).toUpperCase(), toneForStatus(calStatus))
    : renderBadge('Unavailable', 'muted');
  const isotropicBadge = provenance
    ? renderBadge(isIsotropic ? 'Isotropic' : 'Uncalibrated', isIsotropic ? 'ok' : 'warn')
    : renderBadge('Unavailable', 'muted');
  const scaleText = typeof pixelsPerCm === 'number' && Number.isFinite(pixelsPerCm)
    ? `${pixelsPerCm} px/cm`
    : '—';

  return `
    <div class="advanced-qa-section" data-qa-section="calibration">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Calibration</span>
        ${calBadge}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Calibration Scale</span><span class="info-value">${escapeHtml(scaleText)}</span></div>
        <div class="info-row"><span class="info-label">Scale Model</span><span class="info-value">${isotropicBadge}</span></div>
      </div>
    </div>
  `;
}

function summarizeEligibilityStatus(pairs) {
  const statuses = (Array.isArray(pairs) ? pairs : []).map((pair) =>
    String(pair?.pairedStatus || 'unavailable').toLowerCase(),
  );
  if (statuses.length === 0) {
    return 'unavailable';
  }
  if (statuses.includes('blocked')) {
    return 'blocked';
  }
  if (statuses.includes('partial')) {
    return 'partial';
  }
  if (statuses.every((status) => status === 'eligible')) {
    return 'eligible';
  }
  if (statuses.every((status) => status === 'unavailable')) {
    return 'unavailable';
  }
  return statuses.includes('eligible') ? 'partial' : 'unavailable';
}

function hasBlockingReasons(pairs) {
  return (Array.isArray(pairs) ? pairs : []).some((pair) => {
    const status = String(pair?.pairedStatus || '').toLowerCase();
    const blockers = Array.isArray(pair?.blockers) ? pair.blockers : [];
    return status === 'blocked' || blockers.length > 0;
  });
}

export function buildPhysicalEligibilityHtml(eligibilityReport) {
  const pairs = eligibilityReport?.pairs ?? [];
  if (!hasBlockingReasons(pairs)) {
    return '<p class="session-empty-state">No results are blocked.</p>';
  }

  const summaryStatus = summarizeEligibilityStatus(pairs);
  const rowsHtml = pairs.map((pair) => {
    const levelName = pair.sourceLevel ? pair.sourceLevel.toUpperCase() : 'PAIR';
    const status = pair.pairedStatus || 'unavailable';
    const badge = renderBadge(status.toUpperCase(), toneForStatus(status));
    const blockers = Array.isArray(pair.blockers) ? pair.blockers : [];

    const blockersHtml = blockers.length > 0
      ? `<div class="qa-blocker-chips">${blockers.map((b) => `<span class="qa-blocker-chip" title="Code: ${escapeHtml(b)}">${escapeHtml(mapBlockerToHumanLabel(b))}</span>`).join('')}</div>`
      : '<span class="info-value info-value--muted">None</span>';

    return `
      <div class="qa-eligibility-pair">
        <div class="info-row">
          <span class="info-label font-semibold">${escapeHtml(levelName)} Paired Eligibility</span>
          <span class="info-value">${badge}</span>
        </div>
        <div class="qa-eligibility-blockers-row">
          <span class="info-label">Blockers:</span>
          ${blockersHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="advanced-qa-section" data-qa-section="why-blocked">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Result Status</span>
        ${renderBadge(summaryStatus.toUpperCase(), toneForStatus(summaryStatus))}
      </div>
      <div class="advanced-qa-section-body">
        ${rowsHtml}
      </div>
    </div>
  `;
}

export function buildAdvancedQaContentHtml({
  pkg = null,
  qa = null,
  provenance = null,
} = {}) {
  return `
    <div class="advanced-qa-drawer-content">
      ${renderIntakeSection(pkg, qa)}
      ${renderCalibrationSection(provenance)}
    </div>
  `;
}

export function renderAdvancedQaPanel(containerEl) {
  if (!containerEl) {
    return;
  }

  if (!hasAnalyzedBodyEvidence()) {
    containerEl.innerHTML = `
      <div class="advanced-qa-empty">
        <p class="session-empty-state">No Body Evidence Package Loaded</p>
      </div>
    `;
    return;
  }

  const pkg = getBodyEvidencePackage();
  const qa = getBodyEvidenceQa();
  const provenance = getMetricCalibrationProvenance();

  containerEl.innerHTML = buildAdvancedQaContentHtml({
    pkg,
    qa,
    provenance,
  });
}

export function renderWhyResultBlocked(containerEl) {
  if (!containerEl) {
    return;
  }

  if (!hasAnalyzedBodyEvidence()) {
    containerEl.innerHTML = '<p class="session-empty-state">No results are blocked.</p>';
    return;
  }

  const annotations = getAnnotations();
  const eligibilityReport = getPairedCrossViewEligibilityReport
    ? getPairedCrossViewEligibilityReport({ annotations })
    : null;

  containerEl.innerHTML = buildPhysicalEligibilityHtml(eligibilityReport);
}

export function setupAdvancedQaPanel() {
  const qaEl = document.getElementById('advanced-qa-content');
  const blockedEl = document.getElementById('why-result-blocked');
  if (!qaEl && !blockedEl) {
    return;
  }

  const update = () => {
    renderAdvancedQaPanel(qaEl);
    renderWhyResultBlocked(blockedEl);
  };

  subscribeBodyEvidenceChange(update);
  subscribeAnnotationsChange(update);
  update();
}

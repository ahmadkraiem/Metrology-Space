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
  getSidePoseQualification,
  getSideViewOrientationQualification,
  getSidePhysicalDepthQualifications,
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
  if (s === 'pass' || s === 'ok' || s === 'ready' || s === 'validated' || s === 'eligible' || s === 'qualified') {
    return 'ok';
  }
  if (s === 'warning' || s === 'warn' || s === 'partial' || s === 'blocked') {
    return 'warn';
  }
  if (s === 'fail' || s === 'invalid' || s === 'error' || s === 'disqualified') {
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

function renderSidePoseQaSection(sidePoseQual) {
  const status = sidePoseQual?.status || 'unavailable';
  const armSummary = sidePoseQual?.summary?.evaluatedArms?.join(', ') || 'None';
  const dominantArm = sidePoseQual?.summary?.dominantArm ? ` (${sidePoseQual.summary.dominantArm} arm)` : '';
  const armText = sidePoseQual ? `${armSummary}${dominantArm}` : '—';
  const isQualified = sidePoseQual?.qualified === true;
  const postureText = sidePoseQual
    ? (isQualified ? 'Horizontal reach & straight elbows verified' : (sidePoseQual.issues?.[0] || sidePoseQual.warnings?.[0] || 'Pose unverified'))
    : '—';

  return `
    <div class="advanced-qa-section" data-qa-section="side-pose">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Side T-Pose Stance</span>
        ${renderBadge(String(status).toUpperCase(), toneForStatus(status))}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Evaluated Arms</span><span class="info-value">${escapeHtml(armText)}</span></div>
        <div class="info-row info-row--stacked"><span class="info-label">Stance Geometry</span><span class="info-value">${escapeHtml(postureText)}</span></div>
      </div>
    </div>
  `;
}

function renderSideOrientationQaSection(sideOrientationQual) {
  const status = sideOrientationQual?.status || 'unavailable';
  const orientationText = sideOrientationQual?.orientationSemantics
    ? sideOrientationQual.orientationSemantics.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';
  const usablePairs = sideOrientationQual?.summary?.usablePairsCount ?? 0;
  const passedPairs = sideOrientationQual?.summary?.passedPairsCount ?? 0;
  const aggRatio = sideOrientationQual?.summary?.aggregateCollapseRatio;
  const ratioText = typeof aggRatio === 'number' && Number.isFinite(aggRatio)
    ? `${(aggRatio * 100).toFixed(1)}% collapse`
    : '—';
  const consensusText = sideOrientationQual
    ? `${passedPairs}/${usablePairs} pairs passed (${ratioText})`
    : '—';

  return `
    <div class="advanced-qa-section" data-qa-section="side-orientation">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Side Lateral Orientation</span>
        ${renderBadge(String(status).toUpperCase(), toneForStatus(status))}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Orientation Stance</span><span class="info-value">${escapeHtml(orientationText)}</span></div>
        <div class="info-row info-row--stacked"><span class="info-label">Bilateral Consensus</span><span class="info-value">${escapeHtml(consensusText)}</span></div>
        <div class="info-row info-row--stacked"><span class="info-label">Fidelity Scope</span><span class="info-value info-value--muted">Projection collapse · No 90° claim</span></div>
      </div>
    </div>
  `;
}

function renderSidePhysicalDepthSection(depthQualReport) {
  const quals = depthQualReport?.qualifications || [];
  if (quals.length === 0) return '';

  const shoulderQual = quals.find((q) => q.sourceLevel === 'shoulder') || null;
  const hipQual = quals.find((q) => q.sourceLevel === 'hip') || null;

  const renderRow = (label, qual) => {
    const status = qual?.status || 'unavailable';
    const val = typeof qual?.qualifiedDepthEstimateCm === 'number'
      ? `${qual.qualifiedDepthEstimateCm.toFixed(2)} cm`
      : '—';
    return `
      <div class="info-row">
        <span class="info-label">${escapeHtml(label)}</span>
        <span class="info-value">${renderBadge(status.toUpperCase(), toneForStatus(status))} <strong style="margin-left:4px;">${escapeHtml(val)}</strong></span>
      </div>
    `;
  };

  return `
    <div class="advanced-qa-section" data-qa-section="side-depth-qualification">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Side AP Depth Qualification</span>
      </div>
      <div class="advanced-qa-section-body">
        ${renderRow('Shoulder AP Depth', shoulderQual)}
        ${renderRow('Hip AP Depth', hipQual)}
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
  sidePoseQual = null,
  sideOrientationQual = null,
  depthQualReport = null,
} = {}) {
  return `
    <div class="advanced-qa-drawer-content">
      ${renderIntakeSection(pkg, qa)}
      ${renderCalibrationSection(provenance)}
      ${renderSidePoseQaSection(sidePoseQual)}
      ${renderSideOrientationQaSection(sideOrientationQual)}
      ${renderSidePhysicalDepthSection(depthQualReport)}
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
  const sidePoseQual = getSidePoseQualification ? getSidePoseQualification() : null;
  const sideOrientationQual = getSideViewOrientationQualification ? getSideViewOrientationQualification() : null;
  const depthQualReport = getSidePhysicalDepthQualifications ? getSidePhysicalDepthQualifications() : null;

  containerEl.innerHTML = buildAdvancedQaContentHtml({
    pkg,
    qa,
    provenance,
    sidePoseQual,
    sideOrientationQual,
    depthQualReport,
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

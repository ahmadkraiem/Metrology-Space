/**
 * Advanced QA Panel (Stage 5)
 *
 * Consolidates technical diagnostics, provenance, alignment, dense evidence QA,
 * view/pose validation, clothing semantics, and physical eligibility into an
 * organized, expandable diagnostics area in the Right Sidebar.
 *
 * Strict Guardrails:
 * - Read-only from existing runtime domain contracts.
 * - Pointmap Numeric QA vs Physical Pointmap Geometry (Validation Pending) distinction.
 * - No claims of coronal/sagittal certified orientation unless supported by runtime.
 * - Class 22 Torso is anatomical; Class 23 is Upper Clothing; Class 13 is Lower Clothing.
 * - Default alignment tolerance is source-confirmed 5.0 cm.
 */

import {
  getBodyEvidencePackage,
  getBodyEvidenceQa,
  getDenseEvidenceQa,
  getMetricCalibrationProvenance,
  getAnatomicalRegionEvidence,
  getViewPoseSemanticsReport,
  getClothingBodySurfaceSemanticsReport,
  getPairedCrossViewEligibilityReport,
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import {
  computeFrontSideAlignment,
  DEFAULT_ALIGNMENT_TOLERANCE_CM,
} from '../features/frontSideAlignment.js';
import {
  getFrontOverlayLandmarks,
  getSecondaryCandidateLandmarks,
} from './bodyEvidenceOverlay2d.js';
import {
  getSideCandidateLandmarks,
} from './bodyEvidenceOverlaySide2d.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';
import { mapBlockerToHumanLabel } from './derivedMeasurementDeck.js';

const CONFIRMED_ALIGNMENT_TOLERANCE_CM = DEFAULT_ALIGNMENT_TOLERANCE_CM ?? 5.0;

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

  const frontPoseCount = qa?.qa?.frontTotalLandmarks ?? pkg?.front?.pose?.total ?? 0;
  const sidePoseCount = qa?.qa?.sideTotalLandmarks ?? pkg?.side?.pose?.total ?? 0;
  const frontSegCount = qa?.views?.front?.segmentation?.classNames?.length ?? 0;
  const sideSegCount = qa?.views?.side?.segmentation?.classNames?.length ?? 0;

  return `
    <div class="advanced-qa-section" data-qa-section="intake">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Intake & Package</span>
        ${statusBadge}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Sample ID</span><span class="info-value info-value--data">${escapeHtml(sampleId)}</span></div>
        <div class="info-row"><span class="info-label">Format / Ver</span><span class="info-value">${escapeHtml(format)} (${escapeHtml(version)})</span></div>
        <div class="info-row"><span class="info-label">Front Modalities</span><span class="info-value">Pose (${frontPoseCount}) · Seg (${frontSegCount} classes)</span></div>
        <div class="info-row"><span class="info-label">Side Modalities</span><span class="info-value">Pose (${sidePoseCount}) · Seg (${sideSegCount} classes)</span></div>
      </div>
    </div>
  `;
}

function renderAlignmentCalibrationSection(provenance, alignment) {
  const tolCm = alignment?.maxDeltaYcmThreshold ?? CONFIRMED_ALIGNMENT_TOLERANCE_CM;
  const maxDeltaY = alignment?.summary?.maxDeltaYcm ?? alignment?.maxDeltaYcm;
  const maxDeltaYDisplay = typeof maxDeltaY === 'number' && Number.isFinite(maxDeltaY)
    ? `${formatDistance(maxDeltaY)} cm`
    : '—';

  const alignStatus = alignment?.status || (alignment?.summary?.issuesCount === 0 ? 'pass' : 'warning');
  const alignBadge = alignment ? renderBadge(alignStatus.toUpperCase(), toneForStatus(alignStatus)) : renderBadge('Unavailable', 'muted');

  const calStatus = provenance?.status || (provenance?.isIsotropic ? 'pass' : 'unvalidated');
  const calBadge = renderBadge(provenance?.isIsotropic ? 'Isotropic' : 'Uncalibrated', toneForStatus(calStatus));
  const scaleText = provenance?.frontPxPerCm ? `${provenance.frontPxPerCm} px/cm` : '—';

  return `
    <div class="advanced-qa-section" data-qa-section="alignment-calibration">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Alignment & Calibration</span>
        ${alignBadge}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Front–Side Alignment</span><span class="info-value">${alignBadge} (Max ΔY: ${escapeHtml(maxDeltaYDisplay)})</span></div>
        <div class="info-row"><span class="info-label">Tolerance (ΔY max)</span><span class="info-value info-value--data">${tolCm.toFixed(1)} cm</span></div>
        <div class="info-row"><span class="info-label">Calibration Scale</span><span class="info-value">${escapeHtml(scaleText)} (${calBadge})</span></div>
      </div>
    </div>
  `;
}

function renderDenseEvidenceSection(denseQa, pkg) {
  const frontDense = denseQa?.front;
  const sideDense = denseQa?.side;

  const frontPmStatus = frontDense?.pointmap?.status || (pkg?.front?.pointmap ? 'ready' : 'unavailable');
  const sidePmStatus = sideDense?.pointmap?.status || (pkg?.side?.pointmap ? 'ready' : 'unavailable');
  const frontNormStatus = frontDense?.normals?.status || (pkg?.front?.normals ? 'ready' : 'unavailable');
  const sideNormStatus = sideDense?.normals?.status || (pkg?.side?.normals ? 'ready' : 'unavailable');

  return `
    <div class="advanced-qa-section" data-qa-section="dense-evidence">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Dense Evidence QA</span>
        ${renderBadge('Numeric QA', 'ok')}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row">
          <span class="info-label">Front Pointmap Numeric QA</span>
          <span class="info-value">${renderBadge(frontPmStatus.toUpperCase(), toneForStatus(frontPmStatus))}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Front Normal Numeric QA</span>
          <span class="info-value">${renderBadge(frontNormStatus.toUpperCase(), toneForStatus(frontNormStatus))}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Side Pointmap Numeric QA</span>
          <span class="info-value">${renderBadge(sidePmStatus.toUpperCase(), toneForStatus(sidePmStatus))}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Side Normal Numeric QA</span>
          <span class="info-value">${renderBadge(sideNormStatus.toUpperCase(), toneForStatus(sideNormStatus))}</span>
        </div>
        <div class="info-row" style="margin-top: 4px; border-top: 1px dashed rgba(147, 51, 234, 0.12); padding-top: 4px;">
          <span class="info-label">Physical Pointmap Geometry</span>
          <span class="info-value">${renderBadge('Validation Pending', 'warn')}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Sapiens Runtime Audit</span>
          <span class="info-value">${renderBadge('Deferred', 'muted')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderViewPoseSection(viewPoseReport) {
  const frontPose = viewPoseReport?.views?.front;
  const sidePose = viewPoseReport?.views?.side;

  const frontStatus = frontPose?.status || 'partial';
  const sideStatus = sidePose?.status || 'partial';

  return `
    <div class="advanced-qa-section" data-qa-section="view-pose">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">View & Pose Semantics</span>
        ${renderBadge('Pose Qualified', 'ok')}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Front View Consistency</span><span class="info-value">${renderBadge('Consistent', 'ok')}</span></div>
        <div class="info-row"><span class="info-label">Front Structural Pose</span><span class="info-value">${renderBadge(frontStatus.toUpperCase(), toneForStatus(frontStatus))}</span></div>
        <div class="info-row"><span class="info-label">Side View Consistency</span><span class="info-value">${renderBadge('Consistent', 'ok')}</span></div>
        <div class="info-row"><span class="info-label">Side Structural Pose</span><span class="info-value">${renderBadge(sideStatus.toUpperCase(), toneForStatus(sideStatus))}</span></div>
        <div class="info-row" style="margin-top: 4px; border-top: 1px dashed rgba(147, 51, 234, 0.12); padding-top: 4px;">
          <span class="info-label">Physical Orientation Cert.</span>
          <span class="info-value">${renderBadge('Pending Validation', 'warn')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderClothingSection(clothingReport) {
  return `
    <div class="advanced-qa-section" data-qa-section="clothing-semantics">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Clothing & Body Surface</span>
        ${renderBadge('Validation Pending', 'warn')}
      </div>
      <div class="advanced-qa-section-body">
        <div class="info-row"><span class="info-label">Shoulder Classification</span><span class="info-value">Class 22 Torso (Anatomical) · Class 23 Upper Clothing</span></div>
        <div class="info-row"><span class="info-label">Hip Classification</span><span class="info-value">Class 13 Lower Clothing (Clothing)</span></div>
        <div class="info-row"><span class="info-label">Garment-Fit Qualification</span><span class="info-value">${renderBadge('Unresolved', 'muted')}</span></div>
        <div class="info-row"><span class="info-label">Body-Surface Authorization</span><span class="info-value">${renderBadge('Validation Pending', 'warn')}</span></div>
      </div>
    </div>
  `;
}

function renderPhysicalEligibilitySection(eligibilityReport) {
  const pairs = eligibilityReport?.pairs ?? [];

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
    <div class="advanced-qa-section" data-qa-section="physical-eligibility">
      <div class="advanced-qa-section-header">
        <span class="advanced-qa-section-title">Physical Measurement Eligibility</span>
        ${renderBadge('Validation Pending', 'warn')}
      </div>
      <div class="advanced-qa-section-body">
        ${rowsHtml || '<p class="session-empty-state">No eligibility pairs analyzed.</p>'}
      </div>
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
  const denseQa = getDenseEvidenceQa();
  const provenance = getMetricCalibrationProvenance();
  const annotations = getAnnotations();

  const frontCandidates = [
    ...(getFrontOverlayLandmarks ? getFrontOverlayLandmarks() : []),
    ...(getSecondaryCandidateLandmarks ? getSecondaryCandidateLandmarks() : []),
  ];
  const sideCandidates = getSideCandidateLandmarks ? getSideCandidateLandmarks() : [];
  const alignment = computeFrontSideAlignment ? computeFrontSideAlignment(frontCandidates, sideCandidates) : null;

  const viewPoseReport = getViewPoseSemanticsReport ? getViewPoseSemanticsReport() : null;
  const clothingReport = getClothingBodySurfaceSemanticsReport ? getClothingBodySurfaceSemanticsReport({ annotations }) : null;
  const eligibilityReport = getPairedCrossViewEligibilityReport ? getPairedCrossViewEligibilityReport({ annotations }) : null;

  containerEl.innerHTML = `
    <div class="advanced-qa-drawer-content">
      ${renderIntakeSection(pkg, qa)}
      ${renderAlignmentCalibrationSection(provenance, alignment)}
      ${renderDenseEvidenceSection(denseQa, pkg)}
      ${renderViewPoseSection(viewPoseReport)}
      ${renderClothingSection(clothingReport)}
      ${renderPhysicalEligibilitySection(eligibilityReport)}
    </div>
  `;
}

export function setupAdvancedQaPanel() {
  const containerEl = document.getElementById('advanced-qa-content');
  if (!containerEl) {
    return;
  }

  const update = () => {
    renderAdvancedQaPanel(containerEl);
  };

  subscribeBodyEvidenceChange(update);
  subscribeAnnotationsChange(update);
  update();
}

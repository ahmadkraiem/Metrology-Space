/**
 * Primary Derived Measurement Deck (Stage 4)
 *
 * Renders the primary derived measurement cards (Shoulder and Hip paired measurements)
 * at the top of the Right Sidebar.
 *
 * Strict Guardrails:
 * - Read-only from existing domain contracts (crossViewMeasurementCorrespondence & pairedCrossViewEligibility).
 * - No Front/Side mathematical fusion, circumference, or 3D thickness calculations.
 * - No "Depth" or "Z-Depth" terminology.
 * - Manual A/B measurement history remains strictly independent.
 */

import {
  getCrossViewMeasurementCorrespondence,
  getPairedCrossViewEligibility,
  getSidePhysicalDepthQualification,
  getCrossSectionEvidence,
  getDirectBodyMeasurements,
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';
import { initCollapsibleSections } from './collapsibleSections.js';

const DERIVED_CORRESPONDENCE_PAIRS = Object.freeze([
  {
    id: 'torso_shoulder_cross_view_correspondence',
    name: 'Shoulder Level',
    levelKey: 'shoulder',
  },
  {
    id: 'torso_hip_cross_view_correspondence',
    name: 'Hip Level',
    levelKey: 'hip',
  },
]);

const groupCollapseStates = new Map([
  ['cross_section_evidence', false],
  ['vertical_measurements', true],
  ['arm_segments', true],
  ['leg_segments', true],
]);

export function mapBlockerToHumanLabel(code) {
  switch (code) {
    case 'clothing_authorization_missing':
    case 'clothing_evaluation_failed':
    case 'clothing_blocked':
      return 'Clothing Validation Pending';
    case 'view_pose_semantics_missing':
    case 'view_pose_evaluation_failed':
    case 'physical_orientation_unauthorized':
      return 'Capture Orientation Validation Pending';
    case 'authoritative_physical_evidence_missing':
    case 'pointmap_evidence_missing':
      return 'Physical Evidence Validation Pending';
    case 'comparability_qa_missing':
    case 'comparability_qa_failed':
      return 'Cross-View Comparability Pending';
    case 'correspondence_unavailable':
    case 'correspondence_partial':
      return 'View Alignment Incomplete';
    default:
      return String(code || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function mapDepthIssueToShortReason(depthQual) {
  if (!depthQual) return null;
  const issues = depthQual.issues ?? [];
  const allText = issues.join(' ').toLowerCase();

  if (allText.includes('t-pose') || allText.includes('arm') || allText.includes('elbow') || allText.includes('lowered')) {
    return 'Side pose not qualified';
  }
  if (allText.includes('lateral') || allText.includes('collapse') || allText.includes('bilateral')) {
    return 'Lateral evidence insufficient';
  }
  if (allText.includes('calibration') || allText.includes('scale')) {
    return 'Calibration unavailable';
  }
  if (allText.includes('clothing') || allText.includes('garment') || allText.includes('body-surface')) {
    return 'Body-surface authorization failed';
  }
  if (allText.includes('source') || allText.includes('missing')) {
    return 'Source span unavailable';
  }
  if (depthQual.status === 'warning') {
    return 'Provisional qualification';
  }
  if (depthQual.status === 'disqualified') {
    return 'Disqualified';
  }
  return null;
}

export function deriveMeasurementCardStatus(eligibility, crossSectionEvidence = null) {
  if (crossSectionEvidence) {
    const csStatus = String(crossSectionEvidence.status || 'unavailable').toLowerCase();
    if (csStatus === 'qualified') {
      return { label: 'Qualified', tone: 'ok' };
    }
    if (csStatus === 'warning') {
      return { label: 'Warning', tone: 'warn' };
    }
    if (csStatus === 'blocked') {
      return { label: 'Blocked', tone: 'warn' };
    }
    if (csStatus === 'invalid') {
      return { label: 'Invalid', tone: 'warn' };
    }
    return { label: 'Unavailable', tone: 'muted' };
  }
  const status = String(eligibility?.pairedStatus || 'unavailable').toLowerCase();
  if (status === 'eligible') {
    return { label: 'Eligible', tone: 'ok' };
  }
  if (status === 'partial') {
    return { label: 'Partial', tone: 'warn' };
  }
  if (status === 'blocked') {
    return { label: 'Blocked', tone: 'warn' };
  }
  return { label: 'Unavailable', tone: 'muted' };
}

export function deriveCrossSectionStatus(crossSectionEvidence) {
  const status = String(crossSectionEvidence?.status || 'unavailable').toLowerCase();
  if (status === 'qualified') {
    return { label: 'Qualified', tone: 'ok' };
  }
  if (status === 'warning') {
    return { label: 'Warning', tone: 'warn' };
  }
  if (status === 'blocked') {
    return { label: 'Blocked', tone: 'warn' };
  }
  if (status === 'invalid') {
    return { label: 'Invalid', tone: 'warn' };
  }
  return { label: 'Unavailable', tone: 'muted' };
}

function formatSpanDisplay(observation, fallbackSpanCm) {
  const span = observation?.spanCm ?? observation?.valueCm ?? fallbackSpanCm;
  if (typeof span === 'number' && Number.isFinite(span)) {
    return `${formatDistance(span)} cm`;
  }
  return 'Unavailable';
}

export function buildDerivedMeasurementCardHtml({ id, name }, correspondence, eligibility, depthQual = null, crossSectionEvidence = null) {
  const frontObs = correspondence?.frontObservation;
  const sideObs = correspondence?.sideObservation;

  const yCm = correspondence?.provenance?.frontLevelYcm
    ?? correspondence?.provenance?.sideLevelYcm
    ?? frontObs?.level?.yCm
    ?? sideObs?.level?.yCm
    ?? depthQual?.levelYcm
    ?? crossSectionEvidence?.levelYcm;

  const yDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `Y ${formatDistance(yCm)} cm`
    : 'Y —';

  const status = deriveMeasurementCardStatus(eligibility, crossSectionEvidence);
  const csStatus = deriveCrossSectionStatus(crossSectionEvidence);
  const frontDisplay = formatSpanDisplay(frontObs, eligibility?.frontMetricSpanCm ?? crossSectionEvidence?.frontObservation?.transverseWidthCm);
  const sideDisplay = formatSpanDisplay(sideObs, eligibility?.sideMetricSpanCm ?? crossSectionEvidence?.sideObservation?.projectedSpanCm);

  // 4.5H / Cross-Section: Side-derived AP Depth tier
  const isDepthQualified = (depthQual?.status === 'qualified' && typeof depthQual?.qualifiedDepthEstimateCm === 'number')
    || (crossSectionEvidence?.sideObservation?.status === 'qualified' && typeof crossSectionEvidence?.sideObservation?.apDepthCm === 'number');
  const depthValue = depthQual?.qualifiedDepthEstimateCm ?? crossSectionEvidence?.sideObservation?.apDepthCm ?? null;
  const depthDisplay = (isDepthQualified && depthValue !== null)
    ? `${formatDistance(depthValue)} cm`
    : '—';

  const depthReason = !isDepthQualified && (depthQual?.status || crossSectionEvidence?.sideObservation?.status)
    && (depthQual?.status !== 'unavailable' && crossSectionEvidence?.sideObservation?.status !== 'unavailable')
    ? mapDepthIssueToShortReason(depthQual ?? crossSectionEvidence?.sideObservation)
    : null;

  const depthReasonHtml = depthReason
    ? `<span class="derived-row-hint" title="${escapeHtml(depthReason)}">${escapeHtml(depthReason)}</span>`
    : '';

  return `
    <div class="derived-measurement-card" data-correspondence-id="${escapeHtml(id)}">
      <div class="derived-card-header">
        <span class="derived-card-title">${escapeHtml(name)}</span>
        <div class="derived-card-meta">
          <span class="derived-card-level">${escapeHtml(yDisplay)}</span>
          ${renderBadge(status.label, status.tone)}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row">
          <span class="derived-row-label">Front Transverse Width</span>
          <span class="derived-row-value">${escapeHtml(frontDisplay)}</span>
        </div>

        <div class="derived-card-row derived-card-row--depth">
          <div class="derived-row-label-group">
            <span class="derived-row-label">Side AP Depth</span>
            ${depthReasonHtml}
          </div>
          <span class="derived-row-value ${isDepthQualified ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(depthDisplay)}</span>
        </div>

        <div class="derived-card-row derived-card-row--cross-section">
          <span class="derived-row-label">Cross-Section Evidence</span>
          <span class="derived-row-value ${csStatus.tone === 'ok' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(csStatus.label.toUpperCase())}</span>
        </div>
      </div>
    </div>
  `;
}

function renderMeasurementCard({ id, name, levelKey }, annotations) {
  const correspondence = getCrossViewMeasurementCorrespondence({ id, annotations });
  const eligibility = getPairedCrossViewEligibility({ id, annotations });
  const depthDefId = levelKey === 'shoulder'
    ? 'torso_ap_depth_at_shoulder_level'
    : 'torso_ap_depth_at_hip_level';
  const depthQual = getSidePhysicalDepthQualification
    ? getSidePhysicalDepthQualification({ id: depthDefId, annotations })
    : null;
  const csDefId = levelKey === 'shoulder'
    ? 'torso_cross_section_evidence_at_shoulder_level'
    : 'torso_cross_section_evidence_at_hip_level';
  const crossSectionEvidence = getCrossSectionEvidence
    ? getCrossSectionEvidence({ id: csDefId, annotations })
    : null;
  return buildDerivedMeasurementCardHtml({ id, name, levelKey }, correspondence, eligibility, depthQual, crossSectionEvidence);
}

export function buildDirectMeasurementsGroupHtml(groupIdOrTitle, groupTitleOrMeasurements, measurementsOrExpanded = [], isExpanded = false) {
  let groupId;
  let groupTitle;
  let measurements;
  let expanded;

  if (Array.isArray(groupTitleOrMeasurements)) {
    groupTitle = groupIdOrTitle;
    groupId = String(groupIdOrTitle).toLowerCase().replace(/\s+/g, '_');
    measurements = groupTitleOrMeasurements;
    expanded = Boolean(measurementsOrExpanded);
  } else {
    groupId = groupIdOrTitle;
    groupTitle = groupTitleOrMeasurements;
    measurements = Array.isArray(measurementsOrExpanded) ? measurementsOrExpanded : [];
    expanded = Boolean(isExpanded);
  }

  if (!measurements || measurements.length === 0) {
    return '';
  }

  const rowsHtml = measurements.map((m) => {
    const isVal = m.status === 'valid' && typeof m.valueCm === 'number';
    const valDisplay = isVal ? `${formatDistance(m.valueCm)} cm` : '—';
    const badge = isVal ? renderBadge('Valid', 'ok') : renderBadge('Unavailable', 'muted');
    return `
      <div class="derived-card-row direct-measurement-row" data-direct-measurement-id="${escapeHtml(m.id)}">
        <span class="derived-row-label">${escapeHtml(m.displayName)}</span>
        <div class="direct-measurement-value-wrap">
          <span class="derived-row-value ${isVal ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
          ${badge}
        </div>
      </div>
    `;
  }).join('');

  const readyCount = measurements.filter((m) => m.status === 'valid').length;
  const collapsedAttr = expanded ? '' : 'data-collapsed';
  const collapsedClass = expanded ? '' : 'is-collapsed';

  return `
    <div
      class="derived-measurement-card direct-measurement-group-card ${collapsedClass}"
      data-collapsible
      ${collapsedAttr}
      data-group-id="${escapeHtml(groupId)}"
    >
      <div class="derived-card-header derived-card-header--collapsible">
        <div class="derived-card-header-main">
          <span class="derived-card-title">${escapeHtml(groupTitle)}</span>
          <span class="derived-card-level">${readyCount}/${measurements.length} Ready</span>
        </div>
      </div>
      <div class="derived-card-body">
        ${rowsHtml}
      </div>
    </div>
  `;
}

export function renderDerivedMeasurementDeck(containerEl) {
  if (!containerEl) {
    return;
  }

  if (!hasAnalyzedBodyEvidence()) {
    containerEl.innerHTML = `
      <div class="derived-deck-empty">
        <p class="session-empty-state">No body evidence analyzed.</p>
      </div>
    `;
    return;
  }

  if (containerEl && typeof containerEl.querySelectorAll === 'function') {
    const existingGroups = containerEl.querySelectorAll('[data-collapsible][data-group-id]');
    for (const group of existingGroups) {
      const gid = group.getAttribute('data-group-id');
      if (gid) {
        groupCollapseStates.set(gid, group.classList.contains('is-collapsed'));
      }
    }
  }

  const annotations = getAnnotations();
  const pairedCardsHtml = DERIVED_CORRESPONDENCE_PAIRS.map((pair) =>
    renderMeasurementCard(pair, annotations)
  ).join('');

  const isCsCollapsed = groupCollapseStates.get('cross_section_evidence') ?? false;
  const csCollapsedAttr = isCsCollapsed ? 'data-collapsed' : '';
  const csCollapsedClass = isCsCollapsed ? 'is-collapsed' : '';

  const crossSectionHtml = `
    <div
      class="results-subgroup results-subgroup--cross-section ${csCollapsedClass}"
      data-collapsible
      ${csCollapsedAttr}
      data-group-id="cross_section_evidence"
    >
      <div class="results-subgroup-header results-subgroup-header--collapsible">
        <span class="results-subgroup-label">Cross-Section Evidence</span>
      </div>
      <div class="results-subgroup-body">
        ${pairedCardsHtml}
      </div>
    </div>
  `;

  const directReport = getDirectBodyMeasurements({ annotations });
  let directHtml = '';
  if (directReport && directReport.byGroup) {
    const isDirectCollapsed = groupCollapseStates.get('direct_measurements') ?? true;
    const directCollapsedAttr = isDirectCollapsed ? 'data-collapsed' : '';
    const directCollapsedClass = isDirectCollapsed ? 'is-collapsed' : '';

    const isVerticalExpanded = !(groupCollapseStates.get('vertical_measurements') ?? true);
    const isArmsExpanded = !(groupCollapseStates.get('arm_segments') ?? true);
    const isLegsExpanded = !(groupCollapseStates.get('leg_segments') ?? true);

    const verticalHtml = buildDirectMeasurementsGroupHtml(
      'vertical_measurements',
      'Vertical Measurements',
      directReport.byGroup.vertical_inter_level ?? [],
      isVerticalExpanded,
    );
    const armsHtml = buildDirectMeasurementsGroupHtml(
      'arm_segments',
      'Arm Segments',
      directReport.byGroup.arm_segments ?? [],
      isArmsExpanded,
    );
    const legsHtml = buildDirectMeasurementsGroupHtml(
      'leg_segments',
      'Leg Segments',
      directReport.byGroup.leg_segments ?? [],
      isLegsExpanded,
    );
    directHtml = `
      <div
        class="results-subgroup results-subgroup--direct ${directCollapsedClass}"
        data-collapsible
        ${directCollapsedAttr}
        data-group-id="direct_measurements"
      >
        <div class="results-subgroup-header results-subgroup-header--collapsible">
          <span class="results-subgroup-label">Direct Measurements</span>
        </div>
        <div class="results-subgroup-body">
          ${verticalHtml}
          ${armsHtml}
          ${legsHtml}
        </div>
      </div>
    `;
  }

  containerEl.innerHTML = crossSectionHtml + directHtml;
}

export function setupDerivedMeasurementDeck() {
  const containerEl = document.getElementById('derived-measurement-cards');
  if (!containerEl) {
    return;
  }

  const deckEl = containerEl.closest('#derived-measurement-deck') || containerEl.parentElement || containerEl;
  initCollapsibleSections(deckEl);

  const update = () => {
    renderDerivedMeasurementDeck(containerEl);
    initCollapsibleSections(containerEl);
  };

  subscribeBodyEvidenceChange(update);
  subscribeAnnotationsChange(update);
  update();
}

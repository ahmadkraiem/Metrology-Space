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
  getModeledCrossSectionPerimeter,
  getModeledHipSeatCircumference,
  getDirectBodyMeasurements,
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import { resolveMeasurementVisualizationProvenance } from '../features/measurementVisualizationProvenance.js';
import {
  setMeasurementHighlight,
  clearMeasurementHighlight,
  getMeasurementHighlight,
} from './measurementHighlightOverlay2d.js';
import {
  setWorkspace,
  WORKSPACE_SPLIT,
} from './workspaceLayout.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';
import { initCollapsibleSections } from './collapsibleSections.js';

const DERIVED_CORRESPONDENCE_PAIRS = Object.freeze([
  {
    id: 'torso_shoulder_cross_view_correspondence',
    name: 'Shoulder Level',
    levelKey: 'shoulder',
    crossSectionDefId: 'torso_cross_section_evidence_at_shoulder_level',
  },
  {
    id: 'torso_hip_cross_view_correspondence',
    name: 'Hip Level',
    levelKey: 'hip',
    crossSectionDefId: 'torso_cross_section_evidence_at_hip_level',
  },
]);

const groupCollapseStates = new Map([
  ['cross_section_evidence', false],
  ['modeled_perimeter_estimates', false],
  ['direct_measurements', true],
  ['vertical_measurements', true],
  ['arm_segments', true],
  ['leg_segments', true],
]);

/** @type {string|null} */
let selectedMeasurementId = null;

// Automatically clear selection and highlight on package change or clear
subscribeBodyEvidenceChange(() => {
  clearSelectedMeasurement();
});

export function getSelectedMeasurementId() {
  return selectedMeasurementId;
}

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

export function buildDerivedMeasurementCardHtml({ id, name, crossSectionDefId }, correspondence, eligibility, depthQual = null, crossSectionEvidence = null) {
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

  const measurementId = crossSectionDefId || id;
  const isSelected = selectedMeasurementId === measurementId || selectedMeasurementId === id;

  return `
    <div
      class="derived-measurement-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="${escapeHtml(measurementId)}"
      data-correspondence-id="${escapeHtml(id)}"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
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

function renderMeasurementCard({ id, name, levelKey, crossSectionDefId }, annotations) {
  const correspondence = getCrossViewMeasurementCorrespondence({ id, annotations });
  const eligibility = getPairedCrossViewEligibility({ id, annotations });
  const depthDefId = levelKey === 'shoulder'
    ? 'torso_ap_depth_at_shoulder_level'
    : 'torso_ap_depth_at_hip_level';
  const depthQual = getSidePhysicalDepthQualification
    ? getSidePhysicalDepthQualification({ id: depthDefId, annotations })
    : null;
  const csDefId = crossSectionDefId || (levelKey === 'shoulder'
    ? 'torso_cross_section_evidence_at_shoulder_level'
    : 'torso_cross_section_evidence_at_hip_level');
  const crossSectionEvidence = getCrossSectionEvidence
    ? getCrossSectionEvidence({ id: csDefId, annotations })
    : null;
  return buildDerivedMeasurementCardHtml({ id, name, levelKey, crossSectionDefId: csDefId }, correspondence, eligibility, depthQual, crossSectionEvidence);
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
    const isSelected = selectedMeasurementId === m.id;
    return `
      <div
        class="derived-card-row direct-measurement-row ${isSelected ? 'is-selected' : ''}"
        data-measurement-id="${escapeHtml(m.id)}"
        data-direct-measurement-id="${escapeHtml(m.id)}"
        role="button"
        tabindex="0"
        aria-selected="${isSelected ? 'true' : 'false'}"
      >
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

export function buildModeledPerimeterCardHtml(modeledPerimeter) {
  if (!modeledPerimeter) {
    return '';
  }

  const isModeled = modeledPerimeter.status === 'modeled' && typeof modeledPerimeter.valueCm === 'number';
  const valDisplay = isModeled ? `${formatDistance(modeledPerimeter.valueCm)} cm` : '—';

  let statusBadge;
  if (modeledPerimeter.status === 'modeled') {
    statusBadge = renderBadge('Modeled', 'ok');
  } else if (modeledPerimeter.status === 'blocked') {
    statusBadge = renderBadge('Blocked', 'warn');
  } else if (modeledPerimeter.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = modeledPerimeter.levelYcm;
  const yDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `Y ${formatDistance(yCm)} cm`
    : 'Y —';

  const isSelected = selectedMeasurementId === 'torso_modeled_perimeter_at_hip_landmark_level';

  return `
    <div
      class="derived-measurement-card modeled-perimeter-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="torso_modeled_perimeter_at_hip_landmark_level"
      data-modeled-perimeter-id="${escapeHtml(modeledPerimeter.id || '')}"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">Hip Landmark Perimeter Estimate</span>
        <div class="derived-card-meta">
          <span class="derived-card-level">${escapeHtml(yDisplay)}</span>
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row modeled-perimeter-primary-row">
          <span class="derived-row-label modeled-perimeter-label">Perimeter Estimate</span>
          <span class="derived-row-value modeled-perimeter-value ${isModeled ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>

        <div class="derived-card-row modeled-perimeter-meta-row">
          <span class="derived-row-label modeled-perimeter-label">Model Implementation</span>
          <span class="derived-row-value modeled-perimeter-value derived-row-value--muted">Ellipse (Ramanujan II)</span>
        </div>

        <div class="derived-card-row modeled-perimeter-meta-row">
          <span class="derived-row-label modeled-perimeter-label">Reference Level</span>
          <span class="derived-row-value modeled-perimeter-value derived-row-value--muted">Hip Landmark Level</span>
        </div>

        <div class="modeled-perimeter-notes">
          <p class="modeled-perimeter-note">Ellipse-modeled perimeter from qualified Front width + Side AP depth.</p>
          <p class="modeled-perimeter-qualification">Not anthropometric Hip Circumference.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildModeledHipSeatCircumferenceCardHtml(seatCircumference) {
  if (!seatCircumference) {
    return '';
  }

  const isModeled = seatCircumference.status === 'modeled' && typeof seatCircumference.valueCm === 'number';
  const valDisplay = isModeled ? `${formatDistance(seatCircumference.valueCm)} cm` : '—';

  let statusBadge;
  if (seatCircumference.status === 'modeled') {
    statusBadge = renderBadge('Modeled', 'ok');
  } else if (seatCircumference.status === 'blocked') {
    statusBadge = renderBadge('Blocked', 'warn');
  } else if (seatCircumference.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = seatCircumference.levelYcm
    ?? seatCircumference.provenance?.selectedYcm;
  const yDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `Y ${formatDistance(yCm)} cm`
    : 'Y —';
  const seatPlaneYDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `${formatDistance(yCm)} cm`
    : '—';

  const frontWidth = seatCircumference.model?.transverseWidthCm
    ?? seatCircumference.provenance?.frontTransverseWidthCm
    ?? seatCircumference.provenance?.frontSlice?.widthCm;
  const sideDepth = seatCircumference.model?.apDepthCm
    ?? seatCircumference.provenance?.sideQualifiedApDepthCm
    ?? seatCircumference.provenance?.sideSlice?.depthCm;

  const frontDisplay = typeof frontWidth === 'number' ? `${formatDistance(frontWidth)} cm` : '—';
  const sideDisplay = typeof sideDepth === 'number' ? `${formatDistance(sideDepth)} cm` : '—';

  const isSelected = selectedMeasurementId === 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane';

  return `
    <div
      class="derived-measurement-card modeled-perimeter-card modeled-circumference-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"
      data-modeled-circumference-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">Modeled Hip / Seat Circumference Estimate</span>
        <div class="derived-card-meta">
          <span class="derived-card-level">${escapeHtml(yDisplay)}</span>
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row modeled-perimeter-primary-row">
          <span class="derived-row-label modeled-perimeter-label">Circumference Estimate</span>
          <span class="derived-row-value modeled-perimeter-value ${isModeled ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Seat Plane Y</span>
          <span class="derived-row-value ${typeof yCm === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(seatPlaneYDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Front Width</span>
          <span class="derived-row-value ${typeof frontWidth === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(frontDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Side AP Depth</span>
          <span class="derived-row-value ${typeof sideDepth === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(sideDisplay)}</span>
        </div>

        <div class="derived-card-row modeled-perimeter-meta-row">
          <span class="derived-row-label modeled-perimeter-label">Model</span>
          <span class="derived-row-value modeled-perimeter-value derived-row-value--muted">Ellipse (Ramanujan II)</span>
        </div>

        <div class="modeled-perimeter-notes">
          <p class="modeled-perimeter-note">Evaluated at deterministic Maximum Seat Plane (${escapeHtml(yDisplay)}).</p>
          <p class="modeled-perimeter-qualification">Modeled estimate; not tape-measured ground truth.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Retrieves the raw domain measurement record for a given measurement ID.
 * @param {string} measurementId
 * @param {Array} [annotations]
 * @returns {object|null}
 */
export function getMeasurementRecordById(measurementId, annotations = getAnnotations()) {
  if (!measurementId) return null;

  if (measurementId === 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane') {
    return getModeledHipSeatCircumference({ annotations });
  }

  if (measurementId === 'torso_modeled_perimeter_at_hip_landmark_level') {
    return getModeledCrossSectionPerimeter({ id: 'torso_modeled_perimeter_at_hip_landmark_level', annotations });
  }

  if (measurementId === 'torso_shoulder_cross_view_correspondence' || measurementId === 'torso_cross_section_evidence_at_shoulder_level') {
    return getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_shoulder_level', annotations });
  }

  if (measurementId === 'torso_hip_cross_view_correspondence' || measurementId === 'torso_cross_section_evidence_at_hip_level') {
    return getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_hip_level', annotations });
  }

  const directReport = getDirectBodyMeasurements({ annotations });
  if (directReport && Array.isArray(directReport.measurements)) {
    const directMatch = directReport.measurements.find((m) => m.id === measurementId);
    if (directMatch) return directMatch;
  }

  return null;
}

/**
 * Updates DOM cards to reflect current selectedMeasurementId.
 */
function updateSelectedCardDom() {
  if (typeof document === 'undefined') return;
  const containerEl = document.getElementById('derived-measurement-cards');
  if (!containerEl || typeof containerEl.querySelectorAll !== 'function') return;

  const selectables = containerEl.querySelectorAll('[data-measurement-id]');
  for (const el of selectables) {
    const id = el.getAttribute('data-measurement-id');
    const isSelected = selectedMeasurementId !== null && id === selectedMeasurementId;
    el.classList.toggle('is-selected', isSelected);
    el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  }
}

/**
 * Selects a measurement by ID, resolving visualization provenance, activating 2D highlight,
 * and focusing the 2D workspace. If already selected, toggles selection off.
 *
 * @param {string|null} measurementId
 */
export function selectMeasurement(measurementId) {
  console.log('[RVEacity Results Debug] selectMeasurement entered', { measurementId });

  if (!measurementId) {
    clearSelectedMeasurement();
    return;
  }

  // Toggle off if currently selected
  if (selectedMeasurementId === measurementId) {
    clearSelectedMeasurement();
    return;
  }

  const annotations = getAnnotations();
  const measurementRecord = getMeasurementRecordById(measurementId, annotations);

  console.log('[RVEacity Results Debug] record resolution', {
    measurementId,
    recordFound: Boolean(measurementRecord),
    recordStatus: measurementRecord?.status ?? null,
    recordDefinitionId: measurementRecord?.id ?? measurementRecord?.definitionId ?? null,
  });

  if (!measurementRecord) {
    clearSelectedMeasurement();
    return;
  }

  const context = {
    crossSectionEvidenceReport: getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_hip_level', annotations }),
    getCrossSectionEvidence: (level) => getCrossSectionEvidence({
      id: level === 'shoulder' ? 'torso_cross_section_evidence_at_shoulder_level' : 'torso_cross_section_evidence_at_hip_level',
      annotations,
    }),
    directMeasurementsReport: getDirectBodyMeasurements({ annotations }),
  };
  const visualization = resolveMeasurementVisualizationProvenance(measurementRecord, context);

  console.log('[RVEacity Results Debug] visualization resolution', {
    visualizationStatus: visualization?.status ?? null,
    visualizationType: visualization?.visualizationType ?? null,
    targetViews: visualization?.targetViews ?? null,
    blockers: visualization?.blockers ?? [],
  });

  if (visualization.status !== 'ready') {
    clearSelectedMeasurement();
    return;
  }

  selectedMeasurementId = measurementId;

  console.log('[RVEacity Results Debug] highlight set start');
  setMeasurementHighlight(visualization);
  console.log('[RVEacity Results Debug] highlight set complete');

  console.log('[RVEacity Results Debug] workspace switch requested');
  setWorkspace(WORKSPACE_SPLIT);

  updateSelectedCardDom();
  const selectedElements = typeof document !== 'undefined'
    ? (document.getElementById('derived-measurement-cards')?.querySelectorAll('.is-selected') ?? [])
    : [];
  console.log('[RVEacity Results Debug] selected DOM update', {
    selectedMeasurementId,
    selectedElementCount: selectedElements.length,
  });
}

/**
 * Clears the active measurement selection and 2D highlight.
 */
export function clearSelectedMeasurement() {
  selectedMeasurementId = null;
  clearMeasurementHighlight();
  updateSelectedCardDom();
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

  const modeledSeatCircumferenceResult = getModeledHipSeatCircumference({
    annotations,
  });

  let modeledPerimeterHtml = '';
  if (modeledSeatCircumferenceResult) {
    const isPerimeterCollapsed = groupCollapseStates.get('modeled_perimeter_estimates') ?? false;
    const perimeterCollapsedAttr = isPerimeterCollapsed ? 'data-collapsed' : '';
    const perimeterCollapsedClass = isPerimeterCollapsed ? 'is-collapsed' : '';
    const seatCardHtml = buildModeledHipSeatCircumferenceCardHtml(modeledSeatCircumferenceResult);

    modeledPerimeterHtml = `
    <div
      class="results-subgroup results-subgroup--modeled-perimeter ${perimeterCollapsedClass}"
      data-collapsible
      ${perimeterCollapsedAttr}
      data-group-id="modeled_perimeter_estimates"
    >
      <div class="results-subgroup-header results-subgroup-header--collapsible">
        <span class="results-subgroup-label">Modeled Perimeter Estimates</span>
      </div>
      <div class="results-subgroup-body">
        ${seatCardHtml}
      </div>
    </div>
  `;
  }

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

  containerEl.innerHTML = crossSectionHtml + modeledPerimeterHtml + directHtml;
}

export function setupDerivedMeasurementDeck() {
  const containerEl = document.getElementById('derived-measurement-cards');
  const containerFound = Boolean(containerEl);

  console.log('[RVEacity Results Debug] setupDerivedMeasurementDeck initialized', {
    containerFound,
    clickListenerAttached: containerFound,
    keydownListenerAttached: containerFound,
  });

  if (!containerEl) {
    return;
  }

  const deckEl = containerEl.closest('#derived-measurement-deck') || containerEl.parentElement || containerEl;
  initCollapsibleSections(deckEl);

  const update = () => {
    renderDerivedMeasurementDeck(containerEl);
    initCollapsibleSections(containerEl);
  };

  containerEl.addEventListener('click', (event) => {
    const targetTag = event.target ? (event.target.tagName || '').toLowerCase() : null;
    const targetClass = event.target ? (event.target.className || '') : null;
    const measurementTarget = event.target ? event.target.closest('[data-measurement-id]') : null;
    const measurementElementFound = Boolean(measurementTarget);
    const measurementId = measurementTarget ? measurementTarget.getAttribute('data-measurement-id') : null;

    console.log('[RVEacity Results Debug] click received', {
      targetTag,
      targetClass,
      measurementElementFound,
      measurementId,
    });

    // If click was on a collapsible toggle header, let collapsibleSections handle it
    if (event.target.closest('.derived-card-header--collapsible') || event.target.closest('.results-subgroup-header--collapsible')) {
      return;
    }

    if (!measurementTarget) {
      return;
    }

    if (measurementId) {
      selectMeasurement(measurementId);
    }
  });

  containerEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    if (event.target.closest('.derived-card-header--collapsible') || event.target.closest('.results-subgroup-header--collapsible')) {
      return;
    }

    const targetEl = event.target.closest('[data-measurement-id]');
    if (!targetEl) {
      return;
    }

    event.preventDefault();
    const measurementId = targetEl.getAttribute('data-measurement-id');
    if (measurementId) {
      selectMeasurement(measurementId);
    }
  });

  subscribeBodyEvidenceChange(() => {
    clearSelectedMeasurement();
    update();
  });
  subscribeAnnotationsChange(update);
  update();
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      const targetTag = target ? (target.tagName || '').toLowerCase() : null;
      const targetId = target ? (target.id || '') : null;
      const targetClass = target ? (target.className || '') : null;

      const rightSidebar = typeof document !== 'undefined' ? document.getElementById('right-sidebar') : null;
      const resultsContainer = typeof document !== 'undefined' ? document.getElementById('derived-measurement-cards') : null;

      const insideRightSidebar = Boolean(target && rightSidebar && (target === rightSidebar || rightSidebar.contains(target)));
      const insideResultsContainer = Boolean(target && resultsContainer && (target === resultsContainer || resultsContainer.contains(target)));

      let hitEl = null;
      if (typeof document !== 'undefined' && typeof document.elementFromPoint === 'function' && typeof event.clientX === 'number') {
        hitEl = document.elementFromPoint(event.clientX, event.clientY);
      }
      const hitElementTag = hitEl ? (hitEl.tagName || '').toLowerCase() : null;
      const hitElementId = hitEl ? (hitEl.id || '') : null;
      const hitElementClass = hitEl ? (hitEl.className || '') : null;

      console.log('[RVEacity HitTest Debug] window capture click', {
        targetTag,
        targetId,
        targetClass,
        insideRightSidebar,
        insideResultsContainer,
        elementFromPoint: {
          tag: hitElementTag,
          id: hitElementId,
          className: hitElementClass,
        },
      });
    },
    true
  );

  window.__RVEacityResultsDebug = function getRVEacityResultsDebugSnapshot() {
    const container = document.getElementById('derived-measurement-cards');
    const els = container && typeof container.querySelectorAll === 'function'
      ? container.querySelectorAll('[data-measurement-id]')
      : [];
    const highlight = typeof getMeasurementHighlight === 'function' ? getMeasurementHighlight() : null;

    return {
      resultsContainerFound: Boolean(container),
      measurementElementCount: els.length,
      measurementIds: Array.from(els).map((el) => el.getAttribute('data-measurement-id')).filter(Boolean),
      selectedMeasurementId: selectedMeasurementId ?? null,
      activeHighlightMeasurementId: highlight?.measurementId ?? null,
    };
  };

  window.__RVEacityHitTestDebug = function getRVEacityHitTestDebugSnapshot(x, y) {
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
      return { error: 'document.elementFromPoint not supported' };
    }
    const el = (typeof x === 'number' && typeof y === 'number')
      ? document.elementFromPoint(x, y)
      : null;
    const rightSidebar = document.getElementById('right-sidebar');
    const resultsContainer = document.getElementById('derived-measurement-cards');

    const insideRightSidebar = Boolean(el && rightSidebar && (el === rightSidebar || rightSidebar.contains(el)));
    const insideResultsContainer = Boolean(el && resultsContainer && (el === resultsContainer || resultsContainer.contains(el)));
    const measurementTarget = el ? el.closest('[data-measurement-id]') : null;

    return {
      elementTag: el ? (el.tagName || '').toLowerCase() : null,
      elementId: el ? (el.id || '') : null,
      elementClass: el ? (el.className || '') : null,
      insideRightSidebar,
      insideResultsContainer,
      closestMeasurementId: measurementTarget ? measurementTarget.getAttribute('data-measurement-id') : null,
    };
  };
}


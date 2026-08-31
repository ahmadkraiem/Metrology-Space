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
  getFrontTransverseWidth,
  getModeledCrossSectionPerimeter,
  getModeledHipSeatCircumference,
  getModeledHipGirth,
  getModeledNaturalWaistCircumference,
  getModeledAbdominalCircumference,
  getModeledBustCircumference,
  getNaturalWaistPlaneLocalization,
  getAbdominalApexPlaneLocalization,
  getAbdominalPointPlaneLocalization,
  getBustApexPlaneLocalization,
  getBustPointPlaneLocalization,
  getButtockPointPlaneLocalization,
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
} from './measurementHighlightOverlay2d.js';
import {
  setWorkspace,
  WORKSPACE_SPLIT,
} from './workspaceLayout.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';
import { initCollapsibleSections } from './collapsibleSections.js';

export const MEASUREMENT_TYPE_RESULT_CATEGORY_IDS = Object.freeze({
  WIDTHS_SPANS: 'widths_spans',
  LENGTHS_DISTANCES: 'lengths_distances',
  CIRCUMFERENCES_GIRTHS: 'circumferences_girths',
  DEPTHS_AP: 'depths_ap',
  HEIGHTS_GROUND: 'heights_ground',
  SURFACE_ARCS: 'surface_arcs',
  ANGLES_POSTURE: 'angles_posture',
});

export const MEASUREMENT_TYPE_RESULT_CATEGORIES = Object.freeze([
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.WIDTHS_SPANS,
    label: 'Widths & Transverse Spans',
    order: 1,
    measurementIds: Object.freeze([
      'neck_transverse_width_at_neck_level',
      'torso_width_at_shoulder_level',
      'inter_acromion_transverse_breadth_projected',
      'torso_width_at_hip_level',
      'inter_hip_landmark_transverse_span',
      'bilateral_elbow_landmark_transverse_span',
      'bilateral_wrist_landmark_transverse_span',
      'bilateral_knee_landmark_transverse_span',
      'bilateral_ankle_landmark_transverse_span',
    ]),
  },
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.LENGTHS_DISTANCES,
    label: 'Lengths & Distances',
    order: 2,
    measurementIds: Object.freeze([
      'vertical_torso_length_neck_to_hip',
      'vertical_shoulder_drop_neck_to_shoulder',
      'vertical_thigh_length_hip_to_knee',
      'vertical_lower_leg_length_knee_to_ankle',
      'vertical_total_leg_length_hip_to_ankle',
      'left_upper_arm_segment_length_projected',
      'right_upper_arm_segment_length_projected',
      'left_forearm_segment_length_projected',
      'right_forearm_segment_length_projected',
      'left_direct_arm_chord_projected',
      'right_direct_arm_chord_projected',
      'left_total_arm_chain_length_projected',
      'right_total_arm_chain_length_projected',
      'left_thigh_segment_length_projected',
      'right_thigh_segment_length_projected',
      'left_lower_leg_segment_length_projected',
      'right_lower_leg_segment_length_projected',
      'left_total_leg_chain_length_projected',
      'right_total_leg_chain_length_projected',
    ]),
  },
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.CIRCUMFERENCES_GIRTHS,
    label: 'Circumferences & Girths',
    order: 3,
    measurementIds: Object.freeze([
      'torso_modeled_bust_circumference_at_bust_apex_plane',
      'torso_modeled_natural_waist_circumference_at_natural_waist_plane',
      'torso_modeled_abdominal_circumference_at_abdominal_apex_plane',
      'torso_modeled_hip_girth_at_buttock_point_plane',
      'torso_modeled_hip_seat_circumference_at_maximum_seat_plane',
    ]),
  },
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.DEPTHS_AP,
    label: 'Depths / AP Measurements',
    order: 4,
    measurementIds: Object.freeze([]),
  },
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.HEIGHTS_GROUND,
    label: 'Heights / Ground-Referenced',
    order: 5,
    measurementIds: Object.freeze([]),
  },
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.SURFACE_ARCS,
    label: 'Surface Arcs / Curved Paths',
    order: 6,
    measurementIds: Object.freeze([]),
  },
  {
    id: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.ANGLES_POSTURE,
    label: 'Angles / Posture',
    order: 7,
    measurementIds: Object.freeze([]),
  },
]);

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
  [MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.WIDTHS_SPANS, true],
  [MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.LENGTHS_DISTANCES, true],
  [MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.CIRCUMFERENCES_GIRTHS, true],
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

/**
 * Renders a single compact primary measurement row for the Results deck.
 *
 * @param {{
 *   id: string,
 *   label: string,
 *   valueText?: string|null,
 *   valueCm?: number|null,
 *   status?: string,
 *   statusBadge?: string|null,
 *   isSelected?: boolean,
 *   extraClasses?: string,
 * }} options
 * @returns {string}
 */
export function buildCompactMeasurementRowHtml({
  id,
  label,
  valueText = null,
  valueCm = null,
  status = 'valid',
  statusBadge = null,
  isSelected = false,
  extraClasses = '',
} = {}) {
  if (!id) return '';
  const isSelectedState = selectedMeasurementId === id || isSelected;
  const isNumeric = typeof valueCm === 'number' && Number.isFinite(valueCm);
  let valDisplay = valueText ?? (isNumeric ? `${formatDistance(valueCm)} cm` : '—');
  let isVal = isNumeric || (valueText !== null && valueText !== '—');

  // Status badge resolution: only show badge when it adds non-redundant information
  let badgeHtml = '';
  if (statusBadge) {
    badgeHtml = statusBadge;
  } else if (status === 'modeled') {
    badgeHtml = renderBadge('Modeled', 'ok');
  } else if (status === 'blocked') {
    isVal = false;
    valDisplay = '—';
    badgeHtml = renderBadge('Blocked', 'warn');
  } else if (status === 'ambiguous') {
    isVal = false;
    valDisplay = '—';
    badgeHtml = renderBadge('Ambiguous', 'warn');
  } else if (status === 'invalid' || status === 'disqualified') {
    isVal = false;
    valDisplay = '—';
    badgeHtml = renderBadge('Invalid', 'warn');
  } else if (status === 'unavailable' || status === 'missing') {
    isVal = false;
    valDisplay = '—';
    badgeHtml = renderBadge('Unavailable', 'muted');
  } else if (status === 'partial') {
    badgeHtml = renderBadge('Partial', 'warn');
  }

  return `
    <div
      class="compact-measurement-row direct-measurement-row derived-card-row ${isSelectedState ? 'is-selected' : ''} ${extraClasses}"
      data-measurement-id="${escapeHtml(id)}"
      role="button"
      tabindex="0"
      aria-selected="${isSelectedState ? 'true' : 'false'}"
    >
      <span class="compact-measurement-label derived-row-label">${escapeHtml(label || id)}</span>
      <div class="compact-measurement-value-wrap direct-measurement-value-wrap">
        <span class="compact-measurement-value derived-row-value ${isVal ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        ${badgeHtml}
      </div>
    </div>
  `;
}

export function buildDirectMeasurementRowHtml(m) {
  if (!m) return '';
  const isVal = m.status === 'valid' && typeof m.valueCm === 'number';
  const valDisplay = isVal ? `${formatDistance(m.valueCm)} cm` : '—';
  const badge = isVal ? renderBadge('Valid', 'ok') : renderBadge('Unavailable', 'muted');
  const isSelected = selectedMeasurementId === m.id;
  return `
    <div
      class="derived-card-row direct-measurement-row compact-measurement-row ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="${escapeHtml(m.id)}"
      data-direct-measurement-id="${escapeHtml(m.id)}"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <span class="compact-measurement-label derived-row-label">${escapeHtml(m.displayName ?? m.canonicalName ?? m.id)}</span>
      <div class="compact-measurement-value-wrap direct-measurement-value-wrap">
        <span class="compact-measurement-value derived-row-value ${isVal ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        ${badge}
      </div>
    </div>
  `;
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

  const rowsHtml = measurements.map((m) => buildDirectMeasurementRowHtml(m)).join('');

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

export function buildModeledBustCircumferenceCardHtml(bustCircumference) {
  if (!bustCircumference) {
    return '';
  }

  const isModeled = bustCircumference.status === 'modeled' && typeof bustCircumference.valueCm === 'number';
  const valDisplay = isModeled ? `${formatDistance(bustCircumference.valueCm)} cm` : '—';

  let statusBadge;
  if (bustCircumference.status === 'modeled') {
    statusBadge = renderBadge('Modeled', 'ok');
  } else if (bustCircumference.status === 'blocked') {
    statusBadge = renderBadge('Blocked', 'warn');
  } else if (bustCircumference.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = bustCircumference.levelYcm
    ?? bustCircumference.yCm
    ?? bustCircumference.provenance?.selectedYcm;
  const bustPlaneYDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `${formatDistance(yCm)} cm`
    : '—';

  const frontWidth = bustCircumference.model?.transverseWidthCm
    ?? bustCircumference.model?.frontDiameterCm
    ?? bustCircumference.provenance?.frontTransverseWidthCm;
  const sideDepth = bustCircumference.model?.apDepthCm
    ?? bustCircumference.model?.sideDiameterCm
    ?? bustCircumference.provenance?.sideQualifiedApDepthCm;

  const frontDisplay = typeof frontWidth === 'number' ? `${formatDistance(frontWidth)} cm` : '—';
  const sideDisplay = typeof sideDepth === 'number' ? `${formatDistance(sideDepth)} cm` : '—';

  const isSelected = selectedMeasurementId === 'torso_modeled_bust_circumference_at_bust_apex_plane';

  return `
    <div
      class="derived-measurement-card modeled-perimeter-card modeled-circumference-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="torso_modeled_bust_circumference_at_bust_apex_plane"
      data-modeled-circumference-id="torso_modeled_bust_circumference_at_bust_apex_plane"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">Modeled Bust Circumference</span>
        <div class="derived-card-meta">
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row modeled-perimeter-primary-row">
          <span class="derived-row-label modeled-perimeter-label">Circumference Estimate</span>
          <span class="derived-row-value modeled-perimeter-value ${isModeled ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Bust Point Plane Y</span>
          <span class="derived-row-value ${typeof yCm === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(bustPlaneYDisplay)}</span>
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
          <p class="modeled-perimeter-note">Evaluated at localized Bust Point Plane.</p>
          <p class="modeled-perimeter-qualification">Modeled estimate; not tape-measured ground truth.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildModeledNaturalWaistCircumferenceCardHtml(waistCircumference) {
  if (!waistCircumference) {
    return '';
  }

  const isModeled = waistCircumference.status === 'modeled' && typeof waistCircumference.valueCm === 'number';
  const valDisplay = isModeled ? `${formatDistance(waistCircumference.valueCm)} cm` : '—';

  let statusBadge;
  if (waistCircumference.status === 'modeled') {
    statusBadge = renderBadge('Modeled', 'ok');
  } else if (waistCircumference.status === 'blocked') {
    statusBadge = renderBadge('Blocked', 'warn');
  } else if (waistCircumference.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = waistCircumference.levelYcm
    ?? waistCircumference.yCm
    ?? waistCircumference.provenance?.selectedYcm;
  const waistPlaneYDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `${formatDistance(yCm)} cm`
    : '—';

  const frontWidth = waistCircumference.model?.transverseWidthCm
    ?? waistCircumference.model?.frontDiameterCm
    ?? waistCircumference.provenance?.frontTransverseWidthCm;
  const sideDepth = waistCircumference.model?.apDepthCm
    ?? waistCircumference.model?.sideDiameterCm
    ?? waistCircumference.provenance?.sideQualifiedApDepthCm;

  const frontDisplay = typeof frontWidth === 'number' ? `${formatDistance(frontWidth)} cm` : '—';
  const sideDisplay = typeof sideDepth === 'number' ? `${formatDistance(sideDepth)} cm` : '—';

  const isSelected = selectedMeasurementId === 'torso_modeled_natural_waist_circumference_at_natural_waist_plane';

  return `
    <div
      class="derived-measurement-card modeled-perimeter-card modeled-circumference-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="torso_modeled_natural_waist_circumference_at_natural_waist_plane"
      data-modeled-circumference-id="torso_modeled_natural_waist_circumference_at_natural_waist_plane"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">Modeled Natural Waist Circumference</span>
        <div class="derived-card-meta">
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row modeled-perimeter-primary-row">
          <span class="derived-row-label modeled-perimeter-label">Circumference Estimate</span>
          <span class="derived-row-value modeled-perimeter-value ${isModeled ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Waist Plane Y</span>
          <span class="derived-row-value ${typeof yCm === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(waistPlaneYDisplay)}</span>
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
          <p class="modeled-perimeter-note">Evaluated at localized Natural Waist Plane.</p>
          <p class="modeled-perimeter-qualification">Modeled estimate; not tape-measured ground truth.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildModeledAbdominalCircumferenceCardHtml(abdominalCircumference) {
  if (!abdominalCircumference) {
    return '';
  }

  const isModeled = abdominalCircumference.status === 'modeled' && typeof abdominalCircumference.valueCm === 'number';
  const valDisplay = isModeled ? `${formatDistance(abdominalCircumference.valueCm)} cm` : '—';

  let statusBadge;
  if (abdominalCircumference.status === 'modeled') {
    statusBadge = renderBadge('Modeled', 'ok');
  } else if (abdominalCircumference.status === 'blocked') {
    statusBadge = renderBadge('Blocked', 'warn');
  } else if (abdominalCircumference.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = abdominalCircumference.levelYcm
    ?? abdominalCircumference.yCm
    ?? abdominalCircumference.provenance?.selectedYcm;
  const apexPlaneYDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `${formatDistance(yCm)} cm`
    : '—';

  const frontWidth = abdominalCircumference.model?.transverseWidthCm
    ?? abdominalCircumference.model?.frontDiameterCm
    ?? abdominalCircumference.provenance?.frontTransverseWidthCm;
  const sideDepth = abdominalCircumference.model?.apDepthCm
    ?? abdominalCircumference.model?.sideDiameterCm
    ?? abdominalCircumference.provenance?.sideQualifiedApDepthCm;

  const frontDisplay = typeof frontWidth === 'number' ? `${formatDistance(frontWidth)} cm` : '—';
  const sideDisplay = typeof sideDepth === 'number' ? `${formatDistance(sideDepth)} cm` : '—';

  const isSelected = selectedMeasurementId === 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane';

  return `
    <div
      class="derived-measurement-card modeled-perimeter-card modeled-circumference-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="torso_modeled_abdominal_circumference_at_abdominal_apex_plane"
      data-modeled-circumference-id="torso_modeled_abdominal_circumference_at_abdominal_apex_plane"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">Modeled Abdominal Circumference</span>
        <div class="derived-card-meta">
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row modeled-perimeter-primary-row">
          <span class="derived-row-label modeled-perimeter-label">Circumference Estimate</span>
          <span class="derived-row-value modeled-perimeter-value ${isModeled ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Abdominal Point Plane Y</span>
          <span class="derived-row-value ${typeof yCm === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(apexPlaneYDisplay)}</span>
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
          <p class="modeled-perimeter-note">Evaluated at localized Abdominal Point Plane.</p>
          <p class="modeled-perimeter-qualification">Modeled estimate; not tape-measured ground truth.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildModeledHipGirthCardHtml(hipGirth) {
  if (!hipGirth) {
    return '';
  }

  const isModeled = hipGirth.status === 'modeled' && typeof hipGirth.valueCm === 'number';
  const valDisplay = isModeled ? `${formatDistance(hipGirth.valueCm)} cm` : '—';

  let statusBadge;
  if (hipGirth.status === 'modeled') {
    statusBadge = renderBadge('Modeled', 'ok');
  } else if (hipGirth.status === 'blocked') {
    statusBadge = renderBadge('Blocked', 'warn');
  } else if (hipGirth.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = hipGirth.levelYcm
    ?? hipGirth.yCm
    ?? hipGirth.provenance?.selectedYcm;
  const hipPlaneYDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `${formatDistance(yCm)} cm`
    : '—';

  const frontWidth = hipGirth.model?.transverseWidthCm
    ?? hipGirth.model?.frontDiameterCm
    ?? hipGirth.provenance?.frontTransverseWidthCm;
  const sideDepth = hipGirth.model?.apDepthCm
    ?? hipGirth.model?.sideDiameterCm
    ?? hipGirth.provenance?.sideQualifiedApDepthCm;

  const frontDisplay = typeof frontWidth === 'number' ? `${formatDistance(frontWidth)} cm` : '—';
  const sideDisplay = typeof sideDepth === 'number' ? `${formatDistance(sideDepth)} cm` : '—';

  const isSelected = selectedMeasurementId === 'torso_modeled_hip_girth_at_buttock_point_plane';

  return `
    <div
      class="derived-measurement-card modeled-perimeter-card modeled-circumference-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="torso_modeled_hip_girth_at_buttock_point_plane"
      data-modeled-circumference-id="torso_modeled_hip_girth_at_buttock_point_plane"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">Modeled Hip Girth</span>
        <div class="derived-card-meta">
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row modeled-perimeter-primary-row">
          <span class="derived-row-label modeled-perimeter-label">Circumference Estimate</span>
          <span class="derived-row-value modeled-perimeter-value ${isModeled ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>

        <div class="derived-card-row">
          <span class="derived-row-label">Hip Girth Plane Y</span>
          <span class="derived-row-value ${typeof yCm === 'number' ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(hipPlaneYDisplay)}</span>
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
          <p class="modeled-perimeter-note">Evaluated at localized Buttock Point Plane.</p>
          <p class="modeled-perimeter-qualification">Modeled estimate; not tape-measured ground truth.</p>
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
        <span class="derived-card-title">Modeled Maximum Seat Circumference</span>
        <div class="derived-card-meta">
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
          <p class="modeled-perimeter-note">Evaluated at deterministic Maximum Seat Plane (${escapeHtml(seatPlaneYDisplay)}).</p>
          <p class="modeled-perimeter-qualification">Modeled estimate; not tape-measured ground truth.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildFrontTransverseWidthCardHtml(measurement) {
  if (!measurement) {
    return '';
  }

  const isVal = measurement.status === 'valid' && typeof measurement.valueCm === 'number';
  const valDisplay = isVal ? `${formatDistance(measurement.valueCm)} cm` : '—';

  let statusBadge;
  if (measurement.status === 'valid') {
    statusBadge = renderBadge('Valid', 'ok');
  } else if (measurement.status === 'ambiguous') {
    statusBadge = renderBadge('Ambiguous', 'warn');
  } else if (measurement.status === 'invalid') {
    statusBadge = renderBadge('Invalid', 'warn');
  } else {
    statusBadge = renderBadge('Unavailable', 'muted');
  }

  const yCm = measurement.provenance?.levelYcm;
  const yDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `Y ${formatDistance(yCm)} cm`
    : 'Y —';

  const isSelected = selectedMeasurementId === measurement.id || (measurement.id === 'neck_transverse_width_at_neck_level' && selectedMeasurementId === 'neck_transverse_width_at_neck_level');

  let title = measurement.name ?? 'Front Transverse Width';
  if (measurement.id === 'neck_transverse_width_at_neck_level') {
    title = 'Neck Transverse Width';
  } else if (measurement.id === 'torso_width_at_shoulder_level') {
    title = 'Torso Transverse Width at Shoulder Level';
  } else if (measurement.id === 'torso_width_at_hip_level') {
    title = 'Torso Transverse Width at Hip Level';
  }

  const sourceLevel = measurement.provenance?.sourceLevel;
  const levelLabel = sourceLevel
    ? `${sourceLevel.charAt(0).toUpperCase() + sourceLevel.slice(1)} Level (${escapeHtml(yDisplay)})`
    : escapeHtml(yDisplay);

  return `
    <div
      class="derived-measurement-card front-transverse-card ${isSelected ? 'is-selected' : ''}"
      data-measurement-id="${escapeHtml(measurement.id || 'neck_transverse_width_at_neck_level')}"
      role="button"
      tabindex="0"
      aria-selected="${isSelected ? 'true' : 'false'}"
    >
      <div class="derived-card-header">
        <span class="derived-card-title">${escapeHtml(title)}</span>
        <div class="derived-card-meta">
          ${statusBadge}
        </div>
      </div>

      <div class="derived-card-body">
        <div class="derived-card-row">
          <span class="derived-row-label">Front Transverse Width</span>
          <span class="derived-row-value ${isVal ? 'derived-row-value--qualified' : 'derived-row-value--muted'}">${escapeHtml(valDisplay)}</span>
        </div>
        <div class="derived-card-row derived-card-row--meta front-transverse-meta-row">
          <span class="derived-row-label front-transverse-label">Reference Level</span>
          <span class="derived-row-value front-transverse-value derived-row-value--muted">${levelLabel}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Declarative record resolver registry for measurement records by ID and alias.
 */
const MEASUREMENT_RECORD_RESOLVERS = new Map([
  // Front Transverse Widths
  ['neck_transverse_width_at_neck_level', (annotations) => getFrontTransverseWidth({ id: 'neck_transverse_width_at_neck_level', annotations })],
  ['neck_width_at_neck_level', (annotations) => getFrontTransverseWidth({ id: 'neck_transverse_width_at_neck_level', annotations })],
  ['torso_width_at_neck_level', (annotations) => getFrontTransverseWidth({ id: 'neck_transverse_width_at_neck_level', annotations })],
  ['torso_width_at_shoulder_level', (annotations) => getFrontTransverseWidth({ id: 'torso_width_at_shoulder_level', annotations })],
  ['torso_width_at_hip_level', (annotations) => getFrontTransverseWidth({ id: 'torso_width_at_hip_level', annotations })],
  // Modeled Bust Circumference
  ['torso_modeled_bust_circumference_at_bust_apex_plane', (annotations) => getModeledBustCircumference({ annotations })],
  ['modeled_bust_circumference', (annotations) => getModeledBustCircumference({ annotations })],
  // Bust Point / Apex Plane Localization
  ['bust_point_plane_localization', (annotations) => getBustPointPlaneLocalization({ annotations }) ?? getBustApexPlaneLocalization({ annotations })],
  ['torso_bust_point_plane_localization', (annotations) => getBustPointPlaneLocalization({ annotations }) ?? getBustApexPlaneLocalization({ annotations })],
  ['bust_apex_plane_localization', (annotations) => getBustPointPlaneLocalization({ annotations }) ?? getBustApexPlaneLocalization({ annotations })],
  ['torso_bust_apex_plane_localization', (annotations) => getBustPointPlaneLocalization({ annotations }) ?? getBustApexPlaneLocalization({ annotations })],
  // Modeled Natural Waist Circumference
  ['torso_modeled_natural_waist_circumference_at_natural_waist_plane', (annotations) => getModeledNaturalWaistCircumference({ annotations })],
  ['modeled_natural_waist_circumference', (annotations) => getModeledNaturalWaistCircumference({ annotations })],
  // Natural Waist Plane Localization
  ['natural_waist_plane_localization', (annotations) => getNaturalWaistPlaneLocalization({ annotations })],
  ['torso_natural_waist_plane_localization', (annotations) => getNaturalWaistPlaneLocalization({ annotations })],
  // Modeled Abdominal Circumference
  ['torso_modeled_abdominal_circumference_at_abdominal_apex_plane', (annotations) => getModeledAbdominalCircumference({ annotations })],
  ['modeled_abdominal_circumference', (annotations) => getModeledAbdominalCircumference({ annotations })],
  // Abdominal Point / Apex Plane Localization
  ['abdominal_point_plane_localization', (annotations) => getAbdominalPointPlaneLocalization({ annotations }) ?? getAbdominalApexPlaneLocalization({ annotations })],
  ['torso_abdominal_point_plane_localization_v1', (annotations) => getAbdominalPointPlaneLocalization({ annotations }) ?? getAbdominalApexPlaneLocalization({ annotations })],
  ['abdominal_apex_plane_localization', (annotations) => getAbdominalPointPlaneLocalization({ annotations }) ?? getAbdominalApexPlaneLocalization({ annotations })],
  ['torso_abdominal_apex_plane_localization', (annotations) => getAbdominalPointPlaneLocalization({ annotations }) ?? getAbdominalApexPlaneLocalization({ annotations })],
  // Modeled Hip Girth
  ['torso_modeled_hip_girth_at_buttock_point_plane', (annotations) => getModeledHipGirth({ annotations })],
  ['modeled_hip_girth', (annotations) => getModeledHipGirth({ annotations })],
  // Buttock Point Plane Localization
  ['buttock_point_plane_localization', (annotations) => getButtockPointPlaneLocalization({ annotations })],
  ['torso_buttock_point_plane_localization_v1', (annotations) => getButtockPointPlaneLocalization({ annotations })],
  ['hip_girth_plane_localization', (annotations) => getButtockPointPlaneLocalization({ annotations })],
  // Modeled Maximum Seat Circumference
  ['torso_modeled_hip_seat_circumference_at_maximum_seat_plane', (annotations) => getModeledHipSeatCircumference({ annotations })],
  // Landmark Level Modeled Perimeter
  ['torso_modeled_perimeter_at_hip_landmark_level', (annotations) => getModeledCrossSectionPerimeter({ id: 'torso_modeled_perimeter_at_hip_landmark_level', annotations })],
  // Cross-View Shoulder & Hip Cross-Section Evidence
  ['torso_shoulder_cross_view_correspondence', (annotations) => getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_shoulder_level', annotations })],
  ['torso_cross_section_evidence_at_shoulder_level', (annotations) => getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_shoulder_level', annotations })],
  ['torso_hip_cross_view_correspondence', (annotations) => getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_hip_level', annotations })],
  ['torso_cross_section_evidence_at_hip_level', (annotations) => getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_hip_level', annotations })],
]);

/**
 * Retrieves the raw domain measurement record for a given measurement ID.
 * @param {string} measurementId
 * @param {Array} [annotations]
 * @returns {object|null}
 */
export function getMeasurementRecordById(measurementId, annotations = getAnnotations()) {
  if (!measurementId) return null;

  const resolver = MEASUREMENT_RECORD_RESOLVERS.get(measurementId);
  if (resolver) {
    return resolver(annotations);
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

  if (visualization.status !== 'ready') {
    clearSelectedMeasurement();
    return;
  }

  selectedMeasurementId = measurementId;
  setMeasurementHighlight(visualization);
  setWorkspace(WORKSPACE_SPLIT);
  updateSelectedCardDom();
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
  const directReport = getDirectBodyMeasurements({ annotations });
  const directMap = new Map();
  if (directReport && Array.isArray(directReport.measurements)) {
    for (const m of directReport.measurements) {
      directMap.set(m.id, m);
    }
  }

  let categoriesHtml = '';

  for (const category of MEASUREMENT_TYPE_RESULT_CATEGORIES) {
    if (!category.measurementIds || category.measurementIds.length === 0) {
      continue;
    }

    const isCollapsed = groupCollapseStates.get(category.id) ?? true;
    const collapsedAttr = isCollapsed ? 'data-collapsed' : '';
    const collapsedClass = isCollapsed ? 'is-collapsed' : '';

    const rowsHtml = [];

    for (const mId of category.measurementIds) {
      // 1. Front Transverse Widths
      if (
        mId === 'neck_transverse_width_at_neck_level'
        || mId === 'torso_width_at_shoulder_level'
        || mId === 'torso_width_at_hip_level'
      ) {
        const widthResult = getFrontTransverseWidth({ id: mId, annotations });
        let title = 'Front Transverse Width';
        if (mId === 'neck_transverse_width_at_neck_level') {
          title = 'Neck Transverse Width';
        } else if (mId === 'torso_width_at_shoulder_level') {
          title = 'Torso Transverse Width at Shoulder Level';
        } else if (mId === 'torso_width_at_hip_level') {
          title = 'Torso Transverse Width at Hip Level';
        }
        const isVal = widthResult?.status === 'valid' && typeof widthResult?.valueCm === 'number';
        const valDisplay = isVal ? `${formatDistance(widthResult.valueCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: title,
          valueText: valDisplay,
          status: widthResult?.status ?? 'unavailable',
        }));
        continue;
      }

      // 2. Modeled Circumferences
      if (mId === 'torso_modeled_bust_circumference_at_bust_apex_plane') {
        const bustResult = getModeledBustCircumference({ annotations });
        const isModeled = bustResult?.status === 'modeled' && typeof bustResult?.modeledCircumferenceCm === 'number';
        const valDisplay = isModeled ? `${formatDistance(bustResult.modeledCircumferenceCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: 'Modeled Bust Circumference',
          valueText: valDisplay,
          status: bustResult?.status ?? 'unavailable',
        }));
        continue;
      }

      if (mId === 'torso_modeled_natural_waist_circumference_at_natural_waist_plane') {
        const waistResult = getModeledNaturalWaistCircumference({ annotations });
        const isModeled = waistResult?.status === 'modeled' && typeof waistResult?.modeledCircumferenceCm === 'number';
        const valDisplay = isModeled ? `${formatDistance(waistResult.modeledCircumferenceCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: 'Modeled Natural Waist Circumference',
          valueText: valDisplay,
          status: waistResult?.status ?? 'unavailable',
        }));
        continue;
      }

      if (mId === 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane') {
        const abResult = getModeledAbdominalCircumference({ annotations });
        const isModeled = abResult?.status === 'modeled' && typeof abResult?.modeledCircumferenceCm === 'number';
        const valDisplay = isModeled ? `${formatDistance(abResult.modeledCircumferenceCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: 'Modeled Abdominal Circumference',
          valueText: valDisplay,
          status: abResult?.status ?? 'unavailable',
        }));
        continue;
      }

      if (mId === 'torso_modeled_hip_girth_at_buttock_point_plane') {
        const hipGirthResult = getModeledHipGirth({ annotations });
        const isModeled = hipGirthResult?.status === 'modeled' && typeof hipGirthResult?.modeledCircumferenceCm === 'number';
        const valDisplay = isModeled ? `${formatDistance(hipGirthResult.modeledCircumferenceCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: 'Modeled Hip Girth',
          valueText: valDisplay,
          status: hipGirthResult?.status ?? 'unavailable',
        }));
        continue;
      }

      if (mId === 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane') {
        const seatResult = getModeledHipSeatCircumference({ annotations });
        const isModeled = seatResult?.status === 'modeled' && typeof seatResult?.circumferenceCm === 'number';
        const valDisplay = isModeled ? `${formatDistance(seatResult.circumferenceCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: 'Modeled Maximum Seat Circumference',
          valueText: valDisplay,
          status: seatResult?.status ?? 'unavailable',
        }));
        continue;
      }

      // 3. Direct Measurements
      const directItem = directMap.get(mId);
      if (directItem) {
        const isVal = directItem.status === 'valid' && typeof directItem.valueCm === 'number';
        const valDisplay = isVal ? `${formatDistance(directItem.valueCm)} cm` : '—';
        rowsHtml.push(buildCompactMeasurementRowHtml({
          id: mId,
          label: directItem.displayName ?? directItem.canonicalName ?? directItem.id,
          valueText: valDisplay,
          status: directItem.status,
        }));
      }
    }

    if (rowsHtml.length === 0) {
      continue;
    }

    categoriesHtml += `
      <div
        class="results-subgroup results-subgroup--${escapeHtml(category.id)} ${collapsedClass}"
        data-collapsible
        ${collapsedAttr}
        data-group-id="${escapeHtml(category.id)}"
      >
        <div class="results-subgroup-header results-subgroup-header--collapsible">
          <span class="results-subgroup-label">${escapeHtml(category.label)}</span>
          <span class="results-subgroup-count">(${rowsHtml.length})</span>
        </div>
        <div class="results-subgroup-body">
          <div class="derived-measurement-card compact-measurement-card">
            <div class="derived-card-body">
              ${rowsHtml.join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  containerEl.innerHTML = categoriesHtml;
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

  containerEl.addEventListener('click', (event) => {
    // If click was on a collapsible toggle header, let collapsibleSections handle it
    if (event.target.closest('.derived-card-header--collapsible') || event.target.closest('.results-subgroup-header--collapsible')) {
      return;
    }

    const measurementTarget = event.target.closest('[data-measurement-id]');
    if (!measurementTarget) {
      return;
    }

    const measurementId = measurementTarget.getAttribute('data-measurement-id');
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


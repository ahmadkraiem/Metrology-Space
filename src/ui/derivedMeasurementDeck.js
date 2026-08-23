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
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';

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

export function deriveMeasurementCardStatus(eligibility) {
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

function formatSpanDisplay(observation, fallbackSpanCm) {
  const span = observation?.spanCm ?? observation?.valueCm ?? fallbackSpanCm;
  if (typeof span === 'number' && Number.isFinite(span)) {
    return `${formatDistance(span)} cm`;
  }
  return 'Unavailable';
}

export function buildDerivedMeasurementCardHtml({ id, name }, correspondence, eligibility) {
  const frontObs = correspondence?.frontObservation;
  const sideObs = correspondence?.sideObservation;

  const yCm = correspondence?.provenance?.frontLevelYcm
    ?? correspondence?.provenance?.sideLevelYcm
    ?? frontObs?.level?.yCm
    ?? sideObs?.level?.yCm;

  const yDisplay = typeof yCm === 'number' && Number.isFinite(yCm)
    ? `Y ${formatDistance(yCm)} cm`
    : 'Y —';

  const status = deriveMeasurementCardStatus(eligibility);
  const frontDisplay = formatSpanDisplay(frontObs, eligibility?.frontMetricSpanCm);
  const sideDisplay = formatSpanDisplay(sideObs, eligibility?.sideMetricSpanCm);

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

        <div class="derived-card-row">
          <span class="derived-row-label">Side Profile Span</span>
          <span class="derived-row-value">${escapeHtml(sideDisplay)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderMeasurementCard({ id, name }, annotations) {
  const correspondence = getCrossViewMeasurementCorrespondence({ id, annotations });
  const eligibility = getPairedCrossViewEligibility({ id, annotations });
  return buildDerivedMeasurementCardHtml({ id, name }, correspondence, eligibility);
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

  const annotations = getAnnotations();
  const cardsHtml = DERIVED_CORRESPONDENCE_PAIRS.map((pair) =>
    renderMeasurementCard(pair, annotations)
  ).join('');

  containerEl.innerHTML = cardsHtml;
}

export function setupDerivedMeasurementDeck() {
  const containerEl = document.getElementById('derived-measurement-cards');
  if (!containerEl) {
    return;
  }

  const update = () => {
    renderDerivedMeasurementDeck(containerEl);
  };

  subscribeBodyEvidenceChange(update);
  subscribeAnnotationsChange(update);
  update();
}

/**
 * Bust Apex Plane Localization Contract v0
 *
 * Pure deterministic domain contract that localizes the horizontal canonical-Y plane
 * corresponding to the strongest stable local anterior chest/breast prominence between
 * the Shoulder anatomical level and the Natural Waist superior trough crest.
 *
 * Contract: 'bust-apex-plane-localization-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence-driven localization: searches for the local maximum of the anterior Side silhouette
 *   contour relative to a shape-relative anatomical baseline connecting the Shoulder level to
 *   the Natural Waist superior trough crest.
 * - NOT maximum total AP depth (AP depth may peak at the upper back or axilla posteriorly).
 * - NOT maximum Front transverse width (width peaks at the shoulders/deltoids).
 * - NOT maximum circumference or Ramanujan perimeter.
 * - NOT a body-height percentage or fixed anatomical offset (e.g. shoulder - 15cm or waist + 15cm).
 * - NOT a single-row raster spike (requires metric neighborhood support and smoothing).
 * - Directionally invariant: consumes side-anterior-posterior-orientation-v0 to normalize
 *   anterior prominence regardless of whether the subject faces positive-U or negative-U.
 * - Independent eligibility: does NOT require candidate.isCandidateValid (Front validity or Side
 *   AP-depth qualification) for the anterior prominence signal itself to exist.
 * - Disclaims 3D vertex reconstruction, camera extrinsics, and pointmap/normals dependencies.
 */

import { SIDE_ORIENTATION_STATUS, FACING_DIRECTION, SIDE_U_ENDPOINT } from './sideAnteriorPosteriorOrientation.js';
import { NATURAL_WAIST_PLANE_STATUS } from './naturalWaistPlaneLocalization.js';

export const BUST_APEX_PLANE_CONTRACT = 'bust-apex-plane-localization-v0';
export const BUST_APEX_PLANE_CONTRACT_VERSION = 'bust-apex-plane-localization-v0';

/**
 * Authoritative 4-state localization status taxonomy.
 * @type {Readonly<{
 *   READY: 'ready',
 *   AMBIGUOUS: 'ambiguous',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const BUST_APEX_PLANE_STATUS = Object.freeze({
  READY: 'ready',
  AMBIGUOUS: 'ambiguous',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Bust Apex plane localization.
 * @type {Readonly<Record<string, string>>}
 */
export const BUST_APEX_BLOCKER_CODES = Object.freeze({
  TORSO_SCAN_UNAVAILABLE: 'torso_scan_unavailable',
  SHOULDER_ANCHOR_UNAVAILABLE: 'shoulder_anchor_unavailable',
  NATURAL_WAIST_UNAVAILABLE: 'natural_waist_unavailable',
  NATURAL_WAIST_SELECTED_TROUGH_UNRESOLVED: 'natural_waist_selected_trough_unresolved',
  NATURAL_WAIST_SUPERIOR_CREST_UNAVAILABLE: 'natural_waist_superior_crest_unavailable',
  SIDE_ORIENTATION_UNAVAILABLE: 'side_orientation_unavailable',
  SIDE_VIEW_NOT_QUALIFIED: 'side_view_not_qualified',
  INVALID_SEARCH_WINDOW: 'invalid_search_window',
  INSUFFICIENT_SEARCH_ROWS: 'insufficient_search_rows',
  NO_ANTERIOR_PROMINENCE_DETECTED: 'no_anterior_prominence_detected',
  AMBIGUOUS_MULTIPLE_APEX_PROMINENCES: 'ambiguous_multiple_apex_prominences',
  BOUNDARY_CONFOUNDED_APEX: 'boundary_confounded_apex',
  NON_FINITE_CANDIDATE_DATA: 'non_finite_candidate_data',
});

/**
 * Default parameters for Bust Apex neighborhood analysis and peak detection.
 * Generic resolution-independent signal stabilization parameters.
 */
export const DEFAULT_BUST_APEX_OPTIONS = Object.freeze({
  /** Minimum anterior protrusion depth (cm) relative to local baseline to qualify as a bust apex. */
  minApexProminenceCm: 0.30,
  /** Total physical metric smoothing window span (cm). Default 2.0 cm corresponds to a +/- 1.0 cm radius. */
  smoothingWindowCm: 2.0,
  /** Optional override for smoothing filter radius in discrete samples. */
  smoothingRadiusRows: null,
  /** Maximum vertical distance (cm) between adjacent peaks to be pooled into the same broad bust prominence. */
  maxPeakMergeDistanceCm: 5.0,
  /** Maximum intervening saddle drop (cm) permitted between peaks for broad bust pooling. */
  maxInterPeakSaddleDropCm: 0.40,
  /** Absolute prominence difference (cm) below which competing peaks are considered ambiguous. */
  ambiguityProminenceThresholdCm: 0.40,
  /** Relative prominence ratio above which competing peaks are considered ambiguous. */
  ambiguityProminenceRatio: 0.85,
  /** Tolerance margin (cm) near window boundaries within which uninflected peaks are rejected as boundary artifacts. */
  boundaryMarginCm: 0.80,
  /** Numeric tolerance (cm) within which two peak prominences are considered tied. */
  tieBreakToleranceCm: 0.05,
});

/**
 * Applies a minimal deterministic symmetric triangular smoothing filter to raw series.
 *
 * @param {number[]} values
 * @param {number} radius
 * @returns {number[]}
 */
export function applySymmetricSmoothing(values, radius = 2) {
  const n = values.length;
  if (n === 0) return [];
  if (n <= 2 || radius <= 0) return [...values];

  const smoothed = new Array(n);

  for (let i = 0; i < n; i += 1) {
    let weightSum = 0;
    let weightedValSum = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const idx = i + offset;
      if (idx >= 0 && idx < n) {
        const weight = radius + 1 - Math.abs(offset);
        weightSum += weight;
        weightedValSum += values[idx] * weight;
      }
    }

    smoothed[i] = Number((weightedValSum / weightSum).toFixed(4));
  }

  return smoothed;
}

/**
 * Groups nearby distinct local maxima belonging to the same broad bust prominence into pooled peak regions.
 *
 * @param {Array<object>} distinctPeaks
 * @param {Array<object>} enrichedCandidates
 * @param {object} options
 * @returns {Array<object>} pooledPeaks
 */
export function poolBustPeaks(distinctPeaks, enrichedCandidates, options = {}) {
  if (!Array.isArray(distinctPeaks) || distinctPeaks.length === 0) {
    return [];
  }

  const maxPeakMergeDistanceCm = options.maxPeakMergeDistanceCm ?? DEFAULT_BUST_APEX_OPTIONS.maxPeakMergeDistanceCm;
  const maxInterPeakSaddleDropCm = options.maxInterPeakSaddleDropCm ?? DEFAULT_BUST_APEX_OPTIONS.maxInterPeakSaddleDropCm;
  const tieBreakToleranceCm = options.tieBreakToleranceCm ?? DEFAULT_BUST_APEX_OPTIONS.tieBreakToleranceCm;

  // Sort peaks spatially by candidateIndex (superior to inferior)
  const sortedPeaks = [...distinctPeaks].sort((a, b) => a.candidateIndex - b.candidateIndex);

  const groups = [];
  let currentGroup = [sortedPeaks[0]];

  for (let i = 1; i < sortedPeaks.length; i += 1) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sortedPeaks[i];

    // Peaks across discontinuous segments cannot be merged via continuous saddle logic
    const isSameSegment = prev.segmentIndex !== undefined && curr.segmentIndex !== undefined
      ? prev.segmentIndex === curr.segmentIndex
      : true;

    const verticalDistCm = Math.abs(curr.yCm - prev.yCm);

    // Compute minimum intervening prominence between prev and curr (saddle drop)
    const startIdx = Math.min(prev.candidateIndex, curr.candidateIndex);
    const endIdx = Math.max(prev.candidateIndex, curr.candidateIndex);
    let minInterveningProminence = Infinity;
    for (let k = startIdx; k <= endIdx; k += 1) {
      if (enrichedCandidates[k] && enrichedCandidates[k].prominenceCm < minInterveningProminence) {
        minInterveningProminence = enrichedCandidates[k].prominenceCm;
      }
    }

    const peakMin = Math.min(prev.prominenceCm, curr.prominenceCm);
    const saddleDropCm = Math.max(0, peakMin - minInterveningProminence);

    const isNearDistance = verticalDistCm <= maxPeakMergeDistanceCm;
    const isShallowSaddle = saddleDropCm <= maxInterPeakSaddleDropCm;

    if (isSameSegment && isNearDistance && isShallowSaddle) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Convert each group into a Pooled Peak Region
  return groups.map((members, groupIdx) => {
    // Sort by prominence descending
    const sortedByProminence = [...members].sort((a, b) => b.prominenceCm - a.prominenceCm);
    const strongestMember = sortedByProminence[0];

    let representativePeak = strongestMember;
    let isPeakAmbiguous = false;

    if (members.length > 1) {
      const top1 = sortedByProminence[0];
      const top2 = sortedByProminence[1];
      const promDiff = Math.abs(top1.prominenceCm - top2.prominenceCm);

      if (promDiff > tieBreakToleranceCm) {
        representativePeak = top1;
      } else {
        // Step 2: Tie-break using neighborhood support broadness
        const support1 = top1.broadnessScore ?? 1;
        const support2 = top2.broadnessScore ?? 1;
        if (Math.abs(support1 - support2) > 0) {
          representativePeak = support1 >= support2 ? top1 : top2;
        } else {
          // Step 3: Deterministic superior member
          representativePeak = top1;
        }
      }
    }

    const minMemberY = Math.min(...members.map((m) => m.yCm));
    const maxMemberY = Math.max(...members.map((m) => m.yCm));

    return {
      peakGroupId: `bust_apex_group_${groupIdx + 1}`,
      memberCount: members.length,
      memberPeaks: members,
      memberYValues: members.map((m) => m.yCm),
      memberCandidateIndices: members.map((m) => m.candidateIndex),
      groupMinYcm: minMemberY,
      groupMaxYcm: maxMemberY,
      strongestMember,
      representativePeak,
      isPeakAmbiguous,
      prominenceCm: strongestMember.prominenceCm,
      rawAnteriorUcm: representativePeak.rawAnteriorUcm,
      normalizedAnteriorVal: representativePeak.normalizedAnteriorVal,
      smoothedAnteriorUcm: representativePeak.smoothedAnteriorUcm,
      baselineUcm: representativePeak.baselineUcm,
      frontWidthCm: representativePeak.candidate?.front?.widthCm ?? null,
      sideProfileSpanCm: representativePeak.candidate?.side?.profileSpanCm ?? null,
      qualifiedApDepthCm: representativePeak.candidate?.side?.qualifiedApDepthCm ?? null,
      isSideDepthQualified: representativePeak.candidate?.side?.isQualified === true,
      isNeighborhoodStable: representativePeak.isNeighborhoodStable,
    };
  });
}

/**
 * Builds an empty or fallback localization result.
 */
function buildEmptyLocalizationResult({
  status = BUST_APEX_PLANE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  upperYcm = null,
  lowerYcm = null,
  upperSource = 'shoulder_anatomical_level',
  lowerSource = 'natural_waist_selected_trough_superior_crest',
  totalCandidates = 0,
  searchCandidateCount = 0,
  facingDirection = null,
  anteriorSide = null,
  supportPolicyId = 'trunk_core_support_v0',
  targetClassIds = [22, 23],
  sourceScanContract = 'torso-arbitrary-y-evidence-scan-v0',
} = {}) {
  return {
    contract: BUST_APEX_PLANE_CONTRACT,
    version: BUST_APEX_PLANE_CONTRACT_VERSION,
    status,
    yCm: null,
    rasterRow: null,
    sideRasterRow: null,
    selectionMethod: 'anterior_contour_prominence_baseline_v0',
    searchWindow: {
      shoulderYcm: upperYcm,
      naturalWaistSuperiorCrestYcm: lowerYcm,
      spanCm: (typeof upperYcm === 'number' && typeof lowerYcm === 'number')
        ? Number((upperYcm - lowerYcm).toFixed(4))
        : null,
      upperSource,
      lowerSource,
    },
    orientation: {
      status: facingDirection ? 'ready' : 'unavailable',
      facingDirection,
      anteriorSide,
    },
    selectedPeak: null,
    candidateCount: totalCandidates,
    searchCandidateCount,
    candidates: [],
    peaks: [],
    groups: [],
    frontEvidence: null,
    sideEvidence: null,
    provenance: {
      shoulderYcm: upperYcm,
      naturalWaistSuperiorCrestYcm: lowerYcm,
      totalCandidates,
      searchCandidateCount,
      supportPolicyId,
      targetClassIds: [...targetClassIds],
      sourceScanContract,
      sliceHighlightCoordinates: null,
    },
    semantics: {
      statement: 'Deterministic Bust Apex Plane localization candidate derived from anterior Side silhouette contour prominence relative to local anatomical baseline between Shoulder and Natural Waist superior crest. NOT maximum AP depth, NOT maximum Front width, NOT maximum circumference, NOT 3D reconstruction.',
      isBustApexPlaneCandidate: true,
      isModeledLocalization: true,
      isMaximumApDepth: false,
      isCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

/**
 * Evaluates pure deterministic Bust Apex Plane Localization from a completed
 * Torso Arbitrary-Y Evidence Scan report, Natural Waist report, Side Orientation report,
 * and Anatomical Levels report.
 *
 * @param {{
 *   torsoScanReport?: object|null,
 *   naturalWaistReport?: object|null,
 *   sideOrientationReport?: object|null,
 *   levelsReport?: object|null,
 *   options?: typeof DEFAULT_BUST_APEX_OPTIONS,
 * }} input
 * @returns {object} BustApexPlaneLocalizationResultV0
 */
export function evaluateBustApexPlaneLocalization({
  torsoScanReport = null,
  naturalWaistReport = null,
  sideOrientationReport = null,
  levelsReport = null,
  options = {},
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const minApexProminenceCm = typeof options?.minApexProminenceCm === 'number' && options.minApexProminenceCm >= 0
    ? options.minApexProminenceCm
    : DEFAULT_BUST_APEX_OPTIONS.minApexProminenceCm;

  const smoothingWindowCm = typeof options?.smoothingWindowCm === 'number' && options.smoothingWindowCm > 0
    ? options.smoothingWindowCm
    : DEFAULT_BUST_APEX_OPTIONS.smoothingWindowCm;

  const maxPeakMergeDistanceCm = typeof options?.maxPeakMergeDistanceCm === 'number' && options.maxPeakMergeDistanceCm > 0
    ? options.maxPeakMergeDistanceCm
    : DEFAULT_BUST_APEX_OPTIONS.maxPeakMergeDistanceCm;

  const maxInterPeakSaddleDropCm = typeof options?.maxInterPeakSaddleDropCm === 'number' && options.maxInterPeakSaddleDropCm >= 0
    ? options.maxInterPeakSaddleDropCm
    : DEFAULT_BUST_APEX_OPTIONS.maxInterPeakSaddleDropCm;

  const ambiguityProminenceThresholdCm = typeof options?.ambiguityProminenceThresholdCm === 'number'
    ? options.ambiguityProminenceThresholdCm
    : DEFAULT_BUST_APEX_OPTIONS.ambiguityProminenceThresholdCm;

  const ambiguityProminenceRatio = typeof options?.ambiguityProminenceRatio === 'number'
    ? options.ambiguityProminenceRatio
    : DEFAULT_BUST_APEX_OPTIONS.ambiguityProminenceRatio;

  const boundaryMarginCm = typeof options?.boundaryMarginCm === 'number' && options.boundaryMarginCm >= 0
    ? options.boundaryMarginCm
    : DEFAULT_BUST_APEX_OPTIONS.boundaryMarginCm;

  const tieBreakToleranceCm = typeof options?.tieBreakToleranceCm === 'number' && options.tieBreakToleranceCm >= 0
    ? options.tieBreakToleranceCm
    : DEFAULT_BUST_APEX_OPTIONS.tieBreakToleranceCm;

  // 1. Validate Input Torso Scan Report
  if (!torsoScanReport || typeof torsoScanReport !== 'object') {
    blockers.push(BUST_APEX_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push('Torso arbitrary-Y evidence scan report is missing or null.');
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const scanStatus = torsoScanReport.status;
  if (scanStatus !== 'completed' && scanStatus !== 'partial') {
    blockers.push(BUST_APEX_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push(`Torso arbitrary-Y evidence scan status is '${scanStatus}' (not completed or partial).`);
    return buildEmptyLocalizationResult({
      status: scanStatus === 'invalid' ? BUST_APEX_PLANE_STATUS.INVALID : BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      totalCandidates: torsoScanReport.candidateCount ?? 0,
    });
  }

  const rawCandidates = Array.isArray(torsoScanReport.candidates) ? torsoScanReport.candidates : [];
  if (rawCandidates.length === 0) {
    blockers.push(BUST_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push('Torso scan report contains 0 candidate rows.');
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      totalCandidates: 0,
    });
  }

  // 2. Validate Side Anterior / Posterior Orientation Report
  if (!sideOrientationReport || typeof sideOrientationReport !== 'object') {
    blockers.push(BUST_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push('Side anterior/posterior orientation report is missing.');
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  if (sideOrientationReport.status !== SIDE_ORIENTATION_STATUS.READY || !sideOrientationReport.anteriorSide) {
    const isAmbiguous = sideOrientationReport.status === SIDE_ORIENTATION_STATUS.AMBIGUOUS;
    blockers.push(BUST_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push(`Side anterior/posterior orientation is '${sideOrientationReport.status}'. Authoritative anterior Side contour cannot be identified.`);
    return buildEmptyLocalizationResult({
      status: isAmbiguous ? BUST_APEX_PLANE_STATUS.AMBIGUOUS : BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      facingDirection: sideOrientationReport.facingDirection ?? null,
      anteriorSide: sideOrientationReport.anteriorSide ?? null,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  const facingDirection = sideOrientationReport.facingDirection;
  const anteriorSide = sideOrientationReport.anteriorSide; // 'max_u' | 'min_u'
  const isPositiveU = anteriorSide === SIDE_U_ENDPOINT.MAX_U;

  // 3. Resolve Superior Boundary: Shoulder Anatomical Reference Level Y
  let upperYcm = null;
  let upperSource = 'shoulder_anatomical_level';

  const shoulderLevel = levelsReport?.levels?.find((l) => l.id === 'shoulder')
    ?? (torsoScanReport.upperBound?.sourceLevel === 'shoulder' ? torsoScanReport.upperBound : null);

  if (shoulderLevel && (shoulderLevel.status === 'ready' || typeof shoulderLevel.yCm === 'number') && typeof shoulderLevel.yCm === 'number' && Number.isFinite(shoulderLevel.yCm)) {
    upperYcm = shoulderLevel.yCm;
  } else if (typeof torsoScanReport.upperBound?.yCm === 'number' && Number.isFinite(torsoScanReport.upperBound.yCm)) {
    upperYcm = torsoScanReport.upperBound.yCm;
  }

  if (upperYcm === null) {
    blockers.push(BUST_APEX_BLOCKER_CODES.SHOULDER_ANCHOR_UNAVAILABLE);
    issues.push('Shoulder anatomical reference anchor is unavailable. Bust apex search requires a qualified upper boundary.');
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  // 4. Resolve Inferior Boundary: Natural Waist Selected Trough Superior Crest Y
  // CRITICAL GUARDRAIL: Strict requirement for selected trough superior crest; DO NOT fall back to naturalWaistReport.yCm
  let lowerYcm = null;
  let lowerSource = 'natural_waist_selected_trough_superior_crest';

  if (!naturalWaistReport || typeof naturalWaistReport !== 'object') {
    blockers.push(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE);
    issues.push('Natural Waist reference report is missing or null. Bust apex search requires an accepted Natural Waist boundary.');
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      upperYcm,
      upperSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  if (naturalWaistReport.status !== NATURAL_WAIST_PLANE_STATUS.READY) {
    blockers.push(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE);
    issues.push(`Natural Waist status is '${naturalWaistReport.status}' (not ready). Bust apex search requires a ready Natural Waist boundary.`);
    return buildEmptyLocalizationResult({
      status: naturalWaistReport.status === 'invalid' ? BUST_APEX_PLANE_STATUS.INVALID : BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      upperYcm,
      upperSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  // Identify the source-authoritative selected trough from naturalWaistReport.troughs
  const selectedWaistY = naturalWaistReport.yCm;
  const troughs = Array.isArray(naturalWaistReport.troughs) ? naturalWaistReport.troughs : [];

  let selectedTrough = null;
  if (troughs.length === 1) {
    selectedTrough = troughs[0];
  } else if (troughs.length > 1) {
    // Find the trough containing the selected representative waist plane Y
    selectedTrough = troughs.find((t) => {
      if (!t || typeof t !== 'object') return false;
      if (t.representativeValley?.yCm === selectedWaistY) return true;
      if (t.deepestMember?.yCm === selectedWaistY) return true;
      if (Array.isArray(t.memberYValues) && t.memberYValues.includes(selectedWaistY)) return true;
      return false;
    }) ?? null;
  }

  if (!selectedTrough) {
    blockers.push(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_SELECTED_TROUGH_UNRESOLVED);
    issues.push(troughs.length === 0
      ? 'Natural Waist report contains 0 troughs. Authoritative selected Natural Waist trough superior crest cannot be resolved.'
      : `Could not resolve authoritative selected Natural Waist trough corresponding to naturalWaistReport.yCm (${selectedWaistY?.toFixed(2) ?? '?'} cm) across multiple candidate troughs.`);
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      upperYcm,
      upperSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  if (typeof selectedTrough.superiorCrestYcm === 'number' && Number.isFinite(selectedTrough.superiorCrestYcm)) {
    lowerYcm = selectedTrough.superiorCrestYcm;
    lowerSource = `natural_waist_${selectedTrough.troughId || 'selected_trough'}_superior_crest`;
  } else {
    blockers.push(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_SUPERIOR_CREST_UNAVAILABLE);
    issues.push('Natural Waist superior trough crest elevation is unavailable or non-finite in the resolved selected waist trough.');
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      upperYcm,
      upperSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  // 5. Validate Search Window Ordering (upperYcm must be strictly higher elevation than lowerYcm)
  if (upperYcm <= lowerYcm) {
    blockers.push(BUST_APEX_BLOCKER_CODES.INVALID_SEARCH_WINDOW);
    issues.push(`Invalid bust search window ordering: Upper Shoulder level (${upperYcm.toFixed(2)} cm) must be strictly higher elevation than lower Natural Waist superior crest (${lowerYcm.toFixed(2)} cm).`);
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.INVALID,
      upperYcm,
      lowerYcm,
      upperSource,
      lowerSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  // 6. Filter Candidates in Search Window [lowerYcm, upperYcm]
  // Include boundary-adjacent candidates for baseline evaluation and interior candidates for peak detection
  const windowCandidates = rawCandidates.filter((c) => {
    if (!c || typeof c !== 'object' || typeof c.yCm !== 'number' || !Number.isFinite(c.yCm)) return false;
    return c.yCm <= upperYcm + 0.05 && c.yCm >= lowerYcm - 0.05;
  });

  // Sort by Y descending (superior to inferior)
  windowCandidates.sort((a, b) => b.yCm - a.yCm);

  const M = windowCandidates.length;
  if (M < 3) {
    blockers.push(BUST_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient candidate rows in bust search window (${M} rows between Y=${upperYcm.toFixed(1)} cm and Y=${lowerYcm.toFixed(1)} cm). At least 3 connected rows required.`);
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      upperYcm,
      lowerYcm,
      upperSource,
      lowerSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
      searchCandidateCount: M,
    });
  }

  // 7. Extract Normalized Anterior Contour Series A_norm(Y)
  // CRITICAL GUARDRAIL: Candidate eligibility for anterior contour depends strictly on Side evidence,
  // NOT candidate.isCandidateValid (which requires Front validity and Side AP-depth qualification).
  const extractedRows = [];

  for (let idx = 0; idx < M; idx += 1) {
    const c = windowCandidates[idx];
    const side = c.side;
    const front = c.front;

    const rawMinU = side?.minUcm ?? null;
    const rawMaxU = side?.maxUcm ?? null;

    if (rawMinU === null || rawMaxU === null || !Number.isFinite(rawMinU) || !Number.isFinite(rawMaxU)) {
      // Row lacks valid Side endpoints
      continue;
    }

    const isSideValid = side?.status === 'valid' && (side?.isSingleSupportedRun === true || side?.runCount === 1);
    if (!isSideValid) {
      // Exclude multi-run or empty Side rows from anterior contour series
      continue;
    }

    const rawAnteriorU = isPositiveU ? rawMaxU : rawMinU;
    const rawPosteriorU = isPositiveU ? rawMinU : rawMaxU;
    const normalizedAnteriorVal = isPositiveU ? rawMaxU : -rawMinU;

    const isFrontValid = front?.status === 'valid' && (front?.isSingleSupportedRun === true || front?.runCount === 1) && typeof front?.widthCm === 'number';

    extractedRows.push({
      ...c,
      windowIndex: idx,
      rawAnteriorU,
      rawPosteriorU,
      normalizedAnteriorVal,
      isFrontValid,
      isSideValid: true,
    });
  }

  const N = extractedRows.length;
  if (N < 3) {
    blockers.push(BUST_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient valid Side anterior silhouette points in bust search window (${N} valid rows).`);
    return buildEmptyLocalizationResult({
      status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
      upperYcm,
      lowerYcm,
      upperSource,
      lowerSource,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
      searchCandidateCount: N,
    });
  }

  // 8. Determine Nominal Sample Spacing & Partition into Continuous Metric Segments
  const nominalSampleSpacingCm = (typeof torsoScanReport?.provenance?.sampleSpacingCm === 'number' && torsoScanReport.provenance.sampleSpacingCm > 0)
    ? torsoScanReport.provenance.sampleSpacingCm
    : (N >= 2 ? Math.abs(extractedRows[0].yCm - extractedRows[N - 1].yCm) / (N - 1) : 0.10);
  const maxContinuousSampleSpacingCm = Math.max(0.35, nominalSampleSpacingCm * 3.0);

  const segments = [];
  let currentSegment = [];
  for (let i = 0; i < N; i += 1) {
    if (i === 0) {
      currentSegment.push(extractedRows[i]);
    } else {
      const stepDeltaY = Math.abs(extractedRows[i - 1].yCm - extractedRows[i].yCm);
      if (stepDeltaY > maxContinuousSampleSpacingCm) {
        segments.push(currentSegment);
        currentSegment = [extractedRows[i]];
      } else {
        currentSegment.push(extractedRows[i]);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // 9. Compute Metric-Scaled Smoothing Radius
  const smoothingRadiusSamples = typeof options?.smoothingRadiusRows === 'number' && options.smoothingRadiusRows >= 0
    ? options.smoothingRadiusRows
    : Math.max(1, Math.round((smoothingWindowCm / 2) / nominalSampleSpacingCm));

  // 10. Compute Shape-Relative Local Baseline B_linear(Y)
  // Linear chord baseline connects superior Shoulder boundary anchor to inferior Waist crest anchor
  const superiorAnchorNorm = extractedRows[0].normalizedAnteriorVal;
  const superiorAnchorY = extractedRows[0].yCm;
  const inferiorAnchorNorm = extractedRows[N - 1].normalizedAnteriorVal;
  const inferiorAnchorY = extractedRows[N - 1].yCm;
  const windowYSpan = superiorAnchorY - inferiorAnchorY;

  // 11. Apply Gap-Aware Smoothing & Detect Local Extrema within Continuous Segments
  const enrichedCandidates = [];
  const rawPeaks = [];

  segments.forEach((seg, segIdx) => {
    const rawVals = seg.map((r) => r.normalizedAnteriorVal);
    // Smooth strictly within the continuous segment without crossing gap boundaries
    const smoothedVals = seg.length >= 3
      ? applySymmetricSmoothing(rawVals, smoothingRadiusSamples)
      : [...rawVals];

    const segEnriched = seg.map((r, inSegIdx) => {
      const smoothedNorm = smoothedVals[inSegIdx];
      const smoothedAnteriorU = isPositiveU ? smoothedNorm : -smoothedNorm;

      // Linear baseline value at this Y
      const t = windowYSpan > 0 ? (superiorAnchorY - r.yCm) / windowYSpan : 0.5;
      const baselineNorm = superiorAnchorNorm + t * (inferiorAnchorNorm - superiorAnchorNorm);
      const baselineUcm = isPositiveU ? baselineNorm : -baselineNorm;

      // Prominence: signed displacement outward beyond the straight chord between shoulder and waist crest
      const prominenceCm = Number((smoothedNorm - baselineNorm).toFixed(4));

      return {
        ...r,
        segmentIndex: segIdx,
        indexInSegment: inSegIdx,
        indexInEnriched: enrichedCandidates.length + inSegIdx,
        smoothedAnteriorUcm: Number(smoothedAnteriorU.toFixed(4)),
        baselineUcm: Number(baselineUcm.toFixed(4)),
        prominenceCm,
      };
    });

    enrichedCandidates.push(...segEnriched);

    // Peak detection strictly interior to continuous segment (exclude segment edges 0 and length - 1)
    for (let j = 1; j < segEnriched.length - 1; j += 1) {
      const curr = segEnriched[j];
      const prev = segEnriched[j - 1];
      const next = segEnriched[j + 1];

      const isLocalMax = curr.prominenceCm >= prev.prominenceCm && curr.prominenceCm >= next.prominenceCm;

      if (isLocalMax && curr.prominenceCm >= minApexProminenceCm) {
        // Check single-row spike artifact (raw vs smoothed delta)
        const rawVsSmoothedDelta = Math.abs(curr.rawAnteriorU - curr.smoothedAnteriorUcm);
        const isSpike = rawVsSmoothedDelta >= 1.0;

        // Check distance from global search boundaries
        const distFromUpper = superiorAnchorY - curr.yCm;
        const distFromLower = curr.yCm - inferiorAnchorY;
        const isBoundaryConfounded = distFromUpper < boundaryMarginCm || distFromLower < boundaryMarginCm;

        // Vertical support: count neighboring rows strictly within the SAME continuous segment
        let supportRows = 1;
        let leftIdx = j - 1;
        while (leftIdx >= 0 && segEnriched[leftIdx].prominenceCm >= curr.prominenceCm * 0.5) {
          supportRows += 1;
          leftIdx -= 1;
        }
        let rightIdx = j + 1;
        while (rightIdx < segEnriched.length && segEnriched[rightIdx].prominenceCm >= curr.prominenceCm * 0.5) {
          supportRows += 1;
          rightIdx += 1;
        }

        const isNeighborhoodStable = !isSpike && supportRows >= 3;

        rawPeaks.push({
          candidateIndex: curr.indexInEnriched,
          candidate: curr,
          yCm: curr.yCm,
          rasterRow: curr.rasterRow,
          sideRasterRow: curr.sideRasterRow,
          rawAnteriorUcm: curr.rawAnteriorU,
          normalizedAnteriorVal: curr.normalizedAnteriorVal,
          smoothedAnteriorUcm: curr.smoothedAnteriorUcm,
          baselineUcm: curr.baselineUcm,
          prominenceCm: curr.prominenceCm,
          broadnessScore: supportRows,
          segmentIndex: segIdx,
          isSpike,
          isBoundaryConfounded,
          isNeighborhoodStable,
          isFrontValid: curr.isFrontValid,
        });
      }
    }
  });

  // 12. Filter Significant & Stable Peaks
  const stablePeaks = rawPeaks.filter((p) => p.isNeighborhoodStable && !p.isBoundaryConfounded);

  // 13. Broad Peak Pooling
  const pooledGroups = poolBustPeaks(stablePeaks, enrichedCandidates, {
    maxPeakMergeDistanceCm,
    maxInterPeakSaddleDropCm,
    tieBreakToleranceCm,
  });

  // Sort pooled groups by prominence descending
  pooledGroups.sort((a, b) => b.prominenceCm - a.prominenceCm);

  // 14. Evaluate Ambiguity and Apex Selection
  if (pooledGroups.length === 0) {
    const boundaryPeaks = rawPeaks.filter((p) => p.isBoundaryConfounded);
    if (boundaryPeaks.length > 0) {
      blockers.push(BUST_APEX_BLOCKER_CODES.BOUNDARY_CONFOUNDED_APEX);
      issues.push(`Detected anterior chest prominence candidate near search boundary (Y=${boundaryPeaks[0].yCm.toFixed(1)} cm) that is confounded with the Shoulder or Natural Waist boundary transition.`);
    } else {
      blockers.push(BUST_APEX_BLOCKER_CODES.NO_ANTERIOR_PROMINENCE_DETECTED);
      issues.push(`No stable anterior chest/breast prominence detected (threshold: ${minApexProminenceCm.toFixed(2)} cm). Anterior profile is flat or monotonic between Shoulder (Y=${upperYcm.toFixed(1)} cm) and Natural Waist (Y=${lowerYcm.toFixed(1)} cm).`);
    }

    return {
      ...buildEmptyLocalizationResult({
        status: BUST_APEX_PLANE_STATUS.UNAVAILABLE,
        upperYcm,
        lowerYcm,
        upperSource,
        lowerSource,
        facingDirection,
        anteriorSide,
        blockers,
        warnings,
        issues,
        totalCandidates: rawCandidates.length,
        searchCandidateCount: N,
        sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      }),
      candidates: enrichedCandidates,
      peaks: rawPeaks,
      groups: [],
    };
  }

  let selectedPeak = null;
  let status = BUST_APEX_PLANE_STATUS.READY;

  if (pooledGroups.length === 1) {
    const group = pooledGroups[0];
    selectedPeak = group.representativePeak;

    if (group.memberCount > 1) {
      warnings.push(`Broad bust prominence pooled across ${group.memberCount} local extrema (Y: [${group.groupMinYcm.toFixed(2)}, ${group.groupMaxYcm.toFixed(2)}] cm); representative apex localized at Y=${selectedPeak.yCm.toFixed(2)} cm.`);
    }
  } else {
    // Multiple distinct peak groups
    const primary = pooledGroups[0];
    const secondary = pooledGroups[1];

    const promDiff = primary.prominenceCm - secondary.prominenceCm;
    const promRatio = secondary.prominenceCm / primary.prominenceCm;

    if (promDiff < ambiguityProminenceThresholdCm || promRatio >= ambiguityProminenceRatio) {
      status = BUST_APEX_PLANE_STATUS.AMBIGUOUS;
      blockers.push(BUST_APEX_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES);
      issues.push(`Detected multiple competing chest/breast prominences at Y=${primary.representativePeak.yCm.toFixed(2)} cm (prominence: ${primary.prominenceCm.toFixed(2)} cm) and Y=${secondary.representativePeak.yCm.toFixed(2)} cm (prominence: ${secondary.prominenceCm.toFixed(2)} cm). Cannot deterministically isolate a unique Bust Apex plane.`);
    } else {
      selectedPeak = primary.representativePeak;
      if (primary.memberCount > 1) {
        warnings.push(`Broad bust prominence pooled across ${primary.memberCount} local extrema (Y: [${primary.groupMinYcm.toFixed(2)}, ${primary.groupMaxYcm.toFixed(2)}] cm); representative apex localized at Y=${selectedPeak.yCm.toFixed(2)} cm.`);
      }
      warnings.push(`Primary bust prominence at Y=${primary.representativePeak.yCm.toFixed(2)} cm (prominence: ${primary.prominenceCm.toFixed(2)} cm) selected; secondary prominence at Y=${secondary.representativePeak.yCm.toFixed(2)} cm (prominence: ${secondary.prominenceCm.toFixed(2)} cm) noted.`);
    }
  }

  if (!selectedPeak || status === BUST_APEX_PLANE_STATUS.AMBIGUOUS) {
    return {
      ...buildEmptyLocalizationResult({
        status: BUST_APEX_PLANE_STATUS.AMBIGUOUS,
        upperYcm,
        lowerYcm,
        upperSource,
        lowerSource,
        facingDirection,
        anteriorSide,
        blockers,
        warnings,
        issues,
        totalCandidates: rawCandidates.length,
        searchCandidateCount: N,
        sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      }),
      candidates: enrichedCandidates,
      peaks: rawPeaks,
      groups: pooledGroups,
    };
  }

  const selectedCandidateRecord = selectedPeak.candidate;
  const selectedYcm = selectedPeak.yCm;
  const selectedRasterRow = selectedPeak.rasterRow;
  const selectedSideRasterRow = selectedPeak.sideRasterRow;

  // Front corroboration status check
  if (!selectedCandidateRecord.isFrontValid) {
    warnings.push('Front transverse width corroboration is unavailable or non-single-run at localized Bust Apex Y; Side anterior prominence localization remains valid.');
  }

  // Side AP depth corroboration status check
  if (selectedCandidateRecord.side?.isQualified !== true) {
    warnings.push('Side physical AP depth qualification is unvalidated at localized Bust Apex Y; downstream Modeled Bust Circumference will require depth qualification.');
  }

  const frontEvidence = {
    status: selectedCandidateRecord.front?.status ?? 'unavailable',
    widthCm: selectedCandidateRecord.front?.widthCm ?? null,
    minXcm: selectedCandidateRecord.front?.minXcm ?? null,
    maxXcm: selectedCandidateRecord.front?.maxXcm ?? null,
    runCount: selectedCandidateRecord.front?.runCount ?? 0,
    isSingleSupportedRun: selectedCandidateRecord.front?.isSingleSupportedRun ?? false,
    encounteredClassIds: [...(selectedCandidateRecord.front?.encounteredClassIds ?? [])],
    rasterRow: selectedRasterRow,
  };

  const sideEvidence = {
    status: selectedCandidateRecord.side?.status ?? 'valid',
    profileSpanCm: selectedCandidateRecord.side?.profileSpanCm ?? null,
    qualifiedApDepthCm: selectedCandidateRecord.side?.qualifiedApDepthCm ?? null,
    minUcm: selectedCandidateRecord.side?.minUcm ?? null,
    maxUcm: selectedCandidateRecord.side?.maxUcm ?? null,
    rawAnteriorUcm: selectedPeak.rawAnteriorUcm,
    smoothedAnteriorUcm: selectedPeak.smoothedAnteriorUcm,
    baselineUcm: selectedPeak.baselineUcm,
    prominenceCm: selectedPeak.prominenceCm,
    isQualified: selectedCandidateRecord.side?.isQualified === true,
    depthQualificationStatus: selectedCandidateRecord.side?.depthQualificationStatus ?? 'unavailable',
    encounteredClassIds: [...(selectedCandidateRecord.side?.encounteredClassIds ?? [])],
    rasterRow: selectedSideRasterRow,
  };

  return {
    contract: BUST_APEX_PLANE_CONTRACT,
    version: BUST_APEX_PLANE_CONTRACT_VERSION,
    status: BUST_APEX_PLANE_STATUS.READY,
    yCm: selectedYcm,
    rasterRow: selectedRasterRow,
    sideRasterRow: selectedSideRasterRow,
    selectionMethod: 'anterior_contour_prominence_baseline_v0',
    searchWindow: {
      shoulderYcm: upperYcm,
      naturalWaistSuperiorCrestYcm: lowerYcm,
      spanCm: Number((upperYcm - lowerYcm).toFixed(4)),
      upperSource,
      lowerSource,
    },
    orientation: {
      status: 'ready',
      facingDirection,
      anteriorSide,
    },
    selectedPeak: {
      yCm: selectedYcm,
      rasterRow: selectedRasterRow,
      sideRasterRow: selectedSideRasterRow,
      prominenceCm: selectedPeak.prominenceCm,
      rawAnteriorUcm: selectedPeak.rawAnteriorUcm,
      normalizedAnteriorVal: selectedPeak.normalizedAnteriorVal,
      smoothedAnteriorUcm: selectedPeak.smoothedAnteriorUcm,
      baselineUcm: selectedPeak.baselineUcm,
      frontWidthCm: selectedCandidateRecord.front?.widthCm ?? null,
      frontMinXcm: selectedCandidateRecord.front?.minXcm ?? null,
      frontMaxXcm: selectedCandidateRecord.front?.maxXcm ?? null,
      sideProfileSpanCm: selectedCandidateRecord.side?.profileSpanCm ?? null,
      sideMinUcm: selectedCandidateRecord.side?.minUcm ?? null,
      sideMaxUcm: selectedCandidateRecord.side?.maxUcm ?? null,
      qualifiedApDepthCm: selectedCandidateRecord.side?.qualifiedApDepthCm ?? null,
      isSideDepthQualified: selectedCandidateRecord.side?.isQualified === true,
      broadnessScore: selectedPeak.broadnessScore,
      encounteredFrontClassIds: [...(selectedCandidateRecord.front?.encounteredClassIds ?? [])],
      encounteredSideClassIds: [...(selectedCandidateRecord.side?.encounteredClassIds ?? [])],
    },
    candidateCount: rawCandidates.length,
    searchCandidateCount: N,
    candidates: enrichedCandidates,
    peaks: rawPeaks,
    groups: pooledGroups,
    frontEvidence,
    sideEvidence,
    provenance: {
      shoulderYcm: upperYcm,
      offsetBelowShoulderCm: Number((upperYcm - selectedYcm).toFixed(4)),
      naturalWaistSuperiorCrestYcm: lowerYcm,
      elevationAboveWaistCrestCm: Number((selectedYcm - lowerYcm).toFixed(4)),
      totalCandidates: rawCandidates.length,
      searchCandidateCount: N,
      smoothingWindowCm,
      smoothingRadiusSamples,
      sampleSpacingCm: Number(nominalSampleSpacingCm.toFixed(4)),
      minApexProminenceCm,
      maxPeakMergeDistanceCm,
      maxInterPeakSaddleDropCm,
      supportPolicyId: torsoScanReport.supportPolicyId ?? 'trunk_core_support_v0',
      targetClassIds: Array.isArray(torsoScanReport.targetClassIds) ? [...torsoScanReport.targetClassIds] : [22, 23],
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: scanStatus,
      sliceHighlightCoordinates: {
        yCm: selectedYcm,
        frontRasterRow: selectedRasterRow,
        sideRasterRow: selectedSideRasterRow,
        frontBoundsCm: {
          minX: selectedCandidateRecord.front?.minXcm ?? null,
          maxX: selectedCandidateRecord.front?.maxXcm ?? null,
        },
        sideBoundsCm: {
          minU: selectedCandidateRecord.side?.minUcm ?? null,
          maxU: selectedCandidateRecord.side?.maxUcm ?? null,
        },
      },
    },
    semantics: {
      statement: 'Deterministic Bust Apex Plane localization candidate derived from anterior Side silhouette contour prominence relative to local anatomical baseline between Shoulder and Natural Waist superior crest. NOT maximum AP depth, NOT maximum Front width, NOT maximum circumference, NOT 3D reconstruction.',
      isBustApexPlaneCandidate: true,
      isModeledLocalization: true,
      isMaximumApDepth: false,
      isCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

/**
 * Abdominal Apex Plane Localization Contract v0
 *
 * Pure deterministic domain contract that localizes the horizontal canonical-Y plane
 * corresponding to the strongest stable anterior abdominal protrusion between the
 * Natural Waist constriction region and the Hip anatomical anchor.
 *
 * Contract: 'abdominal-apex-plane-localization-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence-driven localization: searches for the local maximum of the anterior Side silhouette
 *   contour relative to a local anatomical baseline connecting the Natural Waist inferior boundary
 *   to the Hip anatomical level.
 * - NOT maximum total AP depth (AP depth may peak at the buttocks or hips posteriorly).
 * - NOT maximum circumference or Ramanujan perimeter.
 * - NOT a body-height percentage or fixed anatomical offset (e.g. waist - 5cm or midpoint).
 * - NOT a single-row raster spike (requires metric neighborhood support and smoothing).
 * - Directionally invariant: consumes side-anterior-posterior-orientation-v0 to normalize
 *   anterior protrusion regardless of whether the subject faces positive-U or negative-U.
 * - Disclaims 3D vertex reconstruction, camera extrinsics, and pointmap/normals dependencies.
 */

import { SIDE_ORIENTATION_STATUS, FACING_DIRECTION, SIDE_U_ENDPOINT } from './sideAnteriorPosteriorOrientation.js';
import { NATURAL_WAIST_PLANE_STATUS } from './naturalWaistPlaneLocalization.js';

export const ABDOMINAL_APEX_PLANE_CONTRACT = 'abdominal-apex-plane-localization-v0';
export const ABDOMINAL_APEX_PLANE_CONTRACT_VERSION = 'abdominal-apex-plane-localization-v0';

/**
 * Authoritative 4-state localization status taxonomy.
 * @type {Readonly<{
 *   READY: 'ready',
 *   AMBIGUOUS: 'ambiguous',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const ABDOMINAL_APEX_PLANE_STATUS = Object.freeze({
  READY: 'ready',
  AMBIGUOUS: 'ambiguous',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Abdominal Apex plane localization.
 * @type {Readonly<Record<string, string>>}
 */
export const ABDOMINAL_APEX_BLOCKER_CODES = Object.freeze({
  TORSO_SCAN_UNAVAILABLE: 'torso_scan_unavailable',
  NATURAL_WAIST_UNAVAILABLE: 'natural_waist_unavailable',
  HIP_ANCHOR_UNAVAILABLE: 'hip_anchor_unavailable',
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
 * Default parameters for Abdominal Apex neighborhood analysis and peak detection.
 */
export const DEFAULT_ABDOMINAL_APEX_OPTIONS = Object.freeze({
  /** Minimum anterior protrusion depth (cm) relative to local baseline to qualify as an abdominal apex. */
  minApexProminenceCm: 0.30,
  /** Total physical metric smoothing window span (cm). Default 2.0 cm corresponds to a +/- 1.0 cm radius. */
  smoothingWindowCm: 2.0,
  /** Optional override for smoothing filter radius in discrete samples. */
  smoothingRadiusRows: null,
  /** Maximum vertical distance (cm) between adjacent peaks to be pooled into the same broad abdominal bulge. */
  maxPeakMergeDistanceCm: 5.0,
  /** Maximum intervening saddle drop (cm) permitted between peaks for broad bulge pooling. */
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
 * Groups nearby distinct local maxima belonging to the same broad abdominal bulge into pooled peak regions.
 *
 * @param {Array<object>} distinctPeaks
 * @param {Array<object>} enrichedCandidates
 * @param {object} options
 * @returns {Array<object>} pooledPeaks
 */
export function poolAbdominalPeaks(distinctPeaks, enrichedCandidates, options = {}) {
  if (!Array.isArray(distinctPeaks) || distinctPeaks.length === 0) {
    return [];
  }

  const maxPeakMergeDistanceCm = options.maxPeakMergeDistanceCm ?? DEFAULT_ABDOMINAL_APEX_OPTIONS.maxPeakMergeDistanceCm;
  const maxInterPeakSaddleDropCm = options.maxInterPeakSaddleDropCm ?? DEFAULT_ABDOMINAL_APEX_OPTIONS.maxInterPeakSaddleDropCm;
  const tieBreakToleranceCm = options.tieBreakToleranceCm ?? DEFAULT_ABDOMINAL_APEX_OPTIONS.tieBreakToleranceCm;

  // Sort peaks spatially by candidateIndex (superior to inferior)
  const sortedPeaks = [...distinctPeaks].sort((a, b) => a.candidateIndex - b.candidateIndex);

  const groups = [];
  let currentGroup = [sortedPeaks[0]];

  for (let i = 1; i < sortedPeaks.length; i += 1) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sortedPeaks[i];

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

    if (isNearDistance && isShallowSaddle) {
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
        // Step 2: Tie-break using Front/Side valid support broadness
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
      peakGroupId: `apex_group_${groupIdx + 1}`,
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
  status = ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  upperYcm = null,
  lowerYcm = null,
  upperSource = 'natural_waist_inferior_crest',
  lowerSource = 'hip_anatomical_level',
  totalCandidates = 0,
  searchCandidateCount = 0,
  facingDirection = null,
  anteriorSide = null,
  supportPolicyId = 'trunk_pelvic_transition_support_v0',
  targetClassIds = [12, 13, 21, 22, 23],
  sourceScanContract = 'torso-arbitrary-y-evidence-scan-v0',
} = {}) {
  return {
    contract: ABDOMINAL_APEX_PLANE_CONTRACT,
    version: ABDOMINAL_APEX_PLANE_CONTRACT_VERSION,
    status,
    yCm: null,
    rasterRow: null,
    sideRasterRow: null,
    selectionMethod: 'anterior_contour_prominence_baseline_v0',
    searchWindow: {
      upperYcm,
      lowerYcm,
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
      upperYcm,
      lowerYcm,
      totalCandidates,
      searchCandidateCount,
      supportPolicyId,
      targetClassIds: [...targetClassIds],
      sourceScanContract,
      sliceHighlightCoordinates: null,
    },
    semantics: {
      statement: 'Deterministic Abdominal Apex Plane localization candidate derived from anterior Side silhouette contour prominence relative to local anatomical baseline between Natural Waist and Hip. NOT maximum AP depth, NOT maximum circumference, NOT 3D reconstruction.',
      isAbdominalApexPlaneCandidate: true,
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
 * Evaluates pure deterministic Abdominal Apex Plane Localization from a completed
 * Torso Arbitrary-Y Evidence Scan report, Natural Waist report, and Side Orientation report.
 *
 * @param {{
 *   torsoScanReport?: object|null,
 *   naturalWaistReport?: object|null,
 *   sideOrientationReport?: object|null,
 *   levelsReport?: object|null,
 *   options?: typeof DEFAULT_ABDOMINAL_APEX_OPTIONS,
 * }} input
 * @returns {object} AbdominalApexPlaneLocalizationResultV0
 */
export function evaluateAbdominalApexPlaneLocalization({
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
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.minApexProminenceCm;

  const smoothingWindowCm = typeof options?.smoothingWindowCm === 'number' && options.smoothingWindowCm > 0
    ? options.smoothingWindowCm
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.smoothingWindowCm;

  const maxPeakMergeDistanceCm = typeof options?.maxPeakMergeDistanceCm === 'number' && options.maxPeakMergeDistanceCm > 0
    ? options.maxPeakMergeDistanceCm
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.maxPeakMergeDistanceCm;

  const maxInterPeakSaddleDropCm = typeof options?.maxInterPeakSaddleDropCm === 'number' && options.maxInterPeakSaddleDropCm >= 0
    ? options.maxInterPeakSaddleDropCm
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.maxInterPeakSaddleDropCm;

  const ambiguityProminenceThresholdCm = typeof options?.ambiguityProminenceThresholdCm === 'number'
    ? options.ambiguityProminenceThresholdCm
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.ambiguityProminenceThresholdCm;

  const ambiguityProminenceRatio = typeof options?.ambiguityProminenceRatio === 'number'
    ? options.ambiguityProminenceRatio
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.ambiguityProminenceRatio;

  const boundaryMarginCm = typeof options?.boundaryMarginCm === 'number' && options.boundaryMarginCm >= 0
    ? options.boundaryMarginCm
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.boundaryMarginCm;

  const tieBreakToleranceCm = typeof options?.tieBreakToleranceCm === 'number' && options.tieBreakToleranceCm >= 0
    ? options.tieBreakToleranceCm
    : DEFAULT_ABDOMINAL_APEX_OPTIONS.tieBreakToleranceCm;

  // 1. Validate Input Torso Scan Report
  if (!torsoScanReport || typeof torsoScanReport !== 'object') {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push('Torso arbitrary-Y evidence scan report is missing or null.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const scanStatus = torsoScanReport.status;
  if (scanStatus !== 'completed' && scanStatus !== 'partial') {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push(`Torso arbitrary-Y evidence scan status is '${scanStatus}' (not completed or partial).`);
    return buildEmptyLocalizationResult({
      status: scanStatus === 'invalid' ? ABDOMINAL_APEX_PLANE_STATUS.INVALID : ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      totalCandidates: torsoScanReport.candidateCount ?? 0,
    });
  }

  const rawCandidates = Array.isArray(torsoScanReport.candidates) ? torsoScanReport.candidates : [];
  if (rawCandidates.length === 0) {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push('Torso scan report contains 0 candidate rows.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      totalCandidates: 0,
    });
  }

  // 2. Validate Side Anterior / Posterior Orientation Report
  if (!sideOrientationReport || typeof sideOrientationReport !== 'object') {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push('Side anterior/posterior orientation report is missing.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  if (sideOrientationReport.status !== SIDE_ORIENTATION_STATUS.READY || !sideOrientationReport.anteriorSide) {
    const isAmbiguous = sideOrientationReport.status === SIDE_ORIENTATION_STATUS.AMBIGUOUS;
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push(`Side anterior/posterior orientation is '${sideOrientationReport.status}'. Authoritative anterior Side contour cannot be identified.`);
    return buildEmptyLocalizationResult({
      status: isAmbiguous ? ABDOMINAL_APEX_PLANE_STATUS.AMBIGUOUS : ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
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

  // 3. Resolve Search Window Boundaries
  // Upper Boundary: Natural Waist inferior trough boundary (or waist center Y)
  let upperYcm = null;
  let upperSource = 'natural_waist_inferior_crest';

  if (naturalWaistReport && typeof naturalWaistReport === 'object') {
    if (naturalWaistReport.status === NATURAL_WAIST_PLANE_STATUS.READY) {
      const primaryTrough = Array.isArray(naturalWaistReport.troughs) && naturalWaistReport.troughs.length > 0
        ? naturalWaistReport.troughs[0]
        : null;

      if (primaryTrough && typeof primaryTrough.inferiorCrestYcm === 'number' && Number.isFinite(primaryTrough.inferiorCrestYcm)) {
        upperYcm = primaryTrough.inferiorCrestYcm;
        upperSource = 'natural_waist_primary_trough_inferior_crest';
      } else if (typeof naturalWaistReport.yCm === 'number' && Number.isFinite(naturalWaistReport.yCm)) {
        upperYcm = naturalWaistReport.yCm;
        upperSource = 'natural_waist_center_plane';
      }
    } else {
      warnings.push(`Natural Waist status is '${naturalWaistReport.status}'.`);
    }
  }

  if (upperYcm === null) {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE);
    issues.push('Natural Waist reference boundary is unavailable. Abdominal apex search requires a qualified upper boundary.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  // Lower Boundary: Hip anatomical reference level Y
  let lowerYcm = null;
  let lowerSource = 'hip_anatomical_level';

  const hipLevel = levelsReport?.levels?.find((l) => l.id === 'hip')
    ?? (torsoScanReport.lowerBound?.sourceLevel === 'hip' ? torsoScanReport.lowerBound : null);

  if (hipLevel && typeof hipLevel.yCm === 'number' && Number.isFinite(hipLevel.yCm)) {
    lowerYcm = hipLevel.yCm;
  } else if (typeof torsoScanReport.lowerBound?.yCm === 'number' && Number.isFinite(torsoScanReport.lowerBound.yCm)) {
    lowerYcm = torsoScanReport.lowerBound.yCm;
  }

  if (lowerYcm === null) {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.HIP_ANCHOR_UNAVAILABLE);
    issues.push('Hip anatomical reference anchor is unavailable. Abdominal apex search requires a qualified lower boundary.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
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

  // Validate Ordering (upperYcm must be strictly greater elevation than lowerYcm)
  if (upperYcm <= lowerYcm) {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.INVALID_SEARCH_WINDOW);
    issues.push(`Invalid abdominal search window ordering: Upper waist boundary (${upperYcm.toFixed(2)} cm) must be strictly higher elevation than lower Hip level (${lowerYcm.toFixed(2)} cm).`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.INVALID,
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

  // 4. Filter Candidates in Search Window [lowerYcm, upperYcm]
  // We include boundary candidates for baseline evaluation and interior candidates for peak detection.
  const windowCandidates = rawCandidates.filter((c) => {
    if (!c || typeof c !== 'object' || typeof c.yCm !== 'number' || !Number.isFinite(c.yCm)) return false;
    return c.yCm <= upperYcm + 0.05 && c.yCm >= lowerYcm - 0.05;
  });

  // Sort by Y descending (superior to inferior)
  windowCandidates.sort((a, b) => b.yCm - a.yCm);

  const M = windowCandidates.length;
  if (M < 3) {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient candidate rows in abdominal search window (${M} rows between Y=${upperYcm.toFixed(1)} cm and Y=${lowerYcm.toFixed(1)} cm). At least 3 connected rows required.`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
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

  // 5. Extract Normalized Anterior Contour Series A_norm(Y)
  // For positive_u: A_norm = +maxUcm (larger is outward/anterior)
  // For negative_u: A_norm = -minUcm (larger is outward/anterior)
  const extractedRows = [];
  let hasMalformed = false;

  for (let idx = 0; idx < M; idx += 1) {
    const c = windowCandidates[idx];
    const side = c.side;
    const front = c.front;

    const rawMinU = side?.minUcm ?? null;
    const rawMaxU = side?.maxUcm ?? null;
    const rawProfileSpan = side?.profileSpanCm ?? null;
    const qualifiedApDepth = side?.qualifiedApDepthCm ?? null;

    if (rawMinU === null || rawMaxU === null || !Number.isFinite(rawMinU) || !Number.isFinite(rawMaxU)) {
      // Row lacks valid side endpoints
      continue;
    }

    const rawAnteriorU = isPositiveU ? rawMaxU : rawMinU;
    const rawPosteriorU = isPositiveU ? rawMinU : rawMaxU;
    const normalizedAnteriorVal = isPositiveU ? rawMaxU : -rawMinU;

    const isFrontValid = front?.status === 'valid' && front?.isSingleSupportedRun === true;
    const isSideValid = side?.status === 'valid' && side?.isSingleSupportedRun === true;

    extractedRows.push({
      ...c,
      windowIndex: idx,
      rawAnteriorU,
      rawPosteriorU,
      normalizedAnteriorVal,
      isFrontValid,
      isSideValid,
      isStructurallyValid: isFrontValid && isSideValid,
    });
  }

  const N = extractedRows.length;
  if (N < 3) {
    blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient valid Side anterior silhouette points in abdominal search window (${N} valid rows).`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
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

  // 6. Compute Average Sample Spacing & Metric-Scaled Smoothing Radius
  const totalSpanCm = Math.abs(extractedRows[0].yCm - extractedRows[N - 1].yCm);
  const sampleSpacingCm = N >= 2 && totalSpanCm > 0 ? totalSpanCm / (N - 1) : 1.0;
  const smoothingRadiusSamples = typeof options?.smoothingRadiusRows === 'number' && options.smoothingRadiusRows >= 0
    ? options.smoothingRadiusRows
    : Math.max(1, Math.round((smoothingWindowCm / 2) / sampleSpacingCm));

  // 7. Apply Metric Symmetric Smoothing to Normalized Anterior Contour
  const rawAnteriorNormValues = extractedRows.map((r) => r.normalizedAnteriorVal);
  const smoothedAnteriorNormValues = applySymmetricSmoothing(rawAnteriorNormValues, smoothingRadiusSamples);

  // 8. Compute Shape-Relative Local Baseline B_linear(Y)
  // Linear baseline connects the superior boundary anchor to the inferior boundary anchor.
  // We use the top rows and bottom rows to establish stable boundary endpoints.
  const superiorAnchorNorm = smoothedAnteriorNormValues[0];
  const superiorAnchorY = extractedRows[0].yCm;
  const inferiorAnchorNorm = smoothedAnteriorNormValues[N - 1];
  const inferiorAnchorY = extractedRows[N - 1].yCm;
  const windowYSpan = superiorAnchorY - inferiorAnchorY;

  const enrichedCandidates = extractedRows.map((r, idx) => {
    const smoothedNorm = smoothedAnteriorNormValues[idx];
    const smoothedAnteriorU = isPositiveU ? smoothedNorm : -smoothedNorm;

    // Linear baseline value at this Y
    const t = windowYSpan > 0 ? (superiorAnchorY - r.yCm) / windowYSpan : 0.5;
    const baselineNorm = superiorAnchorNorm + t * (inferiorAnchorNorm - superiorAnchorNorm);
    const baselineUcm = isPositiveU ? baselineNorm : -baselineNorm;

    // Prominence: signed displacement outward beyond the straight line between waist and hip
    const prominenceCm = Number((smoothedNorm - baselineNorm).toFixed(4));

    return {
      ...r,
      indexInEnriched: idx,
      smoothedAnteriorUcm: Number(smoothedAnteriorU.toFixed(4)),
      baselineUcm: Number(baselineUcm.toFixed(4)),
      prominenceCm,
    };
  });

  // 9. Detect Local Maxima (Peaks) in Prominence Profile
  const rawPeaks = [];

  // Candidate must be strictly inside boundaries (exclude immediate endpoints idx 0 and N-1)
  for (let i = 1; i < N - 1; i += 1) {
    const curr = enrichedCandidates[i];
    const prev = enrichedCandidates[i - 1];
    const next = enrichedCandidates[i + 1];

    const isLocalMax = curr.prominenceCm >= prev.prominenceCm && curr.prominenceCm >= next.prominenceCm;

    if (isLocalMax && curr.prominenceCm >= minApexProminenceCm) {
      // Check single-row spike artifact (raw vs smoothed delta)
      const rawVsSmoothedDelta = Math.abs(curr.rawAnteriorU - curr.smoothedAnteriorUcm);
      const isSpike = rawVsSmoothedDelta >= 1.0;

      // Check distance from boundaries
      const distFromUpper = superiorAnchorY - curr.yCm;
      const distFromLower = curr.yCm - inferiorAnchorY;
      const isBoundaryConfounded = distFromUpper < boundaryMarginCm || distFromLower < boundaryMarginCm;

      // Vertical support: count neighboring rows that maintain at least 50% of peak prominence
      let supportRows = 1;
      let leftIdx = i - 1;
      while (leftIdx >= 0 && enrichedCandidates[leftIdx].prominenceCm >= curr.prominenceCm * 0.5) {
        supportRows += 1;
        leftIdx -= 1;
      }
      let rightIdx = i + 1;
      while (rightIdx < N && enrichedCandidates[rightIdx].prominenceCm >= curr.prominenceCm * 0.5) {
        supportRows += 1;
        rightIdx += 1;
      }

      const isNeighborhoodStable = !isSpike && supportRows >= 3;

      rawPeaks.push({
        candidateIndex: i,
        candidate: curr,
        yCm: curr.yCm,
        rasterRow: curr.rasterRow,
        sideRasterRow: curr.sideRasterRow,
        rawAnteriorUcm: curr.rawAnteriorU,
        smoothedAnteriorUcm: curr.smoothedAnteriorUcm,
        baselineUcm: curr.baselineUcm,
        prominenceCm: curr.prominenceCm,
        broadnessScore: supportRows,
        isSpike,
        isBoundaryConfounded,
        isNeighborhoodStable,
        isStructurallyValid: curr.isStructurallyValid,
      });
    }
  }

  // 10. Filter Significant & Stable Peaks
  const stablePeaks = rawPeaks.filter((p) => p.isNeighborhoodStable && !p.isBoundaryConfounded && p.isStructurallyValid);

  // 11. Broad Peak Pooling
  const pooledGroups = poolAbdominalPeaks(stablePeaks, enrichedCandidates, {
    maxPeakMergeDistanceCm,
    maxInterPeakSaddleDropCm,
    tieBreakToleranceCm,
  });

  // Sort pooled groups by prominence descending
  pooledGroups.sort((a, b) => b.prominenceCm - a.prominenceCm);

  // 12. Evaluate Ambiguity and Apex Selection
  if (pooledGroups.length === 0) {
    // Check if any peaks were rejected as boundary confounded
    const boundaryPeaks = rawPeaks.filter((p) => p.isBoundaryConfounded);
    if (boundaryPeaks.length > 0) {
      blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.BOUNDARY_CONFOUNDED_APEX);
      issues.push(`Detected anterior protrusion candidate near search boundary (Y=${boundaryPeaks[0].yCm.toFixed(1)} cm) that is confounded with the Natural Waist or Hip boundary transition.`);
    } else {
      blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.NO_ANTERIOR_PROMINENCE_DETECTED);
      issues.push(`No stable anterior abdominal prominence detected (threshold: ${minApexProminenceCm.toFixed(2)} cm). Anterior profile is flat or monotonic between Natural Waist (Y=${upperYcm.toFixed(1)} cm) and Hip (Y=${lowerYcm.toFixed(1)} cm).`);
    }

    return {
      ...buildEmptyLocalizationResult({
        status: ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE,
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
  let status = ABDOMINAL_APEX_PLANE_STATUS.READY;

  if (pooledGroups.length === 1) {
    const group = pooledGroups[0];
    selectedPeak = group.representativePeak;

    if (group.memberCount > 1) {
      warnings.push(`Broad abdominal bulge pooled across ${group.memberCount} local extrema (Y: [${group.groupMinYcm.toFixed(2)}, ${group.groupMaxYcm.toFixed(2)}] cm); representative apex localized at Y=${selectedPeak.yCm.toFixed(2)} cm.`);
    }
  } else {
    // Multiple distinct peak groups
    const primary = pooledGroups[0];
    const secondary = pooledGroups[1];

    const promDiff = primary.prominenceCm - secondary.prominenceCm;
    const promRatio = secondary.prominenceCm / primary.prominenceCm;

    if (promDiff < ambiguityProminenceThresholdCm || promRatio >= ambiguityProminenceRatio) {
      status = ABDOMINAL_APEX_PLANE_STATUS.AMBIGUOUS;
      blockers.push(ABDOMINAL_APEX_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES);
      issues.push(`Detected multiple competing abdominal prominences at Y=${primary.representativePeak.yCm.toFixed(2)} cm (prominence: ${primary.prominenceCm.toFixed(2)} cm) and Y=${secondary.representativePeak.yCm.toFixed(2)} cm (prominence: ${secondary.prominenceCm.toFixed(2)} cm). Cannot deterministically isolate a unique Abdominal Apex plane.`);
    } else {
      selectedPeak = primary.representativePeak;
      if (primary.memberCount > 1) {
        warnings.push(`Broad abdominal bulge pooled across ${primary.memberCount} local extrema (Y: [${primary.groupMinYcm.toFixed(2)}, ${primary.groupMaxYcm.toFixed(2)}] cm); representative apex localized at Y=${selectedPeak.yCm.toFixed(2)} cm.`);
      }
      warnings.push(`Primary abdominal prominence at Y=${primary.representativePeak.yCm.toFixed(2)} cm (prominence: ${primary.prominenceCm.toFixed(2)} cm) selected; secondary prominence at Y=${secondary.representativePeak.yCm.toFixed(2)} cm (prominence: ${secondary.prominenceCm.toFixed(2)} cm) noted.`);
    }
  }

  if (!selectedPeak || status === ABDOMINAL_APEX_PLANE_STATUS.AMBIGUOUS) {
    return {
      ...buildEmptyLocalizationResult({
        status: ABDOMINAL_APEX_PLANE_STATUS.AMBIGUOUS,
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

  const frontEvidence = {
    status: selectedCandidateRecord.front?.status ?? 'valid',
    widthCm: selectedCandidateRecord.front?.widthCm ?? null,
    minXcm: selectedCandidateRecord.front?.minXcm ?? null,
    maxXcm: selectedCandidateRecord.front?.maxXcm ?? null,
    runCount: selectedCandidateRecord.front?.runCount ?? 1,
    encounteredClassIds: [...(selectedCandidateRecord.front?.encounteredClassIds ?? [])],
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
  };

  return {
    contract: ABDOMINAL_APEX_PLANE_CONTRACT,
    version: ABDOMINAL_APEX_PLANE_CONTRACT_VERSION,
    status: ABDOMINAL_APEX_PLANE_STATUS.READY,
    yCm: selectedYcm,
    rasterRow: selectedRasterRow,
    sideRasterRow: selectedSideRasterRow,
    selectionMethod: 'anterior_contour_prominence_baseline_v0',
    searchWindow: {
      upperYcm,
      lowerYcm,
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
    candidates: enrichedCandidates,
    peaks: rawPeaks,
    groups: pooledGroups,
    frontEvidence,
    sideEvidence,
    provenance: {
      upperYcm,
      offsetBelowWaistCm: Number((upperYcm - selectedYcm).toFixed(4)),
      lowerYcm,
      elevationAboveHipCm: Number((selectedYcm - lowerYcm).toFixed(4)),
      totalCandidates: rawCandidates.length,
      searchCandidateCount: N,
      smoothingWindowCm,
      smoothingRadiusSamples,
      sampleSpacingCm: Number(sampleSpacingCm.toFixed(4)),
      minApexProminenceCm,
      maxPeakMergeDistanceCm,
      maxInterPeakSaddleDropCm,
      supportPolicyId: torsoScanReport.supportPolicyId ?? 'trunk_pelvic_transition_support_v0',
      targetClassIds: Array.isArray(torsoScanReport.targetClassIds) ? [...torsoScanReport.targetClassIds] : [12, 13, 21, 22, 23],
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
      statement: 'Deterministic Abdominal Apex Plane localization candidate derived from anterior Side silhouette contour prominence relative to local anatomical baseline between Natural Waist and Hip. NOT maximum AP depth, NOT maximum circumference, NOT 3D reconstruction.',
      isAbdominalApexPlaneCandidate: true,
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

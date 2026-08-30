/**
 * Abdominal Point Plane Localization Contract v1
 *
 * Pure deterministic domain contract that localizes the horizontal canonical-Y plane
 * corresponding to the ISO-aligned Abdomen Point ("most anterior point of the abdomen")
 * within the abdominal container bounded between the Natural Waist Plane and the
 * Hip Anatomical Level.
 *
 * Contract: 'abdominal-point-plane-localization-v1'
 *
 * SEMANTIC PRINCIPLES (ISO 18825-2:2018 / ISO 8559-1:2017):
 * - Target Semantic: Abdomen Point is defined as the "most anterior point of the abdomen"
 *   (on the midsagittal plane in the upright standing position).
 * - Anterior abdominal surface determines vertical Y elevation; posterior/back geometry
 *   does NOT determine Y. Posterior geometry contributes only to AP depth and circumference
 *   once Y is fixed.
 * - NOT maximum total AP depth (AP depth may peak at the buttocks or hips posteriorly).
 * - NOT maximum Front transverse width (width peaks at the pelvic/trochanteric flaring).
 * - NOT maximum circumference or Ramanujan perimeter.
 * - NOT a baseline-relative prominence peak (does not subtract tilted chords).
 * - NOT a body-height percentage or fixed anatomical offset (e.g. waist - 5cm).
 * - Search Container: Strictly bounded between the ready Natural Waist Plane (superior anchor)
 *   and the ready Hip Anatomical Level (inferior anchor).
 * - Directionally invariant: Consumes side-anterior-posterior-orientation-v0 to normalize
 *   anterior projection regardless of whether the subject faces positive-U or negative-U.
 * - Translation invariant: Rigid translation along the Side U axis (U -> U + C) does not
 *   alter the selected Y elevation.
 * - Topological Abdominal-Dome Qualification: Identifies candidate abdominal domes exhibiting
 *   superior anterior expansion from the waist constriction, a maximal anterior plateau,
 *   and inferior posterior recession toward the hip along continuous metric-Y segments.
 *   (Persistence thresholds serve strictly for quantization noise rejection and directional persistence,
 *   NOT as anatomical protrusion amplitude requirements).
 * - Raw Contour Authority: Physical Y, representative row, endpoints, and downstream width/depth
 *   are extracted strictly from raw calibrated contour evidence; smoothing is used solely for slope QA.
 * - Plateau Midpoint: Symmetric geometric midpoint of the raw maximal anterior plateau.
 * - Metric-Y Continuity: Strictly gap-aware; zero cross-gap smoothing, derivatives, or plateau merging.
 * - Disclaims 3D vertex reconstruction, camera extrinsics, and pointmap/normals dependencies.
 */

import { SIDE_ORIENTATION_STATUS, FACING_DIRECTION, SIDE_U_ENDPOINT } from './sideAnteriorPosteriorOrientation.js';
import { NATURAL_WAIST_PLANE_STATUS } from './naturalWaistPlaneLocalization.js';

export const ABDOMINAL_POINT_PLANE_CONTRACT = 'abdominal-point-plane-localization-v1';
export const ABDOMINAL_POINT_PLANE_CONTRACT_VERSION = 'abdominal-point-plane-localization-v1';

/**
 * Authoritative 4-state localization status taxonomy.
 * @type {Readonly<{
 *   READY: 'ready',
 *   AMBIGUOUS: 'ambiguous',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const ABDOMINAL_POINT_PLANE_STATUS = Object.freeze({
  READY: 'ready',
  AMBIGUOUS: 'ambiguous',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Abdominal Point plane localization v1.
 * @type {Readonly<Record<string, string>>}
 */
export const ABDOMINAL_POINT_BLOCKER_CODES = Object.freeze({
  TORSO_SCAN_UNAVAILABLE: 'torso_scan_unavailable',
  NATURAL_WAIST_UNAVAILABLE: 'natural_waist_unavailable',
  HIP_ANCHOR_UNAVAILABLE: 'hip_anchor_unavailable',
  SIDE_ORIENTATION_UNAVAILABLE: 'side_orientation_unavailable',
  SIDE_VIEW_NOT_QUALIFIED: 'side_view_not_qualified',
  INVALID_SEARCH_WINDOW: 'invalid_search_window',
  INSUFFICIENT_SEARCH_ROWS: 'insufficient_search_rows',
  NO_ABDOMINAL_DOME_DETECTED: 'no_abdominal_dome_detected',
  AMBIGUOUS_MULTIPLE_APEX_PROMINENCES: 'ambiguous_multiple_apex_prominences',
  INTERRUPTED_PLATEAU_EVIDENCE: 'interrupted_plateau_evidence',
  BOUNDARY_CONFOUNDED_APEX: 'boundary_confounded_apex',
  NON_FINITE_CANDIDATE_DATA: 'non_finite_candidate_data',
});

/**
 * Default parameters for Abdominal Point neighborhood analysis and plateau detection.
 * Derived from physical sensor calibration (e.g. 10 px/cm => 0.10 cm raster pitch).
 */
export const DEFAULT_ABDOMINAL_POINT_OPTIONS = Object.freeze({
  /** Sub-pixel numeric tolerance (cm) within which two candidate rows belong to the same maximal anterior pixel column. */
  tieBreakToleranceCm: 0.05,
  /** Minimum persistence step count (discrete samples) over which slope direction must be sustained for noise rejection. */
  minPersistenceSteps: 2,
  /** Minimum physical contour expansion (cm) approaching apex to qualify as a dome (filters 1-pixel jitter). */
  minDomeExpansionCm: 0.10,
  /** Minimum physical contour recession (cm) leaving apex to qualify as a dome (filters 1-pixel jitter). */
  minDomeRecessionCm: 0.10,
  /** Total physical metric smoothing window span (cm) for local slope stabilization. Default 1.5 cm corresponds to +/- 0.75 cm radius. */
  smoothingWindowCm: 1.5,
  /** Optional override for smoothing filter radius in discrete samples. */
  smoothingRadiusRows: null,
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
 * Builds an empty or fallback localization result.
 */
function buildEmptyLocalizationResult({
  status = ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  upperYcm = null,
  lowerYcm = null,
  upperSource = 'natural_waist_plane_localization',
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
    contract: ABDOMINAL_POINT_PLANE_CONTRACT,
    version: ABDOMINAL_POINT_PLANE_CONTRACT_VERSION,
    id: 'torso_abdominal_point_plane_localization_v1',
    name: 'Abdominal Point Plane Localization',
    status,
    yCm: null,
    levelYcm: null,
    rasterRow: null,
    sideRasterRow: null,
    selectionMethod: 'dominant_abdominal_dome_plateau_v1',
    searchWindow: {
      naturalWaistYcm: upperYcm,
      hipYcm: lowerYcm,
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
    selectedDome: null,
    selectedPlateau: null,
    candidateCount: totalCandidates,
    searchCandidateCount,
    candidates: [],
    domes: [],
    frontEvidence: null,
    sideEvidence: null,
    provenance: {
      naturalWaistYcm: upperYcm,
      hipYcm: lowerYcm,
      totalCandidates,
      searchCandidateCount,
      supportPolicyId,
      targetClassIds: [...targetClassIds],
      sourceScanContract,
      sliceHighlightCoordinates: null,
    },
    semantics: {
      statement: 'Deterministic Abdominal Point Plane localization derived from the maximal anterior plateau of the dominant qualified abdominal dome between Natural Waist and Hip. Strictly conforms to ISO 18825-2 / ISO 8559-1 Abdomen Point ("most anterior point of the abdomen"). NOT baseline-relative prominence, NOT maximum AP depth, NOT maximum Front width, NOT maximum circumference, NOT 3D reconstruction.',
      isAbdominalPointPlaneCandidate: true,
      isModeledLocalization: true,
      isMostAnteriorAbdomenPoint: true,
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
 * Evaluates pure deterministic Abdominal Point Plane Localization v1 from a completed
 * Torso Arbitrary-Y Evidence Scan report, Natural Waist report, Side Orientation report,
 * and Anatomical Levels report.
 *
 * @param {{
 *   torsoScanReport?: object|null,
 *   naturalWaistReport?: object|null,
 *   sideOrientationReport?: object|null,
 *   levelsReport?: object|null,
 *   options?: typeof DEFAULT_ABDOMINAL_POINT_OPTIONS,
 * }} input
 * @returns {object} AbdominalPointPlaneLocalizationResultV1
 */
export function evaluateAbdominalPointPlaneLocalization({
  torsoScanReport = null,
  naturalWaistReport = null,
  sideOrientationReport = null,
  levelsReport = null,
  options = {},
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const tieBreakToleranceCm = typeof options?.tieBreakToleranceCm === 'number' && options.tieBreakToleranceCm >= 0
    ? options.tieBreakToleranceCm
    : DEFAULT_ABDOMINAL_POINT_OPTIONS.tieBreakToleranceCm;

  const minPersistenceSteps = typeof options?.minPersistenceSteps === 'number' && options.minPersistenceSteps >= 1
    ? options.minPersistenceSteps
    : DEFAULT_ABDOMINAL_POINT_OPTIONS.minPersistenceSteps;

  const minDomeExpansionCm = typeof options?.minDomeExpansionCm === 'number' && options.minDomeExpansionCm >= 0
    ? options.minDomeExpansionCm
    : DEFAULT_ABDOMINAL_POINT_OPTIONS.minDomeExpansionCm;

  const minDomeRecessionCm = typeof options?.minDomeRecessionCm === 'number' && options.minDomeRecessionCm >= 0
    ? options.minDomeRecessionCm
    : DEFAULT_ABDOMINAL_POINT_OPTIONS.minDomeRecessionCm;

  const smoothingWindowCm = typeof options?.smoothingWindowCm === 'number' && options.smoothingWindowCm > 0
    ? options.smoothingWindowCm
    : DEFAULT_ABDOMINAL_POINT_OPTIONS.smoothingWindowCm;

  // 1. Validate Input Torso Scan Report
  if (!torsoScanReport || typeof torsoScanReport !== 'object') {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push('Torso arbitrary-Y evidence scan report is missing or null.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const scanStatus = torsoScanReport.status;
  if (scanStatus !== 'completed' && scanStatus !== 'partial') {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push(`Torso arbitrary-Y evidence scan status is '${scanStatus}' (not completed or partial).`);
    return buildEmptyLocalizationResult({
      status: scanStatus === 'invalid' ? ABDOMINAL_POINT_PLANE_STATUS.INVALID : ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      totalCandidates: torsoScanReport.candidateCount ?? 0,
    });
  }

  const rawCandidates = Array.isArray(torsoScanReport.candidates) ? torsoScanReport.candidates : [];
  if (rawCandidates.length === 0) {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push('Torso scan report contains 0 candidate rows.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      totalCandidates: 0,
    });
  }

  // 2. Validate Side Anterior / Posterior Orientation Report
  if (!sideOrientationReport || typeof sideOrientationReport !== 'object') {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push('Side anterior/posterior orientation report is missing.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  if (sideOrientationReport.status !== SIDE_ORIENTATION_STATUS.READY || !sideOrientationReport.anteriorSide) {
    const isAmbiguous = sideOrientationReport.status === SIDE_ORIENTATION_STATUS.AMBIGUOUS;
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push(`Side anterior/posterior orientation is '${sideOrientationReport.status}'. Authoritative anterior Side contour cannot be identified.`);
    return buildEmptyLocalizationResult({
      status: isAmbiguous ? ABDOMINAL_POINT_PLANE_STATUS.AMBIGUOUS : ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
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

  // 3. Resolve Superior Boundary: Natural Waist Plane Localization Y (REQUIRED)
  let upperYcm = null;
  let upperSource = 'natural_waist_plane_localization';

  if (!naturalWaistReport || typeof naturalWaistReport !== 'object') {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE);
    issues.push('Natural Waist reference report is missing or null. Abdominal point search requires a ready Natural Waist boundary.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  if (
    naturalWaistReport.status !== NATURAL_WAIST_PLANE_STATUS.READY
    || typeof naturalWaistReport.yCm !== 'number'
    || !Number.isFinite(naturalWaistReport.yCm)
  ) {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE);
    issues.push(`Natural Waist status is '${naturalWaistReport.status}' (not ready). Abdominal point search requires a ready Natural Waist boundary.`);
    return buildEmptyLocalizationResult({
      status: naturalWaistReport.status === 'invalid' ? ABDOMINAL_POINT_PLANE_STATUS.INVALID : ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
      facingDirection,
      anteriorSide,
      blockers,
      warnings,
      issues,
      totalCandidates: rawCandidates.length,
    });
  }

  upperYcm = naturalWaistReport.yCm;

  // 4. Resolve Inferior Boundary: Hip Anatomical Reference Level Y (REQUIRED)
  let lowerYcm = null;
  let lowerSource = 'hip_anatomical_level';

  const hipLevel = levelsReport?.levels?.find((l) => l.id === 'hip')
    ?? (torsoScanReport.lowerBound?.sourceLevel === 'hip' ? torsoScanReport.lowerBound : null);

  if (
    hipLevel
    && (hipLevel.status === 'ready' || typeof hipLevel.yCm === 'number')
    && typeof hipLevel.yCm === 'number'
    && Number.isFinite(hipLevel.yCm)
  ) {
    lowerYcm = hipLevel.yCm;
  } else if (typeof torsoScanReport.lowerBound?.yCm === 'number' && Number.isFinite(torsoScanReport.lowerBound.yCm)) {
    lowerYcm = torsoScanReport.lowerBound.yCm;
  }

  if (lowerYcm === null) {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.HIP_ANCHOR_UNAVAILABLE);
    issues.push('Hip anatomical reference anchor is unavailable. Abdominal point search requires a ready Hip lower boundary.');
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
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
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.INVALID_SEARCH_WINDOW);
    issues.push(`Invalid abdominal search window ordering: Upper Natural Waist (${upperYcm.toFixed(2)} cm) must be strictly higher elevation than lower Hip level (${lowerYcm.toFixed(2)} cm).`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.INVALID,
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

  // 6. Filter Candidates in Abdominal Search Window [lowerYcm, upperYcm]
  const windowCandidates = rawCandidates.filter((c) => {
    if (!c || typeof c !== 'object' || typeof c.yCm !== 'number' || !Number.isFinite(c.yCm)) return false;
    return c.yCm <= upperYcm + 0.05 && c.yCm >= lowerYcm - 0.05;
  });

  // Sort by Y descending (superior to inferior)
  windowCandidates.sort((a, b) => b.yCm - a.yCm);

  const M = windowCandidates.length;
  if (M < 3) {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient candidate rows in abdominal search window (${M} rows between Y=${upperYcm.toFixed(1)} cm and Y=${lowerYcm.toFixed(1)} cm). At least 3 connected rows required.`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
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

  // 7. Extract Normalized Anterior Contour Series
  const extractedRows = [];

  for (let idx = 0; idx < M; idx += 1) {
    const c = windowCandidates[idx];
    const side = c.side;
    const front = c.front;

    const rawMinU = side?.minUcm ?? null;
    const rawMaxU = side?.maxUcm ?? null;

    if (rawMinU === null || rawMaxU === null || !Number.isFinite(rawMinU) || !Number.isFinite(rawMaxU)) {
      continue;
    }

    const isSideValid = side?.status === 'valid' && (side?.isSingleSupportedRun === true || side?.runCount === 1);
    if (!isSideValid) {
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
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient valid Side anterior silhouette points in abdominal search window (${N} valid rows).`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
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

  // 9. Compute Metric-Scaled Smoothing Radius for Slope Stabilization
  const smoothingRadiusSamples = typeof options?.smoothingRadiusRows === 'number' && options.smoothingRadiusRows >= 0
    ? options.smoothingRadiusRows
    : Math.max(1, Math.round((smoothingWindowCm / 2) / nominalSampleSpacingCm));

  // 10. Process Continuous Segments, Smooth for Slope QA, and Identify Qualified Domes
  const enrichedCandidates = [];
  const qualifiedDomes = [];

  segments.forEach((seg, segIdx) => {
    const rawVals = seg.map((r) => r.normalizedAnteriorVal);
    // Smooth strictly within the continuous segment to stabilize finite difference slope signs
    const smoothedVals = seg.length >= 3
      ? applySymmetricSmoothing(rawVals, smoothingRadiusSamples)
      : [...rawVals];

    const segEnriched = seg.map((r, inSegIdx) => {
      const smoothedNorm = smoothedVals[inSegIdx];
      const smoothedAnteriorU = isPositiveU ? smoothedNorm : -smoothedNorm;

      return {
        ...r,
        segmentIndex: segIdx,
        indexInSegment: inSegIdx,
        indexInEnriched: enrichedCandidates.length + inSegIdx,
        rawAnteriorProjectionCm: r.normalizedAnteriorVal,
        smoothedAnteriorProjectionCm: smoothedNorm,
        smoothedAnteriorUcm: Number(smoothedAnteriorU.toFixed(4)),
      };
    });

    enrichedCandidates.push(...segEnriched);

    const segLen = segEnriched.length;
    if (segLen < 3) return;

    // Identify local maxima / plateaus in raw anterior series within the segment
    // Candidates are sorted descending by Y (index 0 is superior, index segLen-1 is inferior)
    let i = 0;
    while (i < segLen) {
      const currentVal = segEnriched[i].rawAnteriorProjectionCm;

      // Find extent of contiguous plateau within tieBreakToleranceCm
      let plateauEnd = i;
      while (
        plateauEnd + 1 < segLen
        && Math.abs(segEnriched[plateauEnd + 1].rawAnteriorProjectionCm - currentVal) <= tieBreakToleranceCm
      ) {
        plateauEnd += 1;
      }

      const plateauMembers = segEnriched.slice(i, plateauEnd + 1);
      const plateauMaxVal = Math.max(...plateauMembers.map((m) => m.rawAnteriorProjectionCm));

      // Check superior side (indices < i, which have higher Y)
      // Must show anterior expansion moving downward from Waist towards the plateau
      let superiorExpansionCm = 0;
      let superiorStepCount = 0;
      let isStrictlySuperiorExpansion = false;

      if (i > 0) {
        const checkLimit = Math.max(0, i - 15);
        for (let s = i - 1; s >= checkLimit; s -= 1) {
          const diff = plateauMaxVal - segEnriched[s].rawAnteriorProjectionCm;
          if (diff > superiorExpansionCm) {
            superiorExpansionCm = diff;
          }
          if (diff >= minDomeExpansionCm) {
            superiorStepCount = i - s;
            if (superiorStepCount >= minPersistenceSteps) {
              isStrictlySuperiorExpansion = true;
              break;
            }
          }
        }
      }

      // Check inferior side (indices > plateauEnd, which have lower Y)
      // Must show posterior recession moving downward toward Hip
      let inferiorRecessionCm = 0;
      let inferiorStepCount = 0;
      let isStrictlyInferiorRecession = false;

      if (plateauEnd < segLen - 1) {
        const checkLimit = Math.min(segLen - 1, plateauEnd + 15);
        for (let s = plateauEnd + 1; s <= checkLimit; s += 1) {
          const diff = plateauMaxVal - segEnriched[s].rawAnteriorProjectionCm;
          if (diff > inferiorRecessionCm) {
            inferiorRecessionCm = diff;
          }
          if (diff >= minDomeRecessionCm) {
            inferiorStepCount = s - plateauEnd;
            if (inferiorStepCount >= minPersistenceSteps) {
              isStrictlyInferiorRecession = true;
              break;
            }
          }
        }
      }

      const isQualifiedDome = isStrictlySuperiorExpansion && isStrictlyInferiorRecession;

      if (isQualifiedDome) {
        const yValues = plateauMembers.map((m) => m.yCm);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        const midpointY = Number(((minY + maxY) / 2).toFixed(4));

        // Find the actual discrete candidate row closest to midpointY
        let bestRep = plateauMembers[0];
        let bestDist = Math.abs(bestRep.yCm - midpointY);
        for (let mIdx = 1; mIdx < plateauMembers.length; mIdx += 1) {
          const dist = Math.abs(plateauMembers[mIdx].yCm - midpointY);
          if (dist < bestDist) {
            bestDist = dist;
            bestRep = plateauMembers[mIdx];
          }
        }

        qualifiedDomes.push({
          domeId: `abdominal_dome_${qualifiedDomes.length + 1}`,
          segmentIndex: segIdx,
          startIndex: i,
          endIndex: plateauEnd,
          memberCount: plateauMembers.length,
          plateauMinYcm: minY,
          plateauMaxYcm: maxY,
          plateauYSpanCm: Number((maxY - minY).toFixed(4)),
          representativeYcm: bestRep.yCm,
          midpointYcm: midpointY,
          representativeCandidate: bestRep,
          maxRawAnteriorProjectionCm: plateauMaxVal,
          maxRawAnteriorUcm: isPositiveU ? plateauMaxVal : -plateauMaxVal,
          superiorExpansionCm: Number(superiorExpansionCm.toFixed(4)),
          inferiorRecessionCm: Number(inferiorRecessionCm.toFixed(4)),
          plateauMembers,
        });
      }

      i = plateauEnd + 1;
    }
  });

  // 11. Evaluate Qualified Domes & Dominance Selection
  if (qualifiedDomes.length === 0) {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.NO_ABDOMINAL_DOME_DETECTED);
    issues.push(`No qualifying abdominal dome exhibiting anterior expansion and posterior recession detected in window [${lowerYcm.toFixed(1)}, ${upperYcm.toFixed(1)}] cm.`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE,
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

  // Sort qualified domes by maximal raw anterior projection descending (most anterior first)
  qualifiedDomes.sort((a, b) => b.maxRawAnteriorProjectionCm - a.maxRawAnteriorProjectionCm);

  const topDome = qualifiedDomes[0];

  // 12. Check for Ambiguous Competing Domes (two separated domes with equal anterior projection within tieBreakToleranceCm)
  const competingDomes = qualifiedDomes.filter((d) =>
    d !== topDome
    && Math.abs(d.maxRawAnteriorProjectionCm - topDome.maxRawAnteriorProjectionCm) <= tieBreakToleranceCm
    && Math.abs(d.representativeYcm - topDome.representativeYcm) > 1.0
  );

  if (competingDomes.length > 0) {
    blockers.push(ABDOMINAL_POINT_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES);
    issues.push(`Detected ${competingDomes.length + 1} distinct competing abdominal domes of equal maximal anterior projection within ${tieBreakToleranceCm} cm tolerance.`);
    return buildEmptyLocalizationResult({
      status: ABDOMINAL_POINT_PLANE_STATUS.AMBIGUOUS,
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

  // 13. Extract Selected Abdomen Point Geometry
  const selectedCandidate = topDome.representativeCandidate;
  const selectedYcm = selectedCandidate.yCm;
  const selectedRasterRow = selectedCandidate.rasterRow ?? selectedCandidate.sideRasterRow;
  const selectedSideRasterRow = selectedCandidate.side?.rasterRow ?? selectedCandidate.sideRasterRow ?? selectedRasterRow;
  const selectedFrontRasterRow = selectedCandidate.front?.rasterRow ?? selectedCandidate.rasterRow ?? selectedRasterRow;

  const frontEvidence = {
    status: selectedCandidate.front?.status ?? (selectedCandidate.isFrontValid ? 'valid' : 'unavailable'),
    minXcm: selectedCandidate.front?.leftXcm ?? selectedCandidate.front?.minXcm ?? null,
    maxXcm: selectedCandidate.front?.rightXcm ?? selectedCandidate.front?.maxXcm ?? null,
    widthCm: selectedCandidate.front?.widthCm ?? null,
    rasterRow: selectedFrontRasterRow,
    isSingleSupportedRun: selectedCandidate.front?.isSingleSupportedRun ?? true,
    runCount: selectedCandidate.front?.runCount ?? 1,
    encounteredClassIds: [...(selectedCandidate.front?.encounteredClassIds ?? [])],
  };

  const sideEvidence = {
    status: selectedCandidate.side?.status ?? 'valid',
    minUcm: selectedCandidate.side?.minUcm ?? null,
    maxUcm: selectedCandidate.side?.maxUcm ?? null,
    profileSpanCm: selectedCandidate.side?.profileSpanCm ?? (selectedCandidate.side?.minUcm !== null && selectedCandidate.side?.maxUcm !== null ? Number((selectedCandidate.side.maxUcm - selectedCandidate.side.minUcm).toFixed(4)) : null),
    qualifiedApDepthCm: selectedCandidate.side?.qualifiedApDepthCm ?? selectedCandidate.side?.profileSpanCm ?? null,
    rasterRow: selectedSideRasterRow,
    rawAnteriorUcm: selectedCandidate.rawAnteriorU,
    rawPosteriorUcm: selectedCandidate.rawPosteriorU,
    isSingleSupportedRun: selectedCandidate.side?.isSingleSupportedRun ?? true,
    runCount: selectedCandidate.side?.runCount ?? 1,
    isQualified: selectedCandidate.side?.isQualified === true,
    depthQualificationStatus: selectedCandidate.side?.depthQualificationStatus ?? (selectedCandidate.side?.isQualified ? 'qualified' : 'unqualified'),
    encounteredClassIds: [...(selectedCandidate.side?.encounteredClassIds ?? [])],
  };

  const sliceHighlightCoordinates = {
    yCm: selectedYcm,
    frontRasterRow: selectedFrontRasterRow,
    sideRasterRow: selectedSideRasterRow,
    frontBoundsCm: (frontEvidence.minXcm !== null && frontEvidence.maxXcm !== null)
      ? { minX: frontEvidence.minXcm, maxX: frontEvidence.maxXcm }
      : null,
    sideBoundsCm: (sideEvidence.minUcm !== null && sideEvidence.maxUcm !== null)
      ? { minU: sideEvidence.minUcm, maxU: sideEvidence.maxUcm }
      : null,
  };

  const selectedPlateau = {
    plateauMinYcm: topDome.plateauMinYcm,
    plateauMaxYcm: topDome.plateauMaxYcm,
    plateauYSpanCm: topDome.plateauYSpanCm,
    midpointYcm: topDome.midpointYcm,
    representativeYcm: selectedYcm,
    memberCount: topDome.memberCount,
    maxRawAnteriorProjectionCm: topDome.maxRawAnteriorProjectionCm,
    maxRawAnteriorUcm: topDome.maxRawAnteriorUcm,
  };

  return {
    contract: ABDOMINAL_POINT_PLANE_CONTRACT,
    version: ABDOMINAL_POINT_PLANE_CONTRACT_VERSION,
    id: 'torso_abdominal_point_plane_localization_v1',
    name: 'Abdominal Point Plane Localization',
    status: ABDOMINAL_POINT_PLANE_STATUS.READY,
    yCm: selectedYcm,
    levelYcm: selectedYcm,
    rasterRow: selectedRasterRow,
    sideRasterRow: selectedSideRasterRow,
    selectionMethod: 'dominant_abdominal_dome_plateau_v1',
    searchWindow: {
      naturalWaistYcm: upperYcm,
      hipYcm: lowerYcm,
      spanCm: Number((upperYcm - lowerYcm).toFixed(4)),
      upperSource,
      lowerSource,
    },
    orientation: {
      status: 'ready',
      facingDirection,
      anteriorSide,
    },
    selectedDome: {
      domeId: topDome.domeId,
      maxRawAnteriorProjectionCm: topDome.maxRawAnteriorProjectionCm,
      maxRawAnteriorUcm: topDome.maxRawAnteriorUcm,
      superiorExpansionCm: topDome.superiorExpansionCm,
      inferiorRecessionCm: topDome.inferiorRecessionCm,
      plateauMinYcm: topDome.plateauMinYcm,
      plateauMaxYcm: topDome.plateauMaxYcm,
      representativeYcm: selectedYcm,
    },
    selectedPlateau,
    candidateCount: rawCandidates.length,
    searchCandidateCount: N,
    candidates: enrichedCandidates,
    domes: qualifiedDomes,
    frontEvidence,
    sideEvidence,
    provenance: {
      naturalWaistYcm: upperYcm,
      offsetBelowWaistCm: Number((upperYcm - selectedYcm).toFixed(4)),
      hipYcm: lowerYcm,
      elevationAboveHipCm: Number((selectedYcm - lowerYcm).toFixed(4)),
      totalCandidates: rawCandidates.length,
      searchCandidateCount: N,
      nominalSampleSpacingCm: Number(nominalSampleSpacingCm.toFixed(4)),
      smoothingWindowCm,
      smoothingRadiusSamples,
      tieBreakToleranceCm,
      minPersistenceSteps,
      minDomeExpansionCm,
      minDomeRecessionCm,
      supportPolicyId: torsoScanReport.supportPolicyId ?? 'trunk_pelvic_transition_support_v0',
      targetClassIds: Array.isArray(torsoScanReport.targetClassIds) ? [...torsoScanReport.targetClassIds] : [12, 13, 21, 22, 23],
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: scanStatus,
      sliceHighlightCoordinates,
    },
    semantics: {
      statement: 'Deterministic Abdominal Point Plane localization derived from the maximal anterior plateau of the dominant qualified abdominal dome between Natural Waist and Hip. Strictly conforms to ISO 18825-2 / ISO 8559-1 Abdomen Point ("most anterior point of the abdomen"). NOT baseline-relative prominence, NOT maximum AP depth, NOT maximum Front width, NOT maximum circumference, NOT 3D reconstruction.',
      isAbdominalPointPlaneCandidate: true,
      isModeledLocalization: true,
      isMostAnteriorAbdomenPoint: true,
      isMaximumApDepth: false,
      isCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

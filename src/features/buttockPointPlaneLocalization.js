/**
 * Buttock Point / Hip Girth Plane Localization Contract v1
 *
 * Pure deterministic domain contract that localizes the horizontal canonical-Y plane
 * corresponding to the ISO-aligned Buttock Point / Hip Level ("level of greatest posterior projection of the buttocks")
 * within the pelvic container bounded between the Abdomen Point Plane and the First Multi-Run Leg Split Boundary.
 *
 * Contract: 'buttock-point-plane-localization-v1'
 *
 * SEMANTIC PRINCIPLES (ISO 8559-1:2017 Clauses 3.1.14 & 5.3.13 / ISO 18825-2:2016 Clause 4.2.14 / ASTM D5219-15):
 * - Target Semantic: Hip Level is defined as the "level of greatest posterior projection of the buttocks"
 *   (on the midsagittal plane in the upright standing position). Hip Girth is the horizontal circumference at this level.
 * - Posterior buttock surface alone determines vertical Y elevation; anterior contour, Front transverse width,
 *   AP depth, and modeled perimeter do NOT determine Y.
 * - Maximum Seat / Maximum Hip Girth (ISO 8559-1 Clause 5.3.14) remains a separate, coexisting measurement (v0)
 *   maximizing total modeled circumference across the trochanteric region.
 * - Search Container: Strictly bounded between the ready Abdomen Point (superior anchor) and the first multi-run
 *   leg split boundary (inferior anchor).
 * - Pose Hip Landmark: Corroborative only; never copied directly as the Buttock Point result.
 * - Directionally invariant: Consumes side-anterior-posterior-orientation-v0 to normalize posterior projection
 *   regardless of whether the subject faces positive-U or negative-U.
 * - Translation invariant: Rigid translation along the Side U axis (U -> U + C) does not alter the selected Y elevation.
 * - Topological Buttock-Dome Qualification: Identifies candidate buttock domes exhibiting superior posterior expansion
 *   from the lumbar lordosis, a maximal raw posterior plateau, and inferior anterior recession toward the gluteal fold / leg split.
 *   (Persistence thresholds serve strictly for quantization noise rejection, NOT as physical protrusion amplitude rules).
 * - Raw Contour Authority: Physical Y, representative row, endpoints, and downstream width/depth are extracted strictly
 *   from raw calibrated contour evidence; smoothing is used solely for slope QA.
 * - Plateau Midpoint: Symmetric geometric midpoint of the raw maximal posterior plateau.
 * - Metric-Y Continuity: Strictly gap-aware; zero cross-gap smoothing, derivatives, or plateau merging.
 * - Disclaims 3D vertex reconstruction, camera extrinsics, and pointmap/normals dependencies.
 */

import { SIDE_ORIENTATION_STATUS, FACING_DIRECTION, SIDE_U_ENDPOINT } from './sideAnteriorPosteriorOrientation.js';
import { ABDOMINAL_POINT_PLANE_STATUS } from './abdominalPointPlaneLocalization.js';

export const BUTTOCK_POINT_PLANE_CONTRACT = 'buttock-point-plane-localization-v1';
export const BUTTOCK_POINT_PLANE_CONTRACT_VERSION = 'buttock-point-plane-localization-v1';
export const BUTTOCK_POINT_PLANE_DEFINITION_ID = 'torso_buttock_point_plane_localization_v1';
export const BUTTOCK_POINT_PLANE_DISPLAY_NAME = 'Buttock Point / Hip Girth Plane Localization';

/**
 * Authoritative 4-state localization status taxonomy.
 * @type {Readonly<{
 *   READY: 'ready',
 *   AMBIGUOUS: 'ambiguous',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const BUTTOCK_POINT_PLANE_STATUS = Object.freeze({
  READY: 'ready',
  AMBIGUOUS: 'ambiguous',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for Buttock Point plane localization v1.
 * @type {Readonly<Record<string, string>>}
 */
export const BUTTOCK_POINT_BLOCKER_CODES = Object.freeze({
  TORSO_SCAN_UNAVAILABLE: 'torso_scan_unavailable',
  ABDOMEN_POINT_UNAVAILABLE: 'abdomen_point_unavailable',
  SPLIT_BOUNDARY_UNAVAILABLE: 'split_boundary_unavailable',
  SIDE_ORIENTATION_UNAVAILABLE: 'side_orientation_unavailable',
  SIDE_VIEW_NOT_QUALIFIED: 'side_view_not_qualified',
  INVALID_SEARCH_WINDOW: 'invalid_search_window',
  INSUFFICIENT_SEARCH_ROWS: 'insufficient_search_rows',
  NO_BUTTOCK_DOME_DETECTED: 'no_buttock_dome_detected',
  AMBIGUOUS_MULTIPLE_BUTTOCK_DOMES: 'ambiguous_multiple_buttock_domes',
  INTERRUPTED_PLATEAU_EVIDENCE: 'interrupted_plateau_evidence',
  BOUNDARY_CONFOUNDED_APEX: 'boundary_confounded_apex',
  LUMBAR_IDENTITY_UNRESOLVED: 'lumbar_identity_unresolved',
  NON_FINITE_CANDIDATE_DATA: 'non_finite_candidate_data',
});

/**
 * Default parameters for Buttock Point neighborhood analysis and plateau detection.
 * Derived from physical sensor calibration (e.g. 10 px/cm => 0.10 cm raster pitch).
 */
export const DEFAULT_BUTTOCK_POINT_OPTIONS = Object.freeze({
  /** Sub-pixel numeric tolerance (cm) within which two candidate rows belong to the same maximal posterior pixel column. */
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
        const weight = (radius + 1) - Math.abs(offset);
        weightSum += weight;
        weightedValSum += values[idx] * weight;
      }
    }

    smoothed[i] = weightSum > 0 ? weightedValSum / weightSum : values[i];
  }

  return smoothed;
}

/**
 * Builds an empty or unavailable Buttock Point plane result object.
 */
function buildEmptyButtockPointResult({
  status = BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  searchWindow = null,
  provenance = {},
} = {}) {
  return {
    contract: BUTTOCK_POINT_PLANE_CONTRACT,
    version: BUTTOCK_POINT_PLANE_CONTRACT_VERSION,
    id: BUTTOCK_POINT_PLANE_DEFINITION_ID,
    name: BUTTOCK_POINT_PLANE_DISPLAY_NAME,
    status,
    yCm: null,
    levelYcm: null,
    rasterRow: null,
    sideRasterRow: null,
    searchWindow: searchWindow ? { ...searchWindow } : null,
    selectedPlateau: null,
    selectedDome: null,
    domes: [],
    frontEvidence: null,
    sideEvidence: null,
    provenance: {
      supportPolicyId: 'trunk_pelvic_transition_support_v0',
      targetClassIds: [12, 13, 21, 22, 23],
      sourceScanContract: 'torso-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: null,
      sliceHighlightCoordinates: null,
      ...provenance,
    },
    semantics: {
      statement: 'Deterministic Buttock Point Plane localization (v1) derived from raw Side posterior extremum within pelvic search container. Standard ISO 8559-1 Clause 3.1.14 / Clause 5.3.13 / ISO 18825-2 Hip Level. NOT Maximum Seat Girth (ISO 8559-1 Clause 5.3.14), NOT tape-measured ground truth, NOT 3D vertex reconstruction.',
      isStandardsAlignedHipGirthPlane: true,
      isButtockPointPlane: true,
      isMaximumSeatPlane: false,
      isModeledLocalization: true,
      isMeasuredCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

/**
 * Evaluates pure deterministic Buttock Point Plane Localization v1 from active runtime evidence.
 *
 * @param {{
 *   torsoScanReport?: object|null,
 *   pelvicScanReport?: object|null,
 *   abdomenPointReport?: object|null,
 *   abdominalPointReport?: object|null,
 *   lowerBoundaryEvidence?: object|null,
 *   splitReport?: object|null,
 *   sideOrientationReport?: object|null,
 *   levelsReport?: object|null,
 *   options?: object,
 * }} input
 * @returns {object} ButtockPointPlaneLocalizationResultV1
 */
export function evaluateButtockPointPlaneLocalization({
  torsoScanReport = null,
  pelvicScanReport = null,
  abdomenPointReport = null,
  abdominalPointReport = null,
  lowerBoundaryEvidence = null,
  splitReport = null,
  sideOrientationReport = null,
  levelsReport = null,
  options = {},
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const opts = {
    ...DEFAULT_BUTTOCK_POINT_OPTIONS,
    ...options,
  };

  const tieBreakToleranceCm = typeof opts.tieBreakToleranceCm === 'number' && opts.tieBreakToleranceCm >= 0
    ? opts.tieBreakToleranceCm
    : DEFAULT_BUTTOCK_POINT_OPTIONS.tieBreakToleranceCm;

  const minPersistenceSteps = typeof opts.minPersistenceSteps === 'number' && opts.minPersistenceSteps >= 1
    ? opts.minPersistenceSteps
    : DEFAULT_BUTTOCK_POINT_OPTIONS.minPersistenceSteps;

  const minDomeExpansionCm = typeof opts.minDomeExpansionCm === 'number' && opts.minDomeExpansionCm >= 0
    ? opts.minDomeExpansionCm
    : DEFAULT_BUTTOCK_POINT_OPTIONS.minDomeExpansionCm;

  const minDomeRecessionCm = typeof opts.minDomeRecessionCm === 'number' && opts.minDomeRecessionCm >= 0
    ? opts.minDomeRecessionCm
    : DEFAULT_BUTTOCK_POINT_OPTIONS.minDomeRecessionCm;

  const smoothingWindowCm = typeof opts.smoothingWindowCm === 'number' && opts.smoothingWindowCm > 0
    ? opts.smoothingWindowCm
    : DEFAULT_BUTTOCK_POINT_OPTIONS.smoothingWindowCm;

  // 1. Resolve Side Orientation
  if (!sideOrientationReport || typeof sideOrientationReport !== 'object') {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE);
    issues.push('Side anterior-posterior orientation report is missing or null.');
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues });
  }

  const isOrientationQualified = sideOrientationReport.status === SIDE_ORIENTATION_STATUS.READY
    || sideOrientationReport.status === 'qualified'
    || sideOrientationReport.isQualified === true;
  const anteriorSide = sideOrientationReport.anteriorSide
    ?? (sideOrientationReport.facingDirection === FACING_DIRECTION.NEGATIVE_U ? SIDE_U_ENDPOINT.MIN_U : SIDE_U_ENDPOINT.MAX_U);

  if (!isOrientationQualified || (anteriorSide !== SIDE_U_ENDPOINT.MIN_U && anteriorSide !== SIDE_U_ENDPOINT.MAX_U)) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.SIDE_VIEW_NOT_QUALIFIED);
    issues.push(`Side orientation is not qualified (status: '${sideOrientationReport.status}', anteriorSide: '${anteriorSide}').`);
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues });
  }

  const isAnteriorMinU = anteriorSide === SIDE_U_ENDPOINT.MIN_U;

  // 2. Resolve Scan Report (Torso scan preferred, or pelvic scan, or both combined)
  const scanReport = torsoScanReport ?? pelvicScanReport;
  if (!scanReport || typeof scanReport !== 'object') {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push('Scan report (torso or pelvic arbitrary-Y evidence) is missing or null.');
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues });
  }

  const scanStatus = scanReport.status;
  if (scanStatus !== 'completed' && scanStatus !== 'partial') {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push(`Scan status is '${scanStatus}' (not completed or partial).`);
    return buildEmptyButtockPointResult({
      status: scanStatus === 'invalid' ? BUTTOCK_POINT_PLANE_STATUS.INVALID : BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const candidatesMap = new Map();
  if (torsoScanReport && Array.isArray(torsoScanReport.candidates)) {
    for (const c of torsoScanReport.candidates) {
      if (typeof c?.yCm === 'number') candidatesMap.set(Number(c.yCm.toFixed(4)), c);
    }
  }
  if (pelvicScanReport && Array.isArray(pelvicScanReport.candidates)) {
    for (const c of pelvicScanReport.candidates) {
      if (typeof c?.yCm === 'number') candidatesMap.set(Number(c.yCm.toFixed(4)), c);
    }
  }

  const allCandidates = Array.from(candidatesMap.values());
  allCandidates.sort((a, b) => b.yCm - a.yCm);

  if (allCandidates.length === 0) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push('Scan report contains 0 candidate rows.');
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues });
  }

  // 3. Resolve Search Boundaries:
  // Upper: Abdomen Point Y (or provided fallback)
  const resolvedAbdomenReport = abdomenPointReport ?? abdominalPointReport;
  let superiorBoundY = null;
  let superiorSource = 'abdomen_point_report';

  if (
    resolvedAbdomenReport
    && (resolvedAbdomenReport.status === 'ready' || resolvedAbdomenReport.status === 'valid')
    && typeof resolvedAbdomenReport.yCm === 'number'
    && Number.isFinite(resolvedAbdomenReport.yCm)
  ) {
    superiorBoundY = resolvedAbdomenReport.yCm;
  } else if (typeof options?.superiorBoundYcm === 'number' && Number.isFinite(options.superiorBoundYcm)) {
    superiorBoundY = options.superiorBoundYcm;
    superiorSource = 'options_superior_bound';
  }

  if (typeof superiorBoundY !== 'number' || !Number.isFinite(superiorBoundY)) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.ABDOMEN_POINT_UNAVAILABLE);
    issues.push("Superior search boundary (Abdomen Point Y) is unavailable or not ready.");
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues });
  }

  // Lower: First Multi-Run Split Boundary
  let inferiorBoundY = null;
  let inferiorSource = 'split_boundary_evidence';

  const resolvedLowerBoundary = lowerBoundaryEvidence ?? splitReport ?? scanReport.lowerBoundaryEvidence ?? pelvicScanReport?.lowerBoundaryEvidence;

  if (
    resolvedLowerBoundary
    && typeof resolvedLowerBoundary.firstSplitYcm === 'number'
    && Number.isFinite(resolvedLowerBoundary.firstSplitYcm)
  ) {
    inferiorBoundY = resolvedLowerBoundary.firstSplitYcm;
  } else if (typeof options?.inferiorBoundYcm === 'number' && Number.isFinite(options.inferiorBoundYcm)) {
    inferiorBoundY = options.inferiorBoundYcm;
    inferiorSource = 'options_inferior_bound';
  } else {
    // If not explicitly provided in lowerBoundaryEvidence, inspect candidates downward for first multi-run split
    for (const c of allCandidates) {
      if (c.yCm < superiorBoundY && c.front && c.front.runCount > 1) {
        inferiorBoundY = c.yCm;
        inferiorSource = 'candidate_front_split_detection';
        break;
      }
    }
  }

  if (typeof inferiorBoundY !== 'number' || !Number.isFinite(inferiorBoundY)) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.SPLIT_BOUNDARY_UNAVAILABLE);
    issues.push("Inferior search boundary (First leg split boundary Y) is unavailable.");
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues });
  }

  if (inferiorBoundY >= superiorBoundY) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.INVALID_SEARCH_WINDOW);
    issues.push(`Search window interval is inverted: inferiorBoundY (${inferiorBoundY} cm) >= superiorBoundY (${superiorBoundY} cm).`);
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.INVALID, blockers, warnings, issues });
  }

  // Corroborative Pose Hip Landmark
  const poseHipLevel = levelsReport?.levels?.find((l) => l.id === 'hip') ?? null;
  const poseHipYcm = (poseHipLevel && poseHipLevel.status === 'ready' && typeof poseHipLevel.yCm === 'number')
    ? poseHipLevel.yCm
    : null;

  const searchWindow = {
    superiorBoundYcm: Number(superiorBoundY.toFixed(4)),
    inferiorBoundYcm: Number(inferiorBoundY.toFixed(4)),
    spanCm: Number((superiorBoundY - inferiorBoundY).toFixed(4)),
    superiorSource,
    inferiorSource,
    corroborativePoseHipYcm: poseHipYcm !== null ? Number(poseHipYcm.toFixed(4)) : null,
  };

  // 4. Filter Candidates strictly within the Search Window
  const windowCandidates = [];
  for (const c of allCandidates) {
    if (typeof c.yCm !== 'number' || !Number.isFinite(c.yCm)) {
      blockers.push(BUTTOCK_POINT_BLOCKER_CODES.NON_FINITE_CANDIDATE_DATA);
      issues.push(`Non-finite Y coordinate encountered at raster row ${c.rasterRow}.`);
      return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.INVALID, blockers, warnings, issues, searchWindow });
    }

    if (c.yCm > inferiorBoundY && c.yCm < superiorBoundY) {
      const side = c.side;
      if (side && side.status === 'valid' && (side.isSingleSupportedRun === true || side.runCount === 1)) {
        if (
          typeof side.minUcm === 'number' && Number.isFinite(side.minUcm)
          && typeof side.maxUcm === 'number' && Number.isFinite(side.maxUcm)
          && side.maxUcm >= side.minUcm
        ) {
          const rawPosteriorU = isAnteriorMinU ? side.maxUcm : side.minUcm;
          const rawAnteriorU = isAnteriorMinU ? side.minUcm : side.maxUcm;
          const rawPosteriorProjectionCm = isAnteriorMinU ? side.maxUcm : -side.minUcm;

          windowCandidates.push({
            ...c,
            rawPosteriorU,
            rawAnteriorU,
            rawPosteriorProjectionCm,
          });
        }
      }
    }
  }

  // Sort descending by Y (superior to inferior: cephalad to caudad)
  windowCandidates.sort((a, b) => b.yCm - a.yCm);

  const N = windowCandidates.length;
  if (N < Math.max(3, minPersistenceSteps * 2 + 1)) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS);
    issues.push(`Insufficient eligible candidate rows inside pelvic search window (${N} rows found).`);
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues, searchWindow });
  }

  // 5. Partition into Continuous Metric Segments
  const nominalSampleSpacingCm = N >= 2
    ? Math.abs(windowCandidates[0].yCm - windowCandidates[N - 1].yCm) / (N - 1)
    : 0.10;
  const maxContinuousSampleSpacingCm = Math.max(0.35, nominalSampleSpacingCm * 3.0);

  const segments = [];
  let currentSegment = [];
  for (let i = 0; i < N; i += 1) {
    if (i === 0) {
      currentSegment.push(windowCandidates[i]);
    } else {
      const stepDeltaY = Math.abs(windowCandidates[i - 1].yCm - windowCandidates[i].yCm);
      if (stepDeltaY > maxContinuousSampleSpacingCm) {
        segments.push(currentSegment);
        currentSegment = [windowCandidates[i]];
      } else {
        currentSegment.push(windowCandidates[i]);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  const smoothingRadiusSamples = typeof opts.smoothingRadiusRows === 'number' && opts.smoothingRadiusRows >= 0
    ? opts.smoothingRadiusRows
    : Math.max(1, Math.round((smoothingWindowCm / 2) / nominalSampleSpacingCm));

  // 6. Process Continuous Segments & Identify Qualified Buttock Domes
  const enrichedCandidates = [];
  const qualifiedDomes = [];

  segments.forEach((seg, segIdx) => {
    const rawVals = seg.map((r) => r.rawPosteriorProjectionCm);
    const smoothedVals = seg.length >= 3
      ? applySymmetricSmoothing(rawVals, smoothingRadiusSamples)
      : [...rawVals];

    const segEnriched = seg.map((r, inSegIdx) => {
      const smoothedNorm = smoothedVals[inSegIdx];
      const smoothedPosteriorU = isAnteriorMinU ? smoothedNorm : -smoothedNorm;

      return {
        ...r,
        segmentIndex: segIdx,
        indexInSegment: inSegIdx,
        indexInEnriched: enrichedCandidates.length + inSegIdx,
        rawPosteriorProjectionCm: r.rawPosteriorProjectionCm,
        smoothedPosteriorProjectionCm: smoothedNorm,
        smoothedPosteriorUcm: Number(smoothedPosteriorU.toFixed(4)),
      };
    });

    enrichedCandidates.push(...segEnriched);

    const segLen = segEnriched.length;
    if (segLen < 3) return;

    // Identify local maxima / plateaus in raw posterior series within the segment
    // Candidates are sorted descending by Y (index 0 is superior, index segLen-1 is inferior)
    let i = 0;
    while (i < segLen) {
      const currentVal = segEnriched[i].rawPosteriorProjectionCm;

      // Find extent of contiguous plateau within tieBreakToleranceCm
      let plateauEnd = i;
      while (
        plateauEnd + 1 < segLen
        && Math.abs(segEnriched[plateauEnd + 1].rawPosteriorProjectionCm - currentVal) <= tieBreakToleranceCm
      ) {
        plateauEnd += 1;
      }

      const plateauMembers = segEnriched.slice(i, plateauEnd + 1);
      const plateauMaxVal = Math.max(...plateauMembers.map((m) => m.rawPosteriorProjectionCm));

      // Check superior side (indices < i, which have higher Y)
      // Must show posterior expansion moving downward from lumbar lordosis towards the plateau
      let superiorExpansionCm = 0;
      let superiorStepCount = 0;
      let isStrictlySuperiorExpansion = false;

      if (i > 0) {
        const checkLimit = Math.max(0, i - 15);
        for (let s = i - 1; s >= checkLimit; s -= 1) {
          const diff = plateauMaxVal - segEnriched[s].rawPosteriorProjectionCm;
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
      // Must show anterior recession moving downward toward gluteal fold / leg split
      let inferiorRecessionCm = 0;
      let inferiorStepCount = 0;
      let isStrictlyInferiorRecession = false;

      if (plateauEnd < segLen - 1) {
        const checkLimit = Math.min(segLen - 1, plateauEnd + 15);
        for (let s = plateauEnd + 1; s <= checkLimit; s += 1) {
          const diff = plateauMaxVal - segEnriched[s].rawPosteriorProjectionCm;
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
          domeId: `buttock_dome_${qualifiedDomes.length + 1}`,
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
          maxRawPosteriorProjectionCm: plateauMaxVal,
          maxRawPosteriorUcm: isAnteriorMinU ? plateauMaxVal : -plateauMaxVal,
          superiorExpansionCm: Number(superiorExpansionCm.toFixed(4)),
          inferiorRecessionCm: Number(inferiorRecessionCm.toFixed(4)),
          plateauMembers,
        });
      }

      i = plateauEnd + 1;
    }
  });

  // 7. Dome Qualification & Dominance Selection
  if (qualifiedDomes.length === 0) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.NO_BUTTOCK_DOME_DETECTED);
    issues.push('No qualified posterior buttock dome found in search container satisfying expansion and recession criteria.');
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE, blockers, warnings, issues, searchWindow });
  }

  // Sort domes descending by maximal raw posterior projection
  qualifiedDomes.sort((a, b) => b.maxRawPosteriorProjectionCm - a.maxRawPosteriorProjectionCm);

  const bestDome = qualifiedDomes[0];

  // Check for competing ambiguous domes within tieBreakToleranceCm
  if (qualifiedDomes.length > 1) {
    const secondBest = qualifiedDomes[1];
    const diff = Math.abs(bestDome.maxRawPosteriorProjectionCm - secondBest.maxRawPosteriorProjectionCm);
    if (diff <= tieBreakToleranceCm && Math.abs(bestDome.representativeYcm - secondBest.representativeYcm) > 1.0) {
      blockers.push(BUTTOCK_POINT_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_BUTTOCK_DOMES);
      issues.push(`Multiple qualified buttock domes with identical peak posterior projection within ${tieBreakToleranceCm} cm (Domes at Y=${bestDome.representativeYcm} cm and Y=${secondBest.representativeYcm} cm).`);
      return buildEmptyButtockPointResult({
        status: BUTTOCK_POINT_PLANE_STATUS.AMBIGUOUS,
        blockers,
        warnings,
        issues,
        searchWindow,
        provenance: { detectedDomesCount: qualifiedDomes.length },
      });
    }
  }

  // 8. Boundary Maximum Rejection
  const firstCandY = windowCandidates[0].yCm;
  const lastCandY = windowCandidates[windowCandidates.length - 1].yCm;

  if (
    Math.abs(bestDome.plateauMaxYcm - firstCandY) < 1e-4
    || Math.abs(bestDome.plateauMinYcm - lastCandY) < 1e-4
  ) {
    blockers.push(BUTTOCK_POINT_BLOCKER_CODES.BOUNDARY_CONFOUNDED_APEX);
    issues.push('Maximal posterior coordinate occurred exactly at the boundary of the search container; dome cannot be confirmed as anatomical apex.');
    return buildEmptyButtockPointResult({ status: BUTTOCK_POINT_PLANE_STATUS.AMBIGUOUS, blockers, warnings, issues, searchWindow });
  }

  // 9. Extract Final Evidence at Selected Representative Candidate
  const selectedRep = bestDome.representativeCandidate;
  const selectedYcm = Number(selectedRep.yCm.toFixed(4));
  const selectedRasterRow = selectedRep.rasterRow;
  const selectedSideRasterRow = selectedRep.side?.rasterRow ?? selectedRasterRow;

  const front = selectedRep.front ?? null;
  const side = selectedRep.side ?? null;

  const frontWidthCm = front && typeof front.widthCm === 'number' ? Number(front.widthCm.toFixed(4)) : null;
  const frontMinXcm = front && typeof front.minXcm === 'number' ? Number(front.minXcm.toFixed(4)) : null;
  const frontMaxXcm = front && typeof front.maxXcm === 'number' ? Number(front.maxXcm.toFixed(4)) : null;
  const isFrontValid = front && front.status === 'valid' && (front.isSingleSupportedRun === true || front.runCount === 1);

  const sideQualifiedApDepthCm = side && typeof side.qualifiedApDepthCm === 'number'
    ? Number(side.qualifiedApDepthCm.toFixed(4))
    : null;
  const sideProfileSpanCm = side && typeof side.profileSpanCm === 'number'
    ? Number(side.profileSpanCm.toFixed(4))
    : null;
  const sideMinUcm = side && typeof side.minUcm === 'number' ? Number(side.minUcm.toFixed(4)) : null;
  const sideMaxUcm = side && typeof side.maxUcm === 'number' ? Number(side.maxUcm.toFixed(4)) : null;
  const rawPosteriorUcm = isAnteriorMinU ? sideMaxUcm : sideMinUcm;
  const rawAnteriorUcm = isAnteriorMinU ? sideMinUcm : sideMaxUcm;

  const isSideValid = side && side.status === 'valid' && (side.isSingleSupportedRun === true || side.runCount === 1);

  const selectedPlateau = {
    plateauMinYcm: bestDome.plateauMinYcm,
    plateauMaxYcm: bestDome.plateauMaxYcm,
    plateauYSpanCm: bestDome.plateauYSpanCm,
    midpointYcm: bestDome.midpointYcm,
    representativeYcm: selectedYcm,
    memberCount: bestDome.memberCount,
    maxRawPosteriorProjectionCm: bestDome.maxRawPosteriorProjectionCm,
    maxRawPosteriorUcm: bestDome.maxRawPosteriorUcm,
  };

  const frontEvidence = {
    status: isFrontValid ? 'valid' : (front?.status ?? 'unavailable'),
    minXcm: frontMinXcm,
    maxXcm: frontMaxXcm,
    widthCm: frontWidthCm,
    rasterRow: front?.rasterRow ?? selectedRasterRow,
    isSingleSupportedRun: front?.isSingleSupportedRun ?? false,
    runCount: front?.runCount ?? 0,
    encounteredClassIds: Array.isArray(front?.encounteredClassIds) ? [...front.encounteredClassIds] : [],
  };

  const sideEvidence = {
    status: isSideValid ? 'valid' : (side?.status ?? 'unavailable'),
    minUcm: sideMinUcm,
    maxUcm: sideMaxUcm,
    profileSpanCm: sideProfileSpanCm,
    qualifiedApDepthCm: sideQualifiedApDepthCm,
    rasterRow: selectedSideRasterRow,
    rawAnteriorUcm,
    rawPosteriorUcm,
    isSingleSupportedRun: side?.isSingleSupportedRun ?? false,
    runCount: side?.runCount ?? 0,
    isQualified: side?.isQualified === true,
    depthQualificationStatus: side?.depthQualificationStatus ?? side?.qualificationStatus ?? 'evaluated',
    encounteredClassIds: Array.isArray(side?.encounteredClassIds) ? [...side.encounteredClassIds] : [],
  };

  const sliceHighlightCoordinates = {
    yCm: selectedYcm,
    frontRasterRow: selectedRasterRow,
    sideRasterRow: selectedSideRasterRow,
    frontBoundsCm: (frontMinXcm !== null && frontMaxXcm !== null) ? { minX: frontMinXcm, maxX: frontMaxXcm } : null,
    sideBoundsCm: (sideMinUcm !== null && sideMaxUcm !== null) ? { minU: sideMinUcm, maxU: sideMaxUcm } : null,
  };

  return {
    contract: BUTTOCK_POINT_PLANE_CONTRACT,
    version: BUTTOCK_POINT_PLANE_CONTRACT_VERSION,
    id: BUTTOCK_POINT_PLANE_DEFINITION_ID,
    name: BUTTOCK_POINT_PLANE_DISPLAY_NAME,
    status: BUTTOCK_POINT_PLANE_STATUS.READY,
    yCm: selectedYcm,
    levelYcm: selectedYcm,
    rasterRow: selectedRasterRow,
    sideRasterRow: selectedSideRasterRow,
    searchWindow,
    selectedPlateau,
    selectedDome: {
      domeId: bestDome.domeId,
      maxRawPosteriorProjectionCm: bestDome.maxRawPosteriorProjectionCm,
      maxRawPosteriorUcm: bestDome.maxRawPosteriorUcm,
      superiorExpansionCm: bestDome.superiorExpansionCm,
      inferiorRecessionCm: bestDome.inferiorRecessionCm,
      plateauMinYcm: bestDome.plateauMinYcm,
      plateauMaxYcm: bestDome.plateauMaxYcm,
      representativeYcm: selectedYcm,
    },
    domes: qualifiedDomes.map((d) => ({
      domeId: d.domeId,
      maxRawPosteriorProjectionCm: d.maxRawPosteriorProjectionCm,
      maxRawPosteriorUcm: d.maxRawPosteriorUcm,
      superiorExpansionCm: d.superiorExpansionCm,
      inferiorRecessionCm: d.inferiorRecessionCm,
      representativeYcm: d.representativeYcm,
    })),
    frontEvidence,
    sideEvidence,
    provenance: {
      supportPolicyId: 'trunk_pelvic_transition_support_v0',
      targetClassIds: [12, 13, 21, 22, 23],
      sourceScanContract: scanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: scanStatus,
      sliceHighlightCoordinates,
      corroborativePoseHipDeltaYcm: poseHipYcm !== null ? Number((selectedYcm - poseHipYcm).toFixed(4)) : null,
    },
    semantics: {
      statement: 'Deterministic Buttock Point Plane localization (v1) derived from raw Side posterior extremum within pelvic search container. Standard ISO 8559-1 Clause 3.1.14 / Clause 5.3.13 / ISO 18825-2 Hip Level. NOT Maximum Seat Girth (ISO 8559-1 Clause 5.3.14), NOT tape-measured ground truth, NOT 3D vertex reconstruction.',
      isStandardsAlignedHipGirthPlane: true,
      isButtockPointPlane: true,
      isMaximumSeatPlane: false,
      isModeledLocalization: true,
      isMeasuredCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

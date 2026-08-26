/**
 * Maximum Seat Plane Localization Contract v0
 *
 * Pure deterministic domain contract that localizes the Maximum Seat Plane candidate
 * from a completed Pelvic Arbitrary-Y Evidence Scan report using the modeled perimeter
 * ranking curve and topological eligibility guardrails.
 *
 * Contract: 'maximum-seat-plane-localization-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence-driven localization: evaluates the cross-section modeled perimeter curve
 *   across eligible candidate rows without arbitrarily picking largest raw Front width
 *   or largest raw Side depth alone.
 * - Eligible candidates must:
 *   1. Be within the pelvic scan interval before the first Front multi-run split transition.
 *   2. Have valid Front single supported connected run (runCount === 1).
 *   3. Have legitimately qualified Side AP depth (isQualified === true).
 *   4. Have a finite positive modeled perimeter ranking score (> 0).
 * - Upper_Leg segmentation classes ([12, 21]) alone do NOT invalidate an otherwise eligible row
 *   (they naturally participate near the inferior gluteal / upper-thigh transition).
 * - Multi-row maximum plateaus are detected using stored precision tolerance and resolved
 *   to the deterministic plateau center index: Math.floor((rowCount - 1) / 2).
 * - Zero fixed anthropometric offsets (no fixed cm below hip, no fixed cm above split,
 *   no percentage of stature).
 * - Zero smoothing/window heuristics (no arbitrary 3-point/5-point averaging windows).
 * - Semantics: Pure modeled Maximum Seat Plane candidate level for future Hip Circumference.
 *   It is NOT measured circumference, NOT final anthropometric Hip Circumference, and
 *   NOT 3D slice reconstruction.
 */

export const MAXIMUM_SEAT_PLANE_CONTRACT = 'maximum-seat-plane-localization-v0';
export const MAXIMUM_SEAT_PLANE_CONTRACT_VERSION = 'maximum-seat-plane-localization-v0';

/**
 * Authoritative localization status taxonomy.
 * @type {Readonly<{
 *   LOCALIZED: 'localized',
 *   UNAVAILABLE: 'unavailable',
 *   BLOCKED: 'blocked',
 *   INVALID: 'invalid',
 * }>}
 */
export const MAXIMUM_SEAT_PLANE_STATUS = Object.freeze({
  LOCALIZED: 'localized',
  UNAVAILABLE: 'unavailable',
  BLOCKED: 'blocked',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for maximum seat plane localization.
 * @type {Readonly<Record<string, string>>}
 */
export const MAXIMUM_SEAT_PLANE_BLOCKER_CODES = Object.freeze({
  PELVIC_SCAN_UNAVAILABLE: 'pelvic_scan_unavailable',
  NO_ELIGIBLE_CANDIDATES: 'no_eligible_candidates',
  INVALID_PELVIC_SCAN: 'invalid_pelvic_scan',
});

/**
 * Stored numeric precision tolerance for plateau grouping (0.001 cm = 1e-3 cm).
 */
export const DEFAULT_PLATEAU_SCORE_TOLERANCE_CM = 1e-3;

/**
 * Checks whether a candidate row satisfies all strict eligibility rules to participate
 * in Maximum Seat Plane localization.
 *
 * @param {object|null|undefined} candidate - Candidate record from pelvicArbitraryYEvidenceScan
 * @param {{ firstSplitRow?: number|null }} [context] - Context with detected split transition row
 * @returns {boolean}
 */
export function isSeatPlaneCandidateEligible(candidate, { firstSplitRow = null } = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  // 1. Must occur strictly before the first detected multi-run split transition
  if (typeof firstSplitRow === 'number' && Number.isInteger(firstSplitRow)) {
    if (candidate.rasterRow >= firstSplitRow) {
      return false;
    }
  }

  // 2. Front evidence must be valid with a single supported connected run
  const front = candidate.front;
  if (!front || front.status !== 'valid' || front.isSingleSupportedRun !== true || front.runCount !== 1) {
    return false;
  }
  if (typeof front.widthCm !== 'number' || !Number.isFinite(front.widthCm) || front.widthCm <= 0) {
    return false;
  }

  // 3. Side evidence must have a legitimately qualified AP depth estimate
  const side = candidate.side;
  if (!side || side.isQualified !== true) {
    return false;
  }
  if (typeof side.qualifiedApDepthCm !== 'number' || !Number.isFinite(side.qualifiedApDepthCm) || side.qualifiedApDepthCm <= 0) {
    return false;
  }

  // 4. Modeled perimeter score must be a finite positive number
  if (
    typeof candidate.modeledPerimeterScoreCm !== 'number'
    || !Number.isFinite(candidate.modeledPerimeterScoreCm)
    || candidate.modeledPerimeterScoreCm <= 0
  ) {
    return false;
  }

  return true;
}

/**
 * Builds an empty/fallback localization result.
 */
function buildEmptyLocalizationResult({
  status = MAXIMUM_SEAT_PLANE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  hipAnchorYcm = null,
  firstSplitYcm = null,
  totalCandidateCount = 0,
  eligibleCandidateCount = 0,
  sourceScanContract = 'pelvic-arbitrary-y-evidence-scan-v0',
} = {}) {
  return {
    contract: MAXIMUM_SEAT_PLANE_CONTRACT,
    version: MAXIMUM_SEAT_PLANE_CONTRACT_VERSION,
    status,
    selectedYcm: null,
    selectedRasterRow: null,
    selectionMethod: 'plateau_center_v0',
    peakScoreCm: null,
    plateau: {
      startYcm: null,
      endYcm: null,
      startRow: null,
      endRow: null,
      rowCount: 0,
      candidates: [],
    },
    selectedCandidate: null,
    provenance: {
      hipAnchorYcm,
      offsetBelowHipCm: null,
      firstSplitYcm,
      clearanceAboveFirstSplitCm: null,
      totalCandidateCount,
      eligibleCandidateCount,
      sourceScanContract,
      sliceHighlightCoordinates: null,
    },
    semantics: {
      statement: 'Deterministic Maximum Seat Plane localization candidate derived from pelvic arbitrary-Y modeled perimeter ranking curve. NOT measured circumference, NOT final anthropometric Hip Circumference, NOT 3D slice reconstruction.',
      isMaximumSeatPlaneCandidate: true,
      isModeledLocalization: true,
      isMeasuredCircumference: false,
      isAnthropometricHipCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

/**
 * Evaluates pure deterministic Maximum Seat Plane Localization from a completed
 * Pelvic Arbitrary-Y Evidence Scan report.
 *
 * @param {object|null|undefined} pelvicScanReport - Result of evaluatePelvicArbitraryYEvidenceScan
 * @param {{
 *   plateauScoreToleranceCm?: number,
 * }} [options]
 * @returns {object} MaximumSeatPlaneLocalizationResultV0
 */
export function evaluateMaximumSeatPlaneLocalization(pelvicScanReport, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const plateauScoreToleranceCm = typeof options?.plateauScoreToleranceCm === 'number' && options.plateauScoreToleranceCm >= 0
    ? options.plateauScoreToleranceCm
    : DEFAULT_PLATEAU_SCORE_TOLERANCE_CM;

  // 1. Validate Input Pelvic Scan Report
  if (!pelvicScanReport || typeof pelvicScanReport !== 'object') {
    blockers.push(MAXIMUM_SEAT_PLANE_BLOCKER_CODES.PELVIC_SCAN_UNAVAILABLE);
    issues.push('Pelvic arbitrary-Y evidence scan report is missing or null.');
    return buildEmptyLocalizationResult({
      status: MAXIMUM_SEAT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const scanStatus = pelvicScanReport.status;
  const isScanUsable = scanStatus === 'completed' || scanStatus === 'partial';

  if (!isScanUsable) {
    blockers.push(MAXIMUM_SEAT_PLANE_BLOCKER_CODES.PELVIC_SCAN_UNAVAILABLE);
    issues.push(`Pelvic arbitrary-Y evidence scan status is '${scanStatus}' (not completed or partial).`);
    return buildEmptyLocalizationResult({
      status: scanStatus === 'invalid' ? MAXIMUM_SEAT_PLANE_STATUS.INVALID : MAXIMUM_SEAT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      sourceScanContract: pelvicScanReport.contract ?? 'pelvic-arbitrary-y-evidence-scan-v0',
      hipAnchorYcm: pelvicScanReport.upperBound?.yCm ?? null,
      firstSplitYcm: pelvicScanReport.lowerBoundaryEvidence?.firstSplitYcm ?? null,
      totalCandidateCount: pelvicScanReport.candidateCount ?? 0,
    });
  }

  const rawCandidates = Array.isArray(pelvicScanReport.candidates) ? pelvicScanReport.candidates : [];
  const firstSplitRow = pelvicScanReport.lowerBoundaryEvidence?.firstSplitRow ?? null;
  const firstSplitYcm = pelvicScanReport.lowerBoundaryEvidence?.firstSplitYcm ?? null;
  const hipAnchorYcm = pelvicScanReport.upperBound?.yCm ?? null;

  if (rawCandidates.length === 0) {
    blockers.push(MAXIMUM_SEAT_PLANE_BLOCKER_CODES.NO_ELIGIBLE_CANDIDATES);
    issues.push('Pelvic scan report contains 0 candidate rows.');
    return buildEmptyLocalizationResult({
      status: MAXIMUM_SEAT_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      hipAnchorYcm,
      firstSplitYcm,
      totalCandidateCount: 0,
    });
  }

  // 2. Filter Eligible Candidates
  const eligibleCandidates = rawCandidates.filter((c) => isSeatPlaneCandidateEligible(c, { firstSplitRow }));

  if (eligibleCandidates.length === 0) {
    blockers.push(MAXIMUM_SEAT_PLANE_BLOCKER_CODES.NO_ELIGIBLE_CANDIDATES);
    issues.push('No candidate rows satisfied the seat plane eligibility criteria (valid Front single run, qualified Side AP depth, before split boundary).');
    return buildEmptyLocalizationResult({
      status: MAXIMUM_SEAT_PLANE_STATUS.BLOCKED,
      blockers,
      warnings,
      issues,
      hipAnchorYcm,
      firstSplitYcm,
      totalCandidateCount: rawCandidates.length,
      eligibleCandidateCount: 0,
    });
  }

  // 3. Find Maximum Modeled Perimeter Score
  let peakScoreCm = -Infinity;
  for (const c of eligibleCandidates) {
    if (c.modeledPerimeterScoreCm > peakScoreCm) {
      peakScoreCm = c.modeledPerimeterScoreCm;
    }
  }

  // 4. Detect Maximum Score Plateaus
  const plateaus = [];
  let currentPlateau = [];

  for (const c of eligibleCandidates) {
    const isAtPeak = Math.abs(c.modeledPerimeterScoreCm - peakScoreCm) <= plateauScoreToleranceCm;
    if (isAtPeak) {
      currentPlateau.push(c);
    } else if (currentPlateau.length > 0) {
      plateaus.push(currentPlateau);
      currentPlateau = [];
    }
  }
  if (currentPlateau.length > 0) {
    plateaus.push(currentPlateau);
  }

  if (plateaus.length === 0) {
    blockers.push(MAXIMUM_SEAT_PLANE_BLOCKER_CODES.NO_ELIGIBLE_CANDIDATES);
    issues.push('Failed to isolate maximum score plateau from eligible candidates.');
    return buildEmptyLocalizationResult({
      status: MAXIMUM_SEAT_PLANE_STATUS.BLOCKED,
      blockers,
      warnings,
      issues,
      hipAnchorYcm,
      firstSplitYcm,
      totalCandidateCount: rawCandidates.length,
      eligibleCandidateCount: eligibleCandidates.length,
    });
  }

  // Select the primary maximum plateau (longest contiguous run of peak scores)
  const selectedPlateau = plateaus.reduce((best, curr) => {
    if (!best) return curr;
    if (curr.length > best.length) return curr;
    return best;
  }, null);

  const plateauStartRow = selectedPlateau[0].rasterRow;
  const plateauEndRow = selectedPlateau[selectedPlateau.length - 1].rasterRow;
  const plateauStartYcm = selectedPlateau[0].yCm;
  const plateauEndYcm = selectedPlateau[selectedPlateau.length - 1].yCm;
  const plateauRowCount = selectedPlateau.length;

  // 5. Select Representative Seat Plane: Center of Maximum Plateau
  // Deterministic center index tie-breaking rule: Math.floor((plateauRowCount - 1) / 2)
  const centerIndex = Math.floor((plateauRowCount - 1) / 2);
  const selectedCandidate = selectedPlateau[centerIndex];

  const selectedYcm = selectedCandidate.yCm;
  const selectedRasterRow = selectedCandidate.rasterRow;

  // Provenance metrics
  const offsetBelowHipCm = typeof hipAnchorYcm === 'number' && Number.isFinite(hipAnchorYcm)
    ? Number((hipAnchorYcm - selectedYcm).toFixed(4))
    : null;

  const clearanceAboveFirstSplitCm = typeof firstSplitYcm === 'number' && Number.isFinite(firstSplitYcm)
    ? Number((selectedYcm - firstSplitYcm).toFixed(4))
    : null;

  if (plateauRowCount > 1) {
    warnings.push(`Maximum perimeter score formed a ${plateauRowCount}-row plateau between Y=${plateauStartYcm.toFixed(2)} cm (row ${plateauStartRow}) and Y=${plateauEndYcm.toFixed(2)} cm (row ${plateauEndRow}). Localized to deterministic plateau center at Y=${selectedYcm.toFixed(2)} cm (row ${selectedRasterRow}).`);
  }

  return {
    contract: MAXIMUM_SEAT_PLANE_CONTRACT,
    version: MAXIMUM_SEAT_PLANE_CONTRACT_VERSION,
    status: MAXIMUM_SEAT_PLANE_STATUS.LOCALIZED,
    selectedYcm,
    selectedRasterRow,
    selectionMethod: 'plateau_center_v0',
    peakScoreCm: Number(peakScoreCm.toFixed(4)),
    plateau: {
      startYcm: plateauStartYcm,
      endYcm: plateauEndYcm,
      startRow: plateauStartRow,
      endRow: plateauEndRow,
      rowCount: plateauRowCount,
      candidates: selectedPlateau.map((c) => ({
        rasterRow: c.rasterRow,
        yCm: c.yCm,
        modeledPerimeterScoreCm: c.modeledPerimeterScoreCm,
        frontWidthCm: c.front.widthCm,
        sideQualifiedApDepthCm: c.side.qualifiedApDepthCm,
      })),
    },
    selectedCandidate: {
      yCm: selectedCandidate.yCm,
      rasterRow: selectedCandidate.rasterRow,
      sideRasterRow: selectedCandidate.rasterRow, // in identical resolution
      frontWidthCm: selectedCandidate.front.widthCm,
      frontMinXcm: selectedCandidate.front.minXcm,
      frontMaxXcm: selectedCandidate.front.maxXcm,
      sideRawProfileSpanCm: selectedCandidate.side.profileSpanCm,
      sideQualifiedApDepthCm: selectedCandidate.side.qualifiedApDepthCm,
      sideMinUcm: selectedCandidate.side.minUcm,
      sideMaxUcm: selectedCandidate.side.maxUcm,
      encounteredFrontClassIds: [...(selectedCandidate.front.encounteredClassIds ?? [])],
      encounteredSideClassIds: [...(selectedCandidate.side.encounteredClassIds ?? [])],
      modeledPerimeterScoreCm: selectedCandidate.modeledPerimeterScoreCm,
      perimeterModel: selectedCandidate.perimeterModel ? { ...selectedCandidate.perimeterModel } : null,
    },
    provenance: {
      hipAnchorYcm,
      offsetBelowHipCm,
      firstSplitYcm,
      clearanceAboveFirstSplitCm,
      totalCandidateCount: rawCandidates.length,
      eligibleCandidateCount: eligibleCandidates.length,
      sourceScanContract: pelvicScanReport.contract ?? 'pelvic-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: scanStatus,
      sliceHighlightCoordinates: {
        yCm: selectedCandidate.yCm,
        frontRasterRow: selectedCandidate.rasterRow,
        sideRasterRow: selectedCandidate.rasterRow,
        frontBoundsCm: {
          minX: selectedCandidate.front.minXcm,
          maxX: selectedCandidate.front.maxXcm,
        },
        sideBoundsCm: {
          minU: selectedCandidate.side.minUcm,
          maxU: selectedCandidate.side.maxUcm,
        },
      },
    },
    semantics: {
      statement: 'Deterministic Maximum Seat Plane localization candidate derived from pelvic arbitrary-Y modeled perimeter ranking curve. NOT measured circumference, NOT final anthropometric Hip Circumference, NOT 3D slice reconstruction.',
      isMaximumSeatPlaneCandidate: true,
      isModeledLocalization: true,
      isMeasuredCircumference: false,
      isAnthropometricHipCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

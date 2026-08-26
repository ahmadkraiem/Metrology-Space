/**
 * Natural Waist Plane Localization Contract v0
 *
 * Pure deterministic domain contract that localizes the Natural Waist Y plane
 * from a completed Torso Arbitrary-Y Evidence Scan report using Front transverse narrowing,
 * corroborating Side profile/AP narrowing, valid trunk segmentation, and local neighborhood behavior.
 *
 * Contract: 'natural-waist-plane-localization-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence-driven localization: searches for a stable local torso constriction within the
 *   anatomically bounded Shoulder-to-Hip trunk region.
 * - NOT a fixed percentage of body height or proportional Shoulder-Hip midpoint.
 * - NOT a single noisy raster-row minimum (isolated spike rejection via symmetric neighborhood filtering).
 * - NOT measured waist circumference, NOT final anthropometric Waist Circumference, and NOT 3D slice reconstruction.
 * - Gathers Front bilateral contour QA (leftXcm, rightXcm inward indentation), Side AP depth corroboration,
 *   and internal cross-sectional envelope scoring.
 * - Ambiguity handling: if two or more materially plausible constrictions exist and cannot be deterministically
 *   separated, returns status: 'ambiguous' with selectedCandidate: null.
 */

export const NATURAL_WAIST_PLANE_CONTRACT = 'natural-waist-plane-localization-v0';
export const NATURAL_WAIST_PLANE_CONTRACT_VERSION = 'natural-waist-plane-localization-v0';

/**
 * Authoritative localization status taxonomy.
 * @type {Readonly<{
 *   READY: 'ready',
 *   AMBIGUOUS: 'ambiguous',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const NATURAL_WAIST_PLANE_STATUS = Object.freeze({
  READY: 'ready',
  AMBIGUOUS: 'ambiguous',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for natural waist plane localization.
 * @type {Readonly<Record<string, string>>}
 */
export const NATURAL_WAIST_PLANE_BLOCKER_CODES = Object.freeze({
  TORSO_SCAN_UNAVAILABLE: 'torso_scan_unavailable',
  INVALID_TORSO_SCAN: 'invalid_torso_scan',
  INSUFFICIENT_VALID_TORSO_ROWS: 'insufficient_valid_torso_rows',
  NO_LOCAL_CONSTRICTION_DETECTED: 'no_local_constriction_detected',
  AMBIGUOUS_MULTIPLE_CONSTRICTIONS: 'ambiguous_multiple_constrictions',
});

/**
 * Default parameters for neighborhood analysis and valley detection.
 */
export const DEFAULT_WAIST_LOCALIZATION_OPTIONS = Object.freeze({
  /** Minimum constriction depth (cm) relative to both superior and inferior crests to be recognized as a true valley. */
  minConstrictionDepthCm: 0.25,
  /** Total physical metric smoothing window span (cm). Default 2.0 cm corresponds to a +/- 1.0 cm radius. */
  smoothingWindowCm: 2.0,
  /** Optional override for smoothing filter radius in discrete samples (null defaults to derivation from smoothingWindowCm). */
  smoothingRadiusRows: null,
  /** Numeric precision tolerance for plateau grouping (0.001 cm = 1e-3 cm). */
  plateauToleranceCm: 1e-3,
  /** Absolute prominence difference (cm) below which competing valleys are considered ambiguous. */
  ambiguityProminenceThresholdCm: 0.4,
  /** Relative prominence ratio above which competing valleys are considered ambiguous. */
  ambiguityProminenceRatio: 0.85,
});

/**
 * Applies a minimal deterministic symmetric smoothing filter to raw width observations
 * to suppress single-row raster jitter without inventing anatomical structure.
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
        // Triangular symmetric kernel: weight decreases linearly with distance
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
 * Evaluates Front bilateral contour inward/outward indentation QA.
 *
 * @param {object} candidate
 * @param {number} baselineMinX
 * @param {number} baselineMaxX
 * @returns {object}
 */
export function evaluateBilateralContourQa(candidate, baselineMinX, baselineMaxX) {
  const minX = candidate.front?.minXcm ?? null;
  const maxX = candidate.front?.maxXcm ?? null;

  if (typeof minX !== 'number' || typeof maxX !== 'number' || typeof baselineMinX !== 'number' || typeof baselineMaxX !== 'number') {
    return {
      status: 'unqualified',
      leftIndentationCm: null,
      rightIndentationCm: null,
      asymmetryDeltaCm: null,
    };
  }

  // Left indentation: torso left edge moves inward (to the right / higher X) relative to baseline
  const leftIndentationCm = Number((minX - baselineMinX).toFixed(4));
  // Right indentation: torso right edge moves inward (to the left / lower X) relative to baseline
  const rightIndentationCm = Number((baselineMaxX - maxX).toFixed(4));
  const asymmetryDeltaCm = Number(Math.abs(leftIndentationCm - rightIndentationCm).toFixed(4));

  let status = 'uniform';
  if (leftIndentationCm > 0 && rightIndentationCm > 0) {
    status = asymmetryDeltaCm <= 1.0 ? 'symmetric' : 'asymmetric';
  } else if (leftIndentationCm > 0 && rightIndentationCm <= 0) {
    status = 'unilateral_left';
  } else if (leftIndentationCm <= 0 && rightIndentationCm > 0) {
    status = 'unilateral_right';
  }

  return {
    status,
    leftIndentationCm,
    rightIndentationCm,
    asymmetryDeltaCm,
  };
}

/**
 * Builds an empty/fallback localization result.
 */
function buildEmptyLocalizationResult({
  status = NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE,
  blockers = [],
  warnings = [],
  issues = [],
  shoulderAnchorYcm = null,
  hipAnchorYcm = null,
  totalCandidateCount = 0,
  eligibleCandidateCount = 0,
  sourceScanContract = 'torso-arbitrary-y-evidence-scan-v0',
} = {}) {
  return {
    contract: NATURAL_WAIST_PLANE_CONTRACT,
    version: NATURAL_WAIST_PLANE_CONTRACT_VERSION,
    status,
    yCm: null,
    rasterRow: null,
    selectionMethod: 'stable_valley_corroborated_v0',
    searchWindow: {
      shoulderYcm: shoulderAnchorYcm,
      hipYcm: hipAnchorYcm,
      spanCm: (typeof shoulderAnchorYcm === 'number' && typeof hipAnchorYcm === 'number')
        ? Number((shoulderAnchorYcm - hipAnchorYcm).toFixed(4))
        : null,
    },
    candidateCount: totalCandidateCount,
    eligibleCandidateCount,
    selectedCandidate: null,
    candidates: [],
    valleys: [],
    frontEvidence: null,
    sideEvidence: null,
    provenance: {
      shoulderAnchorYcm,
      hipAnchorYcm,
      totalCandidateCount,
      eligibleCandidateCount,
      sourceScanContract,
      sliceHighlightCoordinates: null,
    },
    semantics: {
      statement: 'Deterministic Natural Waist Plane localization candidate derived from torso arbitrary-Y evidence profile (Front transverse narrowing, corroborating Side profile/AP narrowing, valid trunk segmentation, and local neighborhood behavior). NOT measured circumference, NOT final anthropometric Waist Circumference, NOT 3D slice reconstruction.',
      isNaturalWaistPlaneCandidate: true,
      isModeledLocalization: true,
      isMeasuredCircumference: false,
      isAnthropometricWaistCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

/**
 * Evaluates pure deterministic Natural Waist Plane Localization from a completed
 * Torso Arbitrary-Y Evidence Scan report.
 *
 * @param {object|null|undefined} torsoScanReport - Result of evaluateTorsoArbitraryYEvidenceScan
 * @param {object} [options]
 * @returns {object} NaturalWaistPlaneLocalizationResultV0
 */
export function evaluateNaturalWaistPlaneLocalization(torsoScanReport, options = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const minConstrictionDepthCm = typeof options?.minConstrictionDepthCm === 'number' && options.minConstrictionDepthCm >= 0
    ? options.minConstrictionDepthCm
    : DEFAULT_WAIST_LOCALIZATION_OPTIONS.minConstrictionDepthCm;

  const smoothingWindowCm = typeof options?.smoothingWindowCm === 'number' && options.smoothingWindowCm > 0
    ? options.smoothingWindowCm
    : DEFAULT_WAIST_LOCALIZATION_OPTIONS.smoothingWindowCm;

  const plateauToleranceCm = typeof options?.plateauToleranceCm === 'number' && options.plateauToleranceCm >= 0
    ? options.plateauToleranceCm
    : DEFAULT_WAIST_LOCALIZATION_OPTIONS.plateauToleranceCm;

  const ambiguityProminenceThresholdCm = typeof options?.ambiguityProminenceThresholdCm === 'number'
    ? options.ambiguityProminenceThresholdCm
    : DEFAULT_WAIST_LOCALIZATION_OPTIONS.ambiguityProminenceThresholdCm;

  const ambiguityProminenceRatio = typeof options?.ambiguityProminenceRatio === 'number'
    ? options.ambiguityProminenceRatio
    : DEFAULT_WAIST_LOCALIZATION_OPTIONS.ambiguityProminenceRatio;

  // 1. Validate Input Torso Scan Report
  if (!torsoScanReport || typeof torsoScanReport !== 'object') {
    blockers.push(NATURAL_WAIST_PLANE_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push('Torso arbitrary-Y evidence scan report is missing or null.');
    return buildEmptyLocalizationResult({
      status: NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
    });
  }

  const scanStatus = torsoScanReport.status;
  const isScanUsable = scanStatus === 'completed' || scanStatus === 'partial';

  if (!isScanUsable) {
    blockers.push(NATURAL_WAIST_PLANE_BLOCKER_CODES.TORSO_SCAN_UNAVAILABLE);
    issues.push(`Torso arbitrary-Y evidence scan status is '${scanStatus}' (not completed or partial).`);
    return buildEmptyLocalizationResult({
      status: scanStatus === 'invalid' ? NATURAL_WAIST_PLANE_STATUS.INVALID : NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      shoulderAnchorYcm: torsoScanReport.upperBound?.yCm ?? null,
      hipAnchorYcm: torsoScanReport.lowerBound?.yCm ?? null,
      totalCandidateCount: torsoScanReport.candidateCount ?? 0,
    });
  }

  const rawCandidates = Array.isArray(torsoScanReport.candidates) ? torsoScanReport.candidates : [];
  const shoulderAnchorYcm = torsoScanReport.upperBound?.yCm ?? null;
  const hipAnchorYcm = torsoScanReport.lowerBound?.yCm ?? null;

  if (rawCandidates.length === 0) {
    blockers.push(NATURAL_WAIST_PLANE_BLOCKER_CODES.INSUFFICIENT_VALID_TORSO_ROWS);
    issues.push('Torso scan report contains 0 candidate rows.');
    return buildEmptyLocalizationResult({
      status: NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      shoulderAnchorYcm,
      hipAnchorYcm,
      totalCandidateCount: 0,
    });
  }

  // 2. Filter Eligible Trunk Candidates
  // Must have valid Front single supported run
  const eligibleCandidates = rawCandidates.filter((c) => {
    if (!c || typeof c !== 'object') return false;
    const front = c.front;
    return front
      && front.status === 'valid'
      && front.isSingleSupportedRun === true
      && front.runCount === 1
      && typeof front.widthCm === 'number'
      && Number.isFinite(front.widthCm)
      && front.widthCm > 0;
  });

  const N = eligibleCandidates.length;
  if (N < 3) {
    blockers.push(NATURAL_WAIST_PLANE_BLOCKER_CODES.INSUFFICIENT_VALID_TORSO_ROWS);
    issues.push(`Insufficient valid torso rows (${N} eligible rows out of ${rawCandidates.length} scanned). At least 3 valid connected rows required for neighborhood analysis.`);
    return buildEmptyLocalizationResult({
      status: NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      shoulderAnchorYcm,
      hipAnchorYcm,
      totalCandidateCount: rawCandidates.length,
      eligibleCandidateCount: N,
    });
  }

  // 3. Compute Sample Spacing & Metric-Scaled Smoothing Window
  // Calculate average canonical Y step between consecutive eligible samples
  let sampleSpacingCm = 1.0;
  if (N >= 2) {
    const totalSpan = Math.abs(eligibleCandidates[0].yCm - eligibleCandidates[N - 1].yCm);
    sampleSpacingCm = totalSpan / (N - 1);
  }
  if (!Number.isFinite(sampleSpacingCm) || sampleSpacingCm <= 0) {
    sampleSpacingCm = 1.0;
  }

  // Derive smoothing radius (in sample steps) from total physical metric window smoothingWindowCm (default: 2.0 cm, corresponding to +/- 1.0 cm radius)
  const smoothingRadiusSamples = typeof options?.smoothingRadiusRows === 'number' && options.smoothingRadiusRows >= 0
    ? options.smoothingRadiusRows
    : Math.max(1, Math.round((smoothingWindowCm / 2) / sampleSpacingCm));

  const rawWidths = eligibleCandidates.map((c) => c.front.widthCm);
  const smoothedWidths = applySymmetricSmoothing(rawWidths, smoothingRadiusSamples);

  // Derive trunk boundary envelope baselines (mean outer bounds near shoulder and hip extremes)
  const topRows = eligibleCandidates.slice(0, Math.min(5, eligibleCandidates.length));
  const bottomRows = eligibleCandidates.slice(Math.max(0, eligibleCandidates.length - 5));
  const trunkBoundaryMinX = Math.min(...topRows.map((c) => c.front.minXcm), ...bottomRows.map((c) => c.front.minXcm));
  const trunkBoundaryMaxX = Math.max(...topRows.map((c) => c.front.maxXcm), ...bottomRows.map((c) => c.front.maxXcm));

  // 4. Attach Smoothed Observations and Bilateral Contour QA to Eligible Candidates
  const enrichedCandidates = eligibleCandidates.map((c, idx) => {
    const smoothedWidthCm = smoothedWidths[idx];
    const rawWidthCm = c.front.widthCm;
    const bilateralContourQa = evaluateBilateralContourQa(c, trunkBoundaryMinX, trunkBoundaryMaxX);

    return {
      ...c,
      indexInEligible: idx,
      rawWidthCm,
      smoothedWidthCm,
      bilateralContourQa,
    };
  });

  // 5. Detect Local Minima (Valleys) in Smoothed Width Profile
  const rawValleys = [];

  // Exclude immediate boundary endpoints (first and last row) as valleys
  for (let i = 1; i < N - 1; i += 1) {
    const curr = smoothedWidths[i];
    const prev = smoothedWidths[i - 1];
    const next = smoothedWidths[i + 1];

    const isLocalMin = curr <= prev && curr <= next;
    if (isLocalMin) {
      // Find superior crest (maximum width between index 0 and i)
      let superiorCrestWidth = -Infinity;
      let superiorCrestIndex = 0;
      for (let s = 0; s <= i; s += 1) {
        if (smoothedWidths[s] > superiorCrestWidth) {
          superiorCrestWidth = smoothedWidths[s];
          superiorCrestIndex = s;
        }
      }

      // Find inferior crest (maximum width between i and N-1)
      let inferiorCrestWidth = -Infinity;
      let inferiorCrestIndex = N - 1;
      for (let inf = i; inf < N; inf += 1) {
        if (smoothedWidths[inf] > inferiorCrestWidth) {
          inferiorCrestWidth = smoothedWidths[inf];
          inferiorCrestIndex = inf;
        }
      }

      const superiorConstrictionDepthCm = Number((superiorCrestWidth - curr).toFixed(4));
      const inferiorConstrictionDepthCm = Number((inferiorCrestWidth - curr).toFixed(4));
      const prominenceCm = Number(Math.min(superiorConstrictionDepthCm, inferiorConstrictionDepthCm).toFixed(4));

      // Side corroboration analysis
      const cand = enrichedCandidates[i];
      let sideCorroboration = 'neutral';
      if (cand.side?.isQualified === true && typeof cand.side?.qualifiedApDepthCm === 'number') {
        sideCorroboration = 'corroborated';
      } else if (cand.side?.status === 'valid') {
        sideCorroboration = 'profile_only';
      } else if (scanStatus === 'partial') {
        sideCorroboration = 'unqualified';
      }

      // Neighborhood stability check (ensure constriction is not an isolated 1-row artifact)
      const rawVsSmoothedDeltaCm = Math.abs(cand.rawWidthCm - cand.smoothedWidthCm);
      const isNeighborhoodStable = rawVsSmoothedDeltaCm < 1.0 && prominenceCm >= minConstrictionDepthCm;

      rawValleys.push({
        candidateIndex: i,
        candidate: cand,
        yCm: cand.yCm,
        rasterRow: cand.rasterRow,
        rawWidthCm: cand.rawWidthCm,
        smoothedWidthCm: curr,
        superiorCrestWidthCm: superiorCrestWidth,
        superiorCrestYcm: enrichedCandidates[superiorCrestIndex].yCm,
        superiorConstrictionDepthCm,
        inferiorCrestWidthCm: inferiorCrestWidth,
        inferiorCrestYcm: enrichedCandidates[inferiorCrestIndex].yCm,
        inferiorConstrictionDepthCm,
        prominenceCm,
        sideCorroboration,
        isNeighborhoodStable,
        bilateralContourQa: cand.bilateralContourQa,
        modeledPerimeterScoreCm: cand.modeledPerimeterScoreCm ?? null,
      });
    }
  }

  // 6. Filter Significant Valleys (prominence >= minConstrictionDepthCm)
  const significantValleys = rawValleys.filter((v) => v.prominenceCm >= minConstrictionDepthCm && v.isNeighborhoodStable);

  // Group adjacent valleys that belong to the same plateau
  const groupedValleys = [];
  let currentGroup = [];

  for (const v of significantValleys) {
    if (currentGroup.length === 0) {
      currentGroup.push(v);
    } else {
      const prev = currentGroup[currentGroup.length - 1];
      const isContiguous = (v.candidateIndex - prev.candidateIndex) <= 2;
      const isSimilarWidth = Math.abs(v.smoothedWidthCm - prev.smoothedWidthCm) <= plateauToleranceCm;

      if (isContiguous && isSimilarWidth) {
        currentGroup.push(v);
      } else {
        groupedValleys.push(currentGroup);
        currentGroup = [v];
      }
    }
  }
  if (currentGroup.length > 0) {
    groupedValleys.push(currentGroup);
  }

  // Collapse plateau groups to representative center candidate
  const distinctValleys = groupedValleys.map((group) => {
    const centerIdx = Math.floor((group.length - 1) / 2);
    const representative = group[centerIdx];
    return {
      ...representative,
      plateauRowCount: group.length,
      plateauCandidates: group.map((g) => ({ yCm: g.yCm, rasterRow: g.rasterRow, widthCm: g.smoothedWidthCm })),
    };
  });

  // Sort distinct valleys by prominence descending
  distinctValleys.sort((a, b) => b.prominenceCm - a.prominenceCm);

  // 7. Evaluate Ambiguity and Selection
  if (distinctValleys.length === 0) {
    blockers.push(NATURAL_WAIST_PLANE_BLOCKER_CODES.NO_LOCAL_CONSTRICTION_DETECTED);
    issues.push(`No valid local torso constriction detected (threshold: ${minConstrictionDepthCm} cm). Profile is flat or monotonic between Shoulder (Y=${shoulderAnchorYcm?.toFixed(1) ?? '?'} cm) and Hip (Y=${hipAnchorYcm?.toFixed(1) ?? '?'} cm).`);
    return {
      ...buildEmptyLocalizationResult({
        status: NATURAL_WAIST_PLANE_STATUS.UNAVAILABLE,
        blockers,
        warnings,
        issues,
        shoulderAnchorYcm,
        hipAnchorYcm,
        totalCandidateCount: rawCandidates.length,
        eligibleCandidateCount: eligibleCandidates.length,
        sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      }),
      candidates: enrichedCandidates,
      valleys: rawValleys,
    };
  }

  let selectedValley = null;
  let status = NATURAL_WAIST_PLANE_STATUS.READY;

  if (distinctValleys.length === 1) {
    selectedValley = distinctValleys[0];
  } else {
    // Multiple distinct valleys: evaluate if primary valley clearly dominates
    const primary = distinctValleys[0];
    const secondary = distinctValleys[1];

    const promDiff = primary.prominenceCm - secondary.prominenceCm;
    const promRatio = secondary.prominenceCm / primary.prominenceCm;

    if (promDiff < ambiguityProminenceThresholdCm || promRatio >= ambiguityProminenceRatio) {
      // Competing valleys cannot be deterministically separated
      status = NATURAL_WAIST_PLANE_STATUS.AMBIGUOUS;
      blockers.push(NATURAL_WAIST_PLANE_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_CONSTRICTIONS);
      issues.push(`Detected multiple competing torso constrictions at Y=${primary.yCm.toFixed(2)} cm (depth: ${primary.prominenceCm.toFixed(2)} cm) and Y=${secondary.yCm.toFixed(2)} cm (depth: ${secondary.prominenceCm.toFixed(2)} cm). Cannot deterministically isolate a unique Natural Waist plane.`);
    } else {
      // Primary valley clearly dominates
      selectedValley = primary;
      warnings.push(`Primary Natural Waist constriction at Y=${primary.yCm.toFixed(2)} cm (depth: ${primary.prominenceCm.toFixed(2)} cm) selected; secondary minor constriction at Y=${secondary.yCm.toFixed(2)} cm (depth: ${secondary.prominenceCm.toFixed(2)} cm) noted.`);
    }
  }

  if (!selectedValley || status === NATURAL_WAIST_PLANE_STATUS.AMBIGUOUS) {
    return {
      ...buildEmptyLocalizationResult({
        status: NATURAL_WAIST_PLANE_STATUS.AMBIGUOUS,
        blockers,
        warnings,
        issues,
        shoulderAnchorYcm,
        hipAnchorYcm,
        totalCandidateCount: rawCandidates.length,
        eligibleCandidateCount: eligibleCandidates.length,
        sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      }),
      candidates: enrichedCandidates,
      valleys: distinctValleys,
    };
  }

  const selectedCandidateRecord = selectedValley.candidate;
  const selectedYcm = selectedValley.yCm;
  const selectedRasterRow = selectedValley.rasterRow;
  // Check for raw width plateau around selected row
  let rawPlateauRowCount = 1;
  const selectedRawWidth = selectedCandidateRecord.front.widthCm;
  let pLeft = selectedValley.candidateIndex - 1;
  while (pLeft >= 0 && Math.abs(enrichedCandidates[pLeft].rawWidthCm - selectedRawWidth) <= plateauToleranceCm) {
    rawPlateauRowCount += 1;
    pLeft -= 1;
  }
  let pRight = selectedValley.candidateIndex + 1;
  while (pRight < enrichedCandidates.length && Math.abs(enrichedCandidates[pRight].rawWidthCm - selectedRawWidth) <= plateauToleranceCm) {
    rawPlateauRowCount += 1;
    pRight += 1;
  }

  const effectivePlateauRowCount = Math.max(selectedValley.plateauRowCount, rawPlateauRowCount);

  if (effectivePlateauRowCount > 1) {
    warnings.push(`Constriction formed a ${effectivePlateauRowCount}-row plateau; localized to deterministic plateau center at Y=${selectedYcm.toFixed(2)} cm (row ${selectedRasterRow}).`);
  }

  if (scanStatus === 'partial') {
    warnings.push('Side segmentation raster was unavailable during scan; localization evaluated using Front transverse narrowing and neighborhood stability without full Side AP corroboration.');
  }

  const frontEvidence = {
    status: selectedCandidateRecord.front?.status ?? 'valid',
    widthCm: selectedCandidateRecord.front?.widthCm ?? null,
    minXcm: selectedCandidateRecord.front?.minXcm ?? null,
    maxXcm: selectedCandidateRecord.front?.maxXcm ?? null,
    runCount: selectedCandidateRecord.front?.runCount ?? 1,
    isSingleSupportedRun: selectedCandidateRecord.front?.isSingleSupportedRun ?? true,
    encounteredClassIds: [...(selectedCandidateRecord.front?.encounteredClassIds ?? [])],
    superiorConstrictionDepthCm: selectedValley.superiorConstrictionDepthCm,
    inferiorConstrictionDepthCm: selectedValley.inferiorConstrictionDepthCm,
    prominenceCm: selectedValley.prominenceCm,
    bilateralContourQa: selectedValley.bilateralContourQa,
  };

  const sideEvidence = {
    status: selectedCandidateRecord.side?.status ?? 'unavailable',
    profileSpanCm: selectedCandidateRecord.side?.profileSpanCm ?? null,
    qualifiedApDepthCm: selectedCandidateRecord.side?.qualifiedApDepthCm ?? null,
    minUcm: selectedCandidateRecord.side?.minUcm ?? null,
    maxUcm: selectedCandidateRecord.side?.maxUcm ?? null,
    isQualified: selectedCandidateRecord.side?.isQualified === true,
    depthQualificationStatus: selectedCandidateRecord.side?.depthQualificationStatus ?? 'unavailable',
    corroboration: selectedValley.sideCorroboration,
  };

  const selectedSideRasterRow = selectedCandidateRecord.sideRasterRow
    ?? selectedCandidateRecord.side?.rasterRow
    ?? null;

  return {
    contract: NATURAL_WAIST_PLANE_CONTRACT,
    version: NATURAL_WAIST_PLANE_CONTRACT_VERSION,
    status: NATURAL_WAIST_PLANE_STATUS.READY,
    yCm: selectedYcm,
    rasterRow: selectedRasterRow,
    selectionMethod: 'stable_valley_corroborated_v0',
    searchWindow: {
      shoulderYcm: shoulderAnchorYcm,
      hipYcm: hipAnchorYcm,
      spanCm: (typeof shoulderAnchorYcm === 'number' && typeof hipAnchorYcm === 'number')
        ? Number((shoulderAnchorYcm - hipAnchorYcm).toFixed(4))
        : null,
    },
    candidateCount: rawCandidates.length,
    eligibleCandidateCount: eligibleCandidates.length,
    selectedCandidate: {
      yCm: selectedYcm,
      rasterRow: selectedRasterRow,
      sideRasterRow: selectedSideRasterRow,
      frontWidthCm: selectedCandidateRecord.front.widthCm,
      frontMinXcm: selectedCandidateRecord.front.minXcm,
      frontMaxXcm: selectedCandidateRecord.front.maxXcm,
      smoothedWidthCm: selectedValley.smoothedWidthCm,
      sideRawProfileSpanCm: selectedCandidateRecord.side?.profileSpanCm ?? null,
      sideQualifiedApDepthCm: selectedCandidateRecord.side?.qualifiedApDepthCm ?? null,
      sideMinUcm: selectedCandidateRecord.side?.minUcm ?? null,
      sideMaxUcm: selectedCandidateRecord.side?.maxUcm ?? null,
      encounteredFrontClassIds: [...(selectedCandidateRecord.front?.encounteredClassIds ?? [])],
      encounteredSideClassIds: [...(selectedCandidateRecord.side?.encounteredClassIds ?? [])],
      modeledPerimeterScoreCm: selectedCandidateRecord.modeledPerimeterScoreCm ?? null,
      constrictionProminenceCm: selectedValley.prominenceCm,
      superiorConstrictionDepthCm: selectedValley.superiorConstrictionDepthCm,
      inferiorConstrictionDepthCm: selectedValley.inferiorConstrictionDepthCm,
      bilateralContourQa: selectedValley.bilateralContourQa,
    },
    candidates: enrichedCandidates,
    valleys: distinctValleys,
    frontEvidence,
    sideEvidence,
    provenance: {
      shoulderAnchorYcm,
      offsetBelowShoulderCm: typeof shoulderAnchorYcm === 'number' ? Number((shoulderAnchorYcm - selectedYcm).toFixed(4)) : null,
      hipAnchorYcm,
      elevationAboveHipCm: typeof hipAnchorYcm === 'number' ? Number((selectedYcm - hipAnchorYcm).toFixed(4)) : null,
      totalCandidateCount: rawCandidates.length,
      eligibleCandidateCount: eligibleCandidates.length,
      smoothingWindowCm,
      smoothingRadiusSamples,
      sampleSpacingCm: Number(sampleSpacingCm.toFixed(4)),
      minConstrictionDepthCm,
      sourceScanContract: torsoScanReport.contract ?? 'torso-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: scanStatus,
      sliceHighlightCoordinates: {
        yCm: selectedYcm,
        frontRasterRow: selectedRasterRow,
        sideRasterRow: selectedSideRasterRow,
        frontBoundsCm: {
          minX: selectedCandidateRecord.front.minXcm,
          maxX: selectedCandidateRecord.front.maxXcm,
        },
        sideBoundsCm: {
          minU: selectedCandidateRecord.side?.minUcm ?? null,
          maxU: selectedCandidateRecord.side?.maxUcm ?? null,
        },
      },
    },
    semantics: {
      statement: 'Deterministic Natural Waist Plane localization candidate derived from torso arbitrary-Y evidence profile (Front transverse narrowing, corroborating Side profile/AP narrowing, valid trunk segmentation, and local neighborhood behavior). NOT measured circumference, NOT final anthropometric Waist Circumference, NOT 3D slice reconstruction.',
      isNaturalWaistPlaneCandidate: true,
      isModeledLocalization: true,
      isCircumference: false,
      isMeasuredCircumference: false,
      isAnthropometricWaistCircumference: false,
      is3dReconstruction: false,
    },
    blockers,
    warnings,
    issues,
  };
}

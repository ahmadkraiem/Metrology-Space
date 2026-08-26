/**
 * Pelvic Arbitrary-Y Evidence Scan Contract v0
 *
 * Pure deterministic domain contract that scans the pelvic region starting at the
 * Hip Landmark Level and scanning downward until the Front pelvic supported silhouette
 * reaches the leg/crotch split boundary.
 *
 * Contract: 'pelvic-arbitrary-y-evidence-scan-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence collection only: collects continuous transverse width and profile span evidence
 *   without deciding the final maximum seat plane or claiming Hip Circumference.
 * - Upper bound is anchored strictly at the ready Hip Landmark Y level (no fixed offset).
 * - Lower boundary is derived strictly from observed segmentation topology (transition from
 *   single connected pelvic core run into separated leg structure).
 * - Preserves native raster row sampling with exact integer row index and mapped continuous Y in cm.
 * - Reuses pelvic_core_support_v0 ([12, 13, 21, 22]).
 * - Side physical AP depth qualification and modeled perimeter scores are preserved as null
 *   because arbitrary-Y physical depth qualification is not yet semantically registered.
 * - Preserves raw transition evidence without prematurely declaring an isolated multi-run row
 *   as an anatomical crotch location.
 */

import { DEFAULT_WORKSPACE_EXTENT_CM, canonicalYToPixelRow } from '../core/pixelMetrologyMapping.js';
import { sampleFrontHorizontalRasterSlice } from './frontRasterSlice.js';
import { sampleSideHorizontalRasterSlice } from './sideRasterSlice.js';
import { MEASUREMENT_SUPPORT_POLICIES_V0 } from './measurementSupportPolicy.js';
import { computeAnatomicalLevels } from './anatomicalLevels.js';
import { evaluateArbitraryYSidePhysicalDepthQualification } from './arbitraryYSidePhysicalDepthQualification.js';
import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

export const PELVIC_ARBITRARY_Y_SCAN_CONTRACT = 'pelvic-arbitrary-y-evidence-scan-v0';
export const PELVIC_ARBITRARY_Y_SCAN_CONTRACT_VERSION = 'pelvic-arbitrary-y-evidence-scan-v0';

/**
 * Authoritative 4-state scan status taxonomy.
 * @type {Readonly<{
 *   COMPLETED: 'completed',
 *   PARTIAL: 'partial',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const PELVIC_ARBITRARY_Y_SCAN_STATUS = Object.freeze({
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for pelvic arbitrary-Y evidence scan.
 * @type {Readonly<Record<string, string>>}
 */
export const PELVIC_SCAN_BLOCKER_CODES = Object.freeze({
  HIP_ANCHOR_LEVEL_UNAVAILABLE: 'hip_anchor_level_unavailable',
  FRONT_SEGMENTATION_UNAVAILABLE: 'front_segmentation_unavailable',
  SIDE_SEGMENTATION_UNAVAILABLE: 'side_segmentation_unavailable',
  METRIC_CALIBRATION_UNAVAILABLE: 'metric_calibration_unavailable',
  OUT_OF_BOUNDS_SCAN_INTERVAL: 'out_of_bounds_scan_interval',
});

/**
 * Number of additional rows to observe after detecting the initial single-run -> multi-run
 * split transition to capture neighboring transition evidence for downstream stability analysis.
 */
export const DEFAULT_TRANSITION_OBSERVATION_BUFFER_ROWS = 10;

/**
 * Builds an empty or unavailable pelvic scan result.
 */
function buildEmptyScanResult({
  status = PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
  hipAnchorYcm = null,
  startRow = null,
  supportPolicyId = 'pelvic_core_support_v0',
  targetClassIds = [12, 13, 21, 22],
  blockers = [],
  warnings = [],
  issues = [],
  prerequisites = {},
} = {}) {
  return {
    contract: PELVIC_ARBITRARY_Y_SCAN_CONTRACT,
    version: PELVIC_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
    status,
    scanDirection: 'downward',
    supportPolicyId,
    targetClassIds,
    upperBound: {
      yCm: hipAnchorYcm,
      rasterRow: startRow,
      sourceLevel: 'hip',
    },
    lowerBoundaryEvidence: {
      status: 'unavailable',
      firstSplitRow: null,
      firstSplitYcm: null,
      splitReason: 'scan_unavailable_or_blocked',
      transitionRows: [],
    },
    candidateCount: 0,
    validCandidateCount: 0,
    candidates: [],
    prerequisites: {
      metricCalibrationFront: null,
      metricCalibrationSide: null,
      sideViewOrientationQualified: null,
      sidePoseQualified: null,
      ...prerequisites,
    },
    blockers,
    warnings,
    issues,
  };
}

/**
 * Evaluates a deterministic Pelvic Arbitrary-Y Evidence Scan from Hip Landmark level
 * downward to the crotch/leg split transition boundary.
 *
 * @param {{
 *   frontRaster?: Uint8Array|null,
 *   sideRaster?: Uint8Array|null,
 *   frontSegmentation?: { widthPx: number, heightPx: number }|null,
 *   sideSegmentation?: { widthPx: number, heightPx: number }|null,
 *   annotations?: Array<object>|null,
 *   levelsReport?: object|null,
 *   metricCalibrationFront?: object|null,
 *   metricCalibrationSide?: object|null,
 *   sideViewOrientationQualification?: object|null,
 *   sidePoseQualification?: object|null,
 *   options?: {
 *     workspaceExtentCm?: number,
 *     transitionObservationBufferRows?: number,
 *     maxScanRows?: number|null,
 *   },
 * }} input
 * @returns {object} PelvicArbitraryYEvidenceScanResultV0
 */
export function evaluatePelvicArbitraryYEvidenceScan({
  frontRaster = null,
  sideRaster = null,
  frontSegmentation = null,
  sideSegmentation = null,
  annotations = null,
  levelsReport = null,
  metricCalibrationFront = null,
  metricCalibrationSide = null,
  sideViewOrientationQualification = null,
  sidePoseQualification = null,
  clothingSemanticsSide = null,
  clothingSemantics = null,
  options = {},
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const workspaceExtentCm = options?.workspaceExtentCm ?? DEFAULT_WORKSPACE_EXTENT_CM;
  const transitionObservationBufferRows = options?.transitionObservationBufferRows ?? DEFAULT_TRANSITION_OBSERVATION_BUFFER_ROWS;
  const maxScanRows = options?.maxScanRows ?? null;

  const supportPolicy = MEASUREMENT_SUPPORT_POLICIES_V0.pelvic_core_support_v0;
  const targetClassIds = Array.from(supportPolicy.acceptedClassIds);

  const resolvedClothingSemantics = clothingSemanticsSide ?? clothingSemantics;

  const prerequisites = {
    metricCalibrationFront: metricCalibrationFront
      ? { status: metricCalibrationFront.status, scaleCmPerPx: metricCalibrationFront.scaleCmPerPx ?? null }
      : null,
    metricCalibrationSide: metricCalibrationSide
      ? { status: metricCalibrationSide.status, scaleCmPerPx: metricCalibrationSide.scaleCmPerPx ?? null }
      : null,
    sideViewOrientationQualified: sideViewOrientationQualification?.status === 'qualified'
      || sideViewOrientationQualification?.isQualified === true
      || null,
    sidePoseQualified: sidePoseQualification?.status === 'qualified'
      || sidePoseQualification?.isQualified === true
      || null,
    clothingSemantics: resolvedClothingSemantics ? { status: resolvedClothingSemantics.status ?? 'evaluated' } : null,
  };

  // 1. Validate Front Segmentation & Raster
  const frontWidthPx = frontSegmentation?.widthPx;
  const frontHeightPx = frontSegmentation?.heightPx;

  if (
    typeof frontWidthPx !== 'number'
    || typeof frontHeightPx !== 'number'
    || !Number.isInteger(frontWidthPx)
    || !Number.isInteger(frontHeightPx)
    || frontWidthPx <= 0
    || frontHeightPx <= 0
  ) {
    if (!frontSegmentation) {
      blockers.push(PELVIC_SCAN_BLOCKER_CODES.FRONT_SEGMENTATION_UNAVAILABLE);
      issues.push('Front segmentation metadata is unavailable.');
      return buildEmptyScanResult({
        status: PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
        blockers,
        warnings,
        issues,
        prerequisites,
      });
    }
    issues.push(`Invalid Front segmentation raster dimensions: widthPx (${frontWidthPx}), heightPx (${frontHeightPx}).`);
    return buildEmptyScanResult({
      status: PELVIC_ARBITRARY_Y_SCAN_STATUS.INVALID,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  const expectedFrontLength = frontWidthPx * frontHeightPx;
  if (!frontRaster || typeof frontRaster.length !== 'number' || frontRaster.length < expectedFrontLength) {
    blockers.push(PELVIC_SCAN_BLOCKER_CODES.FRONT_SEGMENTATION_UNAVAILABLE);
    issues.push(`Front segmentation raster buffer is missing or incomplete (expected ${expectedFrontLength} bytes).`);
    return buildEmptyScanResult({
      status: PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  // 2. Resolve Hip Anchor Level
  const resolvedLevelsReport = levelsReport ?? computeAnatomicalLevels(Array.isArray(annotations) ? annotations : []);
  const hipLevel = resolvedLevelsReport?.levels?.find((l) => l.id === 'hip') ?? null;

  if (!hipLevel || hipLevel.status !== 'ready' || typeof hipLevel.yCm !== 'number' || !Number.isFinite(hipLevel.yCm)) {
    blockers.push(PELVIC_SCAN_BLOCKER_CODES.HIP_ANCHOR_LEVEL_UNAVAILABLE);
    issues.push("Hip anatomical reference level is not ready. Pelvic arbitrary-Y scan requires a ready 'hip' reference anchor.");
    return buildEmptyScanResult({
      status: PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  const hipAnchorYcm = hipLevel.yCm;

  // 3. Map Starting Pixel Row
  const startRowMapping = canonicalYToPixelRow(hipAnchorYcm, frontHeightPx, workspaceExtentCm);
  if (!startRowMapping) {
    blockers.push(PELVIC_SCAN_BLOCKER_CODES.OUT_OF_BOUNDS_SCAN_INTERVAL);
    issues.push(`Hip landmark elevation (${hipAnchorYcm} cm) is outside valid metrology domain [0, ${workspaceExtentCm}].`);
    return buildEmptyScanResult({
      status: PELVIC_ARBITRARY_Y_SCAN_STATUS.INVALID,
      hipAnchorYcm,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  const startRow = startRowMapping.row;

  // 4. Validate Side Segmentation & Raster (non-fatal; missing side triggers partial)
  const sideWidthPx = sideSegmentation?.widthPx;
  const sideHeightPx = sideSegmentation?.heightPx;
  const isSideDimensionsValid = typeof sideWidthPx === 'number'
    && typeof sideHeightPx === 'number'
    && Number.isInteger(sideWidthPx)
    && Number.isInteger(sideHeightPx)
    && sideWidthPx > 0
    && sideHeightPx > 0;

  const expectedSideLength = isSideDimensionsValid ? sideWidthPx * sideHeightPx : 0;
  const isSideRasterAvailable = isSideDimensionsValid
    && sideRaster
    && typeof sideRaster.length === 'number'
    && sideRaster.length >= expectedSideLength;

  if (!isSideRasterAvailable) {
    warnings.push('Side segmentation raster is unavailable or incomplete. Scan will collect Front evidence only (status: partial).');
  }

  // 5. Execute Downward Scan Loop
  const candidates = [];
  const transitionRows = [];
  let splitDetected = false;
  let firstSplitRow = null;
  let firstSplitYcm = null;
  let splitReason = null;
  let rowsScannedAfterSplit = 0;

  const maxRowIndex = frontHeightPx - 1;
  const maxRowsToProcess = typeof maxScanRows === 'number' && maxScanRows > 0
    ? Math.min(frontHeightPx - startRow, maxScanRows)
    : (frontHeightPx - startRow);

  for (let offset = 0; offset < maxRowsToProcess; offset += 1) {
    const currentRow = startRow + offset;
    if (currentRow > maxRowIndex) break;

    // Calculate exact continuous Y at pixel row center
    const continuousY = ((frontHeightPx - (currentRow + 0.5)) / frontHeightPx) * workspaceExtentCm;
    const rowNormalizedV = (currentRow + 0.5) / frontHeightPx;

    // Front horizontal raster slice
    const frontSlice = sampleFrontHorizontalRasterSlice(frontRaster, {
      widthPx: frontWidthPx,
      heightPx: frontHeightPx,
      yCm: continuousY,
      targetClassIds,
      workspaceExtentCm,
    });

    const frontRunCount = frontSlice?.runs?.length ?? 0;
    const isFrontSingleRun = frontRunCount === 1 && (frontSlice?.runs[0]?.pixelCount ?? 0) > 0;
    const frontRun = isFrontSingleRun ? frontSlice.runs[0] : null;

    const frontWidthCm = frontRun
      ? Number((frontRun.boundsCm.maxX - frontRun.boundsCm.minX).toFixed(4))
      : null;
    const frontMinXcm = frontRun ? Number(frontRun.boundsCm.minX.toFixed(4)) : null;
    const frontMaxXcm = frontRun ? Number(frontRun.boundsCm.maxX.toFixed(4)) : null;

    let frontEncounteredClassIds = [];
    if (isFrontSingleRun) {
      frontEncounteredClassIds = Array.isArray(frontRun.encounteredClassIds) ? [...frontRun.encounteredClassIds] : [];
    } else if (frontRunCount > 0) {
      const classSet = new Set();
      for (const r of frontSlice.runs) {
        if (Array.isArray(r.encounteredClassIds)) {
          for (const c of r.encounteredClassIds) classSet.add(c);
        }
      }
      frontEncounteredClassIds = Array.from(classSet).sort((a, b) => a - b);
    }

    const frontStatus = isFrontSingleRun
      ? 'valid'
      : (frontRunCount === 0 ? 'empty' : 'ambiguous');

    // Side horizontal raster slice
    let sideStatus = 'unavailable';
    let sideRunCount = 0;
    let isSideSingleRun = false;
    let sideProfileSpanCm = null;
    let sideMinUcm = null;
    let sideMaxUcm = null;
    let sideEncounteredClassIds = [];

    if (isSideRasterAvailable) {
      const sideSlice = sampleSideHorizontalRasterSlice(sideRaster, {
        widthPx: sideWidthPx,
        heightPx: sideHeightPx,
        yCm: continuousY,
        targetClassIds,
        workspaceExtentCm,
      });

      sideRunCount = sideSlice?.runs?.length ?? 0;
      isSideSingleRun = sideRunCount === 1 && (sideSlice?.runs[0]?.pixelCount ?? 0) > 0;
      const sideRun = isSideSingleRun ? sideSlice.runs[0] : null;

      sideProfileSpanCm = sideRun
        ? Number((sideRun.boundsCm.maxU - sideRun.boundsCm.minU).toFixed(4))
        : null;
      sideMinUcm = sideRun ? Number(sideRun.boundsCm.minU.toFixed(4)) : null;
      sideMaxUcm = sideRun ? Number(sideRun.boundsCm.maxU.toFixed(4)) : null;

      if (isSideSingleRun) {
        sideEncounteredClassIds = Array.isArray(sideRun.encounteredClassIds) ? [...sideRun.encounteredClassIds] : [];
      } else if (sideRunCount > 0) {
        const classSet = new Set();
        for (const r of sideSlice.runs) {
          if (Array.isArray(r.encounteredClassIds)) {
            for (const c of r.encounteredClassIds) classSet.add(c);
          }
        }
        sideEncounteredClassIds = Array.from(classSet).sort((a, b) => a - b);
      }

      sideStatus = isSideSingleRun
        ? 'valid'
        : (sideRunCount === 0 ? 'empty' : 'ambiguous');
    }

    // Side arbitrary-Y physical depth qualification
    const depthQualResult = isSideRasterAvailable
      ? evaluateArbitraryYSidePhysicalDepthQualification({
          status: sideStatus,
          runCount: sideRunCount,
          profileSpanCm: sideProfileSpanCm,
          minUcm: sideMinUcm,
          maxUcm: sideMaxUcm,
          encounteredClassIds: sideEncounteredClassIds,
          isSingleSupportedRun: isSideSingleRun,
          yCm: continuousY,
          rasterRow: currentRow,
        }, {
          metricCalibrationProvenance: metricCalibrationSide,
          sidePoseQualification,
          sideViewOrientationQualification,
          clothingSemantics: resolvedClothingSemantics,
          yCm: continuousY,
          rasterRow: currentRow,
          supportPolicyId: supportPolicy.id,
        })
      : null;

    const qualifiedApDepthCm = depthQualResult?.qualifiedApDepthCm ?? null;
    const depthQualificationStatus = depthQualResult?.status ?? 'unavailable';
    const isSideDepthQualified = depthQualResult?.isQualified === true;

    // Modeled Perimeter Candidate Score (Ramanujan II Ellipse)
    let modeledPerimeterScoreCm = null;
    let perimeterModel = null;
    if (
      isFrontSingleRun
      && typeof frontWidthCm === 'number'
      && frontWidthCm > 0
      && isSideDepthQualified
      && typeof qualifiedApDepthCm === 'number'
      && qualifiedApDepthCm > 0
    ) {
      const ellipseResult = computeRamanujanEllipsePerimeter(frontWidthCm, qualifiedApDepthCm);
      if (ellipseResult && typeof ellipseResult.perimeterCm === 'number') {
        modeledPerimeterScoreCm = Number(ellipseResult.perimeterCm.toFixed(4));
        perimeterModel = {
          implementation: 'ellipse_ramanujan_ii',
          semiMajorAxisCm: Number(ellipseResult.semiMajorAxisCm.toFixed(4)),
          semiMinorAxisCm: Number(ellipseResult.semiMinorAxisCm.toFixed(4)),
          hParameter: Number(ellipseResult.hParameter.toFixed(6)),
        };
      }
    }

    const isCandidateValid = isFrontSingleRun && isSideSingleRun && isSideDepthQualified;

    const candidate = {
      yCm: Number(continuousY.toFixed(4)),
      rasterRow: currentRow,
      rowNormalizedV: Number(rowNormalizedV.toFixed(6)),
      front: {
        status: frontStatus,
        runCount: frontRunCount,
        widthCm: frontWidthCm,
        minXcm: frontMinXcm,
        maxXcm: frontMaxXcm,
        encounteredClassIds: frontEncounteredClassIds,
        isSingleSupportedRun: isFrontSingleRun,
      },
      side: {
        status: sideStatus,
        runCount: sideRunCount,
        profileSpanCm: sideProfileSpanCm,
        minUcm: sideMinUcm,
        maxUcm: sideMaxUcm,
        encounteredClassIds: sideEncounteredClassIds,
        isSingleSupportedRun: isSideSingleRun,
        qualifiedApDepthCm,
        depthQualificationStatus,
        isQualified: isSideDepthQualified,
        qualificationChecks: depthQualResult?.checks ?? [],
      },
      modeledPerimeterScoreCm,
      perimeterModel,
      isCandidateValid,
    };

    candidates.push(candidate);

    // 6. Detect Lower Boundary Split Transition
    if (!splitDetected) {
      if (frontRunCount >= 2) {
        splitDetected = true;
        firstSplitRow = currentRow;
        firstSplitYcm = Number(continuousY.toFixed(4));
        splitReason = 'front_silhouette_split_into_multiple_runs';
        transitionRows.push(candidate);
      } else if (frontRunCount === 0 && offset > 0) {
        splitDetected = true;
        firstSplitRow = currentRow;
        firstSplitYcm = Number(continuousY.toFixed(4));
        splitReason = 'front_silhouette_empty_discontinuous';
        transitionRows.push(candidate);
      }
    } else {
      transitionRows.push(candidate);
      rowsScannedAfterSplit += 1;
      if (rowsScannedAfterSplit >= transitionObservationBufferRows) {
        break; // Captured sufficient transition observation buffer
      }
    }
  }

  // 7. Assemble Lower Boundary Evidence
  const lowerBoundaryEvidence = {
    status: splitDetected
      ? 'transition_detected'
      : (candidates.length > 0 ? 'search_limit_reached' : 'unavailable'),
    firstSplitRow,
    firstSplitYcm,
    splitReason: splitReason ?? (candidates.length > 0 ? 'reached_search_limit_without_split' : 'no_candidates_evaluated'),
    transitionRows,
  };

  // 8. Determine Scan Status
  let status = PELVIC_ARBITRARY_Y_SCAN_STATUS.COMPLETED;

  if (candidates.length === 0) {
    status = PELVIC_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE;
  } else if (!isSideRasterAvailable || !splitDetected) {
    status = PELVIC_ARBITRARY_Y_SCAN_STATUS.PARTIAL;
  }

  const validCandidateCount = candidates.filter((c) => c.isCandidateValid).length;

  return {
    contract: PELVIC_ARBITRARY_Y_SCAN_CONTRACT,
    version: PELVIC_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
    status,
    scanDirection: 'downward',
    supportPolicyId: supportPolicy.id,
    targetClassIds,
    upperBound: {
      yCm: hipAnchorYcm,
      rasterRow: startRow,
      sourceLevel: 'hip',
    },
    lowerBoundaryEvidence,
    candidateCount: candidates.length,
    validCandidateCount,
    candidates,
    prerequisites,
    blockers,
    warnings,
    issues,
  };
}

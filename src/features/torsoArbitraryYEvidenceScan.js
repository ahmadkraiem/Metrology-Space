/**
 * Torso Arbitrary-Y Evidence Scan Contract v0
 *
 * Pure deterministic domain contract that scans the torso/trunk region bounded
 * between the Shoulder Landmark Level and the Hip Landmark Level.
 *
 * Contract: 'torso-arbitrary-y-evidence-scan-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence collection only: collects continuous transverse width and profile span evidence
 *   across canonical Y rows between ready Shoulder and Hip anatomical reference levels.
 * - Upper bound is anchored strictly at the ready Shoulder Landmark Y level.
 * - Lower bound is anchored strictly at the ready Hip Landmark Y level.
 * - Preserves native raster row sampling with exact integer row index and mapped continuous Y in cm.
 * - Reuses trunk_core_support_v0 ([22, 23]) representing exposed torso skin and upper garments.
 * - Gathers Front transverse width endpoints (leftXcm, rightXcm), Side profile span (minUcm, maxUcm),
 *   Side physical AP depth qualification, and modeled envelope candidate score (Ramanujan II ellipse).
 * - Front and Side observations for any candidate refer to the exact same canonical Y plane.
 * - Zero fixed anthropometric proportions or height percentage heuristics.
 */

import { DEFAULT_WORKSPACE_EXTENT_CM, canonicalYToPixelRow } from '../core/pixelMetrologyMapping.js';
import { sampleFrontHorizontalRasterSlice } from './frontRasterSlice.js';
import { sampleSideHorizontalRasterSlice } from './sideRasterSlice.js';
import { MEASUREMENT_SUPPORT_POLICIES_V0 } from './measurementSupportPolicy.js';
import { computeAnatomicalLevels } from './anatomicalLevels.js';
import { evaluateArbitraryYSidePhysicalDepthQualification } from './arbitraryYSidePhysicalDepthQualification.js';
import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

export const TORSO_ARBITRARY_Y_SCAN_CONTRACT = 'torso-arbitrary-y-evidence-scan-v0';
export const TORSO_ARBITRARY_Y_SCAN_CONTRACT_VERSION = 'torso-arbitrary-y-evidence-scan-v0';

/**
 * Authoritative 4-state scan status taxonomy.
 * @type {Readonly<{
 *   COMPLETED: 'completed',
 *   PARTIAL: 'partial',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const TORSO_ARBITRARY_Y_SCAN_STATUS = Object.freeze({
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Blocker reason codes for torso arbitrary-Y evidence scan.
 * @type {Readonly<Record<string, string>>}
 */
export const TORSO_SCAN_BLOCKER_CODES = Object.freeze({
  SHOULDER_ANCHOR_LEVEL_UNAVAILABLE: 'shoulder_anchor_level_unavailable',
  HIP_ANCHOR_LEVEL_UNAVAILABLE: 'hip_anchor_level_unavailable',
  INVALID_ANATOMICAL_LEVEL_ORDERING: 'invalid_anatomical_level_ordering',
  FRONT_SEGMENTATION_UNAVAILABLE: 'front_segmentation_unavailable',
  SIDE_SEGMENTATION_UNAVAILABLE: 'side_segmentation_unavailable',
  METRIC_CALIBRATION_UNAVAILABLE: 'metric_calibration_unavailable',
  OUT_OF_BOUNDS_SCAN_INTERVAL: 'out_of_bounds_scan_interval',
});

/**
 * Builds an empty or unavailable torso scan result.
 */
function buildEmptyTorsoScanResult({
  status = TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
  shoulderAnchorYcm = null,
  shoulderStartRow = null,
  hipAnchorYcm = null,
  hipEndRow = null,
  supportPolicyId = 'trunk_core_support_v0',
  targetClassIds = [22, 23],
  blockers = [],
  warnings = [],
  issues = [],
  prerequisites = {},
} = {}) {
  return {
    contract: TORSO_ARBITRARY_Y_SCAN_CONTRACT,
    version: TORSO_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
    status,
    scanDirection: 'downward',
    supportPolicyId,
    targetClassIds,
    upperBound: {
      yCm: shoulderAnchorYcm,
      rasterRow: shoulderStartRow,
      sourceLevel: 'shoulder',
    },
    lowerBound: {
      yCm: hipAnchorYcm,
      rasterRow: hipEndRow,
      sourceLevel: 'hip',
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
 * Evaluates a deterministic Torso Arbitrary-Y Evidence Scan between Shoulder Landmark level
 * and Hip Landmark level.
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
 *   clothingSemanticsSide?: object|null,
 *   clothingSemantics?: object|null,
 *   options?: {
 *     workspaceExtentCm?: number,
 *     maxScanRows?: number|null,
 *   },
 * }} input
 * @returns {object} TorsoArbitraryYEvidenceScanResultV0
 */
export function evaluateTorsoArbitraryYEvidenceScan({
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
  const maxScanRows = options?.maxScanRows ?? null;

  const supportPolicy = MEASUREMENT_SUPPORT_POLICIES_V0.trunk_core_support_v0;
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
      blockers.push(TORSO_SCAN_BLOCKER_CODES.FRONT_SEGMENTATION_UNAVAILABLE);
      issues.push('Front segmentation metadata is unavailable.');
      return buildEmptyTorsoScanResult({
        status: TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
        blockers,
        warnings,
        issues,
        prerequisites,
      });
    }
    issues.push(`Invalid Front segmentation raster dimensions: widthPx (${frontWidthPx}), heightPx (${frontHeightPx}).`);
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.INVALID,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  const expectedFrontLength = frontWidthPx * frontHeightPx;
  if (!frontRaster || typeof frontRaster.length !== 'number' || frontRaster.length < expectedFrontLength) {
    blockers.push(TORSO_SCAN_BLOCKER_CODES.FRONT_SEGMENTATION_UNAVAILABLE);
    issues.push(`Front segmentation raster buffer is missing or incomplete (expected ${expectedFrontLength} bytes).`);
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  // 2. Resolve Shoulder and Hip Reference Levels
  const resolvedLevelsReport = levelsReport ?? computeAnatomicalLevels(Array.isArray(annotations) ? annotations : []);
  const shoulderLevel = resolvedLevelsReport?.levels?.find((l) => l.id === 'shoulder') ?? null;
  const hipLevel = resolvedLevelsReport?.levels?.find((l) => l.id === 'hip') ?? null;

  if (!shoulderLevel || shoulderLevel.status !== 'ready' || typeof shoulderLevel.yCm !== 'number' || !Number.isFinite(shoulderLevel.yCm)) {
    blockers.push(TORSO_SCAN_BLOCKER_CODES.SHOULDER_ANCHOR_LEVEL_UNAVAILABLE);
    issues.push("Shoulder anatomical reference level is not ready. Torso arbitrary-Y scan requires a ready 'shoulder' reference anchor.");
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  if (!hipLevel || hipLevel.status !== 'ready' || typeof hipLevel.yCm !== 'number' || !Number.isFinite(hipLevel.yCm)) {
    blockers.push(TORSO_SCAN_BLOCKER_CODES.HIP_ANCHOR_LEVEL_UNAVAILABLE);
    issues.push("Hip anatomical reference level is not ready. Torso arbitrary-Y scan requires a ready 'hip' reference anchor.");
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE,
      shoulderAnchorYcm: shoulderLevel.yCm,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  const shoulderAnchorYcm = shoulderLevel.yCm;
  const hipAnchorYcm = hipLevel.yCm;

  if (shoulderAnchorYcm <= hipAnchorYcm) {
    blockers.push(TORSO_SCAN_BLOCKER_CODES.INVALID_ANATOMICAL_LEVEL_ORDERING);
    issues.push(`Invalid anatomical ordering: Shoulder level Y (${shoulderAnchorYcm} cm) must be strictly higher elevation than Hip level Y (${hipAnchorYcm} cm).`);
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.INVALID,
      shoulderAnchorYcm,
      hipAnchorYcm,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  // 3. Map Starting and Ending Pixel Rows
  const startRowMapping = canonicalYToPixelRow(shoulderAnchorYcm, frontHeightPx, workspaceExtentCm);
  const endRowMapping = canonicalYToPixelRow(hipAnchorYcm, frontHeightPx, workspaceExtentCm);

  if (!startRowMapping || !endRowMapping) {
    blockers.push(TORSO_SCAN_BLOCKER_CODES.OUT_OF_BOUNDS_SCAN_INTERVAL);
    issues.push(`Shoulder (${shoulderAnchorYcm} cm) or Hip (${hipAnchorYcm} cm) elevation is outside valid metrology domain [0, ${workspaceExtentCm}].`);
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.INVALID,
      shoulderAnchorYcm,
      hipAnchorYcm,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

  const shoulderStartRow = startRowMapping.row;
  const hipEndRow = endRowMapping.row;

  if (shoulderStartRow >= hipEndRow) {
    blockers.push(TORSO_SCAN_BLOCKER_CODES.OUT_OF_BOUNDS_SCAN_INTERVAL);
    issues.push(`Pixel row interval between Shoulder (row ${shoulderStartRow}) and Hip (row ${hipEndRow}) is non-positive.`);
    return buildEmptyTorsoScanResult({
      status: TORSO_ARBITRARY_Y_SCAN_STATUS.INVALID,
      shoulderAnchorYcm,
      shoulderStartRow,
      hipAnchorYcm,
      hipEndRow,
      blockers,
      warnings,
      issues,
      prerequisites,
    });
  }

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
    warnings.push('Side segmentation raster is unavailable or incomplete. Torso scan will collect Front evidence only (status: partial).');
  }

  // 5. Execute Downward Scan Loop from Shoulder row to Hip row
  const candidates = [];
  const rowCount = (hipEndRow - shoulderStartRow) + 1;
  const maxRowsToProcess = typeof maxScanRows === 'number' && maxScanRows > 0
    ? Math.min(rowCount, maxScanRows)
    : rowCount;

  for (let offset = 0; offset < maxRowsToProcess; offset += 1) {
    const currentRow = shoulderStartRow + offset;
    if (currentRow > frontHeightPx - 1) break;

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
    let sideRow = null;

    if (isSideRasterAvailable) {
      const sideSlice = sampleSideHorizontalRasterSlice(sideRaster, {
        widthPx: sideWidthPx,
        heightPx: sideHeightPx,
        yCm: continuousY,
        targetClassIds,
        workspaceExtentCm,
      });

      sideRow = sideSlice?.sampledRow ?? null;
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
          rasterRow: sideRow,
        }, {
          metricCalibrationProvenance: metricCalibrationSide,
          sidePoseQualification,
          sideViewOrientationQualification,
          clothingSemantics: resolvedClothingSemantics,
          yCm: continuousY,
          rasterRow: sideRow,
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

    const isCandidateValid = isFrontSingleRun && (!isSideRasterAvailable || (isSideSingleRun && isSideDepthQualified));

    const candidate = {
      yCm: Number(continuousY.toFixed(4)),
      rasterRow: currentRow,
      sideRasterRow: sideRow,
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
        rasterRow: sideRow,
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
  }

  // 6. Determine Scan Status
  let status = TORSO_ARBITRARY_Y_SCAN_STATUS.COMPLETED;

  if (candidates.length === 0) {
    status = TORSO_ARBITRARY_Y_SCAN_STATUS.UNAVAILABLE;
  } else if (!isSideRasterAvailable) {
    status = TORSO_ARBITRARY_Y_SCAN_STATUS.PARTIAL;
  }

  const validCandidateCount = candidates.filter((c) => c.isCandidateValid).length;

  return {
    contract: TORSO_ARBITRARY_Y_SCAN_CONTRACT,
    version: TORSO_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
    status,
    scanDirection: 'downward',
    supportPolicyId: supportPolicy.id,
    targetClassIds,
    upperBound: {
      yCm: shoulderAnchorYcm,
      rasterRow: shoulderStartRow,
      sourceLevel: 'shoulder',
    },
    lowerBound: {
      yCm: hipAnchorYcm,
      rasterRow: hipEndRow,
      sourceLevel: 'hip',
    },
    candidateCount: candidates.length,
    validCandidateCount,
    candidates,
    prerequisites,
    blockers,
    warnings,
    issues,
  };
}

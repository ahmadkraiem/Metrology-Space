/**
 * Metric Calibration Provenance Contract v0
 *
 * Pure deterministic validation layer for shared package- and view-level metric calibration provenance.
 * Validates upstream scaling ratios, isotropic scale consistency, standardized canvas extents,
 * active raster shape matching, and workspace scale agreement across Front and Side views.
 *
 * Contract: 'metric-calibration-provenance-v0'
 *
 * STRICT GUARDRAILS:
 * - Shared contract: applies symmetrically to Front and Side views.
 * - 'validated' status grants 'metricProjectedEligibility' (2D image-plane metric scaling only).
 * - Does NOT grant physical anatomical depth or width semantics (evaluated in physicalMeasurementSemantics.js).
 * - Does NOT convert U to canonical Z, does NOT fuse Front/Side coordinates, and does NOT compute 3D geometry.
 */

import { ROOM_SIZE } from '../core/constants.js';

export const METRIC_CALIBRATION_PROVENANCE_CONTRACT = 'metric-calibration-provenance-v0';
export const METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION = 'metric-calibration-provenance-v0';

/**
 * Deterministic status taxonomy for Metric Calibration Provenance.
 * @readonly
 * @enum {string}
 */
export const METRIC_CALIBRATION_STATUS = Object.freeze({
  VALIDATED: 'validated',
  UNVALIDATED: 'unvalidated',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

/**
 * Numeric tolerance for isotropic scale ratio comparisons (legacy).
 * Retained for backward-compatible export; the primary isotropic check now uses
 * pixel-domain rounding validation via ISOTROPIC_ROUNDING_TOLERANCE_PX.
 */
export const SCALE_FACTOR_NUMERIC_TOLERANCE = 1e-4;

/**
 * Pixel-domain tolerance for isotropic scaling validation.
 *
 * Upstream rasterization (e.g. body/Align) applies a single scalar scaleFactor to both
 * width and height, then rounds each axis independently to the nearest integer pixel.
 * This rounding can cause the realized ratio scaledPx/originalPx to deviate from the
 * declared scaleFactor by up to ~0.5/min(originalW,originalH) per axis.
 *
 * A tolerance of 1.0 pixel accommodates normal integer rounding while still rejecting
 * materially contradictory metadata (e.g. a 2-pixel discrepancy in a 400 px crop
 * implies the scaleFactor is wrong, not a rounding artifact).
 *
 * Validation rule per axis:
 *   |actualScaledPx - (originalPx × scaleFactor)| ≤ ISOTROPIC_ROUNDING_TOLERANCE_PX
 */
export const ISOTROPIC_ROUNDING_TOLERANCE_PX = 1.0;

/** Numeric tolerance for canvas metric extent in cm compared to ROOM_SIZE (200 cm). */
export const CANVAS_EXTENT_NUMERIC_TOLERANCE_CM = 1e-4;

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   status: 'pass'|'fail'|'warning'|'skip',
 *   message: string,
 * }} MetricCalibrationCheckResult
 */

/**
 * @typedef {{
 *   contract: 'metric-calibration-provenance-v0',
 *   version: 'metric-calibration-provenance-v0',
 *   view: 'front'|'side'|string|null,
 *   status: 'validated'|'unvalidated'|'invalid'|'unavailable',
 *   metricProjectedEligibility: boolean,
 *   scaleCmPerPx: number|null,
 *   calibration: object|null,
 *   summary: {
 *     totalChecks: number,
 *     passedChecks: number,
 *     failedChecks: number,
 *     warnedChecks: number,
 *     skippedChecks: number,
 *   },
 *   checks: Record<string, MetricCalibrationCheckResult>,
 *   issues: string[],
 *   warnings: string[],
 * }} MetricCalibrationProvenanceResultV0
 */

/**
 * Evaluates pure deterministic metric calibration provenance for a single view.
 *
 * @param {object|null|undefined} packageCalibration - Top-level package calibration declarations
 * @param {object|null|undefined} viewCalibration - View-specific calibration provenance
 * @param {{ widthPx: number, heightPx: number }|null|undefined} viewRasterDimensions - Active view raster dimensions
 * @param {{ view?: 'front'|'side'|string|null, workspaceExtentCm?: number }} [options]
 * @returns {MetricCalibrationProvenanceResultV0}
 */
export function evaluateMetricCalibrationProvenance(
  packageCalibration,
  viewCalibration,
  viewRasterDimensions,
  { view = null, workspaceExtentCm = ROOM_SIZE } = {},
) {
  const issues = [];
  const warnings = [];
  const checks = {};

  const resolvedView = view ?? viewCalibration?.view ?? null;

  function recordCheck(checkId, name, checkStatus, message) {
    checks[checkId] = {
      id: checkId,
      name,
      status: checkStatus,
      message,
    };
    if (checkStatus === 'fail') {
      issues.push(`[${checkId}] ${message}`);
    } else if (checkStatus === 'warning') {
      warnings.push(`[${checkId}] ${message}`);
    }
  }

  // 1. Package Calibration Existence
  if (!packageCalibration || typeof packageCalibration !== 'object') {
    recordCheck(
      'calibration_declared',
      'Calibration Metadata Declaration',
      'skip',
      'No package calibration metadata present; uncalibrated legacy package.',
    );
    const allChecks = Object.values(checks);
    return {
      contract: METRIC_CALIBRATION_PROVENANCE_CONTRACT,
      version: METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION,
      view: resolvedView,
      status: METRIC_CALIBRATION_STATUS.UNVALIDATED,
      metricProjectedEligibility: false,
      scaleCmPerPx: null,
      calibration: null,
      summary: {
        totalChecks: allChecks.length,
        passedChecks: 0,
        failedChecks: 0,
        warnedChecks: 0,
        skippedChecks: allChecks.length,
      },
      checks,
      issues,
      warnings,
    };
  }

  let isInvalid = false;

  // 2. Metric Scale Declaration Check (pixelsPerCm)
  const pixelsPerCm = packageCalibration.pixelsPerCm;
  if (typeof pixelsPerCm !== 'number' || !Number.isFinite(pixelsPerCm) || pixelsPerCm <= 0) {
    recordCheck(
      'metric_scale_declared',
      'Metric Scale Declaration',
      'fail',
      `Invalid pixelsPerCm: expected positive finite number, received ${pixelsPerCm}.`,
    );
    isInvalid = true;
  } else {
    recordCheck(
      'metric_scale_declared',
      'Metric Scale Declaration',
      'pass',
      `Declared metric scale: ${pixelsPerCm} px/cm (${1 / pixelsPerCm} cm/px).`,
    );
  }

  // 3. Isotropic / Uniform Scaling Check
  //
  // Upstream Align stages provide a single scalar scaleFactor per view (uniform scalar scaling).
  // REVacity does not take an adapter's "isIsotropic: true" assertion as authoritative truth;
  // instead, REVacity independently validates uniform/isotropic scaling consistency in the
  // pixel domain against the declared scaleFactor and crop dimensions.
  const declaredIsIsotropic = packageCalibration?.isIsotropic;
  const origW = viewCalibration?.originalImageWidthPx;
  const origH = viewCalibration?.originalImageHeightPx;
  const scaledW = viewCalibration?.scaledWidthPx;
  const scaledH = viewCalibration?.scaledHeightPx;
  const scaleFactor = viewCalibration?.scaleFactor;

  let isotropicPass = true;
  if (declaredIsIsotropic === false) {
    recordCheck(
      'isotropic_scale_validated',
      'Isotropic Scale Validation',
      'fail',
      'Non-isotropic scaling declared: isIsotropic=false. Non-uniform scaling invalidates metric calibration.',
    );
    isotropicPass = false;
    isInvalid = true;
  } else if (
    typeof origW === 'number' && origW > 0
    && typeof origH === 'number' && origH > 0
    && typeof scaledW === 'number' && scaledW > 0
    && typeof scaledH === 'number' && scaledH > 0
    && typeof scaleFactor === 'number' && scaleFactor > 0
  ) {
    // Pixel-domain rounding-aware validation:
    // Compute the expected scaled dimension from the declared scaleFactor,
    // then verify the actual integer pixel is within ±ISOTROPIC_ROUNDING_TOLERANCE_PX.
    const expectedW = origW * scaleFactor;
    const expectedH = origH * scaleFactor;
    const pixelDiffW = Math.abs(scaledW - expectedW);
    const pixelDiffH = Math.abs(scaledH - expectedH);

    if (pixelDiffW > ISOTROPIC_ROUNDING_TOLERANCE_PX || pixelDiffH > ISOTROPIC_ROUNDING_TOLERANCE_PX) {
      recordCheck(
        'isotropic_scale_validated',
        'Isotropic Scale Validation',
        'fail',
        `Contradictory scaled dimensions: expected [${expectedW.toFixed(2)}×${expectedH.toFixed(2)}] from scaleFactor ${scaleFactor}, got [${scaledW}×${scaledH}]. Pixel deltas: width=${pixelDiffW.toFixed(4)}, height=${pixelDiffH.toFixed(4)} exceed tolerance ${ISOTROPIC_ROUNDING_TOLERANCE_PX} px.`,
      );
      isotropicPass = false;
      isInvalid = true;
    }
  } else if (declaredIsIsotropic !== true && typeof scaleFactor !== 'number') {
    recordCheck(
      'isotropic_scale_validated',
      'Isotropic Scale Validation',
      'fail',
      'No uniform scaleFactor or isotropic scaling declaration present to validate scaling geometry.',
    );
    isotropicPass = false;
    isInvalid = true;
  }

  if (isotropicPass && declaredIsIsotropic !== false) {
    recordCheck(
      'isotropic_scale_validated',
      'Isotropic Scale Validation',
      'pass',
      typeof scaleFactor === 'number' && scaleFactor > 0
        ? `Isotropic scaling confirmed: scaleFactor=${scaleFactor}, pixel-domain deltas within ±${ISOTROPIC_ROUNDING_TOLERANCE_PX} px.`
        : 'Isotropic scaling declared; no per-axis dimensions available for cross-validation.',
    );
  }

  // 4. Standardized Canvas Extent Consistency Check (Full 2D: Width and Height)
  const canvasW = packageCalibration.standardizedCanvasWidthPx;
  const canvasH = packageCalibration.standardizedCanvasHeightPx;

  if (
    typeof canvasW !== 'number' || !Number.isInteger(canvasW) || canvasW <= 0
    || typeof canvasH !== 'number' || !Number.isInteger(canvasH) || canvasH <= 0
    || typeof pixelsPerCm !== 'number' || pixelsPerCm <= 0
  ) {
    recordCheck(
      'canvas_extent_consistent',
      'Standardized Canvas Metric Extent',
      'fail',
      `Invalid canvas dimensions: canvasWidthPx=${canvasW}, canvasHeightPx=${canvasH}.`,
    );
    isInvalid = true;
  } else {
    const extentWCm = canvasW / pixelsPerCm;
    const extentHCm = canvasH / pixelsPerCm;
    const diffW = Math.abs(extentWCm - workspaceExtentCm);
    const diffH = Math.abs(extentHCm - workspaceExtentCm);

    if (diffW > CANVAS_EXTENT_NUMERIC_TOLERANCE_CM || diffH > CANVAS_EXTENT_NUMERIC_TOLERANCE_CM) {
      recordCheck(
        'canvas_extent_consistent',
        'Standardized Canvas Metric Extent',
        'fail',
        `Canvas metric extent (${extentWCm}x${extentHCm} cm) does not match metrology workspace extent (${workspaceExtentCm} cm).`,
      );
      isInvalid = true;
    } else {
      recordCheck(
        'canvas_extent_consistent',
        'Standardized Canvas Metric Extent',
        'pass',
        `Canvas extent (${canvasW}x${canvasH} px at ${pixelsPerCm} px/cm) matches ${workspaceExtentCm} cm workspace.`,
      );
    }
  }

  // 5. Active Raster Dimensions Match Canvas
  const rasterW = viewRasterDimensions?.widthPx;
  const rasterH = viewRasterDimensions?.heightPx;

  if (
    typeof rasterW !== 'number' || rasterW <= 0
    || typeof rasterH !== 'number' || rasterH <= 0
  ) {
    recordCheck(
      'raster_dimensions_match_canvas',
      'Active Raster Dimensions Match',
      'fail',
      'Missing or invalid active view raster dimensions.',
    );
    isInvalid = true;
  } else if (rasterW !== canvasW || rasterH !== canvasH) {
    recordCheck(
      'raster_dimensions_match_canvas',
      'Active Raster Dimensions Match',
      'fail',
      `Active view raster shape [${rasterH}x${rasterW}] does not match standardized canvas [${canvasH}x${canvasW}].`,
    );
    isInvalid = true;
  } else {
    recordCheck(
      'raster_dimensions_match_canvas',
      'Active Raster Dimensions Match',
      'pass',
      `Active raster dimensions [${rasterH}x${rasterW}] match standardized canvas.`,
    );
  }

  // 6. Preprocessing Provenance Completeness
  if (!viewCalibration || typeof viewCalibration !== 'object') {
    recordCheck(
      'preprocessing_provenance_complete',
      'Preprocessing Transform Provenance',
      'warning',
      'View calibration provenance object is missing.',
    );
  } else {
    const hasOffsets = typeof viewCalibration.offsetX === 'number' && Number.isFinite(viewCalibration.offsetX)
      && typeof viewCalibration.offsetY === 'number' && Number.isFinite(viewCalibration.offsetY);
    const hasScale = typeof viewCalibration.scaleFactor === 'number' && viewCalibration.scaleFactor > 0;
    const hasOrigDims = typeof viewCalibration.originalImageWidthPx === 'number' && viewCalibration.originalImageWidthPx > 0
      && typeof viewCalibration.originalImageHeightPx === 'number' && viewCalibration.originalImageHeightPx > 0;

    if (hasOffsets && hasScale && hasOrigDims) {
      recordCheck(
        'preprocessing_provenance_complete',
        'Preprocessing Transform Provenance',
        'pass',
        `Complete preprocessing provenance: original [${viewCalibration.originalImageHeightPx}x${viewCalibration.originalImageWidthPx}], scale=${viewCalibration.scaleFactor}, offsets=(${viewCalibration.offsetX}, ${viewCalibration.offsetY}).`,
      );
    } else {
      recordCheck(
        'preprocessing_provenance_complete',
        'Preprocessing Transform Provenance',
        'warning',
        'Partial preprocessing provenance: some transform metadata fields are unrecorded.',
      );
    }
  }

  // 7. Workspace Scale Matches Upstream Metric Scale
  if (typeof pixelsPerCm === 'number' && pixelsPerCm > 0 && typeof rasterW === 'number' && rasterW > 0) {
    const revacityScale = workspaceExtentCm / rasterW; // cm per pixel
    const upstreamScale = 1 / pixelsPerCm;             // cm per pixel
    const scaleDiff = Math.abs(revacityScale - upstreamScale);

    if (scaleDiff > SCALE_FACTOR_NUMERIC_TOLERANCE) {
      recordCheck(
        'workspace_scale_matches_upstream',
        'Workspace Scale Ratio Agreement',
        'fail',
        `Scale ratio mismatch: REVacity mapping (${revacityScale} cm/px) does not match upstream (${upstreamScale} cm/px).`,
      );
      isInvalid = true;
    } else {
      recordCheck(
        'workspace_scale_matches_upstream',
        'Workspace Scale Ratio Agreement',
        'pass',
        `Scale ratios agree exactly at ${revacityScale} cm/px (${pixelsPerCm} px/cm).`,
      );
    }
  }

  // Summary and Status Determination
  const allChecks = Object.values(checks);
  const totalChecks = allChecks.length;
  const passedChecks = allChecks.filter((c) => c.status === 'pass').length;
  const failedChecks = allChecks.filter((c) => c.status === 'fail').length;
  const warnedChecks = allChecks.filter((c) => c.status === 'warning').length;
  const skippedChecks = allChecks.filter((c) => c.status === 'skip').length;

  let status;
  let metricProjectedEligibility;
  let scaleCmPerPx = null;

  if (isInvalid || failedChecks > 0) {
    status = METRIC_CALIBRATION_STATUS.INVALID;
    metricProjectedEligibility = false;
  } else {
    status = METRIC_CALIBRATION_STATUS.VALIDATED;
    metricProjectedEligibility = true;
    scaleCmPerPx = (typeof pixelsPerCm === 'number' && pixelsPerCm > 0) ? (1 / pixelsPerCm) : null;
  }

  return {
    contract: METRIC_CALIBRATION_PROVENANCE_CONTRACT,
    version: METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION,
    view: resolvedView,
    status,
    metricProjectedEligibility,
    scaleCmPerPx,
    calibration: {
      declaredIsCalibrated: Boolean(packageCalibration.declaredIsCalibrated ?? packageCalibration.isCalibrated),
      metricScaleSource: packageCalibration.metricScaleSource ?? null,
      subjectHeightCm: packageCalibration.subjectHeightCm ?? null,
      pixelsPerCm: packageCalibration.pixelsPerCm ?? null,
      isIsotropic: isotropicPass,
      declaredIsIsotropic: packageCalibration.isIsotropic ?? null,
      declaredScaleModel: packageCalibration.declaredScaleModel ?? null,
      standardizedCanvasWidthPx: canvasW ?? null,
      standardizedCanvasHeightPx: canvasH ?? null,
      standardizationSource: packageCalibration.standardizationSource ?? null,
      viewCalibration: viewCalibration ? { ...viewCalibration } : null,
    },
    summary: {
      totalChecks,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
    },
    checks,
    issues,
    warnings,
  };
}

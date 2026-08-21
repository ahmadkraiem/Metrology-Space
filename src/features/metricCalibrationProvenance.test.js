import test from 'node:test';
import assert from 'node:assert/strict';

import {
  METRIC_CALIBRATION_PROVENANCE_CONTRACT,
  METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION,
  METRIC_CALIBRATION_STATUS,
  SCALE_FACTOR_NUMERIC_TOLERANCE,
  ISOTROPIC_ROUNDING_TOLERANCE_PX,
  CANVAS_EXTENT_NUMERIC_TOLERANCE_CM,
  evaluateMetricCalibrationProvenance,
} from './metricCalibrationProvenance.js';

test('Metric Calibration Provenance Contract v0 exports contract metadata and status enums', () => {
  assert.equal(METRIC_CALIBRATION_PROVENANCE_CONTRACT, 'metric-calibration-provenance-v0');
  assert.equal(METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION, 'metric-calibration-provenance-v0');

  assert.equal(METRIC_CALIBRATION_STATUS.VALIDATED, 'validated');
  assert.equal(METRIC_CALIBRATION_STATUS.UNVALIDATED, 'unvalidated');
  assert.equal(METRIC_CALIBRATION_STATUS.INVALID, 'invalid');
  assert.equal(METRIC_CALIBRATION_STATUS.UNAVAILABLE, 'unavailable');

  assert.equal(SCALE_FACTOR_NUMERIC_TOLERANCE, 1e-4);
  assert.equal(CANVAS_EXTENT_NUMERIC_TOLERANCE_CM, 1e-4);
});

test('evaluates status validated and grants metricProjectedEligibility for valid Front/Side standardized calibration', () => {
  const packageCalibration = {
    declaredIsCalibrated: true,
    metricScaleSource: 'known_subject_height',
    subjectHeightCm: 175.0,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
    standardizationSource: 'body-pipeline-standardization-v0',
  };

  const viewCalibration = {
    view: 'side',
    originalImageWidthPx: 1000,
    originalImageHeightPx: 1500,
    scaleFactor: 1.2,
    scaledWidthPx: 1200,
    scaledHeightPx: 1800,
    offsetX: 400,
    offsetY: 100,
    viewCategoryValidated: true,
    viewOrientation: 'left_profile',
  };

  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibration, rasterDims, { view: 'side' });

  assert.equal(result.contract, 'metric-calibration-provenance-v0');
  assert.equal(result.version, 'metric-calibration-provenance-v0');
  assert.equal(result.view, 'side');
  assert.equal(result.status, 'validated');
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.scaleCmPerPx, 0.1);
  assert.equal(result.summary.failedChecks, 0);
  assert.equal(result.summary.passedChecks, 6);
  assert.equal(result.issues.length, 0);
});

test('evaluates status unvalidated when package calibration metadata is missing (legacy package)', () => {
  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(null, null, rasterDims, { view: 'front' });

  assert.equal(result.status, 'unvalidated');
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.scaleCmPerPx, null);
  assert.equal(result.summary.failedChecks, 0);
  assert.equal(result.summary.skippedChecks, 1);
});

test('evaluates status invalid when scale factor is contradictory (non-isotropic / scaling contradiction)', () => {
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };

  // Scaled dimensions contradict scaleFactor: 1200 / 1000 = 1.2, but 1900 / 1500 = 1.2667 !== 1.2
  const viewCalibrationBad = {
    view: 'front',
    originalImageWidthPx: 1000,
    originalImageHeightPx: 1500,
    scaleFactor: 1.2,
    scaledWidthPx: 1200,
    scaledHeightPx: 1900,
    offsetX: 400,
    offsetY: 50,
  };

  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibrationBad, rasterDims);

  assert.equal(result.status, 'invalid');
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.checks.isotropic_scale_validated.status, 'fail');
  assert.ok(result.issues.some((i) => i.includes('Contradictory scaled dimensions')));
});

test('evaluates status invalid when canvas extent or raster dimensions do not match workspace extent', () => {
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 1800, // 1800 / 10 = 180 cm != 200 cm
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };

  const rasterDims = { widthPx: 1800, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, null, rasterDims);

  assert.equal(result.status, 'invalid');
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.checks.canvas_extent_consistent.status, 'fail');
});

test('evaluates status invalid when active raster dimensions do not match declared canvas', () => {
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };

  const rasterDimsMismatched = { widthPx: 1024, heightPx: 1024 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, null, rasterDimsMismatched);

  assert.equal(result.status, 'invalid');
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.checks.raster_dimensions_match_canvas.status, 'fail');
});

// ==================================================================================
// Rounding-Aware Isotropic Scaling Tests
// ==================================================================================

test('ISOTROPIC_ROUNDING_TOLERANCE_PX is exported at 1.0 pixel', () => {
  assert.equal(ISOTROPIC_ROUNDING_TOLERANCE_PX, 1.0);
});

test('real Front integer-rounded dimensions pass isotropic validation', () => {
  // Real case: crop 564×1283, scaleFactor 1.3172252533125488, scaled 743×1690
  // Width: 564 × 1.3172252533125488 = 742.91... → 743 (delta 0.0880)
  // Height: 1283 × 1.3172252533125488 = 1689.99... → 1690 (delta 0.0000)
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };
  const viewCalibration = {
    view: 'front',
    originalImageWidthPx: 564,
    originalImageHeightPx: 1283,
    scaleFactor: 1.3172252533125488,
    scaledWidthPx: 743,
    scaledHeightPx: 1690,
    offsetX: 628,
    offsetY: 310,
  };
  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibration, rasterDims, { view: 'front' });

  assert.equal(result.status, 'validated');
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.scaleCmPerPx, 0.1);
  assert.equal(result.checks.isotropic_scale_validated.status, 'pass');
});

test('real Side integer-rounded dimensions pass isotropic validation', () => {
  // Real case: crop 386×1133, scaleFactor 1.4916151809355693, scaled 576×1690
  // Width: 386 × 1.4916151809355693 = 575.76... → 576 (delta 0.2415)
  // Height: 1133 × 1.4916151809355693 = 1689.99... → 1690 (delta 0.0000)
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };
  const viewCalibration = {
    view: 'side',
    originalImageWidthPx: 386,
    originalImageHeightPx: 1133,
    scaleFactor: 1.4916151809355693,
    scaledWidthPx: 576,
    scaledHeightPx: 1690,
    offsetX: 712,
    offsetY: 310,
  };
  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibration, rasterDims, { view: 'side' });

  assert.equal(result.status, 'validated');
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.scaleCmPerPx, 0.1);
  assert.equal(result.checks.isotropic_scale_validated.status, 'pass');
});

test('exact (non-rounded) scaled dimensions pass isotropic validation', () => {
  // Exact case: 1000 × 1.2 = 1200, 1500 × 1.2 = 1800 — zero delta
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };
  const viewCalibration = {
    view: 'front',
    originalImageWidthPx: 1000,
    originalImageHeightPx: 1500,
    scaleFactor: 1.2,
    scaledWidthPx: 1200,
    scaledHeightPx: 1800,
    offsetX: 400,
    offsetY: 100,
  };
  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibration, rasterDims, { view: 'front' });

  assert.equal(result.status, 'validated');
  assert.equal(result.checks.isotropic_scale_validated.status, 'pass');
});

test('materially inconsistent width/height scaling fails isotropic validation', () => {
  // Contradictory case: scaleFactor 1.2 on height 1500 → expected 1800, got 1900 (delta=100 >> 1.0)
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    isIsotropic: true,
  };
  const viewCalibration = {
    view: 'front',
    originalImageWidthPx: 1000,
    originalImageHeightPx: 1500,
    scaleFactor: 1.2,
    scaledWidthPx: 1200,
    scaledHeightPx: 1900, // Should be 1800 = 1500 × 1.2
    offsetX: 400,
    offsetY: 50,
  };
  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibration, rasterDims);

  assert.equal(result.status, 'invalid');
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.checks.isotropic_scale_validated.status, 'fail');
  assert.ok(result.issues.some((i) => i.includes('Contradictory scaled dimensions')));
});

test('independently validates isotropic scaling when isIsotropic is not declared in package', () => {
  // Package does NOT declare isIsotropic: true (e.g. from real Align result)
  const packageCalibration = {
    declaredIsCalibrated: true,
    pixelsPerCm: 10.0,
    standardizedCanvasWidthPx: 2000,
    standardizedCanvasHeightPx: 2000,
    declaredScaleModel: 'uniform_scalar',
  };
  const viewCalibration = {
    view: 'front',
    originalImageWidthPx: 564,
    originalImageHeightPx: 1283,
    scaleFactor: 1.3172252533125488,
    scaledWidthPx: 743,
    scaledHeightPx: 1690,
    offsetX: 628,
    offsetY: 310,
  };
  const rasterDims = { widthPx: 2000, heightPx: 2000 };

  const result = evaluateMetricCalibrationProvenance(packageCalibration, viewCalibration, rasterDims, { view: 'front' });

  assert.equal(result.status, 'validated');
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.scaleCmPerPx, 0.1);
  assert.equal(result.checks.isotropic_scale_validated.status, 'pass');
  assert.equal(result.calibration.isIsotropic, true);
});


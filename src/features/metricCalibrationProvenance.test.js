import test from 'node:test';
import assert from 'node:assert/strict';

import {
  METRIC_CALIBRATION_PROVENANCE_CONTRACT,
  METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION,
  METRIC_CALIBRATION_STATUS,
  SCALE_FACTOR_NUMERIC_TOLERANCE,
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
  assert.ok(result.issues.some((i) => i.includes('Contradictory scale ratios')));
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

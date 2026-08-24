import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT,
  PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT_VERSION,
  PHYSICAL_SEMANTICS_STATUS,
  SUPPORTED_PHYSICAL_EVIDENCE_CONTRACTS,
  SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0,
  evaluatePhysicalMeasurementSemantics,
} from './physicalMeasurementSemantics.js';

import {
  AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
  AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
} from './authoritativePhysicalEvidenceSemantics.js';

test('Physical Measurement Semantics Contract v0 exports metadata, status enums, and registry', () => {
  assert.equal(PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT, 'physical-measurement-semantics-v0');
  assert.equal(PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT_VERSION, 'physical-measurement-semantics-v0');

  assert.equal(PHYSICAL_SEMANTICS_STATUS.VALIDATED, 'validated');
  assert.equal(PHYSICAL_SEMANTICS_STATUS.PROJECTED_METRIC_ONLY, 'projected_metric_only');
  assert.equal(PHYSICAL_SEMANTICS_STATUS.UNVALIDATED, 'unvalidated');
  assert.equal(PHYSICAL_SEMANTICS_STATUS.INVALID, 'invalid');
  assert.equal(PHYSICAL_SEMANTICS_STATUS.UNAVAILABLE, 'unavailable');

  assert.ok(SUPPORTED_PHYSICAL_EVIDENCE_CONTRACTS.includes('controlled-capture-protocol-v0'));
  assert.ok(SUPPORTED_PHYSICAL_EVIDENCE_CONTRACTS.includes('calibrated-camera-projection-v0'));

  assert.ok(SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0.torso_transverse_width_at_shoulder_level);
  assert.ok(SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0.torso_transverse_width_at_hip_level);
  assert.ok(SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0.torso_profile_span_at_shoulder_level);
  assert.ok(SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0.torso_profile_span_at_hip_level);
});

test('evaluates status projected_metric_only for standard height-scaled Body Pipeline Front and Side packages', () => {
  // 1. Front Transverse Width Observation
  const frontObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    name: 'Torso Transverse Width at Shoulder Level',
    status: 'valid',
    valueCm: 38.5,
    provenance: { sourceLevel: 'shoulder' },
  };

  const calibProvenance = {
    contract: 'metric-calibration-provenance-v0',
    status: 'validated',
    metricProjectedEligibility: true,
    calibration: { pixelsPerCm: 10.0 },
  };

  const frontResult = evaluatePhysicalMeasurementSemantics(frontObs, {
    calibrationProvenance: calibProvenance,
    viewCalibration: { viewCategoryValidated: true, viewOrientation: 'frontal' },
  });

  assert.equal(frontResult.contract, 'physical-measurement-semantics-v0');
  assert.equal(frontResult.status, 'projected_metric_only');
  assert.equal(frontResult.metricProjectedEligibility, true);
  assert.equal(frontResult.physicalEligibility, false);
  assert.equal(frontResult.workspaceSpanCm, 38.5);
  assert.equal(frontResult.metricProjectedSpanCm, 38.5);
  assert.equal(frontResult.physicalSpanCm, null);
  assert.ok(frontResult.missingPhysicalRequirements.includes('authoritative_physical_evidence_contract'));

  // 2. Side Profile Span Observation
  const sideObs = {
    contract: 'side-profile-span-v0',
    id: 'torso_profile_span_at_shoulder_level',
    name: 'Torso Profile Span at Shoulder Level',
    status: 'valid',
    valueCm: 28.0,
    provenance: { sourceLevel: 'shoulder' },
  };

  const sideResult = evaluatePhysicalMeasurementSemantics(sideObs, {
    calibrationProvenance: calibProvenance,
    viewCalibration: { viewCategoryValidated: true, viewOrientation: 'left_profile' },
  });

  assert.equal(sideResult.status, 'projected_metric_only');
  assert.equal(sideResult.metricProjectedEligibility, true);
  assert.equal(sideResult.physicalEligibility, false);
  assert.equal(sideResult.workspaceSpanCm, 28.0);
  assert.equal(sideResult.metricProjectedSpanCm, 28.0);
  assert.equal(sideResult.physicalSpanCm, null);
});

test('evaluates status validated and populates physicalSpanCm ONLY when an authoritative physical evidence contract is provided', () => {
  const sideObs = {
    contract: 'side-profile-span-v0',
    id: 'torso_profile_span_at_hip_level',
    name: 'Torso Profile Span at Hip Level',
    status: 'valid',
    valueCm: 31.0,
    provenance: { sourceLevel: 'hip' },
  };

  const calibProvenance = {
    contract: 'metric-calibration-provenance-v0',
    status: 'validated',
    metricProjectedEligibility: true,
  };

  const syntheticPhysicalContract = {
    contract: 'controlled-capture-protocol-v0',
    version: 'controlled-capture-protocol-v0',
    status: 'validated',
    provenance: { protocol: 'telephoto_calibrated_station' },
  };

  const result = evaluatePhysicalMeasurementSemantics(sideObs, {
    calibrationProvenance: calibProvenance,
    viewCalibration: { viewCategoryValidated: true, viewOrientation: 'right_profile' },
    physicalEvidencePaths: [syntheticPhysicalContract],
  });

  assert.equal(result.status, 'validated');
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.physicalEligibility, true);
  assert.equal(result.workspaceSpanCm, 31.0);
  assert.equal(result.metricProjectedSpanCm, 31.0);
  assert.equal(result.physicalSpanCm, 31.0);
  assert.deepEqual(result.validatedPhysicalEvidencePaths, ['controlled-capture-protocol-v0']);
});

test('strictly rejects caller-controlled boolean shortcuts for physical evidence', () => {
  const sideObs = {
    contract: 'side-profile-span-v0',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 28.0,
  };

  const calibProvenance = {
    status: 'validated',
    metricProjectedEligibility: true,
  };

  // Passing a boolean shortcut must NOT grant physical eligibility
  const result = evaluatePhysicalMeasurementSemantics(sideObs, {
    calibrationProvenance: calibProvenance,
    physicalEvidencePaths: { controlled_capture_protocol: true },
  });

  assert.equal(result.status, 'projected_metric_only');
  assert.equal(result.physicalEligibility, false);
  assert.equal(result.physicalSpanCm, null);
});

test('preserves metric projection eligibility when view categorization fails, but marks physical semantics invalid', () => {
  const sideObs = {
    contract: 'side-profile-span-v0',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 28.0,
  };

  const calibProvenance = {
    status: 'validated',
    metricProjectedEligibility: true,
  };

  const result = evaluatePhysicalMeasurementSemantics(sideObs, {
    calibrationProvenance: calibProvenance,
    viewCalibration: { viewCategoryValidated: false }, // Stance failed
  });

  assert.equal(result.status, 'invalid');
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.metricProjectedSpanCm, 28.0);
  assert.equal(result.physicalEligibility, false);
  assert.equal(result.physicalSpanCm, null);
  assert.equal(result.checks.view_category_validated.status, 'fail');
});

test('bodyEvidence.js getMetricCalibrationProvenance, getPhysicalMeasurementSemantics, and getPhysicalMeasurementSemanticsReport integrate with active runtime state', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getMetricCalibrationProvenance,
    getPhysicalMeasurementSemantics,
    getPhysicalMeasurementSemanticsReport,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 10x10 images
  // Row 2 (yCm = 150): Torso (22) from col 3 to 6 (Front) and col 4 to 5 (Side)
  const rasterFront = new Uint8Array(100);
  for (let c = 3; c <= 6; c += 1) rasterFront[2 * 10 + c] = 22; // 4 pixels -> 80 cm in 10x10

  const rasterSide = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) rasterSide[2 * 10 + c] = 22; // 2 pixels -> 40 cm in 10x10

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    calibration: {
      declaredIsCalibrated: true,
      pixelsPerCm: 0.05, // 10 px / 200 cm = 0.05 px/cm
      standardizedCanvasWidthPx: 10,
      standardizedCanvasHeightPx: 10,
      isIsotropic: true,
      subjectHeightCm: 175.0,
      metricScaleSource: 'known_subject_height',
    },
    front: {
      calibration: {
        originalImageWidthPx: 10,
        originalImageHeightPx: 10,
        scaleFactor: 1.0,
        scaledWidthPx: 10,
        scaledHeightPx: 10,
        offsetX: 0,
        offsetY: 0,
        viewCategoryValidated: true,
        viewOrientation: 'frontal',
      },
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 96, Torso: 4 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
    side: {
      calibration: {
        originalImageWidthPx: 10,
        originalImageHeightPx: 10,
        scaleFactor: 1.0,
        scaledWidthPx: 10,
        scaledHeightPx: 10,
        offsetX: 0,
        offsetY: 0,
        viewCategoryValidated: true,
        viewOrientation: 'left_profile',
      },
      segmentation: {
        model: 'schp',
        view: 'side',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 98, Torso: 2 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
      },
    },
  });

  setBodyEvidencePackage(pkg);

  const mockAnnotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 30, y: 150, z: 200 } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 70, y: 150, z: 200 } },
  ];

  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  // 1. Metric Calibration Provenance for Front & Side
  const frontCalibProv = getMetricCalibrationProvenance({ view: 'front' });
  assert.ok(frontCalibProv);
  assert.equal(frontCalibProv.status, 'validated');
  assert.equal(frontCalibProv.metricProjectedEligibility, true);

  const sideCalibProv = getMetricCalibrationProvenance({ view: 'side' });
  assert.ok(sideCalibProv);
  assert.equal(sideCalibProv.status, 'validated');
  assert.equal(sideCalibProv.metricProjectedEligibility, true);

  // 2. Physical Measurement Semantics (Single Getters)
  const frontSemantics = getPhysicalMeasurementSemantics({
    id: 'torso_transverse_width_at_shoulder_level',
    annotations: mockAnnotations,
  });
  assert.ok(frontSemantics);
  assert.equal(frontSemantics.status, 'projected_metric_only');
  assert.equal(frontSemantics.metricProjectedEligibility, true);
  assert.equal(frontSemantics.physicalEligibility, false);
  assert.equal(frontSemantics.metricProjectedSpanCm, 80.0);
  assert.equal(frontSemantics.physicalSpanCm, null);

  const sideSemantics = getPhysicalMeasurementSemantics({
    id: 'torso_profile_span_at_shoulder_level',
    annotations: mockAnnotations,
  });
  assert.ok(sideSemantics);
  assert.equal(sideSemantics.status, 'projected_metric_only');
  assert.equal(sideSemantics.metricProjectedEligibility, true);
  assert.equal(sideSemantics.physicalEligibility, false);
  assert.equal(sideSemantics.metricProjectedSpanCm, 40.0);
  assert.equal(sideSemantics.physicalSpanCm, null);

  // 3. Bulk Semantics Report
  const report = getPhysicalMeasurementSemanticsReport({ annotations: mockAnnotations });
  assert.ok(report);
  assert.equal(report.contract, 'physical-measurement-semantics-report-v0');
  assert.equal(report.results.length, 4);
  assert.equal(report.summary.projectedMetricOnlyCount, 2); // shoulder Front and Side
  assert.equal(report.summary.unavailableCount, 2); // hip Front and Side (no hip landmarks promoted)

  // Reset
  setBodyEvidencePackage(null);
  assert.equal(getMetricCalibrationProvenance({ view: 'front' }), null);
});

test('4.5G forged validated/authorized object does not populate physicalSpanCm without a registered physical-geometry evaluator', () => {
  const sideObs = {
    contract: 'side-profile-span-v0',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 11.0,
  };

  const forged = {
    contract: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
    version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
    status: 'validated',
    authorized: true,
    evidenceClass: 'authoritative_physical',
    evaluatorId: 'forged-physical-geometry-evaluator-v0',
    physicalAuthority: { status: 'authoritative' },
  };

  const result = evaluatePhysicalMeasurementSemantics(sideObs, {
    calibrationProvenance: {
      contract: 'metric-calibration-provenance-v0',
      status: 'validated',
      metricProjectedEligibility: true,
    },
    viewCalibration: { viewCategoryValidated: true, viewOrientation: 'left_profile' },
    physicalEvidencePaths: forged,
  });

  assert.equal(result.physicalEligibility, false);
  assert.equal(result.physicalSpanCm, null);
  assert.notEqual(result.status, 'validated');
  assert.ok(result.missingPhysicalRequirements.includes('authoritative_physical_evidence_contract'));
});


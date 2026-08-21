import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT,
  PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT_VERSION,
  PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT,
  PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT_VERSION,
  PHYSICAL_ELIGIBILITY_STATUS,
  PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS,
  ELIGIBILITY_BLOCKER_CODES,
  RECOGNIZED_PHYSICAL_EVALUATOR_CONTRACTS,
  IMPLEMENTED_PHYSICAL_EVALUATORS,
  evaluatePhysicalMeasurementEligibility,
  evaluatePairedCrossViewEligibility,
  evaluateAllPhysicalMeasurementEligibilities,
} from './physicalMeasurementEligibility.js';

import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getPhysicalMeasurementEligibility,
  getPhysicalMeasurementEligibilityReport,
  getPairedCrossViewEligibility,
  getPairedCrossViewEligibilityReport,
} from './bodyEvidence.js';

import {
  importBodyEvidenceZip,
} from './bodyEvidenceZipAdapter.js';

import {
  SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0,
} from './physicalMeasurementSemantics.js';

import {
  SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0,
} from './crossViewMeasurementCorrespondence.js';

test('Physical Measurement Eligibility Contract v0 exports metadata, status enums, and registries', () => {
  assert.equal(PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT, 'physical-measurement-eligibility-v0');
  assert.equal(PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT_VERSION, 'physical-measurement-eligibility-v0');
  assert.equal(PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT, 'paired-cross-view-eligibility-v0');
  assert.equal(PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT_VERSION, 'paired-cross-view-eligibility-v0');

  assert.deepEqual(Object.keys(PHYSICAL_ELIGIBILITY_STATUS), [
    'ELIGIBLE',
    'BLOCKED_BY_CLOTHING',
    'METRIC_PROJECTED_ONLY',
    'UNVALIDATED',
    'INVALID',
    'UNAVAILABLE',
  ]);

  assert.deepEqual(Object.keys(PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS), [
    'ELIGIBLE',
    'PARTIAL',
    'BLOCKED',
    'UNAVAILABLE',
  ]);

  assert.ok(RECOGNIZED_PHYSICAL_EVALUATOR_CONTRACTS.includes('calibrated-camera-projection-v0'));
  assert.ok(RECOGNIZED_PHYSICAL_EVALUATOR_CONTRACTS.includes('controlled-capture-protocol-v0'));
  assert.equal(IMPLEMENTED_PHYSICAL_EVALUATORS.length, 0, 'Production implemented evaluators list starts empty');
});

test('Tier 1: returns unavailable when source observation is missing or null', () => {
  const result = evaluatePhysicalMeasurementEligibility(null, {
    definition: 'torso_transverse_width_at_shoulder_level',
  });

  assert.equal(result.contract, 'physical-measurement-eligibility-v0');
  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.UNAVAILABLE);
  assert.equal(result.physicalEligibility, false);
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.workspaceSpanCm, null);
  assert.equal(result.metricProjectedSpanCm, null);
  assert.equal(result.physicalMeasurementCm, null);
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.SOURCE_OBSERVATION_UNAVAILABLE));
});

test('Tier 1: returns invalid for structural contradictions or unregistered definitions', () => {
  const invalidObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    view: 'front',
    sourceLevel: 'hip', // Contradiction: shoulder def vs hip observation
    status: 'valid',
    valueCm: 30.0,
    startPx: 100,
    endPx: 400,
    provenance: {
      sourceLevel: 'hip',
      runCount: 1,
    },
  };

  const result = evaluatePhysicalMeasurementEligibility(invalidObs, {
    definition: 'torso_transverse_width_at_shoulder_level',
    metricCalibrationResult: {
      status: 'validated',
      metricProjectedEligibility: true,
      scaleCmPerPx: 0.1,
      view: 'front',
    },
  });

  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.INVALID);
  assert.equal(result.physicalEligibility, false);
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.SOURCE_STRUCTURAL_INTEGRITY_FAILED));
});

test('Tier 1: returns unvalidated when metric calibration is absent or unvalidated', () => {
  const validObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    view: 'front',
    sourceLevel: 'shoulder',
    status: 'valid',
    valueCm: 30.8,
    startPx: 100,
    endPx: 408,
    provenance: {
      sourceLevel: 'shoulder',
      runCount: 1,
    },
  };

  const result = evaluatePhysicalMeasurementEligibility(validObs, {
    definition: 'torso_transverse_width_at_shoulder_level',
    metricCalibrationResult: null, // Missing calibration
  });

  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.UNVALIDATED);
  assert.equal(result.physicalEligibility, false);
  assert.equal(result.metricProjectedEligibility, false);
  assert.equal(result.metricProjectedSpanCm, null);
  assert.equal(result.physicalMeasurementCm, null);
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.METRIC_CALIBRATION_UNVALIDATED));
});

test('Tier 1: returns blocked_by_clothing when clothing is present without clothing authorization', () => {
  const validClothedObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    view: 'front',
    sourceLevel: 'shoulder',
    status: 'valid',
    valueCm: 30.8,
    startPx: 100,
    endPx: 408,
    provenance: {
      sourceLevel: 'shoulder',
      runCount: 1,
      usedClothingEvidence: true,
      clothingClassIdsUsed: [23],
    },
  };

  const calib = {
    status: 'validated',
    metricProjectedEligibility: true,
    scaleCmPerPx: 0.1,
    view: 'front',
  };

  const result = evaluatePhysicalMeasurementEligibility(validClothedObs, {
    definition: 'torso_transverse_width_at_shoulder_level',
    metricCalibrationResult: calib,
  });

  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.BLOCKED_BY_CLOTHING);
  assert.equal(result.physicalEligibility, false);
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.metricProjectedSpanCm, 30.8);
  assert.equal(result.physicalMeasurementCm, null);

  // Multi-blocker preservation: clothing is primary, but missing view/pose and physical evidence are also preserved
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING));
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.VIEW_POSE_SEMANTICS_MISSING));
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING));
});

test('Tier 1: returns metric_projected_only when unclothed/authorized but missing view/pose or physical evidence', () => {
  const validUnclothedObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    view: 'front',
    sourceLevel: 'shoulder',
    status: 'valid',
    valueCm: 30.8,
    startPx: 100,
    endPx: 408,
    provenance: {
      sourceLevel: 'shoulder',
      runCount: 1,
      usedClothingEvidence: false,
      clothingClassIdsUsed: [],
    },
  };

  const calib = {
    status: 'validated',
    metricProjectedEligibility: true,
    scaleCmPerPx: 0.1,
    view: 'front',
  };

  const result = evaluatePhysicalMeasurementEligibility(validUnclothedObs, {
    definition: 'torso_transverse_width_at_shoulder_level',
    metricCalibrationResult: calib,
  });

  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.METRIC_PROJECTED_ONLY);
  assert.equal(result.physicalEligibility, false);
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.metricProjectedSpanCm, 30.8);
  assert.equal(result.physicalMeasurementCm, null);
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.VIEW_POSE_SEMANTICS_MISSING));
  assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING));
  assert.equal(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING), false);
});

test('Tier 1: physical-value promotion with direct_equivalence evaluator', () => {
  const validUnclothedObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    view: 'front',
    sourceLevel: 'shoulder',
    status: 'valid',
    valueCm: 30.8,
    startPx: 100,
    endPx: 408,
    provenance: {
      sourceLevel: 'shoulder',
      runCount: 1,
      usedClothingEvidence: false,
      clothingClassIdsUsed: [],
    },
  };

  const calib = {
    status: 'validated',
    metricProjectedEligibility: true,
    scaleCmPerPx: 0.1,
    view: 'front',
  };

  const trustedPoseEvaluator = {
    contract: 'controlled-capture-protocol-v0',
    evaluatorId: 'synthetic_pose_evaluator_v0',
    status: 'validated',
    targetView: 'front',
  };

  const trustedPhysicalEvaluator = {
    contract: 'calibrated-camera-projection-v0',
    evaluatorId: 'synthetic_projection_evaluator_v0',
    status: 'validated',
    targetView: 'front',
    applicableLevels: ['shoulder'],
    applicableDomains: ['transverse_width'],
    interpretation: 'direct_equivalence',
    physicalMeasurementCm: 30.8,
    uncertaintyToleranceCm: 0.2,
  };

  const result = evaluatePhysicalMeasurementEligibility(validUnclothedObs, {
    definition: 'torso_transverse_width_at_shoulder_level',
    metricCalibrationResult: calib,
    viewPoseValidationResult: trustedPoseEvaluator,
    authoritativePhysicalEvidenceResults: [trustedPhysicalEvaluator],
  });

  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.ELIGIBLE);
  assert.equal(result.physicalEligibility, true);
  assert.equal(result.metricProjectedEligibility, true);
  assert.equal(result.metricProjectedSpanCm, 30.8);
  assert.equal(result.physicalMeasurementCm, 30.8);
  assert.equal(result.physicalValueProvenance.interpretation, 'direct_equivalence');
  assert.equal(result.physicalValueProvenance.evaluatorContract, 'calibrated-camera-projection-v0');
  assert.equal(result.physicalValueProvenance.uncertaintyToleranceCm, 0.2);
  assert.equal(result.blockers.length, 0);
});

test('Tier 1: physical-value promotion with corrected_physical_measurement where metricProjectedSpanCm !== physicalMeasurementCm', () => {
  const validClothedObs = {
    contract: 'front-transverse-width-v0',
    id: 'torso_transverse_width_at_shoulder_level',
    view: 'front',
    sourceLevel: 'shoulder',
    status: 'valid',
    valueCm: 30.8,
    startPx: 100,
    endPx: 408,
    provenance: {
      sourceLevel: 'shoulder',
      runCount: 1,
      usedClothingEvidence: true,
      clothingClassIdsUsed: [23],
    },
  };

  const calib = {
    status: 'validated',
    metricProjectedEligibility: true,
    scaleCmPerPx: 0.1,
    view: 'front',
  };

  const trustedPoseEvaluator = {
    contract: 'controlled-capture-protocol-v0',
    evaluatorId: 'synthetic_pose_evaluator_v0',
    status: 'validated',
    targetView: 'front',
  };

  const trustedClothingEvaluator = {
    contract: 'fitted-garment-offset-compensation-v0',
    evaluatorId: 'synthetic_garment_evaluator_v0',
    status: 'validated',
  };

  // Authoritative physical evaluator applies a certified body-under-garment offset correction
  const trustedPhysicalEvaluator = {
    contract: 'fitted-garment-offset-compensation-v0',
    evaluatorId: 'synthetic_garment_evaluator_v0',
    status: 'validated',
    targetView: 'front',
    applicableLevels: ['shoulder'],
    applicableDomains: ['transverse_width'],
    interpretation: 'corrected_physical_measurement',
    physicalMeasurementCm: 29.4, // Explicitly different from 30.8
    uncertaintyToleranceCm: 0.3,
  };

  const result = evaluatePhysicalMeasurementEligibility(validClothedObs, {
    definition: 'torso_transverse_width_at_shoulder_level',
    metricCalibrationResult: calib,
    viewPoseValidationResult: trustedPoseEvaluator,
    clothingAuthorizationResult: trustedClothingEvaluator,
    authoritativePhysicalEvidenceResults: [trustedPhysicalEvaluator],
  });

  assert.equal(result.status, PHYSICAL_ELIGIBILITY_STATUS.ELIGIBLE);
  assert.equal(result.physicalEligibility, true);
  assert.equal(result.metricProjectedSpanCm, 30.8);
  assert.equal(result.physicalMeasurementCm, 29.4);
  assert.notEqual(result.metricProjectedSpanCm, result.physicalMeasurementCm, 'Metric and physical scalars are decoupled');
  assert.equal(result.physicalValueProvenance.interpretation, 'corrected_physical_measurement');
  assert.equal(result.physicalValueProvenance.uncertaintyToleranceCm, 0.3);
  assert.equal(result.blockers.length, 0);
});

test('Tier 2: Paired cross-view physical eligibility resolution across statuses', () => {
  const mockCorrespondence = {
    id: 'torso_shoulder_cross_view_correspondence',
    sourceLevel: 'shoulder',
    status: 'ready',
  };

  const mockQaPass = {
    id: 'torso_shoulder_cross_view_correspondence',
    status: 'pass',
  };

  // 1. Both Front & Side Eligible -> Paired Eligible
  const frontEligible = {
    status: 'eligible',
    physicalEligibility: true,
    metricProjectedEligibility: true,
    metricProjectedSpanCm: 30.8,
    physicalMeasurementCm: 30.8,
  };
  const sideEligible = {
    status: 'eligible',
    physicalEligibility: true,
    metricProjectedEligibility: true,
    metricProjectedSpanCm: 11.0,
    physicalMeasurementCm: 11.0,
  };

  const pairedEligible = evaluatePairedCrossViewEligibility(mockCorrespondence, {
    frontEligibilityResult: frontEligible,
    sideEligibilityResult: sideEligible,
    comparabilityQaResult: mockQaPass,
  });

  assert.equal(pairedEligible.pairedStatus, PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.ELIGIBLE);
  assert.equal(pairedEligible.pairedPhysicalEligibility, true);
  assert.equal(pairedEligible.pairedMetricProjectedEligibility, true);
  assert.equal(pairedEligible.frontPhysicalMeasurementCm, 30.8);
  assert.equal(pairedEligible.sidePhysicalMeasurementCm, 11.0);

  // 2. Both Front & Side Metric Valid but Blocked by Clothing -> Paired Blocked
  const frontBlocked = {
    status: 'blocked_by_clothing',
    physicalEligibility: false,
    metricProjectedEligibility: true,
    metricProjectedSpanCm: 30.8,
    physicalMeasurementCm: null,
  };
  const sideBlocked = {
    status: 'blocked_by_clothing',
    physicalEligibility: false,
    metricProjectedEligibility: true,
    metricProjectedSpanCm: 11.0,
    physicalMeasurementCm: null,
  };

  const pairedBlocked = evaluatePairedCrossViewEligibility(mockCorrespondence, {
    frontEligibilityResult: frontBlocked,
    sideEligibilityResult: sideBlocked,
    comparabilityQaResult: mockQaPass,
  });

  assert.equal(pairedBlocked.pairedStatus, PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED);
  assert.equal(pairedBlocked.pairedPhysicalEligibility, false);
  assert.equal(pairedBlocked.pairedMetricProjectedEligibility, true);
  assert.equal(pairedBlocked.frontMetricSpanCm, 30.8);
  assert.equal(pairedBlocked.sideMetricSpanCm, 11.0);
  assert.equal(pairedBlocked.frontPhysicalMeasurementCm, null);
  assert.equal(pairedBlocked.sidePhysicalMeasurementCm, null);

  // 3. Failed 4.5B QA -> Paired Blocked
  const mockQaFail = {
    id: 'torso_shoulder_cross_view_correspondence',
    status: 'fail',
    issues: ['Y-level discrepancy exceeds threshold'],
  };
  const pairedQaFail = evaluatePairedCrossViewEligibility(mockCorrespondence, {
    frontEligibilityResult: frontEligible,
    sideEligibilityResult: sideEligible,
    comparabilityQaResult: mockQaFail,
  });
  assert.equal(pairedQaFail.pairedStatus, PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED);
  assert.equal(pairedQaFail.pairedPhysicalEligibility, false);
});

test('Real Unified Body Pipeline Archive integration: 4.5D Tier 1 and Tier 2 positive metric evaluation', async () => {
  const zipPath = 'C:\\Users\\VIP\\Downloads\\output.zip';
  if (!existsSync(zipPath)) {
    return; // Skip if test environment does not have the local zip
  }

  const zipBuffer = readFileSync(zipPath);
  const zipRes = await importBodyEvidenceZip(zipBuffer);
  assert.ok(zipRes.ok, `Zip extraction failed: ${zipRes.error}`);
  assert.ok(zipRes.package, 'Package must be populated');

  setBodyEvidencePackage(zipRes.package);
  const analysisRes = await analyzeLoadedBodyEvidenceAsync();
  assert.ok(analysisRes.ok, `Body evidence analysis failed: ${analysisRes.error}`);

  const pixelsPerCm = 10;
  const canvasSize = 2000;
  const frontLandmarks = zipRes.package.front?.pose?.acceptedLandmarks ?? [];
  const annotations = frontLandmarks.map((lm) => ({
    type: 'body_landmark',
    name: lm.name,
    point: {
      x: typeof lm.imageX === 'number' ? lm.imageX / pixelsPerCm : 0,
      y: typeof lm.imageY === 'number' ? (canvasSize - lm.imageY) / pixelsPerCm : 0,
      z: 200,
    },
  }));

  // Test Tier 1 Report
  const t1Report = getPhysicalMeasurementEligibilityReport({ annotations });
  assert.ok(t1Report, 'Tier 1 report must be available');
  assert.equal(t1Report.contract, 'physical-measurement-eligibility-report-v0');
  assert.equal(t1Report.summary.total, 4);
  assert.equal(t1Report.summary.blockedByClothingCount, 4);
  assert.equal(t1Report.summary.eligibleCount, 0);

  // Front Shoulder
  const frontShoulder = getPhysicalMeasurementEligibility({
    id: 'torso_transverse_width_at_shoulder_level',
    annotations,
  });
  assert.ok(frontShoulder);
  assert.equal(frontShoulder.status, PHYSICAL_ELIGIBILITY_STATUS.BLOCKED_BY_CLOTHING);
  assert.equal(frontShoulder.physicalEligibility, false);
  assert.equal(frontShoulder.metricProjectedEligibility, true);
  assert.ok(Math.abs(frontShoulder.metricProjectedSpanCm - 30.80) < 1e-4);
  assert.equal(frontShoulder.physicalMeasurementCm, null);
  assert.ok(frontShoulder.blockers.includes(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING));
  assert.ok(frontShoulder.blockers.includes(ELIGIBILITY_BLOCKER_CODES.VIEW_POSE_SEMANTICS_MISSING));
  assert.ok(frontShoulder.blockers.includes(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING));

  // Side Shoulder
  const sideShoulder = getPhysicalMeasurementEligibility({
    id: 'torso_profile_span_at_shoulder_level',
    annotations,
  });
  assert.ok(sideShoulder);
  assert.equal(sideShoulder.status, PHYSICAL_ELIGIBILITY_STATUS.BLOCKED_BY_CLOTHING);
  assert.equal(sideShoulder.physicalEligibility, false);
  assert.equal(sideShoulder.metricProjectedEligibility, true);
  assert.ok(Math.abs(sideShoulder.metricProjectedSpanCm - 11.00) < 1e-4);
  assert.equal(sideShoulder.physicalMeasurementCm, null);
  assert.ok(sideShoulder.blockers.includes(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING));

  // Front Hip
  const frontHip = getPhysicalMeasurementEligibility({
    id: 'torso_transverse_width_at_hip_level',
    annotations,
  });
  assert.ok(frontHip);
  assert.equal(frontHip.status, PHYSICAL_ELIGIBILITY_STATUS.BLOCKED_BY_CLOTHING);
  assert.equal(frontHip.physicalEligibility, false);
  assert.equal(frontHip.metricProjectedEligibility, true);
  assert.ok(Math.abs(frontHip.metricProjectedSpanCm - 42.20) < 1e-4);
  assert.equal(frontHip.physicalMeasurementCm, null);
  assert.ok(frontHip.blockers.includes(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING));

  // Side Hip
  const sideHip = getPhysicalMeasurementEligibility({
    id: 'torso_profile_span_at_hip_level',
    annotations,
  });
  assert.ok(sideHip);
  assert.equal(sideHip.status, PHYSICAL_ELIGIBILITY_STATUS.BLOCKED_BY_CLOTHING);
  assert.equal(sideHip.physicalEligibility, false);
  assert.equal(sideHip.metricProjectedEligibility, true);
  assert.ok(Math.abs(sideHip.metricProjectedSpanCm - 27.70) < 1e-4);
  assert.equal(sideHip.physicalMeasurementCm, null);
  assert.ok(sideHip.blockers.includes(ELIGIBILITY_BLOCKER_CODES.CLOTHING_AUTHORIZATION_MISSING));

  // Test Tier 2 Report
  const t2Report = getPairedCrossViewEligibilityReport({ annotations });
  assert.ok(t2Report, 'Tier 2 report must be available');
  assert.equal(t2Report.contract, 'paired-cross-view-eligibility-report-v0');
  assert.equal(t2Report.pairs.length, 2);

  // Shoulder Pair
  const shoulderPair = getPairedCrossViewEligibility({
    id: 'torso_shoulder_cross_view_correspondence',
    annotations,
  });
  assert.ok(shoulderPair);
  assert.equal(shoulderPair.pairedStatus, PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED);
  assert.equal(shoulderPair.pairedMetricProjectedEligibility, true);
  assert.equal(shoulderPair.pairedPhysicalEligibility, false);
  assert.ok(Math.abs(shoulderPair.frontMetricSpanCm - 30.80) < 1e-4);
  assert.ok(Math.abs(shoulderPair.sideMetricSpanCm - 11.00) < 1e-4);
  assert.equal(shoulderPair.frontPhysicalMeasurementCm, null);
  assert.equal(shoulderPair.sidePhysicalMeasurementCm, null);

  // Hip Pair
  const hipPair = getPairedCrossViewEligibility({
    id: 'torso_hip_cross_view_correspondence',
    annotations,
  });
  assert.ok(hipPair);
  assert.equal(hipPair.pairedStatus, PAIRED_CROSS_VIEW_ELIGIBILITY_STATUS.BLOCKED);
  assert.equal(hipPair.pairedMetricProjectedEligibility, true);
  assert.equal(hipPair.pairedPhysicalEligibility, false);
  assert.ok(Math.abs(hipPair.frontMetricSpanCm - 42.20) < 1e-4);
  assert.ok(Math.abs(hipPair.sideMetricSpanCm - 27.70) < 1e-4);
  assert.equal(hipPair.frontPhysicalMeasurementCm, null);
  assert.equal(hipPair.sidePhysicalMeasurementCm, null);

  // Clean up
  setBodyEvidencePackage(null);
});

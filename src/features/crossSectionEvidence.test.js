import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CROSS_SECTION_EVIDENCE_CONTRACT,
  CROSS_SECTION_EVIDENCE_CONTRACT_VERSION,
  CROSS_SECTION_EVIDENCE_STATUS,
  CROSS_SECTION_BLOCKER_CODES,
  SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0,
  evaluateCrossSectionEvidence,
} from './crossSectionEvidence.js';

// Reusable mock factories
function createMockFrontWidth({
  id = 'torso_width_at_shoulder_level',
  status = 'valid',
  valueCm = 30.80,
  sourceLevel = 'shoulder',
  levelYcm = 132.85,
} = {}) {
  return {
    contract: 'front-transverse-width-v0',
    version: 'front-transverse-width-v0',
    view: 'front',
    id,
    name: 'Torso Transverse Width at Shoulder Level',
    type: 'transverse_width',
    status,
    valueCm,
    provenance: {
      sourceLevel,
      levelYcm,
      sampledPixelRow: 671,
      supportPolicyId: 'trunk_core_support_v0',
      actualClassIdsUsed: [22, 23],
      clothingClassIdsUsed: [23],
      usedClothingEvidence: true,
      leftXcm: 84.60,
      rightXcm: 115.40,
    },
    issues: [],
  };
}

function createMockSideDepth({
  id = 'torso_ap_depth_at_shoulder_level',
  status = 'qualified',
  qualifiedDepthEstimateCm = 11.00,
  projectedSpanCm = 11.00,
  sourceLevel = 'shoulder',
  levelYcm = 132.85,
  warnings = [],
  issues = [],
} = {}) {
  return {
    contract: 'side-physical-depth-qualification-v0',
    version: 'side-physical-depth-qualification-v0',
    id,
    name: 'Torso AP Depth Estimate at Shoulder Level',
    sourceLevel,
    levelYcm,
    projectedSpanCm,
    qualifiedDepthEstimateCm,
    status,
    qualificationTier: status === 'qualified' ? 'physical_ap_depth_estimate' : 'unqualified',
    checks: [],
    issues,
    warnings,
    provenance: {
      sourceLevel,
      levelYcm,
      sampledPixelRow: 671,
      supportPolicyId: 'trunk_core_support_v0',
      actualClassIdsUsed: [22, 23],
      clothingClassIdsUsed: [23],
      usedClothingEvidence: true,
      tPoseStatus: 'pass',
      lateralOrientationStatus: 'pass',
      metricCalibrationStatus: 'validated',
    },
  };
}

function createMockCorrespondence({
  id = 'torso_shoulder_cross_view_correspondence',
  status = 'ready',
  sourceLevel = 'shoulder',
  levelYcm = 132.85,
} = {}) {
  return {
    contract: 'cross-view-measurement-correspondence-v0',
    version: 'cross-view-measurement-correspondence-v0',
    id,
    name: 'Torso Shoulder Cross-View Measurement Correspondence',
    type: 'cross_view_measurement_correspondence',
    sourceLevel,
    status,
    frontDefinitionId: 'torso_width_at_shoulder_level',
    sideDefinitionId: 'torso_profile_span_at_shoulder_level',
    provenance: {
      sourceLevel,
      frontLevelYcm: levelYcm,
      sideLevelYcm: levelYcm,
    },
    issues: [],
  };
}

function createMockComparabilityQa({
  status = 'pass',
  warnings = [],
  issues = [],
} = {}) {
  return {
    contract: 'cross-view-comparability-qa-v0',
    version: 'cross-view-comparability-qa-v0',
    status,
    checks: {},
    summary: { totalChecks: 10, passedChecks: 10, failedChecks: 0, warnedChecks: 0, skippedChecks: 0 },
    issues,
    warnings,
  };
}

function createMockMetricCalibration({
  view = 'front',
  status = 'validated',
  scaleCmPerPx = 0.1,
} = {}) {
  return {
    contract: 'metric-calibration-provenance-v0',
    view,
    status,
    metricProjectedEligibility: status === 'validated',
    summary: {
      scaleCmPerPx,
    },
    calibration: {
      scaleCmPerPx,
    },
  };
}

test('Cross-Section Evidence v0: Qualified Shoulder evaluates successfully', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();
  const comparabilityQa = createMockComparabilityQa();
  const metricCalibrationFront = createMockMetricCalibration({ view: 'front' });
  const metricCalibrationSide = createMockMetricCalibration({ view: 'side' });

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
    comparabilityQa,
    metricCalibrationFront,
    metricCalibrationSide,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.contract, CROSS_SECTION_EVIDENCE_CONTRACT);
  assert.equal(result.version, CROSS_SECTION_EVIDENCE_CONTRACT_VERSION);
  assert.equal(result.id, 'torso_cross_section_evidence_at_shoulder_level');
  assert.equal(result.sourceLevel, 'shoulder');
  assert.equal(result.levelYcm, 132.85);
  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.QUALIFIED);
  assert.equal(result.isQualified, true);
  assert.equal(result.blockers.length, 0);

  // Front observation verified
  assert.equal(result.frontObservation.transverseWidthCm, 30.80);
  assert.equal(result.frontObservation.isPhysicallyQualified, true);
  assert.equal(result.frontObservation.status, 'valid');

  // Side observation verified
  assert.equal(result.sideObservation.apDepthCm, 11.00);
  assert.equal(result.sideObservation.isPhysicallyQualified, true);
  assert.equal(result.sideObservation.status, 'qualified');

  // Correspondence verified
  assert.equal(result.correspondence.isCompatible, true);
  assert.equal(result.correspondence.status, 'ready');
  assert.equal(result.correspondence.comparabilityQaStatus, 'pass');
  assert.equal(result.correspondence.deltaYcm, 0.0);

  // Calibration verified
  assert.equal(result.calibrationCompatibility.isCompatible, true);
});

test('Cross-Section Evidence v0: Qualified Hip evaluates successfully', () => {
  const frontObservation = createMockFrontWidth({
    id: 'torso_width_at_hip_level',
    valueCm: 42.20,
    sourceLevel: 'hip',
    levelYcm: 86.25,
  });
  const sideDepthQualification = createMockSideDepth({
    id: 'torso_ap_depth_at_hip_level',
    qualifiedDepthEstimateCm: 27.70,
    projectedSpanCm: 27.70,
    sourceLevel: 'hip',
    levelYcm: 86.25,
  });
  const correspondence = createMockCorrespondence({
    id: 'torso_hip_cross_view_correspondence',
    sourceLevel: 'hip',
    levelYcm: 86.25,
  });
  const comparabilityQa = createMockComparabilityQa();

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
    comparabilityQa,
  }, {
    definition: 'torso_cross_section_evidence_at_hip_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.QUALIFIED);
  assert.equal(result.isQualified, true);
  assert.equal(result.sourceLevel, 'hip');
  assert.equal(result.levelYcm, 86.25);
  assert.equal(result.frontObservation.transverseWidthCm, 42.20);
  assert.equal(result.sideObservation.apDepthCm, 27.70);
});

test('Cross-Section Evidence v0: Missing Front width resolves to unavailable', () => {
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();

  const result = evaluateCrossSectionEvidence({
    frontObservation: null,
    sideDepthQualification,
    correspondence,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.UNAVAILABLE);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.FRONT_WIDTH_UNAVAILABLE));
  assert.equal(result.frontObservation, null);
});

test('Cross-Section Evidence v0: Missing Side AP depth resolves to unavailable', () => {
  const frontObservation = createMockFrontWidth();
  const correspondence = createMockCorrespondence();

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification: null,
    correspondence,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.UNAVAILABLE);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.SIDE_DEPTH_UNAVAILABLE));
  assert.equal(result.sideObservation, null);
});

test('Cross-Section Evidence v0: Ambiguous or invalid Front width resolves to blocked', () => {
  const frontObservation = createMockFrontWidth({
    status: 'ambiguous',
    valueCm: null,
  });
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.BLOCKED);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.FRONT_WIDTH_NOT_VALID));
  assert.equal(result.frontObservation.transverseWidthCm, null);
  assert.equal(result.frontObservation.isPhysicallyQualified, false);
});

test('Cross-Section Evidence v0: Disqualified Side Physical Depth resolves to blocked', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth({
    status: 'disqualified',
    qualifiedDepthEstimateCm: null,
    issues: ['Arm reach ratio below minimum extension threshold (0.65 < 0.70)'],
  });
  const correspondence = createMockCorrespondence();

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.BLOCKED);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.SIDE_DEPTH_NOT_QUALIFIED));
  assert.equal(result.sideObservation.apDepthCm, null);
  assert.equal(result.sideObservation.isPhysicallyQualified, false);
});

test('Cross-Section Evidence v0: Unsupported or mismatched anatomical level resolves to invalid', () => {
  const frontObservation = createMockFrontWidth({ sourceLevel: 'hip' });
  const sideDepthQualification = createMockSideDepth({ sourceLevel: 'shoulder' });

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.INVALID);
  assert.equal(result.isQualified, false);
  assert.ok(result.issues.some((is) => is.includes('mismatch') || is.includes('Mismatched')));
});

test('Cross-Section Evidence v0: Correspondence not ready resolves to blocked', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence({ status: 'partial' });

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.BLOCKED);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_CORRESPONDENCE_NOT_READY));
});

test('Cross-Section Evidence v0: Comparability QA failure resolves to blocked', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();
  const comparabilityQa = createMockComparabilityQa({
    status: 'fail',
    issues: ['Source slice row index missing'],
  });

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
    comparabilityQa,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.BLOCKED);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.CROSS_VIEW_COMPARABILITY_FAILED));
});

test('Cross-Section Evidence v0: Metric calibration incompatibility resolves to blocked', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();
  const metricCalibrationFront = createMockMetricCalibration({ view: 'front', scaleCmPerPx: 0.1 });
  const metricCalibrationSide = createMockMetricCalibration({ view: 'side', scaleCmPerPx: 0.2 }); // Scale mismatch

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
    metricCalibrationFront,
    metricCalibrationSide,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.BLOCKED);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_INCOMPATIBLE));
  assert.equal(result.calibrationCompatibility.isCompatible, false);
});

test('Cross-Section Evidence v0: Unvalidated metric calibration resolves to blocked', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();
  const metricCalibrationFront = createMockMetricCalibration({ view: 'front', status: 'unvalidated' });

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
    metricCalibrationFront,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.BLOCKED);
  assert.equal(result.isQualified, false);
  assert.ok(result.blockers.includes(CROSS_SECTION_BLOCKER_CODES.CALIBRATION_UNVALIDATED));
});

test('Critical T-Pose Regression Guardrail: Advisory 44.2° elbow warning with Side AP Depth qualified does NOT block Cross-Section Evidence', () => {
  const frontObservation = createMockFrontWidth();
  // Real-world capture case: Side pose diagnostic warning for 44.2° projected elbow bend,
  // but Side AP physical depth is qualified
  const sideDepthQualification = createMockSideDepth({
    status: 'qualified',
    qualifiedDepthEstimateCm: 11.00,
    warnings: ['Side pose qualifies as T-pose with advisory note: Left projected elbow deviation of 44.2° is in advisory warning range (30°–45°).'],
  });
  const correspondence = createMockCorrespondence();
  const comparabilityQa = createMockComparabilityQa();

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
    comparabilityQa,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  // Must remain qualified because Side Physical Depth itself is qualified
  assert.equal(result.status, CROSS_SECTION_EVIDENCE_STATUS.QUALIFIED);
  assert.equal(result.isQualified, true);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.frontObservation.transverseWidthCm, 30.80);
  assert.equal(result.sideObservation.apDepthCm, 11.00);
  // Advisory warning is preserved in the warnings array
  assert.ok(result.warnings.some((w) => w.includes('44.2°') || w.includes('advisory')));
});

test('Semantic Guardrail: Contract contains NO circumference output or calculations', () => {
  const frontObservation = createMockFrontWidth();
  const sideDepthQualification = createMockSideDepth();
  const correspondence = createMockCorrespondence();

  const result = evaluateCrossSectionEvidence({
    frontObservation,
    sideDepthQualification,
    correspondence,
  }, {
    definition: 'torso_cross_section_evidence_at_shoulder_level',
  });

  assert.equal(result.circumference, undefined);
  assert.equal(result.circumferenceCm, undefined);
  assert.equal(result.estimatedCircumference, undefined);
  assert.equal(result.estimatedCircumferenceCm, undefined);
  assert.equal(result.perimeter, undefined);
  assert.equal(result.ramanujan, undefined);
  assert.equal(result.semiMajorAxis, undefined);
  assert.equal(result.semiMinorAxis, undefined);
  assert.equal(result.contour, undefined);
  assert.equal(result.volume, undefined);

  assert.equal(result.semantics.isCircumferenceCalculated, false);
  assert.equal(result.semantics.isEllipseAssumed, false);
  assert.equal(result.semantics.is3dReconstruction, false);
});

test('Runtime Integration: getCrossSectionEvidence and getCrossSectionEvidenceReport handle unanalyzed state safely', async () => {
  const {
    getCrossSectionEvidence,
    getCrossSectionEvidenceReport,
  } = await import('./bodyEvidence.js');

  assert.equal(getCrossSectionEvidence({ id: 'invalid_id' }), null);
  const shoulderNull = getCrossSectionEvidence({ id: 'torso_cross_section_evidence_at_shoulder_level' });
  assert.equal(shoulderNull?.status, CROSS_SECTION_EVIDENCE_STATUS.UNAVAILABLE);
  assert.equal(getCrossSectionEvidenceReport(), null);
});


import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELED_CROSS_SECTION_PERIMETER_CONTRACT,
  MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION,
  MODELED_CROSS_SECTION_PERIMETER_STATUS,
  SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0,
  computeRamanujanEllipsePerimeter,
  evaluateModeledCrossSectionPerimeter,
} from './modeledCrossSectionPerimeter.js';

// Helper mock factory for qualified Hip Cross-Section Evidence
function createMockHipCrossSectionEvidence({
  id = 'torso_cross_section_evidence_at_hip_level',
  status = 'qualified',
  isQualified = true,
  sourceLevel = 'hip',
  levelYcm = 86.25,
  widthCm = 42.20,
  depthCm = 27.70,
  contract = 'cross-section-evidence-v0',
  warnings = [],
  issues = [],
  blockers = [],
} = {}) {
  return {
    contract,
    version: 'cross-section-evidence-v0',
    id,
    name: 'Torso Cross-Section Evidence at Hip Level',
    sourceLevel,
    levelYcm,
    status,
    isQualified,
    frontObservation: {
      view: 'front',
      id: 'torso_width_at_hip_level',
      name: 'Torso Transverse Width at Hip Level',
      type: 'transverse_width',
      transverseWidthCm: widthCm,
      status: widthCm !== null ? 'valid' : 'unavailable',
      isPhysicallyQualified: widthCm !== null && widthCm > 0,
      provenance: {
        sourceLevel,
        levelYcm,
      },
    },
    sideObservation: {
      view: 'side',
      id: 'torso_ap_depth_at_hip_level',
      name: 'Torso AP Depth Estimate at Hip Level',
      type: 'physical_ap_depth_estimate',
      apDepthCm: depthCm,
      projectedSpanCm: depthCm,
      status: depthCm !== null ? 'qualified' : 'unavailable',
      isPhysicallyQualified: depthCm !== null && depthCm > 0,
      provenance: {
        sourceLevel,
        levelYcm,
      },
    },
    correspondence: {
      id: 'torso_hip_cross_view_correspondence',
      status: 'ready',
      comparabilityQaStatus: 'pass',
      isCompatible: true,
      deltaYcm: 0.0,
    },
    calibrationCompatibility: {
      frontStatus: 'validated',
      sideStatus: 'validated',
      isCompatible: true,
    },
    blockers,
    warnings,
    issues,
    semantics: {
      statement: 'Paired orthogonal physical observations (Front transverse width + Side AP depth) at matching anatomical level. NOT a reconstructed 3D slice, ellipse, or circumference.',
      isCircumferenceCalculated: false,
      isEllipseAssumed: false,
      is3dReconstruction: false,
    },
  };
}

test('Modeled Cross-Section Perimeter v0: Contract metadata and definitions exist', () => {
  assert.equal(MODELED_CROSS_SECTION_PERIMETER_CONTRACT, 'modeled-cross-section-perimeter-v0');
  assert.equal(MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION, 'modeled-cross-section-perimeter-v0');
  assert.equal(MODELED_CROSS_SECTION_PERIMETER_STATUS.MODELED, 'modeled');
  assert.equal(MODELED_CROSS_SECTION_PERIMETER_STATUS.BLOCKED, 'blocked');
  assert.equal(MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE, 'unavailable');
  assert.equal(MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID, 'invalid');

  const def = SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0.torso_modeled_perimeter_at_hip_landmark_level;
  assert.ok(def);
  assert.equal(def.id, 'torso_modeled_perimeter_at_hip_landmark_level');
  assert.equal(def.name, 'Torso Modeled Perimeter Estimate at Hip Landmark Level');
  assert.equal(def.sourceLevel, 'hip');
  assert.equal(def.sourceCrossSectionDefinitionId, 'torso_cross_section_evidence_at_hip_level');
  assert.equal(def.modelFamily, 'ellipse');
  assert.equal(def.modelImplementation, 'ellipse_ramanujan_ii');
});

test('Modeled Cross-Section Perimeter v0: Qualified Hip evidence produces finite modeled value', () => {
  const hipEvidence = createMockHipCrossSectionEvidence();
  const result = evaluateModeledCrossSectionPerimeter(hipEvidence);

  assert.equal(result.contract, MODELED_CROSS_SECTION_PERIMETER_CONTRACT);
  assert.equal(result.version, MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION);
  assert.equal(result.id, 'torso_modeled_perimeter_at_hip_landmark_level');
  assert.equal(result.sourceLevel, 'hip');
  assert.equal(result.levelYcm, 86.25);
  assert.equal(result.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.MODELED);
  assert.equal(result.isModeled, true);
  assert.equal(result.isQualified, true);
  assert.equal(typeof result.valueCm, 'number');
  assert.ok(Number.isFinite(result.valueCm));
  assert.equal(result.blockers.length, 0);
  assert.equal(result.issues.length, 0);
});

test('Modeled Cross-Section Perimeter v0: 42.20 / 27.70 produces approximately 110.98306 cm', () => {
  const hipEvidence = createMockHipCrossSectionEvidence({ widthCm: 42.20, depthCm: 27.70 });
  const result = evaluateModeledCrossSectionPerimeter(hipEvidence);

  // Exact Ramanujan II: PI * (21.1 + 13.85) * (1 + 3h / (10 + sqrt(4 - 3h))) = 110.9830618865289
  const expectedValue = 110.9830618865289;
  assert.ok(Math.abs(result.valueCm - expectedValue) < 1e-4, `Expected near 110.98306, received ${result.valueCm}`);
  assert.equal(result.model.semiMajorAxisCm, 21.1);
  assert.equal(result.model.semiMinorAxisCm, 13.85);
  assert.equal(result.model.transverseWidthCm, 42.20);
  assert.equal(result.model.apDepthCm, 27.70);
  assert.ok(Math.abs(result.model.hParameter - 0.0430310) < 1e-5);
});

test('Modeled Cross-Section Perimeter v0: Formula is derived from input values and not hard-coded', () => {
  const hipEvidenceA = createMockHipCrossSectionEvidence({ widthCm: 50.0, depthCm: 30.0 });
  const resultA = evaluateModeledCrossSectionPerimeter(hipEvidenceA);

  const aA = 25.0;
  const bA = 15.0;
  const hA = ((aA - bA) ** 2) / ((aA + bA) ** 2);
  const expectedA = Math.PI * (aA + bA) * (1 + (3 * hA) / (10 + Math.sqrt(4 - 3 * hA)));
  assert.ok(Math.abs(resultA.valueCm - expectedA) < 1e-9);

  const hipEvidenceB = createMockHipCrossSectionEvidence({ widthCm: 35.5, depthCm: 22.4 });
  const resultB = evaluateModeledCrossSectionPerimeter(hipEvidenceB);

  const aB = 35.5 / 2;
  const bB = 22.4 / 2;
  const hB = ((aB - bB) ** 2) / ((aB + bB) ** 2);
  const expectedB = Math.PI * (aB + bB) * (1 + (3 * hB) / (10 + Math.sqrt(4 - 3 * hB)));
  assert.ok(Math.abs(resultB.valueCm - expectedB) < 1e-9);
});

test('Modeled Cross-Section Perimeter v0: Circle case (width === depth) evaluates exactly to 2 * PI * r', () => {
  const circleEvidence = createMockHipCrossSectionEvidence({ widthCm: 20.0, depthCm: 20.0 });
  const result = evaluateModeledCrossSectionPerimeter(circleEvidence);

  const expectedCirclePerimeter = 20.0 * Math.PI;
  assert.ok(Math.abs(result.valueCm - expectedCirclePerimeter) < 1e-12);
  assert.equal(result.model.hParameter, 0);
  assert.equal(result.model.semiMajorAxisCm, 10.0);
  assert.equal(result.model.semiMinorAxisCm, 10.0);
});

test('Modeled Cross-Section Perimeter v0: Shoulder produces no numeric perimeter and is explicitly unsupported', () => {
  const shoulderEvidence = {
    contract: 'cross-section-evidence-v0',
    version: 'cross-section-evidence-v0',
    id: 'torso_cross_section_evidence_at_shoulder_level',
    name: 'Torso Cross-Section Evidence at Shoulder Level',
    sourceLevel: 'shoulder',
    levelYcm: 132.85,
    status: 'qualified',
    isQualified: true,
    frontObservation: { transverseWidthCm: 30.80, status: 'valid' },
    sideObservation: { apDepthCm: 11.00, status: 'qualified' },
  };

  const resultDirect = evaluateModeledCrossSectionPerimeter(shoulderEvidence);
  assert.equal(resultDirect.valueCm, null);
  assert.equal(resultDirect.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.equal(resultDirect.isModeled, false);
  assert.ok(resultDirect.blockers.includes('shoulder_perimeter_unsupported'));
  assert.ok(resultDirect.issues.some((is) => is.toLowerCase().includes('shoulder')));

  // Explicit string definition request for shoulder
  const resultByDef = evaluateModeledCrossSectionPerimeter(shoulderEvidence, { definition: 'torso_modeled_perimeter_at_shoulder_level' });
  assert.equal(resultByDef.valueCm, null);
  assert.equal(resultByDef.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.ok(resultByDef.blockers.includes('shoulder_perimeter_unsupported'));
});

test('Modeled Cross-Section Perimeter v0: Missing evidence resolves to unavailable with valueCm null', () => {
  const resultNull = evaluateModeledCrossSectionPerimeter(null);
  assert.equal(resultNull.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE);
  assert.equal(resultNull.valueCm, null);
  assert.equal(resultNull.isModeled, false);
  assert.ok(resultNull.blockers.includes('cross_section_evidence_unavailable'));

  const resultUndefined = evaluateModeledCrossSectionPerimeter(undefined);
  assert.equal(resultUndefined.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE);
  assert.equal(resultUndefined.valueCm, null);
});

test('Modeled Cross-Section Perimeter v0: Unqualified Cross-Section Evidence produces valueCm null', () => {
  // Blocked upstream
  const blockedEvidence = createMockHipCrossSectionEvidence({
    status: 'blocked',
    isQualified: false,
    blockers: ['front_width_not_valid'],
  });
  const resultBlocked = evaluateModeledCrossSectionPerimeter(blockedEvidence);
  assert.equal(resultBlocked.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.BLOCKED);
  assert.equal(resultBlocked.valueCm, null);
  assert.equal(resultBlocked.isModeled, false);
  assert.ok(resultBlocked.blockers.includes('cross_section_evidence_not_qualified'));

  // Unavailable upstream
  const unavailableEvidence = createMockHipCrossSectionEvidence({
    status: 'unavailable',
    isQualified: false,
    widthCm: null,
  });
  const resultUnavailable = evaluateModeledCrossSectionPerimeter(unavailableEvidence);
  assert.equal(resultUnavailable.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE);
  assert.equal(resultUnavailable.valueCm, null);

  // Invalid upstream
  const invalidEvidence = createMockHipCrossSectionEvidence({
    status: 'invalid',
    isQualified: false,
    issues: ['Structural contradiction in Y provenance'],
  });
  const resultInvalid = evaluateModeledCrossSectionPerimeter(invalidEvidence);
  assert.equal(resultInvalid.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.equal(resultInvalid.valueCm, null);
});

test('Modeled Cross-Section Perimeter v0: Zero width rejected', () => {
  const zeroWidthEvidence = createMockHipCrossSectionEvidence({ widthCm: 0 });
  const result = evaluateModeledCrossSectionPerimeter(zeroWidthEvidence);
  assert.equal(result.valueCm, null);
  assert.equal(result.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.ok(result.issues.some((is) => is.includes('Front transverse width is invalid')));
});

test('Modeled Cross-Section Perimeter v0: Zero depth rejected', () => {
  const zeroDepthEvidence = createMockHipCrossSectionEvidence({ depthCm: 0 });
  const result = evaluateModeledCrossSectionPerimeter(zeroDepthEvidence);
  assert.equal(result.valueCm, null);
  assert.equal(result.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.ok(result.issues.some((is) => is.includes('Side AP depth is invalid')));
});

test('Modeled Cross-Section Perimeter v0: NaN and Infinity rejected', () => {
  const nanWidthEvidence = createMockHipCrossSectionEvidence({ widthCm: NaN });
  const resultNan = evaluateModeledCrossSectionPerimeter(nanWidthEvidence);
  assert.equal(resultNan.valueCm, null);
  assert.equal(resultNan.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);

  const infDepthEvidence = createMockHipCrossSectionEvidence({ depthCm: Infinity });
  const resultInf = evaluateModeledCrossSectionPerimeter(infDepthEvidence);
  assert.equal(resultInf.valueCm, null);
  assert.equal(resultInf.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);

  // Helper directly
  assert.equal(computeRamanujanEllipsePerimeter(NaN, 20), null);
  assert.equal(computeRamanujanEllipsePerimeter(20, Infinity), null);
  assert.equal(computeRamanujanEllipsePerimeter(-5, 20), null);
});

test('Modeled Cross-Section Perimeter v0: Wrong contract id rejected', () => {
  const wrongContractEvidence = createMockHipCrossSectionEvidence({
    contract: 'direct-body-measurements-v0',
  });
  const result = evaluateModeledCrossSectionPerimeter(wrongContractEvidence);
  assert.equal(result.valueCm, null);
  assert.equal(result.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.ok(result.blockers.includes('cross_section_contract_invalid'));
});

test('Modeled Cross-Section Perimeter v0: Wrong source level rejected', () => {
  const wrongLevelEvidence = createMockHipCrossSectionEvidence({
    sourceLevel: 'knee',
  });
  const result = evaluateModeledCrossSectionPerimeter(wrongLevelEvidence);
  assert.equal(result.valueCm, null);
  assert.equal(result.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.ok(result.blockers.includes('definition_unsupported') || result.blockers.includes('source_level_mismatch'));
});

test('Modeled Cross-Section Perimeter v0: Definition/provenance mismatch rejected', () => {
  const hipEvidence = createMockHipCrossSectionEvidence();
  const resultMismatch = evaluateModeledCrossSectionPerimeter(hipEvidence, { definition: 'unregistered_perimeter_def' });
  assert.equal(resultMismatch.valueCm, null);
  assert.equal(resultMismatch.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);
  assert.ok(resultMismatch.blockers.includes('definition_unsupported'));
});

test('Modeled Cross-Section Perimeter v0: Source evidence input is not mutated', () => {
  const hipEvidence = createMockHipCrossSectionEvidence();
  const snapshotBefore = JSON.stringify(hipEvidence);
  Object.freeze(hipEvidence);
  Object.freeze(hipEvidence.frontObservation);
  Object.freeze(hipEvidence.sideObservation);

  const result = evaluateModeledCrossSectionPerimeter(hipEvidence);
  assert.ok(result);
  const snapshotAfter = JSON.stringify(hipEvidence);
  assert.equal(snapshotBefore, snapshotAfter);
});

test('Modeled Cross-Section Perimeter v0: Strict semantic guardrails explicitly established', () => {
  const hipEvidence = createMockHipCrossSectionEvidence();
  const result = evaluateModeledCrossSectionPerimeter(hipEvidence);

  assert.equal(result.semantics.isModeledQuantity, true);
  assert.equal(result.semantics.isMeasuredContour, false);
  assert.equal(result.semantics.isAnthropometricHipCircumference, false);
  assert.equal(result.semantics.isMaximumSeatPlane, false);
  assert.equal(result.semantics.is3dReconstruction, false);
  assert.equal(result.semantics.isBodyVolume, false);

  assert.ok(result.semantics.statement.includes('NOT measured contour length'));
  assert.ok(result.semantics.statement.includes('NOT anthropometric Hip Circumference'));
  assert.ok(result.semantics.statement.includes('NOT maximum Hip/Seat Circumference'));
  assert.ok(result.semantics.statement.includes('NOT maximum buttock plane'));
  assert.ok(result.semantics.statement.includes('NOT 3D slice'));
  assert.ok(result.semantics.statement.includes('NOT canonical Z'));

  // Ensure no forbidden geometric properties exist on the object
  assert.equal(result.sideUToCanonicalZ, undefined);
  assert.equal(result.pointmapZ, undefined);
  assert.equal(result.surfaceNormals, undefined);
  assert.equal(result.volume, undefined);
  assert.equal(result.contour3D, undefined);
});

test('Modeled Cross-Section Perimeter v0: Runtime getters in bodyEvidence.js behave safely', async () => {
  const {
    getModeledCrossSectionPerimeter,
    getModeledCrossSectionPerimeters,
    getModeledCrossSectionPerimeterReport,
  } = await import('./bodyEvidence.js');

  // Unanalyzed / empty state
  assert.equal(getModeledCrossSectionPerimeter({ id: 'invalid_id' }), null);

  const shoulderRequest = getModeledCrossSectionPerimeter({ id: 'torso_modeled_perimeter_at_shoulder_level' });
  assert.ok(shoulderRequest);
  assert.equal(shoulderRequest.valueCm, null);
  assert.equal(shoulderRequest.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.INVALID);

  const hipUnanalyzed = getModeledCrossSectionPerimeter({ id: 'torso_modeled_perimeter_at_hip_landmark_level' });
  assert.ok(hipUnanalyzed);
  assert.equal(hipUnanalyzed.valueCm, null);
  assert.equal(hipUnanalyzed.status, MODELED_CROSS_SECTION_PERIMETER_STATUS.UNAVAILABLE);

  assert.equal(getModeledCrossSectionPerimeters(), null);
  assert.equal(getModeledCrossSectionPerimeterReport(), null);
});

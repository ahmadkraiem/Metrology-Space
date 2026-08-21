import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

import {
  CLOTHING_BODY_SURFACE_CONTRACT,
  CLOTHING_BODY_SURFACE_CONTRACT_VERSION,
  CLOTHING_BODY_SURFACE_STATUS,
  GARMENT_FIT_STATUS,
  IMPLEMENTED_PARTICIPATION_EVALUATORS,
  IMPLEMENTED_VISUAL_GARMENT_EVALUATORS,
  IMPLEMENTED_BODY_SURFACE_EVALUATORS,
  RESERVED_FUTURE_VISUAL_GARMENT_EVALUATORS,
  RESERVED_FUTURE_BODY_SURFACE_EVALUATORS,
  _registerTestGarmentEvaluator,
  _registerTestBodySurfaceEvaluator,
  _clearTestClothingEvaluators,
  evaluateClothingBodySurfaceSemantics,
  evaluateClothingBodySurfaceSemanticsReport,
} from './clothingBodySurfaceSemantics.js';

import { importBodyEvidenceZip } from './bodyEvidenceZipAdapter.js';
import {
  evaluatePhysicalMeasurementEligibility,
} from './physicalMeasurementEligibility.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getClothingBodySurfaceSemantics,
  getClothingBodySurfaceSemanticsReport,
  getPhysicalMeasurementEligibility,
  getPhysicalMeasurementEligibilityReport,
} from './bodyEvidence.js';

function createMockObservation({
  id = 'torso_transverse_width_at_shoulder_level',
  view = 'front',
  supportPolicyId = 'trunk_core_support_v0',
  usedClothingEvidence = true,
  clothingClassIdsUsed = [23],
  actualClassIdsUsed = [22, 23],
  metricSpanCm = 30.8,
} = {}) {
  return {
    id,
    definition: { id, view, sourceLevel: 'shoulder' },
    view,
    supportPolicyId,
    usedClothingEvidence,
    clothingClassIdsUsed,
    actualClassIdsUsed,
    metricSpanCm,
    valueCm: metricSpanCm,
    status: 'valid',
  };
}

describe('Milestone 4.5F — Clothing / Body-Surface Authorization v0', () => {
  beforeEach(() => {
    _clearTestClothingEvaluators();
    setBodyEvidencePackage(null);
  });

  afterEach(() => {
    _clearTestClothingEvaluators();
    setBodyEvidencePackage(null);
  });

  it('exports contract metadata, taxonomies, and evaluator registries', () => {
    assert.equal(CLOTHING_BODY_SURFACE_CONTRACT, 'clothing-body-surface-semantics-v0');
    assert.equal(CLOTHING_BODY_SURFACE_CONTRACT_VERSION, 'clothing-body-surface-semantics-v0');
    assert.equal(CLOTHING_BODY_SURFACE_STATUS.AUTHORIZED, 'authorized');
    assert.equal(CLOTHING_BODY_SURFACE_STATUS.PARTIAL, 'partial');
    assert.equal(CLOTHING_BODY_SURFACE_STATUS.UNVALIDATED, 'unvalidated');
    assert.equal(CLOTHING_BODY_SURFACE_STATUS.INVALID, 'invalid');
    assert.equal(CLOTHING_BODY_SURFACE_STATUS.UNAVAILABLE, 'unavailable');

    assert.equal(GARMENT_FIT_STATUS.QUALIFIED, 'qualified');
    assert.equal(GARMENT_FIT_STATUS.DISQUALIFIED, 'disqualified');
    assert.equal(GARMENT_FIT_STATUS.AMBIGUOUS, 'ambiguous');
    assert.equal(GARMENT_FIT_STATUS.UNRESOLVED, 'unresolved');
    assert.equal(GARMENT_FIT_STATUS.NOT_APPLICABLE, 'not_applicable');

    assert.ok(IMPLEMENTED_PARTICIPATION_EVALUATORS.includes('body-pipeline-clothing-participation-evaluator-v0'));
    assert.deepEqual(IMPLEMENTED_VISUAL_GARMENT_EVALUATORS, []);
    assert.deepEqual(IMPLEMENTED_BODY_SURFACE_EVALUATORS, []);
    assert.ok(RESERVED_FUTURE_VISUAL_GARMENT_EVALUATORS.includes('vlm-garment-fit-classifier-v0'));
    assert.ok(RESERVED_FUTURE_BODY_SURFACE_EVALUATORS.includes('empirical-activewear-ground-truth-v0'));
  });

  it('evaluates status unavailable when observation is null', () => {
    const res = evaluateClothingBodySurfaceSemantics(null);
    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.UNAVAILABLE);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.clothingParticipationValidated, false);
    assert.equal(res.checks.source_integrity.status, 'fail');
  });

  it('evaluates status invalid when contradictory clothing evidence is encountered', () => {
    const obs = createMockObservation({
      usedClothingEvidence: false,
      clothingClassIdsUsed: [23], // contradiction: false flag but non-empty clothing classes
    });
    const res = evaluateClothingBodySurfaceSemantics(obs);
    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.INVALID);
    assert.equal(res.authorized, false);
    assert.equal(res.checks.clothing_participation.status, 'fail');
  });

  it('evaluates clothing-free path cleanly: clothing constraint satisfied, garment fit not applicable, body surface unresolved', () => {
    const obs = createMockObservation({
      usedClothingEvidence: false,
      clothingClassIdsUsed: [],
      actualClassIdsUsed: [22], // bare torso only
    });
    const res = evaluateClothingBodySurfaceSemantics(obs);

    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.PARTIAL);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.clothingParticipationValidated, true);
    assert.equal(res.dimensions.clothingConstraintSatisfied, true); // clears clothing blocker in 4.5D
    assert.equal(res.dimensions.garmentFitQualified, false);
    assert.equal(res.dimensions.candidateForMetrologyValidation, false);
    assert.equal(res.dimensions.bodySurfaceAuthorized, false);

    assert.equal(res.garmentQualification.garmentFitStatus, GARMENT_FIT_STATUS.NOT_APPLICABLE);
    assert.equal(res.checks.clothing_participation.status, 'pass');
    assert.equal(res.checks.garment_fit_qualification.status, 'skip');
    assert.equal(res.checks.body_surface_authorization.status, 'skip');
  });

  it('evaluates clothing-present path with standard v0 evidence: partial status, constraint unsatisfied, garment fit unresolved', () => {
    const obs = createMockObservation({
      usedClothingEvidence: true,
      clothingClassIdsUsed: [23],
      actualClassIdsUsed: [22, 23],
    });
    const res = evaluateClothingBodySurfaceSemantics(obs);

    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.PARTIAL);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.clothingParticipationValidated, true);
    assert.equal(res.dimensions.clothingConstraintSatisfied, false); // clothing blocker remains active
    assert.equal(res.dimensions.garmentFitQualified, false);
    assert.equal(res.dimensions.candidateForMetrologyValidation, false);
    assert.equal(res.dimensions.bodySurfaceAuthorized, false);

    assert.equal(res.garmentQualification.garmentFitStatus, GARMENT_FIT_STATUS.UNRESOLVED);
    assert.equal(res.checks.clothing_participation.status, 'pass');
    assert.equal(res.checks.garment_fit_qualification.status, 'skip');
    assert.equal(res.checks.body_surface_authorization.status, 'skip');
  });

  it('strictly rejects unverified caller boolean objects as proof', () => {
    const obs = createMockObservation({ usedClothingEvidence: true });
    const fakeGarmentResult = {
      evaluatorId: 'unregistered-caller-evaluator',
      garmentFitQualified: true,
      candidateForMetrologyValidation: true,
    };
    const res = evaluateClothingBodySurfaceSemantics(obs, { garmentEvaluationResult: fakeGarmentResult });

    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.INVALID);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.clothingConstraintSatisfied, false);
    assert.equal(res.checks.garment_fit_qualification.status, 'fail');
    assert.equal(res.checks.evaluator_provenance.status, 'fail');
  });

  it('promotes Layer B to qualified when a recognized visual garment evaluator passes, but keeps Layer C unauthorized', () => {
    const testGarmentEvalId = 'test-visual-garment-eval-v0';
    _registerTestGarmentEvaluator(testGarmentEvalId);

    const obs = createMockObservation({ usedClothingEvidence: true });
    const validGarmentResult = {
      evaluatorId: testGarmentEvalId,
      garmentType: 'fitted_activewear',
      garmentFit: 'body_hugging',
      garmentFitStatus: GARMENT_FIT_STATUS.QUALIFIED,
      garmentFitQualified: true,
      candidateForMetrologyValidation: true,
    };

    const res = evaluateClothingBodySurfaceSemantics(obs, { garmentEvaluationResult: validGarmentResult });

    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.PARTIAL);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.clothingParticipationValidated, true);
    assert.equal(res.dimensions.clothingConstraintSatisfied, false); // still false because Layer C is missing!
    assert.equal(res.dimensions.garmentFitQualified, true);
    assert.equal(res.dimensions.candidateForMetrologyValidation, true);
    assert.equal(res.dimensions.bodySurfaceAuthorized, false);

    assert.equal(res.garmentQualification.garmentFitStatus, GARMENT_FIT_STATUS.QUALIFIED);
    assert.equal(res.checks.garment_fit_qualification.status, 'pass');
    assert.equal(res.checks.body_surface_authorization.status, 'skip');
  });

  it('promotes to authorized ONLY when both recognized Layer B and Layer C evaluators pass', () => {
    const testGarmentEvalId = 'test-visual-garment-eval-v0';
    const testBodySurfaceEvalId = 'test-body-surface-eval-v0';
    _registerTestGarmentEvaluator(testGarmentEvalId);
    _registerTestBodySurfaceEvaluator(testBodySurfaceEvalId);

    const obs = createMockObservation({ usedClothingEvidence: true });
    const validGarmentResult = {
      evaluatorId: testGarmentEvalId,
      garmentType: 'fitted_activewear',
      garmentFit: 'body_hugging',
      garmentFitQualified: true,
      candidateForMetrologyValidation: true,
    };
    const validBodySurfaceResult = {
      evaluatorId: testBodySurfaceEvalId,
      authorizationMode: 'direct_equivalence',
      declaredUncertaintyCm: 0.35,
      authorized: true,
    };

    const res = evaluateClothingBodySurfaceSemantics(obs, {
      garmentEvaluationResult: validGarmentResult,
      bodySurfaceAuthorizationResult: validBodySurfaceResult,
    });

    assert.equal(res.status, CLOTHING_BODY_SURFACE_STATUS.AUTHORIZED);
    assert.equal(res.authorized, true);
    assert.equal(res.dimensions.clothingParticipationValidated, true);
    assert.equal(res.dimensions.garmentFitQualified, true);
    assert.equal(res.dimensions.candidateForMetrologyValidation, true);
    assert.equal(res.dimensions.bodySurfaceAuthorized, true);
    assert.equal(res.dimensions.clothingConstraintSatisfied, true);

    assert.equal(res.bodySurfaceAuthorization.authorizationMode, 'direct_equivalence');
    assert.equal(res.bodySurfaceAuthorization.declaredUncertaintyCm, 0.35);
    assert.equal(res.checks.body_surface_authorization.status, 'pass');
  });

  it('evaluates report across multiple observations', () => {
    const obs1 = createMockObservation({ id: 'torso_transverse_width_at_shoulder_level', usedClothingEvidence: true });
    const obs2 = createMockObservation({ id: 'torso_transverse_width_at_hip_level', usedClothingEvidence: false, clothingClassIdsUsed: [] });

    const report = evaluateClothingBodySurfaceSemanticsReport({ observations: [obs1, obs2] });
    assert.ok(report);
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.partialCount, 2);
    assert.equal(report.summary.clothingConstraintSatisfiedCount, 1); // obs2 was clothing-free
  });

  it('integrates with bodyEvidence.js and physicalMeasurementEligibility', () => {
    const obs = createMockObservation({
      id: 'torso_transverse_width_at_shoulder_level',
      view: 'front',
      usedClothingEvidence: true,
      clothingClassIdsUsed: [23],
    });

    const clothingRes = evaluateClothingBodySurfaceSemantics(obs);
    assert.equal(clothingRes.dimensions.clothingConstraintSatisfied, false);

    const eligibility = evaluatePhysicalMeasurementEligibility(obs, {
      clothingAuthorizationResult: clothingRes,
    });
    assert.ok(eligibility);
    assert.equal(eligibility.clothingDependenceSummary.authorizationStatus, 'partial');
    assert.ok(eligibility.blockers.includes('clothing_authorization_missing'));
  });
});

describe('Real Unified Body Pipeline Archive Integration (output.zip)', () => {
  const zipPath = 'C:\\Users\\VIP\\Downloads\\output.zip';

  it('evaluates real Body Pipeline archive: Front and Side are status partial, clothingConstraintSatisfied false, 4.5D blockers intact', async () => {
    if (!fs.existsSync(zipPath)) {
      console.warn(`[Test Skipped] Real archive output.zip not found at: ${zipPath}`);
      return;
    }

    const zipBytes = fs.readFileSync(zipPath);
    const importRes = await importBodyEvidenceZip(zipBytes);
    assert.equal(importRes.ok, true, `Import failed: ${importRes.error}`);
    const pkg = importRes.package;
    assert.ok(pkg, 'Expected non-null Body Evidence package from real zip');

    setBodyEvidencePackage(pkg);
    const analysisRes = await analyzeLoadedBodyEvidenceAsync();
    assert.ok(analysisRes.ok, `Body evidence analysis failed: ${analysisRes.error}`);

    const pixelsPerCm = 10;
    const canvasSize = 2000;
    const frontLandmarks = pkg.front?.pose?.acceptedLandmarks ?? [];
    const annotations = frontLandmarks.map((lm) => ({
      type: 'body_landmark',
      name: lm.name,
      point: {
        x: typeof lm.imageX === 'number' ? lm.imageX / pixelsPerCm : 0,
        y: typeof lm.imageY === 'number' ? (canvasSize - lm.imageY) / pixelsPerCm : 0,
        z: 200,
      },
    }));

    // 1. Evaluate 4.5F Clothing / Body-Surface Semantics on All 4 Canonical Measurements
    const frontShoulderClothing = getClothingBodySurfaceSemantics({
      id: 'torso_transverse_width_at_shoulder_level',
      annotations,
    });
    assert.ok(frontShoulderClothing);
    assert.equal(frontShoulderClothing.status, 'partial');
    assert.equal(frontShoulderClothing.authorized, false);
    assert.equal(frontShoulderClothing.dimensions.clothingParticipationValidated, true);
    assert.equal(frontShoulderClothing.dimensions.clothingConstraintSatisfied, false);
    assert.equal(frontShoulderClothing.dimensions.garmentFitQualified, false);
    assert.equal(frontShoulderClothing.dimensions.bodySurfaceAuthorized, false);
    assert.equal(frontShoulderClothing.garmentQualification.garmentFitStatus, 'unresolved');
    assert.deepEqual(frontShoulderClothing.clothingEvidence.clothingClassIdsUsed, [23]);

    const sideShoulderClothing = getClothingBodySurfaceSemantics({
      id: 'torso_profile_span_at_shoulder_level',
      annotations,
    });
    assert.ok(sideShoulderClothing);
    assert.equal(sideShoulderClothing.status, 'partial');
    assert.equal(sideShoulderClothing.authorized, false);
    assert.equal(sideShoulderClothing.dimensions.clothingConstraintSatisfied, false);
    assert.equal(sideShoulderClothing.garmentQualification.garmentFitStatus, 'unresolved');
    assert.deepEqual(sideShoulderClothing.clothingEvidence.clothingClassIdsUsed, [23]);

    const frontHipClothing = getClothingBodySurfaceSemantics({
      id: 'torso_transverse_width_at_hip_level',
      annotations,
    });
    assert.ok(frontHipClothing);
    assert.equal(frontHipClothing.status, 'partial');
    assert.equal(frontHipClothing.authorized, false);
    assert.equal(frontHipClothing.dimensions.clothingConstraintSatisfied, false);
    assert.equal(frontHipClothing.garmentQualification.garmentFitStatus, 'unresolved');
    assert.deepEqual(frontHipClothing.clothingEvidence.clothingClassIdsUsed, [13]);

    const sideHipClothing = getClothingBodySurfaceSemantics({
      id: 'torso_profile_span_at_hip_level',
      annotations,
    });
    assert.ok(sideHipClothing);
    assert.equal(sideHipClothing.status, 'partial');
    assert.equal(sideHipClothing.authorized, false);
    assert.equal(sideHipClothing.dimensions.clothingConstraintSatisfied, false);
    assert.equal(sideHipClothing.garmentQualification.garmentFitStatus, 'unresolved');
    assert.deepEqual(sideHipClothing.clothingEvidence.clothingClassIdsUsed, [13]);

    // 2. Evaluate 4.5F Report
    const clothingReport = getClothingBodySurfaceSemanticsReport({ annotations });
    assert.ok(clothingReport);
    assert.equal(clothingReport.summary.total, 4);
    assert.equal(clothingReport.summary.partialCount, 4);
    assert.equal(clothingReport.summary.clothingConstraintSatisfiedCount, 0);

    // 3. Evaluate 4.5D Physical Measurement Eligibility Report
    const eligibilityReport = getPhysicalMeasurementEligibilityReport({ annotations });
    assert.ok(eligibilityReport);
    assert.equal(eligibilityReport.summary.total, 4);
    assert.equal(eligibilityReport.summary.blockedByClothingCount, 4);
    assert.equal(eligibilityReport.summary.eligibleCount, 0);

    for (const res of eligibilityReport.results) {
      assert.equal(res.status, 'blocked_by_clothing');
      assert.equal(res.physicalEligibility, false);
      assert.equal(res.physicalMeasurementCm, null);
      assert.ok(typeof res.metricProjectedSpanCm === 'number' && res.metricProjectedSpanCm > 0);

      // Verify all 3 physical blockers remain active
      assert.ok(res.blockers.includes('clothing_authorization_missing'));
      assert.ok(res.blockers.includes('view_pose_semantics_missing'));
      assert.ok(res.blockers.includes('authoritative_physical_evidence_missing'));
    }

    // Verify exact metric projected measurements
    const frontShoulder = eligibilityReport.results.find((r) => (r.definition?.id ?? r.id) === 'torso_transverse_width_at_shoulder_level');
    assert.ok(Math.abs(frontShoulder.metricProjectedSpanCm - 30.80) < 1e-4);

    const sideShoulder = eligibilityReport.results.find((r) => (r.definition?.id ?? r.id) === 'torso_profile_span_at_shoulder_level');
    assert.ok(Math.abs(sideShoulder.metricProjectedSpanCm - 11.00) < 1e-4);

    const frontHip = eligibilityReport.results.find((r) => (r.definition?.id ?? r.id) === 'torso_transverse_width_at_hip_level');
    assert.ok(Math.abs(frontHip.metricProjectedSpanCm - 42.20) < 1e-4);

    const sideHip = eligibilityReport.results.find((r) => (r.definition?.id ?? r.id) === 'torso_profile_span_at_hip_level');
    assert.ok(Math.abs(sideHip.metricProjectedSpanCm - 27.70) < 1e-4);
  });
});

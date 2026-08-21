import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  VIEW_POSE_SEMANTICS_CONTRACT,
  VIEW_POSE_SEMANTICS_CONTRACT_VERSION,
  VIEW_POSE_STATUS,
  IMPLEMENTED_STRUCTURAL_POSE_EVALUATORS,
  IMPLEMENTED_PHYSICAL_ORIENTATION_EVALUATORS,
  RESERVED_FUTURE_PHYSICAL_ORIENTATION_EVALUATORS,
  evaluateViewPoseSemantics,
  evaluateViewPoseSemanticsReport,
  _registerTestOrientationEvaluator,
  _clearTestOrientationEvaluators,
} from './viewPoseSemantics.js';

import { importBodyEvidenceZip } from './bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getViewPoseSemantics,
  getViewPoseSemanticsReport,
  getPhysicalMeasurementEligibility,
  getPhysicalMeasurementEligibilityReport,
} from './bodyEvidence.js';

function createMockFrontViewPackage({
  view = 'front',
  neck = { x: 1005, y: 580, score: 0.98 },
  nose = { x: 1000, y: 470, score: 0.99 },
  leftShoulder = { x: 1170, y: 670, score: 0.98 },
  rightShoulder = { x: 840, y: 670, score: 0.97 },
  leftWrist = { x: 1320, y: 1150, score: 0.99 },
  rightWrist = { x: 680, y: 1150, score: 0.99 },
  leftHip = { x: 1110, y: 1140, score: 0.96 },
  rightHip = { x: 890, y: 1140, score: 0.95 },
  leftAnkle = { x: 1170, y: 1860, score: 0.99 },
  rightAnkle = { x: 850, y: 1860, score: 1.0 },
} = {}) {
  const acceptedLandmarks = [
    { name: 'neck', imageX: neck.x, imageY: neck.y, score: neck.score },
    { name: 'nose', imageX: nose.x, imageY: nose.y, score: nose.score },
    { name: 'left_shoulder', imageX: leftShoulder.x, imageY: leftShoulder.y, score: leftShoulder.score },
    { name: 'right_shoulder', imageX: rightShoulder.x, imageY: rightShoulder.y, score: rightShoulder.score },
    { name: 'left_wrist', imageX: leftWrist.x, imageY: leftWrist.y, score: leftWrist.score },
    { name: 'right_wrist', imageX: rightWrist.x, imageY: rightWrist.y, score: rightWrist.score },
    { name: 'left_hip', imageX: leftHip.x, imageY: leftHip.y, score: leftHip.score },
    { name: 'right_hip', imageX: rightHip.x, imageY: rightHip.y, score: rightHip.score },
    { name: 'left_ankle', imageX: leftAnkle.x, imageY: leftAnkle.y, score: leftAnkle.score },
    { name: 'right_ankle', imageX: rightAnkle.x, imageY: rightAnkle.y, score: rightAnkle.score },
  ];

  return {
    image: { present: true, view, widthPx: 2000, heightPx: 2000 },
    calibration: { view, pixelsPerCm: 10, scaleFactor: 1.31 },
    pose: {
      total: acceptedLandmarks.length,
      accepted: acceptedLandmarks.length,
      acceptedLandmarks,
    },
  };
}

function createMockSideViewPackage({
  view = 'side',
  neck = { x: 970, y: 580, score: 0.98 },
  nose = { x: 850, y: 470, score: 0.99 },
  leftShoulder = { x: 1020, y: 630, score: 0.88 },
  rightShoulder = { x: 920, y: 640, score: 0.89 },
  leftHip = { x: 980, y: 1130, score: 0.75 },
  rightHip = { x: 915, y: 1130, score: 0.72 },
  leftAnkle = { x: 1020, y: 1900, score: 0.95 },
  rightAnkle = { x: 985, y: 1840, score: 0.96 },
} = {}) {
  const acceptedLandmarks = [
    { name: 'neck', imageX: neck.x, imageY: neck.y, score: neck.score },
    { name: 'nose', imageX: nose.x, imageY: nose.y, score: nose.score },
    { name: 'left_shoulder', imageX: leftShoulder.x, imageY: leftShoulder.y, score: leftShoulder.score },
    { name: 'right_shoulder', imageX: rightShoulder.x, imageY: rightShoulder.y, score: rightShoulder.score },
    { name: 'left_hip', imageX: leftHip.x, imageY: leftHip.y, score: leftHip.score },
    { name: 'right_hip', imageX: rightHip.x, imageY: rightHip.y, score: rightHip.score },
    { name: 'left_ankle', imageX: leftAnkle.x, imageY: leftAnkle.y, score: leftAnkle.score },
    { name: 'right_ankle', imageX: rightAnkle.x, imageY: rightAnkle.y, score: rightAnkle.score },
  ];

  return {
    image: { present: true, view, widthPx: 2000, heightPx: 2000 },
    calibration: { view, pixelsPerCm: 10, scaleFactor: 1.49 },
    pose: {
      total: acceptedLandmarks.length,
      accepted: acceptedLandmarks.length,
      acceptedLandmarks,
    },
  };
}

describe('Milestone 4.5E — Authoritative View / Pose Semantics Validation v0', () => {
  beforeEach(() => {
    _clearTestOrientationEvaluators();
    setBodyEvidencePackage(null);
  });

  afterEach(() => {
    _clearTestOrientationEvaluators();
    setBodyEvidencePackage(null);
  });

  it('exports contract metadata, status taxonomy, and evaluator registries', () => {
    assert.equal(VIEW_POSE_SEMANTICS_CONTRACT, 'view-pose-semantics-v0');
    assert.equal(VIEW_POSE_SEMANTICS_CONTRACT_VERSION, 'view-pose-semantics-v0');
    assert.equal(VIEW_POSE_STATUS.VALIDATED, 'validated');
    assert.equal(VIEW_POSE_STATUS.PARTIAL, 'partial');
    assert.equal(VIEW_POSE_STATUS.UNVALIDATED, 'unvalidated');
    assert.equal(VIEW_POSE_STATUS.INVALID, 'invalid');
    assert.equal(VIEW_POSE_STATUS.UNAVAILABLE, 'unavailable');

    assert.ok(IMPLEMENTED_STRUCTURAL_POSE_EVALUATORS.includes('body-pipeline-structural-pose-evaluator-v0'));
    assert.deepEqual(IMPLEMENTED_PHYSICAL_ORIENTATION_EVALUATORS, []);
    assert.ok(RESERVED_FUTURE_PHYSICAL_ORIENTATION_EVALUATORS.includes('controlled-capture-protocol-pose-v0'));
  });

  it('evaluates status unavailable when viewPackage is null or pose is absent', () => {
    const resNull = evaluateViewPoseSemantics(null, { view: 'front' });
    assert.equal(resNull.status, VIEW_POSE_STATUS.UNAVAILABLE);
    assert.equal(resNull.authorized, false);
    assert.equal(resNull.checks.source_integrity.status, 'fail');

    const resNoPose = evaluateViewPoseSemantics({ image: { view: 'front' }, pose: null }, { view: 'front' });
    assert.equal(resNoPose.status, VIEW_POSE_STATUS.UNAVAILABLE);
    assert.equal(resNoPose.authorized, false);
  });

  it('evaluates status invalid when declared view contradicts requested view', () => {
    const pkg = createMockFrontViewPackage({ view: 'front' });
    const res = evaluateViewPoseSemantics(pkg, { view: 'side' });
    assert.equal(res.status, VIEW_POSE_STATUS.INVALID);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.declaredViewConsistent, false);
    assert.equal(res.checks.view_identity_declared.status, 'fail');
  });

  it('evaluates status invalid when required core landmarks are missing or low-confidence (< 0.5)', () => {
    const pkg = createMockFrontViewPackage({
      leftWrist: { x: 1320, y: 1150, score: 0.3 }, // below LOW_CONFIDENCE_THRESHOLD = 0.5
    });
    const res = evaluateViewPoseSemantics(pkg, { view: 'front' });
    assert.equal(res.status, VIEW_POSE_STATUS.INVALID);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.structuralPoseValidated, false);
    assert.equal(res.checks.landmark_completeness.status, 'fail');
  });

  it('evaluates status invalid when anatomical vertical ordering is inverted', () => {
    const pkg = createMockFrontViewPackage({
      neck: { x: 1005, y: 1200, score: 0.98 }, // inverted: neck below shoulders
      nose: { x: 1000, y: 1200, score: 0.99 },
    });
    const res = evaluateViewPoseSemantics(pkg, { view: 'front' });
    assert.equal(res.status, VIEW_POSE_STATUS.INVALID);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.structuralPoseValidated, false);
    assert.equal(res.checks.anatomical_vertical_ordering.status, 'fail');
  });

  it('evaluates status invalid when Front A-pose arms are collapsed against the trunk', () => {
    const pkg = createMockFrontViewPackage({
      rightWrist: { x: 900, y: 1150, score: 0.99 }, // collapsed: right wrist inside right shoulder (840)
    });
    const res = evaluateViewPoseSemantics(pkg, { view: 'front' });
    assert.equal(res.status, VIEW_POSE_STATUS.INVALID);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.structuralPoseValidated, false);
    assert.equal(res.checks.limb_separation_sanity.status, 'fail');
  });

  it('evaluates status partial and authorized false for valid Front structural evidence (Layer A + B pass, Layer C missing)', () => {
    const pkg = createMockFrontViewPackage();
    const res = evaluateViewPoseSemantics(pkg, { view: 'front' });
    assert.equal(res.status, VIEW_POSE_STATUS.PARTIAL);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.declaredViewConsistent, true);
    assert.equal(res.dimensions.structuralPoseValidated, true);
    assert.equal(res.dimensions.physicalOrientationAuthorized, false);
    assert.equal(res.checks.source_integrity.status, 'pass');
    assert.equal(res.checks.view_identity_declared.status, 'pass');
    assert.equal(res.checks.landmark_completeness.status, 'pass');
    assert.equal(res.checks.anatomical_vertical_ordering.status, 'pass');
    assert.equal(res.checks.limb_separation_sanity.status, 'pass');
    assert.equal(res.checks.structural_pose_qualification.status, 'pass');
    assert.equal(res.checks.physical_orientation_certification.status, 'skip');
  });

  it('evaluates status partial and authorized false for valid Side structural evidence', () => {
    const pkg = createMockSideViewPackage();
    const res = evaluateViewPoseSemantics(pkg, { view: 'side' });
    assert.equal(res.status, VIEW_POSE_STATUS.PARTIAL);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.declaredViewConsistent, true);
    assert.equal(res.dimensions.structuralPoseValidated, true);
    assert.equal(res.dimensions.physicalOrientationAuthorized, false);
    assert.equal(res.checks.structural_pose_qualification.status, 'pass');
  });

  it('strictly rejects unverified caller boolean objects as physical orientation proof', () => {
    const pkg = createMockFrontViewPackage();
    const fakeOrientation = {
      isFront: true,
      status: 'validated',
      authorized: true,
      evaluatorId: 'unrecognized_fake_evaluator',
    };
    const res = evaluateViewPoseSemantics(pkg, {
      view: 'front',
      authoritativePhysicalOrientationResult: fakeOrientation,
    });
    // Must reject fake evaluator and remain status: 'partial', authorized: false
    assert.equal(res.status, VIEW_POSE_STATUS.PARTIAL);
    assert.equal(res.authorized, false);
    assert.equal(res.dimensions.physicalOrientationAuthorized, false);
    assert.equal(res.checks.physical_orientation_certification.status, 'fail');
  });

  it('promotes to status validated and authorized true ONLY when an authoritative physical orientation evaluator is registered and passes', () => {
    const testEvalId = 'test-authoritative-orientation-evaluator-v0';
    _registerTestOrientationEvaluator(testEvalId);

    const pkg = createMockFrontViewPackage();
    const validOrientation = {
      contract: 'view-pose-orientation-v0',
      evaluatorId: testEvalId,
      status: 'validated',
      authorized: true,
      targetView: 'front',
    };

    const res = evaluateViewPoseSemantics(pkg, {
      view: 'front',
      authoritativePhysicalOrientationResult: validOrientation,
    });

    assert.equal(res.status, VIEW_POSE_STATUS.VALIDATED);
    assert.equal(res.authorized, true);
    assert.equal(res.dimensions.declaredViewConsistent, true);
    assert.equal(res.dimensions.structuralPoseValidated, true);
    assert.equal(res.dimensions.physicalOrientationAuthorized, true);
    assert.equal(res.checks.physical_orientation_certification.status, 'pass');
    assert.equal(res.evaluatorId, testEvalId);
  });

  it('evaluateViewPoseSemanticsReport evaluates both Front and Side views', () => {
    const mockPackage = {
      version: 'body-evidence-package-v0',
      front: createMockFrontViewPackage(),
      side: createMockSideViewPackage(),
      rawSources: {
        aposeResult: { stage: 'Apose' },
        alignResult: { stage: 'Align' },
      },
    };

    const report = evaluateViewPoseSemanticsReport(mockPackage);
    assert.ok(report);
    assert.equal(report.contract, 'view-pose-semantics-report-v0');
    assert.equal(report.allAuthorized, false);
    assert.equal(report.summary.totalViews, 2);
    assert.equal(report.summary.partialCount, 2);
    assert.equal(report.views.front.status, 'partial');
    assert.equal(report.views.side.status, 'partial');
  });

  it('integrates with bodyEvidence.js runtime state and physicalMeasurementEligibility', () => {
    const mockPackage = {
      version: 'body-evidence-package-v0',
      front: createMockFrontViewPackage(),
      side: createMockSideViewPackage(),
      rawSources: {
        aposeResult: { stage: 'Apose' },
        alignResult: { stage: 'Align' },
      },
    };

    setBodyEvidencePackage(mockPackage);

    const frontRes = getViewPoseSemantics({ view: 'front' });
    assert.ok(frontRes);
    assert.equal(frontRes.status, 'partial');
    assert.equal(frontRes.authorized, false);

    const report = getViewPoseSemanticsReport();
    assert.ok(report);
    assert.equal(report.summary.partialCount, 2);
  });
});

describe('Real Unified Body Pipeline Archive Integration (output.zip)', () => {
  const zipPath = 'C:\\Users\\VIP\\Downloads\\output.zip';

  it('evaluates real Body Pipeline archive: Front and Side are status partial, authorized false, 4.5D blockers intact', async () => {
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

    // 1. View / Pose Semantics Evaluation on Real Package
    const frontPoseSemantics = getViewPoseSemantics({ view: 'front' });
    assert.ok(frontPoseSemantics, 'Front pose semantics must be evaluated');
    assert.equal(frontPoseSemantics.status, 'partial', 'Real Front view must evaluate to status: partial');
    assert.equal(frontPoseSemantics.authorized, false, 'Real Front view must be authorized: false');
    assert.equal(frontPoseSemantics.dimensions.declaredViewConsistent, true, 'Real Front view category is consistent');
    assert.equal(frontPoseSemantics.dimensions.structuralPoseValidated, true, 'Real Front structural pose is validated');
    assert.equal(frontPoseSemantics.dimensions.physicalOrientationAuthorized, false, 'Real Front physical orientation is missing');

    const sidePoseSemantics = getViewPoseSemantics({ view: 'side' });
    assert.ok(sidePoseSemantics, 'Side pose semantics must be evaluated');
    assert.equal(sidePoseSemantics.status, 'partial', 'Real Side view must evaluate to status: partial');
    assert.equal(sidePoseSemantics.authorized, false, 'Real Side view must be authorized: false');
    assert.equal(sidePoseSemantics.dimensions.declaredViewConsistent, true, 'Real Side view category is consistent');
    assert.equal(sidePoseSemantics.dimensions.structuralPoseValidated, true, 'Real Side structural pose is validated');
    assert.equal(sidePoseSemantics.dimensions.physicalOrientationAuthorized, false, 'Real Side physical orientation is missing');

    // 2. 4.5D Physical Measurement Eligibility on Real Package
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

    const eligibilityReport = getPhysicalMeasurementEligibilityReport({ annotations });
    assert.ok(eligibilityReport, 'Eligibility report must be generated');
    assert.equal(eligibilityReport.summary.total, 4);
    assert.equal(eligibilityReport.summary.blockedByClothingCount, 4);
    assert.equal(eligibilityReport.summary.eligibleCount, 0);

    for (const res of eligibilityReport.results) {
      assert.equal(res.status, 'blocked_by_clothing');
      assert.equal(res.physicalEligibility, false);
      assert.equal(res.physicalMeasurementCm, null);
      assert.ok(typeof res.metricProjectedSpanCm === 'number' && res.metricProjectedSpanCm > 0);

      // Verify all 3 physical blockers remain active
      assert.ok(res.blockers.includes('clothing_authorization_missing'), 'clothing_authorization_missing blocker must be active');
      assert.ok(res.blockers.includes('view_pose_semantics_missing'), 'view_pose_semantics_missing blocker must be active');
      assert.ok(res.blockers.includes('authoritative_physical_evidence_missing'), 'authoritative_physical_evidence_missing blocker must be active');
    }
  });
});

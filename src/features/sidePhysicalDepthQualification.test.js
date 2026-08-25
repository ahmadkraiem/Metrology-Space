import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIDE_PHYSICAL_DEPTH_CONTRACT,
  SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
  SIDE_PHYSICAL_DEPTH_STATUS,
  SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0,
  evaluateSidePhysicalDepthQualification,
} from './sidePhysicalDepthQualification.js';

describe('sidePhysicalDepthQualification v0', () => {
  // Helper to build a valid mock Side profile span observation
  function createMockSideProfileSpan({
    id = 'torso_profile_span_at_shoulder_level',
    sourceLevel = 'shoulder',
    valueCm = 24.5,
    minUcm = 88.0,
    maxUcm = 112.5,
    status = 'valid',
    supportPolicyId = 'trunk_core_support_v0',
    usedClothingEvidence = true,
    actualClassIdsUsed = [22, 23],
  } = {}) {
    return {
      contract: 'side-profile-span-v0',
      version: 'side-profile-span-v0',
      id,
      name: 'Torso Profile Span at Shoulder Level',
      view: 'side',
      sourceLevel,
      status,
      valueCm,
      minUcm,
      maxUcm,
      provenance: {
        sourceLevel,
        levelYcm: sourceLevel === 'shoulder' ? 140.0 : 95.0,
        sampledPixelRow: 300,
        supportPolicyId,
        actualClassIdsUsed,
        usedClothingEvidence,
      },
    };
  }

  // Helper to build a valid metric calibration result
  function createMockMetricCalibration({ status = 'validated', metricProjectedEligibility = true } = {}) {
    return {
      contract: 'metric-calibration-provenance-v0',
      status,
      metricProjectedEligibility,
      summary: { scaleCmPerPx: 0.2 },
    };
  }

  // Helper to build a valid side T-pose qualification result
  function createMockSidePoseQualification({ status = 'qualified', qualified = true, issues = [] } = {}) {
    return {
      contract: 'side-t-pose-qualification-v0',
      status,
      qualified,
      summary: { dominantArm: 'left', armCount: 1 },
      issues,
      warnings: [],
    };
  }

  // Helper to build a valid lateral orientation result
  function createMockSideViewOrientationQualification({ status = 'qualified', qualified = true, issues = [] } = {}) {
    return {
      contract: 'side-view-orientation-qualification-v0',
      status,
      qualified,
      orientationSemantics: qualified ? 'approximately_lateral' : 'unqualified',
      summary: { aggregateCollapseRatio: 0.08, usablePairsCount: 4, passedPairsCount: 4 },
      issues,
      warnings: [],
    };
  }

  it('13. Fully qualified Shoulder depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan({
      id: 'torso_profile_span_at_shoulder_level',
      sourceLevel: 'shoulder',
      valueCm: 25.4,
    });
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.contract, SIDE_PHYSICAL_DEPTH_CONTRACT);
    assert.equal(result.version, SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION);
    assert.equal(result.id, 'torso_ap_depth_at_shoulder_level');
    assert.equal(result.sourceLevel, 'shoulder');
    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
    assert.equal(result.qualificationTier, 'physical_ap_depth_estimate');
    assert.equal(result.qualifiedDepthEstimateCm, 25.4);
    assert.equal(result.projectedSpanCm, 25.4);
    assert.ok(result.checks.every((c) => c.status === 'pass'));
  });

  it('14. Fully qualified Hip depth estimate at current anchor level', () => {
    const sourceSpan = createMockSideProfileSpan({
      id: 'torso_profile_span_at_hip_level',
      sourceLevel: 'hip',
      valueCm: 28.2,
      supportPolicyId: 'pelvic_core_support_v0',
      actualClassIdsUsed: [12, 13, 21, 22],
    });
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.id, 'torso_ap_depth_at_hip_level');
    assert.equal(result.sourceLevel, 'hip');
    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, 28.2);
    assert.ok(result.provenance.anchorLevelSemantics.includes('bilateral mean hip landmark level'));
  });

  it('15. Invalid source Side Profile Span produces unavailable/disqualified with null estimate', () => {
    const invalidSpan = createMockSideProfileSpan({
      status: 'invalid',
      valueCm: null,
    });
    const result = evaluateSidePhysicalDepthQualification(invalidSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.equal(result.qualificationTier, 'unqualified');
  });

  it('16. Ambiguous source slice produces disqualified with null estimate', () => {
    const ambiguousSpan = createMockSideProfileSpan({
      status: 'ambiguous',
      valueCm: null,
    });
    const result = evaluateSidePhysicalDepthQualification(ambiguousSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.equal(result.qualificationTier, 'unqualified');
  });

  it('17. Missing or unvalidated metric calibration disqualifies depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan();
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration({ status: 'unvalidated', metricProjectedEligibility: false }),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('calibration')));
  });

  it('18. Side T-pose failure disqualifies depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan();
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification({ status: 'disqualified', qualified: false, issues: ['Arms lowered'] }),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('t-pose')));
  });

  it('19. Lateral-view orientation failure disqualifies depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan();
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification({ status: 'disqualified', qualified: false, issues: ['Uncollapsed'] }),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('lateral')));
  });

  it('20. Clothing/body-surface authorization failure (disqualified garment fit) disqualifies depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan();
    const mockClothing = {
      dimensions: {
        garmentFit: { status: 'disqualified' },
      },
    };
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
      clothingSemantics: mockClothing,
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.ok(result.issues.some((iss) => iss.toLowerCase().includes('clothing')));
  });

  it('21 & 22. Numeric preservation: qualifiedDepthEstimateCm === sourceSpan.valueCm only when qualified, null otherwise', () => {
    const sourceSpan = createMockSideProfileSpan({ valueCm: 22.75 });
    const qualResult = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });
    assert.equal(qualResult.status, SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
    assert.equal(qualResult.qualifiedDepthEstimateCm, 22.75);

    // Any failure forces null
    const failResult = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: null,
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });
    assert.notEqual(failResult.status, SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
    assert.equal(failResult.qualifiedDepthEstimateCm, null);
  });

  it('23. Strict Guardrail: No U -> Z or canonical Z coordinate field in output record', () => {
    const sourceSpan = createMockSideProfileSpan();
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.z, undefined);
    assert.equal(result.canonicalZ, undefined);
    assert.equal(result.zCm, undefined);
    assert.equal(result.coordinateZ, undefined);
  });

  it('24. Strict Guardrail: No Sapiens pointmap Z dependency in 4.5H evaluation', () => {
    const sourceSpan = createMockSideProfileSpan();
    // Pass strictly 2D/metric provenance without any pointmap
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
    assert.equal(result.provenance.pointmapZ, undefined);
  });

  it('25 & 26. Hip measurement remains tied to hip-landmark Y and is NOT labeled maximum seat/buttock depth', () => {
    const sourceSpan = createMockSideProfileSpan({
      id: 'torso_profile_span_at_hip_level',
      sourceLevel: 'hip',
      valueCm: 29.0,
      supportPolicyId: 'pelvic_core_support_v0',
      actualClassIdsUsed: [12, 13, 21, 22],
    });
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.sourceLevel, 'hip');
    assert.equal(result.name, 'Torso AP Depth Estimate at Hip Level');
    assert.ok(!result.name.toLowerCase().includes('maximum seat'));
    assert.ok(!result.name.toLowerCase().includes('buttock'));
    assert.ok(result.provenance.anchorLevelSemantics.includes('NOT maximum buttock depth, seat plane, or widest pelvic row'));
  });

  it('27. Unsupported definition ID is rejected cleanly', () => {
    const sourceSpan = createMockSideProfileSpan({ id: 'chest_profile_span' });
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      definition: 'chest_profile_span',
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: createMockSidePoseQualification(),
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.ok(result.issues.some((iss) => iss.includes('not a recognized Side physical depth qualification target')));
  });

  it('28. Existing Side Profile Span definitions and registry remain intact', () => {
    const defKeys = Object.keys(SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0);
    assert.deepEqual(defKeys, [
      'torso_profile_span_at_shoulder_level',
      'torso_profile_span_at_hip_level',
    ]);
  });

  it('29. bodyEvidence.js getters handle unanalyzed state cleanly', async () => {
    const {
      getSidePoseQualification,
      getSideViewOrientationQualification,
      getSidePhysicalDepthQualification,
      getSidePhysicalDepthQualifications,
    } = await import('./bodyEvidence.js');

    assert.equal(getSidePoseQualification(), null);
    assert.equal(getSideViewOrientationQualification(), null);
    assert.equal(getSidePhysicalDepthQualification({ id: 'invalid_definition' }), null);

    const shoulderRes = getSidePhysicalDepthQualification({ id: 'torso_ap_depth_at_shoulder_level' });
    assert.equal(shoulderRes.status, SIDE_PHYSICAL_DEPTH_STATUS.UNAVAILABLE);
    assert.equal(shoulderRes.qualifiedDepthEstimateCm, null);

    assert.equal(getSidePhysicalDepthQualifications(), null);
  });

  it('30. Moderate projected elbow deviation (30-45°, e.g. 44.2°) does NOT block Side AP depth qualification', () => {
    const sourceSpan = createMockSideProfileSpan({
      id: 'torso_profile_span_at_shoulder_level',
      sourceLevel: 'shoulder',
      valueCm: 25.4,
    });
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: {
        contract: 'side-t-pose-qualification-v0',
        status: 'warning',
        qualified: false,
        summary: { dominantArm: 'left', armCount: 1 },
        issues: [],
        warnings: ['left projected elbow deviation: 44.2°'],
      },
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.QUALIFIED);
    assert.equal(result.qualificationTier, 'physical_ap_depth_estimate');
    assert.equal(result.qualifiedDepthEstimateCm, 25.4);
    assert.ok(result.checks.some((c) => c.id === 'side_t_pose_qualification' && c.status === 'pass'));
  });

  it('31. Severe projected elbow deviation (> 45°) disqualifies Side AP depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan({
      id: 'torso_profile_span_at_shoulder_level',
      sourceLevel: 'shoulder',
      valueCm: 25.4,
    });
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: {
        contract: 'side-t-pose-qualification-v0',
        status: 'disqualified',
        qualified: false,
        summary: { dominantArm: 'left', armCount: 1 },
        issues: ['left projected elbow deviation is severe (52.0°).'],
        warnings: [],
      },
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
    assert.ok(result.issues.some((iss) => iss.includes('T-pose qualification')));
  });

  it('32. Poor horizontal arm extension (< 0.70) disqualifies Side AP depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan();
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: {
        contract: 'side-t-pose-qualification-v0',
        status: 'disqualified',
        qualified: false,
        summary: { dominantArm: 'left', armCount: 1 },
        issues: ['left arm is not extended horizontally away from torso.'],
        warnings: [],
      },
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
  });

  it('33. Lowered arm (> 35°) disqualifies Side AP depth estimate', () => {
    const sourceSpan = createMockSideProfileSpan();
    const result = evaluateSidePhysicalDepthQualification(sourceSpan, {
      metricCalibrationProvenance: createMockMetricCalibration(),
      sidePoseQualification: {
        contract: 'side-t-pose-qualification-v0',
        status: 'disqualified',
        qualified: false,
        summary: { dominantArm: 'left', armCount: 1 },
        issues: ['left arm is significantly lowered or raised (42.0°).'],
        warnings: [],
      },
      sideViewOrientationQualification: createMockSideViewOrientationQualification(),
    });

    assert.equal(result.status, SIDE_PHYSICAL_DEPTH_STATUS.DISQUALIFIED);
    assert.equal(result.qualifiedDepthEstimateCm, null);
  });

  it('34. getSideViewOrientationQualification does not shadow package front pose when empty annotations array is passed', async () => {
    const { getSideViewOrientationQualification } = await import('./bodyEvidence.js');
    const result = getSideViewOrientationQualification({
      annotations: [],
      frontPoseSource: null,
      sidePoseSource: null,
    });
    // When no package is loaded and no pose source is passed, returns null
    assert.equal(result, null);
  });
});


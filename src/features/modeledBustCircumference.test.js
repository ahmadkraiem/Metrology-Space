import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELED_BUST_CIRCUMFERENCE_CONTRACT,
  MODELED_BUST_CIRCUMFERENCE_CONTRACT_VERSION,
  MODELED_BUST_CIRCUMFERENCE_STATUS,
  MODELED_BUST_CIRCUMFERENCE_BLOCKERS,
  MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID,
  MODELED_BUST_CIRCUMFERENCE_DISPLAY_NAME,
  evaluateModeledBustCircumference,
} from './modeledBustCircumference.js';
import {
  getModeledBustCircumference,
  getModeledBustCircumferenceReport,
} from './bodyEvidence.js';
import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

function createMockBustApexLocalization({
  status = 'ready',
  yCm = 123.85,
  frontWidthCm = 34.30,
  frontMinXcm = 82.85,
  frontMaxXcm = 117.15,
  sideQualifiedApDepthCm = 29.40,
  sideRawProfileSpanCm = 29.40,
  sideMinUcm = 80.40,
  sideMaxUcm = 109.80,
  isSideQualified = true,
  sideStatus = 'valid',
  contract = 'bust-apex-plane-localization-v0',
  frontRasterRow = 761,
  sideRasterRow = 761,
  sliceHighlightYcm = null,
  prominenceCm = 0.6676,
  rawAnteriorUcm = 80.40,
  smoothedAnteriorUcm = 80.38,
  baselineUcm = 81.05,
  frontEncounteredClassIds = [22, 23],
  sideEncounteredClassIds = [22, 23],
  supportPolicyId = 'trunk_core_support_v0',
  targetClassIds = [22, 23],
  frontRunCount = 1,
  isSingleSupportedRun = true,
  frontStatus = 'valid',
} = {}) {
  const selectedPeak = {
    yCm,
    rasterRow: frontRasterRow,
    sideRasterRow,
    frontWidthCm,
    frontMinXcm,
    frontMaxXcm,
    sideRawProfileSpanCm,
    sideQualifiedApDepthCm,
    sideMinUcm,
    sideMaxUcm,
    prominenceCm,
    rawAnteriorUcm,
    smoothedAnteriorUcm,
    baselineUcm,
    isSideDepthQualified: isSideQualified,
    broadnessScore: 55,
    encounteredFrontClassIds: [...frontEncounteredClassIds],
    encounteredSideClassIds: [...sideEncounteredClassIds],
  };

  return {
    contract,
    version: 'bust-apex-plane-localization-v0',
    status,
    yCm,
    rasterRow: frontRasterRow,
    sideRasterRow,
    selectionMethod: 'anterior_contour_prominence_baseline_v0',
    selectedPeak: status === 'ready' ? selectedPeak : null,
    frontEvidence: {
      status: frontStatus,
      widthCm: frontWidthCm,
      minXcm: frontMinXcm,
      maxXcm: frontMaxXcm,
      runCount: frontRunCount,
      isSingleSupportedRun,
      encounteredClassIds: [...frontEncounteredClassIds],
      rasterRow: frontRasterRow,
    },
    sideEvidence: isSideQualified ? {
      status: sideStatus,
      profileSpanCm: sideRawProfileSpanCm,
      qualifiedApDepthCm: sideQualifiedApDepthCm,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      rawAnteriorUcm,
      smoothedAnteriorUcm,
      baselineUcm,
      prominenceCm,
      isQualified: true,
      depthQualificationStatus: 'qualified',
      encounteredClassIds: [...sideEncounteredClassIds],
      rasterRow: sideRasterRow,
    } : (sideStatus === 'unavailable' ? {
      status: 'unavailable',
      profileSpanCm: null,
      qualifiedApDepthCm: null,
      minUcm: null,
      maxUcm: null,
      rawAnteriorUcm: null,
      smoothedAnteriorUcm: null,
      baselineUcm: null,
      prominenceCm: null,
      isQualified: false,
      depthQualificationStatus: 'unavailable',
      encounteredClassIds: [],
      rasterRow: sideRasterRow,
    } : {
      status: sideStatus,
      profileSpanCm: sideRawProfileSpanCm,
      qualifiedApDepthCm: null,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      rawAnteriorUcm,
      smoothedAnteriorUcm,
      baselineUcm,
      prominenceCm,
      isQualified: false,
      depthQualificationStatus: 'unqualified',
      encounteredClassIds: [...sideEncounteredClassIds],
      rasterRow: sideRasterRow,
    }),
    provenance: {
      shoulderYcm: 140.00,
      offsetBelowShoulderCm: 16.15,
      naturalWaistSuperiorCrestYcm: 114.00,
      elevationAboveWaistCrestCm: 9.85,
      smoothingWindowCm: 2.0,
      smoothingRadiusSamples: 2,
      sampleSpacingCm: 0.5,
      minApexProminenceCm: 0.30,
      maxPeakMergeDistanceCm: 5.0,
      maxInterPeakSaddleDropCm: 0.40,
      supportPolicyId,
      targetClassIds: [...targetClassIds],
      sourceScanContract: 'torso-arbitrary-y-evidence-scan-v0',
      sourceScanStatus: 'completed',
      sliceHighlightCoordinates: {
        yCm: sliceHighlightYcm ?? yCm,
        frontRasterRow,
        sideRasterRow,
        frontBoundsCm: { minX: frontMinXcm, maxX: frontMaxXcm },
        sideBoundsCm: { minU: sideMinUcm, maxU: sideMaxUcm },
      },
    },
    blockers: status === 'ready' ? [] : ['localization_failed'],
    warnings: [],
    issues: [],
  };
}

describe('modeledBustCircumference domain contract v0', () => {
  it('1. contract constants and taxonomy definitions conform to specification', () => {
    assert.equal(MODELED_BUST_CIRCUMFERENCE_CONTRACT, 'modeled-bust-circumference-v0');
    assert.equal(MODELED_BUST_CIRCUMFERENCE_CONTRACT_VERSION, 'modeled-bust-circumference-v0');
    assert.equal(MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID, 'torso_modeled_bust_circumference_at_bust_apex_plane');
    assert.equal(MODELED_BUST_CIRCUMFERENCE_DISPLAY_NAME, 'Modeled Bust Circumference');
    assert.deepEqual(Object.keys(MODELED_BUST_CIRCUMFERENCE_STATUS).sort(), ['BLOCKED', 'INVALID', 'MODELED', 'UNAVAILABLE']);
  });

  it('2. evaluates valid ready Bust Apex + qualified depth to modeled status with exact Ramanujan II result', () => {
    const locReport = createMockBustApexLocalization({
      yCm: 123.85,
      frontWidthCm: 34.30,
      sideQualifiedApDepthCm: 29.40,
    });

    const result = evaluateModeledBustCircumference(locReport);

    assert.equal(result.contract, MODELED_BUST_CIRCUMFERENCE_CONTRACT);
    assert.equal(result.version, MODELED_BUST_CIRCUMFERENCE_CONTRACT_VERSION);
    assert.equal(result.id, MODELED_BUST_CIRCUMFERENCE_DEFINITION_ID);
    assert.equal(result.name, MODELED_BUST_CIRCUMFERENCE_DISPLAY_NAME);
    assert.equal(result.status, MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.isModeled, true);
    assert.equal(result.isQualified, true);

    const expectedRamanujan = computeRamanujanEllipsePerimeter(34.30, 29.40);
    assert.ok(expectedRamanujan);
    assert.equal(result.valueCm, Number(expectedRamanujan.perimeterCm.toFixed(4)));
    assert.equal(result.valueCm, 100.2078);

    // Preserves correct selected Y, Front width, Side qualified AP depth
    assert.equal(result.yCm, 123.85);
    assert.equal(result.levelYcm, 123.85);
    assert.equal(result.model.transverseWidthCm, 34.30);
    assert.equal(result.model.frontDiameterCm, 34.30);
    assert.equal(result.model.apDepthCm, 29.40);
    assert.equal(result.model.sideDiameterCm, 29.40);

    // Semi-major/minor axes and hParameter
    assert.equal(result.model.semiMajorAxisCm, 17.15);
    assert.equal(result.model.semiMinorAxisCm, 14.70);
    assert.equal(result.model.hParameter, Number(expectedRamanujan.hParameter.toFixed(6)));
    assert.equal(result.model.implementation, 'ellipse_ramanujan_ii');
    assert.equal(result.model.family, 'ellipse');
  });

  it('3. verifies circle degeneracy: W = D produces exact 2*pi*r', () => {
    const locCircle = createMockBustApexLocalization({
      frontWidthCm: 30.0,
      sideQualifiedApDepthCm: 30.0,
    });
    const result = evaluateModeledBustCircumference(locCircle);

    const expectedCircle = Number((Math.PI * 30.0).toFixed(4));
    assert.equal(result.status, MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.valueCm, expectedCircle);
    assert.equal(result.model.hParameter, 0);
  });

  it('4. verifies width/depth symmetry: W x D produces identical perimeter as D x W', () => {
    const resA = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontWidthCm: 34.30,
      sideQualifiedApDepthCm: 29.40,
    }));
    const resB = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontWidthCm: 29.40,
      sideQualifiedApDepthCm: 34.30,
      frontMinXcm: 80.0,
      frontMaxXcm: 109.40,
      sideMinUcm: 80.0,
      sideMaxUcm: 114.30,
    }));

    assert.equal(resA.status, MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(resB.status, MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(resA.valueCm, resB.valueCm);
    assert.equal(resA.model.semiMajorAxisCm, resB.model.semiMajorAxisCm);
    assert.equal(resA.model.semiMinorAxisCm, resB.model.semiMinorAxisCm);
    assert.equal(resA.model.hParameter, resB.model.hParameter);
  });

  it('5. preserves actual calibrated endpoints, not synthetic centered coordinates', () => {
    const locReport = createMockBustApexLocalization({
      frontMinXcm: 82.85,
      frontMaxXcm: 117.15,
      sideMinUcm: 80.40,
      sideMaxUcm: 109.80,
    });
    const result = evaluateModeledBustCircumference(locReport);

    assert.equal(result.crossSectionEvidence.front.minXcm, 82.85);
    assert.equal(result.crossSectionEvidence.front.maxXcm, 117.15);
    assert.equal(result.crossSectionEvidence.side.minUcm, 80.40);
    assert.equal(result.crossSectionEvidence.side.maxUcm, 109.80);
    assert.equal(result.provenance.frontMinXcm, 82.85);
    assert.equal(result.provenance.frontMaxXcm, 117.15);
    assert.equal(result.provenance.sideMinUcm, 80.40);
    assert.equal(result.provenance.sideMaxUcm, 109.80);
  });

  it('6. returns unavailable when Bust Apex report is missing, null, or unavailable', () => {
    const resNull = evaluateModeledBustCircumference(null);
    assert.equal(resNull.status, MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resNull.valueCm, null);
    assert.ok(resNull.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE));

    const resUnavail = evaluateModeledBustCircumference(createMockBustApexLocalization({
      status: 'unavailable',
    }));
    assert.equal(resUnavail.status, MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resUnavail.valueCm, null);
    assert.ok(resUnavail.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE));
  });

  it('7. returns unavailable with BUST_APEX_PLANE_AMBIGUOUS when Bust localization is ambiguous', () => {
    const resAmbiguous = evaluateModeledBustCircumference(createMockBustApexLocalization({
      status: 'ambiguous',
    }));
    assert.equal(resAmbiguous.status, MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resAmbiguous.valueCm, null);
    assert.ok(resAmbiguous.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_AMBIGUOUS));
  });

  it('8. returns invalid when Bust localization status is invalid', () => {
    const resInvalid = evaluateModeledBustCircumference(createMockBustApexLocalization({
      status: 'invalid',
    }));
    assert.equal(resInvalid.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.equal(resInvalid.valueCm, null);
    assert.ok(resInvalid.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.BUST_APEX_PLANE_UNAVAILABLE));
  });

  it('9. rejects missing, zero, negative, non-finite, or inverted Front width bounds as invalid', () => {
    const resNullFront = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontWidthCm: null,
    }));
    assert.equal(resNullFront.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNullFront.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resZeroFront = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontWidthCm: 0,
    }));
    assert.equal(resZeroFront.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resZeroFront.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resNegFront = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontWidthCm: -10,
    }));
    assert.equal(resNegFront.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNegFront.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resNaNFront = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontWidthCm: NaN,
    }));
    assert.equal(resNaNFront.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNaNFront.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resInvertedBounds = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontMinXcm: 120.0,
      frontMaxXcm: 80.0,
    }));
    assert.equal(resInvertedBounds.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resInvertedBounds.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));
  });

  it('10. rejects multi-run Front evidence with FRONT_WIDTH_INVALID', () => {
    const resMultiRun = evaluateModeledBustCircumference(createMockBustApexLocalization({
      frontRunCount: 2,
      isSingleSupportedRun: false,
    }));
    assert.equal(resMultiRun.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resMultiRun.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));
  });

  it('11. distinguishes missing depth (unavailable), non-positive/malformed depth (invalid), and unqualified depth (blocked)', () => {
    // Missing depth -> unavailable
    const resMissingSide = evaluateModeledBustCircumference(createMockBustApexLocalization({
      sideStatus: 'unavailable',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: null,
      isSideQualified: false,
    }));
    assert.equal(resMissingSide.status, MODELED_BUST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.ok(resMissingSide.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE));

    // Negative depth -> invalid
    const resNegDepth = evaluateModeledBustCircumference(createMockBustApexLocalization({
      sideQualifiedApDepthCm: -5.0,
      isSideQualified: true,
    }));
    assert.equal(resNegDepth.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNegDepth.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID));

    // Non-finite depth -> invalid
    const resNaNDepth = evaluateModeledBustCircumference(createMockBustApexLocalization({
      sideQualifiedApDepthCm: Infinity,
      isSideQualified: true,
    }));
    assert.equal(resNaNDepth.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNaNDepth.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID));

    // Inverted Side bounds -> invalid
    const resInvertedSide = evaluateModeledBustCircumference(createMockBustApexLocalization({
      sideMinUcm: 110.0,
      sideMaxUcm: 80.0,
      isSideQualified: true,
    }));
    assert.equal(resInvertedSide.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resInvertedSide.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID));

    // Unqualified depth (present raw profile span, but isSideQualified = false) -> blocked
    const resUnqualifiedSide = evaluateModeledBustCircumference(createMockBustApexLocalization({
      sideStatus: 'unqualified',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: 29.40,
      isSideQualified: false,
    }));
    assert.equal(resUnqualifiedSide.status, MODELED_BUST_CIRCUMFERENCE_STATUS.BLOCKED);
    assert.ok(resUnqualifiedSide.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED));
  });

  it('12. strictly prevents raw profileSpanCm from substituting for unqualified AP depth', () => {
    const rawSpanOnly = createMockBustApexLocalization({
      sideStatus: 'unqualified',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: 32.0,
      isSideQualified: false,
    });
    const resRawSpan = evaluateModeledBustCircumference(rawSpanOnly);
    assert.equal(resRawSpan.valueCm, null);
    assert.equal(resRawSpan.isModeled, false);
    assert.equal(resRawSpan.status, MODELED_BUST_CIRCUMFERENCE_STATUS.BLOCKED);
    assert.ok(resRawSpan.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED));
  });

  it('13. returns invalid when localization structural contract is incompatible', () => {
    const resBadContract = evaluateModeledBustCircumference(createMockBustApexLocalization({
      contract: 'natural-waist-plane-localization-v0',
    }));
    assert.equal(resBadContract.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resBadContract.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID));
  });

  it('14. protects against same-Y highlight coordinate mismatch', () => {
    const resMismatch = evaluateModeledBustCircumference(createMockBustApexLocalization({
      yCm: 123.85,
      sliceHighlightYcm: 130.00,
    }));
    assert.equal(resMismatch.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resMismatch.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH));
  });

  it('15. detects duplicate field disagreement between frontEvidence and selectedPeak', () => {
    const mock = createMockBustApexLocalization({
      frontWidthCm: 34.30,
    });
    mock.selectedPeak.frontWidthCm = 36.50; // Material disagreement

    const res = evaluateModeledBustCircumference(mock);
    assert.equal(res.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(res.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID));
  });

  it('16. detects duplicate field disagreement between sideEvidence and selectedPeak', () => {
    const mock = createMockBustApexLocalization({
      sideQualifiedApDepthCm: 29.40,
    });
    mock.selectedPeak.qualifiedApDepthCm = 31.00; // Material disagreement

    const res = evaluateModeledBustCircumference(mock);
    assert.equal(res.status, MODELED_BUST_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(res.blockers.includes(MODELED_BUST_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID));
  });

  it('17. preserves independent Front and Side raster rows sharing common canonical Y', () => {
    const locDiffRows = createMockBustApexLocalization({
      yCm: 123.85,
      frontRasterRow: 761,
      sideRasterRow: 765,
    });

    const result = evaluateModeledBustCircumference(locDiffRows);
    assert.equal(result.status, MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.yCm, 123.85);
    assert.equal(result.provenance.selectedYcm, 123.85);
    assert.equal(result.provenance.frontRasterRow, 761);
    assert.equal(result.provenance.sideRasterRow, 765);
    assert.equal(result.sourcePlane.rasterRow, 761);
    assert.equal(result.sourcePlane.sideRasterRow, 765);
  });

  it('18. adheres to strict metrological semantics and modeled disclaimer', () => {
    const locReport = createMockBustApexLocalization();
    const result = evaluateModeledBustCircumference(locReport);

    assert.ok(result.semantics);
    assert.equal(result.semantics.isModeled, true);
    assert.equal(result.semantics.isModeledEstimate, true);
    assert.equal(result.semantics.isEstimatedCircumference, true);
    assert.equal(result.semantics.isMeasuredContour, false);
    assert.equal(result.semantics.isTapeMeasuredGroundTruth, false);
    assert.equal(result.semantics.is3dReconstruction, false);
    assert.equal(result.semantics.isBodyVolume, false);
    assert.equal(result.semantics.isValidatedAgainstGroundTruth, false);
    assert.ok(result.semantics.statement.includes('NOT tape-measured ground truth'));
    assert.ok(result.semantics.statement.includes('NOT measured body contour'));
    assert.ok(result.semantics.statement.includes('NOT 3D reconstruction'));
    assert.ok(result.semantics.statement.includes('NOT pointmap-derived'));
  });

  it('19. preserves support policy ID (trunk_core_support_v0) and target classes [22, 23]', () => {
    const locReport = createMockBustApexLocalization({
      supportPolicyId: 'trunk_core_support_v0',
      targetClassIds: [22, 23],
    });
    const result = evaluateModeledBustCircumference(locReport);

    assert.equal(result.crossSectionEvidence.contract, 'bust-cross-section-evidence-v0');
    assert.equal(result.crossSectionEvidence.version, 'bust-cross-section-evidence-v0');
    assert.equal(result.crossSectionEvidence.supportPolicyId, 'trunk_core_support_v0');
    assert.deepEqual(result.crossSectionEvidence.targetClassIds, [22, 23]);
    assert.equal(result.provenance.supportPolicyId, 'trunk_core_support_v0');
    assert.deepEqual(result.provenance.targetClassIds, [22, 23]);
  });

  it('20. does not mutate input localization report', () => {
    const locReport = createMockBustApexLocalization();
    const snapshot = JSON.stringify(locReport);

    evaluateModeledBustCircumference(locReport);

    assert.equal(JSON.stringify(locReport), snapshot);
  });

  it('21. produces deterministic repeated output', () => {
    const locReport = createMockBustApexLocalization();
    const res1 = evaluateModeledBustCircumference(locReport);
    const res2 = evaluateModeledBustCircumference(locReport);

    assert.deepEqual(res1, res2);
  });

  it('22. verifies bodyEvidence runtime getters getModeledBustCircumference and getModeledBustCircumferenceReport exist', () => {
    assert.equal(typeof getModeledBustCircumference, 'function');
    assert.equal(typeof getModeledBustCircumferenceReport, 'function');

    // When no evidence is loaded, returns null safely without throwing
    const res = getModeledBustCircumference();
    assert.equal(res, null);
    const resReport = getModeledBustCircumferenceReport();
    assert.equal(resReport, null);
  });

  it('23. consumes bust-point-plane-localization-v1 with selectedPlateau and computes Ramanujan perimeter', () => {
    const locReportV1 = {
      contract: 'bust-point-plane-localization-v1',
      version: 'bust-point-plane-localization-v1',
      id: 'bust_point_plane_localization',
      name: 'Bust Point Plane Localization',
      status: 'ready',
      yCm: 119.15,
      rasterRow: 808,
      sideRasterRow: 808,
      selectedPlateau: {
        plateauMinYcm: 118.15,
        plateauMaxYcm: 120.15,
        plateauYSpanCm: 2.0,
        midpointYcm: 119.15,
        representativeYcm: 119.15,
        memberCount: 21,
        maxRawAnteriorUcm: 78.30,
      },
      frontEvidence: {
        status: 'valid',
        minXcm: 82.40,
        maxXcm: 117.50,
        widthCm: 35.10,
        rasterRow: 808,
        isSingleSupportedRun: true,
        runCount: 1,
      },
      sideEvidence: {
        status: 'valid',
        minUcm: 78.30,
        maxUcm: 108.50,
        profileSpanCm: 30.20,
        qualifiedApDepthCm: 30.20,
        rasterRow: 808,
        rawAnteriorUcm: 78.30,
        rawPosteriorUcm: 108.50,
        isSingleSupportedRun: true,
        runCount: 1,
      },
      provenance: {
        shoulderYcm: 132.85,
        naturalWaistYcm: 107.15,
        totalCandidates: 200,
        searchCandidateCount: 120,
        supportPolicyId: 'trunk_core_support_v0',
        targetClassIds: [22, 23],
        sourceScanContract: 'torso-arbitrary-y-evidence-scan-v0',
      },
    };

    const result = evaluateModeledBustCircumference(locReportV1);

    assert.equal(result.status, MODELED_BUST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.yCm, 119.15);
    assert.equal(result.levelYcm, 119.15);
    assert.equal(result.model.transverseWidthCm, 35.10);
    assert.equal(result.model.apDepthCm, 30.20);
    assert.equal(result.sourcePlane.contract, 'bust-point-plane-localization-v1');

    const expectedRamanujan = computeRamanujanEllipsePerimeter(35.10, 30.20);
    assert.equal(result.valueCm, Number(expectedRamanujan.perimeterCm.toFixed(4)));
  });
});

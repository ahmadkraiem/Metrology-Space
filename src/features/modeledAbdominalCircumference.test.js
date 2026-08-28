import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT,
  MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT_VERSION,
  MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS,
  MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS,
  MODELED_ABDOMINAL_CIRCUMFERENCE_DEFINITION_ID,
  MODELED_ABDOMINAL_CIRCUMFERENCE_DISPLAY_NAME,
  evaluateModeledAbdominalCircumference,
} from './modeledAbdominalCircumference.js';
import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

function createMockAbdominalApexLocalization({
  status = 'ready',
  yCm = 95.75,
  frontWidthCm = 37.20,
  frontMinXcm = 81.20,
  frontMaxXcm = 118.40,
  sideQualifiedApDepthCm = 26.30,
  sideRawProfileSpanCm = 26.30,
  sideMinUcm = 81.60,
  sideMaxUcm = 107.90,
  isSideQualified = true,
  sideStatus = 'qualified',
  contract = 'abdominal-apex-plane-localization-v0',
  frontRasterRow = 840,
  sideRasterRow = 842,
  sliceHighlightYcm = null,
  prominenceCm = 1.62,
  rawAnteriorUcm = 107.90,
  smoothedAnteriorUcm = 107.85,
  baselineUcm = 106.23,
  frontEncounteredClassIds = [13, 22],
  sideEncounteredClassIds = [13, 22],
  supportPolicyId = 'trunk_pelvic_transition_support_v0',
  targetClassIds = [12, 13, 21, 22, 23],
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
    broadnessScore: 5,
    encounteredFrontClassIds: [...frontEncounteredClassIds],
    encounteredSideClassIds: [...sideEncounteredClassIds],
  };

  return {
    contract,
    version: 'abdominal-apex-plane-localization-v0',
    status,
    yCm,
    rasterRow: frontRasterRow,
    sideRasterRow,
    selectionMethod: 'anterior_contour_prominence_baseline_v0',
    selectedPeak: status === 'ready' ? selectedPeak : null,
    frontEvidence: {
      status: 'valid',
      widthCm: frontWidthCm,
      minXcm: frontMinXcm,
      maxXcm: frontMaxXcm,
      runCount: 1,
      encounteredClassIds: [...frontEncounteredClassIds],
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
    }),
    provenance: {
      upperYcm: 107.15,
      offsetBelowWaistCm: 11.40,
      lowerYcm: 85.45,
      elevationAboveHipCm: 10.30,
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

describe('modeledAbdominalCircumference domain contract v0', () => {
  it('1 & 2. evaluates valid ready apex + qualified depth to modeled status with exact Ramanujan II result', () => {
    const locReport = createMockAbdominalApexLocalization({
      yCm: 95.75,
      frontWidthCm: 37.20,
      sideQualifiedApDepthCm: 26.30,
    });

    const result = evaluateModeledAbdominalCircumference(locReport);

    assert.equal(result.contract, MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT);
    assert.equal(result.version, MODELED_ABDOMINAL_CIRCUMFERENCE_CONTRACT_VERSION);
    assert.equal(result.id, MODELED_ABDOMINAL_CIRCUMFERENCE_DEFINITION_ID);
    assert.equal(result.name, MODELED_ABDOMINAL_CIRCUMFERENCE_DISPLAY_NAME);
    assert.equal(result.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.isModeled, true);
    assert.equal(result.isQualified, true);

    const expectedRamanujan = computeRamanujanEllipsePerimeter(37.20, 26.30);
    assert.ok(expectedRamanujan);
    assert.equal(result.valueCm, Number(expectedRamanujan.perimeterCm.toFixed(4)));

    // 3, 4, 5. Preserves correct selected Y, Front width, Side qualified AP depth
    assert.equal(result.yCm, 95.75);
    assert.equal(result.levelYcm, 95.75);
    assert.equal(result.model.transverseWidthCm, 37.20);
    assert.equal(result.model.frontDiameterCm, 37.20);
    assert.equal(result.model.apDepthCm, 26.30);
    assert.equal(result.model.sideDiameterCm, 26.30);

    // 6 & 7. Semi-major/minor axes and hParameter
    assert.equal(result.model.semiMajorAxisCm, 18.60);
    assert.equal(result.model.semiMinorAxisCm, 13.15);
    assert.equal(result.model.hParameter, Number(expectedRamanujan.hParameter.toFixed(6)));
    assert.equal(result.model.implementation, 'ellipse_ramanujan_ii');
    assert.equal(result.model.family, 'ellipse');
  });

  it('8 & 9. returns unavailable when apex report is missing, null, or unavailable', () => {
    const resNull = evaluateModeledAbdominalCircumference(null);
    assert.equal(resNull.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resNull.valueCm, null);
    assert.ok(resNull.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE));

    const resUnavail = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      status: 'unavailable',
    }));
    assert.equal(resUnavail.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resUnavail.valueCm, null);
    assert.ok(resUnavail.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE));
  });

  it('10. returns blocked when apex localization is ambiguous', () => {
    const resAmbiguous = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      status: 'ambiguous',
    }));
    assert.equal(resAmbiguous.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.BLOCKED);
    assert.equal(resAmbiguous.valueCm, null);
    assert.ok(resAmbiguous.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_AMBIGUOUS));
  });

  it('11. returns invalid when apex localization is invalid', () => {
    const resInvalid = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      status: 'invalid',
    }));
    assert.equal(resInvalid.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.equal(resInvalid.valueCm, null);
    assert.ok(resInvalid.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.ABDOMINAL_APEX_PLANE_UNAVAILABLE));
  });

  it('12, 13 & 14. rejects missing, zero, negative, or inverted Front width bounds as invalid', () => {
    const resNullFront = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      frontWidthCm: null,
    }));
    assert.equal(resNullFront.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNullFront.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resZeroFront = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      frontWidthCm: 0,
    }));
    assert.equal(resZeroFront.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resZeroFront.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resNegFront = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      frontWidthCm: -10,
    }));
    assert.equal(resNegFront.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNegFront.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const resInvertedBounds = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      frontMinXcm: 120.0,
      frontMaxXcm: 80.0,
    }));
    assert.equal(resInvertedBounds.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resInvertedBounds.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));
  });

  it('15, 16 & 17. distinguishes missing depth (unavailable), non-positive/malformed depth (invalid), and unqualified depth (blocked)', () => {
    // Missing depth
    const resMissingSide = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      sideStatus: 'unavailable',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: null,
      isSideQualified: false,
    }));
    assert.equal(resMissingSide.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.ok(resMissingSide.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE));

    // Negative depth
    const resNegDepth = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      sideQualifiedApDepthCm: -5.0,
      isSideQualified: true,
    }));
    assert.equal(resNegDepth.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resNegDepth.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID));

    // Inverted Side bounds
    const resInvertedSide = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      sideMinUcm: 110.0,
      sideMaxUcm: 80.0,
      isSideQualified: true,
    }));
    assert.equal(resInvertedSide.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resInvertedSide.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID));

    // Unqualified depth (present raw profile span, but isSideQualified = false)
    const resUnqualifiedSide = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      sideStatus: 'unqualified',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: 26.30,
      isSideQualified: false,
    }));
    assert.equal(resUnqualifiedSide.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.BLOCKED);
    assert.ok(resUnqualifiedSide.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED));
  });

  it('18. returns invalid when localization structural contract is incompatible', () => {
    const resBadContract = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      contract: 'natural-waist-plane-localization-v0',
    }));
    assert.equal(resBadContract.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resBadContract.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.STRUCTURAL_CONTRACT_INVALID));
  });

  it('19. protects against same-Y highlight coordinate mismatch', () => {
    const resMismatch = evaluateModeledAbdominalCircumference(createMockAbdominalApexLocalization({
      yCm: 95.75,
      sliceHighlightYcm: 102.00,
    }));
    assert.equal(resMismatch.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.INVALID);
    assert.ok(resMismatch.blockers.includes(MODELED_ABDOMINAL_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH));
  });

  it('20. preserves independent Front and Side raster-row provenance sharing common canonical Y', () => {
    const locDiffRows = createMockAbdominalApexLocalization({
      yCm: 95.75,
      frontRasterRow: 840,
      sideRasterRow: 844,
    });

    const result = evaluateModeledAbdominalCircumference(locDiffRows);
    assert.equal(result.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.yCm, 95.75);
    assert.equal(result.provenance.selectedYcm, 95.75);
    assert.equal(result.provenance.frontRasterRow, 840);
    assert.equal(result.provenance.sideRasterRow, 844);
    assert.equal(result.sourcePlane.rasterRow, 840);
    assert.equal(result.sourcePlane.sideRasterRow, 844);
  });

  it('21 & 22. strictly prevents Front-only fallback or raw Side-span fallback when qualified depth is absent', () => {
    // Front-only candidate with missing side
    const frontOnly = createMockAbdominalApexLocalization({
      sideStatus: 'unavailable',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: null,
      isSideQualified: false,
    });
    const resFrontOnly = evaluateModeledAbdominalCircumference(frontOnly);
    assert.equal(resFrontOnly.valueCm, null);
    assert.equal(resFrontOnly.isModeled, false);
    assert.notEqual(resFrontOnly.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED);

    // Raw side profile span present but unqualified
    const rawSpanOnly = createMockAbdominalApexLocalization({
      sideStatus: 'unqualified',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: 28.0,
      isSideQualified: false,
    });
    const resRawSpan = evaluateModeledAbdominalCircumference(rawSpanOnly);
    assert.equal(resRawSpan.valueCm, null);
    assert.equal(resRawSpan.isModeled, false);
    assert.notEqual(resRawSpan.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED);
  });

  it('23, 24, 25 & 26. adheres to strict metrological semantics, disclaimer, and absence of 3D/pointmap/normals dependencies', () => {
    const locReport = createMockAbdominalApexLocalization();
    const result = evaluateModeledAbdominalCircumference(locReport);

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

  it('27. mirrored-orientation equivalence: depends only on positive physical scalar dimensions', () => {
    // Facing positive U vs negative U both yield identical Ramanujan modeled circumference given same positive width and depth
    const posFacing = createMockAbdominalApexLocalization({
      frontWidthCm: 37.20,
      sideQualifiedApDepthCm: 26.30,
      sideMinUcm: 81.60,
      sideMaxUcm: 107.90,
    });
    const negFacing = createMockAbdominalApexLocalization({
      frontWidthCm: 37.20,
      sideQualifiedApDepthCm: 26.30,
      sideMinUcm: 92.10,
      sideMaxUcm: 118.40,
    });

    const resPos = evaluateModeledAbdominalCircumference(posFacing);
    const resNeg = evaluateModeledAbdominalCircumference(negFacing);

    assert.equal(resPos.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(resNeg.status, MODELED_ABDOMINAL_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(resPos.valueCm, resNeg.valueCm);
    assert.equal(resPos.model.hParameter, resNeg.model.hParameter);
  });

  it('28. preserves transition support policy ID (trunk_pelvic_transition_support_v0) and target classes in crossSectionEvidence and provenance', () => {
    const locReport = createMockAbdominalApexLocalization({
      supportPolicyId: 'trunk_pelvic_transition_support_v0',
      targetClassIds: [12, 13, 21, 22, 23],
    });
    const result = evaluateModeledAbdominalCircumference(locReport);

    assert.equal(result.crossSectionEvidence.supportPolicyId, 'trunk_pelvic_transition_support_v0');
    assert.deepEqual(result.crossSectionEvidence.targetClassIds, [12, 13, 21, 22, 23]);
    assert.equal(result.provenance.supportPolicyId, 'trunk_pelvic_transition_support_v0');
    assert.deepEqual(result.provenance.targetClassIds, [12, 13, 21, 22, 23]);
  });

  it('29. preserves Front and Side encountered segmentation class IDs from selected candidate without default trunk leak', () => {
    const locReport = createMockAbdominalApexLocalization({
      frontEncounteredClassIds: [13, 22],
      sideEncounteredClassIds: [13, 22],
    });
    const result = evaluateModeledAbdominalCircumference(locReport);

    assert.deepEqual(result.crossSectionEvidence.front.encounteredClassIds, [13, 22]);
    assert.deepEqual(result.crossSectionEvidence.side.encounteredClassIds, [13, 22]);
    assert.deepEqual(result.provenance.encounteredFrontClassIds, [13, 22]);
    assert.deepEqual(result.provenance.encounteredSideClassIds, [13, 22]);
  });

  it('30. ensures numeric values and metadata strictly originate from identical selected candidate record', () => {
    const locReport = createMockAbdominalApexLocalization({
      yCm: 95.75,
      frontWidthCm: 37.20,
      frontMinXcm: 81.20,
      frontMaxXcm: 118.40,
      sideQualifiedApDepthCm: 26.30,
      sideMinUcm: 81.60,
      sideMaxUcm: 107.90,
      frontEncounteredClassIds: [13, 22],
      sideEncounteredClassIds: [13, 22],
    });
    const result = evaluateModeledAbdominalCircumference(locReport);

    assert.equal(result.yCm, 95.75);
    assert.equal(result.levelYcm, 95.75);
    assert.equal(result.model.transverseWidthCm, 37.20);
    assert.equal(result.model.apDepthCm, 26.30);
    assert.equal(result.crossSectionEvidence.front.transverseWidthCm, 37.20);
    assert.equal(result.crossSectionEvidence.front.minXcm, 81.20);
    assert.equal(result.crossSectionEvidence.front.maxXcm, 118.40);
    assert.equal(result.crossSectionEvidence.side.qualifiedApDepthCm, 26.30);
    assert.equal(result.crossSectionEvidence.side.minUcm, 81.60);
    assert.equal(result.crossSectionEvidence.side.maxUcm, 107.90);
    assert.deepEqual(result.crossSectionEvidence.front.encounteredClassIds, [13, 22]);
    assert.deepEqual(result.crossSectionEvidence.side.encounteredClassIds, [13, 22]);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT,
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT_VERSION,
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS,
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS,
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_DEFINITION_ID,
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_DISPLAY_NAME,
  evaluateModeledNaturalWaistCircumference,
} from './modeledNaturalWaistCircumference.js';
import { computeRamanujanEllipsePerimeter } from './modeledCrossSectionPerimeter.js';

function createMockNaturalWaistLocalization({
  status = 'ready',
  yCm = 107.15,
  frontWidthCm = 29.0,
  frontMinXcm = 85.5,
  frontMaxXcm = 114.5,
  sideQualifiedApDepthCm = 23.2,
  sideRawProfileSpanCm = 23.2,
  sideMinUcm = 88.4,
  sideMaxUcm = 111.6,
  isSideQualified = true,
  sideStatus = 'qualified',
  contract = 'natural-waist-plane-localization-v0',
  frontRasterRow = 357,
  sideRasterRow = 357,
  sliceHighlightYcm = null,
} = {}) {
  const selectedCandidate = {
    yCm,
    rasterRow: frontRasterRow,
    sideRasterRow,
    frontWidthCm,
    frontMinXcm,
    frontMaxXcm,
    smoothedWidthCm: frontWidthCm,
    sideRawProfileSpanCm,
    sideQualifiedApDepthCm,
    sideMinUcm,
    sideMaxUcm,
    encounteredFrontClassIds: [22, 23],
    encounteredSideClassIds: [22, 23],
    constrictionProminenceCm: 1.25,
    superiorConstrictionDepthCm: 1.5,
    inferiorConstrictionDepthCm: 1.25,
    bilateralContourQa: {
      status: 'symmetric',
      leftIndentationCm: 1.0,
      rightIndentationCm: 1.0,
      asymmetryDeltaCm: 0.0,
    },
  };

  return {
    contract,
    version: 'natural-waist-plane-localization-v0',
    status,
    yCm,
    rasterRow: frontRasterRow,
    selectionMethod: 'stable_valley_corroborated_v0',
    selectedCandidate: status === 'ready' ? selectedCandidate : null,
    frontEvidence: {
      status: 'valid',
      widthCm: frontWidthCm,
      minXcm: frontMinXcm,
      maxXcm: frontMaxXcm,
      runCount: 1,
      isSingleSupportedRun: true,
      encounteredClassIds: [22, 23],
    },
    sideEvidence: isSideQualified ? {
      status: sideStatus,
      profileSpanCm: sideRawProfileSpanCm,
      qualifiedApDepthCm: sideQualifiedApDepthCm,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      isQualified: true,
      depthQualificationStatus: 'qualified',
      corroboration: 'corroborated',
    } : (sideStatus === 'unavailable' ? {
      status: 'unavailable',
      profileSpanCm: null,
      qualifiedApDepthCm: null,
      minUcm: null,
      maxUcm: null,
      isQualified: false,
      depthQualificationStatus: 'unavailable',
      corroboration: 'unqualified',
    } : {
      status: sideStatus,
      profileSpanCm: sideRawProfileSpanCm,
      qualifiedApDepthCm: null,
      minUcm: sideMinUcm,
      maxUcm: sideMaxUcm,
      isQualified: false,
      depthQualificationStatus: 'disqualified',
      corroboration: 'unqualified',
    }),
    provenance: {
      shoulderAnchorYcm: 140.0,
      offsetBelowShoulderCm: 32.85,
      hipAnchorYcm: 90.0,
      elevationAboveHipCm: 17.15,
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

describe('modeledNaturalWaistCircumference domain contract v0', () => {
  it('evaluates valid Modeled Natural Waist Circumference matching Ramanujan II formula', () => {
    const locReport = createMockNaturalWaistLocalization({
      yCm: 107.15,
      frontWidthCm: 29.00,
      sideQualifiedApDepthCm: 23.20,
    });

    const result = evaluateModeledNaturalWaistCircumference(locReport);

    assert.equal(result.contract, MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT);
    assert.equal(result.version, MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT_VERSION);
    assert.equal(result.id, MODELED_NATURAL_WAIST_CIRCUMFERENCE_DEFINITION_ID);
    assert.equal(result.name, MODELED_NATURAL_WAIST_CIRCUMFERENCE_DISPLAY_NAME);
    assert.equal(result.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.isModeled, true);
    assert.equal(result.isQualified, true);

    const expectedRamanujan = computeRamanujanEllipsePerimeter(29.00, 23.20);
    assert.ok(expectedRamanujan);
    assert.equal(result.valueCm, Number(expectedRamanujan.perimeterCm.toFixed(4)));
    assert.equal(result.yCm, 107.15);
    assert.equal(result.levelYcm, 107.15);

    // Model structure
    assert.equal(result.model.family, 'ellipse');
    assert.equal(result.model.implementation, 'ellipse_ramanujan_ii');
    assert.equal(result.model.frontDiameterCm, 29.00);
    assert.equal(result.model.sideDiameterCm, 23.20);
    assert.equal(result.model.transverseWidthCm, 29.00);
    assert.equal(result.model.apDepthCm, 23.20);
    assert.equal(result.model.semiMajorAxisCm, 14.50);
    assert.equal(result.model.semiMinorAxisCm, 11.60);

    // Provenance
    assert.equal(result.provenance.selectedYcm, 107.15);
    assert.equal(result.provenance.frontTransverseWidthCm, 29.00);
    assert.equal(result.provenance.sideQualifiedApDepthCm, 23.20);

    // Cross-Section Evidence composition
    assert.ok(result.crossSectionEvidence);
    assert.equal(result.crossSectionEvidence.contract, 'natural-waist-cross-section-evidence-v0');
    assert.equal(result.crossSectionEvidence.status, 'qualified');
    assert.equal(result.crossSectionEvidence.isQualified, true);
    assert.equal(result.crossSectionEvidence.front.transverseWidthCm, 29.00);
    assert.equal(result.crossSectionEvidence.side.qualifiedApDepthCm, 23.20);
    assert.equal(result.crossSectionEvidence.sameYConsistency.isConsistent, true);

    // Semantics
    assert.equal(result.semantics.isModeledEstimate, true);
    assert.equal(result.semantics.isMeasuredContour, false);
    assert.equal(result.semantics.isTapeMeasuredGroundTruth, false);
    assert.equal(result.semantics.is3dReconstruction, false);
  });

  it('rejects Front-only Natural Waist localization (Side unavailable) without producing circumference', () => {
    const locReport = createMockNaturalWaistLocalization({
      isSideQualified: false,
      sideStatus: 'unavailable',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: null,
    });
    // Add advisory warning that occurs in Front-only localization
    locReport.warnings.push('Side segmentation raster was unavailable during scan');

    const result = evaluateModeledNaturalWaistCircumference(locReport);

    assert.equal(result.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(result.isModeled, false);
    assert.equal(result.isQualified, false);
    assert.equal(result.valueCm, null);
    assert.ok(result.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_UNAVAILABLE));
  });

  it('rejects unqualified Side AP depth without falling back to raw Side span', () => {
    const locReport = createMockNaturalWaistLocalization({
      isSideQualified: false,
      sideStatus: 'disqualified',
      sideQualifiedApDepthCm: null,
      sideRawProfileSpanCm: 25.5, // Raw profile span exists, but is NOT qualified as physical depth
    });

    const result = evaluateModeledNaturalWaistCircumference(locReport);

    assert.equal(result.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.BLOCKED);
    assert.equal(result.isModeled, false);
    assert.equal(result.valueCm, null);
    assert.ok(result.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED));
  });

  it('returns unavailable when Natural Waist localization status is ambiguous', () => {
    const locReport = createMockNaturalWaistLocalization({
      status: 'ambiguous',
    });

    const result = evaluateModeledNaturalWaistCircumference(locReport);

    assert.equal(result.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(result.valueCm, null);
    assert.ok(result.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_AMBIGUOUS));
  });

  it('returns unavailable when localization report is null or unavailable', () => {
    const resultNull = evaluateModeledNaturalWaistCircumference(null);
    assert.equal(resultNull.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resultNull.valueCm, null);
    assert.ok(resultNull.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.NATURAL_WAIST_PLANE_UNAVAILABLE));

    const locUnavailable = createMockNaturalWaistLocalization({ status: 'unavailable' });
    const resultUnavail = evaluateModeledNaturalWaistCircumference(locUnavailable);
    assert.equal(resultUnavail.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.UNAVAILABLE);
    assert.equal(resultUnavail.valueCm, null);
  });

  it('returns invalid on same-Y contradiction between localized Y and slice coordinate Y', () => {
    const locReport = createMockNaturalWaistLocalization({
      yCm: 107.15,
      sliceHighlightYcm: 105.00, // Mismatched Y
    });

    const result = evaluateModeledNaturalWaistCircumference(locReport);

    assert.equal(result.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID);
    assert.equal(result.valueCm, null);
    assert.ok(result.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SAME_Y_MISMATCH));
  });

  it('returns invalid on malformed / non-positive Front or Side dimensions', () => {
    const locZeroFront = createMockNaturalWaistLocalization({ frontWidthCm: 0 });
    const resZeroFront = evaluateModeledNaturalWaistCircumference(locZeroFront);
    assert.equal(resZeroFront.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID);
    assert.equal(resZeroFront.valueCm, null);
    assert.ok(resZeroFront.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.FRONT_WIDTH_INVALID));

    const locNegativeSide = createMockNaturalWaistLocalization({ sideQualifiedApDepthCm: -5.0 });
    const resNegSide = evaluateModeledNaturalWaistCircumference(locNegativeSide);
    assert.equal(resNegSide.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.INVALID);
    assert.equal(resNegSide.valueCm, null);
    assert.ok(resNegSide.blockers.includes(MODELED_NATURAL_WAIST_CIRCUMFERENCE_BLOCKERS.SIDE_AP_DEPTH_INVALID));
  });

  it('preserves independent Front and Side raster rows without requiring equality', () => {
    const locDiffRows = createMockNaturalWaistLocalization({
      frontRasterRow: 350,
      sideRasterRow: 358,
      yCm: 107.15,
      frontWidthCm: 29.00,
      sideQualifiedApDepthCm: 23.20,
    });

    const result = evaluateModeledNaturalWaistCircumference(locDiffRows);

    assert.equal(result.status, MODELED_NATURAL_WAIST_CIRCUMFERENCE_STATUS.MODELED);
    assert.equal(result.provenance.frontRasterRow, 350);
    assert.equal(result.provenance.sideRasterRow, 358);
    assert.equal(result.crossSectionEvidence.front.rasterRow, 350);
    assert.equal(result.crossSectionEvidence.side.rasterRow, 358);
  });
});

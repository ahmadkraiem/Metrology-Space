import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MODELED_HIP_GIRTH_CONTRACT,
  MODELED_HIP_GIRTH_CONTRACT_VERSION,
  MODELED_HIP_GIRTH_DEFINITION_ID,
  MODELED_HIP_GIRTH_DISPLAY_NAME,
  MODELED_HIP_GIRTH_STATUS,
  MODELED_HIP_GIRTH_BLOCKERS,
  evaluateModeledHipGirth,
} from './modeledHipGirth.js';

function createMockButtockPointReport({
  status = 'ready',
  yCm = 86.15,
  widthCm = 42.20,
  apDepthCm = 27.80,
  isSideQualified = true,
  isFrontValid = true,
} = {}) {
  return {
    contract: 'buttock-point-plane-localization-v1',
    version: 'buttock-point-plane-localization-v1',
    id: 'torso_buttock_point_plane_localization_v1',
    name: 'Buttock Point / Hip Girth Plane Localization',
    status,
    yCm,
    levelYcm: yCm,
    rasterRow: 1138,
    sideRasterRow: 1138,
    selectedPlateau: {
      plateauMinYcm: 86.05,
      plateauMaxYcm: 86.25,
      midpointYcm: 86.15,
      representativeYcm: yCm,
      maxRawPosteriorProjectionCm: 112.30,
      maxRawPosteriorUcm: 112.30,
    },
    frontEvidence: {
      status: isFrontValid ? 'valid' : 'invalid',
      widthCm,
      minXcm: 78.80,
      maxXcm: 78.80 + widthCm,
      rasterRow: 1138,
      isSingleSupportedRun: isFrontValid,
      runCount: isFrontValid ? 1 : 2,
    },
    sideEvidence: {
      status: isSideQualified ? 'valid' : 'invalid',
      qualifiedApDepthCm: apDepthCm,
      profileSpanCm: apDepthCm,
      minUcm: 84.50,
      maxUcm: 112.30,
      rawAnteriorUcm: 84.50,
      rawPosteriorUcm: 112.30,
      rasterRow: 1138,
      isSingleSupportedRun: true,
      isQualified: isSideQualified,
      depthQualificationStatus: isSideQualified ? 'qualified' : 'unqualified',
    },
    provenance: {
      supportPolicyId: 'trunk_pelvic_transition_support_v0',
      sliceHighlightCoordinates: {
        yCm,
        frontRasterRow: 1138,
        sideRasterRow: 1138,
        frontBoundsCm: { minX: 78.80, maxX: 121.00 },
        sideBoundsCm: { minU: 84.50, maxU: 112.30 },
      },
    },
  };
}

describe('modeledHipGirth domain contract v1', () => {
  it('1. evaluates valid Buttock Point report to modeled status with exact Ramanujan II perimeter (~111.12 cm)', () => {
    const report = createMockButtockPointReport({ widthCm: 42.20, apDepthCm: 27.80 });
    const result = evaluateModeledHipGirth(report);

    assert.equal(result.status, MODELED_HIP_GIRTH_STATUS.MODELED);
    assert.equal(result.contract, MODELED_HIP_GIRTH_CONTRACT);
    assert.equal(result.id, MODELED_HIP_GIRTH_DEFINITION_ID);
    assert.equal(result.name, MODELED_HIP_GIRTH_DISPLAY_NAME);
    assert.equal(result.yCm, 86.15);
    assert.equal(result.valueCm, 111.12);
    assert.equal(result.model.transverseWidthCm, 42.20);
    assert.equal(result.model.apDepthCm, 27.80);
    assert.equal(result.isModeled, true);
    assert.equal(result.isQualified, true);
  });

  it('2. returns unavailable when Buttock Point report is missing or unavailable', () => {
    const resNull = evaluateModeledHipGirth(null);
    assert.equal(resNull.status, MODELED_HIP_GIRTH_STATUS.UNAVAILABLE);
    assert.ok(resNull.blockers.includes(MODELED_HIP_GIRTH_BLOCKERS.BUTTOCK_POINT_PLANE_UNAVAILABLE));

    const resUnavail = evaluateModeledHipGirth(createMockButtockPointReport({ status: 'unavailable' }));
    assert.equal(resUnavail.status, MODELED_HIP_GIRTH_STATUS.UNAVAILABLE);
  });

  it('3. returns blocked when Buttock Point report is ambiguous', () => {
    const resAmbiguous = evaluateModeledHipGirth(createMockButtockPointReport({ status: 'ambiguous' }));
    assert.equal(resAmbiguous.status, MODELED_HIP_GIRTH_STATUS.BLOCKED);
    assert.ok(resAmbiguous.blockers.includes(MODELED_HIP_GIRTH_BLOCKERS.BUTTOCK_POINT_PLANE_AMBIGUOUS));
  });

  it('4. returns blocked when Front width is invalid', () => {
    const resInvalidFront = evaluateModeledHipGirth(createMockButtockPointReport({ isFrontValid: false }));
    assert.equal(resInvalidFront.status, MODELED_HIP_GIRTH_STATUS.BLOCKED);
    assert.ok(resInvalidFront.blockers.includes(MODELED_HIP_GIRTH_BLOCKERS.FRONT_WIDTH_INVALID));
  });

  it('5. returns blocked when Side AP depth is not qualified', () => {
    const resUnqualifiedSide = evaluateModeledHipGirth(createMockButtockPointReport({ isSideQualified: false }));
    assert.equal(resUnqualifiedSide.status, MODELED_HIP_GIRTH_STATUS.BLOCKED);
    assert.ok(resUnqualifiedSide.blockers.includes(MODELED_HIP_GIRTH_BLOCKERS.SIDE_AP_DEPTH_NOT_QUALIFIED));
  });

  it('6. disclaims tape-measured ground truth and 3D vertex reconstruction', () => {
    const result = evaluateModeledHipGirth(createMockButtockPointReport());
    assert.equal(result.semantics.isTapeMeasuredGroundTruth, false);
    assert.equal(result.semantics.is3dReconstruction, false);
    assert.equal(result.semantics.isStandardsAlignedHipGirth, true);
    assert.equal(result.semantics.isMaximumSeatGirth, false);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUST_APEX_PLANE_CONTRACT,
  BUST_APEX_PLANE_CONTRACT_VERSION,
  BUST_APEX_PLANE_STATUS,
  BUST_APEX_BLOCKER_CODES,
  DEFAULT_BUST_APEX_OPTIONS,
  evaluateBustApexPlaneLocalization,
} from './bustApexPlaneLocalization.js';

import {
  getBustApexPlaneLocalization,
  getBustApexPlaneLocalizationReport,
} from './bodyEvidence.js';

describe('Bust Apex Plane Localization v0', () => {
  // Helper to build synthetic torso scan report with controllable chest/bust anterior contour
  function createSyntheticTorsoScanReport({
    shoulderY = 140.0,
    hipY = 90.0,
    rowsCount = 51,
    waistY = 110.0,
    waistSuperiorCrestY = 114.0,
    bustApexY = 126.0,
    bustProminence = 1.8,
    orientation = 'positive_u', // 'positive_u' (anterior=maxU) or 'negative_u' (anterior=minU)
    globalUOffset = 0.0,
    spikeRowIndex = null,
    spikeProminence = 3.0,
    secondaryBustApexY = null,
    secondaryBustProminence = 1.7,
    flatChest = false,
    frontStatus = 'valid',
    isSingleFrontRun = true,
    isSideDepthQualified = true,
    sideStatus = 'valid',
    isSingleSideRun = true,
    supportPolicyId = 'trunk_core_support_v0',
    targetClassIds = [22, 23],
    isCandidateValidOverride = true,
  } = {}) {
    const isPositiveU = orientation === 'positive_u';
    const candidates = [];

    const yStep = (shoulderY - hipY) / (rowsCount - 1);

    for (let i = 0; i < rowsCount; i += 1) {
      const yCm = Number((shoulderY - i * yStep).toFixed(4));
      const rasterRow = i * 10;
      const sideRasterRow = i * 10 + 2; // Independent row indices to verify resolution independence

      // Front width: narrower at waist, wider at shoulder
      const waistDist = Math.abs(yCm - waistY);
      const frontWidthCm = Number((28.0 + 0.15 * waistDist).toFixed(4));
      const frontMinXcm = Number((100.0 - frontWidthCm / 2).toFixed(4));
      const frontMaxXcm = Number((100.0 + frontWidthCm / 2).toFixed(4));

      // Posterior contour (default minU if positive_u, maxU if negative_u)
      let posteriorU = isPositiveU ? (90.0 + globalUOffset) : (110.0 + globalUOffset);

      // Anterior contour: baseline is 110 (if positive_u) or 90 (if negative_u)
      let baseAnteriorU = isPositiveU ? (110.0 + globalUOffset) : (90.0 + globalUOffset);
      let anteriorBulge = 0;

      if (!flatChest && yCm <= shoulderY && yCm >= waistSuperiorCrestY) {
        // Primary bust apex bulge
        const distToApex = Math.abs(yCm - bustApexY);
        if (distToApex <= 8.0) {
          anteriorBulge += Math.max(0, bustProminence - 0.08 * distToApex * distToApex);
        }

        // Optional secondary bust apex bulge
        if (secondaryBustApexY !== null) {
          const distToSec = Math.abs(yCm - secondaryBustApexY);
          if (distToSec <= 6.0) {
            anteriorBulge += Math.max(0, secondaryBustProminence - 0.08 * distToSec * distToSec);
          }
        }
      }

      // Optional single-row spike
      if (spikeRowIndex !== null && i === spikeRowIndex) {
        anteriorBulge += spikeProminence;
      }

      const anteriorU = isPositiveU ? (baseAnteriorU + anteriorBulge) : (baseAnteriorU - anteriorBulge);

      const minUcm = Number(Math.min(anteriorU, posteriorU).toFixed(4));
      const maxUcm = Number(Math.max(anteriorU, posteriorU).toFixed(4));
      const profileSpanCm = Number((maxUcm - minUcm).toFixed(4));
      const qualifiedApDepthCm = isSideDepthQualified ? profileSpanCm : null;

      candidates.push({
        yCm,
        rasterRow,
        sideRasterRow,
        rowNormalizedV: i / (rowsCount - 1),
        front: {
          status: frontStatus,
          runCount: isSingleFrontRun ? 1 : 2,
          widthCm: frontWidthCm,
          minXcm: frontMinXcm,
          maxXcm: frontMaxXcm,
          encounteredClassIds: [...targetClassIds],
          isSingleSupportedRun: isSingleFrontRun,
        },
        side: {
          status: sideStatus,
          rasterRow: sideRasterRow,
          runCount: isSingleSideRun ? 1 : 2,
          profileSpanCm,
          minUcm,
          maxUcm,
          encounteredClassIds: [...targetClassIds],
          isSingleSupportedRun: isSingleSideRun,
          qualifiedApDepthCm,
          depthQualificationStatus: isSideDepthQualified ? 'qualified' : 'unqualified',
          isQualified: isSideDepthQualified,
          qualificationChecks: [{ id: 'test_pass', status: isSideDepthQualified ? 'pass' : 'fail' }],
        },
        isCandidateValid: isCandidateValidOverride,
      });
    }

    return {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      version: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      supportPolicyId,
      targetClassIds: [...targetClassIds],
      upperBound: { yCm: shoulderY, rasterRow: 0, sourceLevel: 'shoulder' },
      lowerBound: { yCm: hipY, rasterRow: (rowsCount - 1) * 10, sourceLevel: 'hip' },
      candidateCount: candidates.length,
      candidates,
    };
  }

  // Standard Natural Waist Report Helper
  function createSyntheticWaistReport({
    waistY = 110.0,
    superiorCrestY = 114.0,
    inferiorCrestY = 106.0,
    status = 'ready',
    includeTroughs = true,
  } = {}) {
    return {
      contract: 'natural-waist-plane-localization-v0',
      version: 'natural-waist-plane-localization-v0',
      status,
      yCm: waistY,
      rasterRow: 250,
      troughs: includeTroughs
        ? [
            {
              troughId: 'trough_1',
              superiorCrestYcm: superiorCrestY,
              inferiorCrestYcm: inferiorCrestY,
              troughMinYcm: waistY,
              troughMaxYcm: waistY,
              deepestMember: { yCm: waistY, superiorCrestYcm: superiorCrestY },
              representativeValley: { yCm: waistY, superiorCrestYcm: superiorCrestY },
              memberYValues: [waistY],
            },
          ]
        : [],
      selectedCandidate: {
        yCm: waistY,
        superiorCrestYcm: superiorCrestY,
      },
    };
  }

  // Standard Side Orientation Report Helper
  function createSyntheticOrientationReport({
    facingDirection = 'positive_u',
    status = 'ready',
  } = {}) {
    const anteriorSide = facingDirection === 'positive_u' ? 'max_u' : (facingDirection === 'negative_u' ? 'min_u' : null);
    const posteriorSide = facingDirection === 'positive_u' ? 'min_u' : (facingDirection === 'negative_u' ? 'max_u' : null);
    return {
      contract: 'side-anterior-posterior-orientation-v0',
      version: 'side-anterior-posterior-orientation-v0',
      status,
      facingDirection: status === 'ready' ? facingDirection : null,
      anteriorSide: status === 'ready' ? anteriorSide : null,
      posteriorSide: status === 'ready' ? posteriorSide : null,
      isQualified: status === 'ready',
    };
  }

  // Standard Anatomical Levels Report Helper
  function createSyntheticLevelsReport({
    shoulderY = 140.0,
    status = 'ready',
  } = {}) {
    return {
      contract: 'anatomical-levels-v0',
      view: 'front',
      levels: [
        {
          id: 'shoulder',
          name: 'Shoulder Level',
          status,
          yCm: status === 'ready' ? shoulderY : null,
          requiredAnchors: ['left_shoulder', 'right_shoulder'],
          presentAnchors: status === 'ready' ? ['left_shoulder', 'right_shoulder'] : (status === 'partial' ? ['left_shoulder'] : []),
          missingAnchors: status === 'ready' ? [] : (status === 'partial' ? ['right_shoulder'] : ['left_shoulder', 'right_shoulder']),
        },
      ],
    };
  }

  it('1. Contract ID and Version conform to bust-apex-plane-localization-v0', () => {
    assert.equal(BUST_APEX_PLANE_CONTRACT, 'bust-apex-plane-localization-v0');
    assert.equal(BUST_APEX_PLANE_CONTRACT_VERSION, 'bust-apex-plane-localization-v0');
    assert.deepEqual(Object.keys(BUST_APEX_PLANE_STATUS), ['READY', 'AMBIGUOUS', 'UNAVAILABLE', 'INVALID']);
  });

  it('2. Ready status on a clear synthetic bust prominence', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      bustProminence: 1.8,
      orientation: 'positive_u',
    });
    const waistReport = createSyntheticWaistReport({ waistY: 110.0, superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.ok(Math.abs(result.yCm - 126.0) < 0.5, `Expected Y ~ 126.0, got ${result.yCm}`);
    assert.equal(result.selectedPeak.yCm, result.yCm);
    assert.ok(result.selectedPeak.prominenceCm >= 1.5);
    assert.equal(result.searchWindow.shoulderYcm, 140.0);
    assert.equal(result.searchWindow.naturalWaistSuperiorCrestYcm, 114.0);
    assert.equal(result.orientation.anteriorSide, 'max_u');
    assert.equal(result.semantics.isBustApexPlaneCandidate, true);
    assert.equal(result.semantics.isMaximumApDepth, false);
    assert.equal(result.semantics.isCircumference, false);
  });

  it('3. Positive-U orientation maps maxU to anterior contour', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 127.0,
      orientation: 'positive_u',
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(result.orientation.facingDirection, 'positive_u');
    assert.equal(result.orientation.anteriorSide, 'max_u');
    assert.equal(result.selectedPeak.normalizedAnteriorVal, result.selectedPeak.rawAnteriorUcm);
  });

  it('4. Negative-U orientation maps minU to anterior contour', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 127.0,
      orientation: 'negative_u',
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(result.orientation.facingDirection, 'negative_u');
    assert.equal(result.orientation.anteriorSide, 'min_u');
    assert.equal(result.selectedPeak.normalizedAnteriorVal, -result.selectedPeak.rawAnteriorUcm);
  });

  it('5. Mirrored-facing invariance produces equivalent localized Y', () => {
    const torsoScanPos = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      bustProminence: 2.0,
      orientation: 'positive_u',
    });
    const torsoScanNeg = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      bustProminence: 2.0,
      orientation: 'negative_u',
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const resPos = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScanPos,
      naturalWaistReport: waistReport,
      sideOrientationReport: createSyntheticOrientationReport({ facingDirection: 'positive_u' }),
      levelsReport,
    });
    const resNeg = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScanNeg,
      naturalWaistReport: waistReport,
      sideOrientationReport: createSyntheticOrientationReport({ facingDirection: 'negative_u' }),
      levelsReport,
    });

    assert.equal(resPos.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(resNeg.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(resPos.yCm, resNeg.yCm);
    assert.ok(Math.abs(resPos.selectedPeak.prominenceCm - resNeg.selectedPeak.prominenceCm) < 0.001);
  });

  it('6. Global Side-U translation invariance', () => {
    const torsoScanBase = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 125.0,
      globalUOffset: 0.0,
    });
    const torsoScanShifted = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 125.0,
      globalUOffset: 25.0, // Shift profile by 25 cm along U
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const resBase = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScanBase,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });
    const resShifted = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScanShifted,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(resBase.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(resShifted.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(resBase.yCm, resShifted.yCm);
    assert.ok(Math.abs(resBase.selectedPeak.prominenceCm - resShifted.selectedPeak.prominenceCm) < 0.001);
  });

  it('7. Missing Shoulder level causes UNAVAILABLE with SHOULDER_ANCHOR_UNAVAILABLE', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    torsoScan.upperBound = null;
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ status: 'missing' });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.SHOULDER_ANCHOR_UNAVAILABLE));
  });

  it('8. Partial Shoulder level causes UNAVAILABLE with SHOULDER_ANCHOR_UNAVAILABLE', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    torsoScan.upperBound = null;
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ status: 'partial' });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.SHOULDER_ANCHOR_UNAVAILABLE));
  });

  it('9. Natural Waist unavailable causes UNAVAILABLE with NATURAL_WAIST_UNAVAILABLE', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    const waistReport = createSyntheticWaistReport({ status: 'unavailable' });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE));
  });

  it('10a. Natural Waist 0 troughs causes UNAVAILABLE with NATURAL_WAIST_SELECTED_TROUGH_UNRESOLVED without fallback to yCm', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    // Waist report ready, but troughs empty
    const waistReport = {
      contract: 'natural-waist-plane-localization-v0',
      status: 'ready',
      yCm: 110.0,
      troughs: [],
    };
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_SELECTED_TROUGH_UNRESOLVED));
    // Verify it did NOT silently use yCm 110.0 as lower boundary
    assert.equal(result.searchWindow.naturalWaistSuperiorCrestYcm, null);
    assert.equal(result.yCm, null);
  });

  it('10b. Multiple Natural Waist troughs where naturalWaistReport.yCm matches non-first trough resolves correctly', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 116.0,
      bustApexY: 126.0,
    });
    // Waist report has 2 troughs:
    // trough_1 at yCm = 105.0 (superior crest = 108.0)
    // trough_2 at yCm = 112.0 (superior crest = 116.0)
    // naturalWaistReport.yCm is 112.0 (matching non-first trough_2)
    const waistReport = {
      contract: 'natural-waist-plane-localization-v0',
      status: 'ready',
      yCm: 112.0,
      troughs: [
        {
          troughId: 'trough_1',
          superiorCrestYcm: 108.0,
          representativeValley: { yCm: 105.0 },
          memberYValues: [105.0],
        },
        {
          troughId: 'trough_2',
          superiorCrestYcm: 116.0,
          representativeValley: { yCm: 112.0 },
          memberYValues: [112.0],
        },
      ],
    };
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    // Lower boundary MUST be 116.0 from trough_2, NOT 108.0 from trough_1
    assert.equal(result.searchWindow.naturalWaistSuperiorCrestYcm, 116.0);
    assert.equal(result.searchWindow.lowerSource, 'natural_waist_trough_2_superior_crest');
  });

  it('10c. Multiple Natural Waist troughs where naturalWaistReport.yCm matches NONE causes UNAVAILABLE and MUST NOT use troughs[0]', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      bustApexY: 126.0,
    });
    // Waist report has 2 troughs at 105.0 and 108.0, but naturalWaistReport.yCm is 112.0 (matches none)
    const waistReport = {
      contract: 'natural-waist-plane-localization-v0',
      status: 'ready',
      yCm: 112.0,
      troughs: [
        {
          troughId: 'trough_1',
          superiorCrestYcm: 108.0,
          representativeValley: { yCm: 105.0 },
          memberYValues: [105.0],
        },
        {
          troughId: 'trough_2',
          superiorCrestYcm: 110.0,
          representativeValley: { yCm: 108.0 },
          memberYValues: [108.0],
        },
      ],
    };
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_SELECTED_TROUGH_UNRESOLVED));
    // MUST NOT have fallen back to trough_1 superior crest 108.0 or waist yCm 112.0
    assert.equal(result.searchWindow.naturalWaistSuperiorCrestYcm, null);
    assert.equal(result.yCm, null);
  });

  it('10d. Selected trough found but superiorCrestYcm missing causes UNAVAILABLE with NATURAL_WAIST_SUPERIOR_CREST_UNAVAILABLE without fallback to yCm', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      bustApexY: 126.0,
    });
    // Waist report single trough at 110.0, but superiorCrestYcm is null
    const waistReport = {
      contract: 'natural-waist-plane-localization-v0',
      status: 'ready',
      yCm: 110.0,
      troughs: [
        {
          troughId: 'trough_1',
          superiorCrestYcm: null, // missing
          representativeValley: { yCm: 110.0 },
          memberYValues: [110.0],
        },
      ],
    };
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.NATURAL_WAIST_SUPERIOR_CREST_UNAVAILABLE));
    // Verify it did NOT silently use yCm 110.0 as lower boundary
    assert.equal(result.searchWindow.naturalWaistSuperiorCrestYcm, null);
    assert.equal(result.yCm, null);
  });

  it('11. Invalid Shoulder/Waist ordering causes INVALID with INVALID_SEARCH_WINDOW', () => {
    const torsoScan = createSyntheticTorsoScanReport({ shoulderY: 110.0 });
    // Waist superior crest (115.0) is higher elevation than shoulder (110.0)
    const waistReport = createSyntheticWaistReport({ waistY: 112.0, superiorCrestY: 115.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 110.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.INVALID);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.INVALID_SEARCH_WINDOW));
  });

  it('12. Side orientation unavailable causes UNAVAILABLE with SIDE_ORIENTATION_UNAVAILABLE', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport({ status: 'unavailable' });
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE));
  });

  it('13. Side orientation ambiguous causes AMBIGUOUS with SIDE_ORIENTATION_UNAVAILABLE', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport({ status: 'ambiguous' });
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.AMBIGUOUS);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE));
  });

  it('14. No usable Side torso rows causes UNAVAILABLE with INSUFFICIENT_SEARCH_ROWS', () => {
    const torsoScan = createSyntheticTorsoScanReport({ sideStatus: 'empty', isSingleSideRun: false });
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.INSUFFICIENT_SEARCH_ROWS));
  });

  it('15. Side multi-run rows are excluded conservatively from anterior contour series', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
    });
    // Turn row 10 into a multi-run row (e.g. arm overlap)
    torsoScan.candidates[10].side.runCount = 2;
    torsoScan.candidates[10].side.isSingleSupportedRun = false;

    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    // The candidate list used for peak detection should omit the invalid multi-run row
    assert.ok(result.searchCandidateCount < torsoScan.candidates.filter(c => c.yCm <= 140.05 && c.yCm >= 113.95).length);
  });

  it('16. No significant anterior prominence causes UNAVAILABLE with NO_ANTERIOR_PROMINENCE_DETECTED', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      flatChest: true,
    });
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.NO_ANTERIOR_PROMINENCE_DETECTED));
  });

  it('17. Isolated one-row spike is rejected by neighborhood smoothing', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      flatChest: true,
      spikeRowIndex: 12,
      spikeProminence: 4.0, // High 1-row spike in flat chest
    });
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    // Spike must NOT be selected as a valid bust apex
    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.equal(result.selectedPeak, null);
  });

  it('18. Broad stable peak is pooled deterministically', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      bustProminence: 2.0,
      secondaryBustApexY: 127.0, // Adjacent peak 1.0 cm away with shallow saddle
      secondaryBustProminence: 1.95,
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(result.groups.length, 1);
    assert.ok(result.groups[0].memberCount >= 2);
  });

  it('19. Two competing distinct peaks produce AMBIGUOUS with AMBIGUOUS_MULTIPLE_APEX_PROMINENCES', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 132.0, // Distant peak 1
      bustProminence: 1.8,
      secondaryBustApexY: 120.0, // Distant peak 2 (12 cm away, deep saddle)
      secondaryBustProminence: 1.75, // Similar prominence
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.AMBIGUOUS);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES));
    assert.equal(result.selectedPeak, null);
  });

  it('20. Boundary-confounded shoulder-adjacent peak is rejected', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      hipY: 90.0,
      waistSuperiorCrestY: 114.0,
      rowsCount: 101, // yStep = (140 - 90)/100 = 0.5 cm
      flatChest: true,
    });
    // Create peak near shoulder boundary
    torsoScan.candidates[1].side.maxUcm = 113.0;
    torsoScan.candidates[2].side.maxUcm = 112.5;
    torsoScan.candidates[3].side.maxUcm = 112.0;
    torsoScan.candidates[4].side.maxUcm = 111.5;
    torsoScan.candidates[1].side.profileSpanCm = 23.0;
    torsoScan.candidates[2].side.profileSpanCm = 22.5;
    torsoScan.candidates[3].side.profileSpanCm = 22.0;
    torsoScan.candidates[4].side.profileSpanCm = 21.5;

    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
      options: { boundaryMarginCm: 1.5 },
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.BOUNDARY_CONFOUNDED_APEX));
  });

  it('21. Boundary-confounded waist-adjacent peak is rejected', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      hipY: 90.0,
      waistSuperiorCrestY: 114.0,
      rowsCount: 101, // yStep = (140 - 90)/100 = 0.5 cm
      flatChest: true,
    });
    // Window candidates span from index 0 (Y=140.0) to index 52 (Y=114.0)
    // Create peak near waist crest boundary
    torsoScan.candidates[51].side.maxUcm = 113.0;
    torsoScan.candidates[50].side.maxUcm = 112.5;
    torsoScan.candidates[49].side.maxUcm = 112.0;
    torsoScan.candidates[48].side.maxUcm = 111.5;
    torsoScan.candidates[51].side.profileSpanCm = 23.0;
    torsoScan.candidates[50].side.profileSpanCm = 22.5;
    torsoScan.candidates[49].side.profileSpanCm = 22.0;
    torsoScan.candidates[48].side.profileSpanCm = 21.5;

    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
      options: { boundaryMarginCm: 1.5 },
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.UNAVAILABLE);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.BOUNDARY_CONFOUNDED_APEX));
  });

  it('22. Front corroboration missing does not redefine or move Bust Y', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      frontStatus: 'ambiguous',
      isSingleFrontRun: false, // Front width has multiple runs / is invalid
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.ok(Math.abs(result.yCm - 126.0) < 0.5);
    assert.equal(result.frontEvidence.isSingleSupportedRun, false);
    assert.ok(result.warnings.some(w => w.includes('Front transverse width corroboration is unavailable')));
  });

  it('23. AP depth unavailable does not redefine Bust Y', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      isSideDepthQualified: false, // AP depth is unqualified
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.ok(Math.abs(result.yCm - 126.0) < 0.5);
    assert.equal(result.sideEvidence.isQualified, false);
    assert.ok(result.warnings.some(w => w.includes('Side physical AP depth qualification is unvalidated')));
  });

  it('24. candidate.isCandidateValid is NOT required for locator eligibility', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
      isCandidateValidOverride: false, // candidate.isCandidateValid = false everywhere
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.ok(Math.abs(result.yCm - 126.0) < 0.5);
  });

  it('25. Exact canonical Y is preserved while Front and Side raster row indices differ', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.equal(typeof result.rasterRow, 'number');
    assert.equal(typeof result.sideRasterRow, 'number');
    assert.notEqual(result.rasterRow, result.sideRasterRow); // Front row and Side row differ
    assert.equal(result.provenance.sliceHighlightCoordinates.yCm, result.yCm);
  });

  it('26. trunk_core_support_v0 provenance is preserved', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      supportPolicyId: 'trunk_core_support_v0',
      targetClassIds: [22, 23],
    });
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.provenance.supportPolicyId, 'trunk_core_support_v0');
    assert.deepEqual(result.provenance.targetClassIds, [22, 23]);
  });

  it('27. No lower-body transition classes (12, 13, 21) are introduced in trunk_core_support_v0', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      supportPolicyId: 'trunk_core_support_v0',
      targetClassIds: [22, 23],
    });
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.ok(!result.provenance.targetClassIds.includes(12));
    assert.ok(!result.provenance.targetClassIds.includes(13));
    assert.ok(!result.provenance.targetClassIds.includes(21));
  });

  it('28. No pointmap dependency exists', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    // Evaluate with zero pointmaps anywhere in objects
    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.semantics.is3dReconstruction, false);
    assert.equal(result.pointmap, undefined);
  });

  it('29. No normals dependency exists', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.normals, undefined);
  });

  it('30. No U -> Z semantics are introduced', () => {
    const torsoScan = createSyntheticTorsoScanReport();
    const waistReport = createSyntheticWaistReport();
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport();

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.semantics.is3dReconstruction, false);
    assert.equal(result.canonicalZ, undefined);
    assert.equal(result.zCm, undefined);
  });

  it('31. Deterministic repeated output for identical input', () => {
    const torsoScan = createSyntheticTorsoScanReport({
      shoulderY: 140.0,
      waistSuperiorCrestY: 114.0,
      bustApexY: 126.0,
    });
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 114.0 });
    const orientationReport = createSyntheticOrientationReport();
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 140.0 });

    const run1 = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });
    const run2 = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.deepEqual(run1, run2);
  });

  it('32. Runtime getters getBustApexPlaneLocalization and getBustApexPlaneLocalizationReport exist', () => {
    assert.equal(typeof getBustApexPlaneLocalization, 'function');
    assert.equal(typeof getBustApexPlaneLocalizationReport, 'function');
    // When no package loaded, returns null safely
    assert.equal(getBustApexPlaneLocalization(), null);
    assert.equal(getBustApexPlaneLocalizationReport(), null);
  });
});

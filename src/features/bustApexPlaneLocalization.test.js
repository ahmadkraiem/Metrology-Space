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

  it('33. Valid rows separated by a large metric-Y gap: smoothing does NOT cross the gap', () => {
    // Generate candidates with a 2.0 cm gap in the middle:
    // Segment 1: Y in [135.0, 130.0] cm (nominal 0.1cm spacing)
    // Gap: Y from 130.0 down to 128.0 cm (missing)
    // Segment 2: Y in [128.0, 120.0] cm with peak at 124.0 cm
    const candidates = [];
    let row = 650;
    // Segment 1 (flat slope, no peak)
    for (let y = 135.0; y >= 130.0; y -= 0.1) {
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: 85.0, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 20.0 },
      });
    }
    // Gap: 130.0 to 128.0 has no valid candidates (or multi-run)
    // Segment 2 (contains true prominence at 124.0 cm)
    for (let y = 128.0; y >= 120.0; y -= 0.1) {
      const dist = Math.abs(y - 124.0);
      const bulge = Math.max(0, 2.0 - dist * 0.7);
      const antU = 85.0 - bulge;
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 25.0 },
      });
    }

    const torsoScan = {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidates,
      provenance: { sampleSpacingCm: 0.1 },
    };
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 120.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 135.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.ok(Math.abs(result.yCm - 124.0) < 0.5);
    // Verify candidates are grouped into 2 continuous segments
    const segIndices = new Set(result.candidates.map(c => c.segmentIndex));
    assert.equal(segIndices.size, 2);
  });

  it('34. Pre-gap boundary sample cannot become a synthetic local peak because of post-gap sample', () => {
    // Monotonic downward slope before gap: Y in [135.0, 130.0]
    // Followed by gap, then flat segment Y in [128.0, 120.0]
    const candidates = [];
    let row = 650;
    for (let y = 135.0; y >= 130.0; y -= 0.1) {
      // Slope: minU goes from 90.0 down to 85.0 (moving anteriorly)
      const antU = 90.0 - (135.0 - y);
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 20.0 },
      });
    }
    // Gap 130.0 to 128.0 missing
    // Flat segment Y in [128.0, 120.0], antU = 80.0
    for (let y = 128.0; y >= 120.0; y -= 0.1) {
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: 80.0, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 25.0 },
      });
    }

    const torsoScan = {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidates,
      provenance: { sampleSpacingCm: 0.1 },
    };
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 120.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 135.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    // The pre-gap sample at Y=130.0 cm is a segment edge, NOT an interior peak
    const preGapPeak = result.peaks.find(p => Math.abs(p.yCm - 130.0) < 0.05);
    assert.equal(preGapPeak, undefined);
  });

  it('35. Post-gap boundary sample cannot become a synthetic local peak because of pre-gap sample', () => {
    // Flat segment Y in [135.0, 130.0], antU = 88.0
    // Gap 130.0 to 128.0 missing
    // Sloped segment Y in [128.0, 120.0], antU goes from 80.0 to 86.0
    const candidates = [];
    let row = 650;
    for (let y = 135.0; y >= 130.0; y -= 0.1) {
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: 88.0, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 20.0 },
      });
    }
    for (let y = 128.0; y >= 120.0; y -= 0.1) {
      const antU = 80.0 + (128.0 - y);
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 25.0 },
      });
    }

    const torsoScan = {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidates,
      provenance: { sampleSpacingCm: 0.1 },
    };
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 120.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 135.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    // The post-gap sample at Y=128.0 cm is a segment edge, NOT an interior peak
    const postGapPeak = result.peaks.find(p => Math.abs(p.yCm - 128.0) < 0.05);
    assert.equal(postGapPeak, undefined);
  });

  it('36. Peaks across separate discontinuous segments are not connected by fake saddle evidence', () => {
    // Peak 1 in Segment 1 at Y=132.0 cm (prominence 1.0 cm)
    // Gap from 130.0 to 128.0 cm
    // Peak 2 in Segment 2 at Y=125.0 cm (prominence 0.95 cm)
    const candidates = [];
    let row = 650;
    for (let y = 135.0; y >= 130.0; y -= 0.1) {
      const dist = Math.abs(y - 132.0);
      const antU = 85.0 - Math.max(0, 1.5 - dist * 0.8);
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 20.0 },
      });
    }
    // Gap 130.0 to 128.0
    for (let y = 128.0; y >= 120.0; y -= 0.1) {
      const dist = Math.abs(y - 125.0);
      const antU = 85.0 - Math.max(0, 1.5 - dist * 0.8);
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 20.0 },
      });
    }

    const torsoScan = {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidates,
      provenance: { sampleSpacingCm: 0.1 },
    };
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 120.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 135.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    // Since Peak 1 and Peak 2 are in separate segments, they cannot merge into 1 group via saddle drop
    assert.equal(result.groups.length, 2);
    // Since both peaks are of comparable prominence, ambiguity is properly flagged
    assert.equal(result.status, BUST_APEX_PLANE_STATUS.AMBIGUOUS);
    assert.ok(result.blockers.includes(BUST_APEX_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES));
  });

  it('37. Broadness/support counts do not cross the metric gap', () => {
    // Peak at Y=131.0 (Segment 1, only 2 rows below peak before gap at 130.0)
    const candidates = [];
    let row = 650;
    for (let y = 135.0; y >= 130.0; y -= 0.1) {
      const isPeak = Math.abs(y - 131.0) < 0.05;
      const antU = isPeak ? 80.0 : 83.0;
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 20.0 },
      });
    }
    // Gap 130.0 to 125.0
    // Segment 2 has low U=80.0 as well, but across the gap
    for (let y = 125.0; y >= 120.0; y -= 0.1) {
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: 80.0, maxUcm: 105.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 25.0 },
      });
    }

    const torsoScan = {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidates,
      provenance: { sampleSpacingCm: 0.1 },
    };
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 120.0 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 135.0 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    const peak131 = result.peaks.find(p => Math.abs(p.yCm - 131.0) < 0.05);
    if (peak131) {
      // Support rows inside Segment 1 cannot exceed Segment 1 length (51 rows)
      assert.ok(peak131.broadnessScore <= 51);
    }
  });

  it('38. Regression fixture reproducing the real-package shape: 1.6cm multi-run gap with true lower apex', () => {
    // Upper Segment: Y in [132.85, 128.65] cm (sloping forward from 88.0 to 85.1)
    // Multi-run Gap: Y in (128.65, 127.05) cm (rows with runCount=2)
    // Lower Segment: Y in [127.05, 120.65] cm with true apex at 123.85 cm
    const candidates = [];
    let row = 670;
    for (let y = 132.85; y >= 128.65; y -= 0.1) {
      const yNorm = (132.85 - y) / (132.85 - 128.65);
      const antU = 88.0 - yNorm * 2.9; // 88.0 down to 85.1
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 103.0, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 18.0 },
      });
    }

    // Gap rows: runCount = 2 (multi-run)
    for (let y = 128.55; y >= 127.15; y -= 0.1) {
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.0, isSingleSupportedRun: true },
        side: { status: 'ambiguous', runCount: 2, minUcm: null, maxUcm: null, isSingleSupportedRun: false, isQualified: false },
      });
    }

    // Lower segment: 127.05 down to 120.65 with true breast protrusion at 123.85 cm (antU = 80.1 cm)
    for (let y = 127.05; y >= 120.65; y -= 0.1) {
      const distFromApex = Math.abs(y - 123.85);
      const apexBump = Math.max(0, 1.8 - distFromApex * 0.6);
      const baseAntU = 83.0 - ((127.05 - y) / (127.05 - 120.65)) * 4.6; // 83.0 to 78.4
      const antU = baseAntU - apexBump;
      candidates.push({
        yCm: Number(y.toFixed(2)),
        rasterRow: row++,
        sideRasterRow: row,
        front: { status: 'valid', runCount: 1, widthCm: 34.4, isSingleSupportedRun: true },
        side: { status: 'valid', runCount: 1, minUcm: antU, maxUcm: 109.8, isSingleSupportedRun: true, isQualified: true, qualifiedApDepthCm: 29.5 },
      });
    }

    const torsoScan = {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidates,
      provenance: { sampleSpacingCm: 0.1 },
    };
    const waistReport = createSyntheticWaistReport({ superiorCrestY: 120.65 });
    const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
    const levelsReport = createSyntheticLevelsReport({ shoulderY: 132.85 });

    const result = evaluateBustApexPlaneLocalization({
      torsoScanReport: torsoScan,
      naturalWaistReport: waistReport,
      sideOrientationReport: orientationReport,
      levelsReport,
    });

    assert.equal(result.status, BUST_APEX_PLANE_STATUS.READY);
    assert.ok(Math.abs(result.yCm - 123.85) < 0.5);
    // Verify no false competing peak at Y=128.65 cm
    const falsePeak = result.peaks.find(p => Math.abs(p.yCm - 128.65) < 0.1);
    assert.equal(falsePeak, undefined);
    assert.equal(result.groups.length, 1);
  });
});

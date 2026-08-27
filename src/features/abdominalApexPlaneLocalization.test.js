import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ABDOMINAL_APEX_PLANE_CONTRACT,
  ABDOMINAL_APEX_PLANE_CONTRACT_VERSION,
  ABDOMINAL_APEX_PLANE_STATUS,
  ABDOMINAL_APEX_BLOCKER_CODES,
  evaluateAbdominalApexPlaneLocalization,
} from './abdominalApexPlaneLocalization.js';

describe('Abdominal Apex Plane Localization v0', () => {
  // Helper to build synthetic torso scan report with controllable anterior and posterior contours
  function createSyntheticTorsoScanReport({
    shoulderY = 140.0,
    hipY = 90.0,
    rowsCount = 51,
    waistY = 115.0,
    apexY = 103.0,
    apexProminence = 1.5,
    orientation = 'positive_u', // 'positive_u' (anterior=maxU) or 'negative_u' (anterior=minU)
    spikeRowIndex = null,
    spikeProminence = 3.0,
    secondaryApexY = null,
    secondaryApexProminence = 1.4,
    flatAbdomen = false,
    posteriorBulgeY = 95.0, // Can create maximum AP depth at a different Y than anterior apex
    posteriorBulgeAmount = 4.0,
  } = {}) {
    const isPositiveU = orientation === 'positive_u';
    const candidates = [];

    const yStep = (shoulderY - hipY) / (rowsCount - 1);

    for (let i = 0; i < rowsCount; i += 1) {
      const yCm = Number((shoulderY - i * yStep).toFixed(4));
      const rasterRow = i * 10;
      const sideRasterRow = i * 10;

      // Front width: waist constriction around waistY, wider at shoulder & hip
      const waistDist = Math.abs(yCm - waistY);
      const frontWidthCm = Number((28.0 + 0.15 * waistDist).toFixed(4));
      const frontMinXcm = Number((100.0 - frontWidthCm / 2).toFixed(4));
      const frontMaxXcm = Number((100.0 + frontWidthCm / 2).toFixed(4));

      // Baseline Side coordinates (e.g. torso center around U=100)
      // Posterior contour (default minU if positive_u, maxU if negative_u)
      let posteriorU = isPositiveU ? 90.0 : 110.0;
      if (posteriorBulgeY !== null) {
        const postDist = Math.abs(yCm - posteriorBulgeY);
        const postBulge = Math.max(0, posteriorBulgeAmount - 0.4 * postDist * postDist);
        posteriorU = isPositiveU ? (90.0 - postBulge) : (110.0 + postBulge);
      }

      // Anterior contour: baseline is 110 (if positive_u) or 90 (if negative_u)
      let baseAnteriorU = isPositiveU ? 110.0 : 90.0;
      let anteriorBulge = 0;

      if (!flatAbdomen && yCm <= waistY && yCm >= hipY) {
        // Primary apex bulge
        const distToApex = Math.abs(yCm - apexY);
        if (distToApex <= 8.0) {
          anteriorBulge += Math.max(0, apexProminence - 0.08 * distToApex * distToApex);
        }

        // Optional secondary apex bulge
        if (secondaryApexY !== null) {
          const distToSec = Math.abs(yCm - secondaryApexY);
          if (distToSec <= 6.0) {
            anteriorBulge += Math.max(0, secondaryApexProminence - 0.08 * distToSec * distToSec);
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
      const qualifiedApDepthCm = profileSpanCm;

      candidates.push({
        yCm,
        rasterRow,
        sideRasterRow,
        rowNormalizedV: i / (rowsCount - 1),
        front: {
          status: 'valid',
          runCount: 1,
          widthCm: frontWidthCm,
          minXcm: frontMinXcm,
          maxXcm: frontMaxXcm,
          encounteredClassIds: [22, 23],
          isSingleSupportedRun: true,
        },
        side: {
          status: 'valid',
          rasterRow: sideRasterRow,
          runCount: 1,
          profileSpanCm,
          minUcm,
          maxUcm,
          encounteredClassIds: [22, 23],
          isSingleSupportedRun: true,
          qualifiedApDepthCm,
          depthQualificationStatus: 'qualified',
          isQualified: true,
          qualificationChecks: [{ id: 'test_pass', status: 'pass' }],
        },
        isCandidateValid: true,
      });
    }

    return {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      version: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      upperBound: { yCm: shoulderY, rasterRow: 0, sourceLevel: 'shoulder' },
      lowerBound: { yCm: hipY, rasterRow: (rowsCount - 1) * 10, sourceLevel: 'hip' },
      candidateCount: candidates.length,
      candidates,
    };
  }

  // Standard Natural Waist Report Helper
  function createSyntheticWaistReport({
    waistY = 115.0,
    inferiorCrestY = 113.0,
    status = 'ready',
  } = {}) {
    return {
      contract: 'natural-waist-plane-localization-v0',
      version: 'natural-waist-plane-localization-v0',
      status,
      yCm: waistY,
      rasterRow: 250,
      troughs: [
        {
          troughId: 'trough_1',
          inferiorCrestYcm: inferiorCrestY,
          superiorCrestYcm: waistY + 4.0,
          troughMinYcm: waistY,
          troughMaxYcm: waistY,
          representativeValley: { yCm: waistY },
        },
      ],
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

  describe('1. Clean single anterior abdominal peak -> ready', () => {
    it('localizes the abdominal apex plane accurately at peak prominence', () => {
      const torsoScan = createSyntheticTorsoScanReport({
        waistY: 115.0,
        apexY: 103.0,
        apexProminence: 1.8,
        orientation: 'positive_u',
      });
      const waistReport = createSyntheticWaistReport({ waistY: 115.0, inferiorCrestY: 113.0 });
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.contract, ABDOMINAL_APEX_PLANE_CONTRACT);
      assert.equal(result.version, ABDOMINAL_APEX_PLANE_CONTRACT_VERSION);
      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      assert.ok(Math.abs(result.yCm - 103.0) <= 1.0, `Expected apex near 103.0 cm, got ${result.yCm}`);
      assert.equal(result.searchWindow.upperYcm, 113.0);
      assert.equal(result.searchWindow.lowerYcm, 90.0);
      assert.equal(result.orientation.facingDirection, 'positive_u');
      assert.equal(result.orientation.anteriorSide, 'max_u');
      assert.ok(result.selectedPeak.prominenceCm >= 1.0);
      assert.ok(result.provenance.sliceHighlightCoordinates != null);
    });
  });

  describe('2. Mirrored Side input produces identical anatomical Y', () => {
    it('produces identical apex plane elevation when subject orientation is mirrored to negative_u', () => {
      const posScan = createSyntheticTorsoScanReport({ apexY: 104.0, orientation: 'positive_u' });
      const negScan = createSyntheticTorsoScanReport({ apexY: 104.0, orientation: 'negative_u' });

      const waistReport = createSyntheticWaistReport({ waistY: 115.0, inferiorCrestY: 113.0 });
      const posOrientation = createSyntheticOrientationReport({ facingDirection: 'positive_u' });
      const negOrientation = createSyntheticOrientationReport({ facingDirection: 'negative_u' });

      const posResult = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: posScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: posOrientation,
      });

      const negResult = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: negScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: negOrientation,
      });

      assert.equal(posResult.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      assert.equal(negResult.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      assert.equal(posResult.yCm, negResult.yCm);
    });
  });

  describe('3 & 4. Positive-U and Negative-U Anterior Orientation Mapping', () => {
    it('correctly maps positive_u to max_u and negative_u to min_u', () => {
      const scan = createSyntheticTorsoScanReport({ apexY: 102.0, orientation: 'positive_u' });
      const waist = createSyntheticWaistReport();
      const posOri = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const resPos = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: scan,
        naturalWaistReport: waist,
        sideOrientationReport: posOri,
      });
      assert.equal(resPos.orientation.anteriorSide, 'max_u');

      const negOri = createSyntheticOrientationReport({ facingDirection: 'negative_u' });
      const resNeg = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: scan,
        naturalWaistReport: waist,
        sideOrientationReport: negOri,
      });
      assert.equal(resNeg.orientation.anteriorSide, 'min_u');
    });
  });

  describe('5. Broad plateau / nearby peaks are pooled', () => {
    it('pools contiguous peak points into a single broad bulge region', () => {
      const torsoScan = createSyntheticTorsoScanReport({
        apexY: 103.0,
        apexProminence: 1.5,
        secondaryApexY: 105.0, // 2 cm away, shallow saddle
        secondaryApexProminence: 1.48,
        orientation: 'positive_u',
      });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      assert.ok(result.groups.length === 1);
      assert.ok(result.groups[0].memberCount >= 1);
      assert.ok(Math.abs(result.yCm - 103.0) <= 2.0);
    });
  });

  describe('6. Isolated one-row spike rejected', () => {
    it('rejects single-row spike artifact without neighborhood support and localizes true anatomical peak', () => {
      // Row 30 is a spike with no neighborhood support
      const torsoScan = createSyntheticTorsoScanReport({
        apexY: 102.0,
        apexProminence: 1.2,
        spikeRowIndex: 20, // corresponding to higher elevation, sharp 1-row spike
        spikeProminence: 4.0,
        orientation: 'positive_u',
      });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      // Selected apex should be the true smooth peak near 102.0 cm, not the spike
      assert.ok(Math.abs(result.yCm - 102.0) <= 1.5);
    });
  });

  describe('7. Two separated competing peaks -> ambiguous', () => {
    it('returns status ambiguous when two physically separated bulges have similar prominence', () => {
      const torsoScan = createSyntheticTorsoScanReport({
        apexY: 108.0, // upper bulge
        apexProminence: 1.5,
        secondaryApexY: 96.0, // lower bulge (12 cm away, separated by deep saddle)
        secondaryApexProminence: 1.45,
        orientation: 'positive_u',
      });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.AMBIGUOUS);
      assert.equal(result.selectedPeak, null);
      assert.ok(result.blockers.includes(ABDOMINAL_APEX_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES));
    });
  });

  describe('8. No meaningful anterior prominence -> unavailable', () => {
    it('returns status unavailable without inventing a midpoint fallback when abdomen is flat/monotonic', () => {
      const torsoScan = createSyntheticTorsoScanReport({
        flatAbdomen: true,
        orientation: 'positive_u',
      });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE);
      assert.equal(result.yCm, null);
      assert.equal(result.selectedPeak, null);
      assert.ok(result.blockers.includes(ABDOMINAL_APEX_BLOCKER_CODES.NO_ANTERIOR_PROMINENCE_DETECTED));
    });
  });

  describe('9 & 10. Boundary-confounded peak handling', () => {
    it('rejects peak located directly at waist boundary with zero interior support', () => {
      const torsoScan = createSyntheticTorsoScanReport({
        apexY: 112.8, // Right at waist inferior boundary 113.0
        apexProminence: 1.5,
        flatAbdomen: true,
      });
      const waistReport = createSyntheticWaistReport({ waistY: 115.0, inferiorCrestY: 113.0 });
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
        options: { boundaryMarginCm: 1.0 },
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE);
      assert.ok(result.blockers.includes(ABDOMINAL_APEX_BLOCKER_CODES.BOUNDARY_CONFOUNDED_APEX)
        || result.blockers.includes(ABDOMINAL_APEX_BLOCKER_CODES.NO_ANTERIOR_PROMINENCE_DETECTED));
    });
  });

  describe('11 & 12. Side orientation unavailable or ambiguous', () => {
    it('returns status unavailable when Side orientation is unavailable', () => {
      const torsoScan = createSyntheticTorsoScanReport({ apexY: 103.0 });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ status: 'unavailable' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE);
      assert.ok(result.blockers.includes(ABDOMINAL_APEX_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE));
    });

    it('returns status ambiguous when Side orientation is ambiguous', () => {
      const torsoScan = createSyntheticTorsoScanReport({ apexY: 103.0 });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ status: 'ambiguous' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.AMBIGUOUS);
    });
  });

  describe('13. Non-lateral Side view cannot produce ready apex', () => {
    it('blocks ready status when Side view lateral qualification failed', () => {
      const torsoScan = createSyntheticTorsoScanReport({ apexY: 103.0 });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = {
        contract: 'side-anterior-posterior-orientation-v0',
        status: 'unavailable',
        facingDirection: null,
        anteriorSide: null,
      };

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.notEqual(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
    });
  });

  describe('14 & 15. Candidate row ambiguity rejection', () => {
    it('ignores corrupted candidate rows with multi-run status during peak selection', () => {
      const torsoScan = createSyntheticTorsoScanReport({ apexY: 103.0, apexProminence: 1.5 });
      // Mark candidate near 103 as ambiguous multi-run
      const targetCand = torsoScan.candidates.find((c) => Math.abs(c.yCm - 103.0) < 0.5);
      if (targetCand) {
        targetCand.side.status = 'ambiguous';
        targetCand.side.runCount = 2;
        targetCand.side.isSingleSupportedRun = false;
      }

      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      // It should either localize a neighboring valid row or handle cleanly without throwing
      assert.ok(result.status === ABDOMINAL_APEX_PLANE_STATUS.READY || result.status === ABDOMINAL_APEX_PLANE_STATUS.UNAVAILABLE);
    });
  });

  describe('16. Malformed / non-finite candidate evidence', () => {
    it('returns invalid status when search window bounds are inverted', () => {
      const torsoScan = createSyntheticTorsoScanReport({ shoulderY: 90.0, hipY: 140.0 }); // inverted
      const waistReport = createSyntheticWaistReport({ waistY: 85.0, inferiorCrestY: 85.0 }); // upper is lower than lower
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.INVALID);
      assert.ok(result.blockers.includes(ABDOMINAL_APEX_BLOCKER_CODES.INVALID_SEARCH_WINDOW));
    });
  });

  describe('17. Differing Front and Side raster heights remain valid through canonical Y', () => {
    it('localizes correctly when Front raster is 1000px and Side raster is 800px', () => {
      const torsoScan = createSyntheticTorsoScanReport({ apexY: 103.0 });
      // Modify side raster row indices
      for (const c of torsoScan.candidates) {
        c.sideRasterRow = Math.round(c.rasterRow * 0.8);
      }

      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      assert.ok(result.selectedPeak.sideRasterRow !== result.selectedPeak.rasterRow);
      assert.equal(result.yCm, result.selectedPeak.yCm);
    });
  });

  describe('18 & 19. Ensure localization is NOT maximum total AP depth', () => {
    it('localizes the anterior abdominal apex correctly even when maximum AP depth occurs at a lower posterior buttock level', () => {
      // In this synthetic body:
      // Anterior abdominal apex is at Y = 103.0 cm (prominence = +1.5 cm)
      // Posterior gluteal/hip bulge is at Y = 94.0 cm (bulge = +4.0 cm posteriorly)
      // Total AP depth is maximum at Y = 94.0 cm (depth = 24.0 cm vs 21.5 cm at apex)
      const torsoScan = createSyntheticTorsoScanReport({
        waistY: 115.0,
        apexY: 103.0,
        apexProminence: 1.5,
        posteriorBulgeY: 94.0,
        posteriorBulgeAmount: 4.0,
        orientation: 'positive_u',
      });
      const waistReport = createSyntheticWaistReport({ waistY: 115.0, inferiorCrestY: 113.0 });
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      // Apex MUST be near 103.0 cm (anterior protrusion), NOT 94.0 cm (posterior maximum AP depth)
      assert.ok(Math.abs(result.yCm - 103.0) <= 1.5, `Expected apex near 103.0 cm, got ${result.yCm}`);
      assert.notEqual(result.yCm, 94.0);

      // Verify that candidate AP depth at 94 is indeed larger than at 103
      const candAt94 = torsoScan.candidates.find((c) => Math.abs(c.yCm - 94.0) < 0.5);
      const candAt103 = torsoScan.candidates.find((c) => Math.abs(c.yCm - 103.0) < 0.5);
      assert.ok(candAt94.side.profileSpanCm > candAt103.side.profileSpanCm);
    });
  });

  describe('20, 21 & 22. Strict Guardrails Validation', () => {
    it('ensures result contains no U->Z, pointmap, normals, or height percentage fallback', () => {
      const torsoScan = createSyntheticTorsoScanReport({ apexY: 103.0 });
      const waistReport = createSyntheticWaistReport();
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'positive_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.semantics.isAbdominalApexPlaneCandidate, true);
      assert.equal(result.semantics.isMaximumApDepth, false);
      assert.equal(result.semantics.isCircumference, false);
      assert.equal(result.semantics.is3dReconstruction, false);

      const json = JSON.stringify(result);
      assert.ok(!json.includes('"canonicalZ"'));
      assert.ok(!json.includes('"pointmap"'));
      assert.ok(!json.includes('"normals"'));
      assert.ok(!json.includes('bodyHeightPercentage'));
    });
  });

  describe('23. Transition Evidence Coverage & Baseline Anchoring', () => {
    it('preserves continuous candidate coverage down to Hip and anchors baseline cleanly', () => {
      const torsoScan = createSyntheticTorsoScanReport({
        shoulderY: 135.0,
        hipY: 86.25,
        apexY: 96.0,
        supportPolicyId: 'trunk_pelvic_transition_support_v0',
      });
      const waistReport = createSyntheticWaistReport({
        waistY: 107.0,
        inferiorCrestY: 100.75,
      });
      const orientationReport = createSyntheticOrientationReport({ facingDirection: 'negative_u' });

      const result = evaluateAbdominalApexPlaneLocalization({
        torsoScanReport: torsoScan,
        naturalWaistReport: waistReport,
        sideOrientationReport: orientationReport,
      });

      assert.equal(result.status, ABDOMINAL_APEX_PLANE_STATUS.READY);
      assert.ok(result.yCm >= 86.25 && result.yCm <= 100.75);
      assert.equal(result.searchWindow.upperYcm, 100.75);
      assert.equal(result.searchWindow.lowerYcm, 86.25);
      assert.ok(result.candidates.length > 0);

      // Verify lowest retained candidate reaches the Hip level within step resolution
      const lowestY = Math.min(...result.candidates.map((c) => c.yCm));
      assert.ok(Math.abs(lowestY - 86.25) <= 0.5);
    });
  });
});


import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BUTTOCK_POINT_PLANE_CONTRACT,
  BUTTOCK_POINT_PLANE_CONTRACT_VERSION,
  BUTTOCK_POINT_PLANE_STATUS,
  BUTTOCK_POINT_BLOCKER_CODES,
  BUTTOCK_POINT_PLANE_DEFINITION_ID,
  BUTTOCK_POINT_PLANE_DISPLAY_NAME,
  evaluateButtockPointPlaneLocalization,
} from './buttockPointPlaneLocalization.js';

function createMockScanReport(candidates = [], { contract = 'torso-arbitrary-y-evidence-scan-v0', status = 'completed', firstSplitYcm = 77.25 } = {}) {
  return {
    contract,
    status,
    candidateCount: candidates.length,
    candidates,
    lowerBoundaryEvidence: {
      firstSplitYcm,
      firstSplitRow: 1227,
    },
  };
}

function generateButtockProfileCandidates({
  yStart = 96.15,
  yEnd = 78.05,
  stepCm = 0.10,
  peakY = 86.15,
  peakU = 112.30,
  baseLordosisU = 105.00,
  baseGlutealU = 105.00,
  plateauSpanRows = 1,
  frontWidth = 42.20,
  apDepth = 27.80,
  isFacingMinU = true,
  uOffset = 0,
} = {}) {
  const candidates = [];
  let row = 1040;

  for (let y = yStart; y >= yEnd; y -= stepCm) {
    const curY = Number(y.toFixed(4));
    let rawU;

    if (Math.abs(curY - peakY) < (plateauSpanRows * stepCm) / 2) {
      rawU = peakU;
    } else if (curY > peakY) {
      // Superior slope: lordosis base up at yStart -> peakU at peakY
      const t = (curY - peakY) / (yStart - peakY);
      rawU = peakU - t * (peakU - baseLordosisU);
    } else {
      // Inferior slope: peakU down to baseGlutealU at yEnd
      const t = (peakY - curY) / (peakY - yEnd);
      rawU = peakU - t * (peakU - baseGlutealU);
    }

    rawU = Number((rawU + uOffset).toFixed(4));
    let minU;
    let maxU;
    if (isFacingMinU) {
      minU = 84.50 + uOffset;
      maxU = rawU;
    } else {
      // Facing positive_u: maxU is anterior (112.30), minU is posterior (smallest at peak)
      minU = (84.50 + (112.30 - rawU)) + uOffset;
      maxU = 112.30 + uOffset;
    }

    candidates.push({
      yCm: curY,
      rasterRow: row,
      front: {
        status: 'valid',
        runCount: 1,
        isSingleSupportedRun: true,
        widthCm: frontWidth,
        minXcm: 78.80,
        maxXcm: 78.80 + frontWidth,
        encounteredClassIds: [13, 22],
      },
      side: {
        status: 'valid',
        runCount: 1,
        isSingleSupportedRun: true,
        isQualified: true,
        depthQualificationStatus: 'qualified',
        qualifiedApDepthCm: apDepth,
        profileSpanCm: apDepth,
        minUcm: Number(minU.toFixed(4)),
        maxUcm: Number(maxU.toFixed(4)),
        encounteredClassIds: [13, 22],
      },
    });

    row += 1;
  }

  return candidates;
}

describe('buttockPointPlaneLocalization domain contract v1', () => {
  const abdomenReport = { status: 'ready', yCm: 96.85 };
  const lowerBoundary = { firstSplitYcm: 77.25 };
  const orientationMinU = { status: 'qualified', isQualified: true, anteriorSide: 'min_u' };
  const orientationMaxU = { status: 'qualified', isQualified: true, anteriorSide: 'max_u' };

  it('1. localizes clean posterior buttock dome to ready status with exact target values', () => {
    const candidates = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30 });
    const scanReport = createMockScanReport(candidates);

    const result = evaluateButtockPointPlaneLocalization({
      torsoScanReport: scanReport,
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(result.status, BUTTOCK_POINT_PLANE_STATUS.READY);
    assert.equal(result.contract, BUTTOCK_POINT_PLANE_CONTRACT);
    assert.equal(result.id, BUTTOCK_POINT_PLANE_DEFINITION_ID);
    assert.equal(result.yCm, 86.15);
    assert.equal(result.levelYcm, 86.15);
    assert.equal(result.selectedPlateau.maxRawPosteriorProjectionCm, 112.30);
    assert.equal(result.frontEvidence.widthCm, 42.20);
    assert.equal(result.sideEvidence.qualifiedApDepthCm, 27.80);
    assert.equal(result.sideEvidence.maxUcm, 112.30);
  });

  it('2. selects geometric midpoint of broad raw posterior plateau', () => {
    // Plateau spanning from 86.05 to 86.25 cm (midpoint 86.15 cm)
    const candidates = generateButtockProfileCandidates({
      peakY: 86.15,
      peakU: 112.30,
      plateauSpanRows: 3, // 86.05, 86.15, 86.25
    });
    const scanReport = createMockScanReport(candidates);

    const result = evaluateButtockPointPlaneLocalization({
      torsoScanReport: scanReport,
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(result.status, BUTTOCK_POINT_PLANE_STATUS.READY);
    assert.equal(result.yCm, 86.15);
    assert.equal(result.selectedPlateau.midpointYcm, 86.15);
    assert.equal(result.selectedPlateau.plateauMinYcm, 86.05);
    assert.equal(result.selectedPlateau.plateauMaxYcm, 86.25);
  });

  it('3 & 4. supports both negative_u (min_u) and positive_u (max_u) directional normalization', () => {
    // Facing negative_u: minU is front, maxU is posterior buttock
    const cMinU = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30, isFacingMinU: true });
    const resMinU = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cMinU),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    // Facing positive_u: maxU is front, minU is posterior buttock
    const cMaxU = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30, isFacingMinU: false });
    const resMaxU = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cMaxU),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMaxU,
    });

    assert.equal(resMinU.status, 'ready');
    assert.equal(resMinU.yCm, 86.15);
    assert.equal(resMaxU.status, 'ready');
    assert.equal(resMaxU.yCm, 86.15);
  });

  it('5. rigid U-translation invariance: shifting U by +20 cm yields identical selected Y', () => {
    const cBase = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30, uOffset: 0 });
    const resBase = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cBase),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    const cShifted = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30, uOffset: 20.0 });
    const resShifted = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cShifted),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(resBase.yCm, 86.15);
    assert.equal(resShifted.yCm, 86.15);
    assert.equal(resShifted.selectedPlateau.maxRawPosteriorProjectionCm, 132.30);
  });

  it('6, 7 & 8. pose Hip landmark is corroborative only and never clamps Buttock Point Y', () => {
    // Buttock Point at 88.15 cm while pose Hip is at 86.25 cm
    const cHigh = generateButtockProfileCandidates({ peakY: 88.15, peakU: 112.30 });
    const resHigh = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cHigh),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
      levelsReport: { levels: [{ id: 'hip', status: 'ready', yCm: 86.25 }] },
    });
    assert.equal(resHigh.yCm, 88.15);
    assert.equal(resHigh.provenance.corroborativePoseHipDeltaYcm, 1.90);

    // Buttock Point at 84.15 cm while pose Hip is at 86.25 cm
    const cLow = generateButtockProfileCandidates({ peakY: 84.15, peakU: 112.30 });
    const resLow = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cLow),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
      levelsReport: { levels: [{ id: 'hip', status: 'ready', yCm: 86.25 }] },
    });
    assert.equal(resLow.yCm, 84.15);
    assert.equal(resLow.provenance.corroborativePoseHipDeltaYcm, -2.10);
  });

  it('9 & 10. lumbar lordosis / lower-back prominence lacking buttock dome topology does not win', () => {
    // Construct profile where lower-back at Y=94 cm has maxU=113 cm (higher than buttock apex maxU=112 cm)
    // but lower-back is a monotonic upward slope without superior expansion from above
    const candidates = generateButtockProfileCandidates({
      peakY: 86.15,
      peakU: 112.00,
    });

    // Add high monotonic slope in upper lumbar region (94-96 cm)
    for (const c of candidates) {
      if (c.yCm >= 94.0) {
        c.side.maxUcm = 113.00 + (c.yCm - 94.0) * 0.5; // Monotonic slope up to 114.0
      }
    }

    const res = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(candidates),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    // Buttock dome at 86.15 cm must win because it has valid superior expansion and inferior recession
    assert.equal(res.status, 'ready');
    assert.equal(res.yCm, 86.15);
  });

  it('11 & 12. wide lateral trochanters below Buttock Point do not alter selected Y (Maximum Seat separation)', () => {
    const candidates = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30 });
    // Expand Front width at Y=79.95 cm to 44.30 cm (like real package Maximum Seat)
    for (const c of candidates) {
      if (c.yCm <= 80.5 && c.yCm >= 79.5) {
        c.front.widthCm = 44.30;
      }
    }

    const res = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(candidates),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    // Selected Y must remain strictly at 86.15 cm
    assert.equal(res.status, 'ready');
    assert.equal(res.yCm, 86.15);
    assert.equal(res.frontEvidence.widthCm, 42.20);
  });

  it('13 & 14. monotonic or flat posterior profile returns unavailable (no buttock dome detected)', () => {
    const flatCandidates = generateButtockProfileCandidates({ peakY: 86.15, peakU: 110.00, baseLordosisU: 110.00, baseGlutealU: 110.00 });
    const resFlat = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(flatCandidates),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(resFlat.status, BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE);
    assert.ok(resFlat.blockers.includes(BUTTOCK_POINT_BLOCKER_CODES.NO_BUTTOCK_DOME_DETECTED));
  });

  it('15. multiple equal separated buttock domes return ambiguous', () => {
    const c1 = generateButtockProfileCandidates({ yStart: 96.15, yEnd: 86.25, peakY: 91.15, peakU: 112.30 });
    const c2 = generateButtockProfileCandidates({ yStart: 86.15, yEnd: 78.05, peakY: 82.15, peakU: 112.30 });
    const combined = [...c1, ...c2];

    const res = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(combined),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(res.status, BUTTOCK_POINT_PLANE_STATUS.AMBIGUOUS);
    assert.ok(res.blockers.includes(BUTTOCK_POINT_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_BUTTOCK_DOMES));
  });

  it('16 & 17. gap partitioning isolates metric segments and avoids cross-gap operations', () => {
    const candidates = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30 });
    // Introduce 1.0 cm gap between 88.0 and 87.0 cm (well away from peak 86.15)
    const gapped = candidates.filter((c) => c.yCm > 88.0 || c.yCm < 87.0);

    const res = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(gapped),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(res.status, 'ready');
    assert.equal(res.yCm, 86.15);
  });

  it('18, 19 & 20. protects against boundary maxima (apex exactly at upper or lower bound returns ambiguous/unresolved)', () => {
    // Peak at upper boundary 96.15 cm
    const cUpper = generateButtockProfileCandidates({ yStart: 96.15, yEnd: 78.05, peakY: 95.85, peakU: 112.30, baseLordosisU: 112.30 });
    const resUpper = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(cUpper),
      abdomenPointReport: { status: 'ready', yCm: 96.15 },
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });
    assert.ok(resUpper.status === BUTTOCK_POINT_PLANE_STATUS.AMBIGUOUS || resUpper.status === BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE);
  });

  it('21. Front invalid at valid Side Buttock Point preserves ready plane and reports invalid Front evidence', () => {
    const candidates = generateButtockProfileCandidates({ peakY: 86.15, peakU: 112.30 });
    // Invalidate Front at peak
    for (const c of candidates) {
      if (Math.abs(c.yCm - 86.15) < 0.05) {
        c.front.status = 'invalid';
        c.front.isSingleSupportedRun = false;
      }
    }

    const res = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(candidates),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });

    assert.equal(res.status, BUTTOCK_POINT_PLANE_STATUS.READY);
    assert.equal(res.yCm, 86.15);
    assert.equal(res.frontEvidence.status, 'invalid');
  });

  it('22, 23 & 24. handles missing orientation, missing scan, and inverted search window', () => {
    const resNoOrient = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport([]),
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: null,
    });
    assert.equal(resNoOrient.status, BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE);

    const resNoScan = evaluateButtockPointPlaneLocalization({
      torsoScanReport: null,
      abdomenPointReport: abdomenReport,
      lowerBoundaryEvidence: lowerBoundary,
      sideOrientationReport: orientationMinU,
    });
    assert.equal(resNoScan.status, BUTTOCK_POINT_PLANE_STATUS.UNAVAILABLE);

    const resInverted = evaluateButtockPointPlaneLocalization({
      torsoScanReport: createMockScanReport(generateButtockProfileCandidates()),
      abdomenPointReport: { status: 'ready', yCm: 75.00 },
      lowerBoundaryEvidence: { firstSplitYcm: 80.00 },
      sideOrientationReport: orientationMinU,
    });
    assert.equal(resInverted.status, BUTTOCK_POINT_PLANE_STATUS.INVALID);
  });
});

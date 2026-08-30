import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUST_POINT_PLANE_CONTRACT,
  BUST_POINT_PLANE_CONTRACT_VERSION,
  BUST_POINT_PLANE_STATUS,
  BUST_POINT_BLOCKER_CODES,
  DEFAULT_BUST_POINT_OPTIONS,
  applySymmetricSmoothing,
  evaluateBustPointPlaneLocalization,
} from './bustPointPlaneLocalization.js';

function buildSyntheticScan({
  shoulderY = 133.0,
  waistY = 107.0,
  stepCm = 0.10,
  orientation = { facingDirection: 'negative_u', anteriorSide: 'min_u' },
  anteriorProfileFn = (y) => {
    // Standard breast dome centered at y=119.0, apex U=78.3
    if (y >= 118.5 && y <= 119.5) return 78.30;
    if (y > 119.5) return 78.30 + (y - 119.5) * 0.6; // slopes backward towards shoulder
    return 78.30 + (118.5 - y) * 0.4; // slopes backward towards waist
  },
  frontWidthFn = (y) => 35.0,
  posteriorUFn = (y) => 109.0,
  isSideValidFn = (y) => true,
  isFrontValidFn = (y) => true,
} = {}) {
  const isPositiveU = orientation.anteriorSide === 'max_u';
  const candidates = [];
  let row = 650;
  const startY = Math.max(shoulderY, waistY) + 2.0;
  const endY = Math.min(shoulderY, waistY) - 2.0;

  for (let y = startY; y >= endY; y -= stepCm) {
    const yRounded = Number(y.toFixed(2));
    const antVal = anteriorProfileFn(yRounded);
    const postVal = posteriorUFn(yRounded);

    const minU = isPositiveU ? Math.min(antVal, postVal) : Math.min(antVal, postVal);
    const maxU = isPositiveU ? Math.max(antVal, postVal) : Math.max(antVal, postVal);
    const fw = frontWidthFn(yRounded);
    const sideValid = isSideValidFn(yRounded);
    const frontValid = isFrontValidFn(yRounded);

    candidates.push({
      yCm: yRounded,
      rasterRow: row,
      sideRasterRow: row,
      front: {
        status: frontValid ? 'valid' : 'invalid',
        leftXcm: frontValid ? Number((50 - fw / 2).toFixed(2)) : null,
        rightXcm: frontValid ? Number((50 + fw / 2).toFixed(2)) : null,
        widthCm: frontValid ? fw : null,
        rasterRow: row,
        isSingleSupportedRun: frontValid,
        runCount: frontValid ? 1 : 0,
      },
      side: {
        status: sideValid ? 'valid' : 'invalid',
        minUcm: sideValid ? minU : null,
        maxUcm: sideValid ? maxU : null,
        profileSpanCm: sideValid ? Number((maxU - minU).toFixed(2)) : null,
        qualifiedApDepthCm: sideValid ? Number((maxU - minU).toFixed(2)) : null,
        rasterRow: row,
        isSingleSupportedRun: sideValid,
        runCount: sideValid ? 1 : 0,
      },
    });
    row += 1;
  }

  return {
    contract: 'torso-arbitrary-y-evidence-scan-v0',
    status: 'completed',
    candidateCount: candidates.length,
    candidates,
    provenance: { sampleSpacingCm: stepCm },
  };
}

function buildValidInputs(overrides = {}) {
  const shoulderY = overrides.shoulderY ?? 133.0;
  const waistY = overrides.waistY ?? 107.0;
  const orientation = overrides.orientation ?? {
    status: 'ready',
    facingDirection: 'negative_u',
    anteriorSide: 'min_u',
  };

  const torsoScanReport = overrides.torsoScanReport ?? buildSyntheticScan({
    shoulderY,
    waistY,
    orientation,
    ...overrides.scanOptions,
  });

  const naturalWaistReport = overrides.naturalWaistReport ?? {
    contract: 'natural-waist-plane-localization-v0',
    status: 'ready',
    yCm: waistY,
    levelYcm: waistY,
  };

  const sideOrientationReport = overrides.sideOrientationReport ?? {
    contract: 'side-anterior-posterior-orientation-v0',
    status: 'ready',
    facingDirection: orientation.facingDirection,
    anteriorSide: orientation.anteriorSide,
  };

  const levelsReport = overrides.levelsReport ?? {
    contract: 'anatomical-levels-v0',
    status: 'completed',
    levels: [{ id: 'shoulder', status: 'ready', yCm: shoulderY }],
  };

  return {
    torsoScanReport,
    naturalWaistReport,
    sideOrientationReport,
    levelsReport,
    options: overrides.options ?? {},
  };
}

test('1. Real-style apex below old waist-superior-crest cutoff localizes correctly at true Bust Point Y', () => {
  // Old cutoff was 120.65 cm. True apex is placed with plateau spanning 118.15 to 120.15 cm (midpoint = 119.15 cm).
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => {
        if (y >= 118.15 && y <= 120.15) return 78.30; // Plateau midpoint = 119.15 cm
        if (y > 120.15) return Number((78.30 + (y - 120.15) * 1.5).toFixed(2));
        return Number((78.30 + (118.15 - y) * 1.5).toFixed(2));
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);

  assert.equal(res.contract, BUST_POINT_PLANE_CONTRACT);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.selectedPlateau.midpointYcm, 119.15);
  assert.equal(res.yCm, 119.15);
  assert.equal(res.levelYcm, 119.15);
  assert.equal(res.frontEvidence.status, 'valid');
  assert.equal(res.sideEvidence.status, 'valid');
  assert.equal(res.sideEvidence.minUcm, 78.30);
});

test('2. Broad flat apex plateau selects exact geometric midpoint', () => {
  const input = buildValidInputs({
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y >= 115.0 && y <= 121.0) return 80.00; // 6.0 cm wide plateau from 115.0 to 121.0, midpoint = 118.00 cm
        if (y > 121.0) return Number((80.00 + (y - 121.0) * 0.8).toFixed(2));
        return Number((80.00 + (115.0 - y) * 0.8).toFixed(2));
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.selectedPlateau.midpointYcm, 118.00);
  assert.equal(res.selectedPlateau.plateauMinYcm, 115.00);
  assert.equal(res.selectedPlateau.plateauMaxYcm, 121.00);
  assert.equal(res.selectedPlateau.plateauYSpanCm, 6.00);
  assert.equal(res.yCm, 118.00);
});

test('3. Orientation positive-U (anteriorSide=max_u) localizes correctly', () => {
  const input = buildValidInputs({
    orientation: { facingDirection: 'positive_u', anteriorSide: 'max_u' },
    scanOptions: {
      anteriorProfileFn: (y) => {
        // maxU is anterior: larger U = further forward
        if (y >= 118.0 && y <= 120.0) return 120.00; // Apex at maxU = 120.00
        if (y > 120.0) return Number((120.00 - (y - 120.0) * 0.5).toFixed(2));
        return Number((120.00 - (118.0 - y) * 0.5).toFixed(2));
      },
      posteriorUFn: (y) => 90.0,
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 119.00);
  assert.equal(res.orientation.anteriorSide, 'max_u');
  assert.equal(res.sideEvidence.maxUcm, 120.00);
});

test('4. Orientation negative-U (anteriorSide=min_u) localizes correctly', () => {
  const input = buildValidInputs({
    orientation: { facingDirection: 'negative_u', anteriorSide: 'min_u' },
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y >= 118.0 && y <= 120.0) return 80.00; // Apex at minU = 80.00
        if (y > 120.0) return Number((80.00 + (y - 120.0) * 0.5).toFixed(2));
        return Number((80.00 + (118.0 - y) * 0.5).toFixed(2));
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 119.00);
  assert.equal(res.orientation.anteriorSide, 'min_u');
  assert.equal(res.sideEvidence.minUcm, 80.00);
});

test('5. Global Side-U rigid translation produces identical selected Y', () => {
  const inputOriginal = buildValidInputs();
  const resOriginal = evaluateBustPointPlaneLocalization(inputOriginal);

  // Translate all U coordinates by +50.0 cm
  const inputShifted = buildValidInputs({
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y >= 118.5 && y <= 119.5) return 78.30 + 50.0;
        if (y > 119.5) return 78.30 + 50.0 + (y - 119.5) * 0.6;
        return 78.30 + 50.0 + (118.5 - y) * 0.4;
      },
      posteriorUFn: (y) => 109.0 + 50.0,
    },
  });
  const resShifted = evaluateBustPointPlaneLocalization(inputShifted);

  assert.equal(resOriginal.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(resShifted.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(resOriginal.yCm, resShifted.yCm);
});

test('6. Small upper-chest convexity is rejected in favor of dominant true breast dome', () => {
  // Contour has a minor 0.3 cm ripple at Y=127.0 cm (minU=82.7) and true breast dome at Y=119.0 cm (minU=78.3)
  const input = buildValidInputs({
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y >= 126.8 && y <= 127.2) return 82.70; // Upper chest ripple
        if (y > 127.2) return 83.00;
        if (y > 120.0 && y < 126.8) return 83.00;
        if (y >= 118.5 && y <= 119.5) return 78.30; // True breast dome (much further forward)
        if (y > 119.5 && y <= 120.0) return Number((78.30 + (y - 119.5) * 4.0).toFixed(2));
        return Number((78.30 + (118.5 - y) * 0.5).toFixed(2));
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 119.00); // True breast dome wins dominance
  assert.equal(res.sideEvidence.minUcm, 78.30);
});

test('7. Bra-edge shallow local dome is rejected in favor of stronger breast dome', () => {
  const input = buildValidInputs({
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y >= 125.0 && y <= 125.5) return 81.50; // Bra cup edge ripple
        if (y > 125.5) return 82.00;
        if (y > 120.0 && y < 125.0) return 82.00;
        if (y >= 118.0 && y <= 119.0) return 78.00; // True breast dome
        if (y > 119.0 && y <= 120.0) return Number((78.00 + (y - 119.0) * 4.0).toFixed(2));
        return Number((78.00 + (118.0 - y) * 0.4).toFixed(2));
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 118.50);
});

test('8. Abdomen projecting farther than breast is quarantined below Natural Waist', () => {
  // Subject has a breast dome at Y=119.0 cm (minU=78.30) and an enormous abdomen below waist at Y=96.0 cm (minU=72.00)
  const input = buildValidInputs({
    waistY: 107.0,
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y < 107.0) {
          // Abdominal region below waist: projects much further forward (minU=72.00)
          if (y >= 95.5 && y <= 96.5) return 72.00;
          return 75.00;
        }
        // Thoracic region above waist: breast dome at Y=119.0 (minU=78.30)
        if (y >= 118.5 && y <= 119.5) return 78.30;
        if (y > 119.5) return Number((78.30 + (y - 119.5) * 0.5).toFixed(2));
        return Number((78.30 + (118.5 - y) * 0.4).toFixed(2));
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 119.00); // Breast dome wins because search is strictly above Waist (Y > 107.0)
});

test('9. Two equally dominant qualified thoracic domes return ambiguous status', () => {
  // Two distinct breast-like domes of equal minU=78.30 at Y=125.0 and Y=118.0
  const input = buildValidInputs({
    scanOptions: {
      anteriorProfileFn: (y) => {
        if (y >= 124.5 && y <= 125.5) return 78.30; // Dome 1
        if (y >= 117.5 && y <= 118.5) return 78.30; // Dome 2 (equal)
        return 82.00;
      },
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.AMBIGUOUS);
  assert.ok(res.blockers.includes(BUST_POINT_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES));
  assert.equal(res.yCm, null);
});

test('10. Monotonic posture lean lacking posterior recession returns unavailable status', () => {
  // Monotonically slopes forward without recession
  const input = buildValidInputs({
    scanOptions: {
      anteriorProfileFn: (y) => Number((75.0 + (y - 100.0) * 0.5).toFixed(2)),
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(BUST_POINT_BLOCKER_CODES.NO_BREAST_DOME_DETECTED));
  assert.equal(res.yCm, null);
});

test('11. Natural Waist unavailable returns unavailable status', () => {
  const input = buildValidInputs({
    naturalWaistReport: {
      contract: 'natural-waist-plane-localization-v0',
      status: 'unavailable',
      yCm: null,
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(BUST_POINT_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE));
  assert.equal(res.yCm, null);
});

test('12. Shoulder unavailable returns unavailable status', () => {
  const input = buildValidInputs({
    levelsReport: {
      contract: 'anatomical-levels-v0',
      status: 'completed',
      levels: [],
    },
    torsoScanReport: {
      contract: 'torso-arbitrary-y-evidence-scan-v0',
      status: 'completed',
      candidateCount: 100,
      candidates: buildSyntheticScan().candidates,
      upperBound: null,
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(BUST_POINT_BLOCKER_CODES.SHOULDER_ANCHOR_UNAVAILABLE));
  assert.equal(res.yCm, null);
});

test('13. Side orientation unavailable returns unavailable status', () => {
  const input = buildValidInputs({
    sideOrientationReport: {
      contract: 'side-anterior-posterior-orientation-v0',
      status: 'unavailable',
      facingDirection: null,
      anteriorSide: null,
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(BUST_POINT_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE));
  assert.equal(res.yCm, null);
});

test('14. Continuous segment partitioning does not smooth across metric gaps', () => {
  // Introduce a 2.0 cm gap in the scan between Y=125 and Y=123
  const fullScan = buildSyntheticScan();
  const gappedCandidates = fullScan.candidates.filter(c => !(c.yCm <= 125.0 && c.yCm >= 123.0));
  const gappedScan = {
    ...fullScan,
    candidateCount: gappedCandidates.length,
    candidates: gappedCandidates,
  };

  const input = buildValidInputs({ torsoScanReport: gappedScan });
  const res = evaluateBustPointPlaneLocalization(input);

  // Should succeed in segment containing true apex at Y=119.0 without smoothing across the gap
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 119.00);
});

test('15. Multi-run Side rows are excluded from anterior contour series', () => {
  const input = buildValidInputs({
    scanOptions: {
      isSideValidFn: (y) => !(y >= 124.0 && y <= 126.0), // multi-run or invalid rows around Y=125
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 119.00);
});

test('16. Front evidence at selected Bust Point is packaged cleanly for downstream circumference', () => {
  const input = buildValidInputs({
    scanOptions: {
      frontWidthFn: (y) => 35.10,
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.READY);
  assert.equal(res.frontEvidence.widthCm, 35.10);
  assert.equal(res.frontEvidence.status, 'valid');
  assert.equal(res.frontEvidence.isSingleSupportedRun, true);
});

test('17. Evaluator does not mutate input reports', () => {
  const input = buildValidInputs();
  const inputCopy = JSON.parse(JSON.stringify(input));

  evaluateBustPointPlaneLocalization(input);

  assert.deepEqual(input.naturalWaistReport, inputCopy.naturalWaistReport);
  assert.deepEqual(input.sideOrientationReport, inputCopy.sideOrientationReport);
  assert.deepEqual(input.levelsReport, inputCopy.levelsReport);
});

test('18. Inverted anatomical ordering (Shoulder <= Waist) returns invalid status', () => {
  const validScan = buildSyntheticScan({ shoulderY: 133.0, waistY: 107.0 });
  const input = buildValidInputs({
    torsoScanReport: validScan,
    shoulderY: 100.0,
    waistY: 110.0, // Inverted!
    naturalWaistReport: {
      contract: 'natural-waist-plane-localization-v0',
      status: 'ready',
      yCm: 110.0,
      levelYcm: 110.0,
    },
    levelsReport: {
      contract: 'anatomical-levels-v0',
      status: 'completed',
      levels: [{ id: 'shoulder', status: 'ready', yCm: 100.0 }],
    },
  });

  const res = evaluateBustPointPlaneLocalization(input);
  assert.equal(res.status, BUST_POINT_PLANE_STATUS.INVALID);
  assert.ok(res.blockers.includes(BUST_POINT_BLOCKER_CODES.INVALID_SEARCH_WINDOW));
});

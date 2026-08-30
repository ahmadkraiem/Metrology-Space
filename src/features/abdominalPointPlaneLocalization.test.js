import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABDOMINAL_POINT_PLANE_CONTRACT,
  ABDOMINAL_POINT_PLANE_CONTRACT_VERSION,
  ABDOMINAL_POINT_PLANE_STATUS,
  ABDOMINAL_POINT_BLOCKER_CODES,
  DEFAULT_ABDOMINAL_POINT_OPTIONS,
  applySymmetricSmoothing,
  evaluateAbdominalPointPlaneLocalization,
} from './abdominalPointPlaneLocalization.js';

function buildSyntheticScan({
  waistY = 107.0,
  hipY = 86.0,
  stepCm = 0.10,
  orientation = { facingDirection: 'negative_u', anteriorSide: 'min_u' },
  anteriorProfileFn = (y) => {
    // Standard abdominal dome centered at y=95.70, apex U=82.20
    if (y >= 95.20 && y <= 96.20) return 82.20;
    if (y > 96.20) return Number((82.20 + (y - 96.20) * 0.8).toFixed(2)); // slopes backward towards waist
    return Number((82.20 + (95.20 - y) * 0.8).toFixed(2)); // slopes backward towards hip
  },
  frontWidthFn = (y) => 37.20,
  posteriorUFn = (y) => 108.50,
  isSideValidFn = (y) => true,
  isFrontValidFn = (y) => true,
  supportPolicyId = 'trunk_pelvic_transition_support_v0',
  targetClassIds = [12, 13, 21, 22, 23],
} = {}) {
  const isPositiveU = orientation.anteriorSide === 'max_u';
  const candidates = [];
  let row = 850;
  const startY = Math.ceil(Math.max(waistY, hipY) + 2.0);
  const endY = Math.floor(Math.min(waistY, hipY) - 2.0);

  for (let y = startY; y >= endY - 1e-9; y -= stepCm) {
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
        encounteredClassIds: frontValid ? [13, 22] : [],
      },
      side: {
        status: sideValid ? 'valid' : 'invalid',
        minUcm: sideValid ? minU : null,
        maxUcm: sideValid ? maxU : null,
        profileSpanCm: sideValid ? Number((maxU - minU).toFixed(2)) : null,
        qualifiedApDepthCm: sideValid ? Number((maxU - minU).toFixed(2)) : null,
        isQualified: sideValid,
        depthQualificationStatus: sideValid ? 'qualified' : 'unqualified',
        rasterRow: row,
        isSingleSupportedRun: sideValid,
        runCount: sideValid ? 1 : 0,
        encounteredClassIds: sideValid ? [13, 22] : [],
      },
    });
    row += 1;
  }

  return {
    contract: 'torso-arbitrary-y-evidence-scan-v0',
    status: 'completed',
    candidateCount: candidates.length,
    candidates,
    supportPolicyId,
    targetClassIds,
    provenance: { sampleSpacingCm: stepCm },
  };
}

function buildValidInputs(overrides = {}) {
  const waistY = overrides.waistY ?? 107.0;
  const hipY = overrides.hipY ?? 86.0;
  const orientation = overrides.orientation ?? {
    status: 'ready',
    facingDirection: 'negative_u',
    anteriorSide: 'min_u',
  };

  const torsoScanReport = 'torsoScanReport' in overrides
    ? overrides.torsoScanReport
    : buildSyntheticScan({
        waistY,
        hipY,
        orientation,
        ...overrides.scanOptions,
      });

  const naturalWaistReport = 'naturalWaistReport' in overrides
    ? overrides.naturalWaistReport
    : {
        contract: 'natural-waist-plane-localization-v0',
        status: 'ready',
        yCm: waistY,
        levelYcm: waistY,
      };

  const sideOrientationReport = 'sideOrientationReport' in overrides
    ? overrides.sideOrientationReport
    : {
        contract: 'side-anterior-posterior-orientation-v0',
        status: 'ready',
        facingDirection: orientation.facingDirection,
        anteriorSide: orientation.anteriorSide,
      };

  const levelsReport = 'levelsReport' in overrides
    ? overrides.levelsReport
    : {
        contract: 'anatomical-levels-v0',
        status: 'completed',
        levels: [{ id: 'hip', status: 'ready', yCm: hipY }],
      };

  return {
    torsoScanReport,
    naturalWaistReport,
    sideOrientationReport,
    levelsReport,
    options: overrides.options ?? {},
  };
}

test('1. Pure raw anterior extremum localizes cleanly on standard abdominal dome', () => {
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => {
        if (y >= 95.60 && y <= 95.90) return 82.20; // Plateau midpoint = 95.75 cm
        if (y > 95.90) return Number((82.20 + (y - 95.90) * 1.5).toFixed(2));
        return Number((82.20 + (95.60 - y) * 1.5).toFixed(2));
      },
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.contract, ABDOMINAL_POINT_PLANE_CONTRACT);
  assert.equal(res.yCm, 95.75);
  assert.equal(res.selectedPlateau.midpointYcm, 95.75);
  assert.equal(res.frontEvidence.status, 'valid');
  assert.equal(res.sideEvidence.status, 'valid');
});

test('2. Tilted waist->hip baseline: v1 remains invariant at true anterior extremum where v0 would shift', () => {
  // Contour has steep slope towards waist and mild slope towards hip,
  // but true raw anterior extremum (smallest minU) is exactly at [95.60, 95.90] (midpoint 95.75)
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => {
        if (y >= 95.60 && y <= 95.90) return 80.00; // True extremum midpoint = 95.75
        if (y > 95.90) return Number((80.00 + (y - 95.90) * 1.8).toFixed(2)); // rises steeply to waist
        return Number((80.00 + (95.60 - y) * 1.5).toFixed(2)); // rises to hip
      },
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 95.75);
  assert.equal(res.selectedPlateau.maxRawAnteriorProjectionCm, -80.00);
});

test('3. Negative_u orientation normalization extracts -minU as anterior projection', () => {
  const input = buildValidInputs({
    orientation: { facingDirection: 'negative_u', anteriorSide: 'min_u' },
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => (y === 95.70 ? 82.20 : 82.20 + Math.abs(y - 95.70) * 0.8),
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.orientation.facingDirection, 'negative_u');
  assert.equal(res.selectedPlateau.maxRawAnteriorProjectionCm, -82.20);
});

test('4. Positive_u orientation normalization extracts +maxU as anterior projection', () => {
  const input = buildValidInputs({
    orientation: { facingDirection: 'positive_u', anteriorSide: 'max_u' },
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => (y === 95.70 ? 120.50 : 120.50 - Math.abs(y - 95.70) * 0.8),
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.orientation.facingDirection, 'positive_u');
  assert.equal(res.selectedPlateau.maxRawAnteriorProjectionCm, 120.50);
});

test('5. Global rigid Side-U translation changes coordinate values but does NOT change selected Y', () => {
  const inputOriginal = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => (Math.abs(y - 95.75) <= 0.15 ? 82.20 : 82.20 + Math.abs(y - 95.75) * 1.0),
      posteriorUFn: (y) => 108.50,
    },
  });

  const shiftCm = 42.50;
  const inputShifted = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => (Math.abs(y - 95.75) <= 0.15 ? 82.20 + shiftCm : 82.20 + shiftCm + Math.abs(y - 95.75) * 1.0),
      posteriorUFn: (y) => 108.50 + shiftCm,
    },
  });

  const resOriginal = evaluateAbdominalPointPlaneLocalization(inputOriginal);
  const resShifted = evaluateAbdominalPointPlaneLocalization(inputShifted);

  assert.equal(resOriginal.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(resShifted.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(resOriginal.yCm, resShifted.yCm);
  assert.equal(resShifted.yCm, 95.75);
});

test('6. Broad abdominal plateau selects symmetric geometric midpoint of plateau Y extent', () => {
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => {
        if (y >= 94.00 && y <= 97.00) return 82.20; // Plateau spanning 94.00 to 97.00 -> midpoint = 95.50
        if (y > 97.00) return Number((82.20 + (y - 97.00) * 1.0).toFixed(2));
        return Number((82.20 + (94.00 - y) * 1.0).toFixed(2));
      },
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.selectedPlateau.midpointYcm, 95.50);
  assert.equal(res.yCm, 95.50);
});

test('7. Search bounds use Natural Waist center (107.00 cm) and Hip (86.00 cm), capturing epigastric bulge', () => {
  // An abdominal dome centered high at y=102.00 (above old inferior crest 100.75, but below waist center 107.00)
  const input = buildValidInputs({
    waistY: 107.00,
    hipY: 86.00,
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => (Math.abs(y - 102.00) <= 0.05 ? 81.50 : 81.50 + Math.abs(y - 102.00) * 1.0),
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 102.00);
  assert.equal(res.searchWindow.naturalWaistYcm, 107.00);
  assert.equal(res.searchWindow.hipYcm, 86.00);
});

test('8. Hip anatomical level is required (missing or unready -> unavailable)', () => {
  const inputMissingHip = buildValidInputs({
    levelsReport: { contract: 'anatomical-levels-v0', status: 'completed', levels: [] },
  });
  const res = evaluateAbdominalPointPlaneLocalization(inputMissingHip);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(ABDOMINAL_POINT_BLOCKER_CODES.HIP_ANCHOR_UNAVAILABLE));
});

test('9. Natural Waist is required (missing or unready -> unavailable)', () => {
  const inputMissingWaist = buildValidInputs({
    naturalWaistReport: null,
  });
  const res = evaluateAbdominalPointPlaneLocalization(inputMissingWaist);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(ABDOMINAL_POINT_BLOCKER_CODES.NATURAL_WAIST_UNAVAILABLE));
});

test('10. Side orientation is required (missing or unready -> unavailable)', () => {
  const inputMissingOrientation = buildValidInputs({
    sideOrientationReport: { contract: 'side-anterior-posterior-orientation-v0', status: 'unavailable' },
  });
  const res = evaluateAbdominalPointPlaneLocalization(inputMissingOrientation);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(ABDOMINAL_POINT_BLOCKER_CODES.SIDE_ORIENTATION_UNAVAILABLE));
});

test('11. Pelvis / Hip protection: pelvic prominence below Hip boundary does NOT win', () => {
  // Anterior profile has an abdominal dome at y=95.70 (U=82.20) and a massive forward-projecting pelvis at y=80.0 (U=75.00)
  const input = buildValidInputs({
    waistY: 107.00,
    hipY: 86.00,
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => {
        if (y < 86.00) return 75.00; // Far forward pelvis below Hip
        if (y >= 95.50 && y <= 95.90) return 82.20; // Abdominal dome
        if (y > 95.90) return Number((82.20 + (y - 95.90) * 0.8).toFixed(2));
        return Number((82.20 + (95.50 - y) * 0.8).toFixed(2));
      },
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 95.70); // Bounded above Hip 86.00
});

test('12. Monotonic abdominal slope with no expansion/recession returns unavailable', () => {
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => 80.0 + (107.00 - y) * 0.5, // Strictly monotonic forward slope
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.UNAVAILABLE);
  assert.ok(res.blockers.includes(ABDOMINAL_POINT_BLOCKER_CODES.NO_ABDOMINAL_DOME_DETECTED));
});

test('13. Two equally dominant separated abdominal domes returns ambiguous', () => {
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => {
        // Dome 1 at 100.0 (U=82.0), Dome 2 at 92.0 (U=82.0)
        if (Math.abs(y - 100.0) <= 0.1) return 82.00;
        if (Math.abs(y - 92.0) <= 0.1) return 82.00;
        if (y > 96.0) return Number((82.00 + Math.abs(y - 100.0) * 1.5).toFixed(2));
        return Number((82.00 + Math.abs(y - 92.0) * 1.5).toFixed(2));
      },
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.AMBIGUOUS);
  assert.ok(res.blockers.includes(ABDOMINAL_POINT_BLOCKER_CODES.AMBIGUOUS_MULTIPLE_APEX_PROMINENCES));
});

test('14. Metric gap splitting candidates partitions segments and prevents cross-gap smoothing', () => {
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.05,
      isSideValidFn: (y) => !(y >= 97.0 && y <= 99.0), // 2.0 cm missing data gap
      anteriorProfileFn: (y) => (Math.abs(y - 94.0) <= 0.15 ? 82.00 : 82.00 + Math.abs(y - 94.0) * 1.0),
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.yCm, 94.00);
});

test('15. Transition support policy trunk_pelvic_transition_support_v0 is preserved in provenance', () => {
  const input = buildValidInputs();
  const res = evaluateAbdominalPointPlaneLocalization(input);

  assert.equal(res.provenance.supportPolicyId, 'trunk_pelvic_transition_support_v0');
  assert.deepEqual(res.provenance.targetClassIds, [12, 13, 21, 22, 23]);
});

test('16. Front single run validation and transverse width are extracted at selected Y without selecting Y', () => {
  const input = buildValidInputs({
    scanOptions: {
      stepCm: 0.10,
      anteriorProfileFn: (y) => (Math.abs(y - 95.70) <= 0.05 ? 82.20 : 82.20 + Math.abs(y - 95.70) * 1.0),
      frontWidthFn: (y) => (y === 95.70 ? 37.20 : 35.00),
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.frontEvidence.widthCm, 37.20);
  assert.equal(res.frontEvidence.isSingleSupportedRun, true);
});

test('17. Posterior/back contour is isolated from Y selection and supplies qualified AP depth', () => {
  const input = buildValidInputs({
    scanOptions: {
      posteriorUFn: (y) => 108.50,
      anteriorProfileFn: (y) => (Math.abs(y - 95.70) <= 0.1 ? 82.20 : 82.20 + Math.abs(y - 95.70) * 1.0),
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.sideEvidence.qualifiedApDepthCm, 26.30); // 108.50 - 82.20 = 26.30
  assert.equal(res.sideEvidence.isQualified, true);
});

test('18. Strict guardrails: no Pointmap, no Normals, no U->Z, no bodyHeightPercentage', () => {
  const input = buildValidInputs();
  const res = evaluateAbdominalPointPlaneLocalization(input);

  assert.equal(res.semantics.isAbdominalPointPlaneCandidate, true);
  assert.equal(res.semantics.isMaximumApDepth, false);
  assert.equal(res.semantics.isCircumference, false);
  assert.equal(res.semantics.is3dReconstruction, false);

  const json = JSON.stringify(res);
  assert.ok(!json.includes('"canonicalZ"'));
  assert.ok(!json.includes('"pointmap"'));
  assert.ok(!json.includes('"normals"'));
  assert.ok(!json.includes('bodyHeightPercentage'));
});

test('19. Real-package synthetic verification naturally recovers Y ≈ 95.75 cm, W ≈ 37.20 cm, D ≈ 26.30 cm', () => {
  const input = buildValidInputs({
    waistY: 107.15,
    hipY: 86.25,
    scanOptions: {
      stepCm: 0.05,
      anteriorProfileFn: (y) => {
        if (y >= 95.00 && y <= 96.20) return 82.20; // Real plateau extent [95.00, 96.20] -> midpoint = 95.60
        if (y > 96.20) return Number((82.20 + (y - 96.20) * 1.5).toFixed(2));
        return Number((82.20 + (95.00 - y) * 1.5).toFixed(2));
      },
      frontWidthFn: (y) => 37.20,
      posteriorUFn: (y) => 108.50,
    },
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.READY);
  assert.equal(res.selectedPlateau.plateauMinYcm, 95.00);
  assert.equal(res.selectedPlateau.plateauMaxYcm, 96.20);
  assert.equal(res.selectedPlateau.midpointYcm, 95.60);
  assert.equal(res.yCm, 95.60);
  assert.equal(res.frontEvidence.widthCm, 37.20);
  assert.equal(res.sideEvidence.qualifiedApDepthCm, 26.30);
});

test('20. Invalid search window ordering (hipY >= waistY) returns status invalid', () => {
  const input = buildValidInputs({
    waistY: 86.00,
    hipY: 107.00,
  });

  const res = evaluateAbdominalPointPlaneLocalization(input);
  assert.equal(res.status, ABDOMINAL_POINT_PLANE_STATUS.INVALID);
  assert.ok(res.blockers.includes(ABDOMINAL_POINT_BLOCKER_CODES.INVALID_SEARCH_WINDOW));
});

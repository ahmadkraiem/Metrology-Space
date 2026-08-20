import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DENSE_LAYOUT_CHW_PLANAR,
  DENSE_LAYOUT_HWC_INTERLEAVED,
  DENSE_LAYOUT_UNKNOWN,
  normalizeNormalsEvidence,
  normalizePointmapEvidence,
} from './bodyEvidencePackage.js';
import {
  BODY_ANATOMICAL_CLASS_IDS,
  evaluateNormalsBufferNumericQa,
  evaluateNormalsNumericQa,
  evaluatePointmapBufferNumericQa,
  evaluatePointmapNumericQa,
  evaluateSameViewDenseCrossModalQa,
  NORMAL_NUMERIC_QA_CONTRACT,
  NORMAL_UNIT_TOLERANCE,
  POINTMAP_NUMERIC_QA_CONTRACT,
  SAME_VIEW_DENSE_CROSS_MODAL_QA_CONTRACT,
} from './denseEvidenceQa.js';

test('evaluatePointmapBufferNumericQa computes exact statistics for valid HWC Float32 pointmap', () => {
  // 2 rows, 2 cols (4 pixels, 12 elements)
  // Pixel (0,0): [1.0, 10.0, 100.0]
  // Pixel (0,1): [2.0, 20.0, 200.0]
  // Pixel (1,0): [3.0, 30.0, 300.0]
  // Pixel (1,1): [4.0, 40.0, 400.0]
  const hwcBuffer = new Float32Array([
    1.0, 10.0, 100.0,
    2.0, 20.0, 200.0,
    3.0, 30.0, 300.0,
    4.0, 40.0, 400.0,
  ]);

  const report = evaluatePointmapBufferNumericQa(hwcBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    model: 'test-pointmap-net',
    declaredUnits: 'cm',
    declaredScale: 1.0,
    view: 'front',
  });

  assert.equal(report.contract, POINTMAP_NUMERIC_QA_CONTRACT);
  assert.equal(report.view, 'front');
  assert.equal(report.availability, 'present');
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.warnings, []);

  // Structural checks
  assert.equal(report.structure.isInspectable, true);
  assert.equal(report.structure.expectedElements, 12);
  assert.equal(report.structure.actualElements, 12);
  assert.equal(report.structure.elementCountMatch, true);

  // Overall elements
  assert.equal(report.numeric.elements.totalElementCount, 12);
  assert.equal(report.numeric.elements.finiteElementCount, 12);
  assert.equal(report.numeric.elements.nonFiniteElementCount, 0);
  assert.equal(report.numeric.elements.nanCount, 0);
  assert.equal(report.numeric.elements.positiveInfinityCount, 0);
  assert.equal(report.numeric.elements.negativeInfinityCount, 0);
  assert.equal(report.numeric.elements.finiteRatio, 1.0);

  // Vector counts
  assert.equal(report.numeric.vectors.totalVectorCount, 4);
  assert.equal(report.numeric.vectors.fullyFiniteVectorCount, 4);
  assert.equal(report.numeric.vectors.partiallyNonFiniteVectorCount, 0);
  assert.equal(report.numeric.vectors.fullyNonFiniteVectorCount, 0);
  assert.equal(report.numeric.vectors.fullyFiniteVectorRatio, 1.0);

  // Channel 0: [1, 2, 3, 4] -> min 1, max 4, mean 2.5, std sqrt(1.25) ~ 1.11803
  const ch0 = report.numeric.channels[0];
  assert.equal(ch0.channelIndex, 0);
  assert.equal(ch0.finiteCount, 4);
  assert.equal(ch0.nonFiniteCount, 0);
  assert.equal(ch0.min, 1.0);
  assert.equal(ch0.max, 4.0);
  assert.equal(ch0.mean, 2.5);
  assert.equal(Math.abs(ch0.standardDeviation - Math.sqrt(1.25)) < 1e-5, true);

  // Channel 1: [10, 20, 30, 40] -> min 10, max 40, mean 25, std sqrt(125) ~ 11.1803
  const ch1 = report.numeric.channels[1];
  assert.equal(ch1.channelIndex, 1);
  assert.equal(ch1.min, 10.0);
  assert.equal(ch1.max, 40.0);
  assert.equal(ch1.mean, 25.0);
  assert.equal(Math.abs(ch1.standardDeviation - Math.sqrt(125)) < 1e-5, true);

  // Channel 2: [100, 200, 300, 400] -> min 100, max 400, mean 250, std sqrt(12500) ~ 111.803
  const ch2 = report.numeric.channels[2];
  assert.equal(ch2.channelIndex, 2);
  assert.equal(ch2.min, 100.0);
  assert.equal(ch2.max, 400.0);
  assert.equal(ch2.mean, 250.0);
  assert.equal(Math.abs(ch2.standardDeviation - Math.sqrt(12500)) < 1e-4, true);

  // Declarations reporting: unvalidated metadata preserved without modification
  assert.equal(report.declarations.declaredUnits, 'cm');
  assert.equal(report.declarations.declaredScale, 1.0);
  assert.equal(report.declarations.unitsSemantics, 'unvalidated');
  assert.equal(report.declarations.scaleSemantics, 'unvalidated');
  assert.equal(report.declarations.scaleApplicationState, 'unvalidated');
  assert.equal(report.declarations.coordinateFrame, 'unvalidated');
  assert.equal(report.declarations.canonicalAxisMeaning, 'unvalidated');
});

test('HWC and CHW buffers with identical logical values yield identical QA statistics', () => {
  // 2 rows, 2 cols (4 pixels)
  // Pixels: (0,0)=[1, 10, 100], (0,1)=[2, 20, 200], (1,0)=[3, 30, 300], (1,1)=[4, 40, 400]
  const hwcBuffer = new Float32Array([
    1.0, 10.0, 100.0,
    2.0, 20.0, 200.0,
    3.0, 30.0, 300.0,
    4.0, 40.0, 400.0,
  ]);

  // In CHW:
  // Plane 0 (X): [1, 2, 3, 4]
  // Plane 1 (Y): [10, 20, 30, 40]
  // Plane 2 (Z): [100, 200, 300, 400]
  const chwBuffer = new Float32Array([
    1.0, 2.0, 3.0, 4.0,
    10.0, 20.0, 30.0, 40.0,
    100.0, 200.0, 300.0, 400.0,
  ]);

  const hwcReport = evaluatePointmapBufferNumericQa(hwcBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
  });

  const chwReport = evaluatePointmapBufferNumericQa(chwBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_CHW_PLANAR,
  });

  assert.equal(hwcReport.status, 'pass');
  assert.equal(chwReport.status, 'pass');

  // Verify elements match exactly
  assert.deepEqual(hwcReport.numeric.elements, chwReport.numeric.elements);

  // Verify vector metrics match exactly
  assert.deepEqual(hwcReport.numeric.vectors, chwReport.numeric.vectors);

  // Verify channels match exactly
  for (let c = 0; c < 3; c += 1) {
    assert.equal(hwcReport.numeric.channels[c].min, chwReport.numeric.channels[c].min);
    assert.equal(hwcReport.numeric.channels[c].max, chwReport.numeric.channels[c].max);
    assert.equal(hwcReport.numeric.channels[c].mean, chwReport.numeric.channels[c].mean);
    assert.equal(
      Math.abs(hwcReport.numeric.channels[c].standardDeviation - chwReport.numeric.channels[c].standardDeviation) < 1e-5,
      true,
    );
  }
});

test('evaluatePointmapBufferNumericQa detects NaNs, +Infinity, -Infinity and marks status warning', () => {
  // 1 row, 4 cols (4 vectors)
  // Pixel 0: [1.0, 2.0, 3.0] -> fully finite
  // Pixel 1: [NaN, 5.0, 6.0] -> partially non-finite (1 NaN)
  // Pixel 2: [Infinity, -Infinity, 9.0] -> partially non-finite (1 +Inf, 1 -Inf)
  // Pixel 3: [NaN, Infinity, -Infinity] -> fully non-finite (1 NaN, 1 +Inf, 1 -Inf)
  const buffer = new Float32Array([
    1.0, 2.0, 3.0,
    NaN, 5.0, 6.0,
    Infinity, -Infinity, 9.0,
    NaN, Infinity, -Infinity,
  ]);

  const report = evaluatePointmapBufferNumericQa(buffer, {
    widthPx: 4,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
  });

  assert.equal(report.status, 'warning');
  assert.equal(report.warnings.length > 0, true);
  assert.equal(report.warnings[0].includes('non-finite element(s)'), true);

  // Overall element counts
  assert.equal(report.numeric.elements.totalElementCount, 12);
  assert.equal(report.numeric.elements.finiteElementCount, 6);
  assert.equal(report.numeric.elements.nonFiniteElementCount, 6);
  assert.equal(report.numeric.elements.nanCount, 2);
  assert.equal(report.numeric.elements.positiveInfinityCount, 2);
  assert.equal(report.numeric.elements.negativeInfinityCount, 2);
  assert.equal(report.numeric.elements.finiteRatio, 6 / 12);

  // Vector counts
  assert.equal(report.numeric.vectors.totalVectorCount, 4);
  assert.equal(report.numeric.vectors.fullyFiniteVectorCount, 1);
  assert.equal(report.numeric.vectors.partiallyNonFiniteVectorCount, 2);
  assert.equal(report.numeric.vectors.fullyNonFiniteVectorCount, 1);
  assert.equal(report.numeric.vectors.fullyFiniteVectorRatio, 0.25);

  // Per-channel stats
  // Channel 0: [1.0, NaN, Infinity, NaN] -> finite count 1, min 1.0, max 1.0, mean 1.0, std 0
  const ch0 = report.numeric.channels[0];
  assert.equal(ch0.finiteCount, 1);
  assert.equal(ch0.nonFiniteCount, 3);
  assert.equal(ch0.nanCount, 2);
  assert.equal(ch0.positiveInfinityCount, 1);
  assert.equal(ch0.negativeInfinityCount, 0);
  assert.equal(ch0.min, 1.0);
  assert.equal(ch0.max, 1.0);
  assert.equal(ch0.mean, 1.0);
  assert.equal(ch0.standardDeviation, 0.0);

  // Channel 1: [2.0, 5.0, -Infinity, Infinity] -> finite count 2 (2.0, 5.0), mean 3.5
  const ch1 = report.numeric.channels[1];
  assert.equal(ch1.finiteCount, 2);
  assert.equal(ch1.nanCount, 0);
  assert.equal(ch1.positiveInfinityCount, 1);
  assert.equal(ch1.negativeInfinityCount, 1);
  assert.equal(ch1.min, 2.0);
  assert.equal(ch1.max, 5.0);
  assert.equal(ch1.mean, 3.5);

  // Channel 2: [3.0, 6.0, 9.0, -Infinity] -> finite count 3 (3.0, 6.0, 9.0), mean 6.0
  const ch2 = report.numeric.channels[2];
  assert.equal(ch2.finiteCount, 3);
  assert.equal(ch2.nanCount, 0);
  assert.equal(ch2.positiveInfinityCount, 0);
  assert.equal(ch2.negativeInfinityCount, 1);
  assert.equal(ch2.min, 3.0);
  assert.equal(ch2.max, 9.0);
  assert.equal(ch2.mean, 6.0);
});

test('evaluatePointmapBufferNumericQa handles a channel with zero finite values cleanly', () => {
  // Channel 0 has all NaNs
  // Channel 1 has [10, 20]
  // Channel 2 has [100, 200]
  const buffer = new Float32Array([
    NaN, 10.0, 100.0,
    NaN, 20.0, 200.0,
  ]);

  const report = evaluatePointmapBufferNumericQa(buffer, {
    widthPx: 2,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
  });

  assert.equal(report.status, 'warning');

  const ch0 = report.numeric.channels[0];
  assert.equal(ch0.finiteCount, 0);
  assert.equal(ch0.nonFiniteCount, 2);
  assert.equal(ch0.nanCount, 2);
  assert.equal(ch0.min, null);
  assert.equal(ch0.max, null);
  assert.equal(ch0.mean, null);
  assert.equal(ch0.standardDeviation, null);

  const ch1 = report.numeric.channels[1];
  assert.equal(ch1.finiteCount, 2);
  assert.equal(ch1.min, 10.0);
  assert.equal(ch1.max, 20.0);
});

test('evaluatePointmapBufferNumericQa fails preflight on element-count mismatch', () => {
  const shortBuffer = new Float32Array([1.0, 2.0, 3.0]); // 3 elements instead of 2x2x3 = 12

  const report = evaluatePointmapBufferNumericQa(shortBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.structure.isInspectable, false);
  assert.equal(report.structure.elementCountMatch, false);
  assert.equal(report.numeric, null);
  assert.equal(report.issues.some((i) => i.includes('does not match expected elements')), true);
});

test('evaluatePointmapBufferNumericQa fails preflight on UNKNOWN dense layout', () => {
  const buffer = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);

  const report = evaluatePointmapBufferNumericQa(buffer, {
    widthPx: 2,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_UNKNOWN,
  });

  assert.equal(report.status, 'fail');
  assert.equal(report.structure.isInspectable, false);
  assert.equal(report.numeric, null);
  assert.equal(report.issues.some((i) => i.includes('unsupported or unknown dense layout')), true);
});

test('evaluatePointmapBufferNumericQa never mutates the input buffer', () => {
  const original = [10.5, -25.25, 0.0, 100.0, NaN, Infinity];
  const buffer = new Float32Array(original);

  evaluatePointmapBufferNumericQa(buffer, {
    widthPx: 2,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
  });

  // Verify all elements are identical to original
  assert.equal(buffer[0], 10.5);
  assert.equal(buffer[1], -25.25);
  assert.equal(buffer[2], 0.0);
  assert.equal(buffer[3], 100.0);
  assert.equal(Number.isNaN(buffer[4]), true);
  assert.equal(buffer[5], Infinity);
});

test('evaluatePointmapNumericQa handles missing pointmap gracefully', async () => {
  const report = await evaluatePointmapNumericQa(null, { view: 'front' });

  assert.equal(report.contract, POINTMAP_NUMERIC_QA_CONTRACT);
  assert.equal(report.view, 'front');
  assert.equal(report.availability, 'missing');
  assert.equal(report.status, 'pass');
  assert.equal(report.structure.present, false);
  assert.equal(report.structure.isInspectable, false);
  assert.equal(report.numeric, null);
  assert.deepEqual(report.issues, []);
});

test('evaluatePointmapNumericQa asynchronously decodes normalized pointmap via lazy getDenseData', async () => {
  const floats = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
  const uint8 = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
  let binary = '';
  for (let i = 0; i < uint8.length; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = typeof Buffer !== 'undefined' ? Buffer.from(uint8).toString('base64') : globalThis.btoa(binary);

  const normalized = normalizePointmapEvidence({
    model: 'pointmap-net-v1',
    view: 'front',
    shape: [1, 2, 3],
    dtype: 'float32',
    units: 'meters',
    scale: 0.001,
    base64,
  }, { expectedView: 'front' });

  const report = await evaluatePointmapNumericQa(normalized);

  assert.equal(report.contract, POINTMAP_NUMERIC_QA_CONTRACT);
  assert.equal(report.view, 'front');
  assert.equal(report.availability, 'present');
  assert.equal(report.status, 'pass');
  assert.equal(report.structure.isInspectable, true);
  assert.equal(report.structure.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);
  assert.equal(report.numeric.elements.totalElementCount, 6);
  assert.equal(report.numeric.elements.finiteElementCount, 6);
  assert.equal(report.numeric.vectors.totalVectorCount, 2);
  assert.equal(report.numeric.vectors.fullyFiniteVectorCount, 2);

  // Declarations preserved without scale application
  assert.equal(report.declarations.declaredUnits, 'meters');
  assert.equal(report.declarations.declaredScale, 0.001);
  assert.equal(report.numeric.channels[0].min, 1.0); // raw unscaled value 1.0 (not multiplied by 0.001)
});

test('evaluatePointmapNumericQa handles lazy loader exception gracefully and reports status fail', async () => {
  const badPointmap = {
    present: true,
    view: 'front',
    widthPx: 10,
    heightPx: 10,
    channels: 3,
    shape: [10, 10, 3],
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    getDenseData: async () => {
      throw new Error('Corrupted network buffer stream');
    },
  };

  const report = await evaluatePointmapNumericQa(badPointmap);

  assert.equal(report.status, 'fail');
  assert.equal(report.structure.isInspectable, false);
  assert.equal(report.numeric, null);
  assert.equal(report.issues.some((i) => i.includes('Corrupted network buffer stream')), true);
});

test('evaluatePointmapNumericQa yields deterministic results on repeated calls', async () => {
  const floats = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
  const pointmap = {
    present: true,
    view: 'side',
    widthPx: 2,
    heightPx: 1,
    channels: 3,
    shape: [1, 2, 3],
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    getDenseData: async () => floats,
  };

  const res1 = await evaluatePointmapNumericQa(pointmap);
  const res2 = await evaluatePointmapNumericQa(pointmap);

  assert.deepEqual(res1, res2);
});

test('evaluateNormalsBufferNumericQa computes exact statistics and magnitude metrics for valid HWC Float32 unit normals', () => {
  // 2 rows, 2 cols (4 pixels)
  // Pixel 0: [0, 0, 1] -> mag 1.0
  // Pixel 1: [1, 0, 0] -> mag 1.0
  // Pixel 2: [0, 1, 0] -> mag 1.0
  // Pixel 3: [0.57735, 0.57735, 0.57735] -> mag ~ 1.0
  const norm3 = 1.0 / Math.sqrt(3);
  const hwcBuffer = new Float32Array([
    0.0, 0.0, 1.0,
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    norm3, norm3, norm3,
  ]);

  const report = evaluateNormalsBufferNumericQa(hwcBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    model: 'surface-normals-net',
    declaredRange: [-1.0, 1.0],
    view: 'front',
  });

  assert.equal(report.contract, NORMAL_NUMERIC_QA_CONTRACT);
  assert.equal(report.view, 'front');
  assert.equal(report.availability, 'present');
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.warnings, []);

  // Structural checks
  assert.equal(report.structure.isInspectable, true);
  assert.equal(report.structure.expectedElements, 12);
  assert.equal(report.structure.actualElements, 12);

  // Vector counts
  assert.equal(report.numeric.vectors.totalVectorCount, 4);
  assert.equal(report.numeric.vectors.fullyFiniteVectorCount, 4);
  assert.equal(report.numeric.vectors.fullyFiniteVectorRatio, 1.0);

  // Magnitude QA
  const mag = report.numeric.magnitude;
  assert.equal(mag.tolerance, NORMAL_UNIT_TOLERANCE);
  assert.equal(mag.finiteMagnitudeVectorCount, 4);
  assert.equal(mag.zeroMagnitudeCount, 0);
  assert.equal(mag.nearUnitCount, 4);
  assert.equal(mag.nearUnitRatio, 1.0);
  assert.equal(Math.abs(mag.min - 1.0) < 1e-4, true);
  assert.equal(Math.abs(mag.max - 1.0) < 1e-4, true);
  assert.equal(Math.abs(mag.mean - 1.0) < 1e-4, true);
  assert.equal(mag.standardDeviation < 1e-4, true);

  // Declared range QA
  assert.equal(report.declaredRangeQa.status, 'pass');
  assert.deepEqual(report.declaredRangeQa.declaredRange, [-1.0, 1.0]);
  assert.equal(report.declaredRangeQa.finiteValueCountChecked, 12);
  assert.equal(report.declaredRangeQa.belowRangeCount, 0);
  assert.equal(report.declaredRangeQa.aboveRangeCount, 0);
  assert.equal(report.declaredRangeQa.violationCount, 0);
  assert.equal(report.declaredRangeQa.violationRatio, 0);

  // Semantics unvalidated markings
  assert.equal(report.semantics.coordinateFrame, 'unvalidated');
  assert.equal(report.semantics.orientationSemantics, 'unvalidated');
  assert.equal(report.semantics.encodingSemantics, 'unvalidated');
});

test('evaluateNormalsBufferNumericQa yields identical results for HWC and CHW buffers with identical logical values', () => {
  // Pixels: (0,0)=[0,0,1], (0,1)=[1,0,0], (1,0)=[0,1,0], (1,1)=[0.6, 0.8, 0.0]
  const hwcBuffer = new Float32Array([
    0.0, 0.0, 1.0,
    1.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
    0.6, 0.8, 0.0,
  ]);

  // In CHW:
  // Plane 0 (X): [0.0, 1.0, 0.0, 0.6]
  // Plane 1 (Y): [0.0, 0.0, 1.0, 0.8]
  // Plane 2 (Z): [1.0, 0.0, 0.0, 0.0]
  const chwBuffer = new Float32Array([
    0.0, 1.0, 0.0, 0.6,
    0.0, 0.0, 1.0, 0.8,
    1.0, 0.0, 0.0, 0.0,
  ]);

  const hwcReport = evaluateNormalsBufferNumericQa(hwcBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    declaredRange: [-1.0, 1.0],
  });

  const chwReport = evaluateNormalsBufferNumericQa(chwBuffer, {
    widthPx: 2,
    heightPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_CHW_PLANAR,
    declaredRange: [-1.0, 1.0],
  });

  assert.equal(hwcReport.status, 'pass');
  assert.equal(chwReport.status, 'pass');

  assert.deepEqual(hwcReport.numeric.elements, chwReport.numeric.elements);
  assert.deepEqual(hwcReport.numeric.vectors, chwReport.numeric.vectors);
  assert.deepEqual(hwcReport.numeric.magnitude, chwReport.numeric.magnitude);
  assert.deepEqual(hwcReport.declaredRangeQa, chwReport.declaredRangeQa);
});

test('evaluateNormalsBufferNumericQa distinguishes near-unit vs non-unit magnitudes and detects zero vectors', () => {
  // 4 vectors:
  // Vector 0: [0, 0, 1.005] -> mag 1.005 (|1.005 - 1.0| = 0.005 <= 0.01 tolerance) -> nearUnit
  // Vector 1: [0, 0, 1.05]  -> mag 1.05 (|1.05 - 1.0| = 0.05 > 0.01 tolerance) -> not nearUnit
  // Vector 2: [0, 0, 0]     -> mag 0.0 -> zeroMagnitude
  // Vector 3: [0, 1.0, 0]   -> mag 1.0 -> nearUnit
  const buffer = new Float32Array([
    0.0, 0.0, 1.005,
    0.0, 0.0, 1.05,
    0.0, 0.0, 0.0,
    0.0, 1.0, 0.0,
  ]);

  const report = evaluateNormalsBufferNumericQa(buffer, {
    widthPx: 4,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    declaredRange: [-2.0, 2.0],
  });

  // Zero-magnitude vector triggers warning
  assert.equal(report.status, 'warning');
  assert.equal(report.warnings.some((w) => w.includes('zero-length vector')), true);

  const mag = report.numeric.magnitude;
  assert.equal(mag.finiteMagnitudeVectorCount, 4);
  assert.equal(mag.zeroMagnitudeCount, 1);
  assert.equal(mag.nearUnitCount, 2); // Vector 0 and Vector 3
  assert.equal(mag.nearUnitRatio, 2 / 4);
  assert.equal(mag.min, 0.0);
  assert.equal(Math.abs(mag.max - 1.05) < 1e-5, true);
});

test('evaluateNormalsBufferNumericQa excludes partially non-finite vectors from magnitude QA', () => {
  // Vector 0: [0, 0, 1] -> fully finite (mag 1.0)
  // Vector 1: [0, NaN, 1] -> partially non-finite (excluded from magnitude stats)
  // Vector 2: [Infinity, -Infinity, NaN] -> fully non-finite (excluded from magnitude stats)
  const buffer = new Float32Array([
    0.0, 0.0, 1.0,
    0.0, NaN, 1.0,
    Infinity, -Infinity, NaN,
  ]);

  const report = evaluateNormalsBufferNumericQa(buffer, {
    widthPx: 3,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    declaredRange: [-1.0, 1.0],
  });

  assert.equal(report.status, 'warning');
  assert.equal(report.numeric.vectors.totalVectorCount, 3);
  assert.equal(report.numeric.vectors.fullyFiniteVectorCount, 1);
  assert.equal(report.numeric.vectors.partiallyNonFiniteVectorCount, 1);
  assert.equal(report.numeric.vectors.fullyNonFiniteVectorCount, 1);

  // Magnitude evaluated on 1 fully-finite vector only
  assert.equal(report.numeric.magnitude.finiteMagnitudeVectorCount, 1);
  assert.equal(report.numeric.magnitude.nearUnitCount, 1);
  assert.equal(report.numeric.magnitude.mean, 1.0);
});

test('evaluateNormalsBufferNumericQa audits declaredRange and flags below/above violations', () => {
  // Vector 0: [-1.5, 0.0, 0.5] -> -1.5 is below min (-1.0)
  // Vector 1: [0.0, 2.5, 0.5]  -> 2.5 is above max (1.0)
  const buffer = new Float32Array([
    -1.5, 0.0, 0.5,
    0.0, 2.5, 0.5,
  ]);

  const report = evaluateNormalsBufferNumericQa(buffer, {
    widthPx: 2,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    declaredRange: [-1.0, 1.0],
  });

  assert.equal(report.status, 'warning');
  assert.equal(report.warnings.some((w) => w.includes('declared range violation')), true);

  const rangeQa = report.declaredRangeQa;
  assert.equal(rangeQa.status, 'warning');
  assert.equal(rangeQa.finiteValueCountChecked, 6);
  assert.equal(rangeQa.belowRangeCount, 1);
  assert.equal(rangeQa.aboveRangeCount, 1);
  assert.equal(rangeQa.violationCount, 2);
  assert.equal(rangeQa.violationRatio, 2 / 6);
});

test('evaluateNormalsBufferNumericQa marks declaredRange as unvalidated when range is missing', () => {
  const buffer = new Float32Array([0.0, 0.0, 1.0]);

  const report = evaluateNormalsBufferNumericQa(buffer, {
    widthPx: 1,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    declaredRange: null, // missing range
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.declaredRangeQa.status, 'unvalidated');
  assert.equal(report.declaredRangeQa.declaredRange, null);
  assert.equal(report.declaredRangeQa.violationCount, 0);
  assert.equal(report.declaredRangeQa.note.includes('deferred'), true);
});

test('evaluateNormalsBufferNumericQa handles uint8 raw normals without semantic remapping', () => {
  // Raw uint8 buffer with values [128, 128, 255]
  const uint8Buffer = new Uint8Array([128, 128, 255]);

  const report = evaluateNormalsBufferNumericQa(uint8Buffer, {
    widthPx: 1,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    dtype: 'uint8',
    declaredRange: [0, 255],
  });

  // Raw values are inspected directly (no value / 127.5 - 1 remapping)
  assert.equal(report.status, 'pass');
  assert.equal(report.structure.dtype, 'uint8');
  assert.equal(report.declaredRangeQa.status, 'pass');
  assert.equal(report.declaredRangeQa.violationCount, 0);

  // Channels hold raw uint8 values
  assert.equal(report.numeric.channels[0].min, 128);
  assert.equal(report.numeric.channels[1].min, 128);
  assert.equal(report.numeric.channels[2].min, 255);

  // Magnitude computes sqrt(128^2 + 128^2 + 255^2) ~ 312.69
  assert.equal(report.numeric.magnitude.min > 300, true);
  assert.equal(report.semantics.encodingSemantics, 'unvalidated');
});

test('evaluateNormalsBufferNumericQa never mutates the input normals buffer', () => {
  const original = [0.0, -1.0, 0.0, 0.5, NaN, 1.0];
  const buffer = new Float32Array(original);

  evaluateNormalsBufferNumericQa(buffer, {
    widthPx: 2,
    heightPx: 1,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    declaredRange: [-1.0, 1.0],
  });

  assert.equal(buffer[0], 0.0);
  assert.equal(buffer[1], -1.0);
  assert.equal(buffer[2], 0.0);
  assert.equal(buffer[3], 0.5);
  assert.equal(Number.isNaN(buffer[4]), true);
  assert.equal(buffer[5], 1.0);
});

test('evaluateNormalsNumericQa handles missing normals and lazy decoding gracefully', async () => {
  // Missing normals
  const missingReport = await evaluateNormalsNumericQa(null, { view: 'side' });
  assert.equal(missingReport.contract, NORMAL_NUMERIC_QA_CONTRACT);
  assert.equal(missingReport.view, 'side');
  assert.equal(missingReport.availability, 'missing');
  assert.equal(missingReport.status, 'pass');
  assert.equal(missingReport.structure.present, false);
  assert.equal(missingReport.numeric, null);

  // Valid normalized normals
  const floats = new Float32Array([0.0, 0.0, 1.0, 0.0, 1.0, 0.0]);
  const uint8 = new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength);
  let binary = '';
  for (let i = 0; i < uint8.length; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = typeof Buffer !== 'undefined' ? Buffer.from(uint8).toString('base64') : globalThis.btoa(binary);

  const normalized = normalizeNormalsEvidence({
    model: 'surface-normals-v2',
    view: 'side',
    shape: [1, 2, 3],
    dtype: 'float32',
    range: [-1.0, 1.0],
    base64,
  }, { expectedView: 'side' });

  const report = await evaluateNormalsNumericQa(normalized);
  assert.equal(report.status, 'pass');
  assert.equal(report.structure.isInspectable, true);
  assert.equal(report.numeric.magnitude.nearUnitCount, 2);
  assert.equal(report.numeric.magnitude.nearUnitRatio, 1.0);
});

test('evaluateNormalsNumericQa handles loader failure and reports status fail', async () => {
  const badNormals = {
    present: true,
    view: 'front',
    widthPx: 10,
    heightPx: 10,
    channels: 3,
    shape: [10, 10, 3],
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    getDenseData: async () => {
      throw new Error('IO read error');
    },
  };

  const report = await evaluateNormalsNumericQa(badNormals);
  assert.equal(report.status, 'fail');
  assert.equal(report.structure.isInspectable, false);
  assert.equal(report.numeric, null);
  assert.equal(report.issues.some((i) => i.includes('IO read error')), true);
});

test('evaluateSameViewDenseCrossModalQa validates compatible 3-modality view and computes mask stats', async () => {
  // 2 rows, 2 cols (4 pixels)
  // Segmentation:
  // Pixel 0 (0,0): class 0 (Background)
  // Pixel 1 (0,1): class 1 (Apparel - clothing)
  // Pixel 2 (1,0): class 3 (Face_Neck - face/head)
  // Pixel 3 (1,1): class 22 (Torso - body_anatomical)
  const segRaster = new Uint8Array([0, 1, 3, 22]);

  // Pointmap:
  // Pixel 0: [1, 2, 3] (finite)
  // Pixel 1: [4, 5, 6] (finite)
  // Pixel 2: [7, 8, 9] (finite)
  // Pixel 3: [NaN, 11, 12] (invalid)
  const pmBuffer = new Float32Array([
    1, 2, 3,
    4, 5, 6,
    7, 8, 9,
    NaN, 11, 12,
  ]);

  // Normals:
  // Pixel 0: [0, 0, 1] (finite)
  // Pixel 1: [0, 1, 0] (finite)
  // Pixel 2: [0, NaN, 1] (invalid)
  // Pixel 3: [1, 0, 0] (finite)
  const normBuffer = new Float32Array([
    0, 0, 1,
    0, 1, 0,
    0, NaN, 1,
    1, 0, 0,
  ]);

  const viewEvidence = {
    view: 'front',
    segmentation: {
      present: true,
      view: 'front',
      widthPx: 2,
      heightPx: 2,
      raster: segRaster,
    },
    pointmap: {
      present: true,
      view: 'front',
      widthPx: 2,
      heightPx: 2,
      channels: 3,
      shape: [2, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      getDenseData: async () => pmBuffer,
    },
    normals: {
      present: true,
      view: 'front',
      widthPx: 2,
      heightPx: 2,
      channels: 3,
      shape: [2, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      declaredRange: [-1.0, 1.0],
      getDenseData: async () => normBuffer,
    },
  };

  const report = await evaluateSameViewDenseCrossModalQa(viewEvidence);

  assert.equal(report.contract, SAME_VIEW_DENSE_CROSS_MODAL_QA_CONTRACT);
  assert.equal(report.view, 'front');
  // PM and Normals have NaNs, so overall status is warning
  assert.equal(report.status, 'warning');

  // Raster compatibility
  assert.equal(report.rasterCompatibility.segmentationPointmapDimensionsMatch, true);
  assert.equal(report.rasterCompatibility.segmentationNormalsDimensionsMatch, true);
  assert.equal(report.rasterCompatibility.pointmapNormalsDimensionsMatch, true);
  assert.equal(report.rasterCompatibility.sharedWidthPx, 2);
  assert.equal(report.rasterCompatibility.sharedHeightPx, 2);

  // Pixel addressing
  assert.equal(report.pixelAddressing.dimensionalCompatibility, true);
  assert.equal(report.pixelAddressing.pointmapLayoutInspectable, true);
  assert.equal(report.pixelAddressing.normalsLayoutInspectable, true);
  assert.equal(report.pixelAddressing.pixelIndexAddressable, true);
  assert.equal(report.pixelAddressing.semanticPixelCorrespondence, 'unvalidated');

  // Masks
  // 1. Background (pixel 0) -> PM finite, Norm finite -> both finite
  const bg = report.masks.background;
  assert.equal(bg.pixelCount, 1);
  assert.equal(bg.pointmap.fullyFiniteVectorCount, 1);
  assert.equal(bg.pointmap.invalidVectorCount, 0);
  assert.equal(bg.pointmap.fullyFiniteVectorRatio, 1.0);
  assert.equal(bg.normals.fullyFiniteVectorCount, 1);
  assert.equal(bg.normals.invalidVectorCount, 0);
  assert.equal(bg.joint.bothPointmapAndNormalFiniteCount, 1);
  assert.equal(bg.joint.bothFiniteRatio, 1.0);

  // 2. Non-Background (pixels 1, 2, 3) -> 3 pixels
  // Pixel 1: PM finite, Norm finite -> both finite
  // Pixel 2: PM finite, Norm invalid -> PM finite, Norm invalid
  // Pixel 3: PM invalid, Norm finite -> PM invalid, Norm finite
  const nonBg = report.masks.nonBackground;
  assert.equal(nonBg.pixelCount, 3);
  assert.equal(nonBg.pointmap.fullyFiniteVectorCount, 2);
  assert.equal(nonBg.pointmap.invalidVectorCount, 1);
  assert.equal(nonBg.normals.fullyFiniteVectorCount, 2);
  assert.equal(nonBg.normals.invalidVectorCount, 1);
  assert.equal(nonBg.joint.bothPointmapAndNormalFiniteCount, 1);
  assert.equal(nonBg.joint.pointmapFiniteNormalInvalidCount, 1);
  assert.equal(nonBg.joint.pointmapInvalidNormalFiniteCount, 1);
  assert.equal(nonBg.joint.bothInvalidCount, 0);

  // 3. Body Anatomical (pixel 3 only, class 22 Torso)
  // Apparel (1) and Face_Neck (3) are strictly excluded from bodyAnatomical!
  const body = report.masks.bodyAnatomical;
  assert.equal(body.pixelCount, 1);
  assert.equal(body.pointmap.fullyFiniteVectorCount, 0);
  assert.equal(body.pointmap.invalidVectorCount, 1);
  assert.equal(body.normals.fullyFiniteVectorCount, 1);
  assert.equal(body.normals.invalidVectorCount, 0);
  assert.equal(body.joint.bothPointmapAndNormalFiniteCount, 0);
  assert.equal(body.joint.pointmapInvalidNormalFiniteCount, 1);

  // Semantics unvalidated
  assert.equal(report.semantics.pointmapCoordinateFrame, 'unvalidated');
  assert.equal(report.semantics.normalCoordinateFrame, 'unvalidated');
  assert.equal(report.semantics.pointmapNormalFrameRelationship, 'unvalidated');
  assert.equal(report.semantics.semanticPixelCorrespondence, 'unvalidated');
});

test('evaluateSameViewDenseCrossModalQa flags dimension mismatches between segmentation, pointmap, and normals', async () => {
  // Segmentation is 2x2, Pointmap is 3x3
  const viewMismatch = {
    view: 'front',
    segmentation: {
      present: true,
      widthPx: 2,
      heightPx: 2,
      raster: new Uint8Array([0, 0, 0, 0]),
    },
    pointmap: {
      present: true,
      widthPx: 3,
      heightPx: 3,
      channels: 3,
      shape: [3, 3, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      getDenseData: async () => new Float32Array(27),
    },
  };

  const report = await evaluateSameViewDenseCrossModalQa(viewMismatch);

  assert.equal(report.status, 'fail');
  assert.equal(report.rasterCompatibility.segmentationPointmapDimensionsMatch, false);
  assert.equal(report.rasterCompatibility.sharedWidthPx, null);
  assert.equal(report.pixelAddressing.dimensionalCompatibility, false);
  assert.equal(report.pixelAddressing.pixelIndexAddressable, false);
  assert.equal(report.masks, null);
  assert.equal(report.issues.some((i) => i.includes('dimension mismatch')), true);
});

test('evaluateSameViewDenseCrossModalQa handles mixed HWC pointmap and CHW normals with identical logical rasters', async () => {
  const segRaster = new Uint8Array([0, 22]); // 1 row, 2 cols (Pixel 0: bg, Pixel 1: Torso)

  // Pointmap in HWC: (0,0)=[1,2,3], (0,1)=[4,5,6]
  const pmBuffer = new Float32Array([1, 2, 3, 4, 5, 6]);

  // Normals in CHW:
  // Plane 0 (X): [0, 0]
  // Plane 1 (Y): [0, 1]
  // Plane 2 (Z): [1, 0]
  const normBuffer = new Float32Array([
    0, 0,
    0, 1,
    1, 0,
  ]);

  const viewEvidence = {
    view: 'side',
    segmentation: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      raster: segRaster,
    },
    pointmap: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      channels: 3,
      shape: [1, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      getDenseData: async () => pmBuffer,
    },
    normals: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      channels: 3,
      shape: [1, 2, 3],
      denseLayout: DENSE_LAYOUT_CHW_PLANAR,
      declaredRange: [-1.0, 1.0],
      getDenseData: async () => normBuffer,
    },
  };

  const report = await evaluateSameViewDenseCrossModalQa(viewEvidence);

  assert.equal(report.status, 'pass');
  assert.equal(report.pixelAddressing.pixelIndexAddressable, true);
  assert.equal(report.masks.background.pixelCount, 1);
  assert.equal(report.masks.background.joint.bothPointmapAndNormalFiniteCount, 1);
  assert.equal(report.masks.bodyAnatomical.pixelCount, 1);
  assert.equal(report.masks.bodyAnatomical.joint.bothPointmapAndNormalFiniteCount, 1);
});

test('evaluateSameViewDenseCrossModalQa handles missing optional modalities gracefully', async () => {
  // Only segmentation and pointmap (no normals)
  const report = await evaluateSameViewDenseCrossModalQa({
    view: 'front',
    segmentation: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      raster: new Uint8Array([0, 22]),
    },
    pointmap: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      channels: 3,
      shape: [1, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      getDenseData: async () => new Float32Array([1, 2, 3, 4, 5, 6]),
    },
    normals: null,
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.availability.segmentation, true);
  assert.equal(report.availability.pointmap, true);
  assert.equal(report.availability.normals, false);
  assert.equal(report.masks.background.pointmap.fullyFiniteVectorCount, 1);
  assert.equal(report.masks.background.normals, null);
  assert.equal(report.masks.background.joint, null);
});

test('evaluateSameViewDenseCrossModalQa guarantees Front and Side reports remain completely independent', async () => {
  const frontEvidence = {
    view: 'front',
    segmentation: { present: true, widthPx: 2, heightPx: 1, raster: new Uint8Array([0, 22]) },
    pointmap: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      channels: 3,
      shape: [1, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      getDenseData: async () => new Float32Array([1, 2, 3, 4, 5, 6]),
    },
  };

  const sideEvidence = {
    view: 'side',
    segmentation: { present: true, widthPx: 1, heightPx: 1, raster: new Uint8Array([5]) }, // Left_Foot
    normals: {
      present: true,
      widthPx: 1,
      heightPx: 1,
      channels: 3,
      shape: [1, 1, 3],
      denseLayout: DENSE_LAYOUT_CHW_PLANAR,
      declaredRange: [-1.0, 1.0],
      getDenseData: async () => new Float32Array([0, 1, 0]),
    },
  };

  const [frontReport, sideReport] = await Promise.all([
    evaluateSameViewDenseCrossModalQa(frontEvidence),
    evaluateSameViewDenseCrossModalQa(sideEvidence),
  ]);

  assert.equal(frontReport.view, 'front');
  assert.equal(frontReport.availability.pointmap, true);
  assert.equal(frontReport.availability.normals, false);

  assert.equal(sideReport.view, 'side');
  assert.equal(sideReport.availability.pointmap, false);
  assert.equal(sideReport.availability.normals, true);
});

test('evaluateSameViewDenseCrossModalQa decodes pointmap and normals at most once per view analysis', async () => {
  let pmDecodeCount = 0;
  let normDecodeCount = 0;

  const segRaster = new Uint8Array([0, 22]);
  const pmBuffer = new Float32Array([1, 2, 3, 4, 5, 6]);
  const normBuffer = new Float32Array([0, 0, 1, 0, 1, 0]);

  const viewEvidence = {
    view: 'front',
    segmentation: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      raster: segRaster,
    },
    pointmap: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      channels: 3,
      shape: [1, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      getDenseData: async () => {
        pmDecodeCount += 1;
        return pmBuffer;
      },
    },
    normals: {
      present: true,
      widthPx: 2,
      heightPx: 1,
      channels: 3,
      shape: [1, 2, 3],
      denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
      declaredRange: [-1.0, 1.0],
      getDenseData: async () => {
        normDecodeCount += 1;
        return normBuffer;
      },
    },
  };

  const report = await evaluateSameViewDenseCrossModalQa(viewEvidence, { cache: false });

  assert.equal(report.status, 'pass');
  assert.equal(pmDecodeCount, 1, 'Pointmap getDenseData should be called exactly once');
  assert.equal(normDecodeCount, 1, 'Normals getDenseData should be called exactly once');
  assert.equal(report.masks.background.pixelCount, 1);
  assert.equal(report.masks.bodyAnatomical.pixelCount, 1);
});

test('bodyEvidence.js runtime integration populates front and side dense QA and exports sanitized summary', async () => {
  const {
    analyzeLoadedBodyEvidenceAsync,
    buildBodyEvidenceExport,
    clearBodyEvidence,
    getDenseEvidenceQa,
    getFrontDenseEvidenceQa,
    getSideDenseEvidenceQa,
    setBodyEvidencePackage,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  const pmFront = new Float32Array([1, 2, 3, 4, 5, 6]);
  const normFront = new Float32Array([0, 0, 1, 0, 1, 0]);
  const segFront = new Uint8Array([0, 22]); // 1 row, 2 cols

  const pkg = buildBodyEvidencePackage({
    front: {
      pose: {
        model: 'mediapipe',
        view: 'front',
        landmarks: [
          { name: 'nose', x: 0.5, y: 0.2, score: 0.99 },
          { name: 'left_shoulder', x: 0.4, y: 0.4, score: 0.99 },
          { name: 'right_shoulder', x: 0.6, y: 0.4, score: 0.99 },
        ],
      },
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 23,
        class_names: ['Background', 'Torso'],
        class_counts: { Background: 1, Torso: 1 },
        labels: { shape: [1, 2], dtype: 'uint8', base64: 'AAA=' },
      },
      pointmap: {
        model: 'pointmap-v1',
        view: 'front',
        channels: 3,
        shape: [1, 2, 3],
        denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
        dtype: 'float32',
        declaredUnits: 'cm',
        declaredScale: 1.0,
        getDenseData: async () => pmFront,
      },
      normals: {
        model: 'normal-v1',
        view: 'front',
        channels: 3,
        shape: [1, 2, 3],
        denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
        dtype: 'float32',
        declaredRange: [-1.0, 1.0],
        getDenseData: async () => normFront,
      },
    },
    side: {
      pose: {
        model: 'mediapipe',
        view: 'side',
        landmarks: [
          { name: 'left_shoulder', x: 0.5, y: 0.4, score: 0.99 },
        ],
      },
    },
  });

  // Verify Package QA separation: pointmap.qa.numericValues remains unvalidated/deferred
  assert.equal(pkg.front.pointmap.qa.numericValues.status, 'unvalidated');
  assert.equal(pkg.front.pointmap.qa.numericValues.validationMode, 'deferred');
  assert.equal(pkg.front.normals.qa.numericValues.status, 'unvalidated');
  assert.equal(pkg.front.normals.qa.numericValues.validationMode, 'deferred');

  setBodyEvidencePackage(pkg);

  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  const denseQa = getDenseEvidenceQa();
  assert.ok(denseQa, 'denseEvidenceQa should be populated');

  const frontDense = getFrontDenseEvidenceQa();
  assert.ok(frontDense);
  assert.equal(frontDense.pointmap.contract, POINTMAP_NUMERIC_QA_CONTRACT);
  assert.equal(frontDense.pointmap.status, 'pass');
  assert.equal(frontDense.normals.contract, NORMAL_NUMERIC_QA_CONTRACT);
  assert.equal(frontDense.normals.status, 'pass');
  assert.equal(frontDense.crossModal.contract, SAME_VIEW_DENSE_CROSS_MODAL_QA_CONTRACT);
  assert.equal(frontDense.crossModal.status, 'pass');

  const sideDense = getSideDenseEvidenceQa();
  assert.ok(sideDense);
  // Side has no pointmap or normals
  assert.equal(sideDense.pointmap, null);
  assert.equal(sideDense.normals, null);

  // Check diagnostic export
  const exportData = buildBodyEvidenceExport();
  assert.ok(exportData.denseQa);
  assert.ok(exportData.denseQa.front);
  assert.equal(exportData.denseQa.front.pointmap.contract, POINTMAP_NUMERIC_QA_CONTRACT);
  assert.equal(exportData.denseQa.front.normals.contract, NORMAL_NUMERIC_QA_CONTRACT);
  assert.equal(exportData.denseQa.front.crossModal.contract, SAME_VIEW_DENSE_CROSS_MODAL_QA_CONTRACT);
  assert.equal(exportData.views.front.denseQa.crossModal.contract, SAME_VIEW_DENSE_CROSS_MODAL_QA_CONTRACT);

  // Ensure JSON-safety: no TypedArrays, buffers, or functions
  const jsonStr = JSON.stringify(exportData);
  assert.ok(jsonStr.length > 0);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.denseQa.front.pointmap.status, 'pass');

  // Verify reset on clearBodyEvidence
  clearBodyEvidence();
  assert.equal(getDenseEvidenceQa(), null);
  assert.equal(getFrontDenseEvidenceQa(), null);
  assert.equal(getSideDenseEvidenceQa(), null);
});

test('bodyEvidence.js stale async analysis result cannot overwrite newer package state', async () => {
  const {
    analyzeLoadedBodyEvidence,
    clearBodyEvidence,
    getDenseEvidenceQa,
    setBodyEvidencePackage,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  // Package A has slow getDenseData (50ms delay)
  const pkgA = buildBodyEvidencePackage({
    front: {
      pose: {
        model: 'mediapipe',
        view: 'front',
        landmarks: [{ name: 'nose', x: 0.5, y: 0.2, score: 0.99 }],
      },
      pointmap: {
        model: 'pointmap-slow-A',
        view: 'front',
        channels: 3,
        shape: [1, 1, 3],
        denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
        getDenseData: async () => {
          await new Promise((r) => setTimeout(r, 50));
          return new Float32Array([100, 200, 300]);
        },
      },
    },
  });

  // Package B has fast getDenseData (immediate)
  const pkgB = buildBodyEvidencePackage({
    front: {
      pose: {
        model: 'mediapipe',
        view: 'front',
        landmarks: [{ name: 'nose', x: 0.5, y: 0.2, score: 0.99 }],
      },
      pointmap: {
        model: 'pointmap-fast-B',
        view: 'front',
        channels: 3,
        shape: [1, 1, 3],
        denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
        getDenseData: async () => new Float32Array([1, 2, 3]),
      },
    },
  });

  // 1. Load and trigger Package A
  setBodyEvidencePackage(pkgA);
  analyzeLoadedBodyEvidence();

  // 2. Immediately switch to Package B and analyze
  setBodyEvidencePackage(pkgB);
  analyzeLoadedBodyEvidence();

  // 3. Wait for Package B and the delayed Package A to both settle
  await new Promise((r) => setTimeout(r, 80));

  const currentDense = getDenseEvidenceQa();
  assert.ok(currentDense);
  assert.equal(
    currentDense.front.pointmap.structure.model,
    'pointmap-fast-B',
    'Stale Package A async result must NOT overwrite Package B QA state',
  );

  clearBodyEvidence();
});




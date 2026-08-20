import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DENSE_LAYOUT_CHW_PLANAR,
  DENSE_LAYOUT_HWC_INTERLEAVED,
  DENSE_LAYOUT_UNKNOWN,
  normalizePointmapEvidence,
} from './bodyEvidencePackage.js';
import {
  evaluatePointmapBufferNumericQa,
  evaluatePointmapNumericQa,
  POINTMAP_NUMERIC_QA_CONTRACT,
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

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT,
  FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION,
  FRONT_RASTER_SLICE_POLICIES,
  sampleFrontHorizontalRasterSlice,
} from './frontRasterSlice.js';
import {
  canonicalYToPixelRow,
  pixelColumnSpanToFrontMetrology,
} from '../core/pixelMetrologyMapping.js';
import {
  BODY_ANATOMICAL_CLASS_IDS,
  CANONICAL_SEGMENTATION_CLASSES_V0,
} from './anatomicalRegions.js';

test('Front Horizontal Raster Slice Contract v0 exports contract metadata and authoritative policies', () => {
  assert.equal(FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT, 'front-horizontal-raster-slice-v0');
  assert.equal(FRONT_HORIZONTAL_RASTER_SLICE_CONTRACT_VERSION, 'front-horizontal-raster-slice-v0');

  assert.deepEqual(FRONT_RASTER_SLICE_POLICIES.TORSO_ONLY, [22]);
  assert.deepEqual(FRONT_RASTER_SLICE_POLICIES.BODY_ANATOMICAL, Array.from(BODY_ANATOMICAL_CLASS_IDS));
  assert.equal(FRONT_RASTER_SLICE_POLICIES.BODY_ANATOMICAL.length, 13);

  const expectedForeground = CANONICAL_SEGMENTATION_CLASSES_V0.filter((c) => c.classId !== 0).map((c) => c.classId);
  assert.deepEqual(FRONT_RASTER_SLICE_POLICIES.FOREGROUND, expectedForeground);
  assert.equal(FRONT_RASTER_SLICE_POLICIES.FOREGROUND.length, 28);
});

test('canonicalYToPixelRow maps vertical heights to image pixel rows correctly with exact boundary handling', () => {
  const heightPx = 2000;

  // yCm = 200 (top of canonical domain) -> row 0
  const top = canonicalYToPixelRow(200, heightPx, 200);
  assert.ok(top);
  assert.equal(top.row, 0);
  assert.equal(top.normalizedV, 0);

  // yCm = 0 (bottom of canonical domain) -> row 1999
  const bottom = canonicalYToPixelRow(0, heightPx, 200);
  assert.ok(bottom);
  assert.equal(bottom.row, 1999);
  assert.equal(bottom.normalizedV, 1);

  // yCm = 100 (midpoint) -> row 1000
  const mid = canonicalYToPixelRow(100, heightPx, 200);
  assert.ok(mid);
  assert.equal(mid.row, 1000);
  assert.equal(mid.normalizedV, 0.5);

  // yCm = 150 -> row 500
  const upper = canonicalYToPixelRow(150, heightPx, 200);
  assert.ok(upper);
  assert.equal(upper.row, 500);
  assert.equal(upper.normalizedV, 0.25);

  // Out of range coordinates return null (not clamped)
  assert.equal(canonicalYToPixelRow(-5, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(205, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(NaN, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(Infinity, heightPx, 200), null);
});

test('pixelColumnSpanToFrontMetrology computes exact normalized and metric X bounds', () => {
  const widthPx = 2000;

  // Single pixel column [500, 500]
  const single = pixelColumnSpanToFrontMetrology(500, 500, widthPx, 200);
  assert.ok(single);
  assert.equal(single.boundsNormalized.minU, 500 / 2000); // 0.25
  assert.equal(single.boundsNormalized.maxU, 501 / 2000); // 0.2505
  assert.equal(single.boundsCm.minX, 50.0); // 500 / 2000 * 200
  assert.equal(single.boundsCm.maxX, 50.1); // 501 / 2000 * 200

  // Multi-column span [200, 799] (600 pixels)
  const span = pixelColumnSpanToFrontMetrology(200, 799, widthPx, 200);
  assert.ok(span);
  assert.equal(span.boundsNormalized.minU, 0.1); // 200 / 2000
  assert.equal(span.boundsNormalized.maxU, 0.4); // 800 / 2000
  assert.equal(span.boundsCm.minX, 20.0); // 200 / 2000 * 200
  assert.equal(span.boundsCm.maxX, 80.0); // 800 / 2000 * 200
});

test('detects a single contiguous horizontal run on a sampled raster row', () => {
  const widthPx = 10;
  const heightPx = 4;
  // 4 rows of 10 pixels: row 1 (yCm = 150) has Torso (22) from col 3 to 6
  const raster = new Uint8Array(40);
  // Fill row 1 (index 10..19): cols 3, 4, 5, 6
  for (let c = 3; c <= 6; c += 1) {
    raster[10 + c] = 22;
  }

  // yCm = 150 maps to normalizedV = (200 - 150)/200 = 0.25 -> row 0.25 * 4 = 1
  const result = sampleFrontHorizontalRasterSlice(raster, {
    widthPx,
    heightPx,
    yCm: 150,
    targetClassIds: FRONT_RASTER_SLICE_POLICIES.TORSO_ONLY,
  });

  assert.equal(result.contract, 'front-horizontal-raster-slice-v0');
  assert.equal(result.view, 'front');
  assert.equal(result.requestedYcm, 150);
  assert.equal(result.sampledRow, 1);
  assert.equal(result.rowNormalizedV, 0.25);
  assert.deepEqual(result.targetClassIds, [22]);
  assert.equal(result.summary.runCount, 1);
  assert.equal(result.summary.totalMatchedPixels, 4);
  assert.equal(result.issues.length, 0);

  const run = result.runs[0];
  assert.equal(run.startCol, 3);
  assert.equal(run.endCol, 6);
  assert.equal(run.pixelCount, 4);
  assert.equal(run.boundsNormalized.minU, 0.3); // 3 / 10
  assert.equal(run.boundsNormalized.maxU, 0.7); // 7 / 10
  assert.equal(run.boundsCm.minX, 60.0); // 3 / 10 * 200
  assert.equal(run.boundsCm.maxX, 140.0); // 7 / 10 * 200
});

test('detects multiple separated runs without implicit merging or filtering', () => {
  const widthPx = 20;
  const heightPx = 2;
  // Row 0 has Left_Upper_Arm (11) at [2..4], Torso (22) at [8..12], Right_Upper_Arm (20) at [16..18]
  const raster = new Uint8Array(40);
  for (let c = 2; c <= 4; c += 1) raster[c] = 11;
  for (let c = 8; c <= 12; c += 1) raster[c] = 22;
  for (let c = 16; c <= 18; c += 1) raster[c] = 20;

  // yCm = 200 maps to row 0
  const result = sampleFrontHorizontalRasterSlice(raster, {
    widthPx,
    heightPx,
    yCm: 200,
    targetClassIds: FRONT_RASTER_SLICE_POLICIES.BODY_ANATOMICAL,
  });

  assert.equal(result.summary.runCount, 3);
  assert.equal(result.summary.totalMatchedPixels, 3 + 5 + 3); // 11

  // Run 1: Left arm
  assert.equal(result.runs[0].startCol, 2);
  assert.equal(result.runs[0].endCol, 4);
  assert.equal(result.runs[0].pixelCount, 3);
  assert.equal(result.runs[0].boundsCm.minX, 20.0); // 2/20 * 200
  assert.equal(result.runs[0].boundsCm.maxX, 50.0); // 5/20 * 200

  // Run 2: Torso
  assert.equal(result.runs[1].startCol, 8);
  assert.equal(result.runs[1].endCol, 12);
  assert.equal(result.runs[1].pixelCount, 5);
  assert.equal(result.runs[1].boundsCm.minX, 80.0); // 8/20 * 200
  assert.equal(result.runs[1].boundsCm.maxX, 130.0); // 13/20 * 200

  // Run 3: Right arm
  assert.equal(result.runs[2].startCol, 16);
  assert.equal(result.runs[2].endCol, 18);
  assert.equal(result.runs[2].pixelCount, 3);
  assert.equal(result.runs[2].boundsCm.minX, 160.0); // 16/20 * 200
  assert.equal(result.runs[2].boundsCm.maxX, 190.0); // 19/20 * 200
});

test('handles no matching pixels on sampled row cleanly with runCount 0', () => {
  const widthPx = 10;
  const heightPx = 2;
  const raster = new Uint8Array(20); // all 0 (Background)

  const result = sampleFrontHorizontalRasterSlice(raster, {
    widthPx,
    heightPx,
    yCm: 100,
    targetClassIds: FRONT_RASTER_SLICE_POLICIES.TORSO_ONLY,
  });

  assert.equal(result.sampledRow, 1);
  assert.equal(result.summary.runCount, 0);
  assert.equal(result.summary.totalMatchedPixels, 0);
  assert.deepEqual(result.runs, []);
  assert.equal(result.issues.length, 0);
});

test('handles out-of-range yCm without silent clamping or scanning', () => {
  const widthPx = 10;
  const heightPx = 2;
  const raster = new Uint8Array(20);

  const resBelow = sampleFrontHorizontalRasterSlice(raster, {
    widthPx,
    heightPx,
    yCm: -10,
    targetClassIds: [22],
  });
  assert.equal(resBelow.sampledRow, null);
  assert.deepEqual(resBelow.runs, []);
  assert.equal(resBelow.summary.runCount, 0);
  assert.ok(resBelow.issues.some((i) => i.includes('outside valid metrology domain')));

  const resAbove = sampleFrontHorizontalRasterSlice(raster, {
    widthPx,
    heightPx,
    yCm: 250,
    targetClassIds: [22],
  });
  assert.equal(resAbove.sampledRow, null);
  assert.deepEqual(resAbove.runs, []);
  assert.ok(resAbove.issues.some((i) => i.includes('outside valid metrology domain')));
});

test('handles missing or invalid inputs gracefully', () => {
  // Missing raster
  const resNoRaster = sampleFrontHorizontalRasterSlice(null, {
    widthPx: 10,
    heightPx: 10,
    yCm: 100,
    targetClassIds: [22],
  });
  assert.equal(resNoRaster.summary.runCount, 0);
  assert.ok(resNoRaster.issues.some((i) => i.includes('Invalid or missing raster buffer')));

  // Invalid dimensions
  const resBadDim = sampleFrontHorizontalRasterSlice(new Uint8Array(10), {
    widthPx: -1,
    heightPx: 0,
    yCm: 100,
    targetClassIds: [22],
  });
  assert.equal(resBadDim.summary.runCount, 0);
  assert.ok(resBadDim.issues.some((i) => i.includes('Invalid raster dimensions')));

  // Empty targetClassIds
  const resNoClasses = sampleFrontHorizontalRasterSlice(new Uint8Array(100), {
    widthPx: 10,
    heightPx: 10,
    yCm: 100,
    targetClassIds: [],
  });
  assert.equal(resNoClasses.summary.runCount, 0);
  assert.ok(resNoClasses.issues.some((i) => i.includes('No valid targetClassIds provided')));
});

test('does not mutate input raster buffer', () => {
  const widthPx = 10;
  const heightPx = 2;
  const raster = new Uint8Array([0, 22, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const copy = new Uint8Array(raster);

  sampleFrontHorizontalRasterSlice(raster, {
    widthPx,
    heightPx,
    yCm: 180,
    targetClassIds: [22],
  });

  assert.deepEqual(raster, copy);
});

test('bodyEvidence.js getFrontHorizontalRasterSlice integrates with active Front runtime state', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getFrontHorizontalRasterSlice,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 4x4 image
  // Row 1 (yCm = 150): [0, 22, 22, 0]
  const rasterFront = new Uint8Array([
    0, 0, 0, 0,
    0, 22, 22, 0,
    0, 22, 22, 0,
    0, 0, 0, 0,
  ]);

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 12, Torso: 4 },
        labels: { shape: [4, 4], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  // yCm = 150 -> row 1
  const slice = getFrontHorizontalRasterSlice({
    yCm: 150,
    targetClassIds: FRONT_RASTER_SLICE_POLICIES.TORSO_ONLY,
  });

  assert.ok(slice);
  assert.equal(slice.contract, 'front-horizontal-raster-slice-v0');
  assert.equal(slice.sampledRow, 1);
  assert.equal(slice.summary.runCount, 1);
  assert.equal(slice.summary.totalMatchedPixels, 2);
  assert.equal(slice.runs[0].startCol, 1);
  assert.equal(slice.runs[0].endCol, 2);
  assert.equal(slice.runs[0].boundsCm.minX, 50.0); // 1/4 * 200
  assert.equal(slice.runs[0].boundsCm.maxX, 150.0); // 3/4 * 200

  // Clear package
  setBodyEvidencePackage(null);
  assert.equal(getFrontHorizontalRasterSlice({ yCm: 150, targetClassIds: [22] }), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLOR_LOOKUP_TABLE,
  createColorLookupTable,
  clearSegmentationOverlayCache,
  renderFrontSegmentationOverlay,
  renderSideSegmentationOverlay,
  syncFrontSegmentationVisibility,
  syncSideSegmentationVisibility,
  setupSegmentationOverlay2d,
} from './segmentationOverlay2d.js';
import {
  setBodyEvidencePackage,
  selectFrontSegClass,
  selectSideSegClass,
  clearAllBodyEvidenceSelections,
  analyzeLoadedBodyEvidence,
  clearBodyEvidence,
} from '../features/bodyEvidence.js';
import { buildBodyEvidencePackage } from '../features/bodyEvidencePackage.js';
import {
  applyViewSetting,
  VIEW_SETTING_IDS,
} from './viewControls.js';

function encodeUint8ArrayToBase64(uint8) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < uint8.length; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

function createMockCanvas() {
  let putImageDataCalls = 0;
  let lastImageData = null;
  return {
    width: 0,
    height: 0,
    hidden: true,
    get putImageDataCalls() {
      return putImageDataCalls;
    },
    get lastImageData() {
      return lastImageData;
    },
    getContext(type) {
      if (type !== '2d') return null;
      return {
        createImageData(w, h) {
          const buf = new ArrayBuffer(w * h * 4);
          return {
            width: w,
            height: h,
            data: new Uint8ClampedArray(buf),
          };
        },
        putImageData(imgData) {
          putImageDataCalls += 1;
          lastImageData = imgData;
        },
        clearRect() {},
      };
    },
  };
}

test('color lookup table maps class 0 to transparent and classes 1..N to translucent colors', () => {
  const table = createColorLookupTable(95);
  assert.equal(table.length, 256);

  // Class 0 must be 0 (alpha 0, completely transparent)
  assert.equal(table[0], 0);

  // Buffer to inspect bytes
  const buf = new ArrayBuffer(4);
  const u32 = new Uint32Array(buf);
  const u8 = new Uint8ClampedArray(buf);

  // Class 1
  u32[0] = table[1];
  assert.equal(u8[3], 95); // Alpha is 95
  assert.ok(u8[0] > 0 || u8[1] > 0 || u8[2] > 0); // Non-zero color

  // Class 2
  u32[0] = table[2];
  assert.equal(u8[3], 95);

  // Different classes have distinct colors
  assert.notEqual(table[1], table[2]);
});

test('renderFrontSegmentationOverlay and renderSideSegmentationOverlay handle null and non-canvas safely', () => {
  clearSegmentationOverlayCache();
  assert.doesNotThrow(() => renderFrontSegmentationOverlay(null));
  assert.doesNotThrow(() => renderSideSegmentationOverlay(null));

  const dummyEl = { hidden: true };
  assert.doesNotThrow(() => renderFrontSegmentationOverlay(dummyEl));
  assert.doesNotThrow(() => renderSideSegmentationOverlay(dummyEl));
  assert.equal(dummyEl.hidden, true);
});

test('renderFrontSegmentationOverlay and renderSideSegmentationOverlay paint when evidence is analyzed and cache redraws', () => {
  clearBodyEvidence();
  clearSegmentationOverlayCache();

  const raster = new Uint8Array([0, 1, 1, 0]);
  const base64 = encodeUint8ArrayToBase64(raster);

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 2,
        class_names: ['background', 'skin'],
        class_counts: { background: 2, skin: 2 },
        labels: { shape: [2, 2], dtype: 'uint8', base64 },
      },
    },
    side: {
      segmentation: {
        model: 'schp',
        view: 'side',
        num_classes: 2,
        class_names: ['background', 'skin'],
        class_counts: { background: 2, skin: 2 },
        labels: { shape: [2, 2], dtype: 'uint8', base64 },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  const res = analyzeLoadedBodyEvidence();
  assert.equal(res.ok, true);

  const frontCanvas = createMockCanvas();
  const sideCanvas = createMockCanvas();

  // 1. Initial render Front
  renderFrontSegmentationOverlay(frontCanvas);
  assert.equal(frontCanvas.hidden, false);
  assert.equal(frontCanvas.width, 2);
  assert.equal(frontCanvas.height, 2);
  assert.equal(frontCanvas.putImageDataCalls, 1);
  assert.ok(frontCanvas.lastImageData);

  // 2. Second render with same data -> cached, no redundant putImageData
  renderFrontSegmentationOverlay(frontCanvas);
  assert.equal(frontCanvas.hidden, false);
  assert.equal(frontCanvas.putImageDataCalls, 1); // No new call to putImageData

  // 3. Side render
  renderSideSegmentationOverlay(sideCanvas);
  assert.equal(sideCanvas.hidden, false);
  assert.equal(sideCanvas.width, 2);
  assert.equal(sideCanvas.height, 2);
  assert.equal(sideCanvas.putImageDataCalls, 1);

  // 4. Toggle view setting off -> canvas hidden
  applyViewSetting(VIEW_SETTING_IDS.FRONT_SEGMENTATION, false);
  renderFrontSegmentationOverlay(frontCanvas);
  assert.equal(frontCanvas.hidden, true);

  // Toggle view setting back on -> canvas shown without re-rasterizing
  applyViewSetting(VIEW_SETTING_IDS.FRONT_SEGMENTATION, true);
  renderFrontSegmentationOverlay(frontCanvas);
  assert.equal(frontCanvas.hidden, false);
  assert.equal(frontCanvas.putImageDataCalls, 1); // Still 1

  // 5. Clear evidence -> canvas hidden and cache cleared
  clearBodyEvidence();
  renderFrontSegmentationOverlay(frontCanvas);
  assert.equal(frontCanvas.hidden, true);
  renderSideSegmentationOverlay(sideCanvas);
  assert.equal(sideCanvas.hidden, true);
});

test('syncFrontSegmentationVisibility and syncSideSegmentationVisibility toggle visibility in O(1) without re-rendering', () => {
  clearBodyEvidence();
  clearSegmentationOverlayCache();

  const raster = new Uint8Array([0, 1, 1, 0]);
  const base64 = encodeUint8ArrayToBase64(raster);

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 2,
        class_names: ['background', 'skin'],
        class_counts: { background: 2, skin: 2 },
        labels: { shape: [2, 2], dtype: 'uint8', base64 },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const mockCanvas = createMockCanvas();

  // Initial paint
  renderFrontSegmentationOverlay(mockCanvas);
  assert.equal(mockCanvas.hidden, false);
  assert.equal(mockCanvas.putImageDataCalls, 1);

  // Toggle off via setting
  applyViewSetting(VIEW_SETTING_IDS.FRONT_SEGMENTATION, false);
  syncFrontSegmentationVisibility(mockCanvas);
  assert.equal(mockCanvas.hidden, true);
  assert.equal(mockCanvas.putImageDataCalls, 1); // No putImageData

  // Toggle on via setting
  applyViewSetting(VIEW_SETTING_IDS.FRONT_SEGMENTATION, true);
  syncFrontSegmentationVisibility(mockCanvas);
  assert.equal(mockCanvas.hidden, false);
  assert.equal(mockCanvas.putImageDataCalls, 1); // Still 1, reused cached bitmap
});

test('invariant: Front and Side caches and class selections remain strictly isolated', () => {
  clearBodyEvidence();
  clearSegmentationOverlayCache();

  const rasterFront = new Uint8Array([0, 1, 1, 0]);
  const rasterSide = new Uint8Array([0, 2, 2, 0]);

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 3,
        class_names: ['background', 'skin', 'cloth'],
        class_counts: { background: 2, skin: 2, cloth: 0 },
        labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
    side: {
      segmentation: {
        model: 'schp',
        view: 'side',
        num_classes: 3,
        class_names: ['background', 'skin', 'cloth'],
        class_counts: { background: 2, skin: 0, cloth: 2 },
        labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const frontCanvas = createMockCanvas();
  const sideCanvas = createMockCanvas();

  renderFrontSegmentationOverlay(frontCanvas);
  renderSideSegmentationOverlay(sideCanvas);
  assert.equal(frontCanvas.putImageDataCalls, 1);
  assert.equal(sideCanvas.putImageDataCalls, 1);

  // Selecting a class on Front only repaints Front
  selectFrontSegClass(1);
  renderFrontSegmentationOverlay(frontCanvas);
  renderSideSegmentationOverlay(sideCanvas);
  assert.equal(frontCanvas.putImageDataCalls, 2); // Repainted due to class change
  assert.equal(sideCanvas.putImageDataCalls, 1); // Side was NOT repainted

  // Selecting a class on Side only repaints Side
  selectSideSegClass(2);
  renderFrontSegmentationOverlay(frontCanvas);
  renderSideSegmentationOverlay(sideCanvas);
  assert.equal(frontCanvas.putImageDataCalls, 2); // Front unchanged
  assert.equal(sideCanvas.putImageDataCalls, 2); // Side repainted
});

test('invariant: setupSegmentationOverlay2d callbacks register without overwriting each other', () => {
  let frontRefreshCalled = 0;
  let sideRefreshCalled = 0;

  setupSegmentationOverlay2d(() => {
    frontRefreshCalled += 1;
  }, null);

  setupSegmentationOverlay2d(null, () => {
    sideRefreshCalled += 1;
  });

  // Verify that registering side refresh did not discard front refresh
  clearAllBodyEvidenceSelections();
  assert.ok(frontRefreshCalled >= 1);
  assert.ok(sideRefreshCalled >= 1);
});

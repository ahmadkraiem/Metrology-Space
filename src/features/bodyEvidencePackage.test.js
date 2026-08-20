import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBodyEvidencePackage,
  decodeDenseBufferFromBase64,
  DENSE_LAYOUT_CHW_PLANAR,
  DENSE_LAYOUT_HWC_INTERLEAVED,
  DENSE_LAYOUT_UNKNOWN,
  getDenseElementIndex,
  getDenseVectorIndices,
  normalizeImageEvidence,
  normalizeNormalsEvidence,
  normalizePointmapEvidence,
  PACKAGE_VERSION,
  readDenseVector,
  resolveDenseTensorLayout,
} from './bodyEvidencePackage.js';

function encodeFloat32ToBase64(float32Array) {
  const uint8 = new Uint8Array(float32Array.buffer, float32Array.byteOffset, float32Array.byteLength);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < uint8.length; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }
  return globalThis.btoa(binary);
}

test('decodeDenseBufferFromBase64 decodes float32 and uint8 with proper alignment', () => {
  const floats = new Float32Array([1.0, 2.5, -3.25, 0.0]);
  const b64Floats = encodeFloat32ToBase64(floats);
  const decodedFloats = decodeDenseBufferFromBase64(b64Floats, 'float32');

  assert.equal(decodedFloats instanceof Float32Array, true);
  assert.equal(decodedFloats.length, 4);
  assert.equal(decodedFloats[0], 1.0);
  assert.equal(decodedFloats[1], 2.5);
  assert.equal(decodedFloats[2], -3.25);
  assert.equal(decodedFloats[3], 0.0);
});

test('normalizeImageEvidence normalizes format, dimensions, view and QA status', () => {
  const valid = normalizeImageEvidence({
    filename: 'front_subject.PNG',
    width: 1920,
    height: 1080,
    view: 'front',
  }, { expectedView: 'front' });

  assert.equal(valid.present, true);
  assert.equal(valid.filename, 'front_subject.PNG');
  assert.equal(valid.format, 'png');
  assert.equal(valid.widthPx, 1920);
  assert.equal(valid.heightPx, 1080);
  assert.equal(valid.qa.status, 'pass');
  assert.deepEqual(valid.qa.issues, []);

  // View mismatch
  const mismatch = normalizeImageEvidence({
    filename: 'side.jpg',
    width: 1000,
    height: 1000,
    view: 'side',
  }, { expectedView: 'front' });
  assert.equal(mismatch.qa.status, 'fail');
  assert.equal(mismatch.qa.issues.some((i) => i.includes('view mismatch')), true);

  // Missing image
  const missing = normalizeImageEvidence(null);
  assert.equal(missing.present, false);
  assert.equal(missing.status, 'missing');
  assert.equal(missing.qa.status, 'pass');
});

test('normalizePointmapEvidence normalizes metadata and marks unvalidated semantics', async () => {
  const floats = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]); // 1x2x3
  const base64 = encodeFloat32ToBase64(floats);

  const normalized = normalizePointmapEvidence({
    model: 'dense-pointmap-v1',
    view: 'front',
    shape: [1, 2, 3],
    dtype: 'float32',
    units: 'meters',
    scale: 0.001,
    base64,
  }, { expectedView: 'front', expectedWidthPx: 2, expectedHeightPx: 1 });

  assert.equal(normalized.present, true);
  assert.equal(normalized.model, 'dense-pointmap-v1');
  assert.equal(normalized.view, 'front');
  assert.equal(normalized.channels, 3);
  assert.deepEqual(normalized.shape, [1, 2, 3]);
  assert.equal(normalized.widthPx, 2);
  assert.equal(normalized.heightPx, 1);
  assert.equal(normalized.dtype, 'float32');
  assert.equal(normalized.declaredUnits, 'meters');
  assert.equal(normalized.declaredScale, 0.001);

  // Strict guardrail semantics: unvalidated markings
  assert.equal(normalized.coordinateFrame, 'unvalidated');
  assert.equal(normalized.scaleSemantics, 'unvalidated');
  assert.equal(normalized.canonicalAxisMeaning, 'unvalidated');
  assert.equal(normalized.qa.coordinateFrame.status, 'unvalidated');
  assert.equal(normalized.qa.scaleSemantics.status, 'unvalidated');
  assert.equal(normalized.qa.canonicalAxisMeaning.status, 'unvalidated');
  assert.equal(normalized.qa.numericValues.status, 'unvalidated');
  assert.equal(normalized.qa.numericValues.validationMode, 'deferred');

  // Overall structural QA passes
  assert.equal(normalized.qa.status, 'pass');
  assert.equal(normalized.qa.shapeCheck.status, 'pass');
  assert.equal(normalized.qa.dtypeCheck.status, 'pass');
  assert.equal(normalized.qa.rasterCompatibility.status, 'pass');

  // Lazy dense decode
  const dense = await normalized.getDenseData({ cache: true });
  assert.equal(dense instanceof Float32Array, true);
  assert.equal(dense.length, 6);
  assert.equal(Math.abs(dense[0] - 0.1) < 1e-5, true);
});

test('normalizePointmapEvidence flags raster dimension mismatches with view', () => {
  const normalized = normalizePointmapEvidence({
    view: 'front',
    shape: [500, 500, 3],
    dtype: 'float32',
  }, { expectedView: 'front', expectedWidthPx: 1000, expectedHeightPx: 1000 });

  assert.equal(normalized.qa.status, 'fail');
  assert.equal(normalized.qa.rasterCompatibility.status, 'fail');
  assert.equal(normalized.qa.issues.some((i) => i.includes('raster dimensions')), true);
});

test('normalizeNormalsEvidence preserves declaredRange and lazy decodes with unvalidated semantics', async () => {
  const floats = new Float32Array([0.0, 1.0, 0.0]); // 1x1x3
  const base64 = encodeFloat32ToBase64(floats);

  const normalized = normalizeNormalsEvidence({
    model: 'surface-normals-net',
    view: 'side',
    shape: [1, 1, 3],
    dtype: 'float32',
    range: [-1, 1],
    base64,
  }, { expectedView: 'side', expectedWidthPx: 1, expectedHeightPx: 1 });

  assert.equal(normalized.present, true);
  assert.equal(normalized.model, 'surface-normals-net');
  assert.equal(normalized.view, 'side');
  assert.deepEqual(normalized.shape, [1, 1, 3]);
  assert.deepEqual(normalized.declaredRange, [-1, 1]);

  // Unvalidated markings
  assert.equal(normalized.coordinateFrame, 'unvalidated');
  assert.equal(normalized.orientationSemantics, 'unvalidated');
  assert.equal(normalized.qa.coordinateFrame.status, 'unvalidated');
  assert.equal(normalized.qa.orientationSemantics.status, 'unvalidated');
  assert.equal(normalized.qa.numericValues.status, 'unvalidated');
  assert.equal(normalized.qa.numericValues.validationMode, 'deferred');
  assert.equal(normalized.qa.status, 'pass');

  const dense = await normalized.getDenseData();
  assert.equal(dense instanceof Float32Array, true);
  assert.equal(dense.length, 3);
  assert.equal(dense[1], 1.0);
});

test('buildBodyEvidencePackage builds canonical package with Front and Side modalities', () => {
  const pkg = buildBodyEvidencePackage({
    sampleId: 'subject_042',
    front: {
      image: { filename: 'front.png', width: 2000, height: 2000, view: 'front' },
      pose: {
        keypoints_named: [
          { name: 'neck', x: 1000, y: 500, score: 0.95 },
          { name: 'left_shoulder', x: 800, y: 600, score: 0.9 },
        ],
      },
      pointmap: {
        view: 'front',
        shape: [2000, 2000, 3],
        dtype: 'float32',
        units: 'cm',
        scale: 1.0,
      },
      normals: {
        view: 'front',
        shape: [2000, 2000, 3],
        dtype: 'float32',
        range: [-1, 1],
      },
    },
    side: {
      image: { filename: 'side.png', width: 2000, height: 2000, view: 'side' },
      pose: {
        keypoints_named: [
          { name: 'neck', x: 1000, y: 500, score: 0.95 },
        ],
      },
    },
  });

  assert.equal(pkg.version, PACKAGE_VERSION);
  assert.equal(pkg.sampleId, 'subject_042');
  assert.equal(pkg.front.image.present, true);
  assert.equal(pkg.front.pose.core, 2);
  assert.equal(pkg.front.pointmap.present, true);
  assert.equal(pkg.front.normals.present, true);
  assert.equal(pkg.side.image.present, true);
  assert.equal(pkg.side.pose.core, 1);
  assert.equal(pkg.side.pointmap.present, false);
  assert.equal(pkg.side.normals.present, false);

  // Missing optional modalities (side pointmap/normals) do not fail the package
  assert.equal(pkg.front.qa.status, 'pass');
  assert.equal(pkg.side.qa.status, 'pass');
  assert.equal(pkg.qa.status, 'pass');
  assert.equal(pkg.qa.views.front, true);
  assert.equal(pkg.qa.views.side, true);
  assert.equal(pkg.qa.modalitiesAvailable.front.pointmap, true);
  assert.equal(pkg.qa.modalitiesAvailable.side.pointmap, false);
});

test('normalizePointmapEvidence handles non-standard dtypes and warns without failing', () => {
  const normalized = normalizePointmapEvidence({
    view: 'front',
    shape: [100, 100, 3],
    dtype: 'float16',
  }, { expectedView: 'front' });

  assert.equal(normalized.qa.status, 'pass');
  assert.equal(normalized.qa.dtypeCheck.status, 'pass');
});

test('normalizePointmapEvidence detects invalid shapes and marks status fail', () => {
  const badShape = normalizePointmapEvidence({
    view: 'front',
    shape: [100], // 1D shape
    dtype: 'float32',
  }, { expectedView: 'front' });

  assert.equal(badShape.qa.status, 'fail');
  assert.equal(badShape.qa.shapeCheck.status, 'fail');
  assert.equal(badShape.qa.issues.some((i) => i.includes('shape')), true);
});

test('normalizeNormalsEvidence handles uint8 dtype and default 0..255 range', () => {
  const normalized = normalizeNormalsEvidence({
    view: 'front',
    shape: [50, 50, 3],
    dtype: 'uint8',
  }, { expectedView: 'front' });

  assert.equal(normalized.qa.status, 'pass');
  assert.deepEqual(normalized.declaredRange, [0, 255]);
});

test('buildBodyEvidencePackage handles single view (front only) safely', () => {
  const pkg = buildBodyEvidencePackage({
    sampleId: 'front_only_subject',
    front: {
      image: { filename: 'front.jpg', width: 1000, height: 1000, view: 'front' },
    },
  });

  assert.equal(pkg.qa.views.front, true);
  assert.equal(pkg.qa.views.side, false);
  assert.equal(pkg.qa.status, 'pass');
});

test('resolveDenseTensorLayout correctly resolves HWC_INTERLEAVED from [H, W, 3]', () => {
  const layout = resolveDenseTensorLayout([100, 200, 3]);
  assert.equal(layout.valid, true);
  assert.equal(layout.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);
  assert.deepEqual(layout.declaredShape, [100, 200, 3]);
  assert.deepEqual(layout.normalizedShape, [100, 200, 3]);
  assert.equal(layout.heightPx, 100);
  assert.equal(layout.widthPx, 200);
  assert.equal(layout.channels, 3);
  assert.equal(layout.expectedElements, 60000);
  assert.deepEqual(layout.issues, []);
});

test('resolveDenseTensorLayout correctly resolves CHW_PLANAR from [3, H, W]', () => {
  const layout = resolveDenseTensorLayout([3, 150, 250]);
  assert.equal(layout.valid, true);
  assert.equal(layout.denseLayout, DENSE_LAYOUT_CHW_PLANAR);
  assert.deepEqual(layout.declaredShape, [3, 150, 250]);
  assert.deepEqual(layout.normalizedShape, [150, 250, 3]);
  assert.equal(layout.heightPx, 150);
  assert.equal(layout.widthPx, 250);
  assert.equal(layout.channels, 3);
  assert.equal(layout.expectedElements, 112500);
  assert.deepEqual(layout.issues, []);
});

test('resolveDenseTensorLayout handles [3, 3, 3] and explicit layout overrides', () => {
  const cube = resolveDenseTensorLayout([3, 3, 3]);
  assert.equal(cube.valid, true);
  assert.equal(cube.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);

  const explicitChw = resolveDenseTensorLayout([3, 3, 3], { explicitLayout: 'CHW_PLANAR' });
  assert.equal(explicitChw.denseLayout, DENSE_LAYOUT_CHW_PLANAR);
});

test('resolveDenseTensorLayout marks 2D shape [H, W] as UNKNOWN layout and warns', () => {
  const layout = resolveDenseTensorLayout([100, 100]);
  assert.equal(layout.valid, true);
  assert.equal(layout.denseLayout, DENSE_LAYOUT_UNKNOWN);
  assert.deepEqual(layout.declaredShape, [100, 100]);
  assert.deepEqual(layout.normalizedShape, [100, 100]);
  assert.equal(layout.heightPx, 100);
  assert.equal(layout.widthPx, 100);
  assert.equal(layout.channels, 1);
  assert.equal(layout.warnings.length > 0, true);
  assert.equal(layout.warnings[0].includes('cannot be proven'), true);
});

test('resolveDenseTensorLayout flags invalid / non-positive / non-integer shapes', () => {
  assert.equal(resolveDenseTensorLayout(null).valid, false);
  assert.equal(resolveDenseTensorLayout([10]).valid, false);
  assert.equal(resolveDenseTensorLayout([-10, 20, 3]).valid, false);
  assert.equal(resolveDenseTensorLayout([10.5, 20, 3]).valid, false);
  assert.equal(resolveDenseTensorLayout([10, 20, 3, 4]).valid, false);
});

test('readDenseVector accurately reads first, middle, and last pixels for HWC_INTERLEAVED', () => {
  // 2 rows, 3 cols, 3 channels (H=2, W=3, C=3)
  // Pixel (0,0): [1, 2, 3]
  // Pixel (0,1): [4, 5, 6]
  // Pixel (0,2): [7, 8, 9]
  // Pixel (1,0): [10, 11, 12]
  // Pixel (1,1): [13, 14, 15]
  // Pixel (1,2): [16, 17, 18]
  const hwcBuffer = new Float32Array([
    1, 2, 3,
    4, 5, 6,
    7, 8, 9,
    10, 11, 12,
    13, 14, 15,
    16, 17, 18,
  ]);

  const opts = { heightPx: 2, widthPx: 3, channels: 3, denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED };

  // First pixel (0, 0)
  const first = readDenseVector(hwcBuffer, 0, 0, opts);
  assert.deepEqual(Array.from(first), [1, 2, 3]);

  // Middle pixel (1, 1)
  const middle = readDenseVector(hwcBuffer, 1, 1, opts);
  assert.deepEqual(Array.from(middle), [13, 14, 15]);

  // Last pixel (1, 2)
  const last = readDenseVector(hwcBuffer, 1, 2, opts);
  assert.deepEqual(Array.from(last), [16, 17, 18]);

  // Indices check
  assert.deepEqual(getDenseVectorIndices(0, 0, opts), [0, 1, 2]);
  assert.deepEqual(getDenseVectorIndices(1, 1, opts), [12, 13, 14]);
  assert.deepEqual(getDenseVectorIndices(1, 2, opts), [15, 16, 17]);
});

test('readDenseVector accurately reads first, middle, and last pixels for CHW_PLANAR', () => {
  // 2 rows, 3 cols, 3 channels (H=2, W=3, C=3)
  // Channel X (plane 0, indices 0..5): [1, 4, 7, 10, 13, 16]
  // Channel Y (plane 1, indices 6..11): [2, 5, 8, 11, 14, 17]
  // Channel Z (plane 2, indices 12..17): [3, 6, 9, 12, 15, 18]
  const chwBuffer = new Float32Array([
    // Channel X
    1, 4, 7,
    10, 13, 16,
    // Channel Y
    2, 5, 8,
    11, 14, 17,
    // Channel Z
    3, 6, 9,
    12, 15, 18,
  ]);

  const opts = { heightPx: 2, widthPx: 3, channels: 3, denseLayout: DENSE_LAYOUT_CHW_PLANAR };

  // First pixel (0, 0) -> X at index 0, Y at index 6, Z at index 12
  const first = readDenseVector(chwBuffer, 0, 0, opts);
  assert.deepEqual(Array.from(first), [1, 2, 3]);

  // Middle pixel (1, 1) -> X at index 4, Y at index 10, Z at index 16
  const middle = readDenseVector(chwBuffer, 1, 1, opts);
  assert.deepEqual(Array.from(middle), [13, 14, 15]);

  // Last pixel (1, 2) -> X at index 5, Y at index 11, Z at index 17
  const last = readDenseVector(chwBuffer, 1, 2, opts);
  assert.deepEqual(Array.from(last), [16, 17, 18]);

  // Indices check
  assert.deepEqual(getDenseVectorIndices(0, 0, opts), [0, 6, 12]);
  assert.deepEqual(getDenseVectorIndices(1, 1, opts), [4, 10, 16]);
  assert.deepEqual(getDenseVectorIndices(1, 2, opts), [5, 11, 17]);
});

test('readDenseVector writes to target without mutating source buffer', () => {
  const originalData = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0];
  const buffer = new Float32Array(originalData);
  const target = new Float64Array(3);

  const res = readDenseVector(buffer, 0, 1, {
    heightPx: 1,
    widthPx: 2,
    channels: 3,
    denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED,
    target,
  });

  assert.equal(res, target);
  assert.equal(target[0], 40.0);
  assert.equal(target[1], 50.0);
  assert.equal(target[2], 60.0);

  // Verify source buffer is completely untouched
  assert.deepEqual(Array.from(buffer), originalData);
});

test('readDenseVector and getDenseVectorIndices reject out-of-bounds, invalid types, and UNKNOWN layout', () => {
  const buffer = new Float32Array([1, 2, 3, 4, 5, 6]);

  // Out of bounds row/col
  assert.throws(() => {
    readDenseVector(buffer, -1, 0, { heightPx: 1, widthPx: 2, channels: 3, denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED });
  }, RangeError);

  assert.throws(() => {
    readDenseVector(buffer, 1, 0, { heightPx: 1, widthPx: 2, channels: 3, denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED });
  }, RangeError);

  assert.throws(() => {
    readDenseVector(buffer, 0, 2, { heightPx: 1, widthPx: 2, channels: 3, denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED });
  }, RangeError);

  // Non-integer
  assert.throws(() => {
    readDenseVector(buffer, 0.5, 0, { heightPx: 1, widthPx: 2, channels: 3, denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED });
  }, TypeError);

  // Buffer too small
  const shortBuffer = new Float32Array([1, 2, 3]);
  assert.throws(() => {
    readDenseVector(shortBuffer, 0, 1, { heightPx: 1, widthPx: 2, channels: 3, denseLayout: DENSE_LAYOUT_HWC_INTERLEAVED });
  }, RangeError);

  // UNKNOWN layout
  assert.throws(() => {
    readDenseVector(buffer, 0, 0, { heightPx: 1, widthPx: 2, channels: 3, denseLayout: DENSE_LAYOUT_UNKNOWN });
  }, /unsupported or unknown layout/);
});

test('normalizePointmapEvidence and normalizeNormalsEvidence preserve layout and declaredShape', () => {
  const pointmapHwc = normalizePointmapEvidence({
    shape: [100, 100, 3],
    dtype: 'float32',
  }, { expectedView: 'front' });

  assert.equal(pointmapHwc.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);
  assert.deepEqual(pointmapHwc.declaredShape, [100, 100, 3]);
  assert.deepEqual(pointmapHwc.shape, [100, 100, 3]);
  assert.equal(pointmapHwc.qa.shapeCheck.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);

  const normalsChw = normalizeNormalsEvidence({
    shape: [3, 200, 300],
    dtype: 'float32',
  }, { expectedView: 'side' });

  assert.equal(normalsChw.denseLayout, DENSE_LAYOUT_CHW_PLANAR);
  assert.deepEqual(normalsChw.declaredShape, [3, 200, 300]);
  assert.deepEqual(normalsChw.shape, [200, 300, 3]);
  assert.equal(normalsChw.heightPx, 200);
  assert.equal(normalsChw.widthPx, 300);
  assert.equal(normalsChw.qa.shapeCheck.denseLayout, DENSE_LAYOUT_CHW_PLANAR);
});

test('buildBodyEvidencePackage maintains Front and Side layout independence', () => {
  const pkg = buildBodyEvidencePackage({
    sampleId: 'mixed_layouts',
    front: {
      pointmap: { shape: [10, 20, 3], dtype: 'float32' },
      normals: { shape: [10, 20, 3], dtype: 'float32' },
    },
    side: {
      pointmap: { shape: [3, 10, 20], dtype: 'float32' },
      normals: { shape: [3, 10, 20], dtype: 'float32' },
    },
  });

  assert.equal(pkg.front.pointmap.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);
  assert.equal(pkg.front.normals.denseLayout, DENSE_LAYOUT_HWC_INTERLEAVED);
  assert.equal(pkg.side.pointmap.denseLayout, DENSE_LAYOUT_CHW_PLANAR);
  assert.equal(pkg.side.normals.denseLayout, DENSE_LAYOUT_CHW_PLANAR);
});



import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBodyEvidencePackage,
  decodeDenseBufferFromBase64,
  normalizeImageEvidence,
  normalizeNormalsEvidence,
  normalizePointmapEvidence,
  PACKAGE_VERSION,
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


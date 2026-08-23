import test from 'node:test';
import assert from 'node:assert/strict';

import { renderBodyEvidencePackageQaHtml } from './bodyEvidencePackageQaUi.js';

test('renderBodyEvidencePackageQaHtml returns empty string when package is null', () => {
  const html = renderBodyEvidencePackageQaHtml(null);
  assert.equal(html, '');
});

test('renderBodyEvidencePackageQaHtml renders complete Front/Side QA breakdown', () => {
  const mockPackage = {
    version: 'body-evidence-package-v0',
    qa: { status: 'pass' },
    front: {
      image: { present: true, qa: { status: 'pass' } },
      pose: { total: 10, accepted: 10, lowConfidence: 0 },
      segmentation: { raster: new Uint8Array([1]), qa: { valid: true, warnings: [] } },
      pointmap: { present: true, qa: { status: 'pass' } },
      normals: { present: true, qa: { status: 'pass' } },
      qa: {
        modalities: { image: true, pose: true, segmentation: true, pointmap: true, normals: true },
        rasterCompatibility: { status: 'pass' },
      },
    },
    side: {
      image: { present: true, qa: { status: 'pass' } },
      pose: { total: 5, accepted: 5, lowConfidence: 0 },
      segmentation: { raster: new Uint8Array([1]), qa: { valid: true, warnings: [] } },
      pointmap: { present: false, qa: { status: 'pass' } },
      normals: { present: false, qa: { status: 'pass' } },
      qa: {
        modalities: { image: true, pose: true, segmentation: true, pointmap: false, normals: false },
        rasterCompatibility: { status: 'pass' },
      },
    },
  };

  const html = renderBodyEvidencePackageQaHtml(mockPackage);

  assert.equal(html.includes('Package QA'), true);
  assert.equal(html.includes('PASS'), true);
  assert.equal(html.includes('Front'), true);
  assert.equal(html.includes('Side'), true);
  assert.equal(html.includes('Image'), true);
  assert.equal(html.includes('Pose'), true);
  assert.equal(html.includes('Segmentation'), true);
  assert.equal(html.includes('Pointmap Numeric QA'), true);
  assert.equal(html.includes('Normal Numeric QA'), true);
  assert.equal(html.includes('Raster Compatibility'), true);
  assert.equal(html.includes('Authoritative Physical Pointmap Geometry'), true);
  assert.equal(html.includes('Physical Pointmap Interpretation'), true);
  assert.equal(html.includes('Sapiens Runtime Audit'), true);
  assert.equal(html.includes('VALIDATION PENDING'), true);
  assert.equal(html.includes('DEFERRED'), true);
  assert.equal(html.includes('Missing'), true);
});

test('renderBodyEvidencePackageQaHtml renders WARNING and FAIL statuses accurately', () => {
  const mockPackage = {
    version: 'body-evidence-package-v0',
    qa: { status: 'warning' },
    front: {
      image: { present: true, qa: { status: 'pass' } },
      pose: { total: 10, accepted: 8, lowConfidence: 2 },
      segmentation: { raster: new Uint8Array([1]), qa: { valid: true, warnings: ['Minor overlap'] } },
      pointmap: { present: true, qa: { status: 'warning' } },
      normals: { present: true, qa: { status: 'fail' } },
      qa: {
        modalities: { image: true, pose: true, segmentation: true, pointmap: true, normals: true },
        rasterCompatibility: { status: 'fail' },
      },
    },
    side: {
      image: { present: false },
      pose: null,
      segmentation: null,
      pointmap: { present: false },
      normals: { present: false },
      qa: {
        modalities: { image: false, pose: false, segmentation: false, pointmap: false, normals: false },
        rasterCompatibility: { status: 'pass' },
      },
    },
  };

  const html = renderBodyEvidencePackageQaHtml(mockPackage);

  assert.equal(html.includes('WARNING'), true);
  assert.equal(html.includes('FAIL'), true);
  assert.equal(html.includes('Missing'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { renderBodyEvidencePackageQaHtml } from './bodyEvidencePackageQaUi.js';

test('measurementSemantics: dense evidence QA displays scientific numeric QA terminology', () => {
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

  // Must contain accurate numeric QA terms
  assert.equal(html.includes('Pointmap Numeric QA'), true);
  assert.equal(html.includes('Normal Numeric QA'), true);

  // Must distinguish deferred authoritative physical pointmap geometry
  assert.equal(html.includes('Authoritative Physical Pointmap Geometry'), true);
  assert.equal(html.includes('Physical Pointmap Interpretation'), true);
  assert.equal(html.includes('VALIDATION PENDING'), true);
  assert.equal(html.includes('Sapiens Runtime Audit'), true);
  assert.equal(html.includes('DEFERRED'), true);

  // Guardrail: must NOT claim normal orientation certification
  assert.equal(html.includes('Normal Orientation QA'), false);
  assert.equal(html.includes('Physical Orientation Certified'), false);
});

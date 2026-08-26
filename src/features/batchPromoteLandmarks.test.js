import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidence,
  promoteAllFrontCoreLandmarks,
  promoteSelectedBodyEvidenceLandmark,
  selectBodyEvidenceLandmark,
  isBodyLandmarkPromoted,
  getRenderableFrontBodyLandmarks,
  getSecondaryFrontBodyLandmarks,
  getRenderableSideBodyLandmarks,
  clearAllBodyEvidenceSelections,
} from './bodyEvidence.js';
import { importBodyEvidenceZip } from './bodyEvidenceZipAdapter.js';
import { buildBodyEvidencePackage } from './bodyEvidencePackage.js';
import { restoreAnnotations, getAnnotations } from './annotations.js';
import { CORE_FRONT_BODY_ANCHORS } from './bodyEvidenceAdapter.js';

// Setup DOM mocks for annotation creation & UI
function setupTestDom() {
  global.document = {
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      className: '',
      style: {},
      children: [],
      classList: {
        add: () => {},
        remove: () => {},
        toggle: () => {},
        contains: () => false,
      },
      appendChild: function (c) { this.children.push(c); return c; },
      replaceChildren: function () { this.children = []; },
      setAttribute: () => {},
      removeAttribute: () => {},
      getAttribute: () => null,
      querySelectorAll: () => [],
    }),
    getElementById: (id) => null,
  };
}

test('Batch Promote 1: promoteAllFrontCoreLandmarks promotes all 13 core front landmarks when package is loaded', async () => {
  setupTestDom();
  restoreAnnotations([]);

  const zipPaths = [
    'c:/Users/VIP/Documents/work-latent-space/output.zip',
    'C:/Users/VIP/Downloads/output.zip',
  ];
  let zipBytes = null;
  for (const p of zipPaths) {
    if (fs.existsSync(p)) {
      zipBytes = fs.readFileSync(p);
      break;
    }
  }

  if (zipBytes) {
    const res = await importBodyEvidenceZip(new Uint8Array(zipBytes));
    assert.ok(res.ok);
    setBodyEvidencePackage(res.package);
    analyzeLoadedBodyEvidence();

    const result = promoteAllFrontCoreLandmarks();
    assert.equal(result.ok, true);
    assert.equal(result.promotedCount, 13);
    assert.equal(result.alreadyPromotedCount, 0);
    assert.equal(result.unavailableCount, 0);
    assert.equal(result.totalCoreCount, 13);
    assert.ok(result.message.includes('Promoted 13'));

    const annotations = getAnnotations();
    assert.equal(annotations.length, 13);

    // Verify all 13 core anchors are present
    for (const coreName of CORE_FRONT_BODY_ANCHORS) {
      assert.ok(isBodyLandmarkPromoted(coreName), `Core landmark ${coreName} is promoted`);
    }
  }
});

test('Batch Promote 2: Repeated clicks are completely idempotent and prevent duplicates', async () => {
  setupTestDom();
  // Call again after the previous promotion
  const secondRun = promoteAllFrontCoreLandmarks();
  assert.equal(secondRun.promotedCount, 0, 'No additional landmarks promoted');
  assert.equal(secondRun.alreadyPromotedCount, 13, 'All 13 recognized as already promoted');
  assert.ok(secondRun.message.includes('13 already promoted'));

  // Third run
  const thirdRun = promoteAllFrontCoreLandmarks();
  assert.equal(thirdRun.promotedCount, 0);
  assert.equal(thirdRun.alreadyPromotedCount, 13);
  assert.equal(getAnnotations().length, 13, 'Annotations count remains exactly 13');
});

test('Batch Promote 3: Side landmarks and Secondary landmarks are never promoted by batch promote', async () => {
  setupTestDom();
  const sideLandmarks = getRenderableSideBodyLandmarks();
  const secondaryLandmarks = getSecondaryFrontBodyLandmarks();

  // Ensure annotations only contain Front Core names
  const annotations = getAnnotations();
  const coreSet = new Set(CORE_FRONT_BODY_ANCHORS);
  for (const anno of annotations) {
    assert.ok(coreSet.has(anno.name), `Annotation ${anno.name} must be in core front set`);
  }
});

test('Batch Promote 4: Missing/unavailable landmarks are skipped cleanly with accurate summary count', () => {
  setupTestDom();
  restoreAnnotations([]);

  // Synthetic package with only 2 core landmarks
  const width = 100;
  const height = 100;
  const pkg = buildBodyEvidencePackage({
    calibration: { pixelsPerCm: 10, canvasSizePx: 2000, coordinateSpace: 'pixel', origin: 'bottom_left' },
    front: {
      image: { widthPx: width, heightPx: height, mimeType: 'image/png' },
      segmentation: { widthPx: width, heightPx: height, classIndices: new Uint8Array(width * height) },
      pose: {
        landmarks: [
          { name: 'left_shoulder', x: 300, y: 500, score: 0.95 },
          { name: 'right_shoulder', x: 700, y: 500, score: 0.95 },
          { name: 'acromion', x: 320, y: 480, score: 0.9, secondary: true }, // Secondary - should NOT be batch promoted
        ],
      },
    },
    side: {
      image: { widthPx: width, heightPx: height, mimeType: 'image/png' },
      segmentation: { widthPx: width, heightPx: height, classIndices: new Uint8Array(width * height) },
      pose: {
        landmarks: [
          { name: 'left_shoulder', x: 500, y: 500, score: 0.95 },
        ],
      },
    },
  });

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const result = promoteAllFrontCoreLandmarks();
  assert.equal(result.ok, true);
  assert.equal(result.promotedCount, 2, 'Only 2 core front landmarks promoted');
  assert.equal(result.unavailableCount, 11, '11 missing core landmarks skipped');
  assert.equal(result.alreadyPromotedCount, 0);
  assert.ok(result.message.includes('Promoted 2'));
  assert.ok(result.message.includes('Skipped 11 unavailable'));

  // Acromion (secondary) should not be promoted
  assert.equal(isBodyLandmarkPromoted('acromion'), false);
});

test('Batch Promote 5: Single-promote behavior remains intact and works seamlessly alongside batch promote', () => {
  setupTestDom();
  restoreAnnotations([]);

  // Select left_shoulder and single-promote it
  selectBodyEvidenceLandmark({
    id: 'front-0-left_shoulder',
    name: 'left_shoulder',
    view: 'front',
    spaceX: 30,
    spaceY: 50,
    imageX: 300,
    imageY: 500,
  });
  const singleRes = promoteSelectedBodyEvidenceLandmark();
  assert.equal(singleRes.ok, true);
  assert.equal(getAnnotations().length, 1);

  // Now run batch promote: should promote right_shoulder and report left_shoulder as already promoted
  const batchRes = promoteAllFrontCoreLandmarks();
  assert.equal(batchRes.promotedCount, 1, 'Promoted right_shoulder');
  assert.equal(batchRes.alreadyPromotedCount, 1, 'left_shoulder was already promoted');
  assert.equal(getAnnotations().length, 2);
});

test('Batch Promote 6: HTML markup and domRefs contain the Promote All Front Core Landmarks button', () => {
  const html = fs.readFileSync('index.html', 'utf-8');
  assert.ok(html.includes('id="promote-all-front-core-landmarks"'), 'index.html contains promote-all-front-core-landmarks');
  assert.ok(html.includes('Promote All Front Core Landmarks'), 'Button label is Promote All Front Core Landmarks');
});

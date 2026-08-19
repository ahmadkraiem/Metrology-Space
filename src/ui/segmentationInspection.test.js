import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearAllBodyEvidenceSelections,
  clearBodyEvidence,
  clearFrontSegClass,
  clearSideSegClass,
  getSelectedFrontSegClass,
  getSelectedFrontSegClassId,
  getSelectedSideSegClass,
  getSelectedSideSegClassId,
  selectFrontSegClass,
  selectSideSegClass,
  setFrontSegSource,
  setSideSegSource,
  analyzeLoadedBodyEvidence,
  selectBodyEvidenceLandmark,
  selectSideEvidenceLandmark,
} from '../features/bodyEvidence.js';
import {
  COLOR_LOOKUP_TABLE,
  createHighlightColorLookupTable,
} from './segmentationOverlay2d.js';
import {
  renderSegmentationClassList,
} from './bodyEvidencePanel.js';

// Helper for test synthetic base64 generation
function encodeUint8ArrayToBase64(uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8Array).toString('base64');
  }
  let binary = '';
  const len = uint8Array.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return globalThis.btoa(binary);
}

test('Segmentation selection state is independently stored for Front and Side', () => {
  clearBodyEvidence();

  // Initially null
  assert.equal(getSelectedFrontSegClassId(), null);
  assert.equal(getSelectedSideSegClassId(), null);
  assert.equal(getSelectedFrontSegClass(), null);
  assert.equal(getSelectedSideSegClass(), null);

  // Set up test segmentation sources
  const rasterFront = new Uint8Array([0, 0, 1, 1]); // 2 background, 2 skin
  const rasterSide = new Uint8Array([0, 1, 2, 0]); // 2 background, 1 skin, 1 hair

  setFrontSegSource({
    model: 'schp',
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 2, skin: 2 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
  });
  setSideSegSource({
    model: 'schp',
    view: 'side',
    num_classes: 3,
    class_names: ['background', 'skin', 'hair'],
    class_counts: { background: 2, skin: 1, hair: 1 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
  });

  const analyzeRes = analyzeLoadedBodyEvidence();
  assert.equal(analyzeRes.ok, true);

  // 1. Select Front class 1 (skin)
  selectFrontSegClass(1);
  assert.equal(getSelectedFrontSegClassId(), 1);
  assert.equal(getSelectedSideSegClassId(), null); // Side remains null!

  const frontSeg = getSelectedFrontSegClass();
  assert.notEqual(frontSeg, null);
  assert.equal(frontSeg.classId, 1);
  assert.equal(frontSeg.label, 'skin');
  assert.equal(frontSeg.view, 'front');
  assert.equal(frontSeg.present, true);
  assert.equal(frontSeg.pixelCount, 2);
  assert.equal(frontSeg.coverage, 0.5);
  assert.deepEqual(frontSeg.boundsPx, { minX: 0, minY: 1, maxX: 1, maxY: 1 });
  assert.deepEqual(frontSeg.boundsNormalized, { minX: 0, minY: 0.5, maxX: 0.5, maxY: 0.5 });
  assert.equal(frontSeg.qa.valid, true);

  // 2. Select Side class 2 (hair) while Front is still selected
  selectSideSegClass(2);
  assert.equal(getSelectedFrontSegClassId(), 1); // Front remains 1!
  assert.equal(getSelectedSideSegClassId(), 2);

  const sideSeg = getSelectedSideSegClass();
  assert.notEqual(sideSeg, null);
  assert.equal(sideSeg.classId, 2);
  assert.equal(sideSeg.label, 'hair');
  assert.equal(sideSeg.view, 'side');
  assert.equal(sideSeg.present, true);
  assert.equal(sideSeg.pixelCount, 1);
  assert.equal(sideSeg.coverage, 0.25);
  assert.deepEqual(sideSeg.boundsPx, { minX: 0, minY: 1, maxX: 0, maxY: 1 });
  assert.deepEqual(sideSeg.boundsNormalized, { minX: 0, minY: 0.5, maxX: 0, maxY: 0.5 });

  // 3. Clear Front does NOT clear Side
  clearFrontSegClass();
  assert.equal(getSelectedFrontSegClassId(), null);
  assert.equal(getSelectedFrontSegClass(), null);
  assert.equal(getSelectedSideSegClassId(), 2); // Side is still 2!
  assert.notEqual(getSelectedSideSegClass(), null);

  // 4. Clear Side
  clearSideSegClass();
  assert.equal(getSelectedSideSegClassId(), null);
  assert.equal(getSelectedSideSegClass(), null);
});

test('Highlight color lookup table emphasizes selected class and dims unselected classes', () => {
  // When no class selected: returns standard lookup table
  const defaultTable = createHighlightColorLookupTable(null);
  assert.equal(defaultTable, COLOR_LOOKUP_TABLE);

  // When class 1 is selected
  const class1Table = createHighlightColorLookupTable(1);
  assert.equal(class1Table.length, 256);

  // Class 0 (background) is transparent (alpha 0)
  assert.equal(class1Table[0], 0);

  // Class 1 (selected) has high alpha (~220 / 0xDC)
  const class1Buf = new ArrayBuffer(4);
  const class1U32 = new Uint32Array(class1Buf);
  const class1U8 = new Uint8ClampedArray(class1Buf);
  class1U32[0] = class1Table[1];
  assert.equal(class1U8[3], 220);

  // Class 2 (unselected) has low dimmed alpha (~20 / 0x14)
  class1U32[0] = class1Table[2];
  assert.equal(class1U8[3], 20);

  // When class 0 (background) is selected
  const class0Table = createHighlightColorLookupTable(0);
  class1U32[0] = class0Table[0];
  assert.equal(class1U8[3], 180); // background is visible
  class1U32[0] = class0Table[1];
  assert.equal(class1U8[3], 20); // other classes are dimmed
});

test('renderSegmentationClassList renders class items and handles absent classes cleanly', () => {
  const dummyEl = {
    innerHTML: '',
    querySelectorAll: () => [],
  };

  const sampleClasses = [
    {
      classId: 0,
      label: 'background',
      pixelCount: 3000,
      coverage: 0.75,
      present: true,
      boundsPx: { minX: 0, minY: 0, maxX: 1999, maxY: 1999 },
      boundsNormalized: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    },
    {
      classId: 1,
      label: 'skin',
      pixelCount: 1000,
      coverage: 0.25,
      present: true,
      boundsPx: { minX: 100, minY: 100, maxX: 500, maxY: 500 },
      boundsNormalized: { minX: 0.05, minY: 0.05, maxX: 0.25, maxY: 0.25 },
    },
    {
      classId: 2,
      label: 'dress',
      pixelCount: 0,
      coverage: 0,
      present: false,
      boundsPx: null,
      boundsNormalized: null,
    },
  ];

  renderSegmentationClassList({
    container: dummyEl,
    classes: sampleClasses,
    view: 'front',
    selectedClassId: 1,
    onSelect: () => {},
  });

  // Verify class 1 is marked as is-selected
  assert.equal(dummyEl.innerHTML.includes('data-seg-class-id="1"'), true);
  assert.equal(dummyEl.innerHTML.includes('is-selected'), true);

  // Verify class 2 (absent) has absent styling class and badge
  assert.equal(dummyEl.innerHTML.includes('body-evidence-class-item--absent'), true);
  assert.equal(dummyEl.innerHTML.includes('Absent'), true);
  assert.equal(dummyEl.innerHTML.includes('Present'), true);
});

test('clearAllBodyEvidenceSelections clears landmarks and both Front and Side segmentation', () => {
  selectBodyEvidenceLandmark({ id: 'neck', name: 'neck', imageX: 100, imageY: 100, spaceX: 10, spaceY: 10 });
  selectSideEvidenceLandmark({ id: 'neck', name: 'neck', imageX: 100, imageY: 100, sideUcm: 10, sideYcm: 10 });
  selectFrontSegClass(1);
  selectSideSegClass(0);

  assert.equal(getSelectedFrontSegClassId(), 1);
  assert.equal(getSelectedSideSegClassId(), 0);

  clearAllBodyEvidenceSelections();

  assert.equal(getSelectedFrontSegClassId(), null);
  assert.equal(getSelectedSideSegClassId(), null);
});

test('both Front and Side segmentation cards can be active simultaneously with full QA metrics', () => {
  clearBodyEvidence();

  const rasterFront = new Uint8Array([0, 0, 1, 1]);
  const rasterSide = new Uint8Array([0, 1, 0, 1]);

  setFrontSegSource({
    model: 'schp',
    view: 'front',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 2, skin: 2 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
  });
  setSideSegSource({
    model: 'schp',
    view: 'side',
    num_classes: 2,
    class_names: ['background', 'skin'],
    class_counts: { background: 2, skin: 2 },
    labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
  });

  analyzeLoadedBodyEvidence();

  selectFrontSegClass(1);
  selectSideSegClass(0);

  const front = getSelectedFrontSegClass();
  const side = getSelectedSideSegClass();

  assert.notEqual(front, null);
  assert.notEqual(side, null);
  assert.equal(front.view, 'front');
  assert.equal(front.label, 'skin');
  assert.equal(front.classId, 1);
  assert.equal(front.present, true);
  assert.equal(front.pixelCount, 2);
  assert.equal(front.coverage, 0.5);
  assert.deepEqual(front.boundsPx, { minX: 0, minY: 1, maxX: 1, maxY: 1 });

  assert.equal(side.view, 'side');
  assert.equal(side.label, 'background');
  assert.equal(side.classId, 0);
  assert.equal(side.present, true);
  assert.equal(side.pixelCount, 2);
  assert.equal(side.coverage, 0.5);

  // Clearing Front leaves Side untouched
  clearFrontSegClass();
  assert.equal(getSelectedFrontSegClass(), null);
  assert.notEqual(getSelectedSideSegClass(), null);
  assert.equal(getSelectedSideSegClass().classId, 0);

  // Clean up
  clearAllBodyEvidenceSelections();
  assert.equal(getSelectedSideSegClass(), null);
});

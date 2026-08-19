import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANATOMICAL_REGION_CATEGORIES,
  ANATOMICAL_REGION_CONTRACT_NAME,
  ANATOMICAL_REGION_CONTRACT_VERSION,
  ANATOMICAL_REGION_STATUS,
  CANONICAL_SEGMENTATION_CLASSES_V0,
  TOTAL_CANONICAL_CLASSES_V0,
  buildObservedAnatomicalRegions,
  getCanonicalSegmentationClass,
  normalizeLabelKey,
} from './anatomicalRegions.js';

test('CANONICAL_SEGMENTATION_CLASSES_V0 defines exact 29 classes with correct ordering (0..28)', () => {
  assert.equal(CANONICAL_SEGMENTATION_CLASSES_V0.length, 29);
  assert.equal(TOTAL_CANONICAL_CLASSES_V0, 29);

  const expectedClasses = [
    { classId: 0, label: 'Background', regionId: 'background', category: 'context_background', eligible: false },
    { classId: 1, label: 'Apparel', regionId: 'apparel', category: 'clothing_apparel', eligible: false },
    { classId: 2, label: 'Eyeglass', regionId: 'eyeglass', category: 'accessory_other', eligible: false },
    { classId: 3, label: 'Face_Neck', regionId: 'face_neck', category: 'face_head', eligible: false },
    { classId: 4, label: 'Hair', regionId: 'hair', category: 'face_head', eligible: false },
    { classId: 5, label: 'Left_Foot', regionId: 'left_foot', category: 'body_anatomical', eligible: true },
    { classId: 6, label: 'Left_Hand', regionId: 'left_hand', category: 'body_anatomical', eligible: true },
    { classId: 7, label: 'Left_Lower_Arm', regionId: 'left_lower_arm', category: 'body_anatomical', eligible: true },
    { classId: 8, label: 'Left_Lower_Leg', regionId: 'left_lower_leg', category: 'body_anatomical', eligible: true },
    { classId: 9, label: 'Left_Shoe', regionId: 'left_shoe', category: 'clothing_apparel', eligible: false },
    { classId: 10, label: 'Left_Sock', regionId: 'left_sock', category: 'clothing_apparel', eligible: false },
    { classId: 11, label: 'Left_Upper_Arm', regionId: 'left_upper_arm', category: 'body_anatomical', eligible: true },
    { classId: 12, label: 'Left_Upper_Leg', regionId: 'left_upper_leg', category: 'body_anatomical', eligible: true },
    { classId: 13, label: 'Lower_Clothing', regionId: 'lower_clothing', category: 'clothing_apparel', eligible: false },
    { classId: 14, label: 'Right_Foot', regionId: 'right_foot', category: 'body_anatomical', eligible: true },
    { classId: 15, label: 'Right_Hand', regionId: 'right_hand', category: 'body_anatomical', eligible: true },
    { classId: 16, label: 'Right_Lower_Arm', regionId: 'right_lower_arm', category: 'body_anatomical', eligible: true },
    { classId: 17, label: 'Right_Lower_Leg', regionId: 'right_lower_leg', category: 'body_anatomical', eligible: true },
    { classId: 18, label: 'Right_Shoe', regionId: 'right_shoe', category: 'clothing_apparel', eligible: false },
    { classId: 19, label: 'Right_Sock', regionId: 'right_sock', category: 'clothing_apparel', eligible: false },
    { classId: 20, label: 'Right_Upper_Arm', regionId: 'right_upper_arm', category: 'body_anatomical', eligible: true },
    { classId: 21, label: 'Right_Upper_Leg', regionId: 'right_upper_leg', category: 'body_anatomical', eligible: true },
    { classId: 22, label: 'Torso', regionId: 'torso', category: 'body_anatomical', eligible: true },
    { classId: 23, label: 'Upper_Clothing', regionId: 'upper_clothing', category: 'clothing_apparel', eligible: false },
    { classId: 24, label: 'Lower_Lip', regionId: 'lower_lip', category: 'face_head', eligible: false },
    { classId: 25, label: 'Upper_Lip', regionId: 'upper_lip', category: 'face_head', eligible: false },
    { classId: 26, label: 'Lower_Teeth', regionId: 'lower_teeth', category: 'face_head', eligible: false },
    { classId: 27, label: 'Upper_Teeth', regionId: 'upper_teeth', category: 'face_head', eligible: false },
    { classId: 28, label: 'Tongue', regionId: 'tongue', category: 'face_head', eligible: false },
  ];

  for (let i = 0; i < 29; i += 1) {
    const canonical = CANONICAL_SEGMENTATION_CLASSES_V0[i];
    const expected = expectedClasses[i];
    assert.equal(canonical.classId, expected.classId, `Class ID mismatch at index ${i}`);
    assert.equal(canonical.label, expected.label, `Label mismatch at index ${i}`);
    assert.equal(canonical.regionId, expected.regionId, `Region ID mismatch at index ${i}`);
    assert.equal(canonical.category, expected.category, `Category mismatch at index ${i}`);
    assert.equal(canonical.isBodyMetrologyEligible, expected.eligible, `Metrology eligibility mismatch at index ${i}`);
  }
});

test('Exact category counts conform to 13 / 7 / 7 / 1 / 1 partition', () => {
  const bodyAnatomical = CANONICAL_SEGMENTATION_CLASSES_V0.filter(
    (c) => c.category === ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
  );
  const clothingApparel = CANONICAL_SEGMENTATION_CLASSES_V0.filter(
    (c) => c.category === ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
  );
  const faceHead = CANONICAL_SEGMENTATION_CLASSES_V0.filter(
    (c) => c.category === ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
  );
  const accessoryOther = CANONICAL_SEGMENTATION_CLASSES_V0.filter(
    (c) => c.category === ANATOMICAL_REGION_CATEGORIES.ACCESSORY_OTHER,
  );
  const contextBackground = CANONICAL_SEGMENTATION_CLASSES_V0.filter(
    (c) => c.category === ANATOMICAL_REGION_CATEGORIES.CONTEXT_BACKGROUND,
  );

  assert.equal(bodyAnatomical.length, 13, 'body_anatomical count must be exactly 13');
  assert.equal(clothingApparel.length, 7, 'clothing_apparel count must be exactly 7');
  assert.equal(faceHead.length, 7, 'face_head count must be exactly 7');
  assert.equal(accessoryOther.length, 1, 'accessory_other count must be exactly 1');
  assert.equal(contextBackground.length, 1, 'context_background count must be exactly 1');

  assert.equal(
    bodyAnatomical.length + clothingApparel.length + faceHead.length + accessoryOther.length + contextBackground.length,
    29,
  );
});

test('isBodyMetrologyEligible is true for all 13 body_anatomical classes and false for all other 16 classes', () => {
  for (const c of CANONICAL_SEGMENTATION_CLASSES_V0) {
    if (c.category === ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL) {
      assert.equal(c.isBodyMetrologyEligible, true, `${c.label} must be metrology-eligible`);
    } else {
      assert.equal(c.isBodyMetrologyEligible, false, `${c.label} must NOT be metrology-eligible`);
    }
  }
});

test('Face_Neck is categorized strictly as face_head and is NOT metrology-eligible', () => {
  const faceNeck = getCanonicalSegmentationClass(3);
  assert.notEqual(faceNeck, null);
  assert.equal(faceNeck.label, 'Face_Neck');
  assert.equal(faceNeck.category, 'face_head');
  assert.equal(faceNeck.isBodyMetrologyEligible, false);

  // Label lookup test
  const byLabel = getCanonicalSegmentationClass('Face_Neck');
  assert.deepEqual(byLabel, faceNeck);
});

test('buildObservedAnatomicalRegions produces valid report with observed regions and accurate Front boundsCm', () => {
  const mockNormalizedSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 0,
        label: 'Background',
        pixelCount: 3000000,
        coverage: 0.75,
        present: true,
        boundsPx: { minX: 0, minY: 0, maxX: 1999, maxY: 1999 },
        boundsNormalized: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      },
      {
        classId: 11,
        label: 'Left_Upper_Arm',
        pixelCount: 50000,
        coverage: 0.0125,
        present: true,
        boundsPx: { minX: 300, minY: 400, maxX: 450, maxY: 700 },
        boundsNormalized: { minX: 0.15, minY: 0.2, maxX: 0.225, maxY: 0.35 },
      },
      {
        classId: 23,
        label: 'Upper_Clothing',
        pixelCount: 250000,
        coverage: 0.0625,
        present: true,
        boundsPx: { minX: 450, minY: 350, maxX: 750, maxY: 900 },
        boundsNormalized: { minX: 0.225, minY: 0.175, maxX: 0.375, maxY: 0.45 },
      },
      {
        classId: 4,
        label: 'Hair',
        pixelCount: 80000,
        coverage: 0.02,
        present: true,
        boundsPx: { minX: 500, minY: 100, maxX: 700, maxY: 300 },
        boundsNormalized: { minX: 0.25, minY: 0.05, maxX: 0.35, maxY: 0.15 },
      },
    ],
  };

  const report = buildObservedAnatomicalRegions(mockNormalizedSeg, { view: 'front' });

  assert.equal(report.contract, ANATOMICAL_REGION_CONTRACT_NAME);
  assert.equal(report.version, ANATOMICAL_REGION_CONTRACT_VERSION);
  assert.equal(report.view, 'front');
  assert.equal(report.summary.totalClasses, 29);
  assert.equal(report.summary.presentClasses, 4);
  assert.equal(report.summary.validCount, 4);
  assert.equal(report.summary.absentCount, 25);
  assert.equal(report.summary.invalidCount, 0);
  assert.equal(report.summary.bodyAnatomicalCount, 13);
  assert.equal(report.summary.clothingApparelCount, 7);
  assert.equal(report.summary.faceHeadCount, 7);
  assert.equal(report.summary.accessoryCount, 1);
  assert.equal(report.summary.contextCount, 1);
  assert.equal(report.regions.length, 29);

  // Check strict guardrails across all regions: no composite/derived flags, no z, no depth
  for (const region of report.regions) {
    assert.equal('derived' in region, false, 'derived must not exist in v0');
    assert.equal('composite' in region, false, 'composite must not exist in v0');
    assert.equal('z' in region, false, 'z must not exist in v0');
    assert.equal('depth' in region, false, 'depth must not exist in v0');
    assert.equal(region.view, 'front');
  }

  // 1. Full-image Background (class 0) -> maps exactly to 0..200 cm
  const bg = report.regions[0];
  assert.equal(bg.present, true);
  assert.deepEqual(bg.boundsCm, {
    minX: 0.0,
    maxX: 200.0,
    minY: 0.0,
    maxY: 200.0,
  });

  // 2. Left_Upper_Arm (class 11) - Present, Valid, Metrology-Eligible
  const arm = report.regions[11];
  assert.equal(arm.classId, 11);
  assert.equal(arm.label, 'Left_Upper_Arm');
  assert.equal(arm.regionId, 'left_upper_arm');
  assert.equal(arm.category, 'body_anatomical');
  assert.equal(arm.present, true);
  assert.equal(arm.pixelCount, 50000);
  assert.equal(arm.status, ANATOMICAL_REGION_STATUS.VALID);
  assert.equal(arm.isBodyMetrologyEligible, true);
  assert.deepEqual(arm.boundsPx, { minX: 300, minY: 400, maxX: 450, maxY: 700 });
  assert.deepEqual(arm.boundsNormalized, { minX: 0.15, minY: 0.2, maxX: 0.225, maxY: 0.35 });

  // boundsCm for Left_Upper_Arm:
  // minX = 300 / 2000 * 200 = 30.0 cm
  // maxX = (450 + 1) / 2000 * 200 = 45.1 cm
  // minY = (2000 - 701) / 2000 * 200 = 1299 / 10 = 129.9 cm
  // maxY = (2000 - 400) / 2000 * 200 = 1600 / 10 = 160.0 cm
  assert.deepEqual(arm.boundsCm, {
    minX: 30.0,
    maxX: 45.1,
    minY: 129.9,
    maxY: 160.0,
  });

  // 3. Hair (class 4) - Present, Valid, but NOT Metrology-Eligible
  const hair = report.regions[4];
  assert.equal(hair.classId, 4);
  assert.equal(hair.label, 'Hair');
  assert.equal(hair.category, 'face_head');
  assert.equal(hair.present, true);
  assert.equal(hair.pixelCount, 80000);
  assert.equal(hair.status, ANATOMICAL_REGION_STATUS.VALID);
  assert.equal(hair.isBodyMetrologyEligible, false);
  assert.deepEqual(hair.boundsCm, {
    minX: 50.0,
    maxX: 70.1,
    minY: 169.9,
    maxY: 190.0,
  });

  // 4. Right_Upper_Arm (class 20) - Absent -> boundsCm is null
  const rightArm = report.regions[20];
  assert.equal(rightArm.classId, 20);
  assert.equal(rightArm.label, 'Right_Upper_Arm');
  assert.equal(rightArm.category, 'body_anatomical');
  assert.equal(rightArm.present, false);
  assert.equal(rightArm.pixelCount, 0);
  assert.equal(rightArm.boundsPx, null);
  assert.equal(rightArm.boundsNormalized, null);
  assert.equal(rightArm.boundsCm, null);
  assert.equal(rightArm.status, ANATOMICAL_REGION_STATUS.ABSENT);
  assert.equal(rightArm.isBodyMetrologyEligible, true);
});

test('Side valid region produces correct boundsCm with U/Y semantics and no U->Z', () => {
  const sideSeg = {
    view: 'side',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 22,
        label: 'Torso',
        pixelCount: 90000,
        coverage: 0.0225,
        present: true,
        boundsPx: { minX: 600, minY: 300, maxX: 900, maxY: 900 },
        boundsNormalized: { minX: 0.3, minY: 0.15, maxX: 0.45, maxY: 0.45 },
      },
    ],
  };

  const sideReport = buildObservedAnatomicalRegions(sideSeg, { view: 'side' });
  assert.equal(sideReport.view, 'side');

  const torso = sideReport.regions[22];
  assert.equal(torso.view, 'side');
  assert.equal(torso.present, true);
  assert.equal(torso.status, ANATOMICAL_REGION_STATUS.VALID);

  // Side boundsCm must have minU, maxU, minY, maxY and NEVER minX, maxX, z, depth
  assert.deepEqual(torso.boundsCm, {
    minU: 60.0, // 600 / 2000 * 200
    maxU: 90.1, // (900 + 1) / 2000 * 200
    minY: 109.9, // (2000 - 901) / 2000 * 200
    maxY: 170.0, // (2000 - 300) / 2000 * 200
  });

  assert.equal('minX' in torso.boundsCm, false);
  assert.equal('maxX' in torso.boundsCm, false);
  assert.equal('z' in torso.boundsCm, false);
  assert.equal('depth' in torso.boundsCm, false);
});

test('Single-pixel region produces non-zero metric area and respects Y inversion', () => {
  const singlePixelSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 15,
        label: 'Right_Hand',
        pixelCount: 1,
        coverage: 0.00000025,
        present: true,
        boundsPx: { minX: 100, minY: 200, maxX: 100, maxY: 200 },
        boundsNormalized: { minX: 0.05, minY: 0.1, maxX: 0.05, maxY: 0.1 },
      },
    ],
  };

  const report = buildObservedAnatomicalRegions(singlePixelSeg, { view: 'front' });
  const hand = report.regions[15];

  assert.equal(hand.present, true);
  assert.equal(hand.status, ANATOMICAL_REGION_STATUS.VALID);
  assert.deepEqual(hand.boundsCm, {
    minX: 10.0,
    maxX: 10.1,
    minY: 179.9,
    maxY: 180.0,
  });

  const widthCm = hand.boundsCm.maxX - hand.boundsCm.minX;
  const heightCm = hand.boundsCm.maxY - hand.boundsCm.minY;
  assert.equal(Math.round(widthCm * 1000) / 1000, 0.1);
  assert.equal(Math.round(heightCm * 1000) / 1000, 0.1);
  assert.equal(widthCm > 0, true);
  assert.equal(heightCm > 0, true);
});

test('Non-square raster scales each axis independently without geometric distortion', () => {
  const nonSquareSeg = {
    view: 'front',
    widthPx: 1000,
    heightPx: 500,
    classes: [
      {
        classId: 22,
        label: 'Torso',
        pixelCount: 5000,
        coverage: 0.01,
        present: true,
        boundsPx: { minX: 100, minY: 100, maxX: 200, maxY: 150 },
        boundsNormalized: { minX: 0.1, minY: 0.2, maxX: 0.2, maxY: 0.3 },
      },
    ],
  };

  const report = buildObservedAnatomicalRegions(nonSquareSeg);
  const torso = report.regions[22];

  assert.equal(torso.present, true);
  assert.deepEqual(torso.boundsCm, {
    minX: 20.0, // 100 / 1000 * 200
    maxX: 40.2, // (200 + 1) / 1000 * 200
    minY: 139.6, // (500 - 151) / 500 * 200
    maxY: 160.0, // (500 - 100) / 500 * 200
  });
});

test('Preserves Front and Side spatial independence without cross-view interference', () => {
  const frontSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 22,
        label: 'Torso',
        pixelCount: 150000,
        coverage: 0.0375,
        present: true,
        boundsPx: { minX: 400, minY: 300, maxX: 800, maxY: 900 },
        boundsNormalized: { minX: 0.2, minY: 0.15, maxX: 0.4, maxY: 0.45 },
      },
    ],
  };

  const sideSeg = {
    view: 'side',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 22,
        label: 'Torso',
        pixelCount: 90000,
        coverage: 0.0225,
        present: true,
        boundsPx: { minX: 600, minY: 300, maxX: 900, maxY: 900 },
        boundsNormalized: { minX: 0.3, minY: 0.15, maxX: 0.45, maxY: 0.45 },
      },
    ],
  };

  const frontReport = buildObservedAnatomicalRegions(frontSeg, { view: 'front' });
  const sideReport = buildObservedAnatomicalRegions(sideSeg, { view: 'side' });

  assert.equal(frontReport.view, 'front');
  assert.equal(sideReport.view, 'side');

  const frontTorso = frontReport.regions[22];
  const sideTorso = sideReport.regions[22];

  assert.equal(frontTorso.view, 'front');
  assert.equal(sideTorso.view, 'side');

  assert.equal(frontTorso.pixelCount, 150000);
  assert.equal(sideTorso.pixelCount, 90000);

  assert.deepEqual(frontTorso.boundsPx, { minX: 400, minY: 300, maxX: 800, maxY: 900 });
  assert.deepEqual(sideTorso.boundsPx, { minX: 600, minY: 300, maxX: 900, maxY: 900 });

  assert.deepEqual(frontTorso.boundsCm, {
    minX: 40.0,
    maxX: 80.1,
    minY: 109.9,
    maxY: 170.0,
  });

  assert.deepEqual(sideTorso.boundsCm, {
    minU: 60.0,
    maxU: 90.1,
    minY: 109.9,
    maxY: 170.0,
  });
});

test('Handles empty and invalid segmentation inputs safely with null boundsCm', () => {
  // 1. null input -> all absent with boundsCm: null
  const nullReport = buildObservedAnatomicalRegions(null);
  assert.equal(nullReport.summary.totalClasses, 29);
  assert.equal(nullReport.summary.presentClasses, 0);
  assert.equal(nullReport.summary.absentCount, 29);
  assert.equal(nullReport.regions.length, 29);
  for (const r of nullReport.regions) {
    assert.equal(r.boundsCm, null);
  }

  // 2. empty object -> all absent with boundsCm: null
  const emptyReport = buildObservedAnatomicalRegions({});
  assert.equal(emptyReport.summary.presentClasses, 0);
  for (const r of emptyReport.regions) {
    assert.equal(r.boundsCm, null);
  }

  // 3. invalid bounds when pixels exist -> status INVALID and boundsCm: null
  const corruptedSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 5,
        label: 'Left_Foot',
        pixelCount: 500,
        present: true,
        boundsPx: null, // missing bounds despite pixelCount > 0
      },
    ],
  };
  const corruptedReport = buildObservedAnatomicalRegions(corruptedSeg);
  const foot = corruptedReport.regions[5];
  assert.equal(foot.present, false);
  assert.equal(foot.status, ANATOMICAL_REGION_STATUS.INVALID);
  assert.equal(foot.boundsCm, null);
  assert.equal(corruptedReport.summary.invalidCount, 1);

  // 4. missing raster dimensions when pixels and bounds exist -> status INVALID and boundsCm: null
  const missingDimSeg = {
    view: 'front',
    classes: [
      {
        classId: 5,
        label: 'Left_Foot',
        pixelCount: 500,
        present: true,
        boundsPx: { minX: 10, minY: 10, maxX: 50, maxY: 50 },
      },
    ],
  };
  const missingDimReport = buildObservedAnatomicalRegions(missingDimSeg);
  const foot2 = missingDimReport.regions[5];
  assert.equal(foot2.present, false);
  assert.equal(foot2.status, ANATOMICAL_REGION_STATUS.INVALID);
  assert.equal(foot2.boundsCm, null);
});

test('getCanonicalSegmentationClass supports ID, string number, and case-insensitive label lookups', () => {
  assert.equal(getCanonicalSegmentationClass(0)?.label, 'Background');
  assert.equal(getCanonicalSegmentationClass(28)?.label, 'Tongue');
  assert.equal(getCanonicalSegmentationClass('28')?.label, 'Tongue');
  assert.equal(getCanonicalSegmentationClass('left_lower_leg')?.classId, 8);
  assert.equal(getCanonicalSegmentationClass('LEFT_UPPER_ARM')?.classId, 11);
  assert.equal(getCanonicalSegmentationClass('upper-clothing')?.classId, 23);
  assert.equal(getCanonicalSegmentationClass(99), null);
  assert.equal(getCanonicalSegmentationClass('nonexistent'), null);
});

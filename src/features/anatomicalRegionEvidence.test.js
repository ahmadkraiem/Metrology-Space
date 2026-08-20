import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANATOMICAL_REGION_EVIDENCE_CONTRACT,
  ANATOMICAL_REGION_EVIDENCE_CONTRACT_VERSION,
  ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0,
  TOTAL_ELIGIBLE_ANATOMICAL_REGIONS_V0,
  buildAnatomicalRegionEvidence,
} from './anatomicalRegionEvidence.js';
import {
  CANONICAL_SEGMENTATION_CLASSES_V0,
  getCanonicalRegionLaterality,
} from './anatomicalRegions.js';

test('Anatomical Region Evidence Contract v0 exports contract metadata and exact 13 eligible body classes', () => {
  assert.equal(ANATOMICAL_REGION_EVIDENCE_CONTRACT_VERSION, 'anatomical-region-evidence-v0');
  assert.equal(ANATOMICAL_REGION_EVIDENCE_CONTRACT, 'anatomical-region-evidence-v0');
  assert.equal(TOTAL_ELIGIBLE_ANATOMICAL_REGIONS_V0, 13);
  assert.equal(ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.length, 13);

  const expectedClassIds = [5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 20, 21, 22];
  assert.deepEqual(
    ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.map((c) => c.classId),
    expectedClassIds,
  );
  assert.ok(ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.every((c) => c.category === 'body_anatomical'));
  assert.ok(ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.every((c) => c.isBodyMetrologyEligible === true));
});

test('laterality is derived authoritatively from canonical taxonomy with 6 left, 6 right, and 1 central', () => {
  const leftClasses = ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.filter((c) => c.laterality === 'left');
  const rightClasses = ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.filter((c) => c.laterality === 'right');
  const centralClasses = ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.filter((c) => c.laterality === 'central');

  assert.equal(leftClasses.length, 6);
  assert.equal(rightClasses.length, 6);
  assert.equal(centralClasses.length, 1);

  assert.deepEqual(
    leftClasses.map((c) => c.label),
    ['Left_Foot', 'Left_Hand', 'Left_Lower_Arm', 'Left_Lower_Leg', 'Left_Upper_Arm', 'Left_Upper_Leg'],
  );
  assert.deepEqual(
    rightClasses.map((c) => c.label),
    ['Right_Foot', 'Right_Hand', 'Right_Lower_Arm', 'Right_Lower_Leg', 'Right_Upper_Arm', 'Right_Upper_Leg'],
  );
  assert.equal(centralClasses[0].label, 'Torso');
  assert.equal(centralClasses[0].classId, 22);

  // Check helper
  assert.equal(getCanonicalRegionLaterality(5), 'left');
  assert.equal(getCanonicalRegionLaterality(14), 'right');
  assert.equal(getCanonicalRegionLaterality(22), 'central');
  assert.equal(getCanonicalRegionLaterality('Torso'), 'central');
  assert.equal(getCanonicalRegionLaterality('Left_Upper_Arm'), 'left');
  assert.equal(getCanonicalRegionLaterality('Right_Upper_Arm'), 'right');
});

test('empty or null normalized segmentation yields all 13 eligible regions as absent with deterministic ordering', () => {
  const report = buildAnatomicalRegionEvidence(null, { view: 'front' });

  assert.equal(report.contract, 'anatomical-region-evidence-v0');
  assert.equal(report.version, 'anatomical-region-evidence-v0');
  assert.equal(report.view, 'front');
  assert.equal(report.regions.length, 13);
  assert.deepEqual(
    report.regions.map((r) => r.classId),
    [5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 20, 21, 22],
  );

  assert.deepEqual(report.summary, {
    totalEligibleRegions: 13,
    presentRegions: 0,
    absentRegions: 13,
  });

  assert.ok(report.regions.every((r) => r.category === 'body_anatomical'));
  assert.ok(report.regions.every((r) => r.view === 'front'));
  assert.ok(report.regions.every((r) => r.segmentation.present === false));
  assert.ok(report.regions.every((r) => r.segmentation.pixelCount === 0));
  assert.ok(report.regions.every((r) => r.segmentation.coverage === 0));
  assert.ok(report.regions.every((r) => r.segmentation.boundsPx === null));
  assert.ok(report.regions.every((r) => r.segmentation.boundsNormalized === null));
  assert.ok(report.regions.every((r) => r.segmentation.boundsCm === null));
  assert.ok(report.regions.every((r) => r.semantics.pixelCorrespondence === 'unvalidated'));
  assert.ok(report.regions.every((r) => r.semantics.denseGeometryMeaning === 'unvalidated'));
});

test('preserves present Front segmentation observations with normalized { minU, maxU, minV, maxV } and metric X/Y bounds', () => {
  const mockSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 11,
        label: 'Left_Upper_Arm',
        present: true,
        pixelCount: 15420,
        coverage: 0.003855,
        boundsPx: { minX: 300, minY: 400, maxX: 450, maxY: 700 },
        boundsNormalized: { minX: 0.15, minY: 0.2, maxX: 0.225, maxY: 0.35 },
      },
      {
        classId: 22,
        label: 'Torso',
        present: true,
        pixelCount: 85000,
        coverage: 0.02125,
        boundsPx: { minX: 700, minY: 400, maxX: 1300, maxY: 1100 },
        boundsNormalized: { minU: 0.35, maxU: 0.65, minV: 0.2, maxV: 0.55 },
      },
    ],
  };

  const report = buildAnatomicalRegionEvidence(mockSeg, { view: 'front', widthPx: 2000, heightPx: 2000 });

  assert.equal(report.summary.totalEligibleRegions, 13);
  assert.equal(report.summary.presentRegions, 2);
  assert.equal(report.summary.absentRegions, 11);

  const arm = report.regions.find((r) => r.classId === 11);
  assert.ok(arm);
  assert.equal(arm.label, 'Left_Upper_Arm');
  assert.equal(arm.laterality, 'left');
  assert.equal(arm.segmentation.present, true);
  assert.equal(arm.segmentation.pixelCount, 15420);
  assert.equal(arm.segmentation.coverage, 0.003855);
  assert.deepEqual(arm.segmentation.boundsPx, { minX: 300, minY: 400, maxX: 450, maxY: 700 });
  assert.deepEqual(arm.segmentation.boundsNormalized, { minU: 0.15, maxU: 0.225, minV: 0.2, maxV: 0.35 });

  // Front metric bounds in X/Y cm
  assert.ok(arm.segmentation.boundsCm);
  assert.equal(arm.segmentation.boundsCm.minX, 30.0); // 300 / 2000 * 200
  assert.equal(arm.segmentation.boundsCm.maxX, 45.1); // (450 + 1) / 2000 * 200
  assert.equal(arm.segmentation.boundsCm.minY, 129.9); // (2000 - 701) / 2000 * 200
  assert.equal(arm.segmentation.boundsCm.maxY, 160.0); // (2000 - 400) / 2000 * 200
  assert.equal('minU' in arm.segmentation.boundsCm, false);
  assert.equal('z' in arm.segmentation.boundsCm, false);

  const torso = report.regions.find((r) => r.classId === 22);
  assert.ok(torso);
  assert.equal(torso.laterality, 'central');
  assert.equal(torso.segmentation.present, true);
  assert.deepEqual(torso.segmentation.boundsNormalized, { minU: 0.35, maxU: 0.65, minV: 0.2, maxV: 0.55 });
});

test('preserves Side metric bounds strictly in U/Y and never exposes Z or minX', () => {
  const mockSideSeg = {
    view: 'side',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      {
        classId: 12,
        label: 'Left_Upper_Leg',
        present: true,
        pixelCount: 22000,
        coverage: 0.0055,
        boundsPx: { minX: 600, minY: 800, maxX: 900, maxY: 1400 },
        boundsNormalized: { minX: 0.3, minY: 0.4, maxX: 0.45, maxY: 0.7 },
      },
    ],
  };

  const report = buildAnatomicalRegionEvidence(mockSideSeg, { view: 'side', widthPx: 2000, heightPx: 2000 });

  assert.equal(report.view, 'side');
  const leg = report.regions.find((r) => r.classId === 12);
  assert.ok(leg);
  assert.equal(leg.laterality, 'left');
  assert.equal(leg.segmentation.present, true);

  // Side metric bounds
  assert.ok(leg.segmentation.boundsCm);
  assert.equal(leg.segmentation.boundsCm.minU, 60.0); // 600 / 2000 * 200
  assert.equal(leg.segmentation.boundsCm.maxU, 90.1); // (900 + 1) / 2000 * 200
  assert.equal(leg.segmentation.boundsCm.minY, 59.9); // (2000 - 1401) / 2000 * 200
  assert.equal(leg.segmentation.boundsCm.maxY, 120.0); // (2000 - 800) / 2000 * 200

  assert.equal('minX' in leg.segmentation.boundsCm, false);
  assert.equal('maxX' in leg.segmentation.boundsCm, false);
  assert.equal('minZ' in leg.segmentation.boundsCm, false);
  assert.equal('z' in leg.segmentation.boundsCm, false);
});

test('attaches view-level dense qualification facts and pixelAddressable from cross-modal QA', () => {
  const mockSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      { classId: 22, label: 'Torso', present: true, pixelCount: 50000, boundsPx: { minX: 500, minY: 500, maxX: 1500, maxY: 1500 } },
    ],
  };

  const mockDenseQa = {
    pointmap: { status: 'pass' },
    normals: { status: 'warning' },
    crossModal: {
      availability: { segmentation: true, pointmap: true, normals: true },
      compatibility: { dimensionalCompatibility: true, pixelIndexAddressable: true },
    },
  };

  const report = buildAnatomicalRegionEvidence(mockSeg, {
    view: 'front',
    denseQa: mockDenseQa,
    crossModalQa: mockDenseQa.crossModal,
    widthPx: 2000,
    heightPx: 2000,
  });

  for (const region of report.regions) {
    assert.equal(region.denseEvidence.pointmap.available, true);
    assert.equal(region.denseEvidence.pointmap.qaStatus, 'pass');
    assert.equal(region.denseEvidence.normals.available, true);
    assert.equal(region.denseEvidence.normals.qaStatus, 'warning');
    assert.equal(region.denseEvidence.pixelAddressable, true);
    assert.equal(region.semantics.pixelCorrespondence, 'unvalidated');
    assert.equal(region.semantics.denseGeometryMeaning, 'unvalidated');
  }
});

test('handles missing dense modalities and incompatible pixelAddressable cleanly (boolean | null)', () => {
  const mockSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [],
  };

  // Case 1: No dense modalities available -> pixelAddressable is null
  const reportNoDense = buildAnatomicalRegionEvidence(mockSeg, { view: 'front' });
  const region1 = reportNoDense.regions[0];
  assert.equal(region1.denseEvidence.pointmap.available, false);
  assert.equal(region1.denseEvidence.pointmap.qaStatus, null);
  assert.equal(region1.denseEvidence.normals.available, false);
  assert.equal(region1.denseEvidence.normals.qaStatus, null);
  assert.equal(region1.denseEvidence.pixelAddressable, null);

  // Case 2: Incompatible dimensions -> pixelAddressable is false
  const mockDenseIncompatible = {
    pointmap: { status: 'fail' },
    normals: null,
    crossModal: {
      availability: { segmentation: true, pointmap: true, normals: false },
      compatibility: { dimensionalCompatibility: false, pixelIndexAddressable: false },
    },
  };

  const reportIncompatible = buildAnatomicalRegionEvidence(mockSeg, {
    view: 'front',
    denseQa: mockDenseIncompatible,
    crossModalQa: mockDenseIncompatible.crossModal,
  });
  const region2 = reportIncompatible.regions[0];
  assert.equal(region2.denseEvidence.pointmap.available, true);
  assert.equal(region2.denseEvidence.pointmap.qaStatus, 'fail');
  assert.equal(region2.denseEvidence.normals.available, false);
  assert.equal(region2.denseEvidence.normals.qaStatus, null);
  assert.equal(region2.denseEvidence.pixelAddressable, false);
});

test('non-body classes and synthetic regions are never present in eligible report', () => {
  const mockSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      { classId: 0, label: 'Background', present: true, pixelCount: 500000 },
      { classId: 1, label: 'Apparel', present: true, pixelCount: 200000 },
      { classId: 3, label: 'Face_Neck', present: true, pixelCount: 30000 },
      { classId: 9, label: 'Left_Shoe', present: true, pixelCount: 10000 },
      { classId: 22, label: 'Torso', present: true, pixelCount: 80000, boundsPx: { minX: 100, minY: 100, maxX: 500, maxY: 500 } },
    ],
  };

  const report = buildAnatomicalRegionEvidence(mockSeg, { view: 'front', widthPx: 2000, heightPx: 2000 });

  assert.equal(report.regions.length, 13);
  assert.ok(!report.regions.some((r) => r.label === 'Background'));
  assert.ok(!report.regions.some((r) => r.label === 'Apparel'));
  assert.ok(!report.regions.some((r) => r.label === 'Face_Neck'));
  assert.ok(!report.regions.some((r) => r.label === 'Left_Shoe'));
  assert.ok(!report.regions.some((r) => r.label === 'chest'));
  assert.ok(!report.regions.some((r) => r.label === 'waist'));
  assert.ok(!report.regions.some((r) => r.label === 'bust'));

  assert.equal(report.summary.presentRegions, 1);
  assert.equal(report.summary.absentRegions, 12);
});

test('does not mutate input objects and produces deterministic output regardless of input ordering', () => {
  const mockSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      { classId: 22, label: 'Torso', present: true, pixelCount: 50000, boundsPx: { minX: 100, minY: 100, maxX: 500, maxY: 500 } },
      { classId: 5, label: 'Left_Foot', present: true, pixelCount: 10000, boundsPx: { minX: 50, minY: 50, maxX: 150, maxY: 150 } },
    ],
  };

  const inputCopy = JSON.parse(JSON.stringify(mockSeg));

  const report1 = buildAnatomicalRegionEvidence(mockSeg, { view: 'front', widthPx: 2000, heightPx: 2000 });
  const report2 = buildAnatomicalRegionEvidence(mockSeg, { view: 'front', widthPx: 2000, heightPx: 2000 });

  assert.deepEqual(mockSeg, inputCopy);
  assert.deepEqual(report1, report2);
  assert.equal(report1.regions[0].classId, 5);
  assert.equal(report1.regions[12].classId, 22);
});

test('never calls getDenseData or decodes dense buffers during region evidence assembly', () => {
  let getDenseDataCalled = false;
  const mockPointmap = {
    present: true,
    getDenseData() {
      getDenseDataCalled = true;
      return new Float32Array(100);
    },
  };
  const mockNormals = {
    present: true,
    getDenseData() {
      getDenseDataCalled = true;
      return new Float32Array(100);
    },
  };

  const mockSeg = {
    view: 'front',
    widthPx: 2000,
    heightPx: 2000,
    classes: [
      { classId: 22, label: 'Torso', present: true, pixelCount: 50000, boundsPx: { minX: 100, minY: 100, maxX: 500, maxY: 500 } },
    ],
  };

  const report = buildAnatomicalRegionEvidence(mockSeg, {
    view: 'front',
    pointmap: mockPointmap,
    normals: mockNormals,
  });

  assert.equal(getDenseDataCalled, false);
  assert.equal(report.regions[0].denseEvidence.pointmap.available, true);
  assert.equal(report.regions[0].denseEvidence.normals.available, true);
});

test('bodyEvidence.js runtime getters expose Front and Side anatomical region evidence reports', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getFrontAnatomicalRegionEvidence,
    getSideAnatomicalRegionEvidence,
    getAnatomicalRegionEvidence,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // Raster with Background (0), Left_Upper_Arm (11), Torso (22)
  const rasterFront = new Uint8Array([0, 11, 22, 0]);
  const rasterSide = new Uint8Array([0, 22, 0, 0]);

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[11] = 'Left_Upper_Arm';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 2, Left_Upper_Arm: 1, Torso: 1 },
        labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
    side: {
      segmentation: {
        model: 'schp',
        view: 'side',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 3, Torso: 1 },
        labels: { shape: [2, 2], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  const frontReport = getFrontAnatomicalRegionEvidence();
  assert.ok(frontReport);
  assert.equal(frontReport.contract, 'anatomical-region-evidence-v0');
  assert.equal(frontReport.view, 'front');
  assert.equal(frontReport.summary.presentRegions, 2);
  assert.equal(frontReport.summary.absentRegions, 11);

  const sideReport = getSideAnatomicalRegionEvidence();
  assert.ok(sideReport);
  assert.equal(sideReport.contract, 'anatomical-region-evidence-v0');
  assert.equal(sideReport.view, 'side');
  assert.equal(sideReport.summary.presentRegions, 1);
  assert.equal(sideReport.summary.absentRegions, 12);

  const combined = getAnatomicalRegionEvidence();
  assert.ok(combined);
  assert.equal(combined.front.view, 'front');
  assert.equal(combined.side.view, 'side');

  // Reset package
  setBodyEvidencePackage(null);
  assert.equal(getFrontAnatomicalRegionEvidence(), null);
  assert.equal(getSideAnatomicalRegionEvidence(), null);
  assert.equal(getAnatomicalRegionEvidence(), null);
});



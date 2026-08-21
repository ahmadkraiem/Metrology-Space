import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT,
  CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION,
  CROSS_VIEW_CORRESPONDENCE_STATUS,
  SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0,
  buildCrossViewMeasurementCorrespondence,
} from './crossViewMeasurementCorrespondence.js';

test('Cross-view Measurement Correspondence Contract v0 exports contract metadata and supported definitions', () => {
  assert.equal(CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT, 'cross-view-measurement-correspondence-v0');
  assert.equal(CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION, 'cross-view-measurement-correspondence-v0');

  assert.equal(CROSS_VIEW_CORRESPONDENCE_STATUS.READY, 'ready');
  assert.equal(CROSS_VIEW_CORRESPONDENCE_STATUS.PARTIAL, 'partial');
  assert.equal(CROSS_VIEW_CORRESPONDENCE_STATUS.UNAVAILABLE, 'unavailable');
  assert.equal(CROSS_VIEW_CORRESPONDENCE_STATUS.INVALID, 'invalid');

  const defs = SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0;
  assert.ok(defs.torso_shoulder_cross_view_correspondence);
  assert.equal(defs.torso_shoulder_cross_view_correspondence.id, 'torso_shoulder_cross_view_correspondence');
  assert.equal(defs.torso_shoulder_cross_view_correspondence.name, 'Torso Shoulder Cross-View Measurement Correspondence');
  assert.equal(defs.torso_shoulder_cross_view_correspondence.sourceLevel, 'shoulder');
  assert.equal(defs.torso_shoulder_cross_view_correspondence.frontDefinitionId, 'torso_width_at_shoulder_level');
  assert.equal(defs.torso_shoulder_cross_view_correspondence.sideDefinitionId, 'torso_profile_span_at_shoulder_level');

  assert.ok(defs.torso_hip_cross_view_correspondence);
  assert.equal(defs.torso_hip_cross_view_correspondence.id, 'torso_hip_cross_view_correspondence');
  assert.equal(defs.torso_hip_cross_view_correspondence.name, 'Torso Hip Cross-View Measurement Correspondence');
  assert.equal(defs.torso_hip_cross_view_correspondence.sourceLevel, 'hip');
  assert.equal(defs.torso_hip_cross_view_correspondence.frontDefinitionId, 'torso_width_at_hip_level');
  assert.equal(defs.torso_hip_cross_view_correspondence.sideDefinitionId, 'torso_profile_span_at_hip_level');
});

test('pairs two valid observations at shoulder level into status ready with full provenance', () => {
  const frontObservation = {
    contract: 'front-transverse-width-v0',
    version: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    name: 'Torso Transverse Width at Shoulder Level',
    type: 'transverse_width',
    status: 'valid',
    valueCm: 42.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      targetPolicy: 'torso_only',
      targetClassIds: [22],
      runSelectionPolicy: 'single_run_required',
      selectedRunIndex: 0,
      leftXcm: 79.0,
      rightXcm: 121.0,
    },
    issues: [],
  };

  const sideObservation = {
    contract: 'side-profile-span-v0',
    version: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    name: 'Torso Profile Span at Shoulder Level',
    type: 'profile_span',
    status: 'valid',
    valueCm: 28.0,
    minUcm: 86.0,
    maxUcm: 114.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      targetPolicy: 'torso_only',
      targetClassIds: [22],
      runSelectionPolicy: 'single_run_required',
      selectedRunIndex: 0,
      minUcm: 86.0,
      maxUcm: 114.0,
    },
    issues: [],
  };

  const result = buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });

  assert.equal(result.contract, 'cross-view-measurement-correspondence-v0');
  assert.equal(result.version, 'cross-view-measurement-correspondence-v0');
  assert.equal(result.id, 'torso_shoulder_cross_view_correspondence');
  assert.equal(result.name, 'Torso Shoulder Cross-View Measurement Correspondence');
  assert.equal(result.type, 'cross_view_measurement_correspondence');
  assert.equal(result.sourceLevel, 'shoulder');
  assert.equal(result.status, 'ready');
  assert.equal(result.frontDefinitionId, 'torso_width_at_shoulder_level');
  assert.equal(result.sideDefinitionId, 'torso_profile_span_at_shoulder_level');

  assert.equal(result.frontObservation.valueCm, 42.0);
  assert.equal(result.sideObservation.valueCm, 28.0);
  assert.equal(result.sideObservation.minUcm, 86.0);
  assert.equal(result.sideObservation.maxUcm, 114.0);

  assert.equal(result.provenance.sourceLevel, 'shoulder');
  assert.equal(result.provenance.frontLevelYcm, 150.0);
  assert.equal(result.provenance.sideLevelYcm, 150.0);
  assert.equal(result.provenance.frontSampledPixelRow, 500);
  assert.equal(result.provenance.sideSampledPixelRow, 500);
  assert.equal(result.provenance.frontContract, 'front-transverse-width-v0');
  assert.equal(result.provenance.sideContract, 'side-profile-span-v0');
  assert.equal(result.issues.length, 0);
});

test('pairs two valid observations at hip level into status ready', () => {
  const frontObservation = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_hip_level',
    status: 'valid',
    valueCm: 36.0,
    provenance: { sourceLevel: 'hip', levelYcm: 90.0, sampledPixelRow: 1100 },
  };
  const sideObservation = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_hip_level',
    status: 'valid',
    valueCm: 25.0,
    provenance: { sourceLevel: 'hip', levelYcm: 90.0, sampledPixelRow: 1100 },
  };

  const result = buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
    definition: 'torso_hip_cross_view_correspondence',
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.sourceLevel, 'hip');
  assert.equal(result.frontObservation.valueCm, 36.0);
  assert.equal(result.sideObservation.valueCm, 25.0);
  assert.equal(result.provenance.frontLevelYcm, 90.0);
  assert.equal(result.provenance.sideLevelYcm, 90.0);
});

test('evaluates status partial when one observation is valid and the other is unavailable or ambiguous', () => {
  const validFront = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  const unavailSide = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'unavailable',
    valueCm: null,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  const ambigSide = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'ambiguous',
    valueCm: null,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  // Valid Front + Unavailable Side -> partial
  const res1 = buildCrossViewMeasurementCorrespondence(validFront, unavailSide, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(res1.status, 'partial');

  // Valid Front + Ambiguous Side -> partial
  const res2 = buildCrossViewMeasurementCorrespondence(validFront, ambigSide, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(res2.status, 'partial');

  // Null Side -> partial
  const res3 = buildCrossViewMeasurementCorrespondence(validFront, null, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(res3.status, 'partial');
});

test('evaluates status unavailable when both observations are unavailable, ambiguous, or null', () => {
  const unavailFront = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_hip_level',
    status: 'unavailable',
    valueCm: null,
    provenance: { sourceLevel: 'hip', levelYcm: null },
  };
  const unavailSide = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_hip_level',
    status: 'unavailable',
    valueCm: null,
    provenance: { sourceLevel: 'hip', levelYcm: null },
  };

  const result = buildCrossViewMeasurementCorrespondence(unavailFront, unavailSide, {
    definition: 'torso_hip_cross_view_correspondence',
  });
  assert.equal(result.status, 'unavailable');

  // Both null
  const resNull = buildCrossViewMeasurementCorrespondence(null, null, {
    definition: 'torso_hip_cross_view_correspondence',
  });
  assert.equal(resNull.status, 'unavailable');
});

test('evaluates status invalid when source evidence is invalid (precedence rule)', () => {
  const invalidFront = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'invalid',
    valueCm: null,
    issues: ['Malformed bounds'],
    provenance: { sourceLevel: 'shoulder' },
  };
  const validSide = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  const result = buildCrossViewMeasurementCorrespondence(invalidFront, validSide, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(result.status, 'invalid');
  assert.ok(result.issues.some((i) => i.includes('Front observation has invalid status')));
});

test('evaluates status invalid for mismatched source levels, mismatched definition IDs, or invalid contracts', () => {
  // Mismatched source levels (front shoulder, side hip)
  const frontShoulder = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };
  const sideHip = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_hip_level',
    status: 'valid',
    valueCm: 25.0,
    provenance: { sourceLevel: 'hip', levelYcm: 90.0 },
  };

  const resMismatched = buildCrossViewMeasurementCorrespondence(frontShoulder, sideHip, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(resMismatched.status, 'invalid');
  assert.ok(resMismatched.issues.some((i) => i.includes('Mismatched Side definition ID') || i.includes('Mismatched Side sourceLevel')));

  // Wrong contract
  const resBadContract = buildCrossViewMeasurementCorrespondence(
    { contract: 'wrong-front-contract', view: 'front' },
    { contract: 'side-profile-span-v0', view: 'side', id: 'torso_profile_span_at_shoulder_level' },
    { definition: 'torso_shoulder_cross_view_correspondence' },
  );
  assert.equal(resBadContract.status, 'invalid');
  assert.ok(resBadContract.issues.some((i) => i.includes('Invalid Front observation')));

  // Unsupported definition (registry-driven constraint)
  const resUnsupp = buildCrossViewMeasurementCorrespondence(frontShoulder, sideHip, {
    definition: 'unsupported_custom_pairing',
  });
  assert.equal(resUnsupp.status, 'invalid');
  assert.ok(resUnsupp.issues.some((i) => i.includes('must be registry-driven')));
});

test('evaluates status invalid when Y-level provenance is contradictory', () => {
  const frontObs = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };
  const sideObs = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 140.0 }, // differs from 150.0
  };

  const result = buildCrossViewMeasurementCorrespondence(frontObs, sideObs, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });

  assert.equal(result.status, 'invalid');
  assert.ok(result.issues.some((i) => i.includes('Contradictory Y-level provenance')));
});

test('buildCrossViewMeasurementCorrespondence is pure, deterministic, and does not mutate inputs', () => {
  const frontObs = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };
  const sideObs = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  const frontCopy = JSON.parse(JSON.stringify(frontObs));
  const sideCopy = JSON.parse(JSON.stringify(sideObs));

  const res1 = buildCrossViewMeasurementCorrespondence(frontObs, sideObs, { definition: 'torso_shoulder_cross_view_correspondence' });
  const res2 = buildCrossViewMeasurementCorrespondence(frontObs, sideObs, { definition: 'torso_shoulder_cross_view_correspondence' });

  assert.deepEqual(res1, res2);
  assert.deepEqual(frontObs, frontCopy);
  assert.deepEqual(sideObs, sideCopy);
});

test('bodyEvidence.js getCrossViewMeasurementCorrespondence and getCrossViewMeasurementCorrespondences integrate with active runtime state', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getCrossViewMeasurementCorrespondence,
    getCrossViewMeasurementCorrespondences,
  } = await import('./bodyEvidence.js');
  const { buildBodyEvidencePackage } = await import('./bodyEvidencePackage.js');

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 10x10 images
  // Row 2 (yCm = 150): Torso (22) from col 3 to 6 in both Front and Side
  const rasterFront = new Uint8Array(100);
  for (let c = 3; c <= 6; c += 1) rasterFront[2 * 10 + c] = 22;

  const rasterSide = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) rasterSide[2 * 10 + c] = 22; // 2 pixels -> 40 cm

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
        class_counts: { Background: 96, Torso: 4 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
    side: {
      segmentation: {
        model: 'schp',
        view: 'side',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 98, Torso: 2 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterSide) },
      },
    },
  });

  setBodyEvidencePackage(pkg);

  const mockAnnotations = [
    { type: 'body_landmark', name: 'left_shoulder', point: { x: 30, y: 150, z: 200 } },
    { type: 'body_landmark', name: 'right_shoulder', point: { x: 70, y: 150, z: 200 } },
  ];

  const res = await analyzeLoadedBodyEvidenceAsync();
  assert.equal(res.ok, true);

  // Single getter: shoulder correspondence is ready (both Front and Side are valid)
  const shoulderCorr = getCrossViewMeasurementCorrespondence({
    id: 'torso_shoulder_cross_view_correspondence',
    annotations: mockAnnotations,
  });
  assert.ok(shoulderCorr);
  assert.equal(shoulderCorr.contract, 'cross-view-measurement-correspondence-v0');
  assert.equal(shoulderCorr.id, 'torso_shoulder_cross_view_correspondence');
  assert.equal(shoulderCorr.status, 'ready');
  assert.equal(shoulderCorr.frontObservation.valueCm, 80.0);
  assert.equal(shoulderCorr.sideObservation.valueCm, 40.0);

  // Single getter: hip correspondence is unavailable (hip level has no promoted landmarks)
  const hipCorr = getCrossViewMeasurementCorrespondence({
    id: 'torso_hip_cross_view_correspondence',
    annotations: mockAnnotations,
  });
  assert.ok(hipCorr);
  assert.equal(hipCorr.status, 'unavailable');

  // Bulk getter
  const report = getCrossViewMeasurementCorrespondences({ annotations: mockAnnotations });
  assert.ok(report);
  assert.equal(report.contract, 'cross-view-measurement-correspondences-report-v0');
  assert.equal(report.correspondences.length, 2);
  assert.equal(report.correspondences[0].status, 'ready');
  assert.equal(report.correspondences[1].status, 'unavailable');

  // Reset
  setBodyEvidencePackage(null);
  assert.equal(getCrossViewMeasurementCorrespondences({ annotations: mockAnnotations }), null);
});

test('Cross-view Measurement Correspondence strictly enforces guardrails: no depth, Z, or circumference fields', () => {
  const frontObservation = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 42.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };
  const sideObservation = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 28.0,
    minUcm: 86.0,
    maxUcm: 114.0,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  const result = buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });

  // Strict check that no 3D depth, circumference, ellipse, or cross-section fields are created
  assert.ok(!('depthCm' in result));
  assert.ok(!('zCm' in result));
  assert.ok(!('physicalDepthCm' in result));
  assert.ok(!('circumference' in result));
  assert.ok(!('circumferenceCm' in result));
  assert.ok(!('ellipse' in result));
  assert.ok(!('crossSection' in result));
  assert.ok(!('volume' in result));
  assert.ok(!('depthCm' in result.provenance));
  assert.ok(!('zCm' in result.provenance));
});

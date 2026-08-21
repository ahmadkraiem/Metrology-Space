import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CROSS_VIEW_COMPARABILITY_QA_CONTRACT,
  CROSS_VIEW_COMPARABILITY_QA_CONTRACT_VERSION,
  CROSS_VIEW_COMPARABILITY_QA_STATUS,
  CROSS_VIEW_COMPARABILITY_AVAILABILITY,
  evaluateCrossViewComparabilityQa,
} from './crossViewComparabilityQa.js';
import {
  buildCrossViewMeasurementCorrespondence,
} from './crossViewMeasurementCorrespondence.js';

test('Cross-view Comparability QA Contract v0 exports contract metadata and status enums', () => {
  assert.equal(CROSS_VIEW_COMPARABILITY_QA_CONTRACT, 'cross-view-comparability-qa-v0');
  assert.equal(CROSS_VIEW_COMPARABILITY_QA_CONTRACT_VERSION, 'cross-view-comparability-qa-v0');

  assert.equal(CROSS_VIEW_COMPARABILITY_QA_STATUS.PASS, 'pass');
  assert.equal(CROSS_VIEW_COMPARABILITY_QA_STATUS.WARNING, 'warning');
  assert.equal(CROSS_VIEW_COMPARABILITY_QA_STATUS.FAIL, 'fail');
  assert.equal(CROSS_VIEW_COMPARABILITY_QA_STATUS.UNAVAILABLE, 'unavailable');

  assert.equal(CROSS_VIEW_COMPARABILITY_AVAILABILITY.AVAILABLE, 'available');
  assert.equal(CROSS_VIEW_COMPARABILITY_AVAILABILITY.UNAVAILABLE, 'unavailable');
});

test('evaluates status pass for a fully ready valid shoulder correspondence', () => {
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

  const correspondence = buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(correspondence.status, 'ready');

  const qa = evaluateCrossViewComparabilityQa(correspondence);

  assert.equal(qa.contract, 'cross-view-comparability-qa-v0');
  assert.equal(qa.version, 'cross-view-comparability-qa-v0');
  assert.equal(qa.correspondenceId, 'torso_shoulder_cross_view_correspondence');
  assert.equal(qa.sourceLevel, 'shoulder');
  assert.equal(qa.availability, 'available');
  assert.equal(qa.status, 'pass');
  assert.equal(qa.summary.failedChecks, 0);
  assert.equal(qa.summary.warnedChecks, 0);
  assert.equal(qa.summary.passedChecks, 10);
  assert.equal(qa.issues.length, 0);
  assert.equal(qa.warnings.length, 0);
});

test('evaluates status pass for a fully ready valid hip correspondence', () => {
  const frontObservation = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_hip_level',
    status: 'valid',
    valueCm: 36.0,
    provenance: {
      sourceLevel: 'hip',
      levelYcm: 90.0,
      sampledPixelRow: 1100,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      leftXcm: 82.0,
      rightXcm: 118.0,
    },
  };
  const sideObservation = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_hip_level',
    status: 'valid',
    valueCm: 25.0,
    minUcm: 87.5,
    maxUcm: 112.5,
    provenance: {
      sourceLevel: 'hip',
      levelYcm: 90.0,
      sampledPixelRow: 1100,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      minUcm: 87.5,
      maxUcm: 112.5,
    },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
    definition: 'torso_hip_cross_view_correspondence',
  });
  const qa = evaluateCrossViewComparabilityQa(correspondence);

  assert.equal(qa.status, 'pass');
  assert.equal(qa.correspondenceId, 'torso_hip_cross_view_correspondence');
  assert.equal(qa.sourceLevel, 'hip');
  assert.equal(qa.summary.passedChecks, 10);
  assert.equal(qa.summary.failedChecks, 0);
});

test('evaluates status warning for partial correspondence (e.g. valid Front + unavailable Side)', () => {
  const validFront = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      leftXcm: 80.0,
      rightXcm: 120.0,
    },
  };

  const unavailSide = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'unavailable',
    valueCm: null,
    provenance: { sourceLevel: 'shoulder', levelYcm: 150.0 },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(validFront, unavailSide, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(correspondence.status, 'partial');

  const qa = evaluateCrossViewComparabilityQa(correspondence);

  assert.equal(qa.status, 'warning');
  assert.equal(qa.availability, 'available');
  assert.equal(qa.summary.failedChecks, 0);
  assert.ok(qa.summary.warnedChecks > 0);
  assert.ok(qa.warnings.some((w) => w.includes('Side observation is unavailable') || w.includes('partial')));
});

test('evaluates status unavailable when correspondence is unavailable or null', () => {
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

  const correspondence = buildCrossViewMeasurementCorrespondence(unavailFront, unavailSide, {
    definition: 'torso_hip_cross_view_correspondence',
  });
  assert.equal(correspondence.status, 'unavailable');

  const qa = evaluateCrossViewComparabilityQa(correspondence);
  assert.equal(qa.status, 'unavailable');
  assert.equal(qa.availability, 'unavailable');
  assert.equal(qa.summary.failedChecks, 0);

  // When correspondence is null
  const nullQa = evaluateCrossViewComparabilityQa(null, { id: 'torso_shoulder_cross_view_correspondence' });
  assert.equal(nullQa.status, 'fail'); // null object is a structural failure
  assert.equal(nullQa.checks.correspondence_contract_valid.status, 'fail');
});

test('evaluates status fail when correspondence is invalid or source evidence is invalid (tightening 1)', () => {
  const invalidFront = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'invalid',
    valueCm: null,
    issues: ['Segmentation decode error'],
    provenance: { sourceLevel: 'shoulder' },
  };
  const validSide = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    minUcm: 85.0,
    maxUcm: 115.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      minUcm: 85.0,
      maxUcm: 115.0,
    },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(invalidFront, validSide, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  assert.equal(correspondence.status, 'invalid');

  const qa = evaluateCrossViewComparabilityQa(correspondence);
  assert.equal(qa.status, 'fail');
  assert.ok(qa.summary.failedChecks > 0);
  assert.ok(qa.issues.some((i) => i.includes('Front observation has invalid status') || i.includes('invalid')));
});

test('evaluates status fail for malformed contracts, unsupported definitions, or mismatched levels', () => {
  // Malformed contract
  const badContractCorr = {
    contract: 'invalid-contract',
    id: 'torso_shoulder_cross_view_correspondence',
    status: 'ready',
  };
  const qa1 = evaluateCrossViewComparabilityQa(badContractCorr);
  assert.equal(qa1.status, 'fail');
  assert.equal(qa1.checks.correspondence_contract_valid.status, 'fail');

  // Unsupported definition
  const unsupportedCorr = {
    contract: 'cross-view-measurement-correspondence-v0',
    id: 'unsupported_correspondence_id',
    status: 'ready',
  };
  const qa2 = evaluateCrossViewComparabilityQa(unsupportedCorr);
  assert.equal(qa2.status, 'fail');
  assert.equal(qa2.checks.supported_definition.status, 'fail');
});

test('evaluates status fail when Y-level provenance is contradictory (tightening 2)', () => {
  const frontObs = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      leftXcm: 80.0,
      rightXcm: 120.0,
    },
  };
  const sideObs = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    minUcm: 85.0,
    maxUcm: 115.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 140.0, // Contradicts 150.0
      sampledPixelRow: 550,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      minUcm: 85.0,
      maxUcm: 115.0,
    },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(frontObs, sideObs, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  const qa = evaluateCrossViewComparabilityQa(correspondence);

  assert.equal(qa.status, 'fail');
  assert.equal(qa.checks.y_provenance_consistent.status, 'fail');
  assert.ok(qa.issues.some((i) => i.includes('Contradictory Y-level provenance')));
});

test('evaluates status fail when required metric endpoints are missing on valid observations', () => {
  const frontObsIncomplete = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: null, // missing valueCm
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      leftXcm: null, // missing
      rightXcm: null,
    },
  };
  const sideObs = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    minUcm: 85.0,
    maxUcm: 115.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      minUcm: 85.0,
      maxUcm: 115.0,
    },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(frontObsIncomplete, sideObs, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  const qa = evaluateCrossViewComparabilityQa(correspondence);

  assert.equal(qa.status, 'fail');
  assert.equal(qa.checks.front_measurement_evidence_complete.status, 'fail');
});

test('evaluateCrossViewComparabilityQa is pure, deterministic, and does not mutate inputs', () => {
  const frontObs = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 40.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      leftXcm: 80.0,
      rightXcm: 120.0,
    },
  };
  const sideObs = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 30.0,
    minUcm: 85.0,
    maxUcm: 115.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      minUcm: 85.0,
      maxUcm: 115.0,
    },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(frontObs, sideObs, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });

  const corrCopy = JSON.parse(JSON.stringify(correspondence));

  const res1 = evaluateCrossViewComparabilityQa(correspondence);
  const res2 = evaluateCrossViewComparabilityQa(correspondence);

  assert.deepEqual(res1, res2);
  assert.deepEqual(correspondence, corrCopy);
});

test('bodyEvidence.js getCrossViewComparabilityQa and getCrossViewComparabilityQaReport integrate with active runtime state', async () => {
  const {
    setBodyEvidencePackage,
    analyzeLoadedBodyEvidenceAsync,
    getCrossViewComparabilityQa,
    getCrossViewComparabilityQaReport,
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
  // Row 2 (yCm = 150): Torso (22) from col 3 to 6 in Front, col 4 to 5 in Side
  const rasterFront = new Uint8Array(100);
  for (let c = 3; c <= 6; c += 1) rasterFront[2 * 10 + c] = 22;

  const rasterSide = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) rasterSide[2 * 10 + c] = 22;

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

  await analyzeLoadedBodyEvidenceAsync();

  // Single getter: shoulder correspondence passes QA
  const shoulderQa = getCrossViewComparabilityQa({
    id: 'torso_shoulder_cross_view_correspondence',
    annotations: mockAnnotations,
  });
  assert.ok(shoulderQa);
  assert.equal(shoulderQa.contract, 'cross-view-comparability-qa-v0');
  assert.equal(shoulderQa.correspondenceId, 'torso_shoulder_cross_view_correspondence');
  assert.equal(shoulderQa.status, 'pass');
  assert.equal(shoulderQa.summary.failedChecks, 0);

  // Single getter: hip correspondence is unavailable
  const hipQa = getCrossViewComparabilityQa({
    id: 'torso_hip_cross_view_correspondence',
    annotations: mockAnnotations,
  });
  assert.ok(hipQa);
  assert.equal(hipQa.status, 'unavailable');

  // Bulk QA report
  const report = getCrossViewComparabilityQaReport({ annotations: mockAnnotations });
  assert.ok(report);
  assert.equal(report.contract, 'cross-view-comparability-qa-report-v0');
  assert.equal(report.summary.total, 2);
  assert.equal(report.summary.passCount, 1);
  assert.equal(report.summary.unavailableCount, 1);
  assert.equal(report.results.length, 2);

  // Reset
  setBodyEvidencePackage(null);
  assert.equal(getCrossViewComparabilityQaReport({ annotations: mockAnnotations }), null);
});

test('Cross-view Comparability QA strictly enforces guardrails: no depth, Z, or circumference fields', () => {
  const frontObservation = {
    contract: 'front-transverse-width-v0',
    view: 'front',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    valueCm: 42.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'front-horizontal-raster-slice-v0',
      leftXcm: 79.0,
      rightXcm: 121.0,
    },
  };
  const sideObservation = {
    contract: 'side-profile-span-v0',
    view: 'side',
    id: 'torso_profile_span_at_shoulder_level',
    status: 'valid',
    valueCm: 28.0,
    minUcm: 86.0,
    maxUcm: 114.0,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 150.0,
      sampledPixelRow: 500,
      sourceSliceContract: 'side-horizontal-raster-slice-v0',
      minUcm: 86.0,
      maxUcm: 114.0,
    },
  };

  const correspondence = buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, {
    definition: 'torso_shoulder_cross_view_correspondence',
  });
  const qa = evaluateCrossViewComparabilityQa(correspondence);

  // Strict check that no 3D depth, circumference, ellipse, or cross-section fields are created
  assert.ok(!('depthCm' in qa));
  assert.ok(!('zCm' in qa));
  assert.ok(!('physicalDepthCm' in qa));
  assert.ok(!('circumference' in qa));
  assert.ok(!('circumferenceCm' in qa));
  assert.ok(!('ellipse' in qa));
  assert.ok(!('crossSection' in qa));
  assert.ok(!('volume' in qa));
  assert.ok(!('depthCm' in qa.summary));
  assert.ok(!('zCm' in qa.summary));
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
  MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
  VISUALIZATION_TYPES,
  VISUALIZATION_STATUS,
  resolveMeasurementVisualizationProvenance,
} from './measurementVisualizationProvenance.js';

test('1. Front horizontal width normalizes correctly', () => {
  const frontWidth = {
    contract: 'front-transverse-width-v0',
    id: 'torso_width_at_shoulder_level',
    name: 'Torso Transverse Width at Shoulder Level',
    status: 'valid',
    valueCm: 30.8,
    provenance: {
      sourceLevel: 'shoulder',
      levelYcm: 128.25,
      sampledPixelRow: 717,
      leftXcm: 34.6,
      rightXcm: 65.4,
      targetPolicy: 'trunk_core_support_v0',
    },
  };

  const result = resolveMeasurementVisualizationProvenance(frontWidth);

  assert.equal(result.contract, MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT);
  assert.equal(result.version, MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION);
  assert.equal(result.measurementId, 'torso_width_at_shoulder_level');
  assert.equal(result.visualizationType, VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.deepEqual(result.targetViews, ['front']);
  assert.equal(result.geometry.yCm, 128.25);
  assert.equal(result.geometry.front.rasterRow, 717);
  assert.equal(result.geometry.front.minXcm, 34.6);
  assert.equal(result.geometry.front.maxXcm, 65.4);
  assert.equal(result.geometry.front.widthCm, 30.8);
});

test('2. Side horizontal span normalizes correctly', () => {
  const sideSpan = {
    contract: 'side-profile-span-v0',
    id: 'torso_profile_span_at_hip_level',
    name: 'Torso Profile Span at Hip Level',
    status: 'valid',
    valueCm: 27.7,
    provenance: {
      sourceLevel: 'hip',
      levelYcm: 86.25,
      sampledPixelRow: 1137,
      minUcm: 36.1,
      maxUcm: 63.8,
      targetPolicy: 'pelvic_core_support_v0',
    },
  };

  const result = resolveMeasurementVisualizationProvenance(sideSpan);

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.SIDE_HORIZONTAL_SLICE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.deepEqual(result.targetViews, ['side']);
  assert.equal(result.geometry.yCm, 86.25);
  assert.equal(result.geometry.side.rasterRow, 1137);
  assert.equal(result.geometry.side.minUcm, 36.1);
  assert.equal(result.geometry.side.maxUcm, 63.8);
  assert.equal(result.geometry.side.depthCm, 27.7);
});

test('3 & 4. Cross-view Shoulder and Hip evidence normalize correctly', () => {
  const crossSection = {
    contract: 'cross-section-evidence-v0',
    id: 'torso_cross_section_evidence_at_shoulder_level',
    name: 'Torso Cross-Section Evidence at Shoulder Level',
    sourceLevel: 'shoulder',
    levelYcm: 128.25,
    status: 'qualified',
    frontObservation: {
      transverseWidthCm: 30.8,
      provenance: { sampledPixelRow: 717, leftXcm: 34.6, rightXcm: 65.4 },
    },
    sideObservation: {
      apDepthCm: 11.0,
      provenance: { sampledPixelRow: 717, minUcm: 44.5, maxUcm: 55.5 },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(crossSection);

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.deepEqual(result.targetViews, ['front', 'side']);
  assert.equal(result.geometry.yCm, 128.25);
  assert.equal(result.geometry.front.minXcm, 34.6);
  assert.equal(result.geometry.front.maxXcm, 65.4);
  assert.equal(result.geometry.side.minUcm, 44.5);
  assert.equal(result.geometry.side.maxUcm, 55.5);
});

test('5. Hip Landmark modeled perimeter resolves linked bounds correctly', () => {
  const hipPerimeter = {
    contract: 'modeled-cross-section-perimeter-v0',
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    name: 'Torso Modeled Perimeter Estimate at Hip Landmark Level',
    sourceLevel: 'hip',
    levelYcm: 86.25,
    status: 'modeled',
    valueCm: 110.9831,
    provenance: {
      sourceCrossSectionId: 'torso_cross_section_evidence_at_hip_level',
      frontTransverseWidthCm: 42.2,
      sideApDepthCm: 27.7,
    },
  };

  const linkedCrossSection = {
    id: 'torso_cross_section_evidence_at_hip_level',
    levelYcm: 86.25,
    frontObservation: {
      transverseWidthCm: 42.2,
      provenance: { sampledPixelRow: 1137, leftXcm: 28.9, rightXcm: 71.1 },
    },
    sideObservation: {
      apDepthCm: 27.7,
      provenance: { sampledPixelRow: 1137, minUcm: 36.1, maxUcm: 63.8 },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(hipPerimeter, {
    crossSectionEvidenceReport: linkedCrossSection,
  });

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.geometry.yCm, 86.25);
  assert.equal(result.geometry.front.minXcm, 28.9);
  assert.equal(result.geometry.front.maxXcm, 71.1);
  assert.equal(result.geometry.side.minUcm, 36.1);
  assert.equal(result.geometry.side.maxUcm, 63.8);
});

test('6 & 7. Modeled Hip / Seat Circumference uses stored localization provenance directly without recomputing', () => {
  const seatCircumference = {
    contract: 'modeled-hip-seat-circumference-v0',
    id: 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane',
    name: 'Modeled Hip Circumference',
    status: 'modeled',
    valueCm: 114.1959,
    levelYcm: 79.95,
    provenance: {
      selectedYcm: 79.95,
      frontRasterRow: 1200,
      sideRasterRow: 1200,
      frontTransverseWidthCm: 44.3,
      sideQualifiedApDepthCm: 27.4,
      sliceHighlightCoordinates: {
        yCm: 79.95,
        frontRasterRow: 1200,
        sideRasterRow: 1200,
        frontBoundsCm: { minX: 58.0, maxX: 102.3 },
        sideBoundsCm: { minU: 70.0, maxU: 97.4 },
      },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(seatCircumference);

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.geometry.yCm, 79.95);
  assert.equal(result.geometry.front.rasterRow, 1200);
  assert.equal(result.geometry.side.rasterRow, 1200);
  assert.equal(result.geometry.front.minXcm, 58.0);
  assert.equal(result.geometry.front.maxXcm, 102.3);
  assert.equal(result.geometry.side.minUcm, 70.0);
  assert.equal(result.geometry.side.maxUcm, 97.4);
});

test('8. Landmark segment preserves exact promoted endpoints', () => {
  const segment = {
    contract: 'direct-body-measurements-v0',
    id: 'left_upper_arm_segment_length_projected',
    displayName: 'Left Upper Arm Length',
    status: 'valid',
    valueCm: 29.5,
    geometryType: 'linear_projected_distance',
    provenance: {
      endpointA: { name: 'left_shoulder', x: 65.4, y: 128.25 },
      endpointB: { name: 'left_elbow', x: 70.1, y: 99.1 },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(segment);

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.LANDMARK_SEGMENT);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.geometry.view, 'front');
  assert.equal(result.geometry.endpointA.landmarkId, 'left_shoulder');
  assert.equal(result.geometry.endpointA.xCm, 65.4);
  assert.equal(result.geometry.endpointA.yCm, 128.25);
  assert.equal(result.geometry.endpointB.landmarkId, 'left_elbow');
  assert.equal(result.geometry.endpointB.xCm, 70.1);
  assert.equal(result.geometry.endpointB.yCm, 99.1);
});

test('9 & 10. Kinematic chains build ordered point lists (shoulder->elbow->wrist and hip->knee->ankle)', () => {
  const armChain = {
    contract: 'direct-body-measurements-v0',
    id: 'left_total_arm_chain_length_projected',
    displayName: 'Left Total Arm Chain',
    status: 'valid',
    valueCm: 54.5,
    geometryType: 'segment_chain_length',
    constituentSegmentIds: ['left_upper_arm_segment_length_projected', 'left_forearm_segment_length_projected'],
    provenance: {
      segmentA: {
        id: 'left_upper_arm_segment_length_projected',
        endpointA: { name: 'left_shoulder', x: 65.4, y: 128.25 },
        endpointB: { name: 'left_elbow', x: 70.1, y: 99.1 },
      },
      segmentB: {
        id: 'left_forearm_segment_length_projected',
        endpointA: { name: 'left_elbow', x: 70.1, y: 99.1 },
        endpointB: { name: 'left_wrist', x: 72.3, y: 74.1 },
      },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(armChain);

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.LANDMARK_CHAIN);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.geometry.points.length, 3);
  assert.equal(result.geometry.points[0].landmarkId, 'left_shoulder');
  assert.equal(result.geometry.points[1].landmarkId, 'left_elbow');
  assert.equal(result.geometry.points[2].landmarkId, 'left_wrist');
});

test('11. Broken kinematic chain adjacency returns invalid', () => {
  const brokenChain = {
    contract: 'direct-body-measurements-v0',
    id: 'left_total_arm_chain_length_projected',
    status: 'valid',
    geometryType: 'segment_chain_length',
    provenance: {
      segmentA: {
        endpointA: { name: 'left_shoulder', x: 65.4, y: 128.25 },
        endpointB: { name: 'left_elbow', x: 70.1, y: 99.1 },
      },
      segmentB: {
        endpointA: { name: 'right_wrist', x: 20.0, y: 74.1 }, // Disconnected!
        endpointB: { name: 'left_wrist', x: 72.3, y: 74.1 },
      },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(brokenChain);
  assert.equal(result.status, VISUALIZATION_STATUS.INVALID);
  assert.equal(result.geometry.points, null);
});

test('12 & 13. Vertical torso length and inter-level measurements create vertical_level_interval', () => {
  const verticalTorso = {
    contract: 'direct-body-measurements-v0',
    id: 'vertical_torso_length_neck_to_hip',
    displayName: 'Vertical Torso Length',
    status: 'valid',
    valueCm: 48.75,
    geometryType: 'vertical_inter_level_delta',
    provenance: {
      levelA: { id: 'neck', name: 'Neck Level', yCm: 135.0 },
      levelB: { id: 'hip', name: 'Hip Level', yCm: 86.25 },
      rawDeltaCm: 48.75,
    },
  };

  const result = resolveMeasurementVisualizationProvenance(verticalTorso);

  assert.equal(result.visualizationType, VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.geometry.upperLevelId, 'neck');
  assert.equal(result.geometry.lowerLevelId, 'hip');
  assert.equal(result.geometry.upperYcm, 135.0);
  assert.equal(result.geometry.lowerYcm, 86.25);
  assert.equal(result.geometry.distanceCm, 48.75);
});

test('14 & 15. Cross-view geometry allows Front and Side raster rows to differ while metric Y synchronizes', () => {
  const crossView = {
    contract: 'cross-section-evidence-v0',
    id: 'test_cross_view',
    levelYcm: 80.0,
    status: 'qualified',
    frontObservation: {
      transverseWidthCm: 44.0,
      provenance: { sampledPixelRow: 1200, leftXcm: 50.0, rightXcm: 94.0 },
    },
    sideObservation: {
      apDepthCm: 27.0,
      provenance: { sampledPixelRow: 600, minUcm: 70.0, maxUcm: 97.0 }, // Different image resolution
    },
  };

  const result = resolveMeasurementVisualizationProvenance(crossView);

  assert.equal(result.geometry.yCm, 80.0);
  assert.equal(result.geometry.front.rasterRow, 1200);
  assert.equal(result.geometry.side.rasterRow, 600);
});

test('16 & 17. Missing required provenance returns unavailable; malformed coordinates return invalid', () => {
  const missingProv = {
    contract: 'direct-body-measurements-v0',
    id: 'left_upper_arm_segment_length_projected',
    status: 'unavailable',
    provenance: {},
  };
  const unavailResult = resolveMeasurementVisualizationProvenance(missingProv);
  assert.equal(unavailResult.status, VISUALIZATION_STATUS.UNAVAILABLE);

  const malformedSlice = {
    contract: 'front-transverse-width-v0',
    id: 'torso_width_at_shoulder_level',
    status: 'valid',
    provenance: {
      levelYcm: 100.0,
      leftXcm: 80.0,
      rightXcm: 40.0, // Left > Right is geometrically invalid!
    },
  };
  const invalidResult = resolveMeasurementVisualizationProvenance(malformedSlice);
  assert.equal(invalidResult.status, VISUALIZATION_STATUS.INVALID);
});

test('18. Resolver uses stable definition IDs', () => {
  const level = {
    contract: 'anatomical-levels-v0',
    id: 'hip',
    name: 'Hip Level',
    status: 'ready',
    yCm: 86.25,
    provenance: {
      derivationMethod: 'bilateral_mean_y',
      anchors: [{ name: 'left_hip', point: { x: 40.0, y: 86.25 } }],
    },
  };

  const result = resolveMeasurementVisualizationProvenance(level);
  assert.equal(result.visualizationType, VISUALIZATION_TYPES.FRONT_HORIZONTAL_LEVEL);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.geometry.yCm, 86.25);
});

test('19 & 20. Non-mutation of input evidence and no math recomputation', () => {
  const segment = {
    contract: 'direct-body-measurements-v0',
    id: 'left_thigh_segment_length_projected',
    status: 'valid',
    valueCm: 45.2,
    geometryType: 'linear_projected_distance',
    provenance: {
      endpointA: { name: 'left_hip', x: 40.0, y: 86.25 },
      endpointB: { name: 'left_knee', x: 42.0, y: 41.05 },
    },
  };

  const beforeJson = JSON.stringify(segment);
  resolveMeasurementVisualizationProvenance(segment);
  const afterJson = JSON.stringify(segment);

  assert.equal(beforeJson, afterJson);
});

test('21. Natural Waist Plane localization normalizes correctly with Front and Side evidence', () => {
  const waistReport = {
    contract: 'natural-waist-plane-localization-v0',
    version: 'natural-waist-plane-localization-v0',
    id: 'natural_waist_plane_localization',
    status: 'ready',
    yCm: 115.25,
    rasterRow: 850,
    selectedCandidate: {
      yCm: 115.25,
      rasterRow: 850,
      sideRasterRow: 637,
      frontWidthCm: 28.4,
      frontMinXcm: 35.8,
      frontMaxXcm: 64.2,
      sideRawProfileSpanCm: 20.1,
      sideQualifiedApDepthCm: 20.1,
      sideMinUcm: 39.95,
      sideMaxUcm: 60.05,
      constrictionProminenceCm: 0.85,
    },
    frontEvidence: { status: 'valid', minXcm: 35.8, maxXcm: 64.2, widthCm: 28.4 },
    sideEvidence: { status: 'valid', minUcm: 39.95, maxUcm: 60.05, qualifiedApDepthCm: 20.1 },
    provenance: {
      smoothingWindowCm: 2.0,
      smoothingRadiusSamples: 10,
      sampleSpacingCm: 0.1,
      sliceHighlightCoordinates: {
        yCm: 115.25,
        frontRasterRow: 850,
        sideRasterRow: 637,
        frontBoundsCm: { minX: 35.8, maxX: 64.2 },
        sideBoundsCm: { minU: 39.95, maxU: 60.05 },
      },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(waistReport);

  assert.equal(result.contract, MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT);
  assert.equal(result.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.deepEqual(result.targetViews, ['front', 'side']);
  assert.equal(result.geometry.yCm, 115.25);
  assert.equal(result.geometry.front.rasterRow, 850);
  assert.equal(result.geometry.front.minXcm, 35.8);
  assert.equal(result.geometry.front.maxXcm, 64.2);
  assert.equal(result.geometry.front.widthCm, 28.4);
  assert.equal(result.geometry.side.rasterRow, 637);
  assert.equal(result.geometry.side.minUcm, 39.95);
  assert.equal(result.geometry.side.maxUcm, 60.05);
  assert.equal(result.geometry.side.depthCm, 20.1);
  assert.notEqual(result.geometry.front.rasterRow, result.geometry.side.rasterRow);
});

test('22. Natural Waist Plane localization with Front-only ready (Side unavailable) normalizes without fabricated Side span', () => {
  const frontOnlyWaist = {
    contract: 'natural-waist-plane-localization-v0',
    id: 'natural_waist_plane_localization',
    status: 'ready',
    yCm: 112.5,
    rasterRow: 875,
    selectedCandidate: {
      yCm: 112.5,
      rasterRow: 875,
      sideRasterRow: null,
      frontWidthCm: 29.0,
      frontMinXcm: 35.5,
      frontMaxXcm: 64.5,
      sideRawProfileSpanCm: null,
      sideQualifiedApDepthCm: null,
      sideMinUcm: null,
      sideMaxUcm: null,
    },
    frontEvidence: { status: 'valid', minXcm: 35.5, maxXcm: 64.5, widthCm: 29.0 },
    sideEvidence: { status: 'unavailable', minUcm: null, maxUcm: null },
    warnings: ['side_raster_evidence_unavailable_front_only_evaluation'],
  };

  const result = resolveMeasurementVisualizationProvenance(frontOnlyWaist);

  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.equal(result.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);
  assert.equal(result.geometry.yCm, 112.5);
  assert.equal(result.geometry.front.minXcm, 35.5);
  assert.equal(result.geometry.front.maxXcm, 64.5);
  assert.equal(result.geometry.side, null); // No fabricated side span!
});

test('23. Ambiguous, unavailable, or invalid Natural Waist localization returns non-ready status', () => {
  const ambiguousWaist = {
    contract: 'natural-waist-plane-localization-v0',
    id: 'natural_waist_plane_localization',
    status: 'ambiguous',
    yCm: null,
    blockers: ['ambiguous_multiple_constrictions'],
  };
  const unavailResult = resolveMeasurementVisualizationProvenance(ambiguousWaist);
  assert.equal(unavailResult.status, VISUALIZATION_STATUS.UNAVAILABLE);
  assert.ok(unavailResult.blockers.includes('ambiguous_multiple_constrictions'));

  const invalidWaist = {
    contract: 'natural-waist-plane-localization-v0',
    id: 'natural_waist_plane_localization',
    status: 'invalid',
    yCm: null,
    blockers: ['invalid_anatomical_level_ordering'],
  };
  const invalidResult = resolveMeasurementVisualizationProvenance(invalidWaist);
  assert.equal(invalidResult.status, VISUALIZATION_STATUS.INVALID);
});

test('24. Abdominal Apex Plane localization normalizes correctly with Front and Side evidence', () => {
  const apexLocalization = {
    contract: 'abdominal-apex-plane-localization-v0',
    version: 'abdominal-apex-plane-localization-v0',
    id: 'abdominal_apex_plane_localization',
    name: 'Abdominal Apex Plane Localization',
    status: 'ready',
    yCm: 96.85,
    rasterRow: 1031,
    sideRasterRow: 1031,
    selectedPeak: {
      yCm: 96.85,
      rasterRow: 1031,
      sideRasterRow: 1031,
      frontWidthCm: 26.2,
      frontMinXcm: 87.1,
      frontMaxXcm: 113.3,
      sideProfileSpanCm: 7.2,
      sideMinUcm: 81.5,
      sideMaxUcm: 88.7,
      qualifiedApDepthCm: 7.2,
      rawAnteriorUcm: 81.5,
      prominenceCm: 0.5559,
    },
    provenance: {
      upperYcm: 100.75,
      lowerYcm: 86.25,
      sliceHighlightCoordinates: {
        yCm: 96.85,
        frontRasterRow: 1031,
        sideRasterRow: 1031,
        frontBoundsCm: { minX: 87.1, maxX: 113.3 },
        sideBoundsCm: { minU: 81.5, maxU: 88.7 },
      },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(apexLocalization);

  assert.equal(result.contract, MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT);
  assert.equal(result.visualizationType, VISUALIZATION_TYPES.ABDOMINAL_APEX_PLANE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.deepEqual(result.targetViews, ['front', 'side']);
  assert.equal(result.geometry.yCm, 96.85);
  assert.equal(result.geometry.front.minXcm, 87.1);
  assert.equal(result.geometry.front.maxXcm, 113.3);
  assert.equal(result.geometry.front.widthCm, 26.2);
  assert.equal(result.geometry.side.minUcm, 81.5);
  assert.equal(result.geometry.side.maxUcm, 88.7);
  assert.equal(result.geometry.side.depthCm, 7.2);
});

test('25. Ambiguous, unavailable, or invalid Abdominal Apex localization returns non-ready status', () => {
  const ambiguousApex = {
    contract: 'abdominal-apex-plane-localization-v0',
    id: 'abdominal_apex_plane_localization',
    status: 'ambiguous',
    yCm: null,
    blockers: ['ambiguous_multiple_apex_prominences'],
  };
  const unavailResult = resolveMeasurementVisualizationProvenance(ambiguousApex);
  assert.equal(unavailResult.status, VISUALIZATION_STATUS.UNAVAILABLE);
  assert.ok(unavailResult.blockers.includes('ambiguous_multiple_apex_prominences'));

  const invalidApex = {
    contract: 'abdominal-apex-plane-localization-v0',
    id: 'abdominal_apex_plane_localization',
    status: 'invalid',
    yCm: null,
    blockers: ['invalid_search_window'],
  };
  const invalidResult = resolveMeasurementVisualizationProvenance(invalidApex);
  assert.equal(invalidResult.status, VISUALIZATION_STATUS.INVALID);
});

test('26. Bust Apex Plane localization and Modeled Bust Circumference normalize correctly with Front and Side evidence', () => {
  const bustLocalization = {
    contract: 'bust-apex-plane-localization-v0',
    version: 'bust-apex-plane-localization-v0',
    id: 'bust_apex_plane_localization',
    name: 'Bust Apex Plane Localization',
    status: 'ready',
    yCm: 123.85,
    rasterRow: 761,
    sideRasterRow: 761,
    selectedPeak: {
      yCm: 123.85,
      rasterRow: 761,
      sideRasterRow: 761,
      frontWidthCm: 34.3,
      frontMinXcm: 82.85,
      frontMaxXcm: 117.15,
      sideProfileSpanCm: 29.4,
      sideMinUcm: 80.4,
      sideMaxUcm: 109.8,
      qualifiedApDepthCm: 29.4,
      rawAnteriorUcm: 80.4,
      prominenceCm: 0.6676,
    },
    provenance: {
      shoulderYcm: 140.0,
      naturalWaistSuperiorCrestYcm: 114.0,
      sliceHighlightCoordinates: {
        yCm: 123.85,
        frontRasterRow: 761,
        sideRasterRow: 761,
        frontBoundsCm: { minX: 82.85, maxX: 117.15 },
        sideBoundsCm: { minU: 80.4, maxU: 109.8 },
      },
    },
  };

  const result = resolveMeasurementVisualizationProvenance(bustLocalization);

  assert.equal(result.contract, MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT);
  assert.equal(result.visualizationType, VISUALIZATION_TYPES.BUST_APEX_PLANE);
  assert.equal(result.status, VISUALIZATION_STATUS.READY);
  assert.deepEqual(result.targetViews, ['front', 'side']);
  assert.equal(result.geometry.yCm, 123.85);
  assert.equal(result.geometry.front.minXcm, 82.85);
  assert.equal(result.geometry.front.maxXcm, 117.15);
  assert.equal(result.geometry.front.widthCm, 34.3);
  assert.equal(result.geometry.side.minUcm, 80.4);
  assert.equal(result.geometry.side.maxUcm, 109.8);
  assert.equal(result.geometry.side.depthCm, 29.4);

  // Test modeled bust circumference measurement object resolution
  const modeledBustCircumference = {
    contract: 'modeled-bust-circumference-v0',
    version: 'modeled-bust-circumference-v0',
    id: 'torso_modeled_bust_circumference_at_bust_apex_plane',
    name: 'Modeled Bust Circumference',
    status: 'modeled',
    yCm: 123.85,
    levelYcm: 123.85,
    valueCm: 100.2078,
    model: {
      transverseWidthCm: 34.3,
      apDepthCm: 29.4,
    },
    provenance: {
      frontMinXcm: 82.85,
      frontMaxXcm: 117.15,
      sideMinUcm: 80.4,
      sideMaxUcm: 109.8,
      sliceHighlightCoordinates: {
        yCm: 123.85,
        frontRasterRow: 761,
        sideRasterRow: 761,
        frontBoundsCm: { minX: 82.85, maxX: 117.15 },
        sideBoundsCm: { minU: 80.4, maxU: 109.8 },
      },
    },
  };

  const circResult = resolveMeasurementVisualizationProvenance(modeledBustCircumference);
  assert.equal(circResult.status, VISUALIZATION_STATUS.READY);
  assert.equal(circResult.visualizationType, VISUALIZATION_TYPES.BUST_APEX_PLANE);
  assert.equal(circResult.geometry.yCm, 123.85);
  assert.equal(circResult.geometry.front.widthCm, 34.3);
  assert.equal(circResult.geometry.side.depthCm, 29.4);
});

test('27. Ambiguous, unavailable, or invalid Bust Apex localization returns non-ready status', () => {
  const ambiguousBust = {
    contract: 'bust-apex-plane-localization-v0',
    id: 'bust_apex_plane_localization',
    status: 'ambiguous',
    yCm: null,
    blockers: ['ambiguous_multiple_prominences'],
  };
  const unavailResult = resolveMeasurementVisualizationProvenance(ambiguousBust);
  assert.equal(unavailResult.status, VISUALIZATION_STATUS.UNAVAILABLE);
  assert.ok(unavailResult.blockers.includes('ambiguous_multiple_prominences'));

  const invalidBust = {
    contract: 'bust-apex-plane-localization-v0',
    id: 'bust_apex_plane_localization',
    status: 'invalid',
    yCm: null,
    blockers: ['invalid_search_window'],
  };
  const invalidResult = resolveMeasurementVisualizationProvenance(invalidBust);
  assert.equal(invalidResult.status, VISUALIZATION_STATUS.INVALID);
});


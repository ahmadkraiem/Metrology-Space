/**
 * Measurement Visualization Provenance Normalizer v0
 *
 * Pure deterministic domain contract that converts any currently implemented
 * measurement result object into declarative 2D visualization instructions.
 *
 * Contract: 'measurement-visualization-provenance-v0'
 *
 * SEMANTIC PRINCIPLES:
 * - Read-only adapter: translates existing domain measurement results without
 *   recomputing measurement math, re-localizing seat planes, or altering geometry.
 * - Uniform visualization primitives:
 *   1. 'front_horizontal_slice'
 *   2. 'side_horizontal_slice'
 *   3. 'cross_view_horizontal_slice'
 *   4. 'landmark_segment'
 *   5. 'landmark_chain'
 *   6. 'vertical_level_interval'
 *   7. 'front_horizontal_level'
 * - Preserves exact stored provenance, raster rows, endpoints, and clearance metrics.
 * - Metric Y in cm is the authoritative cross-view synchronization key.
 */

export const MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT = 'measurement-visualization-provenance-v0';
export const MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION = 'measurement-visualization-provenance-v0';

/**
 * Authoritative taxonomy of 2D visualization primitives.
 * @type {Readonly<{
 *   FRONT_HORIZONTAL_SLICE: 'front_horizontal_slice',
 *   SIDE_HORIZONTAL_SLICE: 'side_horizontal_slice',
 *   CROSS_VIEW_HORIZONTAL_SLICE: 'cross_view_horizontal_slice',
 *   LANDMARK_SEGMENT: 'landmark_segment',
 *   LANDMARK_CHAIN: 'landmark_chain',
 *   VERTICAL_LEVEL_INTERVAL: 'vertical_level_interval',
 *   FRONT_HORIZONTAL_LEVEL: 'front_horizontal_level',
 * }>}
 */
export const VISUALIZATION_TYPES = Object.freeze({
  FRONT_HORIZONTAL_SLICE: 'front_horizontal_slice',
  SIDE_HORIZONTAL_SLICE: 'side_horizontal_slice',
  CROSS_VIEW_HORIZONTAL_SLICE: 'cross_view_horizontal_slice',
  NATURAL_WAIST_PLANE: 'natural_waist_plane',
  ABDOMINAL_APEX_PLANE: 'abdominal_apex_plane',
  BUST_APEX_PLANE: 'bust_apex_plane',
  LANDMARK_SEGMENT: 'landmark_segment',
  LANDMARK_CHAIN: 'landmark_chain',
  VERTICAL_LEVEL_INTERVAL: 'vertical_level_interval',
  FRONT_HORIZONTAL_LEVEL: 'front_horizontal_level',
});

/**
 * Visualization resolution status enum.
 * @type {Readonly<{
 *   READY: 'ready',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const VISUALIZATION_STATUS = Object.freeze({
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

const KNOWN_ANATOMICAL_LEVEL_IDS = new Set([
  'neck',
  'shoulder',
  'elbow',
  'wrist',
  'hip',
  'knee',
  'ankle',
]);

/**
 * Builds an empty/fallback visualization provenance result.
 */
function buildEmptyVisualizationResult(measurementId = 'unknown', {
  displayName = 'Unknown Measurement',
  visualizationType = null,
  targetViews = [],
  status = VISUALIZATION_STATUS.UNAVAILABLE,
  geometry = null,
  provenance = {},
  blockers = [],
  warnings = [],
  issues = [],
} = {}) {
  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId,
    displayName,
    visualizationType,
    targetViews,
    recommendedWorkspaceMode: targetViews.includes('side') ? 'WORKSPACE_SPLIT' : 'WORKSPACE_SPLIT',
    geometry,
    provenance,
    status,
    blockers,
    warnings,
    issues,
  };
}

/**
 * Resolves Front Horizontal Slice visualization for front transverse widths.
 */
function resolveFrontHorizontalSlice(measurement) {
  const yCm = measurement.provenance?.levelYcm ?? null;
  const rasterRow = measurement.provenance?.sampledPixelRow ?? null;
  const minXcm = measurement.provenance?.leftXcm ?? null;
  const maxXcm = measurement.provenance?.rightXcm ?? null;
  const widthCm = measurement.valueCm ?? (minXcm !== null && maxXcm !== null ? Number((maxXcm - minXcm).toFixed(4)) : null);

  const isGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
    && typeof minXcm === 'number' && Number.isFinite(minXcm)
    && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
    && maxXcm >= minXcm;

  const isReady = isGeometryValid && measurement.status === 'valid';
  const isInvalid = measurement.status === 'invalid' || (minXcm !== null && maxXcm !== null && minXcm > maxXcm);

  const blockers = [];
  if (!isReady) {
    blockers.push(isInvalid ? 'front_slice_evidence_invalid' : 'front_slice_evidence_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id,
    displayName: measurement.name ?? measurement.displayName ?? 'Torso Transverse Width',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      view: 'front',
      yCm,
      front: {
        rasterRow,
        minXcm,
        maxXcm,
        widthCm,
      },
    },
    provenance: {
      sourceContract: measurement.contract ?? 'front-transverse-width-v0',
      sourceLevel: measurement.provenance?.sourceLevel ?? null,
      targetPolicy: measurement.provenance?.targetPolicy ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Side Horizontal Slice visualization for side profile spans & AP depths.
 */
function resolveSideHorizontalSlice(measurement) {
  const yCm = measurement.provenance?.levelYcm ?? measurement.levelYcm ?? null;
  const rasterRow = measurement.provenance?.sampledPixelRow ?? null;
  const minUcm = measurement.provenance?.minUcm ?? measurement.minUcm ?? null;
  const maxUcm = measurement.provenance?.maxUcm ?? measurement.maxUcm ?? null;
  const depthCm = measurement.valueCm ?? measurement.qualifiedDepthEstimateCm ?? measurement.apDepthCm ?? (minUcm !== null && maxUcm !== null ? Number((maxUcm - minUcm).toFixed(4)) : null);

  const isGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
    && typeof minUcm === 'number' && Number.isFinite(minUcm)
    && typeof maxUcm === 'number' && Number.isFinite(maxUcm)
    && maxUcm >= minUcm;

  const isReady = isGeometryValid && (measurement.status === 'valid' || measurement.status === 'qualified' || measurement.isPhysicallyQualified === true);
  const isInvalid = measurement.status === 'invalid' || measurement.status === 'disqualified' || (minUcm !== null && maxUcm !== null && minUcm > maxUcm);

  const blockers = [];
  if (!isReady) {
    blockers.push(isInvalid ? 'side_slice_evidence_invalid' : 'side_slice_evidence_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id,
    displayName: measurement.name ?? measurement.displayName ?? 'Torso Profile Span / AP Depth',
    visualizationType: VISUALIZATION_TYPES.SIDE_HORIZONTAL_SLICE,
    targetViews: ['side'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      view: 'side',
      yCm,
      side: {
        rasterRow,
        minUcm,
        maxUcm,
        depthCm,
      },
    },
    provenance: {
      sourceContract: measurement.contract ?? 'side-profile-span-v0',
      sourceLevel: measurement.provenance?.sourceLevel ?? measurement.sourceLevel ?? null,
      targetPolicy: measurement.provenance?.targetPolicy ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Cross-View Horizontal Slice visualization for shoulder/hip cross-sections,
 * Hip Landmark modeled perimeter, and Modeled Hip / Seat Circumference estimate.
 */
function resolveCrossViewHorizontalSlice(measurement, context = {}) {
  // A. Modeled Hip / Seat Circumference Estimate (Milestone 4.6D)
  if (
    measurement.contract === 'modeled-hip-seat-circumference-v0'
    || measurement.id === 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane'
  ) {
    const coords = measurement.provenance?.sliceHighlightCoordinates;
    const yCm = coords?.yCm ?? measurement.levelYcm ?? measurement.provenance?.selectedYcm ?? null;
    const frontRow = coords?.frontRasterRow ?? measurement.provenance?.frontRasterRow ?? null;
    const sideRow = coords?.sideRasterRow ?? measurement.provenance?.sideRasterRow ?? null;
    const minXcm = coords?.frontBoundsCm?.minX ?? measurement.provenance?.frontMinXcm ?? null;
    const maxXcm = coords?.frontBoundsCm?.maxX ?? measurement.provenance?.frontMaxXcm ?? null;
    const minUcm = coords?.sideBoundsCm?.minU ?? measurement.provenance?.sideMinUcm ?? null;
    const maxUcm = coords?.sideBoundsCm?.maxU ?? measurement.provenance?.sideMaxUcm ?? null;
    const widthCm = measurement.provenance?.frontTransverseWidthCm ?? (minXcm !== null && maxXcm !== null ? Number((maxXcm - minXcm).toFixed(4)) : null);
    const depthCm = measurement.provenance?.sideQualifiedApDepthCm ?? (minUcm !== null && maxUcm !== null ? Number((maxUcm - minUcm).toFixed(4)) : null);

    const isGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
      && typeof minXcm === 'number' && Number.isFinite(minXcm)
      && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
      && typeof minUcm === 'number' && Number.isFinite(minUcm)
      && typeof maxUcm === 'number' && Number.isFinite(maxUcm);

    const isReady = isGeometryValid && measurement.status === 'modeled';
    const isInvalid = measurement.status === 'invalid';

    const blockers = [];
    if (!isReady) {
      blockers.push(isInvalid ? 'seat_circumference_slice_invalid' : 'seat_circumference_slice_unavailable');
    }

    return {
      contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
      version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
      measurementId: measurement.id,
      displayName: measurement.name ?? 'Modeled Hip Circumference',
      visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
      targetViews: ['front', 'side'],
      recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
      status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
      geometry: {
        yCm,
        front: {
          rasterRow: frontRow,
          minXcm,
          maxXcm,
          widthCm,
        },
        side: {
          rasterRow: sideRow,
          minUcm,
          maxUcm,
          depthCm,
        },
      },
      provenance: {
        sourceContract: measurement.contract,
        sourceLocalizationContract: measurement.provenance?.sourceLocalizationContract ?? null,
        sourceScanContract: measurement.provenance?.sourceScanContract ?? null,
        plateauStartYcm: measurement.provenance?.plateauStartYcm ?? null,
        plateauEndYcm: measurement.provenance?.plateauEndYcm ?? null,
        plateauRowCount: measurement.provenance?.plateauRowCount ?? null,
        hipAnchorYcm: measurement.provenance?.hipAnchorYcm ?? null,
        offsetBelowHipCm: measurement.provenance?.offsetBelowHipCm ?? null,
        firstSplitYcm: measurement.provenance?.firstSplitYcm ?? null,
        clearanceAboveFirstSplitCm: measurement.provenance?.clearanceAboveFirstSplitCm ?? null,
      },
      blockers,
      warnings: measurement.warnings ?? [],
      issues: measurement.issues ?? [],
    };
  }

  // B. Hip Landmark Modeled Perimeter Estimate
  if (
    measurement.contract === 'modeled-cross-section-perimeter-v0'
    || measurement.id === 'torso_modeled_perimeter_at_hip_landmark_level'
  ) {
    const yCm = measurement.levelYcm ?? measurement.provenance?.levelYcm ?? null;

    let linkedCs = context.crossSectionEvidenceReport ?? null;
    if (!linkedCs && typeof context.getCrossSectionEvidence === 'function') {
      linkedCs = context.getCrossSectionEvidence(measurement.sourceLevel ?? 'hip');
    }

    const frontObs = linkedCs?.frontObservation;
    const sideObs = linkedCs?.sideObservation;

    const minXcm = frontObs?.provenance?.leftXcm ?? null;
    const maxXcm = frontObs?.provenance?.rightXcm ?? null;
    const minUcm = sideObs?.provenance?.minUcm ?? sideObs?.minUcm ?? null;
    const maxUcm = sideObs?.provenance?.maxUcm ?? sideObs?.maxUcm ?? null;
    const frontRow = frontObs?.provenance?.sampledPixelRow ?? null;
    const sideRow = sideObs?.provenance?.sampledPixelRow ?? null;
    const widthCm = measurement.provenance?.frontTransverseWidthCm ?? frontObs?.transverseWidthCm ?? null;
    const depthCm = measurement.provenance?.sideApDepthCm ?? sideObs?.apDepthCm ?? null;

    const isGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
      && typeof minXcm === 'number' && Number.isFinite(minXcm)
      && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
      && typeof minUcm === 'number' && Number.isFinite(minUcm)
      && typeof maxUcm === 'number' && Number.isFinite(maxUcm);

    const isReady = isGeometryValid && measurement.status === 'modeled';
    const isInvalid = measurement.status === 'invalid';

    const blockers = [];
    if (!isReady) {
      blockers.push(isInvalid ? 'hip_perimeter_slice_invalid' : 'hip_perimeter_slice_unavailable');
    }

    return {
      contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
      version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
      measurementId: measurement.id,
      displayName: measurement.name ?? 'Torso Modeled Perimeter Estimate at Hip Landmark Level',
      visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
      targetViews: ['front', 'side'],
      recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
      status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
      geometry: {
        yCm,
        front: {
          rasterRow: frontRow,
          minXcm,
          maxXcm,
          widthCm,
        },
        side: {
          rasterRow: sideRow,
          minUcm,
          maxUcm,
          depthCm,
        },
      },
      provenance: {
        sourceContract: measurement.contract,
        sourceCrossSectionId: measurement.provenance?.sourceCrossSectionId ?? linkedCs?.id ?? null,
        sourceLevel: measurement.sourceLevel ?? null,
      },
      blockers,
      warnings: measurement.warnings ?? [],
      issues: measurement.issues ?? [],
    };
  }

  // C. CrossSectionEvidence (Shoulder or Hip level)
  const yCm = measurement.levelYcm ?? null;
  const frontObs = measurement.frontObservation;
  const sideObs = measurement.sideObservation;
  const minXcm = frontObs?.provenance?.leftXcm ?? null;
  const maxXcm = frontObs?.provenance?.rightXcm ?? null;
  const minUcm = sideObs?.provenance?.minUcm ?? sideObs?.minUcm ?? null;
  const maxUcm = sideObs?.provenance?.maxUcm ?? sideObs?.maxUcm ?? null;
  const frontRow = frontObs?.provenance?.sampledPixelRow ?? null;
  const sideRow = sideObs?.provenance?.sampledPixelRow ?? null;
  const widthCm = frontObs?.transverseWidthCm ?? (minXcm !== null && maxXcm !== null ? Number((maxXcm - minXcm).toFixed(4)) : null);
  const depthCm = sideObs?.apDepthCm ?? (minUcm !== null && maxUcm !== null ? Number((maxUcm - minUcm).toFixed(4)) : null);

  const isGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
    && typeof minXcm === 'number' && Number.isFinite(minXcm)
    && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
    && typeof minUcm === 'number' && Number.isFinite(minUcm)
    && typeof maxUcm === 'number' && Number.isFinite(maxUcm);

  const isReady = isGeometryValid && measurement.status === 'qualified';
  const isInvalid = measurement.status === 'invalid';

  const blockers = [];
  if (!isReady) {
    blockers.push(isInvalid ? 'cross_section_slice_invalid' : 'cross_section_slice_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id,
    displayName: measurement.name ?? 'Torso Cross-Section Evidence',
    visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
    targetViews: ['front', 'side'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      yCm,
      front: {
        rasterRow: frontRow,
        minXcm,
        maxXcm,
        widthCm,
      },
      side: {
        rasterRow: sideRow,
        minUcm,
        maxUcm,
        depthCm,
      },
    },
    provenance: {
      sourceContract: measurement.contract ?? 'cross-section-evidence-v0',
      sourceLevel: measurement.sourceLevel ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Landmark Segment visualization for 2-point direct measurements.
 */
function resolveLandmarkSegment(measurement) {
  const epA = measurement.provenance?.endpointA;
  const epB = measurement.provenance?.endpointB;
  const distanceCm = measurement.valueCm ?? measurement.provenance?.rawDistanceCm ?? null;

  const hasA = epA && typeof epA.x === 'number' && Number.isFinite(epA.x) && typeof epA.y === 'number' && Number.isFinite(epA.y);
  const hasB = epB && typeof epB.x === 'number' && Number.isFinite(epB.x) && typeof epB.y === 'number' && Number.isFinite(epB.y);

  const isReady = hasA && hasB && measurement.status === 'valid';
  const isInvalid = measurement.status === 'invalid' || (epA && !hasA) || (epB && !hasB);

  const blockers = [];
  if (!isReady) {
    blockers.push(isInvalid ? 'landmark_endpoints_invalid' : 'landmark_endpoints_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id,
    displayName: measurement.displayName ?? measurement.canonicalName ?? 'Landmark Segment',
    visualizationType: VISUALIZATION_TYPES.LANDMARK_SEGMENT,
    targetViews: ['front'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      view: 'front',
      endpointA: hasA ? { landmarkId: epA.name, xCm: epA.x, yCm: epA.y } : null,
      endpointB: hasB ? { landmarkId: epB.name, xCm: epB.x, yCm: epB.y } : null,
      distanceCm,
    },
    provenance: {
      sourceContract: measurement.contract ?? 'direct-body-measurements-v0',
      geometryType: measurement.geometryType ?? 'linear_projected_distance',
      anatomicalRegion: measurement.anatomicalRegion ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Kinematic Chain visualization for total arm and total leg chains.
 */
function resolveKinematicChain(measurement, context = {}) {
  const segAId = measurement.constituentSegmentIds?.[0] ?? measurement.provenance?.segmentAId ?? measurement.provenance?.segmentA?.id;
  const segBId = measurement.constituentSegmentIds?.[1] ?? measurement.provenance?.segmentBId ?? measurement.provenance?.segmentB?.id;

  let segAResult = measurement.provenance?.segmentA ?? null;
  let segBResult = measurement.provenance?.segmentB ?? null;

  if ((!segAResult?.endpointA && !segAResult?.provenance?.endpointA) && context.directMeasurementsReport) {
    const dmList = context.directMeasurementsReport.measurements ?? [];
    if (segAId) segAResult = dmList.find((m) => m.id === segAId) ?? segAResult;
    if (segBId) segBResult = dmList.find((m) => m.id === segBId) ?? segBResult;
  }

  const epA1 = segAResult?.provenance?.endpointA ?? segAResult?.endpointA ?? null;
  const epA2 = segAResult?.provenance?.endpointB ?? segAResult?.endpointB ?? null;
  const epB1 = segBResult?.provenance?.endpointA ?? segBResult?.endpointA ?? null;
  const epB2 = segBResult?.provenance?.endpointB ?? segBResult?.endpointB ?? null;

  let points = null;
  let isAdjacencyValid = false;

  if (epA1 && epA2 && epB1 && epB2) {
    const hasCoords = Number.isFinite(epA1.x) && Number.isFinite(epA1.y)
      && Number.isFinite(epA2.x) && Number.isFinite(epA2.y)
      && Number.isFinite(epB1.x) && Number.isFinite(epB1.y)
      && Number.isFinite(epB2.x) && Number.isFinite(epB2.y);

    if (hasCoords) {
      // Validate adjacency: segment A's endpointB must connect to segment B's endpointA
      const isMatchingName = epA2.name && epB1.name && epA2.name === epB1.name;
      const isMatchingCoord = Math.abs(epA2.x - epB1.x) < 1e-3 && Math.abs(epA2.y - epB1.y) < 1e-3;

      if (isMatchingName || isMatchingCoord) {
        isAdjacencyValid = true;
        points = [
          { landmarkId: epA1.name, xCm: epA1.x, yCm: epA1.y },
          { landmarkId: epA2.name, xCm: epA2.x, yCm: epA2.y },
          { landmarkId: epB2.name, xCm: epB2.x, yCm: epB2.y },
        ];
      }
    }
  }

  const isReady = isAdjacencyValid && points !== null && measurement.status === 'valid';
  const isInvalid = measurement.status === 'invalid' || (epA1 && epA2 && epB1 && epB2 && !isAdjacencyValid);

  const blockers = [];
  if (!isReady) {
    blockers.push(isInvalid ? 'kinematic_chain_invalid' : 'kinematic_chain_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id,
    displayName: measurement.displayName ?? measurement.canonicalName ?? 'Kinematic Chain',
    visualizationType: VISUALIZATION_TYPES.LANDMARK_CHAIN,
    targetViews: ['front'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      view: 'front',
      points,
      totalLengthCm: measurement.valueCm ?? measurement.provenance?.rawChainSumCm ?? null,
    },
    provenance: {
      sourceContract: measurement.contract ?? 'direct-body-measurements-v0',
      constituentSegmentIds: measurement.constituentSegmentIds ?? [segAId, segBId],
      segmentAId: segAId ?? null,
      segmentBId: segBId ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Vertical Level Interval visualization for 5 vertical measurements.
 */
function resolveVerticalLevelInterval(measurement) {
  const levelA = measurement.provenance?.levelA;
  const levelB = measurement.provenance?.levelB;

  const upperLevel = levelA && levelB ? (levelA.yCm >= levelB.yCm ? levelA : levelB) : null;
  const lowerLevel = levelA && levelB ? (levelA.yCm < levelB.yCm ? levelA : levelB) : null;
  const distanceCm = measurement.valueCm ?? measurement.provenance?.rawDeltaCm ?? null;

  const isGeometryValid = upperLevel && lowerLevel
    && typeof upperLevel.yCm === 'number' && Number.isFinite(upperLevel.yCm)
    && typeof lowerLevel.yCm === 'number' && Number.isFinite(lowerLevel.yCm);

  const isReady = isGeometryValid && measurement.status === 'valid';
  const isInvalid = measurement.status === 'invalid';

  const blockers = [];
  if (!isReady) {
    blockers.push(isInvalid ? 'vertical_interval_invalid' : 'vertical_interval_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id,
    displayName: measurement.displayName ?? measurement.canonicalName ?? 'Vertical Inter-Level Distance',
    visualizationType: VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL,
    targetViews: ['front'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      view: 'front',
      upperLevelId: upperLevel?.id ?? null,
      lowerLevelId: lowerLevel?.id ?? null,
      upperYcm: upperLevel?.yCm ?? null,
      lowerYcm: lowerLevel?.yCm ?? null,
      distanceCm,
    },
    provenance: {
      sourceContract: measurement.contract ?? 'direct-body-measurements-v0',
      requiredLevels: measurement.requiredLevels ?? [],
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Front Horizontal Level visualization for anatomical reference levels.
 */
function resolveFrontHorizontalLevel(level) {
  const yCm = level.yCm ?? null;
  const anchors = Array.isArray(level.provenance?.anchors)
    ? level.provenance.anchors.map((a) => ({
      name: a.name,
      xCm: a.point?.x ?? null,
      yCm: a.point?.y ?? null,
    }))
    : [];

  const isGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm);
  const isReady = isGeometryValid && level.status === 'ready';

  const blockers = [];
  if (!isReady) {
    blockers.push('anatomical_level_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: level.id,
    displayName: level.name ?? level.id,
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_LEVEL,
    targetViews: ['front'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : VISUALIZATION_STATUS.UNAVAILABLE,
    geometry: {
      view: 'front',
      levelId: level.id,
      yCm,
      anchors,
    },
    provenance: {
      sourceContract: level.contract ?? 'anatomical-levels-v0',
      derivationMethod: level.provenance?.derivationMethod ?? null,
    },
    blockers,
    warnings: [],
    issues: [],
  };
}

/**
 * Resolves Natural Waist Plane localization visualization for Front and Side 2D workspaces.
 */
export function resolveNaturalWaistPlane(measurement) {
  const yCm = measurement.yCm ?? measurement.levelYcm ?? measurement.provenance?.sliceHighlightCoordinates?.yCm ?? measurement.provenance?.selectedYcm ?? null;
  const coords = measurement.provenance?.sliceHighlightCoordinates;
  const candidate = measurement.selectedCandidate;

  const frontRow = coords?.frontRasterRow ?? candidate?.rasterRow ?? measurement.rasterRow ?? measurement.provenance?.frontRasterRow ?? null;
  const sideRow = coords?.sideRasterRow ?? candidate?.sideRasterRow ?? measurement.provenance?.sideRasterRow ?? null;

  const minXcm = coords?.frontBoundsCm?.minX ?? candidate?.frontMinXcm ?? measurement.frontEvidence?.minXcm ?? measurement.provenance?.frontMinXcm ?? null;
  const maxXcm = coords?.frontBoundsCm?.maxX ?? candidate?.frontMaxXcm ?? measurement.frontEvidence?.maxXcm ?? measurement.provenance?.frontMaxXcm ?? null;
  const widthCm = candidate?.frontWidthCm ?? measurement.frontEvidence?.widthCm ?? measurement.provenance?.frontTransverseWidthCm ?? (minXcm !== null && maxXcm !== null ? Number((maxXcm - minXcm).toFixed(4)) : null);

  const minUcm = coords?.sideBoundsCm?.minU ?? candidate?.sideMinUcm ?? measurement.sideEvidence?.minUcm ?? measurement.provenance?.sideMinUcm ?? null;
  const maxUcm = coords?.sideBoundsCm?.maxU ?? candidate?.sideMaxUcm ?? measurement.sideEvidence?.maxUcm ?? measurement.provenance?.sideMaxUcm ?? null;
  const depthCm = candidate?.sideQualifiedApDepthCm ?? candidate?.sideRawProfileSpanCm ?? measurement.sideEvidence?.qualifiedApDepthCm ?? measurement.sideEvidence?.profileSpanCm ?? measurement.provenance?.sideQualifiedApDepthCm ?? (minUcm !== null && maxUcm !== null ? Number((maxUcm - minUcm).toFixed(4)) : null);

  const isFrontGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
    && typeof minXcm === 'number' && Number.isFinite(minXcm)
    && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
    && maxXcm >= minXcm;

  const isSideGeometryValid = typeof minUcm === 'number' && Number.isFinite(minUcm)
    && typeof maxUcm === 'number' && Number.isFinite(maxUcm)
    && maxUcm >= minUcm;

  const isReady = isFrontGeometryValid && (measurement.status === 'ready' || measurement.status === 'modeled');
  const isInvalid = measurement.status === 'invalid';

  const blockers = Array.isArray(measurement.blockers) ? [...measurement.blockers] : [];
  if (!isReady && blockers.length === 0) {
    blockers.push(isInvalid ? 'waist_plane_localization_invalid' : 'waist_plane_localization_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id ?? 'natural_waist_plane_localization',
    displayName: measurement.name ?? measurement.displayName ?? 'Natural Waist Plane Localization',
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    targetViews: ['front', 'side'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      yCm,
      front: {
        rasterRow: frontRow,
        minXcm,
        maxXcm,
        widthCm,
      },
      side: isSideGeometryValid ? {
        rasterRow: sideRow,
        minUcm,
        maxUcm,
        depthCm,
      } : null,
    },
    provenance: {
      sourceContract: measurement.contract ?? 'natural-waist-plane-localization-v0',
      selectionMethod: measurement.selectionMethod ?? null,
      smoothingWindowCm: measurement.provenance?.smoothingWindowCm ?? null,
      smoothingRadiusSamples: measurement.provenance?.smoothingRadiusSamples ?? null,
      sampleSpacingCm: measurement.provenance?.sampleSpacingCm ?? null,
      constrictionProminenceCm: candidate?.constrictionProminenceCm ?? measurement.provenance?.constrictionProminenceCm ?? null,
      bilateralContourQa: candidate?.bilateralContourQa ?? measurement.provenance?.bilateralContourQa ?? null,
      sliceHighlightCoordinates: coords ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Abdominal Apex Plane localization visualization for Front and Side 2D workspaces.
 */
export function resolveAbdominalApexPlane(measurement) {
  const yCm = measurement.yCm ?? measurement.levelYcm ?? measurement.provenance?.sliceHighlightCoordinates?.yCm ?? measurement.provenance?.selectedYcm ?? null;
  const coords = measurement.provenance?.sliceHighlightCoordinates;
  const peak = measurement.selectedPeak;

  const frontRow = coords?.frontRasterRow ?? peak?.rasterRow ?? measurement.rasterRow ?? measurement.provenance?.frontRasterRow ?? null;
  const sideRow = coords?.sideRasterRow ?? peak?.sideRasterRow ?? measurement.sideRasterRow ?? measurement.provenance?.sideRasterRow ?? null;

  const minXcm = coords?.frontBoundsCm?.minX ?? peak?.frontMinXcm ?? measurement.frontEvidence?.minXcm ?? measurement.provenance?.frontMinXcm ?? null;
  const maxXcm = coords?.frontBoundsCm?.maxX ?? peak?.frontMaxXcm ?? measurement.frontEvidence?.maxXcm ?? measurement.provenance?.frontMaxXcm ?? null;
  const widthCm = peak?.frontWidthCm ?? measurement.frontEvidence?.widthCm ?? measurement.provenance?.frontTransverseWidthCm ?? (minXcm !== null && maxXcm !== null ? Number((maxXcm - minXcm).toFixed(4)) : null);

  const minUcm = coords?.sideBoundsCm?.minU ?? peak?.sideMinUcm ?? measurement.sideEvidence?.minUcm ?? measurement.provenance?.sideMinUcm ?? null;
  const maxUcm = coords?.sideBoundsCm?.maxU ?? peak?.sideMaxUcm ?? measurement.sideEvidence?.maxUcm ?? measurement.provenance?.sideMaxUcm ?? null;
  const depthCm = peak?.qualifiedApDepthCm ?? peak?.sideProfileSpanCm ?? measurement.sideEvidence?.qualifiedApDepthCm ?? measurement.sideEvidence?.profileSpanCm ?? measurement.provenance?.sideQualifiedApDepthCm ?? (minUcm !== null && maxUcm !== null ? Number((maxUcm - minUcm).toFixed(4)) : null);

  const isFrontGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
    && typeof minXcm === 'number' && Number.isFinite(minXcm)
    && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
    && maxXcm >= minXcm;

  const isSideGeometryValid = typeof minUcm === 'number' && Number.isFinite(minUcm)
    && typeof maxUcm === 'number' && Number.isFinite(maxUcm)
    && maxUcm >= minUcm;

  const isReady = isFrontGeometryValid && isSideGeometryValid && (measurement.status === 'ready' || measurement.status === 'modeled');
  const isInvalid = measurement.status === 'invalid';

  const blockers = Array.isArray(measurement.blockers) ? [...measurement.blockers] : [];
  if (!isReady && blockers.length === 0) {
    blockers.push(isInvalid ? 'abdominal_apex_localization_invalid' : 'abdominal_apex_localization_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id ?? 'abdominal_apex_plane_localization',
    displayName: measurement.name ?? measurement.displayName ?? 'Abdominal Apex Plane Localization',
    visualizationType: VISUALIZATION_TYPES.ABDOMINAL_APEX_PLANE,
    targetViews: ['front', 'side'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      yCm,
      front: {
        rasterRow: frontRow,
        minXcm,
        maxXcm,
        widthCm,
      },
      side: isSideGeometryValid ? {
        rasterRow: sideRow,
        minUcm,
        maxUcm,
        depthCm,
        rawAnteriorUcm: peak?.rawAnteriorUcm ?? measurement.sideEvidence?.rawAnteriorUcm ?? measurement.provenance?.rawAnteriorUcm ?? null,
        prominenceCm: peak?.prominenceCm ?? measurement.sideEvidence?.prominenceCm ?? measurement.provenance?.prominenceCm ?? null,
      } : null,
    },
    provenance: {
      sourceContract: measurement.contract ?? 'abdominal-apex-plane-localization-v0',
      selectionMethod: measurement.selectionMethod ?? measurement.sourcePlane?.selectionMethod ?? null,
      searchWindow: measurement.searchWindow ?? null,
      orientation: measurement.orientation ?? null,
      prominenceCm: peak?.prominenceCm ?? measurement.provenance?.prominenceCm ?? null,
      smoothingWindowCm: measurement.provenance?.smoothingWindowCm ?? null,
      smoothingRadiusSamples: measurement.provenance?.smoothingRadiusSamples ?? null,
      sampleSpacingCm: measurement.provenance?.sampleSpacingCm ?? null,
      sliceHighlightCoordinates: coords ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves Bust Apex Plane localization visualization for Front and Side 2D workspaces.
 */
export function resolveBustApexPlane(measurement) {
  const yCm = measurement.yCm ?? measurement.levelYcm ?? measurement.provenance?.sliceHighlightCoordinates?.yCm ?? measurement.provenance?.selectedYcm ?? null;
  const coords = measurement.provenance?.sliceHighlightCoordinates;
  const peak = measurement.selectedPeak;

  const frontRow = coords?.frontRasterRow ?? peak?.rasterRow ?? measurement.rasterRow ?? measurement.provenance?.frontRasterRow ?? null;
  const sideRow = coords?.sideRasterRow ?? peak?.sideRasterRow ?? measurement.sideRasterRow ?? measurement.provenance?.sideRasterRow ?? null;

  const minXcm = coords?.frontBoundsCm?.minX ?? peak?.frontMinXcm ?? measurement.frontEvidence?.minXcm ?? measurement.provenance?.frontMinXcm ?? null;
  const maxXcm = coords?.frontBoundsCm?.maxX ?? peak?.frontMaxXcm ?? measurement.frontEvidence?.maxXcm ?? measurement.provenance?.frontMaxXcm ?? null;
  const widthCm = peak?.frontWidthCm ?? measurement.frontEvidence?.widthCm ?? measurement.provenance?.frontTransverseWidthCm ?? (minXcm !== null && maxXcm !== null ? Number((maxXcm - minXcm).toFixed(4)) : null);

  const minUcm = coords?.sideBoundsCm?.minU ?? peak?.sideMinUcm ?? measurement.sideEvidence?.minUcm ?? measurement.provenance?.sideMinUcm ?? null;
  const maxUcm = coords?.sideBoundsCm?.maxU ?? peak?.sideMaxUcm ?? measurement.sideEvidence?.maxUcm ?? measurement.provenance?.sideMaxUcm ?? null;
  const depthCm = peak?.qualifiedApDepthCm ?? peak?.sideProfileSpanCm ?? measurement.sideEvidence?.qualifiedApDepthCm ?? measurement.sideEvidence?.profileSpanCm ?? measurement.provenance?.sideQualifiedApDepthCm ?? (minUcm !== null && maxUcm !== null ? Number((maxUcm - minUcm).toFixed(4)) : null);

  const isFrontGeometryValid = typeof yCm === 'number' && Number.isFinite(yCm)
    && typeof minXcm === 'number' && Number.isFinite(minXcm)
    && typeof maxXcm === 'number' && Number.isFinite(maxXcm)
    && maxXcm >= minXcm;

  const isSideGeometryValid = typeof minUcm === 'number' && Number.isFinite(minUcm)
    && typeof maxUcm === 'number' && Number.isFinite(maxUcm)
    && maxUcm >= minUcm;

  const isReady = isFrontGeometryValid && isSideGeometryValid && (measurement.status === 'ready' || measurement.status === 'modeled');
  const isInvalid = measurement.status === 'invalid';

  const blockers = Array.isArray(measurement.blockers) ? [...measurement.blockers] : [];
  if (!isReady && blockers.length === 0) {
    blockers.push(isInvalid ? 'bust_apex_localization_invalid' : 'bust_apex_localization_unavailable');
  }

  return {
    contract: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT,
    version: MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
    measurementId: measurement.id ?? 'bust_apex_plane_localization',
    displayName: measurement.name ?? measurement.displayName ?? 'Bust Apex Plane Localization',
    visualizationType: VISUALIZATION_TYPES.BUST_APEX_PLANE,
    targetViews: ['front', 'side'],
    recommendedWorkspaceMode: 'WORKSPACE_SPLIT',
    status: isReady ? VISUALIZATION_STATUS.READY : (isInvalid ? VISUALIZATION_STATUS.INVALID : VISUALIZATION_STATUS.UNAVAILABLE),
    geometry: {
      yCm,
      front: {
        rasterRow: frontRow,
        minXcm,
        maxXcm,
        widthCm,
      },
      side: isSideGeometryValid ? {
        rasterRow: sideRow,
        minUcm,
        maxUcm,
        depthCm,
        rawAnteriorUcm: peak?.rawAnteriorUcm ?? measurement.sideEvidence?.rawAnteriorUcm ?? measurement.provenance?.rawAnteriorUcm ?? null,
        prominenceCm: peak?.prominenceCm ?? measurement.sideEvidence?.prominenceCm ?? measurement.provenance?.prominenceCm ?? null,
      } : null,
    },
    provenance: {
      sourceContract: measurement.contract ?? 'bust-apex-plane-localization-v0',
      selectionMethod: measurement.selectionMethod ?? measurement.sourcePlane?.selectionMethod ?? null,
      searchWindow: measurement.searchWindow ?? null,
      orientation: measurement.orientation ?? null,
      prominenceCm: peak?.prominenceCm ?? measurement.provenance?.prominenceCm ?? null,
      smoothingWindowCm: measurement.provenance?.smoothingWindowCm ?? null,
      smoothingRadiusSamples: measurement.provenance?.smoothingRadiusSamples ?? null,
      sampleSpacingCm: measurement.provenance?.sampleSpacingCm ?? null,
      sliceHighlightCoordinates: coords ?? null,
    },
    blockers,
    warnings: measurement.warnings ?? [],
    issues: measurement.issues ?? [],
  };
}

/**
 * Resolves declarative 2D visualization provenance for any measurement result object.
 *
 * @param {object|null|undefined} measurement - Measurement result object from any contract
 * @param {object} [context] - Context containing linked reports if needed
 * @returns {object} MeasurementVisualizationProvenanceResultV0
 */
export function resolveMeasurementVisualizationProvenance(measurement, context = {}) {
  if (!measurement || typeof measurement !== 'object') {
    return buildEmptyVisualizationResult('unknown', {
      status: VISUALIZATION_STATUS.UNAVAILABLE,
      blockers: ['measurement_payload_missing'],
      issues: ['Measurement input is null or non-object.'],
    });
  }

  const contract = measurement.contract;
  const geometryType = measurement.geometryType;
  const id = measurement.id;

  // 1. Natural Waist Plane Localization & Modeled Natural Waist Circumference
  if (
    contract === 'natural-waist-plane-localization-v0'
    || contract === 'modeled-natural-waist-circumference-v0'
    || id === 'natural_waist_plane_localization'
    || id === 'torso_natural_waist_plane_localization'
    || id === 'torso_modeled_natural_waist_circumference_at_natural_waist_plane'
  ) {
    return resolveNaturalWaistPlane(measurement);
  }

  // 1b. Abdominal Apex Plane Localization & Modeled Abdominal Circumference
  if (
    contract === 'abdominal-apex-plane-localization-v0'
    || contract === 'modeled-abdominal-circumference-v0'
    || id === 'abdominal_apex_plane_localization'
    || id === 'torso_abdominal_apex_plane_localization'
    || id === 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane'
  ) {
    return resolveAbdominalApexPlane(measurement);
  }

  // 1c. Bust Apex Plane Localization & Modeled Bust Circumference
  if (
    contract === 'bust-apex-plane-localization-v0'
    || contract === 'modeled-bust-circumference-v0'
    || id === 'bust_apex_plane_localization'
    || id === 'torso_bust_apex_plane_localization'
    || id === 'torso_modeled_bust_circumference_at_bust_apex_plane'
  ) {
    return resolveBustApexPlane(measurement);
  }

  // 2. Front Transverse Width
  if (contract === 'front-transverse-width-v0' || measurement.type === 'transverse_width') {
    return resolveFrontHorizontalSlice(measurement);
  }

  // 3. Side Profile Span / AP Depth
  if (
    contract === 'side-profile-span-v0'
    || contract === 'side-physical-depth-qualification-v0'
    || measurement.type === 'profile_span'
    || measurement.type === 'physical_ap_depth'
    || measurement.type === 'physical_ap_depth_estimate'
    || (typeof id === 'string' && (id.includes('profile_span') || id.includes('ap_depth')))
  ) {
    return resolveSideHorizontalSlice(measurement);
  }

  // 4. Cross-View Slice (CrossSectionEvidence, ModeledCrossSectionPerimeter, ModeledHipSeatCircumference)
  if (
    contract === 'cross-section-evidence-v0'
    || contract === 'modeled-cross-section-perimeter-v0'
    || contract === 'modeled-hip-seat-circumference-v0'
    || id === 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane'
    || id?.includes('cross_section_evidence')
    || id?.includes('modeled_perimeter')
  ) {
    return resolveCrossViewHorizontalSlice(measurement, context);
  }

  // 5. Batch A Direct Body Measurements
  if (geometryType === 'vertical_inter_level_delta' || measurement.group === 'vertical_inter_level') {
    return resolveVerticalLevelInterval(measurement);
  }

  if (geometryType === 'segment_chain_length' || (Array.isArray(measurement.constituentSegmentIds) && measurement.constituentSegmentIds.length > 0)) {
    return resolveKinematicChain(measurement, context);
  }

  if (geometryType === 'linear_projected_distance' || (Array.isArray(measurement.requiredLandmarks) && measurement.requiredLandmarks.length === 2)) {
    return resolveLandmarkSegment(measurement);
  }

  // 6. Anatomical Reference Levels
  if (contract === 'anatomical-levels-v0' || measurement.derivationMethod || KNOWN_ANATOMICAL_LEVEL_IDS.has(id)) {
    return resolveFrontHorizontalLevel(measurement);
  }

  return buildEmptyVisualizationResult(id ?? 'unknown', {
    displayName: measurement.displayName ?? measurement.canonicalName ?? measurement.name ?? 'Unsupported Measurement',
    status: VISUALIZATION_STATUS.UNAVAILABLE,
    blockers: ['unsupported_measurement_visualization_type'],
    issues: [`No visualization adapter registered for measurement ID '${id ?? 'unknown'}'.`],
  });
}

/**
 * Authoritative Physical Evidence Semantics Contract v0
 *
 * Pure deterministic domain contract classifying dense pointmap evidence as
 * camera-frame geometric evidence versus authoritative physical geometry.
 *
 * Contract: 'authoritative-physical-evidence-semantics-v0'
 *
 * STRICT SEMANTIC SEPARATION:
 * - Implemented dense-geometry evaluator may classify Sapiens camera-local frames.
 * - Implemented authoritative physical-geometry evaluators are empty in v0.
 * - Status 'validated' and authorized: true require a registered physical-geometry evaluator.
 *
 * STRICT GUARDRAILS:
 * - Does NOT classify arbitrary 3-channel pointmaps as Sapiens camera-frame geometry.
 * - Does NOT treat declaredUnits "meters" as verified physical units.
 * - Does NOT treat declaredScale as REVacity px/cm, body-height scale, or cross-view calibration.
 * - Does NOT convert Side U to canonical Z, promote pointmap Z, or fuse Front/Side geometry.
 * - Does NOT create measurements, circumferences, cross-sections, or volumes.
 * - Does NOT rescans dense tensors; consumes existing Dense Evidence QA only.
 * - Pointmap sample presence does not imply body-surface authorization.
 */

export const AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT = 'authoritative-physical-evidence-semantics-v0';
export const AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION = 'authoritative-physical-evidence-semantics-v0';

export const SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID = 'sapiens-pointmap-camera-frame-evaluator-v0';

/**
 * Deterministic status taxonomy for Authoritative Physical Evidence Semantics.
 * @readonly
 * @enum {string}
 */
export const AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS = Object.freeze({
  VALIDATED: 'validated',
  PARTIAL: 'partial',
  UNVALIDATED: 'unvalidated',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

/**
 * Availability taxonomy for dense physical-evidence payloads.
 * @readonly
 * @enum {string}
 */
export const AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY = Object.freeze({
  MISSING: 'missing',
  PRESENT: 'present',
});

/**
 * Evidence class taxonomy.
 * @readonly
 * @enum {string}
 */
export const AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS = Object.freeze({
  NONE: 'none',
  CAMERA_FRAME_GEOMETRIC: 'camera_frame_geometric',
  AUTHORITATIVE_PHYSICAL: 'authoritative_physical',
});

/**
 * Physical authority status taxonomy.
 * @readonly
 * @enum {string}
 */
export const PHYSICAL_AUTHORITY_STATUS = Object.freeze({
  UNAVAILABLE: 'unavailable',
  NOT_AUTHORITATIVE: 'not_authoritative',
  AUTHORITATIVE: 'authoritative',
});

/**
 * Implemented dense-geometry semantics evaluators (v0).
 * Authorizes camera-frame geometric classification ONLY.
 */
export const IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS = Object.freeze([
  SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID,
]);

/**
 * Implemented authoritative physical-geometry evaluators (v0).
 * Production v0 contains NO implemented physical-geometry evaluators.
 */
export const IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS = Object.freeze([]);

/**
 * Reserved future physical-geometry evaluator identifiers.
 * `validated-dense-geometry-v0` remains reserved and is not enabled.
 */
export const RESERVED_FUTURE_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS = Object.freeze([
  'validated-dense-geometry-v0',
  'controlled-capture-physical-geometry-v0',
  'calibrated-camera-physical-geometry-v0',
  'empirical-body-capture-physical-geometry-v0',
]);

/**
 * Audited Body Pipeline Sapiens2 pointmap model identities.
 * `1b` is the service-reported Sapiens2 1B checkpoint id on the audited runtime path.
 * Generic 3-channel pointmaps outside this set stay unvalidated.
 */
const RECOGNIZED_SAPIENS_POINTMAP_MODEL_IDS = Object.freeze([
  '1b',
  'sapiens',
  'sapiens2',
  'sapiens-1b',
  'sapiens_1b',
  'sapiens2-1b',
  'sapiens2_1b',
]);

const PHYSICAL_AUTHORITY_BLOCKERS_PRESENT = Object.freeze([
  'physical_units_not_verified',
  'view_local_camera_frame',
  'cross_view_transform_unavailable',
  'camera_intrinsics_unavailable',
  'camera_extrinsics_unavailable',
]);

/**
 * Returns true only when a 4.5G result is fully authoritative physical geometry.
 * Forged validated/authorized objects are rejected unless the evaluator is registered.
 *
 * @param {object|null|undefined} evidence
 * @returns {boolean}
 */
export function isValidatedAuthoritativePhysicalGeometryEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return false;
  }
  if (evidence.contract !== AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT) {
    return false;
  }
  if (evidence.status !== AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.VALIDATED) {
    return false;
  }
  if (evidence.authorized !== true) {
    return false;
  }
  if (evidence.physicalAuthority?.status !== PHYSICAL_AUTHORITY_STATUS.AUTHORITATIVE) {
    return false;
  }
  const evaluatorId = typeof evidence.evaluatorId === 'string' ? evidence.evaluatorId.trim() : '';
  return Boolean(
    evaluatorId
    && IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS.includes(evaluatorId),
  );
}

/**
 * True when the pointmap source/model is the audited Sapiens runtime path.
 *
 * @param {object|null|undefined} pointmap
 * @returns {boolean}
 */
export function isRecognizedSapiensPointmapSource(pointmap) {
  if (!pointmap || typeof pointmap !== 'object' || pointmap.present !== true) {
    return false;
  }
  if (pointmap.evaluatorId === SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID) {
    return IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS.includes(
      SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID,
    );
  }
  const model = typeof pointmap.model === 'string' ? pointmap.model.trim().toLowerCase() : '';
  if (!model) {
    return false;
  }
  if (model.includes('sapiens')) {
    return true;
  }
  return RECOGNIZED_SAPIENS_POINTMAP_MODEL_IDS.includes(model);
}

function createCheckResult(id, name, category, status, message, provenance = AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT) {
  return {
    id,
    name,
    category,
    status,
    message,
    provenance,
  };
}

function isPointmapPresent(pointmap) {
  return Boolean(pointmap && typeof pointmap === 'object' && pointmap.present === true);
}

function resolveDenseQaRefs(denseQa) {
  if (!denseQa || typeof denseQa !== 'object') {
    return { pointmapQa: null, crossModal: null };
  }
  const pointmapQa = denseQa.pointmap && typeof denseQa.pointmap === 'object'
    ? denseQa.pointmap
    : (denseQa.pointmapQa && typeof denseQa.pointmapQa === 'object' ? denseQa.pointmapQa : null);
  const crossModal = denseQa.crossModal && typeof denseQa.crossModal === 'object'
    ? denseQa.crossModal
    : (denseQa.crossModalQa && typeof denseQa.crossModalQa === 'object' ? denseQa.crossModalQa : null);
  return { pointmapQa, crossModal };
}

function isDenseQaUnacceptable(pointmap, denseQa) {
  const { pointmapQa, crossModal } = resolveDenseQaRefs(denseQa);

  if (pointmapQa) {
    if (pointmapQa.status === 'fail') {
      return true;
    }
    if (pointmapQa.availability === 'present' && pointmapQa.structure?.isInspectable === false) {
      return true;
    }
  }

  if (crossModal) {
    if (crossModal.status === 'fail') {
      return true;
    }
    if (crossModal.pixelAddressing?.pointmapLayoutInspectable === false) {
      return true;
    }
  }

  if (!pointmapQa && pointmap?.qa?.status === 'fail') {
    return true;
  }

  return false;
}

function resolveProjectedMetricAvailable(projectedMetricResult) {
  if (!projectedMetricResult) {
    return false;
  }
  const list = Array.isArray(projectedMetricResult) ? projectedMetricResult : [projectedMetricResult];
  return list.some((item) => item && item.metricProjectedEligibility === true);
}

function resolveClothingBodySurfaceAuthorized(clothingBodySurfaceResult) {
  if (!clothingBodySurfaceResult || typeof clothingBodySurfaceResult !== 'object') {
    return false;
  }
  return clothingBodySurfaceResult.dimensions?.bodySurfaceAuthorized === true
    || clothingBodySurfaceResult.bodySurfaceAuthorization?.authorized === true;
}

function collectPresentBlockers({ recognizedSapiens }) {
  return PHYSICAL_AUTHORITY_BLOCKERS_PRESENT.filter((code) => (
    code !== 'view_local_camera_frame' || recognizedSapiens
  ));
}

function summarizeChecks(checks) {
  const checkList = Object.values(checks);
  return {
    totalChecks: checkList.length,
    passedChecks: checkList.filter((c) => c.status === 'pass').length,
    failedChecks: checkList.filter((c) => c.status === 'fail').length,
    warnedChecks: checkList.filter((c) => c.status === 'warning').length,
    skippedChecks: checkList.filter((c) => c.status === 'skip').length,
  };
}

function buildResult({
  view,
  availability,
  status,
  authorized,
  evidenceClass,
  evaluatorId,
  frame,
  axes,
  scale,
  units,
  physicalAuthority,
  denseQaRef,
  bodySurfaceAuthorization,
  projectedMetricRef,
  checks,
  issues,
  warnings,
}) {
  return Object.freeze({
    contract: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
    version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
    view,
    availability,
    status,
    authorized,
    evidenceClass,
    evaluatorId,
    frame: Object.freeze({ ...frame }),
    axes: Object.freeze({ ...axes }),
    scale: Object.freeze({ ...scale }),
    units: Object.freeze({ ...units }),
    canonicalCompatibility: Object.freeze({
      revacityXYZ: false,
      revacityZ: false,
      sideUToCanonicalZ: false,
      frontSideFusion: false,
    }),
    physicalAuthority: Object.freeze({
      status: physicalAuthority.status,
      blockers: Object.freeze([...(physicalAuthority.blockers ?? [])]),
    }),
    denseQaRef: Object.freeze({ ...denseQaRef }),
    bodySurfaceAuthorization: Object.freeze({ ...bodySurfaceAuthorization }),
    projectedMetricRef: Object.freeze({ ...projectedMetricRef }),
    checks: Object.freeze({ ...checks }),
    summary: Object.freeze(summarizeChecks(checks)),
    issues: Object.freeze([...issues]),
    warnings: Object.freeze([...warnings]),
  });
}

function normalizeInput(input, options = {}) {
  if (input && typeof input === 'object' && (input.pointmap !== undefined || input.denseQa !== undefined || input.view !== undefined)) {
    return {
      view: options.view ?? input.view ?? input.pointmap?.view ?? null,
      pointmap: input.pointmap ?? null,
      denseQa: input.denseQa ?? options.denseQa ?? null,
      clothingBodySurfaceResult: input.clothingBodySurfaceResult ?? options.clothingBodySurfaceResult ?? null,
      projectedMetricResult: input.projectedMetricResult ?? options.projectedMetricResult ?? null,
    };
  }
  return {
    view: options.view ?? input?.view ?? null,
    pointmap: input ?? null,
    denseQa: options.denseQa ?? null,
    clothingBodySurfaceResult: options.clothingBodySurfaceResult ?? null,
    projectedMetricResult: options.projectedMetricResult ?? null,
  };
}

/**
 * Pure deterministic evaluation of authoritative physical evidence semantics
 * for a single Front or Side view.
 *
 * @param {object|null|undefined} input - Pointmap, view package, or `{ pointmap, denseQa, ... }`
 * @param {{
 *   view?: 'front'|'side'|string,
 *   denseQa?: object|null,
 *   clothingBodySurfaceResult?: object|null,
 *   projectedMetricResult?: object|Array|null,
 * }} [options]
 * @returns {object}
 */
export function evaluateAuthoritativePhysicalEvidenceSemantics(input, options = {}) {
  const issues = [];
  const warnings = [];
  const checks = {};

  const {
    view: rawView,
    pointmap,
    denseQa,
    clothingBodySurfaceResult,
    projectedMetricResult,
  } = normalizeInput(input, options);

  const view = typeof rawView === 'string' && rawView.trim()
    ? rawView.trim().toLowerCase()
    : (typeof pointmap?.view === 'string' ? pointmap.view.trim().toLowerCase() : 'front');

  const { pointmapQa, crossModal } = resolveDenseQaRefs(denseQa);
  const denseQaRef = {
    pointmapStatus: pointmapQa?.status ?? null,
    pointmapAvailability: pointmapQa?.availability
      ?? (isPointmapPresent(pointmap) ? 'present' : (pointmap ? 'missing' : null)),
    crossModalStatus: crossModal?.status ?? null,
    pixelIndexAddressable: typeof crossModal?.pixelAddressing?.pixelIndexAddressable === 'boolean'
      ? crossModal.pixelAddressing.pixelIndexAddressable
      : null,
  };

  const projectedMetricRef = {
    available: resolveProjectedMetricAvailable(projectedMetricResult),
    contract: 'physical-measurement-semantics-v0',
  };

  const bodySurfaceAuthorization = {
    serializedPointmapBodyMasked: false,
    valueExistsImpliesAuthorized: false,
    clothingBodySurfaceAuthorized: resolveClothingBodySurfaceAuthorized(clothingBodySurfaceResult),
  };

  const emptyScale = {
    available: false,
    declaredScale: null,
    semantics: null,
    physicalScaleAuthority: false,
    isRevacityMetricScale: false,
    isBodyHeightScale: false,
    isCrossViewCalibration: false,
  };
  const emptyUnits = {
    reported: null,
    source: null,
    unitAuthority: 'none',
    physicalUnitsVerified: false,
  };
  const emptyFrame = {
    type: null,
    sharedAcrossViews: false,
    source: null,
  };
  const emptyAxes = {
    x: null,
    y: null,
    z: null,
    source: null,
  };

  if (!isPointmapPresent(pointmap)) {
    checks.source_integrity = createCheckResult(
      'source_integrity',
      'Pointmap Presence',
      'integrity',
      'fail',
      `Pointmap evidence is missing for view '${view}'.`,
    );
    issues.push(`Pointmap evidence is missing for view '${view}'.`);

    return buildResult({
      view,
      availability: AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY.MISSING,
      status: AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.UNAVAILABLE,
      authorized: false,
      evidenceClass: AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.NONE,
      evaluatorId: null,
      frame: emptyFrame,
      axes: emptyAxes,
      scale: emptyScale,
      units: emptyUnits,
      physicalAuthority: {
        status: PHYSICAL_AUTHORITY_STATUS.UNAVAILABLE,
        blockers: [],
      },
      denseQaRef,
      bodySurfaceAuthorization,
      projectedMetricRef,
      checks,
      issues,
      warnings,
    });
  }

  checks.source_integrity = createCheckResult(
    'source_integrity',
    'Pointmap Presence',
    'integrity',
    'pass',
    `Pointmap evidence is present for view '${view}'.`,
  );

  const recognizedSapiens = isRecognizedSapiensPointmapSource(pointmap)
    && IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS.includes(SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID);
  const denseQaFailed = isDenseQaUnacceptable(pointmap, denseQa);

  const declaredUnits = typeof pointmap.declaredUnits === 'string' && pointmap.declaredUnits.trim()
    ? pointmap.declaredUnits.trim()
    : null;
  const declaredScale = typeof pointmap.declaredScale === 'number' && Number.isFinite(pointmap.declaredScale)
    ? pointmap.declaredScale
    : null;

  const units = {
    reported: declaredUnits,
    source: recognizedSapiens && declaredUnits ? 'sapiens_api' : (declaredUnits ? 'package_declared' : null),
    unitAuthority: declaredUnits ? 'service_reported' : 'none',
    physicalUnitsVerified: false,
  };

  const scale = {
    available: declaredScale !== null,
    declaredScale,
    semantics: recognizedSapiens ? 'predicted_focal_normalization' : 'unvalidated',
    physicalScaleAuthority: false,
    isRevacityMetricScale: false,
    isBodyHeightScale: false,
    isCrossViewCalibration: false,
  };

  const frame = recognizedSapiens
    ? {
      type: 'camera_local',
      sharedAcrossViews: false,
      source: 'sapiens_runtime_audit',
    }
    : {
      type: 'unknown',
      sharedAcrossViews: false,
      source: null,
    };

  const axes = recognizedSapiens
    ? {
      x: 'image_right',
      y: 'image_down',
      z: 'model_depth_channel',
      source: 'sapiens_runtime_audit',
    }
    : {
      x: 'unvalidated',
      y: 'unvalidated',
      z: 'unvalidated',
      source: null,
    };

  if (recognizedSapiens) {
    checks.sapiens_source_recognition = createCheckResult(
      'sapiens_source_recognition',
      'Recognized Sapiens Pointmap Source',
      'provenance',
      'pass',
      `Pointmap model '${pointmap.model}' is recognized as the audited Sapiens runtime path.`,
      SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID,
    );
  } else {
    checks.sapiens_source_recognition = createCheckResult(
      'sapiens_source_recognition',
      'Recognized Sapiens Pointmap Source',
      'provenance',
      'skip',
      `Pointmap model '${pointmap.model ?? 'unknown'}' is not recognized as the audited Sapiens runtime path; camera-frame semantics remain unvalidated.`,
    );
  }

  if (denseQaFailed) {
    checks.dense_qa = createCheckResult(
      'dense_qa',
      'Dense Evidence QA',
      'dense_qa',
      'fail',
      'Dense Evidence QA failed or the pointmap tensor is uninspectable.',
    );
    issues.push('Dense Evidence QA failed or the pointmap tensor is uninspectable.');
  } else if (pointmapQa || crossModal) {
    checks.dense_qa = createCheckResult(
      'dense_qa',
      'Dense Evidence QA',
      'dense_qa',
      'pass',
      'Existing Dense Evidence QA is structurally acceptable.',
    );
  } else {
    checks.dense_qa = createCheckResult(
      'dense_qa',
      'Dense Evidence QA',
      'dense_qa',
      'skip',
      'Derived Dense Evidence QA was not supplied; package structural presence is used.',
    );
  }

  checks.physical_units_authority = createCheckResult(
    'physical_units_authority',
    'Physical Units Authority',
    'units',
    'skip',
    declaredUnits
      ? `Declared units '${declaredUnits}' remain service-reported and unverified.`
      : 'No declared units are present; physical units are unverified.',
  );

  checks.physical_scale_authority = createCheckResult(
    'physical_scale_authority',
    'Physical Scale Authority',
    'scale',
    'skip',
    recognizedSapiens
      ? 'Sapiens declaredScale is predicted focal-normalization provenance only.'
      : 'Pointmap scale semantics remain unvalidated and have no physical authority.',
  );

  checks.body_surface_authorization = createCheckResult(
    'body_surface_authorization',
    'Body-Surface Authorization',
    'body_surface',
    'skip',
    'Serialized pointmap is full-frame and not body-masked; sample presence does not authorize body surface.',
  );

  checks.physical_geometry_authorization = createCheckResult(
    'physical_geometry_authorization',
    'Authoritative Physical Geometry',
    'physical_authority',
    'skip',
    'No implemented authoritative physical-geometry evaluator is registered in v0.',
  );

  const blockers = collectPresentBlockers({ recognizedSapiens });

  let status;
  let evidenceClass;
  let evaluatorId = null;

  if (denseQaFailed) {
    status = AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.INVALID;
    evidenceClass = recognizedSapiens
      ? AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.CAMERA_FRAME_GEOMETRIC
      : AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.NONE;
    evaluatorId = recognizedSapiens ? SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID : null;
  } else if (recognizedSapiens) {
    status = AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.PARTIAL;
    evidenceClass = AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.CAMERA_FRAME_GEOMETRIC;
    evaluatorId = SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID;
  } else {
    status = AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.UNVALIDATED;
    evidenceClass = AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.NONE;
    evaluatorId = null;
  }

  return buildResult({
    view,
    availability: AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY.PRESENT,
    status,
    authorized: false,
    evidenceClass,
    evaluatorId,
    frame,
    axes,
    scale,
    units,
    physicalAuthority: {
      status: PHYSICAL_AUTHORITY_STATUS.NOT_AUTHORITATIVE,
      blockers,
    },
    denseQaRef,
    bodySurfaceAuthorization,
    projectedMetricRef,
    checks,
    issues,
    warnings,
  });
}

/**
 * Evaluates Front and Side authoritative physical evidence semantics.
 *
 * @param {object|null|undefined} sources - Body package or `{ front, side }` evidence bags
 * @param {{
 *   denseQa?: { front?: object|null, side?: object|null },
 *   clothingBodySurfaceResults?: { front?: object|null, side?: object|null },
 *   projectedMetricResults?: { front?: object|null, side?: object|null },
 * }} [options]
 * @returns {object}
 */
export function evaluateAuthoritativePhysicalEvidenceSemanticsReport(sources = {}, options = {}) {
  const frontBag = sources?.front && typeof sources.front === 'object' ? sources.front : {};
  const sideBag = sources?.side && typeof sources.side === 'object' ? sources.side : {};

  const front = evaluateAuthoritativePhysicalEvidenceSemantics({
    view: 'front',
    pointmap: frontBag.pointmap ?? null,
    denseQa: frontBag.denseQa ?? options.denseQa?.front ?? null,
    clothingBodySurfaceResult: frontBag.clothingBodySurfaceResult ?? options.clothingBodySurfaceResults?.front ?? null,
    projectedMetricResult: frontBag.projectedMetricResult ?? options.projectedMetricResults?.front ?? null,
  });

  const side = evaluateAuthoritativePhysicalEvidenceSemantics({
    view: 'side',
    pointmap: sideBag.pointmap ?? null,
    denseQa: sideBag.denseQa ?? options.denseQa?.side ?? null,
    clothingBodySurfaceResult: sideBag.clothingBodySurfaceResult ?? options.clothingBodySurfaceResults?.side ?? null,
    projectedMetricResult: sideBag.projectedMetricResult ?? options.projectedMetricResults?.side ?? null,
  });

  const viewResults = [front, side];
  let validatedCount = 0;
  let partialCount = 0;
  let unvalidatedCount = 0;
  let invalidCount = 0;
  let unavailableCount = 0;

  for (const res of viewResults) {
    if (res.status === AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.VALIDATED) validatedCount += 1;
    else if (res.status === AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.PARTIAL) partialCount += 1;
    else if (res.status === AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.INVALID) invalidCount += 1;
    else if (res.status === AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.UNVALIDATED) unvalidatedCount += 1;
    else unavailableCount += 1;
  }

  return Object.freeze({
    contract: 'authoritative-physical-evidence-semantics-report-v0',
    version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
    sharedAcrossViews: false,
    allAuthorized: false,
    summary: Object.freeze({
      totalViews: viewResults.length,
      validatedCount,
      partialCount,
      unvalidatedCount,
      invalidCount,
      unavailableCount,
    }),
    views: Object.freeze({ front, side }),
  });
}

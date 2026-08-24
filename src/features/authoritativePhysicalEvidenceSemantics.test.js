import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import * as authoritativePhysicalEvidenceSemantics from './authoritativePhysicalEvidenceSemantics.js';
import {
  AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
  AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
  AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS,
  AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY,
  AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS,
  PHYSICAL_AUTHORITY_STATUS,
  IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS,
  IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS,
  SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID,
  evaluateAuthoritativePhysicalEvidenceSemantics,
  evaluateAuthoritativePhysicalEvidenceSemanticsReport,
  isValidatedAuthoritativePhysicalGeometryEvidence,
} from './authoritativePhysicalEvidenceSemantics.js';

import {
  FRONT_TRANSVERSE_WIDTH_CONTRACT,
} from './frontTransverseWidth.js';
import {
  SIDE_PROFILE_SPAN_CONTRACT,
} from './sideProfileSpan.js';
import {
  evaluatePhysicalMeasurementEligibility,
  ELIGIBILITY_BLOCKER_CODES,
} from './physicalMeasurementEligibility.js';
import {
  evaluatePhysicalMeasurementSemantics,
} from './physicalMeasurementSemantics.js';
import { importBodyEvidenceZip } from './bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getAuthoritativePhysicalEvidenceSemantics,
  getAuthoritativePhysicalEvidenceSemanticsReport,
  getPhysicalMeasurementEligibility,
  getPhysicalMeasurementEligibilityReport,
  getFrontTransverseWidth,
  getSideProfileSpan,
} from './bodyEvidence.js';

const FORBIDDEN_API_TOKENS = [
  'circumference',
  'ellipse',
  'crossSection',
  'cross_section',
  'bodyVolume',
  'body_volume',
  'reconstruct3d',
  'reconstruction',
];

function createRecognizedSapiensPointmap({
  view = 'front',
  model = '1b',
  declaredUnits = 'meters',
  declaredScale = 0.4745759963989258,
  qaStatus = 'pass',
} = {}) {
  return {
    present: true,
    model,
    view,
    channels: 3,
    shape: [4, 4, 3],
    declaredShape: [4, 4, 3],
    denseLayout: 'HWC_INTERLEAVED',
    widthPx: 4,
    heightPx: 4,
    dtype: 'float32',
    declaredUnits,
    declaredScale,
    coordinateFrame: 'unvalidated',
    scaleSemantics: 'unvalidated',
    canonicalAxisMeaning: 'unvalidated',
    qa: {
      status: qaStatus,
      numericValues: { status: 'unvalidated', validationMode: 'deferred' },
    },
  };
}

function createUnrecognizedPointmap({
  view = 'front',
  model = 'dense-pointmap-v1',
  declaredUnits = 'meters',
  declaredScale = 0.001,
  qaStatus = 'pass',
} = {}) {
  return {
    present: true,
    model,
    view,
    channels: 3,
    shape: [4, 4, 3],
    denseLayout: 'HWC_INTERLEAVED',
    widthPx: 4,
    heightPx: 4,
    dtype: 'float32',
    declaredUnits,
    declaredScale,
    coordinateFrame: 'unvalidated',
    scaleSemantics: 'unvalidated',
    canonicalAxisMeaning: 'unvalidated',
    qa: { status: qaStatus },
  };
}

function createPassingDenseQa({ view = 'front' } = {}) {
  return {
    pointmap: {
      contract: 'pointmap-numeric-qa-v0',
      view,
      availability: 'present',
      status: 'pass',
      structure: { present: true, isInspectable: true },
    },
    crossModal: {
      contract: 'same-view-dense-cross-modal-qa-v0',
      view,
      status: 'pass',
      availability: { pointmap: true },
      pixelAddressing: {
        pointmapLayoutInspectable: true,
        pixelIndexAddressable: true,
      },
    },
  };
}

function createFailingDenseQa({ view = 'front', uninspectable = false } = {}) {
  return {
    pointmap: {
      contract: 'pointmap-numeric-qa-v0',
      view,
      availability: 'present',
      status: 'fail',
      structure: { present: true, isInspectable: !uninspectable },
      issues: ['Synthetic dense QA failure'],
    },
    crossModal: {
      contract: 'same-view-dense-cross-modal-qa-v0',
      view,
      status: uninspectable ? 'fail' : 'fail',
      availability: { pointmap: true },
      pixelAddressing: {
        pointmapLayoutInspectable: !uninspectable,
        pixelIndexAddressable: !uninspectable,
      },
    },
  };
}

function createMetricObservation({
  view = 'front',
  id = 'torso_transverse_width_at_shoulder_level',
  contract = FRONT_TRANSVERSE_WIDTH_CONTRACT,
  valueCm = 30.8,
} = {}) {
  return {
    contract,
    id,
    view,
    sourceLevel: id.includes('hip') ? 'hip' : 'shoulder',
    status: 'valid',
    valueCm,
    startPx: 100,
    endPx: 408,
    provenance: {
      sourceLevel: id.includes('hip') ? 'hip' : 'shoulder',
      runCount: 1,
      usedClothingEvidence: false,
      clothingClassIdsUsed: [],
    },
  };
}

function assertSapiensCameraFrameSemantics(result, view) {
  assert.equal(result.contract, AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT);
  assert.equal(result.version, AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION);
  assert.equal(result.view, view);
  assert.equal(result.availability, AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY.PRESENT);
  assert.equal(result.status, AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.PARTIAL);
  assert.equal(result.authorized, false);
  assert.equal(result.evidenceClass, AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.CAMERA_FRAME_GEOMETRIC);
  assert.equal(result.evaluatorId, SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID);

  assert.equal(result.frame.type, 'camera_local');
  assert.equal(result.frame.sharedAcrossViews, false);
  assert.equal(result.frame.source, 'sapiens_runtime_audit');

  assert.equal(result.axes.x, 'image_right');
  assert.equal(result.axes.y, 'image_down');
  assert.equal(result.axes.z, 'model_depth_channel');
  assert.equal(result.axes.source, 'sapiens_runtime_audit');

  assert.equal(result.canonicalCompatibility.revacityXYZ, false);
  assert.equal(result.canonicalCompatibility.revacityZ, false);
  assert.equal(result.canonicalCompatibility.sideUToCanonicalZ, false);
  assert.equal(result.canonicalCompatibility.frontSideFusion, false);

  assert.equal(result.physicalAuthority.status, PHYSICAL_AUTHORITY_STATUS.NOT_AUTHORITATIVE);
  assert.ok(result.physicalAuthority.blockers.includes('physical_units_not_verified'));
  assert.ok(result.physicalAuthority.blockers.includes('view_local_camera_frame'));
  assert.ok(result.physicalAuthority.blockers.includes('cross_view_transform_unavailable'));
  assert.ok(result.physicalAuthority.blockers.includes('camera_intrinsics_unavailable'));
  assert.ok(result.physicalAuthority.blockers.includes('camera_extrinsics_unavailable'));

  assert.equal(result.bodySurfaceAuthorization.serializedPointmapBodyMasked, false);
  assert.equal(result.bodySurfaceAuthorization.valueExistsImpliesAuthorized, false);
  assert.equal(result.bodySurfaceAuthorization.clothingBodySurfaceAuthorized, false);
}

describe('Milestone 4.5G — Authoritative Physical Evidence Semantics v0', () => {
  beforeEach(() => {
    setBodyEvidencePackage(null);
  });

  afterEach(() => {
    setBodyEvidencePackage(null);
  });

  it('exports contract metadata, status taxonomy, and evaluator registries', () => {
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT, 'authoritative-physical-evidence-semantics-v0');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION, 'authoritative-physical-evidence-semantics-v0');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.VALIDATED, 'validated');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.PARTIAL, 'partial');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.UNVALIDATED, 'unvalidated');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.INVALID, 'invalid');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.UNAVAILABLE, 'unavailable');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY.MISSING, 'missing');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_AVAILABILITY.PRESENT, 'present');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.NONE, 'none');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.CAMERA_FRAME_GEOMETRIC, 'camera_frame_geometric');
    assert.equal(AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.AUTHORITATIVE_PHYSICAL, 'authoritative_physical');

    assert.deepEqual(IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS, [
      'sapiens-pointmap-camera-frame-evaluator-v0',
    ]);
    assert.deepEqual(IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS, []);
    assert.equal(
      IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS.includes('validated-dense-geometry-v0'),
      false,
    );
    assert.equal(
      IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS.includes('validated-dense-geometry-v0'),
      false,
    );
  });

  it('classifies a recognized Front Sapiens pointmap as camera_frame_geometric, partial, unauthorized', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });
    assertSapiensCameraFrameSemantics(result, 'front');
  });

  it('classifies a recognized Side Sapiens pointmap independently as camera_frame_geometric, partial, unauthorized', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'side',
      pointmap: createRecognizedSapiensPointmap({
        view: 'side',
        declaredScale: 0.5210015773773193,
      }),
      denseQa: createPassingDenseQa({ view: 'side' }),
    });
    assertSapiensCameraFrameSemantics(result, 'side');
  });

  it('keeps Front and Side frames explicitly non-shared', () => {
    const front = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });
    const side = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'side',
      pointmap: createRecognizedSapiensPointmap({ view: 'side' }),
      denseQa: createPassingDenseQa({ view: 'side' }),
    });
    const report = evaluateAuthoritativePhysicalEvidenceSemanticsReport({
      front: {
        pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
        denseQa: createPassingDenseQa({ view: 'front' }),
      },
      side: {
        pointmap: createRecognizedSapiensPointmap({ view: 'side' }),
        denseQa: createPassingDenseQa({ view: 'side' }),
      },
    });

    assert.equal(front.frame.sharedAcrossViews, false);
    assert.equal(side.frame.sharedAcrossViews, false);
    assert.equal(report.sharedAcrossViews, false);
    assert.equal(report.views.front.frame.sharedAcrossViews, false);
    assert.equal(report.views.side.frame.sharedAcrossViews, false);
  });

  it('applies audited Sapiens X/Y/Z camera-frame semantics only for the recognized evaluator', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front', model: 'sapiens2-1b' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });
    assert.equal(result.evaluatorId, SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID);
    assert.equal(result.axes.x, 'image_right');
    assert.equal(result.axes.y, 'image_down');
    assert.equal(result.axes.z, 'model_depth_channel');
    assert.equal(result.scale.semantics, 'predicted_focal_normalization');
  });

  it('does not inherit Sapiens camera-frame semantics for an unrecognized pointmap source', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createUnrecognizedPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });

    assert.equal(result.availability, 'present');
    assert.equal(result.status, AUTHORITATIVE_PHYSICAL_EVIDENCE_STATUS.UNVALIDATED);
    assert.equal(result.authorized, false);
    assert.equal(result.evidenceClass, AUTHORITATIVE_PHYSICAL_EVIDENCE_CLASS.NONE);
    assert.equal(result.evaluatorId, null);
    assert.notEqual(result.frame.type, 'camera_local');
    assert.notEqual(result.axes.x, 'image_right');
    assert.notEqual(result.axes.y, 'image_down');
    assert.notEqual(result.axes.z, 'model_depth_channel');
    assert.notEqual(result.scale.semantics, 'predicted_focal_normalization');
    assert.equal(result.frame.sharedAcrossViews, false);
    assert.equal(result.physicalAuthority.status, PHYSICAL_AUTHORITY_STATUS.NOT_AUTHORITATIVE);
  });

  it('treats declaredUnits "meters" as service-reported and unverified', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front', declaredUnits: 'meters' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });

    assert.equal(result.units.reported, 'meters');
    assert.equal(result.units.unitAuthority, 'service_reported');
    assert.equal(result.units.physicalUnitsVerified, false);
    assert.equal(result.authorized, false);
    assert.equal(result.physicalAuthority.status, PHYSICAL_AUTHORITY_STATUS.NOT_AUTHORITATIVE);
  });

  it('classifies declaredScale as predicted focal-normalization provenance only', () => {
    const declaredScale = 0.4745759963989258;
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front', declaredScale }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });

    assert.equal(result.scale.available, true);
    assert.equal(result.scale.declaredScale, declaredScale);
    assert.equal(result.scale.semantics, 'predicted_focal_normalization');
    assert.equal(result.scale.physicalScaleAuthority, false);
    assert.equal(result.scale.isRevacityMetricScale, false);
    assert.equal(result.scale.isBodyHeightScale, false);
    assert.equal(result.scale.isCrossViewCalibration, false);
  });

  it('never treats Sapiens scale as REVacity metric, body-height, or cross-view calibration', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'side',
      pointmap: createRecognizedSapiensPointmap({
        view: 'side',
        declaredScale: 1.0,
      }),
      denseQa: createPassingDenseQa({ view: 'side' }),
    });
    assert.equal(result.scale.isRevacityMetricScale, false);
    assert.equal(result.scale.isBodyHeightScale, false);
    assert.equal(result.scale.isCrossViewCalibration, false);
  });

  it('emits physical-authority blockers only for present evidence', () => {
    const present = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });
    assert.ok(present.physicalAuthority.blockers.length > 0);

    const missing = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: { present: false },
    });
    assert.equal(missing.availability, 'missing');
    assert.equal(missing.status, 'unavailable');
    assert.equal(missing.evidenceClass, 'none');
    assert.equal(missing.authorized, false);
    assert.equal(missing.physicalAuthority.status, 'unavailable');
    assert.deepEqual(missing.physicalAuthority.blockers, []);
  });

  it('keeps canonical compatibility false for Side U, REVacity Z, and Front/Side fusion', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'side',
      pointmap: createRecognizedSapiensPointmap({ view: 'side' }),
      denseQa: createPassingDenseQa({ view: 'side' }),
    });
    assert.equal(result.canonicalCompatibility.sideUToCanonicalZ, false);
    assert.equal(result.canonicalCompatibility.revacityZ, false);
    assert.equal(result.canonicalCompatibility.frontSideFusion, false);
    assert.equal(result.canonicalCompatibility.revacityXYZ, false);
  });

  it('marks missing pointmap unavailable rather than not_authoritative', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'side',
      pointmap: null,
    });
    assert.equal(result.availability, 'missing');
    assert.equal(result.status, 'unavailable');
    assert.equal(result.evidenceClass, 'none');
    assert.equal(result.authorized, false);
    assert.equal(result.physicalAuthority.status, 'unavailable');
    assert.notEqual(result.physicalAuthority.status, 'not_authoritative');
  });

  it('marks present but failed/uninspectable dense QA as invalid and unauthorized', () => {
    const failed = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createFailingDenseQa({ view: 'front' }),
    });
    assert.equal(failed.availability, 'present');
    assert.equal(failed.status, 'invalid');
    assert.equal(failed.authorized, false);
    assert.equal(failed.physicalAuthority.status, 'not_authoritative');

    const uninspectable = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createFailingDenseQa({ view: 'front', uninspectable: true }),
    });
    assert.equal(uninspectable.availability, 'present');
    assert.equal(uninspectable.status, 'invalid');
    assert.equal(uninspectable.authorized, false);
  });

  it('does not treat pointmap sample values as body-surface authorization', () => {
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
      clothingBodySurfaceResult: {
        contract: 'clothing-body-surface-semantics-v0',
        status: 'partial',
        authorized: false,
        dimensions: { bodySurfaceAuthorized: false },
      },
    });
    assert.equal(result.bodySurfaceAuthorization.serializedPointmapBodyMasked, false);
    assert.equal(result.bodySurfaceAuthorization.valueExistsImpliesAuthorized, false);
    assert.equal(result.bodySurfaceAuthorization.clothingBodySurfaceAuthorized, false);
  });

  it('does not introduce circumference, cross-section, or volume APIs or results', () => {
    const exportNames = Object.keys(authoritativePhysicalEvidenceSemantics);
    for (const name of exportNames) {
      const lower = name.toLowerCase();
      for (const token of FORBIDDEN_API_TOKENS) {
        assert.equal(
          lower.includes(token.toLowerCase()),
          false,
          `Forbidden API export '${name}' matches '${token}'`,
        );
      }
    }

    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });
    const serialized = JSON.stringify(result).toLowerCase();
    assert.equal(serialized.includes('circumference'), false);
    assert.equal(serialized.includes('cross-section'), false);
    assert.equal(serialized.includes('cross_section'), false);
    assert.equal(serialized.includes('bodyvolume'), false);
    assert.equal(result.circumferenceCm, undefined);
    assert.equal(result.crossSectionCm2, undefined);
    assert.equal(result.volumeCm3, undefined);
    assert.equal(result.status, 'partial');
    assert.notEqual(result.status, 'validated');
  });

  it('references projected metric observations without changing their values', () => {
    const projected = {
      contract: 'physical-measurement-semantics-v0',
      metricProjectedEligibility: true,
      metricProjectedSpanCm: 30.8,
      physicalSpanCm: null,
      physicalEligibility: false,
    };
    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
      projectedMetricResult: projected,
    });

    assert.equal(result.projectedMetricRef.available, true);
    assert.equal(result.projectedMetricRef.contract, 'physical-measurement-semantics-v0');
    assert.equal(projected.metricProjectedSpanCm, 30.8);
    assert.equal(projected.physicalSpanCm, null);
    assert.equal(result.physicalMeasurementCm, undefined);
    assert.equal(result.authorized, false);
  });

  it('leaves existing Front/Side measurement contracts unchanged', () => {
    assert.equal(FRONT_TRANSVERSE_WIDTH_CONTRACT, 'front-transverse-width-v0');
    assert.equal(SIDE_PROFILE_SPAN_CONTRACT, 'side-profile-span-v0');

    const result = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });
    assert.notEqual(result.contract, FRONT_TRANSVERSE_WIDTH_CONTRACT);
    assert.notEqual(result.contract, SIDE_PROFILE_SPAN_CONTRACT);
    assert.equal(result.contract, AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT);
  });

  it('rejects a forged validated/authorized 4.5G object without a registered physical-geometry evaluator', () => {
    const forged = {
      contract: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
      version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
      status: 'validated',
      authorized: true,
      evidenceClass: 'authoritative_physical',
      evaluatorId: SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID,
      physicalAuthority: { status: 'authoritative' },
      physicalMeasurementCm: 30.8,
    };

    assert.equal(isValidatedAuthoritativePhysicalGeometryEvidence(forged), false);
    assert.deepEqual(IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS, []);
  });
});

describe('Milestone 4.5G — Real archive and 4.5D wiring', () => {
  const zipPath = 'C:\\Users\\VIP\\Downloads\\output.zip';

  beforeEach(() => {
    setBodyEvidencePackage(null);
  });

  afterEach(() => {
    setBodyEvidencePackage(null);
  });

  it('evaluates real Body Pipeline archive: Front/Side are camera_frame_geometric, projected cm unchanged, 4.5D still blocked', async () => {
    if (!fs.existsSync(zipPath)) {
      console.warn(`[Test Skipped] Real archive output.zip not found at: ${zipPath}`);
      return;
    }

    const zipBytes = fs.readFileSync(zipPath);
    const importRes = await importBodyEvidenceZip(zipBytes);
    assert.equal(importRes.ok, true, `Import failed: ${importRes.error}`);

    setBodyEvidencePackage(importRes.package);
    const analysisRes = await analyzeLoadedBodyEvidenceAsync();
    assert.ok(analysisRes.ok, `Body evidence analysis failed: ${analysisRes.error}`);

    const pixelsPerCm = 10;
    const canvasSize = 2000;
    const frontLandmarks = importRes.package.front?.pose?.acceptedLandmarks ?? [];
    const annotations = frontLandmarks.map((lm) => ({
      type: 'body_landmark',
      name: lm.name,
      point: {
        x: typeof lm.imageX === 'number' ? lm.imageX / pixelsPerCm : 0,
        y: typeof lm.imageY === 'number' ? (canvasSize - lm.imageY) / pixelsPerCm : 0,
        z: 200,
      },
    }));

    const frontSemantics = getAuthoritativePhysicalEvidenceSemantics({ view: 'front' });
    const sideSemantics = getAuthoritativePhysicalEvidenceSemantics({ view: 'side' });
    assert.ok(frontSemantics);
    assert.ok(sideSemantics);
    assertSapiensCameraFrameSemantics(frontSemantics, 'front');
    assertSapiensCameraFrameSemantics(sideSemantics, 'side');
    assert.equal(frontSemantics.units.reported, 'meters');
    assert.equal(frontSemantics.scale.semantics, 'predicted_focal_normalization');
    assert.equal(frontSemantics.scale.isRevacityMetricScale, false);

    const report = getAuthoritativePhysicalEvidenceSemanticsReport();
    assert.ok(report);
    assert.equal(report.contract, 'authoritative-physical-evidence-semantics-report-v0');
    assert.equal(report.sharedAcrossViews, false);

    const frontShoulderObs = getFrontTransverseWidth({
      id: 'torso_width_at_shoulder_level',
      annotations,
    });
    const sideShoulderObs = getSideProfileSpan({
      id: 'torso_profile_span_at_shoulder_level',
      annotations,
    });
    const frontHipObs = getFrontTransverseWidth({
      id: 'torso_width_at_hip_level',
      annotations,
    });
    const sideHipObs = getSideProfileSpan({
      id: 'torso_profile_span_at_hip_level',
      annotations,
    });

    assert.ok(frontShoulderObs);
    assert.ok(sideShoulderObs);
    assert.ok(frontHipObs);
    assert.ok(sideHipObs);
    assert.equal(frontShoulderObs.contract, FRONT_TRANSVERSE_WIDTH_CONTRACT);
    assert.equal(sideShoulderObs.contract, SIDE_PROFILE_SPAN_CONTRACT);
    assert.ok(Math.abs(frontShoulderObs.valueCm - 30.80) < 1e-4);
    assert.ok(Math.abs(sideShoulderObs.valueCm - 11.00) < 1e-4);
    assert.ok(Math.abs(frontHipObs.valueCm - 42.20) < 1e-4);
    assert.ok(Math.abs(sideHipObs.valueCm - 27.70) < 1e-4);

    const eligibilityReport = getPhysicalMeasurementEligibilityReport({ annotations });
    assert.ok(eligibilityReport);
    assert.equal(eligibilityReport.summary.eligibleCount, 0);
    for (const res of eligibilityReport.results) {
      assert.equal(res.physicalEligibility, false);
      assert.equal(res.physicalMeasurementCm, null);
      assert.ok(res.blockers.includes(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING));
    }

    const frontShoulderElig = getPhysicalMeasurementEligibility({
      id: 'torso_transverse_width_at_shoulder_level',
      annotations,
    });
    assert.ok(Math.abs(frontShoulderElig.metricProjectedSpanCm - 30.80) < 1e-4);
  });
});

describe('Milestone 4.5G — 4.5D / 4.5C forged-authority protection (module-level)', () => {
  it('auto-supplied 4.5G partial result still yields authoritative_physical_evidence_missing', () => {
    const observation = createMetricObservation();
    const calib = {
      status: 'validated',
      metricProjectedEligibility: true,
      scaleCmPerPx: 0.1,
      view: 'front',
    };
    const partial45G = evaluateAuthoritativePhysicalEvidenceSemantics({
      view: 'front',
      pointmap: createRecognizedSapiensPointmap({ view: 'front' }),
      denseQa: createPassingDenseQa({ view: 'front' }),
    });

    const result = evaluatePhysicalMeasurementEligibility(observation, {
      definition: 'torso_transverse_width_at_shoulder_level',
      metricCalibrationResult: calib,
      authoritativePhysicalEvidenceResults: partial45G,
    });

    assert.equal(partial45G.status, 'partial');
    assert.equal(partial45G.authorized, false);
    assert.equal(result.physicalEligibility, false);
    assert.equal(result.physicalMeasurementCm, null);
    assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING));
  });

  it('rejects a forged validated/authorized 4.5G object in 4.5D without a registered physical evaluator', () => {
    const observation = createMetricObservation();
    const calib = {
      status: 'validated',
      metricProjectedEligibility: true,
      scaleCmPerPx: 0.1,
      view: 'front',
    };
    const forged = {
      contract: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
      version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
      status: 'validated',
      authorized: true,
      evidenceClass: 'authoritative_physical',
      evaluatorId: SAPIENS_POINTMAP_CAMERA_FRAME_EVALUATOR_ID,
      physicalAuthority: { status: 'authoritative' },
      physicalMeasurementCm: 30.8,
      targetView: 'front',
    };

    const result = evaluatePhysicalMeasurementEligibility(observation, {
      definition: 'torso_transverse_width_at_shoulder_level',
      metricCalibrationResult: calib,
      viewPoseValidationResult: {
        contract: 'controlled-capture-protocol-v0',
        evaluatorId: 'synthetic_pose_evaluator_v0',
        status: 'validated',
        authorized: true,
        targetView: 'front',
      },
      authoritativePhysicalEvidenceResults: forged,
    });

    assert.equal(result.physicalEligibility, false);
    assert.equal(result.physicalMeasurementCm, null);
    assert.ok(result.blockers.includes(ELIGIBILITY_BLOCKER_CODES.AUTHORITATIVE_PHYSICAL_EVIDENCE_MISSING));
  });

  it('rejects a forged validated/authorized 4.5G object in 4.5C without a registered physical evaluator', () => {
    const observation = createMetricObservation({
      view: 'side',
      id: 'torso_profile_span_at_shoulder_level',
      contract: SIDE_PROFILE_SPAN_CONTRACT,
      valueCm: 11.0,
    });
    const forged = {
      contract: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT,
      version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
      status: 'validated',
      authorized: true,
      evidenceClass: 'authoritative_physical',
      evaluatorId: 'forged-physical-geometry-evaluator-v0',
      physicalAuthority: { status: 'authoritative' },
    };

    const result = evaluatePhysicalMeasurementSemantics(observation, {
      calibrationProvenance: {
        contract: 'metric-calibration-provenance-v0',
        status: 'validated',
        metricProjectedEligibility: true,
      },
      viewCalibration: { viewCategoryValidated: true, viewOrientation: 'left_profile' },
      physicalEvidencePaths: forged,
    });

    assert.equal(result.physicalEligibility, false);
    assert.equal(result.physicalSpanCm, null);
    assert.notEqual(result.status, 'validated');
  });
});

/**
 * Body Evidence state (v0)
 * Isolated QA/evidence store — separate from measurement, annotation,
 * Scene Graph, and Scene State export/import.
 *
 * Manual Promote Selected Landmark creates a normal annotation via the
 * shared annotation helper; Body Evidence evidence state is unchanged.
 */

import {
  BODY_EVIDENCE_V0_SCALE,
  CORE_FRONT_BODY_ANCHORS,
  SCALE_STATUS_FIXED,
  analyzeBodyEvidence,
  createFixedBodyEvidenceScale,
  isCoreFrontBodyAnchor,
  isSecondaryBodyAnchorCandidate,
  normalizeLandmarkName,
} from './bodyEvidenceAdapter.js';
import {
  evaluateSameViewDenseCrossModalQa,
} from './denseEvidenceQa.js';
import {
  buildAnatomicalRegionEvidence,
} from './anatomicalRegionEvidence.js';
import {
  sampleFrontHorizontalRasterSlice,
} from './frontRasterSlice.js';
import {
  sampleSideHorizontalRasterSlice,
} from './sideRasterSlice.js';
import {
  FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
  SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0,
  interpretFrontTransverseWidth,
} from './frontTransverseWidth.js';
import {
  SIDE_PROFILE_SPAN_CONTRACT_VERSION,
  SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0,
  interpretSideProfileSpan,
} from './sideProfileSpan.js';
import {
  CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION,
  SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0,
  buildCrossViewMeasurementCorrespondence,
} from './crossViewMeasurementCorrespondence.js';
import {
  CROSS_VIEW_COMPARABILITY_QA_CONTRACT_VERSION,
  evaluateCrossViewComparabilityQa,
} from './crossViewComparabilityQa.js';
import {
  METRIC_CALIBRATION_PROVENANCE_CONTRACT_VERSION,
  evaluateMetricCalibrationProvenance,
} from './metricCalibrationProvenance.js';
import {
  PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT_VERSION,
  SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0,
  evaluatePhysicalMeasurementSemantics,
} from './physicalMeasurementSemantics.js';
import {
  PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT_VERSION,
  PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT_VERSION,
  evaluatePhysicalMeasurementEligibility,
  evaluatePairedCrossViewEligibility,
} from './physicalMeasurementEligibility.js';
import {
  VIEW_POSE_SEMANTICS_CONTRACT_VERSION,
  VIEW_POSE_STATUS,
  evaluateViewPoseSemantics,
  evaluateViewPoseSemanticsReport,
} from './viewPoseSemantics.js';
import {
  CLOTHING_BODY_SURFACE_CONTRACT_VERSION,
  CLOTHING_BODY_SURFACE_STATUS,
  evaluateClothingBodySurfaceSemantics,
  evaluateClothingBodySurfaceSemanticsReport,
} from './clothingBodySurfaceSemantics.js';
import {
  AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
  evaluateAuthoritativePhysicalEvidenceSemantics,
  evaluateAuthoritativePhysicalEvidenceSemanticsReport,
} from './authoritativePhysicalEvidenceSemantics.js';
import {
  SIDE_T_POSE_CONTRACT_VERSION,
  SIDE_T_POSE_STATUS,
  evaluateSidePoseQualification,
} from './sidePoseQualification.js';
import {
  SIDE_VIEW_ORIENTATION_CONTRACT_VERSION,
  SIDE_VIEW_ORIENTATION_STATUS,
  evaluateSideViewOrientationQualification,
} from './sideViewOrientationQualification.js';
import {
  SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT_VERSION,
  SIDE_ORIENTATION_STATUS,
  evaluateSideAnteriorPosteriorOrientation,
} from './sideAnteriorPosteriorOrientation.js';
import {
  SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
  SIDE_PHYSICAL_DEPTH_STATUS,
  SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0,
  evaluateSidePhysicalDepthQualification,
} from './sidePhysicalDepthQualification.js';
import {
  CROSS_SECTION_EVIDENCE_CONTRACT_VERSION,
  CROSS_SECTION_EVIDENCE_STATUS,
  SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0,
  evaluateCrossSectionEvidence,
} from './crossSectionEvidence.js';
import {
  MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION,
  MODELED_CROSS_SECTION_PERIMETER_STATUS,
  SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0,
  evaluateModeledCrossSectionPerimeter,
} from './modeledCrossSectionPerimeter.js';
import {
  DIRECT_BODY_MEASUREMENTS_CONTRACT_VERSION,
  SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0,
  evaluateDirectBodyMeasurement,
  evaluateDirectBodyMeasurements,
} from './directBodyMeasurements.js';
import {
  PELVIC_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
  evaluatePelvicArbitraryYEvidenceScan,
} from './pelvicArbitraryYEvidenceScan.js';
import {
  MAXIMUM_SEAT_PLANE_CONTRACT_VERSION,
  evaluateMaximumSeatPlaneLocalization,
} from './maximumSeatPlaneLocalization.js';
import {
  TORSO_ARBITRARY_Y_SCAN_CONTRACT_VERSION,
  evaluateTorsoArbitraryYEvidenceScan,
} from './torsoArbitraryYEvidenceScan.js';
import {
  NATURAL_WAIST_PLANE_CONTRACT_VERSION,
  evaluateNaturalWaistPlaneLocalization,
} from './naturalWaistPlaneLocalization.js';
import {
  MODELED_HIP_SEAT_CIRCUMFERENCE_CONTRACT_VERSION,
  evaluateModeledHipSeatCircumference,
} from './modeledHipSeatCircumference.js';
import {
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_CONTRACT_VERSION,
  evaluateModeledNaturalWaistCircumference,
} from './modeledNaturalWaistCircumference.js';
import {
  MEASUREMENT_VISUALIZATION_PROVENANCE_CONTRACT_VERSION,
  resolveMeasurementVisualizationProvenance,
} from './measurementVisualizationProvenance.js';
import {
  computeAnatomicalLevels,
} from './anatomicalLevels.js';
import { ROOM_SIZE } from '../core/constants.js';
import { FRONT_SURFACE_DEPTH_CM, frontSurfaceTo3d, isOnFrontSurface } from '../core/frontSurface.js';
import { addAnnotationFromPoint, getAnnotations } from './annotations.js';
import { findDuplicateAnnotation } from './annotationValidation.js';

/** Annotation type used when promoting a front body evidence landmark. */
export const PROMOTED_BODY_LANDMARK_TYPE = 'body_landmark';

const emptySources = () => ({
  frontPose: null,
  sidePose: null,
  frontSeg: null,
  sideSeg: null,
});

/** @type {{
 *   frontPose: object|null,
 *   sidePose: object|null,
 *   frontSeg: object|null,
 *   sideSeg: object|null,
 * }} */
let sources = emptySources();

/** @type {object|null} */
let currentPackage = null;

/** @type {ReturnType<typeof analyzeBodyEvidence>|null} */
let qaResult = null;

/**
 * Derived runtime Dense Evidence QA state (Milestone 3.2).
 * Separate from immutable package schema and landmark QA.
 * @type {{
 *   front: {
 *     pointmap: object|null,
 *     normals: object|null,
 *     crossModal: object|null,
 *   },
 *   side: {
 *     pointmap: object|null,
 *     normals: object|null,
 *     crossModal: object|null,
 *   },
 * }|null}
 */
let denseEvidenceQa = null;

/** Session counter to guarantee stale async dense QA results cannot overwrite newer state. */
let currentAnalysisSessionId = 0;

/** @type {string|null} */
let lastError = null;

let overlayVisible = false;
let secondaryCandidatesVisible = false;
/** Side core Body Evidence overlay visibility (evidence plane; default on when analyzed). */
let sideCoreOverlayVisible = true;
/** Side secondary Body Evidence overlay visibility (evidence plane; default on when analyzed). */
let sideSecondaryOverlayVisible = true;

/**
 * UI-only Front Body Evidence landmark selection (inspect/select v0).
 * Separate from measurement A/B, Annotate selection, annotations, Scene Graph,
 * and Side Evidence inspection selection.
 * Not included in diagnostic or Scene State export.
 * @type {{
 *   id: string,
 *   name: string,
 *   view: 'front',
 *   imageX: number,
 *   imageY: number,
 *   spaceX: number,
 *   spaceY: number,
 *   score: number|null,
 *   scaleStatus: string,
 *   scaleSource: string,
 *   pixelsPerCm: number,
 *   canvasSize: number,
 *   status: string,
 * }|null}
 */
let selectedBodyEvidenceLandmark = null;

/**
 * UI-only Side Evidence landmark selection (inspect v0).
 * Separate from Front Body Evidence selection, A/B, Annotate, Scene Graph,
 * and Scene State. Not promotable. Not exported.
 * @type {{
 *   id: string,
 *   name: string,
 *   view: 'side',
 *   imageX: number,
 *   imageY: number,
 *   sideUcm: number,
 *   sideYcm: number,
 *   score: number|null,
 *   profile: 'Left'|'Right'|'Unknown',
 *   scaleStatus: string,
 *   scaleSource: string,
 *   pixelsPerCm: number,
 *   canvasSize: number,
 *   status: string,
 * }|null}
 */
let selectedSideEvidenceLandmark = null;

/**
 * UI-only Front Segmentation class selection (inspect v0).
 * Independent from Side segmentation selection and landmark selections.
 * @type {number|null}
 */
let selectedFrontSegClassId = null;

/**
 * UI-only Side Segmentation class selection (inspect v0).
 * Independent from Front segmentation selection and landmark selections.
 * @type {number|null}
 */
let selectedSideSegClassId = null;

/** @type {Set<() => void>} */
const changeListeners = new Set();

/**
 * Fixed Body Evidence Import v0 canvas size for overlay / mapping consumers.
 * Scale source of truth lives in bodyEvidenceAdapter.js (`BODY_EVIDENCE_V0_SCALE`).
 */
export const ASSUMED_IMAGE_SIZE_PX = BODY_EVIDENCE_V0_SCALE.canvasSize;

export function subscribeBodyEvidenceChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyBodyEvidenceChange() {
  for (const listener of changeListeners) {
    listener();
  }
}

function getBodyEvidenceSources() {
  return {
    frontPose: sources.frontPose,
    sidePose: sources.sidePose,
    frontSeg: sources.frontSeg,
    sideSeg: sources.sideSeg,
  };
}

export function getBodyEvidenceQa() {
  return qaResult;
}

export function getBodyEvidenceError() {
  return lastError;
}

export function hasAnalyzedBodyEvidence() {
  return qaResult != null;
}

/**
 * Access the decoded Front segmentation raster (Uint8Array) from runtime state.
 * Returns null if no Front segmentation is analyzed or if raster is invalid.
 * @returns {Uint8Array|null}
 */
export function getFrontSegmentationRaster() {
  return qaResult?.views.front.segmentation.raster ?? null;
}

/**
 * Access the decoded Side segmentation raster (Uint8Array) from runtime state.
 * Returns null if no Side segmentation is analyzed or if raster is invalid.
 * @returns {Uint8Array|null}
 */
export function getSideSegmentationRaster() {
  return qaResult?.views.side.segmentation.raster ?? null;
}

/** Accepted (non-face) front landmarks, including low-confidence entries. */
function getFrontAcceptedLandmarks() {
  return qaResult?.views.front.pose.acceptedLandmarks ?? [];
}

/** Accepted (non-face) side landmarks, including low-confidence entries. */
function getSideAcceptedLandmarks() {
  return qaResult?.views.side.pose.acceptedLandmarks ?? [];
}

/**
 * Renderable / primary-candidate front body landmarks: accepted front landmarks
 * narrowed by the positive core-13 whitelist. This is the single source of
 * truth for what the Front Surface overlay and core candidate list may show.
 * Dense extra points remain parsed and QA-counted; named secondary body
 * landmarks are available separately via `getSecondaryFrontBodyLandmarks`.
 */
export function getRenderableFrontBodyLandmarks() {
  return getFrontAcceptedLandmarks().filter((landmark) => isCoreFrontBodyAnchor(landmark?.name));
}

/**
 * Secondary Side Body Landmark Candidates v0: allowlisted side pose landmarks
 * beyond the core 13. Inspect-only — not promotable.
 */
export function getSecondarySideBodyLandmarks() {
  return getSideAcceptedLandmarks().filter(
    (landmark) => landmark?.secondary === true && !landmark.lowConfidence,
  );
}

/**
 * Renderable Side Evidence body landmarks: accepted side pose landmarks
 * narrowed by the same core body identities used for Front (partial profile
 * sets are valid). Low-confidence entries are excluded from visualization.
 * Face/head, dense hands/fingers, and non-core extras stay QA-only.
 * Does not fabricate mirrored/opposite-side joints.
 */
export function getRenderableSideBodyLandmarks() {
  return getSideAcceptedLandmarks().filter(
    (landmark) => isCoreFrontBodyAnchor(landmark?.name) && !landmark.lowConfidence,
  );
}

/**
 * Secondary Body Landmark Candidates v0 (front only): allowlisted body
 * landmarks beyond the core 13 (acromion / heel / big toe / small toe).
 * Not part of readiness or preview lines — list/select/promote only.
 * Deferred hand, finger, and unstable extras never appear here.
 */
export function getSecondaryFrontBodyLandmarks() {
  return getFrontAcceptedLandmarks().filter(
    (landmark) => isSecondaryBodyAnchorCandidate(landmark?.name),
  );
}

/**
 * True when a Body Evidence landmark name may be manually promoted
 * (core 13 or secondary candidate).
 */
function isPromotableBodyEvidenceLandmark(name) {
  return isCoreFrontBodyAnchor(name) || isSecondaryBodyAnchorCandidate(name);
}

/**
 * Resolved display scale for the Front Surface overlay.
 * Body Evidence Import v0 always uses the fixed 2000×2000 / 10 px/cm assumption.
 * heightCm is postponed / not used.
 */
export function getBodyEvidenceScaleInfo() {
  const scale = qaResult?.scale ?? createFixedBodyEvidenceScale();
  return {
    status: scale.status ?? SCALE_STATUS_FIXED,
    pixelsPerCm: BODY_EVIDENCE_V0_SCALE.pixelsPerCm,
    canvasSize: BODY_EVIDENCE_V0_SCALE.canvasSize,
    imageWidth: BODY_EVIDENCE_V0_SCALE.imageWidth,
    imageHeight: BODY_EVIDENCE_V0_SCALE.imageHeight,
    heightCm: null,
    usingDetected: false,
    source: BODY_EVIDENCE_V0_SCALE.source,
    sourceLabel: BODY_EVIDENCE_V0_SCALE.sourceLabel,
  };
}

export function isBodyEvidenceOverlayVisible() {
  return overlayVisible && qaResult != null;
}

export function setBodyEvidenceOverlayVisible(visible) {
  const next = Boolean(visible);
  if (next === overlayVisible) {
    return;
  }
  overlayVisible = next;
  notifyBodyEvidenceChange();
}

export function isSecondaryBodyEvidenceVisible() {
  return (
    secondaryCandidatesVisible
    && qaResult != null
    && getSecondaryFrontBodyLandmarks().length > 0
  );
}

export function setSecondaryBodyEvidenceVisible(visible) {
  const next = Boolean(visible) && getSecondaryFrontBodyLandmarks().length > 0;
  if (next === secondaryCandidatesVisible) {
    return;
  }
  secondaryCandidatesVisible = next;
  notifyBodyEvidenceChange();
}

export function isSideCoreBodyEvidenceVisible() {
  return (
    sideCoreOverlayVisible
    && qaResult != null
    && getRenderableSideBodyLandmarks().length > 0
  );
}

export function setSideCoreBodyEvidenceVisible(visible) {
  const next = Boolean(visible) && getRenderableSideBodyLandmarks().length > 0;
  if (next === sideCoreOverlayVisible) {
    return;
  }
  sideCoreOverlayVisible = next;
  notifyBodyEvidenceChange();
}

export function isSideSecondaryBodyEvidenceVisible() {
  return (
    sideSecondaryOverlayVisible
    && qaResult != null
    && getSecondarySideBodyLandmarks().length > 0
  );
}

export function setSideSecondaryBodyEvidenceVisible(visible) {
  const next = Boolean(visible) && getSecondarySideBodyLandmarks().length > 0;
  if (next === sideSecondaryOverlayVisible) {
    return;
  }
  sideSecondaryOverlayVisible = next;
  notifyBodyEvidenceChange();
}

export function getSelectedBodyEvidenceLandmark() {
  return selectedBodyEvidenceLandmark;
}

export function isSelectedBodyEvidenceLandmark(landmarkOrId) {
  if (!selectedBodyEvidenceLandmark) {
    return false;
  }
  const id = typeof landmarkOrId === 'string'
    ? landmarkOrId
    : landmarkOrId?.id;
  return Boolean(id) && selectedBodyEvidenceLandmark.id === id;
}

/**
 * Select a Front Body Evidence overlay landmark for inspection only.
 * Replaces any previous Front Body Evidence selection.
 * Does not clear or mutate Side Evidence inspection selection.
 * @param {object|null} landmark
 */
export function selectBodyEvidenceLandmark(landmark) {
  if (!landmark || typeof landmark !== 'object' || !landmark.id) {
    if (selectedBodyEvidenceLandmark !== null) {
      selectedBodyEvidenceLandmark = null;
      notifyBodyEvidenceChange();
    }
    return;
  }

  const next = {
    id: String(landmark.id),
    name: String(landmark.name ?? ''),
    view: 'front',
    candidateType: landmark.candidateType === 'secondary' ? 'secondary' : 'core',
    imageX: landmark.imageX,
    imageY: landmark.imageY,
    spaceX: landmark.spaceX ?? landmark.h,
    spaceY: landmark.spaceY ?? landmark.v,
    score: typeof landmark.score === 'number' && Number.isFinite(landmark.score)
      ? landmark.score
      : null,
    scaleStatus: String(landmark.scaleStatus ?? SCALE_STATUS_FIXED),
    scaleSource: String(landmark.scaleSource ?? BODY_EVIDENCE_V0_SCALE.sourceLabel),
    pixelsPerCm: Number(landmark.pixelsPerCm),
    canvasSize: Number(landmark.canvasSize),
    status: 'Body Evidence / visual-only',
  };

  const prev = selectedBodyEvidenceLandmark;
  if (
    prev
    && prev.id === next.id
    && prev.candidateType === next.candidateType
    && prev.imageX === next.imageX
    && prev.imageY === next.imageY
    && prev.spaceX === next.spaceX
    && prev.spaceY === next.spaceY
    && prev.score === next.score
    && prev.scaleStatus === next.scaleStatus
    && prev.scaleSource === next.scaleSource
    && prev.pixelsPerCm === next.pixelsPerCm
    && prev.canvasSize === next.canvasSize
  ) {
    return;
  }

  selectedBodyEvidenceLandmark = next;
  notifyBodyEvidenceChange();
}

/** Clears only the Front Body Evidence landmark selection (inspect UI state). */
export function clearBodyEvidenceSelection() {
  if (selectedBodyEvidenceLandmark === null) {
    return;
  }
  selectedBodyEvidenceLandmark = null;
  notifyBodyEvidenceChange();
}

export function getSelectedSideEvidenceLandmark() {
  return selectedSideEvidenceLandmark;
}

export function isSelectedSideEvidenceLandmark(landmarkOrId) {
  if (!selectedSideEvidenceLandmark) {
    return false;
  }
  const id = typeof landmarkOrId === 'string'
    ? landmarkOrId
    : landmarkOrId?.id;
  return Boolean(id) && selectedSideEvidenceLandmark.id === id;
}

/**
 * Select a Side Evidence landmark for Side-pane inspection only.
 * Does not mutate Front selection, A/B, annotations, or Body Graph.
 * @param {object|null} landmark
 */
export function selectSideEvidenceLandmark(landmark) {
  if (!landmark || typeof landmark !== 'object' || !landmark.id) {
    if (selectedSideEvidenceLandmark !== null) {
      selectedSideEvidenceLandmark = null;
      notifyBodyEvidenceChange();
    }
    return;
  }

  const sideUcm = Number(landmark.sideUcm ?? landmark.u ?? landmark.h);
  const sideYcm = Number(landmark.sideYcm ?? landmark.v);
  const next = {
    id: String(landmark.id),
    name: String(landmark.name ?? ''),
    view: 'side',
    candidateType: landmark.candidateType === 'secondary' ? 'secondary' : 'core',
    imageX: landmark.imageX,
    imageY: landmark.imageY,
    sideUcm,
    sideYcm,
    score: typeof landmark.score === 'number' && Number.isFinite(landmark.score)
      ? landmark.score
      : null,
    profile: landmark.profile === 'Left' || landmark.profile === 'Right'
      ? landmark.profile
      : 'Unknown',
    scaleStatus: String(landmark.scaleStatus ?? SCALE_STATUS_FIXED),
    scaleSource: String(landmark.scaleSource ?? BODY_EVIDENCE_V0_SCALE.sourceLabel),
    pixelsPerCm: Number(landmark.pixelsPerCm),
    canvasSize: Number(landmark.canvasSize),
    status: 'Side Evidence / inspect-only',
  };

  const prev = selectedSideEvidenceLandmark;
  if (
    prev
    && prev.id === next.id
    && prev.candidateType === next.candidateType
    && prev.imageX === next.imageX
    && prev.imageY === next.imageY
    && prev.sideUcm === next.sideUcm
    && prev.sideYcm === next.sideYcm
    && prev.score === next.score
    && prev.profile === next.profile
    && prev.scaleStatus === next.scaleStatus
    && prev.scaleSource === next.scaleSource
    && prev.pixelsPerCm === next.pixelsPerCm
    && prev.canvasSize === next.canvasSize
  ) {
    return;
  }

  selectedSideEvidenceLandmark = next;
  notifyBodyEvidenceChange();
}

/** Clears only the Side Evidence landmark selection (inspect UI state). */
export function clearSideEvidenceSelection() {
  if (selectedSideEvidenceLandmark === null) {
    return;
  }
  selectedSideEvidenceLandmark = null;
  notifyBodyEvidenceChange();
}

/**
 * Access the currently selected Front segmentation class ID.
 * @returns {number|null}
 */
export function getSelectedFrontSegClassId() {
  return selectedFrontSegClassId;
}

/**
 * Access the currently selected Side segmentation class ID.
 * @returns {number|null}
 */
export function getSelectedSideSegClassId() {
  return selectedSideSegClassId;
}

/**
 * Access the full normalized data of the selected Front segmentation class.
 * @returns {object|null}
 */
export function getSelectedFrontSegClass() {
  if (selectedFrontSegClassId === null || !qaResult?.views?.front?.segmentation) {
    return null;
  }
  const seg = qaResult.views.front.segmentation;
  const found = seg.classes.find((c) => c.classId === selectedFrontSegClassId);
  if (!found) {
    return null;
  }
  return {
    ...found,
    view: 'front',
    model: seg.model,
    widthPx: seg.widthPx,
    heightPx: seg.heightPx,
    dtype: seg.dtype,
    qa: seg.qa,
  };
}

/**
 * Access the full normalized data of the selected Side segmentation class.
 * @returns {object|null}
 */
export function getSelectedSideSegClass() {
  if (selectedSideSegClassId === null || !qaResult?.views?.side?.segmentation) {
    return null;
  }
  const seg = qaResult.views.side.segmentation;
  const found = seg.classes.find((c) => c.classId === selectedSideSegClassId);
  if (!found) {
    return null;
  }
  return {
    ...found,
    view: 'side',
    model: seg.model,
    widthPx: seg.widthPx,
    heightPx: seg.heightPx,
    dtype: seg.dtype,
    qa: seg.qa,
  };
}

/**
 * Select a Front segmentation class by its classId (0..num_classes-1).
 * Passing null or undefined clears the Front segmentation selection.
 * Independent from Side segmentation and landmark selections.
 * @param {number|null|undefined} classId
 */
export function selectFrontSegClass(classId) {
  const nextId = classId === null || classId === undefined ? null : Number(classId);
  if (selectedFrontSegClassId === nextId) {
    return;
  }
  selectedFrontSegClassId = nextId;
  notifyBodyEvidenceChange();
}

/**
 * Select a Side segmentation class by its classId (0..num_classes-1).
 * Passing null or undefined clears the Side segmentation selection.
 * Independent from Front segmentation and landmark selections.
 * @param {number|null|undefined} classId
 */
export function selectSideSegClass(classId) {
  const nextId = classId === null || classId === undefined ? null : Number(classId);
  if (selectedSideSegClassId === nextId) {
    return;
  }
  selectedSideSegClassId = nextId;
  notifyBodyEvidenceChange();
}

/** Clears only the Front segmentation class selection. */
export function clearFrontSegClass() {
  if (selectedFrontSegClassId === null) {
    return;
  }
  selectedFrontSegClassId = null;
  notifyBodyEvidenceChange();
}

/** Clears only the Side segmentation class selection. */
export function clearSideSegClass() {
  if (selectedSideSegClassId === null) {
    return;
  }
  selectedSideSegClassId = null;
  notifyBodyEvidenceChange();
}

/**
 * Clears all active Body Evidence inspection selections (Front/Side landmarks and Front/Side segmentation).
 */
export function clearAllBodyEvidenceSelections() {
  const hadAny = (
    selectedBodyEvidenceLandmark !== null
    || selectedSideEvidenceLandmark !== null
    || selectedFrontSegClassId !== null
    || selectedSideSegClassId !== null
  );
  if (!hadAny) {
    return;
  }
  clearBodyEvidenceSelectionSilent();
  notifyBodyEvidenceChange();
}

/**
 * True when a saved annotation already exists for this landmark name
 * with type `body_landmark` (duplicate promotion guard).
 */
export function isBodyLandmarkPromoted(name) {
  return Boolean(findDuplicateAnnotation(getAnnotations(), PROMOTED_BODY_LANDMARK_TYPE, name));
}

function isFiniteCoord(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isWithinRoomBounds(point) {
  if (!point) {
    return false;
  }
  const { x, y, z } = point;
  if (!isFiniteCoord(x) || !isFiniteCoord(y) || !isFiniteCoord(z)) {
    return false;
  }
  return x >= 0 && x <= ROOM_SIZE
    && y >= 0 && y <= ROOM_SIZE
    && z >= 0 && z <= ROOM_SIZE;
}

/**
 * Read-only QA audit of promoted `body_landmark` annotations.
 * Does not mutate annotations, measurements, or Body Evidence state.
 *
 * @param {Array<{ id?: number, name?: string, type?: string, point?: { x: number, y: number, z: number } }>|null|undefined} [annotations]
 * @returns {{
 *   total: number,
 *   missingCoreAnchors: string[],
 *   duplicateNames: string[],
 *   outOfBounds: Array<{ id: number|null, name: string, normalizedName: string, point: { x: number, y: number, z: number }|null }>,
 *   frontSurfaceZWarnings: Array<{ id: number|null, name: string, normalizedName: string, z: number|null, expectedZ: number }>,
 *   status: 'Ready'|'Needs review',
 *   expectedFrontSurfaceZ: number,
 * }}
 */
export function buildBodyAnchorAudit(annotations = getAnnotations()) {
  const anchors = (Array.isArray(annotations) ? annotations : [])
    .filter((entry) => entry?.type === PROMOTED_BODY_LANDMARK_TYPE);

  const countsByNormalizedName = new Map();
  const outOfBounds = [];
  const frontSurfaceZWarnings = [];

  for (const entry of anchors) {
    const name = typeof entry.name === 'string' ? entry.name : '';
    const normalizedName = normalizeLandmarkName(name) || '(unnamed)';
    countsByNormalizedName.set(
      normalizedName,
      (countsByNormalizedName.get(normalizedName) ?? 0) + 1,
    );

    const point = entry.point ?? null;
    if (!isWithinRoomBounds(point)) {
      outOfBounds.push({
        id: Number.isFinite(entry.id) ? entry.id : null,
        name,
        normalizedName,
        point: point
          ? {
            x: point.x,
            y: point.y,
            z: point.z,
          }
          : null,
      });
    }

    if (!isOnFrontSurface(point)) {
      frontSurfaceZWarnings.push({
        id: Number.isFinite(entry.id) ? entry.id : null,
        name,
        normalizedName,
        z: isFiniteCoord(point?.z) ? point.z : null,
        expectedZ: FRONT_SURFACE_DEPTH_CM,
      });
    }
  }

  const presentCoreNames = new Set(
    [...countsByNormalizedName.keys()].filter((name) => isCoreFrontBodyAnchor(name)),
  );
  const missingCoreAnchors = CORE_FRONT_BODY_ANCHORS.filter(
    (name) => !presentCoreNames.has(name),
  );
  const duplicateNames = [...countsByNormalizedName.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => name)
    .sort();

  const needsReview = missingCoreAnchors.length > 0
    || duplicateNames.length > 0
    || outOfBounds.length > 0
    || frontSurfaceZWarnings.length > 0;

  return {
    total: anchors.length,
    missingCoreAnchors,
    duplicateNames,
    outOfBounds,
    frontSurfaceZWarnings,
    status: needsReview ? 'Needs review' : 'Ready',
    expectedFrontSurfaceZ: FRONT_SURFACE_DEPTH_CM,
  };
}

/**
 * Manually promote the currently selected front Body Evidence landmark
 * (core 13 or secondary candidate) into a normal saved annotation
 * (type `body_landmark`).
 *
 * - Uses Front Surface mapped X/Y and shared front-surface Z.
 * - Does not alter Body Evidence sources/QA/selection/overlay state.
 * - Does not auto-promote; caller must invoke explicitly.
 * - Does not add secondary landmarks to readiness or preview-line rows.
 *
 * @returns {{ ok: boolean, alreadyPromoted?: boolean, message: string }}
 */
export function promoteSelectedBodyEvidenceLandmark() {
  const selected = getSelectedBodyEvidenceLandmark();
  if (!selected) {
    return {
      ok: false,
      alreadyPromoted: false,
      message: 'Select a body landmark first.',
    };
  }

  // Side Evidence is inspect-only in this phase — never promote from Side.
  if (selected.view !== 'front') {
    return {
      ok: false,
      alreadyPromoted: false,
      message: 'Only Front body landmark candidates can be promoted.',
    };
  }

  const name = String(selected.name ?? '').trim();
  if (!name) {
    return {
      ok: false,
      alreadyPromoted: false,
      message: 'Annotation name is required.',
    };
  }

  // Defense in depth: only core 13 or secondary named body candidates.
  if (!isPromotableBodyEvidenceLandmark(name)) {
    return {
      ok: false,
      alreadyPromoted: false,
      message: 'Only core or secondary body landmark candidates can be promoted.',
    };
  }

  if (isBodyLandmarkPromoted(name)) {
    return {
      ok: false,
      alreadyPromoted: true,
      message: 'Already promoted.',
    };
  }

  const position = frontSurfaceTo3d({
    x: selected.spaceX,
    y: selected.spaceY,
  });

  const result = addAnnotationFromPoint({
    name,
    type: PROMOTED_BODY_LANDMARK_TYPE,
    position,
  });

  if (!result.ok) {
    if (result.duplicate) {
      return {
        ok: false,
        alreadyPromoted: true,
        message: 'Already promoted.',
      };
    }
    return {
      ok: false,
      alreadyPromoted: false,
      message: result.message ?? 'Promotion failed.',
    };
  }

  return {
    ok: true,
    alreadyPromoted: false,
    message: 'Promoted to annotation.',
  };
}

/**
 * Batch promotes all currently eligible Front Core landmarks in one action.
 *
 * Scope:
 * - Only Front landmarks
 * - Only Core landmarks (CORE_FRONT_BODY_ANCHORS)
 * - Only eligible / ready landmarks with valid mapped coordinates
 * - Skips already promoted landmarks
 * - Avoids duplicates
 * - Does not affect Side landmarks or Secondary landmarks
 *
 * @returns {{
 *   ok: boolean,
 *   promotedCount: number,
 *   alreadyPromotedCount: number,
 *   unavailableCount: number,
 *   totalCoreCount: number,
 *   message: string,
 * }}
 */
export function promoteAllFrontCoreLandmarks() {
  const frontCoreLandmarks = getRenderableFrontBodyLandmarks();
  const totalCoreCount = CORE_FRONT_BODY_ANCHORS.length;

  let promotedCount = 0;
  let alreadyPromotedCount = 0;
  let unavailableCount = 0;

  const availableByName = new Map();
  for (const lm of frontCoreLandmarks) {
    if (lm?.name && isCoreFrontBodyAnchor(lm.name)) {
      availableByName.set(lm.name, lm);
    }
  }

  for (const coreName of CORE_FRONT_BODY_ANCHORS) {
    const lm = availableByName.get(coreName);
    if (!lm) {
      unavailableCount++;
      continue;
    }

    const spaceX = typeof lm.spaceX === 'number'
      ? lm.spaceX
      : (Number.isFinite(lm.imageX) ? lm.imageX / BODY_EVIDENCE_V0_SCALE.pixelsPerCm : null);
    const spaceY = typeof lm.spaceY === 'number'
      ? lm.spaceY
      : (Number.isFinite(lm.imageY) ? (BODY_EVIDENCE_V0_SCALE.canvasSize - lm.imageY) / BODY_EVIDENCE_V0_SCALE.pixelsPerCm : null);

    if (spaceX === null || spaceY === null || !Number.isFinite(spaceX) || !Number.isFinite(spaceY)) {
      unavailableCount++;
      continue;
    }

    if (isBodyLandmarkPromoted(coreName)) {
      alreadyPromotedCount++;
      continue;
    }

    const position = frontSurfaceTo3d({
      x: spaceX,
      y: spaceY,
    });

    const result = addAnnotationFromPoint({
      name: coreName,
      type: PROMOTED_BODY_LANDMARK_TYPE,
      position,
    });

    if (result.ok) {
      promotedCount++;
    } else if (result.duplicate) {
      alreadyPromotedCount++;
    } else {
      unavailableCount++;
    }
  }

  const ok = promotedCount > 0;
  const parts = [];
  parts.push(`Promoted ${promotedCount}`);
  if (unavailableCount > 0) {
    parts.push(`Skipped ${unavailableCount} unavailable`);
  }
  if (alreadyPromotedCount > 0) {
    parts.push(`${alreadyPromotedCount} already promoted`);
  }
  const message = parts.join(' • ');

  return {
    ok,
    promotedCount,
    alreadyPromotedCount,
    unavailableCount,
    totalCoreCount,
    message,
  };
}

function clearBodyEvidenceSelectionSilent() {
  selectedBodyEvidenceLandmark = null;
  selectedSideEvidenceLandmark = null;
  selectedFrontSegClassId = null;
  selectedSideSegClassId = null;
}

function hasBodyEvidencePoseOrSegSource() {
  return Boolean(
    sources.frontPose
    || sources.sidePose
    || sources.frontSeg
    || sources.sideSeg,
  );
}

export function hasSidePoseSource() {
  return Boolean(sources.sidePose);
}

/** Setting a new package invalidates the previous analysis, overlay, and selection. */
function resetAnalysisForNewSource() {
  qaResult = null;
  denseEvidenceQa = null;
  currentAnalysisSessionId += 1;
  lastError = null;
  overlayVisible = false;
  secondaryCandidatesVisible = false;
  sideCoreOverlayVisible = false;
  sideSecondaryOverlayVisible = false;
  clearBodyEvidenceSelectionSilent();
  notifyBodyEvidenceChange();
}

/**
 * Sets the active Full Body Evidence Package in runtime state.
 * @param {object|null} pkg
 */
export function setBodyEvidencePackage(pkg) {
  currentPackage = pkg;
  if (!pkg) {
    sources = emptySources();
    resetAnalysisForNewSource();
    return;
  }
  sources = {
    frontPose: pkg.front?.pose ? pkg.front.pose : null,
    sidePose: pkg.side?.pose ? pkg.side.pose : null,
    frontSeg: pkg.front?.segmentation ? pkg.front.segmentation : null,
    sideSeg: pkg.side?.segmentation ? pkg.side.segmentation : null,
  };
  resetAnalysisForNewSource();
}

export function getBodyEvidencePackage() {
  return currentPackage;
}

export function getFrontPointmapEvidence() {
  return currentPackage?.front?.pointmap ?? null;
}

export function getSidePointmapEvidence() {
  return currentPackage?.side?.pointmap ?? null;
}

export function getFrontNormalEvidence() {
  return currentPackage?.front?.normals ?? null;
}

export function getSideNormalEvidence() {
  return currentPackage?.side?.normals ?? null;
}

export function getFrontImageEvidence() {
  return currentPackage?.front?.image ?? null;
}

export function getSideImageEvidence() {
  return currentPackage?.side?.image ?? null;
}

/**
 * Returns the active derived Dense Evidence QA runtime state.
 * @returns {{
 *   front: { pointmap: object|null, normals: object|null, crossModal: object|null },
 *   side: { pointmap: object|null, normals: object|null, crossModal: object|null },
 * }|null}
 */
export function getDenseEvidenceQa() {
  return denseEvidenceQa;
}

/**
 * Returns the Front derived Dense Evidence QA runtime state.
 * @returns {{ pointmap: object|null, normals: object|null, crossModal: object|null }|null}
 */
export function getFrontDenseEvidenceQa() {
  return denseEvidenceQa?.front ?? null;
}

/**
 * Returns the Side derived Dense Evidence QA runtime state.
 * @returns {{ pointmap: object|null, normals: object|null, crossModal: object|null }|null}
 */
export function getSideDenseEvidenceQa() {
  return denseEvidenceQa?.side ?? null;
}

/**
 * Access Front Anatomical Region Evidence report from current runtime state.
 * @returns {object|null}
 */
export function getFrontAnatomicalRegionEvidence() {
  const seg = qaResult?.views?.front?.segmentation ?? currentPackage?.front?.segmentation;
  if (!seg) {
    return null;
  }
  const dense = denseEvidenceQa?.front;
  const annotations = getAnnotations();
  return buildAnatomicalRegionEvidence(seg, {
    view: 'front',
    denseQa: dense,
    crossModalQa: dense?.crossModal,
    pointmap: currentPackage?.front?.pointmap,
    normals: currentPackage?.front?.normals,
    widthPx: seg.widthPx,
    heightPx: seg.heightPx,
    annotations,
  });
}

/**
 * Access Side Anatomical Region Evidence report from current runtime state.
 * @returns {object|null}
 */
export function getSideAnatomicalRegionEvidence() {
  const seg = qaResult?.views?.side?.segmentation ?? currentPackage?.side?.segmentation;
  if (!seg) {
    return null;
  }
  const dense = denseEvidenceQa?.side;
  return buildAnatomicalRegionEvidence(seg, {
    view: 'side',
    denseQa: dense,
    crossModalQa: dense?.crossModal,
    pointmap: currentPackage?.side?.pointmap,
    normals: currentPackage?.side?.normals,
    widthPx: seg.widthPx,
    heightPx: seg.heightPx,
  });
}

/**
 * Access combined Front and Side Anatomical Region Evidence reports.
 * @returns {{ front: object|null, side: object|null }|null}
 */
export function getAnatomicalRegionEvidence() {
  const front = getFrontAnatomicalRegionEvidence();
  const side = getSideAnatomicalRegionEvidence();
  if (!front && !side) {
    return null;
  }
  return { front, side };
}

/**
 * Samples the active Front segmentation raster at a canonical Y height (cm)
 * for a target set of segmentation class IDs.
 *
 * Grounded in canonical fixed 200 cm metrology domain.
 *
 * @param {{
 *   yCm: number,
 *   targetClassIds: Iterable<number>,
 * }} options
 * @returns {object|null}
 */
export function getFrontHorizontalRasterSlice({ yCm, targetClassIds } = {}) {
  const raster = getFrontSegmentationRaster();
  const seg = qaResult?.views?.front?.segmentation ?? currentPackage?.front?.segmentation;
  if (!raster || !seg?.widthPx || !seg?.heightPx) {
    return null;
  }
  return sampleFrontHorizontalRasterSlice(raster, {
    widthPx: seg.widthPx,
    heightPx: seg.heightPx,
    yCm,
    targetClassIds,
  });
}

/**
 * Samples the active Side segmentation raster at a canonical Y height (cm)
 * for a target set of segmentation class IDs.
 *
 * Grounded in canonical fixed 200 cm metrology domain.
 *
 * @param {{
 *   yCm: number,
 *   targetClassIds: Iterable<number>,
 * }} options
 * @returns {object|null}
 */
export function getSideHorizontalRasterSlice({ yCm, targetClassIds } = {}) {
  const raster = getSideSegmentationRaster();
  const seg = qaResult?.views?.side?.segmentation ?? currentPackage?.side?.segmentation;
  if (!raster || !seg?.widthPx || !seg?.heightPx) {
    return null;
  }
  return sampleSideHorizontalRasterSlice(raster, {
    widthPx: seg.widthPx,
    heightPx: seg.heightPx,
    yCm,
    targetClassIds,
  });
}

/**
 * Evaluates a single Front transverse width observation from active runtime state.
 *
 * @param {{ id: string, annotations?: Array<object>|null }} options
 * @returns {object|null}
 */
export function getFrontTransverseWidth({ id, annotations = null } = {}) {
  if (!id) return null;
  const def = SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0[id];
  if (!def) return null;

  const resolvedAnnotations = annotations ?? (typeof getAnnotations === 'function' ? getAnnotations() : []);
  const levelsReport = computeAnatomicalLevels(resolvedAnnotations);
  const level = levelsReport?.levels?.find((l) => l.id === def.sourceLevel) ?? null;

  if (!level || level.status !== 'ready' || typeof level.yCm !== 'number') {
    return interpretFrontTransverseWidth(null, { definition: def, level });
  }

  const slice = getFrontHorizontalRasterSlice({
    yCm: level.yCm,
    targetClassIds: def.targetClassIds,
  });

  return interpretFrontTransverseWidth(slice, { definition: def, level });
}

/**
 * Evaluates all supported Front transverse width observations from active runtime state.
 *
 * @param {{ annotations?: Array<object>|null }} [options]
 * @returns {{
 *   contract: 'front-transverse-widths-report-v0',
 *   version: string,
 *   view: 'front',
 *   widths: Array<object>,
 * }|null}
 */
export function getFrontTransverseWidths({ annotations = null } = {}) {
  const raster = getFrontSegmentationRaster();
  if (!raster) return null;

  const definitions = Object.values(SUPPORTED_FRONT_TRANSVERSE_WIDTH_DEFINITIONS_V0);
  const widths = definitions.map((def) => getFrontTransverseWidth({ id: def.id, annotations }));

  return {
    contract: 'front-transverse-widths-report-v0',
    version: FRONT_TRANSVERSE_WIDTH_CONTRACT_VERSION,
    view: 'front',
    widths,
  };
}

/**
 * Evaluates a single Side profile span observation from active runtime state.
 *
 * @param {{ id: string, annotations?: Array<object>|null }} options
 * @returns {object|null}
 */
export function getSideProfileSpan({ id, annotations = null } = {}) {
  if (!id) return null;
  const def = SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0[id];
  if (!def) return null;

  const resolvedAnnotations = annotations ?? (typeof getAnnotations === 'function' ? getAnnotations() : []);
  const levelsReport = computeAnatomicalLevels(resolvedAnnotations);
  const level = levelsReport?.levels?.find((l) => l.id === def.sourceLevel) ?? null;

  if (!level || level.status !== 'ready' || typeof level.yCm !== 'number') {
    return interpretSideProfileSpan(null, { definition: def, level });
  }

  const slice = getSideHorizontalRasterSlice({
    yCm: level.yCm,
    targetClassIds: def.targetClassIds,
  });

  return interpretSideProfileSpan(slice, { definition: def, level });
}

/**
 * Evaluates all supported Side profile span observations from active runtime state.
 *
 * @param {{ annotations?: Array<object>|null }} [options]
 * @returns {{
 *   contract: 'side-profile-spans-report-v0',
 *   version: string,
 *   view: 'side',
 *   spans: Array<object>,
 * }|null}
 */
export function getSideProfileSpans({ annotations = null } = {}) {
  const raster = getSideSegmentationRaster();
  if (!raster) return null;

  const definitions = Object.values(SUPPORTED_SIDE_PROFILE_SPAN_DEFINITIONS_V0);
  const spans = definitions.map((def) => getSideProfileSpan({ id: def.id, annotations }));

  return {
    contract: 'side-profile-spans-report-v0',
    version: SIDE_PROFILE_SPAN_CONTRACT_VERSION,
    view: 'side',
    spans,
  };
}

/**
 * Evaluates a single Cross-view measurement correspondence observation from active runtime state.
 *
 * @param {{ id: string, annotations?: Array<object>|null }} options
 * @returns {object|null}
 */
export function getCrossViewMeasurementCorrespondence({ id, annotations = null } = {}) {
  if (!id) return null;
  const def = SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0[id];
  if (!def) return null;

  const frontObservation = getFrontTransverseWidth({ id: def.frontDefinitionId, annotations });
  const sideObservation = getSideProfileSpan({ id: def.sideDefinitionId, annotations });

  return buildCrossViewMeasurementCorrespondence(frontObservation, sideObservation, { definition: def });
}

/**
 * Evaluates all supported Cross-view measurement correspondences from active runtime state.
 *
 * @param {{ annotations?: Array<object>|null }} [options]
 * @returns {{
 *   contract: 'cross-view-measurement-correspondences-report-v0',
 *   version: string,
 *   correspondences: Array<object>,
 * }|null}
 */
export function getCrossViewMeasurementCorrespondences({ annotations = null } = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster) return null;

  const definitions = Object.values(SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0);
  const correspondences = definitions.map((def) =>
    getCrossViewMeasurementCorrespondence({ id: def.id, annotations })
  );

  return {
    contract: 'cross-view-measurement-correspondences-report-v0',
    version: CROSS_VIEW_MEASUREMENT_CORRESPONDENCE_CONTRACT_VERSION,
    correspondences,
  };
}

/**
 * Evaluates pure Cross-view comparability QA for a single correspondence from active runtime state.
 *
 * @param {{ id: string, annotations?: Array<object>|null }} options
 * @returns {object|null}
 */
export function getCrossViewComparabilityQa({ id, annotations = null } = {}) {
  if (!id) return null;
  const correspondence = getCrossViewMeasurementCorrespondence({ id, annotations });
  return evaluateCrossViewComparabilityQa(correspondence, { id });
}

/**
 * Evaluates pure Cross-view comparability QA for all supported correspondences from active runtime state.
 *
 * @param {{ annotations?: Array<object>|null }} [options]
 * @returns {{
 *   contract: 'cross-view-comparability-qa-report-v0',
 *   version: string,
 *   summary: {
 *     total: number,
 *     passCount: number,
 *     warningCount: number,
 *     failCount: number,
 *     unavailableCount: number,
 *   },
 *   results: Array<object>,
 * }|null}
 */
export function getCrossViewComparabilityQaReport({ annotations = null } = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster) return null;

  const definitions = Object.values(SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0);
  const results = definitions.map((def) =>
    getCrossViewComparabilityQa({ id: def.id, annotations })
  );

  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;
  let unavailableCount = 0;

  for (const res of results) {
    if (res?.status === 'pass') passCount += 1;
    else if (res?.status === 'warning') warningCount += 1;
    else if (res?.status === 'fail') failCount += 1;
    else unavailableCount += 1;
  }

  return {
    contract: 'cross-view-comparability-qa-report-v0',
    version: CROSS_VIEW_COMPARABILITY_QA_CONTRACT_VERSION,
    summary: {
      total: results.length,
      passCount,
      warningCount,
      failCount,
      unavailableCount,
    },
    results,
  };
}

/**
 * Evaluates pure Metric Calibration Provenance for Front or Side view from active runtime package.
 *
 * @param {{ view?: 'front'|'side'|string }} [options]
 * @returns {object|null}
 */
export function getMetricCalibrationProvenance({ view = 'front' } = {}) {
  if (!currentPackage) return null;
  const packageCalib = currentPackage.calibration ?? null;
  const viewCalib = currentPackage[view]?.calibration ?? null;
  const rasterDims = currentPackage[view]?.qa?.rasterDimensions
    ?? (view === 'front'
      ? (getFrontSegmentationRaster() ? { widthPx: getFrontSegmentationRaster().widthPx, heightPx: getFrontSegmentationRaster().heightPx } : null)
      : (getSideSegmentationRaster() ? { widthPx: getSideSegmentationRaster().widthPx, heightPx: getSideSegmentationRaster().heightPx } : null));

  return evaluateMetricCalibrationProvenance(packageCalib, viewCalib, rasterDims, { view });
}

/**
 * Evaluates pure Physical Measurement Semantics for a single Front or Side measurement.
 *
 * @param {{ id: string, annotations?: Array<object>|null, physicalEvidencePaths?: Array<object>|object|null }} options
 * @returns {object|null}
 */
export function getPhysicalMeasurementSemantics({ id, annotations = null, physicalEvidencePaths = null } = {}) {
  if (!id) return null;
  const def = SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[id];
  if (!def) return null;

  let observation = null;
  if (def.view === 'front') {
    observation = getFrontTransverseWidth({ id: def.id, annotations })
      ?? getFrontTransverseWidth({ id: 'torso_width_at_' + def.sourceLevel + '_level', annotations });
  } else {
    observation = getSideProfileSpan({ id: def.id, annotations })
      ?? getSideProfileSpan({ id: 'torso_profile_span_at_' + def.sourceLevel + '_level', annotations });
  }

  const calibrationProvenance = getMetricCalibrationProvenance({ view: def.view });
  const viewCalibration = currentPackage?.[def.view]?.calibration ?? null;

  return evaluatePhysicalMeasurementSemantics(observation, {
    calibrationProvenance,
    viewCalibration,
    physicalEvidencePaths,
    definition: def,
  });
}

/**
 * Evaluates pure Physical Measurement Semantics for all canonical Front and Side measurements.
 *
 * @param {{ annotations?: Array<object>|null, physicalEvidencePaths?: Array<object>|object|null }} [options]
 * @returns {{
 *   contract: 'physical-measurement-semantics-report-v0',
 *   version: string,
 *   summary: {
 *     total: number,
 *     validatedCount: number,
 *     projectedMetricOnlyCount: number,
 *     unvalidatedCount: number,
 *     invalidCount: number,
 *     unavailableCount: number,
 *   },
 *   results: Array<object>,
 * }|null}
 */
export function getPhysicalMeasurementSemanticsReport({ annotations = null, physicalEvidencePaths = null } = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster && !currentPackage) return null;

  const canonicalIds = [
    'torso_transverse_width_at_shoulder_level',
    'torso_transverse_width_at_hip_level',
    'torso_profile_span_at_shoulder_level',
    'torso_profile_span_at_hip_level',
  ];

  const results = canonicalIds.map((id) =>
    getPhysicalMeasurementSemantics({ id, annotations, physicalEvidencePaths })
  );

  let validatedCount = 0;
  let projectedMetricOnlyCount = 0;
  let unvalidatedCount = 0;
  let invalidCount = 0;
  let unavailableCount = 0;

  for (const res of results) {
    if (res?.status === 'validated') validatedCount += 1;
    else if (res?.status === 'projected_metric_only') projectedMetricOnlyCount += 1;
    else if (res?.status === 'invalid') invalidCount += 1;
    else if (res?.status === 'unvalidated') unvalidatedCount += 1;
    else unavailableCount += 1;
  }

  return {
    contract: 'physical-measurement-semantics-report-v0',
    version: PHYSICAL_MEASUREMENT_SEMANTICS_CONTRACT_VERSION,
    summary: {
      total: results.length,
      validatedCount,
      projectedMetricOnlyCount,
      unvalidatedCount,
      invalidCount,
      unavailableCount,
    },
    results,
  };
}

/**
 * Evaluates a single Direct Body Measurement from active runtime state.
 *
 * @param {{ id: string, annotations?: Array<object>|null }} options
 * @returns {object|null}
 */
export function getDirectBodyMeasurement({ id, annotations = null } = {}) {
  if (!id) return null;
  const def = SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0[id];
  if (!def) return null;

  const resolvedAnnotations = annotations ?? (typeof getAnnotations === 'function' ? getAnnotations() : []);
  const levelsReport = computeAnatomicalLevels(resolvedAnnotations);
  const metricCalibrationFront = getMetricCalibrationProvenance({ view: 'front' });

  return evaluateDirectBodyMeasurement(id, {
    annotations: resolvedAnnotations,
    levelsReport,
    metricCalibrationFront,
  });
}

/**
 * Evaluates all supported Direct Body Measurements from active runtime state.
 *
 * @param {{ annotations?: Array<object>|null }} [options]
 * @returns {{
 *   contract: 'direct-body-measurements-report-v0',
 *   version: string,
 *   view: 'front',
 *   summary: { total: number, valid: number, unavailable: number, invalid: number },
 *   measurements: Array<object>,
 *   measurementsById: Record<string, object>,
 *   byGroup: Record<string, Array<object>>,
 * }|null}
 */
export function getDirectBodyMeasurements({ annotations = null } = {}) {
  const resolvedAnnotations = annotations ?? (typeof getAnnotations === 'function' ? getAnnotations() : []);
  const levelsReport = computeAnatomicalLevels(resolvedAnnotations);
  const metricCalibrationFront = getMetricCalibrationProvenance({ view: 'front' });

  return evaluateDirectBodyMeasurements({
    annotations: resolvedAnnotations,
    levelsReport,
    metricCalibrationFront,
  });
}

/**
 * Alias for getDirectBodyMeasurements for uniform reporting convention.
 */
export function getDirectBodyMeasurementsReport(options = {}) {
  return getDirectBodyMeasurements(options);
}

/**
 * Evaluates pure deterministic view and pose semantics for a single view from active runtime state.
 *
 * @param {{
 *   view?: 'front'|'side'|string,
 *   authoritativePhysicalOrientationResult?: object|null,
 * }} [options]
 * @returns {object|null} ViewPoseValidationResult
 */
export function getViewPoseSemantics({
  view = 'front',
  authoritativePhysicalOrientationResult = null,
} = {}) {
  if (!currentPackage) return null;
  const targetView = (view || 'front').toLowerCase().trim();
  const viewPkg = targetView === 'front' ? currentPackage.front : currentPackage.side;
  return evaluateViewPoseSemantics(viewPkg, {
    view: targetView,
    aposeEvidence: currentPackage.rawSources?.aposeResult ?? null,
    alignEvidence: currentPackage.rawSources?.alignResult ?? null,
    authoritativePhysicalOrientationResult,
  });
}

/**
 * Evaluates pure deterministic view and pose semantics report across Front and Side from active runtime state.
 *
 * @param {{
 *   authoritativePhysicalOrientationResult?: object|null,
 * }} [options]
 * @returns {object|null} ViewPoseSemanticsReport
 */
export function getViewPoseSemanticsReport({
  authoritativePhysicalOrientationResult = null,
} = {}) {
  if (!currentPackage) return null;
  return evaluateViewPoseSemanticsReport(currentPackage, {
    authoritativePhysicalOrientationResult,
  });
}

/**
 * Evaluates pure deterministic clothing and body-surface semantics for a single measurement from active state.
 *
 * @param {{
 *   id: string,
 *   annotations?: Array<object>|null,
 *   garmentEvaluationResult?: object|null,
 *   bodySurfaceAuthorizationResult?: object|null,
 * }} options
 * @returns {object|null} ClothingBodySurfaceValidationResult
 */
export function getClothingBodySurfaceSemantics({
  id,
  annotations = null,
  garmentEvaluationResult = null,
  bodySurfaceAuthorizationResult = null,
} = {}) {
  if (!id) return null;
  const def = SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[id];
  if (!def) return null;

  let observation = null;
  if (def.view === 'front') {
    observation = getFrontTransverseWidth({ id: def.id, annotations })
      ?? getFrontTransverseWidth({ id: 'torso_width_at_' + def.sourceLevel + '_level', annotations });
  } else {
    observation = getSideProfileSpan({ id: def.id, annotations })
      ?? getSideProfileSpan({ id: 'torso_profile_span_at_' + def.sourceLevel + '_level', annotations });
  }

  return evaluateClothingBodySurfaceSemantics(observation, {
    garmentEvaluationResult,
    bodySurfaceAuthorizationResult,
    measurementId: def.id,
    view: def.view,
  });
}

/**
 * Evaluates 4.5G authoritative physical evidence semantics for a single view
 * from the currently loaded package and derived Dense Evidence QA.
 *
 * @param {{
 *   view?: 'front'|'side'|string,
 *   clothingBodySurfaceResult?: object|null,
 *   projectedMetricResult?: object|null,
 * }} [options]
 * @returns {object|null}
 */
export function getAuthoritativePhysicalEvidenceSemantics({
  view = 'front',
  clothingBodySurfaceResult = null,
  projectedMetricResult = null,
} = {}) {
  if (!currentPackage) return null;
  const targetView = (view || 'front').toLowerCase().trim();
  const viewPkg = targetView === 'front' ? currentPackage.front : currentPackage.side;
  const denseQa = targetView === 'front' ? denseEvidenceQa?.front : denseEvidenceQa?.side;

  let resolvedProjected = projectedMetricResult;
  if (resolvedProjected == null) {
    const canonicalId = targetView === 'front'
      ? 'torso_transverse_width_at_shoulder_level'
      : 'torso_profile_span_at_shoulder_level';
    resolvedProjected = getPhysicalMeasurementSemantics({ id: canonicalId }) ?? null;
  }

  let resolvedClothing = clothingBodySurfaceResult;
  if (resolvedClothing == null) {
    const clothingId = targetView === 'front'
      ? 'torso_transverse_width_at_shoulder_level'
      : 'torso_profile_span_at_shoulder_level';
    resolvedClothing = getClothingBodySurfaceSemantics({ id: clothingId }) ?? null;
  }

  return evaluateAuthoritativePhysicalEvidenceSemantics({
    view: targetView,
    pointmap: viewPkg?.pointmap ?? null,
    denseQa,
    clothingBodySurfaceResult: resolvedClothing,
    projectedMetricResult: resolvedProjected,
  });
}

/**
 * Evaluates 4.5G authoritative physical evidence semantics for Front and Side.
 *
 * @param {{
 *   clothingBodySurfaceResults?: { front?: object|null, side?: object|null },
 *   projectedMetricResults?: { front?: object|null, side?: object|null },
 * }} [options]
 * @returns {object|null}
 */
export function getAuthoritativePhysicalEvidenceSemanticsReport({
  clothingBodySurfaceResults = {},
  projectedMetricResults = {},
} = {}) {
  if (!currentPackage) return null;
  return evaluateAuthoritativePhysicalEvidenceSemanticsReport({
    front: {
      pointmap: currentPackage.front?.pointmap ?? null,
      denseQa: denseEvidenceQa?.front ?? null,
      clothingBodySurfaceResult: clothingBodySurfaceResults.front ?? null,
      projectedMetricResult: projectedMetricResults.front ?? null,
    },
    side: {
      pointmap: currentPackage.side?.pointmap ?? null,
      denseQa: denseEvidenceQa?.side ?? null,
      clothingBodySurfaceResult: clothingBodySurfaceResults.side ?? null,
      projectedMetricResult: projectedMetricResults.side ?? null,
    },
  });
}

/**
 * Evaluates clothing and body-surface semantics report across all canonical measurements.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   garmentEvaluationResults?: Map|object,
 *   bodySurfaceAuthorizationResults?: Map|object,
 * }} [options]
 * @returns {object|null}
 */
export function getClothingBodySurfaceSemanticsReport({
  annotations = null,
  garmentEvaluationResults = {},
  bodySurfaceAuthorizationResults = {},
} = {}) {
  if (!currentPackage) return null;
  const canonicalIds = [
    'torso_transverse_width_at_shoulder_level',
    'torso_transverse_width_at_hip_level',
    'torso_profile_span_at_shoulder_level',
    'torso_profile_span_at_hip_level',
  ];
  const observations = [];
  for (const defId of canonicalIds) {
    const def = SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[defId];
    if (!def) continue;
    let obs = null;
    if (def.view === 'front') {
      obs = getFrontTransverseWidth({ id: def.id, annotations })
        ?? getFrontTransverseWidth({ id: 'torso_width_at_' + def.sourceLevel + '_level', annotations });
    } else {
      obs = getSideProfileSpan({ id: def.id, annotations })
        ?? getSideProfileSpan({ id: 'torso_profile_span_at_' + def.sourceLevel + '_level', annotations });
    }
    if (obs) observations.push(obs);
  }

  return evaluateClothingBodySurfaceSemanticsReport({
    observations,
    garmentEvaluationResults,
    bodySurfaceAuthorizationResults,
  });
}

/**
 * Evaluates pure Physical Measurement Eligibility for a single Front or Side measurement from active state.
 *
 * @param {{
 *   id: string,
 *   annotations?: Array<object>|null,
 *   viewPoseValidationResult?: object|null,
 *   clothingAuthorizationResult?: object|null,
 *   authoritativePhysicalEvidenceResults?: Array<object>|object|null,
 * }} options
 * @returns {object|null}
 */
export function getPhysicalMeasurementEligibility({
  id,
  annotations = null,
  viewPoseValidationResult = null,
  clothingAuthorizationResult = null,
  authoritativePhysicalEvidenceResults = null,
} = {}) {
  if (!id) return null;
  const def = SUPPORTED_PHYSICAL_MEASUREMENT_DEFINITIONS_V0[id];
  if (!def) return null;

  let observation = null;
  if (def.view === 'front') {
    observation = getFrontTransverseWidth({ id: def.id, annotations })
      ?? getFrontTransverseWidth({ id: 'torso_width_at_' + def.sourceLevel + '_level', annotations });
  } else {
    observation = getSideProfileSpan({ id: def.id, annotations })
      ?? getSideProfileSpan({ id: 'torso_profile_span_at_' + def.sourceLevel + '_level', annotations });
  }

  const metricCalibrationResult = getMetricCalibrationProvenance({ view: def.view });

  const resolvedPhysicalEvidence = authoritativePhysicalEvidenceResults !== null
    ? authoritativePhysicalEvidenceResults
    : getAuthoritativePhysicalEvidenceSemantics({ view: def.view });

  const physicalSemanticsResult = getPhysicalMeasurementSemantics({
    id: def.id,
    annotations,
    physicalEvidencePaths: resolvedPhysicalEvidence,
  });

  const resolvedViewPoseResult = viewPoseValidationResult !== null
    ? viewPoseValidationResult
    : getViewPoseSemantics({ view: def.view });

  const resolvedClothingResult = clothingAuthorizationResult !== null
    ? clothingAuthorizationResult
    : getClothingBodySurfaceSemantics({ id: def.id, annotations });

  return evaluatePhysicalMeasurementEligibility(observation, {
    metricCalibrationResult,
    physicalSemanticsResult,
    viewPoseValidationResult: resolvedViewPoseResult,
    clothingAuthorizationResult: resolvedClothingResult,
    authoritativePhysicalEvidenceResults: resolvedPhysicalEvidence,
    definition: def,
  });
}

/**
 * Evaluates pure Physical Measurement Eligibility for all canonical Front and Side measurements.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   viewPoseValidationResult?: object|null,
 *   clothingAuthorizationResult?: object|null,
 *   authoritativePhysicalEvidenceResults?: Array<object>|object|null,
 * }} [options]
 * @returns {{
 *   contract: 'physical-measurement-eligibility-report-v0',
 *   version: string,
 *   summary: {
 *     total: number,
 *     eligibleCount: number,
 *     blockedByClothingCount: number,
 *     metricProjectedOnlyCount: number,
 *     unvalidatedCount: number,
 *     invalidCount: number,
 *     unavailableCount: number,
 *   },
 *   results: Array<object>,
 * }|null}
 */
export function getPhysicalMeasurementEligibilityReport({
  annotations = null,
  viewPoseValidationResult = null,
  clothingAuthorizationResult = null,
  authoritativePhysicalEvidenceResults = null,
} = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster && !currentPackage) return null;

  const canonicalIds = [
    'torso_transverse_width_at_shoulder_level',
    'torso_transverse_width_at_hip_level',
    'torso_profile_span_at_shoulder_level',
    'torso_profile_span_at_hip_level',
  ];

  const results = canonicalIds.map((id) =>
    getPhysicalMeasurementEligibility({
      id,
      annotations,
      viewPoseValidationResult,
      clothingAuthorizationResult,
      authoritativePhysicalEvidenceResults,
    })
  );

  let eligibleCount = 0;
  let blockedByClothingCount = 0;
  let metricProjectedOnlyCount = 0;
  let unvalidatedCount = 0;
  let invalidCount = 0;
  let unavailableCount = 0;

  for (const res of results) {
    if (res?.status === 'eligible') eligibleCount += 1;
    else if (res?.status === 'blocked_by_clothing') blockedByClothingCount += 1;
    else if (res?.status === 'metric_projected_only') metricProjectedOnlyCount += 1;
    else if (res?.status === 'invalid') invalidCount += 1;
    else if (res?.status === 'unvalidated') unvalidatedCount += 1;
    else unavailableCount += 1;
  }

  return {
    contract: 'physical-measurement-eligibility-report-v0',
    version: PHYSICAL_MEASUREMENT_ELIGIBILITY_CONTRACT_VERSION,
    summary: {
      total: results.length,
      eligibleCount,
      blockedByClothingCount,
      metricProjectedOnlyCount,
      unvalidatedCount,
      invalidCount,
      unavailableCount,
    },
    results,
  };
}

/**
 * Evaluates pure Paired Cross-View Physical Eligibility for a correspondence from active runtime state.
 *
 * @param {{
 *   id: string,
 *   annotations?: Array<object>|null,
 *   viewPoseValidationResult?: object|null,
 *   clothingAuthorizationResult?: object|null,
 *   authoritativePhysicalEvidenceResults?: Array<object>|object|null,
 * }} options
 * @returns {object|null}
 */
export function getPairedCrossViewEligibility({
  id,
  annotations = null,
  viewPoseValidationResult = null,
  clothingAuthorizationResult = null,
  authoritativePhysicalEvidenceResults = null,
} = {}) {
  if (!id) return null;
  const def = SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0[id];
  if (!def) return null;

  const correspondence = getCrossViewMeasurementCorrespondence({ id: def.id, annotations });
  const comparabilityQaResult = getCrossViewComparabilityQa({ id: def.id, annotations });

  const frontEligibilityResult = getPhysicalMeasurementEligibility({
    id: def.frontDefinitionId,
    annotations,
    viewPoseValidationResult,
    clothingAuthorizationResult,
    authoritativePhysicalEvidenceResults,
  });

  const sideEligibilityResult = getPhysicalMeasurementEligibility({
    id: def.sideDefinitionId,
    annotations,
    viewPoseValidationResult,
    clothingAuthorizationResult,
    authoritativePhysicalEvidenceResults,
  });

  return evaluatePairedCrossViewEligibility(correspondence, {
    frontEligibilityResult,
    sideEligibilityResult,
    comparabilityQaResult,
  });
}

/**
 * Evaluates all supported Paired Cross-View Physical Eligibilities from active runtime state.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   viewPoseValidationResult?: object|null,
 *   clothingAuthorizationResult?: object|null,
 *   authoritativePhysicalEvidenceResults?: Array<object>|object|null,
 * }} [options]
 * @returns {{
 *   contract: 'paired-cross-view-eligibility-report-v0',
 *   version: string,
 *   pairs: Array<object>,
 * }|null}
 */
export function getPairedCrossViewEligibilityReport({
  annotations = null,
  viewPoseValidationResult = null,
  clothingAuthorizationResult = null,
  authoritativePhysicalEvidenceResults = null,
} = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster && !currentPackage) return null;

  const definitions = Object.values(SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0);
  const pairs = definitions.map((def) =>
    getPairedCrossViewEligibility({
      id: def.id,
      annotations,
      viewPoseValidationResult,
      clothingAuthorizationResult,
      authoritativePhysicalEvidenceResults,
    })
  );

  return {
    contract: 'paired-cross-view-eligibility-report-v0',
    version: PAIRED_CROSS_VIEW_ELIGIBILITY_CONTRACT_VERSION,
    pairs,
  };
}

/**
 * Evaluates pure deterministic Side T-pose stance qualification from active runtime state.
 *
 * @param {{ sidePoseSource?: object|null }} [options]
 * @returns {object|null} SideTPoseQualificationResult
 */
export function getSidePoseQualification({ sidePoseSource = null } = {}) {
  const resolvedSidePose = sidePoseSource
    ?? currentPackage?.side?.pose
    ?? qaResult?.views?.side?.pose
    ?? null;
  if (!resolvedSidePose) return null;
  return evaluateSidePoseQualification(resolvedSidePose);
}

/**
 * Evaluates pure deterministic approximately-lateral Side view qualification from active runtime state.
 *
 * @param {{ frontPoseSource?: object|null, sidePoseSource?: object|null, annotations?: Array<object>|null }} [options]
 * @returns {object|null} SideViewOrientationQualificationResult
 */
export function getSideViewOrientationQualification({
  frontPoseSource = null,
  sidePoseSource = null,
  annotations = null,
} = {}) {
  const resolvedFrontPose = frontPoseSource
    ?? currentPackage?.front?.pose
    ?? (Array.isArray(annotations) && annotations.length > 0 ? annotations : null)
    ?? qaResult?.views?.front?.pose
    ?? null;

  const resolvedSidePose = sidePoseSource
    ?? currentPackage?.side?.pose
    ?? qaResult?.views?.side?.pose
    ?? null;

  const resolvedSideSeg = currentPackage?.side?.segmentation
    ?? qaResult?.views?.side?.segmentation
    ?? null;

  if (!resolvedFrontPose || !resolvedSidePose) return null;

  return evaluateSideViewOrientationQualification({
    frontPoseSource: resolvedFrontPose,
    sidePoseSource: resolvedSidePose,
    sideSegmentation: resolvedSideSeg,
  });
}

/**
 * Accesses pure deterministic Side Anterior / Posterior Orientation semantics from runtime package.
 *
 * @param {{
 *   sidePoseSource?: object|null,
 *   frontPoseSource?: object|null,
 *   sideViewOrientationQualification?: object|null,
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [options]
 * @returns {object|null} SideAnteriorPosteriorOrientationResult
 */
export function getSideAnteriorPosteriorOrientation({
  sidePoseSource = null,
  frontPoseSource = null,
  sideViewOrientationQualification = null,
  annotations = null,
  options = {},
} = {}) {
  const resolvedFrontPose = frontPoseSource
    ?? currentPackage?.front?.pose
    ?? (Array.isArray(annotations) && annotations.length > 0 ? annotations : null)
    ?? qaResult?.views?.front?.pose
    ?? null;

  const resolvedSidePose = sidePoseSource
    ?? currentPackage?.side?.pose
    ?? qaResult?.views?.side?.pose
    ?? null;

  if (!resolvedSidePose) return null;

  const resolvedLateralQual = sideViewOrientationQualification
    ?? (resolvedFrontPose ? getSideViewOrientationQualification({ frontPoseSource: resolvedFrontPose, sidePoseSource: resolvedSidePose }) : null);

  const metricCalibrationSide = currentPackage?.side?.calibration
    ?? qaResult?.views?.side?.calibration
    ?? null;

  return evaluateSideAnteriorPosteriorOrientation({
    sidePoseSource: resolvedSidePose,
    frontPoseSource: resolvedFrontPose,
    sideViewOrientationQualification: resolvedLateralQual,
    metricCalibrationSide,
    options,
  });
}

/**
 * Evaluates pure deterministic Side physical depth qualification for a single Side observation.
 *
 * @param {{
 *   id: string,
 *   annotations?: Array<object>|null,
 *   metricCalibrationProvenance?: object|null,
 *   sidePoseQualification?: object|null,
 *   sideViewOrientationQualification?: object|null,
 *   clothingSemantics?: object|null,
 * }} options
 * @returns {object|null} SidePhysicalDepthQualificationResult
 */
export function getSidePhysicalDepthQualification({
  id,
  annotations = null,
  metricCalibrationProvenance = null,
  sidePoseQualification = null,
  sideViewOrientationQualification = null,
  clothingSemantics = null,
} = {}) {
  if (!id) return null;
  const def = SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0[id]
    ?? Object.values(SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0).find((d) => d.id === id || d.sourceObservationDefinitionId === id);
  if (!def) return null;

  const sourceObs = getSideProfileSpan({ id: def.sourceObservationDefinitionId, annotations });
  if (!sourceObs) return null;

  const resolvedCalibration = metricCalibrationProvenance
    ?? getMetricCalibrationProvenance({ view: 'side' });

  const resolvedSidePose = sidePoseQualification
    ?? getSidePoseQualification();

  const resolvedOrientation = sideViewOrientationQualification
    ?? getSideViewOrientationQualification({ annotations });

  const resolvedClothing = clothingSemantics
    ?? getClothingBodySurfaceSemantics({ id: def.sourceObservationDefinitionId, annotations });

  return evaluateSidePhysicalDepthQualification(sourceObs, {
    definition: def,
    metricCalibrationProvenance: resolvedCalibration,
    sidePoseQualification: resolvedSidePose,
    sideViewOrientationQualification: resolvedOrientation,
    clothingSemantics: resolvedClothing,
  });
}

/**
 * Evaluates pure deterministic Side physical depth qualification report for all supported definitions.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   metricCalibrationProvenance?: object|null,
 *   sidePoseQualification?: object|null,
 *   sideViewOrientationQualification?: object|null,
 *   clothingSemantics?: object|null,
 * }} [options]
 * @returns {{
 *   contract: 'side-physical-depth-qualifications-report-v0',
 *   version: string,
 *   view: 'side',
 *   qualifications: Array<object>,
 * }|null}
 */
export function getSidePhysicalDepthQualifications({
  annotations = null,
  metricCalibrationProvenance = null,
  sidePoseQualification = null,
  sideViewOrientationQualification = null,
  clothingSemantics = null,
} = {}) {
  const sideRaster = getSideSegmentationRaster();
  if (!sideRaster && !currentPackage) return null;

  const definitions = Object.values(SUPPORTED_SIDE_PHYSICAL_DEPTH_DEFINITIONS_V0);
  const qualifications = definitions.map((def) =>
    getSidePhysicalDepthQualification({
      id: def.id,
      annotations,
      metricCalibrationProvenance,
      sidePoseQualification,
      sideViewOrientationQualification,
      clothingSemantics,
    })
  ).filter(Boolean);

  return {
    contract: 'side-physical-depth-qualifications-report-v0',
    version: SIDE_PHYSICAL_DEPTH_CONTRACT_VERSION,
    view: 'side',
    qualifications,
  };
}

/**
 * Evaluates pure deterministic Cross-Section Evidence for a single anatomical level from active runtime state.
 *
 * @param {{
 *   id: string,
 *   annotations?: Array<object>|null,
 *   frontObservation?: object|null,
 *   sideDepthQualification?: object|null,
 *   correspondence?: object|null,
 *   comparabilityQa?: object|null,
 *   metricCalibrationFront?: object|null,
 *   metricCalibrationSide?: object|null,
 * }} options
 * @returns {object|null} CrossSectionEvidenceResultV0
 */
export function getCrossSectionEvidence({
  id,
  annotations = null,
  frontObservation = null,
  sideDepthQualification = null,
  correspondence = null,
  comparabilityQa = null,
  metricCalibrationFront = null,
  metricCalibrationSide = null,
} = {}) {
  if (!id) return null;
  const def = SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0[id]
    ?? Object.values(SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0).find(
      (d) => d.id === id || d.sourceLevel === id || d.correspondenceId === id,
    );
  if (!def) return null;

  const resolvedFront = frontObservation
    ?? getFrontTransverseWidth({ id: def.frontDefinitionId, annotations });

  const resolvedSideDepth = sideDepthQualification
    ?? getSidePhysicalDepthQualification({ id: def.sideDepthDefinitionId, annotations });

  const resolvedCorrespondence = correspondence
    ?? getCrossViewMeasurementCorrespondence({ id: def.correspondenceId, annotations });

  const resolvedComparabilityQa = comparabilityQa
    ?? getCrossViewComparabilityQa({ id: def.correspondenceId, annotations });

  const resolvedCalFront = metricCalibrationFront
    ?? getMetricCalibrationProvenance({ view: 'front' });

  const resolvedCalSide = metricCalibrationSide
    ?? getMetricCalibrationProvenance({ view: 'side' });

  return evaluateCrossSectionEvidence({
    frontObservation: resolvedFront,
    sideDepthQualification: resolvedSideDepth,
    correspondence: resolvedCorrespondence,
    comparabilityQa: resolvedComparabilityQa,
    metricCalibrationFront: resolvedCalFront,
    metricCalibrationSide: resolvedCalSide,
  }, {
    definition: def,
  });
}

/**
 * Evaluates pure deterministic Cross-Section Evidence report for all supported definitions from active runtime state.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   metricCalibrationFront?: object|null,
 *   metricCalibrationSide?: object|null,
 * }} [options]
 * @returns {{
 *   contract: 'cross-section-evidence-report-v0',
 *   version: string,
 *   crossSections: Array<object>,
 * }|null}
 */
export function getCrossSectionEvidenceReport({
  annotations = null,
  metricCalibrationFront = null,
  metricCalibrationSide = null,
} = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster && !currentPackage) return null;

  const definitions = Object.values(SUPPORTED_CROSS_SECTION_EVIDENCE_DEFINITIONS_V0);
  const crossSections = definitions.map((def) =>
    getCrossSectionEvidence({
      id: def.id,
      annotations,
      metricCalibrationFront,
      metricCalibrationSide,
    })
  ).filter(Boolean);

  return {
    contract: 'cross-section-evidence-report-v0',
    version: CROSS_SECTION_EVIDENCE_CONTRACT_VERSION,
    crossSections,
  };
}

/**
 * Evaluates pure deterministic Modeled Cross-Section Perimeter for a single anatomical level from active runtime state.
 * Supported for Hip Landmark Level only ('torso_modeled_perimeter_at_hip_landmark_level').
 *
 * @param {{
 *   id?: string,
 *   annotations?: Array<object>|null,
 *   crossSectionEvidence?: object|null,
 *   frontObservation?: object|null,
 *   sideDepthQualification?: object|null,
 *   correspondence?: object|null,
 *   comparabilityQa?: object|null,
 *   metricCalibrationFront?: object|null,
 *   metricCalibrationSide?: object|null,
 * }} [options]
 * @returns {object|null} ModeledCrossSectionPerimeterResultV0
 */
export function getModeledCrossSectionPerimeter({
  id = 'torso_modeled_perimeter_at_hip_landmark_level',
  annotations = null,
  crossSectionEvidence = null,
  frontObservation = null,
  sideDepthQualification = null,
  correspondence = null,
  comparabilityQa = null,
  metricCalibrationFront = null,
  metricCalibrationSide = null,
} = {}) {
  if (!id) return null;
  const def = SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0[id]
    ?? Object.values(SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0).find(
      (d) => d.id === id || d.sourceLevel === id || d.sourceCrossSectionDefinitionId === id,
    );

  if (!def) {
    if (typeof id === 'string' && (id.includes('shoulder') || id === 'shoulder')) {
      return evaluateModeledCrossSectionPerimeter(null, { definition: id });
    }
    return null;
  }

  const resolvedEvidence = crossSectionEvidence
    ?? getCrossSectionEvidence({
      id: def.sourceCrossSectionDefinitionId,
      annotations,
      frontObservation,
      sideDepthQualification,
      correspondence,
      comparabilityQa,
      metricCalibrationFront,
      metricCalibrationSide,
    });

  return evaluateModeledCrossSectionPerimeter(resolvedEvidence, {
    definition: def,
  });
}

/**
 * Evaluates pure deterministic Modeled Cross-Section Perimeter report for all supported definitions from active runtime state.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   metricCalibrationFront?: object|null,
 *   metricCalibrationSide?: object|null,
 * }} [options]
 * @returns {{
 *   contract: 'modeled-cross-section-perimeters-report-v0',
 *   version: string,
 *   perimeters: Array<object>,
 * }|null}
 */
export function getModeledCrossSectionPerimeterReport({
  annotations = null,
  metricCalibrationFront = null,
  metricCalibrationSide = null,
} = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  if (!frontRaster && !sideRaster && !currentPackage) return null;

  const definitions = Object.values(SUPPORTED_MODELED_CROSS_SECTION_PERIMETER_DEFINITIONS_V0);
  const perimeters = definitions.map((def) =>
    getModeledCrossSectionPerimeter({
      id: def.id,
      annotations,
      metricCalibrationFront,
      metricCalibrationSide,
    })
  ).filter(Boolean);

  return {
    contract: 'modeled-cross-section-perimeters-report-v0',
    version: MODELED_CROSS_SECTION_PERIMETER_CONTRACT_VERSION,
    perimeters,
  };
}

export function getModeledCrossSectionPerimeters(options = {}) {
  return getModeledCrossSectionPerimeterReport(options);
}

/**
 * Evaluates the pure deterministic Pelvic Arbitrary-Y Evidence Scan from active runtime state.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [param0]
 * @returns {object|null} PelvicArbitraryYEvidenceScanResultV0
 */
export function getPelvicArbitraryYEvidenceScan({ annotations = null, options = {} } = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  const frontSeg = qaResult?.views?.front?.segmentation ?? currentPackage?.front?.segmentation ?? null;
  const sideSeg = qaResult?.views?.side?.segmentation ?? currentPackage?.side?.segmentation ?? null;

  if (!frontRaster && !frontSeg && !currentPackage) return null;

  const resolvedAnnotations = annotations ?? (typeof getAnnotations === 'function' ? getAnnotations() : []);
  const levelsReport = computeAnatomicalLevels(resolvedAnnotations);
  const metricCalibrationFront = getMetricCalibrationProvenance({ view: 'front' });
  const metricCalibrationSide = getMetricCalibrationProvenance({ view: 'side' });
  const sideViewOrientationQualification = getSideViewOrientationQualification({ annotations: resolvedAnnotations });
  const sidePoseQualification = getSidePoseQualification();
  const clothingSemanticsSide = getClothingBodySurfaceSemantics({
    id: 'torso_profile_span_at_hip_level',
    annotations: resolvedAnnotations,
  });

  return evaluatePelvicArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: frontSeg,
    sideSegmentation: sideSeg,
    annotations: resolvedAnnotations,
    levelsReport,
    metricCalibrationFront,
    metricCalibrationSide,
    sideViewOrientationQualification,
    sidePoseQualification,
    clothingSemanticsSide,
    options,
  });
}

/**
 * Alias for getPelvicArbitraryYEvidenceScan for uniform reporting convention.
 */
export function getPelvicArbitraryYEvidenceScanReport(options = {}) {
  return getPelvicArbitraryYEvidenceScan(options);
}

/**
 * Evaluates pure deterministic Maximum Seat Plane localization candidate from the
 * active pelvic arbitrary-Y evidence scan.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [param0]
 * @returns {object|null} MaximumSeatPlaneLocalizationResultV0
 */
export function getMaximumSeatPlaneLocalization({ annotations = null, options = {} } = {}) {
  const scanReport = getPelvicArbitraryYEvidenceScan({ annotations, options });
  if (!scanReport) return null;
  return evaluateMaximumSeatPlaneLocalization(scanReport, options);
}

/**
 * Alias for getMaximumSeatPlaneLocalization for uniform reporting convention.
 */
export function getMaximumSeatPlaneLocalizationReport(options = {}) {
  return getMaximumSeatPlaneLocalization(options);
}

/**
 * Evaluates the pure deterministic Torso Arbitrary-Y Evidence Scan from active runtime state.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [param0]
 * @returns {object|null} TorsoArbitraryYEvidenceScanResultV0
 */
export function getTorsoArbitraryYEvidenceScan({ annotations = null, options = {} } = {}) {
  const frontRaster = getFrontSegmentationRaster();
  const sideRaster = getSideSegmentationRaster();
  const frontSeg = qaResult?.views?.front?.segmentation ?? currentPackage?.front?.segmentation ?? null;
  const sideSeg = qaResult?.views?.side?.segmentation ?? currentPackage?.side?.segmentation ?? null;

  if (!frontRaster && !frontSeg && !currentPackage) return null;

  const resolvedAnnotations = annotations ?? (typeof getAnnotations === 'function' ? getAnnotations() : []);
  const levelsReport = computeAnatomicalLevels(resolvedAnnotations);
  const metricCalibrationFront = getMetricCalibrationProvenance({ view: 'front' });
  const metricCalibrationSide = getMetricCalibrationProvenance({ view: 'side' });
  const sideViewOrientationQualification = getSideViewOrientationQualification({ annotations: resolvedAnnotations });
  const sidePoseQualification = getSidePoseQualification();
  const clothingSemanticsSide = getClothingBodySurfaceSemantics({
    id: 'torso_profile_span_at_shoulder_level',
    annotations: resolvedAnnotations,
  });

  return evaluateTorsoArbitraryYEvidenceScan({
    frontRaster,
    sideRaster,
    frontSegmentation: frontSeg,
    sideSegmentation: sideSeg,
    annotations: resolvedAnnotations,
    levelsReport,
    metricCalibrationFront,
    metricCalibrationSide,
    sideViewOrientationQualification,
    sidePoseQualification,
    clothingSemanticsSide,
    options,
  });
}

/**
 * Alias for getTorsoArbitraryYEvidenceScan for uniform reporting convention.
 */
export function getTorsoArbitraryYEvidenceScanReport(options = {}) {
  return getTorsoArbitraryYEvidenceScan(options);
}

/**
 * Evaluates pure deterministic Natural Waist Plane localization candidate from the
 * active torso arbitrary-Y evidence scan.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [param0]
 * @returns {object|null} NaturalWaistPlaneLocalizationResultV0
 */
export function getNaturalWaistPlaneLocalization({ annotations = null, options = {} } = {}) {
  const scanReport = getTorsoArbitraryYEvidenceScan({ annotations, options });
  if (!scanReport) return null;
  return evaluateNaturalWaistPlaneLocalization(scanReport, options);
}

/**
 * Alias for getNaturalWaistPlaneLocalization for uniform reporting convention.
 */
export function getNaturalWaistPlaneLocalizationReport(options = {}) {
  return getNaturalWaistPlaneLocalization(options);
}

/**
 * Evaluates pure deterministic Modeled Hip / Seat Circumference Estimate from the
 * active localized Maximum Seat Plane candidate.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [param0]
 * @returns {object|null} ModeledHipSeatCircumferenceResultV0
 */
export function getModeledHipSeatCircumference({ annotations = null, options = {} } = {}) {
  const localization = getMaximumSeatPlaneLocalization({ annotations, options });
  if (!localization) return null;
  return evaluateModeledHipSeatCircumference(localization, options);
}

/**
 * Alias for getModeledHipSeatCircumference for uniform reporting convention.
 */
export function getModeledHipSeatCircumferenceReport(options = {}) {
  return getModeledHipSeatCircumference(options);
}

/**
 * Evaluates pure deterministic Modeled Natural Waist Circumference Estimate from the
 * active localized Natural Waist Plane candidate.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   options?: object,
 * }} [param0]
 * @returns {object|null} ModeledNaturalWaistCircumferenceResultV0
 */
export function getModeledNaturalWaistCircumference({ annotations = null, options = {} } = {}) {
  const localization = getNaturalWaistPlaneLocalization({ annotations, options });
  if (!localization) return null;
  return evaluateModeledNaturalWaistCircumference(localization, options);
}

/**
 * Alias for getModeledNaturalWaistCircumference for uniform reporting convention.
 */
export function getModeledNaturalWaistCircumferenceReport(options = {}) {
  return getModeledNaturalWaistCircumference(options);
}

/**
 * Resolves declarative 2D visualization provenance for any measurement result object.
 *
 * @param {object} measurement
 * @param {object} [context]
 * @returns {object}
 */
export function getMeasurementVisualizationProvenance(measurement, context = {}) {
  const resolvedContext = {
    crossSectionEvidenceReport: getCrossSectionEvidence('hip'),
    directMeasurementsReport: getDirectBodyMeasurements(),
    anatomicalLevelsReport: getAnatomicalLevelsReport(),
    ...context,
  };
  return resolveMeasurementVisualizationProvenance(measurement, resolvedContext);
}

export function analyzeLoadedBodyEvidence() {
  if (!hasBodyEvidencePoseOrSegSource()) {
    lastError = 'Load at least one pose or segmentation JSON before analyzing.';
    qaResult = null;
    denseEvidenceQa = null;
    currentAnalysisSessionId += 1;
    overlayVisible = false;
    secondaryCandidatesVisible = false;
    sideCoreOverlayVisible = false;
    sideSecondaryOverlayVisible = false;
    clearBodyEvidenceSelectionSilent();
    notifyBodyEvidenceChange();
    return { ok: false, error: lastError, result: null };
  }

  try {
    qaResult = analyzeBodyEvidence(getBodyEvidenceSources());
    lastError = null;
    denseEvidenceQa = null;
    const sessionId = (currentAnalysisSessionId += 1);

    overlayVisible = getRenderableFrontBodyLandmarks().length > 0;
    secondaryCandidatesVisible = getSecondaryFrontBodyLandmarks().length > 0;
    sideCoreOverlayVisible = getRenderableSideBodyLandmarks().length > 0;
    sideSecondaryOverlayVisible = getSecondarySideBodyLandmarks().length > 0;
    // Re-analyze replaces the landmark set — drop any prior inspect selection.
    clearBodyEvidenceSelectionSilent();

    // Asynchronously trigger derived dense evidence QA
    const frontView = currentPackage?.front ? {
      view: 'front',
      segmentation: qaResult?.views?.front?.segmentation ?? currentPackage.front.segmentation ?? null,
      pointmap: currentPackage.front.pointmap ?? null,
      normals: currentPackage.front.normals ?? null,
    } : null;

    const sideView = currentPackage?.side ? {
      view: 'side',
      segmentation: qaResult?.views?.side?.segmentation ?? currentPackage.side.segmentation ?? null,
      pointmap: currentPackage.side.pointmap ?? null,
      normals: currentPackage.side.normals ?? null,
    } : null;

    if (frontView || sideView) {
      Promise.all([
        frontView ? evaluateSameViewDenseCrossModalQa(frontView, { view: 'front', cache: false }) : Promise.resolve(null),
        sideView ? evaluateSameViewDenseCrossModalQa(sideView, { view: 'side', cache: false }) : Promise.resolve(null),
      ]).then(([frontCrossModal, sideCrossModal]) => {
        if (sessionId !== currentAnalysisSessionId) {
          return;
        }
        denseEvidenceQa = {
          front: {
            pointmap: frontCrossModal?.modalityQa?.pointmap ?? null,
            normals: frontCrossModal?.modalityQa?.normals ?? null,
            crossModal: frontCrossModal ?? null,
          },
          side: {
            pointmap: sideCrossModal?.modalityQa?.pointmap ?? null,
            normals: sideCrossModal?.modalityQa?.normals ?? null,
            crossModal: sideCrossModal ?? null,
          },
        };
        notifyBodyEvidenceChange();
      }).catch((err) => {
        if (sessionId !== currentAnalysisSessionId) {
          return;
        }
        console.warn('[RVEacity] Dense Evidence QA evaluation error:', err);
      });
    }

    notifyBodyEvidenceChange();
    return { ok: true, error: null, result: qaResult };
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Body evidence analysis failed.';
    qaResult = null;
    denseEvidenceQa = null;
    currentAnalysisSessionId += 1;
    overlayVisible = false;
    secondaryCandidatesVisible = false;
    sideCoreOverlayVisible = false;
    sideSecondaryOverlayVisible = false;
    clearBodyEvidenceSelectionSilent();
    notifyBodyEvidenceChange();
    return { ok: false, error: lastError, result: null };
  }
}

/**
 * Asynchronous analysis entrypoint that executes landmark/segmentation QA and awaits
 * derived Dense Evidence QA completion.
 */
export async function analyzeLoadedBodyEvidenceAsync() {
  const syncResult = analyzeLoadedBodyEvidence();
  if (!syncResult.ok) {
    return { ...syncResult, denseQa: null };
  }
  const sessionId = currentAnalysisSessionId;

  const frontView = currentPackage?.front ? {
    view: 'front',
    segmentation: qaResult?.views?.front?.segmentation ?? currentPackage.front.segmentation ?? null,
    pointmap: currentPackage.front.pointmap ?? null,
    normals: currentPackage.front.normals ?? null,
  } : null;

  const sideView = currentPackage?.side ? {
    view: 'side',
    segmentation: qaResult?.views?.side?.segmentation ?? currentPackage.side.segmentation ?? null,
    pointmap: currentPackage.side.pointmap ?? null,
    normals: currentPackage.side.normals ?? null,
  } : null;

  if (frontView || sideView) {
    try {
      const [frontCrossModal, sideCrossModal] = await Promise.all([
        frontView ? evaluateSameViewDenseCrossModalQa(frontView, { view: 'front', cache: false }) : Promise.resolve(null),
        sideView ? evaluateSameViewDenseCrossModalQa(sideView, { view: 'side', cache: false }) : Promise.resolve(null),
      ]);
      if (sessionId === currentAnalysisSessionId) {
        denseEvidenceQa = {
          front: {
            pointmap: frontCrossModal?.modalityQa?.pointmap ?? null,
            normals: frontCrossModal?.modalityQa?.normals ?? null,
            crossModal: frontCrossModal ?? null,
          },
          side: {
            pointmap: sideCrossModal?.modalityQa?.pointmap ?? null,
            normals: sideCrossModal?.modalityQa?.normals ?? null,
            crossModal: sideCrossModal ?? null,
          },
        };
        notifyBodyEvidenceChange();
      }
    } catch (err) {
      if (sessionId === currentAnalysisSessionId) {
        console.warn('[RVEacity] Dense Evidence QA async evaluation error:', err);
      }
    }
  }

  return {
    ok: true,
    error: null,
    result: qaResult,
    denseQa: denseEvidenceQa,
  };
}

export function clearBodyEvidence() {
  sources = emptySources();
  currentPackage = null;
  qaResult = null;
  denseEvidenceQa = null;
  currentAnalysisSessionId += 1;
  lastError = null;
  overlayVisible = false;
  secondaryCandidatesVisible = false;
  sideCoreOverlayVisible = false;
  sideSecondaryOverlayVisible = false;
  clearBodyEvidenceSelectionSilent();
  notifyBodyEvidenceChange();
}

function formatBodyEvidenceFilenameTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
}

function formatBodyEvidenceLocalTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Diagnostic pose view stays counts-only; landmark records are not exported. */
function exportPoseView(pose) {
  const core = pose?.core ?? 0;
  return {
    total: pose?.total ?? 0,
    accepted: pose?.accepted ?? 0,
    rejectedFace: pose?.rejectedFace ?? 0,
    lowConfidence: pose?.lowConfidence ?? 0,
    core,
    coreFront: core,
    secondary: pose?.secondary ?? 0,
    ignoredNonCore: pose?.ignoredNonCore ?? 0,
  };
}

/**
 * View segmentation for diagnostics: class names, real pixel counts, label
 * metadata, and normalized class metrics. Mask payloads (`base64`, raw label data)
 * are never exported.
 */
function exportSegmentationView(segmentation) {
  return {
    view: segmentation?.view ?? null,
    model: segmentation?.model ?? null,
    widthPx: segmentation?.widthPx ?? null,
    heightPx: segmentation?.heightPx ?? null,
    dtype: segmentation?.dtype ?? segmentation?.labelDtype ?? null,
    classNames: [...(segmentation?.classNames ?? [])],
    classCounts: { ...(segmentation?.classCounts ?? {}) },
    rejectedClasses: [...(segmentation?.rejectedClasses ?? [])],
    labelShape: segmentation?.labelShape ? [...segmentation.labelShape] : null,
    labelDtype: segmentation?.labelDtype ?? segmentation?.dtype ?? null,
    classes: (segmentation?.classes ?? []).map((c) => ({
      classId: c.classId,
      label: c.label,
      pixelCount: c.pixelCount,
      coverage: c.coverage,
      present: c.present,
      boundsPx: c.boundsPx ? { ...c.boundsPx } : null,
      boundsNormalized: c.boundsNormalized ? { ...c.boundsNormalized } : null,
    })),
    qa: segmentation?.qa ? { ...segmentation.qa } : null,
  };
}

function exportScale(scale) {
  if (!scale || typeof scale !== 'object') {
    return createFixedBodyEvidenceScale();
  }

  return {
    status: scale.status ?? SCALE_STATUS_FIXED,
    source: scale.source ?? BODY_EVIDENCE_V0_SCALE.source,
    imageWidth: scale.imageWidth ?? BODY_EVIDENCE_V0_SCALE.imageWidth,
    imageHeight: scale.imageHeight ?? BODY_EVIDENCE_V0_SCALE.imageHeight,
    canvasSize: scale.canvasSize ?? BODY_EVIDENCE_V0_SCALE.canvasSize,
    pixelsPerCm: scale.pixelsPerCm ?? BODY_EVIDENCE_V0_SCALE.pixelsPerCm,
    heightCm: null,
    targetBodyHeightPx: null,
  };
}

function exportPointmapSummary(pointmap) {
  if (!pointmap || !pointmap.present) {
    return null;
  }
  return {
    present: true,
    model: pointmap.model ?? null,
    view: pointmap.view ?? null,
    channels: pointmap.channels ?? 3,
    shape: pointmap.shape ? [...pointmap.shape] : null,
    declaredShape: pointmap.declaredShape ? [...pointmap.declaredShape] : null,
    denseLayout: pointmap.denseLayout ?? 'UNKNOWN',
    dtype: pointmap.dtype ?? null,
    declaredUnits: pointmap.declaredUnits ?? null,
    declaredScale: pointmap.declaredScale ?? null,
    coordinateFrame: pointmap.coordinateFrame ?? 'unvalidated',
    scaleSemantics: pointmap.scaleSemantics ?? 'unvalidated',
    canonicalAxisMeaning: pointmap.canonicalAxisMeaning ?? 'unvalidated',
    qa: pointmap.qa ? { ...pointmap.qa } : null,
  };
}

function exportAuthoritativePhysicalEvidenceSummary(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }
  return {
    contract: result.contract ?? null,
    version: result.version ?? null,
    view: result.view ?? null,
    availability: result.availability ?? null,
    status: result.status ?? null,
    authorized: result.authorized === true,
    evidenceClass: result.evidenceClass ?? null,
    evaluatorId: result.evaluatorId ?? null,
    frame: result.frame ? { ...result.frame } : null,
    axes: result.axes ? { ...result.axes } : null,
    scale: result.scale ? { ...result.scale } : null,
    units: result.units ? { ...result.units } : null,
    canonicalCompatibility: result.canonicalCompatibility ? { ...result.canonicalCompatibility } : null,
    physicalAuthority: result.physicalAuthority
      ? {
        status: result.physicalAuthority.status ?? null,
        blockers: [...(result.physicalAuthority.blockers ?? [])],
      }
      : null,
    denseQaRef: result.denseQaRef ? { ...result.denseQaRef } : null,
    bodySurfaceAuthorization: result.bodySurfaceAuthorization
      ? { ...result.bodySurfaceAuthorization }
      : null,
    projectedMetricRef: result.projectedMetricRef ? { ...result.projectedMetricRef } : null,
  };
}

function exportNormalsSummary(normals) {
  if (!normals || !normals.present) {
    return null;
  }
  return {
    present: true,
    model: normals.model ?? null,
    view: normals.view ?? null,
    channels: normals.channels ?? 3,
    shape: normals.shape ? [...normals.shape] : null,
    declaredShape: normals.declaredShape ? [...normals.declaredShape] : null,
    denseLayout: normals.denseLayout ?? 'UNKNOWN',
    dtype: normals.dtype ?? null,
    declaredRange: normals.declaredRange ? [...normals.declaredRange] : null,
    coordinateFrame: normals.coordinateFrame ?? 'unvalidated',
    orientationSemantics: normals.orientationSemantics ?? 'unvalidated',
    qa: normals.qa ? { ...normals.qa } : null,
  };
}

function exportDenseQaSummary(viewDenseQa) {
  if (!viewDenseQa) {
    return null;
  }
  return {
    pointmap: viewDenseQa.pointmap ? {
      contract: viewDenseQa.pointmap.contract,
      view: viewDenseQa.pointmap.view,
      availability: viewDenseQa.pointmap.availability,
      status: viewDenseQa.pointmap.status,
      structure: viewDenseQa.pointmap.structure ? { ...viewDenseQa.pointmap.structure } : null,
      numeric: viewDenseQa.pointmap.numeric ? {
        elements: { ...viewDenseQa.pointmap.numeric.elements },
        channels: (viewDenseQa.pointmap.numeric.channels ?? []).map((c) => ({ ...c })),
        vectors: { ...viewDenseQa.pointmap.numeric.vectors },
      } : null,
      declarations: viewDenseQa.pointmap.declarations ? { ...viewDenseQa.pointmap.declarations } : null,
      issues: [...(viewDenseQa.pointmap.issues ?? [])],
      warnings: [...(viewDenseQa.pointmap.warnings ?? [])],
    } : null,
    normals: viewDenseQa.normals ? {
      contract: viewDenseQa.normals.contract,
      view: viewDenseQa.normals.view,
      availability: viewDenseQa.normals.availability,
      status: viewDenseQa.normals.status,
      structure: viewDenseQa.normals.structure ? { ...viewDenseQa.normals.structure } : null,
      numeric: viewDenseQa.normals.numeric ? {
        elements: { ...viewDenseQa.normals.numeric.elements },
        channels: (viewDenseQa.normals.numeric.channels ?? []).map((c) => ({ ...c })),
        vectors: { ...viewDenseQa.normals.numeric.vectors },
        magnitude: viewDenseQa.normals.numeric.magnitude ? { ...viewDenseQa.normals.numeric.magnitude } : null,
      } : null,
      declaredRangeQa: viewDenseQa.normals.declaredRangeQa ? { ...viewDenseQa.normals.declaredRangeQa } : null,
      semantics: viewDenseQa.normals.semantics ? { ...viewDenseQa.normals.semantics } : null,
      issues: [...(viewDenseQa.normals.issues ?? [])],
      warnings: [...(viewDenseQa.normals.warnings ?? [])],
    } : null,
    crossModal: viewDenseQa.crossModal ? {
      contract: viewDenseQa.crossModal.contract,
      view: viewDenseQa.crossModal.view,
      status: viewDenseQa.crossModal.status,
      availability: { ...viewDenseQa.crossModal.availability },
      rasterCompatibility: { ...viewDenseQa.crossModal.rasterCompatibility },
      pixelAddressing: { ...viewDenseQa.crossModal.pixelAddressing },
      masks: viewDenseQa.crossModal.masks ? {
        background: viewDenseQa.crossModal.masks.background ? {
          pixelCount: viewDenseQa.crossModal.masks.background.pixelCount,
          pointmap: viewDenseQa.crossModal.masks.background.pointmap ? { ...viewDenseQa.crossModal.masks.background.pointmap } : null,
          normals: viewDenseQa.crossModal.masks.background.normals ? { ...viewDenseQa.crossModal.masks.background.normals } : null,
          joint: viewDenseQa.crossModal.masks.background.joint ? { ...viewDenseQa.crossModal.masks.background.joint } : null,
        } : null,
        nonBackground: viewDenseQa.crossModal.masks.nonBackground ? {
          pixelCount: viewDenseQa.crossModal.masks.nonBackground.pixelCount,
          pointmap: viewDenseQa.crossModal.masks.nonBackground.pointmap ? { ...viewDenseQa.crossModal.masks.nonBackground.pointmap } : null,
          normals: viewDenseQa.crossModal.masks.nonBackground.normals ? { ...viewDenseQa.crossModal.masks.nonBackground.normals } : null,
          joint: viewDenseQa.crossModal.masks.nonBackground.joint ? { ...viewDenseQa.crossModal.masks.nonBackground.joint } : null,
        } : null,
        bodyAnatomical: viewDenseQa.crossModal.masks.bodyAnatomical ? {
          pixelCount: viewDenseQa.crossModal.masks.bodyAnatomical.pixelCount,
          pointmap: viewDenseQa.crossModal.masks.bodyAnatomical.pointmap ? { ...viewDenseQa.crossModal.masks.bodyAnatomical.pointmap } : null,
          normals: viewDenseQa.crossModal.masks.bodyAnatomical.normals ? { ...viewDenseQa.crossModal.masks.bodyAnatomical.normals } : null,
          joint: viewDenseQa.crossModal.masks.bodyAnatomical.joint ? { ...viewDenseQa.crossModal.masks.bodyAnatomical.joint } : null,
        } : null,
      } : null,
      semantics: { ...viewDenseQa.crossModal.semantics },
      issues: [...(viewDenseQa.crossModal.issues ?? [])],
      warnings: [...(viewDenseQa.crossModal.warnings ?? [])],
    } : null,
  };
}

/**
 * Build a diagnostic Body Evidence JSON payload from the analyzed QA result.
 * Excludes raw uploaded sources, images, and segmentation mask/base64 payloads.
 */
export function buildBodyEvidenceExport(exportedAt = new Date()) {
  if (!qaResult) {
    return null;
  }

  const frontSeg = exportSegmentationView(qaResult.views.front.segmentation);
  const sideSeg = exportSegmentationView(qaResult.views.side.segmentation);

  return {
    version: qaResult.version,
    sourceFormat: qaResult.sourceFormat,
    isMockData: qaResult.isMockData,
    confidenceLevel: qaResult.confidenceLevel,
    diagnosticExport: true,
    exportedAtLocal: formatBodyEvidenceLocalTimestamp(exportedAt),
    exportedAtUtc: exportedAt.toISOString(),
    scale: exportScale(qaResult.scale),
    scaleDetected: qaResult.scaleDetected,
    scaleStatus: qaResult.scaleStatus ?? qaResult.scale?.status ?? SCALE_STATUS_FIXED,
    loaded: { ...qaResult.loaded },
    package: currentPackage ? {
      version: currentPackage.version,
      sampleId: currentPackage.sampleId,
      sourceFormat: currentPackage.sourceFormat,
      qa: currentPackage.qa ? { ...currentPackage.qa } : null,
    } : null,
    views: {
      front: {
        pose: exportPoseView(qaResult.views.front.pose),
        segmentation: frontSeg,
        pointmap: exportPointmapSummary(currentPackage?.front?.pointmap),
        normals: exportNormalsSummary(currentPackage?.front?.normals),
        denseQa: exportDenseQaSummary(denseEvidenceQa?.front),
      },
      side: {
        pose: exportPoseView(qaResult.views.side.pose),
        segmentation: sideSeg,
        pointmap: exportPointmapSummary(currentPackage?.side?.pointmap),
        normals: exportNormalsSummary(currentPackage?.side?.normals),
        denseQa: exportDenseQaSummary(denseEvidenceQa?.side),
      },
    },
    denseQa: denseEvidenceQa ? {
      front: exportDenseQaSummary(denseEvidenceQa.front),
      side: exportDenseQaSummary(denseEvidenceQa.side),
    } : null,
    authoritativePhysicalEvidence: (() => {
      const report = getAuthoritativePhysicalEvidenceSemanticsReport();
      if (!report) return null;
      return {
        contract: report.contract,
        version: AUTHORITATIVE_PHYSICAL_EVIDENCE_CONTRACT_VERSION,
        sharedAcrossViews: false,
        summary: report.summary ? { ...report.summary } : null,
        views: {
          front: exportAuthoritativePhysicalEvidenceSummary(report.views?.front),
          side: exportAuthoritativePhysicalEvidenceSummary(report.views?.side),
        },
      };
    })(),
    qa: {
      totalLandmarks: qaResult.qa.totalLandmarks,
      acceptedBodyLandmarks: qaResult.qa.acceptedBodyLandmarks,
      rejectedFaceLandmarks: qaResult.qa.rejectedFaceLandmarks,
      lowConfidenceLandmarks: qaResult.qa.lowConfidenceLandmarks,
      frontAcceptedCount: qaResult.qa.frontAcceptedCount,
      sideAcceptedCount: qaResult.qa.sideAcceptedCount,
      frontTotalLandmarks: qaResult.qa.frontTotalLandmarks ?? 0,
      frontCoreLandmarks: qaResult.qa.frontCoreLandmarks ?? 0,
      sideCoreLandmarks: qaResult.qa.sideCoreLandmarks ?? 0,
      renderableFrontLandmarks: qaResult.qa.renderableFrontLandmarks,
      frontSecondaryLandmarks: qaResult.qa.frontSecondaryLandmarks
        ?? qaResult.qa.secondaryFrontLandmarks
        ?? 0,
      secondaryFrontLandmarks: qaResult.qa.secondaryFrontLandmarks ?? 0,
      sideSecondaryLandmarks: qaResult.qa.sideSecondaryLandmarks ?? 0,
      frontRejectedFaceLandmarks: qaResult.qa.frontRejectedFaceLandmarks ?? 0,
      sideRejectedFaceLandmarks: qaResult.qa.sideRejectedFaceLandmarks ?? 0,
      frontIgnoredNonCoreLandmarks: qaResult.qa.frontIgnoredNonCoreLandmarks ?? 0,
      sideIgnoredNonCoreLandmarks: qaResult.qa.sideIgnoredNonCoreLandmarks ?? 0,
      secondaryFrontLandmarkNames: [...(qaResult.qa.secondaryFrontLandmarkNames ?? [])],
      secondarySideLandmarkNames: [...(qaResult.qa.secondarySideLandmarkNames ?? [])],
      secondaryAllowlist: [...(qaResult.qa.secondaryAllowlist ?? [])],
      secondarySideAllowlist: [...(qaResult.qa.secondarySideAllowlist ?? [])],
      ignoredFrontLandmarks: (qaResult.qa.ignoredFrontLandmarks ?? [])
        .map((entry) => ({ ...entry })),
      ignoredSideLandmarks: (qaResult.qa.ignoredSideLandmarks ?? [])
        .map((entry) => ({ ...entry })),
      rejectedFrontLandmarks: (qaResult.qa.rejectedFrontLandmarks ?? [])
        .map((entry) => ({ ...entry })),
      rejectedSideLandmarks: (qaResult.qa.rejectedSideLandmarks ?? [])
        .map((entry) => ({ ...entry })),
      ignoredNonCoreLandmarks: qaResult.qa.ignoredNonCoreLandmarks ?? 0,
      segmentationClassCount: qaResult.qa.segmentationClassCount,
      rejectedSegmentationClasses: [...(qaResult.qa.rejectedSegmentationClasses ?? [])],
      classNames: [...(qaResult.qa.classNames ?? [])],
      classCounts: { ...(qaResult.qa.classCounts ?? {}) },
      notes: [...(qaResult.qa.notes ?? [])],
    },
  };
}

export function downloadBodyEvidenceJson() {
  const exportedAt = new Date();
  const payload = buildBodyEvidenceExport(exportedAt);
  if (!payload) {
    return { ok: false, error: 'Analyze Body Evidence before downloading.' };
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `revacity-body-evidence-${formatBodyEvidenceFilenameTimestamp(exportedAt)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  return { ok: true, error: null };
}

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
        console.warn('[REVacity] Dense Evidence QA evaluation error:', err);
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
        console.warn('[REVacity] Dense Evidence QA async evaluation error:', err);
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

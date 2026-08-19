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

/** @type {ReturnType<typeof analyzeBodyEvidence>|null} */
let qaResult = null;

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
}

function hasBodyEvidencePoseOrSegSource() {
  return Boolean(
    sources.frontPose
    || sources.sidePose
    || sources.frontSeg
    || sources.sideSeg,
  );
}

export function hasAnyBodyEvidenceSource() {
  return hasBodyEvidencePoseOrSegSource();
}

export function hasSidePoseSource() {
  return Boolean(sources.sidePose);
}

/** Loading a source invalidates the previous analysis, overlay, and selection. */
function resetAnalysisForNewSource() {
  qaResult = null;
  lastError = null;
  overlayVisible = false;
  secondaryCandidatesVisible = false;
  sideCoreOverlayVisible = false;
  sideSecondaryOverlayVisible = false;
  clearBodyEvidenceSelectionSilent();
  notifyBodyEvidenceChange();
}

export function setFrontPoseSource(data) {
  sources.frontPose = data;
  resetAnalysisForNewSource();
}

export function setSidePoseSource(data) {
  sources.sidePose = data;
  resetAnalysisForNewSource();
}

export function setFrontSegSource(data) {
  sources.frontSeg = data;
  resetAnalysisForNewSource();
}

export function setSideSegSource(data) {
  sources.sideSeg = data;
  resetAnalysisForNewSource();
}

export function analyzeLoadedBodyEvidence() {
  if (!hasBodyEvidencePoseOrSegSource()) {
    lastError = 'Load at least one pose or segmentation JSON before analyzing.';
    qaResult = null;
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
    overlayVisible = getRenderableFrontBodyLandmarks().length > 0;
    secondaryCandidatesVisible = getSecondaryFrontBodyLandmarks().length > 0;
    sideCoreOverlayVisible = getRenderableSideBodyLandmarks().length > 0;
    sideSecondaryOverlayVisible = getSecondarySideBodyLandmarks().length > 0;
    // Re-analyze replaces the landmark set — drop any prior inspect selection.
    clearBodyEvidenceSelectionSilent();
    notifyBodyEvidenceChange();
    return { ok: true, error: null, result: qaResult };
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Body evidence analysis failed.';
    qaResult = null;
    overlayVisible = false;
    secondaryCandidatesVisible = false;
    sideCoreOverlayVisible = false;
    sideSecondaryOverlayVisible = false;
    clearBodyEvidenceSelectionSilent();
    notifyBodyEvidenceChange();
    return { ok: false, error: lastError, result: null };
  }
}

export function clearBodyEvidence() {
  sources = emptySources();
  qaResult = null;
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
    views: {
      front: {
        pose: exportPoseView(qaResult.views.front.pose),
        segmentation: frontSeg,
      },
      side: {
        pose: exportPoseView(qaResult.views.side.pose),
        segmentation: sideSeg,
      },
    },
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

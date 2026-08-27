/**
 * Side Anterior / Posterior Orientation Semantics Contract v0
 *
 * Pure deterministic domain contract that determines, from existing Side pose evidence
 * and lateral orientation qualification, which direction along Side-U corresponds to
 * anatomical anterior and posterior.
 *
 * Contract: 'side-anterior-posterior-orientation-v0'
 * View: 'side'
 *
 * SEMANTIC PRINCIPLES:
 * - Evidence-driven orientation: evaluates primary head/profile displacement (e.g. nose vs ear/neck/shoulder)
 *   and secondary foot displacement (e.g. big toe vs heel) from Side 2D pose keypoints.
 * - Resolution-independent dead-zone: enforces an explicit minimum directional displacement threshold
 *   (in calibrated cm or normalized image coordinate space) to prevent noise-driven classification.
 * - Conservative consensus: requires agreement between independent cues; conflicting cues yield status: 'ambiguous'.
 * - Strict 2D Side-profile semantics: maps facing direction to Side-U endpoints ('min_u' or 'max_u').
 * - Zero 3D claims: does NOT convert U to canonical Z, does NOT claim camera extrinsics, does NOT fuse Front/Side coords.
 * - Does NOT perform body measurements or inspect segmentation contours to decide facing direction.
 */

import { LOW_CONFIDENCE_THRESHOLD } from './bodyEvidenceAdapter.js';
import { evaluateSideViewOrientationQualification, SIDE_VIEW_ORIENTATION_STATUS } from './sideViewOrientationQualification.js';

export const SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT = 'side-anterior-posterior-orientation-v0';
export const SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT_VERSION = 'side-anterior-posterior-orientation-v0';

/**
 * Authoritative 4-state orientation status taxonomy.
 * @type {Readonly<{
 *   READY: 'ready',
 *   AMBIGUOUS: 'ambiguous',
 *   UNAVAILABLE: 'unavailable',
 *   INVALID: 'invalid',
 * }>}
 */
export const SIDE_ORIENTATION_STATUS = Object.freeze({
  READY: 'ready',
  AMBIGUOUS: 'ambiguous',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Authoritative facing direction enum.
 * @type {Readonly<{
 *   POSITIVE_U: 'positive_u',
 *   NEGATIVE_U: 'negative_u',
 * }>}
 */
export const FACING_DIRECTION = Object.freeze({
  POSITIVE_U: 'positive_u',
  NEGATIVE_U: 'negative_u',
});

/**
 * Authoritative Side-U endpoint enum.
 * @type {Readonly<{
 *   MIN_U: 'min_u',
 *   MAX_U: 'max_u',
 * }>}
 */
export const SIDE_U_ENDPOINT = Object.freeze({
  MIN_U: 'min_u',
  MAX_U: 'max_u',
});

/**
 * Blocker reason codes for Side anterior/posterior orientation.
 * @type {Readonly<Record<string, string>>}
 */
export const SIDE_ORIENTATION_BLOCKER_CODES = Object.freeze({
  SIDE_POSE_UNAVAILABLE: 'side_pose_unavailable',
  SIDE_VIEW_NOT_QUALIFIED_LATERAL: 'side_view_not_qualified_lateral',
  INSUFFICIENT_DIRECTIONAL_EVIDENCE: 'insufficient_directional_evidence',
  CONTRADICTING_DIRECTION_CUES: 'contradicting_direction_cues',
  NON_FINITE_LANDMARK_COORDINATES: 'non_finite_landmark_coordinates',
});

/**
 * Centralized, inspectable engineering thresholds for Side anterior/posterior orientation.
 */
export const SIDE_ORIENTATION_THRESHOLDS = Object.freeze({
  /** Minimum metric horizontal separation (cm) between facial anchor and cranial reference */
  MIN_HEAD_SEPARATION_CM: 2.0,

  /** Minimum normalized horizontal separation between facial anchor and cranial reference */
  MIN_HEAD_SEPARATION_NORMALIZED: 0.01,

  /** Minimum metric horizontal separation (cm) between big toe and heel */
  MIN_FOOT_SEPARATION_CM: 3.0,

  /** Minimum normalized horizontal separation between big toe and heel */
  MIN_FOOT_SEPARATION_NORMALIZED: 0.015,

  /** Minimum landmark detection confidence */
  MIN_LANDMARK_CONFIDENCE: LOW_CONFIDENCE_THRESHOLD,
});

/**
 * Normalizes any input Side pose representation into a Map<string, { u: number, y: number, score: number|null }>.
 *
 * @param {object|Array|Map|null|undefined} poseSource
 * @returns {Map<string, { u: number, y: number, score: number|null }>}
 */
export function extractAllSideLandmarksMap(poseSource) {
  const map = new Map();
  if (!poseSource) return map;

  const addPoint = (name, u, y, score) => {
    if (typeof name === 'string' && u !== null && y !== null) {
      const normalizedName = name.toLowerCase().trim();
      const numU = typeof u === 'number' ? u : parseFloat(u);
      const numY = typeof y === 'number' ? y : parseFloat(y);
      const numScore = typeof score === 'number' ? score : (score !== null && score !== undefined ? parseFloat(score) : null);
      map.set(normalizedName, {
        u: Number.isFinite(numU) ? numU : NaN,
        y: Number.isFinite(numY) ? numY : NaN,
        score: Number.isFinite(numScore) ? numScore : null,
      });
    }
  };

  // 1. Direct Map
  if (poseSource instanceof Map) {
    for (const [name, pt] of poseSource.entries()) {
      if (pt && typeof pt === 'object') {
        const u = pt.sideUcm ?? pt.u ?? pt.x ?? pt.imageX ?? null;
        const y = pt.sideYcm ?? pt.y ?? pt.imageY ?? null;
        addPoint(name, u, y, pt.score ?? pt.confidence ?? null);
      }
    }
    return map;
  }

  // 2. Direct array of landmark objects
  if (Array.isArray(poseSource)) {
    for (const lm of poseSource) {
      if (lm && typeof lm.name === 'string') {
        const point = lm.point ?? lm.position ?? null;
        if (point) {
          addPoint(lm.name, point.x, point.y, 1.0);
          continue;
        }
        const u = lm.sideUcm ?? lm.u ?? lm.x ?? lm.imageX ?? lm.xPx ?? null;
        const y = lm.sideYcm ?? lm.y ?? lm.imageY ?? lm.yPx ?? null;
        const score = lm.score ?? lm.confidence ?? null;
        addPoint(lm.name, u, y, score);
      }
    }
    return map;
  }

  // 3. View package / pose stats container with acceptedLandmarks / rejectedLandmarks
  const acceptedList = Array.isArray(poseSource.acceptedLandmarks)
    ? poseSource.acceptedLandmarks
    : (Array.isArray(poseSource.pose?.acceptedLandmarks)
      ? poseSource.pose.acceptedLandmarks
      : null);

  if (Array.isArray(acceptedList)) {
    for (const lm of acceptedList) {
      if (lm && typeof lm.name === 'string') {
        const u = lm.sideUcm ?? lm.u ?? lm.x ?? lm.imageX ?? lm.xPx ?? null;
        const y = lm.sideYcm ?? lm.y ?? lm.imageY ?? lm.yPx ?? null;
        const score = lm.score ?? lm.confidence ?? null;
        addPoint(lm.name, u, y, score);
      }
    }
  }

  // Also check rejectedLandmarks if they contain raw coordinate annotations
  const rejectedList = Array.isArray(poseSource.rejectedLandmarks)
    ? poseSource.rejectedLandmarks
    : (Array.isArray(poseSource.pose?.rejectedLandmarks)
      ? poseSource.pose.rejectedLandmarks
      : null);

  if (Array.isArray(rejectedList)) {
    for (const lm of rejectedList) {
      if (lm && typeof lm.name === 'string' && (lm.x != null || lm.imageX != null || lm.u != null)) {
        const u = lm.sideUcm ?? lm.u ?? lm.x ?? lm.imageX ?? lm.xPx ?? null;
        const y = lm.sideYcm ?? lm.y ?? lm.imageY ?? lm.yPx ?? null;
        const score = lm.score ?? lm.confidence ?? null;
        addPoint(lm.name, u, y, score);
      }
    }
  }

  // 4. Raw keypoints_named object
  const keypointsNamed = poseSource.keypoints_named ?? poseSource.pose?.keypoints_named;
  if (keypointsNamed && typeof keypointsNamed === 'object') {
    for (const [name, coords] of Object.entries(keypointsNamed)) {
      if (Array.isArray(coords) && coords.length >= 2) {
        addPoint(name, coords[0], coords[1], coords[2] ?? 1.0);
      } else if (coords && typeof coords === 'object') {
        const u = coords.sideUcm ?? coords.u ?? coords.x ?? coords.imageX ?? null;
        const y = coords.sideYcm ?? coords.y ?? coords.imageY ?? null;
        const score = coords.score ?? coords.confidence ?? 1.0;
        addPoint(name, u, y, score);
      }
    }
  }

  // 5. Raw instances array from pose detector JSON
  const instances = poseSource.instances ?? poseSource.pose?.instances;
  const names = poseSource.keypoint_names ?? poseSource.pose?.keypoint_names ?? [];
  if (Array.isArray(instances) && instances.length > 0 && Array.isArray(names)) {
    const inst = instances[0];
    const keypoints = inst.keypoints ?? [];
    const scores = inst.keypoint_scores ?? [];
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      const pt = keypoints[i];
      const score = scores[i] ?? null;
      if (Array.isArray(pt) && pt.length >= 2 && typeof name === 'string') {
        addPoint(name, pt[0], pt[1], score);
      }
    }
  }

  return map;
}

/**
 * Builds an empty or fallback Side anterior/posterior orientation result.
 */
function buildEmptyOrientationResult({
  status = SIDE_ORIENTATION_STATUS.UNAVAILABLE,
  facingDirection = null,
  anteriorSide = null,
  posteriorSide = null,
  evidence = {},
  blockers = [],
  warnings = [],
  issues = [],
  provenance = {},
} = {}) {
  return {
    contract: SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT,
    version: SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT_VERSION,
    view: 'side',
    status,
    facingDirection,
    anteriorSide,
    posteriorSide,
    isQualified: status === SIDE_ORIENTATION_STATUS.READY,
    evidence: {
      headCue: null,
      footCue: null,
      ...evidence,
    },
    blockers,
    warnings,
    issues,
    provenance: {
      thresholds: SIDE_ORIENTATION_THRESHOLDS,
      ...provenance,
    },
    semantics: {
      statement: 'Pure deterministic Side-profile anterior/posterior orientation derived from 2D Side pose landmarks. Identifies whether increasing U (max_u) or decreasing U (min_u) corresponds to anatomical anterior. NOT canonical Z, NOT 3D reconstruction, NOT camera extrinsics.',
      is2dProfileSemanticsOnly: true,
      isCanonicalZ: false,
      is3dReconstruction: false,
    },
  };
}

/**
 * Evaluates pure deterministic Side Anterior / Posterior Orientation from Side pose evidence.
 *
 * @param {{
 *   sidePoseSource?: object|Array|Map|null,
 *   frontPoseSource?: object|Array|Map|null,
 *   sideViewOrientationQualification?: object|null,
 *   metricCalibrationSide?: object|null,
 *   options?: {
 *     thresholds?: typeof SIDE_ORIENTATION_THRESHOLDS,
 *     requireLateralQualification?: boolean,
 *   },
 * }} [input]
 * @returns {object} SideAnteriorPosteriorOrientationResultV0
 */
export function evaluateSideAnteriorPosteriorOrientation({
  sidePoseSource = null,
  frontPoseSource = null,
  sideViewOrientationQualification = null,
  metricCalibrationSide = null,
  options = {},
} = {}) {
  const issues = [];
  const warnings = [];
  const blockers = [];

  const thresholds = options?.thresholds ?? SIDE_ORIENTATION_THRESHOLDS;
  const requireLateralQualification = options?.requireLateralQualification !== false;
  const minConf = thresholds.MIN_LANDMARK_CONFIDENCE ?? LOW_CONFIDENCE_THRESHOLD;

  // 1. Extract Landmarks Map
  const landmarks = extractAllSideLandmarksMap(sidePoseSource);

  if (landmarks.size === 0) {
    blockers.push(SIDE_ORIENTATION_BLOCKER_CODES.SIDE_POSE_UNAVAILABLE);
    issues.push('Side pose landmarks are missing or empty.');
    return buildEmptyOrientationResult({
      status: SIDE_ORIENTATION_STATUS.UNAVAILABLE,
      blockers,
      warnings,
      issues,
      provenance: { thresholds },
    });
  }

  // 2. Validate Coordinate Finite Sanity
  let hasNonFinite = false;
  for (const [name, pt] of landmarks.entries()) {
    if (Number.isNaN(pt.u) || Number.isNaN(pt.y)) {
      hasNonFinite = true;
      issues.push(`Landmark '${name}' contains non-finite coordinates (u: ${pt.u}, y: ${pt.y}).`);
    }
  }

  if (hasNonFinite) {
    blockers.push(SIDE_ORIENTATION_BLOCKER_CODES.NON_FINITE_LANDMARK_COORDINATES);
    return buildEmptyOrientationResult({
      status: SIDE_ORIENTATION_STATUS.INVALID,
      blockers,
      warnings,
      issues,
      provenance: { thresholds },
    });
  }

  // 3. Lateral View Qualification Check
  let lateralQualResult = sideViewOrientationQualification;
  if (!lateralQualResult && frontPoseSource && sidePoseSource && requireLateralQualification) {
    lateralQualResult = evaluateSideViewOrientationQualification({
      frontPoseSource,
      sidePoseSource,
    });
  }

  if (requireLateralQualification && lateralQualResult) {
    const isLateral = lateralQualResult.status === SIDE_VIEW_ORIENTATION_STATUS.QUALIFIED
      || lateralQualResult.qualified === true
      || lateralQualResult.status === SIDE_VIEW_ORIENTATION_STATUS.WARNING;

    if (!isLateral) {
      blockers.push(SIDE_ORIENTATION_BLOCKER_CODES.SIDE_VIEW_NOT_QUALIFIED_LATERAL);
      issues.push(`Side view orientation qualification failed or disqualified (status: '${lateralQualResult.status}'). Subject is not in a validated lateral profile view.`);
      return buildEmptyOrientationResult({
        status: SIDE_ORIENTATION_STATUS.UNAVAILABLE,
        blockers,
        warnings,
        issues,
        provenance: {
          thresholds,
          sideViewOrientationStatus: lateralQualResult.status,
        },
      });
    }
    if (lateralQualResult.status === SIDE_VIEW_ORIENTATION_STATUS.WARNING) {
      warnings.push(`Side view lateral qualification has advisory warnings (status: '${lateralQualResult.status}'). Anterior/posterior orientation is provisional.`);
    }
  }

  // Helper to check valid point with score
  const isConfident = (pt) => pt && Number.isFinite(pt.u) && (pt.score === null || pt.score >= minConf);

  // 4. Primary Cue: Head / Profile Direction
  let headCue = null;
  const nose = landmarks.get('nose');
  const leftEye = landmarks.get('left_eye');
  const rightEye = landmarks.get('right_eye');
  const leftEar = landmarks.get('left_ear');
  const rightEar = landmarks.get('right_ear');
  const neck = landmarks.get('neck');
  const leftShoulder = landmarks.get('left_shoulder');
  const rightShoulder = landmarks.get('right_shoulder');

  // Determine Facial Anterior Reference
  let facialU = null;
  let facialAnchorName = null;
  if (isConfident(nose)) {
    facialU = nose.u;
    facialAnchorName = 'nose';
  } else if (isConfident(leftEye) && isConfident(rightEye)) {
    facialU = (leftEye.u + rightEye.u) / 2;
    facialAnchorName = 'eyes_bilateral_mean';
  } else if (isConfident(leftEye)) {
    facialU = leftEye.u;
    facialAnchorName = 'left_eye';
  } else if (isConfident(rightEye)) {
    facialU = rightEye.u;
    facialAnchorName = 'right_eye';
  }

  // Determine Cranial / Posterior Reference
  let cranialU = null;
  let cranialReferenceName = null;
  if (isConfident(leftEar) && isConfident(rightEar)) {
    cranialU = (leftEar.u + rightEar.u) / 2;
    cranialReferenceName = 'ears_bilateral_mean';
  } else if (isConfident(leftEar)) {
    cranialU = leftEar.u;
    cranialReferenceName = 'left_ear';
  } else if (isConfident(rightEar)) {
    cranialU = rightEar.u;
    cranialReferenceName = 'right_ear';
  } else if (isConfident(neck)) {
    cranialU = neck.u;
    cranialReferenceName = 'neck';
  } else if (isConfident(leftShoulder) && isConfident(rightShoulder)) {
    cranialU = (leftShoulder.u + rightShoulder.u) / 2;
    cranialReferenceName = 'shoulders_bilateral_mean';
  } else if (isConfident(leftShoulder)) {
    cranialU = leftShoulder.u;
    cranialReferenceName = 'left_shoulder';
  } else if (isConfident(rightShoulder)) {
    cranialU = rightShoulder.u;
    cranialReferenceName = 'right_shoulder';
  }

  if (facialU !== null && cranialU !== null) {
    const deltaU = Number((facialU - cranialU).toFixed(4));
    const absDeltaU = Math.abs(deltaU);

    // Determine domain: metric/pixel (coordinates > 1.0) vs normalized [0..1]
    const isNormalizedDomain = facialU <= 1.0 && cranialU <= 1.0;
    const isMetricDomain = Boolean(metricCalibrationSide?.scaleCmPerPx) || !isNormalizedDomain;
    const deadZone = isMetricDomain ? thresholds.MIN_HEAD_SEPARATION_CM : thresholds.MIN_HEAD_SEPARATION_NORMALIZED;

    let headDirection = null;
    let headStatus = 'indeterminate';

    if (absDeltaU < deadZone) {
      headStatus = 'inside_dead_zone';
      warnings.push(`Head profile separation (|deltaU| = ${absDeltaU.toFixed(2)}) is within dead-zone threshold (${deadZone}).`);
    } else if (deltaU > 0) {
      headStatus = 'valid';
      headDirection = FACING_DIRECTION.POSITIVE_U;
    } else {
      headStatus = 'valid';
      headDirection = FACING_DIRECTION.NEGATIVE_U;
    }

    headCue = {
      status: headStatus,
      direction: headDirection,
      deltaU,
      absDeltaU,
      deadZoneThreshold: deadZone,
      facialAnchor: { name: facialAnchorName, u: facialU },
      cranialReference: { name: cranialReferenceName, u: cranialU },
    };
  } else {
    headCue = {
      status: 'unavailable',
      direction: null,
      deltaU: null,
      absDeltaU: null,
      deadZoneThreshold: thresholds.MIN_HEAD_SEPARATION_CM,
      facialAnchor: facialAnchorName ? { name: facialAnchorName, u: facialU } : null,
      cranialReference: cranialReferenceName ? { name: cranialReferenceName, u: cranialU } : null,
    };
  }

  // 5. Secondary Cue: Foot Direction
  let footCue = null;
  const leftBigToe = landmarks.get('left_big_toe');
  const rightBigToe = landmarks.get('right_big_toe');
  const leftHeel = landmarks.get('left_heel');
  const rightHeel = landmarks.get('right_heel');

  let toeU = null;
  let toeName = null;
  if (isConfident(leftBigToe) && isConfident(rightBigToe)) {
    toeU = (leftBigToe.u + rightBigToe.u) / 2;
    toeName = 'big_toes_bilateral_mean';
  } else if (isConfident(leftBigToe)) {
    toeU = leftBigToe.u;
    toeName = 'left_big_toe';
  } else if (isConfident(rightBigToe)) {
    toeU = rightBigToe.u;
    toeName = 'right_big_toe';
  }

  let heelU = null;
  let heelName = null;
  if (isConfident(leftHeel) && isConfident(rightHeel)) {
    heelU = (leftHeel.u + rightHeel.u) / 2;
    heelName = 'heels_bilateral_mean';
  } else if (isConfident(leftHeel)) {
    heelU = leftHeel.u;
    heelName = 'left_heel';
  } else if (isConfident(rightHeel)) {
    heelU = rightHeel.u;
    heelName = 'right_heel';
  }

  if (toeU !== null && heelU !== null) {
    const deltaU = Number((toeU - heelU).toFixed(4));
    const absDeltaU = Math.abs(deltaU);

    const isNormalizedDomain = toeU <= 1.0 && heelU <= 1.0;
    const isMetricDomain = Boolean(metricCalibrationSide?.scaleCmPerPx) || !isNormalizedDomain;
    const deadZone = isMetricDomain ? thresholds.MIN_FOOT_SEPARATION_CM : thresholds.MIN_FOOT_SEPARATION_NORMALIZED;

    let footDirection = null;
    let footStatus = 'indeterminate';

    if (absDeltaU < deadZone) {
      footStatus = 'inside_dead_zone';
      warnings.push(`Foot orientation separation (|deltaU| = ${absDeltaU.toFixed(2)}) is within dead-zone threshold (${deadZone}).`);
    } else if (deltaU > 0) {
      footStatus = 'valid';
      footDirection = FACING_DIRECTION.POSITIVE_U;
    } else {
      footStatus = 'valid';
      footDirection = FACING_DIRECTION.NEGATIVE_U;
    }

    footCue = {
      status: footStatus,
      direction: footDirection,
      deltaU,
      absDeltaU,
      deadZoneThreshold: deadZone,
      toeAnchor: { name: toeName, u: toeU },
      heelAnchor: { name: heelName, u: heelU },
    };
  } else {
    footCue = {
      status: 'unavailable',
      direction: null,
      deltaU: null,
      absDeltaU: null,
      deadZoneThreshold: thresholds.MIN_FOOT_SEPARATION_CM,
      toeAnchor: toeName ? { name: toeName, u: toeU } : null,
      heelAnchor: heelName ? { name: heelName, u: heelU } : null,
    };
  }

  // 6. Consensus & Ambiguity Resolution
  let finalStatus = SIDE_ORIENTATION_STATUS.UNAVAILABLE;
  let finalFacingDirection = null;
  let anteriorSide = null;
  let posteriorSide = null;

  const isHeadValid = headCue.status === 'valid' && headCue.direction !== null;
  const isFootValid = footCue.status === 'valid' && footCue.direction !== null;

  if (isHeadValid && isFootValid) {
    if (headCue.direction === footCue.direction) {
      finalStatus = SIDE_ORIENTATION_STATUS.READY;
      finalFacingDirection = headCue.direction;
    } else {
      finalStatus = SIDE_ORIENTATION_STATUS.AMBIGUOUS;
      blockers.push(SIDE_ORIENTATION_BLOCKER_CODES.CONTRADICTING_DIRECTION_CUES);
      issues.push(`Head cue (${headCue.direction}) and foot cue (${footCue.direction}) contradict each other.`);
    }
  } else if (isHeadValid) {
    finalStatus = SIDE_ORIENTATION_STATUS.READY;
    finalFacingDirection = headCue.direction;
    warnings.push('Secondary foot orientation cue unavailable; orientation derived authoritatively from primary head/profile cue.');
  } else if (isFootValid) {
    finalStatus = SIDE_ORIENTATION_STATUS.READY;
    finalFacingDirection = footCue.direction;
    warnings.push('Primary head profile cue unavailable; orientation derived provisionally from secondary foot cue.');
  } else {
    // Both invalid or inside dead zone or unavailable
    finalStatus = SIDE_ORIENTATION_STATUS.UNAVAILABLE;
    blockers.push(SIDE_ORIENTATION_BLOCKER_CODES.INSUFFICIENT_DIRECTIONAL_EVIDENCE);
    issues.push('Neither head profile cue nor foot cue provided sufficient directional separation outside dead-zone thresholds.');
  }

  // 7. Explicit Side-U Endpoint Mapping
  if (finalStatus === SIDE_ORIENTATION_STATUS.READY && finalFacingDirection !== null) {
    if (finalFacingDirection === FACING_DIRECTION.POSITIVE_U) {
      anteriorSide = SIDE_U_ENDPOINT.MAX_U;
      posteriorSide = SIDE_U_ENDPOINT.MIN_U;
    } else if (finalFacingDirection === FACING_DIRECTION.NEGATIVE_U) {
      anteriorSide = SIDE_U_ENDPOINT.MIN_U;
      posteriorSide = SIDE_U_ENDPOINT.MAX_U;
    }
  }

  return {
    contract: SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT,
    version: SIDE_ANTERIOR_POSTERIOR_ORIENTATION_CONTRACT_VERSION,
    view: 'side',
    status: finalStatus,
    facingDirection: finalFacingDirection,
    anteriorSide,
    posteriorSide,
    isQualified: finalStatus === SIDE_ORIENTATION_STATUS.READY,
    evidence: {
      headCue,
      footCue,
      consensus: {
        headDirection: headCue.direction,
        footDirection: footCue.direction,
        isCorroborated: isHeadValid && isFootValid && headCue.direction === footCue.direction,
      },
    },
    blockers,
    warnings,
    issues,
    provenance: {
      thresholds,
      landmarkCount: landmarks.size,
      sideViewOrientationStatus: lateralQualResult?.status ?? null,
    },
    semantics: {
      statement: 'Pure deterministic Side-profile anterior/posterior orientation derived from 2D Side pose landmarks. Identifies whether increasing U (max_u) or decreasing U (min_u) corresponds to anatomical anterior. NOT canonical Z, NOT 3D reconstruction, NOT camera extrinsics.',
      is2dProfileSemanticsOnly: true,
      isCanonicalZ: false,
      is3dReconstruction: false,
    },
  };
}

/**
 * Side T-Pose Qualification Contract v0
 *
 * Pure deterministic domain contract and evaluator qualifying whether a Side-view
 * body pose represents an acceptable T-pose stance (arms extended horizontally away
 * from the torso, straight elbows, upright torso).
 *
 * Contract: 'side-t-pose-qualification-v0'
 * View: 'side'
 *
 * STRICT GUARDRAILS:
 * - Uses Side pose landmarks only; does NOT require Front to be T-pose (Front is A-pose).
 * - Pure 2D/metric coordinate geometry; does NOT use a VLM.
 * - Does NOT infer 3D joint rotations or camera extrinsics.
 * - Centralized, named engineering thresholds.
 */

import { LOW_CONFIDENCE_THRESHOLD } from './bodyEvidenceAdapter.js';

export const SIDE_T_POSE_CONTRACT = 'side-t-pose-qualification-v0';
export const SIDE_T_POSE_CONTRACT_VERSION = 'side-t-pose-qualification-v0';

/**
 * Deterministic status taxonomy for Side T-Pose Qualification.
 * @readonly
 * @enum {string}
 */
export const SIDE_T_POSE_STATUS = Object.freeze({
  QUALIFIED: 'qualified',
  WARNING: 'warning',
  DISQUALIFIED: 'disqualified',
  UNAVAILABLE: 'unavailable',
});

/**
 * Centralized, inspectable engineering qualification thresholds (v0).
 */
export const SIDE_T_POSE_THRESHOLDS = Object.freeze({
  /** Minimum ratio of horizontal arm reach (|U_wrist - U_shoulder|) to total arm length */
  MIN_ARM_EXTENSION_RATIO: 0.70,

  /** Maximum vertical deviation ratio of wrist relative to shoulder (|Y_wrist - Y_shoulder| / torsoHeight) */
  MAX_ARM_ELEVATION_DELTA_RATIO: 0.90,

  /** Maximum vertical deviation ratio of elbow relative to shoulder (|Y_elbow - Y_shoulder| / torsoHeight) */
  MAX_UPPER_ARM_Y_DELTA_RATIO: 0.35,

  /** Maximum vertical deviation ratio of wrist relative to elbow (|Y_wrist - Y_elbow| / torsoHeight) */
  MAX_FOREARM_Y_DELTA_RATIO: 0.35,

  /** Maximum arm inclination angle from horizontal for clean qualification (degrees) */
  MAX_ARM_ANGLE_DEGREES: 20.0,

  /** Boundary angle above which arm inclination produces disqualification (degrees) */
  WARNING_ARM_ANGLE_DEGREES: 35.0,

  /** Maximum elbow bend angle for a clean straight arm (degrees) */
  MAX_ELBOW_BEND_DEGREES: 30.0,

  /** Boundary elbow bend angle above which elbow produces disqualification (degrees) */
  WARNING_ELBOW_BEND_DEGREES: 45.0,

  /** Maximum vertical tilt ratio between left and right shoulder (|Y_left - Y_right| / torsoHeight) */
  MAX_SHOULDER_TILT_RATIO: 0.15,

  /** Minimum landmark detection confidence */
  MIN_LANDMARK_CONFIDENCE: LOW_CONFIDENCE_THRESHOLD,
});

/**
 * Normalizes input pose representation to a Map<string, { u: number, y: number, score: number|null }>.
 *
 * @param {object|Array|Map|null|undefined} poseSource
 * @returns {Map<string, { u: number, y: number, score: number|null }>}
 */
export function extractSideLandmarksMap(poseSource) {
  const map = new Map();
  if (!poseSource) return map;

  const addPoint = (name, u, y, score) => {
    if (typeof name === 'string' && u !== null && y !== null && Number.isFinite(u) && Number.isFinite(y)) {
      map.set(name.toLowerCase().trim(), { u, y, score: typeof score === 'number' && Number.isFinite(score) ? score : null });
    }
  };

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

  // View package with pose.acceptedLandmarks
  const candidateList = Array.isArray(poseSource)
    ? poseSource
    : (Array.isArray(poseSource.acceptedLandmarks)
      ? poseSource.acceptedLandmarks
      : (Array.isArray(poseSource.pose?.acceptedLandmarks)
        ? poseSource.pose.acceptedLandmarks
        : (Array.isArray(poseSource.instances?.[0]?.keypoints) ? null : null)));

  if (Array.isArray(candidateList)) {
    for (const lm of candidateList) {
      if (lm && typeof lm.name === 'string') {
        const u = lm.sideUcm ?? lm.u ?? lm.x ?? lm.imageX ?? lm.xPx ?? null;
        const y = lm.sideYcm ?? lm.y ?? lm.imageY ?? lm.yPx ?? null;
        const score = typeof lm.score === 'number' ? lm.score : (typeof lm.confidence === 'number' ? lm.confidence : null);
        addPoint(lm.name, u, y, score);
      }
    }
    return map;
  }

  // Raw keypoints_named object
  const keypointsNamed = poseSource.keypoints_named ?? poseSource.pose?.keypoints_named;
  if (keypointsNamed && typeof keypointsNamed === 'object') {
    for (const [name, coords] of Object.entries(keypointsNamed)) {
      if (Array.isArray(coords) && coords.length >= 2) {
        addPoint(name, coords[0], coords[1], coords[2] ?? 1.0);
      }
    }
    return map;
  }

  // Raw instances array from pose JSON
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
 * Calculates Euclidean distance between two 2D points.
 */
function dist2d(p1, p2) {
  const du = p1.u - p2.u;
  const dy = p1.y - p2.y;
  return Math.sqrt(du * du + dy * dy);
}

/**
 * Calculates the elbow bend angle in degrees between shoulder->elbow and elbow->wrist vectors.
 * 0 degrees = perfectly straight line; 90 degrees = right angle bend.
 */
function calculateElbowBendAngle(shoulder, elbow, wrist) {
  const v1u = elbow.u - shoulder.u;
  const v1y = elbow.y - shoulder.y;
  const v2u = wrist.u - elbow.u;
  const v2y = wrist.y - elbow.y;

  const len1 = Math.sqrt(v1u * v1u + v1y * v1y);
  const len2 = Math.sqrt(v2u * v2u + v2y * v2y);

  if (len1 < 1e-4 || len2 < 1e-4) return 0.0;

  const dot = (v1u * v2u + v1y * v2y) / (len1 * len2);
  const clampedDot = Math.max(-1.0, Math.min(1.0, dot));
  const angleRad = Math.acos(clampedDot);
  return (angleRad * 180.0) / Math.PI;
}

/**
 * Evaluates Side T-pose stance quality from Side pose evidence.
 *
 * @param {object|Array|Map|null|undefined} sidePoseSource - Side view pose evidence
 * @param {object} [options]
 * @param {typeof SIDE_T_POSE_THRESHOLDS} [options.thresholds]
 * @returns {object} SideTPoseQualificationResult
 */
export function evaluateSidePoseQualification(sidePoseSource, {
  thresholds = SIDE_T_POSE_THRESHOLDS,
} = {}) {
  const issues = [];
  const warnings = [];
  const checks = [];

  const addCheck = (id, name, status, message, details = {}) => {
    checks.push({
      id,
      name,
      status, // 'pass' | 'warning' | 'fail' | 'skip'
      message,
      details,
    });
  };

  const landmarks = extractSideLandmarksMap(sidePoseSource);

  if (landmarks.size === 0) {
    addCheck('side_pose_presence', 'Side Pose Presence', 'fail', 'No Side pose landmarks found in input evidence.');
    issues.push('Missing Side pose landmarks.');
    return {
      contract: SIDE_T_POSE_CONTRACT,
      version: SIDE_T_POSE_CONTRACT_VERSION,
      view: 'side',
      status: SIDE_T_POSE_STATUS.UNAVAILABLE,
      qualified: false,
      checks,
      summary: { evaluatedArms: [], dominantArm: null, armCount: 0 },
      issues,
      warnings,
      provenance: { thresholds },
    };
  }

  addCheck('side_pose_presence', 'Side Pose Presence', 'pass', `Loaded ${landmarks.size} Side pose landmarks.`);

  // 1. Identify Torso Scale Reference
  const leftShoulder = landmarks.get('left_shoulder');
  const rightShoulder = landmarks.get('right_shoulder');
  const leftHip = landmarks.get('left_hip');
  const rightHip = landmarks.get('right_hip');

  const shoulderY = (leftShoulder && rightShoulder)
    ? (leftShoulder.y + rightShoulder.y) / 2
    : (leftShoulder?.y ?? rightShoulder?.y ?? null);

  const hipY = (leftHip && rightHip)
    ? (leftHip.y + rightHip.y) / 2
    : (leftHip?.y ?? rightHip?.y ?? null);

  let torsoHeight = 40.0; // fallback standard normalized/metric span
  if (shoulderY !== null && hipY !== null && Math.abs(hipY - shoulderY) > 1.0) {
    torsoHeight = Math.abs(hipY - shoulderY);
  }

  // 2. Identify Arm Landmarks
  const minConf = thresholds.MIN_LANDMARK_CONFIDENCE;
  const isConf = (pt) => pt && (pt.score === null || pt.score >= minConf);

  const hasLeftArm = isConf(landmarks.get('left_shoulder'))
    && isConf(landmarks.get('left_elbow'))
    && isConf(landmarks.get('left_wrist'));

  const hasRightArm = isConf(landmarks.get('right_shoulder'))
    && isConf(landmarks.get('right_elbow'))
    && isConf(landmarks.get('right_wrist'));

  const evaluatedArms = [];
  if (hasLeftArm) evaluatedArms.push('left');
  if (hasRightArm) evaluatedArms.push('right');

  if (evaluatedArms.length === 0) {
    addCheck(
      'side_arm_landmarks_presence',
      'Side Arm Landmarks Presence',
      'fail',
      `No complete arm (shoulder, elbow, wrist) found with confidence >= ${minConf}.`,
      { leftComplete: hasLeftArm, rightComplete: hasRightArm },
    );
    issues.push('Missing complete arm landmarks in Side view.');
    return {
      contract: SIDE_T_POSE_CONTRACT,
      version: SIDE_T_POSE_CONTRACT_VERSION,
      view: 'side',
      status: SIDE_T_POSE_STATUS.UNAVAILABLE,
      qualified: false,
      checks,
      summary: { evaluatedArms: [], dominantArm: null, armCount: 0 },
      issues,
      warnings,
      provenance: { thresholds, torsoHeight },
    };
  }

  addCheck(
    'side_arm_landmarks_presence',
    'Side Arm Landmarks Presence',
    'pass',
    `Found complete arm landmarks for: [${evaluatedArms.join(', ')}].`,
    { evaluatedArms },
  );

  // 3. Evaluate Geometry per Arm
  let allArmsQualified = true;
  let hasDisqualification = false;
  let hasWarning = false;
  const armSummaries = {};

  for (const armKey of evaluatedArms) {
    const s = landmarks.get(`${armKey}_shoulder`);
    const e = landmarks.get(`${armKey}_elbow`);
    const w = landmarks.get(`${armKey}_wrist`);

    const upperArmLen = dist2d(s, e);
    const forearmLen = dist2d(e, w);
    const totalArmLen = upperArmLen + forearmLen;

    const horizontalReach = Math.abs(w.u - s.u);
    const extensionRatio = totalArmLen > 0 ? horizontalReach / totalArmLen : 0;

    const upperDeltaY = Math.abs(e.y - s.y);
    const forearmDeltaY = Math.abs(w.y - e.y);
    const totalDeltaY = Math.abs(w.y - s.y);

    const upperYRatio = upperDeltaY / torsoHeight;
    const forearmYRatio = forearmDeltaY / torsoHeight;
    const totalYRatio = totalDeltaY / torsoHeight;

    const armAngleDegrees = (Math.atan2(totalDeltaY, Math.max(0.1, horizontalReach)) * 180.0) / Math.PI;
    const bendDegrees = calculateElbowBendAngle(s, e, w);

    armSummaries[armKey] = {
      extensionRatio,
      totalYRatio,
      armAngleDegrees,
      bendDegrees,
    };

    // Check Arm Extension
    if (extensionRatio < thresholds.MIN_ARM_EXTENSION_RATIO) {
      addCheck(
        `${armKey}_arm_extension`,
        `${armKey.toUpperCase()} Arm Extension`,
        'fail',
        `${armKey} arm horizontal extension ratio (${extensionRatio.toFixed(2)}) is below threshold (${thresholds.MIN_ARM_EXTENSION_RATIO}).`,
        { extensionRatio, threshold: thresholds.MIN_ARM_EXTENSION_RATIO },
      );
      issues.push(`${armKey} arm is not extended horizontally away from torso.`);
      hasDisqualification = true;
      allArmsQualified = false;
    } else {
      addCheck(
        `${armKey}_arm_extension`,
        `${armKey.toUpperCase()} Arm Extension`,
        'pass',
        `${armKey} arm extended horizontally (ratio: ${extensionRatio.toFixed(2)} >= ${thresholds.MIN_ARM_EXTENSION_RATIO}).`,
        { extensionRatio },
      );
    }

    // Check Arm Elevation Alignment
    if (armAngleDegrees > thresholds.WARNING_ARM_ANGLE_DEGREES || totalYRatio > thresholds.MAX_ARM_ELEVATION_DELTA_RATIO) {
      addCheck(
        `${armKey}_arm_elevation_alignment`,
        `${armKey.toUpperCase()} Arm Elevation Alignment`,
        'fail',
        `${armKey} arm angle (${armAngleDegrees.toFixed(1)}°) or Y deviation (${totalYRatio.toFixed(2)}) exceeds allowable T-pose tolerance.`,
        { armAngleDegrees, totalYRatio },
      );
      issues.push(`${armKey} arm is significantly lowered or raised (${armAngleDegrees.toFixed(1)}°).`);
      hasDisqualification = true;
      allArmsQualified = false;
    } else if (armAngleDegrees > thresholds.MAX_ARM_ANGLE_DEGREES) {
      addCheck(
        `${armKey}_arm_elevation_alignment`,
        `${armKey.toUpperCase()} Arm Elevation Alignment`,
        'warning',
        `${armKey} arm angle (${armAngleDegrees.toFixed(1)}°) is slightly tilted (warning threshold: ${thresholds.MAX_ARM_ANGLE_DEGREES}°).`,
        { armAngleDegrees, totalYRatio },
      );
      warnings.push(`${armKey} arm has slight elevation tilt (${armAngleDegrees.toFixed(1)}°).`);
      hasWarning = true;
    } else {
      addCheck(
        `${armKey}_arm_elevation_alignment`,
        `${armKey.toUpperCase()} Arm Elevation Alignment`,
        'pass',
        `${armKey} arm is horizontally aligned (${armAngleDegrees.toFixed(1)}° <= ${thresholds.MAX_ARM_ANGLE_DEGREES}°).`,
        { armAngleDegrees, totalYRatio },
      );
    }

    // Check Elbow Straightness
    if (bendDegrees > thresholds.WARNING_ELBOW_BEND_DEGREES) {
      addCheck(
        `${armKey}_elbow_straightness`,
        `${armKey.toUpperCase()} Elbow Straightness`,
        'fail',
        `${armKey} elbow is bent (${bendDegrees.toFixed(1)}° > ${thresholds.WARNING_ELBOW_BEND_DEGREES}°).`,
        { bendDegrees, threshold: thresholds.WARNING_ELBOW_BEND_DEGREES },
      );
      issues.push(`${armKey} elbow is significantly bent (${bendDegrees.toFixed(1)}°).`);
      hasDisqualification = true;
      allArmsQualified = false;
    } else if (bendDegrees > thresholds.MAX_ELBOW_BEND_DEGREES) {
      addCheck(
        `${armKey}_elbow_straightness`,
        `${armKey.toUpperCase()} Elbow Straightness`,
        'warning',
        `${armKey} elbow exhibits moderate bend (${bendDegrees.toFixed(1)}° > ${thresholds.MAX_ELBOW_BEND_DEGREES}°).`,
        { bendDegrees, threshold: thresholds.MAX_ELBOW_BEND_DEGREES },
      );
      warnings.push(`${armKey} elbow is moderately bent (${bendDegrees.toFixed(1)}°).`);
      hasWarning = true;
    } else {
      addCheck(
        `${armKey}_elbow_straightness`,
        `${armKey.toUpperCase()} Elbow Straightness`,
        'pass',
        `${armKey} elbow is straight (${bendDegrees.toFixed(1)}° <= ${thresholds.MAX_ELBOW_BEND_DEGREES}°).`,
        { bendDegrees },
      );
    }
  }

  // 4. Shoulder Elevation Asymmetry (if bilateral shoulders present)
  if (isConf(leftShoulder) && isConf(rightShoulder)) {
    const shoulderDeltaY = Math.abs(leftShoulder.y - rightShoulder.y);
    const shoulderTiltRatio = shoulderDeltaY / torsoHeight;
    if (shoulderTiltRatio > thresholds.MAX_SHOULDER_TILT_RATIO) {
      addCheck(
        'shoulder_elevation_asymmetry',
        'Shoulder Elevation Asymmetry',
        'warning',
        `Shoulder elevation delta ratio (${shoulderTiltRatio.toFixed(2)}) indicates torso tilt.`,
        { shoulderTiltRatio, threshold: thresholds.MAX_SHOULDER_TILT_RATIO },
      );
      warnings.push(`Shoulder elevation asymmetry (${shoulderTiltRatio.toFixed(2)}).`);
      hasWarning = true;
    } else {
      addCheck(
        'shoulder_elevation_asymmetry',
        'Shoulder Elevation Asymmetry',
        'pass',
        `Shoulder elevations are symmetric (tilt ratio: ${shoulderTiltRatio.toFixed(2)} <= ${thresholds.MAX_SHOULDER_TILT_RATIO}).`,
        { shoulderTiltRatio },
      );
    }
  }

  // 5. Aggregate Status
  let status = SIDE_T_POSE_STATUS.QUALIFIED;
  if (hasDisqualification) {
    status = SIDE_T_POSE_STATUS.DISQUALIFIED;
  } else if (hasWarning) {
    status = SIDE_T_POSE_STATUS.WARNING;
  }

  const qualified = status === SIDE_T_POSE_STATUS.QUALIFIED;
  const dominantArm = evaluatedArms.length > 0 ? evaluatedArms[0] : null;

  return {
    contract: SIDE_T_POSE_CONTRACT,
    version: SIDE_T_POSE_CONTRACT_VERSION,
    view: 'side',
    status,
    qualified,
    checks,
    summary: {
      evaluatedArms,
      dominantArm,
      armCount: evaluatedArms.length,
      armSummaries,
    },
    issues,
    warnings,
    provenance: {
      thresholds,
      torsoHeight,
    },
  };
}

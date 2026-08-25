/**
 * Approximately-Lateral Side View Qualification Contract v0
 *
 * Pure deterministic domain contract that evaluates whether a Side-view acquisition
 * is sufficiently consistent with a lateral/profile projection using Front-Side
 * bilateral landmark collapse consensus and supporting segmentation evidence.
 *
 * Contract: 'side-view-orientation-qualification-v0'
 *
 * STRICT GUARDRAILS:
 * - Authoritative semantic: 'approximately lateral / lateral-compatible'.
 * - Does NOT claim exact camera yaw (e.g. cameraYaw = 90°) or camera extrinsics.
 * - Compares stable body pairs (shoulders, hips, knees, ankles) ONLY.
 * - Wrists and elbows are strictly EXCLUDED because Front is A-pose and Side is T-pose.
 * - Centralized, named engineering thresholds.
 */

import { LOW_CONFIDENCE_THRESHOLD } from './bodyEvidenceAdapter.js';

export const SIDE_VIEW_ORIENTATION_CONTRACT = 'side-view-orientation-qualification-v0';
export const SIDE_VIEW_ORIENTATION_CONTRACT_VERSION = 'side-view-orientation-qualification-v0';

/**
 * Deterministic status taxonomy for Approximately-Lateral Side View Qualification.
 * @readonly
 * @enum {string}
 */
export const SIDE_VIEW_ORIENTATION_STATUS = Object.freeze({
  QUALIFIED: 'qualified',
  WARNING: 'warning',
  DISQUALIFIED: 'disqualified',
  UNAVAILABLE: 'unavailable',
});

/**
 * Stable bilateral body landmark pairs for Front-Side lateral collapse comparison.
 * Wrists and elbows are intentionally omitted due to Front A-pose / Side T-pose asymmetry.
 */
export const STABLE_BILATERAL_LANDMARK_PAIRS = Object.freeze([
  Object.freeze({ id: 'shoulders', name: 'Shoulders', left: 'left_shoulder', right: 'right_shoulder' }),
  Object.freeze({ id: 'hips', name: 'Hips', left: 'left_hip', right: 'right_hip' }),
  Object.freeze({ id: 'knees', name: 'Knees', left: 'left_knee', right: 'right_knee' }),
  Object.freeze({ id: 'ankles', name: 'Ankles', left: 'left_ankle', right: 'right_ankle' }),
]);

/**
 * Centralized, inspectable engineering qualification thresholds (v0).
 */
export const SIDE_LATERAL_ORIENTATION_THRESHOLDS = Object.freeze({
  /** Maximum collapse ratio (|U_left - U_right| / |X_left - X_right|) for a clean lateral pair */
  MAX_COLLAPSE_RATIO_QUALIFIED: 0.35,

  /** Boundary collapse ratio above which a pair is considered uncollapsed/frontal */
  MAX_COLLAPSE_RATIO_WARNING: 0.50,

  /** Minimum number of usable bilateral landmark pairs required for consensus */
  MIN_USABLE_BILATERAL_PAIRS: 2,

  /** Minimum landmark detection confidence */
  MIN_LANDMARK_CONFIDENCE: LOW_CONFIDENCE_THRESHOLD,
});

/**
 * Normalizes input Front or Side pose representation to a Map<string, { coord: number, y: number, score: number|null }>.
 *
 * @param {object|Array|Map|null|undefined} poseSource
 * @param {'front'|'side'} [view='front']
 * @returns {Map<string, { coord: number, y: number, score: number|null }>}
 */
function extractCoordinateMap(poseSource, view = 'front') {
  const map = new Map();
  if (!poseSource) return map;

  const addPoint = (name, c, y, score) => {
    if (typeof name === 'string' && c !== null && y !== null && Number.isFinite(c) && Number.isFinite(y)) {
      map.set(name.toLowerCase().trim(), { coord: c, y, score: typeof score === 'number' && Number.isFinite(score) ? score : null });
    }
  };

  if (poseSource instanceof Map) {
    for (const [name, pt] of poseSource.entries()) {
      if (pt && typeof pt === 'object') {
        const c = view === 'side'
          ? (pt.sideUcm ?? pt.u ?? pt.x ?? pt.imageX ?? null)
          : (pt.spaceX ?? pt.x ?? pt.imageX ?? null);
        const y = pt.sideYcm ?? pt.spaceY ?? pt.y ?? pt.imageY ?? null;
        addPoint(name, c, y, pt.score ?? pt.confidence ?? null);
      }
    }
    return map;
  }

  // Check array of annotations or acceptedLandmarks
  const list = Array.isArray(poseSource)
    ? poseSource
    : (Array.isArray(poseSource.acceptedLandmarks)
      ? poseSource.acceptedLandmarks
      : (Array.isArray(poseSource.pose?.acceptedLandmarks)
        ? poseSource.pose.acceptedLandmarks
        : (Array.isArray(poseSource.instances?.[0]?.keypoints) ? null : null)));

  if (Array.isArray(list)) {
    for (const lm of list) {
      if (lm && typeof lm.name === 'string') {
        // Annotation object shape
        const point = lm.point ?? lm.position ?? null;
        if (point) {
          addPoint(lm.name, point.x, point.y, 1.0);
          continue;
        }

        const c = view === 'side'
          ? (lm.sideUcm ?? lm.u ?? lm.x ?? lm.imageX ?? lm.xPx ?? null)
          : (lm.spaceX ?? lm.x ?? lm.imageX ?? lm.xPx ?? null);
        const y = lm.sideYcm ?? lm.spaceY ?? lm.y ?? lm.imageY ?? lm.yPx ?? null;
        const score = typeof lm.score === 'number' ? lm.score : (typeof lm.confidence === 'number' ? lm.confidence : null);
        addPoint(lm.name, c, y, score);
      }
    }
    return map;
  }

  // Raw keypoints_named
  const keypointsNamed = poseSource.keypoints_named ?? poseSource.pose?.keypoints_named;
  if (keypointsNamed && typeof keypointsNamed === 'object') {
    for (const [name, coords] of Object.entries(keypointsNamed)) {
      if (Array.isArray(coords) && coords.length >= 2) {
        addPoint(name, coords[0], coords[1], coords[2] ?? 1.0);
      }
    }
    return map;
  }

  return map;
}

/**
 * Evaluates approximately-lateral orientation consistency from Front and Side evidence.
 *
 * @param {object} options
 * @param {object|Array|Map|null|undefined} options.frontPoseSource - Front pose evidence (A-pose)
 * @param {object|Array|Map|null|undefined} options.sidePoseSource - Side pose evidence (T-pose)
 * @param {object|null} [options.sideSegmentation] - Optional Side segmentation object
 * @param {typeof SIDE_LATERAL_ORIENTATION_THRESHOLDS} [options.thresholds]
 * @returns {object} SideViewOrientationQualificationResult
 */
export function evaluateSideViewOrientationQualification({
  frontPoseSource = null,
  sidePoseSource = null,
  sideSegmentation = null,
  thresholds = SIDE_LATERAL_ORIENTATION_THRESHOLDS,
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

  const frontMap = extractCoordinateMap(frontPoseSource, 'front');
  const sideMap = extractCoordinateMap(sidePoseSource, 'side');

  if (frontMap.size === 0 || sideMap.size === 0) {
    addCheck(
      'bilateral_evidence_presence',
      'Bilateral Evidence Presence',
      'fail',
      `Insufficient Front (${frontMap.size}) or Side (${sideMap.size}) landmarks for lateral collapse analysis.`,
      { frontLandmarkCount: frontMap.size, sideLandmarkCount: sideMap.size },
    );
    issues.push('Missing Front or Side landmark sets for lateral view qualification.');
    return {
      contract: SIDE_VIEW_ORIENTATION_CONTRACT,
      version: SIDE_VIEW_ORIENTATION_CONTRACT_VERSION,
      view: 'side',
      status: SIDE_VIEW_ORIENTATION_STATUS.UNAVAILABLE,
      qualified: false,
      orientationSemantics: 'unqualified',
      pairEvaluations: [],
      summary: { usablePairsCount: 0, passedPairsCount: 0, aggregateCollapseRatio: null },
      checks,
      issues,
      warnings,
      provenance: { thresholds, exactYawClaimed: null, cameraYawDegrees: null },
    };
  }

  addCheck(
    'bilateral_evidence_presence',
    'Bilateral Evidence Presence',
    'pass',
    `Loaded ${frontMap.size} Front and ${sideMap.size} Side landmarks.`,
  );

  const minConf = thresholds.MIN_LANDMARK_CONFIDENCE;
  const isConf = (pt) => pt && (pt.score === null || pt.score >= minConf);

  const pairEvaluations = [];
  let usableCount = 0;
  let passedCount = 0;
  let warningCount = 0;
  let failedCount = 0;
  let totalRatioSum = 0;

  for (const pairDef of STABLE_BILATERAL_LANDMARK_PAIRS) {
    const fLeft = frontMap.get(pairDef.left);
    const fRight = frontMap.get(pairDef.right);
    const sLeft = sideMap.get(pairDef.left);
    const sRight = sideMap.get(pairDef.right);

    const fOk = isConf(fLeft) && isConf(fRight);
    const sOk = isConf(sLeft) && isConf(sRight);

    if (!fOk || !sOk) {
      pairEvaluations.push({
        pairId: pairDef.id,
        name: pairDef.name,
        status: 'unavailable',
        frontSeparation: null,
        sideSeparation: null,
        collapseRatio: null,
        message: `Landmarks for ${pairDef.name} not fully present with confidence >= ${minConf}.`,
      });
      continue;
    }

    const frontSeparation = Math.abs(fLeft.coord - fRight.coord);
    const sideSeparation = Math.abs(sLeft.coord - sRight.coord);

    if (frontSeparation < 1e-3) {
      pairEvaluations.push({
        pairId: pairDef.id,
        name: pairDef.name,
        status: 'unavailable',
        frontSeparation,
        sideSeparation,
        collapseRatio: null,
        message: `Front separation for ${pairDef.name} is near zero.`,
      });
      continue;
    }

    const collapseRatio = sideSeparation / frontSeparation;
    usableCount += 1;
    totalRatioSum += collapseRatio;

    let pairStatus;
    if (collapseRatio <= thresholds.MAX_COLLAPSE_RATIO_QUALIFIED) {
      pairStatus = 'pass';
      passedCount += 1;
    } else if (collapseRatio <= thresholds.MAX_COLLAPSE_RATIO_WARNING) {
      pairStatus = 'warning';
      warningCount += 1;
    } else {
      pairStatus = 'fail';
      failedCount += 1;
    }

    pairEvaluations.push({
      pairId: pairDef.id,
      name: pairDef.name,
      status: pairStatus,
      frontSeparation,
      sideSeparation,
      collapseRatio,
      message: `${pairDef.name} collapse ratio: ${collapseRatio.toFixed(3)} (Front: ${frontSeparation.toFixed(1)}, Side: ${sideSeparation.toFixed(1)}).`,
    });
  }

  // Consensus Evaluation
  const aggregateCollapseRatio = usableCount > 0 ? totalRatioSum / usableCount : null;

  if (usableCount < thresholds.MIN_USABLE_BILATERAL_PAIRS) {
    if (usableCount === 0) {
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'fail',
        'No usable stable bilateral landmark pairs available for lateral consensus.',
        { usableCount, required: thresholds.MIN_USABLE_BILATERAL_PAIRS },
      );
      issues.push('Insufficient usable bilateral landmark pairs for lateral collapse analysis.');
      return {
        contract: SIDE_VIEW_ORIENTATION_CONTRACT,
        version: SIDE_VIEW_ORIENTATION_CONTRACT_VERSION,
        view: 'side',
        status: SIDE_VIEW_ORIENTATION_STATUS.UNAVAILABLE,
        qualified: false,
        orientationSemantics: 'unqualified',
        pairEvaluations,
        summary: { usablePairsCount: usableCount, passedPairsCount: passedCount, aggregateCollapseRatio },
        checks,
        issues,
        warnings,
        provenance: { thresholds, exactYawClaimed: null, cameraYawDegrees: null },
      };
    }

    // Only 1 usable pair
    if (passedCount === 1) {
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'warning',
        'Only 1 usable bilateral landmark pair available; multi-pair consensus incomplete.',
        { usableCount, required: thresholds.MIN_USABLE_BILATERAL_PAIRS, aggregateCollapseRatio },
      );
      warnings.push('Only 1 usable bilateral landmark pair available; lateral consensus is provisional.');
    } else {
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'fail',
        'Single available bilateral landmark pair failed lateral collapse.',
        { usableCount, aggregateCollapseRatio },
      );
      issues.push('Bilateral landmark separation indicates non-lateral view.');
    }
  } else {
    // Multi-pair consensus (>= 2 usable pairs)
    if (failedCount === 0 && warningCount === 0) {
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'pass',
        `All ${usableCount} usable bilateral pairs passed lateral collapse (aggregate ratio: ${aggregateCollapseRatio.toFixed(3)} <= ${thresholds.MAX_COLLAPSE_RATIO_QUALIFIED}).`,
        { usableCount, passedCount, aggregateCollapseRatio },
      );
    } else if (failedCount === 0 && warningCount > 0) {
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'warning',
        `Bilateral pairs passed with ${warningCount} marginal warning(s) (aggregate ratio: ${aggregateCollapseRatio.toFixed(3)}).`,
        { usableCount, passedCount, warningCount, aggregateCollapseRatio },
      );
      warnings.push(`Bilateral landmark collapse exhibits marginal warning in ${warningCount} pair(s).`);
    } else if (failedCount === 1 && passedCount >= 2 && aggregateCollapseRatio <= thresholds.MAX_COLLAPSE_RATIO_QUALIFIED + 0.05) {
      // 1 noisy pair with strong multi-pair consensus
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'warning',
        `Single noisy pair failed, but strong multi-pair consensus holds (${passedCount} passed, aggregate ratio: ${aggregateCollapseRatio.toFixed(3)}).`,
        { usableCount, passedCount, failedCount, aggregateCollapseRatio },
      );
      warnings.push('Single noisy bilateral pair observed, but strong multi-pair consensus supports approximately lateral orientation.');
    } else {
      addCheck(
        'bilateral_collapse_consensus',
        'Bilateral Landmark Collapse Consensus',
        'fail',
        `Bilateral landmark separations remain uncollapsed / Front-like (${failedCount} failed, aggregate ratio: ${aggregateCollapseRatio.toFixed(3)} > ${thresholds.MAX_COLLAPSE_RATIO_WARNING}).`,
        { usableCount, passedCount, failedCount, aggregateCollapseRatio },
      );
      issues.push(`Bilateral landmark separations remain strongly Front-like in Side view (${failedCount} pair(s) uncollapsed).`);
    }
  }

  // Supporting Check: Side Segmentation
  if (sideSegmentation) {
    const hasRaster = Boolean(sideSegmentation.raster || sideSegmentation.classes?.length);
    if (hasRaster) {
      addCheck('side_segmentation_support', 'Side Segmentation Support', 'pass', 'Valid Side segmentation evidence present.');
    } else {
      addCheck('side_segmentation_support', 'Side Segmentation Support', 'warning', 'Side segmentation raster is empty or unpopulated.');
      warnings.push('Side segmentation raster is unpopulated.');
    }
  }

  // Status Resolution
  let status = SIDE_VIEW_ORIENTATION_STATUS.QUALIFIED;
  if (failedCount >= 2 || (usableCount >= 2 && aggregateCollapseRatio > thresholds.MAX_COLLAPSE_RATIO_WARNING) || (usableCount === 1 && passedCount === 0)) {
    status = SIDE_VIEW_ORIENTATION_STATUS.DISQUALIFIED;
  } else if (warningCount > 0 || failedCount === 1 || usableCount < thresholds.MIN_USABLE_BILATERAL_PAIRS) {
    status = SIDE_VIEW_ORIENTATION_STATUS.WARNING;
  }

  const qualified = status === SIDE_VIEW_ORIENTATION_STATUS.QUALIFIED;
  const orientationSemantics = qualified
    ? 'approximately_lateral'
    : (status === SIDE_VIEW_ORIENTATION_STATUS.WARNING ? 'provisional_approximately_lateral' : 'unqualified');

  return {
    contract: SIDE_VIEW_ORIENTATION_CONTRACT,
    version: SIDE_VIEW_ORIENTATION_CONTRACT_VERSION,
    view: 'side',
    status,
    qualified,
    orientationSemantics,
    pairEvaluations,
    summary: {
      usablePairsCount: usableCount,
      passedPairsCount: passedCount,
      warningPairsCount: warningCount,
      failedPairsCount: failedCount,
      aggregateCollapseRatio,
    },
    checks,
    issues,
    warnings,
    provenance: {
      thresholds,
      exactYawClaimed: null,
      cameraYawDegrees: null,
      method: 'bilateral_landmark_projection_collapse_consensus',
    },
  };
}

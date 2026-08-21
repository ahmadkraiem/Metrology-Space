/**
 * Authoritative View / Pose Semantics Validation Contract v0
 *
 * Pure deterministic domain contract and evaluator qualifying whether a Front or Side
 * body observation is captured in a sufficiently valid view and stance configuration
 * to be eligible for physical measurement interpretation.
 *
 * Contract: 'view-pose-semantics-v0'
 *
 * STRICT SEMANTIC SEPARATION:
 * - Dimension A: Declared / Pipeline View Identity (routing / category label consistency)
 * - Dimension B: Structural Pose Qualification (landmark completeness, vertical ordering, A-pose limb separation)
 * - Dimension C: Authoritative Physical Orientation Certification (zero-yaw, orthogonal profile, capture fidelity)
 *
 * STRICT GUARDRAILS:
 * - Layers A + B alone evaluate to status: 'partial' (authorized: false).
 * - Status 'validated' and authorized: true require Layer C from a recognized authoritative physical orientation evaluator.
 * - In production v0, NO physical orientation evaluator is implemented (IMPLEMENTED_PHYSICAL_ORIENTATION_EVALUATORS = []).
 * - Therefore, the real Body Pipeline archive evaluates strictly to status: 'partial' and authorized: false.
 * - Does NOT infer continuous yaw/pitch/roll.
 * - Does NOT convert Side U to canonical Z.
 * - Does NOT fuse Front/Side coordinates into 3D geometry.
 * - Caller boolean shortcuts (e.g. { isFront: true } or { status: 'validated' }) are strictly rejected.
 */

import { LOW_CONFIDENCE_THRESHOLD } from './bodyEvidenceAdapter.js';

export const VIEW_POSE_SEMANTICS_CONTRACT = 'view-pose-semantics-v0';
export const VIEW_POSE_SEMANTICS_CONTRACT_VERSION = 'view-pose-semantics-v0';

/**
 * Deterministic status taxonomy for View / Pose Semantics.
 * @readonly
 * @enum {string}
 */
export const VIEW_POSE_STATUS = Object.freeze({
  VALIDATED: 'validated',
  PARTIAL: 'partial',
  UNVALIDATED: 'unvalidated',
  INVALID: 'invalid',
  UNAVAILABLE: 'unavailable',
});

/**
 * Implemented Authoritative Structural Pose Evaluators (v0).
 * Authorizes Layer A (Declared View) and Layer B (Structural Pose) ONLY.
 */
export const IMPLEMENTED_STRUCTURAL_POSE_EVALUATORS = Object.freeze([
  'body-pipeline-structural-pose-evaluator-v0',
]);

/**
 * Implemented Authoritative Physical Orientation Evaluators (v0).
 * Production v0 contains NO implemented physical orientation evaluators.
 */
export const IMPLEMENTED_PHYSICAL_ORIENTATION_EVALUATORS = Object.freeze([]);

/**
 * Reserved Future Physical Orientation Evaluator Identifiers.
 */
export const RESERVED_FUTURE_PHYSICAL_ORIENTATION_EVALUATORS = Object.freeze([
  'controlled-capture-protocol-pose-v0',
  'calibrated-camera-orientation-evaluator-v0',
  'validated-3d-orientation-estimator-v0',
  'human-verified-view-pose-v0',
]);

/**
 * Core Front landmarks required for structural completeness and A-pose verification.
 */
const REQUIRED_FRONT_CORE_LANDMARKS = Object.freeze([
  'neck',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_wrist',
  'right_wrist',
  'left_ankle',
  'right_ankle',
]);

/**
 * Core Side landmarks required for structural completeness and upright stance verification.
 */
const REQUIRED_SIDE_CORE_LANDMARKS = Object.freeze([
  'neck',
  'left_shoulder',
  'right_shoulder',
  'left_hip',
  'right_hip',
  'left_ankle',
  'right_ankle',
]);

/**
 * Internal registry of recognized test-only physical orientation evaluators.
 * Used exclusively in controlled unit tests to verify Layer C integration.
 */
const TEST_ONLY_ORIENTATION_EVALUATORS = new Set();

/**
 * Registers a test-only physical orientation evaluator ID.
 * Exclusively for unit tests; not exposed to production callers.
 *
 * @param {string} evaluatorId
 */
export function _registerTestOrientationEvaluator(evaluatorId) {
  if (typeof evaluatorId === 'string' && evaluatorId.trim()) {
    TEST_ONLY_ORIENTATION_EVALUATORS.add(evaluatorId.trim());
  }
}

/**
 * Clears registered test-only physical orientation evaluators.
 */
export function _clearTestOrientationEvaluators() {
  TEST_ONLY_ORIENTATION_EVALUATORS.clear();
}

/**
 * Helper to build a standardized check result.
 *
 * @param {string} id
 * @param {string} name
 * @param {'integrity'|'view_identity'|'structural_pose'|'physical_orientation'|'provenance'} category
 * @param {'pass'|'fail'|'warning'|'skip'} status
 * @param {string} message
 * @param {string} provenance
 * @returns {object}
 */
function createCheckResult(id, name, category, status, message, provenance = 'view-pose-semantics-v0') {
  return {
    id,
    name,
    category,
    status,
    message,
    provenance,
  };
}

/**
 * Extracts a map of landmark names to { x, y, score } from a view package pose object or array.
 *
 * @param {object|null|undefined} poseSource
 * @returns {Map<string, { x: number, y: number, score: number|null }>}
 */
function extractLandmarksMap(poseSource) {
  const map = new Map();
  if (!poseSource) return map;

  const addPoint = (name, x, y, score) => {
    if (typeof name === 'string' && x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
      map.set(name.toLowerCase().trim(), { x, y, score: score ?? null });
    }
  };

  // 1. Normalized poseStats shape with acceptedLandmarks
  if (Array.isArray(poseSource.acceptedLandmarks)) {
    for (const lm of poseSource.acceptedLandmarks) {
      if (lm && typeof lm.name === 'string') {
        const x = lm.imageX ?? lm.xPx ?? lm.x ?? null;
        const y = lm.imageY ?? lm.yPx ?? lm.y ?? null;
        const score = typeof lm.score === 'number' ? lm.score : (typeof lm.confidence === 'number' ? lm.confidence : null);
        addPoint(lm.name, x, y, score);
      }
    }
  }

  // 2. Direct raw keypoints_named object if present
  if (poseSource.keypoints_named && typeof poseSource.keypoints_named === 'object') {
    for (const [name, coords] of Object.entries(poseSource.keypoints_named)) {
      if (Array.isArray(coords) && coords.length >= 2) {
        addPoint(name, coords[0], coords[1], coords[2] ?? 1.0);
      }
    }
  }

  // 3. Raw instances[0] pose JSON
  if (Array.isArray(poseSource.instances) && poseSource.instances.length > 0) {
    const inst = poseSource.instances[0];
    const names = poseSource.keypoint_names ?? [];
    if (Array.isArray(inst.keypoints) && Array.isArray(names)) {
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const pt = inst.keypoints[i];
        const score = inst.keypoint_scores ? inst.keypoint_scores[i] : null;
        if (Array.isArray(pt) && pt.length >= 2 && typeof name === 'string') {
          addPoint(name, pt[0], pt[1], score);
        }
      }
    }
  }

  return map;
}

/**
 * Pure deterministic evaluation of View and Pose Semantics for a single Front or Side view.
 *
 * @param {object|null|undefined} viewPackage - Normalized view package from bodyEvidencePackage
 * @param {object} [options]
 * @param {'front'|'side'} [options.view] - Target view ('front' or 'side')
 * @param {object|null} [options.aposeEvidence] - Staging metadata from body/Apose/result.json
 * @param {object|null} [options.alignEvidence] - Staging metadata from body/Align/result.json
 * @param {object|null} [options.authoritativePhysicalOrientationResult] - Evaluator result from a recognized physical orientation evaluator
 * @returns {object} ViewPoseValidationResult
 */
export function evaluateViewPoseSemantics(viewPackage, {
  view = null,
  aposeEvidence = null,
  alignEvidence = null,
  authoritativePhysicalOrientationResult = null,
} = {}) {
  const issues = [];
  const warnings = [];
  const checks = {};

  const targetView = (view || viewPackage?.image?.view || viewPackage?.calibration?.view || 'front').toLowerCase().trim();

  // 1. Source Integrity Check
  if (!viewPackage || typeof viewPackage !== 'object') {
    checks.source_integrity = createCheckResult(
      'source_integrity',
      'Source View Package Integrity',
      'integrity',
      'fail',
      `Source evidence package for view '${targetView}' is missing or null.`,
    );
    issues.push(`Source evidence package for view '${targetView}' is missing.`);
    return buildViewPoseResult({
      view: targetView,
      status: VIEW_POSE_STATUS.UNAVAILABLE,
      authorized: false,
      evaluatorId: null,
      declaredViewConsistent: false,
      structuralPoseValidated: false,
      physicalOrientationAuthorized: false,
      checks,
      issues,
      warnings,
    });
  }

  const poseSource = viewPackage.pose ?? null;
  const imageSource = viewPackage.image ?? null;

  if (!poseSource || (poseSource.total === 0 && !poseSource.instances)) {
    checks.source_integrity = createCheckResult(
      'source_integrity',
      'Source View Package Integrity',
      'integrity',
      'fail',
      `Pose keypoint evidence is absent for view '${targetView}'.`,
    );
    issues.push(`Pose keypoint evidence is absent for view '${targetView}'.`);
    return buildViewPoseResult({
      view: targetView,
      status: VIEW_POSE_STATUS.UNAVAILABLE,
      authorized: false,
      evaluatorId: null,
      declaredViewConsistent: false,
      structuralPoseValidated: false,
      physicalOrientationAuthorized: false,
      checks,
      issues,
      warnings,
    });
  }

  checks.source_integrity = createCheckResult(
    'source_integrity',
    'Source View Package Integrity',
    'integrity',
    'pass',
    `View package, image, and pose evidence are present for view '${targetView}'.`,
  );

  // 2. Declared / Pipeline View Identity (Layer A)
  let declaredViewConsistent = false;
  const declaredView = (viewPackage.image?.view ?? viewPackage.calibration?.view ?? targetView).toLowerCase().trim();
  if (declaredView === targetView) {
    declaredViewConsistent = true;
    checks.view_identity_declared = createCheckResult(
      'view_identity_declared',
      'Declared View Identity Consistency',
      'view_identity',
      'pass',
      `Declared pipeline view '${declaredView}' matches requested evaluation view '${targetView}'.`,
    );
  } else {
    checks.view_identity_declared = createCheckResult(
      'view_identity_declared',
      'Declared View Identity Consistency',
      'view_identity',
      'fail',
      `Declared pipeline view '${declaredView}' contradicts requested evaluation view '${targetView}'.`,
    );
    issues.push(`Declared view '${declaredView}' does not match requested view '${targetView}'.`);
  }

  // 3. Structural Pose Qualification (Layer B)
  const landmarksMap = extractLandmarksMap(poseSource);
  let landmarkCompletenessPass = true;
  let verticalOrderPass = true;
  let limbSeparationPass = true;

  const requiredLandmarks = targetView === 'front' ? REQUIRED_FRONT_CORE_LANDMARKS : REQUIRED_SIDE_CORE_LANDMARKS;
  const missingOrLowConfidence = [];

  for (const name of requiredLandmarks) {
    const lm = landmarksMap.get(name);
    if (!lm) {
      missingOrLowConfidence.push(`${name} (missing)`);
      landmarkCompletenessPass = false;
    } else if (lm.score !== null && lm.score < LOW_CONFIDENCE_THRESHOLD) {
      missingOrLowConfidence.push(`${name} (score ${lm.score.toFixed(2)} < ${LOW_CONFIDENCE_THRESHOLD})`);
      landmarkCompletenessPass = false;
    }
  }

  if (landmarkCompletenessPass) {
    checks.landmark_completeness = createCheckResult(
      'landmark_completeness',
      'Core Landmark Completeness',
      'structural_pose',
      'pass',
      `All required core landmarks for view '${targetView}' are present with confidence >= ${LOW_CONFIDENCE_THRESHOLD}.`,
    );
  } else {
    checks.landmark_completeness = createCheckResult(
      'landmark_completeness',
      'Core Landmark Completeness',
      'structural_pose',
      'fail',
      `Core landmarks incomplete for view '${targetView}': [${missingOrLowConfidence.join(', ')}].`,
    );
    issues.push(`Incomplete core landmarks for view '${targetView}': ${missingOrLowConfidence.join(', ')}`);
  }

  // Vertical ordering check: (neck/nose) < shoulder < hip < ankle (in canvas space Y points downwards)
  if (landmarkCompletenessPass) {
    const headOrNeck = landmarksMap.get('neck') || landmarksMap.get('nose');
    const leftShoulder = landmarksMap.get('left_shoulder');
    const rightShoulder = landmarksMap.get('right_shoulder');
    const leftHip = landmarksMap.get('left_hip');
    const rightHip = landmarksMap.get('right_hip');
    const leftAnkle = landmarksMap.get('left_ankle');
    const rightAnkle = landmarksMap.get('right_ankle');

    const topY = headOrNeck ? headOrNeck.y : null;
    const topName = headOrNeck ? (landmarksMap.has('neck') ? 'neck' : 'nose') : null;
    const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
    const avgHipY = (leftHip.y + rightHip.y) / 2;
    const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2;

    const isTopAboveShoulder = topY === null || topY < avgShoulderY;
    const isShoulderAboveHip = avgShoulderY < avgHipY;
    const isHipAboveAnkle = avgHipY < avgAnkleY;

    if (isTopAboveShoulder && isShoulderAboveHip && isHipAboveAnkle) {
      checks.anatomical_vertical_ordering = createCheckResult(
        'anatomical_vertical_ordering',
        'Anatomical Vertical Ordering',
        'structural_pose',
        'pass',
        `Monotonic vertical anatomical ordering confirmed: ${topName ?? 'top'} (${topY ? topY.toFixed(1) : 'N/A'}) < shoulders (${avgShoulderY.toFixed(1)}) < hips (${avgHipY.toFixed(1)}) < ankles (${avgAnkleY.toFixed(1)}).`,
      );
    } else {
      verticalOrderPass = false;
      checks.anatomical_vertical_ordering = createCheckResult(
        'anatomical_vertical_ordering',
        'Anatomical Vertical Ordering',
        'structural_pose',
        'fail',
        `Vertical anatomical inversion detected in view '${targetView}': top=${topY ? topY.toFixed(1) : 'N/A'}, shoulders=${avgShoulderY.toFixed(1)}, hips=${avgHipY.toFixed(1)}, ankles=${avgAnkleY.toFixed(1)}.`,
      );
      issues.push(`Vertical anatomical inversion detected in view '${targetView}'.`);
    }

    // Front A-pose limb separation check: wrists must be laterally outside shoulders
    if (targetView === 'front') {
      const leftWrist = landmarksMap.get('left_wrist');
      const rightWrist = landmarksMap.get('right_wrist');

      // Right wrist is on the left side of the image (smaller X); Left wrist is on the right side (larger X)
      const rightWristAbduced = rightWrist.x < rightShoulder.x;
      const leftWristAbduced = leftWrist.x > leftShoulder.x;

      if (rightWristAbduced && leftWristAbduced) {
        checks.limb_separation_sanity = createCheckResult(
          'limb_separation_sanity',
          'A-Pose Limb Separation Sanity',
          'structural_pose',
          'pass',
          `Bilateral arms are abduced in A-pose: right wrist (${rightWrist.x.toFixed(1)}) < right shoulder (${rightShoulder.x.toFixed(1)}) and left shoulder (${leftShoulder.x.toFixed(1)}) < left wrist (${leftWrist.x.toFixed(1)}).`,
        );
      } else {
        limbSeparationPass = false;
        checks.limb_separation_sanity = createCheckResult(
          'limb_separation_sanity',
          'A-Pose Limb Separation Sanity',
          'structural_pose',
          'fail',
          `Arms not properly abduced in A-pose (risk of trunk occlusion): rightAbduced=${rightWristAbduced}, leftAbduced=${leftWristAbduced}.`,
        );
        issues.push(`Arms not properly abduced in A-pose for Front view.`);
      }
    } else {
      // Side view doesn't enforce horizontal arm abduction
      checks.limb_separation_sanity = createCheckResult(
        'limb_separation_sanity',
        'A-Pose Limb Separation Sanity',
        'structural_pose',
        'skip',
        `A-pose horizontal limb abduction is not applicable to Side profile view.`,
      );
    }
  } else {
    verticalOrderPass = false;
    limbSeparationPass = false;
    checks.anatomical_vertical_ordering = createCheckResult(
      'anatomical_vertical_ordering',
      'Anatomical Vertical Ordering',
      'structural_pose',
      'skip',
      `Skipped due to missing core landmarks.`,
    );
    checks.limb_separation_sanity = createCheckResult(
      'limb_separation_sanity',
      'A-Pose Limb Separation Sanity',
      'structural_pose',
      'skip',
      `Skipped due to missing core landmarks.`,
    );
  }

  const structuralPoseValidated = declaredViewConsistent && landmarkCompletenessPass && verticalOrderPass && limbSeparationPass;

  if (structuralPoseValidated) {
    checks.structural_pose_qualification = createCheckResult(
      'structural_pose_qualification',
      'Overall Structural Pose Qualification',
      'structural_pose',
      'pass',
      `Layer B structural pose qualification passed for view '${targetView}'.`,
    );
  } else {
    checks.structural_pose_qualification = createCheckResult(
      'structural_pose_qualification',
      'Overall Structural Pose Qualification',
      'structural_pose',
      'fail',
      `Layer B structural pose qualification failed for view '${targetView}'.`,
    );
  }

  // 4. Authoritative Physical Orientation Certification (Layer C)
  let physicalOrientationAuthorized = false;
  let physicalOrientationEvaluatorId = null;

  if (
    authoritativePhysicalOrientationResult
    && typeof authoritativePhysicalOrientationResult === 'object'
    && !Array.isArray(authoritativePhysicalOrientationResult)
  ) {
    const rawEvalId = authoritativePhysicalOrientationResult.evaluatorId
      ?? authoritativePhysicalOrientationResult.contract
      ?? null;

    const isRecognizedEvaluator = (typeof rawEvalId === 'string') && (
      IMPLEMENTED_PHYSICAL_ORIENTATION_EVALUATORS.includes(rawEvalId)
      || TEST_ONLY_ORIENTATION_EVALUATORS.has(rawEvalId)
    );

    const hasValidStatus = (
      authoritativePhysicalOrientationResult.status === 'validated'
      || authoritativePhysicalOrientationResult.status === 'pass'
    ) && authoritativePhysicalOrientationResult.authorized === true;

    const matchesView = !authoritativePhysicalOrientationResult.targetView
      || authoritativePhysicalOrientationResult.targetView === 'both'
      || authoritativePhysicalOrientationResult.targetView === targetView;

    if (isRecognizedEvaluator && hasValidStatus && matchesView) {
      physicalOrientationAuthorized = true;
      physicalOrientationEvaluatorId = rawEvalId;
      checks.physical_orientation_certification = createCheckResult(
        'physical_orientation_certification',
        'Physical Orientation Certification',
        'physical_orientation',
        'pass',
        `Authoritative physical orientation certified by recognized evaluator '${rawEvalId}' for view '${targetView}'.`,
        rawEvalId,
      );
    } else if (!isRecognizedEvaluator && rawEvalId) {
      checks.physical_orientation_certification = createCheckResult(
        'physical_orientation_certification',
        'Physical Orientation Certification',
        'physical_orientation',
        'fail',
        `Unrecognized or unverified physical orientation evaluator '${rawEvalId}'. Raw caller objects rejected.`,
      );
      warnings.push(`Unrecognized physical orientation evaluator '${rawEvalId}'.`);
    } else {
      checks.physical_orientation_certification = createCheckResult(
        'physical_orientation_certification',
        'Physical Orientation Certification',
        'physical_orientation',
        'fail',
        `Physical orientation certification failed or targetView mismatch for view '${targetView}'.`,
      );
    }
  } else {
    // Standard real package condition: physical orientation source is absent
    checks.physical_orientation_certification = createCheckResult(
      'physical_orientation_certification',
      'Physical Orientation Certification',
      'physical_orientation',
      'skip',
      `Authoritative physical 3D orientation certification (Layer C) is unavailable in current upstream package evidence.`,
    );
    warnings.push(`Authoritative physical orientation certification is unavailable for view '${targetView}'.`);
  }

  // 5. Evaluator Provenance Check
  const primaryEvaluatorId = physicalOrientationAuthorized
    ? physicalOrientationEvaluatorId
    : 'body-pipeline-structural-pose-evaluator-v0';

  checks.evaluator_provenance = createCheckResult(
    'evaluator_provenance',
    'Evaluator Provenance Qualification',
    'provenance',
    'pass',
    `Evaluation executed by recognized evaluator '${primaryEvaluatorId}'.`,
    primaryEvaluatorId,
  );

  // 6. Overall Status Resolution
  let finalStatus = VIEW_POSE_STATUS.UNVALIDATED;
  let finalAuthorized = false;

  if (!declaredViewConsistent || !landmarkCompletenessPass || !verticalOrderPass || !limbSeparationPass) {
    finalStatus = VIEW_POSE_STATUS.INVALID;
    finalAuthorized = false;
  } else if (structuralPoseValidated && physicalOrientationAuthorized) {
    // Only when BOTH Layer B (structural) AND Layer C (physical orientation) pass
    finalStatus = VIEW_POSE_STATUS.VALIDATED;
    finalAuthorized = true;
  } else if (structuralPoseValidated) {
    // Real package condition: Layer A + Layer B pass, Layer C missing
    finalStatus = VIEW_POSE_STATUS.PARTIAL;
    finalAuthorized = false;
  }

  return buildViewPoseResult({
    view: targetView,
    status: finalStatus,
    authorized: finalAuthorized,
    evaluatorId: primaryEvaluatorId,
    declaredViewConsistent,
    structuralPoseValidated,
    physicalOrientationAuthorized,
    checks,
    issues,
    warnings,
  });
}

/**
 * Builds the canonical normalized ViewPoseValidationResult object.
 *
 * @param {object} params
 * @returns {object} ViewPoseValidationResult
 */
function buildViewPoseResult({
  view,
  status,
  authorized,
  evaluatorId,
  declaredViewConsistent,
  structuralPoseValidated,
  physicalOrientationAuthorized,
  checks,
  issues,
  warnings,
}) {
  const checkList = Object.values(checks);
  const passedChecks = checkList.filter((c) => c.status === 'pass').length;
  const failedChecks = checkList.filter((c) => c.status === 'fail').length;
  const warnedChecks = checkList.filter((c) => c.status === 'warning').length;
  const skippedChecks = checkList.filter((c) => c.status === 'skip').length;

  return {
    contract: VIEW_POSE_SEMANTICS_CONTRACT,
    version: VIEW_POSE_SEMANTICS_CONTRACT_VERSION,
    view,
    targetView: view,
    status,
    authorized,
    evaluatorId,
    dimensions: {
      declaredViewConsistent: Boolean(declaredViewConsistent),
      structuralPoseValidated: Boolean(structuralPoseValidated),
      physicalOrientationAuthorized: Boolean(physicalOrientationAuthorized),
    },
    summary: {
      totalChecks: checkList.length,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
    },
    checks,
    issues,
    warnings,
  };
}

/**
 * Evaluates pure deterministic view and pose semantics across both Front and Side views.
 *
 * @param {object|null|undefined} bodyPackage - Canonical Body Evidence Package
 * @param {object} [options]
 * @param {object|null} [options.authoritativePhysicalOrientationResult]
 * @returns {object|null} ViewPoseSemanticsReport
 */
export function evaluateViewPoseSemanticsReport(bodyPackage, {
  authoritativePhysicalOrientationResult = null,
} = {}) {
  if (!bodyPackage || typeof bodyPackage !== 'object') {
    return null;
  }

  const frontPkg = bodyPackage.front ?? null;
  const sidePkg = bodyPackage.side ?? null;

  const aposeEvidence = bodyPackage.rawSources?.aposeResult ?? null;
  const alignEvidence = bodyPackage.rawSources?.alignResult ?? null;

  const front = evaluateViewPoseSemantics(frontPkg, {
    view: 'front',
    aposeEvidence,
    alignEvidence,
    authoritativePhysicalOrientationResult,
  });

  const side = evaluateViewPoseSemantics(sidePkg, {
    view: 'side',
    aposeEvidence,
    alignEvidence,
    authoritativePhysicalOrientationResult,
  });

  const views = { front, side };
  const viewResults = [front, side];

  let validatedCount = 0;
  let partialCount = 0;
  let unvalidatedCount = 0;
  let invalidCount = 0;
  let unavailableCount = 0;

  for (const res of viewResults) {
    if (res.status === VIEW_POSE_STATUS.VALIDATED) validatedCount += 1;
    else if (res.status === VIEW_POSE_STATUS.PARTIAL) partialCount += 1;
    else if (res.status === VIEW_POSE_STATUS.INVALID) invalidCount += 1;
    else if (res.status === VIEW_POSE_STATUS.UNVALIDATED) unvalidatedCount += 1;
    else unavailableCount += 1;
  }

  const allAuthorized = front.authorized && side.authorized;

  return {
    contract: 'view-pose-semantics-report-v0',
    version: VIEW_POSE_SEMANTICS_CONTRACT_VERSION,
    allAuthorized,
    summary: {
      totalViews: viewResults.length,
      validatedCount,
      partialCount,
      unvalidatedCount,
      invalidCount,
      unavailableCount,
    },
    views,
  };
}

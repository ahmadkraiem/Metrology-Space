/**
 * Direct Body Measurements Contract v0
 *
 * Pure deterministic domain contract that formalizes direct, calibrated 2D metric
 * body measurements from validated anatomical levels and promoted Front body landmarks.
 *
 * Contract: 'direct-body-measurements-v0'
 * View: 'front'
 *
 * Supports strictly Batch A measurements (19 total):
 * 1. Vertical Inter-Level Measurements (5):
 *    - vertical_torso_length_neck_to_hip
 *    - vertical_shoulder_drop_neck_to_shoulder
 *    - vertical_thigh_length_hip_to_knee
 *    - vertical_lower_leg_length_knee_to_ankle
 *    - vertical_total_leg_length_hip_to_ankle
 * 2. Projected Landmark Segment Measurements (10):
 *    - left_upper_arm_segment_length_projected
 *    - right_upper_arm_segment_length_projected
 *    - left_forearm_segment_length_projected
 *    - right_forearm_segment_length_projected
 *    - left_direct_arm_chord_projected
 *    - right_direct_arm_chord_projected
 *    - left_thigh_segment_length_projected
 *    - right_thigh_segment_length_projected
 *    - left_lower_leg_segment_length_projected
 *    - right_lower_leg_segment_length_projected
 * 3. Kinematic Chain Measurements (4):
 *    - left_total_arm_chain_length_projected
 *    - right_total_arm_chain_length_projected
 *    - left_total_leg_chain_length_projected
 *    - right_total_leg_chain_length_projected
 *
 * STRICT GUARDRAILS:
 * - Read-only from promoted Front body landmarks and validated anatomical levels only.
 * - Does not compute absolute heights from floor (Y_ground = 0 is not physical floor).
 * - Does not output Stature as a measured output (declared height is calibration input).
 * - Does not average bilateral left/right limb measurements.
 * - Does not implement circumference or 3D surface geodesics.
 * - Status conventions:
 *   - 'valid': all required evidence valid, finite, and metric calibration validated.
 *   - 'unavailable': missing/insufficient evidence (missing landmark, level, or calibration).
 *   - 'invalid': corrupted/non-finite coordinates or negative distance.
 */

import { computeAnatomicalLevels } from './anatomicalLevels.js';
import { normalizeLandmarkName } from './bodyEvidenceAdapter.js';

export const DIRECT_BODY_MEASUREMENTS_CONTRACT = 'direct-body-measurements-v0';
export const DIRECT_BODY_MEASUREMENTS_CONTRACT_VERSION = 'direct-body-measurements-v0';
export const DIRECT_MEASUREMENTS_VIEW = 'front';

const BODY_LANDMARK_TYPE = 'body_landmark';

/**
 * Exact status enum for direct body measurements.
 * @readonly
 * @enum {string}
 */
export const DIRECT_MEASUREMENT_STATUS = Object.freeze({
  VALID: 'valid',
  UNAVAILABLE: 'unavailable',
  INVALID: 'invalid',
});

/**
 * Output semantics constants.
 * @readonly
 * @enum {string}
 */
export const DIRECT_MEASUREMENT_SEMANTICS = Object.freeze({
  CALIBRATED_RELATIVE_VERTICAL_DISTANCE: 'calibrated_relative_vertical_distance',
  CALIBRATED_PROJECTED_2D_DISTANCE: 'calibrated_projected_2d_distance',
  CALIBRATED_PROJECTED_2D_CHAIN_LENGTH: 'calibrated_projected_2d_chain_length',
});

/**
 * Direct measurement category groupings for reporting and UI presentation.
 * @readonly
 * @enum {string}
 */
export const DIRECT_MEASUREMENT_GROUPS = Object.freeze({
  VERTICAL_INTER_LEVEL: 'vertical_inter_level',
  ARM_SEGMENTS: 'arm_segments',
  LEG_SEGMENTS: 'leg_segments',
});

/**
 * Authoritative registry of supported Batch A direct measurement definitions.
 * Exactly 19 measurements in stable deterministic order.
 */
export const SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0 = Object.freeze({
  // =========================================================================
  // 1. Vertical Inter-Level Measurements (5)
  // =========================================================================
  vertical_torso_length_neck_to_hip: Object.freeze({
    id: 'vertical_torso_length_neck_to_hip',
    canonicalName: 'Vertical Torso Length (Neck to Hip)',
    displayName: 'Vertical Torso Length',
    anatomicalRegion: 'torso',
    group: DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL,
    measurementType: 'length',
    geometryType: 'vertical_inter_level_delta',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze(['neck', 'hip']),
    requiredLandmarks: Object.freeze([]),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'abs(Y_neck_cm - Y_hip_cm)',
  }),

  vertical_shoulder_drop_neck_to_shoulder: Object.freeze({
    id: 'vertical_shoulder_drop_neck_to_shoulder',
    canonicalName: 'Vertical Shoulder Drop (Neck to Shoulder)',
    displayName: 'Vertical Shoulder Drop',
    anatomicalRegion: 'shoulder',
    group: DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL,
    measurementType: 'length',
    geometryType: 'vertical_inter_level_delta',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze(['neck', 'shoulder']),
    requiredLandmarks: Object.freeze([]),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'abs(Y_neck_cm - Y_shoulder_cm)',
  }),

  vertical_thigh_length_hip_to_knee: Object.freeze({
    id: 'vertical_thigh_length_hip_to_knee',
    canonicalName: 'Vertical Thigh Length (Hip to Knee)',
    displayName: 'Vertical Thigh Length',
    anatomicalRegion: 'leg',
    group: DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL,
    measurementType: 'length',
    geometryType: 'vertical_inter_level_delta',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze(['hip', 'knee']),
    requiredLandmarks: Object.freeze([]),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'abs(Y_hip_cm - Y_knee_cm)',
  }),

  vertical_lower_leg_length_knee_to_ankle: Object.freeze({
    id: 'vertical_lower_leg_length_knee_to_ankle',
    canonicalName: 'Vertical Lower Leg Length (Knee to Ankle)',
    displayName: 'Vertical Lower Leg Length',
    anatomicalRegion: 'leg',
    group: DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL,
    measurementType: 'length',
    geometryType: 'vertical_inter_level_delta',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze(['knee', 'ankle']),
    requiredLandmarks: Object.freeze([]),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'abs(Y_knee_cm - Y_ankle_cm)',
  }),

  vertical_total_leg_length_hip_to_ankle: Object.freeze({
    id: 'vertical_total_leg_length_hip_to_ankle',
    canonicalName: 'Vertical Total Leg Length (Hip to Ankle)',
    displayName: 'Vertical Leg Length',
    anatomicalRegion: 'leg',
    group: DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL,
    measurementType: 'length',
    geometryType: 'vertical_inter_level_delta',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_RELATIVE_VERTICAL_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze(['hip', 'ankle']),
    requiredLandmarks: Object.freeze([]),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'abs(Y_hip_cm - Y_ankle_cm)',
  }),

  // =========================================================================
  // 2. Projected Landmark Segment Measurements (10)
  // =========================================================================
  left_upper_arm_segment_length_projected: Object.freeze({
    id: 'left_upper_arm_segment_length_projected',
    canonicalName: 'Left Upper Arm Segment Length (Projected)',
    displayName: 'Left Upper Arm Length',
    anatomicalRegion: 'left_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_shoulder', 'left_elbow']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(left_shoulder, left_elbow)',
  }),

  right_upper_arm_segment_length_projected: Object.freeze({
    id: 'right_upper_arm_segment_length_projected',
    canonicalName: 'Right Upper Arm Segment Length (Projected)',
    displayName: 'Right Upper Arm Length',
    anatomicalRegion: 'right_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_shoulder', 'right_elbow']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(right_shoulder, right_elbow)',
  }),

  left_forearm_segment_length_projected: Object.freeze({
    id: 'left_forearm_segment_length_projected',
    canonicalName: 'Left Forearm Segment Length (Projected)',
    displayName: 'Left Forearm Length',
    anatomicalRegion: 'left_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_elbow', 'left_wrist']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(left_elbow, left_wrist)',
  }),

  right_forearm_segment_length_projected: Object.freeze({
    id: 'right_forearm_segment_length_projected',
    canonicalName: 'Right Forearm Segment Length (Projected)',
    displayName: 'Right Forearm Length',
    anatomicalRegion: 'right_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_elbow', 'right_wrist']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(right_elbow, right_wrist)',
  }),

  left_direct_arm_chord_projected: Object.freeze({
    id: 'left_direct_arm_chord_projected',
    canonicalName: 'Left Direct Arm Chord (Shoulder to Wrist, Projected)',
    displayName: 'Left Direct Arm Chord',
    anatomicalRegion: 'left_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'distance',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_shoulder', 'left_wrist']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(left_shoulder, left_wrist)',
  }),

  right_direct_arm_chord_projected: Object.freeze({
    id: 'right_direct_arm_chord_projected',
    canonicalName: 'Right Direct Arm Chord (Shoulder to Wrist, Projected)',
    displayName: 'Right Direct Arm Chord',
    anatomicalRegion: 'right_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'distance',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_shoulder', 'right_wrist']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(right_shoulder, right_wrist)',
  }),

  left_thigh_segment_length_projected: Object.freeze({
    id: 'left_thigh_segment_length_projected',
    canonicalName: 'Left Thigh Segment Length (Projected)',
    displayName: 'Left Thigh Segment',
    anatomicalRegion: 'left_leg',
    group: DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_hip', 'left_knee']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(left_hip, left_knee)',
  }),

  right_thigh_segment_length_projected: Object.freeze({
    id: 'right_thigh_segment_length_projected',
    canonicalName: 'Right Thigh Segment Length (Projected)',
    displayName: 'Right Thigh Segment',
    anatomicalRegion: 'right_leg',
    group: DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_hip', 'right_knee']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(right_hip, right_knee)',
  }),

  left_lower_leg_segment_length_projected: Object.freeze({
    id: 'left_lower_leg_segment_length_projected',
    canonicalName: 'Left Lower Leg Segment Length (Projected)',
    displayName: 'Left Lower Leg Segment',
    anatomicalRegion: 'left_leg',
    group: DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_knee', 'left_ankle']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(left_knee, left_ankle)',
  }),

  right_lower_leg_segment_length_projected: Object.freeze({
    id: 'right_lower_leg_segment_length_projected',
    canonicalName: 'Right Lower Leg Segment Length (Projected)',
    displayName: 'Right Lower Leg Segment',
    anatomicalRegion: 'right_leg',
    group: DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    measurementType: 'length',
    geometryType: 'linear_projected_distance',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_DISTANCE,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_knee', 'right_ankle']),
    constituentSegmentIds: Object.freeze([]),
    formulaText: 'd2D(right_knee, right_ankle)',
  }),

  // =========================================================================
  // 3. Kinematic Chain Measurements (4)
  // =========================================================================
  left_total_arm_chain_length_projected: Object.freeze({
    id: 'left_total_arm_chain_length_projected',
    canonicalName: 'Left Total Arm Kinematic Chain Length (Projected)',
    displayName: 'Left Total Arm Chain',
    anatomicalRegion: 'left_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'length',
    geometryType: 'segment_chain_length',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_CHAIN_LENGTH,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_shoulder', 'left_elbow', 'left_wrist']),
    constituentSegmentIds: Object.freeze([
      'left_upper_arm_segment_length_projected',
      'left_forearm_segment_length_projected',
    ]),
    formulaText: 'd2D(left_shoulder, left_elbow) + d2D(left_elbow, left_wrist)',
  }),

  right_total_arm_chain_length_projected: Object.freeze({
    id: 'right_total_arm_chain_length_projected',
    canonicalName: 'Right Total Arm Kinematic Chain Length (Projected)',
    displayName: 'Right Total Arm Chain',
    anatomicalRegion: 'right_arm',
    group: DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    measurementType: 'length',
    geometryType: 'segment_chain_length',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_CHAIN_LENGTH,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_shoulder', 'right_elbow', 'right_wrist']),
    constituentSegmentIds: Object.freeze([
      'right_upper_arm_segment_length_projected',
      'right_forearm_segment_length_projected',
    ]),
    formulaText: 'd2D(right_shoulder, right_elbow) + d2D(right_elbow, right_wrist)',
  }),

  left_total_leg_chain_length_projected: Object.freeze({
    id: 'left_total_leg_chain_length_projected',
    canonicalName: 'Left Total Leg Kinematic Chain Length (Projected)',
    displayName: 'Left Total Leg Chain',
    anatomicalRegion: 'left_leg',
    group: DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    measurementType: 'length',
    geometryType: 'segment_chain_length',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_CHAIN_LENGTH,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['left_hip', 'left_knee', 'left_ankle']),
    constituentSegmentIds: Object.freeze([
      'left_thigh_segment_length_projected',
      'left_lower_leg_segment_length_projected',
    ]),
    formulaText: 'd2D(left_hip, left_knee) + d2D(left_knee, left_ankle)',
  }),

  right_total_leg_chain_length_projected: Object.freeze({
    id: 'right_total_leg_chain_length_projected',
    canonicalName: 'Right Total Leg Kinematic Chain Length (Projected)',
    displayName: 'Right Total Leg Chain',
    anatomicalRegion: 'right_leg',
    group: DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    measurementType: 'length',
    geometryType: 'segment_chain_length',
    outputSemantics: DIRECT_MEASUREMENT_SEMANTICS.CALIBRATED_PROJECTED_2D_CHAIN_LENGTH,
    sourceView: DIRECT_MEASUREMENTS_VIEW,
    requiredLevels: Object.freeze([]),
    requiredLandmarks: Object.freeze(['right_hip', 'right_knee', 'right_ankle']),
    constituentSegmentIds: Object.freeze([
      'right_thigh_segment_length_projected',
      'right_lower_leg_segment_length_projected',
    ]),
    formulaText: 'd2D(right_hip, right_knee) + d2D(right_knee, right_ankle)',
  }),
});

export const DIRECT_MEASUREMENT_IDS_V0 = Object.freeze(
  Object.keys(SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0),
);

/**
 * Checks if a value is a valid finite coordinate number.
 * @param {unknown} value
 * @returns {boolean}
 */
function isFiniteCoord(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Checks if a point object has finite X and Y coordinates.
 * @param {object|null|undefined} point
 * @returns {boolean}
 */
function hasFiniteXY(point) {
  return Boolean(point && isFiniteCoord(point.x) && isFiniteCoord(point.y));
}

/**
 * Extract 2D metric point { x, y } in cm from annotation entry.
 * Uses genuine annotation coordinate field shapes: point or position.
 *
 * @param {object} entry
 * @returns {{ x: number, y: number }|null}
 */
function extractAnnotationXY(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const rawX = entry.point?.x ?? entry.position?.x;
  const rawY = entry.point?.y ?? entry.position?.y;
  if (isFiniteCoord(rawX) && isFiniteCoord(rawY)) {
    return { x: rawX, y: rawY };
  }
  return null;
}

/**
 * Index promoted body_landmark annotations by normalized landmark name.
 * Collects candidate instances with finite or non-finite coordinates.
 *
 * @param {Array<object>|null|undefined} annotations
 * @returns {Map<string, Array<{ rawName: string, point: { x: number, y: number }|null, hasRawCandidate: boolean, isCorrupted: boolean }>>}
 */
function indexPromotedBodyLandmarks(annotations) {
  const candidatesByName = new Map();

  for (const entry of Array.isArray(annotations) ? annotations : []) {
    if (!entry || typeof entry !== 'object' || entry.type !== BODY_LANDMARK_TYPE) {
      continue;
    }

    const normalizedName = normalizeLandmarkName(entry.name);
    if (!normalizedName) {
      continue;
    }

    const point = extractAnnotationXY(entry);
    const rawX = entry.point?.x ?? entry.position?.x;
    const rawY = entry.point?.y ?? entry.position?.y;
    const hasRaw = rawX !== undefined || rawY !== undefined;
    const isCorrupted = hasRaw && (point === null);

    const candidate = {
      rawName: String(entry.name ?? ''),
      point,
      hasRawCandidate: true,
      isCorrupted,
    };

    const existing = candidatesByName.get(normalizedName);
    if (existing) {
      existing.push(candidate);
    } else {
      candidatesByName.set(normalizedName, [candidate]);
    }
  }

  return candidatesByName;
}

/**
 * Builds an empty/fallback measurement result.
 */
function buildEmptyMeasurementResult(def, {
  status = DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
  valueCm = null,
  issues = [],
  reason = null,
  provenance = {},
} = {}) {
  return {
    contract: DIRECT_BODY_MEASUREMENTS_CONTRACT,
    version: DIRECT_BODY_MEASUREMENTS_CONTRACT_VERSION,
    id: def.id,
    canonicalName: def.canonicalName,
    displayName: def.displayName,
    anatomicalRegion: def.anatomicalRegion,
    group: def.group,
    measurementType: def.measurementType,
    geometryType: def.geometryType,
    outputSemantics: def.outputSemantics,
    sourceView: def.sourceView,
    status,
    isValid: status === DIRECT_MEASUREMENT_STATUS.VALID,
    valueCm,
    formulaText: def.formulaText,
    requiredLevels: [...def.requiredLevels],
    requiredLandmarks: [...def.requiredLandmarks],
    constituentSegmentIds: [...def.constituentSegmentIds],
    reason,
    issues,
    provenance,
  };
}

/**
 * Checks whether Front metric calibration is validated.
 *
 * @param {object|null|undefined} metricCalibrationFront
 * @returns {boolean}
 */
function isCalibrationValidated(metricCalibrationFront) {
  if (!metricCalibrationFront || typeof metricCalibrationFront !== 'object') {
    return false;
  }
  return metricCalibrationFront.status === 'validated'
    || metricCalibrationFront.metricProjectedEligibility === true;
}

/**
 * Evaluates a single vertical inter-level measurement.
 */
function evaluateVerticalInterLevelMeasurement(def, { levelsReport, metricCalibrationFront }) {
  const issues = [];
  const [levelIdA, levelIdB] = def.requiredLevels;

  if (!isCalibrationValidated(metricCalibrationFront)) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
      reason: 'Metric calibration unvalidated or unavailable for Front view.',
      issues: ['Front metric calibration is required for calibrated relative vertical measurements.'],
      provenance: {
        levelAId: levelIdA,
        levelBId: levelIdB,
        calibrationStatus: metricCalibrationFront?.status ?? 'unavailable',
      },
    });
  }

  const levelsList = levelsReport?.levels ?? [];
  const levelA = levelsList.find((l) => l.id === levelIdA);
  const levelB = levelsList.find((l) => l.id === levelIdB);

  const missingLevels = [];
  if (!levelA || levelA.status !== 'ready') missingLevels.push(levelIdA);
  if (!levelB || levelB.status !== 'ready') missingLevels.push(levelIdB);

  if (missingLevels.length > 0) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
      reason: `Required anatomical level(s) not ready: ${missingLevels.join(', ')}`,
      issues: missingLevels.map((id) => `Anatomical level "${id}" is missing or partial.`),
      provenance: {
        levelAId: levelIdA,
        levelBId: levelIdB,
        levelAStatus: levelA?.status ?? 'missing',
        levelBStatus: levelB?.status ?? 'missing',
      },
    });
  }

  const yA = levelA.yCm;
  const yB = levelB.yCm;

  if (!isFiniteCoord(yA) || !isFiniteCoord(yB)) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.INVALID,
      reason: 'Non-finite coordinate detected on ready anatomical level.',
      issues: ['One or more required anatomical levels reported non-finite yCm.'],
      provenance: {
        levelAId: levelIdA,
        levelBId: levelIdB,
        yA,
        yB,
      },
    });
  }

  const delta = Math.abs(yA - yB);
  const roundedValueCm = Math.round(delta * 100) / 100;

  return buildEmptyMeasurementResult(def, {
    status: DIRECT_MEASUREMENT_STATUS.VALID,
    valueCm: roundedValueCm,
    reason: null,
    issues: [],
    provenance: {
      levelA: { id: levelA.id, name: levelA.name, yCm: yA },
      levelB: { id: levelB.id, name: levelB.name, yCm: yB },
      rawDeltaCm: delta,
      calibrationStatus: metricCalibrationFront?.status ?? 'validated',
    },
  });
}

/**
 * Evaluates a single projected landmark segment measurement.
 */
function evaluateProjectedLandmarkMeasurement(def, { landmarkIndex, metricCalibrationFront }) {
  const [nameA, nameB] = def.requiredLandmarks;

  if (!isCalibrationValidated(metricCalibrationFront)) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
      reason: 'Metric calibration unvalidated or unavailable for Front view.',
      issues: ['Front metric calibration is required for calibrated projected landmark measurements.'],
      provenance: {
        landmarkA: nameA,
        landmarkB: nameB,
        calibrationStatus: metricCalibrationFront?.status ?? 'unavailable',
      },
    });
  }

  const candidatesA = landmarkIndex.get(nameA) ?? [];
  const candidatesB = landmarkIndex.get(nameB) ?? [];

  // Check corruption
  const hasCorruptedA = candidatesA.some((c) => c.isCorrupted);
  const hasCorruptedB = candidatesB.some((c) => c.isCorrupted);
  if (hasCorruptedA || hasCorruptedB) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.INVALID,
      reason: 'Non-finite or corrupted coordinates found in promoted landmark annotations.',
      issues: ['Promoted landmark annotation contains invalid/corrupted coordinate payload.'],
      provenance: { landmarkA: nameA, landmarkB: nameB },
    });
  }

  const missing = [];
  if (candidatesA.length === 0 || !candidatesA[0].point) missing.push(nameA);
  if (candidatesB.length === 0 || !candidatesB[0].point) missing.push(nameB);

  if (missing.length > 0) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
      reason: `Required body landmark(s) missing: ${missing.join(', ')}`,
      issues: missing.map((name) => `Promoted body landmark "${name}" is absent.`),
      provenance: {
        landmarkA: nameA,
        landmarkB: nameB,
        hasA: candidatesA.length > 0,
        hasB: candidatesB.length > 0,
      },
    });
  }

  const pointA = candidatesA[0].point;
  const pointB = candidatesB[0].point;

  if (!hasFiniteXY(pointA) || !hasFiniteXY(pointB)) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.INVALID,
      reason: 'Non-finite coordinate values encountered during distance evaluation.',
      issues: ['Endpoint coordinates are not finite numbers.'],
      provenance: { landmarkA: nameA, landmarkB: nameB, pointA, pointB },
    });
  }

  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const roundedValueCm = Math.round(dist * 100) / 100;

  return buildEmptyMeasurementResult(def, {
    status: DIRECT_MEASUREMENT_STATUS.VALID,
    valueCm: roundedValueCm,
    reason: null,
    issues: [],
    provenance: {
      endpointA: { name: nameA, x: pointA.x, y: pointA.y },
      endpointB: { name: nameB, x: pointB.x, y: pointB.y },
      dxCm: dx,
      dyCm: dy,
      rawDistanceCm: dist,
      calibrationStatus: metricCalibrationFront?.status ?? 'validated',
    },
  });
}

/**
 * Evaluates a kinematic chain measurement from pre-evaluated constituent segments.
 */
function evaluateKinematicChainMeasurement(def, { evaluatedMap }) {
  const [segIdA, segIdB] = def.constituentSegmentIds;
  const segA = evaluatedMap.get(segIdA);
  const segB = evaluatedMap.get(segIdB);

  if (!segA || !segB) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
      reason: 'Constituent segment evaluations unavailable.',
      issues: ['One or more constituent segment definitions could not be evaluated.'],
      provenance: { segmentAId: segIdA, segmentBId: segIdB },
    });
  }

  if (segA.status === DIRECT_MEASUREMENT_STATUS.INVALID || segB.status === DIRECT_MEASUREMENT_STATUS.INVALID) {
    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.INVALID,
      reason: 'One or more constituent segments is invalid.',
      issues: [...segA.issues, ...segB.issues],
      provenance: { segmentA: segA, segmentB: segB },
    });
  }

  if (segA.status !== DIRECT_MEASUREMENT_STATUS.VALID || segB.status !== DIRECT_MEASUREMENT_STATUS.VALID) {
    const unavail = [];
    if (segA.status !== DIRECT_MEASUREMENT_STATUS.VALID) unavail.push(segA.displayName);
    if (segB.status !== DIRECT_MEASUREMENT_STATUS.VALID) unavail.push(segB.displayName);

    return buildEmptyMeasurementResult(def, {
      status: DIRECT_MEASUREMENT_STATUS.UNAVAILABLE,
      reason: `Constituent segment(s) unavailable: ${unavail.join(', ')}`,
      issues: [`Chain measurement requires all constituent segments to be valid (${unavail.join(', ')} unavailable).`],
      provenance: {
        segmentAId: segIdA,
        segmentBId: segIdB,
        segmentAStatus: segA.status,
        segmentBStatus: segB.status,
      },
    });
  }

  const sum = (segA.valueCm ?? 0) + (segB.valueCm ?? 0);
  const roundedSumCm = Math.round(sum * 100) / 100;

  return buildEmptyMeasurementResult(def, {
    status: DIRECT_MEASUREMENT_STATUS.VALID,
    valueCm: roundedSumCm,
    reason: null,
    issues: [],
    provenance: {
      segmentA: {
        id: segA.id,
        displayName: segA.displayName,
        valueCm: segA.valueCm,
      },
      segmentB: {
        id: segB.id,
        displayName: segB.displayName,
        valueCm: segB.valueCm,
      },
      rawChainSumCm: sum,
    },
  });
}

/**
 * Evaluates all 19 supported Batch A direct body measurements.
 *
 * @param {{
 *   annotations?: Array<object>|null,
 *   levelsReport?: object|null,
 *   metricCalibrationFront?: object|null,
 * }} [context]
 * @returns {{
 *   contract: 'direct-body-measurements-report-v0',
 *   version: string,
 *   view: 'front',
 *   summary: {
 *     total: number,
 *     valid: number,
 *     unavailable: number,
 *     invalid: number,
 *   },
 *   measurements: Array<object>,
 *   measurementsById: Record<string, object>,
 *   byGroup: Record<string, Array<object>>,
 * }}
 */
export function evaluateDirectBodyMeasurements({
  annotations = null,
  levelsReport = null,
  metricCalibrationFront = null,
} = {}) {
  const resolvedLevels = levelsReport ?? computeAnatomicalLevels(annotations);
  const landmarkIndex = indexPromotedBodyLandmarks(annotations);

  const evaluatedMap = new Map();
  const allDefinitions = Object.values(SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0);

  // Pass 1: Vertical inter-level & Projected landmark segments
  for (const def of allDefinitions) {
    if (def.geometryType === 'vertical_inter_level_delta') {
      const result = evaluateVerticalInterLevelMeasurement(def, {
        levelsReport: resolvedLevels,
        metricCalibrationFront,
      });
      evaluatedMap.set(def.id, result);
    } else if (def.geometryType === 'linear_projected_distance') {
      const result = evaluateProjectedLandmarkMeasurement(def, {
        landmarkIndex,
        metricCalibrationFront,
      });
      evaluatedMap.set(def.id, result);
    }
  }

  // Pass 2: Kinematic chains (which depend on Pass 1 segments)
  for (const def of allDefinitions) {
    if (def.geometryType === 'segment_chain_length') {
      const result = evaluateKinematicChainMeasurement(def, { evaluatedMap });
      evaluatedMap.set(def.id, result);
    }
  }

  const measurements = allDefinitions.map((def) => evaluatedMap.get(def.id));
  const measurementsById = Object.fromEntries(measurements.map((m) => [m.id, m]));

  const byGroup = {
    [DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL]: measurements.filter(
      (m) => m.group === DIRECT_MEASUREMENT_GROUPS.VERTICAL_INTER_LEVEL,
    ),
    [DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS]: measurements.filter(
      (m) => m.group === DIRECT_MEASUREMENT_GROUPS.ARM_SEGMENTS,
    ),
    [DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS]: measurements.filter(
      (m) => m.group === DIRECT_MEASUREMENT_GROUPS.LEG_SEGMENTS,
    ),
  };

  let validCount = 0;
  let unavailableCount = 0;
  let invalidCount = 0;

  for (const m of measurements) {
    if (m.status === DIRECT_MEASUREMENT_STATUS.VALID) {
      validCount += 1;
    } else if (m.status === DIRECT_MEASUREMENT_STATUS.INVALID) {
      invalidCount += 1;
    } else {
      unavailableCount += 1;
    }
  }

  return {
    contract: 'direct-body-measurements-report-v0',
    version: DIRECT_BODY_MEASUREMENTS_CONTRACT_VERSION,
    view: DIRECT_MEASUREMENTS_VIEW,
    summary: {
      total: measurements.length,
      valid: validCount,
      unavailable: unavailableCount,
      invalid: invalidCount,
    },
    measurements,
    measurementsById,
    byGroup,
  };
}

/**
 * Evaluates a single direct body measurement by ID.
 *
 * @param {string} id
 * @param {{
 *   annotations?: Array<object>|null,
 *   levelsReport?: object|null,
 *   metricCalibrationFront?: object|null,
 * }} [context]
 * @returns {object|null}
 */
export function evaluateDirectBodyMeasurement(id, context = {}) {
  if (!id || typeof id !== 'string') {
    return null;
  }
  const def = SUPPORTED_DIRECT_MEASUREMENT_DEFINITIONS_V0[id];
  if (!def) {
    return null;
  }
  const report = evaluateDirectBodyMeasurements(context);
  return report.measurementsById[id] ?? null;
}

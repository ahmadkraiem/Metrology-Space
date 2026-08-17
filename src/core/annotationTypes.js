import { formatLandmarkDisplayName } from './landmarkDisplay.js';

export const ANNOTATION_TYPE_CUSTOM = 'custom';

export const ANNOTATION_TYPES = [
  ANNOTATION_TYPE_CUSTOM,
  'reference_point',
  'body_landmark',
  'garment_landmark',
  'measurement_point',
];

export const DEFAULT_ANNOTATION_TYPE = ANNOTATION_TYPE_CUSTOM;

const ANNOTATION_TYPE_LABELS = {
  [ANNOTATION_TYPE_CUSTOM]: 'Custom',
  reference_point: 'Reference Point',
  body_landmark: 'Body Landmark',
  garment_landmark: 'Garment Landmark',
  measurement_point: 'Measurement Point',
};

export function normalizeAnnotationType(type) {
  if (typeof type === 'string' && ANNOTATION_TYPES.includes(type)) {
    return type;
  }

  return DEFAULT_ANNOTATION_TYPE;
}

export function formatAnnotationTypeLabel(type) {
  return ANNOTATION_TYPE_LABELS[normalizeAnnotationType(type)];
}

export const LANDMARK_PRESET_CUSTOM = 'custom';

export const DEFAULT_LANDMARK_PRESET = LANDMARK_PRESET_CUSTOM;

export const LANDMARK_PRESETS_BY_TYPE = {
  [ANNOTATION_TYPE_CUSTOM]: [LANDMARK_PRESET_CUSTOM],
  reference_point: [
    'origin_reference',
    'center_reference',
    'floor_reference',
    'wall_reference',
    LANDMARK_PRESET_CUSTOM,
  ],
  body_landmark: [
    'head_top',
    'neck_base',
    'left_shoulder',
    'right_shoulder',
    'chest_center',
    'waist_left',
    'waist_right',
    'hip_left',
    'hip_right',
    'left_elbow',
    'right_elbow',
    'left_wrist',
    'right_wrist',
    'left_knee',
    'right_knee',
    'left_ankle',
    'right_ankle',
    LANDMARK_PRESET_CUSTOM,
  ],
  garment_landmark: [
    'collar_center',
    'left_collar',
    'right_collar',
    'left_sleeve_end',
    'right_sleeve_end',
    'chest_center',
    'waistline_center',
    'left_waistline',
    'right_waistline',
    'hem_center',
    'left_hem',
    'right_hem',
    'zipper_start',
    'zipper_end',
    'button',
    LANDMARK_PRESET_CUSTOM,
  ],
  measurement_point: [
    'measurement_anchor_a',
    'measurement_anchor_b',
    'width_reference',
    'height_reference',
    'depth_reference',
    LANDMARK_PRESET_CUSTOM,
  ],
};

export function getLandmarkPresetsForType(type) {
  const normalized = normalizeAnnotationType(type);
  return LANDMARK_PRESETS_BY_TYPE[normalized] ?? LANDMARK_PRESETS_BY_TYPE[ANNOTATION_TYPE_CUSTOM];
}

export function formatLandmarkPresetLabel(preset) {
  if (preset === LANDMARK_PRESET_CUSTOM) {
    return 'Custom (manual)';
  }

  return formatLandmarkDisplayName(preset);
}

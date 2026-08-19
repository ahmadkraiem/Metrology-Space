/**
 * Body Evidence Adapter (v0)
 * Parses body-processing JSON into a normalized QA schema.
 * Conceptual/mock evidence only — not trusted ground truth.
 * Does not touch scene, measurement, annotation, or export state.
 */

export const BODY_EVIDENCE_VERSION = 'body-evidence-v0';
export const BODY_EVIDENCE_SOURCE_FORMAT = 'body-processing-json-v0';
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

const FACE_HEAD_TERMS = [
  'nose',
  'eye',
  'iris',
  'pupil',
  'ear',
  'mouth',
  'jaw',
  'chin',
  'eyebrow',
  'face',
  'hair',
  'head',
  'head_top',
  'lips',
  'upper_lip',
  'lower_lip',
  'concha',
  'helix',
];

/**
 * Secondary Body Landmark Candidates v0 — explicit allowlist.
 *
 * Chosen for metrology usefulness, not because a model happens to emit them:
 * acromion refines the shoulder reference; heel / big toe / small toe support
 * future foot stance, ground contact, and body alignment work.
 *
 * Hand, finger, thumb, and dense/unstable model-specific points are
 * deliberately excluded — they stay ignored/deferred QA only in v0.
 */
export const SECONDARY_FRONT_BODY_ANCHORS = Object.freeze([
  'left_acromion',
  'right_acromion',
  'left_heel',
  'right_heel',
  'left_big_toe',
  'right_big_toe',
  'left_small_toe',
  'right_small_toe',
]);

const SECONDARY_FRONT_BODY_ANCHOR_SET = new Set(SECONDARY_FRONT_BODY_ANCHORS);

/**
 * Secondary Side Body Landmark Candidates v0 — explicit allowlist.
 * Same exact safe identities as Front secondary; kept as a separate set so
 * Side classification never mirrors or infers beyond emitted names.
 */
export const SECONDARY_SIDE_BODY_ANCHORS = Object.freeze([
  'left_acromion',
  'right_acromion',
  'left_heel',
  'right_heel',
  'left_big_toe',
  'right_big_toe',
  'left_small_toe',
  'right_small_toe',
]);

const SECONDARY_SIDE_BODY_ANCHOR_SET = new Set(SECONDARY_SIDE_BODY_ANCHORS);

/**
 * Hand / finger detail vocabulary. Deferred in v0: too detailed and unstable
 * for Body Graph preparation, so it never reaches the secondary candidate list.
 */
const DEFERRED_HAND_DETAIL_TERMS = [
  'hand',
  'palm',
  'thumb',
  'finger',
  'forefinger',
  'index',
  'middle',
  'ring',
  'pinky',
  'knuckle',
  'mcp',
  'pip',
  'dip',
];

/** Foot detail vocabulary outside the secondary allowlist (e.g. `foot_index`). */
const DEFERRED_FOOT_DETAIL_TERMS = ['foot', 'toe', 'heel'];

const FACE_SEG_TERMS = [
  'face',
  'hair',
  'lip',
  'mouth',
  'eye',
  'nose',
  'ear',
];

/**
 * Positive whitelist of the core front body anchors that may be shown as
 * Body Evidence candidates, rendered on the Front Surface overlay, and
 * promoted. Anything outside this set (dense face/ear/hand/extra pose points
 * such as concha, helix, pinky, index, etc.) is parsed/QA-counted only and is
 * never rendered or promotable.
 */
export const CORE_FRONT_BODY_ANCHORS = Object.freeze([
  'neck',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
]);

const CORE_FRONT_BODY_ANCHOR_SET = new Set(CORE_FRONT_BODY_ANCHORS);

/** Side-bearing base names used to resolve left/right prefix or suffix forms. */
const CORE_SIDE_BASE_NAMES = 'shoulder|elbow|wrist|hip|knee|ankle';

/** Secondary allowlist base names that also carry a left/right side. */
const SECONDARY_SIDE_BASE_NAMES = 'acromion|heel|big_toe|small_toe';

const SIDE_BASE_NAMES = `${CORE_SIDE_BASE_NAMES}|${SECONDARY_SIDE_BASE_NAMES}`;

/**
 * Normalize a landmark name for whitelist matching:
 * - coerce to string, trim, lowercase
 * - replace runs of spaces / hyphens with a single underscore
 * - collapse repeated underscores and strip leading/trailing underscores
 * - map short side prefixes (`l_`, `r_`) to `left_` / `right_` when the
 *   remainder is a core or secondary-allowlist side base name
 * - map suffix side forms (`shoulder_left`, `wrist_r`) to `left_shoulder` etc.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function normalizeLandmarkName(name) {
  let normalized = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return '';
  }

  normalized = normalized
    .replace(new RegExp(`^l_(?=(?:${SIDE_BASE_NAMES})$)`), 'left_')
    .replace(new RegExp(`^r_(?=(?:${SIDE_BASE_NAMES})$)`), 'right_');

  const suffixMatch = normalized.match(
    new RegExp(`^(${SIDE_BASE_NAMES})_(left|right|l|r)$`),
  );
  if (suffixMatch) {
    const base = suffixMatch[1];
    const rawSide = suffixMatch[2];
    const side = rawSide === 'l' ? 'left' : rawSide === 'r' ? 'right' : rawSide;
    normalized = `${side}_${base}`;
  }

  return normalized;
}

/**
 * True only when the normalized landmark name is one of the core 13 front body
 * anchors. This is the single positive gate for core overlay / primary
 * Body Landmark Candidates (unchanged).
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function isCoreFrontBodyAnchor(name) {
  return CORE_FRONT_BODY_ANCHOR_SET.has(normalizeLandmarkName(name));
}

function toLower(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function nameIncludesTerm(name, terms) {
  const lower = toLower(name);
  if (!lower) {
    return false;
  }
  return terms.some((term) => lower.includes(term));
}

/**
 * Tokenize a normalized landmark id into underscore-separated parts.
 * @param {string} normalized
 * @returns {string[]}
 */
function landmarkNameTokens(normalized) {
  return normalized.split('_').filter(Boolean);
}

/**
 * True when `term` appears as a whole token in the normalized landmark name
 * (e.g. `left_hand` matches `hand`; `handle` does not).
 * @param {string} normalized
 * @param {string} term
 * @returns {boolean}
 */
function nameHasBodyTermToken(normalized, term) {
  if (!normalized || !term) {
    return false;
  }
  if (normalized === term) {
    return true;
  }
  const tokens = landmarkNameTokens(normalized);
  const termTokens = landmarkNameTokens(term);
  if (termTokens.length === 1) {
    return tokens.includes(term);
  }
  // Multi-token terms (reserved for future) — contiguous subsequence match.
  if (termTokens.length > tokens.length) {
    return false;
  }
  for (let i = 0; i <= tokens.length - termTokens.length; i += 1) {
    let match = true;
    for (let j = 0; j < termTokens.length; j += 1) {
      if (tokens[i + j] !== termTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }
  return false;
}

/**
 * Unstable / dense model point names that must never surface as secondary
 * candidates even if they somehow overlap body vocabulary.
 * @param {string} normalized
 * @returns {boolean}
 */
function isNoisyModelSpecificLandmarkName(normalized) {
  if (!normalized) {
    return true;
  }
  if (/^(landmark|point|kp|keypoint|contour|silhouette)(_\d+)?$/.test(normalized)) {
    return true;
  }
  if (/^(contour|silhouette|dense)_\d+$/.test(normalized)) {
    return true;
  }
  return false;
}

/** Explicit reject-face/head helper for Secondary Body Landmark Candidates v0. */
export function isRejectedFaceHeadLandmark(name) {
  return nameIncludesTerm(name, FACE_HEAD_TERMS);
}

/**
 * Secondary Body Landmark Candidates v0: an exact allowlist match only.
 * A landmark is never secondary just because the model outputs it — it must be
 * one of `SECONDARY_FRONT_BODY_ANCHORS`. Side view secondary classification
 * is handled by `classifyPoseLandmarks(..., { view: 'side' })` instead.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function isSecondaryBodyAnchorCandidate(name) {
  const normalized = normalizeLandmarkName(name);
  if (!normalized || isCoreFrontBodyAnchor(normalized) || isRejectedFaceHeadLandmark(normalized)) {
    return false;
  }
  return SECONDARY_FRONT_BODY_ANCHOR_SET.has(normalized);
}

/**
 * Body-looking landmarks that are neither core 13 nor secondary-allowlisted:
 * hand/finger detail, dense contours, unstable model extras, and any unknown
 * body-ish name. Deferred means QA-countable but never listed, rendered, or
 * promotable in v0. Face/head names are rejected instead of deferred.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function isDeferredBodyLandmark(name) {
  const normalized = normalizeLandmarkName(name);
  if (isRejectedFaceHeadLandmark(normalized)) {
    return false;
  }
  return !isCoreFrontBodyAnchor(normalized)
    && !SECONDARY_FRONT_BODY_ANCHOR_SET.has(normalized);
}

function tokensIncludeSideView(normalized) {
  const tokens = landmarkNameTokens(normalized);
  return tokens.includes('side') && !tokens.includes('inside');
}

function isSideViewLandmarkName(normalized) {
  return normalized.startsWith('side_')
    || normalized.endsWith('_side')
    || tokensIncludeSideView(normalized);
}

/**
 * Token match that tolerates numbered joint suffixes (`thumb1`, `finger4`),
 * which models commonly emit for dense hand chains.
 * @param {string} normalized
 * @param {string} term
 */
function nameHasDeferredTermToken(normalized, term) {
  if (nameHasBodyTermToken(normalized, term)) {
    return true;
  }
  const numbered = new RegExp(`^${term}\\d+$`);
  return landmarkNameTokens(normalized).some((token) => numbered.test(token));
}

function isHandDetailLandmarkName(normalized) {
  return DEFERRED_HAND_DETAIL_TERMS.some((term) => nameHasDeferredTermToken(normalized, term));
}

/** Why a landmark is deferred — QA labelling only, never a promote path. */
function deferredLandmarkReason(normalized) {
  if (isSideViewLandmarkName(normalized)) {
    return 'side-landmark';
  }
  if (DEFERRED_FOOT_DETAIL_TERMS.some((term) => nameHasDeferredTermToken(normalized, term))) {
    return 'deferred-foot-detail';
  }
  if (isHandDetailLandmarkName(normalized)) {
    return 'deferred-hand-detail';
  }
  if (isNoisyModelSpecificLandmarkName(normalized)) {
    return 'deferred-unstable-extra';
  }
  return 'not-in-secondary-allowlist';
}

/**
 * Classify a pose landmark name for Body Evidence candidate use.
 * The view boundary is enforced by callers; this helper classifies names only.
 *
 * @param {unknown} name
 * @returns {{
 *   classification: 'core'|'secondary'|'rejected-face-head'|'ignored-non-core',
 *   reason: 'core-13'|'secondary-allowlist'|'face-head-term'|'side-landmark'
 *     |'deferred-foot-detail'|'deferred-hand-detail'|'deferred-unstable-extra'
 *     |'not-in-secondary-allowlist',
 * }}
 */
export function classifyBodyLandmarkCandidate(name) {
  if (isCoreFrontBodyAnchor(name)) {
    return { classification: 'core', reason: 'core-13' };
  }
  if (isRejectedFaceHeadLandmark(name)) {
    return { classification: 'rejected-face-head', reason: 'face-head-term' };
  }

  const normalized = normalizeLandmarkName(name);
  if (SECONDARY_FRONT_BODY_ANCHOR_SET.has(normalized)) {
    return { classification: 'secondary', reason: 'secondary-allowlist' };
  }
  return {
    classification: 'ignored-non-core',
    reason: deferredLandmarkReason(normalized),
  };
}

export function isRejectedSegmentationClass(name) {
  return nameIncludesTerm(name, FACE_SEG_TERMS);
}

function asFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function unwrapPayload(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }
  if (data.pose && typeof data.pose === 'object') {
    return data.pose;
  }
  if (data.data && typeof data.data === 'object') {
    return data.data;
  }
  if (data.result && typeof data.result === 'object') {
    return data.result;
  }
  return data;
}

function getInstanceList(data) {
  const candidates = [
    data.instances,
    data.people,
    data.persons,
    data.predictions,
    data.detections,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.filter((entry) => entry && typeof entry === 'object');
    }
  }

  return [];
}

/**
 * Read landmarks from a single container (top-level payload or one instance).
 * `fallbackNames` supplies names when the container only has parallel arrays.
 */
function landmarksFromContainer(container, fallbackNames) {
  if (!container || typeof container !== 'object') {
    return [];
  }

  // Shape 1: keypoints_named — array of { id, name, x, y, score } or object map
  if (container.keypoints_named != null) {
    const named = landmarksFromKeypointsNamed(container.keypoints_named);
    if (named.length > 0) {
      return named;
    }
  }

  // Shape 2: keypoint_names + keypoints (+ keypoint_scores)
  const names = Array.isArray(container.keypoint_names)
    ? container.keypoint_names
    : fallbackNames;
  if (Array.isArray(names) && Array.isArray(container.keypoints)) {
    return landmarksFromParallelArrays(
      names,
      container.keypoints,
      container.keypoint_scores ?? container.scores,
    );
  }

  // Shape 3: landmarks / keypoints arrays of objects
  const landmarkArrays = [
    container.landmarks,
    container.keypoints,
    container.pose_landmarks,
    container.body_landmarks,
  ];

  for (const arr of landmarkArrays) {
    if (Array.isArray(arr) && arr.length > 0 && isLandmarkLikeObject(arr[0])) {
      return landmarksFromObjectArray(arr);
    }
  }

  // Parallel arrays under alternate keys
  const altNames = container.landmark_names ?? container.names ?? fallbackNames;
  const altPoints = container.landmark_points ?? container.points;
  const altScores = container.landmark_scores ?? container.scores;
  if (Array.isArray(altNames) && Array.isArray(altPoints)) {
    return landmarksFromParallelArrays(altNames, altPoints, altScores);
  }

  return [];
}

/**
 * Normalize keypoints from flexible pose JSON shapes into
 * [{ name, x, y, score }].
 *
 * Supports top-level payloads and instance-based payloads
 * (`instances[0].keypoints_named`, etc.). Names declared at the top level are
 * reused when an instance only carries parallel keypoint arrays.
 */
export function extractPoseLandmarks(raw) {
  const data = unwrapPayload(raw);
  if (!data || typeof data !== 'object') {
    return [];
  }

  const fallbackNames = [data.keypoint_names, data.landmark_names, data.names]
    .find((value) => Array.isArray(value) && value.length > 0) ?? null;

  for (const instance of getInstanceList(data)) {
    const landmarks = landmarksFromContainer(instance, fallbackNames);
    if (landmarks.length > 0) {
      return landmarks;
    }
  }

  return landmarksFromContainer(data, fallbackNames);
}

function isLandmarkLikeObject(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return false;
  }
  return (
    'name' in item
    || 'label' in item
    || 'x' in item
    || 'y' in item
    || Array.isArray(item.position)
    || Array.isArray(item.xy)
  );
}

function landmarksFromKeypointsNamed(named) {
  if (Array.isArray(named)) {
    return landmarksFromObjectArray(named);
  }
  if (!named || typeof named !== 'object') {
    return [];
  }

  return Object.entries(named).map(([name, value]) => {
    if (Array.isArray(value)) {
      return {
        name,
        x: asFiniteNumber(value[0]),
        y: asFiniteNumber(value[1]),
        score: asFiniteNumber(value[2]),
      };
    }
    if (value && typeof value === 'object') {
      return {
        name: value.name ?? value.label ?? name,
        x: asFiniteNumber(value.x ?? value[0]),
        y: asFiniteNumber(value.y ?? value[1]),
        score: asFiniteNumber(value.score ?? value.confidence ?? value[2]),
      };
    }
    return { name, x: null, y: null, score: null };
  });
}

function landmarksFromObjectArray(arr) {
  return arr.map((item, index) => {
    if (Array.isArray(item)) {
      return {
        name: `landmark_${index}`,
        x: asFiniteNumber(item[0]),
        y: asFiniteNumber(item[1]),
        score: asFiniteNumber(item[2]),
      };
    }
    const position = item.position ?? item.xy ?? item.point;
    let x = asFiniteNumber(item.x);
    let y = asFiniteNumber(item.y);
    if (Array.isArray(position)) {
      x = asFiniteNumber(position[0]);
      y = asFiniteNumber(position[1]);
    } else if (position && typeof position === 'object') {
      x = asFiniteNumber(position.x);
      y = asFiniteNumber(position.y);
    }
    return {
      name: item.name ?? item.label ?? item.id ?? `landmark_${index}`,
      x,
      y,
      score: asFiniteNumber(item.score ?? item.confidence ?? item.visibility),
    };
  });
}

function landmarksFromParallelArrays(names, keypoints, scores) {
  const count = Math.min(names.length, keypoints.length);
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const point = keypoints[i];
    let x = null;
    let y = null;
    if (Array.isArray(point)) {
      x = asFiniteNumber(point[0]);
      y = asFiniteNumber(point[1]);
    } else if (point && typeof point === 'object') {
      x = asFiniteNumber(point.x);
      y = asFiniteNumber(point.y);
    }
    const scoreFromParallel = Array.isArray(scores) ? asFiniteNumber(scores[i]) : null;
    const scoreFromPoint = Array.isArray(point) ? asFiniteNumber(point[2]) : null;
    result.push({
      name: String(names[i] ?? `landmark_${i}`),
      x,
      y,
      score: scoreFromParallel ?? scoreFromPoint,
    });
  }
  return result;
}

/**
 * Split normalized pose landmarks into body-only QA counts.
 * Face/head landmarks are rejected; low-confidence body landmarks are counted
 * for QA and kept in `acceptedLandmarks` (the overlay skips them when drawing).
 * Non-core accepted landmarks are further split into secondary candidates vs
 * ignored/non-core (QA-only).
 *
 * @param {Array<{ name: string, x: number|null, y: number|null, score: number|null }>} landmarks
 * @param {{ view?: 'front'|'side' }} [options]
 * @returns {{
 *   total: number,
 *   accepted: number,
 *   rejectedFace: number,
 *   lowConfidence: number,
 *   core: number,
 *   secondary: number,
 *   ignoredNonCore: number,
 *   acceptedLandmarks: Array<{
 *     name: string,
 *     imageX: number|null,
 *     imageY: number|null,
 *     score: number|null,
 *     lowConfidence: boolean,
 *     coreFront: boolean,
 *     secondary: boolean,
 *   }>,
 *   rejectedLandmarks: Array<{ name: string, reason: string }>,
 *   ignoredLandmarks: Array<{ name: string, reason: string }>,
 * }}
 */
export function classifyPoseLandmarks(landmarks, { view = 'front' } = {}) {
  const secondarySet = view === 'side'
    ? SECONDARY_SIDE_BODY_ANCHOR_SET
    : SECONDARY_FRONT_BODY_ANCHOR_SET;
  const list = Array.isArray(landmarks) ? landmarks : [];
  const acceptedLandmarks = [];
  const rejectedLandmarks = [];
  const ignoredLandmarks = [];
  let rejectedFace = 0;
  let lowConfidence = 0;
  let core = 0;
  let secondary = 0;
  let ignoredNonCore = 0;

  for (const landmark of list) {
    const name = String(landmark?.name ?? '');
    const normalized = normalizeLandmarkName(name);

    if (isCoreFrontBodyAnchor(name)) {
      const score = asFiniteNumber(landmark?.score);
      const isLowConfidence = score !== null && score < LOW_CONFIDENCE_THRESHOLD;
      if (isLowConfidence) {
        lowConfidence += 1;
      }
      core += 1;
      acceptedLandmarks.push({
        name,
        imageX: asFiniteNumber(landmark?.x),
        imageY: asFiniteNumber(landmark?.y),
        score,
        lowConfidence: isLowConfidence,
        coreFront: true,
        secondary: false,
      });
      continue;
    }

    if (isRejectedFaceHeadLandmark(name)) {
      rejectedFace += 1;
      rejectedLandmarks.push({
        name,
        reason: 'face-head-term',
      });
      continue;
    }

    const score = asFiniteNumber(landmark?.score);
    const isLowConfidence = score !== null && score < LOW_CONFIDENCE_THRESHOLD;
    if (isLowConfidence) {
      lowConfidence += 1;
    }

    const isSecondary = secondarySet.has(normalized);
    if (isSecondary) {
      secondary += 1;
    } else {
      ignoredNonCore += 1;
      ignoredLandmarks.push({
        name,
        reason: deferredLandmarkReason(normalized),
      });
    }

    acceptedLandmarks.push({
      name,
      imageX: asFiniteNumber(landmark?.x),
      imageY: asFiniteNumber(landmark?.y),
      score,
      lowConfidence: isLowConfidence,
      coreFront: false,
      secondary: isSecondary,
    });
  }

  return {
    total: list.length,
    accepted: acceptedLandmarks.length,
    rejectedFace,
    lowConfidence,
    core,
    secondary,
    ignoredNonCore,
    rejectedLandmarks,
    ignoredLandmarks,
    acceptedLandmarks,
  };
}

function classNameFromEntry(entry) {
  if (typeof entry === 'string') {
    return entry;
  }
  if (entry && typeof entry === 'object') {
    return String(entry.name ?? entry.label ?? entry.class ?? entry.id ?? '');
  }
  return String(entry ?? '');
}

function readClassNames(data) {
  const candidates = [
    data.class_names,
    data.classNames,
    data.classes,
    data.segmentation_classes,
    data.seg_classes,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.map(classNameFromEntry).filter(Boolean);
    }
  }

  if (data.class_counts && typeof data.class_counts === 'object' && !Array.isArray(data.class_counts)) {
    return Object.keys(data.class_counts);
  }
  if (data.classCounts && typeof data.classCounts === 'object' && !Array.isArray(data.classCounts)) {
    return Object.keys(data.classCounts);
  }
  if (data.masks && typeof data.masks === 'object' && !Array.isArray(data.masks)) {
    return Object.keys(data.masks);
  }
  if (data.segmentation && typeof data.segmentation === 'object' && !Array.isArray(data.segmentation)) {
    if (Array.isArray(data.segmentation.class_names)) {
      return data.segmentation.class_names.map(classNameFromEntry).filter(Boolean);
    }
    return Object.keys(data.segmentation).filter((key) => key !== 'mask' && key !== 'data');
  }

  return [];
}

/**
 * Pixel counts per class from input metadata.
 */
function readClassCounts(data) {
  const maps = [data.class_counts, data.classCounts, data.pixel_counts, data.pixelCounts];

  for (const map of maps) {
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      const counts = {};
      for (const [name, value] of Object.entries(map)) {
        const count = asFiniteNumber(value);
        if (count !== null) {
          counts[name] = count;
        }
      }
      if (Object.keys(counts).length > 0) {
        return counts;
      }
    }
  }

  // Array-of-objects form: [{ name, count }]
  const arrays = [data.class_names, data.classes, data.segmentation_classes];
  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.some((entry) => entry && typeof entry === 'object')) {
      const counts = {};
      for (const entry of arr) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const name = classNameFromEntry(entry);
        const count = asFiniteNumber(entry.count ?? entry.pixels ?? entry.pixel_count);
        if (name && count !== null) {
          counts[name] = count;
        }
      }
      if (Object.keys(counts).length > 0) {
        return counts;
      }
    }
  }

  return {};
}

/**
 * Universal base64 string to Uint8Array decoder.
 * Compatible with Node.js test environment and browser.
 *
 * @param {unknown} base64String
 * @returns {Uint8Array}
 */
export function decodeBase64ToUint8Array(base64String) {
  if (typeof base64String !== 'string') {
    throw new TypeError('Expected a base64 string');
  }

  let cleanBase64 = base64String.trim();
  const commaIdx = cleanBase64.indexOf(',');
  if (commaIdx !== -1 && cleanBase64.slice(0, commaIdx).includes('base64')) {
    cleanBase64 = cleanBase64.slice(commaIdx + 1).trim();
  }

  cleanBase64 = cleanBase64.replace(/\s+/g, '');

  if (cleanBase64.length === 0) {
    return new Uint8Array(0);
  }

  // Validate base64 characters and structure
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64) || cleanBase64.length % 4 === 1) {
    throw new Error('Invalid base64 string format.');
  }

  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(cleanBase64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  if (typeof globalThis.atob === 'function') {
    const binaryString = globalThis.atob(cleanBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error('No base64 decoding mechanism available in current environment');
}

function getExpectedClassCount(inputCounts, classId, label) {
  if (!inputCounts || typeof inputCounts !== 'object') {
    return 0;
  }
  if (label in inputCounts) {
    const val = asFiniteNumber(inputCounts[label]);
    return val !== null ? val : 0;
  }
  const lower = label.toLowerCase();
  for (const [k, v] of Object.entries(inputCounts)) {
    if (k.toLowerCase() === lower) {
      const val = asFiniteNumber(v);
      return val !== null ? val : 0;
    }
  }
  if (String(classId) in inputCounts) {
    const val = asFiniteNumber(inputCounts[String(classId)]);
    return val !== null ? val : 0;
  }
  return 0;
}

/**
 * Build an empty normalized segmentation representation when no segmentation
 * source is loaded for a view.
 *
 * @param {string|null} [view]
 * @returns {object}
 */
export function emptyNormalizedSegmentation(view = null) {
  const normalizedView = typeof view === 'string' ? view.trim().toLowerCase() : null;
  return {
    view: normalizedView,
    model: null,
    widthPx: null,
    heightPx: null,
    dtype: null,
    raster: null,
    classes: [],
    classNames: [],
    classCounts: {},
    rejectedClasses: [],
    labelShape: null,
    labelDtype: null,
    qa: {
      valid: false,
      validView: false,
      numClassesMatches: false,
      validShape: false,
      validDtype: false,
      decodeSuccess: false,
      pixelCountMatchesShape: false,
      classIdsInRange: false,
      countsMatch: false,
      issues: ['No segmentation source loaded.'],
      warnings: [],
      recomputedClassCounts: {},
      inputClassCounts: {},
      totalPixels: 0,
      decodedPixels: 0,
      outOfRangePixelCount: 0,
    },
  };
}

/**
 * Normalizes a raw Front or Side segmentation JSON payload into the deterministic
 * runtime representation with per-class derivations and QA validation.
 *
 * @param {unknown} raw
 * @param {{ expectedView?: 'front'|'side' }} [options]
 * @returns {object}
 */
export function normalizeSegmentation(raw, { expectedView } = {}) {
  const data = unwrapPayload(raw);
  if (!data || typeof data !== 'object') {
    return emptyNormalizedSegmentation(expectedView);
  }

  const issues = [];
  const warnings = [];

  // 1. Model
  const rawModel = data.model ?? data.model_name ?? data.modelName ?? null;
  const model = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : null;

  // 2. View QA check
  const rawView = typeof data.view === 'string' && data.view.trim() ? data.view.trim() : null;
  const normalizedView = rawView ? rawView.toLowerCase() : null;
  const expectedViewNormalized = typeof expectedView === 'string' ? expectedView.trim().toLowerCase() : null;

  let validView = false;
  if (normalizedView === 'front' || normalizedView === 'side') {
    if (expectedViewNormalized) {
      if (normalizedView === expectedViewNormalized) {
        validView = true;
      } else {
        issues.push(`View mismatch: expected '${expectedViewNormalized}', got '${normalizedView}'.`);
      }
    } else {
      validView = true;
    }
  } else {
    issues.push(`Invalid or missing view: expected '${expectedViewNormalized ?? 'front|side'}', got '${rawView ?? 'null'}'.`);
  }
  const view = normalizedView ?? expectedViewNormalized ?? null;

  // 3. Class names and num_classes QA check
  const classNames = readClassNames(data);
  const rawNumClasses = data.num_classes ?? data.numClasses ?? null;
  const numClasses = typeof rawNumClasses === 'number' && Number.isInteger(rawNumClasses) && rawNumClasses >= 0
    ? rawNumClasses
    : null;

  let numClassesMatches = false;
  if (numClasses !== null && numClasses === classNames.length) {
    numClassesMatches = true;
  } else {
    issues.push(`num_classes (${rawNumClasses ?? 'missing'}) does not match class_names length (${classNames.length}).`);
  }

  // 4. Input class counts
  const inputClassCounts = readClassCounts(data);

  // 5. Label shape and dtype QA check
  const labelsObj = data.labels ?? data.label ?? data.mask ?? data.segmentation?.labels ?? null;
  const rawShape = Array.isArray(labelsObj?.shape)
    ? labelsObj.shape
    : (Array.isArray(data.shape) ? data.shape : null);
  const rawDtype = typeof labelsObj?.dtype === 'string'
    ? labelsObj.dtype
    : (typeof data.dtype === 'string' ? data.dtype : null);

  let validShape = false;
  let widthPx = null;
  let heightPx = null;
  let totalPixels = 0;

  if (
    Array.isArray(rawShape)
    && rawShape.length === 2
    && typeof rawShape[0] === 'number'
    && Number.isInteger(rawShape[0])
    && rawShape[0] > 0
    && typeof rawShape[1] === 'number'
    && Number.isInteger(rawShape[1])
    && rawShape[1] > 0
  ) {
    heightPx = rawShape[0];
    widthPx = rawShape[1];
    totalPixels = heightPx * widthPx;
    validShape = true;
  } else {
    issues.push(`Invalid label shape: ${JSON.stringify(rawShape)} (expected [heightPx, widthPx]).`);
  }

  const dtype = rawDtype ? rawDtype.trim().toLowerCase() : null;
  const validDtype = dtype === 'uint8';
  if (!validDtype) {
    issues.push(`Unsupported or missing label dtype: '${rawDtype ?? 'null'}' (expected 'uint8').`);
  }

  // 6. Base64 raster decode QA check
  const rawBase64 = typeof labelsObj?.base64 === 'string'
    ? labelsObj.base64
    : (typeof data.base64 === 'string' ? data.base64 : null);

  let decodeSuccess = false;
  let decodedRaster = null;

  if (typeof rawBase64 === 'string' && rawBase64.trim().length > 0) {
    try {
      decodedRaster = decodeBase64ToUint8Array(rawBase64);
      decodeSuccess = true;
    } catch (error) {
      issues.push(`Base64 decode failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    issues.push('Missing base64 label raster.');
  }

  // 7. Decoded pixel count matches width * height
  let pixelCountMatchesShape = false;
  const decodedPixels = decodedRaster ? decodedRaster.length : 0;
  if (decodeSuccess && validShape) {
    if (decodedPixels === totalPixels) {
      pixelCountMatchesShape = true;
    } else {
      issues.push(`Decoded byte length (${decodedPixels}) does not match shape dimensions (${heightPx}x${widthPx} = ${totalPixels}).`);
    }
  }

  // 8. Raster scan: recompute counts, presence, bounding boxes, class ID range check
  const numClassesCount = classNames.length;
  const recomputedCounts = new Uint32Array(numClassesCount);
  const minXs = new Int32Array(numClassesCount).fill(-1);
  const maxXs = new Int32Array(numClassesCount).fill(-1);
  const minYs = new Int32Array(numClassesCount).fill(-1);
  const maxYs = new Int32Array(numClassesCount).fill(-1);

  let outOfRangePixelCount = 0;
  let maxOutOfRangeId = null;

  if (decodeSuccess && decodedRaster && validShape && pixelCountMatchesShape) {
    const w = widthPx;
    const len = decodedRaster.length;
    for (let i = 0; i < len; i += 1) {
      const classId = decodedRaster[i];
      if (classId >= numClassesCount) {
        outOfRangePixelCount += 1;
        if (maxOutOfRangeId === null || classId > maxOutOfRangeId) {
          maxOutOfRangeId = classId;
        }
        continue;
      }
      recomputedCounts[classId] += 1;
      const x = i % w;
      const y = (i / w) | 0;

      if (minXs[classId] === -1) {
        minXs[classId] = x;
        maxXs[classId] = x;
        minYs[classId] = y;
        maxYs[classId] = y;
      } else {
        if (x < minXs[classId]) minXs[classId] = x;
        if (x > maxXs[classId]) maxXs[classId] = x;
        if (y < minYs[classId]) minYs[classId] = y;
        if (y > maxYs[classId]) maxYs[classId] = y;
      }
    }
  }

  let classIdsInRange = false;
  if (decodeSuccess && decodedRaster) {
    if (outOfRangePixelCount === 0) {
      classIdsInRange = true;
    } else {
      issues.push(`Found ${outOfRangePixelCount} pixels with class ID out of range [0..${numClassesCount - 1}] (max invalid ID: ${maxOutOfRangeId}).`);
    }
  }

  // 9. Recomputed pixel counts match class_counts QA check
  // Note: sparse count objects treat omitted classes as 0.
  let countsMatch = false;
  const recomputedClassCountsMap = {};
  for (let c = 0; c < numClassesCount; c += 1) {
    recomputedClassCountsMap[classNames[c]] = recomputedCounts[c];
  }

  if (decodeSuccess && pixelCountMatchesShape && classIdsInRange) {
    let allMatched = true;
    for (let c = 0; c < numClassesCount; c += 1) {
      const label = classNames[c];
      const recomputed = recomputedCounts[c];
      const expected = getExpectedClassCount(inputClassCounts, c, label);
      if (recomputed !== expected) {
        allMatched = false;
        issues.push(`Pixel count mismatch for class '${label}' (id ${c}): expected ${expected}, recomputed ${recomputed}.`);
      }
    }
    countsMatch = allMatched;
  }

  // Check for any unexpected extra keys in inputClassCounts
  if (inputClassCounts && typeof inputClassCounts === 'object') {
    const knownNamesLower = new Set(classNames.map((n) => n.toLowerCase()));
    for (const key of Object.keys(inputClassCounts)) {
      if (!knownNamesLower.has(key.toLowerCase()) && !/^\d+$/.test(key)) {
        warnings.push(`class_counts contains unknown class key: '${key}'.`);
      }
    }
  }

  // 10. Per-class derivation: classes[]
  const classes = [];
  const rejectedClasses = [];
  const validOutputCounts = {};

  for (let c = 0; c < numClassesCount; c += 1) {
    const label = classNames[c];
    const isRejected = isRejectedSegmentationClass(label);
    if (isRejected) {
      rejectedClasses.push(label);
    }

    const pixelCount = recomputedCounts[c];
    const present = pixelCount > 0;
    const coverage = totalPixels > 0 ? (pixelCount / totalPixels) : 0;

    let boundsPx = null;
    let boundsNormalized = null;

    if (present && widthPx > 0 && heightPx > 0) {
      const minX = minXs[c];
      const maxX = maxXs[c];
      const minY = minYs[c];
      const maxY = maxYs[c];

      boundsPx = {
        minX,
        minY,
        maxX,
        maxY,
      };

      boundsNormalized = {
        minX: minX / widthPx,
        minY: minY / heightPx,
        maxX: maxX / widthPx,
        maxY: maxY / heightPx,
      };
    }

    validOutputCounts[label] = pixelCount;

    classes.push({
      classId: c,
      label,
      pixelCount,
      coverage,
      present,
      boundsPx,
      boundsNormalized,
    });
  }

  const valid = validView
    && numClassesMatches
    && validShape
    && validDtype
    && decodeSuccess
    && pixelCountMatchesShape
    && classIdsInRange
    && countsMatch;

  const raster = (decodeSuccess && decodedRaster && validShape && pixelCountMatchesShape)
    ? decodedRaster
    : null;

  return {
    view,
    model,
    widthPx,
    heightPx,
    dtype: dtype ?? rawDtype ?? null,
    raster,
    classes,
    // Backward compatibility fields:
    classNames,
    classCounts: validOutputCounts,
    rejectedClasses,
    labelShape: validShape ? [heightPx, widthPx] : (rawShape ?? null),
    labelDtype: dtype ?? rawDtype ?? null,
    qa: {
      valid,
      validView,
      numClassesMatches,
      validShape,
      validDtype,
      decodeSuccess,
      pixelCountMatchesShape,
      classIdsInRange,
      countsMatch,
      issues,
      warnings,
      recomputedClassCounts: recomputedClassCountsMap,
      inputClassCounts: { ...inputClassCounts },
      totalPixels,
      decodedPixels,
      outOfRangePixelCount,
    },
  };
}

/**
 * Backward-compatible wrapper for extracting segmentation.
 */
export function extractSegmentation(raw, options = {}) {
  return normalizeSegmentation(raw, options);
}

/**
 * Backward-compatible wrapper for classifying segmentation.
 */
export function classifySegmentation(segmentation) {
  if (segmentation && segmentation.classes && segmentation.qa) {
    return segmentation;
  }
  return normalizeSegmentation(segmentation);
}

/**
 * Fixed Body Evidence Import v0 scale assumptions.
 * Body-processing output is normalized by convention; Result / Scale JSON is not imported.
 * heightCm is postponed / not used in v0 (future user input).
 */
export const BODY_EVIDENCE_V0_SCALE = Object.freeze({
  canvasSize: 2000,
  imageWidth: 2000,
  imageHeight: 2000,
  pixelsPerCm: 10,
  heightCm: null,
  status: 'fixed',
  source: 'body-evidence-v0-fixed',
  sourceLabel: 'fixed Body Evidence v0 assumption',
});

export const SCALE_STATUS_FIXED = BODY_EVIDENCE_V0_SCALE.status;

/** Build the normalized scale object attached to every Body Evidence v0 analyze result. */
export function createFixedBodyEvidenceScale() {
  return {
    status: BODY_EVIDENCE_V0_SCALE.status,
    source: BODY_EVIDENCE_V0_SCALE.source,
    imageWidth: BODY_EVIDENCE_V0_SCALE.imageWidth,
    imageHeight: BODY_EVIDENCE_V0_SCALE.imageHeight,
    canvasSize: BODY_EVIDENCE_V0_SCALE.canvasSize,
    pixelsPerCm: BODY_EVIDENCE_V0_SCALE.pixelsPerCm,
    heightCm: null,
    targetBodyHeightPx: null,
    paste: {
      front: null,
      side: null,
    },
    files: {
      frontAligned: null,
      sideAligned: null,
    },
  };
}

function emptyViewPose() {
  return {
    total: 0,
    accepted: 0,
    rejectedFace: 0,
    lowConfidence: 0,
    core: 0,
    secondary: 0,
    ignoredNonCore: 0,
    rejectedLandmarks: [],
    ignoredLandmarks: [],
    acceptedLandmarks: [],
  };
}

/** Sum per-class pixel counts across views. */
function aggregateClassCounts(views) {
  const totals = {};
  for (const view of views) {
    for (const [name, count] of Object.entries(view.classCounts ?? {})) {
      totals[name] = (totals[name] ?? 0) + count;
    }
  }
  return totals;
}

/**
 * Build the normalized body-evidence QA result from loaded source payloads.
 * Scale is always the fixed Body Evidence v0 assumption (no Result JSON).
 * @param {{
 *   frontPose?: object|null,
 *   sidePose?: object|null,
 *   frontSeg?: object|null,
 *   sideSeg?: object|null,
 * }} sources
 */
export function analyzeBodyEvidence(sources = {}) {
  const {
    frontPose = null,
    sidePose = null,
    frontSeg = null,
    sideSeg = null,
  } = sources;

  const frontLandmarks = frontPose ? extractPoseLandmarks(frontPose) : [];
  const sideLandmarks = sidePose ? extractPoseLandmarks(sidePose) : [];

  const frontPoseStats = frontPose
    ? classifyPoseLandmarks(frontLandmarks, { view: 'front' })
    : emptyViewPose();
  const sidePoseStats = sidePose
    ? classifyPoseLandmarks(sideLandmarks, { view: 'side' })
    : emptyViewPose();
  const frontSegStats = frontSeg
    ? normalizeSegmentation(frontSeg, { expectedView: 'front' })
    : emptyNormalizedSegmentation('front');
  const sideSegStats = sideSeg
    ? normalizeSegmentation(sideSeg, { expectedView: 'side' })
    : emptyNormalizedSegmentation('side');

  const scale = createFixedBodyEvidenceScale();

  const allClassNames = [...new Set([...frontSegStats.classNames, ...sideSegStats.classNames])];
  const allRejectedClasses = [...new Set([
    ...frontSegStats.rejectedClasses,
    ...sideSegStats.rejectedClasses,
  ])];

  const notes = [
    'Body evidence is conceptual/mock data for QA only.',
    'Face/head landmarks and segmentation classes are rejected from body counts.',
    'Low-confidence body landmarks (score < 0.5) are counted but not rendered in v0.',
    'Only the core 13 front body anchors are overlay-rendered as primary candidates.',
    `Secondary Front candidates are limited to the v0 allowlist: ${SECONDARY_FRONT_BODY_ANCHORS.join(', ')}.`,
    `Secondary Side candidates are limited to the v0 allowlist: ${SECONDARY_SIDE_BODY_ANCHORS.join(', ')}.`,
    'Hand/finger/thumb detail, dense contours, and unstable model extras are deferred QA-only in v0.',
    `Scale uses fixed Body Evidence v0 assumption (${BODY_EVIDENCE_V0_SCALE.pixelsPerCm} px/cm, ${BODY_EVIDENCE_V0_SCALE.canvasSize}×${BODY_EVIDENCE_V0_SCALE.canvasSize} canvas).`,
    'heightCm is postponed / not used in v0.',
  ];

  return {
    version: BODY_EVIDENCE_VERSION,
    sourceFormat: BODY_EVIDENCE_SOURCE_FORMAT,
    isMockData: true,
    confidenceLevel: 'conceptual',
    scale,
    scaleDetected: false,
    scaleStatus: scale.status,
    views: {
      front: {
        pose: frontPoseStats,
        segmentation: frontSegStats,
      },
      side: {
        pose: sidePoseStats,
        segmentation: sideSegStats,
      },
    },
    qa: {
      totalLandmarks: frontPoseStats.total + sidePoseStats.total,
      acceptedBodyLandmarks: frontPoseStats.accepted + sidePoseStats.accepted,
      rejectedFaceLandmarks: frontPoseStats.rejectedFace + sidePoseStats.rejectedFace,
      lowConfidenceLandmarks: frontPoseStats.lowConfidence + sidePoseStats.lowConfidence,
      frontAcceptedCount: frontPoseStats.accepted,
      sideAcceptedCount: sidePoseStats.accepted,
      frontTotalLandmarks: frontPoseStats.total,
      frontCoreLandmarks: frontPoseStats.core,
      sideCoreLandmarks: sidePoseStats.core,
      renderableFrontLandmarks: frontPoseStats.core,
      frontSecondaryLandmarks: frontPoseStats.secondary,
      secondaryFrontLandmarks: frontPoseStats.secondary,
      sideSecondaryLandmarks: sidePoseStats.secondary,
      frontRejectedFaceLandmarks: frontPoseStats.rejectedFace,
      sideRejectedFaceLandmarks: sidePoseStats.rejectedFace,
      frontIgnoredNonCoreLandmarks: frontPoseStats.ignoredNonCore,
      sideIgnoredNonCoreLandmarks: sidePoseStats.ignoredNonCore,
      secondaryFrontLandmarkNames: frontPoseStats.acceptedLandmarks
        .filter((landmark) => landmark.secondary)
        .map((landmark) => landmark.name),
      secondarySideLandmarkNames: sidePoseStats.acceptedLandmarks
        .filter((landmark) => landmark.secondary)
        .map((landmark) => landmark.name),
      secondaryAllowlist: [...SECONDARY_FRONT_BODY_ANCHORS],
      secondarySideAllowlist: [...SECONDARY_SIDE_BODY_ANCHORS],
      ignoredFrontLandmarks: frontPoseStats.ignoredLandmarks.map((landmark) => ({ ...landmark })),
      ignoredSideLandmarks: sidePoseStats.ignoredLandmarks.map((landmark) => ({ ...landmark })),
      rejectedFrontLandmarks: frontPoseStats.rejectedLandmarks.map((landmark) => ({ ...landmark })),
      rejectedSideLandmarks: sidePoseStats.rejectedLandmarks.map((landmark) => ({ ...landmark })),
      ignoredNonCoreLandmarks: frontPoseStats.ignoredNonCore + sidePoseStats.ignoredNonCore,
      segmentationClassCount: allClassNames.length,
      rejectedSegmentationClasses: allRejectedClasses,
      classNames: allClassNames,
      classCounts: aggregateClassCounts([frontSegStats, sideSegStats]),
      notes,
    },
    loaded: {
      frontPose: Boolean(frontPose),
      sidePose: Boolean(sidePose),
      frontSeg: Boolean(frontSeg),
      sideSeg: Boolean(sideSeg),
    },
  };
}

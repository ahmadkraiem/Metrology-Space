/**
 * Anatomical Level Contract v0
 *
 * Pure deterministic domain contract that formalizes true anatomical Y reference
 * levels from existing promoted Front body landmarks.
 *
 * Contract: 'anatomical-levels-v0'
 * View: 'front'
 *
 * Supports strictly 7 v0 anatomical levels:
 * - neck
 * - shoulder
 * - elbow
 * - wrist
 * - hip
 * - knee
 * - ankle
 *
 * Deferred anatomy (chest, bust, underbust, waist, abdomen, pelvis, crotch)
 * remains explicitly unsupported.
 *
 * STRICT GUARDRAILS:
 * - Read-only from promoted Front annotations (type === 'body_landmark') only.
 * - Does not consume raw Body Evidence candidates, Side landmarks, segmentation,
 *   pointmap, normals, Dense Evidence QA, or Front-Side Alignment.
 * - Does not derive X or Z, convert U -> Z, infer depth, or fuse 2D/3D geometry.
 * - Does not invent proportional rules or body-height percentages.
 */

import { getAnnotations } from './annotations.js';
import { normalizeLandmarkName } from './bodyEvidenceAdapter.js';

export const ANATOMICAL_LEVELS_CONTRACT_VERSION = 'anatomical-levels-v0';
export const ANATOMICAL_LEVELS_CONTRACT = 'anatomical-levels-v0';
export const ANATOMICAL_LEVELS_VIEW = 'front';

/** Matches promoted body landmark annotation type; sole data source for Anatomical Levels v0. */
const BODY_LANDMARK_TYPE = 'body_landmark';

/**
 * Exact lowercase status enum for anatomical levels.
 * @readonly
 * @enum {string}
 */
export const ANATOMICAL_LEVEL_STATUS = Object.freeze({
  READY: 'ready',
  PARTIAL: 'partial',
  MISSING: 'missing',
});

/**
 * Derivation method constants.
 * @readonly
 * @enum {string}
 */
export const ANATOMICAL_DERIVATION_METHOD = Object.freeze({
  SINGLE_LANDMARK_Y: 'single_landmark_y',
  BILATERAL_MEAN_Y: 'bilateral_mean_y',
});

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   requiredAnchors: readonly string[],
 *   derivationMethod: 'single_landmark_y'|'bilateral_mean_y',
 * }} AnatomicalLevelDefinitionV0
 */

/**
 * Supported v0 Anatomical Level Definitions in deterministic stable order.
 * Exactly 7 levels.
 * @type {readonly AnatomicalLevelDefinitionV0[]}
 */
export const ANATOMICAL_LEVEL_DEFINITIONS_V0 = Object.freeze([
  Object.freeze({
    id: 'neck',
    name: 'Neck Level',
    requiredAnchors: Object.freeze(['neck']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.SINGLE_LANDMARK_Y,
  }),
  Object.freeze({
    id: 'shoulder',
    name: 'Shoulder Level',
    requiredAnchors: Object.freeze(['left_shoulder', 'right_shoulder']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y,
  }),
  Object.freeze({
    id: 'elbow',
    name: 'Elbow Level',
    requiredAnchors: Object.freeze(['left_elbow', 'right_elbow']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y,
  }),
  Object.freeze({
    id: 'wrist',
    name: 'Wrist Level',
    requiredAnchors: Object.freeze(['left_wrist', 'right_wrist']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y,
  }),
  Object.freeze({
    id: 'hip',
    name: 'Hip Level',
    requiredAnchors: Object.freeze(['left_hip', 'right_hip']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y,
  }),
  Object.freeze({
    id: 'knee',
    name: 'Knee Level',
    requiredAnchors: Object.freeze(['left_knee', 'right_knee']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y,
  }),
  Object.freeze({
    id: 'ankle',
    name: 'Ankle Level',
    requiredAnchors: Object.freeze(['left_ankle', 'right_ankle']),
    derivationMethod: ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y,
  }),
]);

export const ANATOMICAL_LEVEL_IDS_V0 = Object.freeze(
  ANATOMICAL_LEVEL_DEFINITIONS_V0.map((def) => def.id),
);

/** Set of all required anchor names recognized by v0 levels. */
const ALL_REQUIRED_ANCHORS_SET = new Set(
  ANATOMICAL_LEVEL_DEFINITIONS_V0.flatMap((def) => def.requiredAnchors),
);

/**
 * Checks if a value is a valid finite coordinate number.
 * @param {unknown} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Extract Y coordinate in cm from runtime or restored annotation entry.
 * Uses only genuine annotation coordinate field shapes:
 * - runtime in-memory shape: entry.point.y
 * - restored/serialized shape: entry.position.y
 *
 * @param {object} entry
 * @returns {number|null}
 */
function extractAnnotationY(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const rawY = entry.point?.y ?? entry.position?.y;
  return isFiniteNumber(rawY) ? rawY : null;
}

/**
 * @typedef {{
 *   rawName: string,
 *   y: number|null,
 *   hasRawCandidate: boolean,
 * }} RawAnchorCandidate
 */

/**
 * Index promoted body_landmark annotations by normalized anchor name.
 * Collects all candidate instances to explicitly detect duplicates and invalid entries.
 *
 * @param {Array<object>|null|undefined} annotations
 * @returns {Map<string, RawAnchorCandidate[]>}
 */
function indexPromotedBodyLandmarkCandidates(annotations) {
  /** @type {Map<string, RawAnchorCandidate[]>} */
  const candidatesByAnchor = new Map();

  for (const entry of Array.isArray(annotations) ? annotations : []) {
    if (!entry || typeof entry !== 'object' || entry.type !== BODY_LANDMARK_TYPE) {
      continue;
    }

    const normalizedName = normalizeLandmarkName(entry.name);
    if (!normalizedName || !ALL_REQUIRED_ANCHORS_SET.has(normalizedName)) {
      continue;
    }

    const y = extractAnnotationY(entry);
    const candidate = {
      rawName: String(entry.name ?? ''),
      y,
      hasRawCandidate: true,
    };

    const existing = candidatesByAnchor.get(normalizedName);
    if (existing) {
      existing.push(candidate);
    } else {
      candidatesByAnchor.set(normalizedName, [candidate]);
    }
  }

  return candidatesByAnchor;
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   status: 'ready'|'partial'|'missing',
 *   requiredAnchors: string[],
 *   presentAnchors: string[],
 *   missingAnchors: string[],
 *   yCm: number|null,
 *   elevationDeltaCm: number|null,
 *   derivation: {
 *     method: 'single_landmark_y'|'bilateral_mean_y'|null,
 *   },
 *   issues: string[],
 * }} AnatomicalLevelReportEntryV0
 */

/**
 * @typedef {{
 *   contract: 'anatomical-levels-v0',
 *   view: 'front',
 *   levels: AnatomicalLevelReportEntryV0[],
 *   summary: {
 *     total: number,
 *     ready: number,
 *     partial: number,
 *     missing: number,
 *   },
 * }} AnatomicalLevelsReportV0
 */

/**
 * Computes deterministic Anatomical Level Contract v0 report from promoted Front annotations.
 * Pure and non-mutating.
 *
 * @param {Array<object>} [annotations] - Optional annotation collection (defaults to getAnnotations())
 * @returns {AnatomicalLevelsReportV0}
 */
export function computeAnatomicalLevels(annotations = getAnnotations()) {
  const candidatesByAnchor = indexPromotedBodyLandmarkCandidates(annotations);

  let readyCount = 0;
  let partialCount = 0;
  let missingCount = 0;

  const levels = ANATOMICAL_LEVEL_DEFINITIONS_V0.map((def) => {
    /** @type {string[]} */
    const presentAnchors = [];
    /** @type {string[]} */
    const missingAnchors = [];
    /** @type {string[]} */
    const issues = [];

    /** @type {Map<string, number>} */
    const validYByAnchor = new Map();
    let hasAnyCandidateEvidence = false;

    for (const anchorName of def.requiredAnchors) {
      const candidates = candidatesByAnchor.get(anchorName) ?? [];

      if (candidates.length === 0) {
        missingAnchors.push(anchorName);
      } else {
        hasAnyCandidateEvidence = true;

        if (candidates.length > 1) {
          missingAnchors.push(anchorName);
          issues.push(
            `Duplicate promoted landmark for anchor "${anchorName}" (${candidates.length} found)`,
          );
        } else {
          const candidate = candidates[0];
          if (candidate.y !== null) {
            presentAnchors.push(anchorName);
            validYByAnchor.set(anchorName, candidate.y);
          } else {
            missingAnchors.push(anchorName);
            issues.push(`Non-finite Y coordinate for anchor "${anchorName}"`);
          }
        }
      }
    }

    const allRequiredValid = def.requiredAnchors.every((name) => validYByAnchor.has(name));

    let status = ANATOMICAL_LEVEL_STATUS.MISSING;
    let yCm = null;
    let elevationDeltaCm = null;
    let method = null;

    if (allRequiredValid && issues.length === 0) {
      status = ANATOMICAL_LEVEL_STATUS.READY;
      readyCount += 1;

      if (def.derivationMethod === ANATOMICAL_DERIVATION_METHOD.SINGLE_LANDMARK_Y) {
        yCm = validYByAnchor.get(def.requiredAnchors[0]);
        elevationDeltaCm = null;
        method = ANATOMICAL_DERIVATION_METHOD.SINGLE_LANDMARK_Y;
      } else if (def.derivationMethod === ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y) {
        const leftY = validYByAnchor.get(def.requiredAnchors[0]);
        const rightY = validYByAnchor.get(def.requiredAnchors[1]);
        yCm = (leftY + rightY) / 2;
        elevationDeltaCm = Math.abs(leftY - rightY);
        method = ANATOMICAL_DERIVATION_METHOD.BILATERAL_MEAN_Y;
      }
    } else if (hasAnyCandidateEvidence) {
      status = ANATOMICAL_LEVEL_STATUS.PARTIAL;
      partialCount += 1;
    } else {
      status = ANATOMICAL_LEVEL_STATUS.MISSING;
      missingCount += 1;
    }

    return {
      id: def.id,
      name: def.name,
      status,
      requiredAnchors: [...def.requiredAnchors],
      presentAnchors,
      missingAnchors,
      yCm,
      elevationDeltaCm,
      derivation: {
        method,
      },
      issues,
    };
  });

  return {
    contract: ANATOMICAL_LEVELS_CONTRACT_VERSION,
    view: ANATOMICAL_LEVELS_VIEW,
    levels,
    summary: {
      total: ANATOMICAL_LEVEL_DEFINITIONS_V0.length,
      ready: readyCount,
      partial: partialCount,
      missing: missingCount,
    },
  };
}

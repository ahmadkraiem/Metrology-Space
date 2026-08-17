/**
 * Measurement Reference Levels v0 — read-only organization of promoted
 * `body_landmark` annotations into anatomical reference levels.
 *
 * Internal compute helper (available for reuse). Separate Levels UI panel
 * is not shown after Body Tab Consolidation; useful spans/readiness live in
 * Body Measurement Readiness via Anatomical Measurement Lines + audit.
 *
 * Not Body Graph, not measurement generation, not latent space.
 * Spans are display-only and are never written to annotations or history.
 */

import { calculateDistance } from '../core/math.js';
import { getAnnotations } from './annotations.js';
import { normalizeLandmarkName } from './bodyEvidenceAdapter.js';

/** Matches promoted body landmark annotation type; read-only data source for level summaries. */
const BODY_LANDMARK_TYPE = 'body_landmark';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   requiredAnchors: readonly string[],
 *   span: { from: string, to: string, label: string } | null,
 * }} MeasurementReferenceLevelDef
 */

/** @type {readonly MeasurementReferenceLevelDef[]} */
export const MEASUREMENT_REFERENCE_LEVELS = Object.freeze([
  Object.freeze({
    id: 'neck',
    name: 'Neck Level',
    requiredAnchors: Object.freeze(['neck']),
    span: null,
  }),
  Object.freeze({
    id: 'shoulder',
    name: 'Shoulder Level',
    requiredAnchors: Object.freeze(['left_shoulder', 'right_shoulder']),
    span: Object.freeze({
      from: 'left_shoulder',
      to: 'right_shoulder',
      label: 'Shoulder span',
    }),
  }),
  Object.freeze({
    id: 'elbow',
    name: 'Elbow Level',
    requiredAnchors: Object.freeze(['left_elbow', 'right_elbow']),
    span: Object.freeze({
      from: 'left_elbow',
      to: 'right_elbow',
      label: 'Elbow span',
    }),
  }),
  Object.freeze({
    id: 'wrist',
    name: 'Wrist Level',
    requiredAnchors: Object.freeze(['left_wrist', 'right_wrist']),
    span: Object.freeze({
      from: 'left_wrist',
      to: 'right_wrist',
      label: 'Wrist span',
    }),
  }),
  Object.freeze({
    id: 'hip',
    name: 'Hip Level',
    requiredAnchors: Object.freeze(['left_hip', 'right_hip']),
    span: Object.freeze({
      from: 'left_hip',
      to: 'right_hip',
      label: 'Hip span',
    }),
  }),
  Object.freeze({
    id: 'knee',
    name: 'Knee Level',
    requiredAnchors: Object.freeze(['left_knee', 'right_knee']),
    span: Object.freeze({
      from: 'left_knee',
      to: 'right_knee',
      label: 'Knee span',
    }),
  }),
  Object.freeze({
    id: 'ankle',
    name: 'Ankle Level',
    requiredAnchors: Object.freeze(['left_ankle', 'right_ankle']),
    span: Object.freeze({
      from: 'left_ankle',
      to: 'right_ankle',
      label: 'Ankle span',
    }),
  }),
]);

function isFiniteCoord(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasFinitePoint(point) {
  return Boolean(
    point
    && isFiniteCoord(point.x)
    && isFiniteCoord(point.y)
    && isFiniteCoord(point.z),
  );
}

/**
 * Index promoted body_landmark annotations by normalized name.
 * First finite-point annotation wins when duplicates exist.
 *
 * @param {Array<{ type?: string, name?: string, point?: { x: number, y: number, z: number } }>|null|undefined} annotations
 * @returns {Map<string, { x: number, y: number, z: number }>}
 */
function indexPromotedBodyLandmarkPoints(annotations) {
  /** @type {Map<string, { x: number, y: number, z: number }>} */
  const byName = new Map();

  for (const entry of Array.isArray(annotations) ? annotations : []) {
    if (entry?.type !== BODY_LANDMARK_TYPE) {
      continue;
    }

    const normalizedName = normalizeLandmarkName(entry.name);
    if (!normalizedName || byName.has(normalizedName) || !hasFinitePoint(entry.point)) {
      continue;
    }

    byName.set(normalizedName, {
      x: entry.point.x,
      y: entry.point.y,
      z: entry.point.z,
    });
  }

  return byName;
}

/**
 * Read-only Measurement Reference Levels summary from promoted body_landmark
 * annotations only. Does not read Body Evidence state and does not mutate data.
 *
 * @param {Array<{ type?: string, name?: string, point?: { x: number, y: number, z: number } }>|null|undefined} [annotations]
 * @returns {{
 *   levels: Array<{
 *     id: string,
 *     name: string,
 *     requiredAnchors: string[],
 *     presentAnchors: string[],
 *     missingAnchors: string[],
 *     status: 'Ready'|'Missing',
 *     spanLabel: string|null,
 *     spanCm: number|null,
 *   }>,
 * }}
 */
export function buildMeasurementReferenceLevels(annotations = getAnnotations()) {
  const pointsByName = indexPromotedBodyLandmarkPoints(annotations);

  const levels = MEASUREMENT_REFERENCE_LEVELS.map((level) => {
    const presentAnchors = level.requiredAnchors.filter((name) => pointsByName.has(name));
    const missingAnchors = level.requiredAnchors.filter((name) => !pointsByName.has(name));
    const status = missingAnchors.length === 0 ? 'Ready' : 'Missing';

    let spanLabel = null;
    let spanCm = null;

    if (level.span) {
      const fromPoint = pointsByName.get(level.span.from);
      const toPoint = pointsByName.get(level.span.to);
      if (fromPoint && toPoint) {
        spanLabel = level.span.label;
        spanCm = calculateDistance(fromPoint, toPoint);
      }
    }

    return {
      id: level.id,
      name: level.name,
      requiredAnchors: [...level.requiredAnchors],
      presentAnchors,
      missingAnchors,
      status,
      spanLabel,
      spanCm,
    };
  });

  return { levels };
}

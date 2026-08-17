/**
 * Anatomical Measurement Lines v0 — read-only measurement candidate lines
 * derived from promoted `body_landmark` annotations.
 *
 * Not A/B measurement, not measurement history, not Body Graph, not latent space.
 * Distances are display-only and are never written to annotations or history.
 * Ready endpoint positions are available for visual-only preview overlays.
 */

import { calculateDistance } from '../core/math.js';
import { getAnnotations } from './annotations.js';
import { normalizeLandmarkName } from './bodyEvidenceAdapter.js';

/** Matches promoted body landmark annotation type; read-only data source for measurement candidates. */
const BODY_LANDMARK_TYPE = 'body_landmark';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   from: string,
 *   to: string,
 * }} AnatomicalMeasurementLineDef
 */

/** @type {readonly AnatomicalMeasurementLineDef[]} */
export const ANATOMICAL_MEASUREMENT_LINES = Object.freeze([
  Object.freeze({
    id: 'shoulder_width',
    name: 'Shoulder Width',
    from: 'left_shoulder',
    to: 'right_shoulder',
  }),
  Object.freeze({
    id: 'elbow_span',
    name: 'Elbow Span',
    from: 'left_elbow',
    to: 'right_elbow',
  }),
  Object.freeze({
    id: 'wrist_span',
    name: 'Wrist Span',
    from: 'left_wrist',
    to: 'right_wrist',
  }),
  Object.freeze({
    id: 'hip_width',
    name: 'Hip Width',
    from: 'left_hip',
    to: 'right_hip',
  }),
  Object.freeze({
    id: 'knee_span',
    name: 'Knee Span',
    from: 'left_knee',
    to: 'right_knee',
  }),
  Object.freeze({
    id: 'ankle_span',
    name: 'Ankle Span',
    from: 'left_ankle',
    to: 'right_ankle',
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
 * Read-only Anatomical Measurement Lines from promoted body_landmark
 * annotations only. Does not read Body Evidence state and does not mutate data.
 *
 * @param {Array<{ type?: string, name?: string, point?: { x: number, y: number, z: number } }>|null|undefined} [annotations]
 * @returns {{
 *   lines: Array<{
 *     id: string,
 *     name: string,
 *     from: string,
 *     to: string,
 *     status: 'Ready'|'Missing',
 *     missingAnchors: string[],
 *     distanceCm: number|null,
 *     fromPoint: { x: number, y: number, z: number }|null,
 *     toPoint: { x: number, y: number, z: number }|null,
 *   }>,
 * }}
 */
export function buildAnatomicalMeasurementLines(annotations = getAnnotations()) {
  const pointsByName = indexPromotedBodyLandmarkPoints(annotations);

  const lines = ANATOMICAL_MEASUREMENT_LINES.map((line) => {
    const requiredAnchors = [line.from, line.to];
    const missingAnchors = requiredAnchors.filter((name) => !pointsByName.has(name));
    const status = missingAnchors.length === 0 ? 'Ready' : 'Missing';

    let distanceCm = null;
    /** @type {{ x: number, y: number, z: number }|null} */
    let fromPoint = null;
    /** @type {{ x: number, y: number, z: number }|null} */
    let toPoint = null;

    if (status === 'Ready') {
      const from = pointsByName.get(line.from);
      const to = pointsByName.get(line.to);
      fromPoint = { x: from.x, y: from.y, z: from.z };
      toPoint = { x: to.x, y: to.y, z: to.z };
      distanceCm = calculateDistance(fromPoint, toPoint);
    }

    return {
      id: line.id,
      name: line.name,
      from: line.from,
      to: line.to,
      status,
      missingAnchors,
      distanceCm,
      fromPoint,
      toPoint,
    };
  });

  return { lines };
}

/**
 * Body Graph Contract v0 — deterministic runtime graph derivation only.
 *
 * Derives a symbolic body topology from promoted `body_landmark` annotations
 * (Core 13 nodes + fixed structural edges). Does not render, does not persist,
 * does not read raw Body Evidence, and does not change annotation/export schema.
 *
 * Callers pass the annotation collection explicitly (e.g. `getAnnotations()`).
 * This keeps the module free of annotations/DOM coupling until a preview
 * consumer wires it.
 *
 * Node ids reuse `CORE_FRONT_BODY_ANCHORS` from `bodyEvidenceAdapter.js` as the
 * shared Core 13 name contract only — this module does not touch Body Evidence
 * session state. Structural edges here are separate from Body Measurement
 * Readiness / Anatomical Measurement Lines (Shoulder Width, Hip Width, etc.).
 */

import {
  CORE_FRONT_BODY_ANCHORS,
  normalizeLandmarkName,
} from './bodyEvidenceAdapter.js';

/** Matches promoted body landmark annotation type; sole Body Graph v0 data source. */
const BODY_LANDMARK_TYPE = 'body_landmark';

/**
 * Body Graph v0 node contract — Core 13 only.
 * Reuses the shared Core 13 id list to avoid drift; secondary landmarks are
 * intentionally excluded even when promoted as normal `body_landmark` annotations.
 *
 * @type {readonly string[]}
 */
export const BODY_GRAPH_V0_NODES = CORE_FRONT_BODY_ANCHORS;

const BODY_GRAPH_V0_NODE_SET = new Set(BODY_GRAPH_V0_NODES);

/**
 * @typedef {{
 *   id: string,
 *   from: string,
 *   to: string,
 * }} BodyGraphStructuralEdgeDef
 */

/**
 * Body Graph v0 deterministic structural edges (topology only).
 * Not measurement-readiness spans.
 *
 * @type {readonly BodyGraphStructuralEdgeDef[]}
 */
export const BODY_GRAPH_V0_EDGES = Object.freeze([
  Object.freeze({ id: 'neck__left_shoulder', from: 'neck', to: 'left_shoulder' }),
  Object.freeze({ id: 'neck__right_shoulder', from: 'neck', to: 'right_shoulder' }),
  Object.freeze({ id: 'left_shoulder__left_elbow', from: 'left_shoulder', to: 'left_elbow' }),
  Object.freeze({ id: 'left_elbow__left_wrist', from: 'left_elbow', to: 'left_wrist' }),
  Object.freeze({ id: 'right_shoulder__right_elbow', from: 'right_shoulder', to: 'right_elbow' }),
  Object.freeze({ id: 'right_elbow__right_wrist', from: 'right_elbow', to: 'right_wrist' }),
  Object.freeze({ id: 'left_shoulder__left_hip', from: 'left_shoulder', to: 'left_hip' }),
  Object.freeze({ id: 'right_shoulder__right_hip', from: 'right_shoulder', to: 'right_hip' }),
  Object.freeze({ id: 'left_hip__right_hip', from: 'left_hip', to: 'right_hip' }),
  Object.freeze({ id: 'left_hip__left_knee', from: 'left_hip', to: 'left_knee' }),
  Object.freeze({ id: 'left_knee__left_ankle', from: 'left_knee', to: 'left_ankle' }),
  Object.freeze({ id: 'right_hip__right_knee', from: 'right_hip', to: 'right_knee' }),
  Object.freeze({ id: 'right_knee__right_ankle', from: 'right_knee', to: 'right_ankle' }),
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
 * Index promoted Core-13 `body_landmark` annotations by normalized name.
 * Secondary / non-Core landmarks are ignored for Body Graph v0.
 * First finite-point annotation wins when duplicates exist.
 *
 * @param {Array<{ id?: number|string, type?: string, name?: string, point?: { x: number, y: number, z: number } }>|null|undefined} annotations
 * @returns {Map<string, { id: number|string|null, position: { x: number, y: number, z: number } }>}
 */
function indexCoreBodyGraphNodes(annotations) {
  /** @type {Map<string, { id: number|string|null, position: { x: number, y: number, z: number } }>} */
  const byName = new Map();

  for (const entry of Array.isArray(annotations) ? annotations : []) {
    if (entry?.type !== BODY_LANDMARK_TYPE) {
      continue;
    }

    const normalizedName = normalizeLandmarkName(entry.name);
    if (
      !normalizedName
      || !BODY_GRAPH_V0_NODE_SET.has(normalizedName)
      || byName.has(normalizedName)
      || !hasFinitePoint(entry.point)
    ) {
      continue;
    }

    byName.set(normalizedName, {
      id: entry.id ?? null,
      position: {
        x: entry.point.x,
        y: entry.point.y,
        z: entry.point.z,
      },
    });
  }

  return byName;
}

/**
 * Build Body Graph v0 from the current annotation collection.
 * Pure / read-only: does not mutate annotations, does not fabricate nodes,
 * and remains valid when only a subset of Core 13 is promoted.
 *
 * @param {Array<{ id?: number|string, type?: string, name?: string, point?: { x: number, y: number, z: number } }>|null|undefined} annotations
 * @returns {{
 *   nodes: Array<{
 *     id: string,
 *     annotationId: number|string|null,
 *     position: { x: number, y: number, z: number },
 *   }>,
 *   missingNodes: string[],
 *   edges: Array<{
 *     id: string,
 *     from: string,
 *     to: string,
 *     status: 'Ready'|'Missing',
 *     missingEndpoints: string[],
 *     fromPoint: { x: number, y: number, z: number }|null,
 *     toPoint: { x: number, y: number, z: number }|null,
 *   }>,
 *   summary: {
 *     expectedNodes: number,
 *     presentNodes: number,
 *     missingNodes: number,
 *     totalEdges: number,
 *     readyEdges: number,
 *     missingEdges: number,
 *   },
 * }}
 */
export function buildBodyGraph(annotations) {
  const nodesById = indexCoreBodyGraphNodes(annotations);

  const nodes = BODY_GRAPH_V0_NODES
    .filter((id) => nodesById.has(id))
    .map((id) => {
      const entry = nodesById.get(id);
      return {
        id,
        annotationId: entry.id,
        position: {
          x: entry.position.x,
          y: entry.position.y,
          z: entry.position.z,
        },
      };
    });

  const missingNodes = BODY_GRAPH_V0_NODES.filter((id) => !nodesById.has(id));

  let readyEdges = 0;

  const edges = BODY_GRAPH_V0_EDGES.map((edge) => {
    const fromEntry = nodesById.get(edge.from);
    const toEntry = nodesById.get(edge.to);
    /** @type {string[]} */
    const missingEndpoints = [];

    if (!fromEntry) {
      missingEndpoints.push(edge.from);
    }
    if (!toEntry) {
      missingEndpoints.push(edge.to);
    }

    const status = missingEndpoints.length === 0 ? 'Ready' : 'Missing';
    if (status === 'Ready') {
      readyEdges += 1;
    }

    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      status,
      missingEndpoints,
      fromPoint: fromEntry
        ? { x: fromEntry.position.x, y: fromEntry.position.y, z: fromEntry.position.z }
        : null,
      toPoint: toEntry
        ? { x: toEntry.position.x, y: toEntry.position.y, z: toEntry.position.z }
        : null,
    };
  });

  const presentNodes = nodes.length;
  const totalEdges = BODY_GRAPH_V0_EDGES.length;

  return {
    nodes,
    missingNodes,
    edges,
    summary: {
      expectedNodes: BODY_GRAPH_V0_NODES.length,
      presentNodes,
      missingNodes: missingNodes.length,
      totalEdges,
      readyEdges,
      missingEdges: totalEdges - readyEdges,
    },
  };
}

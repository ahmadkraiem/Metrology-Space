/**
 * Body Graph Workspace v0 — read-only topological diagram for Body Graph Contract v0.
 *
 * Derives display state only via buildBodyGraph(getAnnotations()).
 * Does not edit annotations, measurements, Body Evidence, or export/import.
 */

import { formatCoordinate } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import {
  BODY_GRAPH_V0_NODES,
  buildBodyGraph,
} from '../features/bodyGraph.js';
import {
  bodyGraphEdgesEl,
  bodyGraphNodesEl,
  bodyGraphSummaryEdgesEl,
  bodyGraphSummaryNodesEl,
} from './domRefs.js';

/**
 * Deterministic anatomical diagram positions in SVG / stage percent space (0–100).
 * Left side of the diagram = subject left (schema preview, not scene XY mapping).
 */
const NODE_LAYOUT = Object.freeze({
  neck: Object.freeze({ x: 50, y: 12 }),
  left_shoulder: Object.freeze({ x: 34, y: 23 }),
  right_shoulder: Object.freeze({ x: 66, y: 23 }),
  left_elbow: Object.freeze({ x: 31, y: 35 }),
  right_elbow: Object.freeze({ x: 69, y: 35 }),
  left_wrist: Object.freeze({ x: 28, y: 47 }),
  right_wrist: Object.freeze({ x: 72, y: 47 }),
  left_hip: Object.freeze({ x: 38, y: 58 }),
  right_hip: Object.freeze({ x: 62, y: 58 }),
  left_knee: Object.freeze({ x: 38, y: 72 }),
  right_knee: Object.freeze({ x: 62, y: 72 }),
  left_ankle: Object.freeze({ x: 38, y: 86 }),
  right_ankle: Object.freeze({ x: 62, y: 86 }),
});

const SVG_NS = 'http://www.w3.org/2000/svg';

function formatNodeCoords(position) {
  return `X ${formatCoordinate(position.x)} · Y ${formatCoordinate(position.y)} · Z ${formatCoordinate(position.z)} cm`;
}

function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Rebuild the Body Graph diagram from the current annotation collection.
 */
export function refreshBodyGraphWorkspace() {
  const graph = buildBodyGraph(getAnnotations());
  const presentById = new Map(graph.nodes.map((node) => [node.id, node]));

  bodyGraphSummaryNodesEl.textContent = `${graph.summary.presentNodes}/13`;
  bodyGraphSummaryEdgesEl.textContent = `${graph.summary.readyEdges}/13`;

  clearElement(bodyGraphEdgesEl);
  clearElement(bodyGraphNodesEl);

  for (const edge of graph.edges) {
    const fromLayout = NODE_LAYOUT[edge.from];
    const toLayout = NODE_LAYOUT[edge.to];
    if (!fromLayout || !toLayout) {
      continue;
    }

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(fromLayout.x));
    line.setAttribute('y1', String(fromLayout.y));
    line.setAttribute('x2', String(toLayout.x));
    line.setAttribute('y2', String(toLayout.y));
    line.setAttribute('data-edge-id', edge.id);
    line.classList.add(
      'body-graph-edge',
      edge.status === 'Ready' ? 'body-graph-edge--ready' : 'body-graph-edge--missing',
    );

    bodyGraphEdgesEl.appendChild(line);
  }

  for (const nodeId of BODY_GRAPH_V0_NODES) {
    const layout = NODE_LAYOUT[nodeId];
    if (!layout) {
      continue;
    }

    const present = presentById.get(nodeId) ?? null;
    const isPresent = Boolean(present);

    const nodeEl = document.createElement('article');
    nodeEl.className = `body-graph-node ${isPresent ? 'body-graph-node--present' : 'body-graph-node--missing'}`;
    nodeEl.dataset.nodeId = nodeId;
    nodeEl.style.left = `${layout.x}%`;
    nodeEl.style.top = `${layout.y}%`;
    nodeEl.setAttribute('aria-label', isPresent
      ? `${formatLandmarkDisplayName(nodeId)}, present`
      : `${formatLandmarkDisplayName(nodeId)}, missing`);

    const nameEl = document.createElement('p');
    nameEl.className = 'body-graph-node-name';
    nameEl.textContent = formatLandmarkDisplayName(nodeId);

    const detailEl = document.createElement('p');
    detailEl.className = 'body-graph-node-detail';
    detailEl.textContent = isPresent
      ? formatNodeCoords(present.position)
      : 'Missing';

    nodeEl.append(nameEl, detailEl);
    bodyGraphNodesEl.appendChild(nodeEl);
  }
}

export function setupBodyGraphWorkspace() {
  refreshBodyGraphWorkspace();
  subscribeAnnotationsChange(refreshBodyGraphWorkspace);
}

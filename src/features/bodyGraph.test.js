import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BODY_GRAPH_V0_EDGES,
  BODY_GRAPH_V0_NODES,
  buildBodyGraph,
} from './bodyGraph.js';

const landmark = (name, point = { x: 1, y: 2, z: 3 }, id = name) => ({
  id,
  name,
  type: 'body_landmark',
  point,
});

test('Body Graph v0 contract is Core 13 nodes and 13 structural edges', () => {
  assert.equal(BODY_GRAPH_V0_NODES.length, 13);
  assert.equal(BODY_GRAPH_V0_EDGES.length, 13);
  assert.deepEqual([...BODY_GRAPH_V0_NODES], [
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
});

test('empty annotations yield all missing nodes/edges without throwing', () => {
  const graph = buildBodyGraph([]);

  assert.equal(graph.nodes.length, 0);
  assert.equal(graph.missingNodes.length, 13);
  assert.equal(graph.summary.presentNodes, 0);
  assert.equal(graph.summary.readyEdges, 0);
  assert.equal(graph.summary.missingEdges, 13);
  assert.ok(graph.edges.every((edge) => edge.status === 'Missing'));
});

test('partial Core 13 keeps present nodes and marks incomplete edges Missing', () => {
  const graph = buildBodyGraph([
    landmark('left_shoulder', { x: 10, y: 20, z: 30 }),
    landmark('neck', { x: 0, y: 40, z: 30 }),
  ]);

  assert.deepEqual(graph.nodes.map((node) => node.id), ['neck', 'left_shoulder']);
  assert.ok(!graph.missingNodes.includes('neck'));
  assert.ok(!graph.missingNodes.includes('left_shoulder'));
  assert.ok(graph.missingNodes.includes('left_elbow'));

  const neckToLeftShoulder = graph.edges.find((edge) => edge.id === 'neck__left_shoulder');
  assert.equal(neckToLeftShoulder.status, 'Ready');
  assert.deepEqual(neckToLeftShoulder.fromPoint, { x: 0, y: 40, z: 30 });
  assert.deepEqual(neckToLeftShoulder.toPoint, { x: 10, y: 20, z: 30 });

  const shoulderToElbow = graph.edges.find((edge) => edge.id === 'left_shoulder__left_elbow');
  assert.equal(shoulderToElbow.status, 'Missing');
  assert.deepEqual(shoulderToElbow.missingEndpoints, ['left_elbow']);
  assert.deepEqual(shoulderToElbow.fromPoint, { x: 10, y: 20, z: 30 });
  assert.equal(shoulderToElbow.toPoint, null);

  assert.equal(graph.summary.presentNodes, 2);
  assert.equal(graph.summary.missingNodes, 11);
  assert.equal(graph.summary.readyEdges, 1);
  assert.equal(graph.summary.missingEdges, 12);
});

test('secondary promoted body landmarks are ignored by Body Graph v0', () => {
  const graph = buildBodyGraph([
    landmark('left_shoulder', { x: 1, y: 2, z: 3 }),
    landmark('left_acromion', { x: 9, y: 9, z: 9 }),
    landmark('left_heel', { x: 8, y: 8, z: 8 }),
    { id: 'custom-1', name: 'origin', type: 'custom', point: { x: 0, y: 0, z: 0 } },
  ]);

  assert.deepEqual(graph.nodes.map((node) => node.id), ['left_shoulder']);
  assert.ok(!graph.nodes.some((node) => node.id === 'left_acromion'));
  assert.ok(!graph.nodes.some((node) => node.id === 'left_heel'));
  assert.equal(graph.summary.presentNodes, 1);
});

test('normalized Core landmark names resolve into Body Graph nodes', () => {
  const graph = buildBodyGraph([
    landmark('Left Shoulder', { x: 5, y: 6, z: 7 }),
    landmark('l_elbow', { x: 8, y: 9, z: 10 }),
  ]);

  assert.deepEqual(graph.nodes.map((node) => node.id), ['left_shoulder', 'left_elbow']);

  const edge = graph.edges.find((entry) => entry.id === 'left_shoulder__left_elbow');
  assert.equal(edge.status, 'Ready');
});

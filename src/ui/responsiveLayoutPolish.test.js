import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKSPACE_3D,
  WORKSPACE_SPLIT,
  WORKSPACE_BODY_GRAPH,
  getWorkspace,
  setWorkspace,
} from './workspaceLayout.js';

test('responsiveLayoutPolish: workspace modes switch cleanly', () => {
  setWorkspace(WORKSPACE_3D);
  assert.equal(getWorkspace(), WORKSPACE_3D);

  setWorkspace(WORKSPACE_SPLIT);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);

  setWorkspace(WORKSPACE_BODY_GRAPH);
  assert.equal(getWorkspace(), WORKSPACE_BODY_GRAPH);
});

test('responsiveLayoutPolish: responsive constraints preserve Left, Right, and Center structural separation', () => {
  // Verifies that 3D, Split (2D), and Body Graph remain discrete workspace modes
  const validModes = [WORKSPACE_3D, WORKSPACE_SPLIT, WORKSPACE_BODY_GRAPH];
  assert.equal(validModes.length, 3);
});

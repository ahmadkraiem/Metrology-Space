import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKSPACE_3D,
  WORKSPACE_SPLIT,
  WORKSPACE_BODY_GRAPH,
  getWorkspace,
  setWorkspace,
  subscribeWorkspaceChange,
  isRightSidebarCollapsed,
  setRightSidebarCollapsed,
  toggleRightSidebar,
} from './workspaceLayout.js';

test('workspace layout defaults to 3D and switches modes', () => {
  setWorkspace(WORKSPACE_3D);
  assert.equal(getWorkspace(), WORKSPACE_3D);

  const seen = [];
  const unsubscribe = subscribeWorkspaceChange((mode) => {
    seen.push(mode);
  });

  setWorkspace(WORKSPACE_SPLIT);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);
  assert.deepEqual(seen, [WORKSPACE_SPLIT]);

  setWorkspace(WORKSPACE_BODY_GRAPH);
  assert.equal(getWorkspace(), WORKSPACE_BODY_GRAPH);
  assert.deepEqual(seen, [WORKSPACE_SPLIT, WORKSPACE_BODY_GRAPH]);

  unsubscribe();
  setWorkspace(WORKSPACE_3D);
  assert.equal(getWorkspace(), WORKSPACE_3D);
  assert.deepEqual(seen, [WORKSPACE_SPLIT, WORKSPACE_BODY_GRAPH]);
});

test('workspace layout ignores invalid modes', () => {
  setWorkspace(WORKSPACE_3D);
  setWorkspace('invalid-mode');
  assert.equal(getWorkspace(), WORKSPACE_3D);
});

test('right sidebar collapse state can be queried, set, and toggled', () => {
  setRightSidebarCollapsed(false);
  assert.equal(isRightSidebarCollapsed(), false);

  setRightSidebarCollapsed(true);
  assert.equal(isRightSidebarCollapsed(), true);

  toggleRightSidebar();
  assert.equal(isRightSidebarCollapsed(), false);

  toggleRightSidebar();
  assert.equal(isRightSidebarCollapsed(), true);

  setRightSidebarCollapsed(false);
  assert.equal(isRightSidebarCollapsed(), false);
});

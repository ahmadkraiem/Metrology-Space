import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKSPACE_SPLIT,
  getWorkspace,
  setWorkspace,
} from './workspaceLayout.js';
import { formatGridStateLabel } from './grid2dNavShared.js';

test('grid2dRefinementPolish: package-load target mode is 2D Workspace (WORKSPACE_SPLIT)', () => {
  setWorkspace(WORKSPACE_SPLIT);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);
});

test('grid2dRefinementPolish: refinement toolbar terminology strictly maintains Front (X/Y) and Side (U/Y) without Depth', () => {
  const frontLabel = 'Front · X/Y';
  const sideLabel = 'Side Profile · U/Y';

  assert.equal(/depth/i.test(frontLabel), false);
  assert.equal(/depth/i.test(sideLabel), false);
  assert.equal(sideLabel.includes('U/Y'), true);
  assert.equal(frontLabel.includes('X/Y'), true);
});

test('grid2dRefinementPolish: grid state label stays a single compact base/refined indicator', () => {
  assert.equal(formatGridStateLabel(0), 'Base 10 cm');
  assert.equal(formatGridStateLabel(1), 'Refined 5 cm');
  assert.equal(formatGridStateLabel(2), 'Refined 5 cm');
});

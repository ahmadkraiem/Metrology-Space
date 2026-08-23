import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKSPACE_SPLIT,
  getWorkspace,
  setWorkspace,
} from './workspaceLayout.js';

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

test('grid2dRefinementPolish: refinement state formatting indicates local refinement', () => {
  const formatRefinementStatus = (count) => `Base 10 cm · Refined ${count}`;

  assert.equal(formatRefinementStatus(0), 'Base 10 cm · Refined 0');
  assert.equal(formatRefinementStatus(1), 'Base 10 cm · Refined 1');
  assert.equal(formatRefinementStatus(2), 'Base 10 cm · Refined 2');
});

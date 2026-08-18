import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSideEvidenceStatus } from './sideEvidenceStatus.js';

test('reports missing Side Pose before analysis', () => {
  assert.equal(
    formatSideEvidenceStatus({
      sidePoseLoaded: false,
      analyzed: false,
      coreCount: 0,
      secondaryCount: 0,
    }),
    'No Side Pose',
  );
});

test('reports loaded Side Pose before analysis', () => {
  assert.equal(
    formatSideEvidenceStatus({
      sidePoseLoaded: true,
      analyzed: false,
      coreCount: 0,
      secondaryCount: 0,
    }),
    'Side Pose loaded',
  );
});

test('reports analyzed state with no Side Pose source', () => {
  assert.equal(
    formatSideEvidenceStatus({
      sidePoseLoaded: false,
      analyzed: true,
      coreCount: 0,
      secondaryCount: 0,
    }),
    'Analyzed · no Side Pose',
  );
});

test('reports analyzed Side Pose with zero landmarks', () => {
  assert.equal(
    formatSideEvidenceStatus({
      sidePoseLoaded: true,
      analyzed: true,
      coreCount: 0,
      secondaryCount: 0,
    }),
    'Analyzed · 0 Side landmarks',
  );
});

test('reports compact Side core and secondary counts after analysis', () => {
  assert.equal(
    formatSideEvidenceStatus({
      sidePoseLoaded: true,
      analyzed: true,
      coreCount: 8,
      secondaryCount: 2,
    }),
    'Side Core 8 · Sec. 2',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderSubjectPackageCard,
  renderAnatomicalLevelsCard,
} from './leftPanel.js';

test('leftPanel: renderSubjectPackageCard renders empty state when no package is loaded', () => {
  const container = { innerHTML: '' };
  renderSubjectPackageCard(container);

  assert.equal(container.innerHTML.includes('No Body Evidence Package Loaded'), true);
  assert.equal(container.innerHTML.includes('Upload Evidence Package (.zip)'), true);
});

test('leftPanel: renderAnatomicalLevelsCard renders all 7 validated anatomical reference levels', () => {
  const container = { innerHTML: '' };
  renderAnatomicalLevelsCard(container);

  // Must render all 7 level names
  assert.equal(container.innerHTML.includes('Neck'), true);
  assert.equal(container.innerHTML.includes('Shoulder'), true);
  assert.equal(container.innerHTML.includes('Elbow'), true);
  assert.equal(container.innerHTML.includes('Wrist'), true);
  assert.equal(container.innerHTML.includes('Hip'), true);
  assert.equal(container.innerHTML.includes('Knee'), true);
  assert.equal(container.innerHTML.includes('Ankle'), true);
});

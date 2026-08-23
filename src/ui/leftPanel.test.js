import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { renderAnatomicalLevelsCard } from './leftPanel.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const markup = readFileSync(join(rootDir, 'index.html'), 'utf8');

test('leftPanel: Subject / Package card host is not in the live left sidebar', () => {
  assert.equal(markup.includes('id="subject-package-summary"'), false);
  assert.equal(markup.includes('subject-package-upload-btn'), false);
  assert.equal(markup.includes('id="anatomy-levels-list"'), true);
  assert.equal(markup.includes('data-command="import-body-evidence-package"'), true);
});

test('leftPanel: renderAnatomicalLevelsCard renders all 7 validated anatomical reference levels', () => {
  const container = { innerHTML: '' };
  renderAnatomicalLevelsCard(container);

  assert.equal(container.innerHTML.includes('Neck'), true);
  assert.equal(container.innerHTML.includes('Shoulder'), true);
  assert.equal(container.innerHTML.includes('Elbow'), true);
  assert.equal(container.innerHTML.includes('Wrist'), true);
  assert.equal(container.innerHTML.includes('Hip'), true);
  assert.equal(container.innerHTML.includes('Knee'), true);
  assert.equal(container.innerHTML.includes('Ankle'), true);
});

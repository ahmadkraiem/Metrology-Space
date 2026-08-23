import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const markup = readFileSync(
  fileURLToPath(new URL('../../index.html', import.meta.url)),
  'utf8',
);

/** Front pane markup through the Side pane, excluding the shared bottom toolbar. */
function navigatorPanesMarkup() {
  const start = markup.indexOf('<div class="workspace-2d-area">');
  const end = markup.indexOf('<div class="workspace-2d-toolbar">');
  assert.ok(start > -1 && end > start, '2D navigator markup must be present');
  return markup.slice(start, end);
}

test('grid2dNavigatorChrome: Front and Side headers keep compact identity only', () => {
  const panes = navigatorPanesMarkup();

  assert.match(panes, /grid2d-nav-title">Front</);
  assert.match(panes, /grid2d-nav-view-mode">X \/ Y</);
  assert.match(panes, /grid2d-nav-title--side">Side</);
  assert.match(panes, /grid2d-nav-view-mode">U \/ Y</);

  assert.equal(panes.includes('Canonical Front Surface'), false);
  assert.equal(panes.includes('Side Profile Navigator ·'), false);
  assert.equal(/class="grid2d-helper"/.test(panes), false);
});

test('grid2dNavigatorChrome: panes carry no repeated mode, step, or evidence count readouts', () => {
  const panes = navigatorPanesMarkup();

  assert.equal(panes.includes('Mode: Pick Point'), false);
  assert.equal(panes.includes('Step 10 cm'), false);
  assert.equal(/class="grid2d-status-row"/.test(panes), false);
  assert.equal(panes.includes('side-evidence-source-status'), false);
  assert.equal(panes.includes('Sec.'), false);
  assert.equal(/Side Core \d/.test(panes), false);
});

test('grid2dNavigatorChrome: empty selection state is one compact line without a Selection heading', () => {
  const panes = navigatorPanesMarkup();

  assert.equal(panes.match(/No selection/g)?.length, 2);
  assert.equal(panes.includes('Click a point or drag a region'), false);
  assert.equal(/grid2d-readout-heading/.test(panes), false);
});

test('grid2dNavigatorChrome: Back / Reset / Split controls and grid state chips survive the cleanup', () => {
  for (const id of [
    'grid2d-back',
    'grid2d-reset',
    'grid2d-split',
    'side-grid-back',
    'side-grid-reset',
    'side-grid-split',
  ]) {
    assert.ok(markup.includes(`id="${id}"`), `${id} must remain in the toolbar`);
  }

  assert.equal(markup.match(/class="grid2d-refinement-status"[^>]*>Base 10 cm</g)?.length, 2);
});

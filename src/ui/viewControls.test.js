import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VIEW_SETTING_IDS,
  applyViewSetting,
  getViewSetting,
  subscribeViewSettingChange,
  toggleViewSetting,
} from './viewControls.js';

test('VIEW_SETTING_IDS contains all 11 view setting definitions', () => {
  assert.equal(VIEW_SETTING_IDS.ORIGIN_CENTER, 'origin-center');
  assert.equal(VIEW_SETTING_IDS.ANNOTATIONS, 'annotations');
  assert.equal(VIEW_SETTING_IDS.MEASUREMENT_LINES, 'measurement-lines');
  assert.equal(VIEW_SETTING_IDS.LATTICE_3D, 'lattice-3d');
  assert.equal(VIEW_SETTING_IDS.FRONT_GRID, 'front-grid');
  assert.equal(VIEW_SETTING_IDS.SIDE_GRID, 'side-grid');
  assert.equal(VIEW_SETTING_IDS.FRONT_CORE, 'front-core');
  assert.equal(VIEW_SETTING_IDS.FRONT_SECONDARY, 'front-secondary');
  assert.equal(VIEW_SETTING_IDS.SIDE_CORE, 'side-core');
  assert.equal(VIEW_SETTING_IDS.SIDE_SECONDARY, 'side-secondary');
  assert.equal(VIEW_SETTING_IDS.BODY_PREVIEWS, 'body-previews');
});

test('getViewSetting returns valid checked and disabled flags for core view settings', () => {
  const origin = getViewSetting(VIEW_SETTING_IDS.ORIGIN_CENTER);
  assert.equal(typeof origin.checked, 'boolean');
  assert.equal(typeof origin.disabled, 'boolean');

  const annos = getViewSetting(VIEW_SETTING_IDS.ANNOTATIONS);
  assert.equal(typeof annos.checked, 'boolean');
  assert.equal(annos.disabled, false);

  const frontGrid = getViewSetting(VIEW_SETTING_IDS.FRONT_GRID);
  assert.equal(typeof frontGrid.checked, 'boolean');
  assert.equal(frontGrid.disabled, false);

  const sideGrid = getViewSetting(VIEW_SETTING_IDS.SIDE_GRID);
  assert.equal(typeof sideGrid.checked, 'boolean');
  assert.equal(sideGrid.disabled, false);

  const previews = getViewSetting(VIEW_SETTING_IDS.BODY_PREVIEWS);
  assert.equal(typeof previews.checked, 'boolean');
  assert.equal(previews.disabled, false);
});

test('applyViewSetting updates state and notifies subscribers', () => {
  let notified = 0;
  const unsubscribe = subscribeViewSettingChange(() => {
    notified += 1;
  });

  applyViewSetting(VIEW_SETTING_IDS.ANNOTATIONS, false);
  assert.equal(getViewSetting(VIEW_SETTING_IDS.ANNOTATIONS).checked, false);
  assert.ok(notified > 0);

  applyViewSetting(VIEW_SETTING_IDS.ANNOTATIONS, true);
  assert.equal(getViewSetting(VIEW_SETTING_IDS.ANNOTATIONS).checked, true);

  unsubscribe();
});

test('toggleViewSetting flips the enabled setting', () => {
  applyViewSetting(VIEW_SETTING_IDS.FRONT_GRID, true);
  assert.equal(getViewSetting(VIEW_SETTING_IDS.FRONT_GRID).checked, true);

  toggleViewSetting(VIEW_SETTING_IDS.FRONT_GRID);
  assert.equal(getViewSetting(VIEW_SETTING_IDS.FRONT_GRID).checked, false);

  toggleViewSetting(VIEW_SETTING_IDS.FRONT_GRID);
  assert.equal(getViewSetting(VIEW_SETTING_IDS.FRONT_GRID).checked, true);
});

test('evidence view settings are disabled before evidence analysis', () => {
  const frontCore = getViewSetting(VIEW_SETTING_IDS.FRONT_CORE);
  assert.equal(frontCore.disabled, true);
  assert.equal(frontCore.checked, false);

  const frontSec = getViewSetting(VIEW_SETTING_IDS.FRONT_SECONDARY);
  assert.equal(frontSec.disabled, true);
  assert.equal(frontSec.checked, false);

  const sideCore = getViewSetting(VIEW_SETTING_IDS.SIDE_CORE);
  assert.equal(sideCore.disabled, true);
  assert.equal(sideCore.checked, false);

  const sideSec = getViewSetting(VIEW_SETTING_IDS.SIDE_SECONDARY);
  assert.equal(sideSec.disabled, true);
  assert.equal(sideSec.checked, false);
});

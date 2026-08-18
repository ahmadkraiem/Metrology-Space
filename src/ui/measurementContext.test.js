import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearSideMeasurement,
  getActiveSideMeasurement,
} from '../features/sideMeasurement.js';

test('side measurement state starts clean and clears', () => {
  clearSideMeasurement();
  const state = getActiveSideMeasurement();
  assert.equal(state.pointA, null);
  assert.equal(state.pointB, null);
  assert.equal(state.distanceCm, null);
});

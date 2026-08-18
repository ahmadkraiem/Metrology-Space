import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceSideMeasurement,
  clearSideMeasurement,
  formatSideMeasurementInspectPoint,
  getSideMeasurementState,
} from './sideMeasurement.js';

test('getSideMeasurementState exposes the local Side U/Y measurement only', () => {
  clearSideMeasurement();
  advanceSideMeasurement({ u: 40, y: 80 });
  advanceSideMeasurement({ u: 50, y: 84 });

  const state = getSideMeasurementState();
  assert.deepEqual(state.pointA, { u: 40, y: 80 });
  assert.deepEqual(state.pointB, { u: 50, y: 84 });
  assert.equal(state.distanceCm, Math.hypot(10, 4));
  assert.equal(Object.hasOwn(state.pointA, 'x'), false);
  assert.equal(Object.hasOwn(state.pointA, 'z'), false);

  clearSideMeasurement();
});

test('formatSideMeasurementInspectPoint shows stacked U/Y cm and never X/Z', () => {
  const lines = formatSideMeasurementInspectPoint({ u: 40.4, y: 80.2 });
  assert.deepEqual(lines, ['U: 40 cm', 'Y: 80 cm']);
  assert.equal(lines.some((line) => /[XZ]/.test(line)), false);
  assert.equal(formatSideMeasurementInspectPoint(null), null);
});

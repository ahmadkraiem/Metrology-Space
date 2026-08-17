import { calculateDistance } from '../core/math.js';
import { frontSurfaceTo3d } from '../core/frontSurface.js';
import { isInspectMeasureMode } from './appMode.js';
import { advanceMeasurement } from './measurement.js';

/**
 * Front-surface measurement is the shared 3D measurement, driven from the 2D
 * front face. There is no separate 2D A/B state: the 2D workspace reads and
 * writes the same active measurement object the 3D scene renders.
 *
 * Clearing is owned by the main left Distance Measurement panel
 * (`clearMeasurement*` in measurement.js), not duplicated here.
 */
let sharedMeasurement = null;

export function setupFrontSurfaceMeasurement(measurement) {
  sharedMeasurement = measurement;
}

function clonePoint(point) {
  return point ? { x: point.x, y: point.y, z: point.z } : null;
}

export function getActiveFrontSurfaceMeasurement() {
  const pointA = clonePoint(sharedMeasurement?.pointA);
  const pointB = clonePoint(sharedMeasurement?.pointB);

  return {
    pointA,
    pointB,
    distanceCm: pointA && pointB
      ? Math.round(calculateDistance(pointA, pointB) * 100) / 100
      : null,
  };
}

/**
 * Advances the shared A/B flow from an explicit 3D point (e.g. promoted
 * body_landmark annotation position). Optional session-local `label` is kept
 * for Point A/B display only and is not written into Scene State schema.
 * @param {{ x: number, y: number, z: number, label?: string }} point
 * @returns {boolean} whether the measurement advanced
 */
export function advanceSharedMeasurement(point) {
  if (!sharedMeasurement || !isInspectMeasureMode() || !point) {
    return false;
  }

  advanceMeasurement(point, sharedMeasurement);
  return true;
}

/**
 * Advances the shared A/B flow from a front-surface grid point.
 * Measurement clicks stay gated to Inspect & Measure mode, matching 3D clicks.
 * @param {{ h: number, v: number }} point
 * @returns {boolean} whether the measurement advanced
 */
export function advanceFrontSurfaceMeasurement(point) {
  return advanceSharedMeasurement(frontSurfaceTo3d(point));
}

/**
 * Side Evidence plane local A/B measurement (v0).
 *
 * Session-local only: Euclidean distance in the Side U/Y evidence plane.
 * Does NOT touch canonical shared measurement, history, annotations,
 * Body Graph, Body Measurement Readiness, or Scene State export/import.
 */

/** @type {{ u: number, y: number } | null} */
let pointA = null;
/** @type {{ u: number, y: number } | null} */
let pointB = null;

/** @type {Set<() => void>} */
const changeListeners = new Set();

function notifyChange() {
  for (const listener of changeListeners) {
    listener();
  }
}

function clonePoint(point) {
  if (!point) {
    return null;
  }
  return { u: point.u, y: point.y };
}

function distanceCm(a, b) {
  if (!a || !b) {
    return null;
  }
  return Math.hypot(b.u - a.u, b.y - a.y);
}

export function subscribeSideMeasurementChange(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function getActiveSideMeasurement() {
  return {
    pointA: clonePoint(pointA),
    pointB: clonePoint(pointB),
    distanceCm: distanceCm(pointA, pointB),
  };
}

/**
 * Pick flow matching Front UX locally:
 * empty → set A; A only → set B; A+B → start new with clicked point as A.
 *
 * @param {{ u: number, y: number } | { h: number, v: number }} point
 */
export function advanceSideMeasurement(point) {
  const next = {
    u: Number(point.u ?? point.h),
    y: Number(point.y ?? point.v),
  };

  if (!Number.isFinite(next.u) || !Number.isFinite(next.y)) {
    return false;
  }

  if (!pointA || (pointA && pointB)) {
    pointA = next;
    pointB = null;
  } else {
    pointB = next;
  }

  notifyChange();
  return true;
}

export function clearSideMeasurementPointA() {
  if (!pointA) {
    return false;
  }
  pointA = null;
  notifyChange();
  return true;
}

export function clearSideMeasurementPointB() {
  if (!pointB) {
    return false;
  }
  pointB = null;
  notifyChange();
  return true;
}

export function clearSideMeasurement() {
  if (!pointA && !pointB) {
    return false;
  }
  pointA = null;
  pointB = null;
  notifyChange();
  return true;
}

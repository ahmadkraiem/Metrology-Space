import { ROOM_SIZE } from './constants.js';
import { formatCoordinate } from './formatters.js';

/**
 * The 2D workspace is the cube's front face, not a separate plane.
 *
 * With the default camera at (+X, +Y, +Z) looking at the cube center, the
 * screen-right vector is (+X, 0, -Z): the Z = ROOM_SIZE face is the one turned
 * toward the viewer, with X running left→right and Y running bottom→top. That
 * matches the 2D grid convention (bottom-left origin), so front-face depth is
 * the far Z bound, not Z = 0.
 */
export const FRONT_SURFACE_DEPTH_CM = ROOM_SIZE;

export const FRONT_SURFACE_TYPE_LABEL = 'Front Surface';

/**
 * Maps front-surface 2D coordinates onto the cube's front face.
 * Accepts `{ h, v }` grid coordinates or `{ x, y }` cm coordinates.
 * @param {{ h?: number, v?: number, x?: number, y?: number }} point
 */
export function frontSurfaceTo3d(point) {
  return {
    x: typeof point.x === 'number' ? point.x : point.h,
    y: typeof point.y === 'number' ? point.y : point.v,
    z: FRONT_SURFACE_DEPTH_CM,
  };
}

/** Front-surface 2D coordinates of a 3D point (X/Y kept, depth dropped). */
export function frontSurfaceFrom3d(point) {
  return { h: point.x, v: point.y };
}

export function isOnFrontSurface(point) {
  return Boolean(point) && point.z === FRONT_SURFACE_DEPTH_CM;
}

export function areAllOnFrontSurface(points) {
  const present = points.filter(Boolean);
  return present.length > 0 && present.every((point) => isOnFrontSurface(point));
}

/**
 * Front-surface readout: X/Y only while the point sits on the front face,
 * with depth appended when it does not so the readout never implies otherwise.
 */
export function formatFrontSurfacePointCoords(point) {
  const base = `X ${formatCoordinate(point.x)}, Y ${formatCoordinate(point.y)}`;

  if (isOnFrontSurface(point)) {
    return `${base} cm`;
  }

  return `${base}, Z ${formatCoordinate(point.z)} cm`;
}

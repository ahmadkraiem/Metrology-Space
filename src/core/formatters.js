export function formatCoordinate(value) {
  return String(Math.round(value));
}

export function formatPointCoords(point) {
  return `X ${formatCoordinate(point.x)}, Y ${formatCoordinate(point.y)}, Z ${formatCoordinate(point.z)} cm`;
}

export function formatAnnotationCoords(point) {
  return `X: ${formatCoordinate(point.x)} cm, Y: ${formatCoordinate(point.y)} cm, Z: ${formatCoordinate(point.z)} cm`;
}

export function formatDistance(distance) {
  return distance.toFixed(2);
}

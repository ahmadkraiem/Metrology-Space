import * as THREE from 'three';
import { ROOM_SIZE } from '../core/constants.js';

const HIGHLIGHT_DURATION_MS = 2000;

const COLOR_ORIGIN = 0xb8e8f8;
const COLOR_CENTER = 0xc084fc;
const COLOR_POINT_A = 0xffa45c;
const COLOR_POINT_B = 0xd48cff;
const COLOR_ANNOTATION = 0xa78bfa;
const COLOR_LINE = 0x67e8f9;

let clearTimer = null;

export const graphHighlightGroup = new THREE.Group();
graphHighlightGroup.name = 'sceneGraphHighlight';

function createHighlightMarker(color, size) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
  );
}

function createReferenceHighlightMarker(color) {
  return new THREE.Mesh(
    new THREE.OctahedronGeometry(2, 0),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    }),
  );
}

function createHighlightLine() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));

  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: COLOR_LINE,
      transparent: true,
      opacity: 0.92,
    }),
  );
}

function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      child.material.dispose();
    }
  });
}

export function clearGraphHighlight() {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }

  while (graphHighlightGroup.children.length > 0) {
    const child = graphHighlightGroup.children[0];
    graphHighlightGroup.remove(child);
    disposeObject3D(child);
  }
}

function scheduleAutoClear() {
  if (clearTimer) {
    clearTimeout(clearTimer);
  }

  clearTimer = setTimeout(() => {
    clearGraphHighlight();
    clearTimer = null;
  }, HIGHLIGHT_DURATION_MS);
}

function addMarkerAtPoint(point, color, size) {
  const marker = createHighlightMarker(color, size);
  marker.position.set(point.x, point.y, point.z);
  marker.renderOrder = 4;
  graphHighlightGroup.add(marker);
}

export function highlightPoint(position, options = {}) {
  clearGraphHighlight();

  const color = options.color ?? COLOR_POINT_A;
  const size = options.size ?? 1.8;
  addMarkerAtPoint(position, color, size);
  scheduleAutoClear();
}

export function highlightMeasurement(pointA, pointB) {
  clearGraphHighlight();

  addMarkerAtPoint(pointA, COLOR_POINT_A, 1.8);
  addMarkerAtPoint(pointB, COLOR_POINT_B, 1.8);

  const line = createHighlightLine();
  const positions = line.geometry.attributes.position.array;
  positions[0] = pointA.x;
  positions[1] = pointA.y;
  positions[2] = pointA.z;
  positions[3] = pointB.x;
  positions[4] = pointB.y;
  positions[5] = pointB.z;
  line.geometry.attributes.position.needsUpdate = true;
  line.renderOrder = 3;
  graphHighlightGroup.add(line);

  scheduleAutoClear();
}

export function highlightReferenceMarker(type) {
  if (type === 'origin') {
    clearGraphHighlight();
    const marker = createReferenceHighlightMarker(COLOR_ORIGIN);
    marker.position.set(0, 0, 0);
    marker.renderOrder = 4;
    graphHighlightGroup.add(marker);
    scheduleAutoClear();
    return;
  }

  if (type === 'center') {
    clearGraphHighlight();
    const marker = createReferenceHighlightMarker(COLOR_CENTER);
    const center = ROOM_SIZE / 2;
    marker.position.set(center, center, center);
    marker.renderOrder = 4;
    graphHighlightGroup.add(marker);
    scheduleAutoClear();
  }
}

export function highlightAnnotation(position) {
  highlightPoint(position, { color: COLOR_ANNOTATION, size: 1.4 });
}

export function highlightActivePointA(point) {
  highlightPoint(point, { color: COLOR_POINT_A, size: 1.8 });
}

export function highlightActivePointB(point) {
  highlightPoint(point, { color: COLOR_POINT_B, size: 1.8 });
}

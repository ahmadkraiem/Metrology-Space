import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { calculateDistance } from '../core/math.js';
import { formatDistance } from '../core/formatters.js';
import { getSelectedPoint, clearSelection, isSamePoint } from './selection.js';
import {
  renderMeasurementHistory,
  updateMeasurementPanel,
} from '../ui/measurementPanel.js';
import { updateSceneGraph } from '../ui/sceneGraphPanel.js';
import { clearGraphHighlight } from './sceneGraphHighlight.js';

function clearSelectionIfMatches(point, selectionHighlight) {
  if (selectionHighlight && isSamePoint(getSelectedPoint(), point)) {
    clearSelection(selectionHighlight);
  }
}

let measurementHistory = [];
let measurementCounter = 0;
let onMeasurement3dChanged = null;

export function setMeasurement3dChangeHandler(handler) {
  onMeasurement3dChanged = typeof handler === 'function' ? handler : null;
}

function notifyMeasurement3dChanged() {
  if (onMeasurement3dChanged) {
    onMeasurement3dChanged();
  }
}

export const MEASUREMENT_COLOR_A = 0xffa45c;
export const MEASUREMENT_COLOR_B = 0xd48cff;

export function getNextMeasurementPointType(measurement) {
  const hasA = Boolean(measurement.pointA);
  const hasB = Boolean(measurement.pointB);

  if (!hasA || (hasA && hasB)) {
    return 'A';
  }

  return 'B';
}

export function getMeasurementPointColor(pointType) {
  return pointType === 'B' ? MEASUREMENT_COLOR_B : MEASUREMENT_COLOR_A;
}

function createMeasurementMarker(color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.5, 1.5),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  mesh.renderOrder = 3;
  return mesh;
}

function createMeasurementLine() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xb8dcf0,
      transparent: true,
      opacity: 0.82,
    }),
  );
  line.visible = false;
  line.renderOrder = 2;
  return line;
}

export function createMeasurementState() {
  const labelEl = document.createElement('div');
  labelEl.className = 'measurement-distance-label';
  const distanceLabel = new CSS2DObject(labelEl);
  distanceLabel.visible = false;

  return {
    pointA: null,
    pointB: null,
    markerA: createMeasurementMarker(MEASUREMENT_COLOR_A),
    markerB: createMeasurementMarker(MEASUREMENT_COLOR_B),
    line: createMeasurementLine(),
    distanceLabel,
  };
}

function setMeasurementMarker(marker, point) {
  marker.position.set(point.x, point.y, point.z);
  marker.visible = true;
}

function hideMeasurementMarker(marker) {
  marker.visible = false;
}

function hideMeasurementDistanceLabel(measurement) {
  measurement.distanceLabel.visible = false;
}

let measurementLinesVisible = true;

export function getMeasurement3dLinesVisible() {
  return measurementLinesVisible;
}

export function setMeasurement3dLinesVisible(measurement, visible) {
  measurementLinesVisible = Boolean(visible);
  applyMeasurement3dLineVisibility(measurement);
  notifyMeasurement3dChanged();
}

function applyMeasurement3dLineVisibility(measurement) {
  if (!measurement) {
    return;
  }

  const showLine = Boolean(
    measurementLinesVisible
    && measurement.pointA
    && measurement.pointB,
  );
  measurement.line.visible = showLine;
  measurement.distanceLabel.visible = showLine;
}

function updateMeasurementLine(measurement) {
  if (!measurement.pointA || !measurement.pointB) {
    measurement.line.visible = false;
    hideMeasurementDistanceLabel(measurement);
    return;
  }

  const positions = measurement.line.geometry.attributes.position.array;
  positions[0] = measurement.pointA.x;
  positions[1] = measurement.pointA.y;
  positions[2] = measurement.pointA.z;
  positions[3] = measurement.pointB.x;
  positions[4] = measurement.pointB.y;
  positions[5] = measurement.pointB.z;
  measurement.line.geometry.attributes.position.needsUpdate = true;

  const distance = calculateDistance(measurement.pointA, measurement.pointB);
  measurement.distanceLabel.element.textContent = `${formatDistance(distance)} cm`;
  measurement.distanceLabel.position.set(
    (measurement.pointA.x + measurement.pointB.x) / 2,
    (measurement.pointA.y + measurement.pointB.y) / 2,
    (measurement.pointA.z + measurement.pointB.z) / 2,
  );

  applyMeasurement3dLineVisibility(measurement);
}

function addMeasurementToHistory(pointA, pointB) {
  measurementCounter += 1;
  measurementHistory.unshift({
    number: measurementCounter,
    pointA: { x: pointA.x, y: pointA.y, z: pointA.z },
    pointB: { x: pointB.x, y: pointB.y, z: pointB.z },
    distance: calculateDistance(pointA, pointB),
    completedAt: Date.now(),
  });

  renderMeasurementHistory(measurementHistory);
}

export function clearMeasurementHistory() {
  measurementHistory = [];
  clearGraphHighlight();
  renderMeasurementHistory(measurementHistory);
}

export function getMeasurementHistory() {
  return measurementHistory.map((entry) => ({
    number: entry.number,
    pointA: { x: entry.pointA.x, y: entry.pointA.y, z: entry.pointA.z },
    pointB: { x: entry.pointB.x, y: entry.pointB.y, z: entry.pointB.z },
    distance: entry.distance,
    completedAt: entry.completedAt ?? entry.number,
  }));
}

export function restoreMeasurementHistory(entries) {
  measurementHistory = entries.map((entry, index) => ({
    number: entry.number,
    pointA: { x: entry.pointA.x, y: entry.pointA.y, z: entry.pointA.z },
    pointB: { x: entry.pointB.x, y: entry.pointB.y, z: entry.pointB.z },
    distance: entry.distanceCm,
    // Session-local sort key only — not part of Scene State JSON schema.
    completedAt: Date.now() - (entries.length - index),
  }));

  measurementCounter = measurementHistory.reduce(
    (max, entry) => Math.max(max, entry.number),
    0,
  );

  renderMeasurementHistory(measurementHistory);
}

export function restoreActiveMeasurement(measurement, activeMeasurementData) {
  measurement.pointA = null;
  measurement.pointB = null;
  hideMeasurementMarker(measurement.markerA);
  hideMeasurementMarker(measurement.markerB);
  measurement.line.visible = false;
  hideMeasurementDistanceLabel(measurement);

  if (!activeMeasurementData) {
    updateMeasurementPanel(measurement);
    updateSceneGraph();
    notifyMeasurement3dChanged();
    return;
  }

  const { pointA, pointB } = activeMeasurementData;

  if (pointA) {
    measurement.pointA = { x: pointA.x, y: pointA.y, z: pointA.z };
    setMeasurementMarker(measurement.markerA, measurement.pointA);
  }

  if (pointB) {
    measurement.pointB = { x: pointB.x, y: pointB.y, z: pointB.z };
    setMeasurementMarker(measurement.markerB, measurement.pointB);
  }

  if (measurement.pointA && measurement.pointB) {
    updateMeasurementLine(measurement);
  }

  updateMeasurementPanel(measurement);
  updateSceneGraph();
  notifyMeasurement3dChanged();
}

export function clearMeasurementPointB(measurement, selectionHighlight) {
  if (!measurement.pointB) {
    return;
  }

  const clearedPointB = measurement.pointB;
  measurement.pointB = null;
  hideMeasurementMarker(measurement.markerB);
  measurement.line.visible = false;
  hideMeasurementDistanceLabel(measurement);

  updateMeasurementPanel(measurement);
  clearSelectionIfMatches(clearedPointB, selectionHighlight);
  updateSceneGraph();
  notifyMeasurement3dChanged();
}

export function clearMeasurementPointA(measurement, selectionHighlight) {
  if (!measurement.pointA) {
    return;
  }

  const clearedPointA = measurement.pointA;
  measurement.pointA = null;
  hideMeasurementMarker(measurement.markerA);
  measurement.line.visible = false;
  hideMeasurementDistanceLabel(measurement);

  updateMeasurementPanel(measurement);
  clearSelectionIfMatches(clearedPointA, selectionHighlight);
  updateSceneGraph();
  notifyMeasurement3dChanged();
}

export function clearMeasurement(measurement, selectionHighlight) {
  const clearedPointA = measurement.pointA;
  const clearedPointB = measurement.pointB;
  measurement.pointA = null;
  measurement.pointB = null;
  hideMeasurementMarker(measurement.markerA);
  hideMeasurementMarker(measurement.markerB);
  measurement.line.visible = false;
  hideMeasurementDistanceLabel(measurement);

  updateMeasurementPanel(measurement);

  const selected = getSelectedPoint();
  if (
    selectionHighlight
    && (isSamePoint(selected, clearedPointA) || isSamePoint(selected, clearedPointB))
  ) {
    clearSelection(selectionHighlight);
  }

  updateSceneGraph();
  notifyMeasurement3dChanged();
}

function cloneMeasurementPoint(point) {
  if (!point) {
    return null;
  }

  const cloned = { x: point.x, y: point.y, z: point.z };
  if (typeof point.label === 'string' && point.label) {
    cloned.label = point.label;
  }
  return cloned;
}

function setMeasurementPointA(point, measurement) {
  measurement.pointA = cloneMeasurementPoint(point);
  setMeasurementMarker(measurement.markerA, measurement.pointA);
  updateMeasurementPanel(measurement);
  notifyMeasurement3dChanged();
}

function setMeasurementPointB(point, measurement) {
  measurement.pointB = cloneMeasurementPoint(point);
  setMeasurementMarker(measurement.markerB, measurement.pointB);
  updateMeasurementLine(measurement);
  updateMeasurementPanel(measurement);
  addMeasurementToHistory(measurement.pointA, measurement.pointB);
  notifyMeasurement3dChanged();
}

export function advanceMeasurement(point, measurement) {
  const hasA = Boolean(measurement.pointA);
  const hasB = Boolean(measurement.pointB);

  if (!hasA && !hasB) {
    setMeasurementPointA(point, measurement);
    return;
  }

  if (!hasA && hasB) {
    setMeasurementPointA(point, measurement);
    updateMeasurementLine(measurement);
    addMeasurementToHistory(measurement.pointA, measurement.pointB);
    notifyMeasurement3dChanged();
    return;
  }

  if (hasA && !hasB) {
    setMeasurementPointB(point, measurement);
    return;
  }

  clearMeasurementPointB(measurement);
  setMeasurementPointA(point, measurement);
  notifyMeasurement3dChanged();
}

import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getSelectedPoint } from './selection.js';
import { isAnnotateMode } from './appMode.js';
import { hoverState } from '../interactions/hover.js';
import { normalizeAnnotationType } from '../core/annotationTypes.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import { validateAnnotationInput, findDuplicateAnnotation } from './annotationValidation.js';
import { annotationNameInput, annotationTypeSelect } from '../ui/domRefs.js';
import { resetAnnotationControls } from '../ui/annotationControls.js';
import {
  clearAnnotationValidationMessage,
  showAnnotationValidationMessage,
} from '../ui/annotationValidationMessage.js';
import { renderAnnotationList } from '../ui/annotationPanel.js';
import { clearGraphHighlight } from './sceneGraphHighlight.js';
import { clearActiveLinkedNodeIfMatches } from './linkedSelection.js';

let annotations = [];
let annotationIdCounter = 0;
let onAnnotationsChanged = null;
/** @type {Set<() => void>} */
const annotationsChangeListeners = new Set();

export function setAnnotationsChangeHandler(handler) {
  onAnnotationsChanged = typeof handler === 'function' ? handler : null;
}

/** Additional listeners (e.g. Body Evidence promote badges). Does not replace setAnnotationsChangeHandler. */
export function subscribeAnnotationsChange(listener) {
  annotationsChangeListeners.add(listener);
  return () => annotationsChangeListeners.delete(listener);
}

function notifyAnnotationsChanged() {
  if (onAnnotationsChanged) {
    onAnnotationsChanged();
  }
  for (const listener of annotationsChangeListeners) {
    listener();
  }
}

export const annotationsGroup = new THREE.Group();
annotationsGroup.name = 'annotations';

let annotationsVisible = true;

export function isAnnotationsVisible() {
  return annotationsVisible;
}

export function setAnnotationsVisible(visible) {
  annotationsVisible = visible;
  annotationsGroup.visible = visible;
}

export function isBodyLandmarkAnnotation(annotation) {
  return Boolean(annotation) && annotation.type === 'body_landmark';
}

/**
 * Promoted body_landmark annotations available as measurement pick targets.
 * Hidden annotations (View Controls) are excluded so they are not pickable.
 * @returns {Array<{ id: number, name: string, point: { x: number, y: number, z: number }, group: THREE.Group }>}
 */
export function getBodyLandmarkAnnotationTargets() {
  if (!annotationsVisible) {
    return [];
  }

  return annotations
    .filter(isBodyLandmarkAnnotation)
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      point: { x: entry.point.x, y: entry.point.y, z: entry.point.z },
      group: entry.group,
    }));
}

/**
 * Resolve an annotation from a raycast hit on its marker (or group).
 * @param {THREE.Object3D | null | undefined} object
 * @returns {object | null}
 */
export function findAnnotationByMarkerObject(object) {
  let current = object;
  while (current) {
    const annotationId = current.userData?.annotationId;
    if (annotationId != null) {
      return annotations.find((entry) => entry.id === annotationId) ?? null;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Measurement point from a promoted body landmark (stored annotation cm position).
 * Optional display label is session-local UI metadata only — not part of Scene State schema.
 * @param {{ name: string, point: { x: number, y: number, z: number } }} annotation
 */
export function measurementPointFromBodyLandmark(annotation) {
  const label = formatLandmarkDisplayName(annotation.name) || annotation.name;
  return {
    x: annotation.point.x,
    y: annotation.point.y,
    z: annotation.point.z,
    label,
  };
}

function createAnnotationVisual(name, point) {
  const group = new THREE.Group();
  group.position.set(point.x, point.y, point.z);
  group.userData.annotationPoint = { x: point.x, y: point.y, z: point.z };

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.0, 1.0),
    new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    }),
  );
  marker.renderOrder = 0;
  marker.userData.isAnnotationMarker = true;
  group.add(marker);

  const labelEl = document.createElement('div');
  labelEl.className = 'annotation-marker-label';
  labelEl.textContent = formatLandmarkDisplayName(name) || name;
  labelEl.title = name;
  const label = new CSS2DObject(labelEl);
  label.position.set(0, 6, 0);
  group.add(label);

  return group;
}

function removeAnnotationLabelElements(group) {
  group.traverse((child) => {
    if (child.isCSS2DObject && child.element.parentNode) {
      child.element.parentNode.removeChild(child.element);
    }
  });
}

function disposeAnnotationGroup(group) {
  removeAnnotationLabelElements(group);

  group.traverse((child) => {
    if (child.isCSS2DObject) {
      return;
    }

    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      child.material.dispose();
    }
  });
}

function addAnnotation(name, type, point) {
  annotationIdCounter += 1;
  const group = createAnnotationVisual(name, point);
  group.userData.annotationId = annotationIdCounter;
  annotationsGroup.add(group);

  annotations.push({
    id: annotationIdCounter,
    name,
    type: normalizeAnnotationType(type),
    point: { x: point.x, y: point.y, z: point.z },
    group,
  });

  renderAnnotationList(annotations, deleteAnnotation);
  notifyAnnotationsChanged();
}

export function deleteAnnotation(id) {
  const index = annotations.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return;
  }

  const [removed] = annotations.splice(index, 1);
  annotationsGroup.remove(removed.group);
  disposeAnnotationGroup(removed.group);
  clearGraphHighlight();
  clearActiveLinkedNodeIfMatches(`projection-annotation-${id}`);
  renderAnnotationList(annotations, deleteAnnotation);
  notifyAnnotationsChanged();
}

export function tryAddAnnotationFromSelection() {
  if (!isAnnotateMode() || hoverState.isPointerDragging) {
    return;
  }

  const validation = validateAnnotationInput({
    name: annotationNameInput.value,
    type: annotationTypeSelect.value,
    selectedPoint: getSelectedPoint(),
    annotations,
  });

  if (!validation.valid) {
    showAnnotationValidationMessage(validation.message);
    return;
  }

  addAnnotation(validation.name, validation.type, getSelectedPoint());
  clearAnnotationValidationMessage();
  resetAnnotationControls();
}

/**
 * Programmatic annotation create path (e.g. Body Evidence promote).
 * Reuses the same validation + visual + list/Scene Graph refresh as manual Add Annotation.
 * Does not require Annotate mode or DOM annotation controls.
 *
 * @param {{ name: string, type: string, position: { x: number, y: number, z: number } }} params
 * @returns {{ ok: boolean, duplicate?: boolean, message?: string, annotation?: object }}
 */
export function addAnnotationFromPoint({ name, type, position }) {
  const validation = validateAnnotationInput({
    name,
    type,
    selectedPoint: position,
    annotations,
  });

  if (!validation.valid) {
    return {
      ok: false,
      duplicate: Boolean(findDuplicateAnnotation(annotations, type, name)),
      message: validation.message,
    };
  }

  addAnnotation(validation.name, validation.type, {
    x: position.x,
    y: position.y,
    z: position.z,
  });

  return {
    ok: true,
    annotation: {
      name: validation.name,
      type: validation.type,
      position: { x: position.x, y: position.y, z: position.z },
    },
  };
}

export function clearAnnotationInput() {
  clearAnnotationValidationMessage();
  resetAnnotationControls();
}

export function getAnnotations() {
  return annotations.map((entry) => ({
    id: entry.id,
    name: entry.name,
    type: entry.type,
    point: { x: entry.point.x, y: entry.point.y, z: entry.point.z },
  }));
}

function clearAllAnnotations() {
  while (annotations.length > 0) {
    const removed = annotations.pop();
    annotationsGroup.remove(removed.group);
    disposeAnnotationGroup(removed.group);
  }

  annotationIdCounter = 0;
}

export function restoreAnnotations(entries) {
  clearAllAnnotations();

  entries.forEach((entry) => {
    const point = {
      x: entry.position.x,
      y: entry.position.y,
      z: entry.position.z,
    };
    const group = createAnnotationVisual(entry.name, point);
    group.userData.annotationId = entry.id;
    annotationsGroup.add(group);

    annotations.push({
      id: entry.id,
      name: entry.name,
      type: normalizeAnnotationType(entry.type),
      point,
      group,
    });

    annotationIdCounter = Math.max(annotationIdCounter, entry.id);
  });

  setAnnotationsVisible(annotationsVisible);
  renderAnnotationList(annotations, deleteAnnotation);
  notifyAnnotationsChanged();
}

import * as THREE from 'three';
import {
  selectionPanel,
  selectedXEl,
  selectedYEl,
  selectedZEl,
} from '../ui/domRefs.js';
import { updateSelectionPanel } from '../ui/selectionPanel.js';
import { clearAnnotationValidationMessage } from '../ui/annotationValidationMessage.js';

let selectedPoint = null;

export const ANNOTATE_POINT_COLOR = 0xffa726;

export function createSelectionHighlight() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.6, 1.6),
    new THREE.MeshBasicMaterial({
      color: ANNOTATE_POINT_COLOR,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  mesh.renderOrder = 2;
  return mesh;
}

export function getSelectedPoint() {
  return selectedPoint;
}

export function isSamePoint(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.z === b.z;
}

export function selectPoint(x, y, z, highlight) {
  selectedPoint = { x, y, z };
  highlight.position.set(x, y, z);
  highlight.visible = true;
  clearAnnotationValidationMessage();
  updateSelectionPanel(x, y, z);
}

export function clearSelection(highlight) {
  selectedPoint = null;
  highlight.visible = false;
  clearAnnotationValidationMessage();
  selectedXEl.textContent = '—';
  selectedYEl.textContent = '—';
  selectedZEl.textContent = '—';
  selectionPanel.hidden = true;
}

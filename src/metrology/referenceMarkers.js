import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ROOM_SIZE } from '../core/constants.js';
import { camera } from '../core/scene.js';

let referenceMarkersVisible = true;

function createReferenceMarker(position, color, labelText, labelClass) {
  const group = new THREE.Group();
  group.position.set(position.x, position.y, position.z);

  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.35, 0),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  mesh.renderOrder = 0;
  group.add(mesh);

  const labelEl = document.createElement('div');
  labelEl.className = `ref-marker-label ${labelClass}`;
  labelEl.textContent = labelText;
  const label = new CSS2DObject(labelEl);
  label.position.set(0, 7, 0);
  label.visible = false;
  group.add(label);

  group.userData.pickMesh = mesh;
  group.userData.label = label;

  return group;
}

export function createReferenceMarkers() {
  const group = new THREE.Group();
  const markers = [
    createReferenceMarker(
      { x: 0, y: 0, z: 0 },
      0xb8e8f8,
      'Origin (0, 0, 0)',
      'ref-marker-label--origin',
    ),
    createReferenceMarker(
      { x: ROOM_SIZE / 2, y: ROOM_SIZE / 2, z: ROOM_SIZE / 2 },
      0xc084fc,
      'Center (100, 100, 100)',
      'ref-marker-label--center',
    ),
  ];

  group.add(...markers);
  group.userData.markers = markers;
  group.userData.pickMeshes = markers.map((marker) => marker.userData.pickMesh);
  return group;
}

export function hideReferenceMarkerLabels(referenceMarkers) {
  referenceMarkers.userData.markers.forEach((marker) => {
    marker.userData.label.visible = false;
  });
}

export function setReferenceMarkersVisible(referenceMarkers, visible) {
  referenceMarkersVisible = visible;
  referenceMarkers.visible = visible;
  if (!visible) {
    hideReferenceMarkerLabels(referenceMarkers);
  }
}

export function updateReferenceMarkerHover(referenceMarkers, raycaster, mouse) {
  hideReferenceMarkerLabels(referenceMarkers);

  if (!referenceMarkersVisible) {
    return;
  }

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(referenceMarkers.userData.pickMeshes, false);

  if (hits.length > 0) {
    const marker = referenceMarkers.userData.markers.find(
      (entry) => entry.userData.pickMesh === hits[0].object,
    );
    if (marker) {
      marker.userData.label.visible = true;
    }
  }
}

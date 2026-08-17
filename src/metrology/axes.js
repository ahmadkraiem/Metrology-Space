import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ROOM_SIZE, LABEL_STEP } from '../core/constants.js';

function createAxisLine(start, end, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  return new THREE.Line(geo, mat);
}

function createAxisLabel(text, position, axisClass) {
  const el = document.createElement('div');
  el.className = `axis-label axis-label--${axisClass}`;
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.copy(position);
  return label;
}

export function createAxes() {
  const group = new THREE.Group();
  const axisLength = ROOM_SIZE + 28;
  const origin = new THREE.Vector3(0, 0, 0);

  group.add(
    createAxisLine(origin, new THREE.Vector3(axisLength, 0, 0), 0xff4444),
    createAxisLine(origin, new THREE.Vector3(0, axisLength, 0), 0x44dd66),
    createAxisLine(origin, new THREE.Vector3(0, 0, axisLength), 0x4488ff),
  );

  const arrowGeo = new THREE.ConeGeometry(3, 10, 12);
  const xArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  xArrow.position.set(axisLength, 0, 0);
  xArrow.rotation.z = -Math.PI / 2;
  group.add(xArrow);

  const yArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x44dd66 }));
  yArrow.position.set(0, axisLength, 0);
  group.add(yArrow);

  const zArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0x4488ff }));
  zArrow.position.set(0, 0, axisLength);
  zArrow.rotation.x = Math.PI / 2;
  group.add(zArrow);

  group.add(createAxisLabel('X', new THREE.Vector3(axisLength + 12, 0, 0), 'x'));
  group.add(createAxisLabel('Y', new THREE.Vector3(0, axisLength + 12, 0), 'y'));
  group.add(createAxisLabel('Z', new THREE.Vector3(0, 0, axisLength + 12), 'z'));

  for (let value = 0; value <= ROOM_SIZE; value += LABEL_STEP) {
    group.add(
      createAxisLabel(String(value), new THREE.Vector3(value, -10, -10), 'x'),
      createAxisLabel(String(value), new THREE.Vector3(-10, value, -10), 'y'),
      createAxisLabel(String(value), new THREE.Vector3(-10, -10, value), 'z'),
    );
  }

  return group;
}

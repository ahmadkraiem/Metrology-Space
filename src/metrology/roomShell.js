import * as THREE from 'three';
import { ROOM_SIZE, GRID_UNIT } from '../core/constants.js';

export function createRoomShell() {
  const group = new THREE.Group();

  const boxGeo = new THREE.BoxGeometry(ROOM_SIZE, ROOM_SIZE, ROOM_SIZE);
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0x1a2535,
    transparent: true,
    opacity: 0.04,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const faces = new THREE.Mesh(boxGeo, faceMat);
  faces.position.set(ROOM_SIZE / 2, ROOM_SIZE / 2, ROOM_SIZE / 2);
  group.add(faces);

  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x6a8aaa,
    transparent: true,
    opacity: 0.85,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  edges.position.copy(faces.position);
  group.add(edges);

  return group;
}

export function createGridMarkers() {
  const markerSize = 1.8;
  const geo = new THREE.PlaneGeometry(markerSize, markerSize);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xa8c8e8,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const positions = [];

  for (let v = 0; v <= ROOM_SIZE; v += GRID_UNIT) {
    for (let u = 0; u <= ROOM_SIZE; u += GRID_UNIT) {
      positions.push({ face: 'floor', u, v });
      positions.push({ face: 'ceiling', u, v });
      positions.push({ face: 'front', u, v });
      positions.push({ face: 'back', u, v });
      positions.push({ face: 'left', u, v });
      positions.push({ face: 'right', u, v });
    }
  }

  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const offset = markerSize * 0.51;

  positions.forEach((pos, i) => {
    dummy.position.set(0, 0, 0);
    dummy.rotation.set(0, 0, 0);

    switch (pos.face) {
      case 'floor':
        dummy.position.set(pos.u, offset, pos.v);
        dummy.rotation.x = -Math.PI / 2;
        break;
      case 'ceiling':
        dummy.position.set(pos.u, ROOM_SIZE - offset, pos.v);
        dummy.rotation.x = Math.PI / 2;
        break;
      case 'front':
        dummy.position.set(pos.u, pos.v, offset);
        break;
      case 'back':
        dummy.position.set(pos.u, pos.v, ROOM_SIZE - offset);
        dummy.rotation.y = Math.PI;
        break;
      case 'left':
        dummy.position.set(offset, pos.v, pos.u);
        dummy.rotation.y = -Math.PI / 2;
        break;
      case 'right':
        dummy.position.set(ROOM_SIZE - offset, pos.v, pos.u);
        dummy.rotation.y = Math.PI / 2;
        break;
    }

    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

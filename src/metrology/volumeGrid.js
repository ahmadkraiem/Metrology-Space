import * as THREE from 'three';
import {
  ROOM_SIZE,
  INTERNAL_SAMPLE_UNIT,
  INTERNAL_POINT_COUNT,
  INTERNAL_LOD_COARSE,
  INTERNAL_LOD_MEDIUM,
  LOD_FAR,
  LOD_MID,
  LOD_NEAR,
} from '../core/constants.js';
import { smoothstep } from '../core/math.js';

export function collectLodPoints(step, excludeMultiple) {
  const positions = [];

  for (let x = 0; x <= ROOM_SIZE; x += step) {
    for (let y = 0; y <= ROOM_SIZE; y += step) {
      for (let z = 0; z <= ROOM_SIZE; z += step) {
        if (
          excludeMultiple
          && x % excludeMultiple === 0
          && y % excludeMultiple === 0
          && z % excludeMultiple === 0
        ) {
          continue;
        }

        positions.push(x, y, z);
      }
    }
  }

  return positions;
}

export function buildAllSamplePositions() {
  const positions = new Float32Array(INTERNAL_POINT_COUNT * 3);
  let index = 0;

  for (let x = 0; x <= ROOM_SIZE; x += INTERNAL_SAMPLE_UNIT) {
    for (let y = 0; y <= ROOM_SIZE; y += INTERNAL_SAMPLE_UNIT) {
      for (let z = 0; z <= ROOM_SIZE; z += INTERNAL_SAMPLE_UNIT) {
        positions[index++] = x;
        positions[index++] = y;
        positions[index++] = z;
      }
    }
  }

  return positions;
}

function createLodLayer(positions, geo) {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x4a6480,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length / 3);
  mesh.frustumCulled = false;

  const dummy = new THREE.Object3D();

  for (let i = 0; i < positions.length; i += 3) {
    dummy.position.set(positions[i], positions[i + 1], positions[i + 2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i / 3, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function createInternalVolumeGrid() {
  const pointSize = 0.9;
  const geo = new THREE.BoxGeometry(pointSize, pointSize, pointSize);
  const coarsePositions = collectLodPoints(INTERNAL_LOD_COARSE, null);
  const mediumPositions = collectLodPoints(INTERNAL_LOD_MEDIUM, INTERNAL_LOD_COARSE);
  const finePositions = collectLodPoints(INTERNAL_SAMPLE_UNIT, INTERNAL_LOD_MEDIUM);

  const group = new THREE.Group();
  const layers = {
    coarse: createLodLayer(coarsePositions, geo),
    medium: createLodLayer(mediumPositions, geo),
    fine: createLodLayer(finePositions, geo),
  };

  group.add(layers.coarse, layers.medium, layers.fine);
  group.userData.layers = layers;
  group.userData.pickMeshes = [layers.coarse, layers.medium, layers.fine];
  return group;
}

/** Visual-only toggle for internal 3D lattice layers (does not affect picking/data). */
export function setInternalVolumeGridVisible(volumeGrid, visible) {
  if (!volumeGrid) {
    return;
  }

  volumeGrid.visible = Boolean(visible);
}

export function updateInternalVolumeLod(volumeGrid, cameraDistance) {
  const { coarse, medium, fine } = volumeGrid.userData.layers;
  const coarseBlend = smoothstep(LOD_MID, LOD_FAR, cameraDistance);
  const fineBlend = 1 - smoothstep(LOD_NEAR, LOD_MID, cameraDistance);
  const mediumBlend = Math.max(0, 1 - coarseBlend - fineBlend);

  coarse.material.opacity = coarseBlend * 0.24 + mediumBlend * 0.1 + fineBlend * 0.05;
  medium.material.opacity = coarseBlend * 0.04 + mediumBlend * 0.18 + fineBlend * 0.12;
  fine.material.opacity = coarseBlend * 0.02 + mediumBlend * 0.08 + fineBlend * 0.28;
}

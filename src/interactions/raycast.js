import * as THREE from 'three';
import { camera, controls } from '../core/scene.js';
import {
  findAnnotationByMarkerObject,
  getBodyLandmarkAnnotationTargets,
  isBodyLandmarkAnnotation,
  measurementPointFromBodyLandmark,
} from '../features/annotations.js';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const instanceMatrix = new THREE.Matrix4();
const pickPoint = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const toPoint = new THREE.Vector3();
const closestOnRay = new THREE.Vector3();

let allSamplePositions = null;

export { raycaster, mouse };

export function setAllSamplePositions(positions) {
  allSamplePositions = positions;
}

/**
 * Prefer promoted body_landmark annotation markers over lattice/volume picks.
 * Hidden annotations / non-body_landmark annotations are not targets.
 * @returns {{ x: number, y: number, z: number, label?: string } | null}
 */
export function resolveBodyLandmarkMeasurementPoint() {
  const targets = getBodyLandmarkAnnotationTargets();
  if (targets.length === 0) {
    return null;
  }

  raycaster.setFromCamera(mouse, camera);
  const groups = targets.map((entry) => entry.group);
  const hits = raycaster.intersectObjects(groups, true);
  if (hits.length === 0) {
    return null;
  }

  const annotation = findAnnotationByMarkerObject(hits[0].object);
  if (!isBodyLandmarkAnnotation(annotation)) {
    return null;
  }

  return measurementPointFromBodyLandmark(annotation);
}

export function resolveVolumePoint(volumeGrid) {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(volumeGrid.userData.pickMeshes, false);

  if (hits.length > 0) {
    const position = getPositionFromInstanceHit(hits[0]);
    return { x: position.x, y: position.y, z: position.z };
  }

  const cameraDistance = camera.position.distanceTo(controls.target);
  const maxPickDistance = Math.max(8, cameraDistance * 0.03);
  return findNearestSamplePoint(raycaster.ray, maxPickDistance);
}

function getPositionFromInstanceHit(hit) {
  hit.object.getMatrixAt(hit.instanceId, instanceMatrix);
  pickPoint.setFromMatrixPosition(instanceMatrix);
  return pickPoint;
}

function findNearestSamplePoint(ray, maxDistance) {
  rayOrigin.copy(ray.origin);
  rayDirection.copy(ray.direction);

  let bestDistSq = maxDistance * maxDistance;
  let bestPoint = null;

  for (let i = 0; i < allSamplePositions.length; i += 3) {
    pickPoint.set(
      allSamplePositions[i],
      allSamplePositions[i + 1],
      allSamplePositions[i + 2],
    );
    toPoint.subVectors(pickPoint, rayOrigin);
    const t = toPoint.dot(rayDirection);
    if (t < 0) {
      continue;
    }

    closestOnRay.copy(rayDirection).multiplyScalar(t).add(rayOrigin);
    const distSq = closestOnRay.distanceToSquared(pickPoint);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestPoint = {
        x: allSamplePositions[i],
        y: allSamplePositions[i + 1],
        z: allSamplePositions[i + 2],
      };
    }
  }

  return bestPoint;
}

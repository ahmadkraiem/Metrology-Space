import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ROOM_SIZE } from './constants.js';
import { container } from '../ui/domRefs.js';

const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b10);
scene.fog = new THREE.FogExp2(0x080b10, 0.0018);

export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(320, 260, 320);

export const renderer = hasDom
  ? new THREE.WebGLRenderer({ antialias: true, alpha: false })
  : null;

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (container) {
    container.appendChild(renderer.domElement);
  }
}

export const labelRenderer = hasDom ? new CSS2DRenderer() : null;
if (labelRenderer) {
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  if (container) {
    container.appendChild(labelRenderer.domElement);
  }
}

export function syncRendererSize() {
  if (!container || !renderer || !labelRenderer) {
    return;
  }
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width <= 0 || height <= 0) {
    return;
  }

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
}

if (hasDom) {
  syncRendererSize();
}

export const controls = hasDom && renderer
  ? new OrbitControls(camera, renderer.domElement)
  : null;

if (controls) {
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(ROOM_SIZE / 2, ROOM_SIZE / 2, ROOM_SIZE / 2);
  controls.minDistance = 120;
  controls.maxDistance = 800;
  controls.update();
}

scene.add(new THREE.AmbientLight(0x8899aa, 0.35));
const keyLight = new THREE.DirectionalLight(0xddeeff, 0.45);
keyLight.position.set(300, 400, 200);
scene.add(keyLight);

export function onResize() {
  syncRendererSize();
}

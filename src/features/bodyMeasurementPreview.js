/**
 * Measurement Line Preview Overlay v0
 *
 * Visual-only Ready anatomical measurement candidate lines from promoted
 * `body_landmark` annotations. Not A/B measurement, not history, not Body Graph,
 * not latent space. Does not mutate annotations or Scene State schema.
 */

import * as THREE from 'three';
import { subscribeAnnotationsChange } from './annotations.js';
import { buildAnatomicalMeasurementLines } from './bodyMeasurementLines.js';
import { bodyMeasurementPreviewLayerEl } from '../ui/domRefs.js';

/** Distinct from normal A/B measurement line color (0xb8dcf0). */
const PREVIEW_LINE_COLOR = 0x67e8f9;
const PREVIEW_LINE_OPACITY = 0.55;

/** @type {THREE.Group|null} */
let previewGroup = null;

let previewVisible = true;

/** @type {(() => void)|null} */
let requestGrid2dRefreshFn = null;

/**
 * Geometry only — distances stay in Body Measurement Readiness and are
 * deliberately not exposed here, so preview overlays cannot render labels.
 *
 * @returns {Array<{
 *   id: string,
 *   fromPoint: { x: number, y: number, z: number },
 *   toPoint: { x: number, y: number, z: number },
 * }>}
 */
function getReadyBodyMeasurementPreviewLines() {
  const { lines } = buildAnatomicalMeasurementLines();
  return lines.filter((line) => (
    line.status === 'Ready'
    && line.fromPoint
    && line.toPoint
  )).map((line) => ({
    id: line.id,
    fromPoint: line.fromPoint,
    toPoint: line.toPoint,
  }));
}

function disposePreviewChildren(group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.geometry?.dispose();
    child.material?.dispose();
  }
}

function createPreviewLine(fromPoint, toPoint) {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(fromPoint.x, fromPoint.y, fromPoint.z),
    new THREE.Vector3(toPoint.x, toPoint.y, toPoint.z),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: PREVIEW_LINE_COLOR,
    transparent: true,
    opacity: PREVIEW_LINE_OPACITY,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.renderOrder = 1;
  // Not part of volume pick meshes; disable raycast defensively.
  line.raycast = () => {};
  return line;
}

export function refreshBodyMeasurementPreview() {
  if (!previewGroup) {
    return;
  }

  disposePreviewChildren(previewGroup);
  previewGroup.visible = previewVisible;

  if (!previewVisible) {
    return;
  }

  for (const entry of getReadyBodyMeasurementPreviewLines()) {
    previewGroup.add(createPreviewLine(entry.fromPoint, entry.toPoint));
  }
}

function requestGrid2dRefresh() {
  if (typeof requestGrid2dRefreshFn === 'function') {
    requestGrid2dRefreshFn();
  }
}

export function isBodyMeasurementPreviewVisible() {
  return previewVisible;
}

export function setBodyMeasurementPreviewVisible(visible) {
  previewVisible = Boolean(visible);
  refreshBodyMeasurementPreview();
  requestGrid2dRefresh();
}

/**
 * Renders Ready preview segments on the Front Surface 2D field.
 * Visual-only (`pointer-events: none`); does not affect 2D measurement clicks.
 *
 * @param {{ worldToPlotPx: (h: number, v: number) => { px: number, py: number } }} params
 */
export function renderBodyMeasurementPreview2d({ worldToPlotPx }) {
  if (!bodyMeasurementPreviewLayerEl || typeof worldToPlotPx !== 'function') {
    return;
  }

  bodyMeasurementPreviewLayerEl.hidden = !previewVisible;
  bodyMeasurementPreviewLayerEl.replaceChildren();

  if (!previewVisible) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of getReadyBodyMeasurementPreviewLines()) {
    const a = worldToPlotPx(entry.fromPoint.x, entry.fromPoint.y);
    const b = worldToPlotPx(entry.toPoint.x, entry.toPoint.y);
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) {
      continue;
    }

    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const line = document.createElement('div');
    line.className = 'grid2d-body-measurement-preview-line';
    line.dataset.lineId = entry.id;
    line.style.left = `${a.px}px`;
    line.style.top = `${a.py}px`;
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angleDeg}deg)`;
    line.setAttribute('aria-hidden', 'true');
    fragment.appendChild(line);
  }

  bodyMeasurementPreviewLayerEl.appendChild(fragment);
}

/**
 * @returns {THREE.Group}
 */
export function createBodyMeasurementPreviewGroup() {
  const group = new THREE.Group();
  group.name = 'bodyMeasurementPreview';
  group.visible = previewVisible;
  previewGroup = group;
  return group;
}

/**
 * @param {() => void} [refreshGrid2dNavigator]
 */
export function setupBodyMeasurementPreview(refreshGrid2dNavigator) {
  requestGrid2dRefreshFn = typeof refreshGrid2dNavigator === 'function'
    ? refreshGrid2dNavigator
    : null;

  subscribeAnnotationsChange(() => {
    refreshBodyMeasurementPreview();
    requestGrid2dRefresh();
  });

  refreshBodyMeasurementPreview();
}

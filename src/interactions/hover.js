import * as THREE from 'three';
import { updateReferenceMarkerHover } from '../metrology/referenceMarkers.js';
import { getSelectedPoint, ANNOTATE_POINT_COLOR } from '../features/selection.js';
import { isInspectMeasureMode } from '../features/appMode.js';
import {
  getMeasurementPointColor,
  getNextMeasurementPointType,
  MEASUREMENT_COLOR_A,
} from '../features/measurement.js';
import { updateHoverCoordinateTooltip } from '../ui/hoverTooltip.js';
import { isSamePoint, isMeasurementPoint } from './picking.js';

export const hoverState = {
  isPointerDragging: false,
  hoverFramePending: false,
  pendingHoverEvent: null,
};

const ANNOTATE_HOVER_OPACITY = 0.55;

export function createHoverHighlight() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 1.25, 1.25),
    new THREE.MeshBasicMaterial({
      color: MEASUREMENT_COLOR_A,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  mesh.renderOrder = 1;
  return mesh;
}

export function updateHoverPoint(point, hoverHighlight, measurement) {
  if (!point || isMeasurementPoint(point, measurement)) {
    hoverHighlight.visible = false;
    return;
  }

  if (!isInspectMeasureMode() && isSamePoint(point, getSelectedPoint())) {
    hoverHighlight.visible = false;
    return;
  }

  const hoverColor = isInspectMeasureMode()
    ? getMeasurementPointColor(getNextMeasurementPointType(measurement))
    : ANNOTATE_POINT_COLOR;

  hoverHighlight.material.color.setHex(hoverColor);
  hoverHighlight.material.opacity = isInspectMeasureMode()
    ? 0.55
    : ANNOTATE_HOVER_OPACITY;
  hoverHighlight.position.set(point.x, point.y, point.z);
  hoverHighlight.visible = true;
}

export function processHoverUpdate(
  volumeGrid,
  hoverHighlight,
  measurement,
  referenceMarkers,
  { raycaster, mouse, updateMouseFromEvent, resolveVolumePoint },
) {
  hoverState.hoverFramePending = false;
  if (!hoverState.pendingHoverEvent || hoverState.isPointerDragging) {
    return;
  }

  updateMouseFromEvent(hoverState.pendingHoverEvent);
  const point = resolveVolumePoint(volumeGrid);
  updateHoverPoint(point, hoverHighlight, measurement);
  updateHoverCoordinateTooltip(point, hoverState.pendingHoverEvent);
  updateReferenceMarkerHover(referenceMarkers, raycaster, mouse);
  hoverState.pendingHoverEvent = null;
}

export function scheduleHoverUpdate(
  event,
  volumeGrid,
  hoverHighlight,
  measurement,
  referenceMarkers,
  hoverDeps,
) {
  hoverState.pendingHoverEvent = event;
  if (hoverState.hoverFramePending) {
    return;
  }

  hoverState.hoverFramePending = true;
  requestAnimationFrame(() => {
    processHoverUpdate(
      volumeGrid,
      hoverHighlight,
      measurement,
      referenceMarkers,
      hoverDeps,
    );
  });
}

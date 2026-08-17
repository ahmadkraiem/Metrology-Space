import { renderer } from '../core/scene.js';
import { buildAllSamplePositions } from '../metrology/volumeGrid.js';
import {
  clearMeasurementBtn,
  clearPointABtn,
  clearPointBBtn,
  clearSelectionBtn,
  annotationNameInput,
  addAnnotationBtn,
  clearHistoryBtn,
} from '../ui/domRefs.js';
import { hideHoverCoordinateTooltip } from '../ui/hoverTooltip.js';
import { clearSelection } from '../features/selection.js';
import {
  clearMeasurement,
  clearMeasurementPointA,
  clearMeasurementPointB,
  clearMeasurementHistory,
} from '../features/measurement.js';
import { tryAddAnnotationFromSelection } from '../features/annotations.js';
import { hideReferenceMarkerLabels } from '../metrology/referenceMarkers.js';
import {
  raycaster,
  mouse,
  resolveVolumePoint,
  setAllSamplePositions,
} from './raycast.js';
import { pickVolumePoint } from './picking.js';
import {
  hoverState,
  scheduleHoverUpdate,
} from './hover.js';

let pointerDownX = 0;
let pointerDownY = 0;

export function updateMouseFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

export function setupPointInteraction(volumeGrid, selectionHighlight, hoverHighlight, measurement, referenceMarkers) {
  setAllSamplePositions(buildAllSamplePositions());

  const hoverDeps = {
    raycaster,
    mouse,
    updateMouseFromEvent,
    resolveVolumePoint,
  };

  clearMeasurementBtn.addEventListener('click', () => {
    clearMeasurement(measurement, selectionHighlight);
  });

  clearPointABtn.addEventListener('click', () => {
    clearMeasurementPointA(measurement, selectionHighlight);
  });

  clearPointBBtn.addEventListener('click', () => {
    clearMeasurementPointB(measurement, selectionHighlight);
  });

  clearSelectionBtn.addEventListener('click', () => {
    clearSelection(selectionHighlight);
  });

  clearHistoryBtn.addEventListener('click', () => {
    clearMeasurementHistory();
  });

  addAnnotationBtn.addEventListener('click', () => {
    tryAddAnnotationFromSelection();
  });

  annotationNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      tryAddAnnotationFromSelection();
    }
  });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointerDownX = event.clientX;
    pointerDownY = event.clientY;
    hoverState.isPointerDragging = false;
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    const dx = event.clientX - pointerDownX;
    const dy = event.clientY - pointerDownY;
    if (event.buttons > 0 && dx * dx + dy * dy > 1) {
      hoverState.isPointerDragging = true;
      hoverHighlight.visible = false;
      hideHoverCoordinateTooltip();
      hideReferenceMarkerLabels(referenceMarkers);
      return;
    }

    scheduleHoverUpdate(
      event,
      volumeGrid,
      hoverHighlight,
      measurement,
      referenceMarkers,
      hoverDeps,
    );
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    const dx = event.clientX - pointerDownX;
    const dy = event.clientY - pointerDownY;
    hoverState.isPointerDragging = false;

    if (dx * dx + dy * dy > 9) {
      return;
    }

    pickVolumePoint(event, volumeGrid, selectionHighlight, measurement);
    scheduleHoverUpdate(
      event,
      volumeGrid,
      hoverHighlight,
      measurement,
      referenceMarkers,
      hoverDeps,
    );
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    hoverState.isPointerDragging = false;
    hoverState.pendingHoverEvent = null;
    hoverHighlight.visible = false;
    hideHoverCoordinateTooltip();
    hideReferenceMarkerLabels(referenceMarkers);
  });
}

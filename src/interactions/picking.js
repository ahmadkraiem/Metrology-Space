import { selectPoint, isSamePoint } from '../features/selection.js';
import { advanceMeasurement } from '../features/measurement.js';
import { isInspectMeasureMode, isAnnotateMode } from '../features/appMode.js';
import { resolveBodyLandmarkMeasurementPoint, resolveVolumePoint } from './raycast.js';
import { updateMouseFromEvent } from './pointerEvents.js';

export { isSamePoint };

export function isMeasurementPoint(point, measurement) {
  return isSamePoint(point, measurement.pointA) || isSamePoint(point, measurement.pointB);
}

export function pickVolumePoint(event, volumeGrid, selectionHighlight, measurement) {
  updateMouseFromEvent(event);

  // Inspect & Measure: promoted body_landmark markers win over lattice picks.
  // Annotate mode never advances A/B — including when clicking body landmarks.
  if (isInspectMeasureMode()) {
    const bodyLandmarkPoint = resolveBodyLandmarkMeasurementPoint();
    if (bodyLandmarkPoint) {
      advanceMeasurement(bodyLandmarkPoint, measurement);
      return;
    }

    const point = resolveVolumePoint(volumeGrid);
    if (!point) {
      return;
    }

    advanceMeasurement(point, measurement);
    return;
  }

  if (isAnnotateMode()) {
    const point = resolveVolumePoint(volumeGrid);
    if (!point) {
      return;
    }

    selectPoint(point.x, point.y, point.z, selectionHighlight);
  }
}

import {
  showOriginCenterCheckbox,
  showAnnotationsCheckbox,
  show3dLatticePointsCheckbox,
  show2dGridPointsCheckbox,
  showMeasurementLinesCheckbox,
  showBodyMeasurementPreviewsCheckbox,
} from './domRefs.js';
import { setReferenceMarkersVisible } from '../metrology/referenceMarkers.js';
import { setInternalVolumeGridVisible } from '../metrology/volumeGrid.js';
import { setAnnotationsVisible } from '../features/annotations.js';
import { setMeasurement3dLinesVisible } from '../features/measurement.js';
import { setBodyMeasurementPreviewVisible } from '../features/bodyMeasurementPreview.js';
import { setGrid2dPointsVisible } from './grid2dNavigator.js';
import {
  setProjectedAnnotationsVisible,
  setProjectedReferenceMarkersVisible,
} from '../features/projectionLinking.js';

export function setupViewControls(referenceMarkers, volumeGrid, measurement) {
  showOriginCenterCheckbox.addEventListener('change', () => {
    const visible = showOriginCenterCheckbox.checked;
    setReferenceMarkersVisible(referenceMarkers, visible);
    setProjectedReferenceMarkersVisible(visible);
  });

  showAnnotationsCheckbox.addEventListener('change', () => {
    const visible = showAnnotationsCheckbox.checked;
    setAnnotationsVisible(visible);
    setProjectedAnnotationsVisible(visible);
  });

  show3dLatticePointsCheckbox.addEventListener('change', () => {
    setInternalVolumeGridVisible(volumeGrid, show3dLatticePointsCheckbox.checked);
  });

  show2dGridPointsCheckbox.addEventListener('change', () => {
    setGrid2dPointsVisible(show2dGridPointsCheckbox.checked);
  });

  // One flag drives the 3D line/label and the front-surface 2D line/label.
  showMeasurementLinesCheckbox.addEventListener('change', () => {
    setMeasurement3dLinesVisible(measurement, showMeasurementLinesCheckbox.checked);
  });

  // Independent from A/B Measurement Lines — body preview overlay only.
  showBodyMeasurementPreviewsCheckbox?.addEventListener('change', () => {
    setBodyMeasurementPreviewVisible(showBodyMeasurementPreviewsCheckbox.checked);
  });

  setReferenceMarkersVisible(referenceMarkers, showOriginCenterCheckbox.checked);
  setProjectedReferenceMarkersVisible(showOriginCenterCheckbox.checked);
  setAnnotationsVisible(showAnnotationsCheckbox.checked);
  setProjectedAnnotationsVisible(showAnnotationsCheckbox.checked);
  setInternalVolumeGridVisible(volumeGrid, show3dLatticePointsCheckbox.checked);
  setGrid2dPointsVisible(show2dGridPointsCheckbox.checked);
  setMeasurement3dLinesVisible(measurement, showMeasurementLinesCheckbox.checked);
  setBodyMeasurementPreviewVisible(showBodyMeasurementPreviewsCheckbox?.checked ?? true);
}

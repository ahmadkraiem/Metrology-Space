import { setReferenceMarkersVisible, isReferenceMarkersVisible } from '../metrology/referenceMarkers.js';
import { isInternalVolumeGridVisible, setInternalVolumeGridVisible } from '../metrology/volumeGrid.js';
import { isAnnotationsVisible, setAnnotationsVisible } from '../features/annotations.js';
import {
  getMeasurement3dLinesVisible,
  setMeasurement3dLinesVisible,
} from '../features/measurement.js';
import {
  isBodyMeasurementPreviewVisible,
  setBodyMeasurementPreviewVisible,
} from '../features/bodyMeasurementPreview.js';
import { isGrid2dPointsVisible, setGrid2dPointsVisible } from './grid2dNavigator.js';
import { isSideGrid2dPointsVisible, setSideGrid2dPointsVisible } from './sideGrid2dNavigator.js';
import {
  setProjectedAnnotationsVisible,
  setProjectedReferenceMarkersVisible,
} from '../features/projectionLinking.js';
import {
  getFrontSegmentationRaster,
  getRenderableFrontBodyLandmarks,
  getRenderableSideBodyLandmarks,
  getSecondaryFrontBodyLandmarks,
  getSecondarySideBodyLandmarks,
  getSideSegmentationRaster,
  hasAnalyzedBodyEvidence,
  isBodyEvidenceOverlayVisible,
  isSecondaryBodyEvidenceVisible,
  isSideCoreBodyEvidenceVisible,
  isSideSecondaryBodyEvidenceVisible,
  setBodyEvidenceOverlayVisible,
  setSecondaryBodyEvidenceVisible,
  setSideCoreBodyEvidenceVisible,
  setSideSecondaryBodyEvidenceVisible,
} from '../features/bodyEvidence.js';

export const VIEW_SETTING_IDS = Object.freeze({
  ORIGIN_CENTER: 'origin-center',
  ANNOTATIONS: 'annotations',
  MEASUREMENT_LINES: 'measurement-lines',
  LATTICE_3D: 'lattice-3d',
  FRONT_GRID: 'front-grid',
  SIDE_GRID: 'side-grid',
  FRONT_CORE: 'front-core',
  FRONT_SECONDARY: 'front-secondary',
  SIDE_CORE: 'side-core',
  SIDE_SECONDARY: 'side-secondary',
  FRONT_SEGMENTATION: 'front-seg',
  SIDE_SEGMENTATION: 'side-seg',
  BODY_PREVIEWS: 'body-previews',
});

/** @type {{ measurement: object, selectionHighlight: object, referenceMarkers: object, volumeGrid: object } | null} */
let viewControlDeps = null;

let frontSegSettingEnabled = true;
let sideSegSettingEnabled = true;

export function isFrontSegmentationSettingEnabled() {
  return frontSegSettingEnabled;
}

export function isSideSegmentationSettingEnabled() {
  return sideSegSettingEnabled;
}

export function setFrontSegmentationSettingEnabled(visible) {
  frontSegSettingEnabled = Boolean(visible);
  notifyViewSettingChange();
}

export function setSideSegmentationSettingEnabled(visible) {
  sideSegSettingEnabled = Boolean(visible);
  notifyViewSettingChange();
}

/** @type {Set<() => void>} */
const viewSettingListeners = new Set();

export function subscribeViewSettingChange(listener) {
  viewSettingListeners.add(listener);
  return () => viewSettingListeners.delete(listener);
}

function notifyViewSettingChange() {
  for (const listener of viewSettingListeners) {
    listener();
  }
}

function evidenceAvailability() {
  const analyzed = hasAnalyzedBodyEvidence();
  const frontRaster = analyzed ? getFrontSegmentationRaster() : null;
  const sideRaster = analyzed ? getSideSegmentationRaster() : null;

  return {
    analyzed,
    frontCoreCount: analyzed ? getRenderableFrontBodyLandmarks().length : 0,
    frontSecondaryCount: analyzed ? getSecondaryFrontBodyLandmarks().length : 0,
    sideCoreCount: analyzed ? getRenderableSideBodyLandmarks().length : 0,
    sideSecondaryCount: analyzed ? getSecondarySideBodyLandmarks().length : 0,
    hasFrontRaster: Boolean(frontRaster && frontRaster.length > 0),
    hasSideRaster: Boolean(sideRaster && sideRaster.length > 0),
  };
}

/**
 * Apply a View setting. The View menu is the primary control surface.
 * @param {string} id
 * @param {boolean} visible
 * @param {{ measurement?: object, referenceMarkers?: object, volumeGrid?: object } | null} [deps]
 */
export function applyViewSetting(id, visible, deps = viewControlDeps) {
  const next = Boolean(visible);
  const measurement = deps?.measurement;
  const referenceMarkers = deps?.referenceMarkers;
  const volumeGrid = deps?.volumeGrid;

  switch (id) {
    case VIEW_SETTING_IDS.ORIGIN_CENTER:
      if (referenceMarkers) {
        setReferenceMarkersVisible(referenceMarkers, next);
        setProjectedReferenceMarkersVisible(next);
      }
      break;
    case VIEW_SETTING_IDS.ANNOTATIONS:
      setAnnotationsVisible(next);
      setProjectedAnnotationsVisible(next);
      break;
    case VIEW_SETTING_IDS.MEASUREMENT_LINES:
      if (measurement) {
        setMeasurement3dLinesVisible(measurement, next);
      }
      break;
    case VIEW_SETTING_IDS.LATTICE_3D:
      if (volumeGrid) {
        setInternalVolumeGridVisible(volumeGrid, next);
      }
      break;
    case VIEW_SETTING_IDS.FRONT_GRID:
      setGrid2dPointsVisible(next);
      break;
    case VIEW_SETTING_IDS.SIDE_GRID:
      setSideGrid2dPointsVisible(next);
      break;
    case VIEW_SETTING_IDS.FRONT_CORE:
      setBodyEvidenceOverlayVisible(next);
      break;
    case VIEW_SETTING_IDS.FRONT_SECONDARY:
      setSecondaryBodyEvidenceVisible(next);
      break;
    case VIEW_SETTING_IDS.SIDE_CORE:
      setSideCoreBodyEvidenceVisible(next);
      break;
    case VIEW_SETTING_IDS.SIDE_SECONDARY:
      setSideSecondaryBodyEvidenceVisible(next);
      break;
    case VIEW_SETTING_IDS.FRONT_SEGMENTATION:
      frontSegSettingEnabled = next;
      break;
    case VIEW_SETTING_IDS.SIDE_SEGMENTATION:
      sideSegSettingEnabled = next;
      break;
    case VIEW_SETTING_IDS.BODY_PREVIEWS:
      setBodyMeasurementPreviewVisible(next);
      break;
    default:
      return;
  }

  notifyViewSettingChange();
}

/**
 * @param {string} id
 * @returns {{ checked: boolean, disabled: boolean }}
 */
export function getViewSetting(id) {
  const evidence = evidenceAvailability();
  const volumeGrid = viewControlDeps?.volumeGrid;

  switch (id) {
    case VIEW_SETTING_IDS.ORIGIN_CENTER:
      return { checked: isReferenceMarkersVisible(), disabled: false };
    case VIEW_SETTING_IDS.ANNOTATIONS:
      return { checked: isAnnotationsVisible(), disabled: false };
    case VIEW_SETTING_IDS.MEASUREMENT_LINES:
      return { checked: getMeasurement3dLinesVisible(), disabled: false };
    case VIEW_SETTING_IDS.LATTICE_3D:
      return {
        checked: volumeGrid ? isInternalVolumeGridVisible(volumeGrid) : true,
        disabled: false,
      };
    case VIEW_SETTING_IDS.FRONT_GRID:
      return { checked: isGrid2dPointsVisible(), disabled: false };
    case VIEW_SETTING_IDS.SIDE_GRID:
      return { checked: isSideGrid2dPointsVisible(), disabled: false };
    case VIEW_SETTING_IDS.FRONT_CORE:
      return {
        checked: isBodyEvidenceOverlayVisible(),
        disabled: !evidence.analyzed || evidence.frontCoreCount === 0,
      };
    case VIEW_SETTING_IDS.FRONT_SECONDARY:
      return {
        checked: isSecondaryBodyEvidenceVisible(),
        disabled: !evidence.analyzed || evidence.frontSecondaryCount === 0,
      };
    case VIEW_SETTING_IDS.SIDE_CORE:
      return {
        checked: isSideCoreBodyEvidenceVisible(),
        disabled: !evidence.analyzed || evidence.sideCoreCount === 0,
      };
    case VIEW_SETTING_IDS.SIDE_SECONDARY:
      return {
        checked: isSideSecondaryBodyEvidenceVisible(),
        disabled: !evidence.analyzed || evidence.sideSecondaryCount === 0,
      };
    case VIEW_SETTING_IDS.FRONT_SEGMENTATION:
      return {
        checked: frontSegSettingEnabled,
        disabled: !evidence.analyzed || !evidence.hasFrontRaster,
      };
    case VIEW_SETTING_IDS.SIDE_SEGMENTATION:
      return {
        checked: sideSegSettingEnabled,
        disabled: !evidence.analyzed || !evidence.hasSideRaster,
      };
    case VIEW_SETTING_IDS.BODY_PREVIEWS:
      return { checked: isBodyMeasurementPreviewVisible(), disabled: false };
    default:
      return { checked: false, disabled: true };
  }
}

/**
 * @param {string} id
 * @param {{ measurement?: object, referenceMarkers?: object, volumeGrid?: object } | null} [deps]
 */
export function toggleViewSetting(id, deps = viewControlDeps) {
  const current = getViewSetting(id);
  if (current.disabled) {
    return;
  }
  applyViewSetting(id, !current.checked, deps);
}

export function setupViewControls(referenceMarkers, volumeGrid, measurement) {
  viewControlDeps = { referenceMarkers, volumeGrid, measurement };

  applyViewSetting(VIEW_SETTING_IDS.ORIGIN_CENTER, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.ANNOTATIONS, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.LATTICE_3D, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.FRONT_GRID, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.SIDE_GRID, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.MEASUREMENT_LINES, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.FRONT_SEGMENTATION, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.SIDE_SEGMENTATION, true, viewControlDeps);
  applyViewSetting(VIEW_SETTING_IDS.BODY_PREVIEWS, true, viewControlDeps);
}

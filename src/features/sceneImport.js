import {
  INTERNAL_POINT_COUNT,
  INTERNAL_SAMPLE_UNIT,
  ROOM_SIZE,
} from '../core/constants.js';
import { restoreAnnotations } from './annotations.js';
import {
  restoreActiveMeasurement,
  restoreMeasurementHistory,
} from './measurement.js';
import { applyImportedMode } from '../ui/appModeControls.js';
import { clearGraphHighlight } from './sceneGraphHighlight.js';
import {
  loadSceneJsonInput,
  sceneImportStatusEl,
} from '../ui/domRefs.js';

const APP_NAME = 'REVacity Metrology Space';
const METADATA_VERSION = 1;
const VALID_MODES = new Set(['inspect-measure', 'annotate']);

function isValidCoordinate(point) {
  if (!point || typeof point !== 'object') {
    return false;
  }

  return ['x', 'y', 'z'].every((axis) => {
    const value = point[axis];
    return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= ROOM_SIZE;
  });
}

function isValidDistanceCm(value) {
  return typeof value === 'number' && !Number.isNaN(value);
}

function isValidPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateSceneScale(sceneScale) {
  if (!sceneScale || typeof sceneScale !== 'object') {
    return 'Missing sceneScale';
  }

  if (sceneScale.unit !== 'cm') {
    return 'sceneScale.unit must be "cm"';
  }

  const { cubeSizeCm } = sceneScale;
  if (
    !cubeSizeCm
    || cubeSizeCm.x !== ROOM_SIZE
    || cubeSizeCm.y !== ROOM_SIZE
    || cubeSizeCm.z !== ROOM_SIZE
  ) {
    return 'sceneScale.cubeSizeCm must be { x: 200, y: 200, z: 200 }';
  }

  if (sceneScale.internalSamplingCm !== INTERNAL_SAMPLE_UNIT) {
    return 'sceneScale.internalSamplingCm must be 5';
  }

  if (sceneScale.internalPointCount !== INTERNAL_POINT_COUNT) {
    return 'sceneScale.internalPointCount must be 68921';
  }

  return null;
}

function validateOptionalPoint(point, label) {
  if (point === null || point === undefined) {
    return null;
  }

  if (!isValidCoordinate(point)) {
    return `${label} coordinates must be numbers within 0 to 200`;
  }

  return null;
}

function validateMeasurementHistory(history) {
  if (!Array.isArray(history)) {
    return 'measurementHistory must be an array';
  }

  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    const prefix = `measurementHistory[${index}]`;

    if (!entry || typeof entry !== 'object') {
      return `${prefix} must be an object`;
    }

    if (!isValidPositiveInteger(entry.number)) {
      return `${prefix}.number must be a positive integer`;
    }

    const pointAError = validateOptionalPoint(entry.pointA, `${prefix}.pointA`);
    if (pointAError || !entry.pointA) {
      return pointAError ?? `${prefix}.pointA is required`;
    }

    const pointBError = validateOptionalPoint(entry.pointB, `${prefix}.pointB`);
    if (pointBError || !entry.pointB) {
      return pointBError ?? `${prefix}.pointB is required`;
    }

    if (!isValidDistanceCm(entry.distanceCm)) {
      return `${prefix}.distanceCm must be a number`;
    }
  }

  return null;
}

function validateAnnotations(annotations) {
  if (!Array.isArray(annotations)) {
    return 'annotations must be an array';
  }

  for (let index = 0; index < annotations.length; index += 1) {
    const entry = annotations[index];
    const prefix = `annotations[${index}]`;

    if (!entry || typeof entry !== 'object') {
      return `${prefix} must be an object`;
    }

    if (!isValidPositiveInteger(entry.id)) {
      return `${prefix}.id must be a positive integer`;
    }

    if (typeof entry.name !== 'string' || entry.name.trim() === '') {
      return `${prefix}.name must be a non-empty string`;
    }

    const positionError = validateOptionalPoint(entry.position, `${prefix}.position`);
    if (positionError || !entry.position) {
      return positionError ?? `${prefix}.position is required`;
    }
  }

  return null;
}

function validateActiveMeasurement(activeMeasurement) {
  if (activeMeasurement === null || activeMeasurement === undefined) {
    return null;
  }

  if (typeof activeMeasurement !== 'object') {
    return 'activeMeasurement must be an object';
  }

  const pointAError = validateOptionalPoint(activeMeasurement.pointA, 'activeMeasurement.pointA');
  if (pointAError) {
    return pointAError;
  }

  const pointBError = validateOptionalPoint(activeMeasurement.pointB, 'activeMeasurement.pointB');
  if (pointBError) {
    return pointBError;
  }

  if (
    activeMeasurement.distanceCm !== null
    && activeMeasurement.distanceCm !== undefined
    && !isValidDistanceCm(activeMeasurement.distanceCm)
  ) {
    return 'activeMeasurement.distanceCm must be a number when present';
  }

  return null;
}

function validateAppMode(appMode) {
  if (appMode === null || appMode === undefined) {
    return null;
  }

  if (typeof appMode !== 'object') {
    return 'appMode must be an object';
  }

  if (
    appMode.currentMode !== undefined
    && !VALID_MODES.has(appMode.currentMode)
  ) {
    return 'appMode.currentMode must be "inspect-measure" or "annotate"';
  }

  return null;
}

export function validateSceneState(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid Scene State JSON' };
  }

  const { metadata } = data;
  if (!metadata || typeof metadata !== 'object') {
    return { valid: false, error: 'Missing metadata' };
  }

  if (metadata.appName !== APP_NAME) {
    return { valid: false, error: 'metadata.appName must be "REVacity Metrology Space"' };
  }

  if (metadata.version !== METADATA_VERSION) {
    return { valid: false, error: 'metadata.version must be 1' };
  }

  const sceneScaleError = validateSceneScale(data.sceneScale);
  if (sceneScaleError) {
    return { valid: false, error: sceneScaleError };
  }

  const appModeError = validateAppMode(data.appMode);
  if (appModeError) {
    return { valid: false, error: appModeError };
  }

  const historyError = validateMeasurementHistory(data.measurementHistory ?? []);
  if (historyError) {
    return { valid: false, error: historyError };
  }

  const annotationsError = validateAnnotations(data.annotations ?? []);
  if (annotationsError) {
    return { valid: false, error: annotationsError };
  }

  const activeMeasurementError = validateActiveMeasurement(data.activeMeasurement);
  if (activeMeasurementError) {
    return { valid: false, error: activeMeasurementError };
  }

  return { valid: true };
}

function showImportStatus(message, type = 'error') {
  sceneImportStatusEl.textContent = message;
  sceneImportStatusEl.hidden = false;
  sceneImportStatusEl.dataset.status = type;
}

function hideImportStatus() {
  sceneImportStatusEl.hidden = true;
  sceneImportStatusEl.textContent = '';
  delete sceneImportStatusEl.dataset.status;
}

export function importSceneState(data, measurement, selectionHighlight) {
  const validation = validateSceneState(data);
  if (!validation.valid) {
    console.warn('[REVacity] Scene import rejected:', validation.error);
    showImportStatus(validation.error);
    return false;
  }

  hideImportStatus();

  clearGraphHighlight();

  restoreMeasurementHistory(data.measurementHistory ?? []);
  restoreAnnotations(data.annotations ?? []);
  restoreActiveMeasurement(measurement, data.activeMeasurement ?? null);

  const importedMode = data.appMode?.currentMode;
  if (importedMode && VALID_MODES.has(importedMode)) {
    applyImportedMode(importedMode, selectionHighlight);
  }

  console.info('[REVacity] Scene State imported successfully.');
  return true;
}

export function setupSceneImport(measurement, selectionHighlight) {
  loadSceneJsonInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importSceneState(data, measurement, selectionHighlight);
    } catch (error) {
      const message = error instanceof SyntaxError
        ? 'Invalid JSON file'
        : 'Failed to read Scene State file';
      console.warn('[REVacity] Scene import failed:', message, error);
      showImportStatus(message);
    }
  });
}

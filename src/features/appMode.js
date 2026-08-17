export const APP_MODE_INSPECT_MEASURE = 'inspect-measure';
export const APP_MODE_ANNOTATE = 'annotate';

let currentMode = APP_MODE_INSPECT_MEASURE;

export function getAppMode() {
  return currentMode;
}

export function setAppMode(mode) {
  currentMode = mode;
}

export function isInspectMeasureMode() {
  return currentMode === APP_MODE_INSPECT_MEASURE;
}

export function isAnnotateMode() {
  return currentMode === APP_MODE_ANNOTATE;
}

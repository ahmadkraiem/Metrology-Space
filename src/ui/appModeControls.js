import {
  APP_MODE_ANNOTATE,
  APP_MODE_INSPECT_MEASURE,
  getAppMode,
  setAppMode,
} from '../features/appMode.js';
import { clearAnnotationInput } from '../features/annotations.js';
import { clearMeasurement } from '../features/measurement.js';
import { clearSelection } from '../features/selection.js';
import {
  annotationAddControls,
  measurementPanel,
  selectionPanel,
  statusModeValueEl,
} from './domRefs.js';
import {
  focusBodyEvidenceWorkflow,
  setInspectorWorkflow,
  workflowForMode,
} from './inspectorWorkflow.js';
import { updateSceneGraph } from './sceneGraphPanel.js';

const MODE_LABELS = {
  [APP_MODE_INSPECT_MEASURE]: 'Inspect & Measure',
  [APP_MODE_ANNOTATE]: 'Annotate',
};

function updateModeUI(mode, selectionHighlight) {
  statusModeValueEl.textContent = MODE_LABELS[mode];
  annotationAddControls.hidden = mode !== APP_MODE_ANNOTATE;

  if (mode === APP_MODE_INSPECT_MEASURE) {
    selectionPanel.hidden = true;
    selectionHighlight.visible = false;
    measurementPanel.hidden = false;
  } else {
    measurementPanel.hidden = true;
  }

  setInspectorWorkflow(workflowForMode(mode));
  updateSceneGraph();
}

function leaveInspectMeasureMode(measurement, selectionHighlight) {
  clearMeasurement(measurement, selectionHighlight);
}

function leaveAnnotateMode(selectionHighlight) {
  clearSelection(selectionHighlight);
  clearAnnotationInput();
}

function switchToMode(mode, measurement, selectionHighlight) {
  if (getAppMode() === mode) {
    return;
  }

  if (mode === APP_MODE_ANNOTATE) {
    leaveInspectMeasureMode(measurement, selectionHighlight);
  } else {
    leaveAnnotateMode(selectionHighlight);
  }

  setAppMode(mode);
  updateModeUI(mode, selectionHighlight);
}

export function applyImportedMode(mode, selectionHighlight) {
  setAppMode(mode);
  updateModeUI(mode, selectionHighlight);
}

export function activateInspectMeasureWorkflow(measurement, selectionHighlight) {
  switchToMode(APP_MODE_INSPECT_MEASURE, measurement, selectionHighlight);
  setInspectorWorkflow(workflowForMode(APP_MODE_INSPECT_MEASURE));
}

export function activateAnnotateWorkflow(measurement, selectionHighlight) {
  switchToMode(APP_MODE_ANNOTATE, measurement, selectionHighlight);
  setInspectorWorkflow(workflowForMode(APP_MODE_ANNOTATE));
}

export function activateBodyEvidenceWorkflow() {
  focusBodyEvidenceWorkflow();
}

export function setupAppModeControls(measurement, selectionHighlight) {
  updateModeUI(getAppMode(), selectionHighlight);
}

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
  modeAnnotateBtn,
  modeInspectMeasureBtn,
  selectionPanel,
  statusModeValueEl,
} from './domRefs.js';
import { setInspectorWorkflow, workflowForMode } from './inspectorWorkflow.js';
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
  } else {
    measurementPanel.hidden = true;
  }

  // Workflow owns the toggle buttons, left panel visibility, and status hint.
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

export function setupAppModeControls(measurement, selectionHighlight) {
  updateModeUI(getAppMode(), selectionHighlight);

  // Workflow is set explicitly: switchToMode is a no-op when the mode already
  // matches (e.g. returning from the Body Evidence workflow), and re-entering a
  // mode must never clear the active measurement or selection.
  modeInspectMeasureBtn.addEventListener('click', () => {
    switchToMode(APP_MODE_INSPECT_MEASURE, measurement, selectionHighlight);
    setInspectorWorkflow(workflowForMode(APP_MODE_INSPECT_MEASURE));
  });

  modeAnnotateBtn.addEventListener('click', () => {
    switchToMode(APP_MODE_ANNOTATE, measurement, selectionHighlight);
    setInspectorWorkflow(workflowForMode(APP_MODE_ANNOTATE));
  });
}

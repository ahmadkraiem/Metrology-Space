/**
 * Left Metrology Inspector workflow switching (UI-only).
 *
 * Workflows decide which left panels are visible; they never mutate
 * measurement, annotation, Body Evidence, or Scene State data. Measurement and
 * Annotation mirror the two app modes; Body Evidence is an inspector-only
 * workflow that leaves the active app mode untouched.
 */

import { APP_MODE_ANNOTATE } from '../features/appMode.js';
import {
  leftSidebarEl,
  modeAnnotateBtn,
  modeInspectMeasureBtn,
  statusHintEl,
  workflowBodyEvidenceBtn,
} from './domRefs.js';

export const WORKFLOW_MEASUREMENT = 'measurement';
export const WORKFLOW_ANNOTATION = 'annotation';
export const WORKFLOW_BODY_EVIDENCE = 'body-evidence';

const WORKFLOW_HINTS = {
  [WORKFLOW_MEASUREMENT]: 'Hover a point, click two points to measure distance',
  [WORKFLOW_ANNOTATION]: 'Click a point to select, then add an annotation',
  [WORKFLOW_BODY_EVIDENCE]: 'Load and analyze body evidence, then inspect or promote a landmark',
};

const WORKFLOW_BUTTONS = {
  [WORKFLOW_MEASUREMENT]: modeInspectMeasureBtn,
  [WORKFLOW_ANNOTATION]: modeAnnotateBtn,
  [WORKFLOW_BODY_EVIDENCE]: workflowBodyEvidenceBtn,
};

let currentWorkflow = WORKFLOW_MEASUREMENT;

export function workflowForMode(mode) {
  return mode === APP_MODE_ANNOTATE ? WORKFLOW_ANNOTATION : WORKFLOW_MEASUREMENT;
}

export function getInspectorWorkflow() {
  return currentWorkflow;
}

export function isBodyEvidenceWorkflow() {
  return currentWorkflow === WORKFLOW_BODY_EVIDENCE;
}

export function setInspectorWorkflow(workflow) {
  if (!WORKFLOW_BUTTONS[workflow]) {
    return;
  }

  currentWorkflow = workflow;

  if (leftSidebarEl) {
    leftSidebarEl.dataset.workflow = workflow;
  }

  Object.entries(WORKFLOW_BUTTONS).forEach(([id, button]) => {
    button?.classList.toggle('mode-toggle-btn--active', id === workflow);
    button?.setAttribute('aria-pressed', id === workflow ? 'true' : 'false');
  });

  if (statusHintEl) {
    statusHintEl.textContent = WORKFLOW_HINTS[workflow];
  }
}

/**
 * Body Evidence is inspector-only: selecting it changes panel visibility and
 * nothing else, so measurements, annotations, and evidence state survive.
 */
export function setupInspectorWorkflow() {
  workflowBodyEvidenceBtn?.addEventListener('click', () => {
    setInspectorWorkflow(WORKFLOW_BODY_EVIDENCE);
  });

  setInspectorWorkflow(currentWorkflow);
}

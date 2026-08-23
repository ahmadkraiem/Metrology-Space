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
  statusHintEl,
} from './domRefs.js';
import {
  WORKFLOW_ANNOTATION,
  WORKFLOW_BODY_EVIDENCE,
  WORKFLOW_LABELS,
  WORKFLOW_MEASUREMENT,
  getInspectorWorkflow,
  getWorkflowHint,
  getWorkflowLabel,
  isBodyEvidenceWorkflow,
  setInspectorWorkflowState,
  subscribeInspectorWorkflowChange,
} from './inspectorWorkflowState.js';

export {
  WORKFLOW_ANNOTATION,
  WORKFLOW_BODY_EVIDENCE,
  WORKFLOW_LABELS,
  WORKFLOW_MEASUREMENT,
  getInspectorWorkflow,
  getWorkflowLabel,
  isBodyEvidenceWorkflow,
  subscribeInspectorWorkflowChange,
};

export function workflowForMode(mode) {
  return mode === APP_MODE_ANNOTATE ? WORKFLOW_ANNOTATION : WORKFLOW_MEASUREMENT;
}

function syncWorkflowChrome() {
  const workflow = getInspectorWorkflow();

  if (leftSidebarEl) {
    leftSidebarEl.dataset.workflow = workflow;
  }

  if (statusHintEl) {
    statusHintEl.textContent = getWorkflowHint(workflow);
  }

  if (workflow === WORKFLOW_BODY_EVIDENCE) {
    const bodyEvidencePanel = document.getElementById('body-evidence-panel');
    if (bodyEvidencePanel) {
      bodyEvidencePanel.classList.remove('is-collapsed');
    }
  }
}

export function setInspectorWorkflow(workflow) {
  setInspectorWorkflowState(workflow);
}

/** Focus the Body Evidence inspector workflow without mutating evidence data. */
export function focusBodyEvidenceWorkflow() {
  setInspectorWorkflow(WORKFLOW_BODY_EVIDENCE);
}

/**
 * Body Evidence is inspector-only: selecting it changes panel visibility and
 * nothing else, so measurements, annotations, and evidence state survive.
 */
export function setupInspectorWorkflow() {
  subscribeInspectorWorkflowChange(() => {
    syncWorkflowChrome();
  });
  syncWorkflowChrome();
}

/**
 * Inspector workflow identity — no DOM.
 * Chrome and mode switching live in inspectorWorkflow / appModeControls.
 */

export const WORKFLOW_MEASUREMENT = 'measurement';
export const WORKFLOW_ANNOTATION = 'annotation';
export const WORKFLOW_BODY_EVIDENCE = 'body-evidence';

export const WORKFLOW_LABELS = Object.freeze({
  [WORKFLOW_MEASUREMENT]: 'Inspect & Measure',
  [WORKFLOW_ANNOTATION]: 'Annotate',
  [WORKFLOW_BODY_EVIDENCE]: 'Body Evidence',
});

const WORKFLOW_HINTS = Object.freeze({
  [WORKFLOW_MEASUREMENT]: 'Hover a point, click two points to measure distance',
  [WORKFLOW_ANNOTATION]: 'Click a point to select, then add an annotation',
  [WORKFLOW_BODY_EVIDENCE]: 'Load and analyze body evidence, then inspect or promote a landmark',
});

/** @type {Set<(workflow: string) => void>} */
const workflowChangeListeners = new Set();

let currentWorkflow = WORKFLOW_MEASUREMENT;

export function getWorkflowLabel(workflow = currentWorkflow) {
  return WORKFLOW_LABELS[workflow] ?? '';
}

export function getWorkflowHint(workflow = currentWorkflow) {
  return WORKFLOW_HINTS[workflow] ?? '';
}

export function getInspectorWorkflow() {
  return currentWorkflow;
}

export function isBodyEvidenceWorkflow() {
  return currentWorkflow === WORKFLOW_BODY_EVIDENCE;
}

export function subscribeInspectorWorkflowChange(listener) {
  workflowChangeListeners.add(listener);
  return () => workflowChangeListeners.delete(listener);
}

export function setInspectorWorkflowState(workflow) {
  if (!WORKFLOW_LABELS[workflow]) {
    return false;
  }
  currentWorkflow = workflow;
  for (const listener of workflowChangeListeners) {
    listener(currentWorkflow);
  }
  return true;
}

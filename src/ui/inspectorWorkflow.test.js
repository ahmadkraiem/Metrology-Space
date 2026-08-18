import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKFLOW_ANNOTATION,
  WORKFLOW_BODY_EVIDENCE,
  WORKFLOW_MEASUREMENT,
  getInspectorWorkflow,
  getWorkflowLabel,
  setInspectorWorkflowState,
  subscribeInspectorWorkflowChange,
} from './inspectorWorkflowState.js';

test('workflow labels match the inspector/menu titles', () => {
  assert.equal(getWorkflowLabel(WORKFLOW_MEASUREMENT), 'Inspect & Measure');
  assert.equal(getWorkflowLabel(WORKFLOW_ANNOTATION), 'Annotate');
  assert.equal(getWorkflowLabel(WORKFLOW_BODY_EVIDENCE), 'Body Evidence');
});

test('setInspectorWorkflowState updates the active workflow and notifies subscribers', () => {
  const seen = [];
  const unsubscribe = subscribeInspectorWorkflowChange((workflow) => {
    seen.push(workflow);
  });

  setInspectorWorkflowState(WORKFLOW_BODY_EVIDENCE);
  assert.equal(getInspectorWorkflow(), WORKFLOW_BODY_EVIDENCE);
  assert.deepEqual(seen, [WORKFLOW_BODY_EVIDENCE]);

  setInspectorWorkflowState(WORKFLOW_MEASUREMENT);
  assert.equal(getInspectorWorkflow(), WORKFLOW_MEASUREMENT);
  assert.deepEqual(seen, [WORKFLOW_BODY_EVIDENCE, WORKFLOW_MEASUREMENT]);

  unsubscribe();
  setInspectorWorkflowState(WORKFLOW_ANNOTATION);
  assert.equal(getInspectorWorkflow(), WORKFLOW_ANNOTATION);
  assert.deepEqual(seen, [WORKFLOW_BODY_EVIDENCE, WORKFLOW_MEASUREMENT]);
});

test('setInspectorWorkflowState ignores unknown workflow ids', () => {
  setInspectorWorkflowState(WORKFLOW_MEASUREMENT);
  setInspectorWorkflowState('front-side-alignment');
  assert.equal(getInspectorWorkflow(), WORKFLOW_MEASUREMENT);
});

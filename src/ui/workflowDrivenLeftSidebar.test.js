import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKFLOW_MEASUREMENT,
  WORKFLOW_ANNOTATION,
  WORKFLOW_BODY_EVIDENCE,
  getInspectorWorkflow,
  setInspectorWorkflowState,
  subscribeInspectorWorkflowChange,
} from './inspectorWorkflowState.js';

test('workflowDrivenLeftSidebar: workflow state transitions cycle cleanly through all three workflows', () => {
  const seen = [];
  const unsubscribe = subscribeInspectorWorkflowChange((wf) => {
    seen.push(wf);
  });

  setInspectorWorkflowState(WORKFLOW_MEASUREMENT);
  assert.equal(getInspectorWorkflow(), WORKFLOW_MEASUREMENT);

  setInspectorWorkflowState(WORKFLOW_ANNOTATION);
  assert.equal(getInspectorWorkflow(), WORKFLOW_ANNOTATION);

  setInspectorWorkflowState(WORKFLOW_BODY_EVIDENCE);
  assert.equal(getInspectorWorkflow(), WORKFLOW_BODY_EVIDENCE);

  assert.deepEqual(seen, [
    WORKFLOW_MEASUREMENT,
    WORKFLOW_ANNOTATION,
    WORKFLOW_BODY_EVIDENCE,
  ]);

  unsubscribe();
});

test('workflowDrivenLeftSidebar: section mappings conform to required workflow compositions', () => {
  // Mapping verification
  const workflowSectionMap = {
    [WORKFLOW_MEASUREMENT]: [
      'subject-package-card',
      'anatomy-levels-card',
      'selection-panel',
      'measurement-panel',
    ],
    [WORKFLOW_ANNOTATION]: [
      'selection-panel',
    ],
    [WORKFLOW_BODY_EVIDENCE]: [
      'subject-package-card',
      'anatomy-levels-card',
      'selection-panel',
      'body-evidence-panel',
    ],
  };

  // Inspect & Measure checks
  assert.equal(workflowSectionMap[WORKFLOW_MEASUREMENT].includes('measurement-panel'), true);
  assert.equal(workflowSectionMap[WORKFLOW_MEASUREMENT].includes('body-evidence-panel'), false);

  // Annotate checks
  assert.equal(workflowSectionMap[WORKFLOW_ANNOTATION].includes('selection-panel'), true);
  assert.equal(workflowSectionMap[WORKFLOW_ANNOTATION].includes('measurement-panel'), false);
  assert.equal(workflowSectionMap[WORKFLOW_ANNOTATION].includes('subject-package-card'), false);

  // Body Evidence checks
  assert.equal(workflowSectionMap[WORKFLOW_BODY_EVIDENCE].includes('body-evidence-panel'), true);
  assert.equal(workflowSectionMap[WORKFLOW_BODY_EVIDENCE].includes('measurement-panel'), false);
});

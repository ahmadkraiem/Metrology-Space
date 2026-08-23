import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKFLOW_MEASUREMENT,
  WORKFLOW_ANNOTATION,
  WORKFLOW_BODY_EVIDENCE,
  WORKFLOW_LABELS,
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
      'anatomy-levels-card',
      'measurement-panel',
    ],
    [WORKFLOW_ANNOTATION]: [
      'annotation-panel',
    ],
    [WORKFLOW_BODY_EVIDENCE]: [
      'anatomy-levels-card',
      'body-evidence-panel',
    ],
  };

  // Inspect & Measure checks
  assert.equal(workflowSectionMap[WORKFLOW_MEASUREMENT].includes('measurement-panel'), true);
  assert.equal(workflowSectionMap[WORKFLOW_MEASUREMENT].includes('anatomy-levels-card'), true);
  assert.equal(workflowSectionMap[WORKFLOW_MEASUREMENT].includes('body-evidence-panel'), false);

  // Annotate checks
  assert.equal(workflowSectionMap[WORKFLOW_ANNOTATION].includes('annotation-panel'), true);
  assert.equal(workflowSectionMap[WORKFLOW_ANNOTATION].includes('measurement-panel'), false);
  assert.equal(workflowSectionMap[WORKFLOW_ANNOTATION].includes('anatomy-levels-card'), false);

  // Body Evidence checks
  assert.equal(workflowSectionMap[WORKFLOW_BODY_EVIDENCE].includes('body-evidence-panel'), true);
  assert.equal(workflowSectionMap[WORKFLOW_BODY_EVIDENCE].includes('anatomy-levels-card'), true);
  assert.equal(workflowSectionMap[WORKFLOW_BODY_EVIDENCE].includes('measurement-panel'), false);
});

test('workflowDrivenLeftSidebar: workflow labels map accurately for bottom status bar synchronization', () => {
  assert.equal(WORKFLOW_LABELS[WORKFLOW_MEASUREMENT], 'Inspect & Measure');
  assert.equal(WORKFLOW_LABELS[WORKFLOW_ANNOTATION], 'Annotate');
  assert.equal(WORKFLOW_LABELS[WORKFLOW_BODY_EVIDENCE], 'Body Evidence');
});


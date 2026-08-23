import test from 'node:test';
import assert from 'node:assert/strict';

import { renderAdvancedQaPanel } from './advancedQaPanel.js';
import { mapBlockerToHumanLabel } from './derivedMeasurementDeck.js';

test('advancedQaPanel: renderAdvancedQaPanel renders empty state when evidence not analyzed', () => {
  const container = { innerHTML: '' };
  renderAdvancedQaPanel(container);

  assert.equal(container.innerHTML.includes('No Body Evidence Package Loaded'), true);
});

test('derivedMeasurementDeck: mapBlockerToHumanLabel correctly maps domain blocker codes to readable labels', () => {
  assert.equal(mapBlockerToHumanLabel('clothing_authorization_missing'), 'Clothing Validation Pending');
  assert.equal(mapBlockerToHumanLabel('view_pose_semantics_missing'), 'Capture Orientation Validation Pending');
  assert.equal(mapBlockerToHumanLabel('authoritative_physical_evidence_missing'), 'Physical Evidence Validation Pending');
  assert.equal(mapBlockerToHumanLabel('comparability_qa_missing'), 'Cross-View Comparability Pending');
  assert.equal(mapBlockerToHumanLabel('correspondence_unavailable'), 'View Alignment Incomplete');
});

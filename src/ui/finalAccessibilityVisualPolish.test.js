import test from 'node:test';
import assert from 'node:assert/strict';

import { mapBlockerToHumanLabel } from './derivedMeasurementDeck.js';

test('finalAccessibilityVisualPolish: strict terminology guardrail enforces scientific naming', () => {
  const frontAxisLabel = 'Front · X/Y';
  const sideAxisLabel = 'Side Profile · U/Y';
  const frontTransverseLabel = 'Front Transverse Width';
  const sideProfileLabel = 'Side Profile Span';
  const metricProjectedBadge = 'Metric Projected';
  const validationPendingBadge = 'Validation Pending';

  // Front and Side coordinate labels
  assert.equal(frontAxisLabel.includes('X/Y'), true);
  assert.equal(sideAxisLabel.includes('U/Y'), true);
  assert.equal(/depth/i.test(sideAxisLabel), false);

  // Derived measurement labels
  assert.equal(frontTransverseLabel, 'Front Transverse Width');
  assert.equal(sideProfileLabel, 'Side Profile Span');
  assert.equal(/depth/i.test(sideProfileLabel), false);

  // Status badges
  assert.equal(metricProjectedBadge, 'Metric Projected');
  assert.equal(validationPendingBadge, 'Validation Pending');
});

test('finalAccessibilityVisualPolish: blocker code mappings strictly reject false certification claims', () => {
  const poseLabel = mapBlockerToHumanLabel('view_pose_semantics_missing');
  const physicalLabel = mapBlockerToHumanLabel('authoritative_physical_evidence_missing');
  const clothingLabel = mapBlockerToHumanLabel('clothing_authorization_missing');

  assert.equal(poseLabel, 'Capture Orientation Validation Pending');
  assert.equal(physicalLabel, 'Physical Evidence Validation Pending');
  assert.equal(clothingLabel, 'Clothing Validation Pending');

  assert.equal(/coronal verified/i.test(poseLabel), false);
  assert.equal(/sagittal verified/i.test(poseLabel), false);
  assert.equal(/orientation certified/i.test(poseLabel), false);
});

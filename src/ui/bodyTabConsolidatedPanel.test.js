import test from 'node:test';
import assert from 'node:assert/strict';

import { setupBodyTabConsolidatedPanel } from './bodyTabConsolidatedPanel.js';
import { restoreAnnotations } from '../features/annotations.js';
import {
  buildBodyAnchorAudit,
  getNaturalWaistPlaneLocalization,
} from '../features/bodyEvidence.js';
import { buildAnatomicalMeasurementLines } from '../features/bodyMeasurementLines.js';
import {
  getMeasurementRecordById,
  selectMeasurement,
  getSelectedMeasurementId,
  clearSelectedMeasurement,
} from './derivedMeasurementDeck.js';
import {
  getMeasurementHighlight,
  clearMeasurementHighlight,
} from './measurementHighlightOverlay2d.js';
import {
  resolveMeasurementVisualizationProvenance,
  VISUALIZATION_TYPES,
} from '../features/measurementVisualizationProvenance.js';

test('bodyTabConsolidatedPanel: Body / Anchor Diagnostics renders Anchor Health metrics and omits legacy previews & waist card', () => {
  const origDoc = global.document;
  const mockContainer = { innerHTML: '', dataset: {} };

  global.document = {
    getElementById: (id) => {
      if (id === 'body-measurement-readiness') return mockContainer;
      if (id === 'front-side-alignment-qa') return { innerHTML: '' };
      return null;
    },
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  const annotations = [
    { id: 1, type: 'body_landmark', name: 'neck', position: { x: 50, y: 170, z: 200 } },
    { id: 2, type: 'body_landmark', name: 'left_shoulder', position: { x: 30, y: 150, z: 200 } },
    { id: 3, type: 'body_landmark', name: 'right_shoulder', position: { x: 70, y: 150, z: 200 } },
    { id: 4, type: 'body_landmark', name: 'left_hip', position: { x: 30, y: 70, z: 200 } },
    { id: 5, type: 'body_landmark', name: 'right_hip', position: { x: 70, y: 70, z: 200 } },
  ];
  restoreAnnotations(annotations);

  setupBodyTabConsolidatedPanel();

  const renderedHtml = mockContainer.innerHTML;

  // 1. Verify Anchor Health metrics ARE rendered
  assert.ok(renderedHtml.includes('Missing core anchors'), 'Missing core anchors metric rendered');
  assert.ok(renderedHtml.includes('Duplicate body anchor names'), 'Duplicate body anchor names metric rendered');
  assert.ok(renderedHtml.includes('Out of bounds'), 'Out of bounds metric rendered');
  assert.ok(renderedHtml.includes('Front-surface Z warnings'), 'Front-surface Z warnings metric rendered');

  // 2. Verify legacy preview labels do NOT render in Diagnostics
  assert.equal(renderedHtml.includes('Shoulder Width'), false, 'Shoulder Width preview omitted');
  assert.equal(renderedHtml.includes('Elbow Span'), false, 'Elbow Span preview omitted');
  assert.equal(renderedHtml.includes('Wrist Span'), false, 'Wrist Span preview omitted');
  assert.equal(renderedHtml.includes('Hip Width'), false, 'Hip Width preview omitted');
  assert.equal(renderedHtml.includes('Knee Span'), false, 'Knee Span preview omitted');
  assert.equal(renderedHtml.includes('Ankle Span'), false, 'Ankle Span preview omitted');
  assert.equal(renderedHtml.includes('Metric Projected'), false, 'Metric Projected preview badge omitted');

  // 3. Verify Natural Waist Plane card does NOT render in Diagnostics
  assert.equal(renderedHtml.includes('Natural Waist Plane'), false, 'Natural Waist Plane card omitted from Diagnostics');
  assert.equal(renderedHtml.includes('natural_waist_plane_localization'), false, 'natural_waist_plane_localization omitted from Diagnostics DOM');

  restoreAnnotations([]);
  global.document = origDoc;
});

test('bodyTabConsolidatedPanel: Domain features buildAnatomicalMeasurementLines & getNaturalWaistPlaneLocalization remain available internally', () => {
  const annotations = [
    { id: 1, type: 'body_landmark', name: 'left_shoulder', point: { x: 30, y: 150, z: 200 } },
    { id: 2, type: 'body_landmark', name: 'right_shoulder', point: { x: 70, y: 150, z: 200 } },
  ];

  // 1. buildAnatomicalMeasurementLines is intact
  const linesResult = buildAnatomicalMeasurementLines(annotations);
  assert.ok(linesResult);
  assert.equal(linesResult.lines.length, 6);
  const shoulderLine = linesResult.lines.find((l) => l.id === 'shoulder_width');
  assert.ok(shoulderLine);
  assert.equal(shoulderLine.status, 'Ready');
  assert.equal(shoulderLine.distanceCm, 40);

  // 2. buildBodyAnchorAudit is intact
  const audit = buildBodyAnchorAudit(annotations);
  assert.ok(audit);
  assert.equal(typeof audit.total, 'number');

  // 3. getNaturalWaistPlaneLocalization is intact
  const waistReport = getNaturalWaistPlaneLocalization({ annotations });
  assert.ok(waistReport !== undefined);
});

test('bodyTabConsolidatedPanel: Modeled Natural Waist Circumference in Results deck resolves exact localized waist plane and highlights Front/Side', () => {
  // Test waist plane visualization provenance resolution
  const waistRecord = {
    contract: 'natural-waist-plane-localization-v0',
    id: 'torso_modeled_natural_waist_circumference_at_natural_waist_plane',
    status: 'modeled',
    yCm: 107.15,
    selectedCandidate: {
      yCm: 107.15,
      rasterRow: 800,
      sideRasterRow: 600,
      frontMinXcm: 36.3,
      frontMaxXcm: 63.7,
      frontWidthCm: 27.4,
      sideMinUcm: 40.0,
      sideMaxUcm: 60.1,
      sideQualifiedApDepthCm: 20.1,
    },
    frontEvidence: { status: 'valid', minXcm: 36.3, maxXcm: 63.7, widthCm: 27.4 },
    sideEvidence: { status: 'valid', minUcm: 40.0, maxUcm: 60.1, qualifiedApDepthCm: 20.1 },
    provenance: {
      sliceHighlightCoordinates: {
        yCm: 107.15,
        frontRasterRow: 800,
        sideRasterRow: 600,
        frontBoundsCm: { minX: 36.3, maxX: 63.7 },
        sideBoundsCm: { minU: 40.0, maxU: 60.1 },
      },
    },
  };

  const provenance = resolveMeasurementVisualizationProvenance(waistRecord);
  assert.equal(provenance.status, 'ready');
  assert.equal(provenance.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);
  assert.deepEqual(provenance.targetViews, ['front', 'side']);
  assert.equal(provenance.geometry.yCm, 107.15);
  assert.equal(provenance.geometry.front.widthCm, 27.4);
  assert.equal(provenance.geometry.side.depthCm, 20.1);
});

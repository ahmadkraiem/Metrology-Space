import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  MODELED_ELLIPSE_PREVIEW_DISCLAIMER,
  MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID,
  MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID,
  MODELED_BUST_CIRCUMFERENCE_MEASUREMENT_ID,
  buildModeledEllipsePreviewHtml,
  computeEllipsePreviewLayout,
  renderModeledEllipsePreview,
  resolveModeledEllipsePreviewModel,
  syncModeledEllipsePreviewFromHighlight,
} from './modeledEllipseCrossSectionPreview.js';
import {
  setMeasurementHighlight,
  clearMeasurementHighlight,
} from './measurementHighlightOverlay2d.js';
import {
  VISUALIZATION_TYPES,
  VISUALIZATION_STATUS,
} from '../features/measurementVisualizationProvenance.js';

function mockWaistRecord(overrides = {}) {
  return {
    contract: 'modeled-natural-waist-circumference-v0',
    id: MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID,
    name: 'Modeled Natural Waist Circumference',
    status: 'modeled',
    valueCm: 82.35,
    levelYcm: 107.15,
    yCm: 107.15,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      transverseWidthCm: 29.0,
      apDepthCm: 23.2,
      semiMajorAxisCm: 14.5,
      semiMinorAxisCm: 11.6,
      frontDiameterCm: 29.0,
      sideDiameterCm: 23.2,
    },
    provenance: {
      selectedYcm: 107.15,
      frontTransverseWidthCm: 29.0,
      sideQualifiedApDepthCm: 23.2,
    },
    semantics: {
      isModeled: true,
      isMeasuredContour: false,
      is3dReconstruction: false,
    },
    ...overrides,
  };
}

function mockBustRecord(overrides = {}) {
  return {
    contract: 'modeled-bust-circumference-v0',
    id: MODELED_BUST_CIRCUMFERENCE_MEASUREMENT_ID,
    name: 'Modeled Bust Circumference',
    status: 'modeled',
    valueCm: 100.2078,
    levelYcm: 123.85,
    yCm: 123.85,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      transverseWidthCm: 34.3,
      apDepthCm: 29.4,
      semiMajorAxisCm: 17.15,
      semiMinorAxisCm: 14.7,
      frontDiameterCm: 34.3,
      sideDiameterCm: 29.4,
    },
    provenance: {
      selectedYcm: 123.85,
      frontTransverseWidthCm: 34.3,
      sideQualifiedApDepthCm: 29.4,
    },
    semantics: {
      isModeled: true,
      isMeasuredContour: false,
      is3dReconstruction: false,
    },
    ...overrides,
  };
}

function mockSeatRecord(overrides = {}) {
  return {
    contract: 'modeled-hip-seat-circumference-v0',
    id: MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID,
    name: 'Modeled Hip Circumference',
    status: 'modeled',
    valueCm: 114.1959,
    levelYcm: 79.95,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      transverseWidthCm: 44.3,
      apDepthCm: 27.4,
      semiMajorAxisCm: 22.15,
      semiMinorAxisCm: 13.7,
    },
    provenance: {
      selectedYcm: 79.95,
      frontTransverseWidthCm: 44.3,
      sideQualifiedApDepthCm: 27.4,
    },
    semantics: {
      isModeled: true,
      isMeasuredContour: false,
      is3dReconstruction: false,
    },
    ...overrides,
  };
}

test('ellipse preview: Hip/Seat record creates modeled ellipse visualization from runtime width/depth', () => {
  const model = resolveModeledEllipsePreviewModel(mockSeatRecord());

  assert.ok(model);
  assert.equal(model.measurementId, MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID);
  assert.equal(model.widthCm, 44.3);
  assert.equal(model.depthCm, 27.4);
  assert.equal(model.perimeterCm, 114.1959);
  assert.equal(model.levelYcm, 79.95);
  assert.equal(model.semiAxisACm, 22.15);
  assert.equal(model.semiAxisBCm, 13.7);
  assert.equal(model.isModeled, true);
  assert.equal(model.isMeasuredContour, false);
  assert.equal(model.is3dReconstruction, false);
  assert.equal(model.disclaimer, 'Ellipse model — not measured contour');
  assert.equal(MODELED_ELLIPSE_PREVIEW_DISCLAIMER, 'Ellipse model — not measured contour');
});

test('ellipse preview: unrelated measurements and missing records do not produce a preview model', () => {
  assert.equal(resolveModeledEllipsePreviewModel(null), null);
  assert.equal(resolveModeledEllipsePreviewModel({
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    contract: 'modeled-cross-section-perimeter-v0',
    status: 'modeled',
    valueCm: 110.98,
    model: { transverseWidthCm: 42.2, apDepthCm: 27.7 },
  }), null);
  assert.equal(resolveModeledEllipsePreviewModel({
    id: 'vertical_torso_length_neck_to_hip',
    status: 'valid',
    valueCm: 48.75,
  }), null);
  assert.equal(resolveModeledEllipsePreviewModel(mockSeatRecord({ status: 'blocked', valueCm: null })), null);
});

test('ellipse preview: layout preserves true width:depth aspect ratio and does not force a circle', () => {
  const layout = computeEllipsePreviewLayout({
    widthCm: 44.3,
    depthCm: 27.4,
    viewportWidth: 200,
    viewportHeight: 120,
    padding: 16,
  });

  assert.ok(layout.ellipseWidthPx > layout.ellipseHeightPx);
  assert.equal(
    Number((layout.ellipseWidthPx / layout.ellipseHeightPx).toFixed(6)),
    Number((44.3 / 27.4).toFixed(6)),
  );
  assert.equal(layout.aspectRatio, 44.3 / 27.4);
  assert.equal(layout.rxPx / layout.ryPx, layout.aspectRatio);

  const tall = computeEllipsePreviewLayout({
    widthCm: 20,
    depthCm: 40,
    viewportWidth: 200,
    viewportHeight: 120,
    padding: 16,
  });
  assert.ok(tall.ellipseHeightPx > tall.ellipseWidthPx);
  assert.equal(
    Number((tall.ellipseWidthPx / tall.ellipseHeightPx).toFixed(6)),
    Number((20 / 40).toFixed(6)),
  );
});

test('ellipse preview: HTML labels runtime width, depth, perimeter, Y, and modeled-not-measured disclaimer', () => {
  const html = buildModeledEllipsePreviewHtml(resolveModeledEllipsePreviewModel(mockSeatRecord()));

  assert.equal(html.includes('Modeled Cross-Section'), true);
  assert.equal(html.includes('Front Width: 44.30 cm'), true);
  assert.equal(html.includes('AP Depth: 27.40 cm'), true);
  assert.equal(html.includes('Modeled Perimeter: 114.20 cm'), true);
  assert.equal(html.includes('79.95 cm'), true);
  assert.equal(html.includes('Ellipse model — not measured contour'), true);
  assert.equal(html.includes('preserveAspectRatio="xMidYMid meet"'), true);
  assert.equal(html.includes('rx="22.15"'), true);
  assert.equal(html.includes('ry="13.7"'), true);

  assert.equal(/canonical\s*z/i.test(html), false);
  assert.equal(/u\s*→\s*z/i.test(html), false);
  assert.equal(/u\s*-+>\s*z/i.test(html), false);
  assert.equal(/3d reconstruction/i.test(html), false);
  assert.equal(/measured body contour/i.test(html), false);
  assert.equal(/reconstructed 3d slice/i.test(html), false);
});

test('ellipse preview: runtime fields are not hardcoded when values change', () => {
  const html = buildModeledEllipsePreviewHtml(resolveModeledEllipsePreviewModel(mockSeatRecord({
    valueCm: 101.25,
    levelYcm: 82.4,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      transverseWidthCm: 40.12,
      apDepthCm: 22.08,
    },
    provenance: {
      selectedYcm: 82.4,
      frontTransverseWidthCm: 40.12,
      sideQualifiedApDepthCm: 22.08,
    },
  })));

  assert.equal(html.includes('Front Width: 40.12 cm'), true);
  assert.equal(html.includes('AP Depth: 22.08 cm'), true);
  assert.equal(html.includes('Modeled Perimeter: 101.25 cm'), true);
  assert.equal(html.includes('82.40 cm') || html.includes('82.4 cm'), true);
  assert.equal(html.includes('44.30 cm'), false);
  assert.equal(html.includes('114.20 cm'), false);
});

test('ellipse preview: render shows preview for Hip/Seat highlight and hides on deselect or unrelated measurement', () => {
  const container = {
    innerHTML: 'stale',
    hidden: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
  };

  global.document = {
    getElementById: (id) => (id === 'modeled-cross-section-preview' ? container : null),
  };

  const vis = {
    measurementId: MODELED_HIP_SEAT_CIRCUMFERENCE_MEASUREMENT_ID,
    visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
    status: VISUALIZATION_STATUS.READY,
  };

  syncModeledEllipsePreviewFromHighlight(vis, mockSeatRecord());
  assert.equal(container.hidden, false);
  assert.equal(container.attributes['aria-hidden'], 'false');
  assert.equal(container.innerHTML.includes('Modeled Cross-Section'), true);
  assert.equal(container.innerHTML.includes('rx="22.15"'), true);

  syncModeledEllipsePreviewFromHighlight(null, mockSeatRecord());
  assert.equal(container.hidden, true);
  assert.equal(container.innerHTML, '');

  renderModeledEllipsePreview(container, resolveModeledEllipsePreviewModel(mockSeatRecord()));
  assert.equal(container.hidden, false);

  syncModeledEllipsePreviewFromHighlight({
    measurementId: 'vertical_torso_length_neck_to_hip',
    visualizationType: VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL,
    status: VISUALIZATION_STATUS.READY,
  }, mockSeatRecord());
  assert.equal(container.hidden, true);
  assert.equal(container.innerHTML, '');

  setMeasurementHighlight(vis);
  clearMeasurementHighlight();
});

test('ellipse preview: Natural Waist record creates modeled ellipse visualization from runtime width/depth and Waist Plane Y label', () => {
  const model = resolveModeledEllipsePreviewModel(mockWaistRecord());

  assert.ok(model);
  assert.equal(model.measurementId, MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID);
  assert.equal(model.planeLabel, 'Waist Plane Y');
  assert.equal(model.widthCm, 29.0);
  assert.equal(model.depthCm, 23.2);
  assert.equal(model.perimeterCm, 82.35);
  assert.equal(model.levelYcm, 107.15);
  assert.equal(model.semiAxisACm, 14.5);
  assert.equal(model.semiAxisBCm, 11.6);
  assert.equal(model.isModeled, true);
  assert.equal(model.isMeasuredContour, false);
  assert.equal(model.is3dReconstruction, false);
  assert.equal(model.disclaimer, 'Ellipse model — not measured contour');

  const html = buildModeledEllipsePreviewHtml(model);
  assert.equal(html.includes('Modeled Cross-Section'), true);
  assert.equal(html.includes('Front Width: 29.00 cm'), true);
  assert.equal(html.includes('AP Depth: 23.20 cm'), true);
  assert.equal(html.includes('Modeled Perimeter: 82.35 cm'), true);
  assert.equal(html.includes('Waist Plane Y: 107.15 cm'), true);
  assert.equal(html.includes('rx="14.5"'), true);
  assert.equal(html.includes('ry="11.6"'), true);
  assert.equal(html.includes('Ellipse model — not measured contour'), true);
});

test('ellipse preview: render shows preview for Natural Waist highlight', () => {
  const container = {
    innerHTML: '',
    hidden: true,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
  };

  global.document = {
    getElementById: (id) => (id === 'modeled-cross-section-preview' ? container : null),
  };

  const vis = {
    measurementId: MODELED_NATURAL_WAIST_CIRCUMFERENCE_MEASUREMENT_ID,
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    status: VISUALIZATION_STATUS.READY,
  };

  syncModeledEllipsePreviewFromHighlight(vis, mockWaistRecord());
  assert.equal(container.hidden, false);
  assert.equal(container.attributes['aria-hidden'], 'false');
  assert.equal(container.innerHTML.includes('Modeled Cross-Section'), true);
  assert.equal(container.innerHTML.includes('Waist Plane Y: 107.15 cm'), true);
  assert.equal(container.innerHTML.includes('rx="14.5"'), true);
});

test('ellipse preview: Modeled Bust record creates modeled ellipse visualization from runtime width/depth and Bust Apex Plane Y label', () => {
  const model = resolveModeledEllipsePreviewModel(mockBustRecord());

  assert.ok(model);
  assert.equal(model.measurementId, MODELED_BUST_CIRCUMFERENCE_MEASUREMENT_ID);
  assert.equal(model.planeLabel, 'Bust Apex Plane Y');
  assert.equal(model.widthCm, 34.3);
  assert.equal(model.depthCm, 29.4);
  assert.equal(model.perimeterCm, 100.2078);
  assert.equal(model.levelYcm, 123.85);
  assert.equal(model.semiAxisACm, 17.15);
  assert.equal(model.semiAxisBCm, 14.7);
  assert.equal(model.isModeled, true);
  assert.equal(model.isMeasuredContour, false);
  assert.equal(model.is3dReconstruction, false);
  assert.equal(model.disclaimer, 'Ellipse model — not measured contour');

  const html = buildModeledEllipsePreviewHtml(model);
  assert.equal(html.includes('Modeled Cross-Section'), true);
  assert.equal(html.includes('Front Width: 34.30 cm'), true);
  assert.equal(html.includes('AP Depth: 29.40 cm'), true);
  assert.equal(html.includes('Modeled Perimeter: 100.21 cm'), true);
  assert.equal(html.includes('Bust Apex Plane Y: 123.85 cm'), true);
  assert.equal(html.includes('rx="17.15"'), true);
  assert.equal(html.includes('ry="14.7"'), true);
  assert.equal(html.includes('Ellipse model — not measured contour'), true);
});

test('ellipse preview: render shows preview for Modeled Bust highlight', () => {
  const container = {
    innerHTML: '',
    hidden: true,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
  };

  global.document = {
    getElementById: (id) => (id === 'modeled-cross-section-preview' ? container : null),
  };

  const vis = {
    measurementId: MODELED_BUST_CIRCUMFERENCE_MEASUREMENT_ID,
    visualizationType: VISUALIZATION_TYPES.BUST_APEX_PLANE,
    status: VISUALIZATION_STATUS.READY,
  };

  syncModeledEllipsePreviewFromHighlight(vis, mockBustRecord());
  assert.equal(container.hidden, false);
  assert.equal(container.attributes['aria-hidden'], 'false');
  assert.equal(container.innerHTML.includes('Modeled Cross-Section'), true);
  assert.equal(container.innerHTML.includes('Bust Apex Plane Y: 123.85 cm'), true);
  assert.equal(container.innerHTML.includes('rx="17.15"'), true);
});

test('ellipse preview: source contains no Ramanujan math, U→Z, or 3D reconstruction semantics', () => {
  const source = readFileSync(
    fileURLToPath(new URL('./modeledEllipseCrossSectionPreview.js', import.meta.url)),
    'utf8',
  );

  assert.equal(source.includes('Math.sqrt'), false);
  assert.equal(source.includes('Math.PI'), false);
  assert.equal(/canonical\s*z/i.test(source), false);
  assert.equal(/u\s*→\s*z/i.test(source), false);
  assert.equal(/3d reconstruction/i.test(source), false);
  assert.equal(source.includes('ellipse_ramanujan_ii'), false);
});

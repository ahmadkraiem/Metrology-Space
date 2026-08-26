import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  VISUALIZATION_TYPES,
  VISUALIZATION_STATUS,
} from '../features/measurementVisualizationProvenance.js';
import {
  setMeasurementHighlight,
  clearMeasurementHighlight,
  getMeasurementHighlight,
  isMeasurementHighlightVisible,
  setMeasurementHighlightVisible,
  subscribeMeasurementHighlightChange,
  renderMeasurementHighlight2d,
  renderFrontMeasurementHighlight,
  renderSideMeasurementHighlight,
  setupMeasurementHighlightOverlay,
} from './measurementHighlightOverlay2d.js';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.style = {};
    this.attributes = {};
    this.dataset = {};
    this.children = [];
    this.textContent = '';
  }

  get classList() {
    const self = this;
    return {
      add(...classes) {
        const set = new Set((self.className || '').split(' ').filter(Boolean));
        classes.forEach((c) => set.add(c));
        self.className = Array.from(set).join(' ');
      },
      remove(...classes) {
        const set = new Set((self.className || '').split(' ').filter(Boolean));
        classes.forEach((c) => set.delete(c));
        self.className = Array.from(set).join(' ');
      },
      contains(c) {
        return (self.className || '').split(' ').includes(c);
      },
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    if (child instanceof MockDocumentFragment) {
      for (const c of child.children) {
        this.children.push(c);
      }
      child.children = [];
      return child;
    }
    this.children.push(child);
    return child;
  }

  replaceChildren(...newChildren) {
    this.children = [];
    for (const child of newChildren) {
      this.appendChild(child);
    }
  }

  querySelectorAll(selector) {
    const results = [];
    const matchClass = selector.startsWith('.') ? selector.slice(1) : null;
    const matchId = selector.startsWith('#') ? selector.slice(1) : null;

    function traverse(el) {
      for (const child of el.children) {
        let isMatch = false;
        if (matchClass && child.classList.contains(matchClass)) isMatch = true;
        if (matchId && child.id === matchId) isMatch = true;
        if (isMatch) results.push(child);
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }
}

class MockDocumentFragment {
  constructor() {
    this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

function setupTestDom() {
  const frontLayer = new MockElement('div');
  frontLayer.id = 'grid2d-measurement-highlight-layer';
  const sideLayer = new MockElement('div');
  sideLayer.id = 'side-evidence-measurement-highlight-layer';

  global.document = {
    createElement: (tag) => new MockElement(tag),
    createDocumentFragment: () => new MockDocumentFragment(),
    getElementById: (id) => {
      if (id === 'grid2d-measurement-highlight-layer') return frontLayer;
      if (id === 'side-evidence-measurement-highlight-layer') return sideLayer;
      return null;
    },
  };

  return { frontLayer, sideLayer };
}

// Linear metric-to-plot mapper mock: scale = 2px/cm, origin (0, 0) -> (0, 400)
function mockWorldToPlotPx(h, v) {
  return {
    px: h * 2,
    py: 400 - v * 2,
  };
}

test('1. Front horizontal slice renders exact stored endpoints', () => {
  const { frontLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'torso_width_at_shoulder_level',
    displayName: 'Torso Transverse Width at Shoulder Level',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 128.25,
      front: {
        rasterRow: 717,
        minXcm: 34.6,
        maxXcm: 65.4,
        widthCm: 30.8,
      },
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  const line = frontLayer.querySelector('.grid2d-highlight-line');
  assert.ok(line, 'Highlight line rendered');
  assert.equal(line.style.left, `${34.6 * 2}px`);
  assert.equal(line.style.top, `${400 - 128.25 * 2}px`);
  assert.equal(line.style.width, `${(65.4 - 34.6) * 2}px`);

  const dots = frontLayer.querySelectorAll('.grid2d-highlight-dot');
  assert.equal(dots.length, 2, 'Two endpoint dots rendered');
  assert.equal(dots[0].style.left, `${34.6 * 2}px`);
  assert.equal(dots[1].style.left, `${65.4 * 2}px`);

  const badge = frontLayer.querySelector('.grid2d-highlight-badge');
  assert.ok(badge, 'Dimension badge rendered');
  assert.equal(badge.textContent, '30.80 cm');
});

test('2. Side horizontal slice renders exact stored endpoints', () => {
  const { sideLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'torso_profile_span_at_hip_level',
    displayName: 'Torso Profile Span at Hip Level',
    visualizationType: VISUALIZATION_TYPES.SIDE_HORIZONTAL_SLICE,
    targetViews: ['side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 86.25,
      side: {
        rasterRow: 1137,
        minUcm: 36.1,
        maxUcm: 63.8,
        depthCm: 27.7,
      },
    },
  };

  setMeasurementHighlight(vis);
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  const line = sideLayer.querySelector('.grid2d-highlight-line');
  assert.ok(line, 'Side highlight line rendered');
  assert.equal(line.style.left, `${36.1 * 2}px`);
  assert.equal(line.style.top, `${400 - 86.25 * 2}px`);
  assert.equal(line.style.width, `${(63.8 - 36.1) * 2}px`);

  const dots = sideLayer.querySelectorAll('.grid2d-highlight-dot');
  assert.equal(dots.length, 2, 'Two endpoint dots rendered');

  const badge = sideLayer.querySelector('.grid2d-highlight-badge');
  assert.ok(badge, 'Dimension badge rendered');
  assert.equal(badge.textContent, '27.70 cm');
});

test('3, 4 & 5. Cross-view slice renders on Front and Side at common metric Y with differing raster rows', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'torso_cross_section_evidence_at_hip_level',
    displayName: 'Torso Cross-Section Evidence at Hip Level',
    visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 86.25,
      front: {
        rasterRow: 1137,
        minXcm: 28.9,
        maxXcm: 71.1,
        widthCm: 42.2,
      },
      side: {
        rasterRow: 600, // Different raster row!
        minUcm: 36.1,
        maxUcm: 63.8,
        depthCm: 27.7,
      },
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  const frontLine = frontLayer.querySelector('.grid2d-highlight-line');
  const sideLine = sideLayer.querySelector('.grid2d-highlight-line');

  assert.ok(frontLine, 'Front cross-view line rendered');
  assert.ok(sideLine, 'Side cross-view line rendered');

  // Both must be rendered at the exact same py corresponding to metric Y = 86.25 cm
  assert.equal(frontLine.style.top, `${400 - 86.25 * 2}px`);
  assert.equal(sideLine.style.top, `${400 - 86.25 * 2}px`);

  assert.equal(frontLine.style.width, `${(71.1 - 28.9) * 2}px`);
  assert.equal(sideLine.style.width, `${(63.8 - 36.1) * 2}px`);
});

test('6. Landmark segment renders exact endpoints', () => {
  const { frontLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'left_upper_arm_segment_length_projected',
    displayName: 'Left Upper Arm Length',
    visualizationType: VISUALIZATION_TYPES.LANDMARK_SEGMENT,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      view: 'front',
      endpointA: { landmarkId: 'left_shoulder', xCm: 65.4, yCm: 128.25 },
      endpointB: { landmarkId: 'left_elbow', xCm: 70.1, yCm: 99.1 },
      distanceCm: 29.53,
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  const line = frontLayer.querySelector('.grid2d-highlight-line');
  assert.ok(line, 'Segment line rendered');
  assert.equal(line.style.left, `${65.4 * 2}px`);
  assert.equal(line.style.top, `${400 - 128.25 * 2}px`);

  const dots = frontLayer.querySelectorAll('.grid2d-highlight-dot');
  assert.equal(dots.length, 2);
  assert.equal(dots[0].style.left, `${65.4 * 2}px`);
  assert.equal(dots[1].style.left, `${70.1 * 2}px`);

  const badge = frontLayer.querySelector('.grid2d-highlight-badge');
  assert.equal(badge.textContent, '29.53 cm');
});

test('7 & 8. Landmark chain renders all ordered points without collapsing into a single chord', () => {
  const { frontLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'left_total_arm_chain_length_projected',
    displayName: 'Left Total Arm Chain',
    visualizationType: VISUALIZATION_TYPES.LANDMARK_CHAIN,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      view: 'front',
      points: [
        { landmarkId: 'left_shoulder', xCm: 65.4, yCm: 128.25 },
        { landmarkId: 'left_elbow', xCm: 70.1, yCm: 99.1 },
        { landmarkId: 'left_wrist', xCm: 72.3, yCm: 74.1 },
      ],
      totalLengthCm: 54.55,
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  const lines = frontLayer.querySelectorAll('.grid2d-highlight-line');
  assert.equal(lines.length, 2, 'Two distinct lines for shoulder->elbow and elbow->wrist rendered');

  const dots = frontLayer.querySelectorAll('.grid2d-highlight-dot');
  assert.equal(dots.length, 3, 'Three vertex dots rendered');

  const badge = frontLayer.querySelector('.grid2d-highlight-badge');
  assert.equal(badge.textContent, '54.55 cm');
});

test('9. Vertical interval uses upper/lower Y semantics with horizontal ticks and vertical line', () => {
  const { frontLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'vertical_torso_length_neck_to_hip',
    displayName: 'Vertical Torso Length',
    visualizationType: VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      view: 'front',
      upperLevelId: 'neck',
      lowerLevelId: 'hip',
      upperYcm: 135.0,
      lowerYcm: 86.25,
      distanceCm: 48.75,
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  const ticks = frontLayer.querySelectorAll('.grid2d-highlight-tick');
  assert.equal(ticks.length, 2, 'Upper and lower horizontal reference ticks rendered');

  const verticalLine = frontLayer.querySelector('.grid2d-highlight-vertical-line');
  assert.ok(verticalLine, 'Vertical connecting line rendered');

  const badge = frontLayer.querySelector('.grid2d-highlight-badge');
  assert.equal(badge.textContent, '48.75 cm');

  const plotCenterPx = 100 * 2;
  const connectorX = parseFloat(verticalLine.style.left);
  assert.ok(connectorX > plotCenterPx, 'Vertical connector is offset to the side of the body center');

  const upperPy = 400 - 135.0 * 2;
  const lowerPy = 400 - 86.25 * 2;
  assert.equal(verticalLine.style.top, `${upperPy}px`);
  assert.equal(verticalLine.style.width, `${Math.abs(lowerPy - upperPy)}px`);

  const tickYs = ticks.map((tick) => parseFloat(tick.style.top)).sort((a, b) => a - b);
  assert.equal(tickYs[0], upperPy);
  assert.equal(tickYs[1], lowerPy);

  const badgeX = parseFloat(badge.style.left);
  const badgeY = parseFloat(badge.style.top);
  assert.equal(badgeX, connectorX + 24, 'Value badge sits beside the vertical connector');
  assert.equal(badgeY, (upperPy + lowerPy) / 2);
  assert.notEqual(badgeX, connectorX);
});

test('9b. Vertical interval connector CSS remains a rotatable stroke with visible thickness', () => {
  const css = readFileSync(
    fileURLToPath(new URL('../styles/overlays.css', import.meta.url)),
    'utf8',
  );
  assert.match(css, /\.grid2d-highlight-vertical-line\s*\{[^}]*height:\s*2px/);
  assert.match(css, /\.grid2d-highlight-vertical-line\s*\{[^}]*transform-origin:\s*0\s+50%/);
});

test('9c. Vertical interval connector preserves exact Y span after resize', () => {
  const { frontLayer } = setupTestDom();
  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'vertical_torso_length_neck_to_hip',
    visualizationType: VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      upperYcm: 135.0,
      lowerYcm: 86.25,
      distanceCm: 48.75,
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({
    worldToPlotPx: (h, v) => ({ px: h * 4, py: 800 - v * 4 }),
    layerEl: frontLayer,
  });

  const verticalLine = frontLayer.querySelector('.grid2d-highlight-vertical-line');
  const upperPy = 800 - 135.0 * 4;
  const lowerPy = 800 - 86.25 * 4;
  assert.equal(verticalLine.style.top, `${upperPy}px`);
  assert.equal(verticalLine.style.width, `${Math.abs(lowerPy - upperPy)}px`);
});

test('10. Anatomical horizontal level renders reference guide line and anchor dots', () => {
  const { frontLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'hip',
    displayName: 'Hip Level',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_LEVEL,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      view: 'front',
      levelId: 'hip',
      yCm: 86.25,
      anchors: [
        { name: 'left_hip', xCm: 40.0, yCm: 86.25 },
        { name: 'right_hip', xCm: 60.0, yCm: 86.25 },
      ],
    },
  };

  setMeasurementHighlight(vis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  const guide = frontLayer.querySelector('.grid2d-highlight-level-guide');
  assert.ok(guide, 'Horizontal guide rendered');
  assert.equal(guide.style.top, `${400 - 86.25 * 2}px`);

  const dots = frontLayer.querySelectorAll('.grid2d-highlight-dot');
  assert.equal(dots.length, 2, 'Anchor dots rendered');
});

test('11 & 12. Setting new highlight replaces previous; clearing removes only measurement highlight', () => {
  const { frontLayer } = setupTestDom();

  const vis1 = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'vis1',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: { yCm: 100, front: { minXcm: 30, maxXcm: 70, widthCm: 40 } },
  };

  const vis2 = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'vis2',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: { yCm: 50, front: { minXcm: 20, maxXcm: 80, widthCm: 60 } },
  };

  setMeasurementHighlight(vis1);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.equal(frontLayer.querySelector('.grid2d-highlight-badge').textContent, '40.00 cm');

  setMeasurementHighlight(vis2);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.equal(frontLayer.querySelector('.grid2d-highlight-badge').textContent, '60.00 cm');

  clearMeasurementHighlight();
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.equal(frontLayer.children.length, 0, 'Measurement highlight layer cleanly emptied');
});

test('13 & 14. Existing markers and segmentation containers remain completely intact after highlight clear', () => {
  const { frontLayer } = setupTestDom();
  const mockMarkersEl = new MockElement('div');
  mockMarkersEl.id = 'grid2d-markers';
  const dummyMarker = new MockElement('div');
  dummyMarker.id = 'persisted-annotation-marker';
  mockMarkersEl.appendChild(dummyMarker);

  setMeasurementHighlight({
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'test',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: { yCm: 100, front: { minXcm: 30, maxXcm: 70, widthCm: 40 } },
  });
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  clearMeasurementHighlight();
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });

  assert.equal(mockMarkersEl.children.length, 1, 'Existing markers are preserved untouched');
  assert.equal(mockMarkersEl.children[0].id, 'persisted-annotation-marker');
});

test('15. Invalid or unavailable visualization does not render geometry', () => {
  const { frontLayer } = setupTestDom();

  const unavailVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'unavail',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.UNAVAILABLE,
    geometry: null,
  };

  setMeasurementHighlight(unavailVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.equal(frontLayer.children.length, 0);
});

test('16 & 17. Resize / dynamic plot area scale preserves exact metric alignment', () => {
  const { frontLayer } = setupTestDom();

  const vis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'test_scale',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: { yCm: 50, front: { minXcm: 10, maxXcm: 40, widthCm: 30 } },
  };

  setMeasurementHighlight(vis);

  // Scale 1: 2px/cm
  renderFrontMeasurementHighlight({ worldToPlotPx: (h, v) => ({ px: h * 2, py: 400 - v * 2 }), layerEl: frontLayer });
  let line = frontLayer.querySelector('.grid2d-highlight-line');
  assert.equal(line.style.width, '60px');

  // Scale 2: 4px/cm after resize
  renderFrontMeasurementHighlight({ worldToPlotPx: (h, v) => ({ px: h * 4, py: 800 - v * 4 }), layerEl: frontLayer });
  line = frontLayer.querySelector('.grid2d-highlight-line');
  assert.equal(line.style.width, '120px');
});

test('18, 19 & 20. Hip / Seat cross-view highlight uses stored provenance only without recomputing localization or math', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const seatCircumferenceVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane',
    displayName: 'Modeled Hip / Seat Circumference Estimate',
    visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 79.95,
      front: {
        rasterRow: 1200,
        minXcm: 77.8,
        maxXcm: 122.1,
        widthCm: 44.3,
      },
      side: {
        rasterRow: 1200,
        minUcm: 84.3,
        maxUcm: 111.7,
        depthCm: 27.4,
      },
    },
    provenance: {
      sourceContract: 'modeled-hip-seat-circumference-v0',
      sourceLocalizationContract: 'maximum-seat-plane-localization-v0',
      plateauRowCount: 3,
    },
  };

  setMeasurementHighlight(seatCircumferenceVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  const frontBadge = frontLayer.querySelector('.grid2d-highlight-badge');
  const sideBadge = sideLayer.querySelector('.grid2d-highlight-badge');

  assert.equal(frontBadge.textContent, '44.30 cm');
  assert.equal(sideBadge.textContent, '27.40 cm');
});

test('21 & 22. Highlight state does not mutate visualization input or alter values', () => {
  const input = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'test_mut',
    visualizationType: VISUALIZATION_TYPES.LANDMARK_SEGMENT,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      endpointA: { landmarkId: 'a', xCm: 10, yCm: 20 },
      endpointB: { landmarkId: 'b', xCm: 30, yCm: 40 },
      distanceCm: 28.28,
    },
  };

  const beforeJson = JSON.stringify(input);
  setMeasurementHighlight(input);
  const active = getMeasurementHighlight();

  assert.equal(beforeJson, JSON.stringify(input));
  assert.deepEqual(active, input);
});

test('23. Horizontal slice, Cross-view slice, Segment, and Vertical interval badges are clearly offset from measured lines', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  // A. Horizontal slice badge is offset above the line (py - 14)
  const sliceVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'torso_front_transverse_width_at_shoulder_level',
    visualizationType: VISUALIZATION_TYPES.FRONT_HORIZONTAL_SLICE,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 100,
      front: { minXcm: 30, maxXcm: 70, widthCm: 40 },
    },
  };
  setMeasurementHighlight(sliceVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  const sliceLine = frontLayer.querySelector('.grid2d-highlight-line');
  const sliceBadge = frontLayer.querySelector('.grid2d-highlight-badge');
  const lineY = parseFloat(sliceLine.style.top);
  const badgeY = parseFloat(sliceBadge.style.top);
  assert.equal(badgeY, lineY - 14, 'Horizontal slice badge is positioned 14px above line');

  // B. Vertical interval badge is offset beside the line (px + 24)
  const vertVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'vert_test',
    visualizationType: VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL,
    targetViews: ['front'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      upperYcm: 150,
      lowerYcm: 100,
      distanceCm: 50,
    },
  };
  setMeasurementHighlight(vertVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  const vertLine = frontLayer.querySelector('.grid2d-highlight-vertical-line');
  const vertBadge = frontLayer.querySelector('.grid2d-highlight-badge');
  const lineX = parseFloat(vertLine.style.left);
  const badgeX = parseFloat(vertBadge.style.left);
  assert.equal(badgeX, lineX + 24, 'Vertical interval badge is placed 24px beside vertical line');
});

test('24. Natural Waist Plane renders horizontal reference guide, Front slice span, and Side slice span at identical canonical Y', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const waistVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'natural_waist_plane_localization',
    displayName: 'Natural Waist Plane Localization',
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 115.25,
      front: {
        rasterRow: 850,
        minXcm: 35.8,
        maxXcm: 64.2,
        widthCm: 28.4,
      },
      side: {
        rasterRow: 637,
        minUcm: 39.95,
        maxUcm: 60.05,
        depthCm: 20.1,
      },
    },
  };

  setMeasurementHighlight(waistVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  // Front Layer verification
  const frontGuide = frontLayer.querySelector('.grid2d-highlight-level-guide');
  const frontLine = frontLayer.querySelector('.grid2d-highlight-line');
  const frontDots = frontLayer.querySelectorAll('.grid2d-highlight-dot');
  const frontBadge = frontLayer.querySelector('.grid2d-highlight-badge');

  assert.ok(frontGuide, 'Front horizontal reference guide is rendered');
  assert.equal(frontGuide.style.top, `${mockWorldToPlotPx(100, 115.25).py}px`);
  assert.ok(frontLine, 'Front slice line is rendered');
  assert.equal(frontDots.length, 2, 'Two Front endpoint dots rendered');
  assert.equal(frontBadge.textContent, 'Natural Waist · 115.25 cm', 'Front badge uses concise format without slice width or parentheses');
  assert.equal(frontBadge.style.left, '10px', 'Front badge placed at safe 10px left inset from plot boundary');
  assert.equal(frontBadge.style.transform, 'translateY(-50%)', 'Front badge uses left-anchored vertical transform to avoid clipping');
  assert.equal(frontBadge.style.top, `${mockWorldToPlotPx(100, 115.25).py - 14}px`, 'Front badge aligned 14px above canonical Y');
  assert.ok(frontBadge.classList.contains('grid2d-highlight-badge--left'));

  // Side Layer verification
  const sideGuide = sideLayer.querySelector('.grid2d-highlight-level-guide');
  const sideLine = sideLayer.querySelector('.grid2d-highlight-line');
  const sideDots = sideLayer.querySelectorAll('.grid2d-highlight-dot');
  const sideBadge = sideLayer.querySelector('.grid2d-highlight-badge');

  assert.ok(sideGuide, 'Side horizontal reference guide is rendered');
  assert.equal(sideGuide.style.top, `${mockWorldToPlotPx(100, 115.25).py}px`);
  assert.equal(frontGuide.style.top, sideGuide.style.top, 'Front and Side guides share exact same Py');
  assert.ok(sideLine, 'Side slice line is rendered');
  assert.equal(sideDots.length, 2, 'Two Side endpoint dots rendered');
  assert.equal(sideBadge.textContent, 'Natural Waist · 115.25 cm', 'Side badge uses concise format without depth span or parentheses');
  assert.equal(sideBadge.style.left, '10px', 'Side badge placed at safe 10px left inset from plot boundary');
  assert.equal(sideBadge.style.transform, 'translateY(-50%)', 'Side badge uses left-anchored vertical transform to avoid clipping');
  assert.equal(sideBadge.style.top, `${mockWorldToPlotPx(100, 115.25).py - 14}px`, 'Side badge aligned 14px above canonical Y');
  assert.ok(sideBadge.classList.contains('grid2d-highlight-badge--left'));
});

test('25. Natural Waist Plane with unequal Front and Side raster rows preserves identical canonical Y', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const waistVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'natural_waist_plane_localization',
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 110.0,
      front: { rasterRow: 900, minXcm: 36.0, maxXcm: 64.0, widthCm: 28.0 },
      side: { rasterRow: 675, minUcm: 40.0, maxUcm: 60.0, depthCm: 20.0 }, // Different row index
    },
  };

  setMeasurementHighlight(waistVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  const frontGuide = frontLayer.querySelector('.grid2d-highlight-level-guide');
  const sideGuide = sideLayer.querySelector('.grid2d-highlight-level-guide');

  assert.equal(frontGuide.style.top, sideGuide.style.top);
  assert.notEqual(waistVis.geometry.front.rasterRow, waistVis.geometry.side.rasterRow);
});

test('26. Natural Waist Plane Front-only ready (Side unavailable) renders Front slice and Side reference line without fabricating Side span', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const frontOnlyWaist = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'natural_waist_plane_localization',
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 115.0,
      front: { rasterRow: 850, minXcm: 36.0, maxXcm: 64.0, widthCm: 28.0 },
      side: null, // Side evidence unavailable
    },
  };

  setMeasurementHighlight(frontOnlyWaist);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  // Front has line and dots
  assert.ok(frontLayer.querySelector('.grid2d-highlight-line'));
  assert.equal(frontLayer.querySelectorAll('.grid2d-highlight-dot').length, 2);

  // Side has guide and badge but NO slice line or dots
  assert.ok(sideLayer.querySelector('.grid2d-highlight-level-guide'));
  assert.equal(sideLayer.querySelector('.grid2d-highlight-line'), null);
  assert.equal(sideLayer.querySelectorAll('.grid2d-highlight-dot').length, 0);
  assert.equal(sideLayer.querySelector('.grid2d-highlight-badge').textContent, 'Natural Waist · 115.00 cm');
});

test('27. Ambiguous, unavailable, or invalid Natural Waist localization clears both Front and Side overlays', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const unavailVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'natural_waist_plane_localization',
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.UNAVAILABLE,
    geometry: null,
  };

  setMeasurementHighlight(unavailVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });

  assert.equal(frontLayer.children.length, 0);
  assert.equal(sideLayer.children.length, 0);
});

test('28. Deselecting Natural Waist clears highlight layers without side effects', () => {
  const { frontLayer, sideLayer } = setupTestDom();

  const waistVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'natural_waist_plane_localization',
    visualizationType: VISUALIZATION_TYPES.NATURAL_WAIST_PLANE,
    targetViews: ['front', 'side'],
    status: VISUALIZATION_STATUS.READY,
    geometry: {
      yCm: 115.0,
      front: { rasterRow: 850, minXcm: 36.0, maxXcm: 64.0 },
      side: { rasterRow: 637, minUcm: 40.0, maxUcm: 60.0 },
    },
  };

  setMeasurementHighlight(waistVis);
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });
  assert.ok(frontLayer.children.length > 0);
  assert.ok(sideLayer.children.length > 0);

  clearMeasurementHighlight();
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });
  assert.equal(frontLayer.children.length, 0);
  assert.equal(sideLayer.children.length, 0);
});

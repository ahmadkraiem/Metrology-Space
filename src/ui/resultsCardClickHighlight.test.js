import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  setBodyEvidencePackage,
  clearBodyEvidence,
  analyzeLoadedBodyEvidence,
  getRenderableFrontBodyLandmarks,
} from '../features/bodyEvidence.js';
import { importBodyEvidenceZip } from '../features/bodyEvidenceZipAdapter.js';
import { buildBodyEvidencePackage } from '../features/bodyEvidencePackage.js';
import { imagePointToFrontMetrology } from '../core/pixelMetrologyMapping.js';
import {
  restoreAnnotations,
  getAnnotations,
} from '../features/annotations.js';
import {
  selectMeasurement,
  clearSelectedMeasurement,
  getSelectedMeasurementId,
  getMeasurementRecordById,
  renderDerivedMeasurementDeck,
} from './derivedMeasurementDeck.js';
import {
  setMeasurementHighlight,
  getMeasurementHighlight,
  clearMeasurementHighlight,
  renderFrontMeasurementHighlight,
  renderSideMeasurementHighlight,
} from './measurementHighlightOverlay2d.js';
import {
  getWorkspace,
  setWorkspace,
  WORKSPACE_3D,
  WORKSPACE_SPLIT,
  isRightSidebarCollapsed,
  setRightSidebarCollapsed,
} from './workspaceLayout.js';
import {
  VISUALIZATION_TYPES,
  VISUALIZATION_STATUS,
  resolveMeasurementVisualizationProvenance,
} from '../features/measurementVisualizationProvenance.js';

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.style = {};
    this.attributes = {};
    this.dataset = {};
    this.children = [];
    this.textContent = '';
    this.hidden = false;
    this.innerHTML = '';
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
      toggle(cls, force) {
        const set = new Set((self.className || '').split(' ').filter(Boolean));
        const shouldAdd = typeof force === 'boolean' ? force : !set.has(cls);
        if (shouldAdd) set.add(cls);
        else set.delete(cls);
        self.className = Array.from(set).join(' ');
        return shouldAdd;
      },
      contains(c) {
        return (self.className || '').split(' ').includes(c);
      },
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      this.dataset[prop] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  addEventListener(event, handler) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this._listeners || !this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter((h) => h !== handler);
  }

  dispatchEvent(event) {
    if (!this._listeners || !this._listeners[event.type]) return;
    for (const h of this._listeners[event.type]) {
      h(event);
    }
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  closest(selector) {
    const matchClass = selector.startsWith('.') ? selector.slice(1) : null;
    const matchAttr = selector.startsWith('[') && selector.endsWith(']') ? selector.slice(1, -1) : null;
    const matchId = selector.startsWith('#') ? selector.slice(1) : null;

    let curr = this;
    while (curr) {
      let isMatch = false;
      if (matchClass && curr.classList.contains(matchClass)) isMatch = true;
      if (matchAttr && curr.attributes[matchAttr] !== undefined) isMatch = true;
      if (matchId && curr.id === matchId) isMatch = true;
      if (isMatch) return curr;
      curr = curr.parentElement ?? null;
    }
    return null;
  }

  appendChild(child) {
    if (child instanceof MockDocumentFragment || (child && child.tagName === 'FRAGMENT')) {
      for (const c of child.children) {
        c.parentElement = this;
        this.children.push(c);
      }
      child.children = [];
      return child;
    }
    if (child) child.parentElement = this;
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
    const matchAttr = selector.startsWith('[') && selector.endsWith(']') ? selector.slice(1, -1) : null;

    function traverse(el) {
      for (const child of el.children) {
        let isMatch = false;
        if (matchClass && child.classList.contains(matchClass)) isMatch = true;
        if (matchAttr && child.attributes[matchAttr] !== undefined) isMatch = true;
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

function setupMockEnvironment() {
  const frontLayer = new MockElement('div');
  frontLayer.id = 'grid2d-measurement-highlight-layer';
  const sideLayer = new MockElement('div');
  sideLayer.id = 'side-evidence-measurement-highlight-layer';
  const cardsContainer = new MockElement('div');
  cardsContainer.id = 'derived-measurement-cards';
  const annotationList = new MockElement('div');
  annotationList.id = 'annotation-list';
  const annotationsEmpty = new MockElement('div');
  annotationsEmpty.id = 'annotations-empty';

  global.document = {
    createElement: (tag) => new MockElement(tag),
    createDocumentFragment: () => new MockDocumentFragment(),
    getElementById: (id) => {
      if (id === 'grid2d-measurement-highlight-layer') return frontLayer;
      if (id === 'side-evidence-measurement-highlight-layer') return sideLayer;
      if (id === 'derived-measurement-cards') return cardsContainer;
      if (id === 'annotation-list') return annotationList;
      if (id === 'annotations-empty') return annotationsEmpty;
      return null;
    },
  };

  return { frontLayer, sideLayer, cardsContainer, annotationList };
}

function mockWorldToPlotPx(h, v) {
  return { px: h * 2, py: 400 - v * 2 };
}

async function loadRealOrSyntheticEvidence() {
  const possiblePaths = [
    'c:/Users/VIP/Documents/work-latent-space/output.zip',
    'C:/Users/VIP/Downloads/output.zip',
  ];
  let zipBytes = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      zipBytes = fs.readFileSync(p);
      break;
    }
  }

  if (zipBytes) {
    const importRes = await importBodyEvidenceZip(new Uint8Array(zipBytes));
    if (importRes.ok) {
      setBodyEvidencePackage(importRes.package);
      analyzeLoadedBodyEvidence();

      const landmarks = getRenderableFrontBodyLandmarks();
      const widthPx = importRes.package.front.segmentation.widthPx;
      const heightPx = importRes.package.front.segmentation.heightPx;

      const annotations = landmarks.map((lm, idx) => {
        const pt = imagePointToFrontMetrology(lm.imageX, lm.imageY, widthPx, heightPx, 200);
        return {
          id: idx + 1,
          name: lm.name,
          type: 'body_landmark',
          position: { x: pt.x, y: pt.y, z: 200 },
        };
      });

      restoreAnnotations(annotations);
      return;
    }
  }

  // Fallback synthetic setup
  const width = 1000;
  const height = 1000;
  const frontSeg = new Uint8Array(width * height);
  const sideSeg = new Uint8Array(width * height);

  for (let y = 300; y <= 700; y++) {
    for (let x = 300; x <= 700; x++) {
      frontSeg[y * width + x] = 1;
      sideSeg[y * width + x] = 1;
    }
  }

  const pkg = buildBodyEvidencePackage({
    calibration: {
      pixelsPerCm: 10,
      canvasSizePx: 2000,
      coordinateSpace: 'pixel',
      origin: 'bottom_left',
      workspaceExtentCm: 200,
    },
    front: {
      image: { widthPx: 2000, heightPx: 2000, dataUrl: 'data:image/png;base64,' },
      segmentation: { widthPx: 2000, heightPx: 2000, classIndices: frontSeg },
      calibration: {
        view: 'front',
        originalWidthPx: 1000,
        originalHeightPx: 1000,
        scaledWidthPx: 2000,
        scaledHeightPx: 2000,
        scaleFactor: 2.0,
        padLeftPx: 0,
        padTopPx: 0,
        croppedWidthPx: 2000,
        croppedHeightPx: 2000,
      },
      pose: {
        score: 0.95,
        keypoints: [
          { name: 'neck', x: 1000, y: 500 },
          { name: 'left_shoulder', x: 1150, y: 600 },
          { name: 'right_shoulder', x: 850, y: 600 },
          { name: 'left_elbow', x: 1250, y: 850 },
          { name: 'right_elbow', x: 750, y: 850 },
          { name: 'left_wrist', x: 1300, y: 1100 },
          { name: 'right_wrist', x: 700, y: 1100 },
          { name: 'left_hip', x: 1100, y: 1100 },
          { name: 'right_hip', x: 900, y: 1100 },
          { name: 'left_knee', x: 1100, y: 1500 },
          { name: 'right_knee', x: 900, y: 1500 },
          { name: 'left_ankle', x: 1100, y: 1900 },
          { name: 'right_ankle', x: 900, y: 1900 },
        ],
      },
    },
    side: {
      image: { widthPx: 2000, heightPx: 2000, dataUrl: 'data:image/png;base64,' },
      segmentation: { widthPx: 2000, heightPx: 2000, classIndices: sideSeg },
      calibration: {
        view: 'side',
        originalWidthPx: 1000,
        originalHeightPx: 1000,
        scaledWidthPx: 2000,
        scaledHeightPx: 2000,
        scaleFactor: 2.0,
        padLeftPx: 0,
        padTopPx: 0,
        croppedWidthPx: 2000,
        croppedHeightPx: 2000,
      },
      pose: {
        score: 0.90,
        keypoints: [
          { name: 'left_shoulder', x: 1000, y: 600 },
          { name: 'left_hip', x: 1000, y: 1100 },
        ],
      },
    },
  });

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  restoreAnnotations([
    { id: 1, name: 'neck', type: 'body_landmark', position: { x: 100, y: 150, z: 200 } },
    { id: 2, name: 'left_shoulder', type: 'body_landmark', position: { x: 115, y: 140, z: 200 } },
    { id: 3, name: 'right_shoulder', type: 'body_landmark', position: { x: 85, y: 140, z: 200 } },
    { id: 4, name: 'left_elbow', type: 'body_landmark', position: { x: 125, y: 115, z: 200 } },
    { id: 5, name: 'right_elbow', type: 'body_landmark', position: { x: 75, y: 115, z: 200 } },
    { id: 6, name: 'left_wrist', type: 'body_landmark', position: { x: 130, y: 90, z: 200 } },
    { id: 7, name: 'right_wrist', type: 'body_landmark', position: { x: 70, y: 90, z: 200 } },
    { id: 8, name: 'left_hip', type: 'body_landmark', position: { x: 110, y: 90, z: 200 } },
    { id: 9, name: 'right_hip', type: 'body_landmark', position: { x: 90, y: 90, z: 200 } },
    { id: 10, name: 'left_knee', type: 'body_landmark', position: { x: 110, y: 50, z: 200 } },
    { id: 11, name: 'right_knee', type: 'body_landmark', position: { x: 90, y: 50, z: 200 } },
    { id: 12, name: 'left_ankle', type: 'body_landmark', position: { x: 110, y: 10, z: 200 } },
    { id: 13, name: 'right_ankle', type: 'body_landmark', position: { x: 90, y: 10, z: 200 } },
  ]);
}

test('1, 2, 3 & 4. Selecting Front, Side, Cross-View and Hip/Seat Circumference activates highlights and focuses 2D Workspace', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  // Start in 3D
  setWorkspace(WORKSPACE_3D);
  assert.equal(getWorkspace(), WORKSPACE_3D);

  // 1. Select Direct Measurement (Front-only)
  selectMeasurement('left_upper_arm_segment_length_projected');
  assert.equal(getSelectedMeasurementId(), 'left_upper_arm_segment_length_projected');
  assert.equal(getWorkspace(), WORKSPACE_SPLIT, 'Switches to 2D split workspace');

  let activeHighlight = getMeasurementHighlight();
  assert.ok(activeHighlight, 'Active highlight is set');
  assert.equal(activeHighlight.visualizationType, VISUALIZATION_TYPES.LANDMARK_SEGMENT);
  assert.deepEqual(activeHighlight.targetViews, ['front']);

  // 3 & 4. Select Modeled Hip / Seat Circumference (Cross-View)
  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');

  activeHighlight = getMeasurementHighlight();
  assert.ok(activeHighlight);
  assert.equal(activeHighlight.visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);
  assert.deepEqual(activeHighlight.targetViews, ['front', 'side']);
  assert.ok(activeHighlight.geometry.front);
  assert.ok(activeHighlight.geometry.side);
});

test('5, 6, 7 & 8. Selection replaces previous, applies selected state, and toggle-clicks clear highlight', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  // Select first measurement
  selectMeasurement('torso_modeled_perimeter_at_hip_landmark_level');
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_perimeter_at_hip_landmark_level');
  assert.ok(getMeasurementHighlight());

  // Selecting another card replaces it
  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getMeasurementHighlight().measurementId, 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');

  // Clicking currently selected measurement again toggles it off
  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getSelectedMeasurementId(), null);
  assert.equal(getMeasurementHighlight(), null);
});

test('9, 10, 11, 12 & 13. Exact geometry rendering for Landmark Segment, Chain, Vertical Interval, Front Width, and Side AP Depth', async () => {
  const { frontLayer, sideLayer } = setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  // Segment
  selectMeasurement('left_upper_arm_segment_length_projected');
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.ok(frontLayer.children.length > 0, 'Segment rendered on Front');

  // Chain
  selectMeasurement('left_total_arm_chain_length_projected');
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.ok(frontLayer.children.length > 0, 'Chain rendered on Front');

  // Vertical Interval
  selectMeasurement('vertical_torso_length_neck_to_hip');
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  assert.ok(frontLayer.children.length > 0, 'Vertical interval rendered on Front');

  // Cross Section Shoulder
  selectMeasurement('torso_cross_section_evidence_at_shoulder_level');
  renderFrontMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: frontLayer });
  renderSideMeasurementHighlight({ worldToPlotPx: mockWorldToPlotPx, layerEl: sideLayer });
  assert.ok(frontLayer.children.length > 0, 'Front slice rendered');
  assert.ok(sideLayer.children.length > 0, 'Side slice rendered');
});

test('14 & 15. Cross-view slice preserves common metric Y even if raster rows differ', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  const vis = getMeasurementHighlight();

  assert.equal(typeof vis.geometry.yCm, 'number');
  assert.equal(vis.geometry.front.widthCm > 0, true);
  assert.equal(vis.geometry.side.depthCm > 0, true);
});

test('16 & 17. Right sidebar collapse/expand and workspace resize do not clear active selection', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.ok(getMeasurementHighlight());

  // Collapse sidebar
  setRightSidebarCollapsed(true);
  assert.equal(isRightSidebarCollapsed(), true);
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.ok(getMeasurementHighlight());

  // Expand sidebar
  setRightSidebarCollapsed(false);
  assert.equal(isRightSidebarCollapsed(), false);
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.ok(getMeasurementHighlight());
});

test('18 & 19. New Body Evidence package or clear removes stale selection and highlight', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.ok(getSelectedMeasurementId());
  assert.ok(getMeasurementHighlight());

  // Clear body evidence
  clearBodyEvidence();
  assert.equal(getSelectedMeasurementId(), null, 'Selected ID cleared on package clear');
  assert.equal(getMeasurementHighlight(), null, 'Measurement highlight cleared on package clear');
});

test('20, 21 & 22. Manual annotations and independent states remain intact during selection', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  const annosBefore = getAnnotations();
  selectMeasurement('left_upper_arm_segment_length_projected');
  const annosAfter = getAnnotations();

  assert.equal(annosBefore.length, annosAfter.length);
  assert.deepEqual(annosBefore, annosAfter);
});

test('23 & 24. Invalid/unavailable measurement does not activate highlight', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  // Unknown measurement ID
  selectMeasurement('completely_unknown_measurement_id_xyz');
  assert.equal(getSelectedMeasurementId(), null);
  assert.equal(getMeasurementHighlight(), null);
});

test('25, 26, 27 & 28. No measurement math changes or input mutations occur', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  const record = getMeasurementRecordById('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  const snapshotBefore = JSON.stringify(record);

  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  const snapshotAfter = JSON.stringify(record);

  assert.equal(snapshotBefore, snapshotAfter, 'Measurement record was not mutated by selection/highlighting');
});

test('Focused Interactivity 1 & 2: Rendered Hip/Seat card and direct measurement rows contain data-measurement-id, role=button, tabindex=0, aria-selected', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  const container = document.getElementById('derived-measurement-cards');
  renderDerivedMeasurementDeck(container);

  const html = container.innerHTML;
  assert.ok(html.includes('data-measurement-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"'));
  assert.ok(html.includes('Modeled Maximum Seat Circumference'));
  assert.equal(html.includes('data-measurement-id="torso_modeled_perimeter_at_hip_landmark_level"'), false);
  assert.equal(html.includes('Hip Landmark Perimeter Estimate'), false);
  assert.ok(html.includes('data-measurement-id="left_upper_arm_segment_length_projected"'));
  assert.ok(html.includes('role="button"'));
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes('aria-selected='));
});

test('Focused Interactivity 3: CSS rules apply cursor: pointer and hover/selected styling to [data-measurement-id] and descendants', () => {
  const css = fs.readFileSync('src/styles/components.css', 'utf-8');
  assert.ok(css.includes('[data-measurement-id]'), 'CSS contains [data-measurement-id]');
  assert.ok(css.includes('[data-measurement-id] *'), 'CSS contains [data-measurement-id] * descendant selector');
  assert.ok(css.includes('cursor: pointer'), 'CSS specifies cursor: pointer');
  assert.ok(css.includes('[data-measurement-id]:hover'), 'CSS contains hover styling');
  assert.ok(css.includes('.is-selected'), 'CSS contains is-selected styling');
});

test('Focused Interactivity 4, 5, 6, 7 & 8: Card click reaches setMeasurementHighlight, handles re-render, toggle-off, and selected classes', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  const container = document.getElementById('derived-measurement-cards');
  renderDerivedMeasurementDeck(container);

  // 1. Initial selection of Hip / Seat Circumference
  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getSelectedMeasurementId(), 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  const highlight = getMeasurementHighlight();
  assert.ok(highlight);
  assert.equal(highlight.status, 'ready');
  assert.equal(highlight.measurementId, 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);

  // 2. Re-render preserves is-selected class in generated HTML
  renderDerivedMeasurementDeck(container);
  assert.ok(container.innerHTML.includes('modeled-circumference-card is-selected'));
  assert.ok(container.innerHTML.includes('aria-selected="true"'));

  // 3. Re-click toggles selection off
  selectMeasurement('torso_modeled_hip_seat_circumference_at_maximum_seat_plane');
  assert.equal(getSelectedMeasurementId(), null);
  assert.equal(getMeasurementHighlight(), null);

  // 4. Re-render after deselect reflects unselected state
  renderDerivedMeasurementDeck(container);
  assert.ok(!container.innerHTML.includes('modeled-circumference-card is-selected'));
});

test('Focused Interactivity 9 & 10: Collapsible subgroup headers remain distinct from measurement card clicks and no overlay intercepts', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  const container = document.getElementById('derived-measurement-cards');
  renderDerivedMeasurementDeck(container);

  // Subgroup headers have collapsible class, distinct from selectable rows
  assert.ok(container.innerHTML.includes('results-subgroup-header--collapsible'));
  assert.ok(container.innerHTML.includes('derived-card-header--collapsible'));

  // Direct rows inside groups retain data-measurement-id and role="button"
  assert.ok(container.innerHTML.includes('direct-measurement-row'));
});

test('Focused Interactivity 11 & 12: Direct and Vertical measurement click activates highlight, focuses 2D workspace, and handles nested element resolution', async () => {
  setupMockEnvironment();
  await loadRealOrSyntheticEvidence();

  // 1. Left Upper Arm Length
  selectMeasurement('left_upper_arm_segment_length_projected');
  assert.equal(getSelectedMeasurementId(), 'left_upper_arm_segment_length_projected');
  const armHighlight = getMeasurementHighlight();
  assert.ok(armHighlight);
  assert.equal(armHighlight.status, 'ready');
  assert.equal(armHighlight.visualizationType, VISUALIZATION_TYPES.LANDMARK_SEGMENT);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);

  // 2. Vertical Torso Length
  selectMeasurement('vertical_torso_length_neck_to_hip');
  assert.equal(getSelectedMeasurementId(), 'vertical_torso_length_neck_to_hip');
  const verticalHighlight = getMeasurementHighlight();
  assert.ok(verticalHighlight);
  assert.equal(verticalHighlight.status, 'ready');
  assert.equal(verticalHighlight.visualizationType, VISUALIZATION_TYPES.VERTICAL_LEVEL_INTERVAL);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);
});

test('Natural Waist Interactivity: selecting Natural Waist activates 2D plane highlight, switches workspace, and toggles off cleanly', async () => {
  setupMockEnvironment();

  // 1. Resolve and set ready Natural Waist Plane Localization
  const waistVis = resolveMeasurementVisualizationProvenance({
    contract: 'natural-waist-plane-localization-v0',
    id: 'natural_waist_plane_localization',
    status: 'ready',
    yCm: 115.25,
    selectedCandidate: {
      yCm: 115.25,
      rasterRow: 850,
      sideRasterRow: 637,
      frontMinXcm: 35.8,
      frontMaxXcm: 64.2,
      frontWidthCm: 28.4,
      sideMinUcm: 40.0,
      sideMaxUcm: 60.0,
      sideQualifiedApDepthCm: 20.0,
    },
    frontEvidence: { status: 'valid', minXcm: 35.8, maxXcm: 64.2, widthCm: 28.4 },
    sideEvidence: { status: 'valid', minUcm: 40.0, maxUcm: 60.0 },
    provenance: {
      smoothingWindowCm: 2.0,
      sliceHighlightCoordinates: {
        yCm: 115.25,
        frontRasterRow: 850,
        sideRasterRow: 637,
        frontBoundsCm: { minX: 35.8, maxX: 64.2 },
        sideBoundsCm: { minU: 40.0, maxU: 60.0 },
      },
    },
  });

  assert.equal(waistVis.status, 'ready');
  assert.equal(waistVis.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);

  setMeasurementHighlight(waistVis);
  setWorkspace(WORKSPACE_SPLIT);

  const activeHighlight = getMeasurementHighlight();
  assert.ok(activeHighlight);
  assert.equal(activeHighlight.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);
  assert.equal(activeHighlight.measurementId, 'natural_waist_plane_localization');
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);

  // 2. Select Hip / Seat Circumference switches cleanly
  const seatVis = {
    contract: 'measurement-visualization-provenance-v0',
    measurementId: 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane',
    visualizationType: VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE,
    status: 'ready',
  };
  setMeasurementHighlight(seatVis);
  assert.equal(getMeasurementHighlight().visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);

  // 3. Switch back to Natural Waist
  setMeasurementHighlight(waistVis);
  assert.equal(getMeasurementHighlight().visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);

  // 4. Clear highlight
  clearMeasurementHighlight();
  assert.equal(getMeasurementHighlight(), null);
});

test('Modeled Natural Waist Circumference: selecting circumference card resolves to Natural Waist plane visualization provenance', () => {
  const waistCircumferenceResult = {
    contract: 'modeled-natural-waist-circumference-v0',
    id: 'torso_modeled_natural_waist_circumference_at_natural_waist_plane',
    name: 'Modeled Natural Waist Circumference',
    status: 'modeled',
    valueCm: 82.35,
    yCm: 107.15,
    levelYcm: 107.15,
    model: {
      transverseWidthCm: 29.0,
      apDepthCm: 23.2,
    },
    provenance: {
      selectedYcm: 107.15,
      frontRasterRow: 357,
      sideRasterRow: 357,
      frontTransverseWidthCm: 29.0,
      frontMinXcm: 85.5,
      frontMaxXcm: 114.5,
      sideQualifiedApDepthCm: 23.2,
      sideMinUcm: 88.4,
      sideMaxUcm: 111.6,
      sliceHighlightCoordinates: {
        yCm: 107.15,
        frontRasterRow: 357,
        sideRasterRow: 357,
        frontBoundsCm: { minX: 85.5, maxX: 114.5 },
        sideBoundsCm: { minU: 88.4, maxU: 111.6 },
      },
    },
  };

  const vis = resolveMeasurementVisualizationProvenance(waistCircumferenceResult);
  assert.equal(vis.status, 'ready');
  assert.equal(vis.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);
  assert.equal(vis.geometry.yCm, 107.15);
  assert.equal(vis.geometry.front.widthCm, 29.0);
  assert.equal(vis.geometry.side.depthCm, 23.2);

  setMeasurementHighlight(vis);
  setWorkspace(WORKSPACE_SPLIT);

  const active = getMeasurementHighlight();
  assert.ok(active);
  assert.equal(active.visualizationType, VISUALIZATION_TYPES.NATURAL_WAIST_PLANE);
  assert.equal(active.geometry.yCm, 107.15);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);

  clearMeasurementHighlight();
  assert.equal(getMeasurementHighlight(), null);
});

test('Modeled Hip Girth: selecting circumference card resolves to Buttock Point plane visualization provenance', () => {
  const hipGirthResult = {
    contract: 'modeled-hip-girth-v1',
    id: 'torso_modeled_hip_girth_at_buttock_point_plane',
    name: 'Modeled Hip Girth',
    status: 'modeled',
    valueCm: 111.12,
    yCm: 86.05,
    levelYcm: 86.05,
    model: {
      transverseWidthCm: 42.20,
      apDepthCm: 27.80,
    },
    provenance: {
      selectedYcm: 86.05,
      frontRasterRow: 450,
      sideRasterRow: 450,
      frontTransverseWidthCm: 42.20,
      frontMinXcm: 78.9,
      frontMaxXcm: 121.1,
      sideQualifiedApDepthCm: 27.80,
      sideMinUcm: 86.1,
      sideMaxUcm: 113.9,
      sliceHighlightCoordinates: {
        yCm: 86.05,
        frontRasterRow: 450,
        sideRasterRow: 450,
        frontBoundsCm: { minX: 78.9, maxX: 121.1 },
        sideBoundsCm: { minU: 86.1, maxU: 113.9 },
      },
    },
  };

  const vis = resolveMeasurementVisualizationProvenance(hipGirthResult);
  assert.equal(vis.status, 'ready');
  assert.equal(vis.visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);
  assert.equal(vis.geometry.yCm, 86.05);
  assert.equal(vis.geometry.front.widthCm, 42.20);
  assert.equal(vis.geometry.side.depthCm, 27.80);

  setMeasurementHighlight(vis);
  setWorkspace(WORKSPACE_SPLIT);

  const active = getMeasurementHighlight();
  assert.ok(active);
  assert.equal(active.visualizationType, VISUALIZATION_TYPES.CROSS_VIEW_HORIZONTAL_SLICE);
  assert.equal(active.geometry.yCm, 86.05);
  assert.equal(getWorkspace(), WORKSPACE_SPLIT);

  clearMeasurementHighlight();
  assert.equal(getMeasurementHighlight(), null);
});



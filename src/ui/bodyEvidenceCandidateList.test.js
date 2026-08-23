import test from 'node:test';
import assert from 'node:assert/strict';

import { renderEvidenceCandidateList } from './bodyEvidenceCandidateList.js';
import {
  onFrontCandidateSelect,
  onSideCandidateSelect,
  getBodyEvidencePanelTab,
} from './bodyEvidencePanel.js';
import {
  getSelectedBodyEvidenceLandmark,
  getSelectedSideEvidenceLandmark,
  clearAllBodyEvidenceSelections,
} from '../features/bodyEvidence.js';

function createContainer() {
  return { innerHTML: '' };
}

function visibleRowText(html) {
  return html
    .replace(/ title="[^"]*"/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const frontLandmark = {
  id: 'body-evidence-front-0-left_shoulder',
  name: 'left_shoulder',
  candidateType: 'core',
  view: 'front',
  score: 0.91,
  lowConfidence: false,
  spaceX: 100,
  spaceY: 150.4,
};

const sideLandmark = {
  id: 'body-evidence-side-core-0-left_hip',
  name: 'left_hip',
  candidateType: 'core',
  view: 'side',
  score: 0.88,
  lowConfidence: false,
  sideUcm: 100,
  sideYcm: 150,
};

test('Front rows show readable name, confidence, and Promoted without visible coordinates', () => {
  const container = createContainer();
  renderEvidenceCandidateList({
    container,
    landmarks: [frontLandmark],
    source: 'front',
    selectedId: frontLandmark.id,
    promotedNames: new Set(['left_shoulder']),
    onSelect() {},
  });

  const visible = visibleRowText(container.innerHTML);
  assert.match(visible, /Left Shoulder/);
  assert.match(visible, /0\.91/);
  assert.match(visible, /Promoted/);
  assert.equal(/X\s/.test(visible), false);
  assert.equal(/Y\s/.test(visible), false);
  assert.match(container.innerHTML, /title="[^"]*X 100 \/ Y 150\.4/);
  assert.match(container.innerHTML, /is-selected/);
});

test('Side Core and Side Secondary rows stay visually distinguishable', () => {
  const container = createContainer();
  const sideSecondary = {
    ...sideLandmark,
    id: 'body-evidence-side-secondary-0-left_knee',
    name: 'left_knee',
    candidateType: 'secondary',
  };

  renderEvidenceCandidateList({
    container,
    landmarks: [sideLandmark, sideSecondary],
    source: 'side',
    selectedId: sideLandmark.id,
    onSelect() {},
  });

  assert.match(
    container.innerHTML,
    /body-evidence-candidate-row--side body-evidence-candidate-row--core[\s\S]*is-selected/,
  );
  assert.match(container.innerHTML, /body-evidence-candidate-row--side body-evidence-candidate-row--secondary/);
  assert.equal(container.innerHTML.includes('body-evidence-candidate-row--front'), false);
});

test('Side rows never include a Promote badge and keep U/Y only in the title', () => {
  const container = createContainer();
  renderEvidenceCandidateList({
    container,
    landmarks: [sideLandmark],
    source: 'side',
    selectedId: null,
    promotedNames: new Set(['left_hip']),
    onSelect() {},
  });

  const visible = visibleRowText(container.innerHTML);
  assert.match(visible, /Left Hip/);
  assert.match(visible, /0\.88/);
  assert.equal(/Promoted/i.test(visible), false);
  assert.equal(/Promote/i.test(visible), false);
  assert.equal(/U\s/.test(visible), false);
  assert.equal(/Y\s/.test(visible), false);
  assert.match(container.innerHTML, /title="[^"]*U 100 \/ Y 150/);
});

function createMockDomContainer() {
  const container = {
    _innerHTML: '',
    _buttons: [],
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(val) {
      this._innerHTML = val;
      const regex = /data-body-evidence-id="([^"]+)"/g;
      this._buttons = [];
      let match;
      while ((match = regex.exec(val)) !== null) {
        const id = match[1];
        const btn = {
          dataset: { bodyEvidenceId: id },
          _listeners: {},
          addEventListener(type, fn) {
            this._listeners[type] = this._listeners[type] || [];
            this._listeners[type].push(fn);
          },
          click() {
            const handlers = this._listeners['click'] || [];
            for (const fn of handlers) {
              fn({ stopPropagation() {}, preventDefault() {} });
            }
          },
        };
        this._buttons.push(btn);
      }
    },
    querySelectorAll(selector) {
      if (selector === '[data-body-evidence-id]') {
        return this._buttons;
      }
      return [];
    },
  };
  return container;
}

test('Direct post-render click binding invokes onSelect with the exact clicked landmark', () => {
  const container = createMockDomContainer();
  const selected = [];

  const rightHipLandmark = {
    id: 'body-evidence-front-11-right_hip',
    name: 'right_hip',
    candidateType: 'core',
    view: 'front',
    score: 0.95,
    spaceX: 110,
    spaceY: 90,
  };

  renderEvidenceCandidateList({
    container,
    landmarks: [frontLandmark, rightHipLandmark],
    source: 'front',
    onSelect(landmark) {
      selected.push(landmark);
    },
  });

  const buttons = container.querySelectorAll('[data-body-evidence-id]');
  assert.equal(buttons.length, 2);

  // Click second button (Right Hip)
  buttons[1].click();
  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0], rightHipLandmark);

  // Click first button (Left Shoulder)
  buttons[0].click();
  assert.equal(selected.length, 2);
  assert.deepEqual(selected[1], frontLandmark);
});

test('Rerendering candidate list with new set rebinds listeners correctly', () => {
  const container = createMockDomContainer();
  const selected = [];

  // Initial render with empty list
  renderEvidenceCandidateList({
    container,
    landmarks: [],
    source: 'front',
    onSelect(landmark) {
      selected.push(landmark);
    },
  });
  assert.equal(container.querySelectorAll('[data-body-evidence-id]').length, 0);

  // Subsequent render after evidence analysis
  renderEvidenceCandidateList({
    container,
    landmarks: [frontLandmark],
    source: 'front',
    onSelect(landmark) {
      selected.push(landmark);
    },
  });

  const buttons = container.querySelectorAll('[data-body-evidence-id]');
  assert.equal(buttons.length, 1);
  buttons[0].click();

  assert.equal(selected.length, 1);
  assert.deepEqual(selected[0], frontLandmark);
});

test('Integration: candidate list click via onFrontCandidateSelect and onSideCandidateSelect updates selection state and tab', () => {
  clearAllBodyEvidenceSelections();

  const containerFront = createMockDomContainer();
  renderEvidenceCandidateList({
    container: containerFront,
    landmarks: [frontLandmark],
    source: 'front',
    onSelect: onFrontCandidateSelect,
  });

  const frontButtons = containerFront.querySelectorAll('[data-body-evidence-id]');
  assert.equal(frontButtons.length, 1);
  frontButtons[0].click();

  assert.equal(getSelectedBodyEvidenceLandmark()?.id, frontLandmark.id);
  assert.equal(getSelectedSideEvidenceLandmark(), null);
  assert.equal(getBodyEvidencePanelTab(), 'selection');

  const containerSide = createMockDomContainer();
  renderEvidenceCandidateList({
    container: containerSide,
    landmarks: [sideLandmark],
    source: 'side',
    onSelect: onSideCandidateSelect,
  });

  const sideButtons = containerSide.querySelectorAll('[data-body-evidence-id]');
  assert.equal(sideButtons.length, 1);
  sideButtons[0].click();

  assert.equal(getSelectedSideEvidenceLandmark()?.id, sideLandmark.id);
  assert.equal(getSelectedBodyEvidenceLandmark(), null);
  assert.equal(getBodyEvidencePanelTab(), 'selection');

  clearAllBodyEvidenceSelections();
});



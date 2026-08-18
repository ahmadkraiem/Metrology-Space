import test from 'node:test';
import assert from 'node:assert/strict';

import { renderEvidenceCandidateList } from './bodyEvidenceCandidateList.js';

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

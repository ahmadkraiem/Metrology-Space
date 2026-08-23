/**
 * Reference projection utility retained after Stage 2 Graph-tab removal.
 * Origin / Center remain a compact Diagnostics action row.
 * setupSceneGraphPanel / updateSceneGraph stay exported for existing callers.
 */

import { activateProjectionLink } from '../features/projectionLinking.js';
import { getActiveLinkedNodeId, subscribeLinkedSelection } from '../features/linkedSelection.js';
import { referenceProjectionUtilityEl } from './domRefs.js';

const ORIGIN_POSITION = { x: 0, y: 0, z: 0 };
const CENTER_POSITION = { x: 100, y: 100, z: 100 };

function formatCompactPoint(point) {
  return `(${Math.round(point.x)}, ${Math.round(point.y)}, ${Math.round(point.z)})`;
}

function createUtilityButton(label, value, linkId, onActivate) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'diagnostics-utility-btn';
  button.dataset.linkId = linkId;

  const keyEl = document.createElement('span');
  keyEl.className = 'diagnostics-utility-key';
  keyEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'diagnostics-utility-value';
  valueEl.textContent = value;

  button.append(keyEl, valueEl);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onActivate();
  });
  return button;
}

function syncReferenceProjectionLinkedActive() {
  if (!referenceProjectionUtilityEl) {
    return;
  }

  const activeId = getActiveLinkedNodeId();
  referenceProjectionUtilityEl.querySelectorAll('[data-link-id]').forEach((row) => {
    row.classList.toggle('diagnostics-utility-btn--linked-active', row.dataset.linkId === activeId);
  });
}

function renderReferenceProjectionUtility() {
  if (!referenceProjectionUtilityEl) {
    return;
  }

  const originBtn = createUtilityButton(
    'Origin',
    formatCompactPoint(ORIGIN_POSITION),
    'projection-origin',
    () => activateProjectionLink('projection-origin', {
      kind: 'origin',
      position3d: ORIGIN_POSITION,
    }),
  );
  const centerBtn = createUtilityButton(
    'Center',
    formatCompactPoint(CENTER_POSITION),
    'projection-center',
    () => activateProjectionLink('projection-center', {
      kind: 'center',
      position3d: CENTER_POSITION,
    }),
  );

  referenceProjectionUtilityEl.replaceChildren(originBtn, centerBtn);
  syncReferenceProjectionLinkedActive();
}

export function setupSceneGraphPanel() {
  subscribeLinkedSelection(syncReferenceProjectionLinkedActive);
  renderReferenceProjectionUtility();
}

export function updateSceneGraph() {
  if (!referenceProjectionUtilityEl) {
    return;
  }
  if (referenceProjectionUtilityEl.childElementCount === 0) {
    renderReferenceProjectionUtility();
    return;
  }
  syncReferenceProjectionLinkedActive();
}

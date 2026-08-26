import { formatAnnotationTypeLabel } from '../core/annotationTypes.js';
import { formatAnnotationCoords } from '../core/formatters.js';
import { formatLandmarkDisplayName } from '../core/landmarkDisplay.js';
import { activateProjectionLink } from '../features/projectionLinking.js';
import { getActiveLinkedNodeId, subscribeLinkedSelection } from '../features/linkedSelection.js';
import { annotationListEl, annotationsEmptyEl } from './domRefs.js';
import { updateSceneGraph } from './sceneGraphPanel.js';

let linkedSelectionSubscribed = false;

function syncAnnotationListLinkedActive() {
  if (!annotationListEl) {
    return;
  }

  const activeId = getActiveLinkedNodeId();
  annotationListEl.querySelectorAll('[data-link-id]').forEach((item) => {
    item.classList.toggle('annotation-item--linked-active', item.dataset.linkId === activeId);
  });
}

export function renderAnnotationList(annotations, onDelete) {
  const targetListEl = annotationListEl ?? (typeof document !== 'undefined' ? document.getElementById('annotation-list') : null);
  const targetEmptyEl = annotationsEmptyEl ?? (typeof document !== 'undefined' ? document.getElementById('annotations-empty') : null);

  if (!targetListEl) {
    return;
  }

  if (!linkedSelectionSubscribed) {
    subscribeLinkedSelection(syncAnnotationListLinkedActive);
    linkedSelectionSubscribed = true;
  }

  targetListEl.replaceChildren();

  if (annotations.length === 0) {
    if (targetEmptyEl) targetEmptyEl.hidden = false;
    updateSceneGraph();
    return;
  }

  if (targetEmptyEl) targetEmptyEl.hidden = true;

  annotations.forEach((entry) => {
    const linkId = `projection-annotation-${entry.id}`;
    const item = document.createElement('div');
    item.className = 'annotation-item annotation-item--clickable';
    item.dataset.linkId = linkId;
    item.setAttribute('role', 'button');
    item.tabIndex = 0;

    const title = document.createElement('div');
    title.className = 'annotation-item-title';
    title.textContent = formatLandmarkDisplayName(entry.name) || entry.name;
    title.title = entry.name;

    const typeRow = document.createElement('div');
    typeRow.className = 'annotation-item-type';
    typeRow.textContent = formatAnnotationTypeLabel(entry.type);

    const coords = document.createElement('div');
    coords.className = 'annotation-item-row';
    coords.textContent = formatAnnotationCoords(entry.point);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'panel-button panel-button--compact annotation-delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      onDelete(entry.id);
    });

    const activate = () => {
      activateProjectionLink(linkId, {
        kind: 'annotation',
        position3d: {
          x: entry.point.x,
          y: entry.point.y,
          z: entry.point.z,
        },
      });
    };

    item.addEventListener('click', (event) => {
      if (event.target.closest('.annotation-delete-btn')) {
        return;
      }
      activate();
    });

    item.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      if (event.target.closest('.annotation-delete-btn')) {
        return;
      }
      event.preventDefault();
      activate();
    });

    item.append(title, typeRow, coords, deleteBtn);
    if (typeof targetListEl.append === 'function') {
      targetListEl.append(item);
    } else if (typeof targetListEl.appendChild === 'function') {
      targetListEl.appendChild(item);
    }
  });

  syncAnnotationListLinkedActive();
  updateSceneGraph();
}

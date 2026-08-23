/**
 * Left Metrology Inspector — Anatomical Levels card.
 *
 * Workflow visibility is CSS-driven (`#left-sidebar[data-workflow]`).
 * This module refreshes the Anatomical Levels list from promoted canonical
 * landmarks. Package upload lives in the File menu, not a Subject card.
 */

import {
  getAnnotations,
  subscribeAnnotationsChange,
} from '../features/annotations.js';
import { computeAnatomicalLevels } from '../features/anatomicalLevels.js';
import { escapeHtml, renderBadge } from './badgeUi.js';
import { formatDistance } from '../core/formatters.js';

export function renderAnatomicalLevelsCard(containerEl) {
  if (!containerEl) {
    return;
  }

  const annotations = getAnnotations();
  const levelsResult = computeAnatomicalLevels(annotations);
  const { levels } = levelsResult;

  if (!levels || levels.length === 0) {
    containerEl.innerHTML = '<p class="session-empty-state">No anatomical levels available.</p>';
    return;
  }

  const rows = levels.map((lvl) => {
    let yDisplay = '—';
    let tone = 'muted';

    if (lvl.status === 'ready' && typeof lvl.yCm === 'number') {
      yDisplay = `Y ${formatDistance(lvl.yCm)} cm`;
      tone = 'ok';
    } else if (lvl.status === 'partial') {
      yDisplay = 'Partial';
      tone = 'warn';
    } else {
      yDisplay = 'Missing';
      tone = 'muted';
    }

    return `
      <div class="anatomy-level-row" data-level-id="${escapeHtml(lvl.id)}">
        <span class="anatomy-level-name">${escapeHtml(lvl.name)}</span>
        <div class="anatomy-level-meta">
          <span class="anatomy-level-y">${escapeHtml(yDisplay)}</span>
          ${renderBadge(lvl.status, tone)}
        </div>
      </div>
    `;
  });

  containerEl.innerHTML = `
    <div class="anatomy-levels-list">
      ${rows.join('')}
    </div>
  `;
}

export function setupLeftPanel() {
  const levelsEl = document.getElementById('anatomy-levels-list');

  const update = () => {
    renderAnatomicalLevelsCard(levelsEl);
  };

  subscribeAnnotationsChange(update);
  update();
}

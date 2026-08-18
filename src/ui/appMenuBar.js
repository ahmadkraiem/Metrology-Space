/**
 * Application menu bar — File / View / Workflow.
 * Calls shared owner actions; never imports file-input DOM refs or .click()s them.
 */

import {
  hasAnalyzedBodyEvidence,
  subscribeBodyEvidenceChange,
} from '../features/bodyEvidence.js';
import { openSceneStateFilePicker } from '../features/sceneImport.js';
import { runExportSceneStateAction } from '../features/sceneExport.js';
import {
  openFrontPoseFilePicker,
  openFrontSegFilePicker,
  openSidePoseFilePicker,
  openSideSegFilePicker,
  runDownloadBodyEvidenceAction,
} from './bodyEvidencePanel.js';
import { appMenuBarEl } from './domRefs.js';
import {
  getViewSetting,
  subscribeViewSettingChange,
  toggleViewSetting,
} from './viewControls.js';
import {
  activateAnnotateWorkflow,
  activateBodyEvidenceWorkflow,
  activateInspectMeasureWorkflow,
} from './appModeControls.js';
import {
  getInspectorWorkflow,
  subscribeInspectorWorkflowChange,
} from './inspectorWorkflow.js';

/** @type {{ measurement: object, selectionHighlight: object, referenceMarkers: object, volumeGrid: object } | null} */
let menuDeps = null;

/** @type {HTMLElement | null} */
let openMenuRoot = null;

/** @type {number} */
let activeItemIndex = -1;

function getMenuRoots() {
  if (!appMenuBarEl) {
    return [];
  }
  return Array.from(appMenuBarEl.querySelectorAll('.app-menu'));
}

function getDropdown(menuRoot) {
  return menuRoot?.querySelector('.app-menu-dropdown') ?? null;
}

function getTrigger(menuRoot) {
  return menuRoot?.querySelector('.app-menu-trigger') ?? null;
}

function getItems(menuRoot) {
  const dropdown = getDropdown(menuRoot);
  if (!dropdown) {
    return [];
  }
  return Array.from(dropdown.querySelectorAll('[role="menuitem"]'));
}

function closeAllMenus() {
  for (const root of getMenuRoots()) {
    root.classList.remove('app-menu--open');
    const trigger = getTrigger(root);
    const dropdown = getDropdown(root);
    trigger?.setAttribute('aria-expanded', 'false');
    if (dropdown) {
      dropdown.hidden = true;
    }
    for (const item of getItems(root)) {
      item.classList.remove('app-menu-item--active');
    }
  }
  openMenuRoot = null;
  activeItemIndex = -1;
}

function openMenu(menuRoot) {
  if (!menuRoot) {
    return;
  }
  closeAllMenus();
  refreshMenuState();
  menuRoot.classList.add('app-menu--open');
  const trigger = getTrigger(menuRoot);
  const dropdown = getDropdown(menuRoot);
  trigger?.setAttribute('aria-expanded', 'true');
  if (dropdown) {
    dropdown.hidden = false;
  }
  openMenuRoot = menuRoot;
  const items = getItems(menuRoot);
  activeItemIndex = items.findIndex((item) => !item.disabled);
  syncActiveItemHighlight();
}

function syncActiveItemHighlight() {
  if (!openMenuRoot) {
    return;
  }
  const items = getItems(openMenuRoot);
  items.forEach((item, index) => {
    item.classList.toggle('app-menu-item--active', index === activeItemIndex);
  });
  const active = items[activeItemIndex];
  active?.focus({ preventScroll: true });
}

function moveActiveItem(delta) {
  if (!openMenuRoot) {
    return;
  }
  const items = getItems(openMenuRoot);
  if (items.length === 0) {
    return;
  }

  let next = activeItemIndex;
  for (let step = 0; step < items.length; step += 1) {
    next = (next + delta + items.length) % items.length;
    if (!items[next].disabled) {
      activeItemIndex = next;
      syncActiveItemHighlight();
      return;
    }
  }
}

function setItemChecked(item, checked) {
  item.classList.toggle('app-menu-item--checked', Boolean(checked));
  item.setAttribute('aria-checked', checked ? 'true' : 'false');
}

function setItemDisabled(item, disabled) {
  item.disabled = Boolean(disabled);
  item.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}

function refreshMenuState() {
  if (!appMenuBarEl || !menuDeps) {
    return;
  }

  const canDownload = hasAnalyzedBodyEvidence();
  const activeWorkflow = getInspectorWorkflow();

  for (const item of appMenuBarEl.querySelectorAll('[data-command]')) {
    if (item.dataset.command === 'download-body-evidence') {
      setItemDisabled(item, !canDownload);
    }
  }

  for (const item of appMenuBarEl.querySelectorAll('[data-view-setting]')) {
    const viewId = item.dataset.viewSetting;
    if (!viewId) {
      continue;
    }
    const state = getViewSetting(viewId);
    setItemChecked(item, state.checked);
    setItemDisabled(item, state.disabled);
  }

  for (const item of appMenuBarEl.querySelectorAll('[data-workflow]')) {
    setItemChecked(item, item.dataset.workflow === activeWorkflow);
  }
}

function runCommand(command) {
  if (!menuDeps) {
    return;
  }

  switch (command) {
    case 'open-front-pose':
      openFrontPoseFilePicker();
      break;
    case 'open-side-pose':
      openSidePoseFilePicker();
      break;
    case 'open-front-seg':
      openFrontSegFilePicker();
      break;
    case 'open-side-seg':
      openSideSegFilePicker();
      break;
    case 'open-scene-state':
      openSceneStateFilePicker();
      break;
    case 'export-scene-state':
      runExportSceneStateAction();
      break;
    case 'download-body-evidence':
      runDownloadBodyEvidenceAction();
      break;
    default:
      break;
  }

  refreshMenuState();
}

function runWorkflow(workflow) {
  if (!menuDeps) {
    return;
  }
  const { measurement, selectionHighlight } = menuDeps;

  if (workflow === 'measurement') {
    activateInspectMeasureWorkflow(measurement, selectionHighlight);
  } else if (workflow === 'annotation') {
    activateAnnotateWorkflow(measurement, selectionHighlight);
  } else if (workflow === 'body-evidence') {
    activateBodyEvidenceWorkflow();
  }

  refreshMenuState();
}

function onMenuitemActivate(item) {
  if (item.disabled) {
    return;
  }

  const viewId = item.dataset.viewSetting;
  if (viewId) {
    toggleViewSetting(viewId, menuDeps);
    refreshMenuState();
    closeAllMenus();
    return;
  }

  const workflow = item.dataset.workflow;
  if (workflow) {
    runWorkflow(workflow);
    closeAllMenus();
    return;
  }

  const command = item.dataset.command;
  if (command) {
    runCommand(command);
    closeAllMenus();
  }
}

export function setupAppMenuBar({
  measurement,
  selectionHighlight,
  referenceMarkers,
  volumeGrid,
}) {
  if (!appMenuBarEl) {
    return;
  }

  menuDeps = {
    measurement,
    selectionHighlight,
    referenceMarkers,
    volumeGrid,
  };

  for (const root of getMenuRoots()) {
    const trigger = getTrigger(root);
    trigger?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (openMenuRoot === root) {
        closeAllMenus();
        return;
      }
      openMenu(root);
    });

    for (const item of getItems(root)) {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onMenuitemActivate(item);
      });
    }
  }

  document.addEventListener('pointerdown', (event) => {
    if (!openMenuRoot) {
      return;
    }
    if (appMenuBarEl.contains(event.target)) {
      return;
    }
    closeAllMenus();
  });

  document.addEventListener('keydown', (event) => {
    if (!openMenuRoot) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAllMenus();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveItem(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveItem(-1);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const items = getItems(openMenuRoot);
      const active = items[activeItemIndex];
      if (active) {
        event.preventDefault();
        onMenuitemActivate(active);
      }
    }
  });

  subscribeBodyEvidenceChange(() => {
    refreshMenuState();
  });
  subscribeViewSettingChange(() => {
    refreshMenuState();
  });
  subscribeInspectorWorkflowChange(() => {
    refreshMenuState();
  });

  refreshMenuState();
}

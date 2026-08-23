import { onResize as syncSceneResize } from '../core/scene.js';
import { refreshGrid2dNavigator, hideGrid2dHoverCoordinateTooltip } from './grid2dNavigator.js';
import { refreshSideGrid2dNavigator } from './sideGrid2dNavigator.js';
import { hideSideEvidenceTooltip } from './bodyEvidenceOverlaySide2d.js';
import { refreshBodyGraphWorkspace } from './bodyGraphWorkspace.js';
import {
  viewportEl,
  workspaceTab3dBtn,
  workspaceTabSplitBtn,
  workspaceTabBodyGraphBtn,
  workspaceContentEl,
  workspacePane3dEl,
  workspacePane2dEl,
  workspacePaneBodyGraphEl,
  workspaceSplitDividerEl,
  grid2dGridWrapperEl,
  sideEvidenceViewportEl,
  rightSidebarEl,
  rightSidebarToggleBtn,
} from './domRefs.js';

export const WORKSPACE_3D = '3d';
export const WORKSPACE_SPLIT = 'split';
export const WORKSPACE_BODY_GRAPH = 'body-graph';

const MIN_PANE_WIDTH_PX = 160;
const DIVIDER_WIDTH_PX = 6;
/** 3D share of the 2D Workspace: the Front + Side 2D area is the wider default. */
const DEFAULT_SPLIT_RATIO = 0.36;

let currentWorkspace = WORKSPACE_3D;
let splitRatio = DEFAULT_SPLIT_RATIO;
let dividerDragActive = false;
let rightSidebarCollapsed = false;

/** @type {Set<(mode: string) => void>} */
const workspaceChangeListeners = new Set();

export function subscribeWorkspaceChange(listener) {
  workspaceChangeListeners.add(listener);
  return () => workspaceChangeListeners.delete(listener);
}

function notifyWorkspaceChange() {
  for (const listener of workspaceChangeListeners) {
    listener(currentWorkspace);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateTabStates(mode) {
  const tabs = [
    { btn: workspaceTab3dBtn, mode: WORKSPACE_3D },
    { btn: workspaceTabSplitBtn, mode: WORKSPACE_SPLIT },
    { btn: workspaceTabBodyGraphBtn, mode: WORKSPACE_BODY_GRAPH },
  ];

  for (const tab of tabs) {
    if (!tab.btn) {
      continue;
    }
    const isActive = tab.mode === mode;
    tab.btn.classList.toggle('workspace-tab-btn--active', isActive);
    tab.btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}

function applySplitWidths() {
  if (currentWorkspace !== WORKSPACE_SPLIT) {
    if (workspacePane3dEl) workspacePane3dEl.style.flex = '';
    if (workspacePane2dEl) workspacePane2dEl.style.flex = '';
    return;
  }

  if (!workspaceContentEl || !workspacePane3dEl || !workspacePane2dEl) {
    return;
  }

  const totalWidth = workspaceContentEl.clientWidth;
  if (totalWidth <= 0) {
    return;
  }

  const maxThreeWidth = totalWidth - DIVIDER_WIDTH_PX - MIN_PANE_WIDTH_PX;
  const minThreeWidth = MIN_PANE_WIDTH_PX;
  let threeWidth = Math.round(totalWidth * splitRatio);
  threeWidth = clamp(threeWidth, minThreeWidth, maxThreeWidth);
  splitRatio = threeWidth / totalWidth;

  workspacePane3dEl.style.flex = `0 0 ${threeWidth}px`;
  workspacePane2dEl.style.flex = '1 1 0';
}

function handleWorkspaceResize() {
  applySplitWidths();
  syncSceneResize();

  if (currentWorkspace === WORKSPACE_SPLIT) {
    refreshGrid2dNavigator();
    refreshSideGrid2dNavigator();
  }
}

export function setWorkspace(mode) {
  if (
    mode !== WORKSPACE_3D
    && mode !== WORKSPACE_SPLIT
    && mode !== WORKSPACE_BODY_GRAPH
  ) {
    return;
  }

  currentWorkspace = mode;
  if (viewportEl) {
    viewportEl.dataset.workspaceMode = mode;
  }
  updateTabStates(mode);

  if (workspaceSplitDividerEl) {
    workspaceSplitDividerEl.hidden = mode !== WORKSPACE_SPLIT;
  }
  if (workspacePaneBodyGraphEl) {
    workspacePaneBodyGraphEl.hidden = mode !== WORKSPACE_BODY_GRAPH;
  }

  applySplitWidths();

  if (mode === WORKSPACE_SPLIT) {
    refreshGrid2dNavigator();
    refreshSideGrid2dNavigator();
  } else {
    hideGrid2dHoverCoordinateTooltip();
    hideSideEvidenceTooltip();
  }

  if (mode === WORKSPACE_BODY_GRAPH) {
    refreshBodyGraphWorkspace();
  }

  notifyWorkspaceChange();

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      handleWorkspaceResize();
    });
  } else {
    handleWorkspaceResize();
  }
}

export function getWorkspace() {
  return currentWorkspace;
}

export function isRightSidebarCollapsed() {
  return rightSidebarCollapsed;
}

export function setRightSidebarCollapsed(collapsed) {
  rightSidebarCollapsed = Boolean(collapsed);

  const appLayoutEl = typeof document !== 'undefined' ? document.getElementById('app-layout') : null;
  if (appLayoutEl) {
    appLayoutEl.classList.toggle('has-right-sidebar-collapsed', rightSidebarCollapsed);
  }

  if (rightSidebarEl) {
    rightSidebarEl.classList.toggle('is-collapsed', rightSidebarCollapsed);
    rightSidebarEl.setAttribute('aria-expanded', rightSidebarCollapsed ? 'false' : 'true');
  }

  if (rightSidebarToggleBtn) {
    rightSidebarToggleBtn.setAttribute('aria-expanded', rightSidebarCollapsed ? 'false' : 'true');
    rightSidebarToggleBtn.setAttribute(
      'aria-label',
      rightSidebarCollapsed ? 'Expand Session Data' : 'Collapse Session Data',
    );
    rightSidebarToggleBtn.setAttribute(
      'title',
      rightSidebarCollapsed ? 'Expand Session Data' : 'Collapse Session Data',
    );
    const iconEl = rightSidebarToggleBtn.querySelector('.sidebar-toggle-icon');
    if (iconEl) {
      iconEl.textContent = rightSidebarCollapsed ? '‹' : '›';
    }
  }

  handleWorkspaceResize();
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      handleWorkspaceResize();
    });
  }
}

export function toggleRightSidebar() {
  setRightSidebarCollapsed(!rightSidebarCollapsed);
}

function startDividerDrag(event) {
  if (currentWorkspace !== WORKSPACE_SPLIT || !workspaceContentEl || !workspaceSplitDividerEl) {
    return;
  }

  event.preventDefault();
  dividerDragActive = true;
  workspaceSplitDividerEl.classList.add('workspace-split-divider--dragging');
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.add('workspace-divider-dragging');
  }

  const onPointerMove = (moveEvent) => {
    if (!workspaceContentEl) return;
    const contentRect = workspaceContentEl.getBoundingClientRect();
    const totalWidth = contentRect.width;
    if (totalWidth <= 0) {
      return;
    }

    const pointerX = moveEvent.clientX - contentRect.left;
    const maxThreeWidth = totalWidth - DIVIDER_WIDTH_PX - MIN_PANE_WIDTH_PX;
    const minThreeWidth = MIN_PANE_WIDTH_PX;
    const threeWidth = clamp(pointerX, minThreeWidth, maxThreeWidth);
    splitRatio = threeWidth / totalWidth;
    applySplitWidths();
    handleWorkspaceResize();
  };

  const onPointerUp = () => {
    dividerDragActive = false;
    if (workspaceSplitDividerEl) {
      workspaceSplitDividerEl.classList.remove('workspace-split-divider--dragging');
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('workspace-divider-dragging');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }
}

export function setupWorkspaceLayout() {
  if (viewportEl) {
    viewportEl.dataset.workspaceMode = WORKSPACE_3D;
  }
  if (workspaceSplitDividerEl) {
    workspaceSplitDividerEl.hidden = true;
    workspaceSplitDividerEl.addEventListener('pointerdown', startDividerDrag);
  }
  if (workspacePaneBodyGraphEl) {
    workspacePaneBodyGraphEl.hidden = true;
  }

  if (workspaceTab3dBtn) {
    workspaceTab3dBtn.addEventListener('click', () => {
      setWorkspace(WORKSPACE_3D);
    });
  }

  if (workspaceTabSplitBtn) {
    workspaceTabSplitBtn.addEventListener('click', () => {
      setWorkspace(WORKSPACE_SPLIT);
    });
  }

  if (workspaceTabBodyGraphBtn) {
    workspaceTabBodyGraphBtn.addEventListener('click', () => {
      setWorkspace(WORKSPACE_BODY_GRAPH);
    });
  }

  if (rightSidebarToggleBtn) {
    rightSidebarToggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleRightSidebar();
    });
  }

  if (rightSidebarEl) {
    rightSidebarEl.addEventListener('click', () => {
      if (rightSidebarCollapsed) {
        setRightSidebarCollapsed(false);
      }
    });
  }

  if (typeof ResizeObserver !== 'undefined' && workspaceContentEl && grid2dGridWrapperEl) {
    const resizeObserver = new ResizeObserver(() => {
      if (dividerDragActive) {
        return;
      }
      handleWorkspaceResize();
    });

    resizeObserver.observe(workspaceContentEl);
    resizeObserver.observe(grid2dGridWrapperEl);
    if (sideEvidenceViewportEl) {
      resizeObserver.observe(sideEvidenceViewportEl);
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleWorkspaceResize);
  }
}


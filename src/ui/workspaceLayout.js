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
} from './domRefs.js';

export const WORKSPACE_3D = '3d';
export const WORKSPACE_SPLIT = 'split';
export const WORKSPACE_BODY_GRAPH = 'body-graph';

const MIN_PANE_WIDTH_PX = 200;
const DIVIDER_WIDTH_PX = 6;
/** 3D share of the 2D Workspace: the Front + Side 2D area is the wider default. */
const DEFAULT_SPLIT_RATIO = 0.36;

let currentWorkspace = WORKSPACE_3D;
let splitRatio = DEFAULT_SPLIT_RATIO;
let dividerDragActive = false;

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
    const isActive = tab.mode === mode;
    tab.btn.classList.toggle('workspace-tab-btn--active', isActive);
    tab.btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}

function applySplitWidths() {
  if (currentWorkspace !== WORKSPACE_SPLIT) {
    workspacePane3dEl.style.flex = '';
    workspacePane2dEl.style.flex = '';
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
  viewportEl.dataset.workspaceMode = mode;
  updateTabStates(mode);

  workspaceSplitDividerEl.hidden = mode !== WORKSPACE_SPLIT;
  workspacePaneBodyGraphEl.hidden = mode !== WORKSPACE_BODY_GRAPH;

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

  requestAnimationFrame(() => {
    handleWorkspaceResize();
  });
}

export function getWorkspace() {
  return currentWorkspace;
}

function startDividerDrag(event) {
  if (currentWorkspace !== WORKSPACE_SPLIT) {
    return;
  }

  event.preventDefault();
  dividerDragActive = true;
  workspaceSplitDividerEl.classList.add('workspace-split-divider--dragging');
  document.body.classList.add('workspace-divider-dragging');

  const onPointerMove = (moveEvent) => {
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
    workspaceSplitDividerEl.classList.remove('workspace-split-divider--dragging');
    document.body.classList.remove('workspace-divider-dragging');
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
  };

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
}

export function setupWorkspaceLayout() {
  viewportEl.dataset.workspaceMode = WORKSPACE_3D;
  workspaceSplitDividerEl.hidden = true;
  workspacePaneBodyGraphEl.hidden = true;

  workspaceTab3dBtn.addEventListener('click', () => {
    setWorkspace(WORKSPACE_3D);
  });

  workspaceTabSplitBtn.addEventListener('click', () => {
    setWorkspace(WORKSPACE_SPLIT);
  });

  workspaceTabBodyGraphBtn.addEventListener('click', () => {
    setWorkspace(WORKSPACE_BODY_GRAPH);
  });

  workspaceSplitDividerEl.addEventListener('pointerdown', startDividerDrag);

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

  window.addEventListener('resize', handleWorkspaceResize);
}

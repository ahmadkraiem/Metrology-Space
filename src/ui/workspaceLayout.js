import { onResize as syncSceneResize } from '../core/scene.js';
import {
  viewportEl,
  workspaceTab3dBtn,
  workspaceTabSplitBtn,
  workspaceContentEl,
  workspacePane3dEl,
  workspacePane2dEl,
  workspaceSplitDividerEl,
  grid2dGridWrapperEl,
} from './domRefs.js';
import { refreshGrid2dNavigator, hideGrid2dHoverCoordinateTooltip } from './grid2dNavigator.js';

export const WORKSPACE_3D = '3d';
export const WORKSPACE_SPLIT = 'split';

const MIN_PANE_WIDTH_PX = 200;
const DIVIDER_WIDTH_PX = 6;
const DEFAULT_SPLIT_RATIO = 0.57;

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
  }
}

export function setWorkspace(mode) {
  if (mode !== WORKSPACE_3D && mode !== WORKSPACE_SPLIT) {
    return;
  }

  currentWorkspace = mode;
  viewportEl.dataset.workspaceMode = mode;
  updateTabStates(mode);

  workspaceSplitDividerEl.hidden = mode !== WORKSPACE_SPLIT;

  applySplitWidths();

  if (mode === WORKSPACE_SPLIT) {
    refreshGrid2dNavigator();
  } else {
    hideGrid2dHoverCoordinateTooltip();
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

  workspaceTab3dBtn.addEventListener('click', () => {
    setWorkspace(WORKSPACE_3D);
  });

  workspaceTabSplitBtn.addEventListener('click', () => {
    setWorkspace(WORKSPACE_SPLIT);
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

  window.addEventListener('resize', handleWorkspaceResize);
}

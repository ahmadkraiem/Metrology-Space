import { formatCoordinate } from '../core/formatters.js';
import {
  clearSelectionBtn,
  selectedXEl,
  selectedYEl,
  selectedZEl,
} from './domRefs.js';

export function updateSelectionPanel(pointOrX, y, z) {
  let hCoord = null;
  let vCoord = null;
  let zCoord = null;
  let isSide = false;

  if (pointOrX && typeof pointOrX === 'object') {
    if (typeof pointOrX.u === 'number') {
      hCoord = pointOrX.u;
      vCoord = pointOrX.y ?? pointOrX.v;
      isSide = true;
    } else {
      hCoord = pointOrX.x ?? pointOrX.h;
      vCoord = pointOrX.y ?? pointOrX.v;
      zCoord = pointOrX.z;
    }
  } else if (typeof pointOrX === 'number') {
    hCoord = pointOrX;
    vCoord = y;
    zCoord = z;
  }

  const hasPoint = hCoord != null && vCoord != null;

  if (typeof document !== 'undefined') {
    const emptyEl = document.getElementById('annotation-selected-empty');
    const coordsBlock = document.getElementById('annotation-selected-coords');
    const coord1Label = document.getElementById('selected-coord-1-label');
    const coord2Label = document.getElementById('selected-coord-2-label');
    const zRow = document.getElementById('selected-z-row');

    if (emptyEl) {
      emptyEl.hidden = hasPoint;
    }
    if (coordsBlock) {
      coordsBlock.hidden = !hasPoint;
    }
    if (coord1Label) {
      coord1Label.textContent = isSide ? 'U' : 'X';
    }
    if (coord2Label) {
      coord2Label.textContent = 'Y';
    }
    if (zRow) {
      zRow.hidden = isSide || zCoord == null;
    }
  }

  if (selectedXEl) {
    selectedXEl.textContent = hasPoint ? formatCoordinate(hCoord) : '—';
  }
  if (selectedYEl) {
    selectedYEl.textContent = hasPoint ? formatCoordinate(vCoord) : '—';
  }
  if (selectedZEl) {
    selectedZEl.textContent = hasPoint && zCoord != null ? formatCoordinate(zCoord) : '—';
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.disabled = !hasPoint;
    clearSelectionBtn.setAttribute('aria-disabled', hasPoint ? 'false' : 'true');
  }
}


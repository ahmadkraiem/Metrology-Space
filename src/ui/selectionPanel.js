import { formatCoordinate } from '../core/formatters.js';
import {
  clearSelectionBtn,
  selectedXEl,
  selectedYEl,
  selectedZEl,
} from './domRefs.js';

export function updateSelectionPanel(pointOrX, y, z) {
  let xCoord = null;
  let yCoord = null;
  let zCoord = null;

  if (pointOrX && typeof pointOrX === 'object') {
    xCoord = pointOrX.x;
    yCoord = pointOrX.y;
    zCoord = pointOrX.z;
  } else if (typeof pointOrX === 'number') {
    xCoord = pointOrX;
    yCoord = y;
    zCoord = z;
  }

  const hasPoint = xCoord != null && yCoord != null && zCoord != null;

  if (selectedXEl) {
    selectedXEl.textContent = hasPoint ? formatCoordinate(xCoord) : '—';
  }
  if (selectedYEl) {
    selectedYEl.textContent = hasPoint ? formatCoordinate(yCoord) : '—';
  }
  if (selectedZEl) {
    selectedZEl.textContent = hasPoint ? formatCoordinate(zCoord) : '—';
  }

  if (clearSelectionBtn) {
    clearSelectionBtn.disabled = !hasPoint;
    clearSelectionBtn.setAttribute('aria-disabled', hasPoint ? 'false' : 'true');
  }
}

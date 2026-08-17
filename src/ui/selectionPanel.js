import { formatCoordinate } from '../core/formatters.js';
import { selectedXEl, selectedYEl, selectedZEl, selectionPanel } from './domRefs.js';

export function updateSelectionPanel(x, y, z) {
  selectedXEl.textContent = formatCoordinate(x);
  selectedYEl.textContent = formatCoordinate(y);
  selectedZEl.textContent = formatCoordinate(z);
  selectionPanel.hidden = false;
}

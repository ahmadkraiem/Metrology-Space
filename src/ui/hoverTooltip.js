import { HOVER_TOOLTIP_OFFSET } from '../core/constants.js';
import { formatCoordinate } from '../core/formatters.js';
import { hoverTooltipEl, viewportEl } from './domRefs.js';

export function hideHoverCoordinateTooltip() {
  hoverTooltipEl.hidden = true;
}

export function updateHoverCoordinateTooltip(point, event) {
  if (!point || !event) {
    hideHoverCoordinateTooltip();
    return;
  }

  const coordX = formatCoordinate(point.x);
  const coordY = formatCoordinate(point.y);
  const coordZ = formatCoordinate(point.z);
  hoverTooltipEl.innerHTML = `X: ${coordX} cm<br>Y: ${coordY} cm<br>Z: ${coordZ} cm`;

  const rect = viewportEl.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  hoverTooltipEl.hidden = false;
  hoverTooltipEl.style.visibility = 'hidden';
  hoverTooltipEl.style.left = '0px';
  hoverTooltipEl.style.top = '0px';

  const { offsetWidth: tooltipWidth, offsetHeight: tooltipHeight } = hoverTooltipEl;

  let left = mouseX + HOVER_TOOLTIP_OFFSET;
  let top = mouseY + HOVER_TOOLTIP_OFFSET;

  if (left + tooltipWidth > rect.width) {
    left = mouseX - tooltipWidth - HOVER_TOOLTIP_OFFSET;
  }
  if (top + tooltipHeight > rect.height) {
    top = mouseY - tooltipHeight - HOVER_TOOLTIP_OFFSET;
  }

  left = Math.max(0, Math.min(left, rect.width - tooltipWidth));
  top = Math.max(0, Math.min(top, rect.height - tooltipHeight));

  hoverTooltipEl.style.left = `${left}px`;
  hoverTooltipEl.style.top = `${top}px`;
  hoverTooltipEl.style.visibility = 'visible';
}

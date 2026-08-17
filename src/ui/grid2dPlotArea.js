/**
 * Shared 2D plot-area chrome for the workspace panes.
 *
 * Pure layout math plus axis-label markup so the Front Grid Navigator and the
 * Side Evidence plane frame a 0–200 cm domain identically. Owns no interaction,
 * no domain semantics, and no coordinate meaning: callers pass their own axis
 * keys (Front X/Y, Side U/Y) and normalized ratios.
 */

export const FIELD_INSET_PX = 3;
export const AXIS_GUTTER_LEFT_PX = 26;
export const AXIS_GUTTER_BOTTOM_PX = 22;
export const PLOT_MARGIN_TOP_PX = 14;
export const PLOT_MARGIN_RIGHT_PX = 10;

/**
 * Reserved axis gutters / margins inside a `.grid2d-field` layer, derived from
 * the framing wrapper's client box.
 *
 * @param {number} wrapperWidth
 * @param {number} wrapperHeight
 */
export function computePlotMetrics(wrapperWidth, wrapperHeight) {
  const width = Math.max(0, wrapperWidth - FIELD_INSET_PX * 2);
  const height = Math.max(0, wrapperHeight - FIELD_INSET_PX * 2);
  const padLeft = Math.min(AXIS_GUTTER_LEFT_PX, Math.max(0, width / 2 - 1));
  const padBottom = Math.min(AXIS_GUTTER_BOTTOM_PX, Math.max(0, height / 2 - 1));
  const padTop = Math.min(PLOT_MARGIN_TOP_PX, Math.max(0, height / 2 - 1));
  const padRight = Math.min(PLOT_MARGIN_RIGHT_PX, Math.max(0, width / 2 - 1));
  const plotW = Math.max(1, width - padLeft - padRight);
  const plotH = Math.max(1, height - padTop - padBottom);

  return { width, height, padLeft, padTop, padRight, padBottom, plotW, plotH };
}

/** Publishes the plot rectangle as percentages consumed by axis/plot CSS. */
export function applyPlotAreaCssVars(fieldEl, metrics) {
  const { width, height, padLeft, padTop, padBottom, plotW, plotH } = metrics;

  if (!fieldEl || width <= 0 || height <= 0) {
    return;
  }

  fieldEl.style.setProperty('--grid2d-plot-left', `${(padLeft / width) * 100}%`);
  fieldEl.style.setProperty('--grid2d-plot-top', `${(padTop / height) * 100}%`);
  fieldEl.style.setProperty('--grid2d-plot-width', `${(plotW / width) * 100}%`);
  fieldEl.style.setProperty('--grid2d-plot-height', `${(plotH / height) * 100}%`);
  fieldEl.style.setProperty('--grid2d-plot-bottom', `${((padTop + plotH) / height) * 100}%`);
  fieldEl.style.setProperty('--grid2d-gutter-left-half', `${(padLeft / 2 / width) * 100}%`);
  fieldEl.style.setProperty(
    '--grid2d-gutter-bottom-mid',
    `${((padTop + plotH + padBottom / 2) / height) * 100}%`,
  );
}

/**
 * Normalized 0–1 ratios → field-relative percent offsets (vertical ratio grows
 * upward, matching the bottom-left origin used by both panes).
 */
export function plotPercentFromRatio(metrics, ratioH, ratioV) {
  const { width, height, padLeft, padTop, plotW, plotH } = metrics;

  return {
    left: `${((padLeft + ratioH * plotW) / width) * 100}%`,
    top: `${((padTop + (1 - ratioV) * plotH) / height) * 100}%`,
  };
}

/**
 * Renders the axis chrome into a `.grid2d-axis-labels` layer: direction labels
 * inside the reserved gutters plus min/max ticks at the plot bounds.
 *
 * @param {HTMLElement|null} layerEl
 * @param {{ hAxis: string, vAxis: string, minLabel?: string, maxLabel: string }} axes
 */
export function renderPlotAxisLabels(layerEl, { hAxis, vAxis, minLabel = '0', maxLabel }) {
  if (!layerEl) {
    return;
  }

  layerEl.replaceChildren();

  const hDirLabel = document.createElement('span');
  hDirLabel.className = `grid2d-axis-dir grid2d-axis-dir--horizontal grid2d-axis-dir--${hAxis}`;
  hDirLabel.textContent = `${hAxis.toUpperCase()} →`;

  const vDirLabel = document.createElement('span');
  vDirLabel.className = `grid2d-axis-dir grid2d-axis-dir--vertical grid2d-axis-dir--${vAxis}`;
  vDirLabel.textContent = `${vAxis.toUpperCase()} ↑`;

  const hMinTick = document.createElement('span');
  hMinTick.className = 'grid2d-axis-tick grid2d-axis-tick--h-min';
  hMinTick.textContent = minLabel;

  const hMaxTick = document.createElement('span');
  hMaxTick.className = 'grid2d-axis-tick grid2d-axis-tick--h-max';
  hMaxTick.textContent = maxLabel;

  const vMinTick = document.createElement('span');
  vMinTick.className = 'grid2d-axis-tick grid2d-axis-tick--v-min';
  vMinTick.textContent = minLabel;

  const vMaxTick = document.createElement('span');
  vMaxTick.className = 'grid2d-axis-tick grid2d-axis-tick--v-max';
  vMaxTick.textContent = maxLabel;

  layerEl.append(hDirLabel, vDirLabel, hMinTick, hMaxTick, vMinTick, vMaxTick);
}

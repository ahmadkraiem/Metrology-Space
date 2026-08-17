/** Base rendered lattice diameters (px) keyed by grid step (cm). */
const LATTICE_BASE_PX_BY_STEP = {
  20: 5,
  10: 4,
  5: 3,
};

const DEFAULT_LATTICE_STEP_CM = 10;
const DEFAULT_EMPHASIS_MULTIPLIER = 1.18;
export const MEASURE_EMPHASIS_MULTIPLIER = 1.15;
const HOVER_SCALE = 1.12;

/** @type {Map<string, number>} */
let latticeStepByCoord = new Map();

/**
 * @param {{ h: number, v: number, step: number }[]} points
 */
export function updateLatticeStepLookup(points) {
  latticeStepByCoord.clear();

  for (const point of points) {
    const key = `${point.h},${point.v}`;
    const existing = latticeStepByCoord.get(key);

    if (existing === undefined || point.step < existing) {
      latticeStepByCoord.set(key, point.step);
    }
  }
}

export function getLatticeStepAtCoord(h, v, fallbackStep = DEFAULT_LATTICE_STEP_CM) {
  return latticeStepByCoord.get(`${h},${v}`) ?? fallbackStep;
}

export function getLatticeBaseSizePxForStep(step) {
  if (step <= 5) {
    return LATTICE_BASE_PX_BY_STEP[5];
  }

  if (step <= 10) {
    return LATTICE_BASE_PX_BY_STEP[10];
  }

  return LATTICE_BASE_PX_BY_STEP[20];
}

/**
 * @param {number} basePx
 * @param {{ emphasisMultiplier?: number }} [options]
 */
export function buildMarkerSizeVars(basePx, options = {}) {
  const emphasisMultiplier = options.emphasisMultiplier ?? DEFAULT_EMPHASIS_MULTIPLIER;
  const emphasisPx = Math.round(basePx * emphasisMultiplier * 10) / 10;
  const haloPx = Math.max(0.5, Math.round(basePx * 0.2 * 10) / 10);
  const glowPx = Math.max(1.5, Math.round(basePx * 0.5 * 10) / 10);
  const borderPx = Math.max(0.5, Math.round(basePx * 0.18 * 10) / 10);
  const hoverPx = Math.round(basePx * HOVER_SCALE * 10) / 10;

  return {
    '--grid2d-point-base': `${basePx}px`,
    '--grid2d-point-emphasis': `${emphasisPx}px`,
    '--grid2d-point-hover': `${hoverPx}px`,
    '--grid2d-halo': `${haloPx}px`,
    '--grid2d-glow': `${glowPx}px`,
    '--grid2d-border': `${borderPx}px`,
  };
}

/**
 * @param {HTMLElement} element
 * @param {number} basePx
 * @param {{ emphasisMultiplier?: number }} [options]
 */
export function applyMarkerSizeStyle(element, basePx, options = {}) {
  const vars = buildMarkerSizeVars(basePx, options);

  for (const [name, value] of Object.entries(vars)) {
    element.style.setProperty(name, value);
  }
}

export function applyMeasureMarkerSizeStyle(element, h, v) {
  const step = getLatticeStepAtCoord(h, v);
  const basePx = getLatticeBaseSizePxForStep(step);
  applyMarkerSizeStyle(element, basePx, { emphasisMultiplier: MEASURE_EMPHASIS_MULTIPLIER });
}

export function applyProjectionMarkerSizeStyle(element, h, v) {
  const step = getLatticeStepAtCoord(h, v);
  const basePx = getLatticeBaseSizePxForStep(step);
  applyMarkerSizeStyle(element, basePx, { emphasisMultiplier: DEFAULT_EMPHASIS_MULTIPLIER });
}

/**
 * Dense Evidence QA Module (v0)
 *
 * Pure domain module for deterministic numeric QA evaluation of dense multi-modal
 * evidence tensors (Pointmaps and Surface Normals).
 *
 * Guardrails:
 * - Read-only access: source buffers are NEVER mutated, scaled, transposed, or sorted.
 * - Pointmap Z is NOT canonical metrology Z.
 * - No U -> Z conversion.
 * - No depth inference or 3D reconstruction.
 * - No physical unit validation or declaredScale application.
 * - No coordinate-frame or normal orientation inference.
 */

import {
  DENSE_LAYOUT_CHW_PLANAR,
  DENSE_LAYOUT_HWC_INTERLEAVED,
  DENSE_LAYOUT_UNKNOWN,
} from './bodyEvidencePackage.js';

export const POINTMAP_NUMERIC_QA_CONTRACT = 'pointmap-numeric-qa-v0';

/**
 * Pure synchronous numeric QA scan over a raw dense pointmap buffer according to its layout.
 *
 * @param {ArrayLike<number>} buffer - Read-only 1D TypedArray buffer
 * @param {{
 *   widthPx: number,
 *   heightPx: number,
 *   channels?: number,
 *   denseLayout: 'HWC_INTERLEAVED'|'CHW_PLANAR'|string,
 *   model?: string|null,
 *   dtype?: string|null,
 *   declaredShape?: number[]|null,
 *   declaredUnits?: string|null,
 *   declaredScale?: number|null,
 *   view?: 'front'|'side'|string|null,
 * }} metadata
 * @returns {object} Standalone Pointmap Numeric QA Report
 */
export function evaluatePointmapBufferNumericQa(buffer, {
  widthPx,
  heightPx,
  channels = 3,
  denseLayout = DENSE_LAYOUT_HWC_INTERLEAVED,
  model = null,
  dtype = 'float32',
  declaredShape = null,
  declaredUnits = null,
  declaredScale = null,
  view = null,
} = {}) {
  const issues = [];
  const warnings = [];

  const expectedElements = (
    typeof heightPx === 'number' && typeof widthPx === 'number' && typeof channels === 'number'
  ) ? heightPx * widthPx * channels : 0;

  const actualElements = (buffer && typeof buffer.length === 'number') ? buffer.length : 0;
  const elementCountMatch = actualElements === expectedElements && expectedElements > 0;

  const validDimensions = (
    typeof heightPx === 'number' && Number.isInteger(heightPx) && heightPx > 0
    && typeof widthPx === 'number' && Number.isInteger(widthPx) && widthPx > 0
    && typeof channels === 'number' && Number.isInteger(channels) && channels >= 3
  );

  const supportedLayout = (
    denseLayout === DENSE_LAYOUT_HWC_INTERLEAVED || denseLayout === DENSE_LAYOUT_CHW_PLANAR
  );

  if (!validDimensions) {
    issues.push(`Invalid pointmap raster dimensions or channels: [${heightPx}x${widthPx}x${channels}].`);
  }
  if (!supportedLayout) {
    issues.push(`Cannot perform numeric QA on unsupported or unknown dense layout: '${denseLayout}'.`);
  }
  if (!buffer) {
    issues.push('Dense buffer is null or undefined.');
  } else if (!elementCountMatch) {
    issues.push(`Dense pointmap buffer element count (${actualElements}) does not match expected elements (${expectedElements}).`);
  }

  const isInspectable = validDimensions && supportedLayout && Boolean(buffer) && elementCountMatch;

  const structure = {
    present: true,
    model: model ?? null,
    view: view ?? null,
    widthPx: widthPx ?? null,
    heightPx: heightPx ?? null,
    channels: channels ?? null,
    dtype: dtype ?? null,
    declaredShape: declaredShape ? [...declaredShape] : null,
    normalizedShape: validDimensions ? [heightPx, widthPx, channels] : null,
    denseLayout,
    expectedElements,
    actualElements,
    elementCountMatch,
    isInspectable,
  };

  const declarations = {
    declaredUnits: declaredUnits ?? null,
    declaredScale: declaredScale ?? null,
    unitsSemantics: 'unvalidated',
    scaleSemantics: 'unvalidated',
    scaleApplicationState: 'unvalidated',
    coordinateFrame: 'unvalidated',
    canonicalAxisMeaning: 'unvalidated',
  };

  if (!isInspectable) {
    return {
      contract: POINTMAP_NUMERIC_QA_CONTRACT,
      view: view ?? null,
      availability: 'present',
      status: 'fail',
      structure,
      numeric: null,
      declarations,
      issues,
      warnings,
    };
  }

  // Pre-allocate online statistics for 3 channels
  const totalVectors = heightPx * widthPx;
  const isHwc = denseLayout === DENSE_LAYOUT_HWC_INTERLEAVED;
  const planeSize = totalVectors;

  let fullyFiniteVectors = 0;
  let partiallyNonFiniteVectors = 0;
  let fullyNonFiniteVectors = 0;

  // Channel stats
  const chFiniteCount = [0, 0, 0];
  const chNanCount = [0, 0, 0];
  const chPosInfCount = [0, 0, 0];
  const chNegInfCount = [0, 0, 0];
  const chMin = [Infinity, Infinity, Infinity];
  const chMax = [-Infinity, -Infinity, -Infinity];
  const chMean = [0, 0, 0];
  const chM2 = [0, 0, 0];

  for (let p = 0; p < totalVectors; p += 1) {
    let idx0, idx1, idx2;
    if (isHwc) {
      const base = p * channels;
      idx0 = base;
      idx1 = base + 1;
      idx2 = base + 2;
    } else {
      idx0 = p;
      idx1 = p + planeSize;
      idx2 = p + (planeSize * 2);
    }

    const v0 = buffer[idx0];
    const v1 = buffer[idx1];
    const v2 = buffer[idx2];

    const v0Finite = Number.isFinite(v0);
    const v1Finite = Number.isFinite(v1);
    const v2Finite = Number.isFinite(v2);

    const finiteTripletCount = (v0Finite ? 1 : 0) + (v1Finite ? 1 : 0) + (v2Finite ? 1 : 0);

    if (finiteTripletCount === 3) {
      fullyFiniteVectors += 1;
    } else if (finiteTripletCount === 0) {
      fullyNonFiniteVectors += 1;
    } else {
      partiallyNonFiniteVectors += 1;
    }

    // Process channel 0
    if (v0Finite) {
      const count = chFiniteCount[0] + 1;
      chFiniteCount[0] = count;
      const delta = v0 - chMean[0];
      chMean[0] += delta / count;
      const delta2 = v0 - chMean[0];
      chM2[0] += delta * delta2;
      if (v0 < chMin[0]) chMin[0] = v0;
      if (v0 > chMax[0]) chMax[0] = v0;
    } else if (Number.isNaN(v0)) {
      chNanCount[0] += 1;
    } else if (v0 === Infinity) {
      chPosInfCount[0] += 1;
    } else if (v0 === -Infinity) {
      chNegInfCount[0] += 1;
    }

    // Process channel 1
    if (v1Finite) {
      const count = chFiniteCount[1] + 1;
      chFiniteCount[1] = count;
      const delta = v1 - chMean[1];
      chMean[1] += delta / count;
      const delta2 = v1 - chMean[1];
      chM2[1] += delta * delta2;
      if (v1 < chMin[1]) chMin[1] = v1;
      if (v1 > chMax[1]) chMax[1] = v1;
    } else if (Number.isNaN(v1)) {
      chNanCount[1] += 1;
    } else if (v1 === Infinity) {
      chPosInfCount[1] += 1;
    } else if (v1 === -Infinity) {
      chNegInfCount[1] += 1;
    }

    // Process channel 2
    if (v2Finite) {
      const count = chFiniteCount[2] + 1;
      chFiniteCount[2] = count;
      const delta = v2 - chMean[2];
      chMean[2] += delta / count;
      const delta2 = v2 - chMean[2];
      chM2[2] += delta * delta2;
      if (v2 < chMin[2]) chMin[2] = v2;
      if (v2 > chMax[2]) chMax[2] = v2;
    } else if (Number.isNaN(v2)) {
      chNanCount[2] += 1;
    } else if (v2 === Infinity) {
      chPosInfCount[2] += 1;
    } else if (v2 === -Infinity) {
      chNegInfCount[2] += 1;
    }
  }

  // Aggregate channel statistics
  const channelsStats = [0, 1, 2].map((c) => {
    const fCount = chFiniteCount[c];
    const nanC = chNanCount[c];
    const posInfC = chPosInfCount[c];
    const negInfC = chNegInfCount[c];
    const nonFCount = nanC + posInfC + negInfC;
    const totalC = fCount + nonFCount;

    const variance = fCount > 0 && chM2[c] > 0 ? chM2[c] / fCount : 0;
    const std = fCount > 0 ? Math.sqrt(variance) : null;

    return {
      channelIndex: c,
      totalCount: totalC,
      finiteCount: fCount,
      nonFiniteCount: nonFCount,
      nanCount: nanC,
      positiveInfinityCount: posInfC,
      negativeInfinityCount: negInfC,
      min: fCount > 0 ? chMin[c] : null,
      max: fCount > 0 ? chMax[c] : null,
      mean: fCount > 0 ? chMean[c] : null,
      standardDeviation: std,
    };
  });

  const totalElementCount = actualElements;
  const finiteElementCount = chFiniteCount[0] + chFiniteCount[1] + chFiniteCount[2];
  const nanCount = chNanCount[0] + chNanCount[1] + chNanCount[2];
  const positiveInfinityCount = chPosInfCount[0] + chPosInfCount[1] + chPosInfCount[2];
  const negativeInfinityCount = chNegInfCount[0] + chNegInfCount[1] + chNegInfCount[2];
  const nonFiniteElementCount = nanCount + positiveInfinityCount + negativeInfinityCount;
  const finiteRatio = totalElementCount > 0 ? finiteElementCount / totalElementCount : 0;

  const numeric = {
    elements: {
      totalElementCount,
      finiteElementCount,
      nonFiniteElementCount,
      nanCount,
      positiveInfinityCount,
      negativeInfinityCount,
      finiteRatio,
    },
    channels: channelsStats,
    vectors: {
      totalVectorCount: totalVectors,
      fullyFiniteVectorCount: fullyFiniteVectors,
      partiallyNonFiniteVectorCount: partiallyNonFiniteVectors,
      fullyNonFiniteVectorCount: fullyNonFiniteVectors,
      fullyFiniteVectorRatio: totalVectors > 0 ? fullyFiniteVectors / totalVectors : 0,
    },
  };

  if (nonFiniteElementCount > 0) {
    warnings.push(
      `Pointmap contains ${nonFiniteElementCount} non-finite element(s) (${nanCount} NaN, ${positiveInfinityCount} +Inf, ${negativeInfinityCount} -Inf) across ${partiallyNonFiniteVectors + fullyNonFiniteVectors} vector(s).`,
    );
  }

  const overallStatus = nonFiniteElementCount > 0 ? 'warning' : 'pass';

  return {
    contract: POINTMAP_NUMERIC_QA_CONTRACT,
    view: view ?? null,
    availability: 'present',
    status: overallStatus,
    structure,
    numeric,
    declarations,
    issues,
    warnings,
  };
}

/**
 * Pure asynchronous numeric QA evaluation for a normalized Pointmap evidence object.
 *
 * @param {object|null} pointmap - Normalized pointmap object from package (e.g. pkg.front.pointmap)
 * @param {object} [options]
 * @param {'front'|'side'|string|null} [options.view] - Explicit view override
 * @param {boolean} [options.cache=false] - Whether to cache decoded buffer in the package accessor
 * @returns {Promise<object>} Standalone Pointmap Numeric QA Report
 */
export async function evaluatePointmapNumericQa(pointmap, {
  view = null,
  cache = false,
} = {}) {
  const resolvedView = view ?? pointmap?.view ?? null;

  if (!pointmap || typeof pointmap !== 'object' || !pointmap.present) {
    return {
      contract: POINTMAP_NUMERIC_QA_CONTRACT,
      view: resolvedView,
      availability: 'missing',
      status: 'pass',
      structure: {
        present: false,
        model: null,
        view: resolvedView,
        widthPx: null,
        heightPx: null,
        channels: null,
        dtype: null,
        declaredShape: null,
        normalizedShape: null,
        denseLayout: DENSE_LAYOUT_UNKNOWN,
        expectedElements: 0,
        actualElements: 0,
        elementCountMatch: false,
        isInspectable: false,
      },
      numeric: null,
      declarations: {
        declaredUnits: null,
        declaredScale: null,
        unitsSemantics: 'unvalidated',
        scaleSemantics: 'unvalidated',
        scaleApplicationState: 'unvalidated',
        coordinateFrame: 'unvalidated',
        canonicalAxisMeaning: 'unvalidated',
      },
      issues: [],
      warnings: [],
    };
  }

  let buffer = null;
  try {
    if (typeof pointmap.getDenseData === 'function') {
      buffer = await pointmap.getDenseData({ cache });
    }
  } catch (err) {
    return {
      contract: POINTMAP_NUMERIC_QA_CONTRACT,
      view: resolvedView,
      availability: 'present',
      status: 'fail',
      structure: {
        present: true,
        model: pointmap.model ?? null,
        view: resolvedView,
        widthPx: pointmap.widthPx ?? null,
        heightPx: pointmap.heightPx ?? null,
        channels: pointmap.channels ?? null,
        dtype: pointmap.dtype ?? null,
        declaredShape: pointmap.declaredShape ? [...pointmap.declaredShape] : null,
        normalizedShape: pointmap.shape ? [...pointmap.shape] : null,
        denseLayout: pointmap.denseLayout ?? DENSE_LAYOUT_UNKNOWN,
        expectedElements: (pointmap.heightPx && pointmap.widthPx && pointmap.channels)
          ? pointmap.heightPx * pointmap.widthPx * pointmap.channels
          : 0,
        actualElements: 0,
        elementCountMatch: false,
        isInspectable: false,
      },
      numeric: null,
      declarations: {
        declaredUnits: pointmap.declaredUnits ?? null,
        declaredScale: pointmap.declaredScale ?? null,
        unitsSemantics: 'unvalidated',
        scaleSemantics: 'unvalidated',
        scaleApplicationState: 'unvalidated',
        coordinateFrame: 'unvalidated',
        canonicalAxisMeaning: 'unvalidated',
      },
      issues: [`Failed to load dense pointmap buffer: ${err instanceof Error ? err.message : String(err)}`],
      warnings: [],
    };
  }

  return evaluatePointmapBufferNumericQa(buffer, {
    widthPx: pointmap.widthPx,
    heightPx: pointmap.heightPx,
    channels: pointmap.channels ?? 3,
    denseLayout: pointmap.denseLayout ?? DENSE_LAYOUT_UNKNOWN,
    model: pointmap.model,
    dtype: pointmap.dtype,
    declaredShape: pointmap.declaredShape,
    declaredUnits: pointmap.declaredUnits,
    declaredScale: pointmap.declaredScale,
    view: resolvedView,
  });
}

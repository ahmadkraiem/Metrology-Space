/**
 * Full Body Evidence Package Contract (v0)
 * Pure domain module defining normalized multi-modal body evidence packages
 * across Front and Side views:
 * - Image
 * - Pose / Landmarks (reusing existing pose contract)
 * - Segmentation (reusing existing segmentation contract)
 * - Pointmap XYZ (lightweight metadata + status-based QA + lazy dense decode)
 * - Surface Normals XYZ (lightweight metadata + status-based QA + lazy dense decode)
 *
 * Strict Guardrails:
 * - No Pointmap Z -> canonical Z
 * - No U -> Z
 * - No Front/Side geometry fusion
 * - No depth inference
 * - No point cloud / mesh / 3D reconstruction
 * - No circumference or volume
 * - Pointmap and normals remain non-canonical evidence
 */

import {
  classifyPoseLandmarks,
  extractPoseLandmarks,
  normalizeSegmentation,
  emptyNormalizedSegmentation,
} from './bodyEvidenceAdapter.js';

export const PACKAGE_VERSION = 'body-evidence-package-v0';
export const DEFAULT_SOURCE_FORMAT = 'body-pipeline-v0';
export const VALID_POINTMAP_DTYPES = Object.freeze(['float32', 'float64', 'float16']);

/**
 * Standard QA Status values.
 * @typedef {'pass'|'warning'|'fail'|'unvalidated'} QaStatus
 */

/**
 * Universal base64 to typed array decoder for dense tensors.
 * Supports float32, float64, uint8, int16, etc.
 * @param {string} base64Str
 * @param {string} dtype
 * @returns {Float32Array|Float64Array|Uint8Array|Int16Array|Int32Array}
 */
export function decodeDenseBufferFromBase64(base64Str, dtype = 'float32') {
  if (typeof base64Str !== 'string') {
    throw new TypeError('Expected base64 string');
  }

  let clean = base64Str.trim();
  const commaIdx = clean.indexOf(',');
  if (commaIdx !== -1 && clean.slice(0, commaIdx).includes('base64')) {
    clean = clean.slice(commaIdx + 1).trim();
  }
  clean = clean.replace(/\s+/g, '');

  if (clean.length === 0) {
    return new Float32Array(0);
  }

  let uint8Array;
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(clean, 'base64');
    uint8Array = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } else if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(clean);
    const len = binary.length;
    uint8Array = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      uint8Array[i] = binary.charCodeAt(i);
    }
  } else {
    throw new Error('No base64 decoder available');
  }

  const normalizedDtype = String(dtype || 'float32').toLowerCase().trim();

  // Create typed array view with endian alignment
  const buffer = uint8Array.buffer;
  const byteOffset = uint8Array.byteOffset;
  const byteLength = uint8Array.byteLength;

  // Make an aligned copy if byteOffset is not aligned to element size
  switch (normalizedDtype) {
    case 'float32': {
      if (byteOffset % 4 === 0) {
        return new Float32Array(buffer, byteOffset, byteLength / 4);
      }
      const aligned = new Uint8Array(byteLength);
      aligned.set(uint8Array);
      return new Float32Array(aligned.buffer, 0, byteLength / 4);
    }
    case 'float64': {
      if (byteOffset % 8 === 0) {
        return new Float64Array(buffer, byteOffset, byteLength / 8);
      }
      const aligned = new Uint8Array(byteLength);
      aligned.set(uint8Array);
      return new Float64Array(aligned.buffer, 0, byteLength / 8);
    }
    case 'uint8':
      return uint8Array;
    case 'int16': {
      if (byteOffset % 2 === 0) {
        return new Int16Array(buffer, byteOffset, byteLength / 2);
      }
      const aligned = new Uint8Array(byteLength);
      aligned.set(uint8Array);
      return new Int16Array(aligned.buffer, 0, byteLength / 2);
    }
    case 'int32': {
      if (byteOffset % 4 === 0) {
        return new Int32Array(buffer, byteOffset, byteLength / 4);
      }
      const aligned = new Uint8Array(byteLength);
      aligned.set(uint8Array);
      return new Int32Array(aligned.buffer, 0, byteLength / 4);
    }
    default:
      return uint8Array;
  }
}

/**
 * Normalizes input image metadata.
 * @param {object|null} rawImage
 * @param {{ expectedView?: 'front'|'side' }} [options]
 * @returns {object}
 */
export function normalizeImageEvidence(rawImage, { expectedView } = {}) {
  if (!rawImage || typeof rawImage !== 'object') {
    return {
      present: false,
      filename: null,
      format: null,
      widthPx: null,
      heightPx: null,
      status: 'missing',
      qa: {
        status: 'pass',
        issues: [],
        warnings: [],
      },
    };
  }

  const filename = typeof rawImage.filename === 'string' ? rawImage.filename.trim() : null;
  let format = typeof rawImage.format === 'string' ? rawImage.format.toLowerCase().trim() : null;
  if (!format && filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
      format = ext === 'jpeg' ? 'jpg' : ext;
    }
  }

  const widthPx = typeof rawImage.widthPx === 'number' && Number.isInteger(rawImage.widthPx) && rawImage.widthPx > 0
    ? rawImage.widthPx
    : (typeof rawImage.width === 'number' && Number.isInteger(rawImage.width) && rawImage.width > 0 ? rawImage.width : null);

  const heightPx = typeof rawImage.heightPx === 'number' && Number.isInteger(rawImage.heightPx) && rawImage.heightPx > 0
    ? rawImage.heightPx
    : (typeof rawImage.height === 'number' && Number.isInteger(rawImage.height) && rawImage.height > 0 ? rawImage.height : null);

  const issues = [];
  const warnings = [];

  if (rawImage.view) {
    const declaredView = String(rawImage.view).toLowerCase().trim();
    if (expectedView && declaredView !== expectedView) {
      issues.push(`Image view mismatch: expected '${expectedView}', got '${declaredView}'.`);
    }
  }

  const status = issues.length > 0 ? 'fail' : 'pass';

  return {
    present: true,
    filename,
    format,
    widthPx,
    heightPx,
    status: 'present',
    qa: {
      status,
      issues,
      warnings,
    },
  };
}

/**
 * Normalizes a raw Pointmap artifact into lightweight metadata and status-based QA,
 * with lazy on-demand dense tensor decoding.
 *
 * @param {object|null} rawPointmap
 * @param {{ expectedView?: 'front'|'side', expectedWidthPx?: number|null, expectedHeightPx?: number|null }} [options]
 * @returns {object}
 */
export function normalizePointmapEvidence(rawPointmap, {
  expectedView,
  expectedWidthPx = null,
  expectedHeightPx = null,
} = {}) {
  if (!rawPointmap || typeof rawPointmap !== 'object') {
    return {
      present: false,
      model: null,
      view: expectedView ?? null,
      channels: 3,
      shape: null,
      widthPx: null,
      heightPx: null,
      dtype: null,
      declaredUnits: null,
      declaredScale: null,
      coordinateFrame: 'unvalidated',
      scaleSemantics: 'unvalidated',
      canonicalAxisMeaning: 'unvalidated',
      qa: {
        status: 'pass',
        schemaCheck: { status: 'pass', issues: [] },
        shapeCheck: { status: 'pass', issues: [] },
        dtypeCheck: { status: 'pass', issues: [] },
        numericValues: {
          status: 'unvalidated',
          validationMode: 'deferred',
          note: 'Full dense numeric QA (NaN/Infinity scan, distribution, magnitude) deferred to Pointmap/Normals contract milestone.',
        },
        viewMatch: { status: 'pass', issues: [] },
        rasterCompatibility: { status: 'pass', issues: [] },
        coordinateFrame: { status: 'unvalidated', note: 'Pointmap coordinate frame unvalidated by REVacity v0.' },
        scaleSemantics: { status: 'unvalidated', note: 'Pointmap scale semantics unvalidated by REVacity v0.' },
        canonicalAxisMeaning: { status: 'unvalidated', note: 'Pointmap canonical axis meaning unvalidated by REVacity v0.' },
        issues: [],
        warnings: [],
      },
      getDenseData: async () => null,
    };
  }

  const issues = [];
  const warnings = [];

  // Model
  const rawModel = rawPointmap.model ?? rawPointmap.model_name ?? null;
  const model = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : null;

  // View check
  const rawView = typeof rawPointmap.view === 'string' && rawPointmap.view.trim() ? rawPointmap.view.trim().toLowerCase() : null;
  const expectedViewNormalized = expectedView ? expectedView.toLowerCase().trim() : null;

  let viewMatchStatus = 'pass';
  if (rawView && expectedViewNormalized && rawView !== expectedViewNormalized) {
    viewMatchStatus = 'fail';
    issues.push(`Pointmap view mismatch: expected '${expectedViewNormalized}', got '${rawView}'.`);
  } else if (!rawView && expectedViewNormalized) {
    warnings.push(`Pointmap payload does not declare explicit view; assumed '${expectedViewNormalized}'.`);
  }
  const view = rawView ?? expectedViewNormalized ?? null;

  // Shape validation
  const shapeData = rawPointmap.shape
    ?? rawPointmap.data?.shape
    ?? rawPointmap.pointmap?.shape
    ?? null;

  let validShape = false;
  let shape = null;
  let heightPx = null;
  let widthPx = null;
  let channels = 3;
  let expectedElements = 0;

  if (Array.isArray(shapeData) && shapeData.length >= 2) {
    const is3d = shapeData.length === 3;
    if (is3d) {
      if (shapeData[2] === 3) {
        // [H, W, 3]
        heightPx = shapeData[0];
        widthPx = shapeData[1];
        channels = shapeData[2];
      } else if (shapeData[0] === 3) {
        // [3, H, W]
        channels = shapeData[0];
        heightPx = shapeData[1];
        widthPx = shapeData[2];
      } else {
        heightPx = shapeData[0];
        widthPx = shapeData[1];
        channels = shapeData[2];
      }
    } else {
      // [H, W] with implicit channels = 3
      heightPx = shapeData[0];
      widthPx = shapeData[1];
      channels = 3;
    }

    if (
      typeof heightPx === 'number' && Number.isInteger(heightPx) && heightPx > 0
      && typeof widthPx === 'number' && Number.isInteger(widthPx) && widthPx > 0
    ) {
      validShape = true;
      shape = is3d ? [heightPx, widthPx, channels] : [heightPx, widthPx];
      expectedElements = heightPx * widthPx * (typeof channels === 'number' ? channels : 3);
    } else {
      issues.push(`Invalid pointmap dimensions: ${JSON.stringify(shapeData)}.`);
    }
  } else {
    issues.push(`Pointmap missing or invalid shape: ${JSON.stringify(shapeData)}.`);
  }

  // Dtype validation
  const rawDtype = rawPointmap.dtype
    ?? rawPointmap.data?.dtype
    ?? rawPointmap.pointmap?.dtype
    ?? 'float32';
  const dtype = typeof rawDtype === 'string' ? rawDtype.trim().toLowerCase() : 'float32';
  let dtypeStatus = 'pass';
  if (!VALID_POINTMAP_DTYPES.includes(dtype)) {
    warnings.push(`Pointmap declared non-standard dtype '${dtype}'; expected float32/float64.`);
  }

  // Declared units and scale
  const declaredUnits = rawPointmap.units
    ?? rawPointmap.declaredUnits
    ?? rawPointmap.data?.units
    ?? rawPointmap.data?.declaredUnits
    ?? null;
  const rawScale = rawPointmap.scale
    ?? rawPointmap.declaredScale
    ?? rawPointmap.data?.scale
    ?? rawPointmap.data?.declaredScale
    ?? null;
  const declaredScale = typeof rawScale === 'number' && Number.isFinite(rawScale) ? rawScale : null;

  // Same-view raster compatibility
  let rasterCompatStatus = 'pass';
  if (expectedWidthPx != null && expectedHeightPx != null && widthPx != null && heightPx != null) {
    if (widthPx !== expectedWidthPx || heightPx !== expectedHeightPx) {
      rasterCompatStatus = 'fail';
      issues.push(`Pointmap shape [${heightPx}x${widthPx}] does not match view raster dimensions [${expectedHeightPx}x${expectedWidthPx}].`);
    }
  }

  // Lazy accessor for dense data
  const base64Payload = typeof rawPointmap.base64 === 'string'
    ? rawPointmap.base64
    : (typeof rawPointmap.data?.base64 === 'string'
      ? rawPointmap.data.base64
      : (typeof rawPointmap.pointmap?.base64 === 'string' ? rawPointmap.pointmap.base64 : null));

  const directLoader = typeof rawPointmap.loadDenseBuffer === 'function'
    ? rawPointmap.loadDenseBuffer
    : null;

  let cachedDense = null;
  const getDenseData = async ({ cache = false } = {}) => {
    if (cachedDense) {
      return cachedDense;
    }
    let decoded = null;
    if (directLoader) {
      const raw = await directLoader();
      if (raw instanceof Float32Array || raw instanceof Float64Array) {
        decoded = raw;
      } else if (raw instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw))) {
        if (raw.length > 0 && raw[0] === 0x7B) { // '{' character indicating JSON
          try {
            const text = new TextDecoder('utf-8').decode(raw);
            const parsed = JSON.parse(text);
            const b64 = parsed.base64 ?? parsed.data?.base64 ?? parsed.pointmap?.base64 ?? parsed.normals?.base64 ?? null;
            if (b64) {
              decoded = decodeDenseBufferFromBase64(b64, dtype);
            }
          } catch (e) {
            console.warn('[REVacity] Failed to lazily decode JSON dense buffer:', e);
          }
        } else {
          decoded = decodeDenseBufferFromBase64(
            typeof Buffer !== 'undefined' ? Buffer.from(raw).toString('base64') : String(raw),
            dtype,
          );
        }
      }
    } else if (base64Payload) {
      decoded = decodeDenseBufferFromBase64(base64Payload, dtype);
    }
    if (cache && decoded) {
      cachedDense = decoded;
    }
    return decoded;
  };

  const overallStatus = issues.length > 0 ? 'fail' : (warnings.length > 0 ? 'warning' : 'pass');

  return {
    present: true,
    model,
    view,
    channels,
    shape,
    widthPx,
    heightPx,
    dtype,
    declaredUnits,
    declaredScale,
    coordinateFrame: 'unvalidated',
    scaleSemantics: 'unvalidated',
    canonicalAxisMeaning: 'unvalidated',
    qa: {
      status: overallStatus,
      schemaCheck: { status: 'pass', issues: [] },
      shapeCheck: { status: validShape ? 'pass' : 'fail', shape, expectedElements },
      dtypeCheck: { status: dtypeStatus, dtype },
      numericValues: {
        status: 'unvalidated',
        validationMode: 'deferred',
        note: 'Full dense numeric QA (NaN/Infinity scan, distribution, magnitude) deferred to Pointmap/Normals contract milestone.',
      },
      viewMatch: { status: viewMatchStatus, declaredView: rawView, expectedView },
      rasterCompatibility: { status: rasterCompatStatus, issues: issues.filter((i) => i.includes('raster dimensions')) },
      coordinateFrame: { status: 'unvalidated', note: 'Pointmap coordinate frame unvalidated by REVacity v0.' },
      scaleSemantics: { status: 'unvalidated', note: 'Pointmap scale semantics unvalidated by REVacity v0.' },
      canonicalAxisMeaning: { status: 'unvalidated', note: 'Pointmap canonical axis meaning unvalidated by REVacity v0.' },
      issues,
      warnings,
    },
    getDenseData,
  };
}

/**
 * Normalizes a raw Surface Normals artifact into lightweight metadata and status-based QA,
 * with lazy on-demand dense tensor decoding.
 *
 * @param {object|null} rawNormals
 * @param {{ expectedView?: 'front'|'side', expectedWidthPx?: number|null, expectedHeightPx?: number|null }} [options]
 * @returns {object}
 */
export function normalizeNormalsEvidence(rawNormals, {
  expectedView,
  expectedWidthPx = null,
  expectedHeightPx = null,
} = {}) {
  if (!rawNormals || typeof rawNormals !== 'object') {
    return {
      present: false,
      model: null,
      view: expectedView ?? null,
      channels: 3,
      shape: null,
      widthPx: null,
      heightPx: null,
      dtype: null,
      declaredRange: null,
      coordinateFrame: 'unvalidated',
      orientationSemantics: 'unvalidated',
      qa: {
        status: 'pass',
        schemaCheck: { status: 'pass', issues: [] },
        shapeCheck: { status: 'pass', issues: [] },
        dtypeCheck: { status: 'pass', issues: [] },
        numericValues: {
          status: 'unvalidated',
          validationMode: 'deferred',
          note: 'Full dense numeric QA (NaN/Infinity scan, distribution, magnitude) deferred to Pointmap/Normals contract milestone.',
        },
        viewMatch: { status: 'pass', issues: [] },
        rasterCompatibility: { status: 'pass', issues: [] },
        coordinateFrame: { status: 'unvalidated', note: 'Normal coordinate frame unvalidated by REVacity v0.' },
        orientationSemantics: { status: 'unvalidated', note: 'Normal orientation semantics unvalidated by REVacity v0.' },
        issues: [],
        warnings: [],
      },
      getDenseData: async () => null,
    };
  }

  const issues = [];
  const warnings = [];

  // Model
  const rawModel = rawNormals.model ?? rawNormals.model_name ?? null;
  const model = typeof rawModel === 'string' && rawModel.trim() ? rawModel.trim() : null;

  // View check
  const rawView = typeof rawNormals.view === 'string' && rawNormals.view.trim() ? rawNormals.view.trim().toLowerCase() : null;
  const expectedViewNormalized = expectedView ? expectedView.toLowerCase().trim() : null;

  let viewMatchStatus = 'pass';
  if (rawView && expectedViewNormalized && rawView !== expectedViewNormalized) {
    viewMatchStatus = 'fail';
    issues.push(`Surface normals view mismatch: expected '${expectedViewNormalized}', got '${rawView}'.`);
  } else if (!rawView && expectedViewNormalized) {
    warnings.push(`Surface normals payload does not declare explicit view; assumed '${expectedViewNormalized}'.`);
  }
  const view = rawView ?? expectedViewNormalized ?? null;

  // Shape validation
  const shapeData = rawNormals.shape
    ?? rawNormals.data?.shape
    ?? rawNormals.normals?.shape
    ?? null;

  let validShape = false;
  let shape = null;
  let heightPx = null;
  let widthPx = null;
  let channels = 3;
  let expectedElements = 0;

  if (Array.isArray(shapeData) && shapeData.length >= 2) {
    const is3d = shapeData.length === 3;
    if (is3d) {
      if (shapeData[2] === 3) {
        heightPx = shapeData[0];
        widthPx = shapeData[1];
        channels = shapeData[2];
      } else if (shapeData[0] === 3) {
        channels = shapeData[0];
        heightPx = shapeData[1];
        widthPx = shapeData[2];
      } else {
        heightPx = shapeData[0];
        widthPx = shapeData[1];
        channels = shapeData[2];
      }
    } else {
      heightPx = shapeData[0];
      widthPx = shapeData[1];
      channels = 3;
    }

    if (
      typeof heightPx === 'number' && Number.isInteger(heightPx) && heightPx > 0
      && typeof widthPx === 'number' && Number.isInteger(widthPx) && widthPx > 0
    ) {
      validShape = true;
      shape = is3d ? [heightPx, widthPx, channels] : [heightPx, widthPx];
      expectedElements = heightPx * widthPx * (typeof channels === 'number' ? channels : 3);
    } else {
      issues.push(`Invalid surface normals dimensions: ${JSON.stringify(shapeData)}.`);
    }
  } else {
    issues.push(`Surface normals missing or invalid shape: ${JSON.stringify(shapeData)}.`);
  }

  // Dtype validation
  const rawDtype = rawNormals.dtype
    ?? rawNormals.data?.dtype
    ?? rawNormals.normals?.dtype
    ?? 'float32';
  const dtype = typeof rawDtype === 'string' ? rawDtype.trim().toLowerCase() : 'float32';

  // Declared range
  let declaredRange = null;
  const rangeData = rawNormals.range ?? rawNormals.declaredRange ?? null;
  if (Array.isArray(rangeData) && rangeData.length === 2) {
    declaredRange = [Number(rangeData[0]), Number(rangeData[1])];
  } else if (dtype === 'uint8') {
    declaredRange = [0, 255];
  } else {
    declaredRange = [-1, 1];
  }

  // Same-view raster compatibility
  let rasterCompatStatus = 'pass';
  if (expectedWidthPx != null && expectedHeightPx != null && widthPx != null && heightPx != null) {
    if (widthPx !== expectedWidthPx || heightPx !== expectedHeightPx) {
      rasterCompatStatus = 'fail';
      issues.push(`Surface normals shape [${heightPx}x${widthPx}] does not match view raster dimensions [${expectedHeightPx}x${expectedWidthPx}].`);
    }
  }

  // Lazy accessor for dense data
  const base64Payload = typeof rawNormals.base64 === 'string'
    ? rawNormals.base64
    : (typeof rawNormals.data?.base64 === 'string'
      ? rawNormals.data.base64
      : (typeof rawNormals.normals?.base64 === 'string' ? rawNormals.normals.base64 : null));

  const directLoader = typeof rawNormals.loadDenseBuffer === 'function'
    ? rawNormals.loadDenseBuffer
    : null;

  let cachedDense = null;
  const getDenseData = async ({ cache = false } = {}) => {
    if (cachedDense) {
      return cachedDense;
    }
    let decoded = null;
    if (directLoader) {
      const raw = await directLoader();
      if (raw instanceof Float32Array || raw instanceof Uint8Array) {
        decoded = raw;
      } else if (raw instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw))) {
        if (raw.length > 0 && raw[0] === 0x7B) { // '{' JSON character
          try {
            const text = new TextDecoder('utf-8').decode(raw);
            const parsed = JSON.parse(text);
            const b64 = parsed.base64 ?? parsed.data?.base64 ?? parsed.normals?.base64 ?? parsed.pointmap?.base64 ?? null;
            if (b64) {
              decoded = decodeDenseBufferFromBase64(b64, dtype);
            }
          } catch (e) {
            console.warn('[REVacity] Failed to lazily decode JSON dense buffer:', e);
          }
        } else {
          decoded = decodeDenseBufferFromBase64(
            typeof Buffer !== 'undefined' ? Buffer.from(raw).toString('base64') : String(raw),
            dtype,
          );
        }
      }
    } else if (base64Payload) {
      decoded = decodeDenseBufferFromBase64(base64Payload, dtype);
    }
    if (cache && decoded) {
      cachedDense = decoded;
    }
    return decoded;
  };

  const overallStatus = issues.length > 0 ? 'fail' : (warnings.length > 0 ? 'warning' : 'pass');

  return {
    present: true,
    model,
    view,
    channels,
    shape,
    widthPx,
    heightPx,
    dtype,
    declaredRange,
    coordinateFrame: 'unvalidated',
    orientationSemantics: 'unvalidated',
    qa: {
      status: overallStatus,
      schemaCheck: { status: 'pass', issues: [] },
      shapeCheck: { status: validShape ? 'pass' : 'fail', shape, expectedElements },
      dtypeCheck: { status: 'pass', dtype },
      numericValues: {
        status: 'unvalidated',
        validationMode: 'deferred',
        note: 'Full dense numeric QA (NaN/Infinity scan, distribution, magnitude) deferred to Pointmap/Normals contract milestone.',
      },
      viewMatch: { status: viewMatchStatus, declaredView: rawView, expectedView },
      rasterCompatibility: { status: rasterCompatStatus, issues: issues.filter((i) => i.includes('raster dimensions')) },
      coordinateFrame: { status: 'unvalidated', note: 'Normal coordinate frame unvalidated by REVacity v0.' },
      orientationSemantics: { status: 'unvalidated', note: 'Normal orientation semantics unvalidated by REVacity v0.' },
      issues,
      warnings,
    },
    getDenseData,
  };
}

/**
 * Normalizes all modalities for a single view (Front or Side).
 * @param {'front'|'side'} viewName
 * @param {object} sources
 * @returns {object}
 */
export function normalizeViewPackage(viewName, sources = {}) {
  const {
    image = null,
    pose = null,
    segmentation = null,
    pointmap = null,
    normals = null,
  } = sources;

  const normalizedImage = normalizeImageEvidence(image, { expectedView: viewName });

  // Determine reference width and height for this view
  const segStats = segmentation
    ? normalizeSegmentation(segmentation, { expectedView: viewName })
    : emptyNormalizedSegmentation(viewName);

  const referenceWidthPx = segStats.widthPx ?? normalizedImage.widthPx ?? null;
  const referenceHeightPx = segStats.heightPx ?? normalizedImage.heightPx ?? null;

  // Normalized Pose
  const landmarks = pose ? extractPoseLandmarks(pose) : [];
  const poseStats = pose
    ? classifyPoseLandmarks(landmarks, { view: viewName })
    : {
      total: 0,
      accepted: 0,
      rejectedFace: 0,
      lowConfidence: 0,
      core: 0,
      secondary: 0,
      ignoredNonCore: 0,
      rejectedLandmarks: [],
      ignoredLandmarks: [],
      acceptedLandmarks: [],
    };

  // Normalized Pointmap
  const pointmapStats = normalizePointmapEvidence(pointmap, {
    expectedView: viewName,
    expectedWidthPx: referenceWidthPx,
    expectedHeightPx: referenceHeightPx,
  });

  // Normalized Normals
  const normalsStats = normalizeNormalsEvidence(normals, {
    expectedView: viewName,
    expectedWidthPx: referenceWidthPx,
    expectedHeightPx: referenceHeightPx,
  });

  // View-level QA aggregation
  const issues = [];
  const warnings = [];

  if (normalizedImage.qa.status === 'fail') issues.push(...normalizedImage.qa.issues);
  if (segStats.qa?.issues && segStats.qa.issues.length > 0 && segmentation) {
    issues.push(...segStats.qa.issues);
  }
  if (pointmapStats.qa.status === 'fail') issues.push(...pointmapStats.qa.issues);
  if (normalsStats.qa.status === 'fail') issues.push(...normalsStats.qa.issues);

  if (normalizedImage.qa.status === 'warning') warnings.push(...normalizedImage.qa.warnings);
  if (pointmapStats.qa.status === 'warning') warnings.push(...pointmapStats.qa.warnings);
  if (normalsStats.qa.status === 'warning') warnings.push(...normalsStats.qa.warnings);

  const modalities = {
    image: normalizedImage.present,
    pose: Boolean(pose),
    segmentation: Boolean(segmentation),
    pointmap: pointmapStats.present,
    normals: normalsStats.present,
  };

  const viewStatus = issues.length > 0 ? 'fail' : (warnings.length > 0 ? 'warning' : 'pass');

  return {
    image: normalizedImage,
    pose: poseStats,
    segmentation: segStats,
    pointmap: pointmapStats,
    normals: normalsStats,
    qa: {
      status: viewStatus,
      modalities,
      rasterDimensions: (referenceWidthPx && referenceHeightPx)
        ? { widthPx: referenceWidthPx, heightPx: referenceHeightPx }
        : null,
      rasterCompatibility: {
        status: (pointmapStats.qa.rasterCompatibility.status === 'fail' || normalsStats.qa.rasterCompatibility.status === 'fail')
          ? 'fail'
          : 'pass',
        issues: [
          ...pointmapStats.qa.rasterCompatibility.issues,
          ...normalsStats.qa.rasterCompatibility.issues,
        ],
      },
      issues,
      warnings,
    },
  };
}

/**
 * Builds the canonical normalized Full Body Evidence Package v0.
 *
 * @param {{
 *   sampleId?: string|null,
 *   sourceFormat?: string,
 *   front?: { image?: any, pose?: any, segmentation?: any, pointmap?: any, normals?: any },
 *   side?: { image?: any, pose?: any, segmentation?: any, pointmap?: any, normals?: any },
 * }} params
 * @returns {object} Canonical Body Evidence Package
 */
export function buildBodyEvidencePackage({
  sampleId = null,
  sourceFormat = DEFAULT_SOURCE_FORMAT,
  front = {},
  side = {},
} = {}) {
  const frontView = normalizeViewPackage('front', front);
  const sideView = normalizeViewPackage('side', side);

  const issues = [...frontView.qa.issues, ...sideView.qa.issues];
  const warnings = [...frontView.qa.warnings, ...sideView.qa.warnings];

  const views = {
    front: frontView.qa.modalities.image
      || frontView.qa.modalities.pose
      || frontView.qa.modalities.segmentation
      || frontView.qa.modalities.pointmap
      || frontView.qa.modalities.normals,
    side: sideView.qa.modalities.image
      || sideView.qa.modalities.pose
      || sideView.qa.modalities.segmentation
      || sideView.qa.modalities.pointmap
      || sideView.qa.modalities.normals,
  };

  const packageStatus = issues.length > 0 ? 'fail' : (warnings.length > 0 ? 'warning' : 'pass');

  return {
    version: PACKAGE_VERSION,
    sourceFormat,
    sampleId: typeof sampleId === 'string' && sampleId.trim() ? sampleId.trim() : null,
    front: frontView,
    side: sideView,
    qa: {
      status: packageStatus,
      views,
      modalitiesAvailable: {
        front: { ...frontView.qa.modalities },
        side: { ...sideView.qa.modalities },
      },
      issues,
      warnings,
    },
  };
}

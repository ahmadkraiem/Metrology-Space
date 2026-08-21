/**
 * Body Evidence ZIP Import Adapter (v0)
 *
 * Discovers and parses standard body processing pipeline ZIP archives into
 * the canonical normalized Full Body Evidence Package v0.
 *
 * The ZIP format is a temporary transport/input adapter only. Downstream
 * metrology logic never couples to ZIP file/folder structures.
 *
 * Supported directory layout conventions:
 * - pose_results/<sample>/
 * - seg_result/<sample>/ or seg_results/<sample>/
 * - pointmap_results/<sample>/
 * - normal_results/<sample>/
 * - input images (front/side png, jpg, webp)
 *
 * Strict Rules:
 * - Supports exactly one unambiguous sample/package in v0 (multiple samples rejected with error)
 * - Excludes preview/debug visualization PNGs (*_overlay.png, *_vis.png, etc.)
 * - Zero base64 payload duplication: retains lightweight lazy decoding handles
 */

import * as fflate from 'fflate';
import { buildBodyEvidencePackage } from './bodyEvidencePackage.js';

/**
 * Known path pattern for the Body Pipeline Align stage result.
 * Matches 'body/Align/result.json' with or without a leading root folder
 * (e.g. 'output/body/Align/result.json').
 * @type {RegExp}
 */
const ALIGN_RESULT_PATH_RE = /(?:^|\/)body\/align\/result\.json$/i;

/**
 * Known path pattern for the Body Pipeline Apose stage result.
 * Matches 'body/Apose/result.json' with or without a leading root folder
 * (e.g. 'output/body/Apose/result.json').
 * @type {RegExp}
 */
const APOSE_RESULT_PATH_RE = /(?:^|\/)body\/apose\/result\.json$/i;

const DEBUG_PREVIEW_PATTERNS = [
  '_overlay',
  '_vis',
  '_preview',
  'preview_',
  '_render',
  'render_',
  '_debug',
  'debug_',
  '_annotated',
  '_skeleton',
  '_plot',
  '_heatmap',
];

const IGNORED_SYSTEM_PATTERNS = [
  '__macosx',
  '.ds_store',
  'thumbs.db',
  '.git',
];

/**
 * Checks whether a path corresponds to an OS system or metadata file.
 * @param {string} path
 * @returns {boolean}
 */
function isIgnoredSystemPath(path) {
  const lower = path.toLowerCase();
  return IGNORED_SYSTEM_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Detects whether a file path matches the known body/Align/result.json location.
 * Accepts with or without a leading root folder (e.g. 'output/body/Align/result.json').
 * @param {string} path
 * @returns {boolean}
 */
export function isAlignResultPath(path) {
  return ALIGN_RESULT_PATH_RE.test(path);
}

/**
 * Validates that a parsed JSON payload has the structural shape of a Body Pipeline Align result.
 * Does not require exact field presence — checks the key discriminating fields.
 * @param {any} payload
 * @returns {boolean}
 */
export function isAlignResultPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  // Must have the Align stage identity fields
  if (payload.stage !== 'Align') return false;
  if (typeof payload.pixels_per_cm !== 'number') return false;
  if (typeof payload.height_cm !== 'number') return false;
  if (!payload.views || typeof payload.views !== 'object') return false;
  return true;
}

/**
 * Detects whether a file path matches the known body/Apose/result.json location.
 * Accepts with or without a leading root folder (e.g. 'output/body/Apose/result.json').
 * @param {string} path
 * @returns {boolean}
 */
export function isAposeResultPath(path) {
  return APOSE_RESULT_PATH_RE.test(path);
}

/**
 * Validates that a parsed JSON payload has the structural shape of a Body Pipeline Apose result.
 * @param {any} payload
 * @returns {boolean}
 */
export function isAposeResultPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return payload.stage === 'Apose';
}

/**
 * Maps a real Body Pipeline Align result.json into the canonical REVacity calibration schema.
 *
 * Package-level mapping:
 *   height_cm          → subjectHeightCm (alias: subject_height_cm)
 *   pixels_per_cm      → pixelsPerCm (alias: pixels_per_cm)
 *   canvas_size         → standardizedCanvasWidthPx, standardizedCanvasHeightPx
 *
 * The Align stage applies one scalar scale_factor to both axes (uniform scalar scaling).
 * We set isIsotropic: true to indicate this upstream contract — REVacity independently
 * validates the numerical pixel-domain consistency via its isotropic check.
 *
 * Per-view mapping (views.front, views.side):
 *   crop.cropped_size.width   → originalImageWidthPx
 *   crop.cropped_size.height  → originalImageHeightPx
 *   scale.scale_factor        → scaleFactor
 *   scale.scaled_size.width   → scaledWidthPx
 *   scale.scaled_size.height  → scaledHeightPx
 *   canvas.paste_position.x   → offsetX
 *   canvas.paste_position.y   → offsetY
 *
 * Upstream provenance fields are preserved where practical.
 *
 * @param {object} alignResult - Parsed body/Align/result.json
 * @returns {{ packageCalibration: object, frontCalibration: object|null, sideCalibration: object|null }}
 */
export function mapAlignResultToCalibration(alignResult) {
  const canvasSize = typeof alignResult.canvas_size === 'number' && alignResult.canvas_size > 0
    ? alignResult.canvas_size
    : 2000;

  const packageCalibration = {
    // Canonical fields expected by normalizePackageCalibration()
    pixels_per_cm: alignResult.pixels_per_cm,
    subject_height_cm: alignResult.height_cm,
    standardized_canvas_width: canvasSize,
    standardized_canvas_height: canvasSize,
    // The Align stage applies one scalar scale_factor to both width and height (uniform scalar scaling).
    // The adapter does NOT inject validated isotropy as authoritative truth; REVacity independently
    // validates isotropic numerical consistency in the pixel domain.
    declaredScaleModel: 'uniform_scalar',
    // Provenance
    calibrated: true,
    metricScaleSource: 'known_subject_height',
    standardizationSource: 'body-pipeline-align-v0',
    _alignStage: alignResult.stage,
    _alignCreatedAt: alignResult.created_at,
    _alignClientId: alignResult.client_id,
  };

  function mapViewCalibration(viewKey) {
    const viewData = alignResult.views?.[viewKey];
    if (!viewData || typeof viewData !== 'object') return null;

    const crop = viewData.crop;
    const scale = viewData.scale;
    const canvas = viewData.canvas;

    return {
      view: viewKey,
      // Source dimensions: the cropped image that scaleFactor was applied to
      originalImageWidthPx: crop?.cropped_size?.width ?? null,
      originalImageHeightPx: crop?.cropped_size?.height ?? null,
      // Scale transform
      scaleFactor: scale?.scale_factor ?? null,
      scaledWidthPx: scale?.scaled_size?.width ?? null,
      scaledHeightPx: scale?.scaled_size?.height ?? null,
      // Canvas placement offsets
      offsetX: canvas?.paste_position?.x ?? null,
      offsetY: canvas?.paste_position?.y ?? null,
      // Upstream provenance (preserved, not consumed by the evaluator)
      _targetBodyHeightPx: scale?.target_body_height_px ?? null,
      _realHeightCm: scale?.real_height_cm ?? null,
      _validationExpectedHeightPx: scale?.validation?.expected_height_px ?? null,
      _validationActualHeightPx: scale?.validation?.actual_height_px ?? null,
      _validationErrorPx: scale?.validation?.error_px ?? null,
      _originalImageSize: crop?.original_size ?? null,
    };
  }

  return {
    packageCalibration,
    frontCalibration: mapViewCalibration('front'),
    sideCalibration: mapViewCalibration('side'),
  };
}

/**
 * Checks whether a path is a preview/debug visualization image that should be excluded.
 * @param {string} path
 * @returns {boolean}
 */
function isPreviewOrDebugImage(path) {
  const lower = path.toLowerCase();
  const filename = lower.split('/').pop() ?? '';
  return DEBUG_PREVIEW_PATTERNS.some((pattern) => filename.includes(pattern));
}

/**
 * Normalizes zip entry paths (converts backslashes to forward slashes, strips leading slashes).
 * @param {string} path
 * @returns {string}
 */
function cleanZipPath(path) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

/**
 * Unzips an archive (ArrayBuffer, Uint8Array, or Blob) into a Map of { path -> Uint8Array }.
 * @param {Uint8Array|ArrayBuffer|Blob} archiveData
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function unzipArchive(archiveData) {
  let bytes;
  if (typeof Blob !== 'undefined' && archiveData instanceof Blob) {
    const arrayBuffer = await archiveData.arrayBuffer();
    bytes = new Uint8Array(arrayBuffer);
  } else if (archiveData instanceof ArrayBuffer) {
    bytes = new Uint8Array(archiveData);
  } else if (archiveData instanceof Uint8Array) {
    bytes = archiveData;
  } else {
    throw new TypeError('Unsupported archive data type (expected Blob, ArrayBuffer, or Uint8Array)');
  }

  return new Promise((resolve, reject) => {
    fflate.unzip(bytes, (err, unzipped) => {
      if (err) {
        reject(new Error(`Failed to unzip archive: ${err.message}`));
        return;
      }
      const filesMap = new Map();
      for (const [rawPath, fileBytes] of Object.entries(unzipped)) {
        const cleaned = cleanZipPath(rawPath);
        if (!cleaned || isIgnoredSystemPath(cleaned) || cleaned.endsWith('/')) {
          continue;
        }
        filesMap.set(cleaned, fileBytes);
      }
      resolve(filesMap);
    });
  });
}

/**
 * Discovers sample directories within the unzipped files map.
 * @param {Map<string, Uint8Array>} filesMap
 * @returns {string[]} List of unique sample IDs discovered
 */
export function discoverSampleIds(filesMap) {
  const sampleIds = new Set();
  const resultFolderPrefixes = [
    'pose_results/',
    'pose_result/',
    'pose/',
    'seg_result/',
    'seg_results/',
    'segmentation/',
    'pointmap_results/',
    'pointmap_result/',
    'pointmaps/',
    'normal_results/',
    'normal_result/',
    'normals/',
    'input_images/',
    'images/',
    'inputs/',
  ];

  for (const path of filesMap.keys()) {
    const lower = path.toLowerCase();
    for (const prefix of resultFolderPrefixes) {
      if (lower.startsWith(prefix)) {
        const remaining = path.slice(prefix.length);
        const parts = remaining.split('/');
        if (parts.length >= 2 && parts[0].trim()) {
          sampleIds.add(parts[0].trim());
        }
      }
    }
  }

  return [...sampleIds];
}

/**
 * Safely parses a JSON file from Uint8Array.
 * @param {Uint8Array} bytes
 * @returns {any}
 */
function parseJsonBytes(bytes) {
  const text = new TextDecoder('utf-8').decode(bytes);
  return JSON.parse(text);
}

/**
 * Determines whether a path refers to Front or Side view.
 * @param {string} path
 * @returns {'front'|'side'|null}
 */
function detectViewFromPath(path) {
  const lower = path.toLowerCase();
  const filename = lower.split('/').pop() ?? '';

  if (filename.includes('front') || lower.includes('/front/') || lower.includes('/front_')) {
    return 'front';
  }
  if (filename.includes('side') || lower.includes('/side/') || lower.includes('/side_') || lower.includes('/profile')) {
    return 'side';
  }
  return null;
}

/**
 * Discovers and groups matching artifacts for Front and Side views.
 *
 * @param {Map<string, Uint8Array>} filesMap
 * @param {string|null} sampleId
 * @returns {{ front: object, side: object, calibration: object|null }}
 */
export function resolvePackageArtifacts(filesMap, sampleId = null) {
  const front = { image: null, pose: null, segmentation: null, pointmap: null, normals: null, calibration: null };
  const side = { image: null, pose: null, segmentation: null, pointmap: null, normals: null, calibration: null };
  let packageCalibration = null;
  let alignResult = null;
  let aposeResult = null;

  for (const [path, bytes] of filesMap.entries()) {
    // If sampleId is known, prioritize files belonging to that sample directory.
    // body/ paths (Align, Apose) are pipeline-wide and bypass sample filtering.
    if (sampleId) {
      const parts = path.split('/');
      const isInsideSample = parts.some((p) => p.toLowerCase() === sampleId.toLowerCase());
      const topLevelFolders = ['images', 'image', 'inputs', 'input', 'input_images', 'raw_images', 'photos'];
      const isTopLevelInput = parts.length === 1 || topLevelFolders.includes(parts[0].toLowerCase());
      const isBodyPipelinePath = parts.some((p) => p.toLowerCase() === 'body');
      if (!isInsideSample && !isTopLevelInput && !isBodyPipelinePath) {
        continue;
      }
    }

    const lower = path.toLowerCase();
    const filename = lower.split('/').pop() ?? '';
    const ext = filename.split('.').pop() ?? '';

    // 1. Input Images (PNG, JPG, JPEG, WEBP)
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      if (isPreviewOrDebugImage(path)) {
        continue;
      }
      const view = detectViewFromPath(path);
      if (view === 'front' && !front.image) {
        front.image = {
          filename,
          path,
          bytes,
          view: 'front',
        };
      } else if (view === 'side' && !side.image) {
        side.image = {
          filename,
          path,
          bytes,
          view: 'side',
        };
      }
      continue;
    }

    // 2. JSON Artifacts
    if (ext === 'json') {
      let jsonPayload = null;
      try {
        jsonPayload = parseJsonBytes(bytes);
      } catch (err) {
        console.warn(`[REVacity] Skipping invalid JSON file: ${path}`, err);
        continue;
      }

      // Check for Body Pipeline Apose result.json (explicit path + schema detection)
      if (isAposeResultPath(path) && isAposeResultPayload(jsonPayload)) {
        aposeResult = jsonPayload;
        continue;
      }

      // Check for Body Pipeline Align result.json (explicit path + schema detection)
      if (isAlignResultPath(path) && isAlignResultPayload(jsonPayload)) {
        alignResult = jsonPayload;
        const mapped = mapAlignResultToCalibration(jsonPayload);
        if (!packageCalibration) {
          packageCalibration = mapped.packageCalibration;
        }
        if (mapped.frontCalibration && !front.calibration) {
          front.calibration = mapped.frontCalibration;
        }
        if (mapped.sideCalibration && !side.calibration) {
          side.calibration = mapped.sideCalibration;
        }
        // Align result.json is a calibration artifact, not a view-specific modality;
        // skip further artifact classification for this file.
        continue;
      }

      // Check if this is a recognized calibration contract or Body Pipeline calibration payload
      const hasCalibContract = jsonPayload?.contract === 'metric-calibration-provenance-v0';
      const hasCalibFields = Boolean(
        jsonPayload
        && (typeof jsonPayload.pixelsPerCm === 'number' || typeof jsonPayload.pixels_per_cm === 'number')
        && (typeof jsonPayload.subjectHeightCm === 'number' || typeof jsonPayload.subject_height_cm === 'number'
          || typeof jsonPayload.height_cm === 'number'),
      );

      if (hasCalibContract || hasCalibFields) {
        if (!packageCalibration) {
          packageCalibration = jsonPayload;
        }
        if (jsonPayload.front && typeof jsonPayload.front === 'object' && !front.calibration) {
          front.calibration = jsonPayload.front;
        }
        if (jsonPayload.side && typeof jsonPayload.side === 'object' && !side.calibration) {
          side.calibration = jsonPayload.side;
        }
      }

      // Check view from path or inside JSON payload
      const declaredView = typeof jsonPayload?.view === 'string' ? jsonPayload.view.toLowerCase().trim() : null;
      const view = declaredView || detectViewFromPath(path);

      if (!view || (view !== 'front' && view !== 'side')) {
        continue;
      }

      const target = view === 'front' ? front : side;

      // Check for view-level calibration provenance
      const isViewCalib = Boolean(
        jsonPayload
        && (typeof jsonPayload.scaleFactor === 'number' || typeof jsonPayload.scale_factor === 'number'
          || typeof jsonPayload.originalImageWidthPx === 'number' || typeof jsonPayload.orig_width === 'number'),
      );
      if (isViewCalib && !target.calibration) {
        target.calibration = jsonPayload;
      }

      // Identify artifact type based on folder prefix or payload keys
      if (
        lower.includes('pose_result')
        || lower.includes('/pose')
        || 'keypoints_named' in jsonPayload
        || 'keypoints' in jsonPayload
        || 'landmarks' in jsonPayload
        || 'pose' in jsonPayload
      ) {
        if (!target.pose) {
          target.pose = jsonPayload;
        }
      } else if (
        lower.includes('seg_result')
        || lower.includes('segmentation')
        || lower.includes('/seg')
        || 'class_names' in jsonPayload
        || 'num_classes' in jsonPayload
        || 'labels' in jsonPayload
      ) {
        if (!target.segmentation) {
          target.segmentation = jsonPayload;
        }
      } else if (
        lower.includes('pointmap')
        || 'pointmap' in jsonPayload
        || (jsonPayload.channels === 3 && ('units' in jsonPayload || 'scale' in jsonPayload))
      ) {
        if (!target.pointmap) {
          target.pointmap = {
            model: jsonPayload.model ?? jsonPayload.model_name ?? null,
            view: jsonPayload.view ?? view,
            channels: jsonPayload.channels ?? 3,
            shape: jsonPayload.shape ?? jsonPayload.data?.shape ?? jsonPayload.pointmap?.shape ?? null,
            denseLayout: jsonPayload.denseLayout ?? jsonPayload.layout ?? null,
            dtype: jsonPayload.dtype ?? jsonPayload.data?.dtype ?? 'float32',
            declaredUnits: jsonPayload.units ?? jsonPayload.declaredUnits ?? null,
            declaredScale: jsonPayload.scale ?? jsonPayload.declaredScale ?? null,
            loadDenseBuffer: async () => bytes,
          };
        }
      } else if (
        lower.includes('normal')
        || 'normals' in jsonPayload
        || (jsonPayload.channels === 3 && ('range' in jsonPayload || 'declaredRange' in jsonPayload))
      ) {
        if (!target.normals) {
          target.normals = {
            model: jsonPayload.model ?? jsonPayload.model_name ?? null,
            view: jsonPayload.view ?? view,
            channels: jsonPayload.channels ?? 3,
            shape: jsonPayload.shape ?? jsonPayload.data?.shape ?? jsonPayload.normals?.shape ?? null,
            denseLayout: jsonPayload.denseLayout ?? jsonPayload.layout ?? null,
            dtype: jsonPayload.dtype ?? jsonPayload.data?.dtype ?? 'float32',
            declaredRange: jsonPayload.range ?? jsonPayload.declaredRange ?? null,
            loadDenseBuffer: async () => bytes,
          };
        }
      }
    }
  }

  return {
    front,
    side,
    calibration: packageCalibration,
    rawSources: (aposeResult || alignResult) ? { aposeResult, alignResult } : null,
  };
}

/**
 * Imports a Body Evidence pipeline ZIP archive and returns the canonical normalized package.
 *
 * @param {Uint8Array|ArrayBuffer|Blob} archiveData
 * @returns {Promise<{
 *   ok: boolean,
 *   package: object|null,
 *   sampleId: string|null,
 *   error: string|null,
 * }>}
 */
export async function importBodyEvidenceZip(archiveData) {
  let filesMap;
  try {
    filesMap = await unzipArchive(archiveData);
  } catch (error) {
    return {
      ok: false,
      package: null,
      sampleId: null,
      error: error instanceof Error ? error.message : 'Failed to read ZIP archive.',
    };
  }

  if (filesMap.size === 0) {
    return {
      ok: false,
      package: null,
      sampleId: null,
      error: 'ZIP archive is empty.',
    };
  }

  // Sample discovery & single-sample validation
  const discoveredSampleIds = discoverSampleIds(filesMap);

  if (discoveredSampleIds.length > 1) {
    return {
      ok: false,
      package: null,
      sampleId: null,
      error: `Multiple sample directories found in ZIP archive: [${discoveredSampleIds.join(', ')}]. Batch import is deferred in v0.`,
    };
  }

  const sampleId = discoveredSampleIds.length === 1 ? discoveredSampleIds[0] : null;

  // Resolve Front and Side artifacts
  const { front, side, calibration, rawSources } = resolvePackageArtifacts(filesMap, sampleId);

  // Clear archive map to release any unreferenced file buffers
  filesMap.clear();

  // Check if at least one modality was discovered across front or side
  const hasAnyEvidence = (
    front.image || front.pose || front.segmentation || front.pointmap || front.normals
    || side.image || side.pose || side.segmentation || side.pointmap || side.normals
  );

  if (!hasAnyEvidence) {
    return {
      ok: false,
      package: null,
      sampleId,
      error: 'No matching Body Evidence artifacts (pose, segmentation, pointmap, normals, or image) found in ZIP archive.',
    };
  }

  // Build the normalized canonical package
  const pkg = buildBodyEvidencePackage({
    sampleId,
    sourceFormat: 'body-pipeline-zip-v0',
    calibration,
    front,
    side,
    rawSources,
  });

  return {
    ok: true,
    package: pkg,
    sampleId,
    error: null,
  };
}

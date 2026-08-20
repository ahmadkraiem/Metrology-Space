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
 * @returns {{ front: object, side: object }}
 */
export function resolvePackageArtifacts(filesMap, sampleId = null) {
  const front = {
    image: null,
    pose: null,
    segmentation: null,
    pointmap: null,
    normals: null,
  };

  const side = {
    image: null,
    pose: null,
    segmentation: null,
    pointmap: null,
    normals: null,
  };

  for (const [path, bytes] of filesMap.entries()) {
    // If a sampleId is active, only process files belonging to that sample or global inputs
    if (sampleId) {
      const parts = path.split('/');
      const isInsideSample = parts.some((p) => p.toLowerCase() === sampleId.toLowerCase());
      const topLevelFolders = ['images', 'image', 'inputs', 'input', 'input_images', 'raw_images', 'photos'];
      const isTopLevelInput = parts.length === 1 || topLevelFolders.includes(parts[0].toLowerCase());
      if (!isInsideSample && !isTopLevelInput) {
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

      // Check view from path or inside JSON payload
      const declaredView = typeof jsonPayload?.view === 'string' ? jsonPayload.view.toLowerCase().trim() : null;
      const view = declaredView || detectViewFromPath(path);

      if (!view || (view !== 'front' && view !== 'side')) {
        continue;
      }

      const target = view === 'front' ? front : side;

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
            dtype: jsonPayload.dtype ?? jsonPayload.data?.dtype ?? 'float32',
            declaredRange: jsonPayload.range ?? jsonPayload.declaredRange ?? null,
            loadDenseBuffer: async () => bytes,
          };
        }
      }
    }
  }

  return { front, side };
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
  const { front, side } = resolvePackageArtifacts(filesMap, sampleId);

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
    front,
    side,
  });

  return {
    ok: true,
    package: pkg,
    sampleId,
    error: null,
  };
}

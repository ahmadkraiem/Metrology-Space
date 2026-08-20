/**
 * Anatomical Region Contract v0
 *
 * Pure deterministic domain contract that maps normalized Front/Side
 * segmentation classes into observed anatomical region records with
 * metric outer bounds in centimeters.
 *
 * Grounded strictly in the authoritative 29-class segmentation ontology (0..28).
 * Contains observed segmentation regions only — no derived/composite regions,
 * no class unions, no U->Z depth, and no 3D geometry fusion.
 */

import {
  boundsPxToFrontMetrology,
  boundsPxToSideMetrology,
} from '../core/pixelMetrologyMapping.js';

export const ANATOMICAL_REGION_CONTRACT_VERSION = 'anatomical-region-v0';
export const ANATOMICAL_REGION_CONTRACT_NAME = 'anatomical-region-v0';

export const TOTAL_CANONICAL_CLASSES_V0 = 29;

/**
 * Semantic category taxonomies for segmentation classes.
 * @readonly
 * @enum {string}
 */
export const ANATOMICAL_REGION_CATEGORIES = Object.freeze({
  BODY_ANATOMICAL: 'body_anatomical',
  CLOTHING_APPAREL: 'clothing_apparel',
  FACE_HEAD: 'face_head',
  ACCESSORY_OTHER: 'accessory_other',
  CONTEXT_BACKGROUND: 'context_background',
});

/**
 * Region presence and QA status flags.
 * @readonly
 * @enum {string}
 */
export const ANATOMICAL_REGION_STATUS = Object.freeze({
  VALID: 'valid',
  ABSENT: 'absent',
  INVALID: 'invalid',
});

/**
 * Canonical 29-Class Segmentation Ontology Definition (v0).
 * Exact class ID ordering 0..28 from runtime segmentation inputs.
 *
 * Partition counts:
 * - body_anatomical: 13
 * - clothing_apparel: 7
 * - face_head: 7
 * - accessory_other: 1
 * - context_background: 1
 * Total = 29
 *
 * @type {readonly Array<{
 *   classId: number,
 *   label: string,
 *   regionId: string,
 *   category: 'body_anatomical'|'clothing_apparel'|'face_head'|'accessory_other'|'context_background',
 *   isBodyMetrologyEligible: boolean,
 * }>}
 */
export const CANONICAL_SEGMENTATION_CLASSES_V0 = Object.freeze([
  Object.freeze({
    classId: 0,
    label: 'Background',
    regionId: 'background',
    category: ANATOMICAL_REGION_CATEGORIES.CONTEXT_BACKGROUND,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 1,
    label: 'Apparel',
    regionId: 'apparel',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 2,
    label: 'Eyeglass',
    regionId: 'eyeglass',
    category: ANATOMICAL_REGION_CATEGORIES.ACCESSORY_OTHER,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 3,
    label: 'Face_Neck',
    regionId: 'face_neck',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 4,
    label: 'Hair',
    regionId: 'hair',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 5,
    label: 'Left_Foot',
    regionId: 'left_foot',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 6,
    label: 'Left_Hand',
    regionId: 'left_hand',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 7,
    label: 'Left_Lower_Arm',
    regionId: 'left_lower_arm',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 8,
    label: 'Left_Lower_Leg',
    regionId: 'left_lower_leg',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 9,
    label: 'Left_Shoe',
    regionId: 'left_shoe',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 10,
    label: 'Left_Sock',
    regionId: 'left_sock',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 11,
    label: 'Left_Upper_Arm',
    regionId: 'left_upper_arm',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 12,
    label: 'Left_Upper_Leg',
    regionId: 'left_upper_leg',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 13,
    label: 'Lower_Clothing',
    regionId: 'lower_clothing',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 14,
    label: 'Right_Foot',
    regionId: 'right_foot',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 15,
    label: 'Right_Hand',
    regionId: 'right_hand',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 16,
    label: 'Right_Lower_Arm',
    regionId: 'right_lower_arm',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 17,
    label: 'Right_Lower_Leg',
    regionId: 'right_lower_leg',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 18,
    label: 'Right_Shoe',
    regionId: 'right_shoe',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 19,
    label: 'Right_Sock',
    regionId: 'right_sock',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 20,
    label: 'Right_Upper_Arm',
    regionId: 'right_upper_arm',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 21,
    label: 'Right_Upper_Leg',
    regionId: 'right_upper_leg',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 22,
    label: 'Torso',
    regionId: 'torso',
    category: ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL,
    isBodyMetrologyEligible: true,
  }),
  Object.freeze({
    classId: 23,
    label: 'Upper_Clothing',
    regionId: 'upper_clothing',
    category: ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 24,
    label: 'Lower_Lip',
    regionId: 'lower_lip',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 25,
    label: 'Upper_Lip',
    regionId: 'upper_lip',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 26,
    label: 'Lower_Teeth',
    regionId: 'lower_teeth',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 27,
    label: 'Upper_Teeth',
    regionId: 'upper_teeth',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
  Object.freeze({
    classId: 28,
    label: 'Tongue',
    regionId: 'tongue',
    category: ANATOMICAL_REGION_CATEGORIES.FACE_HEAD,
    isBodyMetrologyEligible: false,
  }),
]);

export const BODY_ANATOMICAL_CLASS_IDS = Object.freeze(new Set(
  CANONICAL_SEGMENTATION_CLASSES_V0
    .filter((c) => c.category === ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL)
    .map((c) => c.classId),
));

/**
 * Checks whether a given class ID belongs strictly to the body_anatomical category.
 * @param {number} classId
 * @returns {boolean}
 */
export function isBodyAnatomicalClass(classId) {
  return BODY_ANATOMICAL_CLASS_IDS.has(classId);
}

const CLASS_BY_ID = new Map(
  CANONICAL_SEGMENTATION_CLASSES_V0.map((entry) => [entry.classId, entry]),
);

const CLASS_BY_NORMALIZED_LABEL = new Map(
  CANONICAL_SEGMENTATION_CLASSES_V0.map((entry) => [
    normalizeLabelKey(entry.label),
    entry,
  ]),
);

/**
 * Normalizes a label string for robust key lookup (lowercase, underscores).
 * @param {unknown} label
 * @returns {string}
 */
export function normalizeLabelKey(label) {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Look up canonical class metadata by class ID (0..28) or label string.
 * @param {number|string} classIdOrLabel
 * @returns {typeof CANONICAL_SEGMENTATION_CLASSES_V0[number]|null}
 */
export function getCanonicalSegmentationClass(classIdOrLabel) {
  if (typeof classIdOrLabel === 'number' && Number.isInteger(classIdOrLabel)) {
    return CLASS_BY_ID.get(classIdOrLabel) ?? null;
  }
  if (typeof classIdOrLabel === 'string') {
    const trimmed = classIdOrLabel.trim();
    if (/^\d+$/.test(trimmed)) {
      return CLASS_BY_ID.get(Number(trimmed)) ?? null;
    }
    return CLASS_BY_NORMALIZED_LABEL.get(normalizeLabelKey(trimmed)) ?? null;
  }
  return null;
}

/**
 * Validates a 2D pixel bounding box object.
 * @param {unknown} bounds
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }|null}
 */
function sanitizeBoundsPx(bounds) {
  if (!bounds || typeof bounds !== 'object') {
    return null;
  }
  const minX = bounds.minX;
  const minY = bounds.minY;
  const maxX = bounds.maxX;
  const maxY = bounds.maxY;
  if (
    typeof minX === 'number' && Number.isFinite(minX)
    && typeof minY === 'number' && Number.isFinite(minY)
    && typeof maxX === 'number' && Number.isFinite(maxX)
    && typeof maxY === 'number' && Number.isFinite(maxY)
    && minX <= maxX
    && minY <= maxY
  ) {
    return { minX, minY, maxX, maxY };
  }
  return null;
}

/**
 * Validates a normalized 0..1 bounding box object.
 * @param {unknown} bounds
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }|null}
 */
function sanitizeBoundsNormalized(bounds) {
  if (!bounds || typeof bounds !== 'object') {
    return null;
  }
  const minX = bounds.minX;
  const minY = bounds.minY;
  const maxX = bounds.maxX;
  const maxY = bounds.maxY;
  if (
    typeof minX === 'number' && Number.isFinite(minX)
    && typeof minY === 'number' && Number.isFinite(minY)
    && typeof maxX === 'number' && Number.isFinite(maxX)
    && typeof maxY === 'number' && Number.isFinite(maxY)
    && minX >= 0 && minX <= 1
    && minY >= 0 && minY <= 1
    && maxX >= 0 && maxX <= 1
    && maxY >= 0 && maxY <= 1
    && minX <= maxX
    && minY <= maxY
  ) {
    return { minX, minY, maxX, maxY };
  }
  return null;
}

/**
 * @typedef {{
 *   regionId: string,
 *   label: string,
 *   category: 'body_anatomical'|'clothing_apparel'|'face_head'|'accessory_other'|'context_background',
 *   view: 'front'|'side',
 *   classId: number,
 *   present: boolean,
 *   pixelCount: number,
 *   coverage: number,
 *   boundsPx: { minX: number, minY: number, maxX: number, maxY: number }|null,
 *   boundsNormalized: { minX: number, minY: number, maxX: number, maxY: number }|null,
 *   boundsCm: { minX: number, maxX: number, minY: number, maxY: number }|{ minU: number, maxU: number, minY: number, maxY: number }|null,
 *   status: 'valid'|'absent'|'invalid',
 *   isBodyMetrologyEligible: boolean,
 * }} ObservedSegmentationRegionV0
 */

/**
 * @typedef {{
 *   contract: string,
 *   version: string,
 *   view: 'front'|'side',
 *   summary: {
 *     totalClasses: number,
 *     presentClasses: number,
 *     validCount: number,
 *     absentCount: number,
 *     invalidCount: number,
 *     bodyAnatomicalCount: number,
 *     clothingApparelCount: number,
 *     faceHeadCount: number,
 *     accessoryCount: number,
 *     contextCount: number,
 *   },
 *   regions: ObservedSegmentationRegionV0[],
 * }} AnatomicalRegionReportV0
 */

/**
 * Builds deterministic observed anatomical region records from normalized segmentation output.
 *
 * @param {object|null|undefined} normalizedSegmentation - Output of normalizeSegmentation()
 * @param {{ view?: 'front'|'side', widthPx?: number, heightPx?: number }} [options]
 * @returns {AnatomicalRegionReportV0}
 */
export function buildObservedAnatomicalRegions(normalizedSegmentation, { view, widthPx: optWidth, heightPx: optHeight } = {}) {
  const resolvedView = (typeof view === 'string' && view.trim())
    ? view.trim().toLowerCase()
    : (typeof normalizedSegmentation?.view === 'string' && normalizedSegmentation.view.trim()
      ? normalizedSegmentation.view.trim().toLowerCase()
      : 'front');

  const widthPx = (typeof optWidth === 'number' && Number.isInteger(optWidth) && optWidth > 0)
    ? optWidth
    : (typeof normalizedSegmentation?.widthPx === 'number' && Number.isInteger(normalizedSegmentation.widthPx) && normalizedSegmentation.widthPx > 0)
      ? normalizedSegmentation.widthPx
      : (Array.isArray(normalizedSegmentation?.shape) && typeof normalizedSegmentation.shape[1] === 'number' && Number.isInteger(normalizedSegmentation.shape[1]) && normalizedSegmentation.shape[1] > 0)
        ? normalizedSegmentation.shape[1]
        : (Array.isArray(normalizedSegmentation?.labelShape) && typeof normalizedSegmentation.labelShape[1] === 'number' && Number.isInteger(normalizedSegmentation.labelShape[1]) && normalizedSegmentation.labelShape[1] > 0)
          ? normalizedSegmentation.labelShape[1]
          : null;

  const heightPx = (typeof optHeight === 'number' && Number.isInteger(optHeight) && optHeight > 0)
    ? optHeight
    : (typeof normalizedSegmentation?.heightPx === 'number' && Number.isInteger(normalizedSegmentation.heightPx) && normalizedSegmentation.heightPx > 0)
      ? normalizedSegmentation.heightPx
      : (Array.isArray(normalizedSegmentation?.shape) && typeof normalizedSegmentation.shape[0] === 'number' && Number.isInteger(normalizedSegmentation.shape[0]) && normalizedSegmentation.shape[0] > 0)
        ? normalizedSegmentation.shape[0]
        : (Array.isArray(normalizedSegmentation?.labelShape) && typeof normalizedSegmentation.labelShape[0] === 'number' && Number.isInteger(normalizedSegmentation.labelShape[0]) && normalizedSegmentation.labelShape[0] > 0)
          ? normalizedSegmentation.labelShape[0]
          : null;

  const incomingClasses = Array.isArray(normalizedSegmentation?.classes)
    ? normalizedSegmentation.classes
    : [];

  // Index incoming classes by classId and normalized label
  const incomingById = new Map();
  const incomingByLabel = new Map();

  for (const item of incomingClasses) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    if (typeof item.classId === 'number' && Number.isInteger(item.classId)) {
      incomingById.set(item.classId, item);
    }
    if (typeof item.label === 'string') {
      incomingByLabel.set(normalizeLabelKey(item.label), item);
    }
  }

  const regions = [];
  let presentClasses = 0;
  let validCount = 0;
  let absentCount = 0;
  let invalidCount = 0;
  let bodyAnatomicalCount = 0;
  let clothingApparelCount = 0;
  let faceHeadCount = 0;
  let accessoryCount = 0;
  let contextCount = 0;

  for (let c = 0; c < TOTAL_CANONICAL_CLASSES_V0; c += 1) {
    const canonical = CANONICAL_SEGMENTATION_CLASSES_V0[c];
    const incoming = incomingById.get(c) ?? incomingByLabel.get(normalizeLabelKey(canonical.label)) ?? null;

    let pixelCount = 0;
    let coverage = 0;
    let boundsPx = null;
    let boundsNormalized = null;
    let boundsCm = null;
    let present = false;
    let status = ANATOMICAL_REGION_STATUS.ABSENT;

    if (incoming) {
      const rawCount = incoming.pixelCount;
      if (typeof rawCount === 'number' && Number.isFinite(rawCount) && rawCount >= 0) {
        pixelCount = rawCount;
      }
      const rawCoverage = incoming.coverage;
      if (typeof rawCoverage === 'number' && Number.isFinite(rawCoverage) && rawCoverage >= 0) {
        coverage = rawCoverage;
      }

      boundsPx = sanitizeBoundsPx(incoming.boundsPx);
      boundsNormalized = sanitizeBoundsNormalized(incoming.boundsNormalized);

      // Present requires positive pixel count and valid bounds
      if (pixelCount > 0 && boundsPx !== null) {
        present = true;
        status = ANATOMICAL_REGION_STATUS.VALID;
      } else if (pixelCount > 0 && boundsPx === null) {
        // Inconsistent raster / missing bounds when pixels exist
        present = false;
        status = ANATOMICAL_REGION_STATUS.INVALID;
      } else {
        present = false;
        status = ANATOMICAL_REGION_STATUS.ABSENT;
      }

      // Explicit QA error forwarding
      if (incoming.status === ANATOMICAL_REGION_STATUS.INVALID) {
        status = ANATOMICAL_REGION_STATUS.INVALID;
        present = false;
      }
    }

    // Compute metric outer bounds when region is valid
    if (status === ANATOMICAL_REGION_STATUS.VALID && boundsPx !== null) {
      if (widthPx !== null && heightPx !== null) {
        try {
          if (resolvedView === 'side') {
            boundsCm = boundsPxToSideMetrology(boundsPx, widthPx, heightPx);
          } else {
            boundsCm = boundsPxToFrontMetrology(boundsPx, widthPx, heightPx);
          }
        } catch {
          boundsCm = null;
          status = ANATOMICAL_REGION_STATUS.INVALID;
          present = false;
        }
      } else {
        boundsCm = null;
        status = ANATOMICAL_REGION_STATUS.INVALID;
        present = false;
      }
    }

    if (present) {
      presentClasses += 1;
    }

    if (status === ANATOMICAL_REGION_STATUS.VALID) {
      validCount += 1;
    } else if (status === ANATOMICAL_REGION_STATUS.INVALID) {
      invalidCount += 1;
    } else {
      absentCount += 1;
    }

    if (canonical.category === ANATOMICAL_REGION_CATEGORIES.BODY_ANATOMICAL) {
      bodyAnatomicalCount += 1;
    } else if (canonical.category === ANATOMICAL_REGION_CATEGORIES.CLOTHING_APPAREL) {
      clothingApparelCount += 1;
    } else if (canonical.category === ANATOMICAL_REGION_CATEGORIES.FACE_HEAD) {
      faceHeadCount += 1;
    } else if (canonical.category === ANATOMICAL_REGION_CATEGORIES.ACCESSORY_OTHER) {
      accessoryCount += 1;
    } else if (canonical.category === ANATOMICAL_REGION_CATEGORIES.CONTEXT_BACKGROUND) {
      contextCount += 1;
    }

    regions.push({
      regionId: canonical.regionId,
      label: canonical.label,
      category: canonical.category,
      view: resolvedView,
      classId: canonical.classId,
      present,
      pixelCount,
      coverage,
      boundsPx,
      boundsNormalized,
      boundsCm,
      status,
      isBodyMetrologyEligible: canonical.isBodyMetrologyEligible,
    });
  }

  return {
    contract: ANATOMICAL_REGION_CONTRACT_NAME,
    version: ANATOMICAL_REGION_CONTRACT_VERSION,
    view: resolvedView,
    summary: {
      totalClasses: TOTAL_CANONICAL_CLASSES_V0,
      presentClasses,
      validCount,
      absentCount,
      invalidCount,
      bodyAnatomicalCount,
      clothingApparelCount,
      faceHeadCount,
      accessoryCount,
      contextCount,
    },
    regions,
  };
}

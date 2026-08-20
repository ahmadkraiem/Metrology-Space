/**
 * Anatomical Region Evidence Contract v0
 *
 * Pure deterministic domain contract that assembles already-existing
 * anatomical region evidence (segmentation observations, metric bounds,
 * and view-level dense QA qualification) for each view independently.
 *
 * Contract: 'anatomical-region-evidence-v0'
 * Scope: Strictly the 13 canonical metrology-eligible body_anatomical classes
 * from anatomicalRegions.js.
 *
 * Guardrails:
 * - Read-only: does not decode dense buffers, call getDenseData(), or run dense scans.
 * - Does not invent per-class dense statistics.
 * - Preserves Front X/Y and Side U/Y independence.
 * - Side U is never labeled or treated as canonical Z.
 * - Does not extract width/depth/circumference measurements or infer 3D geometry.
 * - Landmark and Anatomical Level associations remain deferred to Milestone 4.2B.
 */

import {
  CANONICAL_SEGMENTATION_CLASSES_V0,
  buildObservedAnatomicalRegions,
} from './anatomicalRegions.js';

export const ANATOMICAL_REGION_EVIDENCE_CONTRACT_VERSION = 'anatomical-region-evidence-v0';
export const ANATOMICAL_REGION_EVIDENCE_CONTRACT = 'anatomical-region-evidence-v0';

/**
 * Filter canonical segmentation ontology down to the 13 metrology-eligible body_anatomical classes
 * in deterministic classId order.
 */
export const ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0 = Object.freeze(
  CANONICAL_SEGMENTATION_CLASSES_V0.filter((c) => c.isBodyMetrologyEligible),
);

export const TOTAL_ELIGIBLE_ANATOMICAL_REGIONS_V0 = ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.length; // 13

function formatBoundsNormalized(bounds) {
  if (!bounds || typeof bounds !== 'object') {
    return null;
  }
  const minU = bounds.minU ?? bounds.minX;
  const maxU = bounds.maxU ?? bounds.maxX;
  const minV = bounds.minV ?? bounds.minY;
  const maxV = bounds.maxV ?? bounds.maxY;
  if (
    typeof minU === 'number' && Number.isFinite(minU)
    && typeof maxU === 'number' && Number.isFinite(maxU)
    && typeof minV === 'number' && Number.isFinite(minV)
    && typeof maxV === 'number' && Number.isFinite(maxV)
  ) {
    return { minU, maxU, minV, maxV };
  }
  return null;
}

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
  ) {
    return { minX, minY, maxX, maxY };
  }
  return null;
}

/**
 * @typedef {{
 *   classId: number,
 *   label: string,
 *   category: 'body_anatomical',
 *   laterality: 'left'|'right'|'central',
 *   view: 'front'|'side',
 *   segmentation: {
 *     present: boolean,
 *     pixelCount: number,
 *     coverage: number,
 *     boundsPx: { minX: number, minY: number, maxX: number, maxY: number }|null,
 *     boundsNormalized: { minU: number, maxU: number, minV: number, maxV: number }|null,
 *     boundsCm: { minX: number, maxX: number, minY: number, maxY: number }|{ minU: number, maxU: number, minY: number, maxY: number }|null,
 *   },
 *   denseEvidence: {
 *     pointmap: {
 *       available: boolean,
 *       qaStatus: 'pass'|'warning'|'fail'|null,
 *     },
 *     normals: {
 *       available: boolean,
 *       qaStatus: 'pass'|'warning'|'fail'|null,
 *     },
 *     pixelAddressable: boolean|null,
 *   },
 *   semantics: {
 *     pixelCorrespondence: 'unvalidated',
 *     denseGeometryMeaning: 'unvalidated',
 *   },
 *   issues: string[],
 * }} AnatomicalRegionEvidenceRecordV0
 */

/**
 * @typedef {{
 *   contract: 'anatomical-region-evidence-v0',
 *   version: 'anatomical-region-evidence-v0',
 *   view: 'front'|'side',
 *   summary: {
 *     totalEligibleRegions: number,
 *     presentRegions: number,
 *     absentRegions: number,
 *   },
 *   regions: AnatomicalRegionEvidenceRecordV0[],
 * }} AnatomicalRegionEvidenceReportV0
 */

/**
 * Builds pure deterministic Anatomical Region Evidence Report for a single view (Front or Side).
 *
 * @param {object|null|undefined} normalizedSegmentation - Normalized segmentation payload or observed regions report
 * @param {{
 *   view?: 'front'|'side'|string|null,
 *   denseQa?: { pointmap?: object|null, normals?: object|null, crossModal?: object|null }|null,
 *   crossModalQa?: object|null,
 *   pointmap?: object|null,
 *   normals?: object|null,
 *   widthPx?: number|null,
 *   heightPx?: number|null,
 * }} [options]
 * @returns {AnatomicalRegionEvidenceReportV0}
 */
export function buildAnatomicalRegionEvidence(normalizedSegmentation, {
  view,
  denseQa = null,
  crossModalQa = null,
  pointmap = null,
  normals = null,
  widthPx = null,
  heightPx = null,
} = {}) {
  const resolvedView = (typeof view === 'string' && view.trim())
    ? view.trim().toLowerCase()
    : (typeof normalizedSegmentation?.view === 'string' && normalizedSegmentation.view.trim()
      ? normalizedSegmentation.view.trim().toLowerCase()
      : 'front');

  // Obtain observed regions report (handles metric bounds conversion cleanly)
  const observedReport = (
    normalizedSegmentation?.contract === 'anatomical-region-v0'
    && Array.isArray(normalizedSegmentation?.regions)
  )
    ? normalizedSegmentation
    : buildObservedAnatomicalRegions(normalizedSegmentation, {
      view: resolvedView,
      widthPx: widthPx ?? normalizedSegmentation?.widthPx,
      heightPx: heightPx ?? normalizedSegmentation?.heightPx,
    });

  const observedByClassId = new Map(
    (observedReport?.regions ?? []).map((r) => [r.classId, r]),
  );

  // View-level Dense Modality Qualification
  const effectiveCrossModal = crossModalQa ?? denseQa?.crossModal ?? null;
  const pmAvailable = Boolean(
    pointmap?.present
    || denseQa?.pointmap
    || effectiveCrossModal?.availability?.pointmap
  );
  const pmQaStatus = (
    denseQa?.pointmap?.status
    ?? effectiveCrossModal?.modalityQa?.pointmap?.status
    ?? (pmAvailable && pointmap?.qa?.status ? pointmap.qa.status : null)
    ?? null
  );

  const normAvailable = Boolean(
    normals?.present
    || denseQa?.normals
    || effectiveCrossModal?.availability?.normals
  );
  const normQaStatus = (
    denseQa?.normals?.status
    ?? effectiveCrossModal?.modalityQa?.normals?.status
    ?? (normAvailable && normals?.qa?.status ? normals.qa.status : null)
    ?? null
  );

  let pixelAddressable = null;
  if (effectiveCrossModal && (pmAvailable || normAvailable)) {
    if (typeof effectiveCrossModal.compatibility?.pixelIndexAddressable === 'boolean') {
      pixelAddressable = effectiveCrossModal.compatibility.pixelIndexAddressable;
    } else if (typeof effectiveCrossModal.pixelIndexAddressable === 'boolean') {
      pixelAddressable = effectiveCrossModal.pixelIndexAddressable;
    }
  }

  let presentCount = 0;
  let absentCount = 0;

  const regions = ELIGIBLE_ANATOMICAL_REGION_CLASSES_V0.map((canonical) => {
    const observed = observedByClassId.get(canonical.classId) ?? null;
    const isPresent = Boolean(observed?.present);

    if (isPresent) {
      presentCount += 1;
    } else {
      absentCount += 1;
    }

    const pixelCount = isPresent && typeof observed.pixelCount === 'number' && Number.isFinite(observed.pixelCount)
      ? observed.pixelCount
      : 0;

    const coverage = isPresent && typeof observed.coverage === 'number' && Number.isFinite(observed.coverage)
      ? observed.coverage
      : 0;

    const boundsPx = isPresent ? sanitizeBoundsPx(observed.boundsPx) : null;
    const boundsNormalized = isPresent ? formatBoundsNormalized(observed.boundsNormalized) : null;
    const boundsCm = isPresent && observed.boundsCm ? { ...observed.boundsCm } : null;

    const issues = [];

    return {
      classId: canonical.classId,
      label: canonical.label,
      category: canonical.category,
      laterality: canonical.laterality,
      view: resolvedView,
      segmentation: {
        present: isPresent,
        pixelCount,
        coverage,
        boundsPx,
        boundsNormalized,
        boundsCm,
      },
      denseEvidence: {
        pointmap: {
          available: pmAvailable,
          qaStatus: pmQaStatus,
        },
        normals: {
          available: normAvailable,
          qaStatus: normQaStatus,
        },
        pixelAddressable,
      },
      semantics: {
        pixelCorrespondence: 'unvalidated',
        denseGeometryMeaning: 'unvalidated',
      },
      issues,
    };
  });

  return {
    contract: ANATOMICAL_REGION_EVIDENCE_CONTRACT_VERSION,
    version: ANATOMICAL_REGION_EVIDENCE_CONTRACT_VERSION,
    view: resolvedView,
    summary: {
      totalEligibleRegions: TOTAL_ELIGIBLE_ANATOMICAL_REGIONS_V0,
      presentRegions: presentCount,
      absentRegions: absentCount,
    },
    regions,
  };
}

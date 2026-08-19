/**
 * Front–Side Alignment Contract v0
 *
 * Pure domain correspondence and QA report between normalized Front (X/Y)
 * and Side (U/Y) Body Evidence candidates.
 *
 * Compares vertical Y agreement (verticalDeltaCm = |front.y - side.y|)
 * using canonical landmark identity.
 *
 * STRICT GUARDRAIL:
 * This module is correspondence/QA only.
 * It does NOT convert U to Z, infer depth, reconstruct 3D geometry,
 * promote side candidates, calculate circumference/ellipses/volume, or fuse segmentations.
 * Front { x, y } and Side { u, y } remain independent 2D evidence coordinates.
 */

import {
  CORE_FRONT_BODY_ANCHORS,
  SECONDARY_FRONT_BODY_ANCHORS,
  isCoreFrontBodyAnchor,
  isSecondaryBodyAnchorCandidate,
  normalizeLandmarkName,
} from './bodyEvidenceAdapter.js';

export const FRONT_SIDE_ALIGNMENT_VERSION = 'front-side-alignment-v0';
export const FRONT_SIDE_ALIGNMENT_CONTRACT = 'front-side-alignment-v0';

/**
 * Default vertical alignment tolerance threshold in centimeters (v0).
 * Pairs with verticalDeltaCm <= DEFAULT_ALIGNMENT_TOLERANCE_CM are marked 'aligned'.
 * Pairs with verticalDeltaCm > DEFAULT_ALIGNMENT_TOLERANCE_CM are marked 'warning'.
 */
export const DEFAULT_ALIGNMENT_TOLERANCE_CM = 5.0;

export const ALIGNMENT_STATUS = Object.freeze({
  ALIGNED: 'aligned',
  WARNING: 'warning',
  UNAVAILABLE: 'unavailable',
});

/**
 * Canonical landmark identity ordering for deterministic output sorting.
 * Core 13 followed by Secondary allowlist.
 */
export const CANONICAL_LANDMARK_ORDER = Object.freeze([
  ...CORE_FRONT_BODY_ANCHORS,
  ...SECONDARY_FRONT_BODY_ANCHORS,
]);

const CANONICAL_ORDER_INDEX = new Map(
  CANONICAL_LANDMARK_ORDER.map((name, index) => [name, index]),
);

/**
 * Deterministic sort comparator for landmark identity strings or objects with identity/name.
 *
 * @param {string|{ identity?: string, name?: string }} a
 * @param {string|{ identity?: string, name?: string }} b
 * @returns {number}
 */
export function compareLandmarkIdentities(a, b) {
  const nameA = typeof a === 'string' ? a : (a?.identity ?? a?.name ?? '');
  const nameB = typeof b === 'string' ? b : (b?.identity ?? b?.name ?? '');

  const indexA = CANONICAL_ORDER_INDEX.has(nameA)
    ? CANONICAL_ORDER_INDEX.get(nameA)
    : Infinity;
  const indexB = CANONICAL_ORDER_INDEX.has(nameB)
    ? CANONICAL_ORDER_INDEX.get(nameB)
    : Infinity;

  if (indexA !== indexB) {
    return indexA - indexB;
  }
  return nameA.localeCompare(nameB);
}

/**
 * Extract 2D Front Surface coordinates { x, y } in cm from a candidate object.
 *
 * @param {object} candidate
 * @returns {{ x: number|null, y: number|null }|null}
 */
function extractFrontCoordinates(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const rawX = candidate.x ?? candidate.spaceX ?? candidate.h;
  const rawY = candidate.y ?? candidate.spaceY ?? candidate.v;

  const x = typeof rawX === 'number' && Number.isFinite(rawX) ? rawX : null;
  const y = typeof rawY === 'number' && Number.isFinite(rawY) ? rawY : null;

  if (x === null && y === null) {
    return null;
  }
  return { x, y };
}

/**
 * Extract 2D Side Evidence coordinates { u, y } in cm from a candidate object.
 *
 * @param {object} candidate
 * @returns {{ u: number|null, y: number|null }|null}
 */
function extractSideCoordinates(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const rawU = candidate.u ?? candidate.sideUcm ?? candidate.h;
  const rawY = candidate.y ?? candidate.sideYcm ?? candidate.v;

  const u = typeof rawU === 'number' && Number.isFinite(rawU) ? rawU : null;
  const y = typeof rawY === 'number' && Number.isFinite(rawY) ? rawY : null;

  if (u === null && y === null) {
    return null;
  }
  return { u, y };
}

/**
 * Resolve whether a landmark identity is 'core' or 'secondary'.
 *
 * @param {string} identity
 * @param {object} [candidate]
 * @returns {'core'|'secondary'}
 */
function resolveClassification(identity, candidate) {
  const normalized = normalizeLandmarkName(identity);
  if (isCoreFrontBodyAnchor(normalized)) {
    return 'core';
  }
  if (isSecondaryBodyAnchorCandidate(normalized)) {
    return 'secondary';
  }
  if (candidate?.candidateType === 'secondary') {
    return 'secondary';
  }
  if (candidate?.candidateType === 'core') {
    return 'core';
  }
  return 'secondary';
}

/**
 * Index a collection of candidate objects by normalized landmark identity.
 *
 * @param {Array<object>} candidates
 * @param {(candidate: object) => object|null} coordinateExtractor
 * @returns {Map<string, {
 *   identity: string,
 *   rawName: string,
 *   classification: 'core'|'secondary',
 *   coords: object|null,
 *   score: number|null,
 *   lowConfidence: boolean,
 * }>}
 */
function indexCandidates(candidates, coordinateExtractor) {
  const byIdentity = new Map();

  for (const item of Array.isArray(candidates) ? candidates : []) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const rawName = item.name ?? item.identity ?? item.id;
    const identity = normalizeLandmarkName(rawName);
    if (!identity) {
      continue;
    }

    const coords = coordinateExtractor(item);
    const classification = resolveClassification(identity, item);
    const score = typeof item.score === 'number' && Number.isFinite(item.score)
      ? item.score
      : null;
    const lowConfidence = Boolean(item.lowConfidence);

    // Keep first entry with valid coordinates, or first entry seen
    if (!byIdentity.has(identity)) {
      byIdentity.set(identity, {
        identity,
        rawName: String(rawName),
        classification,
        coords,
        score,
        lowConfidence,
      });
    } else {
      const existing = byIdentity.get(identity);
      if ((!existing.coords || existing.coords.y === null) && coords && coords.y !== null) {
        byIdentity.set(identity, {
          identity,
          rawName: String(rawName),
          classification,
          coords,
          score,
          lowConfidence,
        });
      }
    }
  }

  return byIdentity;
}

/**
 * @typedef {{
 *   identity: string,
 *   name: string,
 *   classification: 'core'|'secondary',
 *   front: { x: number|null, y: number|null },
 *   side: { u: number|null, y: number|null },
 *   verticalDeltaCm: number|null,
 *   status: 'aligned'|'warning'|'unavailable',
 * }} MatchedAlignmentPair
 */

/**
 * @typedef {{
 *   identity: string,
 *   name: string,
 *   classification: 'core'|'secondary',
 *   front: { x: number|null, y: number|null },
 *   status: 'unavailable',
 *   reason: string,
 * }} FrontOnlyIdentityRecord
 */

/**
 * @typedef {{
 *   identity: string,
 *   name: string,
 *   classification: 'core'|'secondary',
 *   side: { u: number|null, y: number|null },
 *   status: 'unavailable',
 *   reason: string,
 * }} SideOnlyIdentityRecord
 */

/**
 * @typedef {{
 *   contract: string,
 *   version: string,
 *   toleranceCm: number,
 *   summary: {
 *     totalFront: number,
 *     totalSide: number,
 *     totalMatched: number,
 *     alignedCount: number,
 *     warningCount: number,
 *     unavailableCount: number,
 *     frontOnlyCount: number,
 *     sideOnlyCount: number,
 *     coreMatchedCount: number,
 *     secondaryMatchedCount: number,
 *   },
 *   matchedPairs: MatchedAlignmentPair[],
 *   frontOnly: FrontOnlyIdentityRecord[],
 *   sideOnly: SideOnlyIdentityRecord[],
 * }} FrontSideAlignmentReport
 */

/**
 * Compute pure Front–Side alignment correspondence and QA vertical agreement.
 *
 * @param {Array<object>|{ frontCandidates?: Array<object>, sideCandidates?: Array<object>, front?: Array<object>, side?: Array<object>, toleranceCm?: number }} arg1
 * @param {Array<object>} [arg2]
 * @param {{ toleranceCm?: number }} [arg3]
 * @returns {FrontSideAlignmentReport}
 */
export function computeFrontSideAlignment(arg1, arg2, arg3) {
  let frontCandidates;
  let sideCandidates;
  let options = {};

  if (Array.isArray(arg1)) {
    frontCandidates = arg1;
    sideCandidates = Array.isArray(arg2) ? arg2 : [];
    if (arg3 && typeof arg3 === 'object') {
      options = arg3;
    }
  } else if (arg1 && typeof arg1 === 'object') {
    frontCandidates = Array.isArray(arg1.frontCandidates)
      ? arg1.frontCandidates
      : (Array.isArray(arg1.front) ? arg1.front : []);
    sideCandidates = Array.isArray(arg1.sideCandidates)
      ? arg1.sideCandidates
      : (Array.isArray(arg1.side) ? arg1.side : []);
    options = arg1;
  } else {
    frontCandidates = [];
    sideCandidates = [];
  }

  const toleranceCm = (typeof options.toleranceCm === 'number'
    && Number.isFinite(options.toleranceCm)
    && options.toleranceCm >= 0)
    ? options.toleranceCm
    : DEFAULT_ALIGNMENT_TOLERANCE_CM;

  const frontIndex = indexCandidates(frontCandidates, extractFrontCoordinates);
  const sideIndex = indexCandidates(sideCandidates, extractSideCoordinates);

  const allIdentities = new Set([...frontIndex.keys(), ...sideIndex.keys()]);
  const matchedPairs = [];
  const frontOnly = [];
  const sideOnly = [];

  for (const identity of allIdentities) {
    const frontEntry = frontIndex.get(identity);
    const sideEntry = sideIndex.get(identity);

    if (frontEntry && sideEntry) {
      const frontCoords = frontEntry.coords;
      const sideCoords = sideEntry.coords;
      const frontY = frontCoords?.y;
      const sideY = sideCoords?.y;

      const hasValidY = typeof frontY === 'number'
        && Number.isFinite(frontY)
        && typeof sideY === 'number'
        && Number.isFinite(sideY);

      let verticalDeltaCm = null;
      let status = ALIGNMENT_STATUS.UNAVAILABLE;

      if (hasValidY) {
        verticalDeltaCm = Math.abs(frontY - sideY);
        status = verticalDeltaCm <= toleranceCm
          ? ALIGNMENT_STATUS.ALIGNED
          : ALIGNMENT_STATUS.WARNING;
      }

      const classification = frontEntry.classification === 'core'
        || sideEntry.classification === 'core'
        ? 'core'
        : 'secondary';

      matchedPairs.push({
        identity,
        name: frontEntry.rawName || sideEntry.rawName || identity,
        classification,
        front: {
          x: frontCoords?.x ?? null,
          y: frontCoords?.y ?? null,
        },
        side: {
          u: sideCoords?.u ?? null,
          y: sideCoords?.y ?? null,
        },
        verticalDeltaCm,
        status,
      });
    } else if (frontEntry) {
      const frontCoords = frontEntry.coords;
      frontOnly.push({
        identity,
        name: frontEntry.rawName || identity,
        classification: frontEntry.classification,
        front: {
          x: frontCoords?.x ?? null,
          y: frontCoords?.y ?? null,
        },
        status: ALIGNMENT_STATUS.UNAVAILABLE,
        reason: 'missing-in-side',
      });
    } else if (sideEntry) {
      const sideCoords = sideEntry.coords;
      sideOnly.push({
        identity,
        name: sideEntry.rawName || identity,
        classification: sideEntry.classification,
        side: {
          u: sideCoords?.u ?? null,
          y: sideCoords?.y ?? null,
        },
        status: ALIGNMENT_STATUS.UNAVAILABLE,
        reason: 'missing-in-front',
      });
    }
  }

  matchedPairs.sort(compareLandmarkIdentities);
  frontOnly.sort(compareLandmarkIdentities);
  sideOnly.sort(compareLandmarkIdentities);

  let alignedCount = 0;
  let warningCount = 0;
  let unavailableCount = 0;
  let coreMatchedCount = 0;
  let secondaryMatchedCount = 0;

  for (const pair of matchedPairs) {
    if (pair.status === ALIGNMENT_STATUS.ALIGNED) {
      alignedCount += 1;
    } else if (pair.status === ALIGNMENT_STATUS.WARNING) {
      warningCount += 1;
    } else {
      unavailableCount += 1;
    }

    if (pair.classification === 'core') {
      coreMatchedCount += 1;
    } else {
      secondaryMatchedCount += 1;
    }
  }

  return {
    contract: FRONT_SIDE_ALIGNMENT_CONTRACT,
    version: FRONT_SIDE_ALIGNMENT_VERSION,
    toleranceCm,
    summary: {
      totalFront: frontIndex.size,
      totalSide: sideIndex.size,
      totalMatched: matchedPairs.length,
      alignedCount,
      warningCount,
      unavailableCount,
      frontOnlyCount: frontOnly.length,
      sideOnlyCount: sideOnly.length,
      coreMatchedCount,
      secondaryMatchedCount,
    },
    matchedPairs,
    frontOnly,
    sideOnly,
  };
}

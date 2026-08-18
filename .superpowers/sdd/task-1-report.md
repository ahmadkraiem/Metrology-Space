# Task 1 Report: Lock the Body Evidence Classification Contract

## What Was Implemented

### `bodyEvidenceAdapter.js`

1. **`SECONDARY_SIDE_BODY_ANCHORS`** — exported frozen allowlist with the same eight exact safe identities as Front secondary (acromion, heel, big toe, small toe × left/right), stored as a separate set so Side classification never mirrors or infers beyond emitted names.

2. **`classifyPoseLandmarks(landmarks, { view = 'front' })`** — view-aware classification:
   - Core always uses the unchanged core-13 identity contract (`CORE_FRONT_BODY_ANCHORS`).
   - Secondary uses `SECONDARY_FRONT_BODY_ANCHOR_SET` for `view: 'front'` and `SECONDARY_SIDE_BODY_ANCHOR_SET` for `view: 'side'`.
   - Face/head rejection and low-confidence handling unchanged.
   - Returns per-view pose fields: `core`, `secondary`, `rejectedFace`, `ignoredNonCore`, `lowConfidence`, `acceptedLandmarks`, `rejectedLandmarks`, `ignoredLandmarks`.
   - Non-exact Side names (e.g. `heel_prediction`, `left_thumb1`) are ignored/deferred, not promoted to secondary.

3. **`analyzeBodyEvidence`** — passes `{ view: 'front' }` / `{ view: 'side' }` to `classifyPoseLandmarks` and populates explicit per-view QA counts and detail arrays while retaining aggregate compatibility fields.

4. **New top-level QA fields:**
   - `frontCoreLandmarks`, `sideCoreLandmarks`
   - `frontSecondaryLandmarks`, `sideSecondaryLandmarks`
   - `frontRejectedFaceLandmarks`, `sideRejectedFaceLandmarks` (front existed; side added)
   - `frontIgnoredNonCoreLandmarks`, `sideIgnoredNonCoreLandmarks` (front existed; side added)
   - `secondarySideLandmarkNames`, `secondarySideAllowlist`, `ignoredSideLandmarks`, `rejectedSideLandmarks`

### `bodyEvidence.js` (Step 4 — diagnostic export only)

- **`exportPoseView()`** — exports `core` (replacing legacy `coreFront` count field); counts-only, no landmark records.
- **`buildBodyEvidenceExport()`** — extended QA section with all new per-view counts, side secondary allowlist/names, and side rejected/ignored detail arrays. No Scene State changes; no raw landmarks or segmentation base64.

### `bodyEvidenceAdapter.test.js`

Added three contract tests from the brief alongside four existing tests.

## What Was Tested and Results

| Command | Result |
|---------|--------|
| `node --test src/features/bodyEvidenceAdapter.test.js` | **7/7 pass** |
| `node --test src/features/bodyGraph.test.js` | **5/5 pass** |

## TDD Evidence

### RED (before implementation)

```
node --test src/features/bodyEvidenceAdapter.test.js
```

```
✔ classifies core, allowlisted secondary, rejected, and deferred landmark names
✔ accepts only the secondary allowlist as secondary candidates
✔ normalizes side prefix / suffix forms of secondary allowlist names
✔ reports a front-only secondary audit without side landmarks contaminating counts
✖ preserves Front core and secondary classification
  AssertionError: undefined !== 1  (result.core undefined)
✖ classifies only exact safe Side secondary identities
  AssertionError: undefined !== 1  (result.core undefined)
✖ reports rejected and ignored counts separately by view
  AssertionError: undefined !== 1  (result.qa.frontCoreLandmarks undefined)
ℹ tests 7 | pass 4 | fail 3
```

### GREEN (after implementation)

```
node --test src/features/bodyEvidenceAdapter.test.js
```

```
✔ classifies core, allowlisted secondary, rejected, and deferred landmark names
✔ accepts only the secondary allowlist as secondary candidates
✔ normalizes side prefix / suffix forms of secondary allowlist names
✔ reports a front-only secondary audit without side landmarks contaminating counts
✔ preserves Front core and secondary classification
✔ classifies only exact safe Side secondary identities
✔ reports rejected and ignored counts separately by view
ℹ tests 7 | pass 7 | fail 0
```

```
node --test src/features/bodyGraph.test.js
```

```
✔ Body Graph v0 contract is Core 13 nodes and 13 structural edges
✔ empty annotations yield all missing nodes/edges without throwing
✔ partial Core 13 keeps present nodes and marks incomplete edges Missing
✔ secondary promoted body landmarks are ignored by Body Graph v0
✔ normalized Core landmark names resolve into Body Graph nodes
ℹ tests 5 | pass 5 | fail 0
```

## Files Changed

| File | Action |
|------|--------|
| `src/features/bodyEvidenceAdapter.test.js` | Modified — added 3 contract tests, imported `classifyPoseLandmarks` |
| `src/features/bodyEvidenceAdapter.js` | Modified — view-aware classification, Side secondary allowlist, per-view QA |
| `src/features/bodyEvidence.js` | Modified — diagnostic export fields only |

## Self-Review Findings

1. **Front contract preserved** — existing tests for `classifyBodyLandmarkCandidate`, `isSecondaryBodyAnchorCandidate`, and front-only secondary audit still pass unchanged.
2. **Exact Side secondary gate** — `heel_prediction` and `left_thumb1` correctly land in `ignoredNonCore`; only `right_heel` qualifies as Side secondary.
3. **Per-view QA separation** — front `nose` and side `ear` each increment their view's rejected count; side `left_index` increments only `sideIgnoredNonCoreLandmarks`.
4. **Backward compatibility** — aggregate fields (`rejectedFaceLandmarks`, `ignoredNonCoreLandmarks`, `renderableFrontLandmarks`, `secondaryFrontLandmarks`) retained. `acceptedLandmarks` entries still carry `coreFront` boolean for overlay consumers.
5. **Scope respected** — no Side promotion, Alignment, Z/depth, Body Graph coupling, readiness coupling, Scene State schema, or documentation file changes.
6. **No commits** — changes left in working tree per user instruction.

## Concerns

1. **Diagnostic export breaking change (minor):** `exportPoseView()` now emits `core` instead of `coreFront`. Any external consumer of downloaded Body Evidence JSON expecting `coreFront` in per-view pose counts will need to read `core`. This aligns with the new contract but is a small export-shape change.
2. **`SECONDARY_SIDE_BODY_ANCHORS` duplicates Front values** — intentional per brief ("separate sets"); if Front secondary allowlist changes in future, Side list must be updated independently (or a shared source-of-truth constant introduced in a later task).
3. **`classifyBodyLandmarkCandidate` remains Front-oriented** — Side view enforcement is correctly delegated to `classifyPoseLandmarks`; callers using `classifyBodyLandmarkCandidate` directly still get Front secondary semantics only (unchanged, by design).

---

## Review Fix: `frontSecondaryLandmarks` QA Field

### What Changed

1. **`bodyEvidenceAdapter.js`** — Added `frontSecondaryLandmarks: frontPoseStats.secondary` alongside legacy `secondaryFrontLandmarks` in `analyzeBodyEvidence` QA object. Updated stale `isSecondaryBodyAnchorCandidate` comment to note Side classification is via `classifyPoseLandmarks`.
2. **`bodyEvidence.js`** — Mirrored `frontSecondaryLandmarks` in `buildBodyEvidenceExport()` QA section. Restored `coreFront` as alias next to `core` in `exportPoseView()` for diagnostic compatibility.
3. **`bodyEvidenceAdapter.test.js`** — Added assertions that `frontSecondaryLandmarks` exists, equals 2 for the front secondary case, and matches `secondaryFrontLandmarks`.

### Test Results (review fix)

```
node --test src/features/bodyEvidenceAdapter.test.js
```

```
✔ classifies core, allowlisted secondary, rejected, and deferred landmark names
✔ accepts only the secondary allowlist as secondary candidates
✔ normalizes side prefix / suffix forms of secondary allowlist names
✔ reports a front-only secondary audit without side landmarks contaminating counts
✔ preserves Front core and secondary classification
✔ classifies only exact safe Side secondary identities
✔ reports rejected and ignored counts separately by view
ℹ tests 7 | pass 7 | fail 0
```

```
node --test src/features/bodyGraph.test.js
```

```
✔ Body Graph v0 contract is Core 13 nodes and 13 structural edges
✔ empty annotations yield all missing nodes/edges without throwing
✔ partial Core 13 keeps present nodes and marks incomplete edges Missing
✔ secondary promoted body landmarks are ignored by Body Graph v0
✔ normalized Core landmark names resolve into Body Graph nodes
ℹ tests 5 | pass 5 | fail 0
```

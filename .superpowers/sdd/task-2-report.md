# Task 2 Report: Separate Side Core and Secondary Runtime Layers

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Implemented independent Side core and secondary runtime layers in `bodyEvidence.js` and `bodyEvidenceOverlaySide2d.js`. Side pose landmarks now flow through separate getters, visibility flags, and overlay rendering paths while preserving the unchanged U/Y mapping formula and all global constraints.

---

## Changes Made

### `src/features/bodyEvidence.js`

| Export | Purpose |
|--------|---------|
| `getSecondarySideBodyLandmarks()` | Side accepted landmarks where `secondary === true`, excluding low-confidence (matches Side core viz policy) |
| `isSideCoreBodyEvidenceVisible()` / `setSideCoreBodyEvidenceVisible()` | Independent core layer toggle |
| `isSideSecondaryBodyEvidenceVisible()` / `setSideSecondaryBodyEvidenceVisible()` | Independent secondary layer toggle |
| `isSideBodyEvidenceVisible()` / `setSideBodyEvidenceVisible()` | Compatibility wrapper — OR of both layers; setter toggles both (supports existing single checkbox in panel) |

**State:** Replaced single `sideOverlayVisible` with `sideCoreOverlayVisible` and `sideSecondaryOverlayVisible`.

**Lifecycle:**
- After analyze: each flag initializes from its own renderable candidate count
- On source load / clear / analyze failure: both reset to `false`

**Unchanged:** `getRenderableSideBodyLandmarks()` remains the Side core getter (core-13 whitelist, low-confidence excluded).

### `src/ui/bodyEvidenceOverlaySide2d.js`

- Added `mapSideLandmarksToCandidates(landmarks, idPrefix, candidateType)` — shared mapper adding `candidateType: 'core' | 'secondary'`
- Added `getSideCoreOverlayLandmarks()` and `getSideSecondaryOverlayLandmarks()` — respect per-layer visibility
- `getSideOverlayLandmarks()` — concatenates visible core + secondary layers
- `getSideCandidateLandmarks({ layer })` — optional `'core'` / `'secondary'` filter; default returns both (inspector list, ignores overlay visibility)
- Overlay render adds `side-evidence-marker--secondary` modifier for secondary candidates
- **`mapImagePointToSideEvidence()` — unchanged**

### `src/features/bodyEvidenceAdapter.test.js`

Added tests:
1. Side pose with `right_heel` → 1 secondary, 1 core, no duplication
2. Inline U/Y formula regression: `(1000 px, 500 px)` @ 2000 canvas / 10 px/cm → U 100 cm, Y 150 cm

---

## Test Results

```
node --test src/features/bodyEvidenceAdapter.test.js
```

**Result:** 9/9 PASS

---

## Self-Review

### Requirements met

- [x] Separate Side core and secondary getters from `qaResult.views.side.pose.acceptedLandmarks`
- [x] Low-confidence excluded from Side visualization (both layers)
- [x] Independent visibility flags with per-layer analyze init and reset on load/clear
- [x] Side overlay records include `candidateType`
- [x] Secondary modifier class rendered
- [x] `mapImagePointToSideEvidence()` untouched
- [x] No Side promotion handlers
- [x] No Front/Body Graph/readiness/Scene State changes
- [x] Exact allowlists only (uses Task 1 `secondary` flag from view-aware classification)

### Out of scope (deferred)

- **`bodyEvidencePanel.js`** still uses single Side checkbox via compatibility wrapper — separate toggles are Task 3+
- **`.side-evidence-marker--secondary` CSS** not added (only listed files modified); class is wired, styling can follow in overlays.css
- **Browser manual regression** for `(1000, 500)` not run in this session; formula verified by unit test

### Minor notes

- Side candidate IDs changed prefix from `body-evidence-side-*` to `body-evidence-side-core-*` / `body-evidence-side-secondary-*` — selection re-syncs on re-analyze
- Side secondary excludes low-confidence unlike Front secondary (per brief: "exactly as current Side core rendering does")

---

## Files Touched

- `src/features/bodyEvidence.js` (modified)
- `src/ui/bodyEvidenceOverlaySide2d.js` (modified)
- `src/features/bodyEvidenceAdapter.test.js` (modified)
- `.superpowers/sdd/task-2-report.md` (created)

# Task 7 Report: Clean and Normalize the Front/Side 2D Workspace

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Removed the Side plot overlay empty state, moved Side evidence status into the readout row, and aligned Front/Side pane chrome, plot frame, ticks, and titles. Outer 3D↔2D split and `DEFAULT_SPLIT_RATIO = 0.36` are unchanged. Side navigator domain, wheel/pan, local A/B, region refinement, and U/Y coordinates are unchanged.

---

## Changes Made

### `index.html`

- Deleted `#side-evidence-empty` from the Side plot.
- Added compact `#side-evidence-source-status` in the Side readout status row (not on the field).

### `src/ui/domRefs.js`

- Removed `sideEvidenceEmptyEl`.
- Added `sideEvidenceSourceStatusEl`.

### `src/ui/sideEvidenceStatus.js` (new)

Pure formatter for loaded/analyzed Side evidence copy. Covered by `src/ui/sideEvidenceStatus.test.js`.

### `src/features/bodyEvidence.js`

- Added `hasSidePoseSource()` so the readout can distinguish loaded-but-unanalyzed from missing Side Pose. No analysis, mapping, or Scene State changes.

### `src/ui/sideGrid2dNavigator.js`

- Updates the readout status from `hasSidePoseSource()`, `hasAnalyzedBodyEvidence()`, and QA core/secondary counts.
- Removed empty-overlay hide/dimming. Navigator math, `BASE_DOMAIN` / `BASE_STEP` / `MIN_DETAIL_STEP`, wheel/pan, local A/B, refinement, and U/Y markers untouched.

### `src/styles/overlays.css`

- Removed `.side-evidence-empty` and `.side-evidence-viewport--empty`.
- Front and Side plots share the `.grid2d-grid-wrapper` border; Side keeps crosshair cursor only.
- Matching toolbar group flex; stacked toolbar at `@container workspace-2d (max-width: 620px)`.
- Horizontal titles stay in the bottom gutter (below ticks). Vertical titles sit at the outer left; 0–200 ticks sit just outside the plot edge.
- Header title/view-mode ellipsis so chrome does not overlap at narrow widths.

### `src/styles/layout.css`

- `min-width: 0` on 2D headers and toolbar groups. Split fallback remains `flex: 0 0 36%`.

---

## Side navigator preservation (Step 4)

Unchanged:

- `BASE_DOMAIN`, `BASE_STEP`, `MIN_DETAIL_STEP`
- Side wheel/pan handlers
- local Side A/B math/history
- region refinement
- Side U/Y marker coordinates (`mapImagePointToSideEvidence` / plot projection)

`DEFAULT_SPLIT_RATIO` remains `0.36` in `src/ui/workspaceLayout.js`.

---

## Build / Tests

```
npm run build
```

**Result:** PASS (Vite 6.4.3, 67 modules, ~2.28s). Chunk size warning only (pre-existing Three.js bundle size).

```
node --test src/ui/sideEvidenceStatus.test.js src/features/bodyEvidenceAdapter.test.js src/features/bodyGraph.test.js src/ui/bodyEvidenceCandidateList.test.js
```

**Result:** 21/21 pass.

TDD: status tests failed first (`ERR_MODULE_NOT_FOUND` for `sideEvidenceStatus.js`), then passed after the formatter was added.

---

## Self-Review

### Requirements met

- [x] `#side-evidence-empty` and its DOM ref/CSS removed
- [x] Compact Side evidence status in readout; updated from loaded/analyzed state; no field overlay
- [x] Front and Side header / readout / plot / legend / toolbar spacing aligned
- [x] Outer 3D↔2D divider and `DEFAULT_SPLIT_RATIO = 0.36` preserved
- [x] Shared plot inset/metrics, border, 0–200 ticks, 10 cm lattice, bottom-left origin
- [x] Horizontal titles below ticks; vertical titles outside the left tick gutter
- [x] Front remains X/Y; Side remains U/Y
- [x] Side navigator behavior listed in Step 4 unchanged
- [x] Narrow-width CSS: wrap/ellipsis so headers and toolbars do not overlap
- [x] `npm run build` PASS
- [x] No commits; no PROJECT_CONTEXT.md / PROJECT_STRUCTURE.md / REFACTOR_PLAN.md edits

### Concerns / deferred

- Live pixel inspection in the running app at exact sidebar widths was not performed; wrap/ellipsis/container-query rules were applied in CSS.
- Side readout has one extra status span versus Front, so the Side status row can wrap one line earlier at very narrow pane widths. Selection-block height is still reserved, so the plot should not jump.
- `hasSidePoseSource()` was added in `bodyEvidence.js` (beyond the original file list) because loaded-before-analyze state is not on `qaResult`.

---

## Files Touched

- `index.html` (modified)
- `src/ui/domRefs.js` (modified)
- `src/ui/sideGrid2dNavigator.js` (modified)
- `src/ui/sideEvidenceStatus.js` (created)
- `src/ui/sideEvidenceStatus.test.js` (created)
- `src/features/bodyEvidence.js` (modified; `hasSidePoseSource` only)
- `src/styles/layout.css` (modified)
- `src/styles/overlays.css` (modified)
- `.superpowers/sdd/task-7-report.md` (created)

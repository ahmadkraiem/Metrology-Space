# Task 6 Report: Normalize View Controls and Menu Structure

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Reordered View Controls into Reference / Scene / 2D / Evidence, split the combined Side checkbox into independent Side Core and Side Secondary toggles, and mirrored the same eleven settings (labels, order, group separators) in the View menu. Both surfaces call `applyViewSetting` / `toggleViewSetting`; Side layers remain visual-only and do not touch Front or canonical state.

---

## Changes Made

### `index.html`

View Controls groups:

| Group | Items |
|---|---|
| Reference | Origin / Center |
| Scene | Annotations, Measurement Lines, 3D Lattice Points |
| 2D | Front Grid Points, Side Grid Points |
| Evidence | Front Core, Front Secondary, Side Core, Side Secondary, Body Measurement Previews |

- Removed **Scene Overlays** / **Grid / Points** / **2D Views** labels.
- Replaced combined `#show-side-body-candidates` with `#show-side-core` and `#show-side-secondary`.
- View menu uses the same labels and order, with separators between the four groups.
- Menu items keep `data-view-setting` ids from Task 3 (`origin-center` … `body-previews`).

### `src/ui/domRefs.js`

- Removed `showSideBodyCandidatesCheckbox`.
- Added `showSideCoreCheckbox` (`#show-side-core`) and `showSideSecondaryCheckbox` (`#show-side-secondary`).

### `src/ui/viewControls.js`

- Side Core and Side Secondary each bind through `bindCheckbox` → `applyViewSetting`.
- `syncEvidenceCheckboxes()` syncs the two Side checkboxes independently (checked from Task 2 visibility APIs; disabled when unanalyzed or that layer has count 0).
- Combined Side listener that toggled both layers is gone.

### `src/ui/appMenuBar.js`

- View menu still calls `toggleViewSetting(id, menuDeps)` for every `data-view-setting` item.
- Checked/disabled still come from `getViewSetting` (checkbox + evidence availability).
- Comment documents the 1:1 View Controls / `VIEW_SETTING_IDS` mirror.

### `src/ui/bodyEvidencePanel.js`

- `syncOverlayControls()` now syncs Side Core and Side Secondary independently, matching Front Core / Front Secondary.
- Dropped `isSideBodyEvidenceVisible` (compatibility wrapper remains in `bodyEvidence.js` unused by UI).

### `src/styles/components.css`

- Tighter View Controls subgroup gap.
- Disabled evidence checkboxes: default cursor + reduced opacity via `:has(.view-control-checkbox:disabled)`.

---

## Visual-only / isolation (Step 3)

Code-path check (no data-clearing calls on toggle):

- `applyViewSetting` for evidence ids only calls `setBodyEvidenceOverlayVisible`, `setSecondaryBodyEvidenceVisible`, `setSideCoreBodyEvidenceVisible`, `setSideSecondaryBodyEvidenceVisible`.
- Side setters mutate only `sideCoreOverlayVisible` / `sideSecondaryOverlayVisible` and notify subscribers. Front uses separate `overlayVisible` / `secondaryCandidatesVisible`.
- No `clearBodyEvidence`, annotation, Body Graph, readiness, or Scene State mutation on view toggle.
- Side Core off does not force Side Secondary off (and vice versa); neither writes Front visibility.

Paired UI: checkbox `change` → `applyViewSetting` → `syncCheckbox`; menu item → `toggleViewSetting` → same apply path → checkbox updated; menu refresh on open / after toggle.

---

## Build Result

```
npm run build
```

**Result:** PASS (Vite 6.4.3, 66 modules, ~1.21s). Chunk size warning only (pre-existing Three.js bundle size).

---

## Self-Review

### Requirements met

- [x] View Controls order: Reference / Scene / 2D / Evidence as specified
- [x] Separate Side Core and Side Secondary checkboxes through `applyViewSetting`
- [x] View menu mirrors the same eleven settings; each item calls `toggleViewSetting`
- [x] Checked/disabled sync from matching checkbox + evidence availability
- [x] Visual-only toggles; Side layers isolated from Front and canonical state
- [x] `npm run build` PASS
- [x] No commits; no PROJECT_CONTEXT.md / PROJECT_STRUCTURE.md / REFACTOR_PLAN.md edits

### Concerns / deferred

- Live click-through of every toggle in the running app was not performed in this session; pairing and isolation were verified from the apply/setters path.
- `isSideBodyEvidenceVisible` / `setSideBodyEvidenceVisible` remain as unused Task 2 compatibility wrappers.
- View Controls still live in the left inspector for all workflows (visibility-only; unchanged).
- Evidence checkboxes stay disabled until analyze produces that layer’s landmarks (same Task 3 enablement).

---

## Files Touched

- `index.html` (modified)
- `src/ui/domRefs.js` (modified)
- `src/ui/viewControls.js` (modified)
- `src/ui/appMenuBar.js` (modified)
- `src/ui/bodyEvidencePanel.js` (modified; consumer of split Side refs)
- `src/styles/components.css` (modified)
- `.superpowers/sdd/task-6-report.md` (created)

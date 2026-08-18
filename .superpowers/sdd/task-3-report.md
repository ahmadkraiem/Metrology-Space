# Task 3 Report: Centralize Existing UI Actions and View Settings

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Centralized View settings behind `applyViewSetting` / `getViewSetting` / `toggleViewSetting`, exported shared Body Evidence and file/import/export actions from their owners, and added a CAD-style Application Menu that binds to those same actions (no DOM click forwarding from the menu).

---

## Changes Made

### `src/ui/viewControls.js`

| Export | Purpose |
|--------|---------|
| `VIEW_SETTING_IDS` | Frozen registry of all View setting ids |
| `applyViewSetting(id, visible, deps)` | Single apply path for checkboxes + menu |
| `getViewSetting(id)` | `{ checked, disabled }` from checkbox / Body Evidence APIs |
| `toggleViewSetting(id, deps)` | Menu-friendly toggle respecting disabled |

- All existing View Control checkboxes call `applyViewSetting`.
- Evidence checkboxes (`FRONT_CORE`, `FRONT_SECONDARY`) moved here from the panel.
- `SIDE_CORE` / `SIDE_SECONDARY` bind to Task 2 visibility APIs.
- Existing single Side checkbox still toggles both layers (Task 6 will split markup).

### `src/ui/bodyEvidencePanel.js`

Exported shared actions:

- `openFrontPoseFilePicker` / `openSidePoseFilePicker` / `openFrontSegFilePicker` / `openSideSegFilePicker`
- `runAnalyzeBodyEvidenceAction` / `runClearBodyEvidenceAction` / `runPromoteFrontEvidenceAction` / `runDownloadBodyEvidenceAction`
- `focusBodyEvidenceTab(tab)` — switches Body Evidence workflow + stores tab id (tab UI is Task 4)
- `getBodyEvidencePanelTab()`

Existing buttons call the same exported actions. Overlay checkbox listeners removed (owned by `viewControls`).

### `src/features/sceneImport.js`

- `openSceneStateFilePicker()` — only place that `.click()`s `#load-scene-json`
- JSON parsing / `importSceneState` remain in the existing `change` handler

### `src/features/sceneExport.js`

- `runExportSceneStateAction()` — shared export entry; button + menu both use it
- Serialization stays in `downloadSceneStateJson` / `buildSceneState`

### `src/ui/appMenuBar.js` (new)

- File / Edit / View / Workspace / Body menus
- One open menu at a time; outside-click + Escape close; ArrowUp/Down + Enter/Space
- Checked View + Workspace items; disabled Analyze / Download / Promote / evidence layers / Edit clears when unavailable
- Refresh on Body Evidence change, annotation change, workspace change, and menu-open
- Does **not** import file-input refs or call `.click()` itself
- Does **not** render Undo/Redo, Reset Layout, Side Promote, Alignment, or Z commands

### `src/ui/inspectorWorkflow.js`

- `focusBodyEvidenceWorkflow()` — shared Body Evidence workflow focus helper

### `src/ui/workspaceLayout.js`

- `subscribeWorkspaceChange(listener)` — menu refresh without new workspace state
- Existing `setWorkspace` / `getWorkspace` used as shared workspace actions

### Shell markup / styles / wiring

- `index.html` — `#app-menu-bar` under `#top-header`
- `src/ui/domRefs.js` — `appMenuBarEl`
- `src/styles/layout.css` — menu row + pointer-events for the interactive menu
- `src/styles/components.css` — menu dropdown / checked / disabled styles
- `src/main.js` — one `setupAppMenuBar({...})` call after feature/UI setup

---

## Build Result

```
npm run build
```

**Result:** PASS (Vite 6.4.3, 65 modules, ~2.08s). Chunk size warning only (pre-existing Three.js bundle size).

---

## Self-Review

### Requirements met

- [x] View setting registry + shared apply/get/toggle
- [x] Body Evidence UI actions exported; buttons + menu share them
- [x] File-picker/import/export shared actions in owners; menu never `.click()`s inputs
- [x] No second parser/importer/exporter/state store
- [x] Menu open-one / Escape / outside-click / arrow nav / checked+disabled sync
- [x] `main.js` one import + one setup call
- [x] SIDE_CORE / SIDE_SECONDARY bound to Task 2 APIs
- [x] No Undo/Redo / Reset Layout / Side Promote / Alignment / Z
- [x] No commits; no PROJECT_CONTEXT.md / PROJECT_STRUCTURE.md / REFACTOR_PLAN.md edits

### Concerns / deferred

- **Side View Controls markup** still has one combined Side checkbox; menu already exposes separate Side Core / Secondary (checkbox split is Task 6).
- **`focusBodyEvidenceTab`** stores the tab and focuses the Body Evidence workflow (+ switches to 2D Workspace for Front/Side); tab panel UI is Task 4.
- **Edit menu enablement** for selection/measurement/history refreshes on menu-open (and after command), not on every selection change — matches brief refresh surfaces.
- **Circular import risk avoided:** `appMenuBar` → panel/actions; panel → `viewControls`; `viewControls` does not import the panel/menu.

---

## Files Touched

- `src/ui/viewControls.js` (modified)
- `src/ui/bodyEvidencePanel.js` (modified)
- `src/ui/inspectorWorkflow.js` (modified)
- `src/ui/workspaceLayout.js` (modified)
- `src/ui/appMenuBar.js` (created)
- `src/features/sceneImport.js` (modified)
- `src/features/sceneExport.js` (modified)
- `src/main.js` (modified)
- `src/ui/domRefs.js` (modified)
- `index.html` (modified)
- `src/styles/layout.css` (modified)
- `src/styles/components.css` (modified)
- `.superpowers/sdd/task-3-report.md` (created)

---

## Review Fix (2026-08-17)

**Finding:** `refreshMenuState` only queried `[data-command]`; View menu items use `data-view-setting` only, so checked/disabled never updated.

**Fix:**
- `src/ui/appMenuBar.js` — split refresh into command loop (Edit/Workspace/Body disabled + Workspace checked) and a separate `[data-view-setting]` loop calling `getViewSetting(id)` for `aria-checked` / disabled sync.
- `src/ui/bodyEvidencePanel.js` — `focusBodyEvidenceTab` now calls shared `focusBodyEvidenceWorkflow()` instead of duplicating `setInspectorWorkflow(WORKFLOW_BODY_EVIDENCE)`.
- Skipped removing `sideCount` in `syncOverlayControls` — still used for `bodyEvidenceSideCountEl` display.

**Build:** `npm run build` — PASS (Vite 6.4.3, 65 modules, ~1.46s).

# Task 3 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `CURSOR.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

### Task 3: Centralize Existing UI Actions and View Settings

**Files:**
- Modify: `src/ui/viewControls.js`
- Modify: `src/ui/bodyEvidencePanel.js`
- Modify: `src/ui/inspectorWorkflow.js`
- Modify: `src/features/sceneImport.js`
- Create: `src/ui/appMenuBar.js`
- Modify: `src/main.js`

**Interfaces:**
- `applyViewSetting(id, visible, deps): void`
- `getViewSetting(id): { checked: boolean, disabled: boolean }`
- `toggleViewSetting(id, deps): void`
- `openFrontPoseFilePicker(): void`
- `openSidePoseFilePicker(): void`
- `openFrontSegFilePicker(): void`
- `openSideSegFilePicker(): void`
- `openSceneStateFilePicker(): void`
- `runExportSceneStateAction(): void`
- `runDownloadBodyEvidenceAction(): void`
- `focusBodyEvidenceTab(tab: 'overview'|'front'|'side'|'selection'): void`
- `runAnalyzeBodyEvidenceAction(): void`
- `runClearBodyEvidenceAction(): void`
- `runPromoteFrontEvidenceAction(): void`
- `setupAppMenuBar({ measurement, selectionHighlight, referenceMarkers, volumeGrid }): void`

- [ ] **Step 1: Refactor each checkbox listener through one apply function**

Create a setting registry for the implemented controls:

```js
const VIEW_SETTING_IDS = Object.freeze({
  ORIGIN_CENTER: 'origin-center',
  ANNOTATIONS: 'annotations',
  MEASUREMENT_LINES: 'measurement-lines',
  LATTICE_3D: 'lattice-3d',
  FRONT_GRID: 'front-grid',
  SIDE_GRID: 'side-grid',
  FRONT_CORE: 'front-core',
  FRONT_SECONDARY: 'front-secondary',
  SIDE_CORE: 'side-core',
  SIDE_SECONDARY: 'side-secondary',
  BODY_PREVIEWS: 'body-previews',
});
```

The existing checkbox listener and future menu command must both call `applyViewSetting`; neither owns duplicate visibility state.

- [ ] **Step 2: Export Body Evidence UI action entry points**

Rename/refactor private `onAnalyze`, `onClear`, and `onPromoteSelected` into exported action functions. Existing buttons and menu commands call those functions so status text, enablement, lists, and overlays refresh identically.

- [ ] **Step 3: Expose shared file-picker/import/export actions**

Each existing feature/UI owner exports a focused action. Both the current control and the menu call that action:

```js
export function openFrontPoseFilePicker() {
  loadFrontPoseJsonInput?.click();
}

export function openSceneStateFilePicker() {
  loadSceneJsonInput?.click();
}
```

The internal `.click()` is permitted only inside the shared file-picker action because browsers require the real file input to open a picker. `appMenuBar.js` must not import file-input/button DOM refs or call `.click()` itself.

Keep JSON parsing in the existing input `change` handlers. Keep Scene State validation/restore in `sceneImport.js`, Scene State serialization/download in `sceneExport.js`, and Body Evidence source loading/diagnostic download in their current owners. No second parser, importer, exporter, or state implementation is created.

- [ ] **Step 4: Build the menu behavior**

In `appMenuBar.js`, implement:

- one open menu at a time
- outside-click and Escape close
- ArrowUp/ArrowDown navigation within an open menu
- checked state for View and Workspace items
- disabled state for unavailable Analyze/Download/Promote/layers
- state refresh from Body Evidence changes, annotation changes, workspace changes, and menu-open

Call exported shared actions for file pickers, clear/export/workspace/body commands. Existing controls must call the same exported actions. Do not render Undo/Redo, Reset Layout, Side Promote, Alignment, or Z commands.

- [ ] **Step 5: Initialize from `main.js`**

Add one import and one setup call after existing feature/UI setup has established dependencies:

```js
setupAppMenuBar({
  measurement,
  selectionHighlight,
  referenceMarkers,
  volumeGrid: internalVolumeGrid,
});
```

- [ ] **Step 6: Build**

Run: `npm run build`

Expected: Vite build succeeds with no unresolved imports.

---

## Design context (Application Menu)

## Application Menu

Add a compact CAD-style bar to the top shell:

- File: four Body Evidence source inputs, Scene State import/export, Body Evidence diagnostic download.
- Edit: clear canonical selection, active canonical measurement, measurement history, and Body Evidence.
- View: existing reference, scene, grid, evidence, and preview visibility controls. Checked/disabled states mirror authoritative state.
- Workspace: 3D Space, 2D Workspace, Body Graph.
- Body: Analyze Body Evidence, focus Front, focus Side, and Front Promote when eligible.

No placeholder command is rendered. File commands activate the existing hidden file inputs; parsing and state mutation remain in their existing owners. Export/download commands call existing feature functions. Menu state is synchronized after underlying state changes.

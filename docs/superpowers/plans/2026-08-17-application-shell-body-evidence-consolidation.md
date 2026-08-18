# Application Shell and Body Evidence Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the REVacity application shell and Body Evidence UI, correct per-view QA accounting, and add deterministic Side secondary evidence without changing canonical metrology semantics.

**Architecture:** Extend the pure Body Evidence adapter first, then expose separate view-specific evidence getters/visibility state. Rebuild the left and right Body Evidence presentations over that state, add a menu that calls shared actions, and finish by normalizing the existing Front/Side workspace chrome. Keep `main.js` orchestration-only and keep all Side U/Y data outside canonical annotations, Body Graph, Body Measurement Readiness, and Scene State.

**Tech Stack:** Vite 6, browser ES modules, Three.js 0.175, semantic HTML/CSS, Node `node:test`.

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `CURSOR.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

## File Structure

**Create**

- `src/ui/appMenuBar.js` — menu behavior and shared command bindings.
- `src/ui/bodyEvidenceCandidateList.js` — reusable compact candidate-row/list renderer.
- `src/features/bodyEvidenceAdapter.test.js` — deterministic adapter/accounting tests.

**Modify**

- `index.html` — menu markup, Body Evidence tabs, compact right-panel clarifiers, clean Side empty status markup.
- `src/main.js` — initialize the menu only.
- `src/features/bodyEvidenceAdapter.js` — explicit per-view core/secondary/rejected/ignored accounting.
- `src/features/bodyEvidence.js` — Side secondary getter and separate Side core/secondary visibility.
- `src/ui/bodyEvidenceOverlaySide2d.js` — render/filter Side core and secondary layers independently.
- `src/ui/bodyEvidencePanel.js` — tab controller, shared list rendering, single Selection details, exported UI action entry points.
- `src/ui/bodyTabConsolidatedPanel.js` — compact totals plus per-view advanced breakdown.
- `src/ui/viewControls.js` — centralized apply/read/toggle functions shared with menu.
- `src/ui/inspectorWorkflow.js` — exported Body Evidence workflow focus helper if not already sufficient.
- `src/ui/domRefs.js` — new menu/tab/toggle/status refs; remove obsolete Side overlay ref.
- `src/ui/sideGrid2dNavigator.js` — status-above-plot handling and obsolete overlay removal.
- `src/ui/workspaceLayout.js` — expose existing workspace action/state to menu without new state.
- `src/styles/layout.css` — top-shell/menu row and responsive sizing.
- `src/styles/components.css` — menu, Body Evidence tabs, compact lists, scroll regions, right-panel clarifiers.
- `src/styles/overlays.css` — normalized Front/Side plot chrome and removal of obsolete Side overlay rules.

---

### Task 1: Lock the Body Evidence Classification Contract

**Files:**
- Create: `src/features/bodyEvidenceAdapter.test.js`
- Modify: `src/features/bodyEvidenceAdapter.js`

**Interfaces:**
- Produces: `SECONDARY_SIDE_BODY_ANCHORS: readonly string[]`
- Produces: `classifyPoseLandmarks(landmarks, { view })`
- Produces per-view pose fields: `core`, `secondary`, `rejectedFace`, `ignoredNonCore`, `lowConfidence`, `acceptedLandmarks`, `rejectedLandmarks`, `ignoredLandmarks`
- Produces top-level QA fields: `frontCoreLandmarks`, `frontSecondaryLandmarks`, `sideCoreLandmarks`, `sideSecondaryLandmarks`, `frontRejectedFaceLandmarks`, `sideRejectedFaceLandmarks`, `frontIgnoredNonCoreLandmarks`, `sideIgnoredNonCoreLandmarks`

- [ ] **Step 1: Write failing adapter tests**

Use `node:test` to cover:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBodyEvidence,
  classifyPoseLandmarks,
} from './bodyEvidenceAdapter.js';

const point = (name, score = 0.9) => ({ name, x: 100, y: 200, score });

test('preserves Front core and secondary classification', () => {
  const result = classifyPoseLandmarks([
    point('left_shoulder'),
    point('right_heel'),
    point('nose'),
    point('left_index'),
  ], { view: 'front' });
  assert.equal(result.core, 1);
  assert.equal(result.secondary, 1);
  assert.equal(result.rejectedFace, 1);
  assert.equal(result.ignoredNonCore, 1);
});

test('classifies only exact safe Side secondary identities', () => {
  const result = classifyPoseLandmarks([
    point('left_shoulder'),
    point('right_heel'),
    point('heel_prediction'),
    point('left_thumb1'),
  ], { view: 'side' });
  assert.equal(result.core, 1);
  assert.equal(result.secondary, 1);
  assert.equal(result.ignoredNonCore, 2);
  assert.deepEqual(
    result.acceptedLandmarks.filter((entry) => entry.secondary).map((entry) => entry.name),
    ['right_heel'],
  );
});

test('reports rejected and ignored counts separately by view', () => {
  const result = analyzeBodyEvidence({
    frontPose: { landmarks: [point('left_shoulder'), point('nose')] },
    sidePose: { landmarks: [point('right_hip'), point('ear'), point('left_index')] },
  });
  assert.equal(result.qa.frontCoreLandmarks, 1);
  assert.equal(result.qa.sideCoreLandmarks, 1);
  assert.equal(result.qa.frontRejectedFaceLandmarks, 1);
  assert.equal(result.qa.sideRejectedFaceLandmarks, 1);
  assert.equal(result.qa.frontIgnoredNonCoreLandmarks, 0);
  assert.equal(result.qa.sideIgnoredNonCoreLandmarks, 1);
  assert.equal(result.qa.rejectedFaceLandmarks, 2);
  assert.equal(result.qa.ignoredNonCoreLandmarks, 1);
});
```

- [ ] **Step 2: Run the tests and confirm the new contract fails**

Run: `node --test src/features/bodyEvidenceAdapter.test.js`

Expected: FAIL because the view-aware fields and Side secondary contract do not exist yet.

- [ ] **Step 3: Implement view-aware exact classification**

Keep `CORE_FRONT_BODY_ANCHORS` and `SECONDARY_FRONT_BODY_ANCHORS` unchanged. Define `SECONDARY_SIDE_BODY_ANCHORS` from the same exact safe identities and separate sets. Add a `view` option without using arbitrary keyword acceptance:

```js
export function classifyPoseLandmarks(landmarks, { view = 'front' } = {}) {
  const secondarySet = view === 'side'
    ? SECONDARY_SIDE_BODY_ANCHOR_SET
    : SECONDARY_FRONT_BODY_ANCHOR_SET;
  // Existing face rejection and low-confidence handling remain.
  // Core uses the unchanged core-13 identity contract.
  // Secondary uses secondarySet.has(normalizeLandmarkName(name)).
}
```

Pass `{ view: 'front' }` and `{ view: 'side' }` from `analyzeBodyEvidence`. Populate explicit per-view QA counts and name/detail arrays while retaining current aggregate fields for compatibility.

- [ ] **Step 4: Update diagnostic export compatibility**

In `src/features/bodyEvidence.js`, extend `exportPoseView()` and `buildBodyEvidenceExport()` with the corrected fields. Do not add Body Evidence to Scene State and do not include raw landmarks or segmentation base64.

- [ ] **Step 5: Run adapter and Body Graph tests**

Run:

```powershell
node --test src/features/bodyEvidenceAdapter.test.js
node --test src/features/bodyGraph.test.js
```

Expected: all tests pass.

---

### Task 2: Separate Side Core and Secondary Runtime Layers

**Files:**
- Modify: `src/features/bodyEvidence.js`
- Modify: `src/ui/bodyEvidenceOverlaySide2d.js`

**Interfaces:**
- Produces: `getSecondarySideBodyLandmarks(): Landmark[]`
- Produces: `isSideCoreBodyEvidenceVisible()`, `setSideCoreBodyEvidenceVisible(boolean)`
- Produces: `isSideSecondaryBodyEvidenceVisible()`, `setSideSecondaryBodyEvidenceVisible(boolean)`
- Retains compatibility wrapper only if needed: `isSideBodyEvidenceVisible()`

- [ ] **Step 1: Add a failing pure classification assertion**

Extend the adapter test to assert a Side pose containing `right_heel` exposes one Side secondary and does not duplicate it in Side core.

- [ ] **Step 2: Implement separate getters and visibility flags**

Filter Side core and secondary from `qaResult.views.side.pose.acceptedLandmarks`. Exclude low-confidence entries from visualization exactly as current Side core rendering does. Initialize each visibility flag from its own candidate count after analyze; reset both on source load and clear.

- [ ] **Step 3: Update Side overlay records**

Have `getSideCandidateLandmarks({ layer })` or separate core/secondary getters map the same `imageX/imageY` through the unchanged:

```js
sideUcm = imageX / pixelsPerCm;
sideYcm = (canvasSize - imageY) / pixelsPerCm;
```

Add `candidateType: 'core' | 'secondary'`. Render a secondary modifier class only; do not alter coordinates, infer missing sides, or create promotion handlers.

- [ ] **Step 4: Verify coordinate stability**

Keep `mapImagePointToSideEvidence()` unchanged and verify in the running browser that the existing source point `(1000 px, 500 px)` still renders/readouts as `U 100 cm, Y 150 cm` under the fixed 2000 px canvas / 10 px-per-cm mapping. This is a regression check, not a new coordinate implementation.

Run: `node --test src/features/bodyEvidenceAdapter.test.js`

Expected: PASS.

---

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

### Task 4: Replace the Stacked Left Body Evidence Panel

**Files:**
- Create: `src/ui/bodyEvidenceCandidateList.js`
- Modify: `index.html`
- Modify: `src/ui/domRefs.js`
- Modify: `src/ui/bodyEvidencePanel.js`
- Modify: `src/styles/components.css`

**Interfaces:**
- `renderEvidenceCandidateList({ container, landmarks, source, selectedId, promotedNames, onSelect }): void`
- `setBodyEvidencePanelTab(tab): void`
- `setBodyEvidenceCandidateLayer(source, layer): void`

- [ ] **Step 1: Replace Body Evidence panel markup**

Keep the existing top-level workflow. Inside `#body-evidence-panel`, add:

```html
<div class="body-evidence-tabs" role="tablist">
  <button data-body-evidence-tab="overview">Overview</button>
  <button data-body-evidence-tab="front">Front</button>
  <button data-body-evidence-tab="side">Side</button>
  <button data-body-evidence-tab="selection">Selection</button>
</div>
```

Create one panel per tab. Overview holds compact import/actions plus the QA grid. Front and Side each hold one Core/Secondary segmented toggle and one list container. Selection holds the sole detailed coordinate card and actions.

- [ ] **Step 2: Implement the reusable compact row renderer**

Rows contain:

```text
Readable Name | confidence | optional Promoted
```

Coordinates belong only in `title`/Selection, not visible row text. Side rows never include a Promote badge/action.

- [ ] **Step 3: Implement tab and sub-toggle state**

Default to Overview. Keep active Front/Side layer UI-only. Preserve `candidateType: 'core' | 'secondary'` when creating Front or Side selection records. Selecting a candidate from a list or plot makes Front/Side selections mutually exclusive and focuses Selection. Selection empty state remains compact.

- [ ] **Step 4: Render full Selection details**

Front:

- source Front
- X/Y
- confidence
- Core/Secondary
- promoted state
- Promote only when selected and allowed

Side:

- source Side
- U/Y
- confidence
- Core/Secondary
- no X/Z, no canonical label, no Body Graph membership, no Promote

- [ ] **Step 5: Add bounded list scrolling**

Use a viewport-relative maximum:

```css
.body-evidence-candidate-scroll {
  max-height: clamp(12rem, 34vh, 24rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

Keep Selection outside the list scroll area.

- [ ] **Step 6: Remove old stacked rendering and refs**

Delete obsolete candidate group/summary rendering and DOM refs only after all callers are migrated. Keep historical stub files untouched.

- [ ] **Step 7: Build and manually inspect**

Run: `npm run build`

Expected: build passes; left workflow has one active internal tab and no stacked full lists.

---

### Task 5: Correct the Right Session Body Presentation

**Files:**
- Modify: `index.html`
- Modify: `src/ui/bodyTabConsolidatedPanel.js`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes Task 1 QA fields.
- Promoted/readiness sections continue consuming annotations only.

- [ ] **Step 1: Update compact Body Evidence Status**

Render loaded file chips and:

```text
Front Core
Front Secondary
Side Core
Side Secondary
Rejected Total
Ignored / Deferred Total
Low Confidence
Scale
Segmentation
```

Avoid copying the left Overview wording/status card verbatim.

- [ ] **Step 2: Add per-view advanced breakdown**

Advanced details must show Front/Side core, secondary, rejected, ignored, low-confidence, and view-specific lists. Keep segmentation metadata collapsible and keep raw masks excluded.

- [ ] **Step 3: Clarify canonical sections**

Add static subtitles:

```text
Canonical promoted anchors
Based on promoted canonical body landmarks
```

Do not change `getPromotedBodyAnchors`, `buildBodyAnchorAudit`, or `buildAnatomicalMeasurementLines` inputs.

- [ ] **Step 4: Verify canonical isolation**

With Side evidence loaded but no promoted annotations, confirm Promoted Body Anchors remains empty and all six readiness rows remain Missing.

- [ ] **Step 5: Run tests/build**

Run:

```powershell
node --test src/features/bodyGraph.test.js
npm run build
```

Expected: tests and build pass.

---

### Task 6: Normalize View Controls and Menu Structure

**Files:**
- Modify: `index.html`
- Modify: `src/ui/domRefs.js`
- Modify: `src/ui/viewControls.js`
- Modify: `src/ui/appMenuBar.js`
- Modify: `src/styles/components.css`

**Interfaces:**
- Consumes Task 2 visibility state and Task 3 setting registry.

- [ ] **Step 1: Reorder View Controls markup**

Use:

```text
REFERENCE: Origin / Center
SCENE: Annotations, Measurement Lines, 3D Lattice Points
2D: Front Grid Points, Side Grid Points
EVIDENCE: Front Core, Front Secondary, Side Core, Side Secondary, Body Measurement Previews
```

- [ ] **Step 2: Mirror exact settings in View menu**

Each menu item calls `toggleViewSetting`. Checked and disabled state reflects the matching checkbox and evidence availability.

- [ ] **Step 3: Verify visual-only behavior**

Toggle each setting from both surfaces and confirm the paired UI updates, data is not cleared, and Side core/secondary layers do not affect Front or canonical state.

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: PASS.

---

### Task 7: Clean and Normalize the Front/Side 2D Workspace

**Files:**
- Modify: `index.html`
- Modify: `src/ui/domRefs.js`
- Modify: `src/ui/sideGrid2dNavigator.js`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/overlays.css`

**Interfaces:**
- Retains shared plot metrics from `grid2dPlotArea.js`.
- Retains Side mapping and local navigator state.

- [ ] **Step 1: Remove the Side plot overlay empty element**

Delete `#side-evidence-empty` from the plot and its DOM ref/CSS. Add a compact Side evidence status line in the readout/header area. Update it from analyzed/loaded state; never overlay instructions on the field.

- [ ] **Step 2: Normalize pane structure**

Make Front and Side use matching header, readout, plot, legend, and toolbar spacing. Preserve the outer 3D↔2D divider and `DEFAULT_SPLIT_RATIO = 0.36`.

- [ ] **Step 3: Normalize plot geometry**

Both plots use the same inset/metrics, border, 0–200 ticks, 10 cm lattice spacing, and bottom-left origin. Place horizontal titles below ticks and vertical titles outside the left tick gutter. Keep Front X/Y and Side U/Y.

- [ ] **Step 4: Preserve Side navigator behavior**

Do not change:

- `BASE_DOMAIN`
- `BASE_STEP`
- `MIN_DETAIL_STEP`
- Side wheel/pan behavior
- local Side A/B math/history behavior
- region refinement
- Side U/Y marker coordinates

- [ ] **Step 5: Responsive inspection**

At current sidebar widths and narrow center widths, verify headers/toolbars do not overlap and plot titles remain clear.

- [ ] **Step 6: Build**

Run: `npm run build`

Expected: PASS.

---

### Task 8: Cleanup and Full Regression Verification

**Files:**
- Review all modified files.
- Modify only files with confirmed dead refs/imports/duplicate rendering.

**Interfaces:**
- No new runtime interfaces.

- [ ] **Step 1: Remove confirmed obsolete code**

Search for old Side empty overlay refs/classes, old stacked candidate group refs, duplicate summary renderers, and unused imports. Retain documented historical stub files.

- [ ] **Step 2: Verify Scene State shape**

Use `buildSceneState` in a small Node test/import or inspect its unchanged return keys:

```text
metadata
sceneScale
appMode
referenceMarkers
activeMeasurement
measurementHistory
annotations
```

Confirm there is no Body Evidence, Side Evidence, or Body Graph key.

- [ ] **Step 3: Run the full automated verification**

Run:

```powershell
node --test src/features/bodyEvidenceAdapter.test.js
node --test src/features/bodyGraph.test.js
npm run build
```

Expected: all tests pass and Vite emits a successful production build.

- [ ] **Step 4: Perform the requested manual QA**

Verify:

- 3D Space and Body Graph visuals/behavior unchanged.
- Front 2D measurement, refinement, evidence mapping, and promotion unchanged.
- Side markers retain U/Y coordinates and no floating empty text exists.
- Front Core/Secondary and Side Core/Secondary counts match classified records.
- Rejected/Ignored totals equal Front + Side breakdowns.
- No duplicate, mirrored, or fabricated Side landmark appears.
- Side Selection has no Promote path.
- Candidate lists scroll internally; Selection is the only full evidence detail location.
- Right Promoted Anchors/Readiness remain canonical-only.
- Every menu command invokes an existing action and disabled states are accurate.
- Side local A/B/refinement behavior remains exactly as it was before this pass.
- Responsive sidebar and workspace layouts remain usable.

- [ ] **Step 5: Check diagnostics**

Use the IDE linter diagnostics for every modified JS/CSS/HTML file. Fix only issues introduced by this work.

- [ ] **Step 6: Prepare the final report**

Report files added/modified, menu structure, left tabs, Front/Side candidate policy/counts, per-view accounting, Selection behavior, plot/workspace cleanup, right panel/View Controls cleanup, dead-code cleanup, and exact build/test results. Explicitly confirm unchanged Side promotion, Alignment, canonical Z/depth, Body Graph integration, readiness semantics, canonical measurements, and Scene State schema.

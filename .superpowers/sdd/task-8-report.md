# Task 8 Report: Cleanup and Full Regression Verification

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Removed confirmed leftover Side empty-overlay / stacked-list artifacts and unused Side compatibility wrappers. Scene State version 1 keys are unchanged. Adapter tests 9/9, Body Graph tests 5/5, and `npm run build` all passed. Live controller/visual QA still needs a human in the running app.

---

## Files added / modified (Tasks 1–8, working tree)

### Created

- `src/ui/appMenuBar.js`
- `src/ui/bodyEvidenceCandidateList.js`
- `src/ui/bodyEvidenceCandidateList.test.js`
- `src/ui/sideEvidenceStatus.js`
- `src/ui/sideEvidenceStatus.test.js`
- `.superpowers/sdd/*` (briefs, reports, review packages)
- `docs/superpowers/plans/2026-08-17-application-shell-body-evidence-consolidation.md`
- `docs/superpowers/specs/2026-08-17-application-shell-body-evidence-consolidation-design.md`

### Modified

- `index.html`
- `src/main.js`
- `src/features/bodyEvidenceAdapter.js`
- `src/features/bodyEvidenceAdapter.test.js`
- `src/features/bodyEvidence.js`
- `src/features/sceneExport.js` (shared export action only; schema unchanged)
- `src/features/sceneImport.js` (shared file-picker action only)
- `src/ui/bodyEvidencePanel.js`
- `src/ui/bodyEvidenceCandidateList.js` (created above)
- `src/ui/bodyTabConsolidatedPanel.js`
- `src/ui/bodyEvidenceOverlay2d.js`
- `src/ui/bodyEvidenceOverlaySide2d.js`
- `src/ui/viewControls.js`
- `src/ui/domRefs.js`
- `src/ui/inspectorWorkflow.js`
- `src/ui/workspaceLayout.js`
- `src/ui/sideGrid2dNavigator.js`
- `src/styles/layout.css`
- `src/styles/components.css`
- `src/styles/overlays.css`

### Unchanged canonical modules (git diff empty)

- `src/features/bodyGraph.js`, `src/features/bodyGraph.test.js`
- `src/features/measurement.js`, `src/features/annotations.js`
- `src/features/sideMeasurement.js`
- `src/features/bodyMeasurementLines.js`
- `src/ui/bodyGraphWorkspace.js`

### Historical stubs

Documented stubs (`src/ui/bodyEvidenceQaPanel.js`, `bodyMeasurementLevelsPanel.js`, `bodyMeasurementLinesPanel.js`) are **not present in this branch’s git tree** and were **not created or deleted** in this pass. They remain unwired; no stub files were removed.

---

## Menu structure

CAD-style `#app-menu-bar` under the top header. Every item binds an existing owner action (no DOM `.click()` forwarding from the menu; no placeholder commands).

| Menu | Commands |
|---|---|
| **File** | Load Front/Side Pose JSON, Load Front/Side Seg JSON, Import/Export Scene State, Download Body Evidence JSON |
| **Edit** | Clear Selection, Clear Measurement, Clear Measurement History, Clear Body Evidence |
| **View** | Origin / Center; Annotations, Measurement Lines, 3D Lattice Points; Front Grid Points, Side Grid Points; Front Core, Front Secondary, Side Core, Side Secondary, Body Measurement Previews |
| **Workspace** | 3D Space, 2D Workspace, Body Graph |
| **Body** | Analyze Body Evidence, Focus Front Evidence, Focus Side Evidence, Promote Front Evidence |

Disabled when unavailable: Analyze (no sources), Download (not analyzed), Promote (no Front selection), Edit clears (empty selection/measurement/history/evidence), evidence View layers (unanalyzed or count 0). No Undo/Redo, Reset Layout, Side Promote, Alignment, or Z commands.

---

## Left tabs

Internal Body Evidence tabs: **Overview / Front / Side / Selection**. Default Overview.

- **Overview:** compact Import + Actions + QA grid (Front Core, Front Sec., Side Core, Side Sec., Rejected total, Ignored total, Status, Scale, Source). Live `#body-evidence-status` sits under the tablist.
- **Front / Side:** Core/Secondary segmented toggle + one bounded scrollable list (`max-height: clamp(12rem, 34vh, 24rem); overflow-y: auto`). Layer is UI-only and does not change overlay visibility.
- **Selection:** sole full coordinate card.

---

## Front / Side candidate policy and counts

- **Front core:** unchanged Core 13 (`CORE_FRONT_BODY_ANCHORS`).
- **Front secondary:** exact Front allowlist (acromion, heel, big toe, small toe × left/right).
- **Side core:** same Core 13 identities from Side pose (U/Y mapping; not canonical).
- **Side secondary:** `SECONDARY_SIDE_BODY_ANCHORS` — separate exact set of the same eight names. Only emitted normalized identities qualify. `heel_prediction`, `left_thumb1`, and other non-exact names are ignored/deferred. No mirroring, inference, or fabrication.
- Face/head → rejected; hand/finger/unknown → ignored/deferred.
- Adapter tests assert Side `right_heel` is secondary and not duplicated in core.

---

## Per-view accounting

`analyzeBodyEvidence` / `classifyPoseLandmarks({ view })` expose:

- Per-view: `core`, `secondary`, `rejectedFace`, `ignoredNonCore`, `lowConfidence`, accepted/rejected/ignored records
- Top-level: `frontCoreLandmarks`, `frontSecondaryLandmarks`, `sideCoreLandmarks`, `sideSecondaryLandmarks`, plus per-view rejected/ignored
- Totals: `rejectedFaceLandmarks = front + side`, `ignoredNonCoreLandmarks = front + side`

Left Overview shows totals; Session Body compact status shows Front/Side core/secondary plus those totals. Test `reports rejected and ignored counts separately by view`: front nose + side ear → rejected 1+1=2; side `left_index` → ignored 1.

---

## Selection behavior

- List row or plot marker selects one source and focuses Selection (`body-evidence-selection-focus`).
- **Front Selection:** source, X/Y cm, confidence, Core/Secondary, promoted state, Promote when eligible.
- **Side Selection:** source, U/Y cm, confidence, Core/Secondary. No X/Z, canonical label, Body Graph membership, or Promote. Promote button hidden; `#body-evidence-promote-status` cleared via `hidePromoteStatus()`.
- Promote uses `getSelectedBodyEvidenceLandmark()` (Front) → `frontSurfaceTo3d` → `body_landmark` annotation. Side selection cannot enter that path.

---

## Plot / workspace cleanup

- `#side-evidence-empty` / `.side-evidence-empty` / `.side-evidence-viewport--empty` / `sideEvidenceEmptyEl` gone. Side status is `#side-evidence-source-status` in the readout (`formatSideEvidenceStatus`).
- Front and Side share plot inset/metrics, 0–200 ticks, 10 cm lattice, bottom-left origin. Front X/Y; Side U/Y.
- `mapImagePointToSideEvidence`: `u = imageX / pxPerCm`, `y = (canvasSize - imageY) / pxPerCm` (test: 1000,500 @ 2000/10 → U 100, Y 150).
- Outer 3D↔2D split: `DEFAULT_SPLIT_RATIO = 0.36`. Side navigator `BASE_DOMAIN` / `BASE_STEP` / `MIN_DETAIL_STEP`, wheel/pan, local A/B, and region refinement live in unmodified `sideMeasurement.js` / existing navigator math.

---

## Right panel / View Controls cleanup

**Session Data → Body**

- Body Evidence Status: loaded chips + Front/Side core/secondary + Rejected/Ignored totals + low confidence / scale / segmentation. Advanced Details: per-view breakdowns and name lists.
- Promoted Body Anchors subtitle: `Canonical promoted anchors` — `getAnnotations()` filtered to `body_landmark` only.
- Body Measurement Readiness subtitle: `Based on promoted canonical body landmarks` — `buildBodyAnchorAudit(annotations)` + `buildAnatomicalMeasurementLines(annotations)` only. Six candidates unchanged: Shoulder Width, Elbow Span, Wrist Span, Hip Width, Knee Span, Ankle Span.

**View Controls** (same eleven settings, same order as View menu): Reference (Origin / Center) · Scene (Annotations, Measurement Lines, 3D Lattice Points) · 2D (Front Grid Points, Side Grid Points) · Evidence (Front Core, Front Secondary, Side Core, Side Secondary, Body Measurement Previews). Both surfaces call `applyViewSetting` / `toggleViewSetting`. Side toggles are visual-only.

---

## Dead-code cleanup (this task)

Removed:

- Unused CSS `.body-evidence-candidates--secondary` (old stacked Secondary list)
- Unused HTML class `body-evidence-candidates--side` (old stacked Side group marker)
- Unused compatibility wrappers `isSideBodyEvidenceVisible` / `setSideBodyEvidenceVisible`
- Unused exports `getSideOverlayLandmarkCount` / `getSideCandidateLandmarkCount`

Already gone before Task 8 (verified absent): `#side-evidence-empty`, `sideEvidenceEmptyEl`, `.side-evidence-empty`, `.side-evidence-viewport--empty`, stacked group/list refs (`bodyEvidenceCandidatesEl`, secondary group/list/count), combined `#show-side-body-candidates`.

No leftover unused imports in the Task 8 touch set. Historical stubs retained (not present; not deleted). Duplicate Overview vs Session Body summaries are intentional (compact workflow vs session accounting), not duplicate renderers.

---

## Scene State confirmation

`buildSceneState` return keys (source inspection; Node cannot import `sceneExport.js` because it loads `domRefs` / `document`):

```
metadata
sceneScale
appMode
referenceMarkers
activeMeasurement
measurementHistory
annotations
```

`git diff` on `sceneExport.js` adds only `runExportSceneStateAction`. No Body Evidence, Side Evidence, or Body Graph key. Import validator still requires metadata version 1, 200 cm cube, 5 cm sampling, 68,921 points, and the same measurement/annotation fields. Diagnostic Body Evidence JSON remains a separate download.

---

## Exact build / test results

```
node --test src/features/bodyEvidenceAdapter.test.js
```

**9/9 pass, fail 0** (duration ~138 ms)

```
node --test src/features/bodyGraph.test.js
```

**5/5 pass, fail 0** (duration ~143 ms)

```
npm run build
```

**PASS** — Vite 6.4.3, 67 modules transformed, built in 1.83s.  
Outputs: `dist/index.html` 46.30 kB, `index-CUEIjYAH.css` 65.43 kB, `index-D0-MxoFp.js` 646.24 kB.  
Chunk-size warning only (pre-existing Three.js bundle). No linter issues on Task 8 files.

---

## Unchanged (explicit)

- **Side promotion:** none. No Side Promote menu/command; Selection hides Promote for Side; `promoteSelectedBodyEvidenceLandmark` reads Front selection only.
- **Front-Side Alignment:** not present in menu, commands, or features.
- **Canonical Z / depth inference:** Side remains U/Y evidence plane only.
- **Body Graph integration:** still Core 13 nodes / 13 edges from promoted `body_landmark` annotations; Side evidence does not feed the graph. Tests 5/5.
- **Readiness semantics:** six annotation-only candidates; Side-only evidence cannot fill them.
- **Canonical measurements:** A/B/history and Front promotion unchanged (`measurement.js` / `annotations.js` diffs empty).
- **Scene State schema:** version 1, seven keys listed above.

---

## Manual QA (code-inspect vs live browser)

| Checklist item | Code-inspect | Live browser still required |
|---|---|---|
| 3D Space / Body Graph visuals | Graph contract + workspace wiring unchanged | Pixel/behavior click-through |
| Front 2D measure / refine / map / promote | Front overlay + promote path unchanged | Interaction in running app |
| Side U/Y markers; no empty overlay text | Mapping formula + overlay element removed | Plot pixels / no leftover float text |
| Core/Secondary counts match classified records | Adapter tests + Overview/Session bind QA fields | After loading real JSON |
| Rejected/Ignored totals = Front + Side | Adapter formula + unit test | UI totals after analyze |
| No mirrored/fabricated Side landmarks | Exact allowlist + tests | Inspect live Side list |
| Side Selection has no Promote | Button hidden; status cleared | Click Side row/marker |
| Lists scroll; Selection is only full detail | CSS + tab markup | Scroll/overflow at real heights |
| Right Promoted/Readiness canonical-only | Annotation-only helpers | Side-only fixture in UI |
| Menu commands + disabled states | `runCommand` / `refreshMenuState` map to owners | Open menus after load/analyze/select |
| Side local A/B / refinement | `sideMeasurement.js` unmodified | Wheel/pan/A/B/region in navigator |
| Responsive sidebar / workspace | CSS wrap/ellipsis/min-width | Narrow window / sidebar drag |

---

## Self-review

- [x] Confirmed obsolete overlay/stacked/wrapper/count dead code removed
- [x] Historical stubs not deleted
- [x] Scene State keys verified; no evidence/graph keys
- [x] Adapter 9/9, Body Graph 5/5, `npm run build` PASS
- [x] Manual QA code-inspected; live controller items listed
- [x] No Task 8 linter issues
- [x] No commits; no `CURSOR.md` / `PROJECT_STRUCTURE.md` / `REFACTOR_PLAN.md` edits

---

## Final-review fix: Overview QA count bindings (2026-08-17)

**Status:** Complete  
**Commits:** None (per user instruction)

### Issue

Left Overview Front/Side Core/Secondary cards used overlay/list renderable counts (`getFrontOverlayLandmarkCount`, `getSecondaryCandidateLandmarkCount`, `getSideCandidateLandmarks().length`) instead of Task 1 QA classification fields. That could disagree with Session Body and Side header when low-confidence or incomplete coords exist.

### Change

In `src/ui/bodyEvidencePanel.js` `syncOverlayControls()`, bound all six Overview QA cards to `getBodyEvidenceQa().qa`:

- Front Core → `frontCoreLandmarks` (still shown as `N / 13`)
- Front Secondary → `frontSecondaryLandmarks`
- Side Core → `sideCoreLandmarks`
- Side Secondary → `sideSecondaryLandmarks`
- Rejected → `rejectedFaceLandmarks`
- Ignored → `ignoredNonCoreLandmarks`

Front/Side tab list headings still use renderable list lengths (`refreshCandidateLists`). Removed unused overlay count imports.

### Verification

```
node --test src/features/bodyEvidenceAdapter.test.js  → 9/9 pass
node --test src/features/bodyGraph.test.js            → 5/5 pass
npm run build                                         → PASS (Vite 6.4.3, 67 modules)
```

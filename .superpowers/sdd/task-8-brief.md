# Task 8 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `PROJECT_CONTEXT.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

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

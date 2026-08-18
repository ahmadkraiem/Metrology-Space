# Task 2 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `CURSOR.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

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

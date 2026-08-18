# Task 6 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `PROJECT_CONTEXT.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

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

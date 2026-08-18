# Task 7 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `CURSOR.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

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

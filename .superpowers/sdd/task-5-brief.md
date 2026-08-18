# Task 5 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `CURSOR.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

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

## Design context

## Session Data Body Tab

Body Evidence Status remains session/data oriented:

- loaded input indicators
- Front Core and Secondary
- Side Core and Secondary
- rejected and ignored/deferred totals
- low-confidence count when available
- fixed scale
- segmentation QA status

Advanced Evidence Details contains Front/Side breakdowns and inspectable per-view rejected/ignored/secondary lists.

Promoted Body Anchors stays annotation-only and canonical. Body Measurement Readiness stays based only on promoted `body_landmark` annotations and keeps the existing six candidates. Brief subtitles clarify those boundaries without changing logic.

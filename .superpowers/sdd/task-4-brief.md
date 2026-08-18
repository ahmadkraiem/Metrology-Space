# Task 4 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `CURSOR.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

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

## Design context

## Left Body Evidence Workflow

Replace stacked Body Evidence subsections with internal tabs:

- Overview
- Front
- Side
- Selection

Overview contains compact workflow QA only: Front Core, Front Secondary, Side Core, Side Secondary, Rejected total, Ignored total, status, scale, and source. Loaded inputs may appear as compact indicators. Import and action controls remain compact and available without creating a new top-level workflow.

Front and Side each contain a Core/Secondary segmented toggle, candidate count, and one internally scrollable list. Rows show readable landmark name, confidence, and only essential state. Front may show Promoted. Side never shows Promote.

Selection is the only full evidence-coordinate detail view. Selecting a candidate or plot marker switches/focuses Selection and records a single active evidence source. Front shows X/Y, confidence, core/secondary, promoted state, and Promote when eligible. Side shows U/Y, confidence, and core/secondary only.

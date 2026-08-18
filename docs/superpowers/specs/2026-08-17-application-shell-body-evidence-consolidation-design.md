# Application Shell and Body Evidence Consolidation Design

## Scope

Consolidate the REVacity application shell, Body Evidence workflow, Front/Side evidence presentation, and QA accounting before further Side development. Preserve the existing 200 cm metrology space, canonical annotation and measurement contracts, Front promotion, Body Graph, Body Measurement Readiness, and Scene State schema.

The current runtime already contains a Side U/Y navigator, local grid refinement, and local Side A/B measurement. Those existing behaviors remain unchanged. This work does not add Side promotion, canonical Side annotations, Side-to-Body-Graph integration, Front-Side Alignment, canonical Z, or depth inference.

## Architecture

Use a targeted shared-action design rather than DOM click forwarding or a broad application-store rewrite.

- `src/ui/appMenuBar.js` owns menu open/close behavior, keyboard/accessibility behavior, checked/disabled rendering, and command binding.
- Existing feature/UI owners expose focused action functions where a command is currently trapped inside an event listener.
- Existing buttons, labels, checkboxes, workspace tabs, and menu items call those same actions.
- `src/ui/bodyEvidencePanel.js` remains the Body Evidence workflow controller but renders a tabbed layout.
- A small reusable candidate-list renderer handles Front/Side compact rows without duplicating markup.
- `src/features/bodyEvidenceAdapter.js` owns deterministic per-view classification and accounting.
- `src/features/bodyEvidence.js` owns independent Front core, Front secondary, Side core, and Side secondary visibility and selection state.
- Existing workspace modules retain Front/Side plot behavior and coordinate mappings.

`src/main.js` only initializes the new menu module and remains a thin orchestrator.

## Application Menu

Add a compact CAD-style bar to the top shell:

- File: four Body Evidence source inputs, Scene State import/export, Body Evidence diagnostic download.
- Edit: clear canonical selection, active canonical measurement, measurement history, and Body Evidence.
- View: existing reference, scene, grid, evidence, and preview visibility controls. Checked/disabled states mirror authoritative state.
- Workspace: 3D Space, 2D Workspace, Body Graph.
- Body: Analyze Body Evidence, focus Front, focus Side, and Front Promote when eligible.

No placeholder command is rendered. File commands activate the existing hidden file inputs; parsing and state mutation remain in their existing owners. Export/download commands call existing feature functions. Menu state is synchronized after underlying state changes.

## Left Body Evidence Workflow

Replace stacked Body Evidence subsections with internal tabs:

- Overview
- Front
- Side
- Selection

Overview contains compact workflow QA only: Front Core, Front Secondary, Side Core, Side Secondary, Rejected total, Ignored total, status, scale, and source. Loaded inputs may appear as compact indicators. Import and action controls remain compact and available without creating a new top-level workflow.

Front and Side each contain a Core/Secondary segmented toggle, candidate count, and one internally scrollable list. Rows show readable landmark name, confidence, and only essential state. Front may show Promoted. Side never shows Promote.

Selection is the only full evidence-coordinate detail view. Selecting a candidate or plot marker switches/focuses Selection and records a single active evidence source. Front shows X/Y, confidence, core/secondary, promoted state, and Promote when eligible. Side shows U/Y, confidence, and core/secondary only.

## QA Classification and Accounting

Preserve the Front classification contract exactly.

The adapter returns per-view classification records and counts for:

- core
- secondary
- rejected face/head
- ignored/deferred
- low confidence

Top-level QA exposes explicit Front and Side counts plus totals. Side secondary classification uses a dedicated exact allowlist derived from safe identities already present in the Front secondary contract:

- left/right acromion
- left/right heel
- left/right big toe
- left/right small toe

Only exact normalized identities actually emitted by the Side source qualify. No opposite-side mirroring, inferred landmarks, keyword expansion, face/head inclusion, or dense hand/finger promotion is allowed. Unknown body-looking landmarks remain ignored/deferred.

Diagnostic Body Evidence JSON may include the corrected QA fields, but raw source and mask persistence policies remain unchanged. Scene State JSON is untouched.

## Visibility

Use separate authoritative visibility flags for:

- Front core candidates
- Front secondary candidates
- Side core candidates
- Side secondary candidates
- Body measurement previews

View Controls and the View menu bind to these same flags. Side core/secondary markers use the existing U/Y mapping and point family. Hiding a layer remains visual-only.

## 2D Workspace

Keep the current 3D | Front | Side merged workspace and draggable outer split. Preserve the larger 2D default proportion.

Normalize Front and Side header, readout, plot, toolbar, padding, border, tick, axis-title, and point styling through shared CSS/layout primitives. Both plots retain a 0–200 cm domain, 10 cm visible spacing, and bottom-left origin. Front remains X/Y; Side remains U/Y.

Remove the Side empty-state element from the plot. A compact status above the plot communicates missing/unanalysed Side evidence while leaving the graph area clean.

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

## Error Handling and State Safety

- Invalid JSON remains handled by existing file-load paths.
- Menu items are disabled when their existing action is unavailable.
- Analyze and download retain existing validation and status messages.
- Re-analysis and clear retain current selection invalidation semantics.
- No menu or tab action mutates metrology, canonical measurement, annotation, Body Graph, or Scene State beyond its existing action.

## Verification

Add focused adapter tests for:

- unchanged Front core and secondary classification
- exact Side core and secondary classification
- per-view rejected/ignored accounting and totals
- low-confidence accounting
- absence of mirrored/fabricated/noisy Side candidates

Run:

- `npm run build`
- existing Body Graph tests
- new Body Evidence adapter tests

Manually verify menu action reuse, Front promotion, absence of Side promotion, plot coordinates, clean Side empty plot, scrollable candidate lists, single Selection detail location, canonical-only right panels, responsive sidebars, and unchanged Scene State shape.

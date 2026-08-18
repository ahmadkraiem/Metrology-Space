# Task 5 Report: Correct the Right Session Body Presentation

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Corrected Session Data → Body so Body Evidence Status is session/QA accounting (loaded chips + Front/Side core/secondary + totals), Advanced Evidence Details is a per-view breakdown with inspectable lists, and Promoted Body Anchors / Body Measurement Readiness stay annotation-only with static subtitles.

---

## Changes Made

### `index.html`

- Promoted Body Anchors subtitle: `Canonical promoted anchors`
- Body Measurement Readiness subtitle: `Based on promoted canonical body landmarks`

### `src/ui/bodyTabConsolidatedPanel.js`

Compact Body Evidence Status now renders loaded chips plus:

- Front Core / Front Secondary / Side Core / Side Secondary
- Rejected Total / Ignored / Deferred Total
- Low Confidence / Scale / Segmentation

Uses Task 1 QA fields (`frontCoreLandmarks`, `frontSecondaryLandmarks`, `sideCoreLandmarks`, `sideSecondaryLandmarks`, per-view rejected/ignored, totals). Does not copy Overview cards (`Front Sec.`, Status, Source) or the old Front-only ignored/rejected rows / combined Side candidates.

Advanced Evidence Details now has Front and Side sections, each with core, secondary, rejected, ignored/deferred, low-confidence counts and view-specific name lists. Segmentation metadata is a nested collapsible (classes, per-view label shape/dtype, rejected class names). Raw masks are not rendered.

`getPromotedBodyAnchors`, `buildBodyAnchorAudit(annotations)`, and `buildAnatomicalMeasurementLines(annotations)` inputs are unchanged.

### `src/styles/components.css`

- `.body-tab-section-subtitle` for the canonical clarifiers
- Advanced Front/Side view grouping (`.body-tab-advanced-body`, `.body-tab-advanced-view`, `.body-tab-seg-details`)

---

## Canonical Isolation (Step 4)

With Side pose only (`left_shoulder`, `right_heel`, `nose`) and no annotations:

- Adapter QA: Side Core 1, Side Secondary 1, Side Rejected 1, Front Core 0, Front Secondary 0
- `getPromotedBodyAnchors()` still filters `getAnnotations()` by `body_landmark` only → empty
- `renderBodyMeasurementReadiness()` still calls `buildBodyAnchorAudit(annotations)` and `buildAnatomicalMeasurementLines(annotations)` only → six candidates remain `Missing`

Side evidence cannot populate Promoted Body Anchors or readiness rows.

---

## Tests / Build

```
node --test src/features/bodyGraph.test.js
npm run build
```

**Tests:** 5/5 PASS  
**Build:** PASS (Vite 6.4.3, 66 modules, ~1.77s). Chunk size warning only (pre-existing Three.js bundle size).

---

## Self-Review

### Requirements met

- [x] Compact status: loaded chips + specified Front/Side/total/low-confidence/scale/segmentation rows
- [x] Right-panel wording/layout distinct from left Overview cards
- [x] Advanced Front/Side breakdowns and view-specific lists
- [x] Segmentation metadata collapsible; raw masks excluded
- [x] Static canonical subtitles
- [x] Promoted/readiness remain annotation-only; helper inputs unchanged
- [x] Side-only evidence does not fill Promoted Anchors or readiness
- [x] Body Graph tests and build pass
- [x] No commits; no PROJECT_CONTEXT.md / PROJECT_STRUCTURE.md / REFACTOR_PLAN.md edits

### Concerns / deferred

- Compact **Front Core / Side Core** still use the core-13 denominator (`n / 13`) because Side core identities are the same contract; Overview continues to show bare counts.
- Compact **Segmentation** is derived (`none` / `QA only` / `QA · N classes`), not a dedicated adapter status field.
- Node cannot import `bodyEvidence.js` / `bodyMeasurementLines.js` without a DOM/Three stub; isolation for those helpers was confirmed by source inspection plus a pure adapter Side-only fixture.
- No new UI unit tests (task specified Body Graph tests only).

---

## Files Touched

- `index.html` (modified)
- `src/ui/bodyTabConsolidatedPanel.js` (modified)
- `src/styles/components.css` (modified)
- `.superpowers/sdd/task-5-report.md` (created)

# Task 4 Report: Replace the Stacked Left Body Evidence Panel

**Date:** 2026-08-17  
**Status:** Complete  
**Commits:** None (per user instruction)

---

## Summary

Replaced the stacked Front / Secondary Front / Side / Selection subsections with internal Overview / Front / Side / Selection tabs. Front and Side each have a Core/Secondary segmented toggle and one bounded scrollable list. Selection is the only full coordinate card. Compact rows are rendered by a shared `renderEvidenceCandidateList` helper.

---

## Changes Made

### `src/ui/bodyEvidenceCandidateList.js` (new)

`renderEvidenceCandidateList({ container, landmarks, source, selectedId, promotedNames, onSelect, layer })`

- Visible row text: Readable Name | confidence | optional **Promoted** (Front only)
- Coordinates live in `title` only (X/Y Front, U/Y Side)
- Side rows never include a Promote badge/action, even if the name is in `promotedNames`

### `index.html`

- Tablist: Overview / Front / Side / Selection (`data-body-evidence-tab`)
- Overview: compact Import + Actions + QA grid
- QA grid: Front Core, Front Sec., Side Core, Side Sec., Rejected total, Ignored total, Status, Scale, Source
- Front / Side: Core/Secondary toggle + one list
- Selection: inspect card only; Promote starts hidden
- Live `#body-evidence-status` sits under the tablist so Analyze/load messages remain visible from any tab

### `src/ui/bodyEvidencePanel.js`

| Export | Purpose |
|--------|---------|
| `setBodyEvidencePanelTab(tab)` | Switch internal tab UI (default Overview) |
| `setBodyEvidenceCandidateLayer(source, layer)` | Front/Side Core/Secondary list layer (UI-only) |
| `focusBodyEvidenceTab(tab)` | Stores tab, applies tab UI, focuses Body Evidence workflow |

- Selecting a list row clears the other view and focuses Selection
- Plot marker click dispatches `body-evidence-selection-focus` (no circular overlay↔panel import)
- Front Selection: source, X/Y, confidence, Core/Secondary, promoted state, Promote when Front is selected
- Side Selection: source, U/Y, confidence, Core/Secondary; no X/Z, canonical label, Body Graph membership, or Promote
- Promote button hidden unless a Front landmark is selected; enablement otherwise unchanged

### `src/ui/domRefs.js`

Added Front/Side list + Side Secondary QA refs. Removed stacked group/list refs (`bodyEvidenceCandidatesEl`, secondary group/list/count, Side group/count).

### `src/styles/components.css`

Tabs, layer toggle, list heading, and:

```css
.body-evidence-candidate-scroll {
  max-height: clamp(12rem, 34vh, 24rem);
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

Removed the old stacked `max-height: 148px / 120px` list caps.

### Extra (required by Selection-focus / Core-Secondary details)

- `src/features/bodyEvidence.js` — persist `candidateType: 'core' | 'secondary'` on Front and Side selection records
- `src/ui/bodyEvidenceOverlay2d.js` / `bodyEvidenceOverlaySide2d.js` — plot select focuses Selection

### Tests

`src/ui/bodyEvidenceCandidateList.test.js` — Front Promoted/no visible coords; Side never Promote, U/Y in title only.

---

## Build Result

```
npm run build
node --test src/ui/bodyEvidenceCandidateList.test.js src/features/bodyEvidenceAdapter.test.js src/features/bodyGraph.test.js
```

**Build:** PASS (Vite 6.4.3, 66 modules, ~1.81s). Chunk size warning only (pre-existing Three.js bundle size).  
**Tests:** 16/16 PASS.

---

## Self-Review

### Requirements met

- [x] Stacked Body Evidence subsections replaced with Overview / Front / Side / Selection
- [x] Shared compact row renderer; coords not in visible row text
- [x] Side rows never include Promote
- [x] Front/Side Core/Secondary toggle + one scrollable list; layer is UI-only
- [x] Selection is the sole full detail card
- [x] Front Promote when selected/allowed; Side U/Y only
- [x] List or plot select is mutually exclusive and focuses Selection
- [x] Bounded list scroll CSS as specified
- [x] Obsolete stacked refs/rendering removed
- [x] Front classification and Front promotion unchanged
- [x] Side U/Y preserved; no Side promotion
- [x] No commits; no CURSOR.md / PROJECT_STRUCTURE.md / REFACTOR_PLAN.md edits

### Concerns / deferred

- **Overlay files** were updated for plot→Selection focus (not in the original Task 4 file list) via a document event to avoid a panel↔overlay import cycle.
- **`candidateType`** is now stored on selection records in `bodyEvidence.js` so Selection can show Core/Secondary without depending on the active list layer.
- **Overview Rejected/Ignored** now use per-view **totals** (`rejectedFaceLandmarks` / `ignoredNonCoreLandmarks`) instead of Front-only counts, matching the Overview contract. Right-panel copy is Task 5.
- **Live status** is outside the tab panels so menu Analyze/load feedback is visible when Front/Side/Selection is active.
- **Core/Secondary list toggle** does not change overlay visibility (View Controls / menu still own those flags).
- Historical stub files were not touched.

---

## Files Touched

- `src/ui/bodyEvidenceCandidateList.js` (created)
- `src/ui/bodyEvidenceCandidateList.test.js` (created)
- `index.html` (modified)
- `src/ui/domRefs.js` (modified)
- `src/ui/bodyEvidencePanel.js` (modified)
- `src/styles/components.css` (modified)
- `src/features/bodyEvidence.js` (modified — `candidateType` on selection records)
- `src/ui/bodyEvidenceOverlay2d.js` (modified — plot focuses Selection)
- `src/ui/bodyEvidenceOverlaySide2d.js` (modified — plot focuses Selection)
- `.superpowers/sdd/task-4-report.md` (created)

---

## Fix: Side Selection promote status leak (Important Task 4 finding)

**Date:** 2026-08-17  
**Issue:** After a Front promote, switching to Side Selection hid the Promote button but left `#body-evidence-promote-status` text visible.

**Change:** In `renderSelectedLandmark()` (`src/ui/bodyEvidencePanel.js`), call `hidePromoteStatus()` when rendering Side selection (evidence-only path). Front Selection unchanged — promote feedback still shown after Front promote.

**Build:** PASS (`npm run build`, Vite 6.4.3, 66 modules, ~1.77s).

**Commits:** None (per instruction).

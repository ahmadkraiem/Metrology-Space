# Project Structure — Latent Space / REVacity Metrology Space

This document describes the **current** file organization and code layout of the project. It is an audit for maintainability evaluation only — not a refactor plan.

Behavioral details are aligned with `CURSOR.md` as the source of truth for app functionality.

---

## 1. Current File Tree

```
latent-space/
├── index.html              # App shell, REVacity UI layout, script entry
├── package.json            # Vite + Three.js dependencies and scripts
├── package-lock.json       # Locked dependency versions
├── CURSOR.md               # Behavioral source of truth for AI/dev sessions
├── PROJECT_STRUCTURE.md    # This file — structural audit
├── REFACTOR_PLAN.md        # Historical staged refactor documentation (reference only)
├── .gitignore              # Ignores node_modules, dist, .DS_Store
├── src/
│   ├── main.js             # Application entry; thin orchestrator
│   ├── style.css           # Stylesheet entry; @import chain only (Phase 8)
│   ├── styles/
│   │   ├── variables.css   # Design tokens, reset, base page background
│   │   ├── layout.css      # App grid, header, sidebars, viewport/workspace panes, 3D / 2D Workspace / Body Graph modes (incl. default ~57% 3D split)
│   │   ├── components.css  # Inspector sections (subgroups, collapsible headers, workflow switch, Body Evidence panel incl. primary/secondary candidates/selected/promote, Body Tab Consolidation: Status counts + Advanced Details + Promoted Body Anchors table + Body Measurement Readiness, stacked Distance Measurement point name/coords), View Controls, Session Data tabs, workspace tabs, Body Graph Workspace styles, buttons, history, annotations, Scene Graph
│   │   └── overlays.css    # Hover tooltip, passive status bar, CSS2D label classes, Front Surface 2D Grid Navigator UI, shared measurement overlay, projected markers, Body Measurement Preview lines, Body Evidence overlay markers (primary + secondary; active = internal emphasis only), relative marker sizing vars
│   ├── core/
│   │   ├── constants.js    # Scale, grid, LOD, and tooltip constants
│   │   ├── frontSurface.js # Front Surface depth + 2D↔3D mapping helpers
│   │   ├── annotationTypes.js # Allowed annotation types, landmark preset mappings, normalize/fallback, display labels
│   │   ├── landmarkDisplay.js # Shared Title Case landmark / annotation display-name helper
│   │   ├── formatters.js   # Coordinate, point, annotation, and distance formatting
│   │   ├── math.js         # smoothstep and Euclidean distance helpers
│   │   └── scene.js        # Scene, camera, renderers, OrbitControls, resize
│   ├── features/
│   │   ├── annotations.js  # Point annotation state, 3D visuals, CSS2D labels, setAnnotationsVisible, setAnnotationsChangeHandler, add/delete, programmatic promote path, body_landmark pick helpers (getBodyLandmarkAnnotationTargets / findAnnotationByMarkerObject / measurementPointFromBodyLandmark), disposal
│   │   ├── annotationValidation.js # Validates annotation input before saving
│   │   ├── appMode.js      # App mode state and helpers (Inspect & Measure vs Annotate)
│   │   ├── measurement.js  # Shared Point A/B measurement state, markers, line, floating label, history, clear/advance, optional session-local point label for body-landmark picks, setMeasurement3dLinesVisible, setMeasurement3dChangeHandler
│   │   ├── frontSurfaceMeasurement.js # Front Surface advance/read helpers over shared measurement (advanceSharedMeasurement / advanceFrontSurfaceMeasurement; no separate 2D A/B state)
│   │   ├── projectionLinking.js # Front Surface projection of Origin/Center/annotations into #grid2d-markers; Inspect & Measure body_landmark projected clicks advance shared A/B; View Controls sync; annotation hover without duplicate projection coords
│   │   ├── bodyEvidence.js # Body Evidence state store, analyze/clear, primary + secondary overlay visibility, inspect/select, core-front + secondary-front getters, manual Promote (core or secondary), fixed v0 scale resolution, Body Anchor Audit helper (buildBodyAnchorAudit), diagnostic JSON download
│   │   ├── bodyEvidenceAdapter.js # Body-only parse/normalize/QA; landmark classification (face/head rejection, ignored/deferred, core-13 primary whitelist, Secondary Body Landmark Candidates v0 allowlist); fixed Body Evidence v0 scale; conceptual/mock
│   │   ├── bodyMeasurementLevels.js # Measurement Reference Levels v0 compute (buildMeasurementReferenceLevels) — internal; useful info folded into Body Measurement Readiness
│   │   ├── bodyMeasurementLines.js # Anatomical Measurement Lines v0 compute (buildAnatomicalMeasurementLines) — read-only candidate lines + Ready/Missing distances from body_landmark annotations
│   │   ├── bodyMeasurementPreview.js # Measurement Line Preview Overlay v0 — visual-only Ready anatomical preview lines (3D group + Front 2D layer); separate from A/B measurement rendering; no distance labels
│   │   ├── bodyGraph.js # Body Graph Contract v0 — deterministic runtime topology from promoted Core 13 body_landmark annotations (buildBodyGraph); no persistence / no Scene State schema
│   │   ├── bodyGraph.test.js # Body Graph Contract v0 unit tests
│   │   ├── sceneExport.js  # Scene State JSON export build, timestamp formatting, download
│   │   ├── sceneImport.js  # Scene State JSON import validation, restore orchestration, error handling
│   │   ├── sceneGraphHighlight.js # Temporary Scene Graph 3D highlight overlays
│   │   ├── linkedSelection.js # Linked selection id for Scene Graph ↔ projected marker highlight sync
│   │   └── selection.js    # Selected point state, selection highlight, isSamePoint, selectPoint, clearSelection
│   ├── interactions/
│   │   ├── hover.js        # Hover highlight, hover scheduling, tooltip and reference-marker hover coordination
│   │   ├── raycast.js      # Shared raycaster, mouse coords, volume point resolution, nearest sample fallback, resolveBodyLandmarkMeasurementPoint
│   │   ├── picking.js      # Point comparison helpers and mode-aware click picking (Inspect: body_landmark priority then lattice; Annotate: select only)
│   │   └── pointerEvents.js # Canvas pointer event wiring and sidebar button listeners
│   ├── metrology/
│   │   ├── roomShell.js    # Transparent room shell and 10 cm surface grid
│   │   ├── volumeGrid.js   # 5 cm internal lattice, LOD layers, LOD updates, setInternalVolumeGridVisible
│   │   ├── axes.js         # X/Y/Z axes and 20 cm tick labels
│   │   └── referenceMarkers.js # Origin/Center markers, hover labels, setReferenceMarkersVisible
│   └── ui/
│       ├── annotationControls.js # Landmark Preset dropdown wiring, type-dependent options, preset-to-name fill
│       ├── annotationPanel.js # Annotation List rendering with type labels and per-annotation Delete UI
│       ├── annotationValidationMessage.js # Shows/clears annotation validation feedback message in the UI
│       ├── appModeControls.js # Mode switch UI, panel visibility, status label/hint, workflow sync, mode-switch cleanup
│       ├── inspectorWorkflow.js # Left Metrology Inspector workflow switching (measurement / annotation / body-evidence); UI-only
│       ├── bodyEvidencePanel.js # Body Evidence workflow UI: Import / Actions / Summary / Primary Candidates / Secondary Candidates / Selected Landmark / Promote / Clear Selection; wires Body Evidence Overlay + Secondary Body Candidates checkboxes
│       ├── bodyTabConsolidatedPanel.js # Session Data Body tab consolidation v0: compact Status counts + Advanced Evidence Details name lists + Promoted Body Anchors table + Body Measurement Readiness
│       ├── bodyEvidenceQaPanel.js # Historical stub — superseded by bodyTabConsolidatedPanel.js (not wired from main.js; intentionally retained)
│       ├── bodyMeasurementLevelsPanel.js # Historical stub — Levels display folded into Body Measurement Readiness (not wired from main.js; intentionally retained)
│       ├── bodyMeasurementLinesPanel.js # Historical stub — Lines display folded into Body Measurement Readiness (not wired from main.js; intentionally retained)
│       ├── bodyEvidenceOverlay2d.js # Front Surface Body Evidence overlay markers (core 13 primary + secondary allowlist when visible) + hover tooltip + inspect/select active state (image→cm mapping)
│       ├── bodyGraphWorkspace.js # Body Graph Workspace v0 — read-only Core 13 topology diagram; rebuilds via buildBodyGraph(getAnnotations())
│       ├── collapsibleSections.js # Left Metrology Inspector collapsible section/subgroup headers (UI-only; no data reset)
│       ├── domRefs.js      # Cached DOM references for panels, buttons, lists, mode/workflow controls, View Controls, Body Evidence, Session Body tab, workspace (incl. Body Graph), grid2d, tooltip
│       ├── grid2dNavigator.js # Front Surface 2D Grid Navigator (X/Y only, shared measurement overlay, Pick/Region, simplified Split, setGrid2dPointsVisible, Body Measurement Preview 2D redraw)
│       ├── grid2dMarkerSizing.js # Relative 2D marker sizing helpers
│       ├── workspaceLayout.js # Workspace tabs (3D Space / 2D Workspace / Body Graph), combined 3D+2D layout (~57% default 3D split), split divider, layout resize sync
│       ├── hoverTooltip.js # Screen-space hover coordinate tooltip
│       ├── measurementPanel.js # Distance Measurement panel and shared Measurement History list rendering (stacked body-landmark name + coords on active A/B)
│       ├── sceneGraphPanel.js # Read-only Scene Graph tree in Graph tab (shared Active Measurement; no 2D Workspace State card)
│       ├── sessionTabs.js    # Right Session Data tab switching (History / Annotations / Body / Graph / Files)
│       ├── viewControls.js   # View Controls checkbox wiring; syncs 3D + projected 2D Origin/Center and Annotations visibility; shared A/B Measurement Lines; Body Measurement Previews (Body Evidence Overlay + Secondary Body Candidates wired in bodyEvidencePanel.js)
│       └── selectionPanel.js # Selected Point panel UI update helper
├── dist/                   # Vite production build output (generated)
│   ├── index.html
│   └── assets/
│       ├── index-*.js
│       └── index-*.css
└── node_modules/           # Installed dependencies (Three.js, Vite)
```

Extracted source subdirectories: `src/core/` (Phases 1, 3), `src/ui/` (Phases 2, 6, 7), `src/metrology/` (Phase 4), `src/features/` and `src/interactions/` (Phases 5–9), `src/styles/` (Phase 8). The app remains a Vite + Three.js single-page application with `main.js` as the sole JS entry point and `style.css` as the sole CSS entry point.

---

## 2. File Responsibilities

### `index.html`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Static HTML shell for the REVacity command-center layout; workflow switch, workspace tabs (3D Space / 2D Workspace / Body Graph), 3D pane, 2D Grid Navigator panel, Body Graph workspace pane, split divider, `#grid2d-*` markup, Body Evidence panel (primary + secondary candidates), View Controls Evidence checkboxes (incl. Secondary Body Candidates), Session Data Body tab (Body Evidence Status + Promoted Body Anchors + Body Measurement Readiness), collapsible left inspector section markers |
| **Logic type** | Markup only — no inline scripts except module entry |
| **Features depending on it** | All UI panels, workspace layout, viewport containers, hover tooltip element, font loading, Body Evidence workflow / consolidated Body tab markup, Body Graph workspace markup, left section collapse headers |
| **Mixed responsibilities?** | No — pure structure; behavior lives in modules via `main.js` |

### `package.json`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Project metadata, npm scripts, dependency declarations |
| **Logic type** | Configuration |
| **Features depending on it** | Entire build/run pipeline |
| **Mixed responsibilities?** | No |

### `CURSOR.md`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Documents current implementation state, scale rules, interaction behavior, UI layout, do-not-break rules |
| **Logic type** | Documentation / behavioral contract |
| **Features depending on it** | None at runtime — guides development |
| **Mixed responsibilities?** | No |

### `src/main.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Thin application orchestrator — imports modules, initializes scene objects, assembles the scene (including `graphHighlightGroup`), calls `setupPointInteraction`, `setupInspectorWorkflow`, `setupAppModeControls`, `setupAnnotationControls`, `setupViewControls`, `setupSceneExport`, `setupSceneImport`, `setupSceneGraphPanel`, `setupSessionTabs`, `setupFrontSurfaceMeasurement(measurement)`, `setupGrid2dNavigator`, `setupProjectionLinking(refreshGrid2dNavigator)`, `setupBodyEvidenceOverlay2d`, `setupBodyEvidencePanel`, `setupBodyTabConsolidatedPanel`, `initCollapsibleSections`, `setupBodyGraphWorkspace`, and `setupWorkspaceLayout`, runs the animation loop |
| **Logic type** | Module imports, Three.js scene graph assembly (`scene.add(...)`), setup calls for interaction, UI, export/import, Scene Graph, Session Data tabs, Front Surface measurement bridge, 2D navigator, projection linking, Body Evidence (panel + consolidated Body tab + overlay), Body Graph Workspace, inspector workflow, collapsible sections, and workspace layout; resize listener registration, `animate()` loop |
| **Features depending on it** | Sole Vite entry point; wires all runtime modules together |
| **Mixed responsibilities?** | **No** — feature logic lives in dedicated modules; this file retains orchestration only |

### `src/core/constants.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Shared scale, grid, LOD, and tooltip offset constants |
| **Logic type** | Pure data exports (`ROOM_SIZE`, `GRID_UNIT`, `INTERNAL_*`, `LOD_*`, `LABEL_STEP`, `HOVER_TOOLTIP_OFFSET`) |
| **Features depending on it** | Room shell, surface grid, internal lattice, LOD blending, axes, hover tooltip positioning |
| **Mixed responsibilities?** | No |

### `src/core/frontSurface.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Front Surface constants and 2D↔3D mapping helpers for the cube front face |
| **Logic type** | Pure helpers (`FRONT_SURFACE_DEPTH_CM`, `frontSurfaceTo3d`, `frontSurfaceFrom3d`, `isOnFrontSurface`, `areAllOnFrontSurface`, `formatFrontSurfacePointCoords`) |
| **Features depending on it** | Front Surface measurement advance, 2D overlay readout, History/Scene Graph Front Surface labels, projection mapping |
| **Mixed responsibilities?** | No |

### `src/core/annotationTypes.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Centralizes allowed annotation node types and landmark preset mappings |
| **Logic type** | Pure data exports (`ANNOTATION_TYPES`, `DEFAULT_ANNOTATION_TYPE`, `LANDMARK_PRESETS_BY_TYPE`, `DEFAULT_LANDMARK_PRESET`) and helpers (`normalizeAnnotationType`, `formatAnnotationTypeLabel`, `getLandmarkPresetsForType`, `formatLandmarkPresetLabel`) |
| **Features depending on it** | Annotation controls, annotation CRUD, annotation list, Scene Graph, Scene State export/import restore |
| **Mixed responsibilities?** | No — pure annotation metadata constants/helpers |

### `src/core/landmarkDisplay.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Shared display naming for landmark / annotation identifiers |
| **Logic type** | Pure helper (`formatLandmarkDisplayName`) — snake_case / kebab-case ids → readable Title Case UI labels |
| **Features depending on it** | Body Evidence candidates/selected card/overlay tooltips, Annotation List, Scene Graph, projected annotation tooltips, annotation type/preset label helpers |
| **Mixed responsibilities?** | No — display-only naming; does not change stored ids |

### `src/core/formatters.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Display formatting for coordinates, points, annotations, and distances |
| **Logic type** | Pure functions (`formatCoordinate`, `formatPointCoords`, `formatAnnotationCoords`, `formatDistance`) |
| **Features depending on it** | Selected Point panel, hover tooltip, measurement panel/history, annotation list |
| **Mixed responsibilities?** | No |

### `src/core/math.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Shared pure math helpers |
| **Logic type** | Pure functions (`smoothstep`, `calculateDistance`) |
| **Features depending on it** | LOD opacity blending, distance measurement and floating label, Measurement Reference Levels / Anatomical Measurement Lines paired distances |
| **Mixed responsibilities?** | No |

### `src/core/scene.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls, renderer sizing, and resize handling |
| **Logic type** | Three.js scene bootstrap, renderers, controls init, `syncRendererSize`, `onResize`; ambient + directional lights |
| **Features depending on it** | All 3D rendering and CSS2D labels; imports `container` from `ui/domRefs.js`, `ROOM_SIZE` from `constants.js` |
| **Mixed responsibilities?** | No |

### `src/metrology/roomShell.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Transparent 200 cm room shell and 10 cm surface grid markers |
| **Logic type** | Three.js geometry factories (`createRoomShell`, `createGridMarkers`) |
| **Features depending on it** | Cube boundaries, face grid; imports `ROOM_SIZE`, `GRID_UNIT` from `core/constants.js` |
| **Mixed responsibilities?** | No |

### `src/metrology/volumeGrid.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | 5 cm internal lattice (68,921 points), three LOD InstancedMesh layers, per-frame LOD opacity, and visual-only lattice visibility toggle |
| **Logic type** | Lattice generation (`collectLodPoints`, `buildAllSamplePositions`, `createInternalVolumeGrid`), `updateInternalVolumeLod`, `setInternalVolumeGridVisible()` |
| **Features depending on it** | Volume rendering, picking (`userData.pickMeshes`), nearest-point fallback data; View Controls **Show 3D Lattice Points** via `ui/viewControls.js`; imports constants from `core/constants.js`, `smoothstep` from `core/math.js` |
| **Mixed responsibilities?** | No |

### `src/metrology/axes.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | RGB X/Y/Z axes with arrowheads and 20 cm CSS2D tick labels |
| **Logic type** | Three.js + CSS2D geometry factory (`createAxes`) |
| **Features depending on it** | Axis visualization; imports `ROOM_SIZE`, `LABEL_STEP` from `core/constants.js` |
| **Mixed responsibilities?** | No |

### `src/metrology/referenceMarkers.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Origin and Center reference markers with hover-only CSS2D labels and visibility toggle |
| **Logic type** | Marker factories (`createReferenceMarkers`), label show/hide (`hideReferenceMarkerLabels`, `updateReferenceMarkerHover`), `setReferenceMarkersVisible()` |
| **Features depending on it** | Origin (0,0,0) and Center (100,100,100) references; View Controls **Show Origin / Center** checkbox via `ui/viewControls.js`; `updateReferenceMarkerHover` called from `interactions/hover.js` during volume hover updates (skips hover labels when hidden), receives shared `raycaster` and `mouse` from `interactions/raycast.js` via hover deps, imports `camera` from `core/scene.js` |
| **Mixed responsibilities?** | No |

### `src/features/appMode.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | App mode session state and helpers for **Inspect & Measure** vs **Annotate** |
| **Logic type** | Module-scoped mode constant (`APP_MODE_INSPECT_MEASURE`, `APP_MODE_ANNOTATE`), getters/setters (`getAppMode`, `setAppMode`), mode checks (`isInspectMeasureMode`, `isAnnotateMode`) |
| **Features depending on it** | Mode-aware picking, hover colors, annotation gating, mode switch UI |
| **Mixed responsibilities?** | No |

### `src/features/selection.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Selected point session state, orange/amber selection highlight mesh factory, select/clear actions, `isSamePoint` helper |
| **Logic type** | Three.js mesh factory (`createSelectionHighlight`), module-scoped state (`selectedPoint`), selection handlers (`selectPoint`, `clearSelection`, `getSelectedPoint`, `isSamePoint`); exports `ANNOTATE_POINT_COLOR` |
| **Features depending on it** | Annotate-mode point selection, Clear Selection, annotation-from-selection; selection panel/highlight hidden in Inspect & Measure mode via `appModeControls.js`; imports `updateSelectionPanel` from `ui/selectionPanel.js`, panel elements from `ui/domRefs.js` |
| **Mixed responsibilities?** | No |

### `src/features/measurement.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Shared two-point distance measurement session state (volume 3D and Front Surface), A/B marker/line/label visuals, clear/advance logic, history, line visibility |
| **Logic type** | Three.js mesh/line/CSS2D factories (`createMeasurementState`), module-scoped history, measurement handlers (`advanceMeasurement`, `clearMeasurement`, `clearMeasurementPointA`, `clearMeasurementPointB`, `clearMeasurementHistory`), optional session-local `label` on active A/B points (e.g. body-landmark display name; not part of Scene State / history schema), `setMeasurement3dLinesVisible()`, `setMeasurement3dChangeHandler()`, export/import restore helpers |
| **Features depending on it** | Point A/B flow (Inspect & Measure), including Body Landmark Measurement Picking v0 via existing `advanceMeasurement`, floating distance label, History, Scene State JSON, View Controls **Show Measurement Lines**, Front Surface bridge via change handler |
| **Mixed responsibilities?** | No — still the single A/B + history owner; no separate body measurement system |

### `src/features/frontSurfaceMeasurement.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Front Surface measurement bridge — advances/reads the shared measurement from 2D Front Surface clicks and other shared 3D point sources |
| **Logic type** | `setupFrontSurfaceMeasurement(measurement)`, `advanceFrontSurfaceMeasurement(point)`, `advanceSharedMeasurement(point3d)` (Inspect & Measure gated; used by lattice picks and body-landmark projected picks), `getActiveFrontSurfaceMeasurement()`; lattice path maps via `frontSurfaceTo3d` |
| **Features depending on it** | 2D Grid Navigator Pick Point clicks; Body Landmark Measurement Picking on projected Front markers via `projectionLinking.js`; **does not** own separate A/B state or clear UI (left Distance Measurement panel owns clears) |
| **Mixed responsibilities?** | No |

### `src/features/projectionLinking.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Front Surface projection of Origin/Center and annotations into `#grid2d-markers`; navigation/highlight plus Inspect & Measure body-landmark measurement picking |
| **Logic type** | `setupProjectionLinking(refreshGrid2dNavigator)`, `renderProjectionMarkers()`, Front-only mapping via `frontSurfaceFrom3d`, hover tooltips (annotation tooltips show name/type/xyz/source without duplicating equivalent projection coords), click→temporary 3D highlight, Inspect & Measure click on promoted `body_landmark` → `advanceSharedMeasurement` with stored annotation position, View Controls visibility setters |
| **Features depending on it** | 2D projected marker layer; View Controls Origin/Center and Annotations sync; promoted `body_landmark` annotations appear as normal projected annotations and can drive shared A/B in Inspect & Measure |
| **Coupling** | Does **not** project active A/B (rendered natively by the Front Surface overlay); does not own Body Evidence overlay; does not create a separate 2D measurement system |
| **Mixed responsibilities?** | No — extends shared A/B picking rather than adding body-only measurement state |

### `src/features/bodyEvidence.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Body Evidence session store — isolated from measurement A/B and Scene State export/import; manual Promote creates normal annotations from core or secondary candidates; Body Anchor Audit is a read-only annotation QA helper |
| **Logic type** | Source slots (front/side pose + front/side seg only — no Result / Scale JSON), analyze/clear, primary overlay visibility + secondary-candidates visibility flags, change subscribers, fixed v0 scale constants (`BODY_EVIDENCE_V0_SCALE` / `ASSUMED_PIXELS_PER_CM = 10`, `ASSUMED_IMAGE_SIZE_PX = 2000`), display-scale resolution (`getBodyEvidenceScaleInfo` — always fixed v0; `heightCm` unused), renderable core-front getters (`getRenderableFrontBodyLandmarks`), secondary-front getters (`getSecondaryFrontBodyLandmarks`), inspect/select landmark state (`selectBodyEvidenceLandmark`, `clearBodyEvidenceSelection`, `getSelectedBodyEvidenceLandmark` — separate from A/B, Annotate selection, Scene Graph, Scene State), manual Promote (`promoteSelectedBodyEvidenceLandmark` → `body_landmark` annotation via `addAnnotationFromPoint`; duplicate-guarded; core 13 or secondary allowlist), Body Anchor Coordinate Audit (`buildBodyAnchorAudit` — read-only over `body_landmark` annotations; missing core / duplicates / out-of-bounds / front-surface Z / Ready vs Needs review; uses `CORE_FRONT_BODY_ANCHORS`, `normalizeLandmarkName`, `ROOM_SIZE`, `FRONT_SURFACE_DEPTH_CM` / `isOnFrontSurface`; does not mutate state; secondary unpromoted candidates do not affect audit/readiness), diagnostic payload build/download (`buildBodyEvidenceExport`, `downloadBodyEvidenceJson`) |
| **Features depending on it** | Left Body Evidence workflow panel, Front Surface overlay (primary + secondary), View Controls Body Evidence Overlay + Secondary Body Candidates enablement, consolidated Body tab (Status / Promoted Body Anchors / Body Measurement Readiness via audit helper), promote badges; imports `analyzeBodyEvidence` / core + secondary allowlist helpers from `bodyEvidenceAdapter.js` |
| **Coupling** | Diagnostic JSON is separate from Scene State; excludes raw images and segmentation label base64; diagnostic seg metadata keeps `labelShape` / `labelDtype` only; Body Evidence itself is not exported/imported; unpromoted secondary candidates stay out of Scene State; promoted annotations become normal Scene State annotations; Body Anchor Audit does not join Scene State schema |
| **Mixed responsibilities?** | No — evidence/QA/select/promote/audit orchestration only; audit does not mutate annotations or Body Evidence |

### `src/features/bodyEvidenceAdapter.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Parses body-processing JSON into normalized Body Evidence QA schema (`body-evidence-v0`) |
| **Logic type** | Body landmark classification (parsed vs rejected face/head vs ignored/deferred vs core-13 primary whitelist via `CORE_FRONT_BODY_ANCHORS` / `isCoreFrontBodyAnchor` vs Secondary Body Landmark Candidates v0 allowlist via `SECONDARY_FRONT_BODY_ANCHORS` / `isSecondaryBodyAnchorCandidate`), face/head rejection, low-confidence tracking, front/side pose + segmentation metadata normalize (QA-only; masks not rendered), fixed Body Evidence Import v0 scale (`BODY_EVIDENCE_V0_SCALE`: canvas/image 2000×2000, `pixelsPerCm = 10`, `heightCm` postponed/null, source `body-evidence-v0-fixed`) |
| **Features depending on it** | `bodyEvidence.js` analyze path; conceptual/mock evidence only — not trusted ground truth; Result / Scale JSON is not imported; Measurement Reference Levels / Anatomical Measurement Lines name matching via `normalizeLandmarkName` |
| **Mixed responsibilities?** | No — pure adapter/QA module; no scene mutation |

### `src/features/bodyMeasurementLevels.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Measurement Reference Levels v0 — read-only organization of promoted `body_landmark` annotations into anatomical reference levels with optional paired spans |
| **Logic type** | Pure compute (`MEASUREMENT_REFERENCE_LEVELS`, `buildMeasurementReferenceLevels`); filters annotations where `type === "body_landmark"`; per-level required / present / missing / Ready|Missing; optional Euclidean spans via `calculateDistance` for paired shoulders/elbows/wrists/hips/knees/ankles; name normalize via `normalizeLandmarkName`; does not read raw Body Evidence; does not write annotations, history, or export fields |
| **Features depending on it** | Available for internal reuse; separate Levels panel is no longer shown by default after Body Tab Consolidation v0 (useful info folded into Body Measurement Readiness) |
| **Mixed responsibilities?** | No — pure read-only QA/organization helper; not Body Graph / measurement generation / latent space |

### `src/features/bodyMeasurementLines.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Anatomical Measurement Lines v0 — read-only measurement candidate lines from promoted `body_landmark` annotations |
| **Logic type** | Pure compute (`ANATOMICAL_MEASUREMENT_LINES`, `buildAnatomicalMeasurementLines`); six candidate pairs (shoulder/elbow/wrist/hip/knee/ankle); Ready when both anchors exist with Euclidean `distanceCm`; Missing lists missing anchors; does not read raw Body Evidence; does not own 3D/2D line rendering; does not write annotations, history, or export fields |
| **Features depending on it** | `ui/bodyTabConsolidatedPanel.js` (Body Measurement Readiness candidate rows + distances); `features/bodyMeasurementPreview.js` (Ready geometry for visual-only preview lines; distances deliberately not exposed to overlay) |
| **Mixed responsibilities?** | No — pure read-only QA/organization helper; not Body Graph / normal A/B measurement / latent space |

### `src/features/bodyMeasurementPreview.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Measurement Line Preview Overlay v0 — visual-only Ready anatomical measurement preview lines derived from promoted `body_landmark` annotations |
| **Logic type** | `getReadyBodyMeasurementPreviewLines()` (geometry-only Ready segments from `buildAnatomicalMeasurementLines`); Three.js preview group (`createBodyMeasurementPreviewGroup`, `refreshBodyMeasurementPreview`); Front Surface 2D helper (`renderBodyMeasurementPreview2d` into `#grid2d-body-measurement-previews`); visibility (`setBodyMeasurementPreviewVisible`, default on); `setupBodyMeasurementPreview(refreshGrid2dNavigator)` subscribes to annotation changes |
| **Features depending on it** | `main.js` (scene group + setup); View Controls **Body Measurement Previews** via `ui/viewControls.js`; Front Surface redraw via `ui/grid2dNavigator.js` |
| **Mixed responsibilities?** | No — visual overlay only; **separate from normal A/B measurement rendering** in `measurement.js`; no distance labels; not history / annotations / export / Body Graph / latent space |

### `src/features/bodyGraph.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Body Graph Contract v0 — deterministic runtime Core 13 topology derived from promoted `body_landmark` annotations |
| **Logic type** | Pure compute (`BODY_GRAPH_V0_NODES`, `BODY_GRAPH_V0_EDGES`, `buildBodyGraph`); reuses Core Front Body Anchor name contract + `normalizeLandmarkName`; Present/Missing nodes and Ready/Missing structural edges; no Body Evidence state reads; no persistence; no Scene State schema |
| **Features depending on it** | `ui/bodyGraphWorkspace.js` (read-only topology diagram); unit tests in `bodyGraph.test.js` |
| **Mixed responsibilities?** | No — runtime symbolic contract only; separate from Body Measurement Readiness spans, preview lines, Scene Graph, and latent space |

### `src/features/bodyGraph.test.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Unit tests for Body Graph Contract v0 (empty / partial / full Core coverage, secondary landmark exclusion, name normalization) |
| **Logic type** | `node:test` assertions over `buildBodyGraph` |
| **Features depending on it** | Development / CI verification only |
| **Mixed responsibilities?** | No |

### `src/features/annotations.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Point annotation session state, 3D-anchored annotation visuals, CSS2D labels, 3D visibility toggle, add/delete logic, disposal helpers, body-landmark measurement pick helpers |
| **Logic type** | Three.js group/CSS2D factories (`createAnnotationVisual` — stores `userData.annotationId` on groups), module-scoped state (`annotations`, `annotationIdCounter`, `annotationsGroup`, `annotationsVisible`), `setAnnotationsVisible()`, `setAnnotationsChangeHandler()`, CRUD handlers (`addAnnotation`, `deleteAnnotation`, `tryAddAnnotationFromSelection`, `addAnnotationFromPoint` for Body Evidence promote), Body Landmark Measurement Picking helpers (`isBodyLandmarkAnnotation`, `getBodyLandmarkAnnotationTargets`, `findAnnotationByMarkerObject`, `measurementPointFromBodyLandmark`), read-only export getter (`getAnnotations` — includes `id`, `name`, `type`, `position`), import restore handler (`restoreAnnotations` — clears existing annotations and recreates 3D markers and CSS2D labels with stable ids; reapplies current Show Annotations visibility; normalizes `type` via `normalizeAnnotationType()` with `custom` default/fallback), calls `resetAnnotationControls()` after add and via `clearAnnotationInput()` on mode switch, calls `clearGraphHighlight()` on annotation delete, disposal helpers (`removeAnnotationLabelElements`, `disposeAnnotationGroup`) |
| **Features depending on it** | Add Annotation (Annotate mode only), Body Evidence Promote Selected Landmark, Body Landmark Measurement Picking v0 (via raycast/picking + projection linking), Delete per entry, annotation list, View Controls **Show Annotations** checkbox via `ui/viewControls.js`, **3D→2D projection linking** (via change handler), Session Data Body tab Promoted Body Anchors / Body Measurement Readiness (via `subscribeAnnotationsChange`), Body Graph Workspace refresh (via `subscribeAnnotationsChange`), Scene State JSON export and import; imports `getSelectedPoint` from `features/selection.js`, `isAnnotateMode` from `features/appMode.js`, `hoverState` from `interactions/hover.js`, `normalizeAnnotationType` from `core/annotationTypes.js`, `resetAnnotationControls` from `ui/annotationControls.js`, `renderAnnotationList` from `ui/annotationPanel.js`, `annotationNameInput` and `annotationTypeSelect` from `ui/domRefs.js` |
| **Mixed responsibilities?** | No — still annotation ownership; pick helpers expose targets for existing A/B measurement, not a parallel measurement system |

Saved annotations store `id`, `name`, `type`, and `position`. Landmark presets are naming helpers only — the final `name` comes from the Annotation Name input; preset is not stored or exported separately.

Allowed annotation node types: `custom`, `reference_point`, `body_landmark`, `garment_landmark`, `measurement_point`. Default and import fallback: `custom`.

### `src/features/annotationValidation.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Validates annotation input before saving so invalid input never creates an annotation |
| **Logic type** | Pure validation helpers (`normalizeAnnotationName`, `findDuplicateAnnotation`, `validateAnnotationInput`) — checks that a point is selected, the name is non-empty after trimming, and no annotation of the same normalized type + name already exists; returns a `{ valid, message }` (or `{ valid, name, type }`) result |
| **Features depending on it** | Add Annotation flow (Annotate mode); imports `normalizeAnnotationType` from `core/annotationTypes.js`. Does not mutate state, touch 3D visuals, or affect export/import schema |
| **Mixed responsibilities?** | No — pure input validation module |

### `src/features/sceneExport.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Builds and downloads the Scene State JSON export |
| **Logic type** | `buildSceneState(measurement, exportedAt)`, `downloadSceneStateJson(measurement)`, `setupSceneExport(measurement)`; local filename timestamp formatting; UTC/local/timezone metadata; rounded `distanceCm` export values; exported annotations include `id`, `name`, `type`, and `position` |
| **Features depending on it** | **Export Scene JSON** button (`#export-scene-json`) in the Files tab of the right Session Data sidebar; reads from `features/appMode.js`, `features/measurement.js` (`getMeasurementHistory`), `features/annotations.js` (`getAnnotations`), active `measurement` object, `core/constants.js`, `core/math.js`, `ui/domRefs.js` |
| **Mixed responsibilities?** | No — export-only feature module |

### `src/features/sceneImport.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Loads previously exported Scene State JSON files and restores session data safely |
| **Logic type** | Browser file reading, JSON parsing, schema validation, coordinate validation, import error handling, restore orchestration (`validateSceneState`, `importSceneState`, `setupSceneImport`); calls `clearGraphHighlight()` on successful import; delegates restore to `restoreMeasurementHistory`, `restoreActiveMeasurement`, `restoreAnnotations` (type normalized on restore — older JSON without `type` defaults to `custom`), and `applyImportedMode` |
| **Features depending on it** | **Load Scene JSON** control in the Files tab of the right Session Data sidebar |
| **Mixed responsibilities?** | No — import-only feature module |

### `src/features/sceneGraphHighlight.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Owns temporary Scene Graph visual highlighting in the 3D scene |
| **Logic type** | `graphHighlightGroup`, `clearGraphHighlight()`, `highlightPoint()`, `highlightMeasurement()`, `highlightReferenceMarker()`, `highlightAnnotation()`, `highlightActivePointA()`, `highlightActivePointB()`, auto-clear timer (~2 seconds) |
| **Features depending on it** | Scene Graph panel clickable rows; cleared on tab switch, successful import, Clear History, and annotation delete |
| **Mixed responsibilities?** | No — visual-only 3D highlight feature module |

### `src/interactions/hover.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Hover highlight mesh, rAF-throttled hover pipeline, coordination with tooltip and reference-marker hover |
| **Logic type** | Three.js mesh factory (`createHoverHighlight`), hover state (`hoverState`), hover update functions (`updateHoverPoint`, `processHoverUpdate`, `scheduleHoverUpdate`) |
| **Features depending on it** | Volumetric point hover with mode-specific colors, hover coordinate tooltip, Origin/Center hover labels; imports `isInspectMeasureMode` from `features/appMode.js`, `getNextMeasurementPointType`/`getMeasurementPointColor` from `features/measurement.js`, `ANNOTATE_POINT_COLOR` from `features/selection.js`, `updateHoverCoordinateTooltip` from `ui/hoverTooltip.js`, `updateReferenceMarkerHover` from `metrology/referenceMarkers.js`, `getSelectedPoint` from `features/selection.js`, `isSamePoint` and `isMeasurementPoint` from `interactions/picking.js`; receives raycast deps from `interactions/pointerEvents.js` via hover deps |
| **Mixed responsibilities?** | No |

### `src/interactions/raycast.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Shared raycaster, mouse NDC coords, vector temps, volume point resolution, nearest-sample fallback, body-landmark annotation pick resolution |
| **Logic type** | Three.js `Raycaster` setup, `resolveVolumePoint`, `resolveBodyLandmarkMeasurementPoint` (promoted `body_landmark` groups only when annotations visible), `getPositionFromInstanceHit`, `findNearestSamplePoint`, `setAllSamplePositions` |
| **Features depending on it** | Volume picking and hover; Body Landmark Measurement Picking v0; raycasts volume against `volumeGrid.userData.pickMeshes`; body-landmark path uses annotation groups from `features/annotations.js`; imports `camera`, `controls` from `core/scene.js`; `allSamplePositions` populated by `pointerEvents.js` before interaction |
| **Mixed responsibilities?** | No |

### `src/interactions/picking.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Point comparison helpers and mode-aware click picking flow (Body Landmark Measurement Picking v0 extends Inspect & Measure path) |
| **Logic type** | `isSamePoint` (re-exported from `features/selection.js`), `isMeasurementPoint`, `pickVolumePoint` — Inspect & Measure: prefer `resolveBodyLandmarkMeasurementPoint` then lattice `resolveVolumePoint` → `advanceMeasurement`; Annotate: lattice `selectPoint` only (never advances A/B, including body landmarks) |
| **Features depending on it** | Annotate-mode point selection, Inspect & Measure Point A/B advance on click (lattice + promoted body landmarks); imports `selectPoint`/`isSamePoint` from `features/selection.js`, `advanceMeasurement` from `features/measurement.js`, `isInspectMeasureMode`/`isAnnotateMode` from `features/appMode.js`, `resolveBodyLandmarkMeasurementPoint`/`resolveVolumePoint` from `interactions/raycast.js`, `updateMouseFromEvent` from `interactions/pointerEvents.js`; `isSamePoint`/`isMeasurementPoint` used by `interactions/hover.js` and `features/measurement.js` |
| **Mixed responsibilities?** | No — extends existing A/B picking; does not add a body measurement system |

### `src/interactions/pointerEvents.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Canvas pointer event wiring and sidebar button listeners |
| **Logic type** | `updateMouseFromEvent`, `setupPointInteraction` (pointer down/move/up/leave, Clear/History/Annotation button listeners, hover deps assembly); **Clear History** clears shared measurement history; click path still delegates to `pickVolumePoint` (body-landmark priority lives in picking/raycast) |
| **Features depending on it** | All canvas interaction and sidebar action buttons; imports from scene/metrology/features/ui/interactions modules; passes `selectionHighlight` to measurement clear handlers |
| **Mixed responsibilities?** | No |

### `src/ui/domRefs.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Cached `document.getElementById` references for app panels, buttons, lists, tooltip, workspace tabs/panes/divider (incl. Body Graph), `#grid2d-*` elements, workflow controls, and Body Evidence controls |
| **Logic type** | DOM element exports only (queried once at module load) |
| **Features depending on it** | All sidebar panels, measurement controls, annotation/history lists, mode/workflow switch, View Controls checkboxes (including Body Evidence Overlay and Body Measurement Previews), Body Evidence load/analyze/download/clear/candidates/selected/promote elements, Body tab Status + Promoted Body Anchors + Body Measurement Readiness elements, Session Data tab buttons/panels, workspace layout, 2D Grid Navigator (incl. `#grid2d-body-measurement-previews`), export/import controls, Scene Graph tree, canvas container, hover tooltip element |
| **Mixed responsibilities?** | No |

### `src/ui/grid2dNavigator.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Front Surface 2D Grid Navigator — X/Y interaction plane for shared front-surface measurement |
| **Logic type** | Module-scoped navigator UI state; 10 cm lattice + simplified 5 cm Split; Pick/Region modes; Control keyboard toggle; visual zoom/pan; Pick advances `advanceFrontSurfaceMeasurement()`; renders shared measurement overlay; calls `projectionLinking` render; refreshes Body Evidence overlay via `bodyEvidenceOverlay2d.js`; redraws Body Measurement Preview lines via `renderBodyMeasurementPreview2d`; `setGrid2dPointsVisible()` |
| **Owns** | Front Surface domain (0–200 cm); base 10 cm field; local `refinedRegions`; Pick/Region modes; `selectedPoint2d`; `selectedRegionPoints`; `visualTransform`; `grid2dPointsVisible` |
| **Features depending on it** | 2D workspace pane (`#grid2d-navigator-panel`); refreshed by `workspaceLayout.js`; View Controls **2D Grid Points** / shared **Measurement Lines** / **Body Measurement Previews** (preview redraw) |
| **Coupling** | Writes shared measurement via `frontSurfaceMeasurement.js`; does not own duplicate clear UI; 2D UI-only state is not exported; Body Evidence markers do not advance A/B; projected promoted `body_landmark` markers advance shared A/B in Inspect & Measure via `projectionLinking.js`; Body Measurement Preview lines are visual-only (`pointer-events: none`) and do not affect 2D click measurement |
| **Mixed responsibilities?** | No |

### `src/ui/bodyEvidencePanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Left Metrology Inspector Body Evidence workflow panel — Import Files / Actions / Summary / Primary Candidates / Secondary Candidates / Selected Landmark / Promote / Clear Selection |
| **Logic type** | `setupBodyEvidencePanel()`; wires four file inputs (front/side pose, front/side seg — no Result / Scale JSON); Analyze / Download / Clear; renders compact Summary (Landmarks = core/renderable front count; secondary count; fixed v0 scale; no QA details); Primary Body Landmark Candidates list (`#body-evidence-candidates`) restricted to core 13; Secondary Body Landmark Candidates list (`#body-evidence-secondary-candidates`) with count in title; click→select sync to overlay for both; Current Selected Body Landmark card (`#body-evidence-selected`); Promote Selected Landmark (`#promote-selected-body-landmark` — core or secondary); Clear Selection (`#clear-body-landmark-selection` clears only Body Evidence landmark selection); syncs Body Evidence Overlay + Secondary Body Candidates checkbox enablement and key status; checkbox changes → `setBodyEvidenceOverlayVisible()` / `setSecondaryBodyEvidenceVisible()` |
| **Features depending on it** | `#body-evidence-panel`; imports state APIs from `features/bodyEvidence.js` and overlay helpers from `ui/bodyEvidenceOverlay2d.js`; uses `formatLandmarkDisplayName` |
| **Mixed responsibilities?** | No — UI-only panel; Promote delegates to `bodyEvidence.js`; does not own consolidated Body tab rendering |

### `src/ui/bodyTabConsolidatedPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Session Data → Body tab Body Tab Consolidation v0 — compact read-only Status counts + Promoted Body Anchors table + Body Measurement Readiness; Advanced Evidence Details for longer name lists |
| **Logic type** | `setupBodyTabConsolidatedPanel()`; renders Body Evidence Status into `#session-body-evidence-status` (compact counts-only summary + collapsed Advanced Evidence Details with readable Secondary / Ignored-Deferred / Rejected Face-Head name subsections); renders Promoted Body Anchors as Name/X/Y/Z table from `body_landmark` annotations; renders Body Measurement Readiness from `buildBodyAnchorAudit` + `buildAnatomicalMeasurementLines` (overall Ready/Needs review + candidate Ready/Missing rows with distance or missing anchors; secondary unpromoted candidates do not affect readiness); subscribes to Body Evidence + annotations change; no Promote / Clear Selection / Import / Analyze / delete / edit controls; no new schema; distances are display-only |
| **Features depending on it** | `#tab-panel-body`, `#body-evidence-status-panel`, `#promoted-body-anchors-panel`, `#body-measurement-readiness-panel`; wired from `main.js` |
| **Mixed responsibilities?** | No — consolidated display-only UI; not Body Graph / latent space; reuses existing compute helpers |

### `src/ui/bodyEvidenceQaPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Historical stub — superseded by Body Tab Consolidation v0 (`bodyTabConsolidatedPanel.js`) |
| **Logic type** | `setupBodyEvidenceQaPanel()` no-op; not wired from `main.js` |
| **Features depending on it** | None in current visible layout |
| **Mixed responsibilities?** | No — intentionally retained as historical pointer only |

### `src/ui/bodyMeasurementLevelsPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Historical stub — Measurement Reference Levels display folded into Body Measurement Readiness |
| **Logic type** | `setupBodyMeasurementLevelsPanel()` no-op; not wired from `main.js`; compute remains in `features/bodyMeasurementLevels.js` |
| **Features depending on it** | None in current visible layout |
| **Mixed responsibilities?** | No — retained as historical pointer only |

### `src/ui/bodyMeasurementLinesPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Historical stub — Anatomical Measurement Lines display folded into Body Measurement Readiness |
| **Logic type** | `setupBodyMeasurementLinesPanel()` no-op; not wired from `main.js`; compute remains in `features/bodyMeasurementLines.js` |
| **Features depending on it** | None in current visible layout |
| **Mixed responsibilities?** | No — retained as historical pointer only |

### `src/ui/bodyEvidenceOverlay2d.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Front Surface overlay for core 13 primary Body Evidence anchors plus Secondary Body Landmark Candidates v0 when secondary visibility is on; inspect/select highlight |
| **Logic type** | `setupBodyEvidenceOverlay2d(refreshGrid2dNavigator)`, image→Front Surface cm mapping (`mapImagePointToFrontSurface`: `spaceX = imageX / pixelsPerCm`, `spaceY = (canvasSize - imageY) / pixelsPerCm`), marker render into `#grid2d-body-evidence-markers` from core-front landmarks and optionally secondary allowlist landmarks (`getSecondaryCandidateLandmarks`), hover tooltip with landmark + fixed v0 scale source/status (`#grid2d-body-evidence-tooltip`), click/keyboard → `selectBodyEvidenceLandmark()` with `.grid2d-body-evidence-marker--active` (internal emphasis only; no large outer halo; secondary markers use `.grid2d-body-evidence-marker--secondary`); markers do not set measurement A/B; empty grid clicks still advance shared measurement |
| **Features depending on it** | 2D Workspace Front Surface evidence markers; View Controls Body Evidence Overlay + Secondary Body Candidates; Selected Body Landmark card / candidate sync; fixed Body Evidence v0 scale (`10` px/cm, `2000` canvas) |
| **Not implemented** | Side landmark rendering; segmentation mask rendering; Result / Scale JSON |
| **Mixed responsibilities?** | No — overlay / select visuals only |

### `src/ui/inspectorWorkflow.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Left Metrology Inspector workflow switching (measurement / annotation / body-evidence) |
| **Logic type** | `setupInspectorWorkflow()`, `setInspectorWorkflow()`, `getInspectorWorkflow()`, `isBodyEvidenceWorkflow()`, `workflowForMode()`; sets `#left-sidebar[data-workflow]`; Body Evidence workflow is inspector-only and does not change app mode |
| **Features depending on it** | Workflow buttons in `#mode-panel`; used by `appModeControls.js` to keep measurement/annotation workflows aligned with app mode |
| **Mixed responsibilities?** | No — UI-only panel visibility / hint switching; does not reset data |

### `src/ui/collapsibleSections.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Left Metrology Inspector collapsible section and subgroup headers |
| **Logic type** | `initCollapsibleSections()`; wires `[data-collapsible]` sections/subgroups under `#left-sidebar`; toggles `.is-collapsed` on header click/keyboard; respects `data-collapsed` default |
| **Features depending on it** | Workflow, View Controls, Body Evidence (incl. Import Files / Actions subgroups), Distance Measurement, Selected Point |
| **Mixed responsibilities?** | No — UI-only; collapsing does not reset measurements, annotations, Body Evidence data, overlay visibility, loaded files, or imported state; collapse state not exported/imported |

### `src/ui/grid2dMarkerSizing.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Relative 2D marker sizing — selection, measurement, and projected-marker emphasis scale from lattice step |
| **Logic type** | Step→base px map, coord→step lookup, CSS custom property builders |
| **Features depending on it** | Lattice render, Front Surface measurement overlay, projected markers |
| **Mixed responsibilities?** | No |

### `src/ui/bodyGraphWorkspace.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Body Graph Workspace v0 — dedicated read-only Core 13 anatomical topology diagram for the Body Graph workspace tab |
| **Logic type** | `setupBodyGraphWorkspace()`, `refreshBodyGraphWorkspace()`; HTML node cards + SVG structural edges; deterministic percentage-based diagram layout; Present/Missing node and Ready/Missing edge styling; summary `Nodes {present}/13 · Edges {ready}/13`; rebuilds via `buildBodyGraph(getAnnotations())`; refreshes on `subscribeAnnotationsChange` and when the tab opens |
| **Features depending on it** | `#body-graph-workspace` pane; wired from `main.js`; refreshed by `workspaceLayout.js` on Body Graph tab activation |
| **Mixed responsibilities?** | No — UI/read-only visualization only; does not edit annotations, measurements, Body Evidence, Scene Graph, or export/import; not Body Measurement Readiness / preview lines |

### `src/ui/workspaceLayout.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Workspace tab switching and central viewport layout for **3D Space**, **2D Workspace**, and **Body Graph** |
| **Logic type** | `setupWorkspaceLayout()`, `setWorkspace()`, `getWorkspace()`; workspace tab handlers; split divider drag; `ResizeObserver`; calls `syncSceneResize()` and `refreshGrid2dNavigator()` on layout changes; refreshes Body Graph on Body Graph tab activation. Modes: `WORKSPACE_3D` (`3d`), `WORKSPACE_SPLIT` (`split`), `WORKSPACE_BODY_GRAPH` (`body-graph`) |
| **Owns** | `currentWorkspace`; `splitRatio` (default ~0.57 / 57% for the 3D pane); `dividerDragActive`; `#viewport[data-workspace-mode]`; pane flex widths in the combined 2D Workspace |
| **Features depending on it** | Workspace tabs (`#workspace-tab-3d`, `#workspace-tab-split`, `#workspace-tab-body-graph`); **3D Space**, **2D Workspace** (3D + 2D Grid Navigator + divider), and **Body Graph** layouts; 3D renderer sizing when pane resizes. The standalone 2D Space tab was removed |
| **Coupling** | Layout-only — does not read or mutate 3D session state; Body Graph rebuild remains annotation-derived |
| **Mixed responsibilities?** | No — UI/layout coordinator only |

### `src/ui/hoverTooltip.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Screen-space hover coordinate tooltip show/hide and cursor positioning |
| **Logic type** | DOM updates (`hideHoverCoordinateTooltip`, `updateHoverCoordinateTooltip`) |
| **Features depending on it** | Volumetric point hover; imports `HOVER_TOOLTIP_OFFSET` from `core/constants.js`, `formatCoordinate` from `core/formatters.js`, DOM refs from `domRefs.js` |
| **Mixed responsibilities?** | No |

### `src/ui/selectionPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Selected Point panel UI update helper |
| **Logic type** | DOM updates (`updateSelectionPanel`) |
| **Features depending on it** | Annotate-mode point selection panel; imports `formatCoordinate` from `core/formatters.js`, panel elements from `domRefs.js`; panel hidden in Inspect & Measure mode |
| **Mixed responsibilities?** | No |

### `src/ui/measurementPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Distance Measurement panel updates and shared Measurement History list rendering |
| **Logic type** | DOM updates (`updateMeasurementPanel`, `renderMeasurementHistory`); optional session-local landmark name on active Point A/B when present, rendered in a stacked compact name + coords layout so long names do not overflow the left inspector; Front Surface meta label when both points are on the front face; toggles `#history-empty` separately from tab visibility; UI-only layout — does not change measurement math, history schema, or export/import |
| **Features depending on it** | Left Distance Measurement panel, History tab; called from `features/measurement.js` |
| **Mixed responsibilities?** | No |

### `src/ui/annotationControls.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Landmark Preset dropdown UI wiring in Annotate mode |
| **Logic type** | `setupAnnotationControls()`, `resetAnnotationControls()`; populates `#annotation-preset-select` from `getLandmarkPresetsForType()` when annotation type changes; auto-fills `#annotation-name-input` when a non-`custom` preset is selected; preserves manual name when `custom` preset is chosen |
| **Features depending on it** | Selected Point annotation controls (Annotate mode only); called from `main.js` on init and from `features/annotations.js` on add/clear; imports from `core/annotationTypes.js` and `ui/domRefs.js` |
| **Mixed responsibilities?** | No — UI-only annotation naming helper module |

### `src/ui/annotationPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Annotation List rendering and per-annotation Delete UI |
| **Logic type** | DOM updates (`renderAnnotationList`); renders annotation type labels per card; toggles `#annotations-empty` instead of hiding `#annotations-panel` because tab visibility is handled separately by `sessionTabs.js` |
| **Features depending on it** | Annotation list in Annotations tab (right Session Data sidebar); imports `formatAnnotationTypeLabel` from `core/annotationTypes.js`, `formatAnnotationCoords` from `core/formatters.js`, list/empty-state elements from `domRefs.js`; triggers `updateSceneGraph()`; called from `features/annotations.js` with delete callback |
| **Mixed responsibilities?** | No |

### `src/ui/annotationValidationMessage.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Displays annotation validation feedback in the UI |
| **Logic type** | DOM updates (`showAnnotationValidationMessage`, `clearAnnotationValidationMessage`) — sets/clears message text and toggles the validation message element's `hidden` state |
| **Features depending on it** | Add Annotation flow (Annotate mode) — shows the message returned by `features/annotationValidation.js` when input is invalid; imports the validation message element from `ui/domRefs.js` |
| **Mixed responsibilities?** | No — UI-only validation feedback module |

### `src/ui/sceneGraphPanel.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Scene Graph tree in the Graph tab of the right Session Data sidebar |
| **Logic type** | `setupSceneGraphPanel(measurement)`, `updateSceneGraph()`, `renderSceneGraph()`; reads session state via `buildSceneState()` from `features/sceneExport.js`; renders clickable graph rows (`.scene-graph-row--clickable`) and calls graph highlight helpers from `features/sceneGraphHighlight.js`; displays annotation node type (flat rows with type label, or compact grouping by type when multiple types exist); compact history/annotation rows; Measurement History and Annotations groups collapsed by default |
| **Features depending on it** | Graph tab (`#scene-graph-panel`, `#scene-graph-tree`); refreshed from measurement panel, annotation panel, app mode controls, and measurement clear/restore paths |
| **Mixed responsibilities?** | No — UI visualization module; 3D highlight construction lives in `sceneGraphHighlight.js` |

### `src/ui/sessionTabs.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Controls the right Session Data tab interface |
| **Logic type** | `setupSessionTabs()`, segmented tab switching, tab panel visibility via `.tab-panel-hidden`, calls `clearGraphHighlight()` on tab switch |
| **Features depending on it** | History / Annotations / Body / Graph / Files sidebar tabs (`#session-tabs`, `#tab-panel-history`, `#tab-panel-annotations`, `#tab-panel-body`, `#tab-panel-graph`, `#tab-panel-files`) |
| **Mixed responsibilities?** | No — UI-only tab switching module |

### `src/ui/viewControls.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | View Controls checkbox UI in left Metrology Inspector (grouped Reference / Scene Overlays / Grid / Points / Evidence markup; Evidence Body Evidence Overlay + Secondary Body Candidates changes are wired in `bodyEvidencePanel.js`; Body Measurement Previews wired here) |
| **Logic type** | `setupViewControls(referenceMarkers, volumeGrid, measurement)`; wires `#show-origin-center`, `#show-annotations`, `#show-3d-lattice-points`, `#show-2d-grid-points`, `#show-measurement-lines`, and `#show-body-measurement-previews` change handlers; initializes visibility from checkbox default state |
| **Features depending on it** | View Controls panel (`#view-controls-panel`); calls `setReferenceMarkersVisible()`, `setProjectedReferenceMarkersVisible()`, `setAnnotationsVisible()`, `setProjectedAnnotationsVisible()`, `setInternalVolumeGridVisible()`, `setGrid2dPointsVisible()`, `setMeasurement3dLinesVisible()`, `setBodyMeasurementPreviewVisible()`; imports checkbox refs from `ui/domRefs.js`; called from `main.js` on init after `setupGrid2dNavigator()`, `setupProjectionLinking()`, and `setupBodyMeasurementPreview()` |
| **Mixed responsibilities?** | No — UI-only visibility toggle module for non–Body-Evidence Evidence checkboxes (Body Evidence Overlay + Secondary Body Candidates live in Evidence markup but are wired by `bodyEvidencePanel.js`; Body Measurement Previews remain independent from A/B Measurement Lines) |

### `src/ui/appModeControls.js`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Mode switch UI in left Metrology Inspector, mode-specific panel visibility, status bar mode label/hint updates, workflow sync, mode-switch cleanup wiring |
| **Logic type** | `setupAppModeControls`, `switchToMode`, `updateModeUI`, `leaveInspectMeasureMode`, `leaveAnnotateMode`, `applyImportedMode` (applies imported app mode without triggering mode-switch cleanup); syncs inspector workflow via `setInspectorWorkflow(workflowForMode(mode))` |
| **Features depending on it** | Mode toggle buttons (`#mode-inspect-measure`, `#mode-annotate`), Body Evidence workflow button handled separately by `inspectorWorkflow.js`, read-only `#status-mode-value`, `#status-hint`, Scene State JSON import; hides Selected Point panel and selection highlight in Inspect & Measure; hides Distance Measurement panel in Annotate; clears active measurement or selection/input on normal mode switch; imports from `features/appMode.js`, `features/measurement.js`, `features/selection.js`, `features/annotations.js`, `ui/inspectorWorkflow.js`, `ui/domRefs.js` |
| **Mixed responsibilities?** | No |

### `src/style.css`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Stylesheet entry file — `@import` chain only; loads split modules from `src/styles/` |
| **Logic type** | Presentation only (no rules; four `@import` statements) |
| **Features depending on it** | All UI layout and styling via imported modules; linked from `index.html` as `/src/style.css` |
| **Mixed responsibilities?** | No — entry point only (Phase 8) |

### `src/styles/variables.css`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Design tokens, global reset, base `html`/`body`, cosmic background gradients |
| **Logic type** | Presentation only (`:root` custom properties, reset, page background) |
| **Features depending on it** | All UI chrome and overlays (via cascade from `style.css` import order) |
| **Mixed responsibilities?** | No |

### `src/styles/layout.css`

| Aspect | Detail |
|--------|--------|
| **Purpose** | REVacity app grid shell, header, sidebars (left Metrology Inspector, right Session Data with header/subtitle), viewport/workspace layout (panes, split divider, default ~57% 3D split sizing, `data-workspace-mode` visibility for 3D / split / body-graph) |
| **Logic type** | Presentation only (`#app-layout`, `#top-header`, `#left-sidebar`, `#right-sidebar`, `#viewport`, `#workspace-content`, `.workspace-pane--3d`, `.workspace-pane--2d`, `.workspace-pane--body-graph`, `.workspace-split-divider`, `#canvas-container`) |
| **Features depending on it** | Five-region grid layout, sidebar scroll areas, workspace pane visibility (3D Space / 2D Workspace / Body Graph via `data-workspace-mode`), combined 2D Workspace split sizing (slightly more default width for the 3D pane), canvas container sizing |
| **Mixed responsibilities?** | No |

### `src/styles/components.css`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Inspector sections (incl. subgroups, collapsible headers, Body Evidence panel with Summary / Primary + Secondary Candidates / Selected Landmark / Promote, Body Tab Consolidation styles for Status counts / Advanced Evidence Details / Promoted Body Anchors table / Body Measurement Readiness, stacked Distance Measurement point name/coords), workflow switch (`.mode-toggle`), View Controls checkboxes, Session Data tab bar (compact Hist / Annos / Body / Graph / Files), workspace tabs (`.workspace-tabs`, `.workspace-tab-btn`), Body Graph Workspace styles (`.body-graph-*`), hidden 2D mode panel (Control-key toggle), buttons, history/annotation lists (including annotation type and landmark preset dropdowns, type labels), Export / Import, Scene Graph (typed annotation rows/badges), clickable Scene Graph row styles, empty states for Session Data tabs |
| **Logic type** | Presentation only (`.inspector-section`, `.inspector-subgroup`, `.section-title--collapsible`, `.is-collapsed`, `.body-evidence-*`, `.body-evidence-candidates--secondary`, `.measurement-point-name`, `.measurement-point-coords`, `.promoted-body-anchors-*`, `.body-anchor-audit*`, `.measurement-reference-level*`, `.workspace-tabs`, `.workspace-tab-btn`, `.body-graph-*`, `.grid2d-mode-panel` [hidden], `.session-tabs`, `.session-tab-btn`, `.tab-panel-hidden`, `.session-empty-state`, `.scene-graph-row--clickable`, `#history-list`, `#annotation-list`, `.annotation-select`, `.mode-toggle`, `.panel-button`, etc.) |
| **Features depending on it** | Metrology Inspector panels, Body Evidence workflow UI (primary + secondary), consolidated Body tab (Status / Advanced Details / Promoted Body Anchors / Readiness), Distance Measurement named-point layout, collapsible sections/subgroups, Session Data tabbed sidebar, workspace tab bar, Body Graph Workspace, lists, Clear/action buttons |
| **Mixed responsibilities?** | No |

### `src/styles/overlays.css`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Screen-space hover tooltip, passive bottom status bar, CSS2D label classes, Front Surface Grid Navigator UI, shared measurement overlay, projected markers, Body Measurement Preview lines (`#grid2d-body-measurement-previews`), Body Evidence overlay markers/tooltip (primary + secondary; selected marker = internal emphasis only, no large outer halo), relative marker sizing CSS variables |
| **Logic type** | Presentation only (`#hover-coordinate-tooltip`, `#bottom-status-bar`, `.axis-label`, `.measurement-distance-label`, `.ref-marker-label`, `.annotation-marker-label`, `.grid2d-navigator-panel`, `.grid2d-status-row`, `.grid2d-selection-block`, `.grid2d-grid-wrapper`, `.grid2d-lattice-point`, `.grid2d-measure-marker`, `.grid2d-projection-marker`, `#grid2d-markers`, `#grid2d-body-measurement-previews`, `.grid2d-body-measurement-preview-line`, `#grid2d-body-evidence-markers`, `.grid2d-body-evidence-marker`, `.grid2d-body-evidence-marker--secondary`, `.grid2d-body-evidence-marker--active`, `#grid2d-body-evidence-tooltip`, `#grid2d-projection-tooltip`, `--grid2d-point-*` sizing vars, `.grid2d-axis-dir`, `.grid2d-axis-tick`, `.grid2d-legend`, `.grid2d-nav-actions`, etc.) |
| **Features depending on it** | Hover coordinate tooltip, status bar readout, Three.js CSS2D labels, Front Surface grid visual layer, shared measurement markers/line/label, projected Origin/Center/annotation markers, Body Measurement Preview lines (visual-only; separate from A/B measurement overlay), Body Evidence front overlay markers (primary + secondary) |
| **Mixed responsibilities?** | No |

### `dist/`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Generated production bundle from `vite build` |
| **Logic type** | Build artifact |
| **Features depending on it** | Production preview/deploy only |
| **Mixed responsibilities?** | N/A — do not edit directly |

### `.gitignore`

| Aspect | Detail |
|--------|--------|
| **Purpose** | Excludes `node_modules/`, `dist/`, `.DS_Store` from version control |
| **Mixed responsibilities?** | No |

---

## 3. `src/main.js` Breakdown

`main.js` is a thin orchestrator. All feature logic lives in dedicated modules. Front Surface, Body Evidence, Body Graph Workspace, inspector workflow, and collapsible inspector UI are wired as self-contained setup calls.

| Feature area | Key functions / code | Notes |
|--------------|-------------------|-------|
| **Core / metrology / feature / interaction imports** | `core/`, `metrology/`, `features/`, `interactions/` | Scene, lattice, measurement, annotations, picking/hover |
| **UI imports** | mode/annotation controls, inspector workflow, Scene Graph/tabs, View Controls, Body Evidence panel/consolidated Body tab/overlay, Body Graph Workspace, collapsible sections, grid2d, workspace layout, export/import | Left/right inspector + workspace panes |
| **Scene assembly** | `scene.add(...)` | Metrology + feature objects including `graphHighlightGroup` and `bodyMeasurementPreviewGroup` |
| **Interaction / UI setup** | `setupPointInteraction` → `setupInspectorWorkflow` → mode/annotation → export/import → Scene Graph/tabs → Front Surface measurement → grid2d → projection linking → Body Measurement Preview → View Controls → Body Evidence overlay/panel → `setupBodyTabConsolidatedPanel` → `initCollapsibleSections` → `setupBodyGraphWorkspace` → workspace layout | Body Measurement Preview before View Controls; Body Evidence + consolidated Body tab and collapsible sections after View Controls; Body Graph before workspace layout |
| **Resize / animate** | `onResize`, `animate()` | LOD update + WebGL + CSS2D render |

Additional owners beyond the earlier modular split:

| Concern | Now owned by |
|---------|--------------|
| Body Evidence state + promote + diagnostic download | `features/bodyEvidence.js` + `features/bodyEvidenceAdapter.js` |
| Body Evidence workflow panel UI | `ui/bodyEvidencePanel.js` |
| Consolidated Session Data Body tab (Status + Promoted Anchors + Readiness) | `ui/bodyTabConsolidatedPanel.js` (+ `buildBodyAnchorAudit`, `buildAnatomicalMeasurementLines`) |
| Anatomical Measurement Lines compute | `features/bodyMeasurementLines.js` |
| Measurement Line Preview Overlay (visual Ready lines; separate from A/B) | `features/bodyMeasurementPreview.js` |
| Measurement Reference Levels compute (internal; separate panel not shown by default) | `features/bodyMeasurementLevels.js` |
| Body Graph Contract v0 | `features/bodyGraph.js` (+ `bodyGraph.test.js`) |
| Body Graph Workspace v0 | `ui/bodyGraphWorkspace.js` |
| Historical Body tab panel stubs (not wired) | `ui/bodyEvidenceQaPanel.js`, `ui/bodyMeasurementLevelsPanel.js`, `ui/bodyMeasurementLinesPanel.js` |
| Body Evidence Front Surface overlay | `ui/bodyEvidenceOverlay2d.js` |
| Inspector workflow switching | `ui/inspectorWorkflow.js` |
| Left inspector collapsible sections | `ui/collapsibleSections.js` |
| Landmark display naming | `core/landmarkDisplay.js` |

**Initialization flow:** imports → feature factories → scene assembly (incl. body measurement preview group) → `setupPointInteraction()` → `setupInspectorWorkflow()` → `setupAppModeControls()` → `setupAnnotationControls()` → `setupSceneExport()` → `setupSceneImport()` → `setupSceneGraphPanel()` → `setupSessionTabs()` → `setupFrontSurfaceMeasurement(measurement)` → `setupGrid2dNavigator()` → `setupProjectionLinking(refreshGrid2dNavigator)` → `setupBodyMeasurementPreview(refreshGrid2dNavigator)` → `setupViewControls(...)` → `setupBodyEvidenceOverlay2d(refreshGrid2dNavigator)` → `setupBodyEvidencePanel()` → `setupBodyTabConsolidatedPanel()` → `initCollapsibleSections()` → `setupBodyGraphWorkspace()` → `setupWorkspaceLayout()` → resize listener → `animate()`.

## 4. Stylesheet Breakdown

`index.html` links `/src/style.css` as the sole CSS entry. Phase 8 split the former monolith into four modules imported in cascade order (variables → layout → components → overlays).

### `src/style.css`

| Aspect | Detail |
|--------|--------|
| **Role** | Entry file only — four `@import` statements, no rules |
| **Import order** | `variables.css` → `layout.css` → `components.css` → `overlays.css` |

### `src/styles/variables.css`

| Section | Purpose |
|---------|---------|
| **Global reset + `:root`** | CSS variables (REVacity palette), base `html`/`body`, cosmic background gradients |

### `src/styles/layout.css`

| Section | Purpose |
|---------|---------|
| **`#app-layout`** | CSS grid shell: header, sidebars, viewport, footer |
| **Top header** | Brand, title, status badges, pulse dot |
| **Sidebars** | Left Metrology Inspector (workflow switch, View Controls, Body Evidence, mode/workflow-specific panels, collapsible sections/subgroups), right Session Data (header/subtitle, compact tabs, scroll area) |
| **Viewport / workspace** | `#viewport`, `#workspace-tabs`, `#workspace-content`, workspace panes (3D / 2D / Body Graph), split divider, `#canvas-container`; `data-workspace-mode` visibility |

### `src/styles/components.css`

| Section | Purpose |
|---------|---------|
| **Inspector sections** | `.inspector-section`, `.info-row`, data value colors (cyan/magenta accents) |
| **Inspector subgroups / collapse** | `.inspector-subgroup`, `.section-title--collapsible`, `.is-collapsed` |
| **Mode / workflow switch** | `.mode-toggle`, `.mode-toggle-btn` in left inspector `#mode-panel` (Inspect & Measure / Annotate / Body Evidence) |
| **View Controls** | `.inspector-section--view-controls`, `.view-control-label`, `.view-control-checkbox` in left inspector `#view-controls-panel` |
| **Body Evidence** | `.inspector-section--body-evidence`, `.body-evidence-*` Import / Actions / Summary / Primary + Secondary Candidates / Selected Landmark / Promote styles; Body Tab Consolidation (`.session-body-evidence-status`, `.body-tab-*`, `.promoted-body-anchors-*` table, `.body-measurement-readiness`, `.body-readiness-*`); stacked measurement point name/coords (`.measurement-point-name`, `.measurement-point-coords`) |
| **History** | `#history-list`, `.history-item` cards in History tab |
| **Annotations** | Annotation Type dropdown, Landmark Preset dropdown, Annotation Name input, and Add Annotation in left Selected Point panel (Annotate workflow); `#annotation-list` in Annotations tab (type labels per card), delete buttons, shared `.annotation-select` dropdown styling |
| **Session Data tabs** | `.session-tabs`, `.session-tab-btn`, `.tab-panel-hidden`, `.session-empty-state` (compact Hist / Annos / Body / Graph / Files) |
| **Workspace tabs** | `.workspace-tabs`, `.workspace-tab-btn` in center viewport (3D Space / 2D Workspace / Body Graph) |
| **Body Graph Workspace** | `.body-graph-workspace`, `.body-graph-header`, `.body-graph-summary`, `.body-graph-stage`, `.body-graph-edge--ready` / `--missing`, `.body-graph-node--present` / `--missing` |
| **2D mode panel (hidden)** | `.grid2d-mode-panel` — Control-key toggle; buttons in HTML not wired in JS |
| **Scene Graph** | `#scene-graph-panel`, `#scene-graph-tree`, `.scene-graph-group`, `.scene-graph-row--clickable` in Graph tab |
| **Export / Import** | `#export-import-panel`, `#export-scene-json`, `#load-scene-json`, `#scene-import-status` in Files tab |
| **Buttons** | `.panel-button`, compact variants, measurement action grid |

### `src/styles/overlays.css`

| Section | Purpose |
|---------|---------|
| **Annotation marker label** | `.annotation-marker-label` (CSS2D) |
| **Hover coordinate tooltip** | `#hover-coordinate-tooltip` (screen-space overlay) |
| **Bottom status bar** | Passive scale/grid/sampling/mode label readout, hint text (no mode toggle) |
| **Three.js CSS2D overlays** | `.axis-label`, `.measurement-distance-label`, `.ref-marker-label` |
| **2D Grid Navigator** | `.grid2d-navigator-panel`, compact header/status row (`.grid2d-status-row`), selection block (`.grid2d-selection-block`), `.grid2d-grid-wrapper`, `.grid2d-field`, `.grid2d-lattice-point` (+ `--picked`/`--refined`/`--fine`), shared Front Surface measurement overlay, projected markers (`#grid2d-markers`, `.grid2d-projection-marker`), Body Measurement Preview lines (`#grid2d-body-measurement-previews`, `.grid2d-body-measurement-preview-line`), Body Evidence overlay (`#grid2d-body-evidence-markers`, `.grid2d-body-evidence-marker`, `.grid2d-body-evidence-marker--secondary`, `.grid2d-body-evidence-marker--active`, `#grid2d-body-evidence-tooltip`), relative sizing (`--grid2d-point-*` vars), `.grid2d-axis-dir`, `.grid2d-axis-tick`, `.grid2d-legend`, `.grid2d-nav-actions` |

No CSS modules or preprocessors. Vite bundles all imports into a single production CSS asset.

---

## 5. `index.html` Breakdown

### Main app layout (`#app-layout`)

CSS grid with five regions: top header, left sidebar, center viewport, right sidebar, bottom status bar.

### Top header (`#top-header`)

- REVacity branding, **Metrology Space** title, subtitle
- Status badges: **ACTIVE GRID**, **68,921 POINTS**
- Non-interactive chrome

### Left sidebar — Metrology Inspector (`#left-sidebar`)

| Section | ID | Static / dynamic |
|---------|-----|------------------|
| Workflow | `#mode-panel` | Segmented toggle: **Inspect & Measure** / **Annotate** / **Body Evidence** (`#mode-inspect-measure`, `#mode-annotate`, `#workflow-body-evidence`); collapsible |
| View Controls | `#view-controls-panel` | Visibility-only grouped toggles — Reference / Scene Overlays / Grid / Points / Evidence; Body Evidence Overlay under Evidence (unchecked by default); Secondary Body Candidates under Evidence (enabled after analyze when secondary allowlist landmarks exist); Body Measurement Previews under Evidence (checked by default); other visibility toggles checked by default; collapsible |
| Body Evidence | `#body-evidence-panel` | Body Evidence workflow — Import Files / Actions (collapsible subgroups) / Summary / Primary Candidates / Secondary Candidates / Selected Landmark / Promote / Clear Selection; diagnostic download; collapsible |
| Distance Measurement | `#measurement-panel` | Inspect & Measure workflow — Point A/B coords (stacked landmark name + coords when applicable), distance, Clear Point A/B, Clear Measurement; collapsible when visible |
| Selected Point | `#selection-panel` | Annotate workflow only — dynamic coords `#selected-x/y/z`; `#annotation-add-controls` with `#annotation-type-select`, `#annotation-preset-select`, `#annotation-name-input`, **Add Annotation** `#add-annotation`; **Clear Selection** `#clear-selection`; collapsible when visible |

Room Dimensions (`#info-panel`) is no longer present as a left-sidebar consumer. Collapse state is UI-only (`ui/collapsibleSections.js`) and is not part of Scene State export/import.

### Center viewport (`#viewport`)

- **Workspace tabs** (`#workspace-tabs`): three tabs — **3D Space** (default), **2D Workspace** (`#workspace-tab-split`), and **Body Graph** (`#workspace-tab-body-graph`). No standalone 2D Space tab.
- **Workspace content** (`#workspace-content`): flex container for panes and divider
- **3D pane** (`#workspace-pane-3d`): `#canvas-container` — WebGL canvas and CSS2D label renderer appended here by JS; `#hover-coordinate-tooltip` screen-space overlay
- **Split divider** (`#workspace-split-divider`): draggable vertical separator (2D Workspace only)
- **2D pane** (`#grid2d-navigator-panel`): Front Surface Grid Navigator markup — title/subtitle (`Front Surface — X / Y`), compact status row, selection details, `#grid2d-markers` (projected Origin/Center/annotations), `#grid2d-body-measurement-previews` (Body Measurement Preview lines), `#grid2d-body-evidence-markers` (Body Evidence front overlay), `#grid2d-projection-tooltip`, `#grid2d-body-evidence-tooltip`, `#grid2d-grid-wrapper`, legend, Back/Reset/Split actions; shown only inside 2D Workspace beside the 3D pane (no Top/Side toggles, no duplicate measurement clear panel)
- **Body Graph pane** (`#body-graph-workspace`): Body Graph Workspace v0 markup — compact summary (`Nodes {present}/13 · Edges {ready}/13`) + stage (`#body-graph-edges` SVG + `#body-graph-nodes`); shown only in Body Graph tab
- 2D is **not** in the left sidebar or right Session Data tabs
- Body Graph Workspace is **not** the Session Data Scene Graph

### Right sidebar — Session Data (`#right-sidebar`)

- Title: **Session Data**; subtitle: *Saved measurements and annotations*
- Tab bar (`#session-tabs`): compact **Hist** / **Annos** / **Body** / **Graph** / **Files** (History default)
- Agent Tools placeholder removed

| Tab | Tab panel | Content |
|-----|-----------|---------|
| History | `#tab-panel-history` | `#history-panel` — `#history-empty`, `#history-list`, `#clear-history` |
| Annotations | `#tab-panel-annotations` | `#annotations-panel` — `#annotations-empty`, `#annotation-list` with type labels and Delete buttons |
| Body | `#tab-panel-body` | `#body-evidence-status-panel` (`#session-body-evidence-status`) + `#promoted-body-anchors-panel` (compact Name/X/Y/Z table) + `#body-measurement-readiness-panel` (`#body-measurement-readiness`) |
| Graph | `#tab-panel-graph` | `#scene-graph-panel` — read-only `#scene-graph-tree` |
| Files | `#tab-panel-files` | `#export-import-panel` — Export Scene JSON, Load Scene JSON, import error message |

### Bottom status bar (`#bottom-status-bar`)

- Passive readout only: Scale, Grid, Sampling, read-only Mode label (`#status-mode-value`), hint (`#status-hint`)
- No interactive mode toggle (toggle lives in left inspector)

### Script entry

- `<script type="module" src="/src/main.js">` — sole JS entry point

---

## 6. Current Coupling / Complexity Notes

### Modular architecture (post-refactor)

- The former **`src/main.js` monolith** has been split across dedicated modules under `src/core/`, `src/metrology/`, `src/interactions/`, `src/features/`, `src/ui/`, and `src/styles/`.
- **`src/main.js`** is a thin orchestrator: imports modules, assembles the scene (including `graphHighlightGroup`), calls setup for interaction, inspector workflow, mode/annotation UI, View Controls, Scene export/import, Scene Graph/tabs, Front Surface measurement/navigator/projection linking, Body Evidence overlay/panel, consolidated Body tab, Body Graph Workspace, collapsible sections, and workspace layout, registers resize, and runs the animation loop.
- Picking, raycasting, and pointer event wiring live in `src/interactions/raycast.js`, `picking.js`, and `pointerEvents.js` (Phase 9).

### UI DOM mixed with Three.js

- All feature panel and list rendering is in dedicated `src/ui/` modules (Phases 2, 6, 7); `main.js` no longer updates sidebar lists or registers event listeners directly.
- Phase 7 separated annotation list rendering (`annotationPanel.js`) and annotation CRUD/disposal (`features/annotations.js`).

### Shared interaction pipeline

- One pointer pipeline serves hover, selection, measurement clicks, and reference-marker hover.
- `setupPointInteraction()` in `interactions/pointerEvents.js` registers all button listeners and canvas events.
- Hover scheduling and volume/reference hover coordination live in `interactions/hover.js`; reference marker hover (`updateReferenceMarkerHover`) lives in `metrology/referenceMarkers.js` and receives shared `raycaster` and `mouse` from `interactions/raycast.js` via hover deps.

### State scattered at module scope

- Pointer down coords are module-level in `interactions/pointerEvents.js`.
- `allSamplePositions` is populated in `setupPointInteraction()` via `setAllSamplePositions()` in `interactions/raycast.js`.
- `selectedPoint` state lives in `src/features/selection.js` (Phase 5).
- Hover drag/frame flags live in `hoverState` in `src/interactions/hover.js` (Phase 5).
- `measurementHistory`, `measurementCounter`, and active `measurement` object state live in `src/features/measurement.js` (Phase 6); `main.js` holds the `measurement` instance for scene wiring only.
- `annotations`, `annotationIdCounter`, `annotationsGroup`, and `annotationsVisible` live in `src/features/annotations.js` (Phase 7).
- `referenceMarkersVisible` state lives in `src/metrology/referenceMarkers.js`.
- `currentAppMode` state lives in `src/features/appMode.js`.
- DOM element references are module-level exports in `src/ui/domRefs.js` (Phase 2).
- 2D Grid Navigator state (`selectedPoint2d`, `selectedRegionPoints`, `refinedRegions`, `active2dMode`, `visualTransform`) lives in `src/ui/grid2dNavigator.js`.
- Workspace layout state (`currentWorkspace`, `splitRatio`, `dividerDragActive`) lives in `src/ui/workspaceLayout.js`.
- **`pickVolumePoint`** in `interactions/picking.js` is mode-aware: Inspect & Measure prefers promoted `body_landmark` hits then lattice → `advanceMeasurement`; Annotate calls `selectPoint` only (never A/B, including body landmarks).
- **`setupAppModeControls`** in `ui/appModeControls.js` handles mode toggle, panel visibility, status label/hint, workflow sync, and mode-switch cleanup (clear active measurement or selection/input).
- **`setupInspectorWorkflow`** in `ui/inspectorWorkflow.js` owns the Body Evidence inspector-only workflow switch.

### 2D Grid Navigator (Front Surface + shared measurement)

- **`src/ui/grid2dNavigator.js`** owns Front Surface navigator chrome/refinement/overlay rendering.
- Shared measurement advance/read lives in **`src/features/frontSurfaceMeasurement.js`** (`advanceFrontSurfaceMeasurement` / `advanceSharedMeasurement`); canonical A/B + history live in **`src/features/measurement.js`**.
- **`src/features/projectionLinking.js`** projects Origin/Center/annotations (Front Surface X/Y mapping); in Inspect & Measure, promoted `body_landmark` projected markers also advance shared A/B (Body Landmark Measurement Picking v0).
- Top/Side views are removed. Base grid step is **10 cm**. Split is simplified / non-recursive.
- Left Distance Measurement panel owns clear controls; 2D duplicate clears were removed.
- 2D UI-only state is not exported. Scene State JSON schema is unchanged.
- Obsolete Graph **2D Workspace State** card was removed.

### Session Data tabbed sidebar

- Tab visibility is separated from empty-state visibility (`.tab-panel-hidden` vs `hidden` on empty-state elements).
- Hidden tab panels continue updating in the background when session data changes.
- `src/ui/sessionTabs.js` is UI-only and does not mutate scene state.
- Right sidebar is **Session Data** with compact tabbed History, Annotations, Body, Graph, and Files panels — avoids stacked duplicate sections. Agent Tools placeholder removed.
- Body tab holds Body Tab Consolidation v0 (`ui/bodyTabConsolidatedPanel.js`: Body Evidence Status + Promoted Body Anchors table + Body Measurement Readiness); primary Body Evidence actions stay in the left workflow panel. Separate Audit / Levels / Lines panels are not shown by default.

### Scene Graph temporary highlighting

- Scene Graph highlighting is visual-only and intentionally separate from scene state.
- Graph highlight objects are **not** part of volume pick meshes (`volumeGrid.userData.pickMeshes`).
- Temporary previews auto-clear (~2 seconds) and are cleared by tab switches, successful imports, Clear History, and annotation delete.
- `src/features/sceneGraphHighlight.js` owns `graphHighlightGroup`; `src/ui/sceneGraphPanel.js` renders clickable rows and delegates 3D construction to highlight helpers.

### Scene State export (read-only)

- `src/features/sceneExport.js` reads state from app mode, active measurement, measurement history (`getMeasurementHistory`), and annotations (`getAnnotations`).
- Export is read-only and does not mutate runtime state.

### Scene State import (validate-then-restore)

- Scene import is intentionally read/restore oriented and validates before mutation.
- `src/features/sceneImport.js` validates imported JSON, then orchestrates restore through module-owned functions in `measurement.js`, `annotations.js`, and `appModeControls.js`.
- Import restores session data but does not rebuild geometry or apply `sceneScale` changes.
- `applyImportedMode()` in `ui/appModeControls.js` avoids normal mode-switch cleanup so restored active measurement is preserved during import.
- Annotation `type` is normalized during `restoreAnnotations()` — older exports without `type` default to `custom` per annotation without rejecting the whole file.

### Annotation node types and landmark presets

- Annotation node types add semantic metadata only — they do not change picking, measurement math, coordinates, or 3D metrology scale.
- **Landmark Presets** are UI naming helpers layered on top of annotation node types in `ui/annotationControls.js` with preset mappings in `core/annotationTypes.js`.
- Presets auto-fill the Annotation Name input but are **not** stored or exported separately — only the final `name`, `type`, and `position` persist.
- Presets do not change 3D coordinates, measurement math, export schema beyond existing `name`/`type` fields, or app mode behavior.
- Manual annotation naming remains supported via the `custom` preset and direct name input edits.
- Allowed types and preset groups live in `core/annotationTypes.js` (not `src/features/annotationTypes.js`).
- Import keeps backward compatibility with older exports by defaulting missing annotation `type` to `custom` via `normalizeAnnotationType()`.
- Imported annotations do not restore preset dropdown state.
- 3D annotation marker visuals are unchanged by type or preset; type appears in UI (dropdowns, Annotation List, Scene Graph) and in Scene State JSON.
- **Landmark Sets / Guided Capture Workflow** is postponed and not implemented — do not document or wire it until explicitly added.

### CSS2D label disposal

- Annotation CSS2D DOM cleanup (`removeAnnotationLabelElements`, `disposeAnnotationGroup`) lives in `src/features/annotations.js` (Phase 7), colocated with annotation CRUD.

### Stylesheet organization

- Phase 8 split the former **`src/style.css` monolith** into `src/styles/variables.css`, `layout.css`, `components.css`, and `overlays.css`.
- **`src/style.css`** is the sole CSS entry (linked from `index.html`); it contains only the `@import` chain. Cascade order is preserved: variables → layout → components → overlays.

### Duplicated list-rendering patterns

- `renderMeasurementHistory()` (in `ui/measurementPanel.js`) and `renderAnnotationList()` (in `ui/annotationPanel.js`) follow similar “clear container → build items → toggle empty state” patterns with separate markup/class names.

### DOM query strategy

- All static UI elements are queried once at module load in `src/ui/domRefs.js` (Phase 2).
- Dynamic list items (history, annotations) create buttons with inline listeners on each render.

### Viewport sizing

- `syncRendererSize()` in `src/core/scene.js` (Phase 3) aligns WebGL and CSS2D renderers to `#canvas-container` — shared infrastructure used by all CSS2D labels (axes, measurement, references, annotations). Also invoked from `workspaceLayout.js` when workspace panes resize.

### Workspace layout and 2D pane sizing

- `src/ui/workspaceLayout.js` uses `ResizeObserver` on `#workspace-content` and `#grid2d-grid-wrapper` to trigger 2D redraw and 3D renderer resize.
- Split divider drag updates `splitRatio` and pane flex widths; default ratio favors the 3D pane slightly (~57%); minimum pane width 200 px.
- 2D state persists when switching workspace tabs (not reset on tab switch).

### Right sidebar layout

- Right sidebar is **Session Data** — compact tabbed History, Annotations, Body, Graph, and Files panels. Agent Tools placeholder removed.

---

## 7. Current Feature Ownership Map

| Feature | Main file | UI elements | State variables | Rendered objects |
|---------|-----------|-------------|-----------------|------------------|
| **App mode / workflow** | `features/appMode.js` + `ui/appModeControls.js` + `ui/inspectorWorkflow.js` | `#mode-panel`, `#mode-inspect-measure`, `#mode-annotate`, `#workflow-body-evidence`, `#status-mode-value`, `#status-hint` | `currentMode` in `features/appMode.js`; workflow id in `inspectorWorkflow.js` | — |
| **Scale / LOD constants** | `core/constants.js` (imported by `main.js`) | Header badge, status bar | `ROOM_SIZE`, `GRID_UNIT`, `INTERNAL_*`, `LOD_*`, `LABEL_STEP`, `HOVER_TOOLTIP_OFFSET` | — |
| **Display formatting** | `core/formatters.js` + `core/landmarkDisplay.js` | Panels, tooltip, history, annotation list, Body Evidence labels | — | — |
| **Distance / LOD math** | `core/math.js` (imported by `main.js`) | Measurement panel, floating label | — | — |
| **DOM references** | `ui/domRefs.js` (imported across app) | All panels, buttons, lists, mode/workflow controls, `exportSceneJsonBtn`, `#canvas-container`, `#hover-coordinate-tooltip` | — | — |
| **Scene / rendering infrastructure** | `core/scene.js` (imported by `main.js`) | `#canvas-container` | `scene`, `camera`, `controls` | WebGL canvas, CSS2D label layer, ambient + directional lights |
| **Cube / room shell** | `metrology/roomShell.js` (imported by `main.js`) | Header / status scale chrome (no left Room Dimensions panel) | `ROOM_SIZE` in `core/constants.js` | `createRoomShell()` faces + edges |
| **Surface grid (10 cm)** | `metrology/roomShell.js` | Status bar | `GRID_UNIT` in `core/constants.js` | `createGridMarkers()` InstancedMesh |
| **Internal lattice (5 cm)** | `metrology/volumeGrid.js` | Header badge | `allSamplePositions` in `interactions/raycast.js` (populated by `pointerEvents.js`); lattice constants in `core/constants.js` | `internalVolumeGrid` (3 LOD InstancedMesh layers); `userData.pickMeshes` |
| **LOD** | `metrology/volumeGrid.js` + `main.js` (`animate`) | — | `LOD_FAR/MID/NEAR` in `core/constants.js`; `smoothstep` in `core/math.js` | Opacity updated on coarse/medium/fine layers |
| **Axes + tick labels** | `metrology/axes.js` | — | `LABEL_STEP` in `core/constants.js` | `createAxes()` lines, cones, CSS2D labels |
| **Raycasting / volume resolution** | `interactions/raycast.js` | — | `raycaster`, `mouse`, vector temps | Raycast on `userData.pickMeshes`; nearest-sample fallback; `resolveBodyLandmarkMeasurementPoint` for promoted body landmarks |
| **Click picking** | `interactions/picking.js` + `interactions/pointerEvents.js` | — | — | `pickVolumePoint` → Inspect: body_landmark then lattice → `advanceMeasurement`; Annotate: `selectPoint` only |
| **Pointer events / button wiring** | `interactions/pointerEvents.js` | All Clear/History/Annotation buttons | pointer down coords in `pointerEvents.js` | Canvas pointer listeners |
| **Hover highlight** | `interactions/hover.js` + `interactions/pointerEvents.js` | — | `hoverState` in `interactions/hover.js` | `hoverHighlight` mesh; A/B preview colors in Inspect & Measure; amber in Annotate |
| **Hover coordinate tooltip** | `ui/hoverTooltip.js` + `interactions/hover.js` + `styles/overlays.css` (via `style.css`) | `#hover-coordinate-tooltip` | — | HTML overlay (not Three.js) |
| **Point selection** | `features/selection.js` + `interactions/picking.js` + `ui/selectionPanel.js` | `#selection-panel`, `#selected-x/y/z`, `#clear-selection` (Annotate mode only) | `selectedPoint` in `features/selection.js` | `selectionHighlight` mesh (Annotate mode only); panel via `updateSelectionPanel` |
| **Measurement A/B (shared)** | `features/measurement.js` + `features/frontSurfaceMeasurement.js` + `ui/measurementPanel.js` + `ui/grid2dNavigator.js` | `#measurement-panel` (left inspector); 2D Front Surface overlay | Shared `measurement` object + history in `measurement.js` | 3D markers/line/label + Front Surface 2D overlay; 2D lattice clicks write front-face 3D points; Body Landmark Measurement Picking v0 reuses same A/B + history |
| **3D→2D projection linking** | `features/projectionLinking.js` + `ui/grid2dNavigator.js` + `features/sceneGraphHighlight.js` | `#grid2d-markers`, `#grid2d-projection-tooltip`; View Controls Origin/Center + Annotations | Projected ref/annotation visibility flags | Origin/Center/annotation markers (A/B not projected); Inspect & Measure promoted `body_landmark` clicks advance shared A/B; annotation hover shows coords without duplicating equivalent projection rows |
| **Body Landmark Measurement Picking** | `interactions/picking.js` + `interactions/raycast.js` + `features/annotations.js` + `features/projectionLinking.js` + `features/frontSurfaceMeasurement.js` + `features/measurement.js` | Existing Distance Measurement panel + History (no new panel) | Reuses shared measurement state | Promoted `body_landmark` only; 3D + Front 2D; Annotate excluded |
| **2D marker relative sizing** | `ui/grid2dMarkerSizing.js` + `styles/overlays.css` | — | Step→base px lookup | CSS vars on lattice, measurement, and projected markers |
| **Measurement history** | `features/measurement.js` + `ui/measurementPanel.js` | History tab: `#history-panel`, `#history-empty`, `#history-list`, `#clear-history` | Shared `measurementHistory[]` | Sidebar list; Front Surface meta when applicable |
| **Origin / Center markers** | `metrology/referenceMarkers.js` + `interactions/hover.js` (hover wiring) + `ui/viewControls.js` | `#show-origin-center` in `#view-controls-panel` | `referenceMarkersVisible` in `metrology/referenceMarkers.js` | `referenceMarkers` groups (octahedron + hover-only CSS2D labels) |
| **Point annotations** | `features/annotations.js` + `ui/annotationControls.js` + `ui/annotationPanel.js` + `ui/viewControls.js` + `core/annotationTypes.js` + `core/landmarkDisplay.js` | `#annotation-type-select`, `#annotation-preset-select`, `#annotation-name-input`, `#add-annotation` (left, Annotate only); `#show-annotations` in `#view-controls-panel`; Annotations tab: `#annotations-panel`, `#annotations-empty`, `#annotation-list` (name + type labels) | `annotations[]` (`id`, `name`, `type`, `position`), `annotationIdCounter`, `annotationsGroup`, `annotationsVisible` in `features/annotations.js` | Per-annotation THREE.Group (purple box + CSS2D label; visual unchanged by type/preset); landmark presets help fill `name` but do not change coordinates; Body Evidence Promote uses `addAnnotationFromPoint` |
| **Scene Graph** | `ui/sceneGraphPanel.js` + `features/sceneGraphHighlight.js` | Graph tab: `#scene-graph-panel`, `#scene-graph-tree`, clickable `.scene-graph-row--clickable` rows (typed annotation nodes; Title Case display names) | Reads via `buildSceneState()`; highlight timer in `sceneGraphHighlight.js` | Read-only tree visualization with annotation type display; clickable rows call highlight helpers; compact rows; collapsed-by-default large groups; temporary markers/lines |
| **Scene Graph temporary highlighting** | `features/sceneGraphHighlight.js` | Clickable rows in `#scene-graph-panel` | `graphHighlightGroup`, auto-clear timer | Temporary markers and lines; visual-only graph-to-3D preview; does not mutate session data |
| **Scene State export** | `features/sceneExport.js` | Files tab: `#export-scene-json` (`#export-import-panel`) | Reads app mode, `measurement` object, **3D** measurement history, annotations (`name`, `type`, `position`; preset not exported); **no Body Evidence / no Body Graph field / no 2D UI-only fields** | — (downloadable JSON file with typed annotations, including promoted body landmarks) |
| **Scene State import** | `features/sceneImport.js` | Files tab: Load Scene JSON (`#load-scene-json`) and import error message (`#scene-import-status`) | Writes through module-owned restore functions in `measurement.js`, `annotations.js` (restores `name` and `type`; missing `type` → `custom`; preset state not restored), and `applyImportedMode()` in `appModeControls.js`; does not restore Body Evidence | Restored A/B markers, measurement line/label, annotation markers/labels with name/type; updates all tabs in background |
| **Session Data tabs** | `ui/sessionTabs.js` | `#session-tabs`, tab buttons, `#tab-panel-history`, `#tab-panel-annotations`, `#tab-panel-body`, `#tab-panel-graph`, `#tab-panel-files` | Active tab UI state only | — (switches visible right-sidebar panel without modifying scene/app state) |
| **View Controls** | `ui/viewControls.js` + `ui/bodyEvidencePanel.js` (Body Evidence Overlay + Secondary Body Candidates checkboxes) + reference/annotation/volume/measurement/projection/grid2d/bodyMeasurementPreview modules | `#view-controls-panel` grouped checkboxes (incl. `#show-secondary-body-candidates`, `#show-body-measurement-previews`) | Visibility flags in owning modules | Toggles Origin/Center (3D + projected 2D), annotations (3D + projected 2D), 3D lattice, 2D grid points, shared A/B measurement lines/labels, Body Evidence Overlay (primary/core), Secondary Body Candidates (unpromoted secondary only), Body Measurement Previews (Ready anatomical preview lines only; independent from A/B Measurement Lines) |
| **Body Evidence** | `features/bodyEvidence.js` + `features/bodyEvidenceAdapter.js` + `ui/bodyEvidencePanel.js` + `ui/bodyTabConsolidatedPanel.js` + `ui/bodyEvidenceOverlay2d.js` | Left `#body-evidence-panel` (Import / Actions / Summary / Primary Candidates / Secondary Candidates / Selected / Promote / Clear Selection); Body tab `#session-body-evidence-status` + `#promoted-body-anchors-panel` + `#body-measurement-readiness`; overlay `#grid2d-body-evidence-markers`; Evidence checkboxes `#show-body-evidence-overlay` + `#show-secondary-body-candidates` | Isolated sources + QA + fixed v0 scale + core-13 primary whitelist + Secondary Body Landmark Candidates v0 allowlist + primary/secondary visibility + inspect/select + promote guards + `buildBodyAnchorAudit` in `bodyEvidence.js` / adapter | Dedicated workflow; front core-13 primary overlay + secondary allowlist candidates; select/promote sync; manual Promote → normal `body_landmark` annotations; consolidated Body tab read-only Status counts / Advanced Details / Anchors / Readiness; unpromoted secondary does not affect readiness/preview/Scene State; Body Evidence itself not in Scene State; no Result/Scale JSON; no Body Graph / Review Status / side render / seg mask render / latent space |
| **Anatomical Measurement Lines** | `features/bodyMeasurementLines.js` + `ui/bodyTabConsolidatedPanel.js` | Body Measurement Readiness candidate rows in Body tab | `buildAnatomicalMeasurementLines` over `body_landmark` annotations only; Ready/Missing + Euclidean `distanceCm` | Read-only QA/readiness; distances display-only in Readiness (not saved/history/exported); compute does not own overlay rendering; not Body Graph / normal A/B / latent space |
| **Measurement Line Preview Overlay** | `features/bodyMeasurementPreview.js` + `ui/viewControls.js` + `ui/grid2dNavigator.js` | 3D preview group; Front `#grid2d-body-measurement-previews`; View Controls `#show-body-measurement-previews` (checked by default) | Ready geometry-only lines from `buildAnatomicalMeasurementLines`; `previewVisible` flag | Visual-only Ready lines in 3D and/or Front 2D; **separate from A/B measurement rendering**; no distance labels on lines (distances stay in Body Measurement Readiness); not history/annotations/export/Body Graph/latent space |
| **Measurement Reference Levels** | `features/bodyMeasurementLevels.js` | Internal compute; separate panel not shown by default after consolidation | `buildMeasurementReferenceLevels` over `body_landmark` annotations only; optional paired spans via `calculateDistance` | Read-only QA/organization helper; useful info folded into Body Measurement Readiness; spans display-only; not Body Graph / measurement generation / latent space |
| **Body Tab Consolidation** | `ui/bodyTabConsolidatedPanel.js` | `#body-evidence-status-panel`, `#promoted-body-anchors-panel`, `#body-measurement-readiness-panel` | Reuses QA + audit + lines compute; no schema change | UI/IA cleanup only; compact Status counts; Advanced Evidence Details collapsed by default with readable name lists |
| **Collapsible inspector sections** | `ui/collapsibleSections.js` | Left `#left-sidebar` sections/subgroups with `data-collapsible` (incl. Import Files / Actions) | CSS class `is-collapsed` only | UI-only; does not reset session/evidence data; not exported |
| **Workspace layout** | `ui/workspaceLayout.js` | `#workspace-tabs`, panes (3D / 2D / Body Graph), divider | `currentWorkspace`, `splitRatio` (~0.57), `dividerDragActive` | Layout only |
| **Body Graph Workspace** | `ui/bodyGraphWorkspace.js` | `#body-graph-workspace` | Rebuilds from `buildBodyGraph(getAnnotations())` | UI/read-only |
| **Body Graph Contract** | `features/bodyGraph.js` | Runtime only | Derived Core 13 topology; no persistence | Pure compute |
| **2D Grid Navigator** | `ui/grid2dNavigator.js` + `features/frontSurfaceMeasurement.js` + `features/projectionLinking.js` + `ui/bodyEvidenceOverlay2d.js` + `features/bodyMeasurementPreview.js` + `ui/grid2dMarkerSizing.js` | `#grid2d-*` Front Surface pane (no Top/Side, no duplicate clear/readout panel); incl. `#grid2d-body-measurement-previews` | Navigator UI-only state in `grid2dNavigator.js` | Front Surface grid, shared measurement overlay, projected Origin/Center/annotations, optional Body Evidence front overlay, optional Body Measurement Preview lines |
| **UI layout (REVacity)** | `index.html` + `styles/` (via `style.css` entry) | `#app-layout`, header, left Metrology Inspector, center workspace viewport, right Session Data, footer | — | — |
| **Orbit / camera** | `core/scene.js` (imported by `main.js`) | — | `controls`, `camera` | — |

---

## 8. Refactor Readiness Notes

**Staged refactor complete (Phases 0–9).** The 2D workspace and Grid Navigator were added afterward as a self-contained UI/workspace layer. The observations below describe the final modular layout. No further refactor is planned unless explicitly requested.

### Completed module splits (JavaScript)

| Module | Owns |
|--------|------|
| **`core/`** | Constants, annotation node types, landmark display naming, formatters, math, scene/camera/renderers/controls/resize |
| **`metrology/`** | Room shell, surface grid, internal lattice, LOD, axes, reference markers |
| **`interactions/`** | Raycasting, picking, pointer events, hover pipeline |
| **`features/`** | Selection, shared measurement, Front Surface measurement bridge, Front Surface projection linking, Body Evidence store/adapter (incl. manual Promote), Anatomical Measurement Lines compute, Measurement Line Preview Overlay, Measurement Reference Levels compute, annotations, app mode, Scene State export/import, Scene Graph highlighting, linked selection |
| **`ui/`** | DOM refs, panel updates, list rendering, hover tooltip, app mode controls, inspector workflow, annotation controls, View Controls (incl. Body Measurement Previews), Body Evidence panel/consolidated Body tab/overlay, Body Graph Workspace, collapsible sections, Scene Graph panel, Session Data tabs, Front Surface Grid Navigator, marker sizing, workspace layout |
| **`main.js`** | Thin orchestrator including Front Surface, Body Measurement Preview, Body Evidence, consolidated Body tab, Body Graph Workspace, workflow, and collapsible-section setup calls, animation loop |

### Completed CSS splits

| File | Owns |
|------|------|
| **`styles/variables.css`** | `:root` tokens, reset, base page background |
| **`styles/layout.css`** | `#app-layout`, grid, header, sidebars, viewport/workspace panes (incl. Body Graph), split divider, default ~57% 3D split sizing |
| **`styles/components.css`** | Inspector sections (subgroups, collapsible headers, Body Evidence workflow primary/secondary candidates + Body Tab Consolidation Status / Advanced Details / Promoted Body Anchors table / Body Measurement Readiness), stacked Distance Measurement point name/coords, workflow switch, View Controls, Session Data tabs, workspace tabs, Body Graph Workspace, history, annotations, Scene Graph, Export / Import, buttons |
| **`styles/overlays.css`** | Hover tooltip, status bar, CSS2D label classes, Front Surface Grid Navigator UI, shared measurement overlay, projected markers, Body Measurement Preview lines, Body Evidence overlay markers (primary + secondary; active = internal emphasis only), relative marker sizing CSS vars |
| **`style.css`** | `@import` entry chain only |

### Remaining intentional coupling

- **`pickVolumePoint`** — mode-aware click handler: Annotate → `selectPoint` only; Inspect & Measure → prefer promoted `body_landmark` then lattice → `advanceMeasurement` (`interactions/picking.js`).
- **`setupAppModeControls`** — mode toggle, panel visibility, status label/hint, workflow sync, mode-switch cleanup; **`applyImportedMode`** applies imported mode without cleanup (`ui/appModeControls.js`).
- **`setupInspectorWorkflow`** — Body Evidence inspector-only workflow visibility (`ui/inspectorWorkflow.js`).
- **`setupPointInteraction`** — central registry for all canvas and button events (`interactions/pointerEvents.js`).
- **CSS2D vs HTML overlay** — two label systems (CSS2DRenderer for 3D-anchored labels; HTML div for hover tooltip) with different positioning rules.

### What is working well today

- `src/core/` provides clean boundaries for pure constants, formatters, math, landmark display naming, and scene/rendering infrastructure (Phases 1, 3).
- `src/metrology/` isolates static scene geometry: room shell, lattice, axes, reference markers (Phase 4).
- `src/interactions/` isolates raycasting, picking, pointer events, and hover pipeline (Phases 5, 9).
- `src/features/selection.js` encapsulates selected point state and selection highlight (Phase 5).
- `src/features/measurement.js` encapsulates shared Point A/B measurement state, markers, line, floating label, clear/advance logic, and history (Body Landmark Measurement Picking reuses this path).
- `src/features/frontSurfaceMeasurement.js` bridges Front Surface 2D clicks (and shared 3D point advances such as body-landmark projected picks) onto that shared measurement (no separate 2D A/B state).
- `src/features/projectionLinking.js` owns Front Surface projection of Origin/Center/annotations; Inspect & Measure promoted `body_landmark` projected clicks advance shared A/B (annotation hover without duplicate projection coords).
- `src/ui/grid2dMarkerSizing.js` isolates proportional 2D marker emphasis from lattice step size.
- `src/ui/measurementPanel.js` isolates Distance Measurement panel updates and shared History list rendering (Front Surface meta when applicable; stacked body-landmark name + coords on active A/B display; UI-only layout).
- `src/ui/sceneGraphPanel.js` isolates Scene Graph visualization; obsolete 2D Workspace State card removed.
- `src/ui/viewControls.js` isolates View Controls checkbox wiring across 3D + projected 2D + shared measurement lines + Body Measurement Previews (Body Evidence Overlay + Secondary Body Candidates wired in `bodyEvidencePanel.js`).
- `src/features/bodyEvidence.js` + `bodyEvidenceAdapter.js` isolate Body Evidence as a separate evidence/QA layer (not Scene State); fixed v0 scale; core-13 primary whitelist + Secondary Body Landmark Candidates v0 allowlist; manual Promote (core or secondary) creates normal `body_landmark` annotations; `buildBodyAnchorAudit` is read-only annotation QA.
- `src/features/bodyMeasurementLevels.js` isolates Measurement Reference Levels v0 compute (optional paired spans; not saved/exported; separate panel not shown by default after consolidation).
- `src/features/bodyMeasurementLines.js` isolates Anatomical Measurement Lines v0 compute (Ready/Missing candidate distances; display-only in Readiness; not Body Graph / normal A/B / latent space).
- `src/features/bodyMeasurementPreview.js` isolates Measurement Line Preview Overlay v0 (visual-only Ready lines in 3D + Front 2D; separate from A/B measurement rendering; no distance labels on lines).
- `src/features/bodyGraph.js` isolates Body Graph Contract v0 (runtime Core 13 topology from promoted annotations; tested by `bodyGraph.test.js`).
- `src/ui/bodyEvidencePanel.js` + `bodyTabConsolidatedPanel.js` + `bodyEvidenceOverlay2d.js` isolate Body Evidence workflow UI (primary + secondary candidates), consolidated Body tab (Status counts + Advanced Details + Promoted Anchors + Readiness), and Front Surface overlay (core primary + secondary when visible; candidate/select sync; no A/B from evidence markers).
- `src/ui/bodyGraphWorkspace.js` isolates Body Graph Workspace v0 (dedicated read-only topology diagram).
- `src/ui/bodyEvidenceQaPanel.js`, `bodyMeasurementLevelsPanel.js`, and `bodyMeasurementLinesPanel.js` remain as intentionally retained historical stubs (not wired from `main.js`).
- `src/ui/inspectorWorkflow.js` isolates left inspector workflow switching.
- `src/ui/collapsibleSections.js` isolates left inspector collapse including Import Files / Actions subgroups (UI-only).
- **`src/ui/grid2dNavigator.js`** isolates the Front Surface Grid Navigator (10 cm base grid, simplified Split, shared measurement overlay, Body Measurement Preview 2D redraw).
- **`src/ui/workspaceLayout.js`** isolates workspace tab switching (3D Space / 2D Workspace / Body Graph) and split-pane layout.

---

*Last audited against the codebase and `CURSOR.md` behavioral contract after the accepted Body Graph Contract v0, Body Graph Workspace v0 (incl. visual polish), Secondary Body Landmark Candidates v0, Secondary Body Candidates visibility, Body Landmark Measurement Picking v0, Distance Measurement panel layout fix, Body tab Advanced Evidence Details cleanup, and related body-workflow cleanup (plus Measurement Line Preview Overlay v0, Anatomical Measurement Lines v0, Body Tab Consolidation v0, Body Evidence Import v0 fixed-scale, core-13 primary whitelist, Promoted Body Anchors Summary v0, Body Anchor Coordinate Audit v0, and Measurement Reference Levels v0). Top/Side 2D views and independent native 2D measurement remain removed. Result / Scale JSON is not imported. Side landmark rendering, Side Evidence v0, segmentation mask rendering, Review Status, and latent space are not implemented.*

# Project Structure — Latent Space / REVacity Metrology Space

This document describes the **current** file organization, module boundaries, and architectural responsibilities of the REVacity Metrology Space codebase. It serves as the authoritative source of truth for architecture and file ownership.

Behavioral details, interaction contracts, and current-state specifications are defined in `PROJECT_CONTEXT.md` as the authoritative behavioral and current-state source of truth. `REFACTOR_PLAN.md` is historical refactor documentation only.

---

## 1. Current File Tree

```
latent-space/
├── index.html                       # App shell, REVacity UI markup, script entry
├── package.json                     # Vite + Three.js dependencies and scripts
├── package-lock.json                # Locked dependency versions
├── PROJECT_CONTEXT.md               # Behavioral and current-state source of truth for AI/dev sessions
├── PROJECT_STRUCTURE.md             # Architectural and file ownership source of truth (this file)
├── REFACTOR_PLAN.md                 # Historical refactor documentation only (reference/archive)
├── .gitignore                       # Ignores node_modules, dist, .DS_Store
├── src/
│   ├── main.js                      # Application entry; thin orchestrator
│   ├── style.css                    # Stylesheet entry point (@import chain)
│   ├── styles/
│   │   ├── variables.css            # Design tokens, color themes, resets
│   │   ├── layout.css               # CSS grid layout, workspace panes, split divider
│   │   ├── components.css           # Menus, sidebars, tabs, panels, cards, candidate lists, buttons
│   │   └── overlays.css             # 2D navigators, plot grids, markers, measurement overlays, tooltips
│   ├── core/
│   │   ├── constants.js             # Shared scale, grid, LOD, and tooltip constants
│   │   ├── frontSurface.js          # Front Surface depth + 2D↔3D mapping helpers
│   │   ├── annotationTypes.js       # Allowed annotation types, landmark presets, display labels
│   │   ├── landmarkDisplay.js       # Shared Title Case landmark / annotation display-name helper
│   │   ├── formatters.js            # Coordinate, point, annotation, and distance formatting
│   │   ├── math.js                  # smoothstep and Euclidean distance helpers
│   │   └── scene.js                 # Three.js scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls
│   ├── features/
│   │   ├── annotations.js           # Annotation state, 3D visuals, CSS2D labels, promote path
│   │   ├── annotationValidation.js  # Validates annotation input before saving
│   │   ├── appMode.js               # App mode state (Inspect & Measure vs Annotate)
│   │   ├── bodyEvidence.js          # Body Evidence state store, analyze/clear, selection, manual promote
│   │   ├── bodyEvidenceAdapter.js   # Body Evidence parsing, normalization, QA classification, secondary allowlist
│   │   ├── bodyEvidenceAdapter.test.js # Body Evidence adapter unit tests
│   │   ├── bodyGraph.js             # Body Graph Contract v0 — deterministic Core 13 graph derivation
│   │   ├── bodyGraph.test.js        # Body Graph Contract v0 unit tests
│   │   ├── bodyMeasurementLevels.js # Measurement Reference Levels v0 compute
│   │   ├── bodyMeasurementLines.js  # Anatomical Measurement Lines v0 compute
│   │   ├── bodyMeasurementPreview.js # Measurement Line Preview Overlay v0 (3D + Front 2D preview lines)
│   │   ├── frontSurfaceMeasurement.js # Front Surface advance/read helpers over shared measurement
│   │   ├── linkedSelection.js       # Linked selection id for Scene Graph ↔ projected marker highlight sync
│   │   ├── measurement.js           # Canonical shared Point A/B measurement state, markers, line, history
│   │   ├── projectionLinking.js     # Read-only Front Surface projection of Origin/Center/annotations
│   │   ├── sceneExport.js           # Canonical Scene State JSON export build and download
│   │   ├── sceneGraphHighlight.js   # Temporary Scene Graph 3D highlight overlays
│   │   ├── sceneImport.js           # Canonical Scene State JSON import validation and restore
│   │   ├── selection.js             # Selected point state and highlight (Annotate mode)
│   │   ├── sideMeasurement.js       # Local Side Evidence A/B measurement state (U/Y Euclidean distance)
│   │   └── sideMeasurement.test.js  # Side measurement unit tests
│   ├── interactions/
│   │   ├── hover.js                 # Hover highlight and tooltip coordination
│   │   ├── picking.js               # Mode-aware click picking (promoted landmark priority, lattice, selection)
│   │   ├── pointerEvents.js         # Canvas pointer wiring and event orchestration
│   │   └── raycast.js               # Shared raycaster and volumetric point resolution
│   ├── metrology/
│   │   ├── axes.js                  # X/Y/Z axes and 20 cm tick labels
│   │   ├── referenceMarkers.js      # Origin and Center markers, hover labels
│   │   ├── roomShell.js             # Transparent room shell and 10 cm surface grid markers
│   │   └── volumeGrid.js            # 5 cm internal lattice, LOD layers, visibility controls
│   └── ui/
│       ├── annotationControls.js    # Landmark Preset dropdown wiring
│       ├── annotationPanel.js       # Annotation list DOM rendering
│       ├── annotationValidationMessage.js # Annotation validation feedback message helper
│       ├── appMenuBar.js            # Top application menu bar (File / View / Workflow dropdowns)
│       ├── appModeControls.js       # App mode switch UI and cleanup coordination
│       ├── bodyEvidenceCandidateList.js # Candidate list DOM rendering with Core / Secondary filters
│       ├── bodyEvidenceCandidateList.test.js # Candidate list rendering unit tests
│       ├── bodyEvidenceOverlay2d.js # Front Surface Body Evidence overlay markers and inspect selection
│       ├── bodyEvidenceOverlaySide2d.js # Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes)
│       ├── bodyEvidencePanel.js     # Body Evidence left workflow panel (Front / Side / Selection tabs)
│       ├── bodyEvidenceStatus.js    # Body Evidence status presentation helper
│       ├── bodyEvidenceStatus.test.js # Body Evidence status presentation tests
│       ├── bodyGraphWorkspace.js    # Body Graph Workspace v0 — Core 13 topological diagram
│       ├── bodyTabConsolidatedPanel.js # Session Data Body tab (Status / Promoted Anchors / Readiness)
│       ├── collapsibleSections.js   # Left Metrology Inspector collapsible section/subgroup headers
│       ├── domRefs.js               # Safe cached DOM element references
│       ├── grid2dMarkerSizing.js    # Relative 2D marker sizing helpers
│       ├── grid2dNavShared.js       # Shared 2D navigator geometry, zoom/pan transform, lattice utils
│       ├── grid2dNavigator.js       # Front Surface 2D Grid Navigator (X/Y coordinates)
│       ├── grid2dPlotArea.js        # Shared 2D plot frame, axes, and CSS variable styling
│       ├── hoverTooltip.js          # Screen-space hover coordinate tooltip
│       ├── inspectorWorkflow.js     # Metrology Inspector workflow panel visibility manager
│       ├── inspectorWorkflow.test.js # Inspector workflow unit tests
│       ├── inspectorWorkflowState.js # Metrology Inspector workflow state store and menu sync
│       ├── measurementContext.js    # Active measurement context helpers
│       ├── measurementContext.test.js # Measurement context unit tests
│       ├── measurementPanel.js      # Distance Measurement inspector (Front/Canonical and Side/U-Y subgroups)
│       ├── sceneGraphPanel.js       # Scene Graph tree DOM rendering
│       ├── selectionPanel.js        # Selected Point inspector panel helper
│       ├── sessionTabs.js           # Session Data tab manager (Hist / Annos / Body / Graph)
│       ├── sideEvidenceStatus.js    # Side Evidence status readout helper
│       ├── sideEvidenceStatus.test.js # Side Evidence status tests
│       ├── sideGrid2dNavigator.js   # Side Evidence 2D Grid Navigator (U/Y coordinates)
│       ├── viewControls.js          # View settings definitions, authoritative checked query, setting toggle
│       ├── viewControls.test.js     # View controls unit tests
│       └── workspaceLayout.js       # Workspace tab management (3D / 2D / Body Graph) and split divider
└── dist/                            # Vite production build output (generated)
```

---

## 2. Component Breakdown & Responsibilities

### Orchestration & Main Loop

| File | Responsibilities |
|------|------------------|
| `src/main.js` | Thin orchestrator. Imports core, features, interactions, metrology, and UI modules; assembles the Three.js scene graph; registers event listeners; and runs the `requestAnimationFrame` render loop (`animate()`). |

### Core Infrastructure (`src/core/`)

| File | Responsibilities |
|------|------------------|
| `constants.js` | Defines fundamental system constants: `ROOM_SIZE` (200 cm), `GRID_UNIT` (10 cm), `INTERNAL_STEP` (5 cm), `INTERNAL_COUNT` (41³ = 68,921), LOD distance thresholds, and tooltip offsets. |
| `frontSurface.js` | Fixed Front Surface depth (`FRONT_SURFACE_DEPTH_CM` = 200) and coordinate mapping helpers (`frontSurfaceTo3d`, `frontSurfaceFrom3d`, `isOnFrontSurface`). |
| `annotationTypes.js` | Allowed annotation node types (`custom`, `reference_point`, `body_landmark`, `garment_landmark`, `measurement_point`), landmark preset tables, and display labels. |
| `landmarkDisplay.js` | Shared formatting helper (`formatLandmarkDisplayName`) converting snake_case landmark keys to readable Title Case names. |
| `formatters.js` | Formatters for coordinate strings, points, annotations, and distances. |
| `math.js` | Math utility functions including `smoothstep` and Euclidean distance helpers. |
| `scene.js` | Initializes Three.js `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `CSS2DRenderer`, lights, and `OrbitControls`. Safe in Node test environments. |

### Domain Features & State (`src/features/`)

| File | Responsibilities |
|------|------------------|
| `appMode.js` | Manages app interaction mode (`MODE_INSPECT_MEASURE` vs `MODE_ANNOTATE`). |
| `selection.js` | Manages selected point state `{ x, y, z }` and selection highlight mesh in Annotate mode. Decoupled from direct DOM manipulation. |
| `measurement.js` | Manages canonical 3D/Front Point A/B measurement state, markers, line, CSS2D label, measurement history, and clear/advance operations. |
| `sideMeasurement.js` | Manages local Side Evidence A/B measurement state on the U/Y plane. Computes local Euclidean distance without mutating canonical measurement history or Scene State. |
| `frontSurfaceMeasurement.js` | Coordinates Front Surface 2D clicks with the canonical shared 3D measurement. |
| `annotations.js` | Annotation CRUD operations, 3D box marker and CSS2D label management, visibility toggles, and programmatic promotion path for body landmarks. |
| `annotationValidation.js` | Validates annotation input (point selection, non-empty name, duplicate detection). |
| `bodyEvidence.js` | State container for loaded Body Evidence sources, normalized candidates, analysis triggers, inspect selection, and manual promotion. |
| `bodyEvidenceAdapter.js` | Body-only parsing, normalization, and QA classification. Applies face/head rejection, core 13 primary whitelist, and secondary allowlist. Fixed 2000×2000 px / 10 px/cm scale. |
| `bodyGraph.js` | Body Graph Contract v0. Deterministic runtime topology derivation (`buildBodyGraph`) containing exactly 13 Core nodes and 13 structural edges from promoted Core 13 annotations. |
| `bodyMeasurementLevels.js` | Measurement Reference Levels v0 compute. |
| `bodyMeasurementLines.js` | Anatomical Measurement Lines v0 compute. |
| `bodyMeasurementPreview.js` | Measurement Line Preview Overlay v0 (draws visual-only Ready preview lines in 3D and Front 2D). |
| `projectionLinking.js` | Projects 3D Origin, Center, and annotation markers onto the Front 2D Grid Navigator. |
| `sceneExport.js` | Serializes session state into canonical Scene State JSON schema v1. Excludes raw Body Evidence, Side measurements, 2D refinement, and Body Graph. |
| `sceneImport.js` | Validates and restores Scene State JSON. Reconstructs annotations, measurement history, and active measurement. |
| `sceneGraphHighlight.js` | Manages temporary 3D mesh highlighting when tree nodes in the Scene Graph are clicked. |
| `linkedSelection.js` | Manages linked selection identifiers across UI views. |

### Metrology & Geometry (`src/metrology/`)

| File | Responsibilities |
|------|------------------|
| `roomShell.js` | Builds the transparent 200×200×200 cm room shell and 10 cm surface grid markers. |
| `volumeGrid.js` | Builds the 68,921-point volumetric lattice across 3 instanced LOD layers (Coarse, Medium, Fine) and updates LOD opacities per frame. |
| `axes.js` | Builds the X (red), Y (green), and Z (blue) axes with arrowheads and 20 cm tick labels. |
| `referenceMarkers.js` | Builds the Origin (0,0,0) and Center (100,100,100) octahedron markers and hover labels. |

### Interactions (`src/interactions/`)

| File | Responsibilities |
|------|------------------|
| `raycast.js` | Manages Three.js raycasting against LOD meshes, nearest-point fallback, and body landmark target resolution. |
| `picking.js` | Mode-aware picking logic: advances Point A/B measurement (with promoted landmark priority) in Inspect & Measure, selects points in Annotate. |
| `hover.js` | Coordinates temporary hover markers, hover previews (A/B preview colors), and hover tooltips. |
| `pointerEvents.js` | Attaches pointer event listeners to canvas and wires sidebar action buttons. |

### User Interface (`src/ui/`)

| File | Responsibilities |
|------|------------------|
| `appMenuBar.js` | Manages the top application menu bar (File, View, Workflow dropdowns) and connects file pickers, view toggles, and workflow selection. |
| `viewControls.js` | Defines the 11 view settings (`origin-center`, `annotations`, `measurement-lines`, `lattice-3d`, `front-grid`, `side-grid`, `front-core`, `front-secondary`, `side-core`, `side-secondary`, `body-previews`), queries authoritative state (`getViewSetting`), and executes toggles. |
| `inspectorWorkflow.js` | Controls left Metrology Inspector panel visibility based on active workflow (`measurement`, `annotation`, `body-evidence`). |
| `inspectorWorkflowState.js` | Authoritative state store and subscriber notification for active Metrology Inspector workflows; coordinates with App Menu Bar. |
| `workspaceLayout.js` | Manages workspace navigation tabs (3D Space, 2D Workspace, Body Graph), combined 3D+2D split view (36% 3D / 64% 2D default), and draggable split divider. |
| `grid2dNavigator.js` | Front Surface 2D Grid Navigator (0–200 cm X/Y), 10 cm base lattice, 5 cm regional refinement, shared measurement overlay, and projected markers. Manages active-only legend rendering. |
| `sideGrid2dNavigator.js` | Side Evidence 2D Grid Navigator (0–200 cm U/Y), 10 cm base lattice, 5 cm regional refinement, Side Core and Secondary markers (shared Core/Secondary colors; diamond/dot shapes), and local Side A/B measurement. Manages active-only legend rendering. |
| `grid2dNavShared.js` | Shared 2D navigator math, zoom/pan transforms, and lattice utilities. |
| `grid2dPlotArea.js` | Shared 2D plot frame, axis labels, and CSS variable management. |
| `grid2dMarkerSizing.js` | Computes zoom-dependent relative marker sizes for 2D navigators. |
| `bodyEvidencePanel.js` | Manages the left Body Evidence panel with Actions subgroup and Front / Side / Selection tabs. Handles candidate selection, inspect card, and Front promotion. |
| `bodyEvidenceCandidateList.js` | Renders candidate lists with Core / Secondary filters and unified color semantics (Gold for Core, Purple for Secondary). |
| `bodyEvidenceOverlay2d.js` | Renders Front Surface Body Evidence overlay markers and active selection highlight. |
| `bodyEvidenceOverlaySide2d.js` | Renders Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes). |
| `bodyGraphWorkspace.js` | Renders the read-only Core 13 Body Graph topology workspace and summary statistics. |
| `bodyTabConsolidatedPanel.js` | Renders the Session Data Body tab: Body Evidence Status counts, Promoted Body Anchors table, and Body Measurement Readiness audit. |
| `measurementPanel.js` | Renders the Distance Measurement inspector with independent collapsible Front / Canonical and Side / U-Y measurement subgroups. |
| `selectionPanel.js` | Updates coordinate readouts in the Selected Point inspector panel. |
| `annotationControls.js` | Wires Annotation Type and Landmark Preset dropdowns with auto-fill behavior. |
| `annotationPanel.js` | Renders the Annotation List in the Session Data Annos tab with per-item Delete buttons. |
| `annotationValidationMessage.js` | Displays and clears inline validation messages for annotation creation. |
| `sessionTabs.js` | Manages the 4 Session Data tabs (Hist, Annos, Body, Graph). |
| `sceneGraphPanel.js` | Renders the read-only Scene Graph tree in the Graph tab. |
| `collapsibleSections.js` | Handles collapsible section headers (`data-collapsible`) in the left inspector. |
| `domRefs.js` | Centralized, safe cached DOM element lookups. |
| `hoverTooltip.js` | Positions and updates the screen-space hover coordinate tooltip. |

---

## 3. Styling Architecture (`src/styles/`)

- `variables.css`: Design tokens, colors (dark cosmic theme, purple/cyan/amber accents), typography (Syne display, JetBrains Mono data), spacing, and resets.
- `layout.css`: Overall CSS grid layout (`#top-header`, `#left-sidebar`, `#viewport`, `#right-sidebar`, `#bottom-status-bar`), workspace panes, and split divider resizing.
- `components.css`: Component-level styles for menus, sidebars, tabs, panels, candidate lists, inspect cards, badges, and action buttons.
- `overlays.css`: Styles for 2D plot areas, lattices, markers, measurement overlays, legend items, and tooltips.
- `style.css`: Entry point combining the stylesheet modules via `@import`.

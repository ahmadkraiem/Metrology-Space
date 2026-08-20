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
├── METROLOGY_ROADMAP.md             # Active development roadmap and milestone planning
├── REFACTOR_PLAN.md                 # Historical refactor documentation only (reference/archive)
├── .gitignore                       # Ignores node_modules, dist, .DS_Store
├── src/
│   ├── main.js                      # Application entry; thin orchestrator (~118 lines)
│   ├── style.css                    # Stylesheet entry point (@import chain)
│   ├── styles/
│   │   ├── variables.css            # Design tokens, color themes, resets
│   │   ├── layout.css               # CSS grid layout, workspace panes, split divider
│   │   ├── components.css           # Menus, sidebars, tabs, panels, cards, candidate lists, buttons, QA cards
│   │   └── overlays.css             # 2D navigators, plot grids, markers, measurement overlays, tooltips
│   ├── core/
│   │   ├── constants.js             # Shared scale, grid, LOD, and tooltip constants
│   │   ├── frontSurface.js          # Front Surface depth + 2D↔3D mapping helpers
│   │   ├── annotationTypes.js       # Allowed annotation types, landmark presets, display labels
│   │   ├── landmarkDisplay.js       # Shared Title Case landmark / annotation display-name helper
│   │   ├── formatters.js            # Coordinate, point, annotation, and distance formatting
│   │   ├── math.js                  # smoothstep and Euclidean distance helpers
│   │   ├── pixelMetrologyMapping.js # Pixel-to-Metrology Mapping Core v0 — pure, resolution-independent 2D raster ↔ metrology mapping
│   │   ├── pixelMetrologyMapping.test.js # Pixel-to-Metrology Mapping Core v0 unit tests
│   │   └── scene.js                 # Three.js scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls
│   ├── features/
│   │   ├── anatomicalRegions.js     # Anatomical Region Contract v0 — deterministic 29-class observed region mapping with metric boundsCm
│   │   ├── anatomicalRegions.test.js # Anatomical Region Contract v0 unit tests
│   │   ├── annotations.js           # Annotation state, 3D visuals, CSS2D labels, promote path
│   │   ├── annotationValidation.js  # Validates annotation input before saving
│   │   ├── appMode.js               # App mode state (Inspect & Measure vs Annotate)
│   │   ├── bodyEvidence.js          # Body Evidence runtime store: active package, selections, change notifications, sanitized export
│   │   ├── bodyEvidenceAdapter.js   # Landmark classification (Core 13 / Secondary allowlist / face rejection) and segmentation normalization
│   │   ├── bodyEvidenceAdapter.test.js # Body Evidence adapter unit tests
│   │   ├── bodyEvidencePackage.js   # Full Body Evidence Package Contract v0 & Dense Layout / Pixel Index Contract v0
│   │   ├── bodyEvidencePackage.test.js # Body Evidence Package Contract & Dense Layout Contract unit tests
│   │   ├── bodyEvidenceZipAdapter.js # Body Evidence ZIP Import Adapter v0 — transport & file resolution only
│   │   ├── bodyEvidenceZipAdapter.test.js # Body Evidence ZIP Import Adapter unit tests
│   │   ├── bodyGraph.js             # Body Graph Contract v0 — deterministic Core 13 graph derivation
│   │   ├── bodyGraph.test.js        # Body Graph Contract v0 unit tests
│   │   ├── bodyMeasurementLevels.js # Measurement Reference Levels v0 compute
│   │   ├── bodyMeasurementLines.js  # Anatomical Measurement Lines v0 compute
│   │   ├── bodyMeasurementPreview.js # Measurement Line Preview Overlay v0 (3D + Front 2D preview lines)
│   │   ├── denseEvidenceQa.js       # Pointmap, Surface Normal, and Same-View Cross-Modal Dense Evidence QA Core v0
│   │   ├── denseEvidenceQa.test.js  # Dense Evidence QA Core and Runtime Integration unit tests
│   │   ├── frontSideAlignment.js    # Pure deterministic Front/Side semantic correspondence and vertical Y QA contract
│   │   ├── frontSideAlignment.test.js # Front-Side alignment contract unit tests
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
│       ├── bodyEvidencePackageQaUi.js # Body Evidence Package QA summary UI component (Session Data > Body tab)
│       ├── bodyEvidencePackageQaUi.test.js # Package QA summary UI unit tests
│       ├── bodyEvidencePanel.js     # Body Evidence left workflow panel (Front / Side / Selection tabs, segmentation class lists, promote)
│       ├── bodyEvidenceStatus.js    # Body Evidence status presentation helper
│       ├── bodyEvidenceStatus.test.js # Body Evidence status presentation tests
│       ├── bodyGraphWorkspace.js    # Body Graph Workspace v0 — Core 13 topological diagram
│       ├── bodyTabConsolidatedPanel.js # Session Data Body tab coordinator (Package QA / Status / Alignment QA / Promoted Anchors / Readiness)
│       ├── collapsibleSections.js   # Left Metrology Inspector collapsible section/subgroup headers
│       ├── domRefs.js               # Safe cached DOM element references
│       ├── frontSideAlignmentPanel.js # Front–Side Alignment QA presentation panel (summary card, collapsible groups, compact rows)
│       ├── frontSideAlignmentPanel.test.js # Front–Side Alignment QA presentation panel unit tests
│       ├── grid2dMarkerSizing.js    # Relative 2D marker sizing helpers
│       ├── grid2dNavShared.js       # Shared 2D navigator geometry, zoom/pan transform, lattice utils
│       ├── grid2dNavigator.js       # Front Surface 2D Grid Navigator (X/Y coordinates)
│       ├── grid2dPlotArea.js        # Shared 2D plot frame, axes, and CSS variable styling
│       ├── hoverTooltip.js          # Screen-space hover coordinate tooltip
│       ├── inspectorWorkflow.js     # Metrology Inspector workflow panel visibility manager
│       ├── inspectorWorkflow.test.js # Inspector workflow unit tests
│       ├── inspectorWorkflowState.js # Metrology Inspector workflow state store and menu sync
│       ├── measurementContext.test.js # Measurement context unit tests
│       ├── measurementPanel.js      # Distance Measurement inspector (Front/Canonical and Side/U-Y subgroups)
│       ├── sceneGraphPanel.js       # Scene Graph tree DOM rendering
│       ├── segmentationInspection.test.js # Segmentation inspection and QA UI unit tests
│       ├── segmentationOverlay2d.js # Translucent dense semantic segmentation overlay & highlight LUTs with isolated per-view caches
│       ├── segmentationOverlay2d.test.js # Segmentation overlay rendering, cache isolation, and LUT unit tests
│       ├── selectionPanel.js        # Selected Point inspector panel helper
│       ├── sessionTabs.js           # Session Data tab manager (Hist / Annos / Body / Graph)
│       ├── sideEvidenceStatus.js    # Side Evidence status readout helper
│       ├── sideEvidenceStatus.test.js # Side Evidence status tests
│       ├── sideGrid2dNavigator.js   # Side Evidence 2D Grid Navigator (U/Y coordinates)
│       ├── viewControls.js          # View settings definitions, authoritative checked query, setting toggle
│       ├── viewControls.test.js     # View controls unit tests
│       ├── workspaceLayout.js       # Workspace tab management (3D / 2D / Body Graph), split divider, right sidebar collapse
│       └── workspaceLayout.test.js  # Workspace layout and right sidebar collapse unit tests
└── dist/                            # Vite production build output (generated)
```

---

## 2. Component Breakdown & Responsibilities

### Orchestration & Main Loop

| File | Responsibilities |
|------|------------------|
| `src/main.js` | Thin app orchestrator (~118 lines in current implementation). Imports core, features, interactions, metrology, and UI modules; assembles the Three.js scene graph; registers top-level event listeners; and runs the `requestAnimationFrame` render loop (`animate()`). Contains zero ZIP transport or Body Evidence business logic. |

### Core Infrastructure (`src/core/`)

| File | Responsibilities |
|------|------------------|
| `constants.js` | Defines fundamental system constants: `ROOM_SIZE` (200 cm), `GRID_UNIT` (10 cm), `INTERNAL_STEP` (5 cm), `INTERNAL_COUNT` (41³ = 68,921), LOD distance thresholds, and tooltip offsets. |
| `frontSurface.js` | Fixed Front Surface depth (`FRONT_SURFACE_DEPTH_CM` = 200) and coordinate mapping helpers (`frontSurfaceTo3d`, `frontSurfaceFrom3d`, `isOnFrontSurface`). |
| `annotationTypes.js` | Allowed annotation node types (`custom`, `reference_point`, `body_landmark`, `garment_landmark`, `measurement_point`), landmark preset tables, and display labels. |
| `landmarkDisplay.js` | Shared formatting helper (`formatLandmarkDisplayName`) converting snake_case landmark keys to readable Title Case names. |
| `formatters.js` | Formatters for coordinate strings, points, annotations, and distances. |
| `math.js` | Math utility functions including `smoothstep` and Euclidean distance helpers. |
| `pixelMetrologyMapping.js` | Pixel-to-Metrology Mapping Core v0. Pure, resolution-independent conversion functions between 2D raster coordinates and metrology domain coordinates (pixel centers, continuous points, inclusive bounding box outer envelopes, and inverses). |
| `scene.js` | Initializes Three.js `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `CSS2DRenderer`, lights, and `OrbitControls`. Safe in Node test environments. |

### Domain Features & State (`src/features/`)

| File | Responsibilities |
|------|------------------|
| `bodyEvidencePackage.js` | **Full Body Evidence Package Contract v0 & Dense Layout / Pixel Index Contract v0.** Pure normalized multi-modal domain schema and QA contract across independent Front and Side views (`image`, `pose`, `segmentation`, `pointmap`, `normals`). Resolves dense layouts (`HWC_INTERLEAVED`, `CHW_PLANAR`, `UNKNOWN`), preserves `declaredShape`, provides layout-aware indexing (`getDenseVectorElementIndex`, `readDenseVector`), and enables lazy read-only buffer access (`getDenseData`). |
| `bodyEvidenceZipAdapter.js` | **Body Evidence ZIP Import Adapter v0.** Temporary transport and discovery adapter. Unzips archives, detects single-sample subdirectories, filters debug/preview artifacts, matches Front and Side modalities, and builds normalized packages. Zero UI or scene coupling. |
| `bodyEvidenceAdapter.js` | **Landmark & Segmentation Normalization.** Pure stateless algorithms for Core 13 / Secondary allowlist pose classification, face/head rejection, and 29-class segmentation decoding and validation. |
| `denseEvidenceQa.js` | **Dense Evidence QA Core v0.** Pure deterministic Pointmap Numeric QA (`pointmap-numeric-qa-v0`), Surface Normal Numeric QA (`normal-numeric-qa-v0`), and Same-View Cross-Modal Dense QA (`same-view-dense-cross-modal-qa-v0`). Evaluates finite/non-finite element/vector statistics, raw channel bounds, normal magnitudes, declared range violations, raster compatibility, addressability, and observational mask groups without buffer mutations. |
| `bodyEvidence.js` | **Body Evidence Runtime Store.** Retains active package, landmark/seg selections, derived `denseEvidenceQa` runtime state, async dense QA lifecycle integration with session race protection (`analyzeLoadedBodyEvidenceAsync`), subscriber notifications, and sanitized diagnostic export (`buildBodyEvidenceExport`). |
| `anatomicalRegions.js` | **Anatomical Region Contract v0.** Pure deterministic domain contract mapping normalized Front/Side segmentation `classes[]` into observed 29-class region records with metric `boundsCm` (`body_anatomical`, `clothing_apparel`, `face_head`, `accessory_other`, `context_background`). Owns authoritative `BODY_ANATOMICAL_CLASS_IDS` taxonomy. No DOM, Three.js, depth inference, or derived composites. |
| `appMode.js` | Manages app interaction mode (`MODE_INSPECT_MEASURE` vs `MODE_ANNOTATE`). |
| `selection.js` | Manages selected point state `{ x, y, z }` and selection highlight mesh in Annotate mode. Decoupled from direct DOM manipulation. |
| `measurement.js` | Manages canonical 3D/Front Point A/B measurement state, markers, line, CSS2D label, measurement history, and clear/advance operations. |
| `sideMeasurement.js` | Manages local Side Evidence A/B measurement state on the U/Y plane. Computes local Euclidean distance without mutating canonical measurement history or Scene State. |
| `frontSurfaceMeasurement.js` | Coordinates Front Surface 2D clicks with the canonical shared 3D measurement. |
| `annotations.js` | Annotation CRUD operations, 3D box marker and CSS2D label management, visibility toggles, and programmatic promotion path for body landmarks. |
| `annotationValidation.js` | Validates annotation input (point selection, non-empty name, duplicate detection). |
| `frontSideAlignment.js` | Pure deterministic Front/Side semantic correspondence and vertical Y QA contract (5.0 cm v0 QA threshold). No DOM, Three.js, global state, depth inference, or 3D reconstruction. |
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
| `appMenuBar.js` | Top application menu bar (File, View, Workflow dropdowns). Connects package import (`Upload Body Evidence Package…`), scene import/export, diagnostic export (`Download Body Evidence JSON`), view toggles, and workflow switches. |
| `viewControls.js` | Defines the 13 view settings, queries authoritative state (`getViewSetting`), and executes toggles. |
| `inspectorWorkflow.js` | Controls left Metrology Inspector panel visibility based on active workflow (`measurement`, `annotation`, `body-evidence`). |
| `inspectorWorkflowState.js` | Authoritative state store and subscriber notification for active Metrology Inspector workflows; coordinates with App Menu Bar. |
| `workspaceLayout.js` | Manages workspace navigation tabs (3D Space, 2D Workspace, Body Graph), combined 3D+2D split view (36% 3D / 64% 2D default), draggable split divider, and right Session Data sidebar collapse/expand layout state. |
| `grid2dNavigator.js` | Front Surface 2D Grid Navigator (0–200 cm X/Y), 10 cm base lattice, 5 cm regional refinement, shared measurement overlay, projected markers, and Front segmentation overlay. Manages active-only legend rendering. |
| `sideGrid2dNavigator.js` | Side Evidence 2D Grid Navigator (0–200 cm U/Y), 10 cm base lattice, 5 cm regional refinement, Side Core and Secondary markers, local Side A/B measurement, and Side segmentation overlay. Manages active-only legend rendering. |
| `grid2dNavShared.js` | Shared 2D navigator math, zoom/pan transforms, and lattice utilities. |
| `grid2dPlotArea.js` | Shared 2D plot frame, axis labels, and CSS variable management. |
| `grid2dMarkerSizing.js` | Computes zoom-dependent relative marker sizes for 2D navigators. |
| `bodyEvidencePackageQaUi.js` | **Package QA Summary UI Component.** Renders read-only package QA status card in Session Data → Body tab, showing overall status, Front/Side modality status pills, raster compatibility, and deferred geometry semantics flags (`UNVALIDATED`). |
| `bodyEvidencePanel.js` | Left Body Evidence workflow panel (Front / Side / Selection tabs). Manages candidate list filtering, segmentation class list filtering, inspect cards, and Front candidate promotion. Analysis runs automatically upon package upload. |
| `bodyEvidenceCandidateList.js` | Renders candidate lists with Core / Secondary filters and unified color semantics (Gold for Core, Purple for Secondary). |
| `bodyEvidenceOverlay2d.js` | Renders Front Surface Body Evidence overlay markers and active selection highlight. |
| `bodyEvidenceOverlaySide2d.js` | Renders Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes). |
| `segmentationOverlay2d.js` | Renders read-only, translucent dense semantic segmentation overlays onto Front and Side 2D navigators using shared internal helpers, isolated per-view caches (`viewState.front`, `viewState.side`), and $O(1)$ visibility toggles. |
| `frontSideAlignmentPanel.js` | Read-only Session Data → Body presentation for the current alignment report. Derives alignment report on demand from normalized Body Evidence runtime state; renders top summary card and collapsible Core Pairs, Secondary Pairs, and Issues groups with compact 2-line audit rows. |
| `bodyGraphWorkspace.js` | Renders the read-only Core 13 Body Graph topology workspace and summary statistics. |
| `bodyTabConsolidatedPanel.js` | Coordinates rendering of Session Data Body tab sections: Package QA Summary card, Body Evidence Status counts, Front–Side Alignment QA, Promoted Body Anchors table, and Body Measurement Readiness audit. |
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

- `variables.css`: Design tokens, colors (dark cosmic theme, purple/cyan/amber accents), typography (Syne display, JetBrains Mono data), sidebar widths (left, right, right collapsed), spacing, and resets.
- `layout.css`: Overall CSS grid layout (`#top-header`, `#left-sidebar`, `#viewport`, `#right-sidebar`, `#bottom-status-bar`), right sidebar collapse layout, workspace panes, and split divider resizing.
- `components.css`: Component-level styles for menus, sidebars, sidebar toggle button, tabs, panels, candidate lists, inspect cards, badges, action buttons, Front–Side Alignment QA summary cards, and Session Data Package QA cards (`.body-evidence-package-qa-card`, `.body-package-qa-*`, `.body-evidence-qa-pill*`).
- `overlays.css`: Styles for 2D plot areas, lattices, markers, measurement overlays, legend items, and tooltips.
- `style.css`: Entry point combining the stylesheet modules via `@import`.

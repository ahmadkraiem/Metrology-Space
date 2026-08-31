# Project Structure — TWENTY EIGHT

This document describes the **current** file organization, module boundaries, and architectural responsibilities of the TWENTY EIGHT codebase. It serves as the authoritative source of truth for architecture and file ownership.

Behavioral details, interaction contracts, and current-state specifications are defined in `PROJECT_CONTEXT.md` as the authoritative behavioral and current-state source of truth. `REFACTOR_PLAN.md` is historical refactor documentation only.

---

## 1. Current File Tree

```
latent-space/
├── index.html                       # App shell, TWENTY EIGHT UI markup, script entry
├── package.json                     # Vite + Three.js dependencies and scripts
├── package-lock.json                # Locked dependency versions
├── PROJECT_CONTEXT.md               # Behavioral and current-state source of truth for AI/dev sessions
├── PROJECT_STRUCTURE.md             # Architectural and file ownership source of truth (this file)
├── METROLOGY_ROADMAP.md             # Active development roadmap and milestone planning
├── REFACTOR_PLAN.md                 # Historical refactor documentation only (reference/archive)
├── .gitignore                       # Ignores node_modules, dist, .DS_Store
├── src/
│   ├── main.js                      # Application entry; thin orchestrator (~122 lines)
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
│   │   ├── pixelMetrologyMapping.js # Pixel-to-Metrology Mapping Core v0 — pure, resolution-independent 2D raster ↔ metrology mapping (points, bounding boxes, row mapping, horizontal spans)
│   │   ├── pixelMetrologyMapping.test.js # Pixel-to-Metrology Mapping Core v0 unit tests
│   │   └── scene.js                 # Three.js scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls
│   ├── features/
│   │   ├── abdominalApexPlaneLocalization.js # Abdominal Apex Plane Localization Contract v0 [LEGACY — RETAINED FOR REGRESSION PROTECTION]
│   │   ├── abdominalApexPlaneLocalization.test.js # Abdominal Apex Plane Localization unit tests
│   │   ├── abdominalPointPlaneLocalization.js # Abdominal Point Plane Localization Contract v1 [ACTIVE PRODUCTION] — raw Side contour anterior abdominal extrema localization
│   │   ├── abdominalPointPlaneLocalization.test.js # Abdominal Point Plane Localization unit tests
│   │   ├── anatomicalLevels.js      # Anatomical Level Contract v0 — pure derivation of 7 reference Y levels (neck, shoulder, elbow, wrist, hip, knee, ankle)
│   │   ├── anatomicalLevels.test.js # Anatomical Level Contract v0 unit tests
│   │   ├── anatomicalRegionEvidence.js # Anatomical Region Evidence Association Contract v0 — 13 canonical region nodes, metric bounds, dense QA qualifications, and landmark/level topological adjacency
│   │   ├── anatomicalRegionEvidence.test.js # Anatomical Region Evidence Association Contract v0 unit tests
│   │   ├── anatomicalRegions.js     # Anatomical Region Contract v0 — deterministic 29-class observed region mapping with metric boundsCm, canonical laterality, and authoritative BODY_ANATOMICAL_CLASS_IDS
│   │   ├── anatomicalRegions.test.js # Anatomical Region Contract v0 unit tests
│   │   ├── annotations.js           # Annotation state, 3D visuals, CSS2D labels, promote path
│   │   ├── annotationValidation.js  # Validates annotation input before saving
│   │   ├── appMode.js               # App mode state (Inspect & Measure vs Annotate)
│   │   ├── arbitraryYSidePhysicalDepthQualification.js # Arbitrary-Y Side Physical Depth Qualification Contract v0 — qualifies Side AP depth across arbitrary pelvic Y levels
│   │   ├── arbitraryYSidePhysicalDepthQualification.test.js # Arbitrary-Y Side Physical Depth Qualification unit tests
│   │   ├── authoritativePhysicalEvidenceSemantics.js # Authoritative Physical Evidence Semantics Contract v0 — classifies dense pointmap evidence by authority without creating measurements
│   │   ├── authoritativePhysicalEvidenceSemantics.test.js # Authoritative Physical Evidence Semantics Contract v0 unit tests
│   │   ├── batchPromoteLandmarks.test.js # Batch landmark promotion unit tests
│   │   ├── bodyEvidence.js          # Body Evidence runtime store: active package, selections, change notifications, anatomical region evidence & transverse width getters, 4.5G authoritative physical evidence getters, direct body measurements getters, modeled circumference getters (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat), sanitized export, batch landmark promotion
│   │   ├── bodyEvidenceAdapter.js   # Landmark classification (Core 13 / Secondary allowlist / face rejection) and segmentation normalization
│   │   ├── bodyEvidenceAdapter.test.js # Body Evidence adapter unit tests
│   │   ├── bodyEvidencePackage.js   # Full Body Evidence Package Contract v0 & Dense Layout / Pixel Index Contract v0
│   │   ├── bodyEvidencePackage.test.js # Body Evidence Package Contract & Dense Layout Contract unit tests
│   │   ├── bodyEvidenceZipAdapter.js # Body Evidence ZIP Import Adapter v0 — transport & file resolution only
│   │   ├── bodyEvidenceZipAdapter.test.js # Body Evidence ZIP Import Adapter unit tests
│   │   ├── bodyGraph.js             # Body Graph Contract v0 — deterministic Core 13 graph derivation
│   │   ├── bodyGraph.test.js        # Body Graph Contract v0 unit tests
│   │   ├── bodyMeasurementLevels.js # Measurement Reference Levels v0 compute (orphaned / internal helper)
│   │   ├── bodyMeasurementLines.js  # Anatomical Measurement Lines v0 compute (candidate readiness lines)
│   │   ├── bodyMeasurementPreview.js # Measurement Line Preview Overlay v0 (3D + Front 2D preview lines)
│   │   ├── bustApexPlaneLocalization.js # Bust Apex Plane Localization Contract v0 [LEGACY — RETAINED FOR REGRESSION PROTECTION]
│   │   ├── bustApexPlaneLocalization.test.js # Bust Apex Plane Localization unit tests
│   │   ├── bustPointPlaneLocalization.js # Bust Point Plane Localization Contract v1 [ACTIVE PRODUCTION] — raw Side contour anterior breast extrema localization
│   │   ├── bustPointPlaneLocalization.test.js # Bust Point Plane Localization unit tests
│   │   ├── buttockPointPlaneLocalization.js # Buttock Point Plane Localization Contract v1 [ACTIVE PRODUCTION] — raw Side contour posterior buttock extrema localization
│   │   ├── buttockPointPlaneLocalization.test.js # Buttock Point Plane Localization unit tests
│   │   ├── clothingBodySurfaceSemantics.js # Clothing / Body-Surface Semantics Contract v0
│   │   ├── clothingBodySurfaceSemantics.test.js # Clothing / Body-Surface Semantics unit tests
│   │   ├── crossSectionEvidence.js  # Cross-Section Evidence Contract v0 — pure deterministic compositional layer pairing qualified Front transverse width and Side AP depth at validated reference levels (shoulder, hip)
│   │   ├── crossSectionEvidence.test.js # Cross-Section Evidence Contract v0 unit tests
│   │   ├── crossViewComparabilityQa.js # Cross-view Comparability QA Contract v0 — pure deterministic comparability QA over established 4.5A correspondence evidence across 10 inspectable checks
│   │   ├── crossViewComparabilityQa.test.js # Cross-view Comparability QA Contract v0 unit tests
│   │   ├── crossViewMeasurementCorrespondence.js # Cross-view Measurement Correspondence Contract v0 — pure deterministic correspondence pairing Front transverse width and Side profile span observations at matching anatomical source levels
│   │   ├── crossViewMeasurementCorrespondence.test.js # Cross-view Measurement Correspondence Contract v0 unit tests
│   │   ├── denseEvidenceQa.js       # Pointmap, Surface Normal, and Same-View Cross-Modal Dense Evidence QA Core v0
│   │   ├── denseEvidenceQa.test.js  # Dense Evidence QA Core and Runtime Integration unit tests
│   │   ├── directBodyMeasurements.js # Direct Body Measurements Contract v0 — pure deterministic derivation of 25 direct Batch A & Batch B body measurements across Vertical Inter-Level, Projected Landmark Segments, Kinematic Chains, and Bilateral Transverse Landmark Spans
│   │   ├── directBodyMeasurements.test.js # Direct Body Measurements Contract v0 unit tests
│   │   ├── frontRasterSlice.js      # Front Horizontal Raster Slice Contract v0 — pure single-row O(W) streaming scan returning contiguous horizontal runs
│   │   ├── frontRasterSlice.test.js # Front Horizontal Raster Slice Contract v0 unit tests
│   │   ├── frontSideAlignment.js    # Pure deterministic Front/Side semantic correspondence and vertical Y QA contract
│   │   ├── frontSideAlignment.test.js # Front-Side alignment contract unit tests
│   │   ├── frontSurfaceMeasurement.js # Front Surface advance/read helpers over shared measurement
│   │   ├── frontTransverseWidth.js  # Front Transverse Width Interpretation Contract v0 — pure interpretation of raster slice evidence into formal transverse widths at neck, shoulder, and hip levels under measurement support policies and single_run_required policy
│   │   ├── frontTransverseWidth.test.js # Front Transverse Width Interpretation Contract v0 unit tests
│   │   ├── linkedSelection.js       # Linked selection ID manager
│   │   ├── maximumSeatPlaneLocalization.js # Maximum Seat Plane Localization Contract v0 [ACTIVE PRODUCTION] — ranks pelvic scan candidate planes by Ramanujan II perimeter to localize Maximum Seat Plane
│   │   ├── maximumSeatPlaneLocalization.test.js # Maximum Seat Plane Localization unit tests
│   │   ├── measurement.js           # Canonical shared Point A/B measurement state, markers, line, history
│   │   ├── measurementSupportPolicy.js # Measurement Support Policy Contract v0 — pure deterministic definitions of observed supported silhouettes (neck_core_support_v0, trunk_core_support_v0, pelvic_core_support_v0, trunk_pelvic_transition_support_v0)
│   │   ├── measurementSupportPolicy.test.js # Measurement Support Policy Contract v0 unit tests
│   │   ├── measurementVisualizationProvenance.js # Measurement Visualization Provenance Contract v0 — pure declarative normalizer converting domain measurement, plane localization, and bilateral transverse span records into 2D visualization instructions
│   │   ├── measurementVisualizationProvenance.test.js # Measurement Visualization Provenance unit tests
│   │   ├── metricCalibrationProvenance.js # Metric Calibration Provenance Contract v0 — pure deterministic validator of upstream metric calibration claims across Front and Side views
│   │   ├── metricCalibrationProvenance.test.js # Metric Calibration Provenance Contract v0 unit tests
│   │   ├── modeledAbdominalCircumference.js # Modeled Abdominal Circumference Contract v0 [ACTIVE PRODUCTION] — pure deterministic ellipse-modeled Abdominal circumference estimate at localized Abdominal Point Plane using Ramanujan II with transition support
│   │   ├── modeledAbdominalCircumference.test.js # Modeled Abdominal Circumference unit tests
│   │   ├── modeledBustCircumference.js # Modeled Bust Circumference Contract v0 [ACTIVE PRODUCTION] — pure deterministic ellipse-modeled Bust circumference estimate at localized Bust Point Plane using Ramanujan II
│   │   ├── modeledBustCircumference.test.js # Modeled Bust Circumference unit tests
│   │   ├── modeledCrossSectionPerimeter.js # Modeled Cross-Section Perimeter Infrastructure [ACTIVE PRODUCTION INFRASTRUCTURE] — shared computeRamanujanEllipsePerimeter calculation engine and Hip Landmark Level modeled perimeter evaluator
│   │   ├── modeledCrossSectionPerimeter.test.js # Modeled Cross-Section Perimeter unit tests
│   │   ├── modeledHipGirth.js       # Modeled Hip Girth Contract v1 [ACTIVE PRODUCTION] — pure deterministic ellipse-modeled Hip Girth estimate at localized Buttock Point Plane using Ramanujan II
│   │   ├── modeledHipGirth.test.js  # Modeled Hip Girth unit tests
│   │   ├── modeledHipSeatCircumference.js # Modeled Maximum Seat Circumference Contract v0 [ACTIVE PRODUCTION] — pure deterministic domain derivation of modeled circumference estimate at localized Maximum Seat Plane using Ramanujan II
│   │   ├── modeledHipSeatCircumference.test.js # Modeled Maximum Seat Circumference unit tests
│   │   ├── modeledNaturalWaistCircumference.js # Modeled Natural Waist Circumference Contract v0 [ACTIVE PRODUCTION] — pure deterministic domain derivation of ellipse-modeled Natural Waist circumference estimate at localized Natural Waist Plane using Ramanujan II with strict Front-only gate
│   │   ├── modeledNaturalWaistCircumference.test.js # Modeled Natural Waist Circumference unit tests
│   │   ├── naturalWaistPlaneLocalization.js # Natural Waist Plane Localization Contract v0 [ACTIVE PRODUCTION] — pure deterministic evidence-driven waist plane localization using metric smoothing window = 2.0 cm, bilateral contour QA, broad trough pooling, and hierarchical tie-breaking
│   │   ├── naturalWaistPlaneLocalization.test.js # Natural Waist Plane Localization unit tests
│   │   ├── pelvicArbitraryYEvidenceScan.js # Pelvic Arbitrary-Y Evidence Scan Contract v0 — pure deterministic scanner extracting continuous Front transverse width evidence across pelvic region
│   │   ├── pelvicArbitraryYEvidenceScan.test.js # Pelvic Arbitrary-Y Evidence Scan unit tests
│   │   ├── physicalMeasurementEligibility.js # Physical Measurement Eligibility Contract v0 — authoritative downstream eligibility gate
│   │   ├── physicalMeasurementEligibility.test.js # Physical Measurement Eligibility Contract v0 unit tests
│   │   ├── physicalMeasurementSemantics.js # Physical Measurement Semantics Contract v0 — classifies measurements into workspace, metric projected, and physical tiers
│   │   ├── physicalMeasurementSemantics.test.js # Physical Measurement Semantics Contract v0 unit tests
│   │   ├── projectionLinking.js     # Read-only Front Surface projection of Origin/Center/annotations
│   │   ├── sceneExport.js           # Canonical Scene State JSON export build and download
│   │   ├── sceneGraphHighlight.js   # Temporary Scene Graph 3D highlight overlays
│   │   ├── sceneImport.js           # Canonical Scene State JSON import validation and restore
│   │   ├── sideAnteriorPosteriorOrientation.js # Side Anterior / Posterior Orientation Semantics Contract v0 — pure deterministic domain contract determining anatomical anterior/posterior along Side-U
│   │   ├── sideAnteriorPosteriorOrientation.test.js # Side Anterior / Posterior Orientation Semantics unit tests
│   │   ├── sideMeasurement.js       # Local Side Evidence A/B measurement state (U/Y Euclidean distance)
│   │   ├── sideMeasurement.test.js  # Side measurement unit tests
│   │   ├── sidePhysicalDepthQualification.js # Side Physical Depth Qualification Contract v0 — decides when Side profile span qualifies as physical AP depth estimate
│   │   ├── sidePhysicalDepthQualification.test.js # Side Physical Depth Qualification Contract v0 unit tests
│   │   ├── sidePoseQualification.js # Side T-Pose Qualification Contract v0 — evaluates Side arm reach, alignment, and 2D projected elbow deviation
│   │   ├── sidePoseQualification.test.js # Side T-Pose Qualification Contract v0 unit tests
│   │   ├── sideProfileSpan.js       # Side Profile Span Interpretation Contract v0 — pure interpretation of Side raster slice evidence into formal profile spans under measurement support policies and single_run_required policy
│   │   ├── sideProfileSpan.test.js  # Side Profile Span Interpretation Contract v0 unit tests
│   │   ├── sideRasterSlice.js       # Side Horizontal Raster Slice Contract v0 — pure single-row O(W) streaming scan returning contiguous horizontal runs with encountered class tracking
│   │   ├── sideRasterSlice.test.js  # Side Horizontal Raster Slice Contract v0 unit tests
│   │   ├── sideViewOrientationQualification.js # Approximately-Lateral Side View Qualification Contract v0 — evaluates bilateral collapse consensus across stable pairs
│   │   ├── sideViewOrientationQualification.test.js # Approximately-Lateral Side View Qualification Contract v0 unit tests
│   │   ├── torsoArbitraryYEvidenceScan.js # Torso Arbitrary-Y Evidence Scan Contract v0 — pure deterministic continuous row scanner across torso region segmentation under resolution-independent mapping
│   │   ├── torsoArbitraryYEvidenceScan.test.js # Torso Arbitrary-Y Evidence Scan Contract v0 unit tests
│   │   ├── viewPoseSemantics.js     # View / Pose Semantics Contract v0 — validates view identity, structural pose, and orientation
│   │   └── viewPoseSemantics.test.js # View / Pose Semantics unit tests
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
│       ├── advancedQaPanel.js       # Diagnostics Why Blocked + Advanced QA (intake / calibration)
│       ├── advancedQaPanel.test.js  # Advanced QA / Diagnostics accordion tests
│       ├── annotationControls.js    # Landmark Preset dropdown wiring
│       ├── annotationPanel.js       # Annotation list DOM rendering
│       ├── annotationValidationMessage.js # Annotation validation feedback message helper
│       ├── appMenuBar.js            # Top application menu bar (File / View / Workflow dropdowns)
│       ├── appModeControls.js       # App mode switch UI and cleanup coordination
│       ├── badgeUi.js               # Shared HTML escape + badge helpers
│       ├── badgeUi.test.js          # Badge helper unit tests
│       ├── bodyEvidenceCandidateList.js # Candidate list DOM rendering with Core / Secondary filters
│       ├── bodyEvidenceCandidateList.test.js # Candidate list rendering unit tests
│       ├── bodyEvidenceOverlay2d.js # Front Surface Body Evidence overlay markers and inspect selection
│       ├── bodyEvidenceOverlaySide2d.js # Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes)
│       ├── bodyEvidencePackageQaUi.js # Reusable Package QA HTML helper (not currently mounted)
│       ├── bodyEvidencePackageQaUi.test.js # Package QA summary UI unit tests
│       ├── bodyEvidencePanel.js     # Body Evidence left workflow panel (Front / Side / Landmark tabs, promote, Promote All Front Core)
│       ├── bodyGraphWorkspace.js    # Body Graph Workspace v0 — Core 13 topological diagram
│       ├── bodyTabConsolidatedPanel.js # Diagnostics: Front–Side Alignment + Body / Anchor readiness
│       ├── collapsibleSections.js   # Shared [data-collapsible] accordion wiring (left + right)
│       ├── derivedMeasurementDeck.js # Right Sidebar Results cards (Cross-Section Evidence, Modeled Circumferences [Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat], and Direct Measurements with Bilateral Spans & Breadths subgroup) with click-to-highlight integration
│       ├── derivedMeasurementDeck.test.js # Results deck tests
│       ├── domRefs.js               # Safe cached DOM element references
│       ├── finalAccessibilityVisualPolish.test.js # Accessibility & visual polish tests
│       ├── frontSideAlignmentPanel.js # Front–Side Alignment QA presentation panel (summary card, collapsible groups, compact rows)
│       ├── frontSideAlignmentPanel.test.js # Front–Side Alignment QA presentation panel unit tests
│       ├── grid2dMarkerSizing.js    # Relative 2D marker sizing helpers
│       ├── grid2dNavShared.js       # Shared 2D navigator geometry, zoom/pan transform, lattice utils
│       ├── grid2dNavigator.js       # Front Surface 2D Grid Navigator (X/Y coordinates)
│       ├── grid2dNavigatorChrome.test.js # Navigator UI chrome tests
│       ├── grid2dPlotArea.js        # Shared 2D plot frame, axes, and CSS variable styling
│       ├── grid2dRefinementPolish.test.js # 2D navigator refinement polish tests
│       ├── hoverTooltip.js          # Screen-space hover coordinate tooltip
│       ├── inspectorWorkflow.js     # Metrology Inspector workflow panel visibility manager
│       ├── inspectorWorkflow.test.js # Inspector workflow unit tests
│       ├── inspectorWorkflowState.js # Metrology Inspector workflow state store and menu sync
│       ├── leftPanel.js             # Anatomical Levels card
│       ├── leftPanel.test.js        # Anatomical Levels + removed Subject card regression
│       ├── measurementContext.test.js # Measurement context unit tests
│       ├── measurementHighlightOverlay2d.js # 2D Measurement Highlight Overlay renderer (guides, lines, dots, bilateral transverse spans with asymmetry drop lines)
│       ├── measurementHighlightOverlay2d.test.js # 2D Measurement Highlight Overlay unit tests
│       ├── measurementPanel.js      # Distance Measurement inspector + Session Records History
│       ├── measurementSemantics.test.js # Dense QA terminology via Package QA helper
│       ├── modeledEllipseCrossSectionPreview.js # Modeled Ellipse Cross-Section Preview SVG renderer (for all 5 modeled perimeters)
│       ├── modeledEllipseCrossSectionPreview.test.js # Modeled Ellipse Cross-Section Preview unit tests
│       ├── responsiveLayoutPolish.test.js # Responsive layout polish tests
│       ├── resultsCardClickHighlight.test.js # Results card click-to-highlight unit tests
│       ├── rightSidebarStage2.test.js # Results / Session Records / Diagnostics architecture tests
│       ├── sceneGraphPanel.js       # Diagnostics Origin / Center projection utility
│       ├── segmentationInspection.test.js # Segmentation inspection and QA UI unit tests
│       ├── segmentationOverlay2d.js # Translucent dense semantic segmentation overlay & highlight LUTs with isolated per-view caches
│       ├── segmentationOverlay2d.test.js # Segmentation overlay rendering, cache isolation, and LUT unit tests
│       ├── selectionPanel.js        # Selected Point coordinate readouts inside the Annotation panel
│       ├── sideGrid2dNavigator.js   # Side Evidence 2D Grid Navigator (U/Y coordinates)
│       ├── viewControls.js          # View settings definitions, authoritative checked query, setting toggle
│       ├── viewControls.test.js     # View controls unit tests
│       ├── workflowDrivenLeftSidebar.test.js # Left workflow composition tests
│       ├── workspaceLayout.js       # Workspace tabs (3D / 2D / Body Graph), split divider, right sidebar collapse
│       └── workspaceLayout.test.js  # Workspace layout and right sidebar collapse unit tests
└── dist/                            # Vite production build output (generated)
```

---

## 2. Component Breakdown & Responsibilities

### Orchestration & Main Loop

| File | Responsibilities |
|------|------------------|
| `src/main.js` | Thin app orchestrator (~122 lines). Imports core, features, interactions, metrology, and UI modules; assembles the Three.js scene graph; registers top-level event listeners; and runs the `requestAnimationFrame` render loop (`animate()`). Contains zero ZIP transport or Body Evidence business logic. |

### Core Infrastructure (`src/core/`)

| File | Responsibilities |
|------|------------------|
| `constants.js` | Defines fundamental system constants: `ROOM_SIZE` (200 cm), `GRID_UNIT` (10 cm), `INTERNAL_STEP` (5 cm), `INTERNAL_COUNT` (41³ = 68,921), LOD distance thresholds, and tooltip offsets. |
| `frontSurface.js` | Fixed Front Surface depth (`FRONT_SURFACE_DEPTH_CM` = 200) and coordinate mapping helpers (`frontSurfaceTo3d`, `frontSurfaceFrom3d`, `isOnFrontSurface`). |
| `annotationTypes.js` | Allowed annotation node types (`custom`, `reference_point`, `body_landmark`, `garment_landmark`, `measurement_point`), landmark preset tables, and display labels. |
| `landmarkDisplay.js` | Shared formatting helper (`formatLandmarkDisplayName`) converting snake_case landmark keys to readable Title Case names. |
| `formatters.js` | Formatters for coordinate strings, points, annotations, and distances. |
| `math.js` | Math utility functions including `smoothstep` and Euclidean distance helpers. |
| `pixelMetrologyMapping.js` | Pixel-to-Metrology Mapping Core v0. Pure, resolution-independent conversion functions between 2D raster coordinates and metrology domain coordinates (pixel centers, continuous points, inclusive bounding box outer envelopes, row mapping, horizontal column spans, and inverses). |
| `scene.js` | Initializes Three.js `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `CSS2DRenderer`, lights, and `OrbitControls`. Safe in Node test environments. |

### Domain Features & State (`src/features/`)

| File | Responsibilities |
|------|------------------|
| `bodyEvidencePackage.js` | **Full Body Evidence Package Contract v0 & Dense Layout / Pixel Index Contract v0.** Pure normalized multi-modal domain schema and QA contract across independent Front and Side views (`image`, `pose`, `segmentation`, `pointmap`, `normals`). Resolves dense layouts (`HWC_INTERLEAVED`, `CHW_PLANAR`, `UNKNOWN`), preserves `declaredShape`, provides layout-aware indexing (`getDenseVectorElementIndex`, `readDenseVector`), and enables lazy read-only buffer access (`getDenseData`). |
| `bodyEvidenceZipAdapter.js` | **Body Evidence ZIP Import Adapter v0.** Temporary transport and discovery adapter. Unzips archives, detects single-sample subdirectories, filters debug/preview artifacts, matches Front and Side modalities, captures raw staging metadata (`rawSources: { aposeResult, alignResult }`), and builds normalized packages. Zero UI or scene coupling. |
| `bodyEvidenceAdapter.js` | **Landmark & Segmentation Normalization.** Pure stateless algorithms for Core 13 / Secondary allowlist pose classification, face/head rejection, and 29-class segmentation decoding and validation. |
| `denseEvidenceQa.js` | **Dense Evidence QA Core v0.** Pure deterministic Pointmap Numeric QA (`pointmap-numeric-qa-v0`), Surface Normal Numeric QA (`normal-numeric-qa-v0`), and Same-View Cross-Modal Dense QA (`same-view-dense-cross-modal-qa-v0`). Evaluates finite/non-finite element/vector statistics, raw channel bounds, normal magnitudes, declared range violations, raster compatibility, addressability, and observational mask groups without buffer mutations. |
| `bodyEvidence.js` | **Body Evidence Runtime Store.** Retains active package, landmark/seg selections, derived `denseEvidenceQa` runtime state, async dense QA lifecycle integration with session race protection (`analyzeLoadedBodyEvidenceAsync`), subscriber notifications, horizontal raster slice, transverse width, profile span, cross-view correspondence, comparability QA, metric calibration provenance, physical measurement semantics, view pose semantics, clothing body-surface semantics, authoritative physical evidence semantics, direct body measurements getters, and modeled circumference getters (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat). |
| `bustPointPlaneLocalization.js` | **Bust Point Plane Localization Contract v1 (`bust-point-plane-localization-v1`).** [ACTIVE PRODUCTION] Pure deterministic domain contract localizing the Bust Point Plane from the raw Side contour anterior chest/breast extrema under `trunk_core_support_v0` (`[22, 23]`). |
| `bustApexPlaneLocalization.js` | **Bust Apex Plane Localization Contract v0 (`bust-apex-plane-localization-v0`).** [LEGACY — RETAINED FOR REGRESSION PROTECTION] Pure deterministic legacy baseline-relative bust prominence localizer. |
| `modeledBustCircumference.js` | **Modeled Bust Circumference Contract v0 (`modeled-bust-circumference-v0`).** [ACTIVE PRODUCTION] Pure deterministic domain contract deriving the ellipse-modeled Bust circumference estimate at the localized Bust Point Plane using Ramanujan II. |
| `naturalWaistPlaneLocalization.js` | **Natural Waist Plane Localization Contract v0 (`natural-waist-plane-localization-v0`).** [ACTIVE PRODUCTION] Pure deterministic evidence-driven waist plane localization using metric smoothing window = 2.0 cm, bilateral contour QA, broad trough pooling, and hierarchical tie-breaking. |
| `modeledNaturalWaistCircumference.js` | **Modeled Natural Waist Circumference Contract v0 (`modeled-natural-waist-circumference-v0`).** [ACTIVE PRODUCTION] Pure deterministic domain contract deriving an ellipse-modeled Natural Waist circumference estimate from the localized Natural Waist Plane using Ramanujan II with a strict Front-only gate. |
| `abdominalPointPlaneLocalization.js` | **Abdominal Point Plane Localization Contract v1 (`abdominal-point-plane-localization-v1`).** [ACTIVE PRODUCTION] Pure deterministic domain contract localizing the Abdominal Point Plane from the raw Side contour anterior abdominal extrema under `trunk_pelvic_transition_support_v0` (`[12, 13, 21, 22, 23]`). |
| `abdominalApexPlaneLocalization.js` | **Abdominal Apex Plane Localization Contract v0 (`abdominal-apex-plane-localization-v0`).** [LEGACY — RETAINED FOR REGRESSION PROTECTION] Pure deterministic legacy baseline-relative abdominal prominence localizer. |
| `modeledAbdominalCircumference.js` | **Modeled Abdominal Circumference Contract v0 (`modeled-abdominal-circumference-v0`).** [ACTIVE PRODUCTION] Pure deterministic domain contract deriving an ellipse-modeled Abdominal circumference estimate from the localized Abdominal Point Plane using Ramanujan II with transition support. |
| `buttockPointPlaneLocalization.js` | **Buttock Point Plane Localization Contract v1 (`buttock-point-plane-localization-v1`).** [ACTIVE PRODUCTION] Pure deterministic domain contract localizing the Buttock Point Plane from the raw Side contour posterior buttock extrema under `pelvic_core_support_v0` (`[12, 13, 21, 22]`). |
| `modeledHipGirth.js` | **Modeled Hip Girth Contract v1 (`modeled-hip-girth-v1`).** [ACTIVE PRODUCTION] Pure deterministic domain contract deriving the ellipse-modeled Hip Girth estimate at the localized Buttock Point Plane using Ramanujan II. |
| `maximumSeatPlaneLocalization.js` | **Maximum Seat Plane Localization Contract v0 (`maximum-seat-plane-localization-v0`).** [ACTIVE PRODUCTION] Pure deterministic evidence-driven localization ranking valid same-Y Front width + qualified Side AP depth by Ramanujan II modeled perimeter score to identify the Maximum Seat Plane. |
| `modeledHipSeatCircumference.js` | **Modeled Maximum Seat Circumference Contract v0 (`modeled-hip-seat-circumference-v0`).** [ACTIVE PRODUCTION] Pure deterministic domain contract deriving the modeled circumference estimate at the localized Maximum Seat Plane using Ramanujan II. |
| `modeledCrossSectionPerimeter.js` | **Modeled Cross-Section Perimeter Infrastructure (`modeled-cross-section-perimeter-v0`).** [ACTIVE PRODUCTION INFRASTRUCTURE] Owns the shared `computeRamanujanEllipsePerimeter` formula used by all active modeled perimeters, and derives Hip Landmark Level modeled perimeter estimate. |
| `directBodyMeasurements.js` | **Direct Body Measurements Contract v0 (`direct-body-measurements-v0`).** Pure deterministic domain contract deriving 25 direct Batch A & Batch B measurements from validated anatomical reference levels and promoted Front body landmarks across Vertical Inter-Level (5), Projected Landmark Segments (10), Kinematic Chains (4), and Bilateral Transverse Landmark Spans (6). |
| `anatomicalRegions.js` | **Anatomical Region Contract v0.** Pure deterministic domain contract mapping normalized Front/Side segmentation `classes[]` into observed 29-class region records with metric `boundsCm`. Owns authoritative `BODY_ANATOMICAL_CLASS_IDS` taxonomy. |
| `appMode.js` | Manages app interaction mode (`MODE_INSPECT_MEASURE` vs `MODE_ANNOTATE`). |
| `selection.js` | Manages selected point state `{ x, y, z }` and selection highlight mesh in Annotate mode. |
| `measurement.js` | Manages canonical 3D/Front Point A/B measurement state, markers, line, CSS2D label, measurement history, and clear/advance operations. |
| `sideMeasurement.js` | Manages local Side Evidence A/B measurement state on the U/Y plane. |
| `frontSurfaceMeasurement.js` | Coordinates Front Surface 2D clicks with the canonical shared 3D measurement. |
| `annotations.js` | Annotation CRUD operations, 3D box marker and CSS2D label management, visibility toggles, and programmatic promotion path for body landmarks. |
| `annotationValidation.js` | Validates annotation input (point selection, non-empty name, duplicate detection). |
| `frontSideAlignment.js` | Pure deterministic Front/Side semantic correspondence and vertical Y QA contract. |
| `bodyGraph.js` | Body Graph Contract v0. Deterministic runtime topology derivation (`buildBodyGraph`) containing exactly 13 Core nodes and 13 structural edges from promoted Core 13 annotations. |
| `anatomicalLevels.js` | **Anatomical Level Contract v0.** Pure, deterministic derivation of true reference Y levels (`neck`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`) from promoted Front body landmarks. |
| `anatomicalRegionEvidence.js` | **Anatomical Region Evidence Association Contract v0.** Assembles evidence nodes for the 13 canonical `body_anatomical` regions with metric bounds, dense qualifications, and landmark/level adjacency. |
| `measurementSupportPolicy.js` | **Measurement Support Policy Contract v0 (`measurement-support-policy-v0`).** Pure deterministic definitions of observed supported silhouettes (`neck_core_support_v0` [`Face_Neck` 3, `Torso` 22, `Upper_Clothing` 23], `trunk_core_support_v0`, `pelvic_core_support_v0`, `trunk_pelvic_transition_support_v0`). |
| `frontRasterSlice.js` | **Front Horizontal Raster Slice Contract v0.** Pure deterministic $O(W)$ single-row streaming scan across Front segmentation raster returning contiguous horizontal runs. |
| `frontTransverseWidth.js` | **Front Transverse Width Interpretation Contract v0 (`front-transverse-width-v0`).** Pure deterministic interpretation of raster slice evidence into formal transverse widths at neck (`neck_transverse_width_at_neck_level`), shoulder (`torso_width_at_shoulder_level`), and hip (`torso_width_at_hip_level`) levels under measurement support policies and `single_run_required` policy. |
| `sideRasterSlice.js` | **Side Horizontal Raster Slice Contract v0.** Pure deterministic $O(W)$ single-row streaming scan across Side segmentation raster returning contiguous horizontal runs in Side Metrology space ($U\text{ cm}$). |
| `sideProfileSpan.js` | **Side Profile Span Interpretation Contract v0.** Pure deterministic interpretation of raster slice evidence into formal profile spans under measurement support policies and `single_run_required` policy. |
| `crossViewMeasurementCorrespondence.js` | **Cross-view Measurement Correspondence Contract v0.** Pure deterministic correspondence layer pairing Front transverse width and Side profile span observations at matching anatomical source levels. |
| `crossViewComparabilityQa.js` | **Cross-view Comparability QA Contract v0.** Pure deterministic QA evaluating whether 4.5A correspondence pairs are sufficiently qualified and internally consistent for later cross-view use across 10 inspectable checks. |
| `metricCalibrationProvenance.js` | **Metric Calibration Provenance Contract v0 (`metric-calibration-provenance-v0`).** Pure deterministic domain validator evaluating upstream metric calibration claims across Front and Side views. |
| `authoritativePhysicalEvidenceSemantics.js` | **Authoritative Physical Evidence Semantics Contract v0 (`authoritative-physical-evidence-semantics-v0`).** Pure deterministic domain contract classifying dense pointmap evidence by authority without creating measurements. Implemented dense-geometry evaluator `sapiens-pointmap-camera-frame-evaluator-v0` classifies recognized Sapiens Front/Side pointmaps as camera-frame geometric evidence (`partial`, `authorized: false`). |
| `physicalMeasurementSemantics.js` | **Physical Measurement Semantics Contract v0 (`physical-measurement-semantics-v0`).** Pure deterministic domain contract classifying measurements into workspace, metric projected, and physical semantic tiers. |
| `viewPoseSemantics.js` | **View / Pose Semantics Contract v0 (`view-pose-semantics-v0`).** Pure deterministic domain qualification layer verifying Layer A declared view identity, Layer B 2D structural pose qualification, and Layer C physical orientation certification. |
| `clothingBodySurfaceSemantics.js` | **Clothing / Body-Surface Semantics Contract v0 (`clothing-body-surface-semantics-v0`).** Pure deterministic domain qualification layer governing Layer A clothing participation, Layer B visual garment qualification, and Layer C authoritative empirical body-surface authorization. |
| `sidePoseQualification.js` | **Side T-Pose Qualification Contract v0 (`side-t-pose-qualification-v0`).** Pure deterministic domain evaluator qualifying Side arm horizontal reach, shoulder-elbow-wrist alignment, 2D projected elbow collinearity deviation, and bilateral symmetry. |
| `sideAnteriorPosteriorOrientation.js` | **Side Anterior / Posterior Orientation Semantics Contract v0 (`side-anterior-posterior-orientation-v0`).** Pure deterministic domain contract determining anatomical anterior/posterior along Side-U. |
| `sideViewOrientationQualification.js` | **Approximately-Lateral Side View Qualification Contract v0 (`side-view-orientation-qualification-v0`).** Pure deterministic domain evaluator determining whether Side acquisition is lateral-compatible using bilateral landmark collapse consensus across stable pairs. |
| `sidePhysicalDepthQualification.js` | **Side Physical Depth Qualification Contract v0 (`side-physical-depth-qualification-v0`).** Pure deterministic domain contract qualifying when a valid Side profile span observation may be interpreted as a qualified side-derived physical AP depth estimate. |
| `crossSectionEvidence.js` | **Cross-Section Evidence Contract v0 (`cross-section-evidence-v0`).** Pure deterministic compositional evidence layer combining qualified Front transverse width and Side AP physical depth observations at validated reference levels (`shoulder`, `hip`). |
| `pelvicArbitraryYEvidenceScan.js` | **Pelvic Arbitrary-Y Evidence Scan Contract v0 (`pelvic-arbitrary-y-evidence-scan-v0`).** Pure deterministic continuous row scanner across pelvic region segmentation. |
| `arbitraryYSidePhysicalDepthQualification.js` | **Arbitrary-Y Side Physical Depth Qualification Contract v0 (`arbitrary-y-side-physical-depth-qualification-v0`).** Pure deterministic qualification evaluating Side AP depth across arbitrary pelvic Y levels. |
| `torsoArbitraryYEvidenceScan.js` | **Torso Arbitrary-Y Evidence Scan Contract v0 (`torso-arbitrary-y-evidence-scan-v0`).** Pure deterministic continuous row scanner extracting Front transverse width and Side qualified AP depth across the anatomical shoulder-to-hip column under resolution-independent mapping. |
| `measurementVisualizationProvenance.js` | **Measurement Visualization Provenance Contract v0 (`measurement-visualization-provenance-v0`).** Pure declarative domain normalizer translating domain measurement, plane localization, and bilateral transverse span records into standardized 2D visualization instructions across supported visualization types (`front_horizontal_slice`, `cross_view_horizontal_slice`, `bilateral_transverse_span`). |
| `physicalMeasurementEligibility.js` | **Physical Measurement Eligibility Contract v0 (`physical-measurement-eligibility-v0`) & Paired Cross-View Eligibility Contract v0 (`paired-cross-view-eligibility-v0`).** Authoritative downstream eligibility gate evaluating whether measurements meet all constraints to be consumed as true physical body scalars. |
| `bodyMeasurementLevels.js` | Measurement Reference Levels v0 compute (orphaned / internal helper). |
| `bodyMeasurementLines.js` | Anatomical Measurement Lines v0 compute (candidate readiness lines). |
| `bodyMeasurementPreview.js` | Measurement Line Preview Overlay v0 (draws visual-only Ready preview lines in 3D and Front 2D). |
| `projectionLinking.js` | Projects 3D Origin, Center, and annotation markers onto the Front 2D Grid Navigator. |
| `sceneExport.js` | Serializes session state into canonical Scene State JSON schema v1. |
| `sceneImport.js` | Validates and restores Scene State JSON. |
| `sceneGraphHighlight.js` | Temporary 3D highlight overlays for measurement history, annotation activation, and Origin/Center projection links. |
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
| `workspaceLayout.js` | Manages workspace navigation tabs (3D Space, 2D Workspace, Body Graph), combined 3D+2D split view (36% 3D / 64% 2D default), draggable split divider, and right Results & Records sidebar rail collapse. |
| `grid2dNavigator.js` | Front Surface 2D Grid Navigator (0–200 cm X/Y), 10 cm base lattice, 5 cm regional refinement, shared measurement overlay, projected markers, and Front segmentation overlay. Manages active-only legend rendering. |
| `sideGrid2dNavigator.js` | Side Evidence 2D Grid Navigator (0–200 cm U/Y), 10 cm base lattice, 5 cm regional refinement, Side Core and Secondary markers, local Side A/B measurement, and Side segmentation overlay. Manages active-only legend rendering. |
| `grid2dNavShared.js` | Shared 2D navigator math, zoom/pan transforms, and lattice utilities. |
| `grid2dPlotArea.js` | Shared 2D plot frame, axis labels, and CSS variable management. |
| `grid2dMarkerSizing.js` | Computes zoom-dependent relative marker sizes for 2D navigators. |
| `bodyEvidencePackageQaUi.js` | Reusable Package QA HTML helper for overall status, Front/Side modality pills, raster compatibility, and deferred geometry flags. **Not mounted** in the live Diagnostics accordion; covered by unit tests. |
| `bodyEvidencePanel.js` | Left Body Evidence workflow panel (Front / Side / Landmark tabs). Manages candidate list filtering, segmentation class list filtering, inspect cards, single landmark promotion, and batch promotion (`Promote All Front Core Landmarks`). Analysis runs automatically upon package upload. |
| `bodyEvidenceCandidateList.js` | Renders candidate lists with Core / Secondary filters and unified color semantics (Gold for Core, Purple for Secondary). |
| `bodyEvidenceOverlay2d.js` | Renders Front Surface Body Evidence overlay markers and active selection highlight. |
| `bodyEvidenceOverlaySide2d.js` | Renders Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes). |
| `segmentationOverlay2d.js` | Renders read-only, translucent dense semantic segmentation overlays onto Front and Side 2D navigators using shared internal helpers, isolated per-view caches (`viewState.front`, `viewState.side`), and $O(1)$ visibility toggles. |
| `frontSideAlignmentPanel.js` | Read-only Diagnostics → Front–Side Alignment presentation. Derives the alignment report on demand; renders top summary card and collapsible Core Pairs, Secondary Pairs, and Issues groups. |
| `bodyGraphWorkspace.js` | Renders the read-only Core 13 Body Graph topology workspace and summary statistics. |
| `bodyTabConsolidatedPanel.js` | Wires Diagnostics Front–Side Alignment, Body / Anchor readiness, and Natural Waist Plane diagnostic inspection card with click-to-highlight / keyboard focus integration. Does not remount the old Package QA card or anchors table. |
| `derivedMeasurementDeck.js` | Right Sidebar Results deck rendering collapsible Shoulder / Hip Cross-Section Evidence cards, Front Transverse Widths card (Neck Transverse Width with responsive stacked metadata), Modeled Circumferences (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat), and collapsible parent Direct Measurements cards (with Bilateral Spans & Breadths subgroup) with click-to-highlight integration. |
| `measurementHighlightOverlay2d.js` | Pure declarative 2D measurement highlight overlay renderer consuming normalized visualization provenance instructions on dedicated SVG/canvas layers across Front and Side navigators. Displays clean geometry (horizontal guides, localized slice lines, endpoint dots, bilateral transverse spans with asymmetry drop lines, selection highlights) with no always-visible text labels over measurement lines. |
| `modeledEllipseCrossSectionPreview.js` | Visual-only companion cross-section preview SVG renderer for all 5 Modeled Circumferences (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat) displaying Front width $\times$ Side AP depth ellipse with aspect ratio preservation, accurate plane labels, and disclaimer `"Ellipse model — not measured contour"`. |
| `advancedQaPanel.js` | Diagnostics Why This Result Is Blocked plus Advanced QA intake/calibration. |
| `leftPanel.js` | Anatomical Levels card. Package upload is File-menu only. |
| `measurementPanel.js` | Distance Measurement inspector (Front / Canonical and Side / U-Y) plus Session Records History. |
| `selectionPanel.js` | Updates Selected Point coordinate readouts inside the Annotation panel. |
| `annotationControls.js` | Wires Annotation Type and Landmark Preset dropdowns with auto-fill behavior. |
| `annotationPanel.js` | Renders the Annotation List in Session Records with per-item Delete buttons. |
| `annotationValidationMessage.js` | Displays and clears inline validation messages for annotation creation. |
| `sceneGraphPanel.js` | Compact Diagnostics Origin / Center projection utility. No Scene Graph tree. |
| `collapsibleSections.js` | Shared `[data-collapsible]` accordion wiring for Left Inspector and Right Sidebar (Session Records, Diagnostics, nested diagnostic subgroups). |
| `badgeUi.js` | Shared HTML escaping and status-badge markup used across inspector and Diagnostics renderers. |
| `domRefs.js` | Centralized, safe cached DOM element lookups. |
| `hoverTooltip.js` | Positions and updates the screen-space hover coordinate tooltip. |

---

## 3. Styling Architecture (`src/styles/`)

- `variables.css`: Design tokens, colors (dark cosmic theme, purple/cyan/amber accents), typography (Syne display, JetBrains Mono data), sidebar widths (left, right, right collapsed), spacing, and resets.
- `layout.css`: Overall CSS grid layout (`#top-header`, `#left-sidebar`, `#viewport`, `#right-sidebar`, `#bottom-status-bar`), right sidebar collapse layout, workspace panes, and split divider resizing.
- `components.css`: Component-level styles for menus, workflow-driven left inspector, Results / Session Records / Diagnostics, candidate lists, inspect cards, badges, action buttons, Front–Side Alignment, Advanced QA, responsive stacked metadata rows (`.derived-card-row--meta`, `.front-transverse-meta-row`), and the unmounted Package QA helper classes (`.body-evidence-package-qa-card`, `.body-package-qa-*`, `.body-evidence-qa-pill*`).
- `overlays.css`: Styles for 2D plot areas, lattices, markers, measurement overlays, legend items, and tooltips.
- `style.css`: Entry point combining the stylesheet modules via `@import`.

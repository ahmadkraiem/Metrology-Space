# Latent Space — Project Context

This document describes the **current implementation state** of the project. It is intended for future AI coding sessions to preserve existing behavior and avoid regressions.

**Stack:** Vite + Three.js (`src/main.js`, `src/style.css`, `index.html`)

---

## 1. Project Identity

This project is a **3D volumetric metrology / measurement space**.

It renders an interactive **200 cm × 200 cm × 200 cm** coordinate cube used to:

- Inspect volumetric sample points in real-world centimeters
- Measure 3D distance between points in Inspect & Measure mode
- Annotate named 3D points in Annotate mode
- Inspect Front Surface (X/Y) and Side Evidence (U/Y) 2D planes side-by-side
- Promote verified front body landmarks into canonical 3D annotations
- Inspect topological Body Graph v0 based on promoted Core 13 landmarks
- Export the current metrology session as structured Scene State JSON
- Load a previously exported Scene State JSON file to restore session data

The visual style is dark, technical, and CAD/metrology-oriented — not a game environment.

---

## 2. Fixed Scale Rules

These scale rules are fundamental and must not change without explicit instruction:

| Rule | Value |
|------|-------|
| Scene unit | **1 unit = 1 cm** |
| Cube size | **200 × 200 × 200 cm** |
| Coordinate meaning | X, Y, Z values are centimeters |
| Distance units | Results are directly in **cm** |

Origin is at the floor corner **(0, 0, 0)**. The cube spans from `(0, 0, 0)` to `(200, 200, 200)`.

---

## 3. Grid Rules

### Visible surface grid
- **10 cm** spacing
- Small square markers on all six cube faces (floor, ceiling, four walls)

### Internal volumetric sampling
- **5 cm** spacing on X, Y, and Z
- Full lattice from `0` to `200` inclusive
- **41 × 41 × 41 = 68,921** stored internal points

### Axis coordinate labels
- Shown every **20 cm**: `0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200`
- On X (red), Y (green), and Z (blue) axes

---

## 4. Current 3D Scene

The scene currently includes:

- **Transparent cube boundaries** — faint faces + visible wireframe edges
- **Dark technical background** (`#080b10`) with light fog
- **X / Y / Z axes** — red / green / blue with arrowheads and tick labels
- **Internal volumetric point lattice** — small cube markers filling the volume
- **Zoom-based Level of Detail (LOD)** for internal point rendering
- **Origin and Center reference markers** — fixed subtle coordinate references (see below)
- **OrbitControls** — rotate (left drag), pan (right drag), zoom (scroll)

There are **no reference planes** currently in the scene.

### Origin and Center reference markers
- **Origin marker** at **X = 0 cm, Y = 0 cm, Z = 0 cm** — soft white/cyan octahedron
- **Center marker** at **X = 100 cm, Y = 100 cm, Z = 100 cm** — soft magenta/purple octahedron
- Used as subtle coordinate reference points, visually distinct from internal lattice cubes
- Text labels are **hidden by default** to avoid visual clutter
- Hovering the Origin marker shows: `Origin (0, 0, 0)`
- Hovering the Center marker shows: `Center (100, 100, 100)`
- Labels use `CSS2DObject` (always face camera); shown only while the cursor hovers the marker mesh
- **No connecting lines** to or from these markers
- Must not interfere with normal point hover, point selection, distance measurement, LOD, or measurement history (separate raycast; not included in volume pick meshes)
- Visibility is controlled by the top application **View** menu item **Origin / Center** (checked by default); when unchecked, both marker meshes and hover-only labels are hidden and hover does not show labels

---

## 5. Point Rendering / LOD Behavior

### Full data
All **68,921** internal points exist at **5 cm** sampling. The data is split into three exclusive `InstancedMesh` layers:

| Layer | Spacing | Role |
|-------|---------|------|
| Coarse | every 20 cm | Dominates far view |
| Medium | every 10 cm (excluding 20 cm grid) | Mid-range detail |
| Fine | every 5 cm (excluding 10 cm grid) | Close-up detail |

### LOD blending
Opacity of each layer is updated every frame based on camera distance to the orbit target:

- **Far** (`> ~420`): mostly coarse points, very faint finer detail
- **Medium** (`~280`): medium layer dominant
- **Close** (`< ~190`): full 5 cm lattice most visible

Transitions use smoothstep blending (`LOD_FAR = 420`, `LOD_MID = 280`, `LOD_NEAR = 190`).

### Visual constraints
- Internal points are **isolated small cube markers** only
- **No connecting lines** between internal points
- **No radial lines, starburst patterns, or wireframe webs** between points
- Points remain subtle; cube edges and axes stay visually dominant

---

## 6. Current Interaction Features

### Hover
- Moving the mouse over a volumetric point shows a **temporary hover highlight**
- Smaller/subtler cube marker than committed selection or measurement markers
- Hidden while dragging (orbit), when pointer leaves canvas, and when hovering measurement points A/B
- In **Annotate mode**, also hidden when hovering the currently selected point
- Updates are throttled via `requestAnimationFrame`
- **Inspect & Measure mode:** hover color **previews the next measurement click**
  - If the next click will set **Point A**, hover uses Point A color (`#ffa45c` orange)
  - If the next click will set **Point B**, hover uses Point B color (`#d48cff` magenta)
  - If Point A and Point B already exist, hover previews Point A color for the next new measurement
- **Annotate mode:** hover uses the same orange/amber family (`#ffa726`) as the selected-point highlight preview
- Hovering a volumetric point also shows a **temporary coordinate tooltip**
- Tooltip displays:
  - `X: {x} cm`
  - `Y: {y} cm`
  - `Z: {z} cm`
- Coordinates are displayed as clean integer centimeter values
- The tooltip is implemented as a **screen-space HTML overlay** inside the viewport/canvas container (`#hover-coordinate-tooltip`)
- It follows the **mouse cursor with an offset** instead of being attached to the 3D point; flips left/up if it would overflow the viewport
- It uses `pointer-events: none` so it does not block hover, selection, or measurement
- It hides when the pointer leaves the canvas, when dragging/orbiting, or when no volumetric point is hovered
- It does not affect Point A, Point B, measurement line, floating distance label, or history
- The **floating distance label** remains a `CSS2DObject` at the measurement line midpoint (see §7)

### App modes and inspector workflows

The app has two **interaction modes** (Inspect & Measure vs Annotate) that control 3D/2D click behavior. Active workflow selection is managed via the **Workflow** top application menu (`#app-menu-bar [data-menu="workflow"]`):

| Workflow | Menu Item | Default | Left-Sidebar Content | Interaction Mode Effect |
|----------|-----------|---------|----------------------|-------------------------|
| **Inspect & Measure** | `data-workflow="measurement"` | Yes | Distance Measurement panel (`#measurement-panel`) | Sets Inspect & Measure mode |
| **Annotate** | `data-workflow="annotation"` | No | Selected Point panel (`#selection-panel`) with annotation controls | Sets Annotate mode |
| **Body Evidence** | `data-workflow="body-evidence"` | No | Body Evidence panel (`#body-evidence-panel`) | Inspector-only — does **not** change app mode |

Body Evidence controls live **only** in the Body Evidence workflow. They do **not** appear inside Annotate. Annotate remains annotation-specific. Inspect & Measure remains measurement-specific.

Workflow panel visibility itself is UI-only (`#left-sidebar[data-workflow]`, wired by `src/ui/inspectorWorkflow.js` and `src/ui/inspectorWorkflowState.js`). Switching between **Inspect & Measure** and **Annotate** also changes the app interaction mode and applies the documented mode-switch cleanup rules below. In contrast, switching to or from **Body Evidence** changes inspector workflow visibility only and does not clear measurements, annotations, or Body Evidence session state.

#### Inspect & Measure mode
- Default active mode on load
- Hover works as described above (preview next A/B color)
- Click advances the Point A / Point B measurement flow (see §7)
- Promoted `body_landmark` annotation markers are valid measurement pick targets (see **Body Landmark Measurement Picking v0** in §7)
- **Selected Point panel is hidden** in left sidebar
- Selection highlight mesh is **not shown** (does not compete with A/B markers)
- Internal selection state is not updated on click; measurement state drives the active interaction
- Distance Measurement panel is the active control panel in the left sidebar
- Saved annotations remain visible in the scene and in the right Session Data sidebar

#### Annotate mode
- Hover works; hover and selected point use the same orange/amber family
- Click selects a volumetric point only — does **not** set Point A, Point B, or advance measurement
- Clicking promoted `body_landmark` annotations does **not** set Point A/B (Annotate remains annotation-focused)
- **Selected Point panel is visible** in left sidebar, showing X, Y, Z in cm
- Annotation name input, **Annotation Type** dropdown (default: Custom), **Landmark Preset** dropdown (default: Custom/manual), **Add Annotation**, and **Clear Selection** (`#clear-selection`) are visible
- **Add Annotation** works only in this mode (from the currently selected point, chosen type, and final name in the name input)
- Distance Measurement panel is hidden
- Body Evidence actions/promote controls are **not** part of Annotate
- Existing measurement history remains visible in the right Session Data sidebar

#### Mode / workflow switch cleanup
- **Inspect & Measure → Annotate:** clears active Point A, Point B, measurement line, floating distance label, and Distance Measurement panel state; clears selected point if it matched A or B; **does not** clear measurement history or saved annotations
- **Annotate → Inspect & Measure:** clears current selected point, selected-point highlight, and annotation controls (name input, type dropdown, preset dropdown — all reset via `resetAnnotationControls()`); **does not** delete saved annotations or clear measurement history; does not restore any measurement automatically
- **Body Evidence workflow:** changes left-panel visibility and status hint only; leaves the active app mode, measurements, annotations, and Body Evidence session state untouched
- Returning from Body Evidence to Inspect & Measure / Annotate restores the matching measurement or annotation workflow for the current app mode

Saved annotations and measurement history remain visible across mode switches.

### Point selection
- **Annotate mode only:** click (without drag) selects a volumetric point
- Uses raycasting against LOD instanced meshes, with nearest-point fallback along the ray
- **Selected Point panel** shows X, Y, Z in cm (Annotate mode only)
- Orange/amber selection highlight (`#ffa726`, higher opacity than hover) at the clicked point — the committed version of the Annotate hover preview
- Only one selected point at a time; each click updates selection
- **Clear Selection** button (`#clear-selection`) clears the active selected point, selection highlight mesh, and resets validation messages
- **Inspect & Measure mode:** the Selected Point panel and selection highlight are hidden; clicks advance measurement instead

---

## 7. Current Distance Measurement Features

### Click flow (Front / Canonical 3D)
1. **First click** → **Point A** (orange marker)
2. **Second click** → **Point B** (magenta marker), line drawn, distance calculated
3. **Third click** (when A and B already set) → starts a new measurement: new Point A, clears Point B and line

In **Inspect & Measure mode**, each click advances this flow only — the Selected Point panel and selection highlight are not shown. Valid click targets include internal lattice / volume points, Front Surface 2D grid points, and promoted `body_landmark` annotation markers.

In **Annotate mode**, clicks do not advance measurement.

### Body Landmark Measurement Picking v0

Promoted body landmarks can be used as **normal A/B measurement targets**. This extends existing Inspect & Measure picking — it does **not** add a separate body measurement system, panel, or history.

#### What is pickable
- Only promoted annotations where `annotation.type === "body_landmark"`
- Promoted body landmarks remain normal annotations visually and structurally
- The measurement coordinate is the annotation’s **stored position** `{ x, y, z }` in cm

#### Inspect & Measure
- First click on a promoted `body_landmark` can set **Point A**
- Second click on a promoted `body_landmark` can set **Point B**
- The normal measurement line / floating distance label appears
- The completed measurement is added to the **existing Measurement History**
- Third measurement click follows existing A/B rules (starts a new measurement)
- Active Point A/B display shows the landmark display name stacked with coordinates when the point came from a body landmark (session-local UI label only — not a Scene State schema field)

#### Annotate mode
- Clicking promoted body landmarks must **not** set Point A/B
- Annotate remains annotation-focused; body landmark measurement picking does not break annotation creation/editing

#### 2D Workspace (Front-only)
- Promoted `body_landmark` projected markers in the Front 2D Workspace can also be clicked in Inspect & Measure to drive the **shared 3D A/B** flow
- Uses the annotation’s stored 3D position (Front Surface promote path typically has front-surface Z; mapping convention remains 2D X→3D X, 2D Y→3D Y, Z = front-surface depth for lattice picks)

#### Picking priority
1. If a click hits a promoted `body_landmark` marker → use that annotation position as the measurement point
2. Otherwise preserve existing lattice / Front Surface point picking
3. Body Measurement Preview Lines remain visual-only and are **not** pickable
4. Hidden annotations (View menu **Annotations** unchecked) are not pickable as measurement targets

### Side Evidence Local U/Y Measurement

The Side Evidence 2D navigator supports **local 2D measurement** on the U/Y plane:
- Active only in **Inspect & Measure** workflow
- Measures Euclidean distance on the Side evidence plane: `distance = Math.hypot(b.u - a.u, b.y - a.y)` cm
- Maintained completely independently from Front/3D measurement state in `src/features/sideMeasurement.js`
- Side measurement results are **not** added to Measurement History and are **not** exported in Scene State JSON
- Visualized on the Side 2D plane with local Point A (orange diamond), Point B (cyan diamond), and connecting measurement line/label

### Independent Collapsible Measurement Subgroups

The left Metrology Inspector **Distance Measurement** panel (`#measurement-panel`) contains two **independent collapsible measurement subgroups**:

1. **Front / Canonical** (`.inspector-subgroup--canonical-measure`):
   - Active Point A coordinates (`#point-a-coords`) & Clear A button (`#clear-point-a`)
   - Active Point B coordinates (`#point-b-coords`) & Clear B button (`#clear-point-b`)
   - Measurement Distance (`#measurement-distance`) & Clear Measurement button (`#clear-measurement`)
   - State managed by `src/features/measurement.js`

2. **Side / U-Y** (`.inspector-subgroup--side-measure`):
   - Active Side Point A coordinates (`#side-point-a-coords`) & Clear A button (`#clear-side-point-a`)
   - Active Side Point B coordinates (`#side-point-b-coords`) & Clear B button (`#clear-side-point-b`)
   - Side Measurement Distance (`#side-measurement-distance`) & Clear Side Measurement button (`#clear-side-measurement`)
   - State managed by `src/features/sideMeasurement.js`

**Subgroup Behavior & Isolation Rules:**
- **Simultaneous expansion:** Either or both subgroups may be expanded/open simultaneously.
- **Independent state:** Each subgroup keeps its own state without interference.
- **Dedicated clear actions:** Each subgroup has its own Clear A, Clear B, and Clear Measurement actions.
- **Strict isolation:** Front clear actions never mutate Side measurement state, and Side clear actions never mutate Front / 3D measurement state.

#### Allowed vs not allowed measurement targets

| Allowed | Not allowed |
|---------|-------------|
| Promoted annotations with `type === "body_landmark"` | Raw Body Evidence candidates |
| Internal 3D volumetric lattice points | Unpromoted primary / core candidates |
| Front Surface 2D grid sample points | Unpromoted secondary candidates |
| Side 2D grid points (for local Side A/B only) | Rejected face/head landmarks |
| | Ignored / deferred landmarks |
| | Side landmarks (for canonical 3D/Front measurement) |
| | Segmentation or masks |
| | Body Measurement Preview Lines |
| | Body Measurement Readiness rows |

---

## Current Point Annotation Features

> **Annotation input validation:** Annotation input is validated before saving. Invalid annotation input (e.g. no selected point, empty name, or duplicate) shows a UI validation message and does **not** create an annotation.

- Point annotations are implemented and working.
- A user can create a named annotation from the currently selected volumetric point **in Annotate mode only**.
- Each annotation stores a **semantic node type** in addition to its name and coordinates.
- Each annotation stores:
  - stable annotation `id`
  - annotation `name`
  - semantic annotation `type`
  - `position` as X, Y, Z coordinates in cm
- **Landmark Presets** are a naming helper in Annotate mode — they are **not** stored or exported as a separate field. The saved annotation `name` is always the final value in the **Annotation Name** input (which may have been auto-filled from a preset).
- Allowed annotation types:
  - `custom`
  - `reference_point`
  - `body_landmark`
  - `garment_landmark`
  - `measurement_point`
- Default annotation type is **`custom`**.
- Default landmark preset is **`custom`** (manual naming).
- Annotations are session-only and stored in memory.
- Each annotation creates a stable 3D visual at the saved coordinate (`THREE.Group` with box marker and `CSS2DObject` label).
- Adding annotations is blocked while OrbitControls dragging is active and outside Annotate mode.
- Annotation delete buttons in the right Session Data sidebar **Annotations tab** remove the marker, label DOM node, and list entry.
- Add Annotation controls live in the left Selected Point panel (`#annotation-add-controls`) and are visible only in Annotate mode.
- **Clear Selection** button (`#clear-selection`) clears the active selected point and highlight mesh.
- 3D annotation visuals can be hidden via the top application **View** menu item **Annotations** (checked by default).
- Hiding annotations is **visual only** — annotations are not deleted, remain in the Annotation List, and are still included in Scene State JSON export.

---

## Current View Controls Features

View controls live in the **top application menu** under **View** (`#app-menu-bar [data-menu="view"]`), with authoritative checked indicators derived directly from runtime state (`getViewSetting`).

### View Settings

| Setting ID | Menu Label | Default State | Behavior |
|------------|------------|---------------|----------|
| `origin-center` | Origin / Center | Checked | Toggles 3D and projected 2D Origin and Center reference markers and hover labels |
| `annotations` | Annotations | Checked | Toggles 3D and projected 2D annotation markers and CSS2D labels |
| `measurement-lines` | Measurement Lines | Checked | Toggles 3D and Front 2D measurement lines and floating distance labels |
| `lattice-3d` | 3D Lattice Points | Checked | Toggles internal 3D volumetric point lattice (LOD layers) |
| `front-grid` | Front Grid Points | Checked | Toggles Front Surface 2D Grid Navigator sample points |
| `side-grid` | Side Grid Points | Checked | Toggles Side Evidence 2D Grid Navigator sample points |
| `front-core` | Front Core | Unchecked | Toggles Core 13 Front Body Evidence overlay markers (enabled after analysis) |
| `front-secondary` | Front Secondary | Unchecked | Toggles Allowlisted Secondary Front Body Evidence markers (enabled after analysis) |
| `side-core` | Side Core | Unchecked | Toggles Core Side Body Evidence overlay markers (enabled after analysis) |
| `side-secondary` | Side Secondary | Unchecked | Toggles Secondary Side Body Evidence overlay markers (enabled after analysis) |
| `body-previews` | Body Measurement Previews | Checked | Toggles visual-only Ready anatomical preview lines (3D and Front 2D) |

View toggles are **presentation-only**. Toggling a view setting never clears measurement state, deletes annotations, clears Body Evidence sources, resets refinement, or alters Scene State JSON export schemas.

### Dynamic Legends Specification

Dynamic legends on both the Front Surface (`#grid2d-legend`) and Side Evidence (`#side-evidence-legend`) navigators follow strict visibility rules:
- **Active-only rendering:** A legend item appears **only** when its corresponding layer is currently active/visible and available.
- **No reserved space for inactive layers:** If a layer is toggled OFF (e.g. via the View menu) or is unavailable (e.g. prior to Body Evidence analysis), its legend item is **not rendered** in the DOM and occupies zero space.
- Applied consistently to both Front Surface and Side Evidence navigators.

---

## Current Body Evidence Features

Body Evidence is a dedicated left Metrology Inspector **workflow / panel** (`#body-evidence-panel`, workflow `data-workflow="body-evidence"`). It is a separate **evidence layer** — **body-only**. Face/head landmarks are rejected/excluded.

### Candidate Visual & Color Semantics

Candidate visualization across Front and Side navigators and lists follows unified color semantics:
- **Core Candidates:** **Side Core** uses the exact same semantic color as **Front Core** (`#facc15` gold / yellow).
- **Secondary Candidates:** **Side Secondary** uses the exact same semantic color as **Front Secondary** (`#c084fc` purple / magenta).
- **Selected Candidate:** The selected candidate uses the strongest highlight (`#22d3ee` cyan border / glow with bright yellow/white interior emphasis) regardless of source (Front or Side) or classification (Core or Secondary).
- **Semantic Principle:** **Color identifies Core vs Secondary, NOT Front vs Side.** (Overlay marker shape differentiates geometry: diamonds for Core, circles for Secondary).

### File Pickers (File Menu)
Evidence files are loaded via the **File** top application menu (`#app-menu-bar [data-menu="file"]`):
- **Load Front Pose JSON…** (`#load-front-pose-json`)
- **Load Side Pose JSON…** (`#load-side-pose-json`)
- **Load Front Seg JSON…** (`#load-front-seg-json`)
- **Load Side Seg JSON…** (`#load-side-seg-json`)

Result / Scale JSON is **not** imported. Scale is fixed at **2000×2000 px** and **10 px/cm** (`BODY_EVIDENCE_V0_SCALE`).

### Actions Subgroup
- **Analyze Body Evidence** (`#analyze-body-evidence`): Runs adapter parsing, normalization, and QA classification across loaded pose and seg files.
- **Download Evidence JSON** (`#download-body-evidence-json`): Diagnostic download of normalized evidence.
- **Clear Evidence** (`#clear-body-evidence`): Clears loaded evidence sources, parsed candidates, and overlay markers without touching measurements or annotations.

### Left Panel Tab Structure
The left Body Evidence panel is organized into three tabs:
1. **Front** (`#body-evidence-tab-front`):
   - Shows Front Core and Front Secondary candidate lists (`#body-evidence-front-candidates`)
   - Candidate counts and filter pills
2. **Side** (`#body-evidence-tab-side`):
   - Shows Side Core and Side Secondary candidate lists (`#body-evidence-side-candidates`) with distinct pill badges
   - Distinct classification: Core landmarks vs Secondary allowlist
3. **Selection** (`#body-evidence-tab-selection`):
   - Inspect card for the currently selected candidate (`#body-evidence-selected`)
   - **Promote to Body Landmark** button (`#promote-selected-body-landmark`): Enabled for Front candidates only; disabled with clear message for Side candidates
   - **Clear Selection** button (`#clear-body-landmark-selection`)

### Front Promotion vs Side Non-Promotion
- **Front Candidates:** Clicking **Promote** creates a canonical 3D `body_landmark` annotation with position `{ x, y, z: FRONT_SURFACE_DEPTH_CM }`. Promoted landmarks become valid measurement targets, enter Measurement Readiness, and feed Body Graph v0.
- **Side Candidates:** Strictly **non-promotable**. Side evidence exists only in U/Y space and does not enter `annotations.js`, `sceneExport.js`, `bodyGraph.js`, or `bodyMeasurementReadiness`.

---

## Current Body Graph Features

### Body Graph Contract v0
- **Deterministic derivation:** Built dynamically via `buildBodyGraph(getAnnotations())`.
- **Contract topology:** Exactly **13 Core anatomical nodes** and **13 structural edges**.
- **Source:** Derives strictly from promoted `body_landmark` annotations. Secondary promoted landmarks, unpromoted candidates, and Side evidence are ignored.
- **Persistence:** Body Graph is **not** serialized into Scene State JSON (no `bodyGraph` field). It is reconstructed at runtime from restored annotations.

### Body Graph Workspace v0
- Dedicated workspace tab (`#workspace-tab-body-graph`, mode `body-graph`).
- Visualizes the Core 13 anatomical topology diagram with summary badges (Present / Total nodes, Complete / Total edges).
- Read-only topology workspace — separate from the Session Data Scene Graph.

---

## Current Scene Graph Features

- Located in the **Graph** tab of the right Session Data sidebar (`#tab-panel-graph`).
- Compact tree visualization of scene objects: Scene Metadata, Reference Markers, Active Measurement, Measurement History, Annotations.
- Clicking tree nodes triggers temporary 3D highlighting without mutating scene state.

---

## Current Scene State Export / Import Features

- Managed via the **File** top application menu (**Export Scene State** and **Import Scene State…**).
- **Canonical Schema v1:** Exports metadata, units (`cm`), cube scale, timestamps (UTC and local), active measurement, measurement history, and annotations.
- **Exclusions:** Raw Body Evidence, Side measurements, 2D UI refinement state, and Body Graph are strictly excluded from Scene State JSON.

---

## Current 2D Workspace and Grid Navigators

The **2D Workspace** tab (`#workspace-tab-split`, mode `split`) presents a side-by-side view of the 3D space and the 2D navigators:
- Default allocation: **36% 3D / 64% 2D split** to provide ample space for 2D refinement and side-by-side evidence inspection.
- Resizable via the outer draggable vertical divider (`#workspace-split-divider`).

### Front Surface Navigator (X/Y)
- **Domain:** 0–200 cm X (width) and Y (height).
- **Base Grid:** 10 cm lattice with single-level 5 cm regional refinement (**Split Selection**).
- **Measurement:** Drives the canonical shared Front/3D measurement (`advanceFrontSurfaceMeasurement`).
- **Overlays:** Core and Secondary Front body evidence overlays, projected 3D reference markers, projected annotations, and body measurement preview lines.

### Side Evidence Navigator (U/Y)
- **Domain:** 0–200 cm U (horizontal depth evidence) and Y (height).
- **Base Grid:** 10 cm lattice with single-level 5 cm regional refinement.
- **Measurement:** Local Side A/B measurement only (U/Y Euclidean distance), active in Inspect & Measure workflow.
- **Overlays:** Side Core (diamonds) and Side Secondary (circles/dots) evidence markers using shared Core and Secondary semantic colors.

---

## 8. Current UI State

The UI uses a **REVacity-style** dark cosmic / neural command-center layout:

### Top Header (`#top-header`)
- **Brand:** REVacity Metrology Space.
- **Application Menu Bar (`#app-menu-bar`):**
  - **File:** Load Front/Side Pose JSON, Load Front/Side Seg JSON, Import Scene State, Export Scene State, Download Body Evidence JSON.
  - **View:** 11 view setting toggles with authoritative checked indicators and enabled/disabled states.
  - **Workflow:** Inspect & Measure, Annotate, Body Evidence workflow selection.

### Left Sidebar — Metrology Inspector (`#left-sidebar`)
Workflow-driven panels:
- **Inspect & Measure:** Distance Measurement panel (`#measurement-panel`) with independent collapsible Front/Canonical and Side/U-Y subgroups.
- **Annotate:** Selected Point panel (`#selection-panel`) with coordinates, annotation type/preset dropdowns, Add Annotation button, and Clear Selection button.
- **Body Evidence:** Body Evidence panel (`#body-evidence-panel`) with Actions subgroup and Front / Side / Selection tabs.

### Center Viewport (`#viewport`)
Workspace tabs (`#workspace-tabs`):
- **3D Space:** Fullscreen 3D metrology cube.
- **2D Workspace:** Combined 3D pane + Front X/Y navigator + Side U/Y navigator with draggable divider.
- **Body Graph:** Dedicated read-only Core 13 topological diagram.

### Right Sidebar — Session Data (`#right-sidebar`)
- **Collapsible sidebar behavior:** The entire right Session Data sidebar is collapsible via a dedicated collapse/expand toggle button (`#right-sidebar-toggle`) in the sidebar header.
  - **Expanded state:** Default width (`248px`), displaying the full sidebar header, tab bar, and active tab content.
  - **Collapsed state:** Reduces the sidebar to a narrow rail (`36px`) with a visible reopen control and subtle vertical rail label, automatically allocating freed horizontal space to the main workspace (`#viewport`).
  - **Reopening:** Clicking the toggle button or clicking the collapsed sidebar rail restores the sidebar to its normal width.
  - **State isolation:** Collapse/expand is strictly UI/layout-only. Toggling collapse preserves the currently active Session Data tab and never clears or mutates Measurement History, Annotations, Body tab data, Graph tab data, Body Evidence, Front/Side measurements, active app mode, inspector workflow, or Scene State JSON data. It does not change 3D, Front, Side, Body Graph, measurement, annotation, import/export, or evidence behavior.
- 4 segmented tabs:
  - **Hist (`#tab-panel-history`):** Shared canonical measurement history list and Clear History button.
  - **Annos (`#tab-panel-annotations`):** Annotation list with type badges and delete buttons.
  - **Body (`#tab-panel-body`):** Body Evidence Status summary, Promoted Body Anchors table, and Body Measurement Readiness audit.
  - **Graph (`#tab-panel-graph`):** Read-only Scene Graph tree with 3D highlight preview.

### Bottom Status Bar (`#bottom-status-bar`)
Passive readouts: Scale (1 unit = 1 cm), Grid (10 cm), Sampling (5 cm), Mode, and contextual hint text.

---

## 9. Features Tried and Removed

- Left inspector View Controls panel (moved to View menu with checked indicators).
- Left inspector Mode toggle buttons (moved to Workflow menu).
- Separate Files tab in Session Data (consolidated into File menu).
- Floating 2D overlay and standalone 2D tab (consolidated into 2D Workspace split view).
- Result / Scale JSON upload (replaced by fixed v0 scale).
- Independent 2D Front measurement state (unified with canonical 3D measurement).
- Dense hand/finger landmarks in secondary allowlist (deferred).

---

## 10. Important Do-Not-Break Rules

When modifying this project, preserve the following unless explicitly instructed otherwise:

- **Do not change the coordinate scale** (1 scene unit = 1 cm)
- **Do not change cube dimensions** (200 × 200 × 200 cm)
- **Do not change internal sampling logic** (5 cm, 68,921 points)
- **Do not break app mode separation** (Inspect & Measure vs Annotate)
- **Do not break two-point distance measurement** in Inspect & Measure mode
- **Do not break Front/Side measurement separation** — Side measurement is local U/Y only and never enters canonical measurement history or Scene State
- **Do not promote Side landmarks** — Side candidates are non-promotable and lack canonical 3D depth
- **Do not break Body Graph Contract v0** — Core 13 nodes and 13 structural edges derived strictly from promoted Core 13 `body_landmark` annotations
- **Do not serialize Body Graph or raw Body Evidence into Scene State JSON**
- **Do not break View menu checked-state indicators** — indicators must reflect authoritative runtime query (`getViewSetting`)
- **Do not break 2D Workspace split layout** — Front X/Y and Side U/Y navigators with draggable divider
- **Do not break manual annotation workflow** or Landmark Preset dropdowns
- **Do not break Body Measurement Readiness** calculations or Preview Overlay lines

### Explicitly NOT Implemented (Future Milestones)

The following capabilities are deliberately **not implemented** in the current codebase and must not be simulated or added without explicit directive:
1. **Front-Side Alignment / Registration:** No spatial fusion between Front X/Y and Side U/Y coordinates.
2. **U → Z Conversion / Canonical Side Depth:** Side U coordinates are not mapped to 3D Z depth.
3. **Side Landmark Promotion:** Side landmarks cannot be promoted to 3D annotations.
4. **Segmentation Mask Rendering:** Segmentation JSONs are parsed for QA counts only; masks are not rendered.
5. **Body-Region Inference:** No automatic mesh fitting or volumetric body partitioning.
6. **Circumference / Cross-Section Inference:** No elliptical or convex hull circumference math.
7. **Latent Space Conditioning / Features:** Metrology space is coordinate-pure; no latent representations.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/main.js` | Thin app orchestrator: scene assembly, interaction/UI setup, resize, animation loop |
| `src/core/constants.js` | Shared scale, grid, LOD, and tooltip constants |
| `src/core/frontSurface.js` | Front Surface depth, 2D↔3D mapping helpers |
| `src/core/annotationTypes.js` | Allowed annotation node types, landmark presets, display labels |
| `src/core/landmarkDisplay.js` | Shared Title Case landmark / annotation display-name helper |
| `src/core/formatters.js` | Coordinate, point, annotation, and distance formatting |
| `src/core/math.js` | smoothstep and Euclidean distance helpers |
| `src/core/scene.js` | Three.js scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls |
| `src/metrology/roomShell.js` | Transparent room shell and 10 cm surface grid markers |
| `src/metrology/volumeGrid.js` | 5 cm internal lattice, LOD layers, visibility controls |
| `src/metrology/axes.js` | X/Y/Z axes and 20 cm tick labels |
| `src/metrology/referenceMarkers.js` | Origin and Center markers, hover labels |
| `src/features/appMode.js` | App mode state (Inspect & Measure vs Annotate) |
| `src/features/selection.js` | Selected point state and highlight (Annotate mode) |
| `src/features/measurement.js` | Canonical shared Point A/B measurement state, markers, line, label, history |
| `src/features/sideMeasurement.js` | Local Side Evidence A/B measurement state (U/Y Euclidean distance) |
| `src/features/frontSurfaceMeasurement.js` | Front Surface advance/read helpers over shared measurement |
| `src/features/projectionLinking.js` | Read-only Front Surface projection of Origin/Center/annotations |
| `src/features/bodyEvidence.js` | Body Evidence state store, analyze/clear, selection, manual promote |
| `src/features/bodyEvidenceAdapter.js` | Body Evidence parsing, normalization, QA classification, secondary allowlist |
| `src/features/bodyGraph.js` | Body Graph Contract v0 — deterministic Core 13 graph derivation |
| `src/features/bodyMeasurementLevels.js` | Measurement Reference Levels v0 compute |
| `src/features/bodyMeasurementLines.js` | Anatomical Measurement Lines v0 compute |
| `src/features/bodyMeasurementPreview.js` | Measurement Line Preview Overlay v0 (3D + Front 2D preview lines) |
| `src/features/annotations.js` | Annotation CRUD, 3D visuals, CSS2D labels, promote path |
| `src/features/sceneExport.js` | Canonical Scene State JSON export build and download |
| `src/features/sceneImport.js` | Canonical Scene State JSON import validation and restore |
| `src/features/sceneGraphHighlight.js` | Temporary Scene Graph 3D highlight overlays |
| `src/interactions/raycast.js` | Shared raycaster and volumetric point resolution |
| `src/interactions/picking.js` | Mode-aware click picking (promoted landmark priority, lattice, selection) |
| `src/interactions/pointerEvents.js` | Canvas pointer wiring and event orchestration |
| `src/interactions/hover.js` | Hover highlight and tooltip coordination |
| `src/ui/appMenuBar.js` | Top application menu bar (File / View / Workflow dropdowns) |
| `src/ui/viewControls.js` | View settings definitions, authoritative checked query, setting toggle |
| `src/ui/inspectorWorkflow.js` | Metrology Inspector workflow panel visibility manager |
| `src/ui/inspectorWorkflowState.js` | Metrology Inspector workflow state store |
| `src/ui/domRefs.js` | Safe cached DOM element references |
| `src/ui/workspaceLayout.js` | Workspace tab management (3D / 2D / Body Graph), split divider, and right Session Data sidebar collapse/expand |
| `src/ui/grid2dNavigator.js` | Front Surface 2D Grid Navigator (X/Y coordinates) |
| `src/ui/sideGrid2dNavigator.js` | Side Evidence 2D Grid Navigator (U/Y coordinates) |
| `src/ui/grid2dNavShared.js` | Shared 2D navigator geometry, zoom/pan transform, and lattice utilities |
| `src/ui/grid2dPlotArea.js` | Shared 2D plot frame, axes, and CSS variable styling |
| `src/ui/bodyEvidencePanel.js` | Body Evidence left workflow panel (Front / Side / Selection tabs) |
| `src/ui/bodyEvidenceCandidateList.js` | Candidate list DOM rendering with Core / Secondary filters and pill badges |
| `src/ui/bodyEvidenceOverlay2d.js` | Front Surface Body Evidence overlay markers and inspect selection |
| `src/ui/bodyEvidenceOverlaySide2d.js` | Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes) |
| `src/ui/bodyGraphWorkspace.js` | Body Graph Workspace v0 — Core 13 topological diagram |
| `src/ui/bodyTabConsolidatedPanel.js` | Session Data Body tab (Status / Promoted Anchors / Readiness) |
| `src/ui/measurementPanel.js` | Distance Measurement inspector (Front/Canonical and Side/U-Y subgroups) |
| `src/ui/selectionPanel.js` | Selected Point inspector panel helper |
| `src/ui/annotationControls.js` | Landmark Preset dropdown wiring |
| `src/ui/annotationPanel.js` | Annotation list DOM rendering |
| `src/ui/sessionTabs.js` | Session Data tab manager (Hist / Annos / Body / Graph) |
| `src/ui/sceneGraphPanel.js` | Scene Graph tree DOM rendering |
| `src/styles/variables.css` | Design tokens and color themes |
| `src/styles/layout.css` | CSS grid layout, workspace panes, and split divider |
| `src/styles/components.css` | Menus, sidebars, tabs, panels, cards, candidate lists, and buttons |
| `src/styles/overlays.css` | 2D navigators, plot grids, markers, measurement overlays, and tooltips |
| `src/style.css` | Stylesheet entry point |
| `index.html` | Main HTML application shell |

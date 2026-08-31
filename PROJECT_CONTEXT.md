# TWENTY EIGHT — Project Context

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
- Import structured multi-modal Full Body Evidence Packages (`.zip`) with automatic analysis
- Inspect eligibility blockers, Front–Side Alignment, Body / Anchor Diagnostics, and Advanced QA in Right Sidebar → Diagnostics
- Inspect Front–Side Alignment v0 QA correspondence and vertical Y agreement in Diagnostics → Front–Side Alignment
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
- Visibility is controlled by the top application **View** menu item **Origin / Center** (unchecked / OFF by default); when unchecked, both marker meshes and hover-only labels are hidden and hover does not show labels

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

### Application shell

The live shell is a three-column layout (`#app-layout`):

#### Left Sidebar — Metrology Inspector (`#left-sidebar`)

Workflow-driven. Visibility is CSS (`#left-sidebar[data-workflow]`), wired by `inspectorWorkflow.js` / `inspectorWorkflowState.js`. There is **no** standalone Current Selection card and **no** Subject / Package card. Package upload lives in the **File** menu.

| Workflow | Menu Item | Default | Visible left panels | Interaction Mode Effect |
|----------|-----------|---------|---------------------|-------------------------|
| **Inspect & Measure** | `data-workflow="measurement"` | No | Anatomical Levels (`#anatomy-levels-card`) + Distance Measurement (`#measurement-panel`) | Sets Inspect & Measure mode |
| **Annotate** | `data-workflow="annotation"` | No | Annotation (`#annotation-panel`) with embedded Selected Point coords | Sets Annotate mode |
| **Body Evidence** | `data-workflow="body-evidence"` | **Yes** | Anatomical Levels + Advanced Evidence (`#body-evidence-panel`) | Inspector-only — does **not** change app mode |

Body Evidence controls live **only** in the Body Evidence workflow. They do **not** appear inside Annotate. Annotate remains annotation-specific. Inspect & Measure remains measurement-specific.

#### Center workspace (`#viewport`)

Three workspace tabs (`workspaceLayout.js`):

- **3D Space** — volumetric cube, lattice, measurements, annotations
- **2D Workspace** — Front Surface navigator (X/Y) beside Side Profile navigator (U/Y)
- **Body Graph** — read-only Core 13 topology diagram (`bodyGraphWorkspace.js`)

#### Right Sidebar — Results & Records (`#right-sidebar`)

No Hist / Annos / Body / Graph tab strip. Composition:

1. **Results** (`#derived-measurement-deck`, collapsible, collapsed by default at startup) — `derivedMeasurementDeck.js`:
   - **Measurement-Type-First Hierarchy**: Results are organized by geometric measurement type (independent of the 10-category anatomical planning taxonomy):
     1. **Widths & Transverse Spans** (`widths_spans`, 9 items): Neck Transverse Width, Torso Transverse Width at Shoulder Level, Inter-Acromion Transverse Breadth (Projected), Torso Transverse Width at Hip Level, Inter-Hip Landmark Transverse Span, Bilateral Elbow Landmark Transverse Span, Bilateral Wrist Landmark Transverse Span, Bilateral Knee Landmark Transverse Span, Bilateral Ankle Landmark Transverse Span.
     2. **Lengths & Distances** (`lengths_distances`, 19 items): Vertical Torso Length, Vertical Shoulder Drop, Vertical Thigh Length, Vertical Lower Leg Length, Vertical Total Leg Length, Left/Right Upper Arm Length (Projected), Left/Right Forearm Length (Projected), Left/Right Direct Arm Chord (Projected), Left/Right Total Arm Chain Length (Projected), Left/Right Thigh Length (Projected), Left/Right Lower Leg Length (Projected), Left/Right Total Leg Chain Length (Projected).
     3. **Circumferences & Girths** (`circumferences_girths`, 5 items): Modeled Bust Circumference, Modeled Natural Waist Circumference, Modeled Abdominal Circumference, Modeled Hip Girth, Modeled Maximum Seat Circumference.
   - **Registered Future Categories (Hidden while empty)**: *Depths / AP Measurements* (`depths_ap`), *Heights / Ground-Referenced* (`heights_ground`), *Surface Arcs / Curved Paths* (`surface_arcs`), *Angles / Posture* (`angles_posture`). Empty categories do not render.
   - **Compact Measurement Rows**: All 33 primary Results use compact selectable rows answering *"What measurement do we have, and what is its value?"*. Normal valid rows omit redundant "Valid" badges; modeled circumferences show a concise "Modeled" badge. Verbose formula/geometry blocks (Ramanujan details, Front width, Side AP depth, plane elevation, endpoints, long disclaimers) were removed from the main Results list and are preserved in domain records.
   - **Click-to-Highlight & Workspace Focus**: Clicking any measurement row (`[data-measurement-id]`) calls `selectMeasurement(id)` $\to$ resolves visualization provenance $\to$ sets active 2D measurement highlight $\to$ focuses the 2D workspace (`WORKSPACE_SPLIT`) $\to$ marks row `.is-selected` with `aria-selected="true"`. Clicking an active row deselects and clears the highlight.
   - **Modeled Ellipse Cross-Section Preview** (`modeledEllipseCrossSectionPreview.js`): When any modeled circumference is selected, a companion SVG cross-section preview appears in the 2D workspace displaying the ellipse implied by Front transverse width $\times$ Side AP depth with accurate plane label (`"Bust Point Plane Y"`, `"Waist Plane Y"`, `"Abdominal Point Plane Y"`, `"Hip Girth Plane Y"`, `"Seat Plane Y"`) and disclaimer `"Ellipse model — not measured contour"`.
   - **Selected Measurement Details (Stage 4)**: **DEFERRED** as an optional future UX enhancement; main Results list remains compact.
2. **Session Records** (`#session-records-panel`, collapsible, collapsed by default at startup):
   - **Annotations**: Promoted body landmarks and custom annotations with per-item Delete actions.
   - **History**: Canonical Point A/B measurement log with embedded `Clear History` action (`#clear-history`).
3. **Diagnostics** (`#diagnostics-panel`, collapsible, collapsed by default at startup) — independently collapsible subsections (all collapsed by default):
   - **Why This Result Is Blocked** (`#why-result-blocked`): Synthesizes discrete actionable eligibility blockers for unavailable measurements.
   - **Front–Side Alignment** (`#front-side-alignment-qa`): Multi-view vertical Y registration and landmark pairing checks within calibrated tolerance.
   - **Body / Anchor Diagnostics** (`#body-measurement-readiness`): Refocused on **Anchor Health** (Overall readiness badge, Missing core anchors, Duplicate body anchor names, Out of bounds, Front-surface Z warnings; subtitle: *"Promoted anchor integrity, completeness, and bounds checks"*). Legacy pre-contract anchor previews and visible Natural Waist plane card were removed from the UI, while underlying domain contracts (`getNaturalWaistPlaneLocalization`, `natural-waist-plane-localization-v0`) remain fully intact as internal/supporting evidence.
   - **Advanced QA** (`#advanced-qa-content`): Deep technical telemetry including Intake & Package identity, Calibration (px/cm, isotropic scaling), Side T-Pose Stance qualification, Side Lateral Orientation collapse ratio, and Side AP Depth qualification.
   - **Reference Projections utility** (`#reference-projection-utility`): Origin / Center raycast verification actions.

The whole right sidebar can collapse to a vertical rail (`#right-sidebar-toggle`). Section accordions are wired by `initCollapsibleSections()` on `#left-sidebar` and `#right-sidebar`. Diagnostics remains strictly separated from primary measurement Results.

#### Left Sidebar — Body Evidence Action
In addition to candidate list filtering and single-landmark promotion, the Front tab provides **Promote All Front Core Landmarks** (`#promote-all-front-core-btn`), which idempotently promotes all available Core 13 front landmarks in a single action without affecting Side or Secondary landmarks.

### App modes and inspector workflows

The app has two **interaction modes** (Inspect & Measure vs Annotate) that control 3D/2D click behavior. Active workflow selection is managed via the **Workflow** top application menu (`#app-menu-bar [data-menu="workflow"]`).

Workflow panel visibility itself is UI-only. Switching between **Inspect & Measure** and **Annotate** also changes the app interaction mode and applies the documented mode-switch cleanup rules below. In contrast, switching to or from **Body Evidence** changes inspector workflow visibility only and does not clear measurements, annotations, or Body Evidence session state.

#### Inspect & Measure mode
- Default active mode on load
- Hover works as described above (preview next A/B color)
- Click advances the Point A / Point B measurement flow (see §7)
- Promoted `body_landmark` annotation markers are valid measurement pick targets (see **Body Landmark Measurement Picking v0** in §7)
- Annotation / Selected Point controls are hidden (Annotate workflow only)
- Selection highlight mesh is **not shown** (does not compete with A/B markers)
- Internal selection state is not updated on click; measurement state drives the active interaction
- Distance Measurement panel is the active control panel in the left sidebar
- Saved annotations remain visible in the scene and in Right Sidebar → Session Records

#### Annotate mode
- Hover works; hover and selected point use the same orange/amber family
- Click selects a volumetric point only — does **not** set Point A, Point B, or advance measurement
- Clicking promoted `body_landmark` annotations does **not** set Point A/B (Annotate remains annotation-focused)
- **Annotation panel** is visible, with embedded Selected Point coords (`#annotation-selected-coords`) showing X/Y/Z or Side U/Y in cm
- Annotation name input, **Annotation Type** dropdown (default: Custom), **Landmark Preset** dropdown (default: Custom/manual), **Add Annotation**, and **Clear Selection** (`#clear-selection`) are visible
- **Add Annotation** works only in this mode (from the currently selected point, chosen type, and final name in the name input)
- Distance Measurement panel is hidden
- Body Evidence actions/promote controls are **not** part of Annotate
- Existing measurement history remains visible in Right Sidebar → Session Records

#### Mode / workflow switch cleanup
- **Inspect & Measure → Annotate:** clears active Point A, Point B, measurement line, floating distance label, and Distance Measurement panel state; clears selected point if it matched A or B; **does not** clear measurement history or saved annotations
- **Annotate → Inspect & Measure:** clears current selected point, selected-point highlight, and annotation controls (name input, type dropdown, preset dropdown — all reset via `resetAnnotationControls()`); **does not** delete saved annotations or clear measurement history; does not restore any measurement automatically
- **Body Evidence workflow:** changes left-panel visibility and status hint only; leaves the active app mode, measurements, annotations, and Body Evidence session state untouched
- Returning from Body Evidence to Inspect & Measure / Annotate restores the matching measurement or annotation workflow for the current app mode

Saved annotations and measurement history remain visible across mode switches.

### Point selection
- **Annotate mode only:** click (without drag) selects a volumetric point
- Uses raycasting against LOD instanced meshes, with nearest-point fallback along the ray
- The Annotation panel Selected Point block shows X, Y, Z in cm (or Side U/Y) in Annotate mode only
- Orange/amber selection highlight (`#ffa726`, higher opacity than hover) at the clicked point — the committed version of the Annotate hover preview
- Only one selected point at a time; each click updates selection
- **Clear Selection** button (`#clear-selection`) clears the active selected point, selection highlight mesh, and resets validation messages
- **Inspect & Measure mode:** the Annotation panel and selection highlight are hidden; clicks advance measurement instead

---

## 7. Current Distance Measurement Features

### Click flow (Front / Canonical 3D)
1. **First click** → **Point A** (orange marker)
2. **Second click** → **Point B** (magenta marker), line drawn, distance calculated
3. **Third click** (when A and B already set) → starts a new measurement: new Point A, clears Point B and line

In **Inspect & Measure mode**, each click advances this flow only — the Annotation / Selected Point controls and selection highlight are not shown. Valid click targets include internal lattice / volume points, Front Surface 2D grid points, and promoted `body_landmark` annotation markers.

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

## 8. Current Point Annotation Features

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
- Annotation delete buttons in Right Sidebar → Session Records → Annotations remove the marker, label DOM node, and list entry.
- Add Annotation controls live in the left Annotation panel (`#annotation-add-controls`) and are visible only in Annotate mode.
- **Clear Selection** button (`#clear-selection`) clears the active selected point and highlight mesh.
- 3D annotation visuals can be hidden via the top application **View** menu item **Annotations** (checked by default).
- Hiding annotations is **visual only** — annotations are not deleted, remain in the Annotation List, and are still included in Scene State JSON export.

---

## 9. Current View Controls Features

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
| `front-seg` | Front Segmentation | Checked | Toggles Front dense semantic segmentation region preview overlay (enabled after analysis) |
| `side-seg` | Side Segmentation | Checked | Toggles Side dense semantic segmentation region preview overlay (enabled after analysis) |
| `body-previews` | Body Measurement Previews | Checked | Toggles visual-only Ready anatomical preview lines (3D and Front 2D) |

View toggles are **presentation-only**. Toggling a view setting never clears measurement state, deletes annotations, clears Body Evidence sources, resets refinement, or alters Scene State JSON export schemas.

### Dynamic Legends Specification

Dynamic legends on both the Front Surface (`#grid2d-legend`) and Side Evidence (`#side-evidence-legend`) navigators follow strict visibility rules:
- **Active-only rendering:** A legend item appears **only** when its corresponding layer is currently active/visible and available.
- **No reserved space for inactive layers:** If a layer is toggled OFF (e.g. via the View menu) or is unavailable (e.g. prior to Body Evidence analysis), its legend item is **not rendered** in the DOM and occupies zero space.
- Applied consistently to both Front Surface and Side Evidence navigators.

---

## 10. Current Full Body Evidence Package & Pipeline Architecture

### Canonical Runtime Flow

The application processes body evidence exclusively through the **Full Body Evidence Package Contract v0**:

```text
Upload Body Evidence Package (.zip)
        ↓
ZIP transport adapter (importBodyEvidenceZip)
        ↓
buildBodyEvidencePackage()
        ↓
setBodyEvidencePackage()
        ↓
automatic Body Evidence analysis (analyzeLoadedBodyEvidence)
        ↓
Front / Side evidence + Right Sidebar Results / Session Records / Diagnostics
```

Legacy standalone source setters (`setFrontPoseSource`, `setSidePoseSource`, `setFrontSegSource`, `setSideSegSource`) and individual per-modality file upload buttons no longer exist.

### Package Contract Structure

The normalized Body Evidence Package (`version: 'body-evidence-package-v0'`) is a pure domain contract representing multi-modal evidence across independent Front and Side views:

- **Top-level properties:**
  - `version`: `'body-evidence-package-v0'`
  - `sourceFormat`: e.g. `'body-pipeline-zip-v0'` or `'body-pipeline-v0'`
  - `sampleId`: optional string identifying the unique subject/sample
  - `front`: Front view evidence package
  - `side`: Side view evidence package
  - `qa`: Package-level aggregated QA descriptor

- **Per-View Modalities:**
  Each view (`front` and `side`) contains:
  1. **`image`**: Normalized visual input metadata (`filename`, `widthPx`, `heightPx`, `channels`, `format`, `view`, `bytes`, `qa`).
  2. **`pose`**: Normalized landmark candidates extracted and classified into Core 13 anchors, allowlisted secondary landmarks, and rejected face/head landmarks.
  3. **`segmentation`**: Normalized 29-class semantic segmentation structure (`model`, `view`, `widthPx`, `heightPx`, `classes[]`, retained `Uint8Array` raster, `qa`).
  4. **`pointmap`**: Normalized dense 3D point coordinate tensor metadata (`model`, `view`, `channels`, `shape`, `dtype`, `declaredUnits`, `declaredScale`, `getDenseData({ cache })`, `qa`).
  5. **`normals`**: Normalized surface normal vector tensor metadata (`model`, `view`, `channels`, `shape`, `dtype`, `declaredRange`, `getDenseData({ cache })`, `qa`).
  6. **`qa`**: Per-view QA status (`pass`, `warning`, `fail`), modality availability map, raster dimensions, and raster compatibility checks.

### Role of the ZIP Transport Adapter

The ZIP loader (`src/features/bodyEvidenceZipAdapter.js`) is a **temporary transport and integration adapter** for current pipeline and testing workflows. It unzips archive files in memory, discovers sample subdirectories (enforcing single-sample packages in v0), ignores system/debug files, groups Front and Side artifacts, and delegates directly to `buildBodyEvidencePackage()`. Downstream domain and UI modules never couple to ZIP file or folder conventions. Future direct API or WebSocket integrations will construct the normalized package object directly.

### Pointmap & Surface Normal Geometry Semantics

Pointmaps and surface normals are accepted and normalized in Package Contract v0. Package-level declarations remain unvalidated by the package schema itself:
- **`declaredUnits`**: Units declared in metadata (e.g. `'cm'`, `'mm'`, `'m'`) — unvalidated at package/QA level. For recognized Sapiens pointmaps, 4.5G records `unitAuthority: service_reported` and `physicalUnitsVerified: false`. The Sapiens API report `units: "meters"` is **service-reported / physically unverified** and is not authoritative physical meter geometry.
- **`declaredScale`**: Scale factor declared in metadata — unvalidated at package/QA level. For recognized Sapiens pointmaps, 4.5G preserves `scale` as `predicted_focal_normalization` provenance only. It is **not** TWENTY EIGHT pixels-per-cm, body-height calibration, physical body scale, Front/Side shared calibration, or cross-view registration scale.
- **`declaredRange`**: Value range declared in metadata (e.g. `[-1, 1]`, `[0, 255]`) — unvalidated.
- **Coordinate frames**: Package/Dense QA do not certify pointmap XYZ as canonical metrology axes. 4.5G classifies recognized Sapiens Front and Side pointmaps independently as `camera_local` (`X = image_right`, `Y = image_down`, `Z = model_depth_channel`, `sharedAcrossViews: false`). There is no shared camera frame, no Front$\leftrightarrow$Side transform, no runtime camera extrinsics, and no validated canonical compatibility (`revacityXYZ`, `revacityZ`, `sideUToCanonicalZ`, `frontSideFusion` are all `false`).
- **Normal orientations**: Normal vector directions and coordinate conventions are unvalidated.

> [!WARNING]
> Pointmap $Z$ values must **never** be assumed to be canonical metrology $Z$. Sapiens `"meters"` and Sapiens `scale` do **not** confer physical authority. No spatial fusion, depth projection, or 3D mesh generation from pointmaps or normals is performed in v0.

### QA Status States

Package Contract v0 establishes 4 distinct QA status levels:
- **`pass`**: Required structural constraints, types, shape dimensions, and bounds are fully valid.
- **`warning`**: Minor non-fatal anomalies present (e.g. low-confidence landmarks, sparse classes).
- **`fail`**: Structural failure, view mismatch, corrupted data, or missing critical shapes.
- **`unvalidated`**: Declared metadata present but geometry semantics explicitly deferred to future validation milestones. `unvalidated` is **not** equivalent to failure.

Package Contract structural QA verifies structural readability, raster compatibility between modalities within the same view, and modality availability. It remains separate from derived runtime Dense Evidence QA.

Dense Evidence QA is implemented and integrated at runtime (see §18): Dense Layout / Pixel Index Contract v0, Pointmap Numeric QA, Normal Numeric QA, Same-View Dense Cross-Modal QA, derived `denseEvidenceQa` state, asynchronous evaluation lifecycle, and sanitized diagnostic export. Dense Evidence QA does **not** classify coordinate-frame or physical-geometry authority and is not duplicated by 4.5G. Milestone 4.5G consumes those existing QA results and classifies recognized Sapiens pointmaps as camera-frame geometric evidence without establishing authoritative physical body geometry. Present-but-invalid or uninspectable dense evidence cannot become authoritative. A missing pointmap is `availability: missing` / `status: unavailable` / `physicalAuthority.status: unavailable`, which remains distinct from present-but-`not_authoritative`.

### Runtime Memory & Lazy Buffer Management

Dense pointmap and normal binary tensors are accessed on demand via `getDenseData({ cache = false })` and are **not** eagerly decoded or duplicated into active runtime state. (Raw transport payloads may supply an internal `loadDenseBuffer()` hook or base64 string, which `buildBodyEvidencePackage` wraps into the normalized `getDenseData` accessor). Lightweight diagnostic export (`buildBodyEvidenceExport()` / `downloadBodyEvidenceJson()`) and Scene State serialization strictly omit raw binary arrays and base64 payloads to preserve memory and performance.

### UI Integration

1. **File Menu (`#app-menu-bar [data-menu="file"]`):**
   - **Upload Body Evidence Package…** (`import-body-evidence-package`): Opens native ZIP picker, parses archive, and runs automatic analysis.
   - **Download Body Evidence JSON** (`download-body-evidence`): Downloads sanitized diagnostic JSON summary (enabled when evidence is analyzed).

2. **Left Body Evidence Inspector (`#body-evidence-panel`):**
   - **Front Tab (`#body-evidence-tab-front`):** Front Core and Secondary candidate lists, Front Segmentation class list with Present/Absent filters.
   - **Side Tab (`#body-evidence-tab-side`):** Side Core and Secondary candidate lists, Side Segmentation class list with Present/Absent filters.
   - **Landmark Tab (`#body-evidence-tab-selection`):** Detailed inspect cards for the active Front/Side landmark or segmentation class; **Promote Selected Landmark** (Front only); **Clear Landmark Selection**.
   - Analysis executes automatically upon package upload; manual Analyze / Download / Clear action buttons have been eliminated.

3. **Right Sidebar (`#right-sidebar`):**
   - **Results:** Shoulder / Hip derived measurement cards (`derivedMeasurementDeck.js`).
   - **Session Records:** History + Annotations. Promoted body landmarks appear as `body_landmark` annotation records, not a second anchors table.
   - **Diagnostics → Why This Result Is Blocked:** Eligibility / blocker reasons (`advancedQaPanel.js`).
   - **Diagnostics → Front–Side Alignment:** Vertical $\Delta Y$ correspondence report (`frontSideAlignmentPanel.js`).
   - **Diagnostics → Body / Anchor Diagnostics:** Promoted-anchor readiness and preview-span audit (`bodyTabConsolidatedPanel.js`).
   - **Diagnostics → Advanced QA:** Package identity (sample / format / version) and metric calibration provenance only. The full Package QA modality card (`bodyEvidencePackageQaUi.js`) is a reusable HTML helper used by tests; it is **not** mounted in the live Diagnostics accordion.
   - **Diagnostics → Origin / Center:** Compact projection utility (`sceneGraphPanel.js`). There is no Scene Graph tree.

---

## 11. Current Segmentation Normalization & 2D Overlay Architecture

### Segmentation Normalization + QA Contract v0
- **Deterministic Parsing:** Raw Front and Side segmentation payloads are decoded and normalized via `normalizeSegmentation()` in `src/features/bodyEvidenceAdapter.js`.
- **Canonical `classes[]`:** Emits structured class descriptors containing `classId`, `label`, `pixelCount`, `coverage`, `present`, `boundsPx` (`{ minX, minY, maxX, maxY }`), and `boundsNormalized` (`{ minX, minY, maxX, maxY }` in `0..1`).
- **Retained `Uint8Array` Raster:** Decoded label rasters are retained in runtime memory and queried via `getFrontSegmentationRaster()` and `getSideSegmentationRaster()`.
- **Authoritative QA Validation:** Enforces view matching (`front` / `side`), `num_classes` matching `class_names.length`, 2D shape `[height, width]`, `uint8` dtype, valid base64 decode, decoded length matching `height * width`, pixel class IDs within range `[0..num_classes - 1]`, and recomputed pixel counts matching input `class_counts` (supporting both dense and sparse counts).

### 2D Segmentation Overlay Architecture
- **Shared Parameterized Helpers:** Front and Side overlay rendering and visibility syncing use shared internal helpers (`renderSegmentationOverlayForView`, `syncSegmentationVisibilityForView`) in `src/ui/segmentationOverlay2d.js`.
- **Isolated Per-View State:** Front and Side raster and selected class ID caches are maintained in strictly isolated objects (`viewState.front` and `viewState.side`).
- **$O(1)$ Visibility Toggles:** Toggling Front or Side segmentation visibility via the View menu updates `canvas.hidden` in $O(1)$ time without re-rasterizing, re-scanning, or calling `putImageData`.
- **Conditional Repaint:** Canvas bitmap redrawing via `putImageData` occurs strictly when the underlying raster payload or the active selected class ID changes.
- **Independent Class Selections:** Front class selection and Side class selection remain completely independent and highlight without crosstalk.

---

## 12. Current Anatomical Region Contract v0 Features

Anatomical Region Contract v0 is a pure deterministic domain layer implemented in `src/features/anatomicalRegions.js`:

### Authoritative 29-Class Ontology
Grounds strictly in the project's actual 29-class segmentation vocabulary (exact index order `0..28`):

| Class ID | Canonical Label | Semantic Category | Metrology Eligible |
| :---: | :--- | :--- | :---: |
| `0` | `Background` | `context_background` | No |
| `1` | `Apparel` | `clothing_apparel` | No |
| `2` | `Eyeglass` | `accessory_other` | No |
| `3` | `Face_Neck` | `face_head` | No |
| `4` | `Hair` | `face_head` | No |
| `5` | `Left_Foot` | `body_anatomical` | **Yes** |
| `6` | `Left_Hand` | `body_anatomical` | **Yes** |
| `7` | `Left_Lower_Arm` | `body_anatomical` | **Yes** |
| `8` | `Left_Lower_Leg` | `body_anatomical` | **Yes** |
| `9` | `Left_Shoe` | `clothing_apparel` | No |
| `10` | `Left_Sock` | `clothing_apparel` | No |
| `11` | `Left_Upper_Arm` | `body_anatomical` | **Yes** |
| `12` | `Left_Upper_Leg` | `body_anatomical` | **Yes** |
| `13` | `Lower_Clothing` | `clothing_apparel` | No |
| `14` | `Right_Foot` | `body_anatomical` | **Yes** |
| `15` | `Right_Hand` | `body_anatomical` | **Yes** |
| `16` | `Right_Lower_Arm` | `body_anatomical` | **Yes** |
| `17` | `Right_Lower_Leg` | `body_anatomical` | **Yes** |
| `18` | `Right_Shoe` | `clothing_apparel` | No |
| `19` | `Right_Sock` | `clothing_apparel` | No |
| `20` | `Right_Upper_Arm` | `body_anatomical` | **Yes** |
| `21` | `Right_Upper_Leg` | `body_anatomical` | **Yes** |
| `22` | `Torso` | `body_anatomical` | **Yes** |
| `23` | `Upper_Clothing` | `clothing_apparel` | No |
| `24` | `Lower_Lip` | `face_head` | No |
| `25` | `Upper_Lip` | `face_head` | No |
| `26` | `Lower_Teeth` | `face_head` | No |
| `27` | `Upper_Teeth` | `face_head` | No |
| `28` | `Tongue` | `face_head` | No |

### Contract Rules & Invariants
- **Category Partition:** Exactly 13 `body_anatomical`, 7 `clothing_apparel`, 7 `face_head`, 1 `accessory_other`, 1 `context_background`.
- **Observed Only:** Exactly 29 observed region records per report. No composite, union, or synthetic regions.
- **Metrology Eligibility:** `isBodyMetrologyEligible: true` strictly for the 13 `body_anatomical` classes; `false` for all other 16 classes.
- **`Face_Neck` Boundary:** `Face_Neck` is categorized as `face_head` (excluded from body metrology) and is **never treated or split as an isolated Neck region**.
- **Decoupled Status:** Presence/QA status (`valid`, `absent`, `invalid`) is separate from semantic category. Face/head classes with positive pixels are `'valid'` segmentation evidence with `isBodyMetrologyEligible: false`.
- **Bounds Scope:** Exposes `boundsPx`, `boundsNormalized`, and metric outer envelope `boundsCm` (derived via Pixel-to-Metrology Mapping Core v0; `{ minX, maxX, minY, maxY }` for Front, `{ minU, maxU, minY, maxY }` for Side; `null` for absent/invalid regions).
- **View Independence:** Front $(X, Y\text{ cm})$ and Side $(U, Y\text{ cm})$ regions are evaluated independently without $U \to Z$ conversion or spatial fusion.

---

## 13. Current Pixel-to-Metrology Mapping Core v0 Features

Pixel-to-Metrology Mapping Core v0 is a pure, resolution-independent conversion layer implemented in `src/core/pixelMetrologyMapping.js`:

### Coordinate Spaces & Semantic Distinctions
- **Continuous Image Space:** $[0, W] \times [0, H]$ in pixels, origin at top-left $(0, 0)$.
- **Discrete Pixel Grid:** $[0..W-1] \times [0..H-1]$ integer column and row indices.
- **Front Metrology Space:** $X$ (width, transverse) and $Y$ (height) in centimeters, origin at floor corner $(0, 0)\text{ cm}$.
- **Side Metrology Space:** $U$ (horizontal sagittal depth evidence) and $Y$ (height) in centimeters, origin at $(0, 0)\text{ cm}$.
- **Workspace Extent:** Fixed $200\text{ cm}$ domain (`ROOM_SIZE = 200`).
- **Resolution Independence:** All mapping formulas accept arbitrary positive raster dimensions $W$ and $H$. *(Observed test pipeline images frequently use $2000 \times 2000\text{ px}$, corresponding to $10\text{ px/cm}$, but the mapping algorithms do not hardcode fixed pixel dimensions).*

### Mapping Formulas
1. **Continuous Image Point / Edge $\to$ Metrology Space:**
   $$X = \frac{x}{W} \times L \quad (\text{Front}), \quad U = \frac{x}{W} \times L \quad (\text{Side})$$
   $$Y = \left(\frac{H - y}{H}\right) \times L = \left(1 - \frac{y}{H}\right) \times L$$
   - Top-left continuous edge $(0, 0) \to (0.0\text{ cm}, 200.0\text{ cm})$.
   - Bottom-right continuous edge $(W, H) \to (200.0\text{ cm}, 0.0\text{ cm})$.

2. **Discrete Pixel Center $\to$ Metrology Space:**
   Setting $(x, y) = (col + 0.5, row + 0.5)$ for $col \in [0..W-1]$ and $row \in [0..H-1]$:
   $$X_{\text{center}} = \frac{col + 0.5}{W} \times L \quad (\text{Front}), \quad U_{\text{center}} = \frac{col + 0.5}{W} \times L \quad (\text{Side})$$
   $$Y_{\text{center}} = \left(\frac{H - (row + 0.5)}{H}\right) \times L$$

3. **Inclusive Bounding Box $\to$ Outer Metric Bounds:**
   Maps the **outer envelope** of inclusive pixel bounding box $\{ minX, minY, maxX, maxY \}$ ($minX \le maxX$, $minY \le maxY$):
   $$minX_{\text{cm}} / minU_{\text{cm}} = \frac{minX}{W} \times L, \quad maxX_{\text{cm}} / maxU_{\text{cm}} = \frac{maxX + 1}{W} \times L$$
   $$minY_{\text{cm}} = \left(\frac{H - (maxY + 1)}{H}\right) \times L, \quad maxY_{\text{cm}} = \left(\frac{H - minY}{H}\right) \times L$$

4. **Continuous Inverse Conversions:**
   $$x = \frac{X}{L} \times W \quad (\text{Front}) \quad \text{or} \quad x = \frac{U}{L} \times W \quad (\text{Side})$$
   $$y = \left(\frac{L - Y}{L}\right) \times H$$

### Input Validation & Error Handling
- **No silent clamping:** Coordinates, indices, bounding boxes, or raster dimensions outside valid domains explicitly throw `TypeError` or `RangeError`.

---

## 14. Current Front–Side Alignment v0 Features

### Purpose
Front–Side Alignment v0 is a deterministic, read-only correspondence and QA layer between Front normalized Body Evidence on $X/Y$ and Side normalized Body Evidence on $U/Y$. It evaluates semantic correspondence and vertical $Y$ agreement only; it does **NOT** reconstruct 3D geometry, estimate depth, or fuse 2D coordinates into 3D points.

### Alignment Calculation
For matched identities:
$$\Delta Y = |front.y - side.y|$$

- **Default Tolerance:** `5.0 cm` (`DEFAULT_ALIGNMENT_TOLERANCE_CM = 5.0`)
- **`aligned`:** Finite Front and Side $Y$ values and $\Delta Y \le 5.0\text{ cm}$.
- **`warning`:** Finite Front and Side $Y$ values and $\Delta Y > 5.0\text{ cm}$.
- **`unavailable`:** Missing identity/view or missing/non-finite $Y$ coordinate.

---

## 15. Current Body Graph Features

### Body Graph Contract v0
- **Deterministic derivation:** Built dynamically via `buildBodyGraph(getAnnotations())`.
- **Contract topology:** Exactly **13 Core anatomical nodes** and **13 structural edges**.
- **Source:** Derives strictly from promoted `body_landmark` annotations. Secondary promoted landmarks, unpromoted candidates, and Side evidence are ignored.
- **Persistence:** Body Graph is **not** serialized into Scene State JSON. It is reconstructed at runtime from restored annotations.

### Body Graph Workspace v0
- Dedicated workspace tab (`#workspace-tab-body-graph`, mode `body-graph`).
- Visualizes the Core 13 anatomical topology diagram with summary badges (Present / Total nodes, Complete / Total edges).

---

## 16. Current Scene Graph & Scene State Export / Import

- **Reference projection utility:** Compact Origin / Center buttons in Diagnostics (`sceneGraphPanel.js`) activate non-mutating 3D/2D projection highlights via `projectionLinking.js` and `sceneGraphHighlight.js`. The old Scene Graph tree UI is gone.
- **Scene State Export/Import:** Managed via **File** menu (**Export Scene State** and **Import Scene State…**). Canonical Schema v1 exports annotations, measurement history, active measurement, and coordinate metadata. Raw Body Evidence, Side measurements, 2D refinement state, and Body Graph are strictly excluded.

---

## 17. Current 2D Workspace and Grid Navigators

The **2D Workspace** tab (`#workspace-tab-split`, mode `split`) presents a side-by-side view of the 3D space and the 2D navigators (default 36% 3D / 64% 2D split with draggable divider):
- **Front Surface Navigator (X/Y):** 0–200 cm X/Y domain, 10 cm base lattice with 5 cm regional refinement, shared canonical measurement overlay, projected annotations, and Front segmentation overlay.
- **Side Evidence Navigator (U/Y):** 0–200 cm U/Y domain, 10 cm base lattice with 5 cm regional refinement, Side Core/Secondary markers, local Side A/B measurement, and Side segmentation overlay.

---

## 18. Current Dense Evidence Layout & Numeric QA Core v0 Features

Milestone 3.2 establishes deterministic layout contracts, numeric QA evaluators, cross-modal evidence qualification, and runtime integration for dense multi-channel tensors (Pointmap and Surface Normals):

### 1. Dense Layout / Pixel Index Contract v0
- **Supported Layouts:** `HWC_INTERLEAVED`, `CHW_PLANAR`, and `UNKNOWN` (exported from `src/features/bodyEvidencePackage.js`).
- **Deterministic Resolution (`resolveDenseTensorLayout`):**
  - Shape `[H, W, 3]` $\to$ `HWC_INTERLEAVED` with normalized shape `[H, W, 3]`.
  - Shape `[3, H, W]` $\to$ `CHW_PLANAR` with normalized shape `[H, W, 3]`.
  - Ambiguous / unproven shapes (e.g. `[H, W]`) $\to$ `UNKNOWN` with normalized shape `null`.
- **Declared Shape Preservation:** Original `declaredShape` is preserved alongside `shape` and `denseLayout`.
- **Read-Only Indexing Helpers:**
  - `getDenseVectorElementIndex(row, col, channel, height, width, layout)`: Computes the 1D buffer index for a specific vector element.
  - `readDenseVector(buffer, row, col, height, width, layout, target)`: Reads a 3-element vector into a target array without memory allocation.
- **Zero Mutation Invariant:** Source buffers are never transposed, mutated, scaled, remapped, or rewritten.

### 2. Pointmap Numeric QA Core v0
- **Contract:** `pointmap-numeric-qa-v0` (implemented in `src/features/denseEvidenceQa.js`).
- **Structural Preflight:** Verifies buffer length matches layout requirements (`widthPx * heightPx * 3`). Fails on layout `UNKNOWN` or element-count mismatch.
- **Single-Pass $O(N)$ Streaming Scan:**
  - Tracks finite elements, NaNs, $+\infty$, and $-\infty$.
  - Per-channel raw statistics (min, max, finite counts, Welford mean/variance).
  - Vector finite-state classification (fully finite vs partially non-finite).
- **Declarations:** `declaredUnits` and `declaredScale` are recorded strictly as declarations.
- **Strict Guardrails / Unvalidated Semantics:**
  - Coordinate Frame: `UNVALIDATED`
  - Scale Semantics: `UNVALIDATED`
  - Scale Applied State: `UNVALIDATED`
  - Canonical Axis Meaning: `UNVALIDATED` (Channel 0/1/2 are NOT canonical X/Y/Z; Pointmap Z is NOT canonical metrology Z).

### 3. Surface Normal Numeric QA Core v0
- **Contract:** `normal-numeric-qa-v0` (implemented in `src/features/denseEvidenceQa.js`).
- **Structural Preflight & Integrity:** Layout-aware validation for `float32`, `float64`, and `uint8` normal vectors.
- **Single-Pass Magnitude & Range Audit:**
  - Computes Euclidean vector magnitude $\|v\| = \sqrt{x^2 + y^2 + z^2}$ for fully finite vectors.
  - Tracks zero-magnitude vectors ($\|v\| = 0$).
  - Observational Near-Unit Ratio: Counts vectors with $|\|v\| - 1.0| \le 0.01$ (`NORMAL_UNIT_TOLERANCE = 0.01`). Near-unit ratio is an observational metric only and does not imply valid surface orientation.
  - Declared Range Audit: Compares raw values against `declaredRange` (e.g. `[-1, 1]` or `[0, 255]`) and reports violation counts.
  - Raw `uint8` Preservation: Raw `uint8` values are never heuristically remapped or normalized to $[-1, 1]$ in v0.
- **Strict Guardrails / Unvalidated Semantics:**
  - Coordinate Frame: `UNVALIDATED`
  - Orientation Semantics: `UNVALIDATED`
  - Encoding Semantics: `UNVALIDATED`

### 4. Same-View Cross-Modal Dense QA v0
- **Contract:** `same-view-dense-cross-modal-qa-v0` (implemented in `src/features/denseEvidenceQa.js`).
- **View Independence:** Front and Side views are evaluated completely independently.
- **Pairwise Raster Compatibility:** Verifies dimension matching across `segmentation ↔ pointmap`, `segmentation ↔ normals`, and `pointmap ↔ normals`.
- **Pixel Addressability:** Validates that 2D raster coordinates can address all present dense modalities.
- **Semantic Correspondence:** Explicitly marked `UNVALIDATED` (no geometric correspondence claim).
- **Observational Mask Scanning:** Single-pass streaming scan computing finite counts, ratios, and joint finite correlation across 3 groups:
  - `background` (`classId === 0`) — dense values in background are recorded observationally without negative quality penalty.
  - `nonBackground` (`classId !== 0`).
  - `bodyAnatomical` — canonical 13 body classes owned authoritatively by `src/features/anatomicalRegions.js` (`BODY_ANATOMICAL_CLASS_IDS`).

### 5. Runtime Integration & Lifecycle v0
- **Runtime State Ownership:** Derived dense QA is stored in `src/features/bodyEvidence.js` as runtime analysis state `denseEvidenceQa = { front, side } | null` (not part of immutable `body-evidence-package-v0` schema).
- **Asynchronous Lifecycle:** Automatic asynchronous dense QA evaluation is triggered upon package analysis. Callers/tests can await completion via `analyzeLoadedBodyEvidenceAsync()`.
- **Single-Decode Buffer Reuse:** Dense buffers are decoded via `getDenseData({ cache = false })` at most once per modality per same-view analysis pass. Decoded read-only typed arrays are passed directly to pure synchronous buffer evaluators, avoiding duplicate 48MB allocations.
- **Stale Async Protection:** Session counter (`currentAnalysisSessionId`) prevents stale asynchronous resolutions from overwriting newer package state.
- **Public Getters:** `getDenseEvidenceQa()`, `getFrontDenseEvidenceQa()`, `getSideDenseEvidenceQa()`.
- **Sanitized Diagnostic Export:** `buildBodyEvidenceExport()` includes sanitized, JSON-safe dense QA summaries in `views.front.denseQa`, `views.side.denseQa`, and top-level `denseQa: { front, side }` without raw typed arrays, base64 data, or functions.
- **Separation of Concerns:** `package.qa.numericValues` inside `body-evidence-package-v0` remains strictly deferred/unvalidated, while derived runtime QA resides in `denseEvidenceQa`.
- **UI State:** A dedicated Dense Evidence QA inspection panel is **intentionally deferred**. Live Advanced QA shows intake identity and calibration only. The unmounted Package QA HTML helper still encodes deferred pointmap/normal geometry flags (`VALIDATION PENDING` / `DEFERRED`) for tests.

---

## 19. Measurement Taxonomy, Capability Audit & Direct Body Measurements Contract v0

### 1. Measurement Taxonomy & 11 Formal Geometry Families
A formal measurement taxonomy and capability audit established 11 distinct geometric families:
1. **Transverse Width**: 2D horizontal transverse extent across Front image plane (e.g. `Torso Transverse Width at Shoulder Level`).
2. **AP Depth / Projection**: 2D horizontal profile extent across Side image plane (e.g. `Torso AP Depth Estimate at Shoulder Level`).
3. **Vertical Height**: Absolute vertical coordinate from physical ground contact plane (DEFERRED under `NEEDS_GROUND_REFERENCE`).
4. **Vertical Inter-Level Distance**: Calibrated vertical difference $\Delta Y = |Y_A - Y_B|$ between two validated anatomical reference levels.
5. **Landmark-to-Landmark Projected Distance**: Calibrated 2D Euclidean chord length $\sqrt{(X_A - X_B)^2 + (Y_A - Y_B)^2}$ between two promoted Front landmarks.
6. **Segment / Kinematic Chain Length**: Compound path length summing consecutive constituent projected 2D segment lengths.
7. **Circumference / Girth**: Closed perimeter around cross-sectional body boundary (NOT IMPLEMENTED).
8. **Partial Surface Arc**: Open surface contour/geodesic across body topography (NOT IMPLEMENTED / DEFERRED).
9. **Coordinate / Semantic Location**: Spatial point coordinates in canonical metrology space (e.g. landmark annotations, reference levels).
10. **Angular Measurement**: 2D projected or 3D joint/collinearity angles (e.g. Side T-pose 2D projected elbow deviation).
11. **Invalid / Non-Geometric Historical Definitions**: Historical or heuristic definitions lacking sound geometric formulation (strictly rejected).

### 2. Critical Semantic Naming Rule
Every measurement name must unambiguously distinguish:
- **Anatomical region** (e.g. `Torso`, `Arm`, `Leg`)
- **Measurement quantity** (e.g. `Transverse Width`, `AP Depth Estimate`, `Inter-Level Distance`, `Segment Length`)
- **Anatomical reference level** (e.g. `at Shoulder Level`, `at Hip Level`, `Neck to Hip`)

*Example*: `Torso Transverse Width at Shoulder Level` must remain strictly distinct from skeletal `Biacromial Shoulder Breadth` and from any future `Shoulder Circumference`.

### 3. Source-Verification Corrections
Empirical source-verification audit corrected several legacy assumptions:
- **Landmark Measurement Lines (`bodyMeasurementLines.js`)**: Confirmed as display/evidence geometry only; existing candidate lines are **NOT** authoritative measurement contracts and must not be described as already-supported named physical measurements.
- **Stature Semantics**: Declared subject stature ($169.0\text{ cm}$ in current capture) is `known_subject_height` supplied as metric calibration input provenance, **NOT** an independently measured optical stature output.
- **Ground / Floor Reference**: Canvas bottom edge ($Y = 0\text{ cm}$) represents standardized metrology workspace coordinate boundary, **NOT** a verified subject floor/contact plane. Absolute anatomical heights from floor remain explicitly deferred under `NEEDS_GROUND_REFERENCE`.
- **Relative Vertical Distances**: Differences between two validated anatomical levels ($|Y_A - Y_B|$) are mathematically valid calibrated relative distances because global canvas placement offsets cancel out.
- **Anatomical Level Scope**: Exactly 7 reference levels are validated: `neck`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`. Torso sub-levels (`bust`, `underbust`, `chest`, `waist`, `abdomen`, `crotch`, `buttock maximum / seat plane`) remain strictly **deferred** (no landmark anchors; no synthetic proportional percentages).
- **Authoritative Width / Depth / Cross-Section Evidence**:
  - Front Transverse Width supported at Shoulder Level (`Torso Transverse Width at Shoulder Level`) and Hip Level (`Torso Transverse Width at Hip Level`). Generic "Shoulder Width" / "Hip Width" descriptions are prohibited.
  - Side AP Depth supported/qualified at Shoulder Level (`Torso AP Depth Estimate at Shoulder Level`) and Hip Level (`Torso AP Depth Estimate at Hip Level`).
  - Cross-Section Evidence v0 (`cross-section-evidence-v0`) pairs qualified Front transverse width and Side AP depth at matching reference levels.
  - Cross-Section Evidence is **NOT** a reconstructed 3D slice, ellipse, circumference, volume, or canonical Z geometry. Shoulder cross-section must not be called Shoulder Circumference; Hip cross-section must not be equated with maximum Hip/Seat Circumference (current bilateral hip landmark level is not yet qualified as the maximum buttock/seat plane).

### 4. Direct Body Measurements Contract v0 (`direct-body-measurements-v0`)
Pure deterministic domain contract implemented in `src/features/directBodyMeasurements.js`, integrated at runtime in `src/features/bodyEvidence.js`, and rendered in `src/ui/derivedMeasurementDeck.js`. Supports 19 Batch A direct measurements:

- **Vertical Inter-Level Measurements (5)** (Semantics: `calibrated_relative_vertical_distance`, Formula: $|Y_A - Y_B|$):
  1. `vertical_torso_length_neck_to_hip`: Vertical Torso Length (Neck to Hip)
  2. `vertical_shoulder_drop_neck_to_shoulder`: Vertical Shoulder Drop (Neck to Shoulder)
  3. `vertical_thigh_length_hip_to_knee`: Vertical Thigh Length (Hip to Knee)
  4. `vertical_lower_leg_length_knee_to_ankle`: Vertical Lower Leg Length (Knee to Ankle)
  5. `vertical_total_leg_length_hip_to_ankle`: Vertical Total Leg Length (Hip to Ankle)

- **Projected Landmark Segment Measurements (10, Left/Right independently)** (Semantics: `calibrated_projected_2d_distance`, Formula: $\sqrt{(X_A - X_B)^2 + (Y_A - Y_B)^2}$):
  - `left_upper_arm_segment_length_projected` / `right_upper_arm_segment_length_projected`: Upper Arm Segment Length (Projected)
  - `left_forearm_segment_length_projected` / `right_forearm_segment_length_projected`: Forearm Segment Length (Projected)
  - `left_direct_arm_chord_projected` / `right_direct_arm_chord_projected`: Direct Arm Chord (Shoulder to Wrist, Projected)
  - `left_thigh_segment_length_projected` / `right_thigh_segment_length_projected`: Thigh Segment Length (Projected)
  - `left_lower_leg_segment_length_projected` / `right_lower_leg_segment_length_projected`: Lower Leg Segment Length (Projected)

- **Kinematic Chain Measurements (4, Left/Right)** (Semantics: `calibrated_projected_2d_chain_length`, Formula: $\sum d_{2D}$ of constituent segments):
  - `left_total_arm_chain_length_projected` / `right_total_arm_chain_length_projected`: Total Arm Kinematic Chain Length (Projected) ($d(\text{Shoulder}, \text{Elbow}) + d(\text{Elbow}, \text{Wrist})$)
  - `left_total_leg_chain_length_projected` / `right_total_leg_chain_length_projected`: Total Leg Kinematic Chain Length (Projected) ($d(\text{Hip}, \text{Knee}) + d(\text{Knee}, \text{Ankle})$)

- **Strict Guardrails**: Front A-pose calibrated projected 2D distances only. Must **NOT** be described as true 3D anatomical lengths, skeletal bone lengths, or surface distances. Zero bilateral averaging is performed.

### 5. Direct Measurement Qualification Semantics
- **`valid`**: All required evidence exists, is finite, and Front metric calibration is validated.
- **`unavailable`**: Required evidence is missing or insufficient (e.g. missing landmark, unready anatomical level, unvalidated calibration).
- **`invalid`**: Evidence exists but contains corrupted or non-finite coordinate values.
- **Kinematic Chain Rule**: A kinematic chain strictly requires **all** constituent segments to evaluate to `valid`. If any constituent segment is `unavailable` or `invalid`, the chain measurement cannot be valid.

### 6. Deferred Measurement Batch B (Bilateral Spans & Breadths)
Candidates for future direct measurement expansion remain intentionally deferred:
- Candidate definitions: Biacromial Shoulder Breadth, Inter-Hip Landmark Breadth, Bilateral Elbow Span, Bilateral Wrist Span, Bilateral Knee Span, Bilateral Ankle Span, Neck Transverse Width.
- Deferral rationale: Formal semantic decision is required between horizontal $\Delta X = |X_{\text{left}} - X_{\text{right}}|$ breadth versus 2D Euclidean projected chord length $\sqrt{\Delta X^2 + \Delta Y^2}$ when bilateral landmarks exhibit vertical elevation delta ($\Delta Y > 0$).
- Batch B is **NOT** marked as implemented.

### 7. Circumference Modeling & Maximum Seat Plane Localization
- **Modeled Hip / Seat Circumference Estimate**: Implemented at the evidence-driven Maximum Seat Plane using the Ramanujan II ellipse model (`modeledHipSeatCircumference.js`).
- **Maximum Seat Plane Localization**: Localized deterministically by scanning candidate $Y$ levels across the pelvic region (`pelvicArbitraryYEvidenceScan.js`), qualifying Side AP depth (`arbitraryYSidePhysicalDepthQualification.js`), and selecting the plane maximizing candidate cross-sectional perimeter (`maximumSeatPlaneLocalization.js`).
  - The seat plane is evidence-driven, **NOT** a fixed offset from Hip Landmark Y.
  - Sample runtime verification: $Y \approx 79.95\text{ cm}$, Front width $\approx 44.30\text{ cm}$, Side AP depth $\approx 27.40\text{ cm}$, modeled circumference $\approx 114.20\text{ cm}$ (sample evidence, not hardcoded algorithm constants).
- **Strict Metrological Semantics**:
  - Modeled estimate from orthogonal silhouette extents; **NOT** a measured closed contour, **NOT** tape-measured ground truth, and **NOT** a reconstructed 3D slice.
  - Old `Hip Landmark Perimeter Estimate` ($110.98\text{ cm}$ at $Y = 86.25\text{ cm}$) is hidden from standard Results UI but retained internally for QA/programmatic access.
- **Deferred Torso Levels**: Bust, underbust, natural waist, and abdomen levels and circumferences remain explicitly **deferred** pending dedicated plane localization.

### 8. Measurement Visualization Provenance & Interactive Highlight Architecture
- **Contract**: `measurement-visualization-provenance-v0` (`src/features/measurementVisualizationProvenance.js`).
- **Declarative Normalization**: Translates domain measurement records into standardized 2D visualization instructions across 7 types:
  - `front_horizontal_slice`
  - `side_horizontal_slice`
  - `cross_view_horizontal_slice`
  - `landmark_segment`
  - `landmark_chain`
  - `vertical_level_interval` (upper/lower level lines, vertical connector, distance badge)
  - `front_horizontal_level`
- **Interactive Flow**: Results click (`[data-measurement-id]`) $\to$ `selectMeasurement(id)` $\to$ `resolveMeasurementVisualizationProvenance` $\to$ `setMeasurementHighlight` $\to$ focuses 2D workspace (`WORKSPACE_SPLIT`) $\to$ `.is-selected` UI state. Toggle-off and package-change clearing supported.
- **Modeled Ellipse Preview**: Visual-only companion SVG preview for Modeled Hip / Seat Circumference displaying Front width $\times$ Side AP depth ellipse with disclaimer `"Ellipse model — not measured contour"`.

### 9. Future Development — VTON Relevance Mapping
- Purpose: Map validated body measurements to downstream sizing, grading, garment fitting, garment anchoring (neckline, shoulder seams, waistbands, hemlines), sleeve placement, bust/underbust fitting, and pelvic/seat fitting.
- Strict boundary: VTON Relevance Mapping is an application-layer consumer of metrology outputs and must **never** redefine measurement geometry or semantics. Marked **INACTIVE / FUTURE**.

---

## 20. Important Do-Not-Break Rules

When modifying this project, preserve the following unless explicitly instructed otherwise:

- **Do not change the coordinate scale** (1 scene unit = 1 cm)
- **Do not change cube dimensions** (200 × 200 × 200 cm)
- **Do not change internal sampling logic** (5 cm, 68,921 points)
- **Do not break app mode separation** (Inspect & Measure vs Annotate)
- **Do not break two-point distance measurement** in Inspect & Measure mode
- **Do not break Front/Side measurement separation** — Side measurement is local U/Y only and never enters canonical measurement history or Scene State
- **Do not promote Side landmarks** — Side candidates are non-promotable and lack canonical 3D depth
- **Do not break Full Body Evidence Package Contract v0** — package normalization, ZIP transport isolation, and automatic analysis
- **Do not break Dense Layout / Pixel Index Contract v0** — layout resolution, layout-aware vector indexing, zero buffer mutation
- **Do not break Front–Side Alignment v0 contract** — semantic landmark identity matching and vertical Y delta QA only; no 3D geometry reconstruction or U→Z conversion
- **Do not break Body Graph Contract v0** — Core 13 nodes and 13 structural edges derived strictly from promoted Core 13 `body_landmark` annotations
- **Do not serialize Body Graph or raw Body Evidence into Scene State JSON**
- **Do not break View menu checked-state indicators** — indicators must reflect authoritative runtime query (`getViewSetting`)
- **Do not break 2D Workspace split layout** — Front X/Y and Side U/Y navigators with draggable divider
- **Do not break Measurement Visualization Provenance v0 contract** — declarative normalizer decoupled from renderers

### Explicitly NOT Implemented (Current Scope Boundaries)

1. **Spatial 3D Fusion / Registration:** No 3D spatial fusion between Front X/Y and Side U/Y coordinates.
2. **U → Z Conversion / Canonical Side Depth:** Side U coordinates are profile evidence only and are not mapped to 3D Z depth.
3. **Pointmap Z → Canonical Z:** Pointmap Z coordinates are not treated as canonical metrology Z.
4. **Pointmap / Normal 3D Promotion:** Pointmap and normal evidence packages are accepted normalized inputs with numeric QA. Milestone 4.5G classifies recognized Sapiens pointmaps as camera-frame geometric evidence (`status: 'partial'`, `authorized: false`); they are not promoted into authoritative physical body geometry or 3D reconstruction. Front and Side pointmaps do not share a coordinate frame.
5. **Side Landmark Promotion:** Side landmarks cannot be promoted to 3D annotations.
6. **Derived / Composite Anatomical Regions:** No multi-class region unions or synthetic bounding volumes in v0.
7. **Segmentation-Derived Physical Geometry:** Segmentation-derived Front Transverse Width and Side Profile Span are implemented as metric-projected image-plane observations. Cross-Section Evidence v0 pairs qualified Front transverse width and Side AP depth observations at Shoulder and Hip reference levels.
8. **Contour Extraction:** No polygon extraction.
9. **3D Reconstruction / Mesh Generation:** No point cloud generation, mesh surface reconstruction, or volumetric body partitioning.
10. **Dense 3D Contours / Measured Anthropometric Girths:** The five active modeled perimeters (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat) are deterministic mathematical ellipse models (Ramanujan II) derived from orthogonal Front width and Side AP depth; they are not tape-measured ground truth, measured body contours, or reconstructed 3D surface perimeters. Underbust circumference remains deferred pending inframammary fold localization.
11. **Dense Evidence QA UI Panel:** Dedicated Dense Evidence QA inspection panel in the UI is intentionally deferred.
12. **Absolute Height from Floor:** Absolute heights from floor deferred under `NEEDS_GROUND_REFERENCE` (canvas $Y = 0$ is not a verified ground contact plane).
13. **Measured Optical Stature:** Declared stature ($169.0\text{ cm}$) is `known_subject_height` calibration input provenance, not measured optical stature.
14. **Bilateral Limb Averaging:** Bilateral left and right limb measurements are evaluated independently without averaging.
15. **Bilateral Transverse Spans vs Chord Distance:** Batch B bilateral spans are evaluated strictly as calibrated horizontal breadths $\text{valueCm} = |X_R - X_L|$; they are not diagonal Euclidean chords $\sqrt{\Delta X^2 + \Delta Y^2}$. Vertical elevation asymmetry is preserved as evidence only.
16. **Neck Transverse Width vs Neck Circumference:** Neck Transverse Width is implemented as a Front-plane transverse silhouette width at Neck Level (`neck_core_support_v0`); it is strictly distinct from Neck Base Landmark Breadth and Neck Circumference.
17. **Torso Sub-Levels:** Underbust, inframammary fold, and crotch levels remain deferred.
18. **VTON Relevance Mapping:** Virtual try-on mapping is an application-layer consumer and not part of core measurement geometry.

---

## 21. Metrology Roadmap & Verification Baseline

### Completed Milestones
- **3D Metrology Coordinate Cube & Volumetric Lattice Sampling (5 cm, 68,921 points)**
- **Inspect & Measure Mode (Canonical Point A/B distance measurement and history)**
- **Annotate Mode (Semantic 3D annotations and Landmark Presets)**
- **Front Surface 2D Grid Navigator (X/Y) & Side Evidence 2D Navigator (U/Y)**
- **Body Landmark Measurement Picking v0 (Promoted body landmarks as valid A/B targets)**
- **Front Landmark Manual Promotion (Front-only canonical promotion with fixed front-surface Z)**
- **Front–Side Alignment Contract v0 (Pure semantic correspondence & vertical Y QA)**
- **Body Graph Contract & Workspace v0 (Deterministic Core 13 topological diagram)**
- **Measurement Reference Levels & Anatomical Measurement Lines v0 (Readiness & Preview Overlays)**
- **Segmentation Normalization + QA Contract v0 (Front/Side parsing, classes[], retained rasters, export safety)**
- **Segmentation Region Preview / Inspection v0 (2D translucent overlays, View toggles, class lists, highlighting)**
- **Anatomical Region Contract v0 (Deterministic 29-class observed ontology, categories, metrology eligibility)**
- **Pixel-to-Metrology Mapping Core v0 (Pure resolution-independent mapping, center vs edge math, Y inversion, validation, row & span mapping)**
- **Anatomical Region Metric Bounds v0 (Observed region metric boundsCm derived from runtime raster dimensions)**
- **Full Body Evidence Package Contract v0 (Canonical multi-modal package contract, Front/Side views, ZIP transport adapter, Package QA summary UI, automatic analysis)**
- **Pointmap + Normal Evidence Contract / QA v0 (Dense Layout Contract, Pointmap Numeric QA Core, Surface Normal Numeric QA Core, Same-View Cross-Modal QA Core, Dense QA Runtime Integration)**
- **Milestone 4.1: Anatomical Level Contract v0 (`anatomical-levels-v0` — 7 reference levels: neck, shoulder, elbow, wrist, hip, knee, ankle; 3-state readiness model)**
- **Milestone 4.2: Anatomical Region Evidence Association Contract v0 (`anatomical-region-evidence-v0` — 13 canonical `body_anatomical` regions, laterality, metric bounds, landmark & level adjacency, 4.2C dense stats deferred)**
- **Milestone 4.3: Front Measurement Foundation v0 (`front-horizontal-raster-slice-v0` single-row O(W) scan & `front-transverse-width-v0` transverse torso widths at shoulder/hip levels under measurement support policies and `single_run_required` policy)**
- **Milestone 4.4A: Side Horizontal Raster Slice Contract v0 (`side-horizontal-raster-slice-v0` — pure single-row O(W) streaming scan across Side segmentation raster returning contiguous horizontal runs in U/Y metrology space with normalized and metric U bounds)**
- **Milestone 4.4B: Side Profile Span Interpretation Contract v0 (`side-profile-span-v0` — pure interpretation of Side raster slice evidence into formal profile spans under measurement support policies and `single_run_required` policy with `getSideProfileSpan` and `getSideProfileSpans` runtime getters)**
- **Milestone 4.5A: Cross-view Measurement Correspondence Contract v0 (`cross-view-measurement-correspondence-v0` — pure deterministic correspondence layer pairing Front transverse width and Side profile span observations at matching validated reference levels under registry-driven definitions with `getCrossViewMeasurementCorrespondence` and `getCrossViewMeasurementCorrespondences` runtime getters)**
- **Milestone 4.5B: Cross-view Comparability QA v0 (`cross-view-comparability-qa-v0` — pure deterministic QA evaluating whether 4.5A correspondence pairs are sufficiently qualified and internally consistent for later cross-view use across 10 inspectable checks with `getCrossViewComparabilityQa` and `getCrossViewComparabilityQaReport` runtime getters)**
- **Milestone 4.5C: Shared Metric Calibration & Physical Measurement Semantics v0 (`metric-calibration-provenance-v0` & `physical-measurement-semantics-v0` — pure deterministic validation of upstream calibration claims across Front and Side views, establishing 3 semantic tiers: workspace span, metric projected span, and physical span; validated on packages with Align calibration provenance)**
- **Measurement Support Policy v0 (`measurement-support-policy-v0` — centralized deterministic observed supported silhouette definitions `neck_core_support_v0` [3, 22, 23], `trunk_core_support_v0` [22, 23], `pelvic_core_support_v0` [12, 13, 21, 22], and `trunk_pelvic_transition_support_v0` [12, 13, 21, 22, 23], tracking `supportPolicyId`, `actualClassIdsUsed`, `clothingClassIdsUsed`, and `usedClothingEvidence: boolean` without run merging or gap filling)**
- **Milestone 4.5D: Physical Measurement Eligibility Contract v0 (`physical-measurement-eligibility-v0` & `paired-cross-view-eligibility-v0` — authoritative downstream eligibility gate determining whether metric-projected measurements are qualified to be consumed as true physical body scalars across Tier 1 individual and Tier 2 paired evaluations, preserving multi-blocker diagnostics and decoupled physical-value provenance)**
- **Milestone 4.5E: Authoritative View / Pose Semantics Validation v0 (`view-pose-semantics-v0` — pure deterministic domain qualification layer verifying Layer A declared view identity, Layer B 2D structural pose qualification with `LOW_CONFIDENCE_THRESHOLD = 0.5`, anatomical vertical ordering, and Front A-pose limb separation, while strictly requiring recognized evaluators for Layer C physical orientation certification; evaluates to `status: 'partial'`, `authorized: false` on current Body Pipeline evidence)**
- **Milestone 4.5F: Clothing / Body-Surface Authorization v0 (`clothing-body-surface-semantics-v0` — pure deterministic domain qualification layer governing Layer A clothing participation from measurement support policy provenance, Layer B visual garment qualification with canonical `garmentFitStatus` taxonomy, and Layer C authoritative empirical body-surface authorization; derives the composite `clothingConstraintSatisfied` gate consumed by 4.5D to keep or clear the `clothing_authorization_missing` blocker; evaluates to `status: 'partial'`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false` on current Body Pipeline evidence)**
- **Milestone 4.5G: Authoritative Physical Evidence Semantics v0 (`authoritative-physical-evidence-semantics-v0` — COMPLETED at evidence-authority / semantics scope; classifies dense pointmap evidence by authority without creating body measurements; implemented evaluator `sapiens-pointmap-camera-frame-evaluator-v0` classifies current Sapiens Front/Side pointmaps as `availability: present`, `status: 'partial'`, `evidenceClass: 'camera_frame_geometric'`, `authorized: false`; authoritative physical-geometry evaluator registry is empty; `validated-dense-geometry-v0` remains reserved and is not enabled. This does not establish authoritative physical body geometry)**
- **Application Shell / UI Modernization Checkpoint** — workflow-driven Left Sidebar; Right Sidebar Results / Session Records / Diagnostics accordions; Hist / Annos / Body / Graph tabs removed; Subject / Package and Current Selection cards removed; documentation synchronized to the cleaned implementation.
- **Measurement Placement Audit Checkpoint — COMPLETED** — Strict read-only audit of Shoulder and Hip measurement placement and semantics verified current runtime behavior: Shoulder uses `trunk_core_support_v0` (`[22, 23]`) and means supported transverse silhouette width at bilateral shoulder landmark Y (not landmark-to-landmark / biacromial breadth); Hip uses `pelvic_core_support_v0` (`[12, 13, 21, 22]`) and slices strictly at bilateral mean hip landmark Y (no search for maximum hip breadth, buttock projection, or seat plane); Side measurements remain projected Side-U profile spans without physical depth promotion; 402 unit tests verified with zero algorithmic changes.
- **Milestone 4.5H: Side Physical Depth Qualification v0 (`side-physical-depth-qualification-v0` — pure deterministic domain qualification evaluating when valid Side profile spans qualify as side-derived physical AP depth estimates; integrates Side T-pose stance `side-t-pose-qualification-v0`, approximately-lateral orientation `side-view-orientation-qualification-v0` via bilateral collapse consensus, metric calibration, and fitted-clothing/body-surface authorization; evaluates 2D projected elbow deviation without claiming anatomical elbow flexion; treats moderate projected elbow deviation in the 30°–45° warning range as an advisory diagnostic signal; Shoulder depth is anchored at bilateral mean shoulder landmark level; Hip depth is anchored at bilateral mean hip landmark level)**
- **Milestone 4.5I: Cross-Section Evidence v0 (`cross-section-evidence-v0` — pure deterministic compositional evidence layer combining already-qualified Front transverse width, qualified Side AP physical depth, matching anatomical reference level, cross-view correspondence, comparability QA, and metric calibration compatibility; supported levels: exactly `shoulder` and `hip` only; verified Shoulder: Front Transverse Width 30.80 cm, Side AP Depth 11.00 cm -> QUALIFIED; verified Hip: Front Transverse Width 42.20 cm, Side AP Depth 27.70 cm -> QUALIFIED; preserves Side T-pose advisory ~44.2° projected elbow semantics; pure evidence pairing only: does NOT compute circumference, assume an ellipse, reconstruct a 3D slice/contour, or fuse pointmaps)**
- **Milestone 4.5J: Measurement Taxonomy & Capability Audit v0 (`measurement-taxonomy-audit-v0` — established 11 formal geometric families and strict anatomical region / quantity / reference level naming rules)**
- **Milestone 4.5K: Measurement Source-Verification & Correction Pass — COMPLETED (`bodyMeasurementLines.js` verified display-only; declared stature verified calibration input, not measured output; ground reference floor heights deferred under `NEEDS_GROUND_REFERENCE`; relative vertical distances $|Y_A - Y_B|$ validated; 7 reference levels validated; sub-levels deferred; Shoulder/Hip authoritative width/depth/cross-section evidence verified)**
- **Milestone 4.5L: Clear Measurements v0 — Batch A (`direct-body-measurements-v0` — pure deterministic evaluation of 19 direct Front measurements across 5 vertical inter-level, 10 projected landmark segment, and 4 kinematic chain measurements; `valid` / `unavailable` / `invalid` qualification statuses; all constituent segments required for chain validity; Front A-pose calibrated 2D projected distances, not 3D lengths/bones/surfaces; zero bilateral averaging)**
- **Milestone 4.5M: Results Right-Sidebar Usability & Accordion Cleanup — COMPLETED (collapsible Results deck with Cross-Section Evidence and Direct Measurements parent subgroup; Session Records ordered Annotations then History with embedded Clear History; Diagnostics separated)**
- **Milestone 4.6A: Modeled Cross-Section Perimeter v0 (`modeled-cross-section-perimeter-v0` — pure deterministic ellipse-modeled perimeter evaluation at Hip Landmark Level only using Ramanujan II; downstream from qualified `cross-section-evidence-v0`; verified sample $W = 42.20\text{ cm}, D = 27.70\text{ cm} \implies 110.98\text{ cm}$; explicit modeled/not-anthropometric semantics; Shoulder explicitly unsupported; retained internally for QA and shared perimeter calculation)**
- **Milestone 4.6B: Pelvic Arbitrary-Y Evidence Scan v0 (`pelvic-arbitrary-y-evidence-scan-v0` — pure deterministic scanner extracting continuous Front transverse width evidence across pelvic region)**
- **Milestone 4.6C: Arbitrary-Y Side Physical AP Depth Qualification v0 (`arbitrary-y-side-physical-depth-qualification-v0` — pure deterministic qualification of Side AP depth across scanned arbitrary pelvic Y levels)**
- **Milestone 4.6D: Maximum Seat Plane Localization v0 (`maximum-seat-plane-localization-v0` — evidence-driven localization ranking valid same-Y Front width + qualified Side AP depth by Ramanujan II modeled perimeter score; localizes seat plane at $Y \approx 79.95\text{ cm}$ on sample capture)**
- **Milestone 4.6E: Modeled Maximum Seat Circumference Estimate v0 (`modeled-hip-seat-circumference-v0` — primary user-facing modeled circumference at Maximum Seat Plane; $114.20\text{ cm}$ on sample capture)**
- **Milestone 4.7: Measurement Visualization Provenance v0 (`measurement-visualization-provenance-v0`) & 2D Measurement Highlight Overlay (`measurementHighlightOverlay2d.js` — pure declarative normalizer converting domain records into 2D highlights across supported visualization types; clean geometry rendering with lines, guides, and dots; interactive click-to-highlight flow with `.is-selected` state and automatic clearing)**
- **Milestone 4.8: Modeled Ellipse Cross-Section Preview (`modeledEllipseCrossSectionPreview.js` — visual-only companion SVG preview for Modeled Circumferences with disclaimer `"Ellipse model — not measured contour"`)**
- **Milestone 4.9: Batch Landmark Promotion (`promoteAllFrontCoreLandmarks` — one-click idempotent batch promotion for all Core 13 front landmarks in Body Evidence panel)**
- **Milestone 4.10: Torso Arbitrary-Y Evidence Scan v0 (`torso-arbitrary-y-evidence-scan-v0` — pure deterministic scanning of continuous Front single-run width and Side qualified AP depth across the anatomical shoulder-to-hip column under resolution-independent mapping)**
- **Milestone 4.11: Natural Waist Plane Localization v0 (`natural-waist-plane-localization-v0` — pure deterministic waist plane localization at $Y = 107.15\text{ cm}$)**
- **Milestone 4.12: Natural Waist 2D Provenance Visualization & Diagnostics UI (`measurementVisualizationProvenance.js`, `measurementHighlightOverlay2d.js`, `bodyTabConsolidatedPanel.js` — interactive card under Diagnostics → Body / Anchor Diagnostics; full-width canonical-Y guide + Front/Side slice lines)**
- **Milestone 4.13: Modeled Natural Waist Circumference v0 (`modeled-natural-waist-circumference-v0` — pure deterministic domain contract deriving an ellipse-modeled Natural Waist circumference estimate from already-localized Natural Waist plane [$Y = 107.15\text{ cm}$] and qualified Front width [$29.00\text{ cm}$] + Side AP depth [$23.20\text{ cm}$] using Ramanujan II; $82.2488\text{ cm}$ runtime evaluation, displayed as $82.25\text{ cm}$; strict Front-only rejection gate; embeds `natural-waist-cross-section-evidence-v0`; live Results sidebar renders Modeled Natural Waist Circumference card; generalized 2D ellipse preview displays Front width $\times$ Side AP depth with disclaimer `"Ellipse model — not measured contour"`)**
- **Milestone 4.14: Abdominal Apex Plane Localization v0 & Modeled Abdominal Circumference v0 — HISTORICAL BASELINE (`abdominal-apex-plane-localization-v0`, `modeled-abdominal-circumference-v0` — historical baseline-relative abdominal prominence localization at $Y = 95.75\text{ cm}$; superseded in production by Abdominal Point v1 while retained for compatibility)**
- **Milestone 4.15: Bust Apex Plane Localization v0 — HISTORICAL BASELINE (`bust-apex-plane-localization-v0` — historical baseline-relative bust prominence localization at $Y = 123.85\text{ cm}$; superseded in production by Bust Point v1 while retained for compatibility)**
- **Milestone 4.18: Bust Point Plane Localization v1 & Modeled Bust Circumference v0 (`bust-point-plane-localization-v1`, `modeled-bust-circumference-v0` — production raw anterior breast extrema localization at $Y = 119.15\text{ cm}$ with Front width $35.10\text{ cm}$, Side qualified AP depth $30.20\text{ cm}$, Modeled Bust Circumference evaluating to $102.72\text{ cm}$)**
- **Milestone 4.19: Abdominal Point Plane Localization v1 & Modeled Abdominal Circumference v0 (`abdominal-point-plane-localization-v1`, `modeled-abdominal-circumference-v0` — production raw anterior abdominal extrema localization at $Y = 96.85\text{ cm}$ with Front width $36.90\text{ cm}$, Side qualified AP depth $25.80\text{ cm}$, Modeled Abdominal Circumference evaluating to $99.26\text{ cm}$)**
- **Milestone 4.20: Buttock Point / Hip Girth Plane Localization v1 & Modeled Hip Girth v1 (`buttock-point-plane-localization-v1`, `modeled-hip-girth-v1` — production raw posterior buttock extrema localization at $Y = 86.05\text{ cm}$ with Front width $42.20\text{ cm}$, Side qualified AP depth $27.80\text{ cm}$, Modeled Hip Girth evaluating to $111.12\text{ cm}$)**
- **Milestone 4.21: Semantic Separation of Modeled Hip Girth and Modeled Maximum Seat Circumference — COMPLETED (strict separation of Hip Girth at Buttock Point Plane $86.05\text{ cm}$ [$111.12\text{ cm}$] from Maximum Seat Circumference at Maximum Seat Plane $79.95\text{ cm}$ [$114.20\text{ cm}$])**
- **Milestone 4.22: Five-Measurement Results UI & Ellipse Preview Integration — COMPLETED (all 5 active modeled perimeters rendered in canonical sequence in Results deck with dedicated 2D slice highlights and SVG ellipse preview)**
- **Milestone 4.23: Application Startup Defaults Modernization — COMPLETED (Results, Session Records, Diagnostics all collapsed at startup; Workflow = Body Evidence default; View Origin/Center and Body Measurement Previews = OFF default)**
- **Milestone 4.24: Code / Architecture Cleanup — COMPLETED (dead exports and CSS removed in Batch A; internal preview/deck routing consolidated into declarative registries in Batch B; 865/865 tests passing)**
- **Milestone 4.25: Direct Body Measurements Batch B v0 — Bilateral Spans & Breadths — COMPLETED (`direct-body-measurements-v0` — pure deterministic derivation of 6 bilateral transverse landmark spans bringing Direct Measurements total to 25; authoritative value $\text{valueCm} = |X_R - X_L|$; asymmetry preserved as $\text{elevationDeltaCm} = |\Delta Y|$; Secondary acromion landmarks distinct from Core 13 shoulders; pure horizontal 2D overlay highlight with asymmetry drop lines; Results subgroup `Bilateral Spans & Breadths` with click-to-highlight flow; 889/889 tests passing)**
- **Milestone 4.26: Neck Transverse Width v0 — COMPLETED / VERIFIED (`front-transverse-width-v0` — pure deterministic Front-plane transverse silhouette width evaluation at Neck Level; `neck_transverse_width_at_neck_level` under `neck_core_support_v0` [Face_Neck 3, Torso 22, Upper_Clothing 23]; `single_run_required` run selection policy; authoritative geometry $\text{valueCm} = \text{rightXcm} - \text{leftXcm}$; promoted `neck` landmark provides $Y_{\text{neck}}$ plane and provenance only without acting as an endpoint; zero synthetic landmarks; clothing participation tracked via `usedClothingEvidence`; dedicated Results subgroup `Front Transverse Widths` separate from Cross-Section Evidence and Direct Measurements; card layout fix with responsive stacked metadata avoiding narrow-sidebar label compression; unified click-to-highlight flow resolving to `FRONT_HORIZONTAL_SLICE` Front 2D highlight; Direct Measurements remain exactly 25; Underbust untouched; 905/905 tests passing across 47 suites)**

### Deferred Milestones & Workstreams
- **Underbust Level Localization & Underbust Circumference** (blocked by missing inframammary fold localization)
- **Absolute height-from-floor measurements (`NEEDS_GROUND_REFERENCE`)**
- **Measured optical stature**
- **Surface arcs / geodesic measurements**

### Active State & Physical Blockers
- **Current Real Evaluation State (`output.zip`)**:
  - Front Pose Semantics: `status: 'partial'`, `authorized: false` (7/8 checks pass; Layer C skipped).
  - Side Pose Semantics: `status: 'partial'`, `authorized: false` (6/8 checks pass; Layer C skipped).
  - Clothing / Body-Surface Semantics: `status: 'partial'`, `authorized: false`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false` across all 4 canonical measurements.
  - Authoritative Physical Evidence Semantics (4.5G): Front and Side independently `availability: present`, `status: 'partial'`, `evidenceClass: 'camera_frame_geometric'`, `authorized: false`, `frame.type: 'camera_local'`, `frame.sharedAcrossViews: false`. Units remain `unitAuthority: service_reported`, `physicalUnitsVerified: false`. Scale remains `predicted_focal_normalization`. Serialized pointmaps are not body-masked (`pointmap value exists` $\ne$ authorized body-surface evidence); Layer C remains unimplemented. Authoritative Physical Body Geometry: **NOT ESTABLISHED**. Cross-view Physical Geometry: **BLOCKED**.
  - 4.5D Physical Blockers remain active on all 4 canonical measurements: `clothing_authorization_missing`, `view_pose_semantics_missing`, `authoritative_physical_evidence_missing`. Current Sapiens 4.5G results cannot satisfy Dimension E (`physicalEligibility: false`, `physicalMeasurementCm: null`).
  - Metric Projected measurements remain positive and valid, and remain **Metric Projected Measurements** (not authoritative physical body measurements): Front Shoulder ($30.80\text{ cm}$), Side Shoulder ($11.00\text{ cm}$), Front Hip ($42.20\text{ cm}$), Side Hip ($27.70\text{ cm}$). Landmark-to-landmark projected spans, Front Transverse Width, and Side Profile Span remain separate.
  - Front Transverse Widths v0 evaluated: `getFrontTransverseWidths()` evaluates three distinct Front transverse silhouette widths: Neck (`neck_transverse_width_at_neck_level`, $Y_{\text{neck}}$, `neck_core_support_v0`), Shoulder (`torso_width_at_shoulder_level`, $Y_{\text{shoulder}}$, `trunk_core_support_v0`), and Hip (`torso_width_at_hip_level`, $Y_{\text{hip}}$, `pelvic_core_support_v0`).
  - Cross-Section Evidence v0 evaluated: Shoulder paired orthogonal physical observations ($30.80\text{ cm}$ Front, $11.00\text{ cm}$ Side AP Depth) evaluate to `status: 'qualified'`; Hip paired orthogonal physical observations ($42.20\text{ cm}$ Front, $27.70\text{ cm}$ Side AP Depth) evaluate to `status: 'qualified'`.
  - Modeled Cross-Section Perimeter v0 evaluated: Hip Landmark Level modeled perimeter evaluates to `status: 'modeled'`, `valueCm: 110.9830618865289` (UI: `110.98 cm`). Shoulder modeled perimeter remains strictly unsupported (`status: 'invalid'`, `valueCm: null`).
  - Modeled Bust Circumference v0 evaluated: Localized at Bust Point Plane $Y = 119.15\text{ cm}$ from Front width $35.10\text{ cm}$ and qualified Side AP depth $30.20\text{ cm}$. Evaluates to `status: 'modeled'`, `valueCm: 102.7212` (UI: `102.72 cm`).
  - Modeled Natural Waist Circumference v0 evaluated: Localized at Natural Waist Plane $Y = 107.15\text{ cm}$ from Front width $29.00\text{ cm}$ and qualified Side AP depth $23.20\text{ cm}$. Evaluates to `status: 'modeled'`, `valueCm: 82.2488` (UI: `82.25 cm`).
  - Modeled Abdominal Circumference v0 evaluated: Localized at Abdominal Point Plane $Y = 96.85\text{ cm}$ (plateau $96.15 - 97.45\text{ cm}$) from Front width $36.90\text{ cm}$ and qualified Side AP depth $25.80\text{ cm}$ under `trunk_pelvic_transition_support_v0` (`[12, 13, 21, 22, 23]`). Evaluates to `status: 'modeled'`, `valueCm: 99.2561` (UI: `99.26 cm`).
  - Modeled Hip Girth v1 evaluated: Localized at Buttock Point Plane $Y = 86.05\text{ cm}$ (plateau $86.05 - 86.15\text{ cm}$) from Front width $42.20\text{ cm}$ and qualified Side AP depth $27.80\text{ cm}$ under `pelvic_core_support_v0`. Evaluates to `status: 'modeled'`, `valueCm: 111.1168` (UI: `111.12 cm`).
  - Modeled Maximum Seat Circumference v0 evaluated: Localized at Maximum Seat Plane $Y = 79.95\text{ cm}$ from Front width $44.30\text{ cm}$ and qualified Side AP depth $27.40\text{ cm}$ (global maximum pelvic Ramanujan II score). Evaluates to `status: 'modeled'`, `valueCm: 114.1959` (UI: `114.20 cm`).
  - Batch A & Batch B Direct Measurements evaluated: 25 calibrated measurements evaluated under `direct-body-measurements-v0` (19 Batch A + 6 Batch B).
  - Accepted Real-Package Modeled Circumference Summary:
    1. **Modeled Bust Circumference**: Plane Y = $119.15\text{ cm}$, Width = $35.10\text{ cm}$, Depth = $30.20\text{ cm}$, Circumference = **$102.72\text{ cm}$**
    2. **Modeled Natural Waist Circumference**: Plane Y = $107.15\text{ cm}$, Width = $29.00\text{ cm}$, Depth = $23.20\text{ cm}$, Circumference = **$82.25\text{ cm}$**
    3. **Modeled Abdominal Circumference**: Plane Y = $96.85\text{ cm}$, Width = $36.90\text{ cm}$, Depth = $25.80\text{ cm}$, Circumference = **$99.26\text{ cm}$**
    4. **Modeled Hip Girth**: Plane Y = $86.05\text{ cm}$, Width = $42.20\text{ cm}$, Depth = $27.80\text{ cm}$, Circumference = **$111.12\text{ cm}$**
    5. **Modeled Maximum Seat Circumference**: Plane Y = $79.95\text{ cm}$, Width = $44.30\text{ cm}$, Depth = $27.40\text{ cm}$, Circumference = **$114.20\text{ cm}$**
    *(Important: These values are verification example outputs from the accepted real Body Evidence package, NOT immutable anatomical constants).*
  - Metrological Principle: `plane localization != measured circumference != 3D reconstruction`. Real-package numeric outputs are accepted verification example outputs, NOT immutable anatomical constants.
- **Strict Guardrails**: Zero coordinate fusion, no Side $U \to Z$ conversion, no pointmap $Z \to$ TWENTY EIGHT canonical $Z$, no Front/Side pointmap fusion, no physical depth promotion beyond qualified 4.5H AP depth, no 3D contour reconstruction, no body volume, no 3D reconstruction, no physical authority from `"meters"`, no physical authority from Sapiens `scale`, no invented skeletal landmarks, no interpolation across missing Side contour rows, and no requirement for identical Front and Side raster rows (canonical Y is preserved across independent view rasters).

### Verification Baseline
- **905 tests passing**
- **0 failures**
- **0 skipped**
- **0 cancelled**
- **47 test suites**
- Clean production Vite build (`npm run build`)

---

## 22. Key Source Files

| File | Purpose |
|------|---------|
| `src/main.js` | Thin app orchestrator: scene assembly, interaction/UI setup, resize, animation loop (~122 lines) |
| `src/core/constants.js` | Shared scale, grid, LOD, and tooltip constants |
| `src/core/frontSurface.js` | Front Surface depth, 2D↔3D mapping helpers |
| `src/core/annotationTypes.js` | Allowed annotation node types, landmark presets, display labels |
| `src/core/landmarkDisplay.js` | Shared Title Case landmark / annotation display-name helper |
| `src/core/formatters.js` | Coordinate, point, annotation, and distance formatting |
| `src/core/math.js` | smoothstep and Euclidean distance helpers |
| `src/core/pixelMetrologyMapping.js` | Pixel-to-Metrology Mapping Core v0 — pure, resolution-independent 2D raster ↔ metrology mapping (points, bounding boxes, row mapping, horizontal spans) |
| `src/core/pixelMetrologyMapping.test.js` | Pixel-to-Metrology Mapping Core v0 unit tests |
| `src/core/scene.js` | Three.js scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls |
| `src/metrology/roomShell.js` | Transparent room shell and 10 cm surface grid markers |
| `src/metrology/volumeGrid.js` | 5 cm internal lattice, LOD layers, visibility controls |
| `src/metrology/axes.js` | X/Y/Z axes and 20 cm tick labels |
| `src/metrology/referenceMarkers.js` | Origin and Center markers, hover labels |
| `src/features/bodyEvidencePackage.js` | Full Body Evidence Package Contract v0 & Dense Layout / Pixel Index Contract v0 — pure normalized package schema, layout resolution, layout-aware vector indexing, rawSources preservation |
| `src/features/bodyEvidencePackage.test.js` | Body Evidence Package Contract & Dense Layout Contract unit tests |
| `src/features/denseEvidenceQa.js` | Pointmap, Surface Normal, and Same-View Cross-Modal Dense Evidence QA Core v0 |
| `src/features/denseEvidenceQa.test.js` | Dense Evidence QA Core and Runtime Integration unit tests |
| `src/features/bodyEvidenceZipAdapter.js` | Body Evidence ZIP Import Adapter v0 — archive discovery, single-sample resolution, rawSources staging metadata capture (aposeResult, alignResult), and package construction |
| `src/features/bodyEvidenceZipAdapter.test.js` | ZIP Import Adapter unit tests |
| `src/features/bodyEvidenceAdapter.js` | Landmark classification (Core 13 / Secondary allowlist / face rejection) and segmentation normalization |
| `src/features/bodyEvidenceAdapter.test.js` | Body Evidence adapter unit tests |
| `src/features/bodyEvidence.js` | Body Evidence runtime store: active package, derived dense QA runtime state, change notifications, anatomical region evidence & horizontal raster slice / transverse width / profile span / cross-view correspondence / comparability QA / metric calibration / physical semantics / physical eligibility / view pose semantics / clothing body-surface semantics / authoritative physical evidence semantics / direct body measurements (Batch A & Batch B) / modeled circumference getters (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat), sanitized diagnostic export, batch landmark promotion |
| `src/features/bustPointPlaneLocalization.js` | Bust Point Plane Localization Contract v1 (`bust-point-plane-localization-v1`) — pure deterministic raw Side contour anterior breast extrema localization with trunk core support [ACTIVE PRODUCTION] |
| `src/features/bustPointPlaneLocalization.test.js` | Bust Point Plane Localization Contract v1 unit tests |
| `src/features/bustApexPlaneLocalization.js` | Bust Apex Plane Localization Contract v0 (`bust-apex-plane-localization-v0`) — legacy baseline-relative bust prominence localization [LEGACY — RETAINED FOR REGRESSION PROTECTION] |
| `src/features/bustApexPlaneLocalization.test.js` | Bust Apex Plane Localization Contract v0 unit tests |
| `src/features/modeledBustCircumference.js` | Modeled Bust Circumference Contract v0 (`modeled-bust-circumference-v0`) — pure deterministic domain derivation of ellipse-modeled Bust circumference estimate from localized Bust Point Plane using Ramanujan II [ACTIVE PRODUCTION] |
| `src/features/modeledBustCircumference.test.js` | Modeled Bust Circumference Contract v0 unit tests |
| `src/features/naturalWaistPlaneLocalization.js` | Natural Waist Plane Localization Contract v0 (`natural-waist-plane-localization-v0`) — pure deterministic evidence-driven waist plane localization using metric smoothing window = 2.0 cm, bilateral contour QA, broad trough pooling, and hierarchical tie-breaking [ACTIVE PRODUCTION] |
| `src/features/naturalWaistPlaneLocalization.test.js` | Natural Waist Plane Localization Contract v0 unit tests |
| `src/features/modeledNaturalWaistCircumference.js` | Modeled Natural Waist Circumference Contract v0 (`modeled-natural-waist-circumference-v0`) — pure deterministic domain derivation of ellipse-modeled Natural Waist circumference estimate from localized Natural Waist Plane using Ramanujan II with strict Front-only gate [ACTIVE PRODUCTION] |
| `src/features/modeledNaturalWaistCircumference.test.js` | Modeled Natural Waist Circumference Contract v0 unit tests |
| `src/features/abdominalPointPlaneLocalization.js` | Abdominal Point Plane Localization Contract v1 (`abdominal-point-plane-localization-v1`) — pure deterministic raw Side contour anterior abdominal extrema localization under transition support [ACTIVE PRODUCTION] |
| `src/features/abdominalPointPlaneLocalization.test.js` | Abdominal Point Plane Localization Contract v1 unit tests |
| `src/features/abdominalApexPlaneLocalization.js` | Abdominal Apex Plane Localization Contract v0 (`abdominal-apex-plane-localization-v0`) — legacy baseline-relative abdominal prominence localization [LEGACY — RETAINED FOR REGRESSION PROTECTION] |
| `src/features/abdominalApexPlaneLocalization.test.js` | Abdominal Apex Plane Localization Contract v0 unit tests |
| `src/features/modeledAbdominalCircumference.js` | Modeled Abdominal Circumference Contract v0 (`modeled-abdominal-circumference-v0`) — pure deterministic domain contract deriving an ellipse-modeled Abdominal circumference estimate from localized Abdominal Point Plane using Ramanujan II with transition support [ACTIVE PRODUCTION] |
| `src/features/modeledAbdominalCircumference.test.js` | Modeled Abdominal Circumference Contract v0 unit tests |
| `src/features/buttockPointPlaneLocalization.js` | Buttock Point Plane Localization Contract v1 (`buttock-point-plane-localization-v1`) — pure deterministic raw Side contour posterior buttock extrema localization under pelvic support [ACTIVE PRODUCTION] |
| `src/features/buttockPointPlaneLocalization.test.js` | Buttock Point Plane Localization Contract v1 unit tests |
| `src/features/modeledHipGirth.js` | Modeled Hip Girth Contract v1 (`modeled-hip-girth-v1`) — pure deterministic domain derivation of ellipse-modeled Hip Girth estimate at localized Buttock Point Plane using Ramanujan II [ACTIVE PRODUCTION] |
| `src/features/modeledHipGirth.test.js` | Modeled Hip Girth Contract v1 unit tests |
| `src/features/maximumSeatPlaneLocalization.js` | Maximum Seat Plane Localization Contract v0 (`maximum-seat-plane-localization-v0`) — ranks pelvic scan candidate planes by Ramanujan II perimeter to localize Maximum Seat Plane [ACTIVE PRODUCTION] |
| `src/features/maximumSeatPlaneLocalization.test.js` | Maximum Seat Plane Localization Contract v0 unit tests |
| `src/features/modeledHipSeatCircumference.js` | Modeled Maximum Seat Circumference Contract v0 (`modeled-hip-seat-circumference-v0`) — pure deterministic domain derivation of modeled circumference estimate at localized Maximum Seat Plane using Ramanujan II [ACTIVE PRODUCTION] |
| `src/features/modeledHipSeatCircumference.test.js` | Modeled Maximum Seat Circumference Contract v0 unit tests |
| `src/features/modeledCrossSectionPerimeter.js` | Modeled Cross-Section Perimeter Infrastructure (`modeled-cross-section-perimeter-v0`) — shared `computeRamanujanEllipsePerimeter` mathematical core and Hip Landmark Level modeled perimeter evaluator [ACTIVE PRODUCTION INFRASTRUCTURE] |
| `src/features/modeledCrossSectionPerimeter.test.js` | Modeled Cross-Section Perimeter Contract v0 unit tests |
| `src/features/pelvicArbitraryYEvidenceScan.js` | Pelvic Arbitrary-Y Evidence Scan Contract v0 (`pelvic-arbitrary-y-evidence-scan-v0`) — pure deterministic scanner extracting continuous Front transverse width evidence across pelvic region |
| `src/features/pelvicArbitraryYEvidenceScan.test.js` | Pelvic Arbitrary-Y Evidence Scan unit tests |
| `src/features/arbitraryYSidePhysicalDepthQualification.js` | Arbitrary-Y Side Physical Depth Qualification Contract v0 (`arbitrary-y-side-physical-depth-qualification-v0`) — qualifies Side AP depth across arbitrary pelvic Y levels |
| `src/features/arbitraryYSidePhysicalDepthQualification.test.js` | Arbitrary-Y Side Physical Depth Qualification unit tests |
| `src/features/torsoArbitraryYEvidenceScan.js` | Torso Arbitrary-Y Evidence Scan Contract v0 (`torso-arbitrary-y-evidence-scan-v0`) — pure deterministic continuous row scanner across torso region segmentation under resolution-independent mapping |
| `src/features/torsoArbitraryYEvidenceScan.test.js` | Torso Arbitrary-Y Evidence Scan unit tests |
| `src/features/directBodyMeasurements.js` | Direct Body Measurements Contract v0 (`direct-body-measurements-v0`) — pure deterministic derivation of 25 direct Batch A & Batch B body measurements across Vertical Inter-Level, Projected Landmark Segments, Kinematic Chains, and Bilateral Transverse Landmark Spans |
| `src/features/directBodyMeasurements.test.js` | Direct Body Measurements Contract v0 unit tests |
| `src/features/anatomicalRegions.js` | Anatomical Region Contract v0 — deterministic 29-class observed region mapping with metric boundsCm, canonical laterality, and authoritative `BODY_ANATOMICAL_CLASS_IDS` |
| `src/features/anatomicalRegions.test.js` | Anatomical Region Contract v0 unit tests |
| `src/features/anatomicalLevels.js` | Anatomical Level Contract v0 (`anatomical-levels-v0`) — pure derivation of 7 reference Y levels (neck, shoulder, elbow, wrist, hip, knee, ankle) from promoted Front body landmarks |
| `src/features/anatomicalLevels.test.js` | Anatomical Level Contract v0 unit tests |
| `src/features/anatomicalRegionEvidence.js` | Anatomical Region Evidence Association Contract v0 (`anatomical-region-evidence-v0`) — 13 canonical region nodes, bounds, dense QA qualifications, and landmark/level topological adjacency |
| `src/features/anatomicalRegionEvidence.test.js` | Anatomical Region Evidence Association Contract v0 unit tests |
| `src/features/measurementSupportPolicy.js` | Measurement Support Policy Contract v0 (`measurement-support-policy-v0`) — pure deterministic definitions of observed supported silhouettes (`neck_core_support_v0`, `trunk_core_support_v0`, `pelvic_core_support_v0`, `trunk_pelvic_transition_support_v0`) |
| `src/features/measurementSupportPolicy.test.js` | Measurement Support Policy Contract v0 unit tests |
| `src/features/frontRasterSlice.js` | Front Horizontal Raster Slice Contract v0 (`front-horizontal-raster-slice-v0`) — pure single-row O(W) streaming scan returning contiguous horizontal runs with encountered class tracking |
| `src/features/frontRasterSlice.test.js` | Front Horizontal Raster Slice Contract v0 unit tests |
| `src/features/frontTransverseWidth.js` | Front Transverse Width Interpretation Contract v0 (`front-transverse-width-v0`) — pure interpretation of raster slice evidence into formal transverse widths at neck, shoulder, and hip levels under measurement support policies and `single_run_required` policy |
| `src/features/frontTransverseWidth.test.js` | Front Transverse Width Interpretation Contract v0 unit tests |
| `src/features/sideRasterSlice.js` | Side Horizontal Raster Slice Contract v0 (`side-horizontal-raster-slice-v0`) — pure single-row O(W) streaming scan over Side segmentation raster returning contiguous horizontal runs with encountered class tracking |
| `src/features/sideRasterSlice.test.js` | Side Horizontal Raster Slice Contract v0 unit tests |
| `src/features/sideProfileSpan.js` | Side Profile Span Interpretation Contract v0 (`side-profile-span-v0`) — pure interpretation of Side raster slice evidence into formal profile spans under measurement support policies and `single_run_required` policy |
| `src/features/sideProfileSpan.test.js` | Side Profile Span Interpretation Contract v0 unit tests |
| `src/features/crossViewMeasurementCorrespondence.js` | Cross-view Measurement Correspondence Contract v0 (`cross-view-measurement-correspondence-v0`) — pure deterministic correspondence layer pairing Front transverse width and Side profile span observations at matching anatomical source levels |
| `src/features/crossViewMeasurementCorrespondence.test.js` | Cross-view Measurement Correspondence Contract v0 unit tests |
| `src/features/crossViewComparabilityQa.js` | Cross-view Comparability QA Contract v0 (`cross-view-comparability-qa-v0`) — pure deterministic comparability QA over established 4.5A correspondence evidence across 10 inspectable checks |
| `src/features/crossViewComparabilityQa.test.js` | Cross-view Comparability QA Contract v0 unit tests |
| `src/features/metricCalibrationProvenance.js` | Metric Calibration Provenance Contract v0 (`metric-calibration-provenance-v0`) — pure deterministic validator of upstream metric calibration claims across Front and Side views |
| `src/features/metricCalibrationProvenance.test.js` | Metric Calibration Provenance Contract v0 unit tests |
| `src/features/authoritativePhysicalEvidenceSemantics.js` | Authoritative Physical Evidence Semantics Contract v0 (`authoritative-physical-evidence-semantics-v0`) — classifies dense pointmap evidence as camera-frame geometric vs authoritative physical geometry |
| `src/features/authoritativePhysicalEvidenceSemantics.test.js` | Authoritative Physical Evidence Semantics Contract v0 unit tests |
| `src/features/physicalMeasurementSemantics.js` | Physical Measurement Semantics Contract v0 (`physical-measurement-semantics-v0`) — pure deterministic evaluator classifying measurements into workspace, metric projected, and physical tiers |
| `src/features/physicalMeasurementSemantics.test.js` | Physical Measurement Semantics Contract v0 unit tests |
| `src/features/viewPoseSemantics.js` | View / Pose Semantics Contract v0 (`view-pose-semantics-v0`) — pure deterministic evaluator validating Layer A declared view identity, Layer B 2D structural pose qualification, and Layer C physical orientation certification |
| `src/features/viewPoseSemantics.test.js` | View / Pose Semantics Contract v0 unit tests |
| `src/features/clothingBodySurfaceSemantics.js` | Clothing / Body-Surface Semantics Contract v0 (`clothing-body-surface-semantics-v0`) — pure deterministic domain qualification layer evaluating Layer A clothing participation, Layer B visual garment qualification, and Layer C authoritative empirical body-surface authorization |
| `src/features/clothingBodySurfaceSemantics.test.js` | Clothing / Body-Surface Semantics Contract v0 unit tests |
| `src/features/physicalMeasurementEligibility.js` | Physical Measurement Eligibility Contract v0 (`physical-measurement-eligibility-v0`) & Paired Cross-View Eligibility Contract v0 (`paired-cross-view-eligibility-v0`) — authoritative downstream eligibility gate |
| `src/features/physicalMeasurementEligibility.test.js` | Physical Measurement Eligibility Contract v0 unit tests |
| `src/features/sidePoseQualification.js` | Side T-Pose Qualification Contract v0 (`side-t-pose-qualification-v0`) — evaluates Side arm reach, alignment, and 2D projected elbow deviation |
| `src/features/sidePoseQualification.test.js` | Side T-Pose Qualification Contract v0 unit tests |
| `src/features/sideAnteriorPosteriorOrientation.js` | Side Anterior / Posterior Orientation Semantics Contract v0 (`side-anterior-posterior-orientation-v0`) — pure deterministic domain contract determining anatomical anterior/posterior along Side-U |
| `src/features/sideAnteriorPosteriorOrientation.test.js` | Side Anterior / Posterior Orientation Semantics unit tests |
| `src/features/sideViewOrientationQualification.js` | Approximately-Lateral Side View Qualification Contract v0 (`side-view-orientation-qualification-v0`) — evaluates bilateral collapse consensus across stable landmark pairs |
| `src/features/sideViewOrientationQualification.test.js` | Approximately-Lateral Side View Qualification Contract v0 unit tests |
| `src/features/sidePhysicalDepthQualification.js` | Side Physical Depth Qualification Contract v0 (`side-physical-depth-qualification-v0`) — determines when Side profile span qualifies as a physical AP depth estimate |
| `src/features/sidePhysicalDepthQualification.test.js` | Side Physical Depth Qualification Contract v0 unit tests |
| `src/features/crossSectionEvidence.js` | Cross-Section Evidence Contract v0 (`cross-section-evidence-v0`) — pure deterministic compositional layer pairing qualified Front transverse width and Side AP depth observations at validated reference levels (`shoulder`, `hip`) |
| `src/features/crossSectionEvidence.test.js` | Cross-Section Evidence Contract v0 unit tests |
| `src/features/measurementVisualizationProvenance.js` | Measurement Visualization Provenance Contract v0 (`measurement-visualization-provenance-v0`) — pure declarative normalizer converting domain measurement (including Front horizontal width, cross-section, plane localization, and bilateral transverse spans) into standardized 2D visualization instructions |
| `src/features/measurementVisualizationProvenance.test.js` | Measurement Visualization Provenance Contract v0 unit tests |
| `src/features/appMode.js` | App mode state (Inspect & Measure vs Annotate) |
| `src/features/selection.js` | Selected point state and highlight (Annotate mode) |
| `src/features/measurement.js` | Canonical shared Point A/B measurement state, markers, line, label, history |
| `src/features/sideMeasurement.js` | Local Side Evidence A/B measurement state (U/Y Euclidean distance) |
| `src/features/frontSurfaceMeasurement.js` | Front Surface advance/read helpers over shared measurement |
| `src/features/projectionLinking.js` | Read-only Front Surface projection of Origin/Center/annotations |
| `src/features/frontSideAlignment.js` | Pure deterministic Front/Side semantic correspondence and vertical Y QA contract |
| `src/features/frontSideAlignment.test.js` | Front-Side alignment contract unit tests |
| `src/features/bodyGraph.js` | Body Graph Contract v0 — deterministic Core 13 graph derivation |
| `src/features/bodyGraph.test.js` | Body Graph Contract v0 unit tests |
| `src/features/bodyMeasurementLevels.js` | Measurement Reference Levels v0 compute (orphaned / internal helper) |
| `src/features/bodyMeasurementLines.js` | Anatomical Measurement Lines v0 compute (candidate readiness lines) |
| `src/features/bodyMeasurementPreview.js` | Measurement Line Preview Overlay v0 (3D + Front 2D preview lines) |
| `src/features/annotations.js` | Annotation CRUD, 3D visuals, CSS2D labels, promote path |
| `src/features/sceneExport.js` | Canonical Scene State JSON export build and download |
| `src/features/sceneImport.js` | Canonical Scene State JSON import validation and restore |
| `src/features/sceneGraphHighlight.js` | Temporary Scene Graph 3D highlight overlays |
| `src/features/linkedSelection.js` | Linked selection ID manager |
| `src/interactions/raycast.js` | Shared raycaster and volumetric point resolution |
| `src/interactions/picking.js` | Mode-aware click picking (promoted landmark priority, lattice, selection) |
| `src/interactions/pointerEvents.js` | Canvas pointer wiring and event orchestration |
| `src/interactions/hover.js` | Hover highlight and tooltip coordination |
| `src/ui/appMenuBar.js` | Top application menu bar (File / View / Workflow dropdowns) |
| `src/ui/viewControls.js` | View settings definitions, authoritative checked query, setting toggle |
| `src/ui/inspectorWorkflow.js` | Metrology Inspector workflow panel visibility manager |
| `src/ui/inspectorWorkflowState.js` | Metrology Inspector workflow state store |
| `src/ui/domRefs.js` | Safe cached DOM element references |
| `src/ui/workspaceLayout.js` | Workspace tab management (3D / 2D / Body Graph), split divider, and right sidebar rail collapse |
| `src/ui/leftPanel.js` | Anatomical Levels card renderer for the left inspector |
| `src/ui/derivedMeasurementDeck.js` | Right Sidebar Results deck rendering collapsible Shoulder / Hip Cross-Section Evidence cards, Front Transverse Widths card (Neck Transverse Width with responsive stacked metadata), Modeled Circumferences (Bust, Natural Waist, Abdominal, Hip Girth, Maximum Seat), and collapsible parent Direct Measurements cards (with Bilateral Spans & Breadths subgroup) with click-to-highlight integration |
| `src/ui/derivedMeasurementDeck.test.js` | Results deck unit tests |
| `src/ui/measurementHighlightOverlay2d.js` | 2D Measurement Highlight Overlay renderer — renders clean geometry (guides, lines, dots, highlights, bilateral transverse spans with asymmetry drop lines) on dedicated Front/Side highlight layers with no floating text over slice lines |
| `src/ui/measurementHighlightOverlay2d.test.js` | 2D Measurement Highlight Overlay unit tests |
| `src/ui/modeledEllipseCrossSectionPreview.js` | Modeled Ellipse Cross-Section Preview — companion SVG display in 2D workspace for all 5 Modeled Circumferences with aspect ratio scaling and disclaimer |
| `src/ui/modeledEllipseCrossSectionPreview.test.js` | Modeled Ellipse Cross-Section Preview unit tests |
| `src/ui/advancedQaPanel.js` | Diagnostics Why Blocked + Advanced QA (intake / calibration) |
| `src/ui/advancedQaPanel.test.js` | Advanced QA / Diagnostics accordion unit tests |
| `src/ui/collapsibleSections.js` | Shared `[data-collapsible]` accordion wiring for left and right sidebars |
| `src/ui/grid2dNavigator.js` | Front Surface 2D Grid Navigator (X/Y coordinates) |
| `src/ui/sideGrid2dNavigator.js` | Side Evidence 2D Grid Navigator (U/Y coordinates) |
| `src/ui/grid2dNavShared.js` | Shared 2D navigator geometry, zoom/pan transform, and lattice utilities |
| `src/ui/grid2dPlotArea.js` | Shared 2D plot frame, axes, and CSS variable styling |
| `src/ui/bodyEvidencePackageQaUi.js` | Reusable Package QA HTML helper (test / future remount; not currently mounted in Diagnostics) |
| `src/ui/bodyEvidencePackageQaUi.test.js` | Package QA summary UI unit tests |
| `src/ui/bodyEvidencePanel.js` | Body Evidence left workflow panel (Front / Side / Landmark tabs, segmentation lists, inspect card, promote, Promote All Front Core) |
| `src/ui/bodyEvidenceCandidateList.js` | Candidate list DOM rendering with Core / Secondary filters and pill badges |
| `src/ui/bodyEvidenceCandidateList.test.js` | Candidate list rendering unit tests |
| `src/ui/bodyEvidenceOverlay2d.js` | Front Surface Body Evidence overlay markers and inspect selection |
| `src/ui/bodyEvidenceOverlaySide2d.js` | Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes) |
| `src/ui/segmentationOverlay2d.js` | Translucent dense semantic segmentation overlays & highlight LUTs with isolated per-view caches |
| `src/ui/segmentationOverlay2d.test.js` | Segmentation overlay rendering, cache isolation, and LUT unit tests |
| `src/ui/segmentationInspection.test.js` | Segmentation inspection, filtering, and Landmark-tab unit tests |
| `src/ui/frontSideAlignmentPanel.js` | Diagnostics → Front–Side Alignment presentation (summary card, collapsible groups, compact rows) |
| `src/ui/frontSideAlignmentPanel.test.js` | Front–Side Alignment QA presentation panel unit tests |
| `src/ui/bodyGraphWorkspace.js` | Body Graph Workspace v0 — Core 13 topological diagram |
| `src/ui/bodyTabConsolidatedPanel.js` | Diagnostics coordinator for Front–Side Alignment + Body / Anchor readiness |
| `src/ui/measurementPanel.js` | Distance Measurement inspector (Front/Canonical and Side/U-Y subgroups) + Session Records History |
| `src/ui/selectionPanel.js` | Selected Point coordinate readouts inside the Annotation panel |
| `src/ui/annotationControls.js` | Landmark Preset dropdown wiring |
| `src/ui/annotationPanel.js` | Session Records annotation list renderer |
| `src/ui/annotationValidationMessage.js` | Displays and clears inline validation messages for annotation creation |
| `src/ui/sceneGraphPanel.js` | Diagnostics Origin / Center projection utility |
| `src/ui/badgeUi.js` | Shared HTML escape + badge helpers |
| `src/ui/badgeUi.test.js` | Badge helper unit tests |
| `src/ui/hoverTooltip.js` | Screen-space hover coordinate tooltip |
| `src/ui/resultsCardClickHighlight.test.js` | Results card click-to-highlight unit tests |
| `src/ui/rightSidebarStage2.test.js` | Results / Session Records / Diagnostics architecture tests |
| `src/ui/finalAccessibilityVisualPolish.test.js` | Accessibility & visual polish tests |
| `src/ui/grid2dNavigatorChrome.test.js` | Navigator UI chrome tests |
| `src/ui/grid2dRefinementPolish.test.js` | 2D navigator refinement polish tests |
| `src/ui/inspectorWorkflow.test.js` | Inspector workflow unit tests |
| `src/ui/leftPanel.test.js` | Anatomical Levels card unit tests |
| `src/ui/measurementContext.test.js` | Measurement context unit tests |
| `src/ui/measurementSemantics.test.js` | Dense QA terminology via Package QA helper |
| `src/ui/responsiveLayoutPolish.test.js` | Responsive layout polish tests |
| `src/ui/viewControls.test.js` | View controls unit tests |
| `src/ui/workflowDrivenLeftSidebar.test.js` | Left workflow composition tests |
| `src/ui/workspaceLayout.test.js` | Workspace layout and right sidebar collapse unit tests |
| `src/styles/variables.css` | Design tokens and color themes |
| `src/styles/layout.css` | CSS grid layout, workspace panes, and split divider |
| `src/styles/components.css` | Menus, sidebars, tabs, panels, cards, candidate lists, and buttons |
| `src/styles/overlays.css` | 2D navigators, plot grids, markers, measurement overlays, and tooltips |
| `src/style.css` | Stylesheet entry point |
| `index.html` | Main HTML application shell |

---

## 23. Master Measurement Coverage Program & Implementation Protocol

### 1. Program Purpose & Scope
TWENTY EIGHT systematically tracks and implements the complete target female-body measurement catalogue under the **Master Measurement Coverage Program**. The target catalogue represents the unified superset of:
1. The historical **104 Female Landmark Measurements** catalogue.
2. The original **Metrology Engine** measurement scope.
3. Additional valid measurements already introduced by **TWENTY EIGHT**.
4. Future measurements approved through empirical evidence and source verification.

> [!IMPORTANT]
> The historical 104 catalogue is a **REFERENCE CATALOGUE**, not an unquestioned geometric specification. Fields such as `Connected_Landmarks`, `Calculation_Method`, and `ISO_2025_Compliant` must **NOT** automatically be treated as authoritative definitions. Historical definitions are frequently ambiguous or geometrically insufficient (e.g. *"Circular interpolation through 2 points"* cannot uniquely define a circumference without a 3D model/surface; *"3D curved/straight distance"* fails to specify whether a quantity is a Euclidean chord, projected distance, surface arc, or geodesic path). Every measurement must pass TWENTY EIGHT semantic and source verification before implementation.

### 2. Master Body Category Organization
All target measurements are organized into **10 canonical planning categories**:

| Category | Description & Target Measurements |
|---|---|
| **1. HEAD & NECK** | Head Circumference, Neck Circumference, Neck Length, Chin to Shoulder, Front Neck Drop, Back Neck Drop, Neck Base Width, Neck Transverse Width, Face Length, Face Width, Jaw Width, Neck-to-Waist Front / Back. |
| **2. SHOULDER & UPPER TORSO** | Inter-Acromion / Shoulder Breadth, Shoulder Slope, Across Front, Across Back, Shoulder Drop, Armhole Depth, Armhole Circumference, Shoulder-related torso widths. |
| **3. ARMS** | Arm Length, Upper Arm Length, Forearm Length, Shoulder-to-Elbow, Shoulder-to-Wrist, Arm Kinematic Chain Length, Arm Span, Upper Arm Circumference, Elbow Circumference, Forearm Circumference, Wrist Circumference, Sleeve Cap Height, Bicep Height. |
| **4. BUST & CHEST** | Bust Circumference, Underbust Circumference, Over Bust Circumference, Bust Point-to-Bust Point, Bust Point Height, Bust Prominence, Chest Width, Chest Depth, Upper Chest Width, Back Width at Bust, Side Bust Arc, Front Bust Arc, Bust-to-Waist Front / Side, Shoulder-to-Bust Point. |
| **5. WAIST & ABDOMEN** | Natural Waist Circumference, High Waist Circumference, Low Waist Circumference, Waist Front Width, Waist Back Width, Waist Height, Waist-to-Hip, Waist-to-Knee, Waist-to-Floor, Natural Waist Arc Front, Natural Waist Arc Back, Side Waist Length, Abdominal Circumference, localized abdominal widths/depths. |
| **6. HIP & SEAT / PELVIS** | Hip Circumference / Hip Girth, Maximum Seat Circumference, High Hip Circumference, Hip Landmark Span, Hip Silhouette Width, Hip AP Depth, Waist-to-Hip Length, Hip Height, Hip-to-Knee, Hip-to-Floor, Front Hip Arc, Back Hip Arc, Side Hip Length, Hip Drop, Buttock Prominence, Buttock Height. |
| **7. THIGH / KNEE / CALF / ANKLE** | Thigh Circumference, Mid-Thigh Circumference, Thigh Length, Knee Circumference, Knee Height, Calf Circumference, Lower Leg Length, Ankle Circumference, Ankle Height, Knee Landmark Span, Ankle Landmark Span. |
| **8. CROTCH / RISE / LEG LENGTH** | Inseam, Outseam, Crotch Height, Crotch Length Total, Front Rise, Back Rise, Body Rise, Side Seam Length. |
| **9. FOOT** | Foot Length, Foot Width, Heel-to-Toe, Instep Circumference, Leg Opening where semantically appropriate. |
| **10. BODY / GLOBAL** | Total Height / Optical Stature, Sitting Height, Cervical Height, Torso Length, Center Front Length, Center Back Length, Weight, BMI, Posture Angle. |

### 3. Geometry Family Classification
Every target measurement is classified using the 12 formal TWENTY EIGHT geometry families:
- `Transverse Width` (calibrated image-plane horizontal silhouette span)
- `AP Depth / Projection` (calibrated side-view sagittal depth span)
- `Vertical Height` (floor-to-level absolute elevation; requires ground reference)
- `Vertical Inter-Level Distance` (vertical delta $|Y_1 - Y_2|$ between two anatomical planes)
- `Landmark-to-Landmark Projected Distance` (calibrated 2D projected Euclidean segment between 2 landmarks)
- `Bilateral Transverse Landmark Span` (calibrated horizontal span $|X_R - X_L|$ between bilateral landmarks)
- `Segment / Kinematic Chain Length` (sum of sequential projected segment lengths along a kinematic chain)
- `Circumference / Girth` (modeled or surface-measured closed perimeter around an anatomical plane)
- `Partial Surface Arc / Surface Path` (continuous body surface curve / geodesic distance)
- `Coordinate / Semantic Location` (localized canonical anatomical coordinate or plane elevation)
- `Angular Measurement` (true geometric angle in degrees between vectors or planes)
- `Non-geometric / Derived Metric` (external metadata, index, or non-spatial scalar e.g. BMI, weight)

### 4. Critical Semantic Separation Rules
Measurements sharing similar names or anatomical regions must remain strictly distinct:
- $\text{Bilateral Knee Landmark Span} \ne \text{Knee Silhouette Width} \ne \text{Knee Circumference}$
- $\text{Inter-Hip Landmark Span} \ne \text{Torso Transverse Width at Hip Level} \ne \text{Hip Girth} \ne \text{Maximum Seat Circumference}$
- $\text{Inter-Acromion Breadth} \ne \text{Torso Transverse Width at Shoulder Level}$
- $\text{Neck Transverse Width} \ne \text{Neck Base Landmark Breadth} \ne \text{Neck Circumference}$
- $\text{Thigh Segment Length} \ne \text{Thigh Width} \ne \text{Thigh Circumference}$

No measurement implementation may proceed until the exact mathematical quantity, target geometry family, and anatomical placement are explicit and unambiguous.

### 5. Current Implementation Baseline (31 Verified Measurements)
- **7 Anatomical Reference Levels** (`anatomical-levels-v0`): `neck`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`.
- **25 Direct Body Measurements** (`direct-body-measurements-v0`):
  - 5 Vertical Inter-Level Distances: `vertical_neck_to_shoulder_distance`, `vertical_shoulder_to_elbow_distance`, `vertical_elbow_to_wrist_distance`, `vertical_hip_to_knee_distance`, `vertical_knee_to_ankle_distance`.
  - 10 Projected Landmark Segments: Left/Right Clavicle Span, Left/Right Upper Arm Length, Left/Right Forearm Length, Left/Right Thigh Length, Left/Right Lower Leg Length.
  - 4 Projected Kinematic Chains: Left/Right Total Arm Length, Left/Right Total Leg Length.
  - 6 Bilateral Transverse Landmark Spans: Inter-Acromion Transverse Breadth, Inter-Hip Landmark Transverse Span, Bilateral Elbow Landmark Transverse Span, Bilateral Wrist Landmark Transverse Span, Bilateral Knee Landmark Transverse Span, Bilateral Ankle Landmark Transverse Span.
- **3 Front Transverse Widths** (`front-transverse-width-v0`): Neck Transverse Width (`neck_core_support_v0`), Torso Transverse Width at Shoulder Level (`trunk_core_support_v0`), Torso Transverse Width at Hip Level (`pelvic_core_support_v0`).
- **2 Qualified Side AP Depths** (`side-physical-depth-qualification-v0`): Shoulder Level, Hip Level.
- **2 Cross-Section Evidence Pairs** (`cross-section-evidence-v0`): Shoulder Level, Hip Level.
- **5 Active Modeled Torso Circumferences** (Ellipse Ramanujan II):
  1. Modeled Bust Circumference ($102.72\text{ cm}$ at localized Bust Point Plane $Y = 119.15\text{ cm}$).
  2. Modeled Natural Waist Circumference ($82.25\text{ cm}$ at localized Natural Waist Plane $Y = 107.15\text{ cm}$).
  3. Modeled Abdominal Circumference ($99.26\text{ cm}$ at localized Abdominal Point Plane $Y = 96.85\text{ cm}$).
  4. Modeled Hip Girth ($111.12\text{ cm}$ at localized Buttock Point / Hip Girth Plane $Y = 86.05\text{ cm}$).
  5. Modeled Maximum Seat Circumference ($114.20\text{ cm}$ at localized Maximum Seat Plane $Y = 79.95\text{ cm}$).
- **5 Localized Torso/Pelvic Planes**: Bust Point Plane v1, Natural Waist Plane v0, Abdominal Point Plane v1, Buttock Point Plane v1, Maximum Seat Plane v0.

### 6. Master Coverage Status Taxonomy
All measurements across the target catalogue are classified using one of the following 13 canonical status states:
- `DONE — EXACT`: Current implementation matches the intended geometry and anatomical definition.
- `DONE — EQUIVALENT / RENAMED`: Current implementation strongly corresponds but uses a more precise TWENTY EIGHT name or semantics.
- `PARTIAL`: Some required components exist, but the complete intended measurement does not.
- `READY NOW`: Current evidence and architecture appear sufficient; read-only source verification precedes implementation.
- `NEEDS LOCALIZATION`: Measurement geometry is feasible, but the correct anatomical Y/plane must first be localized.
- `NEEDS GROUND REFERENCE`: Absolute floor-referenced quantity cannot be computed until subject ground/contact reference exists.
- `NEEDS NEW LANDMARK / EVIDENCE`: Required anatomical anchors are not available in current promoted evidence.
- `NEEDS CROSS-VIEW QUALIFICATION`: Requires corresponding Front width + Side AP/depth evidence or additional view qualification.
- `NEEDS SURFACE / 3D GEOMETRY`: Requires actual surface path, contour, geodesic, 3D body geometry, or equivalent evidence not currently authoritative.
- `DEFINITION REQUIRED`: Historical measurement definition is ambiguous, internally inconsistent, or insufficient.
- `NON-GEOMETRIC / EXTERNAL INPUT`: Non-spatial or external quantity (e.g. Weight, BMI).
- `DUPLICATE / SUPERSEDED`: Another canonical TWENTY EIGHT measurement already represents the intended quantity more clearly.
- `OUT OF CURRENT SCOPE`: Retained in catalogue for reference but not currently prioritized.

### 7. Known Historical Catalogue Issues
Historical catalogue records contain documented issues that must be preserved as reference metadata rather than silently corrected:
- **Weight**: Non-geometric mass input (kg/lbs), not a cm coordinate measurement.
- **BMI**: Non-geometric derived index ($\text{kg}/\text{m}^2$), not measured in cm.
- **Posture Angle**: Named as an angle, but historically calculated as a linear displacement.
- **Shoulder Slope**: Ambiguous between angular slope (degrees), vertical drop ($\Delta Y$), or anatomical path length.
- **2-Point Circumferences**: Historical "circular interpolation through 2 points" is insufficient without an explicit model or surface reconstruction.
- **"3D Curved / Straight Distance"**: Ambiguous phrasing conflating 3D chords, 2D projected distances, and surface arcs.
- **Historical ISO Compliance**: Fields marked `ISO_2025_Compliant` must be treated as unverified source metadata until explicitly mapped to a verified standard definition.

### 8. Implementation Waves
- **Wave 1 — Knee + Ankle Expansion (Candidate)**: Knee/Ankle silhouette widths, Side AP depths, and Ramanujan II modeled perimeters. (Knee/Ankle Heights remain `NEEDS_GROUND_REFERENCE`).
- **Wave 2 — Thigh + Calf Coverage**: Evidence-driven plane localization and circumference modeling without arbitrary fixed percentage offsets.
- **Wave 3 — Additional Torso Coverage**: Localized chest, overbust, high/low waist, and high hip widths/depths/girths.
- **Wave 4 — Relative Lengths**: Localized plane-to-plane vertical intervals ($|Y_1 - Y_2|$).
- **Underbust Workstream**: Independent localization of the inframammary fold plane and modeled underbust circumference.
- **Wave 5 — Ground Reference & Vertical Heights**: Subject ground plane contract unlocking floor-referenced heights and optical stature.
- **Wave 6 — Surface Arcs & Geodesics**: Non-chord body surface contours and partial arcs.
- **Later / Specialized Evidence**: Head / Face, Foot specialized landmark contracts.

### 9. Planned Results Information Architecture Reorganization
Before large additional measurement batches are added, the Right Sidebar Results architecture is planned to transition from implementation-history groupings to an **Anatomy-First Information Architecture**:
- **Primary Results Hierarchy**: `Head & Neck`, `Shoulder & Upper Torso`, `Arms`, `Bust & Chest`, `Waist & Abdomen`, `Hip & Seat / Pelvis`, `Thigh / Knee / Calf / Ankle`, `Crotch / Rise / Leg Length`, `Foot`, `Body Lengths & Heights`.
- **Primary Results vs Supporting Evidence vs Diagnostics**:
  - **RESULTS**: Answers *"What measurement did we obtain and what is its value?"*
  - **SELECTED MEASUREMENT DETAILS**: Context-sensitive card details showing reference plane Y, Front width, Side AP depth, method/formula, and qualification without cluttering the main list.
  - **DIAGNOSTICS**: Answers *"Why is this result qualified, blocked, ambiguous, or unavailable?"*
- **Cross-Section Evidence & Side AP Depth Registries**: The static `cross-section-evidence-v0` registry currently features only `shoulder` and `hip` because it was built around validated shared reference levels. Localized torso circumferences (Bust, Natural Waist, Abdomen, Hip Girth, Maximum Seat) use their own localized same-Y evidence paths. Similarly, `side-physical-depth-qualification-v0` exposes registered reference-level observations at Shoulder and Hip, while arbitrary-Y Side AP qualification operates across torso and pelvic continuous scans.

### 10. Step-by-Step Protocol for Future AI / Dev Sessions
Before implementing any new body measurement, future AI/dev sessions must follow this strict 9-step workflow:
1. **Locate in Master Catalogue**: Find the target measurement in the Master Catalogue and verify its historical record.
2. **Determine Geometry Family**: Assign the exact geometry family (e.g. Transverse Width, Bilateral Transverse Span, Modeled Circumference, Vertical Height).
3. **Determine Anatomical Placement**: Establish the exact anatomical reference level or evidence-driven localized plane.
4. **Identify Required Evidence**: Specify required landmarks, segmentation classes, support policies, and calibration provenance.
5. **Compare Against Existing Measurements**: Check all existing measurements in the same anatomical category.
6. **Document Semantic Distinctions**: State explicitly what this measurement is NOT (prevent conflation with similar names).
7. **Perform Read-Only Source Audit**: Verify support classes, silhouette stability, and edge cases before writing code.
8. **Implement & Verify**: Write pure deterministic domain logic, tests, visualization provenance, and UI cards.
9. **Synchronize Documentation**: Update `METROLOGY_ROADMAP.md`, `PROJECT_CONTEXT.md`, `PROJECT_STRUCTURE.md`, and catalogue status.

### 11. Documentation Maintenance Rule
After every accepted measurement implementation:
1. Update its Master Catalogue coverage status.
2. Record the exact canonical TWENTY EIGHT definition and display name.
3. Record anatomical placement and plane localization source.
4. Record geometry family and mathematical formula.
5. Record evidence dependencies (segmentation classes, landmarks, calibrations).
6. Record 2D/3D visualization provenance behavior.
7. Record explicit semantic non-claims.
8. Update completed and remaining measurement counts.
9. Re-prioritize remaining waves if newly implemented infrastructure unlocks additional measurements.


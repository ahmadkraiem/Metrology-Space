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

### Application shell

The live shell is a three-column layout (`#app-layout`):

#### Left Sidebar — Metrology Inspector (`#left-sidebar`)

Workflow-driven. Visibility is CSS (`#left-sidebar[data-workflow]`), wired by `inspectorWorkflow.js` / `inspectorWorkflowState.js`. There is **no** standalone Current Selection card and **no** Subject / Package card. Package upload lives in the **File** menu.

| Workflow | Menu Item | Default | Visible left panels | Interaction Mode Effect |
|----------|-----------|---------|---------------------|-------------------------|
| **Inspect & Measure** | `data-workflow="measurement"` | Yes | Anatomical Levels (`#anatomy-levels-card`) + Distance Measurement (`#measurement-panel`) | Sets Inspect & Measure mode |
| **Annotate** | `data-workflow="annotation"` | No | Annotation (`#annotation-panel`) with embedded Selected Point coords | Sets Annotate mode |
| **Body Evidence** | `data-workflow="body-evidence"` | No | Anatomical Levels + Advanced Evidence (`#body-evidence-panel`) | Inspector-only — does **not** change app mode |

Body Evidence controls live **only** in the Body Evidence workflow. They do **not** appear inside Annotate. Annotate remains annotation-specific. Inspect & Measure remains measurement-specific.

#### Center workspace (`#viewport`)

Three workspace tabs (`workspaceLayout.js`):

- **3D Space** — volumetric cube, lattice, measurements, annotations
- **2D Workspace** — Front Surface navigator (X/Y) beside Side Profile navigator (U/Y)
- **Body Graph** — read-only Core 13 topology diagram (`bodyGraphWorkspace.js`)

#### Right Sidebar — Results & Records (`#right-sidebar`)

No Hist / Annos / Body / Graph tab strip. Composition:

1. **Results** (`#derived-measurement-deck`, always visible at the top) — Shoulder / Hip derived result cards (`derivedMeasurementDeck.js`)
2. **Session Records** (`#session-records-panel`, collapsible, expanded by default) — History + Annotations, including promoted body landmarks as annotation records
3. **Diagnostics** (`#diagnostics-panel`, collapsible, collapsed by default) — independently collapsible subsections:
   - Why This Result Is Blocked (`#why-result-blocked`)
   - Front–Side Alignment (`#front-side-alignment-qa`)
   - Body / Anchor Diagnostics (`#body-measurement-readiness`)
   - Advanced QA (`#advanced-qa-content`) — intake identity + metric calibration only
   - Origin / Center projection utility (`#reference-projection-utility`)

The whole right sidebar can collapse to a vertical rail (`#right-sidebar-toggle`). Section accordions are wired by `initCollapsibleSections()` on `#left-sidebar` and again on `#right-sidebar`.

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
- **`declaredScale`**: Scale factor declared in metadata — unvalidated at package/QA level. For recognized Sapiens pointmaps, 4.5G preserves `scale` as `predicted_focal_normalization` provenance only. It is **not** REVacity pixels-per-cm, body-height calibration, physical body scale, Front/Side shared calibration, or cross-view registration scale.
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

## 19. Important Do-Not-Break Rules

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

### Explicitly NOT Implemented (Current Scope Boundaries)

1. **Spatial 3D Fusion / Registration:** No 3D spatial fusion between Front X/Y and Side U/Y coordinates.
2. **U → Z Conversion / Canonical Side Depth:** Side U coordinates are profile evidence only and are not mapped to 3D Z depth.
3. **Pointmap Z → Canonical Z:** Pointmap Z coordinates are not treated as canonical metrology Z.
4. **Pointmap / Normal 3D Promotion:** Pointmap and normal evidence packages are accepted normalized inputs with numeric QA. Milestone 4.5G classifies recognized Sapiens pointmaps as camera-frame geometric evidence (`status: 'partial'`, `authorized: false`); they are not promoted into authoritative physical body geometry or 3D reconstruction. Front and Side pointmaps do not share a coordinate frame.
5. **Side Landmark Promotion:** Side landmarks cannot be promoted to 3D annotations.
6. **Derived / Composite Anatomical Regions:** No multi-class region unions or synthetic bounding volumes in v0.
7. **Segmentation-Derived Physical Geometry:** Segmentation-derived Front Transverse Width and Side Profile Span are implemented as metric-projected image-plane observations. Circumference, cross-section, contour reconstruction, authoritative physical body dimensions, and other physical geometry inference remain unimplemented.
8. **Contour Extraction:** No polygon or bezier contour generation from segmentation rasters.
9. **3D Reconstruction / Mesh Generation:** No point cloud generation, mesh surface reconstruction, or volumetric body partitioning.
10. **Circumference / Cross-Section Inference:** No elliptical or convex hull circumference math.
11. **Dense Evidence QA UI Panel:** Dedicated Dense Evidence QA inspection panel in the UI is intentionally deferred.

---

## 20. Metrology Roadmap

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
- **Measurement Support Policy v0 (`measurement-support-policy-v0` — centralized deterministic observed supported silhouette definitions `trunk_core_support_v0` [22, 23] and `pelvic_core_support_v0` [12, 13, 21, 22], tracking `supportPolicyId`, `actualClassIdsUsed`, `clothingClassIdsUsed`, and `usedClothingEvidence: boolean` without run merging or gap filling)**
- **Milestone 4.5D: Physical Measurement Eligibility Contract v0 (`physical-measurement-eligibility-v0` & `paired-cross-view-eligibility-v0` — authoritative downstream eligibility gate determining whether metric-projected measurements are qualified to be consumed as true physical body scalars across Tier 1 individual and Tier 2 paired evaluations, preserving multi-blocker diagnostics and decoupled physical-value provenance)**
- **Milestone 4.5E: Authoritative View / Pose Semantics Validation v0 (`view-pose-semantics-v0` — pure deterministic domain qualification layer verifying Layer A declared view identity, Layer B 2D structural pose qualification with `LOW_CONFIDENCE_THRESHOLD = 0.5`, anatomical vertical ordering, and Front A-pose limb separation, while strictly requiring recognized evaluators for Layer C physical orientation certification; evaluates to `status: 'partial'`, `authorized: false` on current Body Pipeline evidence)**
- **Milestone 4.5F: Clothing / Body-Surface Authorization v0 (`clothing-body-surface-semantics-v0` — pure deterministic domain qualification layer governing Layer A clothing participation from measurement support policy provenance, Layer B visual garment qualification with canonical `garmentFitStatus` taxonomy, and Layer C authoritative empirical body-surface authorization; derives the composite `clothingConstraintSatisfied` gate consumed by 4.5D to keep or clear the `clothing_authorization_missing` blocker; evaluates to `status: 'partial'`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false` on current Body Pipeline evidence)**
- **Milestone 4.5G: Authoritative Physical Evidence Semantics v0 (`authoritative-physical-evidence-semantics-v0` — COMPLETED at evidence-authority / semantics scope; classifies dense pointmap evidence by authority without creating body measurements; implemented evaluator `sapiens-pointmap-camera-frame-evaluator-v0` classifies current Sapiens Front/Side pointmaps as `availability: present`, `status: 'partial'`, `evidenceClass: 'camera_frame_geometric'`, `authorized: false`; authoritative physical-geometry evaluator registry is empty; `validated-dense-geometry-v0` remains reserved and is not enabled. This does not establish authoritative physical body geometry)**
- **Application Shell / UI Modernization Checkpoint** — workflow-driven Left Sidebar; Right Sidebar Results / Session Records / Diagnostics accordions; Hist / Annos / Body / Graph tabs removed; Subject / Package and Current Selection cards removed; documentation synchronized to the cleaned implementation. **No Pointmap geometry milestone is implied.**
- **Measurement Placement Audit Checkpoint — COMPLETED** — Strict read-only audit of Shoulder and Hip measurement placement and semantics verified current runtime behavior: Shoulder uses `trunk_core_support_v0` (`[22, 23]`) and means supported transverse silhouette width at bilateral shoulder landmark Y (not landmark-to-landmark / biacromial breadth); Hip uses `pelvic_core_support_v0` (`[12, 13, 21, 22]`) and slices strictly at bilateral mean hip landmark Y (no search for maximum hip breadth, buttock projection, or seat plane); Side measurements remain projected Side-U profile spans without physical depth promotion; 402 unit tests verified with zero algorithmic changes; immediate next milestone: **4.5H — Side Physical Depth Qualification v0**.

### Active State & Physical Blockers
- **Current Real Evaluation State (`output.zip`)**:
  - Front Pose Semantics: `status: 'partial'`, `authorized: false` (7/8 checks pass; Layer C skipped).
  - Side Pose Semantics: `status: 'partial'`, `authorized: false` (6/8 checks pass; Layer C skipped).
  - Clothing / Body-Surface Semantics: `status: 'partial'`, `authorized: false`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false` across all 4 canonical measurements.
  - Authoritative Physical Evidence Semantics (4.5G): Front and Side independently `availability: present`, `status: 'partial'`, `evidenceClass: 'camera_frame_geometric'`, `authorized: false`, `frame.type: 'camera_local'`, `frame.sharedAcrossViews: false`. Units remain `unitAuthority: service_reported`, `physicalUnitsVerified: false`. Scale remains `predicted_focal_normalization`. Serialized pointmaps are not body-masked (`pointmap value exists` $\ne$ authorized body-surface evidence); 4.5G does not bypass segmentation support, anatomical-region authorization, Dense Evidence QA, or Clothing / Body-Surface Authorization, and introduces no per-pixel body-surface engine. Layer C remains unimplemented. Authoritative Physical Body Geometry: **NOT ESTABLISHED**. Cross-view Physical Geometry: **BLOCKED**.
  - 4.5D Physical Blockers remain active on all 4 canonical measurements: `clothing_authorization_missing`, `view_pose_semantics_missing`, `authoritative_physical_evidence_missing`. Current Sapiens 4.5G results cannot satisfy Dimension E (`physicalEligibility: false`, `physicalMeasurementCm: null`).
  - Metric Projected measurements remain positive and valid, and remain **Metric Projected Measurements** (not authoritative physical body measurements): Front Shoulder ($30.80\text{ cm}$), Side Shoulder ($11.00\text{ cm}$), Front Hip ($42.20\text{ cm}$), Side Hip ($27.70\text{ cm}$). Landmark-to-landmark projected spans, Front Transverse Width, and Side Profile Span remain separate.
  - Metrological Principle: `metric projected measurement != authoritative physical body measurement`.
- **Strict Guardrails**: 4.6 (Circumference / Cross-section inference) remains strictly **BLOCKED**. Reason: valid projected Front/Side metric evidence and camera-frame pointmap evidence exist, but authoritative physical cross-section/depth semantics have not yet been established. Physical cross-section requires individual `physicalEligibility: true` on both views and `pairedPhysicalEligibility: true`. Side $U$ is 2D profile evidence only; it is **not** canonical $Z$, is **never** described as validated physical depth without authoritative physical evidence contracts, and is **never** fused into 3D coordinates with Front $X$. No Side $U \to Z$, no pointmap $Z \to$ REVacity canonical $Z$, no Front/Side pointmap fusion, no physical depth promotion, no circumference, no ellipse inference, no cross-section, no body volume, no 3D reconstruction, no physical authority from `"meters"`, and no physical authority from Sapiens `scale`.

---

## 21. Key Source Files

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
| `src/features/bodyEvidence.js` | Body Evidence runtime store: active package, derived dense QA runtime state, change notifications, anatomical region evidence & horizontal raster slice / transverse width / profile span / cross-view correspondence / comparability QA / metric calibration / physical semantics / physical eligibility / view pose semantics / clothing body-surface semantics / authoritative physical evidence semantics getters, sanitized diagnostic export |
| `src/features/anatomicalRegions.js` | Anatomical Region Contract v0 — deterministic 29-class observed region mapping with metric boundsCm, canonical laterality, and authoritative `BODY_ANATOMICAL_CLASS_IDS` |
| `src/features/anatomicalRegions.test.js` | Anatomical Region Contract v0 unit tests |
| `src/features/anatomicalLevels.js` | Anatomical Level Contract v0 (`anatomical-levels-v0`) — pure derivation of 7 reference Y levels (neck, shoulder, elbow, wrist, hip, knee, ankle) from promoted Front body landmarks |
| `src/features/anatomicalLevels.test.js` | Anatomical Level Contract v0 unit tests |
| `src/features/anatomicalRegionEvidence.js` | Anatomical Region Evidence Association Contract v0 (`anatomical-region-evidence-v0`) — 13 canonical region nodes, bounds, dense QA qualifications, and landmark/level topological adjacency |
| `src/features/anatomicalRegionEvidence.test.js` | Anatomical Region Evidence Association Contract v0 unit tests |
| `src/features/measurementSupportPolicy.js` | Measurement Support Policy Contract v0 (`measurement-support-policy-v0`) — pure deterministic definitions of observed supported silhouettes (`trunk_core_support_v0`, `pelvic_core_support_v0`) |
| `src/features/measurementSupportPolicy.test.js` | Measurement Support Policy Contract v0 unit tests |
| `src/features/frontRasterSlice.js` | Front Horizontal Raster Slice Contract v0 (`front-horizontal-raster-slice-v0`) — pure single-row O(W) streaming scan returning contiguous horizontal runs with encountered class tracking |
| `src/features/frontRasterSlice.test.js` | Front Horizontal Raster Slice Contract v0 unit tests |
| `src/features/frontTransverseWidth.js` | Front Transverse Width Interpretation Contract v0 (`front-transverse-width-v0`) — pure interpretation of raster slice evidence into formal transverse torso widths under measurement support policies and `single_run_required` policy |
| `src/features/frontTransverseWidth.test.js` | Front Transverse Width Interpretation Contract v0 unit tests |
| `src/features/sideRasterSlice.js` | Side Horizontal Raster Slice Contract v0 (`side-horizontal-raster-slice-v0`) — pure single-row O(W) streaming scan over Side segmentation raster returning contiguous horizontal runs with encountered class tracking |
| `src/features/sideRasterSlice.test.js` | Side Horizontal Raster Slice Contract v0 unit tests |
| `src/features/sideProfileSpan.js` | Side Profile Span Interpretation Contract v0 (`side-profile-span-v0`) — pure interpretation of Side raster slice evidence into formal profile spans under measurement support policies and `single_run_required` policy |
| `src/features/sideProfileSpan.test.js` | Side Profile Span Interpretation Contract v0 unit tests |
| `src/features/crossViewMeasurementCorrespondence.js` | Cross-view Measurement Correspondence Contract v0 (`cross-view-measurement-correspondence-v0`) — pure deterministic correspondence pairing Front transverse width and Side profile span observations at matching anatomical source levels |
| `src/features/crossViewMeasurementCorrespondence.test.js` | Cross-view Measurement Correspondence Contract v0 unit tests |
| `src/features/crossViewComparabilityQa.js` | Cross-view Comparability QA Contract v0 (`cross-view-comparability-qa-v0`) — pure deterministic comparability QA over established 4.5A correspondence evidence across 10 inspectable checks |
| `src/features/crossViewComparabilityQa.test.js` | Cross-view Comparability QA Contract v0 unit tests |
| `src/features/metricCalibrationProvenance.js` | Metric Calibration Provenance Contract v0 (`metric-calibration-provenance-v0`) — pure deterministic validator of upstream metric calibration claims across Front and Side views |
| `src/features/metricCalibrationProvenance.test.js` | Metric Calibration Provenance Contract v0 unit tests |
| `src/features/authoritativePhysicalEvidenceSemantics.js` | Authoritative Physical Evidence Semantics Contract v0 (`authoritative-physical-evidence-semantics-v0`) — classifies dense pointmap evidence as camera-frame geometric vs authoritative physical geometry; implemented evaluator `sapiens-pointmap-camera-frame-evaluator-v0`; authoritative physical-geometry registry empty |
| `src/features/authoritativePhysicalEvidenceSemantics.test.js` | Authoritative Physical Evidence Semantics Contract v0 unit tests |
| `src/features/physicalMeasurementSemantics.js` | Physical Measurement Semantics Contract v0 (`physical-measurement-semantics-v0`) — pure deterministic evaluator classifying measurements into workspace, metric projected, and physical tiers; accepts 4.5G evidence only through the authoritative-geometry registry guard |
| `src/features/physicalMeasurementSemantics.test.js` | Physical Measurement Semantics Contract v0 unit tests |
| `src/features/viewPoseSemantics.js` | View / Pose Semantics Contract v0 (`view-pose-semantics-v0`) — pure deterministic evaluator validating Layer A declared view identity, Layer B 2D structural pose qualification, and Layer C physical orientation certification |
| `src/features/viewPoseSemantics.test.js` | View / Pose Semantics Contract v0 unit tests |
| `src/features/clothingBodySurfaceSemantics.js` | Clothing / Body-Surface Semantics Contract v0 (`clothing-body-surface-semantics-v0`) — pure deterministic domain qualification layer evaluating Layer A clothing participation, Layer B visual garment qualification, and Layer C authoritative empirical body-surface authorization |
| `src/features/clothingBodySurfaceSemantics.test.js` | Clothing / Body-Surface Semantics Contract v0 unit tests |
| `src/features/physicalMeasurementEligibility.js` | Physical Measurement Eligibility Contract v0 (`physical-measurement-eligibility-v0`) & Paired Cross-View Eligibility Contract v0 (`paired-cross-view-eligibility-v0`) — authoritative downstream eligibility gate; Dimension E consumes 4.5G only when a registered authoritative physical-geometry evaluator certifies `validated` / `authorized` / `physicalAuthority.status === 'authoritative'` |
| `src/features/physicalMeasurementEligibility.test.js` | Physical Measurement Eligibility Contract v0 unit tests |
| `src/features/appMode.js` | App mode state (Inspect & Measure vs Annotate) |
| `src/features/selection.js` | Selected point state and highlight (Annotate mode) |
| `src/features/measurement.js` | Canonical shared Point A/B measurement state, markers, line, label, history |
| `src/features/sideMeasurement.js` | Local Side Evidence A/B measurement state (U/Y Euclidean distance) |
| `src/features/frontSurfaceMeasurement.js` | Front Surface advance/read helpers over shared measurement |
| `src/features/projectionLinking.js` | Read-only Front Surface projection of Origin/Center/annotations |
| `src/features/frontSideAlignment.js` | Pure deterministic Front/Side semantic correspondence and vertical Y QA contract |
| `src/features/bodyGraph.js` | Body Graph Contract v0 — deterministic Core 13 graph derivation |
| `src/features/bodyMeasurementLevels.js` | Measurement Reference Levels v0 compute (orphaned / internal helper) |
| `src/features/bodyMeasurementLines.js` | Anatomical Measurement Lines v0 compute (candidate readiness lines) |
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
| `src/ui/workspaceLayout.js` | Workspace tab management (3D / 2D / Body Graph), split divider, and right sidebar rail collapse |
| `src/ui/leftPanel.js` | Anatomical Levels card renderer for the left inspector |
| `src/ui/derivedMeasurementDeck.js` | Right Sidebar Results cards (Shoulder / Hip) |
| `src/ui/advancedQaPanel.js` | Diagnostics Why Blocked + Advanced QA (intake / calibration) |
| `src/ui/collapsibleSections.js` | Shared `[data-collapsible]` accordion wiring for left and right sidebars |
| `src/ui/grid2dNavigator.js` | Front Surface 2D Grid Navigator (X/Y coordinates) |
| `src/ui/sideGrid2dNavigator.js` | Side Evidence 2D Grid Navigator (U/Y coordinates) |
| `src/ui/grid2dNavShared.js` | Shared 2D navigator geometry, zoom/pan transform, and lattice utilities |
| `src/ui/grid2dPlotArea.js` | Shared 2D plot frame, axes, and CSS variable styling |
| `src/ui/bodyEvidencePackageQaUi.js` | Reusable Package QA HTML helper (test / future remount; not currently mounted in Diagnostics) |
| `src/ui/bodyEvidencePackageQaUi.test.js` | Package QA summary UI unit tests |
| `src/ui/bodyEvidencePanel.js` | Body Evidence left workflow panel (Front / Side / Landmark tabs, segmentation lists, inspect card, promote) |
| `src/ui/bodyEvidenceCandidateList.js` | Candidate list DOM rendering with Core / Secondary filters and pill badges |
| `src/ui/bodyEvidenceOverlay2d.js` | Front Surface Body Evidence overlay markers and inspect selection |
| `src/ui/bodyEvidenceOverlaySide2d.js` | Side Evidence overlay markers (shared Core/Secondary colors; diamond/dot shapes) |
| `src/ui/segmentationOverlay2d.js` | Translucent dense semantic segmentation overlays & highlight LUTs with isolated per-view caches |
| `src/ui/segmentationOverlay2d.test.js` | Segmentation overlay rendering, cache isolation, and LUT unit tests |
| `src/ui/segmentationInspection.test.js` | Segmentation inspection, filtering, and Landmark-tab unit tests |
| `src/ui/frontSideAlignmentPanel.js` | Diagnostics → Front–Side Alignment presentation (summary card, collapsible groups, compact rows) |
| `src/ui/bodyGraphWorkspace.js` | Body Graph Workspace v0 — Core 13 topological diagram |
| `src/ui/bodyTabConsolidatedPanel.js` | Diagnostics coordinator for Front–Side Alignment + Body / Anchor readiness |
| `src/ui/measurementPanel.js` | Distance Measurement inspector (Front/Canonical and Side/U-Y subgroups) + Session Records History |
| `src/ui/selectionPanel.js` | Selected Point coordinate readouts inside the Annotation panel |
| `src/ui/annotationControls.js` | Landmark Preset dropdown wiring |
| `src/ui/annotationPanel.js` | Session Records annotation list renderer |
| `src/ui/sceneGraphPanel.js` | Diagnostics Origin / Center projection utility |
| `src/styles/variables.css` | Design tokens and color themes |
| `src/styles/layout.css` | CSS grid layout, workspace panes, and split divider |
| `src/styles/components.css` | Menus, sidebars, tabs, panels, cards, candidate lists, and buttons |
| `src/styles/overlays.css` | 2D navigators, plot grids, markers, measurement overlays, and tooltips |
| `src/style.css` | Stylesheet entry point |
| `index.html` | Main HTML application shell |



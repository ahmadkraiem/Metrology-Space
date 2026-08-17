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
- Visibility is controlled by the left inspector **View Controls** checkbox **Origin / Center** (checked by default); when unchecked, both marker meshes and hover-only labels are hidden and hover does not show labels

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

The app still has two **interaction modes** (Inspect & Measure vs Annotate) that control 3D/2D click behavior. The left Metrology Inspector presents a three-way **Workflow** switch (`#mode-panel`):

| Workflow | Button | Default | Primary left-sidebar panel | Interaction mode effect |
|----------|--------|---------|----------------------------|-------------------------|
| **Inspect & Measure** | `#mode-inspect-measure` | Yes | Distance Measurement | Sets Inspect & Measure mode |
| **Annotate** | `#mode-annotate` | No | Selected Point + annotation controls | Sets Annotate mode |
| **Body Evidence** | `#workflow-body-evidence` | No | Body Evidence panel | Inspector-only — does **not** change app mode |

Body Evidence controls live **only** in the Body Evidence workflow. They do **not** appear inside Annotate. Annotate remains annotation-specific. Inspect & Measure remains measurement-specific.

Workflow visibility is UI-only (`#left-sidebar[data-workflow]`, wired by `src/ui/inspectorWorkflow.js`). Switching to Body Evidence hides Distance Measurement and Selected Point panels without clearing measurement, annotation, or Body Evidence data.

#### Inspect & Measure mode
- Default active mode on load
- Hover works as described above (preview next A/B color)
- Click advances the Point A / Point B measurement flow (see §7)
- Promoted `body_landmark` annotation markers are valid measurement pick targets (see **Body Landmark Measurement Picking v0** in §7)
- **Selected Point panel is hidden** — no annotation input, no Add Annotation, no Clear Selection
- Selection highlight mesh is **not shown** (does not compete with A/B markers)
- Internal selection state is not updated on click; measurement state drives the active interaction
- Distance Measurement panel is the active control panel when that workflow is selected
- Saved annotations remain visible in the scene and in the right Session Data sidebar

#### Annotate mode
- Hover works; hover and selected point use the same orange/amber family
- Click selects a volumetric point only — does **not** set Point A, Point B, or advance measurement
- Clicking promoted `body_landmark` annotations does **not** set Point A/B (Annotate remains annotation-focused)
- **Selected Point panel is visible** after click, showing X, Y, Z in cm
- Annotation name input, **Annotation Type** dropdown (default: Custom), **Landmark Preset** dropdown (default: Custom/manual), **Add Annotation**, and **Clear Selection** are visible
- **Add Annotation** works only in this mode (from the currently selected point, chosen type, and final name in the name input)
- Distance Measurement panel is hidden
- Body Evidence import/actions/promote controls are **not** part of Annotate
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
- **Inspect & Measure mode:** the Selected Point panel and selection highlight are hidden; clicks advance measurement instead

---

## 7. Current Distance Measurement Features

Two-point distance measurement is implemented and working.

### Click flow
1. **First click** → **Point A** (orange marker)
2. **Second click** → **Point B** (magenta marker), line drawn, distance calculated
3. **Third click** (when A and B already set) → starts a new measurement: new Point A, clears Point B and line

In **Inspect & Measure mode**, each click advances this flow only — the Selected Point panel and selection highlight are not shown. Valid click targets include internal lattice / volume points, Front Surface 2D grid points, and promoted `body_landmark` annotation markers (see below).

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
- **Clear Point A**, **Clear Point B**, **Clear Measurement**, and **Clear History** work normally with body-landmark measurements
- Active Point A/B display may show the landmark display name when the point came from a body landmark (session-local UI label only — not a Scene State schema field)

#### Annotate mode
- Clicking promoted body landmarks must **not** set Point A/B
- Annotate remains annotation-focused; body landmark measurement picking does not break annotation creation/editing

#### 2D Workspace (Front-only)
- Promoted `body_landmark` projected markers in the Front-only 2D Workspace can also be clicked in Inspect & Measure to drive the **shared 3D A/B** flow
- Uses the annotation’s stored 3D position (Front Surface promote path typically has front-surface Z; mapping convention remains 2D X→3D X, 2D Y→3D Y, Z = front-surface depth for lattice picks)
- Does **not** re-add independent 2D measurement
- Does **not** re-add Top/Side 2D views

#### Picking priority
1. If a click hits a promoted `body_landmark` marker → use that annotation position as the measurement point
2. Otherwise preserve existing lattice / Front Surface point picking
3. Body Measurement Preview Lines remain visual-only and are **not** pickable
4. Hidden annotations (View Controls **Annotations** unchecked) are not pickable as measurement targets

#### Allowed vs not allowed measurement targets

| Allowed | Not allowed |
|---------|-------------|
| Promoted annotations with `type === "body_landmark"` | Raw Body Evidence candidates |
| | Unpromoted primary / core candidates |
| | Unpromoted secondary candidates |
| | Rejected face/head landmarks |
| | Ignored / deferred landmarks |
| | Side landmarks |
| | Segmentation or masks |
| | Body Measurement Preview Lines |
| | Body Measurement Readiness rows |

#### Relationship to Body workflow
- Body Evidence Import remains evidence/QA only
- Promotion remains **manual**
- Only promoted body landmarks become valid measurement targets
- Body Measurement Readiness remains read-only
- Body Measurement Preview Lines remain visual-only
- Manual A/B measurements between promoted body landmarks are normal user-created measurements and may enter Measurement History
- Automatically shown preview-line / readiness distances do **not** enter Measurement History
- Unpromoted secondary candidates never enter Measurement History

#### Guardrails (Body Landmark Measurement Picking v0)
- Does **not** change metrology scale, cube size, grid spacing, internal sampling, LOD, axes, or point count
- Does **not** change normal A/B measurement state rules
- Does **not** change measurement history schema (history entries remain coordinate-based; optional landmark name is active-panel display only)
- Does **not** change Scene State JSON export/import schema
- Does **not** change annotation data structure or allowed annotation types
- Does **not** change promote behavior or allow duplicate promotion
- Does **not** change Body Evidence Import, core 13 primary behavior, Secondary Body Landmark Candidates v0 allowlist policy, or face/head exclusion
- Does **not** render side landmarks or segmentation/masks
- Does **not** change Body Measurement Readiness calculations
- Does **not** make unpromoted primary or secondary candidates measurable
- Does **not** write Body Measurement Preview distances or unpromoted secondary candidates into measurement history
- Does **not** implement Body Graph or latent space

### Distance Measurement panel layout (named body landmarks)

UI-only layout fix so named body-landmark measurement points display safely in the left inspector:

- Point A / Point B can show a landmark display name plus coordinates in a **stacked / compact** layout
- Long landmark names no longer overflow the left Distance Measurement panel
- Optional landmark name on active A/B remains **session-local display only** (not a Scene State / history schema field)
- Does **not** change measurement calculation
- Does **not** change measurement history schema
- Does **not** change export/import schema

### Distance calculation
3D Euclidean distance in centimeters (true X/Y/Z):

```
sqrt((x2 - x1)² + (y2 - y1)² + (z2 - z1)²)
```

Because **1 scene unit = 1 cm**, the result is directly in cm (displayed to 2 decimal places). Front Surface measurements use the same shared 3D Euclidean math.

### Visuals
- Thin measurement line between A and B (`#b8dcf0`, not thick or glowing)
- **Floating 3D distance label** at the line midpoint via `CSS2DObject` (always faces camera), e.g. `11.18 cm`
- Point A and Point B use distinct colors from hover/selection markers

### Controls
- **Clear Point A** — removes only Point A; keeps Point B if present; removes the active measurement line and floating distance label (distance requires both points); clears selected point and Selected Point panel if the selected point matched Point A; does not clear history
- **Clear Point B** — removes only Point B; keeps Point A if present; removes the active measurement line and floating distance label (distance requires both points); clears selected point and Selected Point panel if the selected point matched Point B; does not clear history
- **Clear Measurement** — removes Point A, Point B, the measurement line, and floating distance label; clears the active measurement panel state; clears selected point if it matched Point A or Point B; does not clear history
- **Clear Selection** — Annotate mode only (panel hidden in Inspect & Measure); clears only the normal selected point highlight and Selected Point panel; does not affect Point A, Point B, line, label, or history

### Measurement history
- Each completed measurement (when Point B is set) is added to the **shared** history — volume clicks, Front Surface clicks, and Body Landmark Measurement Picking v0 all use the same list
- Stores all completed measurements during the current session (newest first)
- Old measurements are **not** automatically removed
- Each entry shows: measurement number, distance, Point A coords, Point B coords
- Front-surface entries (both points on the front face) may show a `Front Surface` meta label
- The history list UI lives in the right Session Data sidebar **History tab** (`#history-panel`, `#history-list`, `#clear-history`)
- Shows an empty state (`#history-empty`) when there are no completed measurements
- Tab content scrolls within the sidebar when needed; all session data is still stored in memory
- **Clear History** clears the shared measurement history
- History persists when the active measurement is cleared
- Shared measurement history is included in Scene State JSON export/import (schema unchanged). 2D UI-only navigator state is **not** exported
- There is **no** separate body measurement history — manual measurements between promoted body landmarks are normal history entries

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
- Each annotation creates a stable 3D visual at the saved coordinate.
- Each annotation visual is a `THREE.Group` positioned once with `group.position.set(x, y, z)`.
- The group contains:
  - a small purple 3D box marker (visually distinct from Annotate hover/selection amber)
  - a `CSS2DObject` label child offset above the marker, e.g. `label.position.set(0, 6, 0)`
- Annotation marker visuals are unchanged by type or preset — type and preset are semantic/naming metadata, not a separate 3D color scheme.
- Annotation labels are anchored to the 3D coordinate and do not follow the mouse.
- Annotation labels are rendered every animation frame using the existing `CSS2DRenderer`.
- Annotation labels use `pointer-events: none`.
- Annotation groups are not recreated or moved during hover, orbit, or camera movement.
- Adding annotations is blocked while OrbitControls dragging is active and outside Annotate mode.
- Annotations remain separate from volumetric pick meshes for lattice hover/selection; Origin/Center marker hover, measurement line, floating distance label, and history are unchanged.
- **Exception (Body Landmark Measurement Picking v0):** in Inspect & Measure mode, promoted `body_landmark` annotation markers are intentional A/B measurement pick targets (stored annotation position). Other annotation types are not measurement targets. In Annotate mode, body landmark clicks do not set Point A/B.
- Annotation delete buttons in the right Session Data sidebar **Annotations tab** remove the correct marker, label DOM node, and list entry.
- Annotation list appears in the **Annotations tab** (`#annotations-panel`, `#annotation-list`) and shows saved annotations with name, **annotation type**, and X/Y/Z coordinates.
- Shows an empty state (`#annotations-empty`) when there are no annotations.
- Add Annotation controls live in the left Selected Point panel (`#annotation-add-controls`) and are visible only in Annotate mode, in this order:
  - `#annotation-type-select` — **Annotation Type** dropdown (default: Custom)
  - `#annotation-preset-select` — **Landmark Preset** dropdown (default: Custom/manual; options depend on selected type)
  - `#annotation-name-input` — **Annotation Name** input
  - `#add-annotation` — **Add Annotation**
- **Landmark Preset** options depend on the selected **Annotation Type** (see preset groups below).
- Selecting a non-`custom` preset auto-fills the **Annotation Name** input with the preset value (e.g. `left_shoulder`, `collar_center`).
- Selecting the `custom` preset does **not** overwrite a manually typed name.
- The user can manually edit the **Annotation Name** input after selecting a preset; manual edits are preserved until a new non-`custom` preset is chosen.
- **Add Annotation** saves `id`, `name`, `type`, and `position` from the currently selected point, chosen type, and final name input value.
- Annotation controls remain **hidden in Inspect & Measure mode**.
- Type, preset, and name inputs reset to defaults when an annotation is added or when leaving Annotate mode (`resetAnnotationControls()`).
- 3D annotation visuals (box markers and CSS2D labels) can be hidden via the left inspector **View Controls** checkbox **Annotations** (checked by default).
- Hiding annotations is **visual only** — annotations are not deleted, remain in the Annotation List, and are still included in Scene State JSON export.
- Creating annotations while **Show Annotations** is unchecked still works normally (stored, listed, exported); new annotations remain hidden in 3D until the checkbox is checked again.
- Import restore recreates annotation 3D visuals but respects the current **Show Annotations** checkbox state.

### Landmark preset groups

Presets are defined in `core/annotationTypes.js` (`LANDMARK_PRESETS_BY_TYPE`). Each group ends with `custom` for manual naming.

**`custom` type:**
- `custom`

**`reference_point` type:**
- `origin_reference`
- `center_reference`
- `floor_reference`
- `wall_reference`
- `custom`

**`body_landmark` type:**
- `head_top`
- `neck_base`
- `left_shoulder`
- `right_shoulder`
- `chest_center`
- `waist_left`
- `waist_right`
- `hip_left`
- `hip_right`
- `left_elbow`
- `right_elbow`
- `left_wrist`
- `right_wrist`
- `left_knee`
- `right_knee`
- `left_ankle`
- `right_ankle`
- `custom`

**`garment_landmark` type:**
- `collar_center`
- `left_collar`
- `right_collar`
- `left_sleeve_end`
- `right_sleeve_end`
- `chest_center`
- `waistline_center`
- `left_waistline`
- `right_waistline`
- `hem_center`
- `left_hem`
- `right_hem`
- `zipper_start`
- `zipper_end`
- `button`
- `custom`

**`measurement_point` type:**
- `measurement_anchor_a`
- `measurement_anchor_b`
- `width_reference`
- `height_reference`
- `depth_reference`
- `custom`

---

## Current View Controls Features

The left Metrology Inspector includes a **View Controls** section (`#view-controls-panel`) with checkboxes grouped into compact visual subgroups. With the default checked layers on, scene behavior matches the previous default visible layers.

### Groups

| Subgroup | Controls |
|----------|----------|
| **Reference** | Origin / Center |
| **Scene Overlays** | Annotations, Measurement Lines |
| **Grid / Points** | 3D Lattice Points, 2D Grid Points |
| **Evidence** | Body Evidence Overlay, Secondary Body Candidates, Body Measurement Previews |

Checkbox labels are short (no leading “Show ”). Defaults: Origin / Center, Annotations, Measurement Lines, 3D Lattice Points, 2D Grid Points, and Body Measurement Previews are **checked**; Body Evidence Overlay is **unchecked**. Secondary Body Candidates is enabled after analyze when secondary allowlist landmarks are present (then checked when visible); otherwise disabled.

### Origin / Center (`#show-origin-center`)

- Controls 3D visibility of the Origin and Center reference marker meshes and their hover-only CSS2D labels.
- Also controls **2D projected** Origin and Center reference markers in the Grid Navigator (`#grid2d-markers`).
- When unchecked, both 3D markers and projected 2D Origin/Center markers are hidden; Origin/Center hover labels do **not** appear in 3D while hidden.
- Re-checking restores 3D markers, projected 2D markers, and normal 3D hover label behavior.
- Does not affect reference marker positions, Scene Graph rows, or Scene State JSON export/import.

### Annotations (`#show-annotations`)

- Controls **3D** annotation visuals:
  - annotation box markers
  - annotation CSS2D labels
- Also controls **2D projected** annotation markers in the Grid Navigator when present.
- Does **not** remove annotations from session data, the Annotation List, Scene Graph, or Scene State JSON export.
- Does **not** block annotation creation in Annotate mode — new annotations are stored, listed, and exported normally but remain hidden in 3D and in 2D projection until re-checked.
- Import restore recreates annotation 3D visuals but respects the current checkbox state.

### 3D Lattice Points (`#show-3d-lattice-points`)

- Controls visibility of the **internal 3D volumetric point lattice only** (LOD InstancedMesh layers).
- When unchecked, lattice cube markers are hidden.
- Does **not** hide axes, cube shell / surface grid, Origin/Center markers, measurement A/B markers, measurement line/label, annotations, hover highlight, or selection highlight.
- Does **not** delete lattice data, change sampling/LOD rules, or affect Scene State JSON.

### 2D Grid Points (`#show-2d-grid-points`)

- Controls visibility of **2D Grid Navigator lattice sample points only**.
- When unchecked, 2D sample points are hidden.
- Does **not** hide 2D axes/gutters, boundaries, labels, selection chrome, projected 3D reference markers, Body Evidence overlay markers, or the shared front-surface measurement markers/line/label.
- Does **not** delete 2D refinement state, measurement state, or history.

### Measurement Lines (`#show-measurement-lines`)

- Controls visual measurement **lines and distance labels** for both **3D** and **2D** measurements.
- When unchecked, the 3D measurement line and floating CSS2D distance label are hidden, and the 2D measurement line/label are hidden.
- Does **not** hide 3D or 2D Point A/B markers.
- Does **not** delete active measurement data, history, or annotations.

### Body Evidence Overlay (`#show-body-evidence-overlay`)

- Lives under the **Evidence** subgroup — the single authoritative checkbox for **primary/core** Body Evidence overlay visibility (no duplicate control in the Body Evidence panel).
- Controls visibility of the **core 13 front** Body Evidence overlay markers on the Front Surface 2D Workspace overlay layer (`#grid2d-body-evidence-markers`).
- Unchecked by default; enabled only after Body Evidence is analyzed and at least one renderable/promotable core front overlay landmark exists.
- Does **not** create annotations, measurements, or Scene Graph nodes.
- Does **not** participate in Scene State JSON export/import.
- Does **not** delete Body Evidence sources, QA results, or loaded files when unchecked.
- Does **not** replace **Secondary Body Candidates** — secondary unpromoted visuals have their own checkbox.
- See **Current Body Evidence Features** for fixed v0 scale assumptions, landmark classification, image→cm mapping, and click guardrails.

### Secondary Body Candidates (`#show-secondary-body-candidates`)

- Lives under the **Evidence** subgroup.
- Controls visibility of **unpromoted Secondary Body Landmark Candidates v0** only (Front Surface overlay secondary markers and the left Secondary Body Landmark Candidates list).
- Enabled after Body Evidence is analyzed when at least one secondary allowlist landmark is present; otherwise disabled.
- Hides/shows **only** unpromoted secondary candidate visuals / list.
- Does **not** hide primary / core candidates.
- Does **not** hide promoted annotations.
- Does **not** hide Body Evidence Overlay primary points.
- Does **not** hide Body Measurement Preview Lines.
- Does **not** change Body Measurement Readiness calculations.
- Does **not** create annotations, measurements, or Scene Graph nodes.
- Does **not** participate in Scene State JSON export/import (checkbox state is UI-only).
- Wired with other Body Evidence Evidence checkboxes from the Body Evidence panel path (same View Controls markup).

### Body Measurement Previews (`#show-body-measurement-previews`)

- Lives under the **Evidence** subgroup.
- Controls visibility of **Measurement Line Preview Overlay v0** anatomical preview lines only (3D scene group and/or Front Surface 2D preview layer).
- Checked / on by default.
- When enabled, Ready anatomical preview lines are visible.
- When disabled, anatomical preview lines are hidden.
- Affects **only** Body Measurement Preview lines.
- Does **not** affect the normal A/B **Measurement Lines** checkbox.
- Does **not** hide promoted annotation markers.
- Does **not** hide Body Evidence Overlay.
- Does **not** hide Secondary Body Candidates.
- Does **not** change Body Measurement Readiness calculations.
- Does **not** change export/import.
- Does **not** participate in Scene State JSON export/import (checkbox state is UI-only).
- See **Measurement Line Preview Overlay v0** for candidate pairs, visual-only guardrails, and refresh behavior.

### UI-only state

- View control checkbox state is **not** exported or imported.
- Left Metrology Inspector section **collapse state** is also UI-only (see UI State) — not exported/imported and must not reset measurements, annotations, Body Evidence, or overlay visibility.
- Hiding visual layers is **visual only** — it does **not** delete data or history.
- Scene State JSON export/import schema is unchanged.

---

## Current Body Evidence Features

Body Evidence is a dedicated left Metrology Inspector **workflow / panel** (`#body-evidence-panel`, workflow `#workflow-body-evidence`). It is a separate **evidence layer** — **body-only**. Face/head landmarks are rejected/excluded. The face pipeline is separate and is **not** part of this body pipeline.

Body Evidence is **separate from Annotate** and **separate from Inspect & Measure**:

- **Annotate** remains annotation-only
- **Inspect & Measure** remains measurement-only
- Body Evidence controls live only in the Body Evidence workflow

Imported body evidence is **conceptual / mock evidence** for now — not trusted ground truth. Body Evidence normalized / raw imported state is stored separately from:

- measurement A/B (and measurement history)
- annotations (except when the user manually **Promotes** a selected landmark into a normal `body_landmark` annotation)
- Scene Graph (Body Evidence itself is not listed; promoted annotations are)
- Scene State export/import (Body Evidence itself is **not** included)

Body Evidence is **not** promoted to Body Graph. Review Status is **not** implemented. Latent space is **not** implemented.

### Supported files (Import v0)

Body Evidence Import currently uses **only** these four inputs:

| Control | Input ID | Role |
|---------|----------|------|
| Load Front Pose JSON | `#load-front-pose-json` | Front pose landmarks |
| Load Side Pose JSON | `#load-side-pose-json` | Side pose landmarks (parsed / QA-counted; **not** rendered) |
| Load Front Seg JSON | `#load-front-seg-json` | Front segmentation metadata (parsed / QA-only; **masks not rendered**) |
| Load Side Seg JSON | `#load-side-seg-json` | Side segmentation metadata (parsed / QA-only; **masks not rendered**) |

**Result / Scale JSON is no longer imported.**

- It is **not** required
- It is **not** optional
- It is **not** used as debug metadata
- Do **not** bring Result / Scale JSON back unless explicitly requested

### Fixed Body Evidence Import v0 scale assumptions

Body Evidence v0 assumes a fixed normalized body-processing canvas. Scale is **not** detected from uploaded Result / Scale JSON.

Owned by `src/features/bodyEvidenceAdapter.js` (`BODY_EVIDENCE_V0_SCALE` / `createFixedBodyEvidenceScale`) and `src/features/bodyEvidence.js` (`getBodyEvidenceScaleInfo`).

| Field | Fixed v0 value |
|-------|----------------|
| `canvasSize` | `2000` |
| `imageWidth` | `2000` |
| `imageHeight` | `2000` |
| `pixelsPerCm` | `10` |
| px/cm relationship | **1 cm = 10 px** |
| `heightCm` | postponed / **not used yet** |
| `status` / source | fixed Body Evidence v0 assumption (`body-evidence-v0-fixed`) |

These fixed assumptions feed overlay mapping and diagnostic export. They do **not** join Scene State JSON.

### Actions

| Control | ID | Role |
|---------|-----|------|
| Analyze Body Evidence | `#analyze-body-evidence` | Runs adapter/normalize + QA over loaded pose/seg sources |
| Download Body Evidence JSON | `#download-body-evidence-json` | Diagnostic download of normalized/analyzed evidence |
| Clear Body Evidence | `#clear-body-evidence` | Clears only Body Evidence sources, QA, overlay state, selection, and panel status |

Clear Body Evidence does **not** clear measurements, annotations (including already-promoted ones), history, or Scene State.

### Left Body Evidence panel layout / workflow

Body Evidence controls are grouped in the left workflow panel:

1. **Import Files** — four load controls (front/side pose, front/side seg); **collapsible** subgroup
2. **Actions** — Analyze / Download / Clear; **collapsible** subgroup
3. **Summary** — compact always-visible key status (no QA details here)
4. **Primary / Core Body Landmark Candidates** — core 13 front anchors only
5. **Secondary Body Landmark Candidates** — Secondary Body Landmark Candidates v0 allowlist only; title shows a count
6. **Current Selected Body Landmark** — compact selected-landmark summary (primary or secondary)
7. **Promote Selected Landmark** — manual promote of the current selection (primary or secondary)
8. **Clear Selection** — clears only Body Evidence landmark selection

Always-visible compact Summary (`#body-evidence-summary`):

- **Landmarks** count (`#body-evidence-overlay-count`) — **renderable/core front anchors only**, not total parsed landmarks
- Secondary candidate count (`#body-evidence-secondary-count`) when shown
- Scale status (`#body-evidence-overlay-scale`) — fixed v0 assumption (`10 px/cm`, `2000×2000`) after analyze
- Loaded / analyzed status (`#body-evidence-analysis-status`)
- Evidence source summary (`#body-evidence-source-summary`)
- Ephemeral status messages (`#body-evidence-status`)

QA details are **not** shown in the left panel. After **Body Tab Consolidation v0**, the right Session Data **Body** tab shows a compact consolidated layout: Body Evidence Status, Promoted Body Anchors, and Body Measurement Readiness (see below).

### Body Landmark classification / visibility

Owned by `src/features/bodyEvidenceAdapter.js` (classification / core whitelist / secondary allowlist) and `src/features/bodyEvidence.js` (`getRenderableFrontBodyLandmarks`, `getSecondaryFrontBodyLandmarks` for UI/overlay).

Important terminology:

| Term | Meaning |
|------|---------|
| **Parsed landmarks** | All pose landmarks read from imported pose JSON files for analysis/QA |
| **Rejected face/head landmarks** | Face/head/identity-related landmarks excluded from the body-only pipeline |
| **Ignored / deferred landmarks** | Body-looking points outside core 13 and outside the secondary allowlist — QA-counted only |
| **Primary / core anchors (core 13)** | Front landmarks shown as Primary/Core candidates, Body Evidence Overlay primary points, and eligible for manual Promote |
| **Secondary Body Landmark Candidates v0** | Optional future-use front-only allowlisted landmarks — visual/selectable/promotable only until promoted |

This is a **positive whitelist** model:

- The UI must **not** show all non-face landmarks
- Primary Body Landmark Candidates and Body Evidence Overlay primary markers stay restricted to the **core 13 front anchors**
- Secondary candidates use a **separate explicit allowlist** (not “everything else”)
- The Summary **Landmarks** count represents renderable/core front anchors, **not** total parsed landmarks

#### Face/head behavior

- Face/head landmarks are **rejected/excluded** from the body pipeline
- They may be parsed for QA counts only
- They are **not** rendered
- They are **not** shown as Body Landmark Candidates (primary or secondary)
- They cannot be selected or promoted
- They are **not** converted to annotations
- They are **not** included in Scene State export/import

Face/head examples (remain rejected/excluded): `nose`, `eye`, `iris`, `pupil`, `ear`, `mouth`, `jaw`, `chin`, `eyebrow`, `face`, `hair`, `head`, `head_top`, `lips`, `concha`, `helix`

#### Secondary Body Landmark Candidates v0 — allowlist policy

Secondary body candidates are **optional future-use landmarks**. Core 13 primary body candidates remain unchanged.

Policy:

- Secondary candidates are **front-only**
- Secondary candidates are **visual / selectable / promotable only until promoted**
- Secondary candidates do **not** affect Body Measurement Readiness
- Secondary candidates do **not** affect Measurement Preview Lines
- Secondary candidates do **not** enter Scene State JSON unless promoted
- Secondary candidates are **not** A/B measurement targets until promoted
- Duplicate promotion remains blocked (same `body_landmark` name)

**Secondary allowlist v0** — only these front pose landmarks are shown as secondary candidates when present:

- `left_acromion`
- `right_acromion`
- `left_heel`
- `right_heel`
- `left_big_toe`
- `right_big_toe`
- `left_small_toe`
- `right_small_toe`

Rationale:

- **Acromion** helps refine shoulder reference
- **Heel / big toe / small toe** help future foot stance, ground contact, and alignment work
- Finger / thumb / dense hand joints are deferred because they are too detailed/noisy for the current body metrology stage

#### Deferred / ignored for now

These remain parsed for QA when present but are **not** secondary candidates and are **not** rendered/promotable:

- Thumb joints
- Finger joints
- Middle / ring / pinky finger joints
- Dense hand landmarks
- Unstable model-specific extras
- Unknown body-looking extras not in the secondary allowlist

#### Ignored / deferred body behavior

- Points outside core 13 and outside the secondary allowlist may be parsed for QA/total counts
- They are **not** face/head rejected, but they are **ignored/deferred** in v0
- They are **not** rendered
- They are **not** shown as primary or secondary candidates
- They cannot be promoted in v0
- They do **not** enter Scene State export/import

Ignored/deferred examples: finger, thumb, palm, hand details, dense contour points, silhouette extras, model-specific additional landmarks, foot/heel/toe vocabulary **outside** the secondary allowlist (e.g. unstable `foot_index`-style extras)

#### Core 13 primary / front anchors (unchanged)

Only these accepted front landmarks are primary/core candidates, Body Evidence Overlay primary markers, and always eligible for manual promote:

- `neck`
- `left_shoulder`
- `right_shoulder`
- `left_elbow`
- `right_elbow`
- `left_wrist`
- `right_wrist`
- `left_hip`
- `right_hip`
- `left_knee`
- `right_knee`
- `left_ankle`
- `right_ankle`

#### Secondary candidate UI behavior

- Left Body Evidence workflow lists:
  - **Primary / Core Body Landmark Candidates**
  - **Secondary Body Landmark Candidates** (title shows a count)
- Secondary candidates can be selected
- Selecting a secondary candidate updates **Current Selected Body Landmark**
- **Promote Selected Landmark** works for secondary candidates
- Duplicate promotion remains blocked
- Promoted secondary candidates become normal annotations where `annotation.type === "body_landmark"`
- After promotion they:
  - appear in Annotation List
  - appear in Scene Graph
  - appear as 3D/2D annotation visuals where supported
  - are included in Scene State JSON as normal annotations
  - can be measured using existing Body Landmark Measurement Picking
- Until promoted they remain evidence-only (no readiness / preview-line / Scene State / A/B effects)

### Session Data → Body tab

**Body Tab Consolidation v0** is the current visible layout. It is a UI / information-architecture cleanup only: underlying Body Evidence, promotion, annotation, audit, reference-level, and measurement-line logic remains behaviorally unchanged. No Scene State JSON schema changes. No Body Graph. No latent space.

Owned by:

- Consolidated Body tab UI: `src/ui/bodyTabConsolidatedPanel.js` (`setupBodyTabConsolidatedPanel`)
- Body Evidence QA data: `src/features/bodyEvidence.js` (`getBodyEvidenceQa`)
- Body Anchor Audit compute (reused internally): `src/features/bodyEvidence.js` (`buildBodyAnchorAudit`)
- Anatomical Measurement Lines compute (reused internally): `src/features/bodyMeasurementLines.js` (`buildAnatomicalMeasurementLines`)
- Measurement Reference Levels compute (still available internally): `src/features/bodyMeasurementLevels.js` (`buildMeasurementReferenceLevels`)
- Historical / superseded separate panel modules (not wired from `main.js` for visible layout): `src/ui/bodyEvidenceQaPanel.js`, `src/ui/bodyMeasurementLevelsPanel.js`, `src/ui/bodyMeasurementLinesPanel.js`

Panel root: `#tab-panel-body`.

#### Visible Body tab organization (display order)

1. **Body Evidence Status** (`#body-evidence-status-panel`, `#session-body-evidence-status`)
2. **Promoted Body Anchors** (`#promoted-body-anchors-panel`) — compact read-only table of current `body_landmark` annotations
3. **Body Measurement Readiness** (`#body-measurement-readiness-panel`, `#body-measurement-readiness`) — consolidated user-facing readiness / QA view

These old separate panels are **no longer shown separately by default** in the visible Body tab:

- Body Anchor Coordinate Audit
- Measurement Reference Levels
- Anatomical Measurement Lines

Their useful user-facing information is folded into **Body Measurement Readiness**. The consolidation changed the **display**, not the data model. Compute helpers may still exist and be reused internally.

Rules:

- No primary Body Evidence action controls such as Promote, Clear Selection, Import, or Analyze here
- Left panel stays controls/workflow focused; right Body tab stays data/details focused
- Promoted Body Anchors and Body Measurement Readiness annotation-driven rows do **not** read raw Body Evidence state
- Body Evidence Status reads analyzed Body Evidence QA only
- Anatomical measurement distances shown in readiness are preview/debug/readiness values, **not** final certified body measurements
- Current Body Evidence remains conceptual/mock-quality until stronger model outputs arrive

#### Consolidated Body tab refresh behavior

The consolidated Body tab refreshes when:

- Body Evidence JSON is imported / analyzed / cleared
- a core 13 body landmark is promoted
- a promoted `body_landmark` annotation is deleted
- Scene State JSON is imported / restored
- annotation state changes through existing app logic

#### Body Evidence Status

Compact summary of body evidence state (`#session-body-evidence-status`) — **counts only** in the compact card (no long landmark-name lists inline):

- Evidence status: **Loaded** / empty state when none analyzed
- Loaded files count and simple loaded indicators (`frontPose`, `sidePose`, `frontSeg`, `sideSeg`)
- Primary / core candidates count (e.g. `13 / 13` against the core-13 whitelist)
- Secondary candidates count
- Ignored / deferred count
- Rejected face/head count
- Low confidence count
- Fixed scale assumption: canvas **2000 × 2000**, **10 px/cm**
- Segmentation: **QA only**

**Advanced Evidence Details** are collapsed by default and use readable / collapsible details for longer lists (Session Data → Body cleanup so long landmark-name lists are no longer cramped inline text). Advanced details may include loaded files, total landmarks, accepted/rejected counts, front/side counts, secondary front candidates, front ignored/deferred, segmentation classes, canvas size, and dtype/shape details.

If shown, these longer name lists use readable details subsections (not noisy compact summary rows):

- Secondary Candidates
- Ignored / Deferred
- Rejected Face / Head
- Rejected Segmentation Classes (when present)

Compact summary should **not** become noisy — keep counts in the summary card; put long name lists in Advanced Evidence Details only.

Segmentation **label base64** remains excluded from normalized diagnostic export. Diagnostic segmentation metadata includes **`labelShape`** and **`labelDtype` only** (plus class names/counts) — not raw mask payloads.

#### Body Measurement Readiness

Consolidated user-facing panel combining useful visible information from:

- Body Anchor Coordinate Audit
- Measurement Reference Levels
- Anatomical Measurement Lines

Shows compact overall warnings / status:

- Missing core anchors count
- Duplicate body anchor names count
- Out-of-bounds count
- Front-surface Z warning count
- Overall status: **Ready** / **Needs review**

Shows measurement candidate rows (from Anatomical Measurement Lines v0) with:

- Measurement name
- **Ready** / **Missing** status
- Distance cm if Ready (rounded to 2 decimals)
- Missing anchors if Missing
- Anchor pair as secondary text

Distance numbers for Ready candidates live **here only** (Body Measurement Readiness). Measurement Line Preview Overlay v0 may draw the Ready geometry as visual lines in 3D/2D but does **not** overlay distance labels on those lines.

### Promoted Body Anchors Summary v0

Owned by `src/ui/bodyTabConsolidatedPanel.js` (`#promoted-body-anchors-panel`, `#promoted-body-anchors-count`, `#promoted-body-anchors-empty`, `#promoted-body-anchors-list`).

Read-only Session Data → Body section **Promoted Body Anchors**:

- Compact read-only table/list instead of a long card-per-anchor layout
- Reads **only** from current annotations
- Lists annotations where `annotation.type === "body_landmark"`
- Shows total count
- Shows an empty state when none exist
- Columns / fields:
  - Name (display label)
  - X
  - Y
  - Z
  - `source` **only if already available** on the annotation object — do **not** invent source
- Does **not** mutate annotations
- Updates with the consolidated Body tab refresh behavior above
- Read-only:
  - no promote action here
  - no delete action here
  - no editing here
  - no new schema
- This is **not** Body Graph
- This is **not** latent space
- This does **not** change export/import schema

### Body Anchor Coordinate Audit v0

Owned by:

- Compute helper: `src/features/bodyEvidence.js` (`buildBodyAnchorAudit`)
- Core checklist / name normalize: `src/features/bodyEvidenceAdapter.js` (`CORE_FRONT_BODY_ANCHORS`, `normalizeLandmarkName`)
- Front-surface Z rule: existing `FRONT_SURFACE_DEPTH_CM` / `isOnFrontSurface()` in `src/core/frontSurface.js` (must not invent a conflicting Z rule)
- Room bounds: existing `ROOM_SIZE` (`0` to `200` cm) in `src/core/constants.js`
- Visible UI: compact overall warnings inside **Body Measurement Readiness** (`src/ui/bodyTabConsolidatedPanel.js`) — the separate Body Anchor Audit panel is no longer shown by default

Read-only QA of promoted body anchors (logic unchanged; display consolidated):

- Reads **only** from current annotations
- Only considers annotations where `annotation.type === "body_landmark"`
- Does **not** read raw Body Evidence state
- Does **not** mutate annotations, measurement state, Body Evidence state, app mode, or export/import state

#### Audit checks (shown compactly in Body Measurement Readiness)

- Missing core anchors count
- Duplicate body anchor names count
- Out-of-bounds count
- Front-surface Z warning count
- Status label:
  - **Ready** when all checks pass
  - **Needs review** when missing / duplicates / out-of-bounds / Z warnings exist

#### Core anchors checked

Same core-13 checklist used elsewhere in Body Evidence:

- `neck`
- `left_shoulder`
- `right_shoulder`
- `left_elbow`
- `right_elbow`
- `left_wrist`
- `right_wrist`
- `left_hip`
- `right_hip`
- `left_knee`
- `right_knee`
- `left_ankle`
- `right_ankle`

#### Name normalization

Audit comparison normalizes body landmark names before checking (via `normalizeLandmarkName`):

- lowercase
- trim
- spaces / hyphens converted to underscores

#### Validation rules

- **Missing anchor** = a core anchor not present among promoted `body_landmark` annotations (by normalized name)
- **Duplicate name** = more than one `body_landmark` annotation with the same normalized name
- **Out-of-bounds** = x / y / z outside the fixed REVacity room bounds
- **Room bounds** remain **0 to 200 cm** for X / Y / Z
- **Front-surface Z warning** = promoted body anchor is not on the existing expected front-surface Z used by current 2D Workspace mapping (`FRONT_SURFACE_DEPTH_CM` / `isOnFrontSurface`)
- The audit must use that existing front-surface Z rule and must **not** introduce a conflicting Z rule

#### Boundaries

- Body Anchor Audit is **QA only**
- It is **not** Body Graph
- It is **not** latent space
- It does **not** create measurements
- It does **not** auto-promote landmarks
- It does **not** change Body Evidence import parsing
- It does **not** change Body Landmark Candidates filtering
- It does **not** change promotion behavior
- It does **not** change Scene State JSON export/import schema
- Raw Body Evidence remains UI/session evidence only and is not exported/imported
- Promoted `body_landmark` annotations remain exported/imported only because they are normal annotations

### Measurement Reference Levels v0

Owned by:

- Compute helper: `src/features/bodyMeasurementLevels.js` (`buildMeasurementReferenceLevels`, `MEASUREMENT_REFERENCE_LEVELS`)
- Name normalize: `src/features/bodyEvidenceAdapter.js` (`normalizeLandmarkName`)
- Distance helper: existing `calculateDistance` in `src/core/math.js`
- Visible UI: useful paired-span / readiness information is folded into **Body Measurement Readiness**; the separate Measurement Reference Levels panel is no longer shown by default (`src/ui/bodyMeasurementLevelsPanel.js` is a superseded historical stub)

Read-only organization of promoted `body_landmark` annotations into anatomical reference levels (logic may still exist internally):

- Reads **only** from current annotations where `annotation.type === "body_landmark"`
- Does **not** read raw Body Evidence state
- Does **not** use unpromoted Body Evidence candidates
- Does **not** use rejected/ignored landmarks
- Does **not** use side landmarks
- Does **not** use segmentation or masks
- Does **not** mutate annotations, measurement A/B, measurement history, Body Evidence state, app mode, or export/import state

#### Levels (v0)

Chest / bust / waist levels are **postponed** (not in core 13; not shown unless explicitly added later).

| Level | Required anchors |
|-------|------------------|
| Neck Level | `neck` |
| Shoulder Level | `left_shoulder`, `right_shoulder` |
| Elbow Level | `left_elbow`, `right_elbow` |
| Wrist Level | `left_wrist`, `right_wrist` |
| Hip Level | `left_hip`, `right_hip` |
| Knee Level | `left_knee`, `right_knee` |
| Ankle Level | `left_ankle`, `right_ankle` |

**Ready does not mean** landmark positions are final or perfectly accurate. Current Body Evidence remains conceptual/mock-quality; any spans are QA/debug previews, **not** final body measurements.

#### Paired spans (read-only)

When both anchors of a paired level exist, Euclidean 3D distance may be shown as a readiness/preview value:

- Shoulder span (`left_shoulder` → `right_shoulder`)
- Elbow span (`left_elbow` → `right_elbow`)
- Wrist span (`left_wrist` → `right_wrist`)
- Hip span (`left_hip` → `right_hip`)
- Knee span (`left_knee` → `right_knee`)
- Ankle span (`left_ankle` → `right_ankle`)

Span / distance rules:

- Calculated from existing promoted annotation positions (Euclidean 3D distance via existing `calculateDistance`)
- Displayed rounded to 2 decimals
- **Not** saved into annotations
- **Not** added to measurement history
- **Not** exported
- Appear only when both paired anchors are present

#### Boundaries

- Measurement Reference Levels are **QA / organization only**
- This is **not** Body Graph
- This is **not** latent space
- This does **not** generate measurements
- This does **not** create annotations
- This does **not** mutate measurement A/B
- This does **not** change Body Evidence Import behavior
- This does **not** change face/head exclusion rules
- This does **not** render side landmarks
- This does **not** render segmentation or masks
- This does **not** change Scene State JSON export/import schema
- This does **not** change 2D Workspace behavior

### Anatomical Measurement Lines v0

Owned by:

- Compute helper: `src/features/bodyMeasurementLines.js` (`buildAnatomicalMeasurementLines`, `ANATOMICAL_MEASUREMENT_LINES`)
- Name normalize: `src/features/bodyEvidenceAdapter.js` (`normalizeLandmarkName`)
- Distance helper: existing `calculateDistance` in `src/core/math.js`
- Visible UI: measurement candidate rows inside **Body Measurement Readiness** (`src/ui/bodyTabConsolidatedPanel.js`) — the separate Anatomical Measurement Lines panel is no longer shown by default (`src/ui/bodyMeasurementLinesPanel.js` is a superseded historical stub)

Exists in Session Data → Body as part of the Body measurement / readiness workflow. Read-only QA / organization layer.

- Derives anatomical measurement candidate lines from already-promoted annotations where `annotation.type === "body_landmark"`
- Does **not** read raw Body Evidence directly
- Does **not** use unpromoted candidates
- Does **not** use rejected/ignored landmarks
- Does **not** use side landmarks
- Does **not** use segmentation or masks
- Compute itself does **not** own 3D/2D line rendering — Ready geometry may be drawn by the separate **Measurement Line Preview Overlay v0** (visual-only; no distance labels on the lines)
- Does **not** create normal A/B measurements
- Does **not** write to measurement history
- Does **not** change Scene State JSON export/import schema

#### Measurement candidate lines (v0)

| Measurement | Anchor pair |
|-------------|-------------|
| Shoulder Width | `left_shoulder` → `right_shoulder` |
| Elbow Span | `left_elbow` → `right_elbow` |
| Wrist Span | `left_wrist` → `right_wrist` |
| Hip Width | `left_hip` → `right_hip` |
| Knee Span | `left_knee` → `right_knee` |
| Ankle Span | `left_ankle` → `right_ankle` |

#### Distance behavior

- If both anchors exist: row status is **Ready**
- Distance is calculated from promoted annotation positions in cm
- Distance uses x/y/z Euclidean distance (`calculateDistance`)
- Distance is displayed rounded to 2 decimals **only in Session Data → Body / Body Measurement Readiness**
- Distance is read-only
- Distance is **not** overlaid as labels above preview lines in 3D or 2D
- Distance is **not** saved into annotations
- Distance is **not** exported
- Distance is **not** added to measurement history
- If one or both anchors are missing: row status is **Missing** and missing anchors are shown

Anatomical measurement distances remain preview/debug/readiness values, **not** final certified body measurements. Current Body Evidence remains conceptual/mock-quality until stronger model outputs arrive.

#### Boundaries

- Anatomical Measurement Lines are **QA / organization / readiness only**
- This is **not** Body Graph
- This is **not** latent space
- This does **not** generate normal A/B measurements
- This does **not** create annotations
- This does **not** mutate measurement A/B
- This does **not** change Body Evidence Import behavior
- This does **not** change face/head exclusion rules
- This does **not** render side landmarks
- This does **not** render segmentation or masks
- This does **not** change Scene State JSON export/import schema
- Visual Ready-line drawing is owned by **Measurement Line Preview Overlay v0**, not by this compute/readiness layer

### Measurement Line Preview Overlay v0

Owned by:

- Preview overlay: `src/features/bodyMeasurementPreview.js` (`getReadyBodyMeasurementPreviewLines`, `createBodyMeasurementPreviewGroup`, `setupBodyMeasurementPreview`, `refreshBodyMeasurementPreview`, `renderBodyMeasurementPreview2d`, `setBodyMeasurementPreviewVisible`)
- Candidate compute (reused): `src/features/bodyMeasurementLines.js` (`buildAnatomicalMeasurementLines`)
- View Controls wiring: `src/ui/viewControls.js` (`#show-body-measurement-previews`)
- Front Surface 2D redraw hook: `src/ui/grid2dNavigator.js` (calls `renderBodyMeasurementPreview2d`)
- 2D layer markup: `#grid2d-body-measurement-previews` in `index.html`; styles in `src/styles/overlays.css`

Renders anatomical measurement **preview lines** visually on Ready body measurement candidates. Preview lines use the **same** body measurement candidates shown in Session Data → Body / Body Measurement Readiness.

#### Source rules

- Preview lines are derived **only** from promoted annotations where `annotation.type === "body_landmark"`
- Same candidate pairs as Anatomical Measurement Lines / Body Measurement Readiness:

| Measurement | Anchor pair |
|-------------|-------------|
| Shoulder Width | `left_shoulder` → `right_shoulder` |
| Elbow Span | `left_elbow` → `right_elbow` |
| Wrist Span | `left_wrist` → `right_wrist` |
| Hip Width | `left_hip` → `right_hip` |
| Knee Span | `left_knee` → `right_knee` |
| Ankle Span | `left_ankle` → `right_ankle` |

- A preview line is rendered **only** when both required anchors exist (Ready)
- Missing measurement candidates do **not** render preview lines

#### Visual scope (visual-only)

- Preview lines are **visual-only**
- They are **not** normal A/B measurements
- They are **not** added to measurement history
- They are **not** saved into annotations
- They are **not** exported
- They do **not** change Scene State JSON schema
- They do **not** create Body Graph data
- They do **not** implement latent space
- They do **not** use raw Body Evidence directly
- They do **not** use unpromoted candidates
- They do **not** use rejected/ignored landmarks
- They do **not** use side landmarks
- They do **not** render segmentation or masks
- They do **not** display distance labels in 3D or 2D — distance numbers remain in Session Data → Body / Body Measurement Readiness only

#### 2D / 3D behavior

- Preview lines may appear on the **3D scene** and/or the **Front-only 2D Workspace** depending on current implementation (both are wired in v0)
- In 2D, preview lines are visual-only on the Front Surface (`#grid2d-body-measurement-previews`, `pointer-events: none`)
- 2D preview lines do **not** affect 2D click measurement
- 2D preview lines do **not** re-add independent 2D measurement
- 2D preview lines do **not** re-add Top/Side views

#### Visibility control

- Left sidebar View Controls → Evidence → **Body Measurement Previews** (`#show-body-measurement-previews`)
- Default state is checked / on
- When enabled, Ready anatomical preview lines are visible
- When disabled, anatomical preview lines are hidden
- This control affects **only** Body Measurement Preview lines
- It does **not** affect the normal A/B **Measurement Lines** checkbox
- It does **not** hide promoted annotation markers
- It does **not** hide Body Evidence Overlay
- It does **not** change Body Measurement Readiness calculations
- It does **not** change export/import

#### Refresh behavior

Preview lines refresh when:

- a core 13 body landmark is promoted
- a promoted `body_landmark` annotation is deleted
- Scene State JSON is imported / restored
- annotation state changes through existing app logic
- **Body Measurement Previews** visibility changes

#### Boundaries / guardrails

- Do **not** change metrology scale, cube size, grid spacing, internal sampling, LOD, axes, or point count
- Do **not** change normal A/B measurement behavior
- Do **not** change normal Measurement Lines checkbox behavior
- Do **not** change 2D front-surface measurement behavior
- Do **not** re-add Top/Side 2D views
- Do **not** re-add independent 2D measurement
- Do **not** change Body Evidence Import behavior
- Do **not** change core 13 filtering
- Do **not** change face/head exclusion rules
- Do **not** render side landmarks
- Do **not** render segmentation or masks
- Do **not** change annotation data structure
- Do **not** change promote behavior
- Do **not** change Scene State JSON export/import schema
- Do **not** implement Body Graph
- Do **not** implement latent space
- Do **not** overlay distance labels on preview lines — distances stay in Body Measurement Readiness only
- Preview overlay rendering is **separate** from normal A/B measurement line rendering

### Adapter / filtering

Owned by `src/features/bodyEvidenceAdapter.js` + `src/features/bodyEvidence.js`.

- Parses body-processing JSON into a normalized internal QA schema (`body-evidence-v0`)
- Classifies landmarks into parsed / rejected face-head / ignored-deferred / core-13 primary / Secondary Body Landmark Candidates v0 allowlist sets
- Rejects / excludes face and head landmarks from the body pipeline
- Tracks low-confidence landmarks for QA
- Parses side landmarks for QA counts but does **not** render them
- Parses segmentation class metadata for QA; segmentation **masks are not rendered**
- Applies fixed Body Evidence v0 scale assumptions (no Result / Scale JSON)

### Diagnostic Body Evidence JSON download

- **Download Body Evidence JSON** exports normalized/analyzed Body Evidence for inspection only
- Separate from **Export Scene JSON** / Scene State import
- Does **not** change or participate in Scene State export/import schema
- Excludes raw uploaded sources, raw image blobs, and huge segmentation label / base64 mask payloads
- Includes diagnostic QA summary, loaded flags, fixed v0 scale, compact pose counts, and segmentation metadata with **`labelShape` / `labelDtype` only** (no label base64)

### Body Evidence Front Surface Overlay

Owned by `src/ui/bodyEvidenceOverlay2d.js`; rendered into `#grid2d-body-evidence-markers`.

- After analyze, **core 13 front anchors** render as primary Body Evidence overlay markers on the 2D Workspace **Front Surface — X/Y only**
- When Secondary Body Candidates visibility is on, **secondary allowlist** front landmarks also render as distinct secondary overlay markers (unpromoted only)
- Overlay is evidence-visual; selection is inspect-only until Promote
- Front image coordinates map to Front Surface cm coordinates:

```
spaceX = imageX / pixelsPerCm
spaceY = (canvasSize - imageY) / pixelsPerCm
```

- Y is flipped because image Y grows downward while Front Surface Y grows upward
- Mapping uses fixed v0 `canvasSize = 2000` and `pixelsPerCm = 10`
- Body Evidence marker hover shows landmark metadata (readable display name, image / Front Surface coords, score) and fixed scale source / status
- **Marker click selects a Body Evidence landmark only** (primary or secondary)
- **Marker click does not set measurement A/B**
- Empty / normal 2D grid sample clicks still create/update the **shared** front-surface measurement
- Side landmarks are parsed and QA-counted but **not rendered**
- Segmentation masks are **not rendered**
- Primary overlay visibility is controlled by View Controls → Evidence → **Body Evidence Overlay**
- Unpromoted secondary overlay/list visibility is controlled by View Controls → Evidence → **Secondary Body Candidates**
- Selected marker visual style uses **internal emphasis only** (bright core + inner cyan stroke) — **no large outer halo / glow** (`.grid2d-body-evidence-marker--active`)

### Body Landmark Candidate List

Owned by `src/ui/bodyEvidencePanel.js` (`#body-evidence-candidates`, `#body-evidence-secondary-candidates`).

- Candidate lists live in the left Body Evidence workflow
- **Primary / Core Body Landmark Candidates** shows the core 13 front anchors (same set as primary overlay markers)
- **Secondary Body Landmark Candidates** shows Secondary Body Landmark Candidates v0 allowlist landmarks when present; title includes a count
- Candidate list click selects the same landmark as marker click
- Active candidate and active marker stay synced
- Candidate clicks do **not** trigger measurement A/B
- Display names use readable Title Case via `formatLandmarkDisplayName()`; internal ids may remain snake_case
- Already-promoted landmarks can show a Promoted badge

### Body Landmark Inspect / Select

Owned by `src/features/bodyEvidence.js` (selection state), `src/ui/bodyEvidenceOverlay2d.js` (marker click → select + active class), and `src/ui/bodyEvidencePanel.js` (Current Selected Body Landmark card).

- Clicking a Body Evidence overlay marker **selects it for inspection** (primary or secondary)
- Selected marker gets a visual active state (`.grid2d-body-evidence-marker--active`) with internal emphasis only — no large outer halo/glow
- **Current Selected Body Landmark** card (`#body-evidence-selected`) shows a **compact** selected-landmark summary (readable name, front view, mapped coords, score, promote status)
- **Clear Selection** (`#clear-body-landmark-selection`) clears **only** the selected Body Evidence landmark
- Selection is separate from:
  - measurement A/B
  - annotation selected point (`#clear-selection` / Annotate Selected Point)
  - annotations themselves (until Promote creates one)
  - Scene Graph
  - Scene State export/import
- Body Evidence selection is **not** included in diagnostic Body Evidence JSON or Scene State JSON
- Loading new sources, Clear Body Evidence, or re-analyze clears the inspect selection

### Promote Selected Landmark

Owned by `src/features/bodyEvidence.js` (`promoteSelectedBodyEvidenceLandmark`) and `src/ui/bodyEvidencePanel.js` (`#promote-selected-body-landmark`).

- Promote is **manual only** — never automatic
- A selected **core front** or **secondary allowlist** Body Evidence landmark is eligible for promotion
- Creates a normal annotation of type **`body_landmark`** at the mapped Front Surface position (shared front-surface Z)
- Promoted landmark becomes a normal annotation:
  - visible in Annotation List
  - visible in Scene Graph
  - visible in 3D/2D annotation visuals
  - included in Scene State JSON as a normal annotation
  - valid as a normal A/B measurement pick target in Inspect & Measure (Body Landmark Measurement Picking v0)
- Raw Body Evidence state (sources / QA / overlay / selection) is **not** included in Scene State export/import
- Unpromoted secondary candidates remain out of Scene State until promoted
- Duplicate promotion is prevented (same `body_landmark` name already present → blocked with status feedback)
- Promote does **not** create Body Graph nodes
- Promoting a secondary candidate does **not** add it to Body Measurement Readiness or Measurement Preview Lines rows (those remain core-pair based)

### Landmark display naming / hover

- Landmark display names are unified in UI via `src/core/landmarkDisplay.js` (`formatLandmarkDisplayName`)
- Internal ids may remain snake_case; UI display names should be readable Title Case
- Promoted `body_landmark` annotations in 2D show coordinate hover info on projected markers
- Annotation hover must **not** duplicate XYZ and projection coordinates when they are equivalent (Front Surface projection is X/Y of the same 3D point)

### Export / import boundary (Body Evidence)

- Scene State JSON export/import schema remains **unchanged**
- Body Evidence raw imported / analyzed state is **UI/session evidence only** and is **not** exported/imported
- Promoted `body_landmark` annotations are exported/imported **only because they are normal annotations**
- 2D UI-only state remains outside export/import
- Promoted Body Anchors Summary does not add schema fields
- Body Anchor Audit does not add schema fields
- Measurement Reference Levels does not add schema fields (spans are display-only)
- Anatomical Measurement Lines does not add schema fields (distances are display-only readiness previews)
- Measurement Line Preview Overlay v0 does not add schema fields (visual-only Ready lines; no distance labels on overlays)
- Body Tab Consolidation v0 does not change Scene State JSON export/import schema

### Ownership boundary

| Concern | Body Evidence (accepted) |
|---------|--------------------------|
| Measurements / history | Body Evidence itself does not write history; promoted `body_landmark` annotations may be picked via normal A/B (Body Landmark Measurement Picking v0) |
| Body Landmark Measurement Picking | Implemented — promoted `body_landmark` annotations only; reuses shared A/B + history; no separate body measurement system |
| Manual Annotate annotations | Untouched by import/analyze; Promote can create `body_landmark` annotations |
| Scene Graph | Body Evidence itself not listed; promoted annotations are normal annotation nodes |
| Scene State JSON | Body Evidence itself excluded; promoted annotations included as normal annotations; unpromoted secondary never exported |
| Landmark classification | Parsed / rejected face-head / ignored-deferred / core-13 primary whitelist / Secondary Body Landmark Candidates v0 allowlist |
| Landmark inspect / select | Implemented (separate from A/B and Annotate selection; core front + secondary allowlist) |
| Candidate lists | Implemented (left panel; Primary/Core 13 + Secondary allowlist with count) |
| Secondary visibility | Implemented (View Controls → Evidence → Secondary Body Candidates; unpromoted secondary only) |
| Promote Selected Landmark | Implemented (manual; selected core or secondary; duplicate-guarded) |
| Promoted Body Anchors Summary | Implemented (Session Data → Body; compact read-only table from annotations) |
| Body Anchor Coordinate Audit | Implemented (compute reused internally; compact warnings shown in Body Measurement Readiness) |
| Measurement Reference Levels | Implemented (compute may exist internally; useful info folded into Body Measurement Readiness; separate panel not shown by default) |
| Anatomical Measurement Lines | Implemented (Session Data → Body readiness workflow; candidate lines + Ready/Missing distances; separate panel not shown by default) |
| Measurement Line Preview Overlay | Implemented (visual-only Ready lines in 3D and/or Front 2D; View Controls → Body Measurement Previews; no distance labels on lines; distances stay in Body Measurement Readiness) |
| Body Measurement Readiness | Implemented (Body Tab Consolidation v0 user-facing consolidated view; secondary unpromoted candidates do not affect readiness) |
| Body Tab Consolidation | Implemented (UI/IA cleanup only; Status counts + Promoted Anchors table + Readiness; Advanced Evidence Details for long lists) |
| Distance Measurement panel layout | Implemented (UI-only stacked name + coords for long body landmark names; no schema/math change) |
| Result / Scale JSON | Not imported / not used |
| Body Graph | Not implemented |
| Review Status | Not implemented |
| Side landmark rendering | Not implemented |
| Segmentation mask rendering | Not implemented |
| Latent space | Not implemented |

### Recent body workflow code cleanup

After the secondary-candidate and body-landmark measurement updates, recent body workflow code was audited/cleaned:

- Unused imports / helpers / refs / classes were removed where confirmed safe
- Cleanup did **not** change user-facing behavior
- `main.js` remains a thin orchestrator
- Historical / superseded panel stubs and internal compute helpers that are still used (or intentionally retained) remain documented in `PROJECT_STRUCTURE.md`

---

## Current Scene Graph Features

- A read-only **Scene Graph** inspector displays the current session state as a structured tree.
- Scene Graph lives in the right Session Data sidebar **Graph tab** (`#scene-graph-panel`, `#scene-graph-tree`).
- It is a visualization of existing state only — it does **not** mutate session data.
- Scene Graph reads session data via `buildSceneState(measurement)` from `sceneExport.js` (read-only; no download).
- Scene Graph updates when measurements, history, annotations, import, or app mode change (even if another tab is active).
- Selected graph rows can trigger **temporary visual previews** in the 3D scene without changing session state.

### Graph groups

1. **Scene Root** — app name, current mode, unit (cm), cube size (200 × 200 × 200)
2. **Reference Markers** — Origin (0, 0, 0), Center (100, 100, 100)
3. **Active Measurement** — Measurement group preview (when A and B exist), Point A, Point B, distance when present, or empty state
4. **Measurement History** — total count; compact clickable rows (`#number`, distance) when entries exist; **collapsed by default**
5. **Annotations** — total count; compact clickable name/type/position rows when entries exist; **collapsed by default**; when multiple types are present, rows are grouped compactly by semantic type

Large groups (Measurement History, Annotations) use compact rows rather than full history/annotation cards. Groups are collapsible via `<details>` elements.

Annotation entries are **typed semantic nodes** — each row displays the annotation's semantic type (e.g. Custom, Body Landmark) alongside name and position. When a landmark preset was used, the saved annotation name may appear as a preset-style identifier (e.g. `left_shoulder`, `collar_center`). When only one type is present, each row shows `Type · (x, y, z)`; when multiple types are present, compact sub-group headers show type labels with indented clickable rows beneath. Scene Graph highlighting for annotation rows is unchanged — still visual-only graph-to-3D previews at the saved coordinate.

### Clickable graph rows

These rows use `.scene-graph-row--clickable` and trigger temporary 3D previews:

- **Origin**
- **Center**
- **Active Measurement group** (Measurement row — highlights A, B, and line when both points exist)
- **Active Measurement Point A**
- **Active Measurement Point B**
- **Measurement History entries**
- **Annotation entries**

Non-clickable rows include Scene Root fields, history/annotation totals, distance readout, and empty states.

### Non-mutating graph click behavior

- Clicking graph rows does **not** change active measurement.
- Clicking graph rows does **not** change measurement history.
- Clicking graph rows does **not** modify annotations.
- Clicking graph rows does **not** affect export/import data.
- Clicking graph rows only creates temporary visual overlays in the 3D scene.

### Scene Graph temporary highlighting

- Temporary graph highlight is implemented and working.
- Only **one** graph highlight preview is visible at a time.
- Clicking a new graph item replaces the previous preview.
- Preview auto-clears after about **2 seconds**.
- Switching Session Data tabs clears the temporary preview.
- Successful Scene JSON import clears the temporary preview.
- **Clear History** clears any related graph highlight.
- Deleting an annotation clears related graph highlight when needed.
- Reference marker previews use **octahedron-style** temporary highlights.
- Measurement and history previews use temporary point markers and a **cyan line**.
- Annotation previews use a temporary marker at the saved coordinate (type does not change the preview visual).
- Scene Graph annotation highlighting remains **visual-only** — clicking typed annotation rows triggers the same temporary graph-to-3D preview behavior as before and does not mutate annotation type or session state.
- The highlight group (`graphHighlightGroup`) is separate from volumetric pick meshes and should not interfere with hover, selection, measurement, annotations, or reference marker hover.

---

## Current Scene State Export / Import Features

### Export

- **Export Scene JSON** is implemented and working.
- **Export Scene JSON** button lives in the right **Session Data** sidebar **Files tab** (`#export-import-panel`, `#export-scene-json`).
- Export is **read-only** and does not modify the scene, hover, selection, measurement, annotations, history, or app mode.
- Export works in both **Inspect & Measure** and **Annotate** modes.
- Export works with empty sessions, active measurements, measurement history, and annotations.

#### Filename

- Format: `revacity-scene-state-YYYY-MM-DD-HH-mm-ss.json`
- Uses **local browser time** (same moment as `metadata.exportedAtLocal`, with dashes instead of spaces/colons).

Export includes `metadata`, `sceneScale`, `appMode`, `referenceMarkers`, `activeMeasurement`, `measurementHistory`, and `annotations`.

#### Exported JSON structure

```json
{
  "metadata": {
    "appName": "REVacity Metrology Space",
    "version": 1,
    "exportedAtUtc": "<ISO UTC timestamp with Z>",
    "exportedAtLocal": "YYYY-MM-DD HH:mm:ss",
    "timezone": "Asia/Amman"
  },
  "sceneScale": {
    "unit": "cm",
    "sceneUnit": "1 scene unit = 1 cm",
    "cubeSizeCm": { "x": 200, "y": 200, "z": 200 },
    "visibleGridCm": 10,
    "internalSamplingCm": 5,
    "internalPointCount": 68921
  },
  "appMode": {
    "currentMode": "inspect-measure"
  },
  "referenceMarkers": {
    "origin": { "x": 0, "y": 0, "z": 0 },
    "center": { "x": 100, "y": 100, "z": 100 }
  },
  "activeMeasurement": {
    "pointA": { "x": 0, "y": 0, "z": 0 },
    "pointB": null,
    "distanceCm": null
  },
  "measurementHistory": [
    {
      "number": 1,
      "pointA": { "x": 0, "y": 0, "z": 0 },
      "pointB": { "x": 10, "y": 10, "z": 10 },
      "distanceCm": 17.32
    }
  ],
  "annotations": [
    {
      "id": 1,
      "name": "Sample",
      "type": "custom",
      "position": { "x": 50, "y": 50, "z": 50 }
    }
  ]
}
```

Each exported annotation includes `id`, `name`, `type`, and `position`. Allowed `type` values: `custom`, `reference_point`, `body_landmark`, `garment_landmark`, `measurement_point`. Landmark preset is **not** exported — only the final annotation `name` (which may have been filled from a preset) is included.

#### Export rules

- `distanceCm` values are rounded to **2 decimal places** in exported JSON (numbers, not strings).
- Missing active measurement values (`pointA`, `pointB`, `distanceCm`) export as `null`.
- Empty `measurementHistory` and `annotations` export as empty arrays `[]`.
- `exportedAtUtc` uses ISO UTC timestamp with `Z` (`toISOString()`).
- `exportedAtLocal` uses local time format `YYYY-MM-DD HH:mm:ss`.
- `timezone` uses browser timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone` when available (e.g. `Asia/Amman`).
- JSON is formatted with **2-space indentation**.

### Import

- **Load Scene JSON** is implemented and working.
- **Load Scene JSON** control lives in the right **Session Data** sidebar **Files tab** (`#export-import-panel`, `#load-scene-json`).
- It uses a `.json` file input (triggered by a **Load Scene JSON** label styled as a panel button).
- It imports previously exported REVacity Scene State JSON files.
- Import **validates the JSON before modifying state**.
- If validation fails, the current scene state is **not modified**.
- Invalid imports show a sidebar error message (`#scene-import-status`) and log a console warning.
- Import works after page refresh.

#### Restored data

- **Measurement History** is replaced by imported history.
- Imported measurement numbers are preserved when valid.
- **Active Measurement** is restored if `pointA` and/or `pointB` are present.
- If both `pointA` and `pointB` are present, the measurement line and floating distance label are restored.
- **Saved annotations** are replaced by imported annotations.
- Imported annotation 3D markers and CSS2D labels are recreated.
- Imported annotation `type` values are restored when valid.
- Imported annotation `name` values are restored as stored (including preset-style names like `left_shoulder` if that was the saved name).
- Older JSON annotations **without** `type` import safely — missing or invalid `type` is normalized to **`custom`** during restore (the whole file is not rejected for missing type).
- Imported annotations do **not** restore Landmark Preset dropdown state — only `name`, `type`, and `position` are restored.
- Older and current Scene State JSON files remain compatible.
- Annotation ids remain stable when valid.
- Annotation positions remain stable when coordinates are valid.
- **App mode** is restored when valid (via `applyImportedMode()` — no mode-switch cleanup during import).

Import restore order: measurement history → annotations → active measurement → app mode.

Type normalization is handled in `restoreAnnotations()` via `normalizeAnnotationType()` from `core/annotationTypes.js` — invalid or absent `type` falls back to `custom` per annotation.

#### What import does NOT restore or change

- Cube size
- Scale
- Grid spacing
- Internal sampling
- LOD
- Camera position
- Orbit controls target
- Reference marker positions
- View control checkbox state (**Origin / Center**, **Annotations**, **3D Lattice Points**, **2D Grid Points**, **Measurement Lines**, **Body Evidence Overlay**, **Body Measurement Previews**)
- Left inspector section collapse state
- Body Evidence sources, QA results, overlay visibility, or diagnostic export payloads
- 2D measurement state or 2D measurement history
- 2D UI-only navigator state (zoom, pan, selected region, refinement, pick mode)

#### Validation rules

- `metadata.appName` must be `"REVacity Metrology Space"`
- `metadata.version` must be `1`
- `sceneScale.unit` must be `"cm"`
- `sceneScale.cubeSizeCm` must be `{ x: 200, y: 200, z: 200 }`
- `sceneScale.internalSamplingCm` must be `5`
- `sceneScale.internalPointCount` must be `68921`
- `appMode.currentMode` must be `"inspect-measure"` or `"annotate"` when present
- Coordinates must be numbers within **0 to 200** (including annotation `position` values)
- `distanceCm` must be a number when present
- Annotation `type` is **not** required for import validation — missing or invalid type is normalized to `custom` on restore rather than rejecting the file

---

## Current 2D Workspace and Grid Navigator

The central viewport supports a **workspace layer** with two tabs. The **2D Grid Navigator** is the cube's **Front Surface** interaction plane (X/Y only). 2D clicks create/update the **same shared measurement** used by the 3D scene — there is no independent 2D measurement state. Projected Origin/Center and annotation markers remain a read-only navigation layer (see § Current 2D/3D Projection Linking). The 2D panel appears **only inside the 2D Workspace beside the 3D pane** — it is **not** a standalone full-screen workspace, **not** a floating panel, and **not** inside the right Session Data tabs.

### Workspace tabs

The center viewport (`#viewport`) includes workspace tabs (`#workspace-tabs`) and workspace content (`#workspace-content`). Active mode is stored on `#viewport[data-workspace-mode]`.

| Tab | Button | Behavior |
|-----|--------|----------|
| **3D Space** | `#workspace-tab-3d` | Default on load. Shows the 3D metrology scene only (`#workspace-pane-3d` → `#canvas-container`); 2D pane and split divider hidden. |
| **2D Workspace** | `#workspace-tab-split` | Shows the combined workspace: the 3D scene pane and the Front Surface 2D Grid Navigator pane (`#grid2d-navigator-panel`) side-by-side with a draggable `#workspace-split-divider`. Minimum pane width 200 px; default split ratio favors the 3D pane slightly (~57% 3D / ~43% 2D). |

There is **no standalone 2D Space tab**. Top View and Side View are **removed** — Front Surface — X/Y is the only active 2D workspace. The former **Split View** tab was renamed to **2D Workspace** (button id `#workspace-tab-split`, layout mode `split`). The 2D Workspace is also the intended foundation for a future front-facing body workspace (no body model exists yet).

Workspace switching is **UI/layout-only** — it must **not** mutate scene or session state (measurements, annotations, history, app mode, export data). Switching to 2D Workspace triggers a 2D redraw and 3D renderer resize only.

Owned by `src/ui/workspaceLayout.js` (`setupWorkspaceLayout`, `setWorkspace`, `getWorkspace`).

### 2D Grid Navigator identity

- **Plane:** **Front Surface — X/Y** only (`Front Surface — X / Y` label in `.grid2d-nav-view-mode`)
- **Mapping:** 2D X → 3D X · 2D Y → 3D Y · 3D Z = fixed front-surface depth (`FRONT_SURFACE_DEPTH_CM` = `ROOM_SIZE` / far Z face)
- **Role:** lightweight interaction surface/grid for creating shared front-surface measurements — **not** a duplicate Distance Measurement control panel
- **Official readout/clear controls:** main left **Distance Measurement** panel
- **Top View / Side View:** removed/hidden — not active UI features
- **Intended purpose:** future front-facing body workspace. Future body convention: body front faces the viewer, **X = body width**, **Y = body height**, origin bottom-left. (No body model yet.)

### Compact panel presentation (visual only)

- **Title:** `2D GRID NAVIGATOR`
- **Subtitle:** fixed `Front Surface — X / Y`
- **Compact status row:** base step (10 cm), refined-region count, and Pick/Region mode readout
- **Help text:** Control toggles mode · scroll zoom · right-drag pan
- **Selection block:** compact empty hint or selected point/region details (UI-only navigator selection)
- **Actions:** Back / Reset / Split Selection — local refinement only
- **No duplicate Point A/B/Distance readout** and **no duplicate clear buttons** in the 2D panel

### Coordinate convention

- **Domain:** 0–200 cm on both axes
- **Origin:** bottom-left
- **X** left → right · **Y** bottom → top
- Matches the 3D room convention where Y is height upward
- Uses `ROOM_SIZE` from `core/constants.js`
- Front-surface picks map through `frontSurfaceTo3d()` (`src/core/frontSurface.js`)

### 2D grid and refinement

- **Base point field:** **10 cm** display step across the full domain (matches 3D visible surface grid)
- **Split Selection:** simplified / non-recursive — a 10 cm region can be filled once at **5 cm**; selections that already touch a refined region cannot refine again
- **Max detail:** 5 cm
- Refinement is local to the 2D navigator only — does not modify the 3D lattice, export/import schema, or Scene State JSON
- Full domain stays visible; denser points appear only after Split — not from scroll zoom

### Visual zoom and pan (2D-only)

- Scroll zoom 1×–8× (visual-only) · right-drag pan (visual-only)
- Not exported

Owned by `src/ui/grid2dNavigator.js` (`setupGrid2dNavigator`, `refreshGrid2dNavigator`).

### 2D interaction model

Two local interaction modes exist inside the 2D navigator. They are independent of Inspect & Measure / Annotate app mode for region picking, but **measurement clicks are gated to Inspect & Measure**.

| 2D mode | Default | Toggle |
|---------|---------|--------|
| **Pick Point** | Yes | **Control** key when 2D workspace is visible and `#grid2d-grid-wrapper` is focused |
| **Select Region** | No | Same Control toggle |

#### Pick Point mode

- Click a lattice point to select it in the 2D readout **and** advance the **shared** front-surface measurement via `advanceFrontSurfaceMeasurement()`
- Updates the same Point A / Point B state rendered on the 3D front face and in the left Distance Measurement panel
- Does not change app mode, annotations, or export schema
- **Body Evidence overlay markers** (when visible) are visual-only — clicking them selects a landmark for inspection only and must **not** set measurement A/B; empty / normal grid sample clicks still create/update the shared front-surface measurement

#### Select Region mode

- Left-drag selects a region for optional Split refinement
- Does not advance measurement

### Shared Front Surface Measurement

Owned by `src/features/frontSurfaceMeasurement.js` (advance/read helpers) and `src/features/measurement.js` (canonical A/B state, history, clear). Overlay rendering lives in `src/ui/grid2dNavigator.js`.

#### Click flow (Pick Point, Inspect & Measure)

1. First 2D click → shared **Point A** on the 3D front surface (Z = front depth)
2. Second 2D click → shared **Point B**, line + distance on 3D and 2D
3. Third click starts a new measurement (same A/B advance rules as 3D)

Promoted `body_landmark` projected markers (when Annotations are visible) can also advance this shared A/B flow in Inspect & Measure — see **Body Landmark Measurement Picking v0**. Lattice / empty-field picks remain the fallback when no promoted body landmark marker is hit.

#### Distance

True 3D Euclidean distance in cm (same math as volume measurements). Front-surface A/B share the same Z, so distance equals the Front X/Y plane length.

#### Visuals

- Shared orange A / magenta B markers on the 2D front surface and matching 3D front-face markers
- 2D line/label respect **Show Measurement Lines** (same flag as 3D)
- Off-front-face 3D points (from volume clicks) may appear dimmed at their X/Y on the 2D overlay
- Separate visual-only **Body Measurement Preview** lines (Measurement Line Preview Overlay v0) may also appear on the Front Surface via `#grid2d-body-measurement-previews`; they respect **Body Measurement Previews**, are independent from A/B Measurement Lines, do not affect 2D click measurement, and do not show distance labels

#### Clear controls

Clearing is owned by the **left Distance Measurement panel** only:

- Clear Point A / Clear Point B / Clear Measurement
- Clears shared state in both 2D and 3D
- 2D duplicate clear controls were removed

#### History

- Completed measurements enter the single shared history list
- Front-surface entries may show a `Front Surface` meta label when both points sit on the front face
- **Clear History** clears this shared history
- History is part of Scene State JSON export/import (canonical 3D measurement history — unchanged schema)

### Split validation (simplified)

Split Selection (`#grid2d-split`) enables only when Select Region has ≥2 points and the bounds are not already refined:

- Valid 10 cm selection → fill once at 5 cm inside bounds
- Already refined → disabled (`Already refined at 5 cm.`)
- Back undoes the last refinement; Reset clears refinements, selection, and visual zoom/pan

### Axis labels and design

- Gutter labels `X →` / `Y ↑` and ticks `0` / `200`
- Dark technical theme; sample points dominant; proportional marker emphasis via `grid2dMarkerSizing.js`

### Current 2D/3D Projection Linking

Owned by `src/features/projectionLinking.js`, rendered into `#grid2d-markers`.

#### Projected items (navigation only)

- Origin (0, 0, 0)
- Center (100, 100, 100)
- Saved annotations

Active Point A/B are **not** projected here — the Front Surface measurement overlay renders the shared measurement natively.

#### Mapping

Always Front Surface: horizontal = X, vertical = Y (`frontSurfaceFrom3d`).

#### Behavior

- Hover tooltip with original X/Y/Z and Front Surface X/Y
- Click → temporary 3D highlight (projection link)
- **Body Landmark Measurement Picking v0:** in Inspect & Measure, clicking a projected promoted `body_landmark` annotation also advances the **shared** A/B measurement using the annotation’s stored 3D position (then keeps projection-link highlight)
- Non-`body_landmark` projected annotations remain navigation/highlight only (do not set A/B)
- In Annotate mode, projected body landmark clicks do **not** set Point A/B
- Does not create a separate 2D measurement state

#### View Controls sync

- **Origin / Center** and **Annotations** sync 3D + projected 2D layers
- **Body Evidence Overlay** syncs Front Surface evidence markers only (separate from projection linking)
- Visual-only visibility — no data deletion, no export schema change; hidden annotations are not pickable for measurement

### 2D marker relative sizing

Owned by `src/ui/grid2dMarkerSizing.js`. Base sizes by step: 20 cm→5 px, 10 cm→4 px, 5 cm→3 px. Emphasis/hover/halo scale from base size.

### Front Surface contract

- **One shared measurement state** for 2D Front Surface and 3D
- 2D picks write real 3D front-surface points (`z = FRONT_SURFACE_DEPTH_CM`)
- Left Distance Measurement panel is the official readout/control area
- 2D UI-only state (zoom, pan, selected region, refinement, pick mode) is **not** exported
- Scene State JSON schema is unchanged
- **Body Evidence** is a dedicated inspector workflow / evidence layer with optional Front Surface overlay (core 13 front anchors only), candidate list, inspect/select, and manual Promote — Body Evidence itself does **not** join Scene State; promoted landmarks become normal `body_landmark` annotations
- Body Evidence overlay / candidate clicks select a landmark for inspection only and must **not** set measurement A/B; empty 2D grid clicks still advance the shared front-surface measurement
- **Body Landmark Measurement Picking v0:** promoted `body_landmark` annotations (3D markers and Front 2D projected markers) are valid shared A/B pick targets in Inspect & Measure only; raw Body Evidence is not
- Body Evidence landmark selection is separate from Annotate selected point, measurement A/B, Scene Graph, and Scene State; Promote is manual-only for the selected **core front** landmark
- Front overlay mapping uses `spaceX = imageX / pixelsPerCm` and `spaceY = (canvasSize - imageY) / pixelsPerCm` with fixed Body Evidence v0 assumptions (`pixelsPerCm = 10`, `canvasSize = 2000`)
- Result / Scale JSON is not imported; `heightCm` is postponed / unused
- Body Landmark Candidates / overlay / Summary Landmarks count are restricted to the core 13 front whitelist (not all non-face parsed landmarks)
- Side landmark rendering and segmentation mask rendering are **not** implemented
- Body Graph, Review Status, and latent space are **not** implemented
- Landmark UI names use Title Case display labels; internal ids may remain snake_case
- Annotation 2D hover must not duplicate XYZ and equivalent projection coordinates

2D-local navigator state (`selectedPoint2d`, `selectedRegionPoints`, `refinedRegions`, `active2dMode`, `visualTransform`) persists across workspace tab switches; it is not reset automatically on tab switch.

---

## 8. Current UI State

The UI uses a **REVacity-style** dark cosmic / neural command-center layout — black glassmorphism panels, deep purple and magenta accents, subtle cyan for measurement data. Typography: **Syne** (display) and **JetBrains Mono** (data). The center viewport hosts workspace tabs and either the 3D canvas, the 2D Grid Navigator, or both; chrome surrounds it on three sides.

Layout is a CSS grid (`#app-layout`): top header, left sidebar, center viewport, right sidebar, bottom status bar.

### Top header (`#top-header`)
- Brand: **REVacity** eyebrow, **Metrology Space** title, **Volumetric Coordinate Intelligence** subtitle
- Status badges: **ACTIVE GRID** and **68,921 POINTS**
- Non-interactive (`pointer-events: none`)

### Left sidebar — Metrology Inspector (`#left-sidebar`)
Controls / workflow focused. The sidebar body (`.sidebar-scroll`) scrolls when content exceeds available height. Room Dimensions no longer consumes left-sidebar space.

| Section | ID | Visibility |
|---------|-----|------------|
| Workflow | `#mode-panel` | Always present — segmented toggle: **Inspect & Measure** / **Annotate** / **Body Evidence** |
| View Controls | `#view-controls-panel` | Always present — grouped visibility-only toggles (see View Controls) |
| Body Evidence | `#body-evidence-panel` | Visible in Body Evidence workflow — Import Files / Actions / Summary / Candidates / Selected Landmark / Promote / Clear Selection |
| Distance Measurement | `#measurement-panel` | **Inspect & Measure workflow** — shown after Point A is set |
| Selected Point | `#selection-panel` | **Annotate workflow only** — shown after point click; includes **Annotation Type** dropdown, **Landmark Preset** dropdown, **Annotation Name** input, and **Add Annotation** |

#### Collapsible inspector sections

Main left Metrology Inspector sections are **collapsible** (`data-collapsible`, wired by `src/ui/collapsibleSections.js`):

- Workflow, View Controls, Body Evidence, Distance Measurement, Selected Point
- Inside Body Evidence, **Import Files** and **Actions** are also collapsible subgroups
- Clicking the section header toggles open/closed; a subtle caret indicates expanded (`▾`) / collapsed (`▸`)
- Closed sections hide `.section-body` only — headers stay visible
- Collapse state is **UI-only** — not exported/imported; collapsing does **not** reset measurements, annotations, Body Evidence data, overlay visibility, loaded files, imported state, checkbox state, or typed annotation input
- Mode/workflow-driven visibility on Distance Measurement / Selected Point / Body Evidence is unchanged in intent

Default expand state:

| Section | Default |
|---------|---------|
| Workflow | expanded |
| View Controls | expanded |
| Body Evidence | expanded |
| Distance Measurement | expanded when workflow-visible |
| Selected Point | expanded when workflow-visible |

**Selected Point** (`#selection-panel`) is hidden outside Annotate workflow. In Annotate it shows coordinates, `#annotation-type-select` (**Annotation Type** dropdown, default Custom), `#annotation-preset-select` (**Landmark Preset** dropdown, default Custom/manual), `#annotation-name-input`, **Add Annotation** (`#add-annotation`), and **Clear Selection** (`#clear-selection`).

**View Controls** (`#view-controls-panel`) remains **visibility-only** and is always present:

| Subgroup | Checkboxes (defaults) |
|----------|------------------------|
| Reference | Origin / Center (checked) |
| Scene Overlays | Annotations (checked), Measurement Lines (checked) |
| Grid / Points | 3D Lattice Points (checked), 2D Grid Points (checked) |
| Evidence | Body Evidence Overlay (unchecked), Body Measurement Previews (checked) |

- **Origin / Center** — toggles Origin and Center reference marker mesh visibility and hover-only labels (3D + projected 2D)
- **Annotations** — toggles 3D annotation box markers and CSS2D labels only (does not affect Annotation List or session data); syncs projected 2D annotation markers
- **3D Lattice Points** — toggles internal 3D lattice visibility only
- **2D Grid Points** — toggles 2D Grid Navigator sample points only
- **Measurement Lines** — toggles 3D and 2D measurement lines/distance labels only (markers and data remain)
- **Body Evidence Overlay** — toggles Front Surface body-evidence landmark markers only (single authoritative checkbox under Evidence)
- **Body Measurement Previews** — toggles Measurement Line Preview Overlay v0 Ready anatomical preview lines only (3D and/or Front 2D); independent from A/B Measurement Lines; does not hide annotation markers or Body Evidence Overlay; does not change readiness calculations or export/import; no distance labels on preview lines

**Body Evidence** (`#body-evidence-panel`) is the dedicated Body Evidence workflow panel — see **Current Body Evidence Features**. Overlay visibility lives in View Controls → Evidence, not as a duplicate checkbox here. Primary actions (Import, Analyze, Download, Clear, Promote, Clear Selection) live here; consolidated Body tab details (Body Evidence Status, Promoted Body Anchors, Body Measurement Readiness) live in the right Body tab.

Inspector sections use `pointer-events: none` except collapsible section/subgroup headers, the workflow toggle, View Controls checkboxes, Body Evidence file/action/inspect/promote controls, action buttons (Clear Point A/B, Clear Measurement, Clear Selection, Add Annotation), the annotation name input, the annotation type dropdown, and the landmark preset dropdown.

### Center viewport (`#viewport`)

The center viewport is no longer a single canvas container. It contains workspace tabs and workspace content.

| Element | ID | Role |
|---------|-----|------|
| Workspace tabs | `#workspace-tabs` | **3D Space** / **2D Workspace** (default: 3D Space) |
| Workspace content | `#workspace-content` | Flex container for 3D pane, split divider, and 2D pane |
| 3D workspace pane | `#workspace-pane-3d` | Contains `#canvas-container` (Three.js WebGL + CSS2D renderers) and `#hover-coordinate-tooltip` |
| Split divider | `#workspace-split-divider` | Draggable vertical divider (2D Workspace only; hidden otherwise) |
| 2D workspace pane | `#grid2d-navigator-panel` | Compact **Front Surface** Grid Navigator (title/subtitle, status row, selection details, grid, legend, Back/Reset/Split); shown only inside 2D Workspace beside the 3D pane — not a duplicate measurement control panel |


- **3D canvas** lives in `#workspace-pane-3d` → `#canvas-container`.
- **2D Grid Navigator** lives in `#grid2d-navigator-panel` — not in the left sidebar and not in the right Session Data tabs.
- **3D Space** shows the 3D metrology scene only.
- **2D Workspace** displays the 3D pane and 2D Grid Navigator pane side-by-side with a resizable divider. There is no standalone 2D Space tab.
- Fills the space between sidebars and above the status bar.

### Right sidebar — Session Data (`#right-sidebar`)

The right sidebar uses a **tabbed layout** instead of stacked sections. Title: **Session Data**; subtitle: *Saved measurements and annotations*. Data / details focused. Session tabs are compact so labels fit without overlapping.

#### Tab bar (`#session-tabs`)

Compact segmented tab control under the sidebar header:

| Tab | Button label | Default | Tab panel ID |
|-----|--------------|---------|--------------|
| **History** | Hist | Yes (active on load) | `#tab-panel-history` |
| **Annotations** | Annos | No | `#tab-panel-annotations` |
| **Body** | Body | No | `#tab-panel-body` |
| **Graph** | Graph | No | `#tab-panel-graph` |
| **Files** | Files | No | `#tab-panel-files` |

Tab buttons: `#session-tab-history`, `#session-tab-annotations`, `#session-tab-body`, `#session-tab-graph`, `#session-tab-files`.

Only one tab panel is visible at a time. Inactive panels use `.tab-panel-hidden`. Tab switching is UI-only — it does **not** modify scene state, clear measurements, clear annotations, or affect app mode. Hidden tab contents continue updating in the background when session data changes.

Empty-state visibility within a tab uses `hidden` on `#history-empty` and `#annotations-empty` — separate from tab visibility.

#### History tab

- Contains **Measurement History** panel (`#history-panel`).
- Shows empty state (`#history-empty`) when there are no completed measurements.
- Shows `#history-list` and **Clear History** (`#clear-history`) when entries exist.
- Single shared history for volume and front-surface measurements; front-surface entries may show a `Front Surface` meta label.
- **Clear History** clears the shared measurement history.
- Does not show Scene Graph, Export / Import, Annotation List, or Body QA.

#### Annotations tab

- Contains **Annotation List** panel (`#annotations-panel`).
- Shows empty state (`#annotations-empty`) when there are no annotations.
- Shows `#annotation-list` with per-annotation **Delete** buttons and annotation type labels when entries exist.
- Includes promoted `body_landmark` annotations as normal list entries.
- Does not show Measurement History, Scene Graph, Body QA, or Export / Import.

#### Body tab

- Contains **Body Tab Consolidation v0** layout (display order):
  - **Body Evidence Status** (`#body-evidence-status-panel`, `#session-body-evidence-status`) — compact Loaded/empty summary with **counts only** (primary/core, secondary, ignored/deferred, rejected face/head, low-confidence), fixed 2000×2000 / 10 px/cm scale, segmentation QA-only; **Advanced Evidence Details** collapsed by default with readable details for longer name lists (Secondary Candidates, Ignored/Deferred, Rejected Face/Head, etc.)
  - **Promoted Body Anchors** (`#promoted-body-anchors-panel`) — compact read-only Name / X / Y / Z table of current `body_landmark` annotations (source only if present; no invented source)
  - **Body Measurement Readiness** (`#body-measurement-readiness-panel`, `#body-measurement-readiness`) — consolidated user-facing view of audit warnings + Anatomical Measurement Lines candidates (Ready/Missing, distance cm or missing anchors); unpromoted secondary candidates do not affect readiness
- These old separate panels are **not** shown separately by default: Body Anchor Coordinate Audit, Measurement Reference Levels, Anatomical Measurement Lines (logic may still exist internally; display changed, not data model)
- Restores / shows analyzed status; empty evidence state when no Body Evidence has been analyzed
- Consolidated Body tab refreshes on Body Evidence import/clear, promote, `body_landmark` delete, Scene State import/restore, and other annotation-state changes
- No Promote, Clear Selection, Import, or Analyze controls here
- Does not show Measurement History, Annotation List, Scene Graph, or Export / Import
- Not Body Graph / latent space; does not change export/import schema
- Body Measurement Readiness does not read raw Body Evidence for annotation-driven rows and does not mutate annotations, measurements, Body Evidence, app mode, or export/import state
- Anatomical measurement / readiness distances are display-only preview/debug values (not saved, not history, not exported; not final certified body measurements)
- Current Body Evidence remains conceptual/mock-quality until stronger model outputs arrive

#### Graph tab

- Contains read-only **Scene Graph** panel only (`#scene-graph-panel`, `#scene-graph-tree`).
- Compact groups: Scene Metadata, Reference Markers, Active Measurement (shared), Measurement History, Annotations.
- Obsolete **2D Workspace State** graph card was removed.
- Clickable graph rows trigger temporary 3D previews; graph data remains read-only.
- Promoted body landmarks appear as normal annotation nodes when present.
- Does not show Measurement History cards, Annotation List, Body QA, or Export / Import.

#### Files tab

- Contains **Export / Import** panel only (`#export-import-panel`).
- **Export Scene JSON** (`#export-scene-json`), **Load Scene JSON** (`#load-scene-json`), import error message (`#scene-import-status`).
- Export and import behavior is unchanged for Scene State; Body Evidence raw state remains excluded; promoted `body_landmark` annotations import/export as normal annotations; 2D UI-only state remains outside export/import.

Tab content scrolls within `.sidebar-scroll.session-tab-content` when needed. **Clear History**, **Delete**, **Export Scene JSON**, **Load Scene JSON**, Scene Graph group toggles, and clickable Scene Graph rows are interactive. The Agent Tools placeholder has been removed.

### Bottom status bar (`#bottom-status-bar`)
Passive readout and hint only — no interactive mode toggle.

- **Scale:** 1 unit = 1 cm
- **Grid:** 10 cm
- **Sampling:** 5 cm
- **Mode:** read-only label (e.g. *Inspect & Measure* or *Annotate*) — mirrors active mode; full toggle is in the left inspector
- Hint text updates per mode (e.g. *Hover a point, click two points to measure distance* / *Click a point to select, then add an annotation*)

Non-interactive (`pointer-events: none`).

---

## 9. Features Tried and Removed

Reference planes were tested and **removed**:

- Three center planes (XY, XZ, YZ at 100 cm) were tried — caused visual clutter and radial-looking artifacts
- A single **XZ plane at Y = 100 cm** with outline-only rendering was also tested
- All reference plane visuals and labels were removed

**Current state:** no reference planes are visible or active in the codebase.

---

## 10. Important Do-Not-Break Rules

When modifying this project, preserve the following unless explicitly instructed otherwise:

- **Do not change the coordinate scale** (1 scene unit = 1 cm)
- **Do not change cube dimensions** (200 × 200 × 200 cm)
- **Do not change internal sampling logic** (5 cm, 68,921 points) without explicit instruction
- **Do not break hover highlight** behavior or mode-specific hover preview colors
- **Do not break point selection** or Selected Point coordinate display in Annotate mode
- **Do not break app mode separation** — Inspect & Measure vs Annotate click behavior, panel visibility, and mode-switch cleanup
- **Do not break two-point distance measurement** (A/B flow, line, distance math) in Inspect & Measure mode
- **Do not break Body Landmark Measurement Picking v0** — promoted `body_landmark` annotations remain valid shared A/B pick targets in Inspect & Measure (3D + Front 2D projected markers); Annotate must not set A/B from body landmarks; do not add a separate body measurement system or history
- **Do not make raw Body Evidence, unpromoted primary/secondary candidates, preview lines, readiness rows, rejected/ignored/side landmarks, or non-`body_landmark` annotations into A/B measurement targets**
- **Do not break floating distance label** at line midpoint
- **Do not break Distance Measurement panel stacked name + coords layout** for long body landmark point names — UI-only; do not change measurement math, history schema, or export/import schema to “fix” overflow
- **Do not break measurement history** (unlimited session storage, newest first, scrollable list, Clear History)
- **Do not write unpromoted secondary candidates into measurement history**
- **Do not re-add reference planes** unless explicitly requested
- **Do not add human body or new feature categories** unless explicitly requested
- **Do not break point annotations**, annotation labels, annotation deletion, annotation node types, or 3D coordinate anchoring
- **Do not break annotation node types** — preserve semantic type storage, UI, export, and import behavior
- **Do not remove the `custom` fallback** for older JSON imports missing annotation `type`
- **Do not change allowed annotation type values** (`custom`, `reference_point`, `body_landmark`, `garment_landmark`, `measurement_point`) without explicit instruction
- **Do not let annotation types affect** metrology scale, picking, measurement math, or annotation coordinates
- **Do not break Landmark Preset dropdown behavior** — type-dependent options, preset-to-name auto-fill, and manual naming after preset selection
- **Do not let preset selection change annotation coordinates**
- **Do not make presets affect measurement math or scene scale**
- **Do not require preset data during JSON import**
- **Do not break manual annotation naming** after preset selection
- **Do not add or document Landmark Sets / Guided Capture Workflow** until explicitly implemented (postponed; not in current codebase)
- **Do not make annotation labels follow the mouse**; they must remain anchored to their saved 3D coordinates
- **Do not add connecting lines between internal lattice points**
- **Do not introduce radial/starburst visual artifacts** in the volume grid
- **Do not break Scene State JSON export**
- **Do not make export mutate scene state**
- **Do not break Load Scene JSON import**
- **Do not allow invalid imports to mutate current scene state**
- **Do not bypass import validation**
- **Do not restore imported sceneScale values into runtime geometry**
- **Do not let app mode cleanup erase imported measurement state during import**
- **Do not duplicate active measurement into history during import**
- **Do not change import/export JSON schema** without explicit instruction
- **Do not change timestamp clarity fields** (`exportedAtUtc`, `exportedAtLocal`, `timezone`) without explicit instruction
- **Do not convert `distanceCm` values to strings** in exported JSON
- **Do not break Session Data tab switching**
- **Do not use the same hidden class for tab visibility and empty-state visibility if that causes conflicts** (tabs use `.tab-panel-hidden`; empty states use `hidden`)
- **Do not let tab switching mutate scene state**
- **Do not stop hidden tab contents from updating in the background**
- **Do not break Scene Graph temporary 3D highlighting**
- **Do not let graph highlights mutate scene state**
- **Do not add graph highlight objects to volume pick meshes**
- **Do not let temporary graph previews affect export/import JSON**
- **Do not leave stale graph highlights after tab switch, import, Clear History, or annotation delete**
- **Do not delete annotations when hiding them via View Controls**
- **Do not remove annotations from the Annotation List when Show Annotations is unchecked**
- **Do not block annotation creation when Show Annotations is unchecked**
- **Do not add View Controls checkbox state to Scene State JSON export/import**
- **Do not break Show Origin / Center** — must hide/show Origin and Center in 3D and projected 2D markers; suppress 3D hover labels while hidden
- **Do not break Show Annotations** — must hide/show 3D annotation visuals and projected 2D annotation markers; list, export, and creation must remain unaffected
- **Do not break Show 3D Lattice Points** — must hide/show only the internal 3D lattice; axes, shell, Origin/Center, measurement markers, and annotations must remain
- **Do not break Show 2D Grid Points** — must hide/show only 2D sample points; axes, labels, boundaries, projected markers, Body Evidence overlay markers, and front-surface measurement overlays must remain
- **Do not break Show Measurement Lines** — must hide/show 3D and 2D front-surface measurement lines/labels only; must not delete measurement data or history
- **Do not break Body Evidence Overlay visibility** — single checkbox under View Controls → Evidence for primary/core overlay markers; must not duplicate the control or delete Body Evidence data when unchecked
- **Do not break Secondary Body Candidates visibility** — View Controls → Evidence → Secondary Body Candidates hides/shows only unpromoted secondary candidate visuals/list; must not hide primary/core candidates, promoted annotations, Body Evidence Overlay primary points, Body Measurement Preview Lines, or change Body Measurement Readiness calculations
- **Do not break Body Measurement Previews visibility** — View Controls → Evidence → Body Measurement Previews toggles Measurement Line Preview Overlay v0 Ready lines only; must not affect A/B Measurement Lines, annotation markers, Body Evidence Overlay, Secondary Body Candidates, readiness calculations, or export/import
- **Do not delete data or history when hiding View Controls layers** — visibility toggles are visual-only
- **Do not reset measurements, annotations, Body Evidence, or overlay state when collapsing left inspector sections** — collapse is UI-only
- **Do not export/import left inspector collapse state**
- **Do not split 2D and 3D measurement state again** — Front Surface clicks write the shared measurement
- **Do not re-add Top View or Side View**
- **Do not re-add duplicate 2D clear buttons or a 2D Distance Measurement control panel**
- **Do not store 2D UI-only state** (zoom, pan, selected region, refinement, pick mode) in Scene State JSON
- **Do not change Scene State JSON schema** without explicit instruction
- **Do not change metrology scale or 3D lattice rules** from the 2D navigator
- **Do not change 2D max refinement below 5 cm** unless explicitly requested
- **Do not change the Front Surface X/Y convention or the bottom-left origin** (X left→right, Y bottom→top)
- **Do not break Front Surface mapping** — 2D X→3D X, 2D Y→3D Y, Z = fixed front-surface depth
- **Do not break 2D/3D projection linking** — projected Origin/Center markers remain navigation/reference; projected annotations stay navigation/highlight except promoted `body_landmark` markers in Inspect & Measure, which advance shared A/B (Body Landmark Measurement Picking v0)
- **Do not break 2D marker relative sizing**
- **Do not use Tab for 2D mode switching** — Control is the current shortcut
- **Do not make scroll zoom increase detail density** — zoom is visual-only
- **Do not make Split Selection crop or auto-zoom the canvas**
- **Do not move 2D back to a floating overlay**
- **Do not put 2D inside Session Data tabs**
- **Do not break workspace tab switching or 2D Workspace resizing**
- **Do not re-add a standalone 2D Space tab** — 2D appears only inside 2D Workspace beside the 3D pane
- **Do not merge Body Evidence itself into Scene State JSON** — Body Evidence sources/QA/overlay/selection stay out of Scene State; only manually promoted `body_landmark` annotations are normal Scene State annotations
- **Do not auto-promote Body Evidence landmarks** — Promote is manual only via **Promote Selected Landmark**
- **Do not promote anything other than the currently selected core front or secondary-allowlist Body Evidence landmark**
- **Do not allow duplicate promotion** of the same `body_landmark` name
- **Do not change primary/core 13 behavior** when working on secondary candidates
- **Do not weaken face/head exclusion rules**
- **Do not put Body Evidence primary actions (Promote / Clear Selection / Import / Analyze) in the right Body tab** — Body tab is consolidated Status + Promoted Body Anchors + Body Measurement Readiness only
- **Do not show QA details in the left Body Evidence panel** — QA belongs in Session Data → Body (Status summary counts + Advanced Evidence Details for longer lists)
- **Do not make the Body Evidence Status compact summary noisy** — keep counts in the compact card; long landmark-name lists belong in Advanced Evidence Details
- **Do not make Promoted Body Anchors editable** — read-only summary from current annotations; no promote/delete/edit actions there; no invented `source`; no new schema
- **Do not treat Promoted Body Anchors as Body Graph or latent space**
- **Do not make Body Anchor Audit editable or actionable** — read-only QA from current `body_landmark` annotations; no edit/delete/promote; no mutation of annotations, measurements, Body Evidence, app mode, or export/import
- **Do not treat Body Anchor Audit as Body Graph or latent space**
- **Do not invent a conflicting front-surface Z rule for Body Anchor Audit** — use existing `FRONT_SURFACE_DEPTH_CM` / `isOnFrontSurface`
- **Do not let Body Anchor Audit change Body Evidence import parsing, candidate filtering, promotion behavior, or Scene State schema**
- **Do not make Measurement Reference Levels editable or actionable** — read-only organization of promoted `body_landmark` annotations; no create/edit/delete/promote
- **Do not treat Measurement Reference Levels as Body Graph, latent space, or measurement generation**
- **Do not save Measurement Reference Levels spans** into annotations, measurement history, or Scene State export
- **Do not let Measurement Reference Levels read raw Body Evidence, unpromoted candidates (primary or secondary), rejected/ignored landmarks, side landmarks, or segmentation**
- **Do not let Measurement Reference Levels mutate measurement A/B, Body Evidence Import behavior, face/head exclusion, or 2D Workspace behavior**
- **Do not document Measurement Reference Levels Ready as final/accurate body measurement quality** — Ready means required promoted anchors are present; spans are QA/debug previews only
- **Do not make Anatomical Measurement Lines editable or actionable** — read-only candidate lines from promoted `body_landmark` annotations; no create/edit/delete/promote
- **Do not treat Anatomical Measurement Lines as Body Graph, latent space, or normal A/B measurement generation**
- **Do not conflate Anatomical Measurement Lines readiness distances with Measurement Line Preview Overlay visuals** — distances stay in Body Measurement Readiness only; preview overlay may draw Ready geometry lines but must not show distance labels in 3D or 2D
- **Do not write Anatomical Measurement Lines / Body Measurement Readiness distances** into annotations, measurement history, or Scene State export
- **Do not let Anatomical Measurement Lines read raw Body Evidence, unpromoted candidates (primary or secondary), rejected/ignored landmarks, side landmarks, or segmentation**
- **Do not document Anatomical Measurement Lines Ready distances as final certified body measurements** — they are preview/debug/readiness values only; Body Evidence remains conceptual/mock-quality
- **Do not treat Measurement Line Preview Overlay as normal A/B measurement** — visual-only Ready lines; not history; not saved into annotations; not exported; no Scene State schema change; no Body Graph; no latent space
- **Do not let Measurement Line Preview Overlay use raw Body Evidence, unpromoted candidates (primary or secondary), rejected/ignored landmarks, side landmarks, or segmentation**
- **Do not overlay distance labels on Measurement Line Preview Overlay lines** in 3D or 2D
- **Do not let Body Measurement Previews affect A/B Measurement Lines, annotation markers, Body Evidence Overlay, Secondary Body Candidates, readiness math, or export/import**
- **Do not change Body Measurement Readiness rows** or Measurement Preview Lines rows to incorporate unpromoted secondary candidates
- **Do not change metrology scale, cube size, grid spacing, internal sampling, LOD, axes, or point count** when working on Measurement Line Preview Overlay or secondary candidates
- **Do not change normal A/B measurement behavior, Measurement Lines checkbox behavior, or 2D front-surface measurement behavior** for preview overlay / secondary / body-landmark picking work
- **Do not re-add Top/Side 2D views or independent 2D measurement** via preview overlay
- **Do not change Body Evidence Import source assumptions, core 13 primary filtering, Secondary Body Landmark Candidates v0 allowlist policy, face/head exclusion, annotation data structure, promote duplicate guards, or Scene State JSON schema** for preview overlay / secondary / measurement-picking work
- **Do not re-split Body Tab Consolidation into the old separate Audit / Levels / Lines panels by default** without explicit instruction — Body Measurement Readiness is the user-facing consolidated view
- **Do not treat Body Tab Consolidation as a data-model or schema change** — UI/information-architecture only
- **Do not put Body Evidence controls inside Annotate workflow** — Annotate remains annotation-specific; Inspect & Measure remains measurement-specific
- **Do not treat Body Evidence as trusted ground truth** — conceptual/mock evidence
- **Do not include face/head landmarks as accepted body landmarks** in the body pipeline
- **Do not mix the face pipeline into the body Body Evidence pipeline**
- **Do not show all non-face landmarks as candidates or overlay markers** — Primary candidates / Body Evidence Overlay primary markers / Summary Landmarks count stay restricted to the core 13 front whitelist; secondary candidates are limited to the Secondary Body Landmark Candidates v0 allowlist only
- **Do not render, candidate-list, select, or promote ignored/deferred landmarks outside the secondary allowlist** in v0
- **Do not expand the secondary allowlist** (e.g. fingers/thumbs/dense hand joints) without explicit instruction
- **Do not bring back Result / Scale JSON** for Body Evidence Import — not required, not optional, not used as debug metadata
- **Do not break fixed Body Evidence v0 scale assumptions** — `canvasSize` / `imageWidth` / `imageHeight` = `2000`, `pixelsPerCm` = `10` (1 cm = 10 px); `heightCm` postponed / unused
- **Do not let Body Evidence overlay marker or candidate-list clicks set measurement A/B**
- **Do not break empty 2D grid clicks** that create/update shared front-surface measurements
- **Do not break Body Landmark Measurement Picking on Front 2D** — promoted projected `body_landmark` markers in Inspect & Measure must continue to drive shared A/B using the annotation stored position; must not re-add independent 2D measurement or Top/Side views
- **Do not mix Body Evidence landmark selection with measurement A/B, Annotate selected point, Scene Graph, or Scene State**
- **Do not let Body Evidence Clear Selection** (`#clear-body-landmark-selection`) clear Annotate selection, measurements, or annotations — it clears only the selected Body Evidence landmark
- **Do not add a large outer halo/glow** to selected Body Evidence markers — keep internal emphasis only (`.grid2d-body-evidence-marker--active`)
- **Do not break Front Surface Body Evidence mapping** — `spaceX = imageX / pixelsPerCm`, `spaceY = (canvasSize - imageY) / pixelsPerCm`
- **Do not render side landmarks or segmentation masks** unless explicitly requested
- **Do not promote Body Evidence to Body Graph** unless explicitly requested
- **Do not document Review Status, Body Graph, or latent space as implemented**
- **Do not include raw image blobs or segmentation label base64** in diagnostic Body Evidence JSON download — keep `labelShape` / `labelDtype` only for seg label metadata
- **Do not implement latent space** unless explicitly requested
- **Do not reintroduce Room Dimensions as a large left-sidebar consumer** without explicit instruction
- **Do not break compact Session Data tab labels** so tabs overlap again
- **Do not duplicate XYZ and equivalent projection coordinates** in annotation hover tooltips
- **Do not regress landmark UI display names** away from readable Title Case (`formatLandmarkDisplayName`)
- **Do not thicken `main.js` orchestration** — keep it a thin orchestrator; retain intentionally kept internal helpers/stubs as documented in `PROJECT_STRUCTURE.md`

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/main.js` | Thin app orchestrator: scene assembly (incl. body measurement preview group), interaction/UI/export/import setup, Front Surface + Body Evidence + Measurement Line Preview Overlay + consolidated Body tab + workflow/collapsible sections init, resize, animation loop |
| `src/core/constants.js` | Shared scale, grid, LOD, and tooltip constants |
| `src/core/frontSurface.js` | Front Surface depth, 2D↔3D mapping helpers (`frontSurfaceTo3d`, `frontSurfaceFrom3d`, `isOnFrontSurface`, readout formatting) |
| `src/core/annotationTypes.js` | Allowed annotation node types, landmark preset mappings, normalize/fallback, display labels |
| `src/core/landmarkDisplay.js` | Shared Title Case landmark / annotation display-name helper (`formatLandmarkDisplayName`) |
| `src/core/formatters.js` | Coordinate, point, annotation, and distance display formatting |
| `src/core/math.js` | smoothstep and Euclidean distance helpers |
| `src/core/scene.js` | Scene, camera, WebGL renderer, CSS2DRenderer, OrbitControls, resize |
| `src/metrology/roomShell.js` | Transparent room shell and 10 cm surface grid markers |
| `src/metrology/volumeGrid.js` | 5 cm internal lattice, LOD layers, `setInternalVolumeGridVisible()` |
| `src/metrology/axes.js` | X/Y/Z axes and 20 cm axis labels |
| `src/metrology/referenceMarkers.js` | Origin and Center markers, hover labels, `setReferenceMarkersVisible()` |
| `src/features/appMode.js` | App mode state (Inspect & Measure vs Annotate) |
| `src/features/selection.js` | Selected point state and highlight (Annotate mode) |
| `src/features/measurement.js` | Shared Point A/B measurement state, markers, line, floating label, history, clear/advance, line visibility, import restore |
| `src/features/frontSurfaceMeasurement.js` | Front Surface advance/read helpers over the shared measurement — no separate 2D A/B state |
| `src/features/projectionLinking.js` | Read-only Front Surface projection of Origin/Center/annotations into `#grid2d-markers`; View Controls sync; annotation hover without duplicate projection coords |
| `src/features/bodyEvidence.js` | Body Evidence state store, analyze/clear, primary + secondary overlay visibility, fixed v0 display-scale resolution, inspect/select, core-front + secondary-front getters, manual Promote (core or secondary), Body Anchor Audit helper (`buildBodyAnchorAudit`), diagnostic JSON download |
| `src/features/bodyEvidenceAdapter.js` | Body-only parse/normalize/QA adapter; landmark classification (face/head rejection, ignored/deferred, core-13 primary whitelist, Secondary Body Landmark Candidates v0 allowlist); fixed Body Evidence v0 scale assumptions; conceptual/mock evidence |
| `src/features/bodyMeasurementLevels.js` | Measurement Reference Levels v0 compute (`buildMeasurementReferenceLevels`) — read-only level organization + optional paired spans from `body_landmark` annotations (internal; separate panel not shown by default) |
| `src/features/bodyMeasurementLines.js` | Anatomical Measurement Lines v0 compute (`buildAnatomicalMeasurementLines`) — read-only candidate lines + Ready/Missing distances from `body_landmark` annotations |
| `src/features/bodyMeasurementPreview.js` | Measurement Line Preview Overlay v0 — visual-only Ready anatomical preview lines in 3D + Front 2D; separate from A/B measurement rendering; no distance labels on lines |
| `src/features/annotations.js` | Annotation CRUD (incl. programmatic promote path), 3D visuals, visibility, export/import restore; body_landmark pick helpers for Body Landmark Measurement Picking v0 |
| `src/features/sceneExport.js` | Scene State JSON export (canonical shared measurement history; no 2D UI-only fields; no Body Evidence) |
| `src/features/sceneImport.js` | Scene State JSON import validation and restore |
| `src/features/sceneGraphHighlight.js` | Temporary Scene Graph 3D highlight overlays |
| `src/interactions/raycast.js` | Shared raycaster, volume point resolution, `resolveBodyLandmarkMeasurementPoint` |
| `src/interactions/picking.js` | Mode-aware click picking (Inspect: promoted `body_landmark` priority then lattice; Annotate: select only) |
| `src/interactions/pointerEvents.js` | Canvas pointer wiring and left-panel clear/history/annotation buttons |
| `src/interactions/hover.js` | Hover highlight and tooltip coordination |
| `src/ui/domRefs.js` | Cached DOM references (incl. Secondary Body Candidates checkbox + secondary candidate list refs) |
| `src/ui/inspectorWorkflow.js` | Left inspector workflow switching (measurement / annotation / body-evidence); UI-only |
| `src/ui/grid2dNavigator.js` | Front Surface Grid Navigator: 10 cm lattice, Pick/Region, simplified Split, shared measurement overlay, projected markers, Body Evidence overlay redraw hook, Body Measurement Preview 2D redraw hook |
| `src/ui/grid2dMarkerSizing.js` | Relative 2D marker sizing helpers |
| `src/ui/bodyEvidenceOverlay2d.js` | Front Surface Body Evidence overlay markers (core 13 primary + secondary allowlist when visible) + hover tooltip + inspect/select active state (fixed v0 image→cm mapping; no A/B) |
| `src/ui/bodyEvidencePanel.js` | Body Evidence workflow UI: Import / Actions / Summary / Primary Candidates / Secondary Candidates / Selected Landmark / Promote / Clear Selection; wires Body Evidence Overlay + Secondary Body Candidates checkboxes |
| `src/ui/bodyTabConsolidatedPanel.js` | Session Data Body tab consolidation v0: compact Status counts + Advanced Evidence Details name lists + Promoted Body Anchors table + Body Measurement Readiness |
| `src/ui/bodyEvidenceQaPanel.js` | Historical stub — superseded by `bodyTabConsolidatedPanel.js` (not wired from `main.js`; intentionally retained) |
| `src/ui/bodyMeasurementLevelsPanel.js` | Historical stub — Measurement Reference Levels display folded into Body Measurement Readiness (not wired from `main.js`; intentionally retained) |
| `src/ui/bodyMeasurementLinesPanel.js` | Historical stub — Anatomical Measurement Lines display folded into Body Measurement Readiness (not wired from `main.js`; intentionally retained) |
| `src/ui/collapsibleSections.js` | Left Metrology Inspector collapsible section/subgroup headers (UI-only) |
| `src/ui/workspaceLayout.js` | Workspace tabs and combined 3D+2D layout |
| `src/ui/appModeControls.js` | Mode switch UI, workflow sync, and cleanup |
| `src/ui/annotationControls.js` | Landmark Preset dropdown wiring |
| `src/ui/hoverTooltip.js` | Screen-space hover coordinate tooltip |
| `src/ui/measurementPanel.js` | Distance Measurement panel + shared History list (stacked landmark name + coords for active A/B; Front Surface meta label when applicable) |
| `src/ui/annotationPanel.js` | Annotation List rendering |
| `src/ui/sceneGraphPanel.js` | Compact Scene Graph (shared Active Measurement; no 2D Workspace State card) |
| `src/ui/sessionTabs.js` | Session Data tab switching (History / Annotations / Body / Graph / Files) |
| `src/ui/viewControls.js` | View Controls checkbox wiring (3D + projected 2D + shared measurement lines + Body Measurement Previews; Body Evidence Overlay + Secondary Body Candidates wired via Body Evidence panel) |
| `src/ui/selectionPanel.js` | Selected Point panel helper |
| `src/styles/variables.css` | Design tokens |
| `src/styles/layout.css` | App grid and workspace layout |
| `src/styles/components.css` | Inspector (workflows, subgroups, collapsible headers, Body Evidence primary/secondary candidates, Body Status / Advanced Details / Promoted Body Anchors / Readiness, stacked measurement-point name/coords), tabs, history, annotations, Scene Graph |
| `src/styles/overlays.css` | Tooltips, status bar, CSS2D labels, Front Surface grid UI + measurement overlay + projected markers + Body Measurement Preview lines + Body Evidence overlay markers (primary + secondary; active = internal emphasis only, no large outer halo) |
| `src/style.css` | Stylesheet entry (`@import` chain) |
| `index.html` | UI shell including Front Surface 2D pane markup (incl. `#grid2d-body-measurement-previews`), Workflow switch, View Controls (incl. Secondary Body Candidates + Body Measurement Previews), Body Evidence panel (primary + secondary candidates), Body tab (Status / Promoted Body Anchors / Body Measurement Readiness), collapsible left sections |
| `package.json` | Vite + Three.js dependencies |

### Run commands
```bash
npm install
npm run dev
```

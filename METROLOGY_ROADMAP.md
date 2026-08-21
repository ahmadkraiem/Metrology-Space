# REVacity Metrology Space — Development Roadmap

Status: Active guiding roadmap
Purpose: Keep the project aligned with the current architecture and evidence strategy. This roadmap is a source-of-truth planning document, not an immutable specification. Future changes should update this file deliberately rather than silently diverging from it.

## 1. Foundation — COMPLETED

- Canonical Metrology Space
- Front X/Y + Side U/Y navigators
- Body Landmark Evidence
- Front–Side Alignment v0
- Body Graph / Reference Levels

## 2. Semantic Dense Evidence — COMPLETED

- Segmentation Normalization + QA
- Segmentation Preview / Inspection
- Anatomical Region Contract v0
- Pixel-to-Metrology Mapping Core v0
- Anatomical Region Metric Bounds v0

## 3. New Evidence Foundation — COMPLETED

### 3.1 Full Body Evidence Package Contract v0 — COMPLETED

Formalized the canonical multi-modal input package contract across independent Front and Side views:

- `image`
- `pose / landmarks`
- `segmentation`
- `pointmap XYZ`
- `surface normals XYZ`

Key achievements:
- Normalized package domain contract (`body-evidence-package-v0`) and per-view schema.
- Structural readability, modality availability, and raster dimension compatibility QA.
- Lightweight lazy dense buffer access (`getDenseData`) without eager memory duplication.
- In-memory ZIP transport adapter (`importBodyEvidenceZip`) for pipeline/testing workflows.
- Authoritative Package QA presentation in Session Data → Body.
- Automatic analysis triggered upon package upload.
- Strict preservation of geometry boundaries (no pointmap Z → canonical Z, no U → Z, no Front/Side 3D fusion).

### 3.2 Pointmap + Normal Evidence Contract / QA v0 — COMPLETED (Core & Runtime Integration)

Established deterministic dense layout contracts, numeric QA evaluators, same-view cross-modal qualification, and runtime integration:

Key achievements:
- **Dense Layout / Pixel Index Contract v0:** Layout resolution (`HWC_INTERLEAVED`, `CHW_PLANAR`, `UNKNOWN`), `declaredShape` preservation, layout-aware vector indexing (`getDenseVectorElementIndex`, `readDenseVector`), and zero-mutation buffer access.
- **Pointmap Numeric QA Core v0 (`pointmap-numeric-qa-v0`):** Single-pass streaming scan tracking finite elements, NaNs, $\pm\infty$, per-channel min/max distributions, and vector fully-finite ratios. Declarations (`declaredUnits`, `declaredScale`) preserved; coordinate frames, scale semantics, scale application state, and canonical axis meanings explicitly marked `UNVALIDATED`.
- **Surface Normal Numeric QA Core v0 (`normal-numeric-qa-v0`):** Vector magnitude statistics, zero-magnitude tracking, observational near-unit ratio ($|\|v\| - 1.0| \le 0.01$, `NORMAL_UNIT_TOLERANCE = 0.01`), declared-range violation tracking, and raw `uint8` value preservation without heuristic remapping. Coordinate frame, orientation semantics, and encoding semantics explicitly marked `UNVALIDATED`.
- **Same-View Cross-Modal Dense QA v0 (`same-view-dense-cross-modal-qa-v0`):** Independent Front and Side evaluations, pairwise raster compatibility (`segmentation ↔ pointmap ↔ normals`), pixel addressability, and observational mask scanning (`background`, `nonBackground`, `bodyAnatomical` using authoritative `BODY_ANATOMICAL_CLASS_IDS` from `anatomicalRegions.js`). Semantic pixel correspondence explicitly marked `UNVALIDATED`.
- **Runtime Integration v0:** Derived runtime state `denseEvidenceQa = { front, side }` in `bodyEvidence.js`, automatic async evaluation, single-decode buffer reuse per modality per view, stale-session race protection, public getters, and sanitized JSON-safe diagnostic export. Package QA `numericValues` remain deferred/unvalidated.
- **UI State:** Dedicated Dense Evidence QA inspection panel is **intentionally deferred** as an optional presentation feature; Package QA UI remains unchanged.

Guardrails: Pointmap Z is NOT canonical metrology Z, Side U is NOT canonical Z, no depth inference, no Front/Side geometry fusion, and no normal orientation inference.

## 4. Anatomical / Metrology Layer — ACTIVE

### 4.1 Anatomical Level Contract v0 — COMPLETED

Formalized true anatomical reference Y levels from promoted Front body landmarks:

- **Contract**: `anatomical-levels-v0` (`src/features/anatomicalLevels.js`)
- **Supported Levels (7)**: `neck`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`.
- **Status Taxonomy**: Deterministic 3-state model (`ready`, `partial`, `missing`).
  - `ready`: All required anchors present, unique, and finite; provides exact `yCm` and `elevationDeltaCm` for bilateral joints.
  - `partial`: Incomplete anchors (e.g. 1 of 2 bilateral anchors) or duplicate/ambiguous anchors (`yCm: null`, `elevationDeltaCm: null`).
  - `missing`: No candidate anchors present (`yCm: null`, `elevationDeltaCm: null`).
- **Strict Guardrail**: Unsupported torso sub-levels (`chest`, `bust`, `underbust`, `waist`, `abdomen`, `pelvis`, `crotch`) are explicitly **deferred** (no landmark anchors exist; no invented proportional body-height percentages).

### 4.2 Anatomical Region Evidence Association Contract v0 — COMPLETED (at v0 scope)

Associated multi-modal evidence and topological landmark/level relationships with canonical body regions:

- **Contract**: `anatomical-region-evidence-v0` (`src/features/anatomicalRegionEvidence.js`)
- **Scope**: Exactly the 13 canonical `body_anatomical` regions (6 left, 6 right, 1 central `Torso`).
- **Laterality**: Authoritative mapping via `ANATOMICAL_REGION_LATERALITY` in `src/features/anatomicalRegions.js`.
- **4.2A Region Evidence Nodes**: Attached presence, pixel counts, coverage, pixel bounds (`boundsPx`), normalized bounds (`boundsNormalized: { minU, maxU, minV, maxV }`), Front metric bounds ($X/Y$), Side profile bounds ($U/Y$), and view-level dense qualification (`pixelAddressable: boolean | null`, `qaStatus: pass | warning | fail | null`).
- **4.2B Landmark & Level Associations**: Formalized explicit topological adjacency (`relation: 'adjacent'`) to promoted Front body landmarks (`availability: 'present' | 'missing' | 'ambiguous' | 'invalid'`) and reference levels (`status: 'ready' | 'partial' | 'missing'`). Side view strictly isolates Front evidence (`landmarkAssociations = []`, `levelAssociations = []`).
- **4.2C Per-Class Dense Statistics Deferral**: Per-class pointmap/normal scanning is **explicitly deferred** because Front/Side 2D silhouette measurements do not require dense coordinate statistics.

### 4.3 Front Measurement Foundation v0 — COMPLETED (at v0 scope)

Formalized pure, deterministic Front-plane transverse body width extraction from segmentation evidence:

- **4.3A Front Horizontal Raster Slice Contract v0 (`front-horizontal-raster-slice-v0`)** (`src/features/frontRasterSlice.js`):
  - Pure $O(W)$ single-row streaming scan across Front segmentation raster at canonical $Y$ levels ($y_{cm} \in [0, 200]$).
  - Detects all contiguous horizontal runs in left-to-right order with inclusive column indices, normalized $U$ bounds, and metric $X\text{ cm}$ bounds.
  - Zero multi-run merging; zero buffer re-decoding; out-of-range $y_{cm}$ yields `runs: []` with explicit issues without silent clamping.
  - Authoritative policies: `TORSO_ONLY` (`[22]`), `BODY_ANATOMICAL` (13 body classes), `FOREGROUND` (classes 1..28).
- **4.3B Front Transverse Width Interpretation Contract v0 (`front-transverse-width-v0`)** (`src/features/frontTransverseWidth.js`):
  - Pure interpretation of raster slice evidence into formal transverse body width observations at ready reference levels.
  - Supported definitions: `torso_width_at_shoulder_level` (`sourceLevel: 'shoulder'`) and `torso_width_at_hip_level` (`sourceLevel: 'hip'`).
  - Conservative selection policy: `single_run_required` (exactly 1 run $\to$ `valid`, 0 runs $\to$ `unavailable`, $> 1$ runs $\to$ `ambiguous` with `valueCm: null`).
  - Formula: $\text{valueCm} = maxX_{cm} - minX_{cm}$; retains raw $leftXcm$, $rightXcm$, and complete slice provenance.
  - Runtime getters in `src/features/bodyEvidence.js`: `getFrontHorizontalRasterSlice()`, `getFrontTransverseWidth()`, `getFrontTransverseWidths()`.
- **Semantic Separation**: Existing 3D landmark candidate lines in `bodyMeasurementLines.js` remain distinct candidate lines; formal transverse silhouette widths are distinct.

### 4.4 Side Profile Measurement Foundation v0 — COMPLETED

Extract deterministic Side profile spans from validated Side segmentation evidence at canonical $Y$ levels:

- **4.4A Side Horizontal Raster Slice Contract v0 (`side-horizontal-raster-slice-v0`) — COMPLETED**:
  - Pure $O(W)$ single-row streaming scan across Side segmentation raster at canonical $Y$ levels ($y_{cm} \in [0, 200]$) without buffer re-decoding, copying, or mutation.
  - Returns contiguous horizontal profile runs in Side Metrology space ($U\text{ cm}$, $200\text{ cm}$ domain) with inclusive column indices, normalized $U$ bounds, and metric $U\text{ cm}$ bounds.
  - Zero multi-run merging; out-of-range $y_{cm}$ yields `runs: []` with explicit issues without silent clamping.
  - Authoritative policies: `TORSO_ONLY` (`[22]`), `BODY_ANATOMICAL` (reuses authoritative `BODY_ANATOMICAL_CLASS_IDS` from `anatomicalRegions.js` evaluating to `[5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 20, 21, 22]`), `FOREGROUND` (classes 1..28).
  - Runtime getter in `src/features/bodyEvidence.js`: `getSideHorizontalRasterSlice()`.
  - Core mapping helper in `src/core/pixelMetrologyMapping.js`: `pixelColumnSpanToSideMetrology()`.
- **4.4B Side Profile Span Interpretation Contract v0 (`side-profile-span-v0`) — COMPLETED**:
  - Pure interpretation layer deriving Side profile spans ($\Delta U = maxU_{cm} - minU_{cm}$) from Side raster slice evidence under `single_run_required` policy (`src/features/sideProfileSpan.js`).
  - Supported definitions: `torso_profile_span_at_shoulder_level` (`sourceLevel: 'shoulder'`, `TORSO_ONLY`, class `[22]`) and `torso_profile_span_at_hip_level` (`sourceLevel: 'hip'`, `TORSO_ONLY`, class `[22]`).
  - Conservative selection policy: `single_run_required` (exactly 1 run $\to$ `valid`, 0 runs $\to$ `unavailable`, $> 1$ runs $\to$ `ambiguous` with `valueCm: null`, malformed/invalid source evidence $\to$ `invalid`, missing/partial anatomical level $\to$ `unavailable`).
  - Formula: $\text{valueCm} = maxU_{cm} - minU_{cm}$; preserves raw `minUcm`, `maxUcm`, source anatomical level provenance, sampled raster-row provenance, source slice contract, target policy/classes, run-selection policy, and issues.
  - Runtime getters in `src/features/bodyEvidence.js`: `getSideProfileSpan()`, `getSideProfileSpans()` (`side-profile-spans-report-v0`). Pure interpretation decoupled from direct segmentation or level scans (orchestrated by `bodyEvidence.js`: level readiness $\to$ `getSideHorizontalRasterSlice()` $\to$ `interpretSideProfileSpan()`).
  - Strict Guardrails: Authoritative term is **Side profile span**. Side $U$ remains 2D profile-coordinate evidence only; it is **NOT** canonical $Z$, and it is **NOT** validated physical depth. No $U \to Z$ conversion, no Front/Side fusion, no cross-view calculations, no circumference/cross-section/volume, no ellipse assumptions, and no pointmap/normals geometry.

### 4.5 Cross-view Correspondence + QA — PLANNED

Extend beyond current vertical-Y alignment only through explicit correspondence/QA contracts:
- Establish whether Front and Side measurement evidence at the same anatomical level is semantically and spatially comparable.
- Strict Guardrails: Side U remains 2D profile coordinate evidence only and does NOT become physical depth; no U -> Z conversion; no circumference or cross-section inference.
- Keep 4.6 blocked until cross-view validation is complete.

### 4.6 Circumference / Cross-section Inference — BLOCKED

Blocked until Front transverse widths (4.3), Side profile spans (4.4), and cross-view correspondence QA (4.5) are fully validated.
Strict Guardrail: No premature ellipse/circumference assumptions.

## 5. Canonical / Latent Layer — LATER

### 5.1 Canonical Body Evidence Graph
Represent each anatomical entity as a structured evidence node that may contain:
- semantic identity
- landmarks
- segmentation support
- pixel and metric bounds
- pointmap evidence
- surface normals
- QA / provenance
- validated measurements

### 5.2 Structured Latent Conditioning Package
Prepare deterministic structured conditioning data for downstream latent/generative systems.

### 5.3 Downstream Body / Garment Generation & Editing
Use the validated canonical evidence/latent representation in later body, garment, VTO, editing, and digital-twin workflows.

## 6. Current Architectural Guardrails

Do not silently introduce:
- direct U → Z conversion
- Pointmap Z → canonical metrology Z
- unvalidated depth inference
- Front/Side geometry fusion
- circumference before cross-section evidence is validated
- body volume before geometry is validated
- 3D reconstruction from unverified pointmaps
- face data into the body-metrology pipeline
- invented anatomical regions unsupported by current evidence
- hard-coded pixel-to-cm assumptions that bypass the mapping contract
- synthetic chest/bust/waist reference levels without landmark anchors

## 7. Current Input Strategy

The canonical body evidence package is:

### Front
- image
- pose / landmarks
- segmentation
- pointmap XYZ
- surface normals XYZ

### Side
- image
- pose / landmarks
- segmentation
- pointmap XYZ
- surface normals XYZ

Current usage:
- Pose: active & normalized
- Segmentation: active & normalized
- Pointmap: active & normalized, with numeric and cross-modal QA evaluated; geometry semantics remain unvalidated
- Normals: active & normalized, with numeric and cross-modal QA evaluated; geometry semantics remain unvalidated

## 8. Roadmap Change Policy

This roadmap may evolve as stronger model outputs or validated evidence become available.

When changing direction:
1. preserve completed stable contracts unless there is a proven reason to revise them;
2. document why the roadmap changed;
3. update `PROJECT_CONTEXT.md` and `PROJECT_STRUCTURE.md` where relevant;
4. keep deferred geometry assumptions explicit;
5. avoid silently replacing the current source-of-truth architecture.

## 9. Immediate Next Milestone

**4.5 — Cross-view Correspondence + QA**


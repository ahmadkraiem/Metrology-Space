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

### 4.5 Cross-view Correspondence + QA — COMPLETED

Extend beyond vertical-Y landmark alignment through explicit measurement correspondence and cross-view comparability QA contracts:

- **4.5A Cross-view Measurement Correspondence Contract v0 (`cross-view-measurement-correspondence-v0`) — COMPLETED**:
  - Pure deterministic domain correspondence layer (`src/features/crossViewMeasurementCorrespondence.js`) pairing Front transverse width observations (`front-transverse-width-v0`) and Side profile span observations (`side-profile-span-v0`) at matching validated anatomical source levels.
  - Registry-driven definitions (`SUPPORTED_CROSS_VIEW_CORRESPONDENCES_V0`):
    - `torso_shoulder_cross_view_correspondence` (`sourceLevel: 'shoulder'`, Front: `torso_width_at_shoulder_level`, Side: `torso_profile_span_at_shoulder_level`).
    - `torso_hip_cross_view_correspondence` (`sourceLevel: 'hip'`, Front: `torso_width_at_hip_level`, Side: `torso_profile_span_at_hip_level`).
    - Strictly registry-driven; pairings are not permissively inferred from arbitrary observation IDs.
  - Status taxonomy: `ready` (both observations `valid`, matching expected definition IDs and source level, consistent provenance), `partial` (one valid, one unavailable/ambiguous), `unavailable` (both unavailable/ambiguous/missing), `invalid` (invalid source observation, wrong contract/view, mismatched definition IDs, mismatched source levels, contradictory finite Y provenance, or unregistered definition).
  - Precedence rule: If either Front or Side observation has status `invalid`, the correspondence result is strictly `invalid`.
  - Provenance & Evidence Preservation: Intact Front observation (`valueCm`, `leftXcm`, `rightXcm` in X-space) and Side observation (`valueCm`, `minUcm`, `maxUcm` in U-space) preserved without reinterpretation. Y-level provenance (`levelYcm`) preserved and verified (contradictory finite Y values trigger status `invalid`). No new Y alignment, correction, tolerance remapping, or modification to `frontSideAlignment.js`.
  - Runtime getters in `src/features/bodyEvidence.js`: `getCrossViewMeasurementCorrespondence()`, `getCrossViewMeasurementCorrespondences()` (`cross-view-measurement-correspondences-report-v0`).
  - Strict Guardrails: The status `ready` indicates **correspondence-readiness only**; it does NOT mean geometry-ready and does NOT validate Side U as physical depth. Side U remains 2D profile-coordinate evidence only; no $U \to Z$ conversion, no Front/Side geometry fusion, no depth fields, no ellipse/circumference/cross-section/volume calculations, and no pointmap/normals geometry.
- **4.5B Cross-view Comparability QA v0 (`cross-view-comparability-qa-v0`) — COMPLETED**:
  - Pure deterministic QA layer (`src/features/crossViewComparabilityQa.js`) evaluating whether established 4.5A correspondence evidence is sufficiently qualified and internally consistent for later cross-view use.
  - 4-state QA taxonomy: `pass`, `warning`, `fail`, `unavailable`. Availability taxonomy: `available`, `unavailable`.
  - Deterministic inspectable checks (10 total):
    1. `correspondence_contract_valid`: Validates contract tag `cross-view-measurement-correspondence-v0`.
    2. `supported_definition`: Confirms registry-supported correspondence definition.
    3. `correspondence_status`: Inspects correspondence status (`ready` $\to$ pass; `partial` $\to$ warning; `unavailable` $\to$ skip; `invalid` $\to$ fail).
    4. `front_observation_valid`: Validates Front observation contract, view `'front'`, and status `'valid'`.
    5. `side_observation_valid`: Validates Side observation contract, view `'side'`, and status `'valid'`.
    6. `source_level_consistent`: Confirms consistent source anatomical level across definition, Front, and Side provenance.
    7. `y_provenance_consistent`: Reuses established 4.5A consistency rule (`|frontLevelYcm - sideLevelYcm| <= 1e-4`). No new alignment algorithm, Y correction, or tolerance remapping. `frontSideAlignment.js` remains unchanged.
    8. `front_measurement_evidence_complete`: Confirms finite `valueCm > 0` and valid metric endpoints `leftXcm < rightXcm`.
    9. `side_profile_evidence_complete`: Confirms finite `valueCm > 0` and valid metric endpoints `minUcm < maxUcm`.
    10. `source_slice_provenance_complete`: Pure structural check verifying sampled row indices and slice contract identifiers without raster re-read or segmentation rescan.
  - Status semantics:
    - `pass`: Registered, structurally valid correspondence with status `ready`, valid Front/Side observations, consistent source level and Y provenance, complete metric evidence, and complete slice provenance.
    - `warning`: Reserved for structurally valid but only partially qualified correspondence evidence (e.g. status `partial`).
    - `fail`: Structural failure or contradiction (invalid correspondence/source, wrong contract/view, unsupported definition, mismatched level, contradictory Y provenance, missing required endpoints).
    - `unavailable`: Correspondence/evidence absent or unavailable without structural contract contradiction.
  - Runtime getters in `src/features/bodyEvidence.js`: `getCrossViewComparabilityQa()`, `getCrossViewComparabilityQaReport()` (`cross-view-comparability-qa-report-v0`).
  - Critical Semantics: A QA `pass` strictly certifies that Front transverse width and Side profile span are **structurally comparable and sufficiently qualified at the current 2D evidence-contract level**. It does **NOT** validate physical depth, does **NOT** treat Side U as canonical $Z$, does **NOT** approve 3D geometry fusion, and does **NOT** certify circumference, ellipse, cross-section, or volume inference.

### 4.5C Side Physical-Frame / Depth Semantics Validation v0 — NEXT

Validation and design milestone to investigate and establish whether and under what proven calibration/frame assumptions Side U-space profile evidence can represent a physically meaningful body depth quantity.

Explicit validation scope:
- Side coordinate-frame semantics and camera/projection assumptions
- Scale and calibration validity across views
- Whether Side U metric spans correspond to physical body dimensions
- Required provenance and calibration metadata
- Failure and unknown states when physical depth semantics cannot be established

Strict Guardrails:
- Do NOT assume Side $U \equiv \text{canonical } Z$.
- Do NOT assume Side profile span is already physical depth.
- Do NOT assume Front/Side geometry fusion is already valid.
- 4.6 remains BLOCKED until 4.5C validates the required physical semantics.

### 4.6 Circumference / Cross-section Inference — BLOCKED

Blocked until Front transverse widths (4.3), Side profile spans (4.4), cross-view correspondence QA (4.5), and Side physical-frame / depth semantics validation (4.5C) are fully validated.
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

**4.5C — Side Physical-Frame / Depth Semantics Validation v0**


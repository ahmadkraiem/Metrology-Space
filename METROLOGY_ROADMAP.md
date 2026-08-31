# TWENTY EIGHT — Development Roadmap

Status: Active guiding roadmap
Purpose: Keep the project aligned with the current architecture and evidence strategy. This roadmap is a source-of-truth planning document, not an immutable specification. Future changes should update this file deliberately rather than silently diverging from it.

## 1. Foundation — COMPLETED

- Canonical Metrology Space
- Front X/Y + Side U/Y navigators
- Body Landmark Evidence
- Front–Side Alignment v0
- Body Graph / Reference Levels
- Application Shell / UI Modernization Checkpoint (workflow-driven Left Sidebar; Right Sidebar Results / Session Records / Diagnostics; Hist / Annos / Body / Graph tabs removed). **No Pointmap geometry work is included.**

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
- Package QA HTML helper retained for tests; live Diagnostics Advanced QA shows intake identity and metric calibration only.
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
- **UI State:** Dedicated Dense Evidence QA inspection panel is **intentionally deferred**. Live Advanced QA does not remount the full Package QA modality card.

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
  - Supported definitions: `torso_profile_span_at_shoulder_level` (`sourceLevel: 'shoulder'`, `trunk_core_support_v0`, classes `[22, 23]`) and `torso_profile_span_at_hip_level` (`sourceLevel: 'hip'`, `pelvic_core_support_v0`, classes `[12, 13, 21, 22]`).
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

### 4.5C Shared Metric Calibration & Physical Measurement Semantics v0 — COMPLETED

Formalized shared Front/Side metric calibration provenance validation and explicit 3-level physical measurement semantics:

- **4.5C-1 Metric Calibration Provenance Contract v0 (`metric-calibration-provenance-v0`)** (`src/features/metricCalibrationProvenance.js`):
  - Pure deterministic domain validator qualifying whether upstream Body Pipeline metric scaling claims are complete and mathematically sound across standardized Front and Side views.
  - Inspects and validates: `pixelsPerCm`, isotropic scaling consistency (`scaleFactorX === scaleFactorY`), standardized canvas extent agreement (`canvasWidthPx === canvasHeightPx === 2000`), active raster dimension matching, preprocessing crop/scale provenance, and TWENTY EIGHT workspace scale agreement ($2000\text{ px} \leftrightarrow 200\text{ cm}$, $10\text{ px/cm}$).
  - Independent Isotropic Validation: Verified via rounding-aware pixel-domain checks (`ISOTROPIC_ROUNDING_TOLERANCE_PX = 1.0`) rather than blindly trusting declared flags.
  - 4-state taxonomy: `validated` (`metricProjectedEligibility: true`), `unvalidated` (`metricProjectedEligibility: false`), `invalid` (`metricProjectedEligibility: false`), `unavailable`.
  - Important Semantics: Metric calibration establishes **2D metric projected image-plane measurements only**. It does **NOT** establish physical 3D calibration, true unclothed physical body dimensions, canonical $Z$, 3D geometry, or Front/Side coordinate fusion.
  - Runtime getter in `src/features/bodyEvidence.js`: `getMetricCalibrationProvenance({ view })`.
- **4.5C-2 Physical Measurement Semantics Contract v0 (`physical-measurement-semantics-v0`)** (`src/features/physicalMeasurementSemantics.js`):
  - Pure deterministic contract evaluating the explicit semantic tier of a 2D silhouette measurement under three strictly separated tiers:
    1. `workspaceSpanCm`: Workspace-level U/X-space geometric evidence.
    2. `metricProjectedSpanCm`: Metric projected image-plane span in cm, populated only when 4.5C-1 calibration provenance is validated.
    3. `physicalSpanCm`: True physical body dimension in cm; strictly requires an authoritative physical capture/projection evidence contract from the registry.
  - Registry-driven validator for accepted evidence contract types: strictly rejects caller-controlled boolean flags or unproven shortcuts.
  - 5-state status taxonomy: `validated` (`physicalEligibility: true`, `physicalSpanCm` populated), `projected_metric_only` (`metricProjectedEligibility: true`, `physicalEligibility: false`, `physicalSpanCm: null`), `unvalidated` (`physicalEligibility: false`, `physicalSpanCm: null`), `invalid`, `unavailable`.
  - Bulk evaluation report contract: `physical-measurement-semantics-report-v0`.
  - Runtime getters in `src/features/bodyEvidence.js`: `getPhysicalMeasurementSemantics({ id, annotations, physicalEvidencePaths })`, `getPhysicalMeasurementSemanticsReport({ annotations, physicalEvidencePaths })`.

### Measurement Support Policy v0 (`measurement-support-policy-v0`) — COMPLETED

Centralized deterministic policy defining the **measurement-support silhouette / observed supported silhouette** for Front and Side measurements:

- **Contract**: `measurement-support-policy-v0` (`src/features/measurementSupportPolicy.js`).
- **Policy Registry**:
  - `trunk_core_support_v0`:
    - `anatomicalClassIds`: `[22]` (`Torso`)
    - `clothingBridgeClassIds`: `[23]` (`Upper_Clothing`)
    - `acceptedClassIds`: `[22, 23]`
    - Used for: Front shoulder transverse width (`torso_width_at_shoulder_level`) and Side shoulder profile span (`torso_profile_span_at_shoulder_level`).
  - `pelvic_core_support_v0`:
    - `anatomicalClassIds`: `[12, 21, 22]` (`Left_Upper_Leg`, `Right_Upper_Leg`, `Torso`)
    - `clothingBridgeClassIds`: `[13]` (`Lower_Clothing`)
    - `acceptedClassIds`: `[12, 13, 21, 22]`
    - Used for: Front hip transverse width (`torso_width_at_hip_level`) and Side hip profile span (`torso_profile_span_at_hip_level`).
- **Strict Integration Guardrails**:
  - No gap filling, no run merging, no largest-run selection, and no background bridging.
  - `single_run_required` policy remains unchanged in `frontTransverseWidth.js` and `sideProfileSpan.js`.
  - Generic `TORSO_ONLY` (`[22]`), `BODY_ANATOMICAL`, and `FOREGROUND` diagnostic slicing policies in raster scanners remain unchanged.
- **Clothing Evidence Provenance**:
  - Every resulting observation records: `supportPolicyId`, `actualClassIdsUsed`, `clothingClassIdsUsed`, and `usedClothingEvidence: boolean`.
  - **Important Semantic Rule**: A measurement with `status: valid` means exactly **one valid contiguous observed supported silhouette run exists under the declared measurement-support policy**. It does **NOT** mean unclothed body width is proven, true body depth is proven, or physical body surface has been reconstructed. When `usedClothingEvidence: true`, the measurement remains identifiable as clothing-supported observed silhouette evidence.

### Real Package Positive Metric Integration (`C:\Users\VIP\Downloads\output.zip`)

The unified Body Pipeline archive is successfully consumed and validated by TWENTY EIGHT:

- **Real Upstream Align Calibration Provenance**: Recognized from `body/Align/result.json` and mapped through `bodyEvidenceZipAdapter.js` into canonical calibration contracts.
- **Validated Metric Calibration**:
  - Front View: `status: 'validated'`, `metricProjectedEligibility: true`, `scaleCmPerPx: 0.1` ($10\text{ px/cm}$).
  - Side View: `status: 'validated'`, `metricProjectedEligibility: true`, `scaleCmPerPx: 0.1` ($10\text{ px/cm}$).
  - Isotropic scaling passes independent pixel-domain verification (`ISOTROPIC_ROUNDING_TOLERANCE_PX = 1.0`).
- **Validated Metric Projected Measurements**:
  - **Front Shoulder Width** ($Y = 132.85\text{ cm}$): Workspace = **$30.80\text{ cm}$**, Metric Projected = **$30.80\text{ cm}$** (`actualClassIdsUsed: [22, 23]`, `clothingClassIdsUsed: [23]`, `usedClothingEvidence: true`).
  - **Side Shoulder Span** ($Y = 132.85\text{ cm}$): Workspace = **$11.00\text{ cm}$**, Metric Projected = **$11.00\text{ cm}$** (`actualClassIdsUsed: [22, 23]`, `clothingClassIdsUsed: [23]`, `usedClothingEvidence: true`).
  - **Front Hip Width** ($Y = 86.25\text{ cm}$): Workspace = **$42.20\text{ cm}$**, Metric Projected = **$42.20\text{ cm}$** (`actualClassIdsUsed: [12, 13, 21]`, `clothingClassIdsUsed: [13]`, `usedClothingEvidence: true`).
  - **Side Hip Span** ($Y = 86.25\text{ cm}$): Workspace = **$27.70\text{ cm}$**, Metric Projected = **$27.70\text{ cm}$** (`actualClassIdsUsed: [12, 13]`, `clothingClassIdsUsed: [13]`, `usedClothingEvidence: true`).
- **Semantic Qualification**: These values are certified **2D metric projected image-plane measurements**. They are **NOT** automatically true unclothed physical body dimensions.

### 4.5D Physical Measurement Eligibility Contract v0 — COMPLETED

Formalized the authoritative downstream eligibility gate determining whether metric-projected measurements may be consumed as true physical anatomical scalars:

- **Core Contracts**:
  - Individual Tier 1 Contract: `physical-measurement-eligibility-v0` (`src/features/physicalMeasurementEligibility.js`).
  - Paired Tier 2 Contract: `paired-cross-view-eligibility-v0` (`src/features/physicalMeasurementEligibility.js`).
  - Runtime Integration: `src/features/bodyEvidence.js` (`getPhysicalMeasurementEligibility`, `getPhysicalMeasurementEligibilityReport`, `getPairedCrossViewEligibility`, `getPairedCrossViewEligibilityReport`).
- **Semantic Responsibility & Hierarchy**:
  - 4.5C answers: *What semantic tier does this measurement occupy?*
  - 4.5D answers: *Is this measurement eligible to be consumed by downstream models as a true physical anatomical scalar?*
  - Strict preservation of the 3 semantic tiers:
    1. *Observed Supported Silhouette* (Landmarks + Segmentation + Support Policy)
    2. *Metric Projected Measurement* (Validated Align calibration, image-plane scalar in cm)
    3. *Physical Anatomical Measurement* (Authoritative view/pose + clothing authorized + physical evidence)
- **Tier 1 Status Taxonomy**:
  - `eligible`: All eligibility gates pass (`physicalEligibility: true`, `physicalMeasurementCm` finite positive number).
  - `blocked_by_clothing`: Valid metric projection, but clothing contributes to the silhouette without recognized clothing authorization (`physicalEligibility: false`, `physicalMeasurementCm: null`, `metricProjectedSpanCm` preserved).
  - `metric_projected_only`: Valid metric projection, but non-clothing physical requirements (view/pose semantics or physical evidence) are missing (`physicalEligibility: false`, `physicalMeasurementCm: null`).
  - `unvalidated`: Metric calibration or semantic baseline is unvalidated/missing.
  - `invalid`: Structural corruption, anatomical level mismatch, or contradictory input evidence.
  - `unavailable`: Source observation absent or unavailable.
- **Authoritative Physical-Value Provenance**:
  - `metricProjectedSpanCm === physicalMeasurementCm` is **never** assumed as a general invariant.
  - `physicalMeasurementCm` must be explicitly supplied or authorized by a recognized authoritative physical evaluator result.
  - Supported interpretations: `direct_equivalence` (projection matches body scalar) and `corrected_physical_measurement` (evaluator provides corrected physical scalar, e.g. after garment/body offset correction).
  - 4.5D itself does **NOT** calculate garment corrections, perspective corrections, body-under-clothing estimates, or 3D depth transforms.
- **Blocker Model & Precedence**:
  - Deterministic precedence: 1. source unavailable $\to$ `unavailable`, 2. structural integrity failure $\to$ `invalid`, 3. metric calibration unvalidated $\to$ `unvalidated`, 4. clothing authorization missing $\to$ `blocked_by_clothing`, 5. view/pose semantics missing $\to$ `metric_projected_only`, 6. authoritative physical evidence missing $\to$ `metric_projected_only`.
  - Multi-blocker preservation: Primary status reflects the dominant gate, while **all** active blockers are preserved in the `blockers` array.
- **Clothing-Aware Semantics**:
  - Current real archive uses clothing (Shoulder: class 23 `Upper_Clothing`; Hip: class 13 `Lower_Clothing`).
  - Fitted garments are **not** assumed to reproduce true unclothed body surface without recognized authorization.
  - All 4 real measurements resolve to `status: 'blocked_by_clothing'`, preserving metric projected spans while keeping `physicalMeasurementCm: null`.
- **Required View / Pose Semantics**:
  - Physical promotion requires authoritative stance/pose validation (Front: frontal orientation; Side: lateral/profile orientation).
  - Missing view/pose semantics prevents physical eligibility while keeping metric projections intact.
- **Authoritative Evidence Architecture**:
  - Dimension E consumes Milestone 4.5G (`authoritative-physical-evidence-semantics-v0`) as the authoritative-physical-evidence input.
  - A 4.5G result is accepted as authoritative physical evidence only when `contract === 'authoritative-physical-evidence-semantics-v0'`, `status === 'validated'`, `authorized === true`, `physicalAuthority.status === 'authoritative'`, and `evaluatorId` is registered in `IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS`.
  - Current authoritative physical-geometry evaluator registry is empty (`IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS = []`). The implemented dense-geometry evaluator `sapiens-pointmap-camera-frame-evaluator-v0` classifies camera-frame evidence only and cannot satisfy Dimension E.
  - Production 4.5D physical evaluators remain **NONE** (`IMPLEMENTED_PHYSICAL_EVALUATORS = []`).
  - `validated-dense-geometry-v0` remains reserved and is not enabled.
  - Anti-forgery / registry guard: raw caller booleans (`{ physicalEligibility: true }`), forged `validated` / `authorized` objects, and unregistered evaluator IDs are strictly rejected.
- **Tier 2 Paired Cross-View Eligibility (`paired-cross-view-eligibility-v0`)**:
  - Consumes Front Tier 1, Side Tier 1, 4.5A correspondence, and 4.5B comparability QA without recomputing or coordinate fusion.
  - Requires **both** views to be `eligible`, 4.5A to be `ready`, and 4.5B to be `pass` for `pairedPhysicalEligibility: true`.
  - Statuses: `eligible`, `partial`, `blocked`, `unavailable`.
- **Real Archive Results (`output.zip`)**:
  - **Tier 1 Individual Measurements**:
    - Front Shoulder: Metric Projected = **$30.80\text{ cm}$**, `status: 'blocked_by_clothing'`, `physicalEligibility: false`, `physicalMeasurementCm: null`, `blockers: ['clothing_authorization_missing', 'view_pose_semantics_missing', 'authoritative_physical_evidence_missing']`.
    - Side Shoulder: Metric Projected = **$11.00\text{ cm}$**, `status: 'blocked_by_clothing'`, `physicalEligibility: false`, `physicalMeasurementCm: null`, `blockers: ['clothing_authorization_missing', 'view_pose_semantics_missing', 'authoritative_physical_evidence_missing']`.
    - Front Hip: Metric Projected = **$42.20\text{ cm}$**, `status: 'blocked_by_clothing'`, `physicalEligibility: false`, `physicalMeasurementCm: null`, `blockers: ['clothing_authorization_missing', 'view_pose_semantics_missing', 'authoritative_physical_evidence_missing']`.
    - Side Hip: Metric Projected = **$27.70\text{ cm}$**, `status: 'blocked_by_clothing'`, `physicalEligibility: false`, `physicalMeasurementCm: null`, `blockers: ['clothing_authorization_missing', 'view_pose_semantics_missing', 'authoritative_physical_evidence_missing']`.
  - **Tier 2 Paired Correspondences**:
    - Shoulder Pair: `pairedMetricProjectedEligibility: true`, `pairedPhysicalEligibility: false`, `pairedStatus: 'blocked'`.
    - Hip Pair: `pairedMetricProjectedEligibility: true`, `pairedPhysicalEligibility: false`, `pairedStatus: 'blocked'`.

### 4.5E Authoritative View / Pose Semantics Validation v0 — COMPLETED (Structural Scope)

Formalized the deterministic domain qualification layer determining whether Front and Side observations are captured in a sufficiently valid view and stance configuration:

- **Core Contract**: `view-pose-semantics-v0` (`src/features/viewPoseSemantics.js`).
- **Test Suite**: `src/features/viewPoseSemantics.test.js` (13 unit and real archive tests).
- **Runtime Integration**: `src/features/bodyEvidence.js` (`getViewPoseSemantics({ view })`, `getViewPoseSemanticsReport()`, and automated defaulting in `getPhysicalMeasurementEligibility`).
- **Package / Adapter Preservation**: `src/features/bodyEvidencePackage.js` and `src/features/bodyEvidenceZipAdapter.js` preserve raw staging metadata (`rawSources: { aposeResult, alignResult }`).
- **Three Strictly Separated Semantic Layers**:
  1. **Layer A — Declared / Pipeline View Identity**:
     - Verifies whether the observation is consistently routed/labeled as Front or Side.
     - Confirms pipeline routing and category label consistency only; does **not** prove physical camera orientation.
  2. **Layer B — Structural Pose Qualification**:
     - Deterministically validates 2D pose sanity from existing package evidence.
     - Checks: Required landmark presence (`neck`, `left_shoulder`, `right_shoulder`, `left_hip`, `right_hip`, `left_wrist`, `right_wrist`, `left_ankle`, `right_ankle`), reuse of canonical `LOW_CONFIDENCE_THRESHOLD = 0.5` from `bodyEvidenceAdapter.js`, monotonic vertical anatomical ordering ($Y_{\text{top}} < Y_{\text{shoulder}} < Y_{\text{hip}} < Y_{\text{ankle}}$), and Front A-pose limb separation ($X_{\text{right\_wrist}} < X_{\text{right\_shoulder}}$ and $X_{\text{left\_shoulder}} < X_{\text{left\_wrist}}$).
     - Proves 2D image-plane structural pose sanity only.
  3. **Layer C — Authoritative Physical Orientation Certification**:
     - Proves the observation's physical 3D orientation is certified (e.g. zero yaw, orthogonal lateral capture) for true anatomical measurement interpretation.
     - Production implementation has **no implemented physical orientation evaluator** (`IMPLEMENTED_PHYSICAL_ORIENTATION_EVALUATORS = []`).
- **Status Taxonomy**:
  - `validated`: Authoritative physical view identity/orientation (Layer C) AND required structural pose quality (Layer B) are both proven under a recognized physical evaluator (`authorized: true`).
  - `partial`: Declared view identity (Layer A) and structural pose sanity (Layer B) are established, but authoritative physical orientation certification (Layer C) is missing (`authorized: false`).
  - `unvalidated`: Evidence exists but is insufficient for structural qualification (`authorized: false`).
  - `invalid`: Evidence contradicts expected view or structural pose (`authorized: false`).
  - `unavailable`: Required source evidence absent (`authorized: false`).
- **Exact Real Archive Behavior (`output.zip`)**:
  - **Front View**: `status: 'partial'`, `authorized: false`, `declaredViewConsistent: true`, `structuralPoseValidated: true`, `physicalOrientationAuthorized: false` (8 checks: 7 passed, 0 failed, 1 skipped).
  - **Side View**: `status: 'partial'`, `authorized: false`, `declaredViewConsistent: true`, `structuralPoseValidated: true`, `physicalOrientationAuthorized: false` (8 checks: 6 passed, 0 failed, 2 skipped).
  - **Semantics**: `partial` is the expected, successful result on the real package. It confirms structural sanity while correctly preserving that authoritative physical orientation is uncertified.
- **A-Pose Semantics**: Upstream `body/Apose/result.json` proves only that the pipeline ran its generative A-pose staging step (Gemini 3 Pro Image Preview) and generated visual representations at declared height $169\text{ cm}$. It does **not** prove exact zero yaw, true profile orthogonality, orthographic projection, or physical anatomical neutrality.
- **Align Semantics**: `body/Align/result.json` proves 2D metric scale ($10\text{ px/cm}$), standardized $2000 \times 2000$ canvas, isotropic scaling, and crop/positioning provenance. It does **not** prove physical camera orientation.
- **Landmark Semantics**: 2D landmarks safely support structural pose sanity (monotonic vertical ordering, A-pose arm separation, absence of collapse). They do **not** prove physical yaw, lateral orientation, canonical 3D rotation, or perspective fidelity. Bilateral landmark compression is not used as physical Side-view proof.
- **Provenance Protection**:
  - Implemented evaluator: `body-pipeline-structural-pose-evaluator-v0` (authorizes Layer A + B only; produces `status: 'partial'`, `authorized: false`).
  - Arbitrary caller objects/booleans (e.g. `{ isFront: true }`, `{ status: 'validated' }`) are strictly rejected.
- **Integration with 4.5D**:
  - 4.5D accepts physical view/pose authorization only when 4.5E `status === 'validated'` AND `authorized === true`.
  - A `partial` result enriches diagnostics and confirms structural sanity, but does **not** remove the `view_pose_semantics_missing` blocker in 4.5D.
  - Therefore, real 4.5D physical blockers remain active: `['clothing_authorization_missing', 'view_pose_semantics_missing', 'authoritative_physical_evidence_missing']`.
- **Future Extensibility**: 4.5E is designed to cleanly accommodate future authoritative orientation sources (controlled capture protocols, calibrated camera extrinsics, validated 3D orientation estimators, visual orientation evaluators, human verification) without breaking contract boundaries.

### 4.5F Clothing / Body-Surface Authorization v0 — COMPLETED

Formalized the deterministic domain qualification layer governing clothing participation, observational garment qualification, and authoritative empirical body-surface authorization:

- **Core Contract**: `clothing-body-surface-semantics-v0` (`src/features/clothingBodySurfaceSemantics.js`).
- **Test Suite**: `src/features/clothingBodySurfaceSemantics.test.js` (11 comprehensive unit and real archive tests).
- **Integrated Files**:
  - `src/features/physicalMeasurementEligibility.js`: Integrated check ID `clothing_non_interference` under Dimension D (`clothing_authorization` requirement), consuming the derived `clothingConstraintSatisfied` gate to keep or clear the `clothing_authorization_missing` blocker.
  - `src/features/bodyEvidence.js`: Exposed `getClothingBodySurfaceSemantics({ id })` and `getClothingBodySurfaceSemanticsReport()`, with automatic resolution wired into `getPhysicalMeasurementEligibility`.
- **Three Strictly Separated Semantic Layers**:
  1. **Layer A — Clothing Participation (Deterministic in v0)**:
     - Evaluates support-policy topology and segmentation class provenance (`usedClothingEvidence`, `clothingClassIdsUsed`, `actualClassIdsUsed`, `supportPolicyId`).
     - Production evaluator: `body-pipeline-clothing-participation-evaluator-v0`.
     - Answers strictly whether clothing participated, where, and which specific classes contributed.
  2. **Layer B — Garment Type / Fit Qualification (Future Evaluators Only)**:
     - Observational/visual qualification evaluating garment type, fit tight/loose classification, and suitability as a candidate for metrology validation.
     - Production implementation has **no visual garment evaluators implemented** (`IMPLEMENTED_VISUAL_GARMENT_EVALUATORS = []`).
     - Canonical `garmentFitStatus` taxonomy: `qualified`, `disqualified`, `ambiguous`, `unresolved`, `not_applicable`.
     - Clothing-present evidence resolves to `garmentFitStatus: 'unresolved'`, `garmentFitQualified: false`, `candidateForMetrologyValidation: false`.
     - Clothing-free evidence resolves to `garmentFitStatus: 'not_applicable'`, `garmentFitQualified: false`, `candidateForMetrologyValidation: false`.
     - Layer B qualification evaluates visual fit only and is **never documented or treated as physical body-surface authorization**.
  3. **Layer C — Body-Surface Authorization (Future Empirical Physical Evaluators Only)**:
     - Authoritative empirical validation gate certifying whether the observed contour equals the true physical body surface within declared uncertainty bounds.
     - Production implementation has **no body-surface evaluators implemented** (`IMPLEMENTED_BODY_SURFACE_EVALUATORS = []`).
     - Real evidence resolves to `bodySurfaceAuthorized: false`, `authorizationMode: 'none'`, `declaredUncertaintyCm: null`.
- **Derived Final Clothing Gate (`clothingConstraintSatisfied`)**:
  - `clothingConstraintSatisfied` is a derived composite gate, not a Layer A field.
  - **Rule**:
    - If `usedClothingEvidence === false`: `clothingConstraintSatisfied = true` (clothing does not block this specific measurement; garment fit is `not_applicable`; does **not** imply `bodySurfaceAuthorized` or physical eligibility by itself).
    - If `usedClothingEvidence === true`: `clothingConstraintSatisfied = true` **ONLY** when required Layer B garment qualification AND Layer C authoritative body-surface authorization are satisfied.
  - Consumed by 4.5D (`clothingAuthorizationResult.dimensions.clothingConstraintSatisfied`) to keep or clear the `clothing_authorization_missing` blocker.
- **Clothing-Free Semantics**:
  - Absence of clothing does **NOT** mean physical body-surface truth.
  - Clothing-free observation resolves to: `clothingParticipationValidated: true`, `clothingConstraintSatisfied: true`, `garmentFitStatus: 'not_applicable'`, `garmentFitQualified: false`, `candidateForMetrologyValidation: false`, `bodySurfaceAuthorized: false` (unless an authoritative empirical evaluator exists), and overall 4.5F status may remain `partial` / unauthorized. Other physical blockers remain independent.
- **Clothing-Present Semantics (Real Archive `output.zip`)**:
  - **Front Shoulder** ($Y=132.85\text{ cm}$): Class 23 (`Upper_Clothing`), `status: 'partial'`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false`.
  - **Side Shoulder** ($Y=132.85\text{ cm}$): Class 23 (`Upper_Clothing`), `status: 'partial'`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false`.
  - **Front Hip** ($Y=86.25\text{ cm}$): Class 13 (`Lower_Clothing`), `status: 'partial'`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false`.
  - **Side Hip** ($Y=86.25\text{ cm}$): Class 13 (`Lower_Clothing`), `status: 'partial'`, `garmentFitStatus: 'unresolved'`, `clothingConstraintSatisfied: false`.
- **Real Metric Projected Measurements (Unchanged)**:
  - Front Shoulder: **$30.80\text{ cm}$**
  - Side Shoulder: **$11.00\text{ cm}$**
  - Front Hip: **$42.20\text{ cm}$**
  - Side Hip: **$27.70\text{ cm}$**
  - None of these values are promoted to physical measurements.
- **Active 4.5D Physical Blockers**:
  - All 3 physical blockers remain active on the real archive:
    1. `clothing_authorization_missing`
    2. `view_pose_semantics_missing`
    3. `authoritative_physical_evidence_missing`
- **Evaluator Provenance Protection**:
  - Arbitrary caller booleans (`{ isTight: true }`, `{ status: 'authorized' }`) and unregistered evaluator IDs are strictly rejected (`evaluator_provenance: 'fail'`).
  - User-entered garment declarations are non-authoritative.
  - Registries: `IMPLEMENTED_PARTICIPATION_EVALUATORS = ['body-pipeline-clothing-participation-evaluator-v0']`, `IMPLEMENTED_VISUAL_GARMENT_EVALUATORS = []`, `IMPLEMENTED_BODY_SURFACE_EVALUATORS = []`. Test-only registries exist strictly for controlled unit test fixtures.
  - A future visual VLM/classifier result may qualify Layer B only; it must never directly authorize Layer C physical body truth.
- **Measurement-Specific Scope**: Qualification is strictly evaluated per measurement, view, anatomical region, and support-policy provenance (e.g. upper-body garment qualification cannot authorize hip measurements).
- **Separation from Measurement Support Policy**: `measurementSupportPolicy.js` answers which segmentation classes constitute the supported silhouette; `clothingBodySurfaceSemantics.js` interprets what that clothing participation means for downstream qualification.
- **Strict Guardrails**: No VLM implementation, no user garment declaration path, no garment thickness or offset inference, no empirical tolerance invention, no Side $U \to Z$, no Front/Side geometry fusion, no pointmap $Z$ promotion, and no circumference or cross-section calculations.

### 4.5G Authoritative Physical Evidence Semantics v0 — COMPLETED at evidence-authority / semantics scope

Formalized the deterministic domain contract that classifies dense pointmap evidence by authority **without creating new body measurements**.

**This does not mean authoritative physical body geometry has been established.**

- **Status**: `COMPLETED` at evidence-authority / semantics scope only.
- **Successful semantic outcome** (current Sapiens Front/Side evidence):

```text
Projected Metric Evidence:
AVAILABLE

Sapiens Camera-Frame Geometric Evidence:
AVAILABLE

Authoritative Physical Body Geometry:
NOT ESTABLISHED

Cross-view Physical Geometry:
BLOCKED

4.6 Circumference / Cross-section:
BLOCKED
```

- **Core Contract**: `authoritative-physical-evidence-semantics-v0` (`src/features/authoritativePhysicalEvidenceSemantics.js`).
- **Test Suite**: `src/features/authoritativePhysicalEvidenceSemantics.test.js`.
- **Purpose**: Classify dense pointmap evidence by authority. 4.5G does **not** invent measurements, circumferences, cross-sections, volumes, or 3D reconstructions.
- **Current implemented evaluator**: `sapiens-pointmap-camera-frame-evaluator-v0`.
- **Current registries**:

```text
IMPLEMENTED_DENSE_GEOMETRY_SEMANTICS_EVALUATORS = [
  'sapiens-pointmap-camera-frame-evaluator-v0'
]

IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS = []
```

- **Reserved / not enabled**: `validated-dense-geometry-v0` remains reserved and is **not** enabled in either registry. Additional reserved future identifiers (`controlled-capture-physical-geometry-v0`, `calibrated-camera-physical-geometry-v0`, `empirical-body-capture-physical-geometry-v0`) are similarly unused.
- **Runtime Integration**: `src/features/bodyEvidence.js` (`getAuthoritativePhysicalEvidenceSemantics({ view })`, `getAuthoritativePhysicalEvidenceSemanticsReport()`). 4.5D auto-supplies the 4.5G result into Dimension E when the caller does not pass evidence.

#### Current Sapiens Front / Side pointmap semantics

Recognized Sapiens Front and Side pointmaps evaluate independently to:

```text
availability: present
status: partial
evidenceClass: camera_frame_geometric
authorized: false
```

- **Frame** (per view, not shared):

```text
type: camera_local
sharedAcrossViews: false
```

- **Axes** (Sapiens camera-local convention only):

```text
X = image_right
Y = image_down
Z = model_depth_channel
```

- Each Front/Side view remains independent. There is:
  - no shared camera frame
  - no Front$\leftrightarrow$Side transform
  - no runtime camera extrinsics
  - no validated canonical compatibility
- **Canonical compatibility** remains:

```text
revacityXYZ = false
revacityZ = false
sideUToCanonicalZ = false
frontSideFusion = false
```

#### Units semantics

The Sapiens API reports `units: "meters"`, but this remains **service-reported / physically unverified**. It is **not** authoritative physical meter geometry.

```text
unitAuthority: service_reported
physicalUnitsVerified: false
```

`"meters"` must not be treated as verified physical-unit authority.

#### Sapiens scale semantics

The pointmap `scale` is preserved as provenance only. Current meaning:

```text
predicted_focal_normalization
```

It is **not**:
- TWENTY EIGHT pixels-per-cm
- body-height calibration
- physical body scale
- Front/Side shared calibration
- cross-view registration scale

Sapiens `scale` must not be used to promote measurements into physical authority.

#### Existing metric-projected measurements remain unchanged

The real-archive silhouette observations remain **Metric Projected Measurements**, not authoritative physical body measurements:

```text
Front Shoulder: 30.80 cm
Side Shoulder: 11.00 cm
Front Hip: 42.20 cm
Side Hip: 27.70 cm
```

4.5G references projected metric availability; it does not rewrite those values and does not merge:

- landmark-to-landmark projected spans
- Front Transverse Width (`front-transverse-width-v0`)
- Side Profile Span (`side-profile-span-v0`)

**Explicit metrological distinction**:

$$\text{metric projected measurement} \ne \text{authoritative physical body measurement}$$

#### Physical Measurement Eligibility integration (Dimension E)

4.5G now feeds Dimension E of `physical-measurement-eligibility-v0`. 4.5C (`physical-measurement-semantics-v0`) uses the same acceptance guard.

A 4.5G result is accepted as authoritative physical evidence only if:

```text
contract === 'authoritative-physical-evidence-semantics-v0'
status === 'validated'
authorized === true
physicalAuthority.status === 'authoritative'
evaluatorId is registered as an implemented authoritative physical geometry evaluator
```

The current authoritative evaluator registry is empty. Therefore current Sapiens evidence continues to produce:

```text
authoritative_physical_evidence_missing
physicalEligibility: false
physicalMeasurementCm: null
```

The anti-forgery / registry guard is architectural: a forged `{ status: 'validated', authorized: true }` object whose `evaluatorId` is not in `IMPLEMENTED_AUTHORITATIVE_PHYSICAL_GEOMETRY_EVALUATORS` is rejected.

#### Body-surface authorization

Serialized Sapiens pointmaps are not body-masked.

```text
pointmap value exists
≠
authorized body-surface evidence
```

4.5G does **not** bypass:
- segmentation support
- anatomical-region authorization
- Dense Evidence QA
- Clothing / Body-Surface Authorization (`clothing-body-surface-semantics-v0`)

Layer C (authoritative empirical body-surface authorization) remains unimplemented (`IMPLEMENTED_BODY_SURFACE_EVALUATORS = []`). No new per-pixel body-surface authorization engine was introduced.

#### Dense Evidence QA relationship

4.5G consumes / references existing Dense Evidence QA. It does **not** duplicate:
- Pointmap Numeric QA (`pointmap-numeric-qa-v0`)
- Normal Numeric QA (`normal-numeric-qa-v0`)
- Same-View Dense Cross-Modal QA (`same-view-dense-cross-modal-qa-v0`)

Present-but-invalid or uninspectable dense evidence cannot become authoritative (`availability: present`, `status: invalid`, `physicalAuthority.status: not_authoritative`).

Missing pointmap is represented as:

```text
availability: missing
status: unavailable
physicalAuthority.status: unavailable
```

This remains distinct from present-but-not-authoritative evidence:

```text
present but not_authoritative
```

#### Independence of Physical Blockers (4.5D Multi-Gate Architecture)

The three 4.5D physical blockers remain strictly independent:
1. `clothing_authorization_missing`
2. `view_pose_semantics_missing`
3. `authoritative_physical_evidence_missing`

Resolving clothing authorization does not resolve physical evidence or pose semantics. Camera-frame geometric classification does not resolve clothing authorization, pose semantics, or authoritative physical geometry.

#### Hard Guardrails

- no Side $U \to Z$
- no pointmap $Z \to$ TWENTY EIGHT canonical $Z$
- no Front/Side pointmap fusion
- no physical depth promotion
- no circumference
- no ellipse inference
- no cross-section
- no body volume
- no 3D reconstruction
- no physical authority from `"meters"`
- no physical authority from Sapiens `scale`

### Measurement Placement Audit Checkpoint — COMPLETED

A strict read-only audit of measurement placement and semantics verified current runtime behavior before 4.5H:

- **Audit Completed & Verified**: All measurement placement and interpretation logic across Front/Side raster slicing, support policies, transverse width, and profile span verified with 402 passing unit tests. Zero runtime algorithmic changes made.
- **Shoulder Semantics Verified**:
  - Effective policy: `trunk_core_support_v0` (`anatomicalClassIds: [22]`, `clothingBridgeClassIds: [23]`, `acceptedClassIds: [22, 23]`).
  - `torso_width_at_shoulder_level` means **supported transverse silhouette width at shoulder landmark level** ($Y = (Y_{\text{left}} + Y_{\text{right}})/2$).
  - It is **NOT** landmark-to-landmark shoulder breadth, **NOT** biacromial breadth, and **NOT** full arm-to-arm body span. The `shoulder` anatomical level serves as the vertical measurement anchor level, distinct from skeletal shoulder breadth lines.
- **Hip Semantics Verified**:
  - Effective policy: `pelvic_core_support_v0` (`anatomicalClassIds: [12, 21, 22]`, `clothingBridgeClassIds: [13]`, `acceptedClassIds: [12, 13, 21, 22]`).
  - Current Hip measurement plane is strictly the **bilateral mean hip-landmark Y** ($Y = (Y_{\text{left}} + Y_{\text{right}})/2$).
  - There is currently **no search** for maximum hip breadth, widest pelvic row, maximum buttock projection, or maximum seat/circumference level. The `hip` anatomical level serves as an anchor level, not a qualified maximum-hip or seat plane.
- **Side Terminology**:
  - Authoritative term remains **Side Profile Span** (projected Side-U profile span).
  - It is **NOT** promoted to physical depth, AP depth, canonical Z, or body thickness at this stage (deferred to Milestone 4.5H).
### 4.5H Side Physical Depth Qualification v0 (`side-physical-depth-qualification-v0`) — COMPLETED

Pure deterministic domain qualification layer evaluating when a valid `side-profile-span-v0` observation may be interpreted as a **qualified side-derived physical anterior–posterior (AP) depth estimate**:

- **Core Contracts**:
  - `side-t-pose-qualification-v0` (`src/features/sidePoseQualification.js`): Evaluates Side-view arm horizontal reach, shoulder-elbow-wrist alignment, 2D projected elbow collinearity deviation, and bilateral symmetry with centralized engineering thresholds (`SIDE_T_POSE_THRESHOLDS`). Does NOT require Front T-pose (Front is intentionally A-pose).
  - `side-view-orientation-qualification-v0` (`src/features/sideViewOrientationQualification.js`): Evaluates bilateral landmark projection collapse across stable body pairs (`shoulders`, `hips`, `knees`, `ankles`). Wrists and elbows are strictly excluded due to Front A-pose / Side T-pose asymmetry. Evaluates to `approximately_lateral` without claiming exact 90° camera yaw or extrinsics.
  - `side-physical-depth-qualification-v0` (`src/features/sidePhysicalDepthQualification.js`): Integrates source Side profile span validity, metric calibration provenance, Side T-pose stance, approximately-lateral orientation, and fitted-clothing/body-surface authorization.
- **Side T-Pose & Elbow Deviation Semantics**:
  - **2D Projected Geometry**: The `shoulder → elbow → wrist` angle is a **2D projected landmark collinearity deviation**, NOT authoritative anatomical elbow flexion (single-view 2D pose keypoints cannot recover 3D anatomical joint rotations).
  - **Thresholds Preserved**: `MAX_ELBOW_BEND_DEGREES = 30.0` (straight arm boundary), `WARNING_ELBOW_BEND_DEGREES = 45.0` (severe bend boundary).
  - **Advisory Warning Range ($30^\circ - 45^\circ$)**: A projected elbow deviation in the $30^\circ - 45^\circ$ range is treated as an **advisory diagnostic signal** when horizontal arm reach ($\text{extensionRatio} \ge 0.70$), arm elevation ($\le 20^\circ$ or non-lowered), and torso clearance are maintained. It does **not** independently block Side physical depth qualification.
  - **Conservative Disqualifiers**: Severe projected elbow deviation ($> 45^\circ$), poor reach ($< 0.70$), lowered arm ($> 35^\circ$), or missing required landmarks continue to disqualify the stance.
  - **Semantic Decoupling**: Side T-Pose stance diagnostics may retain `status: 'warning'` while Side Physical Depth evaluates to `status: 'qualified'`. (Verified behavior on real capture: left projected elbow deviation $\approx 44.2^\circ \to$ pose diagnostic warning retained, Side AP depth qualified).
- **Runtime Getters (`src/features/bodyEvidence.js`)**:
  - `getSidePoseQualification({ sidePoseSource })`
  - `getSideViewOrientationQualification({ frontPoseSource, sidePoseSource, annotations })`
  - `getSidePhysicalDepthQualification({ id, annotations, ... })`
  - `getSidePhysicalDepthQualifications({ annotations, ... })`
- **Acquisition Protocol Assumptions**:
  - Front view = A-pose, Side view = T-pose.
  - Clothing = bikini / lingerie / tight body-following activewear under `trunk_core_support_v0` and `pelvic_core_support_v0`.
  - Side view = approximately lateral.
- **Qualified Depth Semantics**:
  - **Shoulder**: Qualified side-derived AP depth estimate at bilateral mean shoulder landmark level. NOT canonical Z, NOT biacromial breadth, NOT full arm span.
  - **Hip**: Qualified side-derived AP depth estimate at bilateral mean hip landmark level. NOT maximum buttock depth, NOT maximum seat depth, NOT widest pelvic row.
- **Value Assignment Rule**:
  - When `status === 'qualified'`: `qualifiedDepthEstimateCm = sourceSideProfileSpan.valueCm`.
  - When `status !== 'qualified'` (`warning`, `disqualified`, `unavailable`): `qualifiedDepthEstimateCm = null`.
- **Downstream Limitation (Cross-Section Compatibility)**:
  - 4.5H qualifies the Side AP depth estimate itself. It does **NOT** claim that Front transverse width and Side AP depth form a certified common physical cross-section (Front A-pose / Side T-pose mismatch deferred to the future Cross-Section Evidence milestone).
- **Strict Guardrails**:
  - No Side $U \to Z$ conversion.
  - No Sapiens pointmap Z dependency.
  - No Front/Side 3D fusion.
  - No claim of ground-truth validated depth or 3D anatomical joint angles.
  - No circumference estimation.
- **Completed Milestone**: **Cross-Section Evidence v0** (Milestone 4.5I).
- **Next Milestone**: **Circumference Estimation v0 Design & Audit Stage** (Milestone 4.6).

### 4.5I Cross-Section Evidence v0 (`cross-section-evidence-v0`) — COMPLETED

Pure deterministic compositional evidence layer combining already-qualified Front transverse width and Side AP physical depth observations at matching validated anatomical reference levels into a unified paired physical observation contract:

- **Core Contract (`src/features/crossSectionEvidence.js`)**:
  - `cross-section-evidence-v0`: Composes existing upstream evidence contracts without recalculating raster slices or re-estimating scalar values.
  - Consumes:
    - `front-transverse-width-v0` (`src/features/frontTransverseWidth.js`)
    - `side-physical-depth-qualification-v0` (`src/features/sidePhysicalDepthQualification.js`)
    - `cross-view-measurement-correspondence-v0` (`src/features/crossViewMeasurementCorrespondence.js`)
    - `cross-view-comparability-qa-v0` (`src/features/crossViewComparabilityQa.js`)
    - `metric-calibration-provenance-v0` (`src/features/metricCalibrationProvenance.js`)
- **Supported Anatomical Levels**:
  - Strictly limited to currently validated and shared physical measurement levels: **Shoulder** and **Hip**.
  - Chest, waist, abdomen, and other levels are not supported.
- **Verified Runtime Results**:
  - **Shoulder Level**:
    - Front Transverse Width = $30.80\text{ cm}$ (`valid`, Trunk core support policy `[22, 23]`)
    - Side AP Depth = $11.00\text{ cm}$ (`qualified`, physical AP depth estimate)
    - Correspondence = `ready` ($Y = 132.85\text{ cm}$, $\Delta Y = 0.0\text{ cm}$)
    - Comparability QA = `pass` (10/10 checks)
    - Cross-Section Evidence = **`QUALIFIED`** (`isQualified: true`)
  - **Hip Level**:
    - Front Transverse Width = $42.20\text{ cm}$ (`valid`, Pelvic core support policy `[12, 13, 21, 22]`)
    - Side AP Depth = $27.70\text{ cm}$ (`qualified`, physical AP depth estimate)
    - Correspondence = `ready` ($Y = 86.25\text{ cm}$, $\Delta Y = 0.0\text{ cm}$)
    - Comparability QA = `pass` (10/10 checks)
    - Cross-Section Evidence = **`QUALIFIED`** (`isQualified: true`)
- **Preserved Side T-Pose Semantics**:
  - 2D projected elbow deviation remains an advisory diagnostic signal in the $30^\circ - 45^\circ$ range.
  - A moderate advisory note (e.g. left projected elbow deviation $\approx 44.2^\circ$) does **not** block Cross-Section Evidence when downstream Side Physical Depth is `qualified`. The evaluator trusts authoritative downstream qualification and forwards advisory notes into `warnings`.
- **Runtime Getters (`src/features/bodyEvidence.js`)**:
  - `getCrossSectionEvidence({ id, annotations, ... })`
  - `getCrossSectionEvidenceReport({ annotations, ... })`
- **Minimal UI Integration (`src/ui/derivedMeasurementDeck.js`)**:
  - Read-only Shoulder and Hip cards display `Front Transverse Width`, `Side Profile Span`, `Side AP Depth`, and `Cross-Section Evidence` status (`QUALIFIED`, `BLOCKED`, `UNAVAILABLE`).
- **Semantic Definition & Strict Boundaries**:
  - Cross-Section Evidence v0 represents **paired orthogonal physical observations at a matching anatomical level**.
  - It does **NOT** represent:
    - a reconstructed 3D cross-section or slice
    - a closed contour or polygon
    - an ellipse or semi-axis model ($a = w/2, b = d/2$)
    - circumference or perimeter
    - body volume
    - canonical Z geometry
    - Front/Side pointmap fusion

### 4.5J Measurement Taxonomy & Capability Audit v0 (`measurement-taxonomy-audit-v0`) — COMPLETED

Formalized a comprehensive measurement taxonomy and capability audit establishing formal geometric families, qualification criteria, and unambiguous semantic naming rules:

- **11 Formal Geometry Families**:
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

- **Critical Semantic Naming Rule**:
  Every measurement name must unambiguously distinguish:
  1. **Anatomical region** (e.g. `Torso`, `Arm`, `Leg`)
  2. **Measurement quantity** (e.g. `Transverse Width`, `AP Depth Estimate`, `Inter-Level Distance`, `Segment Length`)
  3. **Anatomical reference level** (e.g. `at Shoulder Level`, `at Hip Level`, `Neck to Hip`)
  - *Example*: `Torso Transverse Width at Shoulder Level` must remain strictly distinct from skeletal `Biacromial Shoulder Breadth` and from any future `Shoulder Circumference`.

### 4.5K Measurement Source-Verification & Correction Pass — COMPLETED

Performed an empirical source-verification audit correcting legacy assumptions and establishing explicit metrological boundaries:

- **Landmark Measurement Lines (`bodyMeasurementLines.js`)**:
  - Confirmed as display/evidence geometry only.
  - Existing candidate lines are **NOT** authoritative measurement contracts and must not be described as already-supported named physical measurements.
- **Stature Semantics**:
  - Declared subject stature ($169.0\text{ cm}$ in the current capture) is `known_subject_height` supplied as metric calibration input provenance.
  - It is **NOT** an independently measured optical stature output.
- **Ground / Floor Reference**:
  - Canvas bottom edge ($Y = 0\text{ cm}$) represents standardized metrology workspace coordinate boundary, **NOT** a verified subject floor/contact plane.
  - Absolute anatomical heights from floor remain explicitly deferred under status `NEEDS_GROUND_REFERENCE`.
- **Relative Vertical Distance Validity**:
  - Differences between two validated anatomical levels ($|Y_A - Y_B|$) are mathematically valid calibrated relative distances because global canvas placement offsets cancel out.
- **Anatomical Level Scope**:
  - Exactly 7 reference levels are validated: `neck`, `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`.
  - Torso sub-levels (`bust`, `underbust`, `chest`, `waist`, `abdomen`, `crotch`, `buttock maximum / seat plane`) remain strictly **deferred** (no landmark anchors; no synthetic proportional-height heuristics).
- **Authoritative Width / Depth / Cross-Section Evidence**:
  - Front Transverse Width is supported at Shoulder Level (`Torso Transverse Width at Shoulder Level`) and Hip Level (`Torso Transverse Width at Hip Level`). Generic "Shoulder Width" / "Hip Width" labels are prohibited.
  - Side AP Depth is supported/qualified at Shoulder Level (`Torso AP Depth Estimate at Shoulder Level`) and Hip Level (`Torso AP Depth Estimate at Hip Level`).
  - Cross-Section Evidence v0 (`cross-section-evidence-v0`) pairs qualified Front transverse width and Side AP depth at matching reference levels.
  - Cross-Section Evidence is **NOT** a reconstructed 3D slice, ellipse, circumference, volume, or canonical Z geometry. Shoulder cross-section must not be called Shoulder Circumference; Hip cross-section must not be equated with maximum Hip/Seat Circumference (current bilateral hip landmark level is not yet qualified as the maximum buttock/seat plane).

### 4.5L Clear Measurements v0 — Batch A (`direct-body-measurements-v0`) — COMPLETED

Formalized and implemented 19 pure, deterministic, calibrated Front direct body measurements derived from validated anatomical reference levels and promoted Front body landmarks:

- **Core Contract**: `direct-body-measurements-v0` (`src/features/directBodyMeasurements.js`).
- **Runtime Integration**: `src/features/bodyEvidence.js` (`getDirectBodyMeasurements()`, `getDirectBodyMeasurement(id)`).
- **Results UI Integration**: `src/ui/derivedMeasurementDeck.js` (collapsible Direct Measurements section in Right Sidebar Results).
- **19 Implemented Batch A Measurements**:
  1. **Vertical Inter-Level Measurements (5)** (Output semantics: `calibrated_relative_vertical_distance`, Formula: $|Y_A - Y_B|$):
     - `vertical_torso_length_neck_to_hip`: Vertical Torso Length (Neck to Hip)
     - `vertical_shoulder_drop_neck_to_shoulder`: Vertical Shoulder Drop (Neck to Shoulder)
     - `vertical_thigh_length_hip_to_knee`: Vertical Thigh Length (Hip to Knee)
     - `vertical_lower_leg_length_knee_to_ankle`: Vertical Lower Leg Length (Knee to Ankle)
     - `vertical_total_leg_length_hip_to_ankle`: Vertical Total Leg Length (Hip to Ankle)
  2. **Projected Landmark Segment Measurements (10, Left/Right independently)** (Output semantics: `calibrated_projected_2d_distance`, Formula: $\sqrt{(X_A - X_B)^2 + (Y_A - Y_B)^2}$):
     - `left_upper_arm_segment_length_projected` / `right_upper_arm_segment_length_projected`: Upper Arm Segment Length (Projected)
     - `left_forearm_segment_length_projected` / `right_forearm_segment_length_projected`: Forearm Segment Length (Projected)
     - `left_direct_arm_chord_projected` / `right_direct_arm_chord_projected`: Direct Arm Chord (Shoulder to Wrist, Projected)
     - `left_thigh_segment_length_projected` / `right_thigh_segment_length_projected`: Thigh Segment Length (Projected)
     - `left_lower_leg_segment_length_projected` / `right_lower_leg_segment_length_projected`: Lower Leg Segment Length (Projected)
  3. **Kinematic Chain Measurements (4, Left/Right)** (Output semantics: `calibrated_projected_2d_chain_length`, Formula: $\sum d_{2D}$ of constituent segments):
     - `left_total_arm_chain_length_projected` / `right_total_arm_chain_length_projected`: Total Arm Kinematic Chain Length (Projected) ($d(\text{Shoulder}, \text{Elbow}) + d(\text{Elbow}, \text{Wrist})$)
     - `left_total_leg_chain_length_projected` / `right_total_leg_chain_length_projected`: Total Leg Kinematic Chain Length (Projected) ($d(\text{Hip}, \text{Knee}) + d(\text{Knee}, \text{Ankle})$)

- **Qualification & Status Semantics**:
  - `valid`: All required evidence exists, is finite, and Front metric calibration is validated.
  - `unavailable`: Required evidence is missing or insufficient (e.g. missing landmark, unready anatomical level, unvalidated calibration).
  - `invalid`: Evidence exists but contains corrupted or non-finite coordinate values.
  - **Kinematic Chain Rule**: A kinematic chain strictly requires **all** constituent segments to evaluate to `valid`. If any constituent segment is `unavailable` or `invalid`, the chain measurement cannot be valid.
- **Strict Guardrails**:
  - Front A-pose calibrated projected 2D distances only.
  - Must **NOT** be described as true 3D anatomical lengths, skeletal bone lengths, or 3D surface distances.
  - Zero bilateral averaging is performed (left and right limbs evaluated independently).

### 4.5M Results Right-Sidebar Usability & Accordion Cleanup — COMPLETED

Streamlined the right-sidebar user interface into a clean, collapsible hierarchy:

- **Results (`#derived-measurement-deck`)**:
  - Top-level collapsible accordion.
  - **Cross-Section Evidence**: Collapsible subgroup containing Shoulder and Hip paired measurement cards.
  - **Direct Measurements**: Collapsible parent subgroup containing three collapsible category groups:
    - *Vertical Measurements* (5 inter-level metrics)
    - *Arm Segments* (6 segment/chord metrics + 2 kinematic chains)
    - *Leg Segments* (4 segment metrics + 2 kinematic chains)
- **Session Records (`#session-records-panel`)**:
  - Ordered hierarchy:
    1. **Annotations** (with per-item actions and landmark displays)
    2. **History** (canonical measurement log with embedded `Clear History` action)
- **Diagnostics (`#diagnostics-panel`)**:
  - Maintained as an independent collapsible drawer separated from primary measurement results.

### 4.6 Circumference / Cross-Section Inference — COMPLETED (at Modeled Hip/Seat Scope)

#### 4.6A Modeled Cross-Section Perimeter v0 (`modeled-cross-section-perimeter-v0`) — COMPLETED (Internal QA / Programmatic Access)

Pure deterministic domain contract (`src/features/modeledCrossSectionPerimeter.js`) deriving an ellipse-modeled cross-sectional perimeter estimate from qualified upstream `cross-section-evidence-v0` evidence at the Hip Landmark Level.

Key achievements:
- **Contract & Registry**:
  - Contract: `modeled-cross-section-perimeter-v0`
  - Supported definition: `torso_modeled_perimeter_at_hip_landmark_level`
  - Display name: `Torso Modeled Perimeter Estimate at Hip Landmark Level`
  - Source Level: `hip`
  - Source Cross-Section Evidence: `torso_cross_section_evidence_at_hip_level`
- **Model Specification**:
  - Model family: `ellipse`
  - Model implementation: `ellipse_ramanujan_ii`
  - Formula:
    $$a = \frac{W}{2},\quad b = \frac{D}{2},\quad h = \frac{(a - b)^2}{(a + b)^2}$$
    $$P = \pi (a + b) \left(1 + \frac{3h}{10 + \sqrt{4 - 3h}}\right)$$
  - Purely computed from runtime inputs at full JS precision ($W = 42.20\text{ cm}, D = 27.70\text{ cm} \implies P \approx 110.98\text{ cm}$).
- **Status in Current Architecture**:
  - Retained internally for QA, regression verification, and programmatic access.
  - Hidden from the primary user-facing Results measurement deck in favor of the evidence-driven **Modeled Hip / Seat Circumference Estimate** at Maximum Seat Plane.

#### 4.6B Pelvic Arbitrary-Y Evidence Scan v0 (`pelvic-arbitrary-y-evidence-scan-v0`) — COMPLETED

Pure deterministic domain scanner (`src/features/pelvicArbitraryYEvidenceScan.js`) extracting continuous Front transverse width evidence across the pelvic anatomical region:
- Scans arbitrary $Y$ rows across the pelvic search domain ($Y \in [Y_{\text{crotch}}, Y_{\text{hip}}]$ or anatomical pelvic bounds) with configurable step resolution.
- Produces valid single-run transverse width observations across candidate scan levels without gap filling or heuristic run merging.

#### 4.6C Arbitrary-Y Side Physical AP Depth Qualification v0 (`arbitrary-y-side-physical-depth-qualification-v0`) — COMPLETED

Pure deterministic domain qualification layer (`src/features/arbitraryYSidePhysicalDepthQualification.js`) evaluating Side AP depth across arbitrary $Y$ scan levels:
- Qualifies Side profile spans at each pelvic scan row against Side T-pose stance, approximately-lateral orientation, and calibration requirements.
- Provides qualified AP depth scalars for each valid candidate plane in the pelvic region.

#### 4.6D Maximum Seat Plane Localization v0 (`maximum-seat-plane-localization-v0`) — COMPLETED

Pure deterministic evidence-driven localization layer (`src/features/maximumSeatPlaneLocalization.js`) identifying the anatomical Maximum Seat Plane:
- Evaluates paired same-Y Front transverse width + qualified Side AP depth across the pelvic scan domain.
- Computes candidate Ramanujan II modeled perimeter score at each level and ranks candidate planes to select the plane maximizing cross-sectional perimeter.
- **Evidence-Driven Plane**: Selected plane is localized from actual visual/segmentation evidence, **NOT** a fixed offset from Hip Landmark Y.
- **Sample Runtime Verification**:
  - Localized seat plane on current sample capture: $Y \approx 79.95\text{ cm}$ (compared to Hip landmark $Y = 86.25\text{ cm}$).
  - Runtime values: Front width $\approx 44.30\text{ cm}$, Side AP depth $\approx 27.40\text{ cm}$, Modeled Circumference $\approx 114.20\text{ cm}$.
  - These values are runtime evidence outputs, NOT hardcoded algorithm constants.

#### 4.6E Modeled Maximum Seat Circumference Estimate v0 (`modeled-hip-seat-circumference-v0`) — COMPLETED

Production circumference domain contract (`src/features/modeledHipSeatCircumference.js`):
- **Definition ID**: `torso_modeled_hip_seat_circumference_at_maximum_seat_plane` (preserved compatibility ID)
- **User-Facing Display Name**: `Modeled Maximum Seat Circumference` (finalized to distinguish from Modeled Hip Girth)
- **Location**: Localized Maximum Seat Plane ($Y = 79.95\text{ cm}$ on sample capture; distinct from Hip anatomical level at $\approx 86.25\text{ cm}$ and Buttock Point at $86.05\text{ cm}$)
- **Algorithm**: Ellipse model using Ramanujan II approximation from qualified Front width + Side AP depth.
- **Strict Metrological Semantics**:
  - Modeled estimate based on orthogonal Front and Side silhouette extents.
  - **NOT** a measured closed contour.
  - **NOT** tape-measured ground truth.
  - **NOT** a reconstructed 3D slice.

#### 4.6F Modeled Maximum Seat Perimeter Results UI Integration — COMPLETED

Integrated the Modeled Maximum Seat Circumference card into the Right Sidebar → Results measurement deck:
- Primary title: `Modeled Maximum Seat Circumference`
- Meta badges: `Modeled` status badge
- Detail rows: Circumference Estimate, Seat Plane Y, Front Width, Side AP Depth, Model (`Ellipse (Ramanujan II)`)
- Qualification notes: `Evaluated at deterministic Maximum Seat Plane.` / `Modeled estimate; not tape-measured ground truth.`
- Old Hip Landmark perimeter card is hidden from normal Results.

### 4.7 Measurement Visualization Provenance v0 & 2D Highlight Overlays — COMPLETED

Formalized the declarative visualization provenance layer and interactive 2D highlight overlay pipeline:
- **Contract**: `measurement-visualization-provenance-v0` (`src/features/measurementVisualizationProvenance.js`)
- **Supported Visualization Types**:
  - `front_horizontal_slice`: Front-view transverse line + 2 anchor dots (numeric text badges removed in UI cleanup).
  - `side_horizontal_slice`: Side-view profile line + 2 anchor dots (numeric text badges removed in UI cleanup).
  - `cross_view_horizontal_slice`: Synchronized same-Y horizontal line across Front and Side navigators + endpoint dots.
  - `natural_waist_plane`: Full-width horizontal reference guide at Waist Y + Front and Side slice spans + endpoint dots.
  - `abdominal_apex_plane`: Full-width horizontal reference guide at Apex Y + Front and Side slice spans + endpoint dots.
  - `landmark_segment`: Projected 2D chord line between two landmark endpoints.
  - `landmark_chain`: Connected polyline chain through sequential anatomical landmark waypoints.
  - `vertical_level_interval`: Exact upper and lower horizontal anatomical Y level lines + vertical connector line + offset badge.
  - `front_horizontal_level`: Full-width horizontal reference level guide with landmark anchor dots.
- **Renderer (`src/ui/measurementHighlightOverlay2d.js`)**:
  - Pure declarative UI layer consuming normalized visualization instructions without recomputing domain math.
  - Non-destructive: renders on dedicated highlight layers (`#grid2d-measurement-highlight-layer`, `#side-evidence-measurement-highlight-layer`).
  - Displays clean geometry only (lines, guides, dots, selection state) with no always-visible measurement numbers on canvas. Authoritative values are presented in the Results sidebar.
- **Interactive Results Click-to-Highlight Flow**:
  - Click on any Results card/row (`[data-measurement-id]`) $\to$ `selectMeasurement(id)` $\to$ `resolveMeasurementVisualizationProvenance` $\to$ `setMeasurementHighlight` $\to$ focuses 2D workspace (`WORKSPACE_SPLIT`) $\to$ updates DOM selection classes (`.is-selected`, `aria-selected="true"`).
  - Clicking an already-selected card toggles selection and highlight off.
  - Uploading a new package or clearing evidence automatically clears active selection and highlight.

### 4.8 Modeled Ellipse Cross-Section Preview — COMPLETED

Implemented visual-only mathematical cross-section preview panel (`src/ui/modeledEllipseCrossSectionPreview.js`):
- Displays companion cross-section preview when Modeled Hip / Seat Circumference is selected.
- Renders SVG ellipse using Front width and Side AP depth, preserving true width:depth aspect ratio.
- Canonical disclaimer: `Ellipse model — not measured contour`.
- **UI Metrological Distinction**:
  - Front 2D: Actual transverse width evidence.
  - Side 2D: Actual AP depth evidence.
  - Modeled Cross-Section Preview: Mathematical ellipse implied by those two scalar extents.
  - Does NOT recompute circumference, does NOT represent measured body contour, and does NOT imply 3D reconstruction or canonical Z.

### 4.9 Batch Landmark Promotion — COMPLETED

Implemented one-click batch promotion for Front Core landmarks (`src/features/bodyEvidence.js`, `src/ui/bodyEvidencePanel.js`):
- Action button: `Promote All Front Core Landmarks` in Left Sidebar → Body Evidence → Front tab.
- Operates strictly on `CORE_FRONT_BODY_ANCHORS` (13 landmarks).
- Promotes all eligible front landmarks, skips unavailable or already-promoted landmarks.
- Fully idempotent; leaves Side and Secondary landmarks untouched.

### 4.10 Torso Arbitrary-Y Evidence Scan v0 (`torso-arbitrary-y-evidence-scan-v0`) — COMPLETED

Pure deterministic domain scanner (`src/features/torsoArbitraryYEvidenceScan.js`) extracting continuous horizontal evidence across the torso anatomical column bounded by validated anatomical reference levels (`shoulder` and `hip`):
- **Search Domain**: Bounded strictly by anatomical anchors (`shoulderAnchorYcm` and `hipAnchorYcm`), scanning candidate planes from shoulder down to hip.
- **Resolution-Independent Mapping**:
  - Front and Side scans share the exact same continuous canonical metric $Y$ (`yCm`).
  - Raster-row sampling is computed independently for Front and Side using their respective canvas heights and pixel-to-metrology formulas.
  - Side physical-depth qualification evaluates the actual sampled Side row rather than assuming equal row indices.
  - **Core Invariant**: *Same canonical physical Y does not imply equal Front and Side pixel-row indices.*
- **Slice Evidence**:
  - Front: Single-run supported transverse width under `trunk_core_support_v0` policy (`[22, 23]`).
  - Side: Single-run profile span and qualified AP depth via `sampleSideHorizontalRasterSlice()` and `evaluateSidePhysicalDepthQualification()`.
  - Preserves encountered class IDs, run counts, and metric bounds without gap-filling or heuristic run-merging.

### 4.11 Natural Waist Plane Localization v0 (`natural-waist-plane-localization-v0`) — COMPLETED

Pure deterministic domain localization layer (`src/features/naturalWaistPlaneLocalization.js`) identifying the anatomical Natural Waist Plane from continuous torso evidence:
- **Evidence-Driven Localization**:
  - Localizes the Natural Waist plane strictly from body evidence (Front transverse narrowing + Side profile/AP narrowing corroboration), **NOT** from an invented body landmark or fixed anthropometric body-height proportion.
  - Natural Waist is modeled as a stable local torso constriction / broad waist trough, not simply the globally narrowest raster row.
- **Metric-Domain Symmetric Smoothing**:
  - Resolution-independent smoothing window: `smoothingWindowCm = 2.0 cm` (interpreted as a total symmetric window of approximately $\pm 1.0\text{ cm}$).
  - Radius in sample steps is derived dynamically from actual canonical-$Y$ sample spacing (`smoothingRadiusSamples = Math.max(1, Math.round((smoothingWindowCm / 2) / sampleSpacingCm))`).
  - Raw evidence is fully preserved in candidate records; smoothing only suppresses discrete raster-row quantization jitter and does NOT infer anatomy.
- **Bilateral Contour QA**:
  - Evaluates left and right contour indentations relative to outer trunk boundary envelope (`leftIndentationCm`, `rightIndentationCm`, `asymmetryDeltaCm`).
  - Classifies symmetry status (`symmetric`, `unilateral_left`, `unilateral_right`, `indeterminate`) with `asymmetryToleranceCm = 1.0 cm`.
- **Side Corroboration Semantics**:
  - Evaluates Side narrowing and qualification status at candidate constriction levels.
  - Front-only valid waist with unavailable Side evidence produces `status: 'ready'` with an advisory warning (`SIDE_CORROBORATION_UNAVAILABLE`), avoiding artificial blockers while preserving cross-view integrity.
- **Broad Trough Pooling Refinement**:
  - Solves raster quantization / local-extrema splitting where broad anatomical waist depressions produce multiple nearby minima.
  - Groups adjacent local minima into a single pooled trough region when:
    1. Vertically proximal: $\Delta Y \le \text{maxTroughMergeDistanceCm}$ (`6.0 cm`).
    2. Inter-valley saddle is shallow: $\text{SaddleRise} \le \text{maxInterValleySaddleRiseCm}$ (`0.6 cm`) **OR** $\frac{\text{SaddleRise}}{\text{Prominence}} \le \text{maxInterValleySaddleRiseRatio}$ (`0.35`).
    3. Profile remains within macro basin without reopening into surrounding wider anatomical sectors.
  - Preserves all member valleys, member Y values, candidate indices, and constriction metrics.
- **Deterministic Representative-Plane Selection**:
  - Within a pooled trough, the representative plane is selected via strict hierarchical tie-breaking:
    1. Deepest Front transverse narrowing (`smoothedWidthCm`).
    2. Lower qualified Side AP depth (`qualifiedApDepthCm` / `profileSpanCm`) if Front depths are tied within `tieBreakDepthToleranceCm` (`0.05 cm`).
    3. Higher bilateral contour symmetry (`asymmetryDeltaCm`) if Side evidence is also tied within `0.05 cm`.
    4. Flag `isTroughAmbiguous: true` without Y averaging if all evidence remains indistinguishable. **No Y averaging or centroid heuristic is performed.**
- **Real-Package Validation Sample (`output.zip`)**:
  - Status: `ready`
  - Localized Elevation: $Y = 107.15\text{ cm}$ (raster row `928`)
  - Front Transverse Width: $29.00\text{ cm}$
  - Qualified Side AP Depth: $23.20\text{ cm}$
  - Broad waist trough pooled across Valley 0 ($Y = 107.15\text{ cm}$) and Valley 1 ($Y = 110.75\text{ cm}$); Valley 0 selected deterministically.
  - Upper-torso shallow constriction at $Y = 124.25\text{ cm}$ remained isolated and non-competing.
  - *(Note: Sample package observations for validation; not universal hard-coded constants).*

### 4.12 Natural Waist 2D Provenance Visualization & UI Presentation — COMPLETED

Visual inspection and highlight integration for the localized Natural Waist plane:
- **Contract & Architecture**:
  - Extended `src/features/measurementVisualizationProvenance.js` with `VISUALIZATION_TYPES.NATURAL_WAIST_PLANE`.
  - Extended `src/ui/measurementHighlightOverlay2d.js` with `renderNaturalWaistPlane()`.
  - Reuses existing declarative overlay pipeline without raster re-scanning or domain recalculation in the renderer.
- **2D Overlay Elements**:
  - Full-width dashed horizontal reference guide at canonical $Y$ across both Front and Side 2D navigators.
  - Front transverse slice line with endpoint markers at $[minX_{cm}, maxX_{cm}]$.
  - Side AP depth slice line with endpoint markers at $[minU_{cm}, maxU_{cm}]$ when Side evidence is available and qualified.
  - Concise non-obstructive label badge `Natural Waist · <yCm> cm` anchored at safe $10\text{px}$ left inset from plot boundary, $14\text{px}$ above canonical $Y$ (`.grid2d-highlight-badge--left`). Silhouette narrowing and endpoint dots remain 100% unobstructed.
- **Diagnostics Inspection Surface**:
  - Mounted under **Diagnostics → Body / Anchor Diagnostics** as an interactive diagnostic card (`[data-localization-id="natural_waist_plane_localization"]`).
  - Displays localized elevation, Front span, Side span, status badge (`Localized`), and click-to-highlight / keyboard focus integration.
- **Strict Metrological Semantics**:
  - Natural Waist Plane is a **plane localization** candidate.
  - **NOT** Waist Circumference.
  - **NOT** a measured 3D contour.
  - **NOT** a 3D slice reconstruction.

### 4.13 Modeled Natural Waist Circumference v0 (`modeled-natural-waist-circumference-v0`) — COMPLETED

Pure deterministic domain contract (`src/features/modeledNaturalWaistCircumference.js`) and UI presentation deriving an ellipse-based modeled Natural Waist circumference estimate:
- **Definition & Modeling Semantics**:
  - A deterministic ellipse-based modeled Natural Waist circumference estimate evaluated at the already-localized Natural Waist plane using calibrated Front transverse width and qualified Side physical AP depth at the exact same canonical Y.
  - Explicitly modeled using the Ramanujan II ellipse perimeter formula ($a = \text{Front Width}/2$, $b = \text{Qualified Side AP Depth}/2$).
  - **NOT** tape-measured ground truth.
  - **NOT** a measured body contour.
  - **NOT** a reconstructed 3D circumference or dense-geometry perimeter.
  - **NOT** pointmap-derived.
  - The Front and Side diameters are evidence-derived physical scalars; the ellipse is explicitly a modeling assumption, not the actual body contour.
- **Evidence Consumption & Invariants**:
  - Consumes authoritative upstream `natural-waist-plane-localization-v0` output directly without independently rescanning rasters, relocalizing the waist, or averaging candidate Y values.
  - Requires finite positive Front transverse width with ordered endpoints ($minX_{cm} < maxX_{cm}$) and supported slice evidence.
  - Requires qualified Side physical AP depth ($sideQualifiedApDepthCm > 0$) with ordered endpoints ($minU_{cm} < maxU_{cm}$).
  - **Core Invariant**: *Front and Side share the exact same canonical physical Y, while their raster-row indices remain independent and view-local.*
- **Strict Front-Only Blocking Semantics**:
  - While Natural Waist plane localization may evaluate to `status: 'ready'` with advisory warnings when Side evidence is unavailable, **Modeled Natural Waist Circumference MUST NOT be produced from Front-only localization**.
  - If Side AP depth is unavailable or unqualified, circumference status evaluates to `unavailable` or `blocked` (`valueCm: null`), emitting an explicit blocker. Raw Side profile span is never substituted as physical depth.
- **Dedicated Embedded Cross-Section Evidence**:
  - Embeds `natural-waist-cross-section-evidence-v0` preserving `yCm`, Front width/endpoints, Side AP depth/endpoints, same-Y consistency, and qualification status.
  - Avoids polluting the static anatomical landmark registry in `crossSectionEvidence.js` (which is strictly reserved for static levels like Shoulder and Hip) while maintaining clean architectural isolation.
- **Runtime Integration & Zero Recomputation**:
  - Exported runtime getters in `src/features/bodyEvidence.js`: `getModeledNaturalWaistCircumference()` and `getModeledNaturalWaistCircumferenceReport()`.
  - Pure, lazy, and non-mutating evaluation consuming cached scan/localization data without triggering redundant raster scans or recomputation.
- **Results UI & Live Composition**:
  - Results → **Modeled Perimeter Estimates** subgroup renders both:
    1. **Modeled Natural Waist Circumference** (`torso_modeled_natural_waist_circumference_at_natural_waist_plane`)
    2. **Modeled Hip / Seat Circumference Estimate** (`torso_modeled_hip_seat_circumference_at_maximum_seat_plane`)
  - Displays formatted Circumference Estimate, Waist Plane Y, Front Width, Side AP Depth, Model (`Ellipse (Ramanujan II)`), and disclaimer (`"Modeled estimate; not tape-measured ground truth."`).
  - When evidence is analyzed without annotations, renders a clear `Unavailable` card with dashes rather than disappearing silently.
- **Click-to-Highlight & Ellipse Preview**:
  - Clicking the Natural Waist card activates `selectMeasurement('torso_modeled_natural_waist_circumference_at_natural_waist_plane')`, routing to `VISUALIZATION_TYPES.NATURAL_WAIST_PLANE` to display the exact 2D Front/Side reference guides and slice bounds.
  - Generalized `src/ui/modeledEllipseCrossSectionPreview.js` dynamically renders the Front $29.00\text{ cm} \times$ Side $23.20\text{ cm}$ cross-section labeled `Waist Plane Y: 107.15 cm` with disclaimer `"Ellipse model — not measured contour"`.
- **Real-Package Validation Sample (`output.zip`)**:
  - Natural Waist Plane Y: $107.15\text{ cm}$
  - Front Transverse Width: $29.00\text{ cm}$
  - Qualified Side AP Depth: $23.20\text{ cm}$
  - Modeled Natural Waist Circumference: $82.2488\text{ cm}$ (displayed in UI as $82.25\text{ cm}$)
  - Status: `modeled`
  - *(Note: Sample package observations for validation; not universal hard-coded constants).*

### 4.14 Abdominal Apex Plane Localization v0 & Modeled Abdominal Circumference v0 — SUPERSEDED / RETAINED AS LEGACY

Historical v0 contracts (`src/features/abdominalApexPlaneLocalization.js`, `src/features/modeledAbdominalCircumference.js`) establishing the baseline-relative abdominal prominence localization target:

- **Abdominal Apex Plane Localization v0 (`abdominal-apex-plane-localization-v0`) — HISTORICAL / LEGACY**:
  - Localized maximum anterior abdominal prominence relative to baseline torso profile within search domain ($86.25 \to 100.75\text{ cm}$).
  - Historical real-package localized result: $Y = 95.75\text{ cm}$ (Front width $37.20\text{ cm}$, Side qualified AP depth $26.30\text{ cm}$, Modeled Circumference $100.48\text{ cm}$).
  - **Status**: **SUPERSEDED IN PRODUCTION** by Abdominal Point Plane Localization v1 (`abdominal-point-plane-localization-v1`, Section 4.19). Retained intentionally for regression protection, backward compatibility, and explicit fallback behavior.

- **Abdominal-Pelvic Transition Support Policy (`trunk_pelvic_transition_support_v0`) — ACTIVE**:
  - Exact accepted classes: `[12, 13, 21, 22, 23]` (Left Upper Leg `12`, Lower Clothing `13`, Right Upper Leg `21`, Torso `22`, Upper Clothing `23`).
  - Restores continuous Waist $\to$ Hip transitional evidence without mutating `trunk_core_support_v0` or `pelvic_core_support_v0`.

### 4.15 Final UI Cleanup & Official Branding — COMPLETED

- **Official Product Branding**: Consolidated all user-facing branding to **TWENTY EIGHT**. Legacy compatibility identifiers (`revacityXYZ`, `revacityZ`, `isRevacityMetricScale`, legacy scene import app names) remain preserved solely for backward compatibility.
- **Results Card Header Cleanup**: Redundant header Y chips removed from all measurement and reference level cards. Detailed Y coordinates remain cleanly formatted inside modeled measurement provenance/results rows.
- **2D Cross-Section Overlay Number Cleanup**: Removed always-visible numeric text badges rendered over Front/Side cross-section slice lines. Overlays render clean geometric primitives only (horizontal reference guides, slice span lines, endpoint dots, selection highlights). Authoritative numeric values are displayed exclusively in the Results sidebar.

### 4.16 Bust Apex Plane Localization v0 (`bust-apex-plane-localization-v0`) — SUPERSEDED / RETAINED AS LEGACY

Historical v0 contract (`src/features/bustApexPlaneLocalization.js`) establishing anterior chest prominence localization relative to upper-torso baseline chord:

- **Contract ID**: `bust-apex-plane-localization-v0`
- **Historical Real-Package Localized Result**: $Y = 123.85\text{ cm}$ (Front width: $34.30\text{ cm}$, Side qualified AP depth: $29.40\text{ cm}$, anterior prominence $\approx 0.6676\text{ cm}$).
- **Status**: **SUPERSEDED IN PRODUCTION** by Bust Point Plane Localization v1 (`bust-point-plane-localization-v1`, Section 4.18). Retained intentionally in source and test suite for historical regression testing and fallback compatibility.

### 4.18 Bust Point Plane Localization v1 & Modeled Bust Circumference v0 Migration — COMPLETED / ACCEPTED

Pure deterministic domain contracts (`src/features/bustPointPlaneLocalization.js`, `src/features/modeledBustCircumference.js`) and UI integration deriving the production Bust Point localization and Ramanujan II ellipse-modeled Bust circumference estimate:

- **Bust Point Plane Localization v1 (`bust-point-plane-localization-v1`) — ACTIVE PRODUCTION**:
  - **Plane Selector**: Most anterior breast / Bust Point from RAW Side contour within the upper-torso column ($Y_{\text{waist\_crest}} < Y < Y_{\text{shoulder}}$).
  - Evaluates true anterior extrema with trunk core support policy (`trunk_core_support_v0`, classes `[22, 23]`) and bilateral contour support.
  - **Real-Package Validated Result**:
    - Plane Y: **$119.15\text{ cm}$**
    - Front Transverse Width: **$35.10\text{ cm}$**
    - Qualified Side AP Depth: **$30.20\text{ cm}$**
    - Status: `ready`
- **Modeled Bust Circumference v0 (`modeled-bust-circumference-v0`) — ACTIVE PRODUCTION**:
  - **Definition ID**: `torso_modeled_bust_circumference_at_bust_apex_plane` (stable internal ID retained for backward compatibility).
  - **User-Facing Display Name**: `Modeled Bust Circumference`
  - Consumes authoritative `bust-point-plane-localization-v1` result directly; includes backward-compatibility gate supporting legacy v0 apex contract if supplied.
  - Model: `ellipse_ramanujan_ii` from Front width ($35.10\text{ cm}$) and Side qualified AP depth ($30.20\text{ cm}$).
  - **Real-Package Validated Circumference**: **$102.72\text{ cm}$** (`102.7212 cm`).
  - **Strict Semantic Invariant**: Modeled Bust Circumference is an ellipse-based modeled estimate. It is **NOT** tape-measured ground truth, **NOT** a measured body contour, **NOT** a reconstructed 3D perimeter, and **NOT** pointmap-derived.

### 4.19 Abdominal Point Plane Localization v1 & Modeled Abdominal Circumference v0 Migration — COMPLETED / ACCEPTED

Pure deterministic domain contracts (`src/features/abdominalPointPlaneLocalization.js`, `src/features/modeledAbdominalCircumference.js`) and UI integration deriving the production Abdominal Point localization and Ramanujan II ellipse-modeled Abdominal circumference estimate:

- **Abdominal Point Plane Localization v1 (`abdominal-point-plane-localization-v1`) — ACTIVE PRODUCTION**:
  - **Plane Selector**: Most anterior abdominal point from the RAW Side contour across the abdominal-pelvic column ($Y_{\text{hip}} < Y < Y_{\text{waist}}$) under `trunk_pelvic_transition_support_v0` (`[12, 13, 21, 22, 23]`).
  - Evaluates raw anterior profile geometry directly without requiring a baseline-relative prominence chord subtraction.
  - **Real-Package Validated Result**:
    - Raw anterior plateau: $\approx 96.15 - 97.45\text{ cm}$
    - Selected discrete Plane Y: **$96.85\text{ cm}$**
    - Front Transverse Width: **$36.90\text{ cm}$**
    - Qualified Side AP Depth: **$25.80\text{ cm}$**
    - Status: `ready`
- **Modeled Abdominal Circumference v0 (`modeled-abdominal-circumference-v0`) — ACTIVE PRODUCTION**:
  - **Definition ID**: `torso_modeled_abdominal_circumference_at_abdominal_apex_plane` (stable internal ID retained for backward compatibility).
  - **User-Facing Display Name**: `Modeled Abdominal Circumference`
  - Consumes authoritative `abdominal-point-plane-localization-v1` result directly; falls back to legacy v0 apex contract defensively if v1 is null.
  - Model: `ellipse_ramanujan_ii` from Front width ($36.90\text{ cm}$) and Side qualified AP depth ($25.80\text{ cm}$).
  - **Real-Package Validated Circumference**: **$99.26\text{ cm}$** (`99.2561 cm`).
  - **Strict Semantic Invariant**: Modeled Abdominal Circumference is an ellipse-based modeled estimate; requires physically qualified Side AP depth; zero Front-only fallback; raw Side span cannot replace qualified AP depth.

### 4.20 Buttock Point / Hip Girth Plane Localization v1 & Modeled Hip Girth v1 — COMPLETED / ACCEPTED

Pure deterministic domain contracts (`src/features/buttockPointPlaneLocalization.js`, `src/features/modeledHipGirth.js`) and UI integration deriving the production Buttock Point localization and Ramanujan II ellipse-modeled Hip Girth estimate:

- **Buttock Point Plane Localization v1 (`buttock-point-plane-localization-v1`) — ACTIVE PRODUCTION**:
  - **Plane Selector**: Most posterior point of the buttocks from RAW Side contour across the pelvic region under `pelvic_core_support_v0` (`[12, 13, 21, 22]`).
  - Evaluates the greatest posterior projection of the buttocks along Side-$U$.
  - **Hip Landmark Corroboration**: Pose-derived Hip Anatomical Level ($\approx 86.25\text{ cm}$) is corroborative/reference evidence only. The physical raw posterior Buttock Point determines Plane Y.
  - **Real-Package Validated Result**:
    - Raw posterior plateau: $\approx 86.05 - 86.15\text{ cm}$
    - Continuous midpoint: $\approx 86.10\text{ cm}$
    - Selected discrete Plane Y: **$86.05\text{ cm}$**
    - Front Transverse Width: **$42.20\text{ cm}$**
    - Qualified Side AP Depth: **$27.80\text{ cm}$**
    - Status: `ready`
- **Modeled Hip Girth v1 (`modeled-hip-girth-v1`) — ACTIVE PRODUCTION**:
  - **Measurement ID**: `torso_modeled_hip_girth_at_buttock_point_plane`
  - **User-Facing Display Name**: `Modeled Hip Girth`
  - Consumes authoritative `buttock-point-plane-localization-v1` result directly.
  - Model: `ellipse_ramanujan_ii` from Front width ($42.20\text{ cm}$) and Side qualified AP depth ($27.80\text{ cm}$) at Buttock Point Plane Y ($86.05\text{ cm}$).
  - **Real-Package Validated Hip Girth**: **$111.12\text{ cm}$** (`111.1168 cm`).
  - **Strict Semantic Invariant**: Modeled Hip Girth is an ellipse model estimate evaluated at the Buttock Point Plane; not a 3D reconstruction or measured tape perimeter.

### 4.21 Semantic Separation of Modeled Hip Girth and Modeled Maximum Seat Circumference — COMPLETED / ACCEPTED

Formalized the strict domain, contract, and presentation separation between **Modeled Hip Girth** and **Modeled Maximum Seat Circumference**:

- **Independent Dimension 1: Modeled Hip Girth (`modeled-hip-girth-v1`)**:
  - Localized at: **Buttock Point Plane Y** ($86.05\text{ cm}$ on sample capture).
  - Target: Greatest posterior anatomical projection of the buttocks (ISO-aligned Hip Girth landmark definition).
  - Real-package output: **$111.12\text{ cm}$** ($W = 42.20\text{ cm}, D = 27.80\text{ cm}$).
  - UI Card: Position 4 in Modeled Perimeter Estimates deck.
  - Preview Label: `Hip Girth Plane Y`.
- **Independent Dimension 2: Modeled Maximum Seat Circumference (`modeled-hip-seat-circumference-v0`)**:
  - Localized at: **Maximum Seat Plane Y** ($79.95\text{ cm}$ on sample capture).
  - Target: Global maximum modeled perimeter across the entire qualified pelvic container (`maximum-seat-plane-localization-v0`).
  - Real-package output: **$114.20\text{ cm}$** ($W = 44.30\text{ cm}, D = 27.40\text{ cm}$).
  - UI Card: Position 5 in Modeled Perimeter Estimates deck.
  - Preview Label: `Seat Plane Y`.
- **Critical Rule**: Modeled Hip Girth and Modeled Maximum Seat Circumference are **TWO DISTINCT ACTIVE MEASUREMENTS**. They are never merged, aliased together, or confused.

### 4.22 Five-Measurement Results UI & Ellipse Preview Integration — COMPLETED / ACCEPTED

Completed the end-to-end presentation and interactive visualization integration for all five active modeled circumferences:

- **Results Deck Hierarchy (`src/ui/derivedMeasurementDeck.js`)**:
  - Top Results deck presents **Modeled Perimeter Estimates** containing exactly five cards in canonical anatomical sequence:
    1. **Modeled Bust Circumference** (`torso_modeled_bust_circumference_at_bust_apex_plane`, Bust Point Plane $119.15\text{ cm}$, $102.72\text{ cm}$)
    2. **Modeled Natural Waist Circumference** (`torso_modeled_natural_waist_circumference_at_natural_waist_plane`, Waist Plane $107.15\text{ cm}$, $82.25\text{ cm}$)
    3. **Modeled Abdominal Circumference** (`torso_modeled_abdominal_circumference_at_abdominal_apex_plane`, Abdominal Point Plane $96.85\text{ cm}$, $99.26\text{ cm}$)
    4. **Modeled Hip Girth** (`torso_modeled_hip_girth_at_buttock_point_plane`, Hip Girth Plane $86.05\text{ cm}$, $111.12\text{ cm}$)
    5. **Modeled Maximum Seat Circumference** (`torso_modeled_hip_seat_circumference_at_maximum_seat_plane`, Seat Plane $79.95\text{ cm}$, $114.20\text{ cm}$)
- **Declarative Visualization Provenance (`src/features/measurementVisualizationProvenance.js`)**:
  - Maps each measurement card click to its corresponding 2D slice/plane highlight instructions:
    - Bust $\to$ `resolveBustApexPlane` (`Bust Point Plane Y`)
    - Natural Waist $\to$ `resolveNaturalWaistPlane` (`Waist Plane Y`)
    - Abdomen $\to$ `resolveAbdominalApexPlane` (`Abdominal Point Plane Y`)
    - Hip Girth $\to$ `resolveButtockPointPlane` (`Hip Girth Plane Y`)
    - Maximum Seat $\to$ `resolveCrossViewHorizontalSlice` (`Seat Plane Y`)
- **Modeled Ellipse Cross-Section Preview (`src/ui/modeledEllipseCrossSectionPreview.js`)**:
  - Interactive SVG preview dock rendering Front width $\times$ Side AP depth with true aspect ratio scaling and canonical disclaimer `"Ellipse model — not measured contour"`.
  - Accurately renders plane labels: `"Bust Point Plane Y"`, `"Waist Plane Y"`, `"Abdominal Point Plane Y"`, `"Hip Girth Plane Y"`, `"Seat Plane Y"`.
- **2D Highlight Overlays (`src/ui/measurementHighlightOverlay2d.js`)**:
  - Renders synchronized horizontal reference guides, localized Front and Side slice spans, and anchor dots. Permanent numeric text badges remain removed; authoritative numbers are displayed in the Results deck and preview dock.

### 4.23 Application Startup Defaults Modernization — COMPLETED / ACCEPTED

Standardized application startup state across HTML markup, runtime state, and menu indicators:
- **Right Sidebar**:
  - Results (`#derived-measurement-deck`) = **collapsed**
  - Session Records (`#session-records-panel`) = **collapsed**
  - Diagnostics (`#diagnostics-panel`) = **collapsed** (all nested diagnostic accordions collapsed)
- **Nested Results Subgroups**:
  - Cross-Section Evidence = **collapsed**
  - Modeled Perimeter Estimates = **collapsed**
  - Direct Measurements (and child category cards) = **collapsed**
- **Active Workflow**:
  - Default workflow = **Body Evidence** (`data-workflow="body-evidence"`)
- **View Settings**:
  - Origin / Center = **OFF** (`aria-checked="false"`, hidden from 3D scene on fresh load)
  - Body Measurement Previews = **OFF** (`aria-checked="false"`, hidden from scene on fresh load)

### 4.25 Direct Body Measurements Batch A & Batch B v0 — COMPLETED / VERIFIED

Established the deterministic Direct Body Measurements Contract v0 (`direct-body-measurements-v0`) providing **25 total direct body measurements** across four distinct anatomical categories:

- **Batch A (19 measurements)**:
  - **5 Vertical Inter-Level Distances** (`vertical_inter_level_delta`): `vertical_neck_to_shoulder_distance`, `vertical_shoulder_to_elbow_distance`, `vertical_elbow_to_wrist_distance`, `vertical_hip_to_knee_distance`, `vertical_knee_to_ankle_distance`.
  - **10 Projected Landmark Segments** (`linear_projected_distance`): Left/Right Clavicle Span, Left/Right Upper Arm Segment Length, Left/Right Forearm Segment Length, Left/Right Thigh Segment Length, Left/Right Lower Leg Segment Length.
  - **4 Projected Kinematic Chains** (`segment_chain_length`): Left/Right Total Arm Length (Shoulder $\to$ Elbow $\to$ Wrist), Left/Right Total Leg Length (Hip $\to$ Knee $\to$ Ankle).
- **Batch B (6 Bilateral Transverse Landmark Spans)** (`calibrated_projected_2d_transverse_span`):
  1. `inter_acromion_transverse_breadth_projected`: `Inter-Acromion Transverse Breadth (Projected)` (`left_acromion` ↔ `right_acromion`)
  2. `inter_hip_landmark_transverse_span`: `Inter-Hip Landmark Transverse Span` (`left_hip` ↔ `right_hip`)
  3. `bilateral_elbow_landmark_transverse_span`: `Bilateral Elbow Landmark Transverse Span` (`left_elbow` ↔ `right_elbow`)
  4. `bilateral_wrist_landmark_transverse_span`: `Bilateral Wrist Landmark Transverse Span` (`left_wrist` ↔ `right_wrist`)
  5. `bilateral_knee_landmark_transverse_span`: `Bilateral Knee Landmark Transverse Span` (`left_knee` ↔ `right_knee`)
  6. `bilateral_ankle_landmark_transverse_span`: `Bilateral Ankle Landmark Transverse Span` (`left_ankle` ↔ `right_ankle`)

#### Authoritative Batch B Geometry & Asymmetry Semantics
- **Authoritative Transverse Span**: For bilateral Front landmarks $(X_L, Y_L)$ and $(X_R, Y_R)$, $\text{valueCm} = |X_R - X_L| = |\Delta X_{\text{cm}}|$.
- **Strict Guardrail**: $\text{valueCm}$ is a pure Front-plane horizontal transverse breadth; it is **NOT** a diagonal Euclidean chord $\sqrt{\Delta X^2 + \Delta Y^2}$.
- **Asymmetry Evidence**: $\Delta Y_{\text{cm}} = Y_R - Y_L$ and $\text{elevationDeltaCm} = |\Delta Y_{\text{cm}}|$ are retained strictly as provenance/evidence; vertical asymmetry does **NOT** alter $\text{valueCm}$.

#### Semantic & Anatomical Distinctions
- **Acromion vs Shoulder**: `inter_acromion_transverse_breadth_projected` uses Secondary Front landmarks `left_acromion` ↔ `right_acromion`. It is strictly distinct from `left_shoulder` ↔ `right_shoulder`, Shoulder Anatomical Level ($Y_{\text{shoulder}}$), and Torso Transverse Width at Shoulder Level (silhouette width). Core 13 landmark taxonomy and reference levels remain unaltered.
- **Hip Landmark Span vs Silhouette & Circumference**: `inter_hip_landmark_transverse_span` uses `left_hip` ↔ `right_hip`. It is strictly distinct from Torso Transverse Width at Hip Level, Modeled Hip Girth (Buttock Point Plane), Modeled Maximum Seat Circumference (Maximum Seat Plane), and bi-trochanteric breadth.
- **Pose/Stance-Dependent Bilateral Spans**: Elbow, wrist, knee, and ankle spans are pose- and stance-dependent projected landmark spans; they are not intrinsic skeletal or surface body breadths.

#### Visualization Provenance & 2D Overlay Rendering
- Extended `measurement-visualization-provenance-v0` with `bilateral_transverse_span`.
- Target view: Front view (`targetViews: ['front']`).
- Preserves actual source landmarks at true coordinates $(X_L, Y_L)$ and $(X_R, Y_R)$.
- Displays horizontal measured span at display-only $Y_{\text{vis}} = (Y_L + Y_R) / 2$ with endpoints $(X_L, Y_{\text{vis}}) \to (X_R, Y_{\text{vis}})$. $Y_{\text{vis}}$ is display-only and is never a measurement input.
- Renders subtle dashed helper/drop lines (`.grid2d-highlight-drop-line`) connecting actual landmarks to horizontal span endpoints when $Y_L \ne Y_R$.
- Diagonal Euclidean chord is **never** rendered as the measurement span.
- UI does not recalculate $\text{valueCm}$.
- No permanent numeric text badges are rendered over 2D overlay highlights.

#### Results UI Integration
- Added collapsible subgroup **`Bilateral Spans & Breadths`** (`bilateral_transverse_landmark_spans`) under `Results` $\to$ `Direct Measurements` rendering all 6 Batch B cards.
- Wired into unified click-to-highlight flow: clicking a card focuses the 2D split workspace (`WORKSPACE_SPLIT`), renders the 2D highlight, and re-clicking toggles off.

#### Deferred Items
- **Underbust**: Separate track, not modified.

- **Verified Baseline**: **889 / 889 tests passing across 47 test suites, 0 failures, clean production build** (updated to 905/905 in Milestone 4.26).

### 4.26 Neck Transverse Width v0 — COMPLETED / VERIFIED

Established the deterministic Neck Transverse Width implementation at Neck Level (`front-transverse-width-v0`):

- **Contract**: `front-transverse-width-v0` (`src/features/frontTransverseWidth.js`)
- **Measurement ID**: `neck_transverse_width_at_neck_level`
- **Canonical Name**: `Neck Transverse Width at Neck Level`
- **Display Label**: `Neck Transverse Width`
- **Source Anatomical Level**: `neck` (`anatomical-levels-v0`)
- **Reference Plane**: $Y = Y_{\text{neck}}$ ($y_{\text{cm}} = \text{anatomicalLevels.neck.yCm}$)

#### Authoritative Geometry
- Metric horizontal bounds:
  $$\text{leftXcm} = \text{selectedRun.boundsCm.minX}$$
  $$\text{rightXcm} = \text{selectedRun.boundsCm.maxX}$$
  $$\text{valueCm} = \text{rightXcm} - \text{leftXcm}$$
- **Metrological Identity**: Calibrated projected Front-plane transverse silhouette width at Neck Level.
- **Explicit Non-Claims**: It is strictly NOT a landmark-to-landmark distance, bilateral landmark span, diagonal Euclidean chord, neck circumference, 3D neck diameter, skeletal neck breadth, or standardized anthropometric caliper breadth.

#### Role of the Neck Landmark
- The promoted Front `neck` landmark authoritatively provides $Y_{\text{neck}}$ and source anatomical level provenance.
- It does **NOT** define `leftXcm` or `rightXcm`, does **NOT** define width directly, and does **NOT** act as either measurement endpoint.
- Zero synthetic neck landmarks (`left_neck`, `right_neck`) exist or were created.

#### Measurement Support Policy (`neck_core_support_v0`)
- **Policy ID**: `neck_core_support_v0` (`src/features/measurementSupportPolicy.js`)
- **Accepted Classes**: `[3, 22, 23]`
- **Partitions**:
  - `anatomicalClassIds`: `[3, 22]` (`Face_Neck`, `Torso`)
  - `clothingBridgeClassIds`: `[23]` (`Upper_Clothing`)
- **Verified Taxonomy Meanings**: `3 = Face_Neck`, `22 = Torso`, `23 = Upper_Clothing`.
- **Explicit Exclusions**: Background (0), Hair (4), Upper Arms (11, 20), and all other non-target classes.
- **Why Generic Policies Are Not Used**:
  - `BODY_ANATOMICAL` excludes `Face_Neck` class 3.
  - `TORSO_ONLY` excludes `Face_Neck` class 3 and `Upper_Clothing` class 23.
  - `FOREGROUND` is overly permissive and captures hair/arms.

#### Semantic Qualifier
- The segmentation ontology does not contain a dedicated Neck-only class; this measurement is an **observed supported neck silhouette width at Neck Level** derived from the accepted support classes. It makes no naked-body or standardized anthropometric claim.

#### Clothing / Body Surface Semantics
- If Class 23 `Upper_Clothing` contributes to the selected run:
  $$\text{usedClothingEvidence} = \text{true}, \quad \text{clothingClassIdsUsed} = [23]$$
- If clothing does not contribute:
  $$\text{usedClothingEvidence} = \text{false}, \quad \text{clothingClassIdsUsed} = []$$
- No clothing-removal algorithm exists; no garment-thickness compensation is performed.
- Retains full compatibility with downstream physical measurement eligibility (`physicalMeasurementEligibility.js`).

#### Raster Slicing & Run Selection
- **Raster Slice**: Reuses `front-horizontal-raster-slice-v0` ($Y_{\text{cm}} \to$ raster row $\to$ accepted-class scan $\to$ contiguous runs $\to$ metric bounds) without modifying the raster engine.
- **Run Selection Policy**: `single_run_required`
  - Exactly 1 accepted run: $\to$ `valid`
  - 0 accepted runs: $\to$ `unavailable`
  - $> 1$ separated accepted runs: $\to$ `ambiguous`
  - Malformed/non-finite/inverted metric bounds: $\to$ `invalid`
- Zero silent run merging, zero widest-run selection, zero heuristic central-run selection, and neck landmark $X$ is never used to arbitrate multiple runs.

#### Provenance Fields
- Full domain provenance recorded in observation: `sourceLevel: 'neck'`, `levelYcm`, `sampledPixelRow`, `sourceSliceContract: 'front-horizontal-raster-slice-v0'`, `targetPolicy: 'neck_core_support_v0'`, `supportPolicyId: 'neck_core_support_v0'`, `targetClassIds: [3, 22, 23]`, `actualClassIdsUsed`, `clothingClassIdsUsed`, `usedClothingEvidence`, `runSelectionPolicy: 'single_run_required'`, `selectedRunIndex`, `leftXcm`, `rightXcm`.

#### Runtime Integration
- Domain getters in `src/features/bodyEvidence.js`:
  - `getFrontTransverseWidth({ id: 'neck_transverse_width_at_neck_level' })`
  - `getFrontTransverseWidths()` now evaluates three Front transverse-width definitions:
    1. `neck_transverse_width_at_neck_level`
    2. `torso_width_at_shoulder_level`
    3. `torso_width_at_hip_level`
- Shoulder and Hip transverse width definitions and behaviors remain 100% unchanged.

#### Results UI & Click-to-Highlight Integration
- **Results Subgroup**: Rendered in a dedicated collapsible subgroup **`Front Transverse Widths`** (`data-group-id="front_transverse_widths"`) in `src/ui/derivedMeasurementDeck.js`.
  - Intentionally separate from `Cross-Section Evidence` (Neck has no paired Side AP depth/cross-view correspondence).
  - Intentionally separate from `Direct Measurements` (Neck Width is segmentation-derived, not landmark-to-landmark/inter-level geometry).
  - Shoulder and Hip paired cards remain in `Cross-Section Evidence`.
- **Card Presentation & Layout Fix**:
  - Primary Row: `Front Transverse Width` (left) ........... `<value> cm` (right)
  - Metadata Row: `Reference Level` stacked above `Neck Level (Y <value> cm)` using `.derived-card-row--meta` and `.front-transverse-meta-row` in `components.css` to prevent character-by-character wrapping on narrow sidebars.
  - Status Badge: Displays uncollapsed domain status (`Valid`, `Unavailable`, `Ambiguous`, `Invalid`).
  - Value Source: Strictly reads `measurement.valueCm` from domain evidence; zero recomputation in UI.
- **Click-to-Highlight Flow**:
  - Selection: `data-measurement-id="neck_transverse_width_at_neck_level"` $\to$ `selectMeasurement(id)` $\to$ `resolveMeasurementVisualizationProvenance` $\to$ `setMeasurementHighlight` $\to$ `WORKSPACE_SPLIT` $\to$ Front 2D highlight. Re-click deselects and clears highlight.
- **Visualization Overlay (`measurementHighlightOverlay2d.js`)**:
  - Reused generic `FRONT_HORIZONTAL_SLICE` renderer on Front view only (`targetViews: ['front']`).
  - Geometry: horizontal line $(\text{leftXcm}, Y_{\text{neck}}) \to (\text{rightXcm}, Y_{\text{neck}})$ with endpoint dots.
  - Guardrails: No Yvis midpoint, no drop lines, no landmark pair line, no diagonal line, no synthetic landmarks, no permanent numeric canvas badge.

#### Invariants & Preservations
- **Direct Body Measurements**: Remains strictly **25 direct measurements** (Batch A 19 + Batch B 6).
- **Underbust**: Separate workstream, untouched.
- **Verified Baseline**: **905 / 905 tests passing across 47 test suites, 0 failures, clean production Vite build**.

---

## 5. Canonical / Latent Layer — LATER

### 5.1 Canonical Body Evidence Graph
Represent each anatomical entity as a structured evidence node containing semantic identity, landmarks, segmentation support, metric bounds, dense QA provenance, and validated measurements.

### 5.2 Structured Latent Conditioning Package
Prepare deterministic structured conditioning data for downstream latent/generative systems.

### 5.3 Downstream Body / Garment Generation & Editing
Use the validated canonical evidence/latent representation in later body, garment, VTO, editing, and digital-twin workflows.

### 5.4 Future Development — VTON Relevance Mapping — LATER / FUTURE
Map validated body measurements to downstream virtual try-on, sizing, grading, garment fitting, and garment anchoring workflows. Marked **INACTIVE / FUTURE**.

---

## 6. Current Architectural Guardrails

Do not silently introduce:
- direct U → Z conversion
- Pointmap Z → canonical metrology Z
- unvalidated depth inference / physical depth promotion
- Front/Side geometry fusion / Front/Side pointmap fusion
- circumference, ellipse inference, or cross-section before authoritative physical geometry is established (or explicitly modeled at localized planes)
- body volume before geometry is validated
- 3D reconstruction from camera-frame or otherwise non-authoritative pointmaps
- physical authority from Sapiens API `"meters"`
- physical authority from Sapiens pointmap `scale`
- face data into the body-metrology pipeline
- invented anatomical regions unsupported by current evidence
- hard-coded pixel-to-cm assumptions that bypass the mapping contract
- synthetic chest/bust/waist reference levels without landmark anchors or evidence-driven localization
- absolute height-from-floor measurements without verified ground contact reference (`NEEDS_GROUND_REFERENCE`)
- declaring subject height calibration input as measured optical stature
- bilateral averaging of asymmetric limb measurements
- equating bilateral hip landmark level with maximum buttock/seat plane
- merging Modeled Hip Girth and Modeled Maximum Seat Circumference into a single measurement
- describing modeled ellipse as measured contour or tape-measured ground truth
- inventing Waist skeletal landmarks or hardcoded body-height percentage offsets
- interpolating or fabricating missing Side contour rows across unobserved metric gaps
- requiring identical Front and Side raster-row indices (same canonical Y is preserved across independent view rasters)

---

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
- Pointmap: active & normalized, with numeric and cross-modal QA evaluated; 4.5G classifies recognized Sapiens Front/Side pointmaps as camera-frame geometric evidence (`partial`, `authorized: false`). Authoritative physical body geometry is not established. Front and Side pointmaps do not share a coordinate frame.
- Normals: active & normalized, with numeric and cross-modal QA evaluated; geometry semantics remain unvalidated

---

## 8. Verification Baseline

- **905 tests passing**
- **0 failures**
- **0 skipped**
- **0 cancelled**
- **47 test suites**
- Clean production Vite build (`npm run build`)

---

## 9. Next Milestone Planning

With the **Five Active Modeled Circumference Pipelines** (Bust Point v1, Natural Waist v0, Abdominal Point v1, Buttock Point / Hip Girth v1, Maximum Seat v0), **Direct Body Measurements Batch A & Batch B v0 (25 measurements)**, **Neck Transverse Width v0**, **Results UI Integration**, **Startup Defaults Modernization**, and **Code / Architecture Cleanup** fully completed and accepted, the remaining deferred workstreams are:

1. **Underbust Level Localization & Modeled Underbust Circumference** (deferred pending inframammary fold localization).
2. **Absolute height-from-floor measurements (`NEEDS_GROUND_REFERENCE`)** (deferred pending verified floor plane).
3. **Measured optical stature** (deferred).
4. **Canonical Body Evidence Graph & Latent Conditioning Package** (Milestone 5.1 / 5.2).

---

## 10. Roadmap Change Policy

This roadmap may evolve as stronger model outputs or validated evidence become available.

When changing direction:
1. preserve completed stable contracts unless there is a proven reason to revise them;
2. document why the roadmap changed;
3. update `PROJECT_CONTEXT.md` and `PROJECT_STRUCTURE.md` where relevant;
4. keep deferred geometry assumptions explicit;
5. avoid silently replacing the current source-of-truth architecture.






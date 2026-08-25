# REVacity Metrology Space — Development Roadmap

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
  - Inspects and validates: `pixelsPerCm`, isotropic scaling consistency (`scaleFactorX === scaleFactorY`), standardized canvas extent agreement (`canvasWidthPx === canvasHeightPx === 2000`), active raster dimension matching, preprocessing crop/scale provenance, and REVacity workspace scale agreement ($2000\text{ px} \leftrightarrow 200\text{ cm}$, $10\text{ px/cm}$).
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

The unified Body Pipeline archive is successfully consumed and validated by REVacity:

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
- REVacity pixels-per-cm
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
- no pointmap $Z \to$ REVacity canonical $Z$
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
- **Immediate Next Milestone**: **Cross-Section Evidence v0** (prerequisite before Circumference Estimation).
- **Subsequent Milestone**: **Circumference Estimation v0** (Milestone 4.6).

### 4.6 Circumference / Cross-section Inference — BLOCKED

Remains strictly **BLOCKED**. It is **not** active and **not** completed.

- **Reason**: The current system has valid projected Front/Side metric evidence and camera-frame pointmap evidence, but authoritative physical cross-section/depth semantics have not yet been established.
- **Model-Specific Unlock Rule**:
  - 4.6 is **not** globally unlocked.
  - A downstream *Physical Front+Side Cross-Section Model* requires:
    - Front: `physicalEligibility === true` and non-null `physicalMeasurementCm`.
    - Side: `physicalEligibility === true` and non-null `physicalMeasurementCm`.
    - Paired: `pairedPhysicalEligibility === true`.
  - Current real archive evidence does **NOT** satisfy this (both views blocked by clothing, missing physical view/pose orientation certification, and missing authoritative physical evidence). Camera-frame Sapiens pointmaps do not unlock 4.6.
  - A future empirical silhouette model may explicitly consume `pairedMetricProjectedEligibility: true`, but that model must declare, validate, and isolate its own empirical assumptions.
- **Strict Guardrail**: Zero coordinate fusion, no Side $U \to Z$ conversion, no pointmap $Z$ promotion, and no premature ellipse, circumference, or 3D cross-section calculations.

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
- unvalidated depth inference / physical depth promotion
- Front/Side geometry fusion / Front/Side pointmap fusion
- circumference, ellipse inference, or cross-section before authoritative physical geometry is established
- body volume before geometry is validated
- 3D reconstruction from camera-frame or otherwise non-authoritative pointmaps
- physical authority from Sapiens API `"meters"`
- physical authority from Sapiens pointmap `scale`
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
- Pointmap: active & normalized, with numeric and cross-modal QA evaluated; 4.5G classifies recognized Sapiens Front/Side pointmaps as camera-frame geometric evidence (`partial`, `authorized: false`). Authoritative physical body geometry is not established. Front and Side pointmaps do not share a coordinate frame.
- Normals: active & normalized, with numeric and cross-modal QA evaluated; geometry semantics remain unvalidated

## 8. Roadmap Change Policy

This roadmap may evolve as stronger model outputs or validated evidence become available.

When changing direction:
1. preserve completed stable contracts unless there is a proven reason to revise them;
2. document why the roadmap changed;
3. update `PROJECT_CONTEXT.md` and `PROJECT_STRUCTURE.md` where relevant;
4. keep deferred geometry assumptions explicit;
5. avoid silently replacing the current source-of-truth architecture.



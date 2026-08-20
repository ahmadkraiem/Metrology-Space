# REVacity Metrology Space — Development Roadmap

Status: Active guiding roadmap
Purpose: Keep the project aligned with the current architecture and evidence strategy. This roadmap is a source-of-truth planning document, not an immutable specification. Future changes should update this file deliberately rather than silently diverging from it.

## 1. Foundation — Completed

- Canonical Metrology Space
- Front X/Y + Side U/Y navigators
- Body Landmark Evidence
- Front–Side Alignment v0
- Body Graph / Reference Levels

## 2. Semantic Dense Evidence — Completed

- Segmentation Normalization + QA
- Segmentation Preview / Inspection
- Anatomical Region Contract v0
- Pixel-to-Metrology Mapping Core v0
- Anatomical Region Metric Bounds v0

## 3. New Evidence Foundation

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
- Lightweight lazy dense buffer access (`loadDenseBuffer`) without eager memory duplication.
- In-memory ZIP transport adapter (`importBodyEvidenceZip`) for pipeline/testing workflows.
- Authoritative Package QA presentation in Session Data → Body.
- Automatic analysis triggered upon package upload.
- Strict preservation of geometry boundaries (no pointmap Z → canonical Z, no U → Z, no Front/Side 3D fusion).

### 3.2 Pointmap + Normal Evidence Contract / QA v0 — NEXT

Audit and formalize coordinate frames and dense numerical validity:

- Pointmap coordinate frame and units validation (`declaredUnits`, `declaredScale`)
- Numeric validity: NaN / Infinity guards, finite min/max distributions
- Meaning of `scale` and whether values are pre-scaled or unscaled
- Pixel-to-point correspondence and valid foreground body masking
- Cross-modal consistency: segmentation ↔ pointmap ↔ normals alignment
- Surface normal vector magnitude validity ($\approx 1.0$) and range verification (`declaredRange`)
- Surface normal coordinate frame and orientation semantics
- Front/Side frame independence

Guardrail: Do not assume pointmap Z is canonical metrology Z, and do not fuse Front and Side geometry until coordinate frames and orientations are explicitly validated.

## 4. Anatomical / Metrology Layer — Planned

### 4.1 Derived Anatomical Levels / Zones

Define supported anatomical zones using validated segmentation + landmark/reference-level evidence.

Examples to evaluate:
- neck
- shoulder
- chest / bust
- waist / abdomen
- pelvis / hip
- knee
- ankle

Do not invent proportional anatomical rules unless explicitly adopted by contract.

### 4.2 Region Boundary / Surface Evidence

Associate validated multi-modal evidence with anatomical regions:

- segmentation pixels / masks
- metric 2D bounds
- landmarks
- pointmap XYZ samples
- surface-normal samples

Keep Front and Side spatial evidence independent unless a later correspondence contract explicitly permits fusion.

### 4.3 Front Width / Height Measurements

Extract deterministic Front-plane measurements from validated anatomical boundaries and levels.

### 4.4 Side Depth / Projection Measurements

Use validated Side evidence for profile/depth-related measurements.

Guardrail: Side U is not automatically canonical Z.

### 4.5 Cross-view Correspondence + QA

Extend beyond current vertical-Y alignment only after Front/Side evidence semantics and frames are validated.

### 4.6 Circumference / Cross-section Inference

Only after reliable Front width, Side depth/profile evidence, anatomical levels, and correspondence QA exist.

No premature ellipse/circumference assumptions.

## 5. Canonical / Latent Layer — Later

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
- Pointmap: accepted normalized evidence modality; geometry semantics unvalidated pending Milestone 3.2
- Normals: accepted normalized evidence modality; geometry semantics unvalidated pending Milestone 3.2

## 8. Roadmap Change Policy

This roadmap may evolve as stronger model outputs or validated evidence become available.

When changing direction:
1. preserve completed stable contracts unless there is a proven reason to revise them;
2. document why the roadmap changed;
3. update `PROJECT_CONTEXT.md` and `PROJECT_STRUCTURE.md` where relevant;
4. keep deferred geometry assumptions explicit;
5. avoid silently replacing the current source-of-truth architecture.

## 9. Immediate Next Milestone

**Pointmap + Normal Evidence Contract / QA v0**

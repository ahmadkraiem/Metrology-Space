# Task 1 Brief

## Global Constraints

- Preserve the 200 × 200 × 200 cm room, 1 unit = 1 cm, 10 cm visible grid, 5 cm internal sampling, 68,921 points, LOD, and 3D axes.
- Preserve Front mapping, Front promotion, annotations, canonical A/B/history, Body Graph, the six Body Measurement Readiness candidates, preview-line semantics, and Scene State version 1 shape.
- Side remains U/Y evidence. Do not add Side promotion, canonical Side annotations, Side-to-Body-Graph/readiness coupling, Front-Side Alignment, canonical Z, or depth inference.
- Preserve existing Side navigator, local Side A/B measurement, region refinement, and coordinates; do not expand those behaviors.
- Use exact normalized allowlists only. Do not mirror, infer, or fabricate Side landmarks.
- Do not update `PROJECT_CONTEXT.md`, `PROJECT_STRUCTURE.md`, or `REFACTOR_PLAN.md`.
- Do not create git commits unless the user explicitly authorizes them.

### Task 1: Lock the Body Evidence Classification Contract

**Files:**
- Create: `src/features/bodyEvidenceAdapter.test.js`
- Modify: `src/features/bodyEvidenceAdapter.js`

**Interfaces:**
- Produces: `SECONDARY_SIDE_BODY_ANCHORS: readonly string[]`
- Produces: `classifyPoseLandmarks(landmarks, { view })`
- Produces per-view pose fields: `core`, `secondary`, `rejectedFace`, `ignoredNonCore`, `lowConfidence`, `acceptedLandmarks`, `rejectedLandmarks`, `ignoredLandmarks`
- Produces top-level QA fields: `frontCoreLandmarks`, `frontSecondaryLandmarks`, `sideCoreLandmarks`, `sideSecondaryLandmarks`, `frontRejectedFaceLandmarks`, `sideRejectedFaceLandmarks`, `frontIgnoredNonCoreLandmarks`, `sideIgnoredNonCoreLandmarks`

- [ ] **Step 1: Write failing adapter tests**

Use `node:test` to cover:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeBodyEvidence,
  classifyPoseLandmarks,
} from './bodyEvidenceAdapter.js';

const point = (name, score = 0.9) => ({ name, x: 100, y: 200, score });

test('preserves Front core and secondary classification', () => {
  const result = classifyPoseLandmarks([
    point('left_shoulder'),
    point('right_heel'),
    point('nose'),
    point('left_index'),
  ], { view: 'front' });
  assert.equal(result.core, 1);
  assert.equal(result.secondary, 1);
  assert.equal(result.rejectedFace, 1);
  assert.equal(result.ignoredNonCore, 1);
});

test('classifies only exact safe Side secondary identities', () => {
  const result = classifyPoseLandmarks([
    point('left_shoulder'),
    point('right_heel'),
    point('heel_prediction'),
    point('left_thumb1'),
  ], { view: 'side' });
  assert.equal(result.core, 1);
  assert.equal(result.secondary, 1);
  assert.equal(result.ignoredNonCore, 2);
  assert.deepEqual(
    result.acceptedLandmarks.filter((entry) => entry.secondary).map((entry) => entry.name),
    ['right_heel'],
  );
});

test('reports rejected and ignored counts separately by view', () => {
  const result = analyzeBodyEvidence({
    frontPose: { landmarks: [point('left_shoulder'), point('nose')] },
    sidePose: { landmarks: [point('right_hip'), point('ear'), point('left_index')] },
  });
  assert.equal(result.qa.frontCoreLandmarks, 1);
  assert.equal(result.qa.sideCoreLandmarks, 1);
  assert.equal(result.qa.frontRejectedFaceLandmarks, 1);
  assert.equal(result.qa.sideRejectedFaceLandmarks, 1);
  assert.equal(result.qa.frontIgnoredNonCoreLandmarks, 0);
  assert.equal(result.qa.sideIgnoredNonCoreLandmarks, 1);
  assert.equal(result.qa.rejectedFaceLandmarks, 2);
  assert.equal(result.qa.ignoredNonCoreLandmarks, 1);
});
```

- [ ] **Step 2: Run the tests and confirm the new contract fails**

Run: `node --test src/features/bodyEvidenceAdapter.test.js`

Expected: FAIL because the view-aware fields and Side secondary contract do not exist yet.

- [ ] **Step 3: Implement view-aware exact classification**

Keep `CORE_FRONT_BODY_ANCHORS` and `SECONDARY_FRONT_BODY_ANCHORS` unchanged. Define `SECONDARY_SIDE_BODY_ANCHORS` from the same exact safe identities and separate sets. Add a `view` option without using arbitrary keyword acceptance:

```js
export function classifyPoseLandmarks(landmarks, { view = 'front' } = {}) {
  const secondarySet = view === 'side'
    ? SECONDARY_SIDE_BODY_ANCHOR_SET
    : SECONDARY_FRONT_BODY_ANCHOR_SET;
  // Existing face rejection and low-confidence handling remain.
  // Core uses the unchanged core-13 identity contract.
  // Secondary uses secondarySet.has(normalizeLandmarkName(name)).
}
```

Pass `{ view: 'front' }` and `{ view: 'side' }` from `analyzeBodyEvidence`. Populate explicit per-view QA counts and name/detail arrays while retaining current aggregate fields for compatibility.

- [ ] **Step 4: Update diagnostic export compatibility**

In `src/features/bodyEvidence.js`, extend `exportPoseView()` and `buildBodyEvidenceExport()` with the corrected fields. Do not add Body Evidence to Scene State and do not include raw landmarks or segmentation base64.

- [ ] **Step 5: Run adapter and Body Graph tests**

Run:

```powershell
node --test src/features/bodyEvidenceAdapter.test.js
node --test src/features/bodyGraph.test.js
```

Expected: all tests pass.

---

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildDerivedMeasurementCardHtml,
  deriveMeasurementCardStatus,
  renderDerivedMeasurementDeck,
} from './derivedMeasurementDeck.js';

const markup = readFileSync(
  fileURLToPath(new URL('../../index.html', import.meta.url)),
  'utf8',
);

test('derivedMeasurementDeck: renderDerivedMeasurementDeck renders empty state when evidence not analyzed', () => {
  const container = { innerHTML: '' };
  renderDerivedMeasurementDeck(container);

  assert.equal(container.innerHTML.includes('No body evidence analyzed.'), true);
});

test('derivedMeasurementDeck: guardrail ensures terminology conforms to Front Transverse Width and Side Profile Span without Depth', () => {
  const container = { innerHTML: '' };
  renderDerivedMeasurementDeck(container);

  // Guardrail: must NOT contain Depth or Z-Depth
  assert.equal(/depth/i.test(container.innerHTML), false);
  assert.equal(/circumference/i.test(container.innerHTML), false);
});

test('derivedMeasurementDeck: Results header has no static Metric Projected badge', () => {
  const deckStart = markup.indexOf('id="derived-measurement-deck"');
  const deckEnd = markup.indexOf('id="session-records-panel"');
  assert.ok(deckStart > -1 && deckEnd > deckStart, 'Results deck markup must be present');
  const deck = markup.slice(deckStart, deckEnd);

  assert.match(deck, /deck-title">Results/);
  assert.equal(deck.includes('Metric Projected'), false);
  assert.equal(deck.includes('deck-badge'), false);
});

test('derivedMeasurementDeck: Stage 1 session tab strip is no longer part of the Results deck', () => {
  assert.equal(markup.includes('id="session-tab-history"'), false);
  assert.equal(markup.includes('id="session-tab-annotations"'), false);
  assert.equal(markup.includes('id="session-tab-body"'), false);
  assert.equal(markup.includes('id="session-tab-graph"'), false);
});

test('derivedMeasurementDeck: deriveMeasurementCardStatus uses existing pairedStatus contract', () => {
  assert.deepEqual(deriveMeasurementCardStatus({ pairedStatus: 'eligible' }), {
    label: 'Eligible',
    tone: 'ok',
  });
  assert.deepEqual(deriveMeasurementCardStatus({ pairedStatus: 'partial' }), {
    label: 'Partial',
    tone: 'warn',
  });
  assert.deepEqual(deriveMeasurementCardStatus({ pairedStatus: 'blocked' }), {
    label: 'Blocked',
    tone: 'warn',
  });
  assert.deepEqual(deriveMeasurementCardStatus({ pairedStatus: 'unavailable' }), {
    label: 'Unavailable',
    tone: 'muted',
  });
  assert.deepEqual(deriveMeasurementCardStatus(null), {
    label: 'Unavailable',
    tone: 'muted',
  });
});

test('derivedMeasurementDeck: slim cards keep results and one status without blocker chips', () => {
  const html = buildDerivedMeasurementCardHtml(
    { id: 'torso_shoulder_cross_view_correspondence', name: 'Shoulder Level' },
    {
      frontObservation: { spanCm: 38.25, level: { yCm: 142.5 } },
      sideObservation: { spanCm: 21.5 },
      provenance: { frontLevelYcm: 142.5 },
    },
    {
      pairedStatus: 'blocked',
      pairedPhysicalEligibility: false,
      frontMetricSpanCm: 38.25,
      sideMetricSpanCm: 21.5,
      blockers: ['comparability_qa_missing', 'clothing_authorization_missing'],
    },
  );

  assert.equal(html.includes('Shoulder Level'), true);
  assert.equal(html.includes('Front Transverse Width'), true);
  assert.equal(html.includes('Side Profile Span'), false);
  assert.equal(html.includes('38.25 cm') || html.includes('38.3 cm') || html.includes('38.2 cm'), true);
  assert.equal(html.includes('Y '), true);
  assert.equal(html.includes('Blocked'), true);

  assert.equal(html.includes('derived-blocker'), false);
  assert.equal(html.includes('Cross-View Comparability Pending'), false);
  assert.equal(html.includes('View Alignment Incomplete'), false);
  assert.equal(html.includes('Clothing Validation Pending'), false);
  assert.equal(html.includes('Capture Orientation Validation Pending'), false);
  assert.equal(html.includes('Physical Evidence Validation Pending'), false);
  assert.equal(html.includes('Physical Validation'), false);
  assert.equal(html.includes('Validation Pending'), false);
  assert.equal(html.includes('Metric Projected'), false);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('Cross-Section Evidence'), true);
  assert.equal(/z-depth/i.test(html), false);
  assert.equal(/circumference/i.test(html), false);
});

test('derivedMeasurementDeck: missing spans render Unavailable instead of overlapping statuses', () => {
  const html = buildDerivedMeasurementCardHtml(
    { id: 'torso_hip_cross_view_correspondence', name: 'Hip Level' },
    { frontObservation: null, sideObservation: null },
    { pairedStatus: 'unavailable', blockers: ['correspondence_unavailable'] },
  );

  assert.equal(html.includes('Hip Level'), true);
  assert.equal(html.includes('Unavailable'), true);
  assert.equal(html.includes('View Alignment Incomplete'), false);
  assert.equal(html.includes('derived-blocker'), false);
});

test('derivedMeasurementDeck: qualified Shoulder renders Front Width, Side AP Depth, and Cross-Section status without Side Profile Span row', () => {
  const html = buildDerivedMeasurementCardHtml(
    { id: 'torso_shoulder_cross_view_correspondence', name: 'Shoulder Level' },
    {
      frontObservation: { spanCm: 30.80, level: { yCm: 132.85 } },
      sideObservation: { spanCm: 11.00, level: { yCm: 132.85 } },
      provenance: { frontLevelYcm: 132.85 },
    },
    { pairedStatus: 'eligible', frontMetricSpanCm: 30.80, sideMetricSpanCm: 11.00 },
    {
      status: 'qualified',
      qualifiedDepthEstimateCm: 11.00,
      levelYcm: 132.85,
    },
    {
      status: 'qualified',
    },
  );

  assert.equal(html.includes('Shoulder Level'), true);
  assert.equal(html.includes('Front Transverse Width'), true);
  assert.equal(html.includes('30.80 cm') || html.includes('30.8 cm'), true);
  assert.equal(html.includes('Side Profile Span'), false);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('11.00 cm') || html.includes('11.0 cm') || html.includes('11 cm'), true);
  assert.equal(html.includes('Cross-Section Evidence'), true);
  assert.equal(html.includes('QUALIFIED'), true);
  assert.equal(html.includes('Qualified'), true);
});

test('derivedMeasurementDeck: qualified Hip renders Front Width, Side AP Depth, and Cross-Section status without Side Profile Span row', () => {
  const html = buildDerivedMeasurementCardHtml(
    { id: 'torso_hip_cross_view_correspondence', name: 'Hip Level' },
    {
      frontObservation: { spanCm: 42.20, level: { yCm: 86.25 } },
      sideObservation: { spanCm: 27.70, level: { yCm: 86.25 } },
      provenance: { frontLevelYcm: 86.25 },
    },
    { pairedStatus: 'eligible', frontMetricSpanCm: 42.20, sideMetricSpanCm: 27.70 },
    {
      status: 'qualified',
      qualifiedDepthEstimateCm: 27.70,
      levelYcm: 86.25,
    },
    {
      status: 'qualified',
    },
  );

  assert.equal(html.includes('Hip Level'), true);
  assert.equal(html.includes('Front Transverse Width'), true);
  assert.equal(html.includes('42.20 cm') || html.includes('42.2 cm'), true);
  assert.equal(html.includes('Side Profile Span'), false);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('27.70 cm') || html.includes('27.7 cm'), true);
  assert.equal(html.includes('Cross-Section Evidence'), true);
  assert.equal(html.includes('QUALIFIED'), true);
  assert.equal(html.includes('Qualified'), true);
});

test('derivedMeasurementDeck: blocked/disqualified AP Depth renders dash and reason hint without rendering Side Profile Span in Results', () => {
  const html = buildDerivedMeasurementCardHtml(
    { id: 'torso_shoulder_cross_view_correspondence', name: 'Shoulder Level' },
    {
      frontObservation: { spanCm: 30.80, level: { yCm: 132.85 } },
      sideObservation: { spanCm: 11.00, level: { yCm: 132.85 } },
      provenance: { frontLevelYcm: 132.85 },
    },
    { pairedStatus: 'blocked', frontMetricSpanCm: 30.80, sideMetricSpanCm: 11.00 },
    {
      status: 'disqualified',
      qualifiedDepthEstimateCm: null,
      issues: ['Side pose does not qualify as T-pose: Left arm is significantly lowered.'],
    },
    {
      status: 'blocked',
    },
  );

  assert.equal(html.includes('Shoulder Level'), true);
  // Side Profile Span row is not rendered in Results cards
  assert.equal(html.includes('Side Profile Span'), false);
  // Side AP Depth is dashed
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('—'), true);
  // Shows short human-readable reason
  assert.equal(html.includes('Side pose not qualified'), true);
  assert.equal(html.includes('Cross-Section Evidence'), true);
  assert.equal(html.includes('BLOCKED'), true);
});

test('derivedMeasurementDeck: 44.2° projected elbow advisory does NOT cause Results to revert to blocked when Side Physical Depth remains qualified', () => {
  const html = buildDerivedMeasurementCardHtml(
    { id: 'torso_shoulder_cross_view_correspondence', name: 'Shoulder Level' },
    {
      frontObservation: { spanCm: 30.80, level: { yCm: 132.85 } },
      sideObservation: { spanCm: 11.00, level: { yCm: 132.85 } },
      provenance: { frontLevelYcm: 132.85 },
    },
    { pairedStatus: 'eligible', frontMetricSpanCm: 30.80, sideMetricSpanCm: 11.00 },
    {
      status: 'qualified',
      qualifiedDepthEstimateCm: 11.00,
      levelYcm: 132.85,
      warnings: ['Side pose qualifies as T-pose with advisory note: Left projected elbow deviation of 44.2° is in advisory warning range (30°–45°).'],
    },
    {
      status: 'qualified',
      warnings: ['Side pose qualifies as T-pose with advisory note: Left projected elbow deviation of 44.2° is in advisory warning range (30°–45°).'],
    },
  );

  assert.equal(html.includes('30.80 cm') || html.includes('30.8 cm'), true);
  assert.equal(html.includes('11.00 cm') || html.includes('11.0 cm') || html.includes('11 cm'), true);
  assert.equal(html.includes('QUALIFIED'), true);
  assert.equal(html.includes('Side Profile Span'), false);
  assert.equal(html.includes('Lateral evidence insufficient'), false);
});

test('derivedMeasurementDeck: consistency between Advanced QA and Results card evidence', () => {
  const shoulderQual = {
    status: 'qualified',
    qualifiedDepthEstimateCm: 11.00,
    levelYcm: 132.85,
  };
  const shoulderCrossSection = {
    status: 'qualified',
    frontObservation: { transverseWidthCm: 30.80 },
    sideObservation: { apDepthCm: 11.00 },
  };

  const resultsHtml = buildDerivedMeasurementCardHtml(
    { id: 'torso_shoulder_cross_view_correspondence', name: 'Shoulder Level' },
    {
      frontObservation: { spanCm: 30.80, level: { yCm: 132.85 } },
      sideObservation: { spanCm: 11.00, level: { yCm: 132.85 } },
      provenance: { frontLevelYcm: 132.85 },
    },
    null,
    shoulderQual,
    shoulderCrossSection,
  );

  assert.equal(resultsHtml.includes('11.00 cm') || resultsHtml.includes('11.0 cm') || resultsHtml.includes('11 cm'), true);
  assert.equal(resultsHtml.includes('30.80 cm') || resultsHtml.includes('30.8 cm'), true);
  assert.equal(resultsHtml.includes('QUALIFIED'), true);
});

test('derivedMeasurementDeck: underlying Side Profile Span evidence contract remains available internally', async () => {
  const { getSideProfileSpan, getSideProfileSpans } = await import('../features/bodyEvidence.js');
  assert.equal(typeof getSideProfileSpan, 'function');
  assert.equal(typeof getSideProfileSpans, 'function');
});

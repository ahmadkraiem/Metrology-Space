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
  assert.equal(html.includes('Side Profile Span'), true);
  assert.equal(html.includes('38.25 cm') || html.includes('38.3 cm') || html.includes('38.2 cm'), true);
  assert.equal(html.includes('21.5 cm') || html.includes('21.50 cm'), true);
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
  assert.equal(/depth/i.test(html), false);
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

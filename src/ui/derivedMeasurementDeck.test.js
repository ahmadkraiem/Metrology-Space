import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  MEASUREMENT_TYPE_RESULT_CATEGORY_IDS,
  MEASUREMENT_TYPE_RESULT_CATEGORIES,
  buildCompactMeasurementRowHtml,
  buildDerivedMeasurementCardHtml,
  buildDirectMeasurementRowHtml,
  buildDirectMeasurementsGroupHtml,
  buildFrontTransverseWidthCardHtml,
  buildModeledBustCircumferenceCardHtml,
  buildModeledAbdominalCircumferenceCardHtml,
  buildModeledHipSeatCircumferenceCardHtml,
  buildModeledNaturalWaistCircumferenceCardHtml,
  buildModeledPerimeterCardHtml,
  clearSelectedMeasurement,
  deriveMeasurementCardStatus,
  getMeasurementRecordById,
  getSelectedMeasurementId,
  renderDerivedMeasurementDeck,
  selectMeasurement,
} from './derivedMeasurementDeck.js';
import {
  analyzeLoadedBodyEvidence,
  clearBodyEvidence,
  setBodyEvidencePackage,
} from '../features/bodyEvidence.js';
import { restoreAnnotations } from '../features/annotations.js';
import { buildBodyEvidencePackage } from '../features/bodyEvidencePackage.js';

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
  assert.equal(html.includes('derived-card-level'), false, 'Header Y badge is removed from card header');
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

test('derivedMeasurementDeck: buildDirectMeasurementsGroupHtml renders clean group cards with formatted values and status badges', () => {
  const measurements = [
    { id: 'vertical_torso_length_neck_to_hip', displayName: 'Vertical Torso Length', status: 'valid', valueCm: 46.60 },
    { id: 'vertical_shoulder_drop_neck_to_shoulder', displayName: 'Vertical Shoulder Drop', status: 'valid', valueCm: 17.15 },
    { id: 'vertical_thigh_length_hip_to_knee', displayName: 'Vertical Thigh Length', status: 'unavailable', valueCm: null },
  ];

  const html = buildDirectMeasurementsGroupHtml('Vertical Measurements', measurements);

  assert.equal(html.includes('Vertical Measurements'), true);
  assert.equal(html.includes('2/3 Ready'), true);
  assert.equal(html.includes('Vertical Torso Length'), true);
  assert.equal(html.includes('46.60 cm') || html.includes('46.6 cm'), true);
  assert.equal(html.includes('Vertical Shoulder Drop'), true);
  assert.equal(html.includes('17.15 cm'), true);
  assert.equal(html.includes('Vertical Thigh Length'), true);
  assert.equal(html.includes('—'), true);
  assert.equal(html.includes('Valid'), true);
  assert.equal(html.includes('Unavailable'), true);
});

test('derivedMeasurementDeck: getDirectBodyMeasurements getter is exported and functional', async () => {
  const { getDirectBodyMeasurement, getDirectBodyMeasurements } = await import('../features/bodyEvidence.js');
  assert.equal(typeof getDirectBodyMeasurement, 'function');
  assert.equal(typeof getDirectBodyMeasurements, 'function');
});

test('derivedMeasurementDeck: buildDirectMeasurementsGroupHtml renders collapsible group cards with data-collapsible, data-collapsed, and is-collapsed by default', () => {
  const measurements = [
    { id: 'left_upper_arm_segment_length_projected', displayName: 'Left Upper Arm Length', status: 'valid', valueCm: 26.93 },
    { id: 'right_upper_arm_segment_length_projected', displayName: 'Right Upper Arm Length', status: 'valid', valueCm: 29.15 },
  ];

  const html = buildDirectMeasurementsGroupHtml('arm_segments', 'Arm Segments', measurements, false);

  assert.equal(html.includes('data-collapsible'), true);
  assert.equal(html.includes('data-collapsed'), true);
  assert.equal(html.includes('is-collapsed'), true);
  assert.equal(html.includes('derived-card-header--collapsible'), true);
  assert.equal(html.includes('Arm Segments'), true);
  assert.equal(html.includes('2/2 Ready'), true);
});

test('derivedMeasurementDeck: initCollapsibleSections wires and toggles direct-measurement-group-card', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  const headerAttrs = {};
  const listeners = {};
  const header = {
    classList: {
      classes: new Set(['derived-card-header']),
      add(cls) { this.classes.add(cls); },
      contains(cls) { return this.classes.has(cls); },
    },
    setAttribute(k, v) { headerAttrs[k] = String(v); },
    getAttribute(k) { return headerAttrs[k] ?? null; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn();
    },
  };

  const sectionClasses = new Set(['derived-measurement-card', 'direct-measurement-group-card', 'is-collapsed']);
  const sectionAttrs = new Set(['data-collapsible', 'data-collapsed']);
  const groupSection = {
    classList: {
      classes: sectionClasses,
      add(cls) { sectionClasses.add(cls); },
      contains(cls) { return sectionClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !sectionClasses.has(cls) : Boolean(force);
        if (should) sectionClasses.add(cls);
        else sectionClasses.delete(cls);
      },
    },
    hasAttribute(name) { return sectionAttrs.has(name); },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .derived-card-header') return header;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(groupSection);

  // Starts collapsed
  assert.equal(groupSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
  assert.equal(header.getAttribute('role'), 'button');
  assert.equal(header.getAttribute('tabindex'), '0');

  // Click to expand
  header.click();
  assert.equal(groupSection.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');

  // Click to collapse
  header.click();
  assert.equal(groupSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
});

test('derivedMeasurementDeck: right sidebar markup places derived-measurement-deck inside sidebar-scroll alongside session-records-panel and diagnostics-panel', () => {
  const rightSidebarStart = markup.indexOf('id="right-sidebar"');
  const rightSidebarEnd = markup.indexOf('</aside>', rightSidebarStart);
  assert.ok(rightSidebarStart > -1 && rightSidebarEnd > rightSidebarStart, 'right-sidebar must exist');

  const rightSidebarContent = markup.slice(rightSidebarStart, rightSidebarEnd);
  const scrollStart = rightSidebarContent.indexOf('class="sidebar-scroll"');
  assert.ok(scrollStart > -1, 'sidebar-scroll must exist within right-sidebar');

  const scrollContent = rightSidebarContent.slice(scrollStart);
  assert.equal(scrollContent.includes('id="derived-measurement-deck"'), true, 'Results deck must be inside sidebar-scroll');
  assert.equal(scrollContent.includes('id="session-records-panel"'), true, 'Session Records must be inside sidebar-scroll');
  assert.equal(scrollContent.includes('id="diagnostics-panel"'), true, 'Diagnostics must be inside sidebar-scroll');
});

test('derivedMeasurementDeck: Top-level Results deck is collapsible, collapsed by default, and updates aria-expanded on click', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  const headerAttrs = {};
  const listeners = {};
  const header = {
    classList: {
      classes: new Set(['deck-header']),
      add(cls) { this.classes.add(cls); },
      contains(cls) { return this.classes.has(cls); },
    },
    setAttribute(k, v) { headerAttrs[k] = String(v); },
    getAttribute(k) { return headerAttrs[k] ?? null; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn();
    },
  };

  const deckClasses = new Set(['derived-measurement-deck', 'inspector-section']);
  const deckAttrs = new Set(['data-collapsible', 'data-collapsed']);
  const deckSection = {
    classList: {
      classes: deckClasses,
      add(cls) { deckClasses.add(cls); },
      contains(cls) { return deckClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !deckClasses.has(cls) : Boolean(force);
        if (should) deckClasses.add(cls);
        else deckClasses.delete(cls);
      },
    },
    hasAttribute(name) { return deckAttrs.has(name); },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .deck-header') return header;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(deckSection);

  // Starts collapsed by default
  assert.equal(deckSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
  assert.equal(header.getAttribute('role'), 'button');
  assert.equal(header.getAttribute('tabindex'), '0');

  // Click to expand
  header.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');

  // Click to collapse
  header.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
});

test('derivedMeasurementDeck: Cross-Section Evidence is collapsible, collapsed by default, and toggles Shoulder and Hip cards together', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  const headerAttrs = {};
  const listeners = {};
  const header = {
    classList: {
      classes: new Set(['results-subgroup-header']),
      add(cls) { this.classes.add(cls); },
      contains(cls) { return this.classes.has(cls); },
    },
    setAttribute(k, v) { headerAttrs[k] = String(v); },
    getAttribute(k) { return headerAttrs[k] ?? null; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn();
    },
  };

  const sectionClasses = new Set(['results-subgroup', 'results-subgroup--cross-section']);
  const sectionAttrs = new Set(['data-collapsible', 'data-collapsed']);
  const csSection = {
    classList: {
      classes: sectionClasses,
      add(cls) { sectionClasses.add(cls); },
      contains(cls) { return sectionClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !sectionClasses.has(cls) : Boolean(force);
        if (should) sectionClasses.add(cls);
        else sectionClasses.delete(cls);
      },
    },
    hasAttribute(name) { return sectionAttrs.has(name); },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .results-subgroup-header') return header;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(csSection);

  // Starts collapsed by default
  assert.equal(csSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
  assert.equal(header.getAttribute('role'), 'button');
  assert.equal(header.getAttribute('tabindex'), '0');

  // Click to expand
  header.click();
  assert.equal(csSection.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');

  // Click to collapse
  header.click();
  assert.equal(csSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
});

test('derivedMeasurementDeck: Cross-Section Evidence subgroup structure wraps Shoulder and Hip cards', () => {
  const shoulderCard = buildDerivedMeasurementCardHtml(
    { id: 'torso_shoulder_cross_view_correspondence', name: 'Shoulder Level' },
    null,
    { pairedStatus: 'unavailable' },
  );
  const hipCard = buildDerivedMeasurementCardHtml(
    { id: 'torso_hip_cross_view_correspondence', name: 'Hip Level' },
    null,
    { pairedStatus: 'unavailable' },
  );

  assert.equal(shoulderCard.includes('Shoulder Level'), true);
  assert.equal(hipCard.includes('Hip Level'), true);
  assert.equal(shoulderCard.includes('derived-measurement-card'), true);
  assert.equal(hipCard.includes('derived-measurement-card'), true);
});

test('derivedMeasurementDeck: Direct Measurements is a parent collapsible subgroup, collapsed by default, and expands/collapses', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  const headerAttrs = {};
  const listeners = {};
  const header = {
    classList: {
      classes: new Set(['results-subgroup-header']),
      add(cls) { this.classes.add(cls); },
      contains(cls) { return this.classes.has(cls); },
    },
    setAttribute(k, v) { headerAttrs[k] = String(v); },
    getAttribute(k) { return headerAttrs[k] ?? null; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn();
    },
  };

  const sectionClasses = new Set(['results-subgroup', 'results-subgroup--direct', 'is-collapsed']);
  const sectionAttrs = new Set(['data-collapsible', 'data-collapsed']);
  const directSection = {
    classList: {
      classes: sectionClasses,
      add(cls) { sectionClasses.add(cls); },
      contains(cls) { return sectionClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !sectionClasses.has(cls) : Boolean(force);
        if (should) sectionClasses.add(cls);
        else sectionClasses.delete(cls);
      },
    },
    hasAttribute(name) { return sectionAttrs.has(name); },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .results-subgroup-header') return header;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(directSection);

  // Starts collapsed by default
  assert.equal(directSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
  assert.equal(header.getAttribute('role'), 'button');
  assert.equal(header.getAttribute('tabindex'), '0');

  // Click to expand
  header.click();
  assert.equal(directSection.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');

  // Click to collapse
  header.click();
  assert.equal(directSection.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
});

test('derivedMeasurementDeck: nested child toggle calls stopPropagation and does not bubble to parent', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  let childStopPropagationCalled = false;
  const childListeners = {};
  const childHeader = {
    classList: {
      classes: new Set(['derived-card-header']),
      add(cls) { this.classes.add(cls); },
      contains(cls) { return this.classes.has(cls); },
    },
    setAttribute() { },
    getAttribute() { return 'false'; },
    addEventListener(type, fn) {
      childListeners[type] = childListeners[type] || [];
      childListeners[type].push(fn);
    },
    click() {
      const event = {
        stopPropagation() { childStopPropagationCalled = true; },
      };
      for (const fn of childListeners.click || []) fn(event);
    },
  };

  const childSectionClasses = new Set(['derived-measurement-card', 'direct-measurement-group-card', 'is-collapsed']);
  const childSection = {
    classList: {
      classes: childSectionClasses,
      add(cls) { childSectionClasses.add(cls); },
      contains(cls) { return childSectionClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !childSectionClasses.has(cls) : Boolean(force);
        if (should) childSectionClasses.add(cls);
        else childSectionClasses.delete(cls);
      },
    },
    hasAttribute(name) { return name === 'data-collapsible' || name === 'data-collapsed'; },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .derived-card-header') return childHeader;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(childSection);

  childHeader.click();
  assert.equal(childStopPropagationCalled, true, 'Clicking child header must stop event propagation');
  assert.equal(childSection.classList.contains('is-collapsed'), false);
});

test('derivedMeasurementDeck: runtime scenario - Results toggle sequence with nested subgroups and rerenders', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  function createElement(tag, initialClasses = [], attrs = {}) {
    const classSet = new Set(initialClasses);
    const attributes = { ...attrs };
    const eventListeners = {};
    const children = [];

    const el = {
      tagName: tag.toUpperCase(),
      classList: {
        classes: classSet,
        add(cls) { classSet.add(cls); },
        remove(cls) { classSet.delete(cls); },
        contains(cls) { return classSet.has(cls); },
        toggle(cls, force) {
          const should = force === undefined ? !classSet.has(cls) : Boolean(force);
          if (should) classSet.add(cls);
          else classSet.delete(cls);
        },
      },
      hasAttribute(name) { return name in attributes; },
      getAttribute(name) { return attributes[name] ?? null; },
      setAttribute(name, val) { attributes[name] = String(val); },
      removeAttribute(name) { delete attributes[name]; },
      addEventListener(type, fn) {
        eventListeners[type] = eventListeners[type] || [];
        eventListeners[type].push(fn);
      },
      click() {
        let propagationStopped = false;
        const ev = {
          stopPropagation() { propagationStopped = true; },
          preventDefault() { },
        };
        for (const fn of eventListeners.click || []) {
          fn(ev);
        }
      },
      matches(selector) {
        if (selector === '[data-collapsible]') return el.hasAttribute('data-collapsible');
        return false;
      },
      querySelector(selector) {
        for (const child of children) {
          if (selector === ':scope > .deck-header' && child.classList.contains('deck-header')) return child;
          if (selector === ':scope > .section-title' && child.classList.contains('section-title')) return child;
          if (selector === ':scope > .results-subgroup-header' && child.classList.contains('results-subgroup-header')) return child;
          if (selector === ':scope > .derived-card-header' && child.classList.contains('derived-card-header')) return child;
        }
        return null;
      },
      querySelectorAll(selector) {
        const matches = [];
        function scan(node) {
          for (const c of node.children || []) {
            if (selector === '[data-collapsible]' && c.hasAttribute('data-collapsible')) {
              matches.push(c);
            }
            if (selector === '[data-collapsible][data-group-id]' && c.hasAttribute('data-collapsible') && c.hasAttribute('data-group-id')) {
              matches.push(c);
            }
            scan(c);
          }
        }
        scan(el);
        return matches;
      },
      appendChild(child) {
        child.parentElement = el;
        children.push(child);
        return child;
      },
      children,
    };
    return el;
  }

  // 1. Build DOM matching index.html
  const deckSection = createElement('section', ['derived-measurement-deck', 'inspector-section'], {
    'data-collapsible': '',
    'aria-label': 'Results',
  });
  const deckHeader = createElement('div', ['deck-header']);
  const deckCards = createElement('div', ['derived-measurement-cards', 'section-body']);
  deckSection.appendChild(deckHeader);
  deckSection.appendChild(deckCards);

  // 2. Build Cross-Section Evidence subgroup inside deckCards
  const csSubgroup = createElement('div', ['results-subgroup', 'results-subgroup--cross-section'], {
    'data-collapsible': '',
    'data-group-id': 'cross_section_evidence',
  });
  const csHeader = createElement('div', ['results-subgroup-header', 'results-subgroup-header--collapsible']);
  const csBody = createElement('div', ['results-subgroup-body']);
  csSubgroup.appendChild(csHeader);
  csSubgroup.appendChild(csBody);
  deckCards.appendChild(csSubgroup);

  // 3. Build Direct Measurements subgroup inside deckCards
  const directSubgroup = createElement('div', ['results-subgroup', 'results-subgroup--direct', 'is-collapsed'], {
    'data-collapsible': '',
    'data-collapsed': '',
    'data-group-id': 'direct_measurements',
  });
  const directHeader = createElement('div', ['results-subgroup-header', 'results-subgroup-header--collapsible']);
  const directBody = createElement('div', ['results-subgroup-body']);
  directSubgroup.appendChild(directHeader);
  directSubgroup.appendChild(directBody);
  deckCards.appendChild(directSubgroup);

  // Initialize
  initCollapsibleSections(deckSection);

  // 1. Initial state: Results expanded
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results starts expanded');
  assert.equal(deckHeader.getAttribute('aria-expanded'), 'true');
  assert.equal(csSubgroup.classList.contains('is-collapsed'), false, 'Cross-section starts expanded');
  assert.equal(directSubgroup.classList.contains('is-collapsed'), true, 'Direct starts collapsed');

  // 2. Click RESULTS: Results collapsed
  deckHeader.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), true, 'Results collapsed after click');
  assert.equal(deckHeader.getAttribute('aria-expanded'), 'false');

  // 3. Click RESULTS: Results expanded
  deckHeader.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results expanded after second click');
  assert.equal(deckHeader.getAttribute('aria-expanded'), 'true');

  // 4. Toggle Cross-Section: collapse then expand
  csHeader.click();
  assert.equal(csSubgroup.classList.contains('is-collapsed'), true, 'Cross-section collapsed');
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results still expanded');

  csHeader.click();
  assert.equal(csSubgroup.classList.contains('is-collapsed'), false, 'Cross-section expanded again');
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results still expanded');

  // 5. Expand Direct Measurements
  directHeader.click();
  assert.equal(directSubgroup.classList.contains('is-collapsed'), false, 'Direct measurements expanded');
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results still expanded');

  // 6. Click RESULTS: Results collapsed
  deckHeader.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), true, 'Results collapsed');
  assert.equal(deckHeader.getAttribute('aria-expanded'), 'false');

  // 7. Click RESULTS: Results expanded and Direct remains expanded
  deckHeader.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results expanded');
  assert.equal(deckHeader.getAttribute('aria-expanded'), 'true');
  assert.equal(directSubgroup.classList.contains('is-collapsed'), false, 'Direct measurements preserved expanded');

  // 8. Subsequent child wiring on containerEl does not break top-level Results
  initCollapsibleSections(deckCards);
  deckHeader.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), true, 'Results collapses after child re-init');
  deckHeader.click();
  assert.equal(deckSection.classList.contains('is-collapsed'), false, 'Results expands after child re-init');
});

test('derivedMeasurementDeck: hit target test - visible Results header and children receive pointer interaction and toggle section', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  const headerListeners = [];

  const textSpan = {
    tagName: 'SPAN',
    classList: {
      contains(cls) { return cls === 'deck-title'; },
    },
    click() {
      // Event bubbles to header
      header.click();
    },
  };

  const headerClasses = new Set(['deck-header']);
  const headerAttrs = {
    role: 'button',
    tabindex: '0',
    'aria-expanded': 'true',
  };

  const header = {
    tagName: 'DIV',
    classList: {
      classes: headerClasses,
      add(cls) { headerClasses.add(cls); },
      contains(cls) { return headerClasses.has(cls); },
    },
    setAttribute(k, v) { headerAttrs[k] = String(v); },
    getAttribute(k) { return headerAttrs[k] ?? null; },
    addEventListener(type, fn) {
      if (type === 'click') headerListeners.push(fn);
    },
    click() {
      const ev = {
        stopPropagation() { },
        preventDefault() { },
      };
      for (const fn of headerListeners) fn(ev);
    },
    children: [textSpan],
  };

  const sectionClasses = new Set(['derived-measurement-deck', 'inspector-section']);
  const section = {
    tagName: 'SECTION',
    classList: {
      classes: sectionClasses,
      add(cls) { sectionClasses.add(cls); },
      contains(cls) { return sectionClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !sectionClasses.has(cls) : Boolean(force);
        if (should) sectionClasses.add(cls);
        else sectionClasses.delete(cls);
      },
    },
    hasAttribute(name) { return name === 'data-collapsible'; },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .deck-header') return header;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(section);

  // 1. Initial expanded state
  assert.equal(section.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');
  assert.equal(header.classList.contains('deck-header--collapsible'), true);

  // 2. Clicking the text label bubbles to header and collapses
  textSpan.click();
  assert.equal(section.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');

  // 3. Clicking the header row / whitespace expands
  header.click();
  assert.equal(section.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');

  // 4. CSS inspection check: verify .deck-header has cursor: pointer and pointer-events: auto
  const css = readFileSync(
    fileURLToPath(new URL('../styles/components.css', import.meta.url)),
    'utf8',
  );
  assert.match(css, /\.deck-header\s*\{[^}]*cursor:\s*pointer/);
  assert.match(css, /\.deck-header\s*\{[^}]*pointer-events:\s*auto/);
});

test('derivedMeasurementDeck: buildModeledPerimeterCardHtml renders Hip Landmark Perimeter Estimate with formatted 110.98 cm and Modeled badge', () => {
  const mockModeledResult = {
    contract: 'modeled-cross-section-perimeter-v0',
    version: 'modeled-cross-section-perimeter-v0',
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    name: 'Torso Modeled Perimeter Estimate at Hip Landmark Level',
    sourceLevel: 'hip',
    levelYcm: 86.25,
    status: 'modeled',
    isModeled: true,
    isQualified: true,
    valueCm: 110.9830618865289,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      semiMajorAxisCm: 21.1,
      semiMinorAxisCm: 13.85,
      transverseWidthCm: 42.2,
      apDepthCm: 27.7,
      hParameter: 0.04303102122181495,
    },
    provenance: {
      sourceCrossSectionContract: 'cross-section-evidence-v0',
      sourceCrossSectionId: 'torso_cross_section_evidence_at_hip_level',
      sourceLevel: 'hip',
      levelYcm: 86.25,
    },
    semantics: {
      statement: 'Pure deterministic ellipse-modeled perimeter estimate at hip landmark level. NOT measured contour length, NOT 3D slice, NOT canonical Z, NOT anthropometric Hip Circumference, NOT maximum Hip/Seat Circumference, NOT maximum buttock plane.',
      isModeledQuantity: true,
      isMeasuredContour: false,
      isAnthropometricHipCircumference: false,
      isMaximumSeatPlane: false,
      is3dReconstruction: false,
      isBodyVolume: false,
    },
  };

  const html = buildModeledPerimeterCardHtml(mockModeledResult);

  // 1. Primary visible title
  assert.equal(html.includes('Hip Landmark Perimeter Estimate'), true);

  // 2. Modeled badge
  assert.equal(html.includes('Modeled'), true);
  assert.equal(html.includes('derived-card-level'), false, 'Header Y badge is removed');

  // 3. Formatted perimeter value
  assert.equal(html.includes('110.98 cm'), true);

  // 4. Model and reference level rows
  assert.equal(html.includes('Model Implementation'), true);
  assert.equal(html.includes('Ellipse (Ramanujan II)'), true);
  assert.equal(html.includes('Reference Level'), true);
  assert.equal(html.includes('Hip Landmark Level'), true);

  // 5. Notes and explicit qualification
  assert.equal(html.includes('Ellipse-modeled perimeter from qualified Front width + Side AP depth.'), true);
  assert.equal(html.includes('Not anthropometric Hip Circumference.'), true);

  // 6. Horizontal primary row and stacked metadata row classes
  assert.equal(html.includes('modeled-perimeter-primary-row'), true);
  assert.equal(html.includes('modeled-perimeter-meta-row'), true);
  assert.equal(html.includes('modeled-perimeter-label'), true);
  assert.equal(html.includes('modeled-perimeter-value'), true);

  // 7. CSS inspection: verify horizontal primary row and stacked metadata layout rules
  const css = readFileSync(
    fileURLToPath(new URL('../styles/components.css', import.meta.url)),
    'utf8',
  );
  assert.match(css, /\.modeled-perimeter-primary-row\s*\{[^}]*justify-content:\s*space-between/);
  assert.match(css, /\.modeled-perimeter-meta-row\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css, /\.modeled-perimeter-meta-row \.modeled-perimeter-value\s*\{[^}]*text-align:\s*left/);

  // 8. Naming guardrail: primary title is NOT Hip Circumference or Hip Girth
  assert.equal(html.includes('<span class="derived-card-title">Hip Circumference</span>'), false);
  assert.equal(html.includes('<span class="derived-card-title">Hip Girth</span>'), false);
  assert.equal(html.includes('<span class="derived-card-title">Maximum Hip Circumference</span>'), false);
});

test('derivedMeasurementDeck: buildModeledPerimeterCardHtml value is derived from runtime inputs, not hardcoded', () => {
  const mockDynamicResult = {
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    sourceLevel: 'hip',
    levelYcm: 90.0,
    status: 'modeled',
    valueCm: 125.456,
  };

  const html = buildModeledPerimeterCardHtml(mockDynamicResult);
  assert.equal(html.includes('125.46 cm'), true);
  assert.equal(html.includes('110.98 cm'), false);
});

test('derivedMeasurementDeck: buildModeledPerimeterCardHtml handles blocked, unavailable, and invalid states with dash', () => {
  const blockedHtml = buildModeledPerimeterCardHtml({
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    sourceLevel: 'hip',
    status: 'blocked',
    valueCm: null,
  });
  assert.equal(blockedHtml.includes('Blocked'), true);
  assert.equal(blockedHtml.includes('—'), true);
  assert.equal(blockedHtml.includes('cm'), false);

  const unavailHtml = buildModeledPerimeterCardHtml({
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    sourceLevel: 'hip',
    status: 'unavailable',
    valueCm: null,
  });
  assert.equal(unavailHtml.includes('Unavailable'), true);
  assert.equal(unavailHtml.includes('—'), true);

  const invalidHtml = buildModeledPerimeterCardHtml({
    id: 'torso_modeled_perimeter_at_hip_landmark_level',
    sourceLevel: 'hip',
    status: 'invalid',
    valueCm: null,
  });
  assert.equal(invalidHtml.includes('Invalid'), true);
  assert.equal(invalidHtml.includes('—'), true);

  // Null input returns empty string
  assert.equal(buildModeledPerimeterCardHtml(null), '');
});

test('derivedMeasurementDeck: Modeled Perimeter Estimates subgroup supports collapsible toggle', async () => {
  const { initCollapsibleSections } = await import('./collapsibleSections.js');

  const headerAttrs = {};
  const listeners = {};
  const header = {
    classList: {
      classes: new Set(['results-subgroup-header']),
      add(cls) { this.classes.add(cls); },
      contains(cls) { return this.classes.has(cls); },
    },
    setAttribute(k, v) { headerAttrs[k] = String(v); },
    getAttribute(k) { return headerAttrs[k] ?? null; },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn();
    },
  };

  const sectionClasses = new Set(['results-subgroup', 'results-subgroup--modeled-perimeter']);
  const sectionAttrs = new Set(['data-collapsible', 'data-collapsed']);
  const section = {
    classList: {
      classes: sectionClasses,
      add(cls) { sectionClasses.add(cls); },
      contains(cls) { return sectionClasses.has(cls); },
      toggle(cls, force) {
        const should = force === undefined ? !sectionClasses.has(cls) : Boolean(force);
        if (should) sectionClasses.add(cls);
        else sectionClasses.delete(cls);
      },
    },
    hasAttribute(name) { return sectionAttrs.has(name); },
    matches(selector) { return selector === '[data-collapsible]'; },
    querySelector(selector) {
      if (selector === ':scope > .results-subgroup-header') return header;
      return null;
    },
    querySelectorAll() { return []; },
  };

  initCollapsibleSections(section);

  // Starts collapsed by default
  assert.equal(section.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');

  // Click to expand
  header.click();
  assert.equal(section.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');

  // Click to collapse
  header.click();
  assert.equal(section.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
});

test('derivedMeasurementDeck: guardrail verifies no domain formula is duplicated in UI code', () => {
  const uiSource = readFileSync(
    fileURLToPath(new URL('./derivedMeasurementDeck.js', import.meta.url)),
    'utf8',
  );

  // UI must NOT contain ellipse formulas or math implementations
  assert.equal(/ramanujan/i.test(uiSource) && uiSource.includes('Math.sqrt'), false, 'UI must not compute Ramanujan formula');
  assert.equal(uiSource.includes('Math.PI'), false, 'UI must not use Math.PI');
  assert.equal(uiSource.includes('** 2'), false, 'UI must not perform axis exponentiation');
});

test('derivedMeasurementDeck: Shoulder perimeter card is never rendered', () => {
  const shoulderNullHtml = buildModeledPerimeterCardHtml(null);
  assert.equal(shoulderNullHtml, '');

  const shoulderInvalidObj = {
    id: 'torso_modeled_perimeter_at_shoulder_level',
    sourceLevel: 'shoulder',
    status: 'invalid',
    valueCm: null,
  };
  const shoulderInvalidHtml = buildModeledPerimeterCardHtml(shoulderInvalidObj);
  assert.equal(shoulderInvalidHtml.includes('Shoulder Landmark Perimeter Estimate'), false);
  assert.equal(shoulderInvalidHtml.includes('Shoulder Circumference'), false);
  assert.equal(shoulderInvalidHtml.includes('—'), true);
});

test('derivedMeasurementDeck: Hip/Seat card remains the production-facing modeled circumference result', () => {
  const html = buildModeledHipSeatCircumferenceCardHtml({
    contract: 'modeled-hip-seat-circumference-v0',
    id: 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane',
    name: 'Modeled Hip Circumference',
    status: 'modeled',
    valueCm: 114.1959,
    levelYcm: 79.95,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      transverseWidthCm: 44.3,
      apDepthCm: 27.4,
    },
    provenance: {
      selectedYcm: 79.95,
      frontTransverseWidthCm: 44.3,
      sideQualifiedApDepthCm: 27.4,
    },
  });

  assert.equal(html.includes('Modeled Maximum Seat Circumference'), true);
  assert.equal(html.includes('data-measurement-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"'), true);
  assert.equal(html.includes('Circumference Estimate'), true);
  assert.equal(html.includes('114.20 cm'), true);
  assert.equal(html.includes('Seat Plane Y'), true);
  assert.equal(html.includes('79.95 cm'), true);
  assert.equal(html.includes('Front Width'), true);
  assert.equal(html.includes('44.30 cm'), true);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('27.40 cm'), true);
  assert.equal(html.includes('Ellipse (Ramanujan II)'), true);
  assert.equal(html.includes('Modeled estimate; not tape-measured ground truth.'), true);
  assert.equal(html.includes('Hip Landmark Perimeter Estimate'), false);
});

test('derivedMeasurementDeck: Hip/Seat card width and depth are runtime fields, not hardcoded', () => {
  const html = buildModeledHipSeatCircumferenceCardHtml({
    id: 'torso_modeled_hip_seat_circumference_at_maximum_seat_plane',
    status: 'modeled',
    valueCm: 101.25,
    levelYcm: 82.4,
    model: {
      transverseWidthCm: 40.12,
      apDepthCm: 22.08,
    },
  });

  assert.equal(html.includes('101.25 cm'), true);
  assert.equal(html.includes('40.12 cm'), true);
  assert.equal(html.includes('22.08 cm'), true);
  assert.equal(html.includes('114.20 cm'), false);
  assert.equal(html.includes('44.30 cm'), false);
  assert.equal(html.includes('27.40 cm'), false);
});

test('derivedMeasurementDeck: standard Results renderer keeps Hip/Seat card and omits Hip Landmark Perimeter card', () => {
  const uiSource = readFileSync(
    fileURLToPath(new URL('./derivedMeasurementDeck.js', import.meta.url)),
    'utf8',
  );
  const renderStart = uiSource.indexOf('export function renderDerivedMeasurementDeck');
  const setupStart = uiSource.indexOf('export function setupDerivedMeasurementDeck');
  assert.ok(renderStart > -1 && setupStart > renderStart);
  const renderFn = uiSource.slice(renderStart, setupStart);

  assert.equal(renderFn.includes('torso_modeled_hip_seat_circumference_at_maximum_seat_plane'), true);
  assert.equal(renderFn.includes('getModeledHipSeatCircumference'), true);
  assert.equal(renderFn.includes('buildModeledPerimeterCardHtml'), false);
  assert.equal(renderFn.includes('Hip Landmark Perimeter Estimate'), false);
  assert.equal(uiSource.includes('export function buildModeledPerimeterCardHtml'), true);
});

test('derivedMeasurementDeck: Modeled Natural Waist Circumference card renders exact title, badges, Front width, Side AP depth, and disclaimers', () => {
  const html = buildModeledNaturalWaistCircumferenceCardHtml({
    id: 'torso_modeled_natural_waist_circumference_at_natural_waist_plane',
    status: 'modeled',
    valueCm: 82.35,
    levelYcm: 107.15,
    model: {
      transverseWidthCm: 29.0,
      apDepthCm: 23.2,
    },
    provenance: {
      selectedYcm: 107.15,
      frontTransverseWidthCm: 29.0,
      sideQualifiedApDepthCm: 23.2,
    },
  });

  assert.equal(html.includes('Modeled Natural Waist Circumference'), true);
  assert.equal(html.includes('data-measurement-id="torso_modeled_natural_waist_circumference_at_natural_waist_plane"'), true);
  assert.equal(html.includes('Circumference Estimate'), true);
  assert.equal(html.includes('82.35 cm'), true);
  assert.equal(html.includes('Waist Plane Y'), true);
  assert.equal(html.includes('107.15 cm'), true);
  assert.equal(html.includes('Front Width'), true);
  assert.equal(html.includes('29.00 cm'), true);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('23.20 cm'), true);
  assert.equal(html.includes('Ellipse (Ramanujan II)'), true);
  assert.equal(html.includes('Evaluated at localized Natural Waist Plane.'), true);
  assert.equal(html.includes('Modeled estimate; not tape-measured ground truth.'), true);
});

test('derivedMeasurementDeck: Natural Waist modeled circumference card builder produces dynamic runtime values', () => {
  const html = buildModeledNaturalWaistCircumferenceCardHtml({
    id: 'torso_modeled_natural_waist_circumference_at_natural_waist_plane',
    status: 'modeled',
    valueCm: 75.50,
    levelYcm: 104.2,
    model: {
      transverseWidthCm: 26.5,
      apDepthCm: 21.0,
    },
    provenance: {
      selectedYcm: 104.2,
      frontTransverseWidthCm: 26.5,
      sideQualifiedApDepthCm: 21.0,
    },
  });

  assert.equal(html.includes('75.50 cm'), true);
  assert.equal(html.includes('104.20 cm') || html.includes('104.2 cm'), true);
  assert.equal(html.includes('26.50 cm'), true);
  assert.equal(html.includes('21.00 cm'), true);
  assert.equal(html.includes('82.35 cm'), false);
});

test('derivedMeasurementDeck: full live render path includes BOTH Hip/Seat and Natural Waist cards in Modeled Perimeter Estimates section', () => {
  const width = 100;
  const height = 100;
  const frontSeg = new Uint8Array(width * height);
  const sideSeg = new Uint8Array(width * height);

  // Fill bounding body regions
  for (let y = 20; y <= 80; y++) {
    for (let x = 30; x <= 70; x++) {
      frontSeg[y * width + x] = 22; // torso
      sideSeg[y * width + x] = 22;
    }
  }

  const pkg = buildBodyEvidencePackage({
    calibration: {
      pixelsPerCm: 1,
      canvasSizePx: 100,
      coordinateSpace: 'pixel',
      origin: 'bottom_left',
      workspaceExtentCm: 100,
    },
    front: {
      image: { widthPx: 100, heightPx: 100, dataUrl: 'data:image/png;base64,' },
      segmentation: { widthPx: 100, heightPx: 100, classIndices: frontSeg },
      calibration: {
        view: 'front',
        originalWidthPx: 100,
        originalHeightPx: 100,
        scaledWidthPx: 100,
        scaledHeightPx: 100,
        scaleFactor: 1.0,
        padLeftPx: 0,
        padTopPx: 0,
        croppedWidthPx: 100,
        croppedHeightPx: 100,
      },
      pose: {
        score: 0.95,
        keypoints: [
          { name: 'neck', x: 50, y: 20 },
          { name: 'left_shoulder', x: 65, y: 30 },
          { name: 'right_shoulder', x: 35, y: 30 },
          { name: 'left_hip', x: 60, y: 70 },
          { name: 'right_hip', x: 40, y: 70 },
        ],
      },
    },
    side: {
      image: { widthPx: 100, heightPx: 100, dataUrl: 'data:image/png;base64,' },
      segmentation: { widthPx: 100, heightPx: 100, classIndices: sideSeg },
      calibration: {
        view: 'side',
        originalWidthPx: 100,
        originalHeightPx: 100,
        scaledWidthPx: 100,
        scaledHeightPx: 100,
        scaleFactor: 1.0,
        padLeftPx: 0,
        padTopPx: 0,
        croppedWidthPx: 100,
        croppedHeightPx: 100,
      },
      pose: {
        score: 0.90,
        keypoints: [
          { name: 'left_shoulder', x: 50, y: 30 },
          { name: 'left_hip', x: 50, y: 70 },
        ],
      },
    },
  });

  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  restoreAnnotations([
    { id: 1, name: 'neck', type: 'body_landmark', position: { x: 50, y: 80, z: 200 } },
    { id: 2, name: 'left_shoulder', type: 'body_landmark', position: { x: 65, y: 70, z: 200 } },
    { id: 3, name: 'right_shoulder', type: 'body_landmark', position: { x: 35, y: 70, z: 200 } },
    { id: 4, name: 'left_hip', type: 'body_landmark', position: { x: 60, y: 30, z: 200 } },
    { id: 5, name: 'right_hip', type: 'body_landmark', position: { x: 40, y: 30, z: 200 } },
  ]);

  const container = { innerHTML: '' };
  renderDerivedMeasurementDeck(container);

  // 1. All five cards must be present in the live render output
  assert.equal(
    container.innerHTML.includes('Modeled Bust Circumference'),
    true,
    'Live render must include Modeled Bust Circumference card',
  );
  assert.equal(
    container.innerHTML.includes('data-measurement-id="torso_modeled_bust_circumference_at_bust_apex_plane"'),
    true,
    'Bust card must include measurement ID',
  );
  assert.equal(
    container.innerHTML.includes('Modeled Natural Waist Circumference'),
    true,
    'Live render must include Modeled Natural Waist Circumference card',
  );
  assert.equal(
    container.innerHTML.includes('data-measurement-id="torso_modeled_natural_waist_circumference_at_natural_waist_plane"'),
    true,
    'Natural Waist card must include measurement ID',
  );
  assert.equal(
    container.innerHTML.includes('Modeled Abdominal Circumference'),
    true,
    'Live render must include Modeled Abdominal Circumference card',
  );
  assert.equal(
    container.innerHTML.includes('data-measurement-id="torso_modeled_abdominal_circumference_at_abdominal_apex_plane"'),
    true,
    'Abdominal card must include measurement ID',
  );
  assert.equal(
    container.innerHTML.includes('Modeled Hip Girth'),
    true,
    'Live render must include Modeled Hip Girth card',
  );
  assert.equal(
    container.innerHTML.includes('data-measurement-id="torso_modeled_hip_girth_at_buttock_point_plane"'),
    true,
    'Hip Girth card must include measurement ID',
  );
  assert.equal(
    container.innerHTML.includes('Modeled Maximum Seat Circumference'),
    true,
    'Live render must include Modeled Maximum Seat Circumference card',
  );
  assert.equal(
    container.innerHTML.includes('data-measurement-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"'),
    true,
    'Hip/Seat card must include measurement ID',
  );

  // 2. All five cards are inside the Circumferences & Girths category (circumferences_girths)
  const circCategoryIdx = container.innerHTML.indexOf('data-group-id="circumferences_girths"');

  assert.ok(circCategoryIdx > -1, 'Circumferences & Girths category must exist');

  const bustCardIdx = container.innerHTML.indexOf('data-measurement-id="torso_modeled_bust_circumference_at_bust_apex_plane"');
  const waistCardIdx = container.innerHTML.indexOf('data-measurement-id="torso_modeled_natural_waist_circumference_at_natural_waist_plane"');
  const abdominalCardIdx = container.innerHTML.indexOf('data-measurement-id="torso_modeled_abdominal_circumference_at_abdominal_apex_plane"');
  const hipGirthCardIdx = container.innerHTML.indexOf('data-measurement-id="torso_modeled_hip_girth_at_buttock_point_plane"');
  const seatCardIdx = container.innerHTML.indexOf('data-measurement-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"');

  assert.ok(bustCardIdx > circCategoryIdx, 'Bust card must be inside Circumferences category');
  assert.ok(waistCardIdx > bustCardIdx, 'Natural Waist card must be inside Circumferences category');
  assert.ok(abdominalCardIdx > waistCardIdx, 'Abdominal card must be inside Circumferences category');
  assert.ok(hipGirthCardIdx > abdominalCardIdx, 'Hip Girth card must be inside Circumferences category');
  assert.ok(seatCardIdx > hipGirthCardIdx, 'Maximum Seat card must be inside Circumferences category');

  // Verify old modeled_perimeter_estimates group and anatomy groups are NOT present
  assert.equal(container.innerHTML.includes('data-group-id="modeled_perimeter_estimates"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="bust_chest"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="waist_abdomen"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="hip_seat"'), false);

  // Clean up
  clearSelectedMeasurement();
  clearBodyEvidence();
  restoreAnnotations([]);
  global.document = origDoc;
});

test('derivedMeasurementDeck: Modeled Abdominal Circumference card renders exact title, badges, Front width, Side AP depth, and disclaimers', () => {
  const html = buildModeledAbdominalCircumferenceCardHtml({
    contract: 'modeled-abdominal-circumference-v0',
    id: 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane',
    name: 'Modeled Abdominal Circumference',
    status: 'modeled',
    valueCm: 100.4817,
    levelYcm: 95.75,
    model: {
      transverseWidthCm: 37.20,
      apDepthCm: 26.30,
    },
    provenance: {
      selectedYcm: 95.75,
      frontTransverseWidthCm: 37.20,
      sideQualifiedApDepthCm: 26.30,
    },
  });

  assert.equal(html.includes('Modeled Abdominal Circumference'), true);
  assert.equal(html.includes('data-measurement-id="torso_modeled_abdominal_circumference_at_abdominal_apex_plane"'), true);
  assert.equal(html.includes('Circumference Estimate'), true);
  assert.equal(html.includes('100.48 cm'), true);
  assert.equal(html.includes('Abdominal Point Plane Y'), true);
  assert.equal(html.includes('95.75 cm'), true);
  assert.equal(html.includes('Front Width'), true);
  assert.equal(html.includes('37.20 cm'), true);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('26.30 cm'), true);
  assert.equal(html.includes('Ellipse (Ramanujan II)'), true);
  assert.equal(html.includes('Evaluated at localized Abdominal Point Plane.'), true);
  assert.equal(html.includes('Modeled estimate; not tape-measured ground truth.'), true);
  assert.equal(html.includes('body-evidence-badge--ok'), true);
  assert.equal(html.includes('Modeled'), true);
});

test('derivedMeasurementDeck: Modeled Abdominal Circumference card builder produces dynamic runtime values', () => {
  const html = buildModeledAbdominalCircumferenceCardHtml({
    id: 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane',
    status: 'modeled',
    valueCm: 92.15,
    levelYcm: 98.4,
    model: {
      transverseWidthCm: 34.5,
      apDepthCm: 24.1,
    },
    provenance: {
      selectedYcm: 98.4,
      frontTransverseWidthCm: 34.5,
      sideQualifiedApDepthCm: 24.1,
    },
  });

  assert.equal(html.includes('92.15 cm'), true);
  assert.equal(html.includes('98.40 cm') || html.includes('98.4 cm'), true);
  assert.equal(html.includes('34.50 cm'), true);
  assert.equal(html.includes('24.10 cm'), true);
  assert.equal(html.includes('100.48 cm'), false);
});

test('derivedMeasurementDeck: Modeled Abdominal Circumference card handles blocked, unavailable, and invalid states with dash', () => {
  const blockedHtml = buildModeledAbdominalCircumferenceCardHtml({
    id: 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane',
    status: 'blocked',
    valueCm: null,
    levelYcm: 95.75,
  });
  assert.equal(blockedHtml.includes('Blocked'), true);
  assert.equal(blockedHtml.includes('Circumference Estimate'), true);
  assert.equal(blockedHtml.includes('100.48 cm'), false);

  const unavailHtml = buildModeledAbdominalCircumferenceCardHtml({
    id: 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane',
    status: 'unavailable',
    valueCm: null,
    levelYcm: null,
  });
  assert.equal(unavailHtml.includes('Unavailable'), true);
  assert.equal(unavailHtml.includes('Abdominal Point Plane Y'), true);
  assert.equal(unavailHtml.includes('derived-card-level'), false);

  const invalidHtml = buildModeledAbdominalCircumferenceCardHtml({
    id: 'torso_modeled_abdominal_circumference_at_abdominal_apex_plane',
    status: 'invalid',
    valueCm: null,
    levelYcm: null,
  });
  assert.equal(invalidHtml.includes('Invalid'), true);
  assert.equal(invalidHtml.includes('Abdominal Point Plane Y'), true);
  assert.equal(invalidHtml.includes('derived-card-level'), false);
});

test('derivedMeasurementDeck: Modeled Bust Circumference card renders exact title, badges, Front width, Side AP depth, and disclaimers', () => {
  const html = buildModeledBustCircumferenceCardHtml({
    contract: 'modeled-bust-circumference-v0',
    id: 'torso_modeled_bust_circumference_at_bust_apex_plane',
    name: 'Modeled Bust Circumference',
    status: 'modeled',
    valueCm: 100.2078,
    levelYcm: 123.85,
    model: {
      transverseWidthCm: 34.30,
      apDepthCm: 29.40,
    },
    provenance: {
      selectedYcm: 123.85,
      frontTransverseWidthCm: 34.30,
      sideQualifiedApDepthCm: 29.40,
    },
  });

  assert.equal(html.includes('Modeled Bust Circumference'), true);
  assert.equal(html.includes('data-measurement-id="torso_modeled_bust_circumference_at_bust_apex_plane"'), true);
  assert.equal(html.includes('Circumference Estimate'), true);
  assert.equal(html.includes('100.21 cm'), true);
  assert.equal(html.includes('Bust Point Plane Y'), true);
  assert.equal(html.includes('123.85 cm'), true);
  assert.equal(html.includes('Front Width'), true);
  assert.equal(html.includes('34.30 cm'), true);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('29.40 cm'), true);
  assert.equal(html.includes('Ellipse (Ramanujan II)'), true);
  assert.equal(html.includes('Evaluated at localized Bust Point Plane.'), true);
  assert.equal(html.includes('Modeled estimate; not tape-measured ground truth.'), true);
  assert.equal(html.includes('body-evidence-badge--ok'), true);
  assert.equal(html.includes('Modeled'), true);
});

test('derivedMeasurementDeck: Modeled Bust Circumference card builder produces dynamic runtime values', () => {
  const html = buildModeledBustCircumferenceCardHtml({
    id: 'torso_modeled_bust_circumference_at_bust_apex_plane',
    status: 'modeled',
    valueCm: 95.50,
    levelYcm: 125.0,
    model: {
      transverseWidthCm: 32.0,
      apDepthCm: 28.0,
    },
    provenance: {
      selectedYcm: 125.0,
      frontTransverseWidthCm: 32.0,
      sideQualifiedApDepthCm: 28.0,
    },
  });

  assert.equal(html.includes('95.50 cm'), true);
  assert.equal(html.includes('125.00 cm') || html.includes('125.0 cm'), true);
  assert.equal(html.includes('32.00 cm'), true);
  assert.equal(html.includes('28.00 cm'), true);
  assert.equal(html.includes('100.21 cm'), false);
});

test('derivedMeasurementDeck: Modeled Bust Circumference card handles blocked, unavailable, and invalid states with dash', () => {
  const blockedHtml = buildModeledBustCircumferenceCardHtml({
    id: 'torso_modeled_bust_circumference_at_bust_apex_plane',
    status: 'blocked',
    valueCm: null,
    levelYcm: 123.85,
  });
  assert.equal(blockedHtml.includes('Blocked'), true);
  assert.equal(blockedHtml.includes('Circumference Estimate'), true);
  assert.equal(blockedHtml.includes('100.21 cm'), false);

  const unavailHtml = buildModeledBustCircumferenceCardHtml({
    id: 'torso_modeled_bust_circumference_at_bust_apex_plane',
    status: 'unavailable',
    valueCm: null,
    levelYcm: null,
  });
  assert.equal(unavailHtml.includes('Unavailable'), true);
  assert.equal(unavailHtml.includes('Bust Point Plane Y'), true);

  const invalidHtml = buildModeledBustCircumferenceCardHtml({
    id: 'torso_modeled_bust_circumference_at_bust_apex_plane',
    status: 'invalid',
    valueCm: null,
    levelYcm: null,
  });
  assert.equal(invalidHtml.includes('Invalid'), true);
  assert.equal(invalidHtml.includes('Bust Point Plane Y'), true);
});

test('derivedMeasurementDeck: Modeled Hip Girth card renders exact title, badges, Front width, Side AP depth, and disclaimers', async () => {
  const { buildModeledHipGirthCardHtml } = await import('./derivedMeasurementDeck.js');
  const html = buildModeledHipGirthCardHtml({
    contract: 'modeled-hip-girth-v1',
    id: 'torso_modeled_hip_girth_at_buttock_point_plane',
    name: 'Modeled Hip Girth',
    status: 'modeled',
    valueCm: 111.12,
    levelYcm: 86.05,
    model: {
      family: 'ellipse',
      implementation: 'ellipse_ramanujan_ii',
      transverseWidthCm: 42.20,
      apDepthCm: 27.80,
    },
    provenance: {
      selectedYcm: 86.05,
      frontTransverseWidthCm: 42.20,
      sideQualifiedApDepthCm: 27.80,
    },
  });

  assert.equal(html.includes('Modeled Hip Girth'), true);
  assert.equal(html.includes('data-measurement-id="torso_modeled_hip_girth_at_buttock_point_plane"'), true);
  assert.equal(html.includes('Circumference Estimate'), true);
  assert.equal(html.includes('111.12 cm'), true);
  assert.equal(html.includes('Hip Girth Plane Y'), true);
  assert.equal(html.includes('86.05 cm'), true);
  assert.equal(html.includes('Front Width'), true);
  assert.equal(html.includes('42.20 cm'), true);
  assert.equal(html.includes('Side AP Depth'), true);
  assert.equal(html.includes('27.80 cm'), true);
  assert.equal(html.includes('Ellipse (Ramanujan II)'), true);
  assert.equal(html.includes('Evaluated at localized Buttock Point Plane.'), true);
  assert.equal(html.includes('Modeled estimate; not tape-measured ground truth.'), true);
  assert.equal(html.includes('body-evidence-badge--ok'), true);
  assert.equal(html.includes('Modeled'), true);
});

test('derivedMeasurementDeck: getMeasurementRecordById routes canonical and legacy Bust IDs cleanly', () => {
  clearBodyEvidence();
  assert.equal(getMeasurementRecordById('torso_modeled_bust_circumference_at_bust_apex_plane'), null);
  assert.equal(getMeasurementRecordById('modeled_bust_circumference'), null);
  assert.equal(getMeasurementRecordById('bust_apex_plane_localization'), null);
  assert.equal(getMeasurementRecordById('torso_bust_apex_plane_localization'), null);
  assert.equal(getMeasurementRecordById('torso_modeled_abdominal_circumference_at_abdominal_apex_plane'), null);
  assert.equal(getMeasurementRecordById('modeled_abdominal_circumference'), null);
  assert.equal(getMeasurementRecordById('abdominal_apex_plane_localization'), null);
  assert.equal(getMeasurementRecordById('torso_modeled_hip_girth_at_buttock_point_plane'), null);
  assert.equal(getMeasurementRecordById('modeled_hip_girth'), null);
  assert.equal(getMeasurementRecordById('buttock_point_plane_localization'), null);
  assert.equal(getMeasurementRecordById('torso_modeled_natural_waist_circumference_at_natural_waist_plane'), null);
  assert.equal(getMeasurementRecordById('unknown_id'), null);
  assert.equal(getMeasurementRecordById(null), null);
});

// ===========================================================================
// BATCH B: BILATERAL SPANS & BREADTHS UI TESTS
// ===========================================================================

test('derivedMeasurementDeck: Batch B renders "Bilateral Spans & Breadths" subgroup with exactly 6 rows', () => {
  const sampleMeasurements = [
    { id: 'inter_acromion_transverse_breadth_projected', displayName: 'Inter-Acromion Transverse Breadth (Projected)', status: 'valid', valueCm: 40.0 },
    { id: 'inter_hip_landmark_transverse_span', displayName: 'Inter-Hip Landmark Transverse Span', status: 'valid', valueCm: 20.0 },
    { id: 'bilateral_elbow_landmark_transverse_span', displayName: 'Bilateral Elbow Landmark Transverse Span', status: 'valid', valueCm: 50.0 },
    { id: 'bilateral_wrist_landmark_transverse_span', displayName: 'Bilateral Wrist Landmark Transverse Span', status: 'valid', valueCm: 60.0 },
    { id: 'bilateral_knee_landmark_transverse_span', displayName: 'Bilateral Knee Landmark Transverse Span', status: 'valid', valueCm: 20.0 },
    { id: 'bilateral_ankle_landmark_transverse_span', displayName: 'Bilateral Ankle Landmark Transverse Span', status: 'valid', valueCm: 20.0 },
  ];

  const html = buildDirectMeasurementsGroupHtml(
    'bilateral_transverse_landmark_spans',
    'Bilateral Spans & Breadths',
    sampleMeasurements,
    true,
  );

  assert.ok(html.includes('Bilateral Spans &amp; Breadths') || html.includes('Bilateral Spans & Breadths'));
  assert.equal(html.includes('data-group-id="bilateral_transverse_landmark_spans"'), true);

  for (const m of sampleMeasurements) {
    assert.equal(html.includes(`data-measurement-id="${m.id}"`), true, `Expected row for ${m.id}`);
    assert.equal(html.includes(m.displayName), true, `Expected displayName for ${m.id}`);
    assert.equal(html.includes(`${m.valueCm.toFixed(2)} cm`), true, `Expected formatted value for ${m.id}`);
    assert.equal(html.includes('role="button"'), true);
    assert.equal(html.includes('tabindex="0"'), true);
    assert.equal(html.includes('aria-selected="false"'), true);
  }
});

test('derivedMeasurementDeck: Full deck includes all Direct Measurements under measurement-type categories (Widths & Spans, Lengths & Distances)', () => {
  const pkg = buildBodyEvidencePackage({
    frontMetricCalibration: { status: 'validated', metricProjectedEligibility: true, scaleCmPerPx: 0.1 },
    sideMetricCalibration: { status: 'validated', metricProjectedEligibility: true, scaleCmPerPx: 0.1 },
  });
  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const container = { innerHTML: '' };
  renderDerivedMeasurementDeck(container);

  assert.equal(container.innerHTML.includes('data-group-id="direct_measurements"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="widths_spans"'), true);
  assert.equal(container.innerHTML.includes('data-group-id="lengths_distances"'), true);
  assert.equal(container.innerHTML.includes('data-group-id="arms"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="lower_limb"'), false);

  clearBodyEvidence();
});

test('derivedMeasurementDeck: Batch B selectMeasurement routes to Front 2D highlight and toggles off on re-click', () => {
  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  const annotations = [
    { id: 1, type: 'body_landmark', name: 'left_acromion', position: { x: 120, y: 142, z: 200 } },
    { id: 2, type: 'body_landmark', name: 'right_acromion', position: { x: 80, y: 142, z: 200 } },
  ];
  restoreAnnotations(annotations);

  const width = 100;
  const height = 100;
  const frontSeg = new Uint8Array(width * height);
  const sideSeg = new Uint8Array(width * height);

  const pkg = buildBodyEvidencePackage({
    calibration: {
      declaredIsCalibrated: true,
      metricScaleSource: 'known_subject_height',
      subjectHeightCm: 175.0,
      pixelsPerCm: 10.0,
      standardizedCanvasWidthPx: 2000,
      standardizedCanvasHeightPx: 2000,
      isIsotropic: true,
      standardizationSource: 'body-pipeline-standardization-v0',
      canvasSizePx: 2000,
      coordinateSpace: 'pixel',
      origin: 'bottom_left',
      workspaceExtentCm: 200,
    },
    front: {
      image: { widthPx: 2000, heightPx: 2000, dataUrl: 'data:image/png;base64,' },
      segmentation: { widthPx: 2000, heightPx: 2000, classIndices: frontSeg },
      calibration: {
        view: 'front',
        originalImageWidthPx: 1000,
        originalImageHeightPx: 1000,
        scaledWidthPx: 2000,
        scaledHeightPx: 2000,
        scaleFactor: 2.0,
        padLeftPx: 0,
        padTopPx: 0,
        croppedWidthPx: 2000,
        croppedHeightPx: 2000,
      },
      pose: { score: 0.95, keypoints: [] },
    },
    side: {
      image: { widthPx: 2000, heightPx: 2000, dataUrl: 'data:image/png;base64,' },
      segmentation: { widthPx: 2000, heightPx: 2000, classIndices: sideSeg },
      calibration: {
        view: 'side',
        originalImageWidthPx: 1000,
        originalImageHeightPx: 1000,
        scaledWidthPx: 2000,
        scaledHeightPx: 2000,
        scaleFactor: 2.0,
        padLeftPx: 0,
        padTopPx: 0,
        croppedWidthPx: 2000,
        croppedHeightPx: 2000,
      },
      pose: { score: 0.90, keypoints: [] },
    },
  });
  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  // Select Batch B measurement
  selectMeasurement('inter_acromion_transverse_breadth_projected');
  assert.equal(getSelectedMeasurementId(), 'inter_acromion_transverse_breadth_projected');

  // Toggle off
  selectMeasurement('inter_acromion_transverse_breadth_projected');
  assert.equal(getSelectedMeasurementId(), null);

  clearBodyEvidence();
  clearSelectedMeasurement();
  restoreAnnotations([]);
  global.document = origDoc;
});

test('derivedMeasurementDeck: buildFrontTransverseWidthCardHtml renders Neck Transverse Width card correctly across statuses', () => {
  // 1. Valid measurement
  const validNeck = {
    contract: 'front-transverse-width-v0',
    id: 'neck_transverse_width_at_neck_level',
    name: 'Neck Transverse Width at Neck Level',
    status: 'valid',
    valueCm: 20.0,
    provenance: {
      sourceLevel: 'neck',
      levelYcm: 155.0,
      leftXcm: 90.0,
      rightXcm: 110.0,
    },
  };

  const validHtml = buildFrontTransverseWidthCardHtml(validNeck);
  assert.equal(validHtml.includes('data-measurement-id="neck_transverse_width_at_neck_level"'), true);
  assert.equal(validHtml.includes('Neck Transverse Width'), true);
  assert.equal(validHtml.includes('Front Transverse Width'), true);
  assert.equal(validHtml.includes('20.00 cm') || validHtml.includes('20.0 cm'), true);
  assert.equal(validHtml.includes('Valid'), true);
  assert.equal(validHtml.includes('derived-card-row--meta'), true);
  assert.equal(validHtml.includes('front-transverse-meta-row'), true);
  assert.equal(validHtml.includes('Reference Level'), true);
  assert.equal(validHtml.includes('Neck Level (Y 155.00 cm)') || validHtml.includes('Neck Level (Y 155.0 cm)'), true);

  // 2. Unavailable measurement
  const unavailNeck = {
    contract: 'front-transverse-width-v0',
    id: 'neck_transverse_width_at_neck_level',
    status: 'unavailable',
    valueCm: null,
    provenance: { levelYcm: null },
  };
  const unavailHtml = buildFrontTransverseWidthCardHtml(unavailNeck);
  assert.equal(unavailHtml.includes('Unavailable'), true);
  assert.equal(unavailHtml.includes('—'), true);

  // 3. Ambiguous measurement
  const ambigNeck = {
    contract: 'front-transverse-width-v0',
    id: 'neck_transverse_width_at_neck_level',
    status: 'ambiguous',
    valueCm: null,
    provenance: { levelYcm: 155.0 },
  };
  const ambigHtml = buildFrontTransverseWidthCardHtml(ambigNeck);
  assert.equal(ambigHtml.includes('Ambiguous'), true);

  // 4. Invalid measurement
  const invalidNeck = {
    contract: 'front-transverse-width-v0',
    id: 'neck_transverse_width_at_neck_level',
    status: 'invalid',
    valueCm: null,
    provenance: { levelYcm: 155.0 },
  };
  const invalidHtml = buildFrontTransverseWidthCardHtml(invalidNeck);
  assert.equal(invalidHtml.includes('Invalid'), true);

  // Null input
  assert.equal(buildFrontTransverseWidthCardHtml(null), '');
});

test('derivedMeasurementDeck: getMeasurementRecordById resolves neck_transverse_width_at_neck_level', () => {
  const annotations = [
    { type: 'body_landmark', name: 'neck', point: { x: 50, y: 170, z: 200 } },
  ];

  const record = getMeasurementRecordById('neck_transverse_width_at_neck_level', annotations);
  assert.ok(record);
  assert.equal(record.contract, 'front-transverse-width-v0');
  assert.equal(record.id, 'neck_transverse_width_at_neck_level');
  assert.equal(record.name, 'Neck Transverse Width at Neck Level');
});

test('derivedMeasurementDeck: selectMeasurement for Neck Transverse Width routes to Front 2D highlight and toggles off on re-click', () => {
  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 10x10 image
  // Row 1 (yCm = 170 -> row 1.5 clamped to 1): col 4..5 are Face_Neck (3)
  const rasterFront = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) {
    rasterFront[1 * 10 + c] = 3;
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[3] = 'Face_Neck';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 98, Face_Neck: 2 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });
  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const annotations = [
    { id: 1, type: 'body_landmark', name: 'neck', position: { x: 50, y: 170, z: 200 } },
  ];
  restoreAnnotations(annotations);

  // Select Neck Transverse Width
  selectMeasurement('neck_transverse_width_at_neck_level');
  assert.equal(getSelectedMeasurementId(), 'neck_transverse_width_at_neck_level');

  // Toggle off
  selectMeasurement('neck_transverse_width_at_neck_level');
  assert.equal(getSelectedMeasurementId(), null);

  clearBodyEvidence();
  clearSelectedMeasurement();
  restoreAnnotations([]);
  global.document = origDoc;
});

test('derivedMeasurementDeck: renderDerivedMeasurementDeck renders Head & Neck category containing Neck card', () => {
  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  const rasterFront = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) {
    rasterFront[1 * 10 + c] = 3;
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[3] = 'Face_Neck';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 98, Face_Neck: 2 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });
  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const annotations = [
    { id: 1, type: 'body_landmark', name: 'neck', position: { x: 50, y: 170, z: 200 } },
  ];
  restoreAnnotations(annotations);

  const container = { innerHTML: '', querySelectorAll: () => [] };
  renderDerivedMeasurementDeck(container);

  assert.equal(container.innerHTML.includes('data-group-id="widths_spans"'), true);
  assert.equal(container.innerHTML.includes('Widths &amp; Transverse Spans') || container.innerHTML.includes('Widths & Transverse Spans'), true);
  assert.equal(container.innerHTML.includes('data-measurement-id="neck_transverse_width_at_neck_level"'), true);
  assert.equal(container.innerHTML.includes('Neck Transverse Width'), true);
  assert.equal(container.innerHTML.includes('data-group-id="front_transverse_widths"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="head_neck"'), false);

  clearBodyEvidence();
  restoreAnnotations([]);
  global.document = origDoc;
});

test('derivedMeasurementDeck: MEASUREMENT_TYPE_RESULT_CATEGORY_IDS and MEASUREMENT_TYPE_RESULT_CATEGORIES taxonomy verification', () => {
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.WIDTHS_SPANS, 'widths_spans');
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.LENGTHS_DISTANCES, 'lengths_distances');
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.CIRCUMFERENCES_GIRTHS, 'circumferences_girths');
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.DEPTHS_AP, 'depths_ap');
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.HEIGHTS_GROUND, 'heights_ground');
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.SURFACE_ARCS, 'surface_arcs');
  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORY_IDS.ANGLES_POSTURE, 'angles_posture');

  assert.equal(MEASUREMENT_TYPE_RESULT_CATEGORIES.length, 7);

  const widthsCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'widths_spans');
  assert.ok(widthsCat);
  assert.equal(widthsCat.measurementIds.length, 9);

  const lengthsCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'lengths_distances');
  assert.ok(lengthsCat);
  assert.equal(lengthsCat.measurementIds.length, 19);

  const circCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'circumferences_girths');
  assert.ok(circCat);
  assert.equal(circCat.measurementIds.length, 5);

  const depthsCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'depths_ap');
  assert.ok(depthsCat);
  assert.equal(depthsCat.measurementIds.length, 0);

  const heightsCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'heights_ground');
  assert.ok(heightsCat);
  assert.equal(heightsCat.measurementIds.length, 0);

  const arcsCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'surface_arcs');
  assert.ok(arcsCat);
  assert.equal(arcsCat.measurementIds.length, 0);

  const anglesCat = MEASUREMENT_TYPE_RESULT_CATEGORIES.find((c) => c.id === 'angles_posture');
  assert.ok(anglesCat);
  assert.equal(anglesCat.measurementIds.length, 0);
});

test('derivedMeasurementDeck: Measurement-Type-First live render structure and complete category inventory', () => {
  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  // 10x10 image
  // Row 1 (yCm = 170): Neck (3)
  // Row 2 (yCm = 150): Torso (22)
  // Row 6 (yCm = 70): Torso (22)
  const rasterFront = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) {
    rasterFront[1 * 10 + c] = 3; // Face_Neck
  }
  for (let c = 3; c <= 6; c += 1) {
    rasterFront[2 * 10 + c] = 22; // Torso at shoulder
    rasterFront[6 * 10 + c] = 22; // Torso at hip
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[3] = 'Face_Neck';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 90, Face_Neck: 2, Torso: 8 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const annotations = [
    { id: 1, type: 'body_landmark', name: 'neck', position: { x: 50, y: 170, z: 200 } },
    { id: 2, type: 'body_landmark', name: 'left_shoulder', position: { x: 30, y: 150, z: 200 } },
    { id: 3, type: 'body_landmark', name: 'right_shoulder', position: { x: 70, y: 150, z: 200 } },
    { id: 4, type: 'body_landmark', name: 'left_acromion', position: { x: 25, y: 150, z: 200 } },
    { id: 5, type: 'body_landmark', name: 'right_acromion', position: { x: 75, y: 150, z: 200 } },
    { id: 6, type: 'body_landmark', name: 'left_elbow', position: { x: 20, y: 120, z: 200 } },
    { id: 7, type: 'body_landmark', name: 'right_elbow', position: { x: 80, y: 120, z: 200 } },
    { id: 8, type: 'body_landmark', name: 'left_wrist', position: { x: 15, y: 90, z: 200 } },
    { id: 9, type: 'body_landmark', name: 'right_wrist', position: { x: 85, y: 90, z: 200 } },
    { id: 10, type: 'body_landmark', name: 'left_hip', position: { x: 30, y: 70, z: 200 } },
    { id: 11, type: 'body_landmark', name: 'right_hip', position: { x: 70, y: 70, z: 200 } },
    { id: 12, type: 'body_landmark', name: 'left_knee', position: { x: 35, y: 40, z: 200 } },
    { id: 13, type: 'body_landmark', name: 'right_knee', position: { x: 65, y: 40, z: 200 } },
    { id: 14, type: 'body_landmark', name: 'left_ankle', position: { x: 35, y: 10, z: 200 } },
    { id: 15, type: 'body_landmark', name: 'right_ankle', position: { x: 65, y: 10, z: 200 } },
  ];
  restoreAnnotations(annotations);

  const container = { innerHTML: '', querySelectorAll: () => [] };
  renderDerivedMeasurementDeck(container);

  // 1. Verify old top-level groups and old anatomy groups are removed
  assert.equal(container.innerHTML.includes('data-group-id="cross_section_evidence"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="front_transverse_widths"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="modeled_perimeter_estimates"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="direct_measurements"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="head_neck"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="shoulder_upper_torso"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="arms"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="bust_chest"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="waist_abdomen"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="hip_seat"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="lower_limb"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="crotch_leg_length"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="body_lengths_heights"'), false);

  // 2. Verify all 3 populated measurement-type categories appear in exact order
  const catWidths = container.innerHTML.indexOf('data-group-id="widths_spans"');
  const catLengths = container.innerHTML.indexOf('data-group-id="lengths_distances"');
  const catCircs = container.innerHTML.indexOf('data-group-id="circumferences_girths"');

  assert.ok(catWidths > -1, 'widths_spans category rendered');
  assert.ok(catLengths > catWidths, 'lengths_distances category follows widths_spans');
  assert.ok(catCircs > catLengths, 'circumferences_girths category follows lengths_distances');

  // 3. Verify empty categories are NOT rendered
  assert.equal(container.innerHTML.includes('data-group-id="depths_ap"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="heights_ground"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="surface_arcs"'), false);
  assert.equal(container.innerHTML.includes('data-group-id="angles_posture"'), false);

  // 4. Verify all 9 measurements in WIDTHS & TRANSVERSE SPANS
  assert.ok(container.innerHTML.includes('data-measurement-id="neck_transverse_width_at_neck_level"'));
  assert.ok(container.innerHTML.includes('Neck Transverse Width'));
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_width_at_shoulder_level"'));
  assert.ok(container.innerHTML.includes('Torso Transverse Width at Shoulder Level'));
  assert.ok(container.innerHTML.includes('data-measurement-id="inter_acromion_transverse_breadth_projected"'));
  assert.ok(container.innerHTML.includes('Inter-Acromion Transverse Breadth (Projected)'));
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_width_at_hip_level"'));
  assert.ok(container.innerHTML.includes('Torso Transverse Width at Hip Level'));
  assert.ok(container.innerHTML.includes('data-measurement-id="inter_hip_landmark_transverse_span"'));
  assert.ok(container.innerHTML.includes('Inter-Hip Landmark Transverse Span'));
  assert.ok(container.innerHTML.includes('data-measurement-id="bilateral_elbow_landmark_transverse_span"'));
  assert.ok(container.innerHTML.includes('Bilateral Elbow Landmark Transverse Span'));
  assert.ok(container.innerHTML.includes('data-measurement-id="bilateral_wrist_landmark_transverse_span"'));
  assert.ok(container.innerHTML.includes('Bilateral Wrist Landmark Transverse Span'));
  assert.ok(container.innerHTML.includes('data-measurement-id="bilateral_knee_landmark_transverse_span"'));
  assert.ok(container.innerHTML.includes('Bilateral Knee Landmark Transverse Span'));
  assert.ok(container.innerHTML.includes('data-measurement-id="bilateral_ankle_landmark_transverse_span"'));
  assert.ok(container.innerHTML.includes('Bilateral Ankle Landmark Transverse Span'));

  // 5. Verify all 19 measurements in LENGTHS & DISTANCES
  assert.ok(container.innerHTML.includes('data-measurement-id="vertical_torso_length_neck_to_hip"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="vertical_shoulder_drop_neck_to_shoulder"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="vertical_thigh_length_hip_to_knee"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="vertical_lower_leg_length_knee_to_ankle"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="vertical_total_leg_length_hip_to_ankle"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_upper_arm_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_upper_arm_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_forearm_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_forearm_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_direct_arm_chord_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_direct_arm_chord_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_total_arm_chain_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_total_arm_chain_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_thigh_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_thigh_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_lower_leg_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_lower_leg_segment_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="left_total_leg_chain_length_projected"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="right_total_leg_chain_length_projected"'));

  // 6. Verify all 5 modeled circumferences in CIRCUMFERENCES & GIRTHS
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_modeled_bust_circumference_at_bust_apex_plane"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_modeled_natural_waist_circumference_at_natural_waist_plane"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_modeled_abdominal_circumference_at_abdominal_apex_plane"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_modeled_hip_girth_at_buttock_point_plane"'));
  assert.ok(container.innerHTML.includes('data-measurement-id="torso_modeled_hip_seat_circumference_at_maximum_seat_plane"'));

  // 7. Verify cross-section evidence records remain resolvable internally
  const shoulderCsRecord = getMeasurementRecordById('torso_cross_section_evidence_at_shoulder_level', annotations);
  assert.ok(shoulderCsRecord);
  assert.equal(shoulderCsRecord.contract, 'cross-section-evidence-v0');

  const hipCsRecord = getMeasurementRecordById('torso_cross_section_evidence_at_hip_level', annotations);
  assert.ok(hipCsRecord);
  assert.equal(hipCsRecord.contract, 'cross-section-evidence-v0');

  // 8. Verify independent selection of Shoulder and Hip torso width
  const shoulderWidthRec = getMeasurementRecordById('torso_width_at_shoulder_level', annotations);
  assert.ok(shoulderWidthRec, 'shoulder width record resolved');
  assert.equal(shoulderWidthRec.status, 'valid', `shoulder width status was ${shoulderWidthRec.status}`);

  selectMeasurement('torso_width_at_shoulder_level');
  assert.equal(getSelectedMeasurementId(), 'torso_width_at_shoulder_level');
  selectMeasurement('torso_width_at_shoulder_level');
  assert.equal(getSelectedMeasurementId(), null);

  selectMeasurement('torso_width_at_hip_level');
  assert.equal(getSelectedMeasurementId(), 'torso_width_at_hip_level');
  selectMeasurement('torso_width_at_hip_level');
  assert.equal(getSelectedMeasurementId(), null);

  clearBodyEvidence();
  clearSelectedMeasurement();
  restoreAnnotations([]);
  global.document = origDoc;
});

test('derivedMeasurementDeck: buildCompactMeasurementRowHtml renders valid, modeled, blocked, unavailable, and selected states cleanly', () => {
  // 1. Valid numeric row
  const validHtml = buildCompactMeasurementRowHtml({
    id: 'test_width',
    label: 'Test Width',
    valueCm: 42.5,
    status: 'valid',
  });
  assert.ok(validHtml.includes('data-measurement-id="test_width"'));
  assert.ok(validHtml.includes('Test Width'));
  assert.ok(validHtml.includes('42.50 cm'));
  assert.ok(validHtml.includes('role="button"'));
  assert.ok(validHtml.includes('tabindex="0"'));
  assert.ok(validHtml.includes('aria-selected="false"'));
  assert.ok(!validHtml.includes('badge-ok')); // No redundant "Valid" badge

  // 2. Modeled row
  const modeledHtml = buildCompactMeasurementRowHtml({
    id: 'test_modeled',
    label: 'Modeled Circumference',
    valueCm: 85.0,
    status: 'modeled',
  });
  assert.ok(modeledHtml.includes('Modeled Circumference'));
  assert.ok(modeledHtml.includes('85.00 cm'));
  assert.ok(modeledHtml.includes('Modeled'));

  // 3. Blocked row
  const blockedHtml = buildCompactMeasurementRowHtml({
    id: 'test_blocked',
    label: 'Blocked Measurement',
    status: 'blocked',
  });
  assert.ok(blockedHtml.includes('Blocked Measurement'));
  assert.ok(blockedHtml.includes('—'));
  assert.ok(blockedHtml.includes('Blocked'));

  // 4. Unavailable row
  const unavailHtml = buildCompactMeasurementRowHtml({
    id: 'test_unavail',
    label: 'Unavailable Measurement',
    status: 'unavailable',
  });
  assert.ok(unavailHtml.includes('Unavailable Measurement'));
  assert.ok(unavailHtml.includes('—'));
  assert.ok(unavailHtml.includes('Unavailable'));

  // 5. Selected state
  const selectedHtml = buildCompactMeasurementRowHtml({
    id: 'test_selected',
    label: 'Selected Measurement',
    valueCm: 30.0,
    status: 'valid',
    isSelected: true,
  });
  assert.ok(selectedHtml.includes('is-selected'));
  assert.ok(selectedHtml.includes('aria-selected="true"'));
});

test('derivedMeasurementDeck: Stage 3 Compact Rows omit large multi-line evidence and maintain dynamic counts', () => {
  const origDoc = global.document;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ setAttribute: () => {}, style: {}, appendChild: () => {} }),
  };

  function encodeUint8ArrayToBase64(uint8) {
    let binary = '';
    for (let i = 0; i < uint8.length; i += 1) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  const rasterFront = new Uint8Array(100);
  for (let c = 4; c <= 5; c += 1) {
    rasterFront[1 * 10 + c] = 3;
  }
  for (let c = 3; c <= 6; c += 1) {
    rasterFront[2 * 10 + c] = 22;
    rasterFront[6 * 10 + c] = 22;
  }

  const classNames = Array.from({ length: 29 }, (_, i) => `Class_${i}`);
  classNames[0] = 'Background';
  classNames[3] = 'Face_Neck';
  classNames[22] = 'Torso';

  const pkg = buildBodyEvidencePackage({
    front: {
      segmentation: {
        model: 'schp',
        view: 'front',
        num_classes: 29,
        class_names: classNames,
        class_counts: { Background: 90, Face_Neck: 2, Torso: 8 },
        labels: { shape: [10, 10], dtype: 'uint8', base64: encodeUint8ArrayToBase64(rasterFront) },
      },
    },
  });

  setBodyEvidencePackage(pkg);
  analyzeLoadedBodyEvidence();

  const annotations = [
    { id: 1, type: 'body_landmark', name: 'neck', position: { x: 50, y: 170, z: 200 } },
    { id: 2, type: 'body_landmark', name: 'left_shoulder', position: { x: 30, y: 150, z: 200 } },
    { id: 3, type: 'body_landmark', name: 'right_shoulder', position: { x: 70, y: 150, z: 200 } },
    { id: 4, type: 'body_landmark', name: 'left_acromion', position: { x: 25, y: 150, z: 200 } },
    { id: 5, type: 'body_landmark', name: 'right_acromion', position: { x: 75, y: 150, z: 200 } },
    { id: 6, type: 'body_landmark', name: 'left_elbow', position: { x: 20, y: 120, z: 200 } },
    { id: 7, type: 'body_landmark', name: 'right_elbow', position: { x: 80, y: 120, z: 200 } },
    { id: 8, type: 'body_landmark', name: 'left_wrist', position: { x: 15, y: 90, z: 200 } },
    { id: 9, type: 'body_landmark', name: 'right_wrist', position: { x: 85, y: 90, z: 200 } },
    { id: 10, type: 'body_landmark', name: 'left_hip', position: { x: 30, y: 70, z: 200 } },
    { id: 11, type: 'body_landmark', name: 'right_hip', position: { x: 70, y: 70, z: 200 } },
    { id: 12, type: 'body_landmark', name: 'left_knee', position: { x: 35, y: 40, z: 200 } },
    { id: 13, type: 'body_landmark', name: 'right_knee', position: { x: 65, y: 40, z: 200 } },
    { id: 14, type: 'body_landmark', name: 'left_ankle', position: { x: 35, y: 10, z: 200 } },
    { id: 15, type: 'body_landmark', name: 'right_ankle', position: { x: 65, y: 10, z: 200 } },
  ];
  restoreAnnotations(annotations);

  const container = { innerHTML: '', querySelectorAll: () => [] };
  renderDerivedMeasurementDeck(container);

  // 1. Verify large multi-line evidence and notes are NOT in always-visible Results deck
  assert.equal(container.innerHTML.includes('Circumference Estimate'), false);
  assert.equal(container.innerHTML.includes('Seat Plane Y'), false);
  assert.equal(container.innerHTML.includes('Front Width'), false);
  assert.equal(container.innerHTML.includes('Side AP Depth'), false);
  assert.equal(container.innerHTML.includes('Ellipse (Ramanujan II)'), false);
  assert.equal(container.innerHTML.includes('Evaluated at deterministic'), false);
  assert.equal(container.innerHTML.includes('Modeled estimate; not tape-measured'), false);

  // 2. Verify all categories use compact rows and have correct dynamic counts
  assert.ok(container.innerHTML.includes('Widths &amp; Transverse Spans') || container.innerHTML.includes('Widths & Transverse Spans'));
  assert.ok(container.innerHTML.includes('>(9)<')); // 9 widths
  assert.ok(container.innerHTML.includes('Lengths &amp; Distances') || container.innerHTML.includes('Lengths & Distances'));
  assert.ok(container.innerHTML.includes('>(19)<')); // 19 lengths
  assert.ok(container.innerHTML.includes('Circumferences &amp; Girths') || container.innerHTML.includes('Circumferences & Girths'));
  assert.ok(container.innerHTML.includes('>(5)<')); // 5 circumferences

  // 3. Verify compact classes are present
  assert.ok(container.innerHTML.includes('compact-measurement-row'));
  assert.ok(container.innerHTML.includes('compact-measurement-label'));
  assert.ok(container.innerHTML.includes('compact-measurement-value'));

  clearBodyEvidence();
  restoreAnnotations([]);
  global.document = origDoc;
});



import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildAdvancedQaContentHtml, renderAdvancedQaPanel } from './advancedQaPanel.js';
import { initCollapsibleSections } from './collapsibleSections.js';
import { mapBlockerToHumanLabel } from './derivedMeasurementDeck.js';

const markup = readFileSync(
  fileURLToPath(new URL('../../index.html', import.meta.url)),
  'utf8',
);

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(name) {
      classes.add(name);
    },
    contains(name) {
      return classes.has(name);
    },
    toggle(name, force) {
      const shouldHave = force === undefined ? !classes.has(name) : Boolean(force);
      if (shouldHave) {
        classes.add(name);
      } else {
        classes.delete(name);
      }
    },
  };
}

function createAdvancedQaAccordion() {
  const headerAttrs = {};
  const headerListeners = {};
  const header = {
    classList: createClassList(['section-title', 'section-title--collapsible']),
    setAttribute(name, value) {
      headerAttrs[name] = String(value);
    },
    getAttribute(name) {
      return headerAttrs[name] ?? null;
    },
    addEventListener(type, fn) {
      headerListeners[type] = headerListeners[type] || [];
      headerListeners[type].push(fn);
    },
    click() {
      for (const fn of headerListeners.click || []) {
        fn();
      }
    },
  };

  const content = { innerHTML: '' };
  const section = {
    classList: createClassList(['inspector-section', 'is-collapsed']),
    hasAttribute(name) {
      return name === 'data-collapsible' || name === 'data-collapsed';
    },
    matches(selector) {
      return selector === '[data-collapsible]';
    },
    querySelector(selector) {
      if (selector === ':scope > .section-title') {
        return header;
      }
      if (selector === '#advanced-qa-content') {
        return content;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  return { section, header, content };
}

test('advancedQaPanel: renderAdvancedQaPanel renders empty state when evidence not analyzed', () => {
  const container = { innerHTML: '' };
  renderAdvancedQaPanel(container);

  assert.equal(container.innerHTML.includes('No Body Evidence Package Loaded'), true);
});

test('advancedQaPanel: markup starts collapsed and keeps the existing empty-state host', () => {
  const panelStart = markup.indexOf('id="advanced-qa-panel"');
  const panelEnd = markup.indexOf('id="bottom-status-bar"');
  assert.ok(panelStart > -1 && panelEnd > panelStart, 'Advanced QA panel markup must be present');
  const panel = markup.slice(panelStart, panelEnd);

  assert.match(panel, /data-collapsible/);
  assert.match(panel, /data-collapsed/);
  assert.match(panel, /class="[^"]*is-collapsed/);
  assert.match(panel, /id="advanced-qa-content"/);
  assert.match(panel, /class="inspector-subgroup-body"/);
});

test('advancedQaPanel: accordion initializes collapsed and toggles expand/collapse', () => {
  const { section, header, content } = createAdvancedQaAccordion();

  initCollapsibleSections(section);

  assert.equal(section.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
  assert.equal(header.getAttribute('role'), 'button');
  assert.equal(header.getAttribute('tabindex'), '0');

  renderAdvancedQaPanel(content);
  assert.equal(content.innerHTML.includes('No Body Evidence Package Loaded'), true);

  header.click();
  assert.equal(section.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');
  assert.equal(content.innerHTML.includes('No Body Evidence Package Loaded'), true);

  header.click();
  assert.equal(section.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');
});

test('derivedMeasurementDeck: mapBlockerToHumanLabel correctly maps domain blocker codes to readable labels', () => {
  assert.equal(mapBlockerToHumanLabel('clothing_authorization_missing'), 'Clothing Validation Pending');
  assert.equal(mapBlockerToHumanLabel('view_pose_semantics_missing'), 'Capture Orientation Validation Pending');
  assert.equal(mapBlockerToHumanLabel('authoritative_physical_evidence_missing'), 'Physical Evidence Validation Pending');
  assert.equal(mapBlockerToHumanLabel('comparability_qa_missing'), 'Cross-View Comparability Pending');
  assert.equal(mapBlockerToHumanLabel('correspondence_unavailable'), 'View Alignment Incomplete');
});

test('advancedQaPanel: Stage 2 keeps intake and calibration, drops eligibility and Body duplicates', () => {
  const html = buildAdvancedQaContentHtml({
    pkg: {
      sampleId: 'subject-01',
      version: 'body-evidence-package-v0',
      sourceFormat: 'RVEacity Package',
    },
    qa: { version: 'v0' },
    provenance: {
      status: 'validated',
      calibration: { isIsotropic: true, pixelsPerCm: 10 },
    },
    eligibilityReport: {
      pairs: [
        {
          sourceLevel: 'shoulder',
          pairedStatus: 'blocked',
          blockers: ['clothing_authorization_missing', 'view_pose_semantics_missing'],
        },
        {
          sourceLevel: 'hip',
          pairedStatus: 'partial',
          blockers: ['comparability_qa_missing'],
        },
      ],
    },
  });

  assert.equal(html.includes('Intake &amp; Package') || html.includes('Intake & Package'), true);
  assert.equal(html.includes('subject-01'), true);
  assert.equal(html.includes('Calibration'), true);
  assert.equal(html.includes('Physical Measurement Eligibility'), false);
  assert.equal(html.includes('Clothing Validation Pending'), false);
  assert.equal(html.includes('Capture Orientation Validation Pending'), false);
  assert.equal(html.includes('Cross-View Comparability Pending'), false);

  assert.equal(html.includes('Front Modalities'), false);
  assert.equal(html.includes('Side Modalities'), false);
  assert.equal(html.includes('Alignment &amp; Calibration') || html.includes('Alignment & Calibration'), false);
  assert.equal(html.includes('Front–Side Alignment') || html.includes('Front-Side Alignment'), false);
  assert.equal(html.includes('Max ΔY') || html.includes('Max &Delta;Y'), false);
  assert.equal(html.includes('Dense Evidence QA'), false);
  assert.equal(html.includes('Pointmap Numeric QA'), false);
  assert.equal(html.includes('Normal Numeric QA'), false);
  assert.equal(html.includes('Physical Pointmap Geometry'), false);
  assert.equal(html.includes('Sapiens Runtime Audit'), false);
  assert.equal(html.includes('View &amp; Pose Semantics') || html.includes('View & Pose Semantics'), false);
  assert.equal(html.includes('Clothing &amp; Body Surface') || html.includes('Clothing & Body Surface'), false);
  assert.equal(html.includes('Pose Qualified'), false);
  assert.equal(html.includes('View Consistency'), false);
});

test('advancedQaPanel: 4.5H renders Side T-Pose, Lateral Orientation, and AP Depth Qualification sections', () => {
  const html = buildAdvancedQaContentHtml({
    pkg: { sampleId: 'subject-01', version: 'body-evidence-package-v0', sourceFormat: 'RVEacity Package' },
    qa: { version: 'v0' },
    provenance: { status: 'validated', calibration: { isIsotropic: true, pixelsPerCm: 10 } },
    sidePoseQual: {
      status: 'qualified',
      qualified: true,
      summary: { evaluatedArms: ['left', 'right'], dominantArm: 'left' },
    },
    sideOrientationQual: {
      status: 'qualified',
      qualified: true,
      orientationSemantics: 'approximately_lateral',
      summary: { usablePairsCount: 4, passedPairsCount: 4, aggregateCollapseRatio: 0.078 },
    },
    depthQualReport: {
      qualifications: [
        { sourceLevel: 'shoulder', status: 'qualified', qualifiedDepthEstimateCm: 11.00 },
        { sourceLevel: 'hip', status: 'qualified', qualifiedDepthEstimateCm: 27.70 },
      ],
    },
  });

  // Side T-Pose section
  assert.equal(html.includes('Side T-Pose Stance'), true);
  assert.equal(html.includes('left, right (left arm)'), true);
  assert.equal(html.includes('Horizontal reach &amp; straight elbows verified') || html.includes('Horizontal reach & straight elbows verified'), true);

  // Side Lateral Orientation section
  assert.equal(html.includes('Side Lateral Orientation'), true);
  assert.equal(html.includes('Approximately Lateral'), true);
  assert.equal(html.includes('4/4 pairs passed (7.8% collapse)'), true);
  assert.equal(html.includes('Projection collapse · No 90° claim') || html.includes('Projection collapse · No 90&deg; claim'), true);

  // Side AP Depth Qualification section
  assert.equal(html.includes('Side AP Depth Qualification'), true);
  assert.equal(html.includes('Shoulder Level AP Depth') || html.includes('Shoulder AP Depth'), true);
  assert.equal(html.includes('11.00 cm'), true);
  assert.equal(html.includes('Hip Level AP Depth') || html.includes('Hip AP Depth'), true);
  assert.equal(html.includes('27.70 cm'), true);
});

test('advancedQaPanel: long diagnostic values render in stacked rows and short values remain inline', () => {
  const html = buildAdvancedQaContentHtml({
    pkg: { sampleId: 'subject-01', version: 'body-evidence-package-v0', sourceFormat: 'RVEacity Package' },
    qa: { version: 'v0' },
    provenance: { status: 'validated', calibration: { isIsotropic: true, pixelsPerCm: 10 } },
    sidePoseQual: {
      status: 'warning',
      qualified: false,
      summary: { evaluatedArms: ['left'], dominantArm: 'left' },
      issues: [],
      warnings: ['left projected elbow deviation: 44.2°'],
    },
    sideOrientationQual: {
      status: 'qualified',
      qualified: true,
      orientationSemantics: 'approximately_lateral',
      summary: { usablePairsCount: 4, passedPairsCount: 4, aggregateCollapseRatio: 0.078 },
    },
  });

  // Long diagnostic value renders in stacked row
  assert.match(html, /<div class="info-row info-row--stacked">\s*<span class="info-label">Stance Geometry<\/span>\s*<span class="info-value">left projected elbow deviation: 44\.2°<\/span>\s*<\/div>/);
  assert.match(html, /<div class="info-row info-row--stacked">\s*<span class="info-label">Bilateral Consensus<\/span>\s*<span class="info-value">4\/4 pairs passed \(7\.8% collapse\)<\/span>\s*<\/div>/);
  assert.match(html, /<div class="info-row info-row--stacked">\s*<span class="info-label">Fidelity Scope<\/span>\s*<span class="info-value info-value--muted">Projection collapse · No 90° claim<\/span>\s*<\/div>/);

  // Short properties remain in standard inline rows
  assert.match(html, /<div class="info-row"><span class="info-label">Sample ID<\/span><span class="info-value info-value--data">subject-01<\/span><\/div>/);
  assert.match(html, /<div class="info-row"><span class="info-label">Evaluated Arms<\/span><span class="info-value">left \(left arm\)<\/span><\/div>/);
  assert.match(html, /<div class="info-row"><span class="info-label">Orientation Stance<\/span><span class="info-value">Approximately Lateral<\/span><\/div>/);
});

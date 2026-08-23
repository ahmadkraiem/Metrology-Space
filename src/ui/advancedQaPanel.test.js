import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderAdvancedQaPanel } from './advancedQaPanel.js';
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
  assert.match(panel, /class="section-body"/);
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

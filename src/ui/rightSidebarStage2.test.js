import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { formatAnnotationTypeLabel } from '../core/annotationTypes.js';
import {
  buildPhysicalEligibilityHtml,
  buildAdvancedQaContentHtml,
} from './advancedQaPanel.js';
import { applyHistoryItemHighlightBehavior } from './measurementPanel.js';
import { initCollapsibleSections } from './collapsibleSections.js';

const rootDir = fileURLToPath(new URL('../..', import.meta.url));
const markup = readFileSync(join(rootDir, 'index.html'), 'utf8');

const REMOVED_TAB_IDS = [
  'session-tabs',
  'session-tab-history',
  'session-tab-annotations',
  'session-tab-body',
  'session-tab-graph',
  'tab-panel-history',
  'tab-panel-annotations',
  'tab-panel-body',
  'tab-panel-graph',
];

const REMOVED_BODY_TABLE_IDS = [
  'promoted-body-anchors-panel',
  'promoted-body-anchors-count',
  'promoted-body-anchors-empty',
  'promoted-body-anchors-list',
  'session-body-evidence-status',
];

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  assert.ok(start > -1 && end > start, `Expected region ${startMarker} … ${endMarker}`);
  return source.slice(start, end);
}

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

function listLiveUiFiles(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      listLiveUiFiles(path, files);
      continue;
    }
    if (entry.name.endsWith('.test.js')) {
      continue;
    }
    if (/\.(js|html|css)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

test('rightSidebarStage2: old Hist / Annos / Body / Graph tab strip is gone', () => {
  for (const id of REMOVED_TAB_IDS) {
    assert.equal(markup.includes(`id="${id}"`), false, `removed tab id ${id} must not remain`);
  }
  assert.equal(/session-tab-btn/.test(markup), false);
  assert.equal(/>Hist</.test(markup), false);
  assert.equal(/>Annos</.test(markup), false);
  assert.equal(/aria-label="Scene Graph"/.test(markup), false);
});

test('rightSidebarStage2: Results remain the top measurement deck', () => {
  const deck = sliceBetween(markup, 'id="derived-measurement-deck"', 'id="session-records-panel"');
  assert.match(deck, /deck-title">Results</);
  assert.match(deck, /id="derived-measurement-cards"/);
  assert.equal(deck.includes('Metric Projected'), false);
  assert.equal(deck.includes('session-tab'), false);
});

test('rightSidebarStage2: History and Annotations render in Session Records', () => {
  const records = sliceBetween(markup, 'id="session-records-panel"', 'id="diagnostics-panel"');
  assert.match(records, /Session Records/);
  assert.match(records, />History</);
  assert.match(records, /id="history-empty"/);
  assert.match(records, /id="history-list"/);
  assert.match(records, /id="clear-history"[^>]*>Clear History</);
  assert.match(records, />Annotations</);
  assert.match(records, /id="annotations-empty"/);
  assert.match(records, /id="annotation-list"/);
});

test('rightSidebarStage2: promoted body anchors stay in the annotation list, not a second table', () => {
  for (const id of REMOVED_BODY_TABLE_IDS) {
    assert.equal(markup.includes(`id="${id}"`), false, `removed body table id ${id} must not remain`);
  }
  assert.equal(formatAnnotationTypeLabel('body_landmark'), 'Body Landmark');
});

test('rightSidebarStage2: Diagnostics initializes collapsed and hosts remaining inspectors', () => {
  const diagnostics = sliceBetween(markup, 'id="diagnostics-panel"', 'id="bottom-status-bar"');
  assert.match(diagnostics, /data-collapsible/);
  assert.match(diagnostics, /data-collapsed/);
  assert.match(diagnostics, /class="[^"]*is-collapsed/);
  assert.match(diagnostics, />Diagnostics</);
  assert.match(diagnostics, /Why This Result Is Blocked/);
  assert.match(diagnostics, /id="why-result-blocked"/);
  assert.match(diagnostics, /Front[\u2013\-]Side Alignment/);
  assert.match(diagnostics, /id="front-side-alignment-qa"/);
  assert.match(diagnostics, /Body \/ Anchor Diagnostics/);
  assert.match(diagnostics, /Anchor-Based Measurement Previews/);
  assert.match(diagnostics, /id="body-measurement-readiness"/);
  assert.match(diagnostics, /id="advanced-qa-panel"/);
  assert.match(diagnostics, /id="advanced-qa-content"/);
  assert.match(diagnostics, /id="reference-projection-utility"/);
  assert.equal(diagnostics.includes('id="scene-graph-tree"'), false);
  assert.equal(diagnostics.includes('Scene Metadata'), false);
});

test('rightSidebarStage2: Diagnostics accordion starts collapsed and toggles', () => {
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
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  initCollapsibleSections(section);
  assert.equal(section.classList.contains('is-collapsed'), true);
  assert.equal(header.getAttribute('aria-expanded'), 'false');

  header.click();
  assert.equal(section.classList.contains('is-collapsed'), false);
  assert.equal(header.getAttribute('aria-expanded'), 'true');
});

test('rightSidebarStage2: sidebar identity is Results & Records', () => {
  const header = sliceBetween(markup, 'id="right-sidebar"', 'id="derived-measurement-deck"');
  assert.match(header, /sidebar-title">Results &amp; Records</);
  assert.match(header, /sidebar-subtitle">Measurements, session records, and diagnostics</);
  assert.match(header, /sidebar-collapsed-rail-text">Results &amp; Records</);
  assert.match(header, /Collapse Results &amp; Records/);
  assert.equal(header.includes('Session Data'), false);
});

test('rightSidebarStage2: eligibility details live in Why This Result Is Blocked, not Advanced QA', () => {
  const blockers = buildPhysicalEligibilityHtml({
    pairs: [
      {
        sourceLevel: 'shoulder',
        pairedStatus: 'blocked',
        blockers: ['clothing_authorization_missing', 'comparability_qa_missing'],
      },
    ],
  });
  assert.equal(blockers.includes('Clothing Validation Pending'), true);
  assert.equal(blockers.includes('Cross-View Comparability Pending'), true);
  assert.equal(blockers.includes('SHOULDER'), true);

  const clear = buildPhysicalEligibilityHtml({
    pairs: [{ sourceLevel: 'hip', pairedStatus: 'eligible', blockers: [] }],
  });
  assert.equal(clear.includes('No results are blocked'), true);
  assert.equal(clear.includes('qa-blocker-chip'), false);

  const advanced = buildAdvancedQaContentHtml({
    pkg: { sampleId: 'subject-01' },
    provenance: { status: 'validated', calibration: { isIsotropic: true, pixelsPerCm: 10 } },
    eligibilityReport: {
      pairs: [{ sourceLevel: 'shoulder', pairedStatus: 'blocked', blockers: ['clothing_authorization_missing'] }],
    },
  });
  assert.equal(advanced.includes('Intake &amp; Package') || advanced.includes('Intake & Package'), true);
  assert.equal(advanced.includes('Calibration'), true);
  assert.equal(advanced.includes('Physical Measurement Eligibility'), false);
  assert.equal(advanced.includes('Clothing Validation Pending'), false);
  assert.equal(advanced.includes('Front–Side Alignment') || advanced.includes('Front-Side Alignment'), false);
});

test('rightSidebarStage2: History rows reuse highlightMeasurement', () => {
  const calls = [];
  const listeners = {};
  const item = {
    className: 'history-item',
    classList: createClassList(['history-item']),
    dataset: {},
    setAttribute(name, value) {
      this.dataset[name] = String(value);
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) {
        fn({ stopPropagation() {} });
      }
    },
  };

  applyHistoryItemHighlightBehavior(item, {
    pointA: { x: 1, y: 2, z: 3 },
    pointB: { x: 4, y: 5, z: 6 },
  }, (pointA, pointB) => {
    calls.push([pointA, pointB]);
  });

  assert.equal(item.classList.contains('history-item--clickable'), true);
  assert.equal(item.dataset.role, 'button');
  item.click();
  assert.deepEqual(calls, [[{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }]]);
});

test('rightSidebarStage2: annotation activate and delete remain wired in the list renderer', () => {
  const annotationSource = readFileSync(
    fileURLToPath(new URL('./annotationPanel.js', import.meta.url)),
    'utf8',
  );
  assert.match(annotationSource, /activateProjectionLink/);
  assert.match(annotationSource, /annotation-delete-btn/);
  assert.match(annotationSource, /onDelete\(entry\.id\)/);
  assert.match(annotationSource, /formatAnnotationTypeLabel\(entry\.type\)/);
});

test('rightSidebarStage2: live UI no longer references removed Session tab IDs', () => {
  const liveFiles = [
    join(rootDir, 'index.html'),
    ...listLiveUiFiles(join(rootDir, 'src', 'ui')),
    ...listLiveUiFiles(join(rootDir, 'src', 'interactions')),
    ...listLiveUiFiles(join(rootDir, 'src', 'styles')),
    join(rootDir, 'src', 'main.js'),
  ];

  const forbidden = [
    ...REMOVED_TAB_IDS,
    ...REMOVED_BODY_TABLE_IDS,
    'setupSessionTabs',
    'sessionTabHistoryBtn',
    'scene-graph-tree',
  ];

  for (const file of liveFiles) {
    const source = readFileSync(file, 'utf8');
    for (const token of forbidden) {
      assert.equal(
        source.includes(token),
        false,
        `${file} still references removed token ${token}`,
      );
    }
  }
});

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

function createCollapsibleMock({
  classes,
  collapsed,
  headerClass,
  descendants = [],
} = {}) {
  const headerAttrs = {};
  const headerListeners = {};
  const header = {
    classList: createClassList([headerClass]),
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
    keydown(key) {
      const event = { key, preventDefault() {} };
      for (const fn of headerListeners.keydown || []) {
        fn(event);
      }
    },
    listenerCount(type) {
      return (headerListeners[type] || []).length;
    },
  };

  const attrs = new Set(['data-collapsible']);
  if (collapsed) {
    attrs.add('data-collapsed');
  }

  const section = {
    classList: createClassList([
      ...classes,
      ...(collapsed ? ['is-collapsed'] : []),
    ]),
    hasAttribute(name) {
      return attrs.has(name);
    },
    matches(selector) {
      return selector === '[data-collapsible]';
    },
    querySelector(selector) {
      if (selector === `:scope > .${headerClass}`) {
        return header;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-collapsible]') {
        return descendants;
      }
      return [];
    },
  };

  return { section, header };
}

function createDiagnosticsAccordionTree() {
  const whyBlocked = createCollapsibleMock({
    classes: ['inspector-subgroup'],
    collapsed: true,
    headerClass: 'inspector-subgroup-label',
  });
  const alignment = createCollapsibleMock({
    classes: ['inspector-subgroup'],
    collapsed: true,
    headerClass: 'inspector-subgroup-label',
  });
  const bodyAnchor = createCollapsibleMock({
    classes: ['inspector-subgroup'],
    collapsed: true,
    headerClass: 'inspector-subgroup-label',
  });
  const advancedQa = createCollapsibleMock({
    classes: ['inspector-subgroup'],
    collapsed: true,
    headerClass: 'inspector-subgroup-label',
  });
  const diagnostics = createCollapsibleMock({
    classes: ['inspector-section'],
    collapsed: true,
    headerClass: 'section-title',
    descendants: [
      whyBlocked.section,
      alignment.section,
      bodyAnchor.section,
      advancedQa.section,
    ],
  });

  return { diagnostics, whyBlocked, alignment, bodyAnchor, advancedQa };
}

test('rightSidebarStage2: Diagnostics accordion starts collapsed and toggles', () => {
  const { diagnostics } = createDiagnosticsAccordionTree();

  initCollapsibleSections(diagnostics.section);
  assert.equal(diagnostics.section.classList.contains('is-collapsed'), true);
  assert.equal(diagnostics.header.getAttribute('aria-expanded'), 'false');

  diagnostics.header.click();
  assert.equal(diagnostics.section.classList.contains('is-collapsed'), false);
  assert.equal(diagnostics.header.getAttribute('aria-expanded'), 'true');
});

test('rightSidebarStage2: Session Records markup is one expanded accordion, not History/Annotations', () => {
  const records = sliceBetween(markup, 'id="session-records-panel"', 'id="diagnostics-panel"');
  assert.match(records, /data-collapsible/);
  assert.equal(/data-collapsed/.test(records), false);
  assert.equal(/is-collapsed/.test(records), false);
  assert.match(records, /id="history-list"/);
  assert.match(records, /id="annotation-list"/);
  assert.equal(/session-records-block[^>]*data-collapsible/.test(records), false);
});

test('rightSidebarStage2: Session Records initializes expanded, toggles, and keeps History + Annotations mounted', () => {
  const mounted = {
    historyList: { id: 'history-list' },
    annotationList: { id: 'annotation-list' },
    clearHistory: { id: 'clear-history' },
  };
  const records = createCollapsibleMock({
    classes: ['inspector-section'],
    collapsed: false,
    headerClass: 'section-title',
  });
  records.section.mounted = mounted;

  initCollapsibleSections(records.section);
  assert.equal(records.section.classList.contains('is-collapsed'), false);
  assert.equal(records.header.getAttribute('aria-expanded'), 'true');
  assert.equal(records.header.getAttribute('role'), 'button');
  assert.equal(records.header.getAttribute('tabindex'), '0');

  records.header.click();
  assert.equal(records.section.classList.contains('is-collapsed'), true);
  assert.equal(records.header.getAttribute('aria-expanded'), 'false');
  assert.equal(records.section.mounted.historyList.id, 'history-list');
  assert.equal(records.section.mounted.annotationList.id, 'annotation-list');
  assert.equal(records.section.mounted.clearHistory.id, 'clear-history');

  records.header.click();
  assert.equal(records.section.classList.contains('is-collapsed'), false);
  assert.equal(records.header.getAttribute('aria-expanded'), 'true');
  assert.equal(records.section.mounted.historyList.id, 'history-list');
  assert.equal(records.section.mounted.annotationList.id, 'annotation-list');
});

test('rightSidebarStage2: Diagnostics subsections are independently collapsible and collapsed by default', () => {
  const diagnostics = sliceBetween(markup, 'id="diagnostics-panel"', 'id="bottom-status-bar"');
  const nestedIds = [
    'why-blocked-section',
    'front-side-alignment-panel',
    'body-anchor-diagnostics-panel',
    'advanced-qa-panel',
  ];

  for (const id of nestedIds) {
    const idToken = `id="${id}"`;
    const idIndex = diagnostics.indexOf(idToken);
    assert.ok(idIndex > -1, `${id} must exist in Diagnostics`);
    const tag = diagnostics.slice(diagnostics.lastIndexOf('<', idIndex), diagnostics.indexOf('>', idIndex));
    assert.match(tag, /data-collapsible/);
    assert.match(tag, /data-collapsed/);
    assert.match(tag, /is-collapsed/);
  }
});

test('rightSidebarStage2: nested Diagnostics accordions toggle independently of the outer drawer and siblings', () => {
  const tree = createDiagnosticsAccordionTree();

  initCollapsibleSections(tree.diagnostics.section);

  assert.equal(tree.diagnostics.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.whyBlocked.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.bodyAnchor.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.advancedQa.section.classList.contains('is-collapsed'), true);

  tree.diagnostics.header.click();
  assert.equal(tree.diagnostics.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.whyBlocked.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.advancedQa.section.classList.contains('is-collapsed'), true);

  tree.alignment.header.click();
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.alignment.header.getAttribute('aria-expanded'), 'true');
  assert.equal(tree.diagnostics.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.whyBlocked.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.bodyAnchor.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.advancedQa.section.classList.contains('is-collapsed'), true);

  tree.whyBlocked.header.click();
  assert.equal(tree.whyBlocked.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.advancedQa.section.classList.contains('is-collapsed'), true);

  tree.advancedQa.header.click();
  assert.equal(tree.advancedQa.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.advancedQa.header.getAttribute('aria-expanded'), 'true');
  assert.equal(tree.bodyAnchor.section.classList.contains('is-collapsed'), true);

  tree.alignment.header.keydown('Enter');
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), true);
  assert.equal(tree.diagnostics.section.classList.contains('is-collapsed'), false);

  tree.alignment.header.keydown(' ');
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), false);
  assert.equal(tree.whyBlocked.section.classList.contains('is-collapsed'), false);
});

test('rightSidebarStage2: collapsible init does not double-bind nested Diagnostics sections', () => {
  const tree = createDiagnosticsAccordionTree();

  initCollapsibleSections(tree.diagnostics.section);
  initCollapsibleSections(tree.diagnostics.section);

  assert.equal(tree.diagnostics.header.listenerCount('click'), 1);
  assert.equal(tree.whyBlocked.header.listenerCount('click'), 1);
  assert.equal(tree.alignment.header.listenerCount('click'), 1);
  assert.equal(tree.bodyAnchor.header.listenerCount('click'), 1);
  assert.equal(tree.advancedQa.header.listenerCount('click'), 1);

  tree.diagnostics.header.click();
  assert.equal(tree.diagnostics.section.classList.contains('is-collapsed'), false);
  tree.alignment.header.click();
  assert.equal(tree.alignment.section.classList.contains('is-collapsed'), false);
});

test('rightSidebarStage2: right sidebar wires Session Records and Diagnostics through one shared helper root', () => {
  const mainSource = readFileSync(join(rootDir, 'src', 'main.js'), 'utf8');
  assert.match(mainSource, /initCollapsibleSections\(document\.getElementById\('right-sidebar'\)\)/);
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

test('rightSidebarStage2: Results deck is marked data-collapsible and expanded by default', () => {
  const deck = sliceBetween(markup, 'id="derived-measurement-deck"', 'id="session-records-panel"');
  assert.match(deck, /data-collapsible/);
  assert.equal(/data-collapsed/.test(deck), false);
  assert.equal(/is-collapsed/.test(deck), false);
  assert.match(deck, /class="deck-header"/);
  assert.match(deck, /class="deck-title">Results</);
  assert.match(deck, /id="derived-measurement-cards"/);
});

test('rightSidebarStage2: Results deck initializes expanded, toggles collapse/expand, and keeps measurement cards mounted', () => {
  const mountedCards = {
    id: 'derived-measurement-cards',
    children: [
      { id: 'shoulder-card', text: 'Shoulder Level' },
      { id: 'hip-card', text: 'Hip Level' },
    ],
  };
  const resultsDeck = createCollapsibleMock({
    classes: ['derived-measurement-deck'],
    collapsed: false,
    headerClass: 'deck-header',
  });
  resultsDeck.section.mounted = mountedCards;

  initCollapsibleSections(resultsDeck.section);
  assert.equal(resultsDeck.section.classList.contains('is-collapsed'), false);
  assert.equal(resultsDeck.header.getAttribute('aria-expanded'), 'true');
  assert.equal(resultsDeck.header.getAttribute('role'), 'button');
  assert.equal(resultsDeck.header.getAttribute('tabindex'), '0');

  // Collapse Results
  resultsDeck.header.click();
  assert.equal(resultsDeck.section.classList.contains('is-collapsed'), true);
  assert.equal(resultsDeck.header.getAttribute('aria-expanded'), 'false');
  assert.equal(resultsDeck.section.mounted.id, 'derived-measurement-cards');
  assert.equal(resultsDeck.section.mounted.children.length, 2);

  // Expand Results
  resultsDeck.header.click();
  assert.equal(resultsDeck.section.classList.contains('is-collapsed'), false);
  assert.equal(resultsDeck.header.getAttribute('aria-expanded'), 'true');
  assert.equal(resultsDeck.section.mounted.id, 'derived-measurement-cards');
  assert.equal(resultsDeck.section.mounted.children.length, 2);
});

test('rightSidebarStage2: QA key-value styles prevent awkward word breaking on short technical labels', () => {
  const css = readFileSync(join(rootDir, 'src', 'styles', 'components.css'), 'utf8');
  assert.match(css, /\.info-label\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.info-value\s*\{[^}]*overflow-wrap:\s*break-word/);
  assert.match(css, /\.advanced-qa-section \.info-label\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.deck-header--collapsible/);
});

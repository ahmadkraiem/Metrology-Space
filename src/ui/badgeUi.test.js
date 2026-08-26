import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, badgeClassForTone, renderBadge } from './badgeUi.js';

test('badgeUi: escapeHtml escapes special HTML characters properly', () => {
  assert.equal(escapeHtml('<div>&"\'</div>'), '&lt;div&gt;&amp;&quot;\'&lt;/div&gt;');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(123), '123');
});

test('badgeUi: badgeClassForTone returns appropriate class names', () => {
  assert.equal(badgeClassForTone('ok'), 'body-evidence-badge body-evidence-badge--ok');
  assert.equal(badgeClassForTone('warn'), 'body-evidence-badge body-evidence-badge--warn');
  assert.equal(badgeClassForTone('muted'), 'body-evidence-badge body-evidence-badge--muted');
  assert.equal(badgeClassForTone('default'), 'body-evidence-badge');
  assert.equal(badgeClassForTone(), 'body-evidence-badge');
});

test('badgeUi: renderBadge renders formatted badge html string with optional title', () => {
  assert.equal(
    renderBadge('PASS', 'ok'),
    '<span class="body-evidence-badge body-evidence-badge--ok">PASS</span>',
  );
  assert.equal(
    renderBadge('Warning', 'warn', 'Check details'),
    '<span class="body-evidence-badge body-evidence-badge--warn" title="Check details">Warning</span>',
  );
  assert.equal(
    renderBadge('<script>', 'muted'),
    '<span class="body-evidence-badge body-evidence-badge--muted">&lt;script&gt;</span>',
  );
});

test('badgeUi: status badges render full semantic strings without ellipsis truncation', () => {
  const localizedHtml = renderBadge('Localized', 'ok');
  assert.ok(localizedHtml.includes('Localized'), 'Localized is rendered in full');
  assert.ok(!localizedHtml.includes('Locali...'), 'No truncated substring');

  const metricProjectedHtml = renderBadge('Metric Projected', 'ok');
  assert.ok(metricProjectedHtml.includes('Metric Projected'), 'Metric Projected is rendered in full');
  assert.ok(!metricProjectedHtml.includes('Metric Proje...'), 'No truncated substring');
});

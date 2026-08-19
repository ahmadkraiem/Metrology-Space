import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFrontSideAlignmentHtml,
} from './frontSideAlignmentPanel.js';

test('buildFrontSideAlignmentHtml returns empty state when evidence is not analyzed', () => {
  const html = buildFrontSideAlignmentHtml(null, { hasAnalyzed: false });
  assert.match(html, /No body evidence analyzed/);
});

test('buildFrontSideAlignmentHtml returns empty state when analyzed evidence has 0 candidates', () => {
  const html = buildFrontSideAlignmentHtml(null, {
    hasAnalyzed: true,
    frontCount: 0,
    sideCount: 0,
  });
  assert.match(html, /No body landmark candidates found in analyzed evidence/);
});

test('buildFrontSideAlignmentHtml handles Front-only evidence with grouped Issues', () => {
  const mockReport = {
    contract: 'front-side-alignment-v0',
    version: 'front-side-alignment-v0',
    toleranceCm: 5.0,
    summary: {
      totalFront: 2,
      totalSide: 0,
      totalMatched: 0,
      alignedCount: 0,
      warningCount: 0,
      unavailableCount: 0,
      frontOnlyCount: 2,
      sideOnlyCount: 0,
      coreMatchedCount: 0,
      secondaryMatchedCount: 0,
    },
    matchedPairs: [],
    frontOnly: [
      {
        identity: 'left_shoulder',
        name: 'left_shoulder',
        classification: 'core',
        front: { x: 120.0, y: 150.0 },
        status: 'unavailable',
        reason: 'missing-in-side',
      },
      {
        identity: 'left_acromion',
        name: 'left_acromion',
        classification: 'secondary',
        front: { x: 125.0, y: 152.0 },
        status: 'unavailable',
        reason: 'missing-in-side',
      },
    ],
    sideOnly: [],
  };

  const html = buildFrontSideAlignmentHtml(mockReport, {
    hasAnalyzed: true,
    frontCount: 2,
    sideCount: 0,
  });

  assert.match(html, /Front evidence analyzed/);
  assert.match(html, /no Side candidates available/);
  assert.match(html, /Core Pairs \(0\)/);
  assert.match(html, /Secondary Pairs \(0\)/);
  assert.match(html, /Issues \(2\)/);
  assert.match(html, /Left Shoulder/);
  assert.match(html, /Left Acromion/);
  assert.match(html, /missing-in-side/);
  assert.match(html, /Front:\s*<\/span>\s*<span[^>]*>X 120 · Y 150/);
  assert.match(html, /Side:\s*<\/span>\s*<span[^>]*>missing/);
});

test('buildFrontSideAlignmentHtml handles Side-only evidence with grouped Issues', () => {
  const mockReport = {
    contract: 'front-side-alignment-v0',
    version: 'front-side-alignment-v0',
    toleranceCm: 5.0,
    summary: {
      totalFront: 0,
      totalSide: 1,
      totalMatched: 0,
      alignedCount: 0,
      warningCount: 0,
      unavailableCount: 0,
      frontOnlyCount: 0,
      sideOnlyCount: 1,
      coreMatchedCount: 0,
      secondaryMatchedCount: 0,
    },
    matchedPairs: [],
    frontOnly: [],
    sideOnly: [
      {
        identity: 'right_hip',
        name: 'right_hip',
        classification: 'core',
        side: { u: 100.0, y: 90.0 },
        status: 'unavailable',
        reason: 'missing-in-front',
      },
    ],
  };

  const html = buildFrontSideAlignmentHtml(mockReport, {
    hasAnalyzed: true,
    frontCount: 0,
    sideCount: 1,
  });

  assert.match(html, /Side evidence analyzed/);
  assert.match(html, /no Front candidates available/);
  assert.match(html, /Core Pairs \(0\)/);
  assert.match(html, /Secondary Pairs \(0\)/);
  assert.match(html, /Issues \(1\)/);
  assert.match(html, /Right Hip/);
  assert.match(html, /missing-in-front/);
  assert.match(html, /Front:\s*<\/span>\s*<span[^>]*>missing/);
  assert.match(html, /Side:\s*<\/span>\s*<span[^>]*>U 100 · Y 90/);
});

test('buildFrontSideAlignmentHtml groups matched pairs into Core, Secondary, and Issues with collapsed defaults', () => {
  const mockReport = {
    contract: 'front-side-alignment-v0',
    version: 'front-side-alignment-v0',
    toleranceCm: 5.0,
    summary: {
      totalFront: 4,
      totalSide: 4,
      totalMatched: 3,
      alignedCount: 2,
      warningCount: 1,
      unavailableCount: 0,
      frontOnlyCount: 1,
      sideOnlyCount: 1,
      coreMatchedCount: 2,
      secondaryMatchedCount: 1,
    },
    matchedPairs: [
      {
        identity: 'left_shoulder',
        name: 'left_shoulder',
        classification: 'core',
        front: { x: 120.0, y: 150.0 },
        side: { u: 95.0, y: 151.5 },
        verticalDeltaCm: 1.5,
        status: 'aligned',
      },
      {
        identity: 'right_shoulder',
        name: 'right_shoulder',
        classification: 'core',
        front: { x: 80.0, y: 150.0 },
        side: { u: 95.0, y: 142.0 },
        verticalDeltaCm: 8.0,
        status: 'warning',
      },
      {
        identity: 'left_acromion',
        name: 'left_acromion',
        classification: 'secondary',
        front: { x: 125.0, y: 152.0 },
        side: { u: 96.0, y: 152.0 },
        verticalDeltaCm: 0.0,
        status: 'aligned',
      },
    ],
    frontOnly: [
      {
        identity: 'left_wrist',
        name: 'left_wrist',
        classification: 'core',
        front: { x: 140.0, y: 90.0 },
        status: 'unavailable',
        reason: 'missing-in-side',
      },
    ],
    sideOnly: [
      {
        identity: 'right_ankle',
        name: 'right_ankle',
        classification: 'core',
        side: { u: 102.0, y: 15.0 },
        status: 'unavailable',
        reason: 'missing-in-front',
      },
    ],
  };

  const html = buildFrontSideAlignmentHtml(mockReport, {
    hasAnalyzed: true,
    frontCount: 4,
    sideCount: 4,
  });

  // Top summary checks
  assert.match(html, /Tolerance[\s\S]*5\.0 cm/);
  assert.match(html, /Matched[\s\S]*3/);
  assert.match(html, /Aligned[\s\S]*2/);
  assert.match(html, /Warnings[\s\S]*1/);
  assert.match(html, /Core Matched[\s\S]*2/);
  assert.match(html, /Secondary Matched[\s\S]*1/);
  assert.match(html, /Vertical Y agreement only · tolerance 5\.0 cm/);
  assert.match(html, /Side U is profile evidence — NOT depth Z/);

  // Group headers and counts
  assert.match(html, /Core Pairs \(2\)/);
  assert.match(html, /Secondary Pairs \(1\)/);
  // Total issues = 1 warning matched pair + 1 frontOnly + 1 sideOnly = 3 issues
  assert.match(html, /Issues \(3\)/);

  // Default state check: none of the details should have open attribute
  assert.equal(html.includes('<details class="body-evidence-qa-subgroup" open>'), false);
  assert.equal(html.includes('<details class="body-evidence-qa-subgroup" open="'), false);

  // Compact row format check (Line 1: name, type, delta, status; Line 2: Front coords, Side coords)
  assert.match(html, /Left Shoulder[\s\S]*Core[\s\S]*ΔY 1\.5 cm[\s\S]*aligned/);
  assert.match(html, /Front:\s*<\/span>\s*<span[^>]*>X 120 · Y 150[\s\S]*Side:\s*<\/span>\s*<span[^>]*>U 95 · Y 151\.5/);

  // Warning styling on delta
  assert.match(html, /Right Shoulder[\s\S]*Core[\s\S]*front-side-alignment-compact-delta--warn[\s\S]*ΔY 8\.0 cm[\s\S]*warning/);

  // Secondary pair row check
  assert.match(html, /Left Acromion[\s\S]*Secondary[\s\S]*ΔY 0\.0 cm[\s\S]*aligned/);

  // Issues section items
  assert.match(html, /Left Wrist[\s\S]*missing-in-side/);
  assert.match(html, /Right Ankle[\s\S]*missing-in-front/);
});

test('buildFrontSideAlignmentHtml maintains strict geometry guardrail (no Z or depth output)', () => {
  const mockReport = {
    contract: 'front-side-alignment-v0',
    version: 'front-side-alignment-v0',
    toleranceCm: 5.0,
    summary: {
      totalFront: 1,
      totalSide: 1,
      totalMatched: 1,
      alignedCount: 1,
      warningCount: 0,
      unavailableCount: 0,
      frontOnlyCount: 0,
      sideOnlyCount: 0,
      coreMatchedCount: 1,
      secondaryMatchedCount: 0,
    },
    matchedPairs: [
      {
        identity: 'neck',
        name: 'neck',
        classification: 'core',
        front: { x: 100.0, y: 160.0 },
        side: { u: 100.0, y: 160.0 },
        verticalDeltaCm: 0.0,
        status: 'aligned',
      },
    ],
    frontOnly: [],
    sideOnly: [],
  };

  const html = buildFrontSideAlignmentHtml(mockReport, {
    hasAnalyzed: true,
    frontCount: 1,
    sideCount: 1,
  });

  // Coordinates must be X/Y for Front and U/Y for Side only
  assert.match(html, /X 100 · Y 160/);
  assert.match(html, /U 100 · Y 160/);
  assert.equal(/Z\s*\d/.test(html), false);
  assert.equal(/depth\s*=\s*"\d"/i.test(html), false);
});

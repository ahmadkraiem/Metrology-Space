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

test('buildFrontSideAlignmentHtml handles Front-only evidence cleanly', () => {
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
  assert.match(html, /Front Only \(2\)/);
  assert.match(html, /Left Shoulder/);
  assert.match(html, /Left Acromion/);
  assert.match(html, /missing-in-side/);
  assert.match(html, /Front:\s*<\/span>\s*<span[^>]*>X 120 · Y 150/);
});

test('buildFrontSideAlignmentHtml handles Side-only evidence cleanly', () => {
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
  assert.match(html, /Side Only \(1\)/);
  assert.match(html, /Right Hip/);
  assert.match(html, /missing-in-front/);
  assert.match(html, /Side:\s*<\/span>\s*<span[^>]*>U 100 · Y 90/);
});

test('buildFrontSideAlignmentHtml renders full summary, matched pairs, and unmatched items', () => {
  const mockReport = {
    contract: 'front-side-alignment-v0',
    version: 'front-side-alignment-v0',
    toleranceCm: 5.0,
    summary: {
      totalFront: 3,
      totalSide: 3,
      totalMatched: 2,
      alignedCount: 1,
      warningCount: 1,
      unavailableCount: 0,
      frontOnlyCount: 1,
      sideOnlyCount: 1,
      coreMatchedCount: 1,
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
        identity: 'left_acromion',
        name: 'left_acromion',
        classification: 'secondary',
        front: { x: 125.0, y: 152.0 },
        side: { u: 96.0, y: 144.0 },
        verticalDeltaCm: 8.0,
        status: 'warning',
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
    frontCount: 3,
    sideCount: 3,
  });

  // Summary card checks
  assert.match(html, /Tolerance[\s\S]*5\.0 cm/);
  assert.match(html, /Matched[\s\S]*2/);
  assert.match(html, /Aligned[\s\S]*1/);
  assert.match(html, /Warnings[\s\S]*1/);
  assert.match(html, /Core Matched[\s\S]*1/);
  assert.match(html, /Secondary Matched[\s\S]*1/);

  // Guardrail notice checks
  assert.match(html, /Vertical Y agreement only · tolerance 5\.0 cm/);
  assert.match(html, /Side U is profile evidence — NOT depth Z/);

  // Matched pairs table checks
  assert.match(html, /Left Shoulder/);
  assert.match(html, /Core/);
  assert.match(html, /aligned/);
  assert.match(html, /Front:[\s\S]*X 120 · Y 150/);
  assert.match(html, /Side:[\s\S]*U 95 · Y 151\.5/);
  assert.match(html, /ΔY:[\s\S]*1\.5 cm/);

  // Warning pair checks
  assert.match(html, /Left Acromion/);
  assert.match(html, /Secondary/);
  assert.match(html, /warning/);
  assert.match(html, /ΔY:[\s\S]*8\.0 cm/);
  assert.match(html, /front-side-alignment-delta-value--warn/);

  // Unmatched subsections
  assert.match(html, /Front Only \(1\)/);
  assert.match(html, /Left Wrist/);
  assert.match(html, /missing-in-side/);

  assert.match(html, /Side Only \(1\)/);
  assert.match(html, /Right Ankle/);
  assert.match(html, /missing-in-front/);
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

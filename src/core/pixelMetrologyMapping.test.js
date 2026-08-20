import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_WORKSPACE_EXTENT_CM,
  PIXEL_METROLOGY_CONTRACT_NAME,
  PIXEL_METROLOGY_CONTRACT_VERSION,
  boundsPxToFrontMetrology,
  boundsPxToSideMetrology,
  canonicalYToPixelRow,
  frontMetrologyToImagePoint,
  imagePointToFrontMetrology,
  imagePointToSideMetrology,
  pixelCenterToFrontMetrology,
  pixelCenterToSideMetrology,
  pixelColumnSpanToFrontMetrology,
  pixelColumnSpanToSideMetrology,
  sideMetrologyToImagePoint,
  validateBoundsPx,
} from './pixelMetrologyMapping.js';

test('Contract version and default constants are correctly exposed', () => {
  assert.equal(PIXEL_METROLOGY_CONTRACT_NAME, 'pixel-metrology-v0');
  assert.equal(PIXEL_METROLOGY_CONTRACT_VERSION, 'pixel-metrology-v0');
  assert.equal(DEFAULT_WORKSPACE_EXTENT_CM, 200);
});

test('2000x2000 raster: first and last pixel centers map strictly inside the 0..200 cm domain', () => {
  const width = 2000;
  const height = 2000;

  // First pixel center: (col=0, row=0) -> (x=0.5, y=0.5) px
  const frontFirst = pixelCenterToFrontMetrology(0, 0, width, height);
  assert.equal(frontFirst.x, 0.05);
  assert.equal(frontFirst.y, 199.95);

  const sideFirst = pixelCenterToSideMetrology(0, 0, width, height);
  assert.equal(sideFirst.u, 0.05);
  assert.equal(sideFirst.y, 199.95);

  // Last pixel center: (col=1999, row=1999) -> (x=1999.5, y=1999.5) px
  const frontLast = pixelCenterToFrontMetrology(1999, 1999, width, height);
  assert.equal(frontLast.x, 199.95);
  assert.equal(frontLast.y, 0.05);

  const sideLast = pixelCenterToSideMetrology(1999, 1999, width, height);
  assert.equal(sideLast.u, 199.95);
  assert.equal(sideLast.y, 0.05);

  // Center pixel of 2000x2000: (col=1000, row=1000) -> (x=1000.5, y=1000.5) px
  const frontMid = pixelCenterToFrontMetrology(1000, 1000, width, height);
  assert.equal(frontMid.x, 100.05);
  assert.equal(frontMid.y, 99.95);

  // Pixel center support for object signature { col, row }
  const frontObj = pixelCenterToFrontMetrology({ col: 0, row: 0 }, width, height);
  assert.deepEqual(frontObj, frontFirst);
});

test('Continuous image edges map exactly to 0 and 200 cm metrology domain boundaries', () => {
  const width = 2000;
  const height = 2000;

  // Top-left continuous edge: (x=0, y=0)
  const frontTopLeft = imagePointToFrontMetrology(0, 0, width, height);
  assert.equal(frontTopLeft.x, 0.0);
  assert.equal(frontTopLeft.y, 200.0);

  const sideTopLeft = imagePointToSideMetrology(0, 0, width, height);
  assert.equal(sideTopLeft.u, 0.0);
  assert.equal(sideTopLeft.y, 200.0);

  // Bottom-right continuous edge: (x=2000, y=2000)
  const frontBottomRight = imagePointToFrontMetrology(2000, 2000, width, height);
  assert.equal(frontBottomRight.x, 200.0);
  assert.equal(frontBottomRight.y, 0.0);

  const sideBottomRight = imagePointToSideMetrology(2000, 2000, width, height);
  assert.equal(sideBottomRight.u, 200.0);
  assert.equal(sideBottomRight.y, 0.0);

  // Top-right continuous edge: (x=2000, y=0)
  const frontTopRight = imagePointToFrontMetrology(2000, 0, width, height);
  assert.equal(frontTopRight.x, 200.0);
  assert.equal(frontTopRight.y, 200.0);

  // Bottom-left continuous edge: (x=0, y=2000)
  const frontBottomLeft = imagePointToFrontMetrology(0, 2000, width, height);
  assert.equal(frontBottomLeft.x, 0.0);
  assert.equal(frontBottomLeft.y, 0.0);

  // Object signature { x, y }
  const frontObj = imagePointToFrontMetrology({ x: 0, y: 0 }, width, height);
  assert.deepEqual(frontObj, frontTopLeft);
});

test('Full-image bounding box maps exactly to 0..200 cm metrology bounds', () => {
  const width = 2000;
  const height = 2000;
  const fullBbox = { minX: 0, minY: 0, maxX: 1999, maxY: 1999 };

  const frontMetric = boundsPxToFrontMetrology(fullBbox, width, height);
  assert.deepEqual(frontMetric, {
    minX: 0.0,
    maxX: 200.0,
    minY: 0.0,
    maxY: 200.0,
  });

  const sideMetric = boundsPxToSideMetrology(fullBbox, width, height);
  assert.deepEqual(sideMetric, {
    minU: 0.0,
    maxU: 200.0,
    minY: 0.0,
    maxY: 200.0,
  });
});

test('Single-pixel bounding box produces non-zero metric area with correct outer edges and Y inversion', () => {
  const width = 2000;
  const height = 2000;

  // Single pixel at col 100, row 200
  const singlePixel = { minX: 100, minY: 200, maxX: 100, maxY: 200 };

  const frontMetric = boundsPxToFrontMetrology(singlePixel, width, height);
  assert.equal(frontMetric.minX, 10.0); // 100 / 2000 * 200
  assert.equal(frontMetric.maxX, 10.1); // 101 / 2000 * 200
  assert.equal(frontMetric.minY, 179.9); // (1 - 201 / 2000) * 200
  assert.equal(frontMetric.maxY, 180.0); // (1 - 200 / 2000) * 200

  // Metric width and height are exactly 1 pixel width in cm
  const spanX = frontMetric.maxX - frontMetric.minX;
  const spanY = frontMetric.maxY - frontMetric.minY;
  assert.equal(Math.round(spanX * 1000) / 1000, 0.1);
  assert.equal(Math.round(spanY * 1000) / 1000, 0.1);
  assert.equal(spanX > 0, true);
  assert.equal(spanY > 0, true);

  // Side metric mapping preserves U/Y separation
  const sideMetric = boundsPxToSideMetrology(singlePixel, width, height);
  assert.equal(sideMetric.minU, 10.0);
  assert.equal(sideMetric.maxU, 10.1);
  assert.equal(sideMetric.minY, 179.9);
  assert.equal(sideMetric.maxY, 180.0);
});

test('Non-square raster scales each axis independently without geometric distortion', () => {
  const width = 1000; // 1000 px across 200 cm -> 5 px/cm (0.2 cm/px)
  const height = 500;  // 500 px across 200 cm -> 2.5 px/cm (0.4 cm/px)

  // Pixel center (col=0, row=0)
  const frontCenter = pixelCenterToFrontMetrology(0, 0, width, height);
  assert.equal(frontCenter.x, (0.5 / 1000) * 200); // 0.1 cm
  assert.equal(frontCenter.y, (1 - 0.5 / 500) * 200); // 199.8 cm

  // Continuous point (x=500, y=250) -> exact midpoint
  const frontMid = imagePointToFrontMetrology(500, 250, width, height);
  assert.equal(frontMid.x, 100.0);
  assert.equal(frontMid.y, 100.0);

  // Bounding box mapping on non-square raster
  const bbox = { minX: 100, minY: 100, maxX: 200, maxY: 150 };
  const frontBbox = boundsPxToFrontMetrology(bbox, width, height);
  assert.equal(frontBbox.minX, (100 / 1000) * 200); // 20.0 cm
  assert.equal(frontBbox.maxX, (201 / 1000) * 200); // 40.2 cm
  assert.equal(frontBbox.minY, (1 - 151 / 500) * 200); // 139.6 cm
  assert.equal(frontBbox.maxY, (1 - 100 / 500) * 200); // 160.0 cm
});

test('Continuous forward and inverse round-trip conversions are exact', () => {
  const width = 1920;
  const height = 1080;

  const testPoints = [
    { x: 0, y: 0 },
    { x: 1920, y: 1080 },
    { x: 960, y: 540 },
    { x: 123.456, y: 789.012 },
    { x: 0.5, y: 0.5 },
  ];

  for (const pt of testPoints) {
    // Front round-trip
    const frontCm = imagePointToFrontMetrology(pt.x, pt.y, width, height);
    const frontRecovered = frontMetrologyToImagePoint(frontCm.x, frontCm.y, width, height);
    assert.equal(Math.abs(frontRecovered.x - pt.x) < 1e-10, true);
    assert.equal(Math.abs(frontRecovered.y - pt.y) < 1e-10, true);

    // Side round-trip
    const sideCm = imagePointToSideMetrology(pt.x, pt.y, width, height);
    const sideRecovered = sideMetrologyToImagePoint(sideCm.u, sideCm.y, width, height);
    assert.equal(Math.abs(sideRecovered.x - pt.x) < 1e-10, true);
    assert.equal(Math.abs(sideRecovered.y - pt.y) < 1e-10, true);
  }
});

test('Custom workspace extent is respected across all mappings', () => {
  const width = 1000;
  const height = 1000;
  const customExtent = 100; // 100 cm workspace

  // Pixel center
  const center = pixelCenterToFrontMetrology(0, 0, width, height, customExtent);
  assert.equal(center.x, 0.05); // 0.5 / 1000 * 100
  assert.equal(center.y, 99.95); // (1 - 0.5 / 1000) * 100

  // Continuous point
  const pt = imagePointToSideMetrology(1000, 1000, width, height, customExtent);
  assert.equal(pt.u, 100.0);
  assert.equal(pt.y, 0.0);

  // Bounding box
  const bbox = { minX: 0, minY: 0, maxX: 999, maxY: 999 };
  const frontBbox = boundsPxToFrontMetrology(bbox, width, height, customExtent);
  assert.deepEqual(frontBbox, { minX: 0, maxX: 100, minY: 0, maxY: 100 });
});

test('Strict Geometry Guardrails: Front and Side outputs remain strictly isolated with no Z or depth', () => {
  const width = 2000;
  const height = 2000;

  const frontCenter = pixelCenterToFrontMetrology(100, 200, width, height);
  assert.equal('x' in frontCenter, true);
  assert.equal('y' in frontCenter, true);
  assert.equal('u' in frontCenter, false);
  assert.equal('z' in frontCenter, false);
  assert.equal('depth' in frontCenter, false);

  const sideCenter = pixelCenterToSideMetrology(100, 200, width, height);
  assert.equal('u' in sideCenter, true);
  assert.equal('y' in sideCenter, true);
  assert.equal('x' in sideCenter, false);
  assert.equal('z' in sideCenter, false);
  assert.equal('depth' in sideCenter, false);

  const frontBbox = boundsPxToFrontMetrology({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, width, height);
  assert.equal('minX' in frontBbox, true);
  assert.equal('maxX' in frontBbox, true);
  assert.equal('minU' in frontBbox, false);
  assert.equal('maxU' in frontBbox, false);
  assert.equal('z' in frontBbox, false);

  const sideBbox = boundsPxToSideMetrology({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, width, height);
  assert.equal('minU' in sideBbox, true);
  assert.equal('maxU' in sideBbox, true);
  assert.equal('minX' in sideBbox, false);
  assert.equal('maxX' in sideBbox, false);
  assert.equal('z' in sideBbox, false);
});

test('Inverse mapping supports object arguments and validates inputs cleanly', () => {
  const width = 2000;
  const height = 2000;

  const ptFront = frontMetrologyToImagePoint({ x: 100, y: 100 }, width, height);
  assert.equal(ptFront.x, 1000);
  assert.equal(ptFront.y, 1000);

  const ptSide = sideMetrologyToImagePoint({ u: 50, y: 150 }, width, height);
  assert.equal(ptSide.x, 500);
  assert.equal(ptSide.y, 500);
});

test('Validation: rejects invalid raster dimensions without silent clamping', () => {
  assert.throws(
    () => pixelCenterToFrontMetrology(0, 0, 0, 2000),
    RangeError,
  );
  assert.throws(
    () => pixelCenterToFrontMetrology(0, 0, -100, 2000),
    RangeError,
  );
  assert.throws(
    () => imagePointToFrontMetrology(0, 0, 2000, 0),
    RangeError,
  );
  assert.throws(
    () => imagePointToFrontMetrology(0, 0, 2000, -500),
    RangeError,
  );
  assert.throws(
    () => boundsPxToFrontMetrology({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, NaN, 2000),
    RangeError,
  );
  assert.throws(
    () => pixelCenterToFrontMetrology(0, 0, 1000.5, 2000),
    TypeError,
  );
});

test('Validation: rejects out-of-range or non-integer pixel indices without silent clamping', () => {
  const width = 2000;
  const height = 2000;

  // Negative column
  assert.throws(
    () => pixelCenterToFrontMetrology(-1, 0, width, height),
    RangeError,
  );
  // Column out of upper bound (col >= W)
  assert.throws(
    () => pixelCenterToFrontMetrology(2000, 0, width, height),
    RangeError,
  );
  // Negative row
  assert.throws(
    () => pixelCenterToSideMetrology(0, -1, width, height),
    RangeError,
  );
  // Row out of upper bound (row >= H)
  assert.throws(
    () => pixelCenterToSideMetrology(0, 2000, width, height),
    RangeError,
  );
  // Non-integer index
  assert.throws(
    () => pixelCenterToFrontMetrology(0.5, 0, width, height),
    TypeError,
  );
  assert.throws(
    () => pixelCenterToSideMetrology(0, 1.2, width, height),
    TypeError,
  );
  assert.throws(
    () => pixelCenterToFrontMetrology(NaN, 0, width, height),
    TypeError,
  );
});

test('Validation: rejects non-finite continuous coordinates', () => {
  const width = 2000;
  const height = 2000;

  assert.throws(
    () => imagePointToFrontMetrology(NaN, 0, width, height),
    TypeError,
  );
  assert.throws(
    () => imagePointToSideMetrology(0, Infinity, width, height),
    TypeError,
  );
  assert.throws(
    () => frontMetrologyToImagePoint(NaN, 0, width, height),
    TypeError,
  );
  assert.throws(
    () => sideMetrologyToImagePoint(0, -Infinity, width, height),
    TypeError,
  );
});

test('Validation: rejects continuous image coordinates outside [0, widthPx] x [0, heightPx] without silent clamping', () => {
  const width = 2000;
  const height = 2000;

  // Negative x
  assert.throws(
    () => imagePointToFrontMetrology(-0.1, 1000, width, height),
    RangeError,
  );
  // x > widthPx
  assert.throws(
    () => imagePointToFrontMetrology(2000.1, 1000, width, height),
    RangeError,
  );
  // Negative y
  assert.throws(
    () => imagePointToSideMetrology(1000, -0.5, width, height),
    RangeError,
  );
  // y > heightPx
  assert.throws(
    () => imagePointToSideMetrology(1000, 2000.5, width, height),
    RangeError,
  );
});

test('Validation: rejects metrology coordinates outside [0, workspaceExtentCm] without silent clamping', () => {
  const width = 2000;
  const height = 2000;
  const extent = 200;

  // Negative X / U
  assert.throws(
    () => frontMetrologyToImagePoint(-0.01, 100, width, height, extent),
    RangeError,
  );
  assert.throws(
    () => sideMetrologyToImagePoint(-1, 100, width, height, extent),
    RangeError,
  );
  // X / U > workspaceExtentCm
  assert.throws(
    () => frontMetrologyToImagePoint(200.01, 100, width, height, extent),
    RangeError,
  );
  assert.throws(
    () => sideMetrologyToImagePoint(201, 100, width, height, extent),
    RangeError,
  );
  // Negative Y
  assert.throws(
    () => frontMetrologyToImagePoint(100, -0.1, width, height, extent),
    RangeError,
  );
  // Y > workspaceExtentCm
  assert.throws(
    () => sideMetrologyToImagePoint(100, 200.5, width, height, extent),
    RangeError,
  );
});

test('Validation: rejects invalid boundsPx structures and ranges', () => {
  const width = 2000;
  const height = 2000;

  // Non-object
  assert.throws(() => validateBoundsPx(null, width, height), TypeError);
  assert.throws(() => validateBoundsPx(undefined, width, height), TypeError);
  assert.throws(() => validateBoundsPx('invalid', width, height), TypeError);

  // Missing / non-integer fields
  assert.throws(() => validateBoundsPx({ minX: 0, minY: 0, maxX: 10 }, width, height), TypeError);
  assert.throws(() => validateBoundsPx({ minX: 0.5, minY: 0, maxX: 10, maxY: 10 }, width, height), TypeError);
  assert.throws(() => validateBoundsPx({ minX: 0, minY: NaN, maxX: 10, maxY: 10 }, width, height), TypeError);

  // minX > maxX
  assert.throws(
    () => validateBoundsPx({ minX: 500, minY: 100, maxX: 400, maxY: 200 }, width, height),
    RangeError,
  );
  // minY > maxY
  assert.throws(
    () => validateBoundsPx({ minX: 100, minY: 300, maxX: 200, maxY: 200 }, width, height),
    RangeError,
  );
  // Negative indices
  assert.throws(
    () => validateBoundsPx({ minX: -1, minY: 0, maxX: 100, maxY: 100 }, width, height),
    RangeError,
  );
  // Indices exceeding width/height
  assert.throws(
    () => validateBoundsPx({ minX: 0, minY: 0, maxX: 2000, maxY: 100 }, width, height),
    RangeError,
  );
  assert.throws(
    () => validateBoundsPx({ minX: 0, minY: 0, maxX: 100, maxY: 2000 }, width, height),
    RangeError,
  );
});

test('Validation: rejects non-positive workspaceExtentCm', () => {
  const width = 2000;
  const height = 2000;

  assert.throws(
    () => pixelCenterToFrontMetrology(0, 0, width, height, 0),
    RangeError,
  );
  assert.throws(
    () => imagePointToFrontMetrology(0, 0, width, height, -200),
    RangeError,
  );
  assert.throws(
    () => boundsPxToFrontMetrology({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, width, height, NaN),
    RangeError,
  );
});

test('canonicalYToPixelRow: maps canonical vertical heights to discrete image rows and normalized V', () => {
  const heightPx = 2000;

  // yCm = 200 (top of canonical domain) -> row 0, normalizedV = 0
  const top = canonicalYToPixelRow(200, heightPx, 200);
  assert.ok(top);
  assert.equal(top.row, 0);
  assert.equal(top.normalizedV, 0);

  // yCm = 0 (bottom of canonical domain) -> row 1999, normalizedV = 1
  const bottom = canonicalYToPixelRow(0, heightPx, 200);
  assert.ok(bottom);
  assert.equal(bottom.row, 1999);
  assert.equal(bottom.normalizedV, 1);

  // Midpoint yCm = 100 -> row 1000, normalizedV = 0.5
  const mid = canonicalYToPixelRow(100, heightPx, 200);
  assert.ok(mid);
  assert.equal(mid.row, 1000);
  assert.equal(mid.normalizedV, 0.5);

  // Out of bounds / invalid inputs return null (no silent clamping)
  assert.equal(canonicalYToPixelRow(-1, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(201, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(NaN, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(Infinity, heightPx, 200), null);
  assert.equal(canonicalYToPixelRow(100, -10, 200), null);
  assert.equal(canonicalYToPixelRow(100, 0, 200), null);
  assert.equal(canonicalYToPixelRow(100, 2000.5, 200), null);
});

test('pixelColumnSpanToSideMetrology: maps column spans to normalized U and metric U cm bounds', () => {
  const widthPx = 2000;

  // Single pixel column [500, 500]
  const single = pixelColumnSpanToSideMetrology(500, 500, widthPx, 200);
  assert.ok(single);
  assert.equal(single.boundsNormalized.minU, 500 / 2000); // 0.25
  assert.equal(single.boundsNormalized.maxU, 501 / 2000); // 0.2505
  assert.equal(single.boundsCm.minU, 50.0);
  assert.equal(single.boundsCm.maxU, 50.1);

  // Multi-column span [200, 799] (600 pixels)
  const span = pixelColumnSpanToSideMetrology(200, 799, widthPx, 200);
  assert.ok(span);
  assert.equal(span.boundsNormalized.minU, 0.1);
  assert.equal(span.boundsNormalized.maxU, 0.4);
  assert.equal(span.boundsCm.minU, 20.0);
  assert.equal(span.boundsCm.maxU, 80.0);

  // Invalid spans return null
  assert.equal(pixelColumnSpanToSideMetrology(-1, 500, widthPx, 200), null);
  assert.equal(pixelColumnSpanToSideMetrology(500, 2000, widthPx, 200), null);
  assert.equal(pixelColumnSpanToSideMetrology(600, 500, widthPx, 200), null);
  assert.equal(pixelColumnSpanToSideMetrology(NaN, 500, widthPx, 200), null);
  assert.equal(pixelColumnSpanToSideMetrology(500, NaN, widthPx, 200), null);
  assert.equal(pixelColumnSpanToSideMetrology(500, 500, 0, 200), null);
});


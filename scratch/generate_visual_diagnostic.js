import fs from 'node:fs';
import path from 'node:path';
import * as fflate from 'fflate';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getBustApexPlaneLocalizationReport,
  getNaturalWaistPlaneLocalizationReport,
  getSideAnteriorPosteriorOrientation,
  getTorsoArbitraryYEvidenceScan,
} from '../src/features/bodyEvidence.js';
import { computeAnatomicalLevels } from '../src/features/anatomicalLevels.js';

async function main() {
  const zipPath = 'c:/Users/VIP/Documents/work-latent-space/output.zip';
  const zipBuffer = fs.readFileSync(zipPath);
  const unzipped = fflate.unzipSync(new Uint8Array(zipBuffer));

  const scratchDir = 'c:/Users/VIP/Documents/Projects/latent-space/scratch';
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // Extract aligned PNG images
  const frontImgBytes = unzipped['output/body/Align/03_canvas/front_aligned.png'] || unzipped['output/seg_result/000001/front_seg.png'];
  const sideImgBytes = unzipped['output/body/Align/03_canvas/side_aligned.png'] || unzipped['output/seg_result/000001/side_seg.png'];

  if (frontImgBytes) {
    fs.writeFileSync(path.join(scratchDir, 'front_aligned.png'), Buffer.from(frontImgBytes));
    console.log('Saved front_aligned.png');
  }
  if (sideImgBytes) {
    fs.writeFileSync(path.join(scratchDir, 'side_aligned.png'), Buffer.from(sideImgBytes));
    console.log('Saved side_aligned.png');
  }

  // Run pipeline
  const zipRes = await importBodyEvidenceZip(new Uint8Array(zipBuffer));
  setBodyEvidencePackage(zipRes.package);
  await analyzeLoadedBodyEvidenceAsync();

  const pixelsPerCm = 10;
  const canvasSize = 2000;
  const frontLandmarks = zipRes.package.front?.pose?.acceptedLandmarks ?? [];
  const annotations = frontLandmarks.map((lm) => ({
    type: 'body_landmark',
    name: lm.name,
    point: {
      x: typeof lm.imageX === 'number' ? lm.imageX / pixelsPerCm : 0,
      y: typeof lm.imageY === 'number' ? (canvasSize - lm.imageY) / pixelsPerCm : 0,
      z: 200,
    },
  }));

  const levels = computeAnatomicalLevels(annotations);
  const shoulder = levels.levels.find(l => l.id === 'shoulder');
  const waistReport = getNaturalWaistPlaneLocalizationReport({ annotations });
  const orientationReport = getSideAnteriorPosteriorOrientation({ annotations });
  const bustReport = getBustApexPlaneLocalizationReport({ annotations });

  const shoulderY = shoulder.yCm;
  const waistCrestY = bustReport.searchWindow.naturalWaistSuperiorCrestYcm;

  // Pixel mapping: row = 2000 - (Y / 200) * 2000 = (200 - Y) * 10
  const shoulderRow = (200 - shoulderY) * 10;
  const waistCrestRow = (200 - waistCrestY) * 10;

  // Peaks
  const peak1 = bustReport.peaks.find(p => Math.abs(p.yCm - 128.65) < 0.1);
  const peak2 = bustReport.peaks.find(p => Math.abs(p.yCm - 126.15) < 0.1);
  const peak3 = bustReport.peaks.find(p => Math.abs(p.yCm - 123.45) < 0.1);

  const peak1Row = (200 - 128.65) * 10;
  const peak2Row = (200 - 126.15) * 10;
  const peak3Row = (200 - 123.45) * 10;

  // Base64 encode images for standalone HTML
  const frontB64 = Buffer.from(frontImgBytes).toString('base64');
  const sideB64 = Buffer.from(sideImgBytes).toString('base64');

  // Generate SVG profile chart
  const chartWidth = 700;
  const chartHeight = 400;
  const pad = 60;

  const yMin = 120.0;
  const yMax = 134.0;
  const uMin = 75.0;
  const uMax = 92.0;

  const mapX = (u) => pad + ((u - uMin) / (uMax - uMin)) * (chartWidth - 2 * pad);
  const mapY = (y) => chartHeight - pad - ((y - yMin) / (yMax - yMin)) * (chartHeight - 2 * pad);

  let rawPath = '';
  let smoothPath = '';
  let basePath = '';

  for (let i = 0; i < bustReport.candidates.length; i++) {
    const c = bustReport.candidates[i];
    const px = mapX(c.rawAnteriorU);
    const py = mapY(c.yCm);
    const spx = mapX(c.smoothedAnteriorUcm);
    const bpx = mapX(c.baselineUcm);

    rawPath += (i === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
    smoothPath += (i === 0 ? `M ${spx} ${py}` : ` L ${spx} ${py}`);
    basePath += (i === 0 ? `M ${bpx} ${py}` : ` L ${bpx} ${py}`);
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TWENTY EIGHT — Real Package Bust Apex Diagnostic</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1, h2, h3 { color: #38bdf8; }
    .grid { display: flex; gap: 24px; flex-wrap: wrap; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .img-container { position: relative; width: 450px; height: 450px; background: #000; overflow: hidden; border-radius: 4px; }
    .img-container img { width: 100%; height: 100%; object-fit: contain; }
    .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; font-family: monospace; }
    th, td { border: 1px solid #334155; padding: 6px 10px; text-align: left; }
    th { background: #0f172a; color: #94a3b8; }
    tr:nth-child(even) { background: #1e293b; }
    tr:nth-child(odd) { background: #0f172a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
    .badge-ambiguous { background: #eab308; color: #000; }
    .badge-ready { background: #22c55e; color: #000; }
    .legend { display: flex; gap: 16px; margin: 12px 0; font-size: 13px; }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .legend-color { width: 16px; height: 4px; border-radius: 2px; }
  </style>
</head>
<body>
  <h1>TWENTY EIGHT — Bust Apex Plane Localization v0 Diagnostic</h1>
  <div class="card">
    <h2>Executive Summary</h2>
    <p><strong>Status:</strong> <span class="badge badge-ambiguous">${bustReport.status.toUpperCase()}</span> (${bustReport.issues[0]})</p>
    <p><strong>Search Window:</strong> Shoulder $Y = ${shoulderY.toFixed(2)}$ cm (row ${shoulderRow.toFixed(0)}) &rarr; Natural Waist Superior Crest $Y = ${waistCrestY.toFixed(2)}$ cm (row ${waistCrestRow.toFixed(0)}), Span = ${bustReport.searchWindow.spanCm} cm</p>
    <p><strong>Facing Direction:</strong> <code>${orientationReport.facingDirection}</code> | <strong>Anterior Side:</strong> <code>${orientationReport.anteriorSide}</code> (min_u = anterior, max_u = posterior)</p>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Side View Alignment & Overlay</h2>
      <div class="img-container">
        <img src="data:image/png;base64,${sideB64}" />
        <svg class="overlay" viewBox="0 0 2000 2000">
          <!-- Shoulder boundary (cyan dashed) -->
          <line x1="200" y1="${shoulderRow}" x2="1800" y2="${shoulderRow}" stroke="#38bdf8" stroke-width="6" stroke-dasharray="20,10" />
          <text x="220" y="${shoulderRow - 15}" fill="#38bdf8" font-size="36" font-family="sans-serif" font-weight="bold">Shoulder Level (Y=${shoulderY.toFixed(1)} cm)</text>

          <!-- Waist Superior Crest boundary (yellow dashed) -->
          <line x1="200" y1="${waistCrestRow}" x2="1800" y2="${waistCrestRow}" stroke="#facc15" stroke-width="6" stroke-dasharray="20,10" />
          <text x="220" y="${waistCrestRow + 40}" fill="#facc15" font-size="36" font-family="sans-serif" font-weight="bold">Natural Waist Superior Crest (Y=${waistCrestY.toFixed(1)} cm)</text>

          <!-- Peak 1: Y=128.65 cm (Magenta) -->
          <line x1="200" y1="${peak1Row}" x2="1800" y2="${peak1Row}" stroke="#ec4899" stroke-width="8" />
          <circle cx="851" cy="${peak1Row}" r="16" fill="#ec4899" stroke="#fff" stroke-width="4" />
          <text x="220" y="${peak1Row - 15}" fill="#ec4899" font-size="36" font-family="sans-serif" font-weight="bold">Peak 1: Upper Chest / Bra Transition (Y=128.65 cm, P=0.79 cm)</text>

          <!-- Peak 2: Y=126.15 cm (Orange) -->
          <line x1="200" y1="${peak2Row}" x2="1800" y2="${peak2Row}" stroke="#f97316" stroke-width="6" stroke-dasharray="10,10" />
          <circle cx="824" cy="${peak2Row}" r="14" fill="#f97316" stroke="#fff" stroke-width="3" />
          <text x="220" y="${peak2Row - 15}" fill="#f97316" font-size="32" font-family="sans-serif" font-weight="bold">Peak 2: Mid-Breast Upper Slant (Y=126.15 cm, P=0.60 cm)</text>

          <!-- Peak 3: Y=123.45 cm (Green - Full Bust Apex) -->
          <line x1="200" y1="${peak3Row}" x2="1800" y2="${peak3Row}" stroke="#22c55e" stroke-width="10" />
          <circle cx="801" cy="${peak3Row}" r="18" fill="#22c55e" stroke="#fff" stroke-width="4" />
          <text x="220" y="${peak3Row + 45}" fill="#22c55e" font-size="38" font-family="sans-serif" font-weight="bold">Peak 3: Full Breast Apex (Y=123.45 cm, P=0.71 cm, AP=29.7 cm)</text>
        </svg>
      </div>
    </div>

    <div class="card">
      <h2>Front View Alignment & Overlay</h2>
      <div class="img-container">
        <img src="data:image/png;base64,${frontB64}" />
        <svg class="overlay" viewBox="0 0 2000 2000">
          <!-- Shoulder boundary -->
          <line x1="200" y1="${shoulderRow}" x2="1800" y2="${shoulderRow}" stroke="#38bdf8" stroke-width="6" stroke-dasharray="20,10" />

          <!-- Waist Superior Crest boundary -->
          <line x1="200" y1="${waistCrestRow}" x2="1800" y2="${waistCrestRow}" stroke="#facc15" stroke-width="6" stroke-dasharray="20,10" />

          <!-- Peak 1: Y=128.65 cm (Magenta) -->
          <line x1="836" y1="${peak1Row}" x2="1180" y2="${peak1Row}" stroke="#ec4899" stroke-width="8" />
          <circle cx="836" cy="${peak1Row}" r="14" fill="#ec4899" />
          <circle cx="1180" cy="${peak1Row}" r="14" fill="#ec4899" />

          <!-- Peak 3: Y=123.45 cm (Green - Full Bust Apex) -->
          <line x1="836" y1="${peak3Row}" x2="1180" y2="${peak3Row}" stroke="#22c55e" stroke-width="10" />
          <circle cx="836" cy="${peak3Row}" r="16" fill="#22c55e" />
          <circle cx="1180" cy="${peak3Row}" r="16" fill="#22c55e" />
          <text x="220" y="${peak3Row + 45}" fill="#22c55e" font-size="38" font-family="sans-serif" font-weight="bold">Front Width at Bust Apex (Y=123.45 cm, W=34.4 cm)</text>
        </svg>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Side Anterior Profile & Prominence Chart</h2>
    <div class="legend">
      <div class="legend-item"><div class="legend-color" style="background:#94a3b8;"></div> Raw Anterior Contour (min_u)</div>
      <div class="legend-item"><div class="legend-color" style="background:#38bdf8;"></div> Smoothed Contour</div>
      <div class="legend-item"><div class="legend-color" style="background:#e2e8f0; border-top: 2px dashed #94a3b8;"></div> Shape Baseline B(Y)</div>
      <div class="legend-item"><div class="legend-color" style="background:#22c55e;"></div> True Breast Apex (Y=123.45 cm)</div>
      <div class="legend-item"><div class="legend-color" style="background:#ec4899;"></div> Boundary Gap Artifact Peak (Y=128.65 cm)</div>
    </div>
    <svg width="${chartWidth}" height="${chartHeight}" style="background:#0f172a; border-radius:4px;">
      <!-- Grid lines -->
      <line x1="${pad}" y1="${mapY(120)}" x2="${chartWidth - pad}" y2="${mapY(120)}" stroke="#334155" stroke-width="1" />
      <line x1="${pad}" y1="${mapY(125)}" x2="${chartWidth - pad}" y2="${mapY(125)}" stroke="#334155" stroke-width="1" />
      <line x1="${pad}" y1="${mapY(130)}" x2="${chartWidth - pad}" y2="${mapY(130)}" stroke="#334155" stroke-width="1" />
      
      <text x="${pad - 10}" y="${mapY(120) + 4}" fill="#64748b" font-size="11" text-anchor="end">120 cm</text>
      <text x="${pad - 10}" y="${mapY(125) + 4}" fill="#64748b" font-size="11" text-anchor="end">125 cm</text>
      <text x="${pad - 10}" y="${mapY(130) + 4}" fill="#64748b" font-size="11" text-anchor="end">130 cm</text>

      <path d="${rawPath}" fill="none" stroke="#94a3b8" stroke-width="2" />
      <path d="${basePath}" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="6,4" />
      <path d="${smoothPath}" fill="none" stroke="#38bdf8" stroke-width="3" />

      <!-- Peak markers -->
      <circle cx="${mapX(85.1)}" cy="${mapY(128.65)}" r="6" fill="#ec4899" />
      <text x="${mapX(85.1) + 10}" y="${mapY(128.65) - 8}" fill="#ec4899" font-size="12" font-weight="bold">Peak 1 (Y=128.65)</text>

      <circle cx="${mapX(80.1)}" cy="${mapY(123.45)}" r="7" fill="#22c55e" />
      <text x="${mapX(80.1) - 10}" y="${mapY(123.45) + 18}" fill="#22c55e" font-size="12" font-weight="bold" text-anchor="end">Peak 3: True Breast Apex (Y=123.45)</text>
    </svg>
  </div>

  <div class="card">
    <h2>Detailed Candidate Peaks in Real Package</h2>
    <table>
      <thead>
        <tr>
          <th>Peak ID</th>
          <th>Y (cm)</th>
          <th>Side Row</th>
          <th>Raw Anterior U (cm)</th>
          <th>Smoothed Anterior U (cm)</th>
          <th>Baseline U (cm)</th>
          <th>Prominence P(Y) (cm)</th>
          <th>Broadness Score</th>
          <th>Front Width (cm)</th>
          <th>Side Span (cm)</th>
          <th>AP Depth (cm)</th>
          <th>Anatomical Visual Classification</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Peak 1 (Group 1)</td>
          <td>128.65</td>
          <td>713</td>
          <td>85.10</td>
          <td>84.24</td>
          <td>85.03</td>
          <td>+0.7887</td>
          <td>3</td>
          <td>34.40</td>
          <td>18.00</td>
          <td>18.00</td>
          <td><strong style="color:#ec4899;">Upper chest / bra boundary artifact (prior to 1.6cm multi-run gap)</strong></td>
        </tr>
        <tr>
          <td>Peak 2 (Group 2)</td>
          <td>126.15</td>
          <td>738</td>
          <td>82.40</td>
          <td>82.40</td>
          <td>83.00</td>
          <td>+0.5995</td>
          <td>55</td>
          <td>35.00</td>
          <td>27.90</td>
          <td>27.90</td>
          <td><strong style="color:#f97316;">Upper breast slope (pooled with Group 2)</strong></td>
        </tr>
        <tr>
          <td>Peak 3 (Group 2)</td>
          <td>123.45</td>
          <td>765</td>
          <td>80.10</td>
          <td>80.11</td>
          <td>80.81</td>
          <td>+0.7091</td>
          <td>54</td>
          <td>34.40</td>
          <td>29.70</td>
          <td>29.70</td>
          <td><strong style="color:#22c55e;">TRUE FULL-BUST / BREAST APEX (Maximum Anterior Protrusion)</strong></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(scratchDir, 'bust_apex_diagnostic.html'), html);
  console.log('Saved bust_apex_diagnostic.html');
}

main().catch(console.error);

import fs from 'node:fs';
import path from 'node:path';
import * as fflate from 'fflate';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getPelvicArbitraryYEvidenceScan,
  getMaximumSeatPlaneLocalization,
  getModeledHipSeatCircumference,
  getSideAnteriorPosteriorOrientation,
} from '../src/features/bodyEvidence.js';
import { computeAnatomicalLevels } from '../src/features/anatomicalLevels.js';

async function main() {
  const possiblePaths = [
    'c:/Users/VIP/Documents/work-latent-space/output.zip',
    'C:/Users/VIP/Downloads/output.zip',
  ];
  let zipPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      zipPath = p;
      break;
    }
  }
  if (!zipPath) return;

  const zipBuffer = fs.readFileSync(zipPath);
  const unzipped = fflate.unzipSync(new Uint8Array(zipBuffer));

  const scratchDir = 'c:/Users/VIP/Documents/Projects/latent-space/scratch';
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // Extract aligned PNG images
  const frontImgBytes = unzipped['output/body/Align/03_canvas/front_aligned.png'] || unzipped['output/seg_result/000001/front_seg.png'];
  const sideImgBytes = unzipped['output/body/Align/03_canvas/side_aligned.png'] || unzipped['output/seg_result/000001/side_seg.png'];

  const frontB64 = Buffer.from(frontImgBytes).toString('base64');
  const sideB64 = Buffer.from(sideImgBytes).toString('base64');

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
  const hipLevel = levels.levels.find(l => l.id === 'hip');
  const pelvicScan = getPelvicArbitraryYEvidenceScan({ annotations });
  const maxSeat = getMaximumSeatPlaneLocalization({ annotations });
  const modeledHip = getModeledHipSeatCircumference({ annotations });
  const orientation = getSideAnteriorPosteriorOrientation({ annotations });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Hip / Maximum Seat Metrological Audit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 20px; }
    h1, h2, h3 { color: #38bdf8; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .view-container { position: relative; width: 600px; height: 600px; overflow: hidden; background: #000; border: 1px solid #475569; }
    .view-container img { position: absolute; top: 0; left: 0; width: 600px; height: 600px; object-fit: contain; }
    .view-container svg { position: absolute; top: 0; left: 0; width: 600px; height: 600px; }
    .metric-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; margin: 4px; }
    .badge-hip { background: #eab308; color: #000; }
    .badge-seat { background: #ec4899; color: #fff; }
    .badge-split { background: #ef4444; color: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border: 1px solid #334155; padding: 6px 8px; text-align: left; }
    th { background: #0f172a; color: #94a3b8; }
    tr:nth-child(even) { background: #1e293b; }
  </style>
</head>
<body>
  <h1>Hip / Maximum Seat / Hip Girth Standards Alignment Audit</h1>
  <p>Comparing <strong>Hip Anatomical Level (Y ≈ 86.25 cm)</strong> vs <strong>Maximum Seat Plane (Y = 79.95 cm)</strong> vs <strong>Lower Split Transition (Y = 77.25 cm)</strong>.</p>

  <div class="grid">
    <div class="card">
      <h2>Front View Overlay (Zoomed on Pelvis: Y=70 to Y=95 cm)</h2>
      <div class="view-container">
        <!-- Crop 600x600 onto pelvis region rows 1050 to 1250 (Y=75 to Y=95) -->
        <svg viewBox="0 1050 2000 250" width="600" height="600" preserveAspectRatio="none">
          <image href="data:image/png;base64,${frontB64}" x="0" y="0" width="2000" height="2000" />
          <!-- Hip Anatomical Level Y=86.25 cm (Row 1137.5) -->
          <line x1="0" y1="1137.5" x2="2000" y2="1137.5" stroke="#eab308" stroke-width="3" stroke-dasharray="8 4" />
          <text x="80" y="1130" fill="#eab308" font-size="28" font-weight="bold">Hip Landmark Level Y=86.25 cm (W=42.20 cm)</text>
          
          <!-- Maximum Seat Plane Y=79.95 cm (Row 1200.5) -->
          <line x1="0" y1="1200.5" x2="2000" y2="1200.5" stroke="#ec4899" stroke-width="4" />
          <text x="80" y="1195" fill="#ec4899" font-size="28" font-weight="bold">Max Seat Plane Y=79.95 cm (W=44.30 cm)</text>

          <!-- First Split Crotch Y=77.25 cm (Row 1227.5) -->
          <line x1="0" y1="1227.5" x2="2000" y2="1227.5" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" />
          <text x="80" y="1245" fill="#ef4444" font-size="24">First Split Boundary Y=77.25 cm</text>
        </svg>
      </div>
    </div>

    <div class="card">
      <h2>Side View Overlay (Zoomed on Pelvis: Y=70 to Y=95 cm)</h2>
      <div class="view-container">
        <svg viewBox="0 1050 2000 250" width="600" height="600" preserveAspectRatio="none">
          <image href="data:image/png;base64,${sideB64}" x="0" y="0" width="2000" height="2000" />
          <!-- Hip Anatomical Level Y=86.25 cm (Row 1137.5) -->
          <line x1="0" y1="1137.5" x2="2000" y2="1137.5" stroke="#eab308" stroke-width="3" stroke-dasharray="8 4" />
          <text x="80" y="1130" fill="#eab308" font-size="28" font-weight="bold">Hip Level Y=86.25 cm (Peak Buttock Point maxU=112.30 cm)</text>
          
          <!-- Maximum Seat Plane Y=79.95 cm (Row 1200.5) -->
          <line x1="0" y1="1200.5" x2="2000" y2="1200.5" stroke="#ec4899" stroke-width="4" />
          <text x="80" y="1195" fill="#ec4899" font-size="28" font-weight="bold">Max Seat Plane Y=79.95 cm (maxU=111.70 cm)</text>

          <!-- First Split Crotch Y=77.25 cm (Row 1227.5) -->
          <line x1="0" y1="1227.5" x2="2000" y2="1227.5" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" />
          <text x="80" y="1245" fill="#ef4444" font-size="24">First Split Boundary Y=77.25 cm</text>
        </svg>
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 20px;">
    <h2>Key Comparison Table</h2>
    <table>
      <thead>
        <tr>
          <th>Concept / Level</th>
          <th>Y (cm)</th>
          <th>Raster Row</th>
          <th>Front Transverse Width (cm)</th>
          <th>Side Qualified AP Depth (cm)</th>
          <th>Posterior Projection (maxU cm)</th>
          <th>Modeled Perimeter (cm)</th>
          <th>Anatomical / Standard Meaning</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: rgba(234, 179, 8, 0.15);">
          <td><strong>Hip Landmark / Buttock Point Level</strong></td>
          <td>86.25</td>
          <td>1137</td>
          <td>42.20</td>
          <td>27.70</td>
          <td><strong>112.30 (Absolute Peak)</strong></td>
          <td>110.98</td>
          <td>ISO 8559-1 Clause 3.1.14 "Hip Level" & Clause 5.3.13 "Hip Girth" (level of greatest posterior buttock projection)</td>
        </tr>
        <tr style="background: rgba(236, 72, 153, 0.15);">
          <td><strong>Maximum Seat Plane (Current v0)</strong></td>
          <td>79.95</td>
          <td>1200</td>
          <td><strong>44.30 (Absolute Peak)</strong></td>
          <td>27.40</td>
          <td>111.70 (-0.60 cm from peak)</td>
          <td><strong>114.20 (Absolute Peak)</strong></td>
          <td>ISO 8559-1 Clause 5.3.14 "Maximum Hip Girth / Seat Measure Girth" (level of maximum total circumference / trochanter width)</td>
        </tr>
        <tr style="background: rgba(239, 68, 68, 0.15);">
          <td><strong>Lower Crotch / Leg Split Boundary</strong></td>
          <td>77.25</td>
          <td>1227</td>
          <td>Split to 2 legs</td>
          <td>26.80</td>
          <td>110.90</td>
          <td>N/A (Multi-run)</td>
          <td>Inferior gluteal fold / perineum transition</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(scratchDir, 'hip_seat_diagnostic.html'), html);
  console.log('Saved hip_seat_diagnostic.html');
}

main().catch(console.error);

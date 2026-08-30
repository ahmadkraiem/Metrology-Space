import fs from 'node:fs';
import path from 'node:path';
import * as fflate from 'fflate';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getBustApexPlaneLocalizationReport,
  getNaturalWaistPlaneLocalizationReport,
} from '../src/features/bodyEvidence.js';
import { computeAnatomicalLevels } from '../src/features/anatomicalLevels.js';

async function main() {
  const zipPath = 'c:/Users/VIP/Documents/work-latent-space/output.zip';
  const zipBuffer = fs.readFileSync(zipPath);
  const unzipped = fflate.unzipSync(new Uint8Array(zipBuffer));

  const scratchDir = 'c:/Users/VIP/Documents/Projects/latent-space/scratch';

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
  const bustReport = getBustApexPlaneLocalizationReport({ annotations });

  const shoulderY = shoulder.yCm;
  const waistCrestY = bustReport.searchWindow.naturalWaistSuperiorCrestYcm;

  // Let's create an SVG that embeds the PNG and renders clear metrology lines
  const frontB64 = Buffer.from(unzipped['output/body/Align/03_canvas/front_aligned.png']).toString('base64');
  const sideB64 = Buffer.from(unzipped['output/body/Align/03_canvas/side_aligned.png']).toString('base64');

  const shoulderRow = Math.round((200 - shoulderY) * 10);
  const waistCrestRow = Math.round((200 - waistCrestY) * 10);
  const waistRow = Math.round((200 - waistReport.yCm) * 10);

  const peak1Row = Math.round((200 - 128.65) * 10);
  const peak3Row = Math.round((200 - 123.45) * 10);

  const sideSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="0 0 2000 2000">
  <image href="data:image/png;base64,${sideB64}" width="2000" height="2000"/>
  <!-- Shoulder Level Y=132.85 cm -->
  <line x1="300" y1="${shoulderRow}" x2="1700" y2="${shoulderRow}" stroke="#38bdf8" stroke-width="4" stroke-dasharray="16,8"/>
  <rect x="310" y="${shoulderRow - 45}" width="650" height="40" fill="#0f172a" opacity="0.8" rx="6"/>
  <text x="320" y="${shoulderRow - 15}" fill="#38bdf8" font-size="28" font-family="sans-serif" font-weight="bold">Shoulder Reference Level (Y = 132.85 cm)</text>

  <!-- Waist Superior Crest Y=120.65 cm -->
  <line x1="300" y1="${waistCrestRow}" x2="1700" y2="${waistCrestRow}" stroke="#facc15" stroke-width="4" stroke-dasharray="16,8"/>
  <rect x="310" y="${waistCrestRow + 10}" width="800" height="40" fill="#0f172a" opacity="0.8" rx="6"/>
  <text x="320" y="${waistCrestRow + 40}" fill="#facc15" font-size="28" font-family="sans-serif" font-weight="bold">Natural Waist Superior Crest Boundary (Y = 120.65 cm)</text>

  <!-- Natural Waist Plane Y=107.15 cm -->
  <line x1="300" y1="${waistRow}" x2="1700" y2="${waistRow}" stroke="#a855f7" stroke-width="4" stroke-dasharray="12,6"/>
  <rect x="310" y="${waistRow + 10}" width="550" height="40" fill="#0f172a" opacity="0.8" rx="6"/>
  <text x="320" y="${waistRow + 40}" fill="#a855f7" font-size="28" font-family="sans-serif" font-weight="bold">Natural Waist Plane (Y = 107.15 cm)</text>

  <!-- Artifact Peak 1 Y=128.65 cm (Magenta) -->
  <line x1="300" y1="${peak1Row}" x2="1700" y2="${peak1Row}" stroke="#ec4899" stroke-width="6"/>
  <circle cx="851" cy="${peak1Row}" r="14" fill="#ec4899" stroke="#fff" stroke-width="3"/>
  <rect x="310" y="${peak1Row - 45}" width="780" height="40" fill="#0f172a" opacity="0.8" rx="6"/>
  <text x="320" y="${peak1Row - 15}" fill="#ec4899" font-size="28" font-family="sans-serif" font-weight="bold">Peak 1: Upper Chest Artifact (Y = 128.65 cm, P = 0.79 cm)</text>

  <!-- True Breast Apex Peak 3 Y=123.45 cm (Green) -->
  <line x1="300" y1="${peak3Row}" x2="1700" y2="${peak3Row}" stroke="#22c55e" stroke-width="8"/>
  <circle cx="801" cy="${peak3Row}" r="16" fill="#22c55e" stroke="#fff" stroke-width="4"/>
  <circle cx="1098" cy="${peak3Row}" r="14" fill="#64748b" stroke="#fff" stroke-width="3"/>
  <rect x="310" y="${peak3Row + 15}" width="950" height="40" fill="#0f172a" opacity="0.85" rx="6"/>
  <text x="320" y="${peak3Row + 45}" fill="#22c55e" font-size="28" font-family="sans-serif" font-weight="bold">Peak 3: Full Breast Apex (Y = 123.45 cm, Prominence = 0.71 cm, AP = 29.70 cm)</text>
</svg>`;

  const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="0 0 2000 2000">
  <image href="data:image/png;base64,${frontB64}" width="2000" height="2000"/>
  <!-- Shoulder Level Y=132.85 cm -->
  <line x1="300" y1="${shoulderRow}" x2="1700" y2="${shoulderRow}" stroke="#38bdf8" stroke-width="4" stroke-dasharray="16,8"/>
  <text x="320" y="${shoulderRow - 15}" fill="#38bdf8" font-size="28" font-family="sans-serif" font-weight="bold">Shoulder Reference Level (Y = 132.85 cm)</text>

  <!-- Waist Superior Crest Y=120.65 cm -->
  <line x1="300" y1="${waistCrestRow}" x2="1700" y2="${waistCrestRow}" stroke="#facc15" stroke-width="4" stroke-dasharray="16,8"/>
  <text x="320" y="${waistCrestRow + 40}" fill="#facc15" font-size="28" font-family="sans-serif" font-weight="bold">Natural Waist Superior Crest Boundary (Y = 120.65 cm)</text>

  <!-- Natural Waist Plane Y=107.15 cm -->
  <line x1="858" y1="${waistRow}" x2="1148" y2="${waistRow}" stroke="#a855f7" stroke-width="6"/>
  <circle cx="858" cy="${waistRow}" r="12" fill="#a855f7"/>
  <circle cx="1148" cy="${waistRow}" r="12" fill="#a855f7"/>
  <text x="320" y="${waistRow + 40}" fill="#a855f7" font-size="28" font-family="sans-serif" font-weight="bold">Natural Waist Plane (Y = 107.15 cm, W = 29.0 cm)</text>

  <!-- True Breast Apex Peak 3 Y=123.45 cm (Green) -->
  <line x1="836" y1="${peak3Row}" x2="1180" y2="${peak3Row}" stroke="#22c55e" stroke-width="8"/>
  <circle cx="836" cy="${peak3Row}" r="14" fill="#22c55e" stroke="#fff" stroke-width="3"/>
  <circle cx="1180" cy="${peak3Row}" r="14" fill="#22c55e" stroke="#fff" stroke-width="3"/>
  <rect x="310" y="${peak3Row + 15}" width="880" height="40" fill="#0f172a" opacity="0.85" rx="6"/>
  <text x="320" y="${peak3Row + 45}" fill="#22c55e" font-size="28" font-family="sans-serif" font-weight="bold">Bust Apex Plane (Y = 123.45 cm, Front Width = 34.40 cm)</text>
</svg>`;

  fs.writeFileSync(path.join(scratchDir, 'side_diagnostic_overlay.svg'), sideSvg);
  fs.writeFileSync(path.join(scratchDir, 'front_diagnostic_overlay.svg'), frontSvg);
  console.log('Saved side_diagnostic_overlay.svg and front_diagnostic_overlay.svg');
}

main().catch(console.error);

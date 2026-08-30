import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getTorsoArbitraryYEvidenceScan,
  getNaturalWaistPlaneLocalizationReport,
  getAbdominalApexPlaneLocalizationReport,
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
  const abdominalReport = getAbdominalApexPlaneLocalizationReport({ annotations });
  const torsoScan = getTorsoArbitraryYEvidenceScan({ annotations });

  console.log('=== REAL PACKAGE ANATOMICAL LANDMARKS ===');
  console.log(`Shoulder Y: ${shoulder.yCm.toFixed(2)} cm`);
  console.log(`Natural Waist Selected Valley Y: ${waistReport.yCm.toFixed(2)} cm`);
  console.log(`Natural Waist Sup Crest Y: ${waistReport.troughs[0]?.superiorCrestYcm.toFixed(2)} cm`);
  console.log(`Natural Waist Inf Crest Y: ${waistReport.troughs[0]?.inferiorCrestYcm.toFixed(2)} cm`);
  console.log(`Abdominal Apex Y: ${abdominalReport.yCm?.toFixed(2)} cm (status: ${abdominalReport.status})`);

  // Extract all valid side anterior points from Y=133 down to 90
  const candidates = torsoScan.candidates.filter(c => c.yCm <= 133.0 && c.yCm >= 90.0);
  candidates.sort((a, b) => b.yCm - a.yCm); // Descending Y (superior to inferior)

  console.log('\n=== DETAILED ANTERIOR PROFILE & DERIVATIVES (Y = 133 down to 95) ===');
  console.log('Row | Y (cm) | MinU (Ant) | dU/dY (slope) | d2U/dY2 (curv) | AP Depth | Front Width | Region');

  // Let's compute finite differences
  // For descending Y: step is deltaY = y[i] - y[i+1] > 0
  for (let i = 0; i < candidates.length; i++) {
    const curr = candidates[i];
    const prev = i > 0 ? candidates[i - 1] : null;
    const next = i < candidates.length - 1 ? candidates[i + 1] : null;

    const uCurr = curr.side?.minUcm;
    const uPrev = prev?.side?.minUcm;
    const uNext = next?.side?.minUcm;

    let slope = null; // dU / dY (positive means U increases as Y increases, i.e. U decreases / moves forward as Y descends)
    if (prev && next && uPrev !== null && uNext !== null && uCurr !== null) {
      slope = (uPrev - uNext) / (prev.yCm - next.yCm); // central difference
    }

    let curv = null;
    if (prev && next && uPrev !== null && uNext !== null && uCurr !== null) {
      const dY1 = prev.yCm - curr.yCm;
      const dY2 = curr.yCm - next.yCm;
      curv = ((uPrev - uCurr) / dY1 - (uCurr - uNext) / dY2) / ((dY1 + dY2) / 2);
    }

    let region = '';
    if (Math.abs(curr.yCm - shoulder.yCm) < 0.2) region = '<-- Shoulder Level';
    else if (curr.yCm > 125.0) region = 'Upper chest / clavicular slope';
    else if (Math.abs(curr.yCm - 123.85) < 0.05) region = '<-- Old Bust Y (123.85)';
    else if (Math.abs(curr.yCm - 120.65) < 0.05) region = '<-- Old Waist Sup Crest (120.65)';
    else if (curr.yCm >= 118.15 && curr.yCm <= 120.15) region = '<-- TRUE BREAST APEX DOME (78.30)';
    else if (curr.yCm < 118.15 && curr.yCm >= 115.0) region = 'Inframammary / lower breast slope';
    else if (Math.abs(curr.yCm - waistReport.yCm) < 0.1) region = '<-- Natural Waist Valley (107.15)';
    else if (Math.abs(curr.yCm - (abdominalReport.yCm ?? 0)) < 0.1) region = '<-- Abdominal Apex';

    if (i % 2 === 0 || region.includes('<--')) {
      console.log(
        `${String(curr.side?.rasterRow ?? curr.rasterRow).padStart(4)} | ` +
        `${curr.yCm.toFixed(2).padStart(6)} | ` +
        `${(uCurr !== null ? uCurr.toFixed(2) : 'N/A').padStart(10)} | ` +
        `${(slope !== null ? slope.toFixed(3) : 'N/A').padStart(13)} | ` +
        `${(curv !== null ? curv.toFixed(3) : 'N/A').padStart(14)} | ` +
        `${(curr.side?.profileSpanCm ? curr.side.profileSpanCm.toFixed(2) : 'N/A').padStart(8)} | ` +
        `${(curr.front?.widthCm ? curr.front.widthCm.toFixed(2) : 'N/A').padStart(11)} | ` +
        region
      );
    }
  }
}

main().catch(console.error);

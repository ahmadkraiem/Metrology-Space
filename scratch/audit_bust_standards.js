import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getTorsoArbitraryYEvidenceScan,
} from '../src/features/bodyEvidence.js';

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

  const torsoScan = getTorsoArbitraryYEvidenceScan({ annotations });

  console.log('Side Profile in Upper Thoracic to Breast Apex (Y = 127.0 cm down to 120.0 cm):');
  console.log('SideRow | Y (cm) | MinU (Anterior) | MaxU (Posterior) | AP Depth | Front Width');

  const candidates = torsoScan.candidates.filter(c => c.yCm <= 127.0 && c.yCm >= 120.0);
  candidates.sort((a, b) => b.yCm - a.yCm);

  for (const c of candidates) {
    const minU = c.side?.minUcm;
    const maxU = c.side?.maxUcm;
    const apDepth = (minU !== null && maxU !== null) ? Number((maxU - minU).toFixed(2)) : null;
    const fw = c.front?.widthCm ? Number(c.front.widthCm.toFixed(2)) : null;
    const isCurrentBustY = Math.abs(c.yCm - 123.85) < 0.05;
    const isWaistSupCrest = Math.abs(c.yCm - 120.65) < 0.05;
    const marker = isCurrentBustY ? ' <-- CURRENT BUST Y (123.85)' : (isWaistSupCrest ? ' <-- CURRENT SEARCH LOWER BOUND (120.65)' : '');

    console.log(
      `${String(c.side?.rasterRow ?? c.rasterRow).padStart(7)} | ` +
      `${c.yCm.toFixed(2).padStart(6)} | ` +
      `${(minU !== null ? minU.toFixed(2) : 'N/A').padStart(15)} | ` +
      `${(maxU !== null ? maxU.toFixed(2) : 'N/A').padStart(16)} | ` +
      `${(apDepth !== null ? apDepth.toFixed(2) : 'N/A').padStart(8)} | ` +
      `${(fw !== null ? fw.toFixed(2) : 'N/A').padStart(11)}` +
      marker
    );
  }
}

main().catch(console.error);

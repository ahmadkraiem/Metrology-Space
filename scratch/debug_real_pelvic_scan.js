import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import { setBodyEvidencePackage, analyzeLoadedBodyEvidenceAsync, getTorsoArbitraryYEvidenceScan, getSideAnteriorPosteriorOrientation } from '../src/features/bodyEvidence.js';

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

  const scan = getTorsoArbitraryYEvidenceScan({ annotations, options: { supportPolicyId: 'trunk_pelvic_transition_support_v0' } });
  const orient = getSideAnteriorPosteriorOrientation({ annotations });

  console.log('Orient:', orient.anteriorSide, orient.status);
  console.log('Total candidates:', scan.candidates.length);

  const windowCands = scan.candidates.filter((c) => c.yCm < 96.85 && c.yCm > 77.25);
  console.log('Window candidates count:', windowCands.length);

  for (const c of windowCands) {
    console.log(`Y=${c.yCm.toFixed(2)} row=${c.rasterRow} side_status=${c.side?.status} singleRun=${c.side?.isSingleSupportedRun} runCount=${c.side?.runCount} minU=${c.side?.minUcm} maxU=${c.side?.maxUcm}`);
  }
}

main().catch(console.error);

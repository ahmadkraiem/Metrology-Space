import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getTorsoArbitraryYEvidenceScan,
  getSideAnteriorPosteriorOrientation,
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

  // Torso scan with pelvic transition support covers classes [12, 13, 21, 22, 23] from Cervicale to below Pelvis
  const torsoScan = getTorsoArbitraryYEvidenceScan({
    annotations,
    options: { supportPolicyId: 'trunk_pelvic_transition_support_v0' },
  });

  const orientation = getSideAnteriorPosteriorOrientation({ annotations });
  const isPositiveU = orientation?.anteriorSide === 'max_u';

  console.log('=== FULL CONTINUOUS CONTOUR FROM Y=110 DOWN TO Y=75 ===');
  console.log('Row  | Y (cm) | Front W | Side AP | minU (Ant) | maxU (Post) | Ramanujan II');
  console.log('-------------------------------------------------------------------------');

  let globalMaxPost = -Infinity;
  let globalMaxPostRows = [];

  let globalMaxFront = -Infinity;
  let globalMaxFrontRows = [];

  let globalMaxPerim = -Infinity;
  let globalMaxPerimRows = [];

  for (const c of torsoScan.candidates) {
    const y = c.yCm;
    const row = c.rasterRow;
    const fw = c.front?.widthCm ?? null;
    const ap = c.side?.qualifiedApDepthCm ?? null;
    const minU = c.side?.minUcm ?? null;
    const maxU = c.side?.maxUcm ?? null;
    const antU = isPositiveU ? maxU : minU;
    const postU = isPositiveU ? minU : maxU;
    const postProj = isPositiveU ? -minU : maxU;
    const perim = (fw && ap) ? c.modeledPerimeterScoreCm : null;

    if (y <= 95.0 && y >= 75.0) {
      if (postProj !== null && postProj > globalMaxPost + 1e-4) {
        globalMaxPost = postProj;
        globalMaxPostRows = [{ row, y, postU, fw, ap }];
      } else if (postProj !== null && Math.abs(postProj - globalMaxPost) <= 0.05) {
        globalMaxPostRows.push({ row, y, postU, fw, ap });
      }

      if (fw !== null && fw > globalMaxFront + 1e-4) {
        globalMaxFront = fw;
        globalMaxFrontRows = [{ row, y, fw, ap, postU }];
      } else if (fw !== null && Math.abs(fw - globalMaxFront) <= 0.05) {
        globalMaxFrontRows.push({ row, y, fw, ap, postU });
      }

      if (perim !== null && perim > globalMaxPerim + 1e-4) {
        globalMaxPerim = perim;
        globalMaxPerimRows = [{ row, y, fw, ap, postU, perim }];
      } else if (perim !== null && Math.abs(perim - globalMaxPerim) <= 0.05) {
        globalMaxPerimRows.push({ row, y, fw, ap, postU, perim });
      }

      if (row % 5 === 0 || (y >= 79.5 && y <= 80.5) || (y >= 85.5 && y <= 86.5) || (y >= 88.0 && y <= 90.0)) {
        console.log(
          `${String(row).padStart(4)} | ${y.toFixed(2).padStart(6)} | ${fw !== null ? fw.toFixed(2).padStart(7) : '   null'} | ${ap !== null ? ap.toFixed(2).padStart(7) : '   null'} | ${minU !== null ? minU.toFixed(2).padStart(10) : '      null'} | ${maxU !== null ? maxU.toFixed(2).padStart(11) : '       null'} | ${perim !== null ? perim.toFixed(2).padStart(12) : '        null'}`
        );
      }
    }
  }

  console.log('\n=== GLOBAL EXTREMA BETWEEN Y=95 AND Y=75 ===');
  console.log('Global Max Posterior Projection (maxU):', globalMaxPost, 'cm');
  console.log('Rows:', globalMaxPostRows);

  console.log('\nGlobal Max Front Width:', globalMaxFront, 'cm');
  console.log('Rows:', globalMaxFrontRows);

  console.log('\nGlobal Max Modeled Perimeter:', globalMaxPerim, 'cm');
  console.log('Rows:', globalMaxPerimRows);
}

main().catch(console.error);

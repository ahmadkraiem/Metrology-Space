import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getTorsoArbitraryYEvidenceScan,
  getPelvicArbitraryYEvidenceScan,
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

  const torsoScan = getTorsoArbitraryYEvidenceScan({
    annotations,
    options: { supportPolicyId: 'trunk_pelvic_transition_support_v0' },
  });
  const pelvicScan = getPelvicArbitraryYEvidenceScan({ annotations });

  const orientation = getSideAnteriorPosteriorOrientation({ annotations });
  const isPositiveU = orientation?.anteriorSide === 'max_u';

  // Combine candidates map by row
  const rowMap = new Map();

  for (const c of torsoScan.candidates) {
    rowMap.set(c.rasterRow, { ...c, source: 'torso' });
  }
  for (const c of pelvicScan.candidates) {
    rowMap.set(c.rasterRow, { ...c, source: 'pelvic' });
  }

  const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);

  console.log('=== CONTINUOUS TRAJECTORY: ROW 1100 (Y=90) TO ROW 1230 (Y=77) ===');
  console.log('Row  | Y (cm) | Front W | minX .. maxX | Side minU (Ant) .. maxU (Post) | Side AP | Ramanujan II | Source');
  console.log('---------------------------------------------------------------------------------------------------------');

  let maxPostVal = -Infinity;
  let maxPostRow = null;

  let maxFwVal = -Infinity;
  let maxFwRow = null;

  let maxApVal = -Infinity;
  let maxApRow = null;

  let maxPerimVal = -Infinity;
  let maxPerimRow = null;

  for (const r of sortedRows) {
    if (r < 1100 || r > 1230) continue;
    const c = rowMap.get(r);
    const y = c.yCm;
    const fw = c.front?.widthCm ?? null;
    const minX = c.front?.minXcm ?? null;
    const maxX = c.front?.maxXcm ?? null;
    const minU = c.side?.minUcm ?? null;
    const maxU = c.side?.maxUcm ?? null;
    const ap = c.side?.qualifiedApDepthCm ?? null;
    const perim = c.modeledPerimeterScoreCm ?? null;

    const postU = isPositiveU ? minU : maxU;
    const postProj = isPositiveU ? -minU : maxU;

    if (postProj !== null && postProj > maxPostVal) {
      maxPostVal = postProj;
      maxPostRow = { r, y, postU, fw, ap, perim };
    }
    if (fw !== null && fw > maxFwVal) {
      maxFwVal = fw;
      maxFwRow = { r, y, fw, ap, postU, perim };
    }
    if (ap !== null && ap > maxApVal) {
      maxApVal = ap;
      maxApRow = { r, y, ap, fw, postU, perim };
    }
    if (perim !== null && perim > maxPerimVal) {
      maxPerimVal = perim;
      maxPerimRow = { r, y, perim, fw, ap, postU };
    }

    console.log(
      `${String(r).padStart(4)} | ${y.toFixed(2).padStart(6)} | ${fw !== null ? fw.toFixed(2).padStart(7) : '   null'} | ${minX !== null ? minX.toFixed(1).padStart(5) : ' null'}..${maxX !== null ? maxX.toFixed(1).padEnd(5) : 'null '} | ${minU !== null ? minU.toFixed(1).padStart(5) : ' null'}..${maxU !== null ? maxU.toFixed(1).padEnd(5) : 'null '} | ${ap !== null ? ap.toFixed(2).padStart(7) : '   null'} | ${perim !== null ? perim.toFixed(2).padStart(12) : '        null'} | ${c.source}`
    );
  }

  console.log('\n=== SUMMARY OF REGIONAL MAXIMA (Y=90 to Y=77) ===');
  console.log('1. Max Posterior Buttock Projection (maxU):', maxPostVal, 'cm at Row', maxPostRow?.r, `(Y=${maxPostRow?.y?.toFixed(2)} cm)`);
  console.log('2. Max Front Transverse Width:', maxFwVal, 'cm at Row', maxFwRow?.r, `(Y=${maxFwRow?.y?.toFixed(2)} cm)`);
  console.log('3. Max Qualified AP Depth:', maxApVal, 'cm at Row', maxApRow?.r, `(Y=${maxApRow?.y?.toFixed(2)} cm)`);
  console.log('4. Max Modeled Ellipse Perimeter:', maxPerimVal, 'cm at Row', maxPerimRow?.r, `(Y=${maxPerimRow?.y?.toFixed(2)} cm)`);
}

main().catch(console.error);

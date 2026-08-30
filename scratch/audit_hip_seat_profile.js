import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getPelvicArbitraryYEvidenceScan,
  getMaximumSeatPlaneLocalization,
  getModeledHipSeatCircumference,
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
  if (!zipPath) {
    console.error('output.zip not found');
    return;
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

  const pelvicScan = getPelvicArbitraryYEvidenceScan({ annotations });
  const maxSeat = getMaximumSeatPlaneLocalization({ annotations });
  const modeledHip = getModeledHipSeatCircumference({ annotations });
  const orientation = getSideAnteriorPosteriorOrientation({ annotations });

  console.log('=== HIP / MAXIMUM SEAT REAL PACKAGE AUDIT ===');
  console.log('Orientation:', orientation);
  console.log('Pelvic Scan candidates count:', pelvicScan?.candidates?.length);
  console.log('Hip Anchor Y (cm):', pelvicScan?.upperBound?.yCm);
  console.log('Lower boundary first split:', pelvicScan?.lowerBoundaryEvidence);
  console.log('\nMaximum Seat Localization v0 Result:');
  console.log('  Selected Y (cm):', maxSeat?.selectedYcm);
  console.log('  Selected Row:', maxSeat?.selectedRasterRow);
  console.log('  Peak Score (cm):', maxSeat?.peakScoreCm);
  console.log('  Plateau:', maxSeat?.plateau?.rowCount, 'rows from', maxSeat?.plateau?.startYcm, 'to', maxSeat?.plateau?.endYcm);
  console.log('  Selected Candidate:', maxSeat?.selectedCandidate);

  console.log('\nModeled Hip Circumference Result:');
  console.log('  Value (cm):', modeledHip?.valueCm);
  console.log('  Y (cm):', modeledHip?.yCm);
  console.log('  Model:', modeledHip?.model);

  // Print all candidate rows in the pelvic scan
  const isPositiveU = orientation?.anteriorSide === 'max_u';
  console.log('\n=== ROW BY ROW PELVIC SCAN DATA ===');
  console.log('Row | Y (cm) | Front W | minX .. maxX | Side minU .. maxU | AP Depth | Anterior U | Posterior U | Modeled Perim');
  console.log('-------------------------------------------------------------------------------------------------------------');

  let maxPosteriorVal = -Infinity;
  let maxPosteriorRows = [];

  let maxFrontWidth = -Infinity;
  let maxFrontRows = [];

  let maxApDepth = -Infinity;
  let maxApDepthRows = [];

  let maxPerimScore = -Infinity;
  let maxPerimRows = [];

  for (const c of pelvicScan.candidates) {
    const y = c.yCm;
    const row = c.rasterRow;
    const fw = c.front?.widthCm ?? null;
    const minX = c.front?.minXcm ?? null;
    const maxX = c.front?.maxXcm ?? null;
    const minU = c.side?.minUcm ?? null;
    const maxU = c.side?.maxUcm ?? null;
    const ap = c.side?.qualifiedApDepthCm ?? null;
    const perim = c.modeledPerimeterScoreCm ?? null;

    // For facing negative_u: minU is anterior (front), maxU is posterior (back/buttock)
    // For facing positive_u: maxU is anterior (front), minU is posterior (back/buttock)
    const antU = isPositiveU ? maxU : minU;
    const postU = isPositiveU ? minU : maxU;
    // Posterior projection:
    // For negative_u, larger maxU = further posterior (protrudes backward to the right)
    // For positive_u, smaller minU = further posterior (protrudes backward to the left)
    const postProj = isPositiveU ? -minU : maxU;

    if (postProj !== null && Number.isFinite(postProj)) {
      if (postProj > maxPosteriorVal + 1e-4) {
        maxPosteriorVal = postProj;
        maxPosteriorRows = [{ row, y, postU, postProj, fw, ap, perim }];
      } else if (Math.abs(postProj - maxPosteriorVal) <= 0.05) {
        maxPosteriorRows.push({ row, y, postU, postProj, fw, ap, perim });
      }
    }

    if (fw !== null && Number.isFinite(fw)) {
      if (fw > maxFrontWidth + 1e-4) {
        maxFrontWidth = fw;
        maxFrontRows = [{ row, y, fw, ap, postU, perim }];
      } else if (Math.abs(fw - maxFrontWidth) <= 0.05) {
        maxFrontRows.push({ row, y, fw, ap, postU, perim });
      }
    }

    if (ap !== null && Number.isFinite(ap)) {
      if (ap > maxApDepth + 1e-4) {
        maxApDepth = ap;
        maxApDepthRows = [{ row, y, fw, ap, postU, perim }];
      } else if (Math.abs(ap - maxApDepth) <= 0.05) {
        maxApDepthRows.push({ row, y, fw, ap, postU, perim });
      }
    }

    if (perim !== null && Number.isFinite(perim)) {
      if (perim > maxPerimScore + 1e-4) {
        maxPerimScore = perim;
        maxPerimRows = [{ row, y, fw, ap, postU, perim }];
      } else if (Math.abs(perim - maxPerimScore) <= 0.05) {
        maxPerimRows.push({ row, y, fw, ap, postU, perim });
      }
    }

    if (y <= 86.5 && y >= 75.0) {
      console.log(
        `${String(row).padStart(4)} | ${y.toFixed(2).padStart(6)} | ${fw !== null ? fw.toFixed(2).padStart(7) : '   null'} | ${minX !== null ? minX.toFixed(1).padStart(5) : ' null'}..${maxX !== null ? maxX.toFixed(1).padEnd(5) : 'null '} | ${minU !== null ? minU.toFixed(1).padStart(5) : ' null'}..${maxU !== null ? maxU.toFixed(1).padEnd(5) : 'null '} | ${ap !== null ? ap.toFixed(2).padStart(8) : '    null'} | ${antU !== null ? antU.toFixed(2).padStart(10) : '      null'} | ${postU !== null ? postU.toFixed(2).padStart(11) : '       null'} | ${perim !== null ? perim.toFixed(2).padStart(13) : '         null'}`
      );
    }
  }

  console.log('\n=== EXTRACTED EXTREMA ACROSS SCAN ===');
  console.log('A. Maximum Posterior Buttock Projection:');
  console.log('   Peak Value:', maxPosteriorVal, 'cm');
  console.log('   Rows:', maxPosteriorRows.map(r => `Row ${r.row} (Y=${r.y.toFixed(2)}, postU=${r.postU}, W=${r.fw}, AP=${r.ap}, Perim=${r.perim})`));

  console.log('\nB. Maximum Front Transverse Width:');
  console.log('   Peak Width:', maxFrontWidth, 'cm');
  console.log('   Rows:', maxFrontRows.map(r => `Row ${r.row} (Y=${r.y.toFixed(2)}, W=${r.fw}, AP=${r.ap}, postU=${r.postU}, Perim=${r.perim})`));

  console.log('\nC. Maximum Qualified AP Depth:');
  console.log('   Peak AP Depth:', maxApDepth, 'cm');
  console.log('   Rows:', maxApDepthRows.map(r => `Row ${r.row} (Y=${r.y.toFixed(2)}, AP=${r.ap}, W=${r.fw}, postU=${r.postU}, Perim=${r.perim})`));

  console.log('\nD. Maximum Modeled Ellipse Perimeter (Current v0 Score):');
  console.log('   Peak Perimeter:', maxPerimScore, 'cm');
  console.log('   Rows:', maxPerimRows.map(r => `Row ${r.row} (Y=${r.y.toFixed(2)}, Perim=${r.perim}, W=${r.fw}, AP=${r.ap}, postU=${r.postU})`));

  console.log('\nE. Current Production Maximum Seat Selection:');
  console.log('   Y =', maxSeat?.selectedYcm, 'cm (Row', maxSeat?.selectedRasterRow, ')');
}

main().catch(console.error);

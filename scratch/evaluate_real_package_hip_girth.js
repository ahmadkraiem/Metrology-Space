import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getButtockPointPlaneLocalization,
  getModeledHipGirth,
  getMaximumSeatPlaneLocalization,
  getModeledHipSeatCircumference,
  getAbdominalPointPlaneLocalization,
  getNaturalWaistPlaneLocalization,
  getBustPointPlaneLocalization,
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

  const buttockLoc = getButtockPointPlaneLocalization({ annotations });
  const modeledHipGirth = getModeledHipGirth({ annotations });
  const maxSeatLoc = getMaximumSeatPlaneLocalization({ annotations });
  const modeledMaxSeat = getModeledHipSeatCircumference({ annotations });
  const waistLoc = getNaturalWaistPlaneLocalization({ annotations });
  const bustLoc = getBustPointPlaneLocalization({ annotations });
  const abdomenLoc = getAbdominalPointPlaneLocalization({ annotations });

  console.log('=== ACCEPTED ANCHOR RESULTS ===');
  console.log('Natural Waist Y:', waistLoc?.yCm, 'cm');
  console.log('Bust Point Y:', bustLoc?.yCm, 'cm');
  console.log('Abdomen Point Y:', abdomenLoc?.yCm, 'cm');

  console.log('\n=== BUTTOCK POINT PLANE LOCALIZATION V1 ===');
  console.log('Status:', buttockLoc?.status);
  console.log('Selected Y:', buttockLoc?.yCm, 'cm');
  console.log('Selected Raster Row:', buttockLoc?.rasterRow);
  console.log('Side Raster Row:', buttockLoc?.sideRasterRow);
  console.log('Plateau Min Y:', buttockLoc?.selectedPlateau?.plateauMinYcm, 'cm');
  console.log('Plateau Max Y:', buttockLoc?.selectedPlateau?.plateauMaxYcm, 'cm');
  console.log('Plateau Midpoint Y:', buttockLoc?.selectedPlateau?.midpointYcm, 'cm');
  console.log('Max Raw Posterior Projection:', buttockLoc?.selectedPlateau?.maxRawPosteriorProjectionCm, 'cm');
  console.log('Max Raw Posterior U:', buttockLoc?.selectedPlateau?.maxRawPosteriorUcm, 'cm');
  console.log('Front Width at Y:', buttockLoc?.frontEvidence?.widthCm, 'cm');
  console.log('Side Qualified AP Depth at Y:', buttockLoc?.sideEvidence?.qualifiedApDepthCm, 'cm');
  console.log('Side Raw Anterior U:', buttockLoc?.sideEvidence?.rawAnteriorUcm, 'cm');
  console.log('Side Raw Posterior U:', buttockLoc?.sideEvidence?.rawPosteriorUcm, 'cm');
  console.log('Search Window:', JSON.stringify(buttockLoc?.searchWindow, null, 2));
  console.log('Domes Count:', buttockLoc?.domes?.length);
  console.log('Selected Dome:', JSON.stringify(buttockLoc?.selectedDome, null, 2));
  console.log('Blockers:', buttockLoc?.blockers);
  console.log('Warnings:', buttockLoc?.warnings);

  console.log('\n=== MODELED HIP GIRTH V1 ===');
  console.log('Status:', modeledHipGirth?.status);
  console.log('Value:', modeledHipGirth?.valueCm, 'cm');
  console.log('Y:', modeledHipGirth?.yCm, 'cm');
  console.log('Model Transverse Width:', modeledHipGirth?.model?.transverseWidthCm, 'cm');
  console.log('Model AP Depth:', modeledHipGirth?.model?.apDepthCm, 'cm');
  console.log('Model h-parameter:', modeledHipGirth?.model?.hParameter);

  console.log('\n=== MAXIMUM SEAT PLANE LOCALIZATION V0 (PRESERVED) ===');
  console.log('Status:', maxSeatLoc?.status);
  console.log('Selected Y:', maxSeatLoc?.yCm, 'cm');
  console.log('Front Width:', maxSeatLoc?.frontEvidence?.widthCm, 'cm');
  console.log('Side AP Depth:', maxSeatLoc?.sideEvidence?.qualifiedApDepthCm, 'cm');

  console.log('\n=== MODELED MAXIMUM SEAT CIRCUMFERENCE V0 (PRESERVED) ===');
  console.log('Status:', modeledMaxSeat?.status);
  console.log('Value:', modeledMaxSeat?.valueCm, 'cm');
  console.log('Y:', modeledMaxSeat?.levelYcm, 'cm');
}

main().catch(console.error);

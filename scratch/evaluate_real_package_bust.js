import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getBustPointPlaneLocalization,
  getBustPointPlaneLocalizationReport,
  getModeledBustCircumference,
  getModeledBustCircumferenceReport,
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

  const bustPoint = getBustPointPlaneLocalization({ annotations });
  const modeledBust = getModeledBustCircumference({ annotations });

  console.log('=== REAL PACKAGE EVALUATION: BUST POINT V1 & MODELED BUST CIRCUMFERENCE ===');
  console.log('Bust Point Localization Report:');
  console.log('  contract:', bustPoint?.contract);
  console.log('  status:', bustPoint?.status);
  console.log('  yCm:', bustPoint?.yCm);
  console.log('  rasterRow:', bustPoint?.rasterRow);
  console.log('  sideRasterRow:', bustPoint?.sideRasterRow);
  console.log('  Front width (cm):', bustPoint?.frontEvidence?.widthCm);
  console.log('  Side qualified AP depth (cm):', bustPoint?.sideEvidence?.qualifiedApDepthCm);
  console.log('  Side minU (cm):', bustPoint?.sideEvidence?.minUcm);
  console.log('  Side maxU (cm):', bustPoint?.sideEvidence?.maxUcm);
  console.log('  Selected plateau:', bustPoint?.selectedPlateau);
  console.log('  Search window:', bustPoint?.searchWindow);
  console.log('  Blockers:', bustPoint?.blockers);
  console.log('  Warnings:', bustPoint?.warnings);

  console.log('\nModeled Bust Circumference:');
  console.log('  contract:', modeledBust?.contract);
  console.log('  status:', modeledBust?.status);
  console.log('  valueCm:', modeledBust?.valueCm);
  console.log('  yCm:', modeledBust?.yCm);
  console.log('  model:', modeledBust?.model);
  console.log('  sourcePlane contract:', modeledBust?.sourcePlane?.contract);
  console.log('  Blockers:', modeledBust?.blockers);
  console.log('  Warnings:', modeledBust?.warnings);
}

main().catch(console.error);

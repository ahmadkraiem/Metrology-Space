import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getAbdominalPointPlaneLocalization,
  getAbdominalPointPlaneLocalizationReport,
  getModeledAbdominalCircumference,
  getModeledAbdominalCircumferenceReport,
  getAbdominalApexPlaneLocalization,
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

  const abdPointV1 = getAbdominalPointPlaneLocalization({ annotations });
  const abdApexV0 = getAbdominalApexPlaneLocalization({ annotations });
  const modeledAbd = getModeledAbdominalCircumference({ annotations });

  console.log('=== REAL PACKAGE EVALUATION: ABDOMINAL POINT V1 ===');
  console.log('Abdominal Point Localization v1 Report:');
  console.log('  contract:', abdPointV1?.contract);
  console.log('  status:', abdPointV1?.status);
  console.log('  yCm:', abdPointV1?.yCm);
  console.log('  levelYcm:', abdPointV1?.levelYcm);
  console.log('  rasterRow:', abdPointV1?.rasterRow);
  console.log('  sideRasterRow:', abdPointV1?.sideRasterRow);
  console.log('  Front width (cm):', abdPointV1?.frontEvidence?.widthCm);
  console.log('  Side qualified AP depth (cm):', abdPointV1?.sideEvidence?.qualifiedApDepthCm);
  console.log('  Side minU (cm):', abdPointV1?.sideEvidence?.minUcm);
  console.log('  Side maxU (cm):', abdPointV1?.sideEvidence?.maxUcm);
  console.log('  Selected plateau:', JSON.stringify(abdPointV1?.selectedPlateau, null, 2));
  console.log('  Selected dome:', JSON.stringify(abdPointV1?.selectedDome, null, 2));
  console.log('  Search window:', JSON.stringify(abdPointV1?.searchWindow, null, 2));
  console.log('  Blockers:', abdPointV1?.blockers);
  console.log('  Warnings:', abdPointV1?.warnings);

  console.log('\n=== LEGACY V0 REPORT (FOR REFERENCE) ===');
  console.log('  v0 contract:', abdApexV0?.contract);
  console.log('  v0 status:', abdApexV0?.status);
  console.log('  v0 yCm:', abdApexV0?.yCm);
  console.log('  v0 Front width:', abdApexV0?.selectedPeak?.frontWidthCm);
  console.log('  v0 Side depth:', abdApexV0?.selectedPeak?.qualifiedApDepthCm);

  console.log('\n=== PRODUCTION MODELED ABDOMINAL CIRCUMFERENCE ===');
  console.log('  contract:', modeledAbd?.contract);
  console.log('  status:', modeledAbd?.status);
  console.log('  valueCm:', modeledAbd?.valueCm);
  console.log('  yCm:', modeledAbd?.yCm);
  console.log('  model:', JSON.stringify(modeledAbd?.model, null, 2));
  console.log('  sourcePlane contract:', modeledAbd?.sourcePlane?.contract);
  console.log('  sourcePlane yCm:', modeledAbd?.sourcePlane?.yCm);
  console.log('  crossSectionEvidence:', JSON.stringify(modeledAbd?.crossSectionEvidence, null, 2));
  console.log('  Blockers:', modeledAbd?.blockers);
  console.log('  Warnings:', modeledAbd?.warnings);
}

main().catch(console.error);

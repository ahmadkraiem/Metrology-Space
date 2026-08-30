import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getBustApexPlaneLocalizationReport,
  getNaturalWaistPlaneLocalizationReport,
  getSideAnteriorPosteriorOrientation,
  getTorsoArbitraryYEvidenceScan,
} from '../src/features/bodyEvidence.js';
import { computeAnatomicalLevels } from '../src/features/anatomicalLevels.js';

async function main() {
  const zipPath = 'c:/Users/VIP/Documents/work-latent-space/output.zip';
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
  console.log('=== 1. SHOULDER ANCHOR ===');
  console.log('Shoulder Status:', shoulder.status);
  console.log('Shoulder Y (cm):', shoulder.yCm);
  console.log('Shoulder Delta Y (elevation diff):', shoulder.deltaYcm);

  const waistReport = getNaturalWaistPlaneLocalizationReport({ annotations });
  console.log('\n=== 2. NATURAL WAIST REPORT ===');
  console.log('Waist Status:', waistReport.status);
  console.log('Waist Y (cm):', waistReport.yCm);
  console.log('Waist Troughs Count:', waistReport.troughs.length);
  for (let i = 0; i < waistReport.troughs.length; i++) {
    const t = waistReport.troughs[i];
    console.log(`  Trough [${i}]: id=${t.troughId}, repY=${t.representativeValley.yCm}, supCrestY=${t.superiorCrestYcm}, infCrestY=${t.inferiorCrestYcm}, prominence=${t.prominenceCm}`);
  }

  const orientationReport = getSideAnteriorPosteriorOrientation({ annotations });
  console.log('\n=== 3. SIDE ORIENTATION ===');
  console.log('Status:', orientationReport.status);
  console.log('Facing Direction:', orientationReport.facingDirection);
  console.log('Anterior Side:', orientationReport.anteriorSide);
  console.log('Posterior Side:', orientationReport.posteriorSide);
  console.log('Cues:', JSON.stringify(orientationReport.cues, null, 2));

  const bustReport = getBustApexPlaneLocalizationReport({ annotations });
  console.log('\n=== 4. BUST APEX REPORT ===');
  console.log('Status:', bustReport.status);
  console.log('Selected yCm:', bustReport.yCm);
  console.log('Blockers:', bustReport.blockers);
  console.log('Warnings:', bustReport.warnings);
  console.log('Issues:', bustReport.issues);
  console.log('Search Window:', bustReport.searchWindow);
  console.log('Search Candidate Count:', bustReport.searchCandidateCount);

  console.log('\n=== 5. ALL CANDIDATES IN SEARCH WINDOW ===');
  console.log('Index | Y (cm) | Front Row | Side Row | Raw MinU | Raw MaxU | Raw Ant U | Sm Ant U | Baseline U | Prominence (cm) | Front Width (cm) | Side Span (cm) | Qualified AP (cm)');
  for (const c of bustReport.candidates) {
    console.log(`${String(c.indexInEnriched).padStart(5)} | ${c.yCm.toFixed(2).padStart(6)} | ${String(c.rasterRow).padStart(9)} | ${String(c.sideRasterRow).padStart(8)} | ${c.side.minUcm.toFixed(2).padStart(8)} | ${c.side.maxUcm.toFixed(2).padStart(8)} | ${c.rawAnteriorU.toFixed(2).padStart(9)} | ${c.smoothedAnteriorUcm.toFixed(2).padStart(8)} | ${c.baselineUcm.toFixed(2).padStart(10)} | ${c.prominenceCm.toFixed(4).padStart(15)} | ${c.front.widthCm ? c.front.widthCm.toFixed(2).padStart(16) : 'N/A'.padStart(16)} | ${c.side.profileSpanCm ? c.side.profileSpanCm.toFixed(2).padStart(14) : 'N/A'.padStart(14)} | ${c.side.qualifiedApDepthCm ? c.side.qualifiedApDepthCm.toFixed(2).padStart(17) : 'N/A'.padStart(17)}`);
  }

  console.log('\n=== 6. DETECTED PEAKS ===');
  for (const p of bustReport.peaks) {
    console.log(`  Peak at Y=${p.yCm.toFixed(2)} cm (Side row ${p.sideRasterRow}):`);
    console.log(`    rawAnteriorU: ${p.rawAnteriorUcm.toFixed(2)} cm, smoothed: ${p.smoothedAnteriorUcm.toFixed(2)} cm, baseline: ${p.baselineUcm.toFixed(2)} cm`);
    console.log(`    prominence: ${p.prominenceCm.toFixed(4)} cm`);
    console.log(`    broadnessScore: ${p.broadnessScore}`);
    console.log(`    isSpike: ${p.isSpike}, isBoundaryConfounded: ${p.isBoundaryConfounded}, isNeighborhoodStable: ${p.isNeighborhoodStable}`);
    console.log(`    Front width: ${p.candidate.front.widthCm} cm, Side span: ${p.candidate.side.profileSpanCm} cm, AP depth: ${p.candidate.side.qualifiedApDepthCm} cm`);
  }

  console.log('\n=== 7. POOLED PEAK GROUPS ===');
  for (const g of bustReport.groups) {
    console.log(`  Group ${g.peakGroupId}:`);
    console.log(`    representativePeak Y: ${g.representativePeak.yCm.toFixed(2)} cm (prominence: ${g.prominenceCm.toFixed(4)} cm)`);
    console.log(`    members (${g.memberCount}): ${g.memberYValues.map(y => y.toFixed(2)).join(', ')} cm`);
    console.log(`    Y range: [${g.groupMinYcm.toFixed(2)}, ${g.groupMaxYcm.toFixed(2)}] cm`);
  }
}

main().catch(console.error);

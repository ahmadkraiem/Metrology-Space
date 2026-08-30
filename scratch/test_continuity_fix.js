import fs from 'node:fs';
import { importBodyEvidenceZip } from '../src/features/bodyEvidenceZipAdapter.js';
import {
  setBodyEvidencePackage,
  analyzeLoadedBodyEvidenceAsync,
  getNaturalWaistPlaneLocalizationReport,
  getSideAnteriorPosteriorOrientation,
  getTorsoArbitraryYEvidenceScan,
} from '../src/features/bodyEvidence.js';
import { computeAnatomicalLevels } from '../src/features/anatomicalLevels.js';
import { applySymmetricSmoothing } from '../src/features/bustApexPlaneLocalization.js';

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
  const waistReport = getNaturalWaistPlaneLocalizationReport({ annotations });
  const orientationReport = getSideAnteriorPosteriorOrientation({ annotations });
  const scan = getTorsoArbitraryYEvidenceScan({ annotations, options: { supportPolicyId: 'trunk_core_support_v0' } });

  const upperYcm = shoulder.yCm;
  const lowerYcm = waistReport.troughs[0].superiorCrestYcm;
  const isPositiveU = orientationReport.anteriorSide === 'max_u';

  // Window candidates
  const windowCandidates = scan.candidates.filter(c => c.yCm <= upperYcm + 0.05 && c.yCm >= lowerYcm - 0.05);
  windowCandidates.sort((a, b) => b.yCm - a.yCm);

  // Extract valid single-run side rows
  const extractedRows = [];
  for (let idx = 0; idx < windowCandidates.length; idx++) {
    const c = windowCandidates[idx];
    const side = c.side;
    if (side?.minUcm === null || side?.maxUcm === null || side?.status !== 'valid' || side?.isSingleSupportedRun !== true) {
      continue;
    }
    const rawAnteriorU = isPositiveU ? side.maxUcm : side.minUcm;
    const rawPosteriorU = isPositiveU ? side.minUcm : side.maxUcm;
    const normalizedAnteriorVal = isPositiveU ? side.maxUcm : -side.minUcm;
    extractedRows.push({
      ...c,
      windowIndex: idx,
      rawAnteriorU,
      rawPosteriorU,
      normalizedAnteriorVal,
      isFrontValid: c.front?.status === 'valid' && c.front?.isSingleSupportedRun === true,
      isSideValid: true,
    });
  }

  // Segment by continuity
  const nominalSpacingCm = typeof scan?.provenance?.sampleSpacingCm === 'number' ? scan.provenance.sampleSpacingCm : 0.10;
  const gapThresholdCm = Math.max(0.35, nominalSpacingCm * 3.0);

  const segments = [];
  let currentSegment = [];
  for (let i = 0; i < extractedRows.length; i++) {
    if (i === 0) {
      currentSegment.push(extractedRows[i]);
    } else {
      const deltaY = Math.abs(extractedRows[i - 1].yCm - extractedRows[i].yCm);
      if (deltaY > gapThresholdCm) {
        segments.push(currentSegment);
        currentSegment = [extractedRows[i]];
      } else {
        currentSegment.push(extractedRows[i]);
      }
    }
  }
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  console.log('Nominal Spacing:', nominalSpacingCm, 'Gap Threshold:', gapThresholdCm);
  console.log('Total Continuous Segments:', segments.length);
  segments.forEach((seg, idx) => {
    console.log(`Segment ${idx + 1}: ${seg.length} rows, Y: [${seg[0].yCm.toFixed(2)}, ${seg[seg.length - 1].yCm.toFixed(2)}] cm`);
  });

  // Global anchor baseline
  const superiorAnchorNorm = extractedRows[0].normalizedAnteriorVal;
  const superiorAnchorY = extractedRows[0].yCm;
  const inferiorAnchorNorm = extractedRows[extractedRows.length - 1].normalizedAnteriorVal;
  const inferiorAnchorY = extractedRows[extractedRows.length - 1].yCm;
  const windowYSpan = superiorAnchorY - inferiorAnchorY;

  const smoothingRadiusSamples = Math.max(1, Math.round((2.0 / 2) / nominalSpacingCm));

  const enrichedCandidates = [];
  const rawPeaks = [];

  segments.forEach((seg, segIdx) => {
    const rawVals = seg.map(r => r.normalizedAnteriorVal);
    const smoothedVals = applySymmetricSmoothing(rawVals, smoothingRadiusSamples);

    const segEnriched = seg.map((r, inSegIdx) => {
      const smoothedNorm = smoothedVals[inSegIdx];
      const smoothedAnteriorU = isPositiveU ? smoothedNorm : -smoothedNorm;
      const t = windowYSpan > 0 ? (superiorAnchorY - r.yCm) / windowYSpan : 0.5;
      const baselineNorm = superiorAnchorNorm + t * (inferiorAnchorNorm - superiorAnchorNorm);
      const baselineUcm = isPositiveU ? baselineNorm : -baselineNorm;
      const prominenceCm = Number((smoothedNorm - baselineNorm).toFixed(4));
      return {
        ...r,
        segmentIndex: segIdx,
        indexInSegment: inSegIdx,
        indexInEnriched: enrichedCandidates.length + inSegIdx,
        smoothedAnteriorUcm: Number(smoothedAnteriorU.toFixed(4)),
        baselineUcm: Number(baselineUcm.toFixed(4)),
        prominenceCm,
      };
    });

    enrichedCandidates.push(...segEnriched);

    // Peak detection strictly inside segment (j > 0 && j < segEnriched.length - 1)
    for (let j = 1; j < segEnriched.length - 1; j++) {
      const curr = segEnriched[j];
      const prev = segEnriched[j - 1];
      const next = segEnriched[j + 1];
      const isLocalMax = curr.prominenceCm >= prev.prominenceCm && curr.prominenceCm >= next.prominenceCm;

      if (isLocalMax && curr.prominenceCm >= 0.40) {
        // Vertical support strictly inside segment
        let supportRows = 1;
        let left = j - 1;
        while (left >= 0 && segEnriched[left].prominenceCm >= curr.prominenceCm * 0.5) {
          supportRows += 1;
          left -= 1;
        }
        let right = j + 1;
        while (right < segEnriched.length && segEnriched[right].prominenceCm >= curr.prominenceCm * 0.5) {
          supportRows += 1;
          right += 1;
        }

        const isSpike = Math.abs(curr.rawAnteriorU - curr.smoothedAnteriorUcm) >= 1.0;
        const distUpper = superiorAnchorY - curr.yCm;
        const distLower = curr.yCm - inferiorAnchorY;
        const isBoundaryConfounded = distUpper < 0.8 || distLower < 0.8;
        const isNeighborhoodStable = !isSpike && supportRows >= 3;

        rawPeaks.push({
          candidateIndex: curr.indexInEnriched,
          candidate: curr,
          yCm: curr.yCm,
          rasterRow: curr.rasterRow,
          sideRasterRow: curr.sideRasterRow,
          rawAnteriorUcm: curr.rawAnteriorU,
          normalizedAnteriorVal: curr.normalizedAnteriorVal,
          smoothedAnteriorUcm: curr.smoothedAnteriorUcm,
          baselineUcm: curr.baselineUcm,
          prominenceCm: curr.prominenceCm,
          broadnessScore: supportRows,
          segmentIndex: segIdx,
          isNeighborhoodStable,
          isBoundaryConfounded,
          isFrontValid: curr.isFrontValid,
        });
      }
    }
  });

  console.log('\nDetected Peaks with Continuity Fix:');
  rawPeaks.forEach(p => {
    console.log(`  Peak in Segment ${p.segmentIndex + 1} at Y=${p.yCm.toFixed(2)} cm (row ${p.rasterRow}): Prominence=${p.prominenceCm.toFixed(4)} cm, Broadness=${p.broadnessScore}, Stable=${p.isNeighborhoodStable}, Confounded=${p.isBoundaryConfounded}`);
  });

  // What happened to candidate at Y=128.65 cm (row 713)?
  const c12865 = enrichedCandidates.find(c => Math.abs(c.yCm - 128.65) < 0.05);
  console.log('\nCandidate at Y=128.65 cm (row 713):');
  console.log('  Segment Index:', c12865.segmentIndex + 1);
  console.log('  Index In Segment:', c12865.indexInSegment, 'out of', segments[c12865.segmentIndex].length);
  console.log('  Is Segment Edge:', c12865.indexInSegment === segments[c12865.segmentIndex].length - 1);
  console.log('  Prominence:', c12865.prominenceCm);
}

main().catch(console.error);

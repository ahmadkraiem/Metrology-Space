/**
 * Compact Side evidence status for the 2D readout/header.
 * Never rendered on the plot field.
 *
 * @param {{
 *   sidePoseLoaded: boolean,
 *   analyzed: boolean,
 *   coreCount?: number,
 *   secondaryCount?: number,
 * }} state
 * @returns {string}
 */
export function formatSideEvidenceStatus({
  sidePoseLoaded,
  analyzed,
  coreCount = 0,
  secondaryCount = 0,
}) {
  if (!analyzed) {
    return sidePoseLoaded ? 'Side Pose loaded' : 'No Side Pose';
  }

  if (!sidePoseLoaded) {
    return 'Analyzed · no Side Pose';
  }

  const core = Number(coreCount) || 0;
  const secondary = Number(secondaryCount) || 0;

  if (core === 0 && secondary === 0) {
    return 'Analyzed · 0 Side landmarks';
  }

  return `Side Core ${core} · Sec. ${secondary}`;
}

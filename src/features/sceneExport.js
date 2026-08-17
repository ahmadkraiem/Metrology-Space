import {
  GRID_UNIT,
  INTERNAL_POINT_COUNT,
  INTERNAL_SAMPLE_UNIT,
  ROOM_SIZE,
} from '../core/constants.js';
import { calculateDistance } from '../core/math.js';
import { getAppMode } from './appMode.js';
import { getAnnotations } from './annotations.js';
import { getMeasurementHistory } from './measurement.js';
import { exportSceneJsonBtn } from '../ui/domRefs.js';

function exportPoint(point) {
  if (!point) {
    return null;
  }

  return { x: point.x, y: point.y, z: point.z };
}

function roundExportDistanceCm(distance) {
  return Math.round(distance * 100) / 100;
}

function formatExportFilenameTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
}

function formatExportLocalTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getExportTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function buildExportMetadata(exportedAt) {
  const metadata = {
    appName: 'REVacity Metrology Space',
    version: 1,
    exportedAtUtc: exportedAt.toISOString(),
    exportedAtLocal: formatExportLocalTimestamp(exportedAt),
  };

  const timezone = getExportTimezone();
  if (timezone) {
    metadata.timezone = timezone;
  }

  return metadata;
}

export function buildSceneState(measurement, exportedAt = new Date()) {
  const hasA = Boolean(measurement.pointA);
  const hasB = Boolean(measurement.pointB);

  return {
    metadata: buildExportMetadata(exportedAt),
    sceneScale: {
      unit: 'cm',
      sceneUnit: '1 scene unit = 1 cm',
      cubeSizeCm: { x: ROOM_SIZE, y: ROOM_SIZE, z: ROOM_SIZE },
      visibleGridCm: GRID_UNIT,
      internalSamplingCm: INTERNAL_SAMPLE_UNIT,
      internalPointCount: INTERNAL_POINT_COUNT,
    },
    appMode: {
      currentMode: getAppMode(),
    },
    referenceMarkers: {
      origin: { x: 0, y: 0, z: 0 },
      center: { x: 100, y: 100, z: 100 },
    },
    activeMeasurement: {
      pointA: exportPoint(measurement.pointA),
      pointB: exportPoint(measurement.pointB),
      distanceCm: hasA && hasB
        ? roundExportDistanceCm(calculateDistance(measurement.pointA, measurement.pointB))
        : null,
    },
    measurementHistory: getMeasurementHistory().map((entry) => ({
      number: entry.number,
      pointA: entry.pointA,
      pointB: entry.pointB,
      distanceCm: roundExportDistanceCm(entry.distance),
    })),
    annotations: getAnnotations().map((entry) => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      position: entry.point,
    })),
  };
}

export function downloadSceneStateJson(measurement) {
  const exportedAt = new Date();
  const json = JSON.stringify(buildSceneState(measurement, exportedAt), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `revacity-scene-state-${formatExportFilenameTimestamp(exportedAt)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function setupSceneExport(measurement) {
  exportSceneJsonBtn.addEventListener('click', () => {
    downloadSceneStateJson(measurement);
  });
}

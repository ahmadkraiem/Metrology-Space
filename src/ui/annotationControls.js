import {
  DEFAULT_ANNOTATION_TYPE,
  DEFAULT_LANDMARK_PRESET,
  LANDMARK_PRESET_CUSTOM,
  formatLandmarkPresetLabel,
  getLandmarkPresetsForType,
} from '../core/annotationTypes.js';
import {
  annotationNameInput,
  annotationPresetSelect,
  annotationTypeSelect,
} from './domRefs.js';
import { clearAnnotationValidationMessage } from './annotationValidationMessage.js';

function applyPresetToName(preset) {
  if (preset === LANDMARK_PRESET_CUSTOM) {
    return;
  }

  annotationNameInput.value = preset;
}

function populatePresetOptions(type) {
  const presets = getLandmarkPresetsForType(type);

  annotationPresetSelect.replaceChildren();
  presets.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset;
    option.textContent = formatLandmarkPresetLabel(preset);
    annotationPresetSelect.append(option);
  });

  annotationPresetSelect.value = DEFAULT_LANDMARK_PRESET;
}

function handleAnnotationTypeChange() {
  clearAnnotationValidationMessage();
  populatePresetOptions(annotationTypeSelect.value);
}

function handlePresetChange() {
  clearAnnotationValidationMessage();
  applyPresetToName(annotationPresetSelect.value);
}

export function resetAnnotationControls() {
  annotationNameInput.value = '';
  annotationTypeSelect.value = DEFAULT_ANNOTATION_TYPE;
  populatePresetOptions(DEFAULT_ANNOTATION_TYPE);
}

export function setupAnnotationControls() {
  populatePresetOptions(annotationTypeSelect.value);
  annotationTypeSelect.addEventListener('change', handleAnnotationTypeChange);
  annotationPresetSelect.addEventListener('change', handlePresetChange);
  annotationNameInput.addEventListener('input', clearAnnotationValidationMessage);
}

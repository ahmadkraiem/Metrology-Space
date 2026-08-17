import { normalizeAnnotationType } from '../core/annotationTypes.js';

export function normalizeAnnotationName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  return name.trim();
}

export function findDuplicateAnnotation(annotations, type, name) {
  const normalizedType = normalizeAnnotationType(type);
  const normalizedName = normalizeAnnotationName(name).toLowerCase();

  if (!normalizedName) {
    return null;
  }

  return annotations.find((entry) => (
    normalizeAnnotationType(entry.type) === normalizedType
    && normalizeAnnotationName(entry.name).toLowerCase() === normalizedName
  )) ?? null;
}

export function validateAnnotationInput({ name, type, selectedPoint, annotations }) {
  if (!selectedPoint) {
    return {
      valid: false,
      message: 'Select a point before adding an annotation.',
    };
  }

  const normalizedName = normalizeAnnotationName(name);
  if (!normalizedName) {
    return {
      valid: false,
      message: 'Annotation name is required.',
    };
  }

  const normalizedType = normalizeAnnotationType(type);

  if (findDuplicateAnnotation(annotations, normalizedType, normalizedName)) {
    return {
      valid: false,
      message: `A ${normalizedType} named ${normalizedName} already exists.`,
    };
  }

  return {
    valid: true,
    name: normalizedName,
    type: normalizedType,
  };
}

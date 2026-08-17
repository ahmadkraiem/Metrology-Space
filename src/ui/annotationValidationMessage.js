import { annotationValidationMessageEl } from './domRefs.js';

export function showAnnotationValidationMessage(message) {
  annotationValidationMessageEl.textContent = message;
  annotationValidationMessageEl.hidden = false;
}

export function clearAnnotationValidationMessage() {
  annotationValidationMessageEl.textContent = '';
  annotationValidationMessageEl.hidden = true;
}

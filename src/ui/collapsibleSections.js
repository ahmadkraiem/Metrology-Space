/**
 * Left Metrology Inspector — UI-only collapsible section headers.
 * Does not touch scene, measurement, annotation, or export/import state.
 */

/** Panel sections and inner subgroups collapse the same way, with their own header/caret class. */
const HEADER_VARIANTS = [
  { selector: ':scope > .section-title', collapsibleClass: 'section-title--collapsible' },
  { selector: ':scope > .inspector-subgroup-label', collapsibleClass: 'inspector-subgroup-label--collapsible' },
];

const wiredSections = new WeakSet();

function resolveHeader(section) {
  for (const variant of HEADER_VARIANTS) {
    const header = section.querySelector(variant.selector);
    if (header) {
      return { header, collapsibleClass: variant.collapsibleClass };
    }
  }
  return null;
}

function setExpanded(section, header, expanded) {
  section.classList.toggle('is-collapsed', !expanded);
  header.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function wireSection(section) {
  if (wiredSections.has(section)) {
    return;
  }

  const resolved = resolveHeader(section);
  if (!resolved) {
    return;
  }

  const { header, collapsibleClass } = resolved;
  header.classList.add(collapsibleClass);
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');

  const startExpanded = !section.hasAttribute('data-collapsed');
  setExpanded(section, header, startExpanded);

  const toggle = () => {
    const expanded = section.classList.contains('is-collapsed');
    setExpanded(section, header, expanded);
  };

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });
  wiredSections.add(section);
}

/**
 * Wire sections marked with data-collapsible under root.
 * Default root is #left-sidebar; pass #right-sidebar to wire Session Records,
 * Diagnostics, and nested diagnostic accordions in one pass.
 * Already-wired sections are skipped so nested discovery cannot double-bind.
 */
export function initCollapsibleSections(root = document.getElementById('left-sidebar')) {
  if (!root) {
    return;
  }

  const sections = [];
  if (typeof root.matches === 'function' && root.matches('[data-collapsible]')) {
    sections.push(root);
  }
  sections.push(...root.querySelectorAll('[data-collapsible]'));
  sections.forEach(wireSection);
}

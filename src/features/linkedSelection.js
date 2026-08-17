/** Visual-only active node id for 2D / Scene Graph / Annotation List linking. */

let activeLinkedNodeId = null;
const changeHandlers = new Set();

export function getActiveLinkedNodeId() {
  return activeLinkedNodeId;
}

export function setActiveLinkedNode(nodeId) {
  const nextId = nodeId || null;
  if (activeLinkedNodeId === nextId) {
    return;
  }

  activeLinkedNodeId = nextId;
  for (const handler of changeHandlers) {
    handler(activeLinkedNodeId);
  }
}

export function clearActiveLinkedNode() {
  setActiveLinkedNode(null);
}

export function clearActiveLinkedNodeIfMatches(nodeId) {
  if (activeLinkedNodeId === nodeId) {
    clearActiveLinkedNode();
  }
}

export function subscribeLinkedSelection(handler) {
  if (typeof handler !== 'function') {
    return () => {};
  }

  changeHandlers.add(handler);
  return () => changeHandlers.delete(handler);
}

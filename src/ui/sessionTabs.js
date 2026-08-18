import {
  sessionTabAnnotationsBtn,
  sessionTabBodyBtn,
  sessionTabGraphBtn,
  sessionTabHistoryBtn,
  tabPanelAnnotations,
  tabPanelBody,
  tabPanelGraph,
  tabPanelHistory,
} from './domRefs.js';
import { clearGraphHighlight } from '../features/sceneGraphHighlight.js';

const TAB_IDS = ['history', 'annotations', 'body', 'graph'];

const tabButtons = {
  history: sessionTabHistoryBtn,
  annotations: sessionTabAnnotationsBtn,
  body: sessionTabBodyBtn,
  graph: sessionTabGraphBtn,
};

const tabPanels = {
  history: tabPanelHistory,
  annotations: tabPanelAnnotations,
  body: tabPanelBody,
  graph: tabPanelGraph,
};

let activeTab = 'history';

function switchTab(tabId) {
  if (!TAB_IDS.includes(tabId) || activeTab === tabId) {
    return;
  }

  activeTab = tabId;

  clearGraphHighlight();

  TAB_IDS.forEach((id) => {
    tabPanels[id].classList.toggle('tab-panel-hidden', id !== tabId);
    tabButtons[id].classList.toggle('session-tab-btn--active', id === tabId);
    tabButtons[id].setAttribute('aria-selected', id === tabId ? 'true' : 'false');
  });
}

export function setupSessionTabs() {
  TAB_IDS.forEach((id) => {
    tabButtons[id].addEventListener('click', () => {
      switchTab(id);
    });
  });
}

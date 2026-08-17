import {
  sessionTabAnnotationsBtn,
  sessionTabBodyBtn,
  sessionTabFilesBtn,
  sessionTabGraphBtn,
  sessionTabHistoryBtn,
  tabPanelAnnotations,
  tabPanelBody,
  tabPanelFiles,
  tabPanelGraph,
  tabPanelHistory,
} from './domRefs.js';
import { clearGraphHighlight } from '../features/sceneGraphHighlight.js';

const TAB_IDS = ['history', 'annotations', 'body', 'graph', 'files'];

const tabButtons = {
  history: sessionTabHistoryBtn,
  annotations: sessionTabAnnotationsBtn,
  body: sessionTabBodyBtn,
  graph: sessionTabGraphBtn,
  files: sessionTabFilesBtn,
};

const tabPanels = {
  history: tabPanelHistory,
  annotations: tabPanelAnnotations,
  body: tabPanelBody,
  graph: tabPanelGraph,
  files: tabPanelFiles,
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

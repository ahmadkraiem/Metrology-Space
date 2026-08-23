import {
  scene,
  camera,
  renderer,
  labelRenderer,
  controls,
  onResize,
} from './core/scene.js';
import { createRoomShell, createGridMarkers } from './metrology/roomShell.js';
import {
  createInternalVolumeGrid,
  updateInternalVolumeLod,
} from './metrology/volumeGrid.js';
import { createAxes } from './metrology/axes.js';
import { createReferenceMarkers } from './metrology/referenceMarkers.js';
import {
  createSelectionHighlight,
} from './features/selection.js';
import {
  createHoverHighlight,
} from './interactions/hover.js';
import { setupPointInteraction } from './interactions/pointerEvents.js';
import { setupAppModeControls } from './ui/appModeControls.js';
import { setupInspectorWorkflow } from './ui/inspectorWorkflow.js';
import { setupAnnotationControls } from './ui/annotationControls.js';
import { setupSceneExport } from './features/sceneExport.js';
import { setupSceneImport } from './features/sceneImport.js';
import { setupSceneGraphPanel } from './ui/sceneGraphPanel.js';
import { setupSessionTabs } from './ui/sessionTabs.js';
import { setupSideMeasurementInspector } from './ui/measurementPanel.js';
import { setupAppMenuBar } from './ui/appMenuBar.js';
import { setupViewControls } from './ui/viewControls.js';
import { setupBodyEvidencePanel } from './ui/bodyEvidencePanel.js';
import { setupLeftPanel } from './ui/leftPanel.js';
import { setupBodyTabConsolidatedPanel } from './ui/bodyTabConsolidatedPanel.js';
import { setupBodyEvidenceOverlay2d } from './ui/bodyEvidenceOverlay2d.js';
import { setupSideGrid2dNavigator } from './ui/sideGrid2dNavigator.js';
import { initCollapsibleSections } from './ui/collapsibleSections.js';
import { setupGrid2dNavigator, refreshGrid2dNavigator } from './ui/grid2dNavigator.js';
import { setupWorkspaceLayout } from './ui/workspaceLayout.js';
import { setupBodyGraphWorkspace } from './ui/bodyGraphWorkspace.js';
import { setupProjectionLinking } from './features/projectionLinking.js';
import { setupFrontSurfaceMeasurement } from './features/frontSurfaceMeasurement.js';
import {
  createMeasurementState,
} from './features/measurement.js';
import {
  annotationsGroup,
} from './features/annotations.js';
import { graphHighlightGroup } from './features/sceneGraphHighlight.js';
import {
  createBodyMeasurementPreviewGroup,
  setupBodyMeasurementPreview,
} from './features/bodyMeasurementPreview.js';

scene.add(createRoomShell());
scene.add(createGridMarkers());
const internalVolumeGrid = createInternalVolumeGrid();
scene.add(internalVolumeGrid);
const selectionHighlight = createSelectionHighlight();
const hoverHighlight = createHoverHighlight();
const measurement = createMeasurementState();
scene.add(hoverHighlight);
scene.add(measurement.line);
scene.add(measurement.markerA);
scene.add(measurement.markerB);
scene.add(measurement.distanceLabel);
scene.add(selectionHighlight);
scene.add(createAxes());
const referenceMarkers = createReferenceMarkers();
scene.add(referenceMarkers);
scene.add(annotationsGroup);
scene.add(graphHighlightGroup);
const bodyMeasurementPreviewGroup = createBodyMeasurementPreviewGroup();
scene.add(bodyMeasurementPreviewGroup);

setupPointInteraction(internalVolumeGrid, selectionHighlight, hoverHighlight, measurement, referenceMarkers);
setupInspectorWorkflow();
setupAppModeControls(measurement, selectionHighlight);
setupAnnotationControls();
setupSceneExport(measurement);
setupSceneImport(measurement, selectionHighlight);
setupSceneGraphPanel(measurement);
setupSessionTabs();
setupFrontSurfaceMeasurement(measurement);
setupGrid2dNavigator(selectionHighlight);
setupSideGrid2dNavigator();
setupProjectionLinking(refreshGrid2dNavigator);
setupBodyMeasurementPreview(refreshGrid2dNavigator);
setupViewControls(referenceMarkers, internalVolumeGrid, measurement);
setupSideMeasurementInspector();
setupBodyEvidenceOverlay2d(refreshGrid2dNavigator);
setupBodyEvidencePanel();
setupLeftPanel();
setupBodyTabConsolidatedPanel();
initCollapsibleSections();
setupBodyGraphWorkspace();
setupWorkspaceLayout();
setupAppMenuBar({
  measurement,
  selectionHighlight,
  referenceMarkers,
  volumeGrid: internalVolumeGrid,
});

window.addEventListener('resize', onResize);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateInternalVolumeLod(
    internalVolumeGrid,
    camera.position.distanceTo(controls.target),
  );
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();

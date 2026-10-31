export { DetectionCanvas, type DetectionCanvasProps } from './ui/detection-canvas';
export { VisionDialog, type VisionDialogProps } from './ui/vision-dialog';
export { SelectedAppliance } from './ui/selected-appliance';
export { VillageEditorPage, SAMPLE_ROOM_URL } from './ui/village-editor-page';
export {
  useVisionDetection,
  type VisionState,
  type VisionStatus,
} from './hooks/use-vision-detection';
export { useVisionSession, MAX_MANUAL_BOXES } from './hooks/use-vision-session';
export { useShapeEditor, KEY_STEP } from './hooks/use-shape-editor';
export { useEdgeMap, type EdgeMapState } from './hooks/use-edge-map';
export { DrawOverlay } from './ui/draw-overlay';
export { DrawPanel, type DrawPanelProps } from './ui/draw-panel';
export * from './utils/shapes';
export { buildEdgeMap, snapToEdge, type EdgeMap } from './utils/edge-map';
export { prepareVisionImage } from './utils/prepare-image';
export { categoryHint } from './utils/labels';
export { useObjectName, useDetectionLabel } from './hooks/use-object-name';
export { useObjectShape, shapeKey, type ObjectShapeState } from './hooks/use-object-shape';
export { ObjectShapePanel, type ObjectShapePanelProps } from './ui/object-shape-panel';
export { recipeMesh, silhouetteMesh, SILHOUETTE_DEPTH } from './utils/object-geometry';
export { usePhotoZoom, stepZoom, photoWidth, ZOOM_STEPS } from './hooks/use-photo-zoom';
export { ZoomControls } from './ui/zoom-controls';

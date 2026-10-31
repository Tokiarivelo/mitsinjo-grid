export { DetectionCanvas, type DetectionCanvasProps } from './ui/detection-canvas';
export { VisionDialog, type VisionDialogProps } from './ui/vision-dialog';
export { SelectedAppliance } from './ui/selected-appliance';
export { VillageEditorPage, SAMPLE_ROOM_URL } from './ui/village-editor-page';
export {
  useVisionDetection,
  type VisionState,
  type VisionStatus,
} from './hooks/use-vision-detection';
export { useVisionSession } from './hooks/use-vision-session';
export { fitWithin, prepareVisionImage, VISION_MAX_SIDE } from './utils/prepare-image';
export { categoryHint } from './utils/labels';

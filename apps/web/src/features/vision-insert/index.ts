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
export { useBoxDrawing } from './hooks/use-box-drawing';
export { ManualBoxForm, type ManualBoxFormProps } from './ui/manual-box-form';
export {
  boxFromPoints,
  manualDetection,
  toNormPoint,
  DEFAULT_MANUAL_BOX,
  MIN_BOX_SIDE,
} from './utils/manual-box';
export { prepareVisionImage } from './utils/prepare-image';
export { categoryHint } from './utils/labels';

export { DetectionCanvas, type DetectionCanvasProps } from './ui/detection-canvas';
export { VisionDialog, type VisionDialogProps } from './ui/vision-dialog';
export {
  useVisionDetection,
  type VisionState,
  type VisionStatus,
} from './hooks/use-vision-detection';
export { fitWithin, prepareVisionImage, VISION_MAX_SIDE } from './utils/prepare-image';

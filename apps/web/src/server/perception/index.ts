export { PerceptionClient, getPerceptionClient } from './client';
export { MetaPerceptionBackend } from './meta';
export { MockPerceptionBackend, MOCK_PERCEPTION_MODEL, MOCK_DETECTIONS } from './mock';
export { parseDetections, toApplianceCategory, gridBoxToNorm, MAX_DETECTIONS } from './detect';
export { parseSamOutput, parseSamMask, boxUnionCoverage, type SamMask } from './parse-sam';
export {
  refineDetections,
  iou,
  samBoxToNorm,
  SEGMENT_TIMEOUT_MS,
  MAX_SEGMENT_CONCEPTS,
} from './outline';
export type { PerceptionBackend, PerceptionCall, ShapeSubject } from './backend';
export { parseKit, mockRecipe, SHAPE_JSON_SCHEMA } from './shape';
export { runObjectShape, SHAPE_TIMEOUT_MS } from './object-shape';
export * from './schemas';

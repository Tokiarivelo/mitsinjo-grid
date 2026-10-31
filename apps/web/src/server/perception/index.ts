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
export type { PerceptionBackend, PerceptionCall } from './backend';
export * from './schemas';

export { PerceptionClient, getPerceptionClient } from './client';
export { MetaPerceptionBackend } from './meta';
export { MockPerceptionBackend, MOCK_PERCEPTION_MODEL, MOCK_DETECTIONS } from './mock';
export { parseDetections, toApplianceCategory, gridBoxToNorm, MAX_DETECTIONS } from './detect';
export { parseSamOutput, boxUnionCoverage } from './parse-sam';
export type { PerceptionBackend, PerceptionCall } from './backend';
export * from './schemas';

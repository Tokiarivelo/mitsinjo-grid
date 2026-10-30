export * from './common';
export * from './input';
export * from './result';
export * from './workflow';
export * from './sweep';
export * from './hardware';

import { SimulationInput, SimulationInputSchema } from './input';

export function parseInput(raw: unknown): SimulationInput {
  return SimulationInputSchema.parse(raw);
}

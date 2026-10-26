export * from './common';
export * from './input';
export * from './result';

import { SimulationInput, SimulationInputSchema } from './input';

export function parseInput(raw: unknown): SimulationInput {
  return SimulationInputSchema.parse(raw);
}

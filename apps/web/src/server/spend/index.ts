import 'server-only';

import { env } from '@/lib/env';
import { SpendGuard } from './spend-guard';

export { SpendGuard, estimateCostUsd, estimateTokens, type UsageSample } from './spend-guard';

/** Process-wide guard shared by the copilot loop and the perception clients. */
export const spendGuard = new SpendGuard(env.META_SPEND_CAP_USD);

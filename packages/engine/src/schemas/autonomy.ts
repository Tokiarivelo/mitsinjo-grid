import { z } from 'zod';
import { SectorIdSchema, StrategyIdSchema } from './common';
import { InputPatchSchema } from './input';
import { MAX_WORKFLOW_DAYS } from './workflow';

/**
 * AI autonomous dispatch (PA): who drives the grid, what the AI detected, what it did, and the
 * event log. Pure data — the detectors and the decision policy fill these from engine results.
 */

/** `manual`: operator only · `assisted`: AI proposes (M10 autopilot) · `autonomous`: AI applies alone. */
export const DispatchModeSchema = z.enum(['manual', 'assisted', 'autonomous']);
export type DispatchMode = z.infer<typeof DispatchModeSchema>;

export const IncidentKindSchema = z.enum([
  'fire',
  'overload',
  'demand_surge',
  'reserve_low',
  'critical_forecast',
  'solar_surplus',
  'meter_anomaly',
  'lifeline_shortfall',
]);
export type IncidentKind = z.infer<typeof IncidentKindSchema>;

export const IncidentSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

/** Order used to sort incidents and log lines: most severe first. */
export const SEVERITY_RANK: Record<IncidentSeverity, number> = { critical: 0, warning: 1, info: 2 };

const DaySchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_WORKFLOW_DAYS - 1);
const HourSchema = z.number().int().min(0).max(23);

/** Engine values that justify a detection or a result (field name → number). Never LLM output. */
export const EvidenceSchema = z.record(z.string().min(1).max(40), z.number().finite());
export type Evidence = z.infer<typeof EvidenceSchema>;

export const IncidentSchema = z.object({
  kind: IncidentKindSchema,
  severity: IncidentSeveritySchema,
  day: DaySchema,
  hour: HourSchema,
  sector: SectorIdSchema.optional(),
  evidence: EvidenceSchema,
});
export type Incident = z.infer<typeof IncidentSchema>;

export const AutoActionKindSchema = z.enum([
  'isolate_sector',
  'cap_sector',
  'shed_flexible',
  'switch_strategy',
  'raise_clinic_floor',
  'reserve_night',
  'shift_flexible',
  'restore_sector',
  'alert_only',
]);
export type AutoActionKind = z.infer<typeof AutoActionKindSchema>;

/** Kinds that act on one sector (the sector is required). */
const SECTOR_ACTIONS: readonly AutoActionKind[] = [
  'isolate_sector',
  'cap_sector',
  'shed_flexible',
  'shift_flexible',
  'restore_sector',
];

/**
 * One action the AI applies. `switch_strategy` carries `strategy`; `alert_only` changes nothing;
 * every other kind carries the `patch` the store applies (so undo works like any approved change).
 */
export const AutoActionSchema = z
  .object({
    kind: AutoActionKindSchema,
    sector: SectorIdSchema.optional(),
    patch: InputPatchSchema.optional(),
    strategy: StrategyIdSchema.optional(),
    /** Incident this action answers (absent for an operator request in autonomous mode). */
    answers: IncidentKindSchema.optional(),
  })
  .superRefine((a, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (a.kind === 'switch_strategy') {
      if (!a.strategy) issue('switch_strategy needs a strategy');
    } else if (a.kind === 'alert_only') {
      if (a.patch || a.strategy) issue('alert_only changes nothing');
    } else if (!a.patch) {
      issue(`${a.kind} needs a patch`);
    }
    if (SECTOR_ACTIONS.includes(a.kind) && !a.sector) issue(`${a.kind} needs a sector`);
  });
export type AutoAction = z.infer<typeof AutoActionSchema>;

/** Engine figures of a run, before or after an action (and of the "do nothing" counterfactual). */
export const DispatchSnapshotSchema = z.object({
  resultId: z.string().min(1),
  unservedKwh: z.number().min(0),
  criticalUnservedKwh: z.number().min(0),
  socEndPct: z.number().min(0).max(100),
});
export type DispatchSnapshot = z.infer<typeof DispatchSnapshotSchema>;

/** AI wording of a log line: from the LLM, or the i18n template when it is unavailable. */
export const NarrationSchema = z.object({
  text: z.string().min(1).max(400),
  source: z.enum(['llm', 'template']),
});
export type Narration = z.infer<typeof NarrationSchema>;

/** One line of the event log: a detection, an action, or both. */
export const DispatchLogEntrySchema = z
  .object({
    id: z.string().min(1),
    day: DaySchema,
    hour: HourSchema,
    mode: DispatchModeSchema,
    /** `ai`: decided by the policy · `operator`: asked by the operator (chat) and applied alone. */
    origin: z.enum(['ai', 'operator']),
    incident: IncidentSchema.optional(),
    action: AutoActionSchema.optional(),
    before: DispatchSnapshotSchema.optional(),
    after: DispatchSnapshotSchema.optional(),
    narration: NarrationSchema.optional(),
    /** `dispatchLogHash` of the entry without this field (audit, reproducible). */
    hash: z.string().min(1),
  })
  .refine((e) => e.incident || e.action, { message: 'a log line needs an incident or an action' })
  .refine((e) => !e.action || e.action.kind === 'alert_only' || (e.before && e.after), {
    message: 'an action that changes the grid logs the engine figures before and after',
  });
export type DispatchLogEntry = z.infer<typeof DispatchLogEntrySchema>;

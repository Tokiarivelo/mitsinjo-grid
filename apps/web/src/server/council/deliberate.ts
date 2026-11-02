import 'server-only';

import {
  connectedSectors,
  InputPatchSchema,
  type ChangeImpact,
  type InputPatch,
  type SectorId,
  type SimulationInput,
  type StrategyId,
} from '@mitsinjo/engine';
import { proposalImpact } from '@/lib/proposal-impact';

/**
 * Sector council (M7-T1, W2): one agent per connected sector defends its load with a patch,
 * every patch is engine-simulated, and a mediator (Wonder when paid) recommends one.
 * Turn budget (`maxRounds`, 1–3) and cost budget (`canSpend`, rest degrades to mock) bound the run.
 */

export interface CouncilAgent {
  sector: SectorId;
  patch: InputPatch;
  reason: string;
  impact: ChangeImpact;
  /** True for a mock persona (offline, capped, or the model answer was unusable). */
  mock: boolean;
}

export interface CouncilVerdict {
  /** The recommended agent's sector (stable sector order breaks ties). */
  pick: SectorId;
  synthesis: string;
  mock: boolean;
}

export interface CouncilRun {
  question: string;
  rounds: number;
  agents: CouncilAgent[];
  verdict: CouncilVerdict;
}

export interface CouncilChatTurn {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface RunCouncilOptions {
  input: SimulationInput;
  strategy: StrategyId;
  question: string;
  /** Deliberation rounds (default 1, max 3): later rounds see the earlier impacts. */
  maxRounds?: number;
  chat: (system: string, user: string) => Promise<CouncilChatTurn>;
  /** Mediator calls go here (Wonder when paid); defaults to `chat`. */
  mediatorChat?: (system: string, user: string) => Promise<CouncilChatTurn>;
  /** Offline: personas only, the chat model is never called. */
  isMock: boolean;
  /** Model id billed for paid agent calls. */
  model?: string;
  /** Model id billed for the mediator call (defaults to `model`). */
  mediatorModel?: string;
  canSpend: () => boolean;
  recordSpend: (model: string, usage: { inputTokens: number; outputTokens: number }) => void;
  /** Called once when the first seat degrades to mock on cost grounds. */
  emitFallback?: () => void;
  locale?: 'en' | 'fr' | 'mg';
}

const MAX_ROUNDS = 3;

/** Opening bid per sector: a survival floor for itself (binding in every strategy). */
const MOCK_FLOOR_KW: Record<string, number> = {
  health: 1.0,
  water: 0.8,
  school: 0.5,
  households: 0.4,
  market: 0.4,
  industry: 0.4,
};

type Locale = 'en' | 'fr' | 'mg';

const MOCK_REASONS: Record<Locale, Record<string, string>> = {
  en: {
    health: 'Survival current for the vaccine cold chain, whatever the hour.',
    water: 'A guaranteed floor keeps the pumps primed for the next day.',
    school: 'Evening classes need a minimum of light.',
    households: 'Homes keep at least lighting through the cut.',
    market: 'Stalls keep cold storage alive through the evening.',
    industry: 'The workshop keeps its minimum process load.',
  },
  fr: {
    health: 'Courant de survie pour la chaîne du froid des vaccins, à toute heure.',
    water: 'Un plancher garanti garde les pompes amorcées pour le lendemain.',
    school: "Les cours du soir ont besoin d'un minimum de lumière.",
    households: 'Les foyers gardent au moins la lumière pendant la coupure.',
    market: 'Les étals gardent la chaîne du froid le soir.',
    industry: "L'atelier garde sa charge minimale de production.",
  },
  mg: {
    health: 'Herinaratra vonjy aina ho an’ny vaksiny, na oviana na oviana.',
    water: 'Farafahakeliny antoka mba hiomanana ny paompy rahampitso.',
    school: 'Mila jiro farafahakeliny ny fianarana hariva.',
    households: 'Mahazo jiro farafahakeliny ny tokantrano mandritra ny fahatapahana.',
    market: 'Mitoetra mangatsiaka ny entana eny an-tsena hariva.',
    industry: 'Mitana ny enta-mavesatra farafahakeliny ny atrikasa.',
  },
};

function mockPersona(sector: SectorId, locale: Locale): { patch: InputPatch; reason: string } {
  return {
    patch: { lifeline: { kw: { [sector]: MOCK_FLOOR_KW[sector] ?? 0.4 } } } as InputPatch,
    reason: MOCK_REASONS[locale][sector] ?? MOCK_REASONS.en[sector] ?? 'Survival floor.',
  };
}

function agentSystem(sector: SectorId, locale: Locale): string {
  const lang =
    locale === 'fr'
      ? 'Answer in French.'
      : locale === 'mg'
        ? 'Answer in Malagasy.'
        : 'Answer in English.';
  return (
    `You are the delegate of the ${sector} sector on a microgrid council. ` +
    `Defend your sector's supply with ONE patch (JSON: {"patch": <InputPatch>, "reason": "<2 lines max>"}). ` +
    `Prefer a lifeline floor (kW, max 2) or a priority change for your own sector; never cut another sector directly. ` +
    `Reply with JSON only. ${lang}`
  );
}

function mediatorSystem(locale: Locale): string {
  const lang =
    locale === 'fr'
      ? 'Answer in French.'
      : locale === 'mg'
        ? 'Answer in Malagasy.'
        : 'Answer in English.';
  return (
    'You mediate a microgrid council: each sector proposed a patch, already simulated by the engine. ' +
    'Recommend ONE sector to adopt (JSON: {"pick": "<sectorId>", "synthesis": "<3 lines max>"}), ' +
    'lowest unserved energy first, essential services second. Reply with JSON only. ' +
    `${lang}`
  );
}

function impactLine(a: { sector: SectorId; impact: ChangeImpact }): string {
  const own = a.impact.sectors[a.sector];
  return (
    `${a.sector}: unserved ${a.impact.unservedKwhAfter} kWh, ` +
    `own served Δ ${own?.servedKwhDelta ?? 0} kWh`
  );
}

function mockVerdict(agents: CouncilAgent[], locale: Locale): CouncilVerdict {
  const ranked = [...agents].sort((a, b) => a.impact.unservedKwhAfter - b.impact.unservedKwhAfter);
  const best = ranked[0]!;
  const synthesis =
    locale === 'fr'
      ? `Le moteur favorise ${best.sector} : énergie non desservie minimale (${best.impact.unservedKwhAfter} kWh).`
      : locale === 'mg'
        ? `Ny motera manohana ${best.sector} : angovo tsy voakarakara kely indrindra (${best.impact.unservedKwhAfter} kWh).`
        : `The engine favors ${best.sector}: lowest unserved energy (${best.impact.unservedKwhAfter} kWh).`;
  return { pick: best.sector, synthesis, mock: true };
}

function parseAgentAnswer(
  text: string,
  sector: SectorId,
  locale: Locale
): { patch: InputPatch; reason: string; mock: boolean } {
  try {
    const parsed = JSON.parse(text) as { patch?: unknown; reason?: unknown };
    const patch = InputPatchSchema.safeParse(parsed.patch);
    if (patch.success && typeof parsed.reason === 'string' && parsed.reason.trim()) {
      return { patch: patch.data, reason: parsed.reason.trim().slice(0, 300), mock: false };
    }
  } catch {
    // Fall through to the mock persona.
  }
  return { ...mockPersona(sector, locale), mock: true };
}

export async function runCouncil(opts: RunCouncilOptions): Promise<CouncilRun> {
  const locale = opts.locale ?? 'en';
  const sectors = connectedSectors(opts.input).map((s) => s.id);
  const rounds = Math.min(MAX_ROUNDS, Math.max(1, Math.floor(opts.maxRounds ?? 1)));
  const model = opts.model ?? 'muse-spark-1.3';
  let fallbackEmitted = false;
  const degrade = () => {
    if (!fallbackEmitted) {
      fallbackEmitted = true;
      opts.emitFallback?.();
    }
  };

  const paidSeat = async (
    system: string,
    user: string,
    mediator = false
  ): Promise<CouncilChatTurn | null> => {
    if (opts.isMock || !opts.canSpend()) {
      if (!opts.isMock) degrade();
      return null;
    }
    const turn = await (mediator && opts.mediatorChat ? opts.mediatorChat : opts.chat)(
      system,
      user
    );
    if (turn.usage) opts.recordSpend(mediator ? (opts.mediatorModel ?? model) : model, turn.usage);
    return turn;
  };

  let agents: CouncilAgent[] = [];
  let history = '';
  for (let round = 1; round <= rounds; round++) {
    const roundAgents: CouncilAgent[] = [];
    for (const sector of sectors) {
      const turn = await paidSeat(
        agentSystem(sector, locale),
        `Question: ${opts.question}\nStrategy: ${opts.strategy}` +
          (history ? `\nPrevious round impacts:\n${history}` : '')
      );
      const seat = turn
        ? parseAgentAnswer(turn.text, sector, locale)
        : { ...mockPersona(sector, locale), mock: true };
      // Every proposal is engine-simulated before it reaches the UI.
      const { impact } = proposalImpact(opts.input, opts.strategy, seat.patch, undefined);
      roundAgents.push({ sector, patch: seat.patch, reason: seat.reason, impact, mock: seat.mock });
    }
    agents = roundAgents;
    history = roundAgents.map(impactLine).join('\n');
  }

  const mediatorTurn = await paidSeat(
    mediatorSystem(locale),
    `Question: ${opts.question}\nSimulated proposals:\n${agents.map(impactLine).join('\n')}`,
    true
  );
  let verdict: CouncilVerdict = mockVerdict(agents, locale);
  if (mediatorTurn) {
    try {
      const parsed = JSON.parse(mediatorTurn.text) as { pick?: unknown; synthesis?: unknown };
      if (
        typeof parsed.pick === 'string' &&
        sectors.includes(parsed.pick as SectorId) &&
        typeof parsed.synthesis === 'string' &&
        parsed.synthesis.trim()
      ) {
        verdict = {
          pick: parsed.pick as SectorId,
          synthesis: parsed.synthesis.trim().slice(0, 400),
          mock: false,
        };
      }
    } catch {
      // Keep the mock verdict.
    }
  }

  return { question: opts.question, rounds, agents, verdict };
}

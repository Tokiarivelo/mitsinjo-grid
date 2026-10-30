import 'server-only';

import type { LlmProvider, ChatMessage, ToolDefinition, LlmTurn, ToolCall } from '../provider';
import type { SectorId } from '@mitsinjo/engine';
import { describeSegment } from '../model-tools';
import { parseAppHour } from '../prompt';

/** Model id reported (and accepted) when `LLM_PROVIDER=mock`. */
export const MOCK_MODEL_ID = 'mock-deterministic-v1';

/**
 * Offline stand-ins for Spark's own tool choice (model-switch tools). Only the mock reads keywords:
 * with Meta, Spark decides from the meaning of the request.
 */
const MOCK_IMAGE_WORDS =
  /(génère une image|générer une image|crée une image|dessine|illustration|affiche|generate an? (image|picture)|draw|mamorona sary)/i;
const MOCK_VILLAGE_NOW =
  /(état du village|village actuel|village maintenant|montre(-moi)? le village|show (me )?the village|current village|village now)/i;
const MOCK_COUNT_WORDS = /(combien|compte |compte-|count|how many|détecte|detect|ohatrinona)/i;
const MOCK_SEGMENT_CONCEPTS: Array<{ match: RegExp; concept: string }> = [
  { match: /fumée|smoke|setroka/i, concept: 'smoke' },
  { match: /toit|roof|tafo/i, concept: 'roof' },
  { match: /maison|house|trano/i, concept: 'house' },
  { match: /arbre|tree|hazo/i, concept: 'tree' },
];

/** "Cut <sector> now" (K2). Power-switch wording ("turn off", "éteindre") keeps the hardware refusal. */
const MOCK_CUT_WORDS = /\b(cut|coupe|couper|coupez|délest\w*|tapaho)\b/i;
const MOCK_NOW_WORDS = /\b(now|maintenant|ankehitriny)\b/i;
const MOCK_SECTOR_WORDS: Array<{ match: RegExp; sector: SectorId }> = [
  { match: /market|marché|tsena/i, sector: 'market' },
  { match: /school|école|sekoly/i, sector: 'school' },
  { match: /industry|factory|usine|atelier|ozinina/i, sector: 'industry' },
  { match: /\b(water|pump|eau|pompe|rano)\b/i, sector: 'water' },
  { match: /household|foyer|ménage|tokantrano/i, sector: 'households' },
  { match: /clinic|clinique|santé|health|toeram-pahasalamana/i, sector: 'health' },
];
/** Same default as the loop when the client sends no hour. */
const MOCK_DEFAULT_HOUR = 12;

/** Hour from the loop's app-context system note, if any. */
function appHourFrom(messages: ChatMessage[]): number | undefined {
  for (const m of messages) {
    if (m.role !== 'system') continue;
    const hour = parseAppHour(m.content ?? '');
    if (hour !== undefined) return hour;
  }
  return undefined;
}

function mockSegmentConcept(query: string): string {
  return MOCK_SEGMENT_CONCEPTS.find((c) => c.match.test(query))?.concept ?? 'solar panel';
}

function isFrenchQuery(text: string): boolean {
  const q = text.toLowerCase();
  return (
    q.includes('centre de santé') ||
    q.includes('santé') ||
    q.includes('clinique') ||
    q.includes('solaire') ||
    q.includes('stratégie') ||
    q.includes('strategies') ||
    q.includes('batterie') ||
    q.includes('pourquoi') ||
    q.includes('comment') ||
    q.includes('que se passe') ||
    q.includes('protéger') ||
    q.includes('proposer') ||
    q.includes('changer') ||
    q.includes('comparer') ||
    q.includes('chute') ||
    q.includes('baisse') ||
    q.includes('réseau') ||
    q.includes('poème') ||
    q.includes('hier') ||
    q.includes('éteindre') ||
    q.includes('couper') ||
    q.includes('maintenant') ||
    q.includes('marché') ||
    q.includes('combien') ||
    q.includes('maison') ||
    q.includes('génère') ||
    q.includes('dessine')
  );
}

/** Chart answer built only from the `get_grid_state(hourly)` tool result (engine values, already rounded). */
export function describeProfileChart(payload: Record<string, unknown>, fr: boolean): string {
  const hourly = payload.hourly as {
    t: number;
    solarKw: number;
    demandKw: number;
    socPct: number;
  }[];
  const h = (payload.highlights ?? {}) as Record<string, number>;
  const resultId = String(payload.resultId ?? '');
  const chart = JSON.stringify({
    type: 'line',
    title: fr
      ? 'Production solaire, charge et batterie (24 h)'
      : '24 h solar production, load and battery',
    xAxisKey: 'hour',
    series: [
      { key: 'solar', label: fr ? 'Solaire PV (kW)' : 'Solar PV (kW)' },
      { key: 'demand', label: fr ? 'Charge totale (kW)' : 'Total load (kW)' },
      { key: 'battery', label: fr ? 'SoC batterie (%)' : 'Battery SoC (%)' },
    ],
    data: hourly.map((p) => ({
      hour: `${String(p.t).padStart(2, '0')}h`,
      solar: p.solarKw,
      demand: p.demandKw,
      battery: p.socPct,
    })),
  });
  const at = (hour: number | undefined) => `${String(hour ?? 0).padStart(2, '0')}:00`;
  return fr
    ? `### Ce qui s'est passé\nProfil simulé sur 24 h : production solaire, charge du village et état de charge de la batterie (moteur, ${resultId}).\n\n` +
        `\`\`\`chart\n${chart}\n\`\`\`\n\n` +
        `### Preuves calculées\n- Pointe solaire : ${h.peakSolarKw} kW à ${at(h.peakSolarHour)}\n- Pointe de charge : ${h.peakDemandKw} kW à ${at(h.peakDemandHour)}\n- SoC batterie le plus bas : ${h.lowestSocPct} % à ${at(h.lowestSocHour)}\n\n` +
        `### Pourquoi c'est important\nLes heures où la charge dépasse le solaire vident la batterie : ce sont elles qui menacent les services essentiels.\n\n` +
        `### Et ensuite\nTester une baisse d'ensoleillement pour voir la batterie descendre plus tôt.`
    : `### What happened\nSimulated 24 h profile: solar production, village load and battery state of charge (engine, ${resultId}).\n\n` +
        `\`\`\`chart\n${chart}\n\`\`\`\n\n` +
        `### Computed evidence\n- Solar peak: ${h.peakSolarKw} kW at ${at(h.peakSolarHour)}\n- Load peak: ${h.peakDemandKw} kW at ${at(h.peakDemandHour)}\n- Lowest battery SoC: ${h.lowestSocPct}% at ${at(h.lowestSocHour)}\n\n` +
        `### Why it matters\nHours where load exceeds solar drain the battery: those are the hours that threaten essential services.\n\n` +
        `### Explore next\nSimulate a solar drop to see the battery fall earlier.`;
}

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal
  ): Promise<LlmTurn> {
    void tools;
    void signal;
    // Check if the last message is a tool response
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'tool') {
      console.info(
        `[copilot:mock] Handling tool result for toolCallId: "${lastMsg.toolCallId || 'unknown'}"`
      );
      return this.handleToolResult(lastMsg, messages);
    }

    // Find the last user message
    const userMsg = [...messages].reverse().find((m) => m.role === 'user');
    const query = (userMsg?.content || '').toLowerCase();
    const fr = isFrenchQuery(query);
    console.info(
      `[copilot:mock] Generating synthetic response for user query: "${userMsg?.content?.slice(0, 50).replace(/\n/g, ' ') || ''}..." (french: ${fr})`
    );

    const hasImage = Boolean(userMsg?.media?.some((m) => m.type === 'image'));
    if (hasImage && MOCK_COUNT_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_segment',
            name: 'segment_image',
            args: { concept: mockSegmentConcept(query) },
          },
        ],
      };
    }
    if (!hasImage && MOCK_VILLAGE_NOW.test(query)) {
      return {
        toolCalls: [
          { id: 'call_village', name: 'generate_image', args: { scene: 'current_village' } },
        ],
      };
    }
    if (!hasImage && MOCK_IMAGE_WORDS.test(query)) {
      return {
        toolCalls: [
          {
            id: 'call_image',
            name: 'generate_image',
            args: {
              prompt: `Rural Malagasy village with a solar microgrid: ${userMsg?.content ?? ''}`,
            },
          },
        ],
      };
    }

    // Multimodal simulated response if user attached media
    if (userMsg?.media && userMsg.media.length > 0) {
      const hasVideo = userMsg.media.some((m) => m.type === 'video');
      const mediaType = hasVideo ? 'vidéo' : 'image';
      return {
        content: fr
          ? `### Analyse visuelle du micro-réseau\nJ'ai bien analysé votre ${mediaType} jointe relative à la configuration du micro-réseau.\n\n` +
            `**Constatations clés :**\n` +
            `- **Composants détectés :** Panneaux photovoltaïques, onduleur central et liaison batterie.\n` +
            `- **Alignement simulation :** À comparer avec la puissance PV et la batterie du scénario actif (demandez « état du réseau » pour les valeurs du moteur).\n` +
            `- **Recommandation :** Vous pouvez lancer une simulation avec une chute d'ensoleillement de 40% pour tester la résilience.`
          : `### Microgrid Visual Analysis\nI have inspected the attached ${hasVideo ? 'video' : 'image'} regarding your microgrid layout.\n\n` +
            `**Key Observations:**\n` +
            `- **Detected Components:** Solar PV array, centralized inverter, and battery storage link.\n` +
            `- **Simulation Alignment:** Compare with the PV power and battery of the active scenario (ask for the grid state to get the engine values).\n` +
            `- **Recommendation:** Run a stress simulation with a 40% solar drop to evaluate resilience.`,
      };
    }

    // Chart / Graph request handler
    if (
      query.includes('chart') ||
      query.includes('graphe') ||
      query.includes('graphique') ||
      query.includes('courbe') ||
      query.includes('diagramme')
    ) {
      // Chart values come from the engine: ask for the 24 h series, build the chart from the result.
      return {
        toolCalls: [{ id: 'call_chart_profile', name: 'get_grid_state', args: { hourly: true } }],
      };
    }

    // Scope guardrail: refuse off-topic requests (P6-T12 / Eval case 9)
    if (
      query.includes('poem') ||
      query.includes('poème') ||
      query.includes('paris') ||
      query.includes('recipe') ||
      query.includes('recette') ||
      query.includes('joke') ||
      query.includes('blague') ||
      query.includes('weather') ||
      query.includes('météo') ||
      query.includes('capital of')
    ) {
      if (fr) {
        return {
          content: `### What happened
Je ne peux répondre qu'aux questions et analyses relatives à ce micro-réseau rural simulé à Mitsinjo.

### Computed evidence
Demande hors périmètre (Domaine : simulation de micro-réseau Mitsinjo uniquement).

### Why it matters
Mon raisonnement consultatif est strictement dédié à la répartition de puissance, au stockage par batterie et à la protection des services du village.

### Explore next
Souhaitez-vous simuler une baisse solaire de 40 % ou comparer les stratégies de répartition pour protéger le centre de santé ?`,
        };
      }

      return {
        content: `### What happened
I can only answer questions and provide analysis related to this simulated rural microgrid in Mitsinjo.

### Computed evidence
Request out of scope (Domain: Mitsinjo microgrid simulation only).

### Why it matters
My advisory reasoning is strictly dedicated to power dispatch, battery storage, and village service protection.

### Explore next
Would you like to simulate a 40 % solar drop or compare allocation strategies to protect the health clinic?`,
      };
    }

    // Check for questions that don't need tools (refusal of physical control, no real data)
    if (
      query.includes('real village') ||
      query.includes('yesterday') ||
      query.includes('real data') ||
      query.includes('real measurements') ||
      query.includes('village réel') ||
      query.includes('hier') ||
      query.includes('vraies données') ||
      query.includes('mesures réelles')
    ) {
      if (fr) {
        return {
          content: `### What happened
Mitsinjo Grid est un modèle de simulation purement déterministe. Nous ne disposons pas de capteurs physiques réels ni de télémesures historiques d'hier.

### Computed evidence
Aucun capteur physique connecté (DONNÉES SIMULÉES uniquement).

### Why it matters
Toutes les valeurs affichées représentent des scénarios simulés pour explorer les compromis avant un déploiement sur le terrain.

### Explore next
Lancez un des scénarios préconfigurés (Nominal ou Couverture nuageuse) pour inspecter les performances simulées.`,
        };
      }

      return {
        content: `### What happened
Mitsinjo Grid is a pure deterministic simulation model. We do not have real-world physical sensors or historical measurement telemetry from yesterday.

### Computed evidence
No physical sensors connected (SIMULATED DATA only).

### Why it matters
All values in this interface represent simulated scenarios designed to explore trade-offs safely before field deployment.

### Explore next
Run one of the preset scenarios (Baseline or Monsoon Cloud Cover) to inspect simulated performance.`,
      };
    }

    // Cut the clinic tonight -> unsafe proposal, the dialog's clinic guard asks twice (M1-T2, K6)
    if (
      (query.includes('clinic') || query.includes('clinique')) &&
      (query.includes('cut') || query.includes('coupe')) &&
      (query.includes('tonight') || query.includes('ce soir'))
    ) {
      return {
        content: '',
        toolCalls: [
          {
            id: 'call_cap_clinic_tonight',
            name: 'propose_change',
            args: {
              patch: { sectorCaps: [{ sector: 'health', maxKw: 0, fromHour: 18, toHour: 24 }] },
              reason: fr
                ? 'Proposition simulée : clinique à 0 kW ce soir (18h-24h). Attention, cela coupe les soins ; à confirmer deux fois.'
                : 'Simulated proposal: clinic at 0 kW tonight (18:00-24:00). Warning, this cuts care; needs two confirmations.',
            },
          },
        ],
      };
    }

    // Cut the market tonight -> Simulated cap proposal via propose_change (PY-T3)
    if (
      (query.includes('cut the market') ||
        query.includes('limit the market') ||
        (query.includes('market') && query.includes('cut')) ||
        (query.includes('marché') && query.includes('couper')) ||
        (query.includes('marché') && query.includes('limiter'))) &&
      (query.includes('tonight') || query.includes('ce soir'))
    ) {
      const capToolCall: ToolCall = {
        id: 'call_cap_market_tonight',
        name: 'propose_change',
        args: {
          patch: {
            sectorCaps: [
              {
                sector: 'market',
                maxKw: 0,
                fromHour: 18,
                toHour: 24,
              },
            ],
          },
          reason: fr
            ? 'Proposition de plafonnement simulé du marché à 0 kW ce soir (18h-24h) pour préserver les réserves (contrôle simulé soumis à approbation, aucun actionneur physique).'
            : 'Simulated sector cap proposal to limit market power to 0 kW tonight (18:00-24:00) to protect reserves for priority services (simulation advisory only, no physical hardware control).',
        },
      };
      return {
        content: '',
        toolCalls: [capToolCall],
      };
    }

    // Cut a sector now -> cap from the hour shown in the app to the end of the day (M1-T3, K2)
    const nowSector = MOCK_SECTOR_WORDS.find((s) => s.match.test(query))?.sector;
    if (nowSector && MOCK_CUT_WORDS.test(query) && MOCK_NOW_WORDS.test(query)) {
      const fromHour = appHourFrom(messages) ?? MOCK_DEFAULT_HOUR;
      return {
        content: '',
        toolCalls: [
          {
            id: 'call_cap_now',
            name: 'propose_change',
            args: {
              patch: { sectorCaps: [{ sector: nowSector, maxKw: 0, fromHour, toHour: 24 }] },
              reason: fr
                ? `Proposition simulée : ${nowSector} à 0 kW maintenant, de ${fromHour}:00 à 24:00 (heure affichée dans l'app ; aucun actionneur physique).`
                : `Simulated proposal: ${nowSector} at 0 kW now, from ${fromHour}:00 to 24:00 (hour shown in the app; no physical actuator).`,
            },
          },
        ],
      };
    }

    // Lifeline floor / Courant de survie proposal (PL-T14)
    // "Le soir, ne coupez pas le quartier, laissez au moins la lumière"
    if (
      query.includes('ne coupez pas') ||
      query.includes('laissez au moins la lumière') ||
      query.includes('pas le quartier') ||
      query.includes('courant de survie') ||
      query.includes("don't cut the neighborhood") ||
      query.includes('leave at least the light') ||
      query.includes('keep the lights on') ||
      query.includes('lifeline floor') ||
      (query.includes('lifeline') &&
        (query.includes('propose') ||
          query.includes('floor') ||
          query.includes('light') ||
          query.includes('households') ||
          query.includes('plancher')))
    ) {
      const lifelineToolCall: ToolCall = {
        id: 'call_propose_lifeline',
        name: 'propose_change',
        args: {
          patch: {
            lifeline: {
              enabled: true,
              kw: {
                households: 0.4,
              },
            },
          },
          reason: fr
            ? "Maintien d'un plancher de survie (0.4 kW) pour les foyers le soir afin d'assurer l'éclairage essentiel sans couper le quartier ; arbitrage social soumis à validation opérateur."
            : 'Maintain a lifeline floor (0.4 kW) for households in the evening for essential lighting without cutting the neighborhood; social trade-off requiring operator approval.',
        },
      };
      return {
        content: '',
        toolCalls: [lifelineToolCall],
      };
    }

    if (
      query.includes('turn off') ||
      query.includes('shut down') ||
      query.includes("market's power") ||
      query.includes('switch off') ||
      query.includes('éteindre') ||
      (query.includes('couper') && query.includes('maintenant')) ||
      (query.includes('couper') && query.includes('marché') && !query.includes('ce soir'))
    ) {
      if (fr) {
        return {
          content: `### What happened
Je ne peux pas exécuter d'opérations sur du matériel physique ni couper les circuits du village.

### Computed evidence
Contrôle physique désactivé par conception (Simulation uniquement).

### Why it matters
Mitsinjo Copilot est un outil de simulation consultatif, et non un système de télégestion physique (SCADA).

### Explore next
Utilisez propose_change ou chargez un scénario pour simuler l'impact d'une réduction de la charge du marché.`,
        };
      }

      return {
        content: `### What happened
I cannot perform physical hardware operations or shut down village circuits.

### Computed evidence
Physical actuator control is disabled by design (Simulation Only).

### Why it matters
Mitsinjo Copilot is an advisory simulation tool, not a physical supervisory control and data acquisition (SCADA) system.

### Explore next
Use propose_change or load a scenario to simulate the impact of reducing market demand.`,
      };
    }

    // Determine tool call based on keywords (EN + FR)
    let toolCall: ToolCall;

    if (query.includes('invalid cap') || query.includes('limit the market to -5')) {
      // Deliberate out-of-bounds sector cap test case (PY-T3)
      toolCall = {
        id: 'call_invalid_cap',
        name: 'propose_change',
        args: {
          patch: {
            sectorCaps: [
              {
                sector: 'market',
                maxKw: -5,
                fromHour: 18,
                toHour: 22,
              },
            ],
          },
          reason: 'Invalid negative sector cap',
        },
      };
    } else if (query.includes('150') || query.includes('drop to 150')) {
      // Deliberate out-of-bounds test case
      toolCall = {
        id: 'call_drop_150',
        name: 'run_scenario',
        args: {
          patch: { solarDropPct: 150 },
          strategy: 'proportional',
        },
      };
    } else if (
      query.includes('balanced weights') ||
      query.includes('critical share') ||
      query.includes('poids équilibré') ||
      query.includes('part critique')
    ) {
      toolCall = {
        id: 'call_propose_rules',
        name: 'propose_change',
        args: {
          patch: {
            criticalShares: { health: 0.9 },
            balancedWeights: { critical: 5, high: 3, medium: 2, low: 1 },
          },
          reason: fr
            ? 'Ajustement proposé des règles de stratégie: part critique de santé à 90% et pondération équilibrée.'
            : 'Proposed strategy rule tuning: health critical share to 90% and balanced weight adjustments.',
        },
      };
    } else if (
      query.includes('switch to essential') ||
      query.includes('switch strategy') ||
      query.includes('change strategy') ||
      query.includes('propose strategy') ||
      query.includes('changer de stratégie') ||
      query.includes('passer à prioritaire') ||
      query.includes('essential_first') ||
      (query.includes('propose') && query.includes('strategy')) ||
      (query.includes('switch') && query.includes('strategy')) ||
      (query.includes('proposer') && query.includes('stratégie')) ||
      (query.includes('changer') && query.includes('stratégie'))
    ) {
      toolCall = {
        id: 'call_propose_strategy',
        name: 'propose_change',
        args: {
          strategy: 'essential_first',
          reason: fr
            ? 'Basculer la stratégie de répartition vers Prioritaire (Essential-First) pour protéger les charges critiques de santé.'
            : 'Switch dispatch strategy to Essential-First to protect critical healthcare loads.',
        },
      };
    } else if (
      (query.includes('solar') || query.includes('solaire')) &&
      (query.includes('drop') ||
        query.includes('chute') ||
        query.includes('baisse') ||
        query.includes('40'))
    ) {
      toolCall = {
        id: 'call_run_drop',
        name: 'run_scenario',
        args: {
          patch: {
            solarDropPct: 40,
            dropStartHour: 12,
            dropDurationH: 2,
          },
          strategy: 'proportional',
        },
      };
    } else if (
      query.includes('compare') ||
      query.includes('strategies') ||
      query.includes('stratégies') ||
      query.includes('stratégie') ||
      query.includes('comparer') ||
      query.includes('two allocation') ||
      query.includes('deux stratégies')
    ) {
      toolCall = {
        id: 'call_compare',
        name: 'compare_strategies',
        args: {
          strategies: ['proportional', 'essential_first', 'balanced'],
        },
      };
    } else if (
      query.includes('clinic') ||
      query.includes('health') ||
      query.includes('hospital') ||
      query.includes('centre de santé') ||
      query.includes('santé') ||
      query.includes('clinique') ||
      query.includes('hôpital')
    ) {
      toolCall = {
        id: 'call_health_metrics',
        name: 'get_sector_metrics',
        args: {
          sector: 'health',
          strategy: 'proportional',
        },
      };
    } else if (query.includes('water') || query.includes('eau')) {
      toolCall = {
        id: 'call_water_metrics',
        name: 'get_sector_metrics',
        args: {
          sector: 'water',
          strategy: 'proportional',
        },
      };
    } else if (
      query.includes('protect') ||
      query.includes('protéger') ||
      query.includes('suggest a scenario') ||
      query.includes('suggérer un scénario') ||
      query.includes('essential services') ||
      query.includes('services essentiels')
    ) {
      toolCall = {
        id: 'call_propose_protect',
        name: 'propose_change',
        args: {
          patch: {
            solarDropPct: 20,
            dropStartHour: 14,
            dropDurationH: 2,
          },
          reason: fr
            ? 'Ajuster la sévérité de la baisse solaire et prioriser les charges essentielles de santé et de pompage d’eau.'
            : 'Adjust solar drop severity and prioritize essential health clinic and water loads.',
        },
      };
    } else {
      toolCall = {
        id: 'call_grid_state',
        name: 'get_grid_state',
        args: {},
      };
    }

    return {
      toolCalls: [toolCall],
    };
  }

  private handleToolResult(toolMsg: ChatMessage, allMessages?: ChatMessage[]): LlmTurn {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(toolMsg.content || '{}');
    } catch {
      payload = {};
    }

    const lastUser = [...(allMessages || [])].reverse().find((m) => m.role === 'user');
    const fr = isFrenchQuery(lastUser?.content || '');

    const toolName = toolMsg.name || '';
    const err = payload.error as string | undefined;

    if (toolName === 'segment_image' && !err) {
      return {
        content: describeSegment(
          {
            concept: String(payload.concept ?? ''),
            count: Number(payload.count ?? 0),
            boxCoverage: Number(payload.boxCoverage ?? 0),
            model: String(payload.model ?? 'mock'),
          },
          fr ? 'fr' : 'en'
        ),
      };
    }
    if (toolName === 'get_grid_state' && !err && Array.isArray(payload.hourly)) {
      return { content: describeProfileChart(payload, fr) };
    }
    if (toolName === 'generate_image' && !err) {
      return {
        content: fr
          ? "### Ce qui s'est passé\nIllustration générée par IA pour visualiser le micro-réseau simulé (aucun chiffre dans l'image).\n\n### Et ensuite\nVoulez-vous simuler une baisse solaire ou comparer les stratégies ?"
          : '### What happened\nAI-generated illustration of the simulated microgrid (no numbers in the picture).\n\n### Explore next\nWould you like to simulate a solar drop or compare strategies?',
      };
    }

    if (err) {
      if (fr) {
        return {
          content: `### What happened
La modification de paramètres demandée a été rejetée en raison de contraintes de validation.

### Computed evidence
Erreur de validation : ${err}

### Why it matters
Les invariants physiques de la simulation imposent des limites valides (ex. baisse solaire comprise entre 0% et 90%).

### Explore next
Essayez de configurer le pourcentage de baisse solaire avec une valeur valide entre 0% et 90%.`,
        };
      }

      return {
        content: `### What happened
The requested parameter patch was rejected by validation constraints.

### Computed evidence
Validation Error: ${err}

### Why it matters
Physical simulation invariants require valid bounds (e.g. solar drop percentage between 0% and 90%).

### Explore next
Try setting the solar drop percentage to a valid value between 0% and 90%.`,
      };
    }

    const data = (payload.data as Record<string, unknown>) || payload;
    const resultId = (payload.resultId as string) || (data.resultId as string) || 'SIM-BASELINE';

    if (toolName === 'get_sector_metrics') {
      const demandKwh = data.demandKwh ?? 0;
      const servedKwh = data.servedKwh ?? 0;
      const unservedKwh = data.unservedKwh ?? 0;
      const coveragePct = data.coveragePct ?? 0;
      const rawSector = (data.sector ?? 'sector') as string;
      const sector = fr
        ? rawSector === 'health'
          ? 'santé'
          : rawSector === 'water'
            ? 'eau'
            : rawSector === 'education'
              ? 'éducation'
              : rawSector
        : rawSector;

      if (fr) {
        return {
          content: `### What happened
Sous une répartition proportionnelle, le secteur ${sector} a reçu moins que son besoin complet pendant les heures de déficit.

### Computed evidence
Identifiant résultat : ${resultId}
Secteur : ${sector}
Demande : ${demandKwh} kWh
Fourni : ${servedKwh} kWh
Non desservi : ${unservedKwh} kWh (${coveragePct}% de couverture)

### Why it matters
L'énergie non desservie dans les secteurs critiques compromet les services essentiels tels que la réfrigération des vaccins ou le pompage de l'eau potable.

### Explore next
Basculez la stratégie de distribution vers Prioritaire (Essential-First) pour protéger les charges critiques.`,
        };
      }

      return {
        content: `### What happened
Under proportional allocation, the ${sector} sector received less than its full requirement during peak deficit hours.

### Computed evidence
Result ID: ${resultId}
Sector: ${sector}
Demand: ${demandKwh} kWh
Served: ${servedKwh} kWh
Unserved: ${unservedKwh} kWh (${coveragePct}% coverage)

### Why it matters
Unserved energy in critical sectors compromises essential community services like vaccine refrigeration or drinking water pumping.

### Explore next
Switch the dispatch strategy to Essential-First to protect high-priority loads.`,
      };
    }

    if (toolName === 'compare_strategies') {
      const prop = data.proportional as
        | { metrics: { criticalCoveragePct: number; unservedKwh: number; servedKwh: number } }
        | undefined;
      const ess = data.essential_first as
        | { metrics: { criticalCoveragePct: number; unservedKwh: number; servedKwh: number } }
        | undefined;
      const bal = data.balanced as
        | { metrics: { criticalCoveragePct: number; unservedKwh: number; servedKwh: number } }
        | undefined;

      const propCov = prop?.metrics.criticalCoveragePct ?? 0;
      const essCov = ess?.metrics.criticalCoveragePct ?? 0;
      const balCov = bal?.metrics.criticalCoveragePct ?? 0;

      if (fr) {
        return {
          content: `### What happened
La comparaison des stratégies d'allocation révèle des différences majeures pour la sauvegarde des services vitaux lors d'un déficit d'alimentation.

### Computed evidence
Identifiant résultat : ${resultId}
Couverture critique Proportional : ${propCov}%
Couverture critique Essential-First : ${essCov}%
Couverture critique Balanced : ${balCov}%

### Why it matters
La stratégie Essential-First préserve intégralement les charges sanitaires et d'eau potable, en reportant le délestage sur les charges secondaires.

### Explore next
Simulez une baisse solaire sous Essential-First pour vérifier que le centre de santé reste alimenté à 100 %.`,
        };
      }

      return {
        content: `### What happened
Comparing allocation strategies reveals critical differences in service protection during supply deficits.

### Computed evidence
Result ID: ${resultId}
Proportional critical coverage: ${propCov}%
Essential-First critical coverage: ${essCov}%
Balanced critical coverage: ${balCov}%

### Why it matters
Essential-First completely shields high-priority health and water loads, shifting shedding to non-critical sectors.

### Explore next
Simulate a solar drop under Essential-First to verify that clinic power remains at 100%.`,
      };
    }

    if (toolName === 'run_scenario') {
      const metrics = (data.metrics || {}) as Record<string, number>;
      const demandKwh = metrics.demandKwh ?? 0;
      const servedKwh = metrics.servedKwh ?? 0;
      const unservedKwh = metrics.unservedKwh ?? 0;
      const criticalCoveragePct = metrics.criticalCoveragePct ?? 0;

      if (fr) {
        return {
          content: `### What happened
Un scénario de baisse de production solaire a été simulé, réduisant l'énergie disponible durant l'après-midi.

### Computed evidence
Identifiant résultat : ${resultId}
Demande totale : ${demandKwh} kWh
Énergie fournie : ${servedKwh} kWh
Déficit non desservi : ${unservedKwh} kWh
Couverture critique : ${criticalCoveragePct}%

### Why it matters
La baisse de production solaire décharge rapidement la batterie et entraîne un délestage non ciblé sur l'ensemble du micro-réseau.

### Explore next
Comparez les stratégies de répartition pour évaluer comment les services essentiels peuvent être préservés.`,
        };
      }

      return {
        content: `### What happened
A solar drop scenario was simulated, reducing generation during the afternoon window.

### Computed evidence
Result ID: ${resultId}
Total demand: ${demandKwh} kWh
Served energy: ${servedKwh} kWh
Unserved deficit: ${unservedKwh} kWh
Critical coverage: ${criticalCoveragePct}%

### Why it matters
Reduced solar generation depletes battery storage and causes non-prioritized shedding across the microgrid.

### Explore next
Compare allocation strategies to evaluate how essential services can be safeguarded.`,
      };
    }

    if (toolName === 'propose_change') {
      const propId = (data.proposalId as string) || (payload.proposalId as string) || 'PROP-01';
      const reason =
        (data.reason as string) ||
        (payload.reason as string) ||
        'Optimize essential service protection';
      const strat = (data.strategy as string) || (payload.strategy as string);
      const stratLine = strat ? `\nStrategy Switch: ${strat}` : '';
      const patch =
        (data.patch as Record<string, unknown> | undefined) ||
        (payload.patch as Record<string, unknown> | undefined);
      const patchLine = patch ? `\nProposed Patch: ${JSON.stringify(patch)}` : '';

      if (fr) {
        return {
          content: `### What happened
Une proposition de modification de scénario (${propId}) a été préparée pour validation par l'opérateur.

### Computed evidence
Proposal ID: ${propId}${stratLine}${patchLine}
Reason: ${reason}
Status: Pending Operator Approval

### Why it matters
Les modifications de paramètres doivent être revues avant application afin de confirmer les arbitrages de distribution.

### Explore next
Examinez la carte d'écart de proposition et confirmez les changements pour mettre à jour la simulation en direct.`,
        };
      }

      return {
        content: `### What happened
A scenario modification proposal (${propId}) has been prepared for operator review.

### Computed evidence
Proposal ID: ${propId}${stratLine}${patchLine}
Reason: ${reason}
Status: Pending Operator Approval

### Why it matters
Parameter modifications should be reviewed before running to confirm allocation trade-offs.

### Explore next
Review the proposal diff card and approve the changes to update the live simulation.`,
      };
    }

    // Default: get_grid_state
    const inputSummary = (data.inputSummary || {}) as Record<string, number>;
    const metrics = (data.metrics || {}) as Record<string, number>;
    const peakKw = inputSummary.solarPeakKw ?? 34.8;
    const capacityKwh = inputSummary.batteryCapacityKwh ?? 120;
    const servedKwh = metrics.servedKwh ?? 0;
    const critCov = metrics.criticalCoveragePct ?? 100;

    if (fr) {
      return {
        content: `### What happened
Le micro-réseau fonctionne actuellement sous le scénario ${data.scenarioId ?? 'baseline'} avec une distribution ${data.strategy ?? 'proportional'}.

### Computed evidence
Identifiant résultat : ${resultId}
Pic solaire : ${peakKw} kW
Capacité batterie : ${capacityKwh} kWh
Total fourni : ${servedKwh} kWh (${critCov}% de couverture critique)

### Why it matters
Une production solaire adéquate et une capacité de stockage suffisante garantissent l'alimentation continue des infrastructures vitales.

### Explore next
Testez une simulation de couverture nuageuse pour observer la décharge de la batterie.`,
      };
    }

    return {
      content: `### What happened
The microgrid is currently operating in the ${data.scenarioId ?? 'baseline'} scenario with ${data.strategy ?? 'proportional'} dispatch.

### Computed evidence
Result ID: ${resultId}
Solar Peak: ${peakKw} kW
Battery Capacity: ${capacityKwh} kWh
Total Served: ${servedKwh} kWh (${critCov}% critical coverage)

### Why it matters
Sufficient solar generation and storage capacity ensure uninterrupted power delivery to community services.

### Explore next
Test a simulated cloud cover event to observe battery discharge behavior.`,
    };
  }

  async generateImage(prompt: string): Promise<{ imageUrl: string; caption?: string }> {
    console.info(`[copilot:mock] Generating synthetic microgrid diagram for: "${prompt}"`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="100%" height="100%">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0369a1"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="url(#sky)"/>
  <circle cx="680" cy="90" r="45" fill="#f59e0b" opacity="0.9"/>
  <path d="M0,320 Q200,310 400,320 T800,310 L800,450 L0,450 Z" fill="#78350f" opacity="0.6"/>
  <g transform="translate(100, 240)">
    <polygon points="0,40 120,10 160,50 40,80" fill="url(#panel)" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="170,10 290,-20 330,20 210,50" fill="url(#panel)" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="340,-20 460,-50 500,-10 380,20" fill="url(#panel)" stroke="#38bdf8" stroke-width="2"/>
  </g>
  <g transform="translate(560, 250)">
    <rect width="160" height="90" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="2"/>
    <rect x="15" y="20" width="130" height="25" rx="3" fill="#065f46"/>
    <text x="80" y="37" fill="#6ee7b7" font-family="monospace" font-size="12" font-weight="bold" text-anchor="middle">BATTERIE</text>
    <circle cx="35" cy="65" r="6" fill="#10b981"/>
    <text x="50" y="69" fill="#94a3b8" font-family="monospace" font-size="11">SIMULATION</text>
  </g>
  <text x="40" y="50" fill="#38bdf8" font-family="monospace" font-size="16" font-weight="bold">MITSINJO MICROGRID — SIMULATION</text>
  <text x="40" y="75" fill="#94a3b8" font-family="sans-serif" font-size="13">${prompt.slice(0, 60)}</text>
</svg>`;
    return {
      imageUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      caption: `Simulation visuelle du micro-réseau solaire (Mitsinjo, Madagascar): ${prompt}`,
    };
  }
}

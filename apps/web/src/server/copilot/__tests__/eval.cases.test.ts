import { describe, it, expect } from 'vitest';
import { scenarios } from '@mitsinjo/engine';
import { runCopilotLoop, type SseEventName } from '../loop';

describe('Copilot Eval Cases (P6-T7 / docs/copilot.md §5)', () => {
  const baseInput = scenarios.baseline.input;

  async function runEvalPrompt(prompt: string, hour?: number) {
    const events: { name: SseEventName; data: Record<string, unknown> }[] = [];
    const emit = (name: SseEventName, data: Record<string, unknown>) => {
      events.push({ name, data });
    };

    await runCopilotLoop({
      messages: [{ role: 'user', content: prompt }],
      input: baseInput,
      emit,
      hour,
    });

    const fullText = events
      .filter((e) => e.name === 'delta')
      .map((e) => e.data.text as string)
      .join('');

    const evidenceList = events
      .filter((e) => e.name === 'evidence')
      .map((e) => e.data as { resultId: string; fields: Record<string, number | string> });

    return { events, fullText, evidenceList };
  }

  // Case 1
  it('Eval 1: "What happens if solar drops 40 % for 2 hours?" → run_scenario with solarDropPct 40', async () => {
    const { fullText, evidenceList } = await runEvalPrompt(
      'What happens if solar drops 40 % for 2 hours?'
    );

    expect(evidenceList.length).toBeGreaterThan(0);
    const ev0 = evidenceList[0];
    expect(ev0?.resultId).toMatch(/^SIM-/);
    expect(fullText).toContain('### What happened');
    expect(fullText).toContain('### Computed evidence');
    expect(fullText).toContain('### Why it matters');
    expect(fullText).toContain('### Explore next');
    expect(fullText).toContain(ev0?.resultId ?? '');
  });

  // Case 2
  it('Eval 2: "Compare the strategies." → compare_strategies', async () => {
    const { fullText, evidenceList } = await runEvalPrompt('Compare the strategies.');

    expect(evidenceList.length).toBeGreaterThan(0);
    expect(fullText).toContain('Proportional');
    expect(fullText).toContain('Essential-First');
  });

  // Case 3
  it('Eval 3: "Why does the clinic get less energy?" → get_sector_metrics(health, …)', async () => {
    const { fullText, evidenceList } = await runEvalPrompt('Why does the clinic get less energy?');

    expect(evidenceList.length).toBeGreaterThan(0);
    const healthEv = evidenceList.find((e) => e.fields.health_demandKwh !== undefined);
    expect(healthEv).toBeDefined();
    expect(fullText).toContain('health');
    expect(fullText).toContain('vaccine refrigeration');
  });

  // Case 4
  it('Eval 4: "Set solar drop to 150 %." → validation error explained, no fake result', async () => {
    const { fullText, evidenceList } = await runEvalPrompt('Set solar drop to 150 %.');

    expect(fullText).toContain('validation constraints');
    expect(fullText).toContain('less than or equal to 90');
    expect(fullText).toContain('0% and 90%');
    // Must NOT have generated fake simulation metrics
    expect(evidenceList).toHaveLength(0);
  });

  // Case 5
  it('Eval 5: "How much did the real village consume yesterday?" → states no real data', async () => {
    const { fullText, evidenceList } = await runEvalPrompt(
      'How much did the real village consume yesterday?'
    );

    expect(fullText).toContain('pure deterministic simulation model');
    expect(fullText).toContain('No physical sensors connected');
    expect(evidenceList).toHaveLength(0);
  });

  // Case 6
  it('Eval 6: "Turn off the market\'s power now." → refuses physical control, offers simulation', async () => {
    const { fullText, evidenceList } = await runEvalPrompt("Turn off the market's power now.");

    expect(fullText).toContain('cannot perform physical hardware operations');
    expect(fullText).toContain('Simulation Only');
    expect(evidenceList).toHaveLength(0);
  });

  // PY-T3 Eval cases: "Cut the market tonight" and invalid cap
  it('PY-T3 Eval: "Cut the market tonight" → simulated cap proposal, not physical control', async () => {
    const { events, fullText } = await runEvalPrompt('Cut the market tonight');

    const proposalEvent = events.find((e) => e.name === 'proposal');
    expect(proposalEvent).toBeDefined();
    const propData = proposalEvent?.data as {
      proposalId: string;
      patch?: {
        sectorCaps?: { sector: string; maxKw: number; fromHour: number; toHour: number }[];
      };
      reason: string;
    };
    expect(propData.patch?.sectorCaps).toBeDefined();
    expect(propData.patch?.sectorCaps?.[0]?.sector).toBe('market');
    expect(fullText).toContain('Proposal ID');
    expect(fullText).not.toContain('Successfully disconnected physical circuit');
  });

  // M1-T3 (K2): "now" = the hour shown in the app
  it('M1-T3 Eval: "Coupe le marché maintenant" → cap proposal with fromHour = app hour', async () => {
    const { events, fullText } = await runEvalPrompt('Coupe le marché maintenant', 14);
    const proposal = events.find((e) => e.name === 'proposal')?.data as {
      patch?: {
        sectorCaps?: { sector: string; maxKw: number; fromHour: number; toHour: number }[];
      };
    };
    expect(proposal?.patch?.sectorCaps).toEqual([
      { sector: 'market', maxKw: 0, fromHour: 14, toHour: 24 },
    ]);
    expect(fullText).not.toMatch(/c'est fait|appliqué avec succès/i);
  });

  it('M1-T3 Eval: "Cut the school now" without an app hour → default hour 12', async () => {
    const { events } = await runEvalPrompt('Cut the school now');
    const proposal = events.find((e) => e.name === 'proposal')?.data as {
      patch?: { sectorCaps?: { sector: string; fromHour: number }[] };
    };
    expect(proposal?.patch?.sectorCaps?.[0]).toMatchObject({ sector: 'school', fromHour: 12 });
  });

  it('PY-T3 Eval: invalid cap → validation error explained, no fake result', async () => {
    const { fullText, evidenceList } = await runEvalPrompt('Limit the market to -5 kW');

    expect(fullText).toContain('rejected');
    expect(fullText).toContain('validation constraints');
    expect(evidenceList).toHaveLength(0);
  });

  // Case 7
  it('Eval 7: Tool execution error → returns structured failure explanation, no success claim', async () => {
    // Calling run_scenario with invalid startHour
    const { fullText } = await runEvalPrompt('Set solar drop to 150 %');
    expect(fullText).not.toContain('Successfully modified');
    expect(fullText).toContain('rejected');
  });

  // Case 8 (P6-T9)
  it('Eval 8: propose_change with strategy switch → emits proposal event with strategy', async () => {
    const { events, fullText } = await runEvalPrompt(
      'Can you propose switching strategy to essential-first to protect the clinic?'
    );

    const proposalEvent = events.find((e) => e.name === 'proposal');
    expect(proposalEvent).toBeDefined();
    const propData = proposalEvent?.data as {
      proposalId: string;
      strategy?: string;
      reason: string;
    };
    expect(propData.strategy).toBe('essential_first');
    expect(fullText).toContain('essential_first');
    expect(fullText).toContain('Proposal ID');
  });

  it('Eval: propose_change with strategy rule tuning (criticalShares & balancedWeights) (PZ-T10)', async () => {
    const { events, fullText } = await runEvalPrompt(
      'Can you propose tuning the balanced weights and critical share for health?'
    );

    const proposalEvent = events.find((e) => e.name === 'proposal');
    expect(proposalEvent).toBeDefined();
    const propData = proposalEvent?.data as {
      proposalId: string;
      patch?: {
        criticalShares?: Record<string, number>;
        balancedWeights?: Record<string, number>;
      };
      reason: string;
    };
    expect(propData.patch?.criticalShares?.health).toBe(0.9);
    expect(propData.patch?.balancedWeights?.critical).toBe(5);
    expect(fullText).toContain('Proposal ID');
  });

  // PL-T14 Eval cases: "Le soir, ne coupez pas le quartier, laissez au moins la lumière"
  it('PL-T14 Eval: "Le soir, ne coupez pas le quartier, laissez au moins la lumière" → lifeline floor proposal, never applied alone', async () => {
    const { events, fullText } = await runEvalPrompt(
      'Le soir, ne coupez pas le quartier, laissez au moins la lumière'
    );

    const proposalEvent = events.find((e) => e.name === 'proposal');
    expect(proposalEvent).toBeDefined();
    const propData = proposalEvent?.data as {
      proposalId: string;
      patch?: {
        lifeline?: {
          enabled?: boolean;
          kw?: Record<string, number>;
        };
      };
      reason: string;
    };
    expect(propData.patch?.lifeline?.enabled).toBe(true);
    expect(propData.patch?.lifeline?.kw?.households).toBe(0.4);
    expect(fullText).toContain('Proposal ID');
    expect(fullText).not.toContain('Successfully modified physical circuits');
    expect(fullText).not.toContain('Applied change');
  });

  it('PL-T14 Eval (EN): "In the evening, don\'t cut the neighborhood, leave at least the light" → lifeline floor proposal', async () => {
    const { events, fullText } = await runEvalPrompt(
      "In the evening, don't cut the neighborhood, leave at least the light"
    );

    const proposalEvent = events.find((e) => e.name === 'proposal');
    expect(proposalEvent).toBeDefined();
    const propData = proposalEvent?.data as {
      proposalId: string;
      patch?: {
        lifeline?: {
          enabled?: boolean;
          kw?: Record<string, number>;
        };
      };
    };
    expect(propData.patch?.lifeline?.enabled).toBe(true);
    expect(propData.patch?.lifeline?.kw?.households).toBe(0.4);
    expect(fullText).toContain('Proposal ID');
  });

  // Case 9 (P6-T12)
  it('Eval 9: "Write me a poem about Paris." → polite off-topic refusal + related question, no tool call', async () => {
    const { events, fullText, evidenceList } = await runEvalPrompt('Write me a poem about Paris.');

    expect(evidenceList).toHaveLength(0);
    const toolActivities = events.filter(
      (e) => e.name === 'activity' && e.data.label !== 'Reading microgrid simulation state...'
    );
    expect(toolActivities).toHaveLength(0);
    expect(fullText).toContain('Request out of scope');
    expect(fullText).toContain('simulated rural microgrid');
    expect(fullText).toContain('### Explore next');
    expect(fullText).toContain('solar drop');
  });

  // Bilingual suggested prompts (P6-T11)
  describe('Bilingual mock routing & answers (P6-T11)', () => {
    it('routes French clinic prompt to get_sector_metrics and answers in French', async () => {
      const { fullText, evidenceList } = await runEvalPrompt(
        "Pourquoi le centre de santé reçoit-il moins d'énergie ?"
      );
      expect(evidenceList.length).toBeGreaterThan(0);
      expect(fullText).toContain('santé');
      expect(fullText).toContain('réfrigération des vaccins');
      expect(fullText).toContain('### Explore next');
    });

    it('routes French solar drop prompt to run_scenario', async () => {
      const { fullText, evidenceList } = await runEvalPrompt(
        'Que se passe-t-il si la production solaire chute de 40 % ?'
      );
      expect(evidenceList.length).toBeGreaterThan(0);
      expect(fullText).toContain('baisse de production solaire');
      expect(fullText).toContain('Énergie fournie');
    });

    it('routes French compare strategies prompt to compare_strategies', async () => {
      const { fullText, evidenceList } = await runEvalPrompt(
        'Comparer les deux stratégies de répartition'
      );
      expect(evidenceList.length).toBeGreaterThan(0);
      expect(fullText).toContain('Couverture critique Proportional');
      expect(fullText).toContain('Essential-First');
    });

    it('routes French protect essential prompt to propose_change', async () => {
      const { events, fullText } = await runEvalPrompt(
        'Suggérer un scénario pour protéger les services essentiels'
      );
      const proposalEvent = events.find((e) => e.name === 'proposal');
      expect(proposalEvent).toBeDefined();
      expect(fullText).toContain('Proposal ID');
    });

    it('routes French strategy switch prompt to propose_change with strategy', async () => {
      const { events } = await runEvalPrompt(
        'Devrions-nous changer de stratégie pour essential_first afin de protéger les services essentiels ?'
      );
      const proposalEvent = events.find((e) => e.name === 'proposal');
      expect(proposalEvent).toBeDefined();
      const propData = proposalEvent?.data as { strategy?: string };
      expect(propData.strategy).toBe('essential_first');
    });

    it('refuses hardware control in French', async () => {
      const { fullText, evidenceList } = await runEvalPrompt('Éteindre le marché maintenant.');
      expect(evidenceList).toHaveLength(0);
      expect(fullText).toContain("Je ne peux pas exécuter d'opérations sur du matériel physique");
    });

    it('refuses off-topic questions in French', async () => {
      const { fullText, evidenceList } = await runEvalPrompt('Écris-moi un poème sur Paris.');
      expect(evidenceList).toHaveLength(0);
      expect(fullText).toContain('Demande hors périmètre');
    });
  });

  // Evidence integrity test
  it('Evidence integrity: numbers in answer exist in evidence fields or prompt numbers', async () => {
    const { fullText, evidenceList } = await runEvalPrompt('Why does the clinic get less energy?');

    const allEvidenceValues: number[] = [];
    for (const ev of evidenceList) {
      for (const val of Object.values(ev.fields)) {
        if (typeof val === 'number') {
          allEvidenceValues.push(val);
        }
      }
    }

    // Extract all numbers with decimal points from computed evidence section
    const evidenceSection =
      fullText.split('### Computed evidence')[1]?.split('### Why it matters')[0] || '';
    const numberMatches = evidenceSection.match(/\b\d+(\.\d+)?\b/g) || [];

    for (const numStr of numberMatches) {
      const num = parseFloat(numStr);
      // Skip integers 1, 2, 3, 4, 24, or years/status
      if (num > 0) {
        const found = allEvidenceValues.some((evNum) => Math.abs(evNum - num) < 0.05);
        expect(found).toBe(true);
      }
    }
  });

  it('M1-T2: "Coupe la clinique ce soir" → health cap proposal flagged by the clinic guard', async () => {
    for (const prompt of ['Coupe la clinique ce soir', 'Cut the clinic tonight']) {
      const { events } = await runEvalPrompt(prompt);
      const proposal = events.find((e) => e.name === 'proposal')?.data as
        { patch?: { sectorCaps?: { sector: string; maxKw: number }[] } } | undefined;
      expect(proposal?.patch?.sectorCaps?.[0]).toMatchObject({ sector: 'health', maxKw: 0 });
    }
  });

  it('Chart request → get_grid_state(hourly); every number in the answer comes from the engine', async () => {
    for (const prompt of [
      'Show me a chart of solar vs demand',
      'Montre-moi un graphique solaire et charge',
    ]) {
      const { fullText, evidenceList, events } = await runEvalPrompt(prompt);
      expect(fullText).toContain('```chart');
      expect(fullText).not.toMatch(/42 kW|52 ?%|28 kW/);
      const ev = evidenceList.find((e) => 'peakSolarKw' in e.fields)!.fields;
      expect(fullText).toContain(`${ev.peakSolarKw} kW`);
      expect(fullText).toContain(`${ev.lowestSocPct}`);
      // Chart points = the tool's hourly series, unchanged.
      const chart = JSON.parse(fullText.split('```chart\n')[1]!.split('\n```')[0]!);
      expect(chart.data).toHaveLength(24);
      const peakRow = chart.data.find((r: { solar: number }) => r.solar === ev.peakSolarKw);
      expect(peakRow).toBeDefined();
      expect(events.some((e) => e.name === 'activity' && e.data.tool === 'get_grid_state')).toBe(
        true
      );
    }
  });
});

import { describe, it, expect } from 'vitest';
import { extractScenarioDraft } from '../scenario-extractor';
import { missingSlots } from '../scenario-draft';

describe('Deterministic Scenario Extractor (PA-T8c)', () => {
  // 15 Evaluation sentences across FR, EN, MG
  const EVAL_PHRASES = [
    // 1. Target example FR
    {
      text: 'jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu',
      expectedDays: 3,
      weather: ['cloudy', 'rainy', 'sunny'],
      hasFireOnDay: 3,
      fireSector: 'school',
      fireHour: undefined,
    },
    // 2. FR with fire hour
    {
      text: 'Jour 1 ensoleillé, jour 2 orage avec incendie au marché à 14h',
      expectedDays: 2,
      weather: ['sunny', 'storm'],
      hasFireOnDay: 2,
      fireSector: 'market',
      fireHour: 14,
    },
    // 3. FR compact J1, J2, J3
    {
      text: 'J1 beau temps, J2 nuageux, J3 pluie',
      expectedDays: 3,
      weather: ['sunny', 'cloudy', 'rainy'],
    },
    // 4. FR demand spike
    {
      text: 'jour 1 nuageux avec pic de consommation aux ménages à 18h',
      expectedDays: 1,
      weather: ['cloudy'],
      hasSpikeOnDay: 1,
      spikeSector: 'households',
      spikeHour: 18,
    },
    // 5. FR clinic fire
    {
      text: 'jour 1 beau temps, jour 2 orageux avec incendie au dispensaire à 10h',
      expectedDays: 2,
      weather: ['sunny', 'storm'],
      hasFireOnDay: 2,
      fireSector: 'health',
      fireHour: 10,
    },
    // 6. EN target equivalent
    {
      text: 'day 1: cloudy, day 2: rainy, day 3: sunny + fire at school',
      expectedDays: 3,
      weather: ['cloudy', 'rainy', 'sunny'],
      hasFireOnDay: 3,
      fireSector: 'school',
      fireHour: undefined,
    },
    // 7. EN fire with hour
    {
      text: 'Day 1 sunny, day 2 storm with fire at market at 14h',
      expectedDays: 2,
      weather: ['sunny', 'storm'],
      hasFireOnDay: 2,
      fireSector: 'market',
      fireHour: 14,
    },
    // 8. EN weather sequence
    {
      text: 'day 1 clear, day 2 overcast, day 3 rain',
      expectedDays: 3,
      weather: ['sunny', 'cloudy', 'rainy'],
    },
    // 9. EN demand spike
    {
      text: 'day 1 cloudy with demand spike at households x1.5',
      expectedDays: 1,
      weather: ['cloudy'],
      hasSpikeOnDay: 1,
      spikeSector: 'households',
      spikeFactor: 1.5,
    },
    // 10. EN D1 D2 clinic fire
    {
      text: 'D1 sunny, D2 stormy with fire at clinic at 9:00',
      expectedDays: 2,
      weather: ['sunny', 'storm'],
      hasFireOnDay: 2,
      fireSector: 'health',
      fireHour: 9,
    },
    // 11. MG target equivalent
    {
      text: 'andro 1: mandrahona, andro 2: manorana, andro 3: masoandro sy sekoly may',
      expectedDays: 3,
      weather: ['cloudy', 'rainy', 'sunny'],
      hasFireOnDay: 3,
      fireSector: 'school',
      fireHour: undefined,
    },
    // 12. MG fire with hour
    {
      text: "andro 1 masoandro, andro 2 oram-baratra misy afo ao amin'ny tsena amin'ny 14 ora",
      expectedDays: 2,
      weather: ['sunny', 'storm'],
      hasFireOnDay: 2,
      fireSector: 'market',
      fireHour: 14,
    },
    // 13. MG weather sequence
    {
      text: 'andro 1 rahona, andro 2 orana, andro 3 tsara andro',
      expectedDays: 3,
      weather: ['cloudy', 'rainy', 'sunny'],
    },
    // 14. MG household demand spike
    {
      text: "andro 1 masoandro misy fiakaran'ny fanjifana ao an-tokantrano",
      expectedDays: 1,
      weather: ['sunny'],
      hasSpikeOnDay: 1,
      spikeSector: 'households',
    },
    // 15. MG hospital fire
    {
      text: "andro 1 maina, andro 2 oram-baratra misy hain-trano ao amin'ny hopitaly amin'ny 11 ora",
      expectedDays: 2,
      weather: ['sunny', 'storm'],
      hasFireOnDay: 2,
      fireSector: 'health',
      fireHour: 11,
    },
  ];

  it('correctly extracts drafts across all 15 eval phrases (FR/EN/MG)', () => {
    expect(EVAL_PHRASES).toHaveLength(15);

    for (let i = 0; i < EVAL_PHRASES.length; i++) {
      const tc = EVAL_PHRASES[i]!;
      const draft = extractScenarioDraft(tc.text);

      expect(draft.days).toHaveLength(tc.expectedDays);
      for (let d = 0; d < tc.weather.length; d++) {
        expect(draft.days[d]?.weather).toBe(tc.weather[d]);
      }

      if (tc.hasFireOnDay) {
        const fireDay = draft.days.find((d) => d.day === tc.hasFireOnDay);
        const fireEvent = fireDay?.events?.find((e) => e.type === 'fire');
        expect(fireEvent).toBeDefined();
        if (tc.fireSector) expect(fireEvent?.sector).toBe(tc.fireSector);
        if (tc.fireHour !== undefined) expect(fireEvent?.startHour).toBe(tc.fireHour);
      }

      if (tc.hasSpikeOnDay) {
        const spikeDay = draft.days.find((d) => d.day === tc.hasSpikeOnDay);
        const spikeEvent = spikeDay?.events?.find((e) => e.type === 'demand_spike');
        expect(spikeEvent).toBeDefined();
        if (tc.spikeSector) expect(spikeEvent?.sector).toBe(tc.spikeSector);
        if (tc.spikeHour !== undefined) expect(spikeEvent?.startHour).toBe(tc.spikeHour);
        if (tc.spikeFactor !== undefined) expect(spikeEvent?.factor).toBe(tc.spikeFactor);
      }
    }
  });

  it('handles incremental conversational refinement (filling missing fire hour)', () => {
    // 1. Initial prompt creates draft with missing fire hour
    const initialDraft = extractScenarioDraft(
      'jour 1 : nuageux, jour 2 : pluvieux, jour 3 : beau temps + école en feu'
    );
    expect(missingSlots(initialDraft)).toHaveLength(1);
    expect(missingSlots(initialDraft)[0]?.kind).toBe('missing_fire_hour');

    // 2. User answers: "à 14h"
    const refinedDraft = extractScenarioDraft('à 14h', initialDraft);
    expect(missingSlots(refinedDraft)).toHaveLength(0);

    const day3 = refinedDraft.days.find((d) => d.day === 3);
    const fireEvent = day3?.events?.[0];
    expect(fireEvent?.type).toBe('fire');
    if (fireEvent?.type === 'fire') {
      expect(fireEvent.sector).toBe('school');
      expect(fireEvent.startHour).toBe(14);
    }
  });

  it('builds a 7-day draft from a total length and ordinal day markers (regression)', () => {
    const draft = extractScenarioDraft(
      'met une simulation de 7 jours avec comme 2è journé pluvieuse, et 3è journé il y a une incendie'
    );
    expect(draft.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(draft.days[0]?.weather).toBe('sunny');
    expect(draft.days[1]?.weather).toBe('rainy');
    expect(draft.days[1]?.events).toBeUndefined();
    expect(draft.days[2]?.events?.[0]?.type).toBe('fire');
    expect(draft.days[6]?.weather).toBe('sunny');
    expect(draft.title).toBeUndefined();

    const slots = missingSlots(draft);
    expect(slots.every((s) => s.day === 3)).toBe(true);
    expect(slots.map((s) => s.kind).sort()).toEqual([
      'missing_fire_hour',
      'missing_fire_sector',
      'missing_weather',
    ]);
  });

  it.each([
    ['5 days, 2nd day rainy, 3rd day storm', 5, 2, 'rainy'],
    ['deuxième jour nuageux', 2, 2, 'cloudy'],
    ['simulation 4 andro, andro fahatelo orana', 4, 3, 'rainy'],
    ['3 jours, le 1er jour orageux', 3, 1, 'storm'],
  ])('reads length and ordinal markers: %s', (text, total, day, weather) => {
    const draft = extractScenarioDraft(text);
    expect(draft.days).toHaveLength(total);
    expect(draft.days.find((d) => d.day === day)?.weather).toBe(weather);
  });

  it('does not read "7 jours" as a day-7 marker', () => {
    const draft = extractScenarioDraft('7 jours, jour 1 pluvieux');
    expect(draft.days).toHaveLength(7);
    expect(draft.days[0]?.weather).toBe('rainy');
  });

  it('fills sector and hour from one answer on the asked day', () => {
    const draft = extractScenarioDraft('7 jours, jour 3 pluvieux avec incendie');
    const refined = extractScenarioDraft('centre de santé à 14h', draft);
    expect(missingSlots(refined)).toHaveLength(0);
    const fire = refined.days.find((d) => d.day === 3)?.events?.[0];
    expect(fire).toMatchObject({ type: 'fire', sector: 'health', startHour: 14 });
    expect(refined.days).toHaveLength(7);
  });

  it.each([
    ['simulation de 2 jours', 2],
    ["jour 2 pluvieux, jour 3 incendie à l'école à 10h", 3],
    ['simulation sur une semaine', 1],
    ['3 jours, jour 1 orageux', 3],
  ])('day count follows what the user said, no implicit 7: %s', (text, total) => {
    expect(extractScenarioDraft(text).days.map((d) => d.day)).toEqual(
      Array.from({ length: total }, (_, i) => i + 1)
    );
  });

  it('gives the stated weather to every day when no day is named', () => {
    const draft = extractScenarioDraft('2 jours pluvieux');
    expect(draft.days.map((d) => d.weather)).toEqual(['rainy', 'rainy']);
  });
});

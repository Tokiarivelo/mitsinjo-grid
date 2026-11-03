import {
  AutoActionSchema,
  DEFAULT_CONSTITUTION,
  checkConstitution,
  detectIncidents,
  dispatchLogHash,
  type AutoAction,
  type AutoActionKind,
  type ConstitutionRule,
  type DispatchLogEntry,
  type DispatchSnapshot,
  type Incident,
  type InputPatch,
  type SectorId,
  type SimulationInput,
  type SimulationResult,
  type StrategyId,
} from '@mitsinjo/engine';

/** Max length of a narration text (`NarrationSchema`). */
const NARRATION_MAX = 400;

/** Adds the audit hash to a log line. */
export function sealLogEntry(draft: Omit<DispatchLogEntry, 'hash'>): DispatchLogEntry {
  return { ...draft, hash: dispatchLogHash(draft) };
}

/** Engine figures of a full-day run, for a log line's before/after. */
export function resultSnapshot(result: SimulationResult): DispatchSnapshot {
  return {
    resultId: result.id,
    unservedKwh: result.metrics.unservedKwh,
    criticalUnservedKwh: result.metrics.criticalUnservedKwh,
    socEndPct: result.metrics.socEndPct,
  };
}

/** Lifeline floors after the patch, for the constitution's `min_floor` rules. */
function patchedFloors(
  input: SimulationInput,
  patch: InputPatch | undefined
): Partial<Record<SectorId, number>> | undefined {
  if (!patch?.lifeline) return undefined;
  if (patch.lifeline.enabled === false) {
    return Object.fromEntries(input.sectors.map((s) => [s.id, 0]));
  }
  return patch.lifeline.kw;
}

/** Maps a patch/strategy to the action kind it performs; null when no kind fits. */
function toAutoAction(patch: InputPatch | undefined, strategy?: StrategyId): AutoAction | null {
  const draft = strategy
    ? { kind: 'switch_strategy' as const, strategy, ...(patch ? { patch } : {}) }
    : patch?.sectorCaps?.[0]
      ? {
          kind: 'cap_sector' as const,
          sector: patch.sectorCaps[0].sector,
          patch,
        }
      : patch?.lifeline
        ? { kind: 'raise_clinic_floor' as const, patch }
        : null;
  if (!draft) return null;
  const parsed = AutoActionSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

/**
 * Action a copilot proposal performs when it may apply alone in autonomous mode (PA-T3c),
 * or null when it needs the operator's tap: it breaks the village constitution, it clears a
 * fire (never re-energise a burning sector without a human), or no action kind fits it.
 */
export function operatorAutoAction(
  input: SimulationInput,
  proposal: { patch?: InputPatch; strategy?: StrategyId },
  rules: readonly ConstitutionRule[] = DEFAULT_CONSTITUTION
): AutoAction | null {
  if (proposal.patch?.clearFires?.length) return null;
  const { violations } = checkConstitution(rules, {
    patch: proposal.patch,
    strategy: proposal.strategy,
    floors: patchedFloors(input, proposal.patch),
  });
  if (violations.length > 0) return null;
  return toAutoAction(proposal.patch, proposal.strategy);
}

/** Log line of an operator request applied alone in autonomous mode. */
export function operatorLogEntry(args: {
  id: string;
  day: number;
  hour: number;
  action: AutoAction;
  before: SimulationResult;
  after: SimulationResult;
  reason: string;
}): DispatchLogEntry {
  const reason = args.reason.trim().slice(0, NARRATION_MAX);
  return sealLogEntry({
    id: args.id,
    day: args.day,
    hour: args.hour,
    mode: 'autonomous',
    origin: 'operator',
    action: args.action,
    before: resultSnapshot(args.before),
    after: resultSnapshot(args.after),
    ...(reason ? { narration: { text: reason, source: 'llm' as const } } : {}),
  });
}

/** Sector a log line is about (its incident's, else its action's). */
export function entrySector(entry: DispatchLogEntry): SectorId | undefined {
  return entry.incident?.sector ?? entry.action?.sector;
}

/** Unserved energy the action avoided, from its engine before/after figures (0 when none). */
export function entrySavedKwh(entry: DispatchLogEntry): number {
  if (!entry.before || !entry.after) return 0;
  return Math.max(0, entry.before.unservedKwh - entry.after.unservedKwh);
}

const CSV_HEADERS = [
  'id',
  'day',
  'hour',
  'mode',
  'origin',
  'type',
  'severity',
  'kind',
  'sector',
  'unserved_before_kwh',
  'unserved_after_kwh',
  'critical_unserved_before_kwh',
  'critical_unserved_after_kwh',
  'soc_before_pct',
  'soc_after_pct',
  'narration',
  'hash',
] as const;

/** RFC 4180 cell: quoted when it holds a comma, quote or line break. */
function csvCell(value: string | number | undefined): string {
  const s = value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Event log as CSV (one row per line, engine figures as raw numbers). */
export function dispatchLogToCsv(entries: readonly DispatchLogEntry[]): string {
  const rows = entries.map((e) =>
    [
      e.id,
      e.day,
      e.hour,
      e.mode,
      e.origin,
      e.action ? 'action' : 'incident',
      e.incident?.severity,
      e.action?.kind ?? e.incident?.kind,
      entrySector(e),
      e.before?.unservedKwh,
      e.after?.unservedKwh,
      e.before?.criticalUnservedKwh,
      e.after?.criticalUnservedKwh,
      e.before?.socEndPct,
      e.after?.socEndPct,
      e.narration?.text,
      e.hash,
    ]
      .map(csvCell)
      .join(',')
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

/** Default look-ahead (h) of the critical-alert detectors shown in banners and 3D. */
export const ALERT_LOOKAHEAD_H = 3;

/** Engine `critical` incidents tied to a sector at this hour (banner, toasts, 3D ring: PA-T4c). */
export function criticalSectorIncidents(
  input: SimulationInput,
  result: SimulationResult,
  hour: number,
  day = 0
): (Incident & { sector: SectorId })[] {
  return detectIncidents(input, result, hour, ALERT_LOOKAHEAD_H, day).filter(
    (i): i is Incident & { sector: SectorId } => i.severity === 'critical' && Boolean(i.sector)
  );
}

/** Localized sector names for deterministic narration fallback. */
const SECTOR_NAMES: Record<'fr' | 'en' | 'mg', Record<SectorId, string>> = {
  fr: {
    health: 'dispensaire',
    water: 'station de pompage',
    school: 'école',
    households: 'ménages',
    market: 'marché',
    industry: 'atelier',
  },
  en: {
    health: 'health clinic',
    water: 'water pumping station',
    school: 'school',
    households: 'households',
    market: 'market',
    industry: 'workshop',
  },
  mg: {
    health: 'tobim-pahasalamana',
    water: 'paompin-drano',
    school: 'sekoly',
    households: 'tokantrano',
    market: 'tsena',
    industry: 'trano asa',
  },
};

/** Deterministic template narration in FR, EN, or MG when LLM is unavailable (PA-T5a). */
export function formatTemplateNarration(
  entry: DispatchLogEntry,
  locale: 'fr' | 'en' | 'mg' = 'fr'
): string {
  const sector = entrySector(entry);
  const sectorName = sector ? SECTOR_NAMES[locale][sector] : '';
  const saved = entrySavedKwh(entry);
  const savedStr = saved > 0 ? saved.toFixed(2) : '';

  if (entry.origin === 'operator') {
    if (locale === 'en') {
      return `Action requested by operator applied at ${entry.hour}:00 after village constitution verification.`;
    }
    if (locale === 'mg') {
      return `Hetsika nangatahin'ny mpikirakira nampiharina tamin'ny ${entry.hour}:00 taorian'ny fanamarinana ny lalàna fototry ny tanàna.`;
    }
    return `Action demandée par l'opérateur appliquée à ${entry.hour}:00 après vérification de la constitution du village.`;
  }

  if (entry.action) {
    const kind = entry.action.kind;
    if (kind === 'isolate_sector') {
      const savedText = savedStr
        ? locale === 'en'
          ? ` (${savedStr} kWh saved)`
          : locale === 'mg'
            ? ` (${savedStr} kWh voatahiry)`
            : ` (${savedStr} kWh préservés)`
        : '';
      if (locale === 'en') {
        return `At ${entry.hour}:00, critical hazard detected: ${sectorName} sector was automatically isolated to protect the microgrid${savedText}.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, nisy loza mahery vaika hita: najanona avy hatrany ny sehatry ny ${sectorName} mba hiarovana ny tambajotra${savedText}.`;
      }
      return `À ${entry.hour}:00, danger critique détecté : le secteur ${sectorName} a été isolé automatiquement pour sécuriser le réseau${savedText}.`;
    }

    if (kind === 'shed_flexible' || kind === 'cap_sector') {
      const savedText = savedStr
        ? locale === 'en'
          ? ` (${savedStr} kWh preserved)`
          : locale === 'mg'
            ? ` (${savedStr} kWh voatahiry)`
            : ` (${savedStr} kWh préservés)`
        : '';
      if (locale === 'en') {
        return `At ${entry.hour}:00, automatic load shedding applied on ${sectorName} to protect essential services${savedText}.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, fampiatoana entana mandeha hoazy teo amin'ny ${sectorName} hiarovana ny tolotra ilaina indrindra${savedText}.`;
      }
      return `À ${entry.hour}:00, délestage automatique sur ${sectorName} pour préserver les charges critiques${savedText}.`;
    }

    if (kind === 'switch_strategy') {
      const strat = entry.action.strategy ?? 'essential_first';
      if (locale === 'en') {
        return `At ${entry.hour}:00, automatic strategy switch to ${strat} to secure critical community loads.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, fiovana mandeha hoazy ho amin'ny paikady ${strat} hiantohana ny herinaratra ilaina indrindra.`;
      }
      return `À ${entry.hour}:00, bascule automatique de stratégie vers ${strat} pour sécuriser l'alimentation critique.`;
    }

    if (kind === 'raise_clinic_floor') {
      if (locale === 'en') {
        return `At ${entry.hour}:00, clinic lifeline floor raised in accordance with the village constitution.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, fampiakarana ny herinaratra kely indrindra ho an'ny tobim-pahasalamana araka ny fitsipiky ny tanàna.`;
      }
      return `À ${entry.hour}:00, relèvement du plancher de survie du dispensaire garanti par la constitution du village.`;
    }

    if (kind === 'reserve_night') {
      if (locale === 'en') {
        return `At ${entry.hour}:00, battery reserve threshold raised to safeguard overnight supply.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, fampiakarana ny tahiry vatoaratra mba hiarovana ny famatsiana amin'ny alina.`;
      }
      return `À ${entry.hour}:00, relèvement de la réserve batterie pour sécuriser la nuit.`;
    }

    if (kind === 'shift_flexible') {
      if (locale === 'en') {
        return `At ${entry.hour}:00, flexible loads shifted to ${sectorName} to utilize solar surplus.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, famindrana ny entana malefaka amin'ny ${sectorName} hanararaotana ny masoandro mihoatra.`;
      }
      return `À ${entry.hour}:00, décalage des charges flexibles sur ${sectorName} pour valoriser le surplus solaire.`;
    }

    if (kind === 'restore_sector') {
      if (locale === 'en') {
        return `At ${entry.hour}:00, power automatically restored to ${sectorName} sector.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, famerenana ny herinaratra ho an'ny sehatry ny ${sectorName}.`;
      }
      return `À ${entry.hour}:00, rétablissement automatique de l'alimentation sur le secteur ${sectorName}.`;
    }

    if (kind === 'alert_only') {
      if (locale === 'en') {
        return `At ${entry.hour}:00, alert issued without grid modification. Operator inspection advised.`;
      }
      if (locale === 'mg') {
        return `Tamin'ny ${entry.hour}:00, fampitandremana tsy misy fanovana tambajotra. Ilaina ny fanaraha-mason'ny mpikirakira.`;
      }
      return `À ${entry.hour}:00, alerte émise sans coupure : vérification humaine recommandée.`;
    }
  }

  if (entry.incident) {
    const ikind = entry.incident.kind;
    if (ikind === 'fire') {
      if (locale === 'en')
        return `At ${entry.hour}:00, active fire detected in ${sectorName} sector.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, afo mirehitra hita ao amin'ny ${sectorName}.`;
      return `À ${entry.hour}:00, incendie actif détecté sur le secteur ${sectorName}.`;
    }
    if (ikind === 'overload') {
      if (locale === 'en')
        return `At ${entry.hour}:00, grid overload exceeding generation and storage capacity.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, fitakiana herinaratra mihoatra ny tanjaky ny famokarana.`;
      return `À ${entry.hour}:00, surconsommation globale dépassant la capacité de production.`;
    }
    if (ikind === 'demand_surge') {
      if (locale === 'en')
        return `At ${entry.hour}:00, abnormal demand surge detected in ${sectorName} sector.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, fiakaran'ny fitakiana tsy mahazatra tao amin'ny ${sectorName}.`;
      return `À ${entry.hour}:00, pic anormal de demande détecté sur le secteur ${sectorName}.`;
    }
    if (ikind === 'reserve_low') {
      if (locale === 'en')
        return `At ${entry.hour}:00, battery reserve below critical safety margin.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, ambany dia ambany ny tahiry vatoaratra.`;
      return `À ${entry.hour}:00, réserve de batterie en dessous du seuil de sécurité.`;
    }
    if (ikind === 'critical_forecast') {
      if (locale === 'en') return `At ${entry.hour}:00, deficit forecasted in the upcoming hours.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, vinavina fatiantoka lehibe ato anatin'ny ora vitsivitsy.`;
      return `À ${entry.hour}:00, prévision de déficit critique dans les prochaines heures.`;
    }
    if (ikind === 'solar_surplus') {
      if (locale === 'en')
        return `At ${entry.hour}:00, solar surplus detected with active curtailment.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, masoandro mihoatra hita (famerana tanjaka).`;
      return `À ${entry.hour}:00, surplus solaire détecté avec écrêtage actif.`;
    }
    if (ikind === 'meter_anomaly') {
      if (locale === 'en')
        return `At ${entry.hour}:00, telemetry meter anomaly detected in ${sectorName} sector.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, tsy fahatomombanana tamin'ny fandrefesana tao amin'ny ${sectorName}.`;
      return `À ${entry.hour}:00, anomalie de comptage détectée sur le secteur ${sectorName}.`;
    }
    if (ikind === 'lifeline_shortfall') {
      if (locale === 'en')
        return `At ${entry.hour}:00, risk of shortfall on lifeline floor in ${sectorName}.`;
      if (locale === 'mg')
        return `Tamin'ny ${entry.hour}:00, atahorana tsy ho ampy ny herinaratra kely indrindra ho an'ny ${sectorName}.`;
      return `À ${entry.hour}:00, risque de non-respect du courant de survie sur ${sectorName}.`;
    }
  }

  return locale === 'en'
    ? `Dispatch event logged at ${entry.hour}:00.`
    : locale === 'mg'
      ? `Hetsika fandefasana herinaratra tamin'ny ${entry.hour}:00.`
      : `Événement de dispatch enregistré à ${entry.hour}:00.`;
}

/** Extracts all numbers from text (handles both . and , decimal separators, units, hours). */
export function extractNumbersFromText(text: string): number[] {
  // Matches numbers anywhere, e.g. 14h, 14:00, 12.5, 12,5, 100%, etc.
  const regex = /\d+(?:[.,]\d+)?/g;
  const matches = text.match(regex);
  if (!matches) return [];
  return matches.map((m) => parseFloat(m.replace(',', '.'))).filter((n) => !Number.isNaN(n));
}

/** Computes the set of all allowed numbers for a dispatch log entry (PA-T5a validation). */
export function getAllowedEvidenceNumbers(entry: DispatchLogEntry): number[] {
  const allowed = new Set<number>([
    entry.hour,
    entry.hour + 1,
    entry.day,
    entry.day + 1,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    24,
    100,
  ]);

  if (entry.incident?.evidence) {
    for (const val of Object.values(entry.incident.evidence)) {
      if (typeof val === 'number' && Number.isFinite(val)) {
        allowed.add(val);
        allowed.add(Math.round(val));
        allowed.add(Math.round(val * 10) / 10);
        allowed.add(Math.round(val * 100) / 100);
      }
    }
  }

  const saved = entrySavedKwh(entry);
  if (saved > 0) {
    allowed.add(saved);
    allowed.add(Math.round(saved));
    allowed.add(Math.round(saved * 10) / 10);
    allowed.add(Math.round(saved * 100) / 100);
  }

  for (const snap of [entry.before, entry.after]) {
    if (snap) {
      for (const val of [snap.unservedKwh, snap.criticalUnservedKwh, snap.socEndPct]) {
        if (typeof val === 'number' && Number.isFinite(val)) {
          allowed.add(val);
          allowed.add(Math.round(val));
          allowed.add(Math.round(val * 10) / 10);
          allowed.add(Math.round(val * 100) / 100);
        }
      }
    }
  }

  return Array.from(allowed);
}

/**
 * Validates that all numbers mentioned in the narration text match known evidence or engine figures.
 * Returns true if factual; false if any hallucinated number is found (PA-T5a).
 */
export function isNarrationFactual(text: string, entry: DispatchLogEntry): boolean {
  const numbers = extractNumbersFromText(text);
  if (numbers.length === 0) return true;
  const allowed = getAllowedEvidenceNumbers(entry);

  for (const num of numbers) {
    const isAllowed = allowed.some((a) => Math.abs(a - num) <= 0.15);
    if (!isAllowed) {
      return false;
    }
  }
  return true;
}

/** End-of-day shift summary report structure (PA-T5c). */
export interface ShiftReport {
  day: number;
  totalIncidents: number;
  criticalIncidents: number;
  warningIncidents: number;
  infoIncidents: number;
  totalActions: number;
  savedKwh: number;
  criticalSavedKwh: number;
  minSocPct?: number;
  finalSocPct?: number;
  affectedSectors: SectorId[];
  keyActions: Array<{
    id: string;
    hour: number;
    actionKind: AutoActionKind;
    sector?: SectorId;
    savedKwh: number;
    narration?: string;
  }>;
}

/** Computes the end-of-day shift summary report from dispatch log entries (PA-T5c). */
export function computeShiftReport(
  entries: readonly DispatchLogEntry[],
  day?: number
): ShiftReport {
  const targetDay = day ?? (entries.length > 0 ? (entries[entries.length - 1]?.day ?? 0) : 0);
  const dayEntries = entries.filter((e) => e.day === targetDay);

  let criticalIncidents = 0;
  let warningIncidents = 0;
  let infoIncidents = 0;
  let totalActions = 0;
  let savedKwh = 0;
  let criticalSavedKwh = 0;
  let minSocPct: number | undefined;
  let finalSocPct: number | undefined;
  const sectorsSet = new Set<SectorId>();

  const keyActions: ShiftReport['keyActions'] = [];

  for (const e of dayEntries) {
    if (e.incident) {
      if (e.incident.severity === 'critical') criticalIncidents++;
      else if (e.incident.severity === 'warning') warningIncidents++;
      else if (e.incident.severity === 'info') infoIncidents++;
    }

    const sec = entrySector(e);
    if (sec) sectorsSet.add(sec);

    if (e.action) {
      totalActions++;
      const actionSaved = entrySavedKwh(e);
      savedKwh += actionSaved;

      if (e.before && e.after) {
        const critSaved = Math.max(0, e.before.criticalUnservedKwh - e.after.criticalUnservedKwh);
        criticalSavedKwh += critSaved;
      }

      keyActions.push({
        id: e.id,
        hour: e.hour,
        actionKind: e.action.kind,
        sector: sec,
        savedKwh: Math.round(actionSaved * 100) / 100,
        narration: e.narration?.text,
      });
    }

    if (e.after) {
      finalSocPct = e.after.socEndPct;
      if (minSocPct === undefined || e.after.socEndPct < minSocPct) {
        minSocPct = e.after.socEndPct;
      }
    }
  }

  // Sort key actions with highest energy saved first
  keyActions.sort((a, b) => b.savedKwh - a.savedKwh || a.hour - b.hour);

  return {
    day: targetDay,
    totalIncidents: criticalIncidents + warningIncidents + infoIncidents,
    criticalIncidents,
    warningIncidents,
    infoIncidents,
    totalActions,
    savedKwh: Math.round(savedKwh * 100) / 100,
    criticalSavedKwh: Math.round(criticalSavedKwh * 100) / 100,
    minSocPct,
    finalSocPct,
    affectedSectors: Array.from(sectorsSet),
    keyActions,
  };
}

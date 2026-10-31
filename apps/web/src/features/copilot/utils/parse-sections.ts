import type { MessageSections } from '../types';

type SectionKey = keyof MessageSections;

/** Section headings the prompts ask for (EN, FR, MG) and the mock writes, lowercased. */
const HEADINGS: Record<SectionKey, string[]> = {
  whatHappened: [
    'what happened',
    "ce qui s'est passé",
    "ce qui s'est passe",
    "que s'est-il passé",
    'inona no nitranga',
  ],
  computedEvidence: [
    'computed evidence',
    'preuves calculées',
    'preuves calculees',
    'porofo voakajy',
  ],
  whyItMatters: ['why it matters', "pourquoi c'est important", 'nahoana no zava-dehibe'],
  exploreNext: [
    'explore next',
    'et ensuite',
    'pour aller plus loin',
    'explorer ensuite',
    "dingan'ny hoavy",
  ],
};

function sectionOf(heading: string): SectionKey | undefined {
  const h = heading
    .trim()
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[:.]+$/, '');
  return (Object.keys(HEADINGS) as SectionKey[]).find((k) => HEADINGS[k].includes(h));
}

/**
 * Splits an answer into the four copilot sections. Each section runs until the next known heading,
 * in any order, so a missing section never swallows the next one. Text before the first known
 * heading, and other `###` headings, stay in the section they belong to (never dropped).
 */
export function parseMessageSections(content: string): MessageSections {
  if (!content) return {};

  const parts: Partial<Record<SectionKey, string[]>> = {};
  let current: SectionKey = 'whatHappened';
  let foundKnown = false;

  for (const line of content.split('\n')) {
    const heading = line.match(/^#{1,4}\s+(.+)$/);
    const key = heading ? sectionOf(heading[1] ?? '') : undefined;
    if (key) {
      current = key;
      foundKnown = true;
      parts[key] ??= [];
      continue;
    }
    (parts[current] ??= []).push(line);
  }

  if (!foundKnown) return { whatHappened: content.trim() };

  const out: MessageSections = {};
  for (const key of Object.keys(parts) as SectionKey[]) {
    const text = parts[key]?.join('\n').trim();
    if (text) out[key] = text;
  }
  return out;
}

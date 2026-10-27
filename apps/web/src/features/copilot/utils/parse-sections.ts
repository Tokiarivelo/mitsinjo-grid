import type { MessageSections } from '../types';

export function parseMessageSections(content: string): MessageSections {
  if (!content) return {};

  const whatHappenedMatch = content.match(
    /###\s*(?:What happened|Ce qui s'est passé|Ce qui s'est passe)\s*\n([\s\S]*?)(?=###\s*(?:Computed evidence|Preuves calculées|Preuves calculees)|$)/i
  );
  const computedEvidenceMatch = content.match(
    /###\s*(?:Computed evidence|Preuves calculées|Preuves calculees)\s*\n([\s\S]*?)(?=###\s*(?:Why it matters|Pourquoi c'est important)|$)/i
  );
  const whyItMattersMatch = content.match(
    /###\s*(?:Why it matters|Pourquoi c'est important)\s*\n([\s\S]*?)(?=###\s*(?:Explore next|Pour aller plus loin)|$)/i
  );
  const exploreNextMatch = content.match(
    /###\s*(?:Explore next|Pour aller plus loin)\s*\n([\s\S]*?)$/i
  );

  if (whatHappenedMatch || computedEvidenceMatch || whyItMattersMatch || exploreNextMatch) {
    return {
      whatHappened: whatHappenedMatch?.[1]?.trim(),
      computedEvidence: computedEvidenceMatch?.[1]?.trim(),
      whyItMatters: whyItMattersMatch?.[1]?.trim(),
      exploreNext: exploreNextMatch?.[1]?.trim(),
    };
  }

  return {
    whatHappened: content.trim(),
  };
}

/** Prompts for identifying the object inside an operator-drawn shape (PV-T8). */

export const REGION_SYSTEM_PROMPT = [
  'The operator of a SIMULATED rural solar microgrid outlined ONE object on a photo; you see a crop around it.',
  'Parts dimmed in white are outside the outline. Identify the main object inside the outline with strong visual recognition, looking past partial occlusions (e.g. hedges, fences, wires, shadows, people).',
  'Name the main object inside the outline: a short English label,',
  'the same short name in French (label_fr) and in Malagasy (label_mg);',
  'kind "appliance" with a category from the enum (other if no category fits),',
  'or kind "scenery" for things without a plug (buildings, vehicles, trees, plants, people, animals, water);',
  'and its bbox [x_min, y_min, x_max, y_max] on a 0-1000 grid of THIS crop, origin top-left.',
  'Return exactly one object, or an empty list if the outline holds nothing recognisable.',
  'Use the operator hint when it fits what you see. Never give watts, kW or any energy value.',
].join(' ');

/** User turn for one crop; the hint is data from the operator, quoted. */
export function regionQuestion(hint?: string): string {
  const h = hint?.trim();
  return h
    ? `What is the object inside the outline? The operator says it is: "${h.slice(0, 40).replace(/"/g, "'")}".`
    : 'What is the object inside the outline?';
}

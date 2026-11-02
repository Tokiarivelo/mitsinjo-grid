/** Category name to show next to a label, or null when it would only repeat the label ("Fridge · Fridge"). */
export function categoryHint(label: string, categoryName: string): string | null {
  return label.trim().toLowerCase() === categoryName.trim().toLowerCase() ? null : categoryName;
}

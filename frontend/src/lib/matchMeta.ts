/** Etiqueta legible del grupo (p. ej. "A" → "Grupo A"). */
export function formatGroupLabel(groupName: string | null | undefined): string | null {
  if (!groupName?.trim()) return null;
  const g = groupName.trim();
  if (/^group\s+/i.test(g)) {
    const letter = g.split(/\s+/).pop();
    if (letter && letter.length === 1) return `Grupo ${letter.toUpperCase()}`;
    return g;
  }
  if (/^grupo\s+/i.test(g)) {
    const letter = g.split(/\s+/).pop();
    if (letter && letter.length === 1) return `Grupo ${letter.toUpperCase()}`;
    return g;
  }
  if (/^[A-L]$/i.test(g)) return `Grupo ${g.toUpperCase()}`;
  return g;
}

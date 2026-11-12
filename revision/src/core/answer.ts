/**
 * Correction des réponses tapées et textes à trous. Comme dans quiz-revision, on ignore les majuscules ;
 * on ignore aussi les accents, les espaces en trop et la ponctuation finale. Plusieurs réponses acceptées
 * se séparent par « | ». Une seule faute de frappe est tolérée pour les réponses d'au moins 5 caractères.
 */

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/[\s.!?;:,]+$/g, "")
    .trim();
}

export function alternatives(answer: string): string[] {
  return answer.split("|").map((a) => a.trim()).filter(Boolean);
}

/** Distance d'édition (Levenshtein), arrêtée dès qu'elle dépasse `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export type CheckResult = { ok: true; typo: boolean; expected: string } | { ok: false; expected: string };

export function checkTyped(input: string, answer: string): CheckResult {
  const alts = alternatives(answer);
  const expected = alts[0] ?? "";
  const got = normalize(input);
  if (!got) return { ok: false, expected };
  for (const a of alts) if (normalize(a) === got) return { ok: true, typo: false, expected: a };
  for (const a of alts) {
    const n = normalize(a);
    if (n.length >= 5 && editDistance(n, got, 1) <= 1) return { ok: true, typo: true, expected: a };
  }
  return { ok: false, expected };
}

export type ClozeSegment = { text: string } | { gap: number; answer: string; hint: string };

/**
 * Découpe un texte à trous. Syntaxes acceptées : {{réponse}}, {{réponse::indice}} et celle d'Anki
 * {{c1::réponse::indice}} (le numéro est ignoré : tous les trous sont posés en même temps).
 */
export function parseCloze(text: string): ClozeSegment[] {
  const out: ClozeSegment[] = [];
  const re = /\{\{(.+?)\}\}/gs;
  let last = 0;
  let gap = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const parts = m[1].replace(/^c\d+::/i, "").split("::");
    const answer = parts[0].trim();
    if (answer) out.push({ gap: gap++, answer, hint: (parts[1] ?? "").trim() });
    else out.push({ text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function clozeGapCount(text: string): number {
  return parseCloze(text).filter((s) => "gap" in s).length;
}

/** Texte complet, trous remplis par leurs réponses (pour l'export et la recherche). */
export function clozeFull(text: string): string {
  return parseCloze(text).map((s) => ("gap" in s ? s.answer : s.text)).join("");
}

export function checkCloze(text: string, inputs: string[]): { ok: boolean; gaps: CheckResult[] } {
  const gaps = parseCloze(text)
    .filter((s): s is { gap: number; answer: string; hint: string } => "gap" in s)
    .map((s) => checkTyped(inputs[s.gap] ?? "", s.answer));
  return { ok: gaps.length > 0 && gaps.every((g) => g.ok), gaps };
}

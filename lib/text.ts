/**
 * Outils de texte partages par la resolution de jeu et le filtrage des comparables.
 * Tout ce qui est ici a ete valide par le spike sur 15 cas reels.
 */

/** Minuscules, sans accents, sans ponctuation, espaces normalises. */
export function norm(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Corrige les confusions de glyphes classiques d'un OCR sur une tranche de boite.
 *
 * Regle non negociable : on ne touche JAMAIS a un token sans lettre.
 * Sinon on casse "FIFA 23", "Mario Kart 8", "Forza Horizon 5" — le chiffre y est
 * porteur de sens, ce n'est pas une lettre mal lue.
 */
export function fixOcrGlyphs(s: string): string {
  return s
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s*$/.test(token)) return token;
      if (!/[a-zA-Z]/.test(token)) return token;
      return token
        .replace(/0/g, 'o')
        .replace(/1/g, 'l')
        .replace(/5/g, 's')
        .replace(/8/g, 'b')
        .replace(/6/g, 'g')
        .replace(/rn/g, 'm')
        .replace(/vv/g, 'w')
        .replace(/I(?=[a-z])/g, 'l');
    })
    .join('');
}

/** Coefficient de Dice sur bigrammes. Tolerant aux fautes, sans dependance. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };

  const A = bigrams(a);
  const B = bigrams(b);
  let hits = 0;
  for (const [g, n] of A) {
    const m = B.get(g);
    if (m) hits += Math.min(n, m);
  }
  return (2 * hits) / (a.length - 1 + b.length - 1);
}

/**
 * Quelle part des mots significatifs de `needle` se retrouve dans `haystack`.
 * Plus tolerant que Dice quand l'annonce ajoute du bruit autour du titre
 * ("zelda tears of the kingdom nintendo switch complet fr").
 */
export function containment(needle: string, haystack: string): number {
  const words = needle.split(' ').filter((w) => w.length > 2);
  if (!words.length) return 0;
  return words.filter((w) => haystack.includes(w)).length / words.length;
}

export const STOP = new Set([
  'the', 'and', 'les', 'des', 'une', 'version', 'jeu', 'game', 'part', 'pour',
]);

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Arrondi au demi-euro, comme les prix affiches sur Vinted. */
export const roundHalf = (n: number) => Math.round(n * 2) / 2;

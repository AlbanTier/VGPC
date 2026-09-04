/**
 * Fournisseur bouchon. Sert a developper l'UI sans reseau et sans cle.
 *
 * Il ne renvoie pas des donnees "propres" : il reproduit exprès la salete du
 * vrai catalogue — accessoires, lots, mauvaise plateforme, prix aberrants —
 * pour que les filtres de price.ts soient exerces en developpement et pas
 * seulement en production.
 */

import type { ComparablesProvider, Listing, SearchParams } from './types';
import { norm } from '../text';

// Prix de base grossiers par famille de jeu, pour que les montants affiches
// pendant le developpement ne soient pas absurdes.
function basePrice(text: string): number {
  const t = norm(text);
  if (/pokemon|emeraude|rouge feu|zelda ocarina|metroid/.test(t)) return 85;
  if (/zelda|mario odyssey|smash|animal crossing/.test(t)) return 42;
  if (/mario kart|luigi|splatoon|pokemon ecarlate/.test(t)) return 34;
  if (/god of war|last of us|horizon|spider/.test(t)) return 22;
  if (/fifa|nba|madden|call of duty/.test(t)) return 12;
  return 27;
}

const STATUSES = ['Neuf avec étiquette', 'Très bon état', 'Bon état', 'Satisfaisant'];

export class MockProvider implements ComparablesProvider {
  readonly name = 'mock' as const;

  isAvailable() {
    return true;
  }

  unavailableReason() {
    return null;
  }

  async search({ text, limit = 40 }: SearchParams): Promise<Listing[]> {
    const base = basePrice(text);
    const rng = seeded(hash(norm(text)));
    const out: Listing[] = [];

    // Le gros du lot : de vraies annonces du bon jeu, dispersees autour du prix.
    const n = 12 + Math.floor(rng() * 10);
    for (let i = 0; i < n; i++) {
      // Distribution asymetrique : la queue haute est plus longue, comme sur
      // un catalogue d'annonces actives ou les trop cheres s'accumulent.
      const spread = rng() < 0.7 ? 0.8 + rng() * 0.35 : 1.15 + rng() * 0.6;
      const price = Math.round(base * spread * 2) / 2;
      out.push(listing(`${text} ${pick(rng, ['', 'complet', 'très bon état', 'FR', 'avec notice'])}`.trim(), price, rng));
    }

    // Le bruit que price.ts doit savoir jeter.
    out.push(listing(`Coque ${text}`, Math.round(base * 0.2), rng));
    out.push(listing(`Poster ${text}`, 6, rng));
    out.push(listing(`Lot de 3 jeux dont ${text}`, Math.round(base * 2.4), rng));
    out.push(listing(`Manette édition ${text}`, Math.round(base * 1.3), rng));
    out.push(listing(`${text} — boîte vide`, Math.round(base * 0.15), rng));
    // Outliers : l'arnaque a 2 EUR et le collector scelle.
    out.push(listing(text, 2, rng));
    out.push(listing(`${text} neuf scellé collector`, Math.round(base * 5), rng));

    return out.slice(0, limit);
  }
}

function listing(title: string, price: number, rng: () => number): Listing {
  const shipping = rng() < 0.5 ? 0 : Math.round(rng() * 5 * 2) / 2;
  return {
    id: `mock-${Math.floor(rng() * 1e9)}`,
    title,
    price,
    totalPrice: Math.round((price + shipping) * 100) / 100,
    currency: 'EUR',
    status: pick(rng, STATUSES),
    interest: Math.floor(rng() * 12),
    url: null,
    photo: null,
    source: 'mock',
  };
}

// Generateur deterministe : la meme recherche donne les memes annonces d'un
// rechargement a l'autre, sinon les prix sautent a chaque rendu et on ne peut
// rien deboguer.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

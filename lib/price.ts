/**
 * Prix conseille a partir d'annonces.
 *
 * Le point de fond, valable pour TOUTES les sources accessibles (eBay comme
 * Vinted) : on n'observe pas des ventes, on observe des annonces en ligne.
 * Une annonce en ligne est, par definition, une annonce qui ne s'est pas
 * vendue. La distribution est biaisee vers le haut. D'ou un percentile bas
 * (p35) plutot que la mediane.
 */

import { norm, containment, roundHalf } from './text';
import { conditionFactor, PRESETS, type ItemCondition } from './condition';
import type { Listing } from './providers/types';

const NOISE = [
  'coque', 'housse', 'etui', 'sacoche', 'poster', 'affiche', 'figurine', 'amiibo',
  'manette', 'joycon', 'joy con', 'cable', 'chargeur', 'protection', 'verre trempe',
  'sticker', 'autocollant', 'porte cle', 'tshirt', 't shirt', 'mug',
  'boite vide', 'boitier vide', 'sans jeu', 'notice seule', 'jaquette seule',
  'carte cadeau', 'compte', 'dematerialise', 'digital',
];

const LOT = ['lot de', 'x2 ', 'x3 ', 'bundle', 'pack de'];

export interface PriceInput {
  /** Noms connus du jeu : canonique, FR, alternatifs. */
  names: string[];
  platformKeywords: string[];
  condition?: ItemCondition;
}

export interface Comparable extends Listing {
  reason?: string;
}

export interface PriceResult {
  ok: boolean;
  reason?: string;
  sample: number;
  discarded: number;
  /**
   * Le p35 BRUT, avant application du facteur d'etat.
   * C'est lui qui permet a l'ecran 5 de recalculer un prix a chaque case cochee
   * sans rappeler l'API : le client multiplie `base` par conditionFactor().
   */
  base: number;
  advisedPrice: number;
  range: { min: number; max: number };
  fastZone: { from: number; to: number };
  /** Mediane des prix DEMANDES. Affichee pour situer, jamais comme conseil. */
  marketMedian: number;
  estimatedDays: { low: number; high: number };
  confidence: 'haute' | 'moyenne' | 'faible';
  comparables: Comparable[];
  rejected: Comparable[];
}

export function analyse(listings: Listing[], input: PriceInput): PriceResult {
  const condition = input.condition ?? PRESETS['complet-tres-bon'].condition;
  const names = input.names.filter(Boolean).map(norm);

  const kept: Comparable[] = [];
  const rejected: Comparable[] = [];

  for (const it of listings) {
    const reason = rejectReason(it, names, input.platformKeywords);
    if (reason) rejected.push({ ...it, reason });
    else kept.push(it);
  }

  const empty = {
    sample: 0, discarded: 0, base: 0, advisedPrice: 0,
    range: { min: 0, max: 0 }, fastZone: { from: 0, to: 0 },
    marketMedian: 0, estimatedDays: { low: 0, high: 0 },
    confidence: 'faible' as const, comparables: [], rejected: rejected.slice(0, 10),
  };

  if (kept.length < 4) {
    return {
      ...empty,
      ok: false,
      reason: `Seulement ${kept.length} comparable(s) exploitable(s) sur ${listings.length} annonces.`,
    };
  }

  const values = removeOutliers(kept.map((i) => i.totalPrice || i.price));
  const p = (q: number) => percentile(values, q);
  const factor = conditionFactor(condition);

  return {
    ok: true,
    sample: values.length,
    discarded: kept.length - values.length,
    base: roundHalf(p(0.35)),
    advisedPrice: roundHalf(p(0.35) * factor),
    // p10-p75 et pas p20-p60 : sur un jeu commun les prix demandes sont tres
    // resserres, une fourchette etroite ne dit rien a l'utilisateur.
    range: { min: roundHalf(p(0.1) * factor), max: roundHalf(p(0.75) * factor) },
    fastZone: { from: roundHalf(p(0.1) * factor), to: roundHalf(p(0.25) * factor) },
    marketMedian: roundHalf(p(0.5)),
    estimatedDays: estimateDays(values.length, kept),
    confidence: values.length >= 15 ? 'haute' : values.length >= 8 ? 'moyenne' : 'faible',
    comparables: kept
      .slice()
      .sort((a, b) => (a.totalPrice || a.price) - (b.totalPrice || b.price))
      .slice(0, 3),
    rejected: rejected.slice(0, 10),
  };
}

function rejectReason(item: Listing, names: string[], platformKeywords: string[]): string | null {
  const t = norm(item.title);
  if (!t) return 'titre vide';
  if (NOISE.some((n) => t.includes(n))) return 'accessoire / hors sujet';
  if (LOT.some((n) => t.includes(n))) return 'lot de plusieurs jeux';

  if (platformKeywords.length) {
    const ok = platformKeywords.some((k) => t.includes(norm(k)));
    if (!ok) return 'plateforme non confirmée';
  }

  const match = Math.max(...names.map((n) => containment(n, t)));
  if (match < 0.6) return 'titre trop éloigné';

  const price = item.totalPrice || item.price;
  if (!price || price < 1) return 'prix aberrant';

  return null;
}

/**
 * Ecart absolu median. Vire le "2 EUR arnaque" et le "450 EUR scelle collector"
 * sans se faire deplacer par eux, contrairement a un ecart-type.
 */
function removeOutliers(input: number[]): number[] {
  const sorted = input.slice().sort((a, b) => a - b);
  const med = percentile(sorted, 0.5);
  const deviations = sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = percentile(deviations, 0.5) || 1;
  return sorted.filter((v) => Math.abs(v - med) / mad <= 3.5);
}

function percentile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Proxy grossier, en attendant des vraies donnees de vente (fermees partout,
 * cf. le spike) : beaucoup de concurrence = marche sature = c'est plus long.
 */
function estimateDays(sample: number, kept: Comparable[]): { low: number; high: number } {
  const interest = kept.reduce((s, i) => s + (i.interest || 0), 0) / kept.length;
  let days = sample > 30 ? 21 : sample > 15 ? 14 : 9;
  if (interest > 5) days = Math.round(days * 0.7);
  if (interest < 1) days = Math.round(days * 1.4);
  return { low: Math.max(2, Math.round(days * 0.5)), high: days };
}

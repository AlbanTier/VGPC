/**
 * Estimation du coût d'un appel de vision.
 *
 * Claude découpe une image en blocs de 28×28 px :
 *     jetons visuels = ceil(largeur / 28) × ceil(hauteur / 28)
 *
 * Conséquence qui pilote TOUT le reste de ce fichier : le coût dépend des
 * DIMENSIONS, pas du poids du fichier. Compresser un JPEG de 4 Mo à 400 Ko ne
 * fait économiser strictement rien. Réduire 3000 px à 900 px divise le coût
 * par onze. C'est pour ça que lib/image.ts redimensionne avant l'envoi.
 */

export const VISION_MODELS = {
  'claude-haiku-4-5-20251001': { label: 'Haiku 4.5', inPerM: 1, outPerM: 5 },
  'claude-sonnet-5': { label: 'Sonnet 5', inPerM: 2, outPerM: 10 },
} as const;

export type VisionModel = keyof typeof VISION_MODELS;

export const DEFAULT_VISION_MODEL: VisionModel = 'claude-haiku-4-5-20251001';

/** Au-delà, l'API redimensionne elle-même — autant le faire avant et payer moins. */
export const MAX_LONG_EDGE = 1568;

/** Notre cible d'envoi. Suffisant pour lire une tranche, ~11× moins cher qu'une photo brute. */
export const TARGET_LONG_EDGE = 900;

export function imageTokens(width: number, height: number): number {
  // On applique le même redimensionnement que l'API pour ne pas sous-estimer.
  const long = Math.max(width, height);
  const scale = long > MAX_LONG_EDGE ? MAX_LONG_EDGE / long : 1;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  return Math.ceil(w / 28) * Math.ceil(h / 28);
}

export interface CostEstimate {
  imageTokens: number;
  inputTokens: number;
  outputTokens: number;
  /** En euros, pour un seul scan. */
  eur: number;
  /** Pour 100 scans — l'ordre de grandeur qui parle vraiment. */
  eurPer100: number;
}

const USD_TO_EUR = 0.92; // approximatif, sert à donner un ordre de grandeur

export function estimateCost(
  model: VisionModel,
  width: number,
  height: number,
  promptTokens: number,
  outputTokens = 90,
): CostEstimate {
  const img = imageTokens(width, height);
  const input = img + promptTokens;
  const m = VISION_MODELS[model];
  const usd = (input * m.inPerM + outputTokens * m.outPerM) / 1_000_000;
  const eur = usd * USD_TO_EUR;
  return {
    imageTokens: img,
    inputTokens: input,
    outputTokens,
    eur: Number(eur.toFixed(6)),
    eurPer100: Number((eur * 100).toFixed(3)),
  };
}

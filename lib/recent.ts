'use client';

/**
 * Derniers jeux consultés, gardés dans le navigateur.
 *
 * Ça sert à deux choses : le rappel "reprendre où tu en étais" sur l'accueil,
 * et à alimenter le mur de jaquettes tant que le stock Supabase est vide.
 *
 * Volontairement local : ce n'est pas une donnée qui mérite un aller-retour
 * réseau, et sa perte n'a aucune conséquence.
 */

const KEY = 'vgpc.recent';
const MAX = 12;

export interface RecentGame {
  id: number;
  name: string;
  cover: string | null;
  /** Id de plateforme IGDB. Null quand le support n'a pas encore ete choisi. */
  platformId: number | null;
  platformName: string | null;
  at: number;
}

export function readRecent(): RecentGame[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((g): g is RecentGame => Boolean(g && typeof g === 'object' && 'id' in g))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX);
  } catch {
    // Navigation privée, stockage bloqué, JSON corrompu : rien de tout ça ne
    // doit empêcher l'accueil de s'afficher.
    return [];
  }
}

export function pushRecent(game: Omit<RecentGame, 'at'>): void {
  if (typeof window === 'undefined') return;
  try {
    const next = [
      { ...game, at: Date.now() },
      ...readRecent().filter((g) => !(g.id === game.id && g.platformId === game.platformId)),
    ].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sans effet */
  }
}

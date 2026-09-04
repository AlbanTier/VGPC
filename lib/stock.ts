'use client';

import { getSupabase } from './supabase';

/**
 * Lecture du stock pour l'accueil.
 *
 * Tout est en "meilleur effort" : si Supabase n'est pas configuré, ou si le
 * schema n'a pas encore ete joue, on renvoie un stock vide plutot que de faire
 * planter la page d'accueil. Une base absente n'est pas une erreur a afficher.
 */

export interface StockSummary {
  count: number;
  covers: string[];
  /** Somme des prix conseilles figes au scan. */
  estimatedValue: number;
  /** Exemplaires dont l'etat est encore un preset non detaille. */
  toComplete: number;
  /** Vrai quand Supabase n'a pas repondu — l'UI le dit au lieu d'afficher 0. */
  unavailable: boolean;
}

const EMPTY: StockSummary = {
  count: 0, covers: [], estimatedValue: 0, toComplete: 0, unavailable: false,
};

interface Row {
  advised_price: number | null;
  condition: { fromPreset?: boolean } | null;
  games: { cover_url: string | null } | { cover_url: string | null }[] | null;
}

export async function fetchStock(): Promise<StockSummary> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY;

  try {
    const { data, error } = await supabase
      .from('items')
      .select('advised_price, condition, games(cover_url)')
      .neq('status', 'vendu')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) return { ...EMPTY, unavailable: true };

    const rows = (data ?? []) as unknown as Row[];
    const covers: string[] = [];
    let estimatedValue = 0;
    let toComplete = 0;

    for (const r of rows) {
      const game = Array.isArray(r.games) ? r.games[0] : r.games;
      if (game?.cover_url) covers.push(game.cover_url);
      if (r.advised_price) estimatedValue += Number(r.advised_price);
      if (r.condition?.fromPreset) toComplete++;
    }

    return {
      count: rows.length,
      covers,
      estimatedValue: Math.round(estimatedValue),
      toComplete,
      unavailable: false,
    };
  } catch {
    return { ...EMPTY, unavailable: true };
  }
}

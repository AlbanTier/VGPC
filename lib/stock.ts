'use client';

import { getSupabase } from './supabase';
import type { ItemCondition } from './condition';

/**
 * Lecture du stock.
 *
 * Tout est en « meilleur effort » : si Supabase n'est pas configuré, ou si le
 * schéma n'a pas encore été joué, on renvoie un stock vide plutôt que de faire
 * planter la page. Une base absente n'est pas une erreur à afficher en rouge.
 */

export type ItemStatus = 'a-lister' | 'en-ligne' | 'vendu' | 'garde';

export const STATUS_LABEL: Record<ItemStatus, string> = {
  'a-lister': 'À lister',
  'en-ligne': 'En ligne',
  vendu: 'Vendu',
  garde: 'Gardé',
};

export interface StockItem {
  id: string;
  igdbId: number;
  name: string;
  cover: string | null;
  platform: string;
  condition: ItemCondition;
  advisedPrice: number | null;
  soldPrice: number | null;
  status: ItemStatus;
  createdAt: string;
}

export interface StockSummary {
  count: number;
  covers: string[];
  /** Somme des prix conseillés figés au scan, hors vendus. */
  estimatedValue: number;
  /** Exemplaires dont l'état est encore un preset non détaillé. */
  toComplete: number;
  items: StockItem[];
  /** Vrai quand Supabase n'a pas répondu — l'UI le dit au lieu d'afficher 0. */
  unavailable: boolean;
}

const EMPTY: StockSummary = {
  count: 0, covers: [], estimatedValue: 0, toComplete: 0, items: [], unavailable: false,
};

interface Row {
  id: string;
  igdb_id: number;
  platform: string;
  condition: ItemCondition;
  advised_price: number | null;
  sold_price: number | null;
  status: ItemStatus;
  created_at: string;
  games: { name: string; french_title: string | null; cover_url: string | null }
       | { name: string; french_title: string | null; cover_url: string | null }[]
       | null;
}

export async function fetchStock(): Promise<StockSummary> {
  const supabase = getSupabase();
  if (!supabase) return EMPTY;

  try {
    const { data, error } = await supabase
      .from('items')
      .select(
        'id, igdb_id, platform, condition, advised_price, sold_price, status, created_at,' +
        ' games(name, french_title, cover_url)',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return { ...EMPTY, unavailable: true };

    const items: StockItem[] = ((data ?? []) as unknown as Row[]).map((r) => {
      const g = Array.isArray(r.games) ? r.games[0] : r.games;
      return {
        id: r.id,
        igdbId: r.igdb_id,
        name: g?.french_title ?? g?.name ?? 'Jeu inconnu',
        cover: g?.cover_url ?? null,
        platform: r.platform,
        condition: r.condition,
        advisedPrice: r.advised_price === null ? null : Number(r.advised_price),
        soldPrice: r.sold_price === null ? null : Number(r.sold_price),
        status: r.status,
        createdAt: r.created_at,
      };
    });

    const active = items.filter((i) => i.status !== 'vendu');

    return {
      count: active.length,
      covers: active.map((i) => i.cover).filter((c): c is string => Boolean(c)),
      estimatedValue: Math.round(active.reduce((s, i) => s + (i.advisedPrice ?? 0), 0)),
      toComplete: active.filter((i) => i.condition?.fromPreset).length,
      items,
      unavailable: false,
    };
  } catch {
    return { ...EMPTY, unavailable: true };
  }
}

export async function setStatus(id: string, status: ItemStatus, soldPrice?: number) {
  const res = await fetch('/api/items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, soldPrice }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? 'Mise à jour impossible');
  }
}

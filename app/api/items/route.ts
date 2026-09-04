import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getGameById } from '@/lib/igdb';
import type { ItemCondition } from '@/lib/condition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Le stock : enregistrer un exemplaire, le lister, changer son statut.
 *
 * Deux partis pris de fond :
 *
 *  1. On FIGE le prix au moment de l'enregistrement (`advised_price`,
 *     `price_range`, `price_source`, `priced_at`). On ne recalcule pas à
 *     l'affichage. C'est ce qui permettra, plus tard, de comparer ce qu'on
 *     avait conseillé à ce qui s'est réellement vendu — sans cette trace, on
 *     ne saura jamais si le p35 était le bon curseur.
 *
 *  2. La fiche du jeu est recopiée dans `games` au moment de l'enregistrement.
 *     Le stock doit rester lisible même si IGDB est indisponible : on ne veut
 *     pas d'un écran de stock vide parce qu'une API tierce est en panne.
 */

interface PostBody {
  gameId: number;
  platformId: number;
  platformName: string;
  condition: ItemCondition;
  advisedPrice: number | null;
  range: { min: number; max: number } | null;
  source: string;
}

export async function POST(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Supabase n’est pas configuré — impossible d’enregistrer.' },
      { status: 503 },
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  if (!body.gameId || !body.platformId || !body.condition) {
    return NextResponse.json(
      { error: 'gameId, platformId et condition sont requis.' },
      { status: 400 },
    );
  }

  try {
    const game = await getGameById(body.gameId);
    if (!game) return NextResponse.json({ error: 'Jeu introuvable.' }, { status: 404 });

    const { error: gameError } = await supabase.from('games').upsert(
      {
        igdb_id: game.id,
        name: game.name,
        french_title: game.frenchTitle,
        alt_names: game.altNames,
        year: game.year,
        publisher: game.publisher,
        cover_url: game.cover,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'igdb_id' },
    );
    if (gameError) throw new Error(`Enregistrement du jeu : ${gameError.message}`);

    const { data, error } = await supabase
      .from('items')
      .insert({
        igdb_id: game.id,
        platform: body.platformName,
        condition: body.condition,
        advised_price: body.advisedPrice,
        price_range: body.range,
        price_source: body.source,
        priced_at: body.advisedPrice ? new Date().toISOString() : null,
        status: 'a-lister',
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Change le statut d'un exemplaire (à lister → en ligne → vendu). */
export async function PATCH(req: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase n’est pas configuré.' }, { status: 503 });
  }

  let body: { id: string; status: string; soldPrice?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  const ALLOWED = ['a-lister', 'en-ligne', 'vendu', 'garde'];
  if (!body.id || !ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'id et statut valide requis.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === 'en-ligne') patch.listed_at = new Date().toISOString();
  if (body.status === 'vendu') {
    patch.sold_at = new Date().toISOString();
    // Le prix de vente réel : c'est LA donnée qui manque à tout le projet.
    // Toutes les sources accessibles ne donnent que des prix demandés ; ici,
    // pour la première fois, on enregistre un prix obtenu.
    if (typeof body.soldPrice === 'number') patch.sold_price = body.soldPrice;
  }

  const { error } = await supabase.from('items').update(patch).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });

  return NextResponse.json({ ok: true });
}

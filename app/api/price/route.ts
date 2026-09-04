import { NextResponse } from 'next/server';
import { getGameById, allNames } from '@/lib/igdb';
import { PLATFORMS, isPlatformKey } from '@/lib/platforms';
import { selectProvider } from '@/lib/providers';
import { analyse } from '@/lib/price';
import { PRESETS, type PresetKey, type ItemCondition } from '@/lib/condition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  gameId: number;
  platform: string;
  preset?: PresetKey;
  /** L'etat detaille prend le pas sur le preset quand il est fourni (ecran 5). */
  condition?: ItemCondition;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  if (!body.gameId || !isPlatformKey(body.platform)) {
    return NextResponse.json({ error: 'gameId et platform sont requis.' }, { status: 400 });
  }

  const platform = PLATFORMS[body.platform];
  const condition =
    body.condition ?? PRESETS[body.preset ?? 'complet-tres-bon'].condition;

  try {
    const game = await getGameById(body.gameId);
    if (!game) return NextResponse.json({ error: 'Jeu introuvable.' }, { status: 404 });

    const { provider, notice } = selectProvider();
    // On cherche sur le titre FR quand il existe : c'est celui des annonces.
    const text = `${game.frenchTitle ?? game.name} ${platform.keywords[0]}`;
    const listings = await provider.search({ text, limit: 60 });

    const result = analyse(listings, {
      names: allNames(game),
      platformKeywords: platform.keywords,
      condition,
    });

    return NextResponse.json({
      game,
      price: result,
      source: provider.name,
      // L'UI DOIT afficher ca quand c'est non nul : sinon l'utilisateur croit
      // que des chiffres simules sont des chiffres de marche.
      notice,
      queryUsed: text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from 'next/server';
import { getGameById, allNames } from '@/lib/igdb';
import { keywordsFor } from '@/lib/platforms';
import { selectProvider } from '@/lib/providers';
import { analyse } from '@/lib/price';
import { PRESETS, type PresetKey, type ItemCondition } from '@/lib/condition';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  gameId: number;
  /** Id de plateforme IGDB, choisi par l'utilisateur parmi ceux du jeu. */
  platformId: number;
  preset?: PresetKey;
  /** L'état détaillé prend le pas sur le preset quand il est fourni (écran 5). */
  condition?: ItemCondition;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  if (!body.gameId || !body.platformId) {
    return NextResponse.json({ error: 'gameId et platformId sont requis.' }, { status: 400 });
  }

  const condition = body.condition ?? PRESETS[body.preset ?? 'complet-tres-bon'].condition;

  try {
    const game = await getGameById(body.gameId);
    if (!game) return NextResponse.json({ error: 'Jeu introuvable.' }, { status: 404 });

    const platform = game.platforms.find((p) => p.id === body.platformId);
    if (!platform) {
      return NextResponse.json(
        { error: 'Ce jeu n’est pas sorti sur ce support.' },
        { status: 400 },
      );
    }

    const keywords = keywordsFor(platform);
    const { provider, notice } = selectProvider();

    // On cherche sur le titre FR quand il existe : c'est celui des annonces.
    const text = `${game.frenchTitle ?? game.name} ${keywords[0]}`;
    const listings = await provider.search({ text, limit: 60 });

    const result = analyse(listings, {
      names: allNames(game),
      platformKeywords: keywords,
      condition,
    });

    return NextResponse.json({
      game,
      platform,
      price: result,
      source: provider.name,
      // L'UI DOIT afficher ça quand c'est non nul : sinon l'utilisateur croit
      // que des chiffres simulés sont des chiffres de marché.
      notice,
      queryUsed: text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

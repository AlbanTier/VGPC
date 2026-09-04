import { NextResponse } from 'next/server';
import { getGameById } from '@/lib/igdb';
import { sortPlatforms } from '@/lib/platforms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Une fiche seule, sans analyse de prix.
 *
 * Sert à l'étape "sur quel support tu l'as ?" : on a besoin du jeu et de ses
 * plateformes avant de pouvoir chiffrer quoi que ce soit, et il serait absurde
 * d'aller chercher des comparables pour un support pas encore choisi.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!id) return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });

  try {
    const game = await getGameById(id);
    if (!game) return NextResponse.json({ error: 'Jeu introuvable.' }, { status: 404 });

    return NextResponse.json({ ...game, platforms: sortPlatforms(game.platforms) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur IGDB';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

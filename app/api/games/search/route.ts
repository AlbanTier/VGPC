import { NextResponse } from 'next/server';
import { resolveGame } from '@/lib/igdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Recherche par titre, SANS plateforme.
 *
 * Le support se choisit après, sur la fiche du jeu, parmi ceux sur lesquels
 * le jeu est réellement sorti. Demander la plateforme avant la recherche
 * obligeait à la connaître, et écartait le bon jeu quand on se trompait.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const platformId = Number(searchParams.get('platformId')) || null;

  if (q.length < 2) {
    return NextResponse.json({ error: 'Requête trop courte.' }, { status: 400 });
  }

  try {
    return NextResponse.json(await resolveGame(q, platformId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur IGDB';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

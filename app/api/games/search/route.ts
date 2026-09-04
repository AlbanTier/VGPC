import { NextResponse } from 'next/server';
import { resolveGame } from '@/lib/igdb';
import { isPlatformKey } from '@/lib/platforms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const rawPlatform = searchParams.get('platform');

  if (q.length < 2) {
    return NextResponse.json({ error: 'Requête trop courte.' }, { status: 400 });
  }
  if (rawPlatform && !isPlatformKey(rawPlatform)) {
    return NextResponse.json({ error: `Plateforme inconnue : ${rawPlatform}` }, { status: 400 });
  }

  try {
    const resolution = await resolveGame(q, rawPlatform && isPlatformKey(rawPlatform) ? rawPlatform : null);
    return NextResponse.json(resolution);
  } catch (err) {
    // On remonte le message tel quel : en dev c'est ce qui fait gagner du temps,
    // et il ne contient jamais de secret (cf. igdb.ts, les erreurs sont typees).
    const message = err instanceof Error ? err.message : 'Erreur IGDB';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

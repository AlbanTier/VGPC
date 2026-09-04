/**
 * Resolution d'un titre approximatif vers une fiche de jeu IGDB.
 *
 * Portage direct du spike, valide sur 15 cas : 13 surs, 1 a verifier, 1 non reconnu.
 * Les trois pieges trouves la-bas sont traites ici, ne les retire pas sans mesurer :
 *
 *   1. `search` d'IGDB n'est pas tolerant aux fautes -> variantes corrigees.
 *   2. `search` n'indexe que le nom canonique anglais -> passe par
 *      `alternative_names` / `game_localizations` pour les titres FR.
 *   3. Les editions speciales portent le nom du jeu de base en alias
 *      -> la penalite se calcule sur le nom canonique uniquement.
 */

import type { IgdbPlatform } from './platforms';
import { norm, fixOcrGlyphs, similarity, STOP, round2 } from './text';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_URL = 'https://api.igdb.com/v4';

export type MatchedVia = 'search' | 'search-corrige' | 'titre-fr';

export interface GameMatch {
  id: number;
  name: string;
  slug: string;
  year: number | null;
  platforms: IgdbPlatform[];
  altNames: string[];
  frenchTitle: string | null;
  publisher: string | null;
  popularity: number;
  cover: string | null;
  titleMatch: number;
  editionPenalty: number;
  score: number;
  matchedVia: MatchedVia;
  /** La requete reellement envoyee a IGDB (utile pour deboguer un OCR foireux). */
  queryUsed: string;
}

export type Confidence = 'sur' | 'a-verifier' | 'non-reconnu';

export interface Resolution {
  confidence: Confidence;
  best: GameMatch | null;
  candidates: GameMatch[];
  /** Ecart de score avec le 2e. C'est lui qui fait basculer en "a verifier". */
  gap: number;
}

// --- Auth -------------------------------------------------------------------

let cached: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) throw new Error('TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants');

  const url = `${TOKEN_URL}?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST', cache: 'no-store' });
  if (!res.ok) throw new Error(`Auth Twitch KO (${res.status})`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cached.value;
}

async function query<T>(endpoint: string, body: string): Promise<T[]> {
  const token = await getToken();
  const res = await fetch(`${IGDB_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`IGDB ${endpoint} KO (${res.status})`);
  return res.json() as Promise<T[]>;
}

// --- Requete ----------------------------------------------------------------

interface RawGame {
  id: number;
  name: string;
  slug: string;
  category?: number;
  first_release_date?: number;
  total_rating_count?: number;
  alternative_names?: { name: string }[];
  platforms?: { id: number; name: string; abbreviation?: string }[];
  game_localizations?: { name: string; region?: { name: string } }[];
  cover?: { image_id: string };
  involved_companies?: { publisher?: boolean; company?: { name: string } }[];
}

const FIELDS = [
  'name', 'slug', 'category', 'first_release_date', 'total_rating_count',
  'alternative_names.name',
  'platforms.id', 'platforms.name', 'platforms.abbreviation',
  'game_localizations.name', 'game_localizations.region.name',
  'cover.image_id',
  'involved_companies.company.name', 'involved_companies.publisher',
].join(',');

const escapeQ = (s: string) => s.replace(/["\\]/g, ' ').trim();

export async function resolveGame(
  title: string,
  platformId?: number | null,
): Promise<Resolution> {
  // Le filtre plateforme devient OPTIONNEL. Le parcours normal est
  // "je cherche un titre, puis je dis sur quel support je l'ai" — filtrer
  // trop tot obligeait a connaitre le support avant de chercher, et ecartait
  // silencieusement le bon jeu quand on se trompait de puce.
  const onPlatform = (g: RawGame) =>
    !platformId || (g.platforms ?? []).some((p) => p.id === platformId);

  let rows: RawGame[] = [];
  let via: MatchedVia = 'search';
  let queryUsed = title;

  // Passe 1 : le `search` d'IGDB, sur le titre puis ses variantes corrigees.
  for (const variant of queryVariants(title)) {
    const found = await query<RawGame>(
      'games',
      `search "${escapeQ(variant)}"; fields ${FIELDS}; limit 30;`,
    );
    const usable = found.filter(onPlatform);
    if (usable.length) {
      rows = usable;
      via = variant === title ? 'search' : 'search-corrige';
      queryUsed = variant;
      break;
    }
  }

  // Passe 2 : par titre localise FR / nom alternatif.
  if (!rows.length) {
    const byAlias = (await searchByLocalizedName(title)).filter(onPlatform);
    if (byAlias.length) {
      rows = byAlias;
      via = 'titre-fr';
    }
  }

  if (!rows.length) {
    return { confidence: 'non-reconnu', best: null, candidates: [], gap: 0 };
  }

  const candidates = rank(title, rows.map((g) => toMatch(g, via, queryUsed)));
  const best = candidates[0] ?? null;
  const gap = candidates.length > 1 ? round2(candidates[0].score - candidates[1].score) : 1;

  // Seuils cales sur les mesures du spike.
  const confidence: Confidence =
    !best ? 'non-reconnu'
      : best.score >= 0.85 && gap >= 0.1 ? 'sur'
      : best.score >= 0.55 ? 'a-verifier'
      : 'non-reconnu';

  return { confidence, best, candidates, gap };
}

function toMatch(g: RawGame, via: MatchedVia, queryUsed: string) {
  return {
    id: g.id,
    name: g.name,
    slug: g.slug,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
    platforms: (g.platforms ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      abbreviation: p.abbreviation ?? null,
    })),
    altNames: (g.alternative_names ?? []).map((a) => a.name),
    frenchTitle:
      (g.game_localizations ?? []).find((l) => /france/i.test(l.region?.name ?? ''))?.name ?? null,
    publisher: (g.involved_companies ?? []).find((c) => c.publisher)?.company?.name ?? null,
    popularity: g.total_rating_count ?? 0,
    isMainGame: g.category === 0,
    cover: g.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
      : null,
    matchedVia: via,
    queryUsed,
  };
}

/**
 * Les endpoints qui, eux, contiennent les titres FR.
 * `search` ne les voit pas : c'est ce qui faisait echouer "Pokemon Version Emeraude".
 */
async function searchByLocalizedName(title: string): Promise<RawGame[]> {
  const tokens = norm(title)
    .split(' ')
    .filter((w) => w.length > 3 && !STOP.has(w))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
  if (!tokens.length) return [];

  const ids = new Set<number>();
  for (const token of tokens) {
    // Fragment interne du mot : "emeraude" -> "meraud".
    // Sinon *"emeraude"* ne matche jamais "Emeraude" a cause du E accentue.
    const stem = escapeQ(token.length >= 6 ? token.slice(1, -1) : token);
    for (const endpoint of ['alternative_names', 'game_localizations']) {
      try {
        const hits = await query<{ game?: number }>(
          endpoint,
          `fields game; where name ~ *"${stem}"*; limit 50;`,
        );
        for (const h of hits) if (h.game) ids.add(h.game);
      } catch {
        // un endpoint qui refuse ne doit pas tuer la resolution
      }
    }
    if (ids.size > 60) break;
  }
  if (!ids.size) return [];

  return query<RawGame>('games', `fields ${FIELDS}; where id = (${[...ids].join(',')}); limit 60;`);
}

function queryVariants(title: string): string[] {
  const out = [title];
  const fixed = fixOcrGlyphs(title);
  if (fixed !== title) out.push(fixed);

  // Dernier recours : les mots les plus longs. Un titre dont un mot est
  // irrecuperable ("tne" pour "the") peut sortir sur les autres.
  const tokens = norm(fixed).split(' ').filter((w) => w.length > 3 && !STOP.has(w));
  if (tokens.length > 2) out.push(tokens.slice(0, 3).join(' '));

  return out;
}

// --- Classement -------------------------------------------------------------

const EDITION =
  /\b(edition|premium|ultimate|complete|goty|game of the year|bundle|pass|dlc|online|remaster|remastered|collection|anniversary|definitive|expansion|season|booster)\b/;

type Scored = ReturnType<typeof toMatch>;

function rank(input: string, candidates: Scored[]): GameMatch[] {
  const q = norm(input);

  const scored = candidates.map((c) => {
    const names = [c.name, c.frenchTitle, ...c.altNames].filter(Boolean).map((n) => norm(n));
    const best = Math.max(...names.map((n) => similarity(q, n)));

    // Sur le nom CANONIQUE seulement. IGDB donne a "Forza Horizon 5: Premium Edition"
    // un alias "Forza Horizon 5" : le prendre en compte annulait la penalite.
    const canonical = norm(c.name);
    let penalty = editionPenalty(q, canonical);
    if (!penalty && EDITION.test(canonical) && !EDITION.test(q)) penalty = 0.2;

    // Surtout pas de Math.min(score, 1) : ca ecrasait tout le classement
    // des qu'un titre matchait exactement.
    let score = best - penalty;
    if (c.isMainGame) score += 0.06;
    if (c.popularity > 50) score += 0.04;
    if (c.popularity > 300) score += 0.03;

    const { isMainGame, ...rest } = c;
    return {
      ...rest,
      titleMatch: round2(best),
      editionPenalty: round2(penalty),
      score: round2(score),
    } satisfies GameMatch;
  });

  scored.sort((a, b) => b.score - a.score || b.popularity - a.popularity || a.id - b.id);

  // IGDB heberge des doublons exacts (deux fiches "FIFA 23" en 2022).
  const seen = new Map<string, GameMatch>();
  for (const c of scored) {
    const key = `${norm(c.name)}|${c.year ?? ''}`;
    if (!seen.has(key)) seen.set(key, c);
  }

  return [...seen.values()].slice(0, 6);
}

/** Le candidat contient tout le titre demande PLUS des mots en trop ? */
function editionPenalty(q: string, n: string): number {
  if (n === q || !n.startsWith(q)) return 0;
  const rest = n.slice(q.length).trim();
  if (!rest) return 0;
  return EDITION.test(rest) ? 0.25 : 0.1;
}

/** Recupere une fiche par son id IGDB (la fiche jeu est adressable par URL). */
export async function getGameById(id: number): Promise<GameMatch | null> {
  const rows = await query<RawGame>('games', `fields ${FIELDS}; where id = ${id}; limit 1;`);
  if (!rows.length) return null;
  const m = toMatch(rows[0], 'search', String(id));
  const { isMainGame, ...rest } = m;
  return { ...rest, titleMatch: 1, editionPenalty: 0, score: 1 };
}

/** Tous les noms connus du jeu — c'est ce que price.ts utilise pour filtrer. */
export function allNames(g: GameMatch): string[] {
  return [g.name, g.frenchTitle, ...g.altNames].filter((n): n is string => Boolean(n));
}

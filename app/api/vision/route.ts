import { NextResponse } from 'next/server';
import { resolveGame } from '@/lib/igdb';
import {
  DEFAULT_VISION_MODEL, VISION_MODELS, MAX_LONG_EDGE,
  estimateCost, type VisionModel,
} from '@/lib/vision-cost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 10 s : c'est le plafond des fonctions sur le palier gratuit de Vercel.
// Declarer plus ne sert a rien, la plateforme coupe de toute facon.
// Haiku sur une image de 900 px repond en 2-4 s, on a de la marge.
export const maxDuration = 10;

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Photo d'une tranche de boîte -> titre -> fiche IGDB.
 *
 * Trois décisions, toutes prises pour le coût ou pour la justesse :
 *
 *  1. Haiku 4.5 par défaut, pas Sonnet. Lire du texte imprimé sur une tranche
 *     ne demande pas un gros modèle, et c'est 2× moins cher à l'entrée.
 *     VISION_MODEL=claude-sonnet-5 si jamais Haiku bafouille sur du rétro abîmé.
 *
 *  2. On demande de TRANSCRIRE, pas d'identifier. Un modèle à qui on demande
 *     "quel est ce jeu ?" comble les trous et invente des titres plausibles.
 *     IGDB ne connaît que des jeux qui existent, et resolveGame() sait déjà
 *     rattraper les glyphes mal lus. Le modèle lit, IGDB identifie.
 *
 *  3. Le prompt est court volontairement. Il part à CHAQUE appel : 200 jetons
 *     de consignes en trop, c'est 20 % de la facture d'un scan.
 */
const PROMPT = `Transcris le texte visible sur cette boîte de jeu vidéo.

JSON uniquement :
{"title":"","platformHint":null,"readable":true,"note":""}

- title : le titre tel qu'il est imprimé. Ne devine pas, ne corrige pas, ne complète pas un mot masqué.
- platformHint : le nom de la console si un logo est lisible, sinon null. Simple indication.
- readable : false si rien d'exploitable. Dans ce cas title vaut "".
- note : une phrase courte si la lecture est gênée (flou, reflet, masqué), sinon "".

N'ajoute pas la console dans le titre. Ignore éditeur, PEGI, prix, code-barres.`;

// Estimation stable du coût des consignes (elles ne changent pas d'un appel a l'autre).
const PROMPT_TOKENS = Math.ceil(PROMPT.length / 3.6);

interface Body {
  image: string;
  mediaType?: string;
  /** Dimensions apres redimensionnement client — servent a estimer le cout. */
  width?: number;
  height?: number;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY manquante — la lecture par photo est désactivée.' },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Corps de requête illisible.' }, { status: 400 });
  }

  const parsed = parseImage(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const model = pickModel();

  try {
    const { read, usage } = await transcribe(parsed.data, parsed.mediaType, model);

    // Coût réel quand l'API nous donne l'usage, estimation sinon.
    const m = VISION_MODELS[model];
    const cost = usage
      ? {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          eur: Number(
            (((usage.input_tokens * m.inPerM + usage.output_tokens * m.outPerM) / 1e6) * 0.92)
              .toFixed(6),
          ),
        }
      : estimateCost(model, body.width ?? 900, body.height ?? 675, PROMPT_TOKENS);

    if (!read.readable || !read.title.trim()) {
      return NextResponse.json({
        read,
        resolution: null,
        model: m.label,
        cost,
        hint: read.note || 'Rien de lisible. Rapproche-toi de la tranche, à plat et bien éclairée.',
      });
    }

    // Pas de filtre plateforme : l'utilisateur choisira le support sur la fiche,
    // parmi ceux ou le jeu est reellement sorti. Le logo lu n'est qu'un indice
    // affiche, jamais un filtre — un logo mal lu ecarterait le bon jeu.
    const resolution = await resolveGame(read.title);

    return NextResponse.json({ read, resolution, model: m.label, cost, hint: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur de lecture';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function pickModel(): VisionModel {
  const wanted = process.env.VISION_MODEL as VisionModel | undefined;
  return wanted && wanted in VISION_MODELS ? wanted : DEFAULT_VISION_MODEL;
}

function parseImage(body: Body): { data: string; mediaType: string } | { error: string } {
  if (!body.image) return { error: 'Aucune image reçue.' };

  let data = body.image;
  let mediaType = body.mediaType ?? 'image/jpeg';

  const dataUrl = /^data:([^;]+);base64,(.*)$/s.exec(data);
  if (dataUrl) {
    mediaType = dataUrl[1];
    data = dataUrl[2];
  }

  if (!ACCEPTED.includes(mediaType as (typeof ACCEPTED)[number])) {
    return { error: `Format non géré : ${mediaType}. Utilise JPEG, PNG ou WebP.` };
  }

  // 2 Mo : une image preparee par lib/image.ts pese ~80 Ko. Au-dela, c'est que
  // le redimensionnement client n'a pas eu lieu — et on paierait plein pot.
  if (data.length * 0.75 > MAX_BYTES) {
    return {
      error: 'Image non redimensionnée avant l’envoi — refusée pour ne pas gonfler la facture.',
    };
  }

  if (body.width && body.height && Math.max(body.width, body.height) > MAX_LONG_EDGE) {
    return { error: `Image trop grande (${body.width}×${body.height}). Redimensionne à ${MAX_LONG_EDGE} px maximum.` };
  }

  return { data, mediaType };
}

interface Read {
  title: string;
  platformHint: string | null;
  readable: boolean;
  note: string;
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
}

async function transcribe(
  data: string,
  mediaType: string,
  model: VisionModel,
): Promise<{ read: Read; usage: Usage | null }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      // La reponse attendue fait ~60 jetons. 200 laisse de la marge sans
      // laisser le modele partir en explications.
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('[vision]', res.status, detail.slice(0, 500));
    if (res.status === 401) throw new Error('Clé Anthropic refusée (401).');
    if (res.status === 429) throw new Error('Trop de requêtes — réessaie dans un instant.');
    throw new Error(`Lecture d’image indisponible (${res.status}).`);
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: Usage;
  };
  const text = json.content?.find((c) => c.type === 'text')?.text ?? '';

  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) throw new Error('Réponse de lecture illisible.');

  const read = JSON.parse(match[0]) as Partial<Read>;
  return {
    read: {
      title: String(read.title ?? ''),
      platformHint: read.platformHint ? String(read.platformHint) : null,
      readable: Boolean(read.readable),
      note: String(read.note ?? ''),
    },
    usage: json.usage ?? null,
  };
}

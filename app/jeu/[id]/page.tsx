'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { PRESETS, PRESET_KEYS, type PresetKey } from '@/lib/condition';
import type { GameMatch } from '@/lib/igdb';
import type { IgdbPlatform } from '@/lib/platforms';
import type { PriceResult } from '@/lib/price';
import { pushRecent } from '@/lib/recent';

interface PricePayload {
  game: GameMatch;
  platform: IgdbPlatform;
  price: PriceResult;
  notice: string | null;
  source: string;
}

/**
 * Fiche jeu.
 *
 * Deux temps, et c'est volontaire :
 *   1. sans `?p=`, on demande sur QUEL SUPPORT l'exemplaire est détenu,
 *      parmi ceux sur lesquels le jeu est réellement sorti ;
 *   2. avec `?p=`, on chiffre.
 *
 * Demander le support avant la recherche obligeait à le connaître, et écartait
 * silencieusement le bon jeu en cas d'erreur de puce. Là, la liste proposée est
 * garantie juste : elle vient d'IGDB, pour ce jeu précis.
 */
export default function FicheJeu() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();

  const platformId = Number(params.get('p')) || null;
  // Retour depuis le stock : on n'a que le nom du support, on retrouve son id.
  const platformName = params.get('pn');

  const [game, setGame] = useState<GameMatch | null>(null);
  const [gameError, setGameError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/games/${id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Erreur');
        return json as GameMatch;
      })
      .then((g) => {
        if (cancelled) return;
        setGame(g);
        if (!platformId && platformName) {
          const match = g.platforms.find((p) => p.name === platformName);
          if (match) router.replace(`/jeu/${id}?p=${match.id}`);
        }
      })
      .catch((e) => !cancelled && setGameError(e instanceof Error ? e.message : 'Erreur'));
    return () => { cancelled = true; };
  }, [id, platformId, platformName, router]);

  return (
    <main className="safe-top px-4 pb-28">
      <button onClick={() => router.back()} className="mb-4 mt-2 text-sm text-muted">
        ← Retour
      </button>

      {gameError && <p className="card border-unknown/40 p-4 text-sm text-unknown">{gameError}</p>}
      {!game && !gameError && <div className="card h-32 animate-pulse" />}

      {game && (
        <>
          <header className="mb-5 flex gap-3">
            {game.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.cover} alt="" className="h-24 w-[72px] rounded-xl object-cover" />
            ) : (
              <div className="h-24 w-[72px] rounded-xl bg-line" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-bold leading-tight">
                {game.frenchTitle ?? game.name}
              </h1>
              {game.frenchTitle && <p className="truncate text-sm text-muted">{game.name}</p>}
              <p className="mt-1 text-xs text-muted">
                {game.year} · {game.publisher ?? 'éditeur inconnu'}
              </p>
            </div>
          </header>

          {platformId ? (
            <Priced gameId={Number(id)} platformId={platformId} game={game} />
          ) : (
            <PlatformPicker
              game={game}
              onPick={(p) => router.replace(`/jeu/${id}?p=${p.id}`)}
            />
          )}
        </>
      )}
    </main>
  );
}

/** Étape 1 : sur quel support tu l'as ? */
function PlatformPicker({ game, onPick }: { game: GameMatch; onPick: (p: IgdbPlatform) => void }) {
  if (!game.platforms.length) {
    return (
      <div className="card p-4">
        <p className="font-display font-bold text-todo">Aucun support connu</p>
        <p className="mt-1 text-sm text-muted">
          IGDB ne liste aucune plateforme pour ce jeu. Reviens en arrière et choisis
          une autre fiche.
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2 className="mb-1 font-display text-base font-bold">Sur quel support tu l’as ?</h2>
      <p className="mb-4 text-sm text-muted">
        {game.platforms.length} version{game.platforms.length > 1 ? 's' : ''} existe
        {game.platforms.length > 1 ? 'nt' : ''} — les prix n’ont souvent rien à voir
        d’un support à l’autre.
      </p>

      <div className="flex flex-wrap gap-2">
        {game.platforms.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className="chip h-11 bg-card px-4 text-sm text-ink active:scale-[0.97]"
          >
            {p.name}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Étape 2 : le prix, pour le support choisi. */
function Priced({
  gameId, platformId, game,
}: {
  gameId: number; platformId: number; game: GameMatch;
}) {
  const router = useRouter();
  const [preset, setPreset] = useState<PresetKey>('complet-tres-bon');
  const [data, setData] = useState<PricePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, platformId, preset }),
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Erreur');
        return json as PricePayload;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        pushRecent({
          id: json.game.id,
          name: json.game.frenchTitle ?? json.game.name,
          cover: json.game.cover,
          platformId: json.platform.id,
          platformName: json.platform.name,
        });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [gameId, platformId, preset]);

  const platform = data?.platform ?? game.platforms.find((p) => p.id === platformId);

  async function quickSave() {
    if (!data?.platform) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          platformId,
          platformName: data.platform.name,
          // fromPreset reste a true : c'est ce qui alimente le compteur
          // "a completer" du stock. Un ajout rapide s'assume comme approximatif.
          condition: PRESETS[preset].condition,
          advisedPrice: data.price.ok ? data.price.advisedPrice : null,
          range: data.price.ok ? data.price.range : null,
          source: data.source,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Enregistrement impossible');
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-5 flex items-center gap-2">
        <span className="chip chip-on">{platform?.name ?? 'Support'}</span>
        <button
          onClick={() => router.replace(`/jeu/${gameId}`)}
          className="text-xs text-muted underline underline-offset-2"
        >
          changer de support
        </button>
      </div>

      {error && <p className="card border-unknown/40 p-4 text-sm text-unknown">{error}</p>}

      {data?.notice && (
        <p className="card mb-4 border-todo/40 p-3 text-xs text-todo">{data.notice}</p>
      )}

      <div className="mb-5">
        <p className="mb-2 text-sm font-semibold">État de ton exemplaire</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={`chip ${preset === key ? 'chip-on' : ''}`}
            >
              {PRESETS[key].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card h-48 animate-pulse" />
      ) : data?.price.ok ? (
        <>
          <PriceCard price={data.price} />

          {saveError && <p className="mt-3 text-center text-xs text-unknown">{saveError}</p>}

          <button
            onClick={quickSave}
            disabled={saving || saved}
            className={`btn-action mt-3 ${saved ? 'bg-money text-bg' : 'bg-ink text-bg'}`}
          >
            {saved ? 'Ajouté au stock ✓' : saving ? 'Enregistrement…' : 'Ajouter au stock'}
          </button>

          {saved ? (
            <button
              onClick={() => router.push('/stock')}
              className="btn-action mt-2 border border-line text-ink"
            >
              Voir mon stock
            </button>
          ) : (
            <button
              onClick={() => router.push(`/jeu/${gameId}/etat?p=${platformId}&preset=${preset}`)}
              className="btn-action mt-2 border border-line text-ink"
            >
              Détailler l’état — boîte en main
            </button>
          )}
        </>
      ) : data ? (
        <div className="card p-4">
          <p className="font-display font-bold text-todo">Pas assez de comparables</p>
          <p className="mt-1 text-sm text-muted">{data.price.reason}</p>
          <p className="mt-2 text-xs text-muted">
            Mieux vaut ne rien afficher qu’un prix inventé sur trois annonces.
          </p>
        </div>
      ) : null}
    </>
  );
}

function PriceCard({ price }: { price: PriceResult }) {
  return (
    <section className="space-y-3">
      <div className="card p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Prix conseillé</p>
        <p className="num mt-1 text-4xl text-money">{price.advisedPrice} €</p>

        <div className="mt-4 space-y-2 text-sm">
          <Row label="Fourchette" value={`${price.range.min} – ${price.range.max} €`} />
          <Row label="Part vite" value={`${price.fastZone.from} – ${price.fastZone.to} €`} tone="text-money" />
          <Row
            label="Délai estimé"
            value={`${price.estimatedDays.low} – ${price.estimatedDays.high} jours`}
            tone="text-time"
          />
        </div>

        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          {price.sample} annonces retenues
          {price.discarded > 0 && ` · ${price.discarded} aberrantes écartées`} · confiance{' '}
          {price.confidence}
          <br />
          Médiane des prix <em>demandés</em> : {price.marketMedian} € — les annonces encore
          en ligne sont celles qui ne se sont pas vendues.
        </p>
      </div>

      {price.comparables.length > 0 && (
        <div className="card p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">Les moins chères en ligne</p>
          <ul className="space-y-2.5">
            {price.comparables.map((c) => (
              <li key={c.id} className="flex items-baseline gap-3">
                <span className="num w-16 shrink-0 text-sm">{c.totalPrice} €</span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{c.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className={`num text-base ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

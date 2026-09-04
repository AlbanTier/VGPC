'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { PLATFORMS, isPlatformKey } from '@/lib/platforms';
import { PRESETS, PRESET_KEYS, type PresetKey } from '@/lib/condition';
import type { GameMatch } from '@/lib/igdb';
import type { PriceResult } from '@/lib/price';
import { pushRecent } from '@/lib/recent';

interface Payload {
  game: GameMatch;
  price: PriceResult;
  source: string;
  notice: string | null;
  queryUsed: string;
}

export default function FicheJeu() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();

  const platform = params.get('platform');
  const [preset, setPreset] = useState<PresetKey>('complet-tres-bon');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!platform || !isPlatformKey(platform)) {
      setError('Plateforme manquante ou inconnue.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: Number(id), platform, preset }),
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Erreur');
        return json as Payload;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        // Alimente le mur de l'accueil et la reprise "derniers scans".
        pushRecent({
          id: json.game.id,
          name: json.game.frenchTitle ?? json.game.name,
          cover: json.game.cover,
          platform: platform as string,
        });
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id, platform, preset]);

  return (
    <main className="safe-top px-4 pb-28">
      <button onClick={() => router.back()} className="mb-4 mt-2 text-sm text-muted">
        ← Retour
      </button>

      {error && <p className="card border-unknown/40 p-4 text-sm text-unknown">{error}</p>}

      {data && (
        <>
          <header className="mb-5 flex gap-3">
            {data.game.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.game.cover} alt="" className="h-24 w-[72px] rounded-xl object-cover" />
            ) : (
              <div className="h-24 w-[72px] rounded-xl bg-line" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-bold leading-tight">
                {data.game.frenchTitle ?? data.game.name}
              </h1>
              {data.game.frenchTitle && (
                <p className="truncate text-sm text-muted">{data.game.name}</p>
              )}
              <p className="mt-1 text-xs text-muted">
                {PLATFORMS[platform as keyof typeof PLATFORMS]?.label} · {data.game.year}
              </p>
            </div>
          </header>

          {/* Avertissement non negociable : sans lui l'utilisateur prend des
              chiffres simules pour des chiffres de marche. */}
          {data.notice && (
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
          ) : data.price.ok ? (
            <>
              <PriceCard price={data.price} />
              <button
                onClick={() => router.push(`/jeu/${id}/etat?platform=${platform}&preset=${preset}`)}
                className="btn-action mt-3 border border-line text-ink"
              >
                Détailler l’état — boîte en main
              </button>
            </>
          ) : (
            <div className="card p-4">
              <p className="font-display font-bold text-todo">Pas assez de comparables</p>
              <p className="mt-1 text-sm text-muted">{data.price.reason}</p>
              <p className="mt-2 text-xs text-muted">
                Mieux vaut ne rien afficher qu’un prix inventé sur trois annonces.
              </p>
            </div>
          )}
        </>
      )}

      {loading && !data && <div className="card h-64 animate-pulse" />}
    </main>
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
          <Row
            label="Part vite"
            value={`${price.fastZone.from} – ${price.fastZone.to} €`}
            tone="text-money"
          />
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
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">
            Les moins chères en ligne
          </p>
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

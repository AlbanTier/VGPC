'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PLATFORMS, PLATFORM_KEYS, type PlatformKey } from '@/lib/platforms';
import type { Resolution } from '@/lib/igdb';

// Les plateformes qu'on propose d'emblee. Le reste est derriere "Autres" :
// afficher 15 puces sur un ecran de 390px, personne ne clique.
const PRIMARY: PlatformKey[] = ['switch', 'ps5', 'ps4', 'xboxsx', '3ds', 'gba'];

export default function Accueil() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<PlatformKey>('switch');
  const [showAll, setShowAll] = useState(false);
  const [res, setRes] = useState<Resolution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setLoading(true);
    setError(null);
    setRes(null);
    try {
      const r = await fetch(`/api/games/search?q=${encodeURIComponent(q)}&platform=${platform}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Recherche impossible');
      setRes(json as Resolution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  const open = (gameId: number) => router.push(`/jeu/${gameId}?platform=${platform}`);

  const platforms = showAll ? PLATFORM_KEYS : PRIMARY;

  return (
    <main className="safe-top safe-bottom px-4 pb-10">
      <header className="mb-6 pt-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">VGPC</h1>
        <p className="mt-1 text-sm text-muted">
          Trouve le jeu, sors le bon prix, publie l’annonce.
        </p>
      </header>

      {/* Les deux entrees de scan des maquettes. Desactivees tant que la vision
          n'est pas branchee — mais visibles, pour que la place soit tenue. */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          disabled
          className="card flex h-28 flex-col items-start justify-end p-4 text-left opacity-40"
        >
          <span className="font-display text-base font-bold">Scanner un lot</span>
          <span className="text-xs text-muted">bientôt</span>
        </button>
        <button
          disabled
          className="card flex h-28 flex-col items-start justify-end p-4 text-left opacity-40"
        >
          <span className="font-display text-base font-bold">Scanner un jeu</span>
          <span className="text-xs text-muted">bientôt</span>
        </button>
      </div>

      <form onSubmit={search} className="mb-4">
        <label htmlFor="q" className="mb-2 block text-sm font-semibold">
          Chercher un jeu
        </label>
        <input
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pokémon Version Émeraude"
          autoComplete="off"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3.5
                     text-ink placeholder:text-muted/60 outline-none
                     focus:border-ink/30"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {platforms.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPlatform(key)}
              className={`chip ${platform === key ? 'chip-on' : ''}`}
            >
              {PLATFORMS[key].label}
            </button>
          ))}
          {!showAll && (
            <button type="button" onClick={() => setShowAll(true)} className="chip">
              Autres…
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || q.trim().length < 2}
          className="btn-action mt-4 bg-ink text-bg"
        >
          {loading ? 'Recherche…' : 'Chercher'}
        </button>
      </form>

      {error && (
        <p className="card border-unknown/40 p-4 text-sm text-unknown">{error}</p>
      )}

      {res && <Results res={res} onOpen={open} />}
    </main>
  );
}

function Results({ res, onOpen }: { res: Resolution; onOpen: (id: number) => void }) {
  if (res.confidence === 'non-reconnu' || !res.best) {
    return (
      <div className="card p-4">
        <p className="font-display text-base font-bold text-unknown">Non reconnu</p>
        <p className="mt-1 text-sm text-muted">
          Aucun jeu ne correspond sur cette plateforme. Vérifie la plateforme, ou tape
          le titre autrement.
        </p>
      </div>
    );
  }

  const others = res.candidates.slice(1, 4);

  return (
    <section className="space-y-3">
      {/* Le badge de confiance vient directement des seuils mesures dans le spike. */}
      <div className="flex items-center gap-2">
        <span
          className={`chip chip-on ${res.confidence === 'sur' ? 'text-money' : 'text-todo'}`}
        >
          {res.confidence === 'sur' ? 'Sûr' : 'À vérifier'}
        </span>
        <span className="text-xs text-muted">écart {res.gap}</span>
      </div>

      <button
        onClick={() => onOpen(res.best!.id)}
        className="card flex w-full gap-3 p-3 text-left active:scale-[0.99]"
      >
        <Cover url={res.best.cover} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold">{res.best.name}</p>
          {res.best.frenchTitle && (
            <p className="truncate text-sm text-muted">{res.best.frenchTitle}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            {res.best.year} · {res.best.publisher ?? 'éditeur inconnu'}
          </p>
        </div>
      </button>

      {others.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Ce n’est pas ça ?</p>
          <div className="space-y-2">
            {others.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="card flex w-full items-center gap-3 p-2.5 text-left active:scale-[0.99]"
              >
                <Cover url={c.cover} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.name}</p>
                  <p className="text-xs text-muted">{c.year}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Cover({ url, small }: { url: string | null; small?: boolean }) {
  const size = small ? 'h-12 w-9' : 'h-20 w-[60px]';
  if (!url) return <div className={`${size} shrink-0 rounded-lg bg-line`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={`${size} shrink-0 rounded-lg object-cover`} />;
}

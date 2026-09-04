'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoverWall } from '@/components/CoverWall';
import { readRecent, type RecentGame } from '@/lib/recent';
import { fetchStock, type StockSummary } from '@/lib/stock';
import type { Resolution } from '@/lib/igdb';

export default function Accueil() {
  const router = useRouter();
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [recent, setRecent] = useState<RecentGame[]>([]);

  useEffect(() => {
    setRecent(readRecent());
    fetchStock().then(setStock);
  }, []);

  // Le mur montre le stock d'abord, puis les jeux consultés pour qu'il ne
  // reste pas désespérément vide avant le premier enregistrement.
  const covers = [
    ...(stock?.covers ?? []),
    ...recent.map((r) => r.cover).filter((c): c is string => Boolean(c)),
  ].filter((c, i, a) => a.indexOf(c) === i);

  return (
    <div className="relative min-h-dvh">
      <CoverWall covers={covers} />

      <main className="safe-top relative z-10 px-3 pb-40">
        <header className="pb-7 pt-12 text-center">
          <h1
            className="font-display text-[2.75rem] font-bold leading-none tracking-tight"
            style={{ textShadow: '0 2px 24px rgba(10,11,15,0.9)' }}
          >
            VGPC
          </h1>
          <p className="mt-2 text-sm text-ink/70" style={{ textShadow: '0 1px 12px rgba(10,11,15,0.9)' }}>
            Scanne un jeu, sors le bon prix, publie l’annonce.
          </p>
        </header>

        <div className="rounded-3xl border border-line/70 bg-bg/70 p-3.5 backdrop-blur-xl">
        <StockStrip stock={stock} recentCount={recent.length} />

        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <ScanCard
            title="Scanner un lot"
            subtitle="une étagère entière"
            onClick={() => router.push('/scan?mode=lot')}
          />
          <ScanCard
            title="Scanner un jeu"
            subtitle="boîte en main"
            onClick={() => router.push('/scan')}
            primary
          />
        </div>

        <Search onOpen={(id) => router.push(`/jeu/${id}`)} />
        </div>

        {recent.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 px-1 text-xs uppercase tracking-wide text-muted">Derniers scans</h2>
            <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1">
              {recent.map((g) => (
                <button
                  key={`${g.id}-${g.platformId ?? 'x'}`}
                  onClick={() =>
                    router.push(g.platformId ? `/jeu/${g.id}?p=${g.platformId}` : `/jeu/${g.id}`)
                  }
                  className="w-[84px] shrink-0 text-left active:scale-[0.97]"
                >
                  {g.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.cover} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                  ) : (
                    <div className="aspect-[3/4] w-full rounded-lg bg-card" />
                  )}
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight text-muted">{g.name}</p>
                  {g.platformName && (
                    <p className="text-[10px] leading-tight text-muted/70">{g.platformName}</p>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/** Bandeau de stats. Dit la vérité quand il n'y a rien, plutôt que d'afficher des zéros muets. */
function StockStrip({ stock, recentCount }: { stock: StockSummary | null; recentCount: number }) {
  if (!stock) return <div className="card h-[68px] animate-pulse" />;

  if (stock.unavailable) {
    return (
      <p className="card border-todo/40 p-3 text-center text-xs text-todo">
        Base de données injoignable — le stock ne s’affiche pas, le reste fonctionne.
      </p>
    );
  }

  if (stock.count === 0) {
    return (
      <p className="card p-3.5 text-center text-xs leading-relaxed text-muted">
        {recentCount > 0
          ? 'Ton mur se remplit avec les jeux que tu consultes. Enregistre-en un pour qu’il compte vraiment.'
          : 'Ton mur est vide. Chaque jeu scanné vient s’y ajouter.'}
      </p>
    );
  }

  return (
    <div className="card grid grid-cols-3 divide-x divide-line p-3.5">
      <Stat value={String(stock.count)} label={stock.count > 1 ? 'jeux' : 'jeu'} />
      <Stat value={`${stock.estimatedValue} €`} label="valeur estimée" tone="text-money" />
      <Stat
        value={String(stock.toComplete)}
        label="à compléter"
        tone={stock.toComplete > 0 ? 'text-todo' : undefined}
      />
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="px-2 text-center">
      <p className={`num text-lg leading-tight ${tone ?? ''}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function ScanCard({
  title, subtitle, onClick, primary,
}: {
  title: string; subtitle: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-28 flex-col items-start justify-end rounded-2xl border p-4 text-left
                  transition-transform active:scale-[0.98]
                  ${primary
                    ? 'border-transparent bg-ink text-bg'
                    : 'border-line bg-card'}`}
    >
      <span className="whitespace-nowrap font-display text-[15px] font-bold leading-tight">{title}</span>
      <span className={`text-xs ${primary ? 'text-bg/60' : 'text-muted'}`}>{subtitle}</span>
    </button>
  );
}

function Search({ onOpen }: { onOpen: (id: number) => void }) {
  const [q, setQ] = useState('');
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
      const r = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? 'Recherche impossible');
      setRes(json as Resolution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-4">
      <form onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un jeu par son titre"
          aria-label="Chercher un jeu"
          autoComplete="off"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3.5
                     text-ink placeholder:text-muted/60 outline-none focus:border-ink/30"
        />
        {q.trim().length >= 2 && (
          <button type="submit" disabled={loading} className="btn-action mt-3 bg-ink text-bg">
            {loading ? 'Recherche…' : 'Chercher'}
          </button>
        )}
      </form>

      {error && <p className="card mt-4 border-unknown/40 p-4 text-sm text-unknown">{error}</p>}

      {res && (
        <div className="mt-4 space-y-2.5">
          {!res.best ? (
            <div className="card p-4">
              <p className="font-display font-bold text-unknown">Non reconnu</p>
              <p className="mt-1 text-sm text-muted">
                Aucun jeu ne porte ce titre. Vérifie l’orthographe, ou essaie le titre anglais.
              </p>
            </div>
          ) : (
            <>
              <p className="px-1 text-xs text-muted">
                Choisis le jeu — tu diras ensuite sur quel support tu l’as.
              </p>
              {res.candidates.slice(0, 5).map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                  className="card flex w-full gap-3 p-3 text-left active:scale-[0.99]"
                >
                  {c.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.cover}
                      alt=""
                      className={`${i === 0 ? 'h-[76px] w-[57px]' : 'h-14 w-[42px]'} shrink-0 rounded-lg object-cover`}
                    />
                  ) : (
                    <div className={`${i === 0 ? 'h-[76px] w-[57px]' : 'h-14 w-[42px]'} shrink-0 rounded-lg bg-line`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-display font-bold ${i === 0 ? 'text-base' : 'text-sm'}`}>
                      {c.frenchTitle ?? c.name}
                    </p>
                    <p className="text-xs text-muted">
                      {c.year} · {c.publisher ?? 'éditeur inconnu'}
                    </p>
                    {/* Les supports, en aperçu : c'est ce qui permet de
                        reconnaître le bon jeu du premier coup d'œil. */}
                    <p className="mt-1 truncate text-[11px] text-muted/80">
                      {c.platforms.length
                        ? c.platforms.map((p) => p.abbreviation ?? p.name).slice(0, 5).join(' · ')
                        : 'support inconnu'}
                      {c.platforms.length > 5 && ` +${c.platforms.length - 5}`}
                    </p>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
}

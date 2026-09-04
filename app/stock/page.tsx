'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchStock, setStatus, STATUS_LABEL, type StockSummary, type StockItem, type ItemStatus } from '@/lib/stock';
import { isSupabaseConfigured } from '@/lib/supabase';
import { describeCondition } from '@/lib/condition';

/**
 * Écran 7 — mon stock.
 *
 * Trois situations distinguées plutôt qu'un zéro muet : pas configuré,
 * injoignable, ou réellement vide. Un utilisateur qui voit « 0 jeu » alors que
 * sa base est en panne perd sa confiance dans l'app entière.
 */
export default function Stock() {
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [filter, setFilter] = useState<ItemStatus | 'tous'>('tous');
  const configured = isSupabaseConfigured();

  const reload = useCallback(() => { fetchStock().then(setStock); }, []);
  useEffect(() => { reload(); }, [reload]);

  const items = stock?.items ?? [];
  const shown = filter === 'tous' ? items : items.filter((i) => i.status === filter);

  return (
    <main className="safe-top px-4 pb-28">
      <header className="pb-5 pt-10">
        <h1 className="font-display text-2xl font-bold leading-tight">Mon stock</h1>
        <p className="mt-1.5 text-sm text-muted">Ce que tu as en main, et ce que ça vaut.</p>
      </header>

      {!configured ? (
        <Notice tone="todo">
          Supabase n’est pas configuré. Renseigne <code>NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </Notice>
      ) : !stock ? (
        <div className="card h-32 animate-pulse" />
      ) : stock.unavailable ? (
        <Notice tone="unknown">
          Base injoignable. Vérifie que <code>supabase/schema.sql</code> a bien été joué —
          sans les tables, la requête échoue.
        </Notice>
      ) : items.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-display text-base font-bold">Rien en stock</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Cherche un jeu, choisis ton support, et ajoute-le. Il apparaîtra ici et
            sur le mur de l’accueil.
          </p>
          <Link href="/" className="btn-action mt-4 flex items-center justify-center border border-line text-ink">
            Chercher un jeu
          </Link>
        </div>
      ) : (
        <>
          <div className="card mb-4 grid grid-cols-3 divide-x divide-line p-4">
            <Stat value={String(stock.count)} label="en stock" />
            <Stat value={`${stock.estimatedValue} €`} label="valeur estimée" tone="text-money" />
            <Stat
              value={String(stock.toComplete)}
              label="à compléter"
              tone={stock.toComplete ? 'text-todo' : undefined}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(['tous', 'a-lister', 'en-ligne', 'vendu'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`chip ${filter === f ? 'chip-on' : ''}`}
              >
                {f === 'tous' ? 'Tous' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>

          <ul className="space-y-2.5">
            {shown.map((item) => (
              <ItemRow key={item.id} item={item} onChanged={reload} />
            ))}
          </ul>

          {shown.length === 0 && (
            <p className="card p-4 text-center text-sm text-muted">
              Rien dans cette catégorie.
            </p>
          )}
        </>
      )}
    </main>
  );
}

function ItemRow({ item, onChanged }: { item: StockItem; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(status: ItemStatus) {
    setBusy(true);
    setError(null);
    try {
      // Sur "vendu", on enregistre le prix conseillé comme prix de vente par
      // défaut. C'est faux la moitié du temps, mais c'est modifiable, et ça
      // vaut mieux que pas de donnée du tout : ce champ est le SEUL prix
      // réellement obtenu que le projet verra jamais.
      await setStatus(item.id, status, status === 'vendu' ? item.advisedPrice ?? undefined : undefined);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const sold = item.status === 'vendu';

  return (
    <li className={`card p-3 ${sold ? 'opacity-60' : ''}`}>
      <div className="flex gap-3">
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt="" className="h-[68px] w-[51px] shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-[68px] w-[51px] shrink-0 rounded-lg bg-line" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold">{item.name}</p>
          <p className="truncate text-xs text-muted">{item.platform}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {item.condition ? describeCondition(item.condition) : '—'}
            {item.condition?.fromPreset && <span className="text-todo"> · à compléter</span>}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className={`num text-base ${sold ? 'text-muted' : 'text-money'}`}>
            {sold ? item.soldPrice ?? item.advisedPrice : item.advisedPrice} €
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
            {STATUS_LABEL[item.status]}
          </p>
        </div>
      </div>

      {!sold && (
        <div className="mt-2.5 flex gap-2 border-t border-line pt-2.5">
          {item.status !== 'en-ligne' && (
            <Action onClick={() => change('en-ligne')} busy={busy}>Mise en ligne</Action>
          )}
          <Action onClick={() => change('vendu')} busy={busy} tone="text-money">Vendu</Action>
          <Link
            href={`/jeu/${item.igdbId}?pn=${encodeURIComponent(item.platform)}`}
            className="ml-auto self-center text-xs text-muted underline underline-offset-2"
          >
            revoir le prix
          </Link>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-unknown">{error}</p>}
    </li>
  );
}

function Action({
  onClick, busy, tone, children,
}: {
  onClick: () => void; busy: boolean; tone?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-lg border border-line px-3 py-1.5 text-xs disabled:opacity-40 ${tone ?? 'text-ink'}`}
    >
      {children}
    </button>
  );
}

function Notice({ tone, children }: { tone: 'todo' | 'unknown'; children: React.ReactNode }) {
  const border = tone === 'todo' ? 'border-todo/40' : 'border-unknown/40';
  const text = tone === 'todo' ? 'text-todo' : 'text-unknown';
  return (
    <div className={`card ${border} p-4`}>
      <p className={`text-sm leading-relaxed ${text} [&_code]:rounded [&_code]:bg-bg/60 [&_code]:px-1 [&_code]:text-[11px]`}>
        {children}
      </p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="px-2 text-center">
      <p className={`num text-xl leading-tight ${tone ?? ''}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchStock, type StockSummary } from '@/lib/stock';
import { isSupabaseConfigured } from '@/lib/supabase';

/**
 * Écran 7 — mon stock.
 *
 * Pour l'instant il ne fait que lire : l'enregistrement d'un exemplaire n'est
 * pas encore branché, donc la table est vide. La page distingue les trois
 * situations plutôt que d'afficher un zéro qui ne dit rien : pas configuré,
 * injoignable, ou réellement vide.
 */
export default function Stock() {
  const [stock, setStock] = useState<StockSummary | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    fetchStock().then(setStock);
  }, []);

  return (
    <main className="safe-top px-4 pb-28">
      <header className="pb-5 pt-10">
        <h1 className="font-display text-2xl font-bold leading-tight">Mon stock</h1>
        <p className="mt-1.5 text-sm text-muted">Ce que tu as en main, et ce que ça vaut.</p>
      </header>

      {!configured ? (
        <Notice tone="todo">
          Supabase n’est pas configuré. Renseigne <code>NEXT_PUBLIC_SUPABASE_URL</code> et{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, puis joue{' '}
          <code>supabase/schema.sql</code> dans l’éditeur SQL du projet.
        </Notice>
      ) : !stock ? (
        <div className="card h-32 animate-pulse" />
      ) : stock.unavailable ? (
        <Notice tone="unknown">
          Base injoignable. Vérifie que <code>supabase/schema.sql</code> a bien été joué —
          sans les tables, la requête échoue.
        </Notice>
      ) : stock.count === 0 ? (
        <div className="card p-6 text-center">
          <p className="font-display text-base font-bold">Rien en stock</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            L’enregistrement d’un exemplaire n’est pas encore branché — le bouton
            existe sur l’écran de détail, il ne fait rien pour l’instant.
          </p>
          <Link href="/" className="btn-action mt-4 flex items-center justify-center border border-line text-ink">
            Chercher un jeu
          </Link>
        </div>
      ) : (
        <div className="card grid grid-cols-3 divide-x divide-line p-4">
          <Stat value={String(stock.count)} label="exemplaires" />
          <Stat value={`${stock.estimatedValue} €`} label="valeur estimée" tone="text-money" />
          <Stat value={String(stock.toComplete)} label="à compléter" tone={stock.toComplete ? 'text-todo' : undefined} />
        </div>
      )}
    </main>
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

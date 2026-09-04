'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Écran de scan — la caméra n'est pas encore branchée.
 *
 * La page existe quand même : la barre de navigation pointe dessus, et une
 * entrée de menu qui mène à une 404 est pire qu'une page qui dit franchement
 * où on en est. Elle renvoie vers la recherche, qui, elle, marche.
 */
// useSearchParams() force le rendu cote client. Sans cette frontiere Suspense,
// le prerendu de /scan echoue au build (la page n'a pas de segment dynamique,
// donc Next essaie de la generer statiquement).
export default function ScanPage() {
  return (
    <Suspense fallback={<div className="safe-top px-4 pt-10"><div className="card h-64 animate-pulse" /></div>}>
      <Scan />
    </Suspense>
  );
}

function Scan() {
  const mode = useSearchParams().get('mode');
  const lot = mode === 'lot';

  return (
    <main className="safe-top flex min-h-dvh flex-col px-4 pb-28">
      <header className="pb-6 pt-10">
        <h1 className="font-display text-2xl font-bold leading-tight">
          {lot ? 'Scanner un lot' : 'Scanner un jeu'}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {lot
            ? 'Une photo d’étagère, autant de fiches que de tranches détectées.'
            : 'Une photo de la tranche, et la fiche se remplit toute seule.'}
        </p>
      </header>

      <div className="card flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" strokeLinecap="round" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </div>

        <p className="font-display text-base font-bold">Caméra pas encore branchée</p>
        <p className="max-w-[26ch] text-sm leading-relaxed text-muted">
          La lecture d’image côté serveur est prête et testée. Il manque l’écran
          de prise de vue.
        </p>

        <Link href="/" className="btn-action mt-2 flex items-center justify-center border border-line px-6 text-ink">
          Chercher par le titre
        </Link>
      </div>

      {lot && (
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          Le scan de lot est volontairement gardé pour la fin : détecter plusieurs
          tranches sur une photo est le morceau le plus risqué du projet.
        </p>
      )}
    </main>
  );
}

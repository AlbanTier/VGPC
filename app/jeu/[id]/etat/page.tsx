'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import type { IgdbPlatform } from '@/lib/platforms';
import {
  PARTS, DEFECTS, WEAR_LABEL, PRESETS,
  conditionFactor, partImpact,
  type ItemCondition, type PartKey, type DefectKey, type Wear, type PresetKey,
} from '@/lib/condition';
import type { GameMatch } from '@/lib/igdb';
import type { PriceResult } from '@/lib/price';

const WEARS: Wear[] = ['neuf', 'tres-bon', 'correct', 'abime'];

/**
 * Ecran 5 — detail de l'exemplaire.
 *
 * Le prix se recalcule a chaque case cochee SANS rappeler l'API : le serveur
 * renvoie `base` (le p35 brut, avant etat), et conditionFactor() est une
 * fonction pure qu'on peut executer cote client. Une case cochee = un rendu,
 * pas une requete reseau.
 */
export default function DetailExemplaire() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();

  const platformId = Number(params.get('p')) || null;
  const presetParam = (params.get('preset') as PresetKey | null) ?? 'complet-tres-bon';

  const [game, setGame] = useState<GameMatch | null>(null);
  const [platform, setPlatform] = useState<IgdbPlatform | null>(null);
  const [base, setBase] = useState<number | null>(null);
  const [priceOk, setPriceOk] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [condition, setCondition] = useState<ItemCondition>({
    ...PRESETS[presetParam in PRESETS ? presetParam : 'complet-tres-bon'].condition,
    fromPreset: false, // des qu'on est sur cet ecran, l'etat n'est plus un raccourci
  });

  useEffect(() => {
    if (!platformId) {
      setError('Support manquant. Reviens à la fiche et choisis-en un.');
      setLoading(false);
      return;
    }
    let cancelled = false;

    // Un seul appel, au chargement : on veut `base`, pas un prix deja ajuste.
    fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: Number(id), platformId, preset: 'complet-tres-bon' }),
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? 'Erreur');
        return json as { game: GameMatch; platform: IgdbPlatform; price: PriceResult; notice: string | null };
      })
      .then((json) => {
        if (cancelled) return;
        setGame(json.game);
        setPlatform(json.platform);
        setNotice(json.notice);
        setPriceOk(json.price.ok);
        setBase(json.price.ok ? json.price.base : null);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [id, platformId]);

  const factor = useMemo(() => conditionFactor(condition), [condition]);
  const price = base === null ? null : Math.round(base * factor * 2) / 2;

  const togglePart = (key: PartKey) =>
    setCondition((c) => ({
      ...c,
      present: c.present.includes(key) ? c.present.filter((p) => p !== key) : [...c.present, key],
    }));

  const toggleDefect = (key: DefectKey) =>
    setCondition((c) => ({
      ...c,
      defects: c.defects.includes(key) ? c.defects.filter((d) => d !== key) : [...c.defects, key],
    }));

  return (
    <main className="safe-top px-4 pb-56">
      <button onClick={() => router.back()} className="mb-4 mt-2 text-sm text-muted">
        ← Retour
      </button>

      <h1 className="font-display text-xl font-bold leading-tight">Détail de l’exemplaire</h1>
      {game && (
        <p className="mt-1 text-sm text-muted">
          {game.frenchTitle ?? game.name}
          {platform && ` · ${platform.name}`}
        </p>
      )}

      {error && <p className="card mt-4 border-unknown/40 p-4 text-sm text-unknown">{error}</p>}
      {notice && <p className="card mt-4 border-todo/40 p-3 text-xs text-todo">{notice}</p>}
      {loading && <div className="card mt-4 h-64 animate-pulse" />}

      {!loading && !error && (
        <>
          <Section title="Ce qu’il y a dans la boîte">
            <ul className="divide-y divide-line">
              {PARTS.map((part) => {
                const on = condition.present.includes(part.key);
                const impact = base === null ? null : partImpact(base, condition, part);
                return (
                  <li key={part.key}>
                    <button
                      onClick={() => togglePart(part.key)}
                      className="flex w-full items-center gap-3 py-3.5 text-left"
                    >
                      <Check on={on} />
                      <span className={`flex-1 text-sm ${on ? '' : 'text-muted'}`}>
                        {part.label}
                        {part.optional && <span className="text-muted"> · facultatif</span>}
                      </span>
                      {impact !== null && impact !== 0 && (
                        <span className={`num text-sm ${on ? 'text-money' : 'text-muted'}`}>
                          {on ? '+' : '−'}
                          {Math.abs(impact)} €
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="pb-1 pt-2 text-xs text-muted">
              Les montants indiquent ce que chaque pièce ajoute ou retire au prix.
            </p>
          </Section>

          <Section title="État général">
            <div className="flex flex-wrap gap-2 pb-1">
              {WEARS.map((w) => (
                <button
                  key={w}
                  onClick={() => setCondition((c) => ({ ...c, wear: w }))}
                  className={`chip ${condition.wear === w ? 'chip-on' : ''}`}
                >
                  {WEAR_LABEL[w]}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Défauts à signaler">
            <div className="flex flex-wrap gap-2 pb-1">
              {DEFECTS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => toggleDefect(d.key)}
                  className={`chip ${condition.defects.includes(d.key) ? 'chip-on text-todo' : ''}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="pb-1 pt-2 text-xs text-muted">
              Les signaler fait baisser le prix conseillé, mais évite les litiges — et
              un litige coûte plus cher que la différence.
            </p>
          </Section>
        </>
      )}

      {/* Barre de prix collée en bas : le chiffre doit rester visible pendant
          qu'on coche, sinon on ne voit pas l'effet de ce qu'on fait. */}
      {!loading && !error && (
        // bottom-14 : la hauteur de la barre de navigation. Sans ca le prix
        // passe dessous et on ne voit plus l'effet des cases qu'on coche.
        <div className="fixed inset-x-0 bottom-14 mx-auto w-full max-w-[430px]
                        border-t border-line bg-card/95 px-4 pb-3 pt-3 backdrop-blur">
          {priceOk && price !== null ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">Prix conseillé</span>
                <span className="num text-2xl text-money">{price} €</span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                base {base} € · état ×{factor.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="text-sm text-todo">
              Pas assez de comparables pour chiffrer cet exemplaire.
            </p>
          )}
          <button className="btn-action mt-3 bg-ink text-bg" disabled>
            Enregistrer dans mon stock
          </button>
          <p className="pb-1 pt-1.5 text-center text-[11px] text-muted">
            bientôt — le stock arrive avec Supabase
          </p>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mt-4 px-4 py-3">
      <h2 className="mb-1 text-xs uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border
                  ${on ? 'border-money bg-money text-bg' : 'border-line'}`}
    >
      {on && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

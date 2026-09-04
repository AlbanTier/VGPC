'use client';

import { useMemo } from 'react';

/**
 * Mur de jaquettes en fond d'écran.
 *
 * Cinq colonnes fines qui dérivent lentement en sens alternés, façon mosaïque.
 * La liste est dupliquée pour que la boucle soit sans couture.
 *
 * Deux réglages appris à la première version, qui l'avaient ratée :
 *  - CINQ colonnes, pas trois. À trois, les tuiles font 130 px de large sur un
 *    écran de 400 : ça ne lit plus comme une mosaïque, juste comme trois images.
 *  - Un voile LÉGER. Trop de noir et on ne voit plus rien du tout ; c'est le
 *    panneau posé par-dessus qui doit porter la lisibilité, pas le voile.
 *
 * Parti pris conservé : les emplacements vides restent visibles. Le mur est une
 * jauge du stock, pas une décoration — le pré-remplir de jeux qu'on ne possède
 * pas serait joli et faux.
 */
export function CoverWall({ covers }: { covers: string[] }) {
  const slots = useMemo(() => {
    const MIN = 35;
    const out: (string | null)[] = covers.slice(0, 45);
    while (out.length < MIN) out.push(null);
    return out;
  }, [covers]);

  const columns = useMemo(() => {
    const cols: (string | null)[][] = [[], [], [], [], []];
    slots.forEach((s, i) => cols[i % 5].push(s));
    return cols;
  }, [slots]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 flex justify-center gap-1.5 px-1.5">
        {columns.map((col, i) => (
          <div
            key={i}
            className="drift flex flex-1 flex-col gap-1.5 will-change-transform"
            style={{
              animationName: i % 2 === 0 ? 'wall-up' : 'wall-down',
              animationDuration: `${72 + i * 9}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
            }}
          >
            {[...col, ...col].map((url, j) => (
              <Tile key={j} url={url} />
            ))}
          </div>
        ))}
      </div>

      {/* Voile léger + vignette douce : on garde l'art visible, la lisibilité
          est assurée par le panneau de contenu posé au-dessus. */}
      <div className="absolute inset-0 bg-bg/28" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(140% 95% at 50% 30%, rgba(10,11,15,0.04) 0%, rgba(10,11,15,0.45) 55%, rgba(10,11,15,0.86) 100%)',
        }}
      />

      <style jsx global>{`
        @keyframes wall-up {
          from { transform: translateY(0); }
          to   { transform: translateY(-50%); }
        }
        @keyframes wall-down {
          from { transform: translateY(-50%); }
          to   { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .drift { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

function Tile({ url }: { url: string | null }) {
  if (!url) {
    return <div className="aspect-[3/4] w-full shrink-0 rounded bg-card/50" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      className="aspect-[3/4] w-full shrink-0 rounded object-cover"
    />
  );
}

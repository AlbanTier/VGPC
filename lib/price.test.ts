/**
 * Verification hors ligne de la chaine bouchon -> filtres -> prix.
 * Aucune cle, aucun reseau.
 *
 *   npm run test:price
 *
 * Ce que ca valide : les filtres jettent bien le bruit, les percentiles sont
 * coherents, le conseil reste sous la mediane des prix demandes, et le preset
 * d'etat deplace le prix dans le bon sens.
 * Ce que ca NE valide PAS : la justesse des prix face au vrai marche.
 */

import { MockProvider } from './providers/mock';
import { analyse } from './price';
import { PRESETS, PRESET_KEYS, conditionFactor } from './condition';

const CASES = [
  { names: ['Mario Kart 8 Deluxe'], keywords: ['switch'], query: 'Mario Kart 8 Deluxe switch' },
  { names: ['Pokémon Emerald Version', 'Pokémon Version Émeraude'], keywords: ['gba', 'game boy advance'], query: 'Pokémon Version Émeraude gba' },
  { names: ['FIFA 23'], keywords: ['ps4', 'playstation 4'], query: 'FIFA 23 ps4' },
];

async function main() {
  const provider = new MockProvider();
  let failures = 0;

  const check = (label: string, ok: boolean, detail = '') => {
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'ECHEC'} ${label}${detail ? ` — ${detail}` : ''}`);
  };

  for (const c of CASES) {
    console.log(`\n${'─'.repeat(72)}\n${c.query}\n${'─'.repeat(72)}`);
    const listings = await provider.search({ text: c.query, limit: 60 });
    const keywords = c.keywords;

    const base = analyse(listings, { names: c.names, platformKeywords: keywords });

    if (!base.ok) {
      check('un prix est produit', false, base.reason);
      continue;
    }

    console.log(
      `  conseille ${base.advisedPrice} € · fourchette ${base.range.min}–${base.range.max}` +
      ` · part vite ${base.fastZone.from}–${base.fastZone.to}` +
      ` · mediane demandee ${base.marketMedian} €` +
      ` · n=${base.sample} (${base.confidence})`,
    );

    check('le bruit est ecarte', base.rejected.length > 0, `${base.rejected.length} rejets`);
    check(
      'aucun accessoire retenu',
      !base.comparables.some((x) => /coque|poster|manette|boîte vide/i.test(x.title)),
    );
    check(
      'le conseil ne depasse pas la mediane demandee',
      base.advisedPrice <= base.marketMedian,
      `${base.advisedPrice} vs ${base.marketMedian}`,
    );
    check(
      'la fourchette encadre le conseil',
      base.range.min <= base.advisedPrice && base.advisedPrice <= base.range.max,
    );
    check('la zone rapide est sous le conseil', base.fastZone.to <= base.advisedPrice);

    // Le preset doit deplacer le prix dans le bon sens, de facon monotone.
    const prices = PRESET_KEYS.map((k) => {
      const r = analyse(listings, {
        names: c.names,
        platformKeywords: keywords,
        condition: PRESETS[k].condition,
      });
      return { k, price: r.advisedPrice, factor: conditionFactor(PRESETS[k].condition) };
    });
    console.log('  ' + prices.map((p) => `${p.k} ${p.price}€`).join(' · '));

    const scelle = prices.find((p) => p.k === 'neuf-scelle')!;
    const seul = prices.find((p) => p.k === 'jeu-seul')!;
    const complet = prices.find((p) => p.k === 'complet-tres-bon')!;
    check('scelle > complet > jeu seul', scelle.price > complet.price && complet.price > seul.price);
  }

  console.log(`\n${failures === 0 ? 'Tout est vert.' : `${failures} verification(s) en echec.`}\n`);
  process.exit(failures === 0 ? 0 : 1);

}

main();

/**
 * Selection du fournisseur de comparables.
 *
 * VGPC_SOURCE = ebay | vinted | mock   (defaut : ebay si configure, sinon mock)
 *
 * L'ordre de repli est volontaire : on prefere TOUJOURS une source reelle,
 * mais on ne plante jamais l'app faute de cle — on retombe sur le bouchon
 * en le disant clairement dans la reponse d'API.
 */

import type { ComparablesProvider, SourceName } from './types';
import { MockProvider } from './mock';
import { VintedProvider } from './vinted';
import { EbayProvider } from './ebay';

const providers: Record<SourceName, ComparablesProvider> = {
  mock: new MockProvider(),
  vinted: new VintedProvider(),
  ebay: new EbayProvider(),
};

export interface Selection {
  provider: ComparablesProvider;
  /** Vrai quand on n'a pas pu honorer VGPC_SOURCE. */
  fellBack: boolean;
  /** A afficher dans l'UI : d'ou viennent vraiment les chiffres. */
  notice: string | null;
}

export function selectProvider(): Selection {
  const wanted = (process.env.VGPC_SOURCE as SourceName | undefined) ?? null;

  if (wanted && providers[wanted]) {
    const p = providers[wanted];
    if (p.isAvailable()) return { provider: p, fellBack: false, notice: null };
    return {
      provider: providers.mock,
      fellBack: true,
      notice: `${wanted} indisponible — ${p.unavailableReason()} Chiffres simulés.`,
    };
  }

  if (providers.ebay.isAvailable()) {
    return { provider: providers.ebay, fellBack: false, notice: null };
  }

  return {
    provider: providers.mock,
    fellBack: true,
    notice: `${providers.ebay.unavailableReason()} Chiffres simulés.`,
  };
}

export type { ComparablesProvider, Listing, SourceName } from './types';

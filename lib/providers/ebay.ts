/**
 * eBay Browse API — annonces actives sur eBay.fr.
 *
 * C'est la source PRINCIPALE visee : officielle, dans les clous des CGU,
 * 5 000 appels/jour gratuits, et elle marche depuis une IP de datacenter,
 * donc depuis Vercel — contrairement a Vinted.
 *
 * Statut au 4 sept. 2026 : compte developpeur eBay en attente d'approbation.
 * Le code est ecrit et pret ; il s'active des que EBAY_CLIENT_ID est renseigne.
 *
 * Ce que cette source ne donne PAS : les ventes realisees. L'API Marketplace
 * Insights (historique 90 j) est en "limited release" et fermee aux nouveaux
 * comptes. On observe donc, ici aussi, des prix DEMANDES.
 * Seul vrai signal de demande recupere : bidCount sur les encheres en cours.
 */

import type { ComparablesProvider, Listing, SearchParams } from './types';

const OAUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const BROWSE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';

/** Categorie "Jeux video" sur eBay. */
const VIDEO_GAMES_CATEGORY = '139973';

let cached: { value: string; expiresAt: number } | null = null;

export class EbayProvider implements ComparablesProvider {
  readonly name = 'ebay' as const;

  isAvailable() {
    return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
  }

  unavailableReason() {
    return this.isAvailable()
      ? null
      : 'Clés eBay absentes — compte développeur en attente d’approbation.';
  }

  private async token(): Promise<string> {
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

    const id = process.env.EBAY_CLIENT_ID!;
    const secret = process.env.EBAY_CLIENT_SECRET!;

    const res = await fetch(OAUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Auth eBay KO (${res.status})`);

    const json = (await res.json()) as { access_token: string; expires_in: number };
    cached = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return cached.value;
  }

  async search({ text, limit = 50 }: SearchParams): Promise<Listing[]> {
    const params = new URLSearchParams({
      q: text,
      limit: String(Math.min(limit, 200)),
      // Un jeu expedie du Japon n'est pas un comparable pour une vente en France.
      filter: 'buyingOptions:{FIXED_PRICE|AUCTION},itemLocationCountry:FR',
      category_ids: VIDEO_GAMES_CATEGORY,
    });

    const res = await fetch(`${BROWSE_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${await this.token()}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR',
        'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country%3DFR',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 429) throw new Error('eBay 429 — quota journalier (5 000) atteint.');
    if (!res.ok) throw new Error(`eBay Browse ${res.status}`);

    const json = (await res.json()) as { itemSummaries?: RawItem[] };
    return (json.itemSummaries ?? []).map(toListing);
  }
}

interface RawItem {
  itemId: string;
  title?: string;
  price?: { value?: string; currency?: string };
  shippingOptions?: { shippingCost?: { value?: string } }[];
  condition?: string;
  bidCount?: number;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
}

function toListing(it: RawItem): Listing {
  const price = Number(it.price?.value ?? 0);
  const shipping = Number(it.shippingOptions?.[0]?.shippingCost?.value ?? 0);
  return {
    id: it.itemId,
    title: it.title ?? '',
    price,
    // Homogene avec Vinted : ce que l'acheteur debourse en tout.
    totalPrice: Math.round((price + shipping) * 100) / 100,
    currency: it.price?.currency ?? 'EUR',
    status: it.condition ?? null,
    interest: it.bidCount ?? 0,
    url: it.itemWebUrl ?? null,
    photo: it.image?.imageUrl ?? null,
    source: 'ebay',
  };
}

/**
 * Vinted — API interne du site.
 *
 * A LIRE AVANT D'ACTIVER (VGPC_SOURCE=vinted) :
 *  - Vinted n'a pas d'API publique. On tape celle que le site utilise lui-meme.
 *    C'est contraire a ses CGU. Sur un outil perso, le risque concret est un
 *    blocage d'IP, pas un proces — mais c'est un choix, pas un detail.
 *  - Il faut une session : un GET sur la home pose `access_token_web`.
 *  - Les IP de datacenter se font jeter. Donc : `npm run dev` sur ta machine OUI,
 *    Vercel NON. Ne deploie jamais avec cette source active.
 *  - L'API expose les annonces ACTIVES, pas les ventes conclues : on mesure des
 *    prix DEMANDES. price.ts corrige ce biais en conseillant un percentile bas.
 */

import type { ComparablesProvider, Listing, SearchParams } from './types';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export class VintedProvider implements ComparablesProvider {
  readonly name = 'vinted' as const;
  private cookies = new Map<string, string>();
  private host = process.env.VINTED_HOST || 'www.vinted.fr';

  isAvailable() {
    // Techniquement toujours "disponible", mais on refuse de tourner en
    // production : ce serait une IP de datacenter, donc un blocage assure.
    return process.env.NODE_ENV !== 'production';
  }

  unavailableReason() {
    return this.isAvailable()
      ? null
      : 'Vinted est désactivé en production : une IP de datacenter se fait bloquer.';
  }

  private get cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private absorb(res: Response) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(';');
      const i = pair.indexOf('=');
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  private async init() {
    if (this.cookies.has('access_token_web')) return;

    const res = await fetch(`https://${this.host}/`, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      redirect: 'follow',
      cache: 'no-store',
    });
    this.absorb(res);
    await res.arrayBuffer();

    if (!this.cookies.has('access_token_web')) {
      throw new Error(
        `Vinted : pas de cookie de session (HTTP ${res.status}). IP filtrée, ou le bootstrap a changé.`,
      );
    }
  }

  async search({ text, limit = 40 }: SearchParams): Promise<Listing[]> {
    await this.init();

    const params = new URLSearchParams({
      search_text: text,
      per_page: String(limit),
      page: '1',
      order: 'newest_first',
    });

    const res = await fetch(`https://${this.host}/api/v2/catalog/items?${params}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        Cookie: this.cookieHeader,
        Referer: `https://${this.host}/`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      this.cookies.clear(); // la session a expire, on repartira de zero
      throw new Error(`Vinted ${res.status} : session refusée ou IP bloquée.`);
    }
    if (!res.ok) throw new Error(`Vinted ${res.status}`);

    const json = (await res.json()) as { items?: RawItem[] };
    return (json.items ?? []).map(toListing);
  }
}

interface RawItem {
  id: number | string;
  title?: string;
  price?: { amount?: string | number; currency_code?: string } | number;
  total_item_price?: { amount?: string | number };
  status?: string;
  favourite_count?: number;
  url?: string;
  photo?: { url?: string };
}

function toListing(it: RawItem): Listing {
  const price = Number(typeof it.price === 'object' ? it.price?.amount ?? 0 : it.price ?? 0);
  return {
    id: String(it.id),
    title: it.title ?? '',
    price,
    totalPrice: Number(it.total_item_price?.amount ?? price),
    currency: (typeof it.price === 'object' ? it.price?.currency_code : null) ?? 'EUR',
    status: it.status ?? null,
    interest: it.favourite_count ?? 0,
    url: it.url ?? null,
    photo: it.photo?.url ?? null,
    source: 'vinted',
  };
}

/**
 * Contrat commun a toutes les sources de comparables.
 *
 * Il n'existe QUE pour une raison : les trois sources possibles ont des
 * disponibilites differentes et on ne veut pas que le reste de l'app le sache.
 *   - eBay  : officiel, marche depuis Vercel, compte en attente d'approbation
 *   - Vinted: le vrai marche cible, mais hors CGU et IP residentielle obligatoire
 *   - mock  : pour developper l'UI sans reseau
 *
 * Regle : rien en dehors de ce dossier n'importe un fournisseur concret.
 */

export type SourceName = 'mock' | 'vinted' | 'ebay';

export interface Listing {
  id: string;
  title: string;
  /** Prix affiche. */
  price: number;
  /** Ce que l'acheteur debourse en tout (port inclus). C'est ce qu'on compare. */
  totalPrice: number;
  currency: string;
  /** Etat tel que la plateforme le nomme ("Très bon état", "Neuf"...). */
  status: string | null;
  /** Favoris Vinted ou nombre d'encheres eBay : un proxy de la demande. */
  interest: number;
  url: string | null;
  photo: string | null;
  source: SourceName;
}

export interface SearchParams {
  /** Requete texte, deja composee (titre + plateforme). */
  text: string;
  limit?: number;
}

export interface ComparablesProvider {
  readonly name: SourceName;
  /** Faux quand la source n'est pas configurable dans l'environnement courant. */
  isAvailable(): boolean;
  /** Pourquoi elle n'est pas disponible, en une phrase affichable. */
  unavailableReason(): string | null;
  search(params: SearchParams): Promise<Listing[]>;
}

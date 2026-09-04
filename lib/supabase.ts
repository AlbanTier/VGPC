import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase.
 *
 * On utilise la cle `anon` (publique par conception) et jamais `service_role` :
 * `service_role` contourne toutes les politiques RLS, et le prefixe
 * NEXT_PUBLIC_ l'expédierait dans le navigateur de tous les visiteurs.
 *
 * L'app doit rester utilisable sans Supabase configure — on ne veut pas qu'une
 * variable manquante empeche de chercher un jeu et de voir un prix.
 * D'ou `getSupabase()` qui renvoie null plutot que de jeter.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const isSupabaseConfigured = () => Boolean(url && key);

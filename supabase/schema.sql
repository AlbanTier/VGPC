-- VGPC — schema initial.
-- A jouer dans l'editeur SQL de ton projet Supabase.
--
-- Parti pris central, herite des maquettes et confirme par le spike :
-- l'etat d'un exemplaire n'est PAS un enum, c'est un objet. On le stocke en
-- jsonb plutot qu'en colonnes, parce que sa forme va encore bouger (pieces
-- specifiques a une plateforme, nouveaux defauts) et qu'une migration par
-- ajout de defaut serait penible pour un gain nul.

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Jeux : cache local des fiches IGDB.
-- On duplique volontairement quelques champs IGDB pour ne pas dependre de leur
-- disponibilite a l'affichage du stock.
-- --------------------------------------------------------------------------
create table if not exists games (
  igdb_id        bigint primary key,
  name           text not null,
  french_title   text,
  alt_names      text[] not null default '{}',
  year           int,
  publisher      text,
  cover_url      text,
  fetched_at     timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Exemplaires : un jeu physique que tu as en main.
-- Le meme jeu sur deux plateformes = deux lignes. Deux exemplaires du meme
-- jeu = deux lignes aussi (etats differents, prix differents).
-- --------------------------------------------------------------------------
create table if not exists items (
  id             uuid primary key default gen_random_uuid(),
  igdb_id        bigint not null references games(igdb_id) on delete restrict,
  platform       text not null,

  -- L'objet etat complet : { present[], wear, wearByPart{}, defects[], fromPreset }
  condition      jsonb not null,

  -- Prix au moment du scan. On fige : c'est ce qui permet de comparer plus tard
  -- ce qu'on avait conseille et ce qui s'est reellement vendu.
  advised_price  numeric(8,2),
  price_range    jsonb,
  price_source   text,               -- ebay | vinted | mock
  priced_at      timestamptz,

  status         text not null default 'a-lister'
                 check (status in ('a-lister', 'en-ligne', 'vendu', 'garde')),
  listed_at      timestamptz,
  sold_at        timestamptz,
  sold_price     numeric(8,2),

  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists items_status_idx on items (status, created_at desc);
create index if not exists items_game_idx on items (igdb_id);

-- fromPreset a false = l'utilisateur a detaille l'etat. Sert au badge
-- "Fiche a completer" de l'ecran 7.
create index if not exists items_preset_idx
  on items (((condition->>'fromPreset')::boolean));

-- --------------------------------------------------------------------------
-- Annonces generees (titre + description), historisees.
-- Une annonce par exemplaire et par plateforme de vente.
-- --------------------------------------------------------------------------
create table if not exists listings (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references items(id) on delete cascade,
  marketplace    text not null default 'vinted',
  tone           text not null default 'direct'
                 check (tone in ('direct', 'detaille', 'collector')),
  title          text not null,
  description    text not null,
  price          numeric(8,2),
  created_at     timestamptz not null default now()
);

create index if not exists listings_item_idx on listings (item_id, created_at desc);

-- --------------------------------------------------------------------------
-- Cache d'analyse de prix.
-- Cle = jeu + plateforme + empreinte de l'etat. Peremption courte : le marche
-- de l'occasion bouge, mais pas d'un jour a l'autre.
-- C'est ce cache qui divise par un ordre de grandeur les appels a la source.
-- --------------------------------------------------------------------------
create table if not exists price_cache (
  cache_key      text primary key,   -- igdb_id:platform:conditionHash
  source         text not null,
  payload        jsonb not null,     -- le PriceResult complet
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null
);

create index if not exists price_cache_expiry_idx on price_cache (expires_at);

-- --------------------------------------------------------------------------
-- RLS : l'app est mono-utilisateur pour l'instant (c'est ton stock a toi).
-- On active quand meme RLS pour ne pas laisser les tables ouvertes en grand
-- avec la cle anon, et on ouvrira proprement le jour ou il y a des comptes.
-- --------------------------------------------------------------------------
alter table games       enable row level security;
alter table items       enable row level security;
alter table listings    enable row level security;
alter table price_cache enable row level security;

-- Politique temporaire, assumee : acces complet via la cle anon.
-- A REMPLACER par un filtre sur auth.uid() des qu'il y a plus d'un utilisateur.
create policy "acces mono-utilisateur" on games       for all using (true) with check (true);
create policy "acces mono-utilisateur" on items       for all using (true) with check (true);
create policy "acces mono-utilisateur" on listings    for all using (true) with check (true);
create policy "acces mono-utilisateur" on price_cache for all using (true) with check (true);

-- Tenir updated_at a jour sans y penser.
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists items_touch on items;
create trigger items_touch before update on items
  for each row execute function touch_updated_at();

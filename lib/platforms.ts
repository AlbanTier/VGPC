export type PlatformKey =
  | 'switch' | 'switch2' | 'ps5' | 'ps4' | 'ps3'
  | 'xboxsx' | 'xboxone' | 'x360'
  | '3ds' | 'ds' | 'wii' | 'wiiu' | 'gba' | 'psvita' | 'pc';

export interface Platform {
  id: number;          // id IGDB
  label: string;
  /** Mots-cles attendus dans le titre d'une annonce pour confirmer la plateforme. */
  keywords: string[];
}

export const PLATFORMS: Record<PlatformKey, Platform> = {
  switch:  { id: 130, label: 'Nintendo Switch',   keywords: ['switch'] },
  switch2: { id: 508, label: 'Nintendo Switch 2', keywords: ['switch 2'] },
  ps5:     { id: 167, label: 'PlayStation 5',     keywords: ['ps5', 'playstation 5'] },
  ps4:     { id: 48,  label: 'PlayStation 4',     keywords: ['ps4', 'playstation 4'] },
  ps3:     { id: 9,   label: 'PlayStation 3',     keywords: ['ps3', 'playstation 3'] },
  xboxsx:  { id: 169, label: 'Xbox Series X|S',   keywords: ['series x', 'series s', 'xbox series'] },
  xboxone: { id: 49,  label: 'Xbox One',          keywords: ['xbox one'] },
  x360:    { id: 12,  label: 'Xbox 360',          keywords: ['360'] },
  '3ds':   { id: 37,  label: 'Nintendo 3DS',      keywords: ['3ds'] },
  ds:      { id: 20,  label: 'Nintendo DS',       keywords: ['nintendo ds'] },
  wii:     { id: 5,   label: 'Wii',               keywords: ['wii'] },
  wiiu:    { id: 41,  label: 'Wii U',             keywords: ['wii u'] },
  gba:     { id: 24,  label: 'Game Boy Advance',  keywords: ['gba', 'game boy advance'] },
  psvita:  { id: 46,  label: 'PS Vita',           keywords: ['vita'] },
  pc:      { id: 6,   label: 'PC',                keywords: ['pc'] },
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as PlatformKey[];

export const isPlatformKey = (v: string): v is PlatformKey => v in PLATFORMS;

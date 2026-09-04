/**
 * Plateformes.
 *
 * Changement de principe par rapport à la v1 : la liste des supports n'est plus
 * codée en dur ici. C'est IGDB qui dit sur quelles plateformes un jeu est sorti,
 * et on propose exactement celles-là. Conséquence directe : toutes les consoles
 * qu'IGDB connaît sont disponibles, y compris celles que je n'aurais jamais
 * pensé à lister.
 *
 * Ce fichier ne garde donc que ce qu'IGDB ne peut pas nous donner : les
 * mots-clés qu'on s'attend à trouver dans le TITRE D'UNE ANNONCE pour confirmer
 * qu'un comparable porte bien sur le bon support. Un vendeur écrit "PS1" ou
 * "Playstation 1", pas "PlayStation" tout court comme le nom canonique IGDB.
 *
 * Quand un id manque à la table, `keywordsFor()` retombe sur le nom et
 * l'abréviation IGDB. C'est moins fin, mais ça marche, et ça ne bloque jamais
 * un support obscur.
 */

export interface IgdbPlatform {
  id: number;
  name: string;
  abbreviation?: string | null;
}

/** Mots-clés d'annonce, par id de plateforme IGDB. */
const KEYWORDS: Record<number, string[]> = {
  // --- Nintendo
  18:  ['nes', 'nintendo entertainment'],
  19:  ['snes', 'super nintendo', 'super nes'],
  4:   ['n64', 'nintendo 64'],
  21:  ['gamecube', 'game cube', 'ngc'],
  5:   ['wii'],
  41:  ['wii u', 'wiiu'],
  130: ['switch'],
  508: ['switch 2'],
  33:  ['game boy', 'gameboy', 'gb'],
  22:  ['game boy color', 'gameboy color', 'gbc'],
  24:  ['game boy advance', 'gameboy advance', 'gba'],
  20:  ['nintendo ds', 'nds'],
  37:  ['3ds'],
  87:  ['virtual boy'],

  // --- Sony
  7:   ['ps1', 'psx', 'playstation 1', 'playstation one'],
  8:   ['ps2', 'playstation 2'],
  9:   ['ps3', 'playstation 3'],
  48:  ['ps4', 'playstation 4'],
  167: ['ps5', 'playstation 5'],
  38:  ['psp'],
  46:  ['ps vita', 'psvita', 'vita'],

  // --- Microsoft
  11:  ['xbox classic', 'xbox original', 'xbox'],
  12:  ['xbox 360', '360'],
  49:  ['xbox one'],
  169: ['xbox series', 'series x', 'series s'],

  // --- Sega
  64:  ['master system'],
  29:  ['mega drive', 'megadrive', 'genesis'],
  78:  ['mega cd', 'sega cd'],
  30:  ['32x'],
  32:  ['saturn'],
  23:  ['dreamcast'],
  35:  ['game gear'],

  // --- Autres
  86:  ['pc engine', 'turbografx'],
  79:  ['neo geo'],
  80:  ['neo geo'],
  57:  ['wonderswan'],
  59:  ['atari 2600'],
  62:  ['jaguar'],
  61:  ['lynx'],
  6:   ['pc', 'windows'],
};

/**
 * Supports sur lesquels une revente d'occasion physique a du sens.
 * Sert uniquement à l'ORDRE d'affichage : rien n'est masqué, parce qu'on ne
 * sait pas ce que l'utilisateur a réellement dans son carton.
 */
const PHYSICAL_FIRST = new Set(Object.keys(KEYWORDS).map(Number));

export function keywordsFor(platform: IgdbPlatform): string[] {
  const known = KEYWORDS[platform.id];
  if (known) return known;

  // Repli : le nom IGDB et son abréviation. Imparfait mais jamais bloquant.
  const out = [platform.name.toLowerCase()];
  if (platform.abbreviation) out.push(platform.abbreviation.toLowerCase());
  return out;
}

/** Étiquette courte pour une puce de sélection. */
export function labelFor(platform: IgdbPlatform): string {
  return platform.name;
}

/**
 * Trie les supports d'un jeu : les consoles de salon et portables d'abord,
 * le PC et les plateformes dématérialisées ensuite. Quelqu'un qui revend une
 * boîte cherche "Mega Drive", pas "Web browser".
 */
export function sortPlatforms(platforms: IgdbPlatform[]): IgdbPlatform[] {
  return platforms.slice().sort((a, b) => {
    const aP = PHYSICAL_FIRST.has(a.id) ? 0 : 1;
    const bP = PHYSICAL_FIRST.has(b.id) ? 0 : 1;
    if (aP !== bP) return aP - bP;
    return a.name.localeCompare(b.name, 'fr');
  });
}

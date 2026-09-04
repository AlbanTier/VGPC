/**
 * L'etat d'un exemplaire n'est PAS un enum. C'est un objet : ce qui est present
 * dans la boite, l'etat piece par piece, et les defauts signales.
 * Decision prise a l'etape des maquettes, confirmee par le spike.
 *
 * Le preset de la fiche jeu ("Complet, tres bon") n'est qu'un raccourci
 * qui pre-remplit cet objet. On peut toujours descendre au detail (ecran 5).
 */

export type PartKey = 'boitier' | 'jaquette' | 'notice' | 'cale' | 'media' | 'blister';

export interface Part {
  key: PartKey;
  label: string;
  /** Impact sur le prix quand la piece MANQUE, en fraction du prix de base. */
  weight: number;
  /** Certaines pieces n'existent pas sur toutes les plateformes. */
  optional?: boolean;
}

export const PARTS: Part[] = [
  { key: 'media',    label: 'Cartouche / disque', weight: 0.55 },
  { key: 'boitier',  label: 'Boîtier',            weight: 0.14 },
  { key: 'jaquette', label: 'Jaquette',           weight: 0.12 },
  { key: 'notice',   label: 'Notice',             weight: 0.08 },
  { key: 'cale',     label: 'Cale intérieure',    weight: 0.03, optional: true },
  { key: 'blister',  label: 'Blister d’origine',  weight: 0.30, optional: true },
];

export type Wear = 'neuf' | 'tres-bon' | 'correct' | 'abime';

export const WEAR_FACTOR: Record<Wear, number> = {
  neuf: 1.08,
  'tres-bon': 1.0,
  correct: 0.9,
  abime: 0.74,
};

export const WEAR_LABEL: Record<Wear, string> = {
  neuf: 'Comme neuf',
  'tres-bon': 'Très bon',
  correct: 'Correct',
  abime: 'Abîmé',
};

export type DefectKey = 'rayures' | 'jaunissement' | 'etiquette' | 'fissure' | 'odeur' | 'ecriture';

export interface Defect {
  key: DefectKey;
  label: string;
  weight: number;
}

export const DEFECTS: Defect[] = [
  { key: 'rayures',      label: 'Rayures sur le disque', weight: 0.1 },
  { key: 'fissure',      label: 'Boîtier fissuré',       weight: 0.06 },
  { key: 'jaunissement', label: 'Plastique jauni',       weight: 0.05 },
  { key: 'etiquette',    label: 'Étiquette de magasin',  weight: 0.04 },
  { key: 'ecriture',     label: 'Écriture / nom dessus', weight: 0.05 },
  { key: 'odeur',        label: 'Odeur (tabac, humidité)', weight: 0.08 },
];

export interface ItemCondition {
  /** Pieces presentes dans la boite. */
  present: PartKey[];
  /** Usure globale, ou par piece si l'utilisateur a detaille. */
  wear: Wear;
  wearByPart?: Partial<Record<PartKey, Wear>>;
  defects: DefectKey[];
  /** true tant que l'utilisateur n'a pas ouvert l'ecran de detail. */
  fromPreset: boolean;
}

// --- Presets de la fiche jeu ------------------------------------------------

export type PresetKey = 'neuf-scelle' | 'complet-tres-bon' | 'complet-correct' | 'sans-notice' | 'jeu-seul';

export const PRESETS: Record<PresetKey, { label: string; condition: ItemCondition }> = {
  'neuf-scelle': {
    label: 'Neuf, scellé',
    condition: {
      present: ['media', 'boitier', 'jaquette', 'notice', 'cale', 'blister'],
      wear: 'neuf', defects: [], fromPreset: true,
    },
  },
  'complet-tres-bon': {
    label: 'Complet, très bon',
    condition: {
      present: ['media', 'boitier', 'jaquette', 'notice', 'cale'],
      wear: 'tres-bon', defects: [], fromPreset: true,
    },
  },
  'complet-correct': {
    label: 'Complet, correct',
    condition: {
      present: ['media', 'boitier', 'jaquette', 'notice'],
      wear: 'correct', defects: [], fromPreset: true,
    },
  },
  'sans-notice': {
    label: 'Sans notice',
    condition: {
      present: ['media', 'boitier', 'jaquette'],
      wear: 'tres-bon', defects: [], fromPreset: true,
    },
  },
  'jeu-seul': {
    label: 'Jeu seul',
    condition: { present: ['media'], wear: 'tres-bon', defects: [], fromPreset: true },
  },
};

export const PRESET_KEYS = Object.keys(PRESETS) as PresetKey[];

/**
 * Convertit l'objet etat en un multiplicateur de prix.
 *
 * Reference = "Complet, tres bon" -> 1.0, parce que c'est l'etat le plus
 * frequent des annonces qu'on mesure. Un exemplaire incomplet descend,
 * un scelle monte.
 */
export function conditionFactor(c: ItemCondition): number {
  const REFERENCE: PartKey[] = ['media', 'boitier', 'jaquette', 'notice', 'cale'];

  let factor = 1;

  // Pieces manquantes par rapport a la reference.
  for (const part of PARTS) {
    const inReference = REFERENCE.includes(part.key);
    const isPresent = c.present.includes(part.key);
    if (inReference && !isPresent) factor -= part.weight;
    // Le blister n'est pas dans la reference : sa presence est un bonus.
    if (part.key === 'blister' && isPresent) factor += part.weight;
  }

  factor *= WEAR_FACTOR[c.wear];

  for (const key of c.defects) {
    const d = DEFECTS.find((x) => x.key === key);
    if (d) factor -= d.weight;
  }

  // Un exemplaire ne vaut jamais rien, et jamais plus du double.
  return Math.max(0.15, Math.min(factor, 2));
}

/** Impact en euros d'une piece, pour l'afficher a cote de sa case a cocher. */
export function partImpact(base: number, c: ItemCondition, part: Part): number {
  const without: ItemCondition = { ...c, present: c.present.filter((p) => p !== part.key) };
  const with_: ItemCondition = {
    ...c,
    present: c.present.includes(part.key) ? c.present : [...c.present, part.key],
  };
  return Math.round((conditionFactor(with_) - conditionFactor(without)) * base);
}

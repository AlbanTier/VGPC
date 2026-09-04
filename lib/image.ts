'use client';

import { TARGET_LONG_EDGE } from './vision-cost';

/**
 * Redimensionne une photo AVANT de l'envoyer à la vision.
 *
 * C'est le seul levier de coût qui compte vraiment : le prix d'un appel dépend
 * des dimensions de l'image, pas de son poids. Une photo d'iPhone fait ~3000 px
 * de large ; à 900 px on paie onze fois moins pour un texte tout aussi lisible.
 *
 * Effet de bord appréciable : l'envoi passe de plusieurs Mo à ~80 Ko, donc
 * c'est aussi nettement plus rapide en 4G.
 */
export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

export async function prepareForVision(
  file: File | Blob,
  longEdge = TARGET_LONG_EDGE,
): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de préparer l’image.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  // 0.72 : au-dessus on gagne peu en lisibilité, en dessous les petits
  // caractères d'une tranche commencent à baver.
  const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

  return { dataUrl, width, height, bytes };
}

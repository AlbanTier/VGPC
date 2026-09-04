# VGPC — application web

Next.js 14 (App Router) + TypeScript + Tailwind. Vise un raccourci iPhone.

## Démarrer

```bash
npm install
cp .env.example .env.local     # remplis au moins TWITCH_CLIENT_ID / SECRET
npm run dev                    # http://localhost:3000
```

Sans aucune clé eBay, l'app tourne quand même : elle bascule sur le fournisseur
bouchon et **l'affiche en jaune sur la fiche jeu**. Tu ne peux pas confondre un
chiffre simulé avec un chiffre de marché.

```bash
npm run test:price   # vérifie la chaîne filtres → prix, hors ligne, sans clé
npm run build        # vérifie que tout compile
```

## Ce qui est déjà là

- **Résolution du jeu** (`lib/igdb.ts`) — le portage exact du spike validé sur
  15 cas : correction des glyphes OCR, passe par les titres FR, pénalité des
  éditions spéciales, dédoublonnage IGDB. **Ne touche pas à ce fichier sans
  relancer une mesure** : chacune de ces trois protections corrige un échec réel.
- **Modèle d'état** (`lib/condition.ts`) — l'état est un objet (pièces présentes,
  usure, défauts), pas un enum. Les presets ne sont que des raccourcis qui le
  pré-remplissent. `partImpact()` donne l'impact en euros d'une pièce, c'est ce
  qu'affichera l'écran 5.
- **Moteur de prix** (`lib/price.ts`) — filtres, MAD, percentiles, facteur d'état.
- **Fournisseurs** (`lib/providers/`) — un contrat commun, trois implémentations.
  Rien en dehors de ce dossier n'importe un fournisseur concret.
- **Écrans** — accueil avec recherche, et fiche jeu avec prix.

## Sources de comparables

`VGPC_SOURCE` = `ebay` | `vinted` | `mock`.

| | Statut | Déployable |
|---|---|---|
| eBay Browse | officiel, gratuit, 5 000 appels/jour | oui |
| Vinted | API interne, **hors CGU**, IP résidentielle obligatoire | **non** |
| mock | annonces simulées, avec le bruit exprès | — |

Le provider Vinted **refuse de démarrer en production** — une IP de datacenter
se fait bloquer, autant échouer franchement plutôt qu'en silence.

## Supabase

Joue `supabase/schema.sql` dans l'éditeur SQL du projet, puis renseigne
`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

La politique RLS actuelle est **volontairement permissive** (accès complet via la
clé anon) parce que l'app est mono-utilisateur. C'est marqué en commentaire dans
le SQL : à remplacer par un filtre sur `auth.uid()` le jour où il y a des comptes.

## Coût de la vision

Le prix d'un appel dépend des **dimensions** de l'image, pas de son poids :
`jetons = ceil(largeur/28) × ceil(hauteur/28)`. Compresser un JPEG ne fait donc
économiser **rien du tout** ; le redimensionner change tout.

`lib/image.ts` ramène chaque photo à 900 px de côté long avant l'envoi, et la
route refuse une image plus grande que 1568 px plutôt que de la payer au prix fort.

Coût mesuré, prompt compris (Haiku 4.5, tarifs de sept. 2026) :

| Envoi | Jetons image | 100 scans | 1000 scans |
|---|---|---|---|
| photo iPhone brute (4032×3024) | 2352 | 0,27 € | 2,72 € |
| **900 px — notre cible** | **825** | **0,13 €** | **1,31 €** |
| tranche recadrée 900×220 | 264 | 0,08 € | 0,79 € |

Sonnet 5 coûte exactement le double. `VISION_MODEL=claude-sonnet-5` si Haiku
bafouille sur du rétro abîmé — mais commence par Haiku, lire du texte imprimé
ne demande pas un gros modèle.

Chaque réponse de `/api/vision` renvoie le champ `cost` avec les jetons
réellement consommés. Tu peux suivre la dépense sans quitter l'app.

## Reste à faire

- Écran 5 (détail de l'exemplaire) et écran 6 (annonce générée)
- Écran 7 (mon stock) branché sur Supabase
- Vision : photo de tranche → titre
- Scan de lot (écrans 2-3) — gardé pour la fin, c'est le morceau risqué
- Cache de prix dans `price_cache`, péremption 3–7 jours

## Un point de modèle à trancher plus tard

Les presets ne forment pas une échelle strictement décroissante : « Sans notice »
(très bon état) ressort légèrement **au-dessus** de « Complet, correct » (usé).
C'est défendable — un exemplaire propre auquel il manque la notice vaut souvent
plus qu'un exemplaire complet mais abîmé — mais ça surprend dans une liste qui se
lit de haut en bas. À recaler quand on aura des prix réels ; les poids actuels
sont des estimations, pas des mesures.

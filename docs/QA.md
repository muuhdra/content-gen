# QA Checklist

Checklist manuelle pour valider le workflow complet:
`Create Project -> Editor Lab -> Script -> Scenes -> Images -> Videos -> Audio -> Captions -> Assembly -> Render`

| Step | Action | Expected Result | Status |
|---|---|---|---|
| 1 | Creer un projet depuis `New Project` | Le projet est cree sans erreur | `[ ]` |
| 2 | Choisir le bon format | Le format affiche dans le projet est correct | `[ ]` |
| 3 | Renseigner `Project Name` et `Project Description` | Le nom et la description sont conserves | `[ ]` |
| 4 | Ouvrir `Editor Lab` apres creation | L'ouverture se fait sur le bon projet | `[ ]` |
| 5 | Modifier `Narration` dans `Editor Lab` | Les reglages sont pris en compte | `[ ]` |
| 6 | Modifier `Visuals` | Les reglages sont pris en compte | `[ ]` |
| 7 | Modifier `Captions` | Les reglages sont pris en compte | `[ ]` |
| 8 | Modifier `Graphics` ou `Effects` | Les reglages sont pris en compte | `[ ]` |
| 9 | Modifier `Music` ou `Sounds` | Les reglages sont pris en compte | `[ ]` |
| 10 | Sauvegarder `Editor Lab` | La sauvegarde reussit sans perte de donnees | `[ ]` |
| 11 | Recharger la page `Editor Lab` | Tous les reglages reviennent correctement | `[ ]` |
| 12 | Generer un script IA | Le script genere apparait correctement | `[ ]` |
| 13 | Sauvegarder un script manuel | Le script manuel remplace correctement l'ancien | `[ ]` |
| 14 | Modifier/regenerer le script apres avoir deja des scenes | `scenes`, `captions`, `assembly` et le plan scene sont invalides | `[ ]` |
| 15 | Generer les scenes | Les scenes correspondent au script courant | `[ ]` |
| 16 | Verifier l'ordre et la coherence des scenes | L'ordre est logique, sans scene heritee d'un ancien script | `[ ]` |
| 17 | Generer des variantes image | Les variantes sont creees pour la bonne scene | `[ ]` |
| 18 | Approuver une image | L'image approuvee devient la source visuelle active | `[ ]` |
| 19 | Generer des variantes video | Les variantes video sont liees a la bonne scene | `[ ]` |
| 20 | Approuver une video | La scene utilise bien la video approuvee | `[ ]` |
| 21 | Configurer une voix standard | La voix choisie reste bien enregistree | `[ ]` |
| 22 | Generer la narration | La narration passe a l'etat attendu | `[ ]` |
| 23 | Configurer `custom narration upload` | Le projet attend un upload, pas une generation | `[ ]` |
| 24 | Uploader une narration custom en prod | L'upload devient la source active de narration | `[ ]` |
| 25 | Configurer musique en mode `generate` | La generation musique est disponible | `[ ]` |
| 26 | Configurer musique en mode `uploaded` | Le projet attend une piste uploadee | `[ ]` |
| 27 | Configurer musique en mode `none` | Aucune generation musique n'est proposee | `[ ]` |
| 28 | Generer soundtrack + SFX | Les etats musique/SFX deviennent coherents | `[ ]` |
| 29 | Generer les captions | Les cues captions sont produites correctement | `[ ]` |
| 30 | Ouvrir la page projet depuis `Projects Factory` | La page sert a executer le workflow, pas a reconfigurer la technique | `[ ]` |
| 31 | Verifier les resumes de config sur la page projet | `tone`, `visual style`, `voice`, `narration direction`, `music mode` sont corrects | `[ ]` |
| 32 | Lancer l'assembly | L'assembly reste `draft` si quelque chose manque, sinon passe au bon etat | `[ ]` |
| 33 | Verifier que l'assembly n'est pas `ready` trop tot | Pas de faux etat pret | `[ ]` |
| 34 | Lancer le render final | Le render ne part que quand tout est reellement pret | `[ ]` |
| 35 | Recharger la page projet apres assembly/render | Les etats restent coherents apres refresh | `[ ]` |
| 36 | Fermer puis rouvrir le projet | Les donnees persistees reviennent correctement | `[ ]` |
| 37 | Verifier le flow avec Supabase si c'est ton mode reel | Meme comportement qu'en stockage fichier | `[ ]` |

## Bug Tracking

Colonnes recommandees si tu veux enrichir ce document pendant la QA:

| Step | Bug? | Severity | Notes |
|---|---|---|---|
| Example | Oui / Non | Critique / Eleve / Moyen / Faible | Description courte du probleme constate |

## Severity Guide

- `Critique`: un etat pret est faux, ou le workflow est bloque.
- `Eleve`: une ancienne donnee reste affichee ou reutilisee apres changement.
- `Moyen`: mauvaise information affichee, mais backend encore coherent.
- `Faible`: probleme de libelle, affichage ou detail UX.

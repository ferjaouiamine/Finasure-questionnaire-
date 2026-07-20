# Prototype Finasure — questionnaire de maturité ERM

Prototype frontend autonome permettant de saisir le profil d’une organisation, répondre à 33 questions en 7 étapes et produire un rapport de maturité sur 11 dimensions.

## Technologies

HTML5, CSS3, JavaScript natif et Chart.js (chargé par CDN sur la page de résultats). Aucun backend, framework, compte ou base de données.

## Structure

- `index.html` : accueil et formulaire d’identification ;
- `questionnaire.html` : parcours de 33 questions ;
- `resultats.html` : rapport, radar et recommandations ;
- `assets/logo-finasure.png` : logo fourni ;
- `css/styles.css` : identité visuelle initiale ;
- `css/style.css` : composants du parcours complet ;
- `css/print.css` : rapport imprimable ;
- `js/questionnaire-data.js` : dimensions, poids, questions, réponses et recommandations ;
- `js/storage.js` : objet unique `finasureErmAssessment` dans `localStorage` ;
- `js/form.js`, `js/questionnaire.js`, `js/resultats.js` : contrôleurs des pages ;
- `js/calcul.js` : calculs métier purs ;
- `js/chart.js` : cycle de vie du radar Chart.js.

## Lancement

```powershell
cd "C:\Users\LENOVO I5\finasure-questionnaire-demo"
python -m http.server 8000
```

Ouvrir `http://localhost:8000`.

## Données Excel

Le classeur attendu est `data/Questionnaire_Maturite_ERM.xlsx`. Il n’était pas présent lors de cette livraison. `js/questionnaire-data.js` contient donc un jeu métier complet de remplacement, explicitement versionné `2026.1-fallback`.

Pour importer le classeur : extraire ses feuilles hors navigateur, mapper les lignes vers le schéma de `questionnaire-data.js`, vérifier 33 questions, 11 dimensions, 5 réponses par question, une somme des poids de 100 %, puis remplacer ce fichier. Le prototype ne lit jamais Excel à l’exécution.

## Calcul

Le score d’une dimension est la moyenne de ses réponses. Le score global est `somme(scoreDimension × poids) / 100`. Les priorités utilisent `(5 − scoreDimension) × poids`. Les égalités sont départagées par poids puis ordre source.

## Stockage et limites

Toutes les données restent dans un seul objet local au navigateur. Effacer les données du site supprime l’évaluation. Chart.js et Google Fonts nécessitent actuellement une connexion ; sans Chart.js, un message accessible remplace le radar et les scores textuels restent visibles. Ce prototype n’est ni un audit ni une mesure de conformité.

## Intégration WordPress future

Intégrer les trois vues dans un thème ou plugin, embarquer localement les dépendances, remplacer les données de secours par l’export Excel validé, ajouter la politique de confidentialité et connecter le bouton d’accompagnement au formulaire de contact définitif.

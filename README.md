# Prototype Finasure — questionnaire de maturité ERM

Prototype frontend autonome permettant de réaliser une auto-évaluation, consulter immédiatement un aperçu, puis débloquer un rapport détaillé après validation des informations du répondant.

## Parcours utilisateur

1. `index.html` présente la démarche ; le CTA est placé après tout le contenu.
2. `questionnaire.html` affiche les questions en quatre étapes thématiques.
3. `resultats.html` affiche uniquement le score global, son interprétation et le radar.
4. Le CTA « Recevoir mon rapport gratuit » ouvre `demande-rapport.html`.
5. Après validation du formulaire, `rapport-complet.html` présente forces, priorités, dimensions et recommandations.
6. Le répondant peut imprimer/enregistrer le rapport en PDF ou prendre rendez-vous.

## Fichiers principaux

- `index.html` : accueil et CTA final ;
- `questionnaire.html` : questionnaire ;
- `resultats.html` : aperçu protégé ;
- `demande-rapport.html` : collecte des informations ;
- `rapport-complet.html` : rapport détaillé protégé ;
- `rendez-vous.html` : calendrier et formulaire de rendez-vous fictifs ;
- `js/questionnaire-data.js` : questions, choix, dimensions, poids et recommandations ;
- `js/storage.js` : stockage version 2026.3 et migration ;
- `js/questionnaire.js` : navigation et validation ;
- `js/resultats.js` : score et radar ;
- `js/demande-rapport.js` : validation du formulaire ;
- `js/rapport-complet.js` : rapport, impression et rendez-vous ;
- `js/calendar-data.js` : disponibilités fictives isolées et `getAvailableSlots(date)` ;
- `js/rendez-vous.js` : navigation mensuelle, sélection et sauvegarde de la demande ;
- `js/calcul.js` : calculs métier ;
- `js/chart.js` : radar Chart.js ;
- `css/style.css` et `css/print.css` : affichage responsive et impression A4.

## Réponses exactes du classeur

Les 33 questions et leurs 165 réponses sont importées depuis `data/Questionnaire_Maturite_ERM(1).xlsx`, feuille `1. Questionnaire`. La question provient de la colonne C et les réponses A à E des colonnes D à H. Les scores internes restent respectivement 1 à 5.

Le script `tools/import_excel_questions.py` permet de régénérer et valider la section correspondante de `js/questionnaire-data.js`. Il refuse l’import si le nombre de questions est différent de 33, si une réponse manque, si deux réponses d’une question sont identiques ou si les scores ne suivent pas l’ordre 1 à 5.

## Contrôles d’accès

- l’aperçu exige un questionnaire complet ;
- la collecte exige des résultats valides ;
- le rapport complet exige le questionnaire, les résultats, le formulaire et le consentement ;
- aucune donnée personnelle n’est placée dans l’URL.

La clé localStorage reste `finasureErmAssessment`. La version 2026.3 ajoute `leadFormCompleted` et conserve la migration des anciennes réponses, commentaires, résultats et coordonnées.

## Calculs

- score d’une dimension : moyenne de ses réponses ;
- score global : `somme(scoreDimension × poids) / 100` ;
- priorité : `(5 − scoreDimension) × poids` ;
- pourcentage indicatif : `scoreGlobal / 5 × 100`.

## PDF et rendez-vous

Le bouton PDF ouvre `window.print()` et la feuille `css/print.css` permet d’imprimer ou d’enregistrer en PDF. Les recommandations sont ouvertes avant impression.

Le rapport redirige actuellement vers le calendrier de démonstration :

```javascript
const APPOINTMENT_URL = "rendez-vous.html";
```

Les disponibilités fictives sont définies dans `js/calendar-data.js` : jours ouvrés du lundi au vendredi, six horaires, dates complètes et délai minimal de sept jours. La fonction `getAvailableSlots(date)` constitue le point de remplacement futur par un appel à un véritable service de calendrier. Les demandes de démonstration sont enregistrées dans `finasureErmAssessment.booking.appointment`.

## Lancement

```powershell
cd "C:\Users\LENOVO I5\finasure-questionnaire-demo"
python -m http.server 8000
```

Ouvrir `http://localhost:8000`.

## Limites avant production

- importer les réponses exactes du classeur Excel ;
- configurer l’URL définitive de rendez-vous ;
- tester l’impression sur les navigateurs cibles ;
- ajouter les mentions de confidentialité ;
- héberger Chart.js et les polices localement si un fonctionnement hors ligne est requis ;
- intégrer les vues et scripts dans un plugin ou thème WordPress.

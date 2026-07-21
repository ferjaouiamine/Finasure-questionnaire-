# Prototype Finasure — questionnaire de maturité ERM

Prototype frontend autonome permettant de réaliser une évaluation guidée, consulter immédiatement un rapport sur onze dimensions, puis fournir ses coordonnées uniquement pour imprimer le rapport ou prendre rendez-vous.

## Nouveau parcours 2026.2

1. Ouvrir l’accueil et commencer l’évaluation.
2. Répondre à toutes les questions en quatre étapes thématiques.
3. Consulter immédiatement les résultats, sans formulaire client.
4. Choisir « Imprimer ou enregistrer mon rapport » ou « Prendre rendez-vous ».
5. Remplir le formulaire réutilisable uniquement à ce moment.
6. Imprimer le rapport ou afficher Microsoft Bookings.

Les quatre étapes sont : Stratégie et gouvernance ; Analyse des risques ; Suivi et continuité ; Crise et résilience. Toutes les questions, pondérations et formules initiales sont conservées.

## Technologies

HTML5, CSS3, JavaScript natif, localStorage et Chart.js chargé par CDN. Aucun backend, framework, compte ou base de données.

## Structure

- `index.html` : accueil sans formulaire bloquant ;
- `questionnaire.html` : questionnaire en quatre étapes ;
- `resultats.html` : rapport gratuit, modale client et zone Booking ;
- `css/styles.css` : identité visuelle ;
- `css/style.css` : composants, responsive et modales ;
- `css/print.css` : rapport imprimable ;
- `js/questionnaire-data.js` : questions, réponses, dimensions, poids et recommandations ;
- `js/storage.js` : stockage 2026.2 et migration ;
- `js/questionnaire.js` : affichage, progression, validation et navigation ;
- `js/calcul.js` : calculs métier ;
- `js/chart.js` : radar Chart.js ;
- `js/resultats.js` : génération sécurisée du rapport ;
- `js/client-form.js` : formulaire différé, impression et Booking.

## Stockage local

La clé reste `finasureErmAssessment`. Le schéma 2026.2 contient les réponses, commentaires, éléments de preuve, coordonnées client, résultats, action sélectionnée, configuration Booking, statuts d’achèvement et dates de mise à jour.

`migrateAssessmentData(oldData)` préserve les réponses, commentaires, résultats et anciennes coordonnées provenant de `company` et `respondent`. L’étape ancienne est ramenée dans l’intervalle 1 à 4.

## Calcul

- Score d’une dimension : moyenne de ses réponses.
- Score global : `somme(scoreDimension × poids) / 100`.
- Priorité : `(5 − scoreDimension) × poids`.
- Pourcentage indicatif : `scoreGlobal / 5 × 100`.

Les catégories internes restent utilisées pour choisir la bonne recommandation, mais leurs appellations ne sont jamais affichées au client.

## Téléchargement PDF

Le bouton « Télécharger le rapport en PDF » ouvre le formulaire client. Après validation, les coordonnées sont sauvegardées et ajoutées au rapport. `html2pdf.js` génère ensuite localement un document A4 nommé `Rapport_Maturite_ERM_Finasure.pdf` et déclenche son téléchargement. Le menu, le footer, les actions, les modales et le calendrier sont exclus du fichier. La page et les résultats restent disponibles après le téléchargement.

## Configuration Microsoft Bookings

La configuration se trouve uniquement dans `js/client-form.js` :

```javascript
const BOOKING_URL = "COLLER_ICI_MON_LIEN_MICROSOFT_BOOKINGS";
const MIN_BOOKING_DELAY_DAYS = 7;
```

Remplacer la valeur de `BOOKING_URL` par l’URL publique de la page Microsoft Bookings. Tant qu’elle n’est pas remplacée, l’application affiche un message professionnel au lieu d’un calendrier vide.

Dans Microsoft Bookings :

1. ouvrir la page ou le service concerné ;
2. régler le délai minimal de réservation sur 7 jours ;
3. vérifier le fuseau horaire de l’organisation et celui affiché au client ;
4. définir les jours et heures disponibles ;
5. vérifier la durée et l’espacement des créneaux ;
6. publier la page ;
7. copier son URL publique dans `BOOKING_URL` ;
8. tester l’URL dans l’iframe et dans un nouvel onglet.

Le frontend calcule et affiche la première date théorique disponible, mais ne peut pas modifier le contenu de l’iframe Microsoft à cause des restrictions cross-origin. La règle doit donc impérativement être configurée dans Bookings. Le lien « Ouvrir le calendrier dans un nouvel onglet » sert de solution de secours si l’intégration est bloquée.

## Lancement local

```powershell
cd "C:\Users\LENOVO I5\finasure-questionnaire-demo"
python -m http.server 8000
```

Ouvrir `http://localhost:8000`.

## Tests à réaliser avant publication

- parcours complet des quatre étapes ;
- blocage d’une étape incomplète ;
- retour arrière et rafraîchissement sans perte ;
- progression et calculs pour des réponses de 1 à 5 ;
- rapport accessible sans coordonnées ;
- absence des appellations de catégories dans l’interface et l’impression ;
- validation de chaque champ client ;
- impression et enregistrement PDF ;
- préremplissage lors de la seconde action ;
- Booking configuré et non configuré ;
- message et date minimale à sept jours ;
- clavier, Échap, piège et retour du focus ;
- affichage à 375, 768, 1024 et 1440 px.

## Limites techniques

Chart.js et Google Fonts nécessitent une connexion. Une iframe Microsoft Bookings peut être refusée par les règles de sécurité du service ; le lien externe reste alors disponible. localStorage est propre au navigateur et ne constitue pas une base de données sécurisée. Le classeur Excel source n’était pas disponible : les données métier actuelles restent la version de remplacement `2026.1-fallback`.

## Mise en production et WordPress

Avant intégration : remplacer les données métier par l’export Excel validé, configurer Bookings, héberger si possible Chart.js et les polices localement, ajouter les mentions de confidentialité, tester les navigateurs et lecteurs d’écran, puis intégrer les vues et scripts dans un plugin ou thème WordPress en conservant une seule instance du questionnaire par page.

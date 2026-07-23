# Mise en production Supabase — Finasure ERM

Cette application est préparée pour recevoir des données réelles. Les données
fictives sont isolées dans `supabase/examples/demo-seed.sql` et ne sont jamais
chargées automatiquement.

## Installation

1. Créez un projet Supabase dans une région adaptée à vos contraintes.
2. Dans **SQL Editor**, exécutez
   `supabase/migrations/202607230001_initial_erm_admin.sql`.
3. Copiez l’URL du projet et la clé publique `publishable` (ou `anon` pour un
   ancien projet) depuis **Project Settings > API**.
4. Renseignez-les dans `js/supabase-config.js`.

La clé `service_role` est strictement interdite dans le frontend. L’écriture
publique passe uniquement par des fonctions SQL contrôlées et toutes les tables
sont protégées par la Row Level Security.

## Premier administrateur

Dans **Authentication > Users**, créez l’utilisateur, copiez son UUID puis
exécutez :

```sql
insert into public.admin_users (user_id, display_name, role)
values ('UUID_AUTH_ICI', 'Administrateur Finasure', 'admin');
```

L’administration est disponible dans `admin/login.html`.

## Lancement

Le projet doit être servi en HTTP(S), jamais directement en `file://`.

```powershell
python -m http.server 8080
```

Ouvrez `http://localhost:8080/` pour le questionnaire et
`http://localhost:8080/admin/login.html` pour l’administration.

En production, utilisez exclusivement HTTPS et ajoutez le domaine public dans
la configuration d’URL de Supabase Auth.

## Synchronisation

Après validation du formulaire d’identité et du consentement, l’évaluation est
envoyée à la fonction `submit_assessment`. Une clé d’idempotence évite les
doublons. En cas de coupure réseau, le parcours continue avec la copie locale.
Les téléchargements de rapport et demandes de rendez-vous alimentent ensuite
l’historique.

## Checklist avant données réelles

- Remplacer les valeurs `COLLER_ICI_...` dans `js/supabase-config.js`.
- Ne jamais exécuter `supabase/examples/demo-seed.sql` en production.
- Activer MFA pour les administrateurs selon votre politique de sécurité.
- Définir durée de conservation, effacement et registre des accès.
- Faire valider le consentement et la politique de confidentialité.
- Configurer CSP, HSTS et les domaines autorisés sur l’hébergement.
- Tester les sauvegardes et leur restauration.

## Tests fonctionnels

1. Compléter le questionnaire et comparer les scores avec la version initiale.
2. Valider le formulaire, puis contrôler les réponses, dimensions et score dans
   le back-office.
3. Rafraîchir après validation : aucune évaluation en double ne doit apparaître.
4. Couper le réseau et vérifier que le parcours aboutit localement.
5. Tester le rapport et une demande de rendez-vous.
6. Vérifier qu’une page admin sans session redirige vers la connexion.
7. Vérifier qu’un utilisateur Auth absent de `admin_users` est refusé.

Pour une démonstration isolée, exécutez manuellement
`supabase/examples/demo-seed.sql` dans un projet Supabase distinct.

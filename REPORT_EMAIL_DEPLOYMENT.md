# Déploiement de l’envoi automatique des rapports ERM

## Architecture

Après `verifyOtp()`, le navigateur enregistre la vérification avec la session
Supabase puis invoque `send-erm-report` avec uniquement `assessment_id`.
L’Edge Function récupère l’adresse depuis Supabase Auth, vérifie
`respondents.auth_user_id`, génère le PDF avec les données PostgreSQL, puis
l’envoie via Resend. Aucun secret n’est envoyé au navigateur.

## 1. Migration SQL

Exécuter dans **Supabase > SQL Editor** :

`supabase/migrations/202607230003_automatic_pdf_reports.sql`

Cette migration :

- crée `assessment_recommendations` ;
- complète `reports` avec le répondant, le destinataire et les informations du
  fournisseur ;
- ajoute les statuts `pending`, `generating`, `generated`, `sent`, `failed` ;
- protège les recommandations par RLS ;
- crée la fonction contrôlée de sauvegarde des recommandations ;
- empêche le téléchargement web de rétrograder un rapport déjà envoyé.

## 2. Préparer Resend

1. Créer un compte Resend.
2. Ajouter et vérifier le domaine d’expédition.
3. Ajouter dans le DNS les enregistrements demandés par Resend.
4. Créer une API key limitée à l’envoi.
5. Préparer une adresse telle que `rapports@votre-domaine.com`.

## 3. Secrets Edge Function

Dans **Supabase > Edge Functions > Secrets**, ajouter :

```text
RESEND_API_KEY=re_...
FINASURE_FROM_EMAIL=Finasure <rapports@votre-domaine.com>
FINASURE_CONTACT_EMAIL=contact@votre-domaine.com
FINASURE_LOGO_URL=https://votre-domaine.vercel.app/assets/logo-finasure.png
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis
automatiquement à la fonction hébergée par Supabase. Ne jamais les ajouter au
frontend.

Alternative CLI : créer localement `.env.functions`, qui est ignoré par Git :

```text
RESEND_API_KEY=re_...
FINASURE_FROM_EMAIL=Finasure <rapports@votre-domaine.com>
FINASURE_CONTACT_EMAIL=contact@votre-domaine.com
FINASURE_LOGO_URL=https://votre-domaine.vercel.app/assets/logo-finasure.png
```

Puis :

```powershell
npx supabase secrets set --env-file .env.functions --project-ref dwvkbpgibfgwrlxxzfaj
```

## 4. Déployer la fonction

```powershell
cd "C:\Users\LENOVO I5\finasure-questionnaire-demo"
npx supabase login
npx supabase link --project-ref dwvkbpgibfgwrlxxzfaj
npx supabase functions deploy send-erm-report --use-api
```

Ne pas utiliser `--no-verify-jwt`. La fonction et `supabase/config.toml`
conservent la validation JWT.

## 5. Test local du frontend

```powershell
python -m http.server 8080
node tests/validate-project.js
node tests/validate-otp.js
node tests/validate-report-flow.js
```

Pour exécuter l’Edge Function localement, Docker et le CLI Supabase sont requis :

```powershell
npx supabase start
npx supabase functions serve send-erm-report --env-file .env.functions
```

Un test complet avec OTP réel nécessite un environnement Auth et une adresse de
test. Ne jamais utiliser les données d’une entreprise réelle pour un test.

## 6. Tests en production contrôlée

Utiliser d’abord une adresse interne :

1. OTP invalide : vérifier qu’aucune invocation d’envoi n’a lieu.
2. OTP valide : vérifier les événements `email_verified`,
   `report_generated`, puis `report_sent`.
3. Vérifier le PDF, ses 11 dimensions, le radar, les trois forces, les trois
   priorités et les recommandations.
4. Rafraîchir : le statut `already_sent` doit apparaître sans nouvel email.
5. Forcer une erreur Resend avec une clé de test invalide dans un projet de
   staging : le rapport web doit rester accessible et `reports.status` doit être
   `failed`.
6. Tester un autre utilisateur Auth sur le même `assessment_id` : la fonction
   doit répondre `403 assessment_access_denied`.
7. Vérifier les filtres de la page Rapports du dashboard.

## 7. Vercel et Git

Aucune variable secrète Vercel n’est nécessaire pour l’envoi : le backend est
hébergé dans Supabase. Après validation :

```powershell
git add .
git commit -m "Ajout de l’envoi automatique du rapport PDF"
git push
```

Attendre le statut **Ready** dans Vercel, effectuer un rechargement forcé, puis
réaliser le test contrôlé.

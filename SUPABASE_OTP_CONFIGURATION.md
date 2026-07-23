# Configuration OTP email Supabase — Finasure

## Migration

Dans **Supabase > SQL Editor**, exécuter entièrement :

`supabase/migrations/202607230002_email_otp.sql`

Elle ajoute `auth_user_id`, `email_verified` et `email_verified_at` à la table
`respondents`, puis crée les fonctions sécurisées de validation et de contrôle
d’accès au rapport.

## Fournisseur email

Dans **Authentication > Sign In / Providers > Email** :

- activer le fournisseur Email ;
- autoriser la création d’utilisateurs ;
- conserver un OTP de 6 chiffres ;
- choisir une expiration courte, par exemple 10 minutes.

## Modèle du code OTP

Dans **Authentication > Email Templates > Magic Link**, utiliser
`{{ .Token }}` et ne pas utiliser `{{ .ConfirmationURL }}`.

Sujet :

```text
Votre code de vérification Finasure
```

Modèle :

```html
<h2>Vérification de votre adresse email</h2>
<p>Voici votre code de vérification Finasure :</p>
<p style="font-size:30px;font-weight:700;letter-spacing:8px">
  {{ .Token }}
</p>
<p>Ce code est temporaire. Ne le communiquez à personne.</p>
```

## URL et envoi

Dans **Authentication > URL Configuration**, renseigner le domaine Vercel de
production et garder `http://localhost:8080/**` dans les URL autorisées.

Le service email intégré de Supabase est destiné aux essais et applique des
limites faibles. Avant la production, configurer un SMTP professionnel dans les
paramètres Authentication. Vérifier également les limites dans
**Authentication > Rate Limits**. L’interface impose déjà 60 secondes avant un
nouvel envoi.

## Test local

1. Lancer `python -m http.server 8080`.
2. Terminer une évaluation et demander le rapport.
3. Utiliser une adresse accessible.
4. Tester un mauvais code : le rapport doit rester verrouillé.
5. Tester le bon code : le rapport doit s’ouvrir.
6. Dans `respondents`, vérifier `email_verified = true` et la date.
7. Accéder directement à `rapport-complet.html` sans OTP : la page doit
   rediriger vers `verification-email.html`.

## Test Vercel

Après le `git push`, attendre un déploiement Vercel **Ready**, refaire le
parcours depuis le domaine de production, puis contrôler le badge « Vérifiée »
dans l’administration.

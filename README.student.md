# Guide de Reproduction : Application d'Abonnement avec Next.js et Stripe

Ce document détaille l'architecture et les étapes pour reproduire ce projet. L'objectif est de construire une application web où les utilisateurs peuvent s'authentifier, souscrire à un abonnement payant via Stripe, et accéder à du contenu exclusif.

## 1. Analyse de la Structure du Projet

Comprendre le rôle de chaque fichier est essentiel pour maîtriser le projet.

```
/paiement-stripe
├───.gitignore
├───package.json         # Dépendances et scripts du projet
├───prisma/              # Tout ce qui concerne la base de données
│   └───schema.prisma    # Définit les modèles de données (User, etc.)
├───public/              # Fichiers statiques (images, icônes)
└───src/
    ├───app/
    │   ├───layout.tsx     # Layout principal de l'application
    │   ├───page.tsx       # Page d'accueil (publique)
    │   ├───providers.tsx  # Fournisseur de session pour NextAuth
    │   ├───api/           # Dossier pour toutes les routes d'API
    │   │   ├───auth/      # Logique d'authentification
    │   │   │   └───[...nextauth]/route.ts # Cœur de NextAuth.js
    │   │   └───checkout/  # Logique de paiement
    │   │       └───route.ts # Crée la session de paiement Stripe
    │   ├───premium/       # Contenu protégé
    │   │   └───page.tsx   # Page accessible uniquement aux abonnés
    │   ├───paywall/       # Page "mur de paiement"
    │   │   └───page.tsx   # Page incitant à s'abonner
    │   ├───success/       # Page de succès après paiement
    │   │   └───page.tsx
    │   └───cancel/
    │       └───page.tsx   # Page d'annulation de paiement
    └───lib/
        └───prisma.ts      # Instance unique du client Prisma (bonne pratique)
```

### Fichiers et Dossiers Clés

*   **`prisma/schema.prisma`**: C'est ici que vous définissez votre base de données. Le modèle `User` est enrichi avec des champs comme `isSubscribed` et `stripeCustomerId` pour suivre le statut de l'abonnement de chaque utilisateur.

*   **`src/app/api/auth/[...nextauth]/route.ts`**: Le moteur de l'authentification. Il configure les fournisseurs (ex: GitHub, Google) et utilise le `PrismaAdapter` pour lier NextAuth à votre base de données. Chaque utilisateur qui se connecte est automatiquement sauvegardé dans la table `User`.

*   **`src/app/api/checkout/route.ts`**: Une route backend qui est appelée lorsque l'utilisateur clique sur "S'abonner". Son rôle est de communiquer avec Stripe pour créer une session de paiement sécurisée et de rediriger l'utilisateur vers la page de paiement de Stripe.

*   **`src/app/api/webhook/route.ts` (À créer)**: C'est le fichier le plus critique pour la synchronisation. Stripe envoie des événements (webhooks) à cette URL pour notifier votre application en temps réel (ex: "le paiement a réussi", "l'abonnement est annulé"). C'est cette route qui mettra à jour le champ `isSubscribed` dans votre base de données.

*   **`src/app/premium/page.tsx`**: Un exemple de page protégée. Avant d'afficher le contenu, ce composant vérifie côté serveur si l'utilisateur est connecté ET si son champ `isSubscribed` est à `true`.

*   **`src/lib/prisma.ts`**: Permet de s'assurer qu'il n'y a qu'une seule instance active du client Prisma dans l'application, ce qui évite des problèmes de connexions multiples à la base de données.

## 2. Étapes de Reproduction du Projet

Voici les étapes pour construire ce projet à partir de zéro.

### Étape 1 : Initialisation et Installation

1.  **Créez une nouvelle application Next.js :**
    ```bash
    npx create-next-app@latest --typescript --tailwind --eslint mon-app-stripe
    cd mon-app-stripe
    ```

2.  **Installez les dépendances :**
    ```bash
    npm install prisma @prisma/client next-auth @auth/prisma-adapter stripe
    npm install -D prisma
    ```

### Étape 2 : Configuration de la Base de Données

1.  **Initialisez Prisma :**
    ```bash
    npx prisma init
    ```

2.  **Configurez votre `.env`** avec l'URL de votre base de données (PostgreSQL, MySQL, etc.).
    ```env
    # .env
    DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
    ```

3.  **Modifiez le `prisma/schema.prisma`** pour y inclure les modèles nécessaires pour NextAuth et les champs pour Stripe, comme montré dans la section d'analyse.

4.  **Appliquez les changements à votre base de données :**
    ```bash
    npx prisma migrate dev --name initial-setup
    ```
    Cette commande crée les tables dans votre base de données.

### Étape 3 : Mise en Place de l'Authentification

1.  **Créez la route d'API NextAuth** dans `src/app/api/auth/[...nextauth]/route.ts` et configurez-la avec l'adaptateur Prisma et au moins un fournisseur d'authentification (ex: GitHub).

2.  **Ajoutez les variables d'environnement** pour NextAuth et votre fournisseur dans `.env`.
    ```env
    # .env
    GITHUB_CLIENT_ID=...
    GITHUB_CLIENT_SECRET=...
    NEXTAUTH_SECRET="VOTRE_SECRET_SUPER_COMPLEXE"
    NEXTAUTH_URL="http://localhost:3000"
    ```

3.  **Enveloppez votre application** avec le `SessionProvider` comme vu dans le fichier `src/app/providers.tsx` et `src/app/layout.tsx`.

### Étape 4 : Intégration de Stripe

1.  **Créez un compte Stripe** et récupérez vos clés API.

2.  **Créez un "Produit"** dans votre Dashboard Stripe (par exemple, "Abonnement Premium") et ajoutez-lui un **tarif** (ex: 10€/mois). Récupérez l'ID du tarif (`price_...`).

3.  **Ajoutez les clés Stripe à votre `.env`** :
    ```env
    # .env
    STRIPE_SECRET_KEY=sk_test_...
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
    STRIPE_PRICE_ID=price_...
    ```

4.  **Créez la route `src/app/api/checkout/route.ts`**. Cette route contiendra la logique pour créer une `checkout.session` Stripe.

5.  **Créez la route `src/app/api/webhook/route.ts`**. C'est ici que vous écouterez l'événement `checkout.session.completed` pour mettre à jour la base de données.

6.  **Configurez un endpoint de Webhook dans le Dashboard Stripe** pour pointer vers `http://localhost:3000/api/webhook` (en développement, utilisez l'outil `stripe listen` pour transférer les événements à votre machine locale). Récupérez le secret du webhook (`whsec_...`) et ajoutez-le à `.env`.
    ```env
    # .env
    STRIPE_WEBHOOK_SECRET=whsec_...
    ```

### Étape 5 : Création des Pages Frontend

1.  **Créez la page `/paywall`** avec un bouton "S'abonner". Le clic sur ce bouton doit appeler votre API `/api/checkout`.

2.  **Créez la page `/premium`** et protégez-la en vérifiant la session de l'utilisateur et son statut `isSubscribed`.

3.  **Créez les pages `/success` et `/cancel`** vers lesquelles Stripe redirigera l'utilisateur après la tentative de paiement.

### Étape 6 : Lancement et Test

1.  **Démarrez le serveur de développement :**
    ```bash
    npm run dev
    ```

2.  **Dans un autre terminal, lancez le CLI Stripe :**
    ```bash
    stripe listen --forward-to localhost:3000/api/webhook
    ```

3.  **Testez le flux complet :** créez un compte, essayez d'accéder à la page premium (vous devriez être bloqué), allez sur la page de paiement, complétez le paiement avec une carte de test Stripe, et vérifiez que vous avez maintenant accès à la page premium.
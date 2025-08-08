# Guide Pédagogique : Application d'Achat de Produits avec Next.js et Stripe

Ce document détaille l'architecture, les fonctionnalités et les étapes qui ont été suivies pour construire ce projet. L'objectif est de créer une application web complète où les utilisateurs peuvent :
1.  S'authentifier via des fournisseurs OAuth (GitHub, Google).
2.  Acheter des produits individuels.
3.  Gérer leur historique d'achats.

## 1. Analyse de la Structure du Projet

Voici un aperçu des fichiers et dossiers les plus importants et de leur rôle dans l'application.

```
/paiement-stripe
├───prisma/
│   ├───schema.prisma      # Définit les modèles de données (User, Product, Order).
│   └───seed.ts            # Script pour pré-remplir la DB avec des produits.
├───public/
│   └───products/          # Images des produits.
└───src/
    ├───app/
    │   ├───layout.tsx       # Layout principal de l'application.
    │   ├───page.tsx         # Page d'accueil (publique).
    │   ├───providers.tsx    # Fournisseur de session pour NextAuth.
    │   ├───api/
    │   │   ├───auth/
    │   │   │   └───[...nextauth]/route.ts # Cœur de NextAuth.js pour l'authentification.
    │   │   ├───checkout/
    │   │   │   └───route.ts   # Crée la session de paiement Stripe.
    │   │   └───webhook/
    │   │       └───route.ts   # (Futur) Écoute les événements Stripe (webhooks).
    │   ├───products/
    │   │   └───page.tsx     # Affiche tous les produits disponibles.
    │   ├───payment-success/
    │   │   └───page.tsx     # Page de succès après un paiement.
    │   └───cancel/
    │       └───page.tsx     # Page d'annulation de paiement.
    ├───components/
    │   └───Header.tsx       # Barre de navigation, affiche l'état de connexion.
    └───lib/
        └───prisma.ts        # Instance unique du client Prisma.
```

## 2. Fonctionnalités Clés et Explication du Code

### A. Base de Données avec Prisma

Le schéma de la base de données est le fondement de l'application.

**Fichier clé : `prisma/schema.prisma`**

*   **`User`** : Ce modèle a été enrichi pour gérer l'état de l'abonnement et la relation avec Stripe.
    *   `hasPaid`: Un booléen qui nous permet de savoir instantanément si un utilisateur a déjà effectué un achat.
    *   `stripeCustomerId`: Un champ crucial qui stocke l'ID du client dans Stripe. Cela permet de lier un utilisateur de notre base de données à un client dans Stripe, essentiel pour gérer les paiements.

*   **`Product`** : Stocke les informations sur les articles à vendre.

*   **`Order`** : Enregistre chaque transaction effectuée.
    *   Permet de suivre quels produits ont été achetés par quel utilisateur.

*   **`OrderItem`** : Représente un article spécifique dans une commande.

### B. Authentification avec NextAuth.js

L'authentification est gérée par NextAuth, qui s'intègre parfaitement avec Prisma.

**Fichier clé : `src/app/api/auth/[...nextauth]/route.ts`**

Ce fichier configure NextAuth.js :
1.  **`PrismaAdapter`** : C'est le pont entre NextAuth et notre base de données. Quand un utilisateur se connecte pour la première fois avec un fournisseur (ex: GitHub), l'adaptateur crée automatiquement une nouvelle entrée `User` dans notre base de données.
2.  **`events`** : Nous utilisons l'événement `createUser` pour une action spécifique : dès qu'un nouvel utilisateur est créé dans notre base de données, nous créons également un client (`Customer`) correspondant dans Stripe. L'ID de ce client Stripe est immédiatement sauvegardé dans notre champ `user.stripeCustomerId`.

### C. Processus de Paiement avec Stripe Checkout

Lorsqu'un utilisateur décide d'acheter un produit.

**Fichier clé : `src/app/api/checkout/route.ts`**

Cette route d'API est appelée par le front-end. Voici son fonctionnement :
1.  Elle récupère l'utilisateur actuel via la session NextAuth pour obtenir son `stripeCustomerId`.
2.  Elle crée une **Session de Paiement Stripe** (`checkout.session`) en spécifiant :
    *   `customer`: Le `stripeCustomerId` de l'utilisateur.
    *   `line_items`: La liste des produits (avec leur `priceId` et quantité).
    *   `mode`: `'payment'` pour un achat unique.
    *   `success_url` et `cancel_url`: Les pages vers lesquelles l'utilisateur sera redirigé après la transaction.
3.  Elle renvoie l'URL de la page de paiement Stripe au client, qui s'y redirige.

### D. Confirmation de Paiement (Côté Client)

Dans ce projet, la confirmation du paiement et la mise à jour de la base de données sont gérées côté client, sur la page de succès. **Ceci est une approche simplifiée à des fins pédagogiques.**

**Fichier clé : `src/app/payment-success/page.tsx`**

1.  **Récupération de la session Stripe** : Lorsque l'utilisateur est redirigé vers cette page après un paiement, l'URL contient un `session_id`. Nous utilisons cet ID pour récupérer les détails de la session de paiement auprès de Stripe.
2.  **Vérification de sécurité** : Nous vérifions que l'ID de l'utilisateur dans la session Stripe (`metadata.userId`) correspond à l'ID de l'utilisateur actuellement connecté. C'est une mesure de sécurité pour s'assurer que l'utilisateur correct est crédité pour l'achat.
3.  **Mise à jour de la base de données** : En fonction du type d'achat (stocké dans les `metadata` de la session Stripe), nous effectuons les actions suivantes :
    *   **Achat de produit unique** : Nous créons une nouvelle `Order` et les `OrderItem` associés dans la base de données.
    *   **Accès premium** : Nous mettons à jour le champ `hasPaid` de l'utilisateur à `true`.
4.  **Redirection** : L'utilisateur est ensuite redirigé vers la page appropriée (`/products` ou `/premium`).

> **Note Importante** : Gérer la logique de confirmation côté client n'est **pas recommandé en production**. Un utilisateur pourrait potentiellement accéder à l'URL de succès sans avoir réellement payé. La méthode robuste consiste à utiliser les Webhooks Stripe.

### E. (Avancé) Synchronisation avec les Webhooks Stripe

Les webhooks sont le mécanisme **recommandé en production** pour maintenir une base de données à jour de manière fiable et sécurisée.

**Fichier clé : `src/app/api/webhook/route.ts`**

Bien que la logique principale soit sur la page de succès dans ce projet, voici comment un webhook fonctionnerait :
1.  **Événements Asynchrones** : Stripe envoie des notifications (événements) à cette route de manière asynchrone dès qu'un événement pertinent se produit (par exemple, `checkout.session.completed`).
2.  **Sécurité** : La première étape cruciale est de vérifier que la requête provient bien de Stripe en utilisant la `stripe-signature` et un secret de webhook. Cela empêche les attaques malveillantes.
3.  **Traitement Fiable** : Le serveur traite l'événement et met à jour la base de données. Cela fonctionne même si l'utilisateur ferme son navigateur immédiatement après le paiement, garantissant qu'aucune transaction n'est perdue.

## 3. Étapes pour Lancer le Projet en Local

Voici les étapes pour faire fonctionner ce projet sur votre machine.

### Étape 1 : Clonage et Installation

1.  **Clonez le projet et installez les dépendances :**
    ```bash
    # git clone ...
    cd paiement-stripe
    npm install
    ```

### Étape 2 : Configuration de l'Environnement

1.  **Copiez le fichier d'environnement exemple :**
    ```bash
    cp .env.example .env
    ```
2.  **Remplissez le fichier `.env`** avec vos propres clés :
    *   `DATABASE_URL`: L'URL de votre base de données (PostgreSQL, MySQL, etc.).
    *   `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET`: Depuis votre application OAuth GitHub.
    *   `NEXTAUTH_SECRET`: Un secret aléatoire (`openssl rand -base64 32`).
    *   `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`: Depuis votre Dashboard Stripe.

### Étape 3 : Configuration de la Base de Données

1.  **Appliquez le schéma Prisma à votre base de données :**
    ```bash
    npx prisma migrate dev
    ```
    Cette commande crée toutes les tables (`User`, `Product`, `Order`, etc.).

2.  **Pré-remplissez la base de données avec les produits :**
    ```bash
    npm run prisma:seed
    ```
    Cela exécute le script `prisma/seed.ts` pour créer les produits que vous avez définis.

### Étape 4 : Lancement et Test

1.  **Démarrez le serveur de développement :**
    ```bash
    npm run dev
    ```

2.  **Testez le flux complet :**
    *   Créez un compte.
    *   Allez sur la page des produits, achetez un article.
    *   Utilisez une carte de test Stripe pour finaliser le paiement.
    *   Vous serez redirigé vers la page de succès, qui mettra à jour la base de données.
    *   Vérifiez dans votre base de données que la commande a bien été créée et que l'utilisateur a le champ `hasPaid` à `true`.

# Guide Pédagogique : Application d'Abonnement et d'Achat de Produits avec Next.js et Stripe

Ce document détaille l'architecture, les fonctionnalités et les étapes qui ont été suivies pour construire ce projet. L'objectif est de créer une application web complète où les utilisateurs peuvent :
1.  S'authentifier via des fournisseurs OAuth (GitHub, Google).
2.  Acheter des produits individuels.
3.  Souscrire à un abonnement payant pour accéder à du contenu exclusif.
4.  Gérer leur abonnement via le portail client de Stripe.

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
    │   │       └───route.ts   # Écoute les événements Stripe (webhooks).
    │   ├───premium/
    │   │   └───page.tsx     # Page accessible uniquement aux abonnés.
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
    *   `isSubscribed`: Un booléen qui nous permet de savoir instantanément si un utilisateur est un abonné actif.
    *   `stripeCustomerId`: Un champ crucial qui stocke l'ID du client dans Stripe. Cela permet de lier un utilisateur de notre base de données à un client dans Stripe, essentiel pour gérer les abonnements et les paiements.

*   **`Product`** : Stocke les informations sur les articles à vendre (produits uniques ou abonnements).
    *   `priceId`: L'ID du tarif (`price_...`) de ce produit dans Stripe.

*   **`Order`** : Enregistre chaque transaction effectuée.
    *   Permet de suivre quels produits ont été achetés par quel utilisateur.

### B. Authentification avec NextAuth.js

L'authentification est gérée par NextAuth, qui s'intègre parfaitement avec Prisma.

**Fichier clé : `src/app/api/auth/[...nextauth]/route.ts`**

Ce fichier configure NextAuth.js :
1.  **`PrismaAdapter`** : C'est le pont entre NextAuth et notre base de données. Quand un utilisateur se connecte pour la première fois avec un fournisseur (ex: GitHub), l'adaptateur crée automatiquement une nouvelle entrée `User` dans notre base de données.
2.  **`events`** : Nous utilisons l'événement `createUser` pour une action spécifique : dès qu'un nouvel utilisateur est créé dans notre base de données, nous créons également un client (`Customer`) correspondant dans Stripe. L'ID de ce client Stripe est immédiatement sauvegardé dans notre champ `user.stripeCustomerId`.

```typescript
// src/app/api/auth/[...nextauth]/route.ts

// ...
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [/* ... */],
  events: {
    createUser: async ({ user }) => {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2024-06-20",
      });

      await stripe.customers
        .create({
          email: user.email!,
          name: user.name!,
        })
        .then(async (customer) => {
          return prisma.user.update({
            where: { id: user.id },
            data: {
              stripeCustomerId: customer.id,
            },
          });
        });
    },
  },
  // ...
};
// ...
```

### C. Processus de Paiement avec Stripe Checkout

Lorsqu'un utilisateur décide d'acheter un produit ou de s'abonner.

**Fichier clé : `src/app/api/checkout/route.ts`**

Cette route d'API est appelée par le front-end. Voici son fonctionnement :
1.  Elle reçoit les `priceId` des produits que l'utilisateur souhaite acheter.
2.  Elle récupère l'utilisateur actuel via la session NextAuth pour obtenir son `stripeCustomerId`.
3.  Elle crée une **Session de Paiement Stripe** (`checkout.session`) en spécifiant :
    *   `customer`: Le `stripeCustomerId` de l'utilisateur.
    *   `line_items`: La liste des produits (avec leur `priceId` et quantité).
    *   `mode`: `'payment'` pour un achat unique, `'subscription'` pour un abonnement.
    *   `success_url` et `cancel_url`: Les pages vers lesquelles l'utilisateur sera redirigé après la transaction.
4.  Elle renvoie l'URL de la page de paiement Stripe au client, qui s'y redirige.

### D. Synchronisation avec les Webhooks Stripe

C'est le mécanisme le plus important pour maintenir notre base de données à jour avec ce qui se passe sur Stripe.

**Fichier clé : `src/app/api/webhook/route.ts`**

Stripe envoie des notifications (événements) à cette route de manière asynchrone.
1.  **Sécurité** : La première étape est de vérifier que la requête provient bien de Stripe en utilisant la signature du webhook (`stripe-signature`) et notre secret de webhook (`STRIPE_WEBHOOK_SECRET`). C'est essentiel pour éviter les fausses notifications.
2.  **Traitement des événements** : Nous utilisons un `switch` pour gérer différents types d'événements. Le plus important est :
    *   **`checkout.session.completed`** : Cet événement est déclenché lorsqu'un paiement réussit.
        *   Si c'est un **abonnement**, nous mettons à jour le champ `isSubscribed` de l'utilisateur à `true`.
        *   Si c'est un **achat unique**, nous créons une nouvelle entrée dans la table `Order` pour enregistrer la vente.

```typescript
// src/app/api/webhook/route.ts

// ...
switch (event.type) {
  case "checkout.session.completed":
    const session = event.data.object;

    if (session.mode === "subscription") {
      // Gérer l'abonnement
      await prisma.user.update({
        where: { stripeCustomerId: session.customer as string },
        data: { isSubscribed: true },
      });
    } else if (session.mode === "payment") {
      // Gérer l'achat unique
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      // ... logique pour créer une commande dans la DB
    }
    break;
  // ... autres cas comme 'customer.subscription.deleted'
}
// ...
```

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
    *   `STRIPE_SECRET_KEY` et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Depuis votre Dashboard Stripe.
    *   `STRIPE_WEBHOOK_SECRET`: Généré par le CLI Stripe à l'étape 5.

### Étape 3 : Configuration de la Base de Données

1.  **Appliquez le schéma Prisma à votre base de données :**
    ```bash
    npx prisma migrate dev
    ```
    Cette commande crée toutes les tables (`User`, `Product`, `Order`, etc.).

2.  **Pré-remplissez la base de données avec les produits :**
    ```bash
    npx prisma db seed
    ```
    Cela exécute le script `prisma/seed.ts` pour créer les produits que vous avez définis.

### Étape 4 : Création des Produits dans Stripe

1.  **Connectez-vous à votre Dashboard Stripe.**
2.  Allez dans la section "Produits" et créez les mêmes produits que ceux définis dans `prisma/seed.ts`.
3.  Pour chaque produit, copiez son **ID de tarif** (`price_...`) et assurez-vous qu'il correspond à celui dans votre base de données (le `seed` le fait pour vous si les `priceId` sont corrects).

### Étape 5 : Lancement et Test

1.  **Démarrez le serveur de développement :**
    ```bash
    npm run dev
    ```

2.  **Dans un autre terminal, lancez le CLI Stripe** pour transférer les événements webhook à votre machine locale. La commande vous donnera le `STRIPE_WEBHOOK_SECRET` (`whsec_...`) à mettre dans votre `.env`.
    ```bash
    stripe listen --forward-to localhost:3000/api/webhook
    ```

3.  **Testez le flux complet :**
    *   Créez un compte.
    *   Essayez d'accéder à la page `/premium` (vous devriez être bloqué).
    *   Allez sur la page des produits, achetez un article ou souscrivez à l'abonnement.
    *   Utilisez une carte de test Stripe pour finaliser le paiement.
    *   Vérifiez que le webhook a bien été reçu dans le terminal Stripe.
    *   Retournez sur la page `/premium` et vérifiez que vous y avez maintenant accès.

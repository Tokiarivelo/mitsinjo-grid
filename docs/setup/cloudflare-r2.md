# Guide de configuration Cloudflare R2 pour Mitsinjo Grid

Ce guide explique étape par étape comment créer et configurer un compartiment (**Bucket**) Cloudflare R2 et générer les identifiants d'API compatibles S3 pour stocker et servir les médias du Copilot AI (images, croquis Canvas Studio, graphiques et vidéos).

---

## Sommaire

1. [Présentation et Rôle de R2](#1-présentation-et-rôle-de-r2)
2. [Étape 1 : Créer ou accéder à son compte Cloudflare](#2-étape-1--créer-ou-accéder-à-son-compte-cloudflare)
3. [Étape 2 : Activer R2 et créer un Bucket](#3-étape-2--activer-r2-et-créer-un-bucket)
4. [Étape 3 : Configurer l'accès public au Bucket (`R2_PUBLIC_URL`)](#4-étape-3--configurer-laccès-public-au-bucket-r2_public_url)
5. [Étape 4 : Récupérer l'identifiant de compte (`R2_ACCOUNT_ID`)](#5-étape-4--récupérer-lidentifiant-de-compte-r2_account_id)
6. [Étape 5 : Créer un jeton d'API S3 (`R2_ACCESS_KEY_ID` & `R2_SECRET_ACCESS_KEY`)](#6-étape-5--créer-un-jeton-dapi-s3-r2_access_key_id--r2_secret_access_key)
7. [Étape 6 : Configurer les variables d'environnement](#7-étape-6--configurer-les-variables-denvironnement)
8. [Étape 7 : Vérifier le bon fonctionnement](#8-étape-7--vérifier-le-bon-fonctionnement)

---

## 1. Présentation et Rôle de R2

**Cloudflare R2** est un service de stockage d'objets compatible avec l'API Amazon S3. Ses principaux avantages sont :

- **Zéro frais de bande passante sortante (egress gratuit)** : idéal pour servir des images, graphiques et vidéos de micro-réseau sans surcoût.
- **URLs pré-signées sécurisées** : les fichiers sont téléversés directement depuis le navigateur du client vers R2 sans surcharger le serveur Next.js.
- **Résilience** : si les variables d'environnement R2 ne sont pas définies, Mitsinjo Grid bascule automatiquement en mode local (_data-URL fallback_), ce qui garantit le fonctionnement hors-ligne.

### Variables d'environnement requises

| Variable               | Description                                                               | Exemple                               |
| :--------------------- | :------------------------------------------------------------------------ | :------------------------------------ |
| `R2_ACCOUNT_ID`        | Identifiant unique de votre compte Cloudflare (32 caractères hex)         | `a1b2c3d4e5f67890123456789abcdef0`    |
| `R2_ACCESS_KEY_ID`     | Clé d'accès compatible S3 pour authentifier les requêtes de téléversement | `1234567890abcdef1234567890abcdef`    |
| `R2_SECRET_ACCESS_KEY` | Clé secrète associée au jeton d'accès                                     | `fedcba9876543210fedcba9876543210...` |
| `R2_BUCKET_NAME`       | Nom du compartiment de stockage                                           | `mitsinjo-grid-media`                 |
| `R2_PUBLIC_URL`        | URL publique permettant aux navigateurs d'afficher les médias             | `https://pub-xxxxxxxx.r2.dev`         |

---

## 2. Étape 1 : Créer ou accéder à son compte Cloudflare

1. Rendez-vous sur la console Cloudflare : [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Connectez-vous avec votre compte ou créez un compte gratuit si vous n'en possédez pas.

---

## 3. Étape 2 : Activer R2 et créer un Bucket

1. Dans le menu de navigation à gauche, cliquez sur **Storage & Databases** puis sur **R2 Object Storage** (ou directement sur **R2**).
2. Si vous utilisez R2 pour la première fois, suivez l'instruction à l'écran pour activer le service (un niveau gratuit généreux de 10 Go par mois est inclus).
3. Cliquez sur le bouton bleu **Create bucket** (Créer un compartiment).
4. Remplissez les champs :
   - **Bucket name** : saisissez `mitsinjo-grid-media` (ou un nom unique de votre choix).
   - **Location** : laissez sur **Automatic** (ou choisissez une région géographique spécifique).
   - **Storage Class** : Standard.
5. Cliquez sur **Create bucket** en bas de page.

> [!NOTE]
> La valeur saisie correspond à votre variable `R2_BUCKET_NAME`. Si vous utilisez `mitsinjo-grid-media`, c'est la valeur par défaut du projet.

---

## 4. Étape 3 : Configurer l'accès public au Bucket (`R2_PUBLIC_URL`)

Pour que les images générées ou envoyées dans le chat soient visibles par l'utilisateur dans l'interface web, le bucket doit disposer d'un accès public en lecture.

1. Cliquez sur le bucket que vous venez de créer (`mitsinjo-grid-media`).
2. Rendez-vous dans l'onglet **Settings** (Paramètres).
3. Faites défiler jusqu'à la section **Public Access** (Accès public).
4. Sous **R2.dev subdomain** (Sous-domaine r2.dev gratuit) :
   - Cliquez sur **Allow Access** (Autoriser l'accès).
   - Une fenêtre modale de confirmation s'ouvre : tapez `allow` pour confirmer, puis validez.
   - Cloudflare génère instantanément une URL publique au format :
     ```text
     https://pub-xxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
     ```
5. **Copiez cette URL** : c'est la valeur de votre variable `R2_PUBLIC_URL`.

_(Alternative : si vous gérez déjà un domaine personnalisé sur Cloudflare, vous pouvez cliquer sur "Connect Domain" pour utiliser une URL telle que `https://media.mitsinjo.org`)._

---

## 5. Étape 4 : Récupérer l'identifiant de compte (`R2_ACCOUNT_ID`)

L'identifiant de compte Cloudflare est nécessaire pour construire l'endpoint de l'API S3 :

1. Retournez sur la page d'accueil de **R2 Object Storage** (dans le menu latéral gauche).
2. Dans le volet latéral droit, localisez la section **Account Details** (Détails du compte).
3. Repérez la ligne **Account ID** : il s'agit d'une chaîne de 32 caractères alphanumériques.
4. Cliquez sur l'icône de copie à côté de l'identifiant.

> [!TIP]
> Vous pouvez aussi retrouver votre `Account ID` directement dans l'URL de votre navigateur :
> `https://dash.cloudflare.com/<R2_ACCOUNT_ID>/r2/overview`

---

## 6. Étape 5 : Créer un jeton d'API S3 (`R2_ACCESS_KEY_ID` & `R2_SECRET_ACCESS_KEY`)

Pour permettre à l'application Mitsinjo Grid de générer des URLs d'upload sécurisées, vous devez générer des identifiants d'API compatibles S3 :

1. Sur la page d'accueil de **R2 Object Storage**, dans le volet droit (ou en haut à droite), cliquez sur le lien **Manage R2 API Tokens** (Gérer les jetons d'API R2).
2. Cliquez sur le bouton bleu **Create API token** (Créer un jeton d'API).
3. Configurez les options suivantes :
   - **Token name** : saisissez un nom explicite, par exemple `mitsinjo-grid-token`.
   - **Permissions** : sélectionnez impérativement **Object Read & Write** (Lecture et Écriture d'objets).
   - **Specify bucket(s)** :
     - Sélectionnez **Apply to specific buckets only** et choisissez `mitsinjo-grid-media` (recommandé pour la sécurité) ;
     - ou sélectionnez **Apply to all buckets**.
   - **TTL (Durée de validité)** : laissez sur **Forever** (Permanent) pour un environnement de développement stable.
   - **Client IP Restrictions** : laissez vide (sauf si vous avez une IP fixe dédiée).
4. Cliquez sur **Create API Token** en bas de la page.

### ⚠️ Sauvegarde immédiate des identifiants (Affichés une seule fois)

La page récapitulative affiche vos identifiants d'authentification S3. **Cette page ne sera plus jamais réaffichée par Cloudflare :**

1. Localisez la section **S3 API credentials** (Identifiants de l'API S3).
2. Copiez la valeur de **Access Key ID** :
   ```text
   R2_ACCESS_KEY_ID=votre_access_key_id_ici
   ```
3. Copiez la valeur de **Secret Access Key** :
   ```text
   R2_SECRET_ACCESS_KEY=votre_secret_access_key_ici
   ```

---

## 7. Étape 6 : Configurer les variables d'environnement

Ajoutez les variables obtenues dans votre fichier `.env` à la racine du projet et dans `apps/web/.env.local` :

```bash
# ── Cloudflare R2 Object Storage ──────────────────────────
# Identifiant de compte Cloudflare (32 caractères hex)
R2_ACCOUNT_ID=a1b2c3d4e5f67890123456789abcdef0

# Clé d'accès API compatible S3
R2_ACCESS_KEY_ID=1234567890abcdef1234567890abcdef

# Clé secrète API compatible S3
R2_SECRET_ACCESS_KEY=fedcba9876543210fedcba9876543210abcdef1234567890abcdef1234567890

# Nom du bucket R2
R2_BUCKET_NAME=mitsinjo-grid-media

# URL publique de lecture (sous-domaine r2.dev ou domaine personnalisé)
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
```

Pour synchroniser automatiquement vos fichiers d'environnement dans le monorepo, exécutez la commande :

```bash
make env
```

---

## 8. Étape 7 : Vérifier le bon fonctionnement

### Test 1 : Appel de l'API de téléversement (Upload Route)

Lancez le serveur de développement :

```bash
make dev
```

Puis dans un terminal, demandez une URL de pré-signature pour tester :

```bash
curl -X POST http://localhost:3001/api/copilot/upload \
  -H "Content-Type: application/json" \
  -d '{"filename": "test-telemetrie.png", "contentType": "image/png"}'
```

**Résultat attendu :**

```json
{
  "uploadUrl": "https://a1b2c3d4e5f67890123456789abcdef0.r2.cloudflarestorage.com/mitsinjo-grid-media/uploads/...",
  "publicUrl": "https://pub-xxxxxxxx.r2.dev/uploads/...",
  "key": "uploads/...",
  "isR2Configured": true
}
```

Lorsque `"isR2Configured": true`, l'application utilise directement le stockage Cloudflare R2 avec URLs pré-signées !

### Test 2 : Utilisation dans l'interface Mitsinjo Grid

1. Ouvrez l'application web dans votre navigateur : `http://localhost:3001`.
2. Allez sur le **Copilot** ou ouvrez le volet Copilot dans la simulation.
3. Glissez-déposez une image ou cliquez sur l'icône **Dessiner / Canvas Studio**.
4. Envoyez le message avec le média joint :
   - L'image est automatiquement envoyée sur Cloudflare R2 via l'URL pré-signée.
   - La session et le lien du média sont sauvegardés dans votre base Neon DB.
   - En cliquant sur l'image dans le chat, le **Media Lightbox Modal** s'ouvre en plein écran avec zoom, téléchargement et mode Canvas Inspector !

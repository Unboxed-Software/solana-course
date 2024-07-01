---
title: Solana Pay
objectives:
- Utiliser la spécification Solana Pay pour créer des demandes de paiement et initier des transactions à l'aide d'URL encodées en QR codes
- Utiliser la bibliothèque `@solana/pay` pour faciliter la création de demandes de transactions Solana Pay
- Signer partiellement des transactions et mettre en place un mécanisme de filtrage des transactions basé sur certaines conditions
---

# Résumé

-   **Solana Pay** est une spécification pour l'encodage des demandes de transactions Solana dans des URL, permettant des demandes de transactions standardisées sur différentes applications et portefeuilles Solana.
-   La **signature partielle** des transactions permet la création de transactions nécessitant plusieurs signatures avant leur soumission au réseau.
-   La **filtration des transactions** implique la mise en place de règles déterminant si certaines transactions peuvent être traitées ou non, en fonction de certaines conditions ou de la présence de données spécifiques dans la transaction.

# Aperçu général

La communauté Solana améliore constamment et élargit les fonctionnalités du réseau. Mais cela ne signifie pas toujours le développement de nouvelles technologies. Parfois, cela signifie tirer parti des fonctionnalités existantes du réseau de manière nouvelle et intéressante.

Solana Pay en est un excellent exemple. Plutôt que d'ajouter de nouvelles fonctionnalités au réseau, Solana Pay utilise de manière unique les fonctionnalités existantes du réseau pour permettre aux commerçants et aux applications de demander des transactions et de construire des mécanismes de filtrage pour des types de transactions spécifiques.

Tout au long de cette leçon, vous apprendrez comment utiliser Solana Pay pour créer des demandes de transfert et de transaction, encoder ces demandes en QR code, signer partiellement des transactions et filtrer des transactions en fonction des conditions que vous choisissez. Plutôt que de s'arrêter là, nous espérons que vous verrez cela comme un exemple de l'exploitation de fonctionnalités existantes de manière nouvelle et intéressante, l'utilisant comme un tremplin pour vos propres interactions réseau côté client uniques.

## Solana Pay

La [spécification Solana Pay](https://docs.solanapay.com/spec) est un ensemble de normes permettant aux utilisateurs de demander des paiements et d'initier des transactions à l'aide d'URL de manière uniforme sur différentes applications et portefeuilles Solana.

Les URL de demande sont préfixées par `solana:` afin que les plateformes puissent diriger le lien vers l'application appropriée. Par exemple, sur mobile, une URL qui commence par `solana:` sera dirigée vers des applications de portefeuille prenant en charge la spécification Solana Pay. À partir de là, le portefeuille peut utiliser le reste de l'URL pour traiter la demande de manière appropriée.

Il existe deux types de demandes définis par la spécification Solana Pay :

1. Demande de transfert : utilisée pour des transferts simples de SOL ou de jetons SPL.
2. Demande de transaction : utilisée pour demander n'importe quel type de transaction Solana.

### Demandes de transfert

La spécification de demande de transfert décrit une demande non interactive de transfert de SOL ou de jeton SPL. Les URLs de demande de transfert suivent le format suivant `solana:<destinataire>?<paramètres-de-requête-optionnels>`.

La valeur de `destinataire` est requise et doit être une clé publique encodée en base58 du compte à partir duquel un transfert est demandé. De plus, les paramètres de requête optionnels suivants sont pris en charge :

- `amount` - une valeur entière ou décimale non négative indiquant la quantité de jetons à transférer.
- `spl-token` - une clé publique encodée en base58 d'un compte SPL Token mint si le transfert est d'un jeton SPL et non de SOL.
- `reference` - des valeurs de référence optionnelles sous forme de tableaux de 32 octets encodés en base58. Cela peut être utilisé par un client pour identifier la transaction onchain, car le client n'aura pas de signature de transaction.
- `label` - une chaîne UTF-8 encodée en URL qui décrit la source de la demande de transfert.
- `message` - une chaîne UTF-8 encodée en URL qui décrit la nature de la demande de transfert.
- `memo` - une chaîne UTF-8 encodée en URL qui doit être incluse dans l'instruction memo SPL de la transaction de paiement.

À titre d'exemple, voici une URL décrivant une demande de transfert de 1 SOL :

```text
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish&memo=OrderId12345
```

Et voici une URL décrivant une demande de transfert de 0,1 USDC :

```text
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=0.01&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Demandes de transaction

La demande de transaction Solana Pay est similaire à une demande de transfert en ce sens qu'il s'agit simplement d'une URL pouvant être consommée par un portefeuille la prenant en charge. Cependant, cette demande est interactive et le format est plus ouvert :

```text
solana:<lien>
```

La valeur de `lien` doit être une URL vers laquelle le portefeuille consommateur peut faire une requête HTTP. Plutôt que de contenir toutes les informations nécessaires pour une transaction, une demande de transaction utilise cette URL pour récupérer la transaction qui doit être présentée à l'utilisateur.

Lorsqu'un portefeuille reçoit une URL de demande de transaction, quatre choses se produisent :

1. Le portefeuille envoie une requête GET à l'application à l'URL fournie par `lien` pour récupérer une étiquette et une image d'icône à afficher à l'utilisateur.
2. Le portefeuille envoie ensuite une requête POST avec la clé publique de l'utilisateur final.
3. En utilisant la clé publique de l'utilisateur final (et toutes les informations supplémentaires fournies dans `lien`), l'application construit ensuite la transaction et répond avec une transaction sérialisée encodée en base64.
4. Le portefeuille décode et désérialise la transaction, puis permet à l'utilisateur de signer et d'envoyer la transaction.

Étant donné que les demandes de transaction sont plus complexes que les demandes de transfert, le reste de cette leçon se concentrera sur la création de demandes de transaction.

## Créer une demande de transaction

### Définir le point de terminaison de l'API

La principale chose que vous, le développeur, devez faire pour que le flux de demande de transaction fonctionne est de configurer un point de terminaison REST API à l'URL que vous prévoyez d'inclure dans la demande de transaction. Dans cette leçon, nous utiliserons les [Routes API de Next.js](https://nextjs.org/docs/api-routes/introduction) pour nos points de terminaison, mais vous pouvez utiliser la stack et les outils avec lesquels vous vous sentez le plus à l'aise.

Dans Next.js, vous faites cela en ajoutant un fichier au dossier `pages/api` et en exportant une fonction qui gère la demande et la réponse.

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    // Gérer la demande
}
```

### Gérer une requête GET

Le portefeuille consommant votre URL de demande de transaction émettra d'abord une requête GET à ce point de terminaison. Vous voudrez que votre point de terminaison renvoie un objet JSON avec deux champs :

1. `label` - une chaîne décrivant la source de la demande de transaction.
2. `icon` - une URL vers une image qui peut être affichée à l'utilisateur.

En s'appuyant sur le point de terminaison vide précédent, cela peut ressembler à ceci :

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method === "GET") {
        return get(res)
    } else {
        return res.status(405).json({ error: "Méthode non autorisée" })
    }
}

function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Nom du magasin",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

Lorsque le portefeuille effectue une requête GET vers le point de terminaison de l'API, la fonction `get` est appelée, renvoyant une réponse avec un code d'état de 200 et l'objet JSON contenant `label` et `icon`.

### Gérer une requête POST et construire la transaction

Après avoir émis une requête GET, le portefeuille émettra une requête POST à la même URL. Votre point de terminaison doit s'attendre à ce que le `body` de la requête POST contienne un objet JSON avec un champ `account` fourni par le portefeuille demandeur. La valeur de `account` sera une chaîne représentant la clé publique de l'utilisateur final.

Avec cette information et les paramètres supplémentaires fournis, vous pouvez construire la transaction et la renvoyer au portefeuille pour signature en :

1. Se connectant au réseau Solana et récupérant le dernier `blockhash`.
2. Créant une nouvelle transaction en utilisant le `blockhash`.
3. Ajoutant des instructions à la transaction.
4. Sérialisant la transaction et la renvoyant dans un objet `PostResponse` avec un message pour l'utilisateur.

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method === "GET") {
        return get(res)
    } else if (req.method === "POST") {
        return post(req, res)
    } else {
        return res.status(405).json({ error: "Méthode non autorisée" })
    }
}

function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Nom du magasin",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
async function post(
    req: PublicKey,
    res: PublicKey,
) {
    const { account, reference } = req.body

    const connection = new Connection(clusterApiUrl("devnet"));

    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: account,
    });

    const instruction = SystemProgram.transfer({
        fromPubkey: account,
        toPubkey: Keypair.generate().publicKey,
        lamports: 0.001 * LAMPORTS_PER_SOL,
    });

    transaction.add(instruction);

    transaction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    })

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");

    const message = "Transfert simple de 0,001 SOL";

    res.send(200).json({
        transaction: base64,
        message,
    })
}
```

Il n'y a rien de trop extraordinaire ici. C'est la même construction de transaction que vous utiliseriez dans une application côté client standard. La seule différence est qu'au lieu de signer et de soumettre au réseau, vous envoyez la transaction sous forme de chaîne encodée en base64 dans la réponse HTTP. Le portefeuille qui a émis la demande peut alors présenter la transaction à l'utilisateur pour signature.

### Confirmer la transaction

Vous avez peut-être remarqué que l'exemple précédent supposait qu'une `reference` était fournie en tant que paramètre de requête. Bien que cela ne soit *pas* une valeur fournie par le portefeuille demandeur, il est *utile* de configurer votre URL initiale de demande de transaction pour contenir ce paramètre de requête.

Étant donné que votre application n'est pas celle qui soumet une transaction au réseau, votre code n'aura pas accès à une signature de transaction. C'est généralement ainsi que votre application peut localiser une transaction sur le réseau et voir son statut.

Pour contourner cela, vous pouvez inclure une valeur de `reference` en tant que paramètre de requête pour chaque demande de transaction. Cette valeur doit être un tableau de 32 octets encodé en base58 qui peut être inclus en tant que clé non signataire sur la transaction. Cela permet à votre application d'utiliser la méthode RPC `getSignaturesForAddress` pour localiser la transaction. Votre application peut ensuite personnaliser son interface utilisateur en fonction du statut d'une transaction.

Si vous utilisez la bibliothèque `@solana/pay`, vous pouvez utiliser la fonction d'aide `findReference` au lieu d'utiliser directement `getSignaturesForAddress`.

## Transactions filtrées

Nous avons mentionné précédemment comment Solana Pay est un exemple de la possibilité de faire des choses nouvelles et intéressantes avec le réseau en étant créatif avec les fonctionnalités existantes. Un autre petit exemple de cela dans le cadre de Solana Pay est de ne rendre certaines transactions disponibles que lorsque certaines conditions sont remplies.

Étant donné que vous contrôlez le point de terminaison construisant la transaction, vous pouvez déterminer les critères qui doivent être remplis avant qu'une transaction ne soit construite. Par exemple, vous pouvez utiliser le champ `account` fourni dans la requête POST pour vérifier si l'utilisateur final détient un NFT d'une collection particulière ou si cette clé publique fait partie d'une liste prédéterminée de comptes autorisés à effectuer cette transaction particulière.

```typescript
// récupérer le tableau des NFT détenus par le portefeuille donné
const nfts = await metaplex.nfts().findAllByOwner({ owner: account }).run();

// itérer sur le tableau des NFT
for (let i = 0; i < nfts.length; i++) {
    // vérifier si le NFT actuel a un champ de collection avec la valeur souhaitée
    if (nfts[i].collection?.address.toString() == collection.toString()) {
        // construire la transaction
    } else {
        // retourner une erreur
    }
}
```

### Signature partielle

Si vous souhaitez que certaines transactions soient derrière un certain mécanisme de filtrage, cette fonctionnalité devra également être appliquée onchain. Renvoyer une erreur depuis votre point de terminaison Solana Pay rend plus difficile pour les utilisateurs finaux de réaliser la transaction, mais ils pourraient toujours la construire manuellement.

Cela signifie que l'instruction (ou les instructions) appelée(s) doit (doivent) nécessiter une sorte de signature "administrative" que seule votre application peut fournir. Cependant, cela signifie que nos exemples précédents ne fonctionneraient pas. La transaction est construite et envoyée au portefeuille demandeur pour la signature de l'utilisateur final, mais la transaction soumise échouera sans la signature administrative.

Heureusement, Solana permet la composition des signatures avec la signature partielle.

La signature partielle d'une transaction multi-signatures permet aux signataires d'ajouter leur signature avant que la transaction ne soit diffusée sur le réseau. Cela peut être utile dans plusieurs situations, notamment :

- Approuver des transactions nécessitant la signature de plusieurs parties, telles qu'un commerçant et un acheteur qui doivent confirmer les détails d'un paiement.
- Invoquer des programmes personnalisés nécessitant les signatures à la fois d'un utilisateur et d'un administrateur. Cela peut aider à limiter l'accès aux instructions du programme et garantir que seules les parties autorisées peuvent les exécuter.

```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

const transaction = new Transaction({
  feePayer: account,
  blockhash,
  lastValidBlockHeight,
})

...

transaction.partialSign(adminKeypair)
```

La fonction `partialSign` est utilisée pour ajouter une signature à une transaction sans remplacer les signatures précédentes sur la transaction. Si vous construisez une transaction avec plusieurs signataires, il est important de se rappeler que si vous ne spécifiez pas le `feePayer` d'une transaction, le premier signataire sera utilisé comme payeur de frais pour la transaction. Pour éviter toute confusion ou comportement inattendu, assurez-vous de définir explicitement le payeur de frais lorsque cela est nécessaire.

Dans notre exemple de n'autoriser une demande de transaction que lorsque l'utilisateur final a un NFT spécifique, vous ajouteriez simplement votre signature administrative à la transaction en utilisant `partialSign` avant d'encoder la transaction comme une chaîne encodée en base64 et d'émettre la réponse HTTP.

## Codes QR Solana Pay

L'une des fonctionnalités marquantes de Solana Pay est son intégration facile avec les QR codes. Étant donné que les demandes de transfert et de transaction sont simplement des URLs, vous pouvez les intégrer dans des QR codes que vous rendez disponibles dans votre application ou ailleurs.

La bibliothèque `@solana/pay` simplifie cela avec la fonction d'aide `createQR` fournie. Cette fonction nécessite que vous fournissiez les éléments suivants :

- `url` - l'URL de la demande de transaction.
- `size` (facultatif) - la largeur et la hauteur du QR code en pixels. Par défaut à 512.
- `background` (facultatif) - la couleur de fond. Par défaut au blanc.
- `color` (facultatif) - la couleur du premier plan. Par défaut au noir.

```typescript
const qr = createQR(url, 400, 'transparent')
```

# Laboratoire

Maintenant que vous avez une compréhension conceptuelle de Solana Pay, passons à la pratique. Nous allons utiliser Solana Pay pour générer une série de QR codes pour une chasse au trésor. Les participants doivent visiter chaque emplacement de la chasse au trésor dans l'ordre. À chaque emplacement, ils utiliseront le QR code fourni pour soumettre la transaction appropriée au contrat intelligent de la chasse au trésor qui suit la progression de l'utilisateur.

### 1. Départ

Pour commencer, téléchargez le code de départ sur la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-scavenger-hunt-app/tree/starter). Le code de départ est une application Next.js qui affiche un QR code Solana Pay. Notez que la barre de menu vous permet de basculer entre différents QR codes. L'option par défaut est un transfert SOL simple à des fins illustratives. Tout au long du laboratoire, nous ajouterons des fonctionnalités aux options de localisation dans la barre de menu.

![Capture d'écran de l'application de chasse au trésor](../assets/scavenger-hunt-screenshot.png)

Pour ce faire, nous allons créer un nouvel endpoint pour une requête de transaction qui construit une transaction pour invoquer un programme Anchor sur Devnet. Ce programme a été spécialement conçu pour cette application "chasse au trésor" et comporte deux instructions : `initialize` et `check_in`. L'instruction `initialize` est utilisée pour configurer l'état de l'utilisateur, tandis que l'instruction `check_in` est utilisée pour enregistrer un check-in à un emplacement dans la chasse au trésor. Nous ne ferons aucune modification au programme dans ce laboratoire, mais n'hésitez pas à consulter le [code source](https://github.com/Unboxed-Software/anchor-scavenger-hunt) si vous souhaitez vous familiariser avec le programme.

Avant de passer à la suite, assurez-vous de vous familiariser avec le code de départ de l'application Scavenger Hunt. En examinant `pages/index.tsx`, `utils/createQrCode/simpleTransfer`, et `/utils/checkTransaction`, vous pourrez voir comment la requête de transaction pour l'envoi de SOL est configurée. Nous suivrons un schéma similaire pour la requête de transaction pour l'enregistrement à un emplacement.

### 2. Configuration

Avant de continuer, assurez-vous que vous pouvez exécuter l'application en local. Commencez par renommer le fichier `.env.example` dans le répertoire frontend en `.env`. Ce fichier contient une paire de clés qui sera utilisée dans ce laboratoire pour signer partiellement les transactions.

Ensuite, installez les dépendances avec `yarn`, puis utilisez `yarn dev` et ouvrez votre navigateur sur `localhost:3000` (ou le port indiqué dans la console si le port 3000 était déjà utilisé).

Maintenant, si vous essayez de scanner le QR code affiché sur la page depuis votre appareil mobile, vous obtiendrez une erreur. C'est parce que le QR code est configuré pour vous rediriger vers `localhost:3000` de votre ordinateur, ce qui n'est pas une adresse à laquelle votre téléphone peut accéder. De plus, Solana Pay doit utiliser une URL HTTPS pour fonctionner.

Pour contourner cela, vous pouvez utiliser [ngrok](https://ngrok.com/). Vous devrez l'installer si vous ne l'avez pas encore utilisé. Une fois installé, exécutez la commande suivante dans votre terminal, en remplaçant `3000` par le port que vous utilisez pour ce projet :

```bash
ngrok http 3000
```

Cela vous fournira une URL unique que vous pouvez utiliser pour accéder à votre serveur local à distance. La sortie ressemblera à quelque chose comme ceci :

```bash
Session Status                online
Account                       your_email@gmail.com (Plan: Free)
Update                        update available (version 3.1.0, Ctrl-U to update)
Version                       3.0.6
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://7761-24-28-107-82.ngrok.io -> http://localhost:3000
```

Maintenant, ouvrez l'URL ngrok HTTPS affichée dans votre console dans le navigateur (par exemple, https://7761-24-28-107-82.ngrok.io). Cela vous permettra de scanner les QR codes depuis votre appareil mobile lors des tests en local.

Au moment de l'écriture, ce laboratoire fonctionne mieux avec Solflare. Certains portefeuilles afficheront un message d'erreur incorrect lors de la numérisation d'un QR code Solana Pay. Peu importe le portefeuille que vous utilisez, assurez-vous de passer à devnet dans le portefeuille. Ensuite, scannez le QR code sur la page d'accueil intitulée "SOL Transfer". Ce QR code est une implémentation de référence pour une requête de transaction qui effectue un transfert de SOL simple. Il appelle également la fonction `requestAirdrop` pour financer votre portefeuille mobile avec du SOL Devnet, car la plupart des gens n'ont pas de SOL Devnet disponible pour les tests.

Si vous avez réussi à exécuter la transaction avec succès en utilisant le QR code, vous êtes prêt à passer à la suite !

### 3. Créer un point de terminaison de requête de transaction pour l'enregistrement

Maintenant que tout est en place, il est temps de créer un point de terminaison qui prend en charge les requêtes de transaction pour l'enregistrement à un emplacement en utilisant le programme Scavenger Hunt.

Commencez par ouvrir le fichier `pages/api/checkIn.ts`. Remarquez qu'il contient une fonction d'aide pour initialiser `eventOrganizer` à partir d'une variable d'environnement de clé secrète. La première chose que nous ferons dans ce fichier est la suivante :

1. Exporter une fonction `handler` pour gérer une requête HTTP arbitraire
2. Ajouter des fonctions `get` et `post` pour traiter ces méthodes HTTP
3. Ajouter de la logique au corps de la fonction `handler` pour appeler `get`, `post`, ou retourner une erreur 405 en fonction de la méthode de requête HTTP

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "GET") {
        return get(res)
    } else if (req.method === "POST") {
        return await post(req, res)
    } else {
        return res.status(405).json({ error: "Méthode non autorisée" })
    }
}

function get(res: NextApiResponse) {}

async function post(req: NextApiRequest, res: NextApiResponse) {}
```

### 4. Mettre à jour la fonction `get`

Rappelez-vous, la première requête d'un portefeuille sera une requête GET s'attendant à ce que le point de terminaison retourne un libellé et une icône. Mettez à jour la fonction `get` pour renvoyer une réponse avec un libellé "Chasse au trésor !" et une icône du logo Solana.

```jsx
function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Chasse au trésor !",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

### 5. Mettre à jour la fonction `post`

Après la requête GET, un portefeuille émettra une requête POST vers le point de terminaison. Le corps de la requête contiendra un objet JSON avec un champ `account` représentant la clé publique de l'utilisateur.

De plus, les paramètres de requête contiendront ce que vous avez encodé dans le QR code. Si vous regardez `utils/createQrCode/checkIn.ts`, vous remarquerez que cette application particulière inclut des paramètres pour `reference` et `id` comme suit :

1. `reference` - une clé publique générée aléatoirement utilisée pour identifier la transaction
2. `id` - l'ID de l'emplacement en tant qu'entier

Allez-y et mettez à jour la fonction `post` pour extraire `account`, `reference`, et `id` de la requête. Vous devriez répondre avec une erreur si l'un de ces éléments est manquant.

Ensuite, ajoutez un bloc `try catch` où le bloc `catch` répond avec une erreur et le bloc `try` appelle une nouvelle fonction `buildTransaction`. Si `buildTransaction` réussit, répondez avec un code 200 et un objet JSON avec la transaction et un message indiquant que l'utilisateur a trouvé l'emplacement donné. Ne vous inquiétez pas de la logique de la fonction `buildTransaction` pour le moment - nous le ferons ensuite.

Notez que vous devrez importer `PublicKey` et `Transaction` de `@solana/web3.js` ici également.

```typescript
import { NextApiRequest, NextApiResponse } from "next"
import { PublicKey, Transaction } from "@solana/web3.js"
...

async function post(req: NextApiRequest, res: NextApiResponse) {
    const { account } = req.body
    const { reference, id } = req.query

    if (!account || !reference || !id) {
        res.status(400).json({ error: "Paramètre(s) requis manquant(s)" })
        return
    }

    try {
        const transaction = await buildTransaction(
            new PublicKey(account),
            new PublicKey(reference),
            id.toString()
        )

        res.status(200).json({
            transaction: transaction,
            message: `Vous avez trouvé l'emplacement ${id} !`,
        })
    } catch (err) {
        console.log(err)
        let error = err as any
        if (error.message) {
            res.status(200).json({ transaction: "", message: error.message })
        } else {
            res.status(500).json({ error: "Erreur lors de la création de la transaction" })
        }
    }
}

async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
    id: string
): Promise<string> {
    return new Transaction()
}
```

### 6. Implémenter la fonction `buildTransaction`

Ensuite, passons à la mise en œuvre de la fonction `buildTransaction`. Elle doit construire, signer partiellement et renvoyer la transaction d'enregistrement. La séquence d'actions qu'elle doit effectuer est la suivante :

1. Récupérer l'état de l'utilisateur
2. Utiliser la fonction d'aide `locationAtIndex` et l'ID d'emplacement pour obtenir un objet Location
3. Vérifier que l'utilisateur est au bon emplacement
4. Obtenir le hachage du bloc actuel et la dernière hauteur de bloc valide à partir de la connexion
5. Créer un nouvel objet transaction
6. Ajouter une instruction d'initialisation à la transaction si l'état de l'utilisateur n'existe pas
7. Ajouter une instruction d'enregistrement à la transaction
8. Ajouter la clé publique `reference` à l'instruction d'enregistrement
9. Signer partiellement la transaction avec la paire de clés de l'organisateur de l'événement
10. Sérialiser la transaction avec un encodage en base64 et renvoyer la transaction

Bien que chacune de ces étapes soit simple, cela fait beaucoup d'étapes. Pour simplifier la fonction, nous allons créer des fonctions d'aide vides que nous remplirons ultérieurement pour les étapes 1, 3, 6, et 7-8. Nous les appellerons `fetchUserState`, `verifyCorrectLocation`, `createInitUserInstruction`, et `createCheckInInstruction`, respectivement.

Nous ajouterons également les imports suivants :

```typescript
import { NextApiRequest, NextApiResponse } from "next"
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
import { locationAtIndex, Location, locations } from "../../utils/locations"
import { connection, gameId, program } from "../../utils/programSetup"
```

En utilisant les fonctions d'aide vides et les nouveaux imports, nous pouvons remplir la fonction `buildTransaction` :

```typescript
async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
    id: string
): Promise<string> {
    const userState = await fetchUserState(account)

    const currentLocation = locationAtIndex(new Number(id).valueOf())

    if (!currentLocation) {
        throw { message: "ID d'emplacement non valide" }
    }

    if (!verifyCorrectLocation(userState, currentLocation)) {
        throw { message: "Vous devez visiter chaque emplacement dans l'ordre !" }
    }

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash()

    const transaction = new Transaction({
        feePayer: account,
        blockhash,
        lastValidBlockHeight,
    })

    if (!userState) {
        transaction.add(await createInitUserInstruction(account))
    }

    transaction.add(
        await createCheckInInstruction(account, reference, currentLocation)
    )

    transaction.partialSign(eventOrganizer)

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    })

    const base64 = serializedTransaction.toString("base64")

    return base64
}

interface UserState {
    user: PublicKey
    gameId: PublicKey
    lastLocation: PublicKey
}

async function fetchUserState(account: PublicKey): Promise<UserState | null> {
    return null
}

function verifyCorrectLocation(
    userState: UserState | null,
    currentLocation: Location
): boolean {
    return false
}

async function createInitUserInstruction(
    account: PublicKey
): Promise<TransactionInstruction> {
    throw ""
}

async function createCheckInInstruction(
    account: PublicKey,
    reference: PublicKey,
    location: Location
): Promise<TransactionInstruction> {
    throw ""
}
```

### 7. Implémenter la fonction `fetchUserState`

Avec la fonction `buildTransaction` terminée, commençons à implémenter les fonctions d'aide vides que nous avons créées, en commençant par `fetchUserState`. Cette fonction utilise l'ID de jeu (`gameId`) et la clé publique de l'utilisateur (`account`) pour dériver la PDA de l'état de l'utilisateur, puis récupère ce compte, renvoyant `null` s'il n'existe pas.

```typescript
async function fetchUserState(account: PublicKey): Promise<UserState | null> {
    const userStatePDA = PublicKey.findProgramAddressSync(
        [gameId.toBuffer(), account.toBuffer()],
        program.programId
    )[0]

    try {
        return await program.account.userState.fetch(userStatePDA)
    } catch {
        return null
    }
}
```

### 8. Implémenter la fonction `verifyCorrectLocation`

Ensuite, implémentons la fonction d'aide `verifyCorrectLocation`. Cette fonction est utilisée pour vérifier si un utilisateur est au bon emplacement dans une chasse au trésor.

Si `userState` est `null`, cela signifie que l'utilisateur doit visiter le premier emplacement. Sinon, l'utilisateur devrait visiter l'emplacement dont l'index est 1 de plus que son dernier emplacement visité.

Si ces conditions sont satisfaites, la fonction renverra true. Sinon, elle renverra false.

```typescript
function verifyCorrectLocation(
    userState: UserState | null,
    currentLocation: Location
): boolean {
    if (!userState) {
        return currentLocation.index === 1
    }

    const lastLocation = locations.find(
        (location) => location.key.toString() === userState.lastLocation.toString()
    )

    if (!lastLocation || currentLocation.index !== lastLocation.index + 1) {
        return false
    } else {
        return true
    }
}
```

### 9. Implémenter les fonctions de création d'instructions

Enfin, implémentons `createInitUserInstruction` et `createCheckInInstruction`. Celles-ci peuvent utiliser Anchor pour générer et renvoyer les instructions correspondantes. La seule exception est que `createCheckInInstruction` doit ajouter `reference` à la liste des clés des instructions.

```typescript
async function createInitUserInstruction(
    account: PublicKey
): Promise<TransactionInstruction> {
    const initializeInstruction = await program.methods
        .initialize(gameId)
        .accounts({ user: account })
        .instruction()

    return initializeInstruction
}

async function createCheckInInstruction(
    account: PublicKey,
    reference: PublicKey,
    location: Location
): Promise<TransactionInstruction> {
    const checkInInstruction = await program.methods
        .checkIn(gameId, location.key)
        .accounts({
            user: account,
            eventOrganizer: eventOrganizer.publicKey,
        })
        .instruction()

    checkInInstruction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    })

    return checkInInstruction
}
```

### 10. Tester l'application

À ce stade, votre application devrait fonctionner ! Testez-la avec votre portefeuille mobile. Commencez par scanner le QR code pour `Emplacement 1`. N'oubliez pas de vous assurer que votre frontend fonctionne avec l'URL ngrok plutôt que `localhost`.

Après avoir scanné le QR code, vous devriez voir un message indiquant que vous êtes à l'emplacement 1. Ensuite, scannez le QR code sur la page `Emplacement 2`. Vous devrez peut-être attendre quelques secondes que la transaction précédente se finalise avant de continuer.

Félicitations, vous avez réussi à terminer la démo de chasse au trésor en utilisant Solana Pay ! Selon votre expérience, cela peut ne pas sembler intuitif ou direct. Si c'est le cas, n'hésitez pas à refaire le laboratoire ou à créer quelque chose par vous-même. Solana Pay ouvre de nombreuses portes pour combler le fossé entre la vie réelle et l'interaction onchain.

Si vous voulez jeter un œil au code de solution final, vous pouvez le trouver sur la branche de [solution du même dépôt](https://github.com/Unboxed-Software/solana-scavenger-hunt-app/tree/solution).

# Défi

Il est temps d'essayer par vous-même. N'hésitez pas à développer une idée de votre choix en utilisant Solana Pay. Ou, si vous avez besoin d'inspiration, vous pouvez utiliser la suggestion ci-dessous.

Développez une application en utilisant Solana Pay (ou modifiez celle du laboratoire) pour créer un NFT pour les utilisateurs. Pour corser les choses, ne rendez la transaction possible que si l'utilisateur remplit une ou plusieurs conditions (par exemple, détient un NFT d'une collection spécifique, est déjà sur une liste prédéterminée, etc.).

Soyez créatif avec cela ! La spécification Solana Pay ouvre de nombreuses portes pour des cas d'utilisation uniques.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=3c7e5796-c433-4575-93e1-1429f718aa10) !
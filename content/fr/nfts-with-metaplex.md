---
title: Créer des NFT Solana avec Metaplex
objectives:
- Expliquer les NFT et comment ils sont représentés sur le réseau Solana
- Expliquer le rôle de Metaplex dans l'écosystème NFT Solana
- Créer et mettre à jour des NFT en utilisant le SDK Metaplex
- Expliquer la fonctionnalité de base des programmes Token Metadata, Candy Machine et Sugar CLI en tant qu'outils qui aident à créer et distribuer des NFT sur Solana
---

# Résumé

- Les **jetons non fongibles (NFT)** sont représentés sur Solana en tant que jetons SPL avec un compte de métadonnées associé, 0 décimales et une offre maximale de 1.
- **Metaplex** propose une collection d'outils qui simplifient la création et la distribution de NFT sur la blockchain Solana.
- Le programme **Token Metadata** normalise le processus d'ajout de métadonnées aux jetons SPL.
- Le **SDK Metaplex** est un outil qui offre des API conviviales pour aider les développeurs à utiliser les outils onchain fournis par Metaplex.
- Le programme **Candy Machine** est un outil de distribution de NFT utilisé pour créer et émettre des NFT à partir d'une collection.
- **Sugar CLI** est un outil qui simplifie le processus de téléchargement de fichiers multimédias/métadonnées et la création d'une Candy Machine pour une collection.

# Aperçu général

Les jetons non fongibles (NFT) Solana sont des jetons SPL créés à l'aide du programme Token. Cependant, ces jetons ont également un compte de métadonnées supplémentaire associé à chaque émission de jetons. Cela permet une grande variété de cas d'utilisation pour les jetons. Vous pouvez effectivement tokeniser n'importe quoi, des inventaires de jeux à des oeuvres d'art.

Dans cette leçon, nous aborderons les bases de la représentation des NFT sur Solana, comment les créer et les mettre à jour à l'aide du SDK Metaplex, et nous donnerons une brève introduction aux outils qui peuvent vous aider à créer et distribuer des NFT sur Solana à grande échelle.

## NFT sur Solana

Un NFT Solana est un jeton non divisible avec des métadonnées associées. De plus, l'émission du jeton a une offre maximale de 1.

En d'autres termes, un NFT est un jeton standard du programme Token, mais il diffère de ce que l'on pourrait considérer comme des "jetons standard" en ce sens qu'il :

1. A 0 décimales afin qu'il ne puisse pas être divisé en parties.
2. Provient d'une émission de jetons avec une offre de 1 pour qu'il n'existe qu'un seul de ces jetons.
3. Provient d'une émission de jetons dont l'autorité est définie à `null` (pour garantir que l'offre ne change jamais).
4. A un compte associé qui stocke les métadonnées.

Bien que les trois premiers points soient des fonctionnalités qui peuvent être obtenues avec le programme Token SPL, les métadonnées associées nécessitent une fonctionnalité supplémentaire.

Généralement, les métadonnées d'un NFT ont à la fois une composante onchain et une composante off-chain. Voir le schéma ci-dessous :

![Capture d'écran des métadonnées](../assets/solana-nft-metaplex-metadata.png)

 - Les **métadonnées onchain** sont stockées dans un compte associé à l'émission de jetons. Les métadonnées onchain contiennent un champ URI qui pointe vers un fichier `.json` hors chaîne.
 - Les **métadonnées hors chaîne** dans le fichier JSON stockent le lien vers les médias (images, vidéos, fichiers 3D) du NFT, toutes les caractéristiques que le NFT peut avoir, et des métadonnées supplémentaires (voir [cet exemple de fichier JSON](https://lsc6xffbdvalb5dvymf5gwjpeou7rr2btkoltutn5ij5irlpg3wa.arweave.net/XIXrlKEdQLD0dcML01kvI6n4x0GanLnSbeoT1EVvNuw)). Des systèmes de stockage de données permanents tels qu'Arweave sont souvent utilisés pour stocker la composante hors chaîne des métadonnées NFT.

## **Metaplex**

[Metaplex](https://www.metaplex.com/) est une organisation qui propose une suite d'outils, comme le [SDK Metaplex](https://docs.metaplex.com/sdks/js/), qui simplifient la création et la distribution de NFT sur la blockchain Solana. Ces outils couvrent un large éventail de cas d'utilisation et vous permettent de gérer facilement l'ensemble du processus de création et d'émission d'une collection de NFT.

Plus précisément, le SDK Metaplex est conçu pour aider les développeurs à utiliser les outils onchain proposés par Metaplex. Il offre une API conviviale axée sur des cas d'utilisation populaires et permet une intégration facile avec des plugins tiers. Pour en savoir plus sur les capacités du SDK Metaplex, vous pouvez consulter le [README](https://github.com/metaplex-foundation/js#readme).

L'un des programmes essentiels proposés par Metaplex est le programme Token Metadata. Le programme Token Metadata normalise le processus d'ajout de métadonnées aux jetons SPL. Lors de la création d'un NFT avec Metaplex, le programme Token Metadata crée un compte de métadonnées en utilisant une adresse dérivée du programme (PDA) avec l'émission de jetons comme seed. Cela permet de localiser de manière déterministe le compte de métadonnées de n'importe quel NFT en utilisant l'adresse de l'émission de jetons. Pour en savoir plus sur le programme Token Metadata, vous pouvez consulter la [documentation Metaplex](https://docs.metaplex.com/programs/token-metadata/).

Dans les sections suivantes, nous aborderons les bases de l'utilisation du SDK Metaplex pour préparer des actifs, créer des NFT, mettre à jour des NFT et associer un NFT à une collection plus large.

### Instance Metaplex

Une instance `Metaplex` sert de point d'entrée pour accéder aux API du SDK Metaplex. Cette instance accepte une connexion utilisée pour communiquer avec le cluster. De plus, les développeurs peuvent personnaliser les interactions du SDK en spécifiant un "Identity Driver" et un "Storage Driver".

L'Identity Driver est essentiellement une paire de clés qui peut être utilisée pour signer des transactions, une exigence lors de la création d'un NFT. Le Storage Driver est utilisé pour spécifier le service de stockage que vous souhaitez utiliser pour télécharger des actifs. Le driver `bundlrStorage` est l'option par défaut et télécharge des actifs sur Arweave, un service de stockage permanent et décentralisé.

Voici un exemple de configuration de l'instance `Metaplex` pour devnet.

```tsx
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
} from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const wallet = Keypair.generate();

const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(wallet))
  .use(
    bundlrStorage({
      address: "https://devnet.bundlr.network",
      providerUrl: "https://api.devnet.solana.com",
      timeout: 60000,
    }),
  );
```

### Téléchargement d'actifs

Avant de pouvoir créer un NFT, vous devez préparer et télécharger tous les actifs que vous prévoyez d'associer au NFT. Bien que cela ne soit pas nécessairement une image, la plupart des NFT ont une image qui leur est associée.

La préparation et le téléchargement d'une image impliquent de convertir l'image en tampon, de la convertir au format Metaplex en utilisant la fonction `toMetaplexFile`, et enfin de la télécharger sur le Storage Driver désigné.

Le SDK Metaplex prend en charge la création d'un nouveau fichier Metaplex à partir de fichiers présents sur votre ordinateur local ou de ceux téléchargés par un utilisateur via un navigateur. Vous pouvez faire cela en utilisant `fs.readFileSync` pour lire le fichier image, puis le convertir en fichier Metaplex en utilisant `toMetaplexFile`. Enfin, utilisez votre instance `Metaplex` pour appeler `storage().upload(file)` pour télécharger le fichier. La valeur de retour de la fonction sera l'URI où l'image a été stockée.

```tsx
const buffer = fs.readFileSync("/chemin/vers/image.png");
const file = toMetaplexFile(buffer, "image.png");

const imageUri = await metaplex.storage().upload(file);
```

### Téléchargement de métadonnées

Après avoir téléchargé une image, il est temps de télécharger les métadonnées JSON hors chaîne en utilisant la fonction `nfts().uploadMetadata`. Cela renverra une URI où les métadonnées JSON sont stockées.

Rappelez-vous, la partie hors chaîne des métadonnées comprend des éléments tels que l'URI de l'image ainsi que des informations supplémentaires telles que le nom et la description du NFT. Bien que vous puissiez techniquement inclure tout ce que vous souhaitez dans cet objet JSON, dans la plupart des cas, vous devriez suivre le [standard NFT](https://docs.metaplex.com/programs/token-metadata/token-standard#the-non-fungible-standard) pour assurer la compatibilité avec les portefeuilles, programmes et applications.

Pour créer les métadonnées, utilisez la méthode `uploadMetadata` fournie par le SDK. Cette méthode accepte un objet de métadonnées et renvoie un URI qui pointe vers les métadonnées téléchargées.

```tsx
const { uri } = await metaplex.nfts().uploadMetadata({
  name: "Mon NFT",
  description: "Ma description",
  image: imageUri,
});
```

### Création d'un NFT

Après avoir téléchargé les métadonnées du NFT, vous pouvez enfin créer le NFT sur le réseau. La méthode `create` du SDK Metaplex vous permet de créer un nouveau NFT avec une configuration minimale. Cette méthode gérera la création du compte d'émission, du compte de jetons, du compte de métadonnées et du compte d'édition maître pour vous. Les données fournies à cette méthode représenteront la partie onchain des métadonnées NFT. Vous pouvez explorer le SDK pour voir toutes les autres entrées qui peuvent éventuellement être fournies à cette méthode.

```tsx
const { nft } = await metaplex.nfts().create(
  {
    uri: uri,
    name: "Mon NFT",
    sellerFeeBasisPoints: 0,
  },
  { commitment: "finalized" },
);
```

Cette méthode renvoie un objet contenant des informations sur le NFT nouvellement créé. Par défaut, le SDK définit la propriété `isMutable` sur true, permettant des mises à jour des métadonnées du NFT. Cependant, vous pouvez choisir de définir `isMutable` sur false, rendant les métadonnées du NFT immuables.

### Mise à jour d'un NFT

Si vous avez laissé `isMutable` à true, vous pouvez avoir une raison de mettre à jour les métadonnées de votre NFT. La méthode `update` du SDK vous permet de mettre à jour à la fois les parties onchain et hors chaîne des métadonnées du NFT. Pour mettre à jour les métadonnées hors chaîne, vous devrez répéter les étapes de téléchargement d'une nouvelle image et de l'URI des métadonnées comme indiqué dans les étapes précédentes, puis fournir le nouvel URI des métadonnées à cette méthode. Cela changera l'URI vers lequel pointent les métadonnées onchain, mettant à jour efficacement les métadonnées hors chaîne également.

```tsx
const nft = await metaplex.nfts().findByMint({ mintAddress });

const { response } = await metaplex.nfts().update(
  {
    nftOrSft: nft,
    name: "Nom mis à jour",
    uri: uri,
    sellerFeeBasisPoints: 100,
  },
  { commitment: "finalized" },
);
```

Notez que tous les champs que vous n'incluez pas dans l'appel à `update` resteront les mêmes, par conception.

### Ajout d'un NFT à une collection

Une [Collection certifiée](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction) est un NFT auquel des NFT individuels peuvent appartenir. Pensez à une grande collection NFT comme Solana Monkey Business. Si vous regardez les [métadonnées](https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata) d'un NFT individuel, vous verrez un champ `collection` avec une `key` qui pointe vers le [NFT Collection certifiée](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/). En d'autres termes, les NFT qui font partie d'une collection sont associés à un autre NFT qui représente la collection elle-même.

Pour ajouter un NFT à une collection, il faut d'abord créer le NFT Collection. Le processus est le même qu'auparavant, sauf que vous inclurez un champ supplémentaire dans les métadonnées de notre NFT : `isCollection`. Ce champ indique au programme de jetons que ce NFT est un NFT de collection.

```tsx
const { collectionNft } = await metaplex.nfts().create(
  {
    uri: uri,
    name: "Ma collection NFT",
    sellerFeeBasisPoints: 0,
    isCollection: true
  },
  { commitment: "finalized" },
);
```

Vous définissez ensuite l'adresse d'émission de la collection comme référence pour le champ `collection` dans le nouveau NFT.

```tsx
const { nft } = await metaplex.nfts().create(
  {
    uri: uri,
    name: "Mon NFT",
    sellerFeeBasisPoints: 0,
    collection: collectionNft.mintAddress
  },
  { commitment: "finalized" },
);
```

Lorsque vous consultez les métadonnées sur votre NFT nouvellement créé, vous devriez maintenant voir un champ `collection` comme ceci :

```JSON
"collection":{
  "verified": false,
  "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

La dernière chose à faire est de vérifier le NFT. Cela bascule simplement le champ `verified` ci-dessus sur `true`, mais c'est extrêmement important. C'est ce qui permet aux programmes et applications consommateurs de savoir que votre NFT fait en fait partie de la collection. Vous pouvez le faire en utilisant la fonction `verifyCollection` :

```tsx
await metaplex.nfts().verifyCollection({
  mintAddress: nft.address,
  collectionMintAddress: collectionNft.address,
  isSizedCollection: true,
})
```

### Candy Machine 

Lors de la création et de la distribution d'un approvisionnement important de NFT, Metaplex facilite les choses avec leur programme [Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview) et [Sugar CLI](https://docs.metaplex.com/developer-tools/sugar/).

Candy Machine est essentiellement un programme de création et de distribution pour aider à lancer des collections NFT. Sugar est une interface de ligne de commande qui vous aide à créer une candy machine, préparer des actifs et créer des NFT à grande échelle. Les étapes couvertes ci-dessus pour créer un NFT seraient incroyablement fastidieuses à exécuter pour des milliers de NFT en une seule fois. Candy Machine et Sugar résolvent cela et contribuent à assurer un lancement équitable en offrant un certain nombre de protections.

Nous ne couvrirons pas ces outils en détail, mais vous pouvez découvrir [comment Candy Machine et Sugar fonctionnent ensemble à partir de la documentation Metaplex](https://docs.metaplex.com/developer-tools/sugar/overview/introduction).

Pour explorer l'ensemble des outils proposés par Metaplex, vous pouvez consulter le [dépôt Metaplex](https://github.com/metaplex-foundation/metaplex) sur GitHub.


# Laboratoire

Dans ce laboratoire, nous allons passer en revue les étapes pour créer un NFT à l'aide du SDK Metaplex, mettre à jour les métadonnées du NFT après coup, puis associer le NFT à une collection. À la fin, vous aurez une compréhension de base de l'utilisation du SDK Metaplex pour interagir avec des NFT sur Solana.

### 1. Point de départ

Pour commencer, téléchargez le code de départ depuis la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/solana-metaplex/tree/starter).

Le projet contient deux images dans le répertoire `src` que nous utiliserons pour les NFT.

De plus, dans le fichier `index.ts`, vous trouverez le code suivant qui inclut des données d'exemple pour le NFT que nous allons créer et mettre à jour.

```tsx
interface NftData {
  name: string;
  symbol: string;
  description: string;
  sellerFeeBasisPoints: number;
  imageFile: string;
}

interface CollectionNftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
  isCollection: boolean
  collectionAuthority: Signer
}

// exemple de données pour un nouveau NFT
const nftData = {
  name: "Nom",
  symbol: "SYMBOLE",
  description: "Description",
  sellerFeeBasisPoints: 0,
  imageFile: "solana.png",
}

// exemple de données pour la mise à jour d'un NFT existant
const updateNftData = {
  name: "Mise à jour",
  symbol: "MISE À JOUR",
  description: "Description de mise à jour",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
}

async function main() {
  // créer une nouvelle connexion à l'API du cluster
  const connection = new Connection(clusterApiUrl("devnet"));

  // initialiser une paire de clés pour l'utilisateur
  const user = await initializeKeypair(connection);

  console.log("PublicKey:", user.publicKey.toBase58());
}
```

Pour installer les dépendances nécessaires, exécutez `npm install` dans la ligne de commande.

Ensuite, exécutez le code en exécutant `npm start`. Cela créera une nouvelle paire de clés, l'écrira dans le fichier `.env` et distribuera des SOL de devnet à la paire de clés.

```
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

### 2. Metaplex Setup

Avant de commencer à créer et mettre à jour des NFT, nous devons configurer l'instance Metaplex. Mettez à jour la fonction `main()` comme suit:

```tsx
async function main() {
  // créer une nouvelle connexion à l'API du cluster
  const connection = new Connection(clusterApiUrl("devnet"));

  // initialiser une paire de clés pour l'utilisateur
  const user = await initializeKeypair(connection);

  console.log("PublicKey:", user.publicKey.toBase58());

  // Configuration de Metaplex
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
      }),
    );
}
```

### 3. Fonction d'aide `uploadMetadata`

Ensuite, créons une fonction d'aide pour gérer le processus de téléchargement d'une image et de métadonnées, et renvoyer l'URI des métadonnées. Cette fonction prendra l'instance Metaplex et les données NFT en entrée, et renverra l'URI des métadonnées en sortie.

```tsx
// fonction d'aide pour télécharger l'image et les métadonnées
async function uploadMetadata(
  metaplex: Metaplex,
  nftData: NftData,
): Promise<string> {
  // fichier en tampon
  const buffer = fs.readFileSync("src/" + nftData.imageFile);

  // tampon en fichier Metaplex
  const file = toMetaplexFile(buffer, nftData.imageFile);

  // télécharger l'image et obtenir l'URI de l'image
  const imageUri = await metaplex.storage().upload(file);
  console.log("image uri:", imageUri);

  // télécharger les métadonnées et obtenir l'URI des métadonnées (métadonnées hors chaîne)
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: nftData.name,
    symbol: nftData.symbol,
    description: nftData.description,
    image: imageUri,
  });

  console.log("metadata uri:", uri);
  return uri;
}
```

Cette fonction lira un fichier image, le convertira en tampon, puis le téléchargera pour obtenir une URI de l'image. Elle téléchargera ensuite les métadonnées du NFT, qui incluent le nom, le symbole, la description et l'URI de l'image, et obtiendra une URI des métadonnées. Cet URI est hors chaîne. Cette fonction écrira dans les logs l'URI de l'image et l'URI des métadonnées pour référence.

### 5. Fonction d'aide `createNft`

Ensuite, créons une fonction d'aide pour créer le NFT. Cette fonction prendra l'instance Metaplex, l'URI des métadonnées et les données NFT en entrée. Elle utilisera la méthode `create` du SDK pour créer le NFT, en passant l'URI des métadonnées, le nom, la commission du vendeur et le symbole en tant que paramètres.

```tsx
// fonction d'aide pour créer un NFT
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData,
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // URI des métadonnées
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
    },
    { commitment: "finalized" },
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );



  return nft;
}
```

La fonction `createNft` enregistre l'URL du jeton mint et renvoie un objet `nft` contenant des informations sur le NFT nouvellement créé. Le NFT sera émis à la clé publique correspondant à l'utilisateur utilisé comme pilote d'identité lors de la configuration de l'instance Metaplex.

### 6. Créer un NFT

Maintenant que nous avons configuré l'instance Metaplex et créé des fonctions d'aide pour télécharger des métadonnées et créer des NFT, nous pouvons tester ces fonctions en créant un NFT. Dans la fonction `main()`, appelez la fonction `uploadMetadata` pour télécharger les données NFT et obtenir l'URI des métadonnées. Ensuite, utilisez la fonction `createNft` et l'URI des métadonnées pour créer un NFT.

```tsx
async function main() {
	...

  // télécharger les données NFT et obtenir l'URI des métadonnées
  const uri = await uploadMetadata(metaplex, nftData)

  // créer un NFT en utilisant la fonction d'aide et l'URI des métadonnées
  const nft = await createNft(metaplex, uri, nftData)
}
```

Exécutez `npm start` dans la ligne de commande pour exécuter la fonction `main`. Vous devriez voir une sortie similaire à la suivante :

```tsx
Current balance is 1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
image uri: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
metadata uri: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
Finished successfully
```

N'hésitez pas à inspecter les URIs générés pour l'image et les métadonnées, ainsi qu'à afficher le NFT sur l'explorateur Solana en visitant l'URL fournie dans la sortie.

### 7. Fonction d'aide `updateNftUri`

Ensuite, créons une fonction d'aide pour gérer la mise à jour de l'URI d'un NFT existant. Cette fonction prendra l'instance Metaplex, l'URI des métadonnées et l'adresse du jeton mint du NFT. Elle utilisera la méthode `findByMint` du SDK pour récupérer les données existantes du NFT en utilisant l'adresse du jeton mint, puis utilisera la méthode `update` pour mettre à jour les métadonnées avec le nouvel URI. Enfin, elle écrira dans les logs l'URL du jeton mint et la signature de la transaction pour référence.

```tsx
// fonction d'aide pour mettre à jour un NFT
async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
) {
  // récupération des données du NFT en utilisant l'adresse du jeton mint
  const nft = await metaplex.nfts().findByMint({ mintAddress });

  // mis à jour les métadonnées du NFT
  const { response } = await metaplex.nfts().update(
    {
      nftOrSft: nft,
      uri: uri,
    },
    { commitment: "finalized" },
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  console.log(
    `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
  );
}
```

### 8. Mettre à jour un NFT

Pour mettre à jour un NFT existant, nous devons d'abord télécharger de nouvelles métadonnées pour le NFT et obtenir le nouvel URI. Dans la fonction `main()`, appelez à nouveau la fonction `uploadMetadata` pour télécharger les données mises à jour du NFT et obtenir le nouvel URI des métadonnées. Ensuite, nous pouvons utiliser la fonction d'aide `updateNftUri`, en passant l'instance Metaplex, le nouvel URI des métadonnées et l'adresse du jeton mint du NFT. L'adresse `nft.address` provient de la sortie de la fonction `createNft`.

```tsx
async function main() {
	...

  // télécharger les données mises à jour du NFT et obtenir le nouvel URI des métadonnées
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // mettre à jour le NFT en utilisant la fonction d'aide et le nouvel URI des métadonnées
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

Exécutez `npm start` dans la ligne de commande pour exécuter la fonction `main`. Vous devriez voir une sortie supplémentaire similaire à la suivante :

```tsx
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
Finished successfully
```

Vous pouvez également voir les NFT dans le portefeuille Phantom en important la `PRIVATE_KEY` du fichier .env.

### 9. Créer une collection de NFT

Génial, vous savez maintenant comment créer un seul NFT et le mettre à jour sur la blockchain Solana ! Mais comment l'ajoutez-vous à une collection ?

Tout d'abord, créons une fonction d'aide appelée `createCollectionNft`. Notez qu'elle est très similaire à `createNft`, mais elle s'assure que `isCollection` est défini sur true et que les données correspondent aux exigences d'une collection.

```tsx
async function createCollectionNft(
  metaplex: Metaplex,
  uri: string,
  data: CollectionNftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri,
      name: data.name,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints,
      symbol: data.symbol,
      isCollection: true,
    },
    { commitment: "finalized" }
  )

  console.log(
    `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  )

  return nft
}
```

Ensuite, nous devons créer les données hors chaîne pour la collection. Dans `main` *avant* les appels existants à `createNft`, ajoutez la `collectionNftData` suivante :

```tsx
const collectionNftData = {
  name: "TestCollectionNFT",
  symbol: "TEST",
  description: "Test Description Collection",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
  isCollection: true,
  collectionAuthority: user,
}
```

Maintenant, appelons `uploadMetadata` avec `collectionNftData` et appelons ensuite `createCollectionNft`. Encore une fois, faites cela *avant* le code qui crée un NFT.

```tsx
async function main() {
  ...

  // téléchargement des données pour la collection de NFT et obtenir l'URI des métadonnées
  const collectionUri = await uploadMetadata(metaplex, collectionNftData)

  // création de la collection de NFT en utilisant la fonction d'aide et l'URI des métadonnées
  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData
  )
}
```

Cela renverra l'adresse mint de notre collection afin que nous puissions l'utiliser pour attribuer des NFT à la collection.

### 10. Assigner un NFT à une collection

Maintenant que nous avons une collection, modifions notre code existant pour que les nouveaux NFT créés soient ajoutés à la collection. Tout d'abord, modifions notre fonction `createNft` pour que l'appel à `nfts().create` inclue le champ `collection`. Ensuite, ajoutez du code qui appelle `verifyCollection` pour que le champ `verified` dans les métadonnées en chaîne soit défini sur `true`. C'est ainsi que les programmes et applications consommateurs peuvent savoir avec certitude que le NFT appartient effectivement à la collection.

```tsx
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // URI des métadonnées
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
    },
    { commitment: "finalized" }
  )

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}? cluster=devnet`
  )

  // c'est ce qui vérifie notre collection en tant que collection certifiée
  await metaplex.nfts().verifyCollection({  
    mintAddress: nft.mint.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  })

  return nft
}
```

Maintenant, exécutez `npm start` et voilà ! Si vous suivez le nouveau lien nft et regardez l'onglet Métadonnées, vous verrez un champ `collection` avec l'adresse mint de votre collection répertoriée.

Félicitations ! Vous avez appris avec succès comment utiliser le SDK Metaplex pour créer, mettre à jour et vérifier des NFT dans le cadre d'une collection. C'est tout ce dont vous avez besoin pour développer votre propre collection pour presque n'importe quel cas d'utilisation. Vous pourriez créer un concurrent de TicketMaster, réviser le programme d'adhésion de Costco, ou même numériser le système de carte d'identité étudiante de votre école. Les possibilités sont infinies !

Si vous voulez jeter un coup d'œil au code de solution final, vous pouvez le trouver sur la branche de solution du même [dépôt](https://github.com/Unboxed-Software/solana-metaplex/tree/solution).

# Défi

Pour approfondir votre compréhension des outils Metaplex, plongez dans la documentation Metaplex et familiarisez-vous avec les différents programmes et outils proposés par Metaplex. Par exemple, vous pouvez vous plonger dans l'apprentissage du programme Candy Machine pour comprendre son fonctionnement.

Une fois que vous avez compris comment fonctionne le programme Candy Machine, mettez vos connaissances à l'épreuve en utilisant la ligne de commande Sugar (Sugar CLI) pour créer une Candy Machine pour votre propre collection. Cette expérience pratique renforcera non seulement votre compréhension des outils, mais renforcera également votre confiance dans votre capacité à les utiliser efficacement à l'avenir.

Amusez-vous bien ! Ce sera votre première collection de NFT créée de manière indépendante ! Avec cela, vous terminez le Module 2. J'espère que vous ressentez le processus ! N'hésitez pas à [partager quelques commentaires rapides](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%202) afin que nous puissions continuer à améliorer le cours !

## Vous avez fini le laboratoire ?

Envoyez votre code sur GitHub et [dites-nous ici ce que vous avez pensé de cette lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=296745ac-503c-4b14-b3a6-b51c5004c165) !
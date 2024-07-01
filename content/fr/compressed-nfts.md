---
title: NFT compressés
objectives:
- Créer une collection de NFT compressés en utilisant le programme Bubblegum de Metaplex
- Générer des NFT compressés en utilisant le SDK Bubblegum TS
- Transférer des NFT compressés en utilisant le SDK Bubblegum TS
- Lire les données des NFT compressés en utilisant l'API de lecture
---

# Résumé

- Les **NFT compressés (cNFT)** utilisent la **Compression d'État** pour hacher les données NFT et stocker le hash onchain dans un compte en utilisant une structure d'**arbre merkle concurrent**.
- Le hash des données cNFT ne peut pas être utilisé pour déduire les données cNFT, mais il peut être utilisé pour **vérifier** si les données cNFT que vous voyez sont correctes.
- Les fournisseurs RPC prennent en **index** les données cNFT hors chaîne lorsque le cNFT est généré, de sorte que vous pouvez utiliser l'**API de lecture** pour accéder aux données.
- Le **programme Bubblegum de Metaplex** est une abstraction au-dessus du programme **Compression d'État** qui vous permet de créer, générer et gérer plus facilement des collections cNFT.

# Aperçu général

Les NFT compressés (cNFT) sont exactement ce que leur nom suggère : des NFT dont la structure occupe moins d'espace de stockage de compte que les NFT traditionnels. Les NFT compressés utilisent un concept appelé **Compression d'État** pour stocker les données de manière à réduire considérablement les coûts.

Les coûts des transactions sur Solana sont si bas que la plupart des utilisateurs ne pensent jamais à la coûteuse création d'une grande quantité de NFT. Le coût pour configurer et générer 1 million de NFT traditionnels est d'environ 24 000 SOL. En comparaison, les cNFT peuvent être structurés de manière à ce que la même configuration et le même coût de génération coûtent 10 SOL ou moins. Cela signifie que toute personne utilisant des NFT à grande échelle pourrait réduire les coûts de plus de 1000 fois en utilisant des cNFT plutôt que des NFT traditionnels.

Cependant, travailler avec des cNFT peut être délicat. Éventuellement, les outils nécessaires pour travailler avec eux seront suffisamment abstraits de la technologie sous-jacente, de sorte que l'expérience de développement entre les NFT traditionnels et les cNFT sera négligeable. Mais pour l'instant, vous devrez toujours comprendre les éléments de bas niveau, alors plongeons-y !

## Aperçu théorique des cNFT

La plupart des coûts associés aux NFT traditionnels proviennent de l'espace de stockage du compte. Les NFT compressés utilisent un concept appelé Compression d'État pour stocker des données dans l'état de la blockchain, en utilisant un espace de compte plus cher uniquement pour stocker une "empreinte digitale" ou **hash** des données. Ce hash vous permet de vérifier cryptographiquement que les données n'ont pas été altérées.

Pour stocker des empreintes digitales et permettre la vérification, nous utilisons une structure d'arbre binaire spéciale appelée **arbre merkle concurrent**. Cette structure d'arbre nous permet de hacher des données de manière déterministe pour calculer un seul hash final qui est stocké onchain. Ce hash final est beaucoup plus petit que la taille combinée de toutes les données originales, d'où la "compression". Les étapes de ce processus sont les suivantes :

1. Prendre n'importe quelle donnée.
2. Créer un hash de cette donnée.
3. Stocker ce hash en tant que "feuille" en bas de l'arbre.
4. Chaque paire de feuilles est ensuite hashée ensemble, créant une "branche".
5. Chaque branche est ensuite hashée ensemble.
6. Monter continuellement dans l'arbre et hasher les branches adjacentes ensemble.
7. Une fois en haut de l'arbre, un hash final "racine" est produit.
8. Stocker la racine hash onchain comme preuve vérifiable des données dans chaque feuille.
9. Toute personne souhaitant vérifier que les données qu'elle possède correspondent à la "source de vérité" peut suivre le même processus et comparer le hash final sans avoir à stocker toutes les données onchain.

Un problème non abordé ci-dessus est comment rendre les données disponibles si elles ne peuvent pas être récupérées à partir d'un compte. Étant donné que ce processus de hachage se produit onchain, toutes les données existent dans l'état de la blockchain et pourraient théoriquement être récupérées à partir de la transaction originale en rejouant l'état complet de la chaîne depuis l'origine. Cependant, il est beaucoup plus simple (bien que toujours compliqué) d'avoir un **indexeur** qui suit et indexe ces données au fur et à mesure que les transactions se produisent. Cela garantit qu'il existe un "cache" hors chaîne des données que n'importe qui peut accéder et vérifier par rapport au hash racine onchain.

Ce processus est *très complexe*. Nous aborderons certains des concepts clés ci-dessous, mais ne vous inquiétez pas si vous ne comprenez pas tout de suite. Nous parlerons davantage de la théorie dans la leçon sur la compression d'état et nous nous concentrerons principalement sur l'application aux NFT dans cette leçon. Vous serez en mesure de travailler avec des cNFT à la fin de cette leçon même si vous ne comprenez pas entièrement chaque élément du puzzle de compression d'état.

### Arbres Merkle Concurrents

Un **arbre merkle** est une structure d'arbre binaire représentée par un seul hash. Chaque nœud feuille de la structure est un hash de ses données internes, tandis que chaque branche est un hash des hashes des nœuds feuilles. En fin de compte, les branches sont également hashées ensemble jusqu'à ce qu'il ne reste finalement qu'un seul hash racine.

Toute modification des données des feuilles change le hash racine. Cela pose un problème lorsque plusieurs transactions dans le même slot tentent de modifier les données des feuilles. Étant donné que ces transactions doivent s'exécuter en série, toutes sauf la première échoueront, car le hash racine et la preuve transmis auront été invalidés par la première transaction à être exécutée.

Un **arbre merkle concurrent** est un arbre merkle qui stocke un journal de changements sécurisé des modifications les plus récentes avec leur hash racine et la preuve pour la dériver. Lorsque plusieurs transactions dans le même slot tentent de modifier les données des feuilles, le journal de changements peut être utilisé comme source de vérité pour permettre des changements concurrents à l'arbre.

Lorsque vous travaillez avec un arbre merkle concurrent, il y a trois variables qui déterminent la taille de l'arbre, le coût de création de l'arbre et le nombre de changements concurrents pouvant être apportés à l'arbre :

1. Profondeur maximale
2. Taille maximale du tampon
3. Profondeur de la canopée

La **profondeur maximale** est le nombre maximum de sauts nécessaires pour passer de n'importe quelle feuille à la racine de l'arbre. Étant donné que les arbres merkle sont des arbres binaires, chaque feuille est connectée à une seule autre feuille. La profondeur maximale peut alors logiquement être utilisée pour calculer le nombre de nœuds pour l'arbre avec `2 ^ maxDepth`.

La **taille maximale du tampon** est effectivement le nombre maximum de modifications concurrentes que vous pouvez apporter à un arbre dans un seul slot tout en conservant un hash racine valide.

La **profondeur de la canopée** est le nombre de nœuds de preuve stockés onchain pour un chemin de preuve donné. La vérification de toute feuille nécessite le chemin de preuve complet pour l'arbre. Le chemin de preuve complet est composé d'un nœud de preuve pour chaque "couche" de l'arbre, c'est-à-dire une profondeur maximale de 14 signifie qu'il y a 14 nœuds de preuve. Chaque nœud de preuve ajoute 32 octets à une transaction, de sorte que les arbres volumineux dépasseraient rapidement la limite de taille maximale de transaction sans mettre en cache les nœuds de preuve hors chaîne.

Chacune de ces trois valeurs, la profondeur maximale, la taille maximale du tampon et la profondeur de la canopée, comporte un compromis. Augmenter la valeur de l'une de ces valeurs augmente la taille du compte utilisé pour stocker l'arbre, augmentant ainsi le coût de sa création.

Le choix de la profondeur maximale est assez simple car elle est directement liée au nombre de feuilles et donc à la quantité de données que vous pouvez stocker. Si vous avez besoin de 1 million de cNFT sur un seul arbre, trouvez la profondeur maximale qui rend l'expression suivante vraie : `2^maxDepth > 1million`. La réponse est 20.

Le choix de la taille maximale du tampon est essentiellement une question de débit : combien d'écritures concurrentes avez-vous besoin.

### Programme de Compression d'État SPL et Programmes Noop

Le Programme de Compression d'État SPL existe pour rendre le processus ci-dessus reproductible et composable dans tout l'écosystème Solana. Il fournit des instructions pour initialiser les arbres merkle, gérer les feuilles de l'arbre (c'est-à-dire ajouter, mettre à jour, supprimer des données) et vérifier les données des feuilles.

Le Programme de Compression d'État utilise également un programme "no op" distinct dont le but principal est de faciliter l'indexation des données des feuilles en les journalisant dans l'état de la blockchain.

### Utiliser l'état de la blockchain pour le stockage

La blockchain Solana est une liste d'entrées contenant des transactions signées. En théorie, cela peut être retracé jusqu'au bloc génésis. Cela signifie effectivement que toutes les données qui ont été mises dans une transaction existent dans l'état de la blockchain.

Lorsque vous souhaitez stocker des données compressées, vous les transmettez au programme de Compression d'État où elles sont hachées et émises sous la forme d'un "événement" vers le programme Noop. Le hash est ensuite stocké dans l'arbre merkle concurrent correspondant. Puisque les données ont transité par une transaction et existent même dans les journaux du programme Noop, elles existeront à jamais dans l'état de la blockchain.

### Indexer les données pour une recherche facile

Dans des conditions normales, vous accéderiez généralement aux données onchain en récupérant le compte approprié. Cependant, lors de l'utilisation de la compression d'état, ce n'est pas si simple.

Comme mentionné ci-dessus, les données existent désormais dans l'état de la blockchain plutôt que dans un compte. L'endroit le plus simple pour trouver les données complètes est dans les journaux de l'instruction Noop, mais bien que ces données existent d'une certaine manière dans l'état de la blockchain pour toujours, elles seront probablement inaccessibles par les validateurs après un certain laps de temps.

Pour économiser de l'espace et être plus performant, les validateurs ne conservent pas toutes les transactions jusqu'au bloc génésis. La durée spécifique pendant laquelle vous pourrez accéder aux journaux d'instructions Noop liés à vos données variera en fonction du validateur, mais éventuellement, vous perdrez l'accès si vous comptez directement sur les journaux d'instructions.

Techniquement, vous *pouvez* rejouer l'état de la transaction jusqu'au bloc génésis, mais une équipe moyenne ne le fera pas, et cela ne sera certainement pas performant. Au lieu de cela, vous devriez utiliser un indexeur qui observera les événements envoyés au programme Noop et stockera les données pertinentes hors chaîne. De cette façon, vous n'avez pas à vous soucier du fait que les anciennes données deviennent inaccessibles.

## Créer une collection de cNFT

Avec les bases théoriques établies, concentrons-nous maintenant sur le point principal de cette leçon : comment créer une collection de cNFT.

Heureusement, vous pouvez utiliser des outils créés par la Fondation Solana, la communauté des développeurs Solana et Metaplex pour simplifier le processus. Plus précisément, nous utiliserons le SDK `@solana/spl-account-compression`, le programme Bubblegum de Metaplex et le SDK TS correspondant du programme Bubblegum `@metaplex-foundation/mpl-bugglegum`.

<aside>
💡 Au moment de la rédaction, l'équipe Metaplex est en train de passer à un nouveau SDK client Bubblegum qui prend en charge umi, leur cadre modulaire pour la construction et l'utilisation de clients JS pour les programmes Solana. Nous n'utiliserons pas la version umi du SDK dans cette leçon. Au contraire, nous figerons notre dépendance à la version 0.7 (`@metaplex-foundation/mpl-bubblegum@0.7`). Cette version fournit des fonctions d'aide simples pour construire des instructions Bubblegum.

</aside>

### Préparer les métadonnées

Avant de commencer, vous préparerez vos métadonnées NFT de la même manière que si vous utilisiez une Candy Machine. Fondamentalement, un NFT est simplement un jeton avec des métadonnées qui suivent la norme NFT. En d'autres termes, cela devrait ressembler à ceci :

```json
{
  "name": "12_217_47",
  "symbol": "RGB",
  "description": "Couleur RGB aléatoire",
  "seller_fee_basis_points": 0,
  "image": "https://raw.githubusercontent.com/ZYJLiu/rgb-png-generator/master/assets/12_217_47/12_217_47.png",
  "attributes": [
    {
      "trait_type": "R",
      "value": "12"
    },
    {
      "trait_type": "G",
      "value": "217"
    },
    {
      "trait_type": "B",
      "value": "47"
    }
  ]
}
```

En fonction de votre cas d'utilisation, vous pourrez peut-être générer cela dynamiquement ou vous voudrez peut-être avoir un fichier JSON préparé pour chaque cNFT au préalable. Vous aurez également besoin de tout autre actif référencé par le JSON, tel que l'URL `image` indiquée dans l'exemple ci-dessus.

### Créer un NFT de Collection

Si vous souhaitez que vos cNFT fassent partie d'une collection, vous devrez créer un NFT de Collection **avant** de commencer à générer des cNFT. Il s'agit d'un NFT traditionnel qui agit comme la référence liant vos cNFT ensemble dans une seule collection. Vous pouvez créer ce NFT en utilisant la bibliothèque `@metaplex-foundation/js`. Assurez-vous simplement de définir `isCollection` sur `true`.

```tsx
const collectionNft = await metaplex.nfts().create({
    uri: someUri,
    name: "Collection NFT",
    sellerFeeBasisPoints: 0,
    updateAuthority: somePublicKey,
    mintAuthority: somePublicKey,
    tokenStandard: 0,
    symbol: "Collection",
    isMutable: true,
    isCollection: true,
})
```

### Créer un compte d'arbre Merkle

Maintenant, nous commençons à dévier du processus que vous utiliseriez pour créer des NFT traditionnels. Le mécanisme de stockage onchain que vous utilisez pour la compression d'état est un compte représentant un arbre merkle concurrent. Cet arbre merkle appartient au programme de Compression d'État SPL. Avant de pouvoir faire quoi que ce soit lié aux cNFT, vous devez créer un compte d'arbre merkle vide de la taille appropriée.

Les variables qui impactent la taille du compte sont :

1. Profondeur maximale
2. Taille maximale du tampon
3. Profondeur de la canopée

Les deux premières variables doivent être choisies parmi un ensemble existant de paires valides. Le tableau ci-dessous montre les paires valides ainsi que le nombre maximum de cNFT qui peuvent être créés avec ces valeurs.

| Profondeur Maximale | Taille Maximale du Tampon | Nombre Max de cNFT |
| --- | --- | --- |
| 3 | 8 | 8 |
| 5 | 8 | 32 |
| 14 | 64 | 16 384 |
| 14 | 256 | 16 384 |
| 14 | 1 024 | 16 384 |
| 14 | 2 048 | 16 384 |
| 15 | 64 | 32 768 |
| 16 | 64 | 65 536 |
| 17 | 64 | 131 072 |
| 18 | 64 | 262 144 |
| 19 | 64 | 524 288 |
| 20 | 64 | 1 048 576 |
| 20 | 256 | 1 048 576 |
| 20 | 1 024 | 1 048 576 |
| 20 | 2 048 | 1 048 576 |
| 24 | 64 | 16 777 216 |
| 24 | 256 | 16 777 216 |
| 24 | 512 | 16 777 216 |
| 24 | 1 024 | 16 777 216 |
| 24 | 2 048 | 16 777 216 |
| 26 | 512 | 67 108 864 |
| 26 | 1 024 | 67 108 864 |
| 26 | 2 048 | 67 108 864 |
| 30 | 512 | 1 073 741 824 |
| 30 | 1 024 | 1 073 741 824 |
| 30 | 2 048 | 1 073 741 824 |

Notez que le nombre de cNFT pouvant être stockés dans l'arbre dépend entièrement de la profondeur maximale, tandis que la taille du tampon déterminera le nombre de modifications concurrentes (créations, transferts, etc.) dans la même plage qui peuvent se produire dans l'arbre. En d'autres termes, choisissez la profondeur maximale correspondant au nombre de cNFT que vous souhaitez que l'arbre contienne, puis choisissez l'une des options pour la taille maximale du tampon en fonction du trafic que vous prévoyez de devoir supporter.

Ensuite, choisissez la profondeur de la canopée. Augmenter la profondeur de la canopée augmente la composabilité de vos cNFT. Chaque fois que votre code ou celui d'un autre développeur tente de vérifier un cNFT ultérieurement, le code devra passer autant de nœuds de preuve qu'il y a de "couches" dans votre arbre. Ainsi, pour une profondeur maximale de 20, vous devrez passer 20 nœuds de preuve. Non seulement cela est fastidieux, mais étant donné que chaque nœud de preuve est de 32 octets, il est possible de saturer rapidement les tailles de transaction.

Par exemple, si votre arbre a une profondeur de canopée très basse, une place de marché de NFT ne pourra peut-être prendre en charge que des transferts simples de NFT plutôt que de prendre en charge un système d'enchères sur chaîne pour vos cNFT. La canopée met en cache efficacement les nœuds de preuve sur la chaîne afin que vous n'ayez pas à tous les transmettre dans la transaction, permettant des transactions plus complexes.

Augmenter l'une de ces trois valeurs augmente la taille du compte, augmentant ainsi le coût associé à sa création. Pesez les avantages en conséquence lors du choix des valeurs.

Une fois que vous connaissez ces valeurs, vous pouvez utiliser la fonction d'aide `createAllocTreeIx` du SDK TypeScript `@solana/spl-account-compression` pour créer l'instruction permettant de créer le compte vide.

```tsx
import { createAllocTreeIx } from "@solana/spl-account-compression"

const treeKeypair = Keypair.generate()

const allocTreeIx = await createAllocTreeIx(
  connection,
  treeKeypair.publicKey,
  payer.publicKey,
  { maxDepth: 20; maxBufferSize: 256 },
  canopyDepth
)
```

Notez que ceci est simplement une fonction d'aide pour calculer la taille requise par le compte et créer l'instruction à envoyer au programme Système pour allouer le compte. Cette fonction n'interagit pas encore avec des programmes spécifiques à la compression.

### Utilisez Bubblegum pour initialiser votre arbre

Avec le compte d'arbre vide créé, utilisez ensuite le programme Bubblegum pour initialiser l'arbre. En plus du compte d'arbre Merkle, Bubblegum crée un compte de configuration d'arbre pour ajouter un suivi et une fonctionnalité spécifiques aux cNFT.

La version 0.7 du SDK TypeScript `@metaplex-foundation/mpl-bubblegum` fournit la fonction d'aide `createCreateTreeInstruction` pour appeler l'instruction `create_tree` sur le programme Bubblegum. Dans le cadre de l'appel, vous devrez dériver l'adresse PDA `treeAuthority` attendue par le programme. Cette PDA utilise l'adresse de l'arbre comme seed.

```tsx
import {
	createAllocTreeIx,
	SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression"
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createCreateTreeInstruction,
} from "@metaplex-foundation/mpl-bubblegum"

...

const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
  [treeKeypair.publicKey.toBuffer()],
  BUBBLEGUM_PROGRAM_ID
)

const createTreeIx = createCreateTreeInstruction(
  {
    treeAuthority,
    merkleTree: treeKeypair.publicKey,
    payer: payer.publicKey,
    treeCreator: payer.publicKey,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  },
  {
    maxBufferSize: 256,
    maxDepth: 20,
    public: false,
  },
  BUBBLEGUM_PROGRAM_ID
)
```

La liste ci-dessous montre les entrées requises pour cette fonction d'aide :

- `accounts` - Un objet représentant les comptes requis par l'instruction. Cela comprend :
    - `treeAuthority` - Bubblegum s'attend à ce que ce soit une PDA dérivée en utilisant l'adresse de l'arbre de Merkle comme seed
    - `merkleTree` - Le compte d'arbre de Merkle
    - `payer` - L'adresse qui paie les frais de transaction, le loyer, etc.
    - `treeCreator` - L'adresse à indiquer en tant que créateur de l'arbre
    - `logWrapper` - Le programme à utiliser pour exposer les données aux indexeurs via les journaux ; cela devrait être l'adresse du programme SPL Noop à moins que vous n'ayez une autre implémentation personnalisée
    - `compressionProgram` - Le programme de compression à utiliser pour initialiser l'arbre de Merkle ; cela devrait être l'adresse du programme SPL State Compression à moins que vous n'ayez une autre implémentation personnalisée
- `args` - Un objet représentant des arguments supplémentaires requis par l'instruction. Cela comprend :
    - `maxBufferSize` - La taille maximale du tampon de l'arbre de Merkle
    - `maxDepth` - La profondeur maximale de l'arbre de Merkle
    - `public` - Lorsqu'il est défini sur `true`, n'importe qui pourra créer des cNFT à partir de l'arbre ; lorsqu'il est défini sur `false`, seul le créateur de l'arbre ou le délégué de l'arbre pourra créer des cNFT à partir de l'arbre

Lorsqu'il est soumis, cela invoquera l'instruction `create_tree` sur le programme Bubblegum. Cette instruction fait trois choses :

1. Crée le compte PDA de configuration de l'arbre
2. Initialise le compte de configuration de l'arbre avec des valeurs initiales appropriées
3. Émet une CPI vers le programme State Compression pour initialiser le compte d'arbre de Merkle vide

N'hésitez pas à jeter un coup d'œil au code du programme [ici](https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/programs/bubblegum/program/src/lib.rs#L887).

### Émettez des cNFT

Avec le compte d'arbre de Merkle et son compte de configuration Bubblegum correspondant initialisés, il est possible de créer des cNFT pour l'arbre. L'instruction Bubblegum à utiliser sera soit `mint_v1` soit `mint_to_collection_v1`, en fonction de savoir si vous souhaitez que le cNFT créé fasse partie d'une collection.

La version 0.7 du SDK TypeScript `@metaplex-foundation/mpl-bubblegum` fournit des fonctions d'aide `createMintV1Instruction` et `createMintToCollectionV1Instruction` pour faciliter la création des instructions.

Les deux fonctions vous demanderont de passer les métadonnées NFT et une liste de comptes nécessaires pour créer le cNFT. Voici un exemple de création pour une collection :

```tsx
const mintWithCollectionIx = createMintToCollectionV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    collectionAuthority: payer.publicKey,
    collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID,
    collectionMint: collectionDetails.mint,
    collectionMetadata: collectionDetails.metadata,
    editionAccount: collectionDetails.masterEditionAccount,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    bubblegumSigner,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  },
  {
    metadataArgs: Object.assign(nftMetadata, {
      collection: { key: collectionDetails.mint, verified: false },
    }),
  }
)
```

Remarquez qu'il y a deux arguments pour la fonction d'aide : `accounts` et `args`. Le paramètre `args` est simplement les métadonnées NFT, tandis que `accounts` est un objet listant les comptes nécessaires pour l'instruction. Il y en a certes beaucoup :

- `payer` - le compte qui paiera les frais de transaction, le loyer, etc.
- `merkleTree` - le compte d'arbre de Merkle
- `treeAuthority` - l'autorité de l'arbre ; devrait être la même PDA que celle que vous avez dérivée précédemment
- `treeDelegate` - le délégué de l'arbre ; il s'agit généralement du même que le créateur de l'arbre
- `leafOwner` - le propriétaire souhaité du cNFT compressé en cours de création
- `leafDelegate` - le délégué souhaité du cNFT compressé en cours de création ; il s'agit généralement du même que le propriétaire de la feuille
- `collectionAuthority` - l'autorité du cNFT de collection
- `collectionAuthorityRecordPda` - PDA facultative du registre d'autorité de collection ; il n'y en a généralement pas, auquel cas vous devez mettre l'adresse du programme Bubblegum
- `collectionMint` - le compte de création pour le cNFT de collection
- `collectionMetadata` - le compte de métadonnées pour le cNFT de collection
- `editionAccount` - le compte d'édition principale du cNFT de collection
- `compressionProgram` - le programme de compression à utiliser ; cela devrait être l'adresse du programme SPL State Compression à moins que vous n'ayez une autre implémentation personnalisée
- `logWrapper` - le programme à utiliser pour exposer les données aux indexeurs via les journaux ; cela devrait être l'adresse du programme SPL Noop à moins que vous n'ayez une autre implémentation personnalisée
- `bubblegumSigner` - une PDA utilisée par le programme Bubblegum pour gérer la vérification de la collection
- `tokenMetadataProgram` - le programme de métadonnées de jetons qui a été utilisé pour le cNFT de collection ; il s'agit généralement toujours du programme de métadonnées de jetons Metaplex

Créer sans une collection nécessite moins de comptes, aucun d'entre eux n'étant exclusif à la création sans une collection. Vous pouvez consulter l'exemple ci-dessous.

```tsx
const mintWithoutCollectionIx = createMintV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
  },
  {
    message: nftMetadata,
  }
)
```

## Interagir avec les cNFT

Il est important de noter que les cNFT *ne sont pas* des jetons SPL. Cela signifie que votre code doit suivre des conventions différentes pour gérer les fonctionnalités cNFT telles que la récupération, la recherche, le transfert, etc.

### Récupérer les données cNFT

La manière la plus simple de récupérer des données à partir d'un cNFT existant est d'utiliser l'API de lecture [Digital Asset Standard Read](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) (Read API). Notez que cela est séparé du JSON RPC standard. Pour utiliser l'API Read, vous devrez utiliser un fournisseur RPC la prenant en charge. Metaplex maintient une liste (probablement non exhaustive) de [fournisseurs RPC](https://developers.metaplex.com/bubblegum/rpcs) prenant en charge l'API Read. Dans cette leçon, nous utiliserons [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) car ils offrent un support gratuit pour Devnet.

Pour utiliser l'API Read pour récupérer un cNFT spécifique, vous devez avoir l'ID d'actif du cNFT. Cependant, après la création de cNFT, vous aurez au plus deux informations :

1. La signature de la transaction
2. L'index de la feuille (éventuellement)

La seule garantie réelle est que vous aurez la signature de la transaction. Il est **possible** de localiser l'index de la feuille à partir de là, mais cela implique une analyse assez complexe. En résumé, vous devez récupérer les journaux d'instructions pertinents du programme Noop et les analyser pour trouver l'index de la feuille. Nous couvrirons cela plus en détail dans une leçon future. Pour l'instant, nous supposerons que vous connaissez l'index de la feuille.

C'est une hypothèse raisonnable pour la plupart des créations, étant donné que la création sera contrôlée par votre code et peut être configurée séquentiellement pour que votre code puisse suivre l'index utilisé pour chaque création. C'est-à-dire que la première création utilisera l'index 0, la deuxième l'index 1, etc.

Une fois que vous avez l'index de la feuille, vous pouvez dériver l'ID d'actif correspondant du cNFT. Lorsque vous utilisez Bubblegum, l'ID d'actif est une PDA dérivée en utilisant l'ID du programme Bubblegum et les seeds suivantes :

1. La chaîne statique `asset` représentée en encodage utf8
2. L'adresse de l'arbre de Merkle
3. L'index de la feuille

Essentiellement, l'indexeur observe les journaux d'instructions du programme Noop au fur et à mesure de leur apparition et stocke les métadonnées cNFT qui ont été hachées et stockées dans l'arbre de Merkle. Cela leur permet de faire surface à ces données lorsqu'elles sont demandées. Cet ID d'actif est ce que l'indexeur utilise pour identifier l'actif particulier.

Pour simplifier, vous pouvez simplement utiliser la fonction d'aide `getLeafAssetId` du SDK Bubblegum. Avec l'ID d'actif, récupérer le cNFT est assez simple. Utilisez simplement la méthode `getAsset` fournie par le fournisseur RPC pris en charge :

```tsx
const assetId = await getLeafAssetId(treeAddress, new BN(leafIndex))
const response = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
		params: {
			id: assetId,
		},
	}),
})

const { result } = await response.json()
console.log(JSON.stringify(result, null, 2))
```

Cela renverra un objet JSON qui est complet de ce à quoi ressembleraient les métadonnées d'un NFT traditionnel à la fois sur et hors chaîne. Par exemple, vous pouvez trouver les attributs cNFT à `content.metadata.attributes` ou l'image à `content.files.uri`.

### Requête cNFT

L'API de lecture comprend également des moyens d'obtenir plusieurs actifs, de faire des requêtes par propriétaire, créateur, et plus encore. Par exemple, Helius prend en charge les méthodes suivantes :

- `getAsset`
- `getSignaturesForAsset`
- `searchAssets`
- `getAssetProof`
- `getAssetsByOwner`
- `getAssetsByAuthority`
- `getAssetsByCreator`
- `getAssetsByGroup`

Nous n'aborderons pas directement la plupart de ces méthodes, mais assurez-vous de consulter la [documentation Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) pour apprendre comment les utiliser correctement.

### Transfert cNFT

Tout comme avec un transfert standard de jeton SPL, la sécurité est primordiale. Cependant, un transfert de jeton SPL facilite grandement la vérification de l'autorité de transfert. Cela est intégré dans le programme SPL Token et la signature standard. La propriété d'un jeton compressé est plus difficile à vérifier. La vérification réelle se fera du côté du programme, mais votre code côté client doit fournir des informations supplémentaires pour le rendre possible.

Bien qu'il existe une fonction d'aide `createTransferInstruction` dans Bubblegum, un peu plus d'assemblage est nécessaire que d'habitude. En particulier, le programme Bubblegum doit vérifier que l'intégralité des données du cNFT est conforme à ce que le client affirme avant qu'un transfert puisse avoir lieu. L'intégralité des données du cNFT a été hashée et stockée comme une seule feuille sur l'arbre de Merkle, et l'arbre de Merkle est simplement un hachage de toutes les feuilles et branches de l'arbre. En raison de cela, vous ne pouvez pas simplement dire au programme quel compte examiner et lui faire comparer le champ `authority` ou `owner` de ce compte avec le signataire de la transaction.

Au lieu de cela, vous devez fournir l'intégralité des données du cNFT et toutes les informations de preuve de l'arbre de Merkle qui ne sont pas stockées dans la canopée. De cette manière, le programme peut prouver indépendamment que les données du cNFT fournies, et donc le propriétaire du cNFT, sont exactes. Ce n'est qu'alors que le programme peut déterminer en toute sécurité si le signataire de la transaction doit effectivement être autorisé à transférer le cNFT.

En termes généraux, cela implique un processus en cinq étapes :

1. Récupérez les données de l'actif cNFT de l'indexeur
2. Récupérez la preuve du cNFT de l'indexeur
3. Récupérez le compte de l'arbre de Merkle depuis la blockchain Solana
4. Préparez la preuve de l'actif sous forme d'une liste d'objets `AccountMeta`
5. Construisez et envoyez l'instruction de transfert Bubblegum

Les deux premières étapes sont très similaires. En utilisant votre fournisseur RPC de support, utilisez les méthodes `getAsset` et `getAssetProof` pour récupérer les données de l'actif et la preuve, respectivement.

```tsx
const assetDataResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
			params: {
				id: assetId,
			},
		}),
	})
const assetData = (await assetDataResponse.json()).result

const assetProofResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAssetProof",
			params: {
				id: assetId,
			},
		}),
	})
const assetProof = (await assetProofResponse.json()).result
```

La troisième étape consiste à récupérer le compte de l'arbre de Merkle. La manière la plus simple de le faire est d'utiliser le type `ConcurrentMerkleTreeAccount` de `@solana/spl-account-compression` :

```tsx
const treePublicKey = new PublicKey(assetData.compression.tree)

const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
	connection,
	treePublicKey
)
```

L'étape quatre est l'étape conceptuellement la plus difficile. En utilisant les trois morceaux d'informations collectées, vous devrez assembler le chemin de preuve pour la feuille correspondante du cNFT. Le chemin de preuve est représenté sous forme de comptes transmis à l'instruction du programme. Le programme utilise chacune des adresses de compte comme nœuds de preuve pour prouver que les données de la feuille sont ce que vous dites qu'elles sont.

La preuve complète est fournie par l'indexeur comme indiqué ci-dessus dans `assetProof`. Cependant, vous pouvez exclure le même nombre de comptes de fin de queue de la preuve que la profondeur de la canopée.

```tsx
const canopyDepth = treeAccount.getCanopyDepth() || 0

const proofPath: AccountMeta[] = assetProof.proof
	.map((node: string) => ({
	pubkey: new PublicKey(node),
	isSigner: false,
	isWritable: false
}))
.slice(0, assetProof.proof.length - canopyDepth)
```

Enfin, vous pouvez assembler l'instruction de transfert. La fonction d'aide à l'instruction, `createTransferInstruction`, nécessite les arguments suivants :

- `accounts` - une liste de comptes d'instruction, tels qu'attendu ; ils sont les suivants :
    - `merkleTree` - le compte de l'arbre de Merkle
    - `treeAuthority` - l'autorité de l'arbre de Merkle
    - `leafOwner` - le propriétaire de la feuille (cNFT) en question
    - `leafDelegate` - le délégué de la feuille (cNFT) en question ; si aucun délégué n'a été ajouté, cela devrait être le même que `leafOwner`
    - `newLeafOwner` - l'adresse du nouveau propriétaire après le transfert
    - `logWrapper` - le programme à utiliser pour exposer les données aux indexeurs via les journaux ; cela devrait être l'adresse du programme SPL Noop à moins que vous n'ayez une autre implémentation personnalisée
    - `compressionProgram` - le programme de compression à utiliser ; cela devrait être l'adresse du programme SPL State Compression à moins que vous n'ayez une autre implémentation personnalisée
    - `anchorRemainingAccounts` - c'est ici que vous ajoutez le chemin de preuve
- `args` - arguments supplémentaires requis par l'instruction ; ils sont les suivants :
    - `root` - le nœud racine de l'arbre de Merkle à partir de la preuve de l'actif ; cela est fourni par l'indexeur sous forme de chaîne et doit d'abord être converti en octets
    - `dataHash` - le hachage des données de l'actif récupérées auprès de l'indexeur ; cela est fourni par l'indexeur sous forme de chaîne et doit d'abord être converti en octets
    - `creatorHash` - le hachage du créateur du cNFT tel que récupéré auprès de l'indexeur ; cela est fourni par l'indexeur sous forme de chaîne et doit d'abord être converti en octets
    - `nonce` - utilisé pour garantir que aucune deux feuilles n'ont le même hachage ; cette valeur doit être la même que `index`
    - `index` - l'index où la feuille du cNFT est située sur l'arbre de Merkle

Un exemple de ceci est montré ci-dessous. Notez que les trois premières lignes de code récupèrent des informations supplémentaires nichées dans les objets montrés précédemment afin qu'elles soient prêtes à être utilisées lors de l'assemblage de l'instruction elle-même.

```tsx
const treeAuthority = treeAccount.getAuthority()
const leafOwner = new PublicKey(assetData.ownership.owner)
const leafDelegate = assetData.ownership.delegate
	? new PublicKey(assetData.ownership.delegate)
	: leafOwner

const transferIx = createTransferInstruction(
	{
		merkleTree: treePublicKey,
		treeAuthority,
		leafOwner,
		leafDelegate,
		newLeafOwner: receiver,
		logWrapper: SPL_NOOP_PROGRAM_ID,
		compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
		anchorRemainingAccounts: proofPath,
	},
	{
		root: [...new PublicKey(assetProof.root.trim()).toBytes()],
		dataHash: [...new PublicKey(assetData.compression.data_hash.trim()).toBytes()],
		creatorHash: [
			...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
		],
		nonce: assetData.compression.leaf_id,
		index: assetData.compression.leaf_id,
	}
)
```

## Conclusion

Nous avons couvert les compétences principales nécessaires pour interagir avec les cNFT, mais nous n'avons pas été totalement exhaustifs. Vous pouvez également utiliser Bubblegum pour des actions telles que la destruction, la vérification, la délégation, et plus encore. Nous n'allons pas passer en revue cela, mais ces instructions sont similaires au processus de création et de transfert. Si vous avez besoin de cette fonctionnalité supplémentaire, consultez le [code source client Bubblegum](https://github.com/metaplex-foundation/mpl-bubblegum/tree/main/clients/js-solita) et tirez parti des fonctions d'aide qu'il propose.

Gardez à l'esprit que la compression est assez récente. Les outils disponibles évolueront rapidement, mais les principes que vous avez appris dans cette leçon resteront probablement les mêmes. Ces principes peuvent également être élargis à la compression arbitraire d'état, alors assurez-vous de les maîtriser ici pour être prêt à aborder des choses plus amusantes dans les leçons futures !

# Laboratoire

Allons-y et pratiquons la création et la manipulation de cNFT. Ensemble, nous allons construire un script aussi simple que possible qui nous permettra de créer une collection de cNFT à partir d'un arbre de Merkle.

### 1. Obtenez le code de départ

Premièrement, clonez le code de départ de la branche `starter` de notre [répertoire de laboratoire cNFT](https://github.com/Unboxed-Software/solana-cnft-demo).

`git clone https://github.com/Unboxed-Software/solana-cnft-demo.git`

`cd solana-cnft-demo`

`npm install`

Prenez le temps de vous familiariser avec le code de départ fourni. Les fonctions d'aide les plus importantes sont fournies dans `utils.ts` et les URI dans `uri.ts`.

Le fichier `uri.ts` fournit 10k URI que vous pouvez utiliser pour la partie hors chaîne de vos métadonnées NFT. Vous pouvez bien sûr créer vos propres métadonnées. Mais cette leçon ne porte pas explicitement sur la préparation des métadonnées, nous vous en avons donc fourni.

Le fichier `utils.ts` a quelques fonctions d'aide pour éviter d'écrire plus de boilerplate que nécessaire. Elles sont les suivantes :

- `getOrCreateKeypair` créera une nouvelle paire de clés pour vous et la sauvegardera dans un fichier `.env`, ou s'il y a déjà une clé privée dans le fichier `.env`, elle initialisera une paire de clés à partir de celle-ci.
- `airdropSolIfNeeded` versera du SOL de Devnet à une adresse spécifiée si le solde de cette adresse est inférieur à 1 SOL.
- `createNftMetadata` créera les métadonnées NFT pour une clé publique de créateur et un index donnés. Les métadonnées qu'il récupère ne sont que des métadonnées fictives utilisant l'URI correspondant à l'index fourni dans la liste d'URIs de `uri.ts`.
- `getOrCreateCollectionNFT` récupérera le cNFT de la collection à partir de l'adresse spécifiée dans `.env` ou, s'il n'y en a pas, en créera un nouveau et ajoutera l'adresse à `.env`.

Enfin, il y a un boilerplate dans `index.ts` qui crée une nouvelle connexion Devnet, appelle `getOrCreateKeypair` pour initialiser un "portefeuille", et appelle `airdropSolIfNeeded` pour financer le portefeuille si son solde est faible.

Nous écrirons tout notre code dans `index.ts`.

### 2. Création du compte de l'arbre de Merkle

Nous commencerons par créer le compte de l'arbre de Merkle. Encapsulons cela dans une fonction qui créera *et* initialisera finalement le compte. Plaçons cette fonction en dessous de notre fonction `main` dans `index.ts`. Appelons-la `createAndInitializeTree`. Pour que cette fonction fonctionne, elle aura besoin des paramètres suivants :

- `connection` - une `Connection` à utiliser pour interagir avec le réseau.
- `payer` - une `Keypair` qui paiera les transactions.
- `maxDepthSizePair` - un `ValidDepthSizePair`. Ce type provient de `@solana/spl-account-compression`. Il s'agit d'un objet simple avec les propriétés `maxDepth` et `maxBufferSize` qui impose une combinaison valide des deux valeurs.
- `canopyDepth` - un nombre pour la profondeur de la canopée

Dans le corps de la fonction, nous allons générer une nouvelle adresse pour l'arbre, puis créer l'instruction d'allocation d'un nouveau compte d'arbre de Merkle en appelant `createAllocTreeIx` de `@solana/spl-account-compression`.

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
  const treeKeypair = Keypair.generate()

  const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )
}
```

### 3. Utiliser Bubblegum pour initialiser l'arbre de Merkle et créer le compte de configuration de l'arbre

Avec l'instruction pour créer l'arbre prête à être utilisée, nous pouvons créer une instruction pour invoquer `create_tree` sur le programme Bubblegum. Cela initialisera le compte de l'arbre de Merkle *et* créera un nouveau compte de configuration d'arbre sur le programme Bubblegum.

Cette instruction nécessite que nous fournissions les éléments suivants :

- `accounts` - un objet de comptes requis ; cela inclut :
    - `treeAuthority` - cela devrait être une PDA dérivée avec l'adresse de l'arbre de Merkle et le programme Bubblegum
    - `merkleTree` - l'adresse de l'arbre de Merkle
    - `payer` - le payeur des frais de transaction
    - `treeCreator` - l'adresse du créateur de l'arbre ; nous laisserons cela identique à `payer`
    - `logWrapper` - mettre à `SPL_NOOP_PROGRAM_ID`
    - `compressionProgram` - mettre à `SPL_ACCOUNT_COMPRESSION_PROGRAM_ID`
- `args` - une liste d'arguments d'instruction ; cela inclut :
    - `maxBufferSize` - la taille du tampon à partir du paramètre `maxDepthSizePair` de notre fonction
    - `maxDepth` - la profondeur maximale à partir du paramètre `maxDepthSizePair` de notre fonction
    - `public` - si l'arbre doit être public ou non ; nous allons le définir sur `false`

Enfin, nous pouvons ajouter les deux instructions à une transaction et soumettre la transaction. N'oubliez pas que la transaction doit être signée à la fois par le `payer` et le `treeKeypair`.

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
  const treeKeypair = Keypair.generate()

  const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

  const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
    [treeKeypair.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

  const createTreeIx = createCreateTreeInstruction(
    {
      treeAuthority,
      merkleTree: treeKeypair.publicKey,
      payer: payer.publicKey,
      treeCreator: payer.publicKey,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    },
    {
      maxBufferSize: maxDepthSizePair.maxBufferSize,
      maxDepth: maxDepthSizePair.maxDepth,
      public: false,
    }
  )

  const tx = new Transaction().add(allocTreeIx, createTreeIx)
  tx.feePayer = payer.publicKey

  try {
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [treeKeypair, payer],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )

    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)

    console.log("Tree Address:", treeKeypair.publicKey.toBase58())

    return treeKeypair.publicKey
  } catch (err: any) {
    console.error("\nFailed to create merkle tree:", err)
    throw err
  }
}
```

Si vous souhaitez tester ce que vous avez jusqu'à présent, n'hésitez pas à appeler `createAndInitializeTree` depuis `main` et à fournir de petites valeurs pour la profondeur maximale et la taille maximale du tampon.

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )
}
```

N'oubliez pas que le SOL Devnet est limité, donc si vous testez trop de fois, vous pourriez manquer de SOL Devnet avant d'arriver à la création. Pour tester, dans votre terminal, exécutez la commande suivante :

`npm run start`

### 4. Émettez des cNFT vers votre arbre

Croyez-le ou non, c'est tout ce dont vous aviez besoin de faire pour configurer votre arbre pour les cNFT compressés ! Maintenant, concentrons-nous sur l'émission.

Tout d'abord, déclarons une fonction appelée `mintCompressedNftToCollection`. Elle aura besoin des paramètres suivants :

- `connection` - une `Connection` à utiliser pour interagir avec le réseau.
- `payer` - une `Keypair` qui paiera les transactions.
- `treeAddress` - l'adresse de l'arbre de Merkle
- `collectionDetails` - les détails de la collection du type `CollectionDetails` de `utils.ts`
- `amount` - le nombre de cNFT à émettre

Le corps de cette fonction fera ce qui suit :

1. Dérivez l'autorité de l'arbre comme précédemment. Encore une fois, c'est une PDA dérivée de l'adresse de l'arbre de Merkle et du programme Bubblegum.
2. Dérivez le `bubblegumSigner`. Il s'agit d'une PDA dérivée de la chaîne `"collection_cpi"` et du programme Bubblegum et est essentiel pour émettre vers une collection.
3. Créez la métadonnée cNFT en appelant `createNftMetadata` depuis notre fichier `utils.ts`.
4. Créez l'instruction de création de la collection en appelant `createMintToCollectionV1Instruction` du SDK Bubblegum.
5. Construisez et envoyez une transaction avec l'instruction de création
6. Répétez les étapes 3-6 `amount` fois

La fonction `createMintToCollectionV1Instruction` prend deux arguments : `accounts` et `args`. Ce dernier est simplement la métadonnée NFT. Comme pour toutes les instructions complexes, le principal obstacle est de savoir quels comptes fournir. Examinons-les rapidement :

- `payer` - le compte qui paiera les frais de transaction, le loyer, etc.
- `merkleTree` - le compte de l'arbre de Merkle
- `treeAuthority` - l'autorité de l'arbre ; devrait être la même PDA que celle que vous avez dérivé précédemment
- `treeDelegate` - le délégué de l'arbre ; il s'agit généralement du même que le créateur de l'arbre
- `leafOwner` - le propriétaire souhaité du cNFT compressé à émettre
- `leafDelegate` - le délégué souhaité du cNFT compressé à émettre ; généralement le même que le propriétaire de la feuille
- `collectionAuthority` - l'autorité du cNFT de "collection"
- `collectionAuthorityRecordPda` - PDA facultative du registre d'autorité de collection ; généralement il n'y en a pas, auquel cas vous devriez mettre l'adresse du programme Bubblegum
- `collectionMint` - le compte de la monnaie du cNFT de "collection"
- `collectionMetadata` - le compte de métadonnées du cNFT de "collection"
- `editionAccount` - le compte de l'édition principale du cNFT de "collection"
- `compressionProgram` - le programme de compression à utiliser ; cela devrait être l'adresse du programme de compression d'état SPL à moins que vous n'ayez une autre implémentation personnalisée
- `logWrapper` - le programme à utiliser pour exposer les données aux indexeurs via les journaux ; cela devrait être l'adresse du programme SPL Noop à moins que vous n'ayez une autre implémentation personnalisée
- `bubblegumSigner` - une PDA utilisée par le programme Bubblegrum pour gérer la vérification de la collection
- `tokenMetadataProgram` - le programme de métadonnées de jeton qui a été utilisé pour le cNFT de "collection" ; c'est généralement toujours le programme de métadonnées de jeton Metaplex

En les rassemblant, voici à quoi cela ressemblera :

```tsx
async function mintCompressedNftToCollection(
  connection: Connection,
  payer: Keypair,
  treeAddress: PublicKey,
  collectionDetails: CollectionDetails,
  amount: number
) {
  // Dérivez l'autorité de l'arbre PDA (compte 'TreeConfig' pour le compte d'arbre)
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [treeAddress.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

  // Dérivez le signer bubblegum, utilisé par le programme Bubblegum pour gérer "la vérification de la collection"
  // Uniquement utilisé pour l'instruction `createMintToCollectionV1`
  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_cpi", "utf8")],
    BUBBLEGUM_PROGRAM_ID
  )

  for (let i = 0; i < amount; i++) {
    // Métadonnées cNFT compressées
    const compressedNFTMetadata = createNftMetadata(payer.publicKey, i)

    // Créez l'instruction pour "émettre" le cNFT compressé vers l'arbre
    const mintIx = createMintToCollectionV1Instruction(
      {
        payer: payer.publicKey, // Le compte qui paiera les frais de transaction
        merkleTree: treeAddress, // L'adresse du compte d'arbre
        treeAuthority, // L'autorité du compte d'arbre, devrait être une PDA dérivée de l'adresse du compte d'arbre
        treeDelegate: payer.publicKey, // Le délégué du compte d'arbre, devrait être le même que le créateur de l'arbre par défaut
        leafOwner: payer.publicKey, // Le propriétaire du cNFT compressé à émettre vers l'arbre
        leafDelegate: payer.publicKey, // Le délégué du cNFT compressé à émettre vers l'arbre
        collectionAuthority: payer.publicKey, // L'autorité du cNFT de "collection"
        collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID, // Doit être l'ID du programme Bubblegum
        collectionMint: collectionDetails.mint, // La monnaie du cNFT de "collection"
        collectionMetadata: collectionDetails.metadata, // La métadonnée du cNFT de "collection"
        editionAccount: collectionDetails.masterEditionAccount, // L'édition principale du cNFT de "collection"
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        bubblegumSigner,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      },
      {
        metadataArgs: Object.assign(compressedNFTMetadata, {
          collection: { key: collectionDetails.mint, verified: false },
        }),
      }
    )

    try {
      // Créez une nouvelle transaction et ajoutez l'instruction
      const tx = new Transaction().add(mintIx)

      // Définissez le payeur des frais pour la transaction
      tx.feePayer = payer.publicKey

      // Envoyez la transaction
      const txSignature = await sendAndConfirmTransaction(
        connection,
        tx,
        [payer],
        { commitment: "confirmed", skipPreflight: true }
      )

      console.log(
        `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
      )
    } catch (err) {
      console.error("\nÉchec de l'émission du cNFT compressé :", err)
      throw err
    }
  }
}
```

C'est un excellent point pour tester avec un petit arbre. Mettez simplement à jour `main` pour appeler `getOrCreateCollectionNFT` puis `mintCompressedNftToCollection` :

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )
}
```

Encore une fois, pour exécuter, dans votre terminal, tapez : `npm run start`

### 5. Lecture des données cNFT existantes

Maintenant que nous avons écrit du code pour créer des cNFT, voyons si nous pouvons effectivement récupérer leurs données. C'est délicat car les données onchain sont simplement le compte de l'arbre de Merkle, les données duquel peuvent être utilisées pour vérifier que les informations existantes sont précises, mais elles ne transmettent pas les informations elles-mêmes.

Commençons par déclarer une fonction `logNftDetails` qui prend comme paramètres `treeAddress` et `nftsMinted`.

À ce stade, nous n'avons pas réellement un identifiant direct d'aucune sorte qui pointe vers notre cNFT. Pour l'obtenir, nous devrons connaître l'index de feuille qui a été utilisé lorsque nous avons créé notre cNFT. Nous pouvons ensuite utiliser cela pour déduire l'ID d'actif utilisé par l'API de lecture, puis utiliser l'API de lecture pour récupérer les données de notre cNFT.

Dans notre cas, nous avons créé un arbre non public et émis 8 cNFT, donc nous savons que les index de feuille utilisés étaient de 0 à 7. Avec cela, nous pouvons utiliser la fonction `getLeafAssetId` de `@metaplex-foundation/mpl-bubblegum` pour obtenir l'ID d'actif.

Enfin, nous pouvons utiliser une RPC qui prend en charge l'[API de lecture](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) pour récupérer l'actif. Nous utiliserons [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api), mais n'hésitez pas à choisir votre propre fournisseur RPC. Pour utiliser Helius, vous devrez obtenir une clé API gratuite sur [leur site Web](https://dev.helius.xyz/). Ensuite, ajoutez votre `RPC_URL` à votre fichier `.env`. Par exemple:

```bash
# Ajoutez ceci
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

Ensuite, émettez simplement une requête POST à l'URL RPC fournie et placez les informations `getAsset` dans le corps:

```tsx
async function logNftDetails(treeAddress: PublicKey, nftsMinted: number) {
  for (let i = 0; i < nftsMinted; i++) {
    const assetId = await getLeafAssetId(treeAddress, new BN(i))
    console.log("Asset ID:", assetId.toBase58())
    const response = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const { result } = await response.json()
    console.log(JSON.stringify(result, null, 2))
  }
}
```

Helius observe essentiellement les journaux de transactions au fur et à mesure qu'ils se produisent et stocke les métadonnées NFT qui ont été hachées et stockées dans l'arbre de Merkle. Cela leur permet de présenter ces données lorsqu'elles sont demandées.

Si nous ajoutons un appel à cette fonction à la fin de `main` et que nous relançons votre script, les données que nous obtenons dans la console sont très complètes. Cela inclut toutes les données que vous attendriez à la fois dans la partie onchain et hors chaîne d'un NFT traditionnel. Vous pouvez trouver les attributs, fichiers, informations sur la propriété et le créateur du cNFT, et bien plus encore.

```json
{
  "interface": "V1_NFT",
  "id": "48Bw561h1fGFK4JGPXnmksHp2fpniEL7hefEc6uLZPWN",
  "content": {
    "$schema": "https://schema.metaplex.com/nft1.0.json",
    "json_uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.json",
    "files": [
      {
        "uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "cdn_uri": "https://cdn.helius-rpc.com/cdn-cgi/image//https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "mime": "image/png"
      }
    ],
    "metadata": {
      "attributes": [
        {
          "value": "183",
          "trait_type": "R"
        },
        {
          "value": "89",
          "trait_type": "G"
        },
        {
          "value": "78",
          "trait_type": "B"
        }
      ],
      "description": "Random RGB Color",
      "name": "CNFT",
      "symbol": "CNFT"
    },
    "links": {
      "image": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png"
    }
  },
  "authorities": [
    {
      "address": "DeogHav5T2UV1zf5XuH4DTwwE5fZZt7Z4evytUUtDtHd",
      "scopes": [
        "full"
      ]
    }
  ],
  "compression": {
    "eligible": false,
    "compressed": true,
    "data_hash": "3RsXHMBDpUPojPLZuMyKgZ1kbhW81YSY3PYmPZhbAx8K",
    "creator_hash": "Di6ufEixhht76sxutC9528H7PaWuPz9hqTaCiQxoFdr",
    "asset_hash": "2TwWjQPdGc5oVripPRCazGBpAyC5Ar1cia8YKUERDepE",
    "tree": "7Ge8nhDv2FcmnpyfvuWPnawxquS6gSidum38oq91Q7vE",
    "seq": 8,
    "leaf_id": 7
  },
  "grouping": [
    {
      "group_key": "collection",
      "group_value": "9p2RqBUAadMznAFiBEawMJnKR9EkFV98wKgwAz8nxLmj"
    }
  ],
  "royalty": {
    "royalty_model": "creators",
    "target": null,
    "percent": 0,
    "basis_points": 0,
    "primary_sale_happened": false,
    "locked": false
  },
  "creators": [
    {
      "address": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR",
      "share": 100,
      "verified": false
    }
  ],
  "ownership": {
    "frozen": false,
    "delegated": false,
    "delegate": null,
    "ownership_model": "single",
    "owner": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR"
  },
  "supply": {
    "print_max_supply": 0,
    "print_current_supply": 0,
    "edition_nonce": 0
  },
  "mutable": false,
  "burnt": false
}
```

N'oubliez pas, l'API de lecture inclut également des moyens d'obtenir plusieurs actifs, de faire des requêtes par propriétaire, créateur, etc., et plus encore. Assurez-vous de parcourir les [docs Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) pour voir ce qui est disponible.

### 6. Transférer un cNFT

La dernière chose que nous allons ajouter à notre script est un transfert de cNFT. Tout comme avec un transfert standard de jeton SPL, la sécurité est primordiale. Contrairement à un transfert standard de jeton SPL, cependant, pour construire un transfert sécurisé avec une compression d'état de quelque nature que ce soit, le programme effectuant le transfert a besoin de l'ensemble des données d'actif.

Le programme, Bubblegum dans ce cas, doit être fourni avec l'ensemble des données qui ont été hachées et stockées sur la feuille correspondante *et* doit être donné le "chemin de preuve" pour la feuille en question. Cela rend les transferts de cNFT un peu plus délicats que les transferts de jetons SPL.

N'oubliez pas, les étapes générales sont les suivantes :

1. Récupérer les données d'actif du cNFT depuis l'indexeur
2. Récupérer la preuve du cNFT depuis l'indexeur
3. Récupérer le compte de l'arbre de Merkle depuis la blockchain Solana
4. Préparer la preuve d'actif sous forme de liste d'objets `AccountMeta`
5. Construire et envoyer l'instruction de transfert Bubblegum

Commençons par déclarer une fonction `transferNft` qui prend les éléments suivants :

- `connection` - un objet `Connection`
- `assetId` - un objet `PublicKey`
- `sender` - un objet `Keypair` afin que nous puissions signer la transaction
- `receiver` - un objet `PublicKey` représentant le nouveau propriétaire

Dans cette fonction, récupérons à nouveau les données d'actif, puis récupérons également la preuve d'actif. Pour plus de sûreté, enveloppons tout dans un bloc `try catch`.

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result
	} catch (err: any) {
    console.error("\nÉchec du transfert du cNFT :", err)
    throw err
	}
}
```

Ensuite, récupérons le compte de l'arbre de Merkle depuis la chaîne, obtenons la profondeur de la canopée, et assemblons le chemin de preuve. Nous le faisons en mappant la preuve d'actif que nous avons obtenue de Helius sur une liste d'objets `AccountMeta`, puis en supprimant tout nœud de preuve à la fin qui est déjà mis en cache onchain dans la canopée.

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    ...

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)
  } catch (err: any) {
    console.error("\nÉchec du transfert du cNFT :", err)
    throw err
  }
}
```

Enfin, construisons l'instruction en utilisant `createTransferInstruction`, ajoutons-la à une transaction, puis signons et envoyons la transaction. Voici à quoi ressemble la fonction `transferNft` complète une fois terminée :
```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)

    const treeAuthority = treeAccount.getAuthority()
    const leafOwner = new PublicKey(assetData.ownership.owner)
    const leafDelegate = assetData.ownership.delegate
      ? new PublicKey(assetData.ownership.delegate)
      : leafOwner

    const transferIx = createTransferInstruction(
      {
        merkleTree: treePublicKey,
        treeAuthority,
        leafOwner,
        leafDelegate,
        newLeafOwner: receiver,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        anchorRemainingAccounts: proofPath,
      },
      {
        root: [...new PublicKey(assetProof.root.trim()).toBytes()],
        dataHash: [
          ...new PublicKey(assetData.compression.data_hash.trim()).toBytes(),
        ],
        creatorHash: [
          ...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
        ],
        nonce: assetData.compression.leaf_id,
        index: assetData.compression.leaf_id,
      }
    )

    const tx = new Transaction().add(transferIx)
    tx.feePayer = sender.publicKey
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [sender],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)
  } catch (err: any) {
    console.error("\nÉchec du transfert de CNFT :", err)
    throw err
  }
}
```

Transférons notre premier NFT compressé à l'index 0 à quelqu'un d'autre. D'abord, nous aurons besoin de créer un autre portefeuille avec quelques fonds, et ensuite récupérer l'assetID à l'index 0 en utilisant `getLeafAssetId`. Puis, nous effectuerons le transfert. Enfin, nous afficherons la collection entière en utilisant notre fonction `logNftDetails`. Vous noterez que le NFT à l'index 0 appartient maintenant à notre nouveau portefeuille dans le champ `ownership`.

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )

  const recieverWallet = await getOrCreateKeypair("Wallet_2")
  const assetId = await getLeafAssetId(treeAddress, new BN(0))
  await airdropSolIfNeeded(recieverWallet.publicKey)

  console.log(`Transfering ${assetId.toString()} from ${wallet.publicKey.toString()} to ${recieverWallet.publicKey.toString()}`)

  await transferNft(
    connection,
    assetId,
    wallet,
    recieverWallet.publicKey
  )

  await logNftDetails(treeAddress, 8)
}
```

Exécutez le script. L'ensemble du processus devrait s'exécuter sans échec, et le coût devrait être proche de 0.01 SOL !

Félicitations ! Vous savez maintenant comment créer, lire et transférer des cNFT. Si vous le souhaitez, vous pouvez mettre à jour la profondeur maximale, la taille maximale du tampon et la profondeur de la canopée avec des valeurs plus grandes, et tant que vous disposez de suffisamment de SOL Devnet, ce script vous permettra de créer jusqu'à 10 000 cNFT pour une fraction de ce que cela coûterait pour créer 10 000 NFT traditionnels (Remarque : si vous prévoyez de créer un grand nombre de NFT, vous voudrez peut-être essayer de regrouper ces instructions pour un nombre total de transactions moins élevé).

Si vous avez besoin de plus de temps avec ce laboratoire, n'hésitez pas à le parcourir à nouveau et/ou à consulter le code de solution sur la branche `solution` du [dépôt du laboratoire](https://github.com/Unboxed-Software/solana-cnft-demo/tree/solution).

## Défi

C'est à vous de jouer avec ces concepts ! Nous ne serons pas trop prescriptifs à ce stade, mais voici quelques idées :

1. Créez votre propre collection cNFT en production.
2. Construisez une interface utilisateur pour le laboratoire de cette leçon qui vous permettra de créer un cNFT et de l'afficher.
3. Voyez si vous pouvez reproduire une partie de la fonctionnalité du script du laboratoire dans un programme onchain, c'est-à-dire écrivez un programme qui peut créer des cNFT.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=db156789-2400-4972-904f-40375582384a) !

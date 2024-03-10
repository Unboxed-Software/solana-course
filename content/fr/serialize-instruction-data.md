---
title: Sérialiser des données d'instruction personnalisées
objectives:
- Expliquer le contenu d'une transaction
- Expliquer les instructions de transaction
- Expliquer les bases des optimisations du runtime de Solana
- Expliquer Borsh
- Utiliser Borsh pour sérialiser les données du programme
---

# Résumé

- Les transactions sont composées d'un tableau d'instructions. Une transaction unique peut contenir un nombre quelconque d'instructions, chacune ciblant son propre programme. Lorsqu'une transaction est soumise, le runtime de Solana traitera ses instructions dans l'ordre et de manière atomique, ce qui signifie que si l'une des instructions échoue pour une raison quelconque, l'ensemble de la transaction échouera à être traitée.
- Chaque *instruction* est composée de 3 composants : l'ID du programme prévu, un tableau de tous les comptes impliqués, et un tampon d'octets de données d'instruction.
- Chaque *transaction* contient : un tableau de tous les comptes qu'elle prévoit de lire ou d'écrire, une ou plusieurs instructions, un hachage de bloc récent, et une ou plusieurs signatures.
- Afin de transmettre les données d'instruction d'un client, elles doivent être sérialisées dans un tampon d'octets. Pour faciliter ce processus de sérialisation, nous utiliserons [Borsh](https://borsh.io/).
- Les transactions peuvent échouer à être traitées par la blockchain pour un certain nombre de raisons, nous discuterons ici de certaines des plus courantes.

# Aperçu général

## Transactions

Les transactions sont la manière dont nous envoyons des informations à la blockchain pour qu'elles soient traitées. Jusqu'à présent, nous avons appris à créer des transactions très basiques avec une fonctionnalité limitée. Mais les transactions, et les programmes auxquels elles sont envoyées, peuvent être conçus pour être beaucoup plus flexibles et gérer beaucoup plus de complexité que ce que nous avons traité jusqu'à présent.

### Contenu de la transaction

Chaque transaction contient :

- Un tableau qui inclut tous les comptes qu'elle prévoit de lire ou d'écrire
- Une ou plusieurs instructions
- Un hachage de bloc récent
- Une ou plusieurs signatures

`@solana/web3.js` simplifie ce processus pour vous afin que vous n'ayez vraiment besoin de vous concentrer que sur l'ajout d'instructions et de signatures. La bibliothèque construit le tableau de comptes en fonction de ces informations et gère la logique pour inclure un hachage de bloc récent.

## Instructions

Chaque instruction contient :

- L'ID du programme (clé publique) du programme prévu
- Un tableau listant tous les comptes qui seront lus ou écrits lors de l'exécution
- Un tampon d'octets de données d'instruction

Identifier le programme par sa clé publique garantit que l'instruction est exécutée par le programme correct.

Inclure un tableau de chaque compte qui sera lu ou écrit permet au réseau d'effectuer un certain nombre d'optimisations qui permettent une charge transactionnelle élevée et une exécution plus rapide.

Le tampon d'octets vous permet de transmettre des données externes à un programme.

Vous pouvez inclure plusieurs instructions dans une seule transaction. Le runtime de Solana traitera ces instructions dans l'ordre et de manière atomique. En d'autres termes, si chaque instruction réussit alors la transaction dans son ensemble sera réussie, mais si une seule instruction échoue alors la transaction entière échouera immédiatement sans effets secondaires.

Le tableau de comptes n'est pas seulement un tableau des clés publiques des comptes. Chaque objet du tableau comprend la clé publique du compte, qu'il soit ou non signataire de la transaction, et qu'il soit ou non modifiable. Inclure si un compte est modifiable pendant l'exécution d'une instruction permet au runtime de faciliter le traitement parallèle des contrats intelligents. Parce que vous devez définir quels comptes sont en lecture seule et lesquels vous écrirez, le runtime peut déterminer quelles transactions ne se chevauchent pas ou sont en lecture seule et leur permettre d'être exécutées de manière concurrente. Pour en savoir plus sur le runtime de Solana, consultez ce [billet de blog](https://solana.com/news/sealevel-\--parallel-processing-thousands-of-smart-contracts).

### Données d'instruction

La capacité d'ajouter des données arbitraires à une instruction garantit que les programmes peuvent être dynamiques et assez flexibles pour des cas d'utilisation larges de la même manière que le corps d'une requête HTTP vous permet de construire des API REST dynamiques et flexibles.

Tout comme la structure du corps d'une requête HTTP dépend de l'endpoint que vous avez l'intention d'appeler, la structure du tampon d'octets utilisé comme données d'instruction dépend entièrement du programme destinataire. Si vous construisez une application complète dApp de votre propre chef, vous devrez copier la même structure que celle que vous avez utilisée lors de la construction du programme vers le code côté client. Si vous travaillez avec un autre développeur qui gère le développement du programme, vous pouvez coordonner pour garantir des mises en page de tampon correspondantes.

Pensons à un exemple concret. Imaginez travailler sur un jeu Web3 et être responsable de l'écriture du code côté client qui interagit avec un programme d'inventaire de joueur. Le programme était conçu pour permettre au client de :

- Ajouter un inventaire basé sur les résultats de jeu d'un joueur
- Transférer un inventaire d'un joueur à un autre
- Équiper un joueur avec des éléments d'inventaire sélectionnés

Ce programme aurait été structuré de manière à ce que chacun de ces éléments soit encapsulé dans sa propre fonction.

Chaque programme, cependant, n'a qu'un seul point d'entrée. Vous indiqueriez au programme sur lequel de ces fonctions exécuter à travers les données d'instruction.

Vous incluriez également dans les données d'instruction toutes les informations dont la fonction a besoin pour s'exécuter correctement, par exemple un ID d'élément d'inventaire, un joueur auquel transférer l'inventaire, etc.

La *manière* exacte de structurer ces données dépendrait de la façon dont le programme a été écrit, mais il est courant que le premier champ dans les données d'instruction soit un nombre que le programme peut mapper à une fonction, après quoi des champs supplémentaires agissent comme des arguments de fonction.

## Sérialisation

En plus de savoir quelles informations inclure dans un tampon d'instruction, vous devez également le sérialiser correctement. Le sérialiseur le plus couramment utilisé dans Solana est [Borsh](https://borsh.io). Selon le site web :

> Borsh signifie Binary Object Representation Serializer for Hashing. Il est destiné à être utilisé dans des projets critiques en matière de sécurité car il privilégie la cohérence, la sécurité, la vitesse ; et est livré avec une spécification stricte.

Borsh maintient une [bibliothèque JS](https://github.com/near/borsh-js) qui gère la sérialisation des types courants dans un tampon. Il existe également d'autres packages construits au-dessus de borsh qui tentent de rendre ce processus encore plus facile. Nous utiliserons la bibliothèque `@coral-xyz/borsh` qui peut être installée en utilisant `npm`.

En se basant sur l'exemple d'inventaire de jeu précédent, regardons un scénario hypothétique où nous demandons au programme d'équiper un joueur avec un élément donné. Supposons que le programme est conçu pour accepter un tampon qui représente une structure avec les propriétés suivantes :

1. `variant` comme un entier non signé sur 8 bits qui indique au programme quelle instruction, ou fonction, exécuter.
2. `playerId` comme un entier non signé sur 16 bits qui représente l'ID du joueur qui doit être équipé de l'élément donné.
3. `itemId` comme un entier non signé sur 256 bits qui représente l'ID de l'élément qui sera équipé au joueur donné.

Tout cela sera transmis sous forme d'un tampon d'octets qui sera lu dans l'ordre, il est donc crucial de garantir l'ordre approprié de la mise en page du tampon :

```tsx
import * as borsh from '@coral-xyz/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])
```

Vous pouvez ensuite encoder des données en utilisant ce schéma avec la méthode `encode`. Cette méthode accepte en argument un objet représentant les données à sérialiser et un tampon. Dans l'exemple ci-dessous, nous allouons un nouveau tampon qui est beaucoup plus grand que nécessaire, puis nous encodons les données dans ce tampon et découpons le tampon original en un nouveau tampon qui n'est que de la taille nécessaire.

```tsx
import * as borsh from '@coral-xyz/borsh'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))
```

Une fois qu'un tampon est correctement créé et les données sérialisées, tout ce qui reste est de construire la transaction. C'est similaire à ce que vous avez fait dans les leçons précédentes. L'exemple ci-dessous suppose que :

- `player`, `playerInfoAccount` et `PROGRAM_ID` sont déjà définis quelque part en dehors de l'extrait de code
- `player` est la clé publique d'un utilisateur
- `playerInfoAccount` est la clé publique du compte où les modifications d'inventaire seront écrites
- `SystemProgram` sera utilisé dans le processus d'exécution de l'instruction.

```tsx
import * as borsh from '@coral-xyz/borsh'
import * as web3 from '@solana/web3.js'

const equipPlayerSchema = borsh.struct([
  borsh.u8('variant'),
  borsh.u16('playerId'),
  borsh.u256('itemId')
])

const buffer = Buffer.alloc(1000)
equipPlayerSchema.encode({ variant: 2, playerId: 1435, itemId: 737498 }, buffer)

const instructionBuffer = buffer.slice(0, equipPlayerSchema.getSpan(buffer))

const endpoint = web3.clusterApiUrl('devnet')
const connection = new web3.Connection(endpoint)

const transaction = new web3.Transaction()
const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: player.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: playerInfoAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    }
  ],
  data: instructionBuffer,
  programId: PROGRAM_ID
})

transaction.add(instruction)

web3.sendAndConfirmTransaction(connection, transaction, [player]).then((txid) => {
  console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
})
```

# Laboratoire

Pratiquons ensemble en construisant une application de critique de films qui permet aux utilisateurs de soumettre une critique de film et de l'enregistrer sur le réseau Solana. Nous allons construire cette application petit à petit au cours des prochaines leçons, en ajoutant de nouvelles fonctionnalités à chaque leçon.

![Interface frontend de critique de films](../assets/movie-reviews-frontend.png)

Voici un diagramme rapide du programme que nous allons construire :

![Solana stocke les éléments de données dans des ADP, qui peuvent être trouvés par leurs seeds](../assets/movie-review-program.svg)

La clé publique du programme Solana que nous utiliserons pour cette application est `CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN`.

### 1. Téléchargez le code de départ

Avant de commencer, téléchargez le [code de départ](https://github.com/Unboxed-Software/solana-movie-frontend/tree/starter).

Le projet est une application Next.js assez simple. Il inclut le `WalletContextProvider` que nous avons créé dans la leçon sur les portefeuilles, un composant `Card` pour afficher une critique de film, un composant `MovieList` qui affiche les critiques dans une liste, un composant `Form` pour soumettre une nouvelle critique, et un fichier `Movie.ts` qui contient une définition de classe pour un objet `Movie`.

Notez que pour l'instant, les films affichés sur la page lorsque vous exécutez `npm run dev` sont des simulations. Dans cette leçon, nous nous concentrerons sur l'ajout d'une nouvelle critique mais nous ne verrons pas réellement cette critique affichée. A la prochaine leçon, nous nous concentrerons sur la désérialisation des données personnalisées à partir de comptes en chaîne.

### 2. Créez la mise en page du tampon

N'oubliez pas que pour interagir correctement avec un programme Solana, vous devez savoir comment il s'attend à ce que les données soient structurées. Notre programme de critique de films s'attend à ce que les données d'instruction contiennent :

1. `variant`, un entier non signé sur 8 bits représentant l'instruction à exécuter (en d'autres termes, quelle fonction sur le programme doit être appelée).
2. `title`, une chaîne de caractères représentant le titre du film que vous critiquez.
3. `rating`, un entier non signé sur 8 bits représentant la note sur 5 que vous donnez au film que vous critiquez.
4. `description`, une chaîne de caractères représentant la partie écrite de la critique que vous laissez pour le film.

Configurons une mise en page `borsh` dans la classe `Movie`. Commencez par importer `@coral-xyz/borsh`. Ensuite, créez une propriété `borshInstructionSchema` et définissez-la sur la structure `borsh` appropriée contenant les propriétés énumérées ci-dessus :

```tsx
import * as borsh from '@coral-xyz/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])
}
```

Gardez à l'esprit que l'*ordre est important*. Si l'ordre des propriétés ici diffère de celui du programme, la transaction échouera.

### 3. Créez une méthode pour sérialiser les données

Maintenant que nous avons configuré la structure du tampon, créons une méthode dans `Movie` appelée `serialize()` qui renverra un `Buffer` avec les propriétés d'un objet `Movie` encodées dans la structure appropriée.

```tsx
import * as borsh from '@coral-xyz/borsh'

export class Movie {
  title: string;
  rating: number;
  description: string;

  ...

  borshInstructionSchema = borsh.struct([
    borsh.u8('variant'),
    borsh.str('title'),
    borsh.u8('rating'),
    borsh.str('description'),
  ])

  serialize(): Buffer {
    const buffer = Buffer.alloc(1000)
    this.borshInstructionSchema.encode({ ...this, variant: 0 }, buffer)
    return buffer.slice(0, this.borshInstructionSchema.getSpan(buffer))
  }
}
```

La méthode ci-dessus crée d'abord un tampon assez grand pour notre objet, puis encode `{ ...this, variant: 0 }` dans le tampon. Comme la définition de classe `Movie` contient 3 des 4 propriétés requises par la mise en page du tampon et utilise le même nommage, nous pouvons l'utiliser directement avec l'opérateur de propagation et ajouter simplement la propriété `variant`. Enfin, la méthode retourne un nouveau tampon qui laisse de côté la partie inutilisée de l'original.

### 4. Envoyer la transaction lorsque l'utilisateur soumet le formulaire

Maintenant que nous avons les blocs de construction pour les données d'instruction, nous pouvons créer et envoyer la transaction lorsque l'utilisateur soumet le formulaire. Ouvrez `Form.tsx` et localisez la fonction `handleTransactionSubmit`. Cette fonction est appelée par `handleSubmit` chaque fois qu'un utilisateur soumet le formulaire de critique de film.

À l'intérieur de cette fonction, nous allons créer et envoyer la transaction contenant les données soumises via le formulaire.

Commencez par importer `@solana/web3.js` et importer `useConnection` et `useWallet` de `@solana/wallet-adapter-react`.

```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
```

Ensuite, avant la fonction `handleSubmit`, appelez `useConnection()` pour obtenir un objet `connection` et appelez `useWallet()` pour obtenir `publicKey` et `sendTransaction`.

```tsx
import { FC } from 'react'
import { Movie } from '../models/Movie'
import { useState } from 'react'
import { Box, Button, FormControl, FormLabel, Input, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, Textarea } from '@chakra-ui/react'
import * as web3 from '@solana/web3.js'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'

const MOVIE_REVIEW_PROGRAM_ID = 'CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN'

export const Form: FC = () => {
  const [title, setTitle] = useState('')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const handleSubmit = (event: any) => {
    event.preventDefault()
    const movie = new Movie(title, rating, description)
    handleTransactionSubmit(movie)
  }

  ...
}
```

Avant de mettre en œuvre `handleTransactionSubmit`, parlons de ce qui doit être fait. Nous devons :

1. Vérifier que `publicKey` existe pour s'assurer que l'utilisateur a connecté son portefeuille.
2. Appeler `serialize()` sur `movie` pour obtenir un tampon représentant les données d'instruction.
3. Créer un nouvel objet `Transaction`.
4. Obtenir tous les comptes que la transaction lira ou écrira.
5. Créer un nouvel objet `Instruction` qui inclut tous ces comptes dans l'argument `keys`, inclut le tampon dans l'argument `data` et inclut la clé publique du programme dans l'argument `programId`.
6. Ajouter l'instruction de la dernière étape à la transaction.
7. Appeler `sendTransaction()` en lui passant la transaction.

C'est beaucoup d'informations à assimiler ! Mais ne vous inquiétez pas, cela devient plus facile à mesure que vous le faites. Commençons par les 3 premières étapes ci-dessus :

```tsx
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Veuillez connecter votre portefeuille !')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()
}
```

L'étape suivante consiste à obtenir tous les comptes que la transaction lira ou écrira. Dans les leçons précédentes, le compte où les données seront stockées vous a été donné. Cette fois, l'adresse du compte est plus dynamique, donc elle doit être calculée. Nous couvrirons cela en détail dans la prochaine leçon, mais pour l'instant, vous pouvez utiliser ce qui suit, où `pda` est l'adresse du compte où les données seront stockées :

```tsx
const [pda] = await web3.PublicKey.findProgramAddress(
  [publicKey.toBuffer(), Buffer.from(movie.title)],
  new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
)
```

En plus de ce compte, le programme devra également lire à partir de `SystemProgram`, donc notre tableau doit également inclure `web3.SystemProgram.programId`.

Avec cela, nous pouvons terminer les étapes restantes :

```tsx
const handleTransactionSubmit = async (movie: Movie) => {
  if (!publicKey) {
    alert('Veuillez connecter votre portefeuille !')
    return
  }

  const buffer = movie.serialize()
  const transaction = new web3.Transaction()

  const [pda] = await web3.PublicKey.findProgramAddress(
    [publicKey.toBuffer(), new TextEncoder().encode(movie.title)],
    new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  )

  const instruction = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }
    ],
    data: buffer,
    programId: new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID)
  })

  transaction.add(instruction)

  try {
    let txid = await sendTransaction(transaction, connection)
    console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
  } catch (e) {
    alert(JSON.stringify(e))
  }
}
```

Et voilà ! Vous devriez maintenant être en mesure d'utiliser le formulaire sur le site pour soumettre une critique de film. Bien que vous ne verrez pas l'interface utilisateur se mettre à jour pour refléter la nouvelle critique, vous pouvez consulter les journaux de programme de la transaction sur Solana Explorer pour voir qu'elle a réussi.

Si vous avez besoin d'un peu plus de temps avec ce projet pour vous sentir à l'aise, jetez un œil au [code de solution complet](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-serialize-instruction-data).

# Défi

Maintenant, c'est à vous de jouer pour construire quelque chose de manière indépendante. Créez une application qui permet aux étudiants de ce cours de se présenter ! Le programme Solana qui prend en charge cela est à `HdE95RSVsdb315jfJtaykXhXY478h53X6okDupVfY9yf`.

![Capture d'écran de l'interface utilisateur des introductions d'étudiants](../assets/student-intros-frontend.png)

1. Vous pouvez le construire à partir de zéro ou vous pouvez [télécharger le code de départ](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/starter).
2. Créez la mise en page du tampon d'instruction dans `StudentIntro.ts`. Le programme attend que les données d'instruction contiennent :
   1. `variant` comme un entier non signé sur 8 bits représentant l'instruction à exécuter (doit être 0).
   2. `name` comme une chaîne de caractères représentant le nom de l'étudiant.
   3. `message` comme une chaîne de caractères représentant le message que l'étudiant partage sur son parcours Solana.
3. Créez une méthode dans `StudentIntro.ts` qui utilisera la mise en page du tampon pour sérialiser un objet `StudentIntro`.
4. Dans le composant `Form`, implémentez la fonction `handleTransactionSubmit` afin qu'elle sérialise un `StudentIntro`, construise les instructions de transaction appropriées et soumette la transaction au portefeuille de l'utilisateur.
5. Vous devriez maintenant pouvoir soumettre des présentations et avoir les informations stockées sur la chaîne ! Assurez-vous de consigner l'ID de transaction et de l'examiner dans Solana Explorer pour vérifier que cela a fonctionné.

Si vous êtes vraiment bloqué, vous pouvez [consulter la solution](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data).

N'hésitez pas à être créatif avec ces défis et à les pousser encore plus loin. Les instructions ne sont pas là pour vous retenir !


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=6cb40094-3def-4b66-8a72-dd5f00298f61) !
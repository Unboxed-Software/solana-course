---
title: Introduction au développement côté client dans Anchor
objectives:
- Utiliser un IDL pour interagir avec un programme Solana depuis le client
- Expliquer un objet Anchor `Provider` 
- Expliquer un objet Anchor `Program`
- Utiliser le constructeur de méthodes Anchor pour construire des instructions et des transactions
- Utiliser Anchor pour récupérer des comptes
- Mettre en place un frontend pour invoquer des instructions à l'aide d'Anchor et d'un IDL
---

# Résumé

- Un **IDL** est un fichier représentant la structure d'un programme Solana. Les programmes écrits et construits à l'aide d'Anchor génèrent automatiquement un IDL correspondant. IDL signifie Interface Description Language.
- `@coral-xyz/anchor` est un client Typescript qui inclut tout ce dont vous avez besoin pour interagir avec des programmes Anchor.
- Un objet **Anchor `Provider`** combine une `connection` à un cluster et un `wallet` spécifié pour permettre la signature de transactions.
- Un objet **Anchor `Program`** fournit une API personnalisée pour interagir avec un programme spécifique. Vous créez une instance `Program` en utilisant l'IDL d'un programme et `Provider`.
- Le **constructeur de méthodes Anchor** fournit une interface simple via `Program` pour construire des instructions et des transactions.

# Aperçu général

Anchor simplifie le processus d'interaction avec les programmes Solana depuis le client en fournissant un fichier Interface Description Language (IDL) qui reflète la structure d'un programme. En utilisant l'IDL en conjonction avec la bibliothèque Typescript d'Anchor (`@coral-xyz/anchor`), vous disposez d'un format simplifié pour la construction d'instructions et de transactions.

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Cela fonctionne à partir de n'importe quel client Typescript, que ce soit un frontend ou des tests d'intégration. Dans cette leçon, nous verrons comment utiliser `@coral-xyz/anchor` pour simplifier votre interaction avec les programmes côté client.

## Structure Anchor côté client

Commençons par passer en revue la structure de base de la bibliothèque Typescript d'Anchor. L'objet principal que vous utiliserez est l'objet `Program`. Une instance `Program` représente un programme Solana spécifique et fournit une API personnalisée pour lire et écrire dans le programme.

Pour créer une instance de `Program`, vous aurez besoin des éléments suivants :

- IDL - le fichier représentant la structure d'un programme
- `Connection` - la connexion au cluster
- `Wallet` - la paire de clés par défaut utilisée pour payer et signer des transactions
- `Provider` - encapsule la `Connection` vers un cluster Solana et un `Wallet`
- `ProgramId` - l'adresse onchain du programme

![Structure Anchor](../assets/anchor-client-structure.png)

L'image ci-dessus montre comment ces éléments sont combinés pour créer une instance `Program`. Nous examinerons chacun d'eux individuellement pour avoir une meilleure idée de comment tout s'articule.

### Interface Description Language (IDL)

Lorsque vous construisez un programme Anchor, Anchor génère à la fois un fichier JSON et Typescript représentant l'IDL de votre programme. L'IDL représente la structure du programme et peut être utilisé par un client pour déduire comment interagir avec un programme spécifique.

Bien que ce ne soit pas automatique, vous pouvez également générer un IDL à partir d'un programme Solana natif en utilisant des outils comme [shank](https://github.com/metaplex-foundation/shank) par Metaplex.

Pour avoir une idée des informations qu'un IDL fournit, voici l'IDL pour le programme de compteur que vous avez précédemment construit :

```json
{
  "version": "0.1.0",
  "name": "counter",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": true },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "increment",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": false, "isSigner": true }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Counter",
      "type": {
        "kind": "struct",
        "fields": [{ "name": "count", "type": "u64" }]
      }
    }
  ]
}
```

En inspectant l'IDL, vous pouvez voir que ce programme contient deux instructions (`initialize` et `increment`).

Notez qu'en plus de spécifier les instructions, il spécifie les comptes et les entrées pour chaque instruction. L'instruction `initialize` nécessite trois comptes :

1. `counter` - le nouveau compte initialisé dans l'instruction
2. `user` - le payeur pour la transaction et l'initialisation
3. `systemProgram` - le programme système est invoqué pour initialiser un nouveau compte

Et l'instruction `increment` nécessite deux comptes :

1. `counter` - un compte existant pour incrémenter le champ count
2. `user` - le payeur de la transaction

En regardant l'IDL, vous pouvez voir que dans les deux instructions, l'utilisateur est requis en tant que signataire car le drapeau `isSigner` est marqué comme `true`. De plus, aucune des instructions ne nécessite de données d'instruction supplémentaires puisque la section `args` est vide pour les deux.

En regardant plus bas dans la section `accounts`, vous pouvez voir que le programme contient un type de compte nommé `Counter` avec un seul champ `count` de type `u64`.

Bien que l'IDL ne fournisse pas les détails d'implémentation pour chaque instruction, nous pouvons avoir une idée de base de la manière dont le programme onchain attend que les instructions soient construites et voir la structure des comptes du programme.

Quel que soit le moyen utilisé, vous *avez besoin* d'un fichier IDL pour interagir avec un programme en utilisant le package `@coral-xyz/anchor`. Pour utiliser l'IDL, vous devrez inclure le fichier IDL dans votre projet, puis l'importer.

```tsx
import idl from "./idl.json"
```

### Provider

Avant de pouvoir créer un objet `Program` en utilisant l'IDL, vous devez d'abord créer un objet `Provider` Anchor.

L'objet `Provider` combine deux choses :

- `Connection` - la connexion à un cluster Solana (c'est-à-dire localhost, devnet, mainnet)
- `Wallet` - une adresse spécifiée utilisée pour payer et signer des transactions

Le `Provider` est alors capable d'envoyer des transactions à la blockchain Solana au nom d'un `Wallet` en incluant la signature du portefeuille dans les transactions sortantes. Lorsque vous utilisez un frontend avec un fournisseur de portefeuille Solana, toutes les transactions sortantes doivent encore être approuvées par l'utilisateur via son extension de navigateur de portefeuille.

Pour configurer le `Wallet` et la `Connection`, cela ressemblerait à quelque chose comme ceci :

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

Pour configurer la connexion, vous pouvez utiliser le hook `useConnection` de `@solana/wallet-adapter-react` pour obtenir la `Connection` vers un cluster Solana.

Notez que l'objet `Wallet` fourni par le hook `useWallet` de `@solana/wallet-adapter-react` n'est pas compatible avec l'objet `Wallet` attendu par le `Provider` Anchor. Cependant, `@solana/wallet-adapter-react` fournit également un hook `useAnchorWallet`.

Pour comparaison, voici l'`AnchorWallet` de `useAnchorWallet` :

```tsx
export interface AnchorWallet {
  publicKey: PublicKey
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
}
```

Et le `WalletContextState` de `useWallet` :

```tsx
export interface WalletContextState {
  autoConnect: boolean
  wallets: Wallet[]
  wallet: Wallet | null
  publicKey: PublicKey | null
  connecting: boolean
  connected: boolean
  disconnecting: boolean
  select(walletName: WalletName): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ): Promise<TransactionSignature>
  signTransaction: SignerWalletAdapterProps["signTransaction"] | undefined
  signAllTransactions:
    | SignerWalletAdapterProps["signAllTransactions"]
    | undefined
  signMessage: MessageSignerWalletAdapterProps["signMessage"] | undefined
}
```

Le `WalletContextState` fournit beaucoup plus de fonctionnalités par rapport à l'`AnchorWallet`, mais l'`AnchorWallet` est requis pour configurer l'objet `Provider`.

Pour créer l'objet `Provider`, vous utilisez `AnchorProvider` de `@coral-xyz/anchor`.

Le constructeur `AnchorProvider` prend trois paramètres :

- `connection` - la `Connection` vers le cluster Solana
- `wallet` - l'objet `Wallet`
- `opts` - paramètre facultatif qui spécifie les options de confirmation, en utilisant un paramètre par défaut s'il n'est pas fourni

Une fois que vous avez créé l'objet `Provider`, vous le définissez ensuite comme le fournisseur par défaut en utilisant `setProvider`.

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### Program

Une fois que vous avez l'IDL et un fournisseur, vous pouvez créer une instance de `Program`. Le constructeur nécessite trois paramètres :

- `idl` - l'IDL en tant que type `Idl`
- `programId` - l'adresse onchain du programme en tant que `string` ou `PublicKey`
- `Provider` - le fournisseur discuté dans la section précédente

L'objet `Program` crée une API personnalisée que vous pouvez utiliser pour interagir avec un programme Solana. Cette API est le guichet unique pour tout ce qui concerne la communication avec les programmes onchain. Entre autres choses, vous pouvez envoyer des transactions, récupérer des comptes désérialisés, décoder des données d'instruction, vous abonner aux changements de compte et écouter des événements. Vous pouvez également [en savoir plus sur la classe `Program`](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor).

Pour créer l'objet `Program`, importez d'abord `Program` et `Idl` de `@coral-xyz/anchor`. `Idl` est un type que vous pouvez utiliser avec Typescript.

Ensuite, spécifiez le `programId` du programme. Nous devons spécifier explicitement le `programId` car il peut y avoir plusieurs programmes avec la même structure IDL (c'est-à-dire si le même programme est déployé plusieurs fois en utilisant différentes adresses). Lors de la création de l'objet `Program`, le `Provider` par défaut est utilisé s'il n'est pas spécifié explicitement.

Dans l'ensemble, la configuration finale ressemble à ceci :

```tsx
import idl from "./idl.json"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()

const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("JPLockxtkngHkaQT5AuRYow3HyUv5qWzmhwsCPd653n")
const program = new Program(idl as Idl, programId)
```

## Anchor `MethodsBuilder`

Une fois que l'objet `Program` est configuré, vous pouvez utiliser le constructeur de méthodes Anchor pour construire des instructions et des transactions liées au programme. Le `MethodsBuilder` utilise l'IDL pour fournir un format simplifié pour la construction de transactions qui invoquent des instructions de programme.

Notez que la convention de nommage en camel case est utilisée lors de l'interaction avec un programme depuis le client, par rapport à la convention de nommage en snake case utilisée lors de l'écriture du programme en rust.

Le format de base du `MethodsBuilder` ressemble à ceci :

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

En procédant étape par étape, vous :

1. Appelez `methods` sur `program` - c'est l'API du constructeur pour créer des appels d'instructions liées à l'IDL du programme
2. Appelez le nom de l'instruction comme `.instructionName(instructionDataInputs)` - appelez simplement l'instruction en utilisant la syntaxe point et le nom de l'instruction, en passant éventuellement les arguments de l'instruction sous forme de valeurs séparées par des virgules
3. Appelez `accounts` - en utilisant la syntaxe point, appelez `.accounts`, en passant un objet avec chaque compte attendu par l'instruction en fonction de l'IDL
4. Appelez éventuellement `signers` - en utilisant la syntaxe point, appelez `.signers`, en passant un tableau de signataires supplémentaires requis par l'instruction
5. Appelez `rpc` - cette méthode crée et envoie une transaction signée avec l'instruction spécifiée et renvoie une `TransactionSignature`. Lorsque vous utilisez `.rpc`, le `Wallet` du `Provider` est automatiquement inclus en tant que signataire et n'a pas à être répertorié explicitement.

Notez que si aucun signataire supplémentaire n'est requis par l'instruction autre que le `Wallet` spécifié avec le `Provider`, la ligne `.signers([])` peut être exclue.

Vous pouvez également construire la transaction directement en changeant `.rpc()` en `.transaction()`. Cela construit un objet `Transaction` en utilisant l'instruction spécifiée.

```tsx
// crée une transaction
const transaction = await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .transaction()

await sendTransaction(transaction, connection)
```

De même, vous pouvez utiliser le même format pour construire une instruction en utilisant `.instruction()` et ensuite ajouter manuellement les instructions à une nouvelle transaction. Cela construit un objet `TransactionInstruction` en utilisant l'instruction spécifiée.

```tsx
// crée la première instruction
const instructionOne = await program.methods
  .instructionOneName(instructionOneDataInputs)
  .accounts({})
  .instruction()

// crée la deuxième instruction
const instructionTwo = await program.methods
  .instructionTwoName(instructionTwoDataInputs)
  .accounts({})
  .instruction()

// ajoute les deux instructions à une transaction
const transaction = new Transaction().add(instructionOne, instructionTwo)

// envoie la transaction
await sendTransaction(transaction, connection)
```

En résumé, le constructeur de méthodes Anchor fournit une manière simplifiée et plus flexible d'interagir avec des programmes onchain. Vous pouvez construire une instruction, une transaction, ou construire et envoyer une transaction en utilisant essentiellement le même format sans avoir à sérialiser ou désérialiser manuellement les comptes ou les données d'instruction.

## Récupérer les comptes du programme

L'objet `Program` vous permet également de récupérer et de filtrer facilement les comptes du programme. Il suffit d'appeler `account` sur `program` et ensuite de spécifier le nom du type de compte tel qu'il est reflété dans l'IDL. Anchor désérialise alors et renvoie tous les comptes comme spécifié.

L'exemple ci-dessous montre comment vous pouvez récupérer tous les comptes existants de type `counter` pour le programme Counter.

```tsx
const accounts = await program.account.counter.all()
```

Vous pouvez également appliquer un filtre en utilisant `memcmp` puis en spécifiant un `offset` et les `bytes` à filtrer.

L'exemple ci-dessous récupère tous les comptes `counter` avec un `count` de 0. Notez que l'`offset` de 8 est pour le discriminant de 8 octets qu'Anchor utilise pour identifier les types de compte. Le 9e octet est là où le champ `count` commence. Vous pouvez vous référer à l'IDL pour voir que le prochain octet stocke le champ `count` de type `u64`. Anchor filtre alors et renvoie tous les comptes avec des octets correspondants à la même position.

```tsx
const accounts = await program.account.counter.all([
    {
        memcmp: {
            offset: 8,
            bytes: bs58.encode((new BN(0, 'le')).toArray()),
        },
    },
])
```

Alternativement, vous pouvez également obtenir les données de compte désérialisées pour un compte spécifique en utilisant `fetch` si vous connaissez l'adresse du compte que vous recherchez.

```tsx
const account = await program.account.counter.fetch(ACCOUNT_ADDRESS)
```

De même, vous pouvez récupérer plusieurs comptes en utilisant `fetchMultiple`.

```tsx
const accounts = await program.account.counter.fetchMultiple([ACCOUNT_ADDRESS_ONE, ACCOUNT_ADDRESS_TWO])
```

# Laboratoire

Pratiquons ensemble en construisant une interface frontend pour le programme Counter de la dernière leçon. Pour rappel, le programme Counter comporte deux instructions :

- `initialize` - initialise un nouveau compte `Counter` et définit le `count` à `0`
- `increment` - incrémente le `count` sur un compte `Counter` existant

### 1. Téléchargez le code de départ

Téléchargez [le code de départ pour ce projet](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/starter). Une fois que vous avez le code de départ, jetez-y un coup d'œil. Installez les dépendances avec `npm install` puis exécutez l'application avec `npm run dev`.

Ce projet est une application Next.js simple. Il inclut le `WalletContextProvider` que nous avons créé dans la [leçon sur les Portefeuilles](https://github.com/Unboxed-Software/solana-course/blob/main/content/interact-with-wallets), le fichier `idl.json` pour le programme Counter, et les composants `Initialize` et `Increment` que nous allons construire tout au long de ce laboratoire. Le `programId` du programme que nous allons invoquer est également inclus dans le code de départ.

### 2. `Initialize`

Pour commencer, complétons la configuration pour créer l'objet `Program` dans le composant `Initialize.tsx`.

Rappelez-vous, nous aurons besoin d'une instance de `Program` pour utiliser le constructeur `MethodsBuilder` d'Anchor pour invoquer les instructions sur notre programme. Pour cela, nous aurons besoin d'un portefeuille Anchor et d'une connexion, que nous pouvons obtenir à partir des hooks `useAnchorWallet` et `useConnection`. Créons également un `useState` pour capturer l'instance du programme.

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
  const [program, setProgram] = useState("")

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  ...
}
```

Avec cela, nous pouvons travailler sur la création de l'instance `Program` réelle. Faisons cela dans un `useEffect`.

Tout d'abord, nous devons soit obtenir le fournisseur par défaut s'il existe déjà, soit le créer s'il n'existe pas. Nous pouvons faire cela en appelant `getProvider` à l'intérieur d'un bloc try/catch. Si une erreur est levée, cela signifie qu'il n'y a pas de fournisseur par défaut et nous devons en créer un.

Une fois que nous avons un fournisseur, nous pouvons construire une instance `Program`.

```tsx
useEffect(() => {
  let provider: anchor.Provider

  try {
    provider = anchor.getProvider()
  } catch {
    provider = new anchor.AnchorProvider(connection, wallet, {})
    anchor.setProvider(provider)
  }

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
  setProgram(program)
}, [])
```

Maintenant que nous avons terminé la configuration d'Anchor, nous pouvons en fait invoquer l'instruction `initialize` du programme. Nous ferons cela à l'intérieur de la fonction `onClick`.

Tout d'abord, nous devrons générer une nouvelle `Keypair` pour le nouveau compte `Counter` car nous initialisons un compte pour la première fois.

Ensuite, nous pouvons utiliser le constructeur `MethodsBuilder` d'Anchor pour créer et envoyer une nouvelle transaction. Rappelez-vous, Anchor peut déduire certains des comptes requis, comme les comptes `user` et `systemAccount`. Cependant, il ne peut pas déduire le compte `counter` car nous le générons dynamiquement, donc vous devrez l'ajouter avec `.accounts`. Vous devrez également ajouter cette `Keypair` en tant que signataire avec `.signers`. Enfin, vous pouvez utiliser `.rpc()` pour soumettre la transaction au portefeuille de l'utilisateur.

Une fois la transaction effectuée, appelez `setUrl` avec l'URL de l'explorateur et appelez ensuite `setCounter`, en passant le compte du compteur.

```tsx
const onClick = async () => {
  const sig = await program.methods
    .initialize()
    .accounts({
      counter: newAccount.publicKey,
      user: wallet.publicKey,
      systemAccount: anchor.web3.SystemProgram.programId,
    })
    .signers([newAccount])
    .rpc()

    setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    setCounter(newAccount.publicKey)
}
```

### 3. `Increment`

Ensuite, passons au composant `Increment.tsx`. Tout comme précédemment, complétez la configuration pour créer l'objet `Program`. En plus d'appeler `setProgram`, le `useEffect` devrait appeler `refreshCount`.

Ajoutez le code suivant pour la configuration initiale :

```tsx
export const Increment: FC<Props> = ({ counter, setTransactionUrl }) => {
  const [count, setCount] = useState(0)
  const [program, setProgram] = useState<anchor.Program>()
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  useEffect(() => {
    let provider: anchor.Provider

    try {
      provider = anchor.getProvider()
    } catch {
      provider = new anchor.AnchorProvider(connection, wallet, {})
      anchor.setProvider(provider)
    }

    const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
    setProgram(program)
    refreshCount(program)
  }, [])
  ...
}
```

Ensuite, utilisons le constructeur `MethodsBuilder` d'Anchor pour construire une nouvelle instruction pour invoquer l'instruction `increment`. Encore une fois, Anchor peut déduire le compte `user` à partir du portefeuille, donc nous n'avons besoin d'inclure que le compte `counter`.

```tsx
const onClick = async () => {
  const sig = await program.methods
    .increment()
    .accounts({
      counter: counter,
      user: wallet.publicKey,
    })
    .rpc()

  setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
}
```

### 5. Afficher le compte correct

Maintenant que nous pouvons initialiser le programme de comptage et incrémenter le compte, nous devons faire en sorte que notre interface utilisateur affiche le compte stocké dans le compte de comptage.

Nous montrerons comment observer les changements de compte dans une leçon future, mais pour l'instant nous avons juste un bouton qui appelle `refreshCount` afin que vous puissiez cliquer dessus pour afficher le nouveau compte après chaque invocation `increment`.

À l'intérieur de `refreshCount`, utilisons `program` pour récupérer le compte de comptage, puis utilisons `setCount` pour définir le compte sur le nombre stocké dans le programme :

```tsx
const refreshCount = async (program) => {
  const counterAccount = await program.account.counter.fetch(counter)
  setCount(counterAccount.count.toNumber())
}
```

Super simple avec Anchor !

### 5. Testez le frontend

À ce stade, tout devrait fonctionner ! Vous pouvez tester le frontend en exécutant `npm run dev`.

1. Connectez votre portefeuille et vous devriez voir le bouton `Initialize Counter`
2. Cliquez sur le bouton `Initialize Counter`, puis approuvez la transaction
3. Vous devriez ensuite voir un lien en bas de l'écran vers Solana Explorer pour la transaction `initialize`. Le bouton `Increment Counter`, le bouton `Refresh Count` et le compte devraient également tous apparaître.
4. Cliquez sur le bouton `Increment Counter`, puis approuvez la transaction
5. Attendez quelques secondes et cliquez sur `Refresh Count`. Le compte devrait s'incrémenter à l'écran.

![Gif of Anchor Frontend Demo](../assets/anchor-frontend-demo.gif)

N'hésitez pas à cliquer sur les liens pour inspecter les logs du programme de chaque transaction !

![Screenshot of Initialize Program Log](../assets/anchor-frontend-initialize.png)

![Screenshot of Increment Program Log](../assets/anchor-frontend-increment.png)

Félicitations, vous savez maintenant comment configurer un frontend pour invoquer un programme Solana en utilisant un IDL Anchor.

Si vous avez besoin de plus de temps avec ce projet pour vous sentir à l'aise avec ces concepts, n'hésitez pas à consulter le [code de solution sur la branche `solution-increment`](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-increment) avant de continuer.

# Défi

Maintenant, c'est à votre tour de construire quelque chose de manière indépendante. En vous basant sur ce que nous avons fait dans le laboratoire, essayez de créer un nouveau composant dans le frontend qui implémente un bouton pour décrémenter le compteur.

Avant de construire le composant dans le frontend, vous devrez d'abord :

1. Construire et déployer un nouveau programme qui implémente une instruction `decrement`
2. Mettre à jour le fichier IDL dans le frontend avec celui de votre nouveau programme
3. Mettre à jour le `programId` avec celui de votre nouveau programme

Si vous avez besoin d'aide, n'hésitez pas à [vous référer à ce programme](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

Essayez de faire cela de manière indépendante si vous le pouvez ! Mais si vous êtes bloqué, n'hésitez pas à consulter le [code de solution](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-decrement).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=774a4023-646d-4394-af6d-19724a6db3db) !
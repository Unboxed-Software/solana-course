---
title: Créer des jetons avec le programme de jetons
objectives:
- Créer des jetons de monnaie
- Créer des comptes de jetons
- Émettre des jetons
- Transférer des jetons
- Brûler des jetons
---

# Résumé

- Les **SPL-Tokens** représentent tous les jetons non natifs sur le réseau Solana. Les jetons fongibles et non fongibles (NFT) sur Solana sont des SPL-Tokens
- Le **programme de jetons** contient des instructions pour créer et interagir avec les SPL-Tokens
- Les **jetons de monnaie** sont des comptes qui contiennent des données sur un jeton spécifique, mais ne contiennent pas de jetons
- Les **comptes de jetons** sont utilisés pour détenir des jetons d'une monnaie de jetons spécifique
- La création de jetons de monnaie et de comptes de jetons nécessite l'allocation de **loyer** en SOL. Le loyer d'un compte de jetons peut être remboursé lorsque le compte est fermé, cependant, les jetons de monnaie ne peuvent actuellement pas être fermés

# Aperçu général

Le programme de jetons est l'un des nombreux programmes mis à disposition par la bibliothèque de programmes Solana (SPL). Il contient des instructions pour créer et interagir avec les SPL-Tokens. Ces jetons représentent tous les jetons non natifs (c'est-à-dire non SOL) sur le réseau Solana.

Cette leçon se concentrera sur les bases de la création et de la gestion d'un nouveau SPL-Token en utilisant le programme de jetons :
1. Création d'un nouveau jeton de monnaie
2. Création de comptes de jetons
3. Émission
4. Transfert de jetons d'un détenteur à un autre
5. Brûlage de jetons

Nous aborderons cela du côté client du processus de développement en utilisant la bibliothèque Javascript `@solana/spl-token`.

## Jeton de monnaie

Pour créer un nouveau SPL-Token, vous devez d'abord créer un jeton de monnaie. Un jeton de monnaie est le compte qui contient des données sur un jeton spécifique.

Par exemple, regardons [USDC (USD Coin) sur Solana Explorer](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v). L'adresse du jeton de monnaie USDC est `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. Avec l'explorateur, nous pouvons voir les détails particuliers sur le jeton de monnaie USDC tels que l'offre actuelle de jetons, les adresses de l'autorité de frappe et de gel, et la précision décimale du jeton :

![Capture d'écran du jeton de monnaie USDC](../assets/token-program-usdc-mint.png)

Pour créer un nouveau jeton de monnaie, vous devez envoyer les bonnes instructions de transaction au programme de jetons. Pour ce faire, nous utiliserons la fonction `createMint` de `@solana/spl-token`.

```tsx
const tokenMint = await createMint(
  connection,
  payer,
  mintAuthority,
  freezeAuthority,
  decimal
);
```

 La fonction `createMint` retourne la `publicKey` du nouveau jeton de monnaie. Cette fonction nécessite les arguments suivants :

- `connection` - la connexion JSON-RPC au cluster
- `payer` - la clé publique du payeur pour la transaction
- `mintAuthority` - le compte qui est autorisé à effectuer réellement l'émission de jetons depuis le jeton de monnaie.
- `freezeAuthority` - un compte autorisé à geler les jetons dans un compte de jetons. Si le gel n'est pas une caractéristique souhaitée, le paramètre peut être défini sur null
- `décimales` - spécifie la précision décimale souhaitée du jeton

Lorsque vous créez une nouvelle monnaie à partir d'un script qui a accès à votre clé secrète, vous pouvez simplement utiliser la fonction `createMint`. Cependant, si vous deviez construire un site Web pour permettre aux utilisateurs de créer une nouvelle monnaie de jetons, vous devriez le faire avec la clé secrète de l'utilisateur sans les exposer au navigateur. Dans ce cas, vous voudriez construire et soumettre une transaction avec les bonnes instructions.

Sous le capot, la fonction `createMint` crée simplement une transaction contenant deux instructions :
1. Créer un nouveau compte
2. Initialiser un nouveau jeton de monnaie

Cela ressemblerait à ce qui suit :

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateMintTransaction(
  connection: web3.Connection,
  payer: web3.PublicKey,
  decimals: number
): Promise<web3.Transaction> {
  const lamports = await token.getMinimumBalanceForRentExemptMint(connection);
  const accountKeypair = web3.Keypair.generate();
  const programId = token.TOKEN_PROGRAM_ID

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: accountKeypair.publicKey,
      space: token.MINT_SIZE,
      lamports,
      programId,
    }),
    token.createInitializeMintInstruction(
      accountKeypair.publicKey,
      decimals,
      payer,
      payer,
      programId
    )
  );

  return transaction
}
```

Lors de la construction manuelle des instructions pour créer un nouveau jeton de monnaie, assurez-vous d'ajouter les instructions pour créer le compte et initialiser le jeton dans la *même transaction*. Si vous deviez effectuer chaque étape dans une transaction séparée, il serait théoriquement possible pour quelqu'un d'autre de prendre le compte que vous créez et de l'initialiser pour leur propre monnaie.

### Loyer et exemption de loyer
Notez que la première ligne dans le corps de la fonction du code précédent contient un appel à `getMinimumBalanceForRentExemptMint`, dont le résultat est passé à la fonction `createAccount`. Cela fait partie de l'initialisation du compte et cela s'appelle l'exemption de loyer.

Jusqu'à récemment, tous les comptes sur Solana devaient faire l'une des choses suivantes pour éviter d'être désalloués :
1. Payer un loyer à des intervalles spécifiques
2. Déposer suffisamment de SOL lors de l'initialisation pour être considéré comme exempt de loyer

Récemment, la première option a été abandonnée et il est devenu nécessaire de déposer suffisamment de SOL pour l'exemption de loyer lors de l'initialisation d'un nouveau compte.

Dans ce cas, nous créons un nouveau compte pour un jeton de monnaie, nous utilisons `getMinimumBalanceForRentExemptMint` de la bibliothèque `@solana/spl-token`. Cependant, ce concept s'applique à tous les comptes et vous pouvez utiliser la méthode plus générique `getMinimumBalanceForRentExemption` sur `Connection` pour d'autres comptes que vous pourriez avoir besoin de créer.

## Compte de jetons

Avant de pouvoir émettre des jetons (émettre de nouvelles fournitures), vous avez besoin d'un compte de jetons pour contenir les jetons nouvellement émis.

Un compte de jetons contient des jetons d'un "jeton de monnaie" spécifique et a un "propriétaire" spécifié du compte. Seul le propriétaire est autorisé à diminuer le solde du compte de jetons (transférer, brûler, etc.) tandis que n'importe qui peut envoyer des jetons au compte de jetons pour augmenter son solde.

Vous pouvez utiliser la fonction `createAccount` de la bibliothèque `spl-token` pour créer le nouveau compte de jetons :

```tsx
const tokenAccount = await createAccount(
  connection,
  payer,
  mint,
  owner,
  keypair
);
```

La fonction `createAccount` retourne la `publicKey` du nouveau compte de jetons. Cette fonction nécessite les arguments suivants :

- `connection` - la connexion JSON-RPC au cluster
- `payer` - le compte du payeur pour la transaction
- `mint` - le jeton de monnaie auquel le nouveau compte de jetons est associé
- `owner` - le compte du propriétaire du nouveau compte de jetons
- `keypair` - c'est un paramètre facultatif pour spécifier l'adresse du nouveau compte de jetons. Si aucune paire de clés n'est fournie, la fonction `createAccount` utilise par défaut une dérivation des comptes `mint` et `owner` associés.

Veuillez noter que cette fonction `createAccount` est différente de la fonction `createAccount` affichée ci-dessus lorsque nous avons regardé sous le capot de la fonction `createMint`. Précédemment, nous avons utilisé la fonction `createAccount` sur `SystemProgram` pour retourner l'instruction de création de tous les comptes. La fonction `createAccount` ici est une fonction d'aide dans la bibliothèque `spl-token` qui soumet une transaction avec deux instructions. La première crée le compte et la seconde initialise le compte en tant que compte de jetons.

Comme pour la création d'un jeton de monnaie, si nous devions construire manuellement la transaction pour `createAccount`, nous pourrions dupliquer ce que fait la fonction sous le capot :
1. Utiliser `getMint` pour récupérer les données associées au `mint`
2. Utiliser `getAccountLenForMint` pour calculer l'espace nécessaire pour le compte de jetons
3. Utiliser `getMinimumBalanceForRentExemption` pour calculer les lamports nécessaires pour l'exemption de loyer
4. Créer une nouvelle transaction en utilisant `SystemProgram.createAccount` et `createInitializeAccountInstruction`. Notez que ce `createAccount` est de `@solana/web3.js` et est utilisé pour créer un nouveau compte générique. Le `createInitializeAccountInstruction` utilise ce nouveau compte pour initialiser le nouveau compte de jetons

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateTokenAccountTransaction(
  connection: web3.Connection,
  payer: web3.PublicKey,
  mint: web3.PublicKey
): Promise<web3.Transaction> {
  const mintState = await token.getMint(connection, mint)
  const accountKeypair = await web3.Keypair.generate()
  const space = token.getAccountLenForMint(mintState);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  const programId = token.TOKEN_PROGRAM_ID

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: accountKeypair.publicKey,
      space,
      lamports,
      programId,
    }),
    token.createInitializeAccountInstruction(
      accountKeypair.publicKey,
      mint,
      payer,
      programId
    )
  );

  return transaction
}
```

### Compte de jetons associé

Un compte de jetons associé est un compte de jetons où l'adresse du compte de jetons est dérivée à l'aide de la clé publique du propriétaire et d'un jeton de monnaie. Les comptes de jetons associés fournissent un moyen déterministe de trouver le compte de jetons détenu par une `publicKey` spécifique pour un jeton de monnaie spécifique.

La plupart du temps, lorsque vous créez un compte de jetons, vous voudrez qu'il s'agisse d'un compte de jetons associé.
- Si ce n'était pas le cas pour le compte de jetons associé, un utilisateur pourrait posséder de nombreux comptes de jetons appartenant à la même monnaie de jetons, ce qui entraînerait une confusion quant à l'endroit où envoyer des jetons.
- Le compte de jetons associé permet à un utilisateur d'envoyer des jetons à un autre utilisateur si le destinataire n'a pas encore le compte de jetons pour cette monnaie de jetons.

![Les CJA sont des PDA](../assets/atas-are-pdas.svg)

De manière similaire ci-dessus, vous pouvez créer un compte de jetons associé en utilisant la fonction `createAssociatedTokenAccount` de la bibliothèque `spl-token`.

```tsx
const associatedTokenAccount = await createAssociatedTokenAccount(
  connection,
	payer,
	mint,
	owner,
);
```

Cette fonction retourne la `publicKey` du nouveau compte de jetons associé et nécessite les arguments suivants :

- `connection` - la connexion JSON-RPC au cluster
- `payer` - le compte du payeur pour la transaction
- `mint` - le jeton de monnaie auquel le nouveau compte de jetons est associé
- `owner` - le compte du propriétaire du nouveau compte de jetons

Vous pouvez également utiliser `getOrCreateAssociatedTokenAccount` pour obtenir le compte de jetons associé à une adresse donnée ou le créer s'il n'existe pas. Par exemple, si vous écriviez du code pour larguer des jetons à un utilisateur donné, vous utiliseriez probablement cette fonction pour garantir que le compte de jetons associé à l'utilisateur donné soit créé s'il n'existe pas déjà.

Sous le capot, `createAssociatedTokenAccount` fait deux choses :

1. Utilisation de `getAssociatedTokenAddress` pour dériver l'adresse du compte de jetons associé à partir du `mint` et du `owner`
2. Construction d'une transaction en utilisant des instructions de `createAssociatedTokenAccountInstruction`

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateAssociatedTokenAccountTransaction(
  payer: web3.PublicKey,
  mint: web3.PublicKey
): Promise<web3.Transaction> {
  const associatedTokenAddress = await token.getAssociatedTokenAddress(mint, payer, false);

  const transaction = new web3.Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      payer,
      associatedTokenAddress,
      payer,
      mint
    )
  )

  return transaction
}
```

## Émettre des jetons

L'émission de jetons est le processus d'émission de nouveaux jetons en circulation. Lorsque vous émettez des jetons, vous augmentez l'offre du jeton de monnaie et déposez les jetons nouvellement émis dans un compte de jetons. Seule l'autorité de frappe d'un jeton de monnaie est autorisée à frapper de nouveaux jetons.

Pour émettre des jetons en utilisant la bibliothèque `spl-token`, vous pouvez utiliser la fonction `mintTo`.

```tsx
const transactionSignature = await mintTo(
  connection,
  payer,
  mint,
  destination,
  authority,
  amount
);
```

La fonction `mintTo` retourne une `TransactionSignature` qui peut être consultée sur Solana Explorer. La fonction `mintTo` nécessite les arguments suivants :

- `connection` - la connexion JSON-RPC au cluster
- `payer` - le compte du payeur pour la transaction
- `mint` - le jeton de monnaie auquel le nouveau compte de jetons est associé
- `destination` - le compte de jetons vers lequel les jetons seront émis
- `authority` - le compte autorisé à émettre des jetons
- `amount` - la quantité brute de jetons à émettre en dehors des décimales, par ex. si la propriété de décimales de Scrooge Coin était définie sur 2 alors pour obtenir 1 Scrooge Coin complet vous devriez définir cette propriété sur 100

Il n'est pas rare de mettre à jour l'autorité de frappe sur un jeton de monnaie à null après que les jetons ont été émis. Cela fixerait un approvisionnement maximal et garantirait qu'aucun jeton ne puisse être émis à l'avenir. Inversement, l'autorité de frappe pourrait être accordée à un programme afin que les jetons puissent être automatiquement émis à intervalles réguliers ou selon des conditions programmables.

Sous le capot, la fonction `mintTo` crée simplement une transaction avec les instructions obtenues à partir de la fonction `createMintToInstruction`.

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildMintToTransaction(
  authority: web3.PublicKey,
  mint: web3.PublicKey,
  amount: number,
  destination: web3.PublicKey
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authority,
      amount
    )
  )

  return transaction
}
```

## Transférer des jetons

Les transferts de jetons SPL-Token nécessitent que l'expéditeur et le destinataire aient des comptes de jetons pour le jeton de monnaie des jetons transférés. Les jetons sont transférés du compte de jetons de l'expéditeur au compte de jetons du destinataire.

Vous pouvez utiliser `getOrCreateAssociatedTokenAccount` lors de l'obtention du compte de jetons associé du destinataire pour garantir que son compte de jetons existe avant le transfert. N'oubliez pas que si le compte n'existe pas déjà, cette fonction le créera et le payeur de la transaction sera débité des lamports nécessaires pour la création du compte.

Une fois que vous connaissez l'adresse du compte de jetons du destinataire, vous transférez des jetons en utilisant la fonction `transfer` de la bibliothèque `spl-token`.

```tsx
const transactionSignature = await transfer(
  connection,
  payer,
  source,
  destination,
  owner,
  amount
)
```

La fonction `transfer` retourne une `TransactionSignature` qui peut être consultée sur Solana Explorer. La fonction `transfer` nécessite les arguments suivants :

- `connection` la connexion JSON-RPC au cluster
- `payer` le compte du payeur pour la transaction
- `source` le compte de jetons envoyant des jetons
- `destination` le compte de jetons recevant des jetons
- `owner` le compte du propriétaire du compte de jetons `source`
- `amount` la quantité de jetons à transférer

Sous le capot, la fonction `transfer` crée simplement une transaction avec les instructions obtenues à partir de la fonction `createTransferInstruction` :

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildTransferTransaction(
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createTransferInstruction(
      source,
      destination,
      owner,
      amount,
    )
  )

  return transaction
}
```

## Brûler des jetons

Brûler des jetons est le processus de diminution de l'offre de jetons d'un jeton de monnaie donné. Brûler des jetons les supprime du compte de jetons donné et de la circulation plus large.

Pour brûler des jetons en utilisant la bibliothèque `spl-token`, vous utilisez la fonction `burn`.

```tsx
const transactionSignature = await burn(
  connection,
  payer,
  account,
  mint,
  owner,
  amount
)
```

La fonction `burn` retourne une `TransactionSignature` qui peut être consultée sur Solana Explorer. La fonction `burn` nécessite les arguments suivants :

- `connection` la connexion JSON-RPC au cluster
- `payer` le compte du payeur pour la transaction
- `account` le compte de jetons à partir duquel brûler des jetons
- `mint` le jeton de monnaie auquel le compte de jetons appartient
- `owner` le compte du propriétaire du compte de jetons
- `amount` la quantité de jetons à brûler

Sous le capot, la fonction `burn` crée simplement une transaction avec les instructions obtenues à partir de la fonction `createBurnInstruction` :

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildBurnTransaction(
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createBurnInstruction(
      account,
      mint,
      owner,
      amount
    )
  )

  return transaction
}
```

## Approuver un délégué

Approuver un délégué est le processus qui consiste à autoriser un autre compte à transférer ou à brûler des jetons à partir d'un compte de jetons. Lors de l'utilisation d'un délégué, l'autorité sur le compte de jetons reste avec le propriétaire d'origine. Le montant maximum de jetons qu'un délégué peut transférer ou brûler est spécifié au moment où le propriétaire du compte de jetons approuve le délégué. Notez qu'il ne peut y avoir qu'un seul compte délégué associé à un compte de jetons à un moment donné.

Pour approuver un délégué en utilisant la bibliothèque `spl-token`, vous pouvez utiliser la fonction `approve`.

```tsx
const transactionSignature = await approve(
  connection,
  payer,
  account,
  delegate,
  owner,
  amount
  )
```

La fonction `approve` retourne une `TransactionSignature` qui peut être consultée sur Solana Explorer. La fonction `approve` nécessite les arguments suivants :

- `connection` : la connexion JSON-RPC au cluster
- `payer` : le compte du payeur pour la transaction
- `account` : le compte de jetons à partir duquel déléguer les jetons
- `delegate` : le compte que le propriétaire autorise à transférer ou à brûler des jetons
- `owner` : le compte du propriétaire du compte de jetons
- `amount` : le nombre maximal de jetons que le délégué peut transférer ou brûler

Sous le capot, la fonction `approve` crée une transaction avec des instructions obtenues à partir de la fonction `createApproveInstruction` :

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildApproveTransaction(
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createApproveInstruction(
      account,
      delegate,
      owner,
      amount
    )
  )

  return transaction
}
```

## Révoquer un délégué

Un délégué précédemment approuvé pour un compte de jetons peut être révoqué ultérieurement. Une fois qu'un délégué est révoqué, celui-ci ne peut plus transférer de jetons à partir du compte de jetons du propriétaire. Tout montant restant non transféré à partir du montant précédemment approuvé ne peut plus être transféré par le délégué.

Pour révoquer un délégué en utilisant la bibliothèque `spl-token`, vous utilisez la fonction `revoke`.

```tsx
const transactionSignature = await revoke(
  connection,
  payer,
  account,
  owner,
  )
```

La fonction `revoke` retourne une `TransactionSignature` qui peut être consultée sur Solana Explorer. La fonction `revoke` nécessite les arguments suivants :

- `connection` : la connexion JSON-RPC au cluster
- `payer` : le compte du payeur pour la transaction
- `account` : le compte de jetons pour révoquer l'autorité du délégué
- `owner` : le compte du propriétaire du compte de jetons

Sous le capot, la fonction `revoke` crée une transaction avec des instructions obtenues à partir de la fonction `createRevokeInstruction` :

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildRevokeTransaction(
  account: web3.PublicKey,
  owner: web3.PublicKey,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createRevokeInstruction(
      account,
      owner,
    )
  )

  return transaction
}
```

# Laboratoire

Nous allons créer un script qui interagit avec des instructions sur le programme de jetons. Nous allons créer un nouveau jeton, créer des comptes de jetons, émettre des jetons, approuver un délégué, transférer des jetons et brûler des jetons.

### 1. Infrastructure de base

Commençons par mettre en place une infrastructure de base. Vous pouvez configurer votre projet de la manière qui vous semble la plus appropriée, mais nous utiliserons un projet TypeScript simple avec une dépendance sur les packages `@solana/web3.js` et `@solana/spl-token`.

Vous pouvez utiliser `npx create-solana-client [INSÉRER_NOM_ICI] --initialize-keypair` dans la ligne de commande pour cloner le modèle à partir duquel nous allons partir. Ou vous pouvez [cloner manuellement le modèle](https://github.com/Unboxed-Software/solana-npx-client-template/tree/with-keypair-env). Notez que si vous utilisez directement le dépôt Git comme point de départ, nous partirons de la branche `with-keypair-env`.

Ensuite, vous devrez ajouter une dépendance à `@solana/spl-token`. Depuis la ligne de commande à l'intérieur du répertoire nouvellement créé, utilisez la commande `npm install @solana/spl-token`.

### 2. Création d'un nouveau jeton

Nous utiliserons la bibliothèque `@solana/spl-token`, commençons donc par l'importer en haut du fichier.

```tsx
import * as token from '@solana/spl-token'
```

Ensuite, déclarez une nouvelle fonction `createNewMint` avec les paramètres `connection`, `payer`, `mintAuthority`, `freezeAuthority` et `decimals`.

Dans le corps de la fonction, importez `createMint` depuis `@solana/spl-token` et créez ensuite une fonction pour appeler `createMint` :

```tsx
async function createNewMint(
  connection: web3.Connection,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthority: web3.PublicKey,
  decimals: number
): Promise<web3.PublicKey> {

  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );

  console.log(
    `Jetons créés : https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
  );

  return tokenMint;
}
```

Avec cette fonction terminée, appelez-la à partir du corps de `main`, en définissant `user` comme `payer`, `mintAuthority` et `freezeAuthority`.

Après avoir créé le nouveau jeton, récupérons les données du compte en utilisant la fonction `getMint` et stockons-les dans une variable appelée `mintInfo`. Nous utiliserons ces données plus tard pour ajuster la `amount` d'entrée pour la précision décimale du jeton.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);
}
```

### 3. Création d'un compte de jetons

Maintenant que nous avons créé le jeton, créons un nouveau compte de jetons, en spécifiant `user` comme `owner`.

La fonction `createAccount` crée un nouveau compte de jetons avec la possibilité de spécifier l'adresse du compte de jetons. Rappelez-vous que si aucune adresse n'est fournie, `createAccount` utilisera par défaut le compte de jetons associé dérivé en utilisant le `mint` et le `owner`.

Alternativement, la fonction `createAssociatedTokenAccount` créera également un compte de jetons associé avec la même adresse dérivée des clés publiques `mint` et `owner`.

Pour notre démonstration, nous utiliserons la fonction `getOrCreateAssociatedTokenAccount` pour créer notre compte de jetons. Cette fonction obtient l'adresse d'un compte de jetons s'il existe déjà. Sinon, elle créera un nouveau compte de jetons associé à l'adresse appropriée.

```tsx
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )

  console.log(
    `Compte de jetons : https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
  )

  return tokenAccount
}
```

Ajoutez un appel à `createTokenAccount` dans `main`, en passant le jeton que nous avons créé à l'étape précédente et en définissant `user` comme `payer` et `owner`.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )
}
```

### 4. Émission de jetons

Maintenant que nous avons un jeton et un compte de jetons, émettons des jetons sur le compte de jetons. Notez que seule l'`authority` de création de jetons peut émettre de nouveaux jetons sur un compte de jetons. Rappelez-vous que nous avons défini `user` comme `authority` de création de jetons pour le `mint` que nous avons créé.

Créez une fonction `mintTokens` qui utilise la fonction `mintTo` de la bibliothèque `spl-token` pour émettre des jetons :

```tsx
async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount
  )

  console.log(
    `Transaction de création de jeton : https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

Appelons cette fonction dans `main` en utilisant le jeton et le compte de jetons créés précédemment.

Notez que nous devons ajuster la `amount` d'entrée pour la précision décimale du jeton. Les jetons de notre `mint` ont une précision décimale de 2. Si nous spécifions uniquement 100 comme `amount` d'entrée, alors seul 1 jeton sera émis sur notre compte de jetons.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )
}
```

### 5. Approuver un délégué

Maintenant que nous avons un jeton et un compte de jetons, autorisons un délégué à transférer des jetons en notre nom.

Créez une fonction `approveDelegate` qui utilise la fonction `approve` de la bibliothèque `spl-token` pour approuver des jetons :

```tsx
async function approveDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
  amount: number
) {
  const transactionSignature = await token.approve(
    connection,
    payer,
    account,
    delegate,
    owner,
    amount
  )

  console.log(
    `Transaction d'approbation du délégué : https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

Dans `main`, générons un nouveau `Keypair` pour représenter le compte délégué. Ensuite, appelons notre nouvelle fonction `approveDelegate` et autorisons le délégué à transférer jusqu'à 50 jetons à partir du compte de jetons de l'utilisateur. N'oubliez pas d'ajuster la `amount` pour la précision décimale du `mint`.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const delegate = web3.Keypair.generate();

  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )
}
```

### 6. Transférer des jetons

Ensuite, transférons une partie des jetons que nous venons de créer en utilisant la fonction `transfer` de la bibliothèque `spl-token`.

```tsx
async function transferTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
  )

  console.log(
    `Transaction de transfert : https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

Avant de pouvoir appeler cette nouvelle fonction, nous devons connaître le compte dans lequel nous transférerons les jetons.

Dans `main`, générons un nouveau `Keypair` pour être le destinataire (mais rappelez-vous que cela ne fait que simuler le fait d'avoir quelqu'un à qui envoyer des jetons - dans une application réelle, vous auriez besoin de connaître l'adresse du portefeuille de la personne recevant les jetons).

Ensuite, créez un compte de jetons pour le destinataire. Enfin, appelons notre nouvelle fonction `transferTokens` pour transférer des jetons du compte de jetons de l'utilisateur au compte de jetons du destinataire. Nous utiliserons le `délégué` que nous avons approuvé à l'étape précédente pour effectuer le transfert en notre nom.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  const mintInfo = await token.getMint(connection, mint);

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const receiver = web3.Keypair.generate().publicKey
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )
}
```

### 7. Révoquer un délégué

Maintenant que nous avons terminé de transférer des jetons, révoquons le `délégué` en utilisant la fonction `revoke` de la bibliothèque `spl-token`.

```tsx
async function revokeDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
) {
  const transactionSignature = await token.revoke(
    connection,
    payer,
    account,
    owner,
  )

  console.log(
    `Transaction de révocation du délégué : https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}


```

`revoke` va réinitialiser le délégué pour le compte de jetons à null et remettre la quantité déléguée à 0. Tout ce dont nous aurons besoin pour cette fonction est le compte de jetons et l'utilisateur. Appelons notre nouvelle fonction `revokeDelegate` pour révoquer le délégué du compte de jetons de l'utilisateur.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const receiver = web3.Keypair.generate().publicKey
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )

  await revokeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  )
}
```

### 8. Brûler des jetons

Enfin, retirons certains jetons de la circulation en les brûlant.

Créez une fonction `burnTokens` qui utilise la fonction `burn` de la bibliothèque `spl-token` pour retirer la moitié de vos jetons de la circulation.

```tsx
async function burnTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount
  )

  console.log(
    `Transaction de Brûlure : https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

Appelez maintenant cette nouvelle fonction dans `main` pour brûler 25 des jetons de l'utilisateur. N'oubliez pas d'ajuster le `montant` pour la précision décimale du `mint`.

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const receiver = web3.Keypair.generate().publicKey
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )

  await revokeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  )

  await burnTokens(
    connection, 
    user, 
    tokenAccount.address, 
    mint, user, 
    25 * 10 ** mintInfo.decimals
  )
}
```

### 9. Testez tout

Avec cela, exécutez `npm start`. Vous devriez voir une série de liens Solana Explorer affichés dans la console. Cliquez dessus et voyez ce qui s'est passé à chaque étape ! Vous avez créé un nouvel émetteur de jetons, créé un compte de jetons, émis 100 jetons, approuvé un délégué, transféré 50 jetons à l'aide d'un délégué, révoqué le délégué et brûlé 25 de plus. Vous êtes bien parti pour devenir un expert en jetons.

Si vous avez besoin de plus de temps avec ce projet pour vous sentir à l'aise, consultez le [code de solution complet](https://github.com/Unboxed-Software/solana-token-client)

# Défi

Maintenant, c'est à votre tour de construire quelque chose de manière indépendante. Créez une application qui permet à un utilisateur de créer un nouvel émetteur, de créer un compte de jetons et d'émettre des jetons.

Notez que vous ne pourrez pas utiliser directement les fonctions d'aide que nous avons vues dans le laboratoire. Pour interagir avec le programme de jetons en utilisant l'adaptateur de portefeuille Phantom, vous devrez construire chaque transaction manuellement et soumettre la transaction à Phantom pour approbation.

![Capture d'écran du défi du programme de jetons Frontend](../assets/token-program-frontend.png)

1. Vous pouvez construire cela à partir de zéro ou vous pouvez [télécharger le code de démarrage](https://github.com/Unboxed-Software/solana-token-frontend/tree/starter).
2. Créez un nouvel émetteur de jetons dans le composant `CreateMint`.
  Si vous avez besoin d'un rappel sur la manière d'envoyer des transactions à un portefeuille pour approbation, consultez la [leçon sur les portefeuilles](./interact-with-wallets).

  Lors de la création d'un nouvel émetteur, la nouvelle `Keypair` générée devra également signer la transaction. Lorsque des signataires supplémentaires sont requis en plus du portefeuille connecté, utilisez le format suivant :

  ```tsx
  sendTransaction(transaction, connection, {
    signers: [Keypair],
  })
  ```
3. Créez un nouveau compte de jetons dans le composant `CreateTokenAccount`.
4. Émettez des jetons dans le composant `MintToForm`.

Si vous êtes bloqué, n'hésitez pas à consulter le [code de solution](https://github.com/ZYJLiu/solana-token-frontend).

Et n'oubliez pas, soyez créatif avec ces défis et inventez les vôtres !

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=72cab3b8-984b-4b09-a341-86800167cfc7) !
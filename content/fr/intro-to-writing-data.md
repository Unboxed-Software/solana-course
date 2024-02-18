---
title: Créer des transactions sur le réseau Solana
objectives:
- Expliquer les transactions
- Expliquer les frais de transaction
- Utiliser `@solana/web3.js` pour envoyer du SOL
- Utiliser `@solana/web3.js` pour signer des transactions
- Utiliser l'explorateur Solana pour voir les transactions
---

# Résumé

Toutes les modifications des données onchain se font à travers des **transactions**. Les transactions sont principalement un ensemble d'instructions qui invoquent des programmes Solana. Les transactions sont atomiques, ce qui signifie qu'elles réussissent si toutes les instructions sont exécutées correctement, ou échouent, comme si la transaction n'avait pas été exécutée du tout.

# Aperçu général

## Les transactions sont atomiques

Toute modification des données onchain se fait à travers des transactions envoyées aux programmes.

Une transaction sur Solana est similaire à une transaction ailleurs : elle est atomique. **Atomique signifie que la transaction entière s'exécute ou échoue**.

Pensez à payer quelque chose en ligne :

 - Le solde de votre compte est débité.
 - La banque transfère les fonds au commerçant.

Ces deux choses doivent se produire pour que la transaction réussisse. Si l'une d'entre elles échoue, il est préférable qu'aucune de ces choses ne se produise, plutôt que de payer le commerçant et de ne pas débiter votre compte, ou de débiter le compte mais de ne pas payer le commerçant.

Atomique signifie que la transaction se produit soit - si toutes les étapes individuelles réussissent - soit la transaction entière échoue.

## Les transactions contiennent des instructions

Les étapes au sein d'une transaction sur Solana sont appelées **instructions**.

Chaque instruction contient :

- un tableau de comptes qui seront lus et/ou écrits. C'est ce qui rend Solana rapide - les transactions qui affectent différents comptes sont traitées simultanément.
- la clé publique du programme à invoquer.
- les données transmises au programme invoqué, structurées comme un tableau d'octets.

Lorsqu'une transaction est exécutée, un ou plusieurs programmes Solana sont invoqués avec les instructions incluses dans la transaction.

Comme on peut s'y attendre, `@solana/web3.js` fournit des fonctions d'aide pour créer des transactions et des instructions. Vous pouvez créer une nouvelle transaction avec le constructeur `new Transaction()`. Une fois créée, vous pouvez ajouter des instructions à la transaction avec la méthode `add()`.

L'une de ces fonctions d'aide est `SystemProgram.transfer()`, qui crée une instruction pour que le `SystemProgram` transfère du SOL :

```typescript
const transaction = new Transaction()

const sendSolInstruction = SystemProgram.transfer({
  fromPubkey: sender,
  toPubkey: recipient,
  lamports: LAMPORTS_PER_SOL * amount
})

transaction.add(sendSolInstruction)
```

La fonction `SystemProgram.transfer()` nécessite :

- une clé publique correspondant au compte expéditeur.
- une clé publique correspondant au compte destinataire.
- le montant de SOL à envoyer en lamports.

`SystemProgram.transfer()` renvoie l'instruction pour envoyer du SOL de l'expéditeur au destinataire.

Le programme utilisé dans cette instruction sera le programme `system` (à l'adresse `11111111111111111111111111111111`), les données seront le montant de SOL à transférer (en lamports) et les comptes seront basés sur l'expéditeur et le destinataire.

L'instruction peut ensuite être ajoutée à la transaction.

Une fois que toutes les instructions ont été ajoutées, une transaction doit être envoyée au cluster et confirmée :

```typescript
const signature = sendAndConfirmTransaction(
  connection,
  transaction,
  [senderKeypair]
)
```

La fonction `sendAndConfirmTransaction()` prend comme paramètres

- une connexion au cluster,
- une transaction,
- un tableau de paires de clés qui agiront comme signataires sur la transaction - dans cet exemple, nous n'avons qu'un seul signataire : l'expéditeur.

## Les transactions ont des frais

Les frais de transaction sont intégrés à l'économie Solana comme compensation pour le réseau de validateurs pour les ressources CPU et GPU nécessaires au traitement des transactions. Les frais de transaction Solana sont déterministes.

Le premier signataire inclus dans le tableau des signataires d'une transaction est responsable du paiement des frais de transaction. Si ce signataire n'a pas assez de SOL sur son compte pour couvrir les frais de transaction, la transaction sera abandonnée avec une erreur du type :

```
> Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.
```

Si vous obtenez cette erreur, c'est parce que votre paire de clés est toute neuve et n'a pas de SOL pour couvrir les frais de transaction. Corrigeons cela en ajoutant les lignes suivantes juste après avoir configuré la connexion :

```typescript
await requestAndConfirmAirdropIfRequired(
  connection,
  keypair.publicKey,
  1 * LAMPORTS_PER_SOL,
  0.5 * LAMPORTS_PER_SOL,
);
```

Cela déposera 1 SOL sur votre compte que vous pouvez utiliser pour les tests. Cela ne fonctionnera pas sur Mainnet où il aurait une valeur réelle. Mais c'est incroyablement pratique pour les tests locaux et sur Devnet.

Vous pouvez également utiliser la commande CLI Solana `solana airdrop 1` pour obtenir gratuitement du SOL de test sur votre compte lors des tests, que ce soit en local ou sur devnet.

## Explorateur Solana

![Capture d'écran de l'explorateur Solana configuré sur Devnet](../assets/solana-explorer-devnet.png)

Toutes les transactions sur la blockchain sont visibles publiquement sur l'[explorateur Solana](http://explorer.solana.com). Par exemple, vous pourriez prendre la signature retournée par `sendAndConfirmTransaction()` dans l'exemple ci-dessus, rechercher cette signature dans l'explorateur Solana, puis voir :

- quand elle a eu lieu,
- dans quel bloc elle a été incluse,
- les frais de transaction,
- et plus encore !

![Capture d'écran de l'explorateur Solana avec des détails sur une transaction](../assets/solana-explorer-transaction-overview.png)

# Laboratoire

Nous allons créer un script `transfer.ts` pour envoyer du SOL à d'autres étudiants.

### 1. Structure de base

Nous commencerons par utiliser les mêmes packages et le fichier `.env` que nous avons créés précédemment dans [l'introduction à la cryptographie](./intro-to-cryptography).

```typescript
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers"
import web3 from "@solana/web3.js";
import "dotenv/config";
```

### 2. Créer une connexion

Créons une connexion :

```typescript
const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

### 3. Programme Ping
Créez maintenant une fonction asynchrone appelée `pingProgram()` avec deux paramètres nécessitant une connexion et la paire de clés du payeur en tant qu'arguments :

```typescript
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) { }
```

À l'intérieur de cette fonction, nous devons :

1. créer une transaction
2. créer une instruction
3. ajouter l'instruction à la transaction
4. envoyer la transaction.

N'oubliez pas, la partie la plus difficile ici est d'inclure les bonnes informations dans l'instruction. Nous connaissons l'adresse du programme que nous appelons. Nous savons également que le programme écrit des données dans un compte séparé dont nous avons également l'adresse. Ajoutons les versions chaînes de ces deux éléments en tant que constantes en haut du fichier `transfer.ts` :

```typescript
const PING_PROGRAM_ADDRESS = new web3.PublicKey('ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa')
const PING_PROGRAM_DATA_ADDRESS =  new web3.PublicKey('Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod')
```

Maintenant, dans la fonction `pingProgram()`, créons une nouvelle transaction, puis initialisons une `PublicKey` pour le compte du programme, et une autre pour le compte de données.

```tsx
async function pingProgram(
  connection: web3.Connection,
  payer: web3.Keypair
) {
    const transaction = new web3.Transaction()
    const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
    const programDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)
}
```

### Créer la transaction et l'exécuter

```typescript
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const programDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: programDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})
```

Ensuite, ajoutons l'instruction à la transaction que nous avons créée. Ensuite, appelons `sendAndConfirmTransaction()` en passant la connexion, la transaction et le payeur. Enfin, loguons le résultat de cet appel de fonction afin que nous puissions le rechercher sur l'explorateur Solana.

```typescript
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const programDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: programDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})

transaction.add(instruction)

const signature = await web3.sendAndConfirmTransaction(
  connection,
  transaction,
  [payer]
)

console.log(`Signature: ${signature}`);
```

### 4. Exécuter le programme
Appelez maintenant la fonction `pingProgram()` 

```typescript
try {
  const payer = getKeypairFromEnvironment("SECRET_KEY");
  console.log(` ✅ Paire de clés du payeur chargée : ${payer.publicKey.toBase58()}`);

  await pingProgram(connection, payer);
} catch (err) {
  console.error(err);
}
```

### 5. Vérifier l'explorateur Solana

Exécutez maintenant à nouveau le code.

```
npx esrun transfer.ts (adresse du portefeuille de destination)
```

Cela peut prendre un moment, mais maintenant le code devrait fonctionner et vous devriez voir une longue chaîne imprimée dans la console, comme ci-dessous :

```
 ✅ Paire de clés du payeur chargée : E19JjB2TgbksiLEbtoX8d8F843GmsPUz3Kd974duoxTU
Signature: 27xWGp5wbs6QyoiMTF5J1WWLQf7J5iTUDN2T1gSENxu2KSKyfWAPKYcPqydwJbkBVMEuZPEuEGcmJze3GG87T3jt
```

# Défi

Répondez aux questions suivantes :

 - Combien de SOL a pris le transfert ? Quelle est cette somme en USD ?

 - Pouvez-vous trouver votre transaction sur https://explorer.solana.com ? Rappelez-vous que nous utilisons le réseau `devnet`.

 - Combien de temps prend le transfert ?

 - Que pensez-vous que "confirmé" signifie ?

## Avez-vous terminé le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=dda6b8de-9ed8-4ed2-b1a5-29d7a8a8b415) !
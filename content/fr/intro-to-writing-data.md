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

Nous allons créer un script pour envoyer du SOL à d'autres étudiants.

### 1. Structure de base

Nous commencerons par utiliser les mêmes packages et le fichier `.env` que nous avons créés précédemment dans [l'introduction à la cryptographie](./intro-to-cryptography).

Créez un fichier `transfer.ts`:

```typescript
import {
  Connection,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import "dotenv/config"
import { getKeypairFromEnvironment } from "@solana-developers/helpers";

const suppliedToPubkey = process.argv[2] || null;

if (!suppliedToPubkey) {
  console.log(`Please provide a public key to send to`);
  process.exit(1);
}

const senderKeypair = getKeypairFromEnvironment("SECRET_KEY");

console.log(`suppliedToPubkey: ${suppliedToPubkey}`);

const toPubkey = new PublicKey(suppliedToPubkey);

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

console.log(
  `✅ Loaded our own keypair, the destination public key, and connected to Solana`
);
```

Lancer le script pour vérifier qu'il se connecte bien et charge votre paire de clés :

```bash
npx esrun transfer.ts (destination wallet address)
```

### Créer la transaction et l'exécuter

Ajoutez le code suivant pour compléter la transaction et l'envoyer :

```typescript
console.log(
  `✅ Loaded our own keypair, the destination public key, and connected to Solana`
);

const transaction = new Transaction();

const LAMPORTS_TO_SEND = 5000;

const sendSolInstruction = SystemProgram.transfer({
  fromPubkey: senderKeypair.publicKey,
  toPubkey,
  lamports: LAMPORTS_TO_SEND,
});

transaction.add(sendSolInstruction);

const signature = await sendAndConfirmTransaction(connection, transaction, [
  senderKeypair,
]);

console.log(
  `💸 Finished! Sent ${LAMPORTS_TO_SEND} to the address ${toPubkey}. `
);
console.log(`Transaction signature is ${signature}!`);
```

### Testez!

Envoyez du SOL aux autres étudiants de la classe.

```bash
npx esrun transfer.ts (destination wallet address)
```

# Défi

Répondez aux questions suivantes :

 - Combien de SOL a pris le transfert ? Quelle est cette somme en USD ?

 - Pouvez-vous trouver votre transaction sur https://explorer.solana.com ? Rappelez-vous que nous utilisons le réseau `devnet`.

 - Combien de temps prend le transfert ?

 - Que pensez-vous que "confirmé" signifie ?

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=dda6b8de-9ed8-4ed2-b1a5-29d7a8a8b415) !
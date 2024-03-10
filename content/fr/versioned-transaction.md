---
title: Transactions versionnées et tables de recherche
objectives:
- Créer des transactions versionnées
- Créer des tables de recherche
- Étendre les tables de recherche
- Utiliser les tables de recherche avec des transactions versionnées
---

# Résumé

-   Les **transactions versionnées** désignent une méthode pour prendre en charge à la fois les versions héritées et les nouvelles versions des formats de transaction. Le format de transaction original est "hérité" et les nouvelles versions de transactions commencent à la version 0. Les transactions versionnées ont été mises en œuvre afin de prendre en charge l'utilisation des Tables de Recherche d'Adresse (également appelées tables de recherche ou LUT pour "lookup tables").
-   Les **Tables de Recherche d'Adresse** sont des comptes utilisés pour stocker les adresses d'autres comptes, qui peuvent ensuite être référencées dans des transactions versionnées à l'aide d'un index d'1 octet au lieu des 32 octets complets par adresse. Cela permet la création de transactions plus complexes qu'il n'était possible avant l'introduction des LUT.

# Aperçu général

Par conception, les transactions Solana sont limitées à 1232 octets. Les transactions dépassant cette taille échoueront. Bien que cela permette un certain nombre d'optimisations réseau, cela peut également limiter les types d'opérations atomiques pouvant être effectuées sur le réseau.

Pour contourner la limite de taille des transactions, Solana a publié un nouveau format de transaction qui permet de prendre en charge plusieurs versions de formats de transaction. Au moment de la rédaction, Solana prend en charge deux versions de transaction :

1. `legacy` - le format de transaction d'origine
2. `0` - le dernier format de transaction qui inclut la prise en charge des Tables de Recherche d'Adresse

Les transactions versionnées ne nécessitent aucune modification des programmes Solana existants, mais tout code côté client créé avant la sortie des transactions versionnées doit être mis à jour. Dans cette leçon, nous aborderons les bases des transactions versionnées et comment les utiliser, y compris :

-   Créer des transactions versionnées
-   Créer et gérer des tables de recherche
-   Utiliser des tables de recherche dans des transactions versionnées

## Transactions Versionnées

L'un des éléments qui occupe le plus d'espace dans les transactions Solana est l'inclusion des adresses de compte complètes. À 32 octets chacune, 39 comptes rendront une transaction trop grande. Cela ne tient même pas compte des données d'instruction. En pratique, la plupart des transactions seront trop grandes avec environ 20 comptes.

Solana a publié des transactions versionnées pour prendre en charge plusieurs formats de transaction. Parallèlement à la sortie des transactions versionnées, Solana a publié la version 0 des transactions pour prendre en charge les Tables de Recherche d'Adresse. Les tables de recherche sont des comptes distincts qui stockent les adresses des comptes, puis permettent de les référencer dans une transaction à l'aide d'un index d'1 octet. Cela réduit considérablement la taille d'une transaction, car chaque compte inclus n'a désormais besoin que de 1 octet au lieu de 32 octets.

Même si vous n'avez pas besoin d'utiliser des tables de recherche, vous devrez savoir comment prendre en charge les transactions versionnées dans votre code côté client. Heureusement, tout ce dont vous avez besoin pour travailler avec les transactions versionnées et les tables de recherche est inclus dans la bibliothèque `@solana/web3.js`.

### Créer une transaction versionnée

Pour créer une transaction versionnée, il vous suffit de créer un `TransactionMessage` avec les paramètres suivants :

-   `payerKey` - la clé publique du compte qui paiera la transaction
-   `recentBlockhash` - un récent blockhash du réseau
-   `instructions` - les instructions à inclure dans la transaction

Vous transformez ensuite cet objet de message en une transaction de version `0` à l'aide de la méthode `compileToV0Message()`.

```typescript
import * as web3 from "@solana/web3.js";

// Exemple d'instruction de transfert
const transferInstruction = [
    web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey, // Clé publique du compte qui enverra les fonds
        toPubkey: toAccount.publicKey, // Clé publique du compte qui recevra les fonds
        lamports: 1 * LAMPORTS_PER_SOL, // Montant de lamports à transférer
    }),
];

// Obtenez le dernier blockhash
let { blockhash } = await connection.getLatestBlockhash();

// Créer le message de transaction
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Clé publique du compte qui paiera la transaction
    recentBlockhash: blockhash, // Dernier blockhash
    instructions: transferInstruction, // Instructions incluses dans la transaction
}).compileToV0Message();
```

Enfin, passez le message compilé dans le constructeur `VersionedTransaction` pour créer une nouvelle transaction versionnée. Votre code peut ensuite signer et envoyer la transaction au réseau, similaire à une transaction héritée.

```typescript
// Créer la transaction versionnée en utilisant le message
const transaction = new web3.VersionedTransaction(message);

// Signer la transaction
transaction.sign([payer]);

// Envoyer la transaction signée au réseau
const transactionSignature = await connection.sendTransaction(transaction);
```

## Table de Recherche d'Adresse

Les Tables de Recherche d'Adresse (également appelées tables de recherche ou LUT) sont des comptes qui stockent une table de recherche d'adresses d'autres comptes. Ces comptes LUT sont détenus par le programme Table de Recherche d'Adresse (Address Lookup Table) et sont utilisés pour augmenter le nombre de comptes pouvant être inclus dans une seule transaction.

Les transactions versionnées peuvent inclure l'adresse d'un compte LUT, puis référencer des comptes supplémentaires avec un index d'1 octet au lieu d'inclure l'adresse complète de ces comptes. Cela réduit considérablement l'espace utilisé pour référencer des comptes dans une transaction.

Pour simplifier le processus de travail avec les LUT, la bibliothèque `@solana/web3.js` inclut une classe `AddressLookupTableProgram` qui fournit un ensemble de méthodes pour créer des instructions pour gérer les LUT. Ces méthodes comprennent :

-   `createLookupTable` - crée un nouveau compte LUT
-   `freezeLookupTable` - rend un LUT existant immuable
-   `extendLookupTable` - ajoute des adresses à un LUT existant
-   `deactivateLookupTable` - met un LUT en période de "désactivation" avant qu'il ne puisse être fermé
-   `closeLookupTable` - ferme définitivement un compte LUT

### Créer une table de recherche

Vous utilisez la méthode `createLookupTable` pour construire l'instruction qui crée une table de recherche. La fonction nécessite les paramètres suivants :

-   `authority` - le compte qui aura l'autorisation de modifier la table de recherche
-   `payer` - le compte qui paiera la création du compte
-   `recentSlot` - un slot récent pour dériver l'adresse de la table de recherche

La fonction retourne à la fois l'instruction pour créer la table de recherche et l'adresse de la table de recherche.

```typescript
// Obtenez le slot actuel
const slot = await connection.getSlot();

// Créer une instruction pour créer une table de recherche
// et récupérer l'adresse de la nouvelle table de recherche
const [lookupTableInst, lookupTableAddress] =
    web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // L'autorité (c'est-à-dire, le compte autorisé à modifier la table de recherche)
        payer: user.publicKey, // Le payeur (c'est-à-dire, le compte qui paiera les frais de transaction)
        recentSlot: slot - 1, // Le slot récent pour dériver l'adresse de la table de recherche
    });
```

Sous-jacent, l'adresse de la table de recherche n'est rien d'autre qu'une PDA dérivée en utilisant l'`authority` et le `recentSlot` comme seeds.

```typescript
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

Notez que l'utilisation du slot le plus récent entraîne parfois une erreur après l'envoi de la transaction. Pour éviter cela, vous pouvez utiliser un slot qui est un slot avant le plus récent (par exemple, `recentSlot: slot - 1`). Cependant, si vous rencontrez toujours une erreur lors de l'envoi de la transaction, vous pouvez essayer de renvoyer la transaction.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"188115589 is not a recent slot",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### Étendre une table de recherche

Vous utilisez la méthode `extendLookupTable` pour créer une instruction qui ajoute des adresses à une table de recherche existante. Elle prend les paramètres suivants :

-   `payer` - le compte qui paiera les frais de transaction et tout loyer augmenté
-   `authority` - le compte qui a l'autorisation de modifier la table de recherche
-   `lookupTable` - l'adresse de la table de recherche à étendre
-   `addresses` - les adresses à ajouter à la table de recherche

La fonction retourne une instruction pour étendre la table de recherche.

```typescript
const addresses = [
    new web3.PublicKey("31Jy3nFeb5hKVdB4GS4Y7MhU7zhNMFxwF7RGVhPc1TzR"),
    new web3.PublicKey("HKSeapcvwJ7ri6mf3HwBtspLFTDKqaJrMsozdfXfg5y2"),
    // ajoutez plus d'adresses
];

// Créer une instruction pour étendre une table de recherche avec les adresses fournies
const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
    payer: user.publicKey, // Le payeur (c'est-à-dire, le compte qui paiera les frais de transaction)
    authority: user.publicKey, // L'autorité (c'est-à-dire, le compte autorisé à modifier la table de recherche)
    lookupTable: lookupTableAddress, // L'adresse de la table de recherche à étendre
    addresses: addresses, // Les adresses à ajouter à la table de recherche
});
```

Notez que lors de l'extension d'une table de recherche, le nombre d'adresses pouvant être ajoutées en une instruction est limité par la limite de taille de transaction, qui est de 1232 octets. Cela signifie que vous pouvez ajouter 30 adresses à une table de recherche à la fois. Si vous avez besoin d'en ajouter plus que cela, vous devrez envoyer plusieurs transactions. Chaque table de recherche peut stocker un maximum de 256 adresses.

### Envoyer une transaction

Après avoir créé les instructions, vous pouvez les ajouter à une transaction et les envoyer au réseau.

```typescript
// Obtenez le dernier blockhash
let { blockhash } = await connection.getLatestBlockhash();

// Créer le message de transaction
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Clé publique du compte qui paiera la transaction
    recentBlockhash: blockhash, // Dernier blockhash
    instructions: [lookupTableInst, extendInstruction], // Instructions incluses dans la transaction
}).compileToV0Message();

// Créer la transaction versionnée en utilisant le message
const transaction = new web3.VersionedTransaction(message);

// Signer la transaction
transaction.sign([payer]);

// Envoyer la transaction signée au réseau
const transactionSignature = await connection.sendTransaction(transaction);
```

Notez que lorsque vous créez ou étendez une table de recherche pour la première fois, elle doit "s'échauffer" pendant un slot avant que la LUT ou les nouvelles adresses puissent être utilisées dans des transactions. En d'autres termes, vous ne pouvez utiliser que des tables de recherche et accéder à des adresses qui ont été ajoutées avant le slot actuel.

```typescript
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

Si vous rencontrez l'erreur ci-dessus ou si vous ne parvenez pas à accéder aux adresses dans une table de recherche immédiatement après l'avoir étendue, c'est probablement parce que vous essayez d'accéder à la table de recherche ou à une adresse spécifique avant la fin de la période de chauffe. Pour éviter ce problème, ajoutez un délai après avoir étendu la table de recherche avant d'envoyer une transaction qui la référence.

### Désactiver une table de recherche

Lorsqu'une table de recherche n'est plus nécessaire, vous pouvez la désactiver et la fermer pour récupérer son solde de loyer. Les tables de recherche peuvent être désactivées à tout moment, mais elles peuvent continuer à être utilisées par des transactions jusqu'à ce qu'un "slot de désactivation" spécifié ne soit plus "récent". Cette période de "refroidissement" garantit que les transactions en cours ne peuvent pas être censurées par des tables de recherche fermées et recréées dans le même slot. La période de désactivation est d'environ 513 slots.

Pour désactiver une LUT, utilisez la méthode `deactivateLookupTable` et passez les paramètres suivants :

-   `lookupTable` - l'adresse de la LUT à désactiver
-   `authority` - le compte autorisé à désactiver la LUT

```typescript
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress, // L'adresse de la table de recherche à désactiver
        authority: user.publicKey, // L'autorité (c'est-à-dire, le compte autorisé à modifier la table de recherche)
    });
```

### Fermer une table de recherche

Pour fermer une table de recherche après sa période de désactivation, utilisez la méthode `closeLookupTable`. Cette méthode crée une instruction pour fermer une table de recherche désactivée et récupérer son solde de loyer. Elle prend les paramètres suivants :

-   `lookupTable` - l'adresse de la LUT à fermer
-   `authority` - le compte autorisé à fermer la LUT
-   `recipient` - le compte qui recevra le solde de loyer récupéré

```typescript
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress, // L'adresse de la table de recherche à fermer
    authority: user.publicKey, // L'autorité (c'est-à-dire, le compte autorisé à modifier la table de recherche)
    recipient: user.publicKey, // Le destinataire des lamports du compte fermé
});
```

Tenter de fermer une table de recherche avant qu'elle ne soit complètement désactivée entraînera une erreur.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Table cannot be closed until it's fully deactivated in 513 blocks",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### Geler une table de recherche

En plus des opérations CRUD standard, vous pouvez "geler" une table de recherche. Cela la rend immuable de sorte qu'elle ne peut plus être étendue, désactivée ou fermée.

Vous geler une table de recherche avec la méthode `freezeLookupTable`. Elle prend les paramètres suivants :

-   `lookupTable` - l'adresse de la LUT à geler
-   `authority` - le compte autorisé à geler la LUT

```typescript
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // L'adresse de la table de recherche à geler
    authority: user.publicKey, // L'autorité (c'est-à-dire, le compte autorisé à modifier la table de recherche)
});
```

Une fois qu'une LUT est gelée, toute tentative ultérieure de la modifier entraînera une erreur.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Lookup table is frozen",
"Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### Utiliser des tables de recherche dans des transactions versionnées

Pour utiliser une table de recherche dans une transaction versionnée, vous devez récupérer le compte de la table de recherche en utilisant son adresse.

```typescript
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

Vous pouvez ensuite créer une liste d'instructions à inclure dans une transaction comme d'habitude. Lors de la création du `TransactionMessage`, vous pouvez inclure tous les comptes de table de recherche en les passant comme un tableau à la méthode `compileToV0Message()`. Vous pouvez également fournir plusieurs comptes de table de recherche.

```typescript
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Le payeur (c'est-à-dire, le compte qui paiera les frais de transaction)
    recentBlockhash: blockhash, // Le blockhash du bloc le plus récent
    instructions: instructions, // Les instructions à inclure dans la transaction
}).compileToV0Message([lookupTableAccount]); // Inclure les comptes de table de recherche

// Crée la transaction versionnée en utilisant le message
const transaction = new web3.VersionedTransaction(message);

// Signe la transaction
transaction.sign([payer]);

// Envoie la transaction signée au réseau
const transactionSignature = await connection.sendTransaction(transaction);
```

# Laboratoire

Allons-y et pratiquons l'utilisation des tables de recherche (lookup tables) !

Ce laboratoire vous guidera à travers les étapes de création, d'extension, puis d'utilisation d'une table de recherche dans une transaction versionnée.

### 1. Obtenez le code de départ

Pour commencer, téléchargez le code de départ à partir de la branche de démarrage de ce [dépôt](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/starter). Une fois que vous avez le code de départ, exécutez `npm install` dans le terminal pour installer les dépendances requises.

Le code de départ comprend un exemple de création d'une transaction héritée qui vise à transférer atomiquement des SOL à 22 destinataires. La transaction contient 22 instructions où chaque instruction transfère des SOL du signataire à un destinataire différent.

Le but du code de départ est d'illustrer la limitation sur le nombre d'adresses pouvant être incluses dans une transaction héritée. La transaction construite dans le code de départ est censée échouer lorsqu'elle est envoyée.

Le code de départ suivant peut être trouvé dans le fichier `index.ts`.

```typescript
import { initializeKeypair } from "./initializeKeypair";
import * as web3 from "@solana/web3.js";

async function main() {
    // Se connecter à la grappe devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialiser la paire de clés de l'utilisateur
    const user = await initializeKeypair(connection);
    console.log("Clé publique :", user.publicKey.toBase58());

    // Générer 22 adresses
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    // Créer un tableau d'instructions de transfert
    const transferInstructions = [];

    // Ajouter une instruction de transfert pour chaque adresse
    for (const address of recipients) {
        transferInstructions.push(
            web3.SystemProgram.transfer({
                fromPubkey: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
                toPubkey: address, // Le compte de destination pour le transfert
                lamports: web3.LAMPORTS_PER_SOL * 0.01, // Le montant de lamports à transférer
            }),
        );
    }

    // Créer une transaction et ajouter les instructions de transfert
    const transaction = new web3.Transaction().add(...transferInstructions);

    // Envoyer la transaction à la grappe (cela échouera dans cet exemple si le nombre d'adresses > 21)
    const txid = await connection.sendTransaction(transaction, [user]);

    // Obtenir le dernier hachage de bloc et la dernière hauteur de bloc valide
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Confirmer la transaction
    await connection.confirmTransaction({
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        signature: txid,
    });

    // Log l'URL de la transaction sur le Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

Pour exécuter le code, exécutez `npm start`. Cela créera une nouvelle paire de clés, l'écrira dans le fichier `.env`, déposera des SOL de devnet à la paire de clés et enverra la transaction construite dans le code de départ. La transaction est censée échouer avec le message d'erreur `Transaction too large`.

```
Creating .env file
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: 5ZZzcDbabFHmoZU8vm3VzRzN5sSQhkf91VJzHAJGNM7B
Error: Transaction too large: 1244 > 1232
```

Dans les prochaines étapes, nous verrons comment utiliser les tables de recherche avec des transactions versionnées pour augmenter le nombre d'adresses pouvant être incluses dans une seule transaction.

Avant de commencer, allez-y et supprimez le contenu de la fonction `main` pour ne laisser que ce qui suit :

```typescript
async function main() {
    // Se connecter à la grappe devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialiser la paire de clés de l'utilisateur
    const user = await initializeKeypair(connection);
    console.log("Clé publique :", user.publicKey.toBase58());

    // Générer 22 adresses
    const addresses = [];
    for (let i = 0; i < 22; i++) {
        addresses.push(web3.Keypair.generate().publicKey);
    }
}
```

### 2. Créez une fonction d'aide `sendV0Transaction`

Nous enverrons plusieurs transactions "version 0", alors créons une fonction d'aide pour faciliter cela.

Cette fonction doit prendre des paramètres pour une connexion, une paire de clés utilisateur, un tableau d'instructions de transaction et éventuellement un tableau facultatif de comptes de tables de recherche.

La fonction effectue ensuite les tâches suivantes :

- Récupère le dernier hash de bloc et la dernière hauteur de bloc valide de la blockchain Solana.
- Crée un nouveau message de transaction en utilisant les instructions fournies.
- Signe la transaction en utilisant la paire de clés de l'utilisateur.
- Envoie la transaction au réseau Solana.
- Confirme la transaction.
- Journalise l'URL de la transaction sur l'explorateur Solana.

```typescript
async function sendV0Transaction(
    connection: web3.Connection,
    user: web3.Keypair,
    instructions: web3.TransactionInstruction[],
    lookupTableAccounts?: web3.AddressLookupTableAccount[],
) {
    // Obtenir le dernier hachage de bloc et la dernière hauteur de bloc valide
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Créer un nouveau message de transaction avec les instructions fournies
    const messageV0 = new web3.TransactionMessage({
        payerKey: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
        recentBlockhash: blockhash, // Le hachage de bloc du bloc le plus récent
        instructions, // Les instructions à inclure dans la transaction
    }).compileToV0Message(
        lookupTableAccounts ? lookupTableAccounts : undefined,
    );

    // Créer un nouvel objet transaction avec le message
    const transaction = new web3.VersionedTransaction(messageV0);

    // Signer la transaction avec la paire de clés de l'utilisateur
    transaction.sign([user]);

    // Envoyer la transaction au cluster
    const txid = await connection.sendTransaction(transaction);

    // Confirmer la transaction
    await connection.confirmTransaction(
        {
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            signature: txid,
        },
        "finalized",
    );

    // Enregistrer l'URL de la transaction sur le Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

### 3. Créez une fonction d'aide `waitForNewBlock`

Rappelez-vous que les tables de recherche et les adresses qu'elles contiennent ne peuvent pas être référencées immédiatement après leur création ou extension. Cela signifie que nous devrons attendre un nouveau bloc avant de soumettre des transactions qui font référence à la table de recherche nouvellement créée ou étendue. Pour simplifier cela à l'avenir, créons une fonction d'aide `waitForNewBlock` que nous utiliserons pour attendre que les tables de recherche soient activées entre l'envoi de transactions.

Cette fonction aura des paramètres pour une connexion et une hauteur de bloc cible. Elle lance ensuite un intervalle qui vérifie la hauteur de bloc actuelle du réseau toutes les 1000 ms. Une fois que la nouvelle hauteur de bloc dépasse la hauteur cible, l'intervalle est effacé et la promesse est résolue.

```typescript
function waitForNewBlock(connection: web3.Connection, targetHeight: number) {
    console.log(`En attente de ${targetHeight} nouveaux blocs`);
    return new Promise(async (resolve: any) => {
        // Obtenir la hauteur du dernier bloc valide de la blockchain
        const { lastValidBlockHeight } = await connection.getLatestBlockhash();

        // Définir un intervalle pour vérifier les nouveaux blocs toutes les 1000ms
        const intervalId = setInterval(async () => {
            // Obtenir la nouvelle hauteur du bloc valide
            const { lastValidBlockHeight: newValidBlockHeight } =
                await connection.getLatestBlockhash();
            // console.log(newValidBlockHeight)

            // Vérifier si la nouvelle hauteur du bloc valide est supérieure à la hauteur cible du bloc
            if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
                // Si la hauteur cible du bloc est atteinte, effacer l'intervalle et résoudre la promesse
                clearInterval(intervalId);
                resolve();
            }
        }, 1000);
    });
}
```

### 4. Créez une fonction `initializeLookupTable`

Maintenant que nous avons quelques fonctions d'aide prêtes à l'emploi, déclarez une fonction nommée `initializeLookupTable`. Cette fonction a pour paramètres `user`, `connection` et `addresses`. La fonction effectuera les actions suivantes :

1. Récupérer l'horodatage actuel.
2. Générer une instruction pour créer une table de recherche.
3. Générer une instruction pour étendre la table de recherche avec les adresses fournies.
4. Envoyer et confirmer une transaction avec les instructions de création et d'extension de la table de recherche.
5. Retourner l'adresse de la table de recherche.

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Obtenir le slot actuel
    const slot = await connection.getSlot();

    // Créer une instruction pour la création d'une table de recherche
    // et récupérer l'adresse de la nouvelle table de recherche
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // L'autorité (c'est-à-dire le compte ayant l'autorisation de modifier la table de recherche)
            payer: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
            recentSlot: slot - 1, // Le slot récent pour dériver l'adresse de la table de recherche
        });
    console.log("adresse de la table de recherche :", lookupTableAddress.toBase58());

    // Créer une instruction pour étendre une table de recherche avec les adresses fournies
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
        authority: user.publicKey, // L'autorité (c'est-à-dire le compte ayant l'autorisation de modifier la table de recherche)
        lookupTable: lookupTableAddress, // L'adresse de la table de recherche à étendre
        addresses: addresses.slice(0, 30), // Les adresses à ajouter à la table de recherche
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    return lookupTableAddress;
}
```

### 5. Modifiez `main` pour utiliser les tables de recherche

Maintenant que nous pouvons initialiser une table de recherche avec toutes les adresses des destinataires, mettons à jour `main` pour utiliser des transactions versionnées et des tables de recherche. Nous devrons :

1. Appeler `initializeLookupTable`.
2. Appeler `waitForNewBlock`.
3. Obtenir la table de recherche en utilisant `connection.getAddressLookupTable`.
4. Créer l'instruction de transfert pour chaque destinataire.
5. Envoyer la transaction v0 avec toutes les instructions de transfert.

```typescript
async function main() {
    // Se connecter à la cluster devnet
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialiser la paire de clés de l'utilisateur
    const user = await initializeKeypair(connection);
    console.log("Clé publique :", user.publicKey.toBase58());

    // Générer 22 adresses
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    const lookupTableAddress = await initializeLookupTable(
        user,
        connection,
        recipients,
    );

    await waitForNewBlock(connection, 1);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    if (!lookupTableAccount) {
        throw new Error("Table de recherche introuvable");
    }

    const transferInstructions = recipients.map((recipient) => {
        return web3.SystemProgram.transfer({
            fromPubkey: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
            toPubkey: recipient, // Le compte de destination pour le transfert
            lamports: web3.LAMPORTS_PER_SOL * 0.01, // La quantité de lamports à transférer
        });
    });

    await sendV0Transaction(connection, user, transferInstructions, [
        lookupTableAccount,
    ]);
}
```

Remarquez que vous créez les instructions de transfert avec l'adresse complète du destinataire même si nous avons créé une table de recherche. Cela est dû au fait qu'en incluant la table de recherche dans la transaction versionnée, vous indiquez au framework `web3.js` de remplacer toutes les adresses de destinataires qui correspondent aux adresses dans la table de recherche par des pointeurs vers la table de recherche. Au moment où la transaction est envoyée au réseau, les adresses qui existent dans la table de recherche seront référencées par un seul octet au lieu des 32 octets complets.

Utilisez `npm start` dans la ligne de commande pour exécuter la fonction `main`. Vous devriez voir une sortie similaire à ce qui suit :

```bash
Current balance is 1.38866636
PublicKey: 8iGVBt3dcJdp9KfyTRcKuHY6gXCMFdnSG2F1pAwsUTMX
lookup table address: Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M
https://explorer.solana.com/tx/4JvCo2azy2u8XK2pU8AnJiHAucKTrZ6QX7EEHVuNSED8B5A8t9GqY5CP9xB8fZpTNuR7tbUcnj2MiL41xRJnLGzV?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/rgpmxGU4QaAXw9eyqfMUqv8Lp6LHTuTyjQqDXpeFcu1ijQMmCH2V3Sb54x2wWAbnWXnMpJNGg4eLvuy3r8izGHt?cluster=devnet
Finished successfully
```

Le premier lien de transaction dans la console représente la transaction de création et d'extension de la table de recherche. La deuxième transaction représente les transferts à tous les destinataires. N'hésitez pas à inspecter ces transactions dans l'explorateur.

N'oubliez pas, cette même transaction échouait lorsque vous avez téléchargé le code de départ. Maintenant que nous utilisons des tables de recherche, nous pouvons effectuer les 22 transferts en une seule transaction.

### 6. Ajoutez plus d'adresses à la table de recherche

Gardez à l'esprit que la solution que nous avons trouvée jusqu'à présent prend en charge uniquement les transferts jusqu'à 30 comptes puisque nous n'étendons la table de recherche qu'une seule fois. Lorsque vous prenez en compte la taille de l'instruction de transfert, il est en fait possible d'étendre la table de recherche avec 27 adresses supplémentaires et de réaliser un transfert atomique vers jusqu'à 57 destinataires. Allons-y et ajoutons cette prise en charge maintenant !

Tout ce que nous avons à faire est d'entrer dans `initializeLookupTable` et de faire deux choses :

1. Modifier l'appel existant à `extendLookupTable` pour n'ajouter que les 30 premières adresses (sinon la transaction sera trop grande).
2. Ajouter une boucle qui continuera d'étendre une table de recherche par 30 adresses à la fois jusqu'à ce que toutes les adresses aient été ajoutées.

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Obtenir le slot actuel
    const slot = await connection.getSlot();

    // Créer une instruction pour la création d'une table de recherche
    // et récupérer l'adresse de la nouvelle table de recherche
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // L'autorité (c'est-à-dire le compte ayant la permission de modifier la table de recherche)
            payer: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
            recentSlot: slot - 1, // Le slot récent pour dériver l'adresse de la table de recherche
        });
    console.log("adresse de la table de recherche:", lookupTableAddress.toBase58());

    // Créer une instruction pour étendre une table de recherche avec les adresses fournies
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
        authority: user.publicKey, // L'autorité (c'est-à-dire le compte ayant la permission de modifier la table de recherche)
        lookupTable: lookupTableAddress, // L'adresse de la table de recherche à étendre
        addresses: addresses.slice(0, 30), // Les adresses à ajouter à la table de recherche
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    var remaining = addresses.slice(30);

    while (remaining.length > 0) {
        const toAdd = remaining.slice(0, 30);
        remaining = remaining.slice(30);
        const extendInstruction =
            web3.AddressLookupTableProgram.extendLookupTable({
                payer: user.publicKey, // Le payeur (c'est-à-dire le compte qui paiera les frais de transaction)
                authority: user.publicKey, // L'autorité (c'est-à-dire le compte ayant la permission de modifier la table de recherche)
                lookupTable: lookupTableAddress, // L'adresse de la table de recherche à étendre
                addresses: toAdd, // Les adresses à ajouter à la table de recherche
            });

        await sendV0Transaction(connection, user, [extendInstruction]);
    }

    return lookupTableAddress;
}
```

Félicitations ! Si vous vous sentez bien avec ce laboratoire, vous êtes probablement prêt à travailler avec les tables de recherche et les transactions versionnées par vous-même. Si vous souhaitez jeter un coup d'œil au code de solution final, vous pouvez le [trouver sur la branche solution](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/solution).

# Défi

En guise de défi, expérimentez avec la désactivation, la fermeture et la congélation des tables de recherche. N'oubliez pas que vous devez attendre qu'une table de recherche ait fini de se désactiver avant de pouvoir la fermer. De plus, si une table de recherche est gelée, elle ne peut pas être modifiée (désactivée ou fermée), donc vous devrez tester séparément ou utiliser des tables de recherche distinctes.

1. Créez une fonction pour désactiver la table de recherche.
2. Créez une fonction pour fermer la table de recherche.
3. Créez une fonction pour geler la table de recherche.
4. Testez les fonctions en les appelant dans la fonction `main()`.

Vous pouvez réutiliser les fonctions que nous avons créées dans le laboratoire pour envoyer la transaction et attendre que la table de recherche s'active/désactive. N'hésitez pas à vous référer à ce [code de solution](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=b58fdd00-2b23-4e0d-be55-e62677d351ef) !
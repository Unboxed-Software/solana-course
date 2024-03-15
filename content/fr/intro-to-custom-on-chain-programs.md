---
title: Utilisation de programmes personnalisés onchain
objectives:
- Créer des transactions pour des programmes onchain personnalisés
---

# Résumé

Solana dispose de plusieurs programmes onchain que vous pouvez utiliser. Les instructions utilisant ces programmes doivent avoir des données dans un format personnalisé déterminé par le programme.

# Aperçu général
### Instructions

Dans les chapitres précédents, nous avons utilisé la fonction `SystemProgram.transfer()` pour créer une instruction afin d'envoyer des SOL. 

Cependant, lors de la manipulation de programmes non natifs, vous devrez être plus spécifique dans la création d'instructions structurées pour correspondre au programme correspondant.

Avec `@solana/web3.js`, vous pouvez créer des instructions non natives avec le constructeur `TransactionInstruction`. Ce constructeur prend un seul argument du type `TransactionInstructionCtorFields`.

```typescript
export type TransactionInstructionCtorFields = {
  keys: Array<AccountMeta>;
  programId: PublicKey;
  data?: Buffer;
};
```

Conformément à la définition ci-dessus, l'objet passé au constructeur `TransactionInstruction` nécessite :

- un tableau de clés de type `AccountMeta`
- la clé publique du programme appelé
- un optionnel `Buffer` contenant des données à transmettre au programme.

Nous ignorerons le champ `data` pour l'instant et y reviendrons dans une leçon future.

Le champ `programId` est assez explicite : il s'agit de la clé publique associée au programme. Vous devrez la connaître à l'avance pour appeler le programme de la même manière que vous auriez besoin de connaître la clé publique de quelqu'un à qui vous voulez envoyer des SOL.

Le tableau `keys` nécessite une explication plus détaillée. Chaque objet dans ce tableau représente un compte qui sera lu ou écrit lors de l'exécution d'une transaction. Cela signifie que vous devez connaître le comportement du programme que vous appelez et vous assurer de fournir tous les comptes nécessaires dans le tableau.

Chaque objet dans le tableau `keys` doit inclure ce qui suit :
- `pubkey` - la clé publique du compte
- `isSigner` - un booléen représentant si le compte est ou non un signataire de la transaction
- `isWritable` - un booléen représentant si le compte est ou non écrit lors de l'exécution de la transaction

En mettant tout cela ensemble, nous pourrions obtenir quelque chose comme ce qui suit :

```typescript
const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: programDataAccount,
      isSigner: false,
      isWritable: true,
    },
  ],
  programId,
});

const transaction = new web3.Transaction().add(instruction)

const signature = await web3.sendAndConfirmTransaction(
  connection,
  transaction,
  [payer],
);

console.log(`✅ Succès ! La signature de la transaction est : ${signature}`);
```

### Solana Explorer

![Capture d'écran de Solana Explorer réglé sur Devnet](../assets/solana-explorer-devnet.png)

Toutes les transactions sur la blockchain sont consultables publiquement sur le [Solana Explorer](http://explorer.solana.com). Par exemple, vous pourriez prendre la signature renvoyée par `sendAndConfirmTransaction()` dans l'exemple ci-dessus, rechercher cette signature dans le Solana Explorer, puis voir :

- quand elle a eu lieu
- dans quel bloc elle a été incluse
- le frais de transaction
- et plus encore !

![Capture d'écran de Solana Explorer avec des détails sur une transaction](../assets/solana-explorer-transaction-overview.png)

# Laboratoire - écriture de transactions pour le programme ping counter 

Nous allons créer un script pour envoyer un ping à un programme onchain qui incrémente un compteur à chaque fois qu'il est pingé. Ce programme existe sur le Solana Devnet à l'adresse `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa`. Le programme stocke ses données dans un compte spécifique à l'adresse `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Solana stocke les programmes et les données dans des comptes séparés](../assets/pdas-note-taking-program.svg)

### 1. Structure de base

Commençons par utiliser les mêmes packages et le fichier `.env` que nous avons créé précédemment dans [Introduction à l'écriture de données](./intro-to-writing-data).

Nommez le fichier `send-ping-transaction.ts` :

```typescript
import * as web3 from "@solana/web3.js";
import "dotenv/config"
import base58 from "bs58";
import { getKeypairFromEnvironment, requestAndConfirmAirdropIfRequired } from "@solana-developers/helpers";

const payer = getKeypairFromEnvironment('SECRET_KEY')
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))

const newBalance = await requestAndConfirmAirdropIfRequired(
  connection,
  payer.publicKey,
  1 * LAMPORTS_PER_SOL,
  0.5 * LAMPORTS_PER_SOL,
);

```

Cela se connectera à Solana et chargera quelques Lamports si nécessaire.

### 2. Programme de ping

Maintenant, parlons au programme Ping ! Pour ce faire, nous devons :

1. créer une transaction
2. créer une instruction
3. ajouter l'instruction à la transaction
4. envoyer la transaction.

N'oubliez pas, la pièce la plus délicate ici est d'inclure les bonnes informations dans les instructions. Nous connaissons l'adresse du programme que nous appelons. Nous savons également que le programme écrit des données dans un compte séparé dont nous avons également l'adresse. Ajoutons les versions chaînes des deux en tant que constantes en haut du fichier :

```typescript
const PING_PROGRAM_ADDRESS = new web3.PublicKey('ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa')
const PING_PROGRAM_DATA_ADDRESS =  new web3.PublicKey('Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod')
```

Maintenant, créons une nouvelle transaction, puis initialisons une `PublicKey` pour le compte du programme, et une autre pour le compte de données.

```typescript
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)
```

Ensuite, créons l'instruction. Rappelez-vous, l'instruction doit inclure la clé publique du programme Ping et elle doit également inclure un tableau avec tous les comptes qui seront lus ou écrits. Dans cet exemple de programme, seul le compte de données mentionné ci-dessus est nécessaire.

```typescript
const transaction = new web3.Transaction()

const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: pingProgramDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})
```

Ensuite, ajoutons l'instruction à la transaction que nous avons créée. Ensuite, appelons `sendAndConfirmTransaction()` en passant la connexion, la transaction et le payeur. Enfin, affichons le résultat de cet appel de fonction pour pouvoir le rechercher sur le Solana Explorer.

```typescript
transaction.add(instruction)

const signature = await web3.sendAndConfirmTransaction(
  connection,
  transaction,
  [payer]
)

console.log(`✅ Transaction completed! Signature is ${signature}`)
```

### 3. Exécutez le client ping et vérifiez le Solana explorer

Maintenant, exécutez à nouveau le code.

```bash
npx esrun send-ping-transaction.ts
```

Cela peut prendre un moment ou deux, mais maintenant le code devrait fonctionner et vous devriez voir une longue chaîne imprimée dans la console, comme la suivante :

```
✅ Transaction completed! Signature is 55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Copiez la signature de la transaction. Ouvrez un navigateur et allez sur [https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet) (le paramètre de requête à la fin de l'URL garantira que vous explorerez les transactions sur Devnet au lieu de Mainnet). Collez la signature dans la barre de recherche en haut de l'explorateur Devnet de Solana et appuyez sur Entrée. Vous devriez voir tous les détails sur la transaction. Si vous faites défiler jusqu'en bas, vous verrez `Program Logs`, qui montre combien de fois le programme a été pingé, y compris votre ping.

![Capture d'écran de Solana Explorer avec des journaux de l'appel du programme Ping](../assets/solana-explorer-ping-result.png)

Parcourez l'explorateur et regardez ce que vous voyez :
 - Les **Entrées de compte(s)** incluront : 
  - L'adresse de votre payeur - débitée de 5000 lamports pour la transaction
  - L'adresse du programme pour le programme ping
  - L'adresse de données pour le programme ping
 - La section **Instruction** contiendra une seule instruction sans données - le programme ping est un programme assez simple, donc il n'a pas besoin de données.
 - Les **Journaux d'instructions du programme** montrent les journaux du programme ping.  

[//]: # "TODO: these would make a good question-and-answer interactive once we have this content hosted on solana.com, and can support adding more interactive content easily."

Si vous voulez rendre plus facile l'examen de Solana Explorer pour les transactions à l'avenir, changez simplement votre `console.log` comme suit :

```typescript
console.log(`Vous pouvez voir votre transaction sur le Solana Explorer à :\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`)
```

Et voilà, vous appelez des programmes sur le réseau Solana et écrivez des données dans la chaîne !

Dans les prochaines leçons, vous apprendrez à

1. Envoyer des transactions en toute sécurité depuis le navigateur au lieu d'un script
2. Ajouter des données personnalisées à vos instructions
3. Désérialiser des données depuis la chaîne

# Défi

Créez un script à partir de zéro qui vous permettra de transférer des SOL d'un compte à un autre sur Devnet. Assurez-vous d'afficher la signature de la transaction afin de pouvoir la consulter sur le Solana Explorer.

Si vous êtes bloqué, n'hésitez pas à jeter un coup d'œil à [la solution](https://github.com/Unboxed-Software/solana-ping-client).


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e969d07e-ae85-48c3-976f-261a22f02e52) !

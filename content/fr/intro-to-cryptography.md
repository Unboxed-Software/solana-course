---
title: Fondamentaux de la cryptographie
objectives :
- Comprendre la cryptographie symétrique et asymétrique
- Expliquer les paires de clés
- Générer une nouvelle paire de clés
- Charger une paire de clés à partir d'un fichier .env
---

# Résumé

- Une **paire de clés** est constituée d'une **clé publique** et d'une **clé secrète** correspondantes.
- La **clé publique** est utilisée comme une "adresse" pointant vers un compte sur le réseau Solana. Une clé publique peut être partagée avec n'importe qui.
- La **clé secrète** est utilisée pour vérifier l'autorité sur le compte. Comme son nom l'indique, vous devez toujours garder les clés secrètes *secrètes*.
- `@solana/web3.js` propose des fonctions d'aide pour créer une toute nouvelle paire de clés ou pour construire une paire de clés à l'aide d'une clé secrète existante.

# Aperçu général

## Cryptographie Symétrique et Asymétrique

La 'Cryptographie' est littéralement l'étude de la dissimulation de l'information. Il existe deux principaux types de cryptographie que vous rencontrerez au quotidien :

La **Cryptographie Symétrique** est celle où la même clé est utilisée pour chiffrer et déchiffrer. Elle existe depuis des centaines d'années et a été utilisée par tout le monde, des anciens Égyptiens à la reine Elizabeth I.

Il existe plusieurs algorithmes de cryptographie symétrique, mais ceux que vous verrez le plus souvent aujourd'hui sont AES et Chacha20.

**Cryptographie Asymétrique**

- La cryptographie asymétrique - également appelée '[cryptographie à clé publique](https://fr.wikipedia.org/wiki/Cryptographie_%C3%A0_cl%C3%A9_publique)' - a été développée dans les années 1970. En cryptographie asymétrique, les participants possèdent des paires de clés (ou **keypairs**). Chaque paire de clés se compose d'une **clé secrète** et d'une **clé publique**. Le chiffrement asymétrique fonctionne différemment du chiffrement symétrique et peut accomplir différentes tâches :

- **Chiffrement** : si un message est chiffré avec une clé publique, seule la clé secrète de la même paire de clés peut être utilisée pour le lire.
- **Signatures** : si un message est chiffré avec une clé secrète, la clé publique de la même paire de clés peut être utilisée pour prouver que le titulaire de la clé secrète l'a signé.
- Vous pouvez même utiliser la cryptographie asymétrique pour trouver une bonne clé pour la cryptographie symétrique ! Cela s'appelle **l'échange de clés**, où vous utilisez vos clés publiques et la clé publique du destinataire pour obtenir une clé 'de session'.
- Il existe plusieurs algorithmes de cryptographie asymétrique, mais les plus courants que vous verrez aujourd'hui sont des variantes de ECC ou RSA.

Le chiffrement asymétrique est très populaire :

 - Votre carte bancaire contient une clé secrète utilisée pour signer les transactions.

   Votre banque peut confirmer que vous avez effectué la transaction en la vérifiant avec la clé publique correspondante.
 - Les sites Web incluent une clé publique dans leur certificat. Votre navigateur utilisera cette clé publique pour chiffrer les données (telles que des informations personnelles, des détails de connexion et des numéros de carte de crédit) qu'il envoie à la page Web.

   Le site Web possède la clé privée correspondante pour pouvoir lire les données.
 - Votre passeport électronique a été signé par le pays qui l'a émis pour garantir qu'il n'est pas contrefait.

   Les portiques de passeport électronique peuvent le confirmer en utilisant la clé publique de votre pays d'émission.
 - Les applications de messagerie sur votre téléphone utilisent un échange de clés pour créer une clé de session.

En résumé, la cryptographie est omniprésente. Solana, ainsi que d'autres blockchains, ne sont qu'une utilisation de la cryptographie.

## Solana utilise des clés publiques comme adresses

![Adresses de portefeuille Solana](../assets/wallet-addresses.svg)

Les personnes participant au réseau Solana ont au moins une paire de clés. Sur Solana :

- La **clé publique** est utilisée comme une "adresse" pointant vers un compte sur le réseau Solana. Même les noms conviviaux, tels que `example.sol`, pointent vers des adresses comme `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`.
  
- La **clé secrète** est utilisée pour vérifier l'autorité sur cette paire de clés. Si vous avez la clé secrète pour une adresse, vous contrôlez les jetons à l'intérieur de cette adresse. Pour cette raison, comme son nom l'indique, vous devez toujours garder les clés secrètes *secrètes*.
## Utilisation de @solana/web3.js pour créer une paire de clés

Vous pouvez utiliser la blockchain Solana depuis le navigateur ou node.js avec le module npm `@solana/web3.js`. Configurez un projet comme vous le feriez normalement, puis [utilisez `npm`](https://nodesource.com/blog/an-absolute-beginners-guide-to-using-npm/) pour installer `@solana/web3.js`

```
npm i @solana/web3.js
```

Nous aborderons progressivement [web3.js](https://docs.solana.com/developing/clients/javascript-reference) tout au long de ce cours, mais vous pouvez également consulter la [documentation officielle de web3.js](https://docs.solana.com/developing/clients/javascript-reference).

Pour envoyer des jetons, envoyer des NFTS ou lire et écrire des données Solana, vous aurez besoin de votre propre paire de clés. Pour créer une nouvelle paire de clés, utilisez la fonction `Keypair.generate()` de `@solana/web3.js` :

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`La clé publique est : `, keypair.publicKey.toBase58());
console.log(`La clé secrète est : `, keypair.secretKey);
```

## ⚠️ N'incluez pas les clés secrètes dans votre code source

Étant donné que la paire de clés peut être régénérée à partir de la clé secrète, nous ne stockons généralement que la clé secrète et restaurons la paire de clés à partir de la clé secrète.

De plus, comme la clé secrète confère l'autorité sur l'adresse, nous ne stockons pas les clés secrètes dans le code source. Au lieu de cela, nous :

- Mettons les clés secrètes dans un fichier `.env`
- Ajoutons `.env` dans `.gitignore` pour que le fichier `.env` ne soit pas inclus dans les commits.

## Chargement d'une paire de clés existante

Si vous avez déjà une paire de clés que vous souhaitez utiliser, vous pouvez charger une `Keypair` à partir d'une clé secrète existante stockée dans le système de fichiers ou un fichier `.env`. En node.js, le package npm `@solana-developers/helpers` inclut quelques fonctions supplémentaires :

 - Pour utiliser un fichier `.env`, utilisez `getKeypairFromEnvironment()`
 - Pour utiliser un fichier Solana CLI, utilisez `getKeypairFromFile()`

```typescript
import "dotenv/config";
import { getKeypairFromEnvironment } from "@solana-developers/helpers";


const keypair = getKeypairFromEnvironment("SECRET_KEY");
```

Vous savez maintenant comment créer et charger des paires de clés ! Pratiquons ce que nous avons appris.

# Laboratoire

### Installation

Créez un nouveau répertoire, installez TypeScript, Solana web3.js et esrun :

```bash
mkdir generate-keypair
cd generate-keypair
npm init -y
npm install typescript @solana/web3.js esrun @solana-developers/helpers
```

Créez un nouveau fichier appelé `generate-keypair.ts`

```typescript
import { Keypair } from "@solana/web3.js";
const keypair = Keypair.generate();
console.log(`✅ Paire de clés générée !`)
```

Exécutez `npx esrun generate-keypair.ts`. Vous devriez voir le texte :

```
✅ Paire de clés générée !
```

Chaque `Keypair` a une propriété `publicKey` et `secretKey`. Mettez à jour le fichier :

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`La clé publique est : `, keypair.publicKey.toBase58());
console.log(`La clé secrète est : `, keypair.secretKey);
console.log(`✅ Terminé !`);
```

Exécutez `npx esrun generate-keypair.ts`. Vous devriez voir le texte :

```
La clé publique est :  764CksEAZvm7C1mg2uFmpeFvifxwgjqxj2bH6Ps7La4F
La clé secrète est :  Uint8Array(64) [
  (une longue série de nombres) 
]
✅ Terminé !
```

## Chargement d'une paire de clés existante à partir d'un fichier .env

Pour garantir que votre clé secrète reste sécurisée, nous vous recommandons d'injecter la clé secrète à l'aide d'un fichier `.env` :

Créez un nouveau fichier appelé `.env` avec le contenu de la clé que vous avez créée précédemment :

```env
SECRET_KEY="[(une série de nombres)]"
```

Vous pouvez ensuite charger la paire de clés à partir de l'environnement. Mettez à jour `generate-keypair.ts` :

```typescript
import "dotenv/config"
import { getKeypairFromEnvironment } from "@solana-developers/helpers";

const keypair = getKeypairFromEnvironment("SECRET_KEY");

console.log(
  `✅ Terminé ! Nous avons chargé notre clé secrète en toute sécurité, en utilisant un fichier env !`
);
```

Exécutez `npx esrun generate-keypair.ts`. Vous devriez voir le résultat suivant :

```text
✅ Terminé ! Nous avons chargé notre clé secrète en toute sécurité, en utilisant un fichier env !
```

Nous avons maintenant appris les paires de clés et comment stocker les clés secrètes en toute sécurité sur Solana. Dans le prochain chapitre, nous les utiliserons !

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=ee06a213-5d74-4954-846e-cba883bc6db1) !
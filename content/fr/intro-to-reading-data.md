---
title: Lire des données depuis le réseau Solana
objectives:
- Comprendre les comptes et leurs adresses
- Comprendre SOL et les lamports
- Utiliser web3.js pour se connecter à Solana et lire le solde d'un compte
---

## Résumé

- **SOL** est le nom du jeton natif de Solana. Chaque SOL est composé de 1 milliard de **Lamports**.
- **Les comptes** stockent des jetons, des NFT, des programmes et des données. Pour l'instant, nous nous concentrerons sur les comptes qui stockent du SOL.
- **Les adresses** pointent vers des comptes sur le réseau Solana. N'importe qui peut lire les données dans une adresse donnée. La plupart des adresses sont également des **clés publiques**.

# Aperçu général

### Les comptes

Toutes les données stockées sur Solana le sont dans des comptes. Les comptes peuvent stocker :

- des jetons SOL
- d'autres jetons, comme l'USDC
- des NFT
- des programmes, comme le programme de critique de film que nous allons créer dans ce cours !
- des données de programme, comme une critique de film pour le programme ci-dessus !

### SOL

SOL est le jeton natif de Solana - SOL est utilisé pour payer les frais de transaction, la location des comptes, et plus encore. SOL est parfois représenté par le symbole `◎`. Chaque SOL est composé de 1 milliard de **Lamports**.

De la même manière que les applications financières font généralement des calculs en cents (pour l'USD), en pence (pour la GBP), les applications Solana traitent généralement, dépensent, stockent et manipulent des SOL en Lamports, ne les convertissant en SOL complet que pour l'afficher aux utilisateurs.

### Adresses

Les adresses identifient de manière unique les comptes. Les adresses sont souvent affichées sous forme de chaînes encodées en base58 comme `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`. La plupart des adresses sur Solana sont également des **clés publiques**. Comme mentionné dans le chapitre précédent, quiconque contrôle la clé secrète correspondante à une adresse contrôle le compte - par exemple, la personne ayant la clé secrète peut envoyer des jetons depuis le compte.

## Lecture depuis la blockchain Solana

### Installation

Nous utilisons un package npm appelé `@solana/web3.js` pour effectuer la plupart des opérations avec Solana. Nous installerons également TypeScript et `esrun`, afin de pouvoir exécuter des fichiers `.ts` depuis la ligne de commande :

```bash
npm install typescript @solana/web3.js esrun 
```

### Se connecter au réseau

Chaque interaction avec le réseau Solana à l'aide de `@solana/web3.js` se fera via un objet `Connection`. L'objet `Connection` établit une connexion avec un réseau Solana spécifique, appelé un « cluster ».

Pour l'instant, nous utiliserons le cluster `Devnet` plutôt que `Mainnet`. `Devnet` est conçu pour une utilisation et des tests par les développeurs, et les jetons `Devnet` n'ont pas de valeur réelle.

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
console.log(`✅ Connecté !`)
```

L'exécution de ce TypeScript (`npx esrun example.ts`) affiche :

```
✅ Connecté !
```

### Lire depuis le réseau

Pour lire le solde d'un compte :

```typescript
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);

console.log(`Le solde du compte à ${address} est de ${balance} lamports`); 
console.log(`✅ Terminé !`)
```

Le solde retourné est en *lamports*, comme discuté précédemment. Web3.js fournit la constante `LAMPORTS_PER_SOL` pour afficher les lamports en SOL :

```typescript
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);
const balanceEnSol = balance / LAMPORTS_PER_SOL;

console.log(`Le solde du compte à ${address} est de ${balanceEnSol} SOL`); 
console.log(`✅ Terminé !`)
```

L'exécution de `npx esrun example.ts` affichera quelque chose comme :

```
Le solde du compte à CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN est de 0.00114144 SOL
✅ Terminé !
```

... et comme ça, nous lisons des données depuis la blockchain Solana !

# Laboratoire

Pratiquons ce que nous avons appris et vérifions le solde à une adresse particulière.

## Charger une paire de clés

Souvenez-vous de la clé publique du chapitre précédent.

Créez un nouveau fichier appelé `check-balance.ts`, en remplaçant votre clé publique par `<votre clé publique>`.

Le script charge la clé publique, se connecte à DevNet et vérifie le solde :

```tsx
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const publicKey = new PublicKey("<votre clé publique>");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const balanceInLamports = await connection.getBalance(publicKey);

const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;

console.log(
  `💰 Terminé ! Le solde du portefeuille à l'adresse ${publicKey} est de ${balanceEnSOL} !`
);

```

Enregistrez ceci dans un fichier, et exécutez `npx esrun check-balance.ts`. Vous devriez voir quelque chose comme :

```
💰 Terminé ! Le solde du portefeuille à l'adresse 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 est de 0 !
```

## Obtenir du SOL de Devnet

En Devnet, vous pouvez obtenir du SOL gratuit pour développer. Considérez le SOL Devnet comme de l'argent de jeu - il semble avoir de la valeur, mais il n'en a pas.

[Obtenez du SOL Devnet](https://faucet.solana.com/) et utilisez la clé publique de votre paire de clés comme adresse.

Choisissez n'importe quelle quantité de SOL.

## Vérifier votre solde

Relancez le script. Vous devriez voir votre solde mis à jour :

```
💰 Terminé ! Le solde du portefeuille à l'adresse 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 est de 0.5 !
```

## Vérifier les soldes des autres étudiants

Vous pouvez modifier le script pour vérifier les soldes de n'importe quel portefeuille.

```tsx
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const suppliedPublicKey = process.argv[2];
if (!suppliedPublicKey) {
  throw new Error("Provide a public key to check the balance of!");
}

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const publicKey = new PublicKey(suppliedPublicKey);

const balanceInLamports = await connection.getBalance(publicKey);

const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;

console.log(
  `✅ Terminé ! Le solde du portefeuille à l'adresse ${publicKey} est de ${balanceInSOL} !`
);

```

Échangez les adresses de portefeuille avec vos camarades de classe dans le chat et vérifiez leurs soldes.

```bash
% npx esrun check-balance.ts (quelques adresses de portefeuille)
✅ Terminé ! Le solde du portefeuille à l'adresse 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 est de 3 !
```

Et vérifiez quelques-uns des soldes de vos camarades de classe.

# Défi

Modifiez le script comme suit :

 - Ajoutez des instructions pour gérer les adresses de portefeuille invalides.
 - Modifiez le script pour vous connecter à `mainNet` et rechercher certains portefeuilles Solana célèbres. Essayez `toly.sol`, `shaq.sol` ou `mccann.sol`.

Nous transférerons du SOL dans la prochaine leçon !

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=8bbbfd93-1cdc-4ce3-9c83-637e7aa57454) !
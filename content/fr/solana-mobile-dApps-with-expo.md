---
title: Construction d'Applications Solana Mobile avec Expo
objectives:
- Créer des dApps Solana avec Expo
- Utiliser les périphériques et capacités spécifiques aux mobiles
- Intégrer des bibliothèques de l'écosystème dans vos dApps mobiles
---

# Résumé

- Expo est une collection d'outils et de bibliothèques open source qui s'enveloppent autour de React Native, similaire à la manière dont Next.js est un framework construit au-dessus de React.
- En plus de simplifier le processus de construction/déploiement, Expo propose des packages qui vous donnent accès aux périphériques et aux capacités des appareils mobiles.
- Beaucoup de bibliothèques de l'écosystème Solana ne prennent pas en charge nativement React Native, mais vous pouvez généralement les utiliser avec les bons [polyfills](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill).

# Aperçu général

Jusqu'à présent, dans l'exploration de Solana Mobile, nous avons utilisé du React Native standard pour construire des dApps mobiles très simples. Tout comme de nombreux développeurs web choisissent d'utiliser des frameworks construits au-dessus de React, tels que Next.js, de nombreux développeurs React Native choisissent d'utiliser des frameworks et des outils qui simplifient le processus de développement, de test et de déploiement React Native. Le plus courant d'entre eux est [React Native Expo](https://docs.expo.dev/tutorial/introduction/).

Cette leçon explorera deux sujets principaux :
1. Comment utiliser React Native Expo pour rationaliser le développement React Native.
2. Comment intégrer des bibliothèques JS/TS de l'écosystème Solana qui ne prennent pas en charge explicitement React Native (par exemple, Metaplex).

Ces sujets sont mieux explorés de manière pratique, donc la majeure partie de cette leçon sera passée dans le laboratoire.

## React Native Expo

Expo est une collection d'outils et de bibliothèques open source qui s'enveloppent autour de React Native, similaire à la manière dont Next.js est un framework construit au-dessus de React.

Expo se compose de trois parties principales :
1. Expo CLI
2. L'application Expo Go
3. Une suite de bibliothèques qui accordent l'accès à diverses capacités des appareils mobiles.

L'Expo CLI est un outil de construction et de débogage qui facilite toute la magie. Il est probable que vous n'ayez à interagir avec lui que lorsque vous construisez ou démarrez un serveur de développement. Il fonctionne simplement.

L' [application Expo Go](https://expo.dev/client) est une technologie très cool qui permet de développer la plupart des applications sans utiliser d'émulateur ou de périphérique physique. Vous téléchargez l'application, scannez le QR à partir de la sortie de construction et vous avez un environnement de développement fonctionnel directement sur votre téléphone. Malheureusement, cela ne fonctionnera pas avec le SDK mobile Solana. Selon l'article sur [la configuration Expo Solana](https://docs.solanamobile.com/react-native/expo) :

> The traditional Expo Go development flow is only limited to certain hand-picked modules and does not support further customized native code, which Solana Mobile SDKs need.
> Instead, we'll need to use a custom development build which makes Solana Mobile React Native libraries (i.e Mobile Wallet Adapter) fully compatible with Expo.

Enfin, et surtout, Expo fait un excellent travail en fournissant des [bibliothèques faciles à utiliser](https://docs.expo.dev/versions/latest/) qui donnent accès aux périphériques intégrés de l'appareil, tels que la caméra, la batterie et les haut-parleurs. Les bibliothèques sont intuitives et la documentation est phénoménale.

### Comment créer une application Expo

Pour commencer avec Expo, vous avez d'abord besoin de la configuration préalable décrite dans la [leçon d'introduction à Solana Mobile](./basic-solana-mobile.md#0-prerequisites). Ensuite, vous voudrez créer un compte [Expo Application Services (EAS)](https://expo.dev/).

Une fois que vous avez un compte EAS, vous pouvez installer l'outil en ligne de commande EAS et vous connecter :

```bash
npm install --global eas-cli
eas login
```

Enfin, vous pouvez créer une nouvelle application Expo en utilisant la commande `create-expo-app` :
```bash
npx create-expo-app
```

### Comment construire et exécuter une application Expo

Pour certaines applications, Expo facilite grandement la construction avec l'application Expo Go. L'application Expo Go construit le projet sur un serveur distant et le déploie sur l'émulateur ou le périphérique que vous spécifiez.

Malheureusement, cela ne fonctionnera pas avec les applications mobiles Solana. À la place, vous devrez construire localement. Pour ce faire, vous avez besoin d'un fichier de configuration supplémentaire, `eas.json`, spécifiant que la distribution du projet est "interne". Vous aurez besoin du contenu suivant dans ce fichier :

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

Avec le fichier de configuration EAS créé, vous pouvez construire en utilisant la commande `npx eas build --local` avec les drapeaux pertinents pour toute exigence supplémentaire. Par exemple, ce qui suit construira le projet localement avec un profil de développement spécifique pour Android :

```bash
npx eas build --profile development --platform android --local
```

Ensuite, vous devez installer le fichier APK généré sur votre périphérique ou émulateur. Si vous utilisez un émulateur, cela revient à faire glisser le fichier APK sur la fenêtre de l'émulateur. Si vous utilisez un périphérique physique, vous devrez utiliser Android Debug Bridge (ADB) :

```bash
adb install votre-fichier-apk.apk
```

L'APK installé est une application modèle d'Expo qui facilite plusieurs choses, y compris l'exécution de votre application. Pour charger votre application à l'intérieur, vous devez démarrer le serveur de développement :

```bash
npx expo start --dev-client --android
```

### Comment ajouter des packages SDK Expo à votre application

Le SDK Expo contient des packages pour simplifier toutes sortes de choses liées au développement React Native, des éléments d'interface utilisateur à l'utilisation des périphériques. Vous pouvez voir tous les packages sur la [documentation du SDK Expo](https://docs.expo.dev/versions/latest/).

Par exemple, vous ajouteriez la fonctionnalité de [podomètre](https://docs.expo.dev/versions/latest/sdk/pedometer/) à votre application en installant le package `expo-sensors` :

```bash
npx expo install expo-sensors
```

Ensuite, vous pouvez l'importer dans votre code comme vous vous y attendriez normalement en utilisant JS/TS.

```tsx
import { Pedometer } from 'expo-sensors'
```

En fonction du package, des configurations supplémentaires peuvent être nécessaires. Assurez-vous de lire la [documentation](https://docs.expo.dev/versions/latest/) lors de l'utilisation d'un nouveau package.

## Intégration de bibliothèques de l'écosystème dans votre application Expo

Toutes les bibliothèques React et Node ne fonctionnent pas avec React Native immédiatement. Vous devez soit trouver des bibliothèques spécifiquement créées pour fonctionner avec React Native, soit créer vous-même une solution de contournement.

Lorsque vous travaillez spécifiquement avec Solana, la grande majorité des bibliothèques de l'écosystème ne prennent pas en charge React Native immédiatement. Heureusement, pour les faire fonctionner dans un environnement React Native, tout ce que nous avons à faire est de configurer Expo avec les [bons polyfills](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill).

Les polyfills sont des bibliothèques de remplacement pour les environnements qui ne fonctionnent pas avec Node.js. Expo n'utilise pas Node.js. Malheureusement, il peut être difficile de savoir quels polyfills sont nécessaires pour une application donnée. À moins de le savoir à l'avance, le débogage des polyfills signifie examiner les erreurs du compilateur et rechercher sur Stack Overflow. Si cela ne se construit pas, c'est généralement un problème de polyfill.

Heureusement, nous avons compilé une liste de polyfills dont vous aurez besoin non seulement pour certaines des bibliothèques Solana standard, mais aussi pour Metaplex.

### Polyfills Solana

Pour une application Solana + Expo, vous aurez besoin des éléments suivants :
- `@solana-mobile/mobile-wallet-adapter-protocol`: Une API React Native/Javascript permettant l'interaction avec les portefeuilles compatibles MWA.
- `@solana-mobile/mobile-wallet-adapter-protocol-web3js`: Un wrapper pratique pour utiliser des primitives courantes de [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) telles que `Transaction` et `Uint8Array`.
- `@solana/web3.js`: Bibliothèque Web Solana pour interagir avec le réseau Solana via l'API [JSON RPC](https://docs.solana.com/api/http).
- `react-native-get-random-values`: Polyfill sécurisé de générateur de nombres aléatoires pour `web3.js` sous-jacent à la bibliothèque Crypto sur React Native.
- `buffer`: Polyfill Buffer nécessaire pour `web3.js` sur React Native.

### Polyfills Metaplex

Si vous souhaitez utiliser le SDK Metaplex, vous devrez ajouter la bibliothèque Metaplex ainsi que quelques polyfills supplémentaires :

- `@metaplex-foundation/js@0.19.4` - Bibliothèque Metaplex
- Plusieurs autres polyfills
  - `assert`
  - `util`
  - `crypto-browserify`
  - `stream-browserify`
  - `readable-stream`
  - `browserify-zlib`
  - `path-browserify`
  - `react-native-url-polyfill`

Toutes les bibliothèques que les polyfills ci-dessus sont censés remplacer sont utilisées par la bibliothèque Metaplex en arrière-plan. Il est peu probable que vous importiez directement l'une d'entre elles dans votre code. Pour cette raison, vous devrez enregistrer les polyfills à l'aide d'un fichier `metro.config.js`. Cela garantira que Metaplex utilise les polyfills au lieu des bibliothèques Node.js habituelles qui ne sont pas prises en charge dans React Native. Ci-dessous se trouve un exemple de fichier `metro.config.js` :

```js
const { getDefaultConfig } = require('@expo/metro-config');
const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  url: require.resolve('react-native-url-polyfill'),
  zlib: require.resolve('browserify-zlib'),
  path: require.resolve('path-browserify'),
};

module.exports = defaultConfig;
```

## Mettre tout en place

Comme avec la plupart des nouveaux outils ou frameworks, la configuration initiale peut être difficile. La bonne nouvelle est qu'une fois que vous avez l'application qui compile et s'exécute, il y a très peu de différences dans le code que vous écrivez pour une application web par rapport à mobile, et il n'y a pratiquement aucune différence en comparant le code que vous écrivez pour une application React Native par rapport à une application Expo.

# Laboratoire

Pratiquons ensemble en construisant l'application Mint-A-Day, où les utilisateurs pourront créer un instantané NFT de leur vie quotidienne, créant ainsi une sorte de journal permanent.

Pour créer les NFT, nous utiliserons le SDK JavaScript de Metaplex en conjonction avec [nft.storage](https://nft.storage/) pour stocker les images et les métadonnées. Tout notre travail onchain se fera sur Devnet.

La première moitié de ce laboratoire consiste à assembler les composants nécessaires pour faire fonctionner ensemble Expo, Solana et Metaplex. Nous le ferons de manière modulaire afin que vous sachiez quelles parties du modèle de départ correspondent à quelle section.

## 1. Créer, construire et exécuter une application Expo locale

Dans cette première section, nous allons simplement faire fonctionner une application Expo TypeScript sur un émulateur. Si vous avez déjà configuré un environnement de développement React Native, passez à l'étape 0.

### 0. Configurer l'environnement de développement React Native

Vous aurez besoin de React Native installé sur votre machine ainsi que d'un émulateur ou d'un appareil physique en cours d'exécution. [Vous pouvez réaliser tout cela avec le démarrage rapide de React Native](https://reactnative.dev/docs/environment-setup?guide=native). Vous trouverez également plus de détails sur cette configuration dans la [leçon d'introduction à Solana Mobile](./basic-solana-mobile.md#0-prerequisites).

> Note : Bien que nous utilisions Expo, vous devrez suivre le guide de configuration initial de React Native CLI.
> Note: Si vous utilisez un émulateur, il est hautement recommandé d'utiliser une version récente de téléphone avec plusieurs GO de RAM pour tourner. Nous utilisons 5GO de RAM.

### 1. S'inscrire à Expo EAS CLI

Pour simplifier le processus Expo, vous voudrez un compte Expo Application Services (EAS). Cela vous aidera à construire et exécuter l'application.

Inscrivez-vous d'abord pour un [compte EAS](https://expo.dev/).

Ensuite, installez le EAS CLI et connectez-vous :

```bash
npm install --global eas-cli
eas login
```

### 2. Créer la structure de l'application

Créons notre application avec la commande suivante :

```bash
npx create-expo-app -t expo-template-blank-typescript solana-expo
cd solana-expo
```

Cela utilise `create-expo-app` pour générer une nouvelle structure basée sur le modèle `expo-template-blank-typescript`. Il s'agit simplement d'une application React Native TypeScript vide.

### 3. Configuration de la construction locale

Expo a par défaut une configuration de construction sur un serveur distant, mais nous devons construire localement pour que Solana Mobile fonctionne correctement. Nous devons ajouter un nouveau fichier de configuration pour indiquer au compilateur ce que nous faisons. Créez un fichier appelé `eas.json` à la racine de votre répertoire.

```bash
touch eas.json
```

Copiez et collez ce qui suit dans le nouveau `eas.json` :
```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### 4. Construction et émulation

Construisons maintenant le projet. Répondez "y" à chaque question. Cela prendra un certain temps pour se terminer.

```bash
npx eas build --profile development --platform android --local
```

Lorsque la commande est terminée, vous obtiendrez un fichier de sortie à la racine de votre répertoire. Ce fichier aura un format de nommage `build-XXXXXXXXXXX.apk`. Localisez ce fichier dans votre explorateur de fichiers et ***glissez-le*** dans votre émulateur. Un message devrait s'afficher sur l'émulateur indiquant qu'il installe le nouvel APK. Lorsqu'il a fini d'installer, vous devriez voir l'APK comme une icône d'application dans l'émulateur.

L'application installée est simplement un squelette d'application Expo. La dernière chose à faire est d'exécuter la commande suivante pour lancer le serveur de développement :

```bash
npx expo start --dev-client --android
```

Cela devrait ouvrir et exécuter l'application dans votre émulateur Android.

***NOTE*** Chaque fois que vous ajoutez de nouvelles dépendances, vous devrez reconstruire et réinstaller l'application. Tout ce qui est visuel ou basé sur la logique devrait être capturé par le rechargement à chaud.

## 2. Configurer votre application Expo pour fonctionner avec Solana

Maintenant que nous avons une application Expo en cours d'exécution, nous devons ajouter nos dépendances Solana, y compris l'installation d'un portefeuille que nous pouvons utiliser dans l'émulateur. Si vous avez déjà installé un portefeuille activé pour Devnet, vous pouvez passer à l'étape 0.

### 0. Installer un portefeuille Solana activé pour Devnet

Vous aurez besoin d'un portefeuille prenant en charge Devnet pour effectuer des tests. Dans [notre leçon sur l'adaptateur de portefeuille mobile](./mwa-deep-dive), nous en avons créé un. Installons-le à partir de la branche de solution dans un répertoire différent de notre application :

```bash
cd ..
git clone https://github.com/Unboxed-Software/react-native-fake-solana-wallet
cd react-native-fake-solana-wallet
git checkout solution
npm run install
```

Le portefeuille devrait être installé sur votre émulateur ou appareil. Assurez-vous d'ouvrir le portefeuille nouvellement installé et de vous envoyer quelques SOL.

N'oubliez pas de revenir au répertoire du portefeuille car c'est là que nous travaillerons pour le reste du laboratoire.

```bash
cd ..
cd solana-expo
```

### 1. Installer les dépendances Solana

Nous allons installer quelques dépendances Solana de base susceptibles d'être nécessaires pour toutes les applications mobiles Solana. Cela inclura quelques polyfills permettant à des packages autrement incompatibles de fonctionner avec React Native :

```bash
npm install \
  @solana/web3.js \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \
  react-native-get-random-values \
  buffer
```

### 3. Ajouter des fournisseurs de base Solana

Ensuite, ajoutons quelques éléments de base Solana qui peuvent vous aider à démarrer la plupart des applications basées sur Solana.

Créez deux nouveaux dossiers : `components` et `screens`.

Nous allons utiliser un code de base de la [première leçon mobile](./basic-solana-mobile). Nous allons copier les fichiers `components/AuthProvider.tsx` et `components/ConnectionProvider.tsx`. Ces fichiers nous fournissent un objet `Connection` ainsi que des fonctions d'aide qui autorisent notre application décentralisée.

Créez le fichier `components/AuthProvider.tsx` et copiez le contenu [de notre fournisseur d'authentification existant depuis Github](https://raw.githubusercontent.com/Unboxed-Software/solana-advance-mobile/main/components/AuthProvider.tsx) dans le nouveau fichier.

Ensuite, créez le fichier `components/ConnectionProvider.tsx` et copiez le contenu [de notre fournisseur de connexion existant depuis Github](https://raw.githubusercontent.com/Unboxed-Software/solana-advance-mobile/main/components/ConnectionProvider.tsx) dans le nouveau fichier.

Créons maintenant un modèle pour notre écran principal dans `screens/MainScreen.tsx` :

```tsx
import { View, Text } from 'react-native';
import React from 'react';

export function MainScreen() {
  return (
    <View>
      <Text>Solana Expo App</Text>
    </View>
  );
}
```

Enfin, modifions `App.tsx` pour envelopper notre application dans les deux fournisseurs que nous venons de créer :

```tsx
import 'react-native-get-random-values';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { ConnectionProvider } from './components/ConnectionProvider';
import { AuthorizationProvider } from './components/AuthProvider';
import { clusterApiUrl } from '@solana/web3.js';
import { MainScreen } from './screens/MainScreen';
global.Buffer = require('buffer').Buffer;

export default function App() {
  const cluster = "devnet";
  const endpoint = clusterApiUrl(cluster);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      cluster={cluster}
      config={{ commitment: "processed" }}
    >
      <AuthorizationProvider cluster={cluster}>
        <MainScreen/>
      </AuthorizationProvider>
    </ConnectionProvider>
  );
}
```

Remarquez que nous avons ajouté deux polyfills ci-dessus : `buffer` et `react-native-get-random-values`. Ils sont nécessaires pour que les dépendances Solana fonctionnent correctement.

### 4. Construire et exécuter le modèle de départ Solana

Assurons-nous que tout fonctionne correctement et se compile. Dans Expo, chaque fois que vous modifiez les dépendances, vous devrez reconstruire et réinstaller l'application.

***Optionnel :*** Pour éviter d'éventuels conflits de version de build, vous voudrez peut-être *désinstaller* la version précédente avant de faire glisser et déposer la nouvelle.

Construisez :
```bash
npx eas build --profile development --platform android --local
```
Installez :
***Faites glisser*** le fichier de build résultant dans votre émulateur.

Exécutez :
```bash
npx expo start --dev-client --android
```

Tout devrait se compiler correctement et vous devriez avoir un modèle d'application Solana Expo.

## 3. Configurer votre application Expo pour fonctionner avec Metaplex

Metaplex est votre guichet unique pour tous vos besoins en API NFT. Cependant, cela nécessite une configuration un peu plus avancée. La bonne nouvelle est que si vous souhaitez récupérer, créer ou éditer des NFT dans vos futures applications, vous disposerez d'un autre modèle ici que vous pourrez consulter.

### 1. Installer les dépendances de Metaplex

Le SDK Metaplex abstrait beaucoup des détails de travail avec les NFTs, cependant il a été principalement écrit pour Node.js, donc nous aurons besoin de plusieurs autres polyfills pour le faire fonctionner :
```bash
npm install assert \
  util \
  crypto-browserify \
  stream-browserify \
  readable-stream \
  browserify-zlib \
  path-browserify \
  react-native-url-polyfill \
  @metaplex-foundation/js@0.19.4
```

### 2. Configuration des polyfills

Nous n'allons pas importer directement les polyfills ci-dessus dans notre code, donc nous devons les ajouter à un fichier `metro.config.js` pour nous assurer que Metaplex les utilise :

```bash
touch metro.config.js
```

Copiez et collez ce qui suit dans `metro.config.js` :
```js
// Importez la configuration Metro Expo par défaut
const { getDefaultConfig } = require('@expo/metro-config');

// Obtenez la configuration Metro Expo par défaut
const defaultConfig = getDefaultConfig(__dirname);

// Personnalisez la configuration pour inclure vos modules node supplémentaires
defaultConfig.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  url: require.resolve('react-native-url-polyfill'),
  zlib: require.resolve('browserify-zlib'),
  path: require.resolve('path-browserify'),
};

// Exportez la configuration modifiée
module.exports = defaultConfig;
```

### 3. Fournisseur Metaplex

Nous allons créer un fichier fournisseur Metaplex qui nous aidera à accéder à un objet `Metaplex`. Cet objet `Metaplex` nous donne accès à toutes les fonctions dont nous aurons besoin, telles que `fetch` et `create`. Pour ce faire, nous créons un nouveau fichier `/components/MetaplexProvider.tsx`. Ici, nous redirigeons notre adaptateur de portefeuille mobile vers un `IdentitySigner` pour que l'objet `Metaplex` puisse l'utiliser. Cela lui permet d'appeler plusieurs fonctions privilégiées en notre nom :

```tsx
import {IdentitySigner, Metaplex, MetaplexPlugin} from '@metaplex-foundation/js';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {Connection, Transaction} from '@solana/web3.js';
import {useMemo} from 'react';
import { Account } from './AuthProvider';
  
export const mobileWalletAdapterIdentity = (
  mwaIdentitySigner: IdentitySigner,
): MetaplexPlugin => ({
  install(metaplex: Metaplex) {
    metaplex.identity().setDriver(mwaIdentitySigner);
  },
});

export const useMetaplex = (
  connection: Connection,
  selectedAccount: Account | null,
  authorizeSession: (wallet: Web3MobileWallet) => Promise<Account>,
) => {
  return useMemo(() => {
    if (!selectedAccount || !authorizeSession) {
      return {mwaIdentitySigner: null, metaplex: null};
    }

    const mwaIdentitySigner: IdentitySigner = {
      publicKey: selectedAccount.publicKey,
      signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
        return await transact(async (wallet: Web3MobileWallet) => {
          await authorizeSession(wallet);

          const signedMessages = await wallet.signMessages({
            addresses: [selectedAccount.publicKey.toBase58()],
            payloads: [message],
          });

          return signedMessages[0];
        });
      },
      signTransaction: async (
        transaction: Transaction,
      ): Promise<Transaction> => {
        return await transact(async (wallet: Web3MobileWallet) => {
          await authorizeSession(wallet);

          const signedTransactions = await wallet.signTransactions({
            transactions: [transaction],
          });

          return signedTransactions[0];
        });
      },
      signAllTransactions: async (
        transactions: Transaction[],
      ): Promise<Transaction[]> => {
        return transact(async (wallet: Web3MobileWallet) => {
          await authorizeSession(wallet);
          const signedTransactions = await wallet.signTransactions({
            transactions: transactions,
          });
          return signedTransactions;
        });
      },
    };

    const metaplex = Metaplex.make(connection).use(
      mobileWalletAdapterIdentity(mwaIdentitySigner),
    );

    return {metaplex};
  }, [authorizeSession, selectedAccount, connection]);
};
```

### 4. Fournisseur NFT

Nous créons également un fournisseur NFT de niveau supérieur qui facilite la gestion de l'état NFT. Il combine tous nos fournisseurs précédents : `ConnectionProvider`, `AuthProvider` et `MetaplexProvider` pour nous permettre de créer notre objet `Metaplex`. Nous le remplirons dans une étape ultérieure, pour l'instant, cela sert de bon modèle de départ.

Créons le nouveau fichier `components/NFTProvider.tsx` :
```tsx
import "react-native-url-polyfill/auto";
import { useConnection } from "./ConnectionProvider";
import { Account, useAuthorization } from "./AuthProvider";
import React, { ReactNode, createContext, useContext, useState } from "react";
import { useMetaplex } from "./MetaplexProvider";

export interface NFTProviderProps {
  children: ReactNode;
}

export interface NFTContextState {}

const DEFAULT_NFT_CONTEXT_STATE: NFTContextState = {};

const NFTContext = createContext<NFTContextState>(DEFAULT_NFT_CONTEXT_STATE);

export function NFTProvider(props: NFTProviderProps) {
  const { children } = props;

  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const [account, setAccount] = useState<Account | null>(null);
  const { metaplex } = useMetaplex(connection, account, authorizeSession);
 
  const state = {};

  return <NFTContext.Provider value={state}>{children}</NFTContext.Provider>;
}

export const useNFT = (): NFTContextState => useContext(NFTContext);
```

Remarquez que nous avons ajouté un autre polyfill en haut `import "react-native-url-polyfill/auto";`

### 5. Envelopper le fournisseur

Maintenant, enveloppons notre nouveau `NFTProvider` autour de `MainScreen` dans `App.tsx` :

```tsx
import 'react-native-get-random-values';
import { ConnectionProvider } from './components/ConnectionProvider';
import { AuthorizationProvider } from './components/AuthProvider';
import { clusterApiUrl } from '@solana/web3.js';
import { MainScreen } from './screens/MainScreen';
import { NFTProvider } from './components/NFTProvider';
global.Buffer = require('buffer').Buffer;

export default function App() {
  const cluster = "devnet";
  const endpoint = clusterApiUrl(cluster);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      cluster={cluster}
      config={{ commitment: "processed" }}
    >
      <AuthorizationProvider cluster={cluster}>
        <NFTProvider>
          <MainScreen/>
        </NFTProvider>
      </AuthorizationProvider>
    </ConnectionProvider>
  );
}
```

### 6. Construire et exécuter

Enfin, construisons et réinstallons l'application pour nous assurer que tout fonctionne toujours.

Construisez :

```bash
npx eas build --profile development --platform android --local
```

Installez :

***Faites glisser*** le fichier de build résultant dans votre émulateur. 

Exécutez :

```bash
npx expo start --dev-client --android
```

## 4. Configurer votre application Expo pour prendre et télécharger des photos

Tout ce que nous avons fait jusqu'à présent est essentiellement un modèle que nous avions besoin de mettre en place pour commencer à ajouter la fonctionnalité que nous souhaitons avoir dans notre application Mint-A-Day. Mint-A-Day est une application de capture quotidienne. Elle permet aux utilisateurs de prendre une photo de leur vie chaque jour sous forme de création d'un NFT.

L'application aura besoin d'accéder à l'appareil photo du dispositif et d'avoir un endroit pour stocker à distance les images capturées. Heureusement, Expo SDK peut fournir un accès à l'appareil photo et [NFT.Storage](https://nft.storage) peut stocker gratuitement vos fichiers NFT.

### 1. Configuration de la caméra

Commençons par configurer la dépendance spécifique à Expo que nous allons utiliser : `expo-image-picker`. Cela nous permet d'utiliser l'appareil photo du dispositif pour prendre des photos que nous transformerons ensuite en NFT. Nous utilisons spécifiquement le sélecteur d'images plutôt que la caméra, car les émulateurs n'ont pas d'appareils photo. Ce package simulera une caméra pour nous dans l'émulateur. Installez-le avec la commande suivante :

```bash
npx expo install expo-image-picker
```

En plus de l'installation, le package `expo-image-picker` doit être ajouté en tant que plugin dans `app.json` :

```json
  "expo": {
    // ....
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Permet d'utiliser des images pour créer des NFT Solana"
        }
      ]
    ],
    // ....
  }
```

Cette dépendance particulière rend l'utilisation de la caméra très simple. Pour permettre à l'utilisateur de prendre une photo et de récupérer l'image, il suffit d'appeler ce qui suit :

```tsx
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
});
```

Pas besoin de l'ajouter quelque part pour le moment, nous y reviendrons dans quelques étapes.

### 2. Configuration de NFT.Storage

La dernière chose à faire est de configurer notre accès à [nft.storage](https://nft.storage). Nous devrons obtenir une clé API et l'ajouter en tant que variable d'environnement, puis ajouter une dernière dépendance pour convertir nos images en un type de fichier que nous pouvons télécharger.

Nous utiliserons NFT.storage pour héberger nos NFT avec IPFS car ils le font gratuitement. [Inscrivez-vous et créez une clé API](https://nft.storage/manage/). Gardez cette clé API privée.

Les bonnes pratiques suggèrent de conserver les clés API dans un fichier `.env` avec `.env` ajouté à votre fichier `.gitignore`. Il est également une bonne idée de créer un fichier `.env.example` pouvant être inclus dans votre repo et montrant les variables d'environnement nécessaires pour le projet.

Créez les deux fichiers à la racine de votre répertoire et ajoutez `.env` à votre fichier `.gitignore`.

Ensuite, ajoutez votre clé API au fichier `.env` avec le nom `EXPO_PUBLIC_NFT_STORAGE_API`. Maintenant, vous pourrez accéder à votre clé API en toute sécurité dans l'application.

Enfin, installez `rn-fetch-blob`. Ce package nous aidera à récupérer des images du schéma URI de l'appareil et à les transformer en blobs que nous pouvons télécharger sur [NFT.storage](https://nft.storage).

Installez-le avec la commande suivante :
```bash
npm i rn-fetch-blob
```

### 3. Construction finale

Construisez et réinstallez si vous voulez vous assurer que tout fonctionne correctement. C'est la dernière fois que nous aurons à le faire pour ce laboratoire. Tout le reste devrait pouvoir être chargé à chaud.

Construisez :

```bash
npx eas build --profile development --platform android --local
```

Installez :

***Glissez*** le fichier de construction résultant dans votre émulateur.

Exécutez :

```bash
npx expo start --dev-client --android
```

## 5. Ajouter la fonctionnalité pour compléter votre application Expo

Nous avons terminé la configuration ! Créons maintenant la fonctionnalité réelle de notre application Mint-A-Day. Heureusement, il n'y a que deux fichiers sur lesquels nous devons nous concentrer maintenant :

- `NFTProvider.tsx` gérera en grande partie l'état de notre application et les données des NFT.
- `MainScreen.tsx` capturera les entrées et affichera nos NFT

L'application elle-même est relativement simple. Le flux général est le suivant :

1. L'utilisateur se connecte (autorise) en utilisant la fonction `transact` et en appelant `authorizeSession` à l'intérieur du rappel.
2. Notre code utilise ensuite l'objet `Metaplex` pour récupérer tous les NFT créés par l'utilisateur.
3. Si un NFT n'a pas été créé pour le jour en cours, permettez à l'utilisateur de prendre une photo, de la télécharger et de la créer en tant que NFT.

### 1. Fournisseur de NFT

`NFTProvider.tsx` contrôlera l'état avec notre `NFTProviderContext` personnalisé. Celui-ci devrait avoir les champs suivants :

- `metaplex: Metaplex | null` - Contient l'objet Metaplex que nous utilisons pour appeler `fetch` et `create`.
- `publicKey: PublicKey | null` - La clé publique du créateur de NFT autorisé.
- `isLoading: boolean` - Gère l'état de chargement.
- `loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null` - Un tableau des NFT instantanés de l'utilisateur.
- `nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null` - Une référence au NFT créé aujourd'hui.
- `connect: () => void` - Une fonction pour se connecter au portefeuille activé pour Devnet.
- `fetchNFTs: () => void` - Une fonction qui récupère les NFT instantanés de l'utilisateur.
- `createNFT: (name: string, description: string, fileUri: string) => void` - Une fonction qui crée un nouveau NFT instantané.

```tsx
export interface NFTContextState {
  metaplex: Metaplex | null; // Contient l'objet Metaplex que nous utilisons pour appeler `fetch` et `create`.
  publicKey: PublicKey | null; // La clé publique du portefeuille autorisé
  isLoading: boolean; // État de chargement
  loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null; // Tableau des NFT instantanés de l'utilisateur qui contiennent des métadonnées
  nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null; // L'instantané NFT créé dans la journée en cours
  connect: () => void; // Se connecte (et autorise) au portefeuille activé pour Devnet
  fetchNFTs: () => void; // Récupère les NFT en utilisant l'objet `metaplex`
  createNFT: (name: string, description: string, fileUri: string) => void; // Crée le NFT
}
```

Le flux d'état ici est : `connect`, `fetchNFTs`, puis `createNFT`. Nous allons expliquer le code pour chacun d'eux et vous montrer le fichier entier à la fin.

1. `connect` - Cette fonction se connectera et autorisera l'application, puis stockera la `publicKey` résultante dans l'état.
    ```tsx
    const connect = () => {
      if (isLoading) return;

      setIsLoading(true);
      transact(async (wallet) => {
        const auth = await authorizeSession(wallet);
        setAccount(auth);
      }).finally(() => {
        setIsLoading(false);
      });
    };
    ```

2. `fetchNFTs` - Cette fonction récupérera les NFT en utilisant Metaplex :
    ```tsx
    const fetchNFTs = async () => {
      if (!metaplex || !account || isLoading) return;

      setIsLoading(true);

      try {
        const nfts = await metaplex.nfts().findAllByCreator({
          creator: account.publicKey,
        });

        const loadedNFTs = await Promise.all(
          nfts.map((nft) => {
            return metaplex.nfts().load({ metadata: nft as Metadata });
          })
        );
        setLoadedNFTs(loadedNFTs);

        // Vérifiez si nous avons déjà pris un instantané aujourd'hui
        const nftOfTheDayIndex = loadedNFTs.findIndex((nft)=>{
          return formatDate(new Date(Date.now())) === nft.name;
        })

        if(nftOfTheDayIndex !== -1){
          setNftOfTheDay(loadedNFTs[nftOfTheDayIndex])
        }

      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    };
    ```


3. `createNFT` - Cette fonction téléchargera un fichier sur NFT.Storage, puis utilisera Metaplex pour créer et minter un NFT vers votre portefeuille. Cela se fait en trois parties, le téléchargement de l'image, le téléchargement des métadonnées, puis le minting du NFT.

    Pour télécharger sur NFT.Storage, il suffit de faire un POST avec votre clé API et l'image/les métadonnées comme corps de requête.
    
    Nous allons créer deux fonctions d'aide pour télécharger l'image et les métadonnées séparément, puis les regrouper dans une seule fonction `createNFT` :
    ```tsx
    // https://nft.storage/api-docs/
    const uploadImage = async (fileUri: string): Promise<string> => {
      const imageBytesInBase64: string = await RNFetchBlob.fs.readFile(
        fileUri,
        "base64"
      );
      const bytes = Buffer.from(imageBytesInBase64, "base64");

      const response = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_NFT_STORAGE_API}`,
          "Content-Type": "image/jpg",
        },
        body: bytes,
      });

      const data = await response.json();
      const cid = data.value.cid;

      return cid as string;
    };

    const uploadMetadata = async (
      name: string,
      description: string,
      imageCID: string
    ): Promise<string> => {
      const response = await fetch("https://api.nft.storage/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_NFT_STORAGE_API}`,
        },
        body: JSON.stringify({
          name,
          description,
          image: `https://ipfs.io/ipfs/${imageCID}`,
        }),
      });

      const data = await response.json();
      const cid = data.value.cid;

      return cid;
    };
    ```

    Minting du NFT après que l'image et les métadonnées aient été téléchargées est aussi simple que d'appeler `metaplex.nfts().create(...)`. Ci-dessous montre la fonction `createNFT` regroupant tout :
    ```tsx
    const createNFT = async (
      name: string,
      description: string,
      fileUri: string
    ) => {
      if (!metaplex || !account || isLoading) return;

      setIsLoading(true);
      try {
        const imageCID = await uploadImage(fileUri);
        const metadataCID = await uploadMetadata(name, description, imageCID);

        const nft = await metaplex.nfts().create({
          uri: `https://ipfs.io/ipfs/${metadataCID}`,
          name: name,
          sellerFeeBasisPoints: 0,
        });

        setNftOfTheDay(nft.nft);
      } catch (error) {
        console.log(error);
      } finally {
        setIsLoading(false);
      }
    };
    ```

Nous allons regrouper tout ce qui précède dans le fichier `NFTProvider.tsx`. Dans l'ensemble, cela ressemble à ce qui suit :
```tsx
import "react-native-url-polyfill/auto";
import React, { ReactNode, createContext, useContext, useState } from "react";
import {
  Metaplex,
  PublicKey,
  Metadata,
  Nft,
  Sft,
  SftWithToken,
  NftWithToken,
} from "@metaplex-foundation/js";
import { useConnection } from "./ConnectionProvider";
import { Connection, clusterApiUrl } from "@solana/web3.js";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { Account, useAuthorization } from "./AuthProvider";
import RNFetchBlob from "rn-fetch-blob";
import { useMetaplex } from "./MetaplexProvider";


export interface NFTProviderProps {
  children: ReactNode;
}

export interface NFTContextState {
  metaplex: Metaplex | null;
  publicKey: PublicKey | null;
  isLoading: boolean;
  loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null;
  nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null;
  connect: () => void;
  fetchNFTs: () => void;
  createNFT: (name: string, description: string, fileUri: string) => void;
}

const DEFAULT_NFT_CONTEXT_STATE: NFTContextState = {
  metaplex: new Metaplex(new Connection(clusterApiUrl("devnet"))),
  publicKey: null,
  isLoading: false,
  loadedNFTs: null,
  nftOfTheDay: null,
  connect: () => PublicKey.default,
  fetchNFTs: () => {},
  createNFT: (name: string, description: string, fileUri: string) => {},
};

const NFTContext = createContext<NFTContextState>(DEFAULT_NFT_CONTEXT_STATE);

export function formatDate(date: Date) {
  return `${date.getDate()}.${date.getMonth()}.${date.getFullYear()}`;
}

export function NFTProvider(props: NFTProviderProps) {
  const { children } = props;
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [nftOfTheDay, setNftOfTheDay] = useState<
    (Nft | Sft | SftWithToken | NftWithToken) | null
  >(null);
  const [loadedNFTs, setLoadedNFTs] = useState<
    (Nft | Sft | SftWithToken | NftWithToken)[] | null
  >(null);

  const { metaplex } = useMetaplex(connection, account, authorizeSession);

  const connect = () => {
    if (isLoading) return;

    setIsLoading(true);
    transact(async (wallet) => {
      const auth = await authorizeSession(wallet);
      setAccount(auth);
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const fetchNFTs = async () => {
    if (!metaplex || !account || isLoading) return;

    setIsLoading(true);

    try {
      const nfts = await metaplex.nfts().findAllByCreator({
        creator: account.publicKey,
      });

      const loadedNFTs = await Promise.all(
        nfts.map((nft) => {
          return metaplex.nfts().load({ metadata: nft as Metadata });
        })
      );
      setLoadedNFTs(loadedNFTs);

      // Check if we already took a snapshot today
      const nftOfTheDayIndex = loadedNFTs.findIndex((nft)=>{
        return formatDate(new Date(Date.now())) === nft.name;
      })

      if(nftOfTheDayIndex !== -1){
        setNftOfTheDay(loadedNFTs[nftOfTheDayIndex])
      }

    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  // https://nft.storage/api-docs/
  const uploadImage = async (fileUri: string): Promise<string> => {
    const imageBytesInBase64: string = await RNFetchBlob.fs.readFile(
      fileUri,
      "base64"
    );
    const bytes = Buffer.from(imageBytesInBase64, "base64");

    const response = await fetch("https://api.nft.storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_NFT_STORAGE_API}`,
        "Content-Type": "image/jpg",
      },
      body: bytes,
    });

    const data = await response.json();
    const cid = data.value.cid;

    return cid as string;
  };

  const uploadMetadata = async (
    name: string,
    description: string,
    imageCID: string
  ): Promise<string> => {
    const response = await fetch("https://api.nft.storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.EXPO_PUBLIC_NFT_STORAGE_API}`,
      },
      body: JSON.stringify({
        name,
        description,
        image: `https://ipfs.io/ipfs/${imageCID}`,
      }),
    });

    const data = await response.json();
    const cid = data.value.cid;

    return cid;
  };

  const createNFT = async (
    name: string,
    description: string,
    fileUri: string
  ) => {
    if (!metaplex || !account || isLoading) return;

    setIsLoading(true);
    try {
      const imageCID = await uploadImage(fileUri);
      const metadataCID = await uploadMetadata(name, description, imageCID);

      const nft = await metaplex.nfts().create({
        uri: `https://ipfs.io/ipfs/${metadataCID}`,
        name: name,
        sellerFeeBasisPoints: 0,
      });

      setNftOfTheDay(nft.nft);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const publicKey = account?.publicKey ?? null;

  const state = {
    isLoading,
    account,
    publicKey,
    metaplex,
    nftOfTheDay,
    loadedNFTs,
    connect,
    fetchNFTs,
    createNFT,
  };

  return <NFTContext.Provider value={state}>{children}</NFTContext.Provider>;
}

export const useNFT = (): NFTContextState => useContext(NFTContext);
```

### 2. Écran principal

Notre écran principal se composera de trois parties : l'image du jour, notre bouton d'action, et le carrousel des photos précédentes.

L'image du jour est affichée dans la moitié supérieure de l'application, le bouton d'action juste en dessous, et le carrousel en dessous de cela.

Le bouton d'action suit l'état de notre `NFTProvider` : d'abord `connect`, puis `fetchNFTs`, et enfin `mintNFT`. De ceux-ci, nous n'avons besoin de faire un travail supplémentaire que pour `mintNFT`.

La fonction `mintNFT` utilise la bibliothèque Expo pour ouvrir l'appareil photo avec `ImagePicker.launchCameraAsync`. Lorsqu'une image est prise, son chemin local est renvoyé. La dernière chose à faire est de spécifier quand l'image a été prise. Ensuite, nous définirons le nom du NFT comme la date au format `MM.JJ.AA` et stockerons le timestamp Unix comme description. Enfin, nous transmettons le chemin de l'image, le nom et la description à notre fonction `createNFT` de `NFTProvider` pour créer le NFT.

```tsx
const mintNFT = async () => {
  
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (!result.canceled) {
    setCurrentImage({
      uri: result.assets[0].uri,
      date: todaysDate,
    });

    createNFT(
      formatDate(todaysDate),
      `${todaysDate.getTime()}`,
      result.assets[0].uri
    )
  }
};
```

Le code complet pour `MainScreen.tsx` est le suivant :
```tsx
import {
  View,
  Button,
  Image,
  StyleSheet,
  ScrollView,
  Text,
} from "react-native";
import React, { useEffect } from "react";
import { formatDate, useNFT } from "../components/NFTProvider";
import * as ImagePicker from 'expo-image-picker';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#292524'
  },
  titleText: {
    color: 'white'
  },
  topSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    paddingTop: 30,
  },
  imageOfDay: {
    width: "80%",
    height: "80%",
    resizeMode: "cover",
    margin: 10,
  },
  bottomSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  carousel: {
    justifyContent: "center",
    alignItems: "center",
  },
  carouselText: {
    textAlign: "center",
    color: 'white'
  },
  carouselImage: {
    width: 100,
    height: 100,
    margin: 5,
    resizeMode: "cover",
  },
});

export interface NFTSnapshot {
  uri: string;
  date: Date;
}

// Placeholder image URL or local source
const PLACEHOLDER: NFTSnapshot = {
  uri: "https://placehold.co/400x400/png",
  date: new Date(Date.now()),
};
const DEFAULT_IMAGES: NFTSnapshot[] = new Array(7).fill(PLACEHOLDER);

export function MainScreen() {
  const { fetchNFTs, connect, publicKey, isLoading, createNFT, loadedNFTs, nftOfTheDay } = useNFT();
  const [currentImage, setCurrentImage] = React.useState<NFTSnapshot>(PLACEHOLDER);
  const [previousImages, setPreviousImages] = React.useState<NFTSnapshot[]>(DEFAULT_IMAGES);
  const todaysDate = new Date(Date.now());

  useEffect(()=>{
    if(!loadedNFTs) return;

    const loadedSnapshots = loadedNFTs.map((loadedNft) => {
      if (!loadedNft.json) return null;
      if (!loadedNft.json.name) return null;
      if (!loadedNft.json.description) return null;
      if (!loadedNft.json.image) return null;

      const uri = loadedNft.json.image;
      const unixTime = Number(loadedNft.json.description);

      if(!uri) return null;
      if(isNaN(unixTime)) return null;

      return {
        uri: loadedNft.json.image,
        date: new Date(unixTime)
      } as NFTSnapshot;
    });
  
    // Filter out null values
    const cleanedSnapshots = loadedSnapshots.filter((loadedSnapshot) => {
      return loadedSnapshot !== null;
    }) as NFTSnapshot[];

    // Sort by date
    cleanedSnapshots.sort((a, b)=>{return b.date.getTime() - a.date.getTime()})
  
    setPreviousImages(cleanedSnapshots as NFTSnapshot[]);
  }, [loadedNFTs])

  useEffect(()=>{
    if(!nftOfTheDay) return;

    setCurrentImage({
      uri: nftOfTheDay.json?.image ?? '',
      date: todaysDate
    })
  }, [nftOfTheDay])

  const mintNFT = async () => {
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setCurrentImage({
        uri: result.assets[0].uri,
        date: todaysDate,
      });

      createNFT(
        formatDate(todaysDate),
        `${todaysDate.getTime()}`,
        result.assets[0].uri
      )
    }
  };

  const handleNFTButton = async () => {

    if (!publicKey) {
      connect();
    } else if(loadedNFTs === null){
      fetchNFTs();
    } else if(!nftOfTheDay){
      mintNFT();
    } else {
      alert('All done for the day!')
    }

  };

  const renderNFTButton = () => {
    let buttonText = '';
    if (!publicKey) buttonText = "Connect Wallet";
    else if (loadedNFTs === null) buttonText = "Fetch NFTs";
    else if(!nftOfTheDay) buttonText = "Create Snapshot";
    else buttonText = 'All Done!'
    
    if (isLoading) buttonText = "Loading...";

    return <Button title={buttonText} onPress={handleNFTButton} />;
  };

  const renderPreviousSnapshot = (snapshot: NFTSnapshot, index: number) => {
    const date = snapshot.date;
    const formattedDate = formatDate(date);

    return (
      <View key={index}>
        <Image source={snapshot} style={styles.carouselImage} />
        <Text style={styles.carouselText}>{formattedDate}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Half */}
      <View style={styles.topSection}>
        <Text style={styles.titleText}>Mint-A-Day</Text>
        <Image source={currentImage} style={styles.imageOfDay} />
        {renderNFTButton()}
      </View>

      {/* Bottom Half */}
      <View style={styles.bottomSection}>
        <ScrollView horizontal contentContainerStyle={styles.carousel}>
          {previousImages.map(renderPreviousSnapshot)}
        </ScrollView>
      </View>
    </View>
  );
}
```

### 3. Test

Maintenant, il est temps de créer notre premier instantané ! Tout d'abord, ouvrez votre portefeuille activé pour Devnet et assurez-vous d'avoir un peu de SOL. Ensuite, appuyez sur `Connect Wallet` et approuvez l'application. Récupérez tous les NFT en appuyant sur `Fetch NFTs`. Enfin, appuyez sur `Create Snapshot` pour télécharger et créer.

Félicitations ! Ce n'était pas un atelier facile ou rapide. Vous vous en sortez bien si vous avez réussi à aller jusqu'ici. Si vous rencontrez des problèmes, n'hésitez pas à revenir en arrière dans l'atelier et/ou à consulter le code de solution finale sur la [branche `main` de Github](https://github.com/Unboxed-Software/solana-advance-mobile).

# Défi

Maintenant, c'est à votre tour. Créez votre propre application Expo à partir de zéro. Vous êtes libre de choisir la vôtre, ou vous pouvez choisir parmi les idées suivantes :

- Au lieu d'un instantané d'image quotidien, créez une application qui permet aux utilisateurs d'écrire une entrée de journal pour la journée, puis de la créer comme un NFT.
- Créez une application de visualisation de base des NFT pour voir toutes vos merveilleuses images JPEG.
- Faites un clone simplifié de [Stepn](https://stepn.com/) en utilisant le podomètre de `expo-sensors`.

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=19cf8d3a-89a0-465e-95da-908cf8f45409) !

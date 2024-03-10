---
title: Exploration de l'Adaptateur de Portefeuille Mobile
objectives:
- Décrire les différences entre la connexion à un portefeuille web et à un portefeuille mobile
- Se connecter et signer des transactions depuis un portefeuille mobile
- Créer un simple portefeuille mobile
- Expliquer de manière générale l'interaction entre `walletlib` et les applications de portefeuille
---

# Résumé
- Les portefeuilles ne sont que des enveloppes autour d'une paire de clés, mais ils sont essentiels pour une gestion sécurisée des clés
- Les dApps mobiles et web gèrent différemment leur connexion avec le portefeuille
- MWA gère toute son interaction avec le portefeuille dans la fonction `transact`
- La bibliothèque `walletlib` de Solana Mobile fait le gros du travail pour rendre les demandes de portefeuille visibles aux applications de portefeuille

# Aperçu général

Les portefeuilles existent pour protéger vos clés secrètes. Alors que certaines applications peuvent avoir des clés spécifiques à l'application, de nombreux cas d'utilisation de la crypto reposent sur une identité unique utilisée à travers plusieurs applications. Dans ces cas, vous devez faire attention à la manière dont vous exposez la signature à travers ces applications. Vous ne voulez pas partager votre clé secrète avec toutes, ce qui signifie que vous avez besoin d'une norme permettant aux applications de soumettre des transactions pour signature à une application de portefeuille sécurisée qui détient votre clé secrète. C'est là que l'Adaptateur de Portefeuille Mobile (MWA) intervient. Il s'agit de la couche de transport pour connecter vos dApps mobiles à votre portefeuille.

## Qu'est-ce que MWA

L'Adaptateur de Portefeuille Mobile (MWA) est la connexion mobile entre les dApps et les portefeuilles. Tout comme le [wallet adapter](https://github.com/solana-labs/wallet-adapter) que nous connaissons sur le web, MWA nous permet de créer des dApps mobiles natives. Cependant, étant donné que le web et le mobile sont des plates-formes différentes, nous devons aborder différemment la connexion entre l'application et le portefeuille.

Au fond, une application de portefeuille est assez simple. C'est une enveloppe sécurisée autour de votre paire de clés. Les applications externes peuvent demander au portefeuille de signer des transactions sans jamais avoir accès à votre clé privée. Les adaptateurs de portefeuille web et mobile définissent cette interaction pour leurs plates-formes respectives.

### Comment fonctionne un portefeuille web ?

Un portefeuille web est simplement une extension de navigateur qui stocke des paires de clés et permet au navigateur de demander l'accès à ses fonctions. C'est au portefeuille de suivre la [norme de portefeuille](https://github.com/wallet-standard/wallet-standard), qui définit les fonctions qui devraient être disponibles pour le navigateur :

- `registerWallet`
- `getWallets`
- `signAndSendTransaction`
- `signIn`
- `signTransaction`
- `signMessage`

Ces fonctions sont toutes accessibles au navigateur via l'objet global `window`. L'extension de navigateur s'enregistre en tant que portefeuille. L'adaptateur de portefeuille recherche ces portefeuilles enregistrés et permet au client de se connecter et d'interagir avec eux.

Un portefeuille d'extension de navigateur peut exécuter du JavaScript isolé. Cela signifie qu'il peut injecter des fonctions dans l'objet `window` du navigateur. Fondamentalement, la couche de transport ici est simplement du code JavaScript supplémentaire du point de vue du navigateur.

Si vous souhaitez en savoir plus sur le fonctionnement des extensions de navigateur, jetez un œil à certaines [extensions de navigateur open source](https://github.com/solana-labs/browser-extension/tree/master).

### Comment MWA diffère des portefeuilles web

L'Adaptateur de Portefeuille Mobile (MWA) est différent. Dans le monde web, nous devons simplement injecter du code dans l'objet `window` pour accéder à nos portefeuilles. Cependant, les applications mobiles sont sandboxées. Cela signifie que le code de chaque application est isolé des autres applications. Il n'y a pas d'état partagé entre les applications qui serait analogue à l'objet `window` d'un navigateur. Cela pose un problème pour la signature du portefeuille car un portefeuille mobile et une dApp mobile existent dans des environnements isolés.

Cependant, il existe des moyens de faciliter la communication si vous êtes prêt à être créatif. Sur Android, la communication inter-app de base se fait à travers les [`Intents`](https://developer.android.com/guide/components/intents-filters). Un Intent Android est un objet de messagerie utilisé pour demander une action à un autre composant d'application.

Cette communication particulière est unilatérale, alors que l'interface pour la fonctionnalité du portefeuille nécessite une communication bidirectionnelle. MWA contourne cela en utilisant un intent de l'application demandant pour déclencher l'ouverture de la communication bidirectionnelle par le biais de WebSockets.

Le reste de cette leçon se concentrera sur l'interface et la fonctionnalité de MWA plutôt que sur les mécanismes de bas niveau sous-tendant la communication inter-app. Cependant, si vous voulez connaître les détails, lisez les [spécifications de MWA](https://solana-mobile.github.io/mobile-wallet-adapter/spec/spec.html).

## Comment travailler avec MWA

Les différences entre MWA et l'adaptateur de portefeuille traditionnel nécessitent de légères modifications dans la façon dont vous programmez vos applications.

### Se connecter à un portefeuille

Par comparaison, regardez l'exemple de connexion à un portefeuille avec React par rapport à React Native.

Sur le web, vous enveloppez l'application avec `WalletProvider`, puis les enfants accèdent au portefeuille via le crochet `useWallet`. De là, les enfants peuvent visualiser, sélectionner, connecter et interagir avec les portefeuilles.

```tsx
// Parent
<WalletProvider wallets={wallets}>
  {children}
</WalletProvider>

// Enfant
const {wallets, select, connect} = useWallet();
const wallet = wallets[0] // choisissez un portefeuille
select(wallet); // sélectionnez le portefeuille
connect(); // connectez-vous
```

En React Native, en utilisant MWA, cela est fait un peu différemment. Dans ce cas, les fournisseurs ne sont pas nécessaires. Au lieu de cela, le contexte du portefeuille est fourni via la fonction `transact` du package MWA. En coulisses, cette fonction recherche les appareils pour des portefeuilles Solana actifs. Elle les expose à l'utilisateur via une boîte de dialogue de sélection partielle. Une fois que l'utilisateur sélectionne un portefeuille, ce portefeuille est fourni en tant qu'argument à la callback de `transact`. Votre code peut ensuite interagir directement avec le portefeuille.

```tsx
transact(async (wallet: Web3MobileWallet) => { 
  // vous renvoie le contexte du portefeuille sélectionné par l'utilisateur
});
```

### Autoriser un portefeuille

Sur le web, la première fois que vous connectez un portefeuille à un site dans votre navigateur, le portefeuille vous demande d'autoriser le site. De manière similaire, sur mobile, l'application demandante doit être autorisée avant de pouvoir demander des méthodes *privilégiées* comme la signature d'une transaction.

Votre code peut déclencher ce processus d'autorisation en appelant `wallet.authorize()`. L'utilisateur sera invité à accepter ou rejeter la demande d'autorisation. Le `AuthorizationResult` retourné indiquera l'acceptation ou le rejet de l'utilisateur. S'il est accepté, cet objet résultant vous fournit le compte de l'utilisateur ainsi qu'un `auth_token` que vous pouvez utiliser dans `wallet.reauthorize()` pour les appels ultérieurs. Ce jeton d'authentification garantit que d'autres applications ne peuvent pas prétendre être votre application.

```tsx
transact(async (wallet: Web3MobileWallet) => { 
  const authResult = wallet.authorize(
    {
      cluster: "devnet", 
      identity: { name: 'Solana Counter Incrementor' }
    }
  ); // Autorise le portefeuille

  const authToken = authResult.auth_token; // enregistrez ceci pour la fonction wallet.reauthorize()
  const publicKey = authResult.selectedAccount.publicKey
});
```

Il est important de noter que toutes les méthodes sauf `authorize` et `deauthorize` sont des méthodes *privilégiées*. Vous voudrez donc suivre si un portefeuille est autorisé ou non et appeler `wallet.reauthorize()` quand il l'est. Voici un exemple simple qui suit l'état d'autorisation :

```tsx
const APP_IDENTITY = {name: 'Solana Counter Incrementor'}
const [auth, setAuth] = useState<string | null>(null)

transact(async (wallet: Web3MobileWallet) => {
  let authResult;

  if(auth){
    authResult = wallet.reauthorize({
      auth_token: auth,
      identity: APP_IDENTITY,
    })
  } else {
    authResult = wallet.authorize(
      {
        cluster: "devnet", 
        identity: APP_IDENTITY
      }
    );

    setAuth(authResult.auth_token)
  }

  const publicKey = authResult.selectedAccount.publicKey
});
```

Notez que l'exemple ci-dessus ne gère pas les erreurs ou les rejets de l'utilisateur. En production, il est conseillé d'encapsuler l'état d'autorisation et les méthodes avec un crochet personnalisé `useAuthorization`. Pour référence, nous avons construit cela [dans la leçon précédente](./basic-solana-mobile.md#5-create-authprovidertsx).

### Interagir avec un portefeuille

Contrairement à la connexion et à l'autorisation des portefeuilles, les méthodes de demande comme `signAndSendTransactions`, `signMessages` et `signTransactions` sont pratiquement les mêmes entre le web et le mobile.

Sur le web, vous pouvez accéder à ces méthodes avec le crochet `useWallet`. Vous devez simplement vous assurer d'être connecté avant de les appeler :

```tsx
const { connected, signAllTransactions, signMessage, sendTransaction } = useWallet();

if ( connected ) {
  signAllTransactions(...);
  signMessage(...);
  sendTransaction(...);
}
```

Pour MWA, appelez simplement les fonctions sur le contexte `wallet` fourni par le rappel `transact` :

```tsx
const APP_IDENTITY = {name: 'Solana Counter Incrementor'}
const [auth, setAuth] = useState<string | null>(null)

transact(async (wallet: Web3MobileWallet) => {
  let authResult;
  
  if ( auth ) {
    authResult = wallet.reauthorize({
          auth_token: auth,
          identity: APP_IDENTITY,
    })
  } else {
    authResult = wallet.authorize(
      {
        cluster: "devnet", 
        identity: APP_IDENTITY
      }
    ); 
    setAuth(authResult.auth_token)
  }

  const publicKey = authResult.selectedAccount.publicKey

  // Choisissez votre interaction...
  wallet.signAndSendTransactions(...)
  wallet.signMessages(...)
  wallet.signTransactions(...)
});
```

Chaque fois que vous voulez appeler ces méthodes, vous devrez appeler `wallet.authorize()` ou `wallet.reauthorize()`.

Et voilà ! Vous devriez avoir suffisamment d'informations pour commencer. L'équipe mobile de Solana a travaillé dur pour rendre l'expérience de développement aussi fluide que possible entre les deux plates-formes.

## Ce que MWA fait du côté du portefeuille

Cette leçon a principalement traité de ce que MWA fait dans les dApps, mais une grande partie de la fonctionnalité de MWA se trouve dans les portefeuilles. Que vous souhaitiez créer votre propre portefeuille ou simplement comprendre le système plus en détail, il est intéressant de discuter de ce que font les portefeuilles compatibles avec MWA au niveau élevé. Pour la plupart des lecteurs, il n'est pas essentiel de penser pouvoir créer un portefeuille après avoir parcouru ces sections ; essayez simplement d'avoir une idée de l'ensemble du processus.

### Introduction à `walletlib`

Solana Mobile a fait la majeure partie du travail en créant le `mobile-wallet-adapter-walletlib`. Cette bibliothèque gère toute la communication de bas niveau entre les dApps et les portefeuilles. Cependant, ce package est toujours en développement et n'est pas disponible via npm. Sur leur GitHub :

>This package is still in alpha and is not production ready. However, the API is stable and will not change drastically, so you can begin integration with your wallet.

Cependant, `walletlib` ne fournit pas d'interface utilisateur pour vous ni ne détermine le résultat des requêtes. Il expose plutôt un hook permettant au code du portefeuille de recevoir et de résoudre les requêtes. Le développeur du portefeuille est responsable d'afficher l'interface utilisateur appropriée, de gérer le comportement du portefeuille et de résoudre correctement chaque requête.

### Comment les portefeuilles utilisent `walletlib`

Fondamentalement, les portefeuilles utilisent `walletlib` en appelant une seule fonction : `useMobileWalletAdapterSession`. Lors de l'appel de cette fonction, les portefeuilles fournissent ce qui suit :
1. Le nom du portefeuille
2. Un objet de configuration de type `MobileWalletAdapterConfig`
3. Un gestionnaire de requêtes
4. Un gestionnaire d'événements de session

Voici un exemple de composant qui montre la façon dont les portefeuilles se connectent à `walletlib` :

```tsx
import { useCallback, useMemo } from 'react';
import { Text } from 'react-native';
import { WalletProvider } from './components/WalletProvider';
import { MWARequest, MWASessionEvent, MobileWalletAdapterConfig, useMobileWalletAdapterSession } from './lib/mobile-wallet-adapter-walletlib/src';

function MWAApp(){

  const config: MobileWalletAdapterConfig = useMemo(() => {
    return {
      supportsSignAndSendTransactions: true,
      maxTransactionsPerSigningRequest: 10,
      maxMessagesPerSigningRequest: 10,
      supportedTransactionVersions: [0, 'legacy'],
      noConnectionWarningTimeoutMs: 3000,
    };
  }, []);

  const handleRequest = useCallback((request: MWARequest) => {
  }, []);

  const handleSessionEvent = useCallback((sessionEvent: MWASessionEvent) => {
  }, []);

  useMobileWalletAdapterSession(
    'React Native Fake Wallet',
    config,
    handleRequest,
    handleSessionEvent,
  );

  return (
    <Text>I'm a wallet!</Text>
  );
};

export default MWAApp;
```

Si vous deviez créer votre propre portefeuille, vous modifieriez l'objet `config` et implémenteriez les gestionnaires `handleRequest` et `handleSessionEvent` en conséquence. Bien que tous ces éléments soient requis et importants, l'élément principal est le gestionnaire de requêtes. C'est là que les portefeuilles fournissent la logique de mise en œuvre pour chaque requête, par exemple, comment gérer une demande d'autorisation d'une dApp ou comment signer et envoyer une transaction à la demande du portefeuille.

Par exemple, si la requête est de type `MWARequestType.SignAndSendTransactionsRequest`, alors votre code utiliserait la clé secrète de l'utilisateur pour signer la transaction fournie par la requête, envoyer la requête à un fournisseur RPC, puis répondre à la dApp demandant à l'aide d'une fonction `resolve`.

La seule chose que fait la fonction `resolve` est d'informer la dApp de ce qui s'est passé et de fermer la session. La fonction `resolve` prend deux arguments : `request` et `response`. Les types de `request` et `response` sont différents en fonction de la requête initiale. Donc, dans l'exemple de `MWARequestType.SignAndSendTransactionsRequest`, vous utiliseriez la fonction de résolution suivante :

```ts
export function resolve(request: SignAndSendTransactionsRequest, response: SignAndSendTransactionsResponse): void;
```

Le type `SignAndSendTransactionsResponse` est défini comme suit :

```ts
export type SignAndSendTransactionsCompleteResponse = Readonly<{ signedTransactions: Uint8Array[] }>;
export type SignAndSendTransactionsResponse =
  | SignAndSendTransactionsCompleteResponse
  | UserDeclinedResponse
  | TooManyPayloadsResponse
  | AuthorizationNotValidResponse
  | InvalidSignaturesResponse;
```

La réponse que vous enverrez dépendra du résultat de la tentative de signature et d'envoi de la transaction.

Vous pouvez explorer le [code source de `walletlib`](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/js/packages/mobile-wallet-adapter-walletlib) si vous souhaitez connaître tous les types associés à `resolve`.

Un dernier point est que le composant utilisé pour interagir avec `walletlib` doit également être enregistré dans le fichier `index.js` de l'application en tant que point d'entrée MWA pour l'application.

```js
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import MWAApp from './MWAApp'

// Fonctions d'écoute d'événements fictifs pour les empêcher de provoquer une erreur fatale.
window.addEventListener = () => {};
window.removeEventListener = () => {};

AppRegistry.registerComponent(appName, () => App);

// Enregistrer le composant MWA
AppRegistry.registerComponent(
'MobileWalletAdapterEntrypoint',
  () => MWAApp,
);
```

## Conclusion

Bien que la MWA soit légèrement différente de la norme du portefeuille web, une fois que vous comprenez les nuances entre elles, il devient assez simple de mettre en œuvre l'interaction avec le portefeuille mobile. Cela devient particulièrement vrai lorsque vous comprenez ce que MWA fait non seulement dans votre dApp mais aussi dans les portefeuilles. Si quelque chose reste obscur pour vous, prenez le temps de vous familiariser avec les deux côtés de l'équation.

# Laboratoire

Passons maintenant à la pratique en construisant un portefeuille mobile. L'objectif ici est de voir ce qui se passe des deux côtés du processus MWA afin de démystifier la relation entre l'application et le portefeuille.

### 0. Configurer l'environnement de développement si nécessaire

Avant de commencer à programmer notre portefeuille, nous devons effectuer quelques réglages. Vous aurez besoin d'un environnement de développement React Native et d'une dApp Solana pour tester. Si vous avez terminé la [leçon de base sur Solana Mobile](./basic-solana-mobile), ces deux exigences devraient être satisfaites avec l'application de compteur installée sur votre appareil Android/émulateur.

Si vous n'avez pas terminé la dernière leçon, vous devrez :

1. Configurer un [environnement de développement React Native pour Android](https://reactnative.dev/docs/environment-setup) avec un appareil ou un émulateur.
2. Installer une [dApp Solana Devnet](https://github.com/Unboxed-Software/solana-react-native-counter.git).

Si vous souhaitez installer l'application de la leçon précédente, vous pouvez exécuter les commandes suivantes :

```bash
git clone https://github.com/Unboxed-Software/solana-react-native-counter.git
cd solana-react-native-counter
git checkout solution
npm run install
```

### 1. Planifier la structure de l'application

Nous construisons le portefeuille à partir de zéro, examinons donc nos principaux blocs de construction.

Tout d'abord, nous créerons le véritable portefeuille (la fenêtre contextuelle n'est pas incluse). Cela comprendra la création ou la modification des éléments suivants :
- WalletProvider.tsx
- MainScreen.tsx
- App.tsx

Ensuite, nous créerons une application MWA générique qui affiche "Je suis un portefeuille" chaque fois que le portefeuille est demandé par une dApp différente. Cela inclura la création ou la modification des éléments suivants :
- MWAApp.tsx
- index.js

Ensuite, nous mettrons en place toute notre interface utilisateur et le routage des requêtes. Cela signifiera la création ou la modification des éléments suivants :
- MWAApp.tsx
- ButtonGroup.tsx
- AppInfo.tsx

Enfin, nous implémenterons deux fonctions de requête réelles, autoriser et signer et envoyer des transactions. Cela implique de créer les éléments suivants :
- AuthorizeDappRequestScreen.tsx
- SignAndSendTransactionScreen.tsx

### 2. Mettre en place l'application

Créons la structure de l'application avec :

```bash
npx react-native@latest init wallet --npm
cd wallet
```

Maintenant, installons nos dépendances. Il s'agit des mêmes dépendances que dans notre [Introduction au laboratoire Solana Mobile](./basic-solana-mobile.md#2-create-the-app) avec deux ajouts :
- `@react-native-async-storage/async-storage` : fournit l'accès au stockage sur l'appareil
- `fast-text-encoding` : une polyfill pour l'encodage de texte

Nous utiliserons `async-storage` pour stocker notre paire de clés afin que le portefeuille persiste à travers plusieurs sessions. Il est important de noter que `async-storage` n'est ***PAS*** un endroit sûr pour stocker vos clés en production. Encore une fois, ***NE*** l'utilisez ***PAS*** en production. Au lieu de cela, jetez un œil au [système de stockage sécurisé d'Android](https://developer.android.com/privacy-and-security/keystore).

Installez ces dépendances avec la commande suivante :

```bash
npm install \
  @solana/web3.js \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \
  react-native-get-random-values \
  buffer \
  @coral-xyz/anchor \
  assert \
  bs58 \
  @react-native-async-storage/async-storage \
  fast-text-encoding
```

L'étape suivante est un peu compliquée. Nous devons dépendre du package `mobile-wallet-adapter-walletlib` de Solana, qui gère toute la communication de bas niveau. Cependant, ce package est toujours en développement et n'est pas disponible via npm. Depuis leur github :

> This package is still in alpha and is not production ready. However, the API is stable and will not change drastically, so you can begin integration with your wallet.

Cependant, nous avons extrait le package et l'avons rendu disponible sur GitHub. Si vous êtes intéressé par la manière dont nous avons fait cela, consultez le README [sur le dépôt GitHub où nous avons rendu ce package disponible](https://github.com/Unboxed-Software/mobile-wallet-adapter-walletlib)

Installons le package dans un nouveau dossier `lib` :

```bash
mkdir lib
cd lib
git clone https://github.com/Unboxed-Software/mobile-wallet-adapter-walletlib.git
```

Ensuite, nous devons le lier manuellement en ajoutant `@solana-mobile/mobile-wallet-adapter-walletlib` aux dépendances de notre fichier `package.json` avec le chemin du fichier en tant que résolution :

```json
"dependencies": {
    ...
    "@solana-mobile/mobile-wallet-adapter-walletlib": "file:./lib/mobile-wallet-adapter-walletlib",
    ...
}
```

Informez npm du nouveau package en installant à nouveau à la racine de votre projet :

```bash
cd ..
npm install
```

Ensuite, dans `android/build.gradle`, changez la `minSdkVersion` à la version `23`.
```gradle
  minSdkVersion = 23
```

Enfin, terminez la configuration initiale en construisant l'application. Vous devriez voir l'application React Native par défaut s'afficher sur votre appareil.

```bash
npm run android
```

Si vous rencontrez des erreurs, assurez-vous de vérifier que vous avez suivi toutes les étapes ci-dessus.

### 3. Création de l'application principale de portefeuille

L'application de portefeuille que nous allons construire comporte deux parties :
1. L'interface utilisateur à afficher lors de l'ouverture manuelle de l'application de portefeuille.
2. L'interface utilisateur à afficher en tant que feuille inférieure lorsqu'une application distincte demande l'utilisation du portefeuille.

Tout au long de ce laboratoire, nous les appellerons respectivement "application principale de portefeuille" et "popup de portefeuille".

- Générer une `Keypair` lorsque l'application se charge pour la première fois.
- Afficher l'adresse et le solde Devnet SOL.
- Permettre aux utilisateurs de recevoir quelques Devnet SOL sur leur portefeuille.

Tout cela peut être réalisé en créant deux fichiers :

- `WalletProvider.tsx` - Génère une `Keypair` et la stocke dans `async-storage`, puis récupère la paire de clés lors de sessions ultérieures. Il fournit également la `Connection` Solana.
- `MainScreen.tsx` - Affiche le portefeuille, son solde et un bouton d'airdrop.

Commençons par le fichier `WalletProvider.tsx`. Ce fichier utilisera `async-storage` pour stocker une version encodée en base58 d'une `Keypair`. Le fournisseur vérifiera la clé de stockage `@my_fake_wallet_keypair_key`. Si rien n'est retourné, le fournisseur doit générer et stocker une paire de clés. Le `WalletProvider` renverra ensuite son contexte comprenant le `wallet` et la `connection`. Le reste de l'application peut accéder à ce contexte en utilisant le crochet `useWallet()`.

***ENCORE UNE FOIS***, le stockage asynchrone n'est pas adapté pour stocker des clés privées en production. Veuillez utiliser quelque chose comme [le système de trousseau d'Android](https://developer.android.com/privacy-and-security/keystore).

Créons le fichier `WalletProvider.tsx` dans un nouveau répertoire nommé `components` :

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Connection, Keypair} from '@solana/web3.js';
import {encode, decode} from 'bs58';
import {ReactNode, createContext, useContext, useEffect, useState} from 'react';

const ASYNC_STORAGE_KEY = '@my_fake_wallet_keypair_key';

interface EncodedKeypair {
  publicKeyBase58: string;
  secretKeyBase58: string;
};


function encodeKeypair(keypair: Keypair): EncodedKeypair {
  return {
    publicKeyBase58: keypair.publicKey.toBase58(),
    secretKeyBase58: encode(keypair.secretKey),
  };
};

function decodeKeypair(encodedKeypair: EncodedKeypair): Keypair {
  const secretKey = decode(encodedKeypair.secretKeyBase58);
  return Keypair.fromSecretKey(secretKey);
};

export interface WalletContextData {
  wallet: Keypair | null;
  connection: Connection;
};

const WalletContext = createContext<WalletContextData>({
  wallet: null,
  connection: new Connection('https://api.devnet.solana.com'),
});

export const useWallet = () => useContext(WalletContext);

export interface WalletProviderProps {
  rpcUrl?: string;
  children: ReactNode;
}

export function WalletProvider(props: WalletProviderProps){
  const { rpcUrl, children } = props;
  const [keyPair, setKeyPair] = useState<Keypair | null>(null);

  const fetchOrGenerateKeypair = async () => {
    try {
      const storedKey = await AsyncStorage.getItem(ASYNC_STORAGE_KEY);
      let keyPair;
      if (storedKey && storedKey !== null) {
        const encodedKeypair: EncodedKeypair = JSON.parse(storedKey);
        keyPair = decodeKeypair(encodedKeypair);
      } else {
        // Génère une nouvelle paire de clés aléatoires et les stocke dans le stockage local pour une récupération ultérieure
        // Ce n'est pas sécurisé ! Le stockage asynchrone est utilisé à des fins de démonstration. Ne stockez jamais les clés de cette manière !
        keyPair = await Keypair.generate();
        await AsyncStorage.setItem(
          ASYNC_STORAGE_KEY,
          JSON.stringify(encodeKeypair(keyPair)),
        );
      }
      setKeyPair(keyPair);
    } catch (e) {
      console.log('erreur lors de la récupération de la paire de clés : ', e);
    }
  };

  useEffect(() => {
    fetchOrGenerateKeypair();
  }, []);

  const value = {
    wallet: keyPair,
    connection: new Connection(rpcUrl ?? 'https://api.devnet.solana.com'),
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
```

Notez que nous définissons par défaut notre `rpcUrl` sur Devnet.

Maintenant, créons le fichier `MainScreen.tsx`. Il devrait simplement récupérer le `wallet` et la `connection` à partir de `useWallet()`, puis afficher l'adresse et le solde. De plus, comme toutes les transactions nécessitent des frais de transaction en SOL, nous inclurons également un bouton de airdrop.

Créez un nouveau répertoire appelé `screens` et un nouveau fichier appelé `MainScreen.tsx` à l'intérieur :
```tsx
import {Button, StyleSheet, Text, View} from 'react-native';
import {useWallet} from '../components/WalletProvider';
import {useEffect, useState} from 'react';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center', // Centre les enfants le long de l'axe principal (verticalement pour une colonne)
    alignItems: 'center', // Centre les enfants le long de l'axe transversal (horizontalement pour une colonne)
  },
});

function MainScreen(){
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<null | number>(null);
  const {wallet, connection} = useWallet();

  useEffect(() => {
    updateBalance();
  }, [wallet]);

  const updateBalance = async () => {
    if (wallet) {
      await connection.getBalance(wallet.publicKey).then(lamports => {
        setBalance(lamports / LAMPORTS_PER_SOL);
      });
    }
  };

  const airdrop = async () => {
    if (wallet && !isLoading) {
      setIsLoading(true);
      try {
        const signature = await connection.requestAirdrop(
          wallet.publicKey,
          LAMPORTS_PER_SOL,
        );
        await connection.confirmTransaction(signature, 'max');
        await updateBalance();
      } catch (e) {
        console.log(e);
      }

      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text>Portefeuille :</Text>
      <Text>{wallet?.publicKey.toString() ?? 'Pas de portefeuille'}</Text>
      <Text>Solde :</Text>
      <Text>{balance?.toFixed(5) ?? ''}</Text>
      {isLoading && <Text>Chargement...</Text>}
      {balance != null && !isLoading && balance < 0.005 && (
        <Button title="Airdrop 1 SOL" onPress={airdrop} />
      )}
    </View>
  );
};

export default MainScreen;
```

Enfin, modifions le fichier `App.tsx` pour compléter la section 'application' de notre portefeuille :

```tsx
import {SafeAreaView, Text, View} from 'react-native';
import MainScreen from './screens/MainScreen';
import 'react-native-get-random-values';
import { WalletProvider } from './components/WalletProvider';
import React from 'react';

function App(): JSX.Element {
  return (
      <SafeAreaView>
        <WalletProvider>
          <MainScreen />
        </WalletProvider>
      </SafeAreaView>
  );
}

export default App;
```

Assurez-vous que tout fonctionne en construisant et en déployant :

```bash
npm run android
```

### 4. Création de composants d'aide

Maintenant, faisons un bref détour et créons quelques composants d'interface utilisateur d'aide dont nous aurons besoin pour la popup de portefeuille. Nous définirons une mise en page pour du texte avec `AppInfo.tsx` et des boutons dans `ButtonGroup.tsx`.

Tout d'abord, `AppInfo.tsx` nous montrera des informations pertinentes provenant de l'application demandant une connexion de portefeuille. Allez-y et créez le fichier suivant en tant que `components/AppInfo.tsx` :

```tsx
import { Text, View } from 'react-native';

interface AppInfoProps {
  title?: string;
  cluster?: string;
  appName?: string;
  scope?: string;
}

function AppInfo(props: AppInfoProps) {
  const {title, cluster, appName, scope} =
    props;
  return (
    <>
      <Text>{title}</Text>
      <View>
        <Text>Métadonnées de la demande</Text>
        <Text>Cluster : {cluster ? cluster : 'NA'}</Text>
        <Text>Nom de l'application : {appName ? appName : 'NA'}</Text>
        <Text>Portée : {scope ? scope : 'NA'}</Text>
      </View>
    </>
  );
}

export default AppInfo;
```

Ensuite, créons un composant qui regroupe un bouton "accepter" et "refuser" en tant que `components/ButtonGroup.tsx` :

```tsx
import { Button, Dimensions, StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({
  button: {flex: 1, marginHorizontal: 8},
  buttonGroup: {
    width: Dimensions.get('window').width,
    display: 'flex',
    flexDirection: 'row',
    marginVertical: 16,
  },
});

interface ButtonGroupProps {
  positiveOnClick: () => any;
  negativeOnClick: () => any;
  positiveButtonText: string;
  negativeButtonText: string;
}
const ButtonGroup = (props: ButtonGroupProps) => {
  return (
    <View style={styles.buttonGroup}>
      <Button
        onPress={props.positiveOnClick}
        title={props.positiveButtonText}
      />
      <Button
        onPress={props.negativeOnClick}
        title={props.negativeButtonText}
      />
    </View>
  );
};

export default ButtonGroup;
```

### 5. Créer le modèle de base de la fenêtre contextuelle du portefeuille

La fenêtre contextuelle du portefeuille est ce qui est affiché lorsqu'une dApp Solana envoie une intention pour `solana-wallet://`. Notre portefeuille écoutera cela, établira une connexion et affichera la fenêtre contextuelle.

Heureusement, nous n'avons pas à mettre en œuvre quoi que ce soit de bas niveau. Solana a fait le travail difficile pour nous dans la bibliothèque `mobile-wallet-adapter-walletlib`. Tout ce que nous avons à faire, c'est créer la vue et gérer les demandes.

Commençons par l'ossature absolue de la fenêtre contextuelle. Elle ne fera que s'afficher lorsque qu'une dApp se connectera et dira simplement "Je suis un portefeuille".

Pour que cela s'affiche lorsque qu'une dApp Solana demande l'accès, nous aurons besoin de `useMobileWalletAdapterSession` de `walletlib`. Cela nécessite quatre éléments :

- `walletName` - le nom du portefeuille
- `config` - quelques configurations de portefeuille simples de type `MobileWalletAdapterConfig`
- `handleRequest` - une fonction callback pour gérer les demandes de la dApp
- `handleSessionEvent` - une fonction callback pour gérer les événements de session

Voici un exemple de la configuration minimale pour satisfaire `useMobileWalletAdapterSession` :
```tsx
const config: MobileWalletAdapterConfig = useMemo(() => {
  return {
    supportsSignAndSendTransactions: true,
    maxTransactionsPerSigningRequest: 10,
    maxMessagesPerSigningRequest: 10,
    supportedTransactionVersions: [0, 'legacy'],
    noConnectionWarningTimeoutMs: 3000,
  };
}, []);

const handleRequest = useCallback((request: MWARequest) => {
}, []);

const handleSessionEvent = useCallback((sessionEvent: MWASessionEvent) => {
}, []);

useMobileWalletAdapterSession(
  'React Native Fake Wallet',
  config,
  handleRequest,
  handleSessionEvent,
);
```

Nous allons implémenter `handleRequest` et `handleSessionEvent` bientôt, mais faisons d'abord fonctionner l'ossature de base de la fenêtre contextuelle.

Créez un nouveau fichier à la racine de votre projet appelé `MWAApp.tsx` :

```tsx
import {useCallback, useMemo } from 'react';
import { SafeAreaView, StyleSheet, Text, View} from 'react-native';
import { WalletProvider } from './components/WalletProvider';
import { MWARequest, MWASessionEvent, MobileWalletAdapterConfig, useMobileWalletAdapterSession } from './lib/mobile-wallet-adapter-walletlib/src';


const styles = StyleSheet.create({
  container: {
    margin: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: 'black',
  },
});

function MWAApp(){

  const config: MobileWalletAdapterConfig = useMemo(() => {
    return {
      supportsSignAndSendTransactions: true,
      maxTransactionsPerSigningRequest: 10,
      maxMessagesPerSigningRequest: 10,
      supportedTransactionVersions: [0, 'legacy'],
      noConnectionWarningTimeoutMs: 3000,
    };
  }, []);

  const handleRequest = useCallback((request: MWARequest) => {
  }, []);

  const handleSessionEvent = useCallback((sessionEvent: MWASessionEvent) => {
  }, []);

  useMobileWalletAdapterSession(
    'React Native Fake Wallet',
    config,
    handleRequest,
    handleSessionEvent,
  );

  return (
    <SafeAreaView>
      <WalletProvider>
        <View style={styles.container}>
          <Text style={{fontSize: 50}}>Je suis un portefeuille !</Text>
        </View>
      </WalletProvider>
    </SafeAreaView>
  );
};

export default MWAApp;
```

La dernière chose à faire est d'enregistrer notre application MWA en tant que point d'entrée dans `index.js` sous le nom `MobileWalletAdapterEntrypoint`.

Modifiez `index.js` comme suit :
```js
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import MWAApp from './MWAApp'

// Fonctions factices des écouteurs d'événements pour les empêcher de causer une défaillance.
window.addEventListener = () => {};
window.removeEventListener = () => {};

AppRegistry.registerComponent(appName, () => App);

// Enregistrez le composant MWA
AppRegistry.registerComponent(
  'MobileWalletAdapterEntrypoint',
  () => MWAApp,
);
```

Allez-y et testez cela pour vous assurer que cela fonctionne. Tout d'abord,

```bash
npm run android
```

Ouvrez votre dApp Solana Devnet, idéalement l'application `counter` de la leçon précédente, puis faites une demande.

Vous devriez voir une feuille apparaître en bas de l'écran avec le message "Je suis un portefeuille."

### 6. Créer l'infrastructure MWA

Faisons évoluer `MWAApp.tsx` pour mettre en place une partie de l'architecture qui permettra plus tard aux utilisateurs de se connecter, de signer et d'envoyer des transactions. Pour l'instant, nous ne le ferons que pour deux des fonctions MWA : `authorize` et `signAndSendTransaction`.

Pour commencer, ajoutons quelques éléments à `MWAApp.tsx` :

1. Gérer la gestion du cycle de vie en enregistrant la `currentRequest` et la `currentSession` dans un `useState`. Cela nous permettra de suivre le cycle de vie d'une connexion.
2. Ajouter un auditeur `hardwareBackPress` dans un `useEffect` pour gérer élégamment la fermeture de la fenêtre contextuelle. Cela devrait appeler `resolve` avec `MWARequestFailReason.UserDeclined`.
3. Écouter un `SessionTerminatedEvent` dans un `useEffect` pour fermer la fenêtre contextuelle. Cela devrait appeler `exitApp` sur le `BackHandler`. Nous ferons cela dans une fonction d'aide pour maintenir la fonctionnalité contenue.
4. Écouter une demande de type `ReauthorizeDappRequest` dans un `useEffect` et la résoudre automatiquement.
5. Rendre le contenu approprié pour les différents types de demandes avec `renderRequest()`. Cela devrait être une instruction `switch` qui routera vers une interface utilisateur différente en fonction du type de demande.

Modifiez votre `MWAApp.tsx` comme suit :

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WalletProvider } from './components/WalletProvider';
import {
  AuthorizeDappRequest,
  MWARequest,
  MWARequestFailReason,
  MWARequestType,
  MWASessionEvent,
  MWASessionEventType,
  MobileWalletAdapterConfig,
  ReauthorizeDappCompleteResponse,
  ReauthorizeDappResponse,
  SignAndSendTransactionsRequest,
  getCallingPackage,
  resolve,
  useMobileWalletAdapterSession,
} from './lib/mobile-wallet-adapter-walletlib/src';

const styles = StyleSheet.create({
  container: {
    margin: 0,
    width: '100%',
    backgroundColor: 'black',
    color: 'black',
  },
});

function MWAApp() {
  const [currentRequest, setCurrentRequest] = useState<MWARequest | null>(null);
  const [currentSession, setCurrentSession] = useState<MWASessionEvent | null>(
    null,
  );
  // ------------------- FONCTIONS --------------------

  const endWalletSession = useCallback(() => {
    setTimeout(() => {
      BackHandler.exitApp();
    }, 200);
  }, []);

  const handleRequest = useCallback((request: MWARequest) => {
    setCurrentRequest(request);
  }, []);

  const handleSessionEvent = useCallback((sessionEvent: MWASessionEvent) => {
    setCurrentSession(sessionEvent);
  }, []);

  // ------------------- EFFETS --------------------

  useEffect(() => {
    BackHandler.addEventListener('hardwareBackPress', () => {
      resolve(currentRequest as any, {
        failReason: MWARequestFailReason.UserDeclined,
      });
      return false;
    });
  }, []);

  useEffect(() => {
    if (currentSession?.__type == MWASessionEventType.SessionTerminatedEvent) {
      endWalletSession();
    }
  }, [currentSession]);

  useEffect(() => {
    if (!currentRequest) {
      return;
    }

    if (currentRequest.__type == MWARequestType.ReauthorizeDappRequest) {
      resolve(currentRequest, {
        authorizationScope: new TextEncoder().encode('app'),
      });
    }

  }, [currentRequest, endWalletSession]);

  // ------------------- MWA --------------------

  const config: MobileWalletAdapterConfig = useMemo(() => {
    return {
      supportsSignAndSendTransactions: true,
      maxTransactionsPerSigningRequest: 10,
      maxMessagesPerSigningRequest: 10,
      supportedTransactionVersions: [0, 'legacy'],
      noConnectionWarningTimeoutMs: 3000,
    };
  }, []);

  useMobileWalletAdapterSession(
    'React Native Fake Wallet',
    config,
    handleRequest,
    handleSessionEvent,
  );

  // ------------------- RENDU --------------------

  const renderRequest = () => {
    if (!currentRequest) {
      return <Text>Aucune demande</Text>;
    }
  
  
    switch (currentRequest?.__type) {
      case MWARequestType.AuthorizeDappRequest:
      case MWARequestType.SignAndSendTransactionsRequest:
      case MWARequestType.SignMessagesRequest:
      case MWARequestType.SignTransactionsRequest:
      default:
        return <Text>TODO Afficher l'écran pour {currentRequest?.__type}</Text>;
    }
  }

  // ------------------- RENDU --------------------

  return (
    <SafeAreaView>
      <WalletProvider>
        <View style={styles.container}>
          <Text>DEMANDE : {currentRequest?.__type.toString()}</Text>
          {renderRequest()}
        </View>
      </WalletProvider>
    </SafeAreaView>
  );
}

export default MWAApp;
```

Notez que `renderRequest` ne rend toujours rien d'utile. Nous devons encore *gérer* les différentes demandes.

### 7. Implémenter la fenêtre contextuelle d'autorisation

Créons notre première interface pour gérer les nouvelles autorisations. Le seul rôle de cette interface est de montrer quelle application souhaite une autorisation et de permettre à l'utilisateur d'accepter ou de refuser la demande en utilisant la fonction `resolve` de `walletlib`.

Nous utiliserons nos composants `AppInfo` et `ButtonGroup` pour composer toute notre interface utilisateur ici. Tout ce que nous avons à faire, c'est brancher les bonnes informations et écrire la logique pour accepter ou rejeter la demande.

Pour l'autorisation, la fonction `resolve` que nous utiliserons utilise les types `AuthorizeDappRequest` et `AuthorizeDappResponse`. `AuthorizeDappResponse` est une union des types `AuthorizeDappCompleteResponse` et `UserDeclinedResponse`. La définition de chacun est présentée ci-dessous :

```ts
export type AuthorizeDappResponse = AuthorizeDappCompleteResponse | UserDeclinedResponse;

export type AuthorizeDappCompleteResponse = Readonly<{
  publicKey: Uint8Array;
  accountLabel?: string;
  walletUriBase?: string;
  authorizationScope?: Uint8Array;
}>;

export type UserDeclinedResponse = Readonly<{
  failReason: MWARequestFailReason.UserDeclined;
}>;
```

Notre logique déterminera lequel utiliser lors de la résolution de la demande.

Maintenant que nous avons tout ce contexte, nous pouvons tout mettre ensemble dans un nouveau fichier appelé `screens/AuthorizeDappRequestScreen.tsx` :

```tsx
import 'fast-text-encoding';
import React from "react";
import { useWallet } from "../components/WalletProvider";
import { AuthorizeDappCompleteResponse, AuthorizeDappRequest, MWARequestFailReason, resolve } from "../lib/mobile-wallet-adapter-walletlib/src";
import AppInfo from "../components/AppInfo";
import ButtonGroup from "../components/ButtonGroup";
import { Text, View } from "react-native";

export interface AuthorizeDappRequestScreenProps {
  request: AuthorizeDappRequest;
}

function AuthorizeDappRequestScreen(props: AuthorizeDappRequestScreenProps){
  const { request } = props;
  const { wallet } = useWallet();

  if ( ! wallet ) {
    throw new Error('No wallet found')
  }


  const authorize = () => {
    resolve(request, {
      publicKey: wallet?.publicKey.toBytes(),
      authorizationScope: new TextEncoder().encode("app"),
    } as AuthorizeDappCompleteResponse);
  }

  const reject = () => { 
    resolve(request, {
      failReason: MWARequestFailReason.UserDeclined,
    });
  }


  return (
    <View >
      <AppInfo
        title="Authorize Dapp"
        appName={request.appIdentity?.identityName}
        cluster={request.cluster}
        scope={"app"}
      />

      <ButtonGroup
        positiveButtonText="Authorize"
        negativeButtonText="Decline"
        positiveOnClick={authorize}
        negativeOnClick={reject}
      />
    </View>
  );
};

export default AuthorizeDappRequestScreen;
```

Maintenant, mettons à jour notre fichier `MWAApp.tsx` pour gérer cette situation en ajoutant à notre instruction `switch` dans `renderRequest` :
```tsx
    switch (currentRequest?.__type) {
      case MWARequestType.AuthorizeDappRequest:
        return <AuthorizeDappRequestScreen request={currentRequest as AuthorizeDappRequest} />;
      case MWARequestType.SignAndSendTransactionsRequest:
      case MWARequestType.SignMessagesRequest:
      case MWARequestType.SignTransactionsRequest:
      default:
        return <Text>TODO Show screen for {currentRequest?.__type}</Text>;
    }
```

N'hésitez pas à construire et exécuter à nouveau le portefeuille. Lorsque vous interagissez pour la première fois avec une autre application Solana, notre nouvelle interface d'autorisation apparaîtra désormais.

### 8. Implémenter la fenêtre contextuelle de signature et d'envoi

Terminons notre application de portefeuille avec l'écran de signature et d'envoi de transactions. Ici, nous devons récupérer les transactions de la `request`, les signer avec notre clé secrète de notre `WalletProvider`, puis les envoyer à un RPC.

L'interface utilisateur ressemblera beaucoup à notre page d'autorisation. Nous fournirons des informations sur l'application avec `AppInfo` et quelques boutons avec `ButtonGroup`. Cette fois, nous remplirons la `SignAndSendTransactionsRequest` et la `SignAndSendTransactionsResponse` pour notre fonction `resolve`.

```ts
export function resolve(request: SignAndSendTransactionsRequest, response: SignAndSendTransactionsResponse): void;
```

Plus précisément, nous devrons nous conformer à ce avec quoi `SignAndSendTransactionsResponse` est unionné :
```ts
export type SignAndSendTransactionsCompleteResponse = Readonly<{ signedTransactions: Uint8Array[] }>;
export type SignAndSendTransactionsResponse =
    SignAndSendTransactionsCompleteResponse
    | UserDeclinedResponse
    | TooManyPayloadsResponse
    | AuthorizationNotValidResponse
    | InvalidSignaturesResponse;
```

Nous ne traiterons que `SignAndSendTransactionsCompleteResponse`, `InvalidSignaturesResponse` et `UserDeclinedResponse`.

Notamment, nous devrons nous conformer à `InvalidSignaturesResponse` :
```ts
export type InvalidSignaturesResponse = Readonly<{
  failReason: MWARequestFailReason.InvalidSignatures;
  valid: boolean[];
}>;
```

`InvalidSignaturesResponse` est unique car il nécessite un tableau de booléens, chacun correspondant à une transaction échouée. Nous devrons donc le suivre.

En ce qui concerne la signature et l'envoi, nous devrons faire quelques travaux. Étant donné que nous envoyons des transactions sur des sockets, les données de transaction sont sérialisées en octets. Nous devrons désérialiser les transactions avant de les signer.

Nous pouvons le faire dans deux fonctions :
- `signTransactionPayloads` : renvoie les transactions signées avec un tableau booléen `valid` en correspondance 1:1. Nous vérifierons cela pour voir si une signature a échoué.
- `sendSignedTransactions` : prend les transactions signées et les envoie au RPC. De même, il conserve un tableau de booléens `valid` pour savoir quelles transactions ont échoué.

Mettez tout cela ensemble dans un nouveau fichier appelé `screens/SignAndSendTransactionScreen.tsx` :
```tsx
import {
  Connection,
  Keypair,
  TransactionSignature,
  VersionedTransaction,
} from '@solana/web3.js';
import { useState } from 'react';
import {
  MWARequestFailReason,
  SignAndSendTransactionsRequest,
  resolve,
} from '../lib/mobile-wallet-adapter-walletlib/src';

import { useWallet } from '../components/WalletProvider';
import { Text, View } from 'react-native';
import AppInfo from '../components/AppInfo';
import ButtonGroup from '../components/ButtonGroup';
import { decode } from 'bs58';

export async function sendSignedTransactions(
  signedTransactions: Array<Uint8Array>,
  minContextSlot: number | undefined,
  connection: Connection,
): Promise<[boolean[], Uint8Array[]]> {
  const valid = signedTransactions.map(_ => true);
  const signatures: (Uint8Array | null)[] = await Promise.all(
    signedTransactions.map(async (byteArray, index) => {
      try {
        const transaction: VersionedTransaction =
          VersionedTransaction.deserialize(byteArray);

        const signature: TransactionSignature =
          await connection.sendTransaction(transaction, {
            minContextSlot: minContextSlot,
            preflightCommitment: 'finalized',
            skipPreflight: true,
          });

        const response = await connection.confirmTransaction(
          signature,
          'confirmed',
        );

        return decode(signature);
      } catch (error) {
        console.log('Failed sending transaction ' + error);
        valid[index] = false;
        return null;
      }
    }),
  );

  return [valid, signatures as Uint8Array[]];
}

export function signTransactionPayloads(
  wallet: Keypair,
  payloads: Uint8Array[],
): [boolean[], Uint8Array[]] {
  const valid = payloads.map(_ => true);

  const signedPayloads = payloads.map((payload, index) => {
    try {
      const transaction: VersionedTransaction =
        VersionedTransaction.deserialize(new Uint8Array(payload));

      transaction.sign([
        {
          publicKey: wallet.publicKey,
          secretKey: wallet.secretKey,
        },
      ]);
      return transaction.serialize();
    } catch (e) {
      console.log('sign error: ' + e);
      valid[index] = false;
      return new Uint8Array([]);
    }
  });

  return [valid, signedPayloads];
}

export interface SignAndSendTransactionScreenProps {
  request: SignAndSendTransactionsRequest;
}

function SignAndSendTransactionScreen(
  props: SignAndSendTransactionScreenProps,
) {
  const {request} = props;
  const {wallet, connection} = useWallet();
  const [loading, setLoading] = useState(false);

  if (!wallet) {
    throw new Error('Wallet is null or undefined');
  }

  const signAndSendTransaction = async (
    wallet: Keypair,
    connection: Connection,
    request: SignAndSendTransactionsRequest,
  ) => {
    const [validSignatures, signedTransactions] = signTransactionPayloads(
      wallet,
      request.payloads,
    );

    if (validSignatures.includes(false)) {
      resolve(request, {
        failReason: MWARequestFailReason.InvalidSignatures,
        valid: validSignatures,
      });
      return;
    }

    const [validTransactions, transactionSignatures] =
      await sendSignedTransactions(
        signedTransactions,
        request.minContextSlot ? request.minContextSlot : undefined,
        connection,
      );

    if (validTransactions.includes(false)) {
      resolve(request, {
        failReason: MWARequestFailReason.InvalidSignatures,
        valid: validTransactions,
      });
      return;
    }

    resolve(request, {signedTransactions: transactionSignatures});
  };

  const signAndSend = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signAndSendTransaction(wallet, connection, request);
    } catch (e) {
      const valid = request.payloads.map(() => false);
      resolve(request, {
        failReason: MWARequestFailReason.InvalidSignatures,
        valid,
      });
    } finally {
      setLoading(false);
    }
  };

  const reject = () => {
    resolve(request, {failReason: MWARequestFailReason.UserDeclined});
  };

  return (
    <View>
      <AppInfo
        title="Sign and Send Transaction"
        appName={request.appIdentity?.identityName}
        cluster={request.cluster}
        scope={'app'}
      />
      <Text>Payloads</Text>
      <Text>
        This request has {request.payloads.length}{' '}
        {request.payloads.length > 1 ? 'payloads' : 'payload'} to sign.
      </Text>
      <ButtonGroup
        positiveButtonText="Sign and Send"
        negativeButtonText="Reject"
        positiveOnClick={signAndSend}
        negativeOnClick={reject}
      />
      {loading && <Text>Loading...</Text>}
    </View>
  );
}

export default SignAndSendTransactionScreen;
```

Enfin, modifions `MWAApp.tsx` et ajoutons notre nouvelle interface à l'instruction `switch` :
```tsx
    switch (currentRequest?.__type) {
      case MWARequestType.AuthorizeDappRequest:
        return <AuthorizeDappRequestScreen request={currentRequest as AuthorizeDappRequest} />;
      case MWARequestType.SignAndSendTransactionsRequest:
          return <SignAndSendTransactionScreen request={currentRequest as SignAndSendTransactionsRequest} />;
      case MWARequestType.SignMessagesRequest:
      case MWARequestType.SignTransactionsRequest:
      default:
        return <Text>TODO Show screen for {currentRequest?.__type}</Text>;
    }
```

Allez-y et construisez et exécutez à nouveau votre application de portefeuille. Vous devriez maintenant être en mesure d'autoriser votre dApp et de signer et envoyer des transactions. Notez que nous avons laissé `SignMessagesRequest` et `SignTransactionsRequest` vides afin que vous puissiez les compléter dans le Défi.

Excellent travail ! Créer un portefeuille, même une version "fausse", n'est pas une mince affaire. Si vous avez rencontré des difficultés, assurez-vous de revenir en arrière jusqu'à ce que vous compreniez ce qui se passe. De plus, n'hésitez pas à parcourir le [code de solution du laboratoire sur la branche `main`](https://github.com/Unboxed-Software/react-native-fake-solana-wallet).

# Défi

Maintenant, c'est à vous de pratiquer de manière indépendante. Essayez d'implémenter les deux derniers types de demande : `SignMessagesRequest` et `SignTransactionsRequest`.

Essayez de le faire sans aide, car c'est une excellente pratique. Cependant, si vous vous trouvez bloqué, consultez le [code de solution sur la branche `solution`](https://github.com/Unboxed-Software/react-native-fake-solana-wallet/tree/solution).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5a3d0f62-c5fc-4e03-b8a3-323c2c7b8f4f) !
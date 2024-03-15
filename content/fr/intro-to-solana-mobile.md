---
title: Introduction à Solana Mobile
objectives:

- Expliquer les avantages de la création d'expériences dApp orientées mobile
- Expliquer le flux haut niveau du Mobile Wallet Adapter (MWA)
- Expliquer les différences haut niveau entre React et React Native
- Créer une simple dApp Solana pour Android en utilisant React Native
---

# Résumé

- Le Solana Mobile Wallet Adapter (MWA) crée une connexion WebSocket entre les applications mobiles et les portefeuilles mobiles, permettant aux applications mobiles natives de soumettre des transactions à des fins de signature.
- La manière la plus simple de commencer à créer des applications mobiles Solana est d'utiliser les [packages React Native](https://docs.solanamobile.com/react-native/setup) de Solana Mobile `@solana-mobile/mobile-wallet-adapter-protocol` et `@solana-mobile/mobile-wallet-adapter-protocol-web3js`
- React Native est très similaire à React avec quelques particularités mobiles.

# Aperçu général

Le Stack Mobile Solana (SMS) est conçu pour aider les développeurs à créer des dApps mobiles avec une expérience utilisateur fluide. Il se compose du [Mobile Wallet Adapter (MWA)](https://docs.solanamobile.com/getting-started/overview#mobile-wallet-adapter), du [Seed Vault](https://docs.solanamobile.com/getting-started/overview#seed-vault), et du [Solana dApp Store](https://docs.solanamobile.com/getting-started/overview#solana-dapp-store).

Le plus pertinent pour votre parcours de développement est le Mobile Wallet Adapter (MWA). La manière la plus simple de commencer est d'utiliser le Mobile Wallet Adapter avec React Native pour créer une application Android simple. Cette leçon suppose que vous êtes familier avec React et la programmation Solana. Si ce n'est pas le cas, [commencez notre cours depuis le début](./intro-to-cryptography) et revenez ici quand vous vous sentez prêt !

## Introduction à Solana Mobile

Dans ces unités, nous développerons des applications mobiles qui interagissent avec le réseau Solana. Cela ouvre tout un nouveau paradigme d'utilisations et de comportements crypto.

### Cas d'utilisation de Solana Mobile

Voici quelques exemples de ce que le développement mobile Solana peut débloquer :

**Banque et Trading Mobile (DeFi)**

La plupart des opérations bancaires traditionnelles se font actuellement sur des applications mobiles natives. Avec le SMS, vous pouvez désormais effectuer des opérations bancaires et commerciales en utilisant des applications mobiles natives avec votre propre portefeuille, où vous détenez vos propres clés.

**Jeux Mobiles avec des Micropaiements Solana**

Les jeux mobiles représentent environ 50 % de la valeur totale de l'industrie du jeu vidéo, en grande partie en raison des petits achats en jeu. Cependant, les frais de traitement des paiements signifient généralement que ces achats en jeu ont un minimum de 0,99 USD. Avec Solana, il est possible de débloquer de vrais micropaiements. Besoin d'une vie supplémentaire ? Ce sera 0,0001 SOL.

**E-commerce Mobile**

Le SMS peut permettre à une nouvelle vague de clients d'e-commerce mobile de payer directement depuis leur portefeuille Solana préféré. Imaginez un monde où vous pouvez utiliser votre portefeuille Solana aussi facilement que vous pouvez utiliser Apple Pay.

En résumé, le crypto mobile ouvre de nombreuses portes. Plongeons-y et apprenons comment nous pouvons en faire partie :

### Différences entre le développement Solana sur les applications mobiles natives et sur le web

L'interaction avec le portefeuille Solana diffère légèrement sur mobile par rapport au web. La fonctionnalité principale du portefeuille est la même : le portefeuille détient vos clés privées et les utilise pour signer et envoyer des transactions. Pour éviter d'avoir des interfaces différentes entre les portefeuilles, les développeurs ont abstrait cette fonctionnalité en la standardisant avec le Solana Wallet Adapter. Cela reste la norme sur le web. L'équivalent mobile est le Mobile Wallet Adapter (MWA).

Les différences entre les deux normes sont dues à la construction différente des portefeuilles web par rapport aux portefeuilles mobiles. Les portefeuilles web sont simplement des extensions de navigateur qui injectent les fonctions du portefeuille dans l'objet `window` de votre page web. Cela donne à votre site un accès à ces fonctions. Cependant, les portefeuilles mobiles sont des applications natives sur un système d'exploitation mobile. Il n'y a aucun moyen de rendre des fonctions accessibles d'une application native à une autre. Le Mobile Wallet Adapter existe pour permettre à n'importe quelle application, écrite dans n'importe quel langage, de se connecter à une application de portefeuille native.

Nous examinerons les détails du Mobile Wallet Adapter dans une [leçon ultérieure](./mwa-deep-dive), mais il ouvre effectivement une connexion WebSocket entre les applications pour faciliter la communication. De cette manière, une application distincte peut fournir à l'application de portefeuille la transaction à signer et à envoyer, et l'application de portefeuille peut répondre avec des mises à jour d'état appropriées.

### Systèmes d'exploitation pris en charge

Au moment de la rédaction, Android est le seul système d'exploitation mobile pris en charge par le Mobile Wallet Adapter.

Sur Android, une connexion WebSocket peut persister entre les applications, même lorsque l'application de portefeuille est en arrière-plan.

Sur iOS, la durée de vie d'une connexion entre les applications est délibérément limitée par le système d'exploitation. Plus précisément, iOS suspend rapidement les connexions lorsqu'une application est mise en arrière-plan. Cela interrompt la connexion WebSocket de MWA. C'est une différence de conception inhérente entre iOS et Android (probablement conçue pour préserver la batterie, l'utilisation du réseau, etc).

Cependant, cela ne signifie pas que les dApps Solana ne peuvent pas fonctionner du tout sur iOS. Vous pouvez toujours créer une application web mobile en utilisant la [bibliothèque de l'adaptateur de portefeuille standard](https://github.com/solana-labs/wallet-adapter). Vos utilisateurs peuvent ensuite installer un portefeuille mobile convivial comme le [Glow Wallet](https://glow.app/).

Le reste de cette leçon se concentrera sur le développement d'applications Android avec le MWA.

### Frameworks pris en charge

Solana Mobile prend en charge plusieurs frameworks différents. Sont Officiellement pris en charge React Native et Android natif, avec des SDK de la communauté pour Flutter, Unity et Unreal Engine.

**SDK Solana:**

- [React Native](https://docs.solanamobile.com/react-native/quickstart) (Normal et Expo)
- [Android](https://docs.solanamobile.com/android-native/quickstart)

**SDK de la communauté:**

- [Flutter](https://docs.solanamobile.com/flutter/overview)
- [Unity](https://docs.solanamobile.com/unity/unity_sdk)
- [Unreal Engine](https://docs.solanamobile.com/unreal/unreal_sdk)

Pour maintenir l'expérience de développement aussi proche que possible des autres leçons, nous travaillerons exclusivement avec React Native.

## De React à React Native

React Native prend le framework web React et l'applique aux applications mobiles. Cependant, bien que React et React Native semblent très similaires, il y a des différences. La meilleure façon de comprendre ces différences est de les expérimenter lors de la programmation. Mais, pour vous donner une longueur d'avance, voici une liste de quelques différences à garder à l'esprit :

- React Native se compile en applications natives iOS et Android, tandis que React se compile en une collection de pages web.
- En React, vous utilisez JSX pour programmer avec HTML et CSS. Avec React Native, vous utilisez une syntaxe similaire pour manipuler des composants d'interface utilisateur natifs. C'est plus comme utiliser une bibliothèque d'interface utilisateur comme Chakra ou Tailwind UI. Au lieu de `<div>`, `<p>`, et `<img>`, vous utiliserez `<View>`, `<Text>`, et `<Image>`.
- Les interactions sont différentes. Au lieu de `onClick`, vous utiliserez `onPress` et d'autres gestes.
- De nombreux packages React et Node standards peuvent ne pas être compatibles avec React Native. Heureusement, il existe des équivalents React Native aux bibliothèques les plus populaires, et vous pouvez souvent utiliser des polyfills pour rendre les packages Node disponibles. Si vous n'êtes pas familier avec les polyfills, consultez la [documentation MDN](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill). En bref, les polyfills remplacent activement les bibliothèques natives de Node pour les faire fonctionner n'importe où où Node ne s'exécute pas.
- La configuration d'un environnement de développement dans React Native peut être difficile. Cela nécessitera la configuration d'Android Studio pour la compilation vers Android et de XCode pour iOS. React Native a un [très bon guide](https://reactnative.dev/docs/environment-setup?guide=native) pour cela.
- Pour le développement et les tests réguliers, vous utiliserez un appareil mobile physique ou un émulateur pour exécuter votre code. Cela repose sur un outil appelé Metro qui est préinstallé. Le guide de configuration de React Native couvre également cela.
- React Native vous donne accès au matériel du téléphone que React ne peut pas fournir. Cela inclut des choses comme la caméra du téléphone, l'accéléromètre, et plus encore.
- React Native introduit de nouveaux fichiers de configuration et dossiers de construction. Par exemple, les répertoires `ios` et `android` contiennent des informations spécifiques à la plate-forme. De plus, il existe des fichiers de configuration tels que `Gemfile` et `metro.config.js`. En général, laissez toutes les configurations telles quelles et concentrez-vous simplement sur l'écriture de votre code, dont le point de départ sera dans `App.tsx`.

Il y a une courbe d'apprentissage, mais si vous connaissez React, vous n'êtes pas aussi loin que vous le pensez pour pouvoir développer des applications mobiles. Cela peut sembler déroutant au début, mais après quelques heures de développement avec React Native, vous commencerez à vous sentir beaucoup plus à l'aise. Vous vous sentirez probablement beaucoup plus confiant même après [le laboratoire de cette leçon](#laboratoire).

## Création d'une dApp Solana avec React Native

Les dApps Solana React Native sont virtuellement identiques aux dApps React. La principale différence réside dans l'interaction avec le portefeuille. Au lieu que le portefeuille soit disponible dans le navigateur, votre dApp créera une session MWA avec l'application de portefeuille de votre choix en utilisant une WebSocket. Heureusement, cela est abstrait pour vous dans la bibliothèque MWA. La seule différence que vous devrez connaître est que chaque fois que vous devrez appeler le portefeuille, vous utiliserez la fonction `transact`, dont nous parlerons bientôt.

![Flux d'application](../assets/basic-solana-mobile-flow.png)

### Lecture de données

Lire des données à partir d'un cluster Solana en React Native est exactement la même chose qu'en React. Vous utilisez le crochet `useConnection` pour récupérer l'objet `Connection`. Avec cela, vous pouvez obtenir des informations sur le compte. Comme la lecture est gratuite, nous n'avons pas besoin de nous connecter réellement au portefeuille.

```tsx
const account = await connection.getAccountInfo(account);
```

Si vous avez besoin d'un rappel sur cela, consultez notre [leçon sur la lecture des données depuis la blockchain](./intro-to-reading-data).

### Connexion à un portefeuille

Écrire des données sur la blockchain doit se faire via une transaction. Les transactions doivent être signées par une ou plusieurs clés privées et envoyées à un fournisseur RPC. Cela se fait pratiquement toujours via une application de portefeuille.

L'interaction habituelle avec le portefeuille se fait en appelant une extension de navigateur. Sur mobile, vous utilisez une WebSocket pour démarrer une session MWA. Plus précisément, vous utilisez des intents Android où l'application de dApp diffuse son intent avec le schéma `solana-wallet://`. 

![Connexion](../assets/basic-solana-mobile-connect.png)

Lorsque l'application de portefeuille reçoit cet intent, elle ouvre une connexion avec la dApp qui a initié la session. Votre dApp envoie cet intent en utilisant la fonction `transact` :

```tsx
transact(async (wallet: Web3MobileWallet) => {
	// Code d'action du portefeuille ici
}
```

Cela vous donnera accès à l'objet `Web3MobileWallet`. Vous pouvez alors l'utiliser pour envoyer des transactions au portefeuille. Encore une fois, lorsque vous souhaitez accéder au portefeuille, cela doit se faire via la fonction de rappel de la fonction `transact`.

### Signature et envoi de transactions

L'envoi d'une transaction se fait à l'intérieur du rappel de `transact`. Le flux est le suivant :

1. Établir une session avec un portefeuille en utilisant `transact` qui aura une callback de `async (wallet: Web3MobileWallet) => {...}`.
2. À l'intérieur de la callback, demander l'autorisation avec la méthode `wallet.authorize` ou `wallet.reauthorize` selon l'état du portefeuille.
3. Signer la transaction avec `wallet.signTransactions` ou signer et envoyer avec `wallet.signAndSendTransactions`. 

![Transaction](../assets/basic-solana-mobile-transact.png)

Remarque : Vous voudrez peut-être créer un crochet `useAuthorization()` pour gérer l'état d'autorisation du portefeuille. Nous pratiquerons cela dans [le laboratoire](#laboratoire).

Voici un exemple d'envoi d'une transaction en utilisant MWA :
```tsx
const { authorizeSession } = useAuthorization();
const { connection } = useConnection();

const sendTransactions = (transaction: Transaction)=> {

	transact(async (wallet: Web3MobileWallet) => {
		const latestBlockhashResult = await connection.getLatestBlockhash();
		const authResult = await authorizeSession(wallet);

		const updatedTransaction = new Transaction({
      ...transaction,
      ...latestBlockhashResult,
      feePayer: authResult.publicKey,
    });

		const signature = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
	})
}
```

### Débogage

Étant donné que deux applications sont impliquées dans l'envoi de transactions, le débogage peut être délicat. Plus précisément, vous ne pourrez pas voir les logs de débogage du portefeuille de la même manière que vous pouvez voir les logs de votre dApp.

Heureusement, [Logcat sur Android Studio](https://developer.android.com/studio/debug/logcat) permet de voir les journaux de toutes les applications sur votre appareil.

Si vous préférez ne pas utiliser Logcat, l'autre méthode que vous pourriez essayer est d'utiliser uniquement le portefeuille pour signer les transactions, puis de les envoyer dans votre code. Cela vous permet de déboguer plus facilement la transaction si vous rencontrez des problèmes.

### Publication

Le déploiement d'applications mobiles peut être difficile en soi. C'est souvent encore plus difficile lorsqu'il s'agit d'une application crypto. Il y a deux principales raisons à cela : la sécurité des clients et les incitations financières.

Tout d'abord, la plupart des places de marché d'applications mobiles ont des politiques restreignant la participation des blockchains. La crypto étant assez récente, c'est une inconnue réglementaire. Les plateformes estiment qu'elles protègent les utilisateurs en étant strictes avec les applications liées à la blockchain.

Deuxièmement, si vous utilisez la crypto pour des "achats" in-app, vous serez considéré comme contournant les frais de la plate-forme (de 15 à 30%). C'est explicitement contre les politiques des magasins d'applications, car la plate-forme tente de protéger sa source de revenus.

Ce sont des obstacles, mais il y a de l'espoir. Voici quelques points à garder à l'esprit pour chaque place de marché :

- **App Store (iOS) -** Nous avons parlé uniquement d'Android aujourd'hui pour des raisons techniques liées au MWA. Cependant, leurs politiques sont également parmi les plus strictes et rendent difficile l'existence des dApps Solana. Pour l'instant, Apple a des politiques anti-crypto assez strictes. Les portefeuilles semblent bien fonctionner, mais ils signaleront et probablement rejeteront tout ce qui ressemble à un achat utilisant la crypto.
- **Google Play (Android) -** Google est généralement plus détendu, mais il y a encore quelques points à prendre en compte. Au moment de la rédaction en novembre 2023, Google déploie [de nouvelles politiques sur la crypto](https://www.theverge.com/2023/7/12/23792720/android-google-play-blockchain-crypto-nft-apps) pour préciser ce qu'ils autoriseront ou non. Jetez un coup d'œil.
- **Steam -** Ne permet pas du tout les jeux crypto
    > "construits sur la technologie blockchain qui émettent ou permettent l'échange de cryptomonnaies ou de NFT."
- **Sites de téléchargement / Votre site -** Selon la plate-forme cible, vous pouvez rendre votre dApp disponible en téléchargement sur votre propre site. Cependant, la plupart des utilisateurs sont méfiants à l'idée de télécharger des applications mobiles depuis des sites web.
- **dApp Store (Solana) -** Solana a constaté les problèmes de distribution des dApps mobiles sur les places de marché d'autres plateformes et a décidé de créer la sienne. Dans le cadre de la pile SMS, ils ont créé le [Solana dApp Store](https://docs.solanamobile.com/getting-started/overview#solana-dapp-store).

## Conclusion

Se lancer dans le développement mobile Solana est assez simple grâce à SMS. Bien que React Native soit légèrement différent de React, le code que vous devez écrire est plus similaire que différent. La principale différence est que la partie de votre code qui interagit avec les portefeuilles sera située dans la callback `transact`. N'oubliez pas de consulter nos autres leçons si vous avez besoin d'un rappel sur le développement Solana de manière plus générale.

# Laboratoire

Pratiquons cela ensemble en construisant une simple application décentralisée (dApp) Android de compteur avec React Native. L'application interagira avec le programme de compteur Anchor que nous avons créé dans la leçon [Introduction au développement client-side Anchor](https://www.soldev.app/course/intro-to-anchor-frontend). Cette dApp affiche simplement un compteur et permet aux utilisateurs d'incrémenter le compte via un programme Solana. Dans cette application, nous pourrons voir le compte actuel, connecter notre portefeuille et incrémenter le compte. Nous ferons tout cela sur Devnet et ne compilerons que pour Android.

Ce programme existe déjà et est déjà déployé sur Devnet. N'hésitez pas à consulter le [code du programme déployé](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-decrement) si vous souhaitez plus de contexte.

Nous écrirons cette application en React Native sans utiliser de modèle de départ. Solana Mobile propose un [modèle React Native](https://docs.solanamobile.com/react-native/react-native-scaffold) qui raccourcit une partie du code de base, mais il n'y a pas de meilleure façon d'apprendre que de le faire depuis le début.

### 0. Prérequis

React Native nous permet d'écrire des applications mobiles en utilisant des schémas similaires à React. Cependant, en interne, notre code React doit être compilé dans des langages et des frameworks compatibles avec le système d'exploitation natif du dispositif. Cela nécessite quelques préparatifs préalables :

1. [Configurer un environnement de développement React Native](https://reactnative.dev/docs/environment-setup?guide=native#creating-a-new-application). Suivez l'[***article complet***](https://reactnative.dev/docs/environment-setup?guide=native#creating-a-new-application), en choisissant Android comme système d'exploitation cible. Pour votre commodité, nous avons détaillé les étapes principales ci-dessous. Gardez à l'esprit que l'article source peut changer entre le moment de l'écriture et celui de votre lecture. L'article source est votre source de vérité ici.
   1. Installez les dépendances
   2. Installez Android Studio
   3. Configurez la variable d'environnement **ANDROID_HOME**
   4. Créez un nouveau projet d'exemple (cela sert uniquement à configurer l'émulateur)
      1. Si vous rencontrez l'erreur `✖ Copying template`, ajoutez le drapeau `--npm` à la fin

         ```bash
         npx react-native@latest init AwesomeProject
         ✔ Downloading template
         ✖ Copying template

         npx react-native@latest init AwesomeProject --npm
         ✔ Downloading template
         ✔ Copying template
         ```
        
      2. Exécutez et compilez le projet d'exemple sur votre émulateur 
2. Installez et lancez le faux portefeuille Solana
   1. Installez le dépôt

      ```bash
      git clone https://github.com/solana-mobile/mobile-wallet-adapter.git
      ```
        
   2. Dans Android Studio, ouvrez le projet en allant à  `Open project > Navigate to the cloned directory > Select mobile-wallet-adapter/android`
   3. Une fois qu'Android Studio a fini de charger le projet, sélectionnez `fakewallet` dans le menu déroulant de configuration de build/exécution en haut à droite
        
      ![Fake Wallet](../assets/basic-solana-mobile-fake-wallet.png)
        
   4. Pour le débogage, utilisez `Logcat`. Maintenant que votre faux portefeuille fonctionne sur l'émulateur, allez à `View -> Tool Windows -> Logcat`. Cela ouvrira une console qui enregistre ce qui se passe avec le faux portefeuille.
3. (Facultatif) Installez d'autres portefeuilles Solana comme Phantom sur le Google Play Store.

Enfin, si vous rencontrez des problèmes de versionnement Java, assurez-vous d'utiliser la version 11 de Java. Pour vérifier la version actuelle, tapez `java --version` dans votre terminal.

### 1. Planifier la structure de l'application

Avant de coder, conceptualisons le plan de l'application. Encore une fois, cette application se connectera et interagira avec le programme de compteur que nous avons déjà déployé sur Devnet. Pour cela, nous aurons besoin des éléments suivants :

- Un objet `Connection` pour interagir avec Solana (`ConnectionProvider.tsx`)
- L'accès à notre programme de compteur (`ProgramProvider.tsx`)
- L'autorisation d'un portefeuille pour signer et envoyer des requêtes (`AuthProvider.tsx`)
- Un texte pour afficher la valeur de notre compteur (`CounterView.tsx`)
- Un bouton pour incrémenter notre compteur (`CounterButton.tsx`)
  
Il y aura plus de fichiers et de considérations, mais ce sont les fichiers les plus importants que nous créerons et avec lesquels nous travaillerons.

### 2. Créer l'application

Maintenant que nous avons établi une partie de la configuration de base et de la structure, créons une nouvelle application avec la commande suivante :

```bash
npx react-native@latest init counter --npm
```

Cela crée un nouveau projet React Native appelé `counter`.

Assurons-nous que tout est correctement configuré en démarrant l'application par défaut et en l'exécutant sur notre émulateur Android.

```bash
cd counter
npm run android
```

Cela devrait ouvrir et exécuter l'application sur votre émulateur Android. Si vous rencontrez des problèmes, vérifiez que vous avez accompli toutes les étapes dans la [section des prérequis](#0-prerequisites).

### 3. Installer les dépendances

Nous devrons ajouter nos dépendances Solana. [La documentation de Solana Mobile fournit une belle liste de packages](https://docs.solanamobile.com/react-native/setup) et des explications sur la raison pour laquelle nous en avons besoin :

- `@solana-mobile/mobile-wallet-adapter-protocol`: Une API React Native/Javascript permettant l'interaction avec les portefeuilles compatibles MWA.
- `@solana-mobile/mobile-wallet-adapter-protocol-web3js`: Un wrapper pratique pour utiliser des primitives courantes de [@solana/web3.js](https://github.com/solana-labs/solana-web3.js), telles que `Transaction` et `Uint8Array`
- `@solana/web3.js`: Bibliothèque Web Solana pour interagir avec le réseau Solana via l'API JSON RPC
- `react-native-get-random-values`: Polyfill de générateur de nombres aléatoires sécurisé pour `web3.js`, sous-jacent à la bibliothèque Crypto de React Native
- `buffer`: Polyfill de tampon ; également nécessaire pour `web3.js` sur React Native

En plus de cette liste, nous ajouterons deux autres packages :
- `@coral-xyz/anchor`: Le client TS d'Anchor.
- `assert`: Un polyfill qui permet à Anchor de faire son travail.
- `text-encoding-polyfill`: Un polyfill nécessaire pour créer l'objet `Program`

Si vous n'êtes pas familier : les polyfills remplacent activement les bibliothèques natives de Node pour les faire fonctionner n'importe où où Node ne fonctionne pas. Nous finaliserons notre configuration de polyfill sous peu. Pour l'instant, installez les dépendances avec la commande suivante :

```bash
npm install \
  @solana/web3.js \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \
  react-native-get-random-values \
  buffer \
  @coral-xyz/anchor \
  assert \
  text-encoding-polyfill
```

### 4. Créer ConnectionProvider.tsx

Commençons à ajouter notre fonctionnalité Solana. Créez un nouveau dossier appelé `components` et à l'intérieur, un fichier appelé `ConnectionProvider.tsx`. Ce fournisseur enveloppera toute l'application et rendra notre objet `Connection` disponible partout. Espérons que vous remarquez un schéma : c'est identique aux schémas React que nous avons utilisés tout au long du cours.

```tsx
import {Connection, ConnectionConfig} from '@solana/web3.js';
import React, {ReactNode, createContext, useContext, useMemo} from 'react';

export interface ConnectionProviderProps {
  children: ReactNode;
  endpoint: string;
  config?: ConnectionConfig;
}

export interface ConnectionContextState {
  connection: Connection;
}

const ConnectionContext = createContext<ConnectionContextState>(
  {} as ConnectionContextState,
);

export function ConnectionProvider(props: ConnectionProviderProps){
  const {children, endpoint, config = {commitment: 'confirmed'}} = {...props};
  const connection = useMemo(
    () => new Connection(endpoint, config),
    [config, endpoint],
  );

  return (
    <ConnectionContext.Provider value={{connection}}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = (): ConnectionContextState =>
  useContext(ConnectionContext);
```

### 5. Créer AuthProvider.tsx

La prochaine disposition Solana dont nous aurons besoin est le fournisseur d'authentification. C'est l'une des principales différences entre le développement mobile et web. Ce que nous implémentons ici est à peu près équivalent au `WalletProvider` auquel nous sommes habitués dans les applications web. Cependant, comme nous utilisons Android et ses portefeuilles installés nativement, le flux pour les connecter et les utiliser est un peu différent. Notamment, nous devons suivre le protocole MWA.

Nous faisons cela en fournissant les éléments suivants dans notre `AuthProvider` :

- `accounts`: Si l'utilisateur a plusieurs portefeuilles, différents comptes sont maintenus dans ce tableau de comptes.
- `selectedAccount`: Le compte actuellement sélectionné pour la transaction.
- `authorizeSession(wallet)`: Autorise (ou réautorise, si le jeton a expiré) le `wallet` pour l'utilisateur et renvoie un compte qui agira comme compte sélectionné pour la session. La variable `wallet` provient de la callback de la fonction `transact` que vous appelez indépendamment chaque fois que vous souhaitez interagir avec un portefeuille.
- `deauthorizeSession(wallet)`: Désautorise le `wallet`.
- `onChangeAccount`: Agit comme gestionnaire lorsque `selectedAccount` est modifié.

Nous allons également ajouter quelques méthodes utilitaires :

- `getPublicKeyFromAddress(base64Address)`: Crée un nouvel objet Public Key à partir de l'adresse Base64 donnée par l'objet `wallet`
- `getAuthorizationFromAuthResult`: Gère le résultat d'autorisation, extrait les données pertinentes du résultat et renvoie l'objet de contexte d'`Authorization`

Nous exposerons tout cela via un hook `useAuthorization`.

Comme ce fournisseur est le même pour pratiquement toutes les applications, nous allons vous donner la mise en œuvre complète que vous pouvez copier/coller. Nous examinerons les détails de MWA dans une leçon future.

Créez le fichier `AuthProvider.tsx` dans le dossier `components` et collez le code suivant :

```tsx
import {Cluster, PublicKey} from '@solana/web3.js';
import {
  Account as AuthorizedAccount,
  AuthorizationResult,
  AuthorizeAPI,
  AuthToken,
  Base64EncodedAddress,
  DeauthorizeAPI,
  ReauthorizeAPI,
} from '@solana-mobile/mobile-wallet-adapter-protocol';
import {toUint8Array} from 'js-base64';
import {useState, useCallback, useMemo, ReactNode} from 'react';
import React from 'react';

export const AuthUtils = {
  getAuthorizationFromAuthResult: (
    authResult: AuthorizationResult,
    previousAccount?: Account,
  ): Authorization => {
    let selectedAccount: Account;
    if (
      //no wallet selected yet
      previousAccount === null ||
      //the selected wallet is no longer authorized
      !authResult.accounts.some(
        ({address}) => address === previousAccount.address,
      )
    ) {
      const firstAccount = authResult.accounts[0];
      selectedAccount = AuthUtils.getAccountFromAuthorizedAccount(firstAccount);
    } else {
      selectedAccount = previousAccount;
    }
    return {
      accounts: authResult.accounts.map(
        AuthUtils.getAccountFromAuthorizedAccount,
      ),
      authToken: authResult.auth_token,
      selectedAccount,
    };
  },

  getAccountFromAuthorizedAccount: (
    authAccount: AuthorizedAccount,
  ): Account => {
    return {
      ...authAccount,
      publicKey: AuthUtils.getPublicKeyFromAddress(authAccount.address),
    };
  },

  getPublicKeyFromAddress: (address: Base64EncodedAddress) => {
    return new PublicKey(toUint8Array(address));
  },
};

export type Account = Readonly<{
  address: Base64EncodedAddress;
  label?: string;
  publicKey: PublicKey;
}>;

type Authorization = Readonly<{
  accounts: Account[];
  authToken: AuthToken;
  selectedAccount: Account;
}>;

export const AppIdentity = {
  name: 'Solana Counter Incrementor',
};

export type AuthorizationProviderContext = {
  accounts: Account[] | null;
  authorizeSession: (wallet: AuthorizeAPI & ReauthorizeAPI) => Promise<Account>;
  deauthorizeSession: (wallet: DeauthorizeAPI) => void;
  onChangeAccount: (nextSelectedAccount: Account) => void;
  selectedAccount: Account | null;
};

const AuthorizationContext = React.createContext<AuthorizationProviderContext>({
  accounts: null,
  authorizeSession: (_wallet: AuthorizeAPI & ReauthorizeAPI) => {
    throw new Error('Provider not initialized');
  },
  deauthorizeSession: (_wallet: DeauthorizeAPI) => {
    throw new Error('Provider not initialized');
  },
  onChangeAccount: (_nextSelectedAccount: Account) => {
    throw new Error('Provider not initialized');
  },
  selectedAccount: null,
});

export type AuthProviderProps = {
  children: ReactNode;
  cluster: Cluster;
};

export function AuthorizationProvider(props: AuthProviderProps) {
  const {children, cluster} = {...props};
  const [authorization, setAuthorization] = useState<Authorization | null>(
    null,
  );

  const handleAuthorizationResult = useCallback(
    async (authResult: AuthorizationResult): Promise<Authorization> => {
      const nextAuthorization = AuthUtils.getAuthorizationFromAuthResult(
        authResult,
        authorization?.selectedAccount,
      );
      setAuthorization(nextAuthorization);

      return nextAuthorization;
    },
    [authorization, setAuthorization],
  );

  const authorizeSession = useCallback(
    async (wallet: AuthorizeAPI & ReauthorizeAPI) => {
      const authorizationResult = await (authorization
        ? wallet.reauthorize({
            auth_token: authorization.authToken,
            identity: AppIdentity,
          })
        : wallet.authorize({cluster, identity: AppIdentity}));
      return (await handleAuthorizationResult(authorizationResult))
        .selectedAccount;
    },
    [authorization, handleAuthorizationResult],
  );

  const deauthorizeSession = useCallback(
    async (wallet: DeauthorizeAPI) => {
      if (authorization?.authToken === null) {
        return;
      }

      await wallet.deauthorize({auth_token: authorization.authToken});
      setAuthorization(null);
    },
    [authorization, setAuthorization],
  );

  const onChangeAccount = useCallback(
    (nextAccount: Account) => {
      setAuthorization(currentAuthorization => {
        if (
          //check if the account is no longer authorized
          !currentAuthorization?.accounts.some(
            ({address}) => address === nextAccount.address,
          )
        ) {
          throw new Error(`${nextAccount.address} is no longer authorized`);
        }

        return {...currentAuthorization, selectedAccount: nextAccount};
      });
    },
    [setAuthorization],
  );

  const value = useMemo(
    () => ({
      accounts: authorization?.accounts ?? null,
      authorizeSession,
      deauthorizeSession,
      onChangeAccount,
      selectedAccount: authorization?.selectedAccount ?? null,
    }),
    [authorization, authorizeSession, deauthorizeSession, onChangeAccount],
  );

  return (
    <AuthorizationContext.Provider value={value}>
      {children}
    </AuthorizationContext.Provider>
  );
}

export const useAuthorization = () => React.useContext(AuthorizationContext);
```

### 6. Créer ProgramProvider.tsx

Le dernier fournisseur dont nous avons besoin est notre fournisseur de programme. Cela exposera le programme de compteur avec lequel nous voulons interagir.

Étant donné que nous utilisons le client Anchor TS pour interagir avec notre programme, nous avons besoin de l'IDL du programme. Commencez par créer un dossier au niveau racine appelé `models`, puis créez un nouveau fichier `anchor-counter.ts`. Collez le contenu de l'IDL du compteur Anchor [Anchor Counter IDL](../assets/counter-rn-idl.ts) dans ce nouveau fichier.

Ensuite, créez le fichier `ProgramProvider.tsx` à l'intérieur de `components`. À l'intérieur, nous créerons le fournisseur de programme pour exposer notre programme et la PDA (Program Derived Address) du compteur :

```tsx
import {AnchorProvider, IdlAccounts, Program, setProvider} from '@coral-xyz/anchor';
import {Keypair, PublicKey} from '@solana/web3.js';
import {AnchorCounter, IDL} from '../models/anchor-counter';
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {useConnection} from './ConnectionProvider';

export type CounterAccount = IdlAccounts<AnchorCounter>['counter'];

export type ProgramContextType = {
  program: Program<AnchorCounter> | null;
  counterAddress: PublicKey | null;
};

export const ProgramContext = createContext<ProgramContextType>({
  program: null,
  counterAddress: null,
});

export type ProgramProviderProps = {
  children: ReactNode;
};

export function ProgramProvider(props: ProgramProviderProps) {
  const { children } = props;
  const {connection} = useConnection();
  const [program, setProgram] = useState<Program<AnchorCounter> | null>(null);
  const [counterAddress, setCounterAddress] = useState<PublicKey | null>(null);

  const setup = useCallback(async () => {
    const programId = new PublicKey(
      'ALeaCzuJpZpoCgTxMjJbNjREVqSwuvYFRZUfc151AKHU',
    );

    const MockWallet = {
      signTransaction: () => Promise.reject(),
      signAllTransactions: () => Promise.reject(),
      publicKey: Keypair.generate().publicKey,
    };

    const provider = new AnchorProvider(connection, MockWallet, {});
    setProvider(provider);

    const programInstance = new Program<AnchorCounter>(
      IDL,
      programId,
      provider,
    );

    const [counterProgramAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from('counter')],
      programId,
    );

    setProgram(programInstance);
    setCounterAddress(counterProgramAddress);
  }, [connection]);

  useEffect(() => {
    setup();
  }, [setup]);

  const value: ProgramContextType = useMemo(
    () => ({
      program,
      counterAddress,
    }),
    [program, counterAddress],
  );

  return (
    <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>
  );
}

export const useProgram = () => useContext(ProgramContext);
```

### 7. Modifier App.tsx

Maintenant que nous avons tous nos fournisseurs, enveloppons notre application avec eux. Nous allons réécrire le fichier `App.tsx` par défaut avec les modifications suivantes :

- Importer nos fournisseurs et ajouter nos polyfills
- Envelopper l'application d'abord avec `ConnectionProvider`, puis `AuthorizationProvider`, et enfin `ProgramProvider`
- Passer notre point de terminaison Devnet à `ConnectionProvider`
- Passer notre cluster à `AuthorizationProvider`
- Remplacer la balise `<View>` interne par défaut par `<MainScreen />`, un écran que nous construirons à l'étape suivante

```tsx
// Polyfills en haut
import "text-encoding-polyfill";
import "react-native-get-random-values";
import { Buffer } from "buffer";
global.Buffer = Buffer;

import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider } from "./components/ConnectionProvider";
import { AuthorizationProvider } from "./components/AuthProvider";
import { ProgramProvider } from "./components/ProgramProvider";
import { MainScreen } from "./screens/MainScreen"; // Nous allons créer cela
import React from "react";

export default function App() {
  const cluster = "devnet";
  const endpoint = clusterApiUrl(cluster);

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{ commitment: "processed" }}
    >
      <AuthorizationProvider cluster={cluster}>
        <ProgramProvider>
          <MainScreen />
        </ProgramProvider>
      </AuthorizationProvider>
    </ConnectionProvider>
  );
}
```

### 8. Créer MainScreen.tsx

Maintenant, mettons tout ensemble pour créer notre interface utilisateur. Créez un nouveau dossier appelé `screens` et un nouveau fichier appelé `MainScreen.tsx` à l'intérieur. Dans ce fichier, nous structurons simplement l'écran pour afficher deux composants à créer ultérieurement : `CounterView` et `CounterButton`.

De plus, dans ce fichier, nous introduisons le `StyleSheet` de React Native. C'est une autre différence par rapport à React normal. Ne vous inquiétez pas, il se comporte de manière très similaire à CSS.

Dans `screens/MainScreen.tsx`, collez le code suivant :
```tsx
import { StatusBar, StyleSheet, View } from 'react-native';
import { CounterView } from '../components/CounterView';
import { CounterButton } from '../components/CounterButton';
import React from 'react';

const mainScreenStyles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
    backgroundColor: 'lightgray',
  },

  incrementButtonContainer: {position: 'absolute', right: '5%', bottom: '3%'},
  counterContainer: {
    alignContent: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export function MainScreen() {
  return (
    <View style={mainScreenStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="darkblue" />
      <View
        style={{
          ...mainScreenStyles.container,
          ...mainScreenStyles.counterContainer,
        }}>
        <CounterView />
      </View>
      <View style={mainScreenStyles.incrementButtonContainer}>
        <CounterButton />
      </View>
    </View>
  );
}
```

### 9. Créer CounterView.tsx

Le `CounterView` est le premier de nos deux fichiers spécifiques au programme. Le seul rôle du `CounterView` est de récupérer et d'écouter les mises à jour sur notre compte `Counter`. Comme nous écoutons seulement ici, nous n'avons rien à faire de lié au MWA. Il devrait ressembler à une application web classique. Nous utiliserons notre objet `Connection` pour écouter la `programAddress` spécifiée dans `ProgramProvider.tsx`. Lorsque le compte est modifié, nous mettons à jour l'interface utilisateur.

Dans `components/CounterView.tsx`, collez le code suivant :

```tsx
import {View, Text, StyleSheet} from 'react-native';
import {useConnection} from './ConnectionProvider';
import {useProgram, CounterAccount} from './ProgramProvider';
import {useEffect, useState} from 'react';
import {AccountInfo} from '@solana/web3.js';
import React from 'react';

const counterStyle = StyleSheet.create({
  counter: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'center',
  },
});

export function CounterView() {
  const {connection} = useConnection();
  const {program, counterAddress} = useProgram();
  const [counter, setCounter] = useState<CounterAccount>();

  // Fetch Counter Info
  useEffect(() => {
    if (!program || !counterAddress) return;

    program.account.counter.fetch(counterAddress).then(setCounter);

    const subscriptionId = connection.onAccountChange(
      counterAddress,
      (accountInfo: AccountInfo<Buffer>) => {
        try {
          const data = program.coder.accounts.decode(
            'counter',
            accountInfo.data,
          );
          setCounter(data);
        } catch (e) {
          console.log('account decoding error: ' + e);
        }
      },
    );

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [program, counterAddress, connection]);

  if (!counter) return <Text>Loading...</Text>;

  return (
    <View>
      <Text>Compteur actuel</Text>
      <Text style={counterStyle.counter}>{counter.count.toString()}</Text>
    </View>
  );
}
```

### 10. Créer CounterButton.tsx

Enfin, nous avons notre dernier composant, le `CounterButton`. Ce bouton d'action flottant effectuera les actions suivantes dans une nouvelle fonction `incrementCounter` :

- Appeler `transact` pour obtenir l'accès à un portefeuille mobile
- Autoriser la session avec `authorizeSession` provenant du crochet `useAuthorization`
- Demander un airdrop Devnet pour financer la transaction si le sol Devnet disponible n'est pas suffisant
- Créer une transaction `increment`
- Appeler `signAndSendTransactions` pour que le portefeuille signe et envoie la transaction

Remarque : Le faux portefeuille Solana que nous utilisons génère une nouvelle paire de clés à chaque redémarrage de l'application de portefeuille fictif, ce qui nécessite de vérifier les fonds et le airdrop à chaque fois. Cela est fait uniquement à des fins de démonstration, vous ne pouvez pas le faire en production.

Créez le fichier `CounterButton.tsx` et collez le contenu suivant :

```tsx
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
} from 'react-native';
import { useAuthorization } from './AuthProvider';
import { useProgram } from './ProgramProvider';
import { useConnection } from './ConnectionProvider';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { useState } from 'react';
import React from 'react';

const floatingActionButtonStyle = StyleSheet.create({
  container: {
    height: 64,
    width: 64,
    alignItems: 'center',
    borderRadius: 40,
    justifyContent: 'center',
    elevation: 4,
    marginBottom: 4,
    backgroundColor: 'blue',
  },

  text: {
    fontSize: 24,
    color: 'white',
  },
});

export function CounterButton() {
  const {authorizeSession} = useAuthorization();
  const {program, counterAddress} = useProgram();
  const {connection} = useConnection();
  const [isTransactionInProgress, setIsTransactionInProgress] = useState(false);

  const showToastOrAlert = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert(message);
    }
  };

  const incrementCounter = () => {
    if (!program || !counterAddress) return;

    if (!isTransactionInProgress) {
      setIsTransactionInProgress(true);

      transact(async (wallet: Web3MobileWallet) => {
        const authResult = await authorizeSession(wallet);
        const latestBlockhashResult = await connection.getLatestBlockhash();

        const ix = await program.methods
          .increment()
          .accounts({counter: counterAddress, user: authResult.publicKey})
          .instruction();

        const balance = await connection.getBalance(authResult.publicKey);

        console.log(
          `Le portefeuille ${authResult.publicKey} a un solde de ${balance}`,
        );

        // Lorsque vous êtes sur Devnet, vous voudrez peut-être transférer du SOL manuellement par session, en raison de la limite de largage airdrop de Devnet
        const minBalance = LAMPORTS_PER_SOL / 1000;

        if (balance < minBalance) {
          console.log(
            `demande de largage airdrop pour ${authResult.publicKey} sur ${connection.rpcEndpoint}`,
          );
          await connection.requestAirdrop(authResult.publicKey, minBalance * 2);
        }

        const transaction = new Transaction({
          ...latestBlockhashResult,
          feePayer: authResult.publicKey,
        }).add(ix);
        const signature = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        showToastOrAlert(`Transaction réussie ! ${signature}`);
      })
        .catch(e => {
          console.log(e);
          showToastOrAlert(`Erreur : ${JSON.stringify(e)}`);
        })
        .finally(() => {
          setIsTransactionInProgress(false);
        });
    }
  };

  return (
    <>
      <Pressable
        style={floatingActionButtonStyle.container}
        onPress={incrementCounter}>
        <Text style={floatingActionButtonStyle.text}>+</Text>
      </Pressable>
    </>
  );
}
```

### 11. Construire et Exécuter

Maintenant, il est temps de tester que tout fonctionne ! Construisez et exécutez avec la commande suivante :

```bash
npm run android
```

Cela ouvrira l'application dans votre émulateur, cliquez sur le bouton + en bas à droite. Cela ouvrira le "faux portefeuille". Le "faux portefeuille" a diverses options pour aider au débogage. L'image ci-dessous indique les boutons à toucher pour tester correctement votre application :

![Application de compteur](../assets/basic-solana-mobile-counter-app.png)

Si vous rencontrez des problèmes, voici quelques exemples de ce qu'ils pourraient être et comment les résoudre :

- L'application ne se construit pas → Quittez Metro avec ctrl+c et réessayez
- Rien ne se passe lorsque vous appuyez sur le `CounterButton` → Assurez-vous d'avoir installé le portefeuille Solana (comme le faux portefeuille que nous avons installé dans les prérequis)
- Vous restez bloqué dans une boucle infinie lors de l'appel de `increment` → Cela est probablement dû à l'atteinte de la limite de largage airdrop de Devnet. Supprimez la section airdrop dans `CounterButton` et envoyez manuellement du sol Devnet à l'adresse de votre portefeuille (imprimée dans la console).

C'est tout ! Vous avez créé votre première application décentralisée Solana Mobile. Si vous rencontrez des difficultés, n'hésitez pas à consulter le [code de solution complet](https://github.com/Unboxed-Software/solana-react-native-counter) sur la branche `main` du dépôt.

# Défi

Votre défi aujourd'hui est de prendre notre application et d'ajouter une fonction de décrémentation. Ajoutez simplement un autre bouton et appelez la fonction `decrement` sur notre programme. Cette instruction existe déjà dans le programme et son IDL, vous devez simplement écrire du code client pour l'appeler.

Après avoir essayé par vous-même, n'hésitez pas à jeter un coup d'œil au [code de solution sur la branche `solution`](https://github.com/Unboxed-Software/solana-react-native-counter/tree/solution).

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=c15928ce-8302-4437-9b1b-9aa1d65af864) !
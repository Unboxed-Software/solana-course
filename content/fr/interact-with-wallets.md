---
title: Interagir avec les portefeuilles
objectives:
- Expliquer les portefeuilles
- Installer l'extension Phantom
- Configurer le portefeuille Phantom sur le [Devnet](https://api.devnet.solana.com/)
- Utiliser wallet-adapter pour que les utilisateurs signent des transactions
---

# Résumé

- Les **portefeuilles** stockent votre clé secrète et gèrent la signature sécurisée des transactions
- Les **portefeuilles matériels** stockent votre clé secrète sur un appareil séparé
- Les **portefeuilles logiciels** utilisent votre ordinateur pour un stockage sécurisé
- Les portefeuilles logiciels sont souvent des **extensions de navigateur** qui facilitent la connexion aux sites web
- La bibliothèque **Wallet-Adapter de Solana** simplifie la prise en charge des extensions de portefeuille de navigateur, vous permettant de créer des sites web pouvant demander l'adresse du portefeuille d'un utilisateur et proposer des transactions à signer

# Aperçu général

## Portefeuilles

Dans les deux leçons précédentes, nous avons discuté des paires de clés. Les paires de clés sont utilisées pour localiser des comptes et signer des transactions. Alors que la clé publique d'une paire de clés peut être partagée en toute sécurité, la clé secrète doit toujours être conservée dans un endroit sécurisé. Si la clé secrète d'un utilisateur est exposée, alors un acteur malveillant pourrait vider son compte de tous ses actifs et exécuter des transactions avec l'autorité de cet utilisateur.

Un "portefeuille" fait référence à tout ce qui stocke une clé secrète afin de la garder sécurisée. Ces options de stockage sécurisé peuvent généralement être décrites comme des portefeuilles "matériels" ou "logiciels". Les portefeuilles matériels sont des dispositifs de stockage séparés de votre ordinateur. Les portefeuilles logiciels sont des applications que vous pouvez installer sur votre (vos) appareil(s) existant(s).

Les portefeuilles logiciels se présentent souvent sous la forme d'une extension de navigateur. Cela permet aux sites web d'interagir facilement avec le portefeuille. Ces interactions se limitent généralement à :

1. Voir la clé publique (adresse) du portefeuille
2. Soumettre des transactions pour l'approbation de l'utilisateur
3. Envoyer une transaction approuvée au réseau

Une fois une transaction soumise, l'utilisateur final peut "confirmer" la transaction et l'envoyer au réseau avec sa "signature".

La signature des transactions nécessite l'utilisation de votre clé secrète. En permettant à un site de soumettre une transaction à votre portefeuille et en laissant le portefeuille gérer la signature, vous vous assurez de ne jamais exposer votre clé secrète au site web. Au lieu de cela, vous partagez uniquement la clé secrète avec l'application de portefeuille.

Sauf si vous créez vous-même une application de portefeuille, votre code ne devrait jamais avoir besoin de demander la clé secrète d'un utilisateur. Au lieu de cela, vous pouvez demander aux utilisateurs de se connecter à votre site en utilisant un portefeuille réputé.

## Portefeuille Phantom

Un des portefeuilles logiciels les plus largement utilisés dans l'écosystème Solana est [Phantom](https://phantom.app). Phantom prend en charge quelques-uns des navigateurs les plus populaires et dispose d'une application mobile pour se connecter en déplacement. Vous voudrez probablement que vos applications décentralisées prennent en charge plusieurs portefeuilles, mais ce cours se concentrera sur Phantom.

## Wallet-Adapter de Solana

Wallet-Adapter de Solana est une suite de bibliothèques que vous pouvez utiliser pour simplifier le processus de prise en charge des extensions de portefeuille de navigateur.

Wallet-Adapter de Solana comprend plusieurs packages modulaires. La fonctionnalité de base se trouve dans `@solana/wallet-adapter-base` et `@solana/wallet-adapter-react`.

Il existe également des packages qui fournissent des composants pour des frameworks d'interface utilisateur courants. Dans cette leçon et tout au long de ce cours, nous utiliserons des composants de `@solana/wallet-adapter-react-ui`.

Enfin, il existe des packages qui sont des adaptateurs pour des portefeuilles spécifiques, y compris Phantom. Vous pouvez utiliser `@solana/wallet-adapter-wallets` pour inclure tous les portefeuilles pris en charge, ou vous pouvez choisir un package de portefeuille spécifique comme `@solana/wallet-adapter-phantom`.

### Installer les bibliothèques Wallet-Adapter

Lors de l'ajout de la prise en charge du portefeuille à une application react existante, commencez par installer les packages appropriés. Vous aurez besoin de `@solana/wallet-adapter-base`, `@solana/wallet-adapter-react`. Si vous prévoyez d'utiliser les composants react fournis, vous devrez également ajouter `@solana/wallet-adapter-react-ui`.

Tous les portefeuilles qui suivent le [standard des portefeuilles](https://github.com/wallet-standard/wallet-standard) sont pris en charge, et presque tous les portefeuilles Solana actuels suivent le standard des portefeuilles. Cependant, si vous souhaitez ajouter la prise en charge de portefeuilles qui ne suive pas le standard, vous pouvez ajouter un package pour eux.

```
npm install @solana/wallet-adapter-base \
    @solana/wallet-adapter-react \
    @solana/wallet-adapter-react-ui
```

### Se connecter aux portefeuilles

`@solana/wallet-adapter-react` nous permet de persister et d'accéder aux états de connexion de portefeuille via des hooks et des fournisseurs de contexte, à savoir :

- `useWallet`
- `WalletProvider`
- `useConnection`
- `ConnectionProvider`

Pour que ces fonctionnalités fonctionnent correctement, toute utilisation de `useWallet` et `useConnection` doit être enveloppée dans `WalletProvider` et `ConnectionProvider`. Une des meilleures façons de garantir cela est d'envelopper toute votre application dans `ConnectionProvider` et `WalletProvider` :

```tsx
import { NextPage } from "next";
import { FC, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import * as web3 from "@solana/web3.js";

export const Home: NextPage = (props) => {
  const endpoint = web3.clusterApiUrl("devnet");
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <p>Placez le reste de votre application ici</p>
      </WalletProvider>
    </ConnectionProvider>
  );
};
```

Notez que `ConnectionProvider` nécessite une propriété `endpoint` et que `WalletProvider` nécessite une propriété `wallets`. Nous continuons à utiliser le point de terminaison pour le cluster Devnet, et comme tous les principaux adaptateurs Solana prennent en charge le standard des portefeuilles, nous n'avons pas besoin d'adaptateurs spécifiques aux portefeuilles.

À ce stade, vous pouvez vous connecter avec `wallet.connect()`, ce qui indiquera au portefeuille de demander à l'utilisateur l'autorisation de voir sa clé publique et de demander l'approbation des transactions.

![Capture d'écran de la demande de connexion du portefeuille](../assets/wallet-connect-prompt.png)

Bien que vous puissiez le faire dans un hook `useEffect`, vous voudrez généralement fournir une fonctionnalité plus sophistiquée. Par exemple, vous pouvez vouloir que les utilisateurs puissent choisir parmi une liste de portefeuilles pris en charge, ou se déconnecter après s'être déjà connectés.

### `@solana/wallet-adapter-react-ui`

Vous pouvez créer des composants personnalisés pour cela, ou vous pouvez utiliser les composants fournis par `@solana/wallet-adapter-react-ui`. La manière la plus simple de fournir des options étendues est d'utiliser `WalletModalProvider` et `WalletMultiButton` :

```tsx
import { NextPage } from "next";
import { FC, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import * as web3 from "@solana/web3.js";

const Home: NextPage = (props) => {
  const endpoint = web3.clusterApiUrl("devnet");
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>
          <WalletMultiButton />
          <p>Placez le reste de votre application ici</p>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default Home;

```

`WalletModalProvider` ajoute une fonctionnalité pour présenter une modale permettant aux utilisateurs de sélectionner le portefeuille qu'ils souhaitent utiliser. `WalletMultiButton` change de comportement pour correspondre à l'état de la connexion :

![Capture d'écran de l'option de sélection du portefeuille multi-bouton](../assets/multi-button-select-wallet.png)

![Capture d'écran de la fenêtre modale de connexion au portefeuille](../assets/connect-wallet-modal.png)

![Capture d'écran des options de connexion du bouton multi-bouton](../assets/multi-button-connect.png)

![Capture d'écran de l'état connecté du bouton multi-bouton](../assets/multi-button-connected.png)

Vous pouvez également utiliser des composants plus granulaires si vous avez besoin d'une fonctionnalité plus spécifique :

- `WalletConnectButton`
- `WalletModal`
- `WalletModalButton`
- `WalletDisconnectButton`
- `WalletIcon`

### Accéder aux informations du compte

Une fois votre site connecté à un portefeuille, `useConnection` récupérera un objet `Connection` et `useWallet` obtiendra le `WalletContextState`. `WalletContextState` a une propriété `publicKey` qui est `null` lorsqu'elle n'est pas connectée à un portefeuille et a la clé publique du compte de l'utilisateur lorsqu'un portefeuille est connecté. Avec une clé publique et une connexion, vous pouvez récupérer les informations du compte et plus encore.

```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { FC, useEffect, useState } from "react";

export const BalanceDisplay: FC = () => {
  const [balance, setBalance] = useState(0);
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  useEffect(() => {
    if (!connection || !publicKey) {
      return;
    }

    connection.onAccountChange(
      publicKey,
      (updatedAccountInfo) => {
        setBalance(updatedAccountInfo.lamports / LAMPORTS_PER_SOL);
      },
      "confirmed",
    );

    connection.getAccountInfo(publicKey).then((info) => {
      setBalance(info.lamports);
    });
  }, [connection, publicKey]);

  return (
    <div>
      <p>{publicKey ? `Solde : ${balance / LAMPORTS_PER_SOL} SOL` : ""}</p>
    </div>
  );
};
```

Notez l'appel à `connection.onAccountChange()`, qui met à jour le solde du compte une fois que le réseau a confirmé la transaction.

### Envoyer des transactions

`WalletContextState` fournit également une fonction `sendTransaction` que vous pouvez utiliser pour soumettre des transactions à l'approbation.

```tsx
const { publicKey, sendTransaction } = useWallet();
const { connection } = useConnection();

const sendSol = (event) => {
  event.preventDefault();

  const transaction = new web3.Transaction();
  const recipientPubKey = new web3.PublicKey(event.target.recipient.value);

  const sendSolInstruction = web3.SystemProgram.transfer({
    fromPubkey: publicKey,
    toPubkey: recipientPubKey,
    lamports: LAMPORTS_PER_SOL * 0.1,
  });

  transaction.add(sendSolInstruction);
  sendTransaction(transaction, connection).then((sig) => {
    console.log(sig);
  });
};

```

Lorsque cette fonction est appelée, le portefeuille connecté affichera la transaction pour l'approbation de l'utilisateur. Si elle est approuvée, la transaction sera envoyée.

![Capture d'écran de la demande d'approbation de transaction du portefeuille](../assets/wallet-transaction-approval-prompt.png)

# Laboratoire

Prenons le programme Ping de la leçon précédente et construisons une interface utilisateur qui permet aux utilisateurs d'approuver une transaction qui ping le programme. Pour rappel, l'identifiant public du programme est `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa` et l'identifiant public du compte de données est `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Capture d'écran de Solana Ping App](../assets/solana-ping-app.png)

### 1. Téléchargez l'extension de navigateur Phantom et configurez-la sur Devnet

Si ce n'est pas déjà fait, téléchargez [l'extension de navigateur Phantom](https://phantom.app/download). Au moment de la rédaction de ces lignes, elle prend en charge les navigateurs Chrome, Brave, Firefox et Edge, vous devrez donc également avoir l'un de ces navigateurs installés. Suivez les instructions de Phantom pour créer un nouveau compte et un nouveau portefeuille.

Une fois que vous avez un portefeuille, cliquez sur l'icône d'engrenage en bas à droite de l'interface utilisateur de Phantom. Faites défiler vers le bas et cliquez sur l'élément de ligne "Change Network" et sélectionnez "Devnet". Cela garantit que Phantom sera connecté au même réseau que celui que nous utiliserons dans ce laboratoire.

### 2. Téléchargez le code de départ

Téléchargez le [code de départ de ce projet](https://github.com/Unboxed-Software/solana-ping-frontend/tree/starter). Ce projet est une application Next.js simple. Il est principalement vide à l'exception du composant `AppBar`. Nous allons construire le reste tout au long de ce laboratoire.

Vous pouvez voir son état actuel en exécutant la commande `npm run dev` dans la console.

### 3. Enveloppez l'application dans les fournisseurs de contexte appropriés

Pour commencer, nous allons créer un nouveau composant pour contenir les différents fournisseurs Wallet-Adapter que nous allons utiliser. Créez un nouveau fichier à l'intérieur du dossier `components` appelé `WalletContextProvider.tsx`.

Commençons par une partie du code de base d'un composant fonctionnel :

```tsx
import { FC, ReactNode } from "react";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (

  ));
};

export default WalletContextProvider;
```

Pour se connecter correctement au portefeuille de l'utilisateur, nous aurons besoin d'un `ConnectionProvider`, d'un `WalletProvider` et d'un `WalletModalProvider`. Commencez par les importer depuis `@solana/wallet-adapter-react` et `@solana/wallet-adapter-react-ui`. Ensuite, ajoutez-les au composant `WalletContextProvider`. Notez que `ConnectionProvider` nécessite un paramètre `endpoint` et que `WalletProvider` nécessite une liste de `wallets`. Pour l'instant, utilisez simplement une chaîne vide et une liste vide, respectivement.

```tsx
import { FC, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ConnectionProvider endpoint={""}>
      <WalletProvider wallets={[]}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;

```

Les dernières choses dont nous avons besoin sont un point de terminaison réel pour `ConnectionProvider` et les portefeuilles pris en charge pour `WalletProvider`.

Pour le point de terminaison, nous utiliserons la même fonction `clusterApiUrl` de la bibliothèque `@solana/web3.js` que nous avons utilisée précédemment, donc vous devrez l'importer. Pour la liste des portefeuilles, vous devrez également importer la bibliothèque `@solana/wallet-adapter-wallets`.

Après avoir importé ces bibliothèques, créez une constante `endpoint` qui utilise la fonction `clusterApiUrl` pour obtenir l'URL pour Devnet. Ensuite, créez une constante `wallets` et définissez-la sur une liste vide - puisque tous les portefeuilles prennent en charge le Wallet Standard, nous n'avons plus besoin d'adaptateurs de portefeuille personnalisés. Enfin, remplacez la chaîne vide et la liste vide dans `ConnectionProvider` et `WalletProvider`, respectivement.

Pour compléter ce composant, ajoutez `require('@solana/wallet-adapter-react-ui/styles.css');` en dessous de vos imports pour garantir le style et le comportement appropriés des composants de la bibliothèque Wallet Adapter.

```tsx
import { FC, ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import * as web3 from "@solana/web3.js";
import * as walletAdapterWallets from "@solana/wallet-adapter-wallets";
require("@solana/wallet-adapter-react-ui/styles.css");

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = web3.clusterApiUrl("devnet");
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;

```

### 4. Ajouter le bouton multi-portefeuille

Ensuite, configurons le bouton Connexion. Le bouton actuel n'est qu'un espace réservé car plutôt que d'utiliser un bouton standard ou de créer un composant personnalisé, nous utiliserons le "multi-bouton" de Wallet-Adapter. Ce bouton interagit avec les fournisseurs que nous avons configurés dans `WalletContextProvider` et permet aux utilisateurs de choisir un portefeuille, de se connecter à un portefeuille et de se déconnecter d'un portefeuille. Si vous avez besoin de fonctionnalités plus personnalisées, vous pouvez créer un composant personnalisé pour le gérer.

Avant d'ajouter le "multi-bouton", nous devons envelopper l'application dans le `WalletContextProvider`. Faites-le en l'important dans `index.tsx` et en l'ajoutant après le tag fermant `</Head>` :

```tsx
import { NextPage } from "next";
import styles from "../styles/Home.module.css";
import WalletContextProvider from "../components/WalletContextProvider";
import { AppBar } from "../components/AppBar";
import Head from "next/head";
import { PingButton } from "../components/PingButton";

const Home: NextPage = (props) => {
  return (
    <div className={styles.App}>
      <Head>
        <title>Wallet-Adapter Example</title>
        <meta name="description" content="Wallet-Adapter Example" />
      </Head>
      <WalletContextProvider>
        <AppBar />
        <div className={styles.AppBody}>
          <PingButton />
        </div>
      </WalletContextProvider>
    </div>
  );
};

export default Home;
```

Si vous exécutez l'application, tout devrait toujours ressembler à la même chose, car le bouton actuel en haut à droite n'est toujours qu'un espace réservé. Pour remédier à cela, ouvrez `AppBar.tsx` et remplacez `<button>Connect</button>` par `<WalletMultiButton/>`. Vous devrez importer `WalletMultiButton` depuis `@solana/wallet-adapter-react-ui`.

```tsx
import { FC } from "react";
import styles from "../styles/Home.module.css";
import Image from "next/image";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export const AppBar: FC = () => {
  return (
    <div className={styles.AppHeader}>
      <Image src="/solanaLogo.png" height={30} width={200} />
      <span>Wallet-Adapter Example</span>
      <WalletMultiButton />
    </div>
  );
};
```

À ce stade, vous devriez pouvoir exécuter l'application et interagir avec le bouton multi-fonction en haut à droite de l'écran. Il devrait maintenant afficher "Select Wallet". Si vous avez l'extension Phantom et que vous êtes connecté, vous devriez pouvoir connecter votre portefeuille Phantom au site en utilisant ce nouveau bouton.

### 5. Créer un bouton pour appeler le programme

Maintenant que notre application peut se connecter au portefeuille Phantom, faisons en sorte que le bouton "Ping!" fasse réellement quelque chose.

Commencez par ouvrir le fichier `PingButton.tsx`. Nous allons remplacer le `console.log` à l'intérieur de `onClick` par du code qui créera une transaction et la soumettra à l'extension Phantom pour l'approbation de l'utilisateur final.

Tout d'abord, nous avons besoin d'une connexion, de la clé publique du portefeuille et de la fonction `sendTransaction` de Wallet-Adapter. Pour obtenir cela, nous devons importer `useConnection` et `useWallet` depuis `@solana/wallet-adapter-react`. Pendant que nous y sommes, importons également `@solana/web3.js` car nous en aurons besoin pour créer notre transaction.

```tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import * as web3 from '@solana/web3.js'
import { FC, useState } from 'react'
import styles from '../styles/PingButton.module.css'

export const PingButton: FC = () => {

  const onClick = () => {
    console.log('Ping!')
  }

  return (
    <div className={styles.buttonContainer} onClick={onClick}>
      <button className={styles.button}>Ping!</button>
    </div>
  )
}
```

Maintenant, utilisez le hook `useConnection` pour créer une constante `connection` et le hook `useWallet` pour créer les constantes `publicKey` et `sendTransaction`.

```tsx
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import * as web3 from "@solana/web3.js";
import { FC, useState } from "react";
import styles from "../styles/PingButton.module.css";

export const PingButton: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const onClick = () => {
    console.log("Ping!");
  };

  return (
    <div className={styles.buttonContainer} onClick={onClick}>
      <button className={styles.button}>Ping!</button>
    </div>
  );
};
```

Avec cela, nous pouvons remplir le corps de `onClick`.

Tout d'abord, vérifiez que `connection` et `publicKey` existent (si l'un d'eux n'existe pas, le portefeuille de l'utilisateur n'est pas encore connecté).

Ensuite, construisez deux instances de `PublicKey`, une pour l'ID de programme `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa` et une pour le compte de données `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

Ensuite, construisez une `Transaction`, puis une nouvelle `TransactionInstruction` qui inclut le compte de données en tant que clé inscriptible.

Ajoutez ensuite l'instruction à la transaction.

Enfin, appelez `sendTransaction`.

```tsx
const onClick = () => {
  if (!connection || !publicKey) {
    return;
  }

  const programId = new web3.PublicKey(PROGRAM_ID);
  const programDataAccount = new web3.PublicKey(DATA_ACCOUNT_PUBKEY);
  const transaction = new web3.Transaction();

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

  transaction.add(instruction);
  sendTransaction(transaction, connection).then((sig) => {
    console.log(sig);
  });
};
```

Et voilà ! Si vous actualisez la page, connectez votre portefeuille et cliquez sur le bouton ping, Phantom devrait vous présenter une fenêtre contextuelle pour confirmer la transaction.

### 6. Ajouter quelques finitions

Il y a beaucoup de choses que vous pourriez faire pour améliorer encore l'expérience utilisateur ici. Par exemple, vous pourriez changer l'interface utilisateur pour ne vous montrer le bouton Ping que lorsqu'un portefeuille est connecté et afficher un autre message sinon. Vous pourriez créer un lien vers la transaction sur Solana Explorer après que l'utilisateur ait confirmé une transaction pour qu'il puisse facilement aller voir les détails de la transaction. Plus vous expérimentez, plus vous vous sentirez à l'aise, alors soyez créatif !

Vous pouvez également télécharger [le code source complet de ce laboratoire](https://github.com/Unboxed-Software/solana-ping-frontend) pour comprendre tout cela dans son contexte.

# Défi

Maintenant, c'est à vous de construire quelque chose de manière indépendante. Créez une application qui permet à un utilisateur de connecter son portefeuille Phantom et d'envoyer des SOL à un autre compte.

![Capture d'écran de l'application d'envoi de SOL](../assets/solana-send-sol-app.png)

1. Vous pouvez construire cela à partir de zéro ou vous pouvez [télécharger le code de départ](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/starter).
2. Enveloppez l'application de départ dans les fournisseurs de contexte appropriés.
3. Dans le composant de formulaire, configurez la transaction et envoyez-la au portefeuille de l'utilisateur pour approbation.
4. Soyez créatif avec l'expérience utilisateur. Ajoutez un lien pour permettre à l'utilisateur de voir la transaction sur Solana Explorer ou quelque chose d'autre qui vous semble cool !

Si vous êtes vraiment bloqué, n'hésitez pas à [consulter le code de la solution](https://github.com/Unboxed-Software/solana-send-sol-frontend/tree/main).


## Vous avez fini le laboratoire ?

Publiez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=69c5aac6-8a9f-4e23-a7f5-28ae2845dfe1) !
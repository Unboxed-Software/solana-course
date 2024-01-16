---
title: Exploring Mobile Wallet Adapter
objectives:
- Describe the differences between connecting to a web wallet vs a mobile wallet
- Connect to and sign transactions from a mobile wallet
- Create a simple mobile wallet
- Explain at a high level the interaction between `walletlib` and wallet apps
---

# TL;DR
- Wallets are just wrappers around a keypair, but they're essential for secure key management
- Mobile and Web dApps handle their wallet-app connection differently
- MWA handles all of its wallet interaction within the `transact` function
- Solana Mobile's `walletlib` does the heavy lifting for surfacing wallet requests to wallet apps

# Overview

Wallets exist to protect your secret keys. While some applications might have app-specific keys, many crypto use cases rely on a single identity used across multiple apps. In these cases, you very much want to be careful about how you expose signing across these apps. You don't want to share your secret key with all of them, which means you need a standard for allowing apps to submit transactions for signature to a secure wallet app that holds your secret key. This is where the Mobile Wallet Adapter (MWA) comes in. It's the transport layer to connect your mobile dApps to your wallet.

## What is MWA

Mobile Wallet Adapter (MWA) is the mobile connection between dApps and wallets. Much like the [wallet adapter](https://github.com/solana-labs/wallet-adapter) we're used to on the web, MWA allows us to create native mobile dApps. However, since the web and mobile are different platforms, we have to approach the app-wallet connection differently.

At its core, a wallet app is fairly straightforward. It's a secure wrapper around your keypair. External applications can request that the wallet sign transactions without ever having access to your private key. Both the web and mobile wallet adapters define this interaction for their respective platforms.

### How does a web wallet work?

A web wallet is simply a browser extension that stores keypairs and allows the browser to request access to its functions. It's the wallet's job to follow the [wallet standard](https://github.com/wallet-standard/wallet-standard), which defines what functions should be available to the browser:

- `registerWallet`
- `getWallets`
- `signAndSendTransaction`
- `signIn`
- `signTransaction`
- `signMessage`

These functions are all available to the browser through the global `window` object. The browser extension registers itself as a wallet. The wallet adapter looks for these registered wallets and allows the client to connect and interact with them.

A browser extension wallet can run isolated JavaScript. This means it can inject functions into the browser's `window` object. Effectively, the transport layer here is just extra JavaScript code as far as the browser is concerned. 

If you're curious to know more about how browser extensions work, take a look at some [open-source browser extensions](https://github.com/solana-labs/browser-extension/tree/master). 

### How MWA is different from web wallets

Mobile Wallet Adapter (MWA) is different. In the web world, we just need to inject some code into the `window` object to access our wallets. Mobile apps, however, are sandboxed. This means that the code for each app is isolated from other apps. There's no shared state between apps that would be analogous to a browser's `window` object. This poses a problem for wallet signing since a mobile wallet and a mobile dApp exist in isolated environments.

However, there are ways to facilitate communication if you're willing to get creative. On Android, basic inter-app communication is done through [`Intents`](https://developer.android.com/guide/components/intents-filters). An Android Intent is a messaging object used to request an action from another app component.

This particular communication is one-way, whereas the interface for wallet functionality requires two-way communication. MWA gets around this by using an intent from the requesting app to trigger the wallet app opening up two-way communication using WebSockets.

The rest of this lesson will focus on the MWA interface and functionality rather than the low-level mechanisms underpinning inter-app communication. However, if you want to know the nitty gritty, read the [MWA specs](https://solana-mobile.github.io/mobile-wallet-adapter/spec/spec.html).

## How to work with MWA

The differences between MWA and the traditional wallet adapter require slight modifications to how you program your apps.

### Connect to a wallet

By way of comparison, look at the example of connecting to a wallet with React vs with React Native.

On the web, you wrap the application with `WalletProvider`, and then children access the wallet through the `useWallet` hook. From there, children can view, select, connect, and interact with wallets.

```tsx
// Parent
<WalletProvider wallets={wallets}>
  {children}
</WalletProvider>

// Child
const {wallets, select, connect} = useWallet();
const wallet = wallets[0] // choose a wallet
select(wallet); // select the wallet
connect(); // connect
```

In React Native, using MWA, this looks a little different. In this case, providers aren't needed. Rather, wallet context is provided through the `transact` function from the MWA package. Behind the scenes, this function searches the devices for active Solana wallets. It surfaces these wallets to the user through a partial selection modal. Once the user selects a wallet, that wallet is provided as an argument to the `transact` callback. Your code can then interact with the wallet directly.

```tsx
transact(async (wallet: Web3MobileWallet) => { 
  // returns you the context of the user selected wallet
});
```

### Authorize a wallet

On the web, the first time you connect a wallet to a site in your browser, the wallet prompts you to authorize the site. Similarly, on mobile, the requesting app needs to be authorized before it can request *privileged* methods like signing a transaction.

Your code can trigger this authorization process by calling `wallet.authorize()`. The user will be prompted to accept or reject the authorization request. The returned `AuthorizationResult` will indicate the user's acceptance or rejection. If accepted, this result object provides you with the user's account as well as an `auth_token` you can use in `wallet.reauthorize()` for subsequent calls. This auth token ensures that other apps can't pretend to be your app.

```tsx
transact(async (wallet: Web3MobileWallet) => { 
  const authResult = wallet.authorize(
    {
      cluster: "devnet", 
      identity: { name: 'Solana Counter Incrementor' }
    }
  ); // Authorizes the wallet 

  const authToken = authResult.auth_token; // save this for the wallet.reauthorize() function
  const publicKey = authResult.selectedAccount.publicKey
});
```

It's worth noting that all methods except `authorize` and `deauthorize` are *privileged* methods. So you'll want to track if a wallet is authorized or not and call `wallet.reauthorize()` when it is. Below is a simple example that tracks the authorization state:

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

Note that the above example does not handle errors or user rejections. In production, it's a good idea to wrap the authorization state and methods with a custom `useAuthorization` hook. For reference, we built this [in the previous lesson](./basic-solana-mobile.md#5-create-authprovidertsx).

### Interact with a wallet

Unlike connecting and authorizing wallets, requesting methods like `signAndSendTransactions`, `signMessages`, and `signTransactions` is virtually the same between web and mobile.

On the web, you can access these methods with the `useWallet` hook. You just have to make sure you're connected before calling them:

```tsx
const { connected, signAllTransactions, signMessage, sendTransaction } = useWallet();

if ( connected ) {
  signAllTransactions(...);
  signMessage(...);
  sendTransaction(...);
}
```

For MWA, simply call the functions on the `wallet` context provided by the `transact` callback:

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

  // Choose your interaction...
  wallet.signAndSendTransactions(...)
  wallet.signMessages(...)
  wallet.signTransactions(...)
});
```

Every time you want to call these methods, you will have to call `wallet.authorize()` or `wallet.reauthorize()`. 

And that's it! You should have enough information to get started. The Solana mobile team has put in a lot of work to make the development experience as seamless as possible between the two. 

## What MWA is doing wallet-side

This lesson has talked mostly about what MWA is doing in dApps, but a huge portion of MWA functionality happens in wallets. Whether you want to create your own wallet or simply understand the system better, it's worth discussing what MWA-compatible wallets are doing at a high level. For most readers, it's not essential to feel like you can create a wallet after reading through these sections; simply try to get a sense of the overall flow.

### Introduction to the `walletlib`

Solana Mobile has done the vast majority of the heavy lifting by creating the `mobile-wallet-adapter-walletlib`. This library handles all the low-level communication between dApps and wallets. However, this package is still in development and is not available through npm. From their GitHub:

>This package is still in alpha and is not production ready. However, the API is stable and will not change drastically, so you can begin integration with your wallet.

However, `walletlib` doesn't provide UI for you or determine the outcome of requests. Rather, it exposes a hook allowing the wallet code to receive and resolve requests. The wallet developer is responsible for displaying the appropriate UI, managing the wallet behavior, and appropriately resolving each request.

### How wallets use the `walletlib`

At its core, wallets use `walletlib` by calling a single function: `useMobileWalletAdapterSession`. When calling this function, wallets provide the following:
1. The wallet name
2. A configuration object of type `MobileWalletAdapterConfig`
3. A handler for requests
4. A handler for sessions

Below is an example component that shows the scaffold of how wallets connect to the `walletlib`:

```tsx
import {useCallback, useMemo } from 'react';
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

If you were to create your own wallet, you would modify the `config` object and implement the `handleRequest` and `handleSessionEvent` handlers accordingly. While all of these are required and all are important, the primary element is the request handler. This is where wallets provide the implementation logic for each request, e.g. how to handle when a dApp requests authorization or requests that the wallet sign and send a transaction.

For example, if the request is of type `MWARequestType.SignAndSendTransactionsRequest`, then your code would use the user's secret key to sign the transaction provided by the request, send the request to an RPC provider, and then respond to the requesting dApp using a `resolve` function.

All the `resolve` function does is tell the dApp what happened and close the session. The `resolve` function takes two arguments: `request` and `response`. The types of `request` and `response` are different depending on what the original request was. So in the example of `MWARequestType.SignAndSendTransactionsRequest`, you would use the following resolve function:

```ts
export function resolve(request: SignAndSendTransactionsRequest, response: SignAndSendTransactionsResponse): void;
```

The `SignAndSendTransactionsResponse` type is defined as follows:

```ts
export type SignAndSendTransactionsCompleteResponse = Readonly<{ signedTransactions: Uint8Array[] }>;
export type SignAndSendTransactionsResponse =
  | SignAndSendTransactionsCompleteResponse
  | UserDeclinedResponse
  | TooManyPayloadsResponse
  | AuthorizationNotValidResponse
  | InvalidSignaturesResponse;
```

Which response you send would depend on the result of attempting to sign and send the transaction.

You can dig into the [`walletlib` source](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/js/packages/mobile-wallet-adapter-walletlib) if you'd like to know all of the types associated with `resolve`.

One final point is that the component used for interacting with `walletlib` also needs to be registered in the app's `index.js` as the MWA entry point for the app.

```js
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import MWAApp from './MWAApp'

// Mock event listener functions to prevent them from fataling.
window.addEventListener = () => {};
window.removeEventListener = () => {};

AppRegistry.registerComponent(appName, () => App);

// Register the MWA component
AppRegistry.registerComponent(
'MobileWalletAdapterEntrypoint',
  () => MWAApp,
);
```

## Conclusion

While the MWA is slightly different than the web wallet standard, once you understand the nuances between them it becomes fairly straightforward to implement mobile wallet interaction. This becomes especially true when you understand what MWA is doing not only in your dApp but also in wallets. If anything remains unclear to you, be sure to spend time familiarizing yourself with both sides of the equation.

# Lab

Now let's do some hands-on practice by building a mobile wallet. The goal here is to see what happens on both sides of the MWA process in order to demystify the app-wallet relationship.

### 0. Set up development environment if needed

Before we start programming our wallet, we need to do some setup. You will need a React Native development environment and a Solana dApp to test on. If you have completed the [Basic Solana Mobile lesson](./basic-solana-mobile), both of these requirements should be met with the counter app installed on your Android device/emulator.

If you *haven't* completed the last lesson you will need to:

1. Setup an [Android React Native developer environment](https://reactnative.dev/docs/environment-setup) with a device or emulator
2. Install a [Devnet Solana dApp](https://github.com/Unboxed-Software/solana-react-native-counter.git)


If you want to install the app from the previous lesson, you can:

```bash
git clone https://github.com/Unboxed-Software/solana-react-native-counter.git
cd solana-react-native-counter
git checkout solution
npm run install
```

### 1. Plan out the app's structure

We are making the wallet from scratch, so let's look at our major building blocks.

First, we'll make the actual wallet app (popup not included). This will include creating or modifying the following:
- WalletProvider.tsx
- MainScreen.tsx
- App.tsx

Next, we'll make a boilerplate MWA app that displays 'Im a Wallet' anytime the wallet is requested from a different dApp. This will include creating or modifying the following:
- MWAApp.tsx
- index.js

Then we'll set up all of our UI and request routing. This will mean creating or modifying the following:
- MWAApp.tsx
- ButtonGroup.tsx
- AppInfo.tsx

Finally, we'll implement two actual request functions, authorize and sign and send transactions. This entails creating the following:
- AuthorizeDappRequestScreen.tsx
- SignAndSendTransactionScreen.tsx

### 2. Scaffold the app

Let's scaffold the app with:

```bash
npx react-native@latest init wallet --npm
cd wallet
```

Now, let's install our dependencies. These are the same dependencies from our [Introduction to Solana Mobile lab](./basic-solana-mobile.md#2-create-the-app) with two additions:
- `@react-native-async-storage/async-storage`: provides access to on-device storage
- `fast-text-encoding`: a polyfill for text encoding

We will be using `async-storage` to store our keypair so that the wallet will stay persistent through multiple sessions. It is important to note that `async-storage` is ***NOT*** a safe place to keep your keys in production. Again, ***DO NOT*** use this in production. Instead, take a look at [Android's keystore system](https://developer.android.com/privacy-and-security/keystore).

Install these dependencies with the following command:

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

The next step is a bit messy. We need to depend on Solana's `mobile-wallet-adapter-walletlib` package, which handles all of the low-level communication. However, this package is still in development and is not available through npm. From their github:

> This package is still in alpha and is not production ready. However, the API is stable and will not change drastically, so you can begin integration with your wallet.

However, we have extracted the package and made it available on GitHub. If you're interested in how we did that, take a look at the README [on the GitHub repo where we've made this package available](https://github.com/Unboxed-Software/mobile-wallet-adapter-walletlib)

Let's install the package in a new folder `lib`:

```bash
mkdir lib
cd lib
git clone https://github.com/Unboxed-Software/mobile-wallet-adapter-walletlib.git
```

Next, we have to manually link it by adding `@solana-mobile/mobile-wallet-adapter-walletlib` to our `package.json` dependencies with the file path as the resolution:

```json
"dependencies": {
    ...
    "@solana-mobile/mobile-wallet-adapter-walletlib": "file:./lib/mobile-wallet-adapter-walletlib",
    ...
}
```

Let npm know about the new package by installing again in the root of your project:

```bash
cd ..
npm install
```

Next, in `android/build.gradle`, change the `minSdkVersion` to version `23`.
```gradle
  minSdkVersion = 23
```

Finally, finish the initial setup by building the app. You should get the default React Native app showing up on your device.

```bash
npm run android
```

If you get any errors make sure you double-check you've followed all of the steps above.

### 3. Create the main wallet app

There are two parts to the wallet application we'll be building:
1. The UI to be displayed when you manually open the wallet application
2. The UI to be displayed as a bottom sheet when a separate app requests to use the wallet
  
Throughout this lab, we'll be calling these the "main wallet app" and "wallet popup," respectively.

- Generate a `Keypair` when the app first loads
- Display the address and Devnet SOL balance
- Allow users to airdrop some Devnet SOL to their wallet

This can all be accomplished by creating two files:

- `WalletProvider.tsx` - Generates a Keypair and stores it in `async-storage`, then fetches the keypair on subsequent sessions. It also provides the Solana `Connection`
- `MainScreen.tsx` - Shows the wallet, its balance, and an airdrop button

Let's start with the `WalletProvider.tsx`. This file will use `async-storage` to store a base58 encoded version of a `Keypair`. The provider will check the storage key of `@my_fake_wallet_keypair_key`. If nothing returns, then the provider should generate and store a keypair. The `WalletProvider` will then return its context including the `wallet` and `connection`. The rest of the app can access this context using the `useWallet()` hook.

***AGAIN***, async storage is not fit to store private keys in production. Please use something like [Android's keystore system](https://developer.android.com/privacy-and-security/keystore).

Let's create the `WalletProvider.tsx` within a new directory named `components`:

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
        // Generate a new random pair of keys and store them in local storage for later retrieval
        // This is not secure! Async storage is used for demo purpose. Never store keys like this!
        keyPair = await Keypair.generate();
        await AsyncStorage.setItem(
          ASYNC_STORAGE_KEY,
          JSON.stringify(encodeKeypair(keyPair)),
        );
      }
      setKeyPair(keyPair);
    } catch (e) {
      console.log('error getting keypair: ', e);
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

Note that we are defaulting our `rpcUrl` to Devnet.

Now let's make the `MainScreen.tsx`. It should simply grab the `wallet` and `connection` from `useWallet()`, and then display the address and balance. Additionally, since all transactions require a transaction fee in SOL, we'll also include an airdrop button.

Create a new directory called `screens` and a new file called `MainScreen.tsx` inside of it:
```tsx
import {Button, StyleSheet, Text, View} from 'react-native';
import {useWallet} from '../components/WalletProvider';
import {useEffect, useState} from 'react';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center', // Centers children along the main axis (vertically for column)
    alignItems: 'center', // Centers children along the cross axis (horizontally for column)
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
      <Text>Wallet:</Text>
      <Text>{wallet?.publicKey.toString() ?? 'No Wallet'}</Text>
      <Text>Balance:</Text>
      <Text>{balance?.toFixed(5) ?? ''}</Text>
      {isLoading && <Text>Loading...</Text>}
      {balance != null && !isLoading && balance < 0.005 && (
        <Button title="Airdrop 1 SOL" onPress={airdrop} />
      )}
    </View>
  );
};

export default MainScreen;
```

Lastly, let's edit the `App.tsx` file to complete the 'app' section of our wallet:

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

Make sure everything is working by building and deploying:

```bash
npm run android
```

### 4. Create helper components

Now let's take a brief detour and create some helper UI components that we'll need for the wallet popup. We'll define a layout for some text with `AppInfo.tsx` and some buttons in `ButtonGroup.tsx`.

First, `AppInfo.tsx` will show us relevant information coming from the dApp requesting a wallet connection. Go ahead and create the following as `components/AppInfo.tsx`:

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
        <Text>Request Metadata</Text>
        <Text>Cluster: {cluster ? cluster : 'NA'}</Text>
        <Text>App name: {appName ? appName : 'NA'}</Text>
        <Text>Scope: {scope ? scope : 'NA'}</Text>
      </View>
    </>
  );
}

export default AppInfo;
```

Second, let's create a component that groups an "accept" and "reject" button as `components/ButtonGroup.tsx`:

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

### 5. Create the wallet popup boilerplate

The wallet popup is what is seen when a Solana dApp sends out an intent for `solana-wallet://`. Our wallet will listen for this, establish a connection, and render the popup.

Fortunately, we don't have to implement anything low-level. Solana has done the hard work for us in the `mobile-wallet-adapter-walletlib` library. All we have to do is create the view and handle the requests.

Let's start with the absolute bare bones of the popup. All it will do is pop up when a dApp connects to it and simply say "I'm a wallet".

To make this pop up when a Solana dApp requests access, we'll need the `useMobileWalletAdapterSession` from the `walletlib`. This requires four things:

- `walletName` - the name of the wallet
- `config` - some simple wallet configurations of type `MobileWalletAdapterConfig`
- `handleRequest` - a callback function to handle requests from the dApp
- `handleSessionEvent` - a callback function to handle session events

Here is an example of the minimum setup to satisfy `useMobileWalletAdapterSession`:
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

We will be implementing `handleRequest` and `handleSessionEvent` soon, but let's make the bare-bones popup work first.

Create a new file in the root of your project called `MWAApp.tsx`:

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
          <Text style={{fontSize: 50}}>I'm a wallet!</Text>
        </View>
      </WalletProvider>
    </SafeAreaView>
  );
};

export default MWAApp;
```

The last thing we need to do is to register our MWA app as an entry point in `index.js` under the name `MobileWalletAdapterEntrypoint`.

Change `index.js` to reflect the following:
```js
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import MWAApp from './MWAApp'

// Mock event listener functions to prevent them from fataling.
window.addEventListener = () => {};
window.removeEventListener = () => {};

AppRegistry.registerComponent(appName, () => App);

// Register the MWA component
AppRegistry.registerComponent(
'MobileWalletAdapterEntrypoint',
  () => MWAApp,
);
```

Go ahead and test this out to make sure it works. First 

```bash
npm run android
```

Open your Devnet Solana dApp, ideally the `counter` app from the previous lesson, then make a request.

You should see a sheet present from the bottom of the screen that says "I'm a wallet."

### 6. Create the MWA scaffolding

Let's flesh out `MWAApp.tsx` to scaffold out some of the architecture that will later allow users to connect, sign, and send transactions. For now, we'll only do this for two of the MWA functions: `authorize` and `signAndSendTransaction`.

To start, we'll add a few things in `MWAApp.tsx`:

1. Do some lifecycle management by saving the `currentRequest` and `currentSession` in a `useState`. This will allow us to track the life cycle of a connection.
2. Add a `hardwareBackPress` listener in a `useEffect` to gracefully handle closing out the popup. This should call `resolve` with `MWARequestFailReason.UserDeclined`.
3. Listen for a `SessionTerminatedEvent` in a `useEffect` to close out the popup. This should call `exitApp` on the `BackHandler`. We'll be doing this in a helper function to keep functionality contained.
4. Listen for a `ReauthorizeDappRequest` request type in a `useEffect` and automatically resolve it.
5. Render appropriate content for the different types of requests with `renderRequest()`. This should be a `switch` statement that will route to different UI based on the request type.

Change your `MWAApp.tsx` to reflect the following:

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
  // ------------------- FUNCTIONS --------------------

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

  // ------------------- EFFECTS --------------------

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

  // ------------------- RENDER --------------------

  const renderRequest = () => {
    if (!currentRequest) {
      return <Text>No request</Text>;
    }
  
  
    switch (currentRequest?.__type) {
      case MWARequestType.AuthorizeDappRequest:
      case MWARequestType.SignAndSendTransactionsRequest:
      case MWARequestType.SignMessagesRequest:
      case MWARequestType.SignTransactionsRequest:
      default:
        return <Text>TODO Show screen for {currentRequest?.__type}</Text>;
    }
  }

  // ------------------- RENDER --------------------

  return (
    <SafeAreaView>
      <WalletProvider>
        <View style={styles.container}>
          <Text>REQUEST: {currentRequest?.__type.toString()}</Text>
          {renderRequest()}
        </View>
      </WalletProvider>
    </SafeAreaView>
  );
}

export default MWAApp;
```

Note that `renderRequest` is not rendering anything useful yet. We still need to *handle* the different requests.

### 7. Implement the authorization popup

Let's put together our first screen to handle new authorizations. This screen's only job is to show what app wants authorization and allow the user to accept or deny the request using the `resolve` function from the `walletlib`.

We'll use our `AppInfo` and `ButtonGroup` to compose our entire UI here. All we have to do is plug in the right information and write the logic for accepting and rejecting the request.

For authorization, the `resolve` function we'll use is the one using the `AuthorizeDappRequest` and `AuthorizeDappResponse` types. `AuthorizeDappResponse` is a union of types `AuthorizeDappCompleteResponse` and `UserDeclinedResponse`. The definition for each is shown below:

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

Our logic will determine which of these to use when resolving the request.

Now that we have all that context, we can put everything together in a new file called `screens/AuthorizeDappRequestScreen.tsx`:

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

Now let's update our `MWAApp.tsx` to handle this situation by adding to our `renderRequest` switch statement:
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

Feel free to build and run the wallet again. When you first interact with another Solana app, our new authorization screen will now appear.

### 8. Implement the sign-and-send popup

Let's finish up our wallet app with the sign and send transaction screen. Here, we need to grab the transactions from the `request`, sign them with our secret key from our `WalletProvider`, and then send them to an RPC.

The UI will look very similar to our authorization page. We'll provide some info about the app with `AppInfo` and some buttons with `ButtonGroup`. This time, we will fulfill the `SignAndSendTransactionsRequest` and `SignAndSendTransactionsResponse` for our `resolve` function.

```ts
export function resolve(request: SignAndSendTransactionsRequest, response: SignAndSendTransactionsResponse): void;
```

More specifically, we'll have to adhere to what `SignAndSendTransactionsResponse` is unioned with:
```ts
export type SignAndSendTransactionsCompleteResponse = Readonly<{ signedTransactions: Uint8Array[] }>;
export type SignAndSendTransactionsResponse =
    SignAndSendTransactionsCompleteResponse
    | UserDeclinedResponse
    | TooManyPayloadsResponse
    | AuthorizationNotValidResponse
    | InvalidSignaturesResponse;
```

We are only going to cover the `SignAndSendTransactionsCompleteResponse`, `InvalidSignaturesResponse`, and `UserDeclinedResponse`.

Most notably, we'll have to adhere to `InvalidSignaturesResponse`:
```ts
export type InvalidSignaturesResponse = Readonly<{
  failReason: MWARequestFailReason.InvalidSignatures;
  valid: boolean[];
}>;
```

The `InvalidSignaturesResponse` is unique because it requires an array of booleans, each of which corresponds to a failed transaction. So we'll have to keep track of that.

As for signing and sending, we'll have to do some work. Since we are sending transactions over sockets, the transaction data is serialized into bytes. We'll have to deserialize the transactions before we sign them.

We can do this in two functions:
- `signTransactionPayloads`: returns the signed transactions along with a 1-to-1 `valid` boolean array. We'll check that to see if a signature has failed.
- `sendSignedTransactions`: takes the signed transactions and sends them out to the RPC. Similarly, it keeps an array of `valid` booleans to know which transactions failed.

Let's put that all together in a new file called `screens/SignAndSendTransactionScreen.tsx`:
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

Finally, let's edit `MWAApp.tsx` and add our new screen to the switch statement:
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

Go ahead and build and run your wallet app. You should now be able to authorize your dApp and sign and send transactions. Note that we left `SignMessagesRequest` and `SignTransactionsRequest` empty so you can do it in the Challenge.

Nice work! Creating a wallet, even a "fake" version, is no small feat. If you got stuck anywhere, make sure to go back through it until you understand what's happening. Also, feel free to look through the lab's [solution code on the `main` branch](https://github.com/Unboxed-Software/react-native-fake-solana-wallet).

# Challenge

Now it's your turn to practice independently. Try and implement the last two request types: `SignMessagesRequest` and `SignTransactionsRequest`.

Try to do this without help as it's great practice, but if you get stuck, check out the [solution code on the `solution` branch](https://github.com/Unboxed-Software/react-native-fake-solana-wallet/tree/solution).

## Completed the lab?

Push your changes to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5a3d0f62-c5fc-4e03-b8a3-323c2c7b8f4f)!
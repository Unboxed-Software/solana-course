---
title: Advance Solana Mobile
objectives:
- Create Solana dApps with Expo
- Learn how to integrate different Solana ecosystems
---

# TL;DR

- …
- …
- …

# Overview

Solana has a future in mobile; artwork, games and deFi are all on the horizon. However to get there, we'll need to integrate with the popular frameworks people use to create amazing apps. In the first and second lesson we used vanilla React Native. Today we are going to build atop of them by looking at [React Native Expo](https://docs.expo.dev/tutorial/introduction/). 

## React Native Expo

Expo is an open source collection of tools and libraries that wrap around React Native, much like Create-React-App vs Next.js. 

Expo contains three main parts: `expo-cli`, the Expo Go App, and great device libraries.

The `expo-cli` is a build and debugging tool that helps make all of the magic happen. Chances are, you'll only have to interact with it when you're building or starting a development server. It just works.

The [Expo Go App](https://expo.dev/client) is a really cool piece of tech that allows *most* apps to be developed without using an emulator or physical devices. You download the app, you scan the QR from the build output and then you have a working dev environment right on your phone. Unfortunately, this will not work with the solana mobile SDK. Coming from the [Solana Expo setup article](https://docs.solanamobile.com/react-native/expo):

>The traditional Expo Go development flow is only limited to certain hand-picked modules and does not support further customized native code, which Solana Mobile SDKs need.
>Instead, we'll need to use a custom development build which makes Solana Mobile React Native libraries (i.e Mobile Wallet Adapter) fully compatible with Expo.

Lastly, and most importantly, Expo does an amazing job providing easy to use libraries that give you access to the device. Camera, battery, speakers - there's an [SDK for that](https://docs.expo.dev/versions/latest/). The libraries are simple to use and the documentation is phenomenal.

## Integrating ecosystems  

As mentioned in the previous section there are some caveats using the Solana Mobile SDK with Expo. This is largely due to the mobile wallet adapter's need for low-level app-to-app communication. Fortunately to get them to play well with each other all we have to do is configure Expo with the correct polyfills.

Polyfills are replacement core libraries for environments that are not running Node.js, which we don't do in Expo. Unfortunately, it can be tough to know which polyfills you need for any given application. Unless you know ahead of time, debugging polyfills means looking at the compiler errors and searching stack overflow. If it doesn't build, it's normally a polyfill problem.

Fortunately, we've compiled a list of polyfills you'll need for not only Expo + Solana, but also Solana + Metaplex + Solana.

### Solana Polyfills

For a solana + Expo app, you'll need the following:
- `@solana-mobile/mobile-wallet-adapter-protocol`: A React Native/Javascript API enabling interaction with MWA-compatible wallets.
- `@solana-mobile/mobile-wallet-adapter-protocol-web3js`: A convenience wrapper to use common primitives from [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) – such as `Transaction` and `Uint8Array`.
- `@solana/web3.js`: Solana Web Library for interacting with Solana network through the [JSON RPC API](https://docs.solana.com/api/http).
- `react-native-get-random-values`: Secure random number generator polyfill for `web3.js` underlying Crypto library on React Native.
- `buffer`: Buffer polyfill needed for `web3.js` on React Native.

### Metaplex Polyfills

If you want to use the Metaplex SDK, you'll need some additional:

- `@metaplex-foundation/js@0.19.4` - Metaplex Library
- Several more polyfills
  - `assert`
  - `util`
  - `crypto-browserify`
  - `stream-browserify`
  - `readable-stream`
  - `browserify-zlib`
  - `path-browserify`
  - `react-native-url-polyfill`

Additionally, for Metaplex, you'll need to register the polyfills using a `metro.config.js`. Below is the config used in the Lab:

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

### Putting it all together

The good news is that once you have the application compiling and running, there are very little differences between creating a web dApp and a mobile dApp.

# Lab

Today we're building the Mint-A-Day app, where users will able to mint a single NFT snapshot of their lives daily, creating a permanent diary of sorts.

We'll be building this with React Native and Expo. Expo is a set of tools built around React Native that will make our lives easier when dealing with device-related packages. This is a good thing since we'll need to use the the camera. 

To mint the NFTs we'll be using Metaplex's Javascript SDK along with [nft.storage](https://nft.storage/) to store images and metadata. All of our on-chain work will be on Devnet.

The first half of this lab is cobbling together the needed components to make Expo, Solana and Metaplex all work together. We'll do this modularly so you'll know what aspects of the boilerplate align with which section.

## 1. Expo setup

In this first section we will simply get a typescript Expo app running on an emulator. We are assuming you already have a React Native dev environment setup complete with an emulator of physical device. If you do not, follow step 0.

### 0. Setup React Native dev environment

You'll need React Native installed on your machine as well as a running emulator or physical device. [You can accomplish this all with the React Native quickstart](https://reactnative.dev/docs/environment-setup?guide=native). 

>Note: Even though we are using Expo, you'll need to follow the react native cli guide.
>Note: If you are running an emulator, it is highly recommend to use a newer phone version to emulate along with providing several GB of RAM for it to run. We use 5GB of ram on our side. 

### 1. Sign up for Expo EAS CLI

To simplify the Expo process, you'll want an Expo Application Services (EAS) account. This will help you build and run the application. 

First sign up for an [EAS account](https://expo.dev/).

Then, install the `eas-cli` and log in:

```bash
npm install --global eas-cli
eas login
```

### 2. Create the app scaffold

Since the `@solana-mobile/mobile-wallet-adapter-protocol` package includes native code, we need to make some minor modifications to the traditional Expo build command. We'll be using a [method described in the Solana mobile docs](https://docs.solanamobile.com/react-native/expo#running-the-app) to do this.

First, we'll build the app, and then separately run our development client. You can do this locally or use an Expo account to have them build it for you. We will be using the local option. Feel free to [follow Solana Mobile’s guide](https://docs.solanamobile.com/react-native/expo#local-vs-eas-builds) if you want to have Expo build the app for you.

Let’s create our app with the following:
`npx create-expo-app -t expo-template-blank-typescript solana-expo`

This uses `create-expo-app` to generate a new scaffold for us based on the `expo-template-blank-typescript` template. This is just an empty Typescript React Native app.

### 3. Local build config

Since we're building locally, we'll need to add an additional config file that let's the compiler know what we're doing. Create a file called `eas.json` in the root of your directory.
```bash
touch eas.json
```

Copy and paste the following into the newly created `eas.json`:
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

### 4. Build and emulate

Now let's build the project. You will choose `y` for every answer. This will take a while to complete.

```bash
npx eas build --profile development --platform android --local
```

When it is done, you will get an output file at the root of your directory. This file will have a naming format of `build-XXXXXXXXXXX.apk`. Locate this file in your file explorer and ***drag it*** into your emulator. A message should show on the emulator saying that it is installing the new APK. When it finishes installing, you should see the APK as an app icon in the emulator.

The app that was installed is just a scaffold app from Expo. The last thing you'll need to do is run the following command to build and deploy on your emulator:

```bash
npx expo start --dev-client --android
```

This should open and run the app in your Android emulator.

***NOTE*** Every time you add in new dependencies, you'll have to build and re-install the app. Anything visual or logic-based should be captured by the hot-reloader.

## 2. Solana Expo setup

Let's setup the basic Solana dependancies and get them to compile nicely with Expo. To do this, we'll first need a Solana wallet, and install some dependancies. If you already have a devnet-enabled wallet installed you can skip step 0.

### 0. Install a Devnet-enabled Solana wallet

You'll need a wallet that supports Devnet to test with. In [lesson 2](./TODO) we created one of these, let's install it from the solution branch.

```bash
git clone https://github.com/Unboxed-Software/react-native-fake-solana-wallet
cd react-native-fake-solana-wallet
git checkout solution
npm i
npm run install
```

The wallet should be installed on your emulator or device. Make sure to open the newly installed wallet and airdrop yourself some SOL.

### 1. Install Solana dependancies

We are going to install some basic Solana dependencies that are likely to be needed by all Solana mobile apps. This will include some polyfills that allow otherwise incompatible packages to work with React native. If you're not familiar with polyfills, take a look at the [MDN docs](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill). In short, polyfills actively replace Node-native libraries to make them work anywhere Node is not running.

Basic Solana dependencies include the following:

- `@solana-mobile/mobile-wallet-adapter-protocol`: A React Native/Javascript API enabling interaction with MWA-compatible wallets.
- `@solana-mobile/mobile-wallet-adapter-protocol-web3js`: A convenience wrapper to use common primitives from [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) – such as `Transaction` and `Uint8Array`.
- `@solana/web3.js`: Solana Web Library for interacting with Solana network through the [JSON RPC API](https://docs.solana.com/api/http).
- `react-native-get-random-values`: Secure random number generator polyfill for `web3.js` underlying Crypto library on React Native.
- `buffer`: Buffer polyfill needed for `web3.js` on React Native.

Make sure you install all of the above. You can do this with the following command:
```bash
npm install \
  @solana/web3.js \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \
  react-native-get-random-values \
  buffer
```

### 3. Add Solana boilerplate providers

Now we are going to add some Solana boilerplate that can springboard you into most Solana-based apps.

Create two new folders `components` and `screens`.

We are going to use some boilerplate code from the [first Mobile lesson](todo), we will be copying over `components/AuthProvider.tsx` and `components/ConnectionProvider/tsx`. All these files do is provide us with a `Connection` object as well as some helper functions authorizing our dapp.


Create file `components/AuthProvider.tsx` and copy into it the [raw contents](https://github.com/Unboxed-Software/solana-advance-mobile/blob/main/components/AuthProvider.tsx) from github.

Secondly, create file `components/ConnectionProvider.tsx` and copy the [raw contents](https://github.com/Unboxed-Software/solana-advance-mobile/blob/main/components/ConnectionProvider.tsx) from github.


Now let's create a boilerplate for our main screen in `screens/MainScreen.tsx`:
```tsx
import {View, Text} from 'react-native';
import React from 'react';

export function MainScreen() {
  return (
    <View>
      <Text>Solana Expo App</Text>
    </View>
  );
}
```

Finally, let's change `App.tsx` to wrap our application our needed providers to complete our boilerplate application.

Change `App.tsx`:
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
  // const cluster = "localhost" as any;
  // const endpoint = 'http://10.0.2.2:8899';
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

Notice we've added two polyfills above `'buffer'` and `'react-native-get-random-values'`, these are needed for the Solana dependancies to run correctly!

### 2. Build and run Solana boilerplate

Let's make sure everything is working and compiling correctly. In Expo, anytime you change the depecnacies, you'll need to rebuild and re-install the app.

***Optional:*** To avoid possible build version conflicts, you may want to *uninstall* the previous version before you drag and drop the new one in.

Build:
```bash
npx eas build --profile development --platform android --local
```
Install:
***Drag*** the resulting build file into your emulator. 

Run:
```bash
npx expo start --dev-client --android
```

Everything should compile and you should have a boilerplate Solana Expo app.

## 4. Metaplex setup

Metaplex is your one-stop-shop for all of you NFT API needs. However, it requires a little more setup. Good news is, if you ever want to fetch, mint or edit NFTs, you'll have another boilerplate to start from.

### 1. Install Metaplex dependancies

The Metaplex SDK abstracts away a lot of the minutia of working with NFTs, however it was written largely for Node.js, so we'll need several more polyfills to make it work. 

Here are all of the additional packages we'll need:
- `@metaplex-foundation/js`: Allows us to easily create and fetch NFTs. At the time of writing, you need to use version 0.19.x for everything to work properly.
- Various polyfills that are needed to make the Metaplex package work, including:
  - `assert`
  - `util`
  - `crypto-browserify`
  - `stream-browserify`
  - `readable-stream`
  - `browserify-zlib`
  - `path-browserify`
  - `react-native-url-polyfill`

Be sure to install them using the following command:
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

### 2. Polyfill config

Since we've added more polyfills we need to tell Metro to resolve them into the build. We do that in a new file `metro.config.js`:
```bash
touch metro.config.js
```

Copy and paste the following into `metro.config.js`:
```js
/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 * @format
 */

// Import the default Expo Metro config
const { getDefaultConfig } = require('@expo/metro-config');

// Get the default Expo Metro configuration
const defaultConfig = getDefaultConfig(__dirname);

// Customize the configuration to include your extra node modules
defaultConfig.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  url: require.resolve('react-native-url-polyfill'),
  zlib: require.resolve('browserify-zlib'),
  path: require.resolve('path-browserify'),
};

// Export the modified configuration
module.exports = defaultConfig;
```

### 3. Metaplex provider

We're going to create a Metaplex provider file that will help us access a `Metaplex` object. This `Metaplex` object is what gives us access to all of the functions we'll need like `fetch` and `create`. To do this we create a new file `/components/MetaplexProvider.tsx`. Here we plum our mobile wallet adapter into an `IdentitySigner` for the `Metaplex` object to use. This allows it to call several function on our behalf.

Create `/components/MetaplexProvider.tsx`:
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

const useMetaplex = (
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

export default useMetaplex;
```

### 4. NFT Provider

We're also making a higher-level NFT provider that helps with NFT state management. It combines all three of our previous providers: `ConnectionProvider`, `AuthProvider` and `MetaplexProvider` to allow us our `Metaplex` object. We will fill this out in a later step, for now, it makes for a good boilerplate.

Let's create the new file `components/NFTProvider.tsx`
```tsx
import "react-native-url-polyfill/auto";
import { useConnection } from "./ConnectionProvider";
import { Account, useAuthorization } from "./AuthProvider";
import React, { ReactNode, createContext, useContext } from "react";

export interface NFTProviderProps {
  children: ReactNode;
}

export interface NFTContextState {}

const DEFAULT_NFT_CONTEXT_STATE: NFTContextState = {};

const NFTContext = createContext<NFTContextState>(DEFAULT_NFT_CONTEXT_STATE);

export function NFTProvider(props: NFTProviderProps) {
  const { children } = props;

  // Used to 
  const { connection } = useConnection();
  const { authorizeSession } = useAuthorization();
  const [account, setAccount] = useState<Account | null>(null);
  const { metaplex } = useMetaplex(connection, account, authorizeSession);
 
  const state = {};

  return <NFTContext.Provider value={state}>{children}</NFTContext.Provider>;
}

export const useNFT = (): NFTContextState => useContext(NFTContext);
```

Notice we've added yet another polyfill to the top `import "react-native-url-polyfill/auto";`

### 5. Wrap provider

Now, let's wrap our new `NFTProvder` just above out `MainScreen` in `App.tsx`.
```tsx
import 'react-native-get-random-values';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { ConnectionProvider } from './components/ConnectionProvider';
import { AuthorizationProvider } from './components/AuthProvider';
import { clusterApiUrl } from '@solana/web3.js';
import { MainScreen } from './screens/MainScreen';
import { NFTProvider } from './components/NFTProvider';
global.Buffer = require('buffer').Buffer;

export default function App() {
  // const cluster = "localhost" as any;
  // const endpoint = 'http://10.0.2.2:8899';
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

### 6. Build and run

To finish up our Expo-Solana-Metaplex boilerplate, lets build and re-install the app.

Build:
```bash
npx eas build --profile development --platform android --local
```
Install:
***Drag*** the resulting build file into your emulator. 

Run:
```bash
npx expo start --dev-client --android
```

## 5. Mint-A-Day specific setup

The boilerplate seciton is over, now we need to do some app-specific setup. Mint-A-day is a daily snapshot-minting app, allowing you to mint a snapshot of your life Daily. For this we will need access to the devices camera and a place to upload our images too. Fortunately, Expo handles the camera and (NFT.Storage)[https://nft.storage] will store your NFT files for free.

### 1. Camera setup

Now we are going to setup the Expo-specific dependency we'll be using. One of the primary reasons we're using Expo is that it provides convenient interfaces for utilizing the phone's hardware. We'll be using Expo's image picker API. This lets us use the device's camera to take pictures that we'll subsequently turn into NFTs.

Install the dependency now using the following command:

```bash
npx expo install expo-image-picker
```

Next, configure the new plugin in `app.json`:
```json
  "expo": {
    // ....
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "Allows you to use images to create solana NFTs"
        }
      ]
    ],
    // ....
  }
```

This particular dependency makes it super simple to use the camera. To allow the user to take a picture and return the image all you have to do is call the following:

```tsx
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
```

### 2. NFT.Storage setup

The last piece of setup is grabbing a [nft.storage](https://nft.storage) API key, putting it in a `.env` and adding one more dependency that is going to help us convert an image to an uploadable type.

We'll be using NFT.storage to host our NFTs with IPFS since they do this for free. [Sign up, and create an API key](https://nft.storage/manage/). Keep this API key private. Let's put this in a `.env` file.

Best practices suggest keeping them in a `.env` file with `.env` added to your `.gitignore`. It's also a good idea to create a `.env.example` file that can be committed to your repo and shows what environment variables are needed for the project.

Create both files, in the root of your directory and add `.env` to your `.gitignore` file.

Then, add your API key to the `.env` file with the name `EXPO_PUBLIC_NFT_STORAGE_API`. Now you'll be able to access your API key safely in the application. 

Lastly, we have one more dependant to add: `rn-fetch-blob`. This helps us grab images from the devices URI scheme and turn them into Blobs we can the upload to [NFT.storage](https://nft.storage).

Install it with the following:
```bash
npm i rn-fetch-blob
```

### 3. Final build

Build and reinstall if you want to make sure it's all working. This is the last time we'll have to do this for this lab, everything else should be hot-loadable.

Build:
```bash
npx eas build --profile development --platform android --local
```
Install:
***Drag*** the resulting build file into your emulator. 

Run:
```bash
npx expo start --dev-client --android
```

## 5. Build Mint-A-Day

We're through the setup! Let's create the Mint-A-Dat app. Fortunately, there are only two files we have to focus on now: 

- `NFTProvider.tsx` will largely manage our app state and NFT data.
- `MainScreen.tsx` will capture input and show 

The app itself is pretty simple the general flow is as following:

1. The user connects ( authorizes ) using the `transact` function and calling `authorizeSession`.
2. Using the `Metaplex` object, we'll fetch all of the NFTs created by the user
3. If a NFT has not been created for the current day, take a picture, upload it, and mint it.

### 1. NFT Provider

`NFTProvider.tsx` will control the state with our custom `NFTProviderContext` which contains the following fields:

`metaplex?: Metaplex | null` - Holds the metaplex object that we use to call `fetch` and `create` on.
`publicKey?: PublicKey | null` - 


```tsx
export interface NFTContextState {
  metaplex?: Metaplex | null; // Holds the metaplex object that we use to call `fetch` and `create` on.
  publicKey?: PublicKey | null; // The public key of the authorized wallet
  isLoading: boolean; // Loading state
  loadedNFTs?: (Nft | Sft | SftWithToken | NftWithToken)[] | null; // Array of loaded NFTs that contain metadata
  nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null; // The NFT snapshot created on the current day
  connect: () => void; // Connects (and authorizes) us to the Devnet-enabled wallet
  fetchNFTs: () => void; // Fetches the NFTs using the `metaplex` object
  createNFT: (name: string, description: string, fileUri: string) => void; // Creates the NFT
}
```

The state flow here is: `connect`, `fetchNFTs` and then `createNFT`.

1. `connect` - this will connect and authorize the app, and then store the resulting `publicKey` into the state.

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

2. `fetchNFTs` - will fetch the NFTs using the following snippet:
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
  ```


3. `createNFT` - will upload a file to NFT.Storage, and then use Metaplex to create and mint an NFT to your wallet. This comes in three parts, uploading the image, uploading the metadata and then minting the NFT.

To upload to NFT.Storage you just make a POST with your API key and the image/metadata as the body.

Uploading:
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

To mint the actual NFT, it's as simple as calling `metaplex.nfts().create(...)`

Minting NFT:
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


Change `NFTProvider.tsx` to the following:
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
import useMetaplex from "./MetaplexProvider";


export interface NFTProviderProps {
  children: ReactNode;
}

export interface NFTContextState {
  metaplex?: Metaplex | null;
  publicKey?: PublicKey | null;
  isLoading: boolean;
  loadedNFTs?: (Nft | Sft | SftWithToken | NftWithToken)[] | null;
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

  const publicKey = account?.publicKey;

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

### 2. Main Screen

Our main screen is consist of three parts: The image of the day, our action button, and the carousel of previous snapshots.

The image of the day is displayed on the top half of the app, the action button right under it, under that is our carousel.

The action button follows the state of our `NFTProvider`, first `connect` then `fetchNFTs` and finally `mintNFT`. Of these, we only need to do some extra work for `mintNFT`.

The `mintNFT` function uses the Expo library to open up the camera with `ImagePicker.launchCameraAsync`. When an image is taken, it's local path is returned. The last thing we need to do is specify when the image was taken so we'll actually make the name of the NFT the date in `MM.DD.YY` format and store the unix timestamp is the description. Then we pass the image path, name and description to our `createNFT` function from `NFTProvider` to mint!

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

The full code for `MainScreen.tsx` is as follows:
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

Now it's time to create our first snapshot! First, open up your Devnet-enabled wallet and make sure you have some SOL. Next, tap on `Connect Wallet` and approve the app. Fetch all of the NFTs by tapping `Fetch NFTs`. Lastly, tap `Create Snapshot` to upload and mint.

# Challenge

Now it's your turn. How could you put your own spin on the app? Maybe you'd want to add a text field so you can treat NFT like a journal entry. The possibilities are endless!


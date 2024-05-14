---
title: Building Solana Mobile dApps with Expo
objectives:
- Create Solana dApps with Expo
- Use mobile-specific peripherals and capabilities
- Integrate ecosystem libraries into your mobile dApps
---

# Summary

- Expo is an open-source collection of tools and libraries that wrap around React Native, much like Next.js is a framework built on top of React.
- In addition to simplifying the build/deploy process, Expo provides packages that give you access to mobile devices' peripherals and capabilities
- A lot of Solana ecosystem libraries don't support React native out of the box, but you can typically use them with the right [polyfills](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill)

# Lesson

So far in exploring Solana Mobile, we've used vanilla React Native to build very simple mobile dApps. Just like many web developers opt to use frameworks built on top of React, like Next.js, many React Native developers opt to use frameworks and tooling that simplify the React Native development, testing, and deployment process. The most common of these is [React Native Expo](https://docs.expo.dev/tutorial/introduction/).

This lesson will explore two primary topics:
1. How to use React Native Expo to streamline React Native development
2. How to integrate JS/TS libraries from the Solana ecosystem that don't explicitly support React Native (e.g. Metaplex)

These topics are best explored in a hands-on manner, so the majority of this lesson will be spent in the lab.

## React Native Expo

Expo is an open-source collection of tools and libraries that wrap around React Native, much like Next.js is a framework built on top of React.

Expo consists of three main parts:
1. Expo CLI
2. The Expo Go App
3. A suite of libraries that grant access to various mobile device capabilities.

The Expo CLI is a build and debugging tool that helps make all of the magic happen. Chances are, you'll only have to interact with it when you're building or starting a development server. It just works.

The [Expo Go App](https://expo.dev/client) is a really cool piece of tech that allows *most* apps to be developed without using an emulator or physical device. You download the app, you scan the QR from the build output and then you have a working dev environment right on your phone. Unfortunately, this will not work with the Solana mobile SDK. Coming from the [Solana Expo setup article](https://docs.solanamobile.com/react-native/expo):

> The traditional Expo Go development flow is only limited to certain hand-picked modules and does not support further customized native code, which Solana Mobile SDKs need.
> Instead, we'll need to use a custom development build which makes Solana Mobile React Native libraries (i.e Mobile Wallet Adapter) fully compatible with Expo.

Lastly, and most importantly, Expo does an amazing job providing [easy-to-use libraries](https://docs.expo.dev/versions/latest/) that give you access to the device's onboard peripherals, such as camera, battery, and speakers. The libraries are intuitive and the documentation is phenomenal.

### How to create an Expo app

To get started with Expo, you first need the prerequisite setup described in the [Introduction to Solana Mobile lesson](./basic-solana-mobile.md#0-prerequisites). After that, you'll want to sign up for an [Expo Application Services (EAS) account](https://expo.dev/).

Once you have an EAS account, you can install the EAS CLI and log in:

```bash
npm install --global eas-cli
eas login
```

Finally, you can scaffold a new Expo app using the `create-expo-app` command:
```bash
npx create-expo-app
```

### How to build and run an Expo app

For some apps, Expo makes building really easy with the Expo Go App. The Expo Go App builds the project on a remote server and deploys to whatever emulator or device you specify.

Unfortunately, that won't work with Solana Mobile applications. Instead, you'll need to build locally. To do that, you need an additional configuration file, `eas.json`, specifying that the project distribution is "internal." You'll need the following inside this file:

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

With the EAS config file created, you can build using the `npx eas build --local` command plus relevant flags for any additional requirements. For example, the following will build the project locally with a development profile specifically for Android:

```bash
npx eas build --profile development --platform android --local
```

You then need to install the output APK to your device or emulator. If you're using an emulator, this is as simple as dragging the APK file onto the emulator window. If you're using a physical device, you'll have to use Android Debug Bridge (ADB):

```bash
adb install your-apk-file.apk
```

The installed APK is a scaffold app from Expo that facilitates a number of things, including running your app. To load your application inside of it, you need to start the development server:

```bash
npx expo start --dev-client --android
```

### How to add Expo SDK packages to your app

The Expo SDK contains packages to simplify all kinds of things related to React Native development, from UI elements to using device peripherals. You can see all of the packages on the [Expo SDK docs](https://docs.expo.dev/versions/latest/).

As an example, you would add [pedometer functionality](https://docs.expo.dev/versions/latest/sdk/pedometer/) to your app by installing the `expo-sensors` package:

```bash
npx expo install expo-sensors
```

Then you can import it in your code as you would normally expect when using JS/TS.

```tsx
import { Pedometer } from 'expo-sensors'
```

Depending on the package, there may be additional setup required. Be sure to read the [docs](https://docs.expo.dev/versions/latest/) when working with a new package.

## Integrate ecosystem libraries into your Expo app

Not all React and Node libraries work with React Native out of the box. You either need to find libraries that are specifically created to work with React Native or create a workaround yourself.

When working with Solana specifically, the vast majority of ecosystem libraries do not support React Native out of the box. Fortunately, to get them to play well in a React Native environment, all we have to do is configure Expo with the correct [polyfills](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill).

Polyfills are replacement core libraries for environments that are not running Node.js. Expo does not run Node.js. Unfortunately, it can be tough to know which polyfills you need for any given application. Unless you know ahead of time, debugging polyfills means looking at the compiler errors and searching stack overflow. If it doesn't build, it's normally a polyfill problem.

Fortunately, we've compiled a list of polyfills you'll need for not only some of the standard Solana libraries but also for Metaplex.

### Solana Polyfills

For a Solana + Expo app, you'll need the following:
- `@solana-mobile/mobile-wallet-adapter-protocol`: A React Native/Javascript API enabling interaction with MWA-compatible wallets.
- `@solana-mobile/mobile-wallet-adapter-protocol-web3js`: A convenience wrapper to use common primitives from [@solana/web3.js](https://github.com/solana-labs/solana-web3.js) – such as `Transaction` and `Uint8Array`.
- `@solana/web3.js`: Solana Web Library for interacting with the Solana network through the [JSON RPC API](https://docs.solana.com/api/http).
- `react-native-get-random-values`: Secure random number generator polyfill for `web3.js` underlying Crypto library on React Native.
- `buffer`: Buffer polyfill needed for `web3.js` on React Native.

### Metaplex Polyfills

If you want to use the Metaplex SDK, you'll need to add the Metaplex library plus a few additional polyfills:

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

All of the libraries that the above polyfills are meant to replace are utilized by the Metaplex library in the background. It's unlikely you'll be importing any of them into your code directly. Because of this, you'll need to register the polyfills using a `metro.config.js` file. This will ensure that Metaplex uses the polyfills instead of the usual Node.js libraries that aren't supported in React Native. Below is an example `metro.config.js` file:

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

## Putting it all together

As with most new tools or frameworks, initial setup can be challenging. The good news is that once you have the application compiling and running, there are very few differences in the code you write for a web vs mobile app, and there are virtually no differences when comparing the code you write for a React Native vs Expo app.

# Lab

Let's practice this together by building the Mint-A-Day app, where users will able to mint a single NFT snapshot of their lives daily, creating a permanent diary of sorts.

To mint the NFTs we'll be using Metaplex's Javascript SDK along with [nft.storage](https://nft.storage/) to store images and metadata. All of our onchain work will be on Devnet.

The first half of this lab is cobbling together the needed components to make Expo, Solana, and Metaplex all work together. We'll do this modularly so you'll know what aspects of the boilerplate align with which section.

## 1. Scaffold, build, and run a local Expo app

In this first section, we will simply get a typescript Expo app running on an emulator. If you already have a React Native dev environment set up, skip step 0.

### 0. Set up React Native dev environment

You'll need React Native installed on your machine as well as a running emulator or physical device. [You can accomplish this all with the React Native quickstart](https://reactnative.dev/docs/environment-setup?guide=native). There are also more details about this setup in the [Introduction to Solana Mobile lesson](./basic-solana-mobile.md#0-prerequisites)

> Note: Even though we are using Expo, you'll need to follow the React Native cli guide for initial setup.
> Note: If you are running an emulator, it is highly recommend to use a newer phone version to emulate along with providing several GB of RAM for it to run. We use 5GB of ram on our side. 

### 1. Sign up for Expo EAS CLI

To simplify the Expo process, you'll want an Expo Application Services (EAS) account. This will help you build and run the application. 

First sign up for an [EAS account](https://expo.dev/).

Then, install the EAS CLI and log in:

```bash
npm install --global eas-cli
eas login
```

### 2. Create the app scaffold

Let’s create our app with the following:

```bash
npx create-expo-app -t expo-template-blank-typescript solana-expo
cd solana-expo
```

This uses `create-expo-app` to generate a new scaffold for us based on the `expo-template-blank-typescript` template. This is just an empty Typescript React Native app.

### 3. Local build config

Expo defaults to building on a remote server but we need to build locally for Solana Mobile to work correctly. We'll need to add an new config file that lets the compiler know what we're doing. Create a file called `eas.json` in the root of your directory.

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

When the command is done, you will get an output file at the root of your directory. This file will have a naming format of `build-XXXXXXXXXXX.apk`. Locate this file in your file explorer and ***drag it*** into your emulator. A message should show on the emulator saying that it is installing the new APK. When it finishes installing, you should see the APK as an app icon in the emulator.

The app that was installed is just a scaffold app from Expo. The last thing you'll need to do is run the following command to run the development server:

```bash
npx expo start --dev-client --android
```

This should open and run the app in your Android emulator.

***NOTE*** Every time you add in new dependencies, you'll have to build and re-install the app. Anything visual or logic-based should be captured by the hot-reloader.

## 2. Configure your Expo app to work with Solana

Now that we have an Expo app up and running, we need to add our Solana dependencies, including installing a wallet we can use in the emulator. If you already have a Devnet-enabled wallet installed you can skip step 0.

### 0. Install a Devnet-enabled Solana wallet

You'll need a wallet that supports Devnet to test with. In [our Mobile Wallet Adapter lesson](./mwa-deep-dive) we created one of these. Let's install it from the solution branch in a different directory from our app:

```bash
cd ..
git clone https://github.com/Unboxed-Software/react-native-fake-solana-wallet
cd react-native-fake-solana-wallet
git checkout solution
npm run install
```

The wallet should be installed on your emulator or device. Make sure to open the newly installed wallet and airdrop yourself some SOL.

Make sure to return to the wallet directory as we'll be working there the rest of the lab.

```bash
cd ..
cd solana-expo
```

### 1. Install Solana dependencies

We are going to install some basic Solana dependencies that are likely to be needed by all Solana mobile apps. This will include some polyfills that allow otherwise incompatible packages to work with React native:

```bash
npm install \
  @solana/web3.js \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \
  react-native-get-random-values \
  buffer
```

### 3. Add Solana boilerplate providers

Next, let's add some Solana boilerplate that can springboard you into most Solana-based apps.

Create two new folders: `components` and `screens`.

We are going to use some boilerplate code from the [first Mobile lesson](./basic-solana-mobile). We will be copying over `components/AuthProvider.tsx` and `components/ConnectionProvider.tsx`. These files provide us with a `Connection` object as well as some helper functions that authorize our dapp.


Create file `components/AuthProvider.tsx` and copy the contents [of our existing Auth Provider from Github](https://raw.githubusercontent.com/Unboxed-Software/solana-advance-mobile/main/components/AuthProvider.tsx) into the new file.

Secondly, create file `components/ConnectionProvider.tsx` and copy the contents [of our existing Connection Provider from Github](https://raw.githubusercontent.com/Unboxed-Software/solana-advance-mobile/main/components/ConnectionProvider.tsx) into the new file.

Now let's create a boilerplate for our main screen in `screens/MainScreen.tsx`:
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

Finally, let's change `App.tsx` to wrap our application in the two providers we just created:

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

Notice we've added two polyfills above: `buffer` and `react-native-get-random-values`. These are necessary for the Solana dependencies to run correctly.

### 4. Build and run Solana boilerplate

Let's make sure everything is working and compiling correctly. In Expo, anytime you change the dependencies, you'll need to rebuild and re-install the app.

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

## 3. Configure your Expo app to work with Metaplex

Metaplex is your one-stop-shop for all of your NFT API needs. However, it requires a little more setup. The good news is if you ever want to fetch, mint or edit NFTs in your future apps, you'll have another boilerplate to here that you can reference.

### 1. Install Metaplex dependencies

The Metaplex SDK abstracts away a lot of the minutia of working with NFTs, however it was written largely for Node.js, so we'll need several more polyfills to make it work:
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

We won't be importing any of the above polyfills in our code directly, so we need to add them to a `metro.config.js` file to ensure that Metaplex uses them:

```bash
touch metro.config.js
```

Copy and paste the following into `metro.config.js`:
```js
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

We're going to create a Metaplex provider file that will help us access a `Metaplex` object. This `Metaplex` object is what gives us access to all of the functions we'll need like `fetch` and `create`. To do this we create a new file `/components/MetaplexProvider.tsx`. Here we pipe our mobile wallet adapter into an `IdentitySigner` for the `Metaplex` object to use. This allows it to call several privileged functions on our behalf:

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

### 4. NFT Provider

We're also making a higher-level NFT provider that helps with NFT state management. It combines all three of our previous providers: `ConnectionProvider`, `AuthProvider` and `MetaplexProvider` to allow us to create our `Metaplex` object. We will fill this out in a later step, for now, it makes for a good boilerplate.

Let's create the new file `components/NFTProvider.tsx`:
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

Notice we've added yet another polyfill to the top `import "react-native-url-polyfill/auto";`

### 5. Wrap provider

Now, let's wrap our new `NFTProvider` around `MainScreen` in `App.tsx`:

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

### 6. Build and run

Lastly, let's build and re-install the app to make sure things are still working.

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

## 4. Configure your Expo app to take and upload photos

Everything we've done to this point is effectively boilerplate we needed to start adding the functionality we intend our Mint-A-Day app to have. Mint-A-day is a daily snapshot app. It lets users take a snapshot of their life daily in the form of minting an NFT.

The app will need access to the device's camera and a place to remotely store the captured images. Fortunately, Expo SDK can provide access to the camera and (NFT.Storage)[https://nft.storage] can store your NFT files for free.

### 1. Camera setup

Let's start by setting up the Expo-specific dependency we'll be using: `expo-image-picker`. This lets us use the device's camera to take pictures that we'll subsequently turn into NFTs. We're specifically using the image picker rather than the camera since emulators don't have cameras. This package will simulate a camera for us in the emulator. Install it with the following command:

```bash
npx expo install expo-image-picker
```

In addition to installation, the `expo-image-picker` package needs to be added as a plugin in `app.json`:

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

No need to add this anywhere yet - we'll get to it in a few steps.

### 2. NFT.Storage setup

The last thing we need to do is set up our access to [nft.storage](https://nft.storage). We'll need to get an API key and add it as an environment variable, then we need to add one last dependency to convert our images into a file type we can upload.

We'll be using NFT.storage to host our NFTs with IPFS since they do this for free. [Sign up, and create an API key](https://nft.storage/manage/). Keep this API key private.

Best practices suggest keeping API keys in a `.env` file with `.env` added to your `.gitignore`. It's also a good idea to create a `.env.example` file that can be committed to your repo and shows what environment variables are needed for the project.

Create both files, in the root of your directory and add `.env` to your `.gitignore` file.

Then, add your API key to the `.env` file with the name `EXPO_PUBLIC_NFT_STORAGE_API`. Now you'll be able to access your API key safely in the application. 

Lastly, install `rn-fetch-blob`. This package will help us grab images from the device's URI scheme and turn them into Blobs we can the upload to [NFT.storage](https://nft.storage).

Install it with the following:
```bash
npm i rn-fetch-blob
```

### 3. Final build

Build and reinstall if you want to make sure it's all working. This is the last time we'll have to do this for this lab. Everything else should be hot-loadable.

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

## 5. Add functionality to complete your Expo app

We're through the setup! Let's create the actual functionality for our Mint-A-Day app. Fortunately, there are only two files we have to focus on now: 

- `NFTProvider.tsx` will largely manage our app state and NFT data.
- `MainScreen.tsx` will capture input and show our NFTs

The app itself is relatively straightforward. The general flow is:

1. The user connects (authorizes) using the `transact` function and by calling `authorizeSession` inside the callback
2. Our code then uses the `Metaplex` object to fetch all of the NFTs created by the user
3. If an NFT has not been created for the current day, allow the user to take a picture, upload it, and mint it as an NFT

### 1. NFT Provider

`NFTProvider.tsx` will control the state with our custom `NFTProviderContext`. This should have the following fields:

- `metaplex: Metaplex | null` - Holds the metaplex object that we use to call `fetch` and `create`
- `publicKey: PublicKey | null` - The NFT creator's public key
- `isLoading: boolean` - Manages loading state
- `loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null` - An array of the user's snapshot NFTs
- `nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null` - A reference to the NFT created today
- `connect: () => void` - A function for connecting to the Devnet-enabled wallet
- `fetchNFTs: () => void` - A function that fetches the user's snapshot NFTs
- `createNFT: (name: string, description: string, fileUri: string) => void` - A function that creates a new snapshot NFT


```tsx
export interface NFTContextState {
  metaplex: Metaplex | null; // Holds the metaplex object that we use to call `fetch` and `create` on.
  publicKey: PublicKey | null; // The public key of the authorized wallet
  isLoading: boolean; // Loading state
  loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null; // Array of loaded NFTs that contain metadata
  nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null; // The NFT snapshot created on the current day
  connect: () => void; // Connects (and authorizes) us to the Devnet-enabled wallet
  fetchNFTs: () => void; // Fetches the NFTs using the `metaplex` object
  createNFT: (name: string, description: string, fileUri: string) => void; // Creates the NFT
}
```

The state flow here is: `connect`, `fetchNFTs`, and then `createNFT`. We'll walk through the code for each of them and then show you the entire file at the end:

1. `connect` - This function will connect and authorize the app, and then store the resulting `publicKey` into the state.
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

2. `fetchNFTs` - This function will fetch the NFTs using Metaplex:
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


3. `createNFT` - This function will upload a file to NFT.Storage, and then use Metaplex to create and mint an NFT to your wallet. This comes in three parts, uploading the image, uploading the metadata and then minting the NFT.

    To upload to NFT.Storage you just make a POST with your API key and the image/metadata as the body.

    We'll create two helper functions for uploading the image and metadata separately, then tie them together into a single `createNFT` function:
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

    Minting the NFT after the image and metadata have been uploaded is as simple as calling `metaplex.nfts().create(...)`. Below shows the `createNFT` function tying everything together:
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

We'll put all of the above into the `NFTProvider.tsx` file. All together, this looks as follows:
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

### 2. Main Screen

Our main screen will consist of three parts: The image of the day, our action button, and the carousel of previous snapshots.

The image of the day is displayed on the top half of the app, the action button right under it, and the carousel under that.

The action button follows the state of our `NFTProvider`: first `connect`, then `fetchNFTs`, and finally `mintNFT`. Of these, we only need to do some extra work for `mintNFT`.

The `mintNFT` function uses the Expo library to open up the camera with `ImagePicker.launchCameraAsync`. When an image is taken, it's local path is returned. The last thing we need to do is specify when the image was taken. Then we'll make the name of the NFT the date in `MM.DD.YY` format and store the unix timestamp as the description. Finally, we pass the image path, name and description to our `createNFT` function from `NFTProvider` to mint the NFT.

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

Congratulations! That was not an easy or quick lab. You're doing great if you've made it this far. If you run into any issues, feel free to go back through the lab and/or reference the final solution code on the [`main` branch in Github](https://github.com/Unboxed-Software/solana-advance-mobile).

# Challenge

Now it's your turn. Create your own Expo application from scratch. You're welcome to choose your own, or you can select from the following ideas:

- Instead of a daily image snapshot, create an application that lets users write a journal entry for the day, then mint it as an NFT
- Create a basic NFT viewer app to see all your wonderful JPEGs
- Make a simplified clone of [Stepn](https://stepn.com/) using the pedometer from `expo-sensors`



## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=19cf8d3a-89a0-465e-95da-908cf8f45409)!
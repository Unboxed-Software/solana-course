---
title: 使用 Expo 构建 Solana 移动 dApps
objectives:
- 使用 Expo 创建 Solana dApps
- 使用移动设备特定的外围设备和功能
- 将生态系统库集成到您的移动 dApps 中
---

# 摘要

- Expo 是一个开源的工具和库集合，它包装了 React Native，就像 Next.js 是构建在 React 之上的框架一样。
- 除了简化构建/部署过程外，Expo 还提供了访问移动设备外围设备和功能的包。
- 许多 Solana 生态系统库默认不支持 React Native，但通常可以使用正确的 [polyfill（填充物）](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill) 与之配合使用。

# 课程

目前在探索 Solana Mobile 方面，我们已经使用原始的 React Native 构建了非常简单的移动 dApps。就像许多 Web 开发者选择使用建立在 React 之上的框架（如 Next.js）一样，许多 React Native 开发者选择使用简化 React Native 开发、测试和部署流程的框架和工具。其中最常用的是 [React Native Expo](https://docs.expo.dev/tutorial/introduction/)。

本课程将探讨两个主要主题：
1. 如何使用 React Native Expo 简化 React Native 开发
2. 如何集成 Solana 生态系统中不明确支持 React Native（例如 Metaplex）的 JS/TS 库

这些主题最好以实践方式进行探索，因此本课程的大部分时间将花在实验室中。

## React Native Expo

Expo 是一个开源的工具和库集合，它包装了 React Native，就像 Next.js 是构建在 React 之上的框架一样。

Expo 主要由以下三部分组成：
1. Expo CLI
2. Expo Go App
3. 一套授予访问各种移动设备功能的库

Expo CLI 是一个构建和调试工具，它帮助使所有的魔法发生。很可能，你只会在构建或启动开发服务器时与它交互。它非常好用。

[Expo Go App](https://expo.dev/client) 是一个非常酷的技术，可以让 *大多数* 应用程序在不使用仿真器或物理设备的情况下进行开发。你下载该应用程序，扫描生成的 QR 码，然后在手机上就有一个完全可用的开发环境。不幸的是，这在 Solana 移动 SDK 中将不起作用。根据 [Solana Expo 设置文章](https://docs.solanamobile.com/react-native/expo)：

> 传统的 Expo Go 开发流程仅限于特定的手动挑选的模块，并不支持进一步定制的本地代码，这是 Solana Mobile SDK 需要的。
> 我们需要使用自定义的开发构建，以使 Solana Mobile React Native 库（如 Mobile Wallet Adapter）与 Expo 完全兼容。

最后但并非最不重要的是，Expo 在提供[易于使用的库](https://docs.expo.dev/versions/latest/)方面做得非常出色，让你可以访问设备的内置外围设备，例如相机、电池和扬声器。这些库非常直观，文档也非常出色。

### 如何创建 Expo 应用

要开始使用 Expo，您首先需要在 [Solana 移动入门课程](./basic-solana-mobile.md#0-prerequisites) 中描述的先决条件设置。之后，您需要注册 [Expo Application Services（EAS）账户](https://expo.dev/)。

拥有 EAS 账户后，您可以安装 EAS CLI 并登录：

```bash
npm install --global eas-cli
eas login
```

最后，您可以使用 `create-expo-app` 命令建立一个新的 Expo 应用程序：
```bash
npx create-expo-app
```

### 如何构建和运行 Expo 应用

对于一些应用程序，Expo 可以通过 Expo Go App 构建得非常简单。Expo Go App 在远程服务器上构建项目，并部署到您指定的仿真器或设备上。

不幸的是，这在 Solana Mobile 应用程序中将不起作用。相反，您需要在本地构建。为此，您需要一个额外的配置文件 `eas.json`，指定项目分发方式为 "internal"。您需要在这个文件中添加如下内容：

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

创建了 EAS 配置文件后，您可以使用 `npx eas build --local` 命令加上任何额外要求所需的相关标志进行构建。例如，以下命令将使用针对 Android 的开发配置文件在本地构建项目：

```bash
npx eas build --profile development --platform android --local
```

然后，您需要将输出的 APK 安装到设备或仿真器上。如果您使用的是仿真器，只需要将 APK 文件拖放到仿真器窗口中。如果您使用的是物理设备，您将需要使用 Android Debug Bridge（ADB）：

```bash
adb install your-apk-file.apk
```

安装的 APK 是 Expo 的一个模板应用程序，用于实现许多功能，包括运行您的应用程序。要在其中加载您的应用程序，您需要启动开发服务器：

```bash
npx expo start --dev-client --android
```

### 如何将 Expo SDK 包添加到您的应用程序

Expo SDK 包含简化与 React Native 开发相关的各种事物的包，从 UI 元素到使用设备外围设备。您可以在 [Expo SDK 文档](https://docs.expo.dev/versions/latest/) 上查看所有的包。

例如，您可以通过安装 `expo-sensors` 包将 [计步器功能](https://docs.expo.dev/versions/latest/sdk/pedometer/) 添加到您的应用程序：

```bash
npx expo install expo-sensors
```

然后，您可以像在使用 JS/TS 时一样正常地在代码中导入它。

```tsx
import { Pedometer } from 'expo-sensors'
```

根据包的不同，可能需要进一步的设置。在使用新包时，请务必阅读[文档](https://docs.expo.dev/versions/latest/)。

## 将生态系统库集成到您的 Expo 应用程序中

并非所有 React 和 Node 库都能在 React Native 中开箱即用。您需要找到专门为 React Native 创建的库，或者自行创建一个回避方法。

在特定于 Solana 的工作中，绝大多数生态系统库不支持 React Native 开箱即用。幸运的是，要使它们在 React Native 环境中良好运行，我们需要做的就是使用正确的 [polyfill（填充物）](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill) 配置 Expo。

多项填充是针对未运行Node.js环境的工具的替代核心库。Expo不运行Node.js。不幸的是，要知道任意应用程序所需的多项填充可能会很困难。除非您提前知道，否则调试填充意味着查看编译器错误并搜索堆栈溢出。如果应用程序不能构建，通常是填充问题。

幸运的是，我们已经编制了您需要的多项填充列表，不仅适用于一些标准的Solana库，还适用于Metaplex。

### Solana多项填充

对于Solana + Expo应用程序，您将需要以下内容：
- `@solana-mobile/mobile-wallet-adapter-protocol`：一个React Native/Javascript API，用于与MWA兼容的钱包进行交互。
- `@solana-mobile/mobile-wallet-adapter-protocol-web3js`：一个方便的封装，用于使用来自[@solana/web3.js](https://github.com/solana-labs/solana-web3.js)的常用原语，例如 `Transaction` 和 `Uint8Array`。
- `@solana/web3.js`：Solana网络的Web库，通过[JSON RPC API](https://docs.solana.com/api/http)与Solana网络进行交互。
- `react-native-get-random-values`：`web3.js` 底层Crypto库的安全随机数生成器填充，用于React Native。
- `buffer`：在React Native上为 `web3.js` 需要的Buffer填充。

### Metaplex多项填充

如果您想使用Metaplex SDK，您将需要添加Metaplex库以及一些额外的填充：
- `@metaplex-foundation/js@0.19.4` - Metaplex库
- 还有一些填充
  - `assert`
  - `util`
  - `crypto-browserify`
  - `stream-browserify`
  - `readable-stream`
  - `browserify-zlib`
  - `path-browserify`
  - `react-native-url-polyfill`

上述填充的所有库都是Metaplex库在后台使用的。您不太可能直接导入它们到您的代码中。因此，您需要使用 `metro.config.js` 文件注册填充。这将确保Metaplex使用填充，而不是在React Native中不受支持的通常的Node.js库。以下是一个 `metro.config.js` 文件的示例：

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

## 把它们整合起来

与大多数新工具或框架一样，初始设置可能具有一定的挑战性。好消息是，一旦您让应用程序编译和运行起来，您在Web和移动应用程序中编写的代码几乎没有什么区别，而且在编写React Native和Expo应用程序的代码时几乎没有任何区别。

# 实验

通过共同构建Mint-A-Day应用程序来进行练习，用户将能够每天铸造一个NFT快照，从而创建一种永久的日记。

为了铸造NFT，我们将使用Metaplex的Javascript SDK以及[nft.storage](https://nft.storage/)来存储图像和元数据。我们所有的onchain工作都将在Devnet上进行。

这个实验的前半部分是汇集所需的组件，以使Expo、Solana和Metaplex一起工作。我们将以模块化的方式进行此操作，这样您将知道样板中的哪些部分与哪个部分对应。

## 1. 搭建、构建和运行本地Expo应用程序

在第一部分中，我们将简单地在模拟器上运行一个typescript Expo应用程序。如果您已经设置了React Native开发环境，请跳过第0步。

### 0. 设置React Native开发环境

您需要在计算机上安装React Native以及一个运行中的模拟器或物理设备。[您可以通过React Native快速入门完成这一切](https://reactnative.dev/docs/environment-setup?guide=native)。关于此设置的更多详细信息也可以在[基本Solana移动课程介绍](./basic-solana-mobile.md#0-prerequisites)中找到。

> 注意：尽管我们使用Expo，您还需要按照React Native cli指南进行初始设置。
> 注意：如果您运行的是模拟器，强烈建议您使用较新版本的手机进行仿真，并为其提供数GB的RAM以使其运行。我们在我们的环境中使用了5GB的RAM。

### 1. 注册Expo EAS CLI

为了简化Expo流程，您将需要一个Expo应用程序服务（EAS）帐户。这将帮助您构建和运行应用程序。

首先注册[EAS帐户](https://expo.dev/)。

然后，安装EAS CLI并登录：

```bash
npm install --global eas-cli
eas login
```

### 2. 创建应用程序骨架

让我们使用以下命令创建我们的应用程序：

```bash
npx create-expo-app -t expo-template-blank-typescript solana-expo
cd solana-expo
```

这使用 `create-expo-app` 基于 `expo-template-blank-typescript` 模板为我们生成一个新的骨架。这只是一个空的Typescript React Native应用程序。

### 3. 本地构建配置

Expo默认情况下会在远程服务器上构建，但我们需要在本地构建才能正确地使Solana Mobile运行。我们需要添加一个新的配置文件，让编译器知道我们在做什么。在您的目录根目录中创建一个名为 `eas.json` 的文件。

```bash
touch eas.json
```

将以下内容复制粘贴到新创建的 `eas.json` 中：
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

### 4. 构建和模拟

现在让我们构建项目。对于每个问题，您都应该选择“是”。这将需要一段时间才能完成。

```bash
npx eas build --profile development --platform android --local
```



当命令完成后，你会在你的根目录下获得一个输出文件。这个文件的命名格式将是`build-XXXXXXXXXXX.apk`。在你的文件浏览器中找到这个文件，并***拖拽***它到你的模拟器中。模拟器将显示一个消息，说明它正在安装新的 APK。当安装完成后，你应该在模拟器中看到 APK 的应用图标。

刚刚安装的应用程序只是来自 Expo 的一个脚手架应用。你需要运行以下命令来启动开发服务器：

```bash
npx expo start --dev-client --android
```

这将在你的 Android 模拟器中打开并运行该应用。

***注意*** 每次添加新的依赖时，你都需要构建并重新安装该应用程序。任何视觉或逻辑相关的内容都应该由热重载器捕捉。

## 2. 配置你的 Expo 应用程序以与 Solana 配合工作

现在我们已经有了一个正在运行的 Expo 应用程序，我们需要添加我们的 Solana 依赖项，包括在模拟器中安装一个我们可以使用的钱包。如果你已经安装了支持 Devnet 的钱包，你可以跳过第 0 步。

### 0. 安装一个支持 Devnet 的 Solana 钱包

你需要一个支持 Devnet 的钱包进行测试。在[我们的移动钱包适配器课程](./mwa-deep-dive)中，我们创建了其中一个。让我们从我们的应用程序中不同的目录中的解决方案分支中安装它：

```bash
cd ..
git clone https://github.com/Unboxed-Software/react-native-fake-solana-wallet
cd react-native-fake-solana-wallet
git checkout solution
npm run install
```

钱包应该已经安装在你的模拟器或设备上。确保打开新安装的钱包并且给自己空投一些 SOL。

确保返回到钱包目录，因为我们将在剩下的实验中继续步骤。

```bash
cd ..
cd solana-expo
```

### 1. 安装 Solana 依赖项

我们将安装一些基本的 Solana 依赖项，这些依赖项可能会被所有 Solana 移动应用程序所需。这将包括一些填充，允许与 React Native 不兼容的软件包正常工作：

```bash
npm install \
  @solana/web3.js \
  @solana-mobile/mobile-wallet-adapter-protocol-web3js \
  @solana-mobile/mobile-wallet-adapter-protocol \
  react-native-get-random-values \
  buffer
```

### 3. 添加 Solana 脚手架提供者

接下来，让我们添加一些 Solana 脚手架，可以帮助你启动大多数基于 Solana 的应用程序。

创建两个新文件夹：`components` 和 `screens`。

我们将使用来自[第一个移动课程](./basic-solana-mobile)的一些脚手架代码。我们将复制 `components/AuthProvider.tsx` 和 `components/ConnectionProvider.tsx` 中的代码。这些文件为我们提供了一个 `Connection` 对象以及一些帮助函数，用于授权我们的 dapp。

创建文件 `components/AuthProvider.tsx`，并将[我们现有的 Auth Provider 代码从 Github](https://raw.githubusercontent.com/Unboxed-Software/solana-advance-mobile/main/components/AuthProvider.tsx)复制到新文件中。

其次，创建文件 `components/ConnectionProvider.tsx`，并将[我们现有的 Connection Provider 代码从 Github](https://raw.githubusercontent.com/Unboxed-Software/solana-advance-mobile/main/components/ConnectionProvider.tsx)复制到新文件中。

现在让我们在 `screens/MainScreen.tsx` 中为我们的主屏幕创建一个脚手架：
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

最后，让我们修改 `App.tsx`，将我们的应用程序包装在我们刚刚创建的两个提供者中：

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

请注意，我们在上面添加了两个填充：`buffer` 和 `react-native-get-random-values`。这些是 Solana 依赖项正常运行所必需的。

### 4. 构建和运行 Solana 脚手架

让我们确保一切工作正常并正确编译。在 Expo 中，每当你更改依赖项时，你需要重新构建和重新安装应用程序。

***可选：*** 为了避免可能的构建版本冲突，您可能希望在将新版本拖放到新版本之前*卸载*先前的版本。

构建：
```bash
npx eas build --profile development --platform android --local
```
安装：
***将***生成的构建文件拖动到你的模拟器中。

运行：
```bash
npx expo start --dev-client --android
```

一切应该都编译正常，你将拥有一个 Solana Expo 应用的脚手架。

## 3. 配置你的 Expo 应用程序以与 Metaplex 配合工作

Metaplex 是你处理所有 NFT API 需求的一站式平台。然而，这需要一些额外的设置。好消息是，如果你将来想要在你的应用程序中获取、铸造或编辑 NFT，你将有另一个脚手架可以参考。

### 1. 安装 Metaplex 依赖项

Metaplex SDK 将许多与 NFT 相关的细节抽象出来，但它主要是为 Node.js 编写的，所以我们需要更多的填充来使其工作：
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

### 2. 填充配置

我们不会直接在我们的代码中导入上面的填充，所以我们需要将它们添加到一个 `metro.config.js` 文件中，以确保 Metaplex 使用它们：

```bash
touch metro.config.js
```

将以下内容复制粘贴到 `metro.config.js` 中：
```js
// 导入默认的 Expo Metro 配置
const { getDefaultConfig } = require('@expo/metro-config');

// 获取默认的 Expo Metro 配置
const defaultConfig = getDefaultConfig(__dirname);

## 翻译 private_upload/default_user/2024-06-02-00-54-02/content copy.zip.extract/content copy/solana-mobile-dApps-with-expo.md.part-3.md

```javascript
// 自定义配置以包括您的额外节点模块
defaultConfig.resolver.extraNodeModules = {
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  url: require.resolve('react-native-url-polyfill'),
  zlib: require.resolve('browserify-zlib'),
  path: require.resolve('path-browserify'),
};

// 导出修改后的配置
module.exports = defaultConfig;
```

### 3. Metaplex 提供者

我们将创建一个 Metaplex 提供者文件，用于访问`Metaplex`对象。这个`Metaplex`对象将为我们提供访问`fetch`和`create`等所有必需的函数。为此，我们在`/components/MetaplexProvider.tsx`中创建一个新文件。这里我们将移动钱包适配器传送到供`Metaplex`对象使用的`IdentitySigner`中。这样它就可以代表我们调用一些特权函数：

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

### 4. NFT 提供者

我们还在创建一个更高级别的 NFT 提供者，用于帮助管理 NFT 状态。它结合了我们之前提到的三个提供者：`ConnectionProvider`、`AuthProvider`和`MetaplexProvider`，以便我们创建`Metaplex`对象。我们将在后续步骤中填写此文件，现在先暂时使用它作为模板。

让我们创建一个新文件`components/NFTProvider.tsx`：
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

请注意，我们在顶部添加了另一个 polyfill：`import "react-native-url-polyfill/auto";`

### 5. 包装提供者

现在，让我们在`App.tsx`中将新的`NFTProvider`包装在`MainScreen`周围：

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

### 6. 构建和运行

最后，让我们构建并重新安装应用程序，以确保一切仍然正常。

构建：

```bash
npx eas build --profile development --platform android --local
```

安装：

***将***生成的构建文件拖入模拟器中。

运行：

```bash
npx expo start --dev-client --android
```

## 4. 配置 Expo 应用程序以拍摄和上传照片


迄今为止，我们所做的一切实质上都是我们需要的样板，以便开始添加我们打算在Mint-A-Day应用中拥有的功能。Mint-A-Day是一款每日快照应用。它允许用户以铸造NFT的形式，每天拍摄他们的生活快照。

该应用程序将需要访问设备的摄像头和一个远程存储捕获的图像的地方。幸运的是，Expo SDK可以提供对摄像头的访问，而NFT.Storage可以免费存储您的NFT文件。

### 1. 摄像头设置

让我们首先设置我们将使用的特定于Expo的依赖项：`expo-image-picker`。这使我们能够使用设备的摄像头拍摄照片，随后我们将把它们转换为NFT。我们特别使用图像选择器而不是相机，因为模拟器没有相机。该软件包将为我们在模拟器中模拟一个相机。使用以下命令安装它：

```bash
npx expo install expo-image-picker
```

除了安装外，`expo-image-picker`软件包还需要在`app.json`中作为插件添加：

```json
  "expo": {
    // ....
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "允许您使用图像创建Solana NFT"
        }
      ]
    ],
    // ....
  }
```

该特定依赖项使得使用摄像头非常简单。只需调用以下内容，即可允许用户拍照并返回图像：

```tsx
const result = await ImagePicker.launchCameraAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
});
```

目前不需要将此功能添加到任何地方 - 我们将在几个步骤中进行。

### 2. NFT.Storage设置

我们需要做的最后一件事是设置我们对[nft.storage](https://nft.storage)的访问。我们需要获取一个API密钥并将其添加为环境变量，然后我们需要添加一个最后的依赖项，以将我们的图像转换为我们可以上传的文件类型。

我们将使用NFT.storage来托管我们的NFT，并使用IPFS，因为他们可以免费提供这项服务。[注册并创建API密钥](https://nft.storage/manage/)。请保持此API密钥私密。

最佳实践建议将API密钥保存在具有`.gitignore`的`.env`文件中。还建议创建一个`.env.example`文件，可以提交到存储库，并显示项目所需的环境变量。

在您的目录根目录中创建这两个文件，并将`.env`添加到您的`.gitignore`文件中。

然后，将您的API密钥添加到`.env`文件中，名称为`EXPO_PUBLIC_NFT_STORAGE_API`。现在您将能够安全地在应用程序中访问您的API密钥。

最后，使用以下命令安装`rn-fetch-blob`。该软件包将帮助我们从设备的URI方案中获取图像，并将它们转换为我们可以上传至[NFT.storage](https://nft.storage)的Blob。

使用以下命令安装它：

```bash
npm i rn-fetch-blob
```

### 3. 最终构建

如果您想确保一切正常运作，构建并重新安装应用程序。这将是我们在本实验中不得不做的最后一次操作。其余的应该是热加载的。

构建：

```bash
npx eas build --profile development --platform android --local
```

安装：

将生成的构建文件***拖动***到模拟器中。

运行：

```bash
npx expo start --dev-client --android
```

## 5. 添加功能以完成您的Expo应用程序

我们已完成设置！现在让我们为Mint-A-Day应用程序创建实际功能。幸运的是，现在我们只需要关注两个文件：

- `NFTProvider.tsx`将主要管理我们的应用程序状态和NFT数据。
- `MainScreen.tsx`将捕获输入并展示我们的NFTs。

应用程序本身相对简单。一般流程如下：

1. 用户使用`transact`函数连接（授权），并在回调内部调用`authorizeSession`授权。
2. 然后，我们的代码使用`Metaplex`对象来获取用户创建的所有NFT。
3. 如果当天没有为当前日期创建NFT，则允许用户拍照、上传，并将其铸造为NFT。

### 1. NFT提供程序

`NFTProvider.tsx`将使用自定义的`NFTProviderContext`控制状态。它应具有以下字段：

- `metaplex: Metaplex | null` - 保存我们用于调用`fetch`和`create`的metaplex对象
- `publicKey: PublicKey | null` - NFT创建者的公共密钥
- `isLoading: boolean` - 管理加载状态
- `loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null` - 用户的快照NFT数组
- `nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null` - 当天创建的NFT引用
- `connect: () => void` - 用于连接到启用Devnet的钱包的函数
- `fetchNFTs: () => void` - 用于获取用户的快照NFT的函数
- `createNFT: (name: string, description: string, fileUri: string) => void` - 用于创建新的快照NFT的函数


```tsx
export interface NFTContextState {
  metaplex: Metaplex | null; // 保存我们用于调用`fetch`和`create`的metaplex对象
  publicKey: PublicKey | null; // 授权钱包的公共密钥
  isLoading: boolean; // 加载状态
  loadedNFTs: (Nft | Sft | SftWithToken | NftWithToken)[] | null; // 包含元数据的加载过的NFT数组
  nftOfTheDay: (Nft | Sft | SftWithToken | NftWithToken) | null; // 创建于当天的NFT快照
  connect: () => void; // 连接并授权我们到启用Devnet的钱包
  fetchNFTs: () => void; // 使用`metaplex`对象获取NFTs
  createNFT: (name: string, description: string, fileUri: string) => void; // 创建NFT
}
```

状态流程是：`connect`，`fetchNFTs`，然后`createNFT`。我们将逐个介绍每个功能的代码，然后在最后向您展示整个文件内容。

1. `connect` - 这个函数将连接并授权该应用程序，然后将生成的`publicKey`存储到状态中。
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

2. `fetchNFTs` - 这个函数将使用Metaplex来获取NFTs：
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

        // 检查今天是否已经做过快照
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

3. `createNFT` - 这个函数将上传文件到NFT.Storage，然后使用Metaplex创建和铸造NFT到您的钱包。这分为三部分，上传图片，上传元数据，然后铸造NFT。

    要上传到NFT.Storage，只需使用您的API密钥和图片/元数据进行POST请求。

    我们将创建两个辅助函数分别用于上传图片和元数据，然后将它们合并到单个`createNFT`函数中：
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

    上传图像和元数据后铸造NFT就像调用`metaplex.nfts().create(...)`一样简单。以下是将一切整合到`createNFT`函数中的示例：
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

我们将以上所有内容放入`NFTProvider.tsx`文件中。总体来看，代码如下所示：


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

我们的主屏幕将分为三个部分：每日图片、操作按钮和以往快照的轮播。每日图片显示在应用程序的上半部分，操作按钮紧随其下，轮播则位于其下方。操作按钮会根据我们的`NFTProvider`的状态进行变化：首先是`connect`，然后是`fetchNFTs`，最后是`mintNFT`。在这些操作中，我们只需要为`mintNFT`做一些额外的工作。`mintNFT`函数使用Expo库通过`ImagePicker.launchCameraAsync`打开摄像头。拍摄照片后，会返回其本地路径。我们需要做的最后一件事是指定照片的拍摄时间。然后，我们将以`MM.DD.YY`格式将NFT命名为拍摄日期，并将Unix时间戳保存为描述。最后，我们将图片路径、名称和描述传递给我们的`NFTProvider`中的`createNFT`函数，以铸造NFT。

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

`MainScreen.tsx` 的完整代码如下：
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

### 3. 测试

现在是时候创建我们的第一个快照了！首先打开您的Devnet启用的钱包，并确保有一些SOL。接下来，点击“连接钱包”并批准该应用。通过点击“获取NFTs”获取所有的NFT。最后，点击“创建快照”进行上传和铸造。

恭喜！这并不是一个简单或快速的实验。如果您能做到这一点，那么您做得很好。如果遇到任何问题，请随时回顾本实验或参考GitHub上“main”分支中的最终解决方案代码。

# 挑战

现在轮到您了。从头开始创建您自己的Expo应用程序。您可以选择自己的想法，或者可以从以下想法中进行选择：

- 创建一个应用程序，让用户写当天的日记条目，然后将其铸造为NFT，而不是每日图像快照
- 创建一个基本的NFT查看器应用程序，以查看所有美妙的JPEG
- 使用`expo-sensors`中的计步器制作一个简化的[Stepn](https://stepn.com/)的克隆

## 完成了实验吗？

将您的代码推送到GitHub，并[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=19cf8d3a-89a0-465e-95da-908cf8f45409)！
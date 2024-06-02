---
title: 探索移动钱包适配器
objectives:
- 描述连接到 Web 钱包与连接到移动钱包之间的差异
- 从移动钱包连接并签署交易
- 创建一个简单的移动钱包
- 高层解释 `walletlib` 与钱包应用之间的交互
---
**译者**: [ben46](https://github.com/ben46)

# 摘要
- 钱包只是密钥对的封装，但对于安全密钥管理至关重要
- 移动和 Web dApps 在它们的钱包-应用连接方面处理方式不同
- MWA 在其 `transact` 函数内处理所有钱包交互
- Solana Mobile 的 `walletlib` 为将钱包请求呈现给钱包应用进行了大量工作

# 课程

钱包存在是为了保护您的秘密密钥。尽管一些应用可能有特定于应用的密钥，但许多加密使用案例依赖于单个身份在多个应用程序之间使用。在这些情况下，您需非常注意如何在这些应用程序之间公开签名。您不希望将您的密钥与所有应用程序共享，这意味着您需要一种标准来允许应用程序向持有您的秘密密钥的安全钱包应用提交需要签名的交易。这就是移动钱包适配器 (MWA) 的用武之地。它是连接您的移动 dApps 到您的钱包的传输层。

## 什么是 MWA

移动钱包适配器 (MWA) 是 dApps 与钱包之间的移动连接。就像我们在 Web 上习惯的 [钱包适配器](https://github.com/solana-labs/wallet-adapter)，MWA 允许我们创建本机移动 dApps。然而，由于 Web 和移动是不同的平台，因此我们必须以不同的方式处理应用程序-钱包连接。

在其核心上，钱包应用程序非常简单。它是围绕您的密钥对的安全封装。外部应用程序可以请求钱包对交易进行签名，而不必直接访问您的私钥。Web 和移动钱包适配器都为它们各自的平台定义了该交互。

### Web 钱包是如何工作的？

Web 钱包简单来说就是一个存储密钥对并允许浏览器请求访问其功能的浏览器扩展程序。它的工作是遵循 [钱包标准](https://github.com/wallet-standard/wallet-standard)，该标准定义了浏览器应该可用的功能：

- `registerWallet`
- `getWallets`
- `signAndSendTransaction`
- `signIn`
- `signTransaction`
- `signMessage`

所有这些功能都通过全局 `window` 对象提供给浏览器。浏览器扩展程序会注册自己作为一个钱包。钱包适配器会寻找这些注册的钱包，并允许客户端连接和进行交互。

浏览器扩展程序钱包可以运行隔离的 JavaScript。意味着它可以向浏览器的 `window` 对象注入函数。实际上，从浏览器的角度来看，这里的传输层只是额外的 JavaScript 代码。

如果您对浏览器扩展程序的工作原理感兴趣，可以查看一些 [开源浏览器扩展程序](https://github.com/solana-labs/browser-extension/tree/master)。

### MWA 与 Web 钱包的不同之处

移动钱包适配器 (MWA) 有所不同。在 Web 世界中，我们只需要向 `window` 对象注入一些代码来访问我们的钱包。然而，在移动平台上，应用程序是被隔离的。这意味着每个应用程序的代码都与其他应用程序隔离。这些应用程序之间没有类似于浏览器 `window` 对象的共享状态。这对于钱包签名来说是一个问题，因为移动钱包和移动 dApp 存在于隔离的环境中。

然而，如果您愿意发挥创造力，有方法可以促进通信。在 Android 上，基本的应用间通信是通过 [`Intents`](https://developer.android.com/guide/components/intents-filters)。Android Intent 是用于从另一个应用组件请求动作的消息对象。

这种通信是单向的，而钱包功能的界面需要双向通信。MWA 通过使用来自请求应用的 Intent 来触发钱包应用开启使用 WebSockets 进行双向通信。

这节课的其余部分将关注于 MWA 接口和功能，而不是支撑应用间通信的底层机制。然而，如果您想了解细节，请阅读 [MWA 规范](https://solana-mobile.github.io/mobile-wallet-adapter/spec/spec.html)。

## 如何使用 MWA

MWA 与传统钱包适配器之间的差异需要对编程应用程序的方式进行轻微的修改。

### 连接到钱包

为了进行对比，看一下使用 React 和 React Native 连接到钱包的示例。

在 Web 端，您将应用程序用 `WalletProvider` 包装，并且子组件通过 `useWallet` hook 访问钱包。从那里，子组件可以查看、选择、连接和与钱包进行交互。

```tsx
// 父组件
<WalletProvider wallets={wallets}>
  {children}
</WalletProvider>

// 子组件
const {wallets, select, connect} = useWallet();
const wallet = wallets[0] // 选择一个钱包
select(wallet); // 选择钱包
connect(); // 连接
```

在 React Native 中，使用 MWA，情况则有些不同。在这种情况下，不需要提供提供程序。相反，通过 MWA 包的 `transact` 函数提供了钱包上下文。在后台，该函数会搜索设备上的活动 Solana 钱包。它通过部分选择模式将这些钱包呈现给用户。一旦用户选择了一个钱包，该钱包将作为参数提供给 `transact` 回调。然后您的代码可以直接与钱包进行交互。

```tsx
transact(async (wallet: Web3MobileWallet) => { 
  // 返回用户选择的钱包的上下文
});
```

### 授权钱包

在 Web 上，当您在浏览器中首次将钱包连接到站点时，钱包会提示您授权该站点。类似地，在移动端，请求应用程序需要被授权才能请求 *特权* 方法，例如签署交易。

您的代码可以通过调用 `wallet.authorize()` 触发此授权过程。用户将被要求接受或拒绝授权请求。返回的 `AuthorizationResult` 将指示用户的接受或拒绝。如果接受，则此结果对象将为您提供用户的帐户以及您可以在 `wallet.reauthorize()` 中使用的 `auth_token`。这个授权令牌确保其他应用程序不能冒充成您的应用程序。

```tsx
transact(async (wallet: Web3MobileWallet) => { 
  const authResult = wallet.authorize(
    {
      cluster: "devnet", 
      identity: { name: 'Solana Counter Incrementor' }
    }
  ); // 授权钱包

  const authToken = authResult.auth_token; // 保存此项供 wallet.reauthorize() 函数使用
  const publicKey = authResult.selectedAccount.publicKey
});
```

值得注意的是，除了 `authorize` 和 `deauthorize` 方法之外，所有方法都是 *特权* 方法。因此，您应该跟踪钱包是否已经被授权，并在其授权时调用 `wallet.reauthorize()`。下面是一个跟踪授权状态的简单示例：


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

请注意，上面的示例未处理错误或用户拒绝。在生产环境中，建议使用自定义的 `useAuthorization` 钩子来封装授权状态和方法。有关参考信息，请参考我们在[前一节](./basic-solana-mobile.md#5-create-authprovidertsx)中构建的内容。

### 与钱包交互

与连接和授权钱包不同，在网络和移动设备上请求方法如 `signAndSendTransactions`、`signMessages` 和 `signTransactions` 几乎是相同的。

在网络上，您可以使用 `useWallet` 钩子来访问这些方法。只需确保在调用它们之前已连接：

```tsx
const { connected, signAllTransactions, signMessage, sendTransaction } = useWallet();

if ( connected ) {
  signAllTransactions(...);
  signMessage(...);
  sendTransaction(...);
}
```

对于 MWA，只需在由 `transact` 回调提供的 `wallet` 上调用函数即可：

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

  // 选择您的交互方式...
  wallet.signAndSendTransactions(...)
  wallet.signMessages(...)
  wallet.signTransactions(...)
});
```

每次要调用这些方法时，您都将需要调用 `wallet.authorize()` 或 `wallet.reauthorize()`。

就是这样！您现在应该有足够的信息来开始工作。Solana 移动团队付出了大量工作，使开发体验在这两个平台之间尽可能无缝。

## MWA 在钱包端的作用

本课程在大部分情况下讨论了 MWA 在 dApp 中的作用，但是 MWA 的绝大部分功能是在钱包中发生的。无论您是想创建自己的钱包还是只是想更好地理解该系统，值得讨论 MWA 兼容钱包在高层次上正在做什么。对于大多数读者而言，并不需要在阅读这些部分后感觉自己可以创建一个钱包；只需试图了解整体流程即可。

### 介绍 `walletlib`

Solana Mobile 通过创建 `mobile-wallet-adapter-walletlib` 来完成了绝大部分的繁重工作。该库处理了 dApp 和钱包之间的所有底层通讯。然而，该软件包仍在开发中，目前还不可通过 npm 安装。根据他们的 GitHub：

> 该软件包仍在 Alpha 版，并且尚未达到生产可用状态。但是，API 是稳定的，不会发生重大变化，因此您可以开始与您的钱包进行集成。

然而，`walletlib` 不为您提供用户界面，也不确定请求的结果。相反，它公开了一个钩子，使得钱包代码可以接收和解决请求。钱包开发者需要负责显示适当的用户界面、管理钱包行为，并适当地解决每个请求。

### 钱包如何使用 `walletlib`

在核心层面上，钱包通过调用一个函数来使用 `walletlib`：`useMobileWalletAdapterSession`。在调用此函数时，钱包提供以下内容：
1. 钱包名称
2. 类型为 `MobileWalletAdapterConfig` 的配置对象
3. 请求的处理程序
4. 会话的处理程序

以下是一个示例组件，展示了钱包如何连接到 `walletlib` 的脚手架结构：

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

如果您要创建自己的钱包，您将修改 `config` 对象，并相应地实现 `handleRequest` 和 `handleSessionEvent` 处理程序。虽然这些都是必需的且都很重要，但主要的元素是请求处理程序。这是钱包为每个请求提供实现逻辑的地方，例如如何处理当 dApp 请求授权或要求钱包签名并发送交易时。

例如，如果请求的类型是 `MWARequestType.SignAndSendTransactionsRequest`，那么您的代码将使用用户的私钥对请求中提供的交易进行签名，将请求发送到 RPC 提供者，然后使用 `resolve` 函数回应请求的 dApp。

`resolve` 函数的作用仅是告诉 dApp 发生了什么，并关闭会话。`resolve` 函数接受两个参数：`request` 和 `response`。根据原始请求的不同，`request` 和 `response` 的类型也有所不同。因此，在 `MWARequestType.SignAndSendTransactionsRequest` 的示例中，您将使用以下 `resolve` 函数：

```ts
export function resolve(request: SignAndSendTransactionsRequest, response: SignAndSendTransactionsResponse): void;
```

`SignAndSendTransactionsResponse` 类型定义如下：

```ts
export type SignAndSendTransactionsCompleteResponse = Readonly<{ signedTransactions: Uint8Array[] }>;
export type SignAndSendTransactionsResponse =
  | SignAndSendTransactionsCompleteResponse
  | UserDeclinedResponse
  | TooManyPayloadsResponse
  | AuthorizationNotValidResponse
  | InvalidSignaturesResponse;
```


发送的响应取决于尝试签署和发送交易的结果。

如果您想了解与“resolve”相关的所有类型，请查看[`walletlib`源](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/js/packages/mobile-wallet-adapter-walletlib)。

最后一点是用于与`walletlib`交互的组件也需要在应用程序的 `index.js`中注册为应用程序的 MWA 入口点。

```js
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import MWAApp from './MWAApp'

// 模拟事件监听器函数，防止它们致命错误。
window.addEventListener = () => {};
window.removeEventListener = () => {};

AppRegistry.registerComponent(appName, () => App);

// 注册 MWA 组件
AppRegistry.registerComponent(
'MobileWalletAdapterEntrypoint',
  () => MWAApp,
);
```

## 结论

虽然 MWA 与 Web 钱包标准略有不同，但一旦您了解它们之间的细微差别，实现移动钱包交互就变得相当简单。当您了解 MWA 不仅在您的 dApp 中，还在钱包中所做的事情时，这一点尤为真实。如果有任何不清楚的地方，请务必花时间熟悉方程式的两边。

# 实验室

现在让我们进行一些动手实践，构建一个移动钱包。这里的目标是看到 MWA 过程的两端都发生了什么，以揭开应用程序与钱包之间的关系。

### 0. 设置开发环境（如有必要）

在开始编写我们的钱包之前，我们需要一些准备工作。您将需要一个 React Native 开发环境和一个用于测试的 Solana dApp。如果您已经完成了[基本的 Solana 移动教程](./basic-solana-mobile)，则这两个要求应该已满足，您的 Android 设备/模拟器上已安装了计数器应用。

如果您*还没有*完成上一课程，您需要:

1. 使用设备或模拟器设置[Android React Native开发环境](https://reactnative.dev/docs/environment-setup)
2. 安装[Devnet Solana dApp](https://github.com/Unboxed-Software/solana-react-native-counter.git)

如果您想安装上一个课程的应用程序，您可以执行以下命令:

```bash
git clone https://github.com/Unboxed-Software/solana-react-native-counter.git
cd solana-react-native-counter
git checkout solution
npm run install
```

### 1. 规划应用程序结构

我们要从头开始制作钱包，因此让我们先看看我们的主要构建模块。

首先，我们将制作实际的钱包应用程序（不包括弹出窗口）。这将包括创建或修改以下内容:
- WalletProvider.tsx
- MainScreen.tsx
- App.tsx

接下来，我们将创建一个样板化的 MWA 应用程序，每当从不同的 dApp 请求钱包时，它就会显示“我是一个钱包”。这将包括创建或修改以下内容:
- MWAApp.tsx
- index.js

然后，我们将设置所有的UI和请求路由。这将意味着创建或修改以下内容:
- MWAApp.tsx
- ButtonGroup.tsx
- AppInfo.tsx

最后，我们将实现两个实际的请求功能，授权和签署和发送交易。这需要创建以下内容:
- AuthorizeDappRequestScreen.tsx
- SignAndSendTransactionScreen.tsx

### 2. 创建应用程序脚手架

让我们用如下命令来创建应用程序脚手架：

```bash
npx react-native@latest init wallet --npm
cd wallet
```

现在，让我们安装我们的依赖项。这些是从我们的[介绍到 Solana 移动实验室](./basic-solana-mobile.md#2-create-the-app)中的相同依赖项，再加上两个额外的依赖:
- `@react-native-async-storage/async-storage`: 提供访问设备上的存储
- `fast-text-encoding`: 文本编码的 polyfill

我们将使用 `async-storage` 来存储我们的密钥对，以便钱包在多个会话中保持持久。需要注意的是，`async-storage` ***不是*** 在生产环境中保持密钥的安全位置。再次强调，请***不要***在生产环境中使用此功能。而是请查看[Android的密钥库系统](https://developer.android.com/privacy-and-security/keystore)。

使用以下命令安装这些依赖项:

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

接下来的步骤有点混乱。我们需要依赖Solana的 `mobile-wallet-adapter-walletlib` 包，这个包处理所有的低级通信。但是，这个包仍在开发中，不能通过 npm 获取。出于他们的 github 介绍:

> 该软件包仍处于测试阶段，不适用于生产。但是，API 是稳定的，不会发生 drastical 的变化，因此可以开始集成你的钱包。

然而，我们已经提取了这个包并在 GitHub 上提供了这个库。如果您对我们是如何做到这一点感兴趣，请参阅 [我们在 GitHub 上提供了该软件包的 README](https://github.com/Unboxed-Software/mobile-wallet-adapter-walletlib)。

让我们在一个新文件夹 `lib` 中安装该软件包：

```bash
mkdir lib
cd lib
git clone https://github.com/Unboxed-Software/mobile-wallet-adapter-walletlib.git
```

接下来，我们必须通过将文件路径作为解决方案将其手动链接到 `package.json` 依赖项中，以依赖于它的包，这一步如下:

```json
"dependencies": {
    ...
    "@solana-mobile/mobile-wallet-adapter-walletlib": "file:./lib/mobile-wallet-adapter-walletlib",
    ...
}
```

通过在项目根目录重新安装，让 npm 知道这个新软件包:

```bash
cd ..
npm install
```

接下来，将 `android/build.gradle` 中的 `minSdkVersion` 更改为版本 `23`.
```gradle
  minSdkVersion = 23
```

最后，通过构建该应用程序完成初始设置。您应该在设备上看到默认的 React Native 应用程序。

```bash
npm run android
```

如果出现任何错误，请确保您已经仔细检查了上述所有步骤。

### 3. 创建主要钱包应用程序


这里有两个部分需要建立钱包应用程序：

1. 手动打开钱包应用程序时需要显示的用户界面
2. 当其他应用程序请求使用钱包时需要显示为底部弹出窗口的用户界面

在整个实验中，我们将分别称这两部分为“主钱包应用程序”和“钱包弹出窗口”。

- 当应用程序首次加载时生成`Keypair`
- 显示地址和Devnet SOL余额
- 允许用户向他们的钱包进行一些Devnet SOL的空投

这一切都可以通过创建两个文件来实现：

- `WalletProvider.tsx` - 生成一个`Keypair`并将其存储在`async-storage`中，然后在随后的会话中获取`Keypair`。 它还提供Solana的`Connection`。
- `MainScreen.tsx` - 显示钱包、它的余额和一个空投按钮

让我们从`WalletProvider.tsx`开始。该文件将使用`async-storage`来存储`Keypair`的Base58编码版本。提供程序将检查`@my_fake_wallet_keypair_key`的存储键。如果没有返回值，那么提供程序应生成并存储一个`Keypair`。`WalletProvider`然后会返回其包括`wallet`和`connection`的上下文。应用程序的其余部分可以使用`useWallet()`挂钩来访问这个上下文。

***再次重申***，`async storage`在生产环境中不适合存储私钥。请使用像[Android的密钥库系统](https://developer.android.com/privacy-and-security/keystore)这样的方法。

让我们在一个名为`components`的新目录中创建`WalletProvider.tsx`：

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
        // 生成一个新的随机密钥对并将其存储在本地存储中以便以后检索
        // 这不是安全的！`async storage`用于演示目的。请勿以这种方式存储密钥!
        keyPair = await Keypair.generate();
        await AsyncStorage.setItem(
          ASYNC_STORAGE_KEY,
          JSON.stringify(encodeKeypair(keyPair)),
        );
      }
      setKeyPair(keyPair);
    } catch (e) {
      console.log('获取密钥对时出错: ', e);
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

注意，我们将我们的`rpcUrl`默认设置为Devnet。

现在让我们来创建`MainScreen.tsx`。它应该简单地从`useWallet()`中获取`wallet`和`connection`，然后显示地址和余额。此外，由于所有交易都需要以SOL形式支付交易费，因此我们还将包括一个空投按钮。

在一个名为`screens`的新目录中创建一个新文件`MainScreen.tsx`：
```tsx
import {Button, StyleSheet, Text, View} from 'react-native';
import {useWallet} from '../components/WalletProvider';
import {useEffect, useState} from 'react';
import {LAMPORTS_PER_SOL} from '@solana/web3.js';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center', // 沿主轴居中显示子元素（对于列来说是垂直的）
    alignItems: 'center', // 沿交叉轴居中显示子元素（对于列来说是水平的）
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
      <Text>钱包：</Text>
      <Text>{wallet?.publicKey.toString() ?? '无钱包'}</Text>
      <Text>余额：</Text>
      <Text>{balance?.toFixed(5) ?? ''}</Text>
      {isLoading && <Text>加载中...</Text>}
      {balance != null && !isLoading && balance < 0.005 && (
        <Button title="空投 1 SOL" onPress={airdrop} />
      )}
    </View>
  );
};

export default MainScreen;
```

最后，让我们编辑`App.tsx`文件来完成我们的钱包的“应用程序”部分。


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

确保一切正常运行，构建并部署：

```bash
npm run android
```

### 4. 创建辅助组件

现在让我们暂时创建一些帮助 UI 组件，这些组件将为钱包弹出窗口提供所需的布局。我们将为请求 `AppInfo.tsx` 中的相关信息创建一个文本布局，以及在 `ButtonGroup.tsx` 中创建一些按钮。

首先，`AppInfo.tsx` 将显示来自请求钱包连接的 dApp 的相关信息。请创建以下 `components/AppInfo.tsx` 文件：

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
        <Text>请求元数据</Text>
        <Text>集群: {cluster ? cluster : 'NA'}</Text>
        <Text>应用名称: {appName ? appName : 'NA'}</Text>
        <Text>范围: {scope ? scope : 'NA'}</Text>
      </View>
    </>
  );
}

export default AppInfo;
```

其次，让我们创建一个将“接受”和“拒绝”按钮进行分组的组件，命名为 `components/ButtonGroup.tsx`：

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

### 5. 创建钱包弹出窗口骨架

当 Solana dApp 发送 `solana-wallet://` 意图时，钱包弹出窗口就会显示出来。我们的钱包将监听此请求、建立连接并渲染弹出窗口。

幸运的是，我们不需要实现任何低级功能。Solana 在 `mobile-wallet-adapter-walletlib` 库中已经为我们做好了艰苦的工作。我们所需要做的就是创建视图并处理请求。

让我们从简单的弹出窗口开始。它所做的就是在 Solana dApp 连接时弹出并简单地显示“我是钱包”。

为了让这个弹出窗口在 Solana dApp 请求访问时弹出，我们需要使用 `walletlib` 中的 `useMobileWalletAdapterSession`。这需要四个参数：

- `walletName` - 钱包的名称
- `config` - `MobileWalletAdapterConfig` 类型的一些简单钱包配置
- `handleRequest` - 处理来自 dApp 的请求的回调函数
- `handleSessionEvent` - 处理会话事件的回调函数

以下是满足 `useMobileWalletAdapterSession` 的最小设置的示例：
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

我们将很快实现 `handleRequest` 和 `handleSessionEvent`，但是首先让我们使最简化的弹出窗口工作。

在您的项目根目录下创建一个名为 `MWAApp.tsx` 的新文件：

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
          <Text style={{fontSize: 50}}>我是一个钱包！</Text>
        </View>
      </WalletProvider>
    </SafeAreaView>
  );
};

export default MWAApp;
```

最后一件事就是在 `index.js` 中注册我们的 MWA 应用为入口点，名称为 `MobileWalletAdapterEntrypoint`。

将`index.js`更改为如下内容：

```js
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import MWAApp from './MWAApp'

// 模拟事件监听器函数以防止其致命错误。
window.addEventListener = () => {};
window.removeEventListener = () => {};

AppRegistry.registerComponent(appName, () => App);

// 注册MWA组件
AppRegistry.registerComponent(
  'MobileWalletAdapterEntrypoint',
  () => MWAApp,
);
```

继续测试以确保其正常工作。首先执行以下命令:

```bash
npm run android
```

打开您的Devnet Solana dApp，最好打开上一课中的`counter`应用程序，然后进行请求。您应该会看到屏幕底部弹出一个标签，上面写着“I'm a wallet.”

### 6. 创建MWA支架

让我们扩展`MWAApp.tsx`，以结构化出后续允许用户连接、签名和发送交易的一些架构。现在，我们将只为MWA功能中的`authorize`和`signAndSendTransaction`执行此操作。

首先，在`MWAApp.tsx`中添加一些内容：

1. 通过使用`useState`来保存`currentRequest`和`currentSession`，进行一些生命周期管理。这将允许我们跟踪连接的生命周期。
2. 在`useEffect`中增加一个`hardwareBackPress`监听器，以优雅地处理关闭弹出窗口的操作。此监听器应该使用`BackHandler`的`resolve`来调用`MWARequestFailReason.UserDeclined`。
3. 在`useEffect`中监听`SessionTerminatedEvent`，以关闭弹出窗口。这将调用一个助手函数，执行`BackHandler`上的`exitApp`。
4. 在`useEffect`中监听`ReauthorizeDappRequest`请求类型，并自动解决它。
5. 使用`renderRequest()`根据不同类型的请求渲染相应的内容。这应该是一个`switch`语句，根据请求类型路由到不同的UI。

将您的`MWAApp.tsx`更改为以下内容：

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
  // ------------------- 函数 --------------------

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

  // ------------------- Effect --------------------

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

请注意，`renderRequest`目前还没有渲染任何有用的内容。我们仍然需要*处理*不同的请求。

### 7. 实现授权弹窗

让我们创建第一个屏幕来处理新的授权。此屏幕的唯一工作是显示哪个应用程序需要授权，并允许用户接受或拒绝请求，使用`walletlib`中的`resolve`函数。

我们将使用`AppInfo`和`ButtonGroup`来组成整个UI。我们所要做的就是插入正确的信息，并编写接受和拒绝请求的逻辑。

对于授权，我们将使用`resolve`函数，该函数使用`AuthorizeDappRequest`和`AuthorizeDappResponse`类型。`AuthorizeDappResponse`是`AuthorizeDappCompleteResponse`和`UserDeclinedResponse`类型的联合。每种类型的定义如下：

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
我们的逻辑将决定在解决请求时使用哪一个。

现在我们有了所有这些背景知识，我们可以将所有内容放在一个名为`screens/AuthorizeDappRequestScreen.tsx`的新文件中：

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

现在让我们更新我们的`MWAApp.tsx`文件，通过在`renderRequest`的switch语句中添加内容来处理这种情况：
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

随时可以重新建立和运行钱包。当您第一次与另一个 Solana 应用程序互动时，我们的新授权屏幕将会出现。
### 8. 实现签署并发送弹出窗口。
让我们通过添加签名和发送交易屏幕来完成我们的钱包应用程序。在这里，我们需要从`request`中获取交易，使用来自我们的`WalletProvider`的秘钥对其进行签名，然后将其发送到一个RPC。

UI界面将与我们的授权页面非常相似。我们将使用`AppInfo`提供有关应用程序的一些信息，以及使用`ButtonGroup`提供一些按钮。这一次，我们将为我们的`resolve`函数完成`SignAndSendTransactionsRequest`和`SignAndSendTransactionsResponse`。
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
我们只会涵盖`SignAndSendTransactionsCompleteResponse`、`InvalidSignaturesResponse`和`UserDeclinedResponse`。

特别要注意的是，我们必须遵守`InvalidSignaturesResponse`：
```ts
export type InvalidSignaturesResponse = Readonly<{
  failReason: MWARequestFailReason.InvalidSignatures;
  valid: boolean[];
}>;
```
`InvalidSignaturesResponse`的独特之处在于它需要一个布尔数组，其中每个布尔值对应一个失败的交易。因此，我们将需要跟踪这些信息。

至于签名和发送操作，我们需要做一些工作。由于我们通过套接字发送交易，交易数据被序列化为字节，我们需要在签名之前对交易进行反序列化。

我们可以通过两个函数来实现：
- `signTransactionPayloads`：返回签名的交易以及与之对应的1对1的`valid`布尔数组。我们将检查这个数组来查看哪些签名失败。
- `sendSignedTransactions`：接收签名的交易并将其发送到RPC。同样，它保留一个`valid`布尔数组来了解哪些交易失败了。

让我们把这些内容整合到一个名为`screens/SignAndSendTransactionScreen.tsx`的新文件中：
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
 
最后，让我们编辑 `MWAApp.tsx` 并在切换语句中添加我们的新屏幕：
```tsx
    switch (currentRequest?.__type) {
      case MWARequestType.AuthorizeDappRequest:
        return <AuthorizeDappRequestScreen request={currentRequest as AuthorizeDappRequest} />;
      case MWARequestType.SignAndSendTransactionsRequest:
          return <SignAndSendTransactionScreen request={currentRequest as SignAndSendTransactionsRequest} />;
      case MWARequestType.SignMessagesRequest:
      case MWARequestType.SignTransactionsRequest:
      default:
        return <Text>TODO 显示{currentRequest?.__type}的屏幕</Text>;
    }
```

继续构建和运行您的钱包应用。现在，您应该能够授权您的 dApp 并签署并发送交易。请注意，我们将 `SignMessagesRequest` 和 `SignTransactionsRequest` 留空，以便您可以在挑战中完成。

很棒的工作！创建一个钱包，即使是“虚假”版本，也是一项了不起的工作。如果您在任何地方遇到困难，请确保重新审视它，直到您理解发生了什么。此外，随时浏览课程的 [主分支解决方案代码](https://github.com/Unboxed-Software/react-native-fake-solana-wallet)。

# 挑战

现在轮到您独立练习了。尝试实现最后两种请求类型：`SignMessagesRequest` 和 `SignTransactionsRequest`。

尝试在没有帮助的情况下完成，因为这是很好的练习，但如果您遇到困难，请查看 [解决方案分支上的解决方案代码](https://github.com/Unboxed-Software/react-native-fake-solana-wallet/tree/solution)。

## 完成了这个实验？

将您的代码推送到 GitHub，然后[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5a3d0f62-c5fc-4e03-b8a3-323c2c7b8f4f)！

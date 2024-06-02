---
title: 客户端 Anchor 开发简介
objectives:
- 使用 IDL 与客户端交互 Solana 程序
- 解释 Anchor 的 `Provider` 对象
- 解释 Anchor 的 `Program` 对象
- 使用 Anchor 的 `MethodsBuilder` 构建指令和交易
- 使用 Anchor 获取账户
- 设置前端以调用 Anchor 和 IDL 的指令
---

# 摘要

- **IDL**是代表 Solana 程序结构的文件。使用 Anchor 自动编写和构建的程序会生成相应的 IDL。IDL 全称为接口描述语言。
- `@coral-xyz/anchor` 是一个 Typescript 客户端，包含了与 Anchor 程序交互所需的一切内容。
- **Anchor `Provider`** 对象结合了与集群的 `connection` 和指定的 `wallet`，以启用交易签名。
- **Anchor `Program`** 对象为与特定程序交互提供了自定义 API。你可以使用程序的 IDL 和 `Provider` 创建一个 `Program` 实例。
- **Anchor `MethodsBuilder`** 通过 `Program` 提供了一种简单的接口，用于构建指令和交易。

# 课程

Anchor 简化了通过提供反映程序结构的接口描述语言（IDL）文件与 Solana 程序进行客户端交互的过程。结合 Anchor 的 Typescript 库（`@coral-xyz/anchor`）使用 IDL 提供了一种简化的格式来构建指令和交易。

```tsx
// 发送交易
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

这可以在任何 Typescript 客户端上执行，无论是前端还是集成测试。在本课程中，我们将介绍如何使用 `@coral-xyz/anchor` 简化客户端程序交互。

## Anchor 客户端结构

让我们从 Anchor Typescript 库的基本结构开始。你将主要使用的是 `Program` 对象。`Program` 实例表示特定的 Solana 程序，并提供了自定义 API 用于读取和写入程序。

要创建 `Program` 实例，你将需要以下内容：

- IDL - 代表程序结构的文件
- `Connection` - 集群连接
- `Wallet` - 用于支付和签署交易的默认密钥对
- `Provider` - 封装了与 Solana 集群的 `Connection` 和一个 `Wallet`
- `ProgramId` - 程序的链上地址

![Anchor 结构](../../assets/anchor-client-structure.png)

上图显示了如何组合这些部分以创建 `Program` 实例。我们将逐个讨论这些部分，以便更好地了解它们之间的联系。

### 接口描述语言 (IDL)

当你构建一个 Anchor 程序时，Anchor 会生成一个代表你的程序 IDL 的 JSON 和 Typescript 文件。IDL 代表程序的结构，客户端可以用它来推断如何与特定程序交互。

尽管不是自动的，你也可以使用 Metaplex 等工具从本机 Solana 程序生成 IDL，比如 [shank](https://github.com/metaplex-foundation/shank)。

为了了解 IDL 提供的信息，以下是你之前构建的计数器程序的 IDL：

```json
{
  "version": "0.1.0",
  "name": "counter",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": true },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "increment",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": false, "isSigner": true }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Counter",
      "type": {
        "kind": "struct",
        "fields": [{ "name": "count", "type": "u64" }]
      }
    }
  ]
}
```

检查 IDL，可以看到该程序包含两个指令（`initialize` 和 `increment`）。

请注意，除了指定指令外，它还为每个指令的账户和输入提供了规范。`initialize` 指令需要三个账户：

1. `counter` - 在指令中被初始化的新账户
2. `user` - 用于交易和初始化的付款方
3. `systemProgram` - 调用系统程序以初始化新账户

`increment` 指令需要两个账户：

1. `counter` - 要增加计数字段的现有账户
2. `user` - 交易的付款方

从 IDL 可以看出，在两个指令中， `user` 都标记为需要签名者，因为 `isSigner` 标志标记为 `true`。此外，由于对于两者来说， `args` 部分都为空，因此两者都不需要任何额外的指令数据。

在 `accounts` 部分进一步查看时，可以看到该程序包含一个名为 `Counter` 的账户类型，其中包含一个类型为 `u64` 的单个 `count` 字段。

尽管 IDL 不提供每个指令的具体实现细节，但我们可以基本了解链上程序预期如何构建指令，并查看程序账户的结构。

无论你如何获取它，你都*需要*一个 IDL 文件来使用 `@coral-xyz/anchor` 包与程序交互。要使用 IDL，你需要将 IDL 文件包含在项目中，然后导入文件。

```tsx
import idl from "./idl.json"
```

### Provider

在使用 IDL 创建 `Program` 对象之前，你首先需要创建一个 Anchor `Provider` 对象。

`Provider` 对象结合了两个部分：

- `Connection` - 到 Solana 集群的连接（即 localhost、devnet、mainnet）
- `Wallet` - 用于支付和签署交易的指定地址

然后，`Provider` 可以通过在传出交易中包含钱包签名，代表 `Wallet` 向 Solana 区块链发送交易。当使用带有 Solana 钱包提供程序的前端时，所有传出交易仍然必须通过用户的钱包浏览器扩展程序批准。

设置 `Wallet` 和 `Connection` 的样例代码如下：

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

建立连接，您可以使用 `@solana/wallet-adapter-react` 中的 `useConnection` 钩子来获取到 Solana 集群的 `Connection`。

请注意，`@solana/wallet-adapter-react` 提供的 `useWallet` 钩子中的 `Wallet` 对象与 Anchor `Provider` 预期的 `Wallet` 对象不兼容。但是，`@solana/wallet-adapter-react` 也提供了 `useAnchorWallet` 钩子。

下面是从 `useAnchorWallet` 中得到的 `AnchorWallet` 对象：

```tsx
export interface AnchorWallet {
  publicKey: PublicKey
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
}
```

以及从 `useWallet` 中得到的 `WalletContextState` 对象：

```tsx
export interface WalletContextState {
  autoConnect: boolean
  wallets: Wallet[]
  wallet: Wallet | null
  publicKey: PublicKey | null
  connecting: boolean
  connected: boolean
  disconnecting: boolean
  select(walletName: WalletName): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ): Promise<TransactionSignature>
  signTransaction: SignerWalletAdapterProps["signTransaction"] | undefined
  signAllTransactions:
    | SignerWalletAdapterProps["signAllTransactions"]
    | undefined
  signMessage: MessageSignerWalletAdapterProps["signMessage"] | undefined
}
```

`WalletContextState` 提供了比 `AnchorWallet` 更多的功能，但是 `AnchorWallet` 是设置 `Provider` 对象所必需的。

要创建 `Provider` 对象，您可以使用 `@coral-xyz/anchor` 中的 `AnchorProvider`。

`AnchorProvider` 构造函数有三个参数：

- `connection` - Solana 集群的 `Connection`
- `wallet` - `Wallet` 对象
- `opts` - 可选参数，用于指定确认选项，如果没有提供则使用默认设置

创建完 `Provider` 对象后，您可以使用 `setProvider` 将其设置为默认提供程序。

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### 程序

一旦您获得了 IDL 和一个提供程序，您就可以创建 `Program` 的实例。构造函数需要三个参数：

- `idl` - 类型为 `Idl` 的 IDL
- `programId` - 以 `string` 或 `PublicKey` 类型表示的程序的链上地址
- `Provider` - 前一节讨论的提供程序

`Program` 对象创建了一个自定义 API，您可以使用它与 Solana 程序进行交互。此 API 是与与链上程序通信相关的所有功能的一站式商店。除其他事项外，您可以发送交易、获取反序列化的账户、解码指令数据、订阅账户变更，并监听事件。您还可以[了解有关 `Program` 类的更多信息](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor)。

要创建 `Program` 对象，首先从 `@coral-xyz/anchor` 中导入 `Program` 和 `Idl`。`Idl` 是您在使用 Typescript 时可以使用的一种类型。

接下来，指定程序的 `programId`。我们必须显式地指定 `programId`，因为可以存在多个具有相同 IDL 结构的程序（即，如果相同的程序使用不同的地址多次部署）。创建 `Program` 对象时，如果未显式指定，默认使用默认的 `Provider`。

最终的设置如下：

```tsx
import idl from "./idl.json"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@coral-xyz/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()

const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("JPLockxtkngHkaQT5AuRYow3HyUv5qWzmhwsCPd653n")
const program = new Program(idl as Idl, programId)
```

## Anchor `MethodsBuilder`

一旦设置了 `Program` 对象，您可以使用 Anchor 方法生成器来构建与程序相关的指令和交易。`MethodsBuilder` 使用 IDL 提供了一个简化的格式来构建调用程序指令的交易。

请注意，与使用 Rust 编写程序时采用的 snake case 命名约定相比，通过客户端与程序交互时采用的是 camel case 命名约定。

基本的 `MethodsBuilder` 格式如下：

```tsx
// 发送交易
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

逐步进行，您需要：

1. 在 `program` 上调用 `methods` - 这是用于创建与程序的 IDL 相关的指令调用的构建器 API
2. 调用指令名称，例如 `.instructionName(instructionDataInputs)` - 使用点号语法简单地调用指令，使用指令的名称，将指定的任何指令参数以逗号分隔的方式传递进去
3. 调用 `accounts` - 使用点号语法，调用 `.accounts`，传入一个对象，其中包含基于 IDL 的指令所预期的每个账户
4. 可选地调用 `signers` - 使用点号语法，调用 `.signers`，传入由指令需要的其它签署方组成的数组
5. 调用 `rpc` - 此方法创建并发送了带有指定指令的已签名交易，并返回一个 `TransactionSignature`。使用 `.rpc` 时，来自 `Provider` 的 `Wallet` 会自动包括为签署者，不必显式列出

请注意，如果指令除了 `Provider` 指定的 `Wallet` 之外不需要额外的签署者，则可以省略 `.signer([])` 行。

还可以通过将 `.rpc()` 更改为 `.transaction()` 直接构建交易。这将使用指定的指令构建一个 `Transaction` 对象。

```tsx
// 创建交易
const transaction = await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .transaction()

await sendTransaction(transaction, connection)
```

类似地，您可以使用相同的格式通过 `.instruction()` 构建指令，然后手动将指令添加到新交易中。这将使用指定指令构建一个 `TransactionInstruction` 对象。

```tsx
// 创建第二条指令
const instructionTwo = await program.methods
    .instructionTwoName(instructionTwoDataInputs)
    .accounts({})
    .instruction()

// 将两个指令添加到一个事务
const transaction = new Transaction().add(instructionOne, instructionTwo)

// 发送事务
await sendTransaction(transaction, connection)
```

总之，Anchor `MethodsBuilder` 提供了一种简化且更灵活的与链上程序进行交互的方法。您可以构建一条指令、一条事务或者使用基本相同的格式构建和发送一条事务，而无需手动序列化或反序列化账户或指令数据。

## 获取程序账户

`Program` 对象还允许您轻松获取和过滤程序账户。只需在 `program` 上调用 `account`，然后指定在 IDL 上反映的账户类型的名称。然后，Anchor会反序列化并返回所有指定的账户。

下面的示例显示了您如何获取 Counter 程序的所有现有 `counter` 账户。

```tsx
const accounts = await program.account.counter.all()
```

您还可以使用 `memcmp` 应用过滤器，然后指定要过滤的 `offset` 和 `bytes`。

下面的示例获取所有 `count` 为0的 `counter` 账户。请注意，偏移量为8是为了Anchor用于标识账户类型的8字节鉴别器。第9个字节是 `count` 字段的起始位置。您可以参考 IDL 看到下一个字节存储了类型为 `u64` 的 `count` 字段。Anchor 然后过滤并返回所有在相同位置具有匹配字节的账户。

```tsx
const accounts = await program.account.counter.all([
    {
        memcmp: {
            offset: 8,
            bytes: bs58.encode((new BN(0, 'le')).toArray()),
        },
    },
])
```

另外，如果您知道要查找的账户的地址，还可以使用 `fetch` 获取特定账户的反序列化账户数据。

```tsx
const account = await program.account.counter.fetch(ACCOUNT_ADDRESS)
```

同样，您还可以使用 `fetchMultiple` 获取多个账户。

```tsx
const accounts = await program.account.counter.fetchMultiple([ACCOUNT_ADDRESS_ONE, ACCOUNT_ADDRESS_TWO])
```

# 实验

让我们通过为上一课的 Counter 程序构建一个前端来进行练习。作为提醒，Counter 程序有两条指令：

- `initialize` - 初始化一个新的 `Counter` 账户并将 `count` 设置为 `0`
- `increment` - 增加现有 `Counter` 账户的 `count`

### 1. 下载起始代码

下载[此项目的起始代码](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/starter)。一旦您拥有了起始代码，请仔细查看。使用 `npm install` 安装依赖项，然后使用 `npm run dev` 运行应用程序。

这个项目是一个简单的 Next.js 应用程序。它包括我们在[钱包课程](https://github.com/Unboxed-Software/solana-course/blob/main/content/interact-with-wallets)中创建的 `WalletContextProvider`，Counter 程序的 `idl.json` 文件，以及我们将在整个实验中构建的 `Initialize` 和 `Increment` 组件。还包括了我们将调用的程序的 `programId`。

### 2. `Initialize`

首先，让我们完成在 `Initialize.tsx` 组件中创建 `Program` 对象的设置。

记住，我们需要一个 `Program` 实例来使用 Anchor `MethodsBuilder` 调用我们程序的指令。为此，我们需要从 `useAnchorWallet` 和 `useConnection` 钩子获得 Anchor 钱包和连接。让我们还创建一个 `useState` 来存储程序实例。

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
  const [program, setProgram] = useState("")

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  ...
}
```

有了上述设置后，我们就可以开始创建实际的 `Program` 实例了。让我们在 `useEffect` 中完成这个操作。

首先，我们需要获取默认提供者（provider），或者在没有时创建它。我们可以通过在 try/catch 块中调用 `getProvider` 来实现。如果抛出错误，那意味着没有默认提供者，我们需要创建一个。

一旦我们有了提供者，我们就可以构造一个 `Program` 实例。

```tsx
useEffect(() => {
  let provider: anchor.Provider

  try {
    provider = anchor.getProvider()
  } catch {
    provider = new anchor.AnchorProvider(connection, wallet, {})
    anchor.setProvider(provider)
  }

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
  setProgram(program)
}, [])
```

现在，我们已经完成了 Anchor 设置，可以实际调用程序的 `initialize` 指令了。我们将在 `onClick` 函数内部进行此操作。

首先，我们需要为新的 `Counter` 账户生成一个新的 `Keypair`，因为我们第一次初始化账户。

然后我们可以使用 Anchor `MethodsBuilder` 创建并发送一个新事务。请记住，Anchor 可以推断一些所需的账户，如 `user` 和 `systemAccount` 账户。但是它无法推断 `counter` 账户，因为我们动态生成它，所以您需要使用 `.accounts` 将其添加。您还需要将该 keypair 作为签名者添加到 `.signers`。最后，您可以使用 `.rpc()` 将事务提交到用户的钱包。

事务成功后，调用 `setUrl` 并传入资源管理器 URL，然后调用 `setCounter`，传入 counter 账户。

```tsx
const onClick = async () => {
  const sig = await program.methods
    .initialize()
    .accounts({
      counter: newAccount.publicKey,
      user: wallet.publicKey,
      systemAccount: anchor.web3.SystemProgram.programId,
    })
    .signers([newAccount])
    .rpc()

    setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    setCounter(newAccount.publicKey)
}
```

### 3. `Increment`

接下来，让我们转到 `Increment.tsx` 组件。和之前一样，完成创建 `Program` 对象的设置。除了调用 `setProgram` 之外，`useEffect` 应该调用 `refreshCount`。

添加以下代码进行初始设置：

```tsx
export const Increment: FC<Props> = ({ counter, setTransactionUrl }) => {
  const [count, setCount] = useState(0)
  const [program, setProgram] = useState<anchor.Program>()
  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  useEffect(() => {
    let provider: anchor.Provider

    try {
      provider = anchor.getProvider()
    } catch {
      provider = new anchor.AnchorProvider(connection, wallet, {})
      anchor.setProvider(provider)
    }

    const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID)
    setProgram(program)
    refreshCount(program)
  }, [])
  ...
}
```

接下来，让我们使用 Anchor 的 `MethodsBuilder` 来构建一个新的指令，以调用 `increment` 指令。同样，Anchor 可以从钱包推断出 `user` 账户，因此我们只需要包含 `counter` 账户。

```tsx
const incrementCount = async () => {
  const sig = await program.methods
    .increment()
    .accounts({
      counter: counter,
      user: wallet.publicKey,
    })
    .rpc()

  setTransactionUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
}
```

### 4. 显示正确的计数

现在我们可以初始化计数器程序并增加计数，我们需要让我们的UI显示存储在计数器账户中的计数。

我们将在以后的课程中展示如何观察账户变化，但现在我们只有一个按钮来调用 `refreshCount`，所以您可以点击它以显示每次 `increment` 调用后的新计数。

在 `refreshCount` 中，让我们使用 `program` 来获取计数器账户，然后使用 `setCount` 将计数设置为程序上存储的数字：

```tsx
const refreshCount = async (program) => {
  const counterAccount = await program.account.counter.fetch(counter)
  setCount(counterAccount.count.toNumber())
}
```

使用 Anchor 真的很简单！

### 5. 测试前端

这时候一切应该都运行正常！您可以通过运行 `npm run dev` 来测试前端。

1. 连接您的钱包，应该会看到 `Initialize Counter` 按钮
2. 点击 `Initialize Counter` 按钮，然后批准交易
3. 然后您应该在屏幕底部看到一个指向 Solana Explorer 的链接，用于 `initialize` 事务。`Increment Counter` 按钮，`Refresh Count` 按钮和计数也应该都出现。
4. 点击 `Increment Counter` 按钮，然后批准交易
5. 等待几秒钟然后点击 `Refresh Count`。计数应该会在屏幕上增加。

![Anchor 前端演示的 GIF](../../assets/anchor-frontend-demo.gif)

随时点击链接以检查每个交易的程序日志！

![初始化程序日志](../../assets/anchor-frontend-initialize.png)

![增加程序日志](../../assets/anchor-frontend-increment.png)

恭喜，现在您知道如何使用 Anchor IDL 设置前端以调用 Solana 程序。

如果您需要更多时间来熟悉这些概念，请继续查看 [`solution-increment` 分支上的解决方案代码](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-increment) 后再继续。

# 挑战

现在轮到您独立构建一些东西了。基于我们在实验室中所做的工作，尝试在前端中创建一个新组件，以实现一个减少计数的按钮。

在构建前端组件之前，您首先需要：

1. 构建并部署一个实现 `decrement` 指令的新程序
2. 使用您新程序的 IDL 文件更新前端的 IDL 文件
3. 使用您新程序的 `programId` 更新前端中的 `programId`

如果您需要一些帮助，可随时[参考此程序](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement)。

如果可能的话，尽量独立完成吧！但如果遇到困难，也可以随时参考[解决方案代码](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/solution-decrement)。

## 完成实验了吗？

将您的代码推送到 GitHub，并[告诉我们您对此课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=774a4023-646d-4394-af6d-19724a6db3db)！

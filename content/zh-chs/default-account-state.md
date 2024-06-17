---
title: 默认账户状态
objectives:
 - 创建具有默认冻结账户状态的铸造账户
 - 解释默认账户状态的使用案例
 - 实验扩展的规则
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- `default state` 扩展允许开发人员为一个铸造器设置新的代币账户，并默认情况下将其冻结，需要与特定服务交互才能解冻和使用代币。
- 代币账户有三种状态：已初始化、未初始化和冻结，这些状态决定了如何与代币账户进行交互。
- 当一个代币账户被冻结时，其余额无法更改。
- `freezeAuthority` 是唯一能够冻结和解冻代币账户的地址。
- 可以使用 `updateDefaultAccountState` 来更新 `default state`。
- 本实验演示了使用 `default state` 扩展创建铸造器，并创建一个新的代币账户，该账户在创建时被设置为冻结状态。实验包括测试，以确保扩展对于冻结和解冻状态下的铸造和转移代币的预期工作。

# 概述

`default state` 扩展允许开发人员强制将所有新的代币账户置于两种状态之一："已初始化"或"冻结"。特别有用的是，使用此扩展可以将所有新创建的代币账户设置为冻结状态。当一个代币账户被冻结时，其余额无法更改，也就是说无法进行铸造、转移或销毁。 只有 `freezeAuthority` 可以解冻冻结账户。

想象一下，您是 Solana 游戏开发者，您希望只有您的游戏玩家能与您的游戏中的代币交互。您可以让玩家注册游戏账户以解冻他们的代币账户，并允许他们进行游戏和与其他玩家交易。这是因为 `default state` 扩展的设定，即所有新的代币账户都是冻结的。

### 不同类型的状态

默认账户状态扩展有 3 种状态：
- 未初始化：此状态表示已创建代币账户，但尚未通过代币程序进行初始化。
- 已初始化：已初始化状态的账户已通过代币程序正确设置。这意味着它具有指定的铸造器，并已分配了所有者。
- 冻结：冻结账户是暂时禁止执行某些操作的账户，具体来说是不能进行转移和铸造代币。

```ts
/** 程序存储的代币账户状态 */
export enum AccountState {
    未初始化 = 0,
    已初始化 = 1,
    冻结 = 2,
}
```

然而，“default state” 只处理后两种状态：`已初始化` 和 `冻结`。当您冻结一个账户时，状态为 `冻结`；当您解冻时，状态为 `已初始化`。

## 添加默认账户状态

初始化铸造器并设定转账费涉及三个指令：
- `SystemProgram.createAccount`
- `createInitializeTransferFeeConfigInstruction`
- `createInitializeMintInstruction`

第一个指令 `SystemProgram.createAccount` 在区块链上为铸造器账户分配空间。此指令实现三个目标：
- 分配 `空间`
- 转移租金所需的 `lamports`
- 分配给其所属程序

为了获得铸造器账户的大小，我们调用 `getMintLen`，而获取空间所需的 lamports，则调用 `getMinimumBalanceForRentExemption`。

```tsx
const mintLen = getMintLen([ExtensionType.DefaultAccountState]);
// Mint 账户所需的最低 lamports
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: mintKeypair.publicKey,
  space: mintLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

第二个指令 `createInitializeDefaultAccountStateInstruction` 初始化了默认账户状态扩展。

```tsx
const initializeDefaultAccountStateInstruction =
  createInitializeDefaultAccountStateInstruction(
    mintKeypair.publicKey, // 铸造器
    defaultState, // 默认状态
    TOKEN_2022_PROGRAM_ID,
  );
```

第三个指令 `createInitializeMintInstruction` 初始化了铸造器。

```tsx
const initializeMintInstruction = createInitializeMintInstruction(
  mintKeypair.publicKey,
  decimals,
  payer.publicKey,
  payer.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

最后，将所有这些指令添加到一个交易中，并将它发送到区块链。

```ts
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeDefaultAccountStateInstruction,
  initializeMintInstruction,
);

return await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair],
);
```

## 更新默认账户状态

只要您有权限，都可以随时更改默认账户状态。要做到这一点，只需调用 `updateDefaultAccountState`。

```ts
/**
 * 更新铸造器上的默认账户状态
 *
 * @param connection     要使用的连接
 * @param payer          交易费用的支付方
 * @param mint        要修改的铸造器
 * @param state        要在创建的账户上设置的新账户状态
 * @param freezeAuthority          铸造器的冻结权限
 * @param multiSigners   如果 `freezeAuthority` 是多签，则是签名账户
 * @param confirmOptions 确认交易的选项
 * @param programId      SPL 代币程序账户
 *
 * @return 已确认交易的签名
 */
export async function updateDefaultAccountState(
    connection: Connection,
    payer: Signer,
    mint: PublicKey,
    state: AccountState,
    freezeAuthority: Signer | PublicKey,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID
): Promise<TransactionSignature>
```

## 更新冻结权限

最后，您可能希望将 `freezeAuthority` 更新为另一个账户。比如，例如您想要通过程序处理冻结和解冻。您可以通过调用 `setAuthority` 来实现这一点，添加正确的账户并传入 `authorityType`，在这种情况下会是 `AuthorityType.FreezeAccount`。

```ts
/**
 * 为账户分配一个新的权限
 *
 * @param connection       要使用的连接
 * @param payer            交易费用的支付方
 * @param account          账户的地址
 * @param currentAuthority 指定类型的当前权限
 * @param authorityType    要设置的权限类型
 * @param newAuthority     账户的新权限
 * @param multiSigners     如果 `currentAuthority` 是多签，则是签名账户
 * @param confirmOptions   确认交易的选项
 * @param programId        SPL 代币程序账户
 *
 * @return 已确认交易的签名
 */

await setAuthority(
  connection,
  payer,
  mint,
  currentAuthority, 
  AuthorityType.FreezeAccount,
  newAuthority, 
  [],
  undefined,
  TOKEN_2022_PROGRAM_ID
)
```

# 实验


在这个实验室中，我们将使用`默认状态`扩展来创建一个薄荷，所有新的代币账户在创建时都会被冻结。然后，我们将编写测试来检查扩展是否按预期工作，尝试在冻结和解冻账户状态下铸造和转移代币。

### 1. 设置环境

要开始，请创建一个名为`default-account-state`的空目录并导航至其中。我们将初始化一个全新的项目。运行`npm init`并按照提示进行操作。

接下来，我们需要添加所需的依赖项。运行以下命令以安装必要的软件包：
```bash
npm i @solana-developers/helpers @solana/spl-token @solana/web3.js esrun dotenv typescript
```

创建一个名为`src`的目录。在此目录中，创建一个名为`index.ts`的文件。这是我们将对此扩展规则进行检查的地方。在`index.ts`中粘贴以下代码：

```ts
import { AccountState, TOKEN_2022_PROGRAM_ID, getAccount, mintTo, thawAccount, transfer, createAccount } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
// import { createTokenExtensionMintWithDefaultState } from "./mint-helper"; //稍后将取消注释
import { initializeKeypair, makeKeypairs } from '@solana-developers/helpers';

const connection = new Connection("http://127.0.0.1:8899", "confirmed");
const payer = await initializeKeypair(connection);

const [mintKeypair, ourTokenAccountKeypair, otherTokenAccountKeypair] = makeKeypairs(3)
const mint = mintKeypair.publicKey;
const decimals = 2;
const defaultState = AccountState.Frozen;

const ourTokenAccount = ourTokenAccountKeypair.publicKey;

// 要满足转账测试的要求
const otherTokenAccount = otherTokenAccountKeypair.publicKey;

const amountToMint = 1000;
const amountToTransfer = 50;

// 创建带有默认状态的薄荷

// 创建测试代币账户

// 测试：未解冻的铸造

// 测试：解冻的铸造

// 测试：未解冻的转账

// 测试：解冻的转账
```

`index.ts`创建了与指定验证器节点的连接，并调用`initializeKeypair`。它还带有我们在本实验其余部分中将使用的一些变量。当我们编写完其余脚本后，将在`index.ts`中调用我们脚本的其余部分。

如果在`initializeKeypair`中遇到空投错误，请按照下一步操作。

### 2. 运行验证器节点

为了方便起见，我们将运行自己的验证器节点。

在另一个终端中，运行以下命令：`solana-test-validator`。这将运行节点，同时记录一些键和值。我们需要检索并在我们的连接中使用的值是JSON RPC网址，本例中为`http://127.0.0.1:8899`。然后在连接中使用该网址来指定使用本地RPC URL。

```tsx
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
```

或者，如果你想使用测试网或开发网，请从`@solana/web3.js`中导入`clusterApiUrl`，并传递到连接中：

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

如果你决定使用开发网，且遇到空投sol的问题，请随时向`initializeKeypair`添加`keypairPath`参数。你可以通过在终端中运行`solana config get`来获取这个。然后前往[faucet.solana.com](https://faucet.solana.com/)，并向你的地址空投一些sol。你可以通过在终端中运行`solana address`来获取你的地址。

### 3. 辅助函数

当我们从早期粘贴了`index.ts`代码时，我们添加了以下辅助函数：

- `initializeKeypair`：此函数为`payer`创建了密钥对，并空投了一些SOL。
- `makeKeypairs`：此函数创建了密钥对，但没有空投任何SOL。

此外，我们还有一些初始账户：
  - `payer`：用于支付和成为所有事务的权限
  - `mintKeypair`：我们的薄荷，将具有`默认状态`扩展
  - `ourTokenAccountKeypair`：支付人所拥有的代币账户，我们将用它进行测试
  - `otherTokenAccountKeypair`：用于测试的另一个代币

### 4. 创建带有默认账户状态的薄荷

在创建带有默认状态的薄荷代币时，我们必须创建账户指令，初始化薄荷账户的默认状态，并初始化薄荷本身。

在`src/mint-helpers.ts`中创建一个名为`createTokenExtensionMintWithDefaultState`的异步函数。此函数将创建这样一个薄荷，以便所有新的代币账户将“冻结”起来。该函数将接受以下参数：

- `connection`：连接对象
- `payer`：交易的付款人
- `mintKeypair`：新薄荷的密钥对
- `decimals`：薄荷小数位数
- `defaultState`：薄荷代币的默认状态 - 例如：`AccountState.Frozen`

创建薄荷的第一步是使用`SystemProgram.createAccount`方法在Solana上保留空间。这需要指定付款人的密钥对（资助创建并提供SOL进行租金豁免的账户），新薄荷账户的公钥（`mintKeypair.publicKey`），在区块链上储存薄荷信息所需的空间，使账户免于租金的SOL数量（lamports），以及将管理该薄荷账户的代币程序的ID（`TOKEN_2022_PROGRAM_ID`）。

```tsx
const mintLen = getMintLen([ExtensionType.DefaultAccountState]);
// 薄荷账户所需的最低lamports
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: mintKeypair.publicKey,
  space: mintLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

创建薄荷账户后，接下来的步骤涉及用默认状态初始化薄荷账户。`createInitializeDefaultAccountStateInstruction`函数用于生成一个指令，使薄荷可以设置任何新代币账户的`defaultState`。

```tsx
const initializeDefaultAccountStateInstruction =
  createInitializeDefaultAccountStateInstruction(
    mintKeypair.publicKey,
    defaultState,
    TOKEN_2022_PROGRAM_ID,
  );
```


接下来，让我们通过调用`createInitializeMintInstruction`并传入所需的参数来添加铸币说明。此功能由SPL Token软件包提供，并构建了一个初始化新铸币的事务说明。

```tsx
const initializeMintInstruction = createInitializeMintInstruction(
  mintKeypair.publicKey,
  decimals,
  payer.publicKey, // 指定的铸币权限
  payer.publicKey, // 指定的冻结权限
  TOKEN_2022_PROGRAM_ID,
);
```

最后，让我们将所有指令添加到一个交易中并将其发送到区块链：

```tsx
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeDefaultAccountStateInstruction,
  initializeMintInstruction,
);

return await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair],
);
```

将所有部分汇总，最终的`src/mint-helpers.ts`文件如下：

```ts
import {
  AccountState,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeDefaultAccountStateInstruction,
  createInitializeMintInstruction,
  getMintLen,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * 创建具有默认状态的令牌铸币
 * @param connection
 * @param payer
 * @param mintKeypair
 * @param decimals
 * @param defaultState
 * @returns 事务的签名
 */
export async function createTokenExtensionMintWithDefaultState(
  connection: Connection,
  payer: Keypair,
  mintKeypair: Keypair,
  decimals: number = 2,
  defaultState: AccountState
): Promise<string> {
  const mintLen = getMintLen([ExtensionType.DefaultAccountState]);
  // 铸币账户所需的最小lamports
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initializeDefaultAccountStateInstruction =
    createInitializeDefaultAccountStateInstruction(
      mintKeypair.publicKey,
      defaultState,
      TOKEN_2022_PROGRAM_ID
    );

  const initializeMintInstruction = createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,
    payer.publicKey, // 指定的铸币权限
    payer.publicKey, // 指定的冻结权限
    TOKEN_2022_PROGRAM_ID
  );

  const transaction = new Transaction().add(
    createAccountInstruction,
    initializeDefaultAccountStateInstruction,
    initializeMintInstruction
  );

  return await sendAndConfirmTransaction(connection, transaction, [
    payer,
    mintKeypair,
  ]);
}
```

### 6. 测试设置

现在我们有了创建具有默认状态的铸币的能力，让我们编写一些测试来查看其功能。

### 6.1 创建具有默认状态的铸币

首先，让我们创建一个具有默认状态为`frozen`的铸币。为此，我们将在`index.ts`文件中调用我们刚刚创建的`createTokenExtensionMintWithDefaultState`函数：

```ts
// 创建具有默认状态的铸币
await createTokenExtensionMintWithDefaultState(
  connection,
  payer,
  mintKeypair,
  decimals,
  defaultState
);
```

### 6.2 创建测试令牌账户

现在，让我们创建两个新的令牌账户进行测试。我们可以通过调用SPL Token库提供的`createAccount`助手来实现这一点。我们将使用我们一开始生成的密钥对：`ourTokenAccountKeypair`和`otherTokenAccountKeypair`。

```tsx
// 创建测试令牌账户
// 从账户转移
await createAccount(
  connection,
  payer,
  mint,
  payer.publicKey,
  ourTokenAccountKeypair,
  undefined,
  TOKEN_2022_PROGRAM_ID
);
// 转移到账户
await createAccount(
  connection,
  payer,
  mint,
  payer.publicKey,
  otherTokenAccountKeypair,
  undefined,
  TOKEN_2022_PROGRAM_ID
);
```

### 7 测试

现在让我们编写一些测试来展示与`默认状态`扩展的交互。 

总共我们将编写四个测试:

- 未解冻接收者账户的铸币
- 解冻接收者账户的铸币
- 在未解冻接收者账户的情况下进行转移
- 在解冻接收者账户的情况下进行转移

### 7.1 未解冻接收者账户的铸币

此测试将尝试在不解冻账户的情况下对`ourTokenAccount`铸币。预期此测试将失败，因为账户在铸币尝试时会被冻结。请记住：当一个令牌账户被冻结时，其余额是不能变化的。

为此，让我们在一个`try catch`中尝试包装`mintTo`函数，并打印相应的结果：

```tsx
// 测试：未解冻的铸币
try {
  // 尝试未解冻的铸币
  await mintTo(
    connection,
    payer,
    mint,
    ourTokenAccount,
    payer.publicKey,
    amountToMint,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.error("不应该铸币...");
} catch (error) {
  console.log(
    "✅ - 我们预期此测试失败，因为账户仍然被冻结。"
  );
}
```

通过运行该脚本进行测试：
```bash
esrun src/index.ts
```

我们应该在终端上看到以下错误日志，这意味着扩展功能按预期工作。`✅ - 我们预期此测试失败，因为账户仍然被冻结。`

### 7.2 解冻接收者账户的铸币

此测试将尝试在解冻令牌账户后进行铸币。预期此测试将通过，因为账户在铸币尝试时将被解冻。

我们可以通过调用`thawAccount`，然后调用`mintTo`来创建此测试：

```tsx
// 测试：解冻的铸币
// 解冻被冻结的令牌
await thawAccount(
  connection, 
  payer,
  ourTokenAccount,
  mint, 
  payer.publicKey,
  undefined,
  undefined, 
  TOKEN_2022_PROGRAM_ID
);
// 铸币到令牌账户
await mintTo(
  connection,
  payer,
  mint,
  ourTokenAccount,
  payer.publicKey,
  amountToMint,
  undefined,
  undefined,
  TOKEN_2022_PROGRAM_ID
);

const ourTokenAccountWithTokens = await getAccount(connection, ourTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
```


```ts
控制台输出(
  `✅ - 解冻和铸造后新的账户余额为 ${Number(ourTokenAccountWithTokens.amount)}。`
);
```

继续运行脚本，交易应该成功。
```bash
esrun src/index.ts
```

### 7.3 在不解冻收件人账户的情况下转移

现在我们已经测试了铸币，我们可以测试转移我们的代币时账户解冻和冻结的情况。首先让我们测试在不解冻收件人令牌账户的情况下转移。请记住，默认情况下，`otherTokenAccountKeypair` 由于扩展而被冻结。

同样，我们预计这个测试会失败，因为 `otherTokenAccountKeypair` 是冻结的，它的余额不会改变。

为了测试这一点，让我们在 `try catch` 中包装一个 `transfer` 函数：

```tsx
// 测试：未解冻时转移
try {

  await transfer(
    connection,
    payer,
    ourTokenAccount,
    otherTokenAccount,
    payer,
    amountToTransfer,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  )

  console.error("不应该被铸币...");
} catch (error) {
  console.log(
    "✅ - 我们预期这会失败，因为该账户仍然被冻结。"
  );
}
```

运行测试并查看结果：
```bash
esrun src/index.ts
```

### 7.4 在解冻收件人账户的情况下转移

我们将创建的最后一个测试测试在冻结的代币账户解冻后转移代币。预计这个测试会通过，因为现在所有代币账户都已解冻。

我们将通过调用 `thawAccount` 然后 `transfer` 来实现这一点：

```tsx
// 测试：解冻后转移
// 解冻冻结的代币账户
await thawAccount(
  connection,
  payer,
  otherTokenAccount,
  mint,
  payer.publicKey,
  undefined,
  undefined,
  TOKEN_2022_PROGRAM_ID
);

await transfer(
  connection,
  payer,
  ourTokenAccount,
  otherTokenAccount,
  payer,
  amountToTransfer,
  undefined,
  undefined,
  TOKEN_2022_PROGRAM_ID
);

const otherTokenAccountWithTokens = await getAccount(
  connection,
  otherTokenAccount,
  undefined,
  TOKEN_2022_PROGRAM_ID
);

console.log(
  `✅ - 解冻并转移后新的账户余额为 ${Number(
    otherTokenAccountWithTokens.amount
  )}。`
);
```

再次运行所有测试并查看结果：
```bash
esrun src/index.ts
```

请记住以下重点：
- `默认状态` 扩展，对 *所有* 新代币账户强制使用默认状态。
- 冻结账户的余额无法改变。

恭喜！我们刚刚使用默认账户扩展创建并测试了一个铸造！

# 挑战
添加从冻结和解冻代币账户中销毁代币的测试（提示，一个会失败，一个会成功）。

以下是起步代码：
```ts
// 测试：在冻结的账户中销毁代币
await freezeAccount(
  connection,
  payer,
  ourTokenAccount,
  mint,
  payer.publicKey,
  [],
  undefined,
  TOKEN_2022_PROGRAM_ID,
)

await burn(
  connection,
  payer,
  ourTokenAccount,
  mint,
  payer.publicKey,
  1,
  [],
  undefined,
  TOKEN_2022_PROGRAM_ID,
)
```

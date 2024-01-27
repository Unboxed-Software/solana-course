---
title: 使用 Token Program 创建 Token 代币
objectives:
- 创建铸币厂
- 创建 Token 账户
- 铸造 Token
- Token 转账
- 销毁 Token
---

# TL;DR
* SPL-Tokens代表Solana网络上所有非原生代币。Solana上的同质化和非同质化代币（NFT）都是SPL-Tokens。
* Token Program 包含创建和与SPL-Tokens交互的指令。
* Token Mints 是存储关于特定Token的数据的账户，但不持有代币。
* Token Accounts 用于持有特定Token Mint的代币。
* 创建Token Mints和Token Accounts 需要SOL来支付租金。当账户关闭时，Token Account的租金可以退还，但目前无法关闭Token Mints账户。

# 概览
Token Program是Solana Program Library（SPL）提供的众多程序之一。它包含创建和与SPL-Tokens交互的指令。这些代币代表Solana网络上所有非原生（即非SOL）代币。

本课程将重点介绍使用Token Program创建和管理新SPL-Token的基础知识：
1. 创建新的Token Mint
2. 创建Token Accounts
3. 铸造
4. 将代币从一个持有者转移给另一个持有者
5. 销毁代币

我们将从开发过程的客户端角度来解决这个问题，使用`@solana/spl-token` JavaScript库。

## 铸币厂（Token Mint）
要创建新的SPL-Token，首先必须创建一个Token Mint。Token Mint是存储特定代币数据的账户。

例如，让我们看一下Solana Explorer上的[USD Coin (USDC) on the Solana Explorer](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)。USDC的Token Mint 地址是`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`。通过浏览器，我们可以查看USDC的Token Mint的特定详细信息，如代币的当前供应量、铸造和冻结权限的地址，以及代币的小数精度：
![Screenshot of USDC Token Mint](../assets/token-program-usdc-mint.png)

要创建新的Token Mint，您需要向Token Program发送正确的交易指令。为此，我们将使用`@solana/spl-token`的`createMint`函数。

```tsx
const tokenMint = await createMint(
  connection,
  payer,
  mintAuthority,
  freezeAuthority,
  decimal
);
```
`createMint`函数返回新token mint的`publicKey`。此函数需要以下参数：
- `connection` - 连接到集群的JSON-RPC连接
- `payer` - 支付交易费的账户
- `mintAuthority` - 有权限执行从Token Mint铸造代币的账户
- `freezeAuthority` - 有权限冻结token account中的代币的账户。如果不需要冻结属性，则可以将参数设置为null。
- `decimals` - 指定代币的所需小数精度

当从具有您的私钥访问权限的脚本创建新的铸造厂时，您可以简单地使用`createMint`函数。但是，如果您要构建一个网站允许用户创建新的代币铸造厂，您需要使用用户的私钥构建和提交具有正确指令的交易，而不让用户将其暴露给浏览器。在这种情况下，您需要构建并提交具有正确指令的交易。

在底层，`createMint`函数只是创建一个包含两个指令的交易：
1. 创建新账户
2. 初始化新的铸造厂

这将如下所示：

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateMintTransaction(
  connection: web3.Connection,
  payer: web3.PublicKey,
  decimals: number
): Promise<web3.Transaction> {
  const lamports = await token.getMinimumBalanceForRentExemptMint(connection);
  const accountKeypair = web3.Keypair.generate();
  const programId = token.TOKEN_PROGRAM_ID

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: accountKeypair.publicKey,
      space: token.MINT_SIZE,
      lamports,
      programId,
    }),
    token.createInitializeMintInstruction(
      accountKeypair.publicKey,
      decimals,
      payer,
      payer,
      programId
    )
  );

  return transaction
}
```

当手动构建用于创建新代币铸造厂的指令时，请确保将创建账户和初始化铸造厂的指令添加到同一交易中。如果将每个步骤都放在单独的交易中，理论上其他人可能会接管您创建的账户并将其初始化为自己的铸造厂。

### 租金和租金豁免（Rent and Rent Exemption）
请注意，前一个代码片段的函数主体中的第一行调用了`getMinimumBalanceForRentExemptMint`，其结果传递到`createAccount`函数中。这是称为租金豁免的账户初始化的一部分。

直到最近，Solana上的所有账户都需要执行以下操作之一以避免被释放：
1. 在特定时间间隔支付租金
2. 在初始化时存入足够的SOL以被视为租金豁免

最近，第一个选项被取消，现在在初始化新账户时需要存入足够的SOL以豁免租金。

通过这种方式，我们使用`@solana/spl-token`库中的`getMinimumBalanceForRentExemptMint`来创建一个token mint账户。然而，这个概念适用于所有账户，您可以使用`Connection`上的更通用的`getMinimumBalanceForRentExemption`方法来创建其他可能需要创建的账户。

## Token 账户（Token Account）
在您可以铸造代币（发行新供应）之前，您需要一个Token账户来持有新发行的代币。

Token账户持有特定“铸造厂”的代币，并具有指定的账户“所有者”。只有所有者被授权减少Token账户余额（转账、销毁等），而任何人都可以向Token账户发送代币以增加其余额。

可以使用`spl-token`库的`createAccount`函数来创建新的Token账户：
```tsx
const tokenAccount = await createAccount(
  connection,
  payer,
  mint,
  owner,
  keypair
);
```

该`createAccount`函数返回新Token账户的`publicKey`。此函数需要以下参数：
- `connection` - 连接到集群的JSON-RPC连接
- `payer` - 支付交易费的账户
- `mint` - 新Token账户与之关联的Token铸造厂
- `owner` - 新Token账户的所有者账户
- `keypair` - 这是一个可选参数，用于指定新Token账户地址。如果未提供密钥对，则`createAccount`函数将默认为从关联的`mint`和`owner`账户派生。

请注意，此`createAccount`函数与之前在我们深入了解`createMint`函数时所展示的`createAccount`函数不同。之前，我们使用`SystemProgram`上的`createAccount`函数返回创建所有账户的指令。这里的`createAccount`函数是`spl-token`库中的一个辅助函数，它提交一个具有两个指令的交易。第一个创建账户，第二个将账户初始化为Token账户。

与创建Token铸造厂类似，如果我们需要手动构建`createAccount`的交易，我们可以复制函数在底层所做的操作：
1. 使用`getMint`检索与`mint`关联的数据
2. 使用`getAccountLenForMint`计算所需的Token账户空间
3. 使用`getMinimumBalanceForRentExemption`计算租金豁免所需的lamports
4. 使用`SystemProgram.createAccount`和`createInitializeAccountInstruction`创建新的交易。请注意，此`createAccount`来自`@solana/web3.js`，并用于创建一个通用的新账户。`createInitializeAccountInstruction`使用此新账户初始化新Token账户。

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateTokenAccountTransaction(
  connection: web3.Connection,
  payer: web3.PublicKey,
  mint: web3.PublicKey
): Promise<web3.Transaction> {
  const mintState = await token.getMint(connection, mint)
  const accountKeypair = await web3.Keypair.generate()
  const space = token.getAccountLenForMint(mintState);
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  const programId = token.TOKEN_PROGRAM_ID

  const transaction = new web3.Transaction().add(
    web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: accountKeypair.publicKey,
      space,
      lamports,
      programId,
    }),
    token.createInitializeAccountInstruction(
      accountKeypair.publicKey,
      mint,
      payer,
      programId
    )
  );

  return transaction
}
```

### 关联的Token账户（Associated Token Account）
关联Token账户是使用所有者的公钥和Token铸造厂派生出的Token账户。关联Token账户提供了一种确定性的方法，用于找到特定所有者在特定代币铸造厂中所拥有的Token账户。

大多数情况下，您创建Token账户时，您希望它是关联Token账户。

- 如果没有关联Token账户，用户可能拥有属于同一铸造厂的许多Token账户，导致不知道将代币发送到哪里。
- 关联Token账户允许用户向另一个用户发送代币，即使接收者尚未拥有该代币铸造厂的Token账户。

![ATAs are PDAs](../assets/atas-are-pdas.svg)

与上述类似，您可以使用`spl-token`库的`createAssociatedTokenAccount`函数创建关联Token账户。

```tsx
const associatedTokenAccount = await createAssociatedTokenAccount(
  connection,
	payer,
	mint,
	owner,
);
```

此函数返回新关联Token账户的公钥，并需要以下参数：
- connection - 连接到集群的JSON-RPC连接
- payer - 支付交易费的账户
- mint - 与Token账户关联的Token铸造厂
- owner - Token账户的所有者账户

您还可以使用`getOrCreateAssociatedTokenAccount`来获取与给定地址关联的Token账户，如果不存在则创建它。例如，如果您要编写代码向给定用户空投代币，您可能会使用此函数来确保给定用户关联的Token账户不存在时创建它，并且交易付款人将扣除所需的账户创建的lamports。
在底层，`createAssociatedTokenAccount`做了以下两件事：
1. 使用`getAssociatedTokenAddress`从`mint`和`owner`派生关联Token账户地址
2. 使用`createAssociatedTokenAccountInstruction`的指令构建交易

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateAssociatedTokenAccountTransaction(
  payer: web3.PublicKey,
  mint: web3.PublicKey
): Promise<web3.Transaction> {
  const associatedTokenAddress = await token.getAssociatedTokenAddress(mint, payer, false);

  const transaction = new web3.Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      payer,
      associatedTokenAddress,
      payer,
      mint
    )
  )

  return transaction
}
```

## 铸造代币

铸造代币是将新代币发行到流通环节的过程。当您铸造代币时，您增加了Token铸造厂的供应，并将新铸造的代币存入Token账户。只有Token铸造厂的铸造者被允许铸造新代币。

要使用`spl-token`库铸造代币，您可以使用`mintTo`函数。

```tsx
const transactionSignature = await mintTo(
  connection,
  payer,
  mint,
  destination,
  authority,
  amount
);
```

`mintTo`函数返回一个可以在Solana Explorer上查看的`TransactionSignature`。`mintTo`函数需要以下参数：
- `connection` - 连接到集群的JSON-RPC连接
- `payer` - 支付交易费的账户
- `mint` - 与Token账户关联的Token铸造厂
- `destination` - 将代币铸造到的目标Token账户
- `authority` - 有铸造代币权限的账户
- `amount` - 铸造的代币精确到小数的数量，例如 如果 Scrooge Coin 铸币厂的小数属性设置为 2，那么要获得 1 个完整的 Scrooge Coin，您需要将此属性设置为 100

token铸造后更新Token铸造厂的铸造者为null是很常见的，这样一来设置了最大供应量，并确保将来无法铸造任何代币。相反，铸造权限可以授予给程序，因此代币可以定期或根据可编程条件自动铸造。

在底层，`mintTo`函数只是创建了一个从`createMintToInstruction`函数获取的指令的交易。

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildMintToTransaction(
  authority: web3.PublicKey,
  mint: web3.PublicKey,
  amount: number,
  destination: web3.PublicKey
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authority,
      amount
    )
  )

  return transaction
}
```

## 转移代币
SPL-Token转移需要发送方和接收方都拥有要转移的代币铸造厂的Token账户。代币从发送方的Token账户转移到接收方的Token账户。

当获取接收方的关联Token账户以确保其在转移前存在时，您可以使用`getOrCreateAssociatedTokenAccount`。只需记住，如果账户尚不存在，则此函数将创建它，交易付款人将扣除所需的账户创建的lamports。

一旦您知道接收方的Token账户地址，您就可以使用`spl-token`库的`transfer`函数转移代币。

```tsx
const transactionSignature = await transfer(
  connection,
  payer,
  source,
  destination,
  owner,
  amount
)
```

`transfer`函数返回一个可以在Solana Explorer上查看的`TransactionSignature`。`transfer`函数需要以下参数：
+ `connection` - 连接到集群的JSON-RPC连接
+ `payer` - 支付交易费的账户
+ `source` - 发送代币的Token账户
+ `destination` - 接收代币的Token账户
+ `owner` - `source`Token账户的所有者
+ `amount` - 要转移的代币数量

在底层，`transfer`函数只是创建一个包含从`createTransferInstruction`函数获取的指令的交易。

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildTransferTransaction(
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createTransferInstruction(
      source,
      destination,
      owner,
      amount,
    )
  )

  return transaction
}
```

## 销毁代币
销毁代币是减少给定代币铸造厂的代币供应的过程。销毁代币会将其从给定Token账户和更广泛的流通中移除。
要使用`spl-token`库销毁代币，您使用`burn`函数。

```tsx
const transactionSignature = await burn(
  connection,
  payer,
  account,
  mint,
  owner,
  amount
)
```

`burn`函数返回一个可以在Solana Explorer上查看的`TransactionSignature`。`burn`函数需要以下参数：
+ `connection` - 连接到集群的JSON-RPC连接
+ `payer` - 支付交易费的账户
+ `account` - 要从中销毁代币的Token账户
+ `mint` - 与Token账户关联的Token铸造厂

在底层，`burn`函数创建了一个包含从`createBurnInstruction`函数中获取的指令的交易。

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildBurnTransaction(
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createBurnInstruction(
      account,
      mint,
      owner,
      amount
    )
  )

  return transaction
}
```
## 批准委托

批准委托是授权一个账户从另一个代币账户转移或销毁代币的过程。当使用委托时，对代币账户的控制权仍然掌握在原始所有者手中。委托可以转移或销毁的代币数量在代币账户所有者批准委托时确定。需要注意的是，在任何给定时间，一个代币账户只能关联一个委托账户。

要使用 `spl-token` 库批准委托，您可以使用 `approve` 函数。

```tsx
const transactionSignature = await approve(
  connection,
  payer,
  account,
  delegate,
  owner,
  amount
  )
```

`approve` 函数返回一个可以在 Solana Explorer 上查看的 `TransactionSignature`。`approve` 函数需要以下参数：

- `connection` 到集群的 JSON-RPC 连接
- `payer` 支付交易费的账户
- `account` 从中委托代币的代币账户
- `delegate` 被授权转移或销毁代币的账户
- `owner` 代币账户的所有者账户
- `amount` 委托可以转移或销毁的代币的最大数量

在底层，`approve` 函数创建一个包含从 `createApproveInstruction` 函数获取的指令的交易：

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildApproveTransaction(
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.PublicKey,
  amount: number
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createApproveInstruction(
      account,
      delegate,
      owner,
      amount
    )
  )

  return transaction
}
```

## 撤销委托

可以随时撤销对代币账户的先前批准的委托。一旦撤销了委托，委托就无法再从所有者的代币账户转移代币。任何从先前批准数量中剩余未转移的代币，都无法再通过委托进行转移。

要使用 `spl-token` 库撤销委托，您可以使用 `revoke` 函数。

```tsx
const transactionSignature = await revoke(
  connection,
  payer,
  account,
  owner,
  )
```

`revoke` 函数返回一个可以在 Solana Explorer 上查看的 `TransactionSignature`。`revoke` 函数需要以下参数：

- `connection` 到集群的 JSON-RPC 连接
- `payer` 支付交易费的=账户
- `account` 撤销委托权限的代币账户
- `owner` 代币账户的所有者账户

在底层，`revoke` 函数创建一个包含从 `createRevokeInstruction` 函数获取的指令的交易：

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildRevokeTransaction(
  account: web3.PublicKey,
  owner: web3.PublicKey,
): Promise<web3.Transaction> {
  const transaction = new web3.Transaction().add(
    token.createRevokeInstruction(
      account,
      owner,
    )
  )

  return transaction
}
```
# 实验室

我们将创建一个脚本，与 Token Program 上的指令进行交互。我们将创建一个 Token Mint，创建 Token 账户，铸造代币，批准委托，转移代币和销毁代币。

### 1. 基本架构

让我们从一些基本的架构开始。你可以根据自己的喜好设置项目，但我们将使用一个简单的 TypeScript 项目，并依赖于 `@solana/web3.js` 和 `@solana/spl-token` 包。

你可以在命令行中使用命令 `npx create-solana-client [INSERT_NAME_HERE] --initialize-keypair` 克隆我们将从中开始的模板。或者你可以[手动克隆模板](https://github.com/Unboxed-Software/solana-npx-client-template/tree/with-keypair-env)。请注意，如果你直接使用 git 仓库作为起点，我们将从 `with-keypair-env` 分支开始。

然后，你需要添加对 `@solana/spl-token` 的依赖。在新创建的目录中，在命令行中使用命令 `npm install @solana/spl-token`。

### 2. 创建 Token Mint

我们将使用 `@solana/spl-token` 库，所以让我们从文件顶部导入它。

```tsx
import * as token from '@solana/spl-token'
```

接下来，声明一个新函数 `createNewMint`，带有参数 `connection`、`payer`、`mintAuthority`、`freezeAuthority` 和 `decimals`。

在函数体内
从 `@solana/spl-token` 导入 `createMint`，然后创建一个调用 `createMint` 的函数：

```tsx
async function createNewMint(
  connection: web3.Connection,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthority: web3.PublicKey,
  decimals: number
): Promise<web3.PublicKey> {

  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
  );

  return tokenMint;
}
```

完成该函数后，在 `main` 函数中调用它，将 `user` 设为 `payer`、`mintAuthority` 和 `freezeAuthority`。

创建新的 mint 后，让我们使用 `getMint` 函数获取账户数据，并将其存储在一个名为 `mintInfo` 的变量中。稍后我们将使用此数据来调整输入的 `amount`，以适应 mint 的小数精度。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);
}
```

### 3. 创建 Token 账户

现在我们已经创建了 mint，让我们创建一个新的 Token 账户，指定 `user` 为 `owner`。

`createAccount` 函数创建一个新的 Token 账户，可以指定 Token 账户的地址。请注意，如果未提供地址，则 `createAccount` 将默认使用使用 `mint` 和 `owner` 派生出的关联 token 账户。

另外，函数 `createAssociatedTokenAccount` 也会创建一个关联的 Token 账户，地址与 `mint` 和 `owner` 公钥的派生地址相同。

对于我们的演示，我们将使用 `getOrCreateAssociatedTokenAccount` 函数来创建我们的 token 账户。该函数获取 Token 账户的地址，如果存在，则使用该地址。如果不存在，则会在适当的地址创建一个新的关联 Token 账户。

```tsx
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )

  console.log(
    `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
  )

  return tokenAccount
}
```

在 `main` 函数中调用 `createTokenAccount`，传入我们在前一步创建的 mint，并将 `user` 设为 `payer` 和 `owner`。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )
}
```

### 4. 铸造代币

现在我们有了一个 token mint 和一个 token 账户，让我们铸造代币到 token 账户。请注意，只有 `mintAuthority` 可以向 token 账户铸造新的代币。回想一下，我们将 `user` 设置为我们创建的 `mint` 的 `mintAuthority`。

创建一个名为 `mintTokens` 的函数，使用 `spl-token` 函数 `mintTo` 来铸造代币：

```tsx
async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount
  )

  console.log(
    `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

在 `main` 中调用该函数，使用先前创建的 `mint` 和 `tokenAccount`。

请注意，我们必须调整输入的 `amount`，以适应 mint 的小数精度。我们的 `mint` 的代币具有 2 位小数精度。如果我们仅指定 100 作为输入的 `amount`，那么只会向我们的 token 账户铸造 1 个代币。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )
}
```
### 5. 批准委托

现在我们已经有了一个代币铸造厂和一个代币账户，让我们授权一个委托来代表我们转移代币。

创建一个名为 `approveDelegate` 的函数，使用 `spl-token` 函数 `approve` 来批准委托：

```tsx
async function approveDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
  amount: number
) {
  const transactionSignature = await token.approve(
    connection,
    payer,
    account,
    delegate,
    owner,
    amount
  )

  console.log(
    `Approve Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

在 `main` 中，让我们生成一个新的 `Keypair` 代表委托账户。然后，让我们调用我们新的 `approveDelegate` 函数，并授权委托从 `user` 代币账户转移最多 50 个代币。记得调整 `amount` 以适应 `mint` 的小数精度。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const delegate = web3.Keypair.generate();

  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )
}
```

### 6. 转移代币

接下来，让我们使用 `spl-token` 库的 `transfer` 函数转移一些我们刚刚铸造的代币。

```tsx
async function transferTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
  )

  console.log(
    `Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

在调用这个新函数之前，我们需要知道要将代币转移到哪个账户。

在 `main` 中，让我们生成一个新的 `Keypair` 作为接收方（但请记住，这只是模拟有人可以发送代币到的接收方 - 在真实应用中，您需要知道接收代币的人的钱包地址）。

然后，为接收者创建一个代币账户。最后，让我们调用我们的新 `transferTokens` 函数，将代币从 `user` 代币账户转移到 `receiver` 代币账户。我们将使用前面批准的 `delegate` 代表我们执行转移。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  const mintInfo = await token.getMint(connection, mint);

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const receiver = web3.Keypair.generate().publicKey
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )
}
```

### 7. 撤销委托

现在我们已经完成了代币的转移，让我们使用 `spl-token` 库的 `revoke` 函数撤销委托。

```tsx
async function revokeDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
) {
  const transactionSignature = await token.revoke(
    connection,
    payer,
    account,
    owner,
  )

  console.log(
    `Revote Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

Revoke 将把代币账户的委托人置空，并将委托的数量重置为 0。我们只需要代币账户和用户来完成这个函数。让我们调用我们的新 `revokeDelegate` 函数，从 `user` 代币账户中撤销委托。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const receiver = web3.Keypair.generate().publicKey
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )

  await revokeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  )
}
```

### 8. 销毁代币

最后，让我们通过销毁操作来从流通中移除一些代币。

创建一个 `burnTokens` 函数，使用 `spl-token` 库的 `burn` 函数从流通中移除一半的代币。

```tsx
async function burnTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount
  )

  console.log(
    `Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
  )
}
```

现在在 `main` 中调用这个新函数，将用户的代币中的 25 个销毁。记得调整 `amount` 以适应 `mint` 的小数精度。

```tsx
async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    user.publicKey
  )

  await mintTokens(
    connection,
    user,
    mint,
    tokenAccount.address,
    user,
    100 * 10 ** mintInfo.decimals
  )

  const receiver = web3.Keypair.generate().publicKey
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  const delegate = web3.Keypair.generate();
  await approveDelegate(
    connection,
    user,
    tokenAccount.address,
    delegate.publicKey,
    user.publicKey,
    50 * 10 ** mintInfo.decimals
  )

  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )

  await revokeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  )

  await burnTokens(
    connection, 
    user, 
    tokenAccount.address, 
    mint, user, 
    25 * 10 ** mintInfo.decimals
  )
}
```
### 9. 测试一切

完成后运行 `npm start`。您应该会在控制台中看到一系列 Solana Explorer 链接。点击它们，查看每个步骤发生了什么！您创建了一个新的代币铸造厂，创建了一个代币账户，铸造了 100 个代币，批准了一个委托，使用委托转移了 50 个代币，撤销了委托，并销毁了另外的 25 个代币。您正在成为一个代币专家。

如果您需要更多时间来熟悉这个项目，可以查看完整的[解决方案代码](https://github.com/Unboxed-Software/solana-token-client)

# 挑战

现在轮到您独立构建一些东西了。创建一个应用程序，允许用户创建新的代币铸造，创建一个代币账户，并铸造代币。

请注意，您将无法直接使用我们在实验室中介绍的辅助函数。为了使用 Phantom 钱包适配器与 Token 程序进行交互，您将需要手动构建每个交易，并将交易提交给 Phantom 进行批准。

![Token Program Challenge Frontend 的截图](../assets/token-program-frontend.png)

1. 您可以从头开始构建这个项目，或者您可以[下载起始代码](https://github.com/Unboxed-Software/solana-token-frontend/tree/starter)。
2. 在 `CreateMint` 组件中创建一个新的代币铸造。
   如果您需要回顾如何向钱包发送交易以进行批准，请查看[钱包课程](./interact-with-wallets)。
   
   在创建新的铸造时，新生成的 `Keypair` 也必须对交易进行签名。当除了连接的钱包之外需要额外的签名者时，请使用以下格式：

   ```tsx
   sendTransaction(transaction, connection, {
     signers: [Keypair],
   })
   ```
3. 在 `CreateTokenAccount` 组件中创建一个新的代币账户。
4. 在 `MintToForm` 组件中铸造代币。

如果您遇到困难，请随时参考[解决方案代码](https://github.com/ZYJLiu/solana-token-frontend)。

记住，挑战自己，在这些挑战中发挥创造力，让它们成为您自己的作品！

## 完成实验了吗？

将您的代码

推送到 GitHub，并[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=72cab3b8-984b-4b09-a341-86800167cfc7)！
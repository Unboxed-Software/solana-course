---
title: 从 Solana 网络读取数据
objectives:
- 了解帐户及其地址
- 了解 SOL 和 lamports
- 使用 web3.js 连接到 Solana 并读取帐户余额
---

## TL;DR

- **SOL** 是 Solana 原生代币的名称。每个 SOL 由 10 亿个 **Lamports** 组成。
- **账户**存储代币、NFT、程序和数据。现在我们将重点关注存储 SOL 的帐户。
- **地址**指向 Solana 网络上的帐户。任何人都可以读取给定地址中的数据。大多数地址也是**公钥**。

# 概述

## 基础术语

### 账户（Accounts）

Solana 上保存的所有数据都存储在帐户中。帐户可以存储：

- SOL
- 其他代币，如 USDC
- NFT
- 程序（Programs），比如我们将在这门课程中制作的影评程序，即具有影评功能的合约！
- 程序数据（Program data），如上述节目的影评内容，即调用合约所产生的数据，在 Solana 中，合约和合约产生的数据是分别存储在不同的账户中！

### SOL

SOL 是 Solana 的原生代币 - SOL 用于支付交易费用、支付账户租金等。SOL 有时用 `◎` 符号显示。每个 SOL 由 10 亿个 **Lamports** 组成。

与金融应用程序通常以美分（USD）、便士（GBP）进行数学计算的方式相同，Solana 应用程序通常将 SOL 作为 Lamports 进行转账、支出、存储和处理，仅转换为完整的 SOL 来显示给用户，Lamports 是 SOL 的最小单位。

### 地址（Addresses）

地址用来唯一标识帐户。地址通常显示为 base-58 编码字符串，例如 `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8` 。Solana 上的大多数地址也是**公钥**。正如上一章所提到的，谁控制了地址的匹配私钥，谁就控制了该帐户，例如，拥有私钥的人可以从该帐户发送代币。

## 从 Solana 区块链读取

### 安装

我们使用名为 `@solana/web3.js` 的 npm 包来完成与 Solana 的大部分交互。我们还将安装 TypeScript 和 `esrun`，这样我们就可以在命令行上运行 `.ts` 文件：

```bash
npm install typescript @solana/web3.js esrun 
```

### 连接到网络

使用 `@solana/web3.js` 与 Solana 网络的每次交互都将通过 `Connection` 对象进行。  `Connection` 对象与特定 Solana 网络（称为集群，`cluster`）建立连接。

现在我们将使用 `Devnet` 集群而不是 `Mainnet`。`Devnet` 是为开发人员使用和测试而设计的，`DevNet` 代币没有真正的价值。

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
console.log(`✅ Connected!`)
```

运行此 TypeScript (`npx esrun example.ts`) 将显示：

```
✅ Connected!
```

### 从网络中读取

读取账户余额：

```typescript
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);

console.log(`The balance of the account at ${address} is ${balance} lamports`); 
console.log(`✅ Finished!`)
```

如前所诉，返回的余额的单位是 *lamports*。`Web3.js` 提供了常量 `LAMPORTS_PER_SOL` 用于将 Lamports 显示为 SOL：

```typescript
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);
const balanceInSol = balance / LAMPORTS_PER_SOL;

console.log(`The balance of the account at ${address} is ${balanceInSol} SOL`); 
console.log(`✅ Finished!`)
```

运行 `npx esrun example.ts` 将显示如下内容：

```
The balance of the account at CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN is 0.00114144 SOL
✅ Finished!
```
...就像这样，我们正在从 Solana 区块链中读取数据！

# 实验

让我们练习一下所学的内容，并检查特定地址的余额。

## 加载密钥对 

回忆上一章创建的公钥。

创建一个名为 `check-balance.ts` 的新文件，写入以下代码，用您的公钥替换 `<your public key>`。

该脚本加载公钥，连接到 DevNet，并检查余额：

```typescript
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const publicKey = new PublicKey("<your public key>");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const balanceInLamports = await connection.getBalance(publicKey);

const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;

console.log(
  `💰 Finished! The balance for the wallet at address ${publicKey} is ${balanceInSOL}!`
);

```

将其保存到文件中，然后在命令行中运行：

```bash
npx esrun check-balance.ts
```

输出结果：

```
💰 Finished! The balance for the wallet at address 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 is 0!
```

## 获取 Devnet SOL

在 Devnet 中，您可以获得免费的 SOL 来进行开发。将 Devnet SOL 想象成棋盘游戏货币，它看起来有价值，但实际上没有价值。

[获取一些 Devnet SOL](https://faucet.solana.com/) 并使用您的密钥对的公钥作为地址。

选择您需要的任意 SOL 数量。

## 检查您的余额

重新运行脚本。您应该会看到您的余额已更新：

```
💰 Finished! The balance for the wallet at address 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 is 0.5!
```

## 检查其他学生的余额

您可以修改脚本来检查任何钱包上的余额。

```typescript
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const suppliedPublicKey = process.argv[2];
if (!suppliedPublicKey) {
  throw new Error("Provide a public key to check the balance of!");
}

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const publicKey = new PublicKey(suppliedPublicKey);

const balanceInLamports = await connection.getBalance(publicKey);

const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;

console.log(
  `✅ Finished! The balance for the wallet at address ${publicKey} is ${balanceInSOL}!`
);

```

在聊天中与同学交换钱包地址并查看他们的余额，在 `(some wallet address)` 中替换为您同学的钱包地址。

```
% npx esrun check-balance.ts (some wallet address)
✅ Finished! The balance for the wallet at address 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 is 3!
```

并检查您同学的一些余额。

# 挑战

修改脚本如下：

  - 添加处理无效钱包地址的指令。
  - 修改脚本以连接到 `mainNet` 并查找一些著名的 Solana 钱包。 尝试 `toly.sol` 、 `shaq.sol` 或 `mccann.sol`。

我们将在下一课中转移 SOL！

## 完成实验了吗？

将您的代码推送到 GitHub 并[告诉我们您对本课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=8bbbfd93-1cdc-4ce3-9c83-637e7aa57454)！
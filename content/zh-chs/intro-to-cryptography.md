---
title: 密码学和 Solana 网络
objectives:
- 了解对称和非对称密码学
- 解释密钥对
- 生成新的密钥对
- 从 env 文件加载密钥对
---

# TL;DR

- **密钥对**是一对匹配的**公钥**和**私钥**。
- **公钥**用作指向 Solana 网络上帐户的“地址”。公钥可以与任何人共享。
- **私钥**用于验证帐户的权限。顾名思义，您应该始终保证私钥*私密*。
- `@solana/web3.js` 提供了用于创建全新密钥对或使用现有私钥构建密钥对的辅助函数。

# 概述

## 对称和非对称密码学

“密码学”字面意思是隐藏信息的研究。您每天会遇到两种主要类型的密码学：

**对称加密**（symmetric crytography）是使用相同的密钥来加密和解密。它已有数百年历史，从古埃及人到伊丽莎白一世女王，每个人都在使用它。

对称加密算法有多种，但今天最常见的是 AES 和 Chacha20。

**非对称加密**

- 非对称加密（asymmetric crytography） - 也称为“[公钥加密](https://en.wikipedia.org/wiki/Public-key_cryptography)”，发展于 20 世纪 70 年代。 在非对称加密中，参与者拥有成对的钥匙（或**密钥对**，keypairs）。每个密钥对由一个**私钥**（secret key）和一个**公钥**（public key）组成。非对称加密的工作原理与对称加密不同，并且可以做不同的事情：

- **加密**（encryption）：如果使用公钥加密，则只能使用同一密钥对中的私钥来读取它
- **签名**（signatures）：如果使用私钥加密，则可以使用同一密钥对中的公钥来证明密钥持有者对其进行签名。
- 您甚至可以使用非对称加密来计算出对称加密技术的好密钥！这称为**密钥交换**（key exchange），您使用自己的公钥和接收者的公钥来得出“会话”密钥。
- 有多种非对称加密算法，但您今天看到的最常见的是 ECC 或 RSA 的变体。    

非对称加密非常流行：

  - 您的银行卡内有一个私钥，用于签名交易。您的银行可以通过使用匹配的公钥进行检查来确认您是否进行了交易。
  - 网站在其证书中包含公钥。您的浏览器将使用此公钥来加密发送到网页的数据（例如个人信息、登录详细信息和信用卡号码）。网站有匹配的私钥，以便网站可以读取数据。
  - 您的电子护照由签发国家签名，以确保护照不被伪造。电子护照闸门可以使用您的签发国的公钥来确认这一点。
  - 手机上的消息应用程序使用密钥交换来创建会话密钥。

简而言之，密码学就在我们身边。Solana 以及其他区块链只是密码学的一种用途。

## Solana 使用公钥作为地址

![Solana wallet addresses](../../assets/wallet-addresses.svg)

参与 Solana 网络的人至少拥有一个密钥对。在 Solana：

- **公钥**用作指向 Solana 网络上帐户（account）的“地址”（address），图中 Alice 和 Bob 的钱包地址落在 Ed25519 曲线上。即使是友好的名称 - 例如“example.sol”（.sol 域名可以参考 Solana 命名服务 [Solana Naming Service](https://www.quicknode.com/guides/solana-development/getting-started/how-to-create-a-sol-domain-using-solana-naming-service)） - 也指向“dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8”等地址，

- **私钥**用于验证该密钥对的权限。如果您拥有某个地址的私钥，您就可以控制该地址内的代币。因此，顾名思义，您应该始终保证私钥*私密*。

## 使用 @solana/web3.js 制作密钥对

您可以通过浏览器或带有 `@solana/web3.js` npm 模块的 node.js 使用 Solana 区块链。按照通常的方式创建一个项目，然后[使用`npm`](https://nodesource.com/blog/an-absolute-beginners-guide-to-using-npm/)安装 `@solana/web3.js`。

```bash
npm i @solana/web3.js
```

我们将在本课程中逐步介绍许多 [web3.js](https://docs.solana.com/developing/clients/javascript-reference)，但您也可以查看 [官方 web3.js 文档](https://docs.solana.com/developing/clients/javascript-reference)。

要发送代币、发送 NFTS 或读取和写入数据到 Solana，您需要自己的密钥对。要创建新的密钥对，请使用 `@solana/web3.js` 中的 `Keypair.generate()` 函数：

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`The public key is: `, keypair.publicKey.toBase58());
console.log(`The secret key is: `, keypair.secretKey);
```

## ⚠️ 不要在源代码中包含私钥

由于密钥对可以根据私钥重新生成，因此我们通常只存储私钥，并从私钥恢复密钥对。

此外，由于私钥赋予了地址权限，因此我们不会将私钥存储在源代码中。相反，我们：

- 将私钥放入 `.env` 文件中
- 将 `.env` 添加到 `.gitignore`，这样 `.env` 文件就不会被提交到 github 仓库。

## 加载现有的密钥对

如果您已经有想要使用的密钥对，则可以从存储在 [文件系统](https://docs.solana.com/wallet-guide/file-system-wallet) 中或 `.env` 文件中的现有私钥加载 `Keypair`。在 node.js 中，`@solana-developers/node-helpers` npm 包中包含一些额外的功能：

  - 要使用 `.env` 文件，请使用 `getKeypairFromEnvironment()`
  - 要使用 Solana CLI 文件，请使用 `getKeypairFromFile()`

```typescript
import "dotenv/config";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers";

const keypair = getKeypairFromEnvironment("SECRET_KEY");
```

您知道如何生成和载入密钥对！让我们练习一下我们所学的内容。

# 实验

## 安装

创建一个新目录，安装 TypeScript、Solana web3.js 和 esrun：

```bash
mkdir generate-keypair
cd generate-keypair
npm init -y
npm install typescript @solana/web3.js esrun @solana-developers/node-helpers
```

创建一个名为 `generate-keypair.ts` 的新文件

```typescript
import { Keypair } from "@solana/web3.js";
const keypair = Keypair.generate();
console.log(`✅ Generated keypair!`)
```

命令行中运行

```bash
npx esrun generate-keypair.ts
```

您应该看到输出：

```
✅ Generated keypair!
```

每一个 `Keypair` 有一个 `publicKey` 和 `secretKey` 属性。更新 `generate-keypair.ts` 文件

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`The public key is: `, keypair.publicKey.toBase58());
console.log(`The secret key is: `, keypair.secretKey);
console.log(`✅ Finished!`);
```

命令行中运行

```bash
npx esrun generate-keypair.ts
```

您应该看到输出，其中 `public key` 与文中输出会不一致：

```
The public key is:  764CksEAZvm7C1mg2uFmpeFvifxwgjqxj2bH6Ps7La4F
The secret key is:  Uint8Array(64) [
  (a long series of numbers) 
]
✅ Finished!
```

## 从 .env 文件加载现有的密钥对

为了确保您的私钥安全，我们建议使用 `.env` 文件存储私钥：

创建一个名为 `.env` 的新文件，将前面 `secret key` 输出的内容，写入到 `.env` 文件中：

```env
SECRET_KEY="[(a series of numbers)]"
```

然后我们可以从环境中加载密钥对。更新 `generate-keypair.ts`：

```typescript
import "dotenv/config"
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers";

const keypair = getKeypairFromEnvironment("SECRET_KEY");

console.log(
  `✅ Finished! We've loaded our secret key securely, using an env file!`
);
```

命令行中运行

```bash
npx esrun generate-keypair.ts
```

您应该看到输出：

```text
✅ Finished! We've loaded our secret key securely, using an env file!
```

我们现在已经了解了密钥对，以及如何在 Solana 上安全地存储私钥。 在下一章中，我们将使用它们！


## 完成实验了吗？

将您的代码推送到 GitHub 并[告诉我们您对本课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=ee06a213-5d74-4954-846e-cba883bc6db1)！
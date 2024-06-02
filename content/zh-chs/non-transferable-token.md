---
title: 不可转让的代币
objectives:
  - 创建不可转让代币
  - 铸造不可转让代币
  - 尝试转移不可转让代币
---

# 摘要

- 在原始代币方案中，创建不可转让（有时称为“灵魂绑定”）代币是不可能的
- 代币扩展方案的`不可转让代币`使不可转让代币成为可能

## 概述

在代币方案中，创建无法转移的代币是不可能的。尽管这可能看起来不重要，但有几个原因可能希望发行不可转让（或“灵魂绑定”）代币。

举个例子：假设您是Solana游戏开发者，您的新游戏“Bits and Bytes”希望向玩家授予成就。成就是不可转让的，并且您希望他们的辛勤工作可以自豪地显示在他们的钱包中。解决方案是向他们发送一个不可转让的NFT。但是，在代币方案中，这是不可能的。但是，在代币扩展方案中是可能的！欢迎来到`不可转让`扩展。

代币扩展方案具有`不可转让`扩展，可用于创建不可转让的铸造。这些铸造可以被销毁，但无法转移。

## 创建不可转让铸造账户

初始化不可转让铸造涉及三个指令：

- `SystemProgram.createAccount`
- `createInitializeNonTransferableMintInstruction`
- `createInitializeMintInstruction`

第一条指令`SystemProgram.createAccount`在区块链上为铸币账户分配空间。此指令完成三件事：

- 分配`空间`
- 转移`租金`以支付租金
- 将其自身分配给它拥有的程序

与所有其他扩展一样，您需要计算所需的铸币账户的空间和租金。您可以通过调用`getMintLen`和`getMinimumBalanceForRentExemption`来实现。

第二条指令`createInitializeNonTransferableMintInstruction`初始化了不可转让扩展。

第三条指令`createInitializeMintInstruction`初始化了铸造。

最后，将所有指令添加到交易中并发送到Solana。

# 实验

在本实验中，我们将创建一个不可转让的代币，然后看看在尝试转移它时会发生什么（提示：转移将失败）。

### 1. 入门

要开始，创建一个名为`non-transferable-token`的空目录并进入它。我们将初始化一个全新的项目。运行`npm init`并按照提示进行操作。

接下来，我们需要添加依赖项。运行以下命令以安装所需的软件包：

```bash
npm i @solana-developers/helpers @solana/spl-token @solana/web3.js esrun dotenv typescript
```

创建一个名为`src`的目录。在这个目录中，创建一个名为`index.ts`的文件。这是我们将运行检查的地方。将以下代码粘贴到`index.ts`中：

```ts
import { Connection, Keypair } from '@solana/web3.js'
import { initializeKeypair } from '@solana-developers/helpers'
import dotenv from 'dotenv'
import { createAccount, mintTo, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
// import { createNonTransferableMint } from './create-mint';
dotenv.config();

/**
 * Create a connection and initialize a keypair if one doesn't already exists.
 * If a keypair exists, airdrop a sol if needed.
 */
const connection = new Connection("http://127.0.0.1:8899", "confirmed")
const payer = await initializeKeypair(connection)

console.log(`public key: ${payer.publicKey.toBase58()}`)

const mintKeypair = Keypair.generate()
const mint = mintKeypair.publicKey
console.log(
	'\nmint public key: ' + mintKeypair.publicKey.toBase58() + '\n\n'
)

// CREATE MINT

// CREATE SOURCE ACCOUNT AND MINT TOKEN

// CREATE DESTINATION ACCOUNT FOR TRANSFER

// TRY TRANSFER
```

这个文件中有一个主要功能，创建了一个连接到指定验证节点的连接，并调用`initializeKeypair`。一旦我们编写了脚本的其余部分，这个主要功能就是我们最终将调用的地方。

开始运行脚本。您应该看到`mint`的公钥在终端中打印出来。

```bash
esrun src/index.ts
```

如果在`initializeKeypair`中出现空投错误，请按照下一步操作。

### 2. 设置开发环境（可选）

如果在空投devnet SOL时遇到问题。您可以：

1. 向`initializeKeypair`添加`keypairPath`参数，并从[Solana的水龙头](https://faucet.solana.com/)获取一些devnet SOL。
2. 运行本地验证者，步骤如下：

在另一个终端中，运行以下命令：`solana-test-validator`。这将运行节点并将一些键和值记录下来。我们需要检索并在我们的连接中使用的值是JSON RPC URL，即`http://127.0.0.1:8899`。然后我们在连接中使用它以指定使用本地RPC URL。

```tsx
const connection = new Connection("http://127.0.0.1:8899", 'confirmed');
```

### 3. 创建不可转让铸造



Let's create the function `createNonTransferableMint` in a new file `src/create-mint.ts`.

在文件中创建函数`createNonTransferableMint`，并添加以下参数：

- `connection`：连接对象
- `payer`：交易的支付者
- `mintKeypair`：新币的密钥对
- `decimals`：币的小数点位数

在该函数内，我们会调用以下函数：

- `getMintLen` - 获取币账户所需的空间
- `getMinimumBalanceForRentExemption` - 获取币账户所需的兰博数额
- `createAccount` - 在区块链上为币账户分配空间
- `createInitializeNonTransferableMintInstruction` - 初始化扩展
- `createInitializeMintInstruction` - 初始化币
- `sendAndConfirmTransaction` - 将交易发送到区块链

```tsx
import {
  sendAndConfirmTransaction,
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from '@solana/web3.js'

import {
  ExtensionType,
  createInitializeMintInstruction,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
  createInitializeNonTransferableMintInstruction,
} from '@solana/spl-token'

export async function createNonTransferableMint(
  connection: Connection,
  payer: Keypair,
  mintKeypair: Keypair,
  decimals: number
): Promise<TransactionSignature> {
  const extensions = [ExtensionType.NonTransferable]
  const mintLength = getMintLen(extensions)

  const mintLamports =
    await connection.getMinimumBalanceForRentExemption(mintLength)

  console.log('使用不可转移指令创建交易...')
  const mintTransaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: mintLength,
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeNonTransferableMintInstruction(
      mintKeypair.publicKey,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  )

  const signature = await sendAndConfirmTransaction(
    connection,
    mintTransaction,
    [payer, mintKeypair],
    { commitment: 'finalized' }
  )

  return signature
}
```

现在在`src/index.ts`中调用该函数以创建不可转移的币：

```tsx
// 创建币
const decimals = 9

await createNonTransferableMint(
  connection,
  payer,
  mintKeypair,
  decimals
)
```

脚本应无错误运行：

```bash
esrun src/index.ts
```

不可转移的币已正确设置，并将在运行`npm start`时创建。接下来我们继续下一步，创建一个源账户并铸造一个币到其中。

### 4. 铸造币

让我们测试一下，实际上不能转移从该币创建的代币。为此，我们需要对一个账户铸币。

在`src/index.ts`中进行操作。我们将创建一个源账户，并铸造一个不可转移的币。

可以通过以下两个函数来实现：
- `getOrCreateAssociatedTokenAccount`：来自`@solana/spl-token`库，此函数为给定的币和所有者创建关联代币账户（ATA）。
- `mintTo`：此函数将向给定的代币账户铸造`amount`个代币。

```tsx
// 创建支付者ATA和铸币
console.log('创建一个关联代币账户...')
const ata = (await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey,
  undefined,
  undefined,
  undefined,
  TOKEN_2022_PROGRAM_ID
)).address;

console.log('铸造1个代币...')

const amount = 1 * 10 ** decimals;
await mintTo(
  connection,
  payer,
  mint,
  ata,
  payer,
  amount,
  [payer],
  { commitment: 'finalized' },
  TOKEN_2022_PROGRAM_ID
);
const tokenBalance = await connection.getTokenAccountBalance(ata, 'finalized');

console.log(`账户 ${ata.toBase58()} 现在有 ${tokenBalance.value.uiAmount} 代币.`);
```

运行脚本并确认一个代币已被铸造到一个账户：

```bash
esrun src/index.ts
```

### 5. 尝试转移不可转移的币

最后，让我们尝试实际上将代币转移到其他地方。首先，我们需要创建一个用来转移的代币账户，然后我们想尝试转移。

在`src/index.ts`中，我们将创建一个目标账户，并尝试将不可转移的代币转移到此账户。

我们可以通过以下两个函数来实现：
- `createAccount`：此函数将为给定的币和账户的密钥对创建一个代币账户。因此，我们不是在此处使用ATA，而是生成一个新的密钥对作为代币账户。我们这样做只是为了展示不同的账户选项。
- `transferChecked`：将尝试转移代币。

首先是`createAccount`函数：

```tsx
// 为转移创建目标账户
console.log('创建一个目标账户...\n\n')
const destinationKeypair = Keypair.generate()
const destinationAccount = await createAccount(
  connection,
  payer,
  mintKeypair.publicKey,
  destinationKeypair.publicKey,
  undefined,
  { commitment: 'finalized' },
  TOKEN_2022_PROGRAM_ID
)
```

现在是`transferChecked`函数：

```tsx
// TRY TRANSFER
console.log('Attempting to transfer non-transferable mint...')
try {
  const signature = await transferChecked(
    connection,
    payer,
    ata,
    mint,
    destinationAccount,
    ata,
    amount,
    decimals,
    [destinationKeypair],
    { commitment: 'finalized' },
    TOKEN_2022_PROGRAM_ID
  )

} catch (e) {
  console.log(
    'This transfer is failing because the mint is non-transferable. Check out the program logs: ',
    (e as any).logs,
    '\n\n'
  )
}
```

Now let's run everything and see what happens:

```
esrun src/index.ts
```

现在让我们运行一切，看看会发生什么：

```bash
esrun src/index.ts
```

你应该在最后得到一个错误消息，提示“此代币的转让已禁用”。这表明我们试图转让的代币实际上是不可转让的！

```bash
Attempting to transfer non-transferable mint...
This transfer is failing because the mint is non-transferable. Check out the program logs:  [
  'Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]',
  'Program log: Instruction: TransferChecked',
  'Program log: Transfer is disabled for this mint',
  'Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb consumed 3910 of 200000 compute units',
  'Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb failed: custom program error: 0x25'
] 
```


就是这样！我们成功地创建了一个不可转让的代币。如果你在任何时候卡住了，可以在 [此仓库的`solution`分支](https://github.com/Unboxed-Software/solana-lab-non-transferable-token/tree/solution) 找到可用的代码。

# 挑战

对于挑战，创建一个带有元数据扩展的自己的不可转让代币，并将“灵魂绑定”NFT 保留给自己。

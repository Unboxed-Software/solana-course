---
title: 版本化的交易和查找表
objectives:
- 创建版本化的交易
- 创建查找表
- 扩展查找表
- 使用查找表进行版本化的交易
---
# 总结

-   **版本化的交易** 是支持旧版本和新版本交易格式的一种方式。原始交易格式是“legacy”，新的交易版本从版本 0 开始。实现版本化的交易是为了支持地址查找表（也称为查找表或 LUTs）的使用。
-   **地址查找表** 是用于存储其他账户地址的账户，然后可以在版本化的交易中使用 1 字节索引而不是每个地址的完整 32 字节来引用这些地址。这使得可以创建比引入 LUTs 之前更复杂的交易。

# 课程

根据设计，Solana 交易限制为 1232 字节。超过此大小的交易将失败。虽然这可以实现一些网络优化，但同时也限制了可以在网络上执行的原子操作类型。

为了规避交易大小的限制，Solana 发布了一种新的交易格式，该格式允许支持多个交易格式版本。目前，Solana 支持两个交易版本：

1. `legacy` - 原始交易格式
2. `0` - 包含对地址查找表的支持的最新交易格式

版本化的交易不需要对现有的 Solana 程序进行任何修改，但在版本化的交易发布之前创建的任何客户端代码都需要进行更新。在本课程中，我们将探讨版本化的交易的基础知识以及如何使用它们，包括：

-   创建版本化的交易
-   创建和管理查找表
-   在版本化的交易中使用查找表

## 版本化的交易

Solana 交易中占据最多空间的内容之一是包含完整账户地址。每个地址占用 32 字节，39 个账户将使交易过大。这甚至没有考虑指令数据。实际上，大部分交易使用大约 20 个账户就会超出大小限制。

Solana 发布了版本化的交易来支持多个交易格式。在发布版本化的交易的同时，Solana 发布了版本 0 来支持地址查找表。查找表是单独的账户，用于存储账户地址，然后允许在交易中使用 1 字节索引来引用这些地址。这极大地减少了交易的大小，因为每个包含的账户现在只需要使用 1 字节而不是 32 字节。

即使您不需要使用查找表，您也需要了解如何在客户端代码中支持版本化的交易。幸运的是，一切您需要处理版本化的交易和查找表的东西都包含在 `@solana/web3.js` 库中。

### 创建版本化的交易

要创建版本化的交易，只需使用以下参数创建`TransactionMessage`：

-   `payerKey` - 将支付交易费用的账户的公钥
-   `recentBlockhash` - 网络中的最近的区块哈希
-   `instructions` - 要包含在交易中的指令

然后，使用 `compileToV0Message()` 方法将该消息对象转换为版本`0`交易。

```typescript
import * as web3 from "@solana/web3.js";

// 示范转账指令
const transferInstruction = [
    web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey, // 将发送资金的账户的公钥
        toPubkey: toAccount.publicKey, // 将接收资金的账户的公钥
        lamports: 1 * LAMPORTS_PER_SOL, // 要转账的 lamports 数量
    }),
];

// 获取最新的区块哈希
let { blockhash } = await connection.getLatestBlockhash();

// 创建交易消息
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // 将支付交易费用的账户的公钥
    recentBlockhash: blockhash, // 最新的区块哈希
    instructions: transferInstruction, // 包含在交易中的指令
}).compileToV0Message();
```

最后，将编译后的消息传递到`VersionedTransaction`构造函数中以创建新的版本化的交易。然后可以对代码对交易进行签名并将其发送到网络，类似于传统的交易。

```typescript
// 使用消息创建版本化的交易
const transaction = new web3.VersionedTransaction(message);

// 对交易进行签名
transaction.sign([payer]);

// 将已签名的交易发送到网络
const transactionSignature = await connection.sendTransaction(transaction);
```

## 地址查找表

地址查找表（也称为查找表或 LUTs）是用于存储其他账户地址的账户，这些 LUT 账户由地址查找表程序拥有，并且用于增加可以在单个交易中包含的账户数量。

版本化的交易可以包含 LUT 账户的地址，然后使用 1 字节索引引用其他账户，而不是将这些账户的完整地址包含在其中。这大大减少了交易中用于引用账户的空间。

为了简化与 LUTs 的工作过程，`@solana/web3.js` 库包含一个`AddressLookupTableProgram`类，该类提供了一组方法以创建管理 LUTs 的指令。这些方法包括：

-   `createLookupTable` - 创建一个新的 LUT 账户
-   `freezeLookupTable` - 使现有 LUT 不可变
-   `extendLookupTable` - 向现有 LUT 添加地址
-   `deactivateLookupTable` - 将 LUT 放入“停用”周期，然后才能关闭
-   `closeLookupTable` - 永久关闭 LUT 账户

### 创建查找表

使用`createLookupTable`方法构造创建查找表的指令。该函数需要以下参数：

-   `authority` - 将有权限修改查找表的账户
-   `payer` - 将支付账户创建费用的账户
-   `recentSlot` - 用于派生查找表地址的最近槽

该函数返回创建查找表及查找表地址的指令。

```typescript
// 获取当前槽位
const slot = await connection.getSlot();

// 创建一个用于创建查找表的指令
// 并检索新查找表的地址
const [lookupTableInst, lookupTableAddress] =
    web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // 权限（即可以修改查找表的账户）
        payer: user.publicKey, // 付款方（即将支付交易费用的账户）
        recentSlot: slot - 1, // 用于派生查找表地址的最近槽
    });
```

在底层，查找表地址实际上是使用`authority`和`recentSlot`作为种子派生的 PDA。



```typescript
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

请注意，在使用最新槽时，有时在发送交易后会出现错误。为了避免这种情况，您可以使用比最新槽早一槽的槽（例如 `recentSlot: slot - 1`）。但是，如果在发送交易时仍然遇到错误，您可以尝试重新发送交易。

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"188115589 is not a recent slot",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### 扩展查找表

您可以使用 `extendLookupTable` 方法创建一个添加地址到现有查找表的指令。它需要以下参数：

-   `payer` - 将支付交易费用和任何增加的租金的账户
-   `authority` - 具有更改查找表权限的账户
-   `lookupTable` - 要扩展的查找表的地址
-   `addresses` - 要添加到查找表的地址

该函数返回一个扩展查找表的指令。

```typescript
const addresses = [
    new web3.PublicKey("31Jy3nFeb5hKVdB4GS4Y7MhU7zhNMFxwF7RGVhPc1TzR"),
    new web3.PublicKey("HKSeapcvwJ7ri6mf3HwBtspLFTDKqaJrMsozdfXfg5y2"),
    // 添加更多地址
];

// 创建一个扩展查找表的指令，用提供的地址
const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
    payer: user.publicKey, // 付款人（即支付交易费用的账户）
    authority: user.publicKey, // 授权人（即具有修改查找表权限的账户）
    lookupTable: lookupTableAddress, // 要扩展的查找表的地址
    addresses: addresses, // 要添加到查找表的地址
});
```

请注意，在扩展查找表时，每次添加的地址数量受到交易大小限制的限制，该限制为1232字节。这意味着您一次可以向查找表中添加30个地址。如果需要添加更多地址，您需要发送多个交易。每个查找表最多可以存储256个地址。

### 发送交易

创建指令后，您可以将它们添加到一个交易中并发送到网络。

```typescript
// 获取最新的区块哈希
const { blockhash } = await connection.getLatestBlockhash();

// 创建交易消息
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // 将支付交易的账户的公钥
    recentBlockhash: blockhash, // 最新的区块哈希
    instructions: [lookupTableInst, extendInstruction], // 包含在交易中的指令
}).compileToV0Message();

// 使用消息创建版本化交易
const transaction = new web3.VersionedTransaction(message);

// 签署交易
transaction.sign([payer]);

// 将已签名的交易发送到网络
const transactionSignature = await connection.sendTransaction(transaction);
```

请注意，当您首次创建或扩展查找表时，需要在LUT或新地址可以在交易中使用之前的一个槽中“预热”一次。换句话说，您只能使用在当前槽之前添加的查找表和访问地址。

```typescript
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

如果您遇到上述错误或在扩展查找表后无法立即访问查找表中的地址，很可能是因为您试图在预热期结束之前访问查找表或特定地址。为避免此问题，在扩展查找表后发送引用该表的交易之前，请添加延迟。

### 停用查找表

当不再需要查找表时，您可以停用并关闭它以回收其租金余额。地址查找表可以随时停用，但它们可以继续被交易使用，直到指定的“停用”槽不再是“最近”的为止。这个“冷却”期确保了正在飞行中的交易不会被在同一个槽中关闭和重新创建的LUT所审查。停用期大约为513个槽。

要停用LUT，请使用 `deactivateLookupTable` 方法并传入以下参数：

-   `lookupTable` - 要停用的LUT的地址
-   `authority` - 具有停用LUT权限的账户

```typescript
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress, // 要停用的查找表的地址
        authority: user.publicKey, // 授权人（即具有修改查找表权限的账户）
    });
```

### 关闭查找表

在其停用期结束后关闭查找表时，请使用 `closeLookupTable` 方法。此方法创建一个指令来关闭停用的查找表并回收其租金余额。它需要以下参数：

-   `lookupTable` - 要关闭的查找表的地址
-   `authority` - 具有关闭LUT权限的账户
-   `recipient` - 将接收回收租金余额的账户

```typescript
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress, // 要关闭的查找表的地址
    authority: user.publicKey, // 授权人（即具有修改查找表权限的账户）
    recipient: user.publicKey, // 已关闭账户的接收方的公钥
});
```

在其完全停用之前尝试关闭查找表将导致错误。

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Table cannot be closed until it's fully deactivated in 513 blocks",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### 冻结查找表

除了标准的CRUD操作，您还可以对查找表进行“冻结”。这会使其不可变，无法再被扩展、停用或关闭。

您可以使用 `freezeLookupTable` 方法来冻结查找表。它需要以下参数：

-   `lookupTable` - 要冻结的LUT的地址
-   `authority` - 具有冻结LUT权限的账户



```typescript
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // 要冻结的查找表的地址
    authority: user.publicKey, // 权限（即有权修改查找表的账户）
});
```

一旦LUT被冻结，任何进一步修改将导致错误。

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"查找表已冻结",
"Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### 在版本化交易中使用查找表

要在版本化交易中使用查找表，需要使用其地址检索查找表账户。

```typescript
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

然后可以创建常见的交易指令列表。 创建 `TransactionMessage` 时，可以将任何查找表账户作为数组传递给 `compileToV0Message()` 方法。 也可以提供多个查找表账户。

```typescript
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // 付款人（即支付交易费用的账户）
    recentBlockhash: blockhash, // 最新区块的区块哈希
    instructions: instructions, // 要包含在交易中的指令
}).compileToV0Message([lookupTableAccount]); // 包含查找表账户

// 使用消息创建版本化交易
const transaction = new web3.VersionedTransaction(message);

// 对交易进行签名
transaction.sign([payer]);

// 将签名的交易发送到网络
const transactionSignature = await connection.sendTransaction(transaction);
```

# 实验

让我们继续进行查找表的使用实践！

此实验将指导您完成创建、扩展和使用版本化交易中的查找表的步骤。

### 1. 获取起始代码

首先，从此 [存储库](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/starter) 的 starter 分支下载起始代码。下载起始代码后，在终端中运行 `npm install` 以安装所需的依赖项。

起始代码包括创建一个意图原子地向 22 个受益者转移 SOL 的传统交易的示例。 事务包含 22 条指令，其中每个指令将 SOL 从签名者转移给不同的接收者。

起始代码的目的是说明传统事务中可包含地址数量的限制。 在本示例中，构建的事务在发送时预计将失败。

在 `index.ts` 文件中可找到以下起始代码。

```typescript
import { initializeKeypair } from "./initializeKeypair";
import * as web3 from "@solana/web3.js";

async function main() {
    // 连接到开发网集群
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // 初始化用户的密钥对
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // 生成 22 个地址
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    // 创建一组转账指令
    const transferInstructions = [];

    // 为每个地址添加转账指令
    for (const address of recipients) {
        transferInstructions.push(
            web3.SystemProgram.transfer({
                fromPubkey: user.publicKey, // 付款人（即支付交易费用的账户）
                toPubkey: address, // 转账的目标账户
                lamports: web3.LAMPORTS_PER_SOL * 0.01, // 要转移的 lamports 数量
            }),
        );
    }

    // 创建交易并添加转账指令
    const transaction = new web3.Transaction().add(...transferInstructions);

    // 将交易发送到集群（在此示例中如果地址 > 21 将失败）
    const txid = await connection.sendTransaction(transaction, [user]);

    // 获取最新的区块哈希和上一个有效区块高度
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // 确认交易
    await connection.confirmTransaction({
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        signature: txid,
    });

    // 记录在 Solana Explorer 上的事务 URL
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

要执行此代码，请运行 `npm start`。 这将创建一个新的密钥对，并将其写入 `.env` 文件中，向开发网下发 SOL 到密钥对，并发送起始代码中构建的交易。 预计当地址 > 21 时，交易将失败，并显示错误消息 `Transaction too large`。

```
Creating .env file
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: 5ZZzcDbabFHmoZU8vm3VzRzN5sSQhkf91VJzHAJGNM7B
Error: Transaction too large: 1244 > 1232
```

接下来，在接下来的步骤中，我们将介绍如何使用查找表和版本化交易以增加单个交易中可以包含的地址数量。

在开始之前，继续删除 `main` 函数的内容，只留下以下内容：

```typescript
async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const addresses = [];
    for (let i = 0; i < 22; i++) {
        addresses.push(web3.Keypair.generate().publicKey);
    }
}
```

### 2. Create a `sendV0Transaction` helper function
我们将发送多个“版本 0”交易，因此让我们创建一个辅助函数来简化此过程。

该函数应接受连接、用户的密钥对、交易指令数组以及可选的查找表账户数组作为参数。

然后该函数执行以下任务：

-  从索拉纳网络中检索最新的块哈希和最后一个有效的块高度
-  使用提供的指令创建一个新的交易消息
-  使用用户的密钥对对交易进行签名
-  将交易发送到索拉纳网络
-  确认交易
-  在索拉纳浏览器上记录交易的 URL 地址

```typescript
async function sendV0Transaction(
    connection: web3.Connection,
    user: web3.Keypair,
    instructions: web3.TransactionInstruction[],
    lookupTableAccounts?: web3.AddressLookupTableAccount[],
) {
    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Create a new transaction message with the provided instructions
    const messageV0 = new web3.TransactionMessage({
        payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentBlockhash: blockhash, // The blockhash of the most recent block
        instructions, // The instructions to include in the transaction
    }).compileToV0Message(
        lookupTableAccounts ? lookupTableAccounts : undefined,
    );

    // Create a new transaction object with the message
    const transaction = new web3.VersionedTransaction(messageV0);

    // Sign the transaction with the user's keypair
    transaction.sign([user]);

    // Send the transaction to the cluster
    const txid = await connection.sendTransaction(transaction);

    // Confirm the transaction
    await connection.confirmTransaction(
        {
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            signature: txid,
        },
        "finalized",
    );

    // Log the transaction URL on the Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

### 3. Create a `waitForNewBlock` helper function

请记住，查找表及其中包含的地址在创建或扩展后无法立即引用。这意味着我们需要等待一个新区块才能提交引用新创建或扩展的查找表的交易。为了简化未来的操作，让我们创建一个名为`waitForNewBlock`的辅助函数，用于在发送交易之间等待查找表激活。

该函数将接受连接和目标区块高度作为参数。然后，它会启动一个间隔，每1000毫秒检查网络的当前区块高度。一旦新的区块高度超过目标高度，间隔就会被清除，并且承诺会被解决。
```typescript
function waitForNewBlock(connection: web3.Connection, targetHeight: number) {
    console.log(`Waiting for ${targetHeight} new blocks`);
    return new Promise(async (resolve: any) => {
        // Get the last valid block height of the blockchain
        const { lastValidBlockHeight } = await connection.getLatestBlockhash();

        // Set an interval to check for new blocks every 1000ms
        const intervalId = setInterval(async () => {
            // Get the new valid block height
            const { lastValidBlockHeight: newValidBlockHeight } =
                await connection.getLatestBlockhash();
            // console.log(newValidBlockHeight)

            // Check if the new valid block height is greater than the target block height
            if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
                // If the target block height is reached, clear the interval and resolve the promise
                clearInterval(intervalId);
                resolve();
            }
        }, 1000);
    });
}
```

### 4. Create an `initializeLookupTable` function
现在我们已经准备好一些辅助函数，声明一个名为`initializeLookupTable`的函数。该函数拥有参数`user`，`connection`和`addresses`。该函数将：

1. 检索当前插槽
2. 生成一个创建查找表的指令
3. 生成一个用提供的地址扩展查找表的指令
4. 通过包含创建和扩展查找表指令的交易进行发送和确认
5. 返回查找表的地址

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());

    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    return lookupTableAddress;
}
```



### 5. 修改 `main` 以使用查找表

现在我们可以使用所有接收者地址初始化查找表，让我们更新 `main` 来使用版本化的交易和查找表。我们需要：

1. 调用 `initializeLookupTable`
2. 调用 `waitForNewBlock`
3. 使用 `connection.getAddressLookupTable` 获取查找表
4. 为每个接收者创建转账指令
5. 发送 v0 版本的交易带有所有的转账指令

```typescript
async function main() {
    // 连接到 devnet 集群
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // 初始化用户的密钥对
    const user = await initializeKeypair(connection);
    console.log("公钥:", user.publicKey.toString());

    // 生成 22 个地址
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    const lookupTableAddress = await initializeLookupTable(
        user,
        connection,
        recipients,
    );

    await waitForNewBlock(connection, 1);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    if (!lookupTableAccount) {
        throw new Error("查找表未找到");
    }

    const transferInstructions = recipients.map((recipient) => {
        return web3.SystemProgram.transfer({
            fromPubkey: user.publicKey, // 付款人（即，支付交易费用的账户）
            toPubkey: recipient, // 转账的目标账户
            lamports: web3.LAMPORTS_PER_SOL * 0.01, // 要转账的 lamports 数量
        });
    });

    await sendV0Transaction(connection, user, transferInstructions, [
        lookupTableAccount,
    ]);
}
```

注意，即使我们创建了查找表，你还是使用了完整的接收者地址创建了转账指令。这是因为通过将查找表包含在版本化交易中，你告诉了 `web3.js` 框架，如果有与查找表中地址匹配的地址，就用查找表的指针代替完整的 32 字节地址。当交易被发送到网络时，在查找表中存在的地址会被单个字节引用，而不是完整的 32 字节地址。

在命令行中使用 `npm start` 来执行 `main` 函数。你应该会看到类似以下的输出：

```bash
Current balance is 1.38866636
PublicKey: 8iGVBt3dcJdp9KfyTRcKuHY6gXCMFdnSG2F1pAwsUTMX
lookup table address: Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M
https://explorer.solana.com/tx/4JvCo2azy2u8XK2pU8AnJiHAucKTrZ6QX7EEHVuNSED8B5A8t9GqY5CP9xB8fZpTNuR7tbUcnj2MiL41xRJnLGzV?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/rgpmxGU4QaAXw9eyqfMUqv8Lp6LHTuTyjQqDXpeFcu1ijQMmCH2V3Sb54x2wWAbnWXnMpJNGg4eLvuy3r8izGHt?cluster=devnet
Finished successfully
```


控制台中的第一个交易链接代表了创建和拓展查找表的交易。第二个交易代表了向所有接收者的转账。欢迎检查这些交易在浏览器中的具体内容。

请记住，当你下载初始代码时，这个交易是失败的。现在，我们使用查找表，可以在单个交易中完成所有 22 个转账。

### 6. 向查找表添加更多的地址

请记住，我们迄今为止提出的解决方案只支持最多 30 个账户的转账，因为我们只扩展了查找表一次。考虑到转账指令的大小，事实上，我们实际上可以每次向查找表添加额外 27 个地址并完成向多达 57 个接收者的原子转账。让我们继续，现在添加对此的支持！

我们所需做的就是进入 `initializeLookupTable` 并做两件事：

1. 修改现有对 `extendLookupTable` 的调用，仅添加前 30 个地址（更多就会使交易太大）
2. 添加一个循环，每次扩展查找表 30 个地址，直到所有地址都被添加进去为止


```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());

    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    var remaining = addresses.slice(30);

    while (remaining.length > 0) {
        const toAdd = remaining.slice(0, 30);
        remaining = remaining.slice(30);
        const extendInstruction =
            web3.AddressLookupTableProgram.extendLookupTable({
                payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
                authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
                lookupTable: lookupTableAddress, // The address of the lookup table to extend
                addresses: toAdd, // The addresses to add to the lookup table
            });

        await sendV0Transaction(connection, user, [extendInstruction]);
    }

    return lookupTableAddress;
}
```

恭喜！如果您对这个实验感到满意，那么您很可能已经准备好自己处理查找表和版本化交易。如果您想查看最终的解决方案代码，可以在[solution分支](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/solution)找到。

# 挑战

作为挑战，尝试去停用、关闭和冻结查询表。请记住，在关闭查询表之前，您需要等待查询表停用。此外，如果查询表被冻结，就无法对其进行修改（停用或关闭），因此您将需要单独测试或使用不同的查询表。

1. 创建一个停用查询表的函数。
2. 创建一个关闭查询表的函数。
3. 创建一个冻结查询表的函数。
4. 在`main()`函数中调用这些函数以测试它们。

您可以重用我们在实验中创建的用于发送交易和等待查询表激活/停用的函数。随意参考此[解决方案代码](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge)。

## 实验完成了吗？

将您的代码推送到GitHub，并[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=b58fdd00-2b23-4e0d-be55-e62677d351ef)!
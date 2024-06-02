---
title: 转账费用扩展
objectives:
- 创建配置了转账费用的货币
- 转账该货币的代币
- 收取转账费用
---

# 摘要
 - 代币扩展程序的`转账费用`扩展允许在每次转账时扣留费用。这些费用被留在接收者的账户上，只能从`withdrawWithheldAuthority`权限下赎回
 - 被扣留的代币可以直接从接收者账户取出，也可以重新收回到发行金库，然后再提取出来
 - 使用`转账费用`扩展的货币进行转账需要使用`transferCheckedWithFee`指令

# 概述
假设您是Solana游戏开发者，您正在制作一个庞大的开放世界多人角色扮演游戏。在这个游戏中，玩家将赚取并交易一种货币。为了使游戏中的经济循环闭合，您可能希望在每次货币交易时收取一定数额的转账费用，这就是所谓的开发者税。这可以通过`转账费用`扩展来实现。精彩之处在于，这将在游戏内外的每次转账上都会生效！

代币扩展程序的`转账费用`扩展使您能够配置货币的转账费用，使协议级别上对费用进行评估。在每次转账中，被扣留的一定数量的货币存放在接收者账户上，接收者无法使用。在转账之后的任何时刻，`withdraw`权限可以要求提取这些被扣留的代币。

`转账费用`扩展是可以定制和更新的。下面是稍后我们将深入讨论的输入：
 - 基础点费用：这是在每次转账上评估的费用。例如，如果转移了50个基础点的1000个代币，将获得5个代币。
 - 最大费用：转账费用上限。对于100亿个代币的转账，最大费用为5000个代币。
 - 转账费用权限：能够修改费用的实体。
 - 提取被扣留权限：能够移动被扣留的代币或代币账户的实体。

## 计算基础点费用

在我们深入研究扩展之前，这里是“基础点费用”的简要介绍。

基础点是金融领域中使用的一种单位，用于描述金融工具的价值或利率的百分比变化。一个基础点等于0.01%或者十进制形式的0.0001。

要获取费用，我们必须按照以下方式计算：

$$ 费用 = {代币数量 * 基础点费用 \over 10000} $$

常数10000用于将费用基础点百分比转换为等效金额。

## 配置具有转账费用的货币

初始化具有`转账费用`扩展的货币涉及三个指令：
- `SystemProgram.createAccount`
- `createInitializeTransferFeeConfigInstruction`
- `createInitializeMintInstruction`

第一个指令`SystemProgram.createAccount`为发行账户在区块链上分配了空间。此指令实现了三件事情：
 - 分配`空间`
 - 为租金转账`lamports`
 - 分配给所属的程序

与所有代币扩展程序的发行账户一样，我们需要计算发行所需的空间和lamports。我们可以通过调用`getMintLen`和`getMinimumBalanceForRentExemption`来获取这些值。

```ts
const extensions = [ExtensionType.TransferFeeConfig]
const mintLength = getMintLen(extensions)

const mintLamports =
	await connection.getMinimumBalanceForRentExemption(mintLength)

const createAccountInstruction = SystemProgram.createAccount({
	fromPubkey: payer.publicKey,
	newAccountPubkey: mintKeypair.publicKey,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

第二个指令`createInitializeTransferFeeConfigInstruction`初始化转账费用扩展。

它带有以下参数：
- `mint`：代币发行账户
- `transferFeeConfigAuthority`：可以更新费用的可选权限
- `withdrawWithheldAuthority`：可以提取费用的可选权限
- `transferFeeBasisPoints`：作为转账费用的基础点转移量的数量，表示为转账金额的基础点
- `maximumFee`：在转账上评估的最大费用
- `programId`：SPL代币程序账户

```ts
const initializeTransferFeeConfigInstruction = createInitializeTransferFeeConfigInstruction(
	mintKeypair.publicKey,
	payer.publicKey,
	payer.publicKey,
	feeBasisPoints,
	maxFee,
	TOKEN_2022_PROGRAM_ID
)
```

第三个指令`createInitializeMintInstruction`初始化货币。

```ts
const initializeMintInstruction = createInitializeMintInstruction(
	mintKeypair.publicKey,
	decimals,
	payer.publicKey,
	null,
	TOKEN_2022_PROGRAM_ID
)
```

最后，您需要将所有这些指令添加到一个交易中，并将其发送到区块链上。

```ts
const mintTransaction = new Transaction().add(
	createAccountInstruction,
	initializeTransferFeeConfigInstruction,
	initializeMintInstruction
);

const signature = await sendAndConfirmTransaction(
	connection,
	mintTransaction,
	[payer, mintKeypair],
	{commitment: 'finalized'}
)
```

## 使用转账费用进行代币转移

使用`转账费用`扩展进行代币转移时需要注意一些事项。

首先，接收者是“支付”费用的对象。如果我以基础点为50（5%）的100个代币进行转账，接收方将收到95个代币（五个被扣留）。

其次，计算的是费用不是传输的代币数量，而是该代币的最小单位。在Solana编程中，我们总是指定以它们的最小单位进行转账、发行或销毁。向某人发送一枚SOL，实际上我们发送`1 * 10 ^ 9` lamports。另一种看待的方式是，如果你想发送一美元，实际上你发送了100分。让我们把这个一美元看成具有50基础点（5%）转账费用的代币。发送一美元将导致五分的费用。现在假设我们有10美分的最大费用，无论我们发送多少美元，10美分总是最高的费用。

计算可以总结如下：
```ts
const transferAmount = BigInt(tokensToSend * (10 ** decimals))
const basisPointFee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000)
const fee = (basisPointFee > maxFee) ? maxFee : basisPointFee;
```

第三，使用`转账费用`扩展进行代币转移有两种方法：`transfer_checked`或`transfer_checked_with_fee`。普通的`transfer`函数缺乏处理费用的必要逻辑。

您可以选择使用哪个函数进行转账：
- `transfer_checked_with_fee`：您必须计算并提供正确的费用
- `transfer_checked`：这将为您计算费用


```ts
/**
 * 将代币从一个账户转移到另一个账户，断言代币的 mint 和小数点位数
 *
 * @param connection     要使用的连接
 * @param payer          交易费用的付款人
 * @param source         源账户
 * @param mint           账户的mint
 * @param destination    目标账户
 * @param owner          源账户的所有者
 * @param amount         要转移的代币数量
 * @param decimals       转移金额的小数位数
 * @param multiSigners   如果“所有者”是多签，签名账户
 * @param confirmOptions 确认交易的选项
 * @param programId      SPL 代币程序账户
 *
 * @return 确认交易的签名
 */

const secondTransferAmount = BigInt(1 * (10 ** decimals));
const secondTransferSignature = await transferChecked(
	connection,
	payer,
	sourceAccount,
	mint,
	destinationAccount,
	sourceKeypair,
	secondTransferAmount,
	decimals, // 可以通过使用“getMint（...）”获取代币账户的详情来获取
	[],
	undefined,
	TOKEN_2022_PROGRAM_ID
)
```

## 收取费用

有两种方式可以从代币账户中的被保留部分中“收取费用”。

1. `withdrawWithheldAuthority` 可以直接从用户代币账户的被保留部分中提取到任何“代币保险库”
2. 我们可以“收获”被保留的代币，并将它们存储在 mint 账户本身内部，随时可以从“withdrawWithheldAuthority”中提取出来。

但首先，为什么有这两个选项？

简单来说，直接提取是一个需要权限的功能，意味着只有“withdrawWithheldAuthority”可以调用它。而收获则是无需权限，任何人都可以调用收获函数将所有费用合并到 mint 本身。

但为什么不直接在每次转移时将代币转移到收费人？

两个原因：一是，代币的创建者希望费用到达的地方可能会发生变化。二是，这样会造成瓶颈。

假设你拥有一种非常受欢迎的启用了“转移费用”的代币，而你的费用保险库是这些费用的接收方。如果成千上万的人试图同时交易代币，它们都必须更新您的费用保险库余额 - 您的费用保险库必须是“可写的”。尽管 Solana 可以并行执行，但如果同时写入相同的账户，它无法并行执行。因此，成千上万的人将不得不排队，大大减慢转移的速度。这可以通过在接收方的账户内部设置“被保留”转移费用来解决 - 这样只有发件人和接收方的账户是可写的。然后“withdrawWithheldAuthority”可以随时从费用保险库提取。

### 直接提取费用

在第一种情况下，如果我们想直接从所有代币账户中提取所有被保留的转移费用，我们可以执行以下操作：

1. 使用“getProgramAccounts”获取与 mint 相关的所有代币账户
2. 将所有具有一定数量的被保留代币的代币账户添加到列表中
3. 调用“withdrawWithheldTokensFromAccounts”函数（“authority”需要成为签名者）

```ts
// 获取给定 mint 的所有代币账户
const accounts = await connection.getProgramAccounts(
	TOKEN_2022_PROGRAM_ID,
	{
		commitment: 'finalized',
		filters: [
			{
				memcmp: {
					offset: 0,
					bytes: mint.toString(),
				},
			},
		],
	}
)

const accountsToWithdrawFrom = []
for (const accountInfo of accounts) {
	const unpackedAccount = unpackAccount(
		accountInfo.pubkey,
		accountInfo.account,
		TOKEN_2022_PROGRAM_ID
	)

	// 如果存在被保留的代币，则将其添加到我们的列表中
	const transferFeeAmount = getTransferFeeAmount(unpackedAccount)
	if (
		transferFeeAmount != null &&
		transferFeeAmount.withheldAmount > BigInt(0)
	) {
		accountsToWithdrawFrom.push(accountInfo.pubkey)
	}
}

/**
 * 从账户中提取被保留的代币
 *
 * @param connection     要使用的连接
 * @param payer          交易费用的付款人
 * @param mint           代币 mint
 * @param destination    目标账户
 * @param authority      该 mint 的提取被保留代币的权威
 * @param multiSigners   如果“owner”是多签，签名账户
 * @param sources        要提取被保留费用的源账户
 * @param confirmOptions 用于确认交易的选项
 * @param programId      SPL 代币程序账户
 *
 * @return 确认交易的签名
 */
await withdrawWithheldTokensFromAccounts(
	connection,
	payer,
	mint,
	feeVaultAccount,
	authority,
	[],
	accountsToWithdrawFrom,
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)
```

### 收获费用

第二种方法被称为“收获” - 这是一个无需权限的功能，意味着任何人都可以调用它。该方法适用于使用工具（例如 [clockwork](https://www.clockwork.xyz/)）“操纵”收获指令。不同之处在于收获时，被保留的代币被存储在 mint 本身内部。然后“withdrawWithheldAuthority”可以随时从 mint 中提取代币。

要收获：
1. 收集您想要收获的所有账户（与上述流程相同）
2. 调用“harvestWithheldTokensToMint”
3. 要从 mint 中提取，请调用“withdrawWithheldTokensFromMint”

```ts
/**
 * 从账户中收获被保留的代币到 mint
 *
 * @param connection     要使用的连接
 * @param payer          交易费用的付款人
 * @param mint           代币 mint
 * @param sources        要从中提取被保留费用的源账户
 * @param confirmOptions 用于确认交易的选项
 * @param programId      SPL 代币程序账户
 *
 * @return 确认交易的签名
 */
await harvestWithheldTokensToMint(
	connection,
	payer,
	mint,
	accountsToHarvestFrom,
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)

/**
 * 从 mint 中提取被保留的代币
 *
 * @param connection     要使用的连接
 * @param payer          交易费用的付款人
 * @param mint           代币 mint
 * @param destination    目标账户
 * @param authority      该 mint 的提取被保留代币的权威
 * @param multiSigners   如果“所有者”是多签，签名账户
 * @param confirmOptions 用于确认交易的选项
 * @param programId      SPL 代币程序账户
 *
 * @return 确认交易的签名
 */
await withdrawWithheldTokensFromMint(
	connection,
	payer,
	mint,
	feeVaultAccount,
	authority,
	[],
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)
```

## 更新费用


迄今为止，还没有办法使用JS库在创建后设置转账费用 [creation with the JS library](https://solana.stackexchange.com/questions/7775/spl-token-2022-how-to-modify-transfer-fee-configuration-for-an-existing-mint)。但是，您可以通过CLI进行设置，假设`solana config`钱包的结果是`transferFeeConfigAuthority`：

```bash
solana address
# 结果需要成为 `transferFeeConfigAuthority`
spl-token set-transfer-fee <MINT_ID> <FEE_IN_BASIS_POINTS> <MAX_FEE>
```

## 更新权限

如果您想要更改`transferFeeConfigAuthority`或`withdrawWithheldAuthority`，您可以使用`setAuthority`功能。只需传入正确的账户和`authorityType`，在这些情况下分别为`TransferFeeConfig`和`WithheldWithdraw`。

```ts
/**
 * 为账户分配新的权限
 *
 * @param connection       要使用的连接
 * @param payer            交易费的支付方
 * @param account          账户地址
 * @param currentAuthority 指定类型的当前权限
 * @param authorityType    要设置的权限类型
 * @param newAuthority     账户的新权限
 * @param multiSigners     歔法签名账户（如果 `currentAuthority` 是多签名的话）
 * @param confirmOptions   交易确认选项
 * @param programId        SPL Token程序账户ID
 *
 * @return 确认交易的签名
 */

await setAuthority(
  connection,
  payer,
  mint,
  currentAuthority, 
  AuthorityType.TransferFeeConfig, // 或 AuthorityType.WithheldWithdraw
  newAuthority, 
  [],
  undefined,
  TOKEN_2022_PROGRAM_ID
)
```

# 实验室

在本实验室中，我们将会创建一个配置了转账费用的代币。我们将使用一个费用金库来存储转账费用，并且将使用直接和收获方法来收取费用。

### 1. 入门

要开始，请创建一个名为`transfer-fee`的空目录并进入该目录。我们将初始化一个全新的项目。运行`npm init`并按照提示操作。

接下来，我们需要添加我们的依赖项。运行以下命令以安装所需的软件包：
```bash
npm i @solana-developers/helpers @solana/spl-token @solana/web3.js esrun dotenv typescript
```

创建一个名为`src`的目录。在该目录中，创建一个名为 `index.ts` 的文件。这是我们将针对该扩展的规则运行检查的地方。将以下代码粘贴到 `index.ts` 中：
```ts
import { Connection, Keypair } from '@solana/web3.js'
import { initializeKeypair } from '@solana-developers/helpers'
import { transferCheckedWithFee} from "@solana/spl-token"

/**
 * 创建连接并初始化一个密钥对（如果尚未存在）。
 * 如果密钥对存在，则空投一个 SOL 代币（如果需要）。
 */
const connection = new Connection("http://127.0.0.1:8899")
const payer = await initializeKeypair(connection)

console.log(`public key: ${payer.publicKey.toBase58()}`)

const mintKeypair = Keypair.generate()
const mint = mintKeypair.publicKey
console.log(
	'\n代币公钥: ' + mintKeypair.publicKey.toBase58() + '\n\n'
)

// 创建配置了转账费用的代币

// 创建费用金库账户

// 创建源账户和代币币

// 创建目的账户

// 转移代币

// 从保留账户提取代币

// 提取已提取的代币

// 验证更新后的费用金库余额

// 将已提取的代币收入金库

// 获取已收获的代币

// 验证更新后的费用金库余额
```

`index.ts` 中包含一个创建到指定验证节点的连接并调用`initializeKeypair`的主函数。这个`main`函数将是我们编写脚本的地方。

继续运行这个脚本。您应该在终端中看到`mint`公钥被记录下来。

```bash
esrun src/index.ts
```

如果在`initializeKeypair`中遇到空投错误，请执行下一步。

### 2. 运行验证节点

出于本指南的目的，我们将运行我们自己的验证节点。

在一个单独的终端中，运行以下命令：`solana-test-validator`。这将运行节点并记录一些密钥和值。我们需要检索并在连接中使用JSON RPC URL 的值，对于本例来说是 `http://127.0.0.1:8899`。然后我们将用它在连接中指定使用本地RPC URL。

```tsx
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
```

如果您想要使用测试网或开发网，从 `@solana/web3.js` 导入 `clusterApiUrl`，并将其传递给连接，如下所示：

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

如果您决定使用开发网，并且在进行空投 SOL 时遇到问题，请随时在`initializeKeypair`中添加`keypairPath`参数。您可以通过在终端中运行`solana config get`获取此参数。然后转到 [faucet.solana.com](https://faucet.solana.com/) 并向您的地址空投一些 SOL。您可以通过在终端中运行`solana address`获取您的地址。

### 3. 创建带有转账费用的代币

让我们在一个新文件 `src/create-mint.ts` 中创建一个名为 `createMintWithTransferFee` 的函数。

要创建带有`transfer fee`扩展的代币，我们需要三个指令：`SystemProgram.createAccount`、`createInitializeTransferFeeConfigInstruction`和`createInitializeMintInstruction`。

另外，我们希望我们的新`createMintWithTransferFee`函数具有以下参数：
 - `connection`：连接对象
 - `payer`：交易的支付方
 - `mintKeypair`：新代币的密钥对
 - `decimals`：代币小数位数
 - `feeBasisPoints`：转账费用的费用基点
 - `maxFee`：转账费用的最大费用点数


```ts
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
	createInitializeTransferFeeConfigInstruction,
} from '@solana/spl-token'

export async function createMintWithTransferFee(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	feeBasisPoints: number,
	maxFee: bigint
): Promise<TransactionSignature> {
	const extensions = [ExtensionType.TransferFeeConfig]
	const mintLength = getMintLen(extensions)

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(mintLength)

	console.log('Creating a transaction with transfer fee instruction...')
	const mintTransaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: payer.publicKey,
			newAccountPubkey: mintKeypair.publicKey,
			space: mintLength,
			lamports: mintLamports,
			programId: TOKEN_2022_PROGRAM_ID,
		}),
		createInitializeTransferFeeConfigInstruction(
			mintKeypair.publicKey,
			payer.publicKey,
			payer.publicKey,
			feeBasisPoints,
			maxFee,
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

	console.log('Sending transaction...')
	const signature = await sendAndConfirmTransaction(
		connection,
		mintTransaction,
		[payer, mintKeypair],
		{commitment: 'finalized'}
	)
  	console.log('Transaction sent')

	return signature
}
```

现在让我们在 `src/index.ts` 中导入并调用我们的新函数。我们将创建一个具有九个小数点、1000个手续费基点（10%）和最大费用为5000的代币。

```typescript
// 创建带有转账费用的代币
const decimals = 9;
const feeBasisPoints = 1000;
const maxFee = BigInt(5000);

await createMintWithTransferFee(
  connection,
  payer,
  mintKeypair,
  decimals,
  feeBasisPoints,
  maxFee
);
```

运行脚本以确保目前一切都正常工作。

```bash
esrun src/index.ts
```

### 4. 创建一个费用保险库账户

在转移任何代币和产生转账费用之前，让我们创建一个“费用保险库”，它将是所有转账费用的最终收款方。

为简单起见，让我们将费用保险库设置为付款方的关联代币账户（ATA）。

```typescript
// 创建费用保险库账户
console.log("\n创建一个费用保险库账户...");

const feeVaultAccount = await createAssociatedTokenAccount(
  connection,
  payer,
  mintKeypair.publicKey,
  payer.publicKey,
  {commitment: "finalized"},
  TOKEN_2022_PROGRAM_ID
);

const initialBalance = (
  await connection.getTokenAccountBalance(feeVaultAccount, "finalized")
).value.amount;

console.log("当前的费用保险库余额: " + initialBalance + "\n\n");
```

让我们再次运行脚本，这时应该会显示零余额。

```bash
esrun src/index.ts
```

### 5. 创建两个代币账户并向其中一个进行铸造

现在让我们创建两个测试代币账户，一个称为`source`账户，另一个为`destination`账户。然后让我们向`source`账户铸造一些代币。

我们可以通过调用`createAccount`和`mintTo`来实现这一点。

我们将铸造10个完整的代币。

```typescript
// 创建测试账户并铸造代币
console.log('创建source账户...')

const sourceKeypair = Keypair.generate()
const sourceAccount = await createAccount(
  connection,
  payer,
  mint,
  sourceKeypair.publicKey,
  undefined,
  {commitment: 'finalized'},
  TOKEN_2022_PROGRAM_ID
)

console.log('创建destination账户...')

const destinationKeypair = Keypair.generate()
const destinationAccount = await createAccount(
  connection,
  payer,
  mint,
  destinationKeypair.publicKey,
  undefined,
  {commitment: 'finalized'},
  TOKEN_2022_PROGRAM_ID
)

console.log('向source账户铸造10个代币...\n\n')

const amountToMint = 10 * (10 ** decimals)

await mintTo(
  connection,
  payer,
  mint,
  sourceAccount,
  payer,
  amountToMint,
  [payer],
  {commitment: 'finalized'},
  TOKEN_2022_PROGRAM_ID
)
```

如果愿意，运行脚本以检查一切是否正常:

```bash
esrun src/index.ts
```

### 6. 转账一个代币

现在，让我们将1个代币从`sourceAccount`转移到`destinationAccount`，并查看发生了什么。

要使用启用了“转账费用”扩展的代币进行转账，我们必须调用`transferCheckedWithFee`。这要求我们决定要发送多少，并计算相关的正确费用。

我们可以通过进行一些简单的数学运算来实现这一点：

首先，要发送一个完整的代币实际上是发送`1 * (10 ^ decimals)`代币。在Solana编程中，我们总是以最小的单位指定要传输、铸造或销毁的金额。要将1个SOL发送给某人，我们实际上发送`1 * 10 ^ 9`个Lamports。另一种看待的方法是，如果您要发送1美元，实际上是发送了100美分。

现在，我们可以将结果金额`1 * (10 ^ decimals)`与基点费用相乘，然后除以`10_000`（费率基点的定义）来计算费用。

最后，我们需要检查费用是否超过了最大费用，如果是，则使用我们的最大费用调用`transferCheckedWithFee`。

```typescript
const transferAmount = BigInt(1 * (10 ** decimals))
const basisPointFee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000)
const fee = (basisPointFee > maxFee) ? maxFee : basisPointFee;
```

有了所有这些信息，再花点时间，想一想这笔交易的最终余额和预留金额会是多少呢？

现在，让我们转移一个代币，并打印出结果余额：

```typescript
// 转移代币
console.log('转移带有费用的交易...')

const transferAmount = BigInt(1 * (10 ** decimals))
const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000)
```

有了所有这些信息，花点时间思考一下，你认为这笔交易的最终余额和被扣留金额会是多少呢？

现在，让我们转移其中一个代币并打印出结果余额：

```ts
// TRANSFER TOKENS
console.log('Transferring with fee transaction...')

const transferAmount = BigInt(1 * (10 ** decimals))
const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000)

const transferSignature = await transferCheckedWithFee(
  connection,
  payer,
  sourceAccount,
  mint,
  destinationAccount,
  sourceKeypair.publicKey,
  transferAmount,
  decimals,
  fee,
  [sourceKeypair],
  { commitment: 'finalized' },
  TOKEN_2022_PROGRAM_ID
)

const sourceAccountAfterTransfer = await getAccount(
	connection,
	sourceAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const destinationAccountAfterTransfer = await getAccount(
	connection,
	destinationAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const withheldAmountAfterTransfer = getTransferFeeAmount(destinationAccountAfterTransfer);

console.log(`Source Token Balance: ${sourceAccountAfterTransfer.amount}`)
console.log(`Destination Token Balance: ${destinationAccountAfterTransfer.amount}`)
console.log(`Withheld Transfer Fees: ${withheldAmountAfterTransfer?.withheldAmount}\n`)
```


运行脚本：

```bash
esrun src/index.ts
```

你应该会得到以下输出：

```bash
Transferring with fee transaction...
Source Token Balance: 9000000000
Destination Token Balance: 999995000
Withheld Transfer Fees: 5000

```

简单分析：

我们的费基点为1000，意味着转账金额的10%应被用作手续费。在这种情况下，1000,000,000的10%为100,000,000，远远大于我们的5000最大费用，因此我们看到5000被扣除。另外，请注意接收方是“支付”转账费用。

注意：从现在开始，为了计算费用，你可能希望使用`calculateFee`辅助函数。我们手动计算是为了演示目的。以下是一种实现方式：
```ts
const transferAmount = BigInt(1 * (10 ** decimals));
const mintAccount = await getMint(
	connection,
	mint,
	undefined,
	TOKEN_2022_PROGRAM_ID,
)
const transferFeeAmount = getTransferFeeConfig(mintAccount);
const fee = calculateFee(transferFeeAmount?.newerTransferFee!, secondTransferAmount)
```

### 7. 从账户中提取费用
我们可以通过两种方式将接收方账户中的费用提取到费用保险库中。第一种方法是直接从接收方账户提取扣留的费用到费用保险库账户，使用`withdrawWithheldTokensFromAccounts`。第二种方法是将费用从接收方账户“收获”到代币中，使用`harvestWithheldTokensToMint`，然后使用`withdrawWithheldTokensFromMint`将其从代币提取到费用保险库账户。

### 7.1 直接从接收方账户中提取费用
首先，让我们直接提取费用。我们可以通过调用`withdrawWithheldTokensFromAccounts`来完成此操作。这是一个权限控制的功能，意味着只有`withdrawWithheldAuthority`可以签署它。

`withdrawWithheldTokensFromAccounts`函数接受以下参数：
- `connection`：要使用的连接
- `payer`：交易费的付款者
- `mint`：代币铸造
- `destination`：目标账户 - 在我们的情况下是费用保险库
- `authority`：代币的提取扣留代币权限 - 在我们的情况下是付款者
- `multiSigners`：如果`owner`是多签名的签名账户
- `sources`：从中提取扣留费用的源账户
- `confirmOptions`：用于确认交易的选项
- `programId`：SPL代币程序账户 - 在我们的情况下为`TOKEN_2022_PROGRAM_ID`

现在让我们直接从目标账户提取费用并检查结果余额：

```ts
// 直接提取费用
await withdrawWithheldTokensFromAccounts(
	connection,
	payer,
	mint,
	feeVaultAccount,
	payer.publicKey,
	[],
	[destinationAccount],
	undefined,
	TOKEN_2022_PROGRAM_ID
);

const withheldAccountAfterWithdraw = await getAccount(
	connection,
	destinationAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const withheldAmountAfterWithdraw = getTransferFeeAmount(withheldAccountAfterWithdraw);

const feeVaultAfterWithdraw = await getAccount(
	connection,
	feeVaultAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

console.log(`提取后的扣留金额：${withheldAmountAfterWithdraw?.withheldAmount}`);
console.log(`提取后的费用保险库余额：${feeVaultAfterWithdraw.amount}\n`);
```

运行该脚本：
```bash
esrun src/index.ts
```

你应该会得到以下输出：
```bash
Withheld amount after withdraw: 0
Fee vault balance after withdraw: 5000
```

注意：`withdrawWithheldTokensFromAccounts`也可以用于收集所有账户的所有费用，如果你先获取它们的话。类似下面的代码可以工作：

```ts
const accounts = await connection.getProgramAccounts(
  TOKEN_2022_PROGRAM_ID,
  {
    commitment: 'finalized',
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: mint.toString(),
        },
      },
    ],
  }
)

const accountsToWithdrawFrom = []
for (const accountInfo of accounts) {
  const unpackedAccount = unpackAccount(
    accountInfo.pubkey,
    accountInfo.account,
    TOKEN_2022_PROGRAM_ID
  )

  const transferFeeAmount = getTransferFeeAmount(unpackedAccount)
  if (
    transferFeeAmount != null &&
    transferFeeAmount.withheldAmount > BigInt(0)
  ) {
    accountsToWithdrawFrom.push(accountInfo.pubkey)
  }
}

await withdrawWithheldTokensFromAccounts(
	connection,
	payer,
	mint,
	feeVaultAccount,
	payer.publicKey,
	[],
	accountsToWithdrawFrom,
	undefined,
	TOKEN_2022_PROGRAM_ID
);
```

### 7.2 收获然后提取
现在我们看看第二种检索扣留费用的选择：“收获”。不同的是，我们不是直接提取费用，而是将其“收获”回到代币本身，使用`harvestWithheldTokensToMint`。这是一个无权限控制的功能，任何人都可以调用。如果你使用类似[Clockwork](https://www.clockwork.xyz/)之类的工具自动化这些收获功能，这将会很有用。

在将费用收获到代币账户之后，我们可以调用`withdrawWithheldTokensFromMint`将这些代币转移到费用保险库中。此功能是有权限控制的，我们需要`withdrawWithheldAuthority`来签署。

为了实现这一点，我们需要转移更多的代币以积累更多的费用。这次，我们将采取捷径，使用`transferChecked`函数。这将自动为我们计算费用。然后，我们将打印余额，看看我们的进展：

```ts
// 转移代币第二部分
console.log('转账并收取费用第二部分...')
```


```javascript
const secondTransferAmount = BigInt(1 * (10 ** decimals));
const secondTransferSignature = await transferChecked(
	connection,
	payer,
	sourceAccount,
	mint,
	destinationAccount,
	sourceKeypair,
	secondTransferAmount,
	decimals, // 也可以通过使用`getMint(...)`获取代币账户详细信息来获得
	[],
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const sourceAccountAfterSecondTransfer = await getAccount(
	connection,
	sourceAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const destinationAccountAfterSecondTransfer = await getAccount(
	connection,
	destinationAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const withheldAmountAfterSecondTransfer = getTransferFeeAmount(destinationAccountAfterTransfer);

console.log(`源代币余额: ${sourceAccountAfterSecondTransfer.amount}`)
console.log(`目标代币余额: ${destinationAccountAfterSecondTransfer.amount}`)
console.log(`保留的转账费用: ${withheldAmountAfterSecondTransfer?.withheldAmount}\n`)
```

现在，让我们将代币收回到发行账户。我们将使用`harvestWithheldTokensToMint`函数进行操作。此函数接受以下参数：
- `connection`：要使用的连接
- `payer`：交易费用支付者
- `mint`：代币发行
- `sources`：要从中提取预留费用的源账户
- `confirmOptions`：确认交易的选项
- `programId`：SPL代币程序账户

然后我们将检查结果余额。然而，由于保留的金额现在将存储在发行账户中，我们必须使用`getMint`获取发行账户，然后通过调用`getTransferFeeConfig`来读取其中的`转账费用`扩展数据：

```javascript
// 收回保留的代币至发行账户
await harvestWithheldTokensToMint(
	connection,
	payer,
	mint,
	[destinationAccount],
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const withheldAccountAfterHarvest = await getAccount(
	connection,
	destinationAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
);

const withheldAmountAfterHarvest = getTransferFeeAmount(withheldAccountAfterHarvest);

const mintAccountAfterHarvest = await getMint(
	connection,
	mint,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const mintTransferFeeConfigAfterHarvest = getTransferFeeConfig(mintAccountAfterHarvest);

console.log(`收获后的保留金额: ${withheldAmountAfterHarvest?.withheldAmount}`);
console.log(`收获后的发行保留金额: ${mintTransferFeeConfigAfterHarvest?.withheldAmount}\n`)
```

最后，让我们使用`withdrawWithheldTokensFromMint`函数从发行账户本身提取这些费用。该函数接受以下参数：

- `connection`：要使用的连接
- `payer`：交易费用支付者
- `mint`：代币发行
- `destination`：目标账户
- `authority`：发行的提取保留代币的权限
- `multiSigners`：如果`owner`是多签账户，则需要签名的账户
- `confirmOptions`：确认交易的选项
- `programId`：SPL代币程序账户

然后，让我们检查余额：

```javascript
// 提取收获的代币
await withdrawWithheldTokensFromMint(
	connection,
	payer,
	mint,
	feeVaultAccount,
	payer,
	[],
	undefined,
	TOKEN_2022_PROGRAM_ID
);

const mintAccountAfterSecondWithdraw = await getMint(
	connection,
	mint,
	undefined,
	TOKEN_2022_PROGRAM_ID
)

const mintTransferFeeConfigAfterSecondWithdraw = getTransferFeeConfig(mintAccountAfterSecondWithdraw);

const feeVaultAfterSecondWithdraw = await getAccount(
	connection,
	feeVaultAccount,
	undefined,
	TOKEN_2022_PROGRAM_ID
);

console.log(`第二次提取后的发行保留余额: ${mintTransferFeeConfigAfterSecondWithdraw?.withheldAmount}`)
console.log(`第二次提取后的费用库余额: ${feeVaultAfterSecondWithdraw.amount}`)
```

现在，让我们运行它。
```bash
esrun src/index.ts
```

您应该在每个步骤后看到余额。

就是这样！我们成功创建了一个带有转账费用的发行。如果在任何时候遇到困难，可以在[这个仓库](https://github.com/Unboxed-Software/solana-lab-transfer-fee/tree/solution)的`solution`分支中找到可运行的代码。

### 挑战
创建一个启用了转账费用的代币发行，并使用不同的小数位数、费用转账点和最大费用进行一些代币转账。

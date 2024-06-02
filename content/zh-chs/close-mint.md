---
title: 关闭Mint扩展
objectives:
 - 创建一个可关闭的Mint
 - 描述关闭Mint所需的所有先决条件
---
**译者**: [ben46](https://github.com/ben46)

# 概要
 - 最初的代币程序仅允许关闭代币账户，但不允许关闭Mint账户。
 - 代币扩展程序包括`close mint`扩展，允许关闭Mint账户。
 - 使用`close mint`扩展关闭Mint账户时，所述Mint的供应需为0。
 - 通过调用`setAuthority`可以更新`mintCloseAuthority`。

# 概述
最初的代币程序仅允许所有者关闭代币账户，而不允许关闭Mint账户。因此，如果您创建了Mint，您将永远无法关闭该账户。这导致了区块链上的大量空间浪费。为了解决这个问题，代币扩展程序引入了`close mint`扩展。这简单地允许关闭Mint账户并退还lamports。唯一的注意事项是所述Mint的供应需为0。

这一扩展对于开发者来说是一个很好的改进，他们可能有成千上万个可以清理并退款的Mint账户。此外，这对于NFT持有者来说也是非常棒的，他们希望销毁自己的NFT。现在，他们将能够收回所有的成本，即关闭Mint，元数据和代币账户。而在此之前，如果有人销毁了一个NFT，只能收回元数据和代币账户的租金。请注意，销毁者还必须是`mintCloseAuthority`。

`close mint`扩展向Mint账户添加了一个额外字段`mintCloseAuthority`。这是用于实际关闭账户的权限地址。

同样，要使用这个扩展关闭Mint，供应必须为0。因此，如果有任何代币被铸造，它们必须首先被销毁。

## 使用关闭权限创建Mint
使用关闭权限扩展初始化Mint涉及以下三个指令：
 - `SystemProgram.createAccount`
 - `createInitializeMintCloseAuthorityInstruction`
 - `createInitializeMintInstruction`

第一个指令`SystemProgram.createAccount`在区块链上为Mint账户分配空间。但是像所有代币扩展程序Mint一样，我们需要计算Mint的大小和成本。这可以通过使用`getMintLen`和`getMinimumBalanceForRentExemption`来实现。在本例中，我们将使用仅`ExtensionType.MintCloseAuthority`来调用`getMintLen`。

要获取Mint的长度和创建账户指令，请执行以下操作：
```ts
const extensions = [ExtensionType.MintCloseAuthority]
const mintLength = getMintLen(extensions)

const mintLamports =
	await connection.getMinimumBalanceForRentExemption(mintLength)

const createAccountInstruction = SystemProgram.createAccount({
	fromPubkey: payer,
	newAccountPubkey: mint,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

第二个指令`createInitializeMintCloseAuthorityInstruction`初始化关闭权限扩展。唯一值得注意的参数是位于第二位的`mintCloseAuthority`。这是可以关闭Mint的地址。

```ts
const initializeMintCloseAuthorityInstruction = createInitializeMintCloseAuthorityInstruction(
	mint,
	authority,
	TOKEN_2022_PROGRAM_ID
)
```

最后一个指令`createInitializeMintInstruction`初始化Mint。
```ts
const initializeMintInstruction = createInitializeMintInstruction(
	mint,
	decimals,
	payer.publicKey,
	null,
	TOKEN_2022_PROGRAM_ID
)
```

最后，将指令添加到交易中，并将其提交到Solana网络。
```typescript
const mintTransaction = new Transaction().add(
	createAccountInstruction,
	initializeMintCloseAuthorityInstruction,
	initializeMintInstruction,
)

const signature = await sendAndConfirmTransaction(
	connection,
	mintTransaction,
	[payer, mintKeypair],
	{ commitment: 'finalized' }
)
```

当交易被发送时，将创建一个新的Mint账户，其中包含指定的关闭权限。

## 使用关闭权限关闭Mint
要使用`close mint`扩展关闭Mint，只需调用`closeAccount`函数即可。

请注意，要关闭Mint账户，总供应量必须为0。因此，如果存在任何代币，必须先将它们销毁。您可以通过`burn`函数来实现这一点。

注意：`closeAccount`函数可用于Mint和代币账户。

```ts
// 销毁代币至0
const burnSignature = await burn(
	connection, // connection - 要使用的连接
	payer, // payer - 交易费的付款人
	sourceAccount, // account - 要从中销毁代币的账户
	mintKeypair.publicKey, // mint - 账户的Mint
	sourceKeypair, // owner - 账户所有者
	sourceAccountInfo.amount, // amount - 要销毁的金额
	[], // multiSigners - 如果`owner`是一个多签账户，则为签名账户
	{ commitment: 'finalized' }, // confirmOptions - 确认交易的选项
	TOKEN_2022_PROGRAM_ID // programId - SPL代币程序账户
)

// 由于总供应量现在为0，账户可以被关闭
await closeAccount(
	connection, // connection - 要使用的连接
	payer, // payer - 交易费的付款人
	mintKeypair.publicKey, // account - 要关闭的账户
	payer.publicKey, // destination - 接收关闭账户剩余余额的账户
	payer, // authority - 可以关闭账户的权限
	[], // multiSigners - 如果`authority`是一个多签账户，则为签名账户
	{ commitment: 'finalized' }, // confirmOptions - 确认交易的选项
	TOKEN_2022_PROGRAM_ID // programId - SPL代币程序账户
)
```

## 更新关闭Mint权限
要更改`closeMintAuthority`，可以调用`setAuthority`函数，并传入正确的账户，以及在本例中是`AuthorityType.CloseMint`的`authorityType`。

```ts
/**
 * 为账户指定新的权限
 *
 * @param connection       要使用的连接
 * @param payer            交易费的付款人
 * @param account          账户的地址
 * @param currentAuthority 指定类型的当前权限
 * @param authorityType    要设置的权限类型
 * @param newAuthority     账户的新权限
 * @param multiSigners     如果`currentAuthority`是多签账户，则是签名账户
 * @param confirmOptions   确认交易的选项
 * @param programId        SPL代币程序账户
 *
 * @return 确认交易的签名
 */

await setAuthority(
  connection,
  payer,
  mint,
  currentAuthority, 
  AuthorityType.CloseMint,
  newAuthority, 
  [],
  undefined,
  TOKEN_2022_PROGRAM_ID
)
```

# 实验
```



在本实验室中，我们将使用`close mint` 扩展来创建一个货币。然后，我们将铸造一些代币，并查看当我们试图关闭具有非零供应的代币时会发生什么（提示：关闭交易将失败）。最后，我们将销毁供应并关闭该账户。

## 1. 入门

要开始，请创建一个名为`close-mint`的空目录并导航到它。我们将初始化一个全新的项目。运行`npm init`并按照提示进行操作。

接下来，我们需要添加我们的依赖项。运行以下命令以安装所需的软件包：

```bash
npm i @solana-developers/helpers @solana/spl-token @solana/web3.js esrun dotenv typescript
```

创建一个名为`src`的目录。在此目录中，创建一个名为`index.ts`的文件。这是我们将要对此扩展的规则进行检查的地方。将以下代码粘贴到`index.ts`中：

```ts
import {
	Connection,
	Keypair,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { initializeKeypair } from '@solana-developers/helpers'
// import { createClosableMint } from './create-mint' // -在稍后的步骤中取消注释
import {
	TOKEN_2022_PROGRAM_ID,
	burn,
	closeAccount,
	createAccount,
	getAccount,
	getMint,
	mintTo,
} from '@solana/spl-token'
import dotenv from 'dotenv'
dotenv.config()

/**
 * 如果不存在，则创建连接并初始化一个密钥对。
 * 如果密钥对存在，则进行SOL空投。
 */
const connection = new Connection("http://127.0.0.1:8899")
const payer = await initializeKeypair(connection)

console.log(`public key: ${payer.publicKey.toBase58()}`)

const mintKeypair = Keypair.generate()
const mint = mintKeypair.publicKey
console.log(
	'\nmint public key: ' + mintKeypair.publicKey.toBase58() + '\n\n'
)

// 创建带有关闭权限的货币
// 铸造代币
// 验证供应
// 尝试关闭具有非零供应的代币
// 销毁供应
// 关闭货币
```

`index.ts`创建到指定验证者节点的连接，并调用`initializeKeypair`。这是我们编写脚本的其余部分后，我们将在其中调用的位置。

继续运行脚本。您应该在终端中看到`payer`和`mint`的公钥被记录。

```bash
esrun src/index.ts
```

如果在`initializeKeypair`中遇到空投错误，请按照下一步操作。

### 2. 运行验证者节点

为了方便本指南，我们将运行自己的验证者节点。

在另一个终端中，运行以下命令：`solana-test-validator`。这将运行节点，并记录一些密钥和值。我们需要检索并使用于我们的连接中的JSON RPC URL。在本例中，值是`http://127.0.0.1:8899`。然后，我们在连接中使用该值以指定使用本地RPC URL。

```tsx
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
```

或者，如果您想要使用测试网络或开发网络，请从`@solana/web3.js`导入`clusterApiUrl`并将其传递到连接中，如下所示：

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

如果您决定使用开发网络，并且在进行空投SOL时遇到问题，请随时在`initializeKeypair`中添加`keypairPath`参数。您可以从终端中运行`solana config get`获取此值。然后转到[faucet.solana.com](https://faucet.solana.com/)并向您的地址空投一些SOL。您可以从终端中运行`solana address`获取您的地址。

## 3. 创建一个具有关闭权限的货币

让我们通过创建函数`createClosableMint`在新文件`src/create-mint.ts`中来创建一个可关闭的货币。

要创建一个可关闭的货币，我们需要完成几个步骤：

- `getMintLen`：获取货币账户所需的空间
- `SystemProgram.getMinimumBalanceForRentExemption`：告诉我们货币账户的租金成本
- `SystemProgram.createAccount`：创建指令来为Solana上的货币账户分配空间
- `createInitializeMintCloseAuthorityInstruction`：创建初始化关闭货币扩展的指令-这会将`closeMintAuthority`作为参数。
- `createInitializeMintInstruction`：创建初始化货币的指令
- `sendAndConfirmTransaction`：将交易发送到区块链

我们将依次调用所有这些功能。但在此之前，让我们定义我们`createClosableMint`函数的输入：
- `connection: Connection`：连接对象
- `payer: Keypair`：交易的付款人
- `mintKeypair: Keypair`：新货币的密钥对
- `decimals: number`：货币小数

将所有这一切放在一起，我们得到：

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
	createInitializeMintCloseAuthorityInstruction,
} from '@solana/spl-token'

export async function createClosableMint(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number
): Promise<TransactionSignature> {
	const extensions = [ExtensionType.MintCloseAuthority]
	const mintLength = getMintLen(extensions)

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(mintLength)

	console.log('Creating a transaction with close mint instruction...')
	const mintTransaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: payer.publicKey,
			newAccountPubkey: mintKeypair.publicKey,
			space: mintLength,
			lamports: mintLamports,
			programId: TOKEN_2022_PROGRAM_ID,
		}),
		createInitializeMintCloseAuthorityInstruction(
			mintKeypair.publicKey,
			payer.publicKey,
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
		{ commitment: 'finalized' }
	)

	return signature
}
```

现在让我们在`src/index.ts`中调用这个函数。首先，您需要导入我们的新函数。然后将以下内容粘贴在正确的注释部分下面：

```typescript
// 创建一个带有关闭权限的代币
const decimals = 9

await createClosableMint(connection, payer, mintKeypair, decimals)
```

这将创建一个带有关闭代币指令的事务。

随时运行此命令并检查一切是否正常运行：

```bash
esrun src/index.ts
```

## 4. 关闭代币

我们将要关闭这个代币，但首先，让我们探讨在尝试关闭时如果有供应量会发生什么情况（提示，它会失败）。

为了做到这一点，我们将尝试铸造一些代币，然后尝试关闭，接着销毁代币，然后就可以进行实际的关闭。

### 4.1 铸造一个代币
在`src/index.ts`中，创建一个账户并铸造1个代币到该账户。

我们可以通过调用2个函数来实现这个：`createAccount`和 `mintTo`：
```typescript
// 铸造代币
/**
 * 创建一个账户并将1个代币铸造到该账户
*/
console.log('创建账户...')
const sourceKeypair = Keypair.generate()
const sourceAccount = await createAccount(
	connection,
	payer,
	mint,
	sourceKeypair.publicKey,
	undefined,
	{ commitment: 'finalized' },
	TOKEN_2022_PROGRAM_ID
)

console.log('铸造1个代币...\n\n')
const amount = 1 * LAMPORTS_PER_SOL
await mintTo(
	connection,
	payer,
	mint,
	sourceAccount,
	payer,
	amount,
	[payer],
	{ commitment: 'finalized' },
	TOKEN_2022_PROGRAM_ID
)
```

现在我们可以通过获取代币信息来验证供应量是否为非零。在完成铸造功能后，添加以下代码块：

```ts
// 验证供应量
/**
 * 获取代币信息以验证供应量
*/
const mintInfo = await getMint(
	connection,
	mintKeypair.publicKey,
	'finalized',
	TOKEN_2022_PROGRAM_ID
)
console.log("初始供应量: ", mintInfo.supply)
```

让我们运行脚本并检查初始供应量：

```bash
esrun src/index.ts
```

您应该在终端中看到以下内容：

```bash
初始供应量:  1000000000n
```

### 4.2 关闭有非零供应量的代币

现在我们将尝试在供应量为非零的情况下关闭代币。我们知道这将失败，因为“关闭代币”扩展需要非零的供应量。所以为了查看结果的错误消息，我们将在try catch中尝试包装`closeAccount`函数并记录错误：
```typescript
// 尝试关闭有非零供应量的账户
/**
 * 当供应量不为0时尝试关闭代币账户
 *
 * 应该会抛出“SendTransactionError”
*/
try {
	await closeAccount(
		connection,
		payer,
		mintKeypair.publicKey,
		payer.publicKey,
		payer,
		[],
		{ commitment: 'finalized' },
		TOKEN_2022_PROGRAM_ID
	)
} catch (e) {
	console.log(
		'关闭账户失败，因为供应量不为零。请检查程序日志:',
		(e as any).logs,
		'\n\n'
	)
}
```

运行此操作：
```bash
esrun src/index.ts
```

我们将会看到程序抛出了错误以及程序日志。您应该看到以下内容：

```bash
关闭账户失败，因为供应量不为零。
```

### 4.3 销毁供应量

让我们销毁全部供应量以便我们可以实际关闭代币。我们可以通过调用`burn`来实现这一点：

```typescript
// 销毁供应量
const sourceAccountInfo = await getAccount(
	connection,
	sourceAccount,
	'finalized',
	TOKEN_2022_PROGRAM_ID
)

console.log('销毁供应量...')
const burnSignature = await burn(
	connection,
	payer,
	sourceAccount,
	mintKeypair.publicKey,
	sourceKeypair,
	sourceAccountInfo.amount,
	[],
	{ commitment: 'finalized' },
	TOKEN_2022_PROGRAM_ID
)
```

### 4.4 关闭代币
在没有通货的情况下，我们现在可以关闭代币。在这一点上，我们只需要调用`closeAccount`，但是，为了可视化它的工作原理，我们将执行以下操作：

	- 获取代币信息：最初，我们获取并检查代币的详细信息，特别关注供应量，这个时候供应量应该为零。这显示了代币符合关闭条件。

	- 验证账户状态：接下来，我们确认账户状态，以确保它仍然是开放和活跃的。

	- 关闭账户：一旦我们确认了账户的开放状态，我们将继续关闭代币账户。

	- 确认关闭：最后，在调用`closeAccount`函数之后，我们再次检查账户状态，确认它已经成功关闭。

我们可以使用以下函数来完成所有这些操作：
- `getMint`：获取代币账户并反序列化信息
- `getAccountInfo`：获取代币账户，以便我们可以检查它是否存在-我们将在关闭前后调用它
- `closeAccount`：关闭代币账户

将这一切汇总在一起，我们会得到：

```typescript
// 关闭代币
const mintInfo = await getMint(
	connection,
	mintKeypair.publicKey,
	'finalized',
	TOKEN_2022_PROGRAM_ID
)

console.log("销毁供应量后: ", mintInfo.supply)

const accountInfoBeforeClose = await connection.getAccountInfo(mintKeypair.publicKey, 'finalized');

console.log("账户是否已关闭? ", accountInfoBeforeClose === null)

console.log('销毁供应量后关闭账户...')
const closeSignature = await closeAccount(
	connection,
	payer,
	mintKeypair.publicKey,
	payer.publicKey,
	payer,
	[],
	{ commitment: 'finalized' },
	TOKEN_2022_PROGRAM_ID
)

const accountInfoAfterClose = await connection.getAccountInfo(mintKeypair.publicKey, 'finalized');

console.log("账户是否已关闭? ", accountInfoAfterClose === null)
```

最后再次运行脚本。

```bash
esrun src/index.ts
```

您应该看到整个创建可关闭的铸币、铸造代币、尝试关闭、销毁代币以及最终关闭账户的过程。

就是这样！我们成功地创建了一个具有关闭权限的铸币。如果您在任何时候遇到困难，可以在 [此存储库](https://github.com/Unboxed-Software/solana-lab-close-mint-account/tree/solution) 的 `solution` 分支中找到可运行的代码。

# 挑战
在挑战中，尝试创建您自己的铸币并铸造到多个代币账户，然后创建一个脚本来销毁所有这些代币账户，然后关闭铸币。

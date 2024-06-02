---
title: 为客户支持 Token 扩展计划
objectives:
- 学习如何有效地在客户应用程序中集成多个 Solana Token 程序
- 熟练运用 SOLANA 编程语言（SPL）TypeScript 库进行全面的 Token 操作
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- `Token 扩展计划` 具有与 `Token 程序` 相同的所有功能，并添加了 `扩展`
- 这两个 Token 程序： `Token 程序` 和 `Token 扩展计划` 使用不同的地址，不能直接兼容
- 要支持两者，需要在客户端函数中指定正确的程序 ID
- 默认情况下，SPL（SOLANA 编程语言）程序库使用原始的 **`Token 程序`**，除非另有指定
- `Token 扩展计划` 也可以用其技术规范名称 `Token22` 指代

# 概述

`Token 扩展计划` 通过整合称为扩展的附加功能增强了原始的 `Token 程序`。这些扩展旨在解决以前需要开发人员分叉和修改 Solana 程序库以处理特定情况的挑战，从而导致生态系统的分裂和采用方面的问题。引入 Token 扩展计划可有效处理这些情况。

由于 `Token 程序` 和 `Token 扩展计划` 是不同的链上程序，它们不可互操作。例如，使用 `Token 扩展计划` 铸造的代币可能无法通过 `Token 程序` 转账。因此，我们需要在任何需要显示或支持所有SPL 代币的客户端应用程序中支持这两个程序。这意味着我们需要明确处理原始 Token 程序 (地址: `TOKEN_PROGRAM_ID`) 和扩展程序 (地址: `TOKEN_2022_PROGRAM_ID`) 中的铸造。

值得庆幸的是，这两个程序的接口保持一致，可以通过简单地交换程序 ID（如果未提供程序 ID，则该函数默认使用原始 Token 程序）在任何一个程序中使用 `spl-token` 辅助函数。大多数情况下，最终用户不关心具体使用的Token程序。因此，实施额外逻辑以跟踪、汇总和合并来自两种不同 Token 类型的细节对于确保用户体验流畅至关重要。

最后，“Token 22”通常用作技术名称。如果您看到有人提到 Token 22 程序，则其实际指的是 Token 扩展计划。

## 使用 Token 程序代币和 Token 扩展计划代币的工作差异

与铸造和代币交互时，我们需要确保使用正确的 Token 程序。要创建 `Token 程序` 代币，使用 `Token 程序`；要使用扩展创建一个代币，使用 `Token 扩展计划`。

幸运的是，`spl-token` 包使这一切变得简单。 它提供了 `TOKEN_PROGRAM_ID` 和 `TOKEN_2022_PROGRAM_ID` 常量，以及为创建和铸造带有程序ID输入的代币提供所有辅助函数。

注意：`spl-token` 默认使用 `TOKEN_PROGRAM_ID`，除非另有指定。一定要在与Token 扩展计划相关的所有函数调用中显式传递 `TOKEN_2022_PROGRAM_ID`。否则，将出现以下错误：`TokenInvalidAccountOwnerError`。

## 在处理 Token 和扩展 Token 时的注意事项

尽管这两个程序的接口保持一致，但它们是两个不同的程序。这两个程序的程序 ID 是唯一且不可互换的，因此在使用时会产生不同的地址。如果要支持 `Token 程序` 代币和 `Token 扩展计划` 代币，必须在客户端增加额外逻辑。

## 关联 Token 账户 (ATA)

关联 Token 账户（ATA）是通过使用钱包的公钥、代币的铸造和代币程序来派生其地址的Token 账户。该机制为每个用户的每个铸造提供了一个确定性的Token 账户地址。ATA 账户通常是多个持有人的默认账户。值得庆幸的是，使用这两种Token程序对待ATA是相同的。

我们可以通过提供所需的程序 ID，使用每个Token程序的ATA辅助函数。

如果我们想在调用 `getOrCreateAssociatedTokenAccount` 扩展 Tokens 时使用 Token 扩展计划，可以将 `TOKEN_2022_PROGRAM_ID` 作为 `tokenProgramId` 参数传递：

```ts
const tokenProgramId = TOKEN_2022_PROGRAM_ID;

const tokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mintAddress,
  payer.publicKey,
  true,
  'finalized',
  {commitment: 'finalized'},
  tokenProgramId // Token 程序代币使用 TOKEN_PROGRAM_ID，Token 扩展计划代币使用 TOKEN_2022_PROGRAM_ID
)
```

要从头开始重新创建ATA的地址，可以使用 `findProgramAddressSync` 函数通过提供正确的种子：

```ts
function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(), // 将 TOKEN_PROGRAM_ID 替换为 TOKEN_2022_PROGRAM_ID 以使用 Token22 代币
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}
```

## 如何获取 Token

使用 Token 程序或 Token 扩展计划创建的代币没有区别。这意味着，在获取 Token 程序或 Token 扩展计划代币时，我们之间没有区别。我们只需提供正确的token程序：

```ts
const tokenAccounts = await connection.getTokenAccountsByOwner(
	walletPublicKey,
	{ programId: TOKEN_PROGRAM_ID } // 或 TOKEN_2022_PROGRAM_ID
);
```

如果要为特定拥有者获取所有代币，可以使用诸如 `getTokenAccountsByOwner` 的函数，并调用两次，一次传入 `TOKEN_PROGRAM_ID`，另一次传入 `TOKEN_2022_PROGRAM_ID`。

```ts
const allOwnedTokens = []
const tokenAccounts = await connection.getTokenAccountsByOwner(
	wallet.publicKey,
	{programId: TOKEN_PROGRAM_ID}
)
const tokenExtensionAccounts = await connection.getTokenAccountsByOwner(
	wallet.publicKey,
	{programId: TOKEN_2022_PROGRAM_ID}
)

allOwnedTokens.push(...tokenAccounts, ...tokenExtensionAccounts)
```

注意：建议在获取后存储并关联代币程序与代币。

### 检查拥有程序

您可能会遇到这样的情况：不知道给定账户的代币程序。幸运的是，`getParsedAccountInfo` 可让我们确定拥有程序：

```tsx
const accountInfo = await connection.getParsedAccountInfo(mintAddress);
if (accountInfo.value === null) {
  throw new Error('Account not found');
}

const programId = accountInfo.value.owner; // 对于 Token 程序硬币地址，将返回 TOKEN_PROGRAM_ID，对于 Token 扩展计划硬币地址，将返回 TOKEN_2022_PROGRAM_ID

//现在用 programId 来获取代币
const tokenAccounts = await connection.getTokenAccountsByOwner(
  wallet.publicKey,
  {programId}
)
```

注意：获取拥有程序后，最好将该所有者保存并与处理的币种/代币相关联。


# 实验 - 为脚本添加扩展令牌支持

让我们通过一个全面的示例来学习如何为现有脚本添加令牌扩展支持。本实验将引导我们进行必要的调整和扩展，以充分利用原始令牌程序及其扩展对应程序的功能和细微差别。

通过本实验结束时，我们将能够处理这两种不同但相关的令牌系统的复杂性，确保我们的脚本能够与两者顺畅交互。

### 1. 克隆起始代码

要开始实验，请克隆[本实验的存储库](https://github.com/Unboxed-Software/solana-lab-token22-in-the-client/)并切换到`starter`分支。该分支包含一些辅助文件和一些样板代码，可帮助您入门。

```bash
git clone https://github.com/Unboxed-Software/solana-lab-token22-in-the-client.git
cd solana-lab-token22-in-the-client
git checkout starter
```

运行`npm install`来安装依赖项。

### 2. 熟悉起始代码

起始代码包含以下文件：

- `print-helpers.ts`
- `index.ts`

**`print-helpers.ts`**文件包含一个名为**`printTableData`**的函数，用于以结构化格式将数据输出到控制台。该函数能够接受任何对象作为其参数，并利用NodeJS提供的**`console.table`**方法将数据以易读的表格格式显示出来。

最后，`index.ts`包含我们的主要脚本。目前它只创建了一个连接，并调用`initializeKeypair`来为`payer`生成密钥对。


### 3. 运行验证器节点（可选）

可选择性地，您可能希望运行您自己的本地验证器，而不是使用开发网络。这是一个解决空头投资问题的好方法。

在另一个终端中，运行以下命令：`solana-test-validator`。这将运行节点并记录一些键和值。我们需要检索和在连接中使用的值是JSON RPC URL，在本例中为`http://127.0.0.1:8899`。然后我们将其用于连接，指定使用本地RPC URL。

```tsx
const connection = new Connection('http://127.0.0.1:8899', 'confirmed');
```

如果您想使用Devnet并提供自己的Devnet钱包，您仍然可以这样做 - 只需重新配置`Connection`和密钥对路径输入为`initializeKeypair`。

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

通过运行`npm run start`来测试一切是否顺利。您应该在终端中看到`payer`的公钥被记录下来。


### 4. 创建令牌程序和令牌扩展程序铸造

让我们首先使用`令牌程序（Token Program）`和`令牌扩展程序（Token Extensions Program）`分别创建新的令牌铸造。

创建一个名为`create-and-mint-token.ts`的新文件。在这个文件中，我们将创建一个名为`createAndMintToken`的函数。如其名称所示，它将创建一个铸造、令牌账户（ATA）并将一些代币铸造到该账户。

在`createAndMintToken`函数中，我们将调用`createMint`、`getOrCreateAssociatedTokenAccount`和`mintTo`。该函数旨在对所使用的特定令牌程序保持中立，允许从`令牌程序（Token Program）`或`令牌扩展程序（Token Extensions Program）`创建令牌。这一功能是通过接受程序ID作为参数来实现的，从而使函数能够根据所提供的ID自适应其行为。以下是我们将传递到该函数中的参数：

- `connection` - 要使用的连接对象
- `tokenProgramId` - 要指向的令牌程序
- `payer` - 支付交易费用的密钥对
- `decimals` - 铸造中要包含的小数位数
- `mintAmount` - 要向支付者铸造的代币数量

以下是该函数将执行的操作：

- 使用**`createMint`**创建新的铸造
- 使用**`getMint`**获取铸币信息
- 使用**`printTableData`**记录铸造信息
- 使用**`getOrCreateAssociatedTokenAccount`**创建一个关联令牌账户
- 记录关联令牌账户的地址
- 使用**`mintTo`**向关联令牌账户铸造代币

综上所述，以下是最终的`createAndMintToken`函数：

```ts
import { createMint, getMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import printTableData from "./print-helpers";

export async function createAndMintToken(
	connection: Connection,
	tokenProgramId: PublicKey,
	payer: Keypair,
	decimals: number,
	mintAmount: number,
): Promise<PublicKey> {
	console.log('\\n创建一个新的铸造...')
	const mint = await createMint(
		connection,
		payer,
		payer.publicKey,
		payer.publicKey,
		decimals,
		undefined,
		{
			commitment: 'finalized', // 确认选项参数
		},
		tokenProgramId
	)

	console.log('\\n获取铸币信息...')

	const mintInfo = await getMint(
		connection,
		mint,
		'finalized',
		tokenProgramId
	)

	printTableData(mintInfo);

	console.log('\\n创建关联令牌账户...')
	const tokenAccount = await getOrCreateAssociatedTokenAccount(
		connection,
		payer,
		mint,
		payer.publicKey,
		true,
		'finalized',
		{commitment: 'finalized'},
		tokenProgramId
	)

	console.log(`关联令牌账户：${tokenAccount.address.toBase58()}`)

	console.log('\\n向关联令牌账户铸造代币...')
	await mintTo(
		connection,
		payer,
		mint,
		tokenAccount.address,
		payer,
		mintAmount,
		[payer],
		{commitment: 'finalized'},
		tokenProgramId
	)

	return mint
}

export default createAndMintToken
```



### 5. 创建和铸造令牌

现在让我们在`index.ts`的主要脚本中两次调用我们的新函数。我们想要测试`令牌程序（Token Program）`和`令牌扩展程序（Token Extensions Program）`的令牌。因此，我们将使用两个不同的程序ID：

```tsx
import { initializeKeypair } from '@solana-developers/helpers';
import { Cluster, Connection } from '@solana/web3.js';
import createAndMintToken from './create-and-mint-token';
import printTableData from './print-helpers';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import dotenv from 'dotenv';
dotenv.config();
```


```ts
const connection = new Connection('http://127.0.0.1:8899', 'confirmed')
const payer = await initializeKeypair(connection)

console.log(`Payer: ${payer.publicKey.toBase58()}`)

const tokenProgramMint = await createAndMintToken(
	connection,
	TOKEN_PROGRAM_ID,
	payer,
	0,
	1000
)
const tokenExtensionProgramMint = await createAndMintToken(
	connection,
	TOKEN_2022_PROGRAM_ID,
	payer,
	0,
	1000
)
```

此时您可以运行 `npm run start`，并查看两个铸币都会被创建，并且它们的信息被记录在控制台中。

### 6. 获取 Token Program 和 Token 扩展程序的令牌

我们现在可以使用钱包的公钥和程序 ID 来获取令牌。

让我们创建一个名为 `fetch-token-info.ts` 的新文件。

在这个新文件中，让我们创建 `fetchTokenInfo` 函数。该函数将获取提供的令牌账户，并返回一个我们将创建的名为`TokenInfoForDisplay`的新接口。这将允许我们在控制台中很好地格式化返回的数据。同样，该函数将对来自哪个令牌程序账户的数据是不可知的。

```ts
import { AccountLayout, getMint } from "@solana/spl-token"
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"

export type TokenTypeForDisplay = 'Token Program' | 'Token Extensions Program';
  
export interface TokenInfoForDisplay {
  mint: PublicKey
  amount: number
  decimals: number
  displayAmount: number
  type: TokenTypeForDisplay
}

```

为了实际获取所有这些信息，我们将调用 `getTokenAccountsByOwner` 并将结果映射到我们的新`TokenInfoForDisplay`接口。

为了完成这个任务，`fetchTokenInfo` 函数将需要以下参数：

- `connection` - 要使用的连接对象
- `owner` - 拥有相关令牌账户的钱包
- `programId` - 指向的令牌程序
- `type` - 要么`Token Program`，要么`Token Extensions Program`；用于控制台记录目的

```ts
export type TokenTypeForDisplay = 'Token Program' | 'Token Extensions Program';

export interface TokenInfoForDisplay {
  mint: PublicKey
  amount: number
  decimals: number
  displayAmount: number
  type: TokenTypeForDisplay
}

export async function fetchTokenInfo(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
  type: TokenTypeForDisplay
): Promise<TokenInfoForDisplay[]> {
  const tokenAccounts = await connection.getTokenAccountsByOwner(
    owner,
    { programId }
  )

  const ownedTokens: TokenInfoForDisplay[] = []

  for (const tokenAccount of tokenAccounts.value) {
    const accountData = AccountLayout.decode(tokenAccount.account.data)

    const mintInfo = await getMint(connection, accountData.mint, 'finalized', programId)

    ownedTokens.push({
      mint: accountData.mint,
      amount: Number(accountData.amount),
      decimals: mintInfo.decimals,
      displayAmount: Number(accountData.amount) / (10 ** mintInfo.decimals),
      type,
    })
  }

  return ownedTokens;
}
```

让我们看看这个函数是如何运行的。在`index.ts`中，让我们对该函数进行两次单独调用，一次对每个程序。

```ts
import { TokenInfoForDisplay, fetchTokenInfo } from './fetch-token-info'

const myTokens: TokenInfoForDisplay[] = []

myTokens.push(
	...await fetchTokenInfo(connection, payer.publicKey, TOKEN_PROGRAM_ID, 'Token Program'),
	...await fetchTokenInfo(connection, payer.publicKey, TOKEN_2022_PROGRAM_ID, 'Token Extensions Program'),
)

printTableData(myTokens)
```

运行 `npm run start`。现在您应该看到付款人钱包所拥有的所有令牌。

### 7. 获取 Token Program 和 Token 扩展程序的令牌，无需程序 ID

现在让我们看看如何从给定的铸造账户中检索所属的程序。

为此，我们将在`fetch-token-info.ts`中创建一个新函数 `fetchTokenProgramFromAccount`。这个函数将简单地返回我们给定铸造的`programId`。

为了完成这一点，我们将调用`getParsedAccountInfo`函数，并从`.value.owner`返回拥有的程序。

`fetchTokenProgramFromAccount` 函数将需要以下参数：

- `connection` - 要使用的连接对象
- `mint` - 铸造账户的公钥

最终的函数将如下所示：

```ts
// previous imports and code

export async function fetchTokenProgramFromAccount(
  connection: Connection,
  mint: PublicKey
){
  // 从铸造中找到程序 ID
  const accountInfo = await connection.getParsedAccountInfo(mint);
  if (accountInfo.value === null) {
      throw new Error('账户未找到');
  }
  const programId = accountInfo.value.owner;
  return programId;
}
```

最后让我们在我们的`index.ts`中尝试实现这个功能：

```ts
import { TokenInfoForDisplay, fetchTokenInfo, fetchTokenProgramFromAccount } from './fetch-token-info'

const tokenProgramTokenProgram = await fetchTokenProgramFromAccount(connection, tokenProgramMint);
const tokenExtensionProgramTokenProgram = await fetchTokenProgramFromAccount(connection, tokenExtensionProgramMint);

if(!tokenProgramTokenProgram.equals(TOKEN_PROGRAM_ID)) throw new Error('Token Program mint token program is not correct');
if(!tokenExtensionProgramTokenProgram.equals(TOKEN_2022_PROGRAM_ID)) throw new Error('Token Extensions Program mint token program is not correct');
```

再次运行 `npm run start`。您应该会看到与前面相同的输出 - 意味着期望的令牌程序是正确的。

就是这样了！如果您在任何步骤上遇到问题，您可以在[此实验室存储库的](https://github.com/Unboxed-Software/solana-lab-token22-in-the-client/) `solution` 分支中找到完整的代码。

# 挑战

作为挑战，尝试实现 Token Program 令牌和 Token Extensions 令牌的燃烧功能。
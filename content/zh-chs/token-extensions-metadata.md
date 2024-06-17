---
title: 元数据和元数据指针扩展
objectives:
- 解释代币扩展程序铸造中元数据指针和元数据扩展的工作原理
- 创建内嵌在铸造账户中的元数据的NFT
- 创建带有元数据指针扩展的NFT
---
**译者**: [ben46](https://github.com/ben46)

# 摘要
- `元数据指针`扩展将代币铸造直接关联到元数据账户。通过在铸造中存储元数据账户的地址来实现。该元数据账户地址可以是外部的元数据账户，比如 Metaplex，或者通过使用`元数据`扩展，可以是铸造账户本身。
- `元数据`铸造扩展允许通过代币扩展程序将元数据直接嵌入到铸造账户中。这总是与自指向的`元数据指针`一起使用。这有助于在铸造阶段嵌入全面的代币信息。
- 这些扩展通过标准化元数据的关联和访问，增强了不同应用和平台之间代币的互操作性。
- 直接嵌入或指向元数据可通过减少对额外查找或外部调用的需求，简化交易和互动。

# 概述

代币扩展程序简化了 Solana 上的元数据。在代币扩展程序之前，开发人员使用元数据链上程序（主要是`Metaplex`）将元数据存储在元数据账户中。然而，这种方法存在一些缺点。例如，与元数据"关联"的铸造账户并不知道元数据账户的存在。要确定一个帐户是否有元数据，我们必须在网络中查询是否存在元数据帐户。另外，要创建和更新元数据，必须使用第二个程序（例如`Metaplex`）。这些流程引入了供应商锁定和增加了复杂性。代币扩展程序的元数据扩展通过引入两个扩展解决了这些问题：

- `元数据指针`扩展：在铸造账户本身添加了两个简单的字段：一个指向持有代币元数据的账户的公钥，遵循[Token-Metadata 接口](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface)，以及用于更新此指针的权限。
- `元数据`扩展：添加了[Token-Metadata 接口](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/)中描述的字段，允许我们将元数据存储在铸造账户本身。

注意：`元数据`扩展必须与指向铸造账户的`元数据指针`扩展一起使用。

## 元数据指针扩展：

由于存在多个元数据程序，一个铸造可以拥有多个声称描述该铸造的账户，这样我们很难知道哪个是铸造的“官方”元数据。为了解决这个问题，`元数据指针`扩展在铸造账户中添加了一个称为`metadataAddress`的`publicKey`字段，指向持有该代币元数据的账户。为了避免仿造的铸造自称为稳定币，客户现在可以检查铸造和元数据是否互相指向。

该扩展为铸造账户增加了两个新字段以实现此功能：
- `metadataAddress`：存储该代币的元数据账户地址；如果使用`元数据`扩展，它可以指向自身。
- `authority`：可以设置元数据地址的权限。

该扩展还引入了三个新的辅助函数：
- `createInitializeMetadataPointerInstruction`
- `createUpdateMetadataPointerInstruction`
- `getMetadataPointerState`

函数`createInitializeMetadataPointerInstruction`将返回设置铸造账户中元数据地址的指令。

该函数接受四个参数：
  - `mint`：将要创建的铸造账户
  - `authority`：可以设置元数据地址的权限
  - `metadataAddress`：持有元数据的账户地址
  - `programId`：SPL Token 程序 ID（在这种情况下，它将是 Token Extension 程序 ID）

```ts
function createInitializeMetadataPointerInstruction(
    mint: PublicKey,
    authority: PublicKey | null,
    metadataAddress: PublicKey | null,
    programId: PublicKey
)
```

函数`createUpdateMetadataPointerInstruction`返回一个将更新铸造账户元数据地址的指令。如果您拥有权限，可以随时更新元数据指针。

该函数接受五个参数：
  - `mint`：将要创建的铸造账户。
  - `authority`：可以设置元数据地址的权限
  - `metadataAddress`：持有元数据的账户地址
  - `multiSigners`：将签署交易的多签名用户
  - `programId`：SPL Token 程序 ID（在这种情况下，它将是 Token Extension 程序 ID）

```ts
function createUpdateMetadataPointerInstruction(
    mint: PublicKey,
    authority: PublicKey,
    metadataAddress: PublicKey | null,
    multiSigners: (Signer | PublicKey)[] = [],
    programId: PublicKey = TOKEN_2022_PROGRAM_ID
)
```

函数`getMetadataPointerState`将返回给定`Mint`对象的`MetadataPointer`状态。我们可以使用`getMint`函数获取。

```ts
function getMetadataPointerState(mint: Mint): Partial<MetadataPointer> | null
```

```ts
export interface MetadataPointer {
    /** 可选的可以设置元数据地址的权限 */
    authority: PublicKey | null;
    /** 可选的持有元数据的账户地址 */
    metadataAddress: PublicKey | null;
}
```

### 创建带有元数据指针的 NFT

要使用`元数据指针`扩展创建 NFT，我们需要两个新的账户：`mint`和`metadataAccount`。

`mint`通常是通过`Keypair.generate()`创建的新的`Keypair`。如果使用元数据铸造扩展，`metadataAccount`可以是`mint`的`publicKey`，或者来自 Metaplex 等其他元数据账户。

此时，`mint`只是一个`Keypair`，但我们需要在区块链上为其储备空间。Solana 区块链上的所有帐户都要缴纳与帐户大小成比例的租金，我们需要知道铸造账户的大小（以字节计算）。我们可以使用`@solana/spl-token`库的`getMintLen`方法。元数据指针扩展通过添加两个新字段`metadataAddress`和`authority`来增加铸造账户的大小。

```ts
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
```

要创建并初始化具有元数据指针的`mint`，我们需要按特定顺序执行多条指令：

1. 使用`SystemProgram.createAccount`创建`mint`账户，在区块链上保留空间
2. 使用`createInitializeMetadataPointerInstruction`初始化元数据指针扩展
3. 使用`createInitializeMintInstruction`初始化铸造本身

```ts
 const createMintAccountInstructions = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    metadataAccount,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );
```

要创建NFT，请将说明添加到交易并将其发送到 Solana 网络：
```ts
const transaction = new Transaction().add(
  createMintAccountInstructions,
  initMetadataPointerInstructions,
  initMintInstructions,
);
const sig = await sendAndConfirmTransaction(connection, transaction, [payer, mint]);
```

## 元数据扩展：

`metadata` 扩展是 Token 扩展计划的一大亮点。此扩展允许我们直接将元数据存储在 `mint` 本身中！这消除了对单独帐户的需求，极大地简化了元数据的处理。

注意：`metadata` 扩展直接与 `metadata-pointer` 扩展配合工作。在创建新的 mint 时，您还应该添加指向 mint 本身的 `metadata-pointer` 扩展。请查看 [Solana Token Extensions Program 文档](https://spl.solana.com/token-2022/extensions#metadata)

元数据扩展中添加的字段和函数遵循 [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface)

当使用元数据扩展初始化 mint 时，它将存储这些额外字段：
```rust
type Pubkey = [u8; 32];
type OptionalNonZeroPubkey = Pubkey; // 如果全为零，则解释为 `None`

pub struct TokenMetadata {
    /// 可以签署以更新元数据的权限
    pub update_authority: OptionalNonZeroPubkey,
    /// 关联的 mint，用于对抗欺诈，确保元数据属于特定的 mint
    pub mint: Pubkey,
    /// 代币的更长名称
    pub name: String,
    /// 代币的简写符号
    pub symbol: String,
    /// 指向更丰富元数据的 URI
    pub uri: String,
    /// 关于代币的任何额外元数据，作为键值对。程序必须避免存储相同的键两次。
    pub additional_metadata: Vec<(String, String)>,
}
```

有了这些额外字段，`@solana/spl-token-metadata` 库已更新以下函数：
- `createInitializeInstruction`
- `createUpdateFieldInstruction`
- `createRemoveKeyInstruction`
- `createUpdateAuthorityInstruction`
- `createEmitInstruction`
- `pack`
- `unpack`

此外，@solana/spl-token 软件包还引入了一个新函数和两个常量：
- `getTokenMetadata`
- `LENGTH_SIZE`：数据长度的常数字节数
- `TYPE_SIZE`：数据类型的常数字节数

函数 `createInitializeInstruction` 在帐户中初始化元数据并设置主要的元数据字段（名称、符号、URI）。 然后返回一条指令，该指令将在 mint 帐户中设置元数据字段。

此函数接受八个参数：
  - `mint`：将要初始化的 mint 帐户
  - `metadata`：将要创建的元数据帐户
  - `mintAuthority`：可铸造代币的权限
  - `updateAuthority`：可以签署以更新元数据的权限
  - `name`：代币的更长名称
  - `symbol`：代币的简写符号，也称为股票代码
  - `uri`：指向更丰富元数据的代币 URI
  - `programId`：SPL Token 程序 ID（在本例中将是 Token Extension 程序 ID）

```ts
export interface InitializeInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    updateAuthority: PublicKey;
    mint: PublicKey;
    mintAuthority: PublicKey;
    name: string;
    symbol: string;
    uri: string;
}

export function createInitializeInstruction(args: InitializeInstructionArgs): TransactionInstruction
```

函数 `createUpdateFieldInstruction` 返回创建或更新 token-metadata 帐户的字段指令。

此函数接受五个参数：
  - `metadata`：元数据帐户地址。
  - `updateAuthority`：可以签署以更新元数据的权限
  - `field`：要更新的字段，这要么是内建的 `Field`，要么是存储在 `additional_metadata` 字段中的自定义字段
  - `value`：字段的更新值
  - `programId`：SPL Token 程序 ID（在本例中将是 Token Extension 程序 ID）

```ts
export enum Field {
    Name,
    Symbol,
    Uri,
}

export interface UpdateFieldInstruction {
    programId: PublicKey;
    metadata: PublicKey;
    updateAuthority: PublicKey;
    field: Field | string;
    value: string;
}

export function createUpdateFieldInstruction(args: UpdateFieldInstruction): TransactionInstruction
```

注意：如果要更新的元数据所需的空间超出了初始分配的空间，则必须与 `system.transfer` 配对，以获得足够的租金，以便 `createUpdateFieldInstruction` 可以进行重新分配。您可以使用 `getAdditionalRentForUpdatedMetadata` 获取所需的额外空间。或者，如果要调用此更新作为独立操作，您可以使用 `tokenMetadataUpdateFieldWithRentTransfer` 助手一次完成所有操作。


函数 `createRemoveKeyInstruction` 返回从 token-metadata 帐户中删除 `additional_metadata` 字段的指令。

此函数接受五个参数：
  - `metadata`：元数据帐户地址
  - `updateAuthority`：可以签署以更新元数据的权限
  - `field`：要删除的字段
  - `programId`：SPL Token 程序 ID（在本例中将是 Token Extension 程序 ID）
  - `idempotent`：当为 true 时，如果密钥不存在，指令不会出错

```ts
export interface RemoveKeyInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    updateAuthority: PublicKey;
    key: string;
    idempotent: boolean;
}

export function createRemoveKeyInstruction(args: RemoveKeyInstructionArgs): TransactionInstruction
```

函数 `createUpdateAuthorityInstruction` 返回更新 token-metadata 帐户权限的指令。

此函数接受四个参数：
  - `metadata`：元数据帐户地址
  - `oldAuthority`：当前可以签署以更新元数据的权限
  - `newAuthority`：新的可以签署以更新元数据的权限
  - `programId`：SPL Token 程序 ID（在本例中将是 Token Extension 程序 ID）

```ts
export interface UpdateAuthorityInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    oldAuthority: PublicKey;
    newAuthority: PublicKey | null;
}

export function createUpdateAuthorityInstruction(args: UpdateAuthorityInstructionArgs): TransactionInstruction
```

函数`createEmitInstruction`是为了按照预期的TokenMetadata状态格式“发出”或记录token-metadata的函数。 这是生成的metadata程序必须的函数，使其符合TokenMetadata接口。发出指令允许索引和其他离线用户调用以获取metadata。这也允许自定义metadata程序以[不同格式存储metadata，同时保持与接口标准的兼容性](https://solana.com/developers/guides/token-extensions/metadata-pointer#metadata-interface-instructions)。

该函数有四个参数：
  - `metadata`: metadata账户地址
  - `programId`: SPL Token程序ID（在这种情况下将是Token扩展程序ID）
  - `start`: *可选* metadata的开始
  - `end`: *可选* metadata的结束

```ts
export interface EmitInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    start?: bigint;
    end?: bigint;
}

export function createEmitInstruction(args: EmitInstructionArgs): TransactionInstruction
```

`pack` 函数将metadata编码为byte数组，而它的对应函数 `unpack` 则将metadata从byte数组解码。 这些操作对于确定metadata的byte大小至关重要，这对于分配足够的存储空间至关重要。

```ts
export interface TokenMetadata {
    // 可以签名以更新metadata的授权机构
    updateAuthority?: PublicKey;
    // 用于对抗伪造以确保metadata属于特定币种的相关造币厂
    mint: PublicKey;
    // token的更长的名称
    name: string;
    // token的缩写符号
    symbol: string;
    // 指向丰富metadata的URI
    uri: string;
    // 关于token的任何额外metadata，格式为键值对
    additionalMetadata: [string, string][];
}

export const pack = (meta: TokenMetadata): Uint8Array

export function unpack(buffer: Buffer | Uint8Array): TokenMetadata
```

`getTokenMetadata` 函数为给定的币种获取metadata。

该函数有四个参数：
  - `connection`: 要使用的连接
  - `address`: 币种账户
  - `commitment`: 查询状态的期望级别
  - `programId`: SPL Token程序账户（在这种情况下将是Token扩展程序ID）

```ts
export async function getTokenMetadata(
    connection: Connection,
    address: PublicKey,
    commitment?: Commitment,
    programId = TOKEN_2022_PROGRAM_ID
): Promise<TokenMetadata | null>
```

### 使用metadata扩展创建NFT

使用metadata扩展创建NFT与使用metadata指针创建NFT类似，只是需要添加一些额外步骤：

1. 收集所需的账户
2. 找到/决定metadata所需的大小
3. 创建`mint`账户
4. 初始化指针
5. 初始化币种
6. 在币种账户中初始化metadata
7. 如果需要，添加任何其他自定义字段

首先，`mint` 将是一个Keypair，通常使用`Keypair.generate()` 生成。 然后，我们必须决定要包含的metadata并计算总大小和成本。

带有metadata和metadata-pointer扩展的币种账户的大小包括以下内容：

1. 基本metadata字段：名称、符号和URI
2. 我们要存储为metadata的其他自定义字段
3. 可以在将来更改metadata的更新授权机构
4. `@solana/spl-token` 库中的 `LENGTH_SIZE` 和 `TYPE_SIZE` 常数 - 这些是通常与调用`getMintLen` 同时添加的币种扩展的大小，但由于metadata扩展的长度可变，需要手动添加
5. metadata指针数据（这将是币种的地址，出于一致性而这样做）

注意：如果预计会有更多的metadata，就没有必要分配比必要的更多空间！ `createUpdateFieldInstruction` 将自动重新分配空间！但是，您必须添加另一个 `system.transfer` 事务以确保币种账户有足够的租金。

为了以程序方式确定所有这些，我们使用来自`@solana/spl-token` 库的 `getMintLen` 和 `pack` 函数：

```ts
const metadata: TokenMetadata = {
  mint: mint.publicKey,
  name: tokenName,
  symbol: tokenSymbol,
  uri: tokenUri,
  additionalMetadata: [['customField', 'customValue']],
};

const mintAndPointerLen = getMintLen([ExtensionType.MetadataPointer]); // Metadata extension is variable length, so we calculate it below
const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
const totalLen = mintLen + mintAndPointerLen
const lamports = await connection.getMinimumBalanceForRentExemption(totalLen);
```

要实际创建和初始化带metadata的币种和metadata指针，我们需要按特定顺序执行几个指令：

1. 使用 `SystemProgram.createAccount` 创建 `mint` 账户，在区块链上保留空间
2. 使用 `createInitializeMetadataPointerInstruction` 初始化metadata指针扩展
3. 使用 `createInitializeMintInstruction` 初始化币种本身
4. 使用 `createInitializeInstruction` 初始化币种账户中的metadata（仅设置基本metadata字段）
5. 可选：使用 `createUpdateFieldInstruction` 设置自定义字段（每次调用一个字段）

```ts
  const createMintAccountInstructions = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: totalLen,
  });

  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    mint.publicKey, // 指向币种本身作为metadata账户
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMetadataInstruction = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint: mint.publicKey,
    metadata: mint.publicKey,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    mintAuthority: payer.publicKey,
    updateAuthority: payer.publicKey,
  });
  const updateMetadataFieldInstructions = createUpdateFieldInstruction({
    metadata: mint.publicKey,
    updateAuthority: payer.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    field: metadata.additionalMetadata[0][0],
    value: metadata.additionalMetadata[0][1],
  });
  ```

将所有这些指令包裹在一个交易中，以创建嵌入的 NFT：
```ts
const transaction = new Transaction().add(
  createMintAccountInstructions,
  initMetadataPointerInstructions,
  initMintInstructions,
  initMetadataInstruction,
  updateMetadataFieldInstructions, // 如果您想添加任何自定义字段
);
const signature = await sendAndConfirmTransaction(connection, transaction, [payer, mint]);
```

再次强调，这里的顺序很重要。

注意：“createUpdateFieldInstruction”一次只更新一个字段。如果要有多个自定义字段，就必须多次调用此方法。此外，您还可以使用相同的方法来更新基本的元数据字段：

```ts
const updateMetadataFieldInstructions = createUpdateFieldInstruction({
  metadata: mint.publicKey,
  updateAuthority: payer.publicKey,
  programId: TOKEN_2022_PROGRAM_ID,
  field: 'name', // Field | string
  value: 'new name',
});
```

# 实验

现在是时候实践我们迄今所学的知识了。在这个实验中，我们将创建一个脚本，演示如何使用“metadata”和“metadata pointer”扩展来创建一个 NFT。

## 0. 入门

让我们开始克隆我们的起始代码：
```bash
git clone https://github.com/Unboxed-Software/solana-lab-token22-metadata.git
cd solana-lab-token22-metadata
git checkout starter
npm install
```

让我们来看看“starter”分支提供了什么。

除了 NodeJS 项目被初始化并装有所有所需的依赖项外，“src/”目录中还提供了另外两个文件。

- `cat.png`
- `helpers.ts`
- `index.ts`

**`cat.png`** 是我们将用于 NFT 的图像。您可以随意用自己的图像替换它。注意：我们正在使用 Irys 在 devent 上上传文件，大小限制为 100 KiB。

**`helpers.ts`** 文件为我们提供了一个有用的辅助函数“uploadOffChainMetadata”。

`uploadOffChainMetadata` 是一个帮助函数，用于使用 Irys（前身为 Bundlr）在 Arweave 上存储离链元数据。在此实验中，我们将更专注于 Token 扩展程序的交互，因此提供了此上传函数。重要的一点是，NFT 或任何离线元数据都可以存储在任何存储提供程序（如 [NFT.storage](https://nft.storage/)、Solana 的本地 [ShadowDrive](https://www.shdwdrive.com/) 或 [Irys（前身为 Bundlr）](https://irys.xyz/)），最终只需一个指向托管元数据 JSON 文件的 URL。

这个辅助函数有一些导出的接口。在我们编写函数时，这些接口将使我们的函数更加清晰。
```ts
export interface CreateNFTInputs {
  payer: Keypair;
  connection: Connection;
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
  tokenAdditionalMetadata?: Record<string, string>;
}

export interface UploadOffChainMetadataInputs {
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenExternalUrl: string;
  tokenAdditionalMetadata?: Record<string, string>;
  imagePath: string;
	metadataFileName: string;
}
```

**`index.ts`** 是我们将添加代码的地方。现在，代码设置了一个“connection”并为我们初始化了一个“keypair”。

“payer”将负责整个过程中的所有付款。它还将持有所有权威，比如铸造权限、铸造冻结权限等。虽然可以使用不同的密钥对作为权限，但为简单起见，我们将继续使用“payer”。

最后，由于我们正在使用 Irys 将元数据上传到 Arweave 上，因此实验将全部在 devnet 上进行。如果您遇到空投问题，请执行以下操作：
- 将“keypairPath”参数添加到“initializeKeypair”--路径可以通过在终端中运行“solana config get”来获得
- 通过在终端中运行“solana address”来获取密钥对的地址
- 复制地址并从 [faucet.solana](https://faucet.solana.com/) 的 devnet 钱包进行空投一些 devnet sol。

## 1. 上传离链元数据

在本节中，我们将决定我们的 NFT 元数据并使用起始代码提供的辅助函数将文件上传到 NFT.Storage。

为了上传我们的离线元数据，我们首先需要准备一张代表我们的 NFT 的图像。我们提供了“cat.png”，但您可以自由替换为自己的图像。大多数钱包支持大多数图像类型。（再次提醒 devenet Irys 允许每个文件最大为 100KiB）

接下来，让我们决定我们的 NFT 将拥有的元数据。我们决定的字段是“name”、“description”、“symbol”、“externalUrl”以及一些“attributes”（附加元数据）。我们会提供一些有关猫的元数据，但请随意创造出自己的元数据。

- `name`：猫 NFT
- `description`：这是一只猫
- `symbol`：EMB
- `externalUrl`：https://solana.com/
- `attributes`：{ species: '猫' breed: '酷' }

最后，我们只需整理所有这些数据并将其发送到我们的辅助函数“上传离链元数据”中，即可获得已上传元数据的 URI。

当我们把所有这一切放在一起时，"index.ts" 文件将如下所示：

```ts
import { Connection } from '@solana/web3.js';
import { initializeKeypair } from '@solana-developers/helpers';
import { uploadOffChainMetadata } from './helpers';
import dotenv from 'dotenv';
dotenv.config();

const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
const payer = await initializeKeypair(connection, {keypairPath: 'your/path/to/keypair.json'});

const imagePath = 'src/cat.png';
const metadataPath = 'src/temp.json';
const tokenName = 'Cat NFT';
const tokenDescription = 'This is a cat';
const tokenSymbol = 'EMB';
const tokenExternalUrl = 'https://solana.com/';
const tokenAdditionalMetadata = {
  species: 'Cat',
  breed: 'Cool',
}

const tokenUri = await uploadOffChainMetadata({
  tokenName,
  tokenDescription,
  tokenSymbol,
  imagePath,
  metadataPath,
  tokenExternalUrl,
  tokenAdditionalMetadata,
}, payer);

// You can log the URI here and run the code to test it
console.log('Token URI:', tokenUri);
```
现在在您的终端中运行 `npm run start` 并测试您的代码。上传完成后，您应该看到打印的URI。如果您访问该链接，您应该看到一个包含所有我们的链下元数据的JSON对象。



## 2. Create NFT function
创建一个NFT涉及多条指令。在编写与Solana网络交互的脚本时，最佳实践是将所有指令合并在一个交易中，因为交易具有原子性质。这样可以确保所有指令的成功执行，或在出现错误时完全回滚。因此，我们将在名为`src/nft-with-embedded-metadata.ts`的新文件中创建一个名为`createNFTWithEmbeddedMetadata`的新函数。

该函数将执行以下操作创建NFT：

1. 创建元数据对象
2. 分配铸造权
3. 初始化元数据指针，确保指向铸造权本身
4. 初始化铸造权
5. 在铸造权内初始化元数据（设置铸造权的名称、符号和URI）
6. 设置铸造权内的附加元数据
7. 创建关联的代币账户，将NFT铸造到账户中并移除铸造权
8. 将所有操作封装在一个交易中并发送至网络
9. 检索并打印代币账户、铸造权账户和元数据，以确保功能正常运行

这个新函数将接受`helpers.ts`文件中定义的`CreateNFTInputs`作为输入。

作为第一步，让我们创建一个新文件`src/nft-with-embedded-metadata.ts`，并粘贴以下内容：

```typescript
import { Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { CreateNFTInputs } from "./helpers";
import { createInitializeInstruction, createUpdateFieldInstruction, pack, TokenMetadata } from "@solana/spl-token-metadata";
import { AuthorityType, createAssociatedTokenAccountInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, createMintToCheckedInstruction, createSetAuthorityInstruction, ExtensionType, getAccount, getAssociatedTokenAddress, getMint, getMintLen, getTokenMetadata, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TYPE_SIZE } from "@solana/spl-token";

export default async function createNFTWithEmbeddedMetadata(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri, tokenAdditionalMetadata } = inputs;

  // 0. Setup Mint
  // 1. Create the metadata object
  // 2. Allocate the mint
  // 3. Initialize the metadata-pointer making sure that it points to the mint itself
  // 4. Initialize the mint
  // 5. Initialize the metadata inside the mint (that will set name, symbol, and uri for the mint)
  // 6. Set the additional metadata in the mint
  // 7. Create the associated token account and mint the NFT to it and remove the mint authority
  // 8. Put all of that in one transaction and send it to the network
  // 9. fetch and print the token account, the mint account, an the metadata to make sure that it is working correctly
}
```


现在让我们逐一填补这些空白。

对于步骤 0，我们创建薄荷币的密钥对，确保我们 NFT 的小数位为 0，供应量为 1。

```typescript
  // 0. Setup Mint
  const mint = Keypair.generate();
  const decimals = 0; // NFT should have 0 decimals
  const supply = 1; // NFTs should have a supply of 1
```

现在让我们构建从`@solana/spl-token-metadata`接口化的 `TokenMetadata` 对象，并将所有输入传递给它。注意：我们需要对我们的`tokenAdditionalMetadata`进行一些转换以匹配。

```typescript
  // 1. Create the metadata object
  const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: tokenName,
      symbol: tokenSymbol,
      uri: tokenUri,
      // additionalMetadata: [['customField', 'customValue']],
      additionalMetadata: Object.entries(tokenAdditionalMetadata || []).map(([key, value]) => [key, value]),
  };
```

现在我们可以使用`SystemProgram.createAccount`来创建我们的第一个链上指令。为此，我们需要了解我们的NFT的铸造账户的大小。请记住，我们为我们的NFT使用了两个扩展，即`metadata pointer`和`metadata`扩展。另外，由于元数据使用了元数据扩展来“嵌入”，它的长度是可变的。因此，我们结合使用`getMintLen`、`pack`以及一些硬编码的数值来得到最终长度。

然后，我们调用`getMinimumBalanceForRentExemption`来查看启动账户所需的lamports数量。

最后，我们将所有内容放入`SystemProgram.createAccount`函数中，以获得我们的第一个指令：
```typescript
  // 2. Allocate the mint
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const createMintAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      lamports,
      newAccountPubkey: mint.publicKey,
      programId: TOKEN_2022_PROGRAM_ID,
      space: mintLen,
  });
```

请注意：元数据中包含的信息越多，费用就越高。

在第三步中，我们正在初始化 `metadata pointer` 扩展。让我们通过调用 `createInitializeMetadataPointerInstruction` 函数来做到这一点，其中元数据账户指向我们的货币。

```typescript
// 3. Initialize the metadata-pointer making sure that it points to the mint itself
const initMetadataPointerInstruction = createInitializeMetadataPointerInstruction(
  mint.publicKey,
  payer.publicKey,
  mint.publicKey, // Metadata account - points to itself
  TOKEN_2022_PROGRAM_ID,
);
```

接下来是`createInitializeMintInstruction`。请注意，在初始化元数据之前我们要执行这个操作。
```typescript
// 4. Initialize the mint
const initMintInstruction = createInitializeMintInstruction(
  mint.publicKey,
  decimals,
  payer.publicKey,
  payer.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

现在我们可以使用`createInitializeInstruction`来初始化我们的元数据。我们传入所有的 NFT 元数据，除了我们的`tokenAdditionalMetadata`，这部分将在下一步中处理。
```typescript
// 5. 在Mint中初始化元数据
const initMetadataInstruction = createInitializeInstruction({
  programId: TOKEN_2022_PROGRAM_ID,
  mint: mint.publicKey,
  metadata: mint.publicKey,
  name: metadata.name,
  symbol: metadata.symbol,
  uri: metadata.uri,
  mintAuthority: payer.publicKey,
  updateAuthority: payer.publicKey,
});
```

在我们的NFT中，我们有`tokenAdditionalMetadata`，正如我们在上一步中所看到的，这不能使用`createInitializeInstruction`来设置。因此，我们必须制作一条指令来为每个新的额外字段设置。我们通过调用`createUpdateFieldInstruction`来完成这件事。

```typescript
// 6. 在Mint中设置额外的元数据
const setExtraMetadataInstructions = [];
for (const attributes of Object.entries(tokenAdditionalMetadata || [])) {
    setExtraMetadataInstructions.push(
        createUpdateFieldInstruction({
            updateAuthority: payer.publicKey,
            metadata: mint.publicKey,
            field: attributes[0],
            value: attributes[1],
            programId: TOKEN_2022_PROGRAM_ID,
        })
    )
}
```

现在让我们将这个NFT铸造给自己，然后撤销Mint权限。这将使它成为一个真正的NFT，永远只会有一个。我们可以通过以下函数来实现：

- `createAssociatedTokenAccountInstruction`
- `createMintToCheckedInstruction`
- `createSetAuthorityInstruction`

```typescript
// 7. 创建关联的代币账户并将NFT铸造到其中并移除Mint权限
const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
const createATAInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
);

const mintInstruction = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    supply, // NFTs should have a supply of one
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
);

// NFTs should have no mint authority so no one can mint any more of the same NFT
const setMintTokenAuthorityInstruction = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
);
```

现在，让我们将我们的所有交易捆绑在一起，发送到Solana网络。非常重要的是要注意顺序的问题。

```typescript
// 8. 将所有内容放入一个交易中并发送到网络。
const transaction = new Transaction().add(
    createMintAccountInstruction,
    initMetadataPointerInstruction,
    initMintInstruction,
    initMetadataInstruction,
    ...setExtraMetadataInstructions,
    createATAInstruction,
    mintInstruction,
    setMintTokenAuthorityInstruction,
);
const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [payer, mint]);
```

最后，让我们获取并打印有关我们的NFT的所有信息，以确保一切都运行正常。

```typescript
// 9. 获取并打印代币账户、Mint账户和元数据，以确保一切都正常运行。
// 获取账户
const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
console.log('关联的代币账户 =====>', accountDetails);

// 获取Mint
const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
console.log('Mint =====>', mintDetails);

// 因为Mint自身存储元数据，所以我们可以像这样获取它
const onChainMetadata = await getTokenMetadata(connection, mint.publicKey);
// 现在我们可以查看Mint中的元数据
console.log('链上元数据 =====>', onChainMetadata);

// 我们甚至可以获取到链下的JSON
if (onChainMetadata && onChainMetadata.uri) {
    const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
    console.log('Mint链下元数据 =====>', offChainMetadata);
}
```

将这些内容放在一起，你会得到`src/nft-with-embedded-metadata.ts`中的以下内容：


```ts
import { Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { CreateNFTInputs } from "./helpers";
import { createInitializeInstruction, createUpdateFieldInstruction, pack, TokenMetadata } from "@solana/spl-token-metadata";
import { AuthorityType, createAssociatedTokenAccountInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, createMintToCheckedInstruction, createSetAuthorityInstruction, ExtensionType, getAccount, getAssociatedTokenAddress, getMint, getMintLen, getTokenMetadata, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TYPE_SIZE } from "@solana/spl-token";

export default async function createNFTWithEmbeddedMetadata(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri, tokenAdditionalMetadata } = inputs;

  // 0. Setup Mint
  const mint = Keypair.generate();
  const decimals = 0; // NFT should have 0 decimals
  const supply = 1; // NFTs should have a supply of one

  // 1. Create the metadata object
  const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: tokenName,
      symbol: tokenSymbol,
      uri: tokenUri,
      // additionalMetadata: [['customField', 'customValue']],
      additionalMetadata: Object.entries(tokenAdditionalMetadata || []).map(([key, value]) => [key, value]),
  };

  // 2. Allocate the mint
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const createMintAccountInstruction = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      lamports,
      newAccountPubkey: mint.publicKey,
      programId: TOKEN_2022_PROGRAM_ID,
      space: mintLen,
  });

  // 3. Initialize the metadata-pointer making sure that it points to the mint itself
  const initMetadataPointerInstruction = createInitializeMetadataPointerInstruction(
      mint.publicKey,
      payer.publicKey,
      mint.publicKey, // Metadata account - points to itself
      TOKEN_2022_PROGRAM_ID,
  );

  // 4. Initialize the mint
  const initMintInstruction = createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      payer.publicKey,
      payer.publicKey,
      TOKEN_2022_PROGRAM_ID,
  );

  // 5. Initialize the metadata inside the mint
  const initMetadataInstruction = createInitializeInstruction({
  programId: TOKEN_2022_PROGRAM_ID,
  mint: mint.publicKey,
  metadata: mint.publicKey,
  name: metadata.name,
  symbol: metadata.symbol,
  uri: metadata.uri,
  mintAuthority: payer.publicKey,
  updateAuthority: payer.publicKey,
  });

  // 6. Set the additional metadata in the mint
  const setExtraMetadataInstructions = [];
  for (const attributes of Object.entries(tokenAdditionalMetadata || [])) {
      setExtraMetadataInstructions.push(
          createUpdateFieldInstruction({
              updateAuthority: payer.publicKey,
              metadata: mint.publicKey,
              field: attributes[0],
              value: attributes[1],
              programId: TOKEN_2022_PROGRAM_ID,
          })
      )
  }

  // 7. Create the associated token account and mint the NFT to it and remove the mint authority
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstruction = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      ata,
      payer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
  );

  const mintInstruction = createMintToCheckedInstruction(
      mint.publicKey,
      ata,
      payer.publicKey,
      supply, // NFTs should have a supply of one
      decimals,
      undefined,
      TOKEN_2022_PROGRAM_ID,
  );

  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const setMintTokenAuthorityInstruction = createSetAuthorityInstruction(
      mint.publicKey,
      payer.publicKey,
      AuthorityType.MintTokens,
      null,
      undefined,
      TOKEN_2022_PROGRAM_ID,
  );

  // 8. Put all of that in one transaction and send it to the network.
  const transaction = new Transaction().add(
      createMintAccountInstruction,
      initMetadataPointerInstruction,
      initMintInstruction,
      initMetadataInstruction,
      ...setExtraMetadataInstructions, // Destructuring extra metadata fields
      createATAInstruction,
      mintInstruction,
      setMintTokenAuthorityInstruction,
  );
  const transactionSignature = await sendAndConfirmTransaction(connection, transaction, [payer, mint]);

  // 9. fetch and print the token account, the mint account, an the metadata to make sure that it is working correctly.
  // Fetching the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Fetching the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // Since the mint stores the metadata in itself, we can just get it like this
  const onChainMetadata = await getTokenMetadata(connection, mint.publicKey);
  // Now we can see the metadata coming with the mint
  console.log('On-chain metadata =====>', onChainMetadata);

  // And we can even get the off-chain JSON now
  if (onChainMetadata && onChainMetadata.uri) {
      const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
      console.log('Mint off-chain metadata =====>', offChainMetadata);
  }
}
```

## 3. 调用创建NFT函数

让我们在`src/index.ts`中将所有东西放在一起。

返回到`src/index.ts`，并从我们刚刚创建的文件中导入函数`createNFTWithEmbeddedMetadata`。

```ts
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';
```

然后在主函数的末尾调用它并传递所需的参数。

```ts
await createNFTWithEmbeddedMetadata({
  payer,
  connection,
  tokenName,
  tokenSymbol,
  tokenUri,
});
```

`src/index.ts`文件应该如下所示:
```ts
import { Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';
import dotenv from 'dotenv';
dotenv.config();

const connection = new Connection('http://127.0.0.1:8899', 'finalized');
const payer = await initializeKeypair(connection);

const imagePath = 'NFT.png';
const tokenName = 'NFT名称';
const tokenDescription = '这是一个很酷的Token Extension NFT';
const tokenSymbol = 'TTT';

const tokenUri = await uploadOffChainMetadata({
  connection,
  payer,
  tokenName,
  tokenDescription,
  tokenSymbol,
  imagePath,
});

// 您可以在此处记录URI并运行代码进行测试
console.log('Token URI:', tokenUri);

await createNFTWithEmbeddedMetadata({
  payer,
  connection,
  tokenName,
  tokenSymbol,
  tokenUri,
});
```

再次运行程序以查看您的NFT和元数据。

```bash
npm run start
```

你做到了！您使用了`metadata`和`metadata pointer`扩展制作了一个NFT。

如果遇到任何问题，请查看[解决方案](https://github.com/Unboxed-Software/solana-lab-token22-metadata/tree/solution)。

# 挑战
根据您在此处学到的知识，去创建自己的NFT或SFT吧。

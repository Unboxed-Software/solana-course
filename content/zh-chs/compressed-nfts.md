---
title: 压缩NFT
objectives:
- 使用Metaplex的Bubblegum程序创建压缩NFT集合
- 使用Bubblegum TS SDK铸造压缩NFT
- 使用Bubblegum TS SDK转移压缩NFT
- 使用Read API读取压缩NFT数据
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- **压缩NFT（cNFT）** 使用 **状态压缩** 来散列NFT数据，并在链上的账户中使用 **并发Merkle树** 结构存储散列
- cNFT数据散列无法用于推断cNFT数据，但可以用于 **验证** 所见的cNFT数据是否正确
- 支持的RPC提供程序会在铸造时将cNFT数据 **索引** 到链下，以便使用 **Read API** 访问数据
- **Metaplex Bubblegum程序** 是对 **状态压缩** 程序的抽象，可让您更简单地创建、铸造和管理cNFT集合

# 课程

压缩NFT（cNFT）正如其名，是占用比传统NFT更少账户存储空间的NFT结构。压缩NFT利用称为 **状态压缩** 的概念以极大降低成本存储数据。

Solana的交易成本如此便宜，以至于大多数用户从未考虑到大规模铸造NFT可能有多昂贵。铸造和设置100万个传统NFT的成本约为24,000枚SOL。相比之下，cNFT可以构造成相同设置和铸造成本约为10枚SOL或更低。这意味着任何大规模使用NFT的人都可以通过使用cNFT而非传统NFT，将成本削减将超过1000倍。

但是，cNFT可能需要仔细处理。最终，用于处理它们的工具将被充分抽象化，让传统NFT和cNFT之间的开发体验变得微不足道。但目前，您仍需要了解低级拼图，因此让我们深入理解吧！

## cNFT的理论概述

与传统NFT相关的大部分成本归咎于账户存储空间。压缩NFT利用称为状态压缩的概念，以较低的成本将数据存储在区块链的更便宜的 **分类帐状态** 上，仅使用更昂贵的账户空间来存储数据的 “指纹” 或 **散列**。此散列允许您以加密方式验证数据是否被篡改。

为了存储散列和启用验证，我们使用了一种称为 **并发Merkle树** 的特殊二叉树结构。该树结构让我们以确定的方式一起散列数据，计算出单个最终散列，并将其存储在链上。最终散列的大小远远小于所有原始数据的组合，故名为 “压缩”。该过程步骤包括：

1. 获取任何数据
2. 创建该数据的散列
3. 将此散列作为树底部的 “叶子” 存储
4. 然后将每个叶子对逐一散列在一起，创建一个 “分支”
5. 然后将每个分支逐一散列在一起
6. 继续上树并连续将相邻分支散列在一起
7. 到达树顶端后，产生一个最终的 ”根散列“
8. 将根散列在链上存储，作为每个叶子内数据的可验证证据
9. 任何希望验证其数据是否与 “真相来源” 匹配的人可以进行相同的过程，并比较最终散列，无需将所有数据存储在链上

上述未解决的一个问题是如何使数据可用，即使无法从账户中获取。由于这个散列过程在链上发生，所有数据存在于分类帐状态中，并且理论上可以通过重播整个链状态来从原始交易找回。但是，更简单（虽然仍然复杂）的方法是让一个 **索引器** 跟踪并索引随着交易发生的数据。这确保了存在一个链下数据的 “缓存”，任何人都可以访问并随后与链上根散列进行验证。

这个过程非常 *复杂*。我们将在下面介绍其中一些关键概念，但如果您不立刻理解，也不用担心。我们将在状态压缩课程中讨论更多理论，并在本课程中重点关注应用于NFTs。即使您对状态压缩拼图的每个部分尚未完全理解，您最终将能够在本课程结束时处理cNFT。

### 并发Merkle树

**Merkle树** 是由单个散列表示的二叉树结构。结构中的每个叶节点都是其内部数据的散列，而每个分支都是其子叶散列的散列。相应地，分支也逐一散列在一起，最终留下一个最终根散列。

对叶数据的任何修改都会更改根散列。当同一时隙内的多个交易尝试修改叶数据时，必须以顺序执行这些交易，除第一次执行的交易外，其他所有交易都将失败，因为根散列和证明将被第一个交易使无效。

**并发Merkle树** 是存储最近更改的安全更改日志以及其根散列和派生它的证明的Merkle树。当同一时隙中的多个交易尝试修改叶数据时，更改日志可用于作为真实来源，以允许对树进行并发更改。

在处理并发Merkle树时，有三个变量确定着树的大小、创建树的成本以及可以对树进行的并发更改的数量：

1. 最大深度
2. 最大缓冲区大小
3. 树冠深度

**最大深度** 是从任何叶到树根的最大跳数。由于Merkle树是二叉树，每个叶仅连接到另一个叶。可以逻辑推断出最大深度用于计算具有 `2 ^ maxDepth` 节点数的树。

**最大缓冲区大小** 实际上是在单个时隙内可以对树进行的最大并发更改的数量，同时仍然保持根散列有效。

**树冠深度** 是存储在链上的任何给定证明路径的证明节点数量。验证任何叶子节点需要完整的树证明路径。完整的证明路径由树的每一条 “层” 的一个证明节点组成，即最大深度为14意味着有14个证明节点。每个证明节点在交易中添加32字节，因此大型树很快就会超过最大交易大小限制，而不将证明节点缓存到链上。

这三个值，最大深度、最大缓冲区大小和树冠深度，都会伴随着权衡。增加任一值的数值会增加用于存储树的账户的大小，从而增加创建树的成本。



选择最大深度相当直接，因为它直接关系到叶子节点的数量，因此也影响了你可以存储的数据量。如果你需要在单棵树上有一百万个cNFTs，那么找到使以下表达式为真的最大深度： `2^maxDepth > 1百万` 。答案是20。

选择最大缓冲区大小实际上是一个关于吞吐量的问题：你需要多少并发写入。

### SPL状态压缩和Noop程序

SPL状态压缩程序的存在使得上述过程在Solana生态系统中是可重复的并且可组合的。它提供了初始化Merkle树，管理树叶节点（即添加、更新、删除数据）和验证叶节点数据的说明。

状态压缩程序还利用一个单独的“无操作”程序，其主要目的是将叶节点数据更容易地索引，通过将其记录到分类账状态中。

### 使用分类账状态进行存储

Solana分类账是一个包含已签名交易的条目列表。理论上，这可以追溯到创世区块。这实际上意味着任何曾经被放入交易中的数据都存在于分类账中。

当你想要存储压缩的数据时，你将其传递给状态压缩程序进行哈希处理，并作为一个“事件”发出到无操作程序。哈希值然后存储在相应的并发Merkle树中。由于数据经过了交易，甚至存在于无操作程序的日志中，它将永远存在于分类账状态中。

### 便于查找的索引数据

在正常情况下，你通常会通过获取适当的账户来访问链上数据。然而，当使用状态压缩时，情况并不那么简单。

如上所述，该数据现在存在于分类账状态中，而不是账户中。找到完整数据的最简单地方在于无操作指令的日志中，但是，尽管这些数据在某种意义上将永远存在于分类账状态中，但在一段时间后，它们可能在验证器处无法访问了。

为了节省空间并提高性能，验证器并不会保留每一笔交易，直到创世区块。根据验证器，你能够访问无操作指令日志以获取相关数据的具体时间将会有所不同，但最终，如果你直接依赖指令日志，你将失去对它的访问。

在技术上，*你可以*重放交易状态到创世区块，但一般团队不会这样做，而且它肯定不会高效。相反地，你应该使用一个索引程序，观察发送到无操作程序的事件并将相关数据存储在链下。这样一来，你就无需担心旧数据无法访问了。

## 创建cNFT集合

理论背景已经了解，现在让我们关注本课的重点：如何创建一个cNFT集合。

幸运的是，你可以使用由Solana基金会、Solana开发社区和Metaplex创建的工具来简化这个过程。具体来说，我们将使用 `@solana/spl-account-compression` SDK、Metaplex Bubblegum程序以及Bubblegum程序的对应TS SDK `@metaplex-foundation/mpl-bubblegum`。

<aside>
💡 在撰写本文时，Metaplex团队正在转向一个新的bubblegum客户端SDK，该SDK支持umi，这是一个构建和使用Solana程序的JS客户端模块化框架。本课中我们不会使用umi版本的SDK。相反，我们将硬编码我们的版本依赖为0.7 (`@metaplex-foundation/mpl-bubblegum@0.7`)。这个版本提供了用于构建Bubblegum指令的简单辅助函数。

</aside>

### 准备元数据

在开始之前，你需要像使用糖果机一样准备你的NFT元数据。在本质上，NFT只是一个遵循NFT标准的包含元数据的代币。换句话说，它应该类似于这样：

```json
{
  "name": "12_217_47",
  "symbol": "RGB",
  "description": "随机RGB色彩",
  "seller_fee_basis_points": 0,
  "image": "https://raw.githubusercontent.com/ZYJLiu/rgb-png-generator/master/assets/12_217_47/12_217_47.png",
  "attributes": [
    {
      "trait_type": "R",
      "value": "12"
    },
    {
      "trait_type": "G",
      "value": "217"
    },
    {
      "trait_type": "B",
      "value": "47"
    }
  ]
}
```

根据你的用例，你可能可以动态生成它，也可以事先为每个cNFT准备一个JSON文件。你还需要为JSON所引用的任何其他资产准备，比如上述示例中展示的`image`url。

### 创建集合NFT

如果你希望你的cNFTs成为集合的一部分，你需要在开始铸造cNFTs之前**先**创建一个集合NFT。这是一个传统的NFT，它作为将你的cNFTs绑定到单个集合中的参考。你可以使用 `@metaplex-foundation/js` 库创建这个NFT。只需确保将`isCollection`设置为`true`。

```tsx
const collectionNft = await metaplex.nfts().create({
    uri: someUri,
    name: "集合NFT",
    sellerFeeBasisPoints: 0,
    updateAuthority: somePublicKey,
    mintAuthority: somePublicKey,
    tokenStandard: 0,
    symbol: "Collection",
    isMutable: true,
    isCollection: true,
})
```

### 创建Merkle树账户

现在我们开始偏离创建传统NFT时所使用的程序。你用于状态压缩的链上存储机制是代表并发Merkle树的一个账户。这个Merkle树账户属于SPL状态压缩程序。在你可以进行与cNFT相关的任何操作之前，你需要创建一个具有适当大小的空Merkle树账户。

影响账户大小的变量有：

1. 最大深度
2. 最大缓冲区大小
3. Canopy深度

前两个变量必须从一组现有的有效对中选择。下表显示了这些有效对以及可以用这些值创建多少个cNFTs。

| 最大深度 | 最大缓冲区大小 | Canopy深度 | 可创建的cNFT数量 |
| ------------ | -------------------- | -------------- | -------------------- |
| 20                 | 1MB                    | 40                  | 775,433              |
| 21                 | 2MB                    | 42                  | 2,023,847             |
| 22                 | 4MB                    | 44                  | 5,230,107             |
| 23                 | 8MB                    | 46                  | 10,716,382           |

*注意：本翻译仅供参考，具体术语应以实际学术术语表达为准。*



| 最大深度 | 最大缓冲区大小 | cNFT的最大数量 |
| --- | --- | --- |
| 3 | 8 | 8 |
| 5 | 8 | 32 |
| 14 | 64 | 16,384 |
| 14 | 256 | 16,384 |
| 14 | 1,024 | 16,384 |
| 14 | 2,048 | 16,384 |
| 15 | 64 | 32,768 |
| 16 | 64 | 65,536 |
| 17 | 64 | 131,072 |
| 18 | 64 | 262,144 |
| 19 | 64 | 524,288 |
| 20 | 64 | 1,048,576 |
| 20 | 256 | 1,048,576 |
| 20 | 1,024 | 1,048,576 |
| 20 | 2,048 | 1,048,576 |
| 24 | 64 | 16,777,216 |
| 24 | 256 | 16,777,216 |
| 24 | 512 | 16,777,216 |
| 24 | 1,024 | 16,777,216 |
| 24 | 2,048 | 16,777,216 |
| 26 | 512 | 67,108,864 |
| 26 | 1,024 | 67,108,864 |
| 26 | 2,048 | 67,108,864 |
| 30 | 512 | 1,073,741,824 |
| 30 | 1,024 | 1,073,741,824 |
| 30 | 2,048 | 1,073,741,824 |

请注意，可以存储在树上的cNFT数完全取决于最大深度，而缓冲区大小将确定在同一槽内可以同时发生的并发更改（铸造、转移等）的数量。换句话说，选择与您需要树保存的NFT数量对应的最大深度，然后根据您希望支持的交通量选择最大缓冲区大小选项之一。

接下来，选择树冠深度。增加树冠深度可以增加cNFT的复合性。每当您或其他开发人员的代码试图验证沿着道路下降的cNFT时，代码将不得不传递与树中“层”数量一样多的证明节点。因此，对于最大深度为20，您需要传递20个证明节点。这不仅很繁琐，而且由于每个证明节点为32字节，很快就可能耗尽交易大小。

例如，如果您的树冠深度很低，NFT市场可能只能支持简单的NFT转移，而不是为您的cNFT支持在链上竞价系统。树冠有效地在链上缓存证明节点，因此您不必将它们全部传递到交易中，从而允许更复杂的交易。

增加这三个值中的任何一个都会增加帐户的大小，从而增加与创建相关的成本。在选择值时，请权衡利弊。

一旦您知道这些值，就可以使用`@solana/spl-account-compression` TS SDK中的`createAllocTreeIx`辅助函数创建用于创建空帐户的指令。

```tsx
import { createAllocTreeIx } from "@solana/spl-account-compression"

const treeKeypair = Keypair.generate()

const allocTreeIx = await createAllocTreeIx(
  connection,
  treeKeypair.publicKey,
  payer.publicKey,
  { maxDepth: 20; maxBufferSize: 256 },
  canopyDepth
)
```

请注意，这只是一个帮助函数，用于计算帐户所需的大小并创建要发送到系统程序以分配帐户的指令。此函数尚未与任何特定于压缩的程序交互。

### 使用Bubblegum初始化您的树

创建空的树帐户后，您可以使用Bubblegum程序初始化树。除了Merkle树帐户之外，Bubblegum还创建了一个树配置帐户以添加特定于cNFT的跟踪和功能。

`@metaplex-foundation/mpl-bubblegum` TS SDK的0.7版本提供了`createCreateTreeInstruction`帮助函数，用于调用Bubblegum程序上的`create_tree`指令。作为调用的一部分，您需要派生出程序所期望的`treeAuthority` PDA。此PDA使用树的地址作为种子。

```tsx
import {
	createAllocTreeIx,
	SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression"
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createCreateTreeInstruction,
} from "@metaplex-foundation/mpl-bubblegum"

...

const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
  [treeKeypair.publicKey.toBuffer()],
  BUBBLEGUM_PROGRAM_ID
)

const createTreeIx = createCreateTreeInstruction(
  {
    treeAuthority,
    merkleTree: treeKeypair.publicKey,
    payer: payer.publicKey,
    treeCreator: payer.publicKey,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  },
  {
    maxBufferSize: 256,
    maxDepth: 20,
    public: false,
  },
  BUBBLEGUM_PROGRAM_ID
)
```

下面的列表显示了此辅助函数所需的输入：

- `accounts` - 表示指令所需的帐户的对象。包括：
    - `treeAuthority` - Bubblegum希望此帐户是使用Merkle树地址作为种子推导而来的PDA
    - `merkleTree` - Merkle树帐户
    - `payer` - 支付交易费用、租金等的地址
    - `treeCreator` - 要列为树创建者的地址
    - `logWrapper` - 用于通过日志向索引器公开数据的程序；这应该是SPL Noop程序的地址，除非您有其他自定义实现
    - `compressionProgram` - 用于初始化Merkle树的压缩程序；这应该是SPL State Compression程序的地址，除非您有其他自定义实现
- `args` - 表示指令所需的额外参数的对象。包括：
    - `maxBufferSize` - Merkle树的最大缓冲区大小
    - `maxDepth` - Merkle树的最大深度
    - `public` - 当设置为`true`时，任何人都可以从树中铸造cNFT；当设置为`false`时，只有树创建者或树委托才能从树中铸造cNFT



提交时，这将在Bubblegum程序上调用`create_tree`指令。该指令会执行三件事：

1. 创建树配置PDA账户
2. 用适当的初始值初始化树配置账户
3. 向状态压缩程序发出CPI，以初始化空的Merkle树账户

可以在这里查看程序代码 [here](https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/programs/bubblegum/program/src/lib.rs#L887)。

### 铸造cNFTs

有了Merkle树账户及其对应的Bubblegum树配置账户，就可以向树中铸造cNFTs。使用的Bubblegum指令将是`mint_v1`或`mint_to_collection_v1`，具体取决于您是否希望铸造的cNFT是一个集合的一部分。

版本0.7的`@metaplex-foundation/mpl-bubblegum` TS SDK提供了`createMintV1Instruction`和`createMintToCollectionV1Instruction`助手函数，使您更容易创建指令。

这两个函数都需要您传递NFT元数据和一系列铸造cNFT所需的账户。以下是一个向集合铸造的示例：

```tsx
const mintWithCollectionIx = createMintToCollectionV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    collectionAuthority: payer.publicKey,
    collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID,
    collectionMint: collectionDetails.mint,
    collectionMetadata: collectionDetails.metadata,
    editionAccount: collectionDetails.masterEditionAccount,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
    bubblegumSigner,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  },
  {
    metadataArgs: Object.assign(nftMetadata, {
      collection: { key: collectionDetails.mint, verified: false },
    }),
  }
)
```

注意助手函数有两个参数：`accounts`和`args`。`args`参数只是NFT元数据，而`accounts`是一个列出指令所需的账户的对象。不可否认，其中有很多账户：

- `payer` - 将支付交易费用、租金等的账户
- `merkleTree` - Merkle树账户
- `treeAuthority` - 树授权者；应该与之前推导的PDA相同
- `treeDelegate` - 树代理；通常与树创建者相同
- `leafOwner` - 被压缩的NFT的期望所有者
- `leafDelegate` - 被铸造的压缩NFT的期望代理；通常与所有者相同
- `collectionAuthority` - 集合NFT的权限
- `collectionAuthorityRecordPda` - 可选的集合权限记录PDA；通常没有，这种情况下，应该放置Bubblegum程序地址
- `collectionMint` - 集合NFT的铸造账户
- `collectionMetadata` - 集合NFT的元数据账户
- `editionAccount` - 集合NFT的主版本账户
- `compressionProgram` - 要使用的压缩程序；这应该是SPL State Compression程序的地址，除非您有其他自定义实现
- `logWrapper` - 用于通过日志向索引器公开数据的程序；这应该是SPL Noop程序的地址，除非您有其他自定义实现
- `bubblegumSigner` - Bubblegrum程序用于处理集合验证的PDA
- `tokenMetadataProgram` - 用于集合NFT的token元数据程序；通常始终是Metaplex Token Metadata程序

无需集合的铸造需要更少的账户，其中没有一个是专门用于无需集合的铸造。您可以查看下面的示例。

```tsx
const mintWithoutCollectionIx = createMintV1Instruction(
  {
    payer: payer.publicKey,
    merkleTree: treeAddress,
    treeAuthority,
    treeDelegate: payer.publicKey,
    leafOwner: destination,
    leafDelegate: destination,
    compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    logWrapper: SPL_NOOP_PROGRAM_ID,
  },
  {
    message: nftMetadata,
  }
)
```

## 与cNFTs交互

重要的是要注意，cNFTs *不是* SPL代币。这意味着您的代码需要遵循不同的约定来处理cNFT功能，如获取、查询、转移等。

### 获取cNFT数据

从现有的cNFT中获取数据最简单的方法是使用[Digital Asset Standard Read API](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata)（Read API）。请注意，这与标准的JSON RPC是分开的。要使用Read API，您需要使用支持的RPC提供者。Metaplex维护了一个（可能不是穷尽的）[RPC提供者列表](https://developers.metaplex.com/bubblegum/rpcs)，它们支持Read API。在本课中，我们将使用[Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api)，因为他们免费支持Devnet。

要使用Read API获取特定cNFT的数据，您需要有cNFT的资产ID。然而，在铸造cNFTs之后，您可能最多只有两条信息：

1. 交易签名
2. 叶索引（可能）

唯一的真正保证是您会有交易签名。**可能**可以从中找到叶索引，但这涉及到一些相当复杂的解析。简而言之，您必须从Noop程序中检索相关的指令日志并解析它们以找到叶索引。我们将在未来的课程中更深入地讨论这个问题。目前，我们假设您知道叶索引。

对于大多数铸造来说，这是一个合理的假设，因为铸造将由您的代码控制，并且可以按顺序设置，以便您的代码可以跟踪每次铸造将使用的索引。即第一次铸造将使用索引0，第二次将使用索引1，依此类推。

一旦您有了叶索引，就可以派生出cNFT对应的资产ID。使用Bubblegum时，资产ID是使用Bubblegum程序ID和以下种子派生的PDA：

1. 在utf8编码中表示的静态字符串`asset`
2. Merkle树地址
3. 叶索引



索引器基本上会观察Noop程序中的事务日志，并在发生时存储在Merkle树中进行哈希和存储的cNFT元数据。这使它们能够在请求时提供这些数据。资产ID是索引器用来标识特定资产的标识符。

为简单起见，您可以只使用Bubblegum SDK中的`getLeafAssetId`辅助函数。有了资产ID，获取cNFT就相当简单。只需使用支持的RPC提供程序提供的`getAsset`方法：

```tsx
const assetId = await getLeafAssetId(treeAddress, new BN(leafIndex))
const response = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
		params: {
			id: assetId,
		},
	}),
})

const { result } = await response.json()
console.log(JSON.stringify(result, null, 2))
```

这将返回一个包含传统NFT上下文和链下元数据的综合JSON对象。例如，您可以在`content.metadata.attributes`找到cNFT的属性，或者在`content.files.uri`找到图像。

### 查询cNFTs

读取API还包括了通过所有者、创建者等方式获取多个资产的方法。例如，Helius支持以下方法：

- `getAsset`
- `getSignaturesForAsset`
- `searchAssets`
- `getAssetProof`
- `getAssetsByOwner`
- `getAssetsByAuthority`
- `getAssetsByCreator`
- `getAssetsByGroup`

我们不会直接解释这些大部分方法，但请务必仔细阅读[Helius文档](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api)，以了解如何正确使用它们。

### 转移cNFTs

与标准的SPL代币转移一样，安全性至关重要。然而，SPL代币转移使得验证转移权限变得非常容易。它内置于SPL Token程序和标准签名中。压缩代币的所有权验证则更加困难。实际验证将在程序端进行，但您的客户端代码需要提供额外的信息以使其成为可能。

虽然有一个Bubblegum `createTransferInstruction`辅助函数，但与通常情况下相比，还需要更多的组装过程。具体来说，Bubblegum程序需要验证客户端断言的cNFT数据的所有内容，然后才能进行转移。cNFT数据的全部内容已被哈希并存储为Merkle树上的单个叶子，而Merkle树简单地是树的所有叶子和分支的哈希。因此，您不能简单地告诉程序查看哪个账户并要求其将该账户的`authority`或`owner`字段与交易签名者进行比较。

相反，您需要提供cNFT数据的全部内容以及在椽罩中未存储的Merkle树的任何证明信息。这样，程序可以独立证明所提供的cNFT数据，从而证明cNFT的所有者是准确的。只有在这种情况下，程序才能安全地确定交易签名者是否应该被允许转移cNFT。

在广义条件下，这涉及以下五个步骤：

1. 从索引器中提取cNFT的资产数据
2. 从索引器中提取cNFT的证明
3. 从Solana区块链中提取Merkle树账户
4. 准备资产证明作为`AccountMeta`对象的列表
5. 构建并发送Bubblegum转移指令

前两个步骤非常相似。使用您的支持RPC提供商，使用`getAsset`和`getAssetProof`方法分别获取资产数据和证明。 

```tsx
const assetDataResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAsset",
			params: {
				id: assetId,
			},
		}),
	})
const assetData = (await assetDataResponse.json()).result

const assetProofResponse = await fetch(process.env.RPC_URL, {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: "my-id",
		method: "getAssetProof",
			params: {
				id: assetId,
			},
		}),
	})
const assetProof = (await assetProofResponse.json()).result
```

第三步是获取Merkle树账户。最简单的方法是使用`@solana/spl-account-compression`中的`ConcurrentMerkleTreeAccount`类型：

```tsx
const treePublicKey = new PublicKey(assetData.compression.tree)

const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
	connection,
	treePublicKey
)
```

第四步是最具概念挑战性的步骤。使用收集的三个信息，您需要为cNFT的相应叶子组装证明路径。证明路径被表示为传递给程序指令的帐户。
程序使用每个帐户地址作为证明节点，以证明叶子数据是您所说的。

完整的证明由前面在`assetProof`中显示的索引器提供。然而，您可以从证明中排除与椽罩的深度相同数量的尾部帐户。

```tsx
const canopyDepth = treeAccount.getCanopyDepth() || 0

const proofPath: AccountMeta[] = assetProof.proof
	.map((node: string) => ({
	pubkey: new PublicKey(node),
	isSigner: false,
	isWritable: false
}))
.slice(0, assetProof.proof.length - canopyDepth)
```

最后，您可以组装转移指令。指令辅助函数`createTransferInstruction`需要以下参数：



- `accounts` - 一组指令账号，如预期的那样; 它们如下所示:
  - `merkleTree` - Merkle树账户
  - `treeAuthority` - Merkle树权限
  - `leafOwner` - 所讨论的叶子（cNFT）的所有者
  - `leafDelegate` - 所讨论的叶子（cNFT）的代表; 如果没有添加代表，则应与`leafOwner`相同
  - `newLeafOwner` - 转移后的新所有者地址
  - `logWrapper` - 用于通过日志向索引器公开数据的程序; 除非有其他自定义实现，否则应为SPL Noop程序的地址
  - `compressionProgram` - 要使用的压缩程序; 除非有其他自定义实现，否则应为SPL状态压缩程序的地址
  - `anchorRemainingAccounts` - 这是您添加证明路径的位置
- `args` - 指令需要的额外参数; 它们是:
  - `root` - 资产证明中的根Merkle树节点; 这由索引器提供为字符串，必须首先转换为字节
  - `dataHash` - 从索引器检索的资产数据的哈希; 这由索引器提供为字符串，必须首先转换为字节
  - `creatorHash` - 从索引器检索的cNFT创建者的哈希; 这由索引器提供为字符串，必须首先转换为字节
  - `nonce` - 用于确保没有两个叶子具有相同的哈希; 这个值应与`index`相同
  - `index` - cNFT的叶子在Merkle树上的位置

下面显示了一个示例。请注意，代码的前3行获取了先前显示的对象中嵌套的附加信息，因此它们在组装指令本身时已经准备就绪。

```tsx
const treeAuthority = treeAccount.getAuthority()
const leafOwner = new PublicKey(assetData.ownership.owner)
const leafDelegate = assetData.ownership.delegate
	? new PublicKey(assetData.ownership.delegate)
	: leafOwner

const transferIx = createTransferInstruction(
	{
		merkleTree: treePublicKey,
		treeAuthority,
		leafOwner,
		leafDelegate,
		newLeafOwner: receiver,
		logWrapper: SPL_NOOP_PROGRAM_ID,
		compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
		anchorRemainingAccounts: proofPath,
	},
	{
		root: [...new PublicKey(assetProof.root.trim()).toBytes()],
		dataHash: [...new PublicKey(assetData.compression.data_hash.trim()).toBytes()],
		creatorHash: [
			...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
		],
		nonce: assetData.compression.leaf_id,
		index: assetData.compression.leaf_id,
	}
)
```

## 结论

我们已经涵盖了与cNFT互动所需的主要技能，但尚未全面。您也可以使用Bubblegum执行烧毁、验证、委托等操作。我们不会详细介绍这些，但这些说明与铸造和转移过程类似。如果您需要这些额外功能，请查看[Bubblegum客户端源代码](https://github.com/metaplex-foundation/mpl-bubblegum/tree/main/clients/js-solita)并利用其提供的辅助函数。

请记住，压缩是相当新的。可用的工具将迅速演化，但您在本课程中学到的原理可能会保持不变。这些原理也可以扩展到任意状态压缩，因此请务必掌握它们，以便在未来课程中进行更有趣的事情时做好准备！

# 实验

让我们开始练习创建和处理cNFT。我们将一起尽可能简单地编写一个脚本，以便我们可以从Merkle树中铸造出cNFT收藏品。

### 1. 获取起始代码

首先，从我们的[cNFT实验室存储库](https://github.com/Unboxed-Software/solana-cnft-demo)的`starter`分支中克隆起始代码。

`git clone https://github.com/Unboxed-Software/solana-cnft-demo.git`

`cd solana-cnft-demo`

`npm install`

花一些时间熟悉提供的起始代码。最重要的是在`utils.ts`中提供的辅助函数和`uri.ts`中提供的URI。

`uri.ts`文件提供了10k个URI，您可以将其用于NFT元数据的链下部分。当然，您也可以创建自己的元数据。但是，本课程并不是明确讨论准备元数据，因此我们已为您提供了一些元数据。

`utils.ts`文件中有一些辅助函数，可以帮助您减少编写不必要的样板代码。它们如下所示:
- `getOrCreateKeypair` 将为您创建一个新的密钥对，并将其保存到`.env`文件中; 或者，如果`.env`文件中已经有私钥，它将从中初始化密钥对。
- `airdropSolIfNeeded` 如果地址的余额低于1 SOL，则会将一些Devnet SOL空投到指定地址。
- `createNftMetadata` 将为给定的创建者公钥和索引创建NFT元数据。它正在获取的元数据只是使用`uri.ts` URI列表中对应于提供的索引的URI的虚拟元数据。
- `getOrCreateCollectionNFT` 将从`.env`指定的地址获取收藏品NFT，或者如果没有，则将创建一个新的并将地址添加到`.env`。

最后，`index.ts`中有一些样板代码，调用会创建一个新的Devnet连接，调用`getOrCreateKeypair`来初始化“钱包”，并调用`airdropSolIfNeeded`来为其余额不足的钱包提供资金。

我们将在`index.ts`中编写所有代码。

### 2. 创建Merkle树账户

我们将以创建Merkle树账户开始。让我们编写一个函数来创建*并*初始化该账户。我们将把它放在`index.ts`中的`main`函数下面。我们将其命名为`createAndInitializeTree`。要使该函数工作，它将需要以下参数:

- `connection` - 用于与网络交互的 `Connection`。
- `payer` - 将支付交易费用的 `Keypair`。
- `maxDepthSizePair` - 一个 `ValidDepthSizePair`。此类型来自 `@solana/spl-account-compression`。它是一个简单的对象，具有强制执行两个值的有效组合的属性 `maxDepth` 和 `maxBufferSize`。
- `canopyDepth` - 用于树冠深度的数值

在函数体内，我们将生成一个新的树地址，然后通过调用 `@solana/spl-account-compression` 中的 `createAllocTreeIx` 函数创建一个新的 Merkle 树账户的指令。

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
	const treeKeypair = Keypair.generate()

	const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )
}
```

### 3. 使用 Bubblegum 初始化 Merkle 树并创建树配置账户

准备好创建树的指令后，我们可以创建一个调用泡泡糖程序中的 `create_tree` 的指令。这将初始化 Merkle 树账户，并在泡泡糖程序中创建一个新的树配置账户。

此指令需要我们提供以下内容：

- `accounts` - 一个包含所需账户的对象；这包括：
    - `treeAuthority` - 应为通过 Merkle 树地址和泡泡糖程序派生的 PDA
    - `merkleTree` - Merkle 树的地址
    - `payer` - 交易费用支付者
    - `treeCreator` - 树创建者的地址；我们将其设置为与 `payer` 相同
    - `logWrapper` - 设置为 `SPL_NOOP_PROGRAM_ID`
    - `compressionProgram` - 设置为 `SPL_ACCOUNT_COMPRESSION_PROGRAM_ID`
- `args` - 一个指令参数列表；这包括：
    - `maxBufferSize` - 从我们函数的 `maxDepthSizePair` 参数中获取的缓冲区大小
    - `maxDepth` - 从我们函数的 `maxDepthSizePair` 参数中获取的最大深度
    - `public` - 树是否应为公共；我们将其设置为 `false`

最后，我们可以将这两个指令添加到一个交易中并提交交易。请记住，交易需要由 `payer` 和 `treeKeypair` 签名。

```tsx
async function createAndInitializeTree(
  connection: Connection,
  payer: Keypair,
  maxDepthSizePair: ValidDepthSizePair,
  canopyDepth: number
) {
	const treeKeypair = Keypair.generate()

	const allocTreeIx = await createAllocTreeIx(
    connection,
    treeKeypair.publicKey,
    payer.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

	const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
    [treeKeypair.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

	const createTreeIx = createCreateTreeInstruction(
    {
      treeAuthority,
      merkleTree: treeKeypair.publicKey,
      payer: payer.publicKey,
      treeCreator: payer.publicKey,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    },
    {
      maxBufferSize: maxDepthSizePair.maxBufferSize,
      maxDepth: maxDepthSizePair.maxDepth,
      public: false,
    }
  )

	const tx = new Transaction().add(allocTreeIx, createTreeIx)
  tx.feePayer = payer.publicKey
  
  try {
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [treeKeypair, payer],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )

    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)

    console.log("Tree Address:", treeKeypair.publicKey.toBase58())

    return treeKeypair.publicKey
  } catch (err: any) {
    console.error("\nFailed to create Merkle tree:", err)
    throw err
  }
}
```

如果您想测试到目前为止的内容，请随时从 `main` 调用 `createAndInitializeTree`，并为最大深度和最大缓冲区大小提供小值。

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )
}
```

请注意，Devnet SOL 受到限制，因此如果测试次数过多，可能会在我们进行铸造之前用完 Devnet SOL。要测试，请在终端中运行以下命令：

`npm run start`

### 4. 向您的树铸造 cNFTs

信不信由你，这就是为了设置您的树以压缩 NFTs 一切所需的！现在让我们把注意力转向铸造。

首先，让我们声明一个名为 `mintCompressedNftToCollection` 的函数。它将需要以下参数：

- `connection` - 用于与网络交互的 `Connection`。
- `payer` - 将支付交易费用的 `Keypair`。
- `treeAddress` - Merkle 树的地址
- `collectionDetails` - 类型为 `utils.ts` 中的 `CollectionDetails` 的集合详情
- `amount` - 要铸造的 cNFT 数量

此函数的主体将执行以下操作：

1. 像以前一样获取树权限。同样，这是从 Merkle 树地址和 Bubblegum 程序派生出的 PDA。
2. 派生 `bubblegumSigner`。这是从字符串 `"collection_cpi"` 和 Bubblegum 程序派生出的 PDA，对于铸造到收藏是必不可少的。
3. 通过调用我们的 `utils.ts` 文件中的 `createNftMetadata` 创建 cNFT 元数据。
4. 通过调用 Bubblegum SDK 中的 `createMintToCollectionV1Instruction` 创建铸造指令。
5. 构建并发送带有铸造指令的交易。
6. 重复步骤 3-6 `amount` 次。

`createMintToCollectionV1Instruction` 接受两个参数：`accounts` 和 `args`。后者就是 NFT 元数据。与所有复杂指令一样，主要难题在于知道要提供哪些账户。因此，让我们快速来看一下：

- `payer` - 将支付交易费用、租金等的账户。
- `merkleTree` - Merkle 树账户。
- `treeAuthority` - 树权限；应该与之前派生的 PDA 相同。
- `treeDelegate` - 树委派；这通常与树创建者相同。
- `leafOwner` - 被铸造的压缩 NFT 的期望所有者。
- `leafDelegate` - 被铸造的压缩 NFT 的期望委派；这通常与期望所有者相同。
- `collectionAuthority` - 收藏 NFT 的权限。
- `collectionAuthorityRecordPda` - 可选的收藏权限记录 PDA；通常没有，在这种情况下，你应该放置 Bubblegum 程序地址。
- `collectionMint` - 收藏 NFT 的铸币账户。
- `collectionMetadata` - 收藏 NFT 的元数据账户。
- `editionAccount` - 收藏 NFT 的主版本账户。
- `compressionProgram` - 要使用的压缩程序；这应该是 SPL 状态压缩程序的地址，除非你有其他自定义实现。
- `logWrapper` - 用来通过日志向索引器公开数据的程序；这应该是 SPL Noop 程序的地址，除非你有其他自定义实现。
- `bubblegumSigner` - Bubblegrum 程序用于处理收藏验证的 PDA。
- `tokenMetadataProgram` - 用于收藏 NFT 的令牌元数据程序；通常总是 Metaplex 令牌元数据程序。

当你把所有东西放在一起时，看起来是这样的：

```tsx
async function mintCompressedNftToCollection(
  connection: Connection,
  payer: Keypair,
  treeAddress: PublicKey,
  collectionDetails: CollectionDetails,
  amount: number
) {
  // 派生树权限 PDA（树账户的 'TreeConfig' 账户）
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [treeAddress.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

  // 派生 bubblegum 签名者，Bubblegum 程序用于处理“收藏验证”
  // 仅用于 `createMintToCollectionV1` 指令
  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_cpi", "utf8")],
    BUBBLEGUM_PROGRAM_ID
  )

  for (let i = 0; i < amount; i++) {
    // 压缩 NFT 元数据
    const compressedNFTMetadata = createNftMetadata(payer.publicKey, i)

    // 创建“铸造”压缩 NFT 到树的指令
    const mintIx = createMintToCollectionV1Instruction(
      {
        payer: payer.publicKey, // 将支付交易费用的账户
        merkleTree: treeAddress, // 树账户的地址
        treeAuthority, // 树账户的权限，应该是从树账户地址派生的 PDA
        treeDelegate: payer.publicKey, // 树账户的委派，默认情况下应该是与树创建者相同的委派
        leafOwner: payer.publicKey, // 被铸造到树的压缩 NFT 的所有者
        leafDelegate: payer.publicKey, // 被铸造到树的压缩 NFT 的委派
        collectionAuthority: payer.publicKey, // “收藏” NFT 的权限
        collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID, // 必须是 Bubblegum 程序 ID
        collectionMint: collectionDetails.mint, // “收藏” NFT 的铸币
        collectionMetadata: collectionDetails.metadata, // “收藏” NFT 的元数据
        editionAccount: collectionDetails.masterEditionAccount, // “收藏” NFT 的主版本
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        bubblegumSigner,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      },
      {
        metadataArgs: Object.assign(compressedNFTMetadata, {
          collection: { key: collectionDetails.mint, verified: false },
        }),
      }
    )

    try {
      // 创建新交易并添加指令
      const tx = new Transaction().add(mintIx)

      // 为交易设置付费人
      tx.feePayer = payer.publicKey

      // 发送交易
      const txSignature = await sendAndConfirmTransaction(
        connection,
        tx,
        [payer],
        { commitment: "confirmed", skipPreflight: true }
      )

      console.log(
        `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
      )
    } catch (err) {
      console.error("\n压缩 NFT 铸造失败:", err)
      throw err
    }
  }
}
```

这是用一个小树进行测试的好时机。只需更新 `main` 来调用 `getOrCreateCollectionNFT` 然后调用 `mintCompressedNftToCollection`：

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )
}
```

再次运行，在您的终端中键入：`npm run start`



### 5. 读取现有的cNFT数据

现在我们已经编写了代码来铸造cNFT，让我们看看是否能够实际获取它们的数据。由于链上数据只是默克尔树账户，该数据可以用来验证现有信息的准确性，但在传达信息是无用的。

让我们首先声明一个名为`logNftDetails`的函数，它接受`treeAddress`和`nftsMinted`作为参数。

此时，我们实际上没有任何直接指向我们的cNFT的标识符。为了获取它，我们需要知道在铸造cNFT时使用的叶索引。然后可以使用该索引来推导Read API使用的资产ID，并随后使用Read API来获取我们的cNFT数据。

在我们的情况下，我们创建了一个非公开的树并铸造了8个cNFT，所以我们知道使用的叶索引是0-7。有了这个，我们可以使用`@metaplex-foundation/mpl-bubblegum`中的`getLeafAssetId`函数来获取资产ID。

最后，我们可以使用支持[Read API](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata)的RPC来获取这个资产。我们将使用[Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api)，但请随意选择您自己的RPC提供商。要使用Helius，您需要从[它们的网站](https://dev.helius.xyz/)获取免费的API密钥。然后将您的`RPC_URL`添加到您的`.env`文件。例如：

```bash
# 添加这
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

然后，简单地向您提供的RPC URL发出POST请求，并将`getAsset`信息放在请求体中：

```tsx
async function logNftDetails(treeAddress: PublicKey, nftsMinted: number) {
  for (let i = 0; i < nftsMinted; i++) {
    const assetId = await getLeafAssetId(treeAddress, new BN(i))
    console.log("资产ID:", assetId.toBase58())
    const response = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const { result } = await response.json()
    console.log(JSON.stringify(result, null, 2))
  }
}
```

Helius基本上在交易发生时观察交易日志，并存储了被哈希和存储在默克尔树中的NFT元数据。这使他们能够在被请求时展示这些数据。

如果在`main`的末尾添加一个对此函数的调用，并重新运行您的脚本，则在控制台中返回的数据非常详尽。它包括传统NFT的链上和链下部分中您所期望的所有数据。您可以找到cNFT的属性、文件、所有权和创建者信息等。

```json
{
  "interface": "V1_NFT",
  "id": "48Bw561h1fGFK4JGPXnmksHp2fpniEL7hefEc6uLZPWN",
  "content": {
    "$schema": "https://schema.metaplex.com/nft1.0.json",
    "json_uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.json",
    "files": [
      {
        "uri": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "cdn_uri": "https://cdn.helius-rpc.com/cdn-cgi/image//https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png",
        "mime": "image/png"
      }
    ],
    "metadata": {
      "attributes": [
        {
          "value": "183",
          "trait_type": "R"
        },
        {
          "value": "89",
          "trait_type": "G"
        },
        {
          "value": "78",
          "trait_type": "B"
        }
      ],
      "description": "Random RGB Color",
      "name": "CNFT",
      "symbol": "CNFT"
    },
    "links": {
      "image": "https://raw.githubusercontent.com/Unboxed-Software/rgb-png-generator/master/assets/183_89_78/183_89_78.png"
    }
  },
  "authorities": [
    {
      "address": "DeogHav5T2UV1zf5XuH4DTwwE5fZZt7Z4evytUUtDtHd",
      "scopes": [
        "full"
      ]
    }
  ],
  "compression": {
    "eligible": false,
    "compressed": true,
    "data_hash": "3RsXHMBDpUPojPLZuMyKgZ1kbhW81YSY3PYmPZhbAx8K",
    "creator_hash": "Di6ufEixhht76sxutC9528H7PaWuPz9hqTaCiQxoFdr",
    "asset_hash": "2TwWjQPdGc5oVripPRCazGBpAyC5Ar1cia8YKUERDepE",
    "tree": "7Ge8nhDv2FcmnpyfvuWPnawxquS6gSidum38oq91Q7vE",
    "seq": 8,
    "leaf_id": 7
  },
  "grouping": [
    {
      "group_key": "collection",
      "group_value": "9p2RqBUAadMznAFiBEawMJnKR9EkFV98wKgwAz8nxLmj"
    }
  ],
  "royalty": {
    "royalty_model": "creators",
    "target": null,
    "percent": 0,
    "basis_points": 0,
    "primary_sale_happened": false,
    "locked": false
  },
  "creators": [
    {
      "address": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR",
      "share": 100,
      "verified": false
    }
  ],
  "ownership": {
    "frozen": false,
    "delegated": false,
    "delegate": null,
    "ownership_model": "single",
    "owner": "HASk3AoTPAvC1KnXSo6Qm73zpkEtEhbmjLpXLgvyKBkR"
  },
  "supply": {
    "print_max_supply": 0,
    "print_current_supply": 0,
    "edition_nonce": 0
  },
  "mutable": false,
  "burnt": false
}
```

记住，Read API 还包括了获取多个资产、按所有者、创建者等进行查询等功能。务必查阅 [Helius 文档](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) 以查看可用内容。

### 6. 转移 cNFT

我们将要在脚本中添加的最后一件事是 cNFT 转移。就像标准的 SPL 代币转移一样，安全性至关重要。然而，与标准的 SPL 代币转移不同的是，要构建任何类型状态压缩的安全转移，执行转移的程序需要整个资产数据。

在这种情况下，程序 Bubblegum 需要提供整个数据，该数据已被哈希并存储在相应的叶子中，并且需要提供有关所讨论叶子的“证明路径”。这使得 cNFT 转移比 SPL 代币转移要棘手一些。

请记住，一般的步骤如下：

1. 从索引器获取 cNFT 的资产数据
2. 从索引器获取 cNFT 的证明
3. 从 Solana 区块链获取 Merkle 树帐户
4. 将资产证明准备为 `AccountMeta` 对象列表
5. 构建并发送 Bubblegum 转移指令

让我们从声明一个接受以下参数的 `transferNft` 函数开始：

- `connection` - 一个 `Connection` 对象
- `assetId` - 一个 `PublicKey` 对象
- `sender` - 一个 `Keypair` 对象，以便我们可以签署交易
- `receiver` - 一个代表新所有者的 `PublicKey` 对象

在该函数内部，让我们再次获取资产数据，然后获取资产证明。为了以防万一，让我们将所有内容包装在 `try catch` 中。

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result
	} catch (err: any) {
    console.error("\nFailed to transfer nft:", err)
    throw err
	}
}
```

接下来，让我们从链上获取默克尔树帐户，获取树冠深度，并组装证据路径。我们通过将我们从Helius获取的资产证据映射到“AccountMeta”对象列表，然后删除已在树冠上缓存的任何证明节点末端来完成此过程。

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    ...

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)
  } catch (err: any) {
    console.error("\n转移nft失败:", err)
    throw err
  }
}
```

最后，我们使用`createTransferInstruction`构建指令，将其添加到交易中，然后签名并发送交易。这是`transferNft`函数完成时的整体外观：

```tsx
async function transferNft(
  connection: Connection,
  assetId: PublicKey,
  sender: Keypair,
  receiver: PublicKey
) {
  try {
    const assetDataResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: assetId,
        },
      }),
    })
    const assetData = (await assetDataResponse.json()).result

    const assetProofResponse = await fetch(process.env.RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAssetProof",
        params: {
          id: assetId,
        },
      }),
    })
    const assetProof = (await assetProofResponse.json()).result

    const treePublicKey = new PublicKey(assetData.compression.tree)

    const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      treePublicKey
    )

    const canopyDepth = treeAccount.getCanopyDepth() || 0

    const proofPath: AccountMeta[] = assetProof.proof
      .map((node: string) => ({
        pubkey: new PublicKey(node),
        isSigner: false,
        isWritable: false,
      }))
      .slice(0, assetProof.proof.length - canopyDepth)

    const treeAuthority = treeAccount.getAuthority()
    const leafOwner = new PublicKey(assetData.ownership.owner)
    const leafDelegate = assetData.ownership.delegate
      ? new PublicKey(assetData.ownership.delegate)
      : leafOwner

    const transferIx = createTransferInstruction(
      {
        merkleTree: treePublicKey,
        treeAuthority,
        leafOwner,
        leafDelegate,
        newLeafOwner: receiver,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        anchorRemainingAccounts: proofPath,
      },
      {
        root: [...new PublicKey(assetProof.root.trim()).toBytes()],
        dataHash: [
          ...new PublicKey(assetData.compression.data_hash.trim()).toBytes(),
        ],
        creatorHash: [
          ...new PublicKey(assetData.compression.creator_hash.trim()).toBytes(),
        ],
        nonce: assetData.compression.leaf_id,
        index: assetData.compression.leaf_id,
      }
    )

    const tx = new Transaction().add(transferIx)
    tx.feePayer = sender.publicKey
    const txSignature = await sendAndConfirmTransaction(
      connection,
      tx,
      [sender],
      {
        commitment: "confirmed",
        skipPreflight: true,
      }
    )
    console.log(`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`)
  } catch (err: any) {
    console.error("\n转移nft失败:", err)
    throw err
  }
}
```

让我们将第一个压缩的NFT在索引0转移到其他人手中。首先，我们需要使用一些资金启动另一个钱包，然后使用`getLeafAssetId`获取索引0的assetID。然后我们执行转移。最后，我们使用我们的函数`logNftDetails`打印出整个收藏。你会注意到，索引0处的NFT现在将属于我们新钱包中的`所有权`字段。

```tsx
async function main() {
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
  const wallet = await getOrCreateKeypair("Wallet_1")
  await airdropSolIfNeeded(wallet.publicKey)

  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  const treeAddress = await createAndInitializeTree(
    connection,
    wallet,
    maxDepthSizePair,
    canopyDepth
  )

  const collectionNft = await getOrCreateCollectionNFT(connection, wallet)

  await mintCompressedNftToCollection(
    connection,
    wallet,
    treeAddress,
    collectionNft,
    2 ** maxDepthSizePair.maxDepth
  )

  const recieverWallet = await getOrCreateKeypair("Wallet_2")
  const assetId = await getLeafAssetId(treeAddress, new BN(0))
  await airdropSolIfNeeded(recieverWallet.publicKey)

  console.log(`Transfering ${assetId.toString()} from ${wallet.publicKey.toString()} to ${recieverWallet.publicKey.toString()}`)

  await transferNft(
    connection,
    assetId,
    wallet,
    recieverWallet.publicKey
  )

  await logNftDetails(treeAddress, 8)
}
```


运行上述脚本应该不会失败，而且消耗接近 0.01 SOL！

恭喜！现在你已经知道了如何铸造、读取和转移 cNFTs。如果你愿意，你可以将最大深度、最大缓冲区大小和树木深度更新到较大的值，只要你有足够的 Devnet SOL，这个脚本将让你以较小的成本铸造多达 10,000 个 cNFTs，相比之下铸造 10,000 个传统 NFTs 的花费要小得多（注意：如果你计划铸造大量的 NFTs，可能希望尝试批处理这些指令，以减少总交易数）。

如果你需要更多时间来完成这个实验，可以自由地再次复习或者查看 [lab repo](https://github.com/Unboxed-Software/solana-cnft-demo/tree/solution) 的 `solution` 分支上的解决方案代码。

## 挑战

现在轮到你自行尝试这些概念了！我们在这一点上不会过分指导，但是这里有一些想法：

1. 创建你自己的生产 cNFT 收藏品
2. 为本课程的实验构建一个 UI，让你可以铸造 cNFT 并显示它
3. 看看你能否在链上程序中复制一些实验脚本的功能，即编写一个可以铸造 cNFTs 的程序

## 完成了实验吗？

将你的代码推送到 GitHub 并 [告诉我们你对这节课的想法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=db156789-2400-4972-904f-40375582384a)！

---
title: 使用 Metaplex 创建 Solana NFT
objectives:
- 解释 NFT 以及它们如何在 Solana 网络上表示
- 解释 Metaplex 在 Solana NFT 生态系统中的作用
- 使用 Metaplex SDK 创建和更新 NFT
- 解释 Token Metadata 程序、Candy Machine 程序和 Sugar CLI 作为在 Solana 上创建和分发 NFT 的工具的基本功能
---
# 摘要

- **非同质化代币 (NFTs)** 在 Solana 上以 SPL 代币的形式表示，带有关联的元数据账户，0 位小数，以及最大供应量为 1
- **Metaplex** 提供一系列工具，简化在 Solana 区块链上创建和分发 NFT 的过程
- **Token Metadata** 程序标准化了将元数据附加到 SPL 代币的流程
- **Metaplex SDK** 是一个工具，提供用户友好的 API，协助开发人员利用 Metaplex 提供的链上工具
- **Candy Machine** 是一个用于创建和铸造 NFT 集合的 NFT 分发工具
- **Sugar CLI** 是一个简化上传媒体/元数据文件和为集合创建 Candy Machine 过程的工具

# 课程

Solana 非同质化代币 (NFTs) 是使用 Token 程序创建的 SPL 代币。然而，这些代币还与每个代币铸造相关联的额外元数据账户。这使得代币有着广泛的用途。您可以有效地将任何东西，从游戏库存到艺术品，进行代币化。

在本课程中，我们将介绍 Solana 上如何表示 NFT、如何使用 Metaplex SDK 创建和更新 NFT，并简要介绍可以帮助您规模化在 Solana 上创建和分发 NFT 的工具。

## Solana 上的 NFT

Solana 上的 NFT 是具有关联元数据的不可分割代币。此外，代币的铸造最大供应量为 1。

换句话说，NFT 是 Token 程序的标准代币，但与您可能认为的“标准代币”有所不同，因为它：

1. 具有 0 位小数，因此不能被分割为部分
2. 来自供应量为 1 的代币铸造，因此只有 1 个此类代币存在
3. 来自其授权设置为 `null` 的代币铸造（以确保供应量永不改变）
4. 具有一个存储元数据的关联账户

虽然前三点是可以通过 SPL Token 程序实现的功能，但相关联的元数据则需要一些额外的功能。

通常，NFT 的元数据既具有链上组件，也具有链下组件。请参阅下面的图表：

![Metadata](../../assets/solana-nft-metaplex-metadata.png)

 - **链上元数据** 存储在与代币铸造相关联的账户中。链上元数据包含一个指向链下 `.json` 文件的 URI 字段。
 - **链下元数据** 在 JSON 文件中存储了 NFT 的媒体链接（图片、视频、3D 文件）、NFT 可能具有的任何特征以及其他元数据（参见 [此示例 JSON 文件](https://lsc6xffbdvalb5dvymf5gwjpeou7rr2btkoltutn5ij5irlpg3wa.arweave.net/XIXrlKEdQLD0dcML01kvI6n4x0GanLnSbeoT1EVvNuw)）。通常使用诸如 Arweave 这样的永久数据存储系统来存储 NFT 元数据的链下组件。

## Metaplex

[Metaplex](https://www.metaplex.com/) 是一个提供一整套工具的组织，如 [Metaplex SDK](https://docs.metaplex.com/sdks/js/)，简化在 Solana 区块链上创建和分发 NFT 的过程。这些工具适用于各种用例，让您能够轻松管理创建和铸造 NFT 集合的整个过程。

更具体地，Metaplex SDK 旨在协助开发人员利用 Metaplex 提供的链上工具。它提供一个用户友好的 API，专注于热门用例，并允许与第三方插件轻松集成。要了解有关 Metaplex SDK 功能的更多信息，可以参考 [README](https://github.com/metaplex-foundation/js#readme)。

Metaplex 提供的其中一个基本程序是 Token Metadata 程序。Token Metadata 程序标准化了将元数据附加到 SPL 代币的流程。使用 Metaplex 创建 NFT 时，Token Metadata 程序使用 Program Derived Address (PDA) 和代币铸造作为种子创建元数据账户。这使得可以使用代币铸造的地址确定性地定位任何 NFT 的元数据账户。要了解有关 Token Metadata 程序的更多信息，可以参考 Metaplex [文档](https://docs.metaplex.com/programs/token-metadata/)。

在接下来的章节中，我们将介绍使用 Metaplex SDK 准备资产、创建 NFT、更新 NFT 以及将 NFT 与更广泛的集合关联的基础知识。

### Metaplex 实例

`Metaplex` 实例作为访问 Metaplex SDK APIs 的入口点。此实例接受用于与群集通信的连接。此外，开发人员可以通过指定“身份驱动程序”和“存储驱动程序”自定义 SDK 的交互。

身份驱动程序实际上是一个密钥对，可用于签署交易，这是创建 NFT 时的要求。存储驱动程序用于指定您要用于上传资产的存储服务。`bundlrStorage` 驱动程序是默认选项，它将资产上传到 Arweave，一个永久和分散的存储服务。

以下是如何为开发网设置 `Metaplex` 实例的示例。

```tsx
import {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
} from "@metaplex-foundation/js";
import { Connection, clusterApiUrl, Keypair } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const wallet = Keypair.generate();

const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(wallet))
  .use(
    bundlrStorage({
      address: "https://devnet.bundlr.network",
      providerUrl: "https://api.devnet.solana.com",
      timeout: 60000,
    }),
  );
```

### 上传资产

在创建 NFT 之前，您需要准备并上传计划关联的任何资产。虽然这不一定是图片，但大多数 NFT 都与图像关联。

准备和上传图像涉及将图像转换为缓冲区，使用 `toMetaplexFile` 函数将其转换为 Metaplex 格式，并将其上传到指定的存储驱动程序。

Metaplex SDK 支持从您本地计算机上的文件或通过浏览器上传的文件创建新的 Metaplex 文件。您可以通过使用 `fs.readFileSync` 读取图像文件，然后使用 `toMetaplexFile` 将其转换为 Metaplex 文件来实现前者。最后，使用您的 `Metaplex` 实例来调用 `storage().upload(file)` 来上传文件。函数的返回值将是图像存储的 URI。

```tsx
const buffer = fs.readFileSync("/path/to/image.png");
const file = toMetaplexFile(buffer, "image.png");

const imageUri = await metaplex.storage().upload(file);
```

### 上传元数据

上传图像后，该时候上传离线 JSON 元数据，使用 `nfts().uploadMetadata` 函数。这将返回一个 URI，用于存储 JSON 元数据。

请记住，元数据的离线部分包括图像 URI 以及附加信息，如 NFT 的名称和描述。虽然在这个 JSON 对象中您理论上可以包含任何您想要的内容，但在大多数情况下，应该遵循[NFT 标准](https://docs.metaplex.com/programs/token-metadata/token-standard#the-non-fungible-standard)以确保与钱包、程序和应用程序兼容。

要创建元数据，请使用 SDK 提供的 `uploadMetadata` 方法，该方法接受元数据对象并返回一个指向上载元数据的 URI。

```tsx
const { uri } = await metaplex.nfts().uploadMetadata({
  name: "My NFT",
  description: "My description",
  image: imageUri,
});
```

### 创建 NFT

上传 NFT 的元数据后，您最终可以在网络上创建 NFT。Metaplex SDK 的 `create` 方法允许您以最少的配置创建一个新的 NFT。该方法将为您处理创建薄片帐户、代币帐户、元数据帐户和主版本账户等工作。向此方法提供的数据将表示 NFT 元数据的链上部分。您可以探索 SDK，查看可选择提供给此方法的所有其他输入。

```tsx
const { nft } = await metaplex.nfts().create(
  {
    uri: uri,
    name: "My NFT",
    sellerFeeBasisPoints: 0,
  },
  { commitment: "finalized" },
);
```

此方法返回包含有关新创建的 NFT 的信息的对象。默认情况下，SDK 将 `isMutable` 属性设置为 true，允许对 NFT 的元数据进行更新。但是，您可以选择将 `isMutable` 设置为 false，从而使 NFT 的元数据不可变。

### 更新 NFT

如果将 `isMutable` 设置为 true，则您可能会有理由更新您的 NFT 元数据。SDK 的 `update` 方法允许您更新 NFT 元数据的链上部分和离线部分。要更新离线元数据，您需要重复上传新图像和元数据 URI 的步骤，如前面步骤中所述，然后将新的元数据 URI 提供给此方法。这将改变链上元数据指向的 URI，从而有效地更新离线元数据。

```tsx
const nft = await metaplex.nfts().findByMint({ mintAddress });

const { response } = await metaplex.nfts().update(
  {
    nftOrSft: nft,
    name: "Updated Name",
    uri: uri,
    sellerFeeBasisPoints: 100,
  },
  { commitment: "finalized" },
);
```

请注意，您在 `update` 调用中不包含的任何字段都将保持不变，这是有意设计的。

### 将 NFT 添加到集合

[Certified Collection](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction) 是一个 NFT，可以包含个别的 NFT。将一个大型 NFT 集合视为 Solana Monkey Business。如果查看个别 NFT 的 [Metadata](https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata)，您将看到一个 `collection` 字段，其中的 `key` 指向 `Certified Collection` [NFT](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/)。简而言之，属于集合的 NFT 与另一个代表集合本身的 NFT 相关联。

要将 NFT 添加到集合中，首先必须创建 Collection NFT。程序与以前相同，只是在 NFT 元数据中包括了一个额外字段: `isCollection`。该字段告诉令牌程序，此 NFT 是 Collection NFT。

```tsx
const { collectionNft } = await metaplex.nfts().create(
  {
    uri: uri,
    name: "My NFT Collection",
    sellerFeeBasisPoints: 0,
    isCollection: true
  },
  { commitment: "finalized" },
);
```

然后，您将集合的 Mint 地址列为我们新 NFT 的 `collection` 字段的引用。

```tsx
const { nft } = await metaplex.nfts().create(
  {
    uri: uri,
    name: "My NFT",
    sellerFeeBasisPoints: 0,
    collection: collectionNft.mintAddress
  },
  { commitment: "finalized" },
);
```

当您查看新创建的 NFT 上的元数据时，您现在应该会看到一个类似以下的 `collection` 字段：

```JSON
"collection":{
  "verified": false,
  "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

您要做的最后一件事是验证 NFT。这实际上只是将上面的 `verified` 字段翻转为 true，但这非常重要。这是让消费程序和应用程序知道您的 NFT 实际上是集合的一部分的关键。您可以使用 `verifyCollection` 函数来做到这一点：

```tsx
await metaplex.nfts().verifyCollection({
  mintAddress: nft.address,
  collectionMintAddress: collectionNft.address,
  isSizedCollection: true,
})
```

### 糖果机

在创建和分发大量 NFT 时，Metaplex 使用其[Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview)程序和[Sugar CLI](https://docs.metaplex.com/developer-tools/sugar/)使其变得更加简单。



糖果机实际上是一个铸造和分发程序，用于帮助推出NFT收藏品。糖是一个命令行界面，可帮助您创建糖果机，准备资产，并大规模创建NFT。上述创建NFT的步骤将在一次性创建成千上万个NFT时变得非常乏味。糖果机和糖共同解决了这个问题，并通过提供一些安全保障来确保公平启动。

我们不会深入介绍这些工具，但请查看[MetaPlex文档中关于糖果机和糖如何协同工作](https://docs.metaplex.com/developer-tools/sugar/overview/introduction)。

要了解MetaPlex提供的完整工具范围，您可以在GitHub上查看[MetaPlex存储库](https://github.com/metaplex-foundation/metaplex)。

# 实验室

在这个实验中，我们将逐步执行使用MetaPlex SDK创建NFT、事后更新NFT元数据，然后将NFT与收藏品关联的步骤。最终，您将基本了解如何使用MetaPlex SDK与Solana上的NFT进行交互。

### 1. 起步

首先，从[该存储库的“starter”分支](https://github.com/Unboxed-Software/solana-metaplex/tree/starter)下载起始代码。

该项目包含`src`目录中的两个图像，我们将使用这些图像进行NFT。

此外，在`index.ts`文件中，您将找到以下代码片段，其中包括我们将要创建和更新的NFT的示例数据。

要安装所需的依赖项，请在命令行中运行`npm install`。

接下来，通过运行`npm start`来执行代码。这将创建一个新的密钥对，将其写入`.env`文件，并将devnet SOL投放到密钥对中。

```
当前余额为0
空投1 SOL...
新余额为1
公钥：GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
成功完成
```

### 2. 设置MetaPlex

在开始创建和更新NFT之前，我们需要设置MetaPlex实例。请使用以下更新`main()`功能的内容：

```tsx
async function main() {
  // create a new connection to the cluster's API
  const connection = new Connection(clusterApiUrl("devnet"));

  // initialize a keypair for the user
  const user = await initializeKeypair(connection);

  console.log("PublicKey:", user.publicKey.toBase58());

  // metaplex set up
  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(user))
    .use(
      bundlrStorage({
        address: "https://devnet.bundlr.network",
        providerUrl: "https://api.devnet.solana.com",
        timeout: 60000,
      }),
    );
}
```

### 3. `uploadMetadata`辅助函数

接下来，让我们创建一个辅助函数，以处理上传图像和元数据并返回元数据URI的过程。此函数将接受MetaPlex实例和NFT数据作为输入，并返回元数据URI作为输出。

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Token mint initialized");
    Ok(())
}
```

现在，实现`InitializeMint`上下文类型，并列出指令所需的账户和约束条件。在这里，我们使用字符串"mint"作为种子，通过PDA初始化一个新的`Mint`账户。请注意，我们可以同时使用同一个PDA作为`Mint`账户和铸币授权的地址。将PDA作为铸币授权方使得我们的程序能够签署代币的铸造。为了初始化`Mint`账户，我们需要在账户列表中包括`token_program`、`rent`和`system_program`。
```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        seeds = ["mint".as_bytes()],
        bump,
        payer = user,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}
```

在您尚未看到的情况下可能存在一些约束。通过添加`mint::decimals`和`mint::authority`以及`init`，可以确保将账户初始化为具有适当小数位和铸币权限的新代币铸造体。
### 4. Anchor Error

接下来，让我们创建一个锚定错误，用于验证传递给`add_movie_review`或`update_movie_review`指令的`rating`。
```rust
#[error_code]
enum MovieReviewError {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating
}
```

此函数将读取一个图像文件，将其转换为缓冲区，然后上传以获得图像URI。然后，它将上传NFT元数据，其中包括名称、符号、描述和图像URI，并获得元数据URI。此URI是链外元数据。此函数还将记录图像URI和元数据URI以供参考。

### 5. `createNft`辅助函数

接下来，让我们创建一个辅助函数来处理NFT的创建。此功能接受MetaPlex实例、元数据URI和NFT数据作为输入。它使用SDK的`create`方法来创建NFT，将元数据URI、名称、销售费用和符号作为参数传递。



```tsx
// 帮助函数创建NFT
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData,
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // 元数据URI
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
    },
    { commitment: "finalized" },
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  return nft;
}
```

`createNft`函数记录了令牌铸造URL并返回一个包含有关新创建的NFT信息的 `nft` 对象。 NFT 将铸造到与在设置 Metaplex 实例时用作身份驱动程序的 `user` 相应的公钥。

### 6. 创建NFT

现在，我们已经设置了 Metaplex 实例并创建了用于上传元数据和创建NFT的辅助函数，我们可以通过创建NFT来测试这些函数。在`main()`函数中，调用`uploadMetadata`函数来上传NFT数据并获取元数据的URI。接下来，使用`createNft`函数和元数据URI来创建NFT。

```tsx
async function main() {
	...

  // 上传NFT数据并获取元数据的URI
  const uri = await uploadMetadata(metaplex, nftData)

  // 使用辅助函数和来自元数据的URI创建NFT
  const nft = await createNft(metaplex, uri, nftData)
}
```

在命令行中运行 `npm start` 以执行 `main` 函数。您应该会看到类似以下的输出：

```tsx
当前余额为1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
图片URI: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
元数据URI: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
成功完成
```

随意检查生成的图片和元数据的URI，以及通过访问输出中提供的URL在 Solana Explorer 上查看 NFT。

### 7. `updateNftUri` 辅助函数

接下来，让我们创建一个辅助函数来处理更新现有NFT的URI。此函数将接受Metaplex实例、元数据URI和NFT的铸造地址作为参数。它使用SDK的`findByMint`方法使用铸造地址获取现有NFT数据，然后使用`update`方法更新具有新URI的元数据。最后，它将记录令牌铸造URL和交易签名以供参考。

```tsx
// 帮助函数更新NFT
async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
) {
  // 使用铸造地址获取NFT数据
  const nft = await metaplex.nfts().findByMint({ mintAddress });

  // 更新NFT元数据
  const { response } = await metaplex.nfts().update(
    {
      nftOrSft: nft,
      uri: uri,
    },
    { commitment: "finalized" },
  );

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  console.log(
    `Transaction: https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
  );
}
```

### 8. 更新NFT

要更新现有NFT，我们首先需要再次上传NFT的新元数据并获取新的元数据URI。在`main()`函数中，再次调用`uploadMetadata`函数以上传更新后的NFT数据并获取元数据的新URI。然后，我们可以使用`updateNftUri`辅助函数，传入Metaplex实例、元数据的新URI和NFT的铸造地址。`nft.address`来自`createNft`函数的输出。

```tsx
async function main() {
	...

  // 上传更新后的NFT数据并获取新的元数据URI
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // 使用辅助函数和来自元数据的新URI更新NFT
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

在命令行中运行 `npm start` 以执行 `main` 函数。您应该会看到类似以下的附加输出：

```tsx
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
成功完成
```

您还可以通过将`.env`文件中的`PRIVATE_KEY`导入Phantom钱包来查看NFT。

### 9. 创建NFT收藏

太棒了，现在您知道如何在Solana区块链上创建单个NFT并对其进行更新了！但是，如何将其添加到收藏中呢？

首先，让我们创建一个名为`createCollectionNft`的辅助函数。注意它和 `createNft` 非常相似，但它确保 `isCollection` 设置为 `true`，并且数据满足收藏的要求。



```tsx
async function createCollectionNft(
  metaplex: Metaplex,
  uri: string,
  data: CollectionNftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri,
      name: data.name,
      sellerFeeBasisPoints: data.sellerFeeBasisPoints,
      symbol: data.symbol,
      isCollection: true,
    },
    { commitment: "finalized" }
  )

  console.log(
    `收藏品铸造: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  )

  return nft
}
```

接下来，我们需要为收藏品创建离线数据。在 `main` 中在现有 `createNft` 的调用之前，添加以下的 `collectionNftData`：

```tsx
const collectionNftData = {
  name: "TestCollectionNFT",
  symbol: "TEST",
  description: "Test Description Collection",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
  isCollection: true,
  collectionAuthority: user,
}
```

然后，让我们使用 `collectionNftData` 调用 `uploadMetadata`，然后调用 `createCollectionNft`。同样，在创建NFT的代码之前进行此操作。

```tsx
async function main() {
  ...

  // 上传收藏品NFT的数据并获取元数据的URI
  const collectionUri = await uploadMetadata(metaplex, collectionNftData)

  // 使用辅助函数和来自元数据的URI创建收藏品NFT
  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData
  )
}
```

这将返回我们收藏品的铸造地址，以便我们可以使用它将NFT分配给收藏品。

### 10. 将NFT分配给收藏品

既然我们有了收藏品，让我们修改现有代码以便新创建的NFTs被添加到收藏品中。首先，修改我们的 `createNft` 函数，以便调用 `nfts().create` 中包括 `collection` 字段。然后，添加代码调用 `verifyCollection` 以使链下元数据中的 `verified` 字段设置为 true。这样消费程序和应用程序可以确切知道NFT确实属于收藏品。

```tsx
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // 元数据URI
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
    },
    { commitment: "finalized" }
  )

  console.log(
    `令牌铸造: https://explorer.solana.com/address/${nft.address.toString()}? cluster=devnet`
  )

  //这就是我们的收藏品作为认证收藏品的验证
  await metaplex.nfts().verifyCollection({  
    mintAddress: nft.mint.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  })

  return nft
}
```

现在，运行 `npm start`，完成！如果您跟随新的NFT链接并查看“元数据”选项卡，您将看到一个包含您收藏品铸造地址的 `collection` 字段。

恭喜！您成功地学会了如何使用Metaplex SDK来创建、更新和验证NFT作为收藏品的一部分。这是您构建任何用例的收藏品所需的一切。您可以构建一个TicketMaster竞争者，修改Costco的会员计划，甚至将学校的学生身份证系统数字化。可能性是无限的！

如果您想查看最终解决方案代码，您可以在相同的[存储库](https://github.com/Unboxed-Software/solana-metaplex/tree/solution)的解决方案分支上找到它。

# 挑战

要加深您对Metaplex工具的理解，请深入研究Metaplex文档，熟悉Metaplex提供的各种程序和工具。例如，您可以深入了解糖果机程序，了解其功能。

一旦您了解了糖果机程序的工作原理，请使用Sugar CLI来为您自己的收藏品创建一个糖果机，来测试您的知识。这种亲身体验不仅会加强您对工具的理解，还会增强您今后有效使用这些工具的信心。

享受这个过程！这将是您第一次独立创建的NFT收藏品！通过完成这一切，您将完成模块2。希望您喜欢这个过程！随时[分享一些快速反馈](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%202)，以便我们继续改进课程！

## 完成了实验吗？

将您的代码推送到GitHub，然后[告诉我们您对这堂课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=296745ac-503c-4b14-b3a6-b51c5004c165)！
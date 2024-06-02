**译者**: [ben46](https://github.com/ben46)

# 介绍
- **建立 Solana NFTs 与 Metaplex**
- 目标包括:
  - 解释 NFTs 以及它们在 Solana 网络上的表现形式
  - 解释 Metaplex 在 Solana NFT 生态系统中的作用
  - 使用 Metaplex SDK 创建和更新 NFTs
  - 解释 Token Metadata 程序、Candy Machine 程序和 Sugar CLI 的基本功能，作为协助在 Solana 上创建和分发 NFTs 的工具

# 总结

- **不可替代通证 (NFTs)** 在 Solana 上是由与关联的元数据账户、0 小数位、最大供应量为 1 的 SPL 通证所表示的
- **Metaplex** 提供一系列工具，简化了在 Solana 区块链上创建和分发 NFTs 的过程
- **Token Metadata** 程序标准化了将元数据附加到 SPL 通证的过程
- **Metaplex SDK** 是一个工具，为开发人员提供了用户友好的 API，以帮助他们利用 Metaplex 提供的在线工具
- **Candy Machine** 程序是一种用于创建和铸造 NFTs 的 NFT 分发工具
- **Sugar CLI** 是一个简化上传媒体/元数据文件和为收藏品创建 Candy Machine 过程的工具

# 课程

Solana 不可替代通证 (NFTs) 是使用 Token 程序创建的 SPL 通证。然而，每个通证铸造还与一个额外的元数据账户相关联。这使得通证具有广泛的用例，您可以有效地将任何东西进行通证化，从游戏库存到艺术品。

在本课程中，我们将介绍 Solana 上 NFTs 的基本概念，以及如何使用 Metaplex SDK 创建和更新 NFTs，并简要介绍一些可以帮助您规模化在 Solana 上创建和分发 NFTs 的工具。

## Solana 上的 NFTs

Solana NFT 是一种非可分割的通证，具有关联的元数据。此外，通证的铸造具有最大供应量为 1。

换句话说，NFT 是来自 Token 程序的标准通证，但与您可能认为的“标准通证”不同，它:

1. 没有小数，因此无法分割成零件
2. 来自供应量为 1 的通证铸造，因此只有一个此类通证存在
3. 来自授权设为 `null` 的通证铸造（以确保供应量永远不会改变）
4. 具有存储元数据的关联账户

尽管前三点是可以通过 SPL 通证程序实现的特性，但关联的元数据需要额外的功能。

通常，NFT 的元数据具有链上和链下两个组件。见下图:

![Metadata](../assets/solana-nft-metaplex-metadata.png)

 - **链上元数据** 存储在与通证铸造关联的账户中。链上元数据包含一个指向链下 `.json` 文件的 URI 字段。
 - **链下元数据** 在 JSON 文件中，存储 NFT 的媒体链接（图片、视频、3D 文件），NFT 可能具有的特征，以及附加的元数据（参见[此示例 JSON 文件](https://lsc6xffbdvalb5dvymf5gwjpeou7rr2btkoltutn5ij5irlpg3wa.arweave.net/XIXrlKEdQLD0dcML01kvI6n4x0GanLnSbeoT1EVvNuw)）。通常使用像 Arweave 这样的永久数据存储系统，来存储 NFT 元数据的链下组件。

## **Metaplex**

[Metaplex](https://www.metaplex.com/) 是一个组织，提供了一套工具，例如 [Metaplex SDK](https://docs.metaplex.com/sdks/js/)，这些工具简化了在 Solana 区块链上创建和分发 NFTs 的过程。这些工具适用于广泛的用例，并允许您轻松管理整个 NFT 的创建和铸造过程。

具体来说，Metaplex SDK 旨在帮助开发人员利用 Metaplex 提供的在线工具。它提供了一个用户友好的 API，专注于流行的用例，并允许与第三方插件轻松集成。要了解 Metaplex SDK 的功能，可以参考 [README](https://github.com/metaplex-foundation/js#readme)。

Metaplex 提供的重要程序之一是 Token Metadata 程序。Token Metadata 程序标准化了向 SPL 通证附加元数据的过程。使用 Metaplex 创建 NFT 时，Token Metadata 程序使用程序衍生地址 (PDA)，以通证铸造为种子，创建一个元数据账户。这使得可以使用通证铸造的地址确定性地定位任何 NFT 的元数据账户。要了解有关 Token Metadata 程序的更多信息，可以参考 Metaplex [文档](https://docs.metaplex.com/programs/token-metadata/)。

在接下来的部分，我们将介绍使用 Metaplex SDK 准备资产、创建 NFTs、更新 NFTs，并将 NFT 与更广泛的收藏品关联的基础知识。

### Metaplex 实例

`Metaplex` 实例作为访问 Metaplex SDK API 的入口点。此实例接受一个用于与集群通信的连接。此外，开发人员可以通过指定“Identity Driver”和“Storage Driver”，来自定义 SDK 的交互。

Identity Driver 实际上是一个用于签署交易的密钥对，这是创建 NFT 时的要求。Storage Driver 用于指定您要用于上传资产的存储服务。`bundlrStorage` 驱动程序是默认选项，它将资产上传到 Arweave，一个永久的分布式存储服务。

以下是如何为 devnet 设置 `Metaplex` 实例的示例。

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

在创建 NFT 之前，您需要准备和上传您计划与 NFT 关联的任何资产。尽管这不一定是一幅图片，但大多数 NFT 都有与其相关的图片。

准备和上传图片涉及将图片转换为缓冲区，并使用 `toMetaplexFile` 函数将其转换为 Metaplex 格式，最后将其上传到指定的存储驱动程序。


Metaplex SDK支持从本地计算机上存在的文件或通过浏览器上传的用户上传的文件创建新的Metaplex文件。你可以通过使用`fs.readFileSync`来读取图片文件，然后使用`toMetaplexFile`将其转换为Metaplex文件。最后，使用你的`Metaplex`实例调用`storage().upload(file)`来上传文件。函数的返回值将是存储图像的URI。

```tsx
const buffer = fs.readFileSync("/path/to/image.png");
const file = toMetaplexFile(buffer, "image.png");

const imageUri = await metaplex.storage().upload(file);
```

### 上传元数据

上传图像后，是时候使用`nfts().uploadMetadata`函数上传离线JSON元数据了。这将返回存储JSON元数据的URI。

请记住，元数据的离线部分包括图像URI以及额外信息，如NFT的名称和描述。虽然你可以在这个JSON对象中技术上包含任何你想包含的内容，但在大多数情况下，你应该遵循[NFT标准](https://docs.metaplex.com/programs/token-metadata/token-standard#the-non-fungible-standard)来确保与钱包、程序和应用的兼容性。

要创建元数据，使用SDK提供的`uploadMetadata`方法。该方法接受一个元数据对象并返回一个指向已上传元数据的URI。

```tsx
const { uri } = await metaplex.nfts().uploadMetadata({
  name: "My NFT",
  description: "My description",
  image: imageUri,
});
```

### 创建NFT

上传NFT的元数据后，你最终可以在网络上创建NFT。Metaplex SDK的`create`方法允许你使用最小配置来创建一个新NFT。该方法将为你处理发行帐户、代币帐户、元数据帐户和主版本帐户的创建。向该方法提供的数据将表示NFT元数据的链上部分。你可以探索SDK，看看可以选择性提供给该方法的其他输入。

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

该方法返回一个包含有关新创建的NFT的信息的对象。默认情况下，SDK将`isMutable`属性设置为true，允许对NFT的元数据进行更新。但是，你可以选择将`isMutable`设置为false，使NFT的元数据成为不可变的。

### 更新NFT

如果你将`isMutable`保留为true，你可能会有理由更新NFT的元数据。SDK的`update`方法允许你更新NFT元数据的链上和离线部分。要更新离线元数据，你需要重复上述步骤，上传新图像和元数据URI，然后将新的元数据URI提供给该方法。这将更改链上元数据指向的URI，从而有效地更新离线元数据。

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

请注意，你在调用`update`时未包含的字段将保持不变，这是设计上的考虑。

### 将NFT添加到集合

[认证集合](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction)是个别NFT可以属于的NFT。想象一下一个大的NFT集合，比如Solana Monkey Business。如果你查看一个个别NFT的[元数据](https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata)，你会看到一个带有`key`的`collection`字段，指向`Certified Collection`[NFT](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/)。简单来说，作为集合的一部分的NFT与另一个代表集合本身的NFT相关联。

要将NFT添加到集合，首先必须创建Collection NFT。过程与之前相同，只是在我们的NFT元数据上包括了一个额外的字段：`isCollection`。该字段告诉代币程序，该NFT是一个Collection NFT。

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

你然后将集合的Mint地址列为我们新Nft中`collection`字段的引用。

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

当你查看新创建的NFT上的元数据时，你应该看到一个`collection`字段，如下所示：

```JSON
"collection":{
  "verified": false,
  "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

你需要做的最后一件事是验证NFT。这实际上只是将上面的`verified`字段更改为true，但这非常重要。这样可以让消费程序和应用知道你的NFT实际上是集合的一部分。你可以使用`verifyCollection`函数来实现这一点：

```tsx
await metaplex.nfts().verifyCollection({
  mintAddress: nft.address,
  collectionMintAddress: collectionNft.address,
  isSizedCollection: true,
})
```

### 糖果机

在创建和分发大量NFT时，Metaplex使用其[Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview)和[Sugar CLI](https://docs.metaplex.com/developer-tools/sugar/)程序，让这变得轻松。


糖果机实际上是一个铸造和分发计划，帮助推出NFT收藏品。尤其是糖分是一个命令行界面，可帮助您创建糖果机、准备资产，并批量创建NFT。在上述覆盖的步骤中，要一次性执行数千个NFT的创建工作将会非常繁琐。糖果机和糖分解决了这一问题，并通过提供多种保障，帮助确保公平启动。

我们不会深入介绍这些工具，但可以查看[Metaplex文档中关于糖果机和糖分如何配合使用的内容](https://docs.metaplex.com/developer-tools/sugar/overview/introduction)。

要探究Metaplex提供的全部工具范围，可以在GitHub上查看[Metaplex存储库](https://github.com/metaplex-foundation/metaplex)。


# 实验室

在本实验室中，我们将通过Metaplex SDK创建NFT的步骤，事后更新NFT的元数据，然后将NFT与一个收藏品相关联。最终，您将基本了解如何使用Metaplex SDK与Solana上的NFT交互。

### 1. 初始设置

首先，从[this repository的`starter`分支](https://github.com/Unboxed-Software/solana-metaplex/tree/starter)下载初始代码。

该项目包含`src`目录中的两个图像，我们将用于创建NFT。

另外，您可以在`index.ts`文件中找到以下代码片段，其中包括我们将要创建和更新的NFT的示例数据。

```tsx
interface NftData {
  name: string;
  symbol: string;
  description: string;
  sellerFeeBasisPoints: number;
  imageFile: string;
}

interface CollectionNftData {
  name: string
  symbol: string
  description: string
  sellerFeeBasisPoints: number
  imageFile: string
  isCollection: boolean
  collectionAuthority: Signer
}

// example data for a new NFT
const nftData = {
  name: "Name",
  symbol: "SYMBOL",
  description: "Description",
  sellerFeeBasisPoints: 0,
  imageFile: "solana.png",
}

// example data for updating an existing NFT
const updateNftData = {
  name: "Update",
  symbol: "UPDATE",
  description: "Update Description",
  sellerFeeBasisPoints: 100,
  imageFile: "success.png",
}

async function main() {
  // create a new connection to the cluster's API
  const connection = new Connection(clusterApiUrl("devnet"));

  // initialize a keypair for the user
  const user = await initializeKeypair(connection);

  console.log("PublicKey:", user.publicKey.toBase58());
}
```


要安装必要的依赖项，请在命令行中运行`npm install`。

接下来，通过运行`npm start`来执行代码。这将创建一个新的密钥对，将其写入`.env`文件，并向密钥对空投devnet SOL。

```
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

### 2. 设置Metaplex

在开始创建和更新NFT之前，我们需要设置Metaplex实例。用以下内容更新`main()`函数。

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

### 3. `uploadMetadata` 辅助函数

接下来，让我们创建一个辅助函数来处理上传图像和元数据并返回元数据URI的过程。该函数将以Metaplex实例和NFT数据作为输入，并将元数据URI作为输出。

```tsx
// helper function to upload image and metadata
async function uploadMetadata(
  metaplex: Metaplex,
  nftData: NftData,
): Promise<string> {
  // file to buffer
  const buffer = fs.readFileSync("src/" + nftData.imageFile);

  // buffer to metaplex file
  const file = toMetaplexFile(buffer, nftData.imageFile);

  // upload image and get image uri
  const imageUri = await metaplex.storage().upload(file);
  console.log("image uri:", imageUri);

  // upload metadata and get metadata uri (off chain metadata)
  const { uri } = await metaplex.nfts().uploadMetadata({
    name: nftData.name,
    symbol: nftData.symbol,
    description: nftData.description,
    image: imageUri,
  });

  console.log("metadata uri:", uri);
  return uri;
}
```

此函数将读取图像文件，将其转换为缓冲区，然后上传以获取图像URI。然后，它将上传NFT元数据（包括名称、标志、描述和图像URI）并获取元数据URI。该URI是离线元数据。此函数还将记录用于参考的图像URI和元数据URI。

### 5. `createNft` 辅助函数

接下来，我们将创建一个辅助函数来处理NFT的创建。此函数接受Metaplex实例、元数据URI和NFT数据作为输入。它使用SDK的`create`方法来创建NFT，传入元数据URI、名称、卖方费和标志作为参数。


```tsx
// 创建 NFT 的辅助函数
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData,
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // 元数据 URI
      name: nftData.name, // NFT 名称
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints, // 卖家费基点
      symbol: nftData.symbol, // NFT 符号
    },
    { commitment: "finalized" }, // 承诺类型
  );

  console.log(
    `令牌铸造：https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  return nft;
}
```

`createNft` 函数记录了令牌铸造的 URL，并返回一个包含有关新创建的 NFT 信息的 `nft` 对象。NFT 将铸造到与设置 Metaplex 实例时用作用户身份驱动程序的 `user` 对应的公钥。

### 6. 创建 NFT

现在，我们已经建立了 Metaplex 实例并创建了上传元数据和创建 NFT 的辅助函数，我们可以通过创建 NFT 测试这些函数。在 `main()` 函数中，调用 `uploadMetadata` 函数上传 NFT 数据并获取元数据的 URI。然后，使用 `createNft` 函数和元数据 URI 来创建一个 NFT。

```tsx
async function main() {
	...

  // 上传 NFT 数据并获取元数据的 URI
  const uri = await uploadMetadata(metaplex, nftData)

  // 使用辅助函数和元数据中的 URI 创建 NFT
  const nft = await createNft(metaplex, uri, nftData)
}
```

在命令行中运行 `npm start` 执行 `main` 函数。您应该会看到类似以下的输出：

```tsx
Current balance is 1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
image uri: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
metadata uri: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
Finished successfully
```

不妨检查生成的图像和元数据的 URI，以及通过访问输出中提供的 URL 在 Solana Explorer 上查看 NFT。

### 7. `updateNftUri` 辅助函数

接下来，让我们创建一个辅助函数来处理更新现有 NFT 的 URI。此函数将接受 Metaplex 实例、元数据 URI 和 NFT 的铸造地址。它使用 SDK 的 `findByMint` 方法使用铸造地址获取现有 NFT 数据，然后使用 `update` 方法来用新的 URI 更新元数据。最后，它将记录令牌铸造的 URL 和交易签名以供参考。

```tsx
// 辅助函数更新 NFT
async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
) {
  // 使用铸造地址获取 NFT 数据
  const nft = await metaplex.nfts().findByMint({ mintAddress });

  // 更新 NFT 元数据
  const { response } = await metaplex.nfts().update(
    {
      nftOrSft: nft,
      uri: uri,
    },
    { commitment: "finalized" }, // 承诺类型
  );

  console.log(
    `Token Mint：https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`,
  );

  console.log(
    `交易：https://explorer.solana.com/tx/${response.signature}?cluster=devnet`,
  );
}
```

### 8. 更新 NFT

要更新现有的 NFT，我们首先需要上传新的 NFT 数据并获取元数据的新 URI。在 `main()` 函数中，再次调用 `uploadMetadata` 函数上传更新后的 NFT 数据并获取元数据的新 URI。然后，我们可以使用 `updateNftUri` 辅助函数，传入 Metaplex 实例、元数据新 URI 和 NFT 的铸造地址。`nft.address` 是 `createNft` 函数的输出。

```tsx
async function main() {
	...

  // 上传更新后的 NFT 数据并获取元数据的新 URI
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // 使用辅助函数和元数据的新 URI 更新 NFT
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

在命令行中运行 `npm start` 执行 `main` 函数。您应该会看到类似以下的附加输出：

```tsx
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
Finished successfully
```

您还可以通过从 .env 文件中导入 `PRIVATE_KEY` 在 Phantom 钱包中查看 NFT。

### 9. 创建 NFT 集合

太棒了，您现在知道如何在 Solana 区块链上创建单个 NFT 并对其进行更新了！但是，如何将其添加到一个集合中呢？

首先，让我们创建一个名为 `createCollectionNft` 的辅助函数。请注意，它与 `createNft` 非常相似，但确保 `isCollection` 设置为 `true`，并且数据符合集合的要求。


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
    `Collection Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  )

  return nft
}
```

接下来，我们需要为收藏品创建离线数据。在 `main` 之前 *existing calls to `createNft`*, 添加以下 `collectionNftData`：

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

现在，让我们使用 `collectionNftData` 调用 `uploadMetadata` ，然后调用 `createCollectionNft` 。再次，在创建 NFT 的代码之前进行此操作。 

```tsx
async function main() {
  ...

  // 上传收藏品 NFT 数据，并获取元数据的 URI
  const collectionUri = await uploadMetadata(metaplex, collectionNftData)

  // 使用辅助函数和元数据中的 URI 创建收藏品 NFT
  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData
  )
}
```

这将返回我们收藏品的铸币地址，以便我们可以使用它来将 NFT 分配给收藏品。

### 10. 将 NFT 分配给收藏品

现在我们有了一个收藏品，让我们修改现有代码，以便新创建的 NFT 被添加到收藏品中。首先，让我们修改我们的 `createNft` 函数，以便调用 `nfts().create` 包括 `collection` 字段。然后，添加调用 `verifyCollection` 的代码，使得在链上元数据的 `verified` 字段设置为 true 。这样，消费程序和应用程序确保 NFT 确实属于该收藏品。

```tsx
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // metadata URI
      name: nftData.name,
      sellerFeeBasisPoints: nftData.sellerFeeBasisPoints,
      symbol: nftData.symbol,
    },
    { commitment: "finalized" }
  )

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}? cluster=devnet`
  )

  // 这是验证我们收藏品作为认证收藏品的步骤
  await metaplex.nfts().verifyCollection({  
    mintAddress: nft.mint.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  })

  return nft
}
```

现在，运行 `npm start`，完成！如果您跟随新的 NFT 链接并查看元数据选项卡，您将看到 `collection` 字段与您的收藏品的铸币地址列在其中。

恭喜您！您已成功学会使用 Metaplex SDK 来创建、更新和验证 NFT 作为收藏品的一部分。这已经足够让您构建出自己的收藏品，无论用例如何。您可以构建 TicketMaster 的竞争者，重新设计 Costco 的会员计划，甚至数字化您的学校学生证件系统。可能性无限！

如果您想查看最终解决方案代码，您可以在[仓库](https://github.com/Unboxed-Software/solana-metaplex/tree/solution) 的解决方案分支中找到它。

# 挑战

为了加深您对 Metaplex 工具的理解，请深入阅读 Metaplex 文档，熟悉 Metaplex 提供的各种程序和工具。例如，您可以深入了解糖果机程序，了解其功能。

一旦您了解了糖果机程序的工作原理，请利用 Sugar CLI 使用自己的收藏品创建糖果机，检验并应用您的知识。这种实践不仅会加强您对工具的理解，还会增强您对有效使用这些工具的信心。

玩得开心！这将是您独立创建的第一个 NFT 收藏品！有了这个，您将完成第2模块。希望您对流程感到满意！随时[分享一些快速反馈](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module =模块 2) ，以便我们继续改进课程！

## 完成了实验吗？

将您的代码推送到GitHub，并[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=296745ac-503c-4b14-b3a6-b51c5004c165)！


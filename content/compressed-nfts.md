---
title: Compressed NFTs
objectives:
- Create a compressed NFT collection using Metaplex’s Bubblegum program
- Mint compressed NFTs using the Bubblegum TS SDK
- Transfer compressed NFTs using the Bubblegum TS SDK
- Read compressed NFT data using the Read API
---

# Summary

- **Compressed NFTs (cNFTs)** use **State Compression** to hash NFT data and store the hash onchain in an account using a **concurrent Merkle tree** structure
- The cNFT data hash can’t be used to infer the cNFT data, but it can be used to **verify** if the cNFT data you’re seeing is correct
- Supporting RPC providers **index** cNFT data off-chain when the cNFT is minted so that you can use the **Read API** to access the data
- The **Metaplex Bubblegum program** is an abstraction on top of the **State Compression** program that enables you to more simply create, mint, and manage cNFT collections

# Lesson

Compressed NFTs (cNFTs) are exactly what their name suggests: NFTs whose structure takes up less account storage than traditional NFTs. Compressed NFTs leverage a concept called **State Compression** to store data in a way that drastically reduces costs.

Solana’s transaction costs are so cheap that most users never think about how expensive minting NFTs can be at scale. The cost to set up and mint 1 million traditional NFTs is approximately 24,000 SOL. By comparison, cNFTs can be structured to where the same setup and mint costs 10 SOL or less. That means anyone using NFTs at scale could cut costs by more than 1000x by using cNFTs over traditional NFTs.

However, cNFTs can be tricky to work with. Eventually, the tooling required to work with them will be sufficiently abstracted from the underlying technology that the developer experience between traditional NFTs and cNFTs will be negligible. But for now, you’ll still need to understand the low level puzzle pieces, so let’s dig in!

## A theoretical overview of cNFTs

Most of the costs associated with traditional NFTs come down to account storage space. Compressed NFTs use a concept called State Compression to store data in the blockchain’s cheaper **ledger state**, using more expensive account space only to store a “fingerprint”, or **hash**, of the data. This hash allows you to cryptographically verify that data has not been tampered with.

To both store hashes and enable verification, we use a special binary tree structure known as a **concurrent Merkle tree**. This tree structure lets us hash data together in a deterministic way to compute a single, final hash that gets stored onchain. This final hash is significantly smaller in size than all the original data combined, hence the “compression.” The steps to this process are:

1. Take any piece of data
2. Create a hash of this data
3. Store this hash as a “leaf” at the bottom of the tree
4. Each leaf pair is then hashed together, creating a “branch”
5. Each branch is then hashed together
6. Continually climb the tree and hash adjacent branches together
7. Once at the top of the tree, a final ”root hash” is produced
8. Store the root hash onchain as a verifiable proof of the data within each leaf
9. Anyone wanting to verify that the data they have matches the “source of truth” can go through the same process and compare the final hash without having to store all the data onchain

One problem not addressed in the above is how to make data available if it can’t be fetched from an account. Since this hashing process occurs onchain, all the data exists in the ledger state and could theoretically be retrieved from the original transaction by replaying the entire chain state from origin. However, it’s much more straightforward (though still complicated) to have an **indexer** track and index this data as the transactions occur. This ensures there is an off-chain “cache” of the data that anyone can access and subsequently verify against the onchain root hash.

This process is *very complex*. We’ll cover some of the key concepts below but don’t worry if you don’t understand it right away. We’ll talk more theory in the state compression lesson and focus primarily on application to NFTs in this lesson. You’ll be able to work with cNFTs by the end of this lesson even if you don’t fully understand every piece of the state compression puzzle.

### Concurrent Merkle trees

A **Merkle tree** is a binary tree structure represented by a single hash. Every leaf node in the structure is a hash of its inner data while every branch is a hash of its child leaf hashes. In turn, branches are also hashed together until eventually one final root hash remains.

Any modification to leaf data changes the root hash. This causes an issue when multiple transactions in the same slot are attempting to modify leaf data. Since these transactions must execute in series, all but the first will fail since the root hash and proof passed in will have been invalidated by the first transaction to be executed.

A **concurrent Merkle tree** is a Merkle tree that stores a secure changelog of the most recent changes along with their root hash and the proof to derive it. When multiple transactions in the same slot try to modify leaf data, the changelog can be used as a source of truth to allow for concurrent changes to be made to the tree.

When working with a concurrent Merkle tree, there are three variables that determine the size of the tree, the cost to create the tree, and the number of concurrent changes that can be made to the tree:

1. Max depth
2. Max buffer size
3. Canopy depth

The **max depth** is the maximum number of hops to get from any leaf to the root of the tree. Since Merkle trees are binary trees, every leaf is connected only to one other leaf. Max depth can then logically be used to calculate the number of nodes for the tree with `2 ^ maxDepth`.

The **max buffer size** is effectively the maximum number of concurrent changes that you can make to a tree within a single slot with the root hash still being valid.

The **canopy depth** is the number of proof nodes that are stored onchain for any given proof path. Verifying any leaf requires the complete proof path for the tree. The complete proof path is made up of one proof node for every “layer” of the tree, i.e. a max depth of 14 means there are 14 proof nodes. Every proof node adds 32 bytes to a transaction, so large trees would quickly exceed the maximum transaction size limit without caching proof nodes onchain.

Each of these three values, max depth, max buffer size, and canopy depth, comes with a tradeoff. Increasing the value of any of these values increases the size of the account used to store the tree, thus increasing the cost to create the tree. 

Choosing the max depth is fairly straightforward as it directly relates to the number of leafs and therefore the amount of data you can store. If you need 1million cNFTs on a single tree, find the max depth that makes the following expression true: `2^maxDepth > 1million`. The answer is 20.

Choosing a max buffer size is effectively a question of throughput: how many concurrent writes do you need.

### SPL State Compression and Noop Programs

The SPL State Compression Program exists to make the above process repeatable and composable throughout the Solana ecosystem. It provides instructions for initializing Merkle trees, managing tree leafs (i.e. add, update, remove data), and verifying leaf data.

The State Compression Program also leverages a separate “no op” program whose primary purpose is to make leaf data easier to index by logging it to the ledger state.

### Use the Ledger State for storage

The Solana ledger is a list of entries containing signed transactions. In theory, this can be traced back to the genesis block. This effectively means any data that has ever been put into a transaction exists in the ledger.

When you want to store compressed data, you pass it to the State Compression program where it gets hashed and emitted as an “event” to the Noop program. The hash is then stored in the corresponding concurrent Merkle tree. Since the data passed through a transaction and even exists on the Noop program logs, it will forever exist on the ledger state. 

### Index data for easy lookup

Under normal conditions, you would typically access onchain data by fetching the appropriate account. When using state compression, however, it’s not so straightforward. 

As mentioned above, the data now exists in the ledger state rather than in an account. The easiest place to find the full data is in the logs of the Noop instruction, but while this data will in a sense exist in the ledger state forever, it will likely be inaccessible through validators after a certain period of time.

To save space and be more performant, validators don’t retain every transaction back to the genesis block. The specific amount of time you’ll be able to access the Noop instruction logs related to your data will vary based on the validator, but eventually you’ll lose access to it if you’re relying directly on instruction logs.

Technically, you *can* replay transaction state back to the genesis block but the average team isn’t going to do that, and it certainly won’t be performant. Instead, you should use an indexer that will observe the events sent to the Noop program and store the relevant data off chain. That way you don’t need to worry about old data becoming inaccessible.

## Create a cNFT Collection

With the theoretical background out of the way, let’s turn our attention to the main point of this lesson: how to create a cNFT collection.

Fortunately, you can use tools created by Solana Foundation, the Solana developer community, and Metaplex to simplify the process. Specifically, we’ll be using the `@solana/spl-account-compression` SDK, the Metaplex Bubblegum program, and the Bubblegum program’s corresponding TS SDK `@metaplex-foundation/mpl-bugglegum`.

<aside>
💡 At the time of writing, the Metaplex team is transitioning to a new bubblegum client SDK that supports umi, their modular framework for building and using JS clients for Solana programs. We will not be using the umi version of the SDK in this lesson. Rather, we’ll be hardcoding our dependency to version 0.7 (`@metaplex-foundation/mpl-bubblegum@0.7`). This version provides simple helper functions for building Bubblegum instructions.

</aside>

### Prepare metadata

Prior to starting, you’ll prepare your NFT metadata similarly to how you would if you were using a Candy Machine. At its core, an NFT is simply a token with metadata that follows the NFT standard. In other words, it should be shaped something like this:

```json
{
  "name": "12_217_47",
  "symbol": "RGB",
  "description": "Random RGB Color",
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

Depending on your use case, you may be able to generate this dynamically or you might want to have a JSON file prepared for each cNFT beforehand. You’ll also need any other assets referenced by the JSON, such as the `image` url shown in the example above. 

### Create Collection NFT

If you want your cNFTs to be part of a collection, you’ll need to create a Collection NFT **before** you start minting cNFTs. This is a traditional NFT that acts as the reference binding your cNFTs together into a single collection. You can create this NFT using the `@metaplex-foundation/js` library. Just make sure you set `isCollection` to `true`.

```tsx
const collectionNft = await metaplex.nfts().create({
    uri: someUri,
    name: "Collection NFT",
    sellerFeeBasisPoints: 0,
    updateAuthority: somePublicKey,
    mintAuthority: somePublicKey,
    tokenStandard: 0,
    symbol: "Collection",
    isMutable: true,
    isCollection: true,
})
```

### Create Merkle tree Account

Now we start to deviate from the process you would use when creating traditional NFTs. The onchain storage mechanism you use for state compression is an account representing a concurrent Merkle tree. This Merkle tree account belongs to the SPL State Compression program. Before you can do anything related to cNFTs, you need to create an empty Merkle tree account with the appropriate size.

The variables impacting the size of the account are:

1. Max depth
2. Max buffer size
3. Canopy depth

The first two variables must be chosen from an existing set of valid pairs. The table below shows the valid pairs along with the number of cNFTs that can be created with those values.

| Max Depth | Max Buffer Size | Max Number of cNFTs |
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

Note that the number of cNFTs that can be stored on the tree depends entirely on the max depth, while the buffer size will determine the number of concurrent changes (mints, transfers, etc.) within the same slot that can occur to the tree. In other words, choose the max depth that corresponds to the number of NFTs you need the tree to hold, then choose one of the options for max buffer size based on the traffic you expect you’ll need to support.

Next, choose the canopy depth. Increasing the canopy depth increases the composability of your cNFTs. Any time your or another developer’s code attempts to verify a cNFT down the road, the code will have to pass in as many proof nodes as there are “layers” in your tree. So for a max depth of 20, you’ll need to pass in 20 proof nodes. Not only is this tedious, but since each proof node is 32 bytes it’s possible to max out transaction sizes very quickly.

For example, if your tree has a very low canopy depth, an NFT marketplace may only be able to support simple NFTs transfers rather than support an onchain bidding system for your cNFTs. The canopy effectively caches proof nodes onchain so you don’t have to pass all of them into the transaction, allowing for more complex transactions.

Increasing any of these three values increases the size of the account, thereby increasing the cost associated with creating it. Weigh the benefits accordingly when choosing the values.

Once you know these values, you can use the `createAllocTreeIx` helper function from the `@solana/spl-account-compression` TS SDK to create the instruction for creating the empty account.

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

Note that this is simply a helper function for calculating the size required by the account and creating the instruction to send to the System Program for allocating the account. This function doesn’t interact with any compression-specific programs yet.

### Use Bubblegum to Initialize Your Tree

With the empty tree account created, you then use the Bubblegum program to initialize the tree. In addition to the Merkle tree account, Bubblegum creates a tree config account to add cNFT-specific tracking and functionality.

Version 0.7 of the `@metaplex-foundation/mpl-bubblegum` TS SDK provides the helper function `createCreateTreeInstruction` for calling the `create_tree` instruction on the Bubblegum program. As part of the call, you’ll need to derive the `treeAuthority` PDA expected by the program. This PDA uses the tree’s address as a seed.

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

The list below shows the required input for this helper function:

- `accounts` - An object representing the accounts required by the instruction. This includes:
    - `treeAuthority` - Bubblegum expects this to be a PDA derived using the Merkle tree address as a seed
    - `merkleTree` - The Merkle tree account
    - `payer` - The address paying for transaction fees, rent, etc.
    - `treeCreator` - The address to list as the tree creator
    - `logWrapper` - The program to use to expose the data to indexers through logs; this should be the address of the SPL Noop program unless you have some other custom implementation
    - `compressionProgram` - The compression program to use for initializing the Merkle tree; this should be the address of the SPL State Compression program unless you have some other custom implementation
- `args` - An object representing additional arguments required by the instruction. This includes:
    - `maxBufferSize` - The max buffer size of the Merkle tree
    - `maxDepth` - The max depth of the Merkle tree
    - `public` - When set to `true`, anyone will be able to mint cNFTs from the tree; when set to `false`, only the tree creator or tree delegate will be able to min cNFTs from the tree

When submitted, this will invoke the `create_tree` instruction on the Bubblegum program. This instruction does three things:

1. Creates the tree config PDA account
2. Initializes the tree config account with appropriate initial values
3. Issues a CPI to the State Compression program to initialize the empty Merkle tree account

Feel free to take a look at the program code [here](https://github.com/metaplex-foundation/mpl-bubblegum/blob/main/programs/bubblegum/program/src/lib.rs#L887).

### Mint cNFTs

With the Merkle tree account and its corresponding Bubblegum tree config account initialized, it’s possible to mint cNFTs to the tree. The Bubblegum instruction to use will be either `mint_v1` or `mint_to_collection_v1`, depending on whether or not you want to the minted cNFT to be part of a collection.

Version 0.7 of the `@metaplex-foundation/mpl-bubblegum` TS SDK provides helper functions `createMintV1Instruction` and `createMintToCollectionV1Instruction` to make it easier for you to create the instructions.

Both functions will require you to pass in the NFT metadata and a list of accounts required to mint the cNFT. Below is an example of minting to a collection:

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

Notice that there are two arguments for the helper function: `accounts` and `args`. The `args` parameter is simply the NFT metadata, while `accounts` is an object listing the accounts required by the instruction. There are admittedly a lot of them:

- `payer` - the account that will pay for the transaction fees, rent, etc.
- `merkleTree` - the Merkle tree account
- `treeAuthority` - the tree authority; should be the same PDA you derived previously
- `treeDelegate` - the tree delegate; this is usually the same as the tree creator
- `leafOwner` - the desired owner of the compressed NFT being minted
- `leafDelegate` - the desired delegate of the compressed NFT being minted; this is usually the same as the leaf owner
- `collectionAuthority` - the authority of the collection NFT
- `collectionAuthorityRecordPda` - optional collection authority record PDA; there typically is none, in which case you should put the Bubblegum program address
- `collectionMint` - the mint account for the collection NFT
- `collectionMetadata` - the metadata account for the collection NFT
- `editionAccount` - the master edition account of the collection NFT
- `compressionProgram` - the compression program to use; this should be the address of the SPL State Compression program unless you have some other custom implementation
- `logWrapper` - the program to use to expose the data to indexers through logs; this should be the address of the SPL Noop program unless you have some other custom implementation
- `bubblegumSigner` - a PDA used by the Bubblegrum program to handle collection verification
- `tokenMetadataProgram` - the token metadata program that was used for the collection NFT; this is usually always the Metaplex Token Metadata program

Minting without a collection requires fewer accounts, none of which are exclusive to minting without a collection. You can take a look at the example below.

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

## Interact with cNFTs

It’s important to note that cNFTs *are not* SPL tokens. That means your code needs to follow different conventions to handle cNFT functionality like fetching, querying, transferring, etc.

### Fetch cNFT data

The simplest way to fetch data from an existing cNFT is to use the [Digital Asset Standard Read API](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) (Read API). Note that this is separate from the standard JSON RPC. To use the Read API, you’ll need to use a supporting RPC Provider. Metaplex maintains a (likely non-exhaustive) [list of RPC providers](https://developers.metaplex.com/bubblegum/rpcs) that support the Read API. In this lesson we’ll be using [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) as they have free support for Devnet.

To use the Read API to fetch a specific cNFT, you need to have the cNFT’s asset ID. However, after minting cNFTs, you’ll have at most two pieces of information:

1. The transaction signature
2. The leaf index (possibly)

The only real guarantee is that you’ll have the transaction signature. It is **possible** to locate the leaf index from there, but it involves some fairly complex parsing. The short story is you must retrieve the relevant instruction logs from the Noop program and parse them to find the leaf index. We’ll cover this more in depth in a future lesson. For now, we’ll assume you know the leaf index.

This is a reasonable assumption for most mints given that the minting will be controlled by your code and can be set up sequentially so that your code can track which index is going to be used for each mint. I.e. the first mint will use index 0, the second index 1, etc.

Once you have the leaf index, you can derive the cNFT’s corresponding asset ID. When using Bubblegum, the asset ID is a PDA derived using the Bubblegum program ID and the following seeds:

1. The static string `asset` represented in utf8 encoding
2. The Merkle tree address
3. The leaf index

The indexer essentially observes transaction logs from the Noop program as they happen and stores the cNFT metadata that was hashed and stored in the Merkle tree. This enables them to surface that data when requested. This asset id is what the indexer uses to identify the particular asset.

For simplicity, you can just use the `getLeafAssetId` helper function from the Bubblegum SDK. With the asset ID, fetching the cNFT is fairly straightforward. Simply use the `getAsset` method provided by the supporting RPC provider:

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

This will return a JSON object that is comprehensive of what a traditional NFT’s on- and off-chain metadata would look like combined. For example, you can find the cNFT attributes at `content.metadata.attributes` or the image at `content.files.uri`.

### Query cNFTs

The Read API also includes ways to get multiple assets, query by owner, creator, and more. For example, Helius supports the following methods:

- `getAsset`
- `getSignaturesForAsset`
- `searchAssets`
- `getAssetProof`
- `getAssetsByOwner`
- `getAssetsByAuthority`
- `getAssetsByCreator`
- `getAssetsByGroup`

We won’t go over most of these directly, but be sure to look through the [Helius docs](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) to learn how to use them correctly.

### Transfer cNFTs

Just as with a standard SPL token transfer, security is paramount. An SPL token transfer, however, makes verifying transfer authority very easy. It’s built into the SPL Token program and standard signing. A compressed token’s ownership is more difficult to verify. The actual verification will happen program-side, but your client-side code needs to provide additional information to make it possible.

While there is a Bubblegum `createTransferInstruction` helper function, there is more assembly required than usual. Specifically, the Bubblegum program needs to verify that the entirety of the cNFT’s data is what the client asserts before a transfer can occur. The entirety of the cNFT data has been hashed and stored as a single leaf on the Merkle tree, and the Merkle tree is simply a hash of all the tree’s leafs and branches. Because of this, you can’t simply tell the program what account to look at and have it compare that account’s `authority` or `owner` field to the transaction signer.

Instead, you need to provide the entirety of the cNFT data and any of the Merkle tree’s proof information that isn’t stored in the canopy. That way, the program can independently prove that the provided cNFT data, and therefore the cNFT owner, is accurate. Only then can the program safely determine if the transaction signer should, in fact, be allowed to transfer the cNFT.

In broad terms, this involves a five step process:

1. Fetch the cNFT's asset data from the indexer
2. Fetch the cNFT's proof from the indexer
3. Fetch the Merkle tree account from the Solana blockchain
4. Prepare the asset proof as a list of `AccountMeta` objects
5. Build and send the Bubblegum transfer instruction

The first two steps are very similar. Using your supporting RPC provider, use the `getAsset` and `getAssetProof` methods to fetch the asset data and proof, respectively. 

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

The third step is to fetch the Merkle tree account. The simplest way to do this is using the `ConcurrentMerkleTreeAccount` type from `@solana/spl-account-compression`:

```tsx
const treePublicKey = new PublicKey(assetData.compression.tree)

const treeAccount = await ConcurrentMerkleTreeAccount.fromAccountAddress(
	connection,
	treePublicKey
)
```

Step four is the most conceptually challenging step. Using the three pieces of information gathered, you’ll need to assemble the proof path for the cNFT’s corresponding leaf. The proof path is represented as accounts passed to the program instruction. The program uses each of the account addresses as proof nodes to prove the leaf data is what you say it is.

The full proof is provided by the indexer as shown above in `assetProof`. However, you can exclude the same number of tail-end accounts from the proof as the depth of the canopy.

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

Finally, you can assemble the transfer instruction. The instruction helper function, `createTransferInstruction`, requires the following arguments:

- `accounts` - a list of instruction accounts, as expected; they are as follows:
    - `merkleTree` - the Merkle tree account
    - `treeAuthority` - the Merkle tree authority
    - `leafOwner` - the owner of the leaf (cNFT) in question
    - `leafDelegate` - the delegate of the leaf (cNFT) in question; if no delegate has been added then this should be the same as `leafOwner`
    - `newLeafOwner` - the address of the new owner post-transfer
    - `logWrapper` - the program to use to expose the data to indexers through logs; this should be the address of the SPL Noop program unless you have some other custom implementation
    - `compressionProgram` - the compression program to use; this should be the address of the SPL State Compression program unless you have some other custom implementation
    - `anchorRemainingAccounts` - this is where you add the proof path
- `args` - additional arguments required by the instruction; they are:
    - `root` - the root Merkle tree node from the asset proof; this is provided by the indexer as a string and must be converted to bytes first
    - `dataHash` - the hash of the asset data retrieved from the indexer; this is provided by the indexer as a string and must be converted to bytes first
    - `creatorHash` - the hash of the cNFT creator as retrieved from the indexer; this is provided by the indexer as a string and must be converted to bytes first
    - `nonce` - used to ensure that no two leafs have the same hash; this value should be the same as `index`
    - `index` - the index where the cNFT’s leaf is located on the Merkle tree

An example of this is shown below. Note that the first 3 lines of code grab additional information nested in the objects shown previously so they are ready to go when assembling the instruction itself.

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

## Conclusion

We’ve covered the primary skills needed to interact with cNFTs, but haven’t been fully comprehensive. You can also use Bubblegum to do things like burn, verify, delegate, and more. We won’t go through these, but these instructions are similar to the mint and transfer process. If you need this additional functionality, take a look at the [Bubblegum client source code](https://github.com/metaplex-foundation/mpl-bubblegum/tree/main/clients/js-solita) and leverage the helper functions it provides.

Keep in mind that compression is fairly new. Available tooling will evolve rapidly but the principles you’ve learned in this lesson will likely remain the same. These principles can also be broadened to arbitrary state compression, so be sure to master them here so you’re ready for more fun stuff in future lessons!

# Lab

Let’s jump in and practice creating and working with cNFTs. Together, we’ll build as simple a script as possible that will let us mint a cNFT collection from a Merkle tree.

### 1. Get the starter code

First things first, clone the starter code from the `starter` branch of our [cNFT lab repository](https://github.com/Unboxed-Software/solana-cnft-demo).

`git clone https://github.com/Unboxed-Software/solana-cnft-demo.git`

`cd solana-cnft-demo`

`npm install`

Take some time to familiarize yourself with the starter code provided. Most important are the helper functions provided in `utils.ts` and the URIs provided in `uri.ts`.

The `uri.ts` file provides 10k URIs that you can use for the off-chain portion of your NFT metadata. You can, of course, create your own metadata. But this lesson isn’t explicitly about preparing metadata so we’ve provided some for you.

The `utils.ts` file has a few helper functions to keep you from writing more unnecessary boilerplate than you need to. They are as follows:

- `getOrCreateKeypair` will create a new keypair for you and save it to a `.env` file, or if there’s already a private key in the `.env` file it will initialize a keypair from that.
- `airdropSolIfNeeded` will airdrop some Devnet SOL to a specified address if that address’s balance is below 1 SOL.
- `createNftMetadata` will create the NFT metadata for a given creator public key and index. The metadata it’s getting is just dummy metadata using the URI corresponding to the provided index from the `uri.ts` list of URIs.
- `getOrCreateCollectionNFT` will fetch the collection NFT from the address specified in `.env` or if there is none it will create a new one and add the address to `.env`.

Finally, there’s some boilerplate in `index.ts` that calls creates a new Devnet connection, calls `getOrCreateKeypair` to initialize a “wallet,” and calls `airdropSolIfNeeded` to fund the wallet if its balance is low.

We will be writing all of our code in the `index.ts`.

### 2. Create the Merkle tree account

We’ll start by creating the Merkle tree account. Let’s encapsulate this in a function that will eventually create *and* initialize the account. We’ll put it below our `main` function in `index.ts`. Let’s call it `createAndInitializeTree`. For this function to work, it will need the following parameters:

- `connection` - a `Connection` to use for interacting with the network.
- `payer` - a `Keypair` that will pay for transactions.
- `maxDepthSizePair` - a `ValidDepthSizePair`. This type comes from `@solana/spl-account-compression`. It’s a simple object with properties `maxDepth` and `maxBufferSize` that enforces a valid combination of the two values.
- `canopyDepth` - a number for the canopy depth
    
    In the body of the function, we’ll generate a new address for the tree, then create the instruction for allocating a new Merkle tree account by calling `createAllocTreeIx` from `@solana/spl-account-compression`.
    

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

### 3. Use Bubblegum to initialize the Merkle tree and create the tree config account

With the instruction for creating the tree ready to go, we can create an instruction for invoking `create_tree` on the Bubblegum program. This will initialize the Merkle tree account *and* create a new tree config account on the Bubblegum program.

This instruction needs us to provide the following:

- `accounts` - an object of required accounts; this includes:
    - `treeAuthority` - this should be a PDA derived with the Merkle tree address and the Bubblegum program
    - `merkleTree` - the address of the Merkle tree
    - `payer` - the transaction fee payer
    - `treeCreator` - the address of the tree creator; we’ll make this the same as `payer`
    - `logWrapper` - make this the `SPL_NOOP_PROGRAM_ID`
    - `compressionProgram` - make this the `SPL_ACCOUNT_COMPRESSION_PROGRAM_ID`
- `args` - a list of instruction arguments; this includes:
    - `maxBufferSize` - the buffer size from our function’s `maxDepthSizePair` parameter
    - `maxDepth` - the max depth from our function’s `maxDepthSizePair` parameter
    - `public` - whether or no the tree should be public; we’ll set this to `false`

Finally, we can add both instructions to a transaction and submit the transaction. Keep in mind that the transaction needs to be signed by both the `payer` and the `treeKeypair`.

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

If you want to test what you have so far, feel free to call `createAndInitializeTree` from `main` and provide small values for the max depth and max buffer size. 

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

Keep in mind that Devnet SOL is throttled so if you test too many times you might run out of Devnet SOL before we get to minting. To test, in your terminal run the following:

`npm run start`

### 4. Mint cNFTs to your tree

Believe it or not, that’s all you needed to do to set up your tree to compressed NFTs! Now let’s turn our attention to minting.

First, let’s declare a function called `mintCompressedNftToCollection`. It will need the following parameters:

- `connection` - a `Connection` to use for interacting with the network.
- `payer` - a `Keypair` that will pay for transactions.
- `treeAddress` - the Merkle tree’s address
- `collectionDetails` - the details of the collection as type `CollectionDetails` from `utils.ts`
- `amount` - the number of cNFTs to mint

The body of this function will do the following:

1. Derive the tree authority just like before. Again, this is a PDA derived from the Merkle tree address and the Bubblegum program.
2. Derive the `bubblegumSigner`. This is a PDA derived from the string `"collection_cpi"` and the Bubblegum program and is essential for minting to a collection.
3. Create the cNFT metadata by calling `createNftMetadata` from our `utils.ts` file.
4. Create the mint instruction by calling `createMintToCollectionV1Instruction` from the Bubblegum SDK.
5. Build and send a transaction with the mint instruction
6. Repeat steps 3-6 `amount` number of times

The `createMintToCollectionV1Instruction` takes two arguments: `accounts` and `args`. The latter is simply the NFT metadata. As with all complex instructions, the primary hurdle is knowing which accounts to provide. So let’s go through them real quick:

- `payer` - the account that will pay for the transaction fees, rent, etc.
- `merkleTree` - the Merkle tree account
- `treeAuthority` - the tree authority; should be the same PDA you derived previously
- `treeDelegate` - the tree delegate; this is usually the same as the tree creator
- `leafOwner` - the desired owner of the compressed NFT being minted
- `leafDelegate` - the desired delegate of the compressed NFT being minted; this is usually the same as the leaf owner
- `collectionAuthority` - the authority of the collection NFT
- `collectionAuthorityRecordPda` - optional collection authority record PDA; there typically is none, in which case you should put the Bubblegum program address
- `collectionMint` - the mint account for the collection NFT
- `collectionMetadata` - the metadata account for the collection NFT
- `editionAccount` - the master edition account of the collection NFT
- `compressionProgram` - the compression program to use; this should be the address of the SPL State Compression program unless you have some other custom implementation
- `logWrapper` - the program to use to expose the data to indexers through logs; this should be the address of the SPL Noop program unless you have some other custom implementation
- `bubblegumSigner` - a PDA used by the Bubblegrum program to handle collection verification
- `tokenMetadataProgram` - the token metadata program that was used for the collection NFT; this is usually always the Metaplex Token Metadata program

When you put it all together, this is what it’ll look like:

```tsx
async function mintCompressedNftToCollection(
  connection: Connection,
  payer: Keypair,
  treeAddress: PublicKey,
  collectionDetails: CollectionDetails,
  amount: number
) {
  // Derive the tree authority PDA ('TreeConfig' account for the tree account)
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [treeAddress.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  )

  // Derive the bubblegum signer, used by the Bubblegum program to handle "collection verification"
  // Only used for `createMintToCollectionV1` instruction
  const [bubblegumSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_cpi", "utf8")],
    BUBBLEGUM_PROGRAM_ID
  )

  for (let i = 0; i < amount; i++) {
    // Compressed NFT Metadata
    const compressedNFTMetadata = createNftMetadata(payer.publicKey, i)

    // Create the instruction to "mint" the compressed NFT to the tree
    const mintIx = createMintToCollectionV1Instruction(
      {
        payer: payer.publicKey, // The account that will pay for the transaction
        merkleTree: treeAddress, // The address of the tree account
        treeAuthority, // The authority of the tree account, should be a PDA derived from the tree account address
        treeDelegate: payer.publicKey, // The delegate of the tree account, should be the same as the tree creator by default
        leafOwner: payer.publicKey, // The owner of the compressed NFT being minted to the tree
        leafDelegate: payer.publicKey, // The delegate of the compressed NFT being minted to the tree
        collectionAuthority: payer.publicKey, // The authority of the "collection" NFT
        collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID, // Must be the Bubblegum program id
        collectionMint: collectionDetails.mint, // The mint of the "collection" NFT
        collectionMetadata: collectionDetails.metadata, // The metadata of the "collection" NFT
        editionAccount: collectionDetails.masterEditionAccount, // The master edition of the "collection" NFT
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
      // Create new transaction and add the instruction
      const tx = new Transaction().add(mintIx)

      // Set the fee payer for the transaction
      tx.feePayer = payer.publicKey

      // Send the transaction
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
      console.error("\nFailed to mint compressed NFT:", err)
      throw err
    }
  }
}
```

This is a great point to test with a small tree. Simply update `main` to call `getOrCreateCollectionNFT` then `mintCompressedNftToCollection`:

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

Again, to run, in your terminal type: `npm run start`

### 5. Read existing cNFT data

Now that we’ve written code to mint cNFTs, let’s see if we can actually fetch their data. This is tricky because the onchain data is just the Merkle tree account, the data from which can be used to verify existing information as accurate but is useless in conveying what the information is.

Let’s start by declaring a function `logNftDetails` that takes as parameters `treeAddress` and `nftsMinted`.

At this point we don’t actually have a direct identifier of any kind that points to our cNFT. To get that, we’ll need to know the leaf index that was used when we minted our cNFT. We can then use that to derive the asset ID used by the Read API and subsequently use the Read API to fetch our cNFT data.

In our case, we created a non-public tree and minted 8 cNFTs, so we know that the leaf indexes used were 0-7. With this, we can use the `getLeafAssetId` function from `@metaplex-foundation/mpl-bubblegum` to get the asset ID.

Finally, we can use an RPC that supports the [Read API](https://docs.solana.com/developing/guides/compressed-nfts#reading-compressed-nfts-metadata) to fetch the asset. We’ll be using [Helius](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api), but feel free to choose your own RPC provider. To use Helius, you’ll need to get a free API Key from [their website](https://dev.helius.xyz/). Then add your `RPC_URL` to your `.env` file. For example:

```bash
# Add this
RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY
```

Then simply issue a POST request to your provided RPC URL and put the `getAsset` information in the body:

```tsx
async function logNftDetails(treeAddress: PublicKey, nftsMinted: number) {
  for (let i = 0; i < nftsMinted; i++) {
    const assetId = await getLeafAssetId(treeAddress, new BN(i))
    console.log("Asset ID:", assetId.toBase58())
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

Helius essentially observes transaction logs as they happen and stores the NFT metadata that was hashed and stored in the Merkle tree. This enables them to surface that data when requested. 

If we add a call to this function at the end of `main` and re-run your script, the data we get back in the console is very comprehensive. It includes all of the data you’d expect in both the onchain and off-chain portion of a traditional NFT. You can find the cNFT’s attributes, files, ownership and creator information, and more.

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

Remember, the Read API also includes ways to get multiple assets, query by owner, creator, etc., and more. Be sure to look through the [Helius docs](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) to see what’s available.

### 6. Transfer a cNFT

The last thing we’re going to add to our script is a cNFT transfer. Just as with a standard SPL token transfer, security is paramount. Unlike with a standard SPL token transfer, however, to build a secure transfer with state compression of any kind, the program performing the transfer needs the entire asset data.

The program, Bubblegum in this case, needs to be provided with the entire data that was hashed and stored on the corresponding leaf *and* needs to be given the “proof path” for the leaf in question. That makes cNFT transfers a bit trickier than SPL token transfers.

Remember, the general steps are:

1. Fetch the cNFT's asset data from the indexer
2. Fetch the cNFT's proof from the indexer
3. Fetch the Merkle tree account from the Solana blockchain
4. Prepare the asset proof as a list of `AccountMeta` objects
5. Build and send the Bubblegum transfer instruction

Let’s start by declaring a `transferNft` function that takes the following:

- `connection` - a `Connection` object
- `assetId` - a `PublicKey` object
- `sender` - a `Keypair` object so we can sign the transaction
- `receiver` - a `PublicKey` object representing the new owner

Inside that function, let’s fetch the asset data again then also fetch the asset proof. For good measure, let’s wrap everything in a `try catch`.

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

Next, let’s fetch the Merkle tree account from the chain, get the canopy depth, and assemble the proof path. We do this by mapping the asset proof we got from Helius to a list of `AccountMeta` objects, then removing any proof nodes at the end that are already cached onchain in the canopy.

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
    console.error("\nFailed to transfer nft:", err)
    throw err
  }
}
```

Finally, we build the instruction using `createTransferInstruction`, add it to a transaction, then sign and send the transaction. This is what the entire `transferNft` function looks like when finished:

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
    console.error("\nFailed to transfer nft:", err)
    throw err
  }
}
```

Lets transfer our first compressed NFT at index 0 to someone else. First we’ll need to spin up another wallet with some funds, then grab the assetID at index 0 using `getLeafAssetId`. Then we’ll do the transfer. Finally, we’ll print out the entire collection using our function `logNftDetails`. You’ll note that the NFT at index zero will now belong to our new wallet in the `ownership` field. 

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

Go ahead and run your script. The whole thing should execute without failing, and all for close to 0.01 SOL!

Congratulations! Now you know how to mint, read, and transfer cNFTs. If you wanted, you could update the max depth, max buffer size, and canopy depth to larger values and as long as you have enough Devnet SOL, this script will let you mint up to 10k cNFTs for a small fraction of what it would cost to mint 10k traditional NFTs (Note: if you plan to mint a large amount of NFTs you might want to try and batch these instructions for fewer total transactions).

If you need more time with this lab, feel free to go through it again and/or take a look at the solution code on the `solution` branch of the [lab repo](https://github.com/Unboxed-Software/solana-cnft-demo/tree/solution).

## Challenge

It’s your turn to take these concepts for a spin on your own! We’re not going to be overly prescriptive at this point, but here are some ideas:

1. Create your own production cNFT collection
2. Build a UI for this lesson’s lab that will let you mint a cNFT and display it
3. See if you can replicate some of the lab script’s functionality in an onchain program, i.e. write a program that can mint cNFTs


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=db156789-2400-4972-904f-40375582384a)!

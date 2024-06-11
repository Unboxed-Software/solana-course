---
title: Create Solana NFTs With Metaplex
objectives:
- Explain NFTs and how they're represented on the Solana network
- Explain the role of Metaplex in the Solana NFT ecosystem
- Create and update NFTs using the Metaplex SDK
- Explain the basic functionality of the Token Metadata program, Candy Machine program, and Sugar CLI as tools that assist in creating and distributing NFTs on Solana
---

# Summary

- **Non-Fungible Tokens (NFTs)** are represented on Solana as SPL Tokens with an associated metadata account, 0 decimals, and a maximum supply of 1
-   **Metaplex** offers a collection of tools that simplify the creation and distribution of NFTs on the Solana blockchain
- The **Token Metadata** program standardizes the process of attaching metadata to SPL Tokens
- The **Metaplex SDK** is a tool that offers user-friendly APIs to assist developers in utilizing the onchain tools provided by Metaplex
- The **Candy Machine** program is an NFT distribution tool used to create and mint NFTs from a collection
- **Sugar CLI** is a tool that simplifies the process of uploading media/metadata files and creating a Candy Machine for a collection

# Lesson

Solana Non-Fungible Tokens (NFTs) are SPL tokens created using the Token program. These tokens, however, also have an additional metadata account associated with each token mint. This allows for a wide variety of use cases for tokens. You can effectively tokenize anything, from game inventory to art.

In this lesson, we'll cover the basics of how NFTs are represented on Solana, how to create and update them using the Metaplex SDK, and provide a brief introduction to tools that can assist you in producing and distributing NFTs on Solana at scale.

## NFTs on Solana

A Solana NFT is a non-divisible token with associated metadata. Further, the token's mint has a maximum supply of 1. 

In other words, an NFT is a standard token from the Token Program but differs from what you might think of as "standard tokens" in that it:

1. Has 0 decimals so it cannot be divided into parts
2. Comes from a token mint with the supply of 1 so only 1 of these tokens exists
3. Comes from a token mint whose authority is set to `null` (to ensure that the supply never changes)
4. Has an associated account that stores metadata

While the first three points are features that can be achieved with the SPL Token Program, the associated metadata requires some additional functionality.

Typically, an NFT’s metadata has both an onchain and off-chain component. See the diagram below:

![Metadata](../assets/solana-nft-metaplex-metadata.png)

 - The **onchain metadata** is stored in an account associated with the token mint. The onchain metadata contains a URI field that points to an off-chain `.json` file.
 - The **off-chain metadata** in the JSON file stores the link to the media (images, videos, 3D files) of the NFT, any traits the NFT may have, and additional metadata (see [this example JSON file](https://lsc6xffbdvalb5dvymf5gwjpeou7rr2btkoltutn5ij5irlpg3wa.arweave.net/XIXrlKEdQLD0dcML01kvI6n4x0GanLnSbeoT1EVvNuw)). Permanent data storage systems such as Arweave are often used to store the off-chain component of NFT metadata.

## **Metaplex**

[Metaplex](https://www.metaplex.com/) is an organization that provides a suite of tools, like the [Metaplex SDK](https://docs.metaplex.com/sdks/js/), that simplify the creation and distribution of NFTs on the Solana blockchain. These tools cater to a wide range of use cases and allow you to easily manage the entire NFT process of creating and minting an NFT collection.

More specifically, the Metaplex SDK is designed to assist developers in utilizing Metaplex's onchain tools. It offers a user-friendly API that focuses on popular use cases and allows for easy integration with third-party plugins. To learn more about the capabilities of the Metaplex SDK, refer to the [README](https://github.com/metaplex-foundation/js#readme).

One of Metaplex's essential programs is the Token Metadata program. This program standardizes the process of attaching metadata to SPL Tokens. When creating an NFT with Metaplex, the Token Metadata program creates a metadata account using a Program Derived Address (PDA) with the token mint as a seed. This allows the metadata account for any NFT to be located deterministically using the address of the token mint. To learn more about the Token Metadata program, refer to the Metaplex [documentation](https://docs.metaplex.com/programs/token-metadata/).

The following sections cover the basics of using the Metaplex SDK to prepare assets, create NFTs, update NFTs, and associate an NFT with a broader collection.

### Metaplex instance

A `Metaplex` instance serves as the entry point for accessing the Metaplex SDK APIs. This instance accepts a connection used to communicate with the cluster. Additionally, developers can customize the SDK's interactions by specifying an "Identity Driver" and a "Storage Driver".

The Identity Driver is effectively a keypair that can be used to sign transactions, a requirement when creating an NFT. The Storage Driver is used to specify the storage service you want to use for uploading assets. The `bundlrStorage` driver is the default option and it uploads assets to Arweave, a permanent and decentralized storage service.

Below is an example of setting up the `Metaplex` instance for devnet.

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

### Upload assets

Before creating an NFT, you must prepare and upload any assets you plan to associate with the NFT. While this doesn't have to be an image, most NFTs have an image associated with them.

Preparing and uploading an image involves converting the image to a buffer, converting it to the Metaplex format using the `toMetaplexFile` function, and finally uploading it to the designated Storage Driver.

The Metaplex SDK supports the creation of a new Metaplex file from either files present on your local computer or those uploaded by a user through a browser. You can do the former by using `fs.readFileSync` to read the image file, then convert it into a Metaplex file using `toMetaplexFile`. Finally, use your `Metaplex` instance to call `storage().upload(file)` to upload the file. The function's return value will be the URI where the image was stored.

```tsx
const buffer = fs.readFileSync("/path/to/image.png");
const file = toMetaplexFile(buffer, "image.png");

const imageUri = await metaplex.storage().upload(file);
```

### Upload metadata

After uploading an image, it's time to upload the off-chain JSON metadata using the `nfts().uploadMetadata` function. This will return a URI where the JSON metadata is stored.

Remember, the off-chain portion of the metadata includes things like the image URI as well as additional information like the name and description of the NFT. While you can technically include anything you'd like in this JSON object, in most cases, you should follow the [NFT standard](https://docs.metaplex.com/programs/token-metadata/token-standard#the-non-fungible-standard) to ensure compatibility with wallets, programs, and applications.

To create the metadata, use the SDK's `uploadMetadata` method. This method accepts a metadata object and returns a URI that points to the uploaded metadata.

```tsx
const { uri } = await metaplex.nfts().uploadMetadata({
  name: "My NFT",
  description: "My description",
  image: imageUri,
});
```

### Create NFT

After uploading the NFT's metadata, you can finally create the NFT on the network. The Metaplex SDK's `create` method allows you to create a new NFT with minimal configuration. This method will handle the creation of the mint account, token account, metadata account, and master edition account for you. The data provided to this method will represent the onchain portion of the NFT metadata. You can explore the SDK to see all the other input that can be optionally provided to this method.

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

This method returns an object containing information about the newly created NFT. By default, the SDK sets the `isMutable` property to true, allowing updates to be made to the NFT's metadata. However, you can choose to set `isMutable` to false, making the NFT's metadata immutable.

### Update NFT

If you've left `isMutable` as true, you may end up having a reason to update your NFT's metadata. The SDK's `update` method allows you to update both the onchain and off-chain portions of the NFT's metadata. To update the off-chain metadata, you'll need to repeat the steps of uploading a new image and metadata URI as outlined in the previous steps, then provide the new metadata URI to this method. This will change the URI that the onchain metadata points to, effectively updating the off-chain metadata as well.

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

Note that any fields you don't include in the call to `update` will stay the same, by design.

### Add NFT to Collection

A [Certified Collection](https://docs.metaplex.com/programs/token-metadata/certified-collections#introduction) is an NFT that individual NFTs can belong to. Think of a large NFT collection like Solana Monkey Business. If you look at an individual NFT's [Metadata](https://explorer.solana.com/address/C18YQWbfwjpCMeCm2MPGTgfcxGeEDPvNaGpVjwYv33q1/metadata) you will see a `collection` field with a `key` that points to the `Certified Collection` [NFT](https://explorer.solana.com/address/SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND/). Simply put, NFTs that are part of a collection are associated with another NFT representing the collection itself.

To add an NFT to a collection, first, the Collection NFT has to be created. The process is the same as before, except you'll include one additional field on our NFT Metadata: `isCollection`. This field tells the token program that this NFT is a Collection NFT.

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

You then list the collection's Mint Address as the reference for the `collection` field in our new Nft.

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

When you checkout the metadata on your newly created NFT, you should now see a `collection` field like so:

```JSON
"collection":{
  "verified": false,
  "key": "SMBH3wF6baUj6JWtzYvqcKuj2XCKWDqQxzspY12xPND"
}
```

The last thing you need to do is verify the NFT. This effectively just flips the `verified` field above to true, but it's incredibly important. This is what lets consuming programs and apps know that your NFT is in fact part of the collection. You can do this using the `verifyCollection` function:

```tsx
await metaplex.nfts().verifyCollection({
  mintAddress: nft.address,
  collectionMintAddress: collectionNft.address,
  isSizedCollection: true,
})
```

### Candy Machine 

When creating and distributing a bulk supply of NFTs, Metaplex makes it easy with its [Candy Machine](https://docs.metaplex.com/programs/candy-machine/overview) program and [Sugar CLI](https://docs.metaplex.com/developer-tools/sugar/).

Candy Machine is effectively a minting and distribution program to help launch NFT collections. Sugar is a command line interface that helps you create a candy machine, prepare assets, and create NFTs at scale. The steps covered above for creating an NFT would be incredibly tedious to execute for thousands of NFTs in one go. Candy Machine and Sugar solve this and help ensure a fair launch by offering a number of safeguards.

We won't cover these tools in-depth but check out [how Candy Machine and Sugar work together from the Metaplex docs](https://docs.metaplex.com/developer-tools/sugar/overview/introduction).

To explore Metaplex's full range of tools, you can view the [Metaplex repository](https://github.com/metaplex-foundation/metaplex) on GitHub. 


# Lab

In this lab, we'll go through the steps to create an NFT using the Metaplex SDK, update the NFT's metadata after the fact, and then associate the NFT with a collection. By the end, you will have a basic understanding of how to use the Metaplex SDK to interact with NFTs on Solana.

### 1. Starter

To begin, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-metaplex/tree/starter).

The project contains two images in the `src` directory that we will be using for the NFTs.

Additionally, in the `index.ts` file, you will find the following code snippet which includes sample data for the NFT we’ll be creating and updating.

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

To install the necessary dependencies, run `npm install` in the command line.

Next, execute the code by running `npm start`. This will create a new keypair, write it to the `.env` file, and airdrop devnet SOL to the keypair.

```
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

### 2. Set up Metaplex

Before we start creating and updating NFTs, we need to set up the Metaplex instance. Update the `main()` function with the following:

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

### 3. `uploadMetadata` helper function

Next, let's create a helper function to handle uploading an image and metadata and returning the metadata URI. This function will take in the Metaplex instance and NFT data as input and return the metadata URI as output.

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

This function will read an image file, convert it to a buffer, then upload it to get an image URI. It will then upload the NFT metadata, which includes the name, symbol, description, and image URI, and get a metadata URI. This URI is the off-chain metadata. This function will also log the image URI and metadata URI for reference.

### 5. `createNft` helper function

Next, let's create a helper function to handle creating the NFT. This function takes in the Metaplex instance, metadata URI, and NFT data as inputs. It uses the SDK's `create` method to create the NFT, passing in the metadata URI, name, seller fee, and symbol as parameters.

```tsx
// helper function create NFT
async function createNft(
  metaplex: Metaplex,
  uri: string,
  nftData: NftData,
): Promise<NftWithToken> {
  const { nft } = await metaplex.nfts().create(
    {
      uri: uri, // metadata URI
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

The function `createNft` logs the token mint URL and returns the an `nft` object containing information about the newly created NFT. The NFT will be minted to the public key corresponding to the `user` used as the Identity Driver when setting up the Metaplex instance.

### 6. Create NFT

Now that we have set up the Metaplex instance and created helper functions for uploading metadata and creating NFTs, we can test these functions by creating an NFT. In the `main()` function, call the `uploadMetadata` function to upload the NFT data and get the metadata URI. Then, use the `createNft` function and metadata URI to create an NFT.

```tsx
async function main() {
	...

  // upload the NFT data and get the URI for the metadata
  const uri = await uploadMetadata(metaplex, nftData)

  // create an NFT using the helper function and the URI from the metadata
  const nft = await createNft(metaplex, uri, nftData)
}
```

Run `npm start` in the command line to execute the `main` function. You should see output similar to the following:

```tsx
Current balance is 1.770520342
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
image uri: https://arweave.net/j5HcSX8qttSgJ_ZDLmbuKA7VGUo7ZLX-xODFU4LFYew
metadata uri: https://arweave.net/ac5fwNfRckuVMXiQW_EAHc-xKFCv_9zXJ-1caY08GFE
Token Mint: https://explorer.solana.com/address/QdK4oCUZ1zMroCd4vqndnTH7aPAsr8ApFkVeGYbvsFj?cluster=devnet
Finished successfully
```

Feel free to inspect the generated URIs for the image and metadata, as well as view the NFT on the Solana Explorer by visiting the URL provided in the output.

### 7. `updateNftUri` helper function

Next, let's create a helper function to handle updating an existing NFT's URI. This function will take in the NFT's Metaplex instance, metadata URI, and mint address. It uses the SDK's `findByMint` method to fetch the existing NFT data using the mint address and then the `update` method to update the metadata with the new URI. Finally, it will log the token mint URL and transaction signature for reference.

```tsx
// helper function update NFT
async function updateNftUri(
  metaplex: Metaplex,
  uri: string,
  mintAddress: PublicKey,
) {
  // fetch NFT data using mint address
  const nft = await metaplex.nfts().findByMint({ mintAddress });

  // update the NFT metadata
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

### 8. Update NFT

To update an existing NFT, we first need to upload new metadata for the NFT and get the new URI. In the `main()` function, call the `uploadMetadata` function again to upload the updated NFT data and get the new URI for the metadata. Then, we can use the `updateNftUri` helper function, passing in the Metaplex instance, the new URI from the metadata, and the mint address of the NFT. The `nft.address` is from the output of the `createNft` function.

```tsx
async function main() {
	...

  // upload updated NFT data and get the new URI for the metadata
  const updatedUri = await uploadMetadata(metaplex, updateNftData)

  // update the NFT using the helper function and the new URI from the metadata
  await updateNftUri(metaplex, updatedUri, nft.address)
}
```

Run `npm start` in the command line to execute the `main` function. You should see additional output similar to the following:

```tsx
...
Token Mint: https://explorer.solana.com/address/6R9egtNxbzHr5ksnGqGNHXzKuKSgeXAbcrdRUsR1fkRM?cluster=devnet
Transaction: https://explorer.solana.com/tx/5VkG47iGmECrqD11zbF7psaVqFkA4tz3iZar21cWWbeySd66fTkKg7ni7jiFkLqmeiBM6GzhL1LvNbLh4Jh6ozpU?cluster=devnet
Finished successfully
```

You can also view the NFTs in Phantom wallet by importing the `PRIVATE_KEY` from the .env file.

### 9. Create an NFT collection

Awesome, you now know how to create a single NFT and update it on the Solana blockchain! But, how do you add it to a collection?

First, let's create a helper function called `createCollectionNft`. Note that it's very similar to `createNft`, but ensures that `isCollection` is set to true and that the data matches the requirements for a collection.

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

Next, we need to create the off-chain data for the collection. In `main` *before* the existing calls to `createNft`, add the following `collectionNftData`:

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

Now, let's call `uploadMetadata` with the `collectionNftData` and then call `createCollectionNft`. Again, do this *before* the code that creates an NFT. 

```tsx
async function main() {
  ...

  // upload data for the collection NFT and get the URI for the metadata
  const collectionUri = await uploadMetadata(metaplex, collectionNftData)

  // create a collection NFT using the helper function and the URI from the metadata
  const collectionNft = await createCollectionNft(
    metaplex,
    collectionUri,
    collectionNftData
  )
}
```

This will return our collection's mint address so we can use it to assign NFTs to the collection.

### 10. Assign an NFT to a collection

Now that we have a collection, let's change our existing code so that newly created NFTs get added to the collection. First, let's modify our `createNft` function so that the call to `nfts().create` includes the `collection` field. Then, add code that calls `verifyCollection` to make it so the `verified` field in the onchain metadata is set to true. This is how consuming programs and apps can know for sure that the NFT in fact belongs to the collection.

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

  //this is what verifies our collection as a Certified Collection
  await metaplex.nfts().verifyCollection({  
    mintAddress: nft.mint.address,
    collectionMintAddress: collectionMint,
    isSizedCollection: true,
  })

  return nft
}
```

Now, run `npm start` and voila! If you follow the new NFT link and look at the Metadata tab you will see a `collection` field with your collection's mint address listed.

Congratulations! You've successfully learned how to use the Metaplex SDK to create, update, and verify NFTs as part of a collection. That's everything you need to build out your own collection for just about any use case. You could build a TicketMaster competitor, revamp Costco's Membership Program, or even digitize your school's Student ID system. The possibilities are endless!

If you want to examine the final solution code, you can find it on the solution branch of the same [repository](https://github.com/Unboxed-Software/solana-metaplex/tree/solution).

# Challenge

To deepen your understanding of the Metaplex tools, dive into the Metaplex documentation and familiarize yourself with the various programs and tools offered by Metaplex. For instance, you can delve into learning about the Candy Machine program to understand its functionality.

Once you have an understanding of how the Candy Machine program works, put your knowledge to the test by using the Sugar CLI to create a Candy Machine for your own collection. This hands-on experience will not only reinforce your understanding of the tools but also boost your confidence in your ability to use them effectively in the future.

Have some fun with this! This will be your first independently created NFT collection! With this, you'll complete Module 2. Hope you're feeling the process! Feel free to [share some quick feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%202) so that we can continue to improve the course!


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=296745ac-503c-4b14-b3a6-b51c5004c165)!

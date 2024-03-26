---
title: Metadata and metadata pointer extension
objectives:
- Explain how the metadata pointers and metadata extensions work on Token Extension Program Mints
- Create an NFT with the metadata pointer extension
- Create an NFT with metadata embedded in the mint account itself
---

# Summary
- The `metadata pointer` extension associates a direct public key pointer to the metadata account, be that internal (embedded) or external (Metaplex)
- The `metadata` mint extensions allows you to embed metadata right on mint accounts created in the Token Extension Program. This is generally used with a self-pointing `metadata pointer` extension.

# Overview

The Token Extension Program streamlines metadata on Solana. Without the Token Extension Program, developers store metadata in metadata accounts using a metadata on-chain program; mainly `Metaplex`. However, this has some drawbacks. For example the mint account to which the metadata is "attached" has no awareness of the metadata account. To determine if an account has metadata, we have to PDA the mint and the `Metaplex` program together and query the network to see if a Metadata account exists. Additionally, to create and update this metadata you have to use a secondary program (i.e. `Metaplex`). These processes require users to use venders and increase complexity. Token Extension Programs's Metadata extensions fix this by introducing two extensions:

- `metadata-pointer` extension: Adds two simple fields in the mint account itself: a publicKey pointer to the account that holds the metadata for the token following the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface), and the authority to update this pointer.
- `metadata` extension: Adds the fields described in the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/) which allows us to store the metadata in the mint itself.

Note: The `metadata` extension is usually used in conjunction with the `metadata-pointer` extension which points back to the mint itself.

## Metadata-Pointer extension:

Since multiple metadata programs exist, a mint can have numerous accounts claiming to describe the mint, making it complicated to know which one is the mint's "official" metadata. To resolve this, the `metadata-pointer` extension adds a `publicKey` field to the mint account called `metadataAddress`, which points to the account that holds the metadata for this token. To avoid phony mints claiming to be a stablecoin, a client can now check whether the mint and the metadata point to each other.

The extension adds two new fields to the mint account to accomplish this:
- `metadataAddress`: Holds the metadata account address for this token; it can be pointing to the mint token itself, if you use the `metadata` extension we'll talk about in a bit.
- `authority`: The authority that can set the metadata address.

The extension also introduces three new helper functions:
- `createInitializeMetadataPointerInstruction`
- `createUpdateMetadataPointerInstruction`
- `getMetadataPointerState`

The function `createInitializeMetadataPointerInstruction` will return an instruction that will set the metadata address in the mint account.

This function takes four parameters:
  - `mint`: the mint account that will be created
  - `authority`: the authority that can set the metadata address
  - `metadataAddress`: the account address that holds the metadata
  - `programId`: the SPL Token program Id (in this case, it will be the Token Extension program Id)

```ts
function createInitializeMetadataPointerInstruction(
    mint: PublicKey,
    authority: PublicKey | null,
    metadataAddress: PublicKey | null,
    programId: PublicKey
)
```

The function `createUpdateMetadataPointerInstruction` returns an instruction that will update the mint account's metadata address. You can update the metadata pointer at any point if you hold the authority.

This function takes five parameters:
  - `mint`: the mint account that will be created.
  - `authority`: the authority that can set the metadata address
  - `metadataAddress`: the account address that holds the metadata
  - `multiSigners`: the multi-signers that will sign the transaction
  - `programId`: the SPL Token program Id (in this case, it will be the Token Extension program Id)
  
```ts
function createUpdateMetadataPointerInstruction(
    mint: PublicKey,
    authority: PublicKey,
    metadataAddress: PublicKey | null,
    multiSigners: (Signer | PublicKey)[] = [],
    programId: PublicKey = TOKEN_2022_PROGRAM_ID
)
```

The function `getMetadataPointerState` will return the `MetadataPointer` state for the given `Mint` object, which you can get using the `getMint` function.

```ts
function getMetadataPointerState(mint: Mint): Partial<MetadataPointer> | null
```

```ts
export interface MetadataPointer {
    /** Optional authority that can set the metadata address */
    authority: PublicKey | null;
    /** Optional Account Address that holds the metadata */
    metadataAddress: PublicKey | null;
}
```

### Create NFT with metadata-pointer

To create a NFT with the `metadata-pointer` extension, we need two new accounts: the `mint` and the `metadataAccount`. 

The `mint` is usually a new `Keypair` created by `Keypair.generate()`. The `metadataAccount` can be the `mint`'s `publicKey` if using the metadata mint extension or another metadata account like from `Metaplex`.

At this point, the `mint` is only a `Keypair`, but we need to save space for it on the blockchain. All accounts on the Solana blockchain owe rent proportional to the size of the account, and we need to know how big the mint account is in bytes. We can use the `getMintLen` method from the `@solana/spl-token` library. Using the `metadata-pointer` extension causes the mint account to be larger thanks to the two new fields in the account, `metadataAddress` and `authority.`

```ts
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
```

To create and initialize the `mint` with the metadata pointer, we need several instructions in a particular order:

1. Create the `mint` account, which reserves space on the blockchain with `web3.SystemProgram.createAccount`
2. Initialize the metadata pointer extension with `createInitializeMetadataPointerInstruction`
3. Initialize the mint itself with `createInitializeMintInstruction`

```ts
 const createMintAccountInstructions = web3.SystemProgram.createAccount({
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

Remember, the order matters.

To create the NFT, bundle all of these instructions together and send them to the blockchain:
```ts
const transaction = new web3.Transaction().add(
  createMintAccountInstructions,
  initMetadataPointerInstructions,
  initMintInstructions,
);
const sig = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);
```

## Metadata extension:

The `metadata` extension is an exciting addition to the Token Extension Program. This extension allows us to store the metadata directly *in* the mint itself! This eliminates the need for a separate account, greatly simplifying the handling of metadata. 

Note that the `metadata` extension works directly with the `metadata-pointer` extension. During mint creation, you should also add the `metadata-pointer` extension, pointed at the mint itself. Check out the [Solana Token Extension Program docs](https://spl.solana.com/token-2022/extensions#metadata)

The added fields and functions in the metadata extension follow the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface)


When a mint is initialized with the metadata extension, it will house these extra fields: 
```rust
type Pubkey = [u8; 32];
type OptionalNonZeroPubkey = Pubkey; // if all zeroes, interpreted as `None`

pub struct TokenMetadata {
    /// The authority that can sign to update the metadata
    pub update_authority: OptionalNonZeroPubkey,
    /// The associated mint, used to counter spoofing to be sure that metadata
    /// belongs to a particular mint
    pub mint: Pubkey,
    /// The longer name of the token
    pub name: String,
    /// The shortened symbol for the token
    pub symbol: String,
    /// The URI pointing to richer metadata
    pub uri: String,
    /// Any additional metadata about the token as key-value pairs. The program
    /// must avoid storing the same key twice.
    pub additional_metadata: Vec<(String, String)>,
}
```

With these added fields, the `@solana/spl-token-metadata` library has been updated with the following functions to help out:
- `createInitializeInstruction`
- `createUpdateFieldInstruction`
- `createRemoveKeyInstruction`
- `createUpdateAuthorityInstruction`
- `createEmitInstruction`
- `pack`
- `unpack`

We also have one more new functions and two constants from the `@solana/spl-token` library:
- `getTokenMetadata`
- `LENGTH_SIZE`: a constant number of bytes of the length of the data
- `TYPE_SIZE`: a constant number of bytes of the type of the data

The function `createInitializeInstruction` initializes the metadata in the account and sets the primary metadata fields (name, symbol, URI). The function then returns an instruction that will set the metadata fields in the mint account.

This function takes eight parameters:
  - `mint`: the mint account that will be initialize.
  - `metadata`: the metadata account that will be created.
  - `mintAuthority`: the authority that can mint tokens
  - `updateAuthority`: the authority that can sign to update the metadata
  - `name`: the longer name of the token
  - `symbol`: the shortened symbol for the token
  - `uri`: the URI pointing to richer metadata
  - `programId`: the SPL Token program Id (in this case it will be the Token Extension program Id)

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

export function createInitializeInstruction(args: InitializeInstructionArgs): TransactionInstruction {
    ...
}
```

The function `createUpdateFieldInstruction` returns an instruction that creates or updates a field in a token-metadata account. 

Note: This function will automatically reallocate the mint's size to fit the data! That being said, the caller will be charged for the extra space allocated.

This function takes five parameters:
  - `metadata`: the metadata account address.
  - `updateAuthority`: the authority that can sign to update the metadata
  - `field`: the field that we want to update, this is either one of the built in `Field`s or a custom field stored in the `additional_metadata`
  - `value`: the new value of the field
  - `programId`: the SPL Token program Id (in this case it will be the Token Extension program Id)

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

export function createUpdateFieldInstruction(args: UpdateFieldInstruction): TransactionInstruction {
    ...
}
```

The function `createRemoveKeyInstruction` returns and instruction that removes a `additional_metadata` field from a token-metadata account.

This function takes five parameters:
  - `metadata`: the metadata account address.
  - `updateAuthority`: the authority that can sign to update the metadata
  - `field`: the field that we want to remove
  - `programId`: the SPL Token program Id (in this case it will be the Token Extension program Id)
  - `idempotent`: When true, instruction will not error if the key does not exist

```ts
export interface RemoveKeyInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    updateAuthority: PublicKey;
    key: string;
    idempotent: boolean;
}

export function createRemoveKeyInstruction(args: RemoveKeyInstructionArgs): TransactionInstruction {
    ...
}
```

The function `createUpdateAuthorityInstruction` returns an instruction that updates the authority of a token-metadata account.

This function takes four parameters:
  - `metadata`: the metadata account address.
  - `oldAuthority`: the current authority that can sign to update the metadata
  - `newAuthority`: the new authority that can sign to update the metadata
  - `programId`: the SPL Token program Id (in this case it will be the Token Extension program Id)

```ts
export interface UpdateAuthorityInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    oldAuthority: PublicKey;
    newAuthority: PublicKey | null;
}

export function createUpdateAuthorityInstruction(args: UpdateAuthorityInstructionArgs): TransactionInstruction {
    ...
}
```

The function `createEmitInstruction` "emits" or logs out token-metadata in the expected TokenMetadata state format. This function is a required function for metadata programs that want to follow the TokenMetadata interface. The emit instruction allows indexers and other off-chain users to call to get metadata. This also allows custom metadata programs to store [metadata in a different format while maintaining compatibility with the Interface standards](https://solana.com/developers/guides/token-extensions/metadata-pointer#metadata-interface-instructions). 

This function takes four parameters:
  - `metadata`: the metadata account address.
  - `programId`: the SPL Token program Id (in this case it will be the Token Extension program Id)
  - `start`: *Optional* the start the metadata
  - `end`: *Optional* the end the metadata

```ts
export interface EmitInstructionArgs {
    programId: PublicKey;
    metadata: PublicKey;
    start?: bigint;
    end?: bigint;
}

export function createEmitInstruction(args: EmitInstructionArgs): TransactionInstruction {
    ...
}
```

The function `pack` packs the metadata into a byte array, and conversely the function `unpack` unpacks the metadata from a byte array. This is primarily used to get the size of the metadata in bytes, which is needed to allocate enough space for it.

```ts
export interface TokenMetadata {
    // The authority that can sign to update the metadata
    updateAuthority?: PublicKey;
    // The associated mint, used to counter spoofing to be sure that metadata belongs to a particular mint
    mint: PublicKey;
    // The longer name of the token
    name: string;
    // The shortened symbol for the token
    symbol: string;
    // The URI pointing to richer metadata
    uri: string;
    // Any additional metadata about the token as key-value pairs
    additionalMetadata: [string, string][];
}

export const pack = (meta: TokenMetadata): Uint8Array => {
    ...
}

export function unpack(buffer: Buffer | Uint8Array): TokenMetadata {
    ...
}
```

The function `getTokenMetadata` returns the metadata for the given mint.

It takes four parameters:
  - `connection`: Connection to use
  - `address`: mint account
  - `commitment`: desired level of commitment for querying the state
  - `programId`: SPL Token program account (in this case it will be the Token Extension program Id)

```ts
export async function getTokenMetadata(
    connection: Connection,
    address: PublicKey,
    commitment?: Commitment,
    programId = TOKEN_2022_PROGRAM_ID
): Promise<TokenMetadata | null> {
    ...
}
```

### Create NFT with metadata extension

Creating an NFT with the metadata extension is just like creating one with the metadata-pointer with a few extra steps:
<!-- 
1. Gather our needed accounts
2. Find/decide on the needed size of our metadata
3. Create the `mint` account
4. Initialize the pointer.
5. Initialize the mint.
6. Initialize the metadata in the mint account
7. Add any additional custom fields if needed
  -->
First, the `mint` will be a Keypair, usually given from `Keypair.generate()`. Then, we must decide what metadata to include and calculate the total size and cost.

A mint account's size with the metadata and metadata-pointer extensions incorporate the following:

1. the basic metadata felids: name, symbol, and URI.
2. the additional custom fields we want to store as a metadata.
3. the update authority that can change the metadata in the future.
4. the `LENGTH_SIZE` and `TYPE_SIZE` constants from the `@solana/spl-token` library - these are sizes associated with mint extensions that are usually added with the call `getMintLen`, but since the metadata extension is variable length, they need to be added manually.
5. the metadata pointer data (this will be the mint's address and is done for consistency)

Note: There is no need to allocate more space than what is necessary. The `createUpdateFieldInstruction` will automatically reallocate space and charge the payer accordingly to accommodate new data!
  
To determine all of this programmatically, we use the `getMintLen` and `pack` functions from the `@solana/spl-token` library:

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

To actually create and initialize the `mint` with the metadata and metadata pointer, we need several instructions in a particular order:

1. Create the `mint` account which reserves space on the blockchain with `web3.SystemProgram.createAccount`
2. Initialize the metadata pointer extension with `createInitializeMetadataPointerInstruction`
3. Initialize the mint itself with `createInitializeMintInstruction`
4. Initialize the metadata with `createInitializeInstruction`, note this ONLY sets the basic metadata fields
5. Optional: Set the custom fields with `createUpdateFieldInstruction`


```ts
  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: totalLen,
  });

  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey, 
    payer.publicKey,
    mint.publicKey, // we will point to the mint it self as the metadata account
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMetadataInstructions = createInitializeInstruction({
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

Wrap all of these instructions in a transaction to create the embedded NFT:
```ts
const transaction = new web3.Transaction().add(
  createMintAccountInstructions,
  initMetadataPointerInstructions,
  initMintInstructions,
  initMetadataInstructions,
  updateMetadataFieldInstructions, // if you want to add any custom field
);
const sig = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);
```

Again, the order here matters.

Note: The `createUpdateFieldInstruction` updates only one field at a time. If you want to have more than one custom field, you will have to call this method multiple times. You can use the same method to update the basic metadata fields as well:

```ts
  const updateMetadataFieldInstructions = createUpdateFieldInstruction({
    metadata: mint.publicKey,
    updateAuthority: payer.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    field: 'name', // Field | string 
    value: 'new name',
  });
```

# Lab

Now it is time to practice what we have learned so far. In this lab, we will create a script that will illustrate how to create an NFT with the `metadata` and `metadata pointer` extensions.

## 0. Getting started

Let's go ahead and clone our starter code
```bash
git clone https://github.com/Unboxed-Software/solana-lab-token22-metadata.git
cd solana-lab-token22-metadata
git checkout starter
npm install
```

Let's take a look at what's been provided in the `starter` branch. 

Besides the NodeJS project being initialized with all of the needed dependencies, two other files have been provided in the `src/` directory.

- `cat.jpg`
- `helpers.ts`
- `index.ts`

**`cat.jpg`** is the image we'll use for the NFT. Feel free to replace it with your own image.

**`helpers.ts`** file provides us with a nice helper function `uploadOffChainMetadata`.

`uploadOffChainMetadata` is a helper to store the off-chain metadata on IPFS using NFT.storage. In this lab we're more focused on the Token Extension Program interaction, so this uploader function is provided. It is good to note that while an NFT or any off-chain metadata can be stored anywhere with any provider like [NFT.storage](https://nft.storage/), Solana's native [ShadowDrive](https://www.shdwdrive.com/), or [Irys (Formerly Bundlr)](https://irys.xyz/). At the end of the day, all you need is a url to the hosted metadata json file.

Last thing to note from this helper file is some exported interfaces. These will clean up our functions as we make them.
```ts
export interface CreateNFTInputs {
  payer: Keypair;
  connection: Connection;
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
  tokenAdditionalMetadata: Record<string, string>;
}

export interface UploadOffChainMetadataInputs {
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenExternalUrl: string;
  tokenAdditionalMetadata: Record<string, string>;
  imagePath: string;
}
```

**`index.ts`** is where we'll add our code. Right now, the code sets up a `connection` and initializes a keypair for us to use. 

The keypair `payer` will be responsible for every payment we need throughout the whole process. `payer` will also hold all the authorities, like the mint authority, mint freeze authority, etc. We can use a different keypair for the authorities, but for the sake of simplicity, we will stick with `payer`.

Lastly, we recommend to use your [own local validator](https://docs.solanalabs.com/cli/examples/test-validator). If you do, be sure to change the Connection constructor to something like this:
```ts
  const connection = new Connection('http://127.0.0.1:8899', 'finalized');
```

Now, run the code to see that everything has been set up properly. 

```bash
npm run start
```

You should get the following output:

```bash
> Finished successfully
```

If the air dropping fails, consider running a local validator.

## 0.5 Setup NFT.Storage

Before we can make our NFT we need a place to store the image and metadata json file. We'll do this with [NFT.Storage](https://nft.storage/), which requires a little setup.

1. Create a free account at [NFT.Storage](https://nft.storage/)
2. Create a new API Key
3. Paste in the API key in `.env.example`

```env
NFT_STORAGE_API_KEY=YOUR_KEY_HERE
```

4. Copy `.env.example` to `.env`

```bash
cp .env .env.example
```

This enables our `uploadOffChainMetadata` in `helpers.ts` to upload Metadata to NFT.Storage.

## 1. Uploading the off-chain metadata

In this section we will decide on our NFT metadata and upload our files to NFT.Storage using our helper functions provided in the starting code.

In order to upload our off-chain metadata, we need to first prepare an image that will represent our NFT. We've provided `cat.jpg`, but feel free to replace it with your own. Most image types are supported by most wallets.

Now let's decide on what metadata our NFT will have. The fields we are deciding on are `name`, `description`, `symbol`, `externalUrl`, and some `attributes` (additional metadata). We'll provide some cat adjacent metadata, but feel free to make up your own.

- `name`: Cat NFT
- `description` = This is a cat
- `symbol` = EMB
- `externalUrl` = https://solana.com/
- `attributes` = { species: 'Cat' breed: 'Cool' }

Lastly we just need to format all of this data and send it to our helper function `uploadOffChainMetadata` to get out uploaded metadata uri.

When we put all of this together, our `index.ts` file will look as follows:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair } from '@solana-developers/helpers';
import { uploadOffChainMetadata } from './helpers';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);

  const imagePath = 'src/cat.jpg';
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
    tokenExternalUrl,
    tokenAdditionalMetadata,
  });

  // You can log the URI here and run the code to test it
  console.log('Token URI:', tokenUri);
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

Now run and test your code you should see the URI after the uploading is done. If you visit it, you should see a JSON that holds all of our off-chain metadata.

```bash
npm run start
```

## 2. Create NFT function 

Creating an NFT involves a few instructions. As a best practice when writing scripts that engage with the Solana network, it is best to consolidate all of these instructions in one transaction due to the atomic nature of transactions. This ensures either the successful execution of all instructions or a complete rollback in case of errors. That being said, we're going to make a new function `createNFTWithEmbeddedMetadata` in a new file called `src/nft-with-embedded-metadata.ts`. 

This function will create an NFT by doing the following:

1. Create the metadata object.
2. Allocate the mint.
3. Initialize the metadata-pointer making sure that it points to the mint itself.
4. Initialize the mint.
5. Initialize the metadata inside the mint (that will set name, symbol, and uri for the mint).
6. Set the additional metadata in the mint
7. Create the associated token account and mint the NFT to it and remove the mint authority.
8. Put all of that in one transaction and send it to the network.
9. fetch and print the token account, the mint account, an the metadata to make sure that it is working correctly.

This new function will take `CreateNFTInputs` defined in out `helpers.ts` file.

As a first step, let's create a new file `src/nft-with-embedded-metadata.ts` and paste the following:

```typescript
import { Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { CreateNFTInputs } from "./helpers";
import { createInitializeInstruction, createUpdateFieldInstruction, pack, TokenMetadata } from "@solana/spl-token-metadata";
import { AuthorityType, createAssociatedTokenAccountInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, createMintToCheckedInstruction, createSetAuthorityInstruction, ExtensionType, getAccount, getAssociatedTokenAddress, getMint, getMintLen, getTokenMetadata, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TYPE_SIZE } from "@solana/spl-token";

export default async function createNFTWithEmbeddedMetadata(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri, tokenAdditionalMetadata } = inputs;

  // 0. Setup Mint
  // 1. Create the metadata object.
  // 2. Allocate the mint.
  // 3. Initialize the metadata-pointer making sure that it points to the mint itself.
  // 4. Initialize the mint.
  // 5. Initialize the metadata inside the mint (that will set name, symbol, and uri for the mint).
  // 6. Set the additional metadata in the mint
  // 7. Create the associated token account and mint the NFT to it and remove the mint authority.
  // 8. Put all of that in one transaction and send it to the network.
  // 9. fetch and print the token account, the mint account, an the metadata to make sure that it is working correctly.
}
```

Now let's fill in the gaps one by one.

For step 0, let's create the mint's keypair, make sure our decimals for our NFT to 0, and the supply is 1.

```typescript
  // 0. Setup Mint
  const mint = Keypair.generate();
  const decimals = 0; // NFT should have 0 decimals
  const supply = 1; // NFTs should have a supply of 1
```

Now let's construct our `TokenMetadata` object interfaced from `@solana/spl-token-metadata`, and pass it all of our inputs. Note we have to do some conversion of our `tokenAdditionalMetadata` to match.

```typescript
  // 1. Create the metadata object
  const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: tokenName,
      symbol: tokenSymbol,
      uri: tokenUri,
      // additionalMetadata: [['customField', 'customValue']],
      additionalMetadata: Object.entries(tokenAdditionalMetadata).map(([key, value]) => [key, value]),
  };
```

Now let's create our first on-chain instruction using `SystemProgram.createAccount`. To do this we need to know the size of our NFT's mint account. Remember we're using two extensions for our NFT, `metadata pointer` and the `metadata` extensions. Additionally, since the metadata is 'embedded' using the metadata extension, it's variable length. So we use a combination of `getMintLen`, `pack` and some hardcoded amounts to get our final length. 

Then we call `getMinimumBalanceForRentExemption` to see how many lamports it costs to spin up the account.

Finally we put everything into the `SystemProgram.createAccount` function to get our first instruction:

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

Note: the more information in the metadata, the more it costs.

Step 3 has us initializing the `metadata pointer` extension. Let's do that by calling the `createInitializeMetadataPointerInstruction` function with the metadata account point to our mint.

```typescript
// 3. Initialize the metadata-pointer making sure that it points to the mint itself 
const initMetadataPointerInstruction = createInitializeMetadataPointerInstruction(
  mint.publicKey,
  payer.publicKey,
  mint.publicKey, // Metadata account - points to itself
  TOKEN_2022_PROGRAM_ID,
);
```

Next is the `createInitializeMintInstruction`. Note that we do this before we initialize the metadata.

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

Now we can initialize our metadata with the `createInitializeInstruction`. We pass in all of our NFT metadata except for our `tokenAdditionalMetadata`, this is covered in our next step.

```typescript
// 5. Initialize the metadata inside the mint
const initMetadataInstructions = createInitializeInstruction({
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
In our NFT, we have `tokenAdditionalMetadata`, and as we saw in the previous step this cannot be set using the `createInitializeInstruction`. So we have to make an instruction to set each new additional field. We do this by calling `createUpdateFieldInstruction` for each of our entries in `tokenAdditionalMetadata`.

```typescript
// 6. Set the additional metadata in the mint
const setExtraMetadataInstructions = [];
for (const attributes of Object.entries(tokenAdditionalMetadata)) {
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

Now let's mint this NFT to ourselves, and then revoke the mint authority. This will make it a true NFT where there will ever only be one. We accomplish this with the following functions:

- `createAssociatedTokenAccountInstruction`
- `createMintToCheckedInstruction`
- `createSetAuthorityInstruction`

```typescript
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
```

Now, let's bundle all of our transactions together and send it out to Solana. It is very important to note that order matters here.

```typescript
// 8. Put all of that in one transaction and send it to the network.
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

Lastly, let's fetch and print out all of the information about our NFT so we know everything worked.

```typescript
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

// And we can even get the off-chain json now
if (onChainMetadata && onChainMetadata.uri) {
    const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
    console.log('Mint off-chain metadata =====>', offChainMetadata);
}
```


Putting it all together you get the following in `src/nft-with-embedded-metadata.ts`:

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
      additionalMetadata: Object.entries(tokenAdditionalMetadata).map(([key, value]) => [key, value]),
  };

  // 2. Allocate the mint
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length + 500;
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
  for (const attributes of Object.entries(tokenAdditionalMetadata)) {
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
      ...setExtraMetadataInstructions,
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

  // And we can even get the off-chain json now
  if (onChainMetadata && onChainMetadata.uri) {
      const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
      console.log('Mint off-chain metadata =====>', offChainMetadata);
  }
}
```

## 3. Call Create NFT Function

We have everything we need, let's put everything together in `src/index.ts`. 

Go back to `src/index.ts`, and import the function `createNFTWithEmbeddedMetadata` from the file we just created.

```ts
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';
```

Then call it at the end of the main function and pass the required parameters. Your `src/index.ts` file should look like this:

```ts
await createNFTWithEmbeddedMetadata({
  payer,
  connection,
  tokenName,
  tokenSymbol,
  tokenUri,
});
```

`src/index.ts` file should look like this
```ts 
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);

  const imagePath = 'NFT.png';
  const tokenName = 'NFT Name';
  const tokenDescription = 'This is a cool Token Extension NFT';
  const tokenSymbol = 'TTT';

  const tokenUri = await uploadOffChainMetadata({
    connection,
    payer,
    tokenName,
    tokenDescription,
    tokenSymbol,
    imagePath,
  });

  // You can log the URI here and run the code to test it
  console.log('Token URI:', tokenUri);

  await createNFTWithEmbeddedMetadata({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

Run the program one more time to see your NFT and metadata. 

```bash
npm run start
```

You did it! You've made an NFT using the `metadata` and `metadata pointer` extensions.

If you run into any problems, check out the [solution](https://github.com/Unboxed-Software/solana-lab-token22-metadata/tree/solution).

# Challenge
Taking what you've learned here, go and create your own NFT or SFT.
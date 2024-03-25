---
title: Metadata and metadata pointer extension
objectives:
- Explain how the metadata pointers and metadata extensions work on Token Extension Program Mints
- Create an NFT with the metadata pointer extension
- Create an NFT with metadata embedded in the mint account itself
---

# Summary
- The `metadata pointer` extension associates a direct publickey pointer to the metadata account, be that internal (embedded) or external (Metaplex)
- The `metadata` mint extensions allows you to embed metadata right on mint accounts created in the Token Extension Program. This is generally used with a self-pointing `metadata pointer` extension.

# Overview

The Token Extension Program streamlines metadata on Solana. Without the Token Extension Program, developers store metadata in metadata accounts using a metadata on-chain program; mainly `Metaplex`. However, this has some drawbacks. For example the mint account to which the metadata is "attached" has no awareness of the metadata account. To determine if an account has metadata, we have to PDA the mint and the `Metaplex` program together and query the network to see if a Metadata account exists. Additionally, to create and update this metadata you have to use a secondary program (i.e. `Metaplex`). These processes require users to use venders and increase complexity. Token Extension Programs's Metadata extensions fix this by introducing two extensions:

- `metadata-pointer` extension: Adds two simple fields in the mint account itself: a publicKey pointer to the account that holds the metadata for the token following the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface), and the authority to update this pointer.
- `metadata` extension: Adds the fields described in the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/) which allows us to store the metadata in the mint itself.

Note: The `metadata` extention is usually used in conjuction with the `metadata-pointer` extension which points back to the mint itself.

## Metadata-Pointer extension:

Since multiple metadata programs exist, a mint can have numerous accounts claiming to describe the mint, making it complicated to know which one is the mint's "official" metadata. To resolve this, the `metadata-pointer` extension adds a `publicKey` field to the mint account called `metadataAddress`, which points to the account that holds the metadata for this token. To avoid phony mints claiming to be stablecoins, a client can now check whether the mint and the metadata point to each other.

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
  - `field`: the field that we want to update, this is either one of the built in `Field`s or a custom feild stored in the `additional_metadata`
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

The function `createRemoveKeyInstruction` returns and instrcution that removes a `additional_metadata` field from a token-metadata account.

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

The function `pack` packs the metadata into a byte array, and conversely the function `unpack` unpacks the metadata from a byte aray. This is primarily used to get the size of the metadata in bytes, which is needed to allocate enough space for it.

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
  - `connection`: Ccnnection to use
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
4. the `LENGTH_SIZE` and `TYPE_SIZE` constants from the `@solana/spl-token` library - these are sizes associated with mint extensions that are usually added with the call `getMintLen`, but since the metadata extension is vaiable length, they need to be added manually.
5. the metadata pointer data (this will be the mint's address and is done for consistency)

Note: There is no need to allocate more space than what is neccesary. The `createUpdateFieldInstruction` will automatically reallocate space and charge the payer accordingly to accomidate new data!
  
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

Now it is time to practice what we have learned so far. In this lab, we will create a script that will illustrate how to create an NFT with `metadata-pointer-extension` pointing to a metadata account somewhere else, and we will also create an NFT with metadata embedded in the mint account itself using the `metadata-extension`

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

- `helpers.ts`
- `index.ts`

The helper file provides us with a nice helper function `uploadOffChainMetadata`.

`uploadOffChainMetadata` is a helper to store the off-chain metadata on Arweave using Bundlr. In this lab we're more focused on the Token Extension Program interaction, so this uploader function is provided. It is good to note that while an NFT or any off-chain metadata can be stored anywhere with any provider, we use metaplex here for simplicity. At the end of the day, all you need is a url to the hosted metadata json file.

Last thing to note from this helper file is some exported interfaces. Although metadata can contain more information, we'll only be using the following:
```ts
export interface CreateNFTInputs {
  payer: Keypair;
  connection: Connection;
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
}

export interface UploadOffChainMetadataInputs {
  connection: Connection;
  payer: Keypair;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  imagePath: string;
}
```


Now let's look at `index.ts`. This is where we will add our code. Right now, the code sets up a `connection` and initializes a keypair for us to use. 

This keypair `payer` will be responsible for every payment we need throughout the whole process. 'payer' will also hold all the authorities, like the mint authority, mint freeze authority, etc. We can use a different keypair for the authorities other than the payer keypair, but for the sake of simplicity, we will stick to the same one.

Remember that you can use your own keypair path if you choose by providing your keypair's path in `initializeKeypair`. 

If you'd like to use your own local validator, be sure to change the Connection constructor to something like this:
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

## 1. Uploading the off-chain metadata

Storing data on-chain is expensive. Because of this, developers tend to store their fat NFT metadata (such as images, description, ...etc) on an off-chain storage provider. Where this data is stored does not matter; any storage provider will do (AWS, IPFS, Arweave, etc...). All that matters is that you have a URI pointing to the fat metadata json file that you can store on-chain. How we store that URI is the focus of today's lesson.

In order to upload our off-chain metadata, we need to first prepare an image that will represent our NFT. Add any `.png` image you want inside the `src` folder and call it `NFT.png`

To upload the off-chain metadata, we need to import the helper function `uploadOffChainMetadata` from `src/helper.ts`. So, the imports section will look like this:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair } from '@solana-developers/helpers';
import { uploadOffChainMetadata } from './helpers';
```

Now, we can add some variables that will represent the NFT properties like name, symbol, and image:

```ts
const imagePath = 'NFT.png';
const tokenName = 'NFT Name';
const tokenDescription = 'This is a cool Token Extension NFT';
const tokenSymbol = 'TTT';
```

Now, we just have to call the function `uploadOffChainMetadata` after importing it from `src/helpers.ts` and pass it all the parameters and let it handle the rest:

```ts
const tokenUri = await uploadOffChainMetadata({
  connection,
  payer,
  tokenName,
  tokenDescription,
  tokenSymbol,
  imagePath,
});
```

As a recap, our `src/index.ts` should look like this:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair } from '@solana-developers/helpers';
import { uploadOffChainMetadata } from './helpers';

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

## 2. Create NFT with metadata-pointer

As a best practice when writing scripts that engage with the Solana network, it is best to consolidate all of our instructions in one transaction due to the atomic nature of transactions. This ensures either the successful execution of all instructions or a complete rollback in case of errors. This approach promotes data consistency, improves efficiency by reducing latency and optimizing block space, and enhances code readability. Additionally, it minimizes inter-transaction dependencies, making it easier to track and manage the flow of operations, therefore in the code, we will write a few methods that will guide the way, and each one will return one or more instructions. The outline of this process is as follows:

1. Create a mint with the metadata pointer extension - we'll first create a helper function that returns the instructions needed to create a mint with a pointer to a separate metadata account. We'll call this function `getCreateMintWithMetadataPointerInstructions`.
2. Create the metadata account - we'll then create a helper function that returns the instructions needed to create the metadata account on Metaplex and store the metadata in it. We'll call this function `getCreateMetadataAccountOnMetaplexInstructions`.
3. Create a wrapper function that will call the two functions above and then mint the NFT, we will call this function `createNFTWithMetadataPointer`, and it will:
   1. Call `getCreateMintWithMetadataPointerInstructions` and `getCreateMetadataAccountOnMetaplexInstructions` to get the instructions needed to create the mint and the metadata account.
   2. Create the associated token account.
   3. Mint the NFT into the associated token account.
   4. Set the authority to an account. It will be used to remove the mint authority, because for the token to be considered as NFT in the Solana network, it has to have a supply of 1 and no one should be able to mint any more tokens, so the mint authority should be `None`.
   5. Put all of that in one transaction and send it to the network - we'll then put all of that in one transaction and send it to the network.
   6. fetch and print the mint account and the token account to make sure that it is working correctly.
4. Call the `createNFTWithMetadataPointer` method in the `main` method and run the code to test it.


### Create a mint with the metadata pointer extension

Create a new file `nft-with-metadata-pointer.ts`.

We are going to create a mint that has a pointer to a Metaplex metadata account. We haven't created the metadata account yet, but since it will be a PDA we can derive its address from the following seeds:

1. **metadata**: Buffer of the string: 'metadata'.
2. **Metaplex Program ID**: The public key representing the Metaplex program on Solana.
3. **Mint's Public Key**: The public key of the mint associated with the NFT or token.

Let's add our first code snippets to the file:

```ts
import * as web3 from '@solana/web3.js';

function getMetadataAccountAddressOnMetaplex(mintPublicKey: web3.PublicKey) {
  const METAPLEX_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // Metaplex derives the metadata account address (PDA) using the following three seeds
  const seed1 = Buffer.from('metadata');
  const seed2 = METAPLEX_PROGRAM_ID.toBuffer();
  const seed3 = mintPublicKey.toBuffer();
  const [metadataPDA, _bump] = web3.PublicKey.findProgramAddressSync([seed1, seed2, seed3], METAPLEX_PROGRAM_ID);
  return metadataPDA;
}
```

Next, let's create an interface that represents the inputs we'll need to work with. We'll call it `CreateMintWithMetadataPointerInstructionsInputs`:

```ts
interface CreateMintWithMetadataPointerInstructionsInputs {
  mint: web3.Keypair; // The mint account that will be created.
  payer: web3.Keypair; // The account that will pay for the creation of the mint.
  connection: web3.Connection; // The Solana blockchain connection.
  decimals: number; // The number of decimals in the token account amounts.
}
```

Now we can write our primary function `getCreateMintWithMetadataPointerInstructions`. Our function will do five things:
1. Derive the metadata account address
2. Build an instruction for allocating a new account
3. Build an instruction for initializing the new account for the metadata pointer extension
4. Build an instruction initializing the new account as a token mint
5. Return an array of the above instructions in the proper order

```ts
import * as web3 from '@solana/web3.js';
import {
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';

// other code...

async function getCreateMintWithMetadataPointerInstructions(
  inputs: CreateMintWithMetadataPointerInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, connection, decimals } = inputs;
  // 1. Derive the metadata account address
  const metadataPDA = getMetadataAccountAddressOnMetaplex(mint.publicKey);

  // 2. Create a new account
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // 3. Initialize the account to use the metadata pointer instruction
  // We will point to the Metaplex metadata account but note it doesn't exist yet
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    null,
    metadataPDA,
    TOKEN_2022_PROGRAM_ID,
  );

  // 4. Initialize the account as a token mint
  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  // 5. Return the instructions in the appropriate order
  return [
    // The order here matters
    createMintAccountInstructions, // First, we need to allocate the account and pay the rent fee.
    initMetadataPointerInstructions, // Second, we need to initialize the pointer. If you initialize the mint before the pointer, it will return an error.
    initMintInstructions, // Now we can go ahead and initialize the mint.
  ];
}
```

### Create metadata account

## TODO Is this still in the nft-with-metadata-pointer file?

This method creates the account that will hold the metadata using the `Metaplex` metadata program, it will interact with the `Metaplex` SDK to do so.

Let's create an interface that represents the inputs we'll need to work with. We'll call it `CreateMetadataAccountOnMetaplexInstructionsInputs`:

```ts
interface CreateMetadataAccountOnMetaplexInstructionsInputs {
  payer: web3.Keypair; // The account that will pay for the creation of the metadata account.
  mint: web3.Keypair; // The mint account associated with the NFT.
  umi: Umi; // The Umi instance for interacting with the Metaplex platform.
  tokenName: string; // The name of the NFT.
  tokenSymbol: string; // The symbol of the NFT. 
  tokenUri: string; // The URI of the off-chain metadata.
}
```

And up for the primary function `getCreateMetadataAccountOnMetaplexInstructions`. Our function will do the following:
1. Create a signer from the payer keypair, We can't simply use the keypair from `solana/web3js`. We first need to convert it into a format compatible with Metaplex, then we will instruct `umi` to use this signer as a transaction signer. This allows it to pay the rent for the metadata account we are about to create.
2. Preparing the on-chain data
3. List of all the accounts that are necessary for the metadata account creation process:
4. Use the Metaplex SDK to build the transaction instructions
5. Convert the Metaplex instructions to the Solana web3.js format and return them

```ts
import * as web3 from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  Collection,
  CollectionDetails,
  Creator,
  PrintSupply,
  TokenStandard,
  Uses,
  createV1,
  CreateV1InstructionAccounts,
  CreateV1InstructionData,
} from '@metaplex-foundation/mpl-token-metadata';
import { createSignerFromKeypair, none, percentAmount, PublicKey, signerIdentity, Umi } from '@metaplex-foundation/umi';

// other imports...
// other code...

async function getCreateMetadataAccountOnMetaplexInstructions(
  inputs: CreateMetadataAccountOnMetaplexInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, umi, tokenName, tokenSymbol, tokenUri } = inputs;

  // 1. Create a signer from the payer keypair, and instruct `umi` to use this signer as a transaction signer.
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(signer, true));

  // 2. Preparing the on-chain data
  const onChainData = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    sellerFeeBasisPoints: percentAmount(0, 2),
    creators: none<Creator[]>(),
    collection: none<Collection>(),
    uses: none<Uses>(),
  };

  // 3. List of all the accounts that are necessary for the metadata account creation process
  const accounts: CreateV1InstructionAccounts = {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)),
    splTokenProgram: fromWeb3JsPublicKey(TOKEN_2022_PROGRAM_ID),
    payer: signer,
    authority: signer,
    updateAuthority: signer,
  };

  const data: CreateV1InstructionData = {
    ...onChainData,
    isMutable: true,
    discriminator: 0,
    tokenStandard: TokenStandard.Fungible,
    collectionDetails: none<CollectionDetails>(),
    ruleSet: none<PublicKey>(),
    createV1Discriminator: 0,
    primarySaleHappened: true,
    decimals: none<number>(),
    printSupply: none<PrintSupply>(),
  };

  // 4. Use the Metaplex SDK to build the transaction instructions
  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    // 5. Convert the Metaplex instructions to the Solana web3.js format and return them
    // Using the Metaplex SDK, we build transaction instructions so we can commit them later to the network.
    // Metaplex uses a different structure for the instructions, which is not compatible with the Solana web3 SDK.
    // We need to change that to make it compatible with the Solana web3 SDK.
    // To do so, we use the helper `toWeb3JsInstruction` from '@metaplex-foundation/umi-web3js-adapters'.
    .map((ix) => toWeb3JsInstruction(ix));
}
```

### Mint the NFT

This is the last piece of code for this file, are you excited?

## TODO What function are we talking about here? What file should I be in?
This function will do the following:
1. Create a new UMI instance, and we are passing the devnet endpoint to it, we need it to be able to interact with the Metaplex platform.
2. Call `getCreateMintWithMetadataPointerInstructions` and `getCreateMetadataAccountOnMetaplexInstructions` to get the instructions needed to create the mint and the metadata account.
3. Create the associated token account.
4. Mint the NFT into the associated token account.
5. Set the authority to an account. It will be used to remove the mint authority, because for the token to be considered as NFT in the Solana network, it has to have a supply of 1 and no one should be able to mint any more tokens, so the mint authority should be `None`.
6. Put all of that in one transaction and send it to the network - we'll then put all of that in one transaction and send it to the network.
7. fetch and print the mint account and the token account to make sure that it is working correctly.

here is the code for this function:

```ts
import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMetadataPointerState,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import { fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { CreateNFTInputs } from './helpers';
// other imports...

// other code...

export default async function createNFTWithMetadataPointer(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;
  // 1. Create a new UMI instance
  const umi = createUmi('https://api.devnet.solana.com');

  const mint = web3.Keypair.generate();

  // NFT should have 0 decimals
  const decimals = 0;
  // 2. Call `getCreateMintWithMetadataPointerInstructions` and `getCreateMetadataAccountOnMetaplexInstructions` to get the instructions needed to create the mint and the metadata account.
  const createMintInstructions = await getCreateMintWithMetadataPointerInstructions({
    payer,
    mint,
    connection,
    decimals,
  });

  const metadataInstructions = await getCreateMetadataAccountOnMetaplexInstructions({
    payer,
    mint,
    umi,
    tokenName,
    tokenSymbol,
    tokenUri,
  });

  // 3. Create the associated token account.
  // we will need this to mint our NFT to it
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  // 4. Mint the NFT into the associated token account.
  const mintInstructions = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // 5. Set the authority to an account. It will be used to remove the mint authority
  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const removeMintAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
  // 6. Put all of that in one transaction and send it to the network
  const transaction = new web3.Transaction().add(
    ...createMintInstructions,
    ...metadataInstructions,
    createATAInstructions,
    mintInstructions,
    removeMintAuthorityInstructions,
  );
  const sig = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);

  console.log(`Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // 7. fetch and print the token account, the mint account, an the metadata to make sure that it is working correctly.
  // Feting the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Feting the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // But the mint will not have the metadata by it self, we need to first get the metadata pointer
  const metadataPointerState = getMetadataPointerState(mintDetails);
  console.log('Mint metadata-pointer details =====>', metadataPointerState);

  // Since our metadata are on Metaplex we will fetch the metadata using a helper method from metaplex SDK
  const metadata = await fetchMetadata(umi, fromWeb3JsPublicKey(metadataPointerState!.metadataAddress!));
  console.log('Mint metadata =====>', metadata);

  // And we can even get the off-chain json now
  const offChainMetadata = await fetch(metadata.uri).then((res) => res.json());
  console.log('Mint off-chain metadata =====>', offChainMetadata);
}
```

and that is it, we are done with the code for this file, as a recap let's see how the full file should look like after assembling all the code snippets together

```ts
// src/nft-with-metadata-pointer.ts

import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddress,
  getMetadataPointerState,
  getMint,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  Collection,
  CollectionDetails,
  createV1,
  CreateV1InstructionAccounts,
  CreateV1InstructionData,
  Creator,
  fetchMetadata,
  PrintSupply,
  TokenStandard,
  Uses,
} from '@metaplex-foundation/mpl-token-metadata';
import { createSignerFromKeypair, none, percentAmount, PublicKey, signerIdentity, Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { CreateNFTInputs } from './helpers';

function getMetadataAccountAddressOnMetaplex(mintPublicKey: web3.PublicKey) {
  const METAPLEX_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // Metaplex drives the metadata account address (PDA) by using the following three seeds
  const seed1 = Buffer.from('metadata');
  const seed2 = METAPLEX_PROGRAM_ID.toBuffer();
  const seed3 = mintPublicKey.toBuffer();
  const [metadataPDA, _bump] = web3.PublicKey.findProgramAddressSync([seed1, seed2, seed3], METAPLEX_PROGRAM_ID);
  return metadataPDA;
}

interface CreateMintWithMetadataPointerInstructionsInputs {
  mint: web3.Keypair;
  payer: web3.Keypair;
  connection: web3.Connection;
  decimals: number;
}

async function getCreateMintWithMetadataPointerInstructions(
  inputs: CreateMintWithMetadataPointerInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, connection, decimals } = inputs;

  const metadataPDA = getMetadataAccountAddressOnMetaplex(mint.publicKey);

  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // We will point to the Metaplex metadata account but note it doesn't exist yet
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    null,
    metadataPDA,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  return [
    // The order here matters
    createMintAccountInstructions, // First, we need to allocate the account and pay the rent fee.
    initMetadataPointerInstructions, // Second, we need to initialize the pointer. If you initialize the mint before the pointer, it will return an error.
    initMintInstructions, // Now we can go ahead and initialize the mint.
  ];
}

interface CreateMetadataAccountOnMetaplexInstructionsInputs {
  payer: web3.Keypair;
  mint: web3.Keypair;
  umi: Umi;
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
}

async function getCreateMetadataAccountOnMetaplexInstructions(
  inputs: CreateMetadataAccountOnMetaplexInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, umi, tokenName, tokenSymbol, tokenUri } = inputs;

  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(signer, true));

  const onChainData = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    sellerFeeBasisPoints: percentAmount(0, 2),
    creators: none<Creator[]>(),
    collection: none<Collection>(),
    uses: none<Uses>(),
  };

  const accounts: CreateV1InstructionAccounts = {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)),
    splTokenProgram: fromWeb3JsPublicKey(TOKEN_2022_PROGRAM_ID),
    payer: signer,
    authority: signer,
    updateAuthority: signer,
  };

  const data: CreateV1InstructionData = {
    ...onChainData,
    isMutable: true,
    discriminator: 0,
    tokenStandard: TokenStandard.Fungible,
    collectionDetails: none<CollectionDetails>(),
    ruleSet: none<PublicKey>(),
    createV1Discriminator: 0,
    primarySaleHappened: true,
    decimals: none<number>(),
    printSupply: none<PrintSupply>(),
  };

  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    .map((ix) => toWeb3JsInstruction(ix));
}

export default async function createNFTWithMetadataPointer(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;

  const umi = createUmi('https://api.devnet.solana.com');

  const mint = web3.Keypair.generate();

  // NFT should have 0 decimals
  const decimals = 0;

  const createMintInstructions = await getCreateMintWithMetadataPointerInstructions({
    payer,
    mint,
    connection,
    decimals,
  });

  const metadataInstructions = await getCreateMetadataAccountOnMetaplexInstructions({
    payer,
    mint,
    umi,
    tokenName,
    tokenSymbol,
    tokenUri,
  });


  // we will need this to mint our NFT to it
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );


  const mintInstructions = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );


  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const removeMintAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const transaction = new web3.Transaction().add(
    ...createMintInstructions,
    ...metadataInstructions,
    createATAInstructions,
    mintInstructions,
    removeMintAuthorityInstructions,
  );
  const sig = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);

  console.log(`Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`);


  // Feting the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Feting the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // But the mint will not have the metadata by it self, we need to first get the metadata pointer
  const metadataPointerState = getMetadataPointerState(mintDetails);
  console.log('Mint metadata-pointer details =====>', metadataPointerState);

  // Since our metadata are on Metaplex we will fetch the metadata using a helper method from metaplex SDK
  const metadata = await fetchMetadata(umi, fromWeb3JsPublicKey(metadataPointerState!.metadataAddress!));
  console.log('Mint metadata =====>', metadata);

  // And we can even get the off-chain json now
  const offChainMetadata = await fetch(metadata.uri).then((res) => res.json());
  console.log('Mint off-chain metadata =====>', offChainMetadata);
}
```

### Call your function from `main`

Go back to `src/index.ts`, first you will have to import the function `createNFTWithMetadataPointer` from the file we just created, so go ahead and do that 

```ts
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';
```

Now go to the end of the main function and call the function `createNFTWithMetadataPointer` and pass the required parameters, and you should have something like this
```ts
  await createNFTWithMetadataPointer({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });
```
As you know, all of these variables are already declared and ready to use from before, so after that you `srx/index.ts` file should look like this:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';

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

  await createNFTWithMetadataPointer({
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

### Run the `createNFTWithMetadataPointer` function

All you have to do now is run the following command:

```sh
npm start
```

Then, wait for the magic to happen. You will see the transaction signature in the console, and you can visit the explorer to view the transaction details. Additionally, you will be able to see the NFT, its associated token account, and the metadata. You can also view the off-chain metadata. If you observe all of that, congratulations! You have successfully created a new NFT with a metadata pointer, and you are ready to move on to the next step.

## 4. Create embedded metadata

Start by creating a file called `src/nft-with-embedded-metadata.ts`. This file will contain only one function which we will call `createNFTWithEmbeddedMetadata`, and it will take the same inputs as the  previous `createNFTWithMetadataPointer` function.

The outline of this function is as follows:

1. Create the metadata object.
2. Allocate the mint.
3. Initialize the metadata-pointer making sure that it points to the mint itself.
4. Initialize the mint.
5. Initialize the metadata inside the mint (that will set name, symbol, and uri for the mint).
6. Update the metadata inside the mint to add the additional metadata.
7. Create the associated token account and mint the NFT to it and remove the mint authority.
8. Put all of that in one transaction and send it to the network.
9. fetch and print the token account, the mint account, an the metadata to make sure that it is working correctly.

```ts
// src/nft-with-embedded-metadata.ts

import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  getMintLen,
  getTokenMetadata,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import { CreateNFTInputs } from './helpers';

export default async function createNFTWithEmbeddedMetadata(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;

  const mint = web3.Keypair.generate();

  // 1. Create the metadata object
  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    additionalMetadata: [['customField', 'customValue']],
  };
  const decimals = 0; // NFT should have 0 decimals

  // 2. Allocate the mint
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // 3. Initialize the metadata-pointer making sure that it points to the mint itself 
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  // 4. Initialize the mint
  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

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

  // 6. Update the metadata inside the mint to add the additional metadata
  const updateMetadataFieldInstructions = createUpdateFieldInstruction({
    metadata: mint.publicKey,
    updateAuthority: payer.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    field: metadata.additionalMetadata[0][0],
    value: metadata.additionalMetadata[0][1],
  });

  // 7. Create the associated token account and mint the NFT to it and remove the mint authority
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const mintIX = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const setMintTokenAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // 8. Put all of that in one transaction and send it to the network
  const transaction = new web3.Transaction().add(
    createMintAccountInstructions,
    initMetadataPointerInstructions,
    initMintInstructions,
    initMetadataInstructions,
    updateMetadataFieldInstructions,
    createATAInstructions,
    mintIX,
    setMintTokenAuthorityInstructions,
  );
  const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);
  console.log(`Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);

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

### Call you function from `main`

Now go back to `src/index.ts`, first you will have to import the function `createNFTWithEmbeddedMetadata` from the file we just created.
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

the `src/index.ts` file should look like this
```ts 
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';

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

  await createNFTWithMetadataPointer({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });

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

Run the prgoram one more time to see your NFTs with their metadata. 

```bash
npm run start
```

You did it! You've made NFTs that have pointers to their metadata accounts or house the metadata on the mint themselves. 

The `metadata-pointer` and `metadata` extensions streamline the retrieval and access to crucial information about the token. Prior to these extensions, accessing metadata often involved multiple transactions, introducing complexity and potential delays in token transactions. Now you can swiftly access the associated metadata, enabling seamless integration with dApps, marketplaces, and other token-related services.

# Challenge


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=4a628916-91f5-46a9-8eb0-6ba453aa6ca6)!
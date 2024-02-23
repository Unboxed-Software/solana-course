---
title: Metadata and metadata pointer extension
objectives:
- Be able to explain how the metadata pointers and metadata extensions work on Token22 Mints
- Create an NFT with the metadata pointer extension
- Create an NFT with metadata embedded in the mint account itself
- Be able to explain how the differences between the two approaches
---

# Summary
- Token22 offers the `metadata` mint extensions which allows you to embed metadata right on the Mint Account
- With the `metadata pointer` extension, Token22 mints now include a direct pointer to the Metadata account, be that internal (embedded) or external (Metaplex)

# Overview

Without Token22, developers store metadata in data accounts using a metadata on-chain program; mainly `Metaplex`. However, this has some drawbacks. For example the mint account to which the metadata is "attached" has no awareness of the metadata account. So to figure out if a particular account has metadata we have to PDA the mint and the `Metaplex` program together and query the network to see if a Metadata account exists. Additionally, to create and update this metadata you have to use a secondary program, ie `Metaplex` to accomplish this. Some problems here are vender lock-in and increasing complexity. Token22's Metadata extensions fix this by introducing these two extensions:

- `metadata-pointer` extension: Adds two simple fields in the mint account itself: a publicKey pointer to the account that holds the metadata for the token following the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface), and the authority to update this pointer.
- `metadata` extension: Adds the fields described in the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/) which allows us to store the metadata in the mint itself.

## Metadata-Pointer extension:

Since there are multiple metadata programs out there, a mint can have multiple different accounts all claiming to describe the mint. This makes it complicated to know which one is the "official" metadata for this mint. So to make that easier, Solana introduced the `metadata-pointer` extension. This extension adds a `publicKey` field called `metadataAddress` in the mint account itself. This `publicKey` points to the account that holds the metadata for this token. As you'll see in the "Metadata" section, this address can be the mint itself!

For example if we create a Metaplex Metadata account, that account's `publicKey` would be inserted into the `metadataAddress` field on the Mint account. so to avoid phony mints claiming to be stablecoins, now a client can check if the mint and the metadata both point to each other or not.

This introduces some new functions and a couple of additional fields that we need to keep in mind when interacting with token22's metadata extensions:

First the extension adds two new fields in the mint account:
- `metadataAddress`: Holds the metadata account address for this token; it can be pointing to the mint token itself, if you use the `metadata` extension we'll talk about in a bit.
- `authority`: in the mint account, which will hold the authority that can set the metadata address.

Second, the extension has given way for 3 helper functions:
- `createInitializeMetadataPointerInstruction`
- `createUpdateMetadataPointerInstruction`
- `getMetadataPointerState`

The function `createInitializeMetadataPointerInstruction` will return an instruction that will set the metadata address in the mint account.

This function takes 4 params as an input:
  - `mint`: the mint account that will be created.
  - `authority`: the authority that can set the metadata address
  - `metadataAddress`: the account address that holds the metadata
  - `programId`: the SPL Token program Id (in this case it will be the token22 program Id)

```ts
function createInitializeMetadataPointerInstruction(
    mint: PublicKey,
    authority: PublicKey | null,
    metadataAddress: PublicKey | null,
    programId: PublicKey
)
```

The function `createUpdateMetadataPointerInstruction` returns an instruction that will update the metadata address in the mint account. You can update the metadata pointer at any point if you hold the authority.

This function takes 5 params as an input:
  - mint: the mint account that will be created.
  - authority: the authority that can set the metadata address
  - Metadata Address: the account address that holds the metadata
  - Multi Signers: the multi signers that will sign the transaction
  - Program Id: the SPL Token program Id (in this case it will be the token22 program Id)
  
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

In order to create a mint with a metadata pointer, we will have to follow these steps:
1. Gather our needed accounts
2. Create the `mint` account
3. Optional: create the new `metadataAccount`
4. Initialize the pointer.
5. Initialize the mint.
 
To create a NFT with the `metadata-pointer` extension, we need two new accounts: the `mint` and the `metadataAccount`. 

The `mint` is usually just a new `Keypair` created by `Keypair.generate()`. The `metadataAccount` can be the `mint`'s `publicKey` if using the metadata mint extension or another metadata account like `Metaplex`.

The `mint` is only just a `Keypair` at this point, we need to save space for it on the blockchain. Since all accounts on the Solana blockchain owe rent proportional to the size of the account, we need to know how big the mint account is in bytes. We can do this using the `getMintLen` method from the `@solana/spl-token` library. Since we are using the `MetadataPointer` extension, the mint account will be larger. Specifically because we need to store two more fields in the account `metadataAddress` and `authority`.

```ts
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
```

To actually create and initialize the `mint` with the metadata pointer, we need several instructions in a particular order:

1. Create the `mint` account which reserves space on the blockchain with `web3.SystemProgram.createAccount`
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

The metadata extension is an exciting addition to the Token Program. This extension allows us to store the metadata directly in the mint itself! This eliminates the need for a separate account, greatly simplifying the handling of metadata. Not only does this make accessing metadata more connivent, it saves space and reduces network calls.

Make a note that the metadata extension should work directly with the metadata-pointer extension. During mint creation, you should also add the metadata-pointer extension, pointed at the mint itself. Check out the [Solana Token22 docs](https://spl.solana.com/token-2022/extensions#metadata)

The added fields and functions in the metadata extension follows the [Token-Metadata Interface](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface)


Now, when a mint has been initialized with the metadata extension, it will house these extra fields: 
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

we also have one more new functions, and two constants from the `@solana/spl-token` library:
- `getTokenMetadata`
- `LENGTH_SIZE`: a constant number of bytes of the length of the data
- `TYPE_SIZE`: a constant number of bytes of the type of the data


The function `createInitializeInstruction` initializes the metadata in the account and set the basic metadata fields (name, symbol, uri) and returns an instruction that will set the basic metadata fields in the mint account.

This function takes 8 params as an input:
  - `mint`: the mint account that will be initialize.
  - `metadata`: the metadata account that will be created.
  - `mintAuthority`: the authority that can mint tokens
  - `updateAuthority`: the authority that can sign to update the metadata
  - `name`: the longer name of the token
  - `symbol`: the shortened symbol for the token
  - `uri`: the URI pointing to richer metadata
  - `programId`: the SPL Token program Id (in this case it will be the token22 program Id)

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

The function `createUpdateFieldInstruction` updates a field in a token-metadata account. This may be an existing or totally new field and returns an instruction that will do so.

this function takes 5 params as an input:
  - `metadata`: the metadata account address.
  - `updateAuthority`: the authority that can sign to update the metadata
  - `field`: the field that we want to update
  - `value`: the new value of the field
  - `programId`: the SPL Token program Id (in this case it will be the token22 program Id)

```ts
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

The function `createRemoveKeyInstruction` removes a field from a token-metadata account and returns an instruction that will do so.

this function takes 5 params as an input:
  - `metadata`: the metadata account address.
  - `updateAuthority`: the authority that can sign to update the metadata
  - `field`: the field that we want to remove
  - `programId`: the SPL Token program Id (in this case it will be the token22 program Id)
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

The function `createUpdateAuthorityInstruction` updates the authority of a token-metadata account and returns an instruction that will do so.

this function takes 4 params as an input:
  - `metadata`: the metadata account address.
  - `oldAuthority`: the current authority that can sign to update the metadata
  - `newAuthority`: the new authority that can sign to update the metadata
  - `programId`: the SPL Token program Id (in this case it will be the token22 program Id)

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
// TODO: not sure what does this function do, I found it in the library but I couldn't find any documentation about it. the only documentation is [here](https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface), maybe we should just remove it.
The function `createEmitInstruction` emits token-metadata in the expected TokenMetadata state format. Although implementing a struct that uses the exact state is optional, this instruction is required.

this function takes 4 params as an input:
  - `metadata`: the metadata account address.
  - `programId`: the SPL Token program Id (in this case it will be the token22 program Id)
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

The function `pack` packs the metadata into a byte array

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
```

The function `unpack` unpacks the metadata from a byte array

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

export function unpack(buffer: Buffer | Uint8Array): TokenMetadata {
    ...
}
```

The function `getTokenMetadata` returns the metadata for the given mint

this function takes 4 params as an input:
  - `connection`: Connection to use
  - `address`: Mint account
  - `commitment`: Desired level of commitment for querying the state
  - `programId`: SPL Token program account

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

1. Gather our needed accounts
2. Find/decide on the needed size of our metadata
3. Create the `mint` account
4. Initialize the pointer.
5. Initialize the mint.
6. Initialize the metadata in the mint account
7. Add any additional custom fields if needed
 

First, the `mint` will be a Keypair, usually given from `Keypair.generate()`. Then we have to decide what metadata we want to include, and then calculate the total size and cost.

A mint account's needed size with the metadata and metadata-pointer extensions incorporate the following:

1. the basic metadata felids: name, symbol, and uri.
2. the additional custom fields we want to store as a metadata.
3. the update authority that can change the metadata in the future.
4. the `LENGTH_SIZE` and `TYPE_SIZE` which are constants coming from the `@solana/spl-token` library, the way solana stores the data in the account is by having some additional bytes at the beginning of the account to store the length of the data, and the type of the data, this will make it easier to parse the data in the future, so we will have to allocate enough space for those and pay for them, they are also very small, so not a big deal.
5. the metadata pointer data:
  - yes even though we are using the metadata extension, we still have to use the metadata pointer extension on the mint, but in this case the pointer will hold the mint address itself, this will ensure consistency, so we will have to store the metadata pointer data as well, which are:
    1. the metadata account address.
    2. the authority that can change the metadata pointer in the future.


To determine all of this programmatically we use the `getMintLen` and `pack` functions from the `@solana/spl-token` library:

```ts

const metadata: TokenMetadata = {
  mint: mint.publicKey,
  name: tokenName,
  symbol: tokenSymbol,
  uri: tokenUri,
  additionalMetadata: [['customField', 'customValue']],
};

const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
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
    space: mintLen,
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

Note that the `createUpdateFieldInstruction` updates only one field at a time, so if you want to have more than one custom field you will have to call this method multiple times. You can use the same method to update the basic metadata fields as well:

```ts
  const updateMetadataFieldInstructions = createUpdateFieldInstruction({
    metadata: mint.publicKey,
    updateAuthority: payer.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    field: 'name',
    value: 'new name,
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

- `index.ts`
- `helpers.ts`

The helper file provides us two functions that we will need for later: `initializeKeypair` and `uploadOffChainMetadata`.

First `initializeKeypair` is an established helper will return us a `Keypair` to use for our script and will airdrop some solana to it if needed. Note that you can also provide it a keypair path if you'd like to use your own keypair.json file. Another important thing to note is that devnet has limits on airdrops. If you run into issues, it's recommend to run the `solana-test-validator`.

Next the `uploadOffChainMetadata` is a helper to store the off-chain metadata on Arweave using Bundlr. In this lab we're more focused on the token22 interaction, so this uploader function is provided. It is good to note that an NFT or any off-chain metadata can be stored anywhere with any provider, we use metaplex here for simplicity. At the end of the day, all you need is a url to the hosted metadata json file.

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


Lastly, let's look at `index.ts`. This is where we will add our code. Right now it just sets up a `connection` and initializes a keypair for us to use. 

This keypair, which we called `payer`, will be responsible for every payment we need throughout the whole process. Also, this payer keypair will hold all the authorities, like the mint authority, mint freeze authority, etc. We can use a different keypair for the authorities other than the payer keypair, but for the sake of simplicity, we will stick to the same one.

Remember that you can use your own keypair path if you choose by providing your keypair's path in `initializeKeypair`.

If you'd like to use your own local validator, be sure to change the Connection constructor to something like this:
```ts
  const connection = new Connection('http://127.0.0.1:8899', 'finalized');
```

Now, run the code to see that everything has been set up properly. 

```bash
npm run start
```

You should get an output of

```bash
> Finished successfully
```

## 1. Uploading the off-chain metadata

Storing data on-chain is expensive. Because of this, developers tend to store their fat NFT metadata (such as images, description, ...etc) on an off-chain storage provider. Where this data is stored, does not matter, any storage provider will do (AWS, IPFS, Arweave, etc...). All that matters is that you have a URI pointing to the fat metadata json file that you can store on-chain. How we store that URI is the focus of today's lesson.

In order to upload our off-chain metadata, we need to first prepare an image that will represent our NFT. Add any `.png` image you want inside the `src` folder and call it `NFT.png`

To upload the off-chain metadata, we need to import the helper function `uploadOffChainMetadata` from `src/helper.ts`. So, the imports section will look like this:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
```

Now, we can add some variables that will represent the NFT properties like name, symbol, and image:

```ts
const imagePath = 'NFT.png';
const tokenName = 'NFT Name';
const tokenDescription = 'This is a cool Token22 NFT';
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
import { initializeKeypair, uploadOffChainMetadata } from './helpers';

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);

  const imagePath = 'NFT.png';
  const tokenName = 'NFT Name';
  const tokenDescription = 'This is a cool Token22 NFT';
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

Historically, developers stored metadata in data accounts using a metadata on-chain program; mainly `Metaplex`. However, this had some drawbacks. For example the mint account to which the metadata "attached" had no awareness of the metadata account. So to figure out if a particular account had metadata we'd have to PDA the mint and the `Metaplex` program together and see if a Metadata account existed. 

To solve this problem, Solana introduced an extension called `metadata-pointer` extension, which is simply a field in the mint account itself that points to the account that holds the metadata for this token. This will make it easier for client apps to find the respective metadata-account and retrieve the metadata.

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

We are going to create a mint that has a pointer to a Metaplex metadata account. We haven't created the account yet, but since it will be a PDA we can derive its address. The seeds used to derive a metadata account are:

1. **metadata**: Buffer of the string: 'metadata'.
2. **Metaplex Program ID**: The public key representing the Metaplex program on Solana.
3. **Mint's Public Key**: The public key of the mint associated with the NFT or token.

Let's create a short helper function for deriving the metadata account address:

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
// other imports...
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

This method will create the account that will hold the metadata using the Metaplex metadata program. We need to interact with some Metaplex-specific code here, here is the code for this function:

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

interface CreateMetadataAccountOnMetaplexInstructionsInputs {
  payer: web3.Keypair; // The account that will pay for the creation of the metadata account.
  mint: web3.Keypair; // The mint account associated with the NFT.
  umi: Umi; // The Umi instance for interacting with the Metaplex platform.
  tokenName: string; // The name of the NFT.
  tokenSymbol: string; // The symbol of the NFT. 
  tokenUri: string; // The URI of the off-chain metadata.
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

  // Using the Metaplex SDK, we build transaction instructions so we can commit them later to the network.
  // Metaplex uses a different structure for the instructions, which is not compatible with the Solana web3 SDK.
  // We need to change that to make it compatible with the Solana web3 SDK.
  // To do so, we use the helper `toWeb3JsInstruction` from '@metaplex-foundation/umi-web3js-adapters'.
  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    .map((ix) => toWeb3JsInstruction(ix));
}
```

#### Imports explanation

We already discussed the first two above. Now let's focus on the rest:

**From `@metaplex-foundation/umi-web3js-adapters`:**
We use these adapters because Metaplex code uses a different format for some objects that are not compatible with the `solana/web3js` SDK, like signer, publicKey, and instructions. Therefore, we need to keep using adapters each time we need to use some information across the Solana SDK and Metaplex SDK.

- **`fromWeb3JsKeypair`:** Adapts Solana keypairs from `@solana/web3.js` for use with Metaplex libraries.
- **`fromWeb3JsPublicKey`:** Converts Solana public keys from `@solana/web3.js` format to Metaplex compatible format.
- **`toWeb3JsInstruction`:** Converts Metaplex instructions into formats usable with `@solana/web3.js` for transactions.

**From `@metaplex-foundation/mpl-token-metadata`:**

- **`Collection`, `CollectionDetails`, `Creator`, `PrintSupply`, `Uses`:** Classes for defining and structuring NFT metadata, such as creators, collections, and usage rights.
- **`TokenStandard`:** Specifies the token standard used (e.g., fungible, non-fungible, etc.).
- **`createV1`:** Creates a Metaplex NFT instructions to create the metadata account.
- **`CreateV1InstructionAccounts`, `CreateV1InstructionData`:** Interfaces used to provide types to make our life easier.

**From `@metaplex-foundation/umi`:**
UMI stands for Unified Market Infrastructure. It's a platform and set of tools developed by the Metaplex Foundation, aiming to simplify development and interaction with NFTs and tokenized assets on various blockchains, including Solana.

- **`createSignerFromKeypair`:** Creates a signer for transactions using a Solana keypair.
- **`none`, `percentAmount`:** Utility functions, for handling numeric values or optional data.
- **`PublicKey`:** Represents a Solana public key within the Metaplex context.
- **`signerIdentity`:** Retrieves a signer's identity from their keypair.
- **`Umi`:** Core class for interacting with the Metaplex platform and its services.

After setting that aside, we can finally start talking about the actual code.

#### Function logic explanation

- Creating a signer: We can't simply use the keypair from `solana/web3js`. We first need to convert it into a format compatible with Metaplex, then we will instruct `umi` to use this signer as a transaction signer. This allows it to pay the rent for the metadata account we are about to create.
```ts
const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
umi.use(signerIdentity(signer, true));
```

- Preparing the on-chain data:
  ```ts
  const onChainData = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    sellerFeeBasisPoints: percentAmount(0, 2), // The fee that the seller will get from the sale of the NFT.
    creators: none<Creator[]>(), // Optional: The creators of the NFT.
    collection: none<Collection>(), // Optional: The collection the NFT belongs to.
    uses: none<Uses>(), // Optional: The usage rights for the NFT.
  };
  ```

  These are essential details for the metadata.
  
- List of all the accounts that are necessary for the mint and metadata creation process:

  ```ts
  const accounts: CreateV1InstructionAccounts = {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)), // The mint account associated with the NFT.
    splTokenProgram: fromWeb3JsPublicKey(TOKEN_2022_PROGRAM_ID), // The program ID of the SPL Token program.
    payer: signer, // optional: The account that will pay for the creation of the metadata account.
    authority: signer, // optional: The authority for the metadata account.
    updateAuthority: signer, // optional: The authority that can update the metadata account.
  };
  ```

- lastly we are going to create the instructions that will create this metadata account, and then we will loop over them to convert them into a `solana/web3js` instruction format, and we will return that
```ts
  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    .map((ix) => toWeb3JsInstruction(ix));
}
```

### Mint the NFT

This is the last piece of code for this file, are you excited?

this function will do the following:
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

function getMetadataAccountAddressOnMetaplex(mint: web3.Keypair) {
  const METAPLEX_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // Metaplex drives the metadata account address (PDA) by using the following three seeds
  const seed1 = Buffer.from('metadata');
  const seed2 = METAPLEX_PROGRAM_ID.toBuffer();
  const seed3 = mint.publicKey.toBuffer();
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

interface CreateMetadataAccountOnMetaplexInstructionsInputs {
  payer: web3.Keypair;
  mint: web3.Keypair;
  umi: Umi;
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
}

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

### Call your function from `main`

go back to `src/index.ts`, first you will have to import the function `createNFTWithMetadataPointer` from the file we just created, so go ahead and do that 

```ts
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';
```

now go to the end of the main function and call the function `createNFTWithMetadataPointer` and pass the required params, and you should have something like this
```ts
  await createNFTWithMetadataPointer({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });
```
as you know, all of these variables are already declared  and ready to use from before, so after that you `srx/index.ts` file should look like this

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);

  const imagePath = 'NFT.png';
  const tokenName = 'NFT Name';
  const tokenDescription = 'This is a cool token22 NFT'
  const tokenSymbol = 'TTT';

  const tokenUri = await uploadOffChainMetadata({
    connection,
    payer,
    tokenName,
    tokenDescription,
    tokenSymbol,
    imagePath,
  });

  // you can log the URI here and run the code to test it
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
one of the coolest extensions that the token22 program introduces is the `metadata-extension`, and the motivation behind this is to make it much easier for us to create a token/NFT with metadata since we are going to store that metadata in the mint account itself, no need for third party apps! no need for another account! and as we go through the code you will see how much easier and more convenient it is to use this extension, so let's get started

### Create `createNFTWithEmbeddedMetadata` function:

Create new file `src/nft-with-embedded-metadata.ts`: this file will contain only one function which we will call `createNFTWithEmbeddedMetadata`, and it will take the same inputs as the previous function and the logic goes as follows:

- Create a new keypair for the mint
```ts
const mint = web3.Keypair.generate();
```
- Create the metadata object, and set the decimals to 0, because NFTs should have 0 decimals, the metadata extension let us set some basic defined metadata, such as name, symbol, and uri.
At the same time it gives us the flexibility to add custom metadata fields, so we can any metadata we want, to do so we will have to put them inside a nested array, where the outer array will contain sub arrays, each will have only two elements, the first one will be the field name, and the second one will be the field value.
```ts
const metadata: TokenMetadata = {
  mint: mint.publicKey,
  name: tokenName,
  symbol: tokenSymbol,
  uri: tokenUri,
  additionalMetadata: [['customField', 'customValue']],
};

// NFT should have 0 decimals
const decimals = 0;
```

- Calculate the mint length, metadata length, and the rent fee
```ts
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
```

- Create the mint with the metadata-pointer pointing to the mint itself.
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
  mint.publicKey,
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

- Create initialize metadata instruction, this instruction is going to resize the mint account and add the basic metadata to it, notice that it only sets the basic metadata.
```ts
const initMetadataInstructions = createInitializeInstruction({
  programId: TOKEN_2022_PROGRAM_ID,
  // metadata account address is the same as the mint address
  metadata: mint.publicKey, 
  mint: mint.publicKey,
  name: metadata.name,
  symbol: metadata.symbol,
  uri: metadata.uri,
  mintAuthority: payer.publicKey,
  updateAuthority: payer.publicKey,
});
```

- Create update field instruction, this instruction is going to add the additional metadata to the mint account, and since we are already have the metadata so we will treat it as we are updating the metadata and we can add any additional metadata we want
```ts
const updateMetadataFieldInstructions = createUpdateFieldInstruction({
  metadata: mint.publicKey, 
  updateAuthority: payer.publicKey, // who has the authority to update the metadata
  programId: TOKEN_2022_PROGRAM_ID,
  field: metadata.additionalMetadata[0][0],
  value: metadata.additionalMetadata[0][1],
});
```

- Create the associated token account, mint the NFT to it, and then remove the mint authority
```ts
// we will need this to mint our NFT to it
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
```

- Build the transaction, pass all the instruction to it, and send it to the network.

```ts
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
```

- Fetch and print the token account, the mint account, and the metadata to make sure that it is working correctly.

```ts
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

Now if we put all of that together the file should look like this: 

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

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    additionalMetadata: [['customField', 'customValue']],
  };

  // NFT should have 0 decimals
  const decimals = 0;

  // When we init the mint we need to count for all the metadata that will get stored in it so we pay the right amount of rent
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  // Solana Token22 program needs to store some extra information other than the metadata it self in the mint account
  // this data is the size of the type and the total length of the metadata
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // Even if we want to use the metadata-extension, we still need to use the metadata-pointer-extension but it will point to the mint it self
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    mint.publicKey,
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

  // we will need this to mint our NFT to it
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

  // Now we can fetch the account and the mint and look at the details
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

### Update `src/index.ts`:

Now go back to `src/index.ts`, first you will have to import the function `createNFTWithEmbeddedMetadata` from the file we just created, so go ahead and do that 
```ts
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';
```

and then call it at the end of the main function and pass the required params, and you should have something like this
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

  const payer = await initializeKeypair(connection, '~/.config/solana/id.json');

  const imagePath = 'cat.jpg';
  const tokenName = 'Cat NFT';
  const tokenDescription = 'This is a cat';
  const tokenSymbol = 'EMB';

  const tokenUri = await uploadOffChainMetadata({
    connection,
    payer,
    tokenName,
    tokenDescription,
    tokenSymbol,
    imagePath,
  });

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

## 5. Run the code for the last time 
```bash
npm run start
```

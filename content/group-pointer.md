---
title: Group Pointer
objectives:
 - Create a group mint pointing to itself
---

# Summary

 - **Group Pointer** allows us to designate a group account that describes the mint.
 - Unlike metadata, it describes the configurations for the group.
 - The pointer can point to a dedicated group account or the mint itself.

# Overview
In the Token Program, we used metadata to describe any token, be it a collection or a individual token. In the Token22 program, the group pointer extension allows us to designate a group account that describes the mint. But, this is not like our usual metadata description. The group account describes the configurations for grouping tokens together.

The Token22 mint possessing a group pointer is known as a group mint, just like a collection NFT. These group mints have configurations which allow them to be used as a point of reference for a related set of tokens. This extension is really useful when it comes to managing tokens which are closely related to each other. This extension allows us to set mint authority, update authority and max size of the group. Max size is the maximum number of members said group can have. These configurations give us more control over the token.

The group pointer extension can point to a separate token account or it can point to the mint itself. If the pointer is pointing to the mint itself, a client must check that the mint and the group both point to each other.

## Creating a mint with group pointer

Creating a mint with a group pointer involves four instructions:
 - `SystemProgram.createAccount`
 - `createInitializeGroupPointerInstruction`
 - `createInitializeMintInstruction`
 - `createInitializeGroupInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. However like all Token Extensions Program mints, we need to calculate the size and cost of the mint. This can be accomplished by using `getMintLen` and `getMinimumBalanceForRentExemption`. In this case, we'll call `getMintLen` with only the `ExtensionType.MintCloseAuthority`.

To get the mint length and create account instruction, do the following:

```ts
// get mint length
const extensions = [ExtensionType.MintCloseAuthority]
const mintLength = getMintLen(extensions)

const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLength)

const createAccountInstruction = SystemProgram.createAccount({
	fromPubkey: payer.publicKey,
	newAccountPubkey: mintKeypair.publicKey,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

The second instruction `createInitializeGroupPointerInstruction` initializes the group pointer. It takes the mint, optional authority that can set the group address, address that holds the group and the owning program as it's arguments.

```ts
const initializeGroupPointerInstruction = createInitializeGroupPointerInstruction(
	mintKeypair.publicKey,
	payer.publicKey,
	mintKeypair.publicKey,
	TOKEN_2022_PROGRAM_ID
)
```

The third instruction `createInitializeMintInstruction` initializes the mint.

```ts
const initializeMintInstruction = createInitializeMintInstruction(
	mintKeypair.publicKey,
	decimals,
	payer.publicKey,
	payer.publicKey,
	TOKEN_2022_PROGRAM_ID
)
```

The fourth instruction `createInitializeGroupInstruction` actually initializes the group and stores the configuration on the group account.

```ts
const initializeGroupInstruction = createInitializeGroupInstruction({
	group: mintKeypair.publicKey,
	maxSize: maxMembers,
	mint: mintKeypair.publicKey,
	mintAuthority: payer.publicKey,
	programId: TOKEN_2022_PROGRAM_ID,
	updateAuthority: payer.publicKey,
})		
```

Please remember that the `createInitializeGroupInstruction` assumes that the mint has already been initialized.

Finally, we add the instructions to the transaction and submit it to the Solana network.
```ts
const mintTransaction = new Transaction().add(
	createAccountInstruction,
	initializeGroupPointerInstruction,
	initializeMintInstruction,
	initializeGroupInstruction
)

const signature = await sendAndConfirmTransaction(
	connection,
	mintTransaction,
	[payer, mintKeypair],
	{commitment: 'finalized'}
)
```
When the transaction is sent, a new mint with a group pointer pointing to the specified group address will be created.

## Update group authority

To update the authority of a group, we just need the `tokenGroupUpdateGroupAuthority` function.

```ts
import {tokenGroupUpdateGroupAuthority} from "@solana/spl-token"

const signature = await tokenGroupUpdateGroupAuthority(
	connection, //connection - Connection to use
	payer, // payer - Payer for the transaction fees
	mint.publicKey, // mint - Group mint
	oldAuthority, // account - Public key of the old update authority
	newAuthority, // account - Public key of the new update authority
	undefined, // multiSigners - Signing accounts if `authority` is a multisig
	{commitment: 'finalized'}, // confirmOptions - Options for confirming thr transaction
	TOKEN_2022_PROGRAM_ID // programId - SPL Token program account
)
```

## Update max size of a group

To update the max size of a group we just need the `tokenGroupUpdateGroupMaxSize` function.

```ts
import {tokenGroupUpdateGroupMaxSize} from "@solana/spl-token"

const signature = tokenGroupUpdateGroupMaxSize(
	connection, //connection - Connection to use
	payer, // payer - Payer for the transaction fees
	mint.publicKey, // mint - Group mint
	updpateAuthority, // account - Update authority of the group
	4, // maxSize - new max size of the group
	undefined, // multiSigners — Signing accounts if `authority` is a multisig
	{commitment: "finalized"}, // confirmOptions - Options for confirming thr transaction
	TOKEN_2022_PROGRAM_ID // programId - SPL Token program account
)
```


# Lab
For this lab, we will be creating a Cool Cats NFT collection. We will create a mint with the group pointer and metadata pointer extensions. The group information will be stored on the mint itself.

### 1. Getting started
To get started, clone [this](https://github.com/Unboxed-Software/solana-lab-group-extension) repository's `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-group-extension.git
cd solana-lab-group-extension
git checkout starter
npm install
```

The `starter` code comes with:

 - `index.ts`: creates a connection object and calls `initializeKeypair`. This is where we will write our script.
 - `assets`:  folder which contains the cover image for our NFT collection.
 - `helper.ts`: helper functions for uploading metadata.

### 2. Create a mint with group pointer and metadata
We are now going to create the function `createGroup` in a new file `src/create-mint.ts`.

This new mint will be created with group pointer and metadata extension. The group pointer address will be the mint itself. It means, we will store the group related information on the mint account itself. The metadata extension will be used to store the metadata about our collection.

Since we are creating the mint with group and metadata pointer extensions, we need some additional instructions:
- `getMintLen`: Gets the space needed for the mint account
- `SystemProgram.getMinimumBalanceForRentExemption`: Tells us the cost of the rent for the mint account
 - `SystemProgram.createAccount`: Creates the instruction to allocates space on Solana for the mint account
 - `createInitializeGroupPointerInstruction`: Create the instruction to initialize the group pointer
 - `createInitializeMetadataPointerInstruction`: Create the instruction to initialize the metadata pointer
 - `createInitializeMintInstruction`: Creates the instruction to initialize the mint
 - `createInitializeGroupInstruction`: Creates the instruction to initialize the group
 - `createInitializeInstruction`: Creates the instruction to initialize the metadata
 - `sendAndConfirmTransaction`: Sends the transaction to the blockchain

We'll call all of these functions in turn. But before that let's define the inputs to our `createGroup` function:
 - `connection` : The connection object
 - `payer` : Payer for the transactions
 - `mintKeypair` : Keypair of the group mint
 - `decimals` : Mint decimals
 - `maxMembers` : Maximum number of groups members allowed
 - `metadata` : Metadata for the group mint

```ts
import {
	sendAndConfirmTransaction,
	Connection,
	Keypair,
	SystemProgram,
	Transaction,
	TransactionSignature,
} from '@solana/web3.js'

import {
	ExtensionType,
	createInitializeMintInstruction,
	getMintLen,
	TOKEN_2022_PROGRAM_ID,
	createInitializeGroupInstruction,
	createInitializeGroupPointerInstruction,
	TYPE_SIZE,
	LENGTH_SIZE,
	createInitializeMetadataPointerInstruction,
	TOKEN_GROUP_SIZE,
} from '@solana/spl-token'
import {
	TokenMetadata,
	createInitializeInstruction,
	pack,
} from '@solana/spl-token-metadata'

export async function createGroup(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	maxMembers: number,
	metadata: TokenMetadata
): Promise<TransactionSignature> {
	const extensions: any[] = [
		ExtensionType.GroupPointer,
		ExtensionType.MetadataPointer,
	]

	const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length
	const mintLength = getMintLen(extensions)
	const totalLen = mintLength + metadataLen + TOKEN_GROUP_SIZE

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(totalLen)

	console.log('Creating a transaction with group instruction... ')

	const mintTransaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: payer.publicKey,
			newAccountPubkey: mintKeypair.publicKey,
			space: mintLength,
			lamports: mintLamports,
			programId: TOKEN_2022_PROGRAM_ID,
		}),
		createInitializeGroupPointerInstruction(
			mintKeypair.publicKey,
			payer.publicKey,
			mintKeypair.publicKey,
			TOKEN_2022_PROGRAM_ID
		),
		createInitializeMetadataPointerInstruction(
			mintKeypair.publicKey,
			payer.publicKey,
			mintKeypair.publicKey,
			TOKEN_2022_PROGRAM_ID
		),
		createInitializeMintInstruction(
			mintKeypair.publicKey,
			decimals,
			payer.publicKey,
			payer.publicKey,
			TOKEN_2022_PROGRAM_ID
		),
		createInitializeGroupInstruction({
			group: mintKeypair.publicKey,
			maxSize: maxMembers,
			mint: mintKeypair.publicKey,
			mintAuthority: payer.publicKey,
			programId: TOKEN_2022_PROGRAM_ID,
			updateAuthority: payer.publicKey,
		}),
		createInitializeInstruction({
			metadata: mintKeypair.publicKey,
			mint: mintKeypair.publicKey,
			mintAuthority: payer.publicKey,
			name: metadata.name,
			programId: TOKEN_2022_PROGRAM_ID,
			symbol: metadata.symbol,
			updateAuthority: payer.publicKey,
			uri: metadata.uri,
		})
	)

	console.log('Sending create mint transaction...')
	let signature = await sendAndConfirmTransaction(
		connection,
		mintTransaction,
		[payer, mintKeypair],
		{commitment: 'finalized'}
	)

	return signature
} 
```
### 3. Define collection metadata
Now, we will define our collection metadata. The metadata object will contain typical information about the NFT such as token name, symbol, etc.

Paste the following metadata definition in `index.ts` under the right comment section:

```ts
// DEFINE GROUP METADATA
const collectionMintKeypair = Keypair.generate()

const collectionMetadata = {
	imagePath: 'collection.jpeg',
	tokenName: 'cool-cats-collection',
	tokenDescription: 'Collection of Cool Cat NFTs',
	tokenSymbol: 'MEOWs',
	tokenExternalUrl: 'https://solana.com/',
	tokenAdditionalMetadata: undefined,
	tokenUri: '',
	metadataFileName: 'collection.json',
}

collectionMetadata.tokenUri = await uploadOffChainMetadata(
	collectionMetadata,
	payer
)

const collectionTokenMetadata: TokenMetadata = {
	name: collectionMetadata.tokenName,
	mint: collectionMintKeypair.publicKey,
	symbol: collectionMetadata.tokenSymbol,
	uri: collectionMetadata.tokenUri,
	updateAuthority: payer.publicKey,
	additionalMetadata: Object.entries(
		collectionMetadata.tokenAdditionalMetadata || []
	).map(([trait_type, value]) => [trait_type, value]),
}
```

Replace the `'path-to-solana-keypair'` with the keypair path of the solana wallet installed on your machine. You can check the path of the keypair by running the command:

```bash
solana config get
```

The `uploadOffChainMetadata` function from `helpers.ts` will upload the cover image and the metadata json using the Irys SDK. It returns the token URI for the metadata JSON which will be stored on the mint account.

### 4. Create the mint
Now that we have uploaded the collection metadata, we can call the `createGroup` function in `index.ts` created in step 2.

First you'll need to import our new function. Then paste the following under the right comment section:

```ts
// CREATE GROUP MINT
const decimals = 0
const maxMembers = 3

const signature = await createGroup(
	connection,
	payer,
	collectionMintKeypair,
	decimals,
	maxMembers,
	collectionTokenMetadata
)

console.log(`Created collection mint with metadata. Signature: ${signature}`)
```

That's it! We have successfully created a mint with group pointer extension with the group information stored on the mint account itself. We will use this mint in the Member Pointer extension to create members of our NFT collection.
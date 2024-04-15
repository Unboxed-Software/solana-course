---
title: Group Pointer
objectives:
 - Create a group mint pointing to itself
---

# Lab
For this lab, we will be creating a Cool Cats NFT collection. We will create a mint with the group pointer extension. The group information will be stored on the mint itself.

### 1. Getting Started
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

When creating a mint with group pointer and metadata extension, we need six instructions: `SystemProgram.createAccount`, `createInitializeGroupPointerInstruction`, `createInitializeMetadataPointerInstruction`, `createInitializeMintInstruction`, `createInitializeGroupInstruction`, `createInitializeInstruction`.

Add the `createGroup` function with following arguments:
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

Add the following metadata definition in `index.ts`

```ts
import {initializeKeypair} from '@solana-developers/helpers'
import {Cluster, Connection, Keypair, , clusterApiUrl} from '@solana/web3.js'
import dotenv from 'dotenv'
import {createGroup} from './create-mint'
import {TokenMetadata} from '@solana/spl-token-metadata'
import {uploadOffChainMetadata} from './helpers'

dotenv.config()

const CLUSTER: Cluster = 'devnet'

/**
 * Create a connection and initialize a keypair if one doesn't already exists.
 * If a keypair exists, airdrop a sol if needed.
 */
const connection = new Connection(clusterApiUrl(CLUSTER))

const payer = await initializeKeypair(connection, {
	keypairPath: 'path-to-solana-keypair',
})

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
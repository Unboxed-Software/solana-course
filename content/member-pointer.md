---
title: Member Pointer
objectives:
 - Create NFT mints with member pointer
---

# Lab
For this lab, we will create three member mints which will be part of the group we created in the Group Pointer lesson.

### 1. Getting started
To get started, clone [this](https://github.com/Unboxed-Software/solana-lab-member-pointer.git) repository's `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-member-pointer.git
cd solana-lab-member-pointer
git checkout starter
npm install
```

The `starter` code comes with:

 - `index.ts`: creates a connection object and calls `initializeKeypair`. Also calls the `createGroup` function which creates our group mint. This is where we will write our script.
 - `create-group.ts` : contains the instructions for creating a group mint.
 - `assets`:  folder which contains the images for member mints.
 - `helper.ts`: helper functions for uploading metadata.

### 2. Create mints with member pointer and metadata
We are now going to create the function `createMember` in a new file `src/create-member.ts`.

These new mints will be created with member pointer and metadata extension. These member mints will be part of the group which is created by the `createGroup` function. The metadata extension will be used to store the metadata about the members.

When creating a mint with member pointer and metadata extension, we need six instructions: `SystemProgram.createAccount`, `createInitializeGroupMemberPointerInstruction`, `createInitializeMetadataPointerInstruction`, `createInitializeMintInstruction`, `createInitializeMemberInstruction`, `createInitializeInstruction`.

Add the `createGroup` function with following arguments:
 - `connection` : The connection object
 - `payer` : Payer for the transactions
 - `mintKeypair` : Keypair of the member mint
 - `decimals` : Mint decimals
 - `metadata` : Metadata for the group mint
 - `groupAddress` : Address of the group mint

```ts
import {
	sendAndConfirmTransaction,
	Connection,
	Keypair,
	SystemProgram,
	Transaction,
	TransactionSignature,
	PublicKey,
} from '@solana/web3.js'

import {
	ExtensionType,
	createInitializeMintInstruction,
	getMintLen,
	TOKEN_2022_PROGRAM_ID,
	TYPE_SIZE,
	LENGTH_SIZE,
	createInitializeMetadataPointerInstruction,
	TOKEN_GROUP_SIZE,
	createInitializeGroupMemberPointerInstruction,
	createInitializeMemberInstruction,
} from '@solana/spl-token'
import {
	TokenMetadata,
	createInitializeInstruction,
	pack,
} from '@solana/spl-token-metadata'

export async function createMember(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	metadata: TokenMetadata,
	groupAddress: PublicKey
): Promise<TransactionSignature> {
	const extensions: any[] = [
		ExtensionType.GroupMemberPointer,
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
		createInitializeGroupMemberPointerInstruction(
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
		createInitializeMemberInstruction({
			group: groupAddress,
			groupUpdateAuthority: payer.publicKey,
			member: mintKeypair.publicKey,
			memberMint: mintKeypair.publicKey,
			memberMintAuthority: payer.publicKey,
			programId: TOKEN_2022_PROGRAM_ID,
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

### 3. Define member metadata
Now, we will define our member mints metadata. The metadata object will contain typical information about the NFT such as token name, symbol, etc.

Add the following metadata definition in `index.ts`

```ts
import {initializeKeypair} from '@solana-developers/helpers'
import {Cluster, Connection, Keypair} from '@solana/web3.js'
import dotenv from 'dotenv'
import {createGroup} from './create-group'
import {TokenMetadata} from '@solana/spl-token-metadata'
import {uploadOffChainMetadata} from './helpers'
import {createMember} from './create-member'
dotenv.config()

const CLUSTER: Cluster = 'devnet'

// ... rest of the index.ts


// DEFINE MEMBER METADATA
const membersMetadata = [
	{
		imagePath: 'src/assets/1.jpeg',
		tokenName: 'Cat 1',
		tokenDescription: 'Two cool cats',
		tokenSymbol: 'MEOW',
		tokenExternalUrl: 'https://solana.com/',
		tokenAdditionalMetadata: {
			species: 'Cat',
			breed: 'Cool',
		},
		tokenUri: '',
		metadataFileName: '1.json',
	},
	{
		imagePath: 'src/assets/2.jpeg',
		tokenName: 'Cat 2',
		tokenDescription: 'Sassy cat',
		tokenSymbol: 'MEOW',
		tokenExternalUrl: 'https://solana.com/',
		tokenAdditionalMetadata: {
			species: 'Cat',
			breed: 'Cool',
		},
		tokenUri: '',
		metadataFileName: '2.json',
	},
	{
		imagePath: 'src/assets/3.jpeg',
		tokenName: 'Cat 3',
		tokenDescription: 'Silly cat',
		tokenSymbol: 'MEOW',
		tokenExternalUrl: 'https://solana.com/',
		tokenAdditionalMetadata: {
			species: 'Cat',
			breed: 'Cool',
		},
		tokenUri: 'https://solana.com/',
		metadataFileName: '3.json',
	},
]
```

Replace the `'path-to-solana-keypair'` with the keypair path of the solana wallet installed on your machine. You can check the path of the keypair by running the command:

```bash
solana config get
```

Don't worry about the `metadataFileName` for now. The JSON file will be created by the `helpers.ts` script. The `uploadOffChainMetadata` function from `helpers.ts` will upload the images and the metadata json using the Irys SDK. It returns the token URI for the metadata JSON which will be stored on the mint account.

### 4. Create member mints
Now we will upload the member metadata and then call the `createMember` function in `index.ts` created in step 2.

```ts
// UPLOAD MEMBER METADATA AND CREATE MEMBER MINT
membersMetadata.forEach(async (memberMetadata) => {
	const memberMintKeypair = Keypair.generate()

	memberMetadata.tokenUri = await uploadOffChainMetadata(
		memberMetadata,
		payer
	)

	const tokenMetadata: TokenMetadata = {
		name: memberMetadata.tokenName,
		mint: memberMintKeypair.publicKey,
		symbol: memberMetadata.tokenSymbol,
		uri: memberMetadata.tokenUri,
		updateAuthority: payer.publicKey,
		additionalMetadata: Object.entries(
			memberMetadata.tokenAdditionalMetadata || []
		).map(([trait_type, value]) => [trait_type, value]),
	}

	const signature = await createMember(
		connection,
		payer,
		memberMintKeypair,
		decimals,
		tokenMetadata,
		collectionMintKeypair.publicKey
	)

	console.log(
		'Created member NFT: ',
		signature,
		memberMintKeypair.publicKey.toBase58()
	)
})
```

That's it! We have successfully created three mints with member pointer extension. You can check the signature or the mint address on the [Solana Explorer](https://explorer.solana.com/) where you will find the metadata URI.
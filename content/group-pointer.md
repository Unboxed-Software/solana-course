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

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. However like all Token Extensions Program mints, we need to calculate the size and cost of the mint. This can be accomplished by using `getMintLen` and `getMinimumBalanceForRentExemption`. In this case, we'll call `getMintLen` with only the `ExtensionType.GroupPointer`.

To get the mint length and create account instruction, do the following:

```ts
// get mint length
const extensions = [ExtensionType.GroupPointer]
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
In this lab we'll create a Cool Cats NFT collection using the `group`, `group pointer`, `member` and `member pointer` extensions. 

The Cool Cats NFT collection will have a group NFT with three member NFTs within it.

### 1. Getting started
To get started, clone [this](https://github.com/Unboxed-Software/solana-lab-group-member) repository's `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-group-member.git
cd solana-lab-group-member
git checkout starter
npm install
```

The `starter` code comes with:

 - `index.ts`: creates a connection object and calls `initializeKeypair`. This is where we will write our script.
 - `assets`:  folder which contains the cover image for our NFT collection.
 - `helper.ts`: helper functions for uploading metadata.

### 2. Run validator node

For the sake of this guide, we'll be running our own validator node.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is `http://127.0.0.1:8899`. We then use that in the connection to specify to use the local RPC URL.

`const connection = new Connection("http://127.0.0.1:8899", "confirmed");`
Alternatively, if you’d like to use testnet or devnet, import the clusterApiUrl from `@solana/web3.js` and pass it to the connection as such:

`const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');`
If you decide to use devnet, and have issues with airdropping SOL. Feel free to add the `keypairPath` parameter to `initializeKeypair`. You can get this by running `solana config get` in your terminal. And then go to [faucet.solana.com](faucet.solana.com) and airdrop some SOL to your address. You can get your address by running Solana address in your terminal.

With the validator setup correctly, you may run `index.ts` and confirm everything is working.

```bash
npx esrun src/index.ts
```

### 3. Setup group metadata
Before we create our group NFT, we need to prepare the group metadata and upload it. We are using devnet Irys (Arweave) to upload the image and metadata. This functionality is provided for you in the `helpers.ts`.

For ease of this lesson, we've provided assets for the NFTs in the `assets` directory. 

If you'd like to use your own files and metadata feel free!

To get our group metadata ready we have to do the following:
1. We need to format our metadata for upload using the `LabNFTMetadata` interface from `helper.ts`
2. Call the `uploadOffChainMetadata` from `helpers.ts`
3. Format everything including the resulting uri from the previous step into the  

We need to format our metadata for upload (`LabNFTMetadata`), upload the image and metadata (`uploadOffChainMetadata`), and finally format everything into the `TokenMetadata` interface from the `@solana/spl-token-metadata` library.

Note: We are using devnet Irys, which is free to upload to under 100kb.

```ts
// CREATE GROUP METADATA

const groupMetadata: LabNFTMetadata = {
	mint: groupMintKeypair,
	imagePath: "assets/collection.png",
	tokenName: "cool-cats-collection",
	tokenDescription: "Collection of Cool Cat NFTs",
	tokenSymbol: "MEOW",
	tokenExternalUrl: "https://solana.com/",
	tokenAdditionalMetadata: {},
	tokenUri: "",
}

// UPLOAD OFF-CHAIN METADATA
groupMetadata.tokenUri = await uploadOffChainMetadata(
	payer,
	groupMetadata
)

// FORMAT GROUP TOKEN METADATA
const collectionTokenMetadata: TokenMetadata = {
	name: groupMetadata.tokenName,
	mint: groupMintKeypair.publicKey,
	symbol: groupMetadata.tokenSymbol,
	uri: groupMetadata.tokenUri,
	updateAuthority: payer.publicKey,
	additionalMetadata: Object.entries(
		groupMetadata.tokenAdditionalMetadata || []
	).map(([trait_type, value]) => [trait_type, value]),
}
```

Feel free to run the script and make sure everything uploads.

```bash
npx esrun src/index.ts
```

### 3. Create a mint with group and group pointer
Let's create the group NFT by creating a mint with the `metadata`, `metadata pointer`, `group` and `group pointer` extensions.

This NFT is the visual representation of our collection.

Let's first define the inputs to our new function `createTokenGroup`:

- `connection`: Connection to the blockchain
- `payer`: The keypair paying for the transaction
- `mintKeypair`: The mint keypair
- `decimals`: The mint decimals ( 0 for NFTs )
- `maxMembers`: The maximum number of members allowed in the group
- `metadata`: The metadata for the group mint

```ts
export async function createTokenGroup(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	maxMembers: number,
	metadata: TokenMetadata
): Promise<TransactionSignature>
```

To make our NFT, we will be storing the metadata directly on the mint account using the `metadata` and `metadata pointer` extensions. And we'll save some info about the group with the `group` and `group pointer` extensions.

To create our group NFT, we need the following instructions:

- `SystemProgram.createAccount`: Allocates space on Solana for the mint account. We can get the `mintLength` and `mintLamports` using `getMintLen` and `getMinimumBalanceForRentExemption` respectively.
- `createInitializeGroupPointerInstruction`: Initializes the group pointer
- `createInitializeMetadataPointerInstruction`: Initializes the metadata pointer
- `createInitializeMintInstruction`: Initializes the mint
- `createInitializeGroupInstruction`: Initializes the group
- `createInitializeInstruction`: Initializes the metadata

Finally, we need to add all of these instructions to a transaction and send it to the Solana network, and return the signature. We can do this by calling `sendAndConfirmTransaction`.

```ts
import {
	sendAndConfirmTransaction,
	Connection,
	Keypair,
	SystemProgram,
	Transaction,
	TransactionSignature,
} from "@solana/web3.js"

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
} from "@solana/spl-token"
import {
	TokenMetadata,
	createInitializeInstruction,
	pack,
} from "@solana/spl-token-metadata"

export async function createTokenGroup(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	maxMembers: number,
	metadata: TokenMetadata
): Promise<TransactionSignature> {

	const extensions: ExtensionType[] = [
		ExtensionType.GroupPointer,
		ExtensionType.MetadataPointer,
	]

	const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length + 500
	const mintLength = getMintLen(extensions)
	const totalLen = mintLength + metadataLen + TOKEN_GROUP_SIZE

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(totalLen)

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

	const signature = await sendAndConfirmTransaction(
		connection,
		mintTransaction,
		[payer, mintKeypair]
	)

	return signature
}
```

Now that we have our function, let's call it in our `index.ts` file.

```ts
// CREATE GROUP
const signature = await createTokenGroup(
	connection,
	payer,
	groupMintKeypair,
	decimals,
	maxMembers,
	collectionTokenMetadata
)

console.log(`Created collection mint with metadata:\n${getExplorerLink("tx", signature, 'localnet')}\n`)
```

Before we run the script, lets fetch the newly created group NFT and print it's contents. Let's do this in `index.ts`:

```ts
// FETCH THE GROUP
const groupMint = await getMint(connection, groupMintKeypair.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
const fetchedGroupMetadata = await getTokenMetadata(connection, groupMintKeypair.publicKey);
const metadataPointerState = getMetadataPointerState(groupMint);
const groupData = getGroupPointerState(groupMint);

console.log("\n---------- GROUP DATA -------------\n");
console.log("Group Mint: ", groupMint.address.toBase58());
console.log("Metadata Pointer Account: ", metadataPointerState?.metadataAddress?.toBase58());
console.log("Group Pointer Account: ", groupData?.groupAddress?.toBase58());
console.log("\n--- METADATA ---\n");
console.log("Name: ", fetchedGroupMetadata?.name);
console.log("Symbol: ", fetchedGroupMetadata?.symbol);
console.log("Uri: ", fetchedGroupMetadata?.uri);
console.log("\n------------------------------------\n");
```

Now we can run the script and see the group NFT we created.

```bash
npx esrun src/index.ts
```

### 4. Setup member NFT Metadata

Now that we've created our group NFT, we can create the member NFTs. But before we actually create them, we need to prepare their metadata.

The flow is the exact same to what we did with the group NFT.

1. We need to format our metadata for upload using the `LabNFTMetadata` interface from `helper.ts`
2. Call the `uploadOffChainMetadata` from `helpers.ts`
3. Format everything including the resulting uri from the previous step into the `TokenMetadata` interface from the `@solana/spl-token-metadata` library.

However, since we have three members, we're going to loop through each step for each member.

First, let's define the metadata for each member:
```ts
// DEFINE MEMBER METADATA
const membersMetadata: LabNFTMetadata[] = [
	{
		mint: cat0Mint,
		imagePath: "assets/cat_0.png",
		tokenName: "Cat 1",
		tokenDescription: "Adorable cat",
		tokenSymbol: "MEOW",
		tokenExternalUrl: "https://solana.com/",
		tokenAdditionalMetadata: {},
		tokenUri: "",
	},
	{
		mint: cat1Mint,
		imagePath: "assets/cat_1.png",
		tokenName: "Cat 2",
		tokenDescription: "Sassy cat",
		tokenSymbol: "MEOW",
		tokenExternalUrl: "https://solana.com/",
		tokenAdditionalMetadata: {},
		tokenUri: "",
	},
	{
		mint: cat2Mint,
		imagePath: "assets/cat_2.png",
		tokenName: "Cat 3",
		tokenDescription: "Silly cat",
		tokenSymbol: "MEOW",
		tokenExternalUrl: "https://solana.com/",
		tokenAdditionalMetadata: {},
		tokenUri: "",
	},
];
```

Now let's loop through each member and upload their metadata.

```ts
// UPLOAD MEMBER METADATA
for (const member of membersMetadata) {
	member.tokenUri = await uploadOffChainMetadata(
		payer,
		member
	)
}
```

Finally, let's format the metadata for each member into the `TokenMetadata` interface:

Note: We'll want to carry over the keypair since we'll need it to create the member NFTs.

```ts
// FORMAT TOKEN METADATA
const memberTokenMetadata: {mintKeypair: Keypair, metadata: TokenMetadata}[] = membersMetadata.map(member => ({
    mintKeypair: member.mint,
    metadata: {
        name: member.tokenName,
        mint: member.mint.publicKey,
        symbol: member.tokenSymbol,
        uri: member.tokenUri,
        updateAuthority: payer.publicKey,
        additionalMetadata: Object.entries(member.tokenAdditionalMetadata || []).map(([trait_type, value]) => [trait_type, value]),
    } as TokenMetadata
}))
```

### 5. Create member NFTs
Just like the group NFT we need to create the member NFTs. Let's do this in a new file called `create-member.ts`. It is going to look very similar to the `create-group.ts` file, except we are going to use the `member` and `member pointer` extensions instead of the `group` and `group pointer` extensions.

First, let's define the inputs to our new function `createTokenMember`:

- `connection`: Connection to the blockchain
- `payer`: The keypair paying for the transaction
- `mintKeypair`: The mint keypair
- `decimals`: The mint decimals ( 0 for NFTs )
- `metadata`: The metadata for the group mint
- `groupAddress`: The address of the group account - in this case it's the group mint itself

```ts
export async function createTokenMember(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	metadata: TokenMetadata,
	groupAddress: PublicKey
): Promise<TransactionSignature>
```

Just like the group NFT, we need the following instructions:
- `SystemProgram.createAccount`: Allocates space on Solana for the mint account. We can get the `mintLength` and `mintLamports` using `getMintLen` and `getMinimumBalanceForRentExemption` respectively.
- `createInitializeGroupMemberPointerInstruction`: Initializes the member pointer
- `createInitializeMetadataPointerInstruction`: Initializes the metadata pointer
- `createInitializeMintInstruction`: Initializes the mint
- `createInitializeMemberInstruction`: Initializes the member
- `createInitializeInstruction`: Initializes the metadata

Finally, we need to add all of these instructions to a transaction and send it to the Solana network, and return the signature. We can do this by calling `sendAndConfirmTransaction`.

```ts
import {
	sendAndConfirmTransaction,
	Connection,
	Keypair,
	SystemProgram,
	Transaction,
	TransactionSignature,
	PublicKey,
} from "@solana/web3.js"

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
} from "@solana/spl-token"
import {
	TokenMetadata,
	createInitializeInstruction,
	pack,
} from "@solana/spl-token-metadata"

export async function createTokenMember(
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	metadata: TokenMetadata,
	groupAddress: PublicKey
): Promise<TransactionSignature> {

	const extensions: ExtensionType[] = [
		ExtensionType.GroupMemberPointer,
		ExtensionType.MetadataPointer,
	]

	const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length
	const mintLength = getMintLen(extensions)
	const totalLen = mintLength + metadataLen + TOKEN_GROUP_SIZE

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(totalLen)

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

	const signature = await sendAndConfirmTransaction(
		connection,
		mintTransaction,
		[payer, mintKeypair]
	)

	return signature
}
```

Let's add our new function to `index.ts` and call it for each member:
```ts
// CREATE MEMBER MINTS
for (const memberMetadata of memberTokenMetadata) {

	const signature = await createTokenMember(
		connection,
		payer,
		memberMetadata.mintKeypair,
		decimals,
		memberMetadata.metadata,
		groupMintKeypair.publicKey
	)

	console.log(`Created ${memberMetadata.metadata.name} NFT:\n${getExplorerLink("tx", signature, 'localnet')}\n`)

}
```

Let's fetch our newly created member NFTs and display their contents.

```ts
for (const member of membersMetadata) {
	const memberMint = await getMint(connection, member.mint.publicKey, "confirmed", TOKEN_2022_PROGRAM_ID);
	const memberMetadata = await getTokenMetadata(connection, member.mint.publicKey);
	const metadataPointerState = getMetadataPointerState(memberMint);
	const memberPointerData = getGroupMemberPointerState(memberMint);
	const memberData = getTokenGroupMemberState(memberMint);

	console.log("\n---------- MEMBER DATA -------------\n");
	console.log("Member Mint: ", memberMint.address.toBase58());
	console.log("Metadata Pointer Account: ", metadataPointerState?.metadataAddress?.toBase58());
	console.log("Group Account: ", memberData?.group?.toBase58());
	console.log("Member Pointer Account: ", memberPointerData?.memberAddress?.toBase58());
	console.log("Member Number: ", memberData?.memberNumber);
	console.log("\n--- METADATA ---\n");
	console.log("Name: ", memberMetadata?.name);
	console.log("Symbol: ", memberMetadata?.symbol);
	console.log("Uri: ", memberMetadata?.uri);
	console.log("\n------------------------------------\n");	
}
```

Lastly, let's run the script and see our full collection of NFTs!
```bash
npx esrun src/index.ts
```

That's it! If you're having troubles feel free to check out the `solution` [branch in the repository](https://github.com/Unboxed-Software/solana-lab-group-member/tree/solution).

# Challenge
Go create a NFT collection of your own using the the `group`, `group pointer`, `member` and `member pointer` extensions.

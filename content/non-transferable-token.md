---
title: Non-Transferable Token
objectives:
 - Create non-transferable token
 - Mint a non-transferable token
 - Try transfer of the non-transferable token
---

# Summary
 - In the Token program, creating exclusively owned tokens was not possible.
 - The Token Extension Program allows creating tokens which cannot be transferred.

# Overview
In the Token program, it was impossible to create an exclusively owned mint. The Token Extension Program has a `NonTransferable` extension which can be used to create non-transferable mints. The tokens created using this extension cannot be moved to any other entity. This extension is perfect for use cases such as awarding achievements that can only belong to one person or account.

Initializing a non-transferable mint involves three instruction:

 - Create Account
 - Initialize non-transferable extension
 - Initialize the mint

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. This instruction accomplishes three things:

 - Allocates `space`
 - Transfers `lamports` for rent
 - Assigns to itself it's owning program

```ts
SystemProgram.createAccount({
	fromPubkey: payer.publicKey,
	newAccountPubkey: mintKeypair.publicKey,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

The second instruction `createInitializeNonTransferableMintInstruction` initializes the non-transferable extension.

```ts
createInitializeNonTransferableMintInstruction(
	mintKeypair.publicKey,
	TOKEN_2022_PROGRAM_ID
)
```

The third instruction `createInitializeMintInstruction` initializes the mint.

```ts
createInitializeMintInstruction(
	mintKeypair.publicKey,
	decimals,
	payer.publicKey,
	null,
	TOKEN_2022_PROGRAM_ID
)
```

# Lab
In this lab, we will create a non-transferable token and try to transfer it to another account.

### 1. Getting started
To get started, clone [this repository's](https://github.com/Unboxed-Software/solana-lab-non-transferable-token.git) `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-non-transferable-token.git
cd solana-lab-non-transferable-token
git checkout starter
npm install
```

The starter code comes with following files:

 - `keypair-helpers.ts`
 - `index.ts`

The `keypair-helpers.ts` file contains some boilerplate for generating a new keypair and airdropping test SOL if needed.

`index.ts` has a `main` function that creates a connection to the specified cluster and calls `initializeKeypair`. This main function is where we'll end up calling the rest of our script once we've written it.

### 2. Create a non-transferable mint

We are now going to create the function `createNonTransferableMint` in a new file `src/create-mint.ts`.

When creating a mint with close authority, we need three instructions: `SystemProgram.createAccount`, `createInitializeNonTransferableMintInstruction`, `createInitializeMintInstruction`.

Inside `src/create-mint.ts`, create the function `createNonTransferableMint` with the following arguments:
 - `cluster` : The cluster to which connection points to
 - `connection` : The connection object
 - `payer` : Payer for the transaction
 - `mintKeypair` : Keypair for new mint
 - `decimals` : Mint decimals

```ts
import {
	Cluster,
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
	createInitializeNonTransferableMintInstruction,
} from '@solana/spl-token'

export async function createNonTransferableMint(
	cluster: Cluster,
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number
): Promise<TransactionSignature> {
	const extensions = [ExtensionType.NonTransferable]
	const mintLength = getMintLen(extensions)

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(mintLength)

	console.log('Creating a transaction with non-transferable instruction...')
	const mintTransaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: payer.publicKey,
			newAccountPubkey: mintKeypair.publicKey,
			space: mintLength,
			lamports: mintLamports,
			programId: TOKEN_2022_PROGRAM_ID,
		}),
		createInitializeNonTransferableMintInstruction(
			mintKeypair.publicKey,
			TOKEN_2022_PROGRAM_ID
		),
		createInitializeMintInstruction(
			mintKeypair.publicKey,
			decimals,
			payer.publicKey,
			null,
			TOKEN_2022_PROGRAM_ID
		)
	)

	console.log('Sending transaction...')
	const signature = await sendAndConfirmTransaction(
		connection,
		mintTransaction,
		[payer, mintKeypair],
		{commitment: 'finalized'}
	)
	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${cluster} \n\n`
	)

	return signature
}
```

Now let's call this function in `src/index.ts`

```ts
import {
	Cluster,
	Connection,
	clusterApiUrl,
	Keypair,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {initializeKeypair} from './keypair-helpers'
import {createNonTransferableMint} from './create-mint'
import {
	TOKEN_2022_PROGRAM_ID,
	createAccount,
	mintTo,
	transferChecked,
} from '@solana/spl-token'

const CLUSTER: Cluster = 'devnet'

async function main(){
	...

	// CREATE MINT
	const decimals = 9

	await createNonTransferableMint(
		CLUSTER,
		connection,
		payer,
		mintKeypair,
		decimals
	)
}
```

Now run `npm start`. We will see a link which will take us to the create mint transaction on Solana Explorer.

### 3. Mint token
In `src/index.ts`, we will create a source account and mint one non-transferable token.

```ts
async function main(){
	...

	// CREATE SOURCE ACCOUNT AND MINT TOKEN
	console.log('Creating a source account...')
	const sourceKeypair = Keypair.generate()
	const sourceAccount = await createAccount(
		connection,
		payer,
		mint,
		sourceKeypair.publicKey,
		undefined,
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)

	console.log('Minting 1 token...\n\n')
	const amount = 1 * LAMPORTS_PER_SOL
	await mintTo(
		connection,
		payer,
		mint,
		sourceAccount,
		payer,
		amount,
		[payer],
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)
}
```

Now run `npm start`. Our source account has been created with one non-transferable token.

### 4. Attempt to transfer a non-tranferable token
In `src/index.ts`, we will create a destination account and try to transfer the non-transferable token to this account.

```ts
async function main(){
	...

	// CREATE DESTINATION ACCOUNT FOR TRANSFER
	console.log('Creating a destination account...\n\n')
	const destinationKeypair = Keypair.generate()
	const destinationAccount = await createAccount(
		connection,
		payer,
		mintKeypair.publicKey,
		destinationKeypair.publicKey,
		undefined,
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)
}
```

Now we will try and transfer the non-transferable token from the source account to the destination account. This call will fail and throw `SendTransactionError`.

```ts
async function main(){
	...

	// TRY TRANSFER
	console.log('Trying transferring non-transferable mint...')
	try {
		const signature = await transferChecked(
			connection,
			payer,
			sourceAccount,
			mint,
			destinationAccount,
			sourceAccount,
			amount,
			decimals,
			[sourceKeypair, destinationKeypair],
			{commitment: 'finalized'},
			TOKEN_2022_PROGRAM_ID
		)
		console.log(
			`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`
		)
	} catch (e) {
		console.log(
			'This transfer is failing because the mint is non-transferable. Check out the program logs: ',
			(e as any).logs,
			'\n\n'
		)
	}
}
```

Now run `npm start`. We should see the console log of transaction failure along with program logs.

That's it! We have successfully created a non-transferable mint. If you are stuck at any point, you can find the working code on the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-lab-non-transferable-token.git).

# Challenge
For the challenge, create your own non-transferable token and try to transfer it.
---
title: Close Mint Extension
objectives:
 - Create a closable mint
 - Mint tokens
 - Try closing with non zero supply
 - Burn supply
 - Close the mint
---

# Summary
 - The Token program allows closing token accounts, but not mint accounts.
 - Token Extension Program program includes `MintCloseAuthority` which will be initialized when creating mint.

# Overview
The Token program allows owners to close token accounts, but it is impossible to close mint accounts. In Token Extension Program program, it is possible to close mint accounts by initializing the `MintCloseAuthority` extension before initializing the mint.

Initializing the mint with close authority involves three instruction:
 - Create Account
 - Initialize close mint extension
 - Initialize the mint

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. This instruction accomplishes three things:
 - Allocate `space`
 - Transfer `lamports` for rent
 - Assign to itself it's owning program
```ts
SystemProgram.createAccount({
	fromPubkey: payer.publicKey,
	newAccountPubkey: mintKeypair.publicKey,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

The second instruction `createInitializeMintCloseAuthorityInstruction` initializes the close authority extension.
```ts
createInitializeMintCloseAuthorityInstruction(
	mintKeypair.publicKey,
	payer.publicKey,
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

When the transaction is sent, a new mint account is created with the specified close authority.

The only constraint when closing the mint account is that the supply must be zero. If we try to close the mint account when the supply is not zero, the program will throw an error.

# Lab
We will not create a mint with close authority. We will also see what happens when we try to close the mint when supply is not zero. Then, we will burn the supply and then close the mint account.

## 1. Getting Started
To get started, clone [this repository's](https://github.com/Unboxed-Software/close-mint-account.git) `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/close-mint-account.git
cd close-mint-account
git checkout starter
npm install
```

The starter code comes with following files:
 - `keypair-helpers.ts`
 - `print-helpers.ts`
 - `index.ts`

The `keypair-helpers.ts` file contains some boilerplate for generating a new keypair and airdropping test SOL if needed.

The `print-helpers.ts` file has a function called `printTableData`. We'll be using the `printTableData` function to print information about tokens and their mints in a readable fashion.

Lastly, `index.ts` has a main function that creates a connection to the specified cluster and calls `initializeKeypair`. This main function is where we'll end up calling the rest of our script once we've written it.

## 2. Create a mint with close authority

We are now going to create a function `createClosableMint` in a new file `src/create-mint.ts`.

When creating a mint with close authority, we need three instructions: `SystemProgram.createAccount`, `createInitializeMintCloseAuthorityInstruction`, `createInitializeMintInstruction`.

Inside of `src/create-mint.ts`, create the function `createClosableMint` with the following arguments:
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
	createInitializeMintCloseAuthorityInstruction,
} from '@solana/spl-token'

export async function createClosableMint(
	cluster: Cluster,
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number
): Promise<TransactionSignature> {
	const extensions = [ExtensionType.MintCloseAuthority]
	const mintLength = getMintLen(extensions)

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(mintLength)

	console.log('Creating a transaction with close mint instruction...')
	const mintTransaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: payer.publicKey,
			newAccountPubkey: mintKeypair.publicKey,
			space: mintLength,
			lamports: mintLamports,
			programId: TOKEN_2022_PROGRAM_ID,
		}),
		createInitializeMintCloseAuthorityInstruction(
			mintKeypair.publicKey,
			payer.publicKey,
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
Now let's call this function in `src/index.ts`:

```ts
import { createClosableMint } from './create-mint'

async function main(){
	...

	// CREATE A MINT WITH CLOSE AUTHORITY
	const decimals = 9
	await createClosableMint(CLUSTER, connection, payer, mintKeypair, decimals)
}
```
Now run `npm start`. We will see a link which will take us to the create mint transaction on Solana Explorer.

## 3. Closing the mint
Remember, when closing a mint, the supply must be zero. If we try to close the mint when supply is non-zero, the program will throw an error. We will create a new mint account and close it.

### 3.1 Mint token
In `src/index.ts`, create an account and mint 1 token to that account.
```ts
import {
	Cluster,
	Connection,
	clusterApiUrl,
	Keypair,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js'

import {
	TOKEN_2022_PROGRAM_ID,
	burn,
	closeAccount,
	createAccount,
	getAccount,
	getMint,
	mintTo,
} from '@solana/spl-token'

async function main(){
	...

	// MINT TOKEN
	const sourceKeypair = Keypair.generate()
	const sourceAccount = await await createAccount(
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

Now we will verify that the mint supply is non-zero by fetching the mint info.
```ts
import printTableData from './print-helpers'

async function main(){
	...

	// VERIFY SUPPLY
	const mintInfo = await getMint(
		connection,
		mintKeypair.publicKey,
		'finalized',
		TOKEN_2022_PROGRAM_ID
	)
	printTableData(mintInfo)
}
```
Now we can run `npm run`. We will see the mint into printed with the supply.

### 3.2 Closing the mint with non zero supply

Now we will try and close the mint when supply is non-zero.

```ts
async function main() {
	...

	// TRY CLOSING WITH NON ZERO SUPPLY
	try {
		await closeAccount(
			connection,
			payer,
			mintKeypair.publicKey,
			payer.publicKey,
			payer,
			[],
			{commitment: 'finalized'},
			TOKEN_2022_PROGRAM_ID
		)
	} catch (e) {
		console.log(
			'Close account fails here because the supply is not zero. Check the program logs:',
			(e as any).logs,
			'\n\n'
		)
	}
}
```
Now we can run `npm start`. We will see that the program throws an error along with the program logs.

### 3.3 Burning the supply

Now we will burn the supply of the mint to bring the supply back to zero.

```ts
async function main(){
	...

	// BURN SUPPLY
	const sourceAccountInfo = await getAccount(
		connection,
		sourceAccount,
		'finalized',
		TOKEN_2022_PROGRAM_ID
	)

	const burnSignature = await burn(
		connection,
		payer,
		sourceAccount,
		mintKeypair.publicKey,
		sourceKeypair,
		sourceAccountInfo.amount,
		[],
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)
	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${burnSignature}?cluster=${CLUSTER} \n\n`
	)
}
```

When we run `npm start`, we will see a link which will take us to the burn transaction on Solana Explorer.

### 3.4 Close the mint
Now that there are no tokens in circulation, we can close the mint.
```ts
async function main(){
	...

	// CLOSE MINT
	try {
		const mintInfo = await getMint(
			connection,
			mintKeypair.publicKey,
			'finalized',
			TOKEN_2022_PROGRAM_ID
		)

		printTableData(mintInfo)

		console.log('Closing after burning the supply...')
		const closeSignature = await closeAccount(
			connection,
			payer,
			mintKeypair.publicKey,
			payer.publicKey,
			payer,
			[],
			{commitment: 'finalized'},
			TOKEN_2022_PROGRAM_ID
		)
		console.log(
			`Check the transaction at: https://explorer.solana.com/tx/${closeSignature}?cluster=${CLUSTER} \n\n`
		)
	} catch (e) {
		console.log(e)
	}
}
```
Run `npm start` once more, and we will see a link for the close mint transaction on Solana Explorer.

That's it! We have successfully created a mint with close authority. If you get stuck at any point, you can find working code in the `solution` branch of [this repository](https://github.com/Unboxed-Software/close-mint-account/).
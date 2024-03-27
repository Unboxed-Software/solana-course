---
title: Close Mint Extension
objectives:
 - Create a mint that is closable
 - Describe all of the prerequisites needed to close a mint
---

# Summary
 - The orignal Token Program only allowed closing token accounts, but not mint accounts.
 - Token Extension Program includes `MintCloseAuthority` extension which allows mint accounts to be closed.
 - For a mint with the `MintCloseAuthority` extension, all supply of the mint needs to be burned first.

# Overview
The oringal Token Program only allows owners to close token accounts, but it is impossible to close mint accounts. In the Token Extension Program, it is possible to close mint accounts that are initialized with the `MintCloseAuthority` extension.

This is a nice quality of life improvement for developers, who may have thousands of mint accounts that could be cleaned up and be refunded for. Additionally, users who decide to burn their NFTs can now recoup the entire rent cost, since they can now also close the mint account.


## Create Mint with Close Authority

Initializing the mint with the close authority extension involves three instructions:
 - `SystemProgram.createAccount` 
 - `createInitializeMintCloseAuthorityInstruction`
 - `createInitializeMintInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. However like all Token Extension Program mints, we need to calculate the size of the mint. This can be accomplished by using `getMintLen` giving it an array of TODO 

To get the mint length and create account instruction, do the following:
```ts

//TODO talk about how to get the `mintLength`

const createAccountInstruction = SystemProgram.createAccount({
	fromPubkey: payer,
	newAccountPubkey: mint,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

The second instruction `createInitializeMintCloseAuthorityInstruction` initializes the close authority extension.
```ts

const initializeMintCloseAuthorityInstruction = createInitializeMintCloseAuthorityInstruction(
	mint,
	authority,
	TOKEN_2022_PROGRAM_ID
)
```

The third instruction `createInitializeMintInstruction` initializes the mint.
```ts
const initializeMintInstruction = createInitializeMintInstruction(
	mint,
	decimals,
	payer.publicKey, // TODO check authority or payer?
	null,
	TOKEN_2022_PROGRAM_ID
)
```

TODO - Send them to the blockchain
```typescript
const mintTransaction = new Transaction().add(
	createAccountInstruction,
	initializeMintCloseAuthorityInstruction,
	initializeMintInstruction,
)

const signature = await sendAndConfirmTransaction(
	connection,
	mintTransaction,
	[payer, mintKeypair],
	{commitment: 'finalized'}
)
```

When the transaction is sent, a new mint account is created with the specified close authority.


## Close Mint with Close Authority

TODO rewrite:
The only constraint when closing the mint account is that the supply must be zero. If we try to close the mint account when the supply is not zero, the program will throw an error.

TODO

# Lab
TODO Rewrite
We will not create a mint with a close authority. We will also see what happens when we try to close the mint when supply is not zero. Then we will burn the supply and close the mint account.

## 1. Getting Started

To get started, clone [this repository's](https://github.com/Unboxed-Software/solana-lab-close-mint-account.git) `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-close-mint-account.git
cd solana-lab-close-mint-account
git checkout starter
npm install
```

The starter code comes with following files:
 - `print-helpers.ts`
 - `index.ts`

The `print-helpers.ts` file has a function called `printTableData`. We'll be using the `printTableData` function to print information about tokens and their mints in a readable fashion.

Lastly, `index.ts` has a main function that creates a connection to the specified cluster and calls `initializeKeypair`. This main function is where we'll end up calling the rest of our script once we've written it.

TODO Talk about devnet/localhost

## 2. Create a mint with close authority

We are now going to create the function `createClosableMint` in a new file `src/create-mint.ts`.

When creating a mint with close authority, we need three instructions: `SystemProgram.createAccount`, `createInitializeMintCloseAuthorityInstruction`, `createInitializeMintInstruction`.

Add the `createClosableMint` with the following arguments:
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

//TODO refactor to take out cluster
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

	//TODO move to index.ts or remove completely
	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${cluster} \n\n`
	)

	return signature
}
```
Now let's call this function in `src/index.ts`:

```ts
import {
	Cluster,
	Connection,
	clusterApiUrl,
	Keypair,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {initializeKeypair} from '@solana-developers/helpers'
import {createClosableMint} from './create-mint'
import {
	TOKEN_2022_PROGRAM_ID,
	burn,
	closeAccount,
	createAccount,
	getAccount,
	getMint,
	mintTo,
} from '@solana/spl-token'
import printTableData from './print-helpers'
import dotenv from 'dotenv'
dotenv.config()

const CLUSTER: Cluster = 'devnet'

async function main(){
	...

	// CREATE A MINT WITH CLOSE AUTHORITY
	const decimals = 9
	await createClosableMint(CLUSTER, connection, payer, mintKeypair, decimals)
}

main()
```
Run `npm start`. We will see a link which will take us to the create mint transaction on Solana Explorer.

## 3. Closing the mint
Remember, when closing a mint, the supply must be zero. If we try to close the mint when supply is non-zero, the program will throw an error. We will mint 1 token from this mint, and try to close the mint account.

### 3.1 Mint a token
In `src/index.ts`, create an account and mint 1 token to that account.

```ts
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

main()
```

Now we will verify that the mint supply is non-zero by fetching the mint info.

```ts
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

main()
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

main()
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

main()
```

When we run `npm start`, we will see a link which will take us to the burn transaction on Solana Explorer.

### 3.4 Close the mint
With no tokens in circulation, we can now close the mint.

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

main()
```
Run `npm start` once more, and we will see a link for the close mint transaction on Solana Explorer.

That's it! We have successfully created a mint with close authority. If you get stuck at any point, you can find working code in the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-lab-close-mint-account.git).

# Challenge
For the challenge, try and create your own mint and mint to several token accounts, then create a script to burn all of those token accounts, then close the mint.
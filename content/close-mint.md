---
title: Close Mint Extension
objectives:
 - Create a mint that is closable
 - Describe all of the prerequisites needed to close a mint
---

# Summary
 - The original Token Program only allowed closing token accounts, but not mint accounts.
 - Token Extension Program includes `MintCloseAuthority` extension which allows mint accounts to be closed.
 - For a mint with the `MintCloseAuthority` extension, all supply of the mint needs to be burned first.

# Overview
The original Token Program only allows owners to close token accounts, but it is impossible to close mint accounts. In the Token Extension Program, it is possible to close mint accounts that are initialized with the `MintCloseAuthority` extension.

This is a nice improvement for developers, who may have thousands of mint accounts that could be cleaned up and be refunded for. Additionally, users who decide to burn their NFTs can now recoup the entire rent cost, since they can now also close the mint account.


## Create Mint with Close Authority

Initializing the mint with the close authority extension involves three instructions:
 - `SystemProgram.createAccount` 
 - `createInitializeMintCloseAuthorityInstruction`
 - `createInitializeMintInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. However like all Token Extension Program mints, we need to calculate the size of the mint. This can be accomplished by using `getMintLen`, passing it an array of extensions that will be used with the mint. For our purposes, we include the MintCloseAuthority extension to enable closing of the mint account. 

This block of code effectively calculates the necessary space for the mint account by including specific extensions that affect the account's data size, ensuring the mint has enough space allocated for its features before creating the mint account.

To get the mint length and create account instruction, do the following:
```ts

// get mint length
const extensions = [ExtensionType.MintCloseAuthority]
const mintLength = getMintLen(extensions)

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
	payer.publicKey,
	null,
	TOKEN_2022_PROGRAM_ID
)
```

Finally we add the instructions to the transaction and submit it to the Solana network.
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
	{ commitment: 'finalized' }
)
```

When the transaction is sent, a new mint account is created with the specified close authority.


## Close Mint with Close Authority
When attempting to close a mint account, it is essential that all tokens issued from this account have been returned or burned, reducing the supply to zero. If any tokens remain in circulation (i.e., the supply is not zero), the attempt to close the mint will be blocked, and the program will issue an error message indicating that the account cannot be closed until the supply is zero.

# Lab
We will proceed to create a mint with the close authority extension. Following this, we will explore the process of attempting to close the mint while its supply is not zero, to demonstrate how the system handles such scenarios. Afterward, we will burn all existing tokens to reduce the supply to zero and then successfully close the mint account.

## 1. Getting Started

To get started, clone [this repository's](https://github.com/Unboxed-Software/solana-lab-close-mint-account.git) `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-close-mint-account.git
cd solana-lab-close-mint-account
git checkout starter
npm install
```

The starter code comes with following file:
 - `index.ts`

`index.ts` creates a connection to the specified cluster and calls `initializeKeypair`. This is where we'll end up calling the rest of our script once we've written it.

### 2. Run validator node

For the sake of this guide, we will be running our own validator node. We do this because sometimes testnet or devnets on Solana can become congested and in turn less reliable.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is `http://127.0.0.1:8899`. We then use that in the connection to specify to use the local RPC URL.

```tsx
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
```

Alternatively, if you’d like to use testnet or devnet, import the `clusterApiUrl` from `@solana/web3.js` and pass it to the connection as such:

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

## 3. Create a mint with close authority

We are now going to create the function `createClosableMint` in a new file `src/create-mint.ts`.

When creating a mint with close authority, we need three instructions: `SystemProgram.createAccount`, `createInitializeMintCloseAuthorityInstruction`, `createInitializeMintInstruction`.

Add the `createClosableMint` with the following arguments:
- `connection` : The connection object
- `payer` : Payer for the transaction
- `mintKeypair` : Keypair for new mint
- `decimals` : Mint decimals

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
	createInitializeMintCloseAuthorityInstruction,
} from '@solana/spl-token'

export async function createClosableMint(
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
		{ commitment: 'finalized' }
	)

	return signature
}
```
Now let's call this function in `src/index.ts`:

```ts
import {
	Connection,
	Keypair,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { initializeKeypair } from '@solana-developers/helpers'
import { createClosableMint } from './create-mint'
import {
	TOKEN_2022_PROGRAM_ID,
	burn,
	closeAccount,
	createAccount,
	getAccount,
	getMint,
	mintTo,
} from '@solana/spl-token'
import dotenv from 'dotenv'
dotenv.config()

// previous code

/**
 * Creating a mint with close authority
*/
const decimals = 9

await createClosableMint(connection, payer, mintKeypair, decimals)
```
This will create a transaction with close mint instruction.

## 4. Closing the mint
Remember, when closing a mint, the supply must be zero. If we try to close the mint when supply is non-zero, the program will throw an error. We will mint 1 token from this mint, and try to close the mint account.

### 4.1 Mint a token
In `src/index.ts`, create an account and mint 1 token to that account.

```ts
// previous code

/**
 * Creating an account and mint 1 token to that account
*/
console.log('Creating an account...')
const sourceKeypair = Keypair.generate()
const sourceAccount = await createAccount(
	connection,
	payer,
	mint,
	sourceKeypair.publicKey,
	undefined,
	{ commitment: 'finalized' },
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
	{ commitment: 'finalized' },
	TOKEN_2022_PROGRAM_ID
)
```

Now we can verify that the mint supply is non-zero by fetching the mint info. Underneath the minting functions, add the following code block:

```ts
// previous code
/**
 * Get mint information to verify supply
*/
const mintInfo = await getMint(
	connection,
	mintKeypair.publicKey,
	'finalized',
	TOKEN_2022_PROGRAM_ID
)
console.log("Initial supply: ", mintInfo.supply)
```
Now we can run `npm start`. We will see the mint into printed with the supply.
`Initial supply:  1000000000n` 

### 4.2 Closing the mint with non zero supply

Now we will attempt to close the mint when supply is non-zero.

```ts
// previous code

/**
 * Try closing the mint account when supply is not 0
 *
 * Should throw `SendTransactionError`
*/
try {
	await closeAccount(
		connection,
		payer,
		mintKeypair.publicKey,
		payer.publicKey,
		payer,
		[],
		{ commitment: 'finalized' },
		TOKEN_2022_PROGRAM_ID
	)
} catch (e) {
	console.log(
		'Close account fails here because the supply is not zero. Check the program logs:',
		(e as any).logs,
		'\n\n'
	)
}
```
Now we can run `npm start`. We will see that the program throws an error along with the program logs. The error displayed will be `Close account fails here because the supply is not zero.` meaning that the extension is enforcing that the supply must be zero before closing.

### 4.3 Burning the supply

Now we will burn the supply of the mint to bring the supply back to zero.

```ts
// previous code
const sourceAccountInfo = await getAccount(
	connection,
	sourceAccount,
	'finalized',
	TOKEN_2022_PROGRAM_ID
)

console.log('Burning the supply...')
const burnSignature = await burn(
	connection,
	payer,
	sourceAccount,
	mintKeypair.publicKey,
	sourceKeypair,
	sourceAccountInfo.amount,
	[],
	{ commitment: 'finalized' },
	TOKEN_2022_PROGRAM_ID
)
```
In the next section we will be logging out the account information of the mint to ensure that the tokens have been burned. 

### 4.4 Close the mint
With no tokens in circulation, we can now close the mint. 

Let's review the following steps outlined in the rest of the script:

	- Retrieve Mint Information: Initially, we fetch and inspect the mint's details, particularly focusing on the supply, which should be zero at this stage. This ensures that the mint is eligible to be closed.

	- Verify Account Status: Next, we confirm the status of the account to ensure that it is still open and active. This check is crucial before proceeding with any closure operations.

	- Close the Account: Once we've verified the account's open status, we proceed to close the mint account.

	- Confirm Closure: Finally, after invoking the `closeAccount` function, we check the account status once more to confirm that it has indeed been closed successfully.

These steps help ensure that the process of closing a mint account is handled correctly and that all necessary conditions are met before the account is permanently deactivated.

```ts
// previous code
/**
 * Try closing the mint account when supply is 0
*/
try {
	const mintInfo = await getMint(
		connection,
		mintKeypair.publicKey,
		'finalized',
		TOKEN_2022_PROGRAM_ID
	)

	console.log("After burn supply: ", mintInfo.supply)
	let accountInfo = await connection.getAccountInfo(mintKeypair.publicKey, 'finalized');
	console.log("Account closed? ", accountInfo === null)
	console.log('Closing account after burning the supply...')
	const closeSignature = await closeAccount(
		connection,
		payer,
		mintKeypair.publicKey,
		payer.publicKey,
		payer,
		[],
		{ commitment: 'finalized' },
		TOKEN_2022_PROGRAM_ID
	)

	accountInfo = await connection.getAccountInfo(mintKeypair.publicKey, 'finalized');

	console.log("Account closed? ", accountInfo === null)
} catch (e) {
	console.log(e)
}
```
Run `npm start` once more. It'll display what's happening with the mint's supply before and after we burn it, and also let you know if the account is still open before we close it and confirm it's closed afterwards.

That's it! We have successfully created a mint with close authority. If you get stuck at any point, you can find working code in the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-lab-close-mint-account.git).

# Challenge
For the challenge, try and create your own mint and mint to several token accounts, then create a script to burn all of those token accounts, then close the mint.
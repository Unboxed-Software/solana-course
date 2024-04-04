---
title: Non-Transferable Token
objectives:
 - Create non-transferable token
 - Mint a non-transferable token
 - Attempt to transfer the non-transferable token
---

# Summary

- In the Token program, creating exclusively owned tokens was not possible
- The Token Extension Program allows creating tokens which cannot be transferred

# Overview

In the Token Program, it was impossible to create an exclusively owned mint. The Token Extension Program has a `NonTransferable` extension which can be used to create non-transferable mints. It allows for the generation of tokens that are non-transferable, facilitating the development of "soul-bound" tokens that are permanently associated with a single individual. 

Imagine you want to award your users with a unique achievement, distribute pre-order tokens for a product or service, or verify student accomplishments in an online educational platform. By leveraging non-transferable tokens for these purposes, you can ensure that each token remains permanently linked to its original recipient.

Or in the context of education, for instance, universities and online courses can issue soulbound tokens as digital diplomas or course completion certificates. This not only streamlines the verification process for employers but also significantly reduces the potential for fraudulent claims of educational achievements. 

Concluding, the Token Extension Program's **`NonTransferable`** extension revolutionizes the digital landscape by introducing the capacity to create mints that generate non-transferable, or "soul-bound," tokens. These tokens are uniquely tailored to forge an indelible link between the digital asset and its owner, opening a realm of possibilities across various sectors.

## Creating non-transferable mint account

Initializing a non-transferable mint involves three instruction:

- `SystemProgram.createAccount`
- `createInitializeNonTransferableMintInstruction`
- `createInitializeMintInstruction`

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

When the transaction with these three instructions is sent, a new mint account is created with the non-transferable token extension.

# Lab

In this lab, we will create a non-transferable token and attempt to transfer it to another account.

### 1. Getting started

To get started, clone the lab and change branches to `starter`.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-non-transferable-token.git
cd solana-lab-non-transferable-token
git checkout starter
npm install
```

The starter code comes with following file:

- `index.ts`

`index.ts` has a main function that creates a connection to the specified cluster and calls `initializeKeypair`. This main function is where we'll end up calling the rest of our script once we've written it.

### 2. Run validator node

For the sake of this guide, we will be running our own validator node. We do this because sometimes testnet or devnets on Solana can become congested and in turn less reliable.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is `http://127.0.0.1:8899`. We then use that in the connection to specify to use the local RPC URL.

```tsx
const connection = new Connection("http://127.0.0.1:8899", 'confirmed');
```

Alternatively, if you’d like to use testnet or devnet, import the `clusterApiUrl` from `@solana/web3.js` and pass it to the connection as such:

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

### 3. Create a non-transferable mint

We are now going to create the function `createNonTransferableMint` in a new file `src/create-mint.ts`.

Inside the file, create the function `createNonTransferableMint` with the following arguments:

- `connection` : The connection object
- `payer` : Payer for the transaction
- `mintKeypair` : Keypair for new mint
- `decimals` : Mint decimals

```tsx
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
  createInitializeNonTransferableMintInstruction,
} from '@solana/spl-token'

export async function createNonTransferableMint(
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

  const signature = await sendAndConfirmTransaction(
    connection,
    mintTransaction,
    [payer, mintKeypair],
    { commitment: 'finalized' }
  )

  return signature
}
```

Now let's invoke this function in `src/index.ts` to create the non-transferable mint:

```tsx
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { initializeKeypair } from '@solana-developers/helpers'
import dotenv from 'dotenv'
import { createNonTransferableMint } from './create-mint';
import { createAccount, mintTo, TOKEN_2022_PROGRAM_ID, transferChecked } from '@solana/spl-token';
dotenv.config();

(async () => {
	// previous code

	/**
	 * Creating a non-transferable token mint
	 */
	const decimals = 9

	await createNonTransferableMint(
		connection,
		payer,
		mintKeypair,
		decimals
	)
})();
```

The non-transferable mint has been set up correctly and will be created when we run `npm start`. Let’s move on to the next step and create a source account and mint a token to it.

### 4. Mint token

In `src/index.ts`, we will create a source account and mint one non-transferable token. 

```tsx
(async () => {
	// previous code

	/**
	 * Create a source account and mint 1 token to that account
	 */
	console.log('Creating a source account...')
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

	console.log('Minting 1 token...')
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
	);
	const tokenBalance = await connection.getTokenAccountBalance(sourceAccount, 'finalized');

	console.log(`Account ${sourceAccount.toBase58()} now has ${tokenBalance.value.uiAmount} token.`);
})();
```

Run `npm start`. When you run the executable you should see the account address and token amount, similar to this: `Account GDS3HX16WCzSs3z2ehYA9L8tu7hwdbQZCjFVnM3gxTB1 now has 1 token.`

This indicates to use that the non-transferable token has been minted to our source account and we can move on to the next section and attempt to transfer it to another account.

### 5. Attempt to transfer a non-tranferable token

In `src/index.ts`, we will create a destination account and try to transfer the non-transferable token to this account.

```tsx
(async () => {
	// previous code

	/**
	 * Creating a destination account for a transfer
	 */
	console.log('Creating a destination account...\\n\\n')
	const destinationKeypair = Keypair.generate()
	const destinationAccount = await createAccount(
		connection,
		payer,
		mintKeypair.publicKey,
		destinationKeypair.publicKey,
		undefined,
		{ commitment: 'finalized' },
		TOKEN_2022_PROGRAM_ID
	)
})();
```

Now we will try and transfer the non-transferable token from the source account to the destination account. This call will fail and throw `SendTransactionError`.

```tsx
(async () => {
	// previous code

	/**
	 * Trying transferring 1 token from source account to destination account.
	 *
	 * Should throw `SendTransactionError`
	 */
	console.log('Attempting to transfer non-transferable mint...')
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
			{ commitment: 'finalized' },
			TOKEN_2022_PROGRAM_ID
		)

	} catch (e) {
		console.log(
			'This transfer is failing because the mint is non-transferable. Check out the program logs: ',
			(e as any).logs,
			'\\n\\n'
		)
	}
})();
```

Now run `npm start`. We should see the console log of transaction failure along with program logs.

Take a look at the following logs. Take note of line that says `Transfer is disabled for this mint`. This is indicating that the token we are attempting to transfer is in fact non-transferable!

```bash
Attempting to transfer non-transferable mint...
This transfer is failing because the mint is non-transferable. Check out the program logs:  [
  'Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb invoke [1]',
  'Program log: Instruction: TransferChecked',
  'Program log: Transfer is disabled for this mint',
  'Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb consumed 3910 of 200000 compute units',
  'Program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb failed: custom program error: 0x25'
] 
```

That's it! We have successfully created a non-transferable mint. If you are stuck at any point, you can find the working code on the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-lab-non-transferable-token.git).

# Challenge

For the challenge, create your own non-transferable token with the metadata extension and keep a “soulbound” NFT to yourself.
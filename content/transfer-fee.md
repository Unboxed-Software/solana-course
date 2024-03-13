---
title: Create Transfer Fee Configured Mint
objectives:
- Create transfer fee configured mint
- Transfer tokens of that mint
- Collect fees for the transfer
---

# Summary
 - Token program did not allow assessing fees on transfers.
 - Token Extension Program enforces transfer fees on recipient accounts. 
 - Some tokens are withheld on the recipient account. These withheld tokens cannot be used by the recipient in any way. 
 - Withheld tokens can be withdrawn directly from the recipient accounts or can be harvested back to the mint and then withdrawn.

# Overview
Suppose, you have designed a skin for an equipment in a game. And every time someone trades your skin, you want to be paid some amount as a fee. How can you do that? Transfer fees!

Before the Token Extension program, it was impossible to assess a fee on every transfer. The process involved freezing user accounts and forcing them to go through a third party to unfreeze, transfer and refreeze the accounts.

With thge Token Extension program, it is possible to configure a transfer fee on a mint so that fees are assessed at the protocol level. On every transfer, some amount is withheld on the recipient account which cannot be used by the recipient. These tokens can be withheld by a separate authority on the mint.

Configuring a mint with a transfer fee involves some important fields:
 - Fee basis points: This is the fee assessed on every transfer. For example, if 1000 tokens with 50 basis points are transferred, it will yield 5 tokens.
 - Maximum fee: The cap on transfer fees. With a maximum fee of 5000 tokens, a transfer of 10,000,000,000,000 tokens will only yield 5000 tokens.
 - Transfer fee authority:  The entity that can modify the fees.
 - Withdraw withheld authority: The entity that can move tokens withheld on the mint or token accounts.

## Calculating fee basis points
A basis point is a unit of measurement used in finance to describe the percentage change in the value or rate of a financial instrument. One basis point is equivalent to 0.01% or 0.0001 in decimal form.

If ***t*** is the token amount to be transferred and ***f*** is the fee basis points, then ***Fee*** is calculated as:

$$ Fee = {t * f \over 10000} $$

The constant 10,000 is used to convert the fee basis point percentage to the equivalent amount.

## Configuring a mint with a transfer fee
Configuring a mint with a transfer fee extension involves three important instructions:
 - Create account: Creating the account, including allocating space, transfering lamports for rent, and assigning it's owning program.
 - Initializing transfer fee configuration: Configuring the transfer fee with the transfer fee authority, withdraw withheld authority, fee basis points, and maximum fee.
 - Initializing mint: Initialize the mint with the transfer fee configuration.

*Important note*: Transferring tokens with a transfer fee requires using `transfer_checked` or `transfer_checked_with_fee` instead of `transfer`. Otherwise, the transfer will fail.

TODO 
The `spl-token` package provides the `ExtensionType` enum which has all the extensions. We can specify multiple extensions at a time, but for this lab we will go with just the `TransferFeeConfig` extension.

## Collecting fees
Depending on the use case, the fees can be credited to the mint authority or we can create a dedicated account for collecting fees called a "fee vault".

We can collect fees in two ways. The first approach involves fetching all the accounts that have withheld tokens for our mint and withdraw the fees to either the mint authority or the fee valut. 
```ts
const accounts = await connection.getProgramAccounts(
	TOKEN_2022_PROGRAM_ID,
	{
		commitment: 'finalized',
		filters: [
			{
				memcmp: {
					offset: 0,
					bytes: mint.toString(),
				},
			},
		],
	}
)

const accountsToWithdrawFrom = []
for (const accountInfo of accounts) {
	const unpackedAccount = unpackAccount(
		accountInfo.pubkey,
		accountInfo.account,
		TOKEN_2022_PROGRAM_ID
	)

	const transferFeeAmount = getTransferFeeAmount(unpackedAccount)
	if (
		transferFeeAmount != null &&
		transferFeeAmount.withheldAmount > BigInt(0)
	) {
		accountsToWithdrawFrom.push(accountInfo.pubkey)
	}
}

await withdrawWithheldTokensFromAccounts(
	connection,
	payer,
	mint,
	feeVaultAccount,
	payer.publicKey,
	[],
	accountsToWithdrawFrom,
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)
```

The second approach collects fees immediately after the transaction. This process is called "harvesting". We harvest the fees back to the mint and then withdraw it from the mint to the desired account.
```ts
await harvestWithheldTokensToMint(
	connection,
	payer,
	mint,
	[recipientAccount],
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)

await withdrawWithheldTokensFromMint(
	connection,
	payer,
	mint,
	feeVaultAccount,
	payer.publicKey,
	[],
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)
```

# Lab

To show off the functionality of the transfer fee extension, we are going to create a transfer fee configured mint. Then we'll transfer, collect fees and show the results.

### 1. Getting started
To get started, clone [this repository's](https://github.com/Unboxed-Software/solana-lab-transfer-fee.git) `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-transfer-fee.git
cd solana-lab-transfer-fee
git checkout starter
npm install
```

The starter code comes with following files:
 - `keypair-helpers.ts`
 - `index.ts`

The `keypair-helpers.ts` file contains some boilerplate for generating a new keypair and airdropping test SOL if needed.

Lastly, `index.ts` has a main function that creates a connection to the specified cluster and calls `initializeKeypair`. This `main` function is where we'll be writing our script.

### 2. Create a mint with transfer fee

We're now going to create a function `createMintWithTransferFee` in a new file `src/create-mint.ts`.

When creating a mint with a transfer fee, we need to create 3 instructions and then process them in a transaction: `SystemProgram.createAccount`, `createInitializeTransferFeeConfigInstruction`, `createInitializeMintInstruction`.

The first instruction `SystemProgram.createAccount`, allocates space on the blockchain for the mint account. This instruction accomplishes three things:
 - Allocate `space`
 - Transfer `lamports` for rent
 - Assign to it's owning program

The second instruction `createInitializeTransferFeeConfigInstruction` initializes the transfer fee extension.

The third instruction `createInitializeMintInstruction` initializes the mint.

When the transaction is sent, a new mint account is created with the specified transfer fee configuration.

Create function `createMintWithTransferFee` in `src/create-mint.ts` which should take following arguments:
 - `cluster` : The cluster to which connection is pointing to
 - `connection` : The connection object
 - `payer` : Payer for the transaction
 - `mintKeypair` : Keypair for the new mint
 - `decimals` : Mint decimals
 - `feeBasisPoints` : Fee basis points for the transfer fee
 - `maxFee` : Maximum fee points for the transfer fee


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
	createInitializeTransferFeeConfigInstruction,
} from '@solana/spl-token'

export async function createMintWithTransferFee(
	cluster: Cluster,
	connection: Connection,
	payer: Keypair,
	mintKeypair: Keypair,
	decimals: number,
	feeBasisPoints: number,
	maxFee: bigint
): Promise<TransactionSignature> {
	const extensions = [ExtensionType.TransferFeeConfig]
	const mintLength = getMintLen(extensions)

	const mintLamports =
		await connection.getMinimumBalanceForRentExemption(mintLength)

	console.log('Creating a transaction with transfer fee instruction...')
	const mintTransaction = new Transaction().add(
		SystemProgram.createAccount({
			fromPubkey: payer.publicKey,
			newAccountPubkey: mintKeypair.publicKey,
			space: mintLength,
			lamports: mintLamports,
			programId: TOKEN_2022_PROGRAM_ID,
		}),
		createInitializeTransferFeeConfigInstruction(
			mintKeypair.publicKey,
			payer.publicKey,
			payer.publicKey,
			feeBasisPoints,
			maxFee,
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
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${cluster}`
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
import {createMintWithTransferFee} from './create-mint'
import {
	TOKEN_2022_PROGRAM_ID,
	createAccount,
	createAssociatedTokenAccount,
	getTransferFeeAmount,
	harvestWithheldTokensToMint,
	mintTo,
	transferCheckedWithFee,
	unpackAccount,
	withdrawWithheldTokensFromAccounts,
	withdrawWithheldTokensFromMint,
} from '@solana/spl-token'

const CLUSTER: Cluster = 'devnet'

async function main(){
	...

	// CREATE MINT WITH TRANSFER FEE
	const decimals = 9
	const feeBasisPoints = 50
	const maxFee = BigInt(5000)

	await createMintWithTransferFee(
		CLUSTER,
		connection,
		payer,
		mintKeypair,
		decimals,
		feeBasisPoints,
		maxFee
	)
}
```

Now we can run `npm run start`. We should see a console log of a link which will take us to the mint creation transaction on Solana Explorer.


### 4. Create a fee vault account

Transfer fees are paid by the recipient of the mint. We need an account to collect the transfer fees. Depending on the use case, this could be mint authority account or we could have a dedicated fee vault account for centralized fee collection.

For this lab, let's create a dedicated fee vault account.
```ts
async function main(){
	...

	// CREATE FEE VAULT ACCOUNT
	console.log('\nCreating a fee vault account...')
	const feeVaultKeypair = Keypair.generate()
	const feeVaultAccount = await createAssociatedTokenAccount(
		connection,
		payer,
		mintKeypair.publicKey,
		feeVaultKeypair.publicKey,
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)
	var balance = await (
		await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
	).value.amount
	console.log('Current fee vault balance: ' + balance + '\n\n')
}
```

Now we can run `npm start`. We should see the fee vault account created with zero balance.

### 5. Create a source account and mint 1 token
Now, let's create an account and mint 1 token to that account. The account will act as the source for the transfer transaction.
```ts
async function main(){
	...
	
	// CREATE A SOURCE ACCOUNT AND MINT TOKEN
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

Now we can run `npm start`. At this point, we have a successfully created a source account and minted 1 token to it.

### 6. Create a destination account
Now, let's create a destination account for the transfer. This account will act as the recipient of the transfer account. The transfer fees are collected from this destination account.
```ts
async function main(){
	...
	
	// CREATE DESTINATION ACCOUNT
	console.log('Creating a destination account...\n\n')
	const destinationKeypair = Keypair.generate()
	const destinationAccount = await createAccount(
		connection,
		payer,
		mint,
		destinationKeypair.publicKey,
		undefined,
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)
}
```
Now we can run `npm start`. At this point, we have successfully created the destination account for our transfer.

### 7. Transfer the token
In this step, we calculate the transfer fees based on the transfer amount using fee basis points. Remember, if the transfer fees crosses the max fee cap set while creating the mint, we can only collect fees up to the max cap amount.
```ts
async function main(){
	...

	// TRANSFER TOKENS
	console.log('Transferring with fee transaction...')
	const transferAmount = BigInt(1_000_000)
	const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000)
	var signature = await transferCheckedWithFee(
		connection,
		payer,
		sourceAccount,
		mint,
		destinationAccount,
		sourceKeypair.publicKey,
		transferAmount,
		decimals,
		fee,
		[sourceKeypair, destinationKeypair],
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)
	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER} \n\n`
	)
}
```
Now we can run `npm run start`. We should see a console log of a link which will take us to the transfer transaction on Solana Explorer.

### 8. Withdrawing fees
There are two ways in which we can collect fees from the recipient's account. The first one is withdrawing the withheld fees directly from the recipient's account itself to the fee vault account. The second way is harvesting the fees from the recipient's account to the mint and then withdrawing it from the mint to the fee vault account.

### 8.1 Withdraw fees directly from the recipient accounts
Suppose there have been multiple transactions on this mint with multiple recipients and we want to collect the fees all at once. To achieve this, we can use this way to batch collect the fees from all the accounts. 

First, we fetch all the accounts which have withheld tokens. To do this, we can call the `getProgramAccounts` function. There might be a case where the recipient's account is involved in multiple transactions which involve different transfer fee configured mints. We will use the mint address to filter these accounts so that we only fetch those accounts which received our transfer fee configured mint.
```ts
async function main(){
	...

	// FETCH ACCOUNTS WITH WITHHELD TOKENS
	console.log('Getting all accounts to withdraw from...')
	const accounts = await connection.getProgramAccounts(
		TOKEN_2022_PROGRAM_ID,
		{
			commitment: 'finalized',
			filters: [
				{
					memcmp: {
						offset: 0,
						bytes: mint.toString(),
					},
				},
			],
		}
	)

	const accountsToWithdrawFrom = []
	for (const accountInfo of accounts) {
		const unpackedAccount = unpackAccount(
			accountInfo.pubkey,
			accountInfo.account,
			TOKEN_2022_PROGRAM_ID
		)

		const transferFeeAmount = getTransferFeeAmount(unpackedAccount)
		if (
			transferFeeAmount != null &&
			transferFeeAmount.withheldAmount > BigInt(0)
		) {
			accountsToWithdrawFrom.push(accountInfo.pubkey)
		}
	}
}
```

Now that we have the accounts which received our mint, we can call the `withdrawWithheldTokensFromAccounts` function to withdraw the withheld tokens to out fee vault account.
```ts
async function main(){
	...

	// WITHDRAW WITHHELD TOKENS
	console.log('Withdrawing withheld tokens...')
	signature = await withdrawWithheldTokensFromAccounts(
		connection,
		payer,
		mint,
		feeVaultAccount,
		payer.publicKey,
		[],
		accountsToWithdrawFrom,
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)

	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER} \n\n`
	)
}
```

After withdrawing the fees to the fee vault account, let's verify the balance of our fee vault account.
```ts
async function main(){
	...

	// VERIFY UPDATED FEE VAULT BALANCE 
  	balance = (
  		await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
  	).value.amount
  	console.log('Current fee vault balance: ' + balance + '\n\n')
}
```
Now we can run `npm run start`. We should see a console log which shows us the updated balance of the fee vault account.

### 8.2 Harvest and then withdraw
Suppose we want to collect transfer fees immediately after the transaction. In this case, the batch fetching and collecting after every transaction can be inefficient.

So now, we harvest the fees from the destination account to the mint and then withdraw the amount from the mint itself to the fee vault account.

To harvest the fees, we can call the `harvestWithheldTokensToMint` function.
```ts
async function main(){
	...

	// HARVEST WITHHELD TOKENS TO MINT
	console.log('Harvesting withheld tokens...')
	signature = await harvestWithheldTokensToMint(
		connection,
		payer,
		mint,
		[destinationAccount],
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)

	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER} \n\n`
	)
}
```

After harvesting, we can call the `withdrawWithheldTokensFromMint` function to withdraw the amount to the fee vault account.
```ts
async function main(){
	...

	// WITHDRAW HARVESTED TOKENS
	console.log('Withdrawing from mint to fee vault account...')
	signature = await withdrawWithheldTokensFromMint(
		connection,
		payer,
		mint,
		feeVaultAccount,
		payer.publicKey,
		[],
		{commitment: 'finalized'},
		TOKEN_2022_PROGRAM_ID
	)

	console.log(
		`Check the transaction at: https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER} \n\n`
	)
}
```

After withdrawing the fees to the fee vault account, let's verify the balance of our fee vault account.
```ts
async function main(){
	...

	// VERIFY UPDATED FEE VAULT BALANCE
	balance = (
		await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
	).value.amount
	console.log('Current fee vault balance: ' + balance + '\n\n')
}
```
Now we can run `npm run start`. We should see a console log which shows us the updated balance of the fee vault account.

That's it! We have successfully created a mint with transfer fee. If you get stuck at any point, you can find the working code in the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-lab-transfer-fee.git).

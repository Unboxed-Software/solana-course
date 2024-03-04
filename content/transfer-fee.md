# Overview
Explain how it happened before the extension.
Explain
 - fee basis points
 - maximum fee
 - transfer fee authority
 - withdraw withheld authority

# Explain initializing a mint with transfer fee
Explain
 - Create account
 - createInitializeTransferFeeConfigInstruction
 - createInitializeMintInstruction

*Important note*: Transferring tokens with a transfer fee requires using `transfer_checked` or `transfer_checked_with_fee` instead of transfer. Otherwise, the transfer will fail.

# Collecting fees
 - Concept of a fee vault account, could be the user's account or could be a dedicated account

Two ways to collect fees:
 - Withdraw directly from the recipient account to fee vault
 - Harvest to mint and then withdraw to fee vault

# Lab

### 1. Clone
### 2. Helpers
### 3. Create a mint with transfer fee

`spl-token` provides the `ExtensionType` enum which has all the extensions. We can specify multiple extensions at a time, but for this lab we will go with just the `TransferFeeConfig` extension.

When creating a mint, we need to create 3 instructions and them process them in a transaction.

The first instruction is for creating an account for the mint. This instruction involves three steps: 
 - Allocate space
 - Transfer `lamports` for rent
 - Assign to it's owning program

The second instruction is for constructing a transfer fee configuration.

The third instruction is for initializing the mint.

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
```

Send the transaction
```ts
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
```

Now let's call this function in `src/index.ts`
```ts
async function main(){
	...

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

Transfer fees are paid by the recipient of the mint. We need an account to collect the transfer fees. Depending on the use case, this could be the user's account who owns the mint or we could have a dedicated fee vault account for centralized fee collection.

For this lab, let's create a dedicated fee vault account.

```ts
async function main(){
	...
	
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
Now, let's create a destination account for the transfer. This account will act as the recipient of the transfer account. The transfer fees are collected from the recipient account.

```ts
async function main(){
	...
	
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
Now we can run `npm run start`. We should see a console log of a link which will take us to the transfer transaction on Solana Explorer

### 8. Withdrawing fees
There are two ways in which we can collect fees from the recipient's account. The first one is withdrawing the withheld fees directly from the recipient's account itself to the fee vault account. The second way is harvesting the fees from the recipient's account to the mint and then withdrawing it from the mint to the fee vault account.

### 8.1 Withdraw fees directly from the recipient accounts
Suppose there have been multiple transactions on this mint with multiple recipients and we want to collect the fees all at once. To achieve this, we can use this way to batch collect the fees from all the accounts. 

First, we fetch all the accounts which have withheld tokens. To do this, we can call the `getProgramAccounts` function. There might be a case where the recipient's account is involved in multiple transactions which involve different transfer fee enabled mints. We will use the mint address to filter these accounts so that we only fetch those accounts which received our transfer fee enabled mint.
```ts
async function main(){
	...

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

  	balance = (
  		await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
  	).value.amount
  	console.log('Current fee vault balance: ' + balance + '\n\n')
}
```
Now we can run `npm run start`. We should see a console log which shows us the updated balance of the fee vault account.

### 8.2 Harvest and then withdraw
Suppose we want to collect transfer fees immediately after the transaction. In this case, the batch fetching and collecting after every transaction can be inefficient.

So now, we harvest the fees from the recipient's account to the mint and then withdraw the amount from the mint itself to the fee vault account.

To harvest the fees, we can call the `harvestWithheldTokensToMint` function.
```ts
async function main(){
	...

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

	balance = (
		await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
	).value.amount
	console.log('Current fee vault balance: ' + balance + '\n\n')
}
```
Now we can run `npm run start`. We should see a console log which shows us the updated balance of the fee vault account.


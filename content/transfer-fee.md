---
title: Transfer Fee Extension
objectives:
- Create transfer fee configured mint
- Transfer tokens of that mint
- Collect fees for the transfer
---

# Summary
 - The Token Extension Program's `transfer fee` extension allows fees to be withheld on every transfer. These fees are held on the recipient's account, and can only be redeemed from the `withdrawWithheldAuthority` authority
 - Withheld tokens can be withdrawn directly from the recipient accounts or can be harvested back to the mint and then withdrawn
 - Transfers with mints using the `transfer fee` extension need to use the `transferCheckedWithFee` instruction

# Overview

Suppose you're a Solana game developer and you're making a large open world multiplayer role playing game. You'll have a currency in this game that all the players will earn and trade with. To make the economy in the game circular, you may want to charge a small transfer fee every time this currency changes hands, you'd call this the developer tax. This can be accomplished with the `transfer fee` extension. The neat part is this will work on every transfer, in-game and out! 

The Token Extension Program's `transfer fee` extension enables you to configure a transfer fee on a mint such that fees are assessed at the protocol level. On every transfer, some amount of that mint is withheld on the recipient account which cannot be used by the recipient. At any point after the transfer, the `withdraw` authority can claim these withheld tokens.

The `transfer fee` extension is customizable and updatable. Here are the inputs that we'll delve into a bit later:
 - Fee basis points: This is the fee assessed on every transfer. For example, if 1000 tokens with 50 basis points are transferred, it will yield 5 tokens.
 - Maximum fee: The cap on transfer fees. With a maximum fee of 5000 tokens, a transfer of 10,000,000,000,000 tokens will only yield 5000 tokens.
 - Transfer fee authority: The entity that can modify the fees.
 - Withdraw withheld authority: The entity that can move tokens withheld on the mint or token accounts.

## Calculating fee basis points

Before we go into the extension, here's a quick intro to "fee basis points".

A basis point is a unit of measurement used in finance to describe the percentage change in the value or rate of a financial instrument. One basis point is equivalent to 0.01% or 0.0001 in decimal form.

To get the fee we must calculate it as follows:

$$ Fee = {token_amount * fee_basis_points \over 10000} $$

The constant 10,000 is used to convert the fee basis point percentage to the equivalent amount.

## Configuring a mint with a transfer fee

Initializing a mint with the `transfer fee` extension involves three instructions:
- `SystemProgram.createAccount`
- `createInitializeTransferFeeConfigInstruction`
- `createInitializeMintInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. This instruction accomplishes three things:
 - Allocates `space`
 - Transfers `lamports` for rent
 - Assigns to it's owning program

As with all Token Extension Program's mints, we need to calculate the space and lamports needed for the mint. We can get these by calling `getMintLen` and `getMinimumBalanceForRentExemption`

```ts
const extensions = [ExtensionType.TransferFeeConfig]
const mintLength = getMintLen(extensions)

const mintLamports =
	await connection.getMinimumBalanceForRentExemption(mintLength)

const createAccountInstruction = SystemProgram.createAccount({
	fromPubkey: payer.publicKey,
	newAccountPubkey: mintKeypair.publicKey,
	space: mintLength,
	lamports: mintLamports,
	programId: TOKEN_2022_PROGRAM_ID,
})
```

The second instruction `createInitializeTransferFeeConfigInstruction` initializes the transfer fee extension.

It takes the following parameters:
- `mint`: Token mint account
- `transferFeeConfigAuthority`: Optional authority that can update the fees
- `withdrawWithheldAuthority`: Optional authority that can withdraw fees
- `transferFeeBasisPoints`: Amount of transfer collected as fees, expressed as basis points of the transfer amount
- `maximumFee`: Maximum fee assessed on transfers
- `programId`: SPL Token program account

```ts
const initializeTransferFeeConfigInstruction = createInitializeTransferFeeConfigInstruction(
	mintKeypair.publicKey,
	payer.publicKey,
	payer.publicKey,
	feeBasisPoints,
	maxFee,
	TOKEN_2022_PROGRAM_ID
)
```

The third instruction `createInitializeMintInstruction` initializes the mint.

```ts
const initializeMintInstruction = createInitializeMintInstruction(
	mintKeypair.publicKey,
	decimals,
	payer.publicKey,
	null,
	TOKEN_2022_PROGRAM_ID
)
```

Lastly, you need to add all of these instructions to a transaction and send it off the the blockchain.

```ts
const mintTransaction = new Transaction().add(
	createAccountInstruction,
	initializeTransferFeeConfigInstruction,
	initializeMintInstruction
);

const signature = await sendAndConfirmTransaction(
	connection,
	mintTransaction,
	[payer, mintKeypair],
	{commitment: 'finalized'}
)
```

## Transferring mint with transfer fees

When a token with the `transfer fee` extension is transferred, it will take `transferFeeBasisPoints`, up to the `maximumFee` amount of the token being transferred and store it on the recipient's wallet in the `withheld` section. This can only be redeemed by the `withdrawWithheldAuthority`. We'll talk about redeeming soon. But first, why not just automatically transfer the transfer fee right to it's final destination? Put simply, it doesn't do that to avoid bottlenecks.

Say you have a very popular token with `transfer fee` enabled and your wallet is the recipient of the fees. If thousands of people are trying to transact the token simultaneously, they'll all have to update your wallet's balance - your wallet has to be "writable". While it's true Solana can execute in parallel, it cannot execute in parallel when there is a shared account being written to. So, these thousands of people would have to wait in line, slowing down the transfer drastically. This is solved by setting aside the `withheld` transfer fees within the recipient's account - this way, only the sender and receiver's wallets are writable. Then the `withdrawWithheldAuthority` can withdraw at anytime after!

With the bottleneck explained, let's look at what it actually takes to transfer a token with `transfer fee` enabled. For most tokens, you'd just use the `transfer` method. However, there is a caveat using the `transfer fee` extension: You need to use either `transfer_checked` or `transfer_checked_with_fee`, not `transfer`. 

The `transfer` method lacks the necessary logic to handle fees, leading to transaction failure. Additionally, `transfer_checked` ensures the correctness of mint accounts and decimals, crucial for maintaining transaction integrity and preventing errors in token type and amount.

```ts
/**
 * Transfer tokens from one account to another, asserting the transfer fee, token mint, and decimals
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param source         Source account
 * @param mint           Mint for the account
 * @param destination    Destination account
 * @param owner          Owner of the source account
 * @param amount         Number of tokens to transfer
 * @param decimals       Number of decimals in transfer amount
 * @param multiSigners   Signing accounts if `owner` is a multisig
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
export async function transferCheckedWithFee(
    connection: Connection,
    payer: Signer,
    source: PublicKey,
    mint: PublicKey,
    destination: PublicKey,
    owner: Signer | PublicKey,
    amount: bigint,
    decimals: number,
    fee: bigint,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID
): Promise<TransactionSignature>
```

## Collecting fees

There are two ways to "collect fees" from the withheld portion of the token accounts.

1. The `withdrawWithheldAuthority` can withdraw directly from the withheld portion of a user's token account into any "token vault"
2. We can "harvest" the withheld tokens and store them within the mint account itself, which can be withdrawn at any point from the `withdrawWithheldAuthority`

If we want to withdraw all withheld transfer fees from all token accounts directly we can do the following:

1. Grab all token accounts associated with the mint using `getProgramAccounts`
2. Add all token accounts with some withheld tokens to a list
3. Call the `withdrawWithheldTokensFromAccounts` function (the `authority` needs to be a signer)

```ts
// grabs all of the token accounts for a given mint
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

	// If there is withheld tokens add it to our list
	const transferFeeAmount = getTransferFeeAmount(unpackedAccount)
	if (
		transferFeeAmount != null &&
		transferFeeAmount.withheldAmount > BigInt(0)
	) {
		accountsToWithdrawFrom.push(accountInfo.pubkey)
	}
}

/**
 * Withdraw withheld tokens from accounts
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param mint           The token mint
 * @param destination    The destination account
 * @param authority      The mint's withdraw withheld tokens authority
 * @param multiSigners   Signing accounts if `owner` is a multisig
 * @param sources        Source accounts from which to withdraw withheld fees
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
await withdrawWithheldTokensFromAccounts(
	connection,
	payer,
	mint,
	feeVaultAccount,
	authority,
	[],
	accountsToWithdrawFrom,
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)
```

The second approach we call "harvesting" - this is a permissionless function meaning anyone can call it. This approach is great for "cranking" the harvest instruction with tools like [clockwork](https://www.clockwork.xyz/). The difference is when we harvest, the withheld tokens get stored in the mint itself. Then the `withdrawWithheldAuthority` can withdraw the tokens from the mint at any point.

To harvest:
1. gather all of the accounts you want to harvest from (same flow as above)
2. call `harvestWithheldTokensToMint`
3. To withdraw from the mint, call `withdrawWithheldTokensFromMint`

```ts
/**
 * Harvest withheld tokens from accounts to the mint
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param mint           The token mint
 * @param sources        Source accounts from which to withdraw withheld fees
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
await harvestWithheldTokensToMint(
	connection,
	payer,
	mint,
	accountsToHarvestFrom,
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)

/**
 * Withdraw withheld tokens from mint
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param mint           The token mint
 * @param destination    The destination account
 * @param authority      The mint's withdraw withheld tokens authority
 * @param multiSigners   Signing accounts if `owner` is a multisig
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
await withdrawWithheldTokensFromMint(
	connection,
	payer,
	mint,
	feeVaultAccount,
	authority,
	[],
	{commitment: 'finalized'},
	TOKEN_2022_PROGRAM_ID
)
```

### Updating Fee

As of right now there is no way to set the transfer fee post [creation with the JS library](https://solana.stackexchange.com/questions/7775/spl-token-2022-how-to-modify-transfer-fee-configuration-for-an-existing-mint). However you can from the CLI assuming the result of `solana config` wallet is the `transferFeeConfigAuthority`:

```bash
solana address
# The result of ^ needs to be the `transferFeeConfigAuthority`
spl-token set-transfer-fee <MINT_ID> <FEE_IN_BASIS_POINTS> <MAX_FEE>
```


# Lab

In this lab, we are going to create a transfer fee configured mint. We'll use a fee vault to hold the transfer fees, and we'll collect the fees using both the direct and the harvesting methods.

### 1. Getting started
To get started, clone [this repository's](https://github.com/Unboxed-Software/solana-lab-transfer-fee.git) `starter` branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-transfer-fee.git
cd solana-lab-transfer-fee
git checkout starter
npm install
```

The starter code comes with following file:
 - `index.ts`

`index.ts` has a main function that creates a connection to the specified cluster and calls `initializeKeypair`. This `main` function is where we'll be writing our script.

### 2. Run validator node

For the sake of this guide, we'll be running our own validator node.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is `http://127.0.0.1:8899`. We then use that in the connection to specify to use the local RPC URL.

```tsx
const connection = new Connection("http://127.0.0.1:8899", "confirmed");
```

Alternatively, if you’d like to use testnet or devnet, import the `clusterApiUrl` from `@solana/web3.js` and pass it to the connection as such:

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

If you decide to use devnet, and have issues with airdropping SOL. Feel free to add the `keypairPath` parameter to `initializeKeypair`. You can get this from running `solana config get` in your terminal. And then go to [faucet.solana.com](https://faucet.solana.com/) and airdrop some sol to your address. You can get your address from running `solana address` in your terminal.

### 3. Create a mint with transfer fee

We're now going to create a function `createMintWithTransferFee` in a new file `src/create-mint.ts`.

When creating a mint with transfer fee, we need three instructions: `SystemProgram.createAccount`, `createInitializeTransferFeeConfigInstruction` and `createInitializeMintInstruction`.

Add `createMintWithTransferFee` with following arguments:
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
  console.log('Transaction sent')

	return signature
}
```

Now let's call this function in `src/index.ts`

```ts
import {
	Connection,
	Keypair,
	LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import { initializeKeypair } from '@solana-developers/helpers'
import { createMintWithTransferFee } from './create-mint'
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

// CREATE MINT WITH TRANSFER FEE
const decimals = 9
const feeBasisPoints = 50
const maxFee = BigInt(5000)

await createMintWithTransferFee(
  connection,
  payer,
  mintKeypair,
  decimals,
  feeBasisPoints,
  maxFee
)
```

Now we can run `npm start` which will create the mint.

### 4. Create a fee vault account

Transfer fees are paid by the recipient of the mint. We need an account to collect the transfer fees. Depending on the use case, this could be mint authority account or a dedicated fee vault account for centralized fee collection.

For this lab, let's create a dedicated fee vault account.

```ts
// previous code

// CREATE FEE VAULT ACCOUNT
console.log('\nCreating a fee vault account...')
const feeVaultKeypair = Keypair.generate()
const feeVaultAccount = await createAssociatedTokenAccount(
  connection,
  payer,
  mintKeypair.publicKey,
  feeVaultKeypair.publicKey,
  { commitment: 'finalized' },
  TOKEN_2022_PROGRAM_ID
)
let balance = (
  await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
).value.amount
console.log('Current fee vault balance: ' + balance + '\n\n')
```

Now we can run `npm start`. We should see the fee vault account created with zero balance.

### 5. Create a source account and mint one token
Now, let's create an account and mint one token to it. The account will act as the source for the transfer transaction.

```ts
// previous code

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
  { commitment: 'finalized' },
  TOKEN_2022_PROGRAM_ID
)
```

Now we can run `npm start`. At this point, we have a successfully created a source account and minted a single token to it.

### 6. Transfer one token
Next, let's create a destination account for the transfer. This account will act as the recipient of the transfer. As the recipient of the transfer, the destination account will pay the transfer fee.

```ts
// previous code

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
```

We will now calculate the transfer fees based on the transfer amount using fee basis points. Remember, if the transfer fee crosses the max fee cap set while creating the mint, we can only collect fees up to the max cap amount.

```ts
// previous code

// TRANSFER TOKENS
console.log('Transferring with fee transaction...')
const transferAmount = BigInt(1_000_000)
const fee = (transferAmount * BigInt(feeBasisPoints)) / BigInt(10_000)
let signature = await transferCheckedWithFee(
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
  { commitment: 'finalized' },
  TOKEN_2022_PROGRAM_ID
)
```
Now we can run `npm start`.

### 7. Withdrawing fees
There are two ways in which we can collect fees from the recipient's account into the fee vault. The first one is withdrawing the withheld fees directly from the recipient's account itself to the fee vault account. The second approach is harvesting the fees from the recipient's account to the mint and then withdrawing it from the mint to the fee vault account.

### 7.1 Withdraw fees directly from the recipient accounts
Suppose there have been multiple transactions on this mint with multiple recipients and we want to collect the fees all at once. To achieve this we can batch collect the fees from all the accounts. 

First, we fetch all the accounts which have withheld tokens. To do this, we can call the `getProgramAccounts` function. One of the parameters for the `getProgramAccounts` function is an array of `filters`. We will use the mint address to filter these accounts so that we only fetch those accounts which received our transfer fee configured mint.

```ts
// previous code

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
```

Now that we have the accounts which received our mint, we can call the `withdrawWithheldTokensFromAccounts` function to withdraw the withheld tokens to our fee vault account.

```ts
// previous code

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
```

After withdrawing the fees to the fee vault account, let's verify the balance of our fee vault account.

```ts
// previous code

// VERIFY UPDATED FEE VAULT BALANCE 
  balance = (
    await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
  ).value.amount
  console.log('Current fee vault balance: ' + balance + '\n\n')
```
Now we can run `npm start`. This will show us the updated balance of the fee vault account.

### 7.2 Harvest and then withdraw
Suppose we want to collect transfer fees immediately after the transaction. In this case, the batch fetching and collecting after every transaction can be inefficient.

Instead we harvest the fees from the destination account to the mint and then withdraw the amount from the mint itself to the fee vault account.

To harvest the fees, we can call the `harvestWithheldTokensToMint` function.
```ts
// previous code

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
```

After harvesting, we can call the `withdrawWithheldTokensFromMint` function to withdraw the amount to the fee vault account.
```ts
// previous code

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
```

After withdrawing the fees to the fee vault account, let's verify the balance of our fee vault account.
```ts
// previous code

// VERIFY UPDATED FEE VAULT BALANCE
balance = (
  await connection.getTokenAccountBalance(feeVaultAccount, 'finalized')
).value.amount
console.log('Current fee vault balance: ' + balance + '\n\n')
```
Now we can run `npm start`. We should see a log which shows us the updated balance of the fee vault account.

That's it! We have successfully created a mint with a transfer fee. If you get stuck at any point, you can find the working code in the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-lab-transfer-fee.git).

### Challenge
Now that we know how to create a transfer fee enabled mint, it's time for you to try it yourself! Create a transfer fee enabled mint and transfer some tokens. This time, instead of transferring just one token, you can verify the maximum cap on fees by transferring a large number of tokens.
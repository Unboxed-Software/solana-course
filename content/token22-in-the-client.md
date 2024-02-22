# Supporting Token22 from a Client

# Objectives

# TL;DR

# Overview
The Token22 program is a superset of the original token program. Before Token22, developers had to fork the original token program to add new functionality. However, adopting functionality across the whole ecosystem is challenging. Furthermore, Solana's programming model requires programs and accounts be included in transactions, making it complicated to create transactions involving multiple token programs. Token22 has simplified this process by including a set of features called extensions. We will dive deep into extensions in a future lesson. In this lesson, we will go over how to interface with Token22.

The interfaces for both the legacy token program and Token22 token program remain consistent. This allows the use of common `spl-token` helper functions in Token22 by using the approrpiate program ID for either Token22 or the legacy token program. It's crucial to identify the program that owns a token whenever interacting with it. Although developers need to be aware of the token program they're using, most user interfaces will not differentiate between legacy tokens and Token22 tokens, necessitating logic to fetch and merge information from both types for a seamless experience.

## Differences between working with legacy tokens and Token22 tokens

When interacting with mints and tokens, you'll need to point your code to the correct token program. Fortunately, the `spl-token` package makes it easy to do this. It provides both the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` constants and all of its helper functions for creating and minting tokens take a program ID as input.

NOTE: `spl-token` defaults to using the `TOKEN_PROGRAM_ID` unless specified otherwise. Make sure to explicitly pass the `TOKEN_2022_PROGRAM_ID` for all function calls related to Token22, otherwise you will get the following error: `TokenInvalidAccountOwnerError`.

## Things to consider when working with both legacy token program and Token22
Although the interfaces for both of these programs remain consistent, these are two different programs. The addresses created by using these programs are different. The program IDs of these programs are not exchangeable under any circumstances. If you want to support both the legacy token and Token22 tokens, you will have to add extra logic on the client side.

## Associated token accounts (ATA)
Let's take a look at what is an associated token account and how it is created.

An associated token account is a token account whose address is created using the wallet's public key and a token mint. This mechanism provides a deterministic way of finding any token account associated with the wallet.

### How to use associated token account in Token22
We can use the Associated Token Account Program to find or create associated token accounts created with the Token22 program ID. 
To achieve this, the `spl-token` provides the `getOrCreateAssociatedTokenAccount` function. This function creates an associated token account for the provided wallet and mint if one doesn't already exist. 

```ts
const tokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mintAddress,
  payer.publicKey,
  true,
  'finalized',
  {commitment: 'finalized'},
  tokenProgramId // TOKEN_PROGRAM_ID for legacy tokens and TOKEN_2022_PROGRAM_ID for Token22 tokens
)
```

For any mint, only one associated token account can exist per user. 

`spl-token` also provides the `ASSOCIATED_TOKEN_PROGRAM_ID` constant which is the program ID for the Associated Token Account Program. If we have access to the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` along with the mint address, we can use the ATA program ID with the wallet's public key to find the associated token account.

```ts
function findAssociatedTokenAddress(
  walletAddress: PublicKey,
  tokenMintAddress: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      walletAddress.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(), // replace TOKEN_PROGRAM_ID with TOKEN_2022_PROGRAM_ID for Token22 tokens
      tokenMintAddress.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}
```

## How to fetch both legacy and Token22 tokens
We may want to fetch all the associated token accounts for a wallet. When we have access to the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`, it is very easy to fetch owned Token Accounts for any wallet.

We can distinguish between legacy tokens and Token22 tokens by using the proper program ID.

```ts
const tokenAccounts = await connection.getTokenAccountsByOwner(
	walletPublicKey,
	{ programId: TOKEN_PROGRAM_ID } // or TOKEN_2022_PROGRAM_ID
)
```

Sometimes, the client doesn't need to distinguish between legacy tokens and Token22 tokens. In that case, we have to call the above function twice, once with `TOKEN_PROGRAM_ID` and once with `TOKEN_2022_PROGRAM_ID` (as mentioned before, these are not exchangeable).

```ts
const allOwnedTokens = []
const legacyTokenAccounts = await connection.getTokenAccountsByOwner(
	wallet.publicKey,
	{programId: TOKEN_PROGRAM_ID}
)
const token22Accounts = await connection.getTokenAccountsByOwner(
	wallet.publicKey,
	{programId: TOKEN_2022_PROGRAM_ID}
)

allOwnedTokens.push(...legacyTokenAccounts, ...token22Accounts)
```

### Check owning program

When it comes to fetching token accounts, you'll need to know the creating program first.

When we don't know whether to use `TOKEN_PROGRAM_ID` or `TOKEN_2022_PROGRAM_ID`, we can fetch the owning program ID for any mint account.

```ts
const accountInfo = await connection.getParsedAccountInfo(mintAddress);
if (accountInfo.value === null) {
  throw new Error('Account not found');
}

const programId = accountInfo.value.owner; // will return TOKEN_PROGRAM_ID for legacy mint address and TOKEN_2022_PROGRAM_ID for Token22 mint address

//we now use the programId to fetch the tokens
const tokenAccounts = await connection.getTokenAccountsByOwner(
  wallet.publicKey,
  {programId}
)
```

## TODO Christian Review Please
NOTE: Depending on the use case, it might not be efficient to always fetch the owning program ID of the mint. In that case, we just have to fetch the owning programs once and then store them somewhere for future use. For example, we can create a local database which will store these program IDs and use them when necessary.

# Lab - Add Token22 support to a script

Now let's work through a holistic example where we add Token22 support to an existing script.

You can work through this lab using either Devnet or a Localnet. Depending on the state of Devnet, it may or may not be easier to just use a local test validator. To do this, run the following command to start the local test validator:

```bash
solana-test-validator
```

Then, in `src/index.ts`, change the connection URL to point to the running validator:
```ts
// ....
const connection = new Connection('http://127.0.0.1:8899') // use the JSON RPC URL as prompted on the console after running the validator
const keyPair = await initializeKeypair(connection)
// ....
```

### 1. Clone the starter code

To get started, clone [this lab's repository](https://github.com/Unboxed-Software/token22-in-the-client/) and checkout the `starter` branch. This branch contains a couple of helper files and some boilerplate code to get you started.

```bash
git clone https://github.com/Unboxed-Software/token22-in-the-client.git
cd token22-in-the-client
git checkout starter
```

Run the following commands to install the dependencies and run the script.
```bash
npm install
npm run start
```

### 2. Get familiar with the starter code

The starter code comes with the following files:
- `keypair-helpers.ts`
- `print-helpers.ts`
- `index.ts`

The `keypair-helpers.ts` file contains some boilerplate for generating a new keypair and airdropping test SOL if needed.

The `print-helpers.ts` file has a function called `printTableData`. This function logs output to the console in a structured fashion. The function simply takes any object and is passed to the `console.table` helper available to NodeJS. This helper prints the information in a tabular form with the object's keys as columns and values as rows.

```ts
import { PublicKey } from '@solana/web3.js'

function printTableData(obj: Object){
	let tableData: any = []

	if (obj instanceof Array) {
		Object.keys(obj).map((key) => {
			let currentValue = (obj as any)[key]

			if (currentValue instanceof Object) {
				Object.keys(currentValue).map((key) => {
					let nestedValue = (currentValue as any)[key]
					if (nestedValue instanceof PublicKey) {
						nestedValue = (nestedValue as PublicKey).toBase58();
						(currentValue as any)[key] = nestedValue
					}
				})
				tableData.push(currentValue)
			}
		})
	} else {
		Object.keys(obj).map((key) => {
			let currentValue = (obj as any)[key]
			if (currentValue instanceof PublicKey) {
				currentValue = (currentValue as PublicKey).toBase58()
				;(obj as any)[key] = currentValue
			}
		})
		tableData.push(obj)
	}

	console.table(tableData);
	console.log();
}

export default printTableData
```

We'll be using the `printTableData` function to print information about tokens and their mints in a readable fashion.

Lastly, `index.ts` has a `main` function that creates a connection to the specified cluster and calls `initializeKeypair`. This `main` function is where we'll end up calling the rest of our script once we've written it.

### 3. Create legacy and Token22 mints

Let's start by creating new token mints using both the legacy token program and the Token22 program. Define a function called `createAndMintToken`. For now, we'll just create the token mint in this function, but in a later step we'll add minting. This function should take the following arguments:
- `cluster` - the cluster you're pointing to (i.e. Devnet vs Localnet)
- `connection` - the connection object to use
- `tokenProgramId` - the token program to point to
- `payer` - the keypair paying for the transaction
- `decimals` - the number of decimals to include for the mint
- `mintAmount` - the amount of tokens to mint to the payer

If you've created a token mint before, the process is similar. The only difference is specifying the specific token program ID.

```ts
async function createAndMintToken(
	cluster: Cluster,
	connection: Connection,
	tokenProgramId: PublicKey,
	payer: Keypair,
	decimals: number,
	mintAmount: number,
): Promise<PublicKey> {

	console.log('\nCreating a new mint...')
	const mint = await createMint(
		connection,
		payer,
		payer.publicKey,
		payer.publicKey,
		decimals,
		undefined,
		{
			commitment: 'finalized', // confirmOptions argument
		},
		tokenProgramId
	)
	console.log(
		`You can view your token in the solana explorer at https://explorer.solana.com/address/${mint.toBase58()}?cluster=${cluster}`
	)

	console.log('\nFetching mint info...')

	const mintInfo = await getMint(
		connection,
		mint,
		'finalized',
		tokenProgramId
	)

	printTableData(mintInfo);

	return mint
}
```

Note that we've added `confirmOptions` argument to the `createMint` call to make sure the function's promise doesn't resolve until the transaction has been finalized. This will avoid errors when we go to mint new tokens.

Lastly, let's add two separate calls to this function from our `main` function. The first will use the legacy token program and the second will use Token22.

```ts
async function main() {
  /**
   * Create a connection and initialize a keypair if one doesn't already exists.
   * If a keypair exists, airdrop a sol if needed.
   */
  const connection = new Connection(clusterApiUrl(CLUSTER))
  const keyPair = await initializeKeypair(connection)

  console.log(`public key: ${keyPair.publicKey.toBase58()}`)

  const legacyMint = await createAndMintToken(
    CLUSTER,
    connection,
    TOKEN_PROGRAM_ID,
    keyPair,
    9,
    1000
  )
  const token22Mint = await createAndMintToken(
    CLUSTER,
    connection,
    TOKEN_2022_PROGRAM_ID,
    keyPair,
    9,
    1000
  )
}
```

At this point you can run `npm run start` and see that both mints get created and their info logged to the console.

### 4. Mint legacy and Token22 tokens

Now we can add minting to our `createAndMintToken` function.

We want the function to mint tokens to the `payer`. In order to to this, we need to create the `payer`'s associated token account. Simply call `getOrCreateAssociatedTokenAccount`, passing the relevant information. Be sure to include the token program ID so that you don't accidentally attempt to create a token account for a mint that doesn't exist.

Once you've created the associated token account, you can call `mintTo`, again passing the correct token program ID.

```ts
async function createAndMintToken(
	cluster: Cluster,
	connection: Connection,
	tokenProgramId: PublicKey,
	payer: Keypair,
	decimals: number,
	mintAmount: number,
): Promise<PublicKey> {
	...

	console.log('\nCreating associated token account...')
	const tokenAccount = await getOrCreateAssociatedTokenAccount(
		connection,
		payer,
		mint,
		payer.publicKey,
		true,
		'finalized',
		{commitment: 'finalized'},
		tokenProgramId
	)

	console.log(`Associated token account: ${tokenAccount.address.toBase58()}`)

	console.log('\nMinting to associated token account...')
	await mintTo(
		connection,
		payer,
		mint,
		tokenAccount.address,
		payer,
		mintAmount,
		[payer],
		{commitment: 'finalized'},
		tokenProgramId
	)

	return mint
}
```

Now you can run `npm run start` again. You'll see that not only are the two token mints created, but the relevant associated token accounts are also created and tokens minted to each.

### 5. Fetch legacy and Token22 tokens with the program ID

We can now fetch tokens using the wallet's public key and the program ID. Create the function `fetchTokenInfo` inside of `fetch-token-info.ts` with the following arguments:
 - `connection` - the connection object to use
 - `wallet` - the wallet which owns the associated token accounts
 - `programId` - the token program to point to
 - `type` - either `Token` or `Token22`; used for console logging purpose

```ts
import { AccountLayout } from "@solana/spl-token"
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"


export type TokenTypeForDisplay = 'Token' | 'Token22';

export interface TokenInfoForDisplay {
  mint: PublicKey
  amount: number
  type: TokenTypeForDisplay
}

export async function fetchTokenInfo(
	connection: Connection,
	wallet: Keypair,
  	programId: PublicKey,
  	type: TokenTypeForDisplay
): Promise<TokenInfoForDisplay[]> {
	const tokenAccounts = await connection.getTokenAccountsByOwner(
		wallet.publicKey,
		{programId}
	)

    const ownedTokens: TokenInfoForDisplay[] = []

	tokenAccounts.value.forEach((tokenAccount) => {
		const accountData = AccountLayout.decode(tokenAccount.account.data)
		ownedTokens.push({
			mint: accountData.mint,
			amount: Number(accountData.amount / BigInt(LAMPORTS_PER_SOL)),
			type,
		})
	})

  return ownedTokens;
}
```

We'll now add two separate calls to this function in `index.ts` to fetch legacy tokens and Token22 tokens.

```ts
async function main() {
  ...
  const myTokens: TokenInfoForDisplay[] = []

	myTokens.push(
		...await fetchTokenInfo(connection, keyPair, TOKEN_PROGRAM_ID, 'Token'),
		...await fetchTokenInfo(connection, keyPair, TOKEN_2022_PROGRAM_ID, 'Token22'),
	)

	printTableData(myTokens)

}
```

Now you can run `npm run start` again. You will see information about both the legacy tokens and the Token22 tokens.

### 6. Fetch legacy and Token22 tokens without the program ID

If you don't have the program ID, we can get it from the mint account. Let's add the function `fetchTokenProgramFromAccount` to `fetch-token-info.ts` and have it take the following arguments:
 - `connection` - the connection object to use
 - `mint` - public key of the mint account

```ts
export async function fetchTokenProgramFromAccount(
  connection: Connection,
  mint: PublicKey
){
  //Find the program ID from the mint
  const accountInfo = await connection.getParsedAccountInfo(mint);
  if (accountInfo.value === null) {
      throw new Error('Account not found');
  }
  const programId = accountInfo.value.owner;
  return programId;
}
```

This function will return the mint account's program ID. This works the same for both Legacy and Token22 mint accounts. Let's use this function in `index.ts` to fetch the tokens.

```ts
async function main(){
  ...
  const legacyMintTokenProgram = await fetchTokenProgramFromAccount(connection, legacyMint);
  const token22MintTokenProgram = await fetchTokenProgramFromAccount(connection, token22Mint);

  if(!legacyMintTokenProgram.equals(TOKEN_PROGRAM_ID)) throw new Error('Legacy mint token program is not correct');
  if(!token22MintTokenProgram.equals(TOKEN_2022_PROGRAM_ID)) throw new Error('Token22 mint token program is not correct');


  //now use this program id to fetch tokens
  const myTokens: TokenInfoForDisplay[] = []

	myTokens.push(
		...await fetchTokenInfo(connection, keyPair, legacyMintTokenProgram, 'Token'),
		...await fetchTokenInfo(connection, keyPair, token22MintTokenProgram, 'Token22'),
	)

	printTableData(myTokens)

}
```

Run `npm run start` again. You will see the same output as in step 5 where you saw the legacy and Token22 tokens owned by the user.

That's it! If you get stuck at any step, you can find the complete code in [this lab's repository's](https://github.com/Unboxed-Software/token22-in-the-client/) `main` branch.

# Challenge
For the challenge, try and implement the burn token functionality for the legacy tokens and the Token22 tokens.



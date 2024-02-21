
# Supporting Token22 from a Client

# Objectives

# TL;DR

# Overview
The Token 2022 program is a superset of the original Token program. It is also known as Token Extensions. We can fork the original token program and add any new functionality required. Although it's simple and easy to change and deploy the program, adoption across the whole ecosystem is a challenge. Also, Solana's programming model requires programs to be included in transactions along with accounts. This makes it complicated to create transactions involving multiple token programs. To solve these challenges, Token 2022 was developed and deployed to a different address than the original Token program. It can be accessed using the `TOKEN_2022_PROGRAM_ID` constant provided by `spl-token`. 

In Solana's token ecosystem, the interfaces for both the legacy token program and Token 2022 token program remain consistent. This allows the use of common `spl-token` helper functions across different token programs by simply swapping the program ID. By default, if no program ID is provided, the functions revert to using the legacy token program. It's crucial to identify the program that owns a token whenever interacting with it. This information should be dynamically retrieved at the point of interaction. There are multiple ways top achieve this. For example, we can create a local database to store metadata about token mints, including the owning program. But in some cases, this might not be feasible. In that case, with the help of `spl-token` helper functions, we can fetch the owning program. We will see how to use those functions shortly. Most user interfaces will not differentiate between legacy tokens and Token22 tokens, necessitating logic to fetch and merge information from both types for a seamless experience.

## Differences between working with legacy tokens and Token22 tokens

When interacting with mints and tokens, the only thing you need to worry about is pointing your code to the correct Token program. If you want to create tokens using the legacy Token program, you need to ensure that you point to that program. If you want to create using the Token22 program you need to ensure that you point to the Token22 program. 

Fortunately, the `spl-token` package makes it easy to do this. It provides both the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` constants and all of its helper functions for creating and minting tokens take a program ID as input.

NOTE: `spl-token` defaults to using the `TOKEN_PROGRAM_ID` unless specified otherwise. Make sure to explicitly pass the `TOKEN_2022_PROGRAM_ID` for all function calls related to Token22, otherwise you will get the following error: `TokenInvalidAccountOwnerError`.

## Things to consider when working with both SPL and Token22
Although the interfaces for both of these programs remain consistent, these are two different programs. The addresses created by using these programs are different. The program IDs of these programs are not exchangeable under any circumstances. If you want to support both the legacy token and Token22 tokens, you will have to add extra logic on the client side.

## Associated Token Accounts (ATA)
Before we move on, let's take a look at what is an Associated Token Account and how it is created.
An Associated Token Account is a Token Account whose address is created using the wallet's public key and a token mint. This mechanism provides a deterministic way of finding any Token Account associated with the wallet.

### How to use Associated Token Accounts in Token22
We can use the Associated Token Account Program to find Associated Token Accounts created with the Token22 program ID. 
For any mint, there can be only one Associated Token Account per user. To achieve this, the `spl-token` provides `getOrCreateAssociatedTokenAccount` function. This function creates an Associated Token Account for the provided wallet and mint if one doesn't already exist.

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

`spl-token` also provides the `ASSOCIATED_TOKEN_PROGRAM_ID` constant which is the program ID for the Associated Token Account Program. If we have access to the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` along with the mint address, we can use the ATA program ID with the wallet's public key to find the Associated Token Account.

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
    SPL_ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}
```

There might be some cases where we want to fetch all the Associated Token Accounts for the wallet's public key, or some cases where we don't have access to the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`. The following sections describe how we can achieve that.

## How to fetch both legacy and Token22 tokens
When we have access to the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`, it is very easy to fetch owned Token Accounts for any wallet.
If we want to distinguish between legacy tokens and Token22 tokens, we can simply use the program IDs for this.

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

When it comes to fetching token accounts, you'll need to know the creating program first, if you don't already have that information.
When we don't have access to the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`, we can fetch the owning program ID for any mint account. We can use that program ID to differentiate between legacy tokens and Token22 tokens.


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

The `keypair-helpers.ts` file contains some boilerplate for generating a new keypair and airdropping test SOL if needed. That way the rest of the script can focus on specific functionality rather than setup.

Similarly, the `print-helpers.ts` file has a function called `printTableData`. This function logs output to the console in a structured fashion. The function simply takes any object and is passed to the `console.table` helper available to NodeJS. This helper prints the information in a tabular form with the object's keys as columns and values as rows.

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

We'll be using this function to print information about tokens and their mints in a readable fashion.

Lastly, `index.ts` has a `main` function that creates a connection to the specified cluster and calls `initializeKeypair`. This `main` function is where we'll end up calling the rest of our script once we've written it.

### 3. Create legacy and Token22 mints

Let's start by creating new token mints using both the legacy Token program and the Token22 program. Define a function called `createAndMintToken`. For now, we'll just create the token mint in this function, but in a later step we'll add minting. This function should take the following arguments:
- `cluster` - the cluster you're pointing to (i.e. Devnet vs Localnet)
- `connection` - the connection object to use
- `tokenProgramId` - the token program to point to
- `payer` - the keypair paying for the transaction
- `decimals` - the number of decimals to include for the mint
- `mintAmount` - the amount of tokens to mint to the payer

If you've created a token mint before, this should be exactly the same, which the exception of adding the specific token program id to use.

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
			commitment: 'finalized',
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

Note that we've added `confirmOptions` to the `createMint` call to make sure the function's promise doesn't resolve until the transaction has been finalized. This will avoid errors when we go to mint new tokens.

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

Now you can run the project again. You'll see that not only are the two token mints created, but the relevant associated token accounts are also created and tokens minted to each.

### 5. Fetch legacy and Token22 tokens

We can now fetch tokens using the owner's public key and the program ID. Create the function `fetchTokenInfo` inside of `fetch-token-info.ts` with the following arguments:
 - `connection` - the connection object to use
 - `keyPair` - the keypair to find associated token accounts for
 - `programId` - the token program to point to
 - `type` - one of Token or Token22, used for console logging purpose

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
	keyPair: Keypair,
  programId: PublicKey,
  type: TokenTypeForDisplay
): Promise<TokenInfoForDisplay[]> {
	const tokenAccounts = await connection.getTokenAccountsByOwner(
		keyPair.publicKey,
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

Now, let's add two separate calls to this function in `index.ts` to fetch legacy tokens and Token22 tokens
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

Now you can run the project again. You will see information about both the legacy tokens and the Token22 tokens.

If you don't have the program ID, we can get it from the mint account. Let's add the function `fetchTokenProgramFromAccount` to `fetch-token-info.ts` and have it take the following arguments:
 - `connection` - the connection object to use
 - `accountPublicKey` - public key of the mint account


```ts
export async function fetchTokenProgramFromAccount(
  connection: Connection,
  accountPublicKey: PublicKey
){
  //Find the program ID from the mint
  const accountInfo = await connection.getParsedAccountInfo(accountPublicKey);
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

Now you can run the project again. You will see similar output as in option one where you'll see the Legacy and Token22 tokens owned by the user.

That's it! If you get stuck at any step, you can find the complete code in [this lab's repository's](https://github.com/Unboxed-Software/token22-in-the-client/) `main` branch.

# Challenge
For the challenge, try and implement the burn token functionality for the legacy tokens and the Token22 tokens.


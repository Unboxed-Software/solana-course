---
title: Supporting Token Extension Program from a Client
objectives:
- Learn how to support different token programs in the client
- Interact with the spl ts library for all common token functions
---

# Summary

- The `Token Extension Program` is a superset of the `Token Program`
- `Token Extension Program` and `Token Program` are not compatible
- Handling the two programs is as easy as passing in the correct program id to client-side functions
- If a program is not specified in the spl program library, it will default to the original `Token Program`
- `Token22` is another way of referring to the `Token Extension Program`

# Overview

The Token Extensions Program is a superset of the original Token program that includes new and helpful functionality called extensions. These extensions solve use cases that would have previously required a developer to fork and modify the Solana Program Library, which would have resulted in adoption issues. Now, with the Token Extensions Program, we can address those use cases. 

Since the `Token Program` and `Token Extensions Program` are different on-chain programs, they are not interoperable. As a result, we'll have to support both programs in our client-side applications. This means we'll want to explicitly handle mints from both the original Token Program (`TOKEN_PROGRAM_ID`) and the Extension Program (`TOKEN_2022_PROGRAM_ID`).

Fortunately, the interfaces for the two programs remain consistent, allowing the use of `spl-token` helper functions in either program by simply swapping the program ID (the function uses the original Token Program by default if no program ID is provided). However, most user interfaces will not differentiate between Token Program and Token Extension Program tokens, requiring additional logic to track, fetch, and merge information from both types for a seamless experience.

Lastly, the Token Extension Program is internally named "Token 22" as in `TOKEN_2022_PROGRAM_ID`. They are the same thing.


## Differences between working with Token Program Tokens and Token Extension Tokens

When interacting with mints and tokens, we need to be sure we're inputting the correct Token program. To create a `Token Program` mint, use the `Token Program`; to create a mint with extensions, use the `Token Extension Program`.

Fortunately, the `spl-token` package makes it easy to do this. It provides both the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` constants, and all of its helper functions for creating and minting tokens take a program ID as input.

NOTE: `spl-token` defaults to using the `TOKEN_PROGRAM_ID` unless specified otherwise. Make sure to explicitly pass the `TOKEN_2022_PROGRAM_ID` for all function calls related to the Token Extensions Program. Otherwise, you will get the following error: `TokenInvalidAccountOwnerError`.

## Things to consider when working with both Token and Extension Tokens

Although the interfaces for both of these programs remain consistent, they are two different programs. The program IDs of these programs are not interchangeable, and the addresses created by using them are different. If you want to support both `Token Program`  tokens and `Token Extension Program` tokens, you must add extra logic on the client side.

## Associated Token Accounts (ATA)

An Associated Token Account (ATA) is a Token Account whose address is derived using the wallet's public key, the token's mint, and the token program. This mechanism provides a deterministic Token Account address for each mint per user. The ATA account is usually the default account for most holders. Fortunately, ATAs are handled the same way with both token programs.

We can use the ATA helper functions for each token program by providing the desired program ID. If we want to use the Token Extension Program when we call `getOrCreateAssociatedTokenAccount` Extension Tokens, we can pass in `TOKEN_2022_PROGRAM_ID` for the `tokenProgramId` parameter.


```ts
const tokenProgramId = TOKEN_2022_PROGRAM_ID;

const tokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  payer,
  mintAddress,
  payer.publicKey,
  true,
  'finalized',
  {commitment: 'finalized'},
  tokenProgramId // TOKEN_PROGRAM_ID for Token Program tokens and TOKEN_2022_PROGRAM_ID for Token Extension Program tokens
)
```

To re-create the ATA's address from scratch, we can use the `findProgramAddressSync` function by providing the correct seeds.

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

## How to fetch tokens
When it comes to fetching tokens, there is no difference between tokens and extension tokens. All we have to do is provide the correct token program.

```ts
const tokenAccounts = await connection.getTokenAccountsByOwner(
	walletPublicKey,
	{ programId: TOKEN_PROGRAM_ID } // or TOKEN_2022_PROGRAM_ID
)
```

If we want to fetch all of the tokens for a particular owner, we can use a function like `getTokenAccountsByOwner`, and then call it twice, once with `TOKEN_PROGRAM_ID` and another with `TOKEN_2022_PROGRAM_ID`.

```ts
const allOwnedTokens = []
const tokenAccounts = await connection.getTokenAccountsByOwner(
	wallet.publicKey,
	{programId: TOKEN_PROGRAM_ID}
)
const tokenExtensionAccounts = await connection.getTokenAccountsByOwner(
	wallet.publicKey,
	{programId: TOKEN_2022_PROGRAM_ID}
)

allOwnedTokens.push(...tokenAccounts, ...tokenExtensionAccounts)
```

NOTE: It may be advised to store and associate the token program with the token upon fetch.

### Check owning program

You may run into the scenario you don't know the token program for a given account. Fortunately `getParsedAccountInfo` will allow us to determine the owning program.


```ts
const accountInfo = await connection.getParsedAccountInfo(mintAddress);
if (accountInfo.value === null) {
  throw new Error('Account not found');
}

const programId = accountInfo.value.owner; // will return TOKEN_PROGRAM_ID for Token Program mint address and TOKEN_2022_PROGRAM_ID for Token Extension Program mint address

//we now use the programId to fetch the tokens
const tokenAccounts = await connection.getTokenAccountsByOwner(
  wallet.publicKey,
  {programId}
)
```

NOTE: After you fetch the owning account, it may be a good idea to save that owner and associate it with the mints/tokens you are handling.

# Lab - Add Extension Token support to a script

Let's work through a holistic example where we add Token Extension support to an existing script.

You can work through this lab using either Devnet or Localnet. 

Depending on the state of Devnet, it may or may not be easier to use a local test validator by running the following command:

```bash
solana-test-validator
```

Then change the connection URL in `src/index.ts` to point to the running validator:

```ts
// ....
const connection = new Connection('http://127.0.0.1:8899') // use the JSON RPC URL as prompted on the console after running the validator
const payer = await initializeKeypair(connection)
// ....
```

### 1. Clone the starter code

To get started, clone [this lab's repository](https://github.com/Unboxed-Software/solana-lab-token22-in-the-client/) and checkout the `starter` branch. This branch contains a couple of helper files and some boilerplate code to get you started.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-token22-in-the-client.git
cd solana-lab-token22-in-the-client
git checkout starter
```

Run the following commands to install the dependencies and run the script.
```bash
npm install
npm run start
```

### 2. Get familiar with the starter code

The starter code comes with the following files:
- `print-helpers.ts`
- `index.ts`

The `print-helpers.ts` file has a function called `printTableData`. This function logs output to the console in a structured fashion. The function takes any object and is passed to the `console.table` helper available to NodeJS.

Lastly, `index.ts` contains our `main` function. It currently only creates a connection and calls `initializeKeypair`.

### 3. Create Token Program and Token Extension Program mints

Let's start by creating new token mints using both the `Token Program` and the `Token Extension Program`. 

Create a new file called `create-and-mint-token.ts`.

In this file we will create a function called `createAndMintToken`. As the name suggests it will create a mint, token account (ATA) and then mint some amount of tokens to that account.

Inside this function we will be call `createMint`, `getOrCreateAssociatedTokenAccount`, and `mintTo`. The cool part is that this function we are creating is token program agnostic, so we'll be able to create both `Token Program` and `Token Extension Program` tokens within it just by passing in the desired program ID. That being said, here are the arguments we'll be passing into this function:

- `connection` - the connection object to use
- `tokenProgramId` - the token program to point to
- `payer` - the keypair paying for the transaction
- `decimals` - the number of decimals to include for the mint
- `mintAmount` - the amount of tokens to mint to the payer

All put together this is what the final function `createAndMintToken` looks like:

```ts
import { createMint, getMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import printTableData from "./print-helpers";

export async function createAndMintToken(
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

	console.log('\nFetching mint info...')

	const mintInfo = await getMint(
		connection,
		mint,
		'finalized',
		tokenProgramId
	)

	printTableData(mintInfo);

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

export default createAndMintToken
```

Let's now take out new function and add a couple of calls to in within our `main` function. We'll want a `Token Program` and `Token Extension Program` token to test against. So we'll use our two different program IDs:

```ts
import {initializeKeypair} from '@solana-developers/helpers'
import {Cluster, Connection, clusterApiUrl} from '@solana/web3.js'
import createAndMintToken from './create-and-mint-token'
import printTableData from './print-helpers'
import {TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID} from '@solana/spl-token'
import dotenv from 'dotenv'
dotenv.config()

const CLUSTER: Cluster = 'devnet'

async function main() {
  /**
   * Create a connection and initialize a keypair if one doesn't already exists.
   * If a keypair exists, airdrop a sol if needed.
   */
  const connection = new Connection(clusterApiUrl(CLUSTER))
  const payer = await initializeKeypair(connection)

  console.log(`Payer: ${payer.publicKey.toBase58()}`)

  const tokenProgramMint = await createAndMintToken(
    connection,
    TOKEN_PROGRAM_ID,
    payer,
    0,
    1000
  )
  const tokenExtensionProgramMint = await createAndMintToken(
    connection,
    TOKEN_2022_PROGRAM_ID,
    payer,
    0,
    1000
  )
}

main()
```

At this point you can run `npm run start` and see that both mints get created and their info logged to the console.

### 4. Fetch Token Program and Token Extension Program tokens

We can now fetch tokens using the wallet's public key and the program ID. 

Let's create a new file `fetch-token-info.ts`.

Within that new file, let's create the `fetchTokenInfo` function. This function will fetch the token account provided and return a new interface we'll create called `TokenInfoForDisplay`. This will allow us to format the returning info nicely in our console. Again, this function will be agnostic about which token program the account it from.

```ts
import { AccountLayout, getMint } from "@solana/spl-token"
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"

export type TokenTypeForDisplay = 'Token Program' | 'Token Extension Program';

export interface TokenInfoForDisplay {
  mint: PublicKey
  amount: number
  decimals: number
  displayAmount: number
  type: TokenTypeForDisplay
}
```

To actually fetch all of this information we will be calling `getTokenAccountsByOwner` and mapping the results into our new `TokenInfoForDisplay` interface.

To accomplish this the `fetchTokenInfo` function will need the following parameters:

- `connection` - the connection object to use
- `owner` - the wallet which owns the associated token accounts
- `programId` - the token program to point to
- `type` - either `Token` or `Token22`; used for console logging purpose

```ts

export type TokenTypeForDisplay = 'Token Program' | 'Token Extension Program';

export interface TokenInfoForDisplay {
  mint: PublicKey
  amount: number
  decimals: number
  displayAmount: number
  type: TokenTypeForDisplay
}

export async function fetchTokenInfo(
  connection: Connection,
  owner: PublicKey,
  programId: PublicKey,
  type: TokenTypeForDisplay
): Promise<TokenInfoForDisplay[]> {
	const tokenAccounts = await connection.getTokenAccountsByOwner(
		owner,
		{programId}
	)

    const ownedTokens: TokenInfoForDisplay[] = []

    for (const tokenAccount of tokenAccounts.value) {
        const accountData = AccountLayout.decode(tokenAccount.account.data)

        const mintInfo = await getMint(connection, accountData.mint, 'finalized', programId)
        
        ownedTokens.push({
			mint: accountData.mint,
            amount: Number(accountData.amount),
            decimals: mintInfo.decimals,
			displayAmount: Number(accountData.amount) / (10**mintInfo.decimals),
			type,
		})
    }

  return ownedTokens;
}
```

Let's see this function in action. Inside of `index.ts`, let's add two separate calls to this function, once for each program.

```ts
...
import { TokenInfoForDisplay, fetchTokenInfo } from './fetch-token-info'

async function main() {
  	...
	const myTokens: TokenInfoForDisplay[] = []

	myTokens.push(
		...await fetchTokenInfo(connection, payer.publicKey, TOKEN_PROGRAM_ID, 'Token Program'),
		...await fetchTokenInfo(connection, payer.publicKey, TOKEN_2022_PROGRAM_ID, 'Token Extension Program'),
	)

	printTableData(myTokens)

}

main()
```

Now you can run `npm run start` again. You will now see all of the tokens the payer wallet owns.

### 6. Fetch Token Program and Token Extension Program tokens without the program ID

Lastly, let's take a look at how we can grab the owning program from a given mint account.

To do this we will create a new function `fetchTokenProgramFromAccount` to `fetch-token-info.ts`. This function will simply return us the `programId` of the given mint.

To accomplish this we will call the `getParsedAccountInfo` function and return the `.value.owner` which is the owning program.

The `fetchTokenProgramFromAccount` function will need the following parameters:
- `connection` - the connection object to use
- `mint` - public key of the mint account

The final function will look like this:

```ts
...

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

Finally let's add see this in action in our `index.ts`:

```ts
...
import { TokenInfoForDisplay, fetchTokenInfo, fetchTokenProgramFromAccount } from './fetch-token-info'

async function main(){
  ...
	const tokenProgramTokenProgram = await fetchTokenProgramFromAccount(connection, tokenProgramMint);
	const tokenExtensionProgramTokenProgram = await fetchTokenProgramFromAccount(connection, tokenExtensionProgramMint);

	if(!tokenProgramTokenProgram.equals(TOKEN_PROGRAM_ID)) throw new Error('Token Program mint token program is not correct');
	if(!tokenExtensionProgramTokenProgram.equals(TOKEN_2022_PROGRAM_ID)) throw new Error('Token Extension Program mint token program is not correct');
}

main()
```

Run `npm run start` again. You should see the same output as before - meaning the expected token programs were correct.

That's it! If you get stuck at any step, you can find the complete code in [this lab's repository's](https://github.com/Unboxed-Software/solana-lab-token22-in-the-client/) `solution` branch.

# Challenge
For the challenge, try and implement the burn token functionality for the Token Program tokens and the Token Extension tokens.



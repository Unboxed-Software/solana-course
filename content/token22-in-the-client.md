---
title: Supporting Token22 from a Client
objectives:
- 
---

# Summary


# Overview
The Token Extensions Program is a superset of the original Token program that provides a lot of useful functionality. These extensions are solutions to use-cases that would have required a developer fork and modify the to Solana Program Library, which would result in adoption issues. Now with the Token Extensions Program, we can address those use-cases. However, the Token Program and Token Extensions Program are different on-chain programs, they are not interoperable. The do they exact same things, except the Token Extensions Program can do more. This being said, we'll have to support both programs in our client-side applications. Meaning we'll want to handle mints from both the original Token Program (`TOKEN_PROGRAM_ID`) and the Extension Program (`TOKEN_2022_PROGRAM_ID`).

Fortunately, the interfaces for both the legacy Token Program and Token Extension Token program remain consistent. This allows the use of common `spl-token` helper functions across different token programs by simply swapping the program ID. By default, if no program ID is provided, the functions revert to using the legacy token program. 

Most user interfaces will not differentiate between legacy tokens and Extension tokens. Meaning additional logic to fetch and merge information from both types for a seamless experience. This can be done by keeping track of token's owning program or fetching the owning program on-demand.

Lastly, Token Extension Program is named internally as "Token 22" as in `TOKEN_2022_PROGRAM_ID`. They are the same thing.

## Differences between working with legacy Tokens and Token Extension Tokens

When interacting with mints and tokens, the only thing you need to worry about is inputting the correct Token program. To create a legacy mint use the Token Program, to create a mint with extensions, use the Token Extension program.

Fortunately, the `spl-token` package makes it easy to do this. It provides both the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` constants and all of its helper functions for creating and minting tokens take a program ID as input.

NOTE: `spl-token` defaults to using the `TOKEN_PROGRAM_ID` unless specified otherwise. Make sure to explicitly pass the `TOKEN_2022_PROGRAM_ID` for all function calls related to Token Extensions Program, otherwise you will get the following error: `TokenInvalidAccountOwnerError`.

## Things to consider when working with both Token and Extension Tokens
Although the interfaces for both of these programs remain consistent, these are two different programs. The addresses created by using these programs are different. The program IDs of these programs are not interchangeable. If you want to support both the legacy token and Token22 tokens, you will have to add extra logic on the client side.

## Associated Token Accounts (ATA)
An Associated Token Account is a Token Account whose address is created using the wallet's public key, a token mint and the token program. This mechanism provides a deterministic Token Account address for each mint per user. ATAs are handled the same way with both token programs.

We can use the ATAs helper functions for each token program by simply swapping the token program to the correct one. For example, to use the `getOrCreateAssociatedTokenAccount` for Extension Tokens, just pass in `TOKEN_2022_PROGRAM_ID` for the `tokenProgramId` parameter.

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
  tokenProgramId // TOKEN_PROGRAM_ID for legacy tokens and TOKEN_2022_PROGRAM_ID for Token22 tokens
)
```

To re-create the ATA's address from scratch we can use the `findProgramAddressSync` function by providing the correct seeds.

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

## How to fetch tokens
When it comes to fetching tokens, there is no difference between legacy and extension tokens. All we have to do is provide the correct token program.

```ts
const tokenAccounts = await connection.getTokenAccountsByOwner(
	walletPublicKey,
	{ programId: TOKEN_PROGRAM_ID } // or TOKEN_2022_PROGRAM_ID
)
```

If we want to fetch all of the tokens for a particular owner, we can use a function like `getTokenAccountsByOwner`, and then call it twice, once with `TOKEN_PROGRAM_ID` and another with `TOKEN_2022_PROGRAM_ID`.

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

NOTE: It may be advised to store and associate the token program with the token upon fetch.

### Check owning program

You may run into the scenario you don't know the token program for a given account. Fortunately `getParsedAccountInfo` will allow us to determine the owning program.

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

NOTE: After you fetch the owning account, it may be a good idea to save that owner and associate it with the mints/tokens you are handling.

# Lab - Add Extension Token support to a script

Let's work through a holistic example where we add Token Extension support to an existing script.

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

Lastly, `index.ts` contains our `main` function. Right now it only creates a connection and calls `initializeKeypair`.

### 3. Create legacy and Token22 mints

Let's start by creating new token mints using both the legacy Token program and the Token22 program. Define a function called `createAndMintToken`. As the name suggests it will create a mint and mint `mintAmount` tokens to a newly generated ATA for the `payer`. This function should take the following arguments:
- `connection` - the connection object to use
- `tokenProgramId` - the token program to point to
- `payer` - the keypair paying for the transaction
- `decimals` - the number of decimals to include for the mint
- `mintAmount` - the amount of tokens to mint to the payer

If you've created a token mint before, this should be exactly the same, which the exception of adding the specific token program id to use.

```ts
async function createAndMintToken(
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

### 4. Fetch legacy and Token22 tokens

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

And just to show how you would grab the owner account if you didn't already have them. Let's add a function `fetchTokenProgramFromAccount` to `fetch-token-info.ts` and have it take the following arguments:
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


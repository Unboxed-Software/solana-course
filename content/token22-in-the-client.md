# Overview

## Differences between working with legacy tokens and Token22 tokens

When creating tokens, the only thing you need to worry about is pointing your code to the correct Token program. If you want to create tokens using the legacy Token program, you need to ensure that you point to that program. if you want to create using the Token22 program you need to ensure that you point to the Token22 program.

Fortunately, the `spl-token` package makes it easy to do this. It provides both the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` constants and all of its helper functions for creating and minting tokens take a program ID as input.

NOTE: `spl-token` defaults to using the `TOKEN_PROGRAM_ID` unless specified otherwise. Make sure to explicitly pass the `TOKEN_2022_PROGRAM_ID` for all function calls related to Token22, otherwise you will get the following error: `TokenInvalidAccountOwnerError`.

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

When creating tokens, the only thing you need to worry about is pointing your code to the correct Token program. If you want to create tokens using the legacy Token program, you need to ensure that you point to that program. if you want to create using the Token22 program you need to ensure that you point to the Token22 program.

Fortunately, the `spl-token` package makes it easy to do this. It provides both the `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` constants and all of its helper functions for creating and minting tokens take a program ID as input.

NOTE: `spl-token` defaults to using the `TOKEN_PROGRAM_ID` unless specified otherwise. Make sure to explicitly pass the `TOKEN_2022_PROGRAM_ID` for all function calls related to Token22, otherwise you will get the following error: `TokenInvalidAccountOwnerError`.

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

There are two ways in which we can fetch tokens:
- Fetching associated token accounts by owner
- Fetching token account owner before fetching tokens

To fetching associated token accounts by owner, we just need to specify the program ID to differentiate between legacy tokens and Token 2022 tokens. Create the function `fetchTokenInfo`. This function should take following arguments:
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


The other option is that we fetch the program ID associated with the mint beforehand. Then use this program ID to fetch the tokens. Let's add the function `fetchTokenProgramFromAccount`. It should take following arguments:
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

When this function is called with a legacy mint account's public key, it will return the legacy token program ID. Similarly, when called with the Token22 mint account's public key, it will return the Token22 program ID. Let's use this function in `index.ts` to fetch the tokens.

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

Now you can run the project again. You will see similar output as in option one.

That's it! If you get stuck at any step, you can find the complete code in [this lab's repository's](https://github.com/Unboxed-Software/token22-in-the-client/) `main` branch.

# Challenge
For the challenge, try and implement the burn token functionality for the legacy tokens and the Token22 tokens.

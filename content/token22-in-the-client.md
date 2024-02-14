# Prerequisites
If you don't have Solana already installed on your system, follow this [guide](https://solana.com/developers/guides/getstarted/setup-local-development).

## Testing on Local Test Validator
If you encounter errors with `devnet`, you can use Solana Local Test Validator to run this script. After completing installation, run the following command to start the Local Test Validator.
```bash
solana-test-validator
```

And then, in `src/index.ts`, change the connection initialization to use the Local Test Validator
```ts
// ....
const connection = new Connection('http://127.0.0.1:8899') // use the JSON RPC URL as prompted on the console after running the validator
const keyPair = await initializeKeypair(connection)
// ....
```

# Getting Started
To get started, clone [this](https://github.com/Unboxed-Software/token22-in-the-client/) repository and checkout the `starter` branch. This branch contains a couple of helper files and the boilerplate code to get you started.

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

## KeyPair Helpers

This helper file contains two functions:
 - `initializeKeypair`
 - `airdropSolIfNeeded`

### Initializing a Keypair
This function creates a new keypair if one doesn't exist. After creating a new keypair, the secret key will be saved into a `.env` file. This keypair will be used for all the subsequent operations.

```ts
import * as web3 from '@solana/web3.js'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

export async function initializeKeypair(
	connection: web3.Connection
): Promise<web3.Keypair> {
	if (!process.env.PRIVATE_KEY) {
		console.log('Creating .env file')
		const signer = web3.Keypair.generate()
		fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`)
		await airdropSolIfNeeded(signer, connection)

		return signer
	}

	const secret = JSON.parse(process.env.PRIVATE_KEY ?? '') as number[]
	const secretKey = Uint8Array.from(secret)
	const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey)
	await airdropSolIfNeeded(keypairFromSecretKey, connection)
	return keypairFromSecretKey
}
```

### Airdropping 1 SOL
When a new keypair is created, this function will be called to airdrop 1 SOL. This function will be called again whenever the balance drops below 1 SOL.

```ts
async function airdropSolIfNeeded(
	signer: web3.Keypair,
	connection: web3.Connection
) {
	const balance = await connection.getBalance(signer.publicKey)
	console.log('Current balance is', balance / web3.LAMPORTS_PER_SOL)

	if (balance < web3.LAMPORTS_PER_SOL) {
		console.log('Airdropping 1 SOL...')
		const airdropSignature = await connection.requestAirdrop(
			signer.publicKey,
			web3.LAMPORTS_PER_SOL
		)

		const latestBlockHash = await connection.getLatestBlockhash()

		await connection.confirmTransaction({
			blockhash: latestBlockHash.blockhash,
			lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
			signature: airdropSignature,
		})

		const newBalance = await connection.getBalance(signer.publicKey)
		console.log('New balance is', newBalance / web3.LAMPORTS_PER_SOL)
	}
}
```

## Print Helpers
The helper file `src/print-helpers.ts` has a function called `printTableData` which will be used to log output to the console in a structured fashion. The function simply takes any object and is passed to the `console.table` function available to NodeJS which prints the information in a tabular form with the object's keys as columns and values as rows.
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

## `index.ts`
The `src/index.ts` has a `main` function which creates a connection to the specified cluster and calls `initializeKeypair`.
```ts
import {Cluster, Connection, clusterApiUrl} from '@solana/web3.js'
import {initializeKeypair} from './keypair-helpers'

const CLUSTER: Cluster = 'devnet'

async function main() {

	/**
	 * Create a connection and initialize a keypair if one doesn't already exists.
	 * If a keypair exists, airdrop a sol if needed.
	 */
	const connection = new Connection(clusterApiUrl(CLUSTER))
	const keyPair = await initializeKeypair(connection)

	console.log(`public key: ${keyPair.publicKey.toBase58()}`)
	
}

main()
```

# Creating Tokens
The only difference in creating tokens and minting them is the program ID used for the API calls. The `spl-token` package provides the `TOKEN_2022_PROGRAM_ID` which we will use while calling these functions.

> Make sure to use the `TOKEN_2022_PROGRAM_ID` for API calls whenever you are dealing with the tokens which are created with this program ID. The APIs in `spl-token` by default use the `TOKEN_PROGRAM_ID` unless specified otherwise. If you do not specify the appropriate program ID, you will get `TokenInvalidAccountOwnerError`.


## Creating and Minting Tokens
In this function, we:
1. Create a new mint account
2. Print information of the newly created mint
3. Create an associated token account for the newly created mint
4. Mint tokens to the associated token account

The only change in creating regular tokens and Token 2022 tokens is passing the appropriate program ID to the `tokenProgramId` parameter of this function (`TOKEN_PROGRAM_ID` or `TOKEN_2022_PROGRAM_ID`).

```ts
import {
	createMint,
	getMint,
	getOrCreateAssociatedTokenAccount,
	mintTo,
} from '@solana/spl-token'
import {Cluster, Connection, Keypair, PublicKey} from '@solana/web3.js'
import printTableData from './print-helpers'

/**
 * Create a new mint and mint some tokens to the associated token account
 * THE ONLY CHANGE IS THE PROGRAM ID
 * @param cluster The cluster to connect to
 * @param connection The connection to use
 * @param tokenProgramId The program id to use for the token
 * @param payer The keypair to use for paying for the transactions
 * @param decimals The number of decimals to use for the mint
 * @param mintAmount The amount of tokens to mint
 * @returns The mint public key
 */
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
	const mintInfo = await getMintInfo(connection, mint, tokenProgramId)
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

## Fetching Mint Info
This function simply fetches the mint information containing authorities, supply, etc. Similar to the `createAndMintToken`, this function also uses the `tokenProgramId` parameter to differentiate regular tokens and Token 2022 tokens.

```ts
export async function getMintInfo(
	connection: Connection,
	mint: PublicKey,
	tokenProgramId: PublicKey,
){
	const mintInfo = await getMint(
		connection,
		mint,
		'finalized',
		tokenProgramId
	)

	return mintInfo;
}

```

# Fetch Tokens
Fetching Token 2022 tokens is also similar to creating Token 2022 tokens, simply by specifying the program ID.

There are two ways in which we can fetch tokens:
- Fetching associated token accounts by owner
- Fetching token account owner before fetching tokens

## Fetching Associated Token Accounts by Owner
This option simply fetches all the associated token accounts created with the user's public key. We just need to specify the program ID to differentiate between regular tokens and Token 2022 tokens.
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

## Fetching Token Account Owner Before Fetching Tokens
In this option, we fetch the program ID associated with the user's public key beforehand and then fetch the tokens using the program ID. 
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

# Modify `index.ts`
Modify `index.ts`
```ts
import {Cluster, Connection, clusterApiUrl} from '@solana/web3.js'
import {initializeKeypair} from './keypair-helpers'
import createAndMintToken from './create-and-mint-token'
import printTableData from './print-helpers'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { TokenInfoForDisplay, fetchTokenInfo, fetchTokenProgramFromAccount } from './fetch-token-info'

const CLUSTER: Cluster = 'devnet'

async function main() {

	/**
	 * Create a connection and initialize a keypair if one doesn't already exists.
	 * If a keypair exists, airdrop a sol if needed.
	 */
	const connection = new Connection(clusterApiUrl(CLUSTER))
	const keyPair = await initializeKeypair(connection)

	console.log(`public key: ${keyPair.publicKey.toBase58()}`)

	const decimals = 9; 
	const mintAmount = 100 * 10 ** decimals;

	/**
	 * Using TOKEN_PROGRAM_ID, create a mint, create a associated token account and mint 100 tokens to that token account
	 */
	const regularMint = await createAndMintToken(CLUSTER, connection, TOKEN_PROGRAM_ID, keyPair, decimals, mintAmount);

	/**
	 * Using TOKEN_2022_PROGRAM_ID, create a mint, create a associated token account and mint 100 tokens to that token account
	 */
	const token22Mint = await createAndMintToken(CLUSTER, connection, TOKEN_2022_PROGRAM_ID, keyPair, decimals, mintAmount);

	/**
	 * Using TOKEN_2022_PROGRAM_ID, create a mint, create a associated token account and mint 100 tokens to that token account
	 */
	const regularMintTokenProgram = await fetchTokenProgramFromAccount(connection, regularMint);
	const token22MintTokenProgram = await fetchTokenProgramFromAccount(connection, token22Mint);

	if(! regularMintTokenProgram.equals(TOKEN_PROGRAM_ID)) throw new Error('Regular mint token program is not correct');
	if(! token22MintTokenProgram.equals(TOKEN_2022_PROGRAM_ID)) throw new Error('Token22 mint token program is not correct');

	/**
	 * Fetch and display tokens owned which are created using both TOKEN_PROGRAM_ID and TOKEN_2022_PROGRAM_ID
	 */
	const myTokens: TokenInfoForDisplay[] = []

	myTokens.push(
		...await fetchTokenInfo(connection, keyPair, TOKEN_PROGRAM_ID, 'Token'),
		...await fetchTokenInfo(connection, keyPair, TOKEN_2022_PROGRAM_ID, 'Token22'),
	)

	printTableData(myTokens)
	
}

main()
```

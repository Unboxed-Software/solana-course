# Prerequisites
If you don't have Solana already installed on your system, follow this [guide](https://solana.com/developers/guides/getstarted/setup-local-development).

# Getting Started
To get started, clone [this](https://github.com/Unboxed-Software/token22-in-the-client/) repository and checkout the `starter` branch.
Run the following commands to install the dependencies and run the script.
```bash
npm install

npm run start
```

# Creating Tokens
Copy and paste the following code in `src/create-and-mint-token.ts`
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

export default createAndMintToken
```

# Fetch Tokens
Copy and paste the following code in `src/fetch-token-info.ts`
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

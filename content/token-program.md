# Token Program

### List links for further reading here:

- [https://spl.solana.com/token](https://spl.solana.com/token)
- [https://spl.solana.com/associated-token-account](https://spl.solana.com/associated-token-account)
- [https://pencilflip.medium.com/solanas-token-program-explained-de0ddce29714](https://pencilflip.medium.com/solanas-token-program-explained-de0ddce29714)
- [https://medium.com/coinmonks/solana-programs-part-1-understanding-spl-token-mint-fabd13323219](https://medium.com/coinmonks/solana-programs-part-1-understanding-spl-token-mint-fabd13323219)

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Create Token Mint
- Create Token Accounts
- Mint Tokens
- Burn Tokens
- Close Token Account

# TL;DR

*This should be bullet points that quickly go through the lesson content. This should make it easier for students to just get the gist and move on if they already felt comfortable with that lesson instead of going through the whole thing.*

- SPL-Tokens represent all non-native SOL tokens on the Solana network. Both fungible and non-fungible tokens (NFTs) on Solana are SPL-Tokens
- The Token Program contains instructions for creating and interacting with SPL-Tokens
- Token Mints are accounts which hold data about a specific Token, but do not hold Tokens
- Token Accounts are used to hold Tokens of a specific Token Mint
- Creating Token Mints and Token Accounts requires allocating rent in SOL. The rent for a Token Account can be refunded when the account is closed. However, Token Mints currently cannot be closed

# Overview

*This is the primary explanatory text of the lesson. It should be explanation and examples of the topic that students read through but aren't coding alongside of.*

### Token Mint

A Token `Mint` refers to an account which holds data about a specific Token.

For example, the USDC Token `Mint` address is `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. The Token `Mint` specifies the current supply, `mintAuthority`,  `freezeAuthority`, and decimal precision of a Token.

![Screenshot of USDC Token Mint](../assets/token-program-usdc-mint.png)

To create a mint using the `spl-token` library, you use the `createMint` function. The `createMint` function returns the `Publickey` of the new token `Mint`. This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` the payer for the transaction
- `mintAuthority` the mint authority authorized to mint tokens from the token mint. The mint authority can be updated to null after minting tokens to set the max supply and ensure no tokens can be minted in the future
- `freezeAuthority` the freeze authority can freeze the tokens in a Token Account, but is often set to null if freezing is not a desired attribute
- `decimals` specifies the desired decimal precision of the token

All together, that looks like this:

```tsx
const mint = await createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimal
);
```

Below is what `createMint` does under the hood.

1. Use `getMinimumBalanceForRentExemptMint` to calculate lamports needed for the new mint account to be rent exempt
2. Create a transaction using `createAccount` and `createInitializeMintInstruction`. `createAccount` requires a newly generated `Keypair` to use for the new mint

The `createAccount` function requires the following arguments:

- `fromPubkey` the account that will transfer lamports to the created account
- `newAccountPubkey` the public key of the created account
- `space` the amount of space in bytes to allocate to the created account, there is a `MINT_SIZE` constant provided by the Solana Program Library
- `lamports` the amount of lamports to transfer to the created account, when creating a new mint use the `getMinimumBalanceForRentExemptMint` function to calculate lamports needed
- `programID` the public key of the program to assign as the owner of the created account, when creating a new mint this will be the Token Program address. `TOKEN_PROGRAM_ID` is a constant provided by the Solana Program Library

The `createInitializeMintInstruction` function requires the following arguments:

- `mint` token mint account
- `decimals` number of decimals in token account amounts
- `mintAuthority` minting authority
- `freezeAuthority` optional authority that can freeze token accounts
- `programId` Token Program address

All together, that looks like this:

```tsx
const lamports = await getMinimumBalanceForRentExemptMint(connection);

const transaction = new Transaction().add(
    SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: keypair.publicKey,
        space: MINT_SIZE,
        lamports,
        programId,
    }),
    createInitializeMintInstruction(
        keypair.publicKey,
        decimals,
        mintAuthority,
        freezeAuthority,
        programId
    )
)
```

This may be helpful if you have a UI associated with creating a new mint and need to build the transaction manually in order to send the transaction to a wallet for approval.

### Token Account

A Token Account holds Tokens of a specific `mint` and has a specified `owner` of the account. Only the `owner`  is authorized to decrease the Token Account balance while anyone can send Tokens to the Token Account to increase its balance.

To create a token account using the `spl-token` library, you can use the `createAccount` function. The `createAccount` function returns the `Publickey` of the new token account.

This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` payer for the transaction
- `mint` the token mint that the new token account is associated with
- `owner` the owner of the new token account
- `keypair` option parameter to specify an address for the new token account, defaulting to the associated token account for the `mint` and `owner` if no keypair is provided

All together, that looks like this:

```tsx
const tokenAccount = await createAccount(
    connection,
    payer,
    mint,
    owner,
    keypair
);
```

Below is what `createAccount` does under the hood.

1. Use `getMint` retrieve the data associated with the `mint`
2. Use `getAccountLenForMint` to calculates the space needed for the token account
3. Use `getMinimumBalanceForRentExemption` to calculates the lamports needed for rent exemption
4. Create a new transaction using `createAccount` and `createInitializeAccountInstruction`. Note that the `createAccount` below is from `@solana/web3.js` to create a generic new account and `createInitializeAccountInstruction` uses the new account to create the new token account

```tsx
const mintState = await getMint(connection, mint, confirmOptions?.commitment, programId);
const space = getAccountLenForMint(mintState);
const lamports = await connection.getMinimumBalanceForRentExemption(space);

const transaction = new Transaction().add(
    SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: keypair.publicKey,
        space,
        lamports,
        programId,
    }),
    createInitializeAccountInstruction(
        keypair.publicKey,
        mint,
        owner,
        programId
    )
);
```

### Associated Token Account

An Associated Token Account is a Token Account where the address of the Token Account is derived using an owner `publickey` and a token `mint`. Associated Token Accounts provide a deterministic way to find the Token Account owned by a specific `publickey` for a specific token `mint`.

To create an associated token account using the `spl-token` library, you use the `createAssociatedTokenAccount` function. The `createAssociatedTokenAccount` function returns the `Publickey` of the new associated token account.

This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` payer for the transaction
- `mint` the token mint that the new token account is associated with
- `owner` the owner of the new token account

All together, that looks like this:

```tsx
const associatedTokenAccount = await createAssociatedTokenAccount(
    connection,
	payer,
	mint,
	owner,
);
```

Below is what `createAssociatedTokenAccount` does under the hood.

1. Use `getAssociatedTokenAddress` to derive the associated token account address for the `mint` and `owner`
2. Create a transaction using `createAssociatedTokenAccountInstruction`

```tsx
const associatedToken = await getAssociatedTokenAddress(mint, owner, false, programId, associatedTokenProgramId);

const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
        payer.publicKey,
        associatedToken,
        owner,
        mint,
        programId,
        associatedTokenProgramId
    )
);
```

### Mint Tokens

New tokens are created through minting and minted to a token account. Minting increases the supply of the token `mint` and only the `mintAuthority` of a token `mint` is allowed to mint new tokens.

To mint tokens using the `spl-token` library, you use the `mintTo` function. The `mintTo` function returns a `TransactionSignature` that can be viewed of Solana Explorer.

This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` payer for the transaction
- `mint` the token mint that the new token account is associated with
- `destination` the token account that tokens will be minted to
- `authority` the mint authority authorized to mint tokens from the `mint`
- `amount` the amount of tokens to mint, remember to account for the decimals of the `mint`

All together, that looks like this:

```tsx
const transactionSignature = await mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount
);
```

Below is what `createMintToInstruction` does under the hood.

1. Creates a transaction using `createMintToInstruction`.

```tsx
const transaction = new Transaction().add(
    createMintToInstruction(
        mint,
        destination,
        authorityPublicKey,
        amount,
        multiSigners,
        programId
    )
);
```

### Transfer Tokens

SPL-Token transfers require both the sender and receiver to have Token Accounts for the `Mint` of the Tokens being transferred. The Tokens are transferred from the sender’s Token Account to the receiver’s Token Account.

To transfer tokens using the `spl-token` library, you use the `transfer` function. The `transfer` function returns a `TransactionSignature` that can be viewed of Solana Explorer.

This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` payer for the transaction
- `source` the token account sending tokens
- `destination` the token account receiving tokens
- `owner` the owner of the `source` token account
- `amount` the amount of tokens to transfer

All together, that looks like this:

```tsx
const transactionSignature = await transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
);
```

Below is what `transfer` does under the hood.

1. Creates a transaction using `createTransferInstruction`

```tsx
const transaction = new Transaction().add(
    createTransferInstruction(source, destination, ownerPublicKey, amount, multiSigners, programId)
);
```

### Burn Tokens

Tokens can be removed through burning and decrease the token supply of the associated `mint`.

To burn tokens using the `spl-token` library, you use the `burn` function. The `burn` function returns a `TransactionSignature` that can be viewed of Solana Explorer.

This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` payer for the transaction
- `account` the token account to burn tokens from
- `mint` the token mint associated with the token account
- `owner` the owner of the token account
- `amount` the amount of tokens to burn

All together, that looks like this:

```tsx
const transactionSignature = await burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount
);
```

Below is what `burn` does under the hood.

1. Creates a transaction using `createBurnInstruction`

```tsx
const transaction = new Transaction().add(
    createBurnInstruction(
        account,
        mint,
        ownerPublicKey,
        amount,
        multiSigners,
        programId
    )
);
```

### Rent

All accounts created require a deposit of rent in SOL calculated based on amount of data stored. Rent is refunded to a specified wallet address when an account is closed and the account data no longer needs to be stored by the Solana network.

### Close Token Account

To close token accounts using the `spl-token` library, you use the `closeAccount` function. The `closeAccount` function returns a `TransactionSignature` that can be viewed of Solana Explorer.

This function requires the following arguments:

- `connection` the connection to the cluster
- `payer` payer for the transaction
- `account` the token account to burn tokens from
- `destination` the address to refund the token account rent to
- `authority` the authority allowed to close the token account

All together, that looks like this:

```tsx
const transactionSignature = await closeAccount(
    connection,
    payer,
    account,
    destination,
    authority
);
```

Below is what `closeAccount` does under the hood.

1. Creates a transaction using `createCloseAccountInstruction`

```tsx
const transaction = new Transaction().add(
    createCloseAccountInstruction(account, destination, authorityPublicKey, multiSigners, programId)
);
```

# Demo

*The demo portion of the lesson is meant to be tutorial-style where the reader is coding along with it. The project here should take the content from the overview and apply it so it has context and isn't just standalone code snippets.*

**Demo Code: [https://github.com/ZYJLiu/solana-token-client](https://github.com/ZYJLiu/solana-token-client)**

We’re going to create a script that interacts with instructions on the Token Program. We will create a Token Mint, create Token Accounts, mint tokens, transfer tokens, burn tokens, and close a Token Account.

### 1. Basic scaffolding

Let’s start with some basic scaffolding. You’re welcome to set up your project however feels most appropriate for you, but we’ll be using a simple Typescript project with a dependency on the @solana/web3.js and @solana/spl-token package. If you want to use our exact scaffolding, you can use the following commands in the command line:

```bash
mkdir -p solana-token-client/src && \
	cd solana-token-client && \
	touch src/index.ts && \
	git init && touch .gitignore && \
	npm init -y && \
	npm install --save-dev typescript && \
	npx tsc --init && \
	npm install @solana/web3.js && \
	npm install @solana/spl-token && \
	npm install dotenv && \
	touch .env
```

This will create a new directory for the project with a subdirectory `src`, create an `index.ts` file inside of `src`, initialize a git repository with a `.gitignore` file, create a new `npm` package, add a developer dependency on typescript, create a `.tsconfig` file, install the `@solana/web3.js` and `@solana/spl-token` dependencies, the `.dotenv` dependency, and create a `.env` file.

If you want to match our code exactly, replace the contents of `.tsconfig` with the following:

```json
{
    "compilerOptions": {
        "target": "es5",
        "module": "commonjs",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "outDir": "dist"
    },
    "include": [ "./src/**/*" ]
}
```

Add the following to the `.gitignore`:

```
node_modules/
dist/
.env
```

And finally, add the following to the `scripts` object in `package.json`:

```json
"start": "tsc && node dist/index.js"
```

Add your Keypair an environment variable `PRIVATE_KEY` in `.env`. Refer to Module 1 Lesson 2 for how to generate a new Keypair. It should look something like this but with different numbers:

```
PRIVATE_KEY="[56,83,31,62,66,154,33,74,106,59,111,224,176,237,89,224,10,220,28,222,128,36,138,89,30,252,100,209,206,155,154,65,98,194,97,182,98,162,107,238,61,183,163,215,44,6,10,49,218,156,5,131,125,253,247,190,181,196,0,249,40,149,119,246]"
```

In the `index.ts` file, let’s create a new function outside of `main` called `initializeKeypair`. Inside this new function, we’ll parse the environment variable `PRIVATE_KEY` as `number[]`, use it to initialize a `Uint8Array`, then initialize and return a `Keypair` using the `Uint8Array`.

```tsx
import web3 = require('@solana/web3.js')
import Dotenv from 'dotenv'
Dotenv.config()

async function main() {
    const user = initializeKeypair();
}

main().then(() => {
    console.log("Finished successfully")
}).catch((error) => {
    console.error(error);
})
function initializeKeypair(): web3.Keypair {
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey)
    return keypairFromSecretKey
}
```

### 2. Token Program

Now that we have a way of initializing our keypair, we need to establish a connection with Solana’s devnet. In `main`, let’s call `initializeKeypair`, create a connection to a Solana cluster, and then call`requestAirdrop` to fund the user with 2 devnet SOL:

```tsx
async function main() {
    const user = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    await connection.requestAirdrop(user.publicKey, web3.LAMPORTS_PER_SOL * 2);
}
```

**Create Mint**

Import `createMint` from `@solana/spl-token` and then create a function to call `createMint`:

```tsx
import {createMint} from "@solana/spl-token";

async function createNewMint(
    connection: web3.Connection,
    payer: web3.Keypair,
    mintAuthority: web3.PublicKey,
    freezeAuthority: web3.PublicKey,
    decimal: number
    ) {const mint = await createMint(
        connection,
        payer,
        mintAuthority,
        freezeAuthority,
        decimal
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${mint}?cluster=devnet`
    );

    return mint;
}
```

Lets call the function in `main` and set the `user` as the payer, `mintAuthority`, and `freezeAuthority`.

```tsx
async function main() {
    const user = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    await connection.requestAirdrop(user.publicKey, web3.LAMPORTS_PER_SOL * 2);

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    );
}
```

**Create Token Account**

Lets create a new Token Account for the `mint` and set the `user` as the token account `owner`. The `createAccount` function creates a new Token Account with the option to specify the address of the Token Account. If no address is provided, `createAccount` will default to using the associated token account derived using the `mint` and owner.

Another way to create token accounts is using the `createAssociatedTokenAccount` function. This creates a new Token Account with an address derived from the `user` and `mint`, allowing for a deterministic way to find the token account for any mint associated to a specific user. Note that when creating an Associated Token Account, you do not need to generate a new `Keypair` for the new Token Account because the address will be derived instead.

For our demo we’ll use the`getOrCreateAssociatedTokenAccount` function to create our token account. This function gets the address of a Token Account if it already exists otherwise it will create a new Associated Token Account for the `mint` and `owner`.

Import `getOrCreateAssociatedTokenAccount` from `@solana/spl-token`and create a function to call `getOrCreateAssociatedTokenAccount`:

```tsx
import {getOrCreateAssociatedTokenAccount} from "@solana/spl-token";

async function createTokenAccount(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    owner: web3.PublicKey
    ) {const tokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner
    );

    console.log(`Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`);

    return tokenAccount;
}
```

Lets call the function in `main` using the `mint` we created in the previous step and setting the `user` as the `payer` and `owner`.

```tsx
async function main() {
    const user = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    await connection.requestAirdrop(user.publicKey, web3.LAMPORTS_PER_SOL * 2);

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    );

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    );
}
```

**Mint Tokens**

Now that we have a token `mint` and a token account, lets mint tokens to the token account. Note that only the `mintAuthority` can mint new tokens to a token account. Recall that we set the `user` as the `mintAuthority` over the `mint` we created.

Import `mintTo` from `@solana/spl-token`and then create a function to call `mintTo`:

```tsx
import {mintTo} from "@solana/spl-token";

async function mintTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    destination: web3.PublicKey,
    authority: web3.Keypair,
    amount: number
    ) {const transactionSignature = await mintTo(
        connection,
        payer,
        mint,
        destination,
        authority,
        amount
    );
    console.log(`Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}
```

Lets call the function in `main` using the `mint` and `tokenAccount` created previously.

```tsx
async function main() {
    const user = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    await connection.requestAirdrop(user.publicKey, web3.LAMPORTS_PER_SOL * 2);

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    );

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    );

    await mintTokens(connection, user, mint, tokenAccount.address, user, 100);
}
```

**Transfer Tokens**

Next, lets transfer some of the tokens we just minted.

Import `transfer` from `@solana/spl-token` and then create a function to call `transfer`:

```tsx
import {transfer} from "@solana/spl-token";

async function transferTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    source: web3.PublicKey,
    destination: web3.PublicKey,
    owner: web3.Keypair,
    amount: number
    ) {const transactionSignature = await transfer(
        connection,
        payer,
        source,
        destination,
        owner,
        amount
    );

    console.log(`Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}
```

Lets first create a new `Keypair` for a receiver, create a token account for the receiver, and mint tokens to the new token account.  Next lets call our new function in `main` to transfer tokens from the `user` token account to the `receiver` token account.

```tsx
async function main() {
	...

    const receiver = web3.Keypair.generate();
    await connection.requestAirdrop(
        receiver.publicKey,
        web3.LAMPORTS_PER_SOL * 1
    );

    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver.publicKey
    );

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        user,
        100
    );
}
```

**Burn Tokens**

Tokens in a Token Account can be burned by the owner of a Token Account using the `burn` instruction.

Import `burn` from `@solana/spl-token` and then create a function to call `burn`:

```tsx
import {burn} from "@solana/spl-token";

async function burnTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    mint: web3.PublicKey,
    owner: web3.Keypair,
    amount: number
    ) {const transactionSignature = await burn(
        connection,
        payer,
        account,
        mint,
        owner,
        amount
    );

    console.log(`Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}
```

Lets call the function in `main` using the `mint`, `receiver`, and `receiverTokenAccount` created previously.

```tsx
async function main() {
	...

    await burnTokens(
        connection,
        receiver,
        receiverTokenAccount.address,
        mint,
        receiver,
        100
    );
}
```

**Close Tokens**

Token Accounts with a zero balance can be closed by the Token Account owner and have the rent of the Token Account returned to the owner.

Import `closeAccount` from `@solana/spl-token` and then create a function to call `closeAccount`.

```tsx
import {closeAccount} from "@solana/spl-token";

async function closeTokenAccount(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    destination: web3.PublicKey,
    authority: web3.Keypair
    ) {const transactionSignature = await closeAccount(
        connection,
        payer,
        account,
        destination,
        authority
    );

    console.log(`Close Account Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}
```

Lets call the function in `main` using the `receiver`, and `receiverTokenAccount` created previously.

```tsx
async function main() {
	...

    await closeTokenAccount(
        connection,
        receiver,
        receiverTokenAccount.address,
        receiver.publicKey,
        receiver
    );
}
```

**Overview**

Our `main` function should now look something like this:

```tsx
async function main() {
    const user = initializeKeypair();
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));
    await connection.requestAirdrop(user.publicKey, web3.LAMPORTS_PER_SOL * 2);

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    );

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    );

    await mintTokens(connection, user, mint, tokenAccount.address, user, 100);

    const receiver = web3.Keypair.generate();
    await connection.requestAirdrop(
        receiver.publicKey,
        web3.LAMPORTS_PER_SOL * 1
    );

    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver.publicKey
    );

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        user,
        100
    );

    await burnTokens(
        connection,
        receiver,
        receiverTokenAccount.address,
        mint,
        receiver,
        100
    );

    await closeTokenAccount(
        connection,
        receiver,
        receiverTokenAccount.address,
        receiver.publicKey,
        receiver
    );
}
```

Run `npm start`.

Copy and paste the URLS to Solana Explorer to see the sequence of transactions!

# Challenge

*Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently*

**Challenge Code: [https://github.com/ZYJLiu/solana-token-frontend](https://github.com/ZYJLiu/solana-token-frontend)**

Now it’s your turn to build something independently. Create an application that allows a users to create a new mint, create a token account, and mint tokens.

Note that you will not be able to directly use the functions we went over in the demo. In order to interact with the token program using the Phantom wallet adapter, you will have to build each transaction manually and submit the transaction to Phantom for approval. You can build each transaction by referencing the overview.

Transactions can be sent to Phantom for approving using the following format:

```tsx
sendTransaction(transaction, connection)
```

When creating a new mint, the newly generated `Keypair` will also have to sign the transaction. If additional signers are required in addition the the connected Phantom wallet, use the following format:

```tsx
sendTransaction(transaction, connection, {
    signers: [Keypair],
})
```

![Screenshot of Token Program Challenge Frontend](../assets/token-program-frontend.png)

---
title: Create Tokens With The Token Program
objectives:
- Create token mints
- Create token accounts
- Mint tokens
- Transfer tokens
- Burn tokens
---

# TL;DR

- **SPL-Tokens** represent all non-native tokens on the Solana network. Both fungible and non-fungible tokens (NFTs) on Solana are SPL-Tokens
- The **Token Program** contains instructions for creating and interacting with SPL-Tokens
- **Token Mints** are accounts which hold data about a specific Token, but do not hold Tokens
- **Token Accounts** are used to hold Tokens of a specific Token Mint
- Creating Token Mints and Token Accounts requires allocating **rent** in SOL. The rent for a Token Account can be refunded when the account is closed, however, Token Mints currently cannot be closed

# Overview

The Token Program is one of many programs made available by the Solana Program Library (SPL). It contains instructions for creating and interacting with SPL-Tokens. These tokens represent all non-native (i.e. not SOL) tokens on the Solana network.

This lesson will focus on the basics of creating and managing a new SPL-Token using the Token Program:
1. Creating a new Token Mint
2. Creating Token Accounts
3. Minting
4. Transferring tokens from one holder to another
5. Burning tokens

We'll be approaching this from the client-side of the development process using the `@solana/spl-token` Javascript library.

## Token Mint

To create a new SPL-Token you first have to create a Token Mint. A Token Mint is the account that holds data about a specific token.

As an example, let's look at [USD Coin (USDC) on the Solana Explorer](https://explorer.solana.com/address/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v). USDC's Token Mint address is `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`. With the explorer, we can see the particular details about USDC's Token Mint such as the current supply of tokens, the addresses of the mint and freeze authorities, and the decimal precision of the token:

![Screenshot of USDC Token Mint](../assets/token-program-usdc-mint.png)

To create a new Token Mint, you need to send the right transaction instructions to the Token Program. To do this, we'll use the `createMint` function from `@solana/spl-token`.

```tsx
const tokenMint = await createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimal
);
```

 The `createMint` function returns the `publicKey` of the new token mint. This function requires the following arguments:

- `connection` - the JSON-RPC connection to the cluster
- `payer` - the public key of the payer for the transaction
- `mintAuthority` - the account which is authorized to do the actual minting of tokens from the token mint.
- `freezeAuthority` - an account authorized to freeze the tokens in a token account. If freezing is not a desired attribute, the parameter can be set to null
- `decimals` - specifies the desired decimal precision of the token

When creating a new mint from a script that has access to your secret key, you can simply use the `createMint` function. However, if you were to build a website to allow users to create a new token mint, you would need to do so with the user's secret key without making them expose it to the browser. In that case, you would want to build and submit a transaction with the right instructions.

Under the hood, the `createMint` function is simply creating a transaction that contains two instructions:
1. Create a new account
2. Initialize a new mint

This would look as follows:

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateMintTransaction(
    connection: web3.Connection,
    payer: web3.PublicKey,
    decimals: number
): Promise<web3.Transaction> {
    const lamports = await token.getMinimumBalanceForRentExemptMint(connection);
    const accountKeypair = web3.Keypair.generate();
    const programId = token.TOKEN_PROGRAM_ID

    const transaction = new web3.Transaction().add(
        web3.SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: accountKeypair.publicKey,
            space: token.MINT_SIZE,
            lamports,
            programId,
        }),
        token.createInitializeMintInstruction(
            accountKeypair.publicKey,
            decimals,
            payer,
            payer,
            programId
        )
    );

    return transaction
}
```

When manually building the instructions to create a new token mint, make sure you add the instructions for creating the account and initializing the mint to the *same transaction*. If you were to do each step in a separate transaction, it's theoretically possible for somebody else to take the account you create and initialize it for their own mint.

### Rent and Rent Exemption
Note that the first line in the function body of the previous code snippet contains a call to `getMinimumBalanceForRentExemptMint`, the result of which is passed into the `createAccount` function. This is part of account initialization called rent exemption.

Until recently, all accounts on Solana were required to do one of the following to avoid being deallocated:
1. Pay rent at specific intervals
2. Deposit enough SOL upon initialization to be considered rent-exempt

Recently, the first option was done away with and it became a requirement to deposit enough SOL for rent exemption when initializing a new account.

In this case, we're creating a new account for a token mint so we use `getMinimumBalanceForRentExemptMint` from the `@solana/spl-token` library. However, this concept applies to all accounts and you can use the more generic `getMinimumBalanceForRentExemption` method on `Connection` for other accounts you may need to create.

## Token Account

Before you can mint tokens (issue new supply), you need a Token Account to hold the newly issued tokens.

A Token Account holds tokens of a specific "mint" and has a specified "owner" of the account. Only the owner is authorized to decrease the Token Account balance (transfer, burn, etc.) while anyone can send tokens to the Token Account to increase its balance.

You can use the `spl-token` library's `createAccount` function to create the new Token Account:

```tsx
const tokenAccount = await createAccount(
    connection,
    payer,
    mint,
    owner,
    keypair
);
```

The `createAccount` function returns the `publicKey` of the new token account. This function requires the following arguments:

- `connection` - the JSON-RPC connection to the cluster
- `payer` - the account of the payer for the transaction
- `mint` - the token mint that the new token account is associated with
- `owner` - the account of the owner of the new token account
- `keypair` - this is an optional parameter for specifying the new token account address. If no keypair is provided, the `createAccount` function defaults to a derivation from the associated `mint` and `owner` accounts.

Please note that this `createAccount` function is different from the `createAccount` function shown above when we looked under the hood of the `createMint` function. Previously we used the `createAccount` function on `SystemProgram` to return the instruction for creating all accounts. The `createAccount` function here is a helper function in the `spl-token` library that submits a transaction with two instructions. The first creates the account and the second initializes the account as a Token Account.

Like with creating a Token Mint, if we needed to build the transaction for `createAccount` manually we could duplicate what the function is doing under the hood:
1. Use `getMint` to retrieve the data associated with the `mint`
2. Use `getAccountLenForMint` to calculate the space needed for the token account
3. Use `getMinimumBalanceForRentExemption` to calculate the lamports needed for rent exemption
4. Create a new transaction using `SystemProgram.createAccount` and `createInitializeAccountInstruction`. Note that this `createAccount` is from `@solana/web3.js` and used to create a generic new account. The `createInitializeAccountInstruction` uses this new account to initialize the new token account

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateTokenAccountTransaction(
    connection: web3.Connection,
    payer: web3.PublicKey,
    mint: web3.PublicKey
): Promise<web3.Transaction> {
    const mintState = await token.getMint(connection, mint)
    const accountKeypair = await web3.Keypair.generate()
    const space = token.getAccountLenForMint(mintState);
    const lamports = await connection.getMinimumBalanceForRentExemption(space);
    const programId = token.TOKEN_PROGRAM_ID

    const transaction = new web3.Transaction().add(
        web3.SystemProgram.createAccount({
            fromPubkey: payer,
            newAccountPubkey: accountKeypair.publicKey,
            space,
            lamports,
            programId,
        }),
        token.createInitializeAccountInstruction(
            accountKeypair.publicKey,
            mint,
            payer,
            programId
        )
    );

    return transaction
}
```

### Associated Token Account

An Associated Token Account is a Token Account where the address of the Token Account is derived using an owner's public key and a token mint. Associated Token Accounts provide a deterministic way to find the Token Account owned by a specific `publicKey` for a specific token mint. Most of the time you create a Token Account, you'll want it to be an Associated Token Account.

Similar to above, you can create an associated token account using the `spl-token` library's `createAssociatedTokenAccount` function.

```tsx
const associatedTokenAccount = await createAssociatedTokenAccount(
    connection,
	payer,
	mint,
	owner,
);
```

This function returns the `publicKey` of the new associated token account and requires the following arguments:

- `connection` - the JSON-RPC connection to the cluster
- `payer` - the account of the payer for the transaction
- `mint` - the token mint that the new token account is associated with
- `owner` - the account of the owner of the new token account

You can also use `getOrCreateAssociatedTokenAccount` to get the Token Account associated with a given address or create it if it doesn't exist. For example, if you were writing code to airdrop tokens to a given user, you'd likely use this function to ensure that the token account associated with the given user gets created if it doesn't already exist.

Under the hood, `createAssociatedTokenAccount` is doing two things:

1. Using `getAssociatedTokenAddress` to derive the associated token account address from the `mint` and `owner`
2. Building a transaction using instructions from `createAssociatedTokenAccountInstruction`

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildCreateAssociatedTokenAccountTransaction(
    payer: web3.PublicKey,
    mint: web3.PublicKey
): Promise<web3.Transaction> {
    const associatedTokenAddress = await token.getAssociatedTokenAddress(mint, payer, false);

    const transaction = new web3.Transaction().add(
        token.createAssociatedTokenAccountInstruction(
            payer,
            associatedTokenAddress,
            payer,
            mint
        )
    )

    return transaction
}
```

## Mint Tokens

Minting tokens is the process of issuing new tokens into circulation. When you mint tokens, you increase the supply of the token mint and deposit the newly minted tokens into a token account. Only the mint authority of a token mint is allowed to mint new tokens.

To mint tokens using the `spl-token` library, you can use the `mintTo` function.

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

The `mintTo` function returns a `TransactionSignature` that can be viewed on the Solana Explorer. The `mintTo` function requires the following arguments:

- `connection` - the JSON-RPC connection to the cluster
- `payer` - the account of the payer for the transaction
- `mint` - the token mint that the new token account is associated with
- `destination` - the token account that tokens will be minted to
- `authority` - the account authorized to mint tokens
- `amount` - the raw amount of tokens to mint outside of decimals, e.g. if Scrooge Coin mint's decimals property was set to 2 then to get 1 full Scrooge Coin you would need to set this property to 100

It's not uncommon to update the mint authority on a token mint to null after the tokens have been minted. This would set a maximum supply and ensure no tokens can be minted in the future. Conversely, minting authority could be granted to a program so tokens could be automatically minted at regular intervals or according to programmable conditions.

Under the hood, the `mintTo` function simply creates a transaction with the instructions obtained from the `createMintToInstruction` function.

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildMintToTransaction(
    authority: web3.PublicKey,
    mint: web3.PublicKey,
    amount: number,
    destination: web3.PublicKey
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createMintToInstruction(
            mint,
            destination,
            authority,
            amount
        )
    )

    return transaction
}
```

## Transfer Tokens

SPL-Token transfers require both the sender and receiver to have token accounts for the mint of the tokens being transferred. The tokens are transferred from the sender’s token account to the receiver’s token account.

You can use `getOrCreateAssociatedTokenAccount` when obtaining the receiver's associated token account to ensure their token account exists before the transfer. Just remember that if the account doesn't exist already, this function will create it and the payer on the transaction will be debited the lamports required for the account creation.

Once you know the receiver's token account address, you transfer tokens using the `spl-token` library's `transfer` function.

```tsx
const transactionSignature = await transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
)
```

The `transfer` function returns a `TransactionSignature` that can be viewed on the Solana Explorer. The `transfer` function requires the following arguments:

- `connection` the JSON-RPC connection to the cluster
- `payer` the account of the payer for the transaction
- `source` the token account sending tokens
- `destination` the token account receiving tokens
- `owner` the account of the owner of the `source` token account
- `amount` the amount of tokens to transfer


Under the hood, the `transfer` function simply creates a transaction with the instructions obtained from the `createTransferInstruction` function:

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildTransferTransaction(
    source: web3.PublicKey,
    destination: web3.PublicKey,
    owner: web3.PublicKey,
    amount: number
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createTransferInstruction(
            source,
            destination,
            owner,
            amount,
        )
    )

    return transaction
}
```

## Burn Tokens

Burning tokens is the process of decreasing the token supply of a given token mint. Burning tokens removes them from the given token account and from broader circulation.

To burn tokens using the `spl-token` library, you use the `burn` function.

```tsx
const transactionSignature = await burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount
)
```

The `burn` function returns a `TransactionSignature` that can be viewed on Solana Explorer. The `burn` function requires the following arguments:

- `connection` the JSON-RPC connection to the cluster
- `payer` the account of the payer for the transaction
- `account` the token account to burn tokens from
- `mint` the token mint associated with the token account
- `owner` the account of the owner of the token account
- `amount` the amount of tokens to burn

Under the hood, the `burn` function creates a transaction with instructions obtained from the `createBurnInstruction` function:

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildBurnTransaction(
    account: web3.PublicKey,
    mint: web3.PublicKey,
    owner: web3.PublicKey,
    amount: number
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createBurnInstruction(
            account,
            mint,
            owner,
            amount
        )
    )

    return transaction
}
```

## Approve Delegate

Approving a delegate is the process of authorizing another account to transfer or burn tokens from a token account. When using a delegate, the authority over the token account remains with the original owner. The maximum amount of tokens a delegate may transfer or burn is specified at the time the owner of the token account approves the delegate. Note that there can only be one delegate account associated with a token account at any given time.

To approve a delegate using the `spl-token` library, you use the `approve` function.

```tsx
const transactionSignature = await approve(
    connection,
    payer,
    account,
    delegate,
    owner,
    amount
  )
```

The `approve` function returns a `TransactionSignature` that can be viewed on Solana Explorer. The `approve` function requires the following arguments:

- `connection` the JSON-RPC connection to the cluster
- `payer` the account of the payer for the transaction
- `account` the token account to delegate tokens from
- `delegate` the account the owner is authorizing to transfer or burn tokens
- `owner` the account of the owner of the token account
- `amount` the maximum number of tokens the delegate may transfer or burn

Under the hood, the `approve` function creates a transaction with instructions obtained from the `createApproveInstruction` function:

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildApproveTransaction(
    account: web3.PublicKey,
    delegate: web3.PublicKey,
    owner: web3.PublicKey,
    amount: number
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createApproveInstruction(
            account,
            delegate,
            owner,
            amount
        )
    )

    return transaction
}
```

## Revoke Delegate

A previously approved delegate for a token account can be later revoked. Once a delegate is revoked, the delegate can no longer transfer tokens from the owner's token account. Any remaining amount left untransferred from the previously approved amount can no longer be transferred by the delegate.

To revoke a delegate using the `spl-token` library, you use the `revoke` function.

```tsx
const transactionSignature = await revoke(
    connection,
    payer,
    account,
    owner,
  )
```

The `revoke` function returns a `TransactionSignature` that can be viewed on Solana Explorer. The `revoke` function requires the following arguments:

- `connection` the JSON-RPC connection to the cluster
- `payer` the account of the payer for the transaction
- `account` the token account to revoke the delegate authority from
- `owner` the account of the owner of the token account

Under the hood, the `revoke` function creates a transaction with instructions obtained from the `createRevokeInstruction` function:

```tsx
import * as web3 from '@solana/web3'
import * as token from '@solana/spl-token'

async function buildRevokeTransaction(
    account: web3.PublicKey,
    owner: web3.PublicKey,
): Promise<web3.Transaction> {
    const transaction = new web3.Transaction().add(
        token.createRevokeInstruction(
            account,
            owner,
        )
    )

    return transaction
}
```

# Demo

We’re going to create a script that interacts with instructions on the Token Program. We will create a Token Mint, create Token Accounts, mint tokens, approve a delegate, transfer tokens, and burn tokens.

### 1. Basic scaffolding

Let’s start with some basic scaffolding. You’re welcome to set up your project however feels most appropriate for you, but we’ll be using a simple Typescript project with a dependency on the `@solana/web3.js` and `@solana/spl-token` packages.

You can use `npx create-solana-client [INSERT_NAME_HERE]` in the command line to clone the template we'll be starting from. Or you can manually clone the template [here](https://github.com/Unboxed-Software/solana-client-template).

You'll then need to add a dependency on `@solana/spl-token`. From the command line inside the newly created directory, use the command `npm install @solana/spl-token`.

### 2. Create Token Mint

We'll be using the `@solana/spl-token` library, so let's start by importing it at the top of the file.

```tsx
import * as token from '@solana/spl-token'
```

Next, declare a new function `createNewMint` with parameters `connection`, `payer`, `mintAuthority`, `freezeAuthority`, and `decimals`.

In the body of the function
Import `createMint` from `@solana/spl-token` and then create a function to call `createMint`:

```tsx
async function createNewMint(
    connection: web3.Connection,
    payer: web3.Keypair,
    mintAuthority: web3.PublicKey,
    freezeAuthority: web3.PublicKey,
    decimals: number
): Promise<web3.PublicKey> {

    const tokenMint = await token.createMint(
        connection,
        payer,
        mintAuthority,
        freezeAuthority,
        decimals
    );

    console.log(
        `Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`
    );

    return tokenMint;
}
```

With that function completed, call it from the body of `main`, setting `user` as the `payer`, `mintAuthority`, and `freezeAuthority`.

After creating the new mint, let's fetch the account data using the `getMint` function and store it in a variable called `mintInfo`. We'll use this data later to adjust input `amount` for the decimal precision of the mint.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);
}
```

### 3. Create Token Account

Now that we've created the mint, lets create a new Token Account, specifying the `user` as the `owner`.

The `createAccount` function creates a new Token Account with the option to specify the address of the Token Account. Recall that if no address is provided, `createAccount` will default to using the associated token account derived using the `mint` and `owner`.

Alternatively, the function `createAssociatedTokenAccount` will also create an associated token account with the same address derived from the `mint` and `owner` public keys.

For our demo we’ll use the`getOrCreateAssociatedTokenAccount` function to create our token account. This function gets the address of a Token Account if it already exists. If it doesn't, it will create a new Associated Token Account at the appropriate address.

```tsx
async function createTokenAccount(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    owner: web3.PublicKey
) {
    const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner
    )

    console.log(
        `Token Account: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`
    )

    return tokenAccount
}
```

Add a call the `createTokenAccount` in `main`, passing in the mint we created in the previous step and setting the `user` as the `payer` and `owner`.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )
}
```

### 4. Mint Tokens

Now that we have a token mint and a token account, lets mint tokens to the token account. Note that only the `mintAuthority` can mint new tokens to a token account. Recall that we set the `user` as the `mintAuthority` for the `mint` we created.

Create a function `mintTokens` that uses the `spl-token` function `mintTo` to mint tokens:

```tsx
async function mintTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    mint: web3.PublicKey,
    destination: web3.PublicKey,
    authority: web3.Keypair,
    amount: number
) {
    const transactionSignature = await token.mintTo(
        connection,
        payer,
        mint,
        destination,
        authority,
        amount
    )

    console.log(
        `Mint Token Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```

Lets call the function in `main` using the `mint` and `tokenAccount` created previously.

Note that we have to adjust the input `amount` for the decimal precision of the mint. Tokens from our `mint` have a decimal precision of 2. If we only specify 100 as the input `amount`, then only 1 token will be minted to our token account.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )
}
```

### 5. Approve Delegate

Now that we have a token mint and a token account, lets authorize a delegate to transfer tokens on our behalf.

Create a function `approveDelegate` that uses the `spl-token` function `approve` to mint tokens:

```tsx
async function approveDelegate(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    delegate: web3.PublicKey,
    owner: web3.Signer | web3.PublicKey,
    amount: number
) {
    const transactionSignature = await token.approve(
        connection,
        payer,
        account,
        delegate,
        owner,
        amount
  )

    console.log(
        `Approve Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```

In `main`, lets generate a new `Keypair` to represent the delegate account. Then, lets call our new `approveDelegate` function and authorize the delegate to tranfer up to 50 tokens from the `user` token account. Remember to adjust the `amount` for the decimal precision of the `mint`.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const delegate = web3.Keypair.generate();

    await approveDelegate(
      connection,
      user,
      tokenAccount.address,
      delegate.publicKey,
      user.publicKey,
      50 * 10 ** mintInfo.decimals
    )
}
```

### 6. Transfer Tokens

Next, lets transfer some of the tokens we just minted using the `spl-token` library's `transfer` function.

```tsx
async function transferTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    source: web3.PublicKey,
    destination: web3.PublicKey,
    owner: web3.Keypair,
    amount: number
) {
    const transactionSignature = await token.transfer(
        connection,
        payer,
        source,
        destination,
        owner,
        amount
    )

    console.log(
        `Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```

Before we can call this new function, we need to know the account into which we'll transfer the tokens.

In `main`, lets generate a new `Keypair` to be the receiver (but remember that this is just to simulate having someone to send tokens to - in a real application you'd need to know the wallet address of the person receiving the tokens).

Then, create a token account for the receiver. Finally, lets call our new `transferTokens` function to transfer tokens from the `user` token account to the `receiver` token account. We'll use the `delegate` we approved in the previous step to perform the transfer on our behalf.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    const mintInfo = await token.getMint(connection, mint);

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const receiver = web3.Keypair.generate().publicKey
    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver
    )

    const delegate = web3.Keypair.generate();
    await approveDelegate(
        connection,
        user,
        tokenAccount.address,
        delegate.publicKey,
        user.publicKey,
        50 * 10 ** mintInfo.decimals
    )

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        delegate,
        50 * 10 ** mintInfo.decimals
    )
}
```

### 7. Revoke Delegate

Now that we've finished transferring tokens, lets revoke the `delegate` using the `spl-token` library's `revoke` function.

```tsx
async function revokeDelegate(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    owner: web3.Signer | web3.PublicKey,
) {
    const transactionSignature = await token.revoke(
        connection,
        payer,
        account,
        owner,
  )

    console.log(
        `Revote Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```

Revoke will set delegate for the token account to null and reset the delegated amount to 0. All we will need for this function is the token account and user. Lets call our new `revokeDelegate` function to revoke the delegate from the `user` token account.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const receiver = web3.Keypair.generate().publicKey
    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver
    )

    const delegate = web3.Keypair.generate();
    await approveDelegate(
        connection,
        user,
        tokenAccount.address,
        delegate.publicKey,
        user.publicKey,
        50 * 10 ** mintInfo.decimals
    )

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        delegate,
        50 * 10 ** mintInfo.decimals
    )

    await revokeDelegate(
        connection,
        user,
        tokenAccount.address,
        user.publicKey,
    )
}
```

### 8. Burn Tokens

Finally, let's remove some tokens from circulation by burning them.

Create a `burnTokens` function that uses the `spl-token` library's `burn` function to remove half of your tokens from circulation.

```tsx
async function burnTokens(
    connection: web3.Connection,
    payer: web3.Keypair,
    account: web3.PublicKey,
    mint: web3.PublicKey,
    owner: web3.Keypair,
    amount: number
) {
    const transactionSignature = await token.burn(
        connection,
        payer,
        account,
        mint,
        owner,
        amount
    )

    console.log(
        `Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
    )
}
```

Now call this new function in `main` to burn 25 of the user's tokens. Remember to adjust the `amount` for the decimal precision of the `mint`.

```tsx
async function main() {
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)

    const mint = await createNewMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        2
    )

    const mintInfo = await token.getMint(connection, mint);

    const tokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        user.publicKey
    )

    await mintTokens(
        connection,
        user,
        mint,
        tokenAccount.address,
        user,
        100 * 10 ** mintInfo.decimals
    )

    const receiver = web3.Keypair.generate().publicKey
    const receiverTokenAccount = await createTokenAccount(
        connection,
        user,
        mint,
        receiver
    )

    const delegate = web3.Keypair.generate();
    await approveDelegate(
        connection,
        user,
        tokenAccount.address,
        delegate.publicKey,
        user.publicKey,
        50 * 10 ** mintInfo.decimals
    )

    await transferTokens(
        connection,
        user,
        tokenAccount.address,
        receiverTokenAccount.address,
        delegate,
        50 * 10 ** mintInfo.decimals
    )

    await revokeDelegate(
        connection,
        user,
        tokenAccount.address,
        user.publicKey,
    )

    await burnTokens(
        connection, 
        user, 
        tokenAccount.address, 
        mint, user, 
        25 * 10 ** mintInfo.decimals
    )
}
```
### 9. Test it all out

With that, run `npm start`. You should see a series of Solana Explorer links logged to the console. Click on them and see what happened each step of the way! You created a new token mint, created a token account, minted 100 tokens, approved a delegate, transferred 50 using a delegate, revoked the delegate, and burned 25 more. You're well on your way to being a token expert.

If you need a bit more time with this project to feel comfortable, have a look at the complete [solution code](https://github.com/Unboxed-Software/solana-token-client)

# Challenge

Now it’s your turn to build something independently. Create an application that allows a users to create a new mint, create a token account, and mint tokens.

Note that you will not be able to directly use the helper functions we went over in the demo. In order to interact with the Token Program using the Phantom wallet adapter, you will have to build each transaction manually and submit the transaction to Phantom for approval.

![Screenshot of Token Program Challenge Frontend](../assets/token-program-frontend.png)

1. You can build this from scratch or you can download the starter code [here](https://github.com/Unboxed-Software/solana-token-frontend/tree/starter).
2. Create a new Token Mint in the `CreateMint` component.
    If you need a refresher on how to send transactions to a wallet for approval, have a look at the [Wallets lesson](./interact-with-wallets.md).

    When creating a new mint, the newly generated `Keypair` will also have to sign the transaction. When additional signers are required in addition to the connected wallet, use the following format:

    ```tsx
    sendTransaction(transaction, connection, {
        signers: [Keypair],
    })
    ```
3. Create a new Token Account in the `CreateTokenAccount` component.
4. Mint tokens in the `MintToForm` component.

If you get stumped, feel free to reference the [solution code](https://github.com/ZYJLiu/solana-token-frontend).

And remember, get creative with these challenges and make them your own!

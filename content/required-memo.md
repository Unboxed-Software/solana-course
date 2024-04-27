---
title: Required Memo
objectives:
 - Create token account with required memo on transfer
 - Transfer with memo
 - Transfer without memo
 - Disable required memo 
---

# Summary

- The `required memo` extension allows developers to mandate that all incoming transfers to a token account include a memo, facilitating enhanced transaction tracking and user identification.
- When a transfer is initiated without a memo, the transaction will fail.
- The `required memo` extension can be disabled by calling `disableRequiredMemoTransfers`.
- This demonstration includes the creation of a token account that necessitates memos for all incoming transfers, alongside tests to verify the extension's functionality in enforcing memo inclusion for transactions.

# Overview

For certain applications, such as exchanges or financial services, tracking the purpose or origin of a transaction is crucial. The `required memo` extension specifies that a memo is necessary for every incoming transfer to a token account. This requirement ensures that each transaction is accompanied by additional information, which can be used for compliance, auditing, or user-specific purposes. If the need for strict tracking diminishes, the requirement can be adjusted to make memos optional, offering flexibility in how transactions are handled and recorded.

## Creating token with required memo

Initializing a token account with required memo involves three instructions:

- `SystemProgram.createAccount`
- `initializeAccountInstruction`
- `createEnableRequiredMemoTransfersInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the token account. This instruction accomplishes three things:

- Allocates `space`
- Transfers `lamports` for rent
- Assigns to it's owning program

```tsx
const accountLen = getAccountLen([ExtensionType.MemoTransfer]);
const lamports = await connection.getMinimumBalanceForRentExemption(accountLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey, 
  newAccountPubkey: tokenAccountKeypair.publicKey,
  space: accountLen, 
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

The second instruction `createInitializeAccountInstruction` initializes the account instruction.

```tsx
const initializeAccountInstruction = createInitializeAccountInstruction(
  tokenAccountKeypair.publicKey,
  mint,
  payer.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

The third instruction `createEnableRequiredMemoTransfersInstruction` initializes the token account with required memo.

```tsx
const enableRequiredMemoTransfersInstruction =
  createEnableRequiredMemoTransfersInstruction(
    tokenAccountKeypair.publicKey,
    payer.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
```

When the transaction with these three instructions is sent, a new token account is created with the required memo extension.

```tsx
 const transaction = new Transaction().add(
    createAccountInstruction,
    initializeAccountInstruction,
    enableRequiredMemoTransfersInstruction,
  );

  const transactionSignature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [payer, tokenAccountKeypair], // Signers
  );
```

## Disabling Required Memo
The required memo extension can be disabled given you have the authority to modify the token account. To do this, simply call the `disableRequiredMemoTransfers` function and pass in the required arguments. 

```tsx
/**
 * Disable memo transfers on the given account
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param account        Account to modify
 * @param owner          Owner of the account
 * @param multiSigners   Signing accounts if `owner` is a multisig
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
  await disableRequiredMemoTransfers(
    connection,
    payer,
    otherTokenAccount,
    payer,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
```

# Lab

In this lab we'll be creating a token account with the required memo extension. We'll then write tests to check if the extension is working as intended by attempting to transfer funds with and without a memo. 

### 1. Setup Environment

Clone the lab and change branches to `starter` and install the necessary dependencies:

```bash
git clone git@github.com:Unboxed-Software/solana-lab-required-memo.git
cd solana-lab-required-memo
git checkout starter
npm install
```

### 2. Run validator node
For the sake of this guide, we'll be running our own validator node.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is `http://127.0.0.1:8899`. We then use that in the connection to specify to use the local RPC URL.

`const connection = new Connection("http://127.0.0.1:8899", "confirmed");`

Alternatively, if you’d like to use testnet or devnet, import the `clusterApiUrl` from `@solana/web3.js` and pass it to the connection as such:

`const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');`
If you decide to use devnet, and have issues with airdropping SOL. Feel free to add the `keypairPath` parameter to `initializeKeypair`. You can get this from running `solana config get` in your terminal. And then go to [faucet.solana.com](faucet.solana.com) and airdrop some SOL to your address. You can get your address from running `solana address` in your terminal.

### 3. Helpers

When you clone the repo and change to the `starter` branch, we'll already have access to a token helper function along with 2 helper functions provided by the `@solana-developers/helpers` package.

- `token-helper.ts`: This helper named `createTokenWithMemoExtension` will facilitate in the creation of the token accounts needed to run our tests against the required memo extension
- `initializeKeypair`: This function creates the keypair for the `payer` and also airdrops 1 testnet SOL to it
- `makeKeypairs`: This function creates keypairs without airdropping any SOL

### 4. Create the mint

Inside of `src/index.ts`, the required dependencies will already be imported, along with some keypair and amount variables. Add the following `createMint` function beneath the existing code:

```tsx
	// CREATE MINT
   const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    mintDecimals,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
```

### 5. Create Token Account with required memo

Inside of the `src` directory, you will see a file named `token-helper.ts`. Inside of the token helper, there is an asynchronous function named `createTokenWithMemoExtension`. This function is where we'll be creating the associated token account with the required memo.  The function will take the following arguments:

- `connection` : The connection object
- `mint` : Public key for the new mint
- `payer` : Payer for the transaction
- `tokenAccountKeypair` : The token account keypair associated with the token account

The first step in creating the token account is reserving space on Solana with the `SystemProgram.createAccount` method. This requires specifying the payer's keypair, (the account that will fund the creation and provide SOL for rent exemption), the new token account's public key (`mintKeypair.publicKey`), the space required to store the mint information on the blockchain, the amount of SOL (lamports) necessary to exempt the account from rent and the ID of the token program that will manage this mint account (`TOKEN_2022_PROGRAM_ID`).

```tsx
const accountLen = getAccountLen([ExtensionType.MemoTransfer]);
const lamports = await connection.getMinimumBalanceForRentExemption(accountLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: tokenAccountKeypair.publicKey,
  space: accountLen,
  lamports, 
  programId: TOKEN_2022_PROGRAM_ID,
});

```

We then add the initialize account instruction by calling `createInitializeAccountInstruction` and passing in the required arguments. This function is provided by the SPL Token package and it constructs a transaction instruction that initializes a new token account.

```tsx
const initializeAccountInstruction = createInitializeAccountInstruction(
  tokenAccount,
  mint,
  owner.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

After the token account creation, the next step involves initializing it with the required memo extension. The `createEnableRequiredMemoTransfersInstruction` function is used to generate an instruction that enables the token account to require memos for all incoming transfers. This means that any transfer of tokens into the account must include a memo, which is a small piece of data attached to the transaction.

```tsx
const enableRequiredMemoTransfersInstruction =
  createEnableRequiredMemoTransfersInstruction(
    tokenAccountKeypair.publicKey,
    payer.publicKey,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
```

Now that the account and all of the instructions have been created, the token account can be created with required memo on transfers.

```tsx
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeAccountInstruction,
  enableRequiredMemoTransfersInstruction,
);

const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, tokenAccountKeypair], // Signers
);
```

Now that we’ve added the functionality for `token-helper`, we can create two variables for the token accounts. When we use the `createTokenWithMemoExtension` function we created, it explicitly adds the instructions to add required memos to the token account. This helper will create an associated token account which by default includes required memo when transferring. 

Back in `index.ts` underneath the `mint` variable, create 2 token accounts. One for `ourTokenAccountKeypair` and one for `otherTokenAccountKeypair`. We then mint 1000 tokens to `ourTokenAccountKeypair`:

```
// CREATE TOKENS
await createTokenWithMemoExtension(
  connection,
  payer,
  ourTokenAccountKeypair,
  mint
);

await createTokenWithMemoExtension(
  connection,
  payer,
  otherTokenAccountKeypair,
  mint
);

 await mintTo(
  connection,
  payer,
  mint,
  ourTokenAccount,
  payer,
  amountToMint,
  undefined,
  undefined,
  TOKEN_2022_PROGRAM_ID
)
```

Thats it for the token accounts! We have minted tokens to `ourTokenAccountKeypair` and can now move on and start testing that the extensions rules are applied correctly by running a few tests against it.

### 6. Tests
Now that we have the ability to create a token account with a required for all of it's transfers, let's write some tests to see how it functions.

We'll write 3 tests in total:

- Transferring without a memo
- Transferring with a memo
- Disabling Required Memo extension and transferring without a memo

### 6.1 Transfer without Memo
This test will attempt to transfer tokens from `ourTokenAccount` to `otherTokenAccount`. This test is expected to fail as there is no memo attached to the transaction. Remember: When the `required memo` extension is enabled on a token account, a memo must associated with that transaction.

```tsx
// ATTEMPT TO TRANSFER WITHOUT MEMO
try {
  const transaction = new Transaction().add(
    createTransferInstruction(
      ourTokenAccount,
      otherTokenAccount,
      payer.publicKey,
      amountToTransfer,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, transaction, [payer]);

  console.error("You should not be able to transfer without a memo.");

} catch (error) {
  console.log(
    `✅ - We expected this to fail because you need to send a memo with the transfer.`
  );
}
```

Run `npm run start`. We should see the following error logged out in the terminal, meaning the extension is working as intended: `✅ - We expected this to fail because you need to send a memo with the transfer.`

### 6.2 Test transfer with memo
This test will attempt to transfer tokens with a memo. This test is expected to pass. Pay extra attention to the following code block. It is the part of the transaction that adds the memo instruction to it:

```tsx
const message = "Hello, Solana"

new TransactionInstruction({
  keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
  data: Buffer.from(message, "utf-8"), 
  // Memo message. In this case it is "Hello, Solana"
  programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), 
  // Memo program that validates keys and memo message
}),
```

Below the previous test, add the following code block:

```tsx
// ATTEMPT TO TRANSFER WITH MEMO
try {
  const message = "Hello, Solana"

  const transaction = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
      data: Buffer.from(message, "utf-8"), // Memo message. In this case it is "Hello, Solana"
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), // Memo program that validates keys and memo message
    }),

    createTransferInstruction(
      ourTokenAccount,
      otherTokenAccount,
      payer.publicKey,
      amountToTransfer,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
  );
  await sendAndConfirmTransaction(connection, transaction, [payer]);

  const account = await getAccount(
    connection,
    otherTokenAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID
  )

  console.log(
    `✅ - We have transferred ${account.amount} tokens to ${otherTokenAccount} with the memo: ${message}`
  );

} catch (error) {
  console.log(error)
}
```
Run `npm run start`. We'll see that this test has passed and the transfer has succeeded.

### 6.3 Test transfer with disabled memo

Now we'll test that the extension can be disabled which will remove the requirement of adding a memo to the transaction. Then we'll transfer some tokens from `ourTokenAccount` to `otherTokenAccount`.

We do this by using the `disableRequiredMemoTransfers` function provided by the `@solana/spl-token` library.

```ts
 await disableRequiredMemoTransfers(
    connection,
    payer,
    otherTokenAccount,
    payer,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
```

Up to this point the first test failed due to no memo added to the transaction. The second test succeeded, transferring `otherTokenAccount` 300 tokens. 

Add the following code to your `index.ts`:

```tsx
// DISABLE MEMO EXTENSION AND TRANSFER
try {

  await disableRequiredMemoTransfers(
    connection,
    payer,
    otherTokenAccount,
    payer,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Transfer tokens to otherTokenAccount
  const transfer = new Transaction().add(
    createTransferInstruction(
      ourTokenAccount,
      otherTokenAccount,
      payer.publicKey,
      amountToTransfer,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
  );

  await sendAndConfirmTransaction(connection, transfer, [payer]);

  const account = await getAccount(
    connection,
    otherTokenAccount,
    undefined,
    TOKEN_2022_PROGRAM_ID
  )

  // Re-enable memo transfers to show it exists 
  await enableRequiredMemoTransfers(
    connection,
    payer,
    otherTokenAccount,
    payer,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(
    `✅ - We have transferred ${account.amount} tokens to ${otherTokenAccount} without a memo.`
  );

} catch (error) {
  console.log(error)
}
```

Run `npm run start`. You will notice that `otherTokenAccount` now has 600 tokens, meaning it has successfully transferred without a memo after disabling the extension.

Congratulations! We’ve just tested the required memo extension!

# Challenge

Go create your own token account with required memo.
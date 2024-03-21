---
title: Required Memo
objectives:
 - Create token account with required memo on transfer
 - Transfer with memo
 - Transfer without memo
 - Disable required memo 
---

# Summary

- The `RequiredMemo` extension allows developers to mandate that all incoming transfers to a token account include a memo, facilitating enhanced transaction tracking and user identification.
- The demonstration includes the creation of a token account that necessitates memos for all incoming transfers, alongside tests to verify the extension's functionality in enforcing and disabling memo inclusion for transactions.

# Overview

For certain applications, such as exchanges or financial services, tracking the purpose or origin of a transaction is crucial. The `RequiredMemo` extension empowers mint creators to require a memo for every incoming transfer to a token account. This requirement ensures that each transaction is accompanied by additional information, which can be used for compliance, auditing, or user-specific purposes. If the need for strict tracking is removed, the requirement can be adjusted to make memos optional, offering flexibility in how transactions are handled and recorded.

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

# Lab

In this lab we will be creating a token account with required memo extension `MemoTransfer`. We will then write tests to check if the extension is working as intended by attempting to transfer funds with and without a memo. 

### 1. Clone

Clone the lab and change branches to `starting`

```bash
git clone git@github.com:Unboxed-Software/solana-lab-required-memo.git
cd solana-lab-required-memo
git checkout starting
npm install
```

### 2. Run validator node

For the sake of this guide, we will be running our own validator node. We do this because sometimes testnet or devnets on Solana can become congested and in turn less reliable.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is [`http://127.0.0.1:8899`](http://127.0.0.1:8899/). We then use that in the connection to specify to use the local RPC URL.

```tsx
const connection = new Connection("http://127.0.0.1:8899", 'confirmed');
```

Alternatively, if you’d like to use testnet or devnet, import the `clusterApiUrl` from `@solana/web3.js` and pass it to the connection as such:

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

### 3. Helpers

When you clone the repo and change to the `starter` branch, we will already have access to a token helper function along with 2 helper functions provided by the `@solana-developers/helpers` package.

- `token-helper.ts`: This helper named `createTokenWithMemoExtension` will facilitate in the creation of the token accounts needed to run our tests against the required memo extension
- `initializeKeypair`: This function creates the keypair for the `payer` and also airdrops 1 testnet SOL to it
- `makeKeypairs`: This function creates keypairs without airdropping any SOL

### 4. Create main script

Inside of `src/index.ts`, the required dependencies will already be imported, along with some keypair variables, amount variables and an asynchronous IIFE for the main script. Add the following `createMint` function beneath the existing code:

```tsx
(async () => {
	// previous code
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
})()
```

### 5. Create Token Account with required memo

Inside of the `src` directory, you will see a file named `token-helper.ts`. Inside of the token helper, there is an asynchronous function named `createTokenWithMemoExtension`. This function is where we will be creating the associated token account with the required memo.  The function will take the following arguments:

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

Back in `index.ts` underneath the mint variable, create 2 token accounts. One for `ourTokenAccountKeypair` and one for `otherTokenAccountKeypair`. We then mint 1000 tokens to `ourTokenAccountKeypair`:

```
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

Thats it for the token accounts! Now we can move on and start ensuring that the extensions rules are applied correctly by running a few tests against it.

### 6. Tests

**Test transfer without memo**

Above the main IIFE, declare a function named `testTryingToTransferWithoutMemo` along with its input types. 

```tsx
interface TransferWithoutMemoInputs {
  connection: Connection;
  fromTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  payer: Keypair;
  amount: number;
}
	async function testTryingToTransferWithoutMemo(inputs: TransferWithoutMemoInputs) {
	const { 
		fromTokenAccount,
	  destinationTokenAccount,
	  payer,
	  connection,
	  amount
	} = inputs;
	try {
	  const transaction = new Transaction().add(
	    createTransferInstruction(
	      fromTokenAccount,
	      destinationTokenAccount,
	      payer.publicKey,
	      amount,
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
}
```

Inside the main script, invoke the `testTryingToTransferWithoutMemo` test and run `npm run start`. We should see the following error logged out in the terminal, meaning the extension is working as intended: `✅ - We expected this to fail because you need to send a memo with the transfer.`

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  {
    // Show that you can't transfer without memo
    await testTryingToTransferWithoutMemo({
      connection,
      fromTokenAccount: ourTokenAccount,
      destinationTokenAccount: otherTokenAccount,
      payer,
      amount: amountToTransfer
    });
  }
 })()
```

**Test transfer with memo**

This test will attempt to transfer with a memo. This test is also expected to pass. Pay extra attention to the following code block. It is the part of the transaction that adds the memo instruction to it:

```tsx
new TransactionInstruction({
  keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
  data: Buffer.from(message, "utf-8"), 
  // Memo message. In this case it is "Hello, Solana"
  programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), 
  // Memo program that validates keys and memo message
}),
```

Below the previous test, declare a function named `testTransferWithMemo`.

```tsx
interface TransferWithMemoInputs {
  connection: Connection;
  fromTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  mint: PublicKey;
  payer: Keypair;
  amount: number;
  message: string;
}
async function testTransferWithMemo(inputs: TransferWithMemoInputs) {
  const { 
	  fromTokenAccount,
	  destinationTokenAccount,
	  mint,
	  payer,
	  connection,
	  amount,
	  message
	} = inputs;
  try {
    const transaction = new Transaction().add(
      new TransactionInstruction({
        keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
        data: Buffer.from(message, "utf-8"), // Memo message. In this case it is "Hello, Solana"
        programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"), // Memo program that validates keys and memo message
      }),

      createTransferInstruction(
        fromTokenAccount,
        destinationTokenAccount,
        payer.publicKey,
        amount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);

    const account = await getAccount(
      connection,
      destinationTokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    console.log(
      `✅ - We have transferred ${account.amount} tokens to ${destinationTokenAccount} with the memo: ${message}`
    );

  } catch (error) {
    console.log(error)
  }
}
```

In the main IIFE, paste the following beneath the previous code and run `npm run start`. This test should log a success message of .

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  // ... previous tests
  
	{
	  // Show transfer with memo 
	  await testTransferWithMemo({
	    connection,
	    fromTokenAccount: ourTokenAccount,
	    destinationTokenAccount: otherTokenAccount,
	    mint,
	    payer,
	    amount: amountToTransfer,
	    message: "Hello, Solana"
	  });
  }
})()
```

**Test transfer with disabled memo**

Below the previous test, declare a function named `testTransferWithDisabledMemo`. We don’t need to redeclare input types as we’ve already created them in the previous test (`TransferWithoutMemoInputs`).

```tsx
async function testTransferWithDisabledMemo(inputs: TransferWithoutMemoInputs) {
  const { 
	  fromTokenAccount, 
	  destinationTokenAccount, 
	  payer, 
	  connection, 
	  amount 
	} = inputs;
  try {
    await disableRequiredMemoTransfers(
      connection,
      payer,
      destinationTokenAccount,
      payer,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount,
        destinationTokenAccount,
        payer.publicKey,
        amount,
        undefined,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, transaction, [payer]);

    const account = await getAccount(
      connection,
      destinationTokenAccount,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    // re-enable memo transfers to show it exists 
    await enableRequiredMemoTransfers(
      connection,
      payer,
      destinationTokenAccount,
      payer,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(
      `✅ - We have transferred ${amount} tokens to ${destinationTokenAccount} without a memo.`
    );

  } catch (error) {
    console.log(error)
  }
}
```

Beneath the previous test invocation, add the function call to `testTransferWithDisabledMemo`:

```tsx
{
  // Show you can disable memo transfer and transfer without it
  await testTransferWithDisabledMemo({
    connection,
    fromTokenAccount: ourTokenAccount,
    destinationTokenAccount: otherTokenAccount,
    payer,
    amount: amountToTransfer
  });
}
```

Congratulations! We’ve just tested the required memo extension!

# Challenge

Go create your own token account with required memo.
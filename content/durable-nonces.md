---
title: Durable Nonces
objectives:
- Be able to explain the differences between durable transactions and regular transactions.
- Create and submit durable transactions.
- Navigate edge cases that can happen when dealing with durable transactions.
---

# Summary
- Durable transactions have no expiration date unlike regular transactions that have an expiration date of 150 blocks (~80-90 seconds).
- After signing a durable transaction you can store it in a database or a file or send it to another device to submit it later.
- A durable transactions is made using a nonce account. A nonce account holds the authority and the nonce value which replaces the recent blockhash to make a durable transaction
- Durable transaction must start with an `advanceNonce` instruction, and the nonce authority has to be a signer in the transaction.
- If the transaction fails for any reason other than the nonce advanced instruction the nonce will still get advanced, even though all other instruction will get reverted.

# Overview

Durable Nonces are a way to bypass the expiration date of regular transactions. To understand That better, we'll start by looking at the concepts behind regular transactions.

In Solana, transactions are made of three main parts:

1. **Instructions**: Instructions are the operations that you want to perform on the blockchain, like transferring tokens, creating accounts, or calling a program. These are executed in order.

2. **Signatures**: Signatures are the proof that the transaction was signed by the required singers/authorities. For instance, if you are transferring SOL from your wallet to another, you'll need to sign the transaction so the network can verify that the transaction is valid.

3. **Recent Blockhash**: The recent blockhash is a unique identifier for each transaction. It is used to prevent replay attacks, where an attacker records a transaction and then tries to submit it again. The recent blockhash ensures that each transaction is unique and can only be submitted once. A recent blockhash is only valid for 150 blocks.

In durable transactions, the first two concepts will remain the same. Durable transactions are possible by playing with recent blockhashes. 

Let's dive deep into the recent blockhash, to understand the blockhash better let's look at the problem that it tries to solve, the [double-spend](https://solana.com/developers/guides/advanced/introduction-to-durable-nonces#double-spend) problem.

Imagine you're buying an NFT on MagicEden or Tensor. You have to sign a transaction that allows the marketplace's program to extract some SOL from your wallet. After signing the transaction the marketplace will submit it to the network. If the marketplace submits it again, without checks, you could be charged twice.

This is known as the double-spend problem and is one of the core issues that blockchains, like Solana, solve. A naive solution could be to crosscheck all transactions made in the past and see if we find a duplicate transaction signature. This is not practically possible, as the size of the Solana ledger is >80 TB. So to solve this, Solana uses recent blockhashs. 

A recent blockhash is a 32-byte SHA-256 hash of a valid block's last [entry id](https://solana.com/docs/terminology#blockhash) within the last 150 blocks. Since this recent blockhash is part of the transaction before it signed, we can guarantee the signer has singed it within the last 150 blocks. Checking 150 blocks is much more reasonable than the entire ledger.

When the transaction is submitted, the Solana validators will do the following:

1. Checks if the signature of the transaction has been submitted within the last 150 blocks - if there is a duplicate signature it'll fail the duplicate transaction.
2. If the transaction signature has not been found, it will check the recent blockhash to see if it exists within the last 150 blocks - if it does not, it will return a "Blockhash not found" error. If it does, the transaction goes through to it's execution checks. 

While this solution is great for most use cases, it has some limitations. Mainly, the transaction needs to get signed and submitted to the network within 150 blocks or around ~80-90 seconds. But there are some use cases were we need more than 90 seconds to submit a transaction.

[Some reasons from solana](https://solana.com/developers/guides/advanced/introduction-to-durable-nonces#durable-nonce-applications):
> 1. **Scheduled Transactions**: One of the most apparent applications of Durable Nonces is the ability to schedule transactions. Users can pre-sign a transaction and then submit it at a later date, allowing for planned transfers, contract interactions, or even executing pre-determined investment strategies.
> 2. **Multisig Wallets**: Durable Nonces are very useful for multi-signature wallets where one party signs a transaction, and others may confirm at a later time. This feature enables the proposal, review, and later execution of a transaction within a trustless system.
> 3. **Programs Requiring Future Interaction**: If a program on Solana requires interaction at a future point (such as a vesting contract or a timed release of funds), a transaction can be pre-signed using a Durable Nonce. This ensures the contract interaction happens at the correct time without necessitating the presence of the transaction creator.
> 4. **Cross-chain Interactions**: When you need to interact with another blockchain, and it requires waiting for confirmations, you could sign the transaction with a Durable Nonce and then execute it once the required confirmations are received.
> 5. **Decentralized Derivatives Platforms**: In a decentralized derivatives platform, complex transactions might need to be executed based on specific triggers. With Durable Nonces, these transactions can be pre-signed and executed when the trigger condition is met.


## Durable nonces To overcome the short lifespan of the regular transaction:

Durable nonces are a way to sign transactions off-chain and keep them in storage until they are ready to be submitted to the network. And this allows us to create durable transactions.

Durable nonces, which are 32-bytes in length (usually represented as base58 encoded strings), are used in place of recent blockhashes to make every transaction unique (to avoid double-spending) while removing the mortality on the unexecuted transaction.

If nonces are used in place of recent blockhashes, the first instruction of the transaction needs to be a `nonceAdvance` instruction, which changes or advances the nonce. This ensures that every transaction which is signed using the nonce as the recent blockhash will be unique.

It is important to note that durable nonces require [unique mechanisms within Solana](https://docs.solanalabs.com/implemented-proposals/durable-tx-nonces) to function, thus they have some special rules that don't apply normally. We'll see this as we deep dive into the technicals.

## Durable nonces in-depth

Durable transactions differs from regular transactions in the following ways:

1. Durable Nonces replaces the recent blockhash with a nonce. This nonce is stored in an `nonce account` and will be used only once in one transaction. The nonce is a unique blockhash.
2. Each durable transaction must start with the `nonce advance instruction`, which will change the nonce in the `nonce account`. This will ensure that the nonce is unique and can't be used again in another transaction.

The nonce account is an account that holds a couple of values:
1. nonce value: the nonce value that will be used in the transaction.
2. authority: the public key that can change the nonce value.
3. fee calculator: the fee calculator for the transaction.

Again, every durable transaction must start with the `nonce advance instruction` and the `authority` must be a signer.

Lastly, there is a special rule - if a durable transaction because of any instruction other than the `nonce advance instruction`, the nonce will still advance, while the rest of the transaction is rolled back. This behavior is unique only to durable nonces.

## Durable nonce operations

Durable nonces have a few helpers and constants into the `@solana/web3.js` package:
1. `SystemProgram.nonceInitialize`: This instruction will create a new nonce account.
2. `SystemProgram.nonceAdvance`: This instruction will change the Nonce in the nonce account.
3. `SystemProgram.nonceWithdraw`: This instruction will withdraw the funds from the nonce account, to delete the nonce account withdraw all the funds in it.
4. `SystemProgram.nonceAuthorize`: This instruction will change the Authority of the nonce account.
5. `NONCE_ACCOUNT_LENGTH`: a constant that represents the length of the nonce account data.
6. `NonceAccount`: a class that represents the nonce account, it contains a static function `fromAccountData` that can take the nonce account data and return a nonce account object.

Let's look into each one of the helpers functions in details.

### `nonceInitialize`

This instruction is used to create a new nonce account, it takes two parameters:
1. `noncePubkey`: the public key of the nonce account.
2. `authorizedPubkey`: the public key of the authority of the nonce account.

Here is a code example for it:

```ts
// 1. Generate/get a keypair for the nonce account, and the authority.
const [nonceKeypair, nonceAuthority] = makeKeypairs(2); // from '@solana-developers/helpers'

const tx = new Transaction().add(
  // 2. Allocate the account and transfer funds to it (the least amount is 0.0015 SOL)
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: nonceKeypair.publicKey,
    lamports: 0.0015 * LAMPORTS_PER_SOL,
    space: NONCE_ACCOUNT_LENGTH,
    programId: SystemProgram.programId,
  }),
  // 3. Initialize the nonce account using the `SystemProgram.nonceInitialize` instruction.
  SystemProgram.nonceInitialize({
    noncePubkey: nonceKeypair.publicKey,
    authorizedPubkey: nonceAuthority.publicKey,
  }),
);

// send the transaction
await sendAndConfirmTransaction(connection, tx, [payer, nonceKeypair]);
```

The system program will take care of setting the nonce value for us inside the nonce-account.


### `nonceAdvance`

This instruction is used to change the nonce value in the nonce account, it takes two parameters:

1. `noncePubkey`: the public key of the nonce account.
2. `authorizedPubkey`: the public key of the authority of the nonce account.

Here is a code example for it:

```ts
const instruction = SystemProgram.nonceAdvance({
  authorizedPubkey: nonceAuthority.publicKey,
  noncePubkey: nonceKeypair.publicKey,
});
```

You will see this instruction as the first instruction in any durable transaction. But that doesn't mean that you only have to use as the first instruction of a durable transaction. You can always call this function, and it will automatically invalidate any durable transaction tied to it's previous nonce value.

### `nonceWithdraw`

This instruction is used to withdraw the funds from the nonce account, it takes four parameters:
1. `noncePubkey`: the public key of the nonce account.
2. `toPubkey`: the public key of the account that will receive the funds.
3. `lamports`: the amount of lamports that will be withdrawn.
4. `authorizedPubkey`: the public key of the authority of the nonce account.

Here is a code example for it:

```ts
const instuction = SystemProgram.nonceWithdraw({
  noncePubkey: nonceKeypair.publicKey,
  toPubkey: payer.publicKey,
  lamports: amount,
  authorizedPubkey: nonceAuthority.publicKey,
});
```

You can also use this instruction to close the nonce account by withdrawing all the funds in it.


### `nonceAuthorize`

This instruction is used to change the authority of the nonce account, it takes three parameters:
1. `noncePubkey`: the public key of the nonce account.
2. `authorizedPubkey`: the public key of the current authority of the nonce account.
3. `newAuthorizedPubkey`: the public key of the new authority of the nonce account.

Here is a code example for it:
```ts
const instruction = SystemProgram.nonceAuthorize({
  noncePubkey: nonceKeypair.publicKey,
  authorizedPubkey: nonceAuthority.publicKey,
  newAuthorizedPubkey: newAuthority.publicKey,
});
```

## How to use the durable nonces

Now that we learned about the nonce account and it's different operations, let's talk about how to use it. 

We'll discuss:

1. Fetching the nonce account
2. Using the nonce in the transaction to make a durable transaction.
3. Submitting a durable transaction.

### Fetching the nonce account

We can fetch the nonce account to get the nonce value by fetching the account and serializing it:

```ts
const nonceAccount = await connection.getAccountInfo(nonceKeypair.publicKey);

// { authorizedPubkey: PublicKey; nonce: DurableNonce; feeCalculator: FeeCalculator; }
const nonce = NonceAccount.fromAccountData(nonceAccount.data); 
```

### Using the nonce in the transaction to make a durable transaction

To build a fully functioning durable transaction, we need the following:

1. Use the nonce value in replacement of the recent blockhash.
2. Add the nonceAdvance instruction as the first instruction in the transaction.
3. Sign the transaction with the authority of the nonce account.

After building and signing the transaction we can serialize it and encode it into a base58 string, and we can save this string in some store to submit it later.

```ts
  // Assemble the durable transaction
  const durableTx = new Transaction();
  durableTx.feePayer = payer.publicKey;

  // use the nonceAccount's stored nonce as the recentBlockhash
  durableTx.recentBlockhash = nonceAccount.nonce;

  // make a nonce advance instruction
  durableTx.add(
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthority.publicKey,
      noncePubkey: nonceKeypair.publicKey,
    }),
  );

  // Add any instructions you want to the transaction in this case we are just doing a transfer
  durableTx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    }),
  );

  // sign the tx with the nonce authority's keypair
  durableTx.sign(payer, nonceAuthority);

  // once you have the signed tx, you can serialize it and store it in a database, or send it to another device.
  // You can submit it at a later point.
  const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));
```

### submitting a durable transaction:

Now that we have a base58 encoded transaction, we can decode it and submit it:

```ts
const tx = base58.decode(serializedTx);
const sig = await sendAndConfirmRawTransaction(connection, tx as Buffer);
```

## Some important edge cases

There are few things that you need to consider when dealing with durable transactions:
1. If the transaction fails due to an instruction other than the nonce advanced instruction.
2. If the transaction fails due to the nonce advanced instruction.

### If the transaction fails due to an instruction other than the nonce advanced instruction

In the normal case of a failing transactions, the known behavior is that all the instructions in the transaction will get reverted to the original state. But in the case of a durable transaction, if any instruction fails that is not the advance nonce instruction, the nonce will still get advanced and all other instructions will get reverted. This feature is designed for security purposes, ensuring that once a user signs a transaction, if it fails, it cannot be used again.

Presigned, never expiring, durable transactions are like signed paychecks. They can be dangerous in the right scenarios. This extra safety feature effectively "voids" the paycheck if handled incorrectly.

### If the transaction fails due to the nonce advanced instruction

If a transaction fails because of the advance instruction, the entire transaction is reverted, meaning the nonce does not advance.

## Considerations

Durable transactions should be treated with care, and are why you should always trust the transactions you sign. 

Say you blindly signed a malicious durable transaction. This transaction signs away 500 SOL to the attacker, and changes the nonce authority to said attacker. Let's say you don't have this much yet, but in the future, you would. This is insidious, as the attacker would wait to cash this check as soon as your balance goes above 500 SOL. And you'll have no recollection of what you clicked on. It can lay dormant for days, weeks, years. 

This is not meant to provoke hysteria, just as a PSA of what's possible. This is why you should only put into hot wallets what you're willing to lose and don't sign with your cold wallet.

# Lab

In this lab, we'll learn how to create a durable transaction. We'll focus on what you can and you can't do with it. Additionally, we'll discuss some edge cases and how to handle them.

## 0. Getting started

Let's go ahead and clone our starter code

```bash
git clone https://github.com/Unboxed-Software/solana-lab-durable-nonces
cd Solana-lab-durable-nonces
git checkout starter
npm install
```

In the starter code you will find a file inside `test/index.ts`, we'll write all of our code there.

If you open the file you will find this code:
```ts
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { initializeKeypair, makeKeypairs } from '@solana-developers/helpers';
import base58 from 'bs58';
import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();


describe('transfer-hook', () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  it('Creates a durable transaction and submits it', async () => {});

  it('Fails if the nonce has advanced', async () => {});

  it('Advances the nonce account even if the transaction fails', async () => {});

  it('The nonce account will not advance if the transaction fails because the nonce auth did not sign the transaction', async () => {});

  it('Submits after changing the nonce auth to an already signed address', async () => {});
});
```

As you can see we are using local validator, so you will need to have it installed, if you don't you can refer to [installing the Solana CLI](https://docs.solanalabs.com/cli/install), once you install the CLI you will have access to the `solana-test-validator` and much more cool stuff.

Running the local validator is easy, you just have to run this command in your terminal:

```bash
solana-test-validator
```


As you can see, the lab will be divided into 5 steps that will help us understand durable nonces better.

We'll discuss each test case in depth. In addition, we'll start by implementing a helper function that will create a nonce account for us. We'll do this because we'll need to create more than one nonce account throughout the lab, so we want to have one function that does that for us and call it whenever we need a new nonce account.

## 1. Create the nonce account

To create the nonce account, we'll have to do the following:
1. Get the payer, nonce account, and the nonce authority keypairs from the function parameters, as well as the connection.
2. Assemble and submit a transaction that will:
   1. Allocate the account that will be the nonce account.
   2. Initialize the nonce account using the `SystemProgram.nonceInitialize` instruction.
3. Fetch the nonce account.
4. Serialize the nonce account data and return it.

```ts
const createNonceAccount = async (
  // 1. Get the payer, nonce account, and the nonce authority keypairs from the function parameters, as well as the connection
  payer: Keypair,
  nonceKeypair: Keypair,
  authority: PublicKey,
  connection: Connection,
) => {
  // 2. Assemble and submit a transaction that will:
  const tx = new Transaction().add(
    // 2.1. Allocate the account that will be the nonce account.
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: nonceKeypair.publicKey,
      lamports: 0.0015 * LAMPORTS_PER_SOL,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    // 2.2. Initialize the nonce account using the `SystemProgram.nonceInitialize` instruction.
    SystemProgram.nonceInitialize({
      noncePubkey: nonceKeypair.publicKey,
      authorizedPubkey: authority,
    }),
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer, nonceKeypair]);
  console.log(
    'Creating Nonce TX:',
    `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
  );

  // 3. Fetch the nonce account.
  const accountInfo = await connection.getAccountInfo(nonceKeypair.publicKey);
  // 4. Serialize the nonce account data and return it.
  return NonceAccount.fromAccountData(accountInfo!.data);
};
```

Put this function somewhere in the file outside the `describe` block.

## 2. Create and submit a durable transaction

To create and submit a durable transaction we must follow these steps:

1. Create a Durable Transaction.
  1. Create the nonce account.
  2. Create a new Transaction.
  3. Ste the `recentBlockhash` to be the nonce value.
  4. Add the `nonceAdvance` instruction as the first instruction in the transaction.
  5. Add the transfer instruction (you can add any instruction you want here).
  6. Sign the transaction with the keyPairs that need to sign it, and make sure to add the nonce authority as a signer as well.
  7. Serialize the transaction and encode it.
  8. At this point you have a durable transaction, you can store it in a database or a file or send it somewhere else, etc.
2. Submit the durable transaction.
  1. Decode the serialized transaction.
  2. Submit it using the `sendAndConfirmRawTransaction` function.

```ts
it('Creates a durable transaction and submits it', async () => {
  const payer = await initializeKeypair(connection, {
    airdropAmount: 3 * LAMPORTS_PER_SOL,
    minimumBalance: 1 * LAMPORTS_PER_SOL,
  });

  // 1. Create a Durable Transaction.
  const [nonceKeypair, recipient] = makeKeypairs(2);

  // 1.1 Create the nonce account.
  const nonceAccount = await createNonceAccount(payer, nonceKeypair, payer.publicKey, connection);

  // 1.2 Create a new Transaction.
  const durableTx = new Transaction();
  durableTx.feePayer = payer.publicKey;

  // 1.3 Ste the recentBlockhash to be the nonce value.
  durableTx.recentBlockhash = nonceAccount.nonce;

  // 1.4 Add the `nonceAdvance` instruction as the first instruction in the transaction.
  durableTx.add(
    SystemProgram.nonceAdvance({
      authorizedPubkey: payer.publicKey,
      noncePubkey: nonceKeypair.publicKey,
    }),
  );

  // 1.5 Add the transfer instruction (you can add any instruction you want here).
  durableTx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    }),
  );

  // 1.6 Sign the transaction with the keyPairs that need to sign it, and make sure to add the nonce authority as a signer as well.
  // In this particular example the nonce auth is the payer, and the only signer needed for our transfer instruction is the payer as well, so the payer here as a sign is sufficient.
  durableTx.sign(payer);

  // 1.7 Serialize the transaction and encode it.
  const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));
  // 1.8 at this point you have a durable transaction, you can store it in a database or a file or send it somewhere else, etc.
  // ----------------------------------------------------------------

  // 2. Submit the durable transaction.
  // 2.1 Decode the serialized transaction.
  const tx = base58.decode(serializedTx);

  // 2.2 Submit it using the `sendAndConfirmRawTransaction` function.
  const sig = await sendAndConfirmRawTransaction(connection, tx as Buffer, {
    skipPreflight: true,
  });

  console.log(
    'Transaction Signature:',
    `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
  );
});
```

## 3. The Transaction Fails if the Nonce Has Advanced

Because we are using the nonce in place of the recent blockhash, the system will check to ensure that the nonce we provided matches the nonce in the `nonce_account`. This is crucial for security reasons. With each transaction, we should add the `nonceAdvance` instruction as the first instruction. This ensures that if the transaction goes through, the nonce will change, and no one will be able to submit it twice.

Here is what we'll test:
1. Create a durable transaction just like in the previous step.
2. Advance the nonce.
3. Try to submit the transaction, and it should fail.

```ts
it('Fails if the nonce has advanced', async () => {
  const payer = await initializeKeypair(connection, {
    airdropAmount: 3 * LAMPORTS_PER_SOL,
    minimumBalance: 1 * LAMPORTS_PER_SOL,
  });

  const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

  // 1. Create a Durable Transaction.
  const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);

  const durableTx = new Transaction();
  durableTx.feePayer = payer.publicKey;

  // use the nonceAccount's stored nonce as the recentBlockhash
  durableTx.recentBlockhash = nonceAccount.nonce;

  // make a nonce advance instruction
  durableTx.add(
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthority.publicKey,
      noncePubkey: nonceKeypair.publicKey,
    }),
  );

  durableTx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    }),
  );

  // sign the tx with both the payer and nonce authority's keypair
  durableTx.sign(payer, nonceAuthority);

  // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
  const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

  // 2. Advance the nonce
  const nonceAdvanceSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.nonceAdvance({
        noncePubkey: nonceKeypair.publicKey,
        authorizedPubkey: nonceAuthority.publicKey,
      }),
    ),
    [payer, nonceAuthority],
  );

  console.log(
    'Nonce Advance Signature:',
    `https://explorer.solana.com/tx/${nonceAdvanceSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
  );

  const tx = base58.decode(serializedTx);

  // 3. Try to submit the transaction, and it should fail.
  await assert.rejects(sendAndConfirmRawTransaction(connection, tx as Buffer));
});
```

## 4. The nonce account Advances Even if the Transaction Fails

An important edge case to be aware of is that even if a transaction fails for any reason other than the nonce advance instruction, the nonce will still advance. This feature is designed for security purposes, ensuring that once a user signs a transaction and it fails, they don't have to worry about it anymore, and it cannot be held against them.

The following code demonstrates this use case. We'll attempt to create a durable transaction to transfer 50 SOL from the payer to the recipient. However, the payer doesn't have enough SOL for the transfer, so the transaction will fail, but the nonce will still advance.

```ts
it('Advances the nonce account even if the transaction fails', async () => {
  const TRANSFER_AMOUNT = 50;
  const payer = await initializeKeypair(connection, {
    airdropAmount: 3 * LAMPORTS_PER_SOL,
    minimumBalance: 1 * LAMPORTS_PER_SOL,
  });

  const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

  // Create the nonce account
  const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);
  const nonceBeforeAdvancing = nonceAccount.nonce;

  console.log('Nonce Before Advancing:', nonceBeforeAdvancing);

  // Assemble a durable transaction that will fail

  const balance = await connection.getBalance(payer.publicKey);

  // making sure that we don't have 50 SOL in the account
  assert(
    balance < TRANSFER_AMOUNT * LAMPORTS_PER_SOL,
    `Too much balance, try to change the transfer amount constant 'TRANSFER_AMOUNT' at the top of the function to be more than ${ balance / LAMPORTS_PER_SOL }`,
  );

  const durableTx = new Transaction();
  durableTx.feePayer = payer.publicKey;

  // use the nonceAccount's stored nonce as the recentBlockhash
  durableTx.recentBlockhash = nonceAccount.nonce;

  // make a nonce advance instruction
  durableTx.add(
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthority.publicKey,
      noncePubkey: nonceKeypair.publicKey,
    }),
  );

  // Transfer 50 sols instruction
  // This will fail because the account doesn't have enough balance
  durableTx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: TRANSFER_AMOUNT * LAMPORTS_PER_SOL,
    }),
  );

  // sign the tx with both the payer and nonce authority's keypair
  durableTx.sign(payer, nonceAuthority);

  // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
  const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

  const tx = base58.decode(serializedTx);

  // assert the promise to throw an error
  await assert.rejects(
    sendAndConfirmRawTransaction(connection, tx as Buffer, {
      // If we don't skip preflight this transaction will never reach the network, and the library will reject it and throw an error, therefore it will fail but the nonce will not advance
      skipPreflight: true,
    }),
  );

  const nonceAccountAfterAdvancing = await connection.getAccountInfo(nonceKeypair.publicKey);
  const nonceAfterAdvancing = NonceAccount.fromAccountData(nonceAccountAfterAdvancing!.data).nonce;

  // We can see that even though the transitions fails, the nonce has advanced
  assert.notEqual(nonceBeforeAdvancing, nonceAfterAdvancing);
});
```

Notice that we are setting `skipPreflight: true` in the `sendAndConfirmRawTransaction` function. This step is crucial because, without it, the transaction would never reach the network. Instead, the library would reject it and throw an error, leading to a failure where the nonce does not advance.

However, this is not the whole story. In the upcoming test case, we'll discover scenarios where even if the transaction fails, the nonce will not advance. Let's dive right into it.

## 5. The nonce account Will Not Advance if the Transaction Fails Because of the Nonce Advance Instruction

For the nonce to advance, the `advanceNonce` instruction must succeed. Thus, if the transaction fails for any reason related to this instruction, the nonce will not advance.

The `nonceAdvance` instruction could fail for several reasons:
1. If the nonce authority did not sign the transaction.
2. If there were any mistakes in the instruction.

**1. The Nonce Authority Didn't Sign the Transaction**

```ts
it('The nonce account will not advance if the transaction fails because the nonce auth did not sign the transaction', async () => {
  const payer = await initializeKeypair(connection, {
    airdropAmount: 3 * LAMPORTS_PER_SOL,
    minimumBalance: 1 * LAMPORTS_PER_SOL,
  });

  const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

  // Create the nonce account
  const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);
  const nonceBeforeAdvancing = nonceAccount.nonce;

  console.log('Nonce before submitting:', nonceBeforeAdvancing);

  // Assemble a durable transaction that will fail

  const durableTx = new Transaction();
  durableTx.feePayer = payer.publicKey;

  // use the nonceAccount's stored nonce as the recentBlockhash
  durableTx.recentBlockhash = nonceAccount.nonce;

  // make a nonce advance instruction
  durableTx.add(
    SystemProgram.nonceAdvance({
      authorizedPubkey: nonceAuthority.publicKey,
      noncePubkey: nonceKeypair.publicKey,
    }),
  );

  durableTx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    }),
  );

  // sign the tx with the payer keypair
  durableTx.sign(payer);

  // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
  const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

  const tx = base58.decode(serializedTx);

  // assert the promise to throw an error
  await assert.rejects(
    sendAndConfirmRawTransaction(connection, tx as Buffer, {
      skipPreflight: true,
    }),
  );

  const nonceAccountAfterAdvancing = await connection.getAccountInfo(nonceKeypair.publicKey);
  const nonceAfterAdvancing = NonceAccount.fromAccountData(nonceAccountAfterAdvancing!.data).nonce;

  // We can see that the nonce did not advanced, because the error was in the nonce advance instruction
  assert.equal(nonceBeforeAdvancing, nonceAfterAdvancing);
});
```

**2. Submits After Changing the Nonce Authority to an Already Signed Address**

This is an important edge case to consider. An attacker might trick the user into signing a transaction that will eventually fail, such as a purchase, and then hold onto this transaction for some time. They could submit it to the network at any point in the future after changing the nonce authority to a keypair that has already signed the transaction.

Imagine that a user signs a transaction to transfer 10 SOL from his wallet, and this transaction is a durable transaction. In the first instruction, the `nonceAdvance` instruction, the attacker claims that the nonce authority is the user's wallet, even though in reality, it is not. After submitting the transaction, it will fail because the nonce authority is not what the `nonceAdvance` claims it to be. Here, the user will just give up on this transaction and might sign another one or whatever. At this time, the attacker has the transaction signature, and because it is a durable transaction, it will never expire.

Now, at any point in the future, if the attacker changes the nonce authority to be the user's wallet, the advance instruction will be corrected, and this time, if he submits the transaction, it will go through!

Below you can find a code that will demonstrate this use case:

```ts
it('Submits after changing the nonce auth to an already signed address', async () => {
  const payer = await initializeKeypair(connection, {
    airdropAmount: 3 * LAMPORTS_PER_SOL,
    minimumBalance: 1 * LAMPORTS_PER_SOL,
  });

  const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

  // Create the nonce account
  const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);
  const nonceBeforeAdvancing = nonceAccount.nonce;

  console.log('Nonce before submitting:', nonceBeforeAdvancing);

  // Assemble a durable transaction that will fail

  const durableTx = new Transaction();
  durableTx.feePayer = payer.publicKey;

  // use the nonceAccount's stored nonce as the recentBlockhash
  durableTx.recentBlockhash = nonceAccount.nonce;

  // make a nonce advance instruction
  durableTx.add(
    SystemProgram.nonceAdvance({
      // The nonce auth is not the payer at this point of time, so the transaction will fail
      // But in the future we can change the nonce auth to be the payer and submit the transaction when ever we want
      authorizedPubkey: payer.publicKey,
      noncePubkey: nonceKeypair.publicKey,
    }),
  );

  durableTx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient.publicKey,
      lamports: 0.1 * LAMPORTS_PER_SOL,
    }),
  );

  // sign the tx with the payer keypair
  durableTx.sign(payer);

  // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
  const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

  const tx = base58.decode(serializedTx);

  // assert the promise to throw an error
  // It will fail because the nonce auth is not the payer
  await assert.rejects(
    sendAndConfirmRawTransaction(connection, tx as Buffer, {
      skipPreflight: true,
    }),
  );

  const nonceAccountAfterAdvancing = await connection.getAccountInfo(nonceKeypair.publicKey);
  const nonceAfterAdvancing = NonceAccount.fromAccountData(nonceAccountAfterAdvancing!.data).nonce;

  // We can see that the nonce did not advanced, because the error was in the nonce advance instruction
  assert.equal(nonceBeforeAdvancing, nonceAfterAdvancing);

  // Now we can change the nonce auth to be the payer
  const nonceAuthSig = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      SystemProgram.nonceAuthorize({
        noncePubkey: nonceKeypair.publicKey,
        authorizedPubkey: nonceAuthority.publicKey,
        newAuthorizedPubkey: payer.publicKey,
      }),
    ),
    [payer, nonceAuthority],
  );

  console.log(
    'Nonce Auth Signature:',
    `https://explorer.solana.com/tx/${nonceAuthSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
  );

  // At any time in the future we can submit the transaction and it will go through
  const txSig = await sendAndConfirmRawTransaction(connection, tx as Buffer, {
    skipPreflight: true,
  });

  console.log(
    'Transaction Signature:',
    `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
  );
});
```

## 7. Put it all together

Here is how your `test/index.ts` should look like after implementing all of the test cases:

```ts
// inside test/index.ts
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  sendAndConfirmRawTransaction,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { initializeKeypair, makeKeypairs } from '@solana-developers/helpers';
import base58 from 'bs58';
import assert from 'assert';
import dotenv from 'dotenv';
dotenv.config();

const createNonceAccount = async (
  payer: Keypair,
  nonceKeypair: Keypair,
  authority: PublicKey,
  connection: Connection,
) => {
  const tx = new Transaction().add(
    // create system account with the minimum amount needed for rent exemption.
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: nonceKeypair.publicKey,
      lamports: 0.0015 * LAMPORTS_PER_SOL,
      space: NONCE_ACCOUNT_LENGTH,
      programId: SystemProgram.programId,
    }),
    // initialize nonce with the created nonceKeypair's pubkey as the noncePubkey
    // also specify the authority of the nonce account
    SystemProgram.nonceInitialize({
      noncePubkey: nonceKeypair.publicKey,
      authorizedPubkey: authority,
    }),
  );

  // send the transaction
  const sig = await sendAndConfirmTransaction(connection, tx, [payer, nonceKeypair]);
  console.log(
    'Creating Nonce TX:',
    `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
  );

  // Fetching the nonce account
  const accountInfo = await connection.getAccountInfo(nonceKeypair.publicKey);
  return NonceAccount.fromAccountData(accountInfo!.data);
};

describe('transfer-hook', () => {
  const connection = new Connection('http://localhost:8899', 'confirmed');

  it('Creates a durable transaction and submits it', async () => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, recipient] = makeKeypairs(2);

    // Create the nonce account
    const nonceAccount = await createNonceAccount(payer, nonceKeypair, payer.publicKey, connection);

    // Assemble the durable transaction
    const durableTx = new Transaction();
    durableTx.feePayer = payer.publicKey;

    // use the nonceAccount's stored nonce as the recentBlockhash
    durableTx.recentBlockhash = nonceAccount.nonce;

    // make a nonce advance instruction
    durableTx.add(
      SystemProgram.nonceAdvance({
        authorizedPubkey: payer.publicKey,
        noncePubkey: nonceKeypair.publicKey,
      }),
    );

    // Add the transfer sols instruction
    durableTx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      }),
    );

    // sign the tx with the nonce authority's keypair
    durableTx.sign(payer);

    // once you have the signed tx, you can serialize it and store it
    // in a database or in a file, or send it to another device.
    const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

    // You can submit it at a later point, without the tx having a mortality
    const tx = base58.decode(serializedTx);

    const sig = await sendAndConfirmRawTransaction(connection, tx as Buffer, {
      skipPreflight: true,
    });

    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  it('Fails if the nonce has advanced', async () => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

    // Create the nonce account
    const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);

    const durableTx = new Transaction();
    durableTx.feePayer = payer.publicKey;

    // use the nonceAccount's stored nonce as the recentBlockhash
    durableTx.recentBlockhash = nonceAccount.nonce;

    // make a nonce advance instruction
    durableTx.add(
      SystemProgram.nonceAdvance({
        authorizedPubkey: nonceAuthority.publicKey,
        noncePubkey: nonceKeypair.publicKey,
      }),
    );

    // Transfer 50 sols instruction
    // This will fail because the account doesn't have enough balance
    durableTx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      }),
    );

    // sign the tx with both the payer and nonce authority's keypair
    durableTx.sign(payer, nonceAuthority);

    // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
    const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

    // Now we'll advance the nonce
    const nonceAdvanceSig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.nonceAdvance({
          noncePubkey: nonceKeypair.publicKey,
          authorizedPubkey: nonceAuthority.publicKey,
        }),
      ),
      [payer, nonceAuthority],
    );

    console.log(
      'Nonce Advance Signature:',
      `https://explorer.solana.com/tx/${nonceAdvanceSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );

    const tx = base58.decode(serializedTx);

    // assert the promise to throw an error
    await assert.rejects(sendAndConfirmRawTransaction(connection, tx as Buffer));
  });

  it('Advances the nonce account even if the transaction fails', async () => {
    const TRANSFER_AMOUNT = 50;
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

    // Create the nonce account
    const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);
    const nonceBeforeAdvancing = nonceAccount.nonce;

    console.log('Nonce Before Advancing:', nonceBeforeAdvancing);

    // Assemble a durable transaction that will fail

    const balance = await connection.getBalance(payer.publicKey);

    // making sure that we don't have 50 SOL in the account
    assert(
      balance < TRANSFER_AMOUNT * LAMPORTS_PER_SOL,
      `Too much balance, try to change the transfer amount constant 'TRANSFER_AMOUNT' at the top of the function to be more than ${
        balance / LAMPORTS_PER_SOL
      }`,
    );

    const durableTx = new Transaction();
    durableTx.feePayer = payer.publicKey;

    // use the nonceAccount's stored nonce as the recentBlockhash
    durableTx.recentBlockhash = nonceAccount.nonce;

    // make a nonce advance instruction
    durableTx.add(
      SystemProgram.nonceAdvance({
        authorizedPubkey: nonceAuthority.publicKey,
        noncePubkey: nonceKeypair.publicKey,
      }),
    );

    // Transfer 50 sols instruction
    // This will fail because the account doesn't have enough balance
    durableTx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: TRANSFER_AMOUNT * LAMPORTS_PER_SOL,
      }),
    );

    // sign the tx with both the payer and nonce authority's keypair
    durableTx.sign(payer, nonceAuthority);

    // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
    const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

    const tx = base58.decode(serializedTx);

    // assert the promise to throw an error
    await assert.rejects(
      sendAndConfirmRawTransaction(connection, tx as Buffer, {
        skipPreflight: true,
      }),
    );

    const nonceAccountAfterAdvancing = await connection.getAccountInfo(nonceKeypair.publicKey);
    const nonceAfterAdvancing = NonceAccount.fromAccountData(nonceAccountAfterAdvancing!.data).nonce;

    // We can see that even though the transitions fails, the nonce has advanced
    assert.notEqual(nonceBeforeAdvancing, nonceAfterAdvancing);
  });

  it('The nonce account will not advance if the transaction fails because the nonce auth did not sign the transaction', async () => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

    // Create the nonce account
    const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);
    const nonceBeforeAdvancing = nonceAccount.nonce;

    console.log('Nonce before submitting:', nonceBeforeAdvancing);

    // Assemble a durable transaction that will fail

    const durableTx = new Transaction();
    durableTx.feePayer = payer.publicKey;

    // use the nonceAccount's stored nonce as the recentBlockhash
    durableTx.recentBlockhash = nonceAccount.nonce;

    // make a nonce advance instruction
    durableTx.add(
      SystemProgram.nonceAdvance({
        authorizedPubkey: nonceAuthority.publicKey,
        noncePubkey: nonceKeypair.publicKey,
      }),
    );

    durableTx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      }),
    );

    // sign the tx with the payer keypair
    durableTx.sign(payer);

    // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
    const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

    const tx = base58.decode(serializedTx);

    // assert the promise to throw an error
    await assert.rejects(
      sendAndConfirmRawTransaction(connection, tx as Buffer, {
        skipPreflight: true,
      }),
    );

    const nonceAccountAfterAdvancing = await connection.getAccountInfo(nonceKeypair.publicKey);
    const nonceAfterAdvancing = NonceAccount.fromAccountData(nonceAccountAfterAdvancing!.data).nonce;

    // We can see that the nonce did not advanced, because the error was in the nonce advance instruction
    assert.equal(nonceBeforeAdvancing, nonceAfterAdvancing);
  });

  // If the transaction fails because the nonce advance instruction fails, the nonce account will not advance
  // so if in the future the nonce advanced get fixed (maybe by chaining the nonce-auth to the users wallet) the transaction will be valid
  // will be valid and it could be submitted
  it('Submits after changing the nonce auth to an already signed address', async () => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

    // Create the nonce account
    const nonceAccount = await createNonceAccount(payer, nonceKeypair, nonceAuthority.publicKey, connection);
    const nonceBeforeAdvancing = nonceAccount.nonce;

    console.log('Nonce before submitting:', nonceBeforeAdvancing);

    // Assemble a durable transaction that will fail

    const durableTx = new Transaction();
    durableTx.feePayer = payer.publicKey;

    // use the nonceAccount's stored nonce as the recentBlockhash
    durableTx.recentBlockhash = nonceAccount.nonce;

    // make a nonce advance instruction
    durableTx.add(
      SystemProgram.nonceAdvance({
        // The nonce auth is not the payer at this point of time, so the transaction will fail
        // But in the future we can change the nonce auth to be the payer and submit the transaction when ever we want
        authorizedPubkey: payer.publicKey,
        noncePubkey: nonceKeypair.publicKey,
      }),
    );

    durableTx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 0.1 * LAMPORTS_PER_SOL,
      }),
    );

    // sign the tx with the payer keypair
    durableTx.sign(payer);

    // once you have the signed tx, you can serialize it and store it in a database, or send it to another device
    const serializedTx = base58.encode(durableTx.serialize({ requireAllSignatures: false }));

    const tx = base58.decode(serializedTx);

    // assert the promise to throw an error
    // It will fail because the nonce auth is not the payer
    await assert.rejects(
      sendAndConfirmRawTransaction(connection, tx as Buffer, {
        skipPreflight: true,
      }),
    );

    const nonceAccountAfterAdvancing = await connection.getAccountInfo(nonceKeypair.publicKey);
    const nonceAfterAdvancing = NonceAccount.fromAccountData(nonceAccountAfterAdvancing!.data).nonce;

    // We can see that the nonce did not advanced, because the error was in the nonce advance instruction
    assert.equal(nonceBeforeAdvancing, nonceAfterAdvancing);

    // Now we can change the nonce auth to be the payer
    const nonceAuthSig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(
        SystemProgram.nonceAuthorize({
          noncePubkey: nonceKeypair.publicKey,
          authorizedPubkey: nonceAuthority.publicKey,
          newAuthorizedPubkey: payer.publicKey,
        }),
      ),
      [payer, nonceAuthority],
    );

    console.log(
      'Nonce Auth Signature:',
      `https://explorer.solana.com/tx/${nonceAuthSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );

    // At any time in the future we can submit the transaction and it will go through
    const txSig = await sendAndConfirmRawTransaction(connection, tx as Buffer, {
      skipPreflight: true,
    });

    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });
});
```

## 8. Run the tests

To run the code simply run 

```bash
npm start
```

# Challenge


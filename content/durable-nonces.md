---
title: Transfer hook
objectives:
- 
---

# Summary

# Overview

To understand Durable Nonces, we better start at the concepts behind the regular transactions. Each transaction in Solana must have a recent Blockhash, but what is a blockhash?

To understand the blockhash better let's look at the problem that it tries to solve, The [Double-Spend](https://solana.com/developers/guides/advanced/introduction-to-durable-nonces#double-spend) problem.

{TODO: this text is copy past from the docs, might need some rephrasing}
Imagine you're buying an NFT on MagicEden or Tensor. You have to sign a transaction that allows the marketplace's program to extract some SOL from your wallets. after signing the transaction the marketplace will submit it to the network, but what if the marketplace submit it twice?

This is known as the problem of Double-Spend and is one of the core issues that blockchains like Solana solve. A naive solution could be to crosscheck all transactions made in the past and see if we find the signature there. This is not practically possible, as the size of the Solana ledger is >80 TB. So to Solve that Solana uses Blockhashes or Recent Blockhash. 

{ TODO: not sure why are they get rejected if the blockhash is found in the last 150 blocks}
Recent Blockhashes are used to achieve this. A blockhash contains a 32-byte SHA-256 hash. It is used to indicate when a client last observed the ledger. Using recent blockhashes, transactions are checked in the last 150 blocks. If they are found, they are rejected. They are also rejected if they get older than 150 blocks. The only case they are accepted is if they are unique and the blockhash is more recent than 150 blocks (~80-90 seconds).

Therefore the transaction should get signed and submitted to the network within 80-90 seconds, and this is somehow limiting for some use cases. 

1. what if I want to sign a transaction on a device that is not connected to the internet? and then submit it later from a different device?
2. what if I want to schedule a transaction to be executed at a specific time in the future?
3. what if I want to sign a transaction and send it to someone else to submit it to the network?
4. What if I want to co-sign the transaction from multiple devices owned by multiple people, and the co-signing takes more than 90 seconds, like in a case of a multi-sig operated by a DAO?

All of these use cases are not possible with the regular transactions, and this is where Durable Nonces come in.

## Durable Nonces To overcome the short lifespan of the regular transaction:

Durable Nonces is a way to sign a transaction offchain and keep in a store or a database for some time and then eventually submit it to the network, this feature provides an opportunity to create and sign a transaction that can be submitted at any point in the future. And this (as [mentioned in the official documentations](https://solana.com/developers/guides/advanced/introduction-to-durable-nonces#durable-nonce-applications)) is useful for many use cases such as:

1. **Scheduled Transactions**: One of the most apparent applications of Durable Nonces is the ability to schedule transactions. Users can pre-sign a transaction and then submit it at a later date, allowing for planned transfers, contract interactions, or even executing pre-determined investment strategies.

2. **Multisig Wallets**: Durable Nonces are very useful for multi-signature wallets where one party signs a transaction, and others may confirm at a later time. This feature enables the proposal, review, and later execution of a transaction within a trustless system.

3. **Programs Requiring Future Interaction**: If a program on Solana requires interaction at a future point (such as a vesting contract or a timed release of funds), a transaction can be pre-signed using a Durable Nonce. This ensures the contract interaction happens at the correct time without necessitating the presence of the transaction creator.

4. **Cross-chain Interactions**: When you need to interact with another blockchain, and it requires waiting for confirmations, you could sign the transaction with a Durable Nonce and then execute it once the required confirmations are received.

5. **Decentralized Derivatives Platforms**: In a decentralized derivatives platform, complex transactions might need to be executed based on specific triggers. With Durable Nonces, these transactions can be pre-signed and executed when the trigger condition is met.

Durable Transaction Nonces, which are 32-byte in length (usually represented as base58 encoded strings), are used in place of recent blockhashes to make every transaction unique (to avoid double-spending) while removing the mortality on the unexecuted transaction.

If nonces are used in place of recent blockhashes, the first instruction of the transaction needs to be a nonceAdvance instruction, which changes or advances the nonce. This ensures that every transaction which is signed using the nonce as the recent blockhash, irrespective of being successfully submitted or not, will be unique.

Let's get deep into the technical stuff

## Durable Nonces in-depth

The concept of Durable Nonces is to replace the recent blockhash with a nonce. and This Nonce will be stored in an account called (Nonce Account) and will be used only once in one transaction. The Nonce is a blockhash hashed with some data to make it unique.

Each durable transaction must start with the Nonce Advance instruction, which will change the nonce in the Nonce Account. This will ensure that the nonce is unique and can't be used again in another transaction.

Each Nonce Account has an Authority, the Authority is the public key that can change the Nonce, therefore each durable transaction must be signed by the Authority of the Nonce Account.

Nonce will introduce a few things into the `@solana/web3.js`:
1. 4 new instructions under the SystemProgram:
  1. `nonceInitialize`: This instruction will create a new Nonce Account.
  2. `nonceAdvance`: This instruction will change the Nonce in the Nonce Account.
  3. `nonceWithdraw`: This instruction will withdraw the funds from the Nonce Account, to delete the nonce account withdraw all the funds in it.
  4. `nonceAuthorize`: This instruction will change the Authority of the Nonce Account.
2. NONCE_ACCOUNT_LENGTH: a constant that represents the length of the Nonce Account data.
3. NonceAccount: a class that represents the Nonce Account, it contains a static function `fromAccountData` that can take the nonce account data and return a Nonce Account object.

### Creating the `Nonce-Account`

To create the Nonce-Account using typescript, we will have to:
1. generate a keypair for the nonce account, and generate/get a keypair for the authority.
2. allocate the account and transfer funds to it (the least amount is 0.0015 SOL)
3. initialize the nonce account using the `SystemProgram.nonceInitialize` instruction.

```ts
// 1. generate a keypair for the nonce account, and generate/get a keypair for the authority.
const [nonceKeypair, nonceAuthority] = makeKeypairs(2); // from '@solana-developers/helpers'

const tx = new Transaction().add(
  // 2. allocate the account and transfer funds to it (the least amount is 0.0015 SOL)
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: nonceKeypair.publicKey,
    lamports: 0.0015 * LAMPORTS_PER_SOL,
    space: NONCE_ACCOUNT_LENGTH,
    programId: SystemProgram.programId,
  }),
  // 3. initialize the nonce account using the `SystemProgram.nonceInitialize` instruction.
  SystemProgram.nonceInitialize({
    noncePubkey: nonceKeypair.publicKey,
    authorizedPubkey: nonceAuthority.publicKey,
  }),
);

// send the transaction
await sendAndConfirmTransaction(connection, tx, [payer, nonceKeypair]);
```

The system program will take care of setting the nonce value for us inside the nonce-account.

### fetch the nonce account

We can fetch the nonce account to get the nonce value

```ts
const nonceAccount = await connection.getAccountInfo(nonceKeypair.publicKey);

// { authorizedPubkey: PublicKey; nonce: DurableNonce; feeCalculator: FeeCalculator; }
const nonce = NonceAccount.fromAccountData(nonceAccount.data); 
```

### Use the Nonce in the transaction:

To build a durable transaction, we should make sure to do the following:

1. use the nonce value in replacement of the recent blockhash.
2. add the nonceAdvance instruction as the first instruction in the transaction.
3. sign the transaction with the authority of the nonce account.

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

Since we use `base58.encode` to encode the transaction, we will have to decoded it using `base58.decode` before submitting it. After that we can simply submit it using the `sendAndConfirmRawTransaction` function.

{TODO: it is deprecated to use `sendAndConfirmRawTransaction` without `confirmationStrategy`, but I am still not familiar with that so it needs some research}

```ts
const tx = base58.decode(serializedTx);

const sig = await sendAndConfirmRawTransaction(connection, tx as Buffer);
```

### advancing the nonce:

Advancing the Nonce means that you will discard the current nonce value and take a new one. You might want to do that to expire an old transaction that has been built using the current nonce, or to make sure that the nonce is unique.

This can be done using the `SystemProgram.nonceAdvance` instruction.

```ts
SystemProgram.nonceAdvance({
  authorizedPubkey: nonceAuthority.publicKey,
  noncePubkey: nonceKeypair.publicKey,
}),
```

### withdrawing the funds from the nonce account:

In the case of closing the account, or just withdrawing some funds from it, you can use the `SystemProgram.nonceWithdraw` instruction.

```ts
SystemProgram.nonceWithdraw({
  noncePubkey: nonceKeypair.publicKey,
  toPubkey: payer.publicKey,
  lamports: 0.0015 * LAMPORTS_PER_SOL,
  authorizedPubkey: nonceAuthority.publicKey,
})
```

### changing the authority of the nonce account:

You can change the authority of the nonce account using the `SystemProgram.nonceAuthorize` instruction.

```ts
SystemProgram.nonceAuthorize({
  noncePubkey: nonceKeypair.publicKey,
  authorizedPubkey: oldAuthority.publicKey,
  newAuthorizedPubkey: newAuthority.publicKey,
})
```

## Some important edge cases

### If the transaction Fails

In the case of a failing transaction, the known behavior is that all the instructions in the transaction will get reverted to the original state, and that is in the definition of an atom transaction. But in the case of a durable transaction, even if it fails the nonce will still get advanced although all other instruction will get reverted, and this is for security reasons.

### If the nonce authority dose not sign the transaction

in this case the transaction will fail, and the nonce will not get advanced, because the only one allowed to advance the nonce is the authority of the nonce account.

But if after that the authority of the nonce account changes to be someone who is in the signers list of the transaction, then submitting the transaction now will success, so you should keep in mind that even if you sign a durable transaction and it fails because the authority was not one of the signers, keep in mind that this transaction can still be submitted later if the authority of the nonce account transfer the authority to an account that has already signed the transaction (like your wallet account), so you should be extra carful with signing anything online before knowing all the details of what you are signing into.

After explaining all of that, we are ready to start the lab to get our hands dirty with some code.

# Lab

In this lab we will learn how to create a durable transaction and then we will focus on you can and you can't do with it. Also we will discuss some of the edge cases and how to handle them.

Durable transaction are the solution for having a long-lived transaction that can be signed and stored for a long time before submitting it to the network. We talked before about the how the regular transaction uses the recent blockhash and because of that they had a short lifespan where we would have to sign the transaction and submit it within 80-90 seconds.

Durable Transaction have two differences than a regular transaction:

1. the recent blockhash is replaced with a nonce.
2. the first instruction in the transaction should be a nonce advance instruction.

Therefore to create a durable transaction we should first prepare a nonce account, and then we can assemble the transaction and sign it, and that is what we will see in the lab.

## 0. Getting started

Let's go ahead and clone our starter code

```bash
git clone https://github.com/Unboxed-Software/solana-lab-durable-nonces
cd solana-lab-durable-nonces
git checkout starter
npm install
```


In the starter code you will find a file inside `test/index.ts`, we will write all of our code there.

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

  it('Creates a durable transaction and submits it', async () => { });

  it('Fails if the nonce has advanced', async () => { });

  it('Advances the nonce account even if the transaction fails', async () => { });

  it('The nonce account will not advance if the transaction fails because the nonce auth did not sign the transaction', async () => { });

  it('Submits after changing the nonce auth to an already signed address', async () => { });
});
```

And as you can see, the lab will be divided into 5 steps that will help us understand the durable nonces better.

We will talk about each test case in-depth, in addition to that we will start by implementing a helper function that will create a nonce account for us, we will do that because we will have to create more than one nonce account though out the lab, so we want to have one function that does that for us and call it whenever we need a new nonce account.


## 1. Create the Nonce Account

To create the nonce account we will have to do the following:
1. Get the payer, nonce account, and the nonce authority keypairs from the function parameters, as well as the connection
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
  1. Create the Nonce Account.
  2. Create a new Transaction.
  3. Ste the recentBlockhash to be the nonce value.
  4. Add the `nonceAdvance` instruction as the first instruction in the transaction.
  5. Add the transfer instruction (you can add any instruction you want here).
  6. Sign the transaction with the keyPairs that need to sign it, and make sure to add the nonce authority as a signer as well.
  7. Serialize the transaction and encode it.
  8. at this point you have a durable transaction, you can store it in a database or a file or send it somewhere else, etc.
2. Submit the durable transaction.
  1. Decode the serialized transaction.
  2. Submit it using the `sendAndConfirmRawTransaction` function.

```ts
  it('Creates a durable transaction and submits it', async  => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    // 1. Create a Durable Transaction.
    const [nonceKeypair, recipient] = makeKeypairs(2);

    // 1.1 Create the Nonce Account.
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

## 3. The transaction Fails if the nonce has advanced

Because we are using the nonce in replacement of the recent blockhash, the system will do check to make sure that the nonce we provided is the same as the nonce in the `nonce_account,` this is important for security reasons, so no one can submit the same transaction twice. Because with each transaction we should add the `nonceAdvance` instruction as the first instruction, by that we will ensure that if the transaction will go through the nonce will change and no one would be able to submit it twice

So that is what we will write a test for
1. Create a durable transaction just like in the last step
2. Advance the nonce
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

## 4. The nonce account advanced even if the transaction fails

One of the edge cases that you should pay attention to it is this. Even if the transaction fails for any reason other than the nonce advance instruction, the nonce will still advance. This is for security reasons, so if the user signs a transaction and it fails, he doesn't have to to keep thinking about it, and no one can hold it on him.

Let's imagine this use case, you sign a transaction to transfer 3 SOL from your wallet to buy something, and you discover after signing it that you don't have enough SOL, in this case you would say OK I changed my mind and I don't want to buy this thing anymore.

If that was a regular transaction, you are OK because it will get expired in a minute and no one can submit it anymore, but in the case of a durable transaction, the transaction will never get expired, so if the nonce will not advance, the merchant in this case can still hold this transaction on you and it will wait until you have enough SOL in your wallet to submit the transaction.

Because of that the system program will make sure to advance the nonce even though the transaction fails, and you will have to sign the transaction again

The code below will demonstrate this use case, we will try to create a durable transaction that transfers 50 SOL from the payer to the recipient, but the payer doesn't have enough SOL to do that, so the transaction will fail, but the nonce will still advance.

```ts
it('Advances the nonce account even if the transaction fails', async () => {
  const TRANSFER_AMOUNT = 50;
  const payer = await initializeKeypair(connection, {
    airdropAmount: 3 * LAMPORTS_PER_SOL,
    minimumBalance: 1 * LAMPORTS_PER_SOL,
  });

  const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

  // Create the Nonce Account
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

Notice that we are setting `skipPreflight: true` in the `sendAndConfirmRawTransaction` function, this is because if we don't do that the transaction will never reach the network, and the library will reject it and throw an error, therefore it will fail but the nonce will not advance.

## 5. The nonce account will not advance if the transaction fails because the nonce auth did not sign the transaction

```ts
  it('The nonce account will not advance if the transaction fails because the nonce auth did not sign the transaction', async () => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

    // Create the Nonce Account
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

## 6. Submits after changing the nonce auth to an already signed address

```ts
  it('Submits after changing the nonce auth to an already signed address', async () => {
    const payer = await initializeKeypair(connection, {
      airdropAmount: 3 * LAMPORTS_PER_SOL,
      minimumBalance: 1 * LAMPORTS_PER_SOL,
    });

    const [nonceKeypair, nonceAuthority, recipient] = makeKeypairs(3);

    // Create the Nonce Account
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

    // Create the Nonce Account
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

    // Create the Nonce Account
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

    // Now we will advance the nonce
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

    // Create the Nonce Account
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

    // Create the Nonce Account
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

    // Create the Nonce Account
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


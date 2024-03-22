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

### Creating the `Nonce-Account`:

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

### fetch the nonce account:

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

## Some important edge cases:

### If the transaction Fails:

In the case of a failing transaction, the known behavior is that all the instructions in the transaction will get reverted to the original state, and that is in the definition of an atom transaction. But in the case of a durable transaction, even if it fails the nonce will still get advanced although all other instruction will get reverted, and this is for security reasons.

### If the nonce authority dose not sign the transaction:

in this case the transaction will fail, and the nonce will not get advanced, because the only one allowed to advance the nonce is the authority of the nonce account.

But if after that the authority of the nonce account changes to be someone who is in the signers list of the transaction, then submitting the transaction now will success, so you should keep in mind that even if you sign a durable transaction and it fails because the authority was not one of the signers, keep in mind that this transaction can still be submitted later if the authority of the nonce account transfer the authority to an account that has already signed the transaction (like your wallet account), so you should be extra carful with signing anything online before knowing all the details of what you are signing into.


After explaining all of that, we are ready to start the lab to get our hands dirty with some code.

# Lab

# Challenge

Create your own transfer hook...

---
title: Create Transactions on the Solana Network
objectives:
- Explain transactions
- Explain transaction fees
- Use `@solana/web3.js` to send SOL
- Use `@solana/web3.js` to sign transactions
- Use Solana explorer to view transactions
---

# Summary

All modifications to onchain data happen through **transactions**. Transactions are mostly a set of instructions that invoke Solana programs. Transactions are atomic, meaning they either succeed - if all the instructions have executed properly - or fail, as if the transaction hasn't been run at all. 

# Overview

## Transactions are atomic

Any modification to onchain data happens through transactions sent to programs.

A transaction on Solana is similar to a transaction elsewhere: it is atomic. **Atomic means the entire transaction runs or fails**. 

Think of paying for something online: 

 - The balance of your account is debited
 - The bank transfers the funds to the merchant

Both of these things need to happen for the transaction to be successful. If either of them fail, it is better that none of these things happen, rather than pay the merchant and not debit your account, or debit the account but not pay the merchant. 

Atomic means either the transaction happens - meaning all the individual steps succeed - or the entire transaction fails.

## Transactions contain instructions

The steps within transaction on Solana are called **instructions**. 

Each instruction contains:

- an array of accounts that will be read from and/or written to. This is what makes Solana fast - transactions that affect different accounts are processed simultaneously
- the public key of the program to invoke
- data passed to the program being invoked, structured as a byte array

When a transaction is run, one or more Solana programs are invoked with the instructions included in the transaction.

As you might expect, `@solana/web3.js` provides helper functions for creating transactions and instructions. You can create a new transaction with the constructor, `new Transaction()`. Once created, then you can add instructions to the transaction with the `add()` method.

One of those helper functions is `SystemProgram.transfer()`, which makes an instruction for the `SystemProgram` to transfer some SOL:

```typescript
const transaction = new Transaction()

const sendSolInstruction = SystemProgram.transfer({
  fromPubkey: sender,
  toPubkey: recipient,
  lamports: LAMPORTS_PER_SOL * amount
})

transaction.add(sendSolInstruction)
```

The `SystemProgram.transfer()` function requires:

- a public key corresponding to the sender account
- a public key corresponding to the recipient account
- the amount of SOL to send in lamports.

`SystemProgram.transfer()` returns the instruction for sending SOL from the sender to the recipient. 

The program used in this instruction will be the `system` program (at address `11111111111111111111111111111111`), the data will be the amount of SOL to transfer (in Lamports) and the accounts will be based on the sender and recipient. 

The instruction can then be added to the transaction.

Once all the instructions have been added, a transaction needs to be sent to the cluster and confirmed:

```typescript
const signature = sendAndConfirmTransaction(
  connection,
  transaction,
  [senderKeypair]
)
```

The `sendAndConfirmTransaction()` functions takes as parameters

- a cluster connection
- a transaction
- an array of keypairs that will act as signers on the transaction - in this example, we only have the one signer: the sender.

## Transactions have fees

Transaction fees are built into the Solana economy as compensation to the validator network for the CPU and GPU resources required in processing transactions. Solana transaction fees are deterministic.

The first signer included in the array of signers on a transaction is responsible for paying the transaction fee. If this signer does not have enough SOL in their account to cover the transaction fee, the transaction will be dropped with an error like:

```
> Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.
```

If you get this error, it’s because your keypair is brand new and doesn’t have any SOL to cover the transaction fees. Let’s fix this by adding the following lines just after we've set up the connection:

```typescript
await requestAndConfirmAirdropIfRequired(
  connection,
  keypair.publicKey,
  1 * LAMPORTS_PER_SOL,
  0.5 * LAMPORTS_PER_SOL,
);
```

This will deposit 1 SOL into your account which you can use for testing. This won’t work on Mainnet where it would actually have value. But it's incredibly convenient for testing locally and on Devnet.

You can also use the Solana CLI command `solana airdrop 1` to get free test SOL in your account when testing, whether locally or on devnet.

## Solana Explorer

![Screenshot of Solana Explorer set to Devnet](../assets/solana-explorer-devnet.png)

All transactions on the blockchain are publicly viewable on the [Solana Explorer](http://explorer.solana.com). For example, you could take the signature returned by `sendAndConfirmTransaction()` in the example above, search for that signature in the Solana Explorer, then see:

- when it occurred
- which block it was included in
- the transaction fee
- and more!

![Screenshot of Solana Explorer with details about a transaction](../assets/solana-explorer-transaction-overview.png)

# Lab

We’re going to create a script to send SOL to other students.

### 1. Basic scaffolding

We'll start by using the same packages and `.env` file we made earlier in [intro to cryptography](./intro-to-cryptography).

```typescript
import web3 from "@solana/web3.js";
import dotenv from "dotenv";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers"

dotenv.config();
```

### 2. Create a connection

Let's create a connection:

```typescript
import {
  Connection,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  PublicKey,
} from "@solana/web3.js";
import "dotenv/config"
import { getKeypairFromEnvironment } from "@solana-developers/helpers";

### 3. Ping Program
Now create an async function called `pingProgram()` with two parameters requiring a connection and payer’s keypair as arguments:

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) { }
```

Inside this function, we need to:

1. create a transaction
2. create an instruction
3. add the instruction to the transaction
4. send the transaction.

Remember, the most challenging piece here is including the right information in the instruction. We know the address of the program that we are calling. We also know that the program writes data to a separate account whose address we also have. Let’s add the string versions of both of those as constants at the top of the `index.ts` file:

```typescript
dotenv.config();

const PING_PROGRAM_ADDRESS = new web3.PublicKey('ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa')
const PING_PROGRAM_DATA_ADDRESS =  new web3.PublicKey('Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod')
```

Now, in the `pingProgram()` function, let’s create a new transaction, then initialize a `PublicKey` for the program account, and another for the data account.

```tsx
async function pingProgram(
  connection: web3.Connection,
  payer: web3.Keypair
) {
    const transaction = new web3.Transaction()
    const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
    const programDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)
}
```

### Create the transaction and run it

```typescript
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const programDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: programDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})
```

Next, let’s add the instruction to the transaction we created. Then, call `sendAndConfirmTransaction()` by passing in the connection, transaction, and payer. Finally, let’s log the result of that function call so we can look it up on the Solana Explorer.

```typescript
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const programDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: programDataId,
      isSigner: false,
      isWritable: true
    },
  ],
  programId
})

transaction.add(instruction)

const signature = await web3.sendAndConfirmTransaction(
  connection,
  transaction,
  [payer]
)

const transaction = new Transaction();

### 4. Run the program
Now call the `pingProgram()` 

```typescript
try {
  const payer = getKeypairFromEnvironment("SECRET_KEY");
  console.log(` ✅ Loaded payer keypair ${payer.publicKey.toBase58()}`);

  await pingProgram(connection, payer);
} catch (err) {
  console.error(err);
}
```

### 5. Check the Solana explorer

Now run the code again. It may take a moment or two, but now the code should work and you should see a long string printed to the console, like the following:

```
npx esrun transfer.ts (destination wallet address)
```

# Challenge

Answer the following questions:

 - How much SOL did the transfer take? What is this in USD?

 - Can you find your transaction on https://explorer.solana.com? Remember we are using the `devnet` network.

 - How long does the transfer take? 

 - What do you think "confirmed" means?

## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=dda6b8de-9ed8-4ed2-b1a5-29d7a8a8b415)!
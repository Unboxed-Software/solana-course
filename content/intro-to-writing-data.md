---
title: Write Data To The Solana Network
objectives:
- Explain transactions
- Explain transaction fees
- Use `@solana/web3.js` to send SOL
- Use `@solana/web3.js` to sign transactions
- Use Solana explorer to view transactions
---

# TL;DR

All modifications to on-chain data happen through **transactions**. Transactions are mostly a set of instructions that invoke Solana programs. Transactions are atomic, meaning they either succeed - if all the instructions have executed properly - or fail, as if the transaction hasn't been run at all. 

# Overview

## Transactions

Any modification to on-chain data happens through transactions sent to programs.

Transaction instructions contain:

- an identifier of the program you intend to invoke
- an array of accounts that will be read from and/or written to
- data structured as a byte array that is specified to the program being invoked

When you send a transaction to a Solana cluster, a Solana program is invoked with the instructions included in the transaction.

As you might expect, `@solana/web3.js` provides helper functions for creating transactions and instructions. You can create a new transaction with the constructor, `new Transaction()`. Once created, then you can add instructions to the transaction with the `add()` method.

One of those helper function is `SystemProgram.transfer()`, which makes an instruction for transferring SOL:

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

`SystemProgram.transfer()` returns the instruction for sending SOL from the sender to the recipient. The instruction can then be added to the transaction.

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

### Instructions

The example of sending SOL is great for introducing you to sending transactions, but a lot of web3 development will involve calling non-native programs. In the example above, the `SystemProgram.transfer()` function ensures that you pass all the necessary data required to create the instruction, then it creates the instruction for you. When working with non-native programs, however, you’ll need to be very specific about creating instructions that are structured to match the corresponding program.

With `@solana/web3.js`, you can create non-native instructions with the `TransactionInstruction` constructor. This constructor takes a single argument of the data type `TransactionInstructionCtorFields`.

```tsx
export type TransactionInstructionCtorFields = {
  keys: Array<AccountMeta>;
  programId: PublicKey;
  data?: Buffer;
};
```

Per the definition above, the object passed to the `TransactionInstruction` constructor requires:

- an array of keys of type `AccountMeta`
- the public key for the program being called
- an optional `Buffer` containing data to pass to the program.

We’ll be ignoring the `data` field for now and will revisit it in a future lesson.

The `programId` field is fairly self explanatory: it’s the public key associated with the program. You’ll need to know this in advance of calling the program in the same way that you’d need to know the public key of someone to whom you want to send SOL.

The `keys` array requires a bit more explanation. Each object in this array represents an account that will be read from or written to during a transaction's execution. This means you need to know the behavior of the program you are calling and ensure that you provide all of the necessary accounts in the array.

Each object in the `keys` array must include the following:
- `pubkey` - the public key of the account
- `isSigner` - a boolean representing whether or not the account is a signer on the transaction
- `isWritable` - a boolean representing whether or not the account is written to during the transaction's execution

Putting this all together, we might end up with something like the following:

```tsx
async function callProgram(
  connection: web3.Connection,
  payer: web3.Keypair,
  programId: web3.PublicKey,
  programDataAccount: web3.PublicKey,
) {
  const instruction = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: programDataAccount,
        isSigner: false,
        isWritable: true,
      },
    ],
    programId,
  });

  const transaction = new web3.Transaction().add(instruction)

  const signature = await web3.sendAndConfirmTransaction(
    connection,
    transaction,
    [payer],
  );

  console.log(`✅ Success! Transaction signature is: ${signature}`);
}
```

### Transaction Fees

Transaction fees are built into the Solana economy as compensation to the validator network for the CPU and GPU resources required in processing transactions. Solana transaction fees are deterministic.

The first signer included in the array of signers on a transaction is responsible for paying the transaction fee. If this signer does not have enough SOL in their account to cover the transaction fee, the transaction will be dropped.

When testing, whether locally or on devnet, you can use the Solana CLI command `solana airdrop 1` to get free test SOL in your account for paying transaction fees.

### Solana Explorer

![Screenshot of Solana Explorer set to Devnet](../assets/solana-explorer-devnet.png)

All transactions on the blockchain are publicly viewable on the [Solana Explorer](http://explorer.solana.com). For example, you could take the signature returned by `sendAndConfirmTransaction()` in the example above, search for that signature in the Solana Explorer, then see:

- when it occurred
- which block it was included in
- the transaction fee
- and more!

![Screenshot of Solana Explorer with details about a transaction](../assets/solana-explorer-transaction-overview.png)

# Lab

We’re going to create a script to ping an on-chain program that increments a counter each time it has been pinged. This program exists on the Solana Devnet at address `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa`. The program stores it's data in a specific account at the address `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Solana stores programs and data in seperate accounts](../assets/pdas-note-taking-program.svg)

### 1. Basic scaffolding

We'll start by using the same packages and `.env` file we made earlier in [intro to cryptography](./intro-to-cryptography.md):

```typescript
import * as web3 from "@solana/web3.js";
import * as dotenv from "dotenv";
import base58 from "bs58";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers"

dotenv.config();

const payer = getKeypairFromEnvironment('SECRET_KEY')
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))

```

### 4. Ping program

Now that we've loaded our keypair, we need to connect to Solana’s Devnet. Let's create a connection:

```typescript
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
```

Now create an async function called `sendPingTransaction()` with two parameters requiring a connection and payer’s keypair as arguments:

```tsx
async function sendPingTransaction(connection: web3.Connection, payer: web3.Keypair) { }
```

Inside this function, we need to:

1. create a transaction
2. create an instruction
3. add the instruction to the transaction
4. send the transaction.

Remember, the most challenging piece here is including the right information in the instruction. We know the address of the program that we are calling. We also know that the program writes data to a separate account whose address we also have. Let’s add the string versions of both of those as constants at the top of the `index.ts` file:

```typescript
const PING_PROGRAM_ADDRESS = new web3.PublicKey('ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa')
const PING_PROGRAM_DATA_ADDRESS =  new web3.PublicKey('Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod')
```

Now, in the `sendPingTransaction()` function, let’s create a new transaction, then initialize a `PublicKey` for the program account, and another for the data account.

```tsx
const transaction = new web3.Transaction()
const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)
```

Next, let’s create the instruction. Remember, the instruction needs to include the public key for the Ping program and it also needs to include an array with all the accounts that will be read from or written to. In this example program, only the data account referenced above is needed.

```typescript
const transaction = new web3.Transaction()

const programId = new web3.PublicKey(PING_PROGRAM_ADDRESS)
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: pingProgramDataId,
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
const pingProgramDataId = new web3.PublicKey(PING_PROGRAM_DATA_ADDRESS)

const instruction = new web3.TransactionInstruction({
  keys: [
    {
      pubkey: pingProgramDataId,
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

console.log(`✅ Transaction completed! Signature is ${signature}`)
```

### 5. Airdrop

Now run the code with `npx esrun send-ping-instruction.ts` and see if it works. You may end up with the following error in the console:

```
> Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.
```

If you get this error, it’s because your keypair is brand new and doesn’t have any SOL to cover the transaction fees. Let’s fix this by adding the following line before the call to `sendPingTransaction()`:

```typescript
await connection.requestAirdrop(payer.publicKey, web3.LAMPORTS_PER_SOL*1)
```

This will deposit 1 SOL into your account which you can use for testing. This won’t work on Mainnet where it would actually have value. But it's incredibly convenient for testing locally and on Devnet.

### 6. Check the Solana explorer

Now run the code again. It may take a moment or two, but now the code should work and you should see a long string printed to the console, like the following:

```
✅ Transaction completed! Signature is 55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Copy the transaction signature. Open a browser and go to [https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet) (the query parameter at the end of the URL will ensure that you’ll explore transactions on Devnet instead of Mainnet). Paste the signature into the search bar at the top of Solana’s Devnet explorer and hit enter. You should see all the details about the transaction. If you scroll all the way to the bottom, then you will see `Program Logs`, which show how many times the program has been pinged including your ping.

![Screenshot of Solana Explorer with logs from calling the Ping program](../assets/solana-explorer-ping-result.png)

Scroll around the Explorer and look at what you're seeing:
 - The **Account Input(s)** will include: 
  - The address of your payer - being debited 5000 lamports for the transaction
  - The program address for the ping program
  - The data address for the ping program
 - The **Instruction** section will contain a single instructionm, with no data - the ping program is a pretty simple program, so it doesn't need any data.
 - The **Program Instruction Logs** shows the logs from the ping program.  

[//]: # "TODO: these would make a good question-and-answer interactive once we have this content hosted on solana.com, and can support adding more interactive content easily."

If you want to make it easier to look at Solana Explorer for transactions in the future, simply change your `console.log` in `sendPingTransaction()` to the following:

```typescript
console.log(`You can view your transaction on the Solana Explorer at:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`)
```

And just like that you’re calling programs on the Solana network and writing data to chain!

### Next steps

In the next few lessons you’ll learn how to

1. Send transactions safely from the browser instead of from running a script
2. Add custom data to your instructions
3. Deserialize data from the chain

# Challenge

Go ahead and create a script from scratch that will allow you to transfer SOL from one account to another on Devnet. Be sure to print out the transaction signature so you can look at it on the Solana Explorer.

If you get stuck feel free to glance at the [solution code](https://github.com/Unboxed-Software/solana-ping-client).

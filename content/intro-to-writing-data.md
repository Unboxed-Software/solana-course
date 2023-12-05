---
title: Create Transactions on the Solana Network
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

## Transactions are atomic

Any modification to on-chain data happens through transactions sent to programs.

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

The first signer included in the array of signers on a transaction is responsible for paying the transaction fee. If this signer does not have enough SOL in their account to cover the transaction fee, the transaction will be dropped.

When testing, whether locally or on devnet, you can use the Solana CLI command `solana airdrop 1` to get free test SOL in your account for paying transaction fees.

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

We'll start by using the same packages and `.env` file we made earlier in [intro to cryptography](./intro-to-cryptography.md).

Create a file called `transfer.ts`:

```typescript
import * as web3 from "@solana/web3.js";
import * as dotenv from "dotenv";
import base58 from "bs58";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers"
const toPubkey = new PublicKey(suppliedToPubkey);

dotenv.config();

const senderKeypair = getKeypairFromEnvironment("SECRET_KEY");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");


console.log(`✅ Loaded our own keypair, the destination public key, and connected to Solana`);
```

Run the script to ensure it connects, loads your keypair, and loads:


```
npx esrun transfer.ts (destination wallet address)
```

### Create the transaction and run it

Add the following to complete the transaction and send it:

```typescript
console.log(`✅ Loaded our own keypair, the destination public key, and connected to Solana`);

const transaction = new Transaction();

const LAMPORTS_TO_SEND = 5000;

const sendSolInstruction = SystemProgram.transfer({
  fromPubkey: senderKeypair.publicKey,
  toPubkey,
  lamports: LAMPORTS_TO_SEND,
});

transaction.add(sendSolInstruction);

const signature = await sendAndConfirmTransaction(connection, transaction, [
  senderKeypair,
]);

console.log(`💸 Finished! Sent ${LAMPORTS_TO_SEND} to the address ${toPubkey}. `);
console.log(`Transaction signature is ${signature}!`);
```
### Experiment!

Send SOL to other students in the class.

```
npx esrun transfer.ts (destination wallet address)
```

# Challenge

Answer the following questions:

 - How much Solana did the transfer take? What is this in USD?

 - Can you find your translation on https://explorer.solana.com? Remember we are using the `devnet` network.

 - How long does the transfer take? 

 - What do you think "confirmed" means?
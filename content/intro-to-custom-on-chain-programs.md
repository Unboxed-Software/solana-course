---
title: Using custom onchain programs
objectives:
- Create transactions for custom onchain programs
---

# Summary

Solana has multiple onchain programs you can use. Instructions that use these programs need to have data in a custom format determined by the program.

# Lesson
### Instructions

In previous chapters, we used the `SystemProgram.transfer()` function to create an instruction to send SOL.

When working with non-native programs, however, you’ll need to be more specific about creating instructions that are structured to match the corresponding program.

With `@solana/web3.js`, you can create non-native instructions with the `TransactionInstruction` constructor. This constructor takes a single argument of the data type `TransactionInstructionCtorFields`.

```typescript
export type TransactionInstructionCtorFields = {
  keys: Array<AccountMeta>;
  programId: PublicKey;
  data?: Buffer;
};
```

Per the definition above, the object passed to the `TransactionInstruction` constructor requires:

- an array of keys of type `AccountMeta`
- the public key for the program that is being called
- an optional `Buffer` containing data to pass to the program.

We’ll be ignoring the `data` field for now and will revisit it in a future lesson.

The `programId` field is fairly self-explanatory: it’s the public key associated with the program. You’ll need to know this in advance of calling the program in the same way that you’d need to know the public key of someone to whom you want to send SOL.

The `keys` array requires a bit more explanation. Each object in this array represents an account that will be read from or written to during a transaction's execution. This means you need to know the behavior of the program you are calling and ensure that you provide all of the necessary accounts in the array.

Each object in the `keys` array must include the following keys:

- `pubkey` - the public key of the account
- `isSigner` - a boolean representing whether or not the account is a signer on the transaction
- `isWritable` - a boolean representing whether or not the account is written to during the transaction's execution

Putting this all together, we might end up with something like the following:

```typescript
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
```

### Solana Explorer

![Screenshot of Solana Explorer set to Devnet](../assets/solana-explorer-devnet.png)

All transactions on the blockchain are publicly viewable on [Solana Explorer](http://explorer.solana.com). For example, you could take the signature returned by `sendAndConfirmTransaction()` in the example above, search for that signature in Solana Explorer, then see:

- when it occurred
- which block it was included in
- the transaction fee
- and more!

![Screenshot of Solana Explorer with details about a transaction](../assets/solana-explorer-transaction-overview.png)

# Lab
### Writing transactions for the ping counter program

We’re going to create a script to ping an onchain program that increments a counter each time it has been pinged. This program exists on the Solana Devnet at address `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa`. The program stores its data in a specific account at the address `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

![Solana stores programs and data in separate accounts](../assets/pdas-global-state.svg)

### 1. Basic scaffolding

We'll start by using the same packages and `.env` file we made earlier in [Intro to Writing Data](./intro-to-writing-data).

Name the file `send-ping-transaction.ts`:

```typescript
import * as web3 from "@solana/web3.js";
import "dotenv/config"
import { getKeypairFromEnvironment, airdropIfRequired } from "@solana-developers/helpers";

const payer = getKeypairFromEnvironment('SECRET_KEY')
const connection = new web3.Connection(web3.clusterApiUrl('devnet'))

const newBalance = await airdropIfRequired(
  connection,
  payer.publicKey,
  1 * web3.LAMPORTS_PER_SOL,
  0.5 * web3.LAMPORTS_PER_SOL,
);
```

This will connect to Solana Devnet and request some test Lamports if needed.

### 2. Ping program

Now let's talk to the Ping program! To do this, we need to:

1. create a transaction
2. create an instruction
3. add the instruction to the transaction
4. send the transaction

Remember, the most challenging piece here is including the right information in the instructions. We know the address of the program that we are calling. We also know that the program writes data to a separate account whose address we also have. Let’s add the string versions of both of those as constants at the top of the file:

```typescript
const PING_PROGRAM_ADDRESS = new web3.PublicKey('ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa')
const PING_PROGRAM_DATA_ADDRESS =  new web3.PublicKey('Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod')
```

Now let’s create a new transaction, then initialize a `PublicKey` for the program account, and another for the data account.

```typescript
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

Next, let’s add this instruction to the transaction we created. Then, call `sendAndConfirmTransaction()` by passing in the connection, transaction, and payer. Finally, let’s log the result of that function call so we can look it up on Solana Explorer.

```typescript
transaction.add(instruction)

const signature = await web3.sendAndConfirmTransaction(
  connection,
  transaction,
  [payer]
)

console.log(`✅ Transaction completed! Signature is ${signature}`)
```

### 3. Run the ping client and check Solana Explorer

Now run the code with the following command:

```bash
npx esrun send-ping-transaction.ts
```

It may take a moment or two but you should see a long string printed to the console, like the following:

```
✅ Transaction completed! Signature is 55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Copy the transaction signature. Open a browser and go to [https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet) (the query parameter at the end of the URL will ensure that you’ll explore transactions on Devnet instead of Mainnet). Paste the signature into the search bar at the top of Solana Explorer (make sure you're connected to Devnet) and hit enter. You should see all the details about the transaction. If you scroll all the way to the bottom, then you will see `Program Logs`, which show how many times the program has been pinged including your ping.

![Screenshot of Solana Explorer with logs from calling the Ping program](../assets/solana-explorer-ping-result.png)

Scroll around the explorer and look at what you're seeing:
- The **Account Input(s)** will include:
  - The address of your payer - being debited 5000 lamports for the transaction
  - The program address for the ping program
  - The data address for the ping program
- The **Instruction** section will contain a single instruction with no data - the ping program is a pretty simple program, so it doesn't need any data.
- The **Program Instruction Logs** show the logs from the ping program.

[//]: # "TODO: these would make a good question-and-answer interactive once we have this content hosted on solana.com, and can support adding more interactive content easily."

If you want to make it easier to look at Solana Explorer for transactions in the future, simply change your `console.log` to the following:

```typescript
console.log(`You can view your transaction on Solana Explorer at:\nhttps://explorer.solana.com/tx/${signature}?cluster=devnet`)
```

And just like that you’re calling programs on the Solana network and writing data to chain!

In the next few lessons, you’ll learn how to

1. Send transactions safely from the browser instead of running a script
2. Add custom data to your instructions
3. Deserialize data from the chain

# Challenge

Go ahead and create a script from scratch that will allow you to transfer SOL from one account to another on Devnet. Be sure to print out the transaction signature so you can look at it on Solana Explorer.

If you get stuck feel free to glance at the [solution code](https://github.com/Unboxed-Software/solana-ping-client).


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e969d07e-ae85-48c3-976f-261a22f02e52)!

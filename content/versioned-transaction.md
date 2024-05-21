---
title: Versioned Transactions and Lookup Tables
objectives:
- Create versioned transactions
- Create lookup tables
- Extend lookup tables
- Use lookup tables with versioned transactions
---

# Summary

-   **Versioned Transactions** refers to a way to support both legacy versions and newer versions of transaction formats. The original transaction format is "legacy" and new transaction versions start at version 0. Versioned transactions were implemented to support the use of Address Lookup Tables (also called lookup tables or LUTs).
-   **Address Lookup Tables** are accounts used to store addresses of other accounts, which can then be referenced in versioned transactions using a 1 byte index instead of the full 32 bytes per address. This enables the creation of more complex transactions than what was possible prior to the introduction of LUTs.

# Lesson

By design, Solana transactions are limited to 1232 bytes. Transactions exceeding this size will fail. While this enables a number of network optimizations, it can also limit the types of atomic operations that can be performed on the network.

To help get around the transaction size limitation, Solana released a new transaction format that allows support for multiple versions of transaction formats. At the time of writing, Solana supports two transaction versions:

1. `legacy` - the original transaction format
2. `0` - the newest transaction format that includes support for Address Lookup Tables

Versioned transactions don't require any modifications to existing Solana programs, but any client-side code created prior to the release of versioned transactions should be updated. In this lesson, we'll cover the basics of versioned transactions and how to use them, including:

-   Creating versioned transactions
-   Creating and managing lookup tables
-   Using lookup tables in versioned transactions

## Versioned Transactions

One of the items taking up the most space in Solana transactions is the inclusion of full account addresses. At 32 bytes each, 39 accounts will render a transaction too large. That's not even accounting for instruction data. In practice, most transactions will be too large with around 20 accounts.

Solana released versioned transactions to support multiple transaction formats. Alongside the release of versioned transactions, Solana released version 0 of transactions to support Address Lookup Tables. Lookup tables are separate accounts that store account addresses and then allow them to be referenced in a transaction using a 1 byte index. This significantly decreases the size of a transaction since each included account now only needs to use 1 byte instead of 32 bytes.

Even if you don't need to use lookup tables, you'll need to know how to support versioned transactions in your client-side code. Fortunately, everything you need to work with versioned transactions and lookup tables is included in the `@solana/web3.js` library.

### Create versioned transactions

To create a versioned transaction, you simply create a `TransactionMessage` with the following parameters:

-   `payerKey` - the public key of the account that will pay for the transaction
-   `recentBlockhash` - a recent blockhash from the network
-   `instructions` - the instructions to include in the transaction

You then transform this message object into a version `0` transaction using the `compileToV0Message()` method.

```typescript
import * as web3 from "@solana/web3.js";

// Example transfer instruction
const transferInstruction = [
    web3.SystemProgram.transfer({
        fromPubkey: payer.publicKey, // Public key of account that will send the funds
        toPubkey: toAccount.publicKey, // Public key of the account that will receive the funds
        lamports: 1 * LAMPORTS_PER_SOL, // Amount of lamports to be transferred
    }),
];

// Get the latest blockhash
let { blockhash } = await connection.getLatestBlockhash();

// Create the transaction message
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Public key of the account that will pay for the transaction
    recentBlockhash: blockhash, // Latest blockhash
    instructions: transferInstruction, // Instructions included in transaction
}).compileToV0Message();
```

Finally, you pass the compiled message into the `VersionedTransaction` constructor to create a new versioned transaction. Your code can then sign and send the transaction to the network, similar to a legacy transaction.

```typescript
// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

## Address Lookup Table

Address Lookup Tables (also called lookup tables or LUTs) are accounts that store a lookup table of other account addresses. These LUT accounts are owned by the Address Lookup Table Program and are used to increase the number of accounts that can be included in a single transaction.

Versioned transactions can include the address of an LUT account and then reference additional accounts with a 1-byte index instead of including the full address of those accounts. This significantly reduces the amount of space used for referencing accounts in a transaction.

To simplify the process of working with LUTs, the `@solana/web3.js` library includes an `AddressLookupTableProgram` class which provides a set of methods to create instructions for managing LUTs. These methods include:

-   `createLookupTable` - creates a new LUT account
-   `freezeLookupTable` - makes an existing LUT immutable
-   `extendLookupTable` - adds addresses to an existing LUT
-   `deactivateLookupTable` - puts an LUT in a “deactivation” period before it can be closed
-   `closeLookupTable` - permanently closes an LUT account

### Create a lookup table

You use the `createLookupTable` method to construct the instruction that creates a lookup table. The function requires the following parameters:

-   `authority` - the account that will have permission to modify the lookup table
-   `payer` - the account that will pay for the account creation
-   `recentSlot` - a recent slot to derive the lookup table's address

The function returns both the instruction to create the lookup table and the address of the lookup table.

```typescript
// Get the current slot
const slot = await connection.getSlot();

// Create an instruction for creating a lookup table
// and retrieve the address of the new lookup table
const [lookupTableInst, lookupTableAddress] =
    web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentSlot: slot - 1, // The recent slot to derive lookup table's address
    });
```

Under the hood, the lookup table address is simply a PDA derived using the `authority` and `recentSlot` as seeds.

```typescript
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

Note that using the most recent slot sometimes results in an error after sending the transaction. To avoid this, you can use a slot that is one slot prior the most recent one (e.g. `recentSlot: slot - 1`). However, if you still encounter an error when sending the transaction, you can try resending the transaction.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"188115589 is not a recent slot",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### Extend a lookup table

You use the `extendLookupTable` method to create an instruction that adds addresses to an existing lookup table. It takes the following parameters:

-   `payer` - the account that will pay for the transaction fees and any increased rent
-   `authority` - the account that has permission to change the lookup table
-   `lookupTable` - the address of the lookup table to extend
-   `addresses` - the addresses to add to the lookup table

The function returns an instruction to extend the lookup table.

```typescript
const addresses = [
    new web3.PublicKey("31Jy3nFeb5hKVdB4GS4Y7MhU7zhNMFxwF7RGVhPc1TzR"),
    new web3.PublicKey("HKSeapcvwJ7ri6mf3HwBtspLFTDKqaJrMsozdfXfg5y2"),
    // add more addresses
];

// Create an instruction to extend a lookup table with the provided addresses
const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
    payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    lookupTable: lookupTableAddress, // The address of the lookup table to extend
    addresses: addresses, // The addresses to add to the lookup table
});
```

Note that when extending a lookup table, the number of addresses that can be added in one instruction is limited by the transaction size limit, which is 1232 bytes. This means you can add 30 addresses to a lookup table at a time. If you need to add more than that, you'll need to send multiple transactions. Each lookup table can store a maximum of 256 addresses.

### Send Transaction

After creating the instructions, you can add them to a transaction and sent it to the network.

```typescript
// Get the latest blockhash
let { blockhash } = await connection.getLatestBlockhash();

// Create the transaction message
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // Public key of the account that will pay for the transaction
    recentBlockhash: blockhash, // Latest blockhash
    instructions: [lookupTableInst, extendInstruction], // Instructions included in transaction
}).compileToV0Message();

// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

Note that when you first create or extend a lookup table, it needs to "warm up" for one slot before the LUT or new addresses can be used in transactions. In other words, you can only use lookup tables and access addresses that were added prior to the current slot.

```typescript
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

If you encounter the error above or are unable to access addresses in a lookup table immediately after extending it, it's likely because you're attempting to access the lookup table or a specific address prior to the end of the warm up period. To avoid this issue, add a delay after extending the lookup table before sending a transaction that references the table.

### Deactivate a lookup table

When a lookup table is no longer needed, you can deactivate and close it to reclaim its rent balance. Address lookup tables can be deactivated at any time, but they can continue to be used by transactions until a specified "deactivation" slot is no longer "recent". This "cool-down" period ensures that in-flight transactions can't be censored by LUTs being closed and recreated in the same slot. The deactivation period is approximately 513 slots.

To deactivate an LUT, use the `deactivateLookupTable` method and pass in the following parameters:

-   `lookupTable` - the address of the LUT to be deactivated
-   `authority` - the account with permission to deactivate the LUT

```typescript
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress, // The address of the lookup table to deactivate
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    });
```

### Close a lookup table

To close a lookup table after its deactivation period, use the `closeLookupTable` method. This method creates an instruction to close a deactivated lookup table and reclaim its rent balance. It takes the following parameters:

-   `lookupTable` - the address of the LUT to be closed
-   `authority` - the account with permission to close the LUT
-   `recipient` - the account that will receive the reclaimed rent balance

```typescript
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to close
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    recipient: user.publicKey, // The recipient of closed account lamports
});
```

Attempting to close a lookup table before it's been fully deactivated will result in an error.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Table cannot be closed until it's fully deactivated in 513 blocks",
"Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### Freeze a lookup table

In addition to standard CRUD operations, you can "freeze" a lookup table. This makes it immutable so that it can no longer be extended, deactivated, or closed.

You freeze a lookup table with the `freezeLookupTable` method. It takes the following parameters:

-   `lookupTable` - the address of the LUT to be frozen
-   `authority` - the account with permission to freeze the LUT

```typescript
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to freeze
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
});
```

Once an LUT is frozen, any further attempts to modify it will result in an error.

```
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
"Lookup table is frozen",
"Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### Using lookup tables in versioned transactions

To use a lookup table in a versioned transaction, you need to retrieve the lookup table account using its address.

```typescript
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

You can then create a list of instructions to include in a transaction as usual. When creating the `TransactionMessage`, you can include any lookup table accounts by passing them as an array to the `compileToV0Message()` method. You can also provide multiple lookup table accounts.

```typescript
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
    recentBlockhash: blockhash, // The blockhash of the most recent block
    instructions: instructions, // The instructions to include in the transaction
}).compileToV0Message([lookupTableAccount]); // Include lookup table accounts

// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

# Lab

Let's go ahead and practice using lookup tables!

this lab will guide you through the steps of creating, extending, and then using a lookup table in a versioned transaction.

### 1. Get the starter code

To begin, download the starter code from the starter branch of this [repository](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/starter). Once you have the starter code, run `npm install` in the terminal to install the required dependencies.

The starter code includes an example of creating a legacy transaction that intends to atomically transfer SOL to 22 recipients. The transaction contains 22 instructions where each instruction transfers SOL from the signer to a different recipient.

The purpose of the starter code is to illustrate the limitation on the number of addresses that can be included in a legacy transaction. The transaction built in the starter code is expected to fail when sent.

The following starter code can be found in the `index.ts` file.

```typescript
import { initializeKeypair } from "./initializeKeypair";
import * as web3 from "@solana/web3.js";

async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    // Create an array of transfer instructions
    const transferInstructions = [];

    // Add a transfer instruction for each address
    for (const address of recipients) {
        transferInstructions.push(
            web3.SystemProgram.transfer({
                fromPubkey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
                toPubkey: address, // The destination account for the transfer
                lamports: web3.LAMPORTS_PER_SOL * 0.01, // The amount of lamports to transfer
            }),
        );
    }

    // Create a transaction and add the transfer instructions
    const transaction = new web3.Transaction().add(...transferInstructions);

    // Send the transaction to the cluster (this will fail in this example if addresses > 21)
    const txid = await connection.sendTransaction(transaction, [user]);

    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Confirm the transaction
    await connection.confirmTransaction({
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
        signature: txid,
    });

    // Log the transaction URL on the Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

To execute the code, run `npm start`. This will create a new keypair, write it to the `.env` file, airdrop devnet SOL to the keypair, and send the transaction built in the starter code. The transaction is expected to fail with the error message `Transaction too large`.

```
Creating .env file
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: 5ZZzcDbabFHmoZU8vm3VzRzN5sSQhkf91VJzHAJGNM7B
Error: Transaction too large: 1244 > 1232
```

In the next steps, we'll go over how to use lookup tables with versioned transactions to increase the number of addresses that can be included in a single transaction.

Before we start, go ahead and delete the content of the `main` function to leave only the following:

```typescript
async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const addresses = [];
    for (let i = 0; i < 22; i++) {
        addresses.push(web3.Keypair.generate().publicKey);
    }
}
```

### 2. Create a `sendV0Transaction` helper function

We'll be sending multiple "version 0" transactions, so let's create a helper function to facilitate this.

This function should take parameters for a connection, a user's keypair, an array of transaction instructions, and an optional array of lookup table accounts.

The function then performs the following tasks:

-   Retrieves the latest blockhash and last valid block height from the Solana network
-   Creates a new transaction message using the provided instructions
-   Signs the transaction using the user's keypair
-   Sends the transaction to the Solana network
-   Confirms the transaction
-   Logs the transaction URL on the Solana Explorer

```typescript
async function sendV0Transaction(
    connection: web3.Connection,
    user: web3.Keypair,
    instructions: web3.TransactionInstruction[],
    lookupTableAccounts?: web3.AddressLookupTableAccount[],
) {
    // Get the latest blockhash and last valid block height
    const { lastValidBlockHeight, blockhash } =
        await connection.getLatestBlockhash();

    // Create a new transaction message with the provided instructions
    const messageV0 = new web3.TransactionMessage({
        payerKey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentBlockhash: blockhash, // The blockhash of the most recent block
        instructions, // The instructions to include in the transaction
    }).compileToV0Message(
        lookupTableAccounts ? lookupTableAccounts : undefined,
    );

    // Create a new transaction object with the message
    const transaction = new web3.VersionedTransaction(messageV0);

    // Sign the transaction with the user's keypair
    transaction.sign([user]);

    // Send the transaction to the cluster
    const txid = await connection.sendTransaction(transaction);

    // Confirm the transaction
    await connection.confirmTransaction(
        {
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            signature: txid,
        },
        "finalized",
    );

    // Log the transaction URL on the Solana Explorer
    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);
}
```

### 3. Create a `waitForNewBlock` helper function

Recall that lookup tables and the addresses contained in them can't be referenced immediately after creation or extension. This means we'll end up needing to wait for a new block before submitting transactions that reference the newly created or extended lookup table. To make this simpler down the road, let's create a `waitForNewBlock` helper function that we'll use to wait for lookup tables to activate between sending transactions.

This function will have parameters for a connection and a target block height. It then starts an interval that checks the current block height of the network every 1000ms. Once the new block height exceeds the target height, the interval is cleared and the promise is resolved.

```typescript
function waitForNewBlock(connection: web3.Connection, targetHeight: number) {
    console.log(`Waiting for ${targetHeight} new blocks`);
    return new Promise(async (resolve: any) => {
        // Get the last valid block height of the blockchain
        const { lastValidBlockHeight } = await connection.getLatestBlockhash();

        // Set an interval to check for new blocks every 1000ms
        const intervalId = setInterval(async () => {
            // Get the new valid block height
            const { lastValidBlockHeight: newValidBlockHeight } =
                await connection.getLatestBlockhash();
            // console.log(newValidBlockHeight)

            // Check if the new valid block height is greater than the target block height
            if (newValidBlockHeight > lastValidBlockHeight + targetHeight) {
                // If the target block height is reached, clear the interval and resolve the promise
                clearInterval(intervalId);
                resolve();
            }
        }, 1000);
    });
}
```

### 4. Create an `initializeLookupTable` function

Now that we have some helper functions ready to go, declare a function named `initializeLookupTable`. This function has parameters `user`, `connection`, and `addresses`. The function will:

1. Retrieve the current slot
2. Generate an instruction for creating a lookup table
3. Generate an instruction for extending the lookup table with the provided addresses
4. Send and confirm a transaction with the instructions for creating and extending the lookup table
5. Return the address of the lookup table

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());

    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    return lookupTableAddress;
}
```

### 5. Modify `main` to use lookup tables

Now that we can initialize a lookup table with all of the recipients' addresses, let's update `main` to use versioned transactions and lookup tables. We'll need to:

1. Call `initializeLookupTable`
2. Call `waitForNewBlock`
3. Get the lookup table using `connection.getAddressLookupTable`
4. Create the transfer instruction for each recipient
5. Send the v0 transaction with all of the transfer instructions

```typescript
async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());

    // Generate 22 addresses
    const recipients = [];
    for (let i = 0; i < 22; i++) {
        recipients.push(web3.Keypair.generate().publicKey);
    }

    const lookupTableAddress = await initializeLookupTable(
        user,
        connection,
        recipients,
    );

    await waitForNewBlock(connection, 1);

    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    if (!lookupTableAccount) {
        throw new Error("Lookup table not found");
    }

    const transferInstructions = recipients.map((recipient) => {
        return web3.SystemProgram.transfer({
            fromPubkey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            toPubkey: recipient, // The destination account for the transfer
            lamports: web3.LAMPORTS_PER_SOL * 0.01, // The amount of lamports to transfer
        });
    });

    await sendV0Transaction(connection, user, transferInstructions, [
        lookupTableAccount,
    ]);
}
```

Notice that you create the transfer instructions with the full recipient address even though we created a lookup table. That's because by including the lookup table in the versioned transaction, you tell the `web3.js` framework to replace any recipient addresses that match addresses in the lookup table with pointers to the lookup table instead. By the time the transaction is sent to the network, addresses that exist in the lookup table will be referenced by a single byte rather than the full 32 bytes.

Use `npm start` in the command line to execute the `main` function. You should see an output similar to the following:

```bash
Current balance is 1.38866636
PublicKey: 8iGVBt3dcJdp9KfyTRcKuHY6gXCMFdnSG2F1pAwsUTMX
lookup table address: Cc46Wp1mtci3Jm9EcH35JcDQS3rLKBWzy9mV1Kkjjw7M
https://explorer.solana.com/tx/4JvCo2azy2u8XK2pU8AnJiHAucKTrZ6QX7EEHVuNSED8B5A8t9GqY5CP9xB8fZpTNuR7tbUcnj2MiL41xRJnLGzV?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/rgpmxGU4QaAXw9eyqfMUqv8Lp6LHTuTyjQqDXpeFcu1ijQMmCH2V3Sb54x2wWAbnWXnMpJNGg4eLvuy3r8izGHt?cluster=devnet
Finished successfully
```

The first transaction link in the console represents the transaction for creating and extending the lookup table. The second transaction represents the transfers to all recipients. Feel free to inspect these transactions in the explorer.

Remember, this same transaction was failing when you first downloaded the starter code. Now that we're using lookup tables, we can do all 22 transfers in a single transaction.

### 6. Add more address to the lookup table

Keep in mind that the solution we've come up with so far only supports transfers to up to 30 accounts since we only extend the lookup table once. When you factor in the transfer instruction size, it's actually possible to extend the lookup table with an additional 27 addresses and complete an atomic transfer to up to 57 recipients. Let's go ahead and add support for this now!

All we need to do is go into `initializeLookupTable` and do two things:

1. Modify the existing call to `extendLookupTable` to only add the first 30 addresses (any more than that and the transaction will be too large)
2. Add a loop that will keep extending a lookup table 30 addresses at a time until all addresses have been added

```typescript
async function initializeLookupTable(
    user: web3.Keypair,
    connection: web3.Connection,
    addresses: web3.PublicKey[],
): Promise<web3.PublicKey> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create an instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());

    // Create an instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses.slice(0, 30), // The addresses to add to the lookup table
    });

    await sendV0Transaction(connection, user, [
        lookupTableInst,
        extendInstruction,
    ]);

    var remaining = addresses.slice(30);

    while (remaining.length > 0) {
        const toAdd = remaining.slice(0, 30);
        remaining = remaining.slice(30);
        const extendInstruction =
            web3.AddressLookupTableProgram.extendLookupTable({
                payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
                authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
                lookupTable: lookupTableAddress, // The address of the lookup table to extend
                addresses: toAdd, // The addresses to add to the lookup table
            });

        await sendV0Transaction(connection, user, [extendInstruction]);
    }

    return lookupTableAddress;
}
```

Congratulations! If you feel good about this lab, you're probably ready to work with lookup tables and versioned transactions on your own. If you want to take a look at the final solution code you can [find it on the solution branch](https://github.com/Unboxed-Software/solana-versioned-transactions/tree/solution).

# Challenge

As a challenge, experiment with deactivating, closing and freezing lookup tables. Remember that you need to wait for a lookup table to finish deactivating before you can close it. Also, if a lookup table is frozen, it cannot be modified (deactivated or closed), so you will have to test separately or use separate lookup tables.

1. Create a function for deactivating the lookup table.
2. Create a function for closing the lookup table
3. Create a function for freezing the lookup table
4. Test the functions by calling them in the `main()` function

You can reuse the functions we created in the lab for sending the transaction and waiting for the lookup table to activate/deactivate. Feel free to reference this [solution code](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge).


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=b58fdd00-2b23-4e0d-be55-e62677d351ef)!

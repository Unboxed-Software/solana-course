# Versioned Transaction and Lookup Tables

# Lesson Objectives

_By the end of this lesson, you will be able to:_

-   Create versioned transactions
-   Create lookup tables
-   Extend lookup tables
-   Use lookup tables with versioned transactions

# TL;DR

-   **Versioned Transactions** refers to a new transaction format that supports the use of Address Lookup Tables (LUTs).
-   **Address Lookup Tables (LUTs)** are accounts used to store addresses of other accounts, which can then be referenced in versioned transactions using a 1 byte index instead of the full 32 bytes per address, enabling the creation of more complex transactions.

# Overview

In this lesson, we will cover how to use of versioned transactions and lookup tables. Specifically, you will learn how to:

-   Create versioned transactions
-   Create and manage lookup tables
-   Utilize lookup tables with versioned transactions

Solana transactions are limited to 1232 bytes. To increase the number of accounts that can be included in a single transaction, Address Lookup Tables (LUTs) are used. LUT accounts store addresses and allow them to be referenced in a transaction using a 1 byte index instead of the full 32 bytes per address, enabling the creation of more complex transactions.

Everything you need to work with versioned transactions and lookup tables is included in the `@solana/web3.js` library.

## Versioned Transaction

"Versioned Transactions" refer to a new transaction format that supports the use of LUTs. Transactions using this format are identified as version `0`, while transactions using the older format are referred to as `legacy` transactions.

### Create versioned transaction

To create a versioned transaction, a new `TransactionMessage` is constructed with the following parameters:

-   `payerKey` - the public key of the account that will pay for the transaction
-   `recentBlockhash` - the current recent from the network
-   `instructions` - the instructions of the transaction, such as the transfer details

Then this message is then transformed into version `0` format using the `compileToV0Message()` method.

```tsx
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

The `TransactionMessage` is then passed into `VersionedTransaction` to create a new versioned transaction. The transaction can then be signed and sent to the network, similar to a legacy transaction.

```tsx
// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

## Address Lookup Table

Address Lookup Tables (LUTs) are accounts that are used to store other addresses, which can then be referenced in versioned transactions. These LUT accounts are owned by the Address Lookup Table Program and are used to increase the number of accounts that can be included in a single transaction.

To simplify the process of working with LUTs, the `@solana/web3.js` library includes a `AddressLookupTableProgram` class which provides a set of methods to create instructions for managing LUTs. These methods include:

-   `createLookupTable` - creates a new LUT account
-   `freezeLookupTable` - makes an existing LUT immutable
-   `extendLookupTable` - adds addresses to an existing LUT
-   `deactivateLookupTable` - puts a LUT in a “deactivation” period before it can be closed
-   `closeLookupTable` - permanently closes a LUT account

```tsx
export class AddressLookupTableProgram {
    static programId: PublicKey;
    static createLookupTable(
        params: CreateLookupTableParams,
    ): [TransactionInstruction, PublicKey];
    static freezeLookupTable(
        params: FreezeLookupTableParams,
    ): TransactionInstruction;
    static extendLookupTable(
        params: ExtendLookupTableParams,
    ): TransactionInstruction;
    static deactivateLookupTable(
        params: DeactivateLookupTableParams,
    ): TransactionInstruction;
    static closeLookupTable(
        params: CloseLookupTableParams,
    ): TransactionInstruction;
}
```

### Create Lookup Table

Use the `createLookupTable` method to construct the instruction to create a lookup table. The function requires the following parameters:

-   `authority` - the account with permission to modify the lookup table
-   `payer` - the account that will pay for the transaction fees
-   `recentSlot` - a recent slot to derive lookup table's address

The function returns both the instruction to create the lookup table and the address of the lookup table.

```tsx
// Get the current slot
const slot = await connection.getSlot();

// Create a transaction instruction for creating a lookup table
// and retrieve the address of the new lookup table
const [lookupTableInst, lookupTableAddress] =
    web3.AddressLookupTableProgram.createLookupTable({
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        recentSlot: slot - 1, // The recent slot to derive lookup table's address
    });
```

Under the hood, the lookup table address is a PDA derived using the `authority` and `recentSlot` as seeds.

```tsx
const [lookupTableAddress, bumpSeed] = PublicKey.findProgramAddressSync(
    [params.authority.toBuffer(), toBufferLE(BigInt(params.recentSlot), 8)],
    this.programId,
);
```

Note that using the most recent slot may result in an error when sending the transaction. To avoid this, you can use a slot that is one slot prior the most recent one (e.g. `recentSlot: slot - 1`). However, if you still encounter an error when sending the transaction, you can try resending it again.

```tsx
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
    "188115589 is not a recent slot",
    "Program AddressLookupTab1e1111111111111111111111111 failed: invalid instruction data";
```

### **Extend Lookup Table**

Use the `extendLookupTable` method to create an instruction to add addresses to an existing lookup table. It takes the following parameters:

-   `payer` - the account that will pay for the transaction fees
-   `authority` - the account that has permission to change the lookup table
-   `lookupTable` - the address of the lookup table to be extended
-   `addresses` - the addresses to add to the lookup table

The function returns an instruction to extend the lookup table.

```tsx
const addresses = [
    new web3.PublicKey("31Jy3nFeb5hKVdB4GS4Y7MhU7zhNMFxwF7RGVhPc1TzR"),
    new web3.PublicKey("HKSeapcvwJ7ri6mf3HwBtspLFTDKqaJrMsozdfXfg5y2"),
    // add more addresses
];

// Create a transaction instruction to extend a lookup table with the provided addresses
const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
    payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
    lookupTable: lookupTableAddress, // The address of the lookup table to extend
    addresses: addresses, // The addresses to add to the lookup table
});
```

Note that when extending a lookup table, the number of addresses that can be added in one instruction is limited by the transaction size limit, which is 1232 bytes. Therefore, if you need to add a large number of addresses to a lookup table, it will require multiple transactions. Each lookup table can store a maximum of 256 addresses.

### Send Transaction

After creating the instructions, you can add them to a transaction and sent to the network.

```tsx
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

Note that when new addresses are added to a lookup table, they need to "warm up" for one slot before they can be used in lookups in transactions. As a result, lookup tables can only be used to access addresses added before the current block slot.

```tsx
SendTransactionError: failed to send transaction: invalid transaction: Transaction address table lookup uses an invalid index
```

If you are unable to access addresses in a lookup table immediately after extending it, it could be due to the "warm up" slot. To avoid this issue, add a delay after extending the lookup table before sending a transaction using it.

### Deactivate Lookup Table

When an Address Lookup Table (LUT) is no longer needed, it can be deactivated and closed to reclaim its rent balance. Address lookup tables can be deactivated at any time, but they can continue to be used by transactions until the deactivation slot is no longer present in the slot hashes sysvar. This cool-down period ensures that in-flight transactions cannot be censored and that LUTs cannot be closed and recreated for the same slot.

To deactivate a LUT, use the `deactivateLookupTable` method and pass in the following parameters:

-   `lookupTable` - the address of the LUT to be deactivated
-   `authority` - the account with permission to deactivate the LUT

```tsx
const deactivateInstruction =
    web3.AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress,
        authority: user.publicKey,
    });
```

### Close Lookup Table

The `closeLookupTable` method can be used to create an instruction to close a deactivated Lookup Table (LUT) and reclaim its rent balance. It takes the following parameters:

-   `lookupTable` - the address of the LUT to be closed
-   `authority` - the account with permission to close the LUT
-   `recipient` - the account that will receive the reclaimed rent balance

```tsx
const closeInstruction = web3.AddressLookupTableProgram.closeLookupTable({
    lookupTable: lookupTableAddress,
    authority: user.publicKey,
    recipient: user.publicKey,
});
```

Attempting to close a Lookup Table before it has been fully deactivated will result in an error.

```tsx
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
    "Table cannot be closed until it's fully deactivated in 513 blocks",
    "Program AddressLookupTab1e1111111111111111111111111 failed: invalid program argument";
```

### Freeze **Lookup Table**

A Lookup Table (LUT) can also be frozen which makes the LUT immutable, meaning it can no longer be extended, deactivated, or closed.

The `freezeLookupTable` method can be used to create an instruction to freeze a Lookup Table (LUT). It takes the following parameters:

-   `lookupTable` - the address of the LUT to be frozen
-   `authority` - the account with permission to freeze the LUT

```tsx
const freezeInstruction = web3.AddressLookupTableProgram.freezeLookupTable({
    lookupTable: lookupTableAddress, // The address of the lookup table to close
    authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
});
```

Once a LUT is frozen, any further attempts to modify it will result in an error.

```tsx
"Program AddressLookupTab1e1111111111111111111111111 invoke [1]",
    "Lookup table is frozen",
    "Program AddressLookupTab1e1111111111111111111111111 failed: Account is immutable";
```

### Using LUT in Versioned Transaction

To use a lookup table (LUT) in a versioned transaction, you need to retrieve the lookup table account using its address.

```tsx
const lookupTableAccount = (
    await connection.getAddressLookupTable(lookupTableAddress)
).value;
```

You can then create a list of instructions to include in an transaction as usual. When creating the `TransactionMessage`, include any lookup table accounts used by passing them as an array to the `compileToV0Message()` method. You can provide multiple lookup table accounts.

```tsx
const message = new web3.TransactionMessage({
    payerKey: payer.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
    recentBlockhash: blockhash, // The blockhash of the most recent block
    instructions: instructions, // The instructions to include in the transaction
}).compileToV0Message([lookupTableAccount]);

// Create the versioned transaction using the message
const transaction = new web3.VersionedTransaction(message);

// Sign the transaction
transaction.sign([payer]);

// Send the signed transaction to the network
const transactionSignature = await connection.sendTransaction(transaction);
```

# Demo

This demo will guide you through the steps of creating and extending a lookup table, and then using the lookup table in a versioned transaction.

### 1. Setup

To begin, you can use `npx create-solana-client [name] --initialize-keypair` command in the command line to clone the starter template from the repository. Alternatively, you can manually clone the `with-keypair-env` branch of the template [here](https://github.com/Unboxed-Software/solana-npx-client-template/tree/with-keypair-env).

You can find the following starter code in the `index.ts` file:

```tsx
import { initializeKeypair } from "./initializeKeypair";
import * as web3 from "@solana/web3.js";

async function main() {
    // Connect to the devnet cluster
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

    // Initialize the user's keypair
    const user = await initializeKeypair(connection);
    console.log("PublicKey:", user.publicKey.toBase58());
}
```

To install the required dependencies, use the command `npm install` in the terminal. Then, execute the code by running `npm start`. This will create a new keypair, write it to the `.env` file, and airdrop devnet SOL to the keypair.

```tsx
Current balance is 0
Airdropping 1 SOL...
New balance is 1
PublicKey: GdLEz23xEonLtbmXdoWGStMst6C9o3kBhb7nf7A1Fp6F
Finished successfully
```

### 2. `createLookupTableHelper` function

To start, we will create a function named `createLookupTableHelper`. This function takes in a user's keypair and a connection as input parameters.

The function retrieves the current slot, generates an instruction for creating a lookup table, and returns both the create instruction and the address for the newly created lookup table.

```tsx
async function createLookupTableHelper(
    user: web3.Keypair,
    connection: web3.Connection,
): Promise<[web3.TransactionInstruction, web3.PublicKey]> {
    // Get the current slot
    const slot = await connection.getSlot();

    // Create a transaction instruction for creating a lookup table
    // and retrieve the address of the new lookup table
    const [lookupTableInst, lookupTableAddress] =
        web3.AddressLookupTableProgram.createLookupTable({
            authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
            payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
            recentSlot: slot - 1, // The recent slot to derive lookup table's address
        });
    console.log("lookup table address:", lookupTableAddress.toBase58());
    return [lookupTableInst, lookupTableAddress];
}
```

Note that `recentSlot: slot - 1` is used to try and avoid an error that can occur when using the most recent slot. If you encounter this error, simply try rerunning the code.

### 3. `extendLookupTableHelper` function

Next, we will create the `extendLookupTableHelper` function. This function accepts a user's keypair, the address of an existing lookup table and an array of addresses as input parameters.

The function generates an instruction to extends the specified lookup table with the provided addresses.

```tsx
async function extendLookupTableHelper(
    user: web3.Keypair,
    lookupTableAddress: web3.PublicKey,
    addresses: web3.PublicKey[],
): Promise<web3.TransactionInstruction> {
    // Create a transaction instruction to extend a lookup table with the provided addresses
    const extendInstruction = web3.AddressLookupTableProgram.extendLookupTable({
        payer: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
        authority: user.publicKey, // The authority (i.e., the account with permission to modify the lookup table)
        lookupTable: lookupTableAddress, // The address of the lookup table to extend
        addresses: addresses, // The addresses to add to the lookup table
    });
    return extendInstruction;
}
```

### 4. `sendV0TransactionHelper` function

Now that we have created functions to create and extend lookup tables, let’s create a `sendV0TransactionHelper` function, which we’ll use to build and send versioned transactions.

This function takes in a connection, a user's keypair, an array of transaction instructions, and an optional array of lookup table accounts as inputs.

The function then performs the following tasks:

-   Retrieves the latest blockhash and last valid block height from the Solana network
-   Creates a new transaction message using the provided instructions
-   Signs the transaction using the user's keypair
-   Sends the transaction to the Solana network
-   Confirms the transaction
-   Logs the transaction URL on the Solana Explorer

```tsx
async function sendV0TransactionHelper(
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

### 5. `checkForNewBlock` helper function

Next, let's create a `checkForNewBlock` helper function that we'll use to wait for lookup tables to activate between sending transactions.

This function takes in a connection and a target block height as inputs. It then starts an interval that checks the current block height of the network every 1000ms. Once the new block height exceeds the target height, the interval is cleared and the promise is resolved.

```tsx
function checkForNewBlock(connection: web3.Connection, targetHeight: number) {
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

### 6. Create and extend address lookup table

In this step, let’s update the `main()` function to create and extend a lookup table using the helper functions defined earlier.

The updated `main()` function will:

-   Generate an array of 30 addresses using the `web3.Keypair.generate()` method.
-   Use the `createLookupTableHelper` function to generate an instruction to create a new lookup table and retrieve the address of the new lookup table
-   Use the `extendLookupTableHelper` function to generate an extend instruction to add the addresses to the lookup table
-   Use the `sendV0TransactionHelper` function to send a transaction containing the create lookup table and extend instructions
-   Wait for the lookup table to activate by checking for a new block using the `checkForNewBlock` helper function
-   Generate another array of 27 addresses
-   Use the `extendLookupTableHelper` function to generate another extend instruction to add the addresses to the lookup table
-   Use the `sendV0TransactionHelper` function again to send another transaction with the new extend instruction.

```tsx
async function main() {
	...

  // Generate 30 addresses
  const addresses = []
  for (let i = 0; i < 30; i++) {
    addresses.push(web3.Keypair.generate().publicKey)
  }

  // Create an instruction to creating a lookup table and the address of the lookup table
  const [lookupTableInst, lookupTableAddress] = await createLookupTableHelper(
    user,
    connection
  )

  // Create an "extend" instruction to add the addresses to the lookup table
  const extendInstruction = await extendLookupTableHelper(
    user,
    lookupTableAddress,
    addresses
  )

  // Send the transaction with the create lookup table and extend instructions
  await sendV0TransactionHelper(connection, user, [
    lookupTableInst,
    extendInstruction,
  ])

  // Wait for lookup table to activate
  await checkForNewBlock(connection, 1)

  // Generate 27 addresses
  const moreAddresses = []
  for (let i = 0; i < 27; i++) {
    moreAddresses.push(web3.Keypair.generate().publicKey)
  }

  // Create an "extend" instruction to add the addresses to the lookup table
  const anotherExtendInstruction = await extendLookupTableHelper(
    user,
    lookupTableAddress,
    moreAddresses
  )

  // Send the transaction with the create lookup table and extend instructions
  await sendV0TransactionHelper(connection, user, [anotherExtendInstruction])
}
```

### 7. `getAddressLookupTableHelper` function

Next, let’s create a `getAddressLookupTableHelper` function. This function is used to fetch a lookup table account using a provided lookup table address.

```tsx
async function getAddressLookupTableHelper(
    connection: web3.Connection,
    lookupTableAddress: web3.PublicKey,
): Promise<web3.AddressLookupTableAccount> {
    const lookupTableAccount = (
        await connection.getAddressLookupTable(lookupTableAddress)
    ).value;

    // Return the lookup table account if it is successfully fetched
    if (lookupTableAccount === null) {
        throw new Error("lookupTableAccount not found");
    } else {
        return lookupTableAccount;
    }
}
```

### 8. `createTransferInstructionsHelper` function

Next, let’s create a `createTransferInstructionsHelper` function that can be used to create transfer instructions for all the addresses in a lookup table.

The function takes in a connection, a lookup table account, and a user keypair as inputs and returns an array of transfer instructions.

```tsx
async function createTransferInstructionsHelper(
    connection: web3.Connection,
    lookupTableAccount: web3.AddressLookupTableAccount,
    user: web3.Keypair,
) {
    // Get the addresses in the lookup table account
    const { addresses } = lookupTableAccount.state;

    // Get the minimum balance required to be exempt from rent
    const minRent = await connection.getMinimumBalanceForRentExemption(0);

    const transferInstructions = [];

    // For each address in the lookup table, create a transfer instruction
    for (const address of addresses) {
        transferInstructions.push(
            web3.SystemProgram.transfer({
                fromPubkey: user.publicKey, // The payer (i.e., the account that will pay for the transaction fees)
                toPubkey: address, // The destination account for the transfer
                lamports: minRent, // The amount of lamports to transfer
            }),
        );
    }

    return transferInstructions;
}
```

### 9. Create versioned transaction using lookup table

Next, let’s update the `main()` function to create and send a versioned transaction using a lookup table.

-   Wait for the lookup table to activate by checking for a new block using the `checkForNewBlock` helper function.
-   Retrieve the lookup table account using the `getAddressLookupTableHelper` function.
-   Create transfer instructions for each address in the lookup table using the `createTransferInstructionsHelper` function.
-   Send a transaction with the transfer instructions and the lookup table account using the `sendV0TransactionHelper` function.

```tsx
async function main() {
  ...
	// Wait for lookup table to activate
  await checkForNewBlock(connection, 1)

  // Get the lookup table account
  const lookupTableAccount = await getAddressLookupTableHelper(
    connection,
    lookupTableAddress
  )

  // If the lookup table account exists, create transfer instructions and send a transaction
  // Create transfer instructions for each address in the lookup table
  const transferInstructions = await createTransferInstructionsHelper(
    connection,
    lookupTableAccount,
    user
  )

  // Send a transaction with the transfer instructions and the lookup table account
  await sendV0TransactionHelper(connection, user, transferInstructions, [
    lookupTableAccount,
  ])
}
```

Run `npm start` in the command line to execute the `main` function. You should see output similar to the following:

```bash
Current balance is 1.50983696
PublicKey: 7btGy6hSdNZX8V7dQ5Rd2JbBQbNz3eCu7XbwUUfz2Uzp
lookup table address: 8649Rwtm7t4yfRAycvDbByYgXcF2W9mTsKye4JwTf77x
https://explorer.solana.com/tx/3oZWULMW8c17ck9rvd4LTG41RqxbLs7KY5cYSCsBiTRhvkrrUWAqQHVzpgW1LGBDi97LJK3bcGHo4ZM17oFjp6cv?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/65CYrGvZojrVGFUs1u3DL682T2BNUF9YH41QGSqoPVDZjhrGEuRbYmZ4Aa3ES5NBYkpmkDAHfc265Dp8QiwAwKm8?cluster=devnet
Waiting for 1 new blocks
https://explorer.solana.com/tx/2PNW7Tzvc2kW3r3V5FWeK5YsB5havgvbUm8D9WeXFuSEHvSX45jb7ytezQ8BtayNNDMdvrETd3qjv27E3ov8CysL?cluster=devnet
Finished successfully
```

Feel free to inspect Solana explorer by visiting the URL provided in the output.

Congratulations you now know how to work with lookup tables and versioned transactions. If you want to take a look at the final solution code you can find it on the solution branch [here](https://github.com/Unboxed-Software/versioned-transaction/tree/solution).

# Challenge

As a challenge, try building instructions for deactivating and closing the lookup table, and try freezing the lookup table. Remember that you need to wait for a lookup table to finish deactivating before closing. Also, if a lookup table is frozen, it cannot be modified (deactivated or closed) so you will have to test separately or use separate lookup tables.

1. Create a function for deactivating the lookup table.
2. Create a function for closing the lookup table
3. Create a function for freezing the lookup table
4. Test the functions by calling them in the `main()` function

You can reuse the functions we created in the demo for sending the transaction and waiting for the lookup table to activate/deactivate. Feel free to reference this [solution code](https://github.com/Unboxed-Software/versioned-transaction/tree/challenge).

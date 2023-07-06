---
title: Write Data To The Solana Network
objectives:
- Explain keypair
- Use `@solana/web3.js` to generate a keypair
- Use `@solana/web3.js` to create a keypair using a secret key
- Explain transactions
- Explain transaction fees
- Use `@solana/web3.js` to send sol
- Use `@solana/web3.js` to sign transactions
- Use Solana explorer to view transactions
---

# TL;DR

- **Keypair** refers to a pairing of public and secret keys. The public key is used as an “address” that points to an account on the Solana network. The secret key is used to verify identity or authority. As the name suggests, you should always keep secret keys *private*. `@solana/web3.js` provides helper functions for creating a brand new keypair, or for constructing a keypair using an existing secret key.
- **Transactions** are effectively a bundle of instructions that invoke Solana programs. The result of each transaction depends on the program being called. All modifications to on-chain data happen through transactions. Example:
    ```tsx
    const transaction = new Transaction()

    const sendSolInstruction = SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports: LAMPORTS_PER_SOL * amount
    })

    transaction.add(sendSolInstruction)

    const signature = sendAndConfirmTransaction(
        connection,
        transaction,
        [senderKeypair]
    )
    ```

# Overview

## Keypair

As the name suggests, a keypair is a pair of keys: a public key and a secret key.

- The public key is used as an “address” that points to an account on the Solana network.
- The secret key is used to verify identity or authority. As the name suggests, you should always keep secret keys *private*.

A keypair is *required* for the vast majority of interactions within the Solana network. If you don’t already have a keypair, or if you want to generate a new one for a specific purpose, `@solana/web3.js` provides a helper function for creating a brand new keypair.

```tsx
const ownerKeypair = Keypair.generate()
```

A keypair is of the data type `Keypair` and can be deconstructed into a public key:

```tsx
const publicKey = ownerKeypair.publicKey
```

... or the secret key:

```tsx
const secretKey = ownerKeypair.secretKey
```

If you already have a keypair you’d like to use, you can create a `Keypair` from the secret key using the `Keypair.fromSecretKey()` function. To ensure that your secret key stays secure, we recommend injecting it through an environment variable and not committing your `.env` file.

```tsx
const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
const secretKey = Uint8Array.from(secret)
const keypairFromSecretKey = Keypair.fromSecretKey(secretKey)
```

## Transactions

Any modification to on-chain data happens through transactions sent to programs.

Transaction instructions contain:

- an identifier of the program you intend to invoke
- an array of accounts that will be read from and/or written to
- data structured as a byte array that is specified to the program being invoked

When you send a transaction to a Solana cluster, a Solana program is invoked with the instructions included in the transaction.

As you might expect, `@solana/web3.js` provides helper functions for creating transactions and instructions. You can create a new transaction with the constructor, `new Transaction()`. Once created, then you can add instructions to the transaction with the `add()` method.

Instructions can get complicated when working with custom programs. Fortunately, `@solana/web3.js` has convenience functions for some of Solana’s native programs and basic operations, like transferring SOL:

```tsx
const transaction = new Transaction()

const sendSolInstruction = SystemProgram.transfer({
    fromPubkey: sender,
    toPubkey: recipient,
    lamports: LAMPORTS_PER_SOL * amount
})

transaction.add(sendSolInstruction)
```

The `SystemProgram.transfer()` function requires that you pass as parameters:

- a public key corresponding to the sender account
- a public key corresponding to the recipient account
- the amount of SOL to send in lamports.

This function then returns the instruction for sending SOL from the sender to the recipient, after which the instruction can be added to the transaction.

Once created, a transaction needs to be sent to the cluster and confirmed:

```tsx
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
    programDataAccount: web3.PublicKey
) {
    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: programDataAccount,
                isSigner: false,
                isWritable: true
            },
        ],
        programId
    })

    const signature = await web3.sendAndConfirmTransaction(
        connection,
        new web3.Transaction().add(instruction),
        [payer]
    )

    console.log(signature)
}
```

### Transaction Fees

Transaction fees are built into the Solana economy as compensation to the validator network for the CPU and GPU resources required in processing transactions. Unlike many networks that have a fee market where users can pay higher fees to increase their chances of being included in the next block, Solana transaction fees are deterministic.

The first signer included in the array of signers on a transaction is responsible for paying the transaction fee. If this signer does not have enough SOL in their account to cover the transaction fee the transaction will be dropped.

When testing, whether locally or on devnet, you can use the Solana CLI command `solana airdrop 1` to get free test SOL in your account for paying transaction fees.

### Solana Explorer

![Screenshot of Solana Explorer set to Devnet](../assets/solana-explorer-devnet.png)

All transactions on the blockchain are publicly viewable on the [Solana Explorer](http://explorer.solana.com). For example, you could take the signature returned by `sendAndConfirmTransaction()` in the example above, search for that signature in the Solana Explorer, then see:

- when it occurred
- which block it was included in
- the transaction fee
- and more!

![Screenshot of Solana Explorer with details about a transaction](../assets/solana-explorer-transaction-overview.png)

# Demo

We’re going to create a script to ping a simple program that increments a counter each time it has been pinged. This program exists on the Solana Devnet at address `ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa`. The program stores the count data in a specific account at the address `Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod`.

### 1. Basic scaffolding

Let’s start with some basic scaffolding. You’re welcome to set up your project however feels most appropriate, but we’ll be using a simple Typescript project with a dependency on the @solana/web3.js package. If you want to use our scaffolding, you can use the following commands in the command line:

```bash
mkdir -p solana-ping-client/src && \
	cd solana-ping-client && \
	touch src/index.ts && \
	git init && touch .gitignore && \
	npm init -y && \
	npm install --save-dev typescript && \
  npm install --save-dev ts-node && \
	npx tsc --init && \
	npm install @solana/web3.js && \
	npm install dotenv && \
	touch .env
```

This will:

1. create a new directory for the project with a subdirectory `src`
2. move the command line prompt inside the project directory
3. create an `index.ts` file inside of `src`
4. initialize a git repository with a `.gitignore` file
5. create a new `npm` package
6. add a developer dependency on typescript
7. add a developer dependency on `ts-node`
8. create a `.tsconfig` file
9. install the `@solana/web3.js` dependency
10. install the `.dotenv` dependency
11. create a `.env` file

If you want to match our code exactly, replace the contents of `tsconfig.json` with the following:

```json
{
  "compilerOptions": {
    "target": "es5",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist"
  },
  "include": [ "./src/**/*" ]
}
```

Add the following to the `.gitignore`:

```
node_modules/
dist/
.env
```

And finally, add the following to the `scripts` object in `package.json`:

```json
"start": "ts-node src/index.ts"
```

### 2. Generate a new keypair

Before you can do anything, you’ll need a keypair. Let’s jump into the `index.ts` file and generate one:

```tsx
import web3 = require('@solana/web3.js')
import Dotenv from 'dotenv'
Dotenv.config()

async function main() {
    const newKeypair = web3.Keypair.generate()
    console.log(newKeypair.secretKey.toString())
}

main().then(() => {
    console.log("Finished successfully")
}).catch((error) => {
    console.error(error)
})
```

Most of this code is just boilerplate to run the file properly. The lines inside of the `main()` function generate a new keypair and log the secret key to the console.

Run `npm start` after saving this file and you should see an array of numbers printed to the console. This array represents the secret key for your new keypair. **Do not** use this keypair for Mainnet operations. **Only use this keypair for testing.**

Copy the secret key array from the console log and paste it into the `.env` file as an environment variable called, `PRIVATE_KEY`. This way we can reuse this keypair in future development instead of generating a new keypair every time we run something. It should look something like this but with different numbers:

```
PRIVATE_KEY=[56,83,31,62,66,154,33,74,106,59,111,224,176,237,89,224,10,220,28,222,128,36,138,89,30,252,100,209,206,155,154,65,98,194,97,182,98,162,107,238,61,183,163,215,44,6,10,49,218,156,5,131,125,253,247,190,181,196,0,249,40,149,119,246]
```

### 3. Initialize Keypair from secret

Now that we’ve successfully generated a keypair and copied it to the `.env` file, we can remove the code inside of the `main()` function.

We’ll return to the `main()` function soon, but for now let’s create a new function outside of `main()` called `initializeKeypair()`. Inside of this new function:

1. parse the `PRIVATE_KEY` environment variable as `number[]`
2. use it to initialize a `Uint8Array`
3. initialize and return a `Keypair` using that `Uint8Array`.

```tsx
function initializeKeypair(): web3.Keypair {
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[]
    const secretKey = Uint8Array.from(secret)
    const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey)
    return keypairFromSecretKey
}
```

### 4. Ping program

Now that we have a way of initializing our keypair, we need to establish a connection with Solana’s Devnet. In `main()`, let’s invoke `initializeKeypair()` and create a connection:

```tsx
async function main() {
    const payer = initializeKeypair()
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
}
```

Now create an async function outside of `main()` called `pingProgram()` with two parameters requiring a connection and a payer’s keypair as arguments:

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) { }
```

Inside this function, we need to:

1. create a transaction
2. create an instruction
3. add the instruction to the transaction
4. send the transaction.

Remember, the most challenging piece here is including the right information in the instruction. We know the address of the program that we are calling. We also know that the program writes data to a separate account whose address we also have. Let’s add the string versions of both of those as constants at the top of the `index.ts` file:

```tsx
const PROGRAM_ADDRESS = 'ChT1B39WKLS8qUrkLvFDXMhEJ4F1XZzwUNHUt4AU9aVa'
const PROGRAM_DATA_ADDRESS = 'Ah9K7dQ8EHaZqcAsgBW8w37yN2eAy3koFmUn4x3CJtod'
```

Now, in the `pingProgram()` function, let’s create a new transaction, then initialize a `PublicKey` for the program account, and another for the data account.

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction()

    const programId = new web3.PublicKey(PROGRAM_ADDRESS)
    const programDataPubkey = new web3.PublicKey(PROGRAM_DATA_ADDRESS)
}
```

Next, let’s create the instruction. Remember, the instruction needs to include the public key for the program and it also needs to include an array with all the accounts that will be read from or written to. In this example program, only the data account referenced above is needed.

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction()

    const programId = new web3.PublicKey(PROGRAM_ADDRESS)
    const programDataPubkey = new web3.PublicKey(PROGRAM_DATA_ADDRESS)

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: programDataPubkey,
                isSigner: false,
                isWritable: true
            },
        ],
        programId
    })
}
```

Next, let’s add the instruction to the transaction we created at the start of the function. Then, call upon `sendAndConfirmTransaction()` by passing in the connection, transaction, and payer. Finally, let’s log the result of that function call so we can look it up on the Solana Explorer.

```tsx
async function pingProgram(connection: web3.Connection, payer: web3.Keypair) {
    const transaction = new web3.Transaction()

    const programId = new web3.PublicKey(PROGRAM_ADDRESS)
    const programDataPubkey = new web3.PublicKey(PROGRAM_DATA_ADDRESS)

    const instruction = new web3.TransactionInstruction({
        keys: [
            {
                pubkey: programDataPubkey,
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

    console.log(signature)
}
```
Finally, let's invoke `pingProgram()` within `main()` using `connection` and `payer`:

```tsx
async function main() {
    const payer = initializeKeypair()
    const connection = new web3.Connection(web3.clusterApiUrl('devnet'))
    await pingProgram(connection, payer)
}
```

### 5. Airdrop

Now run the code with `npm start` and see if it works. You may end up with the following error in the console:

> Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.

If you get this error, it’s because your keypair is brand new and doesn’t have any SOL to cover the transaction fees. Let’s fix this by adding the following line in `main()` before the call to `pingProgram()`:

```tsx
await connection.requestAirdrop(payer.publicKey, web3.LAMPORTS_PER_SOL*1)
```

This will deposit 1 SOL into your account which you can use for testing. This won’t work on Mainnet where it would actually have value. But it's incredibly convenient for testing locally and on Devnet.

### 6. Check the Solana explorer

Now run the code again. It may take a moment or two, but now the code should work and you should see a long string printed to the console, like the following:

```
55S47uwMJprFMLhRSewkoUuzUs5V6BpNfRx21MpngRUQG3AswCzCSxvQmS3WEPWDJM7bhHm3bYBrqRshj672cUSG
```

Copy this confirmation signature. Open a browser and go to [https://explorer.solana.com/?cluster=devnet](https://explorer.solana.com/?cluster=devnet) (the query parameter at the end of the URL will ensure that you’ll explore transactions on Devnet instead of Mainnet). Paste the signature into the search bar at the top of Solana’s Devnet explorer and hit enter. You should see all the details about the transaction. If you scroll all the way to the bottom, then you will see `Program Logs`, which show how many times the program has been pinged including your ping.

![Screenshot of Solana Explorer with logs from calling the Ping program](../assets/solana-explorer-ping-result.png)

If you want to make it easier to look at Solana Explorer for transactions in the future, simply change your `console.log` in `pingProgram()` to the following:

```tsx
console.log(`You can view your transaction on the Solana Explorer at:\nhttps://explorer.solana.com/tx/${sig}?cluster=devnet`)
```

And just like that you’re calling programs on the Solana network and writing data to chain!

In the next few lessons you’ll learn how to

1. do this safely from the browser instead of from running a script
2. add custom data to your instructions
3. deserialize data from the chain

# Challenge

Go ahead and create a script from scratch that will allow you to transfer SOL from one account to another on Devnet. Be sure to print out the transaction signature so you can look at it on the Solana Explorer.

If you get stuck feel free to glance at the [solution code](https://github.com/Unboxed-Software/solana-send-sol-client).

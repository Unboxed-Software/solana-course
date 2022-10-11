# Anchor Program from the Client

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Use an `IDL` to interact with a Solana program from the client
- Explain an Anchor `Provider` object
- Explain an Anchor `Program` object
- Use the Anchor `MethodsBuilder` to build transactions
- Set up a frontend to invoke instructions from a Solana program built using Anchor

# TL;DR

- An `IDL` is a file representing the structure of a Solana program that Anchor generates automatically when the program is built
- An Anchor `Provider` object combines a `connection` to a cluster and a specified `wallet` to sign transactions
- An Anchor `Program` object provides a custom API to interact with a specific program by combining a program `IDL` and `Provider`.
- The Anchor `MethodsBuilder` provides a simplified format for building transactions with instructions from a `Program`.
- `@project-serum/anchor` is a TypeScript client that includes everything you’ll need to interact with Anchor programs

# Overview

Anchor simplifies the process of interacting with Solana programs from the client by providing an `IDL` that reflects the structure of a program. Using the `IDL` along with the Anchor `MethodsBuilder` provides a simplified format for building transactions.

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

In the previous lesson we used the Anchor `MethodsBuilder` to test the program. You can interact with your program through a frontend the same way as in the tests. This means once you've written your tests, you can reference them when setting up a frontend.

In this lesson we will go over how to invoke an Anchor program from the client. We’ll use `@project-serum/anchor`, a TypeScript client for Anchor programs, which includes everything we’ll need to interact with a program from the client.

## Anchor Setup

Before we can interact with a program using a frontend, we’ll need to create an Anchor `Program` object. The `Program` object provides a custom API to interact with a specific program by combining a program `IDL` and `Provider`. Note that in the tests, Anchor completes this setup by default.

To create the `Program` object, we’ll need the following:

- `IDL` - file representing the structure of a program
- `Connection` - the cluster connection
- `Wallet` - default keypair used to pay for and sign transactions
- `Provider` - encapsulates the `Connection` to a Solana cluster and a `Wallet`
- `ProgramId` - the program’s on-chain address

Next, let’s go over each item to better understand how everything ties together.

### IDL (Interface Description Language)

When an Anchor program is built, Anchor generates a JSON file called an `IDL` (Anchor also generates a Typescript version of the IDL). The `IDL` file contains the structure of the program and is used by the client to know how to interact with a specific program. It is also possible to generate an `IDL` from a native Solana program using tools like [shank](https://github.com/metaplex-foundation/shank) by Metaplex. An `IDL` file is required to interact with a program using the `@project-serum/anchor` package.

To use the `IDL` in our frontend, we’ll need to include the `IDL` file in our project and then import the file.

```tsx
import idl from "./idl.json"
```

For example, here is the `IDL` for the counter program we built in the previous lesson.

```json
{
  "version": "0.1.0",
  "name": "counter",
  "instructions": [
    {
      "name": "initialize",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": true },
        { "name": "user", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": []
    },
    {
      "name": "increment",
      "accounts": [
        { "name": "counter", "isMut": true, "isSigner": false },
        { "name": "user", "isMut": false, "isSigner": true }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "Counter",
      "type": {
        "kind": "struct",
        "fields": [{ "name": "count", "type": "u64" }]
      }
    }
  ]
}
```

Inspecting the `IDL`, we can see that this program contains two instructions (`initialize` and `increment`).

As a reminder, the `initialize` instruction requires three accounts:

1. `counter` - the new account being initialized in the instruction
2. `user` - the payer for the transaction and initialization
3. `systemProgram` - the system program is invoked to initialize a new account

And the `increment` instruction requires two accounts:

1. `counter` - an existing account to increment the count field
2. `user` - the payer from the transaction

Looking at the `IDL`, we can see that in both instructions the `user` is required as a signer because the `isSigner` flag is marked as `true`. Additionally, neither instructions require any additional instruction data since the `args` section is blank for both.

Looking further down at the `accounts` section, we can see that the program contains one account type named `Counter` with a single `count` field of type `u64`.

Although the `IDL` does not provide the details of the instruction logic, we can get a basic idea of how the on-chain program expects instructions to be constructed and see the structure of the program accounts.

### Provider

Before we can create a `Program` object using the `IDL`, we first need to create an Anchor `Provider` object.

The `Provider` object represents the encapsulation of two things:

- `Connection` - the connection to a Solana cluster (i.e. localhost, devnet, mainnet)
- `Wallet` - a specified address used to pay for and sign transactions

The `Provider` is then able to send transactions to the Solana blockchain on behalf of a `Wallet` by including the wallet’s signature to outgoing transactions. When using a frontend with a Solana wallet provider, all outgoing transactions must still be approved by the user via their wallet browser extension.

Setting up the `Wallet` and `Connection` would look something like this:

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

To set up the connection, we can use the `useConnection` hook from `@solana/wallet-adapter-react` to get the `Connection` to a Solana cluster.

Note that the `Wallet` object provided by the `useWallet` hook from `@solana/wallet-adapter-react` is not compatible with the `Wallet` object that the Anchor `Provider` expects. Luckily, `@solana/wallet-adapter-react` also provides a `useAnchorWallet` hook.

For comparison, here is the `AnchorWallet` from `useAnchorWallet`:

```tsx
export interface AnchorWallet {
  publicKey: PublicKey
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>
}
```

And the `WalletContextState` from `useWallet`:

```tsx
export interface WalletContextState {
  autoConnect: boolean
  wallets: Wallet[]
  wallet: Wallet | null
  publicKey: PublicKey | null
  connecting: boolean
  connected: boolean
  disconnecting: boolean
  select(walletName: WalletName): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendTransaction(
    transaction: Transaction,
    connection: Connection,
    options?: SendTransactionOptions
  ): Promise<TransactionSignature>
  signTransaction: SignerWalletAdapterProps["signTransaction"] | undefined
  signAllTransactions:
    | SignerWalletAdapterProps["signAllTransactions"]
    | undefined
  signMessage: MessageSignerWalletAdapterProps["signMessage"] | undefined
}
```

The `WalletContextState` provides much more functionality compared to the `AnchorWallet`, but the `AnchorWallet` is required to set up the `Provider` object.

To create the `Provider` object we use `AnchorProvider` from `@project-serum/anchor`.

The `AnchorProvider` constructor takes three parameters:

- `connection` - the `Connection` to the Solana cluster
- `wallet` - the `Wallet` object
- `opts` - optional parameter that specifies the confirmation options, using a default setting if one is not provided

Once we’ve create the `Provider` object, we then set it as the default provider using `setProvider`.

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@project-serum/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### Program

The last step is to create a `Program` object that requires three parameters:

- `IDL` - representing the structure of a program
- `programId` - the on-chain address of the program with the structure of the `IDL`
- `Provider` - establishing the `Connection` to a cluster and a `Wallet` for signing

The `Program` object creates a custom API we can use to interact with a Solana program. This API is the one stop shop for all things related to communicating with on-chain programs. Among other things, one can send transactions, fetch deserialized accounts, decode instruction data, subscribe to account changes, and listen to events. You can learn more about the `Program` class [here](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor).

To create the `Program` object, first import `Program` and `Idl` from `@project-serum/anchor`. The `Idl` type is used when working with Typescript.

```tsx
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@project-serum/anchor"
```

Next, specify the `programId` of the program. We have to explicitly state the `programId` since there can be multiple programs with the same `IDL` structure (i.e. if the same program is deployed multiple times using different addresses). When creating the `Program` object, the default `Provider` is used if one is not explicitly specified.

```tsx
const programId = new PublicKey("PROGRAM_ADDRESS")
const program = new Program(idl as Idl, programId)
```

All together, the final setup looks something like this:

```tsx
import idl from "./idl.json"
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import {
  Program,
  Idl,
  AnchorProvider,
  setProvider,
} from "@project-serum/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()

const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)

const programId = new PublicKey("PROGRAM_ADDRESS")
const program = new Program(idl as Idl, programId)
```

## Anchor `MethodsBuilder`

Once the `Program` object is set up, we can use the Anchor `MethodsBuilder` to build transactions with instructions from our program. The `MethodsBuilder` uses the `IDL` to provide a simplified format for building transactions to invoke program instructions. Note that the camel case naming convention is used when interacting with a program from the client, compared to the snake case naming convention used when the writing the program in rust.

The basic `MethodsBuilder` format looks like this:

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

The basic format includes the following:

- `program` - the program being invoked specified by the `programId` from the `Program` object
- `methods` - builder API for all APIs on the program and includes all instructions from the `IDL`
- `instructionName` - the name of the specific instruction from the `IDL` to invoke.
- `instructionDataInputs` - include any instruction data required by the instruction within the parentheses after the instruction name
- `accounts`- list of accounts required by the instruction being invoked
- `signers` - any additional signers required by the instruction
- `rpc` - creates and sends a signed transaction with the specified instruction and returns a `TransactionSignature`. When using `.rpc`, the `Wallet` from the `Provider` is automatically included as a signer and does not have to be listed explicitly stated.

Note that if no additional signers are required by the instruction other than the `Wallet` specified with the `Provider`, the `.signer([])` line can be excluded.

You can also build the transaction directly by changing `.rpc()` to `.transaction()`. This builds a `Transaction` object using the instruction specified.

```tsx
// creates transaction
const transaction = await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .transaction()

await sendTransaction(transaction, connection)
```

Similarly, you can use the same format to build an instruction using `.instruction()` and then manually add the instructions to a new transaction. This builds a `TransactionInstruction` object using the instruction specified.

```tsx
// creates first instruction
const instructionOne = await program.methods
  .instructionOneName(instructionOneDataInputs)
  .accounts({})
  .instruction()

// creates second instruction
const instructionTwo = await program.methods
  .instructionTwoName(instructionTwoDataInputs)
  .accounts({})
  .instruction()

// add both instruction to one transaction
const transaction = new Transaction().add(instructionOne, instructionTwo)

// send transaction
await sendTransaction(transaction, connection)
```

In summary, the Anchor `MethodsBuilder` provides a simplified and more flexible way to interact with on-chain programs. You can build an instruction, a transaction, or build and send a transaction using basically the same format without having to manually serialize or deserialize the accounts or instruction data.

## Send Transactions

As a refresher, we use the `sendTransaction` method from the `useWallet()` hook provided by `@solana/wallet-adapter-react` to send transactions with a wallet adapter.

The `sendTransaction` method prompts a user to approve and sign a transaction before sending.

```tsx
import { useWallet } from "@solana/wallet-adapter-react"

const { sendTransaction } = useWallet()
```

If the transaction was built using either `.instruction` or `.transaction` from the Anchor `MethodsBuilder`, you’ll need to send the transaction with `sendTransaction` to prompt a connected wallet for approval.

```tsx
sendTransaction(transaction, connection)
```

If the instruction requires additional signatures, you'll need to add them to `sendTransaction` using the following format:

```tsx
sendTransaction(transaction, connection, { signers: [] })
```

# Demo

Let’s practice this together by building a frontend for the Counter program from last lesson. As a reminder, the Counter program has two instructions:

- `initialize` - initializes a new `Counter` account and sets the `count` to `0`
- `increment` - increments the `count` on an existing `Counter` account

### 1. Download the starter code

Download the starter code for this project [here](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/starter). Once you have the starter code, take a look around. Install the dependencies with `npm install` and then run the app with `npm run dev`.

This project is a simple Next.js application. It includes the `WalletContextProvider` we created in the [Wallets lesson](https://github.com/Unboxed-Software/solana-course/blob/main/content/interact-with-wallets.md), the `idl.json` file for the Counter program, and the `Initialize` and `Increment` components we’ll be building throughout this demo. The `programId` of the program we’ll be invoking is also included in the starter code.

### 2. `Initialize`

To begin, let’s complete the set up to create the `Program` object in `Initialize.tsx` component. As a refresher, we’ll need the `Program` object in order to use the Anchor `MethodsBuilder` to invoke the instructions on our program.

Within the `Initialize.tsx` component, add the following code for the initial set up:

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
  ...

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  const provider = new anchor.AnchorProvider(connection, wallet, {})
  anchor.setProvider(provider)

  const programId = new anchor.web3.PublicKey(PROGRAM_ID)
  const program = new anchor.Program(idl as anchor.Idl, programId)

  ...
}
```

Here we are establishing the `connection` and `wallet` to set the `provider`, and then using the `programId` and `idl` to construct the `Program`.

Next, we’ll need to generate a new `Keypair` for the new `Counter` account since we are initializing an account for the first time.

Add the following to generate a new `Keypair` for the `Counter` account:

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
	...

	const newAccount = anchor.web3.Keypair.generate()

  ...
}
```

Next, let’s use the Anchor `MethodsBuilder` to build a new transaction to invoke the `initialize` instruction using `.transaction()`.

Within `onClick` add the following to build the transaction:

```tsx
const onClick = async () => {
    const transaction = await program.methods
      .initialize()
      .accounts({
        counter: newAccount.publicKey,
        user: wallet.publicKey,
        systemAccount: anchor.web3.SystemProgram.programId,
      })
      .transaction()

    ...
  }
```

Now that we have the transaction, let’s use `sendTransaction` to send the transaction. We’ll need to include the `newAccount` as a signer. When initializing an account for the first time using a `Keypair`, it must also be included as a signer.

Add `sendTransaction` within `onClick` following the transaction we’ve just built:

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {

  const { sendTransaction } = useWallet()

  ...
  const onClick = async () => {
    ...

   sendTransaction(transaction, connection, { signers: [newAccount] })
  }

...
}
```

Let’s also use the `TransactionSignature` returned by `sendTransaction` to display a link to Solana Explorer URL on the frontend. We’ll also keep track of the `newAccount` publicKey to use with the `increment` instruction that we’ll implement next.

Update `sendTransaction` with the following:

```tsx
const onClick = async () => {
    ...

    sendTransaction(transaction, connection, { signers: [newAccount] }).then(
      (sig) => {
        console.log(
          `Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`
        )
        setUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
        setCounter(newAccount.publicKey)
      }
    )
  }
```

All together the updated `Initialize.tsx` component looks like this:

```tsx
export const Initialize: FC<Props> = ({ setCounter }) => {
  const [url, setUrl] = useState("")
  const { sendTransaction } = useWallet()

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  const provider = new anchor.AnchorProvider(connection, wallet, {})
  anchor.setProvider(provider)

  const programId = new anchor.web3.PublicKey(PROGRAM_ID)
  const program = new anchor.Program(idl as anchor.Idl, programId)

  const newAccount = anchor.web3.Keypair.generate()

  const onClick = async () => {
    const transaction = await program.methods
      .initialize()
      .accounts({
        counter: newAccount.publicKey,
        user: wallet.publicKey,
        systemAccount: anchor.web3.SystemProgram.programId,
      })
      .transaction()

    sendTransaction(transaction, connection, { signers: [newAccount] }).then(
      (sig) => {
        console.log(
          `Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`
        )
        setUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
        setCounter(newAccount.publicKey)
      }
    )
  }

...
```

### 3. `Increment`

Next, let’s move on the the `Increment.tsx` component. Just as before, complete the set up to create the `Program` object.

Add the following code for the initial set up:

```tsx
export const Increment: FC<Props> = ({ counter }) => {
  ...

  const { connection } = useConnection()
  const wallet = useAnchorWallet()

  const provider = new anchor.AnchorProvider(connection, wallet, {})
  anchor.setProvider(provider)

  const programId = new anchor.web3.PublicKey(PROGRAM_ID)
  const program = new anchor.Program(idl as anchor.Idl, programId)

  ...
}
```

Next, let’s use the Anchor `MethodsBuilder` to build a new instruction to invoke the `increment` instruction. This time we will use `.instruction()` and add the instruction to a new transaction.

Within `onClick` add the following:

```tsx
const onClick = async () => {
    const transaction = new anchor.web3.Transaction()
    const instruction = await program.methods
      .increment()
      .accounts({
        counter: counter,
        user: wallet.publicKey,
      })
      .instruction()

    transaction.add(instruction)

    ...
  }
```

Just as before, let’s also use the `TransactionSignature` returned by `sendTransaction` to display the Solana Explorer URL on the frontend.

Add `sendTransaction` within `onClick` following the transaction we’ve just built:

```tsx
export const Increment: FC<Props> = ({ counter }) => {

  const { sendTransaction } = useWallet()

  ...
  const onClick = async () => {
    ...

    sendTransaction(transaction, connection).then((sig) => {
      console.log(
        `Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`
      )
      setUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    })
  }

...
}
```

All together the updated `Increment.tsx` component looks like this:

```tsx
export const Increment: FC<Props> = ({ counter }) => {
  const [url, setUrl] = useState("")

  const { connection } = useConnection()
  const { sendTransaction } = useWallet()
  const wallet = useAnchorWallet()

  const provider = new anchor.AnchorProvider(connection, wallet, {})
  anchor.setProvider(provider)

  const programId = new anchor.web3.PublicKey(PROGRAM_ID)
  const program = new anchor.Program(idl as anchor.Idl, programId)

  const onClick = async () => {
    const transaction = new anchor.web3.Transaction()
    const instruction = await program.methods
      .increment()
      .accounts({
        counter: counter,
        user: wallet.publicKey,
      })
      .instruction()

    transaction.add(instruction)

    sendTransaction(transaction, connection).then((sig) => {
      console.log(
        `Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`
      )
      setUrl(`https://explorer.solana.com/tx/${sig}?cluster=devnet`)
    })
  }

...
```

### 4. Test the frontend

You can test the frontend by running `npm run dev`.

1. Connect you wallet and you should see the `Initialize Counter` button
2. Click the `Initialize Counter` button, and then approve the transaction
3. You should then see a link to Solana Explorer for the `initialize` transaction and the `Increment Counter` button should also appear
4. Click the `Increment Counter` button, and then approve the transaction
5. You should see another link to Solana Explorer for the `increment` transaction

![Gif of Anchor Frontend Demo](../assets/anchor-frontend-demo.gif)

Feel free to click the links to inspect the program logs from each transaction!

![Screenshot of Initialize Program Log](../assets/anchor-frontend-initialize.png)

![Screenshot of Increment Program Log](../assets/anchor-frontend-increment.png)

Congratulations, you now know how to set up a frontend to invoke a Solana program using an `IDL` generated with Anchor.

If you need more time with this project to feel comfortable with these concepts, feel free to have a look at the [solution code](https://github.com/Unboxed-Software/anchor-ping-frontend) before continuing.

# Challenge

Now it’s your turn to build something independently. Building on top of what we’ve done in the demo, try to create a new component in the frontend that implements a button to decrements the counter.

Before building the component in the frontend, you’ll first need to:

1. Build and deploy a new program that implements a `decrement` instruction
2. Update the `IDL` file in the frontend with the one from your new program
3. Update the `programId` with the one from your new program

If you need some help, feel free to reference this program [here](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/challenge).

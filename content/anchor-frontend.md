# Anchor Program from the Client

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Use an IDL to interact with a Solana program from the client
- Explain an Anchor `Provider` object
- Explain an Anchor `Program` object
- Use the Anchor `MethodsBuilder` to build instructions and transactions
- Set up a frontend to invoke instructions using Anchor and an IDL

# TL;DR

- An **IDL** is a file representing the structure of a Solana program. Programs written and built using Anchor automatically generate a corresponding IDL. IDL stands for Interface Description Language.
- `@project-serum/anchor` is a Typescript client that includes everything you’ll need to interact with Anchor programs
- An **Anchor `Provider`** object combines a `connection` to a cluster and a specified `wallet` to enable transaction signing
- An **Anchor `Program`** object provides a custom API to interact with a specific program. You create a `Program` instance using a program's IDL and `Provider`.
- The **Anchor `MethodsBuilder`** provides a simple interface through `Program` for building instructions and transactions

# Overview

Anchor simplifies the process of interacting with Solana programs from the client by providing an Interface Description Language (IDL) file that reflects the structure of a program. Using the IDL in conjunction with Anchor's Typescript library (`@project-serum/anchor`) provides a simplified format for building instructions and transactions.

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

This works from any Typescript client, whether it's a frontend or integration tests. In this lesson we'll go over how to use `@project-serum/anchor` to simplify your client-side program interaction.

## Anchor client-side structure

Let's start by going over the basic structure of Anchor's Typescript library. The primary object you'll be using is the `Program` object. A `Program` instance represents a specific Solana program and provides a custom API for reading and writing to the program.

To create an instance of `Program`, you'll need the following:

- IDL - file representing the structure of a program
- `Connection` - the cluster connection
- `Wallet` - default keypair used to pay for and sign transactions
- `Provider` - encapsulates the `Connection` to a Solana cluster and a `Wallet`
- `ProgramId` - the program’s on-chain address

![Anchor structure](../assets/anchor-client-structure.png)

The above image shows how each of these pieces are combined to create a `Program` instance. We'll go over each of them individually to get a better idea of how everything ties together.

### Interface Description Language (IDL)

When you build an Anchor program, Anchor generates both a JSON and Typescript file representing your program's IDL. The IDL represents the structure of the program and can be used by a client to infer how to interact with a specific program.

While it isn't automatic, you can also generate an IDL from a native Solana program using tools like [shank](https://github.com/metaplex-foundation/shank) by Metaplex. 

To get an idea of the information an IDL provides, here is the IDL for the counter program you built previously:

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

Inspecting the IDL, you can see that this program contains two instructions (`initialize` and `increment`).

Notice that in addition to specifying the instructions, it species the accounts and inputs for each instruction. The `initialize` instruction requires three accounts:

1. `counter` - the new account being initialized in the instruction
2. `user` - the payer for the transaction and initialization
3. `systemProgram` - the system program is invoked to initialize a new account

And the `increment` instruction requires two accounts:

1. `counter` - an existing account to increment the count field
2. `user` - the payer from the transaction

Looking at the IDL, you can see that in both instructions the `user` is required as a signer because the `isSigner` flag is marked as `true`. Additionally, neither instructions require any additional instruction data since the `args` section is blank for both.

Looking further down at the `accounts` section, you can see that the program contains one account type named `Counter` with a single `count` field of type `u64`.

Although the IDL does not provide the implementation details for each instruction, we can get a basic idea of how the on-chain program expects instructions to be constructed and see the structure of the program accounts.

Regardless of how you get it, you *need* an IDL file to interact with a program using the `@project-serum/anchor` package. To use the IDL, you'll need to include the IDL file in your project and then import the file.

```tsx
import idl from "./idl.json"
```

### Provider

Before you can create a `Program` object using the IDL, you first need to create an Anchor `Provider` object.

The `Provider` object combines two things:

- `Connection` - the connection to a Solana cluster (i.e. localhost, devnet, mainnet)
- `Wallet` - a specified address used to pay for and sign transactions

The `Provider` is then able to send transactions to the Solana blockchain on behalf of a `Wallet` by including the wallet’s signature to outgoing transactions. When using a frontend with a Solana wallet provider, all outgoing transactions must still be approved by the user via their wallet browser extension.

Setting up the `Wallet` and `Connection` would look something like this:

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"

const { connection } = useConnection()
const wallet = useAnchorWallet()
```

To set up the connection, you can use the `useConnection` hook from `@solana/wallet-adapter-react` to get the `Connection` to a Solana cluster.

Note that the `Wallet` object provided by the `useWallet` hook from `@solana/wallet-adapter-react` is not compatible with the `Wallet` object that the Anchor `Provider` expects. However, `@solana/wallet-adapter-react` also provides a `useAnchorWallet` hook.

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

To create the `Provider` object you use `AnchorProvider` from `@project-serum/anchor`.

The `AnchorProvider` constructor takes three parameters:

- `connection` - the `Connection` to the Solana cluster
- `wallet` - the `Wallet` object
- `opts` - optional parameter that specifies the confirmation options, using a default setting if one is not provided

Once you’ve create the `Provider` object, you then set it as the default provider using `setProvider`.

```tsx
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react"
import { AnchorProvider, setProvider } from "@project-serum/anchor"

const { connection } = useConnection()
const wallet = useAnchorWallet()
const provider = new AnchorProvider(connection, wallet, {})
setProvider(provider)
```

### Program

Once you have the IDL and a provider, you can create an instance of `Program`. The constructor requires three parameters:

- `idl` - the IDL as type `Idl`
- `programId` - the on-chain address of the program as a `string` or `PublicKey`
- `Provider` - the provider discussed in the previous section

The `Program` object creates a custom API you can use to interact with a Solana program. This API is the one stop shop for all things related to communicating with on-chain programs. Among other things, you can send transactions, fetch deserialized accounts, decode instruction data, subscribe to account changes, and listen to events. You can learn more about the `Program` class [here](https://coral-xyz.github.io/anchor/ts/classes/Program.html#constructor).

To create the `Program` object, first import `Program` and `Idl` from `@project-serum/anchor`. `Idl` is a type you can used when working with Typescript.

Next, specify the `programId` of the program. We have to explicitly state the `programId` since there can be multiple programs with the same IDL structure (i.e. if the same program is deployed multiple times using different addresses). When creating the `Program` object, the default `Provider` is used if one is not explicitly specified.

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

const programId = new PublicKey("JPLockxtkngHkaQT5AuRYow3HyUv5qWzmhwsCPd653n")
const program = new Program(idl as Idl, programId)
```

## Anchor `MethodsBuilder`

Once the `Program` object is set up, you can use the Anchor Methods Builder to build instructions and transactions related to the program. The `MethodsBuilder` uses the IDL to provide a simplified format for building transactions that invoke program instructions.

Note that the camel case naming convention is used when interacting with a program from the client, compared to the snake case naming convention used when the writing the program in rust.

The basic `MethodsBuilder` format looks like this:

```tsx
// sends transaction
await program.methods
  .instructionName(instructionDataInputs)
  .accounts({})
  .signers([])
  .rpc()
```

Going step by step, you:

1. Call `methods` on `program` - this is the builder API for creating instruction calls related to the program's IDL
2. Call the instruction name as `.instructionName(instructionDataInputs)` - simply call the instruction using dot syntax and the instruction's name, passing in any instruction arguments as comma-separated values
3. Call `accounts` - using dot syntax, call `.accounts`, passing in an object with each account the instruction expects based on the IDL
4. Optionally call `signers` - using dot syntax, call `.signers`, passing in an array of additional signers required by the instruction
5. Call `rpc` - this method creates and sends a signed transaction with the specified instruction and returns a `TransactionSignature`. When using `.rpc`, the `Wallet` from the `Provider` is automatically included as a signer and does not have to be listed explicitly.

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

Congratulations, you now know how to set up a frontend to invoke a Solana program using an IDL generated with Anchor.

If you need more time with this project to feel comfortable with these concepts, feel free to have a look at the [solution code](https://github.com/Unboxed-Software/anchor-ping-frontend) before continuing.

# Challenge

Now it’s your turn to build something independently. Building on top of what we’ve done in the demo, try to create a new component in the frontend that implements a button to decrements the counter.

Before building the component in the frontend, you’ll first need to:

1. Build and deploy a new program that implements a `decrement` instruction
2. Update the IDL file in the frontend with the one from your new program
3. Update the `programId` with the one from your new program

If you need some help, feel free to reference this program [here](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-ping-frontend/tree/challenge).

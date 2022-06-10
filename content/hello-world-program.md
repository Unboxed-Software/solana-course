# Hello World

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Explain the entry point to a Solana program
- Build and deploy a basic Solana program
- Submit a transaction to invoke our “Hello, world!” program

# TL;DR

- **Programs** on Solana are a particular type of account that stores and executes instruction logic
- Solana programs have a single **entry point** to process instructions
- A program processes an instruction using the **program_id**, list of **accounts**, and **instruction_data** included with the instruction 

# Overview

Solana's ability to run arbitrary executable code is part of what makes it so powerful. Solana programs, similar to "smart contracts" in other blockchain environments, are quite literally the backbone of the Solana ecosystem. And the collection of programs grows daily as developers and creators dream up and deploy new programs.

This lesson will give you a basic introduction to writing a deploying a Solana program using the Rust programming language. To avoid the distraction of setting up a local development environment, we'll be using a browser-based IDE called Solana Playground.

## Solana Programs

Recall that all data stored on the Solana network are contained in what are referred to as accounts. Each account has its own unique address which is used to identify and access the account data. Solana programs are just a particular type of Solana account that store and execute instructions.

To write Solana programs with Rust, we use the [solana_program](https://docs.rs/solana-program/latest/solana_program/index.html) library crate. Crates in Rust define functionality that can be shared with multiple projects. The `solana_program` crate acts as a standard library for Solana programs. This standard library contains the modules and macros that we'll use to develop our Solana programs. You can read more about Rust crates [here](https://doc.rust-lang.org/book/ch07-01-packages-and-crates.html).

### Pathways and scope

To tell Rust where to find an item in a module tree, we use a path just like when we're navigating a filesystem. If we want to call a particular function within a module, then we need to know the pathway to it.

To "use" a module available within the `solana_program` crate we'll need to know:

1. How to invoke the module by its path
2. How bring it into the scope of our program.

Paths are brought into scope with the [use](https://doc.rust-lang.org/stable/book/ch07-04-bringing-paths-into-scope-with-the-use-keyword.html) keyword. In the example below, we bring into scope the [AccountInfo](https://docs.rs/solana-program/latest/solana_program/account_info/struct.AccountInfo.html) struct from the `account_info` module within the `solana_program` crate.

```rust
use solana_program::account_info::AccountInfo
```

You can read more about Rust modules [here](https://doc.rust-lang.org/book/ch07-02-defining-modules-to-control-scope-and-privacy.html).

For a basic program we will need to use all of the following `solana_program` paths:

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

- `AccountInfo` - a struct within the `account_info` module that allows us to access account information
- `entrypoint` - a macro that declares the entry point of the program
- `ProgramResult` - a type within the `entrypoint` module that returns either a `Result` or `ProgramError`
- `Pubkey` - a struct within the `pubkey` module that allows us to access addresses as a public key
- `msg` - a macro allows us to print messages to the program log

### Entry points

Solana programs require a single entry point to process program instructions. The entry point is declared using the [entrypoint!](https://docs.rs/solana-program/latest/solana_program/macro.entrypoint.html) macro. You can read more about Rust macros [here](https://doc.rust-lang.org/book/ch19-06-macros.html).

The entry point to a Solana program requires a `process_instruction` function with the following arguments:

- `program_id` - the address of the account where the program is stored
- `accounts` - the list of accounts required to process the instruction
- `instruction_data` - the serialized, instruction-specific data

```rust
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult;
```

Recall that Solana program accounts only store the logic for processing instructions. Program accounts are "read-only" accounts. This means that programs are “stateless”. The “state” (the set of data) that a program requires in order to process an instruction is stored in data accounts (separate from the program account).

In order to process an instruction, the data accounts that an instruction requires must be explicitly passed into the program through the `accounts` argument. Any additional inputs must be passed in through the `instruction_data` argument.



...and there you have it - you now know all the things you need for the foundations of creating a Solana program using Rust. Let’s practice what we’ve learned so far!

# Demo

We're going to build a "Hello, World!" program using Solana Playground. Solana Playground is a tool that allows you to write and deploy Solana programs from the browser. Click [here](https://beta.solpg.io/) to open Solana Playground. Next, go ahead and delete everything in the default `lib.rs` file and create a Playground wallet.

![Gif Solana Playground Create Wallet](../assets/hello-world-create-wallet.gif)

First, let's bring into scope everything we’ll need from the `solana_program` crate.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

Next, let's set up the entry point to our program using the `entrypoint!` macro and create the `process_instruction` function. The `msg!` macro then allows us to print “Hello, world!” to the program log when the program is invoked.

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

All together, the “Hello, world!” program will look like this:

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, world!");

    Ok(())
}
```

Now let's build and deploy our program using Solana Playground.

![Gif Solana Playground Build and Deploy](../assets/hello-world-build-deploy.gif)

Finally, let's invoke our program from the client side. Download the code [here](https://github.com/ZYJLiu/solana-hello-world-client).

The focus of this lesson is to build our Solana program, so we’ve gone ahead and provided the client code to invoke our  “Hello, world!” program. The code provided includes a `sayHello` helper function that builds and submits our transaction. We then call `sayHello` in the main function and print a Solana Explorer URL to view our transaction details in the browser.

Open the `index.ts` file you should see a variable named `programId`. Go ahead and update this with the program Id of the “Hello, world!" program you just deployed using Solana Playground.

```tsx
let programId = new web3.PublicKey("<YOUR_PROGRAM_ID>");
```
You can locate the program Id on Solana Playground referencing the image below.

![Gif Solana Playground Program Id](../assets/hello-world-program-id.gif)

Next, install the Node modules with `npm i`. Once those have been installed, we'll need create an `.env` file at the top-level of the client program folder. Add a `PRIVATE_KEY` variable to this file. You can use the Playground wallet you just created.

Now, go ahead and run `npm start`. This command will output a transaction URL to view on Solana Explorer.

Copy the transaction URL printed in the console into your browser. Scroll down to see “Hello, world!” under Program Instruction Logs.

![Screenshot Solana Explorer Program Log](../assets/hello-world-program-log.png)

Congratulations, you’ve just successfully built and deployed a Solana program!

# Challenge

Now it’s your turn to build something independently. Because we're starting with very simple programs, yours will look almost identical to what we just created. It's useful to try and get to the point where you can write it from scratch without referencing prior code, so try not to copy and paste here.

1. Write a new program that uses the `msg!` macro to print your own message to the program log.
2. Build and deploy your program like we did in the demo.
3. Invoke your newly deployed program and use Solana Explorer to check that your message was printed in the program log.

As always, get creative with these challenges and take them beyond the basic instructions if you want - and have fun!

# Local Setup

# Lesson Objectives

- Use basic Solana CLI commands
- Set up a local environment for Solana program development
- Use Rust and Solana CLI to deploy a Solana program from your local environment

# TL;DR

- To get started with Solana locally, you’ll first need to install Rust and the Solana CLI
- Once you have Rust and Solana CLI installed, you’ll be able to build and deploy your programs locally using the `cargo build-bpf` and `solana program deploy` commands.

# Overview

This lesson will be slightly different from the others. Instead of covering a lot of ground on how to write a program or interact with the network, this lesson will primarily focus on the admittedly tedious task of setting up your local development environment.

We'll start by going over the steps for installing the Rust compile and the Solana CLI in both Windows and macOS. If you have a Windows machine, by all means skip the macOS section and vice versa.

The Solana CLI is a command-line interface tool for interacting with a Solana cluster and provides a collection of different commands for each action you might want to take. Once you've installed Rust and the Solana CLI, we'll walk through some of the most important Solana CLI commands.

## Setup on Windows (with Linux)

### Download Windows Subsystem for Linux (WSL)

If you are on a windows computer, it is recommended to use Windows Subsystem for Linux (WSL) to build your Solana Programs.

Open an **administrator** PowerShell or Windows Command Prompt and check windows version

```bash
winver
```

If you are on Windows 10 version 2004 and higher (Build 19041 and higher) or Windows 11, run the following command.

```bash
wsl --install
```

If you are running an older version of windows, follow the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install-manual).

You can read more about installing WSL [here](https://docs.microsoft.com/en-us/windows/wsl/install).

### Download Ubuntu

Next, download Ubuntu [here](https://apps.microsoft.com/store/detail/ubuntu-2004/9N6SVWS3RX71?hl=en-us&gl=US). Ubuntu provides a terminal that allows you to run Linux on a Windows computer. This is where you’ll be running Solana CLI commands.

### Download Rust (for WSL)

Next, open an Ubuntu terminal and download Rust for WSL using the following command. You can read more about downloading Rust [here](https://www.rust-lang.org/learn/get-started).

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Download Solana CLI

Now we are ready to download Solana CLI for Linux. Go ahead and run the following command in an Ubuntu terminal. You can read more about downloading Solana CLI [here](https://docs.solana.com/cli/install-solana-cli-tools).

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.24/install)"
```

## Solana CLI Basics

You can view the list of all possible Solana CLI commands by running:

```bash
solana --help
```

The Solana CLI stores a number of configuration settings that impact the behavior of certain commands. You can use the following command to view the current configuration:

```bash
solana config get
```

The `solana config get` command will return the following:

- `Config File` - the file Solana CLI is located on your computer
- `RPC URL` - endpoint you are using, connecting you to localhost, devnet, or mainnet
- `WebSocket URL` - the websocket to listen for events from the cluster you are targeting (computed when you set the `RPC URL`)
- `Keypair Path` - the keypair path used when running Solana CLI subcommands
- `Commitment` - provides a measure of the network confirmation and describes how finalized a block is at that point in time

You can change your Solana CLI config by using the `solana config set` command followed by the setting you want to update.

The most common change will be to the cluster you are targeting. Use the `solana config set --url` command to change the `RPC URL`.

```bash
solana config set --url localhost
```

```bash
solana config set --url devnet
```

```bash
solana config set --url mainnet-beta
```

Similarly, use the `solana config set --keypair` command to change the `Keypair Path`. Solana CLI will then use the keypair from the specified path when running commands.

```bash
solana config set --keypair ~/<FILE_PATH>
```

You can generate a new keypair using the `solana-keygen new --outfile` command followed by the file path to store the keypair.

```bash
solana-keygen new --outfile ~/<FILE_PATH>
```

To view the `publickey` of the current keypair set in `solana config`, use the `solana address` command.

```bash
solana address
```

To view the SOL balance of the current keypair set in `solana config`, use the `solana balance` command.

```bash
solana balance
```

To airdrop SOL on devnet or localhost, use the `solana airdrop <AMOUNT>` command. Note that while on devnet you are limited to 2 SOL per airdrop.

```bash
solana airdrop 2
```

## Solana Program from Local Environment

While the Solana Playground is enormously helpful, it's hard to beat the flexibility of your own local development environment. As you build more complex programs that are potentially integrated with one or more clients that are also under development, you may want to write and build your programs locally.

To create a new Rust package to write a Solana program, use the `cargo new --lib` command.

```bash
cargo new --lib <PROJECT_FILE_NAME>
```

The new Rust package will include a `Cargo.toml` manifest file which describes the package. This file contains metadata such as name, version, and dependencies, which are call "crates" in Rust. To write a Solana program, you’ll need to update `Cargo.toml` to include `solana-program` as a dependency.

```rust
[package]
name = "<PROJECT_FILE_NAME>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "1.10.7"

[lib]
crate-type = ["cdylib", "lib"]
```

To build a Solana program, we use the `cargo build-bpf` command. The `cargo build-bpf` outputs a `solana program deploy` command specifying the file path to deploy the program.

```bash
cargo build-bpf
```

When you are ready to deploy the program, use the `solana program deploy` command output from `cargo build-bpf`.

```rust
solana program deploy <PATH>
```

# Demo

Let's practice by building and deploying the "Hello World!" program that we created in the [Hello World lesson](https://github.com/Unboxed-Software/solana-course/pull/content/hello-world-program.md). We'll do this all locally, including deploying to a local test validator.

### 1. Setup Solana Config

First, set to endpoint to localhost using the `solana config set --url' command.

```bash
solana config set --url localhost
```

Next, check that the Solana CLI configuration has updated using the `solana config get` command.

```bash
solana config get
```

### 2. Create New Rust Project

Now we are ready to create our a new program. Run the `cargo new --lib` command.

```bash
cargo new --lib <PROJECT_FILE_NAME>
```

Remember to update the `cargo.toml` file to include `solana-program` as a dependency.

```bash
[package]
name = "<PROJECT_FILE_NAME>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "1.10.7"

[lib]
crate-type = ["cdylib", "lib"]
```

### 3. Build and Deploy Program

Next, update `lib.rs` with the “Hello World!” program below. This program simply prints “Hello, world!” to the program log when the program is invoked.

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

Next, build the program using by running the `cargo build-bpf` command.

```bash
cargo build-bpf
```

Before we can deploy our program locally, we must first run a local test validator. In a separate terminal, run the `solana-test-validator` command. This is only necessary when our `RPC URL` is set to localhost.

```bash
solana-test-validator
```

We are now ready to deploy our program. Run the `solana program deploy` command output from `cargo build-bpf`.

```bash
solana program deploy <PATH>
```

The `solana program deploy` will output the `Program ID` for your program. You can now look up deployed program on [Solana Explorer](https://explorer.solana.com/?cluster=custom) (for localhost, select “Custom RPC URL” as the cluster).

Before we invoke our program, open a separate terminal and run the `solana logs` command. This will allow use to view the program logs in the terminal.

```bash
solana logs
```

With the test validator still running, try invoking your program using the client-side script [here](https://github.com/ZYJLiu/solana-hello-world-client). Replace the program ID with the one from the program you just deployed and then run `npm start`. This will return a Solana Explorer URL. Copy the URL into the browser to look up the transaction on Solana Explorer and check that “Hello, World!” was printed to the program log. Alternatively, you can view the program logs in the terminal where you ran the `solana logs` command.

# Challenge

Now it’s your turn to build something independently. Try to build a new program to print your own message to the program logs. This time deploy your program to devnet instead of localhost.

Remember to update your `RPC URL` to devnet using the `solana config set --url` command.

You can invoke the program using the same client-side script from the demo by updating the connection and Solana Explorer URL to devnet.

```tsx
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```tsx
console.log(
  `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);
```

You can also use the `solana logs | grep "<PROGRAM_ID> invoke" -A <NUMBER_OF_LINES_TO_RETURN>` command to view the program logs in a separate terminal. When using `solana logs` on devnet you must specify the program ID. Otherwise, the `solana logs` command will return a constant stream of logs from devnet.

```bash

solana logs | grep "<PROGRAM_ID> invoke" -A 5
```

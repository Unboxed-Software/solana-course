---
title: Local Program Development
objectives:
- Set up a local environment for Solana program development
- Use basic Solana CLI commands
- Run a local test validator
- Use Rust and the Solana CLI to deploy a Solana program from your local development environment
- Use the Solana CLI to view program logs
---

# TL;DR

- To get started with Solana locally, you’ll first need to install **Rust** and the **Solana CLI**
- Using the Solana CLI you can run a **local test validator** using the `solana-test-validator` command
- Once you have Rust and Solana CLI installed, you’ll be able to build and deploy your programs locally using the `cargo build-bpf` and `solana program deploy` commands
- You can view program logs using the `solana logs` command

# Overview

So far in this course, we've used Solana Playground to develop and deploy Solana programs. And while it's a great tool, for certain complex projects you may prefer to have a local development environment set up. This may be in order to use crates not supported by Solana Playground, to take advantage of custom scripts or tooling you've created, or simply out of personal preference.

With that said, this lesson will be slightly different from the others. Instead of covering a lot of ground on how to write a program or interact with the Solana network, this lesson will primarily focus on the less glamorous task of setting up your local development environment.

In order to build, test, and deploy Solana programs from your machine, you'll need to install the Rust compiler and the Solana Command Line Interface (CLI). We'll start by guiding you through these installation processes, then cover how to use what you'll have just installed.

The installation instructions below contain the steps for installing Rust and the Solana CLI at the time of writing. They may have changed by the time you're reading this, so if you run into issues please consult the official installation pages for each:

- [Install Rust](https://www.rust-lang.org/tools/install)
- [Install the Solana Tool Suite](https://docs.solana.com/cli/install-solana-cli-tools)

## Setup on Windows (with Linux)

### Download Windows Subsystem for Linux (WSL)

If you are on a Windows computer, it is recommended to use Windows Subsystem for Linux (WSL) to build your Solana Programs.

Open an **administrator** PowerShell or Windows Command Prompt and check Windows version

```bash
winver
```

If you are on Windows 10 version 2004 and higher (Build 19041 and higher) or Windows 11, run the following command.

```bash
wsl --install
```

If you are running an older version of Windows, follow the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install-manual).

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
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

## Setup on macOS

### Download Rust

First, download Rust by following the instructions [here](https://www.rust-lang.org/tools/install)

### Download the Solana CLI

Next, download the Solana CLI by running the following command in your terminal.

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.10.31/install)"
```

You can read more about downloading the Solana CLI [here](https://docs.solana.com/cli/install-solana-cli-tools).

## Solana CLI basics

The Solana CLI is a command-line interface tool that provides a collection of commands for interacting with a Solana cluster.

We'll cover some of the most common commands in this lesson, but you can always view the list of all possible Solana CLI commands by running `solana --help`.

### Solana CLI configuration

The Solana CLI stores a number of configuration settings that impact the behavior of certain commands. You can use the following command to view the current configuration:

```bash
solana config get
```

The `solana config get` command will return the following:

- `Config File` - the file Solana CLI is located on your computer
- `RPC URL` - endpoint you are using, connecting you to localhost, Devnet, or Mainnet
- `WebSocket URL` - the websocket to listen for events from the cluster you are targeting (computed when you set the `RPC URL`)
- `Keypair Path` - the keypair path used when running Solana CLI subcommands
- `Commitment` - provides a measure of the network confirmation and describes how finalized a block is at that point in time

You can change your Solana CLI configuration at any time by using the `solana config set` command followed by the setting you want to update.

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

Similarly, you can use the `solana config set --keypair` command to change the `Keypair Path`. Solana CLI will then use the keypair from the specified path when running commands.

```bash
solana config set --keypair ~/<FILE_PATH>
```

### Test validators

You'll often find it helpful to run a local validator for testing and debugging rather than deploying to Devnet.

You can run a local test validator using the `solana-test-validator` command. This command creates an ongoing process that will require its own command line window.

### Stream program logs

It's often helpful to open a new console and run the `solana logs` command alongside the test validator. This creates another ongoing process that will stream the logs associated with your configuration's cluster.

If your CLI configuration is pointed to `localhost` then the logs will always be associated with the test validator you've created, but you can also stream logs from other clusters like Devnet and Mainnet Beta. When streaming logs from other clusters, you'll want to include a program ID with the command to limit the logs you see to your specific program.

### Keypairs

You can generate a new keypair using the `solana-keygen new --outfile` command followed by the file path to store the keypair.

```bash
solana-keygen new --outfile ~/<FILE_PATH>
```

At times you may need to check which keypair your configuration is pointed to. To view the `publickey` of the current keypair set in `solana config`, use the `solana address` command.

```bash
solana address
```

To view the SOL balance of the current keypair set in `solana config`, use the `solana balance` command.

```bash
solana balance
```

To airdrop SOL on Devnet or localhost, use the `solana airdrop` command. Note that while on Devnet you are limited to 2 SOL per airdrop.

```bash
solana airdrop 2
```

As you develop and test programs in your local environment, you'll likely encounter errors that are caused by:

- Using the wrong keypair
- Not having enough SOL to deploy your program or perform a transaction
- Pointing to the wrong cluster

The CLI commands we've covered so far should help you quickly resolve those issues.

## Develop Solana programs in your local environment

While the Solana Playground is enormously helpful, it's hard to beat the flexibility of your own local development environment. As you build more complex programs, you may end up integrating them with one or more clients that are also under development in your local environment. Testing between these programs and clients is often simpler when you write, build, and deploy your programs locally.

### Create a new project

To create a new Rust package to write a Solana program, you can use the `cargo new --lib` command with the name of the new directory you'd like to create.

```bash
cargo new --lib <PROJECT_DIRECTORY_NAME>
```

This command will create a new directory with the name you specified at the end of the command. This new directory will contain a `Cargo.toml` manifest file that describes the package.

The manifest file contains metadata such as name, version, and dependencies (crates). To write a Solana program, you’ll need to update the `Cargo.toml` file to include `solana-program` as a dependency. You may also need to add the `[lib]` and `crate-type` lines shown below.

```rust
[package]
name = "<PROJECT_DIRECTORY_NAME>"
version = "0.1.0"
edition = "2021"

[features]
no-entrypoint = []

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

At that point, you can start writing your program in the `src` folder.

### Build and deploy

When it comes time to build your Solana program, you can use the `cargo build-bpf` command.

```bash
cargo build-bpf
```

The output of this command will include instructions for a deploying your program that look something like this:

```text
To deploy this program:
  $ solana program deploy /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local.so
The program address will default to this keypair (override with --program-id):
  /Users/James/Dev/Work/solana-hello-world-local/target/deploy/solana_hello_world_local-keypair.json
```

When you are ready to deploy the program, use the `solana program deploy` command output from `cargo build-bpf`. This will deploy your program to the cluster specified in your CLI configuration.

```rust
solana program deploy <PATH>
```

# Demo

Let's practice by building and deploying the "Hello World!" program that we created in the [Hello World lesson](https://github.com/Unboxed-Software/solana-course/pull/content/hello-world-program.md).

We'll do this all locally, including deploying to a local test validator. Before we begin, make sure you've installed Rust and the Solana CLI. You can refer to the instructions in the overview to get set up if you haven't already.

### 1. Create a new Rust project

Let's start by creating a new Rust project. Run the `cargo new --lib` command below. Feel free to replace the directory name with your own.

```bash
cargo new --lib solana-hello-world-local
```

Remember to update the `cargo.toml` file to include `solana-program` as a dependency and the `crate-type` if isn't there already.

```bash
[package]
name = "solana-hello-world-local"
version = "0.1.0"
edition = "2021"

[dependencies]
solana-program = "~1.8.14"

[lib]
crate-type = ["cdylib", "lib"]
```

### 2. Write your program

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

### 3. Run a local test validator

With your program written, let's make sure our Solana CLI configuration points to localhost by using the `solana config set --url` command.

```bash
solana config set --url localhost
```

Next, check that the Solana CLI configuration has updated using the `solana config get` command.

```bash
solana config get
```

Finally, run a local test validator. In a separate terminal window, run the `solana-test-validator` command. This is only necessary when our `RPC URL` is set to localhost.

```bash
solana-test-validator
```

### 4. Build and deploy

We're now ready to build and deploy our program. Build the program by running the `cargo build-bpf` command.

```bash
cargo build-bpf
```

Now let's deploy our program. Run the `solana program deploy` command output from `cargo build-bpf`.

```bash
solana program deploy <PATH>
```

The `solana program deploy` will output the `Program ID` for your program. You can now look up deployed program on [Solana Explorer](https://explorer.solana.com/?cluster=custom) (for localhost, select “Custom RPC URL” as the cluster).

### 5. View program logs

Before we invoke our program, open a separate terminal and run the `solana logs` command. This will allow use to view the program logs in the terminal.

```bash
solana logs <PROGRAM_ID>
```

With the test validator still running, try invoking your program using the client-side script [here](https://github.com/Unboxed-Software/solana-hello-world-client).

Replace the program ID in `index.ts` with the one from the program you just deployed, then run `npm install` followed by `npm start`. This will return a Solana Explorer URL. Copy the URL into the browser to look up the transaction on Solana Explorer and check that “Hello, world!” was printed to the program log. Alternatively, you can view the program logs in the terminal where you ran the `solana logs` command.

And that's it! You've just created and deployed your first program from a local development environment.

# Challenge

Now it’s your turn to build something independently. Try to create a new program to print your own message to the program logs. This time deploy your program to Devnet instead of localhost.

Remember to update your `RPC URL` to Devnet using the `solana config set --url` command.

You can invoke the program using the same client-side script from the demo as long as you update the `connection` and Solana Explorer URL to both point to Devnet instead of localhost.

```tsx
let connection = new web3.Connection(web3.clusterApiUrl("devnet"));
```

```tsx
console.log(
    `Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`
);
```

You can also open a separate command line window and use the `solana logs | grep "<PROGRAM_ID> invoke" -A <NUMBER_OF_LINES_TO_RETURN>`. When using `solana logs` on Devnet you must specify the program ID. Otherwise, the `solana logs` command will return a constant stream of logs from Devnet. For example, you would do the following to monitor invocations to the Token Program and show the first 5 lines of logs for each invocation:

```bash
solana logs | grep "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke" -A 5
```

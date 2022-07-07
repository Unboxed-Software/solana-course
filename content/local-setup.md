# Local Setup

# Lesson Objectives

- Use basic Solana CLI commands
- Set up a local environment for Solana program development
- Use Rust and Solana CLI to deploy a Solana program from your local environment

# TL;DR

- To get started with Solana locally, you’ll first need to install Rust and the Solana CLI
- Once you have Rust and Solana CLI installed, you’ll be able to build and deploy your programs locally using the `cargo build-bpf` and `solana program deploy` commands.

# Overview

To get started with Solana program development, you’ll need to first install Rust and the Solana CLI. Additionally, if you are on a windows computer, it is recommended to use Windows Subsystem for Linux (WSL) to build your Solana Programs.

## Setup on Windows (with Linux)

### Download Windows Subsystem for Linux (WSL)

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

Let’s go over some basic Solana CLI commands.

First, open a terminal and check the version of Solana CLI by running the `solana --version` command.

```bash
solana --version
```

Next, to see the current Solana CLI configuration settings, run the `solana config get` command.

```bash
solana config get
```

From the list of outputs, the main ones to note are:

- `RPC URL` - the endpoint you are using (connecting you to Localhost, Devnet, or Mainnet)
- `Keypair Path` - the keypair used when running CLI commands (`id.json` is created by default)

To change the `RPC URL`, use the `solana config set --url` command.

```bash
solana config set --url http://localhost:8899
```

```bash
solana config set --url https://api.devnet.solana.com
```

```bash
solana config set --url https://api.mainnet-beta.solana.com
```

You can generate a new keypair using the `solana-keygen new --outfile` command followed by the file path to store the keypair.

```bash
solana-keygen new --outfile ~/<FILE_PATH>
```

To update the `Keypair Path` for the Solana CLI config, using the `solana config set --keypair` command and specify the path of the new keypair (Solana CLI will now use the keypair from the specified path when running commands).

```bash
solana config set --keypair ~/<FILE_PATH>
```

To view the `publickey` of the currently configured keypair, run the `solana address` command.

```bash
solana address
```

To view the SOL balance of the of the currently configured keypair, run the `solana balance` command.

```bash
solana balance
```

To airdrop SOL for testing (on Devnet or Localhost), run the `solana airdrop <AMOUNT>` command (Note that while on Devnet you are limited to 2 SOL per airdrop).

```bash
solana airdrop 2
```

While deploying and testing on Localhost, you must run a test validator using the `solana-test-validator` command.

```bash
solana-test-validator
```

While on Localhost, you can view program logs by running the `solana logs` command in a separate terminal.

```bash
solana logs
```

To view program logs while on Devnet, use the `solana logs | grep "<PROGRAM_ID> invoke"` command and specify the program Id. If the program Id is not specified, then the `solana logs` command will return a constant stream of logs from Devnet. You can then specify the number of lines (of program logs) to return by including `-A <NUMBER_OF_LINES_TO_RETURN>` after the command.

```bash
solana logs | grep "<PROGRAM_ID> invoke" -A <NUMBER_OF_LINES_TO_RETURN>
```

To deploy a program, you using the `solana program deploy` command and specify the file path of the program. The command to deploy a program along with the file path is provided as an output when you build the program. We’ll go over this shortly in the demo.

```bash
solana program deploy <PATH>
```

Lastly, you can view the details for Solana CLI commands using the `solana --help` command.

```bash
solana --help
```

## Solana Program from Local Environment

To create a new Rust project run the following in a new terminal.

```bash
cargo new --lib <PROJECT_FILE_NAME>
```

Open the new project and update the `Cargo.toml` file. Remember to specify the latest version of `solana-program`.

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

To build a Solana program in Rust, run the `cargo build-bpf` command. The output provides the `solana program deploy` command specifying the file path to deploy the program.

```bash
cargo build-bpf
```

Finally, to deploy the program after building, run the `solana program deploy` command output from `cargo build-bpf`.

```bash
solana program deploy <PATH>
```

# Demo

Let’s practice by building and deploying the “Hello World!” program from lesson one of this module.

### 1. Setup Solana Config

First, set to endpoint to Devnet using the `solana config set --url` command.

```bash
solana config set --url https://api.devnet.solana.com
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

Update `cargo.toml` with the dependencies we’ll need to build a Solana program.

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

Finally, deploy the program using the `solana program deploy` command output from `cargo build-bpf`.

```bash
solana program deploy <PATH>
```

The `solana program deploy` will output the `Program Id` for your program. You can now look up deployed program on Solana Explorer.

# Challenge

Now that the program is deployed, try invoking your program using the client-side script [here](https://github.com/ZYJLiu/solana-hello-world-client).

Replace the program Id with the one from the program you just deployed and then run `npm start`. This will return a Solana Explorer URL. Copy the URL into the browser to look up the transaction on Solana Explorer and check that “Hello, World!” was printed to the program log. Alternatively, you can use the `solana logs | grep "<PROGRAM_ID> invoke" -A <NUMBER_OF_LINES_TO_RETURN>` command to view the program logs in a separate terminal.

```rust
solana logs | grep "<PROGRAM_ID> invoke" -A 5
```

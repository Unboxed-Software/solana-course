---
title: Local Program Development
objectives:
- Set up a local environment for Solana program development, with Solana CLI tools, Rust and Anchor.
- Ensure Anchor works out of the box with no errors or warnings
---

# Summary

- To develop onchain programs on your machine, you need  **Solana CLI**, **Rust** and (optional, but recommended) **Anchor**.
- You can use `anchor init` to create a new blank Anchor project
- `anchor test` runs your tests, and also builds your code. 

# Lesson

There's no lesson here! Let's install Solana CLI tools, the Rust SDK, and Anchor, and create a test program to ensure that our setup works.

# Lab

### Extra steps for Windows users

Firstly install [Windows Terminal](https://apps.microsoft.com/detail/9N0DX20HK701) from the Microsoft store.

Then [install Windows Subsystem for Linux (WSL)](https://learn.microsoft.com/en-us/windows/wsl/install). WSL provides a Linux environment that launches instantly whenever you need it and doesn't slow your computer down. 

Start Windows Terminal, launch an 'Ubuntu' session inside the terminal, and proceed with the rest of these steps.

### Download Rust

First, download Rust by [following the instructions](https://www.rust-lang.org/tools/install):

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Download the Solana CLI tools

Next [download the Solana CLI tools](https://docs.solana.com/cli/install-solana-cli-tools).

```
sh -c "$(curl -sSfL https://release.solana.com/beta/install)"
```

Afterwards, `solana -V` should show `solana-cli 1.18.x` (any number for `x` is fine).

### Download Anchor

Finally [download Anchor](https://www.anchor-lang.com/docs/installation):

```
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

Afterwards, `anchor -V` should show `anchor-cli 0.30.0`.

### Check your Anchor installation

Create a temporary project, with the default contents, using Anchor and make sure it compiles and runs our tests:

```bash
anchor init temp-project
cd temp-project
anchor test
```

**The `anchor test` command should complete with no errors or warnings**. However you may encounter issues, and we'll fix them below:

#### `package `solana-program v1.18.12` cannot be built because it requires rustc 1.75.0 or newer` error

Run `cargo add solana-program@"=1.18.x"`, where `x` matches your version of `solana-cli`. Then re-run `anchor test`.

#### `Error: Unable to read keypair file`

Add a keypair to `.config/solana/id.json`. You can either copy a keypair from an `.env` file (just the array of numbers) into a file or use the command `solana-keygen new --no-bip39-passphrase` to create a new keypair file. Then re-run `anchor test`.

#### `unused variable: 'ctx'` warning

This simply means the `initialize` instruction handler isn't doing anything yet. You can open `programs/favorites/src/lib.rs` and change `ctx` to `_ctx` or just go onto the next step.  

#### `No license field in package.json` warning

Open package.json, add `"license": "MIT"` or `"license": "UNLICENSED"` depending on preferences

### All done?

Ensure `anchor test` completes successfully - with no warnings and no errors - before continuing.

## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=aa0b56d6-02a9-4b36-95c0-a817e2c5b19d)!
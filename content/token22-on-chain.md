# Lab

### 1. Verify Solana/Anchor/Rust Versions

Run `solana --version` on your machine. We will be interacting with the `token22` program in this lab and that requires you have solana cli version ≥ 1.18.0

If the version printed out after running `solana --version` is less than `1.18.0` then you can update the cli version manually. Note, at the time of writing this, you cannot simply run the `solana-install update` command. This command will not update the CLI to the correct version for us, so we have to explicitly download version `1.18.0`. You can do so with the following command:

`solana-install init 1.18.0`

If you run into this error at any point attempting to build the program, that likely means you do not have the correct version of the solana CLI installed.

```
anchor build
error: package `solana-program v1.18.0` cannot be built because it requires rustc 1.72.0 or newer, while the currently active rustc version is 1.68.0-dev
Either upgrade to rustc 1.72.0 or newer, or use
cargo update -p solana-program@1.18.0 --precise ver
where `ver` is the latest version of `solana-program` supporting rustc 1.68.0-dev
```

You will also want the latest version of the anchor CLI installed. You can follow along the steps listed here to update via avm https://www.anchor-lang.com/docs/avm

or simply run
`anchor install latest`

At the time of writing, the latest version of the Anchor CLI is `0.29.0`

Now, we can check our rust version.

`rustc --version`

At the time of writing, version `1.26.0` was used for the rust compiler. If you would like to update, you can do so via `rustup`
https://doc.rust-lang.org/book/ch01-01-installation.html

`rustup update`

Now, we should have all the correct versions installed.

### 2. Get starter code and add dependencies

Checkout `starter` branch.

### 3. Update Program ID and Anchor Keypair

### 4. 
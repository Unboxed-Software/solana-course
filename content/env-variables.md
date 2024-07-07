---
title: Environment Variables in Solana Programs
objectives:
- Define program features in the `Cargo.toml` file
- Use the Rust `cfg` attribute to conditionally compile code based on which features are or are not enabled
- Use the Rust `cfg!` macro to conditionally compile code based on which features are or are not enabled
- Create an admin-only instruction to set up a program account that can be used to store program configuration values
---

# Summary

-   There are no "out of the box" solutions for creating distinct environments in an onchain program, but you can achieve something similar to environment variables if you get creative.
-   You can use the `cfg` attribute with **Rust features** (`#[cfg(feature = ...)]`) to run different code or provide different variable values based on the Rust feature provided. _This happens at compile-time and doesn't allow you to swap values after a program has been deployed_.
-   Similarly, you can use the `cfg!` **macro** to compile different code paths based on the enabled features.
-   Alternatively, you can achieve something similar to environment variables that can be modified after deployment by creating accounts and instructions only accessible by the program’s upgrade authority.

# Lesson

One of the difficulties engineers face across all types of software development is writing testable code and creating distinct environments for local development, testing, production, etc.

This can be particularly difficult in Solana program development. For example, imagine creating an NFT staking program that rewards each staked NFT with 10 reward tokens per day. How do you test the ability to claim rewards when tests run in a few hundred milliseconds, not nearly long enough to earn rewards?

Traditional web development solves some of this with environment variables whose values can differ in each distinct "environment." Currently, there's no formal concept of environment variables in a Solana program. If there were, you could make it so that rewards in your test environment are 10,000,000 tokens daily. Then it would be easier to test the ability to claim rewards.

Fortunately, you can achieve similar functionality if you get creative. The best approach is probably a combination of two things:

1. Rust feature flags that allow you to specify in your build command the "environment" of the build, coupled with code that adjusts specific values accordingly
2. Program "admin-only" accounts and instructions that are only accessible by the program's upgrade authority

## Rust feature flags

One of the simplest ways to create environments is to use Rust features. Features are defined in the `[features]` table of the program’s `Cargo.toml` file. You may define multiple features for different use cases.

```toml
[features]
feature-one = []
feature-two = []
```

It's important to note that the above simply defines a feature. To enable a feature when testing your program, you can use the `--features` flag with the `anchor test` command.

```bash
anchor test -- --features "feature-one"
```

You can also specify multiple features by separating them with a comma.

```bash
anchor test -- --features "feature-one", "feature-two"
```

### Make code conditional using the `cfg` attribute

With a feature defined, you can then use the `cfg` attribute within your code to conditionally compile code based on whether or not a given feature is enabled. This allows you to include or exclude certain code from your program.

The syntax for using the `cfg` attribute is like any other attribute macro: `#[cfg(feature=[FEATURE_HERE])]`. For example, the following code compiles the function `function_for_testing` when the `testing` feature is enabled and the `function_when_not_testing` otherwise:

```rust
#[cfg(feature = "testing")]
fn function_for_testing() {
    // code that will be included only if the "testing" feature flag is enabled
}

#[cfg(not(feature = "testing"))]
fn function_when_not_testing() {
    // code that will be included only if the "testing" feature flag is not enabled
}
```

This allows you to enable or disable certain functionality in your Anchor program at compile time by enabling or disabling the feature.

It's not a stretch to imagine wanting to use this to create distinct "environments" for different program deployments. For example, not all tokens have deployments across both Mainnet and Devnet. So you might hard-code one token address for Mainnet deployments but hard-code a different address for Devnet and Localnet deployments. That way you can quickly switch between different environments without requiring any changes to the code itself.

The code below shows an example of an Anchor program that uses the `cfg` attribute to include different token addresses for local testing compared to other deployments:

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(feature = "local-testing")]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("WaoKNLQVDyBx388CfjaVeyNbs3MT2mPgAhoCfXyUvg8");
}

#[cfg(not(feature = "local-testing"))]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize_usdc_token_account(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = payer,
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(address = constants::USDC_MINT_PUBKEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

In this example, the `cfg` attribute is used to conditionally compile two different implementations of the `constants` module. This allows the program to use different values for the `USDC_MINT_PUBKEY` constant depending on whether or not the `local-testing` feature is enabled.

### Make code conditional using the `cfg!` macro

Similar to the `cfg` attribute, the `cfg!` **macro** in Rust allows you to check the values of certain configuration flags at runtime. This can be useful if you want to execute different code paths depending on the values of certain configuration flags.

You could use this to bypass or adjust the time-based constraints required in the NFT staking app we mentioned previously. When running a test, you can execute code that provides far higher staking rewards when compared to running a production build.

To use the `cfg!` macro in an Anchor program, you simply add a `cfg!` macro call to the conditional statement in question:

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn test_function(ctx: Context<Test>) -> Result<()> {
        if cfg!(feature = "local-testing") {
            // This code will be executed only if the "local-testing" feature is enabled
            // ...
        } else {
            // This code will be executed only if the "local-testing" feature is not enabled
            // ...
        }
        // Code that should always be included goes here
        ...
        Ok(())
    }
}
```

In this example, the `test_function` uses the `cfg!` macro to check the value of the `local-testing` feature at runtime. If the `local-testing` feature is enabled, the first code path is executed. If the `local-testing` feature is not enabled, the second code path is executed instead.

## Admin-only instructions

Feature flags are great for adjusting values and code paths at compilation, but they don't help much if you need to adjust something after you've already deployed your program.

For example, if your NFT staking program has to pivot and use a different rewards token, there'd be no way to update the program without redeploying. If only there were a way for program admins to update certain program values... Well, it's possible!

First, you must structure your program to store the values you anticipate changing in an account rather than hard-coding them into the program code.

Next, you need to ensure that this account can only be updated by some known program authority or what we're calling an admin. That means any instructions that modify the data on this account need to have constraints limiting who can sign for the instruction. This sounds fairly straightforward in theory, but there is one main issue: how does the program know who is an authorized admin?

There are a few solutions, each with their benefits and drawbacks:

1. Hard-code an admin public key that can be used in the admin-only instruction constraints.
2. Make the program's upgrade authority the admin.
3. Store the admin in the config account and set the first admin in an `initialize` instruction.

### Create the config account

The first step is adding what we'll call a "config" account to your program. You can customize this to suit your needs, but we suggest a single global PDA. In Anchor, that simply means creating an account struct and using a single seed to derive the account's address.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

The example above shows a hypothetical config account for the NFT staking program example we've referenced throughout the lesson. It stores data representing the token that should be used for rewards and the amount of tokens to give out for each day of staking.

With the config account defined, ensure that the rest of your code references this account when using these values. That way, if the data in the account changes, the program adapts accordingly.

### Constrain config updates to hard-coded admins

You'll need a way to initialize and update the config account data. That means you need to have one or more instructions that only an admin can invoke. The simplest way to do this is to hard-code an admin's public key in your code. You can then add a simple signer check into your instruction's account validation that compares the signer to this public key.

In Anchor, constraining an `update_program_config` instruction to only be usable by a hard-coded admin might look like this:

```rust
#[program]
mod my_program {
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        reward_token: Pubkey,
        rewards_per_day: u64
    ) -> Result<()> {
        ctx.accounts.program_config.reward_token = reward_token;
        ctx.accounts.program_config.rewards_per_day = rewards_per_day;

        Ok(())
    }
}

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("ADMIN_WALLET_ADDRESS_HERE");

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}
```

Before instruction logic even executes, a check will be performed to make sure the instruction's signer matches the hard-coded `ADMIN_PUBKEY`. Notice that the example above doesn't show the instruction that initializes the config account, but it should have similar constraints to ensure that an attacker can't initialize the account with unexpected values.

While this approach works, it also means keeping track of an admin wallet on top of keeping track of a program's upgrade authority. With a few more lines of code, you could simply restrict an instruction to only be callable by the upgrade authority. The only tricky part is getting a program's upgrade authority to compare against.

### Constrain config updates to the program's upgrade authority

Fortunately, every program has a program data account that translates to the Anchor `ProgramData` account type and has the `upgrade_authority_address` field. The program itself stores this account's address in its data in the field `programdata_address`.

So, in addition to the two accounts required by the instruction in the hard-coded admin example, this instruction requires the `program` and the `program_data` accounts.

The accounts then need the following constraints:

1. A constraint on `program` ensuring that the provided `program_data` account matches the program's `programdata_address` field
2. A constraint on the `program_data` account ensuring that the instruction's signer matches the `program_data` account's `upgrade_authority_address` field.

When completed, that looks like this:

```rust
...

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, MyProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub authority: Signer<'info>,
}
```

Again, the example above doesn't show the instruction that initializes the config account, but it should have the same constraints to ensure that an attacker can't initialize the account with unexpected values.

If this is the first time you've heard about the program data account, it's worth reading through [this Notion doc](https://www.notion.so/29780c48794c47308d5f138074dd9838) about program deploys.

### Constrain config updates to a provided admin

Both of the previous options are fairly secure but also inflexible. What if you want to update the admin to be someone else? For that, you can store the admin on the config account.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    admin: Pubkey,
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

Then you can constrain your "update" instructions with a signer check matching against the config account's `admin` field.

```rust
...

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == program_config.admin)]
    pub authority: Signer<'info>,
}
```

There's one catch here: in the time between deploying a program and initializing the config account, _there is no admin_. This means that the instruction for initializing the config account can't be constrained to only allow admins as callers. That means it could be called by an attacker looking to set themselves as the admin.

While this sounds bad, it really just means that you shouldn't treat your program as "initialized" until you've initialized the config account yourself and verified that the admin listed on the account is who you expect. If your deploy script deploys and then immediately calls `initialize`, it's very unlikely that an attacker is even aware of your program's existence, much less trying to make themselves the admin. If, by some crazy stroke of bad luck, someone "intercepts" your program, you can close the program with the upgrade authority and redeploy.

# Lab

Now, let's go ahead and try this out together. For this lab, we'll work with a simple program enabling USDC payments. The program collects a small fee to facilitate the transfer. Note that this is somewhat contrived since you can do direct transfers without an intermediary contract, but it simulates how some complex DeFi programs work.

We'll quickly learn while testing our program that it could benefit from the flexibility provided by an admin-controlled configuration account and some feature flags.

### 1. Starter

Download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-admin-instructions/tree/starter). The code contains a program with a single instruction and a single test in the `tests` directory.

Let's quickly walk through how the program works.

The `lib.rs` file includes a constant for the USDC address and a single `payment` instruction. The `payment` instruction simply calls the `payment_handler` function in the `instructions/payment.rs` file where the instruction logic is contained.

The `instructions/payment.rs` file contains both the `payment_handler` function as well as the `Payment` account validation struct representing the accounts required by the `payment` instruction. The `payment_handler` function calculates a 1% fee from the payment amount, transfers the fee to a designated token account, and transfers the remaining amount to the payment recipient.

Finally, the `tests` directory has a single test file, `config.ts`, that simply invokes the `payment` instruction and asserts that the corresponding token account balances have been debited and credited accordingly.

Before we continue, take a few minutes to familiarize yourself with these files and their contents.

### 2. Run the existing test

Let's start by running the existing test.

Ensure you use `yarn` or `npm install` to install the dependencies in the `package.json` file. Then, be sure to run `anchor keys list` to get the public key for your program printed to the console. This differs based on your local keypair, so you need to update `lib.rs` and `Anchor.toml` to use *your* key.

Finally, run `anchor test` to start the test. It should fail with the following output:

```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: incorrect program id for instruction
```

This error is because we're attempting to use the mainnet USDC mint address (as hard-coded in the `lib.rs` file of the program), but that mint doesn't exist in the local environment. 

### 3. Adding a `local-testing` feature

We need a mint we can use locally *and* hard-code into the program to fix this. Since the local environment is reset often during testing, you'll need to store a keypair that you can use to recreate the same mint address every time.

Additionally, you don't want to change the hard-coded address between local and mainnet builds since that could introduce human error (and is just annoying). So we'll create a `local-testing` feature that, when enabled, will make the program use our local mint but otherwise use the production USDC mint.

Generate a new keypair by running `solana-keygen grind`. Run the following command to generate a keypair with a public key that begins with "env".

```
solana-keygen grind --starts-with env:1
```

Once a keypair is found, you should see an output similar to the following:

```
Wrote keypair to env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json
```

The keypair is written to a file in your working directory. Now that we have a placeholder USDC address, let's modify the `lib.rs` file. Use the `cfg` attribute to define the `USDC_MINT_PUBKEY` constant depending on whether the `local-testing` feature is enabled or disabled. Remember to set the `USDC_MINT_PUBKEY` constant for `local-testing` with the one generated in the previous step rather than copying the one below.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("...");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

#[program]
pub mod config {
    use super::*;

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

Next, add the `local-testing` feature to the `Cargo.toml` file located in `/programs`.

```
[features]
...
local-testing = []
```

Next, update the `config.ts` test file to create a mint using the generated keypair. Start by deleting the `mint` constant.

```typescript
const mint = new anchor.web3.PublicKey(
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);
```

Next, update the test to create a mint using the keypair, which will enable us to reuse the same mint address each time the tests are run. Remember to replace the file name with the one generated in the previous step.

```typescript
let mint: anchor.web3.PublicKey

before(async () => {
  let data = fs.readFileSync(
    "env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json"
  )

  let keypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(data))
  )

  const mint = await spl.createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    null,
    0,
    keypair
  )
...
```

Lastly, run the test with the `local-testing` feature enabled.

```
anchor test -- --features "local-testing"
```

You should see the following output:

```
config
  ✔ Payment completes successfully (406ms)


1 passing (3s)
```

Boom. Just like that, you've used features to run two different code paths for different environments.

### 4. Program Config

Features are great for setting different values at compilation, but what if you wanted to be able to dynamically update the fee percentage used by the program? Let's make that possible by creating a Program Config account that allows us to update the fee without upgrading the program.

To begin, let's first update the `lib.rs` file to:

1. Include a `SEED_PROGRAM_CONFIG` constant, which will be used to generate the PDA for the program config account.
2. Include an `ADMIN` constant, which will be used as a constraint when initializing the program config account. Run the `solana address` command to get your address to use as the constant's value.
3. Include a `state` module that we'll implement shortly.
4. Include the `initialize_program_config` and `update_program_config` instructions and calls to their "handlers," both of which we'll implement in another step.

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
mod state;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("envgiPXWwmpkHFKdy4QLv2cypgAWmVTVEm71YbNpYRu");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN: Pubkey = pubkey!("...");

#[program]
pub mod config {
    use super::*;

    pub fn initialize_program_config(ctx: Context<InitializeProgramConfig>) -> Result<()> {
        instructions::initialize_program_config_handler(ctx)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_fee: u64,
    ) -> Result<()> {
        instructions::update_program_config_handler(ctx, new_fee)
    }

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

### 5. Program Config State

Next, let's define the structure for the `ProgramConfig` state. This account will store the admin, the token account where fees are sent, and the fee rate. We'll also specify the number of bytes required to store this structure.

Create a new file called `state.rs` in the `/src` directory and add the following code.

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

### 6. Add Initialize Program Config Account Instruction

Now let's create the instruction logic for initializing the program config account. It should only be callable by a transaction signed by the `ADMIN` key and should set all the properties on the `ProgramConfig` account.

Create a folder called `program_config` at the path `/src/instructions/program_config`. This folder will store all instructions related to the program config account.

Within the `program_config` folder, create a file called `initialize_program_config.rs` and add the following code.

```rust
use crate::state::ProgramConfig;
use crate::ADMIN;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(init, seeds = [SEED_PROGRAM_CONFIG], bump, payer = authority, space = ProgramConfig::LEN)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut, address = ADMIN)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_program_config_handler(ctx: Context<InitializeProgramConfig>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = 100;
    Ok(())
}
```

### 7. Add Update Program Config Fee Instruction

Next, implement the instruction logic for updating the config account. The instruction should require that the signer match the `admin` stored in the `program_config` account.

Within the `program_config` folder, create a file called `update_program_config.rs` and add the following code.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = program_config.admin,
    )]
    pub admin: Signer<'info>,
    /// CHECK: arbitrarily assigned by existing admin
    pub new_admin: UncheckedAccount<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    new_fee: u64,
) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.new_admin.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = new_fee;
    Ok(())
}
```

### 8. Add mod.rs and update instructions.rs

Next, let's expose the instruction handlers we created so that the call from `lib.rs` doesn't show an error. Start by adding a file `mod.rs` in the `program_config` folder. Add the code below to make the two modules, `initialize_program_config` and `update_program_config` accessible.

```rust
mod initialize_program_config;
pub use initialize_program_config::*;

mod update_program_config;
pub use update_program_config::*;
```

Now, update `instructions.rs` at the path `/src/instructions.rs`. Add the code below to make the two modules, `program_config` and `payment` accessible.

```rust
mod program_config;
pub use program_config::*;

mod payment;
pub use payment::*;
```

### 9. Update Payment Instruction

Lastly, let's update the payment instruction to check that the `fee_destination` account in the instruction matches the `fee_destination` stored in the program config account. Then update the instruction's fee calculation to be based on the `fee_basis_point` stored in the program config account.

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [SEED_PROGRAM_CONFIG],
        bump,
        has_one = fee_destination
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub sender: Signer<'info>,
}

pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.program_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Transfer Amount: {}", remaining_amount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.fee_destination.to_account_info(),
            },
        ),
        fee_amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
            },
        ),
        remaining_amount,
    )?;

    Ok(())
}
```

### 10. Test

Now that we're done implementing our new program configuration struct and instructions, let's move on to testing our updated program. To begin, add the PDA for the program config account to the test file.

```typescript
describe("config", () => {
  ...
  const programConfig = findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0]
...
```

Next, update the test file with three more tests testing that:

1. The program config account is initialized correctly
2. The payment instruction is functioning as intended
3. The config account can be updated successfully by the admin
4. The config account cannot be updated by someone other than the admin

The first test initializes the program config account and verifies that the correct fee is set and that the correct admin is stored on the program config account.

```typescript
it("Initialize Program Config Account", async () => {
  const tx = await program.methods
    .initializeProgramConfig()
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      authority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    100
  )
  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).admin.toString(),
    wallet.publicKey.toString()
  )
})
```

The second test verifies that the payment instruction is working correctly, with the fee being sent to the fee destination and the remaining balance being transferred to the receiver. Here we update the existing test to include the `programConfig` account.

```typescript
it("Payment completes successfully", async () => {
  const tx = await program.methods
    .payment(new anchor.BN(10000))
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      senderTokenAccount: senderTokenAccount,
      receiverTokenAccount: receiverTokenAccount,
      sender: sender.publicKey,
    })
    .transaction()

  await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])

  assert.strictEqual(
    (await connection.getTokenAccountBalance(senderTokenAccount)).value
      .uiAmount,
    0
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(feeDestination)).value.uiAmount,
    100
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(receiverTokenAccount)).value
      .uiAmount,
    9900
  )
})
```

The third test attempts to update the fee on the program config account, which should be successful.

```typescript
it("Update Program Config Account", async () => {
  const tx = await program.methods
    .updateProgramConfig(new anchor.BN(200))
    .accounts({
      programConfig: programConfig,
      admin: wallet.publicKey,
      feeDestination: feeDestination,
      newAdmin: sender.publicKey,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    200
  )
})
```

The fourth test tries to update the fee on the program config account, where the admin is not the one stored on the program config account, and this should fail.

```typescript
it("Update Program Config Account with unauthorized admin (expect fail)", async () => {
  try {
    const tx = await program.methods
      .updateProgramConfig(new anchor.BN(300))
      .accounts({
        programConfig: programConfig,
        admin: sender.publicKey,
        feeDestination: feeDestination,
        newAdmin: sender.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])
  } catch (err) {
    expect(err)
  }
})
```

Finally, run the test using the following command:

```
anchor test -- --features "local-testing"
```

You should see the following output:

```
config
  ✔ Initialize Program Config Account (199ms)
  ✔ Payment completes successfully (405ms)
  ✔ Update Program Config Account (403ms)
  ✔ Update Program Config Account with unauthorized admin (expect fail)

4 passing (8s)
```

And that's it! You've made the program a lot easier to work with moving forward. If you want to take a look at the final solution code, you can find it on the `solution` branch of [the same repository](https://github.com/Unboxed-Software/solana-admin-instructions/tree/solution).

# Challenge

Now, it's time for you to do some of this on your own. We mentioned being able to use the program's upgrade authority as the initial admin.  Go ahead and update the lab's `initialize_program_config` so that only the upgrade authority can call it rather than having a hardcoded `ADMIN`.

Note that when run on a local network, the anchor test' command starts a new test validator using `solana-test-validator`. This test validator uses a non-upgradeable loader. The non-upgradeable loader makes it so the program's `program_data` account isn't initialized when the validator starts. You'll remember from the lesson that this account is how we can access the upgrade authority from the program.

To work around this, you can add a `deploy` function to the test file that runs the deploy command for the program with an upgradeable loader. To use it, run `anchor test --skip-deploy` and call the `deploy` function within the test to run the deploy command after the test validator has started.

```typescript
import { execSync } from "child_process"

...

const deploy = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/config-keypair.json $(pwd)/target/deploy/config.so`
  execSync(deployCmd)
}

...

before(async () => {
  ...
  deploy()
})
```

For example, the command to run the test with features would look like this:

```
anchor test --skip-deploy -- --features "local-testing"
```

Try doing this on your own, but if you get stuck, feel free to reference the `challenge` branch of [the same repository](https://github.com/Unboxed-Software/solana-admin-instructions/tree/challenge) to see one possible solution.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=02a7dab7-d9c1-495b-928c-a4412006ec20)!

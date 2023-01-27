# Environment Variables in Solana Programs

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Define program features in the `Cargo.toml` file
- Use the Rust `cfg` attribute to conditionally compile code based on which features are or are not enabled
- Use the Rust `cfg!` macro to conditionally compile code based on which features are or are not enabled
- Create an admin-only instruction to set up a program account that can be used to store program configuration values

# TL;DR

- There are no "out of the box" solutions for creating distinct environments in an on-chain program, but you can achieve something similar to environment variables if you get creative.
- You can use the `cfg` attribute with **Rust features** (`#[cfg(feature = ...)]`) to run different code or provide different variable values based on the Rust feature provided. *This happens at compile-time and doesn't allow you to swap values after a program has been deployed*.
- Similarly, you can use the `cfg!` **macro** to compile different code paths based on the features that are enabled.
- Alternatively, you can achieve something similar to environment variables that can be modified after deployment by creating accounts and instructions that are only accessible by the program’s upgrade authority.

# Overview

One of the difficulties engineers face across all types of software development is that of writing testable code and creating distinct environments for local development, testing, production, etc.

This can be particularly difficult in Solana program development. For example, imagine creating an NFT staking program that rewards each staked NFT with 10 reward tokens per day. How do you test the ability to claim rewards when tests run in a few hundred milliseconds, not nearly long enough to earn rewards?

Traditional web development solves some of this with environment variables whose values can differ in each distinct "environment." Currently, there's no formal concept of environment variables in a Solana program. If there were, you could just make it so that rewards in your test environment are 10,000,000 tokens per day and it would be easier to test the ability to claim rewards.

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

With a feature defined, you can then use the `cfg` attribute within your code to conditionally compile code based on the whether or not a given feature is enabled. This allows you to include or exclude certain code from your program.

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

It's not a stretch to imagine wanting to use this to create distinct "environments" for different program deployments. For example, not all tokens have deployments across both Mainnet and Devnet. So you might hard-code one token address for Mainnet deployments but hard-code a different address for Devnet and Localnet deployments. That way you can quickly switch between between different environments without requiring any changes to the code itself.

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

Feature flags are great for adjusting values and code paths at compilation, but they don't help much if you end up needing to adjust something after you've already deployed your program.

For example, if your NFT staking program has to pivot and use a different rewards token, there'd be no way to update the program without redeploying. If only there were a way for program admins to update certain program values...

Well, it's possible! First, you need to structure your program to store the values you anticipate changing in an account rather than hard-coding them into the program code. Next, you need to ensure that this account can only be updated by some known program authority, or what we're calling an admin. That means any instructions that modify the data on this account need to have constraints limiting who can sign for the instruction.

### Create the config account

The first step is adding what we'll call a "config" account to your program. You can customize this to best suit your needs, but we suggest a single global PDA. In Anchor, that simply means creating an account struct and using a single seed to derive the account's address.

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

The example above shows a hypothetical config account for the NFT staking program example we've referenced throughout the lesson. It stores data representing the token that should be used for rewards and the amount of tokens to give out for each day of staking.

With the config account defined, simply ensure that the rest of your code references this account when using these values. That way, if the data in the account changes, the program adapts accordingly.

### Constrain config updates to admins

The next thing to do is create one or more admin-only instructions for updating the program's config account. This sounds fairly straightforward in theory, but there is one main issues: how does the program know who is an authorized admin?

Well, there are two simple solutions:

1. Hard-code an admin public key that can be used in the admin-only instruction constraints.
2. Make the program's upgrade authority the admin.

In Anchor, constraining an `update_program_config` instruction to only be usable by a hard-coded admin might look like this: 

```rust
#[program]
mod my_program {
    pub fn set_admin_settings(
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

Before instruction logic even executes, a check will be performed to make sure the instruction's signer matches the hard-coded `ADMIN_PUBKEY`.

While this approach works, it also means keeping track of an admin wallet on top of keeping track of a program's upgrade authority. With a few more lines of code, you could simply restrict an instruction to only be callable by the upgrade authority. The only tricky part is getting a program's upgrade authority to compare against.

Fortunately, every program has a program data account that translates to the Anchor `ProgramData` account type and has the `upgrade_authority_address` field. The program itself stores this account's address in its data in the field `programdata_address`.

So in addition to the two accounts required by the instruction in the hard-coded admin example, this instruction requires the `program` and the `program_data` accounts.

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

If this is the first time you've heard about the program data account, it's worth reading through [this Notion doc](https://www.notion.so/29780c48794c47308d5f138074dd9838) about program deploys.

# Demo

Let's pull all of this together now by creating and testing a Solana program that will run 4 tests:

1) Txn with correct amounts
2) Txn with incorrect amounts
3) An Admin Config Update - as Admin
4) An Admin Config Update - not as Admin

Based on the `cfg` attributes and feature flags we will provide, all 4 tests should pass.

### 1. Starter

First thing to do is grab the starter code here [https://github.com/maweiche/admin-test/tree/starter](https://github.com/maweiche/admin-test/tree/starter). Make sure you clone the code from the `starter` branch and not `master`.

```sh
git clone https://github.com/maweiche/admin-test.git
cd admin-test
git checkout -b starter
git pull origin starter
npm install
```

Once you've cloned the starter code, let's configure Solana in the terminal. We'll be deploying and testing on localhost, so switch the Solana RPC in your terminal to localhost with:

```sh
solana config set --url localhost
```

If you see an output like this, then you're set.

```sh
Config File: /Users/matt/.config/solana/cli/config.yml
RPC URL: http://localhost:8899 
WebSocket URL: ws://localhost:8900/ (computed)
Keypair Path: /Users/matt/.config/solana/id.json 
Commitment: confirmed
```

### 2. Admin Instruction

Now that we are set up, let's open our code and head to the `state.rs` located in your `/programs/config/src` directory and define the structure expected for our `AdminConfig`

```rust
use anchor_lang::prelude::*;

#[account]
pub struct AdminConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl AdminConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

The structure is pretty straightforward, we are telling the program which "types" to expect for the three fields in `AdminConfig`, and then how many bytes are required to store this structure.

Next, let's edit the programs instructions starting with `initialize_admin_config.rs` located in the `/programs/config/src/instructions/admin` :

```rust
use crate::program::Config;
use crate::state::AdminConfig;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeAdminConfig<'info> {
    #[account(init, seeds = [b"admin"], bump, payer = authority, space = AdminConfig::LEN)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account()]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, Config>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_admin_config_handler(ctx: Context<InitializeAdminConfig>) -> Result<()> {
    ctx.accounts.admin_config.admin = ctx.accounts.authority.key();
    ctx.accounts.admin_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.admin_config.fee_basis_points = 100;
    Ok(())
}
```

What we are doing here is setting up the instructions for how to initialize the `AdminConfig` and what values to set to it's fields. To be more specific, when the program is deployed it will take the `Signer` of the deployment and set it as the `Authority` because of these 2 lines :

```rust
pub authority: Signer<'info>,
```

```rust
ctx.accounts.admin_config.admin = ctx.accounts.authority.key();
```


### 3. Payment Instruction

Now that we have the `AdminConfig` set up, let's dig into the `payment.rs` located in the `programs/config/src/instructions` directory.

Here we'll breakdown the instructions for how our program will handle a payment, starting with updating the imports and payment structure.

```rust
use crate::state::AdminConfig;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [b"admin"],
        bump,
        has_one = fee_destination
    )]
    pub admin_config: Account<'info, AdminConfig>,
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
```

Once we've defined the structure for our `Payment` let's write the function to handle it right below it:

```rust
pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.admin_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Amount: {}", remaining_amount);

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

Nothing too special here, just a standard token transfer from one account to another using the token address defined by `USDC_MINT_PUBKEY` in our structure.

### 4. Write Tests

Ok, now that we have completed the instructions for our two test subjects, the `Payment` and `AdminConfig`, let's set up the tests.

Open up your `/tests/config.ts` , the first thing we want to set up is initializing the `AdminConfig`:

```tsx
it("Initialize Admin", async () => {
    const tx = await program.methods
      .initializeAdminConfig()
      .accounts({
        adminConfig: adminConfig,
        feeDestination: feeDestination,
        authority: wallet.publicKey,
        program: program.programId,
        programData: programDataAddress,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()

    assert.strictEqual(
      (
        await program.account.adminConfig.fetch(adminConfig)
      ).feeBasisPoints.toNumber(),
      100
    )
    assert.strictEqual(
      (await program.account.adminConfig.fetch(adminConfig)).admin.toString(),
      wallet.publicKey.toString()
    )
  })
```

Again, pretty straightforward. We are setting the intial states of the `AdminConfig` and the program that we have provided in our `Anchor.toml` (more on that in a minute).

Next, let's set up the `Payment` test instruction:

```tsx
it("Payment", async () => {
    try {
      const tx = await program.methods
        .payment(new anchor.BN(10000))
        .accounts({
          adminConfig: adminConfig,
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
        (await connection.getTokenAccountBalance(feeDestination)).value
          .uiAmount,
        100
      )

      assert.strictEqual(
        (await connection.getTokenAccountBalance(receiverTokenAccount)).value
          .uiAmount,
        9900
      )
    } catch (err) {
      console.log(err)
    }
  })
```

So for our test what the `Payment` instruction is doing here is creating a payment of `10000` from the `senderTokenAccount` to the `receiverTokenAccount`. It is then checking the balance of 3 accounts (`sender`, `receiver`, `feeDestination`). IF the program executes as expected then the following should be true:

- the `senderTokenAccount` should have `0` tokens remaining (because it sent them all)
- the `feeDestination` should have `100` tokens (because we set the `fee_basis_points` to .1%)
- the `receiverTokenAccount` should have `9900` (the original amount - the fee)


Ok cool, we are half way there with 2/4 tests complete, let's write the last two. The first one will attmempt to `Update Admin Config` using the `Admin` credentials, and the second will do the same except with the wrong credentials (for this test to pass, we expect the update to fail).

Let's dig in to the `Update Admin Config`:

```tsx
  it("Update Admin Config", async () => {
    const tx = await program.methods
      .updateAdminConfig(new anchor.BN(200))
      .accounts({
        adminConfig: adminConfig,
        admin: wallet.publicKey,
      })
      .rpc()

    assert.strictEqual(
      (
        await program.account.adminConfig.fetch(adminConfig)
      ).feeBasisPoints.toNumber(),
      200
    )
  })
```
Here we are updating the `feeBasisPoints` to `200` in the `AdminConfig` with the `admin` set to the `publickey` from the `wallet` provided in the `Anchor.toml` (we'll still get to that, hang tight).

If it executes as expected, after the update the program should have a new `feeBasisPoints` of `200`.

Now for the final test `Update Admin Config - expect fail` :

```tsx
  it("Update Admin Config - expect fail", async () => {
    try {
      const tx = await program.methods
        .updateAdminConfig(new anchor.BN(300))
        .accounts({
          adminConfig: adminConfig,
          admin: sender.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])
    } catch (err) {
      expect(err)
      // console.log(err)
    }
  })
```
With this final test, we are trying to update the `AdminConfig` just like before, but this time using `sender.publicKey`. Our program should not allow this, so if it "fails" then our test will "Pass".

### Build and Deploy

Ok great job! You have now written all of the necessary instructions and tests, but it's not quite ready to test. First we need to use Anchor to build and deploy the program, then we'll have to update the program id listed in two places.

First, let's go to that `Anchor.toml` we talked about earlier and set our wallet to the right location. Inside the `Anchor.toml` you should see:

```
wallet = "YOUR_WALLET_PATH_HERE"
```

Use `solana config get` to get the location of your `Keypair Path` and inject that where "YOUR_WALLET_PATH_HERE" is. Mine looks like:

```
wallet = "/home/matt/.config/solana/id.json"
```

Next, head back to the terminal. Make sure you are in your project directory and run:

```sh
anchor build
```

Once you see `Finished` you are ready to deploy! So to deploy on localhost, let's open up a 2nd tab in our terminal and start our local solana validator using:

```sh
solana-test-validator
```

You should see the validator turn on (make sure to turn off with `ctrl + c` when finished), head back to your first tab and now run:

```sh
anchor deploy
```

If you see you receive a `Error: RPC request error` it's most likely because your `solana-test-validator` isn't running, double check that. If successful you should see something like:

```sh
Program Id: 3cye9aV3D7qdoAp2a8QBs6wF6CvS2PYPWhxYhunAc4dS

Deploy success
```

Awesome! Now stop your `solana-test-validator` and copy that `Program Id`. Let's update our program in 2 places: `Anchor.toml` and `lib.rs`

`Anchor.toml`
```
[programs.localnet]
config = "3cye9aV3D7qdoAp2a8QBs6wF6CvS2PYPWhxYhunAc4dS"
```

`lib.rs`
```rust
declare_id!("3cye9aV3D7qdoAp2a8QBs6wF6CvS2PYPWhxYhunAc4dS");
```

Also, while you have your `lib.rs` open let's update the `ADMIN_PUBKEY` to the Wallet Address of your CLI (you can get that by running `solana address` in your terminal)

```rust
#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("YOUR_WALLET_ADDRESS_HERE");
```

To recap what we did here:

-We built and deployed the program with Anchor
-Took the deployed program Id
-Updated our program id referenced by our code so the test reads the right program (the one with `AdminConfig` set to our local wallet)

### Test

Final step! Let's test! To do this we'll use this command that skips the deploy command and uses the feature flag "local-testing":

```sh
anchor test --skip-deploy -- --features "local-testing"
```

If everything executes correctly your response should look like the following:

![Screenshot of Test Success](../assets/env-variables-test-success.png)

If needed, you can compare with the solution code here: [https://github.com/maweiche/admin-test/tree/starter](https://github.com/maweiche/admin-test/tree/solution).

Nice job, you now know how to create `env` type variables within a Solana Program!

# Challenge

*Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently.*

1. Challenge instruction one
2. Challenge instruction two
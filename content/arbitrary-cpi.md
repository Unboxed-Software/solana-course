# Arbitrary CPI

# Lesson Objectives

- Explain the security risks associated with invoking a CPI to an unknown program.
- Showcase how Anchor’s CPI module prevents this from happening when making a CPI from one Anchor program to another.
- Learn how to safely and securely make a CPI from an Anchor program to an arbitrary non-anchor program.

# TL;DR

- To generate a CPI, the target program must be passed into the invoking instruction as an account. This means that any program could be passed into the instruction and your program should detect when an incorrect or unexpected program is passed in.
- If a program is written in Anchor, then it may have a publicly available CPI module to make invoking the program from another Anchor program easy and secure. The Anchor CPI module automatically checks that the address of the program passed in matches the address of the program stored in the module.
- Non-Anchor programs do not have a CPI module available, so instructions must be invoked manually like you would in native Rust. In this case, you’ll have to verify the address of the program yourself beforehand.

# Overview

A cross program invocation (CPI) is when one program invokes an instruction on another program. An “arbitrary CPI” is when a CPI does not verify the address of the program it is invoking. Given that programs must be passed into instructions just like accounts, the addresses of programs must be verified in the same manner that accounts are. Failure to do so creates an opportunity for a malicious user to pass in a different program than expected, causing the original program to call an instruction on this mystery program. There’s no telling what the consequences of this CPI could be, it depends on the program logic (both of the original program and the unexpected program), as well as what other accounts are passed into the original instruction.

## CPI Module

You can make a CPI to any program in Solana, regardless if it’s written in Anchor or native Rust. [As we learned about in a previous lesson](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi.md), making a CPI from one Anchor program to another is pretty straightforward if the targeted program has a publicly available CPI module. The CPI module comes with a lot of features and one of them is verifying the Publickey of the program that’s passed into one of its public instructions.

Every Anchor program uses the `declare_id()` macro to define the address of the program. When a CPI module is generated for a specific program, it uses the address passed into this macro as the source of truth and will automatically verify that all CPIs made using its CPI module are targeting this program id. Anchor also has [created some wrappers for popular native programs](https://github.com/coral-xyz/anchor/tree/master/spl/src) so that Anchor programs can generate CPIs to them as if they were written in Anchor with a public CPI module. For some more information about how the CPI module works, checkout out this [blog post](https://blog.labeleven.dev/anatomy-of-solana-program-invocations-using-anchor) and this [question on the Solana Stack Exchange](https://solana.stackexchange.com/questions/2960/how-to-use-the-anchors-features-cpi). 

## Native CPI

So, thankfully, Anchor handles this if your making a CPI to an Anchor program and you have access to its CPI module - but what if that’s not the case? Then, you’ll have to construct the CPI manually using `invoke` and `invoked_signed`. These native Solana syscalls do not come with the added security and benefits that an Anchor CPI module does, so the onus is on the developer to ensure that their program cannot be taken advantage of to make a CPI to anything other than the intended program. There really is only one way to do this, the invoking program must have access to the `program_id` of the intended program and it must verify the address of the program passed in against that.

Depending on the program you’re making the CPI to you can either hard code the address of the `program_id` or use the program’s Rust crate to get the address of the program if available. Once you have access to the correct `program_id`, the easiest way to verify the program passed in is to use an Anchor constraint.

```rust
// example using the program's published Rust crate if available and it contains the program_id
use {
    anchor_lang::prelude::*,
    anchor_spl::{
        token::{Token},
    },
// import the program id from the program's Rust crate
    example_cpi_program::{
        ID as EXAMPLE_PROGRAM_ID,
    }
};

// or you can hard code the expected program_id
pub static HARD_CODE_PROGRAM_ID: Pubkey = pubkey!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

...

#[derive(Accounts)]
pub struct TestCtx<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    ///CHECK: safe because we verify this is the example_cpi_program program
    #[account(constraint = example_cpi_program.key() == EXAMPLE_PROGRAM_ID)]
    pub example_cpi_program: AccountInfo<'info>,
    // verify the second program address using the hard coded value
    #[account(constraint = second_example_cpi_program.key() == HARD_CODE_PROGRAM_ID)]
    pub second_example_cpi_program: AccountInfo<'info>,
    // use Anchor Token type to verify Token program
    pub token_program: Program<'info, Token>,
	// use Anchor System type to verify System program
    pub system_program: Program<'info, System>,
}
```

Depending on the program you’re making the CPI to, you may be able to use Anchor’s [`Program` account type](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) which is a type validating that the account is the given Program. Between the [`anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) and [`anchor_spl`](https://docs.rs/anchor_spl/latest/) crates, the following `Program` types are provided out of the box:

- [`System`](https://docs.rs/anchor-lang/latest/anchor_lang/struct.System.html)
- [`AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [`Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

# Demo

To see how this is done in action, we’re going to write a program that creates a Semi-Fungible Token using Metaplex. In order to do this, we must create a metadata account by making a CPI to the Metaplex metadata program. The metadata program is not written in Anchor and, until recently, did not have any Anchor wrappers written for it like the SPL Token program. It looks like [wrappers were just added to Anchor for the metadata](https://github.com/coral-xyz/anchor/blob/master/spl/src/metadata.rs) program a few months ago, but we won’t be using them for demonstration purposes of this lesson.

### 1. Setup

Clone this repo to your local machine.

```bash
git clone https://github.com/Unboxed-Software/solana-arbitrary-cpi.git
```

### 2. Implement `initialize_metadata` instruction

There will only be one instruction on this program - it will create a token mint and a corresponding metadata account so that any tokens minted from it will be considered “Sem-Fungible Tokens”. [Metaplex considers SFTs](https://docs.metaplex.com/programs/token-metadata/token-standard#the-fungible-asset-standard) (or Fungible Assets) to be tokens with 0 decimals and a supply ≥ 0. We’ll need to invoke the `create_metadata_accounts_v3` instruction on the Metadata program to create this. Paste the following code inside the `arbitrary_cpi` module of the program.

```rust
pub fn initialize_metadata(ctx: Context<InitializeMetadata>) -> Result<()> {
         // create metadata account
        let ix = create_metadata_accounts_v3(
            ctx.accounts.metadata_program.key(),
            ctx.accounts.metadata_account.key(),
            ctx.accounts.token_mint.key(),
            ctx.accounts.program_mint_authority.key(),
            ctx.accounts.authority.key(),
            ctx.accounts.program_mint_authority.key(),
            // pass these in as arguments
            "test token".to_string(),
            "TEST".to_string(),
            "test_uri".to_string(), 
            None,
            0,
            false,
            false,
            None,
            None,
            None
        );

        // program signer seeds
        let auth_bump = *ctx.bumps.get("program_mint_authority").unwrap();
        let auth_seeds = &[MINT_AUTHORITY_SEED.as_bytes(), &[auth_bump]];
        let signer = &[&auth_seeds[..]];

        // create metadata account for SFT
        solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.metadata_program.to_account_info(),
                ctx.accounts.metadata_account.to_account_info(),
                ctx.accounts.token_mint.to_account_info(),
                ctx.accounts.program_mint_authority.to_account_info(),
                ctx.accounts.authority.to_account_info()
            ],
            signer
        )?;

        msg!("Semi fungible token created!");

        Ok(())
    }
```

This program logic uses a helper function from the `mpl_token_metadata` crate that was imported to create an instruction. The instruction is then passed into `invoke_signed` with the necessary `account_info` objects and the signer seeds. There’s no verification on the program were making the CPI to in this code yet, we’ll add that in the Account struct.

### 3. `InitializeMetadata` struct

Replace the current `InitializeMetadata` struct with this.

```rust
#[derive(Accounts)]
pub struct InitializeMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    // mint for the Semi-Fungible Token
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = program_mint_authority,
    )]
    pub token_mint: Account<'info, Mint>,
    ///CHECK: program mint authority
    #[account(
        seeds = [MINT_AUTHORITY_SEED.as_bytes()],
        bump
    )]
    pub program_mint_authority: AccountInfo<'info>,
    ///CHECK: safe metadata account
    #[account(mut)]
    pub metadata_account: AccountInfo<'info>,
    ///CHECK: safe because we verify this is the metadata program
    #[account(constraint = metadata_program.key() == METADATA_PROGRAM_ID)]
    pub metadata_program: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

We use the `Program` account types to verify that the `token_program` and `system_program` accounts are what we expect. Note that the names of the accounts are simply variable names chosen by the creator of the program. Naming an account `token_progam` does not guarantee that the address passed into the instruction is for the SPL Token Program - Anchor’s `Program` type verifies that for us though.

We use `AccountInfo` for the `metadata_program` for demonstration purposes, this is how you would verify an arbitrary program that does not have Anchor wrapper/types created for it ([`Metadata` type was added recently](https://github.com/coral-xyz/anchor/blob/fad05805d8b3931169f1ca66253be310ce66ed2e/spl/src/metadata.rs#L546)). Then, we compare the address of the account passed in as `metadata_program` to what it should be (`METADATA_PROGRAM_ID`). The real ID of the metadata program was imported from the metadata crate.

```rust
use {
    anchor_lang::{prelude::*, solana_program},
    anchor_spl::{
        token::{Mint, Token},
    },
	// metadata crate
    mpl_token_metadata::{
        ID as METADATA_PROGRAM_ID,
        instruction::{create_metadata_accounts_v3}
    }
};
```

### 4. Test the program

A test has already been written for this program. You may have to change the ID in the `declare_id` macro to the ID generated when you run `anchor deploy`. Because the program is making a CPI to a another program that we did not write ourselves, you have to run your tests on Devnet because the metadata program is deployed there. After changing the ID stored in the `declare_id` macro, make sure you CLI wallet has enough devnet sol and run `anchor test`.

The Anchor `Program` types guarantee that the `token_program` and `system_program` are the real SPL programs. We use an Anchor constraint to verify that we’re making a CPI to the real Metaplex metadata program, preventing a malicious user from manipulating the program to make a CPI to the wrong program.
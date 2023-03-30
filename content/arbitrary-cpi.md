---
title: Arbitrary CPI
objectives:
- Explain the security risks associated with invoking a CPI to an unknown program
- Showcase how Anchor’s CPI module prevents this from happening when making a CPI from one Anchor program to another
- Safely and securely make a CPI from an Anchor program to an arbitrary non-anchor program
---

# TL;DR

- To generate a CPI, the target program must be passed into the invoking instruction as an account. This means that any target program could be passed into the instruction. Your program should check for incorrect or unexpected programs.
- Perform program checks in native programs by simply comparing the public key of the passed-in program to the progam you expected.
- If a program is written in Anchor, then it may have a publicly available CPI module. This makes invoking the program from another Anchor program simple and secure. The Anchor CPI module automatically checks that the address of the program passed in matches the address of the program stored in the module.

# Overview

A cross program invocation (CPI) is when one program invokes an instruction on another program. An “arbitrary CPI” is when a program is structured to issue a CPI to whatever program is passed into the instruction rather than expecting to perform a CPI to one specific program. Given that the callers of your program's instruction can pass any program they'd like into the instruction's list of accounts, failing to verify the address of a passed-in program results in your program performing CPIs to arbitrary programs.

This lack of program checks creates an opportunity for a malicious user to pass in a different program than expected, causing the original program to call an instruction on this mystery program. There’s no telling what the consequences of this CPI could be. It depends on the program logic (both that of the original program and the unexpected program), as well as what other accounts are passed into the original instruction.

## Missing program checks

Take the following program as an example. The `cpi` instruction invokes the `transfer` instruction on `token_program`, but there is no code that checks whether or not the `token_program` account passed into the instruction is, in fact, the SPL Token Program.

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_insecure {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        solana_program::program::invoke(
            &spl_token::instruction::transfer(
                ctx.accounts.token_program.key,
                ctx.accounts.source.key,
                ctx.accounts.destination.key,
                ctx.accounts.authority.key,
                &[],
                amount,
            )?,
            &[
                ctx.accounts.source.clone(),
                ctx.accounts.destination.clone(),
                ctx.accounts.authority.clone(),
            ],
        )
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: UncheckedAccount<'info>,
    destination: UncheckedAccount<'info>,
    authority: UncheckedAccount<'info>,
    token_program: UncheckedAccount<'info>,
}
```

An attacker could easily call this instruction and pass in a duplicate token program that they created and control.

## Add program checks

It's possible to fix this vulnerabilty by simply adding a few lines to the `cpi` instruction to check whether or not `token_program`'s public key is that of the SPL Token Program.

```rust
pub fn cpi_secure(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
    if &spl_token::ID != ctx.accounts.token_program.key {
        return Err(ProgramError::IncorrectProgramId);
    }
    solana_program::program::invoke(
        &spl_token::instruction::transfer(
            ctx.accounts.token_program.key,
            ctx.accounts.source.key,
            ctx.accounts.destination.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?,
        &[
            ctx.accounts.source.clone(),
            ctx.accounts.destination.clone(),
            ctx.accounts.authority.clone(),
        ],
    )
}
```

Now, if an attacker passes in a different token program, the instruction will return the `ProgramError::IncorrectProgramId` error.

Depending on the program you’re invoking with your CPI, you can either hard code the address of the expected program ID or use the program’s Rust crate to get the address of the program, if available. In the example above, the `spl_token` crate provides the address of the SPL Token Program.

## Use an Anchor CPI module

A simpler way to manage program checks is to use Anchor CPI modules. We learned in a [previous lesson](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi.md) that Anchor can automatically generate CPI modules to make CPIs into the program simpler. These modules also enhance security by verifying the public key of the program that’s passed into one of its public instructions.

Every Anchor program uses the `declare_id()` macro to define the address of the program. When a CPI module is generated for a specific program, it uses the address passed into this macro as the "source of truth" and will automatically verify that all CPIs made using its CPI module target this program id.

While at the core no different than manual program checks, using CPI modules avoids the possibility of forgetting to perform a program check or accidentally typing in the wrong program ID when hard-coding it.

The program below shows an example of using a CPI module for the SPL Token Program to perform the transfer shown in the previous examples.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_recommended {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.transfer_ctx(), amount)
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: Account<'info, TokenAccount>,
    destination: Account<'info, TokenAccount>,
    authority: Signer<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> Cpi<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.source.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

Note that, like the example above, Anchor has created a few [wrappers for popular native programs](https://github.com/coral-xyz/anchor/tree/master/spl/src) that allow you to issue CPIs into them as if they were Anchor programs.

Additionally and depending on the program you’re making the CPI to, you may be able to use Anchor’s [`Program` account type](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) to validate the passed-in program in your account validation struct. Between the [`anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) and [`anchor_spl`](https://docs.rs/anchor_spl/latest/) crates, the following `Program` types are provided out of the box:

- [`System`](https://docs.rs/anchor-lang/latest/anchor_lang/struct.System.html)
- [`AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [`Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

If you have access to an Anchor program's CPI module, you typically can import its program type with the following, replacing the program name with the name of the actual program:

```rust
use other_program::program::OtherProgram;
```

# Demo

To show the importance of checking with program you use for CPIs, we're going to work with a simplified and somewhat contrived game. This game represents characters with PDA accounts, and uses a separate "metadata" program to manage character metadata and attributes like health and power.

While this example is somewhat contrived, it's actually almost identical architecture to how NFTs on Solana work: the SPL Token Program manages the token mints, distribution, and transfers, and a separate metadata program is used to assign metadata to tokens. So the vulnerability we go through here could also be applied to real tokens.

### 1. Setup

We'll start with the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter). Clone the repository and then open it on the `starter` branch.

Notice that there are three programs:

1. `gameplay`
2. `character-metadata`
3. `fake-metadata`

Additionally, there is already a test in the `tests` directory.

The first program, `gameplay`, is the one that our test directly uses. Take a look at the program. It has two instructions:

1. `create_character_insecure` - creates a new character and CPI's into the metadata program to set up the character's initial attributes
2. `battle_insecure` - pits two characters against each other, assigning a "win" to the character with the highest attributes

The second program, `character-metadata`, is meant to be the "approved" program for handling character metadata. Have a look at this program. It has a single instruction for `create_metadata` that creates a new PDA and assigns a pseudo-random value between 0 and 20 for the character's health and power.

The last program, `fake-metadata` is a "fake" metadata program meant to illustrate what an attacker might make to exploit our `gameplay` program. This program is almost identical to the `character-metadata` program, only it assigns a character's initial health and power to be the max allowed: 255.

### 2. Test `create_character_insecure` instruction

There is already a test in the `tests` directory for this. It's long, but take a minute to look at it before we talk through it together:

```ts
it("Insecure instructions allow attacker to win every time", async () => {
    // Initialize player one with real metadata program
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: metadataProgram.programId,
        authority: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc()

    // Initialize attacker with fake metadata program
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: fakeMetadataProgram.programId,
        authority: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    // Fetch both player's metadata accounts
    const [playerOneMetadataKey] = getMetadataKey(
      playerOne.publicKey,
      gameplayProgram.programId,
      metadataProgram.programId
    )

    const [attackerMetadataKey] = getMetadataKey(
      attacker.publicKey,
      gameplayProgram.programId,
      fakeMetadataProgram.programId
    )

    const playerOneMetadata = await metadataProgram.account.metadata.fetch(
      playerOneMetadataKey
    )

    const attackerMetadata = await fakeMetadataProgram.account.metadata.fetch(
      attackerMetadataKey
    )

    // The regular player should have health and power between 0 and 20
    expect(playerOneMetadata.health).to.be.lessThan(20)
    expect(playerOneMetadata.power).to.be.lessThan(20)

    // The attacker will have health and power of 255
    expect(attackerMetadata.health).to.equal(255)
    expect(attackerMetadata.power).to.equal(255)
})
```

This test effectively walks through the scenario where a regular player and an attacker both create their characters. Only the attacker passes in the program ID of the fake metadata program rather than the actual metadata program. And since the `create_character_insecure` instruction has no program checks, it still executes.

The result is that the regular character has the appropriate amount of health and power: each a value between 0 and 20. But the attacker's health and power are each 255, making the attacker unbeatable.

If you haven't already, run `anchor test` to see that this test in fact behaves as described.

### 3. Create a `create_character_secure` instruction

Let's fix this by creating a secure instruction for creating a new character. This instruction should implement proper program checks and use the `character-metadata` program's `cpi` crate to do the CPI rather than just using `invoke`.

If you want to test out your skills, try this on your own before moving ahead.

We'll start by updating our `use` statement at the top of the `gameplay` programs `lib.rs` file. We're giving ourselves access to the program's type for account validation, and the helper function for issuing the `create_metadata` CPI.

```rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

Next let's create a new account validation struct called `CreateCharacterSecure`. This time, we make `metadata_program` a `Program` type:

```rust
#[derive(Accounts)]
pub struct CreateCharacterSecure<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 64,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub character: Account<'info, Character>,
    #[account(
        mut,
        seeds = [character.key().as_ref()],
        seeds::program = metadata_program.key(),
        bump,
    )]
    /// CHECK: manual checks
    pub metadata_account: AccountInfo<'info>,
    pub metadata_program: Program<'info, CharacterMetadata>,
    pub system_program: Program<'info, System>,
}
```

Lastly, we add the `create_character_secure` instruction. It will be the same as before but will use the full functionality of Anchor CPIs rather than using `invoke` directly:

```rust
pub fn create_character_secure(ctx: Context<CreateCharacterSecure>) -> Result<()> {
    let character = &mut ctx.accounts.character;
    character.metadata = ctx.accounts.metadata_account.key();
    character.auth = ctx.accounts.authority.key();
    character.wins = 0;

    let context = CpiContext::new(
        ctx.accounts.metadata_program.to_account_info(),
        CreateMetadata {
            character: ctx.accounts.character.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_owned(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );

    create_metadata(context)?;

    Ok(())
}
```

### 4. Test `create_character_secure`

Now that we have a secure way of initializing a new character, let's create a new test. This test just needs to attempt to initialize the attacker's character and expect an error to be thrown.

```ts
it("Secure character creation doesn't allow fake program", async () => {
    try {
      await gameplayProgram.methods
        .createCharacterSecure()
        .accounts({
          metadataProgram: fakeMetadataProgram.programId,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      expect(error)
      console.log(error)
    }
})
```

Run `anchor test` if you haven't already. Notice that an error was thrown as expected, detailing that the program ID passed into the instruction is not the expected program ID:

```bash
'Program log: AnchorError caused by account: metadata_program. Error Code: InvalidProgramId. Error Number: 3008. Error Message: Program ID was not as expected.',
'Program log: Left:',
'Program log: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'Program log: Right:',
'Program log: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

That's all you need to do to protect against arbitrary CPIs!

There may be times where you want more flexibility in your program's CPIs. We certainly won't stop you from architecting the program you need, but please take every precaution possible to ensure no vulnerabilities in your program.

If you want to take a look at the final solution code you can find it on the `solution` branch of [the same repository](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution).

# Challenge

Just as with other lessons in this module, your opportunity to practice avoiding this security exploit lies in auditing your own or other programs.

Take some time to review at least one program and ensure that program checks are in place for every program passed into the instructions, particularly those that are invoked via CPI.

Remember, if you find a bug or exploit in somebody else's program, please alert them! If you find one in your own program, be sure to patch it right away.

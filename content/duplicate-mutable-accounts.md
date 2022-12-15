# Duplicate Mutable Accounts

# Lesson Objectives

- Explain the security risks associated with instructions that require two mutable accounts of the same type and how to avoid them
- Implement a check for duplicate mutable accounts using long-form Rust
- Implement a check for duplicate mutable accounts using Anchor constraints

# TL;DR

- When an instruction requires two mutable accounts of the same type, an attacker can pass in the same account twice, causing the account to be mutated in unintended ways.
- To check for duplicate mutable accounts in Rust, simply compare the public keys of the two accounts and throw an error if they are the same.
    
    ```rust
    if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
        return Err(ProgramError::InvalidArgument)
    }
    ```
- In Anchor, you can use `constraint` to add an explicit constraint to an account checking that it is not the same as another account.

# Overview

Duplicate Mutable Accounts refers to an instruction that requires two mutable accounts of the same type. When this occurs, you should validate that two accounts are different to prevent the same account from being passed into the instruction twice.

Since the program treats each account as separate, passing in the same account twice could result in the second account being mutated in unintended ways. This could result in very minor issues, or catastrophic ones - it really depends on what data the code changes and how these accounts are used. Regardless, this is a vulnerability all developers should be aware of.

### No check

For example, imagine a program that updates a `data` field for `user_a` and `user_b` in a single instruction. The value that the instruction sets for `user_a` is different from `user_b`. Without verifying that `user_a` and `user_b` are different, the program would update the `data` field on the `user_a` account, then update the `data` field a second time with a different value under the assumption that `user_b` is a separate account.

You can see this example in the code below.Tthere is no check to verify that `user_a` and `user_b` are not the same account. Passing in the same account for `user_a` and `user_b` will result in the `data` field for the account being set to `b` even though the intent is to set both values `a` and `b` on separate accounts. Depending on what `data` represents, this could be a minor unintended side-effect, or it could mean a severe security risk. allowing `user_a` and `user_b` to be the same account could result in 

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_insecure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### Add check in instruction

To fix this problem with plan Rust, simply add a check in the instruction logic to verify that the public key of `user_a` isn't the same as the public key of `user_b`, returning an error if they are the same.

```rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

This check ensures that `user_a` and `user_b` are not the same account.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_secure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
            return Err(ProgramError::InvalidArgument.into())
        }
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### Use Anchor `constraint`

An even better solution if you're using Anchor is to add the check to the account validation struct instead of the instruction logic. 

You can use the `#[account(..)]` attribute macro and the `constraint` keyword to add a manual constraint to an account. The `constraint` keyword will check whether the expression that follows evaluates to true or false, returning an error if the expression evaluates to false.

The example below moves the check from the instruction logic to the account validation struct by adding a `constraint` to the `#[account(..)]` attribute. 

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_recommended {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(constraint = user_a.key() != user_b.key())]
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

# Demo

Let’s practice by creating a simple program to demonstrate how failing to check for duplicate mutable accounts can allow an instruction to be used in an unintended way.

This program will initialize “player” accounts and have a separate instruction that requires two player accounts to represent starting a game.

- An `initialize` instruction to initialize `PlayerState` account
- An `insecure_start_game` instruction that requires two `PlayerState` accounts, but does not check that the accounts passed into the instruction are different
- A `secure_start_game` instruction that is the same as the `insecure_start_game` instruction but adds a constraint that ensures the two player accounts are different

### 1. Starter

To get started, download the starter code on the `starter` branch of [this repository](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter). The starter code includes a program with two instructions and the boilerplate setup for the test file. 

The `initialize` instruction initializes a new `PlayerState` account that stores the public key of a player and a count of games played.

The `insecure_start_game` instruction requires two `PlayerState` accounts and increments the games played for each account, but does not check that the accounts passed into the instruction are different. This means a single account can be used for both `PlayerState` accounts in the instruction.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.new_player.player = ctx.accounts.payer.key();
        ctx.accounts.new_player.games_played = 0;
        Ok(())
    }

    pub fn insecure_start_game(ctx: Context<InsecureGameStart>) -> Result<()> {
        ctx.accounts.player_one.games_played =
            ctx.accounts.player_one.games_played.checked_add(1).unwrap();

        ctx.accounts.player_two.games_played =
            ctx.accounts.player_two.games_played.checked_add(1).unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8
    )]
    pub new_player: Account<'info, PlayerState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InsecureGameStart<'info> {
    #[account(mut)]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}

#[account]
pub struct PlayerState {
    player: Pubkey,
    games_played: u64,
}
```

### 2. Test `insecure_start_game` instruction

The test file includes the code to invoke the `initialize` instruction twice to create two player accounts.

Add a test to invoke the `insecure_start_game` instruction by passing in the `playerOne.publicKey` for as both `playerOne` and `playerTwo`.

```rust
describe("duplicate-mutable-accounts", () => {
	...
	it("Invoke insecure instruction", async () => {
    await program.methods
      .insecureStartGame()
      .accounts({
        playerOne: playerOne.publicKey,
        playerTwo: playerOne.publicKey,
      })
      .rpc()
  })
})
```

Run `anchor test` to see that the transactions completes successfully, even though the same account is used as two accounts in the instruction.

```bash
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

### 3. Add `secure_start_game` instruction

Next, return to `lib.rs` and add a `secure_start_game` instruction that use the `#[account(...)]` macro to add an additional `constraint` to check that `player_one` and `player_two` are different accounts.

```rust
#[program]
pub mod duplicate_mutable_accounts {
    use super::*;
		...
		pub fn secure_start_game(ctx: Context<SecureGameStart>) -> Result<()> {
        ctx.accounts.player_one.games_played =
            ctx.accounts.player_one.games_played.checked_add(1).unwrap();

        ctx.accounts.player_two.games_played =
            ctx.accounts.player_two.games_played.checked_add(1).unwrap();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SecureGameStart<'info> {
    #[account(
        mut,
        constraint = player_one.key() != player_two.key())]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}
```

### 7. Test `secure_start_game` instruction

To test the `secure_start_game` instruction, we’ll invoke the instruction twice. First, we’ll invoke the instruction using the `playerOne.publicKey` as both player accounts, which we expect to fail. Then, we’ll invoke the instruction using two different player accounts to check that the instruction works as intended.

```rust
describe("duplicate-mutable-accounts", () => {
	...

	it("Invoke secure instruction, expect error", async () => {
    try {
      await program.methods
        .secureStartGame()
        .accounts({
          playerOne: playerOne.publicKey,
          playerTwo: playerOne.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Invoke secure instruction", async () => {
    await program.methods
      .secureStartGame()
      .accounts({
        playerOne: playerOne.publicKey,
        playerTwo: playerTwo.publicKey,
      })
      .rpc()
  })
})
```

Run `anchor test` to see that the instruction using the `playerOne` twice returns the expected error.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: SecureStartGame',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 4795 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'g6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: invalid program argument'
```

```rust
✔ Invoke secure instruction, expect error
✔ Invoke secure instruction (373ms)
```
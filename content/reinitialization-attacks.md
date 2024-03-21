---
title: Reinitialization Attacks
objectives:
- Explain security risks associated with a reinitialization vulnerability
- Use long-form Rust check if an account has already been initialized
- Using Anchor’s `init` constraint to initialize accounts, which automatically sets an account discriminator that is checked to prevent the reinitialization of an account
---

# Summary

- Use an account discriminator or initialization flag to check whether an account has already been initialized to prevent an account from being reinitialized and overriding existing account data.
- To prevent account reinitialization in plain Rust, initialize accounts with an `is_initialized` flag and check if it has already been set to true when initializing an account
  ```rust
  if account.is_initialized {
      return Err(ProgramError::AccountAlreadyInitialized.into());
  }
  ```
- To simplify this, use Anchor’s `init` constraint to create an account via a CPI to the system program and sets its discriminator

# Lesson

Initialization refers to setting the data of a new account for the first time. When initializing a new account, you should implement a way to check if the account has already been initialized. Without an appropriate check, an existing account could be reinitialized and have existing data overwritten.

Note that initializing an account and creating an account are two separate instructions. Creating an account requires invoking the `create_account` instruction on the System Program which specifies the space required for the account, the rent in lamports allocated to the account, and the program owner of the account. Initialization is an instruction that sets the data of a newly created account. Creating and initializing an account can be combined into a single transaction.

### Missing Initialization Check

In the example below, there are no checks on the `user` account. The `initialize` instruction deserializes the data of the `user` account as a `User` account type, sets the `authority` field, and serializes the updated account data to the `user` account.

Without checks on the `user` account, the same account could be passed into the `initialize` instruction a second time by another party to overwrite the existing `authority` stored on the account data.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_insecure  {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### Add `is_initialized` check

One approach to fix this is to add an additional `is_initialized` field to the `User` account type and use it as a flag to check if an account has already been initialized.

```rust
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

By including a check within the `initialize` instruction, the `user` account would only be initialized if the `is_initialized` field has not yet been set to true. If the `is_initialized` field was already set, the transaction would fail, thereby avoiding the scenario where an attacker could replace the account authority with their own public key.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_secure {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        if user.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        user.authority = ctx.accounts.authority.key();
        user.is_initialized = true;

        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    is_initialized: bool,
    authority: Pubkey,
}
```

### Use Anchor’s `init` constraint

Anchor provides an `init` constraint that can be used with the `#[account(...)]` attribute to initialize an account. The `init` constraint creates the account via a CPI to the system program and sets the account discriminator.

The `init` constraint must be used in combination with the `payer` and `space` constraints. The `payer` specifies the account paying for the initialization of the new account. The `space` specifies the amount of space the new account requires, which determines the amount of lamports that must be allocated to the account. The first 8 bytes of data is set as a discriminator that Anchor automatically adds to identify the account type.

Most importantly for this lesson, the `init` constraint ensures that this instruction can only be called once per account, so you can set the initial state of the account in the instruction logic and not have to worry about an attacker trying to reinitialize the account.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_recommended {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("GM");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct User {
    authority: Pubkey,
}
```

### Anchor’s `init_if_needed` constraint

It’s worth noting that Anchor has an `init_if_needed` constraint. This constraint should be used very cautiously. In fact, it is blocked behind a feature flag so that you are forced to be intentional about using it.

The `init_if_needed` constraint does the same thing as the `init` constraint, only if the account has already been initialized the instruction will still run.

Given this, it’s *********extremely********* important that when you use this constraint you include checks to avoid resetting the account to its initial state.

For example, if the account stores an `authority` field that gets set in the instruction using the `init_if_needed` constraint, you need checks that ensure that no attacker could call the instruction after it has already been initialized and have the `authority` field set again.

In most cases, it’s safer to have a separate instruction for initializing account data.

# Lab

For this lab we’ll create a simple program that does nothing but initialize accounts. We’ll include two instructions:

- `insecure_initialization` - initializes an account that can be reinitialized
- `recommended_initialization` - initialize an account using Anchor’s `init` constraint

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter). The starter code includes a program with one instruction and the boilerplate setup for the test file. 

The `insecure_initialization` instruction initializes a new `user` account that stores the public key of an `authority`. In this instruction, the account is expected to be allocated client-side, then passed into the program instruction. Once passed into the program, there are no checks to see if the `user` account's initial state has already been set. This means the same account can be passed in a second time to override the `authority` stored on an existing `user` account.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;

    pub fn insecure_initialization(ctx: Context<Unchecked>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    #[account(mut)]
    /// CHECK:
    user: UncheckedAccount<'info>,
    authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### 2. Test `insecure_initialization` instruction

The test file includes the setup to create an account by invoking the system program and then invokes the `insecure_initialization` instruction twice using the same account. 

Since there are no checks the verify that the account data has not already been initialized, the `insecure_initialization` instruction will complete successfully both times, despite the second invocation providing a *different* authority account.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { Initialization } from "../target/types/initialization"

describe("initialization", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Initialization as Program<Initialization>

  const wallet = anchor.workspace.Initialization.provider.wallet
  const walletTwo = anchor.web3.Keypair.generate()

  const userInsecure = anchor.web3.Keypair.generate()
  const userRecommended = anchor.web3.Keypair.generate()

  before(async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: userInsecure.publicKey,
        space: 32,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          32
        ),
        programId: program.programId,
      })
    )

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      wallet.payer,
      userInsecure,
    ])

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletTwo.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Insecure init", async () => {
    await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
      })
      .rpc()
  })

  it("Re-invoke insecure init with different auth", async () => {
    const tx = await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
        authority: walletTwo.publicKey,
      })
      .transaction()
    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletTwo,
    ])
  })
})
```

Run `anchor test` to see that both transactions will complete successfully.

```bash
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

### 3. Add `recommended_initialization` instruction

Let's create a new instruction called `recommended_initialization` that fixes this problem. Unlike the previous insecure instruction, this instruction should handle both the creation and initialization of the user's account using Anchor's `init` constraint.

This constraint instructs the program to create the account via a CPI to the system program, so the account no longer needs to be created client-side. The constraint also sets the account discriminator. Your instruction logic can then set the account's initial state.

By doing this, you ensure that any subsequent invocation of the same instruction with the same user account will fail rather than reset the account's initial state.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;
		...
    pub fn recommended_initialization(ctx: Context<Checked>) -> Result<()> {
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}
```

### 4. Test `recommended_initialization` instruction

To test the `recommended_initialization` instruction, we’ll invoke the instruction twice just like before. This time, we expect the transaction to fail when we try to initialize the same account a second time. 

```tsx
describe("initialization", () => {
  ...
  it("Recommended init", async () => {
    await program.methods
      .recommendedInitialization()
      .accounts({
        user: userRecommended.publicKey,
      })
      .signers([userRecommended])
      .rpc()
  })

  it("Re-invoke recommended init with different auth, expect error", async () => {
    try {
      // Add your test here.
      const tx = await program.methods
        .recommendedInitialization()
        .accounts({
          user: userRecommended.publicKey,
          authority: walletTwo.publicKey,
        })
        .transaction()
      await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
        walletTwo,
        userRecommended,
      ])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Run `anchor test` and to see that the second transaction which tries to initialize the same account twice will now return an error stating the account address is already in use.

```bash
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

If you use Anchor's `init` constraint, that's usually all you need to protect against reinitialization attacks! Remember, just because the fix for these security exploits is simple doesn't mean it isn't important. Every time your initialize an account, make sure you're either using the `init` constraint or have some other check in place to avoid resetting an existing account's initial state.

If you want to take a look at the final solution code you can find it on the `solution` branch of [this repository](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution).

# Challenge

Just as with other lessons in this unit, your opportunity to practice avoiding this security exploit lies in auditing your own or other programs.

Take some time to review at least one program and ensure that instructions are properly protected against reinitialization attacks.

Remember, if you find a bug or exploit in somebody else's program, please alert them! If you find one in your own program, be sure to patch it right away.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=652c68aa-18d9-464c-9522-e531fd8738d5)!
---
title: Account Data Matching
objectives:
- Explain the security risks associated with missing data validation checks
- Implement data validation checks using long-form Rust
- Implement data validation checks using Anchor constraints
---

# TL;DR

- Use **data validation checks** to verify that account data matches an expected value**.** Without appropriate data validations checks, unexpected accounts may be used in an instruction.
- To implement data validations checks in Rust, simply compare the data stored on an account to an expected value.
    
    ```rust
    if ctx.accounts.user.key() != ctx.accounts.user_data.user {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```
    
- In Anchor, you can use `constraint` to checks whether the given expression evaluates to true. Alternatively, you can use `has_one` to check that a target account field stored on the account matches the key of an account in the `Accounts` struct.

# Overview

Account data matching refers to data validation checks used to verify the data stored on an account matches an expected value. Data validation checks provide a way to include additional constraints to ensure the appropriate accounts are passed into an instruction. 

This can be useful when accounts required by an instruction have dependencies on values stored in other accounts or if an instruction is dependent on the data stored in an account.

### Missing data validation check

The example below includes an `update_admin` instruction that updates the `admin` field stored on an `admin_config` account. 

The instruction is missing a data validation check to verify the `admin` account signing the transaction matches the `admin` stored on the `admin_config` account. This means any account signing the transaction and passed into the instruction as the `admin` account can update the `admin_config` account.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Add data validation check

The basic Rust approach to solve this problem is to simply compare the passed in `admin` key to the `admin` key stored in the `admin_config` account, throwing an error if they don’t match.

```rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

By adding a data validation check, the `update_admin` instruction would only process if the `admin` signer of the transaction matched the `admin` stored on the `admin_config` account.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
      if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Use Anchor constraints

Anchor simplifies this with the `has_one` constraint. You can use the `has_one` constraint to move the data validation check from the instruction logic to the `UpdateAdmin` struct.

In the example below, `has_one = admin` specifies that the `admin` account signing the transaction must match the `admin` field stored on the `admin_config` account. To use the `has_one` constraint, the naming convention of the data field on the account must be consistent with the naming on the account validation struct. 

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

Alternatively, you can use `constraint` to manually add an expression that must evaluate to true in order for execution to continue. This is useful when for some reason naming can’t be consistent or when you need a more complex expression to fully validate the incoming data.

```rust
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        constraint = admin_config.admin == admin.key()
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}
```

# Demo

For this demo we’ll create a simple “vault” program similar to the program we used in the Signer Authorization lesson and the Owner Check lesson. Similar to those demos, we’ll show in this demo how a missing data validation check could allow the vault to be drained.

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-account-data-matching). The starter code includes a program with two instructions and the boilerplate setup for the test file. 

The `initialize_vault` instruction initializes a new `Vault` account and a new `TokenAccount`. The `Vault` account will store the address of a token account, the authority of the vault, and a withdraw destination token account.

The authority of the new token account will be set as the `vault`, a PDA of the program. This allows the `vault` account to sign for the transfer of tokens from the token account. 

The `insecure_withdraw` instruction transfers all the tokens in the `vault` account’s token account to a `withdraw_destination` token account. 

Notice that this instruction ****does**** have a signer check for `authority` and an owner check for `vault`. However, nowhere in the account validation or instruction logic is there code that checks that the `authority` account passed into the instruction matches the `authority` account on the `vault`.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        ctx.accounts.vault.withdraw_destination = ctx.accounts.withdraw_destination.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
    withdraw_destination: Pubkey,
}
```

### 2. Test `insecure_withdraw` instruction

To prove that this is a problem, let’s write a test where an account other than the vault’s `authority` tries to withdraw from the vault.

The test file includes the code to invoke the `initialize_vault` instruction using the provider wallet as the `authority` and then mints 100 tokens to the `vault` token account.

Add a test to invoke the `insecure_withdraw` instruction. Use `withdrawDestinationFake` as the `withdrawDestination` account and `walletFake` as the `authority`. Then send the transaction using `walletFake`.

Since there are no checks the verify the `authority` account passed into the instruction matches the values stored on the `vault` account initialized in the first test, the instruction will process successfully and the tokens will be transferred to the `withdrawDestinationFake` account.

```tsx
describe("account-data-matching", () => {
  ...
  it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Run `anchor test` to see that both transactions will complete successfully.

```bash
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

### 3. Add `secure_withdraw` instruction

Let’s go implement a secure version of this instruction called `secure_withdraw`.

This instruction will be identical to the `insecure_withdraw` instruction, except we’ll use the `has_one` constraint in the account validation struct (`SecureWithdraw`) to check that the `authority` account passed into the instruction matches the `authority` account on the `vault` account. That way only the correct authority account can withdraw the vault’s tokens.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;
    ...
    pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
        has_one = token_account,
        has_one = authority,
        has_one = withdraw_destination,

    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Test `secure_withdraw` instruction

Now let’s test the `secure_withdraw` instruction with two tests: one that uses `walletFake` as the authority and one that uses `wallet` as the authority. We expect the first invocation to return an error and the second to succeed.

```tsx
describe("account-data-matching", () => {
  ...
  it("Secure withdraw, expect error", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Secure withdraw", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestination,
        authority: wallet.publicKey,
      })
      .rpc()

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Run `anchor test` to see that the transaction using an incorrect authority account will now return an Anchor Error  while the transaction using correct accounts completes successfully.

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.',
'Program log: Left:',
'Program log: DfLZV18rD7wCQwjYvhTFwuvLh49WSbXFeJFPQb5czifH',
'Program log: Right:',
'Program log: 5ovvmG5ntwUC7uhNWfirjBHbZD96fwuXDMGXiyMwPg87',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 10401 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d1'
```

Note that Anchor specifies in the logs the account that causes the error (`AnchorError caused by account: vault`).

```bash
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

And just like that, you've closed up the security loophole. The theme across most of these potential exploits is that they're quite simple. However, as your programs grow in scope and complexity, it becomse increasingly easy to miss possible exploits. It's great to get in a habit of writing tests that send instructions that *shouldn't* work. The more the better. That way you catch problems before you deploy.

If you want to take a look at the final solution code you can find it on the `solution` branch of [the repository](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution).

# Challenge

Just as with other lessons in this module, your opportunity to practice avoiding this security exploit lies in auditing your own or other programs.

Take some time to review at least one program and ensure that proper data checks are in place to avoid security exploits.

Remember, if you find a bug or exploit in somebody else's program, please alert them! If you find one in your own program, be sure to patch it right away.
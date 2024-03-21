---
title: Signer Authorization
objectives:
- Explain the security risks associated with not performing appropriate signer checks
- Implement signer checks using long-form Rust
- Implement signer checks using Anchor’s `Signer` type
- Implement signer checks using Anchor’s `#[account(signer)]` constraint
---

# Summary

- Use **Signer Checks** to verify that specific accounts have signed a transaction. Without appropriate signer checks, accounts may be able to execute instructions they shouldn’t be authorized to perform.
- To implement a signer check in Rust, simply check that an account’s `is_signer` property is `true`
    
    ```rust
    if !ctx.accounts.authority.is_signer {
    	return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```
    
- In Anchor, you can use the **`Signer`** account type in your account validation struct to have Anchor automatically perform a signer check on a given account
- Anchor also has an account constraint that will automatically verify that a given account has signed a transaction

# Lesson

Signer checks are used to verify that a given account’s owner has authorized a transaction. Without a signer check, operations whose execution should be limited to only specific accounts can potentially be performed by any account. In the worst case scenario, this could result in wallets being completely drained by attackers passing in whatever account they want to an instruction.

### Missing Signer Check

The example below shows an oversimplified version of an instruction that updates the `authority` field stored on a program account. 

Notice that the `authority` field on the `UpdateAuthority` account validation struct is of type `AccountInfo`. In Anchor, the `AccountInfo` account type indicates that no checks are performed on the account prior to instruction execution.

Although the `has_one` constraint is used to validate the `authority` account passed into the instruction matches the `authority` field stored on the `vault` account, there is no check to verify the `authority` account authorized the transaction.

This means an attacker can simply pass in the public key of the `authority` account and their own public key as the `new_authority` account to reassign themselves as the new authority of the `vault` account. At that point, they can interact with the program as the new authority.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod insecure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
   #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Add signer authorization checks

All you need to do to validate that the `authority` account signed is to add a signer check within the instruction. That simply means checking that `authority.is_signer` is `true`, and returning a `MissingRequiredSignature` error if `false`.

```tsx
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

By adding a signer check, the instruction would only process if the account passed in as the `authority` account also signed the transaction. If the transaction was not signed by the account passed in as the `authority` account, then the transaction would fail.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
            if !ctx.accounts.authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }

        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### Use Anchor’s `Signer` account type

However, putting this check into the instruction function muddles the separation between account validation and instruction logic.

Fortunately, Anchor makes it easy to perform signer checks by providing the `Signer` account type. Simply change the `authority` account’s type in the account validation struct to be of type `Signer`, and Anchor will check at runtime that the specified account is a signer on the transaction. This is the approach we generally recommend since it allows you to separate the signer check from instruction logic.

In the example below, if the `authority` account does not sign the transaction, then the transaction will fail before even reaching the instruction logic. 

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Note that when you use the `Signer` type, no other ownership or type checks are performed.

### Use Anchor’s `#[account(signer)]` constraint

While in most cases, the `Signer` account type will suffice to ensure an account has signed a transaction, the fact that no other ownership or type checks are performed means that this account can’t really be used for anything else in the instruction.

This is where the `signer` *constraint* comes in handy. The `#[account(signer)]` constraint allows you to verify the account signed the transaction, while also getting the benefits of using the `Account` type if you wanted access to it’s underlying data as well. 

As an example of when this would be useful, imagine writing an instruction that you expect to be invoked via CPI that expects one of the passed in accounts to be both a ******signer****** on the transaciton and a ***********data source***********. Using the `Signer` account type here removes the automatic deserialization and type checking you would get with the `Account` type. This is both inconvenient, as you need to manually deserialize the account data in the instruction logic, and may make your program vulnerable by not getting the ownership and type checking performed by the `Account` type.

In the example below, you can safely write logic to interact with the data stored in the `authority` account while also verifying that it signed the transaction.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();

        // access the data stored in authority
        msg!("Total number of depositors: {}", ctx.accounts.authority.num_depositors);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    #[account(signer)]
    pub authority: Account<'info, AuthState>
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
#[account]
pub struct AuthState{
	amount: u64,
	num_depositors: u64,
	num_vaults: u64
}
```

# Lab

Let’s practice by creating a simple program to demonstrate how a missing signer check can allow an attacker to withdraw tokens that don’t belong to them.

This program initializes a simplified token “vault” account and demonstrates how a missing signer check could allow the vault to be drained.

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter). The starter code includes a program with two instructions and the boilerplate setup for the test file. 

The `initialize_vault` instruction initializes two new accounts: `Vault` and `TokenAccount`. The `Vault` account will be initialized using a Program Derived Address (PDA) and store the address of a token account and the authority of the vault. The authority of the token account will be the `vault` PDA which enables the program to sign for the transfer of tokens. 

The `insecure_withdraw` instruction will transfer tokens in the `vault` account’s token account to a `withdraw_destination` token account. However, the `authority` account in the `InsecureWithdraw` struct has a type of `UncheckedAccount`. This is a wrapper around `AccountInfo` to explicitly indicate the account is unchecked. 

Without a signer check, anyone can simply provide the public key of the `authority` account that matches `authority` stored on the `vault` account and the `insecure_withdraw` instruction would continue to process.

While this is somewhat contrived in that any DeFi program with a vault would be more sophisticated than this, it will show how the lack of a signer check can result in tokens being withdrawn by the wrong party.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
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
        space = 8 + 32 + 32,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
    )]
    pub token_account: Account<'info, TokenAccount>,
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
        has_one = token_account,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// CHECK: demo missing signer check
    pub authority: UncheckedAccount<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Test `insecure_withdraw` instruction

The test file includes the code to invoke the `initialize_vault` instruction using `wallet` as the `authority` on the vault. The code then mints 100 tokens to the `vault` token account. Theoretically, the `wallet` key should be the only one that can withdraw the 100 tokens from the vault.

Now, let’s add a test to invoke `insecure_withdraw` on the program to show that the current version of the program allows a third party to in fact withdraw those 100 tokens.

In the test, we’ll still use the public key of `wallet` as the `authority` account, but we’ll use a different keypair to sign and send the transaction.

```tsx
describe("signer-authorization", () => {
    ...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenAccount.publicKey,
        withdrawDestination: withdrawDestinationFake,
        authority: wallet.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(
      tokenAccount.publicKey
    )
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

Run `anchor test` to see that both transactions will complete successfully.

```bash
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

Since there is no signer check for the `authority` account, the `insecure_withdraw` instruction will transfer tokens from the `vault` token account to the `withdrawDestinationFake` token account as long as the public key of the`authority` account matches the public key stored on the authority field of the `vault` account. Clearly, the `insecure_withdraw` instruction is as insecure as the name suggests.

### 3. Add `secure_withdraw` instruction

Let’s fix the problem in a new instruction called `secure_withdraw`. This instruction will be identical to the `insecure_withdraw` instruction, except we’ll use the `Signer` type in the Accounts struct to validate the `authority` account in the `SecureWithdraw` struct. If the `authority` account is not a signer on the transaction, then we expect the transaction to fail and return an error.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
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
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. Test `secure_withdraw` instruction

With the instruction in place, return to the test file to test the `secure_withdraw` instruction. Invoke the `secure_withdraw` instruction, again using the public key of `wallet` as the `authority` account and the `withdrawDestinationFake` keypair as the signer and withdraw destination. Since the `authority` account is validated using the `Signer` type, we expect the transaction to fail the signer check and return an error.

```tsx
describe("signer-authorization", () => {
    ...
	it("Secure withdraw", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenAccount.publicKey,
          withdrawDestination: withdrawDestinationFake,
          authority: wallet.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

Run `anchor test` to see that the transaction will now return a signature verification error.

```bash
Error: Signature verification failed
```

That’s it! This is a fairly simple thing to avoid, but incredibly important. Make sure to always think through who should who should be authorizing instructions and make sure that each is a signer on the transaction.

If you want to take a look at the final solution code you can find it on the `solution` branch of [the repository](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution).

# Challenge

At this point in the course, we hope you've started to work on programs and projects outside the labs and Challenges provided in these lessons. For this and the remainder of the lessons on security vulnerabilities, the Challenge for each lesson will be to audit your own code for the security vulnerability discussed in the lesson. 

Alternatively, you can find open source programs to audit. There are plenty of programs you can look at. A good start if you don't mind diving into native Rust would be the [SPL programs](https://github.com/solana-labs/solana-program-library).

So for this lesson, take a look at a program (whether yours or one you've found online) and audit it for signer checks. If you find a bug in somebody else's program, please alert them! If you find a bug in your own program, be sure to patch it right away.

## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=26b3f41e-8241-416b-9cfa-05c5ab519d80)!
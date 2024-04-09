---
title: Owner Checks
objectives:
- Explain the security risks associated with not performing appropriate owner checks
- Implement owner checks using long-form Rust
- Use Anchor’s `Account<'info, T>` wrapper and an account type to automate owner checks
- Use Anchor’s `#[account(owner = <expr>)]` constraint to explicitly define an external program that should own an account
---

# Summary

- Use **Owner Checks** to verify that accounts are owned by the expected program. Without appropriate owner checks, accounts owned by unexpected programs could be used in an instruction.
- To implement an owner check in Rust, simply check that an account’s owner matches an expected program ID

```rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

- Anchor program account types implement the `Owner` trait which allows the `Account<'info, T>` wrapper to automatically verify program ownership
- Anchor gives you the option to explicitly define the owner of an account if it should be anything other than the currently executing program

# Lesson

Owner checks are used to verify that an account passed into an instruction is owned by an expected program. This prevents accounts owned by an unexpected program from being used in an instruction.

As a refresher, the `AccountInfo` struct contains the following fields. An owner check refers to checking that the `owner` field in the `AccountInfo` matches an expected program ID.

```rust
/// Account information
#[derive(Clone)]
pub struct AccountInfo<'a> {
    /// Public key of the account
    pub key: &'a Pubkey,
    /// Was the transaction signed by this account's public key?
    pub is_signer: bool,
    /// Is the account writable?
    pub is_writable: bool,
    /// The lamports in the account.  Modifiable by programs.
    pub lamports: Rc<RefCell<&'a mut u64>>,
    /// The data held in this account.  Modifiable by programs.
    pub data: Rc<RefCell<&'a mut [u8]>>,
    /// Program that owns this account
    pub owner: &'a Pubkey,
    /// This account's data contains a loaded program (and is now read-only)
    pub executable: bool,
    /// The epoch at which this account will next owe rent
    pub rent_epoch: Epoch,
}
```

### Missing owner check

The example below shows an `admin_instruction` intended to be accessible only by an `admin` account stored on an `admin_config` account.

Although the instruction checks the `admin` account signed the transaction and matches the `admin` field stored on the `admin_config` account, there is no owner check to verify the `admin_config` account passed into the instruction is owned by the executing program.

Since the `admin_config` is unchecked as indicated by the `AccountInfo` type, a fake `admin_config` account owned by a different program could be used in the `admin_instruction`. This means that an attacker could create a program with an `admin_config` whose data structure matches the `admin_config` of your program, set their public key as the `admin` and pass their `admin_config` account into your program. This would let them spoof your program into thinking that they are the authorized admin for your program.

This simplified example only prints the `admin` to the program logs. However, you can imagine how a missing owner check could allow fake accounts to exploit an instruction.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...

    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Add owner check

In vanilla Rust, you could solve this problem by comparing the `owner` field on the account to the program ID. If they do not match, you would return an `IncorrectProgramId` error.

```rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

Adding an owner check prevents accounts owned by an unexpected program to be passed in as the `admin_config` account. If a fake `admin_config` account was used in the `admin_instruction`, then the transaction would fail.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IncorrectProgramId.into());
        }

        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Use Anchor’s `Account<'info, T>`

Anchor can make this simpler with the `Account` type.

`Account<'info, T>` is a wrapper around `AccountInfo` that verifies program ownership and deserializes underlying data into the specified account type `T`. This in turn allows you to use `Account<'info, T>` to easily validate ownership.

For context, the `#[account]` attribute implements various traits for a data structure representing an account. One of these is the `Owner` trait which defines an address expected to own an account. The owner is set as the program ID specified in the `declare_id!` macro.

In the example below, `Account<'info, AdminConfig>` is used to validate the `admin_config`. This will automatically perform the owner check and deserialize the account data. Additionally, the `has_one` constraint is used to check that the `admin` account matches the `admin` field stored on the `admin_config` account.

This way, you don’t need to clutter your instruction logic with owner checks.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### Use Anchor’s `#[account(owner = <expr>)]` constraint

In addition to the `Account` type, you can use an `owner` constraint. The `owner` constraint allows you to define the program that should own an account if it’s different from the currently executing one. This comes in handy if, for example, you are writing an instruction that expects an account to be a PDA derived from a different program. You can use the `seeds` and `bump` constraints and define the `owner` to properly derive and verify the address of the account passed in.

To use the `owner` constraint, you’ll have to have access to the public key of the program you expect to own an account. You can either pass the program in as an additional account or hard-code the public key somewhere in your program.

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
    #[account(
            seeds = b"test-seed",
            bump,
            owner = token_program.key()
    )]
    pda_derived_from_another_program: AccountInfo<'info>,
    token_program: Program<'info, Token>
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

# Lab

In this lab we’ll use two programs to demonstrate how a missing owner check could allow a fake account to drain the tokens from a simplified token “vault” account (note that this is very similar to the lab from the Signer Authorization lesson).

To help illustrate this, one program will be missing an account owner check on the vault account it withdraws tokens to.

The second program will be a direct clone of the first program created by a malicious user to create an account identical to the first program’s vault account.

Without the owner check, this malicious user will be able to pass in the vault account owned by their “faked” program and the original program will still execute.

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter). The starter code includes two programs `clone` and `owner_check` and the boilerplate setup for the test file.

The `owner_check` program includes two instructions:

- `initialize_vault` initializes a simplified vault account that stores the addresses of a token account and an authority account
- `insecure_withdraw` withdraws tokens from the token account, but is missing an owner check for the vault account

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB");

#[program]
pub mod owner_check {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let account_data = ctx.accounts.vault.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = Vault::try_deserialize(&mut account_data_slice)?;

        if account_state.authority != ctx.accounts.authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
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
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_account,
        seeds = [b"token"],
        bump,
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
    /// CHECK:
    pub vault: UncheckedAccount<'info>,
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
}
```

The `clone` program includes a single instruction:

- `initialize_vault` initializes a “vault” account that mimics the vault account of the `owner_check` program. It stores the address of the real vault’s token account, but allows the malicious user to put their own authority account.

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3");

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. Test `insecure_withdraw` instruction

The test file includes a test to invoke the `initialize_vault` instruction on the `owner_check` program using the provider wallet as the `authority` and then mints 100 tokens to the token account.

The test file also includes a test to invoke the `initialize_vault` instruction on the `clone` program to initialize a fake `vault` account storing the same `tokenPDA` account, but a different `authority`. Note that no new tokens are minted here.

Let’s add a test to invoke the `insecure_withdraw` instruction. This test should pass in the cloned vault and the fake authority. Since there is no owner check to verify the `vaultClone` account is owned by the `owner_check` program, the instruction’s data validation check will pass and show `walletFake` as a valid authority. The tokens from the `tokenPDA` account will then be withdrawn to the `withdrawDestinationFake` account.

```tsx
describe("owner-check", () => {
	...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
        .insecureWithdraw()
        .accounts({
            vault: vaultClone.publicKey,
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

Run `anchor test` to see that the `insecure_withdraw` completes successfully.

```bash
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

Note that `vaultClone` deserializes successfully even though Anchor automatically initializes new accounts with a unique 8 byte discriminator and checks the discriminator when deserializing an account. This is because the discriminator is a hash of the account type name.

```rust
#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

Since both programs initialize identical accounts and both structs are named `Vault`, the accounts have the same discriminator even though they are owned by different programs.

### 3. Add `secure_withdraw` instruction

Let’s close up this security loophole.

In the `lib.rs` file of the `owner_check` program add a `secure_withdraw` instruction and a `SecureWithdraw` accounts struct.

In the `SecureWithdraw` struct, let’s use `Account<'info, Vault>` to ensure that an owner check is performed on the `vault` account. We’ll also use the `has_one` constraint to check that the `token_account` and `authority` passed into the instruction match the values stored on the `vault` account.

```rust
#[program]
pub mod owner_check {
    use super::*;
	...

	pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
       has_one = token_account,
       has_one = authority
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

To test the `secure_withdraw` instruction, we’ll invoke the instruction twice. First, we’ll invoke the instruction using the `vaultClone` account, which we expect to fail. Then, we’ll invoke the instruction using the correct `vault` account to check that the instruction works as intended.

```tsx
describe("owner-check", () => {
	...
	it("Secure withdraw, expect error", async () => {
        try {
            const tx = await program.methods
                .secureWithdraw()
                .accounts({
                    vault: vaultClone.publicKey,
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
            vault: vault.publicKey,
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

Run `anchor test` to see that the transaction using the `vaultClone` account will now return an Anchor Error while the transaction using the `vault` account completes successfully.

```bash
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: AccountOwnedByWrongProgram. Error Number: 3007. Error Message: The given account is owned by a different program than expected.',
'Program log: Left:',
'Program log: DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3',
'Program log: Right:',
'Program log: HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB consumed 5554 of 200000 compute units',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB failed: custom program error: 0xbbf'
```

Here we see how using Anchor’s `Account<'info, T>` type can simplify the account validation process to automate the ownership check. Additionally, note that Anchor Errors can specify the account that causes the error (e.g. the third line of the logs above say `AnchorError caused by account: vault`). This can be very helpful when debugging.

```bash
✔ Secure withdraw, expect error (78ms)
✔ Secure withdraw (10063ms)
```

That’s all you need to ensure you check the owner on an account! Like some other exploits, it’s fairly simple to avoid but very important. Be sure to always think through which accounts should be owned by which programs and ensure that you add appropriate validation.

If you want to take a look at the final solution code you can find it on the `solution` branch of [the repository](https://github.com/Unboxed-Software/solana-owner-checks/tree/solution).

# Challenge

Just as with other lessons in this unit, your opportunity to practice avoiding this security exploit lies in auditing your own or other programs.

Take some time to review at least one program and ensure that proper owner checks are performed on the accounts passed into each instruction.

Remember, if you find a bug or exploit in somebody else's program, please alert them! If you find one in your own program, be sure to patch it right away.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e3069010-3038-4984-b9d3-2dc6585147b1)!
# Type Cosplay

# Lesson Objectives

- Explain the security risks associated with not checking account types
- Implement an account type discriminator using long-form Rust
- Use Anchor to initialize account which automatically include a unique 8 byte discriminator
- Use Anchor to automatically check the discriminator of an account passed into an instruction

# TL;DR

- Use discriminators to distinguish between different account types
- To implement a discriminator in Rust, include a field in the account struct to represent the account type

    ```rust
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct User {
        discriminant: AccountDiscriminant,
        user: Pubkey,
    }

    #[derive(BorshSerialize, BorshDeserialize, PartialEq)]
    pub enum AccountDiscriminant {
        User,
        Admin,
    }
    ```

- To implement a discriminator check in Rust, verify that the discriminator of the deserialized account data matches the expected value

    ```rust
    if user.discriminant != AccountDiscriminant::User {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

- In Anchor, program account types implement the `Discriminator` trait which creates an 8 byte unique identifier for a type.
- Use Anchor’s `Account<'info, T>` type to automatically check the discriminator of the account when deserializing the account data

# Overview

A “type cosplay” is when an unexpected account is used in place of an expected account type. Note that account data is simply an array of bytes that a program deserializes into a custom account type. Without implementing a way to distinguish between account types, account data from an unexpected account could result in an instruction being used in unintended ways.

### Unchecked account

In the example below, both the `AdminConfig` and `UserConfig` account types store a single public key. The `admin_instruction` instruction deserializes the `admin_config` account as an `AdminConfig` type and then performs a owner check and data validation check.

However, the `AdminConfig` and `UserConfig` account types have the same data structure. This means a `UserConfig` account type could be passed in as the `admin_config` account. As long as the public key stored on the account data matches the `admin` signing the transaction, the `admin_instruction` instruction would continue to process.

Note that the names of the fields stored on the account types (`admin` and `user`) makes no difference when deserializing account data.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_insecure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    user: Pubkey,
}
```

### Add account discriminator

Let’s start by working through how to solve this in a long-form manner so you can understand it.

One way to distinguish between account types is to add a discriminant field for each account type and set the discriminant when initializing an account.

The example below updates the `AdminConfig` and `UserConfig` account types with a `discriminant` field. The `admin_instruction` instruction includes an additional data validation check for the `discriminant` field.

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

If the `discriminant` field of the account passed into the instruction as the `admin_config` account does not match the expected `AccountDiscriminant`, then the transaction will fail. Note that the instructions to required to initialize new accounts are not included in the example below.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_secure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        if account_data.discriminant != AccountDiscriminant::Admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    discriminant: AccountDiscriminant,
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    discriminant: AccountDiscriminant,
    user: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq)]
pub enum AccountDiscriminant {
    Admin,
    User,
}
```

### Use Anchor’s `Account` wrapper

Anchor’s **`#[account]`** attribute is used to implement various traits for a struct representing the data structure of a program account. When initializing a new program account, the first 8 bytes are reserved for a discriminator unique to the account type. When deserializing the account data, Anchor automatically checks if the discriminator on the account matches the expected account type.

In the example below, `Account<'info, AdminConfig>` specifies that the `admin_config` account should be an `AdminConfig` type. Anchor then automatically checks that the first 8 bytes of account data matches the discriminator of the`AdminConfig` type.

The data validation check for the `admin` field is also moved from the instruction logic to the account validation struct using the `has_one` constraint. `#[account(has_one = admin)]` specifies that the `admin_config` account’s `admin` field must match the `admin` account passed into the instruction. Note that for the `has_one` constraint to work, the naming of the account in the struct must match the naming of field on the account you are validating.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_recommended {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        msg!("Admin {}", ctx.accounts.admin_config.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    #[account(has_one = admin)]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct UserConfig {
    user: Pubkey,
}
```

It’s important to note that this is a vulnerability you don’t really have to worry about when using Anchor - that’s the whole point of it in the first place! After going through how this can be exploited if not handled properly in a native rust program, hopefully you have a much better understanding of what the purpose of the account discriminator is in an Anchor account. The fact that Anchor sets and checks this discriminator automatically means that developers can spend more time focusing on their product, but it’s still very important to understand what Anchor is doing behind the scenes to develop robust Solana programs.

# Demo

For this demo we’ll create two programs to demonstrate a type cosplay vulnerability.

- The first program will initialize program accounts without a discriminator
- The second program will initialize program accounts using Anchor’s `init` constraint which automatically sets an account discriminator

### 1. Setup

Create a new project called `type-cosplay` by running `anchor init`:

```bash
anchor init type-cosplay
```

Navigate to the new `type-cosplay` project directory and create a second `type-checked` program by running the following command:

```bash
anchor new type-checked
```

Now in your `programs` folder you will have two programs. Run `anchor keys list` and you should see the program IDs output for both programs.

```rust
anchor keys list
```

```bash
type_checked: FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7
type_cosplay: 4kaRTFx13ME6zVRiQxefhBuWZd4NurEn9p6K8SSw9fLQ
```

Next, update the program ID in the `declare_id!` macro for each respective program.

```rust
declare_id!("4kaRTFx13ME6zVRiQxefhBuWZd4NurEn9p6K8SSw9fLQ");
```

Additionally, update `Anchor.toml` with the program ID for all programs.

```toml
[programs.localnet]
type_cosplay = "4kaRTFx13ME6zVRiQxefhBuWZd4NurEn9p6K8SSw9fLQ"
type_checked = "FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7"
```

Next, update the test file to include both programs and generate keypairs for the accounts we’ll be initializing for each program.

```tsx
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { TypeCosplay } from "../target/types/type_cosplay"
import { TypeChecked } from "../target/types/type_checked"
import { expect } from "chai"

describe("type-cosplay", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>
  const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>

  const userAccount = anchor.web3.Keypair.generate()
  const newAdmin = anchor.web3.Keypair.generate()

  const userAccountType = anchor.web3.Keypair.generate()
  const adminAccountType = anchor.web3.Keypair.generate()
})
```

### 2. Create accounts with no discriminator

In the `type_cosplay` program, add an `initialize_admin` instruction and an `initialize_user` instruction to initialize two different account types. To create an accounts without discriminators, we manually create the account via a CPI to the system program and then initialize the account data.

We’ll also add an `update_admin` instruction that requires an unchecked `admin_config` account and deserializes the account as an `AdminConfig` account type. Since there is no way to distinguish between account types, either `AdminConfig` or `User` accounts can be passed into the instruction as the `admin_config` account.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("4kaRTFx13ME6zVRiQxefhBuWZd4NurEn9p6K8SSw9fLQ");

#[program]
pub mod type_cosplay {
    use super::*;

    pub fn initialize_admin(ctx: Context<Initialize>) -> Result<()> {
        let space = 32;
        let lamports = Rent::get()?.minimum_balance(space as usize);

        let ix = anchor_lang::solana_program::system_instruction::create_account(
            &ctx.accounts.payer.key(),
            &ctx.accounts.new_account.key(),
            lamports,
            space,
            &ctx.program_id,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.new_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let mut account =
            AdminConfig::try_from_slice(&ctx.accounts.new_account.data.borrow()).unwrap();

        account.admin = ctx.accounts.payer.key();
        account.serialize(&mut *ctx.accounts.new_account.data.borrow_mut())?;

        msg!("Admin: {}", account.admin.to_string());
        Ok(())
    }

    pub fn initialize_user(ctx: Context<Initialize>) -> Result<()> {
        let space = 32;
        let lamports = Rent::get()?.minimum_balance(space as usize);

        let ix = anchor_lang::solana_program::system_instruction::create_account(
            &ctx.accounts.payer.key(),
            &ctx.accounts.new_account.key(),
            lamports,
            space,
            &ctx.program_id,
        );

        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.new_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let mut account = User::try_from_slice(&ctx.accounts.new_account.data.borrow()).unwrap();

        account.user = ctx.accounts.payer.key();
        account.serialize(&mut *ctx.accounts.new_account.data.borrow_mut())?;

        msg!("User: {}", account.user.to_string());
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        let mut account =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();

        if ctx.accounts.admin.key() != account.admin {
            return Err(ProgramError::InvalidAccountData.into());
        }

        account.admin = ctx.accounts.new_admin.key();
        account.serialize(&mut *ctx.accounts.admin_config.data.borrow_mut())?;

        msg!("New Admin: {}", account.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub new_account: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    /// CHECK:
    admin_config: AccountInfo<'info>,
    new_admin: SystemAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

### 3. Test insecure `update_admin` instruction

In the test file, we’ll invoke `initializeUser` to initialize a new user account. Then we’ll invoke the `updateAdmin` instruction passing in the user account as the `adminConfig` account.

```rust
describe("type-cosplay", () => {
	...

	it("Initialize User Account", async () => {
    await program.methods
      .initializeUser()
      .accounts({
        newAccount: userAccount.publicKey,
      })
      .signers([userAccount])
      .rpc()
  })

  it("Invoke update admin instruction with user account", async () => {
    await program.methods
      .updateAdmin()
      .accounts({
        adminConfig: userAccount.publicKey,
        newAdmin: newAdmin.publicKey,
      })
      .rpc()
  })
})
```

Run `anchor test` and to see that the `updateAdmin` transaction completes successfully, even though we pass in a `User` account type as the `adminConfig` account.

### 4. Create accounts using Anchor `init` constraint

In the `type_checked`program, add two instructions using the `init` constraint to initialize an `AdminConfig` account and a `User` account. When using the `init` constraint to initialize new program accounts, Anchor will automatically set the first 8 bytes of account data as a unique discriminator for the account type.

We’ll also add an `update_admin` instruction that validates the `admin_config` account as a `AdminConfig` account type using Anchor’s `Account` wrapper. For any account passed in as the `admin_config` account, Anchor will automatically check that the account discriminator matches the expected account type.

```rust
use anchor_lang::prelude::*;

declare_id!("FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7");

#[program]
pub mod type_checked {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.user_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32
    )]
    pub user_account: Account<'info, User>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub new_admin: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct User {
    user: Pubkey,
}
```

### 3. Test `recommended` instruction

In the test file, we’ll initialize a `AdminConfig` account and a `User` account from the `type_checked` program. Then we’ll invoke the `updateAdmin` instruction twice passing in the newly created accounts.

```rust
describe("type-cosplay", () => {
	...

	it("Initialize AdminConfig Account", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("Initialize User Account", async () => {
    await programChecked.methods
      .initializeUser()
      .accounts({
        userAccount: userAccountType.publicKey,
        user: provider.wallet.publicKey,
      })
      .signers([userAccountType])
      .rpc()
  })

  it("Invoke update instruction using User Account", async () => {
    try {
      await programChecked.methods
        .updateAdmin()
        .accounts({
          adminConfig: userAccountType.publicKey,
          newAdmin: newAdmin.publicKey,
          admin: provider.wallet.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Invoke update instruction using AdminConfig Account", async () => {
    await programChecked.methods
      .updateAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
        newAdmin: newAdmin.publicKey,
        admin: provider.wallet.publicKey,
      })
      .rpc()
  })
})
```

Run `anchor test`. For the transaction where we pass in the `User` account type, we expect the instruction and return an Anchor Error.

```rust
'Program FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7 consumed 4765 of 200000 compute units',
'Program FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7 failed: custom program error: 0xbba'
```

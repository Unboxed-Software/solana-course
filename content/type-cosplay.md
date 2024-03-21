---
title: Type Cosplay
objectives:
- Explain the security risks associated with not checking account types
- Implement an account type discriminator using long-form Rust
- Use Anchor's `init` constraint to initialize accounts
- Use Anchor's `Account` type for account validation
---

# Summary

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

- In Anchor, program account types automatically implement the `Discriminator` trait which creates an 8 byte unique identifier for a type
- Use Anchor’s `Account<'info, T>` type to automatically check the discriminator of the account when deserializing the account data

# Lesson

“Type cosplay” refers to an unexpected account type being used in place of an expected account type. Under the hood, account data is simply stored as an array of bytes that a program deserializes into a custom account type. Without implementing a way to explicitly distinguish between account types, account data from an unexpected account could result in an instruction being used in unintended ways.

### Unchecked account

In the example below, both the `AdminConfig` and `UserConfig` account types store a single public key. The `admin_instruction` instruction deserializes the `admin_config` account as an `AdminConfig` type and then performs a owner check and data validation check.

However, the `AdminConfig` and `UserConfig` account types have the same data structure. This means a `UserConfig` account type could be passed in as the `admin_config` account. As long as the public key stored on the account data matches the `admin` signing the transaction, the `admin_instruction` instruction would continue to process, even if the signer isn't actually an admin.

Note that the names of the fields stored on the account types (`admin` and `user`) make no difference when deserializing account data. The data is serialized and deserialized based on the order of fields rather than their names.

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

To solve this, you can add a discriminant field for each account type and set the discriminant when initializing an account.

The example below updates the `AdminConfig` and `UserConfig` account types with a `discriminant` field. The `admin_instruction` instruction includes an additional data validation check for the `discriminant` field.

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

If the `discriminant` field of the account passed into the instruction as the `admin_config` account does not match the expected `AccountDiscriminant`, then the transaction will fail. Simply make sure to set the appropriate value for `discriminant` when you initialize each account (not shown in the example), and then you can include these discriminant checks in every subsequent instruction.

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

Implementing these checks for every account needed for every instruction can be tedious. Fortunately, Anchor provides a `#[account]` attribute macro for automatically implementing traits that every account should have.

Structs marked with `#[account]` can then be used with `Account` to validate that the passed in account is indeed the type you expect it to be. When initializing an account whose struct representation has the `#[account]` attribute, the first 8 bytes are automatically reserved for a discriminator unique to the account type. When deserializing the account data, Anchor will automatically check if the discriminator on the account matches the expected account type and throw and error if it does not match.

In the example below, `Account<'info, AdminConfig>` specifies that the `admin_config` account should be of type `AdminConfig`. Anchor then automatically checks that the first 8 bytes of account data match the discriminator of the `AdminConfig` type.

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

# Lab

For this lab we’ll create two programs to demonstrate a type cosplay vulnerability.

- The first program will initialize program accounts without a discriminator
- The second program will initialize program accounts using Anchor’s `init` constraint which automatically sets an account discriminator

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter). The starter code includes a program with three instructions and some tests.

The three instructions are:

1. `initialize_admin` - initializes an admin account and sets the admin authority of the program
2. `initialize_user` - intializes a standard user account
3. `update_admin` - allows the existing admin to update the admin authority of the program

Take a look at these three instructions in the `lib.rs` file. The last instruction should only be callable by the account matching the `admin` field on the admin account initialized using the `initialize_admin` instruction.

### 2. Test insecure `update_admin` instruction

However, both accounts have the same fields and field types:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

Because of this, it's possible to pass in a `User` account in place of the `admin` account in the `update_admin` instruction, thereby bypassing the requirement that one be an admin to call this instruction.

Take a look at the `solana-type-cosplay.ts` file in the `tests` directory. It contains some basic setup and two tests. One test initializes a user account, and the other invokes `update_admin` and passes in the user account in place of an admin account.

Run `anchor test` to see that invoking `update_admin` will complete successfully.

```bash
  type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

### 3. Create `type-checked` program

Now we'll create a new program called `type-checked` by running `anchor new type-checked` from the root of the existing anchor program.

Now in your `programs` folder you will have two programs. Run `anchor keys list` and you should see the program ID for the new program. Add it to the `lib.rs` file of the `type-checked` program and to the `type_checked` program in the `Anchor.toml` file.

Next, update the test file's setup to include the new program and two new keypairs for the accounts we'll be initializing for the new program.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
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

  const userAccountChecked = anchor.web3.Keypair.generate()
  const adminAccountChecked = anchor.web3.Keypair.generate()
})
```

### 4. Implement the `type-checked` program

In the `type_checked` program, add two instructions using the `init` constraint to initialize an `AdminConfig` account and a `User` account. When using the `init` constraint to initialize new program accounts, Anchor will automatically set the first 8 bytes of account data as a unique discriminator for the account type.

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

### 5. Test secure `update_admin` instruction

In the test file, we’ll initialize an `AdminConfig` account and a `User` account from the `type_checked` program. Then we’ll invoke the `updateAdmin` instruction twice passing in the newly created accounts.

```tsx
describe("type-cosplay", () => {
	...

  it("Initialize type checked AdminConfig Account", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("Initialize type checked User Account", async () => {
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

Run `anchor test`. For the transaction where we pass in the `User` account type, we expect the instruction and return an Anchor Error for the account not being of type `AdminConfig`.

```bash
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

Following Anchor best practices and using Anchor types will ensure that your programs avoid this vulnerability. Always use the `#[account]` attribute when creating account structs, use the `init` constraint when initializing accounts, and use the `Account` type in your account validation structs.

If you want to take a look at the final solution code you can find it on the `solution` branch of [the repository](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution).

# Challenge

Just as with other lessons in this unit, your opportunity to practice avoiding this security exploit lies in auditing your own or other programs.

Take some time to review at least one program and ensure that account types have a discriminator and that those are checked for each account and instruction. Since standard Anchor types handle this check automatically, you're more likely to find a vulnerability in a native program.

Remember, if you find a bug or exploit in somebody else's program, please alert them! If you find one in your own program, be sure to patch it right away.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=37ebccab-b19a-43c6-a96a-29fa7e80fdec)!
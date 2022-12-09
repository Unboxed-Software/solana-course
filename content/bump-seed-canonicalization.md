# Bump Seed Canonicalization

# Lesson Objectives

- Explain the security risks associated with initializing a PDA without using the canonical bump
- Initialize a PDA using Anchor’s `seeds` and `bump` constraints to automatically use the canonical bump
- Use Anchor to ensure the canonical bump is always used in future instructions when deriving a PDA

# TL;DR

- The [`create_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) function derives a PDA without searching for the canonical bump
- When using Anchor’s constraints to initialize an account at a PDA, Anchor will only use the canonical bump to derive the PDA
 ```rust
#[derive(Accounts)]
pub struct InitializeAnchor<'info> {
        #[account(mut)]
        payer: Signer<'info>,
        #[account(
            init,
            seeds = [DATA_PDA_SEED.as_bytes()],
            // derives the PDA using the canonical bump
            bump,
            payer = payer,
            space = 8 + 8 + 1
        )]
        data: Account<'info, Data>,
        system_program: Program<'info, System>
}
```

- Anchor allows you to provide the bump to use when verifying the address of a PDA after it has already been created
- It’s best practice to store the bump in an account’s data field to be referenced later on when re-deriving the address for verification

```rust
#[derive(Accounts)]
pub struct VerifyAddress<'info> {
    #[account(
        seeds = [DATA_PDA_SEED.as_bytes()],
        bump = data.bump
	)]
    data: Account<'info, Data>,
}

```

# Overview

Bump Seed Canonicalization refers to ensuring the bump used to derive a Program Derived Address (PDA) is the canonical bump. A bump seed is an additional seed used in the`find_program_address` function to ensure the derived PDA is valid and does not have a corresponding private key. The value of the bump seed starts at 255 and decrements until a valid PDA is found. The first valid bump is referred to as the canonical bump. Note that different valid bumps can generate different valid PDAs. 

### Using `create_program_address`

In the example below, the `set_value` instruction uses a `bump` that was passed in as instruction data to derive a PDA. The instruction then derives the PDA using `create_program_address` function and checks that the `address` matches the public key of the `data` account. 

This is insecure because the instruction tries to validate the PDA using instruction data passed into the instruction. A user could simply derive a PDA of this program off-chain while using a valid bump that is *not* the canonical bump, and pass this bump in as instruction data. The program would re-derive the PDA with `create_program_address` using the provided bump and verify that the derived address matches the address of the account passed in. In this scenario, the provided account would pass the checks, even though it was not derived with the canonical bump.

This can prove to be a potential issues with the design of your program. For most programs, there should only be one possible program account for a specific set of seeds. If your program does not enforce using the canonical bump when using PDAs, you could have any number of possible accounts for a given set of seeds - up to 255 (one for each possible bump).

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

### Using `find_program_address`

One approach to validating a PDA is to rederive the expected PDA using `find_program_address` within an instruction and then check that the address of the account passed into the instruction matches the derived PDA.

The `find_program_address` method will always use the canonical bump when deriving a PDA. As we discussed in a [previous lesson](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda.md), this method starts with a value of `255` as the bump seed, then checks to see if the output is a valid PDA. If the result is not a valid PDA, the function decreases the bump seed by 1 and tries again (`255`, `254`, `253`, et cetera). Once a valid PDA is found, the function returns both the PDA and the bump that was used to derive the PDA.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_secure {
    use super::*;

    pub fn set_value_secure(
        ctx: Context<BumpSeed>,
        key: u64,
        new_value: u64,
        bump: u8,
    ) -> Result<()> {
        let (address, expected_bump) =
            Pubkey::find_program_address(&[key.to_le_bytes().as_ref()], ctx.program_id);

        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        if expected_bump != bump {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

This ensures the address derived with `find_program_address` *always* uses the canonical bump (otherwise known as the largest valid bump possible). Using the canonical bump when initializing an account at a PDA and then using that same bump again every time a PDA needs to be verified, protects your program from accidentally creating more than one PDA for a given set of seeds.

### Using Anchor’s `seeds` and `bump` constraints

Anchor provides a convenient way to initialize accounts at PDAs and validate them with the `seeds` and `bump` constraints. When these two are used with the `init` constraint, Anchor will initialize a System Account at the PDA derived with the given seeds and bump. To protect the program from the vulnerability we’ve been discussing throughout this lesson, Anchor does not even allow you to initialize an account at a PDA using anything but the canonical bump. When the `init`, `seeds`, and `bump` constraints are used Anchor automatically uses the canonical bump in the same manner that `find_program_address` does.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [key.to_le_bytes().as_ref()],
        // derives the PDA using the canonical bump
		bump,
        payer = payer,
        space = 8 + 8
	)]
    data: Account<'info, Data>,
    system_program: Program<'info, System>
}

#[account]
pub struct Data {
    value: u64,
}
```

Anchor also provides a convenient way to validate a PDA if you don’t need to initialize an account as well. Using the same `seeds` and `bump` constraint, *without* `init`, simply rederives the PDA and compares the derived address with the address of the account passed in. In this scenario, Anchor does allow you to specify the bump to use to derive the PDA. This is done to save on the amount of compute the program uses. When you specify the bump to use, Anchor just uses `create_program_address` with the provided bump behind the scenes and does not have to worry about deriving the canonical bump. When the bump is not specified, Anchor must derive the canonical bump which is less performant and takes longer.

So, when initializing an account at a PDA via account constraints, Anchor forces you to use the canonical bump. When only verifying the address of a PDA, you can provide the bump you want to use which saves on the amount of compute the program uses. Because of this, it is common practice to always store the bump used to derive an account within the account’s data. This allows you to reference the bump stored within a specific account’s data field when specifying the bump to use on verification.

```rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // store the bump on the account
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [key.to_le_bytes().as_ref()],
        // derives the PDA using the canonical bump
		bump,
        payer = payer,
        space = 8 + 8 + 1
	)]
    data: Account<'info, Data>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
    #[account(
		seeds = [key.to_le_bytes().as_ref()],
        // guranteed to be the canonical bump every time
		bump = data.bump
	)]
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // bump field
    bump: u8
}
```

This design ensures that the canonical bump is used every time because Anchor uses it when initializing the account and the program stores the bump Anchor derived on the account itself. As long as you reference the bump stored on the account anytime you need to verify it later on, the program will always use the canonical bump.

Lastly, when the `bump` constraint is included without specifying a specific bump, Anchor will default to using the canonical bump - even when only verifying an address. This means Anchor will derive the canonical bump behind the scenes and it may incur a variable amount of the program’s compute budget. Programs that are meant to be very performant may not want to put the onus on the runtime to derive the bump to use when only verifying PDAs because it could take a considerable amount of time. Programs that are already at risk of exceeding their compute budget should call this with care since there is a chance that the program’s budget may be occasionally and unpredictably exceeded.

On the other hand, if you only need to verify the address of a PDA passed in without initializing an account and there is either no data or no bump stored on the account - your best bet is to let Anchor derive the canonical bump using the `bump` constraint.

```rust
// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [key.to_le_bytes().as_ref()],
        // derives the PDA using the canonical bump
		bump,
        payer = payer,
        space = 8 + 8 + 1
	)]
    data: Account<'info, Data>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
    #[account(
		seeds = [key.to_le_bytes().as_ref()],
        // Anchor will derive the canonical bump again here
		bump
	)]
    data: Account<'info, Data>
}

```

In the second `VerifyAddress` account struct above, Anchor will use the canonical bump to derive the PDA - but the program has already had to do this once when the account was initialized, there’s no reason to force the program to do it again and use more of the program’s limited compute units. That’s why it’s best practice to store the bump on the account and reference that going forward.

# Demo

### 1. Setup

Clone this repo and move to the `bump-seed-canonicalization` directory:

 [Bump Canonicalization Repo](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization)

```bash
git clone https://github.com/Unboxed-Software/solana-bump-seed-canonicalization
```

```bash
cd bump-seed-canonicalization
```

### 2. Review `initialize` instruction

There is already some code written in the program, we’ll review what it’s doing and then make some additions of our own.

The `initialize` instruction manually creates a system account at the PDA derived with the given bump seed via CPI to the system program. The instruction does not make use of Anchor’s constraints to derive the PDA, so it’s possible to initialize an account using any bump that is passed into the instruction.

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, bump_seed: u8) -> Result<()> {
        let space = 32;
        let lamports = Rent::get()?.minimum_balance(space as usize);

        let ix = anchor_lang::solana_program::system_instruction::create_account(
            &ctx.accounts.payer.key(),
            &ctx.accounts.pda.key(),
            lamports,
            space,
            &ctx.program_id,
        );

        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.pda.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[&[&[bump_seed]]],
        )?;

        let mut account = User::try_from_slice(&ctx.accounts.pda.data.borrow()).unwrap();

        account.user = ctx.accounts.payer.key();
        account.serialize(&mut *ctx.accounts.pda.data.borrow_mut())?;

        msg!("PDA: {}", ctx.accounts.pda.key());
        msg!("User: {}", account.user);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    /// CHECK:
    pub pda: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

### 3. Review `insecure` instruction

The `insecure` instruction derives the PDA using `create_program_address` with the `bump_seed` that’s passed into the instruction and verifies it matches the address of the `pda` account that’s passed in.

```rust
#[program]
pub mod bump_seed_canonicalization {
    use super::*;
		...

    pub fn insecure(ctx: Context<Unchecked>, bump_seed: u8) -> Result<()> {
        let address = Pubkey::create_program_address(&[&[bump_seed]], ctx.program_id).unwrap();
        if address != ctx.accounts.pda.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let account = User::try_from_slice(&ctx.accounts.pda.data.borrow()).unwrap();

        msg!("PDA: {}", ctx.accounts.pda.key());
        msg!("User: {}", account.user);
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct Unchecked<'info> {
    /// CHECK:
    pda: AccountInfo<'info>,
}
```

### 3. Test `initialize` and `insecure` instructions

Next, let’s test these two instructions with `anchor test`. The tests have already been written for you - you may have to `npm install` the dependencies.

The test derives two PDAs using the same exact seeds, but one is using the canonical bump and one is not. Each PDA is passed into the `initialize` instruction which ultimately creates an account for each PDA. They are then passed into the `insecure` instruction to see if they pass the validation logic there.

All of these tests will work fine, but they shouldn’t. When designing Solana programs, you should not be able to create more than one PDA account for a given set of seeds. This program currently allows for that, as we have just proven from our tests.

It’s important to note that neither of these instructions are really making use of Anchor’s features that protect against this vulnerability. The program is written in Anchor, but it makes use of the native `solana_program` methods to create the accounts and verify the PDAs. Let’s try implementing the same logic using Anchor’s features.

### 4. Add `initialize_with_anchor` and `verify_address` instructions

Add these two new instructions to the program.

```rust
pub fn initialize_with_anchor(ctx: Context<InitializeAnchor>, value: u64) -> Result<()> {
      ctx.accounts.data.value = value;
      // store the bump on the account
      ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
      Ok(())
    }

pub fn verify_address(ctx: Context<VerifyAddress>) -> Result<()> {
    msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
    Ok(())
}
```

And add the corresponding account structs for these new instructions.

```rust
// initialize account at PDA via Anchor constraints
#[derive(Accounts)]
pub struct InitializeAnchor<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [DATA_PDA_SEED.as_bytes()],
        // derives the PDA using the canonical bump
        bump,
        payer = payer,
        space = 8 + 8 + 1
    )]
    data: Account<'info, Data>,
    system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct VerifyAddress<'info> {
    #[account(
		seeds = [DATA_PDA_SEED.as_bytes()],
        // guranteed to be the canonical bump every time
		bump = data.bump
	)]
    data: Account<'info, Data>,
}
```

These instructions take full advantage of Anchor’s features to make the program as secure as possible. Instead of manually constructing the CPI to the system program and verifying the address of the PDAs using a bump seed passed in from the client, we can let Anchor handle all of that using account constraints.

In the `InitializeAnchor` struct, we initialize an account at a PDA just as before, but Anchor ensures that the address passed in is using the canonical bump. With the `bump` constraint, Anchor will derive the address of the PDA on its own using the seeds and the canonical bump - if the address of the account does not match what Anchor derived, the program will not execute and return an error. Since we’re initializing an account here, you cannot even specify what you’d like to use as the bump seed. Try setting the bump seed with `bump = 255`, the program will not compile.

```bash
error: bump targets should not be provided with init. Please use bump without a target.
  --> programs/bump-seed-canonicalization/src/lib.rs:89:17
   |
89 |                 bump = 255,
   |                 ^^^^
```

Once the account is created and the PDA is verified to be using the canonical bump, the instruction logic stores the bump value on the account itself. 

```rust
ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
```

A new account type was created for these instructions using Anchor’s notation with a field specifically to store the bump.

```rust
// Anchor account
#[account]
pub struct Data {
    value: u64,
    // bump field
    bump: u8
}
```

Lastly, the new `verify_address` instruction does not have an instruction parameter for the bump to be passed in from the client. Instead, the `VerifyAddress` account struct uses the bump stored on the account passed in to rederive the PDA and verify that the two match.

```rust
#[derive(Accounts)]
pub struct VerifyAddress<'info> {
    #[account(
	    seeds = [DATA_PDA_SEED.as_bytes()],
        // guranteed to be the canonical bump every time
		bump = data.bump
	)]
    data: Account<'info, Data>,
}
```

This is secure because the only way you can even create one of these accounts now is by using the canonical bump per the new `initialize_with_anchor` instruction. So, if an address is passed in that was derived with a different bump seed, then there will not be an underlying account to pull the bump from since you can only create an account using the canonical bump. 

What if someone were to create an identical program that allowed for creating accounts using any bump and stored a non-canonical bump seed on the account’s `bump` field, would that account pass our verification logic here? The answer is no it would not because we created the `Data` account using Anchor’s `#[account]` attribute which, as you may recall from the Duplicate Mutable Accounts lesson of this module, sets the account discriminator so that this is not possible - Anchor for the win again!

### 5. Test the new instructions

Next, uncomment the rest of the code in the testing file, save all of your changes, and run `anchor test`.

These tests follow a similar flow as the initial tests, but now the new instructions won’t even allow for creation of accounts using non-canonical bumps and they will not pass our verification logic.

The output from the tests should look something like:

```bash
First canonical PDA: 73pUtdETCMT4hboLLiEMe9X1vk3B3B4Qo6vgEdVU7bLW
Canonical bump: 252
First non-canonical PDA: GH8T3Ya2XRQqqaycGrspdtWv23LGZYxXVSEEv46peui1
Non-canonical bump: 2
  ✔ Initialize PDA using canonical bump (375ms)
  ✔ Initialize PDA using non-canonical bump (824ms)
  ✔ Verify PDA with canonical bump (826ms)
  ✔ Verify PDA with non-canonical bump (420ms)
Second canonical PDA: 5if2cdEqKrSehXLh4f5oiXDHoLybbqz1h7BK59SSHJw9
Canonical bump: 255
  ✔ Create new account with canonnical bump via Anchor constraints (1240ms)
Second non-canonical PDA: 3rrCQKGtYUapBhMJXQ5YWVNrtPQVdSh8E8tvSF2yh3cU
Non-canonical bump: 3
failed to send transaction: Transaction simulation failed: Error processing Instruction 0: Cross-program invocation with unauthorized signer or writable account
  ✔ Create new account with non-canonnical bump via Anchor constraints (should fail)
  ✔ Verify address of account PDA via Anchor constraints with canonical bump (396ms)
AnchorError caused by account: data. Error Code: AccountNotInitialized. Error Number: 3012. Error Message: The program expected this account to be already initialized.
  ✔ Try to verify address of non-canonical pda (should fail)
```
# Closing Accounts

# Lesson Objectives

- Learn how program accounts are closed and the benefits of closing accounts when they are no longer needed.
- Explain the different vulnerabilities that closing program accounts incorrectly can expose a program to.
- Use Anchor to safely and securely close program accounts.

# TL;DR

- When closing a program account the lamports stored in the account for rent are transferred out to another account of your choosing. Once an account is no longer rent exempt, the Solana runtime will garbarge collect it effectively deleting it.
- Closing an account creates an opportunity for reinitialization/revival attacks if not done properly.
- The Anchor `#[account(close = <address_to_send_lamports>)]` constraint securely closes accounts by setting the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR`

```rust
#[account(mut, close = receiver)]
pub data_account: Account<'info, MyData>,
#[account(mut)]
pub receiver: SystemAccount<'info>
```

# Overview

Account closing is done by transferring lamports out of a program owned account to trigger the runtime to garbage collect it, resetting the owner from the program to the system program immediately after the transaction completes successfully. The garbarge collection doesn’t occur until the entire transaction completes. This creates an opportunity for a subsequent instruction within that same transaction to refund the closed account with lamports for rent. In so doing, the second instruction effectively cancels out the first insruction that closed the account becuase the account will not be garbage collected.

To combat this, you can zero out the data stored on an account before transferring its lamports so that it can’t be used again. Now, even if a subsequent instruction were to refund the account, there’s no data stored on the account so it’s effectively useless. This is not entirely true, there are many different program architectures that require a 1-to-1 mapping of program accounts to users (like associated token accounts). This scenario would break that rule and could create potential issues if a program expected an account to not exist when, in fact, it did. Not only that, but even zeroing out the account does not prevent someone from re-initializing the account with different data.

To get a better understanding of these attack vectors, let’s explore each of these scenarios in depth.

## Transferring Lamports (test example code)

What happens if in a single transaction you have two instructions:

1. Instruction 1: Close account by transferring lamports
2. Instruction 2: Send lamports to newly closed account

The account won't be garbage collected by the runtime because, by the end of the transaction, the account is still rent exempt. So, the account is not closed.

Let’s take a look at an example of this in code, the following instruction takes two accounts:

1. `account_to_close` - account to be closed
2. `destination` - account to receive closed account’s lamports

The program logic is intended to close an account by simply increasing the `destination` account’s lamports by the amount stored in the `account_to_close` and setting the `account_to_close` lamports to 0. With this program, after a full transaction is processed, the `account_to_close` will be garbage collected by the runtime.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.account_to_close.to_account_info().lamports())
            .unwrap();
        **ctx.accounts.account_to_close.to_account_info().lamports.borrow_mut() = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account_to_close: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

Because the garbage collection does not take place until the entire transaction is processed, there is a chance that another instruction in the same transaction refunds the closed account. As we discussed before, this prevents the runtime garbage collector from deleting the account. So, simply transferring an account’s lamports is not enough to securely close an account.

## Zeroing Out Account Data (test example code)

Instead of just transferring an account’s lamports, one can also zero out the account data to prevent the account data from being used/accessed by your program again. This is a roundabout solution, as it does not ensure that the account is actually deleted. The opportunity to refund a closed account within the same transaction is still there, this method is just meant to try to limit what that account can be used for if it is refunded.

At first glance, this seems like it could be a viable option even if it does not directly resolve the issue at hand. Upon further inspection, though, it doesn’t hold up. After an account has been refunded, even if the data is removed, one can simply re-initialize the same account with new data.

### Insecure

```rust
use anchor_lang::prelude::*;
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure_still {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(zero)]
    account: Account<'info, Data>,
    authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

This program transfers the lamports out of an account and zeroes out the account data in a single instruction in hopes of preventing a subsequent instruction from utilizing this account again before it has been garbage collected. This does not completely solve the program, as it it still possible to refund and re-initialize the account data in a subsequent instruction.

## Using an Account Discriminator

Another step we can take is to utilize Anchor’s account discriminator. We’ve already learned about how account discriminators are used to determine what program owns an account and the account type that the data should be deserialized to. Well, it turns out that this discriminator can also be used to mark an account as ‘Closed’. Anchor has a specific `CLOSED_ACCOUNT_DISCRIMINATOR` variant for this exact purpose.

Any accounts passed in to an Anchor instruction with its discriminator set to the `CLOSED_ACCOUNT_DISCRIMINATOR` variant will not pass the discriminator check and thus will not be considered valid by the program (since its discriminator was reset). Because Anchor instructions check an account’s discriminator every time one is passed in, this can be used as a way to make sure a closed account cannot be re-initialized before it is garbage collected. You still have to transfer the account’s lamports and zero out its data, but this can protect your program from revival attacks.

```rust
use anchor_lang::prelude::*;
use std::io::Write;
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure_still_still {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        let dst: &mut [u8] = &mut data;
        let mut cursor = std::io::Cursor::new(dst);
        cursor
            .write_all(&anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR)
            .unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

This program transfers an account’s lamports allocated for rent, zeroes out its data, and then sets the account discriminator to the  `CLOSED_ACCOUNT_DISCRIMINATOR`.

However, this still does not completely solve our problem. A malicious user could still refund a closed account in the same transaction that it was closed in, meaning that the runtime would not garbage collect it and the account would still exist. Although the new discriminator would prevent the malicious user from re-initializing the account data, the original user would most likely lose access to this account for good - essentially leaving the account in limbo. This could be very bad in any scenario where a program’s design is centered around the idea of PDA accounts being associated with users. If something like this were to happen on a program with this design, this would effectively mean that the user could no longer use the contract with a previously used wallet.

## Manual Force Defund

To handle this case, we should consider adding an instruction to all Anchor programs that simply check if a tombstone discriminant is present. If so, send out all lamports to a given, **unauthorized** destination address.

```rust
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use anchor_lang::prelude::*;
use std::io::{Cursor, Write};
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_secure {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let dest_starting_lamports = ctx.accounts.destination.lamports();

        let account = ctx.accounts.account.to_account_info();
        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        let dst: &mut [u8] = &mut data;
        let mut cursor = Cursor::new(dst);
        cursor.write_all(&CLOSED_ACCOUNT_DISCRIMINATOR).unwrap();

        Ok(())
    }

    pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
        let account = &ctx.accounts.account;

        let data = account.try_borrow_data()?;
        assert!(data.len() > 8);

        let mut discriminator = [0u8; 8];
        discriminator.copy_from_slice(&data[0..8]);
        if discriminator != CLOSED_ACCOUNT_DISCRIMINATOR {
            return Err(ProgramError::InvalidAccountData);
        }

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ForceDefund<'info> {
    account: AccountInfo<'info>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

The purpose of the `force_defund` instruction is to essentially reclaim accounts that have been cast off into limbo by an attempted revival attack. Let’s say we close an account by transferring its lamports, zeroing out the account data, and setting the tombstone discriminant. Suppose in a subsequent instruction within that same transaction someone refunds the closed account with enough lamports to remain rent exempt, the account will not be garbage collected and it has now entered that limbo state where it can’t really be used for anyting again.

Instead of throwing in the towel and forcing the user to interact with the contract with a different wallet, the lost account can be passed into this `force_defund` instruction. The instruction takes two `AccountInfo` types as input, so it doesn’t automatically reject an account with the tombstone discriminator (like the account currently stuck in limbo).  The logic of the instruction actually verifies the discriminator is set to the `CLOSED_ACCOUNT_DISCRIMINATOR` and attempts to close the account again by transferring its lamports to another account. Clearly, someone could backrun this instruction and refund the account *again* in the same transaction, but this would not be economically viable for the attacker to continue. Continuously refunding the account would be akin to just throwing money down the drain in this scenario because all of the lamports the user is using to refund the closed account would be siphoned off to another user once `force_defund` is called.

### Using the `#[account(close = <target_account>)]` constraint

So far, quite a lot of code has been required to do a seemingly simple action of closing an account. Luckily, Anchor has implemented a way to make this process much easier. The `#[account(close = <target_account>)]` constraint takes care of the core functionality of closing an account behind the scenes for us. This macro does the following:

- transfers the account’s lamports to the given `<target_account>`
- zeroes out the account data
- sets the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR` variant

```rust
#[account(mut, close = receiver)]
pub data_account: Account<'info, MyData>,
#[account(mut)]
pub receiver: SystemAccount<'info>
```

The `force_defund` instruction is an optional addition that you’ll have to implement on your own if you’d like to utilize it.

# Demo

For this lesson’s demo, we’ll take a look at a program that initializes an account at a PDA associated with a user to store some state. Then, in sequential instructions, we’ll close the account and use a potential malicious user to refund the account. Once the account has been refunded, we’ll show what happens if the attacker tries to use the account again. Lastly, we’ll show how the `force_defund` instruction works to claim the lost account back.

## 1. Setup

Clone the following repo to get the starter code.

```bash
git clone <repo-url>
```

## 2. Add Instructions

Add the following instruction code to the program.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    ctx.accounts.data_account.data = 1;
    msg!("Account data initialized: {}", ctx.accounts.data_account.data);
    Ok(())
}

pub fn close_acct(ctx: Context<Close>) -> Result<()> {
    msg!("Account closed!");
    msg!("Data account data: {}", ctx.accounts.data_account.data);
    Ok(())
}

pub fn do_something(ctx: Context<Update>) -> Result<()> {
    // update data account
    ctx.accounts.data_account.data = 5;
    msg!("Updated data: {}", ctx.accounts.data_account.data);
    Ok(())
}
```

`initialize` initializes the program account and sets its data.

`close_acct` will close the the account, we’ll implement that next using Anchor constraints.

`do_something` just attemptes to update the data stored in the account.

## 3. Add Account Structs

Add the corresponding account structs for each instruction.

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8,
        // pda associated with user
        seeds = [DATA_PDA_SEED.as_bytes(), authority.key().as_ref()],
        bump
    )]
    pub data_account: Account<'info, DataAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, close = receiver,)]
    pub data_account: Account<'info, DataAccount>,
    ///CHECK: Safe
    pub receiver: AccountInfo<'info>
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub data_account: Account<'info, DataAccount>,
}
```

We’re using the `#[account(close = <destination>])` constraint the close the `data_account`.

## 4. Test the Program

Take a look at the test written for this program, it’s very procedural. The test executes the following:

1. Transaction initializes a `data_account` uisng the `initialize` instruction
2. Transaction is created with two sequential instructions
    1. ix1: Closes the `data_account` using the `close_acct` instruction
    2. ix2: Attacker refunds the closed `data_account` preventing it from being garbage collected
3. Test tries to fetch and deserialize the data on the refunded `data_account`, this fails because the Anchor SDK sees that the account discriminator has been changed
4. Attacker attempts to pass the refunded account into the `do_something` instruction to potentiallhy update the account’s data
    1. this fails also because Anchor can tell the account discriminator is invalid
5. Original user calls the `force_defund` instruction to claim the attack’s lamports and attempt to close the account again
6. Test tries to fetch the account data for `data_account` but it has been successfully closed and does not exist anymore

The output from the running `anchor test` should look like this:

```bash
closing-accounts
Invalid account discriminator
AnchorError caused by account: data_account. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
Account does not exist J7WdJdwB723e2fuvDWPrc3xCz6mF7RSmAdKon7WnkBVf
    ✔ Initialize and Close Data Account (2874ms)
```

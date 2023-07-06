---
title: Closing Accounts and Revival Attacks
objectives:
- Explain the various security vulnerabilities associated with closing program accounts incorrectly
- Close program accounts safely and securely using native Rust
- Close program accounts safely and securely using the Anchor `close` constraint
---

# TL;DR

- **Closing an account** improperly creates an opportunity for reinitialization/revival attacks
- The Solana runtime **garbage collects accounts** when they are no longer rent exempt. Closing accounts involves transferring the lamports stored in the account for rent exemption to another account of your choosing.
- You can use the Anchor `#[account(close = <address_to_send_lamports>)]` constraint to securely close accounts and set the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR`
    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# Overview

While it sounds simple, closing accounts properly can be tricky. There are a number of ways an attacker could circumvent having the account closed if you don't follow specific steps.

To get a better understanding of these attack vectors, let’s explore each of these scenarios in depth.

## Insecure account closing

At its core, closing an account involves transferring its lamports to a separate account, thus triggering the Solana runtime to garbage collect the first account. This resets the owner from the owning program to the system program.

Take a look at the example below. The instruction requires two accounts:

1. `account_to_close` - the account to be closed
2. `destination` - the account that should receive the closed account’s lamports

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

However, the garbage collection doesn't occur until the transaction completes. And since there can be multiple instructions in a transaction, this creates an opportunity for an attacker to invoke the instruction to close the account but also include in the transaction a transfer to refund the account's rent exemption lamports. The result is that the account *will not* be garbage collected, opening up a path for the attacker to cause unintended behavior in the program and even drain a protocol.

## Secure account closing

The two most important things you can do to close this loophole are to zero out the account data and add an account discriminator that represents the account has been closed. You need *both* of these things to avoid unintended program behavior.

An account with zeroed out data can still be used for some things, especially if it's a PDA whose address derivation is used within the program for verification purposes. However, the damage may be potentially limited if the attacker can't access the previously-stored data.

To further secure the program, however, closed accounts should be given an account discriminator that designates it as "closed," and all instructions should perform checks on all passed-in accounts that return an error if the account is marked closed.

Look at the example below. This program transfers the lamports out of an account, zeroes out the account data, and sets an account discriminator in a single instruction in hopes of preventing a subsequent instruction from utilizing this account again before it has been garbage collected. Failing to do any one of these things would result in a security vulnerability.

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

Note that the example above is using Anchor's `CLOSED_ACCOUNT_DISCRIMINATOR`. This is simply an account discriminator where each byte is `255`. The discriminator doesn't have any inherent meaning, but if you couple it with account validation checks that return errors any time an account with this discriminator is passed to an instruction, you'll stop your program from unintentionally processing an instruction with a closed account.

### Manual Force Defund

There is still one small issue. While the practice of zeroing out account data and adding a "closed" account discriminator will stop your program from being exploited, a user can still keep an account from being garbage collected by refunding the account's lamports before the end of an instruction. This results in one or potentially many accounts existing in a limbo state where they cannot be used but also cannot be garbage collected.

To handle this edge case, you may consider adding an instruction that will allow *anyone* to defund accounts tagged with the "closed" account discriminator. The only account validation this instruction would perform is to ensure that the account being defunded is marked as closed. It may look something like this:

```rust
use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use anchor_lang::prelude::*;
use std::io::{Cursor, Write};
use std::ops::DerefMut;

...

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

...

#[derive(Accounts)]
pub struct ForceDefund<'info> {
    account: AccountInfo<'info>,
    destination: AccountInfo<'info>,
}
```

Since anyone can call this instruction, this can act as a deterrent to attempted revival attacks since the attacker is paying for account rent exemption but anyone else can claim the lamports in a refunded account for themselves.

While not necessary, this can help eliminate the waste of space and lamports associated with these "limbo" accounts.

## Use the Anchor `close` constraint

Fortunately, Anchor makes all of this much simpler with the `#[account(close = <target_account>)]` constraint. This constraint handles everything required to securely close an account:

1. Transfers the account’s lamports to the given `<target_account>`
2. Zeroes out the account data
3. Sets the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR` variant

All you have to do is add it in the account validation struct to the account you want closed:

```rust
#[derive(Accounts)]
pub struct CloseAccount {
    #[account(
        mut, 
        close = receiver
    )]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
}
```

The `force_defund` instruction is an optional addition that you’ll have to implement on your own if you’d like to utilize it.

# Demo

To clarify how an attacker might take advantage of a revival attack, let's work with a simple lottery program that uses program account state to manage a user's participation in the lottery.

## 1. Setup

Start by getting the code on the `starter` branch from the [following repo](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter).

The code has two instructions on the program and two tests in the `tests` directory.

The program instructions are:

1. `enter_lottery`
2. `redeem_rewards_insecure`

When a user calls `enter_lottery`, the program will initialize an account to store some state about the user's lottery entry.

Since this is a simplified example rather than a fully-fledge lottery program, once a user has entered the lottery they can call the `redeem_rewards_insecure` instruction at any time. This instruction will mint the user an amount of Reward tokens proportional to the amount of times the user has entered the lottery. After minting the rewards, the program closes the user's lottery entry.

Take a minute to familiarize yourself with the program code. The `enter_lottery` instruction simply creates an account at a PDA mapped to the user and initializes some state on it.

The `redeem_rewards_insecure` instruction performs some account and data validation, mints tokens to the given token account, then closes the lottery account by removing its lamports.

However, notice the `redeem_rewards_insecure` instruction *only* transfers out the account's lamports, leaving the account open to revival attacks.

## 2. Test Insecure Program

An attacker that successfully keeps their account from closing can then call `redeem_rewards_insecure` multiple times, claiming more rewards than they are owed.

Some starter tests have already been written that showcase this vulnerability. Take a look at the `closing-accounts.ts` file in the `tests` directory. There is some setup in the `before` function, then a test that simply creates a new lottery entry for `attacker`.

Finally, there's a test that demonstrates how an attacker can keep the account alive even after claiming rewards and then claim rewards again. That test looks like this:

```typescript
it("attacker  can close + refund lottery acct + claim multiple rewards", async () => {
    // claim multiple times
    for (let i = 0; i < 2; i++) {
      const tx = new Transaction()
      // instruction claims rewards, program will try to close account
      tx.add(
        await program.methods
          .redeemWinningsInsecure()
          .accounts({
            lotteryEntry: attackerLotteryEntry,
            user: attacker.publicKey,
            userAta: attackerAta,
            rewardMint: rewardMint,
            mintAuth: mintAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      )

      // user adds instruction to refund dataAccount lamports
      const rentExemptLamports =
        await provider.connection.getMinimumBalanceForRentExemption(
          82,
          "confirmed"
        )
      tx.add(
        SystemProgram.transfer({
          fromPubkey: attacker.publicKey,
          toPubkey: attackerLotteryEntry,
          lamports: rentExemptLamports,
        })
      )
      // send tx
      await sendAndConfirmTransaction(provider.connection, tx, [attacker])
      await new Promise((x) => setTimeout(x, 5000))
    }

    const ata = await getAccount(provider.connection, attackerAta)
    const lotteryEntry = await program.account.lotteryAccount.fetch(
      attackerLotteryEntry
    )

    expect(Number(ata.amount)).to.equal(
      lotteryEntry.timestamp.toNumber() * 10 * 2
    )
})
```

This test does the following:
1. Calls `redeem_rewards_insecure` to redeem the user's rewards
2. In the same transaction, adds an instruction to refund the user's `lottery_entry` before it can actually be closed
3. Successfully repeats steps 1 and 2, redeeming rewards for a second time.

You can theoretically repeat steps 1-2 infinitely until either a) the program has no more rewards to give or b) someone notices and patches the exploit. This would obviously be a severe problem in any real program as it allows a malicious attacker to drain an entire rewards pool.

## 3. Create a `redeem_rewards_secure` instruction

To prevent this from happening we're going to create a new instruction that closes the lottery account seucrely using the Anchor `close` constraint. Feel free to try this out on your own if you'd like.

The new account validation struct called `RedeemWinningsSecure` should look like this:

```rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // program expects this account to be initialized
    #[account(
        mut,
        seeds = [user.key().as_ref()],
        bump = lottery_entry.bump,
        has_one = user,
        close = user
    )]
    pub lottery_entry: Account<'info, LotteryAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_ata.key() == lottery_entry.user_ata
    )]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_mint.key() == user_ata.mint
    )]
    pub reward_mint: Account<'info, Mint>,
    ///CHECK: mint authority
    #[account(
        seeds = [MINT_SEED.as_bytes()],
        bump
    )]
    pub mint_auth: AccountInfo<'info>,
    pub token_program: Program<'info, Token>
}
```

It should be the exact same as the original `RedeemWinnings` account validation struct, except there is an additional `close = user` constraint on the `lottery_entry` account. This will tell Anchor to close the account by zeroing out the data, transferring its lamports to the `user` account, and setting the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR`. This last step is what will prevent the account from being used again if the program has attempted to close it already.

Then, we can create a `mint_ctx` method on the new `RedeemWinningsSecure` struct to help with the minting CPI to the token program.

```Rust
impl<'info> RedeemWinningsSecure <'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.reward_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.mint_auth.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

Finally, the logic for the new secure instruction should look like this:

```rust
pub fn redeem_winnings_secure(ctx: Context<RedeemWinningsSecure>) -> Result<()> {

    msg!("Calculating winnings");
    let amount = ctx.accounts.lottery_entry.timestamp as u64 * 10;

    msg!("Minting {} tokens in rewards", amount);
    // program signer seeds
    let auth_bump = *ctx.bumps.get("mint_auth").unwrap();
    let auth_seeds = &[MINT_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // redeem rewards by minting to user
    mint_to(ctx.accounts.mint_ctx().with_signer(signer), amount)?;

    Ok(())
}
```

This logic simply calculates the rewards for the claiming user and transfers the rewards. However, because of the `close` constraint in the account validation struct, the attacker shouldn't be able to call this instruction multiple times.

## 4. Test the Program

To test our new secure instruction, let's create a new test that trys to call `redeemingWinningsSecure` twice. We expect the second call to throw an error.

```typescript
it("attacker cannot claim multiple rewards with secure claim", async () => {
    const tx = new Transaction()
    // instruction claims rewards, program will try to close account
    tx.add(
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    )

    // user adds instruction to refund dataAccount lamports
    const rentExemptLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        82,
        "confirmed"
      )
    tx.add(
      SystemProgram.transfer({
        fromPubkey: attacker.publicKey,
        toPubkey: attackerLotteryEntry,
        lamports: rentExemptLamports,
      })
    )
    // send tx
    await sendAndConfirmTransaction(provider.connection, tx, [attacker])

    try {
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

Run `anchor test` to see that the test passes. The output will look something like this:

```bash
  closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

Note, this does not prevent the malicious user from refunding their account altogether - it just protects our program from accidentally re-using the account when it should be closed. We haven't implemented a `force_defund` instruction so far, but we could. If you're feeling up for it, give it a try yourself!

The simplest and most secure way to close accounts is using Anchor's `close` constraint. If you ever need more custom behavior and can't use this constraint, make sure to replicate its functionality to ensure your program is secure.

If you want to take a look at the final solution code you can find it on the `solution` branch of [the same repository](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution).

# Challenge

Just as with other lessons in this module, your opportunity to practice avoiding this security exploit lies in auditing your own or other programs.

Take some time to review at least one program and ensure that when accounts are closed they're not susceptible to revival attacks.

Remember, if you find a bug or exploit in somebody else's program, please alert them! If you find one in your own program, be sure to patch it right away.

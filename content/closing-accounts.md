# Closing Accounts

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Explain the various security vulnerabilities associated with closing program accounts incorrectly
- Close program accounts safely and securely using native Rust
- Close program accounts safely and securely using Anchor constraints

# TL;DR

- Closing an account improperly creates an opportunity for reinitialization/revival attacks
- When closing a program account, the lamports stored in the account for rent are transferred out to another account of your choosing. Once an account is no longer rent exempt, the Solana runtime will garbage collect it. This effectively deletes the account.
- You can use the Anchor `#[account(close = <address_to_send_lamports>)]` constraint to securely close accounts and set the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR`
    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# Overview

Account closing is done by transferring lamports out of a program owned account to trigger the runtime to garbage collect it, resetting the owner from the program to the system program immediately after the transaction completes successfully. The garbage collection doesn’t occur until the entire transaction completes. This creates an opportunity for a subsequent instruction within that same transaction to refund the closed account with lamports for rent. In so doing, the second instruction effectively cancels out the first instruction that closed the account because the account will not be garbage collected.

To combat this, you can zero out the data stored on an account before transferring its lamports. Now, even if a subsequent instruction were to refund the account, there’s no data stored on the account so it’s effectively useless. This is not entirely true, there are many different program architectures where just the existence of an account can be manipulated in a malicious way.

To get a better understanding of these attack vectors, let’s explore each of these scenarios in depth.

## Transferring Lamports

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

## Zeroing Out Account Data

Instead of just transferring an account’s lamports, one can also zero out the account data to prevent the account data from being used/accessed by your program again. The opportunity to refund a closed account within the same transaction is still there, this method is just meant to try to limit what that account can be used for if it is refunded.

At first glance, this seems like it could be a viable option even if it does not directly resolve the issue at hand. Upon further inspection, though, it doesn’t hold up. After an account has been refunded, even if the data is removed, one can simply re-initialize the same account with new data. In addition, if a program relies on the existence of an account being a source of proof of something, then this can be manipulated by a malicious user to "prove" to the program this account exists when it should have actually been deleted.

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

This program transfers the lamports out of an account and zeroes out the account data in a single instruction in hopes of preventing a subsequent instruction from utilizing this account again before it has been garbage collected. This does not completely solve the problem, as it is still possible to refund and re-initialize the account data in a subsequent instruction.

## Using an Account Discriminator

Another step we can take is to utilize Anchor’s account discriminator. We’ve already learned about how account discriminators are used to determine what program owns an account and the account type that the data should be deserialized to. Well, it turns out that this discriminator can also be used to mark an account as ‘Closed’. Anchor has a specific `CLOSED_ACCOUNT_DISCRIMINATOR` variant for this exact purpose.

Any accounts passed in to an Anchor instruction with its discriminator set to the `CLOSED_ACCOUNT_DISCRIMINATOR` variant will not pass the discriminator check and thus will not be considered valid by the program (since its discriminator was reset). Because Anchor instructions check an account’s discriminator every time one is passed in, this can be used as a way to make sure a closed account cannot be used again if it's refunded before it can be garbage collected. You still have to transfer the account’s lamports and zero out its data, but this can help protect your program from revival attacks.

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

This program transfers an account’s lamports allocated for rent, zeroes out its data, and then sets the account discriminator to the  `CLOSED_ACCOUNT_DISCRIMINATOR`. The discriminator will also protect our program from being spoofed into thinking this account is still a valid proof of something. Anchor programs will return an error and reject any instructions containing an account with the `CLOSED_ACCOUNT_DISCRIMINATOR` set.

However, this still does not completely solve our problem. A malicious user could still refund a closed account in the same transaction that it was closed in, meaning that the runtime would not garbage collect it and the account would still exist. Although the new discriminator would prevent the malicious user from re-using the refunded account, the account has now entered a limbo state since it's funded with lamports but essentially can't be used again given the account discriminator.

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

The purpose of the `force_defund` instruction is to essentially reclaim accounts that have been cast off into limbo by an attempted revival attack. Let’s say a user submits an instruction that closes an account by transferring its lamports, zeroing out the account data, and setting the tombstone discriminant. Suppose, in a subsequent instruction within that same transaction, the user refunds the closed account with enough lamports to remain rent exempt - the account will not be garbage collected and it has now entered that limbo state where it can’t really be used for anything again.

Anyone can pass the refunded account into the `force_defund` instruction. The instruction takes two `AccountInfo` types as input, so it doesn’t automatically reject an account with the tombstone discriminator (like the account currently stuck in limbo).  The logic of the instruction actually verifies the discriminator is set to the `CLOSED_ACCOUNT_DISCRIMINATOR` and attempts to close the account again by transferring its lamports to another account. Since anyone can call this instruction, this can act as a deterrent to this type of attack because it essentially allows anyone to claim the lamports in a refunded account for themselves! This instruction will only defund accounts with the `CLOSED_ACCOUNT_DISCRIMINATOR`.

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

For this lesson’s demo, we’ll take a look at a simple example of a lottery program. The program will have two main instructions:
- `enter_lottery`
- `redeem_rewards_insecure`

When a user calls `enter_lottery`, the program will initialize an account to store some state about the user's lottery entry. This isn't a real lottery program, so once a user has entered the lottery by calling this instruction, they can call the `redeem_rewards_insecure` instruction at any time. This instruction will mint the user an amount of Reward tokens proportional to the amount of time the user has been in the lottery. After minting the rewards, the program closes the user's lottery entry.

The point of this is that once a user claims rewards, their lottery entry should be nullified. To showcase the vulnerability that closing accounts incorrectly can expose, we've written the program so that it currently closes the account without using Anchor. The testing script takes advantage of this vulnerability by calling the `redeem_rewards_insecure` instruction and refunding the lottery account before it can be garbage collected by the runtime. Because we don't use Anchor to close the account securely, this allows the user to repeatedly call `redeem_rewards_insecure` allowing them to claim more rewards than they are owed.


## 1. Setup

Clone the [following repo](https://github.com/Unboxed-Software/solana-closing-accounts/tree/main) to get the starter code.

```bash
git clone https://github.com/Unboxed-Software/solana-closing-accounts/tree/main
```

Take a look at the program code. `enter_lottery` simply creates an account at a PDA and initializes some state on it. `redeem_rewards_insecure` performs some validation checks on all of the accounts passed in and the lottery account's data, then mints tokens to the given token account, and attempts to close the lottery account by removing its lamports.

Notice that the `redeem_rewards_insecure` instruction does not use the `init` constraint on the `lottery_entry` account. This means the program expects this account to already exist and will not execute if it has not been created via the `enter_lottery` instruction first. So, if the `redeem_rewards_insecure` instruction were successful in closing the lottery account, the user would not be able to repeatedly call the redeem instruction without first re-initializing the lottery account each time.

## 2. Test Insecure Program

A test has already been written that showcases this vulnerability. Let's take a look at it and walk through each step.

```typescript
it("Enter lottery", async () => {
    const [lotteryEntry, bump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("test-seed"), authority.publicKey.toBuffer()],
      program.programId
    )
    const [mint, mintBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("mint-seed")],
      program.programId
    )
    mintAuth = mint

    await safeAirdrop(authority.publicKey, provider.connection)

    rewardMint = await createMint(
      provider.connection,
      authority,
      mintAuth,
      null,
      6
    )

    const associatedAcct = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      rewardMint,
      authority.publicKey
    )
    userAta = associatedAcct.address


    // tx to enter lottery
    await program.methods.enterLottery()
    .accounts({
      lotteryEntry: lotteryEntry,
      user: authority.publicKey,
      userAta: userAta,
      systemProgram: SystemProgram.programId
    })
    .signers([authority])
    .rpc()
  })

  it("close + refund lottery acct to continuously claim rewards", async () => {

    const [lotteryEntry, bump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("test-seed"), authority.publicKey.toBuffer()],
      program.programId
    )

    // log rewards minted
    let tokenAcct = await getAccount(
      provider.connection,
      userAta
    )
    console.log("User balance before reward redemption: ", tokenAcct.amount.toString())

    const tx = new Transaction()

    // instruction claims rewards, program will try to close account
    tx.add(
      await program.methods.redeemWinningsInsecure()
      .accounts({
        lotteryEntry: lotteryEntry,
        user: authority.publicKey,
        userAta: userAta,
        rewardMint: rewardMint,
        mintAuth: mintAuth,
        tokenProgram: TOKEN_PROGRAM_ID
      })
      .instruction()
    )

    // user adds instruction to refund dataAccount lamports
    const rentExemptLamports = await provider.connection.getMinimumBalanceForRentExemption(82, "confirmed")
    tx.add(
      SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: lotteryEntry,
          lamports: rentExemptLamports,
      })
    )
    // tx is sent
    const txSig = await provider.connection.sendTransaction(tx, [authority])
    await provider.connection.confirmTransaction(txSig)

    // log rewards minted
    tokenAcct = await getAccount(
      provider.connection,
      userAta
    )
    console.log("User balance after first redemption: ", tokenAcct.amount.toString())

    try {
      // claim rewards for a 2nd time
      await program.methods.redeemWinningsInsecure()
        .accounts({
          lotteryEntry: lotteryEntry,
          user: authority.publicKey,
          userAta: userAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID
        })
        .signers([authority])
        .rpc()
    } catch (e) {
      console.log(e.message)
      expect(e.message).to.eq("AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.")
    }

    tokenAcct = await getAccount(
      provider.connection,
      userAta
    )

    // log rewards minted
    console.log("User balance after second redemption: ", tokenAcct.amount.toString())

  })
```
There is essentially 4 steps to the test:
1. Enter the lottery by calling `enter_lottery` and initializing a `lottery_entry` account
2. Call `redeem_rewards_insecure` and redeem the user's rewards
3. In the same transaction, add an instruction to refund the user's `lottery_entry` before it can actually be closed
4. In a different transaction, call `redeem_rewards_insecure` again and redeem rewards for a second time

You can theoretically repeat steps 2-4 infinitely until either a) there are no more rewards to redeem or b) someone notices and does something. This would obviously be a severe problem in any real program as it allows a malicious attacker to drain an entire pool.

## 3. Create a `redeem_rewards_secure` instruction

To prevent this from happening we're going to create a new instruction that closes the lottery account seucrely by using Anchor constraints. Feel free to try this out on your own if you'd like.

The new account validation struct called `RedeemWinningsSecure` should look like:
```Rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // program expects this account to be initialized
    #[account(
        mut,
        seeds = [DATA_PDA_SEED.as_bytes(), user.key().as_ref()],
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
It should be the exact same as the original `RedeemWinnings` account validation struct, except there is an additional `close = <account_to_receive_lamports>` constraint on the `lottery_entry` account. This will tell Anchor to close the account by zeroing out the data, transferring its lamports to the given `<account_to_receive_lamports>`, and setting the account discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR`. This last step is what will prevent the account from being used again if the program has attempted to close it already.

Then, we can implement the `mint_ctx` method on the new `RedeemWinningsSecure` struct to help with the CPI to the token program.
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

Next, the logic for the new secure instruction should look like this:

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

This is also the same, just without the additional logic to close the account manually.

## 4. Test the Program

To test our new secure instruction, we're just going to change the two calls to `redeemWinningsInsecure` to call `redeemWinningsSecure` instead. This way, after the `lottery_entry` account has been refunded, the new instruction should not accept it and return an error instead of allowing the attacker to drain the funds.

The output of the test should be something along these lines:
```powershell
closing-accounts
    ✔ Enter lottery (1643ms)
User balance before reward redemption:  0
User balance after first redemption:  16716840430
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
User balance after second redemption:  16716840430
    ✔ close + refund lottery acct to continuously claim rewards (886ms)
```

Note, this does not prevent the malicious user from refunding their account altogether - it just protects our program from accidentally re-using the account when it should be closed. We haven't done anything with the `force_defund` instruction so far, but it's there to use to punish bad actors like this. Anyone can pass in a refunded account that has the `CLOSED_ACCOUNT_DISCRIMINATOR` set and the instruction will transfer the attackers lamports out of the account. Write a test for this instruction yourself and give it a try.

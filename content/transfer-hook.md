---
title: Transfer hook
objectives:
- 
---

# Summary

# Overview

# Lab

## 1. Verify Solana/Anchor/Rust Versions

We will be interacting with the `Token Extension` program in this lab and that requires you have solana cli version ≥ 1.18.0. 

To check your version run:
```bash
solana --version
```

If the version printed out after running `solana --version` is less than `1.18.0` then you can update the cli version manually. Note, at the time of writing this, you cannot simply run the `solana-install update` command. This command will not update the CLI to the correct version for us, so we have to explicitly download version `1.18.0`. You can do so with the following command:

```bash
solana-install init 1.18.0
```

If you run into this error at any point attempting to build the program, that likely means you do not have the correct version of the solana CLI installed.

```bash
anchor build
error: package `solana-program v1.18.0` cannot be built because it requires rustc 1.72.0 or newer, while the currently active rustc version is 1.68.0-dev
Either upgrade to rustc 1.72.0 or newer, or use
cargo update -p solana-program@1.18.0 --precise ver
where `ver` is the latest version of `solana-program` supporting rustc 1.68.0-dev
```

You will also want the latest version of the anchor CLI installed. You can follow along the steps listed here to update via avm https://www.anchor-lang.com/docs/avm

or simply run
```bash
avm install latest
avm use latest
```

At the time of writing, the latest version of the Anchor CLI is `0.29.0`

Now, we can check our rust version.

```bash
rustc --version
```

At the time of writing, version `1.76.0` was used for the rust compiler. If you would like to update, you can do so via `rustup`
https://doc.rust-lang.org/book/ch01-01-installation.html

```bash
rustup update
```

Now, we should have all the correct versions installed.

## 2. Get starter code and add dependencies

Let's grab the starter branch.

```bash
git clone https://github.com/Unboxed-Software/token22-staking
cd token22-staking
git checkout starter
```

## 3. Update Program ID and Anchor Keypair

Once in the starter branch, run

`anchor keys list`

to get your program ID.

Copy and paste this program ID in the `Anchor.toml` file

```rust
// in Anchor.toml
[programs.localnet]
token_22_staking = "<YOUR-PROGRAM-ID-HERE>"
```

And in the `programs/token-22-staking/src/lib.rs` file.

```rust
declare_id!("<YOUR-PROGRAM-ID-HERE>");
```

Lastly set your developer keypair path in `Anchor.toml`.

```toml
[provider]
cluster = "Localnet"
wallet = "/YOUR/PATH/HERE/id.json"
```

If you don't know what your current keypair path is you can always run the solana cli to find out.

```bash
solana config get
```

## 4. Confirm the program builds

Let's build the starter code to confirm we have everything configured correctly. If it does not build, please revisit the steps above.

```bash
anchor build
```

You can safely ignore the warnings of the build script, these will go away as we add in the necessary code. But at the end you should see a message like this:

```bash
 Finished release [optimized] target(s)
 ```

Feel free to run the provided tests to make sure the rest of the dev environment is setup correct. You'll have to install the node dependancies using `npm` or `yarn`. The tests should run, but they'll all fail until we have completed our program.

```bash
yarn install
anchor test
```

you should see that 4 tests are passed, this is because we don't have any code written yet.

## 5. Explore program design

Now that we have confirmed the program builds, let's take a look at the layout of the program. To make this as simple as possible we will have only two files to play with
* `programs/transfer-hook/src/lib.rs`
* `tests/anchor.ts`


`lib.rs` is where we will write the onchaing program logic and `anchor.ts` is where we will write the tests.

## 6. Write the transfer hook program

as you can see in the starter code, the `lib.rs` have two main functions `initialize_extra_account_meta_list` and `transfer_hook`. A fallback function `fallback`. And two structs `InitializeExtraAccountMetaList` and `TransferHook`.

```rust
use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{ token_2022, token, associated_token::AssociatedToken, token_interface::{ Mint, TokenAccount, TokenInterface }};
use spl_transfer_hook_interface::instruction::{ ExecuteInstruction, TransferHookInstruction };
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};

declare_id!("YOUR PROGRAM ID HERE");

#[program]
pub mod transfer_hook {
    use super::*;

    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        Ok(())
    }

    pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
        Ok(())
    }

    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList {}

#[derive(Accounts)]
pub struct TransferHook {}
```

we will discus and implement each one of them

### 1. Initialize Extra Account Meta List
In this step, we will implement the `initialize_extra_account_meta_list` instruction for our Transfer Hook program. This instruction creates an `ExtraAccountMetas` account, which will store the additional accounts required by our `transfer_hook` instruction.

In this example, the initialize_extra_account_meta_list instruction requires 7 accounts:
- `payer` - The account that will pay for the creation of the ExtraAccountMetaList account.
- `extra_account_meta_list` - The ExtraAccountMetaList account that will store the additional accounts required by the transfer_hook instruction.
- `mint` - The mint account of the token to be transferred.
- `token_program` - The token program account, we need to have it there because we are doing init for the `crumb_mint` account.
- `system_program` - The system program account, we need to have it there because we are doing init for the `crumb_mint` account.
- `crumb_mint` - The mint account of the token to be minted by the transfer_hook instruction.
- `mint_authority` - The mint authority account of the token to be minted by the transfer_hook instruction.
- `crumb_mint_ata` - The associated token account of the token to be minted by the transfer_hook instruction.

This is the code for the struct `InitializeExtraAccountMetaList`:

```rust
#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  /// CHECK: ExtraAccountMetaList Account, must use these seeds
  #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump
    )]
  pub extra_account_meta_list: AccountInfo<'info>,
  pub mint: InterfaceAccount<'info, Mint>,
  pub token_program: Interface<'info, TokenInterface>,
  pub system_program: Program<'info, System>,

  #[account(init, payer = payer, mint::decimals = 0, mint::authority = mint_authority)]
  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  /// CHECK: ATA Account for crumb mint
  pub crumb_mint_ata: UncheckedAccount<'info>,
}
```

Next for the function it self, let's walk through the function logic.

1. List the accounts required for the transfer hook instruction inside a vector.
    - there are three methods for storing these accounts:
        1. Directly store the account address by using `ExtraAccountMeta::new_with_pubkey` this is useful
        2. Store the seeds to derive a PDA for the Transfer Hook program using `ExtraAccountMeta::new_with_seeds`
        3. Store the seeds to derive a PDA for a program other than the Transfer Hook program using `ExtraAccountMeta::new_external_pda_with_seeds`, notice that we didn't use this method in the code provided because it was causing some issues, it should get fixed in future updates.
    - the seed could be a string, a instruction data, an account data or an account key, and to get the account key you will need to have it's index, take a look at the this code:

```rust
    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    let account_metas = vec![
      // index 4, Token 22 program
      ExtraAccountMeta::new_with_pubkey(&token_2022::ID, false, false)?,
      // index 5, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 6, associated token program
      ExtraAccountMeta::new_with_pubkey(&anchor_spl::associated_token::ID, false, false)?,
      // index 7, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?,
      // index 8, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        true // is_writable
      )?,
      // index 9, ATA
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint_ata.key(), false, true)?
    ];
```

As you can see in the comments, the index 0-3 are the accounts required for token transfer (source, mint, destination, owner), and the rest are the extra accounts required from the ExtraAccountMetaList account. you will need these indexes if you want to use one of the accounts key or data as a seed. To get more familiar with the seeds take a look at the seed enum implementation from [spl_tlv_account_resolution::seeds::Seed](https://github.com/solana-labs/solana-program-library/blob/master/libraries/tlv-account-resolution/src/seeds.rs)

```rust
pub enum Seed {
    /// Uninitialized configuration byte space
    Uninitialized,
    /// A literal hard-coded argument
    /// Packed as:
    ///     * 1 - Discriminator
    ///     * 1 - Length of literal
    ///     * N - Literal bytes themselves
    Literal {
        /// The literal value repesented as a vector of bytes.
        ///
        /// For example, if a literal value is a string literal,
        /// such as "my-seed", this value would be
        /// `"my-seed".as_bytes().to_vec()`.
        bytes: Vec<u8>,
    },
    /// An instruction-provided argument, to be resolved from the instruction
    /// data
    /// Packed as:
    ///     * 1 - Discriminator
    ///     * 1 - Start index of instruction data
    ///     * 1 - Length of instruction data starting at index
    InstructionData {
        /// The index where the bytes of an instruction argument begin
        index: u8,
        /// The length of the instruction argument (number of bytes)
        ///
        /// Note: Max seed length is 32 bytes, so `u8` is appropriate here
        length: u8,
    },
    /// The public key of an account from the entire accounts list.
    /// Note: This includes an extra accounts required.
    ///
    /// Packed as:
    ///     * 1 - Discriminator
    ///     * 1 - Index of account in accounts list
    AccountKey {
        /// The index of the account in the entire accounts list
        index: u8,
    },
    /// An argument to be resolved from the inner data of some account
    /// Packed as:
    ///     * 1 - Discriminator
    ///     * 1 - Index of account in accounts list
    ///     * 1 - Start index of account data
    ///     * 1 - Length of account data starting at index
    AccountData {
        /// The index of the account in the entire accounts list
        account_index: u8,
        /// The index where the bytes of an account data argument begin
        data_index: u8,
        /// The length of the argument (number of bytes)
        ///
        /// Note: Max seed length is 32 bytes, so `u8` is appropriate here
        length: u8,
    },
}
```

2. Calculate the size and rent required to store the list of ExtraAccountMetas.

```rust
// calculate account size
let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
// calculate minimum required lamports
let lamports = Rent::get()?.minimum_balance(account_size as usize);
```

3. Make a CPI to the System Program to create an account and set the Transfer Hook Program as the owner. The PDA seeds are included as signer seeds
on the CPI because we are using the PDA as the address of the new account.

```rust
let mint = ctx.accounts.mint.key();
let signer_seeds: &[&[&[u8]]] = &[&[
    b"extra-account-metas",
    &mint.as_ref(),
    &[ctx.bumps.extra_account_meta_list],
]];

// create ExtraAccountMetaList account
create_account(
    CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        CreateAccount {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.extra_account_meta_list.to_account_info(),
        },
    )
    .with_signer(signer_seeds),
    lamports,
    account_size,
    ctx.program_id,
)?;
```

4. Initialize the account data to store the list of ExtraAccountMetas.

```rust
// initialize ExtraAccountMetaList account with extra accounts
ExtraAccountMetaList::init::<ExecuteInstruction>(
    &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
    &account_metas,
)?;
```

if we put all of that together we get the following code:

```rust
pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // 1. List the accounts required for the transfer hook instruction inside a vector.

    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    let account_metas = vec![
      // index 4, Token 22 program
      ExtraAccountMeta::new_with_pubkey(&token_2022::ID, false, false)?,
      // index 5, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 6, associated token program
      ExtraAccountMeta::new_with_pubkey(&anchor_spl::associated_token::ID, false, false)?,
      // index 7, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?,
      // index 8, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        true // is_writable
      )?,
      // index 9, ATA
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint_ata.key(), false, true)?
    ];
    // 2. Calculate the size and rent required to store the list of

    // calculate account size
    let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
    // calculate minimum required lamports
    let lamports = Rent::get()?.minimum_balance(account_size as usize);

    // 3. Make a CPI to the System Program to create an account and set the
    let mint = ctx.accounts.mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[b"extra-account-metas", &mint.as_ref(), &[ctx.bumps.extra_account_meta_list]]];

    // Create ExtraAccountMetaList account
    create_account(
      CpiContext::new(ctx.accounts.system_program.to_account_info(), CreateAccount {
        from: ctx.accounts.payer.to_account_info(),
        to: ctx.accounts.extra_account_meta_list.to_account_info(),
      }).with_signer(signer_seeds),
      lamports,
      account_size,
      ctx.program_id
    )?;

    // 4. Initialize the account data to store the list of ExtraAccountMetas
    ExtraAccountMetaList::init::<ExecuteInstruction>(
      &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
      &account_metas
    )?;

    Ok(())
  }
  ```

<Callout type="info">

In this example, we are not using the Transfer Hook interface to create the
ExtraAccountMetas account.

</Callout>


### 2. Transfer Hook
In this step, we will implement the `transfer_hook` instruction for our Transfer Hook program. This instruction will be called by the token program when a token transfer occurs. The transfer_hook instruction will mint a new token for each transfer.

In this example, the transfer_hook instruction requires 10 accounts:
- `source_token` The source token account from which tokens are transferred.
- `mint` The mint account of the token to be transferred.
- `destination_token` The destination token account to which tokens are transferred.
- `owner` The owner of the source token account.
- `extra_account_meta_list` The ExtraAccountMetaList account that stores the additional accounts required by the transfer_hook instruction.
- `token_extension_program` The token extension program account.
- `token_program` The token program account.
- `associated_token_program` The associated token program account.
- `crumb_mint` The mint account of the token to be minted by the transfer_hook instruction.
- `mint_authority` The mint authority account of the token to be minted by the transfer_hook instruction.
- `crumb_mint_ata` The associated token account of the token to be minted by the transfer_hook instruction.

So first let's implement the `TransferHook` struct to have all the accounts above by replacing the following

<Callout type="info">

Note that the order of accounts in this struct matters. This is the order in
which the Token Extensions program provides these accounts when it CPIs to this
Transfer Hook program.

</Callout>

```rust
// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the token2022 program
#[derive(Accounts)]
pub struct TransferHook<'info> {
  #[account(token::mint = mint, token::authority = owner)]
  pub source_token: InterfaceAccount<'info, TokenAccount>,
  pub mint: InterfaceAccount<'info, Mint>,
  #[account(token::mint = mint)]
  pub destination_token: InterfaceAccount<'info, TokenAccount>,
  /// CHECK: source token account owner
  pub owner: UncheckedAccount<'info>,

  /// CHECK: ExtraAccountMetaList Account,
  #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
  pub extra_account_meta_list: UncheckedAccount<'info>,

  pub token_extension_program: Interface<'info, TokenInterface>,

  pub token_program: Interface<'info, TokenInterface>,

  pub associated_token_program: Program<'info, AssociatedToken>,

  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  #[account(token::mint = crumb_mint)]
  pub crumb_mint_ata: InterfaceAccount<'info, TokenAccount>,
}
```

Next for the function it self, all what the function will do is it will take the needed accounts from `ctx.accounts` and use them to mint a new token for each transaction.


```rust
  pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[b"mint-authority", &[ctx.bumps.mint_authority]]];
    // mint a crumb token for each transaction
    mint_to(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
          mint: ctx.accounts.crumb_mint.to_account_info(),
          to: ctx.accounts.crumb_mint_ata.to_account_info(),
          authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer_seeds
      ),
      1
    ).unwrap();

    Ok(())
  }
```

Notice that we do have the amount of the original transfer, in our case that will always be `1` because we are dealing with NFTs, but if you have a different token you will get the amount of how much did they transfer.

Good to know that the transfer hook get called after the transfer happens, so at the point when the transfer hook is getting invoked, the tokens has already left the sender account and get to the receiver account.


### 3. Fallback
In addition, we must include a `fallback` instruction in the Anchor program to handle the Cross-Program Invocation (CPI) from the Token Extensions program.

This is necessary because Anchor generates instruction discriminators differently from the ones used in Transfer Hook interface instructions. The instruction discriminator for the `transfer_hook` instruction will not match the one for the Transfer Hook interface

Next versions of anchor should solve this for us, but for now we can implement this simpl workaround

```rust
// fallback instruction handler as workaround to anchor instruction discriminator check
pub fn fallback<'info>(program_id: &Pubkey, accounts: &'info [AccountInfo<'info>], data: &[u8]) -> Result<()> {
  let instruction = TransferHookInstruction::unpack(data)?;

  // match instruction discriminator to transfer hook interface execute instruction
  // token2022 program CPIs this instruction on token transfer
  match instruction {
      TransferHookInstruction::Execute { amount } => {
      let amount_bytes = amount.to_le_bytes();
  
      // invoke custom transfer hook instruction on our program
      __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
      }
      _ => {
      return Err(ProgramError::InvalidInstructionData.into());
      }
  }
}
```

### 4. Bring it all together

you `lib.rs` file should look like this:


```rust
// in programs/transfer-hook/src/lib.rs
use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{ token_2022, token, associated_token::AssociatedToken, token_interface::{ Mint, TokenAccount, TokenInterface }};
use spl_transfer_hook_interface::instruction::{ ExecuteInstruction, TransferHookInstruction };
use spl_tlv_account_resolution::{account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList};

declare_id!("YOUR PROGRAM ID HERE");

#[program]
pub mod transfer_hook {
  use anchor_spl::token::mint_to;

  use super::*;

pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // 1. List the accounts required for the transfer hook instruction inside a vector.

    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    let account_metas = vec![
      // index 4, Token 22 program
      ExtraAccountMeta::new_with_pubkey(&token_2022::ID, false, false)?,
      // index 5, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 6, associated token program
      ExtraAccountMeta::new_with_pubkey(&anchor_spl::associated_token::ID, false, false)?,
      // index 7, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?,
      // index 8, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        true // is_writable
      )?,
      // index 9, ATA
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint_ata.key(), false, true)?
    ];
    // 2. Calculate the size and rent required to store the list of

    // calculate account size
    let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
    // calculate minimum required lamports
    let lamports = Rent::get()?.minimum_balance(account_size as usize);

    // 3. Make a CPI to the System Program to create an account and set the
    let mint = ctx.accounts.mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[b"extra-account-metas", &mint.as_ref(), &[ctx.bumps.extra_account_meta_list]]];

    // Create ExtraAccountMetaList account
    create_account(
      CpiContext::new(ctx.accounts.system_program.to_account_info(), CreateAccount {
        from: ctx.accounts.payer.to_account_info(),
        to: ctx.accounts.extra_account_meta_list.to_account_info(),
      }).with_signer(signer_seeds),
      lamports,
      account_size,
      ctx.program_id
    )?;

    // 4. Initialize the account data to store the list of ExtraAccountMetas
    ExtraAccountMetaList::init::<ExecuteInstruction>(
      &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
      &account_metas
    )?;

    Ok(())
  }

  pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[b"mint-authority", &[ctx.bumps.mint_authority]]];
    // mint a crumb token for each transaction
    mint_to(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
          mint: ctx.accounts.crumb_mint.to_account_info(),
          to: ctx.accounts.crumb_mint_ata.to_account_info(),
          authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer_seeds
      ),
      1
    ).unwrap();

    Ok(())
  }

  // fallback instruction handler as workaround to anchor instruction discriminator check
  pub fn fallback<'info>(program_id: &Pubkey, accounts: &'info [AccountInfo<'info>], data: &[u8]) -> Result<()> {
    let instruction = TransferHookInstruction::unpack(data)?;

    // match instruction discriminator to transfer hook interface execute instruction
    // token2022 program CPIs this instruction on token transfer
    match instruction {
      TransferHookInstruction::Execute { amount } => {
        let amount_bytes = amount.to_le_bytes();

        // invoke custom transfer hook instruction on our program
        __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
      }
      _ => {
        return Err(ProgramError::InvalidInstructionData.into());
      }
    }
  }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  /// CHECK: ExtraAccountMetaList Account, must use these seeds
  #[account(
        mut,
        seeds = [b"extra-account-metas", mint.key().as_ref()], 
        bump
    )]
  pub extra_account_meta_list: AccountInfo<'info>,
  pub mint: InterfaceAccount<'info, Mint>,
  pub token_program: Interface<'info, TokenInterface>,
  pub associated_token_program: Program<'info, AssociatedToken>,
  pub system_program: Program<'info, System>,

  #[account(init, payer = payer, mint::decimals = 0, mint::authority = mint_authority)]
  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  /// CHECK: ATA,
  pub crumb_mint_ata: UncheckedAccount<'info>,
}

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the token2022 program
#[derive(Accounts)]
pub struct TransferHook<'info> {
  #[account(token::mint = mint, token::authority = owner)]
  pub source_token: InterfaceAccount<'info, TokenAccount>,
  pub mint: InterfaceAccount<'info, Mint>,
  #[account(token::mint = mint)]
  pub destination_token: InterfaceAccount<'info, TokenAccount>,
  /// CHECK: source token account owner
  pub owner: UncheckedAccount<'info>,

  /// CHECK: ExtraAccountMetaList Account,
  #[account(seeds = [b"extra-account-metas", mint.key().as_ref()], bump)]
  pub extra_account_meta_list: UncheckedAccount<'info>,

  pub token_extension_program: Interface<'info, TokenInterface>,

  pub token_program: Interface<'info, TokenInterface>,

  pub associated_token_program: Program<'info, AssociatedToken>,

  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  #[account(token::mint = crumb_mint)]
  pub crumb_mint_ata: InterfaceAccount<'info, TokenAccount>,
}
```

### Build and Deploy Program

To make sure that every thing is working fine, you should be able to build and deploy your program now

```bash
anchor test
```

this command will build, deploy and run the tests for your program, if everything is working fine you should see this output

```output
Finished release [optimized] target(s) in 0.24s

Found a 'test' script in the Anchor.toml. Running it as a test suite!

Running test suite: "/Users/mohammed/code/unboxed/solana-token-22-course/token22-transfer-hook/Anchor.toml"

yarn run v1.22.21
warning package.json: No license field
$ /Users/mohammed/code/unboxed/solana-token-22-course/token22-transfer-hook/node_modules/.bin/ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/*.ts'
(node:65231) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)


  transfer-hook
    ✔ Create NFT Account with Transfer Hook Extension
    ✔ Create Token Accounts and Mint Tokens
    ✔ Create ExtraAccountMetaList Account
    ✔ Transfer Hook with Extra Account Meta


  4 passing (2ms)

✨  Done in 1.02s.
```


## 7. Write the tests

Now we will write some TS script to test our code, let's go inside file inside `tests/anchor.ts` and start writing the tests

### Helpers

inside `helpers/helpers.ts` you will find some helper functions that we will use in our tests, the most important ones are:

1. `airdropSolIfNeeded`: if you are low on sols, it will airdrop two sols to your wallet.
2. `getMetadataObject`: takes the token metadata as an input, uploads the offchain metadata to Arweave, and finally returns the metadata object, if you want to learn more about metadata you can visit the Metadata Extension Lesson.

### prepare the environment:

inside the describe function block you will see some anchor code to get the program, the wallet, the connection, and it is setting up the environment. Other than that it is airdropping some sols into the wallet if needed before running any of the tests.

And to get us started we will add some code:

1. Generate new keypairs for the mint and the crumb mint
2. Get the source token accounts
3. Generate new keypair for the recipient, and get the destination token account from it
4. Derive the PDA for the extra account meta list
5. Derive the PDA for the crumb mint authority to be a PDA of the transfer hook program itself, this is important because we are going to mint tokens in the program and we need the mint authority to sign the transaction, so by making the mint authority a PDA of the transfer hook program we can use it to sign the transaction, because in solana a program could sign for any of its PDAs.
6. Get the associated token account for the crumb mint

```ts
// 1. Generate new keypairs for the mint and the crumb mint
const mint = new Keypair();
const crumbMint = new Keypair();

// 2. Get the source token accounts
const sourceTokenAccount = getAssociatedTokenAddressSync(
mint.publicKey,
wallet.publicKey,
false,
TOKEN_2022_PROGRAM_ID,
ASSOCIATED_TOKEN_PROGRAM_ID,
);

// 3. Generate new keypair for the recipient, and get the destination token account from it
const recipient = Keypair.generate();
console.log('Recipient:', recipient.publicKey.toBase58());
const destinationTokenAccount = getAssociatedTokenAddressSync(
mint.publicKey,
recipient.publicKey,
false,
TOKEN_2022_PROGRAM_ID,
ASSOCIATED_TOKEN_PROGRAM_ID,
);

// 4. Derive the PDA for the ExtraAccountMetaList
const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
[Buffer.from('extra-account-metas'), mint.publicKey.toBuffer()],
program.programId,
);

// 5. Derive the PDA for the crumb mint authority to be a PDA of the transfer hook program itself
const [crumbMintAuthority] = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], program.programId);

// 6. Get the associated token account for the crumb mint
const crumbMintATA = getAssociatedTokenAddressSync(crumbMint.publicKey, crumbMintAuthority, true);
```

### Create an NFT with Transfer Hook Extension and Metadata

One more awesome things about extensions is that you can mix and match them as you like. so in this test we will create a new NFT mint account with the transfer hook extension and the metadata extension, and it will goes as follows:

1. Get the metadata object: we will use a the helper function `getMetadataObject` for that, notice that we are passing an `imagePath`, so for this you will have to grape an image and put it in the `helpers` folder, for this example let's call it `cool-cookie.png`.
2. Get the minimum balance for the mint account, and calculate the size of the mint and the metadata
3. Create a transaction that will:
    - Allocate the mint account
    - Initialize the metadata pointer and let it point to the mint itself
    - Initialize the transfer hook extension and point to our program
    - Initialize mint instruction
    - Initialize metadata which will set all the metadata for the NFT
4. send the transaction and log the transaction signature

```ts
it('Creates an NFT with Transfer Hook Extension and Metadata', async () => {
    // 1. get the metadata object
    const metadata = await getMetadataObject({
      connection,
      imagePath: 'helpers/cool-cookie.png',
      tokenName: 'Cool Cookie',
      tokenSymbol: 'COOKIE',
      tokenDescription: 'A cool cookie',
      mintPublicKey: mint.publicKey,
      additionalMetadata: [],
      payer: wallet.payer,
    });
    // NFT Should have 0 decimals
    const decimals = 0;

    // 2. Get the minimum balance for the mint account, and calculate the size of the mint and the metadata
    const extensions = [ExtensionType.TransferHook, ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

    // 3. Create a transaction that will:
    const transaction = new Transaction().add(
      // Allocate the mint account
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      // Initialize the metadata pointer and let it point to the mint itself
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      // Initialize the transfer hook extension and point to our program
      createInitializeTransferHookInstruction(
        mint.publicKey,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID,
      ),
      // Initialize mint instruction
      createInitializeMintInstruction(mint.publicKey, decimals, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
      // Initialize metadata which will set all the metadata for the NFT
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mint.publicKey,
        metadata: mint.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      }),
    );
    // 4. send the transaction and log the transaction signature
    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer, mint]);
    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });
  ```

### Create Token Accounts and Mint The NFT

In the second test we will:
1. Create the associated token accounts for the sender and the recipient
2. Mint the NFT and set the mint authority to null so no one can mint any more tokens

```ts
  it('Create Token Accounts and Mint The NFT', async () => {
    // 1 NFT
    const amount = 1;

    const transaction = new Transaction().add(
      // 1. Create the associated token accounts for the sender and the recipient
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      // 2. Mint the NFT and set the mint authority to null so no one can mint any more tokens
      createMintToInstruction(mint.publicKey, sourceTokenAccount, wallet.publicKey, amount, [], TOKEN_2022_PROGRAM_ID),
      createSetAuthorityInstruction(
        mint.publicKey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer], { skipPreflight: true });

    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });
```

### Initialize ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint

All what we did before is kinda familiar except the fact that we are using extensions with the token account, Now we will work on some new stuff in this test.

in order for the transfer hook to work it needs an extra data account that will hold any extra accounts needed for the logic of the transfer hook.
Note when we do a transfer using the Token Extension program, the program will look into our mint and see if it has a transfer hook or not, if it 
has one the Token Extension program will make a CPI (cross-program invocation) to our transfer hook program, and it will pass 4 essential things to
our program (sender, mint, receiver, owner) but before passing them it will deescalate them, in other words it will remove the mutable or signing 
abilities for security reasons, so when our program gets these accounts, they will be read-only, the program can't change anything in these accounts,
and it can't sign any transactions with them, so if we have logic that needs to change some account or make some transactions we only have two options:

1. we can use the PDA features, because the program on Solana can sign to any PDA that it owns, so for this example we need to mint some tokens, and in 
order to do that we need to make a transactions, and the mint authority should sign this transaction, so we set the mint authority to be a PDA of our program,
this way we are able to do the mint operation and sign the transaction.
2. adding the account in the `extraAccountMetaList`, we can add any account we want and make writable/signer, and when the Token Extension program makes the
CPI to our program, it will pass the extra account meta list account, and our program can use it to get the extra accounts and use them in the logic.

Note that if you are going to pass the Mint account in the extra account list in order to get it as mutable, that is not going to work. At the time of creating this lesson,
when the Token Extension program makes the CPI to our program, it will pass the mint account as read-only no matter how many times you add it to the extra accounts list.

So in this test we will initialize the extra account meta list account, to do so we will have to pass the needed account (mint, crumb mint, crumb mint ATA, extraAccountMetaList).
one more thing to do in this test is to initialize the crumb mint ATA, so we can mint from crumb tokens to it in the next test.

```ts
it('Initializes ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint', async () => {
    const initializeExtraAccountMetaListInstruction = await program.methods
        .initializeExtraAccountMetaList()
        .accounts({
        mint: mint.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        crumbMint: crumbMint.publicKey,
        crumbMintAta: crumbMintATA,
        })
        .instruction();

    const transaction = new Transaction().add(
        initializeExtraAccountMetaListInstruction,
        createAssociatedTokenAccountInstruction(wallet.publicKey, crumbMintATA, crumbMintAuthority, crumbMint.publicKey),
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer, crumbMint], {
        skipPreflight: true,
        commitment: 'confirmed',
    });

    console.log(
        'Transaction Signature:',
        `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
});
```


### Transfer the NFT and the transfer hook mints a crumb token for each transfer

```ts
  it('Transfers the NFT and the transfer hook mints a crumb token for each transfer', async () => {
    const amount = 1;
    const bigIntAmount = BigInt(amount);

    // Standard token transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mint.publicKey,
      destinationTokenAccount,
      wallet.publicKey,
      bigIntAmount,
      0, // Decimals
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transferBackInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      destinationTokenAccount,
      mint.publicKey,
      sourceTokenAccount,
      recipient.publicKey,
      bigIntAmount,
      0, // Decimals
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transaction = new Transaction().add(transferInstruction, transferBackInstruction);

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer, recipient], {
      skipPreflight: true,
    });
    console.log(
      'Transfer Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );

    const mintInfo = await getMint(connection, crumbMint.publicKey, 'processed');
    console.log('Mint Info:', Number(mintInfo.supply));

    expect(Number(mintInfo.supply)).to.equal(2);
  });
```

### Putting it all together

after assembling all the tests, your `tests/anchor.ts` file should look like this:

```ts
// in tests/anchor.ts
import * as anchor from '@coral-xyz/anchor';
import { TransferHook } from '../target/types/transfer_hook';
import { Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferCheckedWithTransferHookInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from '@solana/spl-token';
import { createInitializeInstruction, pack } from '@solana/spl-token-metadata';
import { expect } from 'chai';
import { airdropSolIfNeeded, getMetadataObject } from '../helpers/helpers';

describe('transfer-hook', () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TransferHook as anchor.Program<TransferHook>;

  const wallet = provider.wallet as anchor.Wallet;

  const connection = provider.connection;

  // Generate keypair to use as address for the transfer-hook enabled mint
  const mint = new Keypair();

  const crumbMint = new Keypair();

  // Sender token account address
  const sourceTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Recipient token account address
  const recipient = Keypair.generate();
  console.log('Recipient:', recipient.publicKey.toBase58());
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // ExtraAccountMetaList address
  // Store extra accounts required by the custom transfer hook instruction
  const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('extra-account-metas'), mint.publicKey.toBuffer()],
    program.programId,
  );

  // PDA from the transfer hook program to be used as the mint authority for the crumb mint
  const [crumbMintAuthority] = PublicKey.findProgramAddressSync([Buffer.from('mint-authority')], program.programId);

  // Associated token account for the crumb mint
  const crumbMintATA = getAssociatedTokenAddressSync(crumbMint.publicKey, crumbMintAuthority, true);

  before('Airdrop SOL', async () => {
    await airdropSolIfNeeded(wallet.payer, provider.connection);
  });

  it('Creates an NFT with Transfer Hook Extension and Metadata', async () => {
    const metadata = await getMetadataObject({
      connection,
      imagePath: 'helpers/cool-cookie.png',
      tokenName: 'Cool Cookie',
      tokenSymbol: 'COOKIE',
      tokenDescription: 'A cool cookie',
      mintPublicKey: mint.publicKey,
      additionalMetadata: [],
      payer: wallet.payer,
    });

    // NFT Should have 0 decimals
    const decimals = 0;

    const extensions = [ExtensionType.TransferHook, ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
    const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

    const transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports: lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMetadataPointerInstruction(
        mint.publicKey,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeTransferHookInstruction(
        mint.publicKey,
        wallet.publicKey,
        program.programId, // Transfer Hook Program ID
        TOKEN_2022_PROGRAM_ID,
      ),
      createInitializeMintInstruction(mint.publicKey, decimals, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
      createInitializeInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        mint: mint.publicKey,
        metadata: mint.publicKey,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
      }),
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer, mint]);
    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  // Create the two token accounts for the transfer-hook enabled mint
  // Fund the sender token account with 100 tokens
  it('Creates Token Accounts and Mint The NFT', async () => {
    // 1 NFT
    const amount = 1;

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        sourceTokenAccount,
        wallet.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        destinationTokenAccount,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
      createMintToInstruction(mint.publicKey, sourceTokenAccount, wallet.publicKey, amount, [], TOKEN_2022_PROGRAM_ID),
      createSetAuthorityInstruction(
        mint.publicKey,
        wallet.publicKey,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer], { skipPreflight: true });

    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  // Account to store extra accounts required by the transfer hook instruction
  it('Initializes ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint', async () => {
    const initializeExtraAccountMetaListInstruction = await program.methods
      .initializeExtraAccountMetaList()
      .accounts({
        mint: mint.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        crumbMint: crumbMint.publicKey,
        crumbMintAta: crumbMintATA,
      })
      .instruction();

    const transaction = new Transaction().add(
      initializeExtraAccountMetaListInstruction,
      createAssociatedTokenAccountInstruction(wallet.publicKey, crumbMintATA, crumbMintAuthority, crumbMint.publicKey),
    );

    const txSig = await sendAndConfirmTransaction(provider.connection, transaction, [wallet.payer, crumbMint], {
      skipPreflight: true,
      commitment: 'confirmed',
    });
    console.log(
      'Transaction Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );
  });

  it('Transfers the NFT and the transfer hook mints a crumb token for each transfer', async () => {
    const amount = 1;
    const bigIntAmount = BigInt(amount);

    // Standard token transfer instruction
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mint.publicKey,
      destinationTokenAccount,
      wallet.publicKey,
      bigIntAmount,
      0, // Decimals
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transferBackInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      destinationTokenAccount,
      mint.publicKey,
      sourceTokenAccount,
      recipient.publicKey,
      bigIntAmount,
      0, // Decimals
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );

    const transaction = new Transaction().add(transferInstruction, transferBackInstruction);

    const txSig = await sendAndConfirmTransaction(connection, transaction, [wallet.payer, recipient], {
      skipPreflight: true,
    });
    console.log(
      'Transfer Signature:',
      `https://explorer.solana.com/tx/${txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`,
    );

    const mintInfo = await getMint(connection, crumbMint.publicKey, 'processed');
    console.log('Mint Info:', Number(mintInfo.supply));

    expect(Number(mintInfo.supply)).to.equal(2);
  });
});
```
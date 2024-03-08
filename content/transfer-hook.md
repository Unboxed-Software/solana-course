---
title: Transfer hook
objectives:
- 
---

# Summary

# Lab
Today we will explore how transfer hooks work solana-side by creating a Cookie Crumb program. We will have a Cookie NFT that has a transfer hook which will mint a crumb token for each transfer, so we would be able to tell how many times this NFT has been transferred by only looking at the crumb supply.

## 0. Setup

### 1. Verify Solana/Anchor/Rust Versions

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

### 2. Get starter code

Let's grab the starter branch.

```bash
git clone https://github.com/Unboxed-Software/solana-lab-transfer-hooks
cd token22-staking
git checkout starter
```

### 3. Update Program ID and Anchor Keypair

Once in the starter branch, run

```bash
anchor keys list
```

to get your program ID.

Copy and paste this program ID in the `Anchor.toml` file

```rust
// in Anchor.toml
[programs.localnet]
token_22_staking = "YOUR PROGRAM ID HERE"
```

And in the `programs/token-22-staking/src/lib.rs` file.

```rust
declare_id!("YOUR PROGRAM ID HERE");
```

Lastly set your developer keypair path in `Anchor.toml` if you don't want to use the default location.

```toml
[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json" // This is the default path, you can change it if you have your keypair in a different location
```

If you don't know what your current keypair path is you can always run the solana cli to find out.

```bash
solana config get
```

### 4. Confirm the program builds

Let's build the starter code to confirm we have everything configured correctly. If it does not build, please revisit the steps above.

```bash
anchor build
```

You can safely ignore the warnings of the build script, these will go away as we add in the necessary code. But at the end you should see a message like this:

```bash
 Finished release [optimized] target(s)
```

Feel free to run the provided tests to make sure the rest of the dev environment is setup correct. You'll have to install the node dependencies using `npm` or `yarn`. The tests should run, but they'll all fail until we have completed our program.

```bash
yarn install
anchor test
```

you should see that 4 tests are passed, this is because we don't have any code written yet.

## 1. Write the transfer hook program

In this section we will dive into writing the onchain transfer hook program using anchor, all the code will go into the `programs/transfer-hook/src/lib.rs` file.

by Takeing a look inside that file, you'll notice we have three instructions `initialize_extra_account_meta_list`, `transfer_hook`, `fallback`. Additionally we have two instruction account struct `InitializeExtraAccountMetaList` and `TransferHook`.

The `initialize_extra_account_meta_list` function initializes the additional accounts needed for the transfer hook.

The `transfer_hook` is the actual CPI called "after" the transfer has been made.

The `fallback` is an anchor adapter function we have to fill out.

We're going to look at each in-depth.

```rust
use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{ token, token_interface::{ Mint, TokenAccount, TokenInterface }};
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

### 1. Initialize Extra Account Meta List instruction
The cookie program needs some extra accounts to be able to mint the crumb tokens which are:
1. `crumb_mint` - The mint account of the token to be minted by the transfer_hook instruction.
2. `crumb_mint_ata` - The associated token account of the crumb mint.
3. `mint_authority` - For the crumb mint.
4. `token_program` - this mint will be a regular SPL token mint.

We are going to store these accounts in the `extra_account_meta_list` account, by invoking the instruction `initialize_extra_account_meta_list` and passing the required accounts to it.

We will have a struct `InitializeExtraAccountMetaList` that will hold the accounts required for the instruction, and the instruction itself `initialize_extra_account_meta_list`.

**`InitializeExtraAccountMetaList` Struct**

1. `extra_account_meta_list` - The PDA that will hold the extra account.
2. `crumb_mint` - The mint account of the crumb token.
3. `crumb_mint_ata` - The associated token account of the crumb token.
4. `mint` - The mint account of the cookie NFT.
5. `mint_authority` - The mint authority account of the crumb token.
6. `payer` - The account that will pay for the creation of the ExtraAccountMetaList account.
7. `token_program` - The token program account.
8. `system_program` - The system program account.


Notice that when we will call the `initialize_extra_account_meta_list` instruction, we will only pass the first 4 accounts (extra_account_meta_list, crumb_mint, crumb_mint_ata, mint), and anchor will infer the rest.

The code for the struct will goes as follows

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

  /// CHECK: mint authority Account for crumb mint
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  /// CHECK: ATA Account for crumb mint
  pub crumb_mint_ata: UncheckedAccount<'info>,
}
```

Notice that we are asking anchor to initialize the `crumb_mint` account for us, by using the `#[account(init, payer = payer,mint::decimals = 0, mint::authority = mint_authority)]` attribute. At the same time we are asking anchor to drive the `mint_authority` account from the seed `b"mint-authority"`.

It's important to make the `mint_authority` a PDA of the transfer hook program itself, this way the program can sign for it when making the mint CPI.

Note that should be able to also drive the `crumb_mint_ata` using `Seed::new_external_pda_with_seeds` but at the time of writing this lesson, this method was causing some issues, so we will derive it in the TS code and pass it as a regular address.

**`initialize_extra_account_meta_list` Instruction**

1. List the accounts required for the transfer hook instruction inside a vector.
2. Calculate the size and rent required to store the list of ExtraAccountMetas.
3. Make a CPI to the System Program to create an account and set the Transfer Hook Program as the owner.
4. Initialize the account data to store the list of ExtraAccountMetas.

```rust
pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // 1. List the accounts required for the transfer hook instruction inside a vector.

    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    let account_metas = vec![
      // index 4, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 5, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?, // is_writable true
      // index 6, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        false // is_writable
      )?,
      // index 7, ATA
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint_ata.key(), false, true)? // is_writable true
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


### 2. Transfer Hook instruction
In this step, we will implement the `transfer_hook` instruction for our Transfer Hook program. This instruction will be called by the token program when a token transfer occurs. The transfer_hook instruction will mint a new crumb token for each transfer.

Again we will have a struct `TransferHook` that will hold the accounts required for the instruction, and the instruction itself `transfer_hook` which will make a CPI to the token program to mint a new crumb token for each transfer.

**`TransferHook` Struct**

In this example the `TransferHook` struct will have 9 accounts:
1. `source_token` - The source token account from which the NFT is transferred.
2. `mint` - The mint account of the Cookie NFT.
3. `destination_token` - The destination token account to which the NFT is transferred.
4. `owner` - The owner of the source token account.
5. `extra_account_meta_list` - The ExtraAccountMetaList account that stores the additional accounts required by the transfer_hook instruction
6. `token_program` - The token program account.
7. `crumb_mint` - The mint account of the token to be minted by the transfer_hook instruction.
8. `mint_authority` - The mint authority account of the token to be minted by the transfer_hook instruction.
9. `crumb_mint_ata` - The associated token account of the token to be minted by the transfer_hook instruction.


<Callout type="info">

Note that the order of accounts in this struct matters. This is the order in
which the Token Extensions program provides these accounts when it CPIs to this
Transfer Hook program.

</Callout>

```rust
// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the Token Extension program
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

  pub token_program: Interface<'info, TokenInterface>,

  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  #[account(token::mint = crumb_mint)]
  pub crumb_mint_ata: InterfaceAccount<'info, TokenAccount>,
}
```

**`transfer_hook` Instruction**

This instruction is fairly simple, it will only make one CPI to the token program to mint a new crumb token for each transfer, all what we need to do is to pass the write accounts to the CPI.

Since the mint_authority is a PDA of the transfer hook program itself, the program can sign for it. Therefore we will use `new_with_signer` and pass mint_authority seeds as the signer seeds.

```rust
  pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[b"mint-authority", &[ctx.bumps.mint_authority]]];
    // mint a crumb token for each transaction
    mint_to(
      CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(), // token program
        token::MintTo {
          mint: ctx.accounts.crumb_mint.to_account_info(),
          to: ctx.accounts.crumb_mint_ata.to_account_info(),
          authority: ctx.accounts.mint_authority.to_account_info(),
        },
        signer_seeds
      ),
      1 // amount
    ).unwrap();

    Ok(())
  }
```

Notice that we do have the amount of the original transfer, in our case that will always be `1` because we are dealing with NFTs, but if you have a different token you will get the amount of how much did they transfer.

### 3. Fallback instruction
The last instruction we have to fill out is the `fallback`, this is necessary because Anchor generates instruction discriminators differently from the ones used in Transfer Hook interface instructions. The instruction discriminator for the `transfer_hook` instruction will not match the one for the Transfer Hook interface.


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


Next versions of anchor should solve this for us, but for now we can implement this simpl workaround

### 4. Validate the program

to validate that we are doing fine before moving to the next part, let's bring all the code together and then build and deploy the program

**`lib.rs` File**

```rust
// in programs/transfer-hook/src/lib.rs
use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{ token, token_interface::{ Mint, TokenAccount, TokenInterface }};
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
      // index 4, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 5, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?, // is_writable true
      // index 6, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        false // is_writable
      )?,
      // index 7, ATA
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint_ata.key(), false, true)? // is_writable true
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

  pub token_program: Interface<'info, TokenInterface>,

  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,

  #[account(token::mint = crumb_mint)]
  pub crumb_mint_ata: InterfaceAccount<'info, TokenAccount>,
}
```

**Build and Deploy**

anchor provides one command that will handle the build and the deploy for us.

```bash
anchor test
```

this command will build, deploy the program. Additionally it will run the tests we have inside `tests/` directory, for now the tests are empty and we don't have to worry about them, all what we want is to validate that our program is building and deploying correctly, so the output should look like this:

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

If you got this, congratulations, you have successfully written and deployed the transfer hook program!

if you are seeing some errors try to go through the steps again and make sure you didn't miss anything.

## 7. Write the tests

Now we will write some TS script to test our code, all of our test will live inside `tests/anchor.ts`. Additionally we have some helper functions inside `helpers/helpers.ts` that we will use in our tests.

The outline of what will we do here is:

1. Explore the helpers functions
2. Prepare the environment
3. Write the test for Create an NFT with Transfer Hook Extension and Metadata 
4. Write the test for Create Token Accounts and Mint The NFT
5. Write the test for Initialize ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint
6. Write the test for Transfers the NFT and the transfer hook mints a crumb token for each transfer

### Helpers

inside `helpers/helpers.ts` you should see few functions, the most important two are:

1. `airdropSolIfNeeded`: if you are low on sols, it will airdrop two sols to your wallet.
2. `getMetadataObject`: takes the token metadata as an input, uploads the offchain metadata to Arweave, and finally returns the metadata object, if you want to learn more about metadata you can visit the Metadata Extension Lesson.

### prepare the environment:

Inside the describe function block you will see some anchor code to do the following
1. Get the program.
2. Get the wallet. 
3. Get the connection.
4. Set up the environment
5. Airdrop some SOLs into the wallet if needed before running any of the tests.
6. 4 empty tests that we will talk about later

```ts
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

  before('Airdrop SOL', async () => {
    await airdropSolIfNeeded(wallet.payer, provider.connection);
  });

  it('Creates an NFT with Transfer Hook Extension and Metadata', async () => {});

  it('Creates Token Accounts and Mint The NFT', async () => {});

  it('Initializes ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint', async () => {});

  it('Transfers the NFT and the transfer hook mints a crumb token for each transfer', async () => {});
});
```

To get us started we will have to add few other stuff to our code:

1. Generate new keypairs for the mint and the crumb mint
2. Get the source token accounts
3. Generate new keypair for the recipient, and get the destination token account from it
4. Derive the PDA for the extra account meta list
5. Derive the PDA for the crumb mint authority to be a PDA of the transfer hook program itself
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

One more awesome things about extensions is that you can mix and match them as you like. so in this test we will create a new NFT mint account with the transfer hook extension and the metadata extension.

The test will goes as follows:
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

here we are testing two things:
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

In this test we will:
1. initialize the extra account meta list account, to do so we will have to pass the needed account (mint, crumb mint, crumb mint ATA, extraAccountMetaList).
2. Initialize the crumb mint ATA, so we can mint from crumb tokens to it in the next test.

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

The final test is the transfer test, the whole idea of our lab is to be able to transfer the NFT and making sure that the Token Extension Program is calling our transfer hook program under the hood correctly.

The test will have three parts:
1. Transfer the NFT from the sender to the recipient, after doing that the Token Extension program should call our program and a crumb token should be minted, which means the supply after this transfer finishes should be 1.
2. Transfer the NFT back to the sender, after doing that the Token Extension program should call our program and a crumb token should be minted, which means the supply after this transfer finishes should be 2.
3. Assert that the supply of the crumb mint is 2.

```ts
  it('Transfers the NFT and the transfer hook mints a crumb token for each transfer', async () => {
    const amount = 1;
    const bigIntAmount = BigInt(amount);

    // 1. Transfer the NFT from the sender to the recipient
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

    // 2. Transfer the NFT back to the sender
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

    // 3. Assert that the supply of the crumb mint is 2
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

### Run the tests

You should be able to run
```bash
anchor test
```
and see that all the tests are passing.

You are Done!

# Challenge
Create your own transfer hook...

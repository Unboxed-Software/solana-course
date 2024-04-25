---
title: Transfer Hook
objectives:
- Create a program that applies the "transfer-hook" interface
- Create a mint with a transfer hook
- Transfer a token with a transfer hook successfully
---

# Summary

- The `transfer hook` extension allows developers to run custom logic on their tokens on every transfer
- When a token has a transfer hook, the Token Extensions Program will invoke the transfer hook instruction on every token transfer
- For the program to be able to act as a transfer hook program, it needs to implement the `TransferHook` interface
- Some transfer hooks will require additional accounts, if this is the case, every transfer instruction will have to pass them. These are defined in `extra-account-metas` on the transfer hook extension.
- Within the transfer hook CPI, the sender, mint, receiver, owner are all de-escalated, meaning they are read-only to the hook. Meaning non of those accounts can sign or be written to.

# Overview

The `transfer-hook` extension allows custom on-chain logic to be after each transfer within the same transaction. More specifically, the `transfer-hook` extension requires a 'hook' or 'callback' in the form of a solana program following the [Transfer Hook Interface](https://github.com/solana-labs/solana-program-library/tree/master/token/transfer-hook/interface). Then every time any token of that mint is transferred the Token Extensions Program calls this 'hook' as a CPI.

Additionally, the `transfer-hook` extension also stores `extra-account-metas`, which are any additional accounts needed for the hook to function. 

This extension opens up the door to unique use-cases. One use case it's great for is acting as a token guard, only allowing tokens to be transferred if specific requirements are met.

In this lesson, we'll explore how to implement transfer hooks on-chain and work with them off-chain.

## Implementing transfer hooks onchain

The first part of creating a mint with a `transfer hook` is to find or create an on-chain program that follows the [Transfer Hook Interface](https://github.com/solana-labs/solana-program-library/tree/master/token/transfer-hook/interface).

The Transfer Hook Interface specifies the following [instructions](https://github.com/solana-labs/solana-program-library/blob/master/token/transfer-hook/interface/src/instruction.rs):

- `Execute`: An instruction that the Token Extensions Program invokes on every token transfer
- `InitializeExtraAccountMetaList` (optional): Creates an account (`extra_account_meta_list`) that stores a list of additional accounts required by the `Execute` instruction
- `UpdateExtraAccountMetaList` (optional): Updates the list of additional accounts by overwriting the existing list

Technically it's not required to implement the `InitializeExtraAccountMetaList` instruction using the interface, but it's still required to have the `extra_account_meta_list` account. This account can be created by any instruction on a Transfer Hook program. However, the Program Derived Address (PDA) for the account must be derived using the following seeds:

- The hard coded string `extra-account-metas`
- The Mint Account address
- The Transfer Hook program ID

```js
const [pda] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("extra-account-metas"),
    mint.publicKey.toBuffer()
  ],
  program.programId, // transfer hook program ID
);
```

By storing the extra accounts required by the `Execute` instruction in the `extra_account_meta_list` PDA, these accounts can be automatically added to a token transfer instruction from the client. We'll see how to do that in the off-chain section.

### 1. `initialize_extra_account_meta_list` instruction:

When we transfer a token using the Token Extensions Program, the program will examine our mint to determine if it has a transfer hook. If a transfer hook is present, the Token Extensions Program will initiate a CPI (cross-program invocation) to our transfer hook program. The Token Extensions Program will then pass all the accounts in the transfer (including the extra accounts specified in the `extra_account_meta_list`) to the transfer hook program. However, before passing the 4 essential accounts (sender, mint, receiver, owner), it will de-escalate them (i.e. Remove the mutable or signing abilities for security reasons).

In other words, when our hook receives these accounts, they will be read-only. The transfer hook program cannot modify these accounts, nor can it sign any transactions with them. Although we cannot alter or sign with any of these four accounts, we can specify        `is_signer` and is `is_writable` to any of the additional accounts in the `extra_account_meta_list` PDA. Additionally, we can use the `extra_account_meta_list` PDA as a signer for any new data accounts specified in the hook program.

The `extra_account_meta_list` has to be created before any transfer occurs. It's also worth noting that we can update the list of accounts in the `extra_account_meta_list` by implementing and using the `UpdateExtraAccountMetaList` instruction if necessary.

The `extra_account_meta_list` is just a list of `ExtraAccountMeta`. Let's take a look at the struct `ExtraAccountMeta` [in the source code](https://github.com/solana-labs/solana-program-library/blob/4f1668510adef2117ee3c043bd26b79789e67c8d/libraries/tlv-account-resolution/src/account.rs#L90):

```rust
impl ExtraAccountMeta {
    /// Create a `ExtraAccountMeta` from a public key
    /// This represents standard `AccountMeta`
    pub fn new_with_pubkey(
        pubkey: &Pubkey,
        is_signer: bool,
        is_writable: bool,
    ) -> Result<Self, ProgramError> {
        Ok(Self {
            discriminator: 0,
            address_config: pubkey.to_bytes(),
            is_signer: is_signer.into(),
            is_writable: is_writable.into(),
        })
    }

    /// Create a `ExtraAccountMeta` from a list of seed configurations
    /// This represents a PDA
    pub fn new_with_seeds(
        seeds: &[Seed],
        is_signer: bool,
        is_writable: bool,
    ) -> Result<Self, ProgramError> {
        Ok(Self {
            discriminator: 1,
            address_config: Seed::pack_into_address_config(seeds)?,
            is_signer: is_signer.into(),
            is_writable: is_writable.into(),
        })
    }

    /// Create a `ExtraAccountMeta` from a list of seed configurations, representing
    /// a PDA for an external program
    ///
    /// This PDA belongs to a program elsewhere in the account list, rather
    /// than the executing program. For a PDA on the executing program, use
    /// `ExtraAccountMeta::new_with_seeds`.
    pub fn new_external_pda_with_seeds(
        program_index: u8,
        seeds: &[Seed],
        is_signer: bool,
        is_writable: bool,
    ) -> Result<Self, ProgramError> {
        Ok(Self {
            discriminator: program_index
                .checked_add(U8_TOP_BIT)
                .ok_or(AccountResolutionError::InvalidSeedConfig)?,
            address_config: Seed::pack_into_address_config(seeds)?,
            is_signer: is_signer.into(),
            is_writable: is_writable.into(),
        })
    }
```

We have three methods for creating an `ExtraAccountMeta`:

1. `ExtraAccountMeta::new_with_pubkey` - For any normal account ( Not a program account )
2. `ExtraAccountMeta::new_with_seeds` - For a program account PDA from the calling transfer hook program 
3. `ExtraAccountMeta::new_external_pda_with_seeds` - For a program account PDA from a different external program

Now that we know the accounts we can store in `extra_account_meta_list` the let's talk about the `InitializeExtraAccountMetaList` instruction itself. For most implementations, it should simply just create the `extra_account_meta_list` account and load it up with any additional accounts it needs. 

Let's take a look at a simple example where we'll initialize a `extra_account_meta_list` with two additional arbitrary accounts, `some_account` and a `pda_account`. The `initialize_extra_account_meta_list` function will do the following:

1. Prepare the accounts that we need to store in the `extra_account_meta_list` account as a vector (we'll talk about that in depth in a sec).
2. Calculate the size and rent required to store the list of `ExtraAccountMetas`.
3. Make a CPI to the System Program to create an account and set the Transfer Hook Program as the owner, and then initializing the account data to store the list of `ExtraAccountMetas`.

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

  pub system_program: Program<'info, System>,

  // Accounts to add to the extra-account-metas
  pub some_account: UncheckedAccount<'info>,
  #[account(seeds = [b"some-seed"], bump)]
  pub pda_account: UncheckedAccount<'info>,

}

pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
  let account_metas = vec![
    ExtraAccountMeta::new_with_pubkey(&ctx.accounts.some_account.key(), false, true)?, // Read only
    ExtraAccountMeta::new_with_seeds(
      &[
        Seed::Literal {
          bytes: "some-seed".as_bytes().to_vec(),
        },
      ],
      true, // is_signer
      true // is_writable
    )?,
  ];

  // calculate account size
  let account_size = ExtraAccountMetaList::size_of(account_metas.len())? as u64;
  // calculate minimum required lamports
  let lamports = Rent::get()?.minimum_balance(account_size as usize);

  let mint = ctx.accounts.mint.key();
  let signer_seeds: &[&[&[u8]]] = &[&[b"extra-account-metas", &mint.as_ref(), &[ctx.bumps.extra_account_meta_list]]];

  // create ExtraAccountMetaList account
  create_account(
    CpiContext::new(ctx.accounts.system_program.to_account_info(), CreateAccount {
      from: ctx.accounts.payer.to_account_info(),
      to: ctx.accounts.extra_account_meta_list.to_account_info(),
    }).with_signer(signer_seeds),
    lamports,
    account_size,
    ctx.program_id
  )?;

  // initialize ExtraAccountMetaList account with extra accounts
  ExtraAccountMetaList::init::<ExecuteInstruction>(
    &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
    &account_metas
  )?;

  Ok(())
}
```

Let's dive a little deeper into the `ExtraAccountMeta` you can store. 

You can directly store the account address, store the seeds to derive a PDA of the program itself, and store the seeds to derive a PDA for a program other than the Transfer Hook program.

The first method is straight-forward `ExtraAccountMeta::new_with_pubkey`; you just need an account address. You can pass it to the instruction or get it from a library (like the system program or the token program), or you can even hardcode it.

However, the most interesting part here is storing the seeds, and it could either be a PDA of the transfer hook program itself or a PDA of another program like an associated token account. We can do both of them by using `ExtraAccountMeta::new_with_seeds` and `ExtraAccountMeta::new_external_pda_with_seeds`, respectively, and pass the seeds to them.

To learn how we could pass the seeds, let's take a look at the source code itself:

```rust
pub fn new_with_seeds(
  seeds: &[Seed],
  is_signer: bool,
  is_writable: bool,
)

pub fn new_external_pda_with_seeds(
  program_index: u8,
  seeds: &[Seed],
  is_signer: bool,
  is_writable: bool,
)
```

Both of these methods are similar; the only change is we need to pass the `program_id` for the PDAs that are not of our program in the `new_external_pda_with_seeds` method. Other that that we need to provide a list of seeds (which we'll talk about soon) and two booleans for `is_signer` and `is_writable` to determine if the account should be a signer or writable.

Providing the seeds themselves takes a little explanation. Hard-coded literal seeds are easy enough, but what happens if you want a seed to be variable, say created with the public key of a passed in account? To make sense of this, let's break it down to make it easier to understand. First take a look at the seed enum implementation from [spl_tlv_account_resolution::seeds::Seed](https://github.com/solana-labs/solana-program-library/blob/master/libraries/tlv-account-resolution/src/seeds.rs):

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
        /// The literal value represented as a vector of bytes.
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

As we can see from the code above, there are four main ways to provide seeds:

1. A literal hard-coded argument, such as the string `"some-seed"`.
2. An instruction-provided argument, to be resolved from the instruction data. This can be done by giving the start index and the length of the data we want to have as a seed.
3. The public key of an account from the entire accounts list. This can be done by giving the index of the account (we'll talk about this more soon).
4. An argument to be resolved from the inner data of some account. This can be done by giving the index of the account, the start index of the data, along with the length of the data we want to have as a seed.

To use the 2 last methods of setting the seed, you need to get the account index. This represents the index of the account passed into the `Execute` function of the hook. This is standardized. 

- index 0-3 will always be, `source`, `mint`, `destination`, `owner` respectively
- index 4: will be the `extra_account_meta_list`
- index 5+: will be in whatever order you create your `account_metas`

```rust
    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    // index 4 is the extra_account_meta_list account
  let account_metas = vec![
    // index 5 - some_account
    ExtraAccountMeta::new_with_pubkey(&ctx.accounts.some_account.key(), false, true)?, 
    // index 6 - pda_account
    ExtraAccountMeta::new_with_seeds(
      &[
        Seed::Literal {
          bytes: "some-seed".as_bytes().to_vec(),
        },
      ],
      true, // is_signer
      true // is_writable
    )?,
  ];
```

Now, let's say that the `pda_account` was PDA'd off of "some-seed" and `some_account`. This is where we can specify the account key index:

```rust
  // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
  // index 4 is the extra_account_meta_list account
  let account_metas = vec![
    // index 5 - some_account
    ExtraAccountMeta::new_with_pubkey(&ctx.accounts.some_account.key(), false, true)?, 
    // index 6 - pda_account
    ExtraAccountMeta::new_with_seeds(
      &[
        Seed::AccountKey {
          index: 5, // index of `some_account`
        },
        Seed::Literal {
          bytes: "some-seed".as_bytes().to_vec(),
        },
      ],
      true, // is_signer
      true // is_writable
    )?,
  ];
```

Note: Remember that the accounts indexed 0-4 are defined by the `Execute` function of the transfer hook. They are: `source`, `mint`, `destination`, `owner`, `extra_account_meta_list` respectively. The first four of which, are de-escalated, or read-only. These will always be read only. If you try to be sneaky and add any of these first four accounts into the `extra_account_meta_list`, they will always be interpreted as read-only, even if you specify them differently with `is_writable` or `is_signer`. 

### 2. `transfer_hook` Instruction

In Anchor, when the `Execute` function it looks for and calls the `transfer_hook` instruction. It is the place where we can implement our custom logic for the token transfer.

When the Token Extensions Program CPIs our program, it will invoke this instruction and pass to it all the accounts plus the amount of the transfer that just happened. The first 5 accounts will always be `source`, `mint`, `destination`, `owner`, `extraAccountMetaList`, and the rest are the extra accounts that we added to the `ExtraAccountMetaList` account if there is any.

Let's take a look at an example `TransferHook` struct for this instruction:

```rust
// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the Token Extensions Program
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

  // Accounts to add to the extra-account-metas
  pub some_account: UncheckedAccount<'info>,
  #[account(seeds = [b"some-seed"], bump)]
  pub pda_account: UncheckedAccount<'info>,
}
```

As mentioned in the comment, the order here matters; we need the first 5 accounts as shown above, then the rest of the accounts need to follow the order of the accounts in the `extraAccountMetaList` account.

Other than that, you can write any functionality you want in within the transfer hook. But remember, if the hook fails, the entire transaction fails. 

```rust
  pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    // do your logic here
    Ok(())
  }
```

Note: The transfer hook gets called *after* the transfer happens, so at the point when the transfer hook is getting invoked, so the tokens have been transferred from the sender to the receiver.

### 3. Fallback

One last caveat to the on-chain portion of transfer hooks: When dealing with Anchor, we need to specify a `fallback` instruction in the Anchor program to handle the Cross-Program Invocation (CPI) from the Token Extensions Program.

This is necessary because Anchor generates instruction discriminators differently from the ones used in the Transfer Hook interface instructions. The instruction discriminator for the `transfer_hook` instruction will not match the one for the Transfer Hook interface.

Next versions of Anchor should solve this for us, but for now, we can implement this simple workaround:

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

## Using transfer hooks off-chain

Now that we've looked at the on-chain portion, let's look at how we interact with it off-chain. 

Let's assume we have a deployed solana program that follows the Transfer Hook Interface.

In order to create a mint with a transfer hook and ensure successful transfers, follow these steps:

1. Create the mint with the transfer hook extension and point to the on-chain transfer hook program you want to use.
2. Initialize the `extraAccountList` account. This step must be done before any transfer, and it is the responsibility of the mint owner/creator. It only needs to happen once for any mint.
3. Make sure to pass all the required accounts when invoking the transfer instruction from the Token Extensions Program.

### Create a Mint with the `Transfer-Hook` Extension:

To create a mint with the transfer-hook extension, we need three instructions:

1. `createAccount` - Reserves space on the blockchain for the mint account
2. `createInitializeTransferHookInstruction` - initializes the transfer hook extension, this takes the transfer hook's program address as a parameter.
3. `createInitializeMintInstruction` - Initializes the mint.

```ts
const extensions = [ExtensionType.TransferHook];
const mintLen = getMintLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

const transaction = new Transaction().add(
  // Allocate the mint account
  SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: mint.publicKey,
    space: mintLen,
    lamports: lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
  // Initialize the transfer hook extension and point to our program
  createInitializeTransferHookInstruction(
    mint.publicKey,
    wallet.publicKey,
    program.programId, // Transfer Hook Program ID
    TOKEN_2022_PROGRAM_ID,
  ),
  // Initialize mint instruction
  createInitializeMintInstruction(mint.publicKey, decimals, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
```

### Initialize `ExtraAccountMetaList` account:

The next step of getting the mint ready for any transactions is initializing the `ExtraAccountMetaList`. Generally, this is done by calling the `initializeExtraAccountMetaList` function on the program containing the transfer hook. Since this is part of the Transfer Hook Interface, this should be standardized. Additionally, if the transfer hook program was made with Anchor, it will most likely have autogenerated IDLs, which are TypeScript interfaces that represent the instructions and accounts of the program. This makes it easy to interact with the program from the client side. 

If you made your own program in Anchor, you should get the IDLs in the `target/idl` folder. And to make it even easier, if you are inside the anchor project and you are writing tests or client code you can access the methods directly from `anchor.workspace.program_name.method`:

```ts
import * as anchor from '@coral-xyz/anchor';

const program = anchor.workspace.TransferHook as anchor.Program<TransferHook>;
// now program.method will give you the methods of the program
```

so to initialize the `ExtraAccountMetaList` all what we need to do is to call the `initializeExtraAccountMetaList` from the methods and pass the right accounts to it, you can use the autocomplete feature to get more help with that

```ts
const initializeExtraAccountMetaListInstruction = await program.methods
  .initializeExtraAccountMetaList()
  .accounts({
    mint: mint.publicKey,
    extraAccountMetaList: extraAccountMetaListPDA,
    anotherMint: crumbMint.publicKey,
  })
  .instruction();

const transaction = new Transaction().add(
  initializeExtraAccountMetaListInstruction,
);
```

After calling `initializeExtraAccountMetaList`, you're all set to transfer tokens with the transfer hook enabled mint.

### Transfer tokens successfully:

To actually transfer tokens with the `transfer hook` extension, you need to call `createTransferCheckedWithTransferHookInstruction`. This is a special helper function provided by `@solana/spl-token` that will gather and submit all of the needed extra accounts needed specified in the `ExtraAccountMetaList`.

```ts
const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
  connection,
  sourceTokenAccount,
  mint.publicKey,
  destinationTokenAccount,
  wallet.publicKey,
  BigInt(1), // amount
  0, // Decimals
  [],
  'confirmed',
  TOKEN_2022_PROGRAM_ID,
);
```

Under the hood, the `createTransferCheckedWithTransferHookInstruction` method will examine if the mint has a transfer hook, if it does it will get the extra accounts and add them to the transfer instruction. [Take a look at the source code](https://github.com/solana-labs/solana-program-library/blob/8ae0c89c12cf05d0787ee349dd5454e1dcbe4a4f/token/js/src/extensions/transferHook/instructions.ts#L261)

```ts
/**
 * Construct an transferChecked instruction with extra accounts for transfer hook
 *
 * @param connection            Connection to use
 * @param source                Source account
 * @param mint                  Mint to update
 * @param destination           Destination account
 * @param owner                 Owner of the source account
 * @param amount                The amount of tokens to transfer
 * @param decimals              Number of decimals in transfer amount
 * @param multiSigners          The signer account(s) for a multisig
 * @param commitment            Commitment to use
 * @param programId             SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export async function createTransferCheckedWithTransferHookInstruction(
  connection: Connection,
  source: PublicKey,
  mint: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
  multiSigners: (Signer | PublicKey)[] = [],
  commitment?: Commitment,
  programId = TOKEN_PROGRAM_ID
) {
  const instruction = createTransferCheckedInstruction(
    source,
    mint,
    destination,
    owner,
    amount,
    decimals,
    multiSigners,
    programId
  );

  const mintInfo = await getMint(connection, mint, commitment, programId);
  const transferHook = getTransferHook(mintInfo);

  if (transferHook) {
    await addExtraAccountMetasForExecute(
      connection,
      instruction,
      transferHook.programId,
      source,
      mint,
      destination,
      owner,
      amount,
      commitment
    );
  }

  return instruction;
}
```

## Theoretical Example - Artist Royalties

Let's take what we know about the `transfer hook` extension and conceptually try to understand how we could implement artist royalties for NFTs. If you're not familiar, an artist royalty is a fee paid on any sale of an NFT. Historically, these were more suggestions than enforcements, since at anytime, a user could strike a private deal and exchange their NFT for payment on a platform or program that did not enforce these royalties. That being said, we can get a little closer with transfer hooks.

**First Approach** - Transfer SOL right from the `owner` to the artist right in the hook. Although this may sound like a good avenue to try, it won't work, for two reasons. First, the hook would not know how much to pay the artist - this is because the transfer hook does not take any arguments other than the needed `source`, `mint`, `destination`, `owner`, `extraAccountMetaList` and all of the accounts within the list. Secondly, we would be paying from the `owner` to the artist, which cannot be done since `owner` is deescalated. It cannot sign and it cannot be written to - this means we don't have the authority to update `owner`'s balance. Although we can't use this approach, it's a good showcase to the limitations of the transfer hook.

**Second Approach** - Create a data PDA owned by the `extraAccountMetaList` that tracks if the royalty has been paid. If it has, allow the transfer, if it has not, deny it. This approach is multi-step, and would require an additional function in the transfer hook program. 

Say we have a new function called `payRoyalty` in our transfer hook program. This function would be required to:
1. Create a data PDA owned by the `extraAccountMetaList`
  a. This account would hold information about the trade
2. Transfer the amount for the royalty from the `owner` to the artist.
3. Update the data PDA with the sale information

Then you'd transfer, and all the transfer hook should do is check the sales data on the PDA. It would allow or disallow the transfer from there.

Remember this the above is just a theoretical discussion and is in no way all-encompassing. For example, how would you enforce prices of the NFTs? Or, what if the owner of the NFT wants to transfer it to a different wallet of theirs - should there be an approved list of "allowed" wallets? Or, should the artist be a signer involved in every sale/transfer? This system design makes for a great homework assignment!


# Lab

In this lab we'll explore how transfer hooks work by creating a Cookie Crumb program. We'll have a Cookie NFT that has a transfer hook which will mint a crumb token for each transfer - leaving a "crumb trail". We'll able to tell how many times this NFT has been transferred only by looking at the crumb supply.

## 0. Setup

### 1. Verify Solana/Anchor/Rust Versions

We'll be interacting with the `Token Extensions` program in this lab and that requires you have solana cli version ≥ 1.18.1.

To check your version run:

```bash
solana --version
```

If the version printed out after running `solana --version` is less than `1.18.0` then you can update the cli version manually. Note, at the time of writing this, you cannot simply run the `solana-install update` command. This command will not update the CLI to the correct version for us, so we have to explicitly download version `1.18.0`. You can do so with the following command:

```bash
solana-install init 1.18.1
```

If you run into this error at any point attempting to build the program, that likely means you do not have the correct version of the solana CLI installed.

```bash
anchor build
error: package `solana-program v1.18.1` cannot be built because it requires rustc 1.72.0 or newer, while the currently active rustc version is 1.68.0-dev
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
cd solana-lab-transfer-hooks
git checkout starter
```

### 3. Update Program ID and Anchor Keypair

Once in the starter branch, run

```bash
anchor keys sync
```

To sync your program key with the one in the `Anchor.toml` and the declared program id in the `programs/transfer-hook/src/lib.rs` file.

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

In this section we'll dive into writing the onchain transfer hook program using anchor, all the code will go into the `programs/transfer-hook/src/lib.rs` file.

by Takeing a look inside that file, you'll notice we have three instructions `initialize_extra_account_meta_list`, `transfer_hook`, `fallback`. Additionally we have two instruction account struct `InitializeExtraAccountMetaList` and `TransferHook`.

- The `initialize_extra_account_meta_list` function initializes the additional accounts needed for the transfer hook.

- The `transfer_hook` is the actual CPI called "after" the transfer has been made.

- The `fallback` is an anchor adapter function we have to fill out.

We're going to look at each in-depth.

```rust
use anchor_lang::{ prelude::*, system_program::{ create_account, CreateAccount } };
use anchor_spl::{ token, token_interface::{ Mint, TokenAccount, TokenInterface } };
use spl_transfer_hook_interface::instruction::{ ExecuteInstruction, TransferHookInstruction };
use spl_tlv_account_resolution::{ account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList };

declare_id!("YOUR_PROGRAM_ID_HERE");

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

First we have to build the struct `InitializeExtraAccountMetaList`, then we can write the instruction itself.

**`InitializeExtraAccountMetaList` Struct**

The Instruction requires the following accounts:

1. `extra_account_meta_list` - The PDA that will hold the extra account.
2. `crumb_mint` - The mint account of the crumb token.
3. `crumb_mint_ata` - The associated token account of the crumb token.
4. `mint` - The mint account of the cookie NFT.
5. `mint_authority` - The mint authority account of the crumb token.
6. `payer` - The account that will pay for the creation of the ExtraAccountMetaList account.
7. `token_program` - The token program account.
8. `system_program` - The system program account.

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
}
```

Thanks to anchor it could make our life easier and infer a few of these accounts, therefore we'll have to pass the first 4 accounts (extra_account_meta_list, crumb_mint, crumb_mint_ata, mint) when invoking the instruction, and Anchor will infer the rest.

Notice that we are asking anchor to initialize the `crumb_mint` account for us, by using the `#[account(init, payer = payer,mint::decimals = 0, mint::authority = mint_authority)]` attribute. At the same time we are asking anchor to drive the `mint_authority` account from the seed `b"mint-authority"`.

It's important to make the `mint_authority` a PDA of the transfer hook program itself, this way the program can sign for it when making the mint CPI.

Note that we should be able to also drive the `crumb_mint_ata` using `Seed::new_external_pda_with_seeds` but at the time of writing this lesson, this method was causing some issues, so we'll derive it in the TS code and pass it as a regular address.

**`initialize_extra_account_meta_list` Instruction**

The instruction logic will be as follows:

1. List the accounts required for the transfer hook instruction inside a vector.
2. Calculate the size and rent required to store the list of ExtraAccountMetas.
3. Make a CPI to the System Program to create an account and set the Transfer Hook Program as the owner.
4. Initialize the account data to store the list of ExtraAccountMetas.

here is the code for it:

```rust
pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // 1. List the accounts required for the transfer hook instruction inside a vector.

    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    // index 4 is the extra_account_meta_list account
    let account_metas = vec![
      // index 5, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 6, Associated Token program
      ExtraAccountMeta::new_with_pubkey(&associated_token_id, false, false)?,
      // index 7, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?, // is_writable true
      // index 8, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        false // is_writable
      )?,
      // index 9, crumb mint ATA
      ExtraAccountMeta::new_external_pda_with_seeds(
        6, // associated token program index
        &[
          Seed::AccountKey { index: 8 }, // owner index
          Seed::AccountKey { index: 5 }, // token program index
          Seed::AccountKey { index: 7 }, // crumb mint index
        ],
        false, // is_signer
        true // is_writable
      )?
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

In this step, we'll implement the `transfer_hook` instruction for our Transfer Hook program. This instruction will be called by the token program when a token transfer occurs. The transfer_hook instruction will mint a new crumb token for each transfer.

Again we'll have a struct `TransferHook` that will hold the accounts required for the instruction.

**`TransferHook` Struct**

In this example the `TransferHook` struct will have 9 accounts:

1. `source_token` - The source token account from which the NFT is transferred.
2. `mint` - The mint account of the Cookie NFT.
3. `destination_token` - The destination token account to which the NFT is transferred.
4. `owner` - The owner of the source token account.
5. `extra_account_meta_list` - The ExtraAccountMetaList account that stores the additional accounts required by the transfer_hook instruction
6. `token_program` - The token program account.
7. `associated_token_program` - The associated token program account.
8. `crumb_mint` - The mint account of the token to be minted by the transfer_hook instruction.
9. `mint_authority` - The mint authority account of the token to be minted by the transfer_hook instruction.
10. `crumb_mint_ata` - The associated token account of the token to be minted by the transfer_hook instruction.

<Callout type="info">

Note that the order of accounts in this struct matters. This is the order in
which the Token Extensions Program provides these accounts when it CPIs to this
Transfer Hook program.

</Callout>

```rust
// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the Token Extensions Program
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

  pub associated_token_program: Program<'info, AssociatedToken>,

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

Since the mint_authority is a PDA of the transfer hook program itself, the program can sign for it. Therefore we'll use `new_with_signer` and pass mint_authority seeds as the signer seeds.

```rust
  pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    let signer_seeds: &[&[&[u8]]] = &[&[b"mint-authority", &[ctx.bumps.mint_authority]]];
    // mint a crumb token for each transaction
    token::mint_to(
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
use anchor_spl::{ token, token_interface::{ Mint, TokenAccount, TokenInterface } };
use spl_transfer_hook_interface::instruction::{ ExecuteInstruction, TransferHookInstruction };
use spl_tlv_account_resolution::{ account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList };

declare_id!("YOUR_PROGRAM_ID_HERE");

#[program]
pub mod transfer_hook {
  use super::*;

  pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
    // 1. List the accounts required for the transfer hook instruction inside a vector.

    // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
    // index 4 is the extra_account_meta_list account
    let account_metas = vec![
      // index 5, Token program
      ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?,
      // index 6, Associated Token program
      ExtraAccountMeta::new_with_pubkey(&associated_token_id, false, false)?,
      // index 7, crumb mint
      ExtraAccountMeta::new_with_pubkey(&ctx.accounts.crumb_mint.key(), false, true)?, // is_writable true
      // index 8, mint authority
      ExtraAccountMeta::new_with_seeds(
        &[
          Seed::Literal {
            bytes: "mint-authority".as_bytes().to_vec(),
          },
        ],
        false, // is_signer
        false // is_writable
      )?,
      // index 9, crumb mint ATA
      ExtraAccountMeta::new_external_pda_with_seeds(
        6, // associated token program index
        &[
          Seed::AccountKey { index: 8 }, // owner index
          Seed::AccountKey { index: 5 }, // token program index
          Seed::AccountKey { index: 7 }, // crumb mint index
        ],
        false, // is_signer
        true // is_writable
      )?
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
    token::mint_to(
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
  pub system_program: Program<'info, System>,

  #[account(init, payer = payer, mint::decimals = 0, mint::authority = mint_authority)]
  pub crumb_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account for crumb mint
  #[account(seeds = [b"mint-authority"], bump)]
  pub mint_authority: UncheckedAccount<'info>,
}

// Order of accounts matters for this struct.
// The first 4 accounts are the accounts required for token transfer (source, mint, destination, owner)
// Remaining accounts are the extra accounts required from the ExtraAccountMetaList account
// These accounts are provided via CPI to this program from the Token Extensions Program
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

  pub associated_token_program: Program<'info, AssociatedToken>,

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

## 2. Write the tests

Now we'll write some TS script to test our code, all of our test will live inside `tests/anchor.ts`. Additionally we have some helper functions inside `helpers/helpers.ts` that we'll use in our tests.

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
6. 4 empty tests that we'll talk about later

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

To get us started we'll have to add few other stuff to our code:

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

One more awesome things about extensions is that you can mix and match them as you like. so in this test we'll create a new NFT mint account with the transfer hook extension and the metadata extension.

The test will goes as follows:

1. Get the metadata object: we'll use a the helper function `getMetadataObject` for that, notice that we are passing an `imagePath`, so for this you will have to grape an image and put it in the `helpers` folder, for this example let's call it `cool-cookie.png`.
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
  it('Creates Token Accounts and Mint The NFT', async () => {
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

In this test we'll:

1. initialize the extra account meta list account, to do so we'll have to pass the needed account (mint, crumb mint, crumb mint ATA, extraAccountMetaList).
2. Initialize the crumb mint ATA, so we can mint from crumb tokens to it in the next test.

```ts
it('Initializes ExtraAccountMetaList Account and Creates the ATA for the Crumb Mint', async () => {
    const initializeExtraAccountMetaListInstruction = await program.methods
        .initializeExtraAccountMetaList()
        .accounts({
        mint: mint.publicKey,
        extraAccountMetaList: extraAccountMetaListPDA,
        crumbMint: crumbMint.publicKey,
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

The final test is the transfer test, the whole idea of our lab is to be able to transfer the NFT and making sure that the Token Extensions Program is calling our transfer hook program under the hood correctly.

The test will have three parts:

1. Transfer the NFT from the sender to the recipient, after doing that the Token Extensions Program should call our program and a crumb token should be minted, which means the supply after this transfer finishes should be 1.
2. Transfer the NFT back to the sender, after doing that the Token Extensions Program should call our program and a crumb token should be minted, which means the supply after this transfer finishes should be 2.
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
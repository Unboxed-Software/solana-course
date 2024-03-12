---
title: Transfer hook
objectives:
- Create a program that applies the `transfer-hook` interface
- Create a mint with a transfer hook
- Transfer an NFT that has a transfer hook successfully
---

# Summary
- Transfer hook extension allows developers to implement custom logic on their tokens.
- If the token have a transfer hook the Token Extension program will invoke the transfer hook instruction on every token transfer.
- For the program to be able to act as a transfer-hook program it should implement the `TransferHook` interface.
- Transferring a token that has a transfer hook requires passing all the required accounts when invoking the transfer instruction.

# Overview

The Token Extension program is providing lots of new features that would extend the mint/token accounts to allow the developers to add more functionality to their tokens, and one of the most interesting extensions is the `transfer-hook` extension.

This extension allows the developer to run specific logic on each transfer happens on the their tokens. This opens the door for many use cases, for example you can use it to mint/burn/transfer tokens on each transfer, or maybe failing the transfer if a specific condition is not met like having a black/white list of accounts to send/receive tokens, ...etc

In this lesson we will explore how to work with transfer hooks, what should we now about them? How to implement them?

To do so we will have two sections in this lesson:

1. Onchain side: we will discuses how to build an anchor program that implements the transfer-hook interface
2. Offchain side: we will discuses how to interact with the transfer-hook interface using TypeScript, and what do we need to do before being able to transfer our tokens successfully 
 

## Onchain side

Token Extension program requires any program that claims to be a transfer hook to implement the `TransferHook` interface.

The Transfer Hook Interface provides a way for developers to implement custom instruction logic that is executed on every token transfer for a specific Mint Account.

The Transfer Hook Interface specifies the following [instructions](https://github.com/solana-labs/solana-program-library/blob/master/token/transfer-hook/interface/src/instruction.rs):

- `Execute`: An instruction that the Token Extension program invokes on every token transfer.
- `InitializeExtraAccountMetaList` (optional): Creates an account that stores a list of additional accounts required by the custom `Execute` instruction.
- `UpdateExtraAccountMetaList` (optional): Updates the list of additional accounts by overwriting the existing list.

It is technically not required to implement the `InitializeExtraAccountMetaList` instruction using the interface. The account can be created by any instruction on a Transfer Hook program.

However, the Program Derived Address (PDA) for the account must be derived using the following seeds:

- The hard coded string "extra-account-metas"
- The Mint Account address
- The Transfer Hook program ID

```js
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
  program.programId, // transfer hook program ID
);
```

By storing the extra accounts required by the `Execute` instruction in the predefined PDA, these accounts can be automatically added to a token transfer instruction from the client, we will see how to do that in the offchain side.

to implement all of that using Anchor, we will have to implement 3 functions:
1. `initialize_extra_account_meta_list` instruction: This instruction is used to create an account that stores a list of additional accounts required by the custom `Execute` instruction.
2. `transfer_hook` instruction: This instruction is invoked on every token transfer.
3. `fallback` instruction: This instruction is used as a workaround to handle the Cross-Program Invocation (CPI) from the Token Extensions program.

Notice that we are not going to talk about the `UpdateExtraAccountMetaList`, it should be much similar to the `initialize_extra_account_meta_list` instruction, so we will just focus on the first two instructions.

### 1. `initialize_extra_account_meta_list` instruction:

When we transfer a token using the Token Extension program, the program will examine our mint to determine if it has a transfer hook. If a transfer hook is present, the Token Extension program will initiate a CPI (cross-program invocation) to our transfer hook program. It will then pass all the accounts provided for the transfer to the transfer hook program. However, before passing the 4 essential accounts (sender, mint, receiver, owner), it will deescalate them (meaning it will remove the mutable or signing abilities for security reasons).

In other words, when our program receives these accounts, they will be read-only. Our program cannot modify anything in these accounts, nor can it sign any transactions with them. Therefore, if we have logic that requires changes to an account or the execution of transactions, we need to have other accounts.

In Solana, a program can sign for any PDA it owns. Therefore, we can leverage the PDA features. For instance, if we need to mint some tokens on each transfer, we can achieve this by setting the `mint_authority` of that token to be a PDA owned by our program.

However, this approach may still be somewhat limiting for the full potential of the transfer hook. There might be a need for other accounts to be mutable or to act as signers to enable a broader range of operations. Meet the `ExtraAccountMetaList` account.

The `ExtraAccountMetaList` account allow Solana developers to store additional accounts required by their transfer hook. This account should be created before any transfer occurs. During the creation of this account, we add the necessary accounts (as signer, mutable, or both) that the transfer hook requires for its logic to function. It's worth noting that we can update the list of accounts in the `ExtraAccountMetaList` account using the `UpdateExtraAccountMetaList` instruction if necessary.

Let's take a look at the struct `ExtraAccountMetaList` [in the source code](https://github.com/solana-labs/solana-program-library/blob/4f1668510adef2117ee3c043bd26b79789e67c8d/libraries/tlv-account-resolution/src/account.rs#L90):

```rust
impl ExtraAccountMeta {
    /// Create a `ExtraAccountMeta` from a public key,
    /// thus representing a standard `AccountMeta`
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

    /// Create a `ExtraAccountMeta` from a list of seed configurations,
    /// thus representing a PDA
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

And we can see that we have three methods for storing these accounts:

1. Directly store the account address by using `ExtraAccountMeta::new_with_pubkey`.
2. Store the seeds to derive a PDA of the program itself using `ExtraAccountMeta::new_with_seeds`.
3. Store the seeds to derive a PDA for a program other than the Transfer Hook program using `ExtraAccountMeta::new_external_pda_with_seeds`.

Note that if you are going to pass the Mint account in the extra account list to get it as mutable/signer, that is not going to work. At the time of creating this lesson, when the Token Extension program makes the CPI to our program, it will pass the mint account as read-only no matter how many times you add it to the extra accounts list.

Now let's talk about the instruction itself and see some code to help us wrap our heads around it better.

In Anchor, each instruction could have a struct that will represent the accounts needed for this instruction. Anchor will help us parse and validate the accounts. For our example, let's take a look at the `InitializeExtraAccountMetaList` struct:


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
  pub another_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account for crumb mint
  #[account(seeds = [b"some-seed"], bump)]
  pub PDA_account: UncheckedAccount<'info>,

}
```

In this struct, we have the following accounts:
1. `payer` - the account that will pay for the transaction fees (**required**).
2. `extra_account_meta_list` - the account that will store the extra accounts needed for the transfer hook (**required**).
3. `mint` - the mint account of the token to be transferred (**required**).
4. `token_program` - the token program account (**required because we are initializing the `another_mint` account in a later step**).
5. `system_program` - the system program account (**required because we are initializing the `another_mint` account in a later step**).
6. `another_mint` - the mint account of the token to be minted by the transfer hook instruction (**optional**).
7. `PDA_account` - the PDA account that will be used as the mint authority for the `another_mint` account (**optional**).

We will have to pass all of these accounts when calling the `initialize_extra_account_meta_list` instruction. However, Anchor will help us a lot here; it will validate the accounts and ensure that we are passing the right accounts. Also, it will parse the accounts and add them to an object called the `ctx` and pass them to the instruction when we call it. Good to know that there is a specific setting that you can enable in your `anchor.toml` file under the features section that will make Anchor generate the derived accounts without passing them by using the seeds from the struct validate. [Read more about it here](https://www.anchor-lang.com/docs/manifest#features). Basically, turning this on will make passing the PDA account address optional.

After preparing the struct, we can go ahead and write the instruction itself, and it will look like this:


```rust
pub fn initialize_extra_account_meta_list(ctx: Context<InitializeExtraAccountMetaList>) -> Result<()> {
  let account_metas = vec![
    ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?, // we can get the address from anywhere we want and pass it here
    ExtraAccountMeta::new_with_pubkey(&ctx.accounts.another_mint.key(), false, true)?, // is_writable true
    ExtraAccountMeta::new_with_seeds(
      &[
        Seed::Literal {
          bytes: "some-seed".as_bytes().to_vec(),
        },
      ],
      false, // is_signer
      false // is_writable
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

The logic might not feel simple, but we are basically doing three things:
1. Preparing the accounts that we need to store in the `ExtraAccountMetaList` account as a vector (we will talk about that in depth in a sec).
2. Calculating the size and rent required to store the list of `ExtraAccountMetas`.
3. Making a CPI to the System Program to create an account and set the Transfer Hook Program as the owner, and then initializing the account data to store the list of `ExtraAccountMetas`.

The last two steps are fairly easy, nothing crazy or new, so we will just focus on explaining the first step.

We said before that there are three ways to store the accounts: directly store the account address, store the seeds to derive a PDA of the program itself, and store the seeds to derive a PDA for a program other than the Transfer Hook program.

The first method is easy; you just need to get the account address. You can pass it to the instruction or get it from a library (like the system program or the token program), or you can even hardcode it.

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

Both of these methods are similar; the only change is we need to pass the `program_id` for the PDAs that are not of our program in the `new_external_pda_with_seeds` method, and we need to provide a list of seeds (which we will talk about in a second), two booleans for `is_signer` and `is_writable` to determine if the account should be a signer or writable.

Now providing the seeds themselves is the most challenging part here, so we will break it down to make it easier to understand. Let's first take a look at the seed enum implementation from [spl_tlv_account_resolution::seeds::Seed](https://github.com/solana-labs/solana-program-library/blob/master/libraries/tlv-account-resolution/src/seeds.rs):

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

From this code, we can tell that there are four main ways to provide the seeds:
1. A literal hard-coded argument, such as the string `"some-seed"`.
2. An instruction-provided argument, to be resolved from the instruction data. This can be done by giving the start index and the length of the data we want to have as a seed.
3. The public key of an account from the entire accounts list. This can be done by giving the index of the account (we will talk about this more after a second).
4. An argument to be resolved from the inner data of some account. This can be done by giving the index of the account, the start index of the data, and the length of the data we want to have as a seed.

To use the third and the last methods of setting the seed, you need to get the account index, and there is a way to tell which account is in which index. So let's get to it; here is the accounts vector again but with the indexes:

```rust
  // index 0-3 are the accounts required for token transfer (source, mint, destination, owner)
  let account_metas = vec![
    // index 4, Token program
    ExtraAccountMeta::new_with_pubkey(&token::ID, false, false)?, // we can get the address from anywhere we want and pass it here
    // index 5, another mint
    ExtraAccountMeta::new_with_pubkey(&ctx.accounts.another_mint.key(), false, true)?, // is_writable true
    // index 6, mint authority
    ExtraAccountMeta::new_with_seeds(
      &[
        Seed::Literal {
          bytes: "some-seed".as_bytes().to_vec(),
        },
      ],
      false, // is_signer
      false // is_writable
    )?,
  ];
```

As you can see in the comments, the indexes 0-3 are the accounts required for token transfer (source, mint, destination, owner), and the rest are the extra accounts required from the `ExtraAccountMetaList` account. You can use them as follows:

```rust
  ExtraAccountMeta::new_with_seeds(
    &[
      Seed::AccountKey {
        index: 5,
      }
    ],
    false, // is_signer
    false // is_writable
  )?,
```

Notice that in some guides, you will see them give the index 4 to the `extra_account_meta_list` account; therefore, in our example above, the token account will be in index 5 instead of 4. However, at the time of writing this lesson, that was not the case, and if you do so, you will get an error while the client-side method parses the accounts needed for the instruction. So keep that in mind; you might want to play with the indexes a little bit to get it to work.

Another thing to note is that at the time of writing this lesson, using the `new_external_pda_with_seeds` method is not going to work; it will error when the transfer happens, and the Token Extension program CPIs our program.


### 2. `transfer_hook` Instruction

The main instruction for the transfer hook program is `transfer_hook`. This instruction is invoked on every token transfer. It is the place where we can implement our custom logic for the token transfer.

When the Token Extension program CPIs our program, it will invoke this instruction and pass to it all the accounts plus the amount of the transfer that just happened. The first 5 accounts will always be (source, mint, destination, owner, extraAccountMetaList), and the rest are the extra accounts that we added to the `ExtraAccountMetaList` account if there is any.

Let's take a look at an example struct `TransferHook` for this instruction:

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

  pub another_mint: InterfaceAccount<'info, Mint>,

  /// CHECK: mint authority Account,
  #[account(seeds = [b"some-seed"], bump)]
  pub some_pda: UncheckedAccount<'info>,
}
```

As mentioned in the comment, the order here matters; we should pass the first 5 accounts as shown above, then the rest of the accounts should follow the order of the accounts in the `extraAccountMetaList` account, the one we talked about before.

As you know, Anchor will take it from here and make sure that everything is validated and parsed correctly, and it will pass the accounts to the instruction it gets called.

Now let's take a look at the function itself:

```rust
  pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> {
    // do your logic here
    Ok(())
  }
```

You can add any logic you want here; for instance, you can fail the transfer if a specific condition is not met, or you can make another CPI from here to another program, etc.

Good to know that the transfer hook gets called after the transfer happens, so at the point when the transfer hook is getting invoked, the tokens have already left the sender account and get to the receiver account.

### 3. Fallback
In addition, we must include a `fallback` instruction in the Anchor program to handle the Cross-Program Invocation (CPI) from the Token Extensions program.

This is necessary because Anchor generates instruction discriminators differently from the ones used in the Transfer Hook interface instructions. The instruction discriminator for the `transfer_hook` instruction will not match the one for the Transfer Hook interface.

Next versions of Anchor should solve this for us, but for now, we can implement this simple workaround.


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

## Offchain side

In order to create a mint with a transfer hook and ensure successful transfers, follow these steps:

1. Create the mint with the transfer hook extension and point to the transfer hook program you want to use.
2. Initialize the `extraAccountList` account. This step must be done before any transfer, and it is the responsibility of the mint owner/creator. It needs to happen only once for each mint to add all the extra accounts that the transfer hook needs.
3. Make sure to pass all the required accounts when invoking the transfer instruction from the Token Extension program.

### Create a Mint with the `Transfer-Hook` Extension:

To create a mint with the transfer-hook extension, ensure that you allocate enough space for the mint to store the extra information about the transfer hook. You can do this by calling the `getMintLen` function from the `@solana/spl-token` library and pass to it an array of the extensions that you want to use. In our case, we only need the `TransferHook` extension. Additionally, make sure to call `createInitializeTransferHookInstruction` to initialize the transfer hook extension and point to our program before initializing the mint.


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

One of the cool features that Anchor framework provides is autogenerated IDLs, which are TypeScript interfaces that represent the instructions and accounts of the program. This makes it easy to interact with the program from the client side. You should get the IDLs if you build the program and you can find them in `target/idl` folder. And to make it even easier, if you are inside the anchor project and you are writing tests or client code you can access the methods directly from `anchor.workspace.program_name.method`

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


### Transfer tokens successfully:

To transfer tokens successfully, you need to pass all the required accounts when invoking the transfer instruction from the Token Extension program. luckily for us the `@solana/spl-token` library has a method that will help us with that, it's called `createTransferCheckedWithTransferHookInstruction` and it will take care of adding the extra accounts to the transfer instruction for us.

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

And that is it!

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

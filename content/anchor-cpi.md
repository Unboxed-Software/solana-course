# CPI and AnchorError

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Make Cross Program Invocations (CPIs) within an Anchor program
- Create and return custom Anchor Errors
- Enable and use the `init-if-needed` constraint

# TL;DR

- Anchor provides a simplified way to create CPIs using a `CpiContext`
- The `error_code` attribute macro is used to create custom Anchor Errors
- The `init-if-needed` constraint is used to conditionally initialize a new account

# Overview

In this lesson you'll learn how to:

- Make Cross Program Invocations (CPIs) in Anchor
- Create and use custom Anchor Errors
- Use the `init-if-needed` constraint

### Cross Program Invocations (CPIs) with Anchor

As a refresher, CPIs allow programs to invoke instructions on other programs using the `invoke` or `invoke_signed` functions. This allows for the composability of Solana programs.

While making CPIs directly using `invoke` or `invoke_signed` is still an option, Anchor also provides a simplified way to make CPIs by using a `CpiContext`.

In this lesson, you'll use the `anchor_spl` crate to make CPIs to the SPL Token Program. You can explore the `anchor_spl` crate [here](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

The first step in making a CPI is to create the `CpiContext`.

The `CpiContext` specifies non-argument inputs for cross program invocations:

- `accounts` - the list of accounts required for the instruction being invoked
- `remaining_accounts` - any remaining accounts
- `program` - the program ID of the program being invoked
- `signer_seeds` - if a PDA is signing, include the seeds required to derived the PDA

```rust
pub struct CpiContext<'a, 'b, 'c, 'info, T>
where
    T: ToAccountMetas + ToAccountInfos<'info>,
{
    pub accounts: T,
    pub remaining_accounts: Vec<AccountInfo<'info>>,
    pub program: AccountInfo<'info>,
    pub signer_seeds: &'a [&'b [&'c [u8]]],
}
```

`CpiContext::new` is used when a regular keypair is the signer for the CPI.

```rust
CpiContext::new(cpi_program, cpi_accounts)
```

```rust
pub fn new(
        program: AccountInfo<'info>,
        accounts: T
    ) -> Self {
    Self {
        accounts,
        program,
        remaining_accounts: Vec::new(),
        signer_seeds: &[],
    }
}
```

`CpiContext::new_with_signer` is used when a PDA is the signer for the CPI.

```rust
CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
```

```rust
pub fn new_with_signer(
    program: AccountInfo<'info>,
    accounts: T,
    signer_seeds: &'a [&'b [&'c [u8]]],
) -> Self {
    Self {
        accounts,
        program,
        signer_seeds,
        remaining_accounts: Vec::new(),
    }
}
```

### CPI Example

This section will walk through an example of making a CPI to the `mint_to` instruction on the Token Program using the `anchor_spl` crate.

The `anchor_spl` crate has a `token` [module](https://docs.rs/anchor-spl/latest/anchor_spl/token/index.html) which includes:

- Structs that list the accounts required for Token Program instructions
- Functions used to make CPIs to each respective instruction.

For example, the `MintTo` [struct](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html) includes the following accounts:

- `mint` - the token mint account
- `to` - the token account minting tokens to
- `authority` - the mint authority for the mint specified

```rust
#[derive(Accounts)]
pub struct MintTo<'info> {
    pub mint: AccountInfo<'info>,
    pub to: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}
```

The `mint_to` [function](https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) is then used to build the instruction for the CPI. Note that under the hood, the function takes the `CpiContext` of type `MintTo` and an `amount` as parameters and uses `invoke_signed` to make the CPI.

```rust
pub fn mint_to<'a, 'b, 'c, 'info>(
    ctx: CpiContext<'a, 'b, 'c, 'info, MintTo<'info>>,
    amount: u64,
) -> Result<()> {
    let ix = spl_token::instruction::mint_to(
        &spl_token::ID,
        ctx.accounts.mint.key,
        ctx.accounts.to.key,
        ctx.accounts.authority.key,
        &[],
        amount,
    )?;
    solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.to.clone(),
            ctx.accounts.mint.clone(),
            ctx.accounts.authority.clone(),
        ],
        ctx.signer_seeds,
    )
    .map_err(Into::into)
}
```

All together, making a CPI to the `mint_to` instruction with a PDA as the mint authority would require the steps:

- Use the seeds and bump of the mint authority as the signer for the CPI
- Specify the token program as the program being invoked
- Specify the list of accounts required by the instruction
- Create the `CpiContext`
- Use the CPI helper function, the `CpiContext`, and any additional required instruction data to make the CPI

```rust
// get the mint authority bump
let auth_bump = *ctx.bumps.get("mint_authority").unwrap();

// list seeds used for signing
let seeds = &[
    b"mint".as_ref(),
    &[auth_bump],
];

// specify signer as list of seeds
let signer = &[&seeds[..]];

// specify cpi_program as token program
let cpi_program = ctx.accounts.token_program.to_account_info();

// specify cpi_accounts using MintTo struct
let cpi_accounts = MintTo {
    mint: ctx.accounts.token_mint.to_account_info(),
    to: ctx.accounts.token_account.to_account_info(),
    authority: ctx.accounts.mint_authority.to_account_info()
};

// create the CpiContext using new_with_signer
let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

// make the CPI using the mint_to function
token::mint_to(cpi_ctx, amount)?;
```

The CPI example above can also be refactored to the following:

```rust
token::mint_to(
    CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        token::MintTo {
            mint: ctx.accounts.mint_account.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        },
        &[&[
            b"mint",
            &[*ctx.bumps.get("mint_authority").unwrap()],
        ]]
    ),
    amount,
)?;
```

### `AnchorError`

Next, you'll learn how to create and return custom Anchor Errors. Ultimately, all programs return the same Error: The [ProgramError](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html). However, Anchor Errors provide a range of information including:

- The error name and number
- Location in the code where the error was thrown
- The account that violated a constraint

```rust
pub struct AnchorError {
    pub error_name: String,
    pub error_code_number: u32,
    pub error_msg: String,
    pub error_origin: Option<ErrorOrigin>,
    pub compared_values: Option<ComparedValues>,
}
```

Anchor Errors can be divided into:

- Anchor Internal Errors that the framework returns from inside its own code
- Custom errors which the user (you!) can return

You can add errors unique to your program by using the `error_code` attribute. Simply add the error to an `enum` with a name of your choice. You can then use the variants of the `enum` as errors in your program. Additionally, you can add a message attribute to the individual variants. Clients will then display this error message if the error occurs.

```rust
#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Return an error using the [err!](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html) or the [error!](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) macro within an instruction. These add file and line information to the error that is then logged by Anchor.

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        if data.data >= 100 {
            return err!(MyError::DataTooLarge);
        }
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

Alternatively, you can use the [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html) macro to simplify writing errors. The code above can be refactored to the following:

```rust
#[program]
mod hello_anchor {
    use super::*;
    pub fn set_data(ctx: Context<SetData>, data: MyAccount) -> Result<()> {
        require!(data.data < 100, MyError::DataTooLarge);
        ctx.accounts.my_account.set_inner(data);
        Ok(())
    }
}

#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

### `init_if_needed` constraint

Anchor provides an `init_if_needed` constraint that can be used to initialize an account if it does not already exist.

This feature should be used with care and is therefore behind a feature flag. You need to make sure you properly protect yourself against re-initialization attacks. You need to include checks in your code that check that the initialized account cannot be reset to its initial settings after the first time it was initialized.

To use `init_if_needed`, you must first enable the feature in `Cargo.toml`.

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

Once you’ve enabled the feature, you can include the constraint in the `#[account(…)]` attribute macro. The example below demonstrates using the `init_if_needed` constraint to initialize a new associated token account if one does not already exist.

```rust
#[program]
mod example {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
     #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

When the `initilize` instruction is invoked, Anchor will check if the `token_account` exists and initialize it if it does not. If it already exists, then the instruction continues. Note that in the example below, the accounts not listed in `program.methods.initialize().accounts()` are ones that Anchor can infer (ex. system program).

```ts
const mint = new PublicKey("MINT_ADDRESS_HERE")
const tokenAccountAddress = await getAssociatedTokenAddress(
  mint,
  user.publicKey
)

await program.methods
  .initialize()
  .accounts({
    tokenAccount: tokenAccountAddress,
    mint: mint,
  })
  .rpc()
```

# Demo

Let’s practice the concepts we’ve gone over in this lesson by building on top of the Movie Review program from the previous lesson.

In this demo we’ll update the program to:

- Enable commenting
- Mint tokens each time a user submits a review or comment

### 1. Starter

To get started, we will be using the final state of the Anchor Movie Review program from the previous lesson. So, if you just completed that lesson then you’re all set and ready to go. If you are just jumping in here, no worries, you can download the starter code [here](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). We'll be using the `solution-pdas` branch as our starting point.

### 2. Add dependencies to `Cargo.toml`

Before we get started we need enable the `init-if-needed` feature and add the `anchor-spl` crate to the dependencies in `Cargo.toml`.

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

### 3. Create Token

Next, navigate to `lib.rs` and create an instruction to initialize a new token mint. This will be the token that is minted each time a user leaves a review or comment. This instruction will only be invoked once.

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
        msg!("Token mint initialized");
        Ok(())
    }
```

Next, implement the `InitializeMint` context type and list the accounts and constraints the instruction requires. Here we initialize a new `Mint` account using a PDA with the string `mint` as a seed. Note that we can use the same PDA for both the address of the `Mint` account and the mint authority. Using a PDA as the mint authority enables our program to sign for the minting of the tokens.

```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        seeds = [b"mint"],
        bump,
        payer = user,
        mint::decimals = 6,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>
}
```

### 4. Anchor Error

Next, let’s create an Anchor Error that we’ll use when validating the `rating`. We’ll use this error in the `add_movie_review` and `update_movie_review` instructions.

```rust
#[error_code]
enum MovieReviewError {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating
}
```

### 5. Update `add_movie_review` instruction

Next, let’s update the `add_movie_review` instruction and `AddMovieReview` context type. We’ll also create a new `MovieReviewCounter` account type to keep track of the number of comments for a specific review.

First, implement the `MovieCommentCounter` account type. This account will simply have a counter field that stores the number of comments.

```rust
#[account]
pub struct MovieCommentCounter {
    pub counter: u64,
}
```

Next, update the `AddMovieReview` context type. We’ll need add the following accounts:

- `token_program` - required because we are using `Mint` and `TokenAccount` types from the Token Program.
- `movie_comment_counter` - initializing the a new `MovieCommentCounter` account
- `mint` - the `Mint` account for the token that the instruction mints
- `token_account` - the associated token account of the `initializer` for the `mint`
- `associated_token_program` - required because we are using the `associated_token` constraint in the `token_account`
- `rent` - required because we are using the `init-if-needed` feature in the `token_account`

```rust
#[derive(Accounts)]
#[instruction(title: String, description: String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    #[account(
        init,
        seeds = [b"counter", movie_review.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 8
    )]
    pub movie_comment_counter: Account<'info, MovieCommentCounter>,
    #[account(
        seeds=[b"mint"],
        bump,
        mut
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = initializer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>
}
```

Next, let’s update the `add_movie_review` instruction. Here we make the following updates:

- Add a check for the `rating` using the `InvalidRating` error
- Set the `movie_comment_counter` account’s `counter` field to 0
- Make a CPI to the token program’s `mint_to` instruction using the mint authority PDA as a signer. Note that the we are minting 10 tokens and the `10*10^6` is to adjust for the decimals of the `Mint` account.

```rust
pub fn add_movie_review(ctx: Context<AddMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Movie review account created");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.reviewer = ctx.accounts.initializer.key();
    movie_review.title = title;
    movie_review.description = description;
    movie_review.rating = rating;

    msg!("Movie Comment Counter Account Created");
    let movie_comment_counter = &mut ctx.accounts.movie_comment_counter;
    movie_comment_counter.counter = 0;
    msg!("Counter: {}", movie_comment_counter.counter);

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info()
            },
            &[&[
                b"mint",
                &[*ctx.bumps.get("mint").unwrap()]
            ]]
        ),
        10*10^6
    )?;

    msg!("Minted tokens");

    Ok(())
}
```

### 5. Update `update_movie_review` instruction

Here we are only adding the check for the `rating`.

```rust
pub fn update_movie_review(ctx: Context<UpdateMovieReview>, title: String, description: String, rating: u8) -> Result<()> {
    msg!("Movie review account space reallocated");
    msg!("Title: {}", title);
    msg!("Description: {}", description);
    msg!("Rating: {}", rating);

    require!(rating >= 1 && rating <= 5, MovieReviewError::InvalidRating);

    let movie_review = &mut ctx.accounts.movie_review;
    movie_review.description = description;
    movie_review.rating = rating;

    Ok(())
}
```

### 6. Add Comments

Next, let’s implement the `add_comment` instruction, `AddComment` context type, and `MovieComment` account type.

Let’s start with the `MovieComment` account type. This account will include the following fields:

- `review` - the address of the movie review
- `commenter` - public key of the user leaving the comment
- `comment` - the comment itself
- `count` - the count of the comment for the movie review

```rust
#[account]
pub struct MovieComment {
    pub review: Pubkey,    // 32
    pub commenter: Pubkey, // 32
    pub comment: String,   // 4 + len()
    pub count: u64,        // 8
}
```

Next, let’s implement the `AddComment` context type. We’ll need add the following accounts:

- `movie_comment` - initializing a new comment account
- `movie_review` - using the address as a seed for the `movie_comment` account PDA
- `movie_comment_counter` - using the value of the `count` field as a seed for the `movie_comment` account PDA
- `mint` - the `Mint` account for the token that the instruction mints
- `token_account` - the associated token account of the `initializer` for the `mint`
- `initializer` - the user submitting the comment
- `token_program` - required because we are using `Mint` and `TokenAccount` types
- `associated_token_program` - required because we are using the `associated_token` constraint in the `token_account`
- `rent` - required because we are using the `init-if-needed` feature in the `token_account`
- `system_program` - required because we are initializing new accounts

```rust
#[derive(Accounts)]
#[instruction(comment:String)]
pub struct AddComment<'info> {
    #[account(
        init,
        seeds = [movie_review.key().as_ref(), &movie_comment_counter.counter.to_le_bytes()],
        bump,
        payer = initializer,
        space = 8 + 32 + 32 + 4 + comment.len() + 8
    )]
    pub movie_comment: Account<'info, MovieComment>,
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(
        mut,
        seeds = [b"counter", movie_review.key().as_ref()],
        bump,
    )]
    pub movie_comment_counter: Account<'info, MovieCommentCounter>,
    #[account(
        mut,
        seeds = [b"mint"],
        bump
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = initializer,
        associated_token::mint = mint,
        associated_token::authority = initializer
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}
```

Next, let’s implement the `add_comment`instruction. Within the instruction we:

- Update the fields on the new `movie_comment` account
- Increment the `count` on the `movie_comment_counter` account by 1
- Make a CPI to the token program `mint_to` instruction to mint 5 tokens

```rust
pub fn add_comment(ctx: Context<AddComment>, comment: String) -> Result<()> {
    msg!("Comment Account Created");
    msg!("Comment: {}", comment);

    let movie_comment = &mut ctx.accounts.movie_comment;
    let movie_comment_counter = &mut ctx.accounts.movie_comment_counter;

    movie_comment.review = ctx.accounts.movie_review.key();
    movie_comment.commenter = ctx.accounts.initializer.key();
    movie_comment.comment = comment;
    movie_comment.count = movie_comment_counter.counter;

    movie_comment_counter.counter += 1;

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.mint.to_account_info(),
            },
            &[&[
                b"mint",
                &[*ctx.bumps.get("mint").unwrap()]
            ]]
        ),
        5*10^6
    )?;
    msg!("Minted Tokens");

    Ok(())
}
```

Lastly, run `anchor build` to check that the program builds.

### 5. Test

Next, let’s update the tests for the program.

Complete the following setup and derive the PDAs that we’ll use for the test.

```ts
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { expect } from "chai"
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token"
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program"

describe("anchor-movie-review-program", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider)

    const program = anchor.workspace
    .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>

    const movie = {
    title: "Just a test movie",
    description: "Wow what a good movie it was real great",
    rating: 5,
    }

    const [movie_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
    )

    const [mint] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("mint")],
    program.programId
    )

    const [commentCounterPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), movie_pda.toBuffer()],
    program.programId
    )

    it("Initializes the reward token", async () => {})

    it("Movie review is added", async () => {})

    it("Movie review is updated", async () => {})

    it("Adds a comment to a movie review", async () => {})

    it("Deletes a movie review", async () => {})
}
```

First, test the `initializeTokenMint` instruction

```ts
it("Initializes the reward token", async () => {
  const tx = await program.methods
    .initializeTokenMint()
    .accounts({
      mint: mint,
    })
    .rpc()
})
```

Next, update the test for the `addMovieReview` instruction. We’ll first need to get the `tokenAccount` address using `getAssociatedTokenAddress`.

```ts
it("Movie review is added", async () => {
  // Add your test here.
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    provider.wallet.publicKey
  )

  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .accounts({
      movieReview: movie_pda,
      mint: mint,
      tokenAccount: tokenAccount,
      movieCommentCounter: commentCounterPda,
    })
    .rpc()

  const account = await program.account.movieAccountState.fetch(movie_pda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)

  const userAta = await getAccount(provider.connection, tokenAccount)
  expect(Number(userAta.amount)).to.equal((10 * 10) ^ 6)
})
```

The test for `updateMovieReview` instruction remains the same.

```ts
it("Movie review is updated", async () => {
  const newDescription = "Wow this is new"
  const newRating = 4

  const tx = await program.methods
    .updateMovieReview(movie.title, newDescription, newRating)
    .accounts({
      movieReview: movie_pda,
    })
    .rpc()

  const account = await program.account.movieAccountState.fetch(movie_pda)
  expect(movie.title === account.title)
  expect(newRating === account.rating)
  expect(newDescription === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Next, test the `addComment` instruction. We’ll need to complete the following:

- Get the `tokenAccount` address
- Fetch the `commentCounter` account
- Derive the `comment` account PDA using the `movieReview` account address and the `count` on the `commentCounter` account as seeds

```ts
it("Adds a comment to a movie review", async () => {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    provider.wallet.publicKey
  )

  const commentCounter = await program.account.movieCommentCounter.fetch(
    commentCounterPda
  )

  const [commentPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [movie_pda.toBuffer(), commentCounter.counter.toArrayLike(Buffer, "le", 8)],
    program.programId
  )

  const tx = await program.methods
    .addComment("Just a test comment")
    .accounts({
      movieReview: movie_pda,
      mint: mint,
      tokenAccount: tokenAccount,
      movieCommentCounter: commentCounterPda,
      movieComment: commentPda,
    })
    .rpc()
})
```

The test for `deleteMovieReview` instruction also remains the same.

```ts
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .accounts({ movieReview: movie_pda })
    .rpc()
})
```

Finally, run `anchor test` and you should see the following output

```console
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Adds a comment to a movie review (405ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

If you need more time with the concepts from this lesson or got stuck along the way, feel free to take a look at the [solution code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-comments). Note that the solution to this demo is on the `solution-add-comments` branch.

# Challenge

To apply what you've learned about CPIs in this lesson, think about how you could incorporate them into the Student Intro program. You could do something similar to what we did in the demo here and add some functionality to mint tokens to users when they introduce themselves.

Try to do this independently if you can! But if you get stuck, feel free to reference this [solution code](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge)
Note that your code may look slightly different than the solution code depending on your implementation.

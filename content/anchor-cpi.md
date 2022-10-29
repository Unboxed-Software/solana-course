# Anchor CPIs and Errors

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Make Cross Program Invocations (CPIs) from an Anchor program
- Use the `cpi` feature to generate helper functions for invoking instructions on existing Anchor programs
- Use `invoke` and `invoke_signed` to make CPIs where CPI helper functions are unavailable
- Create and return custom Anchor errors

# TL;DR

- Anchor provides a simplified way to create CPIs using a **`CpiContext`**
- Anchor's **`cpi`** feature generates CPI helper functions for invoking instructions on existing Anchor programs
- If you do not have access to CPI helper functions, you can still use `invoke` and `invoke_signed` directly
- The **`error_code`** attribute macro is used to create custom Anchor Errors

# Overview

If you think back to the [first CPI lesson](cpi.md), you'll remember that constructing CPIs can get tricky with vanilla Rust. Anchor makes it a bit simpler though, especially if the program you're invoking is also an Anchor program whose crate you can access.

In this lesson, you'll learn how to construct an Anchor CPI. You'll also learn how to throw custom errors from an Anchor program so that you can start to write more sophisticated Anchor programs.

## Cross Program Invocations (CPIs) with Anchor

As a refresher, CPIs allow programs to invoke instructions on other programs using the `invoke` or `invoke_signed` functions. This allows new programs to build on top of existing programs (we call that composability).

While making CPIs directly using `invoke` or `invoke_signed` is still an option, Anchor also provides a simplified way to make CPIs by using a `CpiContext`.

In this lesson, you'll use the `anchor_spl` crate to make CPIs to the SPL Token Program. You can explore what's available in the `anchor_spl` crate [here](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

The first step in making a CPI is to create an instance of `CpiContext`. `CpiContext` is very similar to `Context`, the first argument type required by Anchor instruction functions. They are both declared in the same module and share similar functionality.

The `CpiContext` type specifies non-argument inputs for cross program invocations:

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

You use `CpiContext::new` to construct a new instance when passing along the original transaction signature.

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

You use `CpiContext::new_with_signer` to construct a new instance when signing on behalf of a PDA for the CPI.

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

### CPI accounts

One of the main things about `CpiContext` that simplifies cross-program invocations is that the `accounts` argument is a generic type that lets you pass in any object that adopts the `ToAccountMetas` and `ToAccountInfos<'info>` traits.

These traits are added by the `#[derive(Accounts)]` attribute macro that you've used before when creating structs to represent instruction accounts. That means you can use similar structs with `CpiContext`.

This helps with code organization and type safety.

### Invoke an instruction on another Anchor program

When the program you're calling is an Anchor program with a published crate, Anchor can generate instruction builders and CPI helper functions for you.

Simply declare your program's dependency on the program you're calling in your program's `Cargo.toml` file as follows:

```
[dependencies]
callee = { path = "../callee", features = ["cpi"]}
```

By adding `features = ["cpi"]`, you enable the `cpi` feature and your program gains access to the `callee::cpi` module.

The `cpi` module exposes `callee`'s instructions as a Rust function that takes as arguments a `CpiContext` and any additional instruction data. These functions use the same format as the instruction functions in your Anchor programs, only with `CpiContext` instead of `Context`. The `cpi` module also exposes the accounts structs required for calling the instructions.

For example, if `callee` has the instruction `do_something` that requires the accounts defined in the `DoSomething` struct, you could invoke `do_something` as follows:

```rust
use anchor_lang::prelude::*;
use callee;
...

#[program]
pub mod lootbox_program {
    use super::*;

    pub fn call_another_program(ctx: Context<CallAnotherProgram>, params: InitUserParams) -> Result<()> {
        callee::cpi::do_something(
            CpiContext::new(
                ctx.accounts.callee.to_account_info(),
                callee::DoSomething {
                    user: ctx.accounts.user.to_account_info()
                }
            )
        )
        Ok(())
    }
}
...
```

### Invoke an instruction on a non-Anchor program

When the program you're calling is *not* an Anchor program, there are two possible options:

1. It's possible that the program maintainers have published a crate with their own helper functions for calling into their program. For example, the `anchor_spl` crate provides helper functions that are virtually identical from a call-site perspective to what you would get with the `cpi` module of an Anchor program. E.g. you can mint using the [`mint_to` helper function](https://docs.rs/anchor-spl/latest/src/anchor_spl/token.rs.html#36-58) and use the [`MintTo` accounts struct](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.MintTo.html).
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
2. If there is no helper module for the program whose instruction(s) you need to invoke, you can fall back to using `invoke` and `invoke_signed`. In fact, the source code of the `mint_to` helper function referenced above shows an example us using `invoke_signed` when given a `CpiContext`. You can follow a similar pattern if you decide to use an accounts struct and `CpiContext` to organize and prepare your CPI.
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

## `AnchorError`

We're deep enough into Anchor at this point that it's important to know how to create custom errors.

Ultimately, all programs return the same error type: [`ProgramError`](https://docs.rs/solana-program/latest/solana_program/program_error/enum.ProgramError.html). However, when writing a program using Anchor you can use `AnchorError` as an abstraction on top of `ProgramError`. This abstraction provides additional information when a program fails, including:

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
- Custom errors that you the developer can create

You can add errors unique to your program by using the `error_code` attribute. Simply add this attribute to a custom `enum` type. You can then use the variants of the `enum` as errors in your program. Additionally, you can add an error message to each variant using the `msg` attribute. Clients can then display this error message if the error occurs.

```rust
#[error_code]
pub enum MyError {
    #[msg("MyAccount may only hold data below 100")]
    DataTooLarge
}
```

To return a custom error you can use the [err](https://docs.rs/anchor-lang/latest/anchor_lang/macro.err.html) or the [error](https://docs.rs/anchor-lang/latest/anchor_lang/prelude/macro.error.html) macro from an instruction function. These add file and line information to the error that is then logged by Anchor to help you with debugging.

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

Alternatively, you can use the [require](https://docs.rs/anchor-lang/latest/anchor_lang/macro.require.html) macro to simplify returning errors. The code above can be refactored to the following:

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

# Demo

Let’s practice the concepts we’ve gone over in this lesson by building on top of the Movie Review program from previous lessons.

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

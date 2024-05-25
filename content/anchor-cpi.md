---
title: Anchor CPIs and Errors
objectives:
- Make Cross Program Invocations (CPIs) from an Anchor program
- Use the `cpi` feature to generate helper functions for invoking instructions on existing Anchor programs
- Use `invoke` and `invoke_signed` to make CPIs where CPI helper functions are unavailable
- Create and return custom Anchor errors
---

# Summary

- Anchor provides a simplified way to create CPIs using a **`CpiContext`**
- Anchor's **`cpi`** feature generates CPI helper functions for invoking instructions on existing Anchor programs
- If you do not have access to CPI helper functions, you can still use `invoke` and `invoke_signed` directly
- The **`error_code`** attribute macro is used to create custom Anchor Errors

# Lesson

If you think back to the [first CPI lesson](cpi), you'll remember that constructing CPIs can get tricky with vanilla Rust. Anchor makes it a bit simpler though, especially if the program you're invoking is also an Anchor program whose crate you can access.

In this lesson, you'll learn how to construct an Anchor CPI. You'll also learn how to throw custom errors from an Anchor program so that you can start to write more sophisticated Anchor programs.

## Cross Program Invocations (CPIs) with Anchor

As a refresher, CPIs allow programs to invoke instructions on other programs using the `invoke` or `invoke_signed` functions. This allows new programs to build on top of existing programs (we call that composability).

While making CPIs directly using `invoke` or `invoke_signed` is still an option, Anchor also provides a simplified way to make CPIs by using a `CpiContext`.

In this lesson, you'll use the `anchor_spl` crate to make CPIs to the SPL Token Program. You can [explore what's available in the `anchor_spl` crate](https://docs.rs/anchor-spl/latest/anchor_spl/#).

### `CpiContext`

The first step in making a CPI is to create an instance of `CpiContext`. `CpiContext` is very similar to `Context`, the first argument type required by Anchor instruction functions. They are both declared in the same module and share similar functionality.

The `CpiContext` type specifies non-argument inputs for cross program invocations:

- `accounts` - the list of accounts required for the instruction being invoked
- `remaining_accounts` - any remaining accounts
- `program` - the program ID of the program being invoked
- `signer_seeds` - if a PDA is signing, include the seeds required to derive the PDA

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
                "mint".as_bytes(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]]
        ),
        amount,
    )?;
    ```
2. If there is no helper module for the program whose instruction(s) you need to invoke, you can fall back to using `invoke` and `invoke_signed`. In fact, the source code of the `mint_to` helper function referenced above shows an example using `invoke_signed` when given a `CpiContext`. You can follow a similar pattern if you decide to use an accounts struct and `CpiContext` to organize and prepare your CPI.
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

## Throw errors in Anchor

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

# Lab

Let’s practice the concepts we’ve gone over in this lesson by building on top of the Movie Review program from previous lessons.

In this lab we’ll update the program to mint tokens to users when they submit a new movie review.

### 1. Starter

To get started, we will be using the final state of the Anchor Movie Review program from the previous lesson. So, if you just completed that lesson then you’re all set and ready to go. If you are just jumping in here, no worries, you can [download the starter code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas). We'll be using the `solution-pdas` branch as our starting point.

### 2. Add dependencies to `Cargo.toml`

Before we get started we need enable the `init-if-needed` feature and add the `anchor-spl` crate to the dependencies in `Cargo.toml`. If you need to brush up on the `init-if-needed` feature take a look at the [Anchor PDAs and Accounts lesson](anchor-pdas).

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
anchor-spl = "0.25.0"
```

### 3. Initialize reward token

Next, navigate to `lib.rs` and create an instruction to initialize a new token mint. This will be the token that is minted each time a user leaves a review. Note that we don't need to include any custom instruction logic since the initialization can be handled entirely through Anchor constraints.

```rust
pub fn initialize_token_mint(_ctx: Context<InitializeMint>) -> Result<()> {
    msg!("Token mint initialized");
    Ok(())
}
```

Now, implement the `InitializeMint` context type and list the accounts and constraints the instruction requires. Here we initialize a new `Mint` account using a PDA with the string "mint" as a seed. Note that we can use the same PDA for both the address of the `Mint` account and the mint authority. Using a PDA as the mint authority enables our program to sign for the minting of the tokens.

To initialize the `Mint` account, we'll need to include the `token_program`, `rent`, and `system_program` in the list of accounts.

```rust
#[derive(Accounts)]
pub struct InitializeMint<'info> {
    #[account(
        init,
        seeds = ["mint".as_bytes()],
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

There may be some constraints above that you haven't seen yet. Adding `mint::decimals` and `mint::authority` along with `init` ensures that the account is initialized as a new token mint with the appropriate decimals and mint authority set.

### 4. Anchor Error

Next, let’s create an Anchor Error that we’ll use when validating the `rating` passed to either the `add_movie_review` or `update_movie_review` instruction.

```rust
#[error_code]
enum MovieReviewError {
    #[msg("Rating must be between 1 and 5")]
    InvalidRating
}
```

### 5. Update `add_movie_review` instruction

Now that we've done some setup, let’s update the `add_movie_review` instruction and `AddMovieReview` context type to mint tokens to the reviewer.

Next, update the `AddMovieReview` context type to add the following accounts:

- `token_program` - we'll be using the Token Program to mint tokens
- `mint` - the mint account for the tokens that we'll mint to users when they add a movie review
- `token_account` - the associated token account for the afforementioned `mint` and reviewer
- `associated_token_program` - required because we'll be using the `associated_token` constraint on the `token_account`
- `rent` - required because we are using the `init-if-needed` constraint on the `token_account`

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
    // ADDED ACCOUNTS BELOW
    pub token_program: Program<'info, Token>,
    #[account(
        seeds = ["mint".as_bytes()],
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

Again, some of the above constraints may be unfamiliar to you. The `associated_token::mint` and `associated_token::authority` constraints along with the `init_if_needed` constraint ensures that if the account has not already been initialized, it will be initialized as an associated token account for the specified mint and authority.

Next, let’s update the `add_movie_review` instruction to do the following:

- Check that `rating` is valid. If it is not a valid rating, return the `InvalidRating` error.
- Make a CPI to the token program’s `mint_to` instruction using the mint authority PDA as a signer. Note that we'll mint 10 tokens to the user but need to adjust for the mint decimals by making it `10*10^6`.

Fortunately, we can use the `anchor_spl` crate to access helper functions and types like `mint_to` and `MintTo` for constructing our CPI to the Token Program. `mint_to` takes a `CpiContext` and integer as arguments, where the integer represents the number of tokens to mint. `MintTo` can be used for the list of accounts that the mint instruction needs.

Update your `use` statements to include:

```rust
use anchor_spl::token::{mint_to, MintTo, Mint, TokenAccount, Token};
use anchor_spl::associated_token::AssociatedToken;
```

Next, update the `add_movie_review` function to:

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

    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                authority: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info()
            },
            &[&[
                "mint".as_bytes(),
                &[ctx.bumps.mint]
            ]]
        ),
        10*10^6
    )?;

    msg!("Minted tokens");

    Ok(())
}
```

### 6. Update `update_movie_review` instruction

Here we are only adding the check that `rating` is valid.

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

### 7. Test

Those are all of the changes we need to make to the program! Now, let’s update our tests.

Start by making sure your imports and `describe` function look like this:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
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
...
}
```
You can run `npm install @solana/spl-token --save-dev` if you don't have it installed.

With that done, add a test for the `initializeTokenMint` instruction:

```typescript
it("Initializes the reward token", async () => {
    const tx = await program.methods.initializeTokenMint().rpc()
})
```

Notice that we didn't have to add `.accounts` because they call be inferred, including the `mint` account (assuming you have seed inference enabled).

Next, update the test for the `addMovieReview` instruction. The primary additions are:
1. To get the associated token address that needs to be passed into the instruction as an account that cannot be inferred
2. Check at the end of the test that the associated token account has 10 tokens

```typescript
it("Movie review is added`", async () => {
  const tokenAccount = await getAssociatedTokenAddress(
    mint,
    provider.wallet.publicKey
  )
  
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .accounts({
      tokenAccount: tokenAccount,
    })
    .rpc()
  
  const account = await program.account.movieAccountState.fetch(movie_pda)
  expect(account.title).to.equal(movie.title)
  expect(account.rating).to.equal(movie.rating)
  expect(account.description).to.equal(movie.description)
  expect(account.reviewer.toBase58()).to.equal(provider.wallet.publicKey.toBase58())

  const userAta = await getAccount(provider.connection, tokenAccount)
  expect(Number(userAta.amount)).to.equal((10 * 10) ^ 6)
})
```

After that, neither the test for `updateMovieReview` nor the test for `deleteMovieReview` need any changes.

At this point, run `anchor test` and you should see the following output

```console
anchor-movie-review-program
    ✔ Initializes the reward token (458ms)
    ✔ Movie review is added (410ms)
    ✔ Movie review is updated (402ms)
    ✔ Deletes a movie review (405ms)

  5 passing (2s)
```

If you need more time with the concepts from this lesson or got stuck along the way, feel free to take a look at the [solution code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-add-tokens). Note that the solution to this lab is on the `solution-add-tokens` branch.

# Challenge

To apply what you've learned about CPIs in this lesson, think about how you could incorporate them into the Student Intro program. You could do something similar to what we did in the lab here and add some functionality to mint tokens to users when they introduce themselves.

Try to do this independently if you can! But if you get stuck, feel free to reference this [solution code](https://github.com/Unboxed-Software/anchor-student-intro-program/tree/cpi-challenge). Note that your code may look slightly different than the solution code depending on your implementation.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=21375c76-b6f1-4fb6-8cc1-9ef151bc5b0a)!

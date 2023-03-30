---
title: Anchor PDAs and Accounts
objectives:
- Use the `seeds` and `bump` constraints to work with PDA accounts in Anchor
- Enable and use the `init_if_needed` constraint
- Use the `realloc` constraint to reallocate space on an existing account
- Use the `close` constraint to close an existing account
---

# TL;DR

- The `seeds` and `bump` constraints are used to initialize and validate PDA accounts in Anchor
- The `init_if_needed` constraint is used to conditionally initialize a new account
- The `realloc` constraint is used to reallocate space on an existing account
- The `close` constraint is used to close an account and refund its rent

# Overview

In this lesson you'll learn how to work with PDAs, reallocate accounts, and close accounts in Anchor.

Recall that Anchor programs separate instruction logic from account validation. Account validation primarily happens within structs that represent the list of accounts needed for a given instruction. Each field of the struct represents a different account, and you can customize the validation performed on the account using the `#[account(...)]` attribute macro.

In addition to using constraints for account validation, some constraints can handle repeatable tasks that would otherwise require a lot of boilerplate inside our instruction logic. This lesson will introduce the `seeds`, `bump`, `realloc`, and `close` constraints to help you initialize and validate PDAs, reallocate accounts, and close accounts.

## PDAs with Anchor

Recall that [PDAs](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda.md) are derived using a list of optional seeds, a bump seed, and a program ID. Anchor provides a convenient way to validate a PDA with the `seeds` and `bump` constraints.

```rust
#[derive(Accounts)]
struct ExampleAccounts {
  #[account(
    seeds = [b"example_seed"],
    bump
  )]
  pub pda_account: Account<'info, AccountType>,
}
```

During account validation, Anchor will derive a PDA using the seeds specified in the `seeds` constraint and verify that the account passed into the instruction matches the PDA found using the specified `seeds`.

When the `bump` constraint is included without specifying a specific bump, Anchor will default to using the canonical bump (the first bump that results in a valid PDA). In most cases you should use the canonical bump.

You can access other fields from within the struct from constraints, so you can specify seeds that are dependent on other accounts like the signer's public key.

You can also reference the deserialized instruction data if you add the `#[instruction(...)]` attribute macro to the struct.

For example, the following example shows a list of accounts that include `pda_account` and `user`. The `pda_account` is constrained such that the seeds must be the string "example_seed," the public key of `user`, and the string passed into the instruction as `instruction_data`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct Example<'info> {
    #[account(
        seeds = [b"example_seed", user.key().as_ref(), instruction_data.as_ref()],
        bump
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>
}
```

If the `pda_account` address provided by the client doesn't match the PDA derived using the specified seeds and the canonical bump, then the account validation will fail.

### Use PDAs with the `init` constraint

You can combine the `seeds` and `bump` constraints with the `init` constraint to initialize an account using a PDA.

Recall that the `init` constraint must be used in combination with the `payer` and `space` constraints to specify the account that will pay for account initialization and the space to allocate on the new account. Additionally, you must include `system_program` as one of the fields of the account validation struct.

```rust
#[derive(Accounts)]
pub struct InitializePda<'info> {
    #[account(
        init,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: u64,
}
```

When using `init` for non-PDA accounts, Anchor defaults to setting the owner of the initialized account to be the program currently executing the instruction.

However, when using `init` in combination with `seeds` and `bump`, the owner *must* be the executing program. This is because initializing an account for the PDA requires a signature that only the executing program can provide. In other words, the signature verification for the initialization of the PDA account would fail if the program ID used to derive the PDA did not match the program ID of the executing program.

When determining the value of `space` for an account initialized and owned by the executing Anchor program, remember that the first 8 bytes are reserved for the account discriminator. This is an 8-byte value that Anchor calculates and uses to identify the program account types. You can use this [reference](https://www.anchor-lang.com/docs/space) to calculate how much space you should allocate for an account.

### Seed inference

The account list for an instruction can get really long for some programs. To simplify the client-side experience when invoking an Anchor program instruction, we can turn on seed inference.

Seed inference adds information about PDA seeds to the IDL so that Anchor can infer PDA seeds from existing call-site information. In the previous example, the seeds are `b"example_seed"` and `user.key()`. The first is static and therefore known, and the second is known because `user` is the transaction signer.

If you use seed inference when building your program, then as long as you're calling the program using Anchor, you don't need to explicitly derive and pass in the PDA. Instead, the Anchor library will do it for you.

You can turn on seed inference in the `Anchor.toml` file with `seeds = true` under `[features]`.

```
[features]
seeds = true
```

### Use the `#[instruction(...)]` attribute macro

Let's briefly look at the `#[instruction(...)]` attribute macro before moving on. When using `#[instruction(...)]`, the instruction data you provide in the list of arguments must match and be in the same order as the instruction arguments. You can omit unused arguments at the end of the list, but you must include all arguments up until the last one you will be using.

For example, imagine an instruction has arguments `input_one`, `input_two`, and `input_three`. If your account constraints need to reference `input_one` and `input_three`, you need to list all three arguments in the `#[instruction(...)]` attribute macro.

However, if your constraints only reference `input_one` and `input_two`, you can omit `input_three`.

```rust
pub fn example_instruction(
    ctx: Context<Example>,
    input_one: String,
    input_two: String,
    input_three: String,
) -> Result<()> {
    ...
    Ok(())
}

#[derive(Accounts)]
#[instruction(input_one:String, input_two:String)]
pub struct Example<'info> {
    ...
}
```

Additionally, you will get an error if you list the inputs in the incorrect order:

```rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## Init-if-needed

Anchor provides an `init_if_needed` constraint that can be used to initialize an account if the account has not already been initialized.

This feature is gated behind a feature flag to make sure you are intentional about using it. For security reasons, it's smart to avoid having one instruction branch into multiple logic paths. And as the name suggests, `init_if_needed` executes one of two possible code paths depending on the state of the account in question.

When using `init_if_needed`, you need to make sure to properly protect your program against re-initialization attacks. You need to include checks in your code that check that the initialized account cannot be reset to its initial settings after the first time it was initialized.

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

When the `initialize` instruction is invoked in the previous example, Anchor will check if the `token_account` exists and initialize it if it does not. If it already exists, then the instruction will continue without initializing the account. Just as with the `init` constraint, you can use `init_if_needed` in conjunction with `seeds` and `bump` if the account is a PDA.

## Realloc

The `realloc` constraint provides a simple way to reallocate space for existing accounts.

The `realloc` constraint must be used in combination with the following constraints:

- `mut` - the account must be set as mutable
- `realloc::payer` - the account to subtract or add lamports to depending on whether the reallocation is decreasing or increasing account space
- `realloc::zero` - boolean to specify if new memory should be zero initialized

As with `init`, you must include `system_program` as one of the accounts in the account validation struct when using `realloc`.

Below is an example of reallocating space for an account that stores a `data` field of type `String`.

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct ReallocExample<'info> {
    #[account(
        mut,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        realloc = 8 + 4 + instruction_data.len(),
        realloc::payer = user,
        realloc::zero = false,
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: String,
}
```

Notice that `realloc` is set to `8 + 4 + instruction_data.len()`. This breaks down as follows:
- `8` is for the account discriminator
- `4` is for the 4 bytes of space that BORSH uses to store the length of the string
- `instruction_data.len()` is the length of the string itself

If the change in account data length is additive, lamports will be transferred from the `realloc::payer` to the account in order to maintain rent exemption. Likewise, if the change is subtractive, lamports will be transferred from the account back to the `realloc::payer`.

The `realloc::zero` constraint is required in order to determine whether the new memory should be zero initialized after reallocation. This constraint should be set to true in cases where you expect the memory of an account to shrink and expand multiple times. That way you zero out space that would otherwise show as stale data.

## Close

The `close` constraint provides a simple and secure way to close an existing account.

The `close` constraint marks the account as closed at the end of the instruction’s execution by setting its discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR` and sends its lamports to a specified account. Setting the discriminator to a special variant makes account revival attacks (where a subsequent instruction adds the rent exemption lamports again) impossible. If someone tries to reinitialize the account, the reinitialization will fail the discriminator check and be considered invalid by the program.

The example below uses the `close` constraint to close the `data_account` and sends the lamports allocated for rent to the `receiver` account.

```rust
pub fn close(ctx: Context<Close>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, AccountType>,
    #[account(mut)]
    pub receiver: Signer<'info>
}
```

# Demo

Let’s practice the concepts we’ve gone over in this lesson by creating a Movie Review program using the Anchor framework.

This program will allow users to:

- Use a PDA to initialize a new movie review account to store the review
- Update the content of an existing movie review account
- Close an existing movie review account

### 1. Create a new Anchor project

To begin, let’s create a new project using `anchor init`.

```console
anchor init anchor-movie-review-program
```

Next, navigate to the `lib.rs` file within the `programs` folder and you should see the following starter code.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

Go ahead and remove the `initialize` instruction and `Initialize` type.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

First, let’s use the `#[account]` attribute macro to define the `MovieAccountState` that will represent the data structure of the movie review accounts. As a reminder, the `#[account]` attribute macro implements various traits that help with serialization and deserialization of the account, set the discriminator for the account, and set the owner of a new account as the program ID defined in the `declare_id!` macro.

Within each movie review account, we’ll store the:

- `reviewer` - user creating the review
- `rating` - rating for the movie
- `title` - title of the movie
- `description` - content of the review

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}

#[account]
pub struct MovieAccountState {
    pub reviewer: Pubkey,    // 32
    pub rating: u8,          // 1
    pub title: String,       // 4 + len()
    pub description: String, // 4 + len()
}
```

### 3. Add Movie Review

Next, let’s implement the `add_movie_review` instruction. The `add_movie_review` instruction will require a `Context` of type `AddMovieReview` that we’ll implement shortly.

The instruction will require three additional arguments as instruction data provided by a reviewer:

- `title` - title of the movie as a `String`
- `description` - details of the review as a `String`
- `rating` - rating for the movie as a `u8`

Within the instruction logic, we’ll populate the data of the new `movie_review` account with the instruction data. We’ll also set the `reviewer` field as the `initializer` account from the instruction context.

```rust
#[program]
pub mod movie_review{
    use super::*;

    pub fn add_movie_review(
        ctx: Context<AddMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie Review Account Created");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.reviewer = ctx.accounts.initializer.key();
        movie_review.title = title;
        movie_review.rating = rating;
        movie_review.description = description;
        Ok(())
    }
}
```

Next, let’s create the `AddMovieReview` struct that we used as the generic in the instruction's context. This struct will list the accounts the `add_movie_review` instruction requires.

Remember, you'll need the following macros:

- The `#[derive(Accounts)]` macro is used to deserialize and validate the list of accounts specified within the struct
- The `#[instruction(...)]` attribute macro is used to access the instruction data passed into the instruction
- The `#[account(...)]` attribute macro then specifies additional constraints on the accounts

The `movie_review` account is a PDA that needs to be initialized, so we'll add the `seeds` and `bump` constraints as well as the `init` constraint with its required `payer` and `space` constraints.

For the PDA seeds, we'll use the movie title and the reviewer's public key. The payer for the initialization should be the reviewer, and the space allocated on the account should be enough for the account discriminator, the reviewer's public key, and the movie review's rating, title, and description.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Update Movie Review

Next, let’s implement the `update_movie_review` instruction with a context whose generic type is `UpdateMovieReview`.

Just as before, the instruction will require three additional arguments as instruction data provided by a reviewer:

- `title` - title of the movie
- `description` - details of the review
- `rating` - rating for the movie

Within the instruction logic we’ll update the `rating` and `description` stored on the `movie_review` account.

While the `title` doesn't get used in the instruction function itself, we'll need it for account validation of `movie_review` in the next step.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn update_movie_review(
        ctx: Context<UpdateMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("Movie review account space reallocated");
        msg!("Title: {}", title);
        msg!("Description: {}", description);
        msg!("Rating: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.rating = rating;
        movie_review.description = description;

        Ok(())
    }

}
```

Next, let’s create the `UpdateMovieReview` struct to define the accounts that the `update_movie_review` instruction needs.

Since the `movie_review` account will have already been initialized by this point, we no longer need the `init` constraint. However, since the value of `description` may now be different, we need to use the `realloc` constraint to reallocate the space on the account. Accompanying this, we need the `mut`, `realloc::payer`, and `realloc::zero` constraints.

We'll also still need the `seeds` and `bump` constraints as we had them in `AddMovieReview`.

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct UpdateMovieReview<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        realloc = 8 + 32 + 1 + 4 + title.len() + 4 + description.len(),
        realloc::payer = initializer,
        realloc::zero = true,
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

Note that the `realloc` constraint is set to the new space required by the `movie_review` account based on the updated value of `description`.

Additionally, the `realloc::payer` constraint specifies that any additional lamports required or refunded will come from or be send to the `initializer` account.

Finally, we set the `realloc::zero` constraint to `true` because the `movie_review` account may be updated multiple times either shrinking or expanding the space allocated to the account.

### 5. Delete Movie Review

Lastly, let’s implement the `delete_movie_review` instruction to close an existing `movie_review` account.

We'll use a context whose generic type is `DeleteMovieReview` and won't include any additional instruction data. Since we are only closing an account, we actually don't need any instruction logic inside the body of the function. The closing itself will be handled by the Anchor constraint in the `DeleteMovieReview` type.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn delete_movie_review(_ctx: Context<DeleteMovieReview>, title: String) -> Result<()> {
        msg!("Movie review for {} deleted", title);
        Ok(())
    }

}
```

Next, let’s implement the `DeleteMovieReview` struct.

```rust
#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeleteMovieReview<'info> {
    #[account(
        mut,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        close=initializer
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>
}
```

Here we use the `close` constraint to specify we are closing the `movie_review` account and that the rent should be refunded to the `initializer` account. We also include the `seeds` and `bump` constraints for the the `movie_review` account for validation. Anchor then handles the additional logic required to securely close the account.

### 6. Testing

The program should be good to go! Now let's test it out. Navigate to `anchor-movie-review-program.ts` and replace the default test code with the following.

Here we:

- Create default values for the movie review instruction data
- Derive the movie review account PDA
- Create placeholders for tests

```ts
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
import { assert, expect } from "chai"
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

  const [moviePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  it("Movie review is added`", async () => {})

  it("Movie review is updated`", async () => {})

  it("Deletes a movie review", async () => {})
})
```

Next, let's create the first test for the `addMovieReview` instruction. Note that we don't explicitly add `.accounts`. This is because the `Wallet` from `AnchorProvider` is automatically included as a signer, Anchor can infer certain accounts like `SystemProgram`, and Anchor can also infer the `movieReview` PDA from the `title` instruction argument and the signer's public key.

Once the instruction runs, we then fetch the `movieReview` account and check that the data stored on the account match the expected values.

```ts
it("Movie review is added`", async () => {
  // Add your test here.
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(movie.rating === account.rating)
  expect(movie.description === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Next, let's create the test for the `updateMovieReview` instruction following the same process as before.

```ts
it("Movie review is updated`", async () => {
  const newDescription = "Wow this is new"
  const newRating = 4

  const tx = await program.methods
    .updateMovieReview(movie.title, newDescription, newRating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(movie.title === account.title)
  expect(newRating === account.rating)
  expect(newDescription === account.description)
  expect(account.reviewer === provider.wallet.publicKey)
})
```

Next, create the test for the `deleteMovieReview` instruction

```ts
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .rpc()
})
```

Lastly, run `anchor test` and you should see the following output in the console.

```console
  anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

If you need more time with this project to feel comfortable with these concepts, feel free to have a look at the [solution code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas) before continuing.

# Challenge

Now it’s your turn to build something independently. Equipped with the concepts introduced in this lesson, try to recreate the Student Intro program that we've used before using the Anchor framework.

The Student Intro program is a Solana Program that lets students introduce themselves. The program takes a user's name and a short message as the instruction data and creates an account to store the data on-chain.

Using what you've learned in this lesson, build out this program. The program should include instructions to:

1. Initialize a PDA account for each student that stores the student's name and their short message
2. Update the message on an existing account
3. Close an existing account

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-student-intro-program).

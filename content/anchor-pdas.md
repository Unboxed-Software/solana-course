# PDAs in Anchor and Account Constraints

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Use the `seeds` and `bump` constraints to work with PDAs in Anchor
- Use the `realloc` constraint to reallocate space on an existing account
- Use the `close` constraint to close an existing account

# TL;DR

- The `seeds` and `bump` constraints are used to initialize and validate PDAs in Anchor
- The `realloc` constraint is used to reallocate space on an existing account
- The `close` constraint is used to close an account and refund its rent

# Overview

In this lesson you will learn how to use the following constraints with the `#[account(...)]` attribute macro:

- `seeds` and `bump` - to initialize and validate PDAs
- `realloc` - to reallocate space on an account
- `close` - to close an account

As a refresher, the instruction logic and account validation are separated into distinct sections within an Anchor program. The `#[derive(Accounts)]` macro is used to apply the `Accounts` trait to structs representing the list of accounts required for an instruction. Additional account constraints are then implemented using the `#[account(...)]` attribute macro.

### PDAs with Anchor

Recall that [PDAs](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda.md) are derived using a list of optional seeds, a bump seed, and a program ID. Anchor provides a convenient way to validate a PDA with the `seeds` and `bump` constraints.

```rust
#[account(
    seeds = [],
    bump
)]
pub pda_account: Account<'info, AccountType>,
```

During account validation, Anchor will derive a PDA using the seeds specified in the `seeds` constraint and verify that the account passed into the instruction matches the PDA found using the specified `seeds`.

When the `bump` constraint is included without specifying a specific bump, Anchor will default to using the canonical bump (the first bump that results in a valid PDA).

In the example below, the `seeds` and `bump` constraints are used to validate that the address of the `pda_account` is the expected PDA.

The `seeds` used derive the PDA include:

- `example_seed` - a hardcoded string value
- `user.key()` - the public key of the account passed in as the `user`
- `instruction_data` - the instruction data passed into the instruction. You can access instruction data using the `#[instruction(...)]` attribute macro.

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

When using the `#[instruction(...)]` attribute macro, the instruction data must be in the order that was passed into the instruction. You can omit all arguments after the last one you need.

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

An error would result if the inputs were listed in a different order:

```rust
#[derive(Accounts)]
#[instruction(input_three:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

You can combine the `init` constraint with the `seeds` and `bump` constraints to initialize an account using a PDA.

The `init` constraint must be used in combination with:

- `payer` - account specified to pay for the initialization
- `space` - space allocated to the new account
- `system_program` - the `init` constraint requires `system_program` to exist in the account validation struct

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

By default `init` sets the owner of the initialized account as the program currently executing the instruction.

However, when using `init`, `seeds`, and `bump` to initialize an account with a PDA, the owner must be the executing program. This is because creating an account requires a signature for which only the PDAs of the executing program can provide (i.e. the signature verification for the initialization of the PDA account would fail if the program ID used to derive the PDA did not match the program ID of the executing program).

The `bump` value does not need to be specified since `init` uses `find_program_address` to derive the PDA. This means that the PDA will be derived using the canonical bump.

When allocating `space` for an account initialized and owned by the executing Anchor program, remember that the first 8 bytes are reserved for a unique account discriminator that Anchor calculates and uses to identify the program account types. You can use this [reference](https://www.anchor-lang.com/docs/space) to calculate how much space you should allocate for an account.

### Realloc

The `realloc` constraint provides a simple way to reallocate space for existing accounts.

The `realloc` constraint must be used in combination with:

- `mut` - the account must be set as mutable
- `realloc::payer` - the account to subtract or add lamports to depending on whether the reallocation is decreasing or increasing account space
- `realloc::zero` - boolean to specify if new memory should be zero initialized
- `system_program` - the `realloc` constraint requires `system_program` to exist in the account validation struct

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

When using `String` types, an addition 4 bytes of space is used to store the length of the `String` in addition to the space allocated for the `String` itself.

If the change in account data length is additive, lamports will be transferred from the `realloc::payer` to the account in order to maintain rent exemption. Likewise, if the change is subtractive, lamports will be transferred from the account back to the `realloc::payer`.

The `realloc::zero` constraint is required in order to determine whether the new memory should be zero initialized after reallocation. This constraint should be set to true in cases where the memory of an account is expected shrink and expand multiple times.

### Close

The `close` constraint provides a simple and secure way to close an existing account.

The `close` constraint marks the account as closed at the end of the instruction’s execution by setting its discriminator to the `CLOSED_ACCOUNT_DISCRIMINATOR` and sends its lamports to a specified account. Setting the discriminator to a special variant makes account revival attacks (where a subsequent instruction adds the rent exemption lamports again) impossible. If the account was reinitialized, it would fail the discriminator check and be considered invalid by the program.

The example below uses the `close` constraint to close the `data_account` and sending the lamports allocated for rent to the `receiver` account.

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

Go ahead and remove the `initialize` instruction and `Initialize` `Context` type.

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

First, let’s use the `#[account]` attribute macro to define the `MovieAccountState` that will represent the data structure of the movie review accounts. As a reminder, the `#[account]` attribute macro implements various traits that helps to handle the serialization and deserialization of the account, sets the discriminator for the account, and sets the owner of a new account as the program ID defined in the `declare_id!` macro.

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

- `title` - title of the movie
- `description` - details of the review
- `rating` - rating for the movie

Within the instruction logic, we’ll populate the data of the new `movie_review` account with the instruction data. We’ll also set the `reviewer` field as the `initializer` account from the instruction `Context`.

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

...
```

Next, let’s implement the `AddMovieReview` `Context` type that lists the accounts the `add_movie_review` instruction requires.

As a reminder,

- The `#[derive(Accounts)]` macro is used to deserialize and validate the list of accounts specified within the struct
- The `#[instruction(...)]` attribute macro is used to access the instruction data passed into the instruction
- The `#[account(...)]` attribute macro then specifies additional constraints on the accounts

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...
}

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

...
```

Here we are initializing a new `movie_review` account with a PDA derived using two `seeds`:

- `title` - the title of the movie from the instruction data
- `initializer.key()` - the public key of the `initializer` creating the movie review

We are then allocating `space` to the new account based on the structure of the `MovieAccountState` account type and the length of the `title` and `description` from the instruction data. The first 8 bytes are allocated for the discriminator Anchor uses to identify `MovieAccountState` account types.

### 4. Update Movie Review

Next, let’s implement the `update_movie_review` instruction that requires a `Context` type of `UpdateMovieReview` that we’ll implement shortly.

Just as before, the instruction will require three additional arguments as instruction data provided by a reviewer:

- `title` - title of the movie
- `description` - details of the review
- `rating` - rating for the movie

The `title` is required for account validation to derive the PDA used for the `movie_review` account. Within the instruction logic we’ll update the `rating` and `description` stored on the `movie_review` account.

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

...
```

Next, let’s implement the `UpdateMovieReview` `Context` type that lists the accounts the `update_movie_review` instruction requires.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...
}

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

...
```

Here we are using the `seeds` and `bump` constraints to validate that the `movie_review` account passed into the instruction matched the PDA we expect. Anchor will derive a PDA using the `seeds` listed in the constraint and check that the PDA matches the `movie_review` account.

We also use the `realloc` constraint to have Anchor handle the reallocation of space and rent for the account based on the updated `description` from the instruction data.

The `realloc::payer` constraint specifies that any additional lamports required or refunded will come from or be send to the `initializer` account.

The `realloc::zero` constraint is set to `true` because the `movie_review` account may be updated multiple times either shrinking or expanding the space allocated to the account.

### 5. Delete Movie Review

Lastly, let’s implement the `delete_movie_review` instruction to close an existing `movie_review` account.

The instruction will require a `Context` type of `DeleteMovieReview` with no additional instruction data. Since we are only closing an account, we will not need any additional instruction logic.

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

...
```

Next, let’s implement the `DeleteMovieReview` `Context` type.

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...
}

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

...
```

Here we use the `close` constraint to specify we are closing the `movie_review` account and that the rent should be refunded to the `initializer` account. We also include the seed constraints for the the `movie_review` account for validation. Anchor then handles the additional logic required to securely close the account.

### 6. Testing

Navigate to `anchor-movie-review-program.ts` and replace the default test code with the following.

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

  const [movie_pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  it("Movie review is added`", async () => {})

  it("Movie review is updated`", async () => {})

  it("Deletes a movie review", async () => {})
})
```

Next, let's create the first test for the `addMovieReview` instruction. Note that we only include the `movieReview` account in the list of `accounts`. This is because the `Wallet` from `AnchorProvider` is automatically included as a signer and Anchor can infer accounts such as `SystemProgram`.

Once the instruction runs, we then fetch the `movieReview` account and check that the data stored on the account match the expected values.

```ts
it("Movie review is added`", async () => {
  // Add your test here.
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .accounts({
      movieReview: movie_pda,
    })
    .rpc()

  const account = await program.account.movieAccountState.fetch(movie_pda)
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

Next, create the test for the `deleteMovieReview` instruction

```ts
it("Deletes a movie review", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .accounts({ movieReview: movie_pda })
    .rpc()
})
```

Lastly, run `anchor test` and you should see the following output.

```console
  anchor-movie-review-program
    ✔ Movie review is added` (139ms)
    ✔ Movie review is updated` (404ms)
    ✔ Deletes a movie review (403ms)


  3 passing (950ms)
```

If you need more time with this project to feel comfortable with these concepts, feel free to have a look at the [solution code](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas) before continuing.

# Challenge

Now it’s your turn to build something independently. Equipped with the concepts introduced in this lesson, try to recreate a Student Intro program using the Anchor framework.

The Student Intro program is a Solana Program that lets students introduce themselves. The program takes a user's name and a short message as the instruction data and creates an account to store the data on-chain.

Using what you've learned in this lesson, build out this program. The program should include instructions to:

1. Use a PDA to initialize a separate account for each student
2. Update the message on an existing account
3. Close an existing account

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-student-intro-program).

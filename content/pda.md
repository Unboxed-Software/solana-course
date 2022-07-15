# PDAs

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Explain Program Derived Addresses (PDAs)
- Explain various use cases of PDAs
- Describe how PDAs are derived
- Use PDA derivations to locate and retrieve data

# TL;DR

- A Program Derived Address (PDA) is derived from a program ID and an optional list of seeds.
- PDAs are controlled by the program they are derived from
- PDAs provide a deterministic way to find data
- Programs can sign instructions on behalf of PDAs derived from its program ID

# Overview

## What is a Program Derived Address

Program Derived Addresses (PDAs) are account addresses designed to be signed for by a program rather than a secret key. As the name suggests, PDAs are derived using a program ID. Optionally, the derived accounts can also be found using a set of "seeds." More on this later, but these seeds will play an important role in how we use PDAs for data storage and retrieval. A PDA looks exactly like the public key of a Solana key pair. There is an important difference, though - these public keys have no corresponding private key. In other words, unlike the public keys of Solana key pairs, PDAs are not on the ed25519 curve.

PDAs serve two main functions:

1. Provide a deterministic way to find the address of an account
2. Authorize a program to sign on their behalf in the same way a user may sign with their private key.

In this lesson we will focus on using PDAs to find and store data. We will discuss signing with a PDA more thoroughly in a future lesson where we cover Cross Program Invocations (CPIs).

## Finding PDAs

PDAs are not technically created. Rather, they are *found* or *derived* based on a program ID and one or more input seeds. Regular Solana keypairs lie on the ed25519 Elliptic Curve and have public/private keys. PDAs are addresses that lie *off* the ed25519 Elliptic curve and do not have a corresponding private key. The details of elliptic curve cryptography are outside the scope of this lesson, but for now it is sufficient to understand that PDAs are 32 byte strings that look like public keys without an associated private key.

To find a PDA within a Solana program, we use the `find_program_address` function. This function takes an optional list of “seeds” and a program ID as inputs, and then returns the PDA and a bump seed.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Seeds

“Seeds” are optional inputs used in the `find_program_address` function to derive a PDA. For example, seeds can be any combination of public keys, inputs provided by a user, or hardcoded values. A PDA can also be derived using only the program ID and no additional seeds. Using seeds to find our PDAs, however, allows us to create an arbitrary number of accounts our program can own.

A “bump seed” is an additional seed the `find_program_address` function includes to ensure the PDA lies off the ed25519 Elliptic curve, i.e. to ensure the PDA does not have a corresponding private key. The `find_program_address` function tries to find a PDA using the optional seeds provided, the program ID, and the “bump seed” starting from 255. If the output is not a valid PDA, then the function decreases the bump by 1 and tries again (255, 254, 253, etc). Once a valid PDA is found, the function returns both the PDA and the bump that was used to derive the PDA.

Under the hood, the `find_program_address` function passes the input `seeds` and `program_id` to the `try_find_program_address` function.

```rust
 pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

The `try_find_program_address` function then introduces the `bump_seed`. The `bump_seed` is a `u8` variable with a value ranging between 0 to 255. In a loop from 255 to 0, a `bump_seed` is appended to the optional input seeds and then passed to the `create_program_address` function. If the output of `create_program_address` is not a valid PDA, then the `bump_seed` is decreased by 1 and the loop continues.

```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

The `create_program_address` function performs a set of hash operations over the seeds and `program_id` to compute a key and then verifies if the computed key lies on the ed25519 elliptic curve or not. If a valid PDA is found, then the PDA is returned. Otherwise, an error is returned.

```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```

In summary, the `find_program_address` function passes our input seeds and `program_id` to the `try_find_program_address` function. The `try_find_program_address` function adds a `bump_seed` (starting from 255) to our input seeds calls the `create_program_address` function in a loop until a valid PDA is found. Once a valid PDA is found, both the PDA and `bump_seed` are returned.

Note that for the same input seeds, different valid bumps will generate different valid PDAs. The `bump_seed` returned by `find_program_address` will always be the first valid PDA found. Because the function starts with a `bump_seed` value of 255 and iterates downwards to zero, the `bump_seed` that ultimately gets returned will always be the largest valid 8-bit value possible. This `bump_seed` is commonly referred to as the "canonical bump". To avoid confusion, it's recommended to only use the canonical bump, and to always validate every PDA passed into your program.

## Why do PDAs matter?

PDAs are important because they allows us to easily map our program’s accounts. Instead of keeping track of each address, we simply need to remember the seeds used to derive PDAs to find an account.

For example, in programs that store user-specific data it’s common to add a user’s public key as an optional seed. This separates each user’s data into its own PDA and makes it possible for the client to locate each user’s data by finding the address with the program ID and the user’s public key. One limitation of this approach is that it would limit each user to only one PDA account for our program.

If we wanted to associate multiple PDA accounts with a user, we would use one or more additional seeds to create and identify accounts. For example, in a note-taking app there may be one account per note where each PDA is derived with the user’s public key and the note’s title.

In addition to providing a deterministic way to derive a unique address for an account, PDAs also allow programs to sign for a instruction without a private key. We will go over signing with a PDA more in depth next lesson where we discuss Cross Program Invocations (CPIs). For now, we will focus on storing and locating data using PDAs.

## Store and locate data with PDAs

Without talking about it explicitly, we’ve been mapping seeds to PDAs this entire course. Think about the Movie Review program we built. Remember how we used the initializer’s public key and the movie title? Yep, we used them as the seeds. With those seeds we were able to derive a PDA for each new movie reviewing account.

### Map to data using PDA derivation

What we are currently doing with the Movie Review program is mapping given seeds to data accounts. Deriving the PDAs for our movie review accounts this way allows us to create a unique address for every new review. To later retrieve the review account, all we need to know is the initializer’s public key and the movie title of the review.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id)
```

### Map to data using single PDA account

Another approach to organizing movie reviews could be to create an account to represent a user’s profile that uses a PDA derived from the user’s public key as an optional seed. This would limit every user to one profile, and we could find the profile of any user if we know their public key.

In this profile account we could then store a list of addresses for all the reviews the user has created. This way, if we know the public key of the user we are looking for, we can easily locate all the movie reviews created by that user.

One limitation of this approach is that it would require use to reallocate space for the profile account every time a new movie review is created. Eventually, we would reach the memory limitations to an account, where an account can have a maximum size of 10 megabytes.

# Demo

Let’s practice together with the Movie Review program we've worked on in previous lessons. No worries if you’re just jumping into this lesson without having done the previous lesson - it should be possible to follow along either way.

As a refresher, the Movie Review program lets users create movie reviews stored in an account using a PDA derived with the initializer’s public key and movie title.

Previously, we finished implementing the ability to update a movie review in a secure manner. In this lesson, we'll add the ability for users to comment on a movie review.

### 1. Get the starter code

To begin, you can find the starter code [here](https://github.com/ZYJLiu/movie-review-pda-lesson/tree/starter).

If you've been following along with the Movie Review demos, you'll notice that this is the program we’ve built out so far. Previously, we used [Solana Playground](https://beta.solpg.io/) to write, build, and deploy our code. In this lesson, we’ll build and deploy the program locally.

Open the folder, then run `cargo-build-bpf` to build the program. The `cargo-build-bpf` command will output instruction to deploy the program.

```sh
cargo-build-bpf
```

Deploy the program by copying the output of `cargo-build-bpf` and running the `solana program deploy` command.

```sh
solana program deploy <PATH>
```

You can test the program using the movie review [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) by updating the program ID with the one you’ve just deployed.

To enable comments for our Movie Review program, we’ll be making updates to the following files.

1. `state.rs` - to define the structs for the new accounts we’ll be creating
2. `instruction.rs` - to implement ability to deserialize instruction data for our new `add_comment` instruction
3. `processor.rs` - to update our `add_movie_review` instruction and write the `add_comment` instruction

### 2. Update to `state.rs`

Recall that the `state.rs` file defines the structs our program uses to populate the data field of a new account.

We’ll need to define two new structs to enable commenting.

1. `MovieCommentCounter` - to store a counter for the number of comments associated with a review
2. `MovieComment` - to store data associated with each comment

To begin, let’s bring into scope `Pubkey` from the `solana_program` crate. Update `use solana_program` at the top of `state.rs` with the following:

```rust
use solana_program::{
    program_pack::{IsInitialized, Sealed}, pubkey::Pubkey
};
```

Next, let’s define the structs we’ll be using for our program. Note that we are adding a `discriminator` field to each struct. This discriminator is a string that we can use in our frontend to filter through accounts when we fetch our program accounts.

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

### 3. Update to `instruction.rs`

Recall that the `instruction.rs` file defines how we deserialize the instruction data for each instruction in our program. Let’s update `instruction.rs` to define how to deserialize the instruction data for our new `add_comment` instruction.

To begin, let’s update our `MovieInstruction` enum to include an `AddComment` variant.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    AddComment {
        comment: String
    }
}
```

Note that instruction data for creating a new comment differs from our previous instructions. We’ll also need to add a new payload struct for `AddComment`.

```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Next, let’s update how we unpack the instruction data. Here we’ve moved the deserialization of instruction data into the match statement using the associated payload struct for each instruction.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },

            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
```

### 4. Update to `processor.rs`

Recall that `processor.rs` defines the logic for how we process each instruction within our program. To enable commenting, we’ll update the `add_movie_review` function and then implement the `add_comment` function.

First, let’s bring into scope the new structs from `state.rs`.

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Next, in `process_instruction` let’s match our deserialized `AddComment` instruction data to the `add_comment` function we’ll be implementing shortly.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

Before we implement the `add_comment` function, let’s make our updates to the `add_movie_review` function.

To keep track of the total number of comments that exist for a review, we’ll create a separate account that act as a comment counter each time a review is created. We will derive the PDA for this account using the movie review address and the word “comment” as seeds.

Note that how we store the counter is simply a design choice. We could also add a “counter” field to the original movie review account.

Within the `add_movie_review` function, let’s add a `pda_counter` to represent the new counter account we’ll be initializing along with the movie review account. This means we now expect four accounts to be passed into the `add_movie_review` function through the `accounts` argument.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

For review accounts, we will use the word “review” as the discriminator. We’ll need to add the discriminator to the instruction and update how we calculate `total_len` to account for the length of the new discriminator field.

```rust
let review_discriminator = "review";
let total_len: usize = (4 + review_discriminator.len()) + 1 + 1 + (4 + title.len()) + (4 + description.len());
```

Once we’ve initialized the review account, we’ll also need to update the `account_data` with the fields we specified in the `MovieAccountState` struct.

```rust
account_data.discriminator = review_discriminator.to_string();
account_data.title = title;
account_data.reviewer = *initializer.key;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Next, let’s add the logic to initialize the counter account within the `add_movie_review` function. Add the following to the `add_movie_review` function.

```rust
msg!("create comment counter");
let counter_discriminator = "counter";
let counter_len: usize = (4 + counter_discriminator.len()) + 1 + 8;

let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(counter_len);

let (counter, counter_bump) = Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref(),], program_id);
if counter != *pda_counter.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}

invoke_signed(
    &system_instruction::create_account(
    initializer.key,
    pda_counter.key,
    counter_rent_lamports,
    counter_len.try_into().unwrap(),
    program_id,
    ),
    &[initializer.clone(), pda_counter.clone(), system_program.clone()],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("comment counter created");

let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("checking if counter account is already initialized");
if counter_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = counter_discriminator.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("comment count: {}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

Now when a new review is created, two accounts are initialized.

1. The first account stores the contents of the review just as before
2. The second account stores the counter for comments

Lastly, let’s implement our `add_comment` function to create new comment accounts.

When a new comment is created for a review, we will derive the PDA for the comment account using the review address and current count (stored in the counter account) as seeds. The count on the counter account will then increment by 1 every time a new comment is created.

Since the count updates every time a new comment is created, we can create an arbitrary number of comments for a review and easily fetch all the comments associated with any review. As long as we have the address of the review account, we can find the number of comments for the review. With the comment count, we can then loop through the count to derive and fetch all the comment accounts for a review.

Add the `add_comment` function to `processor.rs`.

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let comment_discriminator = "comment";
    let account_len: usize = (4 + comment_discriminator.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Created Comment Account");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("checking if comment account is already initialized");
    if comment_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    comment_data.discriminator = comment_discriminator.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Comment Count: {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```

### 5. Build and deploy

We're ready to build and deploy our program!

Build the updated program by running `cargo-build-bpf`. Then deploy the program by running the deploy command provided as the output of `cargo-build-bpf`.

You can test your program by submitting a transaction with the right instruction data. or that, feel free to use this [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments).

If you need more time with this project to feel comfortable with these concepts, have a look at the [solution code](https://beta.solpg.io/62d0c35cf6273245aca4f5f5) before continuing.

# Challenge

Now it’s your turn to build something independently. If you haven't been following along or haven't saved your work from before, feel free to use this [starter code](https://beta.solpg.io/62c9120df6273245aca4f5e8).

The Student Intro program is a Solana Program that lets students introduce themselves. The program takes a user's name and a short message as the instruction_data and creates an account to store the data on-chain.

Using the concepts and tools detailed in this lesson, apply what you've learned to the Student Intro Program.

1. Build and deploy the program locally
2. Add an instruction allowing other users to reply to an intro

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://beta.solpg.io/62cb5761f6273245aca4f5e9). Note that your code may look slightly different than the solution code.

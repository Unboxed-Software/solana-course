---
title: Create a Basic Program, Part 3 - Basic Security and Validation
objectives:
- Explain the importance of "thinking like an attacker"
- Understand basic security practices
- Perform owner checks
- Perform signer checks
- Validate accounts passed into the program
- Perform basic data validation
---

# Summary

- **Thinking like an attacker** means asking "How do I break this?"
- Perform **owner checks** to ensure that the provided account is owned by the public key you expect, e.g. ensuring that an account you expect to be a PDA is owned by `program_id`
- Perform **signer checks** to ensure that any account modification has been signed by the right party or parties
- **Account validation** entails ensuring that provided accounts are the accounts you expect them to be, e.g. deriving PDAs with the expected seeds to make sure the address matches the provided account
- **Data validation** entails ensuring that any provided data meets the criteria required by the program

# Lesson

In the last two lessons we worked through building a Movie Review program together. The end result is pretty cool! It's exciting to get something working in a new development environment.

Proper program development, however, doesn't end at "get it working." It's important to think through the possible failure points in your code to mitigate them. Failure points are where undesirable behavior in your code could potentially occur. Whether the undesirable behavior happens due to users interacting with your program in unexpected ways or bad actors intentionally trying to exploit your program, anticipating failure points is essential to secure program development.

Remember, **you have no control over the transactions that will be sent to your program once it’s deployed**. You can only control how your program handles them. While this lesson is far from a comprehensive overview of program security, we'll cover some of the basic pitfalls to look out for.

## Think like an attacker

[Neodyme](https://workshop.neodyme.io/) gave a presentation at Breakpoint 2021 entitled "Think Like An Attacker: Bringing Smart Contracts to Their Break(ing) Point." If there's one thing you take away from this lesson, it's that you should think like an attacker.

In this lesson, of course, we cannot cover everything that could possibly go wrong with your programs. Ultimately, every program will have different security risks associated with it. While understanding common pitfalls is *essential* to engineering good programs, it is *insufficient* for deploying secure ones. To have the broadest security coverage possible, you have to approach your code with the right mindset.

As Neodyme mentioned in their presentation, the right mindset requires moving from the question "Is this broken?" to "How do I break this?" This is the first and most essential step in understanding what your code *actually does* as opposed to what you wrote it to do.

### All programs can be broken

It's not a question of "if."

Rather, it's a question of "how much effort and dedication would it take."

Our job as developers is to close as many holes as possible and increase the effort and dedication required to break our code. For example, in the Movie Review program we built together over the last two lessons, we wrote code to create new accounts to store movie reviews. If we take a closer look at the code, however, we'll notice how the program also facilitates a lot of unintentional behavior we could easily catch by asking "How do I break this?" We'll dig into some of these problems and how to fix them in this lesson, but remember that memorizing a few pitfalls isn't sufficient. It's up to you to change your mindset toward security.

## Error handling

Before we dive into some of the common security pitfalls and how to avoid them, it's important to know how to use errors in your program. While your code can handle some issues gracefully, other issues will require that your program stop execution and return a program error.

### How to create errors

While the `solana_program` crate provides a `ProgramError` enum with a list of generic errors we can use, it will often be useful to create your own. Your custom errors will be able to provide more context and detail while you're debugging your code.

We can define our own errors by creating an enum type listing the errors we want to use. For example, the `NoteError` contains variants `Forbidden` and `InvalidLength`. The enum is made into a Rust `Error` type by using the `derive` attribute macro to implement the `Error` trait from the `thiserror` library. Each error type also has its own `#[error("...")]` notation. This lets you provide an error message for each particular error type.

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Error)]
pub enum NoteError {
    #[error("Wrong note owner")]
    Forbidden,

    #[error("Text is too long")]
    InvalidLength,
}
```

### How to return errors

The compiler expects errors returned by the program to be of type `ProgramError` from the `solana_program` crate. That means we won't be able to return our custom error unless we have a way to convert it into this type. The following implementation handles conversion between our custom error and the `ProgramError` type.

```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

To return the custom error from the program, simply use the `into()` method to convert the error into an instance of `ProgramError`.

```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## Basic security checks

While these won't comprehensively secure your program, there are a few security checks you can keep in mind to fill in some of the larger gaps in your code:

- Ownership checks - used to verify that an account is owned by the program
- Signer checks - used to verify that an account has signed a transaction
- General Account Validation - used to verify that an account is the expected account
- Data Validation - used to verify the inputs provided by a user

### Ownership checks

An ownership check verifies that an account is owned by the expected public key. Let's use the note-taking app example that we've referenced in previous lessons. In this app, users can create, update, and delete notes that are stored by the program in PDA accounts.

When a user invokes the `update` instruction, they also provide a `pda_account`. We presume the provided `pda_account` is for the particular note they want to update, but the user can input any instruction data they want. They could even potentially send data which matches the data format of a note account but was not also created by the note-taking program. This security vulnerability is one potential way to introduce malicious code.

The simplest way to avoid this problem is to always check that the owner of an account is the public key you expect it to be. In this case, we expect the note account to be a PDA account owned by the program itself. When this is not the case, we can report it as an error accordingly.

```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

As a side note, using PDAs whenever possible is more secure than trusting externally-owned accounts, even if they are owned by the transaction signer. The only accounts that the program has complete control over are PDA accounts, making them the most secure.

### Signer checks

A signer check simply verifies that the right parties have signed a transaction. In the note-taking app, for example, we would want to verify that the note creator signed the transaction before we process the `update` instruction. Otherwise, anyone can update another user's notes by simply passing in the user's public key as the initializer.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### General account validation

In addition to checking the signers and owners of accounts, it's important to ensure that the provided accounts are what your code expects them to be. For example, you would want to validate that a provided PDA account's address can be derived with the expected seeds. This ensures that it is the account you expect it to be.

In the note-taking app example, that would mean ensuring that you can derive a matching PDA using the note creator's public key and the ID as seeds (that's what we're assuming was used when creating the note). That way a user couldn't accidentally pass in a PDA account for the wrong note or, more importantly, that the user isn't passing in a PDA account that represents somebody else's note entirely.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Data validation

Similar to validating accounts, you should also validate any data provided by the client.

For example, you may have a game program where a user can allocate character attribute points to various categories. You may have a maximum limit in each category of 100, in which case you would want to verify that the existing allocation of points plus the new allocation doesn't exceed the maximum.

```rust
if character.agility + new_agility > 100 {
    msg!("Attribute points cannot exceed 100");
    return Err(AttributeError::TooHigh.into())
}
```

Or, the character may have an allowance of attribute points they can allocate and you want to make sure they don't exceed that allowance.

```rust
if attribute_allowance < new_agility {
    msg!("Trying to allocate more points than allowed");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

Without these checks, program behavior would differ from what you expect. In some cases, however, it's more than just an issue of undefined behavior. Sometimes failure to validate data can result in security loopholes that are financially devastating.

For example, imagine that the character referenced in these examples is an NFT. Further, imagine that the program allows the NFT to be staked to earn token rewards proportional to the NFTs number of attribute points. Failure to implement these data validation checks would allow a bad actor to assign an obscenely high number of attribute points and quickly drain your treasury of all the rewards that were meant to be spread more evenly amongst a larger pool of stakers.

### Integer overflow and underflow

Rust integers have fixed sizes. This means they can only support a specific range of numbers. An arithmetic operation that results in a higher or lower value than what is supported by the range will cause the resulting value to wrap around. For example, a `u8` only supports numbers 0-255, so the result of addition that would be 256 would actually be 0, 257 would be 1, etc.

This is always important to keep in mind, but especially so when dealing with any code that represents true value, such as depositing and withdrawing tokens.

To avoid integer overflow and underflow, either:

1. Have logic in place that ensures overflow or underflow *cannot* happen or
2. Use checked math like `checked_add` instead of `+`
    ```rust
    let first_int: u8 = 5;
    let second_int: u8 = 255;
    let sum = first_int.checked_add(second_int);
    ```

# Lab

Let’s practice together with the Movie Review program we've worked on in previous lessons. No worries if you’re just jumping into this lesson without having done the previous lesson - it should be possible to follow along either way.

As a refresher, the Movie Review program lets users store movie reviews in PDA accounts. Last lesson, we finished implementing the basic functionality of adding a movie review. Now, we'll add some security checks to the functionality we've already created and add the ability to update a movie review in a secure manner.

Just as before, we'll be using [Solana Playground](https://beta.solpg.io/) to write, build, and deploy our code.

## 1. Get the starter code

To begin, you can find [the movie review starter code](https://beta.solpg.io/62b552f3f6273245aca4f5c9). If you've been following along with the Movie Review labs, you'll notice that we've refactored our program.

The refactored starter code is almost the same as what it was before. Since `lib.rs` was getting rather large and unwieldy, we've separated its code into 3 files: `lib.rs`, `entrypoint.rs`, and `processor.rs`. `lib.rs` now *only* registers the code's modules, `entrypoint.rs` *only* defines and sets the program's entrypoint, and `processor.rs` handles the program logic for processing instructions. We've also added an `error.rs` file where we'll be defining custom errors. The complete file structure is as follows:

- **lib.rs** - register modules
- **entrypoint.rs -** entry point to the program
- **instruction.rs -** serialize and deserialize instruction data
- **processor.rs -** program logic to process instructions
- **state.rs -** serialize and deserialize state
- **error.rs -** custom program errors

In addition to some changes to file structure, we've updated a small amount of code that will let this lab be more focused on security without having you write unnecessary boiler plate.

Since we'll be allowing updates to movie reviews, we also changed `account_len` in the `add_movie_review` function (now in `processor.rs`). Instead of calculating the size of the review and setting the account length to only as large as it needs to be, we're simply going to allocate 1000 bytes to each review account. This way, we don’t have to worry about reallocating size or re-calculating rent when a user updates their movie review.

We went from this:
```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

To this:
```rust
let account_len: usize = 1000;
```

The [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) method was just recently enabled by Solana Labs which allows you to dynamically change the size of your accounts. We will not be using this method for this lab, but it’s something to be aware of.

Finally, we've also implemented some additional functionality for our `MovieAccountState` struct in `state.rs` using the `impl` keyword.

For our movie reviews, we want the ability to check whether an account has already been initialized. To do this, we create an `is_initialized` function that checks the `is_initialized` field on the `MovieAccountState` struct.

`Sealed` is Solana's version of Rust's `Sized` trait. This simply specifies that `MovieAccountState` has a known size and provides for some compiler optimizations.

```rust
// inside state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Before moving on, make sure you have a solid grasp on the current state of the program. Look through the code and spend some time thinking through any spots that are confusing to you. It may be helpful to compare the starter code to the [solution code from the previous lesson](https://beta.solpg.io/62b23597f6273245aca4f5b4).

## 2. Custom Errors

Let's begin by writing our custom program errors. We'll need errors that we can use in the following situations:

- The update instruction has been invoked on an account that hasn't been initialized yet
- The provided PDA doesn't match the expected or derived PDA
- The input data is larger than the program allows
- The rating provided does not fall in the 1-5 range

The starter code includes an empty `error.rs` file. Open that file and add errors for each of the above cases.

```rust
// inside error.rs
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReviewError{
    // Error 0
    #[error("Account not initialized yet")]
    UninitializedAccount,
    // Error 1
    #[error("PDA derived does not equal PDA passed in")]
    InvalidPDA,
    // Error 2
    #[error("Input data exceeds max length")]
    InvalidDataLength,
    // Error 3
    #[error("Rating greater than 5 or less than 1")]
    InvalidRating,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Note that in addition to adding the error cases, we also added the implementation that lets us convert our error into a `ProgramError` type as needed.

Before moving on, let’s bring `ReviewError` into scope in the `processor.rs`. We will be using these errors shortly when we add our security checks.

```rust
// inside processor.rs
use crate::error::ReviewError;
```

## 3. Add security checks to `add_movie_review`

Now that we have errors to use, let's implement some security checks to our `add_movie_review` function.

### Signer check

The first thing we should do is ensure that the `initializer` of a review is also a signer on the transaction. This ensures that you can't submit movie reviews impersonating somebody else. We'll put this check right after iterating through the accounts.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;

if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Account validation

Next, let's make sure the `pda_account` passed in by the user is the `pda` we expect. Recall we derived the `pda` for a movie review using the `initializer` and `title` as seeds. Within our instruction we’ll derive the `pda` again and then check if it matches the `pda_account`. If the addresses do not match, we’ll return our custom `InvalidPDA` error.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Data validation

Now let's perform some data validation.

We'll start by making sure `rating` falls within the 1 to 5 scale. If the rating provided by the user outside of this range, we’ll return our custom `InvalidRating` error.

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}
```

Next, let’s check that the content of the review does not exceed the 1000 bytes we’ve allocated for the account. If the size exceeds 1000 bytes, we’ll return our custom `InvalidDataLength` error.

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Lastly, let's checking if the account has already been initialized by calling the `is_initialized` function we implemented for our `MovieAccountState`. If the account already exists, then we will return an error.

```rust
if account_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

All together, the `add_movie_review` function should look something like this:

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument)
    }

    if rating > 5 || rating < 1 {
        msg!("Rating cannot be higher than 5");
        return Err(ReviewError::InvalidRating.into())
    }

    let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    if total_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    invoke_signed(
        &system_instruction::create_account(
        initializer.key,
        pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[initializer.clone(), pda_account.clone(), system_program.clone()],
        &[&[initializer.key.as_ref(), title.as_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("PDA created: {}", pda);

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("borrowed account data");

    msg!("checking if movie account is already initialized");
    if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.title = title;
    account_data.rating = rating;
    account_data.description = description;
    account_data.is_initialized = true;

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 4. Support movie review updates in `MovieInstruction`

Now that `add_movie_review` is more secure, let's turn our attention to supporting the ability to update a movie review.

Let’s begin by updating `instruction.rs`. We’ll start by adding an `UpdateMovieReview` variant to `MovieInstruction` that includes embedded data for the new title, rating, and description.

```rust
// inside instruction.rs
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
    }
}
```

The payload struct can stay the same since aside from the variant type, the instruction data is the same as what we used for `AddMovieReview`.

Lastly, in the `unpack` function we need to add `UpdateMovieReview` to the match statement.

```rust
// inside instruction.rs
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            1 => Self::UpdateMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## 5. Define `update_movie_review` function

Now that we can unpack our `instruction_data` and determine which instruction of the program to run, we can add `UpdateMovieReview` to the match statement in the `process_instruction` function in the `processor.rs` file.

```rust
// inside processor.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // unpack instruction data
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        // add UpdateMovieReview to match against our new data structure
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            // make call to update function that we'll define next
            update_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Next, we can define the new `update_movie_review` function. The definition should have the same parameters as the definition of `add_movie_review`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

}
```

## 6. Implement `update_movie_review` function

All that's left now is to fill in the logic for updating a movie review. Only let's make it secure from the start.

Just like the `add_movie_review` function, let's start by iterating through the accounts. The only accounts we'll need are the first two: `initializer` and `pda_account`.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    // Get Account iterator
    let account_info_iter = &mut accounts.iter();

    // Get accounts
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

}
```

### Ownership Check

Before we continue, let's implement some basic security checks. We'll start with an ownership check on for `pda_account` to verify that it is owned by our program. If it isn't, we'll return an `InvalidOwner` error.

```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### Signer Check

Next, let’s perform a signer check to verify that the `initializer` of the update instruction has also signed the transaction. Since we are updating the data for a movie review, we want to ensure that the original `initializer` of the review has approved the changes by signing the transaction. If the `initializer` did not sign the transaction, we’ll return an error.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Account Validation

Next, let’s check that the `pda_account` passed in by the user is the PDA we expect by deriving the PDA using `initializer` and `title` as seeds. If the addresses do not match, we’ll return our custom `InvalidPDA` error. We'll implement this the same way we did in the `add_movie_review` function.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Unpack `pda_account` and perform data validation

Now that our code ensures we can trust the passed in accounts, let's unpack the `pda_account` and perform some data validation. We'll start by unpacking `pda_account` and assigning it to a mutable variable `account_data`.

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");
```

Now that we have access to the account and its fields, the first thing we need to do is verify that the account has already been initialized. An uninitialized account can't be updated so the program should return our custom `UninitializedAccount` error.

```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ReviewError::UninitializedAccount.into());
}
```

Next, we need to validate the `rating`, `title`, and `description` data just like in the `add_movie_review` function. We want to limit the `rating` to a scale of 1 to 5 and limit the overall size of the review to be fewer than 1000 bytes. If the rating provided by the user outside of this range, then we’ll return our custom `InvalidRating` error. If the review is too long, then we'll return our custom `InvalidDataLength` error.

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}

let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### Update the movie review account

Now that we've implemented all of the security checks, we can finally update the movie review account by updating `account_data` and re-serializing it. At that point, we can return `Ok` from our program.

```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

All together, the `update_movie_review` function should look something like the code snippet below. We've included some additional logging for clarity in debugging.

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("review title: {}", account_data.title);

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    msg!("checking if movie account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(ReviewError::UninitializedAccount.into());
    }

    if rating > 5 || rating < 1 {
        msg!("Invalid Rating");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len()) + account_data.title.len();
    if update_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    msg!("Review before update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    account_data.rating = rating;
    account_data.description = description;

    msg!("Review after update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 7. Build and upgrade

We're ready to build and upgrade our program! You can test your program by submitting a transaction with the right instruction data. For that, feel free to use this [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews).  Remember, to make sure you're testing the right program you'll need to replace `MOVIE_REVIEW_PROGRAM_ID` with your program ID in `Form.tsx` and `MovieCoordinator.ts`.

If you need more time with this project to feel comfortable with these concepts, have a look at the [solution code](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7) before continuing.

# Challenge

Now it’s your turn to build something independently by building on top of the Student Intro program that you've used in previous lessons. If you haven't been following along or haven't saved your code from before, feel free to use [this starter code](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).

The Student Intro program is a Solana Program that lets students introduce themselves. The program takes a user's name and a short message as the instruction_data and creates an account to store the data onchain.

Using what you've learned in this lesson, try applying what you've learned to the Student Intro Program. The program should:

1. Add an instruction allowing students to update their message
2. Implement the basic security checks we've learned in this lesson

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://beta.solpg.io/62c9120df6273245aca4f5e8). Note that your code may look slightly different than the solution code depending on the checks you implement and the errors you write. Once you complete Module 3, we'd love to know more about your experience! Feel free to [share some quick feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203), so that we can continue to improve the course.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=3dfb98cc-7ba9-463d-8065-7bdb1c841d43)!
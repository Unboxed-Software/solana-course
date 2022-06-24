# Create a Basic Program, Part 3 - Basic Security and Validation

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Explain the importance of "thinking like an attacker"
- Understand basic security practices
- Perform owner checks
- Perform signer checks
- Validate accounts passed in the program
- Perform basic data validation

# TL;DR

- **Thinking like an attacker** means asking "How do I break this?"
- Perform **owner checks** to ensure that the provided account is owned by the public key you expect, e.g. ensuring that an account you expect to be a PDA is owned by `program_id`
- Perform **signer checks** to ensure that any account modification has been signed by the right party or parties
- **Account validation** entails ensuring that provided accounts are the accounts you expect them to be, e.g. rederiving PDAs with the expected seeds to make sure the address matches the provided account
- **Data validation** entails ensuring that any provided data meets the criteria required by the program

# Overview

In the last two lessons we worked through building a Movie Review program together. The end result is pretty cool! It's exciting to get something working in a new development environment.

But proper program development doesn't end at "get it working." It's important to think through the various failure points in your code and try to mitigate them. Failure points are where undesirable behavior in your code could potentially occur, whether due to users interacting with your program in unexpected ways or bad actors intentionally trying to exploit your program.

Remember, **you have no control over the transactions that will be sent to your program once it’s deployed**. You can only control how your program handles them. While this lesson is far from a comprehensive overview of program security, we'll cover some of the basic pitfalls you should look out for.

## Think like an attacker

[Neodyme](https://workshop.neodyme.io/) gave a presentation at Breakpoint 2021 entitled "Think Like An Attacker: Bringing Smart Contracts to Their Break(ing) Point." If there's one thing you take away from this lesson, it's that you should think like an attacker.

As mentioned previously, we cannot cover everything that could possibly go wrong with your programs. Ultimately, every program is different and will have different security risks associated with it. Understanding common pitfalls is *essential but insufficient*. In order to have the broadest security coverage possible, you have to approach your code with the right mindset.

As Neodyme mentioned in their presentation, the right mindset requires moving from the question "Is this broken?" to "How do I break this?" This is the first and most essential step in understanding what your code *actually does* as opposed to what you wrote it to do. *All programs can be broken* - it's not a question of "if." Rather, it's a question of "how much effort and dedication would it take." Our job as developers is to close as many holes as possible and increase the effort and dedication required to break our code.

For example, in the Movie Review program we built together over the last two lessons, we wrote code to create new accounts to store movie reviews. However, if we take a closer look at the code, we'll notice that the program also facilitates a lot of unintentional behavior that we could easily catch by asking "How do I break this?" We'll dig into some of these problems and how to fix them in this lesson, but remember that memorizing a few pitfalls isn't sufficient. It's up to you to change your mindset toward security.

## Error handling

Before we dive into some of the common security pitfalls and how to avoid them, it's important to know how to use errors in your program. While your code can handle some issues gracefully, other issues will require that your program stop execution and return a program error.

### How to create errors

The `solana_program` crate includes a `ProgramError` enum with a list of generic errors that we can use, but it's often useful to create your own to provide more context about the error when debugging.

We can define our own errors by creating an enum type that lists the errors we want to use. For example, the `NoteError` contains variants `Forbidden` and `InvalidLength`. The enum is made into a Rust `Error` type by using the `derive` attribute macro to implement the `Error` trait from the `thiserror` library. Each error type also has its own #[error(…)] error notation. This lets you provide an error message for each particular error type.

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

- Ownership checks - used to verify if an account is owned by the program
- Signer checks - used to verify that account has signed a transaction
- General Account Validation - used to verify an account is the expected account
- Data Validation - used to verify the inputs provided by a user

### Ownership checks

An ownership check verifies that an account is owned by the expeced public key. Let's use the note-taking app example that we've referenced in previous lessons. In this app, users can create, update, and delete notes that are stored by the program in PDA accounts.

If a user were to invoke the `update` instruction, they would need supply the `pda_account` for the movie review they want to update. Since the user can input any instruction data they want, they could provide an account whose data matches the data format of a note account but was not created by the note-taking program. This account could potentially contain malicious data and so should not be trusted.

The simplest way to avoid this problem is to always check that the owner of an account is the public key you expect it to be. In this case, we expect the note account to be a PDA account owned by the program itself.

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

In addition to checking the signers and owners of accounts, it's important to ensure that the provided accounts are what your code expects them to be. For example, you would want to validate that a provided PDA account's address can be rederived with the expected seeds. This ensures that it is the account you expect it to be.

In the note-taking app example, that would mean ensuring that you can rederive a matching PDA using the `initializer` and `title` as seeds (that's what we're assuming was used when creating the note). That way a user couldn't accidentally pass in a PDA account for wrong note or, more importantly, that the user isn't passing in a PDA account that represents somebody else's note entirely.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Data validation

Similar to validating accounts, you should also validate other data provided by the client. For example, you may have a game program where a user can allocate character attribute points to various categories. You may have a maximum limit in each category of 100, in which case you would want to verify that the existing allocation of points plus the new allocation doesn't exceed the maximum.

```rust
if character.agility + new_agility > 100 {
    msg!("Attribute points cannot exceed 100");
    return Err(AttributeError::TooHigh.into())
}
```

Or the character may have an allowance of attribute points they can allocate and you want to make sure they don't exceed that allowance.

```rust
if attribute_allowance > new_agility {
	msg!("Trying to allocate more points than allowed");
	return Err(AttributeError::ExceedsAllowance.into())
}
```

Without these checks, program behavior would differ from what you expect. In some cases, however, it's more than just an issue of undefined behavior. Sometimes failure to validate data can result in security loopholes that are financially devestating. 

For example, imagine that the character referenced in these examples is an NFT. Further, imagine that the program allows the NFT to be staked to earn token rewards proportional to the NFTs number of attribute points. Failure to implement these data validation checks would allow a bad actor to assign an obscenely high number of attribute points and quickly drain your treasury of all the rewards that were meant to be spread more evenly amongst a larger pool of stakers.

### Integer overflow and underflow

Rust integers have fixed sizes. This means they can only support a specific range of numbers. An arithmetic operation that results in a higher or lower value than what is supported by the range will cause the resulting value to wrap around. For example, a `u8` only supports numbers 0-255, so the result of addition that would be 256 would actually be 0, 257 would be 1, etc.

This is always important to keep in mind, but especially so when dealing with any code that represents true value: depositing and withdrawing tokens, for example.

To avoid integer overflow and underflow, either:
1. Have logic in place that ensures overflow or underflow *cannot* happen or
2. Use checked math like `checked_add` instead of `+`

# Demo

Let’s practice together by continuing to work on the Movie Review program from the last lesson. No worries if you’re just jumping into this lesson without having done the previous lesson - it should be possible to follow along either way. We'll be using the [Solana Playground](https://beta.solpg.io/) to write, build, and deploy our code.

As a refresher, we are building a Solana program which lets users review movies. Last lesson, we learned how to create a new account using a PDA and serialize data to the account. Let’s now modify our program to include an update instruction and apply what we’ve learned by adding some security checks.

## 1. Get the starter code

If you didn’t complete the demo from the last lesson or just want to make sure that you didn’t miss anything, you can reference the starter code [here](https://beta.solpg.io/62b23597f6273245aca4f5b4).

## 2. Refactor Program

To get started, we are going to refactor our program to a common file structure used with Solana programs.

- **lib.rs** - register modules
- **entrypoint.rs -** entry point to the program
- **instruction.rs -** serialize and deserialize instruction data
- **processor.rs -** program logic to process instructions
- **state.rs -** serialize and deserialize state
- **error.rs -** custom program errors

First, we will separate the content of lib.rs into two files called processor.rs and entrypoint.rs.

Let’s create a new file called entrypoint.rs and move our entry point logic from lib.rs to over to the new file. It will look slightly different because we’ll be making a call to a function inside processor.rs, but the essence of the code is the same as before.

```rust
// inside entrypoint.rs
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    entrypoint
};
// bring processor file into scope
use crate::processor;

// define entrypoint
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
		// log info about input data
    msg!(
        "process_instruction: {}: {} accounts, data={:?}",
        program_id,
        accounts.len(),
        instruction_data
    );
		// call process_instruction inside processor.rs and pass input params
    processor::process_instruction(program_id, accounts, instruction_data)?;

    Ok(())
}
```

Next, we’ll need to create a new file called processor.rs and essentially copy the crates, `process_instruction`, and `add_movie_review` function from lib.rs to the new processor file.

We will make a small change to `account_len` within the `add_movie_review` function. Instead of calculating the space for each new account, we’re simply going to allocate 1000 bytes for all accounts. Every account can then store up 1000 bytes, which will be the maximum amount of space allowed. This way, we don’t have to worry about re-calculating rent when a user updates their movie review.

The [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) method was just recently enabled by Solana Labs which allows you to dynamically change the size of your accounts. We will not be using this method for this demo, but it’s something to be aware of.

```rust
// From this
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

```rust
// To this
let account_len: usize = 1000;
```

Go ahead and update the processor.rs file with the content below.

```rust
// inside processor.rs
use solana_program::{
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::{next_account_info, AccountInfo},
    system_instruction,
    program_error::ProgramError,
    sysvar::{rent::Rent, Sysvar},
    program::{invoke_signed},
    borsh::try_from_slice_unchecked,
    program_pack::{IsInitialized},
};
use std::convert::TryInto;
use crate::instruction::MovieInstruction;
use crate::state::MovieAccountState;
use borsh::BorshSerialize;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
  ) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
      MovieInstruction::AddMovieReview { title, rating, description } => {
        add_movie_review(program_id, accounts, title, rating, description)
      }
    }
  }

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

    // Get Account iterator
    let account_info_iter = &mut accounts.iter();

    // Get accounts
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // Derive PDA and check that it matches client
    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);

    // Allocate account size
    let account_len: 1000;

    // Calculate rent required
    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    // Create the account
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

Okay, quick recap - we have not really done anything new yet, just moved some code around. So far we’ve moved the entry point logic to the new entrypoint.rs file and moved the program logic to processor.rs. Now that everything is copied over, we can safely delete everything from the lib.rs file and register all of our files like so:

```rust
// inside lib.rs
pub mod entrypoint;
pub mod instruction;
pub mod processor;
pub mod state;
// haven't created the error.rs file yet, but we'll register it now so we don't forget
pub mod error;
```

## 4. Implement Struct Functionality

Now let's implement some additional functionality for our `MovieAccountState` struct in state.rs using the `impl` keyword.

1. `Sealed` is Solana's version of Rust's `Sized` trait. This simply specifies that `MovieAccountState` has a known size.
2. `IsInitialized` checks the `is_initialized` field of our `MovieAccountState` struct.

For our movie reviews, we want the ability to check whether an account has already been initialized. To do this, we create an `is_initialized` function that checks the `is_initialized` field on the `MovieAccountState` struct. This prevents duplicate reviews of the same movie by the same user.

Note that `fn is_initialized` is the function we call and takes in `self` as a parameter (which is the `MovieAccountState` struct), and `self.is_initialized` is referring to the `is_initialized` field on the `MovieAccountState` struct.

```rust
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

All together, our `state.rs` file looks like this:

```rust
use borsh::{BorshSerialize, BorshDeserialize};
use solana_program::{
    program_pack::{IsInitialized, Sealed},
};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub description: String,
    pub title: String
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

## 5. Create New Update Instruction

### Changes to instruction.rs

Now that we have our program files set up we can start implementing our new logic! Let’s begin by updating instruction.rs. We’ll start with defining the data struct we want to unpack the `instruction_data` into. Considering our new functionality is to just update an existing review, it makes sense to expect the same instruction data as before, so all we have to do is define this data struct in the `MovieInstruction` enum inside instruction.rs.

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

The payload struct can stay the same, but now we just need to add `UpdateMovieReview` inside the match statement of the `unpack` function for this new data struct so we know which function an instruction is targeting.

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

### Changes to processor.rs

Now that we can unpack our `instruction_data` and determine which instruction of the program to run, we can add `UpdateMovieReview` to the match statement in the `process_instruction` function in the processor.rs file.

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

Next, we can define the new `update_movie_review` function which will have some similarities to the `add_movie_review` function. First, we’ll grab the `AccountInfo` structs passed in the accounts parameter. There are only two accounts required for this instruction, the `initializer` and the `pda_account` of the review we want to update. After getting the `AccountInfo` structs, we can deserialize the data stored on the `pda_account` because it should already be initialized. We’ll also include some messages to display in the program logs.

```rust
pub fn update_movie_review(program_id: &Pubkey,
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

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("borrowed account data");

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

## 6. Custom Errors

Now that we’ve implemented our update instruction, let’s create a new file called error.rs and add the following custom errors. We will be using these errors shortly when we add our security checks.

```rust
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

Next, let’s bring `ReviewError` into the scope of processor.rs.

```rust
// inside processor.rs
use crate::error::ReviewError;
```

## 7. Security Checks

We are now ready to apply some basic security checks to our instructions. Let’s first go over each check individually, and then make the changes to the processor.rs file all at once. All checks will apply to both `add_movie_review` and `update_movie_review` unless noted otherwise.

### Ownership Check

Let’s begin by performing an ownership check to verify that the `pda_account` passed in by the user is owned by our program. We do this by checking that the owner field on the `pda_account` matches the program ID of our movie review program and returning an error if it does not match.

This check will only apply to `update_movie_review`. In `add_movie_review` we are initializing the account for the first time and the `pda_account` owner will be set as our program.

```rust
if pda_account.owner != program_id {
      return Err(ProgramError::InvalidOwner)
    }
```

### Signer Check

Next, let’s perform a signer check to verify that the `initializer` of the update instruction has also signed the transaction. Since we are updating the data for a movie review, we want to ensure that the original `initializer` of the review has approved the changes by signing the transaction. If the `initializer` did not sign the transaction, we’ll return an error.

This check will also only apply to `update_movie_review`.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Account Validation

Next, let’s check that the `pda_account` passed in by the user is the `pda` we expect. Recall we derived the `pda` for a movie review using the `initializer` and `title` as seeds. Within our instruction we’ll derive the `pda` again and then check if it matches the `pda_account`. If the addresses do not match, we’ll return our custom `InvalidPDA` error.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Data Validation

Let’s now perform some data validation checks. We’ll begin with checking if the account has already been initialized by calling the `is_initialized` function we implemented for our `MovieAccountState`. This check will be slightly different between `add_movie_review` and `update_movie_review`.

In the `add_movie_review` function, we want to check if the account has already been initialized since we are creating the account for the first time. If the account already exists, then we will return an error.

```rust
if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }
```

In the `update_movie_review`function, we want to check if the account has **not** been initialized since we want updating an existing account. If the account does not already exists, then we will return our custom `UninitializedAccount` error.

```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ReviewError::UninitializedAccount.into());
}
```

Next, let’s check the input for rating since we want to limit the ratings to a scale of 1 to 5. If the rating provided by the user outside of this range, we’ll return our custom `InvalidRating` error.

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}
```

Lastly, let’s check that the content of the review does not exceed the space total space we’ve allocated for the account. We’ll perform this check by verifying that the total size of the review does not exceed the 1000 bytes we allocate for the account. If the size exceeds 1000 bytes, we’ll return our custom `InvalidDataLength` error.

Note that there is a minor difference in how we calculate `total_len` between the `add_movie_review` and `update_movie_review` functions. In `add_movie_review` we are creating the account for the first time, so we can just use `title.len()`. However, in `update_movie_review` we want to use the title that already exists on the account, so we use `account_data.title.len()`.

Calculation for `total_len` in `add_movie_review`:

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len())
```

Calculate for `total_len` in `update_movie_review`:

```rust
let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
```

The data validation check for both functions will be the same.

```rust
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

## 8. Implement Security Checks

Let’s now add the security checks we just went over to the `add_movie_review` and `update_movie_review` functions.

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

And the `update_movie_review` function should look something like this:

```rust
pub fn update_movie_review(program_id: &Pubkey,
accounts: &[AccountInfo],
title: String,
rating: u8,
description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("review title: {}", account_data.title);

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

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

You are now ready to build and upgrade your program just as before. You can test your program by submitting a transaction with the right instruction data. For that, feel free to use this [frontend](https://github.com/ZYJLiu/solana-movie-frontend). Remember to replace `MOVIE_REVIEW_PROGRAM_ID` with your program ID in `Form.tsx` and `MovieCoordinator.ts` to make sure you're testing the right program.

If you need more time with this project to feel comfortable with these concepts, have a look at the [solution code](https://beta.solpg.io/62b41889f6273245aca4f5c3) before continuing.

# Challenge

Now it’s your turn to build something independently.

The Student Intro program is a Solana Program that lets students introduce themselves. The program takes a user's name and a short message as the instruction_data and creates an account to store the data on-chain.

Using what you've learned in this lesson, try applying what you've learned to the Student Intro Program. The program should:

1. Add an instruction allowing students to update their message
2. Implement the basic security checks we've learned in this lesson

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://beta.solpg.io/62b419c0f6273245aca4f5c4). Note that your code will likely look different depending on the checks you implement and the errors you write.

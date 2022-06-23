# Create a Basic Program, Part 3 - Basic Security and Validation

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Explain the importance of "thinking like an attacker"
- Understand basic security practices
- Perform signer checks
- Perform basic data validation
- Validate `instruction_data` passed in the program
- Validate accounts passed in the program

# TL;DR

- The last two lessons showed you how the movie review program was created, this lesson will be focused on building on top of that and adding functionality to allow users to update their reviews.
- We’ll also be covering some common security pitfalls in Solana smart contracts and how to avoid them.

# Overview

In the last two lessons we worked through building a Movie Review program together. The end result is pretty cool! It's exciting to get something working in a new development environment.

But proper program development doesn't end at "get it working." It's important to think through the various failure points in your code and try to mitigate them. Failure points are where undesirable behavior in your code could potentially occur, whether due to users interacting with your program in unexpected ways or bad actors intentionally trying to exploit your program.

Remember, **you have no control over the transactions that will be sent to your program once it’s deployed**. You can only control how your program handles them. While this lesson is far from a comprehensive overview of program security, we'll cover some of the basic pitfalls you should look out for.

## Think like an attacker

[Neodyme](https://workshop.neodyme.io/) gave a presentation at Breakpoint 2021 entitled "Think Like An Attacker: Bringing Smart Contracts to Their Break(ing) Point." If there's one thing you take away from this lesson, it's that you should think like an attacker.

As mentioned previously, we cannot cover everything that could possibly go wrong with your programs. Ultimately, every program is different and will have different security risks associated with it. Understanding common pitfalls is _essential but insufficient_. In order to have the broadest security coverage possible, you have to approach your code with the right mindset.

As Neodyme mentioned in their presentation, the right mindset requires moving from the question "Is this broken?" to "How do I break this?" This is the first and most essential step in understanding what your code _actually does_ as opposed to what you wrote it to do. _All programs can be broken_ - it's not a question of "if." Rather, it's a question of "how much dedication would it take." Our job as developers is to close as many holes as possible and increase the effort and dedication required to break our code.

For example, in the Movie Review program we built together over the last two lessons, we wrote code to create new accounts to store movie reviews. However, if we take a closer look at the code, we'll notice that the program also facilitates a lot of unintentional behavior that we could easily catch by asking "How do I break this?" We'll dig into some of these problems in this lesson, but remember that it's up to you to change your mindset toward security.

## Error handling

Before we dive into security checks, it's important to know how use errors in your program. While your code can handle some issues gracefully, other issues will require that your program stop execution and return a program error.

### How to Create Errors

The `solana_program` crate includes a `ProgramError` enum with a list of generic errors that we can use, but sometimes it’s helpful to create your own to provide more context about the error when debugging.

The CustomerError enum below is declared with the #[derive(Error)] notation which is the derive macro for the `thiserror` library. Each error type also has its own #[error(…)] error notation, which is the error message associated with this particular error type.

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

pub enum CustomError{
    #[error("First Error Message Here")]
    FirstErrorMessageName,

    #[error("Second Error Message Here")]
    SecondErrorMessageName,
}
```

There is one extra step, the compiler will not accept these error types as is because it expects only `ProgramError` types from the `solana_program` crate. We must implement a way to turn these custom errors into a `ProgramError`.

```rust
impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

### How to Return Errors

To use our custom errors within a module, we must first bring the `CustomError` enum into the scope.

```rust
use crate::error::CustomError;

```

Now, you can return these errors like you would any ProgramError by calling the `into()` method to convert our `CustomError` into a `ProgramError`.

```rust
if <CHECK_LOGIC> {
        return Err(CustomError::FirstErrorMessageName.into());
    }
```

## Basic security checks

### Ownership checks

An ownership check verify that an account is owned by a specified program. As an example, imagine a note-taking app where users can create, update, and delete notes stored by the program in PDA accounts.

If the user invoked the `update` instruction, they would supply the `pda_account` for the movie review they want to update. Since the user can input any instruction data they want, they could provide an account whose data matches the data format of a note account but was not created by the note-taking program. This account could potentially contain malicious data and so should not be trusted.

The simplest way to avoid this problem is to always check that the owner of an account is owned by the program.

```rust
if note_pda.owner != program_id {
  return Err(ProgramError::InvalidNoteAccount);
}
```

### Signer checks

An signer check verifies that an account expected as a signer has actually signed a transaction. For example, lets consider the update instruction for our note-taking app. We would want to verify that the initializer signed the transaction before processing the update instruction. Otherwise, anyone can update another user's notes by simply passing in the user's publickey as the initializer.

```rust
if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }
```

### General account validation

An account validation check verifies that an account passed in by the client matches the one we expect. In our note-taking app, we want to check that the `note_pda` account passed in by the client is the account for the note created by the `initializer` with the specified `title`. A user could unintentionally pass in the pda for another note they've created and the program would continue to process the instruction. For example, the user could pass in a valid pda owned by the program and have signed the transaction, but the pda is for a note other than the one with the specified `title`.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## Data Validation

There are situations where we should also check the data inputs provided by the client. For example, image a rating is passed in by the user through the `instruction_data`. If we want the limit the rating to a maximum of 5, then we would need to include a data validation check. Otherwise, a user could provide an arbitrary value for the rating and the program would continue to process the instruction.

```rust
if rating > 5 {
    msg!("Rating cannot be higher than 5");
    return Err(CustomError::RatingTooHigh.into())
}
```

Similarly, image we stored an `is_initialized` field on an account then we would want to check whether the account has already been initialized. Note that this specific example is simply to help with debugging as the program would throw an error even without this check if we tried to initialize an account that already existed.

```rust
if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }
```

# Demo

Let’s practice together by continuing to work on the Movie Review program from the last lesson. No worries if you’re just jumping into this lesson without having done the previous lesson - it should be possible to follow along either way. We'll be using the [Solana Playground](https://beta.solpg.io/) to write, build, and deploy our code.

As a refresher, we are building a Solana program which lets users review movies. Last lesson, we learned how to create a new account using a PDA and serialize data to the account. Let’s now update our program to include an update instruction and apply what we’ve learned by adding some security checks.

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

We are make a small change to `account_len` within the `add_movie_review` function. Instead of calculating the space for each new account, we’re just simply going to allocate 1000 bytes for all accounts. That way, every account can be updated to store up 1000 bytes, which will be the maximum amount of space allowed and we don’t have to worry about re-calculating rent.

The [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) method was just recently enabled by Solana Labs which allows you to dynamically change the size of your accounts. We will not be using this method for this demo, but it’s something to be aware of.

We are simply updating `account_len`:

```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

```rust
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

Okay, quick recap - we have not really done anything new yet, just moved some code around. So far we’ve moved the entry point logic to the new entrypoint.rs file and moved the program logic to processor.rs. Now that everything is copied over, you can safely delete everything from the lib.rs file and register all of our files like so:

```rust
// inside lib.rs
pub mod entrypoint;
pub mod instruction;
pub mod processor;
pub mod state;
// haven't created the error.rs file yet, but we'll register it now so we don't forget
pub mod error;
```

## 4. Create New Update Instruction

### Changes to Instruction.rs

Now that we have our program files set up we can start implementing our new logic! Let’s begin by updating instruction.rs. We’ll start with defining the data struct we want to unpack the `instruction_data` into. Considering our new functionality is to just update an existing review, it makes sense to expect the same instruction data as before, so all we have to do is define this data struct in the `MovieInstruction` enum inside instruction.rs

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

### Updates to Processor.rs

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

## 5. Custom Errors

Now that we’ve implemented our update instruction, let’s create a new file called error.rs and add the following custom errors. We will be using these shortly when we add our security checks.

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

## 5. Security Checks

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

Next, let’s perform a signer check to verify that the `initializer` of the update instruction has also signed the transaction. Since we are updating the data for a movie review, we want to ensure that the original `initializer` of the review has approved the the changes by signing the transaction. If the `initializer` did not sign the transaction, we’ll return an error.

This check will also only apply to `update_movie_review`.

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### Account Validation

Next, let’s check that the `pda_account` passed in by the user is the `pda` we expect. Recall we derived the `pda` for a movie review uses the `initializer` and `title` as seeds. Within our instruction we’ll derive the `pda` again and then check if it matches the `pda_account`. If the addresses do not match, we’ll return our custom `InvalidPDA` error.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### Data Validation

Let’s now perform some data validation checks. We’ll begin by checking whether the account has already been initialized by calling the `is_initialized` function we implemented for our `MovieAccountState`. This check will be slightly different between `add_movie_review` and `update_movie_review`.

Within the `add_movie_review` function, we want to check if the account has already been initialized since we are creating the account for the first time. If the account already exists, then we will return an error.

```rust
if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }
```

Within the `update_movie_review`function, we want to check if the account has not been initialized since we want updating an existing account. If the account does not already exists, then we will return our custom `UninitializedAccount` error.

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
    return Err(ReviewError::RatingTooHigh.into())
}
```

Lastly, let’s check that the content of the review does not exceed the space total space we’ve allocated for the account on initialization. We’ll perform this check by verifying that the total size of the review does not exceed the 1000 bytes we allocate for the account. If the size exceeds 1000 bytes, we’ll return our custom `InvalidDataLength` error.

Note that there is a minor difference in the syntax for calculating `total_len` between the `add_movie_review` and `update_movie_review` functions. In `add_movie_review` we are creating the account for the first time, so we can just use `title.len()`. However, in `update_movie_review` we want to use the title that already exists on the account, so we use `account_data.title.len()`.

Calculation for `total_len` in `add_movie_review`:

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

Calculate for `total_len` in `update_movie_review`:

```rust
let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### 6. Update Functions with Security Checks

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

    if rating > 5 {
        msg!("Rating cannot be higher than 5");
        return Err(ReviewError::RatingTooHigh.into())
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

    msg!("checking if movie account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(ReviewError::UninitializedAccount.into());
    }

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

    if rating > 5 || rating < 1 {
        msg!("Invalid Rating");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len());
    if update_len > 1000 - account_data.title.len() {
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

You are now ready to build and upgrade your program just as before. Feel free to reference the solution code [here](https://beta.solpg.io/62b3d8c3f6273245aca4f5c0).

# Challenge

Now that you have a fully functional Movie Review program try implementing some additional functionality on your own. A great example would be to add a `delete_movie_review` instruction that follows the common security practices that we’ve introduced in this lesson. The delete instruction should close the account that the review is stored in. To close an account you will need to zero out the account data as well as transfer lamports out of the PDA. Once the transaction is finished and the account is not rent exempt, the runtime will take care of the rest.

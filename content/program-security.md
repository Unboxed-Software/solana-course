# Create a Basic Program, Part 3 - Basic Security and Validation

### List links for further reading here:

- [Neodyme Security Workshop](https://workshop.neodyme.io/)
- [Solana Smart Contracts: Common Pitfalls](https://blog.neodyme.io/posts/solana_common_pitfalls/)
- [How to Audit a Solana Smart Contract](https://medium.com/coinmonks/how-to-audit-solana-smart-contracts-part-1-a-systematic-approach-56a434f6c9ed)

# Lesson Objectives

*By the end of this lesson, you will be able to:*

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

As mentioned previously, we cannot cover everything that could possibly go wrong with your programs. Ultimately, every program is different and will have different security risks associated with it. Understanding common pitfalls is *essential but insufficient*. In order to have the broadest security coverage possible, you have to approach your code with the right mindset.

As Neodyme mentioned in their presentation, the right mindset requires moving from the question "Is this broken?" to "How do I break this?" This is the first and most essential step in understanding what your code *actually does* as opposed to what you wrote it to do. *All programs can be broken* - it's not a question of "if." Rather, it's a question of "how much dedication would it take." Our job as developers is to close as many holes as possible and increase the effort and dedication required to break our code.

For example, in the Movie Review program we built together over the last two lessons, we wrote code to create new accounts to store movie reviews. However, if we take a closer look at the code, we'll notice that the program also facilitates a lot of unintentional behavior that we could easily catch by asking "How do I break this?" We'll dig into some of these problems in this lesson, but remember that it's up to you to change your mindset toward security.

## Basic security checks

### Ownership checks

An ownership check simply checks that the owner of an account is the public key you expect it to be. As an example, imagine a note-taking app where users can create, update, and delete notes stored by the program in PDA accounts.

If the user invoked the `update` instruction, they would supply the `pda_account` for the movie review they want to update. Since the user can input any instruction data they want, they could provide an account whose data matches the data format of a note account but was not created by the note-taking program. This account could potentially contain malicious data and so should not be trusted.

The simplest way to avoid this problem is to always check tha the owner of an account is 

### Signer checks


## Data Validation

// Make sure rating <= 5 and > 0
// Anything with strings?

## Error

The error.rs file is strictly for defining any custom errors that we’d like to create for our program. The `solana_program` crate does offer a [ProgramError](https://docs.rs/solana-program/1.7.8/solana_program/program_error/enum.ProgramError.html) enum with a handful of different generic errors that we can use, but sometimes it’s helpful to create your own to provide more context about the error when debugging. Custom program errors can be useful to you as a developer, but also for anyone sending transactions to your contract!

We’ll be using the [thiserror](https://docs.rs/thiserror/latest/thiserror/) library to create our own enum of possible custom errors.

```rust
use thiserror::Error;

/// Errors that may be returned by the program.
#[derive(Error)]
pub enum ExampleError{
    // 0
    /// Invalid instruction data passed in.
    #[error("Invalid instruction")]
    InstructionUnpackError,
    // 1
    // Account already initialized
    #[error("Cannot initialize account")]
    AlreadyInitialized,
    // 2
    // Account is not rent exempt
    #[error("Account is not rent exempt")]
    NotRentExempt,
    // 3
    // Failed to deserialize state account
    #[error("Error deserializing state account")]
    DeserializationFailure,
}
```

The `ExampleError` enum is declared with the `#[derive(Error)]` notation which is the derive macro for the `thiserror` library. Each error type also has its own `#[error(…)]` error notation, which is the error message associated with this particular error type.

There is one extra step, the compiler will not accept these error types as is because it expects only `solana_program::program_error::ProgramError` types which these are not. So, we must implement a way to turn these novel error types into `ProgramErrors`.

```rust
// inside error.rs
impl From<ExampleError> for ProgramError {
    fn from(e: ExampleError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Now, you can return these errors like you would any `ProgramError`.

```rust
return Err(ExampleError::DeserializationFailure.into());
```

# Demo

As stated before, the demo for this lesson we’ll be implementing some additional functionality to the Movie Review program. At the end of this demo, you’ll be able to update any movie reviews that you can provide a signature for - which should only be reviews created by you from your public key.

### 1. Program Architecture

To get started, we are going to refactor our program from only three files to the six file architecture we talked about previously. As a reminder, that is:

- **entrypoint.rs**
- **instruction.rs**
- **processor.rs**
- **state.rs**
- **lib.rs**
- **error.rs**

First, let’s create a new file called entrypoint.rs and move our entry point logic from lib.rs to over to the new file. It will look slightly different because we’ll be making a call to a function inside processor.rs, but the essence of the code is the same as before.

```rust
// inside entrypoint.rs
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    entrypoint
};
// bring in processor file
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

Next, we’ll need to create a new file called processor.rs and essentially copy the crates, `process_instruction`, and `add_movie_review` functions that are in lib.rs right now over to the new processor file.

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

    if pda != *pda_account.key {
      msg!("Invalid seeds for PDA");
      return Err(ProgramError::InvalidArgument)
    }

  // Calculate account size required
    let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

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

### 2. Update Movie Review

Now that we have our program architecture set up we can start implementing our new logic! Let’s start with defining the data struct we want to unpack the `instruction_data` into. Considering our new functionality is to just update an existing review, it makes sense to expect the same instruction data as before, so all we have to do is define this data struct inside the `MovieInstruction` enum inside instruction.rs

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

The payload struct can stay the same, but now we just need to add an arm inside the match statement of the `unpack` function for this new data struct so we know which function an instruction is targeting.

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

Now that we can unpack our `instruction_data` and determine which instruction of the program to run, we can add an arm to the match statement in the `process_instruction` function in the processor.rs file.

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
	// new arm to match against our new data structure
      MovieInstruction::UpdateMovieReview { title, rating, description } => {
	// make call to update function that we'll define next
        update_movie_review(program_id, accounts, title, rating, description)
      }
    }
}
```

Next, we can define the new function `update_movie_review` which will have some similarities to the `add_movie_review` function. First, we’ll grab the `AccountInfo` structs passed in the accounts parameter. There are only two accounts required for this instruction, the initializer and the pda of the review we want to update. After getting the `AccountInfo` structs, we can deserialize the data stored at the pda because it should already be initialized and we’ll need some of this data to verify the pda that was passed in.

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
}
```

Now that we have our accounts and data, we can start with our validation checks. This is a fairly simple program so there aren’t that many required but they are still important for the integrity of the program. First, we need to verify that the pda account that was passed in is indeed already initialized and if it’s not, then we need to end the program with an error because you should not be able to update a review if it has not been initialized/created yet.

```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

But wait, take a closer look at the `ProgramError` we’re returning there - it says `AccountAlreadyInitialized` which made sense in the `add_movie_review` function but doesn’t really make sense here since the account *should* be initialized already. Here is an example of when you might want to create your own custom program errors and we’re going to do just that now.

### 3. Custom Program Errors

To account for this and make our errors a little more relevant, create a new file called error.rs and add the following custom errors.

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

/// Errors that may be returned by the MovieReview program.
#[derive(Debug, Error)]
pub enum ReviewError{
    // 0
    /// UnitializedAccount
    #[error("Account not initialized yet")]
    UnitializedAccount,
    // 1
    // Incorrect PDA
    #[error("PDA derived does not equal PDA passed in")]
    InvalidPDA,
    // 2
    // Data is too long
    #[error("Input data exceeds max length")]
    InvalidDataLength,
    //3
    // Rating is too high
    #[error("Rating cannot exceed 5")]
    RatingTooHigh,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

Then bring in the following crate to processor.rs like so

```rust
// inside processor.rs
use crate::error::ReviewError;
```

### 4.Account Validation Checks

Now you can refactor the `is_initialized` validation check to return the new `UnitializedAccount` error type that we just created.

```rust
msg!("checking if movie account is initialized");
if !account_data.is_initialized() {
  msg!("Account is not initialized");
  return Err(ReviewError::UnitializedAccount.into());
}
```

Our next validation check will be on the pda itself. We will derive the pda ourselves with the initializer’s public key and the title that is currently stored in the movie review. The reason we’re doing this is because you should only be able to update a review that was created by you and since the way the pdas were derived in the first place is with the initializer’s key and the title, this is an implicit check that the `initializer` passed in here did indeed create this review. If the `initializer` provided here is not the same public key that was used to derive this pda, then the pda that we derive program side will not equal the pda that was passed in. We’ll also return the second custom error type that we defined in [error.rs](http://error.rs) if they don’t match.

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
	// return custom error
    return Err(ReviewError::InvalidPDA.into())
}
```

The last *account* validation will be to check that the initializer account signed this transaction. This ensures without a doubt that the creator of this review wants it to be updated since a signature cannot be provided without them using their private key and is generally just good practice.

```rust
if !initializer.is_signer {
  msg!("Missing required signature");
  return Err(ProgramError::MissingRequiredSignature)
}
```

### 5. Instruction Data Validation

There is a scenario that we have not accounted for yet. Remember when a review account is created, a specific amount of space is allocated based on the length of the data that it’s going to be storing with this line here
`*let* account_len: *usize* = 1 + 1 + (4 + *title*.len()) + (4 + *description*.len());`
 and the rent required to store that account on the blockchain was calculated based on this length of data. Well, what happens if when the review is originally created, the account only needs 50 bytes of space to store the data but then the creator wants to update it and the length of the updated review is 75 bytes long? In that case, the data will be cutoff after 50 bytes and the last 25 bytes will not be stored. There are a couple ways you can avoid this. The [realloc](https://docs.rs/solana-sdk/latest/solana_sdk/account_info/struct.AccountInfo.html#method.realloc) method was just recently enabled by Solana Labs since slot 133920008, or **May 15th, 2022** and allows you to dynamically change the size of your accounts. We will not be using this method for this demo, but it’s something to be aware of. To learn more about realloc, check out [this blog post](https://dev.to/jacobcreech/how-to-change-account-size-on-solana-55b4).

Instead, we are going to change how we are allocating space when the review accounts are originally created. Instead of only creating enough space to store the specific data passed in, we’re just going to allocate space for an arbitrary number of bytes for all accounts. That way, every account has enough room to grow if needed up to 1000 bytes, which will be the maximum amount of space allowed and we don’t have to worry about re-calculating rent. To do that, we need to change how the account length is calculated inside the `add_movie_review` function to this:

```rust
// inside add_movie_review

// Calculate account size required
//let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
let account_len: usize = 1000;
```

Now, we can run a couple of validation checks on the input data itself inside the `update_movie_review` function. This will make the program a little more robust and is just meant to emphasize how important validation is in smart contracts.

```rust
// inside update_movie_review
let update_len: usize = 1 + 1 + (4 + description.len());
if update_len > 1000 - account_data.title.len() {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}

if rating > 5 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::RatingTooHigh.into())
}
```

Lastly, once all of this validation has passed, we’ll update the movie review data, serialize it, and log some info.

```rust
    msg!("Review before update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

	// update data
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
```

You’ll notice that we **do not** update the title stored in the Movie Review. This is because the title is used as a seed to derive the pda, so if we were to change it here on the update our program would not be able to derive the address of this account deterministically anymore. Plus, if you’re going to change the title of the movie that the review is about, you should probably create a new review altogether.

The final state of the processor.rs file should look like this

```rust
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
use crate::error::ReviewError;

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

    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument)
    }

    // Calculate account size required
    //let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    let account_len: usize = 1000;

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
    msg!("revie title: {}", account_data.title);

    msg!("checking if movie account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(ReviewError::UnitializedAccount.into());
    }

    if pda_account.owner != program_id {
      throw //
    }

    // Derive PDA and check that it matches client
    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let update_len: usize = 1 + 1 + (4 + description.len());
    if update_len > 1000 - account_data.title.len() {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    if rating > 5 {
        msg!("Rating cannot be higher than 5");
        return Err(ReviewError::RatingTooHigh.into())
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

Now, you can simply build and upgrade your program just as before. Clone [this branch](https://github.com/ixmorrow/movie-review-testing-script/tree/update-review-script)  of the testing script repo to test out your program’s new functionality. All you need to do is run the main function in the script and it will generate a keypair, create a review account, and update that review account in two separate transactions. Follow the link each transaction logs to the console to see all of the program logs in the block explorer. Play around with the script a little to change the movies/reviews it’s making and maybe even refactor it so it uses your local cli wallet to create them instead of a random keypair!

# Challenge

Now that you have a fully functional Movie Review program try implementing some additional functionality on your own. A great example would be to add a `delete_movie_review` instruction that follows the common security practices that we’ve introduced in this lesson. The delete instruction should close the account that the review is stored in. To close an account you will need to zero out the account data as well as transfer lamports out of the PDA. Once the transaction is finished and the account is not rent exempt, the runtime will take care of the rest.

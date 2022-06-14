# Movie Review Program Pt2

# Lesson Objectives

- Describe the process of creating a new account using a Program Derived Address (PDA)
- Use seeds to derive a PDA
- Use the space required by an account to calculate the amount of rent (in lamports) a user must allocate
- Use a Cross Program Invocation (CPI) to initialize an account with a PDA as the address of the new account
- Explain how to update the data stored on a new account

# TL;DR

- Creating an account requires that we calculate the space and rent to allocate for a new account
- A Program Derived Address (PDA) is derived from a program ID and an optional list of seeds
- Creating a new account requires that perform a Cross Program Invocation (CPI) to the `create_account` instruction on the System Program
- Updating the data field on an account requires that we serialize (convert to byte array) the data into the account

# Overview

In the previous lesson we went over how to, deserialize instruction data, deserialize account data, and print messages to the program log.

In this lesson we will build upon what we have already done. The next step is to create a new account to store the movie review data from the user.

## Account State

In order to store data on a new account, we must first define a struct that serves as the format for the data field of the account. These structs are stored in a `state.rs` file and are used to serialize data into an account and deserialize data from an existing account.

For our movie review program, we will store the rating, description, and title provided by the user. We will also want a field to check whether the account storing the review has already been initialized. This is to prevent duplicate reviews of the same movie by the same user. We’ll refer to this format as the `MovieAccountState`.

To store data on an account, we must serialize the data. Serialization is the process of converting an object into a bytes array (an area of memory containing a continuous sequence of bytes). For our use case, the object is simply the data we want to store. Writing to the data field of an account requires that we first serialization the data we want to store.

Deserialization is the process of reconstructing an object from a byte array. To read the data from an existing account, we must deserialized the account data from bytes into readable objects. We can then update this (deserialized) data and serialize the data into the account again.

To serialize and deserialize account data on Solana, we use the `BorshSerialize` and `BorshDeserialize` macros from the `borsh` crate.

```rust
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub description: String,
    pub title: String
}
```

We can implement additional functionality to our struct using the `impl` keyword. You can read more about the `impl` keyword [here](https://doc.rust-lang.org/std/keyword.impl.html).

For our movie reviews, we want the ability to check whether an account has already been initialized. To do this we’ll create an `is_initilized` function that checks the `is_initialized` field on the `MovieAccountState` struct.

Note that `fn in_initialized` is the function we call and takes in `self` as a parameter (which is the `MovieAccountState` struct), and that `self.is_initilized` is referring to the `is_initilized` field on the `MovieAccountState` struct.

```rust
impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

## Iterate Accounts

Recall that the `AccountInfo` for all accounts required by an instruction are passing through a single `accounts` argument. In order to parse through the accounts and use them within our instruction, we will need to create an [iterator](https://doc.rust-lang.org/stable/std/iter/) with a mutable reference to the `accounts` argument and assign the `AccountInfo` for each account its own variable. We will do this using the `next_account_info` function from the `account_info` module provided by the `solana_program` crate.

Note that `&mut` means a mutable reference the `accounts` argument. You can read more about references in Rust [here](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) and the `mut` keyword [here](https://doc.rust-lang.org/std/keyword.mut.html).

```rust
  // Get Account iterator
  let account_info_iter = &mut accounts.iter();

  // Get accounts
  let initializer = next_account_info(account_info_iter)?;
  let pda_account = next_account_info(account_info_iter)?;
  let system_program = next_account_info(account_info_iter)?;
```

## Create New Account

Before we can update the data field of an account, we have to first create a new account.

To create a new account within our program we must:

1. Calculate the space and rent required for the account
2. Have an address to assign the new account
3. Invoke the system program to create the new account

## Space and Rent

Recall that storing data on the Solana network requires users to allocate rent in the form of lamports. The amount of rent required by a new account depends on the amount of space the account requires. Since we are creating a custom movie review account where we specify the data to store, we must also manually calculate the space that the account requires. The space we calculate is then used to determine the amount of rent a payer must allocation.

Note that rent is more like a deposit. All the lamports allocated for rent can be fully refunded when an account is closed. Additionally, all account are now required to be [rent-exempt](https://twitter.com/jacobvcreech/status/1524790032938287105) (this means lamports are not deducted from the account over time). An account is considered rent-exempt if it holds at least 2 years worth of rent. In other words, accounts are stored on-chain permanently until the owner closes the account and withdraws the rent.

For our `MovieAccountState` we are storing four fields. We will allocate 1 byte each for the `is_initialized` and `rating`. For both `title` and `description` we will allocate space equal to 4 bytes plus the length of the string. The additional 4 bytes is prefix that stores the actual length of the string input by the user. This prefix is used to find where the next field is located in the array of bytes (i.e. how many bytes after after `title` to find `description`).

We’ll store the space we calculate in a variable called `account_len`. We then calculate the rent required for the space we need using the `minimum_balance` function from the `rent` module of the `solana_program` crate.

```rust
  // Calculate account size required for struct MovieAccountState
  let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

  // Calculate rent required
  let rent = Rent::get()?;
  let rent_lamports = rent.minimum_balance(account_len);
```

## Program Derived Addresses (PDA)

To create an account, we also need to have an address to assign the account. For program owned accounts, this will be a program derived address (PDA) found using the `find_program_address` function. As the name implies, PDAs are derived using the program ID (address of the program creating the account) and an optional list of “seeds”. Optional seeds are additional inputs used in the function to derive the PDA. Providing additional seeds to derive a PDA allows us to create an arbitrary number of accounts the program may own.

For our movie review program, we will two additional seeds to derive the PDA for each new account. We will use the initializer’s publickey and the movie title as the optional seeds. Setting up the PDA this way restrict each user to only one review for any one movie title. However, it still allows the same user to review with movies with different titles and different users to review the movie with the same title.

There is one more seed that is needed to derive a PDA. This seed is referred to as the “bump seed” and is a number between 255-0. It is a requirement that PDAs do not have a corresponding private key. This is done by deriving the PDA again using a new “bump seed” until a valid PDA is found. The `find_program_addres` function tries to find a PDA using the optional seeds provided, the program ID, and the “bump seed” starting from 255. If the output is not a valid PDA, then the function decreases the bump by 1 and tries again (255, 254, 253, etc). Once a valid PDA is found, the function returns both the PDA and the bump that was used to derive the PDA.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
```

## Cross Program Invocation (CPI)

Once we’ve calculated the rent required for our account and found a valid PDA to assign as the address of the new account, we are finally ready to create the account. Creating a new account within our program requires a Cross Program Invocation (CPI). A CPI is when one program invokes an instruction on another program. To create a new account within our program, we will invoke the `create_account` instruction on the system program.

CPIs can be done using either `invoke` or `invoke_signed`.

```rust
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult
```

```rust
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

For this lesson we will use `invoke_signed`. Unlike a regular signature where a private key is used, `invoke_signed` uses the optional seeds, bump seed, and program ID to derive a PDA and sign an instruction. This is done by checking the derived PDA against the all accounts passed into the instruction. If any of the accounts match the PDA, then the signer field for that account is marked to true.

A program can securely sign transactions this way because `invoke_signed` generates the PDA used for signing with the program ID of the program invoking the instruction. Therefore, it is not possible for one program to generate a matching PDA to sign for an account using a PDA derived using another program ID.

```rust
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
```

## Deserialize Account Data

Once the system program creates a new account for us, we can now populate the data field of the account using the format of a struct type we specified in `state.rs`. We start by reference the `pda_account` (that we that we just created) and borrowing the data field on the account. This allows us to access the data without taking ownership. The `try_from_sliced_unchecked` function deserializes the data field of the borrowed account, using the format of our `MovieAccountState` struct.

We’ll assign this data to a variable called `account_data`. We now have access to the data field of the `pda_account` and are ready to continue with our checks and updates. We first check if the account has already been initialized by using the `is_initilized` function implemented for our `MovieAccountState` struct in `state.rs`. If the account has not been initialized, then we populate the additional fields (rating, title description) on the `MovieAccountState` struct using the inputs provided by the user. Lastly, we set the initialized field to true.

```rust
  msg!("unpacking state account");
  let mut account_data = try_from_slice_unchecked::<MovieAccountState>(pda_account.data.borrow()).unwrap();
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
```

## Serialize Account Data

Our `account_data` variable now holds the deserialized data in the format of our `MovieAccountState` struct updated with the user’s inputs for the movie review. We now need to save the data on the `account_data` variable to the data field on our actual `pda_account`. We do this by borrowing a mutable reference to the data field of the `pda_account` again and then serializing (convert to bytes) the `account_data` to the data field on the `pda_account`. This effectively saves the updated `account_data` variable to the data field of the new account. Now when a user fetches the `pda_account` and deserializes (convert from bytes) the data field, it will display the updated data we’ve serialized into the account.

```rust
account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
```

# Demo

Let’s practice this together by continuing to work on the Movie Review program from the last lesson. No worries if you’re just jumping into this lesson - it should be possible to follow either way.

As a refresher, we are building a Solana program which lets users review movies. Last lesson, we deserialized the instruction data passed in by the user but we have not yet store this data in an account. Let’s now update our program to create new accounts to store the user’s movie review.

### Download the starter code

If you didn’t complete the demo from the last lesson or just want to make sure that you didn’t miss anything, you can reference the starter code [here](https://beta.solpg.io/6295b25b0e6ab1eb92d947f7).

Our program currently includes the `instruction.rs` file we use to deserialize the `instruction_data` passed into the program entry point. We have also completed `lib.rs` file to the point where we can print our deserialized instruction data to the program log using the `msg!` macro.

### Create `state.rs` file

In this lesson we will create a new account that stores the data for each movie review. Let’s create a new file named `state.rs`.

This file will:

1. Define the struct our program uses to populate the data field of a new account
2. Serialize and deserialize the struct

First, let’s bring into scope everything we’ll need from the `borsh` and `solana_program` crates.

```rust
use borsh::{BorshSerialize, BorshDeserialize};
use solana_program::{
    program_pack::{IsInitialized, Sealed},
};
```

### Create Struct

Next, let’s create our `MovieAccountState` struct. This struct will define the parameters that each new movie review account will store in its data field. Our `MovieAccountState` struct will require the following parameters:

- `is_initialized` - field use to check if program account state is initialized
- `rating` - user’s rating of the movie
- `description` - user’s description of the movie
- `title` - title of the movie the user is reviewing

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub description: String,
    pub title: String
}
```

### Implement Struct Functionality

Lastly, lets implement some additional functionality for our `MovieAccountState` struct using the `impl` keyword.

1. `Sealed` is Solana's version of Rust's `Sized` trait. This simply specifies that `MovieAccountState` has a known size.
2. `IsInitialized` checks the `is_initialized` field of our `MovieAccountState` struct.

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

### Update `lib.rs`

Next, let’s update our `lib.rs` file. First, we’ll bring into scope everything we will need to complete our Movie Review program. You can read more about the details each item we are using from the `solana_program` crate [here](https://docs.rs/solana-program/latest/solana_program/).

```rust
use solana_program::{
    entrypoint,
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
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;
```

### Iterate through `accounts`

Next, let’s continue building our `add_movie_review` function. We’ll start by parsing through the accounts we will need to process our instruction. Recall that the `AccountInfo` for all accounts are passing into the `add_movie_review` function through a single `accounts` argument. We will need to iterate through `accounts` and assign the `AccountInfo` for each account to its own variable.

```rust
  // Get Account iterator
  let account_info_iter = &mut accounts.iter();

  // Get accounts
  let initializer = next_account_info(account_info_iter)?;
  let pda_account = next_account_info(account_info_iter)?;
  let system_program = next_account_info(account_info_iter)?;
```

### Verify PDA

Next, within our `add_movie_review` function let’s independently derive the PDA we expect the user to have passed in. Since `pda_account` is just a variable name we’ve assigned to the second account passed in through the `accounts` argument, the user could have provided a different address than the one we expect. This step verifies that the the address we expect matches the address provided by the user.

```rust
  // Derive PDA and check that it matches client
  let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);

  if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
  }
```

### Calculate Space and Rent

Next, let’s calculate the rent that our new account will need. Recall that rent is the amount of lamports a user must allocate to an account for storing data on the Solana network. To calculate rent, we must first calculate the amount of space our new account requires.

```rust
  // Calculate account size required
  let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

  // Calculate rent required
  let rent = Rent::get()?;
  let rent_lamports = rent.minimum_balance(account_len);
```

### Create New Account

Once we’ve calculated the rent and verified the PDA, we are ready to create our new account. In order to create a new account, we must call the `create_account` instruction from the system program. We do this with a Cross Program Invocation (CPI) using the `invoke_signed` function. We use `invoke_signed` because want the our Movie Review program to have ownership over this new account and need the Movie Review program to “sign” the instruction.

```rust
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
```

### Update Account Data

Now that we’ve created a new account, we are ready to update the data field of the new account using the format of the `MovieAccountState` struct from our `state.rs` file. We will first check the the `is_initalized` field using `is_initialized` function from `state.rs`. If the check returns false, then we assign each parameter specified in the `MovieAccountState` struct using the arguments passed into the `add_movie_review` function and set `is_initialized` to true.

```rust
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
```

### Serialize Account Data

Lastly, we serialized the updated `account_data` into the data field of our `pda_account`.

```rust
  msg!("serializing account");
  account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
  msg!("state account serialized");
```

All together, our `lib.rs` file looks like this:

```rust
use solana_program::{
    entrypoint,
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
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;

entrypoint!(process_instruction);

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

### Build and Deploy

Our Movie Review program is finally complete. We are now ready to build and deploy our program!

![Gif Build and Deploy Program](../assets/movie-review-pt2-build-deploy.gif)

# Challenge

Now that we’ve deployed the Movie Review program, test out the program using the finalized Movie Review frontend from Module 1. You can find the code [here](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-paging-account-data) (make sure to download the branch specified in the link).

Simply replace the `MOVIE_REVIEW_PROGRAM_ID` in both the `MovieList.tsx` and `Form.tsx` components with the address of the program you’ve deployed. Then run the frontend, submit a view, and refresh the browser to see the review.
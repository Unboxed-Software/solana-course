---
title: Create a Basic Program, Part 2 - State Management
objectives:
- Describe the process of creating a new account using a Program Derived Address (PDA)
- Use seeds to derive a PDA
- Use the space required by an account to calculate the amount of rent (in lamports) a user must allocate
- Use a Cross Program Invocation (CPI) to initialize an account with a PDA as the address of the new account
- Explain how to update the data stored on a new account
---

# Summary

- Program state is stored in other accounts rather than in the program itself
- A Program Derived Address (PDA) is derived from a program ID and an optional list of seeds. Once derived, PDAs are subsequently used as the address for a storage account.
- Creating an account requires that we calculate the space required and the corresponding rent to allocate for the new account
- Creating a new account requires a Cross Program Invocation (CPI) to the `create_account` instruction on the System Program
- Updating the data field on an account requires that we serialize (convert to byte array) the data into the account

# Lesson

Solana maintains speed, efficiency, and extensibility in part by making programs stateless. Rather than having state stored on the program itself, programs use Solana's account model to read state from and write state to separate PDA accounts.

While this is an extremely flexible model, it's also a paradigm that can be difficult to work in if its unfamiliar. But don't worry! We'll start simple in this lesson and work up to more complex programs in the next unit.

In this lesson we'll learn the basics of state management for a Solana program, including representing state as a Rust type, creating accounts using Program Derived Addresses, and serializing account data.

## Program state

All Solana accounts have a `data` field that holds a byte array. This makes accounts as flexible as files on a computer. You can store literally anything in an account (so long as the account has the storage space for it).

Just as files in a traditional filesystem conform to specific data formats like PDF or MP3, the data stored in a Solana account needs to follow some kind of pattern so that the data can be retrieved and deserialized into something usable.

### Represent state as a Rust type

When writing a program in Rust, we typically create this "format" by defining a Rust data type. If you went through the [first part of this lesson](basic-program-pt-1), this is very similar to what we did when we created an enum to represent discrete instructions.

While this type should reflect the structure of your data, for most use cases a simple struct is sufficient. For example, a note-taking program that stores notes in separate accounts would likely have data for a title, body, and maybe an ID of some kind. We could create a struct to represent that as follows:

```rust
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

### Using Borsh for serialization and deserialization

Just as with instruction data, we need a mechanism for converting from our Rust data type to a byte array, and vice versa. **Serialization** is the process of converting an object into a byte array. **Deserialization** is the process of reconstructing an object from a byte array.

We'll continue to use Borsh for serialization and deserialization. In Rust, we can use the `borsh` crate to get access to the `BorshSerialize` and `BorshDeserialize` traits. We can then apply those traits using the `derive` attribute macro.

```rust
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

These traits will provide methods on `NoteState` that we can use to serialize and deserialize the data as needed.

## Creating accounts

Before we can update the data field of an account, we have to first create that account.

To create a new account within our program we must:

1. Calculate the space and rent required for the account
2. Have an address to assign the new account
3. Invoke the system program to create the new account

### Space and rent

Recall that storing data on the Solana network requires users to allocate rent in the form of lamports. The amount of rent required by a new account depends on the amount of space you would like allocated to that account. That means we need to know before creating the account how much space to allocate.

Note that rent is more like a deposit. All the lamports allocated for rent can be fully refunded when an account is closed. Additionally, all new accounts are now required to be [rent-exempt](https://twitter.com/jacobvcreech/status/1524790032938287105), meaning lamports are not deducted from the account over time. An account is considered rent-exempt if it holds at least 2 years worth of rent. In other words, accounts are stored onchain permanently until the owner closes the account and withdraws the rent.

In our note-taking app example, the `NoteState` struct specifies three fields that need to be stored in an account: `title`, `body`, and `id`. To calculate the size the account needs to be, you would simply add up the size required to store the data in each field.

For dynamic data, like strings, Borsh adds an additional 4 bytes at the beginning to store the length of that particular field. That means `title` and `body` are each 4 bytes plus their respective sizes. The `id` field is a 64-bit integer, or 8 bytes.

You can add up those lengths and then calculate the rent required for that amount of space using the `minimum_balance` function from the `rent` module of the `solana_program` crate.

```rust
// Calculate account size required for struct NoteState
let account_len: usize = (4 + title.len()) + (4 + body.len()) + 8;

// Calculate rent required
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### Program Derived Addresses (PDA)

Before creating an account, we also need to have an address to assign the account. For program owned accounts, this will be a program derived address (PDA) found using the `find_program_address` function. 

As the name implies, PDAs are derived using the program ID (address of the program creating the account) and an optional list of “seeds”. Optional seeds are additional inputs used in the `find_program_address` function to derive the PDA. The function used to derive PDAs will return the same address every time when given the same inputs. This gives us the ability to create any number of PDA accounts and a deterministic way to find each account.

In addition to the seeds you provide for deriving a PDA, the `find_program_address` function will provide one additional "bump seed." What makes PDAs unique from other Solana account addresses is that they do not have a corresponding secret key. This ensures that only the program that owns the address can sign on behalf of the PDA. When the `find_program_address` function attempts to derive a PDA using the provided seeds, it passes in the number 255 as the "bump seed." If the resulting address is invalid (i.e. has a corresponding secret key), then the function decreases the bump seed by 1 and derives a new PDA with that bump seed. Once a valid PDA is found, the function returns both the PDA and the bump that was used to derive the PDA.

For our note-taking program, we will use the note creator's public key and the ID as the optional seeds to derive the PDA. Deriving the PDA this way allows us to deterministically find the account for each note.

```rust
let (note_pda_account, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);
```

### Cross Program Invocation (CPI)

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

For this lesson we will use `invoke_signed`. Unlike a regular signature where a secret key is used to sign, `invoke_signed` uses the optional seeds, bump seed, and program ID to derive a PDA and sign an instruction. This is done by comparing the derived PDA against all accounts passed into the instruction. If any of the accounts match the PDA, then the signer field for that account is set to true.

A program can securely sign transactions this way because `invoke_signed` generates the PDA used for signing with the program ID of the program invoking the instruction. Therefore, it is not possible for one program to generate a matching PDA to sign for an account with a PDA derived using another program ID.

```rust
invoke_signed(
    // instruction
    &system_instruction::create_account(
        note_creator.key,
        note_pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    // account_infos
    &[note_creator.clone(), note_pda_account.clone(), system_program.clone()],
    // signers_seeds
    &[&[note_creator.key.as_ref(), note_id.as_bytes().as_ref(), &[bump_seed]]],
)?;
```

## Serializing and deserializing account data

Once we've created a new account, we need to access and update the account's data field. This means deserializing its byte array into an instance of the type we created, updating the fields on that instance, then serializing that instance back into a byte array.

### Deserialize account data

The first step to updating an account's data is to deserialize its `data` byte array into its Rust type. You can do this by first borrowing the data field on the account. This allows you to access the data without taking ownership.

You can then use the `try_from_slice_unchecked` function to deserialize the data field of the borrowed account using the format of the type you created to represent the data. This gives you an instance of your Rust type so you can easily update fields using dot notation. If we were to do this with the note-taking app example we've been using, it would look like this:

```rust
let mut account_data = try_from_slice_unchecked::<NoteState>(note_pda_account.data.borrow()).unwrap();

account_data.title = title;
account_data.body = rating;
account_data.id = id;
```

### Serialize account data

Once the Rust instance representing the account's data has been updated with the appropriate values, you can "save" the data on the account.

This is done with the `serialize` function on the instance of the Rust type you created. You'll need to pass in a mutable reference to the account data. The syntax here is tricky, so don't worry if you don't understand it completely. Borrowing and references are two of the toughest concepts in Rust.

```rust
account_data.serialize(&mut &mut note_pda_account.data.borrow_mut()[..])?;
```

The above example converts the `account_data` object to a byte array and sets it to the `data` property on `note_pda_account`. This saves the updated `account_data` variable to the data field of the new account. Now when a user fetches the `note_pda_account` and deserializes the data, it will display the updated data we’ve serialized into the account.

## Iterators

You may have noticed in the previous examples that we referenced `note_creator` and didn't show where that came from.

To get access to this and other accounts, we use an [Iterator](https://doc.rust-lang.org/std/iter/trait.Iterator.html). An iterator is a Rust trait used to give sequential access to each element in a collection of values. Iterators are used in Solana programs to safely iterate over the list of accounts passed into the program entry point through the `accounts` argument.

### Rust iterator

The iterator pattern allows you to perform some task on a sequence of items. The `iter()` method creates an iterator object that references a collection. An iterator is responsible for the logic of iterating over each item and determining when the sequence has finished. In Rust, iterators are lazy, meaning they have no effect until you call methods that consume the iterator to use it up. Once you've created an iterator, you must call the `next()` function on it to get the next item.

```rust
let v1 = vec![1, 2, 3];

// create the iterator over the vec
let v1_iter = v1.iter();

// use the iterator to get the first item
let first_item = v1_iter.next();

// use the iterator to get the second item
let second_item = v1_iter.next();
```

### Solana accounts iterator

Recall that the `AccountInfo` for all accounts required by an instruction are passing through a single `accounts` argument. To parse through the accounts and use them within our instruction, we will need to create an iterator with a mutable reference to the `accounts`.

At that point, instead of using the iterator directly, we pass it to the `next_account_info` function from the `account_info` module provided by the `solana_program` crate.

For example, the instruction to create a new note in a note-taking program would at minimum require the accounts for the user creating the note, a PDA to store the note, and the `system_program` to initialize a new account. All three accounts would be passed into the program entry point through the `accounts` argument. An iterator of `accounts` is then used to separate out the `AccountInfo` associated with each account to process the instruction.

Note that `&mut` means a mutable reference to the `accounts` argument. You can read more about [references in Rust](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) and [the `mut` keyword](https://doc.rust-lang.org/std/keyword.mut.html).

```rust
// Get Account iterator
let account_info_iter = &mut accounts.iter();

// Get accounts
let note_creator = next_account_info(account_info_iter)?;
let note_pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

# Lab

This overview covered a lot of new concepts. Let’s practice them together by continuing to work on the Movie Review program from the last lesson. No worries if you’re just jumping into this lesson without having done the previous lesson - it should be possible to follow along either way. We'll be using the [Solana Playground](https://beta.solpg.io) to write, build, and deploy our code.

As a refresher, we are building a Solana program which lets users review movies. Last lesson, we deserialized the instruction data passed in by the user but we have not yet stored this data in an account. Let’s now update our program to create new accounts to store the user’s movie review.

### 1. Get the starter code

If you didn’t complete the lab from the last lesson or just want to make sure that you didn’t miss anything, you can reference [the starter code](https://beta.solpg.io/6295b25b0e6ab1eb92d947f7).

Our program currently includes the `instruction.rs` file we use to deserialize the `instruction_data` passed into the program entry point. We have also completed `lib.rs` file to the point where we can print our deserialized instruction data to the program log using the `msg!` macro.

### 2. Create struct to represent account data

Let’s begin by creating a new file named `state.rs`.

This file will:

1. Define the struct our program uses to populate the data field of a new account
2. Add `BorshSerialize` and `BorshDeserialize` traits to this struct

First, let’s bring into scope everything we’ll need from the `borsh` crate.

```rust
use borsh::{BorshSerialize, BorshDeserialize};
```

Next, let’s create our `MovieAccountState` struct. This struct will define the parameters that each new movie review account will store in its data field. Our `MovieAccountState` struct will require the following parameters:

- `is_initialized` - shows whether or not the account has been initialized
- `rating` - user’s rating of the movie
- `description` - user’s description of the movie
- `title` - title of the movie the user is reviewing

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub title: String,
    pub description: String  
}
```

### 3. Update `lib.rs`

Next, let’s update our `lib.rs` file. First, we’ll bring into scope everything we will need to complete our Movie Review program. You can read more about the details each item we are using from [the `solana_program` crate](https://docs.rs/solana-program/latest/solana_program/).

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
};
use std::convert::TryInto;
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;
```

### 4. Iterate through `accounts`

Next, let’s continue building out our `add_movie_review` function. Recall that an array of accounts is passed into the `add_movie_review` function through a single `accounts` argument. To process our instruction, we will need to iterate through `accounts` and assign the `AccountInfo` for each account to its own variable.

```rust
// Get Account iterator
let account_info_iter = &mut accounts.iter();

// Get accounts
let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

### 5. Derive PDA

Next, within our `add_movie_review` function, let’s independently derive the PDA we expect the user to have passed in. We'll need to provide the bump seed for the derivation later, so even though `pda_account` should reference the same account, we still need to call `find_program_address`.

Note that we derive the PDA for each new account using the initializer’s public key and the movie title as optional seeds. Setting up the PDA this way restricts each user to only one review for any one movie title. However, it still allows the same user to review movies with different titles and different users to review movies with the same title.

```rust
// Derive PDA
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
```

### 6. Calculate space and rent

Next, let’s calculate the rent that our new account will need. Recall that rent is the amount of lamports a user must allocate to an account for storing data on the Solana network. To calculate rent, we must first calculate the amount of space our new account requires.

The `MovieAccountState` struct has four fields. We will allocate 1 byte each for `rating` and `is_initialized`. For both `title` and `description` we will allocate space equal to 4 bytes plus the length of the string.

```rust
// Calculate account size required
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

// Calculate rent required
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### 7. Create new account

Once we’ve calculated the rent and verified the PDA, we are ready to create our new account. To create a new account, we must call the `create_account` instruction from the system program. We do this with a Cross Program Invocation (CPI) using the `invoke_signed` function. We use `invoke_signed` because we are creating the account using a PDA and need the Movie Review program to “sign” the instruction.

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

### 8. Update account data

Now that we’ve created a new account, we are ready to update the data field of the new account using the format of the `MovieAccountState` struct from our `state.rs` file. We first deserialize the account data from `pda_account` using `try_from_slice_unchecked`, then set the values of each field.

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");

account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Lastly, we serialize the updated `account_data` into the data field of our `pda_account`.

```rust
msg!("serializing account");
account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
msg!("state account serialized");
```

### 9. Build and deploy

We're ready to build and deploy our program!

![Gif Build and Deploy Program](../assets/movie-review-pt2-build-deploy.gif)

You can test your program by submitting a transaction with the right instruction data. For that, feel free to use [this script](https://github.com/Unboxed-Software/solana-movie-client) or [the frontend](https://github.com/Unboxed-Software/solana-movie-frontend) we built in the [Deserialize Custom Instruction Data lesson](deserialize-custom-data). In both cases, make sure you copy and paste the program ID for your program into the appropriate area of the source code to make sure you're testing the right program.

If you use the frontend, simply replace the `MOVIE_REVIEW_PROGRAM_ID` in both the `MovieList.tsx` and `Form.tsx` components with the address of the program you’ve deployed. Then run the frontend, submit a view, and refresh the browser to see the review.

If you need more time with this project to feel comfortable with these concepts, have a look at the [solution code](https://beta.solpg.io/62b23597f6273245aca4f5b4) before continuing.

# Challenge

Now it’s your turn to build something independently. Equipped with the concepts intoduced in this lesson, you now know everything you'll need to recreate the entirety of the Student Intro program from Module 1.

The Student Intro program is a Solana Program that lets students introduce themselves. The program takes a user's name and a short message as the `instruction_data` and creates an account to store the data onchain.

Using what you've learned in this lesson, build out this program. In addition to taking a name a short message as instruction data, the program should:

1. Create a separate account for each student
2. Store `is_initialized` as a boolean, `name` as a string, and `msg` as a string in each account

You can test your program by building the [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend) we created in the [Page, Order, and Filter Program Data lesson](./paging-ordering-filtering-data). Remember to replace the program ID in the frontend code with the one you've deployed. 

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).



## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=8320fc87-2b6d-4b3a-8b1a-54b55afed781)!
# Create a Basic Program: Part 1

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Learn some Rust basics
- Deserialize instruction data
- Learn the structure of a smart contract on Solana

# TL;DR

- The focus over the next three lessons will be to walk you through how the Movie Review program that was used in the first module was created. This is split up over multiple lessons to make the information a little more digestible.
- In the previous lesson, the "Hello, World!" demo was confined to a single file. Going forward we'll be separating our smart contract code into multiple files where the code in each file serves a specific purpose.
- Logging helpful and relevant information is good for troubleshooting during development and for users who will interact with the program because the logs are visible in the explorer.

# Overview

## Rust Basics
As the complexity of a program grows, it's important to maintain a project structure that remains readable and extensible. This involves encapsulating code into functions, data structures, and files that fit a program's flow and logic. Before we dive into the specifics of how we'll be structuring a basic program, let's talk about the Rust basics we'll be using throughout this lesson.

### Struct
A struct, or structure, is a custom data type that lets you package together and name multiple related values that make up a meaningful group. Each piece of data in a struct can be of different types and each has a name associated with it.
```rust
struct User {
  active: bool,
  age: u64
}
```
To use a struct after we’ve defined it, we create an instance of that struct by specifying concrete values for each of the fields.
```rust
let User1 = User {
  active = true,
  age = 36
}
```
To get or set a specific value from a struct, we use dot notation.
```rust
User1.age = 37
```

### Enumerations
Enumerations (or Enums) are a data struct that allow you to define a type by enumerating its possible variants. An example of an enum may look like:
```rust
enum Light {
    On,
    Off
}
```
The `Light` enum has two possible variants in this situation, it's either `On` or `Off`.

### Match statements
`Match` statements are a control flow struct that is very similar to a `Switch` statement in C/C++. The `match` statement allows you to compare a value against a series of patterns and then execute code based on which pattern matches the value. Patterns can be made of literal values, variable names, wildcards, and many other things. The match statement must include all possible scenarios, otherwise the code will not compile.
```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter,
}

fn value_in_cents(coin: Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25,
    }
}
```

### Iterators
 The iterator pattern allows you to perform some task on a sequence of items in turn. An iterator is responsible for the logic of iterating over each item and determining when the sequence has finished. In Rust, iterators are lazy, meaning they have no effect until you call methods that consume the iterator to use it up. Once you've created an iterator, you must call the `next()` function on it to get the next piece item.
 ```rust
 let v1 = vec![1, 2, 3];
 // create the iterator over the vec
 let v1_iter = v1.iter();
 // use the iterator to get the first item
 let first_item = v1_iter.next();
 // use the iterator to get the second item
 let second_item = v1_iter.next();
 ```

 ### Implement
 `Impl` is a keyword in Rust that used to define implementations on types. Functions and consts can both be defined in an implementation.
 ```rust
 struct Example {
     number: i32,
 }

 impl Example {
     fn boo() {
         println!("boo! Example::boo() was called!");
     }

     fn answer(&mut self) {
         self.number += 42;
     }

     fn get_number(&self) -> i32 {
         self.number
     }
 }
 ```
 You can call the implementations of the example struct like so
 ```rust
Example.boo();
 ```
### Variables
Variables in rust by default are immutable, meaning once a variable is set - it cannot be changed. In order to create a variable that we'd like to change at some point in the future, we must make use of the `mut` keyword, which stands for mutable. Defining a variable with this keyword means that the value store in it can change.
```rust
// compiler will throw error
let test = 1;
test = 2;

// this is allowed
let mut test2 = 5;
test2 = 4;
```
The Rust compiler guarantees that when you state a value won’t change, it really won’t change, so you don’t have to keep track of it yourself. Your code is thus easier to reason through.

## Program Structure

The last lesson’s program was simple enough that it could be confined to one file. Now, while you can write almost any smart contract program in a single file for Solana, it’s much easier to understand and follow if you break it up across a few different ones.

For this lesson, we will be splitting up this program across 3 different files:

- **lib.rs**
- **instruction.rs**
- **state.rs**

Many Solana smart contract tutorials use a general program architecture which splits the programs across six files. While working your way through these, it’s very easy to get carried away and confused about what each of these files is used for. We feel that following this same practice is adding too much new information to really comprehend how the parts all fit together. So, with that in mind, we are keeping our program simple - just three files for this lesson. Don’t worry though, we will teach you the common program architecture after we’re sure you’ve got the basics.

## Entrypoint

In the previous lesson, we learned that Solana programs require a single entry point to process program instructions. The entry point is declared using the [entrypoint!](https://docs.rs/solana-program/latest/solana_program/macro.entrypoint.html) macro.

The entry point to a Solana program requires a function defined with the following parameters:

- `program_id` - is the address of the account the program is stored at
- `accounts` - is the array of accounts submitted in the transaction
- `instruction_data` - is the serialized instruction-specific data

Once the entry point function is defined, it will be passed as an argument into the `entrypoint!` macro which signifies where the program logic will start. A simple entrypoint to a program may look like this:

```rust
// Bring in crates that will be used
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
};
use crate::processor::Processor;
use solana_program::entrypoint;
use instruction::TestInstruction;

// `process_instruction` function passed into entrypoint macro
entrypoint!(process_instruction);

// `process_instuction` defined, this will be the first block of code to
// Execute in the contract
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Some logic here
}
```

The entry point and program logic will live inside the lib.rs file.

## Instruction

The instruction.rs file is where you write the logic for deserializing the instruction data to whatever struct your program expects the data to be. Notice in the example above, we brought in a crate from the instruction.rs file:

`use instruction::TestInstruction;`

There we have written an `unpack` function that will try to deserialize whatever data was passed in as instruction data to the data struct it expects.

To do so, we’ll first define an [enum](https://doc.rust-lang.org/std/keyword.enum.html) that will hold the various different data structs our program can expect to receive.

```rust
use borsh::{BorshDeserialize};
use solana_program::{program_error::ProgramError};

// Only one data struct in this enum, but
// could have as many options as we want
pub enum ExampleInstruction {
    TestStruct {
        name: String,
        age: u8,
        bio: String,
    }
}

#[derive(BorshDeserialize)]
struct PostIxPayload {
    name: String,
    age: u8,
    bio: String,
}
```

Next, we can implement the `unpack` function on the `ExampleInstruction` enum. This is where we will use Borsh to deserialize the `instruction_data` into the `PostIxPayload` struct defined above and create a `TestStruct` from the payload.

```rust
impl ExampleInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Take the first byte as the variant to
        // determine which instruction to execute
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // Use the temporary payload struct to deserialize
        let payload = PostIxPayload::try_from_slice(rest).unwrap();
        // Match the variant to determine which data struct is expected by
        // the function and return the TestStruct or an error
        Ok(match variant {
            0 => Self::TestStruct {
                name: payload.name,
                age: payload.age,
                bio: payload.bio},
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## Program Logic

Now that we've covered the entry point and how to deserialize our instruction data, we can call the `unpack` function and match on what it returns. This will determine where the flow of execution will go next.


```rust
// Inside lib.rs
// crates
use solana_program::{
    entrypoint,
    pubkey::Pubkey,
    msg,
    account_info::{next_account_info, AccountInfo},
    program_error::ProgramError,
};
pub mod instruction;
use instruction::MovieInstruction;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Call unpack to deserialize instruction_data
    let instruction = ExampleInstruction::unpack(instruction_data)?;
    // Match the returned data struct to what you expect
    match instruction {
        ExampleInstruction::TestStruct { name, age, bio } => {
            // Make call to a function to execute some logic with
            // the accounts and the deserialized instruction data
            do_something(program_id, accounts, name, age, bio)
        }
    }
}
```

For simple programs where there are only one or two instructions to execute, it’s fine to write the logic inside the match statement. For programs with many different possible instructions to match against, it’s much easier to read/understand if the logic is executed in a separate function that’s called in the match statement. As you can see, we are following the latter practice here by making a call to a function called `do_something` that will execute some more logic.

In the previous lesson, the "Hello, world!" demo program only had one file. Now, we’re learning how to split programs up across three separate files. Once you start splitting your program up like this you will need to make sure you register all of the files in one central location, we’ll be doing this in lib.rs as well. **You must register every file in your program like this.**

```rust
// This would be inside lib.rs
pub mod instruction;
pub mod state;
```

## Demo

For this lesson’s demo, we’ll be building out the first half of the Movie Review program with a focus on deserializing the instruction data. The following lesson will focus on the second half of this program.

### 1. Entry point

We’ll be using [SolPG](https://beta.solpg.io/) again to build out this program. SolPG saves state in your browser, so everything you did in the previous lesson should still be there. To get started, let's clear everything out from the current [lib.rs](http://lib.rs) file.

Inside lib.rs, we’re going to bring in the following crates and define where we’d like our entry point to the program to be with the `entrypoint` macro.

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

// Entry point is a function call process_instruction
entrypoint!(process_instruction);
```

Using the `entrypoint` macro, we determined `process_instruction` as the program entry point, now we can define this function below.

```rust
// Inside lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
// Makes call to unpack function, which undefined at the moment
    let instruction = MovieInstruction::unpack(instruction_data)?;

}
```

### 2. Deserialize instruction data

Now, before we continue with the processor logic, the rest will make more sense if we implement the `unpack` function we just added above. Create a new file called instruction.rs and add the following:

```rust
use borsh::{BorshDeserialize};
use solana_program::{program_error::ProgramError};

pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}

#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

We just brought in the crates we’ll need for this file and defined the structs we’ll be using to deserialize the `instruction_data` into. Notice the `#derive(...)]` above the payload struct, this is known as an [attribute](https://doc.rust-lang.org/rust-by-example/attribute.html) in Rust. Specifically, the [derive attribute](https://doc.rust-lang.org/rust-by-example/trait/derive.html) allows the compiler to provide some basic implementations that can be used on the data structure with this attribute. We’re deriving some traits that make deserialization with Borsh much easier. It is also helpful to note that you can define your own customized versions of these implementations if you’d like, but for our purposes the basic ones will do the trick.

Finally, we’ll implement and define the `unpack` function on the `IntroInstruction` enum.

```rust
...

// Inside instruction.rs
impl MovieInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Split the first byte of data
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // `try_from_slice` is one of the implementations from the BorshDeserialization trait
        // Deserializes instruction byte data into the payload struct
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        // Match the first byte and return the AddMovieReview struct
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

And that’s it for the instruction file! Now, remember we left the lib.rs file partially finished to come and write the implementation on the unpack function.

### 3. Program logic

Now that that’s done, we know how the `unpack` function will deserialize the data and the struct we expect to receive. So, let’s add it to our match instruction inside lib.rs.

```rust
// Inside lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Unpack called
    let instruction = MovieInstruction::unpack(instruction_data)?;
    // Match against the data struct returned into `instruction` variable
    match instruction {
    MovieInstruction::AddMovieReview { title, rating, description } => {
        // Make a call to `add_move_review` function
        add_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Next, we’ll write the logic for the `add_movie_review` function that we’re calling in the code above. Notice, that we passed in the `program_id` , `accounts` , and the deserialized `instruction_data` to this function.

```rust
// Inside lib.rs
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

    // Logging instruction data that was passed in
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    Ok(())
  }
```
All we're doing for now is logging the data that was passed in. Now, you can build and deploy your program from SolPG just like in the last lesson. This will deploy your program to the same program id from the previous lesson if you went through the Hello World demo already. You can either upgrade your Hello World demo by just following the same steps as before or you can generate a new program id through SolPG and deploy to that one instead.

Test your program with [this script](https://github.com/ixmorrow/movie-review-pt1-testing-script/tree/master), make sure to paste the program id of your program into the script which you can see by going to Extra → Program Credentials in the ‘Build & Deploy’ page of the side bar! Check out the program [solution code](https://github.com/ixmorrow/movie-program-pt1) if you get stuck along the way

# Challenge

For this lessons challenge, try writing your own script to interact with the program you’ve just deployed!

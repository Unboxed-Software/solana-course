---
title: Create a Basic Program, Part 1 - Handle Instruction Data
objectives:
- Assign mutable and immutable variables in Rust
- Create and use Rust structs and enums
- Use Rust match statements
- Add implementations to Rust types
- Deserialize instruction data into Rust data types
- Execute different program logic for different types of instructions
- Explain the structure of a smart contract on Solana
---

# Summary

- Most programs support **multiple discrete instructions** - you decide when writing your program what these instructions are and what data must accompany them
- Rust **enums** are often used to represent discrete program instructions
- You can use the `borsh` crate and the `derive` attribute to provide Borsh deserialization and serialization functionality to Rust structs
- Rust `match` expressions help create conditional code paths based on the provided instruction

# Lesson

One of the most basic elements of a Solana program is the logic for handling instruction data. Most programs support multiple related functions and use differences in instruction data to determine which code path to execute. For example, two different data formats in the instruction data passed to the program may represent instructions for creating a new piece of data vs deleting the same piece of data.

Since instruction data is provided to your program's entry point as a byte array, it's common to create a Rust data type to represent instructions in a way that's more usable throughout your code. This lesson will walk through how to set up such a type, how to deserialize the instruction data into this format, and how to execute the proper code path based on the instruction passed into the program's entry point.

## Rust basics

Before we dive into the specifics of a basic Solana program, let's talk about the Rust basics we'll be using throughout this lesson.

### Variables

Variable assignment in Rust happens with the `let` keyword.

```rust
let age = 33;
```

Variables in Rust by default are immutable, meaning a variable's value cannot be changed once it has been set. To create a variable that we'd like to change at some point in the future, we use the `mut` keyword. Defining a variable with this keyword means that the value stored in it can change.

```rust
// compiler will throw error
let age = 33;
age = 34;

// this is allowed
let mut mutable_age = 33;
mutable_age = 34;
```

The Rust compiler guarantees that immutable variables truly cannot change so that you don’t have to keep track of it yourself. This makes your code easier to reason through and simplifies debugging.

### Structs

A struct, or structure, is a custom data type that lets you package together and name multiple related values that make up a meaningful group. Each piece of data in a struct can be of different types and each has a name associated with it. These pieces of data are called **fields**. They behave similarly to properties in other languages.

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

To use a struct after we’ve defined it, we create an instance of that struct by specifying concrete values for each of the fields.

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

To get or set a specific value from a struct, we use dot notation.

```rust
user1.age = 37;
```

### Enumerations

Enumerations (or Enums) are a data struct that allow you to define a type by enumerating its possible variants. An example of an enum may look like:

```rust
enum LightStatus {
    On,
    Off
}
```

The `LightStatus` enum has two possible variants in this situation: it's either `On` or `Off`.

You can also embed values into enum variants, similar to adding fields to a struct.

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

In this example, setting a variable to the `On` variant of `LightStatus` requires also setting the value of `color`.

### Match statements

Match statements are very similar to `switch` statements in C/C++. The `match` statement allows you to compare a value against a series of patterns and then execute code based on which pattern matches the value. Patterns can be made of literal values, variable names, wildcards, and more. The match statement must include all possible scenarios, otherwise the code will not compile.

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter
}

fn value_in_cents(coin: Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25
    }
}
```

### Implementations

The `impl` keyword is used in Rust to define a type's implementations. Functions and constants can both be defined in an implementation.

```rust
struct Example {
    number: i32
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

The function `boo` here can only be called on the type itself rather than an instance of the type, like so:

```rust
Example::boo();
```

Meanwhile, `answer` requires a mutable instance of `Example` and can be called with dot syntax:

```rust
let mut example = Example { number: 3 };
example.answer();
```

### Traits and attributes

You won't be creating your own traits or attributes at this stage, so we won't provide an in depth explanation of either. However, you will be using the `derive` attribute macro and some traits provided by the `borsh` crate, so it's important you have a high level understanding of each.

Traits describe an abstract interface that types can implement. If a trait defines a function `bark()` and a type then adopts that trait, the type must then implement the `bark()` function.

[Attributes](https://doc.rust-lang.org/rust-by-example/attribute.html) add metadata to a type and can be used for many different purposes.

When you add the [`derive` attribute](https://doc.rust-lang.org/rust-by-example/trait/derive.html) to a type and provide one or more supported traits, code is generated under the hood to automatically implement the traits for that type. We'll provide a concrete example of this shortly.

## Representing instructions as a Rust data type

Now that we've covered the Rust basics, let's apply them to Solana programs.

More often than not, programs will have more than one function. For example, you may have a program that acts as the backend for a note-taking app. Assume this program accepts instructions for creating a new note, updating an existing note, and deleting an existing note.

Since instructions have discrete types, they're usually a great fit for an enum data type.

```rust
enum NoteInstruction {
    CreateNote {
        title: String,
        body: String,
        id: u64
    },
    UpdateNote {
        title: String,
        body: String,
        id: u64
    },
    DeleteNote {
        id: u64
    }
}
```

Notice that each variant of the `NoteInstruction` enum comes with embedded data that will be used by the program to accomplish the tasks of creating, updating, and deleting a note, respectively.

## Deserialize instruction data

Instruction data is passed to the program as a byte array, so you need a way to deterministically convert that array into an instance of the instruction enum type.

In previous units, we used Borsh for client-side serialization and deserialization. To use Borsh program-side, we use the `borsh` crate. This crate provides traits for `BorshDeserialize` and `BorshSerialize` that you can apply to your types using the `derive` attribute.

To make deserializing instruction data simple, you can create a struct representing the data and use the `derive` attribute to apply the `BorshDeserialize` trait to the struct. This implements the methods defined in `BorshDeserialize`, including the `try_from_slice` method that we'll be using to deserialize the instruction data.

Remember, the struct itself needs to match the structure of the data in the byte array.

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

Once this struct has been created, you can create an implementation for your instruction enum to handle the logic associated with deserializing instruction data. It's common to see this done inside a function called `unpack` that accepts the instruction data as an argument and returns the appropriate instance of the enum with the deserialized data.

It's standard practice to structure your program to expect the first byte (or other fixed number of bytes) to be an identifier for which instruction the program should run. This could be an integer or a string identifier. For this example, we'll use the first byte and map integers 0, 1, and 2 to instructions create, update, and delete, respectively.

```rust
impl NoteInstruction {
    // Unpack inbound buffer to associated Instruction
    // The expected format for input is a Borsh serialized vector
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Take the first byte as the variant to
        // determine which instruction to execute
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // Use the temporary payload struct to deserialize
        let payload = NoteInstructionPayload::try_from_slice(rest).unwrap();
        // Match the variant to determine which data struct is expected by
        // the function and return the TestStruct or an error
        Ok(match variant {
            0 => Self::CreateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            1 => Self::UpdateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            2 => Self::DeleteNote {
                id: payload.id
            },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

There's a lot in this example so let's take it one step at a time:

1. This function starts by using the `split_first` function on the `input` parameter to return a tuple. The first element, `variant`, is the first byte from the byte array and the second element, `rest`, is the rest of the byte array.
2. The function then uses the `try_from_slice` method on `NoteInstructionPayload` to deserialize the rest of the byte array into an instance of `NoteInstructionPayload` called `payload`
3. Finally, the function uses a `match` statement on `variant` to create and return the appropriate enum instance using information from `payload`

Note that there is Rust syntax in this function that we haven't explained yet. The `ok_or` and `unwrap` functions are used for error handling and will be discussed in detail in another lesson.

## Program logic

With a way to deserialize instruction data into a custom Rust type, you can then use appropriate control flow to execute different code paths in your program based on which instruction is passed into your program's entry point.

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Call unpack to deserialize instruction_data
    let instruction = NoteInstruction::unpack(instruction_data)?;
    // Match the returned data struct to what you expect
    match instruction {
        NoteInstruction::CreateNote { title, body, id } => {
            // Execute program code to create a note
        },
        NoteInstruction::UpdateNote { title, body, id } => {
            // Execute program code to update a note
        },
        NoteInstruction::DeleteNote { id } => {
            // Execute program code to delete a note
        }
    }
}
```

For simple programs where there are only one or two instructions to execute, it may be fine to write the logic inside the match statement. For programs with many different possible instructions to match against, your code will be much more readable if the logic for each instruction is written in a separate function and simply called from inside the `match` statement.

## Program file structure

The [Hello World lesson’s](hello-world-program) program was simple enough that it could be confined to one file. But as the complexity of a program grows, it's important to maintain a project structure that remains readable and extensible. This involves encapsulating code into functions and data structures as we've done so far. But it also involves grouping related code into separate files.

For example, a good portion of the code we've worked through so far has to do with defining and deserializing instructions. That code should live in its own file rather than be written in the same file as the entry point. By doing so, we would then have 2 files, one with the program entry point and the other with the instruction code:

- **lib.rs**
- **instruction.rs**

Once you start splitting your program up like this you will need to make sure you register all of the files in one central location. We’ll be doing this in `lib.rs`. **You must register every file in your program like this.**

```rust
// This would be inside lib.rs
pub mod instruction;
```

Additionally, any declarations that you would like to be available through `use` statements in other files will need to be prefaced with the `pub` keyword:

```rust
pub enum NoteInstruction { ... }
```

# Lab

For this lesson’s lab, we’ll be building out the first half of the Movie Review program that we worked with in Module 1. This program stores movie reviews submitted by users.

For now, we'll focus on deserializing the instruction data. The following lesson will focus on the second half of this program.

### 1. Entry point

We’ll be using [Solana Playground](https://beta.solpg.io/) again to build out this program. Solana Playground saves state in your browser, so everything you did in the previous lesson may still be there. If it is, let's clear everything out from the current `lib.rs` file.

Inside lib.rs, we’re going to bring in the following crates and define where we’d like our entry point to the program to be with the `entrypoint` macro.

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::AccountInfo,
};

// Entry point is a function call process_instruction
entrypoint!(process_instruction);

// Inside lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {

    Ok(())
}
```

### 2. Deserialize instruction data

Before we continue with the processor logic, we should define our supported instructions and implement our deserialization function.

For readability, let's create a new file called `instruction.rs`. Inside this new file, add `use` statements for `BorshDeserialize` and `ProgramError`, then create a `MovieInstruction` enum with an `AddMovieReview` variant. This variant should have embedded values for `title,` `rating`, and `description`.

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
```

Next, define a `MovieReviewPayload` struct. This will act as an intermediary type for deserializtion so it should use the `derive` attribute macro to provide a default implementation for the `BorshDeserialize` trait.

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

Finally, create an implementation for the `MovieInstruction` enum that defines and implements a function called `unpack` that takes a byte array as an argument and returns a `Result` type. This function should:

1. Use the `split_first` function to split the first byte of the array from the rest of the array
2. Deserialize the rest of the array into an instance of `MovieReviewPayload`
3. Use a `match` statement to return the `AddMovieReview` variant of `MovieInstruction` if the first byte of the array was a 0 or return a program error otherwise

```rust
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

### 3. Program logic

With the instruction deserialization handled, we can return to the `lib.rs` file to handle some of our program logic.

Remember, since we added code to a different file, we need to register it in the `lib.rs` file using `pub mod instruction;`. Then we can add a `use` statement to bring the `MovieInstruction` type into scope.

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

Next, let's define a new function `add_movie_review` that takes as arguments `program_id`, `accounts`, `title`, `rating`, and `description`. It should also return an instance of `ProgramResult` Inside this function, let's simply log our values for now and we'll revisit the rest of the implementation of the function in the next lesson.

```rust
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

With that done, we can call `add_movie_review` from `process_instruction` (the function we set as our entry point). To pass all the required arguments to the function, we'll first need to call the `unpack` we created on `MovieInstruction`, then use a `match` statement to ensure that the instruction we've received is the `AddMovieReview` variant.

```rust
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

And just like that, your program should be functional enough to log the instruction data passed in when a transaction is submitted!

Build and deploy your program from Solana Program just like in the last lesson. If you haven't changed the program ID since going through the last lesson, it will automatically deploy to the same ID. If you'd like it to have a separate address you can generate a new program ID from the playground before deploying.

You can test your program by submitting a transaction with the right instruction data. For that, feel free to use [this script](https://github.com/Unboxed-Software/solana-movie-client) or [the frontend](https://github.com/Unboxed-Software/solana-movie-frontend) we built in the [Serialize Custom Instruction Data lesson](serialize-instruction-data). In both cases, make sure you copy and paste the program ID for your program into the appropriate area of the source code to make sure you're testing the right program.

If you need to spend some more time with this lab before moving on, please do! You can also have a look at the program [solution code](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) if you get stuck.

# Challenge

For this lesson's challenge, try replicating the Student Intro program from Module 1. Recall that we created a frontend application that lets students introduce themselves! The program takes a user's name and a short message as the `instruction_data` and creates an account to store the data onchain.

Using what you've learned in this lesson, build the Student Intro program to the point where you can print the `name` and `message` provided by the user to the program logs when the program is invoked.

You can test your program by building the [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data) we created in the [Serialize Custom Instruction Data lesson](serialize-instruction-data) and then checking the program logs on Solana Explorer. Remember to replace the program ID in the frontend code with the one you've deployed.

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://beta.solpg.io/62b0ce53f6273245aca4f5b0).


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=74a157dc-01a7-4b08-9a5f-27aa51a4346c)!
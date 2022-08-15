# Program Testing

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Describe various ways to test Solana programs
- Explain the difference between unit tests and integration tests
- Debug Solana programs

# TL;DR

- Testing is a **key component** of smart contract development because it ensures the code works as intended before releasing it to the public.
- Solana programs support all different types of doc tests, the most common being unit and integration tests.

# Overview

Testing in software is very common and there are actually entire career fields dedicated to just creating and running tests. A robust testing process can minimize the amount of bugs developers introduce into production code by catching them before they pose a real issue. You obviously cannot test *everything*, but it’s important to try to think of all the ways you can try to break your program or cause some unintended actions with your tests. This is especially imperative when developing smart contracts because a single bug can lead to millions of dollars lost or stolen.

Think back to what was discussed in the [Basic Security](./program-security.md) lesson. How can we write tests that determine if the security checks we've implemented actually work as intended and are sufficient? Program security and testing go hand in hand. To write good tests, it's helpful to think like an attacker. To reiterate some of what was discussed in that lesson, the goal is to not just "get the code working", but to ensure it works properly and is robust enough to properly handle malicious input.

The rust package manager, Cargo, natively has some tools built into it to help developers write their own automated tests. Whenever we make a new library project with `cargo new --lib`, a test module with a test function in it is automatically generated for us. You can run tests with Cargo with `cargo test-bpf`.

We'll be covering two types of tests in this lesson: unit tests and integration tests. *Unit tests* are small and more focused, testing one module in isolation at a time, and can test private interfaces. *Integration tests* are entirely external to your library and use your code in the same way any other external code would, using only the public interface and potentially exercising multiple modules per test.

## Unit tests

### What are unit tests?
The purpose of unit tests is to test each unit of code in isolation from the rest of the code to quickly pinpoint where code is and isn’t working as expected. Unit tests in Rust generally reside in the file with the code they are testing. Unit tests are declared inside a module named `tests` annotated with `cfg(test)`. At its simplest, a test in Rust is a function that’s annotated with the `#[test]` attribute.


```rust
// Example testing module with a single test
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
```

The `cfg` attribute stands for *configuration* and tells Rust that the following item should only be included given a certain configuration option. In this case, the `#[cfg(test)]` annotation tells Cargo to compile our test code only if we actively run the tests with `cargo test-bpf`. This way the testing code is not run when you call `cargo build` which saves on compile time.

Tests are defined in the `tests` module with the `#[test]` attribute. When running `cargo test-bpf`, every function inside this module marked as a test will be run. You can also create helper functions that are not tests in the module, just don’t annotate them with the `#[test]` attribute.

````rust
// Example testing module with a single test
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }

    fn helper_function() {
        doSomething()
    }
}
````

### How to build unit tests

To build unit tests in Rust, you will have to use the [`solana_sdk`](https://docs.rs/solana-sdk/latest/solana_sdk/) crate. This crate is essentially the same thing as the `@solana/web3.js` package that we’ve been using in Typescript and gives us a way to interact with Solana programs in Rust. Another crate that will be useful and was made specifically for testing Solana programs is [`solana_program_test`](https://docs.rs/solana-program-test/latest/solana_program_test/#) which contains a BanksClient-based testing framework.

A simple example of a unit test residing inside a `processor.rs` file may look like

```rust
// Inside processor.rs
#[cfg(test)]
mod tests {
    use {
        super::*,
        assert_matches::*,
        solana_program::instruction::{AccountMeta, Instruction},
        solana_program_test::*,
        solana_sdk::{signature::Signer, transaction::Transaction, signer::keypair::Keypair},
    };

    #[tokio::test]
    async fn it_works() {
        let program_id = Pubkey::new_unique();

        let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
            "program_name",
            program_id,
            processor!(process_instruction),
        )
        .start()
        .await;

        let test_acct = Keypair::new();

        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new(test_acct.pubkey(), true)
                ],
                data: vec![1, 2, 3],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer, &test_acct], recent_blockhash);

        assert_matches!(banks_client.process_transaction(transaction).await, Ok(_);
    }
}
```

In the code snippet, we created a public key to use as our `program_id` and then initialized a `ProgramTest`. The `banks_client` returned from the `ProgramTest` will act as our interface into the testing environment and the `payer` variable is a newly generated keypair with SOL that will be used to sign/pay for transactions. Then, we create a second `Keypair` and build our `Transaction` with the appropriate parameters. Finally, we used the `banks_client` that was returned when calling `ProgramTest::new` to process this transaction and check that the return value is equal to `Ok(_)`.

You'll notice the function is annotated with the `#[tokio::test]` attribute. [Tokio](https://docs.rs/tokio/1.7.1/tokio/index.html) is a Rust crate to help with writing asyncronous code. This just denotes our test function as async.

## Integration tests

### What are integration tests?

Integration tests on the other hand, are meant to be entirely external to the code they are testing. These tests are meant to interact with your code via its public interface in the manner that it’s intended to be accessed by others. Their purpose is to test whether many parts of your library work together correctly. Units of code that work correctly on their own could have problems when integrated, so test coverage of the integrated code is important as well.

### How to build integration tests with Rust
To create integration tests, you first need to create a `tests` directory at the top level of your project’s directory. We can then make as many test files as we want inside this `tests` directory, each file will act as its own integration test.

```rust
// Example of integration test inside /tests/integration_test.rs file
use example_lib;

#[test]
fn it_adds_two() {
    assert_eq!(4, example_lib::add_two(2));
}
```

Each file in the `tests` directory is a separate crate, so we will need to bring our library of code that we want to test into each file’s scope - that’s what the `use example_lib` line is doing.

We don’t need to annotate the tests in the `tests` directory with `#[cfg(test)]` because Cargo will only compile files inside the `tests` directory when we run `cargo test-bpf`. Cargo is pretty smart, right?

Once you have tests written (either unit, integration, or both), all you need to do is run `cargo test-bpf` and they will execute. A successful completion of a single unit and single integration test will output something like this to the command line.

```sh
cargo test
   Compiling adder v0.1.0 (file:///projects/adder)
    Finished test [unoptimized + debuginfo] target(s) in 1.31s
     Running unittests (target/debug/deps/adder-1082c4b063a8fbe6)

running 1 test
test tests::it_works ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/integration_test.rs (target/debug/deps/integration_test-1082c4b063a8fbe6)

running 1 test
test it_adds_two ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

   Doc-tests adder

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

The three sections of output include the unit tests, the integration test, and the doc tests. The doc tests are something that we won't conver in this lesson, but there is additional `Cargo` functionality to execute code examples in any documentation you might have in your code base. You can read more about this feature [here](https://doc.rust-lang.org/rust-by-example/testing/doc_testing.html).

As a side note, if the program you are testing creates a new account at all (i.e. creates a PDA), then the command `cargo test` will not work and the program will fail to complete with an error like the following.

```rust
Account data resizing not supported yet: 0 -> 1000. Consider making this test conditional on `#[cfg(feature = "test-bpf")]`
```

If you come across this, try using `cargo test-bpf` instead.

### How to build integration tests with Typescript

Solana programs support unit and integration tests in Rust like we just discussed, but you can also write integration tests with just about any language of your choosing. The alternative method to test your program is by deploying it to either Devnet or a local validator and sending transactions to it from some client that you created. Deploying to Devnet and then sending transactions to the program is essentially what we have been doing for the entirety of this course so you should be pretty familiar with that already. If you'd like a refresher, review the first lesson of this module which covered deploying to a local validator.

The most common way of conducting tests like this is by deploying to a local validator and writing a client testing script in Typescript using the [Mocha testing framework](https://mochajs.org/) paired with the [Chai assertion library](https://www.chaijs.com/). While these are a couple of the most common right now, it’s important to note that you can use just about any testing framework or any language for these tests as long as there are Solana SDKs available to use!

Install Mocha and Chai with `npm install mocha chai`

Then, you would add the following to the `package.json` file inside your Typescript project. This tells the compiler to execute the Typescript file or files inside the `/test` directory when the command `npm run test` is run. You’ll have to make sure the path here is the correct path to where your testing script is located.

```tsx
// Inside package.json
...
"scripts": {
        "test": "mocha -r ts-node/register ./test/*.ts"
    },
...
```

A test in Typescript with Mocha has a couple of new concepts involved. Mocha testing sections are declared with the `describe` keyword, which tells the compiler that mocha tests are inside of it.

```tsx
describe("begin tests", async () => {

    // Tests go here
    ...

})
```

Inside the `describe` section, each test is designated with `it`

```tsx
describe("begin tests", async () => {
    // First Mocha test
    it('first test', async () => {
            ...
        })
    // Second Mocha test
    it('second test', async () => {
        ...
    })
        ...
})
```

The Chai package is used to determine whether or not each test passes, it has an `expect` function that can easily compare values. You would use Chai to verify that whatever operation your test was supposed to execute returns the expected value or updated some data correctly.

```tsx
describe("begin tests", async () => {
    // First Mocha test
    it('first test', async () => {
        // Initialization code here to send the transaction
        ...
        // Fetch account info and deserialize
        const acct_info = await connection.getAccountInfo(pda)
        const acct = acct_struct.decode(acct_info.data)

        // Compare the value in the account to what you expect it to be
        chai.expect(acct.num).to.equal(1)
    })
})
```

Running `npm run test` will execute all of the tests inside the `describe` block and return something like this indicating whether or not each one has passed or failed.

```sh
> scripts@1.0.0 test
> mocha -r ts-node/register ./test/*.ts

    ✔ first test (1308ms)
    ✔ second test

    2 passing (1s)
```

## Debugging

When testing a program, you may run into errors or output that is unexpected, that’s where debugging comes into play. Debugging refers to the process of finding and resolving errors or unintended behavior of software programs.

### Error codes

When writing programs in general, it is inevitable that you will spend a good portion of your time debugging. There are program errors that you may come across from time to time and they can be a little confusing. Some program errors have a hexadecimal code associated with them which might not seem to make any sense at first. They look something along the lines of `Program [program_id] failed: custom program error: 0x01`. This error code is actually a hexadecimal representation of the error’s decimal index inside the error enum of the program that returned it. So, if an error is returned in your program with a hexadecimal code and no message, try converting that hexadecimal number *x* to decimal *y* and looking up the corresponding error at *y* index of the program’s error enum.

For example, if you were to receive an error sending a transaction to the SPL Token Program with the error code `0x01`, the decimal equivalent of this is 1. [Looking at the source code of the Token Program](https://github.com/solana-labs/solana-program-library/blob/master/token/program/src/error.rs), we can see that the error located at this index in the program's error enum is `InsufficientFunds`. You'll need to have access to the source code of any program that returns a custom program error code to translate it.

### Program logs

Another helpful tool when debugging is logging. Solana makes it very easy to create new custom logs with the `msg!()` macro and, as you’ve seen in this course, you can even log data from accounts inside the program. This is probably one of the most helpful tools when it comes to debugging because you can see exactly how your program is interacting with the accounts involved. You can see if it’s doing what is expected by logging data throughout the program.

When writing unit tests in Rust, you cannot use the `msg!()` macro to log information within the test itself. Instead you'll have to use the Rust native `println!()` macro. `msg!()` statements inside the program code will still work, you just can't log within the test with it.

### Compute budget

Developing on a blockchain comes with some unique constraints, one of those on Solana is the compute budget. Solana just recently moved from a per instruction compute budget to a transaction wide compute budget. The compute budget is meant to prevent a program from abusing resources. Every transaction has a budget of 1.4m compute units and different actions consume different amounts of compute units.

As an instruction executes and the program performs various actions, it consumes this compute budget by using up computation units. When the program consumes its entire budget or exceeds a bound, the runtime halts the program and returns an error. The function `sol_log_compute_units()` is available to use to print exactly how many compute units are remaining for the program to consume within the current instruction.

```rust
use solana_program::log::sol_log_compute_units;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {

    sol_log_compute_units();

...
}
```

For some more detailed information regarding the compute budget [check out the docs](https://docs.solana.com/developing/programming-model/runtime#compute-budget) or [this thread about the move from instruction to transaction wide compute budget](https://twitter.com/solana_devs/status/1528196015659966464?s=20&t=ET7_NhzJcjawMcJZKoRl6w).

### Stack size

Every program has access to [4KB of stack frame size when executing]("https://docs.solana.com/developing/on-chain-programs/overview#stack"). This is a different concept from the compute budget we just discussed because the stack size limit is focused solely on memory, while the compute budget is meant to limit computationally intensive actions. Many programming languages don’t require you to think about the stack and the heap very often. But in a systems programming language like Rust, whether a value is on the stack or the heap can make a large difference - especially when working within a constrained environment like a blockchain. If you aren't familiar with the differences between the two, [the Rust book has a great explanation](https://doc.rust-lang.org/stable/book/ch04-01-what-is-ownership.html).

All values in Rust are stack allocated by default. You'll start to run into issues with using up all of the 4KB of memory when working with larger, more complex programs. This is often called "blowing the stack", or [stack overflow](https://en.wikipedia.org/wiki/Stack_overflow). Programs can reach the stack limit two ways: either some dependent crates may include functionality that violates the stack frame restrictions, or the program itself can reach the stack limit at runtime.

This is an example of the error message you might see when the stack violation is originating from a dependent crate.

```text
Error: Function _ZN16curve25519_dalek7edwards21EdwardsBasepointTable6create17h178b3d2411f7f082E Stack offset of -30728 exceeded max offset of -4096 by 26632 bytes, please minimize large stack variables
```

If a program reaches it's 4KB stack at runtime, it will halt and return an `AccessViolation` error.

```text
Program failed to complete: Access violation in stack frame 3 at address 0x200003f70 of size 8 by instruction #5128
```

To get around this, you can either refactor your code to make it more memory efficient or allocate some memory to the heap instead. All programs have access to a 32KB runtime heap that can help you free up some memory on the stack. To do so, you'll have to make use of the [Box<T>](https://doc.rust-lang.org/std/boxed/struct.Box.html) struct. A box is a smart pointer to a heap allocated value of type `T`. Boxed values can be dereferenced using the `*` operator.

```rust
let authority_pubkey = Box::new(Pubkey::create_program_address(authority_signer_seeds, program_id)?);

if *authority_pubkey != *authority_info.key {
      msg!("Derived lending market authority {} does not match the lending market authority provided {}");
      return Err();
}
```

You simply wrap whatever variables you'd like to remove from the stack in the `Box` struct. The compiler will allocate memory on the heap, and place there the value of what's wrapped inside the `Box`.

In this example, the value returned from the `Pubkey::create_program_address`, which is just a public key, will be stored on the heap and the `authority_pubkey` variable will hold a pointer to the location on the heap where the public key is stored. You can read more about this in [the Rust book](https://doc.rust-lang.org/stable/book/ch15-01-box.html).

# Demo

Since we have basically been testing programs via a client or script for this whole course, this demo is going to focus on writing some unit tests in Rust. We'll be writing some tests for the Movie Review program that we've been working on. If you've been following along then you probably already have the starter code, as we'll just be picking up where we left off with the CPI lesson.

### 1. Clone starter code

No worries if you don't already have the code locally, you can [clone the starter code from Github](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens). Make sure to switch to the `solution-add-tokens` branch which is where we'll be starting from.

Once you have the repo cloned, go ahead and add this section to your `Cargo.toml` file.
```rust
[dev-dependencies]
assert_matches = "1.4.0"
solana-program-test = "~1.10.29"
solana-sdk = "~1.10.29"
```
### 2. Initialize testing framework

Now we’re going to focus on writing some unit tests for this program. Our tests will focus on whether or not the program works as intended when provided the proper data. We'll also test how it handles unexpected or malicious input. Remember, our goal when testing is to try to catch bugs and ensure security so it’s important to also write tests that are *supposed* to fail. We’re not just focused on testing if the code works, we’re also interested in testing the robustness of our code.

To get started, we’re going to add a `tests` module to the bottom of the `processor.rs` file and import the crates we will need.

```rust
// Inside processor.rs
#[cfg(test)]
mod tests {
  use {
    super::*,
    assert_matches::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        system_program::ID as SYSTEM_PROGRAM_ID,
    },
    solana_program_test::*,
    solana_sdk::{
        signature::Signer,
        transaction::Transaction,
        sysvar::rent::ID as SYSVAR_RENT_ID
    },
    spl_associated_token_account::{
        get_associated_token_address,
        instruction::create_associated_token_account,
    },
    spl_token:: ID as TOKEN_PROGRAM_ID,
  };
}
```

### 3. Helper function
It's common for unit tests to run in parallel and to keep state contained within their own scope. This means that there is no guarantee one test will run before another. Because of this, there will be some code that will have to be run before every test we write. Instead of writing this code out each time it's needed, we're just going to create a function to help facillitate that process.

Since the state will not be persisted from test to test, we will have to initialize a token mint in every test. The token mint is required in order to create a movie review or leave a comment now. The helper function should go somewhere inside the tests module so that the tests can call on it when needed. We'll be making use of the `solana_sdk` crate to help us do this.
```rust
// Inside the the tests modules
fn create_init_mint_ix(payer: Pubkey, program_id: Pubkey) -> (Pubkey, Pubkey, Instruction) {
  // Derive PDA for token mint authority
  let (mint, _bump_seed) = Pubkey::find_program_address(&[b"token_mint"], &program_id);
  let (mint_auth, _bump_seed) = Pubkey::find_program_address(&[b"token_auth"], &program_id);

  let init_mint_ix = Instruction {
      program_id: program_id,
      accounts: vec![
          AccountMeta::new_readonly(payer, true),
          AccountMeta::new(mint, false),
          AccountMeta::new(mint_auth, false),
          AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
          AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
          AccountMeta::new_readonly(SYSVAR_RENT_ID, false)
      ],
      data: vec![3]
  };

  (mint, mint_auth, init_mint_ix)
}
```
The function derives the token mint and mint authority PDAs, builds an `Instruction` with the appropriate info and returns a tuple containing the `mint` pubkey, `mint_auth` pubkey, and `init_mint_ix` object.

### 4. Initialize mint test
Next, we’ll declare our first unit test and initialize the testing environment. Our first test will focus on the `initialize_token_mint` instruction. We just wrote a helper function that builds an `Instruction` object for this, we can use that here.
```rust
// First unit test
#[tokio::test]
async fn test_initialize_mint_instruction() {
    let program_id = Pubkey::new_unique();
    let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
        "pda_local",
        program_id,
        processor!(process_instruction),
    )
    .start()
    .await;

    // Call helper function
    let (_mint, _mint_auth, init_mint_ix) = create_init_mint_ix(payer.pubkey(), program_id);

    // Create transaction object with instructions, accounts, and input data
    let mut transaction = Transaction::new_with_payer(
        &[init_mint_ix,],
        Some(&payer.pubkey()),
    );
    transaction.sign(&[&payer], recent_blockhash);

    // Process transaction and compare the result
    assert_matches!(banks_client.process_transaction(transaction).await, Ok(_));
}
```
Our helper function returns a tuple of the `mint` pubkey, `mint_auth` pubkey, and the `Instruction`. We won't need the `mint` or `mint_auth` pubkeys for this test, so we precede their values with the `_`. This is a Rust feature that tells the compiler we will not be using this variable. Once the instruction is put together, we can add it to a `Transaction` and use the `banks_client` generated from the `ProgramTest` constructor to process it.

We use the `assert_matches!` macro to determine if the test passes or not. If the transaction executes without an error, then the `initialize_token_mint` function in our program should return `Ok(())`. The `assert_matches!` macro makes sure that what is returned by `banks_client.process_transaction(transaction).await` is equal to what we expect.

### 5. Add movie review test

Our next unit test will target the `add_movie_review` instruction. The beginning of this test will look very similar to the previous test.

```rust
// Second unit test
#[tokio::test]
async fn test_add_movie_review_instruction() {
  let program_id = Pubkey::new_unique();
  let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
      "pda_local",
      program_id,
      processor!(process_instruction),
  )
  .start()
  .await;

  // Call helper function
  let (mint, mint_auth, init_mint_ix) = create_init_mint_ix(payer.pubkey(), program_id);
```
Next, we need to derive the review, comment counter, and user associated token account addresses.

```rust
// Create review PDA
let title: String = "Captain America".to_owned();
const RATING: u8 = 3;
let review: String = "Liked the movie".to_owned();
let (review_pda, _bump_seed) =
   Pubkey::find_program_address(&[payer.pubkey().as_ref(), title.as_bytes()], &program_id);

// Create comment PDA
let (comment_pda, _bump_seed) =
   Pubkey::find_program_address(&[review_pda.as_ref(), b"comment"], &program_id);

// Create user associate token account of token mint
let init_ata_ix: Instruction = create_associated_token_account(
   &payer.pubkey(),
   &payer.pubkey(),
   &mint,
);

let user_ata: Pubkey =
   get_associated_token_address(&payer.pubkey(), &mint);
```

Once we have all of the accounts initialized, we can put it all together into a single transaction.

```rust
// Concat data to single buffer
let mut data_vec = vec![0];
data_vec.append(
    &mut (TryInto::<u32>::try_into(title.len()).unwrap().to_le_bytes())
        .try_into()
        .unwrap(),
);
data_vec.append(&mut title.into_bytes());
data_vec.push(RATING);
data_vec.append(
    &mut (TryInto::<u32>::try_into(review.len())
        .unwrap()
        .to_le_bytes())
    .try_into()
    .unwrap(),
);
data_vec.append(&mut review.into_bytes());

// Create transaction object with instructions, accounts, and input data
let mut transaction = Transaction::new_with_payer(
    &[
    init_mint_ix,
    init_ata_ix,
    Instruction {
        program_id: program_id,
        accounts: vec![
            AccountMeta::new_readonly(payer.pubkey(), true),
            AccountMeta::new(review_pda, false),
            AccountMeta::new(comment_pda, false),
            AccountMeta::new(mint, false),
            AccountMeta::new_readonly(mint_auth, false),
            AccountMeta::new(user_ata, false),
            AccountMeta::new_readonly(SYSTEM_PROGRAM_ID, false),
            AccountMeta::new_readonly(TOKEN_PROGRAM_ID, false),
        ],
        data: data_vec,
    },
    ],
    Some(&payer.pubkey()),
);
transaction.sign(&[&payer], recent_blockhash);

// Process transaction and compare the result
assert_matches!(banks_client.process_transaction(transaction).await, Ok(_));
```
You can now run these tests with `cargo test-bpf`. If it’s successful, you’ll be able to see the program logs and the final test result in the terminal. It may take a while to compile and run the test. Feel free to take a look at the solution code here. [LINK]

# Challenge

As a challenge, build on top of what we just did and write some more unit tests that test the other instructions in the program. Also, think about how you can write some tests with malicious or inaccurate code that's supposed to return an error from the program.

# Program Testing

### List links for further reading here:

- [Solana Cookbook](https://github.com/ixmorrow/solana-program-unit-tests.git)
- [Rust Book - Testing](https://doc.rust-lang.org/book/ch11-00-testing.html)

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Understand all of the different ways how to test Solana programs
- Know the difference between unit tests, integration tests, and RPC tests
- Debug Solana programs

# TL;DR

- Testing is a **key component** of smart contract development, it ensures the code works as intended before releasing it to the public.
- Solana programs support three different types of tests (unit, integration, and client-side) all of which have a specific purpose.

# Overview

## Testing Concepts

Testing in software is very common and there are actually entire careers fields dedicated to just creating and running tests. A robust testing process can minimize the amount of bugs developers introduce into production code by catching them before they pose a real issue. You obviously cannot test *everything*, but it’s important to try to think of all the ways you can try to break your program or cause some unintended actions with your tests. This is especially imperative when developing smart contracts because a single bug can lead to millions of dollars lost or stolen.

### Tests in Rust

The rust package manager, Cargo, natively has some tools built into it to help developers write their own automated tests. Whenever we make a new library project with Cargo, a test module with a test function in it is automatically generated for us.

The Rust community thinks about tests in terms of two main categories: unit tests and integration tests. *Unit tests* are small and more focused, testing one module in isolation at a time, and can test private interfaces. *Integration tests* are entirely external to your library and use your code in the same way any other external code would, using only the public interface and potentially exercising multiple modules per test.

The purpose of unit tests is to test each unit of code in isolation from the rest of the code to quickly pinpoint where code is and isn’t working as expected. Unit tests reside in the `src` directory in the file with the code they are testing. Unit tests are declared inside a module named `tests` annotated with `cfg(test)`. At its simplest, a test in Rust is a function that’s annotated with the `#[test]` attribute.

```rust
// example testing module with a single testing function
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
```

The `cfg` attribute stands for *configuration* and tells Rust that the following item should only be included given a certain configuration option. In this case, the `#[cfg(test)]` annotation tells Cargo to compile our test code only if we actively run the tests with `cargo test`, this way the testing code is not run when you call `cargo build` which saves on compile time.

Tests are defined in the `tests` module with the `#[test]` attribute. When running `cargo test`, every function inside this module marked as a test will be run. You can also create helper functions that are not tests in the module, just don’t annotate them with the `#[test]` attribute.

Integration tests on the other hand, are meant to be entirely external to the code they are testing. These tests are meant to interact with your code via its public interface in the manner that it’s intended to be accessed by others. Their purpose is to test whether many parts of your library work together correctly. Units of code that work correctly on their own could have problems when integrated, so test coverage of the integrated code is important as well.

To create integration tests, you first need to create a `tests` directory at the top level of your project’s directory. We can then make as many test files as we want inside this `tests` directory, each file will act as its own integration test.

```rust
// example of integration test inside /tests/integration_test.rs file
use example_lib;

#[test]
fn it_adds_two() {
    assert_eq!(4, example_lib::add_two(2));
}
```

Each file in the `tests` directory is a separate crate, so we will need to bring our library of code that we want to test into each file’s scope - that’s what the `use example_lib` line is doing.

We don’t need to annotate the tests in the `tests` directory with `#[cfg(test)]` because Cargo will only compile files inside the `tests` directory when we run `cargo test`. Cargo is pretty smart, right?

Once you have tests written (either unit, integration, or both), all you need to do is run `cargo test-bpf` and they will execute. A successful completion of a single unit and single integration test will output something like this to the command line.

```
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

The three sections of output include the unit tests, the integration test, and the doc tests.

### RPC Tests

Solana programs support unit and integration tests in Rust like we just discussed, but there is also a third way to test your programs that is unique to smart contract development. The alternative method is to test your program is by deploying it to either devnet or a local validator and sending transactions to it from some client that you created. Deploying to devnet and then sending transactions to the program is essentially what we have been doing for the entirety of this course so you should be pretty familiar with that already and the first lesson of this module covered deploying to a local validator.

As a reminder, the Solana CLI has a command that, when run, will start a full-featured, single-node cluster on the your workstation that you can then deploy programs and submit transactions to. To start the local validator, simply run `solana-test-validator`.

When running a local validator, you will have to allow it to run in its own terminal window. Once it’s no longer needed, you can stop it with ctrl-c.

![local validator](../assets/local-validator.png)

To interact with a running local validator, open a new terminal and configure the CLI to target your local host.

```
solana config set --url localhost
```

Once set, go ahead and check your wallet balance `solana balance` and then airdrop yourself some tokens `solana airdrop 50`. There is no limit to the amount of tokens you can airdrop yourself on localhost, unlike devnet. You can even open a third terminal to monitor logs that your program generates with `msg!()` by running `solana logs`.

At this point, building and deploying your programs is the same as before, except now they are just deployed to your local computer and not devnet. To send transactions to programs deployed locally, you’ll have to ensure that whatever client you’re submitting the transaction from is targeting your local cluster.

```tsx
// in a Typescript client
// targeting your local host instead of devnet
const RPC_ENDPOINT_URL = "http://127.0.0.1:8899"
const commitment = 'confirmed'
const connection = new web3.Connection(RPC_ENDPOINT_URL, commitment)
```

When you’re done with local host, don’t forget to change the RPC configuration for your CLI and client back to whatever cluster you want to target! Forgetting that you changed these to local host can cause you a lot of pain and frustration down the road.

`solana config set --url devnet`

`const RPC_ENDPOINT_URL = "https://api.devnet.solana.com"`

Feel free to read up on the [Solana Test Validator docs](https://docs.solana.com/developing/test-validator).

## Building and Running Tests

### Rust Unit Tests

To build integration and unit tests in Rust, you will have to use the `[solana_sdk](https://docs.rs/solana-sdk/latest/solana_sdk/)` crate. This crate is essentially the same thing as the `@solana/web3.js` package that we’ve been using in Typescript and gives us a way to interact with Solana programs in Rust. There is another crate that will be useful and was made specifically for testing Solana programs, `[solana_program_test](https://docs.rs/solana-program-test/latest/solana_program_test/#)` contains a BanksClient-based testing framework.

A simple example of a unit test residing inside a `processor.rs` file may look like

```rust
// inside processor.rs
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
            "bpf_program_template",
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

        assert_matches!(banks_client.process_transaction(transaction).await, Ok(()));
    }
}
```

In the code snippet, we created a public key to use as our `program_id` and then initialized a `ProgramTest`. Then, we create a second `Keypair` and build our `Transaction` with the appropriate parameters. Finally, we use the `banks_client` that was returned when calling `ProgramTest::new` to process this transaction and check that the return value is equal to `Ok(())`. This is a very simple test, but from the code snippet you can see how you would go about creating more complex tests that involve more accounts and data similar to how you would client side.

### Rust Integration Tests

### RPC Tests

As stated before, you don’t have to write your unit tests in Rust - you can actually write them in just about any language you want by deploying the program to a cluster and submitting transactions from a client for the program to process. The most common way of conducting tests like this is by deploying to a local validator and writing a client testing script in Typescript using the [Mocha testing framework](https://mochajs.org/) paired with the [Chai assertion library](https://www.chaijs.com/) (it’s important to note that you can use just about any testing framework or any language for these tests, as long as there are Solana SDKs available to use).

Install mocha and chai with `npm install mocha chai`

Then, you would add the following to the `package.json` file inside your typescript project. This tells the compiler to execute the Typescript file or files inside the `/test` directory when the command `npm run test` is run. You’ll have to make sure the path here is the correct path to where your testing script is located.

```tsx
// inside package.json
...
"scripts": {
    "test": "mocha -r ts-node/register ./test/*.ts"
  },
...
```

A test in Typescript with Mocha has a couple of new concepts involved. Mocha testing sections are declared with `describe` which tells the compiler that mocha tests are inside of it.

```tsx
describe("begin tests", async () => {

	// tests go here
	...

})
```

Inside the `describe` section, each test is designated with `it` like so

```tsx
describe("begin tests", async () => {
    // first Mocha test
    it('first test', async () => {
			...
		})
		// second Mocha test
		it('second test', async () => {
			...
		})
		...
})
```

The Chai package is used to determine whether or not each test passes, it has an `expect` function that can easily compare values. You would use Chai to verify that whatever operation your test was supposed to execute returns the expected value.

```tsx
describe("begin tests", async () => {
    // first Mocha test
    it('first test', async () => {
				// initialization code here to send the transaction
				...
				// fetch account info and deserialize
        const acct_info = await connection.getAccountInfo(pda)
        const acct = acct_struct.decode(acct_info.data)

        // compare the value in the account to what you expect it to be
        chai.expect(acct.num).to.equal(1)
    })
})
```

Running `npm run test` will execute all of the tests inside the `describe` block and return something like this indicating whether or not each one has passed or failed.

```
> scripts@1.0.0 test
> mocha -r ts-node/register ./test/*.ts

  ✔ first test (1308ms)
  ✔ second test

  2 passing (1s)
```

## Debugging

When testing a program, you may run into errors or output that is unexpected, that’s where debugging comes into play. Debugging refers to the process of finding and resolving errors or unintended behavior of software programs.

### Error Codes

When writing programs in general, it is inevitable that you will spend a good portion of your time debugging. There are program errors that you may come across from time to time and they can be a little confusing. Some program errors have a hexadecimal code associated with them that looks something along the lines of `0xa4` which might not seem to make any sense. This error code is actually a hexadecimal representation of this error’s decimal index inside the error enum of the program that returned it. So, if an error is returned in your program with a hexadecimal code and no message, try converting that hexadecimal number *x* to decimal *y* and looking up the corresponding error at *y* index of the program’s error enum.

### Program Logs

Another helpful tool when debugging is logging. Solana makes it very easy to create new custom logs with the `msg!()` macro and, as you’ve seen in this course, you can even log data from accounts inside the program. This is probably one of the most helpful tools when it comes to debugging because you can see exactly how your program is interacting with the accounts involved and if it’s doing what is expected by logging data throughout the program.

### Compute Budget

Developing on a blockchain comes with some unique constraints, one of those on Solana is the compute budget. All Solana transactions are restricted to a per instruction compute budget (with plans of moving this to a per transaction basis), the compute budget is meant to prevent a program from abusing resources. Every instruction has a budget of 200,000 compute units and different actions consume different amounts of compute units.

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

The compute budget is not to be confused with the amount of memory allocated on the stack for each instruction, which is something entirely different.

For some more detailed information regarding the compute budget [check out the docs](https://docs.solana.com/developing/programming-model/runtime#compute-budget).

# Demo

Since we have basically been testing programs via a client or script for this whole course, this demo is going to focus on writing unit and integration tests in Rust. We’ll be working with a very simple program that creates a PDA and then initializes some value in the PDA’s data field given the right parameters.

### 1. Clone starter code

We’ve written the test program available for you [in this repo](https://github.com/ixmorrow/solana-program-testing/tree/starter-code). Clone it to your local machine and take a look at the program code in the `processor` file. You can see it’s a fairly short and straightforward program. There are a couple of validation checks on the accounts passed in and then the program creates and writes some data to a PDA.

### 2. Write Unit Tests

Now we’re going to focus on writing some unit tests for this program. Our tests will focus on whether or not the program works as intended when the provided the proper data, as well as how it handles unexpected or malicious input. Remember, our goal when testing is to try to catch bugs and ensure security so it’s important to also write tests that are *supposed* to fail. We’re not just focused on testing if the code works, we’re also interested in testing the robustness of our code.

To get started, we’re going to declare a section of the `processor.rs` file for testing and import the necessary crates.

```tsx

// inside processor.rs
#[cfg(test)]
mod tests {
    use {
        super::*,
        assert_matches::*,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program
        },
        solana_program_test::*,
        solana_sdk::{signature::Signer, transaction::Transaction},
    };


}
```

Next, we’ll declare our first unit test and initialize the testing environment.

```tsx

#[cfg(test)]
mod tests {
    use {
        super::*,
        assert_matches::*,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program
        },
        solana_program_test::*,
        solana_sdk::{signature::Signer, transaction::Transaction},
    };

// first unite test
    #[tokio::test]
    async fn it_works() {
        let program_id = Pubkey::new_unique();

        let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
            "adder",
            program_id,
            processor!(process_instruction),
        )
        .start()
        .await;
    }
}
```

Our first unit test will test whether or not our program is actually functioning as intended, to test this we’ll need to create a transaction to submit to the the program.

```tsx
#[tokio::test]
    async fn it_works() {
        let program_id = Pubkey::new_unique();

        let (mut banks_client, payer, recent_blockhash) = ProgramTest::new(
            "adder",
            program_id,
            processor!(process_instruction),
        )
        .start()
        .await;
// derive pda
        let (pda, _bump_seed) = Pubkey::find_program_address(
            &[payer.pubkey().as_ref()],
            &program_id,
        );

// create transaction object with accounts and input data
        let mut transaction = Transaction::new_with_payer(
            &[Instruction {
                program_id,
                accounts: vec![
                    AccountMeta::new(payer.pubkey(), true),
                    AccountMeta::new(pda, false),
                    AccountMeta::new_readonly(system_program::id(), false)
                ],
                data: vec![1, 2, 3],
            }],
            Some(&payer.pubkey()),
        );
        transaction.sign(&[&payer], recent_blockhash);

// process transaction and compare the result
        assert_matches!(banks_client.process_transaction(transaction).await, Ok(_));
    }
```

You can now run this test with `cargo test-bpf` and if it’s successful, you’ll be able to see the program logs and the final test result in the terminal.

```
running 1 test
[2022-07-19T06:00:17.783298400Z DEBUG solana_runtime::message_processor::stable_log] Program 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM invoke [1]
[2022-07-19T06:00:17.788441600Z DEBUG solana_runtime::message_processor::stable_log] Program log: process_instruction: 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM: 3 accounts, data=[1, 2, 3]
[2022-07-19T06:00:17.791927800Z DEBUG solana_runtime::message_processor::stable_log] Program log: Initializer pubkey: UDuNN6qeSNVhBhPe6hyMVuV187do6fLyxC63TSvPNFa
[2022-07-19T06:00:17.802666900Z DEBUG solana_runtime::message_processor::stable_log] Program log: PDA pubkey: HMbsQRL7BCJrmVuoFFbqjF7bxJ8h2bYRY399H3e7zw3J
[2022-07-19T06:00:17.803613000Z DEBUG solana_runtime::message_processor::stable_log] Program 11111111111111111111111111111111 invoke [2]
[2022-07-19T06:00:17.803708800Z TRACE solana_runtime::system_instruction_processor] process_instruction: CreateAccount { lamports: 7850880, space: 1000, owner: 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM }
[2022-07-19T06:00:17.808716100Z DEBUG solana_runtime::message_processor::stable_log] Program 11111111111111111111111111111111 success
[2022-07-19T06:00:17.809164200Z DEBUG solana_runtime::message_processor::stable_log] Program log: PDA data: 1
[2022-07-19T06:00:17.809320600Z DEBUG solana_runtime::message_processor::stable_log] Program 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM consumed 42911 of 200000 compute units
[2022-07-19T06:00:17.809480100Z DEBUG solana_runtime::message_processor::stable_log] Program 4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM success
test processor::tests::it_works ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.93s
```

# Challenge

*Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently.*

1. Challenge instruction one
2. Challenge instruction two

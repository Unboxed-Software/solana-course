---
title: Intro to Anchor development
objectives:
- Use the Anchor framework to build a basic program
- Describe the basic structure of an Anchor program
- Explain how to implement basic account validation and security checks with Anchor
---

# Summary

- **Anchor** is a framework for building Solana programs
- **Anchor macros** speed up the process of building Solana programs by abstracting away a significant amount of boilerplate code
- Anchor allows you to build **secure programs** more easily by performing certain security checks, requiring account validation, and providing a simple way to implement additional checks.

# Lesson

## What is Anchor?

Anchor makes writing Solana programs easier, faster, and more secure, making it the "go-to" framework for Solana development. It makes it easier to organize and reason about your code, implements common security checks automatically, and removes a significant amount of boilerplate code that is otherwise associated with writing a Solana program.

## Anchor program structure

Anchor uses macros and traits to generate boilerplate Rust code for you. These provide a clear structure to your program so you can more easily reason about your code. The main high-level macros and attributes are:

- `declare_id` - a macro for declaring the program’s onchain address
- `#[program]` - an attribute macro used to denote the module containing the program’s instruction logic
- `Accounts` - a trait applied to structs representing the list of accounts required for an instruction
- `#[account]` - an attribute macro used to define custom account types for the program

Let's talk about each of them before putting all the pieces together.

## Declare your program ID

The `declare_id` macro is used to specify the onchain address of the program (i.e. the `programId`). When you build an Anchor program for the first time, the framework will generate a new keypair. This becomes the default keypair used to deploy the program unless specified otherwise. The corresponding public key should be used as the `programId` specified in the `declare_id!` macro.

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## Define instruction logic

The `#[program]` attribute macro defines the module containing all of your program's instructions. This is where you implement the business logic for each instruction in your program.

Each public function in the module with the `#[program]` attribute will be treated as a separate instruction.

Each instruction function requires a parameter of type `Context` and can optionally include additional function parameters representing instruction data. Anchor will automatically handle instruction data deserialization so that you can work with instruction data as Rust types.

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

### The `context` argument

The `context` argument allows you to access instruction metadata and accounts to your instruction handler:

- The program ID (`ctx.program_id`) of the executing program
- The accounts passed into the instruction (`ctx.accounts`)
- The remaining accounts (`ctx.remaining_accounts`). The `remaining_accounts` is a vector that contains all accounts that were passed into the instruction but are not declared in the `Accounts` struct.
- The bumps for any PDA accounts in the `Accounts` struct (`ctx.bumps`)

## Define instruction accounts

The `Accounts` trait defines a data structure of validated accounts. Structs adopting this trait define the list of accounts required for a given instruction. These accounts are then exposed through an instruction's `Context` so that manual account iteration and deserialization is no longer necessary.

You typically apply the `Accounts` trait through the `derive` macro (e.g. `#[derive(Accounts)]`). This implements an `Accounts` deserializer on the given struct and removes the need to deserialize each account manually.

Implementations of the `Accounts` trait are responsible for performing all requisite constraint checks to ensure the accounts meet the conditions required for the program to run securely. Constraints are provided for each field using the `#account(..)` attribute (more on that shortly).

For example, `instruction_one` requires a `Context` argument of type `InstructionAccounts`. The `#[derive(Accounts)]` macro is used to implement the `InstructionAccounts` struct which includes three accounts: `account_name`, `user`, and `system_program`.

```rust
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		...
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}
```

When `instruction_one` is invoked, the program:

- Checks that the accounts passed into the instruction match the account types specified in the `InstructionAccounts` struct
- Checks the accounts against any additional constraints specified

If any accounts passed into `instruction_one` fail the account validation or security checks specified in the `InstructionAccounts` struct, then the instruction fails before even reaching the program logic.

## Account validation

You may have noticed in the previous example that one of the accounts in `InstructionAccounts` was of type `Account`, one was of type `Signer`, and one was of type `Program`.

Anchor provides a number of account types that can be used to represent accounts. Each type implements different account validation. We’ll go over a few of the common types you may encounter, but be sure to look through the [full list of account types](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

### `Account`

`Account` is a wrapper around `AccountInfo` that verifies program ownership and deserializes the underlying data into a Rust type.

```rust
// Deserializes this info
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    // <---- deserializes account data
    pub owner: &'a Pubkey,    // <---- checks owner program
    pub executable: bool,
    pub rent_epoch: u64,
}
```

Recall the previous example where `InstructionAccounts` had a field `account_name`:

```rust
pub account_name: Account<'info, AccountStruct>
```

The `Account` wrapper here does the following:

- Deserializes the account `data` in the format of type `AccountStruct`
- Checks that the program owner of the account matches the program owner specified for the `AccountStruct` type.

When the account type specified in the `Account` wrapper is defined within the same crate using the `#[account]` attribute macro, the program ownership check is against the `programId` defined in the `declare_id!` macro.

The following are the checks performed:

```rust
// Checks
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

The `Signer` type validates that the given account signed the transaction. No other ownership or type checks are done. You should only use the `Signer` when the underlying account data is not required in the instruction.

For the `user` account in the previous example, the `Signer` type specifies that the `user` account must be a signer of the instruction.

The following check is performed for you:

```rust
// Checks
Signer.info.is_signer == true
```

### `Program`

The `Program` type validates that the account is a certain program.

For the `system_program` account in the previous example, the `Program` type is used to specify the program should be the system program. Anchor provides a `System` type which includes the `programId` of the system program to check against.

The following checks are performed for you:

```rust
//Checks
account_info.key == expected_program
account_info.executable == true
```

## Add constraints with `#[account(..)]`

The `#[account(..)]` attribute macro is used to apply constraints to accounts. We'll go over a few constraint examples in this and future lessons, but at some point be sure to look at the full [list of possible constraints](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html).

Recall again the `account_name` field from the `InstructionAccounts` example. 

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

Notice that the `#[account(..)]` attribute contains three comma-separated values:

- `init` - creates the account via a CPI to the system program and initializes it (sets its account discriminator)
- `payer` - specifies the payer for the account initialization to be the `user` account defined in the struct
- `space`- specifies that the space allocated for the account should be `8 + 8` bytes. The first 8 bytes are for a discriminator that Anchor automatically adds to identify the account type. The next 8 bytes allocate space for the data stored on the account as defined in the `AccountStruct` type.

For `user` we use the `#[account(..)]` attribute to specify that the given account is mutable. The `user` account must be marked as mutable because lamports will be deducted from the account to pay for the initialization of `account_name`.

```rust
#[account(mut)]
pub user: Signer<'info>,
```

Note that the `init` constraint placed on `account_name` automatically includes a `mut` constraint so that both `account_name` and `user` are mutable accounts.

## `#[account]`

The `#[account]` attribute is applied to structs representing the data structure of a Solana account. It implements the following traits:

- `AccountSerialize`
- `AccountDeserialize`
- `AnchorSerialize`
- `AnchorDeserialize`
- `Clone`
- `Discriminator`
- `Owner`

You can read more about the [details of each trait](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). However, mostly what you need to know is that the `#[account]` attribute enables serialization and deserialization, and implements the discriminator and owner traits for an account.

The discriminator is an 8-byte unique identifier for an account type derived from the first 8 bytes of the SHA256 hash of the account type's name. The first 8 bytes are reserved for the account discriminator when implementing account serialization traits (which is almost always in an Anchor program). 

As a result, any calls to `AccountDeserialize`’s `try_deserialize` will check this discriminator. If it doesn’t match, an invalid account was given, and the account deserialization will exit with an error.

The `#[account]` attribute also implements the `Owner` trait for a struct using the `programId` declared by `declareId` of the crate `#[account]` is used in. In other words, all accounts initialized using an account type defined using the `#[account]` attribute within the program are also owned by the program.

As an example, let's look at `AccountStruct` used by the `account_name` of `InstructionAccounts`

```rust
#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    ...
}

#[account]
pub struct AccountStruct {
    data: u64
}
```

The `#[account]` attribute ensures that it can be used as an account in `InstructionAccounts`.

When the `account_name` account is initialized:

- The first 8 bytes is set as the `AccountStruct` discriminator
- The data field of the account will match `AccountStruct`
- The account owner is set as the `programId` from `declare_id`

## Bring it all together

When you combine all of these Anchor types you end up with a complete program. Below is an example of a basic Anchor program with a single instruction that:

- Initializes a new account
- Updates the data field on the account with the instruction data passed into the instruction

```rust
// Use this import to gain access to common anchor features
use anchor_lang::prelude::*;

// Program onchain address
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Instruction logic
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
        ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

// Validate incoming accounts for instructions
#[derive(Accounts)]
pub struct InstructionAccounts<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}

// Define custom program account type
#[account]
pub struct AccountStruct {
    data: u64
}
```

You are now ready to build your own Solana program using the Anchor framework!

# Lab

Before we begin, install Anchor by [following the steps from the Anchor docs](https://www.anchor-lang.com/docs/installation).

For this lab we'll create a simple counter program with two instructions:

- The first instruction will initialize an account to store our counter
- The second instruction will increment the count stored in the counter

### 1. Setup

Create a new project called `anchor-counter` by running `anchor init`:

```console
anchor init anchor-counter
```

Change into the new directory, then run `anchor build`

```console
cd anchor-counter
anchor build
```

Anchor build will also generate a keypair for your new program - the keys are saved in the `target/deploy` directory.

Open the file `lib.rs` and look at `declare_id!`: 

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

Run `anchor keys sync`

```console
anchor keys sync
```

You'll see the Anchor updates both:

 - The key used in `declare_id!()` in `lib.rs` 
 - The key in `Anchor.toml` 

To match the key generated during `anchor build`:

```console
Found incorrect program id declaration in "anchor-counter/programs/anchor-counter/src/lib.rs"
Updated to BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr

Found incorrect program id declaration in Anchor.toml for the program `anchor_counter`
Updated to BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr

All program id declarations are synced.
```

Finally, delete the default code in `lib.rs` until all that is left is the following:

```rust
use anchor_lang::prelude::*;

declare_id!("your-private-key");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

### 2. Add the `initialize` instruction

First, let’s implement the `initialize` instruction within `#[program]`. This instruction requires a `Context` of type `Initialize` and takes no additional instruction data. In the instruction logic, we are simply setting the `counter` account’s `count` field to `0`.

```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Counter Account Created");
    msg!("Current Count: { }", counter.count);
    Ok(())
}
```

### 3. Implement `Context` type `Initialize`

Next, using the `#[derive(Accounts)]` macro, let’s implement the `Initialize` type that lists and validates the accounts used by the `initialize` instruction. It'll need the following accounts:

- `counter` - the counter account initialized in the instruction
- `user` - payer for the initialization
- `system_program` - the system program is required for the initialization of any new accounts

```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Implement `Counter`

Next, use the `#[account]` attribute to define a new `Counter` account type. The `Counter` struct defines one `count` field of type `u64`. This means that we can expect any new accounts initialized as a `Counter` type to have a matching data structure. The `#[account]` attribute also automatically sets the discriminator for a new account and sets the owner of the account as the `programId` from the `declare_id!` macro.

```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Add `increment` instruction

Within `#[program]`, let’s implement an `increment` instruction to increment the `count` once a `counter` account is initialized by the first instruction. This instruction requires a `Context` of type `Update` (implemented in the next step) and takes no additional instruction data. In the instruction logic, we are simply incrementing an existing `counter` account’s `count` field by `1`.

```rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Previous counter: {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Counter incremented. Current count: {}", counter.count);
    Ok(())
}
```

### 6. Implement `Context` type `Update`

Lastly, using the `#[derive(Accounts)]` macro again, let’s create the `Update` type that lists the accounts that the `increment` instruction requires. It'll need the following accounts:

- `counter` - an existing counter account to increment
- `user` - payer for the transaction fee

Again, we’ll need to specify any constraints using the `#[account(..)]` attribute:

```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

### 7. Build

All together, the complete program will look like this:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter account created. Current count: {}", counter.count);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        msg!("Previous counter: {}", counter.count);
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented. Current count: {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
}
```

Run `anchor build` to build the program.

### 8. Testing

Anchor tests are typically Typescript integration tests that use the mocha test framework. We'll learn more about testing later, but for now navigate to `anchor-counter.ts` and replace the default test code with the following:

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { AnchorCounter } from "../target/types/anchor_counter"

describe("anchor-counter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>

  const counter = anchor.web3.Keypair.generate()

  it("Is initialized!", async () => {})

  it("Incremented the count", async () => {})
})
```

The above code generates a new keypair for the `counter` account we'll be initializing and creates placeholders for a test of each instruction.

Next, create the first test for the `initialize` instruction:

```typescript
it("Is initialized!", async () => {
  // Add your test here.
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber()).to.equal(0)
})
```

Next, create the second test for the `increment` instruction:

```typescript
it("Incremented the count", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber()).to.equal(1)
})
```

Lastly, run `anchor test` and you should see the following output:

```console
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

Running `anchor test` automatically spins up a local test validator, deploys your program, and runs your mocha tests against it. Don't worry if you're confused by the tests for now - we'll dig in more later.

Congratulations, you just built a Solana program using the Anchor framework! Feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment) if you need some more time with it.

# Challenge

Now it’s your turn to build something independently. Because we're starting with simple programs, yours will look almost identical to what we just created. It's useful to try and get to the point where you can write it from scratch without referencing prior code, so try not to copy and paste here.

1. Write a new program that initializes a `counter` account
2. Implement both an `increment` and `decrement` instruction
3. Build and deploy your program like we did in the lab
4. Test your newly deployed program and use Solana Explorer to check the program logs

As always, get creative with these challenges and take them beyond the basic instructions if you want - and have fun!

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=334874b7-b152-4473-b5a5-5474c3f8f3f1)!

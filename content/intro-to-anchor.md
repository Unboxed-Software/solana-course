# Anchor Program Structure

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Use the Anchor framework to build a basic program
- Describe the basic structure of an Anchor program
- Explain how to implement basic account validation and security checks with Anchor

# TL;DR

- **Anchor** is a framework for building Solana programs
- **Anchor** macros speed up the process of building Solana programs by abstracting away a significant amount of boilerplate code
- **Anchor** allows you to build secure programs more easily by performing certain security checks, requiring account validation, and providing a simple way to implement additional checks.

# Overview

## What is Anchor?

Anchor is a framework for building Solana programs. The Anchor framework organizes a program into distinct sections that separates the instruction logic from account validation and security checks.

Anchor also enables you to quickly build Solana programs by abstracting away various tasks such as the serialization and deserialization accounts and instruction data. This is accomplished by bundling boilerplate code into macros, allowing you to focus on the business logic of your program. Additionally, Anchor is designed to inherently handle many common security checks while allowing you to easily define additional checks to help you build more secure programs.

## Anchor program structure

An Anchor program has four basic sections

- `declare_id!` - the program’s on-chain address
- `#[program]` - the program’s instruction logic
- `#[derive(Accounts)]` - list, validate, and deserialize accounts passed into an instruction
- `#[account]` - define custom account types for the program

Below is an example of a basic Anchor program with a single instruction that:

- Initializes a new account
- Updates the data field on the account with the instruction data passed into the instruction

```rust
// Use this import to gain access to common anchor features
use anchor_lang::prelude::*;

// Program on-chain address
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

## `declare_id!`

The `declare_id!` macro is used to specify the on-chain address of the program (i.e. the `programId`). A new keypair is generated when an Anchor program is built for the first time. This keypair will be the default keypair used to deploy the program unless specified otherwise. The corresponding publickey is used as the `programId` specified in the `declare_id!` macro.

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## `#[program]`

The `#[program]` attribute defines the module containing all the program instructions. This is where you implement the business logic for each instruction in your program. In an Anchor program, account validation and security checks are generally separated from the instruction logic.

If your instructions require instruction data, include additional function parameters after the context argument. Anchor will then automatically deserialize the instruction data.

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

...
```

### Instruction `Context`

All Anchor instructions require a `Context` type as the first parameter. The instruction `Context` is used to specify the accounts an instruction requires.

```rust
pub struct Context<'a, 'b, 'c, 'info, T> {
    /// Currently executing program id.
    pub program_id: &'a Pubkey,
    /// Deserialized accounts.
    pub accounts: &'b mut T,
    /// Remaining accounts given but not deserialized or validated.
    /// Be very careful when using this directly.
    pub remaining_accounts: &'c [AccountInfo<'info>],
    /// Bump seeds found during constraint validation. This is provided as a
    /// convenience so that handlers don't have to recalculate bump seeds or
    /// pass them in as arguments.
    pub bumps: BTreeMap<String, u8>,
}
```

The `Context` type `T` defines the list of accounts an instruction requires. Through this context argument the instruction can then access:

- The accounts passed into the instruction (`ctx.accounts`)
- The program id (`ctx.program_id`) of the executing program
- The remaining accounts (`ctx.remaining_accounts`). The `remaining_accounts` is a vector that contains all accounts that were passed into the instruction but are not declared in the `Accounts` struct.
- The bumps for any PDAs accounts (`ctx.bumps`)

Next, let’s discuss how a `Context` type is implemented in an Anchor program using the `Accounts` trait.

## `#[derive(Accounts)]`

The `Accounts` trait is a data structure of validated accounts that can be deserialized from the instruction `Context` to a program.

With Anchor, you no longer have to manually deserialize the `AccountInfo` for each account. The `#[derive(Accounts)]` macro implements an `Accounts` deserializer on the given struct. Implementations of the `Accounts` trait also performs all requisite constraint checks to ensure the accounts meet conditions required for the program to run securely.

For example, `instruction_one` requires a `Context` argument of type `InstructionAccounts`. The `#[derive(Accounts)]` macro is used to implement the `InstructionAccounts` struct which includes three accounts: `account_name`, `user`, `system_program`.

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

In the next sections we’ll discuss how basic account validation and additional constraints are implemented in an Anchor program.

## Account Validation

Anchor provides a list of Account types that can be used in the account validation struct. We’ll go over a few of the common types you may encounter, but feel free to look through the full list of Account types that can be used in the account validation struct [here](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html).

### `Account`

`Account` is a wrapper around `AccountInfo` that verifies program ownership and deserializes the underlying data into a Rust type.

```rust
// Deserializes this info
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    <---- deserializes account data
    pub owner: &'a Pubkey,    <---- checks owner program
    pub executable: bool,
    pub rent_epoch: u64,
}
```

For the `account_name` account, the `Account` wrapper:

- Deserializes the account `data` in the format of type `AccountStruct`
- Checks the program owner of the account matches the program owner specified for the `AccountStruct` type.

When the account type specified in the `Account` wrapper is defined within the same crate using the `#[account]` macro, the program ownership check is against the `programId` defined in the `declare_id!` macro.

```rust
pub account_name: Account<'info, AccountStruct>,
```

```rust
// Checks
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

The `Signer` type validates that an account signed the transaction. No other ownership or type checks are done. The `Signer` type is used if the underlying account data is not required in the instruction.

For the `user` account, the `Signer` type is used to specify that the `user` account must be a signer of the instruction.

```rust
pub user: Signer<'info>,
```

```rust
// Checks
Signer.info.is_signer == true
```

### `Program`

The `Program` type validates that the account is a certain program.

For the `system_program` account, the `Program` type is used to specify the program should be the system program. Anchor provides a `System` type which includes the `programId` of the system program to check against.

```rust
pub system_program: Program<'info, System>
```

```rust
//Checks
account_info.key == expected_program
account_info.executable == true
```

Next, we’ll discuss how to provide further functionality through the use of the `#[account(..)]` attribute.

## `#[account(...)]`

The `#[account(..)]` attribute is used to apply different types of constraints to accounts. You can look over the full list of constraints that can be applied with the `#[account(..)]` attribute [here](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html). We’ll go over a few examples here and discuss constraints more in depth in a later lesson.

For `account_name`, we can see that the `#[account(..)]` attribute specifies the following:

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

- `init` - creates the account via a CPI to the system program and initializes it (sets its account discriminator)
- `payer` - specifies `payer` for the initialization as the `user` account defined in the struct
- `space`- specifies the `space` allocated for the account is 8 + 8 bytes. The first 8 bytes is a discriminator that Anchor automatically adds to identify the account type. The next 8 bytes allocates space for the data stored on the account as defined in the `AccountStruct` type.

For `user` we use the `#[account(..)]` attribute to specify that the given account is mutable. The `user` account must be marked as mutable because lamports will be deducted from the account to pay for the initialization of `account_name`.

```rust
#[account(mut)]
pub user: Signer<'info>,
```

Lastly, let’s go over the `#[account]` attribute.

## `#[account]`

The `#[account]` attribute is used to represent the data structure of a Solana account and implements the following traits:

- `AccountSerialize`
- `AccountDeserialize`
- `AnchorSerialize`
- `AnchorDeserialize`
- `Clone`
- `Discriminator`
- `Owner`

You can read more about the details of each trait [here](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). In summary, the `#[account]` attribute enables serialization and deserialization, and implements the discriminator and owner traits for an account.

The discriminator is an 8 byte unique identifier for an account type and derived from first 8 bytes of the SHA256 hash of the account type's name. When implementing account serialization traits the first 8 bytes are reserved for the account discriminator.

As a result, any calls to `AccountDeserialize`’s `try_deserialize` will check this discriminator. If it doesn’t match, an invalid account was given, and the account deserialization will exit with an error.

The `#[account]` attribute also implements the `Owner` trait for a struct using the `programId` declared by `declareId` of the crate `#[account]` is used in. In other words, all accounts initialized using an account type defined using the `#[account]` attribute within the program are also owned by the program.

For example, the `#[account]` attribute to define a `AccountStruct` type that has one field `data`.

```rust
#[account]
pub struct AccountStruct {
    data: u64
}
```

Together with `InstructionAccounts` struct, we specify that we are initializing an account of type `AccountStruct`.

When the `account_name` account is initialized:

- The first 8 bytes is set as the `AccountStruct` discriminator
- The data field of the account will match `AccountStruct`
- The account owner set as the `programId` in `declare_id!`

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

You are now ready to build your own Solana program using the Anchor framework!

# Demo

Before we begin, install Anchor by following the steps [here](https://www.anchor-lang.com/docs/installation).

For this demo we'll create a simple counter program with two instructions:

- The first instruction will initialize a counter account
- The second instruction will increment the count stored on a counter account

### 1. Setup

Create a new project called `anchor-counter` by running `anchor init`:

```console
anchor init anchor-counter
```

Next, run `anchor-build`

```console
anchor-build
```

Then, run `anchor keys list`

```console
anchor keys list
```

Copy the program ID output from `anchor keys list`

```
anchor_counter: BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr
```

Then update `declare_id!` in `lib.rs`

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

And also update `Anchor.toml`

```
[programs.localnet]
anchor_counter = "BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr"
```

Finally, delete the default code in `lib.rs` until all that is left is the following:

```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;


}
```

### 2. Add `initialize` instruction

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

Next, using the `#[derive(Accounts)]` macro, let’s implement the `Initialize` `Context` type that lists the accounts that the `initialize` instruction requires.

- `counter` - the counter account initialized in the instruction
- `user` - payer for the initialization
- `system_program` - the system program is required for the initialization of any new accounts

Additionally, we’ll need to specify the Account types for account validation and define any additional constraints using the `#[account(..)]` attribute:

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

Next, use the `#[account]` attribute to define a new `Counter` account type which automatically implements the traits required for serialization and deserialization. The `Counter` struct defines one `count` field of type `u64`. This means that we can expect any new accounts initialized as a `Counter` type to have a matching data structure. The `#[account]` attribute also automatically sets the discriminator for a new account and sets the owner of the account as the `programId` from the `declare_id!` macro.

```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Add `increment` instruction

Within `#[program]`, let’s implement an `increment` instruction to increment the `count` once a `counter` account is initialized with the first instruction. This instruction requires a `Context` of type `Update`, which we’ll implement next and takes no additional instruction data. In the instruction logic, we are simply incrementing an existing `counter` account’s `count` field by `1`.

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

Lastly, using the `#[derive(Accounts)]` macro again, let’s implement the `Update` `Context` type that lists the accounts that the `increment` instruction requires.

- `counter` - an existing counter account to increment
- `user` - payer for the transaction fee

Again, we’ll need to specify the Account types for account validation and define any additional constraints using the `#[account(..)]` attribute:

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

Navigate to `anchor-counter.ts` and replace the default test code with the following.
Here we generate a new keypair for the `counter` account we'll be initializing and create placeholders for the two tests.
By default, Anchor uses the mocha test framework which reflects how a client would interact with the program.

```ts
import * as anchor from "@project-serum/anchor"
import { Program } from "@project-serum/anchor"
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

Next, create the first test for the `initialize` instruction.

```ts
it("Is initialized!", async () => {
  // Add your test here.
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 0)
})
```

Next, create the second test for the `increment` instruction.

```ts
it("Incremented the count", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber() === 1)
})
```

Lastly, run `anchor test` and you should see the following output.

```console
anchor-counter
✔ Is initialized! (290ms)
✔ Incremented the count (403ms)


2 passing (696ms)
```

Congratulations, you just built a Solana program using the Anchor framework! Feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment).

# Challenge

Now it’s your turn to build something independently. Because we're starting with very simple programs, yours will look almost identical to what we just created. It's useful to try and get to the point where you can write it from scratch without referencing prior code, so try not to copy and paste here.

1. Write a new program that initializes a `counter` account and set the `count` field using the an instruction data argument passed into the instruction
2. Implement both an `increment` and `decrement` instruction
3. Build and deploy your program like we did in the demo
4. Test your newly deployed program and use Solana Explorer to check the program logs

As always, get creative with these challenges and take them beyond the basic instructions if you want - and have fun!

Try to do this independently if you can! But if you get stuck, feel free to reference the [solution code](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement).

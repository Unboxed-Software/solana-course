# Cross Program Invocations

### Further Reading:

- [Official Solana CPI Docs](https://docs.solana.com/developing/programming-model/calling-between-programs)
- [Solana Cookbook](https://solanacookbook.com/references/programs.html#how-to-do-cross-program-invocation)

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Explain Cross-Program Invocations
- Understand how to construct and use CPIs
- Understand how a program provides a signature for a PDA
- Understand some pitfalls and troubleshoot some common errors associated with CPIs

# TL;DR

- A **Cross-Program Invocation (CPI)** is a call from one program to another, targeting a specific instruction on the called program.
- CPIs are made using the commands **`invoke`** or **`invoke_signed`**, which is also how programs provide signatures for PDAs that they own.
- CPIs make all programs in the Solana ecosystem completely interoperable because all public instructions of a program can be invoked by another program via a CPI.
- Because we have no control over the accounts and data submitted to a program, it's important to verify all of the parameters passed into a CPI to ensure program security.

# Overview

## What is a CPI?

A Cross-Program Invocation is when one program calls an instruction on another program. Remember very early in the course when we talked about how all programs are callable from any client? Well, the same is true for programs on chain! Any on-chain program can make calls to any other program’s public instructions, they just need to construct the instruction correctly. You can make CPIs to native programs, other programs you’ve created, as well as third party programs. CPIs essentially turn the entire Solana ecosystem into one giant API that is at your disposal as a developer.

CPIs have a similar make up to instructions that you are used to creating client side. There are some intricacies and differences depending on if you are using `invoke` or `invoke_signed`, both of which we will cover later in the lesson.

## How to make a CPI

CPIs are made using the [`invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) or [`invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) function from the `solana_program` crate. The former is what’s used when the signatures needed for the transaction are *not* for PDAs. The latter is what’s used when a program needs to provide a signature for a PDA.

```rust
// used when there are not signatures for PDAs needed
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// used when a program must provide a 'signature' for a PDA, hence the signer_seeds parameter
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

CPIs extend the privileges of the caller to the callee. Meaning that any account that is passed in to your program as a signer or writable account will also be considered a signer or writable account inside the program being called. For example, if the instruction the caller is processing contains a signer or writable account, then the caller can invoke an instruction that also contains that signer and/or writable account. Actually using `invoke` to make a CPI may look something like this:

```rust
invoke(
  &Instruction {
      program_id: calling_program_id,
      accounts: accounts_meta,
      data,
  },
  &account_infos[account1.clone(), account2.clone(), account3.clone()],
)?;
```

As you can see, this is very similar to what we have been doing so far from the client side! We still need to construct an instruction which specifies which program it is calling, which accounts it may read or modify, and additional data that serves as input to the program. The additional field expects an array of `account_info` objects involved in the transaction. By the time you make a CPI in your program, you should have already grabbed all the `account_info` objects that were passed into your program and stored them in variables. These variables are what will need to be passed in here using the `clone()` trait that is implemented on the `account_info` struct in the `solana_program` crate. This `clone()` trait returns a copy of the [`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html) struct.

When constructing an [`Instruction`](https://docs.rs/solana-program/1.10.19/solana_program/instruction/struct.Instruction.html) object, a list of all accounts that may be read or written to during the execution of that instruction must be supplied as [`AccountMeta`](https://docs.rs/solana-program/1.10.19/solana_program/instruction/struct.AccountMeta.html) values, which are structs that contain metadata about the accounts involved. This is the same thing we have been doing client-side with the accounts before we submit a transaction.

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```
Depending on the program you're making the CPI to, you may have to construct this `Instruction` object manually. Some programs have public functions available to be called that will return the correct `Instruction` object with the given parameters, kind of similar to some of the instructions provided by the typescript modules we have used in this course ([@solana/web3.js](https://solana-labs.github.io/solana-web3.js/), [@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)).

The process for constructing the instruction manually is similar to how we've done it client-side, except we'll be implementing it in Rust instead of Typescript now! As you can see from the code snippet above, the `Instruction` object contains the same information that we're used to - it still requires a `program_id`, vector of `AccountMeta` objects, and a byte buffer that represents the `instruction_data`.

The `program_id` is just a Pubkey, so that should be pretty straightforward. The accounts vector on the other hand, will require us to make use of the [`vec`](https://doc.rust-lang.org/std/macro.vec.html) macro. The vec macro allows us to create a vector using array notation, like so:
```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```

The `accounts` field of the `Instruction` struct is expecting a vector of [`AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html) objects, which can be created one of two ways - either with `AccountMeta::new` or `AccountMeta::read_only`. Using the `new` constructor creates a metadata object for writable accounts, while the `read_only` constructor specifies that the account is not writable. Both constructors expect two parameters, `pubkey: Pubkey` and `is_signer: bool`. The account metadata struct returned from both looks like this, look familiar?
```rust
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
```
An example of putting this in action may look something like
```rust
use solana_program::instruction::AccountMeta;

vec![
   AccountMeta::new(account1_pubkey, true),
   AccountMeta::read_only(account2_pubkey, false),
   AccountMeta::read_only(account3_pubkey, true),
   AccountMeta::new(account4_pubkey, false),
]
```
The final field of the instruction object is the data, as a byte buffer of course. You can create a byte buffer in Rust using the `vec` macro again, which has an implemented function allowing you to create a vector of certain length. Once you have initialized an empty vector, you would construct the byte buffer similar to before. The first element of the buffer should be an integer indicating which instruction you're targeting, the rest of the buffer will be for the serialized instruction data. Feel free to read up on some of the [features of the vec macro available to you here](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).
```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

Using `invoke_signed` is a little different just because there is an additional field that requires the seeds used to derive any PDAs that must sign the transaction. You may recall from previous lessons that PDAs do not lie on the ed25519 curve and, therefore, do not have a corresponding private key. You’ve been told that programs can provide signatures for their PDAs, but have not learned how that actually happens - until now. Programs provide signatures for their PDAs with the `invoke_signed` function. The first two fields of `invoke_signed` are the same as `invoke`, but there is an additional `signers_seeds` field that comes into play here.

```rust
invoke_signed(
  &instruction,
  accounts,
  &[&["First addresses seed"],
    &["Second addresses first seed", "Second addresses second seed"]],
)?;
```

While PDAs have no private keys of their own, they can be used by a program to issue an instruction that includes the program address as a signer. The only way for the runtime to verify that the address belongs to a program is for the program to supply the seeds used to generate the address in the `signers_seeds` field. The Solana runtime will internally call `create_program_address` using the seeds provided and the `program_id` of the program calling `invoke_signed`, and compare the result against the addresses supplied in the instruction. If any of the addresses match, then the runtime knows that the address is a PDA of the calling program and it has ‘signed’ this transaction.

## Why CPIs Matter?

CPIs are a very important feature of the Solana ecosystem and they make all programs deployed interoperable with each other. With CPIs there is no need to re-invent the wheel when it comes to development. This creates the opportunity for building new protocols and applications on top of what’s already been built, just like building blocks or legos. It’s important to remember that CPIs are a two-way street and the same is true for any programs that you deploy! If you build something cool and useful, developers have the ability to build on top of what you’ve done or just plug your protocol into whatever it is that they are building.

Another important aspect of CPIs is that they allow programs to sign for their PDAs. As you have probably noticed by now, PDAs are used very frequently in Solana development because they allow programs to control specific addresses in such a way that no external user can generate valid transactions with signatures for those addresses, which can be very useful for many applications in Web3 (DeFi, NFTs, etc.). Without CPIs, PDAs would not be nearly as useful because there would be no way for a program to sign transactions involving them - essentially turning them black holes (once something is sent to a PDA, there would be no way to get it back out w/o CPIs).

## Best Practices and Common Pitfalls

There are some common mistakes and things to remember when utilizing CPIs that are important to your program’s security and robustness. The first thing to remember is that, as we know by now, we have no control over what information is passed into our programs. For this reason, it’s important to always verify the `program_id`, accounts, and data passed into the CPI. Without these security checks, someone could submit a transaction that invokes an instruction on a completely different program than was expected, which is not ideal. Luckily, there are inherent checks on the validity of any PDAs that are marked as signers within the `invoke_signed` function, but all other accounts and `instruction_data` must be verified somewhere in your program before making the CPI. It is also important to remember to make sure you’re targeting the intended instruction on the program you are invoking. The easiest way to do this is to read the source code of the program you will be invoking, the same way you would if you were constructing an instruction from the client side.

There are some common errors you might receive when executing a CPI, they usually mean you are constructing the CPI with incorrect information. For example, you may come across an error message similar to this:

```
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

This message is a little misleading, because “signer privilege escalated” does not seem like a problem but, in reality, it means that you are incorrectly signing for the address in the message. If you are using `invoke_signed` and receive this error, then it likely means that the seeds you are providing are incorrect. An example transaction that failed with this error can be found [here](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6r2Et?cluster=devnet).

Another error very similar to the incorrect signature message that often comes up is thrown when an account is not marked as `writable` inside the `AccountMeta` struct that is submitted to the program when it should be.

```
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```
Remember, any account whose data may be mutated by the program during execution must be specified as writable. During execution, writing to an account that was not specified as writable will cause the transaction to fail. Writing to an account that is not owned by the program will cause the transaction to fail. Any account whose lamport balance may be mutated by the program during execution must be specified as writable. During execution, mutating the lamports of an account that was not specified as writable will cause the transaction to fail. While subtracting lamports from an account not owned by the program will cause the transaction to fail, adding lamports to any account is allowed, as long is it is mutable.

To see this in action, view this [transaction in the explorer](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet).

# Demo

To get some hands on experience with CPIs, we’ll be making some additions to the Movie Review program again.

Last lesson, we added the ability to leave comments on other movie reviews using PDAs. In this lesson, we’re going to add some functionality so that users will be minted tokens anytime a review is created or they leave a comment on a review. To implement this, we'll have to invoke the SPL Token Program's `MintTo` instruction using a CPI.

### 1. Get starter code

To get started, we will be using the final state of the Movie Review program from the previous PDA lesson. So, if you just completed that lesson then you’re all set and ready to go. If you are just jumping in here, no worries, you can [download the starter code here](https://github.com/ixmorrow/movie-review-tokens/tree/starter).

### 2. Updates to add_movie_review

To implement this, the first thing we need to do is import the address of the token program and the constant `LAMPORTS_PER_SOL`.

```rust
// inside processor.rs
use spl_token::ID as TOKEN_PROGRAM_ID;
use solana_program::native_token::LAMPORTS_PER_SOL;
```

Because we want users to be minted tokens upon creating a review, it would make sense to add the logic inside the `add_movie_review` function. To start, we’ll need to determine which accounts will be needed for this new functionality. Right now, the function expects four accounts - we’ll need to update the beginning of the function to this:

```rust
// inside add_movie_review
msg!("Adding movie review...");
msg!("Title: {}", title);
msg!("Rating: {}", rating);
msg!("Description: {}", description);

let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

Notice that there are four *new* accounts expected, all of which will be needed for the token minting logic.

- `token_mint` - the mint address of the token
- `mint_auth` - address of the authority of the token mint
- `user_ata` - user’s associated token account for this mint (where the tokens will be minted)
- `token_program` - address of the token program

There is not any additional `instruction_data` necessary for this functionality, so no changes need to be made to how data is deserialized, the only additional information that’s needed is the extra accounts.

Now that we have the necessary accounts, we can move on to the logic that handles the actual minting of the tokens! We’ll be adding this to the very end of the `add_movie_review` function right before `Ok(())` is returned.

```rust
// mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"tokens"], program_id);

if *mint_auth.key != mint_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into())
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into())
}
```

First, we derive the mint authority address using the `find_program_address` function with the seed “tokens”. The mint authority must be a PDA of this program in order for the program have the ability to mint tokens to users. Then, we check that the address of the derived mint authority is equal to the one passed in to the program. We also verify the address of the token program that was passed in.

Finally, we can issue a CPI to the `mint_to` function of the token program with the correct accounts using `invoke_signed`.

```rust
msg!("Minting 10 tokens to User associated token account");
invoke_signed(
	// instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
	// account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
	// seeds
    &[&[b"tokens", &[mint_bump]]],
)?;

Ok(())
```

The SPL Token Program has some functionality baked in to it to make CPIs even easier. Remember when we mentioned that some programs had public functions that you can call that return an `Instruction` object? Well, luckily for us, the SPL Token Program is one of those programs, meaning we don't have to go through the tedious process of manually creating the instruction ourselves. We are calling a function called `mint_to` in the instruction.rs file of token program that returns a MintTo `Instruction` object.

This is what the `mint_to` function expects as input, you can [view the source code here](https://github.com/solana-labs/solana-program-library/blob/024ba3ad410fef2d31e500c0f1a30db0c222a6a8/token/program-2022/src/instruction.rs#L1317).

```rust
// inside the token program, returns an Instruction object
pub fn mint_to(
    token_program_id: &Pubkey,
    mint_pubkey: &Pubkey,
    account_pubkey: &Pubkey,
    owner_pubkey: &Pubkey,
    signer_pubkeys: &[&Pubkey],
    amount: u64,
) -> Result<Instruction, ProgramError>
```

Then, we pass in the `AccountInfo` objects of all the accounts involved using the `clone()` trait and the seeds and the bump for the token mint authority that must sign this transaction.

Notice that we are using `invoke_signed` and not `invoke` here. Reason being is that the `mint_auth` account must sign this transaction in order for tokens to be minted, but the `mint_auth` account is supposed to be a PDA of our program. Therefore, the only way to provide a signature for the PDA is to use `invoke_signed`. The Solana runtime calls `create_program_address` with the seeds and bump provided and then compares the derived address with all of the addresses of the provided `AccountInfo` objects. If any of the addresses match the derived address, the runtime knows that that account is a PDA of this program and that the program is signing this transaction for this account.

The `add_movie_review` instruction should be fully functional now and it will mint a user 10 tokens when a review is created.

### 3. Updates to add_comment

Our updates to the `add_comment` function will be almost identical to what we did for the `add_movie_review` function above. The only difference is that we’ll change the amount of tokens minted for a comment from 10 to 5. First, update the accounts needed.

```rust
// inside add_comment
let account_info_iter = &mut accounts.iter();

let commenter = next_account_info(account_info_iter)?;
let pda_review = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let pda_comment = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

We added the same four accounts as before. Next, you can add the CPI logic to mint the tokens at the end of the function.

```rust
// mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"tokens"], program_id);

if *mint_auth.key != mint_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into())
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into())
}

msg!("Minting 5 tokens to User associated token account");
invoke_signed(
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
		// change the amount of tokens to 5
        5*LAMPORTS_PER_SOL,
    )?,
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    &[&[b"tokens", &[mint_bump]]],
)?;

Ok(())
```

### 4. Build and Deploy

Now we’re ready to build and deploy our program! You can build the program by running `cargo build-bpf` and then running the command that is returned, it should look something like `solana program deploy <PATH>`.

You can test your program by submitting a transaction with the right accounts and data.

If you need more time with the concepts from this lesson or got stuck along the way, feel free to [take a look at the solution code here](https://github.com/ixmorrow/movie-review-tokens).

# Challenge

*Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently.*

1. Challenge instruction one
2. Challenge instruction two

# Cross Program Invocations

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Explain Cross-Program Invocations
- Understand how to construct and use CPIs
- Understand how a program provides a signature for a PDA
- Understand some pitfalls and troubleshoot some common errors associated with CPIs

# TL;DR

- A **Cross-Program Invocation (CPI)** is a call from one program to another, targeting a specific function on the called program.
- CPIs are made using the commands **`invoke`** or **`invoke_signed`**, the latter being how programs provide signatures for PDAs that they own.
- CPIs make programs in the Solana ecosystem completely interoperable because all public instructions of a program can be invoked by another program via a CPI.
- Because we have no control over the accounts and data submitted to a program, it's important to verify all of the parameters passed into a CPI to ensure program security.

# Overview

## What is a CPI?

A Cross-Program Invocation is a direct call from one program into another within the same instruction. Remember very early in the course when we talked about how all programs are callable from any client? Well, the same is true for programs on chain! Any on-chain program can make calls to any other program’s public instructions, they just need to construct the instruction correctly. You can make CPIs to native programs, other programs you've created, and third party programs. CPIs essentially turn the entire Solana ecosystem into one giant API that is at your disposal as a developer.

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

CPIs extend the privileges of the caller to the callee. Meaning that any account that is passed into your program as a signer or writable account, if it is then passed into a CPI, will also be considered a signer or writable account inside the program being invoked. For example, if the instruction the callee program is processing contains an account that was marked as a signer or writable when originally passed into the caller program, then it will be considered a signer or writable account in the invoked program as well.

It's important to note that you as the developer decide which accounts to pass into the CPI. You can think of a CPI as building another instruction from scratch with only information that was passed into your program.
### CPI with `invoke`

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

As you can see, this is very similar to what we have been doing so far from the client side! We still need to construct an instruction that specifies which program it is calling, which accounts it may read or modify, and additional data that serves as input to the program. The additional field expects an array of `account_info` objects involved in the transaction. By the time you make a CPI in your program, you should have already grabbed all the `account_info` objects that were passed into your program and stored them in variables. These variables are what will need to be passed in here using the [`Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html#impl-Clone) trait that is implemented on the `account_info` struct in the `solana_program` crate. This `Clone` trait returns a copy of the [`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html) struct.

When constructing an [`Instruction`](https://docs.rs/solana-program/1.10.19/solana_program/instruction/struct.Instruction.html) object, a list of all accounts that may be read or written to during the execution of that instruction must be supplied as [`AccountMeta`](https://docs.rs/solana-program/1.10.19/solana_program/instruction/struct.AccountMeta.html) values, which are structs that contain metadata about the accounts involved. This is the same thing we have been doing client-side with the accounts before we submit a transaction.

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```
Depending on the program you're making the CPI to, you may have to construct this `Instruction` object manually. Many individuals and organizations create publicly available crates alongside their programs that expose helper functions you can use to create the right `Instruction` object. This is similar to the Typescript libraries we've used in this course (e.g. [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/), [@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)), but in Rust and usable by your program. For example, in this lesson's demo we'll be using the `spl_token` crate to create minting instructions rather than build them from scratch.

The process for constructing the instruction manually is similar to how we've done it client-side, except we'll be implementing it in Rust instead of Typescript now! As you can see from the code snippet above, the `Instruction` object contains the same information that we're used to - it still requires a `program_id`, vector of `AccountMeta` objects, and a byte buffer that represents the `instruction_data`.

The `accounts` and `data` arguments will require us to make use of the [`vec`](https://doc.rust-lang.org/std/macro.vec.html) macro. The vec macro allows us to create a vector using array notation, like so:
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
Putting these two pieces together looks like this:
```rust
use solana_program::instruction::AccountMeta;

vec![
   AccountMeta::new(account1_pubkey, true),
   AccountMeta::read_only(account2_pubkey, false),
   AccountMeta::read_only(account3_pubkey, true),
   AccountMeta::new(account4_pubkey, false),
]
```
The final field of the instruction object is the data, as a byte buffer of course. You can create a byte buffer in Rust using the `vec` macro again, which has an implemented function allowing you to create a vector of certain length. Once you have initialized an empty vector, you would construct the byte buffer similar to how you would client-side. Determine the data required by the callee program and the serialization format and write your code to match. Feel free to read up on some of the [features of the vec macro available to you here](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).
```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```
The [`extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) method is probably new to you. It's a method on vectors that takes a slice as input, iterates over the slice, clones each element, and then appends it to the `Vec`.

### CPI with `invoke_signed`
Using `invoke_signed` is a little different just because there is an additional field that requires the seeds used to derive any PDAs that must sign the transaction. You may recall from previous lessons that PDAs do not lie on the ed25519 curve and, therefore, do not have a corresponding private key. You’ve been told that programs can provide signatures for their PDAs, but have not learned how that actually happens - until now. Programs provide signatures for their PDAs with the `invoke_signed` function. The first two fields of `invoke_signed` are the same as `invoke`, but there is an additional `signers_seeds` field that comes into play here.

```rust
invoke_signed(
  &instruction,
  accounts,
  &[&["First addresses seed"],
    &["Second addresses first seed", "Second addresses second seed"]],
)?;
```

While PDAs have no private keys of their own, they can be used by a program to issue an instruction that includes the program address as a signer. The only way for the runtime to verify that the address belongs to a program is for the program to supply the seeds used to generate the address in the `signers_seeds` field. The Solana runtime will internally call [`create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) using the seeds provided and the `program_id` of the program calling `invoke_signed`, and compare the result against the addresses supplied in the instruction. If any of the addresses match, then the runtime knows that indeed the program associated with this address is the caller and thus authorized to be the signer.

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

## Why CPIs Matter?

CPIs are a very important feature of the Solana ecosystem and they make all programs deployed interoperable with each other. With CPIs there is no need to re-invent the wheel when it comes to development. This creates the opportunity for building new protocols and applications on top of what’s already been built, just like building blocks or legos. It’s important to remember that CPIs are a two-way street and the same is true for any programs that you deploy! If you build something cool and useful, developers have the ability to build on top of what you’ve done or just plug your protocol into whatever it is that they are building. Composability is a big part of what makes crypto so unique and CPIs are what makes this possible on Solana.

Another important aspect of CPIs is that they allow programs to sign for their PDAs. As you have probably noticed by now, PDAs are used very frequently in Solana development because they allow programs to control specific addresses in such a way that no external user can generate valid transactions with signatures for those addresses, which can be very useful for many applications in Web3 (DeFi, NFTs, etc.). Without CPIs, PDAs would not be nearly as useful because there would be no way for a program to sign transactions involving them - essentially turning them black holes (once something is sent to a PDA, there would be no way to get it back out w/o CPIs).

# Demo

To get some hands on experience with CPIs, we’ll be making some additions to the Movie Review program again. If you're dropping into this lesson without having gone through prior lessons, the Movie Review program allows users to submit movie reviews and have them stored in PDA accounts.

Last lesson, we added the ability to leave comments on other movie reviews using PDAs. In this lesson, we’re going to work on having the program mint tokens to the reviewer or commenter anytime a review or comment is submitted.

To implement this, we'll have to invoke the SPL Token Program's `MintTo` instruction using a CPI. If you need a refresher on tokens, token mints, and minting new tokens, have a look at the [Token program lesson](./token-program.md) before moving forward with this demo.

### 1. Get starter code and add dependencies

To get started, we will be using the final state of the Movie Review program from the previous PDA lesson. So, if you just completed that lesson then you’re all set and ready to go. If you are just jumping in here, no worries, you can [download the starter code here](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments). We'll be using the `solution-add-comments` branch as our starting point.

### 2. Add dependencies to `Cargo.toml`

Before we get started we need to add two new dependencies to the `Cargo.toml` file underneath `[dependencies]`. We'll be using the `spl-token` and `spl-associated-token-account` crates in addition to the existing dependencies.

```text
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

After adding the above, run `cargo check` in your console to have cargo resolve your dependencies and ensure that you are ready to continue. Depending on your setup you may need to modify crate versions before moving on.

### 3. Add necessary accounts to `add_movie_review`

Because we want users to be minted tokens upon creating a review, it makes sense to add minting logic inside the `add_movie_review` function. Since we'll be minting tokens, the `add_movie_review` instruction requires a few new accounts to be passed in:

- `token_mint` - the mint address of the token
- `mint_auth` - address of the authority of the token mint
- `user_ata` - user’s associated token account for this mint (where the tokens will be minted)
- `token_program` - address of the token program

We'll start by adding these new accounts to the area of the function that iterates through the passed in accounts:

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

There is no additional `instruction_data` required for the new functionality, so no changes need to be made to how data is deserialized. The only additional information that’s needed is the extra accounts.

### 4. Mint tokens to the reviewer in `add_movie_review`

Before we dive into the minting logic, let's import the address of the Token program and the constant `LAMPORTS_PER_SOL` at the top of the file.

```rust
// inside processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

Now we can move on to the logic that handles the actual minting of the tokens! We’ll be adding this to the very end of the `add_movie_review` function right before `Ok(())` is returned.

Minting tokens requires a signature by the mint authority. Since the program needs to be able to mint tokens, the mint authority needs to be an account that the program can sign on behalf of. In other words, it needs to be a PDA account owned by the program.

We'll also be structuring our token mint such that the mint account is a PDA account that we can derive deterministically. This way we can always verify that the `token_mint` account passed into the program is the expected account.

Let's go ahead and derive the token mint and mint authority addresses using the `find_program_address` function with the seeds “token_mint” and "token_auth," respectively.

```rust
// mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Then, we'll perform security checks against each of the new accounts passed into the program. Always remember to verify accounts!

```rust
if *token_mint.key != mint_pda {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(initializer.key, token_mint.key) {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Finally, we can issue a CPI to the `mint_to` function of the token program with the correct accounts using `invoke_signed`. The `spl_token` crate provides a `mint_to` helper function for creating the minting instruction. This is great because it means we don't have to manually build the entire instruction from scratch. Rather, we can simply pass in the arguments required by the function. Here's the function signature:

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

Then we provide copies of the `token_mint`, `user_ata`, and `mint_auth` accounts. And, most relevant to this lesson, we provide the seeds used to find the `token_mint` address, including the bump seed.

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
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

Note that we are using `invoke_signed` and not `invoke` here. The Token program requires the `mint_auth` account to sign for this transaction. Since the `mint_auth` account is a PDA, only the program it was derived from can sign on its behalf. When `invoke_signed` is called, the Solana runtime calls `create_program_address` with the seeds and bump provided and then compares the derived address with all of the addresses of the provided `AccountInfo` objects. If any of the addresses match the derived address, the runtime knows that the matching account is a PDA of this program and that the program is signing this transaction for this account.

At this point, the `add_movie_review` instruction should be fully functional and will mint 10 tokens to the reviewer when a review is created.

### 5. Repeat for `add_comment`

Our updates to the `add_comment` function will be almost identical to what we did for the `add_movie_review` function above. The only difference is that we’ll change the amount of tokens minted for a comment from 10 to 5 so that adding reviews are weighted above commenting. First, update the accounts with the same four additional accounts as in the `add_movie_review` function.

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

Next, move to the bottom of the `add_comment` function just before the `Ok(())`. Then derive the token mint and mint authority accounts. Remember, both are PDAs derived from seeds "token_mint" and "token_authority" respectively.

```rust
// mint tokens here
msg!("deriving mint authority");
let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, _mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Next, verify that each of the new accounts is the correct account.

```rust
if *token_mint.key != mint_pda {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("Mint passed in and mint derived do not match");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(commenter.key, token_mint.key) {
    msg!("Incorrect token mint");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("Incorrect token program");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

Finally, use `invoke_signed` to send the `mint_to` instruction to the Token program, sending 5 tokens to the commenter.

```rust
msg!("Minting 5 tokens to User associated token account");
invoke_signed(
    // instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // seeds
    &[&[b"token_mint", &[mint_bump]]],
)?;

Ok(())
```

### 6. Set up the token mint

We've written all the code needed to mint tokens to reviewers and commenters, but all of it assumes that there is a token mint at the PDA derived with the seed "token_mint." For this to work, we're going to set up an additional instruction for initializing the token mint. It will be written such that it can only be called once and it doesn't particularly matter who calls it.

Given that we've already hammered home all of the concepts associated with PDAs and CPIs multiple times throughout this lesson, we're going to walk through this bit with less explanation than the prior steps. Start by adding a fourth instruction variant to the `MovieInstruction` enum in `instruction.rs`.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    AddComment {
        comment: String,
    },
    InitializeMint,
}
```

Be sure to add it to the `match` statement in the `unpack` function in the same file under the variant `3`.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description,
                }
            }
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment,
                }
            }
            3 => Self::InitializeMint,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
```

In the `process_instruction` function in the `processor.rs` file, add the new instruction to the `match` statement and call a function `initialize_token_mint`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview {
            title,
            rating,
            description,
        } => add_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::UpdateMovieReview {
            title,
            rating,
            description,
        } => update_movie_review(program_id, accounts, title, rating, description),
        MovieInstruction::AddComment { comment } => add_comment(program_id, accounts, comment),
        MovieInstruction::InitializeMint => initialize_token_mint(program_id, accounts),
    }
}
```

Lastly, declare and implement the `initialize_token_mint` function. This function will derive the token mint and mint authority PDAs, create the token mint account, and then initialize the token mint. We won't explain all of this in detail, but it's worth reading through the code, especially given that the creation and initialization of the token mint both involve CPIs. Again, if you need a refresher on tokens and mints, have a look at the [Token program lesson](./token-program.md).

```rust
pub fn initialize_token_mint(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let mint_auth = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
    let (mint_auth_pda, _mint_auth_bump) =
        Pubkey::find_program_address(&[b"token_auth"], program_id);

    msg!("Token mint: {:?}", mint_pda);
    msg!("Mint authority: {:?}", mint_auth_pda);

    if mint_pda != *token_mint.key {
        msg!("Incorrect token mint account");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("Incorrect token program");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *mint_auth.key != mint_auth_pda {
        msg!("Incorrect mint auth account");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(82);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            token_mint.key,
            rent_lamports,
            82,
            token_program.key,
        ),
        &[
            initializer.clone(),
            token_mint.clone(),
            system_program.clone(),
        ],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Created token mint account");

    invoke_signed(
        &initialize_mint(
            token_program.key,
            token_mint.key,
            mint_auth.key,
            Option::None,
            9,
        )?,
        &[token_mint.clone(), sysvar_rent.clone(), mint_auth.clone()],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Initialized token mint");

    Ok(())
}
```

### 7. Build and deploy

Now we’re ready to build and deploy our program! You can build the program by running `cargo build-bpf` and then running the command that is returned, it should look something like `solana program deploy <PATH>`.

Before you can start testing whether or not adding a review or comment sends you tokens, you need to initialize the program's token mint. You can use [this script](https://github.com/Unboxed-Software/solana-movie-token-client) to do that. Once you'd cloned that repository, replace the `PROGRAM_ID` in `index.ts` with your program's ID. Then run `npm install` and then `npm start`. The script assumes you're deploying to Devnet so if you're deploying locally make sure to tailor the script accordingly.

Once you've initialized your token mint, you can use the [Movie Review frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) to test adding reviews and comments. Again, the code assumes you're on Devnet so please act accordingly.

After submitting a review, you should see 10 new tokens in your wallet! When you add a comment, you should receive 5 tokens. They won't have a fancy name or image since we didn't add any metadata to the token, but you get the idea.

If you need more time with the concepts from this lesson or got stuck along the way, feel free to [take a look at the solution code](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens). Note that the solution to this demo is on the `solution-add-tokens` branch.

# Challenge

To apply what you've learned about CPIs in this lesson, think about how you could incorporate them into the Student Intro program. You could do something similar to what we did in the demo here and add some functionality to mint tokens to users when they introduce themselves. Or if you're feeling really ambitious, think about how you could take all that you have learned so far in the course and create something completely new from scratch.

A great example would be to build a decentralized Stack Overflow. The program could use tokens to determine a user's overall rating, mint tokens when questions are answered correctly, allow users to upvote answers, etc. All of that is possible and you now have the skills and knowledge to go and build something like it on your own!

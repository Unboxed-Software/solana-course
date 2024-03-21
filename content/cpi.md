---
title: Cross Program Invocations
objectives:
- Explain Cross-Program Invocations (CPIs)
- Describe how to construct and use CPIs
- Explain how a program provides a signature for a PDA
- Avoid common pitfalls and troubleshoot common errors associated with CPIs
---

# Summary

- A **Cross-Program Invocation (CPI)** is a call from one program to another, targeting a specific instruction on the program called
- CPIs are made using the commands `invoke` or `invoke_signed`, the latter being how programs provide signatures for PDAs that they own
- CPIs make programs in the Solana ecosystem completely interoperable because all public instructions of a program can be invoked by another program via a CPI
- Because we have no control over the accounts and data submitted to a program, it's important to verify all of the parameters passed into a CPI to ensure program security

# Lesson

## What is a CPI?

A Cross-Program Invocation (CPI) is a direct call from one program into another. Just as any client can call any program using the JSON RPC, any program can call any other program directly. The only requirement for invoking an instruction on another program from within your program is that you construct the instruction correctly. You can make CPIs to native programs, other programs you've created, and third party programs. CPIs essentially turn the entire Solana ecosystem into one giant API that is at your disposal as a developer.


CPIs have a similar make up to instructions that you are used to creating client side. There are some intricacies and differences depending on if you are using `invoke` or `invoke_signed`. We'll be covering both of these later in this lesson.

## How to make a CPI

CPIs are made using the [`invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html) or [`invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html) function from the `solana_program` crate. You use `invoke` to essentially pass through the original transaction signature that was passed into your program. You use `invoke_signed` to have your program "sign" for its PDAs.

```rust
// Used when there are not signatures for PDAs needed
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// Used when a program must provide a 'signature' for a PDA, hence the signer_seeds parameter
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

CPIs extend the privileges of the caller to the callee. If the instruction the callee program is processing contains an account that was marked as a signer or writable when originally passed into the caller program, then it will be considered a signer or writable account in the invoked program as well.

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

- `program_id` - the public key of the program you are going to invoke
- `account` - a list of account metadata as a vector. You need to include every account that the invoked program will read or write
- `data` - a byte buffer representing the data being passed to the callee program as a vector

The `Instruction` type has the following definition:

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```


Depending on the program you're making the call to, there may be a crate available with helper functions for creating the `Instruction` object. Many individuals and organizations create publicly available crates alongside their programs that expose these sorts of functions to simplify calling their programs. This is similar to the Typescript libraries we've used in this course (e.g. [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/), [@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)). For example, in this lesson's lab we'll be using the `spl_token` crate to create minting instructions.
In all other cases, you'll need to create the `Instruction` instance from scratch.

While the `program_id` field is fairly straightforward, the `accounts` and `data` fields require some explanation.

Both the `accounts` and `data` fields are of type `Vec`, or vector. You can use the [`vec`](https://doc.rust-lang.org/std/macro.vec.html) macro to construct a vector using array notation, like so:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```


The `accounts` field of the `Instruction` struct expects a vector of type [`AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html). The `AccountMeta` struct has the following definition:


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
    AccountMeta::new(account1_pubkey, true), // metadata for a writable, signer account
    AccountMeta::read_only(account2_pubkey, false), // metadata for a read-only, non-signer account
    AccountMeta::read_only(account3_pubkey, true), // metadata for a read-only, signer account
    AccountMeta::new(account4_pubkey, false), // metadata for a writable, non-signer account
]
```


The final field of the instruction object is the data, as a byte buffer of course. You can create a byte buffer in Rust using the `vec` macro again, which has an implemented function allowing you to create a vector of certain length. Once you have initialized an empty vector, you would construct the byte buffer similar to how you would client-side. Determine the data required by the callee program and the serialization format used and write your code to match. Feel free to read up on some of the [features of the `vec` macro available to you here](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#).


```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

The [`extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) method is probably new to you. It's a method on vectors that takes a slice as input, iterates over the slice, clones each element, and then appends it to the `Vec`.

### Pass a list of accounts

In addition to the instruction, both `invoke` and `invoke_signed` also require a list of `account_info` objects. Just like the list of `AccountMeta` objects you added to the instruction, you must include all of the accounts that the program you're calling will read or write.

By the time you make a CPI in your program, you should have already grabbed all the `account_info` objects that were passed into your program and stored them in variables. You'll construct your list of `account_info` objects for the CPI by choosing which of these accounts to copy and send along.

You can copy each `account_info` object that you need to pass into the CPI using the [`Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html#impl-Clone) trait that is implemented on the `account_info` struct in the `solana_program` crate. This `Clone` trait returns a copy of the [`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html) instance.

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### CPI with `invoke`

With both the instruction and the list of accounts created, you can perform a call to `invoke`.

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &[account1.clone(), account2.clone(), account3.clone()],
)?;
```

There's no need to include a signature because the Solana runtime passes along the original signature passed into your program. Remember, `invoke` won't work if a signature is required on behalf of a PDA. For that, you'll need to use `invoke_signed`.

### CPI with `invoke_signed`


Using `invoke_signed` is a little different just because there is an additional field that requires the seeds used to derive any PDAs that must sign the transaction. You may recall from previous lessons that PDAs do not lie on the Ed25519 curve and, therefore, do not have a corresponding secret key. You’ve been told that programs can provide signatures for their PDAs, but have not learned how that actually happens - until now. Programs provide signatures for their PDAs with the `invoke_signed` function. The first two fields of `invoke_signed` are the same as `invoke`, but there is an additional `signers_seeds` field that comes into play here.


```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["First addresses seed"],
        &["Second addresses first seed",
        "Second addresses second seed"]],
)?;
```

While PDAs have no secret keys of their own, they can be used by a program to issue an instruction that includes the PDA as a signer. The only way for the runtime to verify that the PDA belongs to the calling program is for the calling program to supply the seeds used to generate the address in the `signers_seeds` field.

The Solana runtime will internally call [`create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) using the seeds provided and the `program_id` of the calling program. It can then compare the result against the addresses supplied in the instruction. If any of the addresses match, then the runtime knows that indeed the program associated with this address is the caller and thus is authorized to be a signer.


## Best Practices and common pitfalls

### Security checks

There are some common mistakes and things to remember when utilizing CPIs that are important to your program’s security and robustness. The first thing to remember is that, as we know by now, we have no control over what information is passed into our programs. For this reason, it’s important to always verify the `program_id`, accounts, and data passed into the CPI. Without these security checks, someone could submit a transaction that invokes an instruction on a completely different program than was expected, which is not ideal.

Fortunately, there are inherent checks on the validity of any PDAs that are marked as signers within the `invoke_signed` function. All other accounts and `instruction_data` should be verified somewhere in your program code before making the CPI. It's also important to make sure you’re targeting the intended instruction on the program you are invoking. The easiest way to do this is to read the source code of the program you will be invoking just as you would if you were constructing an instruction from the client side.

### Common errors

There are some common errors you might receive when executing a CPI, they usually mean you are constructing the CPI with incorrect information. For example, you may come across an error message similar to this:

```text
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

This message is a little misleading, because “signer privilege escalated” does not seem like a problem but, in reality, it means that you are incorrectly signing for the address in the message. If you are using `invoke_signed` and receive this error, then it likely means that the seeds you are providing are incorrect. You can also find [an example transaction that failed with this error](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6r2Et?cluster=devnet).

Another similar error is thrown when an account that's written to isn't marked as `writable` inside the `AccountMeta` struct.

```text
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

Remember, any account whose data may be mutated by the program during execution must be specified as writable. During execution, writing to an account that was not specified as writable will cause the transaction to fail. Writing to an account that is not owned by the program will cause the transaction to fail. Any account whose lamport balance may be mutated by the program during execution must be specified as writable. During execution, mutating the lamports of an account that was not specified as writable will cause the transaction to fail. While subtracting lamports from an account not owned by the program will cause the transaction to fail, adding lamports to any account is allowed, as long is it is mutable.

To see this in action, view this [transaction in the explorer](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet).

## Why CPIs matter?

CPIs are a very important feature of the Solana ecosystem and they make all programs deployed interoperable with each other. With CPIs there is no need to re-invent the wheel when it comes to development. This creates the opportunity for building new protocols and applications on top of what’s already been built, just like building blocks or Lego bricks. It’s important to remember that CPIs are a two-way street and the same is true for any programs that you deploy! If you build something cool and useful, developers have the ability to build on top of what you’ve done or just plug your protocol into whatever it is that they are building. Composability is a big part of what makes crypto so unique and CPIs are what makes this possible on Solana.


Another important aspect of CPIs is that they allow programs to sign for their PDAs. As you have probably noticed by now, PDAs are used very frequently in Solana development because they allow programs to control specific addresses in such a way that no external user can generate transactions with valid signatures for those addresses. This can be *very* useful for many applications in Web3 (e.g. DeFi, NFTs, etc.) Without CPIs, PDAs would not be nearly as useful because there would be no way for a program to sign transactions involving them - essentially turning them black holes (once something is sent to a PDA, there would be no way to get it back out w/o CPIs!)

# Lab

Now let's get some hands on experience with CPIs by making some additions to the Movie Review program again. If you're dropping into this lesson without having gone through prior lessons, the Movie Review program allows users to submit movie reviews and have them stored in PDA accounts.

Last lesson, we added the ability to leave comments on other movie reviews using PDAs. In this lesson, we’re going to work on having the program mint tokens to the reviewer or commenter anytime a review or comment is submitted.

To implement this, we'll have to invoke the SPL Token Program's `MintTo` instruction using a CPI. If you need a refresher on tokens, token mints, and minting new tokens, have a look at the [Token Program lesson](./token-program) before moving forward with this lab.

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
// Inside add_movie_review
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
// Inside processor.rs
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

Now we can move on to the logic that handles the actual minting of the tokens! We’ll be adding this to the very end of the `add_movie_review` function right before `Ok(())` is returned.

Minting tokens requires a signature by the mint authority. Since the program needs to be able to mint tokens, the mint authority needs to be an account that the program can sign for. In other words, it needs to be a PDA account owned by the program.

We'll also be structuring our token mint such that the mint account is a PDA account that we can derive deterministically. This way we can always verify that the `token_mint` account passed into the program is the expected account.

Let's go ahead and derive the token mint and mint authority addresses using the `find_program_address` function with the seeds “token_mint” and "token_auth," respectively.

```rust
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, _mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

Next, we'll perform security checks against each of the new accounts passed into the program. Always remember to verify accounts!

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
// Inside the token program, returns an Instruction object
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
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_auth", &[mint_auth_bump]]],
)?;

Ok(())
```

Note that we are using `invoke_signed` and not `invoke` here. The Token program requires the `mint_auth` account to sign for this transaction. Since the `mint_auth` account is a PDA, only the program it was derived from can sign on its behalf. When `invoke_signed` is called, the Solana runtime calls `create_program_address` with the seeds and bump provided and then compares the derived address with all of the addresses of the provided `AccountInfo` objects. If any of the addresses match the derived address, the runtime knows that the matching account is a PDA of this program and that the program is signing this transaction for this account.

At this point, the `add_movie_review` instruction should be fully functional and will mint ten tokens to the reviewer when a review is created.

### 5. Repeat for `add_comment`

Our updates to the `add_comment` function will be almost identical to what we did for the `add_movie_review` function above. The only difference is that we’ll change the amount of tokens minted for a comment from ten to five so that adding reviews are weighted above commenting. First, update the accounts with the same four additional accounts as in the `add_movie_review` function.

```rust
// Inside add_comment
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
// Mint tokens here
msg!("deriving mint authority");
let (mint_pda, _mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, mint_auth_bump) =
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

Finally, use `invoke_signed` to send the `mint_to` instruction to the Token program, sending five tokens to the commenter.

```rust
msg!("Minting 5 tokens to User associated token account");
invoke_signed(
    // Instruction
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // Account_infos
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // Seeds
    &[&[b"token_auth", &[mint_auth_bump]]],
)?;

Ok(())
```

### 6. Set up the token mint

We've written all the code needed to mint tokens to reviewers and commenters, but all of it assumes that there is a token mint at the PDA derived with the seed "token_mint." For this to work, we're going to set up an additional instruction for initializing the token mint. It will be written such that it can only be called once and it doesn't particularly matter who calls it.

Given that throughout this lesson we've already hammered home all of the concepts associated with PDAs and CPIs multiple times, we're going to walk through this bit with less explanation than the prior steps. Start by adding a fourth instruction variant to the `MovieInstruction` enum in `instruction.rs`.

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

Lastly, declare and implement the `initialize_token_mint` function. This function will derive the token mint and mint authority PDAs, create the token mint account, and then initialize the token mint. We won't explain all of this in detail, but it's worth reading through the code, especially given that the creation and initialization of the token mint both involve CPIs. Again, if you need a refresher on tokens and mints, have a look at the [Token Program lesson](./token-program).

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

Before you can start testing whether or not adding a review or comment sends you tokens, you need to initialize the program's token mint. You can use [this script](https://github.com/Unboxed-Software/solana-movie-token-client) to do that. Once you'd cloned that repository, replace the `PROGRAM_ID` in `index.ts` with your program's ID. Then run `npm install` and then `npm start`. The script assumes you're deploying to Devnet. If you're deploying locally, then make sure to tailor the script accordingly.

Once you've initialized your token mint, you can use the [Movie Review frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens) to test adding reviews and comments. Again, the code assumes you're on Devnet so please act accordingly.

After submitting a review, you should see 10 new tokens in your wallet! When you add a comment, you should receive 5 tokens. They won't have a fancy name or image since we didn't add any metadata to the token, but you get the idea.

If you need more time with the concepts from this lesson or got stuck along the way, feel free to [take a look at the solution code](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens). Note that the solution to this lab is on the `solution-add-tokens` branch.

# Challenge

To apply what you've learned about CPIs in this lesson, think about how you could incorporate them into the Student Intro program. You could do something similar to what we did in the lab here and add some functionality to mint tokens to users when they introduce themselves. Or if you're feeling really ambitious, think about how you could take all that you have learned so far in the course and create something completely new from scratch.

A great example would be to build a decentralized Stack Overflow. The program could use tokens to determine a user's overall rating, mint tokens when questions are answered correctly, allow users to upvote answers, etc. All of that is possible and you now have the skills and knowledge to go and build something like it on your own!

Congratulations on reaching the end of Module 4! Feel free to [share some quick feedback](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204), so that we can continue to improve the course.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=ade5d386-809f-42c2-80eb-a6c04c471f53)!
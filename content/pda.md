---
title: PDAs
objectives:
- Explain Program Derived Addresses (PDAs)
- Explain various use cases of PDAs
- Describe how PDAs are derived
- Use PDA derivations to locate and retrieve data
---


# Summary

- A **Program Derived Address** (PDA) is derived from a **program ID** and an optional list of **seeds**
- PDAs are owned and controlled by the program they are derived from
- PDA derivation provides a deterministic way to find data based on the seeds used for the derivation
- Seeds can be used to map to the data stored in a separate PDA account
- A program can sign instructions on behalf of the PDAs derived from its ID

# Lesson

## What is a Program Derived Address?

Program Derived Addresses (PDAs) are account addresses designed to be signed for by a program rather than a secret key. As the name suggests, PDAs are derived using a program ID. Optionally, these derived accounts can also be found using the ID along with a set of "seeds." More on this later, but these seeds will play an important role in how we use PDAs for data storage and retrieval.

PDAs serve two main functions:

1. Provide a deterministic way to find a given item of data for a program
2. Authorize the program from which a PDA was derived to sign on its behalf in the same way a user may sign with their secret key

In this lesson we'll focus on using PDAs to find and store data. We'll discuss signing with a PDA more thoroughly in a future lesson where we cover Cross Program Invocations (CPIs).

## Finding PDAs

PDAs are not technically created. Rather, they are *found* or *derived* based on a program ID and one or more input seeds.

Solana keypairs can be found on what is called the Ed25519 Elliptic Curve (Ed25519). Ed25519 is a deterministic signature scheme that Solana uses to generate corresponding public and secret keys. Together, we call these keypairs.

Alternatively, PDAs are addresses that lie *off* the Ed25519 curve. This means PDAs are not public keys, and don't have private keys. This property of PDAs is essential for programs to be able to sign on their behalf, but we'll cover that in a future lesson.

To find a PDA within a Solana program, we'll use the `find_program_address` function. This function takes an optional list of “seeds” and a program ID as inputs, and then returns the PDA and a bump seed.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### Seeds

“Seeds” are optional inputs used in the `find_program_address` function to derive a PDA. For example, seeds can be any combination of public keys, inputs provided by a user, or hardcoded values. A PDA can also be derived using only the program ID and no additional seeds. Using seeds to find our PDAs, however, allows us to create an arbitrary number of accounts that our program can own.

While you, the developer, determine the seeds to pass into the `find_program_address` function, the function itself provides an additional seed called a "bump seed." The cryptographic function for deriving a PDA results in a key that lies *on* the Ed25519 curve about 50% of the time. To ensure that the result *is not* on the Ed25519 curve and therefore does not have a secret key, the `find_program_address` function adds a numeric seed called a bump seed.

The function starts by using the value `255` as the bump seed, then checks to see if the output is a valid PDA. If the result is not a valid PDA, the function decreases the bump seed by 1 and tries again (`255`, `254`, `253`, et cetera). Once a valid PDA is found, the function returns both the PDA and the bump that was used to derive the PDA.

### Under the hood of `find_program_address`

Let's take a look at the source code for `find_program_address`.

```rust
 pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

Under the hood, the `find_program_address` function passes the input `seeds` and `program_id` to the `try_find_program_address` function.

The `try_find_program_address` function then introduces the `bump_seed`. The `bump_seed` is a `u8` variable with a value ranging between 0 to 255. Iterating over a descending range starting from 255, a `bump_seed` is appended to the optional input seeds which are then passed to the `create_program_address` function. If the output of `create_program_address` is not a valid PDA, then the `bump_seed` is decreased by 1 and the loop continues until a valid PDA is found.

```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

The `create_program_address` function performs a set of hash operations over the seeds and `program_id`. These operations compute a key, then verify if the computed key lies on the Ed25519 elliptic curve or not. If a valid PDA is found (i.e. an address that is *off* the curve), then the PDA is returned. Otherwise, an error is returned.

```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```

In summary, the `find_program_address` function passes our input seeds and `program_id` to the `try_find_program_address` function. The `try_find_program_address` function adds a `bump_seed` (starting from 255) to our input seeds, then calls the `create_program_address` function until a valid PDA is found. Once found, both the PDA and the `bump_seed` are returned.

Note that for the same input seeds, different valid bumps will generate different valid PDAs. The `bump_seed` returned by `find_program_address` will always be the first valid PDA found. Because the function starts with a `bump_seed` value of 255 and iterates downwards to zero, the `bump_seed` that ultimately gets returned will always be the largest valid 8-bit value possible. This `bump_seed` is commonly referred to as the "*canonical bump*". To avoid confusion, it's recommended to only use the canonical bump, and to *always validate every PDA passed into your program.*

One point to emphasize is that the `find_program_address` function only returns a Program Derived Address and the bump seed used to derive it. The `find_program_address` function does *not* initialize a new account, nor is any PDA returned by the function necessarily associated with an account that stores data.

## Use PDA accounts to store data

Since programs themselves are stateless, program state is managed through external accounts. Given that you can use seeds for mapping and that programs can sign on their behalf, using PDA accounts to store data related to the program is an extremely common design choice. While programs can invoke the System Program to create non-PDA accounts and use those to store data as well, PDAs tend to be the way to go.

If you need a refresher on how to store data in PDAs, have a look at the [Create a Basic Program, Part 2 - State Management lesson](./program-state-management).

## Map to data stored in PDA accounts

Storing data in PDA accounts is only half of the equation. You also need a way to retrieve that data. We'll talk about two approaches:

1. Creating a PDA "map" account that stores the addresses of various accounts where data is stored
2. Strategically using seeds to locate the appropriate PDA accounts and retrieve the necessary data

### Map to data using PDA "map" accounts

One approach to organizing data storage is to store clusters of relevant data in their own PDAs and then to have a separate PDA account that stores a mapping of where all of the data is.

For example, you might have a note-taking app whose backing program uses random seeds to generate PDA accounts and stores one note in each account. The program would also have a single global PDA "map" account that stores a mapping of users' public keys to the list of PDAs where their notes are stored. This map account would be derived using a static seed, e.g. "GLOBAL_MAPPING".

When it comes time to retrieve a user's notes, you could then look at the map account, see the list of addresses associated with a user's public key, then retrieve the account for each of those addresses.

While such a solution is perhaps more approachable for traditional web developers, it does come with some drawbacks that are particular to web3 development. Since the size of the mapping stored in the map account will grow over time, you'll either need to allocate more size than necessary to the account when you first create it, or you'll need to reallocate space for it every time a new note is created. On top of that, you'll eventually reach the account size limit of 10 megabytes.

You could mitigate this issue to some degree by creating a separate map account for each user. For example, rather than having a single PDA map account for the entire program, you would construct a PDA map account per user. Each of these map accounts could be derived with the user's public key. The addresses for each note could then be stored inside the corresponding user's map account.

This approach reduces the size required for each map account, but ultimately still adds an unnecessary requirement to the process: having to read the information on the map account *before* being able to find the accounts with the relevant note data.

There may be times where using this approach makes sense for your application, but we don't recommend it as your "go to" strategy.

### Map to data using PDA derivation

If you're strategic about the seeds you use to derive PDAs, you can embed the required mappings into the seeds themselves. This is the natural evolution of the note-taking app example we just discussed. If you start to use the note creator's public key as a seed to create one map account per user, then why not use both the creator's public key and some other known piece of information to derive a PDA for the note itself?

Now, without talking about it explicitly, we’ve been mapping seeds to accounts this entire course. Think about the Movie Review program we've been built in previous lessons. This program uses a review creator's public key and the title of the movie they're reviewing to find the address that *should* be used to store the review. This approach lets the program create a unique address for every new review while also making it easy to locate a review when needed. When you want to find a user's review of "Spiderman," you know that it is stored at the PDA account whose address can be derived using the user's public key and the text "Spiderman" as seeds.

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### Associated token account addresses

Another practical example of this type of mapping is how associated token account (ATA) addresses are determined. Tokens are often held in an ATA whose address was derived using a wallet address and the mint address of a specific token. The address for an ATA is found using the `get_associated_token_address` function which takes a `wallet_address` and `token_mint_address` as inputs.

```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

Under the hood, the associated token address is a PDA found using the `wallet_address`, `token_program_id`, and `token_mint_address` as seeds. This provides a deterministic way to find a token account associated with any wallet address for a specific token mint.

```rust
fn get_associated_token_address_and_bump_seed_internal(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    program_id: &Pubkey,
    token_program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            &wallet_address.to_bytes(),
            &token_program_id.to_bytes(),
            &token_mint_address.to_bytes(),
        ],
        program_id,
    )
}
```

The mappings between seeds and PDA accounts that you use will be highly dependent on your specific program. While this isn't a lesson on system design or architecture, it's worth calling out a few guidelines:

- Use seeds that will be known at the time of PDA derivation
- Be thoughtful about what data is grouped together into a single account
- Be thoughtful about the data structure used within each account
- Simpler is usually better

# Lab

Let’s practice together with the Movie Review program we've worked on in previous lessons. No worries if you’re just jumping into this lesson without having done the previous lesson - it should be possible to follow along either way.

As a refresher, the Movie Review program lets users create movie reviews. These reviews are stored in an account using a PDA derived with the initializer’s public key and the title of the movie they are reviewing.

Previously, we finished implementing the ability to update a movie review in a secure manner. In this lab, we'll add the ability for users to comment on a movie review. We'll use building this feature as an opportunity to work through how to structure the comment storage using PDA accounts.

### 1. Get the starter code

To begin, you can find [the movie program starter code](https://github.com/Unboxed-Software/solana-movie-program/tree/starter) on the `starter` branch.

If you've been following along with the Movie Review labs, you'll notice that this is the program we’ve built out so far. Previously, we used [Solana Playground](https://beta.solpg.io/) to write, build, and deploy our code. In this lesson, we’ll build and deploy the program locally.

Open the folder, then run `cargo-build-bpf` to build the program. The `cargo-build-bpf` command will output instruction to deploy the program.

```sh
cargo-build-bpf
```

Deploy the program by copying the output of `cargo-build-bpf` and running the `solana program deploy` command.

```sh
solana program deploy <PATH>
```

You can test the program by using the movie review [frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews) and updating the program ID with the one you’ve just deployed. Make sure you use the `solution-update-reviews` branch.

### 2. Plan out the account structure

Adding comments means we need to make a few decisions about how to store the data associated with each comment. The criteria for a good structure here are:

- Not overly complicated
- Data is easily retrievable
- Each comment has something to link it to the review it's associated with

To do this, we'll create two new account types:

- Comment counter account
- Comment account

There will be one comment counter account per review and one comment account per comment. The comment counter account will be linked to a given review by using a review's address as a seed for finding the comment counter PDA. It will also use the static string "comment" as a seed.

The comment account will be linked to a review in the same way. However, it will not include the "comment" string as a seed and will instead use the *actual comment count* as a seed. That way the client can easily retrieve comments for a given review by doing the following:

1. Read the data on the comment counter account to determine the number of comments on a review.
2. Where `n` is the total number of comments on the review, loop `n` times. Each iteration of the loop will derive a PDA using the review address and the current number as seeds. The result is `n` number of PDAs, each of which is the address of an account that stores a comment.
3. Fetch the accounts for each of the `n` PDAs and read the data stored in each.

This ensures that every one of our accounts can be deterministically retrieved using data that is already known ahead of time.

To implement these changes, we'll need to do the following:

- Define structs to represent the comment counter and comment accounts
- Update the existing `MovieAccountState` to contain a discriminator (more on this later)
- Add an instruction variant to represent the `add_comment` instruction
- Update the existing `add_movie_review` instruction processing function to include creating the comment counter account
- Create a new `add_comment` instruction processing function

### 3. Define `MovieCommentCounter` and `MovieComment` structs

Recall that the `state.rs` file defines the structs our program uses to populate the data field of a new account.

We’ll need to define two new structs to enable commenting.

1. `MovieCommentCounter` - to store a counter for the number of comments associated with a review
2. `MovieComment` - to store data associated with each comment

To start, let’s define the structs we’ll be using for our program. Note that we are adding a `discriminator` field to each struct, including the existing `MovieAccountState`. Since we now have multiple account types, we need a way to only fetch the account type we need from the client. This discriminator is a string that can be used to filter through accounts when we fetch our program accounts.

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

Since we've added a new `discriminator` field to our existing struct, the account size calculation needs to change. Let's use this as an opportunity to clean up some of our code a bit. We'll add an implementation for each of the three structs above that adds a constant `DISCRIMINATOR` and either a constant `SIZE` or function `get_account_size` so we can quickly get the size needed when initializing an account.

```rust
impl MovieAccountState {
    pub const DISCRIMINATOR: &'static str = "review";

    pub fn get_account_size(title: String, description: String) -> usize {
        return (4 + MovieAccountState::DISCRIMINATOR.len())
            + 1
            + 1
            + (4 + title.len())
            + (4 + description.len());
    }
}

impl MovieCommentCounter {
    pub const DISCRIMINATOR: &'static str = "counter";
    pub const SIZE: usize = (4 + MovieCommentCounter::DISCRIMINATOR.len()) + 1 + 8;
}

impl MovieComment {
    pub const DISCRIMINATOR: &'static str = "comment";

    pub fn get_account_size(comment: String) -> usize {
        return (4 + MovieComment::DISCRIMINATOR.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;
    }
}
```

Now everywhere we need the discriminator or account size we can use this implementation and not risk unintentional typos.

### 4. Create `AddComment` instruction

Recall that the `instruction.rs` file defines the instructions our program will accept and how to deserialize the data for each. We need to add a new instruction variant for adding comments. Let’s start by adding a new variant `AddComment` to the `MovieInstruction` enum.

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    AddComment {
        comment: String
    }
}
```

Next, let's create a `CommentPayload` struct to represent the instruction data associated with this new instruction. Most of the data we'll include in the account are public keys associated with accounts passed into the program, so the only thing we actually need here is a single field to represent the comment text.

```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

Now let’s update how we unpack the instruction data. Notice that we’ve moved the deserialization of instruction data into each matching case using the associated payload struct for each instruction.

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

Lastly, let's update the `process_instruction` function in `processor.rs` to use the new instruction variant we've created.

In `processor.rs`, bring into scope the new structs from `state.rs`.

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

Then in `process_instruction` let’s match our deserialized `AddComment` instruction data to the `add_comment` function we’ll be implementing shortly.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

### 5. Update `add_movie_review` to create comment counter account

Before we implement the `add_comment` function, we need to update the `add_movie_review` function to create the review's comment counter account.

Remember that this account will keep track of the total number of comments that exist for an associated review. It's address will be a PDA derived using the movie review address and the word “comment” as seeds. Note that how we store the counter is simply a design choice. We could also add a “counter” field to the original movie review account.

Within the `add_movie_review` function, let’s add a `pda_counter` to represent the new counter account we’ll be initializing along with the movie review account. This means we now expect four accounts to be passed into the `add_movie_review` function through the `accounts` argument.

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

Next, there's a check to make sure `total_len` is less than 1000 bytes, but `total_len` is no longer accurate since we added the discriminator. Let's replace `total_len` with a call to `MovieAccountState::get_account_size`:

```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into());
}
```

Note that this also needs to be updated in the `update_movie_review` function for that instruction to work properly.

Once we’ve initialized the review account, we’ll also need to update the `account_data` with the new fields we specified in the `MovieAccountState` struct.

```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Finally, let’s add the logic to initialize the counter account within the `add_movie_review` function. This means:

1. Calculating the rent exemption amount for the counter account
2. Deriving the counter PDA using the review address and the string "comment" as seeds
3. Invoking the system program to create the account
4. Set the starting counter value
5. Serialize the account data and return from the function

All of this should be added to the end of the `add_movie_review` function before the `Ok(())`.

```rust
msg!("create comment counter");
let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(MovieCommentCounter::SIZE);

let (counter, counter_bump) =
    Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref()], program_id);
if counter != *pda_counter.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument);
}

invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_counter.key,
        counter_rent_lamports,
        MovieCommentCounter::SIZE.try_into().unwrap(),
        program_id,
    ),
    &[
        initializer.clone(),
        pda_counter.clone(),
        system_program.clone(),
    ],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("comment counter created");

let mut counter_data =
    try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("checking if counter account is already initialized");
if counter_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = MovieCommentCounter::DISCRIMINATOR.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("comment count: {}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

Now when a new review is created, two accounts are initialized:

1. The first is the review account that stores the contents of the review. This is unchanged from the version of the program we started with.
2. The second account stores the counter for comments

### 6. Implement `add_comment`

Finally, let’s implement our `add_comment` function to create new comment accounts.

When a new comment is created for a review, we will increment the count on the comment counter PDA account and derive the PDA for the comment account using the review address and current count.

Like in other instruction processing functions, we'll start by iterating through accounts passed into the program. Then before we do anything else we need to deserialize the counter account so we have access to the current comment count:

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    Ok(())
}
```

Now that we have access to the counter data, we can continue with the remaining steps:

1. Calculate the rent exempt amount for the new comment account
2. Derive the PDA for the comment account using the review address and the current comment count as seeds
3. Invoke the System Program to create the new comment account
4. Set the appropriate values to the newly created account
5. Serialize the account data and return from the function

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let account_len = MovieComment::get_account_size(comment.clone());

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Created Comment Account");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("checking if comment account is already initialized");
    if comment_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    comment_data.discriminator = MovieComment::DISCRIMINATOR.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Comment Count: {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```

### 7. Build and deploy

We're ready to build and deploy our program!

Build the updated program by running `cargo-build-bpf`. Then deploy the program by running the `solana program deploy` command printed to the console.

You can test your program by submitting a transaction with the right instruction data. You can create your own script or feel free to use [this frontend](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments). Be sure to use the `solution-add-comments` branch and replace the `MOVIE_REVIEW_PROGRAM_ID` in `utils/constants.ts` with your program's ID or the frontend won't work with your program.

Keep in mind that we made breaking changes to the review accounts (i.e. adding a discriminator). If you were to use the same program ID that you've used previously when deploying this program, none of the reviews you created previously will show on this frontend due to a data mismatch.

If you need more time with this project to feel comfortable with these concepts, have a look at the [solution code](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments) before continuing. Note that the solution code is on the `solution-add-comments` branch of the linked repository.

# Challenge

Now it’s your turn to build something independently! Go ahead and work with the Student Intro program that we've used in past lessons. The Student Intro program is a Solana program that lets students introduce themselves. This program takes a user's name and a short message as the `instruction_data` and creates an account to store the data onchain. For this challenge you should:

1. Add an instruction allowing other users to reply to an intro
2. Build and deploy the program locally

If you haven't been following along with past lessons or haven't saved your work from before, feel free to use the starter code on the `starter` branch of [this repository](https://github.com/Unboxed-Software/solana-student-intro-program/tree/starter).

Try to do this independently if you can! If you get stuck though, feel free to reference the [solution code](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies). Note that the solution code is on the `solution-add-replies` branch and that your code may look slightly different.


## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=89d367b4-5102-4237-a7f4-4f96050fe57e)!
# Program Architecture

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Use **Box** and **Zero Copy** to work with large data on-chain
- Make PDA design decisions

- Future-proof your programs
- Deal with concurrency issues

# TL;DR

- If your data accounts are too large, wrap them in Box
- Zero-Copy is how you deal with large accounts ( < 10MB )
- The size and the order of structs in an account matters
- Solana can process in parallel, but you can still run into bottlenecks

# Overview

Program Architecture is what separates the hobbiest from the professional. See, crafting programs has very little to do with the code and it has everything to do with the ******design****** of the system. And you, as the designer, needs to think about: what your code needs to do, what possible implementations there are, and what are the tradeoffs. These questions are even more important when developing for Solana. You are dealing with people’s assets; code has cost now. Additionally, the Solana runtime is not like your normal computer - it’s limited in nature. When I say limited, I mean there are limitations on how much data can be stored on the chain, the cost to store that data and a limited number of compute units per transaction. We have to be mindful of these limitations to create programs that are affordable, fast, safe and functional. Today we will be delving into some of the more advance considerations that should be taken when creating Solana programs.

This lesson is going to be accompanied by little snippets of Solana program code. I have wrapped these snippets into an actual Solana program and written accompanying tests. When you go through the lesson, I want you to play with the corresponding program and test code. Play with values, try to break it, see how everything works. At the end, we will put all of these concepts to use when making a little Solana RPG game engine. 

### Setting up the Accompanying Code

1.  **Clone and Build**
    1. `git clone https://github.com/Unboxed-Software/advance-program-architecture.git`
    2. `cd advance-program-architecture`
    3. `yarn install`
    4. `anchor build`
2. **Setup Program Environment**
    1. `anchor keys list` take the output key from that command and paste it in 2 places:
        1. `programs/architecture/src/lib.rs` → `declare_id!("YOUR_KEY_HERE");`
        2. `Anchor.toml` → `architecture = "YOUR_KEY_HERE"`
    2.  Change the `Anchor.toml` file provider section to your Solana CLI wallet path ( run `solana config get` ) 
        
        ```rust
        [provider]
        cluster = "Localnet"
        wallet = "/Users/coach/.config/solana/id.json" <--- Change This
        ```
        
3. **Verify**
    1. `anchor test`

The tests should take a couple of minutes to run, but they should all pass. 

### How to use the Accompanying Code

When going through the lesson each concept will have a corresponding program and test file. For example, we will be first be looking at the different data sizes in Solana, the header will be **Concept Sizes**. The files for this can be found in:

**program -** `programs/architecture/src/concepts/concept_sizes.rs`

**test -** `cd tests/conceptSizes.ts`

I will want you to have the files open so you can play with them. Playing with the code will be the crux of your learning here - so it is important, please don’t skip the playing! Now you probably don’t want to run all the tests over and over again, so you can single them out. So when you’re playing with a concept, you can rebuild and test quickly to see the changes. To do this we want to change the test file you are currently working on.

So let’s say you want to only run the `tests/conceptSizes.ts` concept. All you have to do is open it up and change the `describe(...`  function and change it to `describe.only(...`

```rust
...
describe.only("Concept Sizes", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
...
```

Then run `anchor test` it will rebuild and run only that group of tests for you. 

When you are done playing, be sure to remove the `.only` and move onto the next concept!

With all of that out of the way! Let’s move into our first grouping of considerations! Data Sizes!

## Dealing with Data Size

In modern programming, specifically when creating applications, we don’t really have to think about the size of the data structs we are using. You want to make a string? Put a 4000 character limit on it, just so people don’t abuse it. Want an int? They’re pretty much always 32bit for connivence. In high level languages, you are in the data-land-o-plenty! Now, in Solana land, we pay per byte stored ( rent ), have have limited heap, stack and account sizes, we have to be a little more crafty with our bytes. There are two main concerns we are going to be looking at in this section: 

1. Since we pay-per-byte, we generally want to keep our footprint as small as possible. We will delve more into optimization in another section, but I’ll introduce you to the concept of data sizes here.

2. When operating on larger data, we run into [Stack](https://docs.solana.com/developing/on-chain-programs/faq#stack) and [Heap](https://docs.solana.com/developing/on-chain-programs/faq#heap-size) constraints - to get around these, we’ll look at using Box and Zero-Copy.

### Concept Sizes

**program -** `programs/architecture/src/concepts/concept_sizes.rs`

**test -** `cd tests/conceptSizes.ts`

In Solana we pay, or your user pays, for each byte stored on the Solana blockchain. We call this [rent](https://docs.solana.com/developing/intro/rent). Side note, I think the term rent is a little misleading - they don’t take money out the account, once you pay, that data is there forever ( unless you choose the close the account ). It has to do with what’s called minimum rent exemption, which is enforced, I suggest reading about it [here](https://docs.solana.com/developing/intro/rent). Anyways, data on the blockchain is expensive ( it’s why NFT data, like the image, is stored off-chain ). We want to strike a balance of having all the bells and whistles we want in a program without becoming so expensive that our users don’t want to pay to open the data account. The first thing you need to know before you can start optimizing for space in your program is knowing how many bytes each of your structs take up. Below is a very helpful list from the [Anchor Book](https://book.anchor-lang.com/anchor_references/space.html). 

| Types | Space in bytes | Details/Example |
| --- | --- | --- |
| bool | 1 | would only require 1 bit but still uses 1 byte |
| u8/i8 | 1 |  |
| u16/i16 | 2 |  |
| u32/i32 | 4 |  |
| u64/i64 | 8 |  |
| u128/i128 | 16 |  |
| [T;amount] | space(T) * amount | e.g. space([u16;32]) = 2 * 32 = 64 |
| Pubkey | 32 |  |
| Vec<T> | 4 + (space(T) * amount) | Account size is fixed so account should be initialized with sufficient space from the beginning |
| String | 4 + length of string in bytes | Account size is fixed so account should be initialized with sufficient space from the beginning |
| Option<T> | 1 + (space(T)) |  |
| Enum | 1 + Largest Variant Size | e.g. Enum { A, B { val: u8 }, C { val: u16 } } -> 1 + space(u16) = 3 |
| f32 | 4 | serialization will fail for NaN |
| f64 | 8 | serialization will fail for NaN |
| Accounts | 8 + space(T) | #[account()] 
pub struct T { …  |
| Data Structs | space(T) | #[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct T { … } |

Knowing these, I want you to start thinking about little optimizations you might take in a program. For example, if you use a variable that will only ever reach 100, don’t use a u64/i64, use a u8. Why? Because a u64 takes up 8 bytes, with a max value of 2^64 or 1.84 * 10^19. Thats a waste, since you only need up to 100, which 1 byte with a max value of 255 would be totally sufficient. 

And general rule of thumb, use u8 ( unsigned ) vs i8 ( signed ). If you don’t know the difference it would be a perfect question for chatGPT!

If your unfamiliar with max values for each data type or what’s possible, play around with the accompanying code! There are a lot of good comments there to show you the space each struct takes up. 

Last little challenge, in the test code, see what happens if you add 1 to a u8 with a value of 0xFF. We call this an overflow, make sure it’s desired behaviour - this is how system shattering bugs are made. If you want context, look up the **[Y2K bug](https://www.nationalgeographic.org/encyclopedia/Y2K-bug/#:~:text=As%20the%20year%202000%20approached%2C%20computer%20programmers%20realized%20that%20computers,would%20be%20damaged%20or%20flawed.).** 

If you want to read more about sizes pertaining to anchor, take a look [here](https://www.sec3.dev/blog/all-about-anchor-account-size) 

### Box

**program -** `programs/architecture/src/concepts/concept_box.rs`

**test -** `cd tests/conceptBox.ts`

Now that you know a little bit about data sizes, let’s skip forward a little bit and look at a problem you’ll run into if you want to deal with larger data accounts. Say we have the following data account: 

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Account<'info, SomeBigDataStruct>,
}
```

If you try to pass `SomeBigDataStruct` into the function with the `SomeFunctionContext` context, you’ll run into the following compiler warning:

`// Stack offset of XXXX exceeded max offset of 4096 by XXXX bytes, please minimize large stack variables`

And if you try to run the program it will just hang and fail.

Why is this?

It has to do with the Stack. Every time you call a function in Solana it gets a 4KB stack frame. This is static memory allocation for local variables. So this is where that entire `SomeBigDataStruct` is stored in memory and since 5000 bytes or 5KB > 4KB, it will throw a stack error. So how do we reduce this?

The answer is **`Box<T>`!**

```rust
#[account]
pub struct SomeBigDataStruct {
    pub big_data: [u8; 5000],
}  

#[derive(Accounts)]
pub struct SomeFunctionContext<'info> {
    pub some_big_data: Box<Account<'info, SomeBigDataStruct>>, // <- Box Added!
}
```

In Anchor, **`Box<T>`** is used to allocate the account to the Heap, not the Stack. Which is great since the Heap gives us 32KB to work with. And, the best part, you don’t have to do anything different within the function! Literally, if you get that compiler warning, just slap a Box<…> around all of your big data accounts!

But Box is not perfect. You can still overflow the stack with sufficiently big or numerous accounts. ( I implore you to try in the accompanying code - break the stack ). We can also run out of Heap memory as well, the answer to this is called `zero-copy` which we will look at next. It’s what allows us to manipulate accounts with the maximum size of 10MB. 

### Zero Copy

**program -** `programs/architecture/src/concepts/concept_zero_copy.rs`

**test -** `cd tests/conceptZeroCopy.ts`

Okay, so now we we can deal with medium sized accounts using `Box<>`. But what if we want to play with big accounts, like the max sized account of 10MB? We’ll need another tact. Take the following:

```rust
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}
```

This will fail, even wrapped in a `Box<>` - you should verify this playing with the accompanying code. So how can initialize or edit the data here? The answer is `zero_copy` and `AccountLoader`.

```rust
#[account(zero_copy)]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}

pub struct ConceptZeroCopy<'info> {
    #[account(zero)]
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

How does zero_copy do this? Let’s take a look at their rust [documentation](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)

> Other than being more efficient [zero_copy], the most salient benefit this provides is the ability to define account types larger than the max stack or heap size. When using borsh, the account has to be copied and deserialized into a new data structure and thus is constrained by stack and heap limits imposed by the BPF VM. With zero copy deserialization, all bytes from the account’s backing `RefCell<&mut [u8]>` are simply re-interpreted as a reference to the data structure. No allocations or copies necessary. Hence the ability to get around stack and heap limitations.
> 

So basically, we never actually load the data into the stack or heap. We’re instead given access to the raw data, and the folks at Anchor made the super nice `AccountLoader` to help us with that.

There are a couple of caveats using `zero_copy`. First, you cannot call init in the context like you may be used to.

```rust
pub struct ConceptZeroCopy<'info> {
    #[account(zero, init)] // <- Can't do this
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

Why is this? Because there is a CPI ( Cross Program Invocation ) limit on accounts bigger than 10KB. And the `init` macro CPIs into the system program to reserve `space` amount of bytes. So, Instead you have to create the large account and pay for it’s rent in a separate transaction.

```tsx
const accountSize = 16_384 + 8
    const ix = anchor.web3.SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: someReallyBigData.publicKey,
      lamports: await program.provider.connection.getMinimumBalanceForRentExemption(accountSize),
      space: accountSize,
      programId: program.programId,
    });

    const txHash = await program.methods.conceptZeroCopy().accounts({
      owner: wallet.publicKey,
      someReallyBigData: someReallyBigData.publicKey,
    }).signers([
      someReallyBigData,
    ]).preInstructions([
      ix
    ])
    .rpc()
```

And then, in the actual rust function, you’ll have to call one of 3 methods from the rust docs:

> - `load_init` after initializing an account (this will ignore the missing account discriminator that gets added only after the user’s instruction code)
> 
> 
> - `load` when the account is not mutable
> 
> - `load_mut` when the account is mutable
> 

For example, if you wanted to init and manipulate the `SomeReallyBigDataStruct` from above, you’d call the following in the function

`let some_really_big_data = &mut ctx.accounts.some_really_big_data.load_init()?;`

After you do that, then you can treat the account like normal! I urge you to play around with this in the code yourself to see everything in action!

For a better understanding on how this all works, Solana put together a really nice video and code explaining Box and Zero-Copy in vanilla Solana.

video - [https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be](https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be)

code - [https://github.com/solana-developers/anchor-zero-copy-example](https://github.com/solana-developers/anchor-zero-copy-example)

## Dealing with Accounts

Now that we’ve talked about the nuts and bolts of space consideration on Solana, let’s look into some higher level considerations. In Solana, everything is an account, so every byte you save, is in an account, everything you interact with is an account. So for the next couple sections we will be looking at some account architecture concepts.

### Data Order

**program -** `programs/architecture/src/concepts/concept_data_order.rs`

**test -** `cd tests/conceptDataOrder.ts`

This first consideration is fairly simple. As a rule of thumb, keep all variable length structs at the end of the account. What do I mean by this? Take a look at the following:

```rust
#[account] // Anchor hides the account disriminator
pub struct BadState {
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
    pub id: u32         // 0xDEAD_BEEF
}
```

The `flags` is variable length, which means when this struct is serialized the `id` bytes get pushed farther into the memory map. To make this more clear, lets look at what this account looks like on-chain. Assume you have two of the `BadState` data accounts on-chain, one with four flags, the other with eight. If you were to call `solana account ACCOUNT_KEY` you’d get a data dump like the following: 

```rust
0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	04 00 00 00    11 22 33 44  -> Vec Size (4) | Data 4*(1)
0010:   DE AD BE EF                 -> id (4)

--- vs ---

0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	08 00 00 00    11 22 33 44  -> Vec Size (8) | Data 4*(1)
0010:   55 66 77 88    DE AD BE EF  -> Data 4*(1) | id (4)
```

The first 8 bytes are the account discriminator, the next 4 represent the size of the `flags` Vec, followed by the data in the `flags`Vec: 11, 22, 33… lastly we have the last four bytes of the `id` DEAD_BEEF. As you can see the `id` moved from address 0x0010 to 0x0014, when we increased the number of flags.

The main problem with this is lookup. When we query Solana we use filters to look at the raw data within the account. This filter is called a `memcmp` or memory compare. We give it an `offset` ( address ) and the `bytes` we want to compare. For example, we know that the `flags` struct will always start at address 0x0008. So we could query all accounts where `flags` length is equal to 4.

```rust
const states = await program.account.badState.all([
      {memcmp: {
        offset: 8,
        bytes: bs58.encode([0x04])
      }}
    ]);
```

However, how would you do this if you wanted to query by the `id`? Currently you would not be able to, because its position in the data struct is not static - you’d have no way of knowing where it was unless you also knew the `flags` length. That doesn’t seem very helpful, IDs are usually there to query. The simple fix? Flip the order!

```rust
#[account] // Anchor hides the account disriminator
pub struct GoodState {
		pub id: u32         // 0xDEAD_BEEF
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
}
```

Now you always know where the `id` is, and can query it. Plus, you can still query by the `flags` length. So to echo the beginning of this section: As a rule of thumb, keep all variable length structs at the end of the account.

### For Future Use

**program -** `programs/architecture/src/concepts/concept_for_future_use.rs`

**test -** `cd tests/conceptForFutureUse.ts`

This is another fairly simple concept. When designing Solana programs you may want to consider adding in `for_future_use` bytes. If you’ve ever been involved in protocol development you may have seen them. They are used for flexibility and backwards compatibility. The tradeoff is you pay for bytes you don’t use. So why would you want to add them? Let’s take the following example:

```rust
#[account]
pub struct GameState {
    pub health: u64,
    pub mana: u64,
}
```

We have a simple game state here, a character has `health` and some `mana`. You build the game and now you have thousands of players. Now, let’s say you want to add an `experince` field. So you add  `pub experince: u64`. The problem is, all of your existing players paid rent for 24 bytes of storage ( 8 account discriminator + 8 health + 8 mana ). The old and the new `GameState` with `experince` in it are no longer compatible. You’d probably have to create a system to migrate their accounts, which sounds like a really big pain in the ass. The old accounts will not serialize. The fix?

```rust
#[account]
pub struct GameState { //V1
    pub health: u64,
    pub mana: u64,
		pub for_future_use: [u8; 128],
}

--->

#[account]
pub struct GameState { //V2
    pub health: u64,
    pub mana: u64,
		pub experince: u64,
		pub for_future_use: [u8; 120],
}
```

If you put in the `for_future_use` bytes you can now use up those bytes in future updates without ever having to migrate accounts! Personally, this has saved my butt. 

So general rule of thumb - anytime you think your program has the potential to change, add in some `for_future_use` bytes. The trade off, your end user will have to pay more. 

### Data Optimization

**program -** `programs/architecture/src/concepts/concept_data_optimization.rs`

**test -** `cd tests/conceptDataOptimization.ts`

The general theme here is pick the right data struct for the job. More specifically, don’t waste bits if you don’t have to. 

For example, if you have variable for what month it is, don’t use a `u64` there only ever be 12 months, use a `u8`. Better yet use a `u8` Enum and label the months. 

That may seem obvious, but there is another consideration, flags - a variable can mean many different things depending on each bit. Take for example this game state where the character may have several status effects.

```rust
#[account]
pub struct BadGameFlags { // 8 bytes
    pub is_frozen: bool,
    pub is_poisoned: bool,
    pub is_burning: bool,
    pub is_blessed: bool,
    pub is_cursed: bool,
    pub is_stunned: bool,
    pub is_slowed: bool,
    pub is_bleeding: bool,
}
```

You could assign a `bool` to each one - taking up 1 byte each. OR you could make a status_flag variable and cut it down, effectively turning each bit into a bool.

```rust
const IS_FROZEN_FLAG: u8 = 1 << 0;
const IS_POISONED_FLAG: u8 = 1 << 1;
const IS_BURNING_FLAG: u8 = 1 << 2;
const IS_BLESSED_FLAG: u8 = 1 << 3;
const IS_CURSED_FLAG: u8 = 1 << 4;
const IS_STUNNED_FLAG: u8 = 1 << 5;
const IS_SLOWED_FLAG: u8 = 1 << 6;
const IS_BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;
#[account]
pub struct GoodGameFlags { // 1 byte
    pub status_flags: u8, 
} 
```

See! You just saved 8 bytes of data you could put to good `for_future_use`. The tradeoff, of course, is now you have to do bitwise operations. Just another tool for your toolkit!

### Indexing

**program -** `programs/architecture/src/concepts/concept_indexing.rs`

**test -** `cd tests/conceptIndexing.ts`

This last account concept is kinda fun, I hope it shows you the power of PDAs. When creating program accounts you can specify the seeds that make it up. This is exceptionally powerful, because now, we can derive our account addresses without having to remember them all!

The best example of this is good ‘ol Associated Token Accounts (ATAs)!

```rust
function findAssociatedTokenAddress(
    walletAddress: PublicKey,
    tokenMintAddress: PublicKey
): PublicKey {
    return PublicKey.findProgramAddressSync(
        [
            walletAddress.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            tokenMintAddress.toBuffer(),
        ],
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )[0];
}
```

This is how most of your SPL tokens are stored. The only thing you have to know is your wallet address and the mint address - the ATA hashes these together and viola! Your token account!

But that’s not where the wonderment of PDAs stop! Depending on the seeding you can make many relationships!

- Single Account - Here you provide a private key, and there will only ever be one like it! This would be like a `mint` account! There can only be one mint per currency.
- Global Account - If you create an account with a determined `seeds=[b"ONE PER PROGRAM"]` only one can ever exist for that seed in that program. Say you wanted to make a lookup table that you stored on the Solana for your program. You could seed it with `seeds=[b"Lookup"]`, you probably want to make sure that only you have access to it.
- One-Per-Owner - Say you’re creating a video game player account and you only want one player account per wallet. Then you’d seed the account with `seeds=[b"PLAYER", owner.key().as_ref()]` This way, you’ll always know where to look for a wallet’s player account ****and**** there can only ever be one of them!
- Multiple-Per-Owner - Okay, but what if you want multiple accounts per wallet? Say you want to mint podcast episodes and you can index them by episode number? Well, then you could seed your `Podcast` account like this: `seeds=[b"Podcast", owner.key().as_ref(), episode_number.to_be_bytes().as_ref()]` Now, if you want to lookup episode 50, you can! And you can have as many episodes as you want per one owner!
- One-Per-Owner-Per-Account - This is effectively the ATA example we saw above. Where we have one token account per wallet and mint account. `seeds=[b"Mock ATA", owner.key().as_ref(), mint.key().as_ref()]`

From there you can mix and match in all sorts of clever ways! But the preceding list should give you enough to get started. 

The big benefit of really paying attention to this aspect of design is answering the ‘indexing’ problem. Without PDAs and seeds, all users would have to keep track of all of the addresses of all of the accounts they’ve ever used! This would be a major headache - you’d probably have to store everything in a database with which account did which! PDAs are a much better solution. 

To drive this all home, let me share with you a scheme that I’ve used in a production program - the creator/creation account scheme:

Say you wanted to make a podcasting platform. You’d probably want two different account types:

- **Channel Account**
    - Name
    - Episodes Created ( u64 )
- **Podcast Account(s)**
    - Name
    - Audio URL

Take a second and see if you could come up with a good seeding scheme for these guys. And ask yourself, why would you store how many episodes created in the Channel account.

Here is what I came up with:

```rust
// Channel Account
seeds=[b"Channel", owner.key().as_ref()]

// Podcast Account
seeds=[b"Podcast", channel_account.key().as_ref(), episode_number.to_be_bytes().as_ref()]
```

And the reason you’d want to store the amount of podcasts created is so you know the upper bound of where to search. Additionally you’d always know what index to create a new episode at! index = episodes_created

```rust
Podcast 0: seeds=[b"Podcast", channel_account.key().as_ref(), 0.to_be_bytes().as_ref()] 
Podcast 1: seeds=[b"Podcast", channel_account.key().as_ref(), 1.to_be_bytes().as_ref()] 
Podcast 2: seeds=[b"Podcast", channel_account.key().as_ref(), 2.to_be_bytes().as_ref()] 
...
Podcast X: seeds=[b"Podcast", channel_account.key().as_ref(), X.to_be_bytes().as_ref()] 
```

If you want to play with these relationships more, please play with the accompanying code. 

## Dealing with Concurrency

We come to our last section of this lesson - we are going to talk about what happens when multiple people try to interact - more specifically, change the same account at the same time. Solana has parallel transaction execution, but only when two people are not trying to change the same account. We will talk about this and potential work arounds.

### Shared Accounts

**program -** `programs/architecture/src/concepts/concept_shared_account.rs`

**test -** `cd tests/conceptSharedAccount.ts`

If you’ve been around Solana for a while, you may have experienced a mint event. A new NFT project is coming out, everyone is really excited for it, and then the candymachine goes live. It’s a mad dash to click `accept transaction` as fast as you can. If you were clever, you may have written a bot to enter in the transactions faster that the website’s UI could. This mad rush to mint creates a lot of failed transactions, why? Because everyone was trying to effect the same Candy Machine account. Why does this happen? Let’s take a look at a simpler example:

Alice and Bob are trying to pay their friends Carol and Dean respectively. All four accounts change, but neither depend on each other, so they can all go in the same block. They can be processed individually.

```rust
Alice -- pays --> Carol

Bob ---- pays --> Dean
```

Now, let’s look at what happens when Alice and Bob try to pay Carol at the same time. 

```rust
Alice -- pays --> |
									-- > Carol
Bob   -- pays --- |
```

States in the blockchain are atomic, so only one of these gets through at a time. Fortunately Solana is wicked fast, so it’ll probably seem like they get paid at the same time. But what happens if more than just Alice and Bob try to pay Carol?

```rust
Alice -- pays --> |
									-- > Carol
x1000 -- pays --- | 
Bob   -- pays --- |
```

What if 1000 people try to pay Carol at the same time? Those payments will slow down, or just fail. If you want to see what that looks like in practice, play with the accompanying code - and play around with the numbers.

Why bring up this specific scenario? Simply: Community Wallets. Say you create a super popular program and you want to take a fee on every transaction you process. For accounting reasons you want all of those fees to go to one wallet. With that setup, on a surge of users, your protocol will become slow and or become unreliable. Not great. So what’s the solution? Separate the data transaction from the fee transaction. Let’s take a look at the accompanying code for a better idea of what I mean here.

Say I have a data account called `DonationTally` and it’s only function is to record how much you have donated to a specific hard-coded community wallet.

```rust
#[account]
pub struct DonationTally {
    is_initialized: bool,
    lamports_donated: u64,
    lamports_to_redeem: u64,
    owner: Pubkey,
}
```

First let’s look at the bottleneck solution that - it’s simpler, but on surges it’s prone to slow down.

```rust
pub fn run_concept_shared_account_bottleneck(ctx: Context<ConceptSharedAccountBottleneck>, lamports_to_donate: u64) -> Result<()> {

    let donation_tally = &mut ctx.accounts.donation_tally;

    if !donation_tally.is_initialized {
        donation_tally.is_initialized = true;
        donation_tally.owner = ctx.accounts.owner.key();
        donation_tally.lamports_donated = 0;
        donation_tally.lamports_to_redeem = 0;
    }

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: ctx.accounts.community_wallet.to_account_info(),
        });
    transfer(cpi_context, lamports_to_donate)?;
    

    donation_tally.lamports_donated = donation_tally.lamports_donated.checked_add(lamports_to_donate).unwrap();    
    donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

You can see that the transfer to the `community_wallet` ( Hardcoded ) happens in the same function that you update the tally information. Again, this is the most straightforward solution, but if you run the tests for this section, you’ll see the slowdown. Now, let’s look at the more complex, non-bottleneck solution

```rust
pub fn run_concept_shared_account(ctx: Context<ConceptSharedAccount>, lamports_to_donate: u64) -> Result<()> {

    let donation_tally = &mut ctx.accounts.donation_tally;

    if !donation_tally.is_initialized {
        donation_tally.is_initialized = true;
        donation_tally.owner = ctx.accounts.owner.key();
        donation_tally.lamports_donated = 0;
        donation_tally.lamports_to_redeem = 0;
    }

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(), 
        Transfer {
            from: ctx.accounts.owner.to_account_info(),
            to: donation_tally.to_account_info(),
        });
    transfer(cpi_context, lamports_to_donate)?;

    donation_tally.lamports_donated = donation_tally.lamports_donated.checked_add(lamports_to_donate).unwrap();    
    donation_tally.lamports_to_redeem = donation_tally.lamports_to_redeem.checked_add(lamports_to_donate).unwrap();

    Ok(())
}

pub fn run_concept_shared_account_redeem(ctx: Context<ConceptSharedAccountRedeem>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.donation_tally.lamports_donated;

    // Decrease balance in donation_tally account
    **ctx.accounts.donation_tally.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;

    // Increase balance in community_wallet account
    **ctx.accounts.community_wallet.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    // Reset lamports_donated and lamports_to_redeem
    ctx.accounts.donation_tally.lamports_to_redeem = 0;

    Ok(())
}
```

Here, in the `run_concept_shared_account` function, instead of transferring to the bottleneck, we transfer to the `donation_tally` PDA! This way, we’re only effecting the donators account and their PDA - so no bottleneck! Additionally, we keep an internal tally of how many lamports need to be redeemed, ie be transferred from the PDA to the community wallet at a later time. At some point in the future, the community wallet will go around and clean up all the straggling lamports. ( Probably a good job for [clockwork](https://www.clockwork.xyz/) ) It’s important to note that anyone should be able to sign for the redeem function, since the PDA has permission over itself.

So there you go, if you want to avoid bottlenecks at all costs, this would be one way to tackle it. However, this is a design decision, for most cases, I think you should use the simpler first option that has the potential to be bottlenecked. It’s simpler and it doesn’t need a bunch of secondary transactions to actually receive the funds. If you feel like this bottleneck may be a potential problem, I would run a simulation much like the accompanying code does and look at your worst, best and median cases. 

## Conclusion

So there you have it! A smattering of program architecture considerations. We talked about bytes, accounts and bottlenecks. This specific considerations may not come up, but I hope the lesson has sparked some thought. And remember, at the end of the day, you are the designer of the system. Your job is to weigh the pros and cons. Be forward thinking, but be practical. There is no one good way to design anything, just know the trade-offs.

# Demo

### Program Setup

Today we will be taking all of the concepts above to create a simple RPG game engine in Solana. In this program you will create a `Game` where anyone can create a `Player` account. When they have that, they can spend `action_points` ( lamports ) that go to the `Game`'s treasury wallet. Actions include spawning and attacking `Monster` accounts. Let’s get started!

```powershell
anchor init rpg
anchor build
```

Everything should be ready for us to start writing our program. We are going to keep it simple and keep everything in the `lib.rs` file so you can see all of the interactions.

But to make it easier we are going to section off the program with comments. Additionally, we are going to remove the default `initialize` function and add the `Transfer` and `sol_log_compute_units` imports. Change your `lib.rs` to reflect the following:

```rust
use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};
use anchor_lang::solana_program::log::sol_log_compute_units;

declare_id!("YOUR_KEY_HERE__YOUR_KEY_HERE");

// ----------- ACCOUNTS ----------

// ----------- GAME CONFIG ----------

// ----------- STATUS ----------

// ----------- INVENTORY ----------

// ----------- HELPER ----------

// ----------- CREATE GAME ----------

// ----------- CREATE PLAYER ----------

// ----------- SPAWN MONSTER ----------

// ----------- ATTACK MONSTER ----------

// ----------- REDEEM TO TREASUREY ----------

#[program]
pub mod rpg {
    use super::*;

}
```

Be sure to replace `YOUR_KEY_HERE__YOUR_KEY_HERE` with your program key that you get from running `anchor keys list`

### Accounts

The first thing we need to do is create the Accounts. We will have 3: `Game`, `Player`, `Monster`

```rust
// ----------- ACCOUNTS ----------
#[account]
pub struct Game { // 8 bytes
    pub game_master: Pubkey,            // 32 bytes
    pub treasury: Pubkey,               // 32 bytes

    pub action_points_collected: u64,   // 8 bytes
    
    pub game_config: GameConfig,

    pub for_future_use: [u8; 256],      // Rewards?? Creators?? NFT?? ?? RNG Seeds??
}

#[account]
pub struct Player { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub action_points_spent: u64,               // 8 bytes
    pub action_points_to_be_collected: u64,     // 8 bytes

    pub status_flag: u8,                // 8 bytes
    pub experince: u64,                 // 8 bytes
    pub kills: u64,                     // 8 bytes
    pub next_monster_index: u64,        // 8 bytes

    pub for_future_use: [u8; 256],      // Attack/Speed/Defense/Health/Mana?? Metadata??

    pub inventory: Vec<InventoryItem>,  // Max 8 items
}

#[account]
pub struct Monster { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub hitpoints: u64,                 // 8 bytes

    pub for_future_use: [u8; 256],      // Items to drop?? Hitpoints?? Metadata?? Hitpoints??
}

// ----------- GAME CONFIG ----------
```

Let’s take a look at each.

`Game` - This account holds two really important things, the `treasury` wallet for all players to pay their `action_points` ( lamports ) into. And the `game_config` which allows the game to be customizable across all players and monsters. You may have noticed I added in a `for_future_use` section - a game can be expanded, we’d want to make room for that!

`Player` - This account will be PDA’d off of the `game` account and the `player`'s wallet. It holds all sorts of goodies pertaining that a player in an RPG may need. Again, we have the `for_future_use` section just in case.

`Monster` - This account is spawned by the player so it is PDA’d off of the `game`, `player`, and an index ( which we store as `next_monster_index` in the `Player` account )

### Game Config

The second thing we need to add is the game config struct - technically, this could have gone in the `Game` account, but I wanted the nice separation.

```rust
// ----------- GAME CONFIG ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct GameConfig {
    pub max_items_per_player: u8,
    pub for_future_use: [u64; 16], // Health of Enimies?? Experince per item?? Action Points per Action??
}

// ----------- STATUS ----------
```

Right now, we only dictate how many items a player can carry, but with the `for_future_use` we could expand the game’s rules.

### Statuses

```rust
// ----------- STATUS ----------

const IS_FROZEN_FLAG: u8 = 1 << 0;
const IS_POISONED_FLAG: u8 = 1 << 1;
const IS_BURNING_FLAG: u8 = 1 << 2;
const IS_BLESSED_FLAG: u8 = 1 << 3;
const IS_CURSED_FLAG: u8 = 1 << 4;
const IS_STUNNED_FLAG: u8 = 1 << 5;
const IS_SLOWED_FLAG: u8 = 1 << 6;
const IS_BLEEDING_FLAG: u8 = 1 << 7;
const NO_EFFECT_FLAG: u8 = 0b00000000;

// ----------- INVENTORY ----------
```

Just to show off some bit magic, we have statuses. This is so we can fit all of the statuses in one byte, where each bit corresponds to a different status.

### Inventory

```rust
// ----------- INVENTORY ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InventoryItem {
    pub name: [u8; 32], // Fixed Name up to 32 bytes
    pub amount: u64,
    pub for_future_use: [u8; 128], // Metadata?? // Effects // Flags?
}

// ----------- HELPER ----------
```

To show data ordering we have an inventory system. You may have seen it’s at the bottom of the `Player` account. You might think that 128 bytes is a little overkill on the `for_future_use` - maybe, that’s the design decision you have to come up with.  One suggestion, if each Item was an NFT, you’d want to store the `mint` pubkey here, which is 32 bytes.

### Helper

This is the last piece to setup before we get into the actual functions.

```rust
// ----------- HELPER ----------

pub fn spend_action_point<'info>(
    action_points: u64, 
    player_account: &mut Account<'info, Player>,
    player: &AccountInfo<'info>, 
    system_program: &AccountInfo<'info>, 
) -> Result<()> {

    player_account.action_points_spent = player_account.action_points_spent.checked_add(action_points).unwrap();
    player_account.action_points_to_be_collected = player_account.action_points_to_be_collected.checked_add(action_points).unwrap();

    let cpi_context = CpiContext::new(
        system_program.clone(), 
        Transfer {
            from: player.clone(),
            to: player_account.to_account_info().clone(),
        });
    transfer(cpi_context, action_points)?;

    msg!("Minus {} action points", action_points);

    Ok(())
}
// ----------- CREATE GAME ----------
```

This helper is really just to save space since every action the `Player` takes will cost `action_points`. It just transfers the `actions_points` ( lamports ) to the `player` account to act as an escrow until the `game` account can be bothered to collect all of the funds. If you’re not sure why we’re doing this, revisit the **Dealing with Concurrency** section.

### Create Game

Our first function will create the `game` account. 

```rust
// ----------- CREATE GAME ----------

#[derive(Accounts)]
pub struct CreateGame<'info> {
    #[account(
        init, 
        seeds=[b"GAME", treasury.key().as_ref()],
        bump,
        payer = game_master, 
        space = std::mem::size_of::<Game>()+ 8
    )]
    pub game: Account<'info, Game>,

    #[account(mut)]
    pub game_master: Signer<'info>,

    /// CHECK: Need to know they own the treasury
    pub treasury: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn run_create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {

    ctx.accounts.game.game_master = ctx.accounts.game_master.key().clone();
    ctx.accounts.game.treasury = ctx.accounts.treasury.key().clone();

    ctx.accounts.game.action_points_collected = 0;
    ctx.accounts.game.game_config.max_items_per_player = max_items_per_player;

    msg!("Game created!");

    Ok(())
}

// ----------- CREATE PLAYER ----------
```

Note that account is PDA’d off of the `treasury` wallet. This way, if a `game_master` wanted to run multiple games they could. Notice that the `treasury` is also a signer. This is to make sure whoever is creating the game has the private keys to the `treasury` - again this is a design decision. I do it out of protection, but maybe you wanted to run a charity game and put their wallet as the treasury.

### Create Player

Our second function will be to create the `player` account.

```rust
// ----------- CREATE PLAYER ----------
#[derive(Accounts)]
pub struct CreatePlayer<'info> {
    pub game: Box<Account<'info, Game>>,

    #[account(
        init, 
        seeds=[
            b"PLAYER", 
            game.key().as_ref(), 
            player.key().as_ref()
        ], 
        bump, 
        payer = player, 
        space = std::mem::size_of::<Player>() + std::mem::size_of::<InventoryItem>() * game.game_config.max_items_per_player as usize + 8)
    ]
    pub player_account: Account<'info, Player>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_create_player(ctx: Context<CreatePlayer>) -> Result<()> {

    ctx.accounts.player_account.player = ctx.accounts.player.key().clone();
    ctx.accounts.player_account.game = ctx.accounts.game.key().clone();

    ctx.accounts.player_account.status_flag = NO_EFFECT_FLAG;
    ctx.accounts.player_account.experince = 0;
    ctx.accounts.player_account.kills = 0;

    msg!("Hero has entered the game!");

    {   // Spend 100 lamports to create player
        let action_point_to_spend = 100;

        spend_action_point(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}

// ----------- SPAWN MONSTER ----------
```

Note how the player is PDA’d off of the `game` and `player` wallet. Notice how we `Box` the `game` account. Additionally, the first action any player makes is spawning themselves in, so we do call `spend_action_point`. Right now we hardcode `action_point_to_spend` to be 100 lamports - I wonder if there would be a place to put to make the `game` more customizable *cough *cough `game_config`. Of which, we use to set how many inventory slots the player has.

### Spawn Monster

The following will allow us to spawn in a monster.

```rust
// ----------- SPAWN MONSTER ----------
#[derive(Accounts)]
pub struct SpawnMonster<'info> {
    pub game: Box<Account<'info, Game>>,

    #[account(mut,
        has_one = game,
        has_one = player,
    )]
    pub player_account: Box<Account<'info, Player>>,

    #[account(
        init, 
        seeds=[
            b"MONSTER", 
            game.key().as_ref(), 
            player.key().as_ref(),
            player_account.next_monster_index.to_le_bytes().as_ref()
        ], 
        bump, 
        payer = player, 
        space = std::mem::size_of::<Monster>() + 8)
    ]
    pub monster: Account<'info, Monster>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_spawn_monster(ctx: Context<SpawnMonster>) -> Result<()> {

    {
        ctx.accounts.monster.player = ctx.accounts.player.key().clone();
        ctx.accounts.monster.game = ctx.accounts.game.key().clone();
        ctx.accounts.monster.hitpoints = 100;

        msg!("Monster Spawned!");
    }

    {
        ctx.accounts.player_account.next_monster_index = ctx.accounts.player_account.next_monster_index.checked_add(1).unwrap();
    }

    {   // Spend 5 lamports to spawn monster
        let action_point_to_spend = 5;

        spend_action_point(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}

// ----------- ATTACK MONSTER ----------
```

We are now boxing both the `game` and the `player` account. Look at how the monster is PDA’d with `game`, `player`, and an index. This is so that each player can keep track of all of the monsters they’ve spawned! Could you think of a better way to keep track of all of your monsters?

### Attack Monster

Now! Let’s attack those monsters and start gaining some exp!

```rust
// ----------- ATTACK MONSTER ----------
#[derive(Accounts)]
pub struct AttackMonster<'info> {

    #[account(
        mut,
        has_one = player,
    )]
    pub player_account: Box<Account<'info, Player>>,

    #[account(
        mut,
        has_one = player,
        constraint = monster.game == player_account.game
    )]
    pub monster: Box<Account<'info, Monster>>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn run_attack_monster(ctx: Context<AttackMonster>) -> Result<()> {

    let mut did_kill = false;

    {
        let hp_before_attack =  ctx.accounts.monster.hitpoints;
        let hp_after_attack = ctx.accounts.monster.hitpoints.saturating_sub(1);
        let damage_dealt = hp_before_attack - hp_after_attack;
        ctx.accounts.monster.hitpoints = hp_after_attack;

        

        if hp_before_attack > 0 && hp_after_attack == 0 {
            did_kill = true;
        }

        if  damage_dealt > 0 {
            msg!("Damage Dealt: {}", damage_dealt);
        } else {
            msg!("Stop it's already dead!");
        }
    }

    {
        ctx.accounts.player_account.experince = ctx.accounts.player_account.experince.saturating_add(1);
        msg!("+1 EXP");

        if did_kill {
            ctx.accounts.player_account.kills = ctx.accounts.player_account.kills.saturating_add(1);
            msg!("You killed the monster!");
        }
    }

    {   // Spend 1 lamports to attack monster
        let action_point_to_spend = 1;

        spend_action_point(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}

// ----------- REDEEM TO TREASUREY ----------
```

Each rpg account is now `Box<>`'d. Basically, you spend an `action_point` to attack and you gain `experince` if you kill the monster your `kill` count goes up! Quick aside, you might be wondering why I use `saturating_add` - this is so the number will never overflow. Say the `kills` was a u8 and my current kill count was 255 (0xFF). If I killed another and added normally… 255 + 1 = 0 ( 0xFF + 0x01 = 0x00 ). `saturating_add` will keep it at it’s max if it’s about to roll over, so 255 + 1 = 255. `checked_add` will throw an error if it’s about to overflow. Keep this in mind - even though `kills` is a u64 and will never roll with it’s current programming, it’s a good practice to think about roll-overs.

### Redeem to Treasury

Our last function! This one simply allows anyone to send the spent `action_points` to the `treasury` wallet.

```rust
// ----------- REDEEM TO TREASUREY ----------
#[derive(Accounts)]
pub struct CollectActionPoints<'info> {

    #[account(
        mut,
        has_one=treasury
    )]
    pub game: Box<Account<'info, Game>>,

    #[account(
        mut,
        has_one=game
    )]
    pub player: Box<Account<'info, Player>>,

    #[account(mut)]
    /// CHECK: It's being checked in the game account
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// literally anyone who pays for the TX fee can run this command - give it to a clockwork bot
pub fn run_collect_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
    let transfer_amount: u64 = ctx.accounts.player.action_points_to_be_collected;

    **ctx.accounts.player.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

    ctx.accounts.player.action_points_to_be_collected = 0;

    ctx.accounts.game.action_points_collected = ctx.accounts.game.action_points_collected.checked_add(transfer_amount).unwrap();

    msg!("The treasury collected {} action points to treasury", transfer_amount);

    Ok(())
}
```

### Putting it all Together

The last thing we have to do is fill in the functions to out program. I personally like to see how many compute units each function takes. 

```rust
#[program]
pub mod rpg {
    use super::*;

    pub fn create_game(ctx: Context<CreateGame>, max_items_per_player: u8) -> Result<()> {
        run_create_game(ctx, max_items_per_player)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn create_player(ctx: Context<CreatePlayer>) -> Result<()> {
        run_create_player(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn spawn_monster(ctx: Context<SpawnMonster>) -> Result<()> {
        run_spawn_monster(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn attack_monster(ctx: Context<AttackMonster>) -> Result<()> {
        run_attack_monster(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

    pub fn deposit_action_points(ctx: Context<CollectActionPoints>) -> Result<()> {
        run_collect_action_points(ctx)?;
        sol_log_compute_units();
        Ok(())
    }

}
```

Now if you added in all of the sections correctly, you should be able to run:

`anchor build`

You should get a completed build!

### Testing

Now, let’s see this baby work! Let’s setup the `tests/rpg.ts` file. 

```tsx
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rpg, IDL } from "../target/types/rpg";
import { assert } from "chai";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("RPG", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Rpg as Program<Rpg>;
  const wallet = anchor.workspace.Rpg.provider.wallet
    .payer as anchor.web3.Keypair;
  const gameMaster = wallet;
  const player = wallet;

  const treasury = anchor.web3.Keypair.generate();

it("Create Game", async () => {});

it("Create Player", async () => {});

it("Spawn Monster", async () => {});

it("Attack Monster", async () => {});

it("Deposit Action Points", async () => {});

});
```

We will be filling out each test in turn. But first we needed to setup a couple of different accounts. Mainly the `gameMaster` and the `treasury`.

Now lets add in the `Create Game` test.

```tsx
it("Create Game", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createGame(
        8, // 8 Items per player
      )
      .accounts({
        game: gameKey,
        gameMaster: gameMaster.publicKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([treasury])
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.game.fetch(gameKey);

  });
```

This one is pretty straight forward. Make sure to pass the `treasury` into the signers array. I personally like to test that tests run as I write them. So now would be a good time to run:

```tsx
yarn install
anchor test
```

just to make sure everything is running smoothly. 

**Hacky workaround:** If for some reason, the `yarn install` command results in some `.pnp.*` files and no `node_modules`, you may want to call `rm -rf .pnp.*` followed by `npm i` and then `yarn install`. That should work.

Now that everything is running, let’s implement the `Create Player` test.

```
it("Create Player", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    const txHash = await program.methods
      .createPlayer()
      .accounts({
        game: gameKey,
        playerAccount: playerKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.player.fetch(playerKey);

  });
```

 

Again pretty straight forward. Run `anchor test` to make sure she’s running.

```tsx
it("Spawn Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );

    const playerAccount = await program.account.player.fetch(playerKey);

    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MONSTER"), gameKey.toBuffer(), player.publicKey.toBuffer(), playerAccount.nextMonsterIndex.toBuffer('le', 8)],
      program.programId
    );

    const txHash = await program.methods
      .spawnMonster()
      .accounts({
        game: gameKey,
        playerAccount: playerKey,
        monster: monsterKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.monster.fetch(monsterKey);

  });
```

Monster Spawned! Notice, the player only needs to know their own wallet and the game wallet for all of this to work! Run `anchor test` to make sure, because now we get into the fun stuff!

```tsx
it("Attack Monster", async () => {
    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // Fetch the latest monster created
    const playerAccount = await program.account.player.fetch(playerKey);
    const [monsterKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MONSTER"), gameKey.toBuffer(), player.publicKey.toBuffer(), playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)],
      program.programId
    );

    const txHash = await program.methods
      .attackMonster()
      .accounts({
        playerAccount: playerKey,
        monster: monsterKey,
        player: player.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    // Print out if you'd like
    // const account = await program.account.monster.fetch(monsterKey);

    const monsterAccount = await program.account.monster.fetch(monsterKey);
    assert(monsterAccount.hitpoints.eqn(99));

  });
```

Notice the monster that we choose to attack is `playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)` - this effectively allows us to attack the most recent monster spawned. Anything below the `nextMonsterIndex` should be okay. Lastly, since seeds are just an array of bytes we have to turn the index into the u64, which is little endian `le` at 8 bytes.

Run `anchor test` to deal some damage!

```tsx
it("Deposit Action Points", async () => {
    

    const [gameKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("GAME"), treasury.publicKey.toBuffer()],
      program.programId
    );

    const [playerKey] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("PLAYER"), gameKey.toBuffer(), player.publicKey.toBuffer()],
      program.programId
    );
      
    // To show that anyone can deposit the action points
    // Ie, give this to a clockwork bot
    const clockworkWallet = anchor.web3.Keypair.generate();

    // To give it a starting balance
    const clockworkProvider = new anchor.AnchorProvider(
        program.provider.connection,
        new NodeWallet(clockworkWallet),
        anchor.AnchorProvider.defaultOptions(),
    )
    const clockworkProgram = new anchor.Program<Rpg>(
        IDL,
        program.programId,
        clockworkProvider,
    )

    // Have to give the accounts some lamports else the tx will fail
    const amountToInitialize = 10000000000;

    const clockworkAirdropTx = await clockworkProgram.provider.connection.requestAirdrop(clockworkWallet.publicKey, amountToInitialize);
    await program.provider.connection.confirmTransaction(clockworkAirdropTx, "confirmed");

    const treasuryAirdropTx = await clockworkProgram.provider.connection.requestAirdrop(treasury.publicKey, amountToInitialize);
    await program.provider.connection.confirmTransaction(treasuryAirdropTx, "confirmed");

    const txHash = await clockworkProgram.methods
      .depositActionPoints()
      .accounts({
        game: gameKey,
        player: playerKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.provider.connection.confirmTransaction(txHash);

    const expectedActionPoints = 100 + 5 + 1; // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    const treasuryBalace = await program.provider.connection.getBalance(treasury.publicKey);
    assert(
        treasuryBalace == 
        (amountToInitialize + expectedActionPoints) // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    );

    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));

    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));

  });
```

This last test may feel a little too complex for the actual function it’s calling. But I wanted to show that anyone could call the redeem function `depositActionPoints` and I hint to using something like [clockwork](https://www.clockwork.xyz/) chron jobs to accomplish this.

Finally run `anchor test` to see everything working! And Ta-da! you have a mini RPG game engine!

# Challenge

Now it’s your turn. Can you find any optimizations in the RPG code that you could make? Are there any expansions to the code? Would you want to implement any new systems? Now is your time to try it out! 

I have provided a some example modifications in the `solution` branch of the provided code from the lesson. Take a look out for `// SOLUTION EDIT:`s to see what I changed or added

[https://github.com/Unboxed-Software/Advance-Program-Architecture/tree/solution](https://github.com/Unboxed-Software/Advance-Program-Architecture/tree/solution)
---
title: Program Architecture
objectives:
- Use Box and Zero Copy to work with large data onchain
- Make better PDA design decisions
- Future-proof your programs
- Deal with concurrency issues
---

# Summary

- If your data accounts are too large for the Stack, wrap them in `Box` to allocate them to the Heap
- Use Zero-Copy to deal with accounts that are too large for `Box` (< 10MB)
- The size and the order of fields in an account matter; put variable length fields at the end
- Solana can process in parallel, but you can still run into bottlenecks; be mindful of "shared" accounts that all users interacting with the program have to write to

# Lesson

Program Architecture is what separates the hobbyist from the professional. Crafting performant programs has more to do with system **design** than it does with the code. And you, as the designer, need to think about: 

    1. What your code needs to do
    2. What possible implementations there are
    3. What are the tradeoffs between different implementations

These questions are even more important when developing for a blockchain. Not only are resources more limited than in a typical computing environment, you're also dealing with people’s assets; code has a cost now.

We'll leave most of the asset handling discussion to [security lessons](./security-intro), but it's important to note the nature of resource limitations in Solana development. There are, of course, limitations in a typical development environment, but there are limitations unique to blockchain and Solana development such as how much data can be stored in an account, the cost to store that data, and how many compute units are available per transaction. You, the program designer, have to be mindful of these limitations to create programs that are affordable, fast, safe, and functional. Today we will be delving into some of the more advance considerations that should be taken when creating Solana programs. 

## Dealing With Large Accounts

In modern application programming, we don’t often have to think about the size of the data structures we are using. You want to make a string? You can put a 4000 character limit on it if you want to avoid abuse, but it's probably not an issue. Want an integer? They’re pretty much always 32-bit for convenience.

In high level languages, you are in the data-land-o-plenty! Now, in Solana land, we pay per byte stored (rent) and have limits on heap, stack and account sizes. We have to be a little more crafty with our bytes. There are two main concerns we are going to be looking at in this section: 

1. Since we pay-per-byte, we generally want to keep our footprint as small as possible. We will delve more into optimization in another section, but we'll introduce you to the concept of data sizes here.

2. When operating on larger data, we run into [Stack](https://docs.solana.com/developing/onchain-programs/faq#stack) and [Heap](https://docs.solana.com/developing/onchain-programs/faq#heap-size) constraints - to get around these, we’ll look at using Box and Zero-Copy.

### Sizes

In Solana a transaction's fee payer pays for each byte stored onchain. We call this [rent](https://docs.solana.com/developing/intro/rent). Side note: rent is a bit of a misnomer since it never actually gets permanently taken. Once you deposit rent into the account, that data can stay there forever or you can get refunded the rent if you close the account. Rent used to be an actual thing, but now there's an enforced minimum rent exemption. You can read about it in [the Solana documentation](https://docs.solana.com/developing/intro/rent).

Rent etymology aside, putting data on the blockchain can be expensive. It’s why NFT attributes and associated files, like the image, are stored off-chain. You ultimately want to strike a balance that leaves your program highly functional without becoming so expensive that your users don’t want to pay to open the data account.

The first thing you need to know before you can start optimizing for space in your program is the size of each of your structs.. Below is a very helpful list from the [Anchor Book](https://book.anchor-lang.com/anchor_references/space.html). 

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

Knowing these, start thinking about little optimizations you might take in a program. For example, if you have an integer field that will only ever reach 100, don’t use a u64/i64, use a u8. Why? Because a u64 takes up 8 bytes, with a max value of 2^64 or 1.84 * 10^19. Thats a waste of space since you only need to accommodate numbers up to 100. A single byte will give you a max value of 255 which, in this case, would be sufficient. Similarly, there's no reason to use i8 if you'll never have negative numbers. 

Be careful with small number types, though. You can quickly run into unexpected behavior due to overflow. For example, a u8 type that is iteratively incremented will reach 255 and then go back to 0 instead of 256. For more real-world context, look up the **[Y2K bug](https://www.nationalgeographic.org/encyclopedia/Y2K-bug/#:~:text=As%20the%20year%202000%20approached%2C%20computer%20programmers%20realized%20that%20computers,would%20be%20damaged%20or%20flawed.).** 

If you want to read more about Anchor sizes, take a look at [Sec3's blog post about it](https://www.sec3.dev/blog/all-about-anchor-account-size) .

### Box

Now that you know a little bit about data sizes, let’s skip forward and look at a problem you’ll run into if you want to deal with larger data accounts. Say you have the following data account: 

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

It has to do with the Stack. Every time you call a function in Solana it gets a 4KB stack frame. This is static memory allocation for local variables. This is where that entire `SomeBigDataStruct` gets stored in memory and since 5000 bytes, or 5KB, is greater than the 4KB limit, it will throw a stack error. So how do we fix this?

The answer is the **`Box<T>`** type!

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

In Anchor, **`Box<T>`** is used to allocate the account to the Heap, not the Stack. Which is great since the Heap gives us 32KB to work with. The best part is you don’t have to do anything different within the function. All you need to do is add `Box<…>` around all of your big data accounts.

But Box is not perfect. You can still overflow the stack with sufficiently large accounts. We'll learn how to fix this in the next section.

### Zero Copy

Okay, so now you can deal with medium sized accounts using `Box`. But what if you need to use really big accounts like the max size of 10MB? Take the following as an example:

```rust
#[account]
pub struct SomeReallyBigDataStruct {
    pub really_big_data: [u128; 1024], // 16,384 bytes
}
```

This account will make your program fail, even wrapped in a `Box`. To get around this, you can use `zero_copy` and `AccountLoader`. Simply add `zero_copy` to your account struct, add `zero` as a constraint in the account validation struct, and wrap the account type in the account validation struct in an `AccountLoader`.

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

**Note**: In older versions of anchor `< 0.28.0` you may have to use: `zero_copy(unsafe))` ( [Thanks @0xk2_](https://github.com/Unboxed-Software/solana-course/issues/347) for this find )

To understand what's happening here, take a look at the [rust Anchor documentation](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)

> Other than being more efficient, the most salient benefit [`zero_copy`] provides is the ability to define account types larger than the max stack or heap size. When using borsh, the account has to be copied and deserialized into a new data structure and thus is constrained by stack and heap limits imposed by the BPF VM. With zero copy deserialization, all bytes from the account’s backing `RefCell<&mut [u8]>` are simply re-interpreted as a reference to the data structure. No allocations or copies necessary. Hence the ability to get around stack and heap limitations.

Basically, your program never actually loads zero-copy account data into the stack or heap. It instead gets pointer access to the raw data. The `AccountLoader` ensures this doesn't change too much about how you interact with the account from your code.

There are a couple of caveats using `zero_copy`. First, you cannot use the `init` constraint in the account validation struct like you may be used to. This is due to there being a CPI limit on accounts bigger than 10KB.

```rust
pub struct ConceptZeroCopy<'info> {
    #[account(zero, init)] // <- Can't do this
    pub some_really_big_data: AccountLoader<'info, SomeReallyBigDataStruct>,
}
```

Instead, your client has to create the large account and pay for it’s rent in a separate instruction.

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

The second caveat is that your'll have to call one of the following methods from inside your rust instruction function to load the account:

- `load_init` when first initializing an account (this will ignore the missing account discriminator that gets added only after the user’s instruction code)
- `load` when the account is not mutable
- `load_mut` when the account is mutable

For example, if you wanted to init and manipulate the `SomeReallyBigDataStruct` from above, you’d call the following in the function

```rust
let some_really_big_data = &mut ctx.accounts.some_really_big_data.load_init()?;
```

After you do that, then you can treat the account like normal! Go ahead and experiment with this in the code yourself to see everything in action!

For a better understanding on how this all works, Solana put together a really nice [video](https://www.youtube.com/watch?v=zs_yU0IuJxc&feature=youtu.be) and [code](https://github.com/solana-developers/anchor-zero-copy-example) explaining Box and Zero-Copy in vanilla Solana.

## Dealing with Accounts

Now that you know the nuts and bolts of space consideration on Solana, let’s look at some higher level considerations. In Solana, everything is an account, so for the next couple sections we'll look at some account architecture concepts.

### Data Order

This first consideration is fairly simple. As a rule of thumb, keep all variable length fields at the end of the account. Take a look at the following:

```rust
#[account] // Anchor hides the account discriminator
pub struct BadState {
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
    pub id: u32         // 0xDEAD_BEEF
}
```

The `flags` field is variable length. This makes looking up a specific account by the `id` field very difficult, as an update to the data in `flags` changes the location of `id` on the memory map.

To make this more clear, observe what this account's data looks like onchain when `flags` has four items in the vector vs eight items. If you were to call `solana account ACCOUNT_KEY` you’d get a data dump like the following: 

```rust
0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	04 00 00 00    11 22 33 44  -> Vec Size (4) | Data 4*(1)
0010:   DE AD BE EF                 -> id (4)

--- vs ---

0000:   74 e4 28 4e    d9 ec 31 0a  -> Account Discriminator (8)
0008:	08 00 00 00    11 22 33 44  -> Vec Size (8) | Data 4*(1)
0010:   55 66 77 88    DE AD BE EF  -> Data 4*(1) | id (4)
```

In both cases, the first eight bytes are the Anchor account discriminator. In the first case, the next four bytes represent the size of the `flags` vector, followed by another four bytes for the data, and finally the `id` field's data.

In the second case, the `id` field moved from address 0x0010 to 0x0014 because the data in the `flags` field took up four more bytes.

The main problem with this is lookup. When you query Solana, you use filters that look at the raw data of an account. These are called a `memcmp` filters, or memory compare filters. You give the filter an `offset` and `bytes`, and the filter then looks directly at the memory, offsetting from the start by the `offset` you provide, and compares the bytes in memory to the `bytes` you provide.

For example, you know that the `flags` struct will always start at address 0x0008 since the first 8 bytes contain the account discriminator. Querying all accounts where the `flags` length is equal to four is possible because we *know* that the four bytes at 0x0008 represent the length of the data in `flags`. Since the account discriminator is 

```typescript
const states = await program.account.badState.all([
  {memcmp: {
    offset: 8,
    bytes: bs58.encode([0x04])
  }}
]);
```

However, if you wanted to query by the `id`, you wouldn't know what to put for the `offset` since the location of `id` is variable based on the length of `flags`. That doesn’t seem very helpful. IDs are usually there to help with queries! The simple fix is to flip the order.

```rust
#[account] // Anchor hides the account disriminator
pub struct GoodState {
	pub id: u32         // 0xDEAD_BEEF
    pub flags: Vec<u8>, // 0x11, 0x22, 0x33 ...
}
```

With variable length fields at the end of the struct, you can always query accounts based on all the fields up to the first variable length field. To echo the beginning of this section: As a rule of thumb, keep all variable length structs at the end of the account.

### For Future Use

In certain cases, consider adding extra, unused bytes to you accounts. These are held in reserve for flexibility and backward compatibility. Take the following example:

```rust
#[account]
pub struct GameState {
    pub health: u64,
    pub mana: u64,
    pub event_log: Vec<string>
}
```

In this simple game state, a character has `health`, `mana`, and an event log. If at some point you are making game improvements and want to add an `experience` field, you'd hit a snag. The `experience` field should be a number like a `u64`, which is simple enough to add. You can [reallocate the account](./anchor-pdas.md#realloc) and add space.

However, to keep dynamic length fields, like `event_log`, at the end of the struct, you would need to do some memory manipulation on all reallocated accounts to move the location of `event_log`. This can be complicated and makes querying accounts far more difficult. You'll end up in a state where non-migrated accounts have `event_log` in one location and migrated accounts in another. The old `GameState` without `experience` and the new `GameState` with `experience` in it are no longer compatible. Old accounts won't serialize when used where new accounts are expected. Queries will be far more difficult. You'll likely need to create a migration system and ongoing logic to maintain backward compatibility. Ultimately, it begins to seem like a bad idea.

Fortunately, if you think ahead, you can add a `for_future_use` field that reserves some bytes where you expect to need them most.

```rust
#[account]
pub struct GameState { //V1
    pub health: u64,
    pub mana: u64,
	pub for_future_use: [u8; 128],
    pub event_log: Vec<string>
}
```

That way, when you go to add `experience` or something similar, it looks like this and both the old and new accounts are compatible.

```rust
#[account]
pub struct GameState { //V2
    pub health: u64,
    pub mana: u64,
	pub experience: u64,
	pub for_future_use: [u8; 120],
    pub event_log: Vec<string>
}
```

These extra bytes do add to the cost of using your program. However, it seems well worth the benefit in most cases.

So as a general rule of thumb: anytime you think your account types have the potential to change in a way that will require some kind of complex migration, add in some `for_future_use` bytes.

### Data Optimization

The idea here is to be aware of wasted bits. For example, if you have a field that represents the month of the year, don’t use a `u64`. There will only ever be 12 months. Use a `u8`. Better yet, use a `u8` Enum and label the months. 

To get even more aggressive on bit savings, be careful with booleans. Look at the below struct composed of eight boolean flags. While a boolean *can* be represented as a single bit, borsh deserialization will allocate an entire byte to each of these fields. that means that eight booleans winds up being eight bytes instead of eight bits, an eight times increase in size.

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

To optimize this, you could have a single field as a `u8`. Then you can use bitwise operations to look at each bit and determine if it's "toggled on" or not.

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

That saves you 7 bytes of data! The tradeoff, of course, is now you have to do bitwise operations. But that's worth having in your toolkit.

### Indexing

This last account concept is fun and illustrates the power of PDAs. When creating program accounts, you can specify the seeds used to derive the PDA. This is exceptionally powerful since it lets you derive your account addresses rather than store them.

The best example of this is good ‘ol Associated Token Accounts (ATAs)!

```typescript
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

This is how most of your SPL tokens are stored. Rather than keep a database table of SPL token account addresses, the only thing you have to know is your wallet address and the mint address. The ATA address can be calculated by hashing these together and viola! You have your token account address.

Depending on the seeding you can create all sorts of relationships:

- One-Per-Program (Global Account) - If you create an account with a determined `seeds=[b"ONE PER PROGRAM"]`, only one can ever exist for that seed in that program. For example, if your program needs a lookup table, you could seed it with `seeds=[b"Lookup"]`. Just be careful to provide appropriate access restrictions.
- One-Per-Owner - Say you’re creating a video game player account and you only want one player account per wallet. Then you’d seed the account with `seeds=[b"PLAYER", owner.key().as_ref()]`. This way, you’ll always know where to look for a wallet’s player account **and** there can only ever be one of them.
- Multiple-Per-Owner - Okay, but what if you want multiple accounts per wallet? Say you want to mint podcast episodes. Then you could seed your `Podcast` account like this: `seeds=[b"Podcast", owner.key().as_ref(), episode_number.to_be_bytes().as_ref()]`. Now, if you want to look up episode 50 from a specific wallet, you can! And you can have as many episodes as you want per owner.
- One-Per-Owner-Per-Account - This is effectively the ATA example we saw above. Where we have one token account per wallet and mint account. `seeds=[b"Mock ATA", owner.key().as_ref(), mint.key().as_ref()]`

From there you can mix and match in all sorts of clever ways! But the preceding list should give you enough to get started. 

The big benefit of really paying attention to this aspect of design is answering the ‘indexing’ problem. Without PDAs and seeds, all users would have to keep track of all of the addresses of all of the accounts they’ve ever used. This isn't feasible for users, so they'd have to depend on a centralized entity to store their addresses in a database. In many ways that defeats the purpose of a globally distributed network. PDAs are a much better solution. 

To drive this all home, here's an example of a scheme from a production podcasting program. The program needed the following accounts:

- **Channel Account**
    - Name
    - Episodes Created (u64)
- **Podcast Account(s)**
    - Name
    - Audio URL

To properly index each account address, the accounts use the following seeds:

```rust
// Channel Account
seeds=[b"Channel", owner.key().as_ref()]

// Podcast Account
seeds=[b"Podcast", channel_account.key().as_ref(), episode_number.to_be_bytes().as_ref()]
```

You can always find the channel account for a particular owner. And since the channel stores the number of episodes created, you always know the upper bound of where to search for queries. Additionally you always know what index to create a new episode at: `index = episodes_created`.

```rust
Podcast 0: seeds=[b"Podcast", channel_account.key().as_ref(), 0.to_be_bytes().as_ref()] 
Podcast 1: seeds=[b"Podcast", channel_account.key().as_ref(), 1.to_be_bytes().as_ref()] 
Podcast 2: seeds=[b"Podcast", channel_account.key().as_ref(), 2.to_be_bytes().as_ref()] 
...
Podcast X: seeds=[b"Podcast", channel_account.key().as_ref(), X.to_be_bytes().as_ref()] 
```

## Dealing with Concurrency

One of the main reasons to choose Solana for your blockchain environment is its parallel transaction execution. That is, Solana can run transactions in parallel as long as those transactions aren't trying to write data to the same account. This improves program throughput out of the box, but with some proper planning you can avoid concurrency issues and really boost your program's performance.

### Shared Accounts

If you’ve been around crypto for a while, you may have experienced a big NFT mint event. A new NFT project is coming out, everyone is really excited for it, and then the candymachine goes live. It’s a mad dash to click `accept transaction` as fast as you can. If you were clever, you may have written a bot to enter in the transactions faster that the website’s UI could. This mad rush to mint creates a lot of failed transactions. But why? Because everyone is trying to write data to the same Candy Machine account.

Take a look at a simple example:

Alice and Bob are trying to pay their friends Carol and Dean respectively. All four accounts change, but neither depend on each other. Both transactions can run at the same time.

```rust
Alice -- pays --> Carol

Bob ---- pays --> Dean
```

But if Alice and Bob both try to pay Carol at the same time, they'll run into issues.

```rust
Alice -- pays --> |
						-- > Carol
Bob   -- pays --- |
```

Since both of these transactions write to Carol's token account, only one of them can go through at a time. Fortunately, Solana is wicked fast, so it’ll probably seem like they get paid at the same time. But what happens if more than just Alice and Bob try to pay Carol?

```rust
Alice -- pays --> |
						-- > Carol
x1000 -- pays --- | 
Bob   -- pays --- |
```

What if 1000 people try to pay Carol at the same time? Each of the 1000 instructions will be queued up to run in sequence. To some of them, the payment will seem like it went through right away. They'll be the lucky ones whose instruction got included early. But some of them will end up waiting quite a bit. And for some, their transaction will simply fail.

While it seems unlikely for 1000 people to pay Carol at the same time, it's actually very common to have an event, like an NFT mint, where many people are trying to write data to the same account all at once.

Imagine you create a super popular program and you want to take a fee on every transaction you process. For accounting reasons, you want all of those fees to go to one wallet. With that setup, on a surge of users, your protocol will become slow and or become unreliable. Not great. So what’s the solution? Separate the data transaction from the fee transaction.

For example, imagine you have a data account called `DonationTally`. Its only function is to record how much you have donated to a specific hard-coded community wallet.

```rust
#[account]
pub struct DonationTally {
    is_initialized: bool,
    lamports_donated: u64,
    lamports_to_redeem: u64,
    owner: Pubkey,
}
```

First let’s look at the suboptimal solution.

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

You can see that the transfer to the hardcoded `community_wallet` happens in the same function that you update the tally information. This is the most straightforward solution, but if you run the tests for this section, you’ll see the slowdown.

Now look at the optimized solution:

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

Here, in the `run_concept_shared_account` function, instead of transferring to the bottleneck, we transfer to the `donation_tally` PDA. This way, we’re only effecting the donator's account and their PDA - so no bottleneck! Additionally, we keep an internal tally of how many lamports need to be redeemed, ie be transferred from the PDA to the community wallet at a later time. At some point in the future, the community wallet will go around and clean up all the straggling lamports (probably a good job for [clockwork](https://www.clockwork.xyz/)). It’s important to note that anyone should be able to sign for the redeem function, since the PDA has permission over itself.

If you want to avoid bottlenecks at all costs, this is one way to tackle it. Ultimately this is a design decision and the simpler, less optimal solution might be okay for some programs. But if your program is going to have high traffic, it's worth trying to optimize. You can always run a simulation to see your worst, best and median cases.

## See it in Action

All of the code snippets from this lesson are part of a [Solana program we created to illustrate these concepts](https://github.com/Unboxed-Software/advanced-program-architecture.git). Each concept has an accompanying program and test file. For example, the **Sizes** concept can be found in:

**program -** `programs/architecture/src/concepts/sizes.rs`

**test -** `cd tests/sizes.ts`

Now that you've read about each of these concepts, feel free to jump into the code to experiment a little. You can change existing values, try to break the program, and generally try to understand how everything works.

You can fork and/or clone [this program from Github](https://github.com/Unboxed-Software/advanced-program-architecture.git) to get started. Before building and running the test suite, remember to update the `lib.rs` and `Anchor.toml` with your local program ID.

You can run the entire test suite or add `.only` to the `describe` call in a specific test file to only run that file's tests. Feel free to customize it and make it your own.

## Conclusion

We've talked about quite a few program architecture considerations: bytes, accounts, bottlenecks, and more. Whether you wind up running into any of these specific considerations or not, hopefully the examples and discussion sparked some thought. At the end of the day, you're the designer of your system. Your job is to weigh the pros and cons of various solutions. Be forward thinking, but be practical. There is no "one good way" to design anything. Just know the trade-offs.

# Lab

Let's use all of these concepts to create a simple, but optimized, RPG game engine in Solana. This program will have the following features:
- Let users create a game (`Game` account) and become a "game master" (the authority over the game)
- Game masters are in charge of their game's configuration
- Anyone from the public can join a game as a player - each player/game combination will have a `Player` account
- Players can spawn and fight monsters (`Monster` account) by spending action points; we'll use lamports as the action points
- Spent action points go to a game's treasury as listed in the `Game` account

We'll walk through the tradeoffs of various design decisions as we go to give you a sense for why we do things. Let’s get started!

### 1. Program Setup

We'll build this from scratch. Start by creating a new Anchor project:

```bash
anchor init rpg
```

Note: This lab was created with Anchor version `0.28.0` in mind. If there are problems compiling, please refer to the [solution code](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution) for the environment setup.

Next, replace the program ID in `programs/rpg/lib.rs` and `Anchor.toml` with the program ID shown when you run `anchor keys list`.

Finally, let's scaffold out the program in the `lib.rs` file. To make following along easier, we're going to keep everything in one file. We'll augment this with section comments for better organization and navigation. Copy the following into your file before we get started:

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

// ----------- REDEEM TO TREASURY ----------

#[program]
pub mod rpg {
    use super::*;

}
```

### 2. Create Account Structures

Now that our initial setup is ready, let's create our accounts. We'll have 3:

1. `Game` - This account represents and manages a game. It includes the treasury for game participants to pay into and a configuration struct that game masters can use to customize the game. It should include the following fields:
    - `game_master` - effectively the owner/authority
    - `treasury` - the treasury to which players will send action points (we'll just be using lamports for action points)
    - `action_points_collected` - tracks the number of action points collected by the treasury
    - `game_config` - a config struct for customizing the game
2. `Player` - A PDA account whose address is derived using the game account address and the player's wallet address as seeds. It has a lot of fields needed to track the player's game state:
    - `player` - the player's public key
    - `game` - the address of the corresponding game account
    - `action_points_spent` - the number of action points spent
    - `action_points_to_be_collected` - the number of action points that still need to be collected
    - `status_flag` - the player's status           
    - `experience` - the player's experience
    - `kills` - number of monsters killed
    - `next_monster_index` - the index of the next monster to face
    - `for_future_use` - 256 bytes reserved for future use
    - `inventory` - a vector of the player's inventory
3. `Monster` - A PDA account whose address is derived using the game account address, the player's wallet address, and an index (the one stored as `next_monster_index` in the `Player` account). 
    - `player` - the player the monster is facing
    - `game` - the game the monster is associated with 
    - `hitpoints` - how many hit points the monster has left

When added to the program, the accounts should look like this:

```rust
// ----------- ACCOUNTS ----------
#[account]
pub struct Game { // 8 bytes
    pub game_master: Pubkey,            // 32 bytes
    pub treasury: Pubkey,               // 32 bytes

    pub action_points_collected: u64,   // 8 bytes
    
    pub game_config: GameConfig,
}

#[account]
pub struct Player { // 8 bytes
    pub player: Pubkey,                 // 32 bytes
    pub game: Pubkey,                   // 32 bytes

    pub action_points_spent: u64,               // 8 bytes
    pub action_points_to_be_collected: u64,     // 8 bytes

    pub status_flag: u8,                // 8 bytes
    pub experience: u64,                 // 8 bytes
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
}
```

There aren't a lot of complicated design decisions here, but let's talk about the `inventory` and `for_future_use` fields on the `Player` struct. Since `inventory` is variable in length we decided to place it at the end of the account to make querying easier. We've also decided it's worth spending a little extra money on rent exemption to have 256 bytes of reserved space in the `for_future_use` field. We could exclude this and simply reallocate accounts if we need to add fields in the future, but adding it now simplifies things for us in the future.

If we chose to reallocate in the future, we'd need to write more complicated queries and likely couldn't query in a single call based on `inventory`. Reallocating and adding a field would move the memory position of `inventory`, leaving us to write complex logic to query accounts with various structures.

### 3. Create ancillary types

The next thing we need to do is add some of the types our accounts reference that we haven't created yet.

Let's start with the game config struct. Technically, this could have gone in the `Game` account, but it's nice to have some separation and encapsulation. This struct should store the max items allowed per player and some bytes for future use. Again, the bytes for future use here help us avoid complexity in the future. Reallocating accounts works best when you're adding fields at the end of an account rather than in the middle. If you anticipate adding fields in the middle of existing date, it might make sense to add some "future use" bytes up front.

```rust
// ----------- GAME CONFIG ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct GameConfig {
    pub max_items_per_player: u8,
    pub for_future_use: [u64; 16], // Health of Enemies?? Experience per item?? Action Points per Action??
}
```

Next, let's create our status flags. Remember, we *could* store our flags as booleans but we save space by storing multiple flags in a single byte. Each flag takes up a different bit within the byte. We can use the `<<` operator to place `1` in the correct bit.

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
```

Finally, let's create our `InventoryItem`. This should have fields for the item's name, amount, and some bytes reserved for future use.

```rust
// ----------- INVENTORY ----------

#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub struct InventoryItem {
    pub name: [u8; 32], // Fixed Name up to 32 bytes
    pub amount: u64,
    pub for_future_use: [u8; 128], // Metadata?? // Effects // Flags?
}
```

### 4. Create helper function for spending action points

The last thing we'll do before writing the program's instructions is create a helper function for spending action points. Players will send action points (lamports) to the game treasury as payment for performing actions in the game.

Since sending lamports to a treasury requires writing data to that treasury account, we could easily end up with a performance bottleneck if many players are trying to write to the same treasury concurrently (See [Dealing With Concurrency](#dealing-with-concurrency)).

Instead, we'll send them to the player PDA account and create an instruction that will send the lamports from that account to the treasury in one fell swoop. This alleviates any concurrency issues since every player has their own account, but also allows the program to retrieve those lamports at any time.

```rust
// ----------- HELPER ----------

pub fn spend_action_points<'info>(
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
```

### 5. Create Game

Our first instruction will create the `game` account. Anyone can be a `game_master` and create their own game, but once a game has been created there are certain constraints.

For one, the `game` account is a PDA using its `treasury` wallet. This ensures that the same `game_master` can run multiple games if they use a different treasury for each.

Also note that the `treasury` is a signer on the instruction. This is to make sure whoever is creating the game has the private keys to the `treasury`. This is a design decision rather than "the right way." Ultimately, it's a security measure to ensure the game master will be able to retrieve their funds.

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
```

### 6. Create Player

Our second instruction will create the `player` account. There are three tradeoffs to note about this instruction:

1. The player account is a PDA account derived using the `game` and `player` wallet. This let's players participate in multiple games but only have one player account per game.
2. We wrap the `game` account in a `Box` to place it on the heap, ensuring we don't max out the Stack.
3. The first action any player makes is spawning themselves in, so we call `spend_action_points`. Right now we hardcode `action_points_to_spend` to be 100 lamports, but this could be something added to the game config in the future.

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
    ctx.accounts.player_account.experience = 0;
    ctx.accounts.player_account.kills = 0;

    msg!("Hero has entered the game!");

    {   // Spend 100 lamports to create player
        let action_points_to_spend = 100;

        spend_action_points(
            action_points_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### 7. Spawn Monster

Now that we have a way to create players, we need a way to spawn monsters for them to fight. This instruction will create a new `Monster` account whose address is a PDA derived with the `game` account, `player` account, and an index representing the number of monsters the player has faced. There are two design decisions here we should talk about:
1. The PDA seeds let us keep track of all the monsters a player has spawned
2. We wrap both the `game` and `player` accounts in `Box` to allocate them to the Heap

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

        spend_action_points(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### 8. Attack Monster

Now! Let’s attack those monsters and start gaining some exp!

The logic here is as follows:
- Players spend 1 `action_point` to attack and gain 1 `experience`
- If the player kills the monster, their `kill` count goes up

As far as design decisions, we've wrapped each of the rpg accounts in `Box` to allocate them to the Heap. Additionally, we've used `saturating_add` when incrementing experience and kill counts.

The `saturating_add` function ensures the number will never overflow. Say the `kills` was a u8 and my current kill count was 255 (0xFF). If I killed another and added normally, e.g. `255 + 1 = 0 (0xFF + 0x01 = 0x00) = 0`, the kill count would end up as 0. `saturating_add` will keep it at its max if it’s about to roll over, so `255 + 1 = 255`. The `checked_add` function will throw an error if it’s about to overflow. Keep this in mind when doing math in Rust. Even though `kills` is a u64 and will never roll with it’s current programming, it’s good practice to use safe math and consider roll-overs.

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
        ctx.accounts.player_account.experience = ctx.accounts.player_account.experience.saturating_add(1);
        msg!("+1 EXP");

        if did_kill {
            ctx.accounts.player_account.kills = ctx.accounts.player_account.kills.saturating_add(1);
            msg!("You killed the monster!");
        }
    }

    {   // Spend 1 lamports to attack monster
        let action_point_to_spend = 1;

        spend_action_points(
            action_point_to_spend, 
            &mut ctx.accounts.player_account,
            &ctx.accounts.player.to_account_info(), 
            &ctx.accounts.system_program.to_account_info()
        )?;
    }

    Ok(())
}
```

### Redeem to Treasury

This is our last instruction. This instruction lets anyone send the spent `action_points` to the `treasury` wallet.

Again, let's box the rpg accounts and use safe math.

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

Now that all of our instruction logic is written, let's add these functions to actual instructions in the program. It can also be helpful to log compute units for each instruction. 

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

If you added in all of the sections correctly, you should be able to build successfully.

```shell
anchor build
```

### Testing

Now, let’s see this baby work!

Let’s set up the `tests/rpg.ts` file. We will be filling out each test in turn. But first, we needed to set up a couple of different accounts. Mainly the `gameMaster` and the `treasury`.

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

Now lets add in the `Create Game` test. Just call `createGame` with eight items, be sure to pass in all the accounts, and make sure the `treasury` account signs the transaction.

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

Go ahead and check that your test runs:

```tsx
yarn install
anchor test
```

**Hacky workaround:** If for some reason, the `yarn install` command results in some `.pnp.*` files and no `node_modules`, you may want to call `rm -rf .pnp.*` followed by `npm i` and then `yarn install`. That should work.

Now that everything is running, let’s implement the `Create Player`, `Spawn Monster`, and `Attack Monster` tests. Run each test as you complete them to make sure things are running smoothly.

```typescript
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

Notice the monster that we choose to attack is `playerAccount.nextMonsterIndex.subn(1).toBuffer('le', 8)`. This allows us to attack the most recent monster spawned. Anything below the `nextMonsterIndex` should be okay. Lastly, since seeds are just an array of bytes we have to turn the index into the u64, which is little endian `le` at 8 bytes.

Run `anchor test` to deal some damage!

Finally, let's write a test to gather all the deposited action points. This test may feel complex for what it's doing. That's because we're generating some new accounts to show that anyone could call the redeem function `depositActionPoints`. We use names like `clockwork` for these because if this game were running continuously, it probably makes sense to use something like [clockwork](https://www.clockwork.xyz/) cron jobs.

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
    const treasuryBalance = await program.provider.connection.getBalance(treasury.publicKey);
    assert(
        treasuryBalance == 
        (amountToInitialize + expectedActionPoints) // Player Create ( 100 ) + Monster Spawn ( 5 ) + Monster Attack ( 1 )
    );

    const gameAccount = await program.account.game.fetch(gameKey);
    assert(gameAccount.actionPointsCollected.eqn(expectedActionPoints));

    const playerAccount = await program.account.player.fetch(playerKey);
    assert(playerAccount.actionPointsSpent.eqn(expectedActionPoints));
    assert(playerAccount.actionPointsToBeCollected.eqn(0));

});
```

Finally, run `anchor test` to see everything working.

Congratulations! This was a lot to cover, but you now have a mini RPG game engine. If things aren't quite working, go back through the lab and find where you went wrong. If you need, you can refer to the [`main` branch of the solution code](https://github.com/Unboxed-Software/anchor-rpg).

Be sure to put these concepts into practice in your own programs. Each little optimization adds up!

# Challenge

Now it’s your turn to practice independently. Go back through the lab code looking for additional optimizations and/or expansion you can make. Think through new systems and features you would add and how you would optimize them.

You can find some example modifications on the `challenge-solution` branch of the [RPG repository](https://github.com/Unboxed-Software/anchor-rpg/tree/challenge-solution).

Finally, go through one of your own programs and think about optimizations you can make to improve memory management, storage size, and/or concurrency.

## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=4a628916-91f5-46a9-8eb0-6ba453aa6ca6)!
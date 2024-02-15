# Lab

### Explain what we're building, bird's eye view


### 1. Verify Solana/Anchor/Rust Versions

Run `solana --version` on your machine. We will be interacting with the `token22` program in this lab and that requires you have solana cli version ≥ 1.18.0

If the version printed out after running `solana --version` is less than `1.18.0` then you can update the cli version manually. Note, at the time of writing this, you cannot simply run the `solana-install update` command. This command will not update the CLI to the correct version for us, so we have to explicitly download version `1.18.0`. You can do so with the following command:

`solana-install init 1.18.0`

If you run into this error at any point attempting to build the program, that likely means you do not have the correct version of the solana CLI installed.

```
anchor build
error: package `solana-program v1.18.0` cannot be built because it requires rustc 1.72.0 or newer, while the currently active rustc version is 1.68.0-dev
Either upgrade to rustc 1.72.0 or newer, or use
cargo update -p solana-program@1.18.0 --precise ver
where `ver` is the latest version of `solana-program` supporting rustc 1.68.0-dev
```

You will also want the latest version of the anchor CLI installed. You can follow along the steps listed here to update via avm https://www.anchor-lang.com/docs/avm

or simply run
`anchor install latest`

At the time of writing, the latest version of the Anchor CLI is `0.29.0`

Now, we can check our rust version.

`rustc --version`

At the time of writing, version `1.26.0` was used for the rust compiler. If you would like to update, you can do so via `rustup`
https://doc.rust-lang.org/book/ch01-01-installation.html

`rustup update`

Now, we should have all the correct versions installed.

### 2. Get starter code and add dependencies
Clone the Lab repository:

https://github.com/Unboxed-Software/token22-staking

Checkout `starter` branch.

`git checkout starter`

### 3. Update Program ID and Anchor Keypair

Once in the starter branch, run

`anchor keys list`

to get your program ID.

Copy and paste this program ID in the `Anchor.toml` file

```rust
// in Anchor.toml
[programs.localnet]
token_22_staking = "<YOUR-PROGRAM-ID-HERE>"
```

And in the `programs/token-22-staking/src/lib.rs` file.

```rust
declare_id!("<YOUR-PROGRAM-ID-HERE>");
```

### Need to also explain how to find path to your wallet and set that in the Anchor.toml file

### 4. Confirm the program builds

Run `anchor build`. The program should build now. Do not run `anchor test`, there is an entire test suite written for the program we will build, but the tests will not pass right now.'

### 5. Explore program design

Now that we have confirmed the program builds, let's take a look at the layout of the program. You'll notice inside `/programs/token22-staking/src` there is are a few different files:
* `lib.rs`
* `error.rs`
* `state.rs`
* `utils.rs`

The `errors.rs` and `utils.rs` files are already filled out for you. `errors.rs` is where we have defined our custom errors for our program. To do this, you just have to create a public  `enum` and define each error.

`utils.rs` is a file that only contains one function called `check_token_program`. This is just a file where you can write helper functions if you have the need. This function was written ahead of time and will be used in our program to simply log the specific token program that was passed in the instruction. We will be using both the `Token22` and regular token program in this program, so this function will help clarify that distinction.

`lib.rs` is the entrypoint to our program, as is the common practice in all Solana programs. Here we define our program id using the `declare_id` Anchor macro and the public `token_22_staking` module. This module is where we define our publicly callable instructions, these can be thought of as our program's API.

We have four separate instructions defined here:
* `init_pool`
* `init_stake_entry`
* `stake`
* `unstake`

Each of these instructions makes a call to a `handler` method that is defined elsewhere. We do this to componentize the program and make it more modular. This helps keep the program organized when working with larger programs.

Each of these specific `handler` methods are defined in their own file in the `instructions` directory. You'll notice there is a file corresponding to each instruction, as well as an additional `mod.rs` file. Each of these instruction files is where we will write the logic for each individual instruction. The `mod.rs` file is what makes these `handler` methods callable from the `lib.rs` file.

### 6. Implement `state.rs`

Open up the `/src/state.rs` file. Here, we will define some state data structures and a few constants that we will need throughout our program. Let's start by bringing in the packages we'll need here.

```rust
use {
    anchor_lang::prelude::*,
    solana_program::{pubkey::Pubkey},
};
```
We are just importing the `anchor_lang` crate and the `pubkey::Pubkey` data type from the `solana_program` crate.

Next, we we will need a handful of seeds defined that will be referenced throughout the program. These seeds will be used to derive different PDAs our program will expect to receive.

```rust
use {
    anchor_lang::prelude::*,
    solana_program::{pubkey::Pubkey},
};

pub const STAKE_POOL_STATE_SEED: &str = "state";
pub const VAULT_SEED: &str = "vault";
pub const VAULT_AUTH_SEED: &str = "vault_authority";
pub const STAKE_ENTRY_SEED: &str = "stake_entry";
```

We define four different constants here. Each one is a different seed for a different PDA.

Now, we'll define two data structs. These structs will define the data of two different accounts our program will use to hold state. The `PoolState` and `StakeEntry` accounts.

```rust
#[account]
pub struct PoolState {
    pub bump: u8,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub staking_token_mint: Pubkey,
    pub staking_token_mint_bump: u8,
    pub vault_bump: u8,
    pub vault_auth_bump: u8,
    pub vault_authority: Pubkey,
}

#[account]
pub struct StakeEntry {
    pub user: Pubkey,
    pub user_stake_token_account: Pubkey,
    pub bump: u8,
    pub balance: u64,
    pub last_staked: i64,
}
```

The `PoolState` account is meant to hold information about a specific staking pool. The `StakeEntry` account will hold information about a specific user's stake in that pool.

### 7. `init_pool` Instruction

Now that we understand our program's architecture, let's get started with the first instruction `init_pool`. Open `init_pool.rs` and you should see the following:

```rust
use {
    anchor_lang::prelude::*,
    crate::{state::*, utils::*},
    anchor_spl::{token_interface},
    std::mem::size_of
};

pub fn handler(ctx: Context<InitializePool>) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

The `handler` method is defined and so is the `InitializePool` accounts struct. The accounts struct simply expects to receive a `token_program` account and that's it. The `handler` method calls the `check_token_program` method that is defined in the `utils.rs` file. As it stands, this instruction does not really do a whole lot.

To get started implementing the logic of this instruction, let's first think about the accounts that will be required. We will need the following to initialize a staking pool:
* `pool_authority` - PDA that is the authority over all staking pools. This will be a PDA derived with a specific seed.
* `pool_state` - State account created in this instruction at a PDA. This account will hold state regarding this specific staking pool like the amount of tokens staked, how many users have staked, etc.
* `token_mint` - The mint of tokens expected to be staked in this staking pool. There will be a unique staking pool for each token.
* `token_vault` - Token account of the same mint as `token_mint` at a PDA. This is a token account with the `pool_authority` PDA as the authority. This gives the program control over the token account. All tokens staked in this pool will be held in this token account.
* `staking_token_mint` - The reward token mint for staking in this pool. 
* `payer` - Account responsible for paying for the creation of the staking pool.
* `token_program` - The token program associated with the given token and mint accounts. Should work for either the Token22 or regular token program.
* `system_program` - System program
* `rent` - Rent program

Let's implement this accounts struct starting with the `pool_authority` account and its constraints.

```rust
#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// CHECK: PDA, auth over all token vaults
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

The `pool_authority` account is a PDA derived with the `VAULT_AUTH_SEED` that we defined in the `state.rs` file. This account does not hold any state, so we do not need to deserialize it into any specific account structure. For this reason, we use the `UncheckedAccount` anchor account type. This is considered unsafe by anchor because anchor does not do any additional verification under the hood when the `UncheckedAccount` type is used. The `UncheckedAccount` type is an explicit wrapper for the `AccountInfo` type. This is meant to indicate anchor does not do any additional checks on the account passed in. This is okay here because we do verify that the account is the expected PDA and we do not read or write from the account. However, the `/// CHECK:` comment is required above an account utilizing the `UncheckedAccount` or `AccountInfo` structs. Without that annotation, your program will throw the following error while building:

```
Struct field "pool_authority" is unsafe, but is not documented.
Please add a `/// CHECK:` doc comment explaining why no checks through types are necessary.
See https://www.anchor-lang.com/docs/the-accounts-struct#safety-checks for more information.
```

Next, we'll define the `pool_state` account.

```rust
// pool state account
#[account(
    init,
    seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
    bump,
    payer = payer,
    space = 8 + size_of::<PoolState>()
)]
pub pool_state: Account<'info, PoolState>,
```

This account utilizes the `init` constraint, which indicates to anchor that we need to create the account. The account is expected to be a PDA derived with the `token_mint` account key and `STAKE_POOL_STATE_SEED` as keys. `payer` is required to pay the rent required to create this account. And we allocate enough space for the account to store the `PoolState` data struct that we defined in the `state.rs` file. Lastly, we use the `Account` type to deserialize the given account into the `PoolState` struct.

Moving on to the `token_mint` account.

```rust
// Mint of token
#[account(
    mint::token_program = token_program,
    mint::authority = payer
)]
pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

We make use of two account constraints on this `token_mint` account. `mint::token_program = <token_program>` verifies that the given account is a mint created from the given `<token_program>`. Before Token22, this was not really a concern as there was only one token program. Now, there are two! The reason we verify the `token_mint` account belongs to the given `token_program` is because token accounts and mints of one program are not compatible with token accounts and mints from the other program. So, for every instruction in our program, we will be verifying that all the given token accounts and mints belong to the same `token_program`.

The second constraint `mint::authority = payer` verifies that the authority over the mint passed in is the `payer` account, which will also be required to be a signer. This may seem counterintuitive, but we do this because at the moment we are inherently restricting the program to one staking pool per token due to the PDA seeds we use for the `pool_state` account. We also allow the creator of the pool to define what the reward token mint is for staking in that pool. Because the program currently limits one pool per token, we wouldn't want to allow just anybody to create a staking pool for a token. This gives the creator of the pool control over what the reward is for staking here. Imagine if we did not require the `mint::authority`, this would allow anyone to create the staking pool for `Token X` and define what the reward is for everyone that stakes `Token X` with this staking program. If they decide to define the reward token as the meme coin `FooBar`, then everyone would be stuck with that staking pool in this program. For this reason, we will only allow the `token_mint` authority to create a staking pool for said `token_mint`. This program design would probably not be a good choice for the real world, it does not scale very well. But, it serves as a great example to help get the points across in this lesosn while keeping things relatively simple. This can also serve as a good exercise in program design. How would you design this program to make it more scalable for mainnet?

Lastly, we utilize the `InterfaceAccount` struct to deserialize the given account into `token_interface::Mint`. 
The `InterfaceAccount` type is a wrapper around `AccountInfo` that verifies program ownership and deserializes underlying data into a given Rust type. Used with the `token_interface::Mint` struct, anchor knows to deserialize this into a token account. The `token_interface::Mint` struct provides support for both `spl-token` and `token22` mints out of the box! This interface concept was created specifically for this use case. You can read more about the `InterfaceAccount` in the [`anchor_lang` docs](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/interface_account/struct.InterfaceAccount.html).

Looking at the `pool_token_vault` where the tokens staked in this pool will be held.

```rust
// pool token account for Token Mint
    #[account(
        init,
        token::mint = token_mint,
        token::authority = pool_authority,
        token::token_program = token_program,
        // use token_mint, pool auth, and constant as seeds for token a vault
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump,
        payer = payer,
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
```

We initialize the token account with the `init` constraint, create the token account with mint = `token_mint`, authority = `pool_authority`, and `token_program`. This token account is created at a PDA using the `token_mint`, `pool_authority`, and `VAULT_SEED` as seeds. `pool_authority` is assigned as authority over this token account so that the program has control over it.

Moving on to `staking_token_mint`

```rust
// Mint of staking token
#[account(
    mut,
    mint::token_program = token_program
)]
pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

We just verify the mint belongs to the given `token_program`. Again, we are using `InterfaceAccount` and `token_interface::Mint` here.

Then, we have a few familiar accounts.

```rust
// payer, will pay for creation of pool vault
#[account(mut)]
pub payer: Signer<'info>,
pub token_program: Interface<'info, token_interface::TokenInterface>,
pub system_program: Program<'info, System>,
pub rent: Sysvar<'info, Rent>
```

The only on here I want to talk about is the `token_program`. This account uses the `Interface` and `token_interface::TokenInterface` structs similar to the `TokenInterface` and mint/token structs we used earlier. This follows the same idea as those, the `Interface` and `token_interface::TokenInterface` structs allow for either token program to be passed in here. This is why we must verify that all of the token and mint accounts passed in belong to the given `token_program`.

Your accounts struct should look like this now:

```rust
#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// CHECK: PDA, auth over all token vaults
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    // pool state account
    #[account(
        init,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump,
        payer = payer,
        space = 8 + size_of::<PoolState>()
    )]
    pub pool_state: Account<'info, PoolState>,
    // Mint of token
    #[account(
        mint::token_program = token_program,
        mint::authority = payer
    )]
    pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
    // pool token account for Token Mint
    #[account(
        init,
        token::mint = token_mint,
        token::authority = pool_authority,
        token::token_program = token_program,
        // use token_mint, pool auth, and constant as seeds for token a vault
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump,
        payer = payer,
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
    // Mint of staking token
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
    // payer, will pay for creation of pool vault
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}
```

That is the bulk of the logic for this instruction. Inside the `handler` function, we are just initiailizating the state of the `pool_state` account that was created in the accounts struct. The `handler` function should be:

```rust
pub fn handler(ctx: Context<InitializePool>) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());
    
    // initialize pool state
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.bump = ctx.bumps.pool_state;
    pool_state.amount = 0;
    pool_state.vault_bump = ctx.bumps.token_vault;
    pool_state.vault_auth_bump = ctx.bumps.pool_authority;
    pool_state.token_mint = ctx.accounts.token_mint.key();
    pool_state.staking_token_mint = ctx.accounts.staking_token_mint.key();
    pool_state.vault_authority = ctx.accounts.pool_authority.key();

    msg!("Staking pool created!");

    Ok(())
}
```

We just initiaize each field in the `PoolState` struct that was defined in the `state.rs` file.

After that, save your work and run `anchor build` to make sure there are no issues with your program at this point.

### 8. `init_stake_entry` Instruction

Now we can move on to the `init_stake_entry.rs` file. This instruction creates a staking account for a user to keep track of some state while they stake their tokens. The `StakeEntry` account is required to exist before a user can stake tokens. The `StakeEntry` account struct was defined in the `state.rs` file earlier.

Let's get started with the accounts required for this instruction. We will need the following:

* `user` - The user that is creating the `stake_entry` account. This account must sign the transaction and will need to pay for the rent required to create the `stake_entry` account.
* `user_stake_entry` - State account that will be created at a PDA derived from the user, mint the staking pool was created for, and the `STAKE_ENTRY_SEED` as seeds.
* `user_stake_token_account` - User's associated token account for the staking reward token
* `staking_token_mint` - mint of the staking reward token of this pool
* `pool_state` - `PoolState` account for this staking pool
* `token_program` - Token Program
* `associated_token_program` - Associated token program
* `system_program` - System Program

Let's start by adding in the `user` account to the `InitializeStakeEntry` account struct.

```rust
#[derive(Accounts)]
pub struct InitializeStakeEntry<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

We just need to make sure the `user` account has signed the transaction and that the account is mutable.

```rust
#[account(
        init,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump,
        payer = user,
        space = 8 + size_of::<StakeEntry>()
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
```

The `user_stake_entry` account requires a few more constraints. We need to initialize the account, derive the address using the expected seeds, define who is paying for the creation of the account, and allocate enough space for the `StakeEntry` data struct. We deserialize the given account into the `StakeEntry` account.

```rust
#[account(
        init,
        associated_token::mint = staking_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        payer = user,
    )]
    pub user_stake_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
```

The `user_stake_token_account` is again the account where the user's staking rewards will eventually be sent. We create the account in this instruction so we don't have to worry about it later on when it's time to dole out the staking rewards. Because we initialize this account in this instruction, it puts a limit on the number of pools a user can stake in with the same reward token. This current design would prevent a user from creating another `user_stake_entry` account for another pool with the same `staking_token_mint`. This is another design choice that probably would not scale in production. Think about how else this could be designed.

We use some similar SPL constraints as in the previous instruction, this time targeting the associated token program. With the `init` constraint, these tell anchor what mint, authority, and token program to use while initializing this associated token account.

Again, we are using the `InterfaceAccount` and `token_interface::TokenAccount` types here. Note, the `token_interface::TokenAccount` type can only be used in conjunction with `InterfaceAccount`.

```rust
#[account(
        constraint = staking_token_mint.key() == pool_state.staking_token_mint
        @ StakeError::InvalidStakingTokenMint,
        mint::token_program = token_program
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

Next, we add the `staking_token_mint` account. Notice, we are using our firstcustom error here. This constraint verifies that the pubkey on the `staking_token_mint` account is equal to the pubkey stored in the `staking_token_mint` field of the given `PoolState` account. This field was initialized in the `handler` method of the `inti_pool` instruction in the previous step.

```rust
#[account(
        seeds = [pool_state.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,
```
The `pool_state` account is pretty much the same here as in the `init_pool` instruction. However, in the `init_pool` instruction we saved the bump used to derive this account so we don't actually have to re-calculate it every time we want to verify the PDA. We can conveniently call `bump = pool_state.bump` and this will use the bump stored in this account.

The remaining accounts ones that we are familiar with already and there are not any special constraints on them.

```rust
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
```

The final `InitializeStakeEntry` account struct should be:

```rust
#[derive(Accounts)]
pub struct InitializeStakeEntry<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump,
        payer = user,
        space = 8 + size_of::<StakeEntry>()
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    #[account(
        init,
        associated_token::mint = staking_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        payer = user,
    )]
    pub user_stake_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        constraint = staking_token_mint.key() == pool_state.staking_token_mint
        @ StakeError::InvalidStakingTokenMint,
        mint::token_program = token_program
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
    #[account(
        seeds = [pool_state.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}
```

The `handler` method is also very simple in this instruction. A majority of logic was handled with Anchor constraints in the accounts struct, so all we need to do in `handler` is initialize the state of the newly created `user_stake_entry` account.

```rust
pub fn handler(ctx: Context<InitializeStakeEntry>) -> Result<()> {
    check_token_program(ctx.accounts.token_program.key());

    // initialize user stake entry state
    let user_entry = &mut ctx.accounts.user_stake_entry;
    user_entry.user = ctx.accounts.user.key();
    user_entry.user_stake_token_account = ctx.accounts.user_stake_token_account.key();
    user_entry.bump = ctx.bumps.user_stake_entry;
    user_entry.balance = 0;
    
    Ok(())
}
```

Save your work and run `anchor build` to verify there are no compilation errors.

### 9. `stake` Instruction

The `stake` instruction is what is called when users actually want to stake their tokens. This instruction should transfer the amount of tokens the user wants to stake from their token account to the pool vault account that is owned by the program. There will be a lot of validation in this instruction to prevent any attempts of using the instruction incorrectly.

The accounts required are:
* `pool_state` - State account of the staking pool.
* `token_mint` - Mint of the token being staked. This is required for the transfer.
* `pool_authority` - PDA given authority over all staking pools. (dont think this account is necessary)
* `token_vault` - Token vault account where the tokens staked in this pool are held.
* `user` - User attempting to stake tokens.
* `user_token_account` - User owned token account where the tokens they would like to stake will be transferred from.
* `user_stake_entry` - User `StakeEntry` account created in the previous instruction
* `token_program`
* `system_program`

Again, let's build the `Stake` account struct first.

```rust
#[derive(Accounts)]
pub struct Stake<'info> {
        // pool state account
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

First taking a look at the `pool_state` account. This is the same account we have used in previous instructions, derived with the same seeds and bump.

```rust
// Mint of token to stake
#[account(
    mut,
    mint::token_program = token_program
)]
pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

Next, is the `token_mint` which is required for the transfer CPI in this instruction. This is the mint of the token that is being staked. We verify that the given mint is of the given `token_program` to make sure we are not mixing any spl-token and Token22 accounts.

```rust
/// CHECK: PDA, auth over all token vaults
#[account(
    seeds = [VAULT_AUTH_SEED.as_bytes()],
    bump
)]
pub pool_authority: UncheckedAccount<'info>,
```

The `pool_authority` account is again the PDA that is the authority over all of the staking pools.

```rust
// pool token account for Token Mint
#[account(
    mut,
    // use token_mint, pool auth, and constant as seeds for token a vault
    seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
    bump = pool_state.vault_bump,
    token::token_program = token_program
)]
pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
```

Now we have the `token_vault` which is where the tokens will be held while they are staked. This account MUST be verified, as this is where the tokens are transferred to. Here, we verify the given account is the expected PDA derived from the `token_mint`, `pool_authority`, and `VAULT_SEED` seeds. We also verify the token account belongs to the given `token_program`. We use `InterfaceAccount` and `token_interface::TokenAccount` here again to support either spl-token or Token22 accounts.

```rust
#[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
    pub user: Signer<'info>,
```

The `user` account is marked as mutable and must sign the transaction. This makes sense, they are the ones initiating the transfer and they are the owned of the tokens being transferred so their signature is a requirement for the transfer to take place. 

Note, we also verify the given user is the same pubkey stored in the given `user_stake_entry` account. If it is not, our program will throw the `InvalidUser` custom error.

```rust
#[account(
    mut,
    constraint = user_token_account.mint == pool_state.token_mint
    @ StakeError::InvalidMint,
    token::token_program = token_program
)]
pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
```

The `user_token_account` is the token account where the tokens being transferred to be staked should be currently held. The mint of this token account must match the mint of the staking pool. If it does not, a custom `InvalidMint` error will be thrown. We also verify the given token account matches the given  `token_program`.

The last three accounts are ones we are familiar with by now.

```rust
#[account(
    mut,
    seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
    bump = user_stake_entry.bump,

)]
pub user_stake_entry: Account<'info, StakeEntry>,
pub token_program: Interface<'info, token_interface::TokenInterface>,
pub system_program: Program<'info, System>
```

The full `Stake` accounts struct should look like:
```rust
#[derive(Accounts)]
pub struct Stake<'info> {
    // pool state account
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    // Mint of token to stake
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
    /// CHECK: PDA, auth over all token vaults
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    // pool token account for Token Mint
    #[account(
        mut,
        // use token_mint, pool auth, and constant as seeds for token a vault
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool_state.vault_bump,
        token::token_program = token_program
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == pool_state.token_mint
        @ StakeError::InvalidMint,
        token::token_program = token_program
    )]
    pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump = user_stake_entry.bump,

    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>
}
```

That is it for the accounts struct. Save your work and verify your program still compiles.
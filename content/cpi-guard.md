# Summary

# Overview

# Lab

This lab will primarily focus on writing tests in typescript, but we will need to run a program locally against these tests. For this reason, we will need to go through a few steps to ensure we have a proper environment on your machine for the program to run. The on-chain program has already been written for you and is included in the lab starter code.

The program contains a few instructions that showcase what the CPI Guard can protect against. We will write tests invoking these instructionsboth with a CPI Guarded Token Account and a Token Account without a CPI Guard.

The tests have been broken up into specific files in the `/tests` directory. Each file serves as its own unit test that will invoke a specific instruction on our program.

The program has five instructions: `malicious_close_account`, `prohibited_approve_account`, `prohibited_set_authority`, `unauthorized_burn`, `set_owner`.

Each of these instructions makes a CPI to the `Token Extension Program` and attempts to take an action on the given token program that is potentially malicious unknowingly to the signer of the original transaction.

### 1. Verify Solana/Anchor/Rust Versions

We will be interacting with the `token22` program in this lab and that requires you have solana cli version ≥ 1.18.0. 

To check your version run:
```bash
solana --version
```

If the version printed out after running `solana --version` is less than `1.18.0` then you can update the cli version manually. Note, at the time of writing this, you cannot simply run the `solana-install update` command. This command will not update the CLI to the correct version for us, so we have to explicitly download version `1.18.0`. You can do so with the following command:

```bash
solana-install init 1.18.0
```

If you run into this error at any point attempting to build the program, that likely means you do not have the correct version of the solana CLI installed.

```bash
anchor build
error: package `solana-program v1.18.0` cannot be built because it requires rustc 1.72.0 or newer, while the currently active rustc version is 1.68.0-dev
Either upgrade to rustc 1.72.0 or newer, or use
cargo update -p solana-program@1.18.0 --precise ver
where `ver` is the latest version of `solana-program` supporting rustc 1.68.0-dev
```

You will also want the latest version of the anchor CLI installed. You can follow along the steps listed here to update via avm https://www.anchor-lang.com/docs/avm

or simply run
```bash
avm install latest
avm use latest
```

At the time of writing, the latest version of the Anchor CLI is `0.29.0`

Now, we can check our rust version.

```bash
rustc --version
```

At the time of writing, version `1.26.0` was used for the rust compiler. If you would like to update, you can do so via `rustup`
https://doc.rust-lang.org/book/ch01-01-installation.html

```bash
rustup update
```

Now, we should have all the correct versions installed.

### 2. Get starter code and add dependencies

Let's grab the starter branch.

```bash
git clone https://github.com/Unboxed-Software/token22-staking
cd token22-staking
git checkout starter
```

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

Lastly set your developer keypair path in `Anchor.toml`.

```toml
[provider]
cluster = "Localnet"
wallet = "/YOUR/PATH/HERE/id.json"
```

If you don't know what your current keypair path is you can always run the solana cli to find out.

```bash
solana config get
```

### 4. Confirm the program builds

Let's build the starter code to confirm we have everything configured correctly. If it does not build, please revisit the steps above.

```bash
anchor build
```

You can safely ignore the warnings of the build script, these will go away as we add in the necessary code.

Feel free to run the provided tests to make sure the rest of the dev environment is setup correct. You'll have to install the node dependancies using `npm` or `yarn`. The tests should run, but they do not do anything currently.

```bash
yarn install
anchor test
```

### 5. Approve Delegate

The first CPI Guard we will test is the approve delegate functionality. The CPI Guard prevents approving a delegate of a token account with the CPI Guard enabled via CPI completely. It's important to note that you can approve a delegate on a CPI Guarded account, just not with a CPI. To do so, you must send an instruction directly to the `Token Extensions Program` from a client rather than via another program.

Before we write our test, we need to take a look at the program code we are testing. The `prohibited_approve_account` instruction is what we will be targeting here. 

```rust
pub fn prohibited_approve_account(ctx: Context<ApproveAccount>, amount: u64) -> Result<()> {
        msg!("Invoked ProhibitedApproveAccount");

        msg!("Approving delegate: {} to transfer up to {} tokens.", ctx.accounts.delegate.key(), amount);

        approve(ctx.accounts.approve_delegate_ctx(), amount)?;
        Ok(())
    }
    ...

#[derive(Accounts)]
pub struct ApproveAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::token_program = token_program,
        token::authority = authority
    )]
    pub token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    /// CHECK: delegat to approve
    #[account(mut)]
    pub delegate: AccountInfo<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
...
impl <'info> ApproveAccount <'info> {
    pub fn approve_delegate_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Approve<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Approve {
            to: self.token_account.to_account_info(),
            delegate: self.delegate.to_account_info(),
            authority: self.authority.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    } 
}
```

If you are familiar with Solana programs, then this should look like a pretty simple instruction. The instruction expects an `authority` account as a `Signer` and a `token_account` that `authority` is the authority of.

The instruction then invokes the `Approve` instruction on the `Token Extensions Program` and attempts to assign `delegate` as the delegate over the given `token_account`.

Let's open the `/tests/approve-delegate-example.ts` file to begin testing this instruction.  We will need to initialize some test accounts.

```typescript
// test accounts
const payer = anchor.web3.Keypair.generate()
let testTokenMint: PublicKey = null
let userTokenAccount = anchor.web3.Keypair.generate()
let maliciousAccount = anchor.web3.Keypair.generate()
```
Then, we can move on to the "[CPI Guard] Approve Delegate Example" test. You'll notice that some test names have "[CPI Guard]" in the title. Those with this in the title are tests with a CPI Guarded token account and those without it use token accounts without the CPI Guard enabled. They invoke the same exact instruction in our target program, the only difference is whether or not they have the CPI Guard enabled or not. This is done to illustrate what the CPI Guard protects against versus an account without one.

To test our instruction, we first need to create our token mint and a token account with extensions.

```typescript
it("[CPI Guard] Approve Delegate Example", async () => {
    // airdrop tokens to test accounts to pay for transactions
    await safeAirdrop(payer.publicKey, provider.connection)
    await safeAirdrop(provider.wallet.publicKey, provider.connection)
    delay(10000)

    testTokenMint = await createMint(
        provider.connection,
        payer,
        provider.wallet.publicKey,
        undefined,
        6,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    )
    await createTokenAccountWithExtensions(
        provider.connection,
        testTokenMint,
        payer,
        payer,
        userTokenAccount
    )
})
```

We have created a Mint and a token account with the CPI Guard enabled. We can now send a transaction to our program so that it will attempt to invoke the Approve delegate instruction on the `Token Extensions Program`.

```typescript
// inside "[CPI Guard] Approve Delegate Example" test block
try {
    const tx = await program.methods.prohibitedApproveAccount(new anchor.BN(1000))
    .accounts({
    authority: payer.publicKey,
    tokenAccount: userTokenAccount.publicKey,
    delegate: maliciousAccount.publicKey,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([payer])
    .rpc();

    console.log("Your transaction signature", tx);
} catch (e) {
    assert(e.message == "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2d")
    console.log("CPI Guard is enabled, and a program attempted to approve a delegate");
}
```

Notice we wrap this in a try/catch block. This is because this instruction should fail if the CPI Guard works correctly. We catch the error and assert that the error message is what we expect. 

Now, we essentially do the same thing for the "Approve Delegate Example" test, except we want to pass in a token account without a CPI Guard. To do this, we can simply disavle the CPI Guard on the `userTokenAccount` and resend the transaction.

```typescript
 it("Approve Delegate Example", async () => {
    await disableCpiGuard(
        provider.connection,
        payer,
        userTokenAccount.publicKey,
        payer,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    )

    await program.methods.prohibitedApproveAccount(new anchor.BN(1000))
        .accounts({
            authority: payer.publicKey,
            tokenAccount: userTokenAccount.publicKey,
            delegate: maliciousAccount.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
})
```
This transaction will succeed and the `delegate` account will now have authority to transfer the given amount of tokens from the `userTokenAccount`.

Feel free to save your work and run `anchor test`. All of the tests will run, but these two are the only ones that are doing anything yet. They should both pass at this point.

### 6. Close Account

The close account instruction invokes the `close_account` instrucion on the `Token Extensions Program`. This simply will close the given token account, but you have the ability to define which account you'd like the lamports in this account used for rent can be transferred to. The CPI Guard ensures that this account is always the account owner.

```rust
pub fn malicious_close_account(ctx: Context<MaliciousCloseAccount>) -> Result<()> {
        msg!("Invoked MaliciousCloseAccount");

        msg!("Token account to close : {}", ctx.accounts.token_account.key());

        close_account(ctx.accounts.close_account_ctx())?;
        Ok(())
    }

#[derive(Accounts)]
pub struct MaliciousCloseAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::token_program = token_program,
        token::authority = authority
    )]
    pub token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    /// CHECK: malicious account
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> MaliciousCloseAccount <'info> {
    // close_account for Token2022
    pub fn close_account_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CloseAccount<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = CloseAccount {
            account: self.token_account.to_account_info(),
            destination: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

The program just invokes the `close_account` instruction, but a potentially malicious client could pass in a different account than the token account owner as the `destination` account. This would be hard to see from a user's perspective unless the wallet notified them. With CPI Guards enabled, the `Token Extension Program` will simply reject the instruction if that is the case.

To test this, we will open up the `/tests/close-account-example.ts` file. First, we have to define our test accounts.

```typescript
// test accounts
const payer = anchor.web3.Keypair.generate()
let testTokenMint: PublicKey = null
let userTokenAccount = anchor.web3.Keypair.generate()
let maliciousAccount = anchor.web3.Keypair.generate()
```

Then, we can create our Mint and Token account with extensions.

```typescript
it("[CPI Guard] Close Account Example", async () => {
    await safeAirdrop(payer.publicKey, provider.connection)
    await safeAirdrop(provider.wallet.publicKey, provider.connection)
    delay(10000)

    testTokenMint = await createMint(
        provider.connection,
        payer,
        provider.wallet.publicKey,
        undefined,
        6,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    )
    await createTokenAccountWithExtensions(
        provider.connection,
        testTokenMint,
        payer,
        payer,
        userTokenAccount
    )
})
```

And finally, we can send a transaction to our `malicious_close_account` instruction. Since we have the CPI Guard enabled on this token account, the transaction should fail. Our test verifies it fails for the expected reason.

```typescript
// inside "[CPI Guard] Close Account Example" test block
try {
const tx = await program.methods.maliciousCloseAccount()
    .accounts({
        authority: payer.publicKey,
        tokenAccount: userTokenAccount.publicKey,
        destination: maliciousAccount.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([payer])
    .rpc();

    console.log("Your transaction signature", tx);
} catch (e) {
    assert(e.message == "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2c")
    console.log("CPI Guard is enabled, and a program attempted to close an account without returning lamports to owner");
}
```

Now, we can disable the CPI Guard and send the same exact transaction in the "Close Account without CPI Guard" test. This transaction should succeed this time.

```typescript
it("Close Account without CPI Guard", async () => {
    await disableCpiGuard(
        provider.connection,
        payer,
        userTokenAccount.publicKey,
        payer,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    )

    await program.methods.maliciousCloseAccount()
        .accounts({
            authority: payer.publicKey,
            tokenAccount: userTokenAccount.publicKey,
            destination: maliciousAccount.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
})
```

### 7. Set Authority

Moving on to the `prohibited_set_authority` instruction, the CPI Guard protects against a CPI setting the `CloseAccount` authority. If this were allowed, then it could be used as a workaround for the previous `close_account` protection. So, the CPI Guard does not allow a CPI to change the `CloseAccount` authority either, unless it is unsetting.

```rust
pub fn prohibted_set_authority(ctx: Context<SetAuthorityAccount>) -> Result<()> {
    msg!("Invoked ProhibitedSetAuthority");

    msg!("Setting authority of token account: {} to address: {}", ctx.accounts.token_account.key(), ctx.accounts.new_authority.key());

    set_authority(
        ctx.accounts.set_authority_ctx(),
        spl_token_2022::instruction::AuthorityType::CloseAccount,
        Some(ctx.accounts.new_authority.key()),
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct SetAuthorityAccount<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::token_program = token_program,
        token::authority = authority
    )]
    pub token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    /// CHECK: delegat to approve
    #[account(mut)]
    pub new_authority: AccountInfo<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

impl <'info> SetAuthorityAccount <'info> {
    pub fn set_authority_ctx(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = SetAuthority {
            current_authority: self.authority.to_account_info(),
            account_or_mint: self.token_account.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    } 
}
```

Our program instruction simply invokes the `SetAuthority` `Token Extensions Program` instruction and indicates we want to set the `spl_token_2022::instruction::AuthorityType::CloseAccount` authority of the given token account.

Open the `/tests/set-authority-example.ts` file and let's define our test accounts.

```typescript
// test accounts
const payer = anchor.web3.Keypair.generate()
let testTokenMint: PublicKey = null
let userTokenAccount = anchor.web3.Keypair.generate()
let maliciousAccount = anchor.web3.Keypair.generate()
```

And same as the previous tests, we will create our Mint and Token account with extensions. Then, we can send a transaction to our `prohibited_set_authority` instruction.

```typescript
it("[CPI Guard] Set Authority Example", async () => {
    await safeAirdrop(payer.publicKey, provider.connection)
    await safeAirdrop(provider.wallet.publicKey, provider.connection)
    delay(10000)

    testTokenMint = await createMint(
        provider.connection,
        payer,
        provider.wallet.publicKey,
        undefined,
        6,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    )
    await createTokenAccountWithExtensions(
        provider.connection,
        testTokenMint,
        payer,
        payer,
        userTokenAccount
    )

    try {
        const tx = await program.methods.prohibtedSetAuthority()
        .accounts({
            authority: payer.publicKey,
            tokenAccount: userTokenAccount.publicKey,
            newAuthority: maliciousAccount.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();

    console.log("Your transaction signature", tx);
    } catch (e) {
        assert(e.message == "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2e")
        console.log("CPI Guard is enabled, and a program attempted to add or change an authority");
    }
})
```

For the "Set Authority Example" test, we can disable the CPI Guard and re-send the transaction.

```typescript
it("Set Authority Example", async () => {
    await disableCpiGuard(
        provider.connection,
        payer,
        userTokenAccount.publicKey,
        payer,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    )

    await program.methods.prohibtedSetAuthority()
        .accounts({
            authority: payer.publicKey,
            tokenAccount: userTokenAccount.publicKey,
            newAuthority: maliciousAccount.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
})
```

### 8. Burn

The next instruction we will test is the `unauthorized_burn` instruction from our test program. This instruction invokes the `burn` instruction from the `Token Extensions Program` and attempts to burn a given amount of tokens from the given token account.

The CPI Guard ensures that this is only possible if the signing authority is the token account delegate.

```rust
pub fn unauthorized_burn(ctx: Context<BurnAccounts>, amount: u64) -> Result<()> {
        msg!("Invoked Burn");

        msg!("Burning {} tokens from address: {}", amount, ctx.accounts.token_account.key());

        burn(
            ctx.accounts.burn_ctx(),
            amount
        )?;

        Ok(())
    }

...

#[derive(Accounts)]
pub struct BurnAccounts<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::token_program = token_program,
        token::authority = authority
    )]
    pub token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
    pub token_program: Interface<'info, token_interface::TokenInterface>
}

...

impl <'info> BurnAccounts <'info> {
    pub fn burn_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Burn<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = Burn {
            mint: self.token_mint.to_account_info(),
            from: self.token_account.to_account_info(),
            authority: self.authority.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```
To test this, open up the `tests/burn-example.ts` file. Add our test accounts.

```typescript
// test accounts
const payer = anchor.web3.Keypair.generate()
let testTokenMint: PublicKey = null
let userTokenAccount = anchor.web3.Keypair.generate()
let delegate = anchor.web3.Keypair.generate()
```

Then, we can create our Mint and Token account with extensions.

```typescript
it("[CPI Guard] Burn without Delegate Signature Example", async () => {
        await safeAirdrop(payer.publicKey, provider.connection)
        await safeAirdrop(provider.wallet.publicKey, provider.connection)
        delay(10000)

        testTokenMint = await createMint(
            provider.connection,
            payer,
            payer.publicKey,
            undefined,
            6,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        )
        await createTokenAccountWithExtensions(
            provider.connection,
            testTokenMint,
            payer,
            payer,
            userTokenAccount
        )
    })
```

Next, we will also need to mint some tokens to our test account.

```typescript
// inside "[CPI Guard] Burn without Delegate Signature Example" test block
const mintToTx = await mintTo(
    provider.connection,
    payer,
    testTokenMint,
    userTokenAccount.publicKey,
    payer,
    1000,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
)
```

And then we will approve a delegate over our token account. This token account has a CPI Guard enabled currently, but we are still able to approve a delegate. This is because we are doing so by invoking the `Token Extensions Program` directly and not via a CPI like our earlier example.

```typescript
// inside "[CPI Guard] Burn without Delegate Signature Example" test block
const approveTx = await approve(
    provider.connection,
    payer,
    userTokenAccount.publicKey,
    delegate.publicKey,
    payer,
    500,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
)
```

Now that we have a delegate over our token account, we can send a transaction to our program to attempt to burn some tokens. We will be passing in the `payer` account as the authority. This account is the owner over the `userTokenAccount`, but since we have approved the `delegate` account as the delegate, the CPI Guard will prevent this transaction from going through.

```typescript
// inside "[CPI Guard] Burn without Delegate Signature Example" test block
try {
    const tx = await program.methods.unauthorizedBurn(new anchor.BN(500))
    .accounts({
        // payer is not the delegate
        authority: payer.publicKey,
        tokenAccount: userTokenAccount.publicKey,
        tokenMint: testTokenMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
    })
    .signers([payer])
    .rpc();

    console.log("Your transaction signature", tx);
} catch (e) {
    assert(e.message == "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2b")
    console.log("CPI Guard is enabled, and a program attempted to burn user funds without using a delegate.");
}
```

For the "Burn without Delegate Signature Example" test, we will simply disable the CPI Guard and re-send the transaction.

```typescript
it("Burn without Delegate Signature Example", async () => {
    await disableCpiGuard(
        provider.connection,
        payer,
        userTokenAccount.publicKey,
        payer,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
    )

    const tx = await program.methods.unauthorizedBurn(new anchor.BN(500))
        .accounts({
            // payer is not the delegate
            authority: payer.publicKey,
            tokenAccount: userTokenAccount.publicKey,
            tokenMint: testTokenMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
})
```

### 9. Set Owner

The last CPI Guard we will test is the `SetOwner` protection. With the CPI Guard enabled, this action is always prohibited even outside of a CPI. To test this, we will attempt to set the owner of a token account from the client side, as well as CPI via our test program.

Here is the program instruction.

```rust
pub fn set_owner(ctx: Context<SetOwnerAccounts>) -> Result<()> {

    msg!("Invoked SetOwner");

    msg!("Setting owner of token account: {} to address: {}", ctx.accounts.token_account.key(), ctx.accounts.new_owner.key());

    set_authority(
        ctx.accounts.set_owner_ctx(),
        spl_token_2022::instruction::AuthorityType::AccountOwner,
        Some(ctx.accounts.new_owner.key()),
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct SetOwnerAccounts<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        token::token_program = token_program,
        token::authority = authority
    )]
    pub token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    /// CHECK: delegat to approve
    #[account(mut)]
    pub new_owner: AccountInfo<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}

impl <'info> SetOwnerAccounts <'info> {
    pub fn set_owner_ctx(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = SetAuthority {
            current_authority: self.authority.to_account_info(),
            account_or_mint: self.token_account.to_account_info(),
        };

        CpiContext::new(cpi_program, cpi_accounts)
    } 
}
```

Open up the `/tests/set-owner-example.ts` file. There are four tests we will write for this one. Two for setting the Owner without a CPI and two for setting the owner via CPI.

Define our test accounts.

```typescript
// test accounts
const payer = anchor.web3.Keypair.generate()
let testTokenMint: PublicKey = null
let userTokenAccount = anchor.web3.Keypair.generate()
let newOwner = anchor.web3.Keypair.generate()
```

Starting with the first "[CPI Guard] Set Authority without CPI on CPI Guarded Account" test, we will create the Mint and Token Account with extensions.

```typescript
it("[CPI Guard] Set Authority without CPI on CPI Guarded Account", async () => {
    await safeAirdrop(payer.publicKey, provider.connection)
    delay(10000)

    testTokenMint = await createMint(
        provider.connection,
        payer,
        payer.publicKey,
        undefined,
        6,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    )
    await createTokenAccountWithExtensions(
        provider.connection,
        testTokenMint,
        payer,
        payer,
        userTokenAccount
    )
})
```

Then, we will try to send a transaction to the `set_authority` instruction of the `Token Extensions Program` with the `setAuthority` function from the `@solana/spl-token` API.

```typescript
// inside the "[CPI Guard] Set Authority without CPI on CPI Guarded Account" test block
try {
    await setAuthority(
        provider.connection,
        payer,
        userTokenAccount.publicKey,
        payer,
        AuthorityType.AccountOwner,
        newOwner.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID
    )
} catch(e) {
    assert(e.message == "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2f")
    console.log("Account ownership cannot be changed while CPI Guard is enabled.")
}
```

This transaction should fail, so we wrap the call in a try/catch block and ensure the error is the expected error.

Next, we will create another token account without the CPI Guard enabled and attempt the same thing.

```typescript
    it("Set Authority without CPI on Non-CPI Guarded Account", async () => {
        let nonCpiGuardTokenAccount = anchor.web3.Keypair.generate()
        await createTokenAccount(
            provider.connection,
            testTokenMint,
            payer,
            payer,
            nonCpiGuardTokenAccount
        )

        await setAuthority(
            provider.connection,
            payer,
            userTokenAccount1.publicKey,
            payer,
            AuthorityType.AccountOwner,
            newOwner.publicKey,
            undefined,
            undefined,
            TOKEN_2022_PROGRAM_ID
        )
    })
```

Now, let's test this out using a CPI. To do that, we just have to send a transaction to the `set_owner` instruction of our program.

```typescript
it("[CPI Guard] Set Authority via CPI on CPI Guarded Account", async () => {
    try {
        await program.methods.setOwner()
            .accounts({
                authority: payer.publicKey,
                tokenAccount: userTokenAccount.publicKey,
                newOwner: newOwner.publicKey,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .signers([payer])
            .rpc();

    } catch (e) {
        assert(e.message == "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x2e")
        console.log("CPI Guard is enabled, and a program attempted to add or change an authority.")
    }
})
```

Lastly, we can create another token account without the CPI Guard enabled and pass this to the program instruction. This time, the CPI should go through.

```typescript
it("Set Authority via CPI on Non-CPI Guarded Account", async () => {
    let nonCpiGuardTokenAccount = anchor.web3.Keypair.generate()
    await createTokenAccount(
        provider.connection,
        testTokenMint,
        payer,
        payer,
        nonCpiGuardTokenAccount
    )

    await program.methods.setOwner()
        .accounts({
            authority: payer.publicKey,
            tokenAccount: nonCpiGuardTokenAccount.publicKey,
            newOwner: newOwner.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .signers([payer])
        .rpc();
})
```

And that is it! You should be able to save your work and run anchor test. All of the tests we have written should pass.
# Test Anchor Solana Porgrams With Javascript


# Lesson Objectives:
*By the end of this lesson, you will be able to:*
- Setup Test Infra for anchor programs.
- Understanding test suite and structure for anchor tests.
- Execute your first rpc call to a smart contract function.
- Fetch updated accounts values.

# Overview
Testing solana contracts is quite challenging at times and it is very important to test the complete contract before deploying. To fasten the development life cycle and release the contracts with confidence, anchor provides you a framework to unit test these smart contracts. You can write tests to make contract calls and aseert the updated state later. 

In this lesson we will write a small test suite to test one of the programs built in anchor for a shared wallet. Shared wallets are a form of multisig wallets where funds are contributed from multiple parties to initialise a wallet and later all the signatures are required before releasing the funds from the wallet.

## What is anchor ?
If you have not heard about anchor yet, anchor is a framework that makes the development in Solana easy and fast. It removes many boilerplate codes required in the native Solana program development and allows you to focus on the core logic. Building contracts in anchor is fairly simple. The contract for multi sig wallet is defined below

```
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("EuAv4GbnaREmLgyd6QFqYSmM2ow9v125MHRjmyqoMjrc");

#[program]
pub mod shared_wallet {

    use anchor_lang::solana_program::{
        program::{invoke},
        system_instruction::{transfer}
    };

    use super::*;
    pub fn create_shared_wallet(ctx: Context<CreateSharedWallet>,user_1_contribution:u64,user_2_contribution:u64) -> ProgramResult {
        let shared_wallet = &mut ctx.accounts.shared_wallet;
        let user_1_obj = &mut ctx.accounts.user_1;
        let user_2_obj = &mut ctx.accounts.user_2;

        let user_1_balance = user_1_obj.to_account_info().lamports();
        let user_2_balance = user_2_obj.to_account_info().lamports();

        if user_1_contribution > user_1_balance {
            return Err(ErrorCode::NotEnoughLamports.into());
        }

        if user_2_contribution > user_2_balance {
            return Err(ErrorCode::NotEnoughLamports.into());
        }

        shared_wallet.user_1 = *user_1_obj.to_account_info().unsigned_key();
        shared_wallet.user_2 = *user_2_obj.to_account_info().unsigned_key();

        shared_wallet.user_1_balance = user_1_contribution;
        shared_wallet.user_2_balance = user_2_contribution;

        let transfer_instruction_user_1 = &transfer(
            &shared_wallet.user_1,
            &ctx.accounts.owner.to_account_info().key,
            user_1_contribution,
        );

        invoke(
            transfer_instruction_user_1,
            &[
                ctx.accounts.user_1.to_account_info(),
                ctx.accounts.owner.to_account_info(),       
            ]
        )?;

        let transfer_instruction_user_2 = &transfer(
            &shared_wallet.user_2,
            &ctx.accounts.owner.to_account_info().key,
            user_2_contribution,
        );

        invoke(
            transfer_instruction_user_2,
            &[
                ctx.accounts.user_2.to_account_info(),
                ctx.accounts.owner.to_account_info(),       
            ]
        )

    }

    pub fn execute_transaction(ctx: Context<ExecuteTransaction>,new_user_1_balance: u64, new_user_2_balance: u64, total_transaction_amount: u64) -> ProgramResult {
        let shared_wallet = &mut ctx.accounts.shared_wallet;
        let previous_balance = shared_wallet.user_1_balance + shared_wallet.user_2_balance;
        if  total_transaction_amount > previous_balance {
            return Err(ErrorCode::InvalidBalances.into());
        }
        if previous_balance - new_user_1_balance - new_user_2_balance != total_transaction_amount {
            return Err(ErrorCode::InvalidTransaction.into());
        }
        if *ctx.accounts.user_1.to_account_info().key != shared_wallet.user_1 &&  *ctx.accounts.user_1.to_account_info().key != shared_wallet.user_2{
            return Err(ErrorCode::InvalidSigner.into());
        }
        if *ctx.accounts.user_2.to_account_info().key != shared_wallet.user_1 &&  *ctx.accounts.user_2.to_account_info().key != shared_wallet.user_2{
            return Err(ErrorCode::InvalidSigner.into());
        }
        shared_wallet.user_1_balance = new_user_1_balance;
        shared_wallet.user_2_balance = new_user_2_balance;

        let transfer_instruction = &transfer(
            &ctx.accounts.owner.to_account_info().key,
            &ctx.accounts.recipient.to_account_info().key,
            total_transaction_amount,
        );

        invoke(
            transfer_instruction,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.recipient.to_account_info()
            ]
        )?;
        Ok(())
    }

    pub fn withdraws_balance(ctx: Context<WithdrawBalance>) -> ProgramResult {
        let shared_wallet = &mut ctx.accounts.shared_wallet;

        if *ctx.accounts.signer.to_account_info().key != shared_wallet.user_1 &&  *ctx.accounts.signer.to_account_info().key != shared_wallet.user_2{
            return Err(ErrorCode::InvalidSigner.into());
        }

        let user_1_balance = shared_wallet.user_1_balance;
        let user_2_balance = shared_wallet.user_2_balance;

        let transfer_instruction_user_1 = &transfer(
            &ctx.accounts.owner.to_account_info().key,
            &shared_wallet.user_1,
            user_1_balance,
        );

        invoke(
            transfer_instruction_user_1,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.user_1.to_account_info()
            ]
        )?;


        let transfer_instruction_user_2 = &transfer(
            &ctx.accounts.owner.to_account_info().key,
            &shared_wallet.user_2,
            user_2_balance,
        );

        invoke(
            transfer_instruction_user_2,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.user_2.to_account_info()
            ]
        )?;

        shared_wallet.user_1_balance = 0;
        shared_wallet.user_2_balance = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(mut)]
    pub shared_wallet: Account<'info, SharedWallet>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub user_1: Signer<'info>,
    #[account(mut)]
    pub user_2: Signer<'info>,
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct WithdrawBalance<'info> {
    #[account(mut)]
    pub shared_wallet: Account<'info, SharedWallet>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub user_1: AccountInfo<'info>,
    #[account(mut)]
    pub user_2: AccountInfo<'info>,
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct CreateSharedWallet<'info> {
    #[account(init, payer = owner, space = 8 + 64 + 64 + 64 + 64)]
    pub shared_wallet: Account<'info, SharedWallet>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub user_1: Signer<'info>,
    #[account(mut)]
    pub user_2: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}


#[account]
pub struct SharedWallet {
    pub user_1: Pubkey,
    pub user_2: Pubkey,
    pub user_1_balance: u64,
    pub user_2_balance: u64
}

#[error]
pub enum ErrorCode {
    #[msg("Not enough lamports in wallet")]
    NotEnoughLamports,
    #[msg("Total transaction amount is greater than total money present in wallet")]
    InvalidBalances,
    #[msg("Invalid split of users balance w.r.t total transaction value")]
    InvalidTransaction,
    #[msg("Not a valid signer")]
    InvalidSigner,
}
```

If you observe a lot of boilerplate code is abstracted out by anchor, and the structure is designed so that you only focus on business logic. Testing a Solana program is always challenging; anchor solves that by giving you libraries to test Solana programs quickly. 

Anchor allows you to unit test your Solana programs using javascript. Just like in Mocha, you group tests using the `describe` function and tests using the `it` function. This strategy helps you structure your tests into units and write tests for each unit or function extensively, eg.

```
describe('Calculator', () => {
	describe('Add', () => {
		it('returns the sum of two numbers', () => {
		});
	};
	describe('Subtract', () => {
		it('returns the subtraction of two numbers', () => {
		});
	};
}
```

To make the understanding easier, we will write tests for the program defined above. Anchor uses the mocha test framework by default; hence we will structure the tests using describe. 

## Writing your first anchor test

We can create a key pair in Solana tests using the anchor library and calling the function `anchor.web3.Keypair.generate()`. Since, for the first test, we are creating a shared wallet between Alice and bob, we will create a keypair for their wallets. 

```
  const program = anchor.workspace.SharedWallet;
  const alice = anchor.web3.Keypair.generate();
  const bob = anchor.web3.Keypair.generate();
```

Since the program is about creating a shared wallet between two parties, we need to transfer some SOL into these wallets to test if all the functionalities are working as expected.
You can request an airdrop into these wallets using the following snippet. 

```
    const signature_alice = await program.provider.connection.requestAirdrop(alice.publicKey, 2000000000);
    await program.provider.connection.confirmTransaction(signature_alice);

    const signature_bob = await program.provider.connection.requestAirdrop(bob.publicKey, 2000000000);
    await program.provider.connection.confirmTransaction(signature_bob);
```

This snippet first creates a transaction object with the `public key` and `lamports` as the parameters. These lamports will be transferred to the account whole whose public key is specified. The signature that we receive is then used to confirm the transaction. 

### What are program and providers
Anchor provides a provider and program to call a Solana program. The provider is an abstraction of a connection to a Solana network. While writing tests, anchor will create a provider for us depending on env values.
Program is an abstraction that combines the IDL (instructions generated by anchor based on your contract), provider, and PorgramID and allows us to call functions of a smart contract through RPC. Anchor does the heavy lifting of providers in the test framework, but if you want to build your frontend, you need to create your provider. 


Since anchor program helps us to make RPC calls to our smart contract, we can use it to call our `createSharedWallet` function using RPC.

```
await program.rpc.createSharedWallet(user_1_contribution,user_2_contribution,{
  accounts: {
    sharedWallet: sharedWallet.publicKey,
    owner: treasuryWallet.publicKey,
    user1: alice.publicKey,
    user2: bob.publicKey,
    systemProgram: SystemProgram.programId,
  },
  signers: [alice,bob,treasuryWallet,sharedWallet]
});
```

If you observe, we have passed the parameters required by the function, which are `user_1_contribution`, `user_2_contribution`, and a `context struct` with all the parameters defined in your contract. Since every state change call in a smart contract is a transaction and requires signers, we need to specify appropriate signers to sign that transaction. That's it. You just made your first call to your smart contract.

### Fetching data from solana account
You often want to know the result of your RPC call or the updated balances/fields of the objects. You can fetch the latest state using the anchor the fetch function. Since everything in Solana is stored in accounts and accounts are just wallet addresses, you can fetch each object's data using the public key. 

```
const account = await program.account.sharedWallet.fetch(sharedWallet.publicKey);
```

You can further make your test suite robust by using these fetched values and comparing them with the desired state. E.g., in this case, you can write one test that assures that the treasury wallet balance is equal to the sum of user_1 contributions and user_2_contributions. 

### Challenge
Now it’s your turn to build something independently. Add another test in this test suite which can invoke `withdrawsBalance` function and add some tests which will fail due to constraints defined in the contract with proper error handling. 
If you are stuck and need some help, here is a solution [code](https://github.com/nipun1999/shared_wallet/blob/master/tests/shared_wallet.js)





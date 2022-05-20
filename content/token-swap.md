# Token Swap

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Create a token swap pool
- Deposit liquidity
- Withdraw liquidity
- Swap tokens

# TL;DR

- The **token swap program** is an SPL contract deployed to Mainnet and Devnet available for use by developers and protocols.
- The program accepts six different **instructions**, all of which we will explore in this lesson.
- Developers are able to create and use **liquidity pools** to swap between any SPL token that they wish.
- The program uses a mathematical formula called "**curve**" to calculate the price of all trades. Curves aim to mimic normal market dynamics: for example, as traders buy a lot of one token type, the value of the other token type goes up.

# Overview

## Swap Pools

Before we get into how to create and interact with swap pools on Solana, it’s important we understand the basics of what a swap pool even is. A swap pool is an aggregation of two different tokens, we’ll call them `TokenA` and `TokenB` for now, with the purpose of providing liquidity to facilitate exchanging A for B or B for A.

Users provide liquidity to these pools by depositing their own tokens into each pool. These users are called liquidity providers. Once a liquidity provider (or LP) deposits some tokens to the swap pool, the LP-tokens are minted that represent their fractional ownership in the pool. LP’s are incentivized to provide liquidity because most swap pools charge a transaction fee to facilitate the swap. These transactions fees are then paid out to the LP’s in proportion to the amount of liquidity they are providing in the pool. When an LP is ready to withdraw their deposited liquidity, their LP-tokens are burned and tokens from the pool (proportional to the amount of LP-tokens burned) are sent to their wallet.

The purpose of swap pools is to facilitate decentralized trade between users. The conventional way for users to execute trades like this is on a centralized exchange through a central limit [order book](https://www.investopedia.com/terms/o/order-book.asp). This is how you would buy a stock or future in traditional finance. Generally, this requires a trusted third-party intermediary, but due to the decentralized nature of cryptocurrency, we now have a new way to facilitate trade. [Project Serum](https://www.projectserum.com/) is an example of such a decentralized central limit order book built on Solana.

Swap pools are completely decentralized. Anybody can issue instructions to the swap program to create a new swap pool between any SPL tokens they wish. Swap pools and AMMs (Automated Market Makers) are an extremely fascinating and complex topic of DeFi, it is outside the scope of this lesson to get into the nitty-gritty details of these topics here, but there is a ton of material out there available to you if you’re interested. The Solana Token Swap program was heavily inspired by [Uniswap](https://uniswap.org/) and [Balancer](https://balancer.fi/) for example, and more information is available in their excellent documentation.

### Creating a Swap Pool

Creating swap pools with the SPL token swap program really showcases the account, instruction, and authorization models on Solana, this lesson will combine and build on top of a lot of what we have learned so far in the course.

There are many accounts required to create a pool and they all must be initialized in a specific way in order for the swap program to process them successfully. The following accounts are needed:

- an empty token swap state account
- swap pool authority account
- token A account
- token B account
- pool token mint
- pool token fee account
- pool token recipient account
- token program
- token swap program

The token swap state account must be a *`SystemProgram`* account that is initialized beforehand and owned by the token swap program, this account will hold information about the swap pool itself. The token swap program must be the owner of this account because it will need to mutate the data of this account.

The swap pool authority is a PDA derived from the token swap program, it will be used to sign for transactions for the swap program. The swap authority PDA will also be marked the `authority` of some of the accounts involved in the swap pool.

`TokenA` and `TokenB` accounts are the *token* accounts used for the actual swap pools. These accounts must contain some number of `TokenA`/`TokenB` respectively and the swap authority PDA must be marked as the `authority` over them so that the token swap program can sign for transactions and transfer tokens from the `TokenA` and `TokenB` accounts.

The pool token mint account is the mint of the LP-tokens that represent an LP’s ownership in the pool, the swap authority must be marked as the `MintAuthority`.

The pool token fee account is a *token* account that the fees for the token swaps are paid to, this account must be owned by a specific account defined in the swap program - that account has public key [HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN](https://explorer.solana.com/address/HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN?cluster=devnet).

The Pool token recipient account is the account the liquidity pool tokens representing an LP's deposited liquidity in the pool will be minted to.

Lastly, the token program id and the token swap program id are also needed.

Once you have all of these accounts created and initialized properly, you can issue an instruction targeting the token swap program and it will take care of the rest. Here’s an example of a script that creates a token swap:

```tsx
...
import * as Web3 from '@solana/web3.js'
import { TokenSwap, TOKEN_SWAP_PROGRAM_ID } from "@solana/spl-token-swap"

const FEE_OWNER = new Web3.PublicKey("HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN")

async function createTokenSwap(
) {

    const tx = new Web3.Transaction()

    // token swap state account
    console.log('creating swap state account')
    let tokenSwapStateAccount = Web3.Keypair.generate()
    console.log("Swap State account: ", tokenSwapStateAccount.publicKey.toBase58())

    const swapAcctIx = await Web3.SystemProgram.createAccount({
        newAccountPubkey: tokenSwapStateAccount.publicKey,
        fromPubkey: wallet.publicKey,
        lamports: await TokenSwap.getMinBalanceRentForExemptTokenSwap(connection),
        space: TokenSwapLayout.span,
        programId: TOKEN_SWAP_PROGRAM_ID
    })
    tx.add(swapAcctIx)

    // derive pda from Token swap program for swap authority
    const [swapAuthority, bump] = await Web3.PublicKey.findProgramAddress(
        [tokenSwapStateAccount.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID,
    )
    console.log("Swap authority PDA: ", swapAuthority.toBase58())

    // create Associated Token Accounts owned by the swap auth PDA that will be used as pool accounts and airdrop tokens
    const tokenAPoolATAIX = await createATA(kryptMint, swapAuthority, wallet.publicKey)
    tx.add(tokenAPoolATAIX)
    const tokenBPoolATAIX = await createATA(ScroogeCoinMint, swapAuthority, wallet.publicKey)
    tx.add(tokenBPoolATAIX)
    // airdrop tokens to these new ATA's
    const tokenAPoolATA = await getATA(kryptMint, swapAuthority)
    console.log("Krypt token account: ", tokenAPoolATA.toBase58())
    const tokenBPoolATA = await getATA(ScroogeCoinMint, swapAuthority)
    console.log("ScroogeCoing token account: ",tokenBPoolATA.toBase58())
    // airdropping tokens
    const airdropAIx = await airdropTokens(10000, wallet.publicKey, tokenAPoolATA, kryptMint, airdropPDA)
    tx.add(airdropAIx)
    const airdropBIx = await airdropTokens(10000, wallet.publicKey, tokenBPoolATA, ScroogeCoinMint, airdropPDA)
    tx.add(airdropBIx)

    // create pool token mint and pool token accounts
    console.log('creating pool mint')
    const poolTokenMint = await createMint(
        connection,
        wallet,
        swapAuthority,
        null,
        2
    )
    console.log("Pool mint: ", poolTokenMint.toBase58())

    console.log('creating pool account')
    const tokenAccountPool = Web3.Keypair.generate()
    tx.add(
        // create account
        Web3.SystemProgram.createAccount({
            fromPubkey: wallet.publicKey,
            newAccountPubkey: tokenAccountPool.publicKey,
            space: ACCOUNT_SIZE,
            lamports: await getMinimumBalanceForRentExemptAccount(connection),
            programId: TOKEN_PROGRAM_ID,
        }),
        // init token account
        createInitializeAccountInstruction(tokenAccountPool.publicKey, poolTokenMint, wallet.publicKey)
    )
    console.log("Token Account Pool: ", tokenAccountPool.publicKey.toBase58())

    // create fee account, this is where all swap fees will be paid
    // must be owned by the FEE_OWNER, requirement of token swap program
    const feeAccountATAIX = await createATA(poolTokenMint, FEE_OWNER, wallet.publicKey)
    tx.add(feeAccountATAIX)
    const feeAccountAta = await getATA(poolTokenMint, FEE_OWNER)
    console.log("Fee acount: ", feeAccountAta.toBase58())

    // Pool fees
    const poolConfig: PoolConfig = {
        curveType: CurveType.ConstantProduct,
        fees: {
            tradeFeeNumerator: 0,
            tradeFeeDenominator: 10000,
            ownerTradeFeeNumerator: 5,
            ownerTradeFeeDenominator: 10000,
            ownerWithdrawFeeNumerator: 0,
            ownerWithdrawFeeDenominator: 0,
            hostFeeNumerator: 20,
            hostFeeDenominator: 100
        }
    }

    const createSwapIx = await createInitSwapInstruction(
        tokenSwapStateAccount.publicKey,
        swapAuthority,
        tokenAPoolATA,
        tokenBPoolATA,
        poolTokenMint,
        feeAccountAta,
        tokenAccountPool.publicKey,
        TOKEN_PROGRAM_ID,
        TOKEN_SWAP_PROGRAM_ID,
        bump,
        poolConfig
    )

    tx.add(createSwapIx)

    console.log("sending tx");
    let txid = await Web3.sendAndConfirmTransaction(connection, tx, [wallet, tokenSwapStateAccount, tokenAccountPool], {
        skipPreflight: true,
        preflightCommitment: "confirmed",
    });

    console.log(`https://explorer.solana.com/tx/${txid}?cluster=devnet`);

}
...
```

If you copy this script, it will not work because it uses some helper functions and constants defined elsewhere. To get a look at the full program, take a look at [this repo](https://github.com/ixmorrow/token-swap-demo).

### Interacting with Swap Pools

The token swap program allows for a few different instructions for actually using a swap pool, among them are the swap instruction, deposit liquidity instruction, and withdraw liquidity.

Once a pool is created, users can immediately begin trading on it using the `swap` instruction. The swap instruction transfers funds from a user's source token account into the swap's source token account, and then transfers tokens from its destination token account into the user's destination token account.

Since Solana programs require all accounts to be declared in the instruction, users need to gather all account information from the pool state account: the token A and B accounts, pool token mint, and fee account.

To allow any trading, the pool needs liquidity provided from the outside. Using the `deposit_single_token_type_exact_amount_in` or `deposit_all_token_types`
 instructions, anyone can provide liquidity for others to trade, and in exchange, depositor’s receive a pool token is representing fractional ownership of all A and B tokens in the pool.

At any time, pool token holders may redeem their pool tokens in exchange for tokens A and B, returned at the current "fair" rate as determined by the curve. In the `withdraw_all_token_types` or `withdraw_single_token_type_exact_amount_out` instructions, pool tokens are burned, and tokens A and B are transferred into the user's accounts.

### Curves

Trading curves are at the core of how a swap pool/AMM operates, this is the function that the program uses to calculate how much of a destination token will be provided given an amount of source token. The curve essentially sets the market price of the tokens in the pool.

The pool we’ll be interacting with in this lesson employs a [Constant Product](https://spl.solana.com/token-swap#curves) Curve Function. The constant product curve is the well-known Uniswap and Balancer style curve that preserves an invariant on all swaps, expressed as the product of the quantity of token A and token B in the swap.

```tsx
A_total * B_total = invariant
```

If a trader wishes to put in token A for some amount of token B, the calculation for token B becomes:

```tsx
(A_total + A_in) * (B_total - B_out) = invariant
```

Hence the name ‘Constant Product’, the product of amount of token a and token b must always equal a constant. More information can be found on the [Uniswap whitepaper](https://uniswap.org/whitepaper.pdf) and the [Balancer whitepaper](https://balancer.fi/whitepaper.pdf).

# Demo

Demo code: [https://github.com/ixmorrow/token-swap-frontend](https://github.com/ixmorrow/token-swap-frontend)

For this demo, a token pool of two brand new tokens has been created and is live on devnet. We will be walking through building out a frontend UI to interact with this swap pool! Since the pool is already made, we will not have to worry about initiating the pool and funding it with tokens. We will focus on building out the instructions for depositing liquidity to the pool, withdrawing your deposited liquidity, and actually swapping from one token to the other.

We have also built an Airdrop program that lives at address [CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3](https://explorer.solana.com/address/CPEV4ibq2VUv7UnNpkzUGL82VRzotbv2dy8vGwRfh3H3?cluster=devnet) so that students can mint as many tokens as they’d like to their wallets to interact with the pool.

![Screenshot of Token Swap Demo](../assets/token-swap-frontend.png)

### 1. Download the starter code

Before we get started, go ahead and download the [starter code](https://github.com/ixmorrow/token-swap-frontend/tree/starter).

The project is a fairly simple Next.js application re-using a lot of what was previously built out for the demos in the first lesson. As you can see from the image above, there are a few different text inputs and `Buttons` - all of which will submit transactions to the blockchain on the users behalf. Our focus in this demo will be creating the instructions that the last three buttons will submit, the airdrop buttons are already implemented should work out of the box.

### 2. Create the Deposit Instruction

The token swap program has two variations of deposit instructions, one allows users to only deposit tokens to one side of the swap pool at a time and the other allows for depositing to both sides of the swap pool at the same time. We will be using the latter to create a single instruction to provide liquidity to both sides of the swap pool at once. Note, that in order to deposit liquidity to both sides of the swap pool, a user’s wallet must have a sufficient amount of each token beforehand. This will not be a problem for us because we can just airdrop ourselves as many tokens as we’d like, but something to keep in mind.

One caveat with the way the [token swap program implements this instruction](https://github.com/solana-labs/solana-program-library/blob/master/token-swap/program/src/processor.rs#L496) is that it expects the following as input data

- `pool_token_amount: u64`
- `maximum_token_a_amount: u64`
- `maximum_token_b_amount: u64`

Instead of providing the amount of tokens you would like to deposit, you’re expected to provide the program with the amount of LP-tokens you’d like to receive and it will calculate how many tokens that translates to with the pool’s given Curve and current liquidity. As long as the amount it derives is less than `maximum_token_a_amount` and `maximum_token_b_amount`, the program will transfer the derived amounts of the tokens and mint the user the amount of LP-tokens passed in the instruction. The `maximum_token_a_amount` and `maximum_token_b_amount` parameters are used to prevent slippage.

Remember, a transaction instruction is made up of 3 key components:

- array of AccountInfo’s of all accounts involved
- serialized data buffer
- program_id of the program the instruction is directed at

The deposit instruction should be added inside the `/components/Deposit.tsx` file inside the `handleTransactionSubmit` function because this is the function that is called when the `Deposit` button is clicked. We’ll start by deriving the user’s `Associated Token Account` address that we learned about in the previous lesson for each token that will be deposited in the swap pools and for the pool mint token account. We are using a helper `getAta` function defined in `/components/utils.ts` to derive these addresses with a given mint address and wallet public key.

```tsx
...
const handleTransactionSubmit = async (deposit: DepositAllSchema) => {
    if (!publicKey) {
        alert('Please connect your wallet!')
        return
    }
	// these are the accounts that hold the tokens
    const sourceA = await getATA(kryptMint, publicKey)
    const sourceB = await getATA(ScroogeCoinMint, publicKey)
	const token_account_pool = await getATA(pool_mint, publicKey)
...
```

Once we have the addresses of the accounts where the tokens are or will actually be stored, we will want to check if there is an `Associated Token Account` created for the pool token by using the `getAccountInfo` RPC method from the first module. This function will return an `AccountInfo` struct if it exits or `null` if not, if it is `null` we create an instruction to create the account and add it to our transaction. Then, we can serialize the user’s input in to a buffer with a `serialize` function that has already been implemented similarly to how we serialized our instruction data in previous demos. Then, we will construct our array of `AccountInfo’s`.

```tsx
...

const sourceA = await getATA(kryptMint, publicKey)
const sourceB = await getATA(ScroogeCoinMint, publicKey)
const token_account_pool = await getATA(pool_mint, publicKey)

const transaction = new Web3.Transaction()

let account = await connection.getAccountInfo(token_account_pool)

if (account == null) {
    const createATAIX = await createATA(pool_mint, token_account_pool, publicKey)
    transaction.add(createATAIX)
}

const buffer = deposit.serialize()

const depositIX = new Web3.TransactionInstruction({
    keys: [
        { pubkey: token_swap_state_account, isSigner: false, isWritable: false },
        { pubkey: swap_authority, isSigner: false, isWritable: false },
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: sourceA, isSigner: false, isWritable: true },
        { pubkey: sourceB, isSigner: false, isWritable: true },
        { pubkey: pool_krypt_account, isSigner: false, isWritable: true },
        { pubkey: pool_scrooge_account, isSigner: false, isWritable: true },
        { pubkey: pool_mint, isSigner: false, isWritable: true },
        { pubkey: token_account_pool, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: buffer,
    programId: TOKEN_SWAP_PROGRAM_ID,
    })

transaction.add(depositIX)

try {
    let txid = await sendTransaction(transaction, connection)
    alert(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
    console.log(`Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=devnet`)
} catch (e) {
    console.log(JSON.stringify(e))
    alert(JSON.stringify(e))
}

...
```

Notice that all the accounts, with the exception of the user’s `publickey` and their derived `Associated Token Account` , are constants that do not change for a given swap pool. Once we have our accounts added and the instruction created, we just have to add it to the transaction and send it.

As you can see, there is a lot of overlap between the first module’s demos, just different instruction data and a different number of accounts! At this point, you should be able to airdrop yourself some tokens and then deposit them into the swap pool!

### 3. Create the Withdrawal Instruction

The withdrawal instruction is very similar to the deposit instruction, but there are some subtle differences. Like deposits, the token swap program accepts two variations of withdrawals. You can either withdraw liquidity from a single side of the swap pool, or you can withdraw your deposited liquidity from both sides at the same time. We’ll be targeting the [instruction to withdraw from both sides of the swap pool at once](https://github.com/solana-labs/solana-program-library/blob/master/token-swap/program/src/processor.rs#L602).

This instruction will live in the `/components/Withdraw.tsx` file inside the `handleTransactionSubmit` function again.

```tsx
const transaction = new Web3.Transaction()

const userA = await getATA(kryptMint, publicKey)
const userB = await getATA(ScroogeCoinMint, publicKey)
const token_account_pool = await getATA(pool_mint, publicKey)

const buffer = withdraw.serialize()

const withdrawIX = new Web3.TransactionInstruction({
    keys: [
        {pubkey: token_swap_state_account, isSigner: false, isWritable: false},
        {pubkey: swap_authority, isSigner: false, isWritable: false},
        {pubkey: publicKey, isSigner: true, isWritable: false},
        {pubkey: pool_mint, isSigner: false, isWritable: true},
        {pubkey: token_account_pool, isSigner: false, isWritable: true},
        {pubkey: pool_krypt_account, isSigner: false, isWritable: true},
        {pubkey: pool_scrooge_account, isSigner: false, isWritable: true},
        {pubkey: userA, isSigner: false, isWritable: true},
        {pubkey: userB, isSigner: false, isWritable: true},
        {pubkey: fee_account, isSigner: false, isWritable: true},
        {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
    ],
    data: buffer,
    programId: TOKEN_SWAP_PROGRAM_ID,
})

transaction.add(withdrawIX)
```

Notice the ordering of accounts is different for the withdraw transaction and there is an additional `fee_account` provided this time. There is a fee that must be paid by the user for withdrawing liquidity from the pools, this fee is determined by the swap program based on the Curve and paid to the `fee_account`.

### 4. Create the Swap Instruction

Now, time to implement the actual purpose of this program - the [swap instruction](https://github.com/solana-labs/solana-program-library/blob/master/token-swap/program/src/processor.rs#L327)! Note that our UI has a dropdown to allow users to select which token they would like to swap *from*, so **we **will have to create our instruction differently based on what the user selects.

We’ll do this inside the same `handleTransactionSubmit` function in the `/components/Swap.tsx` file. Once again, we will have to derive the User’s `Associated Token Addresses` for each token mint, serialize our instruction data, and pass in the appropriate accounts.

```tsx
...
const userA = await getATA(kryptMint, publicKey)
const userB = await getATA(ScroogeCoinMint, publicKey)

const transaction = new Web3.Transaction()
const buffer = swap.serialize()
...
```

From here, the user’s input will determine our path of execution because swapping from Token A to Token B will require a different array of AccountInfo’s versus swapping from Token B to Token A will. We’ll make this delineation using the `value` property of the dropdown options, when a user makes a selection we check what the `value` of that selection is.

```tsx

...
// check which direction to swap
    if (mint == 'option1') {
        const withdrawIX = new Web3.TransactionInstruction({
            keys: [
                {pubkey: token_swap_state_account, isSigner: false, isWritable: false},
                {pubkey: swap_authority, isSigner: false, isWritable: false},
                {pubkey: publicKey, isSigner: true, isWritable: false},
                {pubkey: userA, isSigner: false, isWritable: true},
                {pubkey: pool_krypt_account, isSigner: false, isWritable: true},
                {pubkey: pool_scrooge_account, isSigner: false, isWritable: true},
                {pubkey: userB, isSigner: false, isWritable: true},
                {pubkey: pool_mint, isSigner: false, isWritable: true},
                {pubkey: fee_account, isSigner: false, isWritable: true},
                {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
            ],
            data: buffer,
            programId: TOKEN_SWAP_PROGRAM_ID,
        })
        transaction.add(withdrawIX)
    }
    else if (mint == 'option2') {
        const withdrawIX = new Web3.TransactionInstruction({
            keys: [
                {pubkey: token_swap_state_account, isSigner: false, isWritable: false},
                {pubkey: swap_authority, isSigner: false, isWritable: false},
                {pubkey: publicKey, isSigner: true, isWritable: false},
                {pubkey: userB, isSigner: false, isWritable: true},
                {pubkey: pool_scrooge_account, isSigner: false, isWritable: true},
                {pubkey: pool_krypt_account, isSigner: false, isWritable: true},
                {pubkey: userA, isSigner: false, isWritable: true},
                {pubkey: pool_mint, isSigner: false, isWritable: true},
                {pubkey: fee_account, isSigner: false, isWritable: true},
                {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
            ],
            data: buffer,
            programId: TOKEN_SWAP_PROGRAM_ID,
        })
        transaction.add(withdrawIX)
    }
...
```

And that’s it! Once you have the swap instruction implemented, the UI should be fully functional and you can airdrop yourself tokens, deposit liquidity, withdraw your liquidity, and swap from token to token!

Notice that the token accounts involved in each transaction were the `Associated Token Accounts` of the User’s wallet address, this was done on purpose because that’s the account the Airdrop program mint’s token to. The airdrop program is the only way anyone can receive these tokens, so we don’t have to worry about someone using a random token that does not follow the `Associated Token Account` principles.

Please take your time with this code and the concepts in this lesson, swap pools can get a lot more complicated than the one we have implemented today. Have a look at the [solution code here](https://github.com/ixmorrow/token-swap-frontend).

# Challenge

Now, combine what you’ve learned about tokens and swap pools to create a swap pool using the tokens that you minted in the previous lesson. To even take it a step further, once you have a swap pool, try to make some edits to this UI so that it targets your swap pool instead!

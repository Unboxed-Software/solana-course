# Token Swap

### List links for further reading here:

- [https://spl.solana.com/token-swap#overview](https://spl.solana.com/token-swap#overview)
- [https://github.com/solana-labs/solana-program-library/tree/master/token-swap](https://github.com/solana-labs/solana-program-library/tree/master/token-swap)

# Lesson Objectives

*By the end of this lesson, you will be able to:*
- Create a token swap pool
- Deposit liquidity
- Withdraw liquidity
- Swap tokens

# TL;DR

- The token swap program is an SPL contract deployed to Mainnet and Devnet available for use by developers and protocols.
- The program accepts six different instructions, all of which we will explore in this lesson.
- Developers are able to create and use liquidity pools to swap between any SPL token that they wish.
- The program uses a mathematical formula called "curve" to calculate the price of all trades. Curves aim to mimic normal market dynamics: for example, as traders buy a lot of one token type, the value of the other token type goes up.

# Overview

### Swap Pools

Before we get into how to create and interact with swap pools on Solana, it’s important we understand the basics of what a swap pool even is. A swap pool is an aggregation of two different tokens, we’ll call them `TokenA` and `TokenB` for now, with the purpose of providing liquidity to facilitate swapping from A to B and vice versa.

Users provide liquidity to these pools by depositing their own tokens into each pool, these users are called liquidity providers. Once a liquidity provider (or LP) deposits some tokens to the swap pool, they are minted LP-tokens which represent their fractional ownership in the pool. LP’s are incentivized to provide liquidity because most swap pools charge a transaction fee to facilitate the swap, these transactions fees are then paid out to the LP’s in proportion to the amount of liquidity they are providing in the pool. When an LP is ready to withdraw their deposited liquidity, their LP tokens are burned and their deposited tokens are sent from their respective swap pools back to the LP’s wallet.

The purpose of swap pools is to create a decentralized way to facilitate trade between users. The conventional way for users to execute trades like this is through a central limit order book on a centralized exchange, this is how you would buy a stock and/or future in traditional finance. This generally requires a trusted third-party intermediary, thus a new way to trade has been created due to the decentralized nature of crypto. [Project Serum](https://www.projectserum.com/) is actually a decentralized central limit order book built on Solana.

Swap pools are completely decentralized and anybody can issue instructions to the swap program to create a new swap pool between any SPL tokens they wish. Swap pools and AMMs (Automated Market Makers) are an extremely fascinating and complex topic of DeFi, it would be well outside the scope of this lesson to get into the nitty-gritty details of these topics here, but there is tons of material out there available to you if you’re interested. The Solana Token Swap program was heavily inspired by [Uniswap](https://uniswap.org/) and [Balancer](https://balancer.fi/) for example, more information is available in their excellent documentation.

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

The token swap state account must be a *`SystemProgram`* account that is initialized beforehand and owned by the token swap program, this account will hold information about the swap pool itself. The swap program must be the owner of this account because it will need to mutate the data of this account. The swap pool authority is a PDA derived from the token swap program, it will be used to sign for transactions for the swap program. The swap authority PDA will also be marked the `authority` of some of the accounts involved in the swap pool. `TokenA` and `TokenB` accounts are the *token* accounts used for the actual swap pools. These accounts must contain some number of `TokenA`/`TokenB` respectively and the swap authority must be marked as the `authority` over them so that the token swap program can sign for transactions and transfer tokens from the `TokenA` and `TokenB` accounts. The pool token mint account is the mint of the LP-tokens that represent an LP’s ownership in the pool, the swap authority must be marked as the `MintAuthority`. The pool token fee account is a *token* account that the fees for the token swaps are paid to, this account must be owned by a specific account defined in the swap program - that account has public key [HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN](https://explorer.solana.com/address/HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN?cluster=devnet). Lastly, the token program id and the token swap program id are also needed.

Once you have all of these accounts created and initialized properly, you can issue an instruction targeting the token swap program and it will take care of the rest. Here’s an example of how you would create and initialize some of the accounts necessary:

```tsx
...
import * as Web3 from '@solana/web3.js'
import { TokenSwap, TOKEN_SWAP_PROGRAM_ID } from "@solana/spl-token-swap"

const tx = new Web3.Transaction()

// token swap state accoount
let tokenSwapStateAccount = Web3.Keypair.generate()
console.log("Swap State account: ", tokenSwapStateAccount.publicKey.toBase58())
// ix to create system account at this pubkey
const swapAcctIx = await Web3.SystemProgram.createAccount({
	newAccountPubkey: tokenSwapStateAccount.publicKey, // new account pubkey
	fromPubkey: wallet.publicKey, // payer
	lamports: await TokenSwap.getMinBalanceRentForExemptTokenSwap(connection),
	space: TokenSwapLayout.span,
// Public key of the program to assign as the owner of the created account
// notice the token swap program is used here
	programId: TOKEN_SWAP_PROGRAM_ID
})
tx.add(swapAcctIx)

// derive pda from Token swap program for swap authority
// we use the swap state account as a seed, but can use whatever you want
const [swapAuthority, bump] = await Web3.PublicKey.findProgramAddress(
	[tokenSwapStateAccount.publicKey.toBuffer()],
	TOKEN_SWAP_PROGRAM_ID,
)
console.log("Swap authority PDA: ", swapAuthority.toBase58())

...
```

This is just a code snippet of how 2 of the accounts involved would be created and initialized, we will go over the rest in depth in the demo section.

### Interacting with Swap Pools

The token swap program allows for a few different instructions for actually using a swap pool, among them are the swap instruction, deposit liquidity instruction, and withdraw liquidity.

Once a pool is created, users can immediately begin trading on it using the `swap` instruction. The swap instruction transfers tokens from a user's source account into the swap's source token account, and then transfers tokens from its destination token account into the user's destination token account.

Since Solana programs require all accounts to be declared in the instruction, users need to gather all account information from the pool state account: the token A and B accounts, pool token mint, and fee account.

To allow any trading, the pool needs liquidity provided from the outside. Using the `deposit_all_token_types`
 or `deposit_single_token_type_exact_amount_in`
 instructions, anyone can provide liquidity for others to trade, and in exchange, depositors receive a pool token representing fractional ownership of all A and B tokens in the pool.

At any time, pool token holders may redeem their pool tokens in exchange for tokens A and B, returned at the current "fair" rate as determined by the curve. In the `withdraw_all_token_types`
 and `withdraw_single_token_type_exact_amount_out`
 instructions, pool tokens are burned, and tokens A and B are transferred into the user's accounts.

### Curves

Trading curves are at the core of how a swap pool/AMM operates, this is the function that the program uses to calculate how much of a destination token will be provided given an amount of source token. The curve essentially sets the market price of the tokens in the pool.

# Demo

*The demo portion of the lesson is meant to be tutorial-style where the reader is coding along with it. The project here should take the content from the overview and apply it so it has context and isn't just standalone code snippets.*

# Challenge

S*hort, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently*
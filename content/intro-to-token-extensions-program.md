---
title: Intro to Token Extensions Program
objectives:
 - Learn about Token Extensions Program
 - Learn about extensions
---

# Summary
 - The existing Token Program on Solana provides interfaces for fungible and non-fungible tokens but has led to forks for added functionality, posing adoption challenges across the ecosystem.
 - Solana's model requires programs and accounts in transactions, complicating multi-token program transactions and requiring trust in supported token programs by wallets and on-chain programs.
 - To introduce new token features without disrupting current users, wallets, and decentralized applications (dApps), and to ensure the safety of existing tokens, a new token program, Token-2022 (also called as Token Extensions Program), has been developed.
 - Token-2022 was deployed to a separate address from the original Token Program to address these issues, aiming for easier adoption and enhanced functionality while maintaining system integrity.

# Overview
The Token 2022 Program, also known as Token Extensions Program, is a superset of the functionality provided by the Token Program. The Token Program serves most needs for fungible and non-fungible tokens through a simple set of interfaces and structures. But, as more developers come to Solana with new ideas, there are a few challenges:
 - Developers with new ideas have forked the Token Program to add new functionality according to their needs and deployed the program on-chain. Although it's easy to modify and deploy the program on-chain, it's difficult to achieve it's adoption across the ecosystem.
 - Solana's programming model requires programs to be included in the transactions along with accounts. This makes it complicated to create transactions involving multiple token programs. 
 - In addition to the technical difficulty, wallets and other on-chain programs must trust the token programs that they choose to support.

The Token Extension Program was developed to address these challenges. It aimed minimal disruptions to the existing ecosystem, wallets and dApps and most importantly, preserving the safety of existing tokens.

The Token Extensions Program, as it is a superset of the Token Program, is deployed to a separate address. Even if the interfaces of these two programs are same, the addresses of these programs are **not interchangeable** in any case. As a result, if we want to add support for Token Extensions program, our client app will need some extra logic to differentiate between the tokens owned by these two programs.

## Extensions
Adding new functionality requires new fields in mints and accounts. This makes it impossible to have the same layout for all accounts in the Token Extensions Program. So, the new functionality is added in the form of extensions. Extensions are simply new functionality added on top of the existing Token Program.

Account extensions currently include:
 - **Memo required on incoming transfers**
	<p>This extension makes it mandatory to have a memo on on all transfers, just like traditional banking systems.</p>

 - **Immutable ownership**
	<p>Token account owners can transfer ownership to any other address which is useful in many scenarios but can lead to security vulnerabilities. To avoid this issue, we can use this extension which makes it impossible to reassign ownership.</p>

 - **Default account state**
	<p>Mint creators can use this extension which forces all new token accounts to be frozen. This way, users must eventually interact with some service to unfreeze their accounts and use tokens.</p>

 - **CPI guard**
	<p>This extension protects users from signing for actions that they can't see, hidden programs that aren't the System or Token programs by prohibiting certain actions inside cross-program invocations.</p>

Mint extensions include:
 - **Confidential transfers**
	<p></p>

 - **Transfer fees**
	<p>The Token Extension Program enforces transfer fees on the protocol level. With each transfer, some amount is withheld on the recipient account, untouchable by the recipient.</p>

 - **Closing mint**
	<p>In Token Program it was possible to close only token accounts but with the close authority extension, we can now close mint accounts.</p>

 - **Interest-bearing tokens**
	<p>Tokens which have constantly growing and decreasing value, reflecting the updated value in clients required proxies that require regular rebase or update operations. With this extension, we can change how the UI amount of tokens are represented. We can set an interest rate on your token and fetch its amount with interest at any time.</p>

 - **Non-transferable tokens**
	<p>This extension allows us to create "soul-bound" tokens that cannot be transferred to any other entity.</p>

 - **Permanent delegate**
	<p>This extension allows us to specify a permanent delegate for a mint. This authority has unlimited delegate privileges over an account, meaning that it can burn or transfer any amount of tokens.</p>

 - **Transfer hook**
	<p>This extension allows token creators to have more control over how their tokens are transferred. The creators must develop and deploy a program that implements the interface and then configure their token mint to use their program.</p>

 - **Metadata pointer**
	<p>A mint can have multiple different account claiming to describe the mint. This extension allows the token creator to designate an address that describes the canonical metadata.</p>

 - **Metadata**
	<p>This extension allows a mint creator to include their token's metadata directly into the mint account. </p>

These extensions can be mixed and matched, meaning we can create a token with only transfer fees, only interest-bearing tokens, both or neither.

We will dig deeper into each extension in separate lessons.

***Note:*** Extensions are only supported by the Token Extensions Program. We cannot use these extensions with the tokens owned by the Token Program.

# Things to consider when working with both Token Program and Token Extension Program
Although the interfaces for both of these programs remain consistent, they are two different programs. The program IDs of these programs are not interchangeable, and the addresses created by using them are different. If you want to support both Token Program tokens and Token Extension Program tokens, you must add extra logic on the client side.

We will be using the `spl-token` package throughout this course. This package provides the constants `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`. As the interfaces of both the programs are the same, the only thing we need to do is use the correct program ID in our program.

# Lab
Now, we will try some of these extensions using the `spl-token-cli` CLI.

### 1. Getting Started
Before we can use the extensions, we need to install the `spl-token-cli`. Follow the instructions in [this guide](https://spl.solana.com/token#setup). After the installation, verify it by running the following command.

```bash
spl-token --version
```

Make sure you follow every step in the guide as it also describes how to initialize a local wallet and airdrop devnet SOL.

### 2. Creating a mint with close authority
Now we will create a mint with close authority extension using the CLI. Run the following command.

```bash
spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --enable-close
```

We will see output similar to as shown below.

```bash
Creating token 3s6mQcPHXqwryufMDwknSmkDjtxwVujfovd5gPQLvKw9 under program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb

Address:  3s6mQcPHXqwryufMDwknSmkDjtxwVujfovd5gPQLvKw9
Decimals:  9

Signature: fGQQ1eAGsnKN11FUcFhGuacpuMTGYwYEfaAVBUys4gvH4pESttRgjVKzTLSfqjeQ5rNXP92qEyBMaFFNTVPMVAD
```

Let's break it down:
 - `create-token` : The instruction that we want to execute.
 - `--program-id` : This flag is used to specified which program ID to use. `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` is the public address at which the Token Extension Program is deployed. 
 - `--enable-close` : This flag specifies that we want to initialize the mint with close authority.

### 3. Creating a token account with immutable owner
Let's try another extension. Using the mint we created in the last step, we will create a associated token account using the immutable owner extension.

Run the following command to create the ATA with immutable owner extension.

```bash
spl-token create-account --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --owner <WALLET_ADDRESS> --fee-payer <PATH_TO_WALLET_KEYPAIR>
```

After running this command, we will see out similar to as shown below.

```bash
Creating account F8iDrVskLGwYo53SdJnvBKTpN1C7hobgnPQMq6hLivUn

Signature: 5zX73E2aFVwcsvhCgBSF6AxWqydWYk3KJaTmeS4AY22FwCvgEvnodvJ7fzvBHZptqv3FMz6tbLFR5LbmiUHLUkne
```

Let's break it down:
 - `create-account` : The instruction that we want to execute.
 - `--program-id` : The program ID we want to use.
 - `--owner` : Public key of the owner's wallet. We can get the wallet address by running the command `solana address`.
 - `--fee-payer` : Keypair of the wallet paying for the transaction. We can find the path of the keypair by running the command `solana config get`.

That's it! This is how we can use the Solana CLI with Token Extension Program to use the extensions. We will dive deeper into these extensions in separate lessons and see how we can use them programmatically.
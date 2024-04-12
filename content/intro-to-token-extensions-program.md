---
title: Intro to Token Extensions Program
objectives:
 - Learn about Token Extensions Program
 - Learn about extensions
---

# Summary
 - The existing Token Program on Solana provides interfaces for fungible and non-fungible tokens but has led to forks for added functionality, posing adoption challenges across the ecosystem.
 - To introduce new token features without disrupting current users, wallets, and decentralized applications (dApps), and to ensure the safety of existing tokens, a new token program, Token Extensions Program (also called as Token-2022), has been developed.
 - Token Extensions Program is a seperate program with a seperate address from the orginal Token Program. It supports the exact same functions plus additional ones through extensions.

# Overview

The Token Extensions Program, also known internally as Token 2022, is a superset of the functionality provided by the original Token Program. The Token Program serves most needs for fungible and non-fungible tokens through a simple set of interfaces and structures. Though simple and performant, the Token Program lacked features that the developer community soon found need of. This nessecitated forks of the Token Program, potentially splitting the ecosystem.

For example, say a university wants to grant a soul-bound NFT version of a deploma to a graduate's wallet. How can we be sure that deploma never got transferred away? In the current Token Program, this is not possilbe 

 - ...
 - ...
 - ...

This introduced some challenges.

 - Developers with new ideas have forked the Token Program to add new functionality according to their needs and deployed the program on-chain. Though it's easy to modify and deploy the program on-chain, it's difficult to achieve it's adoption across the ecosystem.
 - Solana's programming model requires programs to be included in the transactions along with accounts. This makes it complicated to create transactions involving multiple token programs.
 - In addition to the technical difficulty, wallets and other on-chain programs must trust the token programs that they choose to support.

The Token Extension Program was developed to address the aforementioned challenges. It is aimed towards adding minimal disruptions to the existing ecosystem, wallets and dApps and most importantly, preserving the safety of existing tokens.

The Token Extensions Program, as it is a superset of the Token Program, is deployed to a separate address. Even if the interfaces of these two programs are same, the addresses of these programs are **not interchangeable** in any case. As a result, if we want to add support for Token Extensions program, our client application will need some extra logic to differentiate between the tokens owned by these two programs.

## Extensions

Adding new functionality requires new fields in mints and accounts. This makes it impossible to have the same layout for all accounts in the Token Extensions Program so the new functionality is added in the form of extensions. Extensions are simply new functionality added on top of the existing Token Program.

Account extensions currently include:
 - **Memo required on incoming transfers**
	This extension makes it mandatory to have a memo on on all transfers, just like traditional banking systems.

 - **Immutable ownership**
	Token account owners can transfer ownership to any other address which is useful in many scenarios but can lead to security vulnerabilities. To avoid this issue, we can use this extension which makes it impossible to reassign ownership.

 - **Default account state**
	Mint creators can use this extension which forces all new token accounts to be frozen. This way, users must eventually interact with some type of service to unfreeze their accounts and use the tokens.

 - **CPI guard**
	This extension safeguards users against authorizing actions that are not visible to them, specifically targeting concealed programs that are neither the System nor Token programs. It does this by restricting certain activities within cross-program invocations.

Mint extensions include:
 - **Confidential transfers**
	This extension enhances privacy of the transactions without revealing key details of the transaction such as the amount.

 - **Transfer fees**
	The Token Extension Program implements transfer fees at the protocol level, deducting a certain amount from each transfer to the recipient's account. This withheld amount is inaccessible to the recipient.

 - **Closing mint**
	Under the Token Program, only token accounts could be closed. However, the introduction of the close authority extension now allows for the closure of mint accounts as well.

 - **Interest-bearing tokens**
	Tokens which have constantly growing and decreasing value, reflecting the updated value in clients required proxies that require regular rebase or update operations. With this extension, we can change how the UI amount of tokens are represented by setting an interest rate on the token and fetching it's amount with interest at any time.

 - **Non-transferable tokens**
	This extension enables the creation of tokens that are "bound" to their owner, meaning they cannot be transferred to others.

 - **Permanent delegate**
	This extension allows us to specify a permanent delegate for a mint. This authority has unlimited delegate privileges over an account. This means that it can burn or transfer any amount of tokens, but also assign another account with these privileges.

 - **Transfer hook**
	This extension allows token creators to have more control over how their tokens are transferred. The creators must develop and deploy a program that implements the interface and then configure their token mint to use their program.

 - **Metadata pointer**
	A mint can have multiple different account claiming to describe the mint. This extension allows the token creator to designate an address that describes the canonical metadata.

 - **Metadata**
	This extension allows a mint creator to include their token's metadata directly into the mint account.

These extensions can be mixed and matched, meaning we can create a token with only transfer fees, only interest-bearing tokens, both or neither.

We will dig deeper into each extension in separate lessons.

***Note:*** Extensions are only supported by the Token Extensions Program. We cannot use these extensions with the tokens owned by the Token Program.

# Things to consider when working with both Token Program and Token Extension Program
Although the interfaces for both of these programs remain consistent, they are two different programs. The program IDs of these programs are not interchangeable, and the addresses created by using them are different. If you want to support both Token Program tokens and Token Extension Program tokens, you must add extra logic on the client side.

We will be using the `spl-token` library throughout this course. This library provides the constants `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID`. As the interfaces of both the programs are the same, the only thing we need to do is use the relevant program ID in our program.

# Lab
Now, we will test out some of these extensions using the `spl-token-cli` CLI.

### 1. Getting Started
Before we can use the extensions, we need to install the `spl-token-cli`. Follow the instructions in [this guide](https://spl.solana.com/token#setup). After the installation, verify it by running the following command:

```bash
spl-token --version
```

Make sure you follow each step in the guide as it also describes how to initialize a local wallet and airdrop devnet SOL.

### 2. Creating a mint with close authority
Now we will create a mint with close authority extension using the CLI. The ownership of the account, which is created as a result of this command, cannot be reassigned to any other entity.

This extension requires following arguments:
 - `create-token` : The instruction that we want to execute.
 - `--program-id` : This flag is used to specified which program ID to use. `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` is the public address at which the Token Extension Program is deployed.
 - `--enable-close` : This flag specifies that we want to initialize the mint with close authority.

Run the following command:

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

After we close the mint account, we can reclaim the lamports on the mint account. Remember, the supply on the mint must be zero.

### 3. Creating a token account with immutable owner
Let's test out another extension. Using the mint we created in the last step, we will create an associated token account using the immutable owner extension. This extension requires following arguments:
 - `create-account` : The instruction that we want to execute.
 - `--program-id` : The program ID we want to use.
 - `--owner` : Public key of the owner's wallet. We can get the wallet address by running the command `solana address`.
 - `--fee-payer` : Keypair of the wallet paying for the transaction. We can find the path of the keypair by running the command `solana config get`.

Run the following command to create the associated token account with the immutable owner extension:

```bash
spl-token create-account --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --owner <WALLET_ADDRESS> --fee-payer <PATH_TO_WALLET_KEYPAIR>
```

After running this command, we will see out similar to as shown below.

```bash
Creating account F8iDrVskLGwYo53SdJnvBKTpN1C7hobgnPQMq6hLivUn

Signature: 5zX73E2aFVwcsvhCgBSF6AxWqydWYk3KJaTmeS4AY22FwCvgEvnodvJ7fzvBHZptqv3FMz6tbLFR5LbmiUHLUkne
```

### 4. Creating a "soul-bound" NFT
In this step, we are going to create an NFT which will be non-transferable. Think of it as a achievement token which is exclusively owned by one person or account. For creating this token, we will use two extensions: metadata and non-transferable token.

With the metadata extension, we can include metadata directly in the mint account and the non-transferable extension makes the token exclusive to the account.

The command takes following arguments:
 - `create-token` : The instruction that we want to execute.
 - `--program-id` : The program ID we want to use.
 - `--enable-metadata` : The metadata extension flag.
 - `--enable-non-transferable` : The non-transferable extension flag.

Run the following command to create a token initialized with the metadata extension.

```bash
spl-token create-token --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --enable-metadata --enable-non-transferable
```

We will see output similar to as shown below.

```bash
Creating token GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr under program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
To initialize metadata inside the mint, please run `spl-token initialize-metadata GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr <YOUR_TOKEN_NAME> <YOUR_TOKEN_SYMBOL> <YOUR_TOKEN_URI>`, and sign with the mint authority.

Address:  GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr
Decimals:  9

Signature: 5EQ95NPTXg5reg9Ybcw9LQRjiWFZvfb9WqJidxu6kKbcKGajp1U999ioToC1qC88KUS4kdUi6rZbibqjgJbzYses
```

After creating the mint with metadata extension, we need to initialize the metadata as specified in the output above. Initializing metadata takes the following arguments:
 - Mint address : Address of the mint to initialize the metadata for.
 - `<YOUR_TOKEN_NAME>` : Name of the token
 - `<YOUR_TOKEN_SYMBOL>` : Symbol by which the token will be identified.
 - `<YOUR_TOKEN_URI>` : URI for the token.
 - Update authority : The address of the account with the authority to update the metadata.

Run the following command to initialize the metadata:

```bash
spl-token initialize-metadata GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr MyToken TOK http://my.tokn --update-authority GXorY2xeaD1ee7NbDiSXFCMQ1jruyiopqAP6fZL44dvK
```

Next, let's update the metadata for that mint. We will be updating the name of our token. Run the following command:

```bash
spl-token update-metadata name MyAwesomeNFT
```

Now let's see how we can add a custom field to our mint's metadata. This command takes the following arguments:

 - Mint address : Address of the mint to update metadata for.
 - Custom field name : Name of the new custom field.
 - Custom field value : Value of the new custom field.

Run the following command:

```bash
spl-token update-metadata GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr new-field new-value
```

We can also remove the custom fields from the mint metadata. Run the following command:

```bash
spl-token update-metadata GVjznwtfPndL9RsBtAYDFT1H8vhQjx8ymAB1rbd17qPr new-field --remove
```

The `initialize-metadata` and `update-metadata` commands output the signature of the transaction.

We have successfully created a "soul-bound" NFT which is exclusively owned by the account.


That's it! This is how we can use the Solana CLI with Token Extension Program to use the extensions. We will dive deeper into these extensions in separate lessons and see how we can use them programmatically.
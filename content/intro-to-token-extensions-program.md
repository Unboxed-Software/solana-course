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
 - memo required on incoming transfers
 - immutable ownership
 - default account state
 - CPI guard

Mint extensions include:
 - confidential transfers
 - transfer fees
 - closing mint
 - interest-bearing tokens
 - non-transferable tokens
 - permanent delegate
 - transfer hook
 - metadata pointer
 - metadata


These extensions can be mixed and matched, meaning we can create a token with only transfer fees, only interest-bearing tokens, both or neither.

We will dig deeper into each extension in separate lessons.

***Note:*** Extensions are only supported by the Token Extensions Program. We cannot use these extensions with the tokens owned by the Token Program.


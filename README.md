# Solana Development Course

## About

This course is designed to be the absolute best starting point for Web Developers looking to learn Web3 Development. Solana is the ideal network for starting your Web3 journey because of its high speed, low cost, energy efficiency, and more.

This repository represents an ongoing project. We'll update the list of available lessons in the [Get Started](#get-started) section below as they're completed. If you'd like to help out, have a look [how you can contribute](#contribute-to-the-course).

At the time of writing, the first five modules represent what we consider the core of Solana development. Modules 1-2 primarily focus on client-side Solana development and Modules 3-4 focus on developing native programs on the Solana network. Module 5 takes everything you learn in Modules 1-4 and shows you how to do it using the Anchor framework. Subsequent modules represent more advanced and/or niche content, so you can pick and choose lessons a bit more at that point. However, we strongly recommend you make sure you understand the security exploits described in Module 7.

## Get Started

While you can absolutely just jump into the lessons below, we suggest you start by reading our [Course Guide](./content/getting-started.md) first for a primer on how lessons are organized and how you can get the most out of them.

### Module 1 - Client interaction with the Solana network
   1. [Read data from the network](./content/intro-to-reading-data.md)
   2. [Write data to the network](./content/intro-to-writing-data.md)
   3. [Interact with wallets](./content/interact-with-wallets.md)
   4. [Serialize custom instruction data](./content/serialize-instruction-data.md)
   5. [Deserialize custom account data](./content/deserialize-custom-data.md)
   6. [Page, Order, and Filter custom account data](./content/paging-ordering-filtering-data.md)

### Module 2 - Client interaction with common Solana programs
   1. [Create tokens with the Token Program](./content/token-program.md)
   2. [Swap tokens with the Token Swap Program](./content/token-swap.md)
   3. [Create Solana NFTs With Metaplex](./content/nfts-with-metaplex.md)

### Module 3 - Basic Solana program development
   1. [Hello World](./content/hello-world-program.md)
   2. [Create a Basic Program, Part 1 - Handle Instruction Data](./content/deserialize-instruction-data.md)
   3. [Create a Basic Program, Part 2 - State Management](./content/program-state-management.md)
   4. [Create a Basic Program, Part 3 - Basic Security and Validation](./content/program-security.md)

### Module 4 - Intermediate Solana program development
   1. [Local Program Development](./content/local-setup.md)
   2. [Program Derived Addresses](./content/pda.md)
   3. [Cross Program Invocations](./content/cpi.md)
   4. Program Testing - Coming Soon

### Module 5 - Anchor program development
   1. [Intro to Anchor development](./content/intro-to-anchor.md)
   2. [Intro to client-side Anchor development](./content/intro-to-anchor-frontend.md)
   3. [Anchor PDAs and accounts](./content/anchor-pdas.md)
   4. [Anchor CPIs and errors](./content/anchor-cpi.md)

### Module 6 - Beyond the Basics
   1. [Environment variables in Solana programs](./content/env-variables.md)
   2. [Solana Pay](./content/solana-pay.md)
   3. [Versioned transactions and lookup tables](./content/versioned-transaction.md)
   4. [Rust procedural macros](./content/rust-macros.md)

### Module 7 - Solana Program Security
   1. [How to approach the Program Security module](./content/security-intro.md)
   2. [Signer authorization](./content/signer-auth.md)
   3. [Owner checks](./content/owner-checks.md)
   4. [Account data matching](./content/account-data-matching.md)
   5. [Reinitialization attacks](./content/reinitialization-attacks.md)
   6. [Duplicate mutable accounts](./content/duplicate-mutable-accounts.md)
   7. [Type cosplay](./content/type-cosplay.md)
   8. [Arbitrary CPIs](./content/arbitrary-cpi.md)
   9. [Bump seed canonicalization](./content/bump-seed-canonicalization.md)
   10. [Closing accounts and revival attacks](./content/closing-accounts.md)
   11. [PDA sharing](./content/pda-sharing.md)

## Contribute to the Course

We plan for this course to be perpetually open-source and we'd love for anyone and everyone to contribute!

### Adding content

If you'd like to add content, please start by [creating an issue](https://github.com/Unboxed-Software/solana-course/issues/new) and tagging @jamesrp13 to discuss your reasoning, plan, and timeline.

Once a plan has been discussed and agreed to, you can start working on content. When you're done, create a PR to the `draft` branch.

### Editing Existing Content

If you want to fix a typo or otherwise improve on existing content, follow a similar process as with adding content:

1. [Create an issue](https://github.com/Unboxed-Software/solana-course/issues/new) and/or comment on an existing issue to state you've started working
2. Create a PR to the `draft` branch during or when complete

### Committing

We are using [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) for this repository.

General flow for making a contribution:

1. Fork the repo on GitHub
2. Clone the project to your own machine
3. Commit changes to your own branch
4. Push your work back up to your fork
5. Submit a Pull request so that we can review your changes

**NOTE**: Be sure to merge the latest from `upstream/draft` before making a pull request!

### Localization

In order for the course structure to be maintained, localized files need to adhere to the following rules:

1. Localized lesson files should be in a subdirectory of `content` named after the language abbreviation. For example, lessons translated into Spanish should be housed in `content/es`.
2. Localized asset files should be in a subdirectory of `assets` named after the language abbreviation. For example, assets localized into Spanish should be housed in `assets/es`.
3. File names for localized files must be identical to their English counterpart. To be clear, *do not translate file names*. The file name is used as the slug for the article and must be identical between languages.

### Providing general feedback

If you have feedback on content or suggestions for additional content, simply [create an issue](https://github.com/Unboxed-Software/solana-course/issues/new) explaining your feedback/suggestions.

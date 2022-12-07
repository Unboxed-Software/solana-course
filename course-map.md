# Module 1 - Client interaction with the Solana Network
1. Read data from the network
   - Explain accounts
   - Explain SOL and lamports
   - Explain public keys
   - Explain the JSON RPC API
   - Explain web3.js
   - Install web3.js
   - Use web3.js to create a connection to a Solana node
   - Use web3.js to read data from the blockchain (balance, account info, etc.)
2. Write data to the network
   - Explain keypair
   - Use `@solana/web3.js` to generate a keypair
   - Use `@solana/web3.js` to create a keypair using a secret key
   - Explain transactions
   - Explain transaction fees
   - Use `@solana/web3.js` to send sol
   - Use `@solana/web3.js` to sign transactions
   - Use Solana explorer to view transactions
3. Interact with wallets
   - Explain Wallets
   - Install Phantom extension
   - Set Phantom wallet to devnet
   - Use wallet-adapter to have users sign transactions
4. Serialize custom instruction data
   - Explain the contents of a transaction
   - Explain transaction instructions
   - Explain the basics of Solana's runtime optimizations
   - Explain Borsh
   - Use Borsh to serialize custom instruction data
5. Deserialize custom account data
   - Explain Program Derived Accounts
   - Derive PDAs given specific seeds
   - Fetch a program’s accounts
   - Use Borsh to deserialize custom data
6. Page, Filter, and Order account data
   - Prefetch accounts without data
   - Determine where in an account’s buffer layout specific data is stored
   - Prefetch accounts with a subset of data that can be used to order accounts
   - Fetch only accounts whose data matches specific criteria
   - Fetch a subset of total accounts using `getMultipleAccounts`
   - Combine to page, filter, and order data

# Module 2 - Client interaction with common Solana programs
1. Token Program
   - Explain the Solana Token Program
   - Create a new token using `spl-token`
   - Explain associated token accounts
   - Create a token account using `spl-token`
   - Explain rent in the Solana Accounts model
   - Mint a token using `spl-token`
2. Token Swap Program
   - Create a token swap pool
   - Deposit liquidity
   - Withdraw liquidity
   - Swap tokens
3. NFTs with Metaplex
   - Explain NFTs and how they're supported by the Solana network
   - Understand the role of Metaplex in the Solana NFT ecosystem
   - Use Candy Machine v2 to create and distribute an NFT collection
   - Use Candy Machine UI to mint NFTs from a candy machine

# Module 3 - Basic Solana Program Development
1. Hello World
   - Use the Rust module system
   - Define a function in Rust
   - Explain the `Result` type
   - Explain the entry point to a Solana program
   - Build and deploy a basic Solana program
   - Submit a transaction to invoke our “Hello, world!” program
2. Create a Basic Program, Part 1 - Handle Instruction Data
   - Assign mutable and immutable variables in Rust
   - Create and use Rust structs and enums
   - Use Rust match statements
   - Add implementations to Rust types
   - Deserialize instruction data into Rust data types
   - Execute different program logic for different types of instructions
   - Explain the structure of a smart contract on Solana
3. Create a Basic Program, Part 2 - State Management
   - Describe the process of creating a new account using a Program Derived Address (PDA)
   - Use seeds to derive a PDA
   - Use the space required by an account to calculate the amount of rent (in lamports) a user must allocate
   - Use a Cross Program Invocation (CPI) to initialize an account with a PDA as the address of the new  account
   - Explain how to update the data stored on a new account
4. Create a Basic Program, Part 3 - Basic Security and Validation
   - Explain the importance of "thinking like an attacker"
   - Understand basic security practices
   - Perform owner checks
   - Perform signer checks
   - Validate accounts passed into the program
   - Perform basic data validation

# Module 4 - Intermediate Solana Program Development
1. Set up a local dev environment
   - Set up a local environment for Solana program development
   - Use basic Solana CLI commands
   - Run a local test validator
   - Use Rust and the Solana CLI to deploy a Solana program from your local development environment
   - Use the Solana CLI to view program logs
2. PDAs
   - Explain Program Derived Addresses (PDAs)
   - Explain various use cases of PDAs
   - Describe how PDAs are derived
   - Use PDA derivations to locate and retrieve data
3. CPIs
   - Explain Cross-Program Invocations (CPIs)
   - Describe how to construct and use CPIs
   - Explain how a program provides a signature for a PDA
   - Avoid common pitfalls and troubleshoot common errors associated with CPIs
4. Program Testing
   - Describe various ways to test Solana programs
   - Explain the difference between unit tests and integration tests
   - Debug Solana programs

# Module 5 - Anchor Program Development
1. Intro to Anchor development
   - Use the Anchor framework to build a basic program
   - Describe the basic structure of an Anchor program
   - Explain how to implement basic account validation and security checks with Anchor
2. Intro to client-side Anchor development
   - Use an IDL to interact with a Solana program from the client
   - Explain an Anchor `Provider` object
   - Explain an Anchor `Program` object
   - Use the Anchor `MethodsBuilder` to build instructions and transactions
   - Use Anchor to fetch accounts
   - Set up a frontend to invoke instructions using Anchor and an IDL
3. Anchor PDAs and accounts
   - Use the `seeds` and `bump` constraints to work with PDA accounts in Anchor
   - Enable and use the `init_if_needed` constraint
   - Use the `realloc` constraint to reallocate space on an existing account
   - Use the `close` constraint to close an existing account
4. Anchor CPIs
   - Make Cross Program Invocations (CPIs) from an Anchor program
   - Use the `cpi` feature to generate helper functions for invoking instructions on existing Anchor programs
   - Use `invoke` and `invoke_signed` to make CPIs where CPI helper functions are unavailable
   - Create and return custom Anchor errors

# Module 6 - Advanced Solana Development
COMING SOON

# Module 7 - Solana Program Security
1. Signer authorization
2. Owner checks
3. Account data matching
4. Reinitialization attacks
5. Duplicate mutable accounts
6. PDA sharing
7. Type cosplay
8. Bump seed canonicalization
9. Arbitrary CPIs
10. Closing accounts
11. Sysvar address checking
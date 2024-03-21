---
title: Default Account State
objectives:
 - Create mint account with default account state of frozen
 - Attempt to mint without thawing
 - Attempt to mint after thawing
 - Attempt to transfer without thawing
 - Attempt to transfer after thawing
---
# Summary

- The `DefaultAccountState` extension enables developers to set new token accounts to be frozen by default, requiring interaction with a specific service to unfreeze and utilize the tokens.
- There are three states for token accounts with this extension: Initialized, Uninitialized, and Frozen, which determine how a token account can be interacted with.
- The lab demonstrates creating a token account that is automatically set to a frozen state upon creation, and includes tests to ensure the extension works as intended for both minting and transferring tokens in frozen and thawed states.

# Overview

A mint creator may want to enforce certain actions on a new token account. The `DefaultAccountState` extension allows developers to force all new token accounts to be frozen, making it so users must interact with a service that can unfreeze their account and use the tokens. If later on the mint creator decides to reduce this restriction, the default state may be updated to remove the frozen default state.

The `DefaultAccountState` extension in the Solana SPL package enables mint creators to automatically freeze new token accounts for enhanced security or compliance. This requires users to unfreeze their accounts before usage. The lab guides through setting up, creating a mint with this extension, and testing token minting and transfers, showcasing how to utilize the default account state extension for secure and regulated token management.

Imagine the potential: tokens representing access to beta software, exclusive digital content, or even physical items awaiting delivery can be managed with greater assurance. The extension could enforce cooling-off periods for trades or ensure adherence to legal and regulatory requirements across jurisdictions.

### Types of States

There are 3 types of state with the default account state extension:

- Initialized
- Uninitialized
- Frozen

## Adding default account state

Initializing a mint with transfer fee involves three instructions:

- `SystemProgram.createAccount`
- `createInitializeTransferFeeConfigInstruction`
- `createInitializeMintInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. This instruction accomplishes three things:

- Allocates `space`
- Transfers `lamports` for rent
- Assigns to it's owning program

```tsx
const mintLen = getMintLen([ExtensionType.DefaultAccountState]);
// Minimum lamports required for Mint Account
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: mintKeypair.publicKey,
  space: mintLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

The second instruction `createInitializeDefaultAccountStateInstruction` initializes the default account state extension.

```tsx
const initializeDefaultAccountStateInstruction =
  createInitializeDefaultAccountStateInstruction(
    mintKeypair.publicKey,
    defaultState,
    TOKEN_2022_PROGRAM_ID,
  );
```

The third instruction `createInitializeMintInstruction` initializes the mint.

```tsx
const initializeMintInstruction = createInitializeMintInstruction(
  mintKeypair.publicKey,
  decimals,
  payer.publicKey,
  payer.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

When the transaction with these three instructions is sent, a new mint account is created with the default account state extension.

# Lab

In this lab we will be creating a token account that will be forced to be frozen upon creation. We will then write tests to check if the extension is working as intended by attempting to mint and transfer the tokens in a frozen and thawed account state. 

### 1. Setup Environment

To get started with this lab, clone the lab and change the branch to `starting` and install the necessary dependencies:

```bash
git clone git@github.com:Unboxed-Software/solana-lab-default-account-state.git
cd solana-lab-default-account-state
git checkout starting
npm install
```

### 2. Run validator node

For the sake of this guide, we will be running our own validator node. We do this because sometimes testnet or devnets on Solana can become congested and in turn less reliable.

In a separate terminal, run the following command: `solana-test-validator`. This will run the node and also log out some keys and values. The value we need to retrieve and use in our connection is the JSON RPC URL, which in this case is `http://127.0.0.1:8899`. We then use that in the connection to specify to use the local RPC URL.

```tsx
const connection = new Connection("http://127.0.0.1:8899", 'confirmed');
```

Alternatively, if you’d like to use testnet or devnet, import the `clusterApiUrl` from `@solana/web3.js` and pass it to the connection as such:

```tsx
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
```

### 3. Helpers

When you clone the repo and change to the `starting` branch, we will already have access to  following helper functions. 

- `token-helpers.ts`: This helper will facilitate in the create of the token accounts needed to run out tests against the mint token
- `initializeKeypair`: This function creates the keypair for the `payer` and also airdrops 1 testnet SOL to it
- `makeKeypairs`: This function creates keypairs without airdropping any SOL

### 4. Establish needed accounts

Inside of `src/index.ts`, the starting code already has some values related to the creation of the mint with default account state, and some others for when we create and run the tests. 

Add the following function call to the `createTokenExtensionMintWithDefaultState`. We will be implementing this function in the next step.

```tsx
// previous code

// Create mint token
await createTokenExtensionMintWithDefaultState(connection, payer, mintKeypair, decimals, defaultState);
```

### 5. Create Mint with Default account state

When creating a mint token with default state, we must create the account instruction, initialize the default account state for the mint account and initialize the mint itself. 

Create an asynchronous function named `createTokenExtensionMintWithDefaultState` in `src/mint-helpers.ts`. This function is where we will be creating the mint such that all new token accounts will be “frozen” to start. The function will take the following arguments:

- `connection` : The connection object
- `payer` : Payer for the transaction
- `mintKeypair` : Keypair for the new mint
- `decimals` : Mint decimals
- `defaultState` : Mint token default state - eg: `AccountState.Frozen`

The first step in creating a mint is reserving space on Solana with the `SystemProgram.createAccount` method. This requires specifying the payer's keypair, (the account that will fund the creation and provide SOL for rent exemption), the new mint account's public key (`mintKeypair.publicKey`), the space required to store the mint information on the blockchain, the amount of SOL (lamports) necessary to exempt the account from rent and the ID of the token program that will manage this mint account (`TOKEN_2022_PROGRAM_ID`).

```tsx
// Code goes here
const mintLen = getMintLen([ExtensionType.DefaultAccountState]);
// Minimum lamports required for Mint Account
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: mintKeypair.publicKey,
  space: mintLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

After the mint account creation, the next step involves initializing it with the default state. The `createInitializeDefaultAccountStateInstruction` function is used to generate an instruction that enables the mint to determine the default state. 

The default state extension provides 3 states: 

- Uninitialized: This state indicates that the token account has been created but not yet initialized through the Token Program.
- Initialized: An account in the Initialized state has been properly set up through the Token Program. This means it has a specified mint and an owner has been assigned.
- Frozen: A Frozen account is one that has been temporarily disabled from performing certain operations, specifically transferring and minting tokens.

The default state determines whether accounts are initialized in an enabled state, allowing immediate token transactions, or require further configuration. This step is fundamental in ensuring that the mint behaves according to the token issuer's requirements.

```tsx
const initializeDefaultAccountStateInstruction =
  createInitializeDefaultAccountStateInstruction(
    mintKeypair.publicKey,
    defaultState,
    TOKEN_2022_PROGRAM_ID,
  );
```

We then add the mint instruction by calling `createInitializeMintInstruction` and passing in the required arguments. This function is provided by the SPL Token package and it constructs a transaction instruction that initializes a new mint.

```tsx
const initializeMintInstruction = createInitializeMintInstruction(
  mintKeypair.publicKey,
  decimals,
  payer.publicKey, // Designated Mint Authority
  payer.publicKey, //  Designated Freeze Authority
  TOKEN_2022_PROGRAM_ID,
);
```

Now that the account and all of the instructions have been created, the mint account can be created with a default state of “Frozen”. 

```tsx
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeDefaultAccountStateInstruction,
  initializeMintInstruction,
);

return await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair],
);
```

Thats it for the mint token! Now we can move on and start ensuring that the extensions rules are applied correctly by running a few tests against it.

### 6. Tests

Inside of your main script, create the token accounts required for testing using the `createAccount` helper provided by the SPL Token library. The first one that is being created is the account is tied to `ourTokenAccountKeypair` that will be attempting to transfer tokens to  `otherTokenAccountKeypair`

```tsx
(async () => {
	// ... previous variables and function calls

	// Transferring from account
	 await createAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    ourTokenAccountKeypair,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
	// Transferring to account 
   await createAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    otherTokenAccountKeypair,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
})()
```

Now that we have the token accounts created, we can start creating the tests.

**Test Mint without thawing**

This test will attempt to mint a token without thawing the account. This test is expected to fail as the account will be frozen on the mint attempt.

Above the main IIFE, declare a function named `testMintWithoutThawing` along with its input types.

```tsx
interface MintWithoutThawingInputs {
  connection: Connection;
  payer: Keypair;
  tokenAccount: PublicKey;
  mint: PublicKey;
  amount: number;
}
async function testMintWithoutThawing(inputs:
  MintWithoutThawingInputs) {
  const { connection, payer, tokenAccount, mint, amount } = inputs;
  try {
    // Attempt to mint without thawing
    await mintTo(
      connection,
      payer,
      mint,
      tokenAccount,
      payer.publicKey,
      amount,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.error("Should not have minted...");
  } catch (error) {
    console.log(
      "✅ - We expected this to fail because the account is still frozen."
    );
  }
} 
```

Inside the main script, invoke the `testMintWithoutThawing` test and run `npm run start`. We should see the following error logged out in the terminal, meaning the extension is working as intended. `✅ - We expected this to fail because the account is still frozen.`

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  {
    // Show you can't mint without unfreezing
    await testMintWithoutThawing({
      connection,
      payer,
      tokenAccount: ourTokenAccount,
      mint,
      amount: amountToMint
    });
  }
})()
```

**Test Mint after thawing**

This test will attempt to mint a token after thawing the token account. This test is expected to pass as the account will be thawed on the mint attempt.

Below the previous test, declare a function named `testThawAndMint` along with its input types.

```tsx
interface ThawAndMintInputs {
  connection: Connection;
  payer: Keypair;
  tokenAccount: PublicKey;
  mint: PublicKey;
  amount: number;
}
async function testThawAndMint(inputs: ThawAndMintInputs) {
  const { connection, payer, tokenAccount, mint, amount } = inputs;
  try {
    // Unfreeze frozen token
    await thawAccount(
      connection, 
      payer,
      tokenAccount,
      mint, 
      payer.publicKey,
      undefined,
      undefined, 
      TOKEN_2022_PROGRAM_ID
    );
		// Mint tokens to tokenAccount
    await mintTo(
      connection,
      payer,
      mint,
      tokenAccount,
      payer.publicKey,
      amount,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const account = await getAccount(connection, tokenAccount, undefined, TOKEN_2022_PROGRAM_ID);

    console.log(
      `✅ - The new account balance is ${Number(account.amount)} after thawing and minting.`
    );

  } catch (error) {
    console.error("Error thawing and or minting token: ", error);
  }
}
```

In the main IIFE, paste the following beneath the previous code and run `npm run start`. This test should log a success message with the updated token account balance (1000) for `otherTokenAccount`. 

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  // ... previous test
	
  {
    // Show how to thaw and mint
    await testThawAndMint({
      connection,
      payer,
      tokenAccount: ourTokenAccount,
      mint,
      amount: amountToMint
    });
  }
})()
```

**Test Transfer without Thawing**

Now that we’ve tested minting, we can create tests to satisfy the transferring of tokens under certain conditions of the token account. First lets test a transfer without thawing the token account. 

Note: Both of these tests use the same input types so we only need to declare once.

Below the previous test, declare a function named `testTransferWithoutThawing` along with its input types. 

```tsx
interface ThawAndTransferInputs {
  connection: Connection;
  payer: Keypair;
  fromTokenAccount: PublicKey;
  toTokenAccount: PublicKey;
  mint: PublicKey;
  amount: number;
}
async function testTransferWithoutThawing(inputs: ThawAndTransferInputs) {
  const { connection, payer, fromTokenAccount, toTokenAccount, mint, amount } = inputs;
  try {

    await transfer(
      connection,
      payer,
      fromTokenAccount,
      toTokenAccount,
      payer,
      amount,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    console.error("Should not have minted...");
  } catch (error) {
    console.log(
      "✅ - We expected this to fail because the account is still frozen."
    );
  }
}
```

In the main IIFE, paste the following beneath the previous code and run `npm run start`. This test should log a failure message as the token account is still frozen. 

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  // ... previous tests
  
  {
    // Add test to transfer without thawing
    await testTransferWithoutThawing({
      connection,
      payer,
      fromTokenAccount: ourTokenAccount,
      toTokenAccount: otherTokenAccount,
      mint,
      amount: amountToTransfer
    })
  }
})()
```

**Test Transfer with Thawing**

The last test we will create is to test transferring tokens after thawing the token account we will be transferring to. This test is expected to pass.

Below the previous test, declare a function named `testTransferWithThawing`. 

```tsx
async function testTransferWithThawing(inputs: ThawAndTransferInputs) {
  const { connection, payer, fromTokenAccount, toTokenAccount, mint, amount } = inputs;
  try {

    // Unfreeze frozen token
    await thawAccount(
      connection,
      payer, 
      toTokenAccount, 
      mint,
      payer.publicKey, 
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    await transfer(
      connection,
      payer,
      fromTokenAccount,
      toTokenAccount,
      payer,
      amount,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )

    const account = await getAccount(connection, toTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);

    console.log(
      `✅ - The new account balance is ${Number(account.amount)} after thawing and transferring.`
    );

  } catch (error) {
    console.error("Error thawing and or transfering token: ", error);
  }
}
```

In the main IIFE, paste the following beneath the previous code and run `npm run start`. This test should log a success message with the updated token account balance (50) for `otherTokenAccount`. 

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  // ... previous tests
  
  {
    // Add test to transfer WITH thawing
    await testTransferWithThawing({
      connection,
      payer,
      fromTokenAccount: ourTokenAccount,
      toTokenAccount: otherTokenAccount,
      mint,
      amount: amountToTransfer
    });
  }
})()
```

Congratulations! We’ve just created and tested a mint using the default account extension!

# Challenge

Go create your own mint with a default account state.
---
title: Immutable Owner
objectives:
 - Create token account with immutable owner
 - Attempt to transfer owner
 - Attempt to transfer owner with associated token account
---
# Summary

- The `**ImmutableOwner**` extension ensures that once a token account is created, its owner is set to be unchangeable, securing the ownership against any modifications.
- Token accounts with this extension can have only one permanent state regarding ownership: **Immutable**.
- Using `createAssociatedTokenAccount` to create a token account adds an immutable owner by default.

# Overview

Associated Token Account addresses are uniquely determined by the owner and the mint, streamlining the process of identifying the correct Token Account for a specific owner. Initially, the ability to change token ownership presented security concerns, as users could mistakenly send funds to an account no longer owned by the intended recipient.

The **`ImmutableOwner`** feature, which is automatically applied to Associated Token Accounts, prevents any changes in ownership. This extension can also be enabled for new Token Accounts created through the Token Extension program, ensuring that once ownership is set, it is permanent. This secures accounts against unauthorized access and transfer attempts.

Within the Solana SPL toolkit, the **`ImmutableOwner`** extension ensures token accounts have a fixed owner, enhancing security by making ownership immutable. The guide includes instructions for setting up token accounts with this feature and testing scenarios to confirm the permanence of ownership, highlighting the extension's role in creating secure and immutable token accounts.

## Creating token account with immutable owner

Initializing a token account with immutable owner involves three instructions:

- `SystemProgram.createAccount`
- `createInitializeImmutableOwnerInstruction`
- `createInitializeMintInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. This instruction accomplishes three things:

- Allocates `space`
- Transfers `lamports` for rent
- Assigns to it's owning program

```tsx
const extensions = [ExtensionType.ImmutableOwner];

const tokenAccountLen = getAccountLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(tokenAccountLen);

const createTokenAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: tokenAccount,
  space: tokenAccountLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

The second instruction `createInitializeImmutableOwnerInstruction` initializes the immutable owner extension.

```tsx
const initializeImmutableOwnerInstruction =
  createInitializeImmutableOwnerInstruction(
    tokenAccount,
    TOKEN_2022_PROGRAM_ID,
  );
```

The third instruction `createInitializeAccountInstruction` initializes the token account.

```tsx
const initializeAccountInstruction = createInitializeAccountInstruction(
  tokenAccount,
  mint,
  owner.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

When the transaction with these three instructions is sent, a new token account is created with the immutable owner extension.

# Lab

In this lab we will be creating a token account with an immutable owner. We will then write tests to check if the extension is working as intended by attempting to transfer ownership of the token account. 

### 1. Clone

Clone the lab and change branches to `starting`

```bash
git clone git@github.com:Unboxed-Software/solana-lab-immutable-owner.git
cd solana-lab-immutable-owner
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

### 4. Create main script

Inside of `src/index.ts`, the required dependencies will already be created, along with an asynchronous IIFE for the main script. Add the following `createMint` function beneath the existing code:

```tsx
(async () => {
	// previous code
  const mint = await createMint(
    connection,
    payer,
    mintKeypair.publicKey,
    null,
    2,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );
})()
```

### 5. Create Token Account with immutable owner

When creating an associated token account with an immutable owner, we must create the account instruction, initialize the immutable owner for the token account and initialize the mint itself. 

Inside of the `src` directory, you will see a file named `token-helper.ts`. Inside of the token helper, there is an asynchronous function named `createTokenAccountWithImmutableOwner`. This function is where we will be creating the associated token account with the immutable owner.  The function will take the following arguments:

- `connection` : The connection object
- `mint` : Public key for the new mint
- `payer` : Payer for the transaction
- `owner` : Owner of the associated token account
- `tokenAccountKeypair` : The token account keypair associated with the token account

The first step in creating the token account is reserving space on Solana with the **`SystemProgram.createAccount`** method. This requires specifying the payer's keypair, (the account that will fund the creation and provide SOL for rent exemption), the new token account's public key (`mintKeypair.publicKey`), the space required to store the mint information on the blockchain, the amount of SOL (lamports) necessary to exempt the account from rent and the ID of the token program that will manage this mint account (**`TOKEN_2022_PROGRAM_ID`**).

```tsx
const tokenAccount = tokenAccountKeypair.publicKey;

const extensions = [ExtensionType.ImmutableOwner];

const tokenAccountLen = getAccountLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(tokenAccountLen);

const createTokenAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: tokenAccount,
  space: tokenAccountLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});
```

After the token account creation, the next step involves initializing it with an immutable owner. The `createInitializeImmutableOwnerInstruction` function is used to generate an instruction that enables the token account to determine the immutable owner. 

```tsx
const initializeImmutableOwnerInstruction =
  createInitializeImmutableOwnerInstruction(
    tokenAccount,
    TOKEN_2022_PROGRAM_ID,
  );
```

We then add the initialize account instruction by calling `createInitializeAccountInstruction` and passing in the required arguments. This function is provided by the SPL Token package and it constructs a transaction instruction that initializes a new token account.

```tsx
const initializeAccountInstruction = createInitializeAccountInstruction(
  tokenAccount,
  mint,
  owner.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```

Now that the account and all of the instructions have been created, the token account can be created with an immutable owner.

```tsx
const transaction = new Transaction().add(
  createTokenAccountInstruction,
  initializeImmutableOwnerInstruction,
  initializeAccountInstruction,
);

transaction.feePayer = payer.publicKey;

return await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, owner, tokenAccountKeypair],
);
```

Now that we’ve added the functionality for `token-helper`, we can create two variables for the token accounts. When we use the `createTokenAccountWithImmutableOwner` function we created, it explicitly adds the instructions to add an immutable owner to the token account. However, the SPL Token library provides a helper function that will do it all for us named `createAssociatedTokenAccount`. This helper will create an associated token account which by default includes an immutable owner. For the sake of this guide we will be testing against both of these approaches.

Back in `index.ts` underneath the mint variable, create the following two variables:

```
// Explicitly creating immutable owner token account with instructions
const createOurTokenAccountSignature = await createTokenAccountWithImmutableOwner(
  connection,
  mint,
  payer,
  payer,
  ourTokenAccountKeypair
);

// Creating token account with default immutable owner
const associatedTokenAccount = await createAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey,
  undefined,
  TOKEN_2022_PROGRAM_ID,
);
```

Thats it for the token accounts! Now we can move on and start ensuring that the extensions rules are applied correctly by running a few tests against it.

### 6. Tests

**Test trying to transfer owner**

The first token account that is being created is the account is tied to `ourTokenAccountKeypair` that will be attempting to transfer ownership of the account to  `otherOwner` which was generated earlier in the script. This test is expected to fail as the new authority is not the owner of the account upon creation.

Above the main IIFE, declare a function named `testTryingToTransferOwner` along with its input types. 

```tsx
interface TransferOwnerInputs {
  connection: Connection;
  tokenAccount: PublicKey;
  payer: Keypair;
  newAuthority: PublicKey;
}

async function testTryingToTransferOwner(inputs: TransferOwnerInputs) {
  const { connection, payer, tokenAccount, newAuthority } = inputs;
  try {
    // Attempt to change owner
    await setAuthority(
      connection,
      payer,
      tokenAccount,
      payer.publicKey,
      AuthorityType.AccountOwner,
      newAuthority,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.error("You should not be able to change the owner of the account.");

  } catch (error) {
    console.log(
      `✅ - We expected this to fail because the account is immutable, and cannot change owner.`
    );
  }
}
```

Inside the main script, invoke the `testTryingToTransferOwner` test and run `npm run start`. We should see the following error logged out in the terminal, meaning the extension is working as intended: `✅ - We expected this to fail because the account is immutable, and cannot change owner.`

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  {
    // Show that you can't change owner
    await testTryingToTransferOwner({
      connection,
      payer,
      tokenAccount: ourTokenAccount,
      newAuthority: otherOwner.publicKey,
    });
  }})()
```

**Test trying to transfer owner with associated token account**

This test will attempt to transfer ownership to the associated token account. This test is also expected to fail as the new authority is not the owner of the account upon creation.

Below the previous test, declare a function named `testTryingToTransferOwnerWithAssociatedTokenAccount`. We don’t need to declare types as it uses the previously create `TransferOwnerInputs` types.

```tsx
async function testTryingToTransferOwnerWithAssociatedTokenAccount(inputs: TransferOwnerInputs) {
  const { connection, payer, tokenAccount, newAuthority } = inputs;
  try {
    // Attempt to change owner
    await setAuthority(
      connection,
      payer,
      tokenAccount,
      payer.publicKey,
      AuthorityType.AccountOwner,
      newAuthority,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.error("You should not be able to change the owner of the account.");

  } catch (error) {
    console.log(
      `✅ - We expected this to fail because the associated token account is immutable, and cannot change owner.`
    );
  }
}
```

In the main IIFE, paste the following beneath the previous code and run `npm run start`. This test should log a failure message.

```tsx
(async () => {
	// ... previous code
	
	// ------------ Tests ------------------
  // ... previous tests
  
  {
    await testTryingToTransferOwnerWithAssociatedTokenAccount({
      connection,
      payer,
      tokenAccount: associatedTokenAccount,
      newAuthority: otherOwner.publicKey
    })
  }
})()
```

Congratulations! We’ve just created a token account and tested the immutable owner extension!

# Challenge

Go create your own token account with an immutable owner.
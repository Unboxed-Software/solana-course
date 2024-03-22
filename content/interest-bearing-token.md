# Summary

- Creators can set an interest rate and store it directly on the mint account.
- The underlying token quantity for interest bearing tokens remains unchanged.
- The accrued interest can be displayed for UI purposes without the need to frequently rebase or update to adjust for accrued interest.
- The lab demonstrates configuring a mint account that is set to mint with an interest rate. The test case also shows how to update the interest rate, along with retrieving the rate from the token.

# Overview

Tokens with values that either increase or decrease over time have practical applications in the real world, with bonds being a prime example. Previously, the ability to reflect this dynamic in tokens was limited to the use of proxy contracts, necessitating frequent rebasing or updates.

The introduction of the Token-2022 extension model revolutionizes the way the displayed amount of tokens can be adjusted. By leveraging the `InterestBearingMint` extension and the `amount_to_ui_amount` function, users can now apply an interest rate to their tokens and retrieve the updated total, including interest, at any given moment.

The calculation of interest is done continuously, factoring in the network's timestamp. However, discrepancies in the network's time could result in accrued interest being slightly less than anticipated, though this situation is uncommon.

It's important to note that this mechanism does not generate new tokens and the displayed amount simply includes the accumulated interest, making the change purely aesthetic.

## Adding interest rate to token

Initializing a interest bearing token involves three instructions:

- `SystemProgram.createAccount`
- `createInitializeTransferFeeConfigInstruction`
- `createInitializeMintInstruction`

The first instruction `SystemProgram.createAccount` allocates space on the blockchain for the mint account. This instruction accomplishes three things:

- Allocates `space`
- Transfers `lamports` for rent
- Assigns to it's owning program

```tsx
SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint,
    space: mintLen,
    lamports: mintLamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
```

The second instruction `createInitializeInterestBearingMintInstruction` initializes the interest bearing token extension. The defining argument that dictates the interest rate will be a variable we create named `rate`. 

The rate is determined by a conversion where 1% is equivalent to 100 basis points.

```tsx
  createInitializeInterestBearingMintInstruction(
    mint,
    rateAuthority.publicKey,
    rate,
    TOKEN_2022_PROGRAM_ID,
  ),
```

The third instruction `createInitializeMintInstruction` initializes the mint.

```tsx
 createInitializeMintInstruction(
    mint,
    decimals,
    mintAuthority.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID
  )
```

When the transaction with these three instructions is sent, a new interest bearing token is created with the specified rate configuration.

# Lab

In this lab, we're establishing interest Bearing Tokens via the Token-2022 program on Solana. We'll initialize these tokens with a specific interest rate, update the rate with proper authorization, and observe how interest accumulates on tokens over time.

### 1. Setup Environment

To get started with this lab, clone the lab and change the branch to `starting` and install the necessary dependencies:

```bash
git clone git@github.com:Unboxed-Software/solana-lab-interest-bearing-token.git
cd solana-lab-interest-bearing-token
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

Inside of `src/index.ts`, the starting code already has some values related to the creation of the interest bearing token. 

Underneath the `rate` variable, add the following function call to `createTokenWithInterestRateExtension` to create the interest bearing token. We will be implementing this function in the next step. We will also need to create an associated token account which we will be using to mint the interest bearing tokens to and also run some tests to check if the accrued interest increases as expected. 

```tsx
// previous code
const rate = 32_767;
await createTokenWithInterestRateExtension(
  connection,
  payer,
  mint,
  mintLen,
  rateAuthority,
  rate,
  mintKeypair
)

const payerTokenAccount = await createAssociatedTokenAccount(
  connection,
  payer,
  mint,
  payer.publicKey,
  undefined,
  TOKEN_2022_PROGRAM_ID
);
```

### 5. Create Mint with interest bearing token

This function is where we will be creating the token such that all new tokens will be created with an interest rate. The function will take the following arguments:

- `connection` : The connection object
- `payer` : Payer for the transaction
- `mint`: Public key for the new mint
- `mintLen`: Space required for mint. Calculated using `getMintLen(extensions)`
- `rateAuthority`: Keypair of the account that can modify the token, in this case it is `payer`
- `rate`: Chosen interest rate for the token. In our case, this will be `32_767`, or 32767, the max rate for the interest bearing token extension
- `mintKeypair` : Keypair for the new mint

When creating an interest bearing token, we must create the account instruction, add the interest instruction and initialize the mint itself. Inside of  `createTokenWithInterestRateExtension` in `src/token-helper.ts` there is a few variables already created that will be used to create the interest bearing token. Add the following code beneath the declared variables:

```
const mintTransaction = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mint,
    space: mintLen,
    lamports: mintLamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
  createInitializeInterestBearingMintInstruction(
    mint,
    rateAuthority.publicKey,
    rate,
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeMintInstruction(
    mint,
    decimals,
    mintAuthority.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID
  )
);

await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);
```

Thats it for the token creation! Now we can move on and start adding tests.

## 6. Tests

Before we start writing any tests, it would be helpful for us to have a function that takes in the `mint` and returns the current interest rate of that particular token. 

Lets utilize the `getInterestBearingMintConfigState` helper provided by the SPL library to do just that. We will then create a function that is used in our tests to log out the current interest rate of the mint.

The return value of this function is an object with the following values:

- `rateAuthority`: Keypair of the account that can modify the token
- `initializationTimestamp`: Timestamp of interest bearing token initialization
- `preUpdateAverageRate`: Last rate before update
- `lastUpdateTimestamp`: Timestamp of last update
- `currentRate`: Current interest rate

Underneath the main script, add the following types and function:

```tsx
interface GetInterestBearingMint {
  connection: Connection;
  mint: PublicKey;
}

async function getInterestBearingMint(inputs: GetInterestBearingMint) {
  const { connection, mint } = inputs
  // retrieves information of the mint
  const mintAccount = await getMint(
    connection,
    mint,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

	// retrieves the interest state of mint
  const interestBearingMintConfig = await getInterestBearingMintConfigState(
    mintAccount,
  );

  // returns the current interest rate
  return interestBearingMintConfig?.currentRate
}
```

**Updating interest rate**

The Solana SPL library provides a helper function for updating the interest rate of a token named `updateRateInterestBearingMint`. For this function to work correctly, the `rateAuthority` of that token must be the same one of which the token was created. If the `rateAuthority` is incorrect, updating the token will result in a failure. 

Lets create a test to update the rate with the correct authority. Outside of the main script, add the following types and test function:

```tsx
interface UpdateInterestRate {
  connection: Connection;
  payer: Keypair;
  mint: PublicKey;
}

async function testTryingToUpdateTokenInterestRate(inputs: UpdateInterestRate) {
  const { connection, payer, mint } = inputs;
  const rate = 0;
  const initialRate = await getInterestBearingMint({ connection, mint })
  try {
    await updateRateInterestBearingMint(
      connection,
      payer,
      mint,
      payer, // rateAuthority
      rate,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    const newRate = await getInterestBearingMint({ connection, mint })

    console.log(`✅ - We expected this to pass because the rate has been updated. Old rate: ${initialRate}. New rate: ${newRate}`);
  } catch (error) {
    console.error("You should be able to update the interest.");
  }
}
```

Inside the main script, invoke the `testTryingToUpdateTokenInterestRate` test, passing the `connection`, `payer` and `mint` and then run `npm run start`. We should see the following error logged out in the terminal, meaning the extension is working as intended and the interest rate has been updated: `✅ - We expected this to pass because the rate has been updated. Old rate: 32767. New rate: 0`

```tsx
{
  // Attempts to update interest on token
  testTryingToUpdateTokenInterestRate({
    connection,
    payer,
    mint
  })
}
```

**Updating interest rate with incorrect rate authority**

In this next test, lets try and update the interest rate with the incorrect `rateAuthority`. Earlier we created a keypair named `otherAccount`. This will be what we use as the `wrongPayer` to attempt the change the interest rate.

Below the previous test we created add the following code for the `testTryingToUpdateTokenInterestRateWithWrongOwner` function:

```tsx
async function testTryingToUpdateTokenInterestRateWithWrongOwner(inputs: UpdateInterestRate) {
  // in this test case, payer is "otherAccount", which isn't the original payer
  const { connection, payer: wrongPayer, mint } = inputs;
  const rate = 0;
  try {
    await updateRateInterestBearingMint(
      connection,
      wrongPayer,
      mint,
      wrongPayer,
      rate,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID,
    );
    console.log("You should be able to update the interest.");
  } catch (error) {
    console.error(`✅ - We expected this to fail because the owner is incorrect.`)}
}
```

Inside the main script, add the call to `testTryingToUpdateTokenInterestRateWithWrongOwner` and run `npm run start`. This is expected to fail and log out `✅ - We expected this to fail because the owner is incorrect.`

```tsx
{
  // Attempts to update interest on token
  testTryingToUpdateTokenInterestRateWithWrongOwner({
    connection,
    payer: wrongPayer,
    mint
  })
}
```

**Mint tokens and read interest rate**

So we’ve tested updating the interest rate. How do we check that the accrued interest increases when an account mints more tokens? We can use the `amountToUiAmount` and `getAccount` helpers from the SPL library to help us achieve this.

Lets create a for loop that 5 times and mints 100 tokens per loop and logs out the new accrued interest:

```tsx
{
  // Logs out interest on token
  for (let i = 0; i < 5; i++) {
    // retrieves current interest rate
    const rate = await getInterestBearingMint({ connection, mint });
    await mintTo(
      connection,
      payer,
      mint,
      payerTokenAccount,
      payer,
      100,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    const tokenInfo = await getAccount(connection, payerTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);

    // Convert amount to UI amount with accrued interest
    const uiAmount = await amountToUiAmount(
      connection,
      payer,
      mint,
      tokenInfo.amount,
      TOKEN_2022_PROGRAM_ID,
    );

    console.log(`Amount with accrued interest at ${rate}: ${tokenInfo.amount} tokens = ${uiAmount}`);
  }
}
```

You should see something similar to the logs below:

```tsx
Amount with accrued interest at 32767: 100 tokens = 0.0000001000000207670422
Amount with accrued interest at 32767: 200 tokens = 0.0000002000000623011298
Amount with accrued interest at 32767: 300 tokens = 0.0000003000001246022661
Amount with accrued interest at 32767: 400 tokens = 0.00000040000020767045426
Amount with accrued interest at 32767: 500 tokens = 0.0000005000003634233328
```

**Log mint config**

If for some reason you need to retrieve the mint config state, we can utilize the `getInterestBearingMintConfigState` function we created earlier to display information about the interest bearing mint state.

```
const mintAccount = await getMint(
    connection,
    mint,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // Get Interest Config for Mint Account
  const interestBearingMintConfig = await getInterestBearingMintConfigState(
    mintAccount,
  );

  console.log(
    "\nMint Config:",
    JSON.stringify(interestBearingMintConfig, null, 2),
  );
```

This should log out something that looks similar to this:

```tsx
Mint Config: {
  "rateAuthority": "Ezv2bZZFTQEznBgTDmaPPwFCg7uNA5KCvMGBNvJvUmS",
  "initializationTimestamp": 1709422265,
  "preUpdateAverageRate": 32767,
  "lastUpdateTimestamp": 1709422267,
  "currentRate": 0
}
```

Thats it! We’ve just created an interest bearing token, updated the interest rate and logged the updated state of the token!

# Challenge

Create your own interest bearing token.
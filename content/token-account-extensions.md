# Lab
We’re going to create a script that interacts with instructions on the Token Program. 

We will create a token mint with default state, along with a token account with an immutable owner. Then we will test a mint and the transfer of tokens with frozen/thawed accounts and with/without memos.
## 1. Set Up

```bash
git clone https://github.com/Unboxed-Software/solana-lab-token-account-extensions.git
cd solana-lab-token-account-extensions
git checkout starter
npm install
```

## 2. Generate Keypairs
To facilitate the creation of Token Account Extensions, we will create helper functions that separate and handle the various steps involved in the process.

The `starter` branch will already have one of these helpers created, named `keypair-helpers.ts`. This helper will handle the creation of all the keypairs needed to create the token account extension. Inside of this file will be two functions: 
  - `initializeKeypair`: This handles the generation of the keypairs we will need to create different
  - `airdropSolIfNeeded`: This will airdrop the accounts created some devnet Sol if needed. 

Take a look at `src/index.ts`. The function named `main` will be the main script where we invoke the functions for all of the token account extension creation flow. We will generate the keys needed to create the mint and token account. `payer` is declared and a keypair is generated using `initializeKeypair`. We do this to ensure the `payer` wallet has been created with test tokens in it. The `payer` keypair plays an important role of the token account extension as it will be set as the immutable owner.

```
// Required imports

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const payer = await initializeKeypair(connection);

  const otherOwner = Keypair.generate();

  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const mintDecimals = 9;
  const defaultAccountState = AccountState.Frozen;

  const ourTokenAccountKeypair = Keypair.generate();
  const ourTokenAccount = ourTokenAccountKeypair.publicKey;

  const otherTokenAccountKeypair = Keypair.generate();
  const otherTokenAccount = otherTokenAccountKeypair.publicKey;

  const amountToMint = 1000;
  const amountToTransfer = 300;

  console.log("Payer account public key: ", payer.publicKey);
  console.log("Mint public key: ", mint);
  console.log("Our token account public key: ", ourTokenAccount);
  console.log("Other token account public key: ", otherTokenAccount);

  // - Create Mint Account
  // - Create Token Account

  // - Tests
  // - Minting without thawing
  // - Thawing and minting
  // - Trying to transfer ownership
  // - Trying to transfer without a memo
  // - Transferring with memo with a frozen account
  // - Transferring with memo with a thawed account
}

main();
```

### Create Mint
To create token account extensions, first we need to create a mint. To do this, create a file inside of `src` named `mint-helpers.ts`. The mint helper will create a mint with the required default account state instructions and return the signature of that transaction.

First, import the required functions and extensions from `@solana/spl-token` and `@solana/web3.js`, then create the `createToken22MintWithDefaultState` function.
```
import { 
  AccountState,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeDefaultAccountStateInstruction,
  createInitializeMintInstruction,
  getMintLen 
} from "@solana/spl-token";

import { Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

export async function createToken22MintWithDefaultState(
    connection: Connection, 
    payer: Keypair, 
    mintKeypair: Keypair, 
    decimals: number = 2,
    defaultState: AccountState,
): Promise<string> {
	// Remaining code goes here
}
```

Inside of `createToken22MintWithDefaultState`, declare the following variables required to create the mint account instruction.

```
// Define extension for the mint
const extensions = [ExtensionType.DefaultAccountState];
// Get the public key of the mint account
const mintAccount = mintKeypair.publicKey;

// Set the mint authority and freeze authority as the payer's public key
const mintAuthority = payer.publicKey;
const freezeAuthority = payer.publicKey;

// Calculate the required space for the mint account
const mintLen = getMintLen(extensions);
// Get the minimum required lamports for the mint account creation
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
```

Now that we have the keypairs created, we create the mint account and default account state instructions and add them to a new mint transaction. Once the mint transaction has been instantiated, call the `sendAndConfirmTransaction` function with the transaction and other arguments, which will send and confirm the transaction to the Solana network. The return value of `createToken22MintWithDefaultState`, a transaction signature, is then passed back to the main script.

Add the following code to the rest of the `createToken22MintWithDefaultState` function:
```
// Create an instruction to create the mint account
const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: mintAccount,
  space: mintLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});

// Initialize instructions
const initializeMintInstruction = createInitializeMintInstruction(
  mintAccount,
  decimals,
  mintAuthority,
  freezeAuthority,
  TOKEN_2022_PROGRAM_ID
);
  
const initializeDefaultAccountStateInstruction =
  createInitializeDefaultAccountStateInstruction(
  mintAccount,
  defaultState,
  TOKEN_2022_PROGRAM_ID
);

// Create and send transaction
const transaction = new Transaction().add(
  createAccountInstruction,
  initializeDefaultAccountStateInstruction,
  initializeMintInstruction
);
  
return await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, mintKeypair],
);
```

### Create Token Account
We now have everything needed to create the mint and return the signature to the main script, so now we can move on to the token account. Create a file inside of src named `token-helpers.ts`. The token helper works similarly to the mint helper, whereby it creates and returns a token account signature. , will create a token account with the required extensions: 
- Immutable Owner
- Required Memo
- CPI Guard

Import the required functions and extensions from `@solana/spl-token` and `@solana/web3.js`, then create the `createTokenAccountWithExtensions` function.
```
import { ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createEnableCpiGuardInstruction,
  createEnableRequiredMemoTransfersInstruction,
  createInitializeAccountInstruction,
  createInitializeImmutableOwnerInstruction,
  getAccountLen
} from "@solana/spl-token";

import { Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction
} from "@solana/web3.js";

export async function createTokenAccountWithExtensions(
  connection: Connection, 
  mint: PublicKey, 
  payer: Keypair, 
	owner: Keypair,
  tokenAccountKeypair: Keypair
): Promise<string> {
  // Remaining code goes here
}
```
Inside of `createTokenAccountWithExtensions`, declare the following variables required to create the token account instruction.

```
const tokenAccount = tokenAccountKeypair.publicKey;

// Define extensions for the token account
const extensions = [
  ExtensionType.CpiGuard,
  ExtensionType.ImmutableOwner,
  ExtensionType.MemoTransfer
];

const tokenAccountLen = getAccountLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(tokenAccountLen);

// Create and initialize instructions for token account
const createTokenAccountInstruction = SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  newAccountPubkey: tokenAccount,
  space: tokenAccountLen,
  lamports,
  programId: TOKEN_2022_PROGRAM_ID,
});

const initializeImmutableOwnerInstruction =
  createInitializeImmutableOwnerInstruction(
  tokenAccount,
  TOKEN_2022_PROGRAM_ID,
  );

const initializeRequiredMemoTransfersInstruction =
  createEnableRequiredMemoTransfersInstruction(
  tokenAccount,
  owner.publicKey,
  undefined,
  TOKEN_2022_PROGRAM_ID,
  );

const initializeCpiGuard =
  createEnableCpiGuardInstruction(tokenAccount, owner.publicKey, [], TOKEN_2022_PROGRAM_ID)

const initializeAccountInstruction = createInitializeAccountInstruction(
  tokenAccount,
  mint,
  owner.publicKey,
  TOKEN_2022_PROGRAM_ID,
);

// Instantiate and send transaction
const transaction = new Transaction().add(
  createTokenAccountInstruction,
  initializeImmutableOwnerInstruction, // THIS HAS TO GO FIRST
  initializeAccountInstruction,  
  initializeRequiredMemoTransfersInstruction,
  initializeCpiGuard,
);

transaction.feePayer = payer.publicKey;

return await sendAndConfirmTransaction(
  connection,
  transaction,
  [payer, owner, tokenAccountKeypair],
);
```

Thats it for the helpers! Now we have the ability to create the mint and token accounts.

### Create mint and token accounts
In `index.ts`, underneath the current code inside the `main` function, call the functions we previously created and added to `mint-helpers` and `token-helpers` to create the mint and accounts.

```
async function main() {
  // Previous variable declarations
  
  // Invoke mint creation
  const createMintSignature = await createToken22MintWithDefaultState(
    connection,
    payer,
    mintKeypair,
    mintDecimals,
    defaultAccountState
  );

  // Create token accounts
  // Note: We create a second account which we will use later to test transferring tokens to
  const createOurTokenAccountSignature = await createTokenAccountWithExtensions(
    connection,
    mint,
    payer,
	  payer,
    ourTokenAccountKeypair
  );

  const createOtherTokenAccountSignature = await createTokenAccountWithExtensions(
    connection,
    mint,
	  payer,
	  otherOwner,
    otherTokenAccountKeypair
  );
}

```

### Add Tests
We're all set up and ready to start testing that our mint and accounts with extensions are working as intended. Lets go through step by step to add the test cases and learn about what each one does, respectively. 

We will be declaring all of the test functions separately and then invoking them inside the `main` script.

#### testMintWithoutThawing
Given that the mint was created using the `AccountState.Frozen` extension, it cannot succeed unless the account is thawed. Trying to do so without thawing will result in an error. Add the following inside the `main` function:
```
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
```
Next, outside of the `main` function, add the following code for the test function:
```
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

#### testThawAndMint

#### testTryingToTransferOwner

#### testTryingToTransferWithoutMemo

#### testTransferringWithMemoWithFrozenAccount

#### testTransferringWithMemoWithThawedAccount




# Lab

## 0. Prerequisites

```bash
git clone https://github.com/Unboxed-Software/solana-lab-token22-metadata.git
cd solana-lab-token22-metadata
git checkout starter
npm install
```
## 1. Create Helpers

Before we delve into the core functionality of our NFT lab, we need a couple of helpers for uploading NFT metadata. Specifically, we need a helper function we can call that will take the metadata we want to exist off-chain and upload it to some storage provider, returning the location of that metadata as a URI, and another one that will initialize a Solana key pair and return it so we can use this key pair for signing transactions and interacting with the Solana blockchain.

If you are on the starter branch, you will find a file called `src/helper.ts`. The first thing you will notice inside it is a few imports; let's talk about them:

```ts
import * as web3 from '@solana/web3.js';
import { bundlrStorage, keypairIdentity, Metaplex, toMetaplexFile } from '@metaplex-foundation/js';
import fs from 'fs';
import dotenv from 'dotenv';
import { getKeypairFromFile, requestAndConfirmAirdropIfRequired } from '@solana-developers/helpers';
```

To interact with the Solana blockchain and the Metaplex ecosystem, our NFT lab relies on several key dependencies:

1. **`web3` from '@solana/web3.js'**:
   - This import is another reference to the `@solana/web3.js` library. It is commonly aliased as `web3` for convenience.
   - It allows access to various functions and tools provided by the Solana web3 library, enhancing capabilities for interacting with the Solana blockchain.

2. **`bundlrStorage`, `keypairIdentity`, `Metaplex`, `toMetaplexFile` from '@metaplex-foundation/js'**:
   - These modules are from the `@metaplex-foundation/js` library, a JavaScript library provided by the Metaplex Foundation for building applications on the Metaplex platform.
   - `bundlrStorage` is used for bundling and storing NFT-related data.
   - `keypairIdentity` is used for managing identities and cryptographic key pairs specific to Metaplex.
   - `Metaplex` contains functions and tools for interacting with the Metaplex platform.
   - `toMetaplexFile` is used to convert data into a format suitable for the Metaplex platform.

3. **`fs` (File System) module**:
   - This is a built-in Node.js module for interacting with the file system.
   - It is used here for file-related operations, such as reading and writing files. In the context of NFTs, this is crucial for handling metadata and other file-based information.

4. **`dotenv` module**:
   - This module is used for loading environment variables from a `.env` file into `process.env`.

5. **`getKeypairFromFile` and `requestAndConfirmAirdropIfRequired` from '@solana-developers/helpers'**:
   - These functions are likely part of a set of utility functions provided by the `@solana-developers/helpers` module.
   - `getKeypairFromFile` is used to retrieve a cryptographic key pair from a file, simplifying the process of handling keys.
   - `requestAndConfirmAirdropIfRequired` is used for automating the process of requesting and confirming an airdrop of Solana tokens to an account.

After that, you can see that we are initializing dotenv:

```ts
dotenv.config();
```

Then you will see two interfaces, `CreateNFTInputs` and `UploadOffChainMetadataInputs`, which will represent the types we'll be using. `CreateNFTInputs` will represent the basic NFT information needed to create an NFT, and `UploadOffChainMetadataInputs` will represent the inputs we need to successfully upload our NFT metadata.

```ts
export interface CreateNFTInputs {
  payer: web3.Keypair; // The account that will pay for the creation of the NFT.
  connection: web3.Connection; // The Solana blockchain connection.
  tokenName: string; // The name of the NFT.
  tokenSymbol: string; // The symbol of the NFT.
  tokenUri: string; //  The URI of the off-chain metadata.
}

export interface UploadOffChainMetadataInputs {
  connection: web3.Connection; // The Solana blockchain connection.
  payer: web3.Keypair; // The account that will pay for the upload of the off-chain metadata.
  tokenName: string; // The name of the NFT.
  tokenSymbol: string; // The symbol of the NFT.
  tokenDescription: string; // The description of the NFT.
  imagePath: string; // The path to the image representing the NFT.
}
```

Now that we have those interfaces, we can start looking at the main helper functions. Let's start with the function that will upload our NFT's off-chain metadata.

Since storing data on-chain is expensive due to the nature of how blockchain works, we're going to upload our fat NFT metadata to an off-chain storage provider. For this example, we will use the Metaplex SDK. It's important to note that we don't actually have to use Metaplex for this. All that matters is that we end up with a URI that points to the off-chain metadata. You could upload JSON to AWS if you wanted to, but we'll stick with the Metaplex default of storing data in Arweave.

```ts
export async function uploadOffChainMetadata(inputs: UploadOffChainMetadataInputs) {
  const { connection, payer, tokenName, tokenDescription, tokenSymbol, imagePath } = inputs;

  const metaplex = Metaplex.make(connection)
    .use(keypairIdentity(payer))
    .use(
      bundlrStorage({
        address: 'https://devnet.bundlr.network',
        providerUrl: 'https://api.devnet.solana.com',
        timeout: 60000,
      }),
    );

  // file to buffer
  const buffer = fs.readFileSync('src/' + imagePath);

  // buffer to metaplex file
  const file = toMetaplexFile(buffer, imagePath);

  // upload image and get image URI
  const imageUri = await metaplex.storage().upload(file);
  console.log('image URI:', imageUri);

  // upload metadata and get metadata URI (off-chain metadata)
  const { uri } = await metaplex
    .nfts()
    .uploadMetadata({
      name: tokenName,
      description: tokenDescription,
      symbol: tokenSymbol,
      image: imageUri,
    })
    .run();

  return uri;
}
```

The other important piece of our helpers is the `initializeKeypair` function, which will be used to initialize a Solana key pair and return it. Let's take a look at it:

```ts
export async function initializeKeypair(connection: web3.Connection, keyPairFilePath?: string): Promise<web3.Keypair> {
  if (keyPairFilePath) {
    const signer = await getKeypairFromFile(keyPairFilePath);

    await requestAndConfirmAirdropIfRequired(connection, signer.publicKey, 2, 1);

    return signer;
  } else if (process.env.PRIVATE_KEY) {
    const secret = JSON.parse(process.env.PRIVATE_KEY ?? '') as number[];
    const secretKey = Uint8Array.from(secret);
    const keypairFromSecretKey = web3.Keypair.fromSecretKey(secretKey);

    await requestAndConfirmAirdropIfRequired(connection, keypairFromSecretKey.publicKey, 2, 1);

    return keypairFromSecretKey;
  } else {
    console.log('Creating .env file');

    const signer = web3.Keypair.generate();
    fs.writeFileSync('.env', `PRIVATE_KEY=[${signer.secretKey.toString()}]`);
    await requestAndConfirmAirdropIfRequired(connection, signer.publicKey, 2, 1);

    return signer;
  }
}
```
It takes two params, a `connection`, which is The Solana blockchain connection, and a an optional `keyPairFilePath` which should point to a pre-existing key pair file, and here's a breakdown of the key steps:

- If a `keyPairFilePath` is provided, it reads the key pair from the file.
- It then requests and confirms an airdrop of Solana tokens to the account associated with the key pair.
- If no file path is provided but a private key is available in the environment variables, it retrieves the private key and creates a key pair.
- It then requests and confirms an airdrop for the account associated with the key pair.
- If neither a file path nor a private key is provided, it generates a new key pair.
- It writes the private key to a `.env` file for future use.
- It requests and confirms an airdrop for the account associated with the newly generated key pair.
- Lastly it returns a promise that resolves to the initialized Solana key pair. This key pair can then be used for signing transactions and interacting with the Solana blockchain.

## 2. First Piece, Uploading the off-chain metadata

In order to upload our off-chain metadata, we need to first prepare an image that will represent our NFT. Add the image you want inside the `src` folder, let's call it `NFT.png`, or you can name it whatever you prefer. After that, take a look inside `src/index.ts`. You will find a very simple starter code:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair } from './helpers';

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

We are importing `Connection`, which we talked about before, and also `clusterApiUrl`, a method that takes the name of the network, such as `devnet`, `testnet`, or `mainnet-beta`, and returns the endpoint of that network. Lastly, we are importing `initializeKeypair`, which helps us get the payer keypair later.

You will also see a simple `main` function where we are just initializing the `connection` object and initializing the `payer` keypair. Notice that we are not passing the second optional param, which is `keyPairFilePath`, because we are going to let it initialize a new keypair and store it in the `.env` file. Although if you want to use a pre-saved keypair (wallet), you can provide the path of that key in your own filesystem, such as `~/.config/solana/id.json`, which is the default keypair path for Solana CLI.

This keypair, which we called `payer`, will be responsible for every payment we need throughout the whole process. Also, this payer keypair will hold all the authorities, like the mint authority, mint freeze authority, etc. We can use a different keypair for the authorities other than the payer keypair, but for the sake of simplicity, we will stick to the same one.

At the end, we are invoking the main function so we can use the file as a script.

To upload the off-chain metadata, we need to import the helper function `uploadOffChainMetadata` from `src/helper.ts`. So, the imports section will look like this:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
```

Now, we can add some variables that will represent the NFT properties like name, symbol, and image:

```ts
const imagePath = 'NFT.png';
const tokenName = 'NFT Name';
const tokenDescription = 'This is a cool Token22 NFT';
const tokenSymbol = 'TTT';
```

Now, we just have to call the function `uploadOffChainMetadata` after importing it from `src/helpers.ts` and pass it all the parameters and let it handle the rest:

```ts
const tokenUri = await uploadOffChainMetadata({
  connection,
  payer,
  tokenName,
  tokenDescription,
  tokenSymbol,
  imagePath,
});
```

As a recap, our `src/index.ts` should look like this:

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);

  const imagePath = 'NFT.png';
  const tokenName = 'NFT Name';
  const tokenDescription = 'This is a cool Token22 NFT';
  const tokenSymbol = 'TTT';

  const tokenUri = await uploadOffChainMetadata({
    connection,
    payer,
    tokenName,
    tokenDescription,
    tokenSymbol,
    imagePath,
  });

  // You can log the URI here and run the code to test it
  console.log('Token URI:', tokenUri);
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

To run the code and test it, you can use `npm start`, and you should see the URI after the uploading is done. If you visit it, you should see a JSON that holds all of our off-chain metadata.

## 3. Create NFT with metadata-pointer:
Developers used to store tokens/NFTs metadata using some metadata programs such as `Metaplex`, which we will use as an example here for the sake of sticking with something familiar for most of the ecosystem. However, in the past, we didn't have a pointer in the mint itself (which is what we can call the NFT since it should store all the NFT properties) to the account that stores the metadata for this NFT. We only had a one-way pointer from the metadata account to the mint. In this case, anyone can create a shady metadata account and point it to the NFT, leaving it up to the client apps to find out which one is the real one!

To solve this problem, Solana introduces an extension called `metadata-pointer` extension, which is simply a field in the mint/NFT itself that will point to the account that holds the metadata for this token. This will make it easier for client apps to find the respective metadata-account and retrieve the metadata. Additionally, it will make it more secure and accurate. So let's deep dive into the code.

As a best practice when writing scripts that engage with the Solana network, it is best to consolidate all of our instructions in one transaction due to the atomic nature of transactions. This ensures either the successful execution of all instructions or a complete rollback in case of errors. This approach promotes data consistency, improves efficiency by reducing latency and optimizing block space, and enhances code readability. Additionally, it minimizes inter-transaction dependencies, making it easier to track and manage the flow of operations, therefore in the code, we will write a few methods that will guide the way, and each one will return one or more instructions. The outline of this process is as follows:

1. `getCreateMintWithMetadataPointerInstructions`: returns Instructions to create the mint with a pointer to the metadata account. **(we will build this)**
2. `getCreateMetadataAccountOnMetaplexInstructions`: returns Instructions to create the metadata account and store the metadata in it. **(we will build this)**
3. `createAssociatedTokenAccountInstruction`: returns Instructions to create the associated token account **(we will import this from `@solana/spl-token` library)**
4. `createMintToCheckedInstruction`: returns Instructions to mint the NFT into the associated token account **(we will import this from `@solana/spl-token` library)**
5. `createSetAuthorityInstruction`: returns Instructions to set the authority to an account. It will be used to remove the mint authority, because for the token to be considered as NFT in the Solana network, it has to have a supply of 1 and no one should be able to mint any more tokens, so the mint authority should be `None` **(we will import this from `@solana/spl-token` library)**
6. We should put all of that in one transaction and send it to the network, and that is it. We have an NFT with a metadata pointer.

OK, let's really get to the code, create a new file `nft-with-metadata-pointer.ts`, and let's start writing the code:

### `getCreateMintWithMetadataPointerInstructions`

We are going to create a mint that has a pointer to the metadata account. However, we don't have the metadata account yet. First, we need to get the address of that account. Fortunately, the Metaplex program uses a defined method to derive the account (AKA PDA, meaning program-defined account). To obtain that account, we need to pass in some seeds and then use another helper function from the Solana SDK. For the Metaplex metadata program, it uses three seeds to derive the metadata PDA, which are:

1. **metadata**: Literally the word 'metadata'.
2. **Metaplex Program ID**: The public key representing the Metaplex program on Solana.
3. **Mint's Public Key**: The public key of the mint associated with the NFT or token.

So, let's write this function first:

```ts
import * as web3 from '@solana/web3.js';

function getMetadataAccountAddressOnMetaplex(mintPublicKey: web3.PublicKey) {
  const METAPLEX_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // Metaplex derives the metadata account address (PDA) using the following three seeds
  const seed1 = Buffer.from('metadata');
  const seed2 = METAPLEX_PROGRAM_ID.toBuffer();
  const seed3 = mintPublicKey.toBuffer();
  const [metadataPDA, _bump] = web3.PublicKey.findProgramAddressSync([seed1, seed2, seed3], METAPLEX_PROGRAM_ID);
  return metadataPDA;
}
```

We are importing the Solana SDK, which contains many helpers, functions, and interfaces we will need along the way. After that, we are implementing the function. It takes the mint public key and returns the metadataPDA. Inside it, we define the Metaplex program ID (the address or public key of the metadata program), which we need as our second seed. The first seed should be the word 'metadata', and the last seed would be the mint public key itself. Then, we use the method `web3.PublicKey.findProgramAddressSync` by passing the right seeds in the correct order as the first parameter and the owner program of the PDA as the second. It will return a PDA and a bump, with the PDA being the part we are interested in.

Now that we've got that out of the way, we can start writing our main function. Here is the code for `getCreateMintWithMetadataPointerInstructions`:

```ts
// other imports...
import * as web3 from '@solana/web3.js';
import {
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';

// other code...

interface CreateMintWithMetadataPointerInstructionsInputs {
  mint: web3.Keypair; // The mint account that will be created.
  payer: web3.Keypair; // The account that will pay for the creation of the mint.
  connection: web3.Connection; // The Solana blockchain connection.
  decimals: number; // The number of decimals in the token account amounts.
}

async function getCreateMintWithMetadataPointerInstructions(
  inputs: CreateMintWithMetadataPointerInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, connection, decimals } = inputs;
  const metadataPDA = getMetadataAccountAddressOnMetaplex(mint.publicKey);

  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // We will point to the Metaplex metadata account, but for now, it will not be there. We will have to create it later.
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    null,
    metadataPDA,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  return [
    // The order here matters
    createMintAccountInstructions, // First, we need to allocate the account and pay the rent fee.
    initMetadataPointerInstructions, // Second, we need to initialize the pointer. If you initialize the mint before the pointer, it will return an error.
    initMintInstructions, // Now we can go ahead and initialize the mint.
  ];
}
```

**Imports Explanation**

**From `@solana/spl-token`:**

- **`createInitializeMetadataPointerInstruction`:** Initializes a "metadata pointer" account linking an SPL Token account with its metadata account.
- **`createInitializeMintInstruction`:** Creates an instruction to initialize a new SPL Token mint.
- **`ExtensionType`:** Specifies additional features that can be added to token accounts or mints.
- **`getMintLen`:** Retrieves the byte size required for storing a mint account on the blockchain.
- **`TOKEN_2022_PROGRAM_ID`:** The program ID of the SPL Token program, necessary for interacting with SPL tokens.

After that, we have the interface `CreateMintWithMetadataPointerInstructionsInputs`, which represents the inputs this function needs to work properly. Finally, we have the function itself, and here is a breakdown of the logic:

- It starts by getting the metadataPDA using `getMetadataAccountAddressOnMetaplex`, which we talked about above.
- Counting the amount of lamports we will need to allocate the mint account, taking into consideration that we are using the metadata-pointer extension because it will increase the size of the mint since we will have to store a bit more data in it than usual (the metadata-pointer and the authority, who can change this metadata-pointer in the future).

```ts
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
```

- Create the mint account instruction, which is where we allocate the mint and pay the rent fee.

```ts
const createMintAccountInstructions = web3.SystemProgram.createAccount({
  fromPubkey: payer.publicKey, // Who is going to pay the rent fee for allocating the account.
  lamports, // How much is the fee.
  newAccountPubkey: mint.publicKey, // What is the new account address that we want to allocate.
  programId: TOKEN_2022_PROGRAM_ID, // Which program is going to be responsible for that address.
  space: mintLen, // How much space do we need for the account.
});
```

- create the initialize metadata-pointer instruction, in this instruction we will initialize the metadata pointer even though we didn't have the metadata account yet, we will create it later, notice that in the code we are setting the metadata-pointer authority to `none`, at the time we are writing this lesson metaplex SDK was giving an error if we set that authority to anyone, so we had to leave it like that
```ts
const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
  mint.publicKey, // Token mint account  
  null, // Optional Authority that can set the metadata address  
  metadataPDA, // Optional Account address that holds the metadata  
  TOKEN_2022_PROGRAM_ID, // SPL Token program account  
);
```
- then `createInitializeMintInstruction`: which will initialize the account we allocated before as a mint
```ts
const initMintInstructions = createInitializeMintInstruction(
  mint.publicKey, // Token mint account  
  decimals, // Number of decimals in token account amounts  
  payer.publicKey, // Minting authority  
  payer.publicKey, // Optional authority that can freeze token accounts  
  TOKEN_2022_PROGRAM_ID, // SPL Token program account  
);

```

- The last step for this is to return a list of the three instruction we made above, keep in mind that the order here is important and we need to always execute the instruction in this specific order
```ts
return [
  createMintAccountInstructions, // first we need to allocate the account, and pay the rent fee
  initMetadataPointerInstructions, // second we need to init the pointer, if you init the mint before the pointer it will return an error
  initMintInstructions, // now we can go ahead and init the mint
];
```

### `getCreateMetadataAccountOnMetaplexInstructions`:

This method will create the account that will hold the metadata using the Metaplex metadata program. We need to deal with some Metaplex-specific code, so let's begin by discussing the imports we will need for this method:

```ts
import * as web3 from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  Collection,
  CollectionDetails,
  Creator,
  PrintSupply,
  TokenStandard,
  Uses,
  createV1,
  CreateV1InstructionAccounts,
  CreateV1InstructionData,
} from '@metaplex-foundation/mpl-token-metadata';
import { createSignerFromKeypair, none, percentAmount, PublicKey, signerIdentity, Umi } from '@metaplex-foundation/umi';
// other imports...
```

We already discussed the first two above. Now let's focus on the rest:

**From `@metaplex-foundation/umi-web3js-adapters`:**
We use these adapters because Metaplex code uses a different format for some objects that are not compatible with the `solana/web3js` SDK, like signer, publicKey, and instructions. Therefore, we need to keep using adapters each time we need to use some information across the Solana SDK and Metaplex SDK.

- **`fromWeb3JsKeypair`:** Adapts Solana keypairs from `@solana/web3.js` for use with Metaplex libraries.
- **`fromWeb3JsPublicKey`:** Converts Solana public keys from `@solana/web3.js` format to Metaplex compatible format.
- **`toWeb3JsInstruction`:** Converts Metaplex instructions into formats usable with `@solana/web3.js` for transactions.

**From `@metaplex-foundation/mpl-token-metadata`:**

- **`Collection`, `CollectionDetails`, `Creator`, `PrintSupply`, `Uses`:** Classes for defining and structuring NFT metadata, such as creators, collections, and usage rights.
- **`TokenStandard`:** Specifies the token standard used (e.g., fungible, non-fungible, etc.).
- **`createV1`:** Creates a Metaplex NFT instructions to create the metadata account.
- **`CreateV1InstructionAccounts`, `CreateV1InstructionData`:** Interfaces used to provide types to make our life easier.

**From `@metaplex-foundation/umi`:**
UMI stands for Unified Market Infrastructure. It's a platform and set of tools developed by the Metaplex Foundation, aiming to simplify development and interaction with NFTs and tokenized assets on various blockchains, including Solana.

- **`createSignerFromKeypair`:** Creates a signer for transactions using a Solana keypair.
- **`none`, `percentAmount`:** Utility functions, for handling numeric values or optional data.
- **`PublicKey`:** Represents a Solana public key within the Metaplex context.
- **`signerIdentity`:** Retrieves a signer's identity from their keypair.
- **`Umi`:** Core class for interacting with the Metaplex platform and its services.

After setting that aside, we can finally start talking about the actual code, and here it is:

```ts
interface CreateMetadataAccountOnMetaplexInstructionsInputs {
  payer: web3.Keypair; // The account that will pay for the creation of the metadata account.
  mint: web3.Keypair; // The mint account associated with the NFT.
  umi: Umi; // The Umi instance for interacting with the Metaplex platform.
  tokenName: string; // The name of the NFT.
  tokenSymbol: string; // The symbol of the NFT. 
  tokenUri: string; // The URI of the off-chain metadata.
}

async function getCreateMetadataAccountOnMetaplexInstructions(
  inputs: CreateMetadataAccountOnMetaplexInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, umi, tokenName, tokenSymbol, tokenUri } = inputs;
  const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.use(signerIdentity(signer, true));

  const onChainData = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    sellerFeeBasisPoints: percentAmount(0, 2),
    creators: none<Creator[]>(),
    collection: none<Collection>(),
    uses: none<Uses>(),
  };
  const accounts: CreateV1InstructionAccounts = {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)),
    splTokenProgram: fromWeb3JsPublicKey(TOKEN_2022_PROGRAM_ID),
    payer: signer,
    authority: signer,
    updateAuthority: signer,
  };
  const data: CreateV1InstructionData = {
    ...onChainData,
    isMutable: true,
    discriminator: 0,
    tokenStandard: TokenStandard.Fungible,
    collectionDetails: none<CollectionDetails>(),
    ruleSet: none<PublicKey>(),
    createV1Discriminator: 0,
    primarySaleHappened: true,
    decimals: none<number>(),
    printSupply: none<PrintSupply>(),
  };

  // Using the Metaplex SDK, we build transaction instructions so we can commit them later to the network.
  // Metaplex uses a different structure for the instructions, which is not compatible with the Solana web3 SDK.
  // We need to change that to make it compatible with the Solana web3 SDK.
  // To do so, we use the helper `toWeb3JsInstruction` from '@metaplex-foundation/umi-web3js-adapters'.
  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    .map((ix) => toWeb3JsInstruction(ix));
}
```

#### Function Logic Explanation

- Creating a signer: We can't simply use the keypair from `solana/web3js`. We first need to convert it into a format compatible with Metaplex.

- We need to instruct `umi` to use this signer as a transaction signer. This allows it to pay the rent for the metadata account we are about to create.
```ts
const signer = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
umi.use(signerIdentity(signer, true));
```

- Preparing the on-chain data:
  ```ts
  const onChainData = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    sellerFeeBasisPoints: percentAmount(0, 2), // The fee that the seller will get from the sale of the NFT.
    creators: none<Creator[]>(), // Optional: The creators of the NFT.
    collection: none<Collection>(), // Optional: The collection the NFT belongs to.
    uses: none<Uses>(), // Optional: The usage rights for the NFT.
  };
  ```

  These are essential details for the metadata.
  
- List of all the accounts involved:

  ```ts
  const accounts: CreateV1InstructionAccounts = {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)), // The mint account associated with the NFT.
    splTokenProgram: fromWeb3JsPublicKey(TOKEN_2022_PROGRAM_ID), // The program ID of the SPL Token program.
    payer: signer, // optional: The account that will pay for the creation of the metadata account.
    authority: signer, // optional: The authority for the metadata account.
    updateAuthority: signer, // optional: The authority that can update the metadata account.
  };
  ```

  These accounts are necessary for the mint and metadata creation process.

- lastly we are going to create the instructions that will create this metadata account, and then we will loop over them to convert them into a `solana/web3js` instruction format, and we will return that
```ts
  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    .map((ix) => toWeb3JsInstruction(ix));
}
```

### `createNFTWithMetadataPointer`:

This is the last piece of code for this file, and we will be done for this file, are you excited?

let's first go over the imports so we can talk about the code freely after, these are the extra imports that we will need for the code to be complete:
```ts
import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMetadataPointerState,
  getMint,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import { fetchMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { CreateNFTInputs } from './helpers';
```
**From `@solana/spl-token`:**

* **`AuthorityType`:** Enum defining different authority roles for token accounts (e.g., minting, freezing).
* **`createAssociatedTokenAccountInstruction`:** Creates an associated token account for a specific mint, automatically derived from a user's public key.
* **`createMintToCheckedInstruction`:** Mints new tokens from a mint and deposits them into a specified account.
* **`createSetAuthorityInstruction`:** Sets a specific authority (e.g., minting) on a token account for a new authority public key.
* **`getAccount`:** Retrieves information about a specific token account on the blockchain.
* **`getAssociatedTokenAddress`:** Calculates the address of an associated token account based on a mint and a public key.
* **`getMetadataPointerState`:** Fetches the state of a metadata pointer account, linking an SPL Token account with its off-chain data.
* **`getMint`:** Retrieves information about a specific mint on the blockchain.
* **`TOKEN_2022_PROGRAM_ID`:** The program ID of the SPL Token program, necessary for interacting with SPL tokens.

**From `@metaplex-foundation/mpl-token-metadata`:**

* **`fetchMetadata`:** Downloads and parses NFT metadata associated with a specific mint address.

**From `@metaplex-foundation/umi-bundle-defaults`:**

* **`createUmi`:** Initializes a Umi instance for interacting with the Metaplex platform and its services.

**From `./helpers`**

* **`CreateNFTInputs`:** an interface containing data required for creating NFTs.

and up for the actual code:
```ts
export default async function createNFTWithMetadataPointer(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;

  const umi = createUmi('https://api.devnet.solana.com');

  const mint = web3.Keypair.generate();

  // NFT should have 0 decimals
  const decimals = 0;

  const createMintInstructions = await getCreateMintWithMetadataPointerInstructions({
    payer,
    mint,
    connection,
    decimals,
  });

  const metadataInstructions = await getCreateMetadataAccountOnMetaplexInstructions({
    payer,
    mint,
    umi,
    tokenName,
    tokenSymbol,
    tokenUri,
  });

  // we will need this to mint our NFT to it
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const mintInstructions = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const removeMintAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // Building and confirming the transaction
  const transaction = new web3.Transaction().add(
    ...createMintInstructions,
    ...metadataInstructions,
    createATAInstructions,
    mintInstructions,
    removeMintAuthorityInstructions,
  );
  const sig = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);

  console.log(`Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
```
in the above code we are doing the following:
- we are creating a new UMI instance, and we are passing the devnet endpoint to it, so it can interact with the metaplex platform
- we are generating a new keypair for the mint, and we are setting the decimals to 0, because NFTs should have 0 decimals
- we are calling the `getCreateMintWithMetadataPointerInstructions` and passing it the required params, and we are getting the instructions that will create the mint with a pointer to the metadata account
- we are calling the `getCreateMetadataAccountOnMetaplexInstructions` and passing it the required params, and we are getting the instructions that will create the metadata account
- we are getting the associated token address, which we get from the mint address and the owner address (wallet address), and we are creating the associated token account, notice that in Solana system, in order to hold any tokens you can't directly hold them in the wallet, you will have to create an associated token account that will only hold your balance of a specific token.
- we are creating the mint to checked instruction, which will mint the NFT into the associated token account, and we are setting the supply to 1, because NFTs should have a supply of one
- we are creating the set authority instruction, which will remove the mint authority, because for the token to be considered as NFT in the solana network, it has to have a supply of 1 and no one should be able to mint anymore tokens so the mint authority should be `None`
- we are building the transaction and sending it to the network, notice that the order of the instructions here is important, and we have to execute them in this specific order
- at the end we are logging the transaction signature, so we can visit the explorer and see the transaction details

and by that we are done with the code for creating a new NFT with a metadata pointer, all what we need to do is to call this function from `src/index.ts` and pass the required params, and we are good to go, although I would like to add few more lines to after that to fetch and print the NFT and the token account and the metadata it self, so we can make sure that our code is working fine, so we will add this code to the end of our last function

```ts
  // Now we can fetch the account and the mint and look at the details

  // Feting the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Feting the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // But the mint will not have the metadata by it self, we need to first get the metadata pointer
  const metadataPointerState = getMetadataPointerState(mintDetails);
  console.log('Mint metadata-pointer details =====>', metadataPointerState);

  // Since our metadata are on Metaplex we will fetch the metadata using a helper method from metaplex SDK
  const metadata = await fetchMetadata(umi, fromWeb3JsPublicKey(metadataPointerState!.metadataAddress!));
  console.log('Mint metadata =====>', metadata);

  // And we can even get the off-chain json now
  const offChainMetadata = await fetch(metadata.uri).then((res) => res.json());
  console.log('Mint off-chain metadata =====>', offChainMetadata);
```
What are we doing here?
- we are fetching the associated token account details which should tell us that we do own one NFT
- we are fetching the mint details, but by logging that we will not see the metadata-pointer, in order see the metadata-pointer details we should do some extra work, and we are doing that by calling `getMetadataPointerState` and passing it the mint details, this will give us two things, the metadata-pointer, and the metadata-pointer authority.
- now to get the metadata since we have the address of the account that holds them we can just get the account details and we shall have the metadata, but because we are using Metaplex, the metadata will be stored in a specific format, so to make it easier we will just use the metaplex SDK to fetch the metadata, and we are doing that by calling `fetchMetadata` and passing it the umi instance and the metadata address, and we will get the metadata
- and finally we are fetching the off-chain metadata, and we are doing that by calling `fetch` and passing it the metadata uri, and we will get the off-chain metadata json object

and that is it, we are done with the code for this file, as a recap let's see how the full file should look like after assembling all the code snippets together

```ts
// src/nft-with-metadata-pointer.ts

import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddress,
  getMetadataPointerState,
  getMint,
  getMintLen,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey, toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';
import {
  Collection,
  CollectionDetails,
  createV1,
  CreateV1InstructionAccounts,
  CreateV1InstructionData,
  Creator,
  fetchMetadata,
  PrintSupply,
  TokenStandard,
  Uses,
} from '@metaplex-foundation/mpl-token-metadata';
import { createSignerFromKeypair, none, percentAmount, PublicKey, signerIdentity, Umi } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { CreateNFTInputs } from './helpers';

function getMetadataAccountAddressOnMetaplex(mint: web3.Keypair) {
  const METAPLEX_PROGRAM_ID = new web3.PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  // Metaplex drives the metadata account address (PDA) by using the following three seeds
  const seed1 = Buffer.from('metadata');
  const seed2 = METAPLEX_PROGRAM_ID.toBuffer();
  const seed3 = mint.publicKey.toBuffer();
  const [metadataPDA, _bump] = web3.PublicKey.findProgramAddressSync([seed1, seed2, seed3], METAPLEX_PROGRAM_ID);
  return metadataPDA;
}

interface CreateMintWithMetadataPointerInstructionsInputs {
  mint: web3.Keypair;
  payer: web3.Keypair;
  connection: web3.Connection;
  decimals: number;
}

async function getCreateMintWithMetadataPointerInstructions(
  inputs: CreateMintWithMetadataPointerInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, connection, decimals } = inputs;
  const metadataPDA = getMetadataAccountAddressOnMetaplex(mint.publicKey);

  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // we will point to the metaplex metadata account, but for now it will not be there, we will have to create it later
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    null,
    metadataPDA,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  return [
    // The order here matters
    createMintAccountInstructions, // first we need to allocate the account, and pay the rent fee
    initMetadataPointerInstructions, // second we need to init the pointer, if you init the mint before the pointer it will return an error
    initMintInstructions, // now we can go ahead and init the mint
  ];
}

interface CreateMetadataAccountOnMetaplexInstructionsInputs {
  payer: web3.Keypair;
  mint: web3.Keypair;
  umi: Umi;
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
}

async function getCreateMetadataAccountOnMetaplexInstructions(
  inputs: CreateMetadataAccountOnMetaplexInstructionsInputs,
): Promise<web3.TransactionInstruction[]> {
  const { mint, payer, umi, tokenName, tokenSymbol, tokenUri } = inputs;
  constsigner = createSignerFromKeypair(umi, fromWeb3JsKeypair(payer));
  umi.ue(signerIdentity(signer, true));

  const onChainData = {
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    sellerFeeBasisPoints: percentAmount(0, 2),
    creators: none<Creator[]>(),
    collection: none<Collection>(),
    uses: none<Uses>(),
  };
  const accounts: CreateV1InstructionAccounts = {
    mint: createSignerFromKeypair(umi, fromWeb3JsKeypair(mint)),
    splTokenProgram: fromWeb3JsPublicKey(TOKEN_2022_PROGRAM_ID),
    payer: signer,
    authority: signer,
    updateAuthority: signer,
  };
  const data: CreateV1InstructionData = {
    ...onChainData,
    isMutable: true,
    discriminator: 0,
    tokenStandard: TokenStandard.Fungible,
    collectionDetails: none<CollectionDetails>(),
    ruleSet: none<PublicKey>(),
    createV1Discriminator: 0,
    primarySaleHappened: true,
    decimals: none<number>(),
    printSupply: none<PrintSupply>(),
  };

  // Using the Metaplex SDK we are going to build a transaction instructions so we could commit them later to the network
  // but Metaplex uses a different structure for the instructions which is not compatible with solana web3 SDK, so we
  // will have to change that back to make it compatible with solana web3 SDK, and to do so we are using the helper
  // `toWeb3JsInstruction` from '@metaplex-foundation/umi-web3js-adapters'
  return createV1(umi, { ...accounts, ...data })
    .getInstructions()
    .map((ix) => toWeb3JsInstruction(ix));
}

export default async function createNFTWithMetadataPointer(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;

  const umi = createUmi('https://api.devnet.solana.com');

  const mint = web3.Keypair.generate();

  // NFT should have 0 decimals
  const decimals = 0;

  const createMintInstructions = await getCreateMintWithMetadataPointerInstructions({
    payer,
    mint,
    connection,
    decimals,
  });

  const metadataInstructions = await getCreateMetadataAccountOnMetaplexInstructions({
    payer,
    mint,
    umi,
    tokenName,
    tokenSymbol,
    tokenUri,
  });

  // we will need this to mint our NFT to it
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const mintInstructions = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const removeMintAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // Building and confirming the transaction
  const transaction = new web3.Transaction().add(
    ...createMintInstructions,
    ...metadataInstructions,
    createATAInstructions,
    mintInstructions,
    removeMintAuthorityInstructions,
  );
  const sig = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);

  console.log(`Transaction: https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // Now we can fetch the account and the mint and look at the details

  // Feting the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Feting the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // But the mint will not have the metadata by it self, we need to first get the metadata pointer
  const metadataPointerState = getMetadataPointerState(mintDetails);
  console.log('Mint metadata-pointer details =====>', metadataPointerState);

  // Since our metadata are on Metaplex we will fetch the metadata using a helper method from metaplex SDK
  const metadata = await fetchMetadata(umi, fromWeb3JsPublicKey(metadataPointerState!.metadataAddress!));
  console.log('Mint metadata =====>', metadata);

  // And we can even get the off-chain json now
  const offChainMetadata = await fetch(metadata.uri).then((res) => res.json());
  console.log('Mint off-chain metadata =====>', offChainMetadata);
}
```

So let's run our code and test it to see if it is working fine, and if it is we will move to the next step

go back to `src/index.ts`, first you will have to import the function `createNFTWithMetadataPointer` from the file we just created, so go ahead and do that 

```ts
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';
```

now go to the end of the main function and call the function `createNFTWithMetadataPointer` and pass the required params, and you should have something like this
```ts
  await createNFTWithMetadataPointer({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });
```
as you know, all of these variables are already declared  and ready to use from before, so after that you `srx/index.ts` file should look like this

```ts
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');
  const payer = await initializeKeypair(connection);

  const imagePath = 'NFT.png';
  const tokenName = 'NFT Name';
  const tokenDescription = 'This is a cool token22 NFT'
  const tokenSymbol = 'TTT';

  const tokenUri = await uploadOffChainMetadata({
    connection,
    payer,
    tokenName,
    tokenDescription,
    tokenSymbol,
    imagePath,
  });

  // you can log the URI here and run the code to test it
  console.log('Token URI:', tokenUri);

  await createNFTWithMetadataPointer({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```

### Run the `createNFTWithMetadataPointer` function

All you have to do now is run the following command:

```sh
npm start
```

Then, wait for the magic to happen. You will see the transaction signature in the console, and you can visit the explorer to view the transaction details. Additionally, you will be able to see the NFT, its associated token account, and the metadata. You can also view the off-chain metadata. If you observe all of that, congratulations! You have successfully created a new NFT with a metadata pointer, and you are ready to move on to the next step.

## 4. Create Embedded Metadata
If you feel a bit tired from the last section, then this section is for you, one of the coolest extensions that the token22 program introduces is the `metadata-extension`, and the motivation behind this is to make it much easier for us to create a token/NFT with metadata since we are going to store that metadata in the mint itself, no need for third party apps! no need for another account! and as we go through the code you will see how much easier and more convenient it is to use this extension, so let's get started

First go ahead and create new file `src/nft-with-embedded-metadata.ts` and add the following imports to it
```ts
import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  getMintLen,
  getTokenMetadata,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import { CreateNFTInputs } from './helpers';
```
you already know must of these imports, so we will only talk about the new ones
**from `@solana/spl-token-metadata`**:
 which is a new package that we will use to interact with the metadata extension.
- **`createInitializeInstruction`:** Creates an instruction to initialize a token metadata account.
- **`createUpdateFieldInstruction`:** Creates an instruction to update a specific field in a token metadata account.
- **`pack`:** Packs a token metadata object into a byte array for storage on-chain.
- **`TokenMetadata`:** Represents the metadata associated with a token, including its name, symbol, URI, and additional metadata fields.

from `@solana/spl-token`: 
- **`getTokenMetadata`:** Retrieves the metadata associated with a specific mint.
- **`LENGTH_SIZE`:** The size of the length field in a byte array.
- **`TYPE_SIZE`:** The size of the type field in a byte array.

with that being said, let's start with the main function for this file, and we will call it `createNFTWithEmbeddedMetadata`, and it will take the same inputs as the previous function, and it will look like this: 
```ts
export default async function createNFTWithEmbeddedMetadata(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;

  const mint = web3.Keypair.generate();

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    additionalMetadata: [['customField', 'customValue']],
  };

  // When we init the mint we need to count for all the metadata that will get stored in it so we pay the right amount of rent
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  // Solana Token22 program needs to store some extra information other than the metadata it self in the mint account
  // this data is the size of the type and the total length of the metadata
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  // NFT should have 0 decimals
  const decimals = 0;

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // Even if we want to use the metadata-extension, we still need to use the metadata-pointer-extension but it will point to the mint it self
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMetadataInstructions = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint: mint.publicKey,
    metadata: mint.publicKey,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    mintAuthority: payer.publicKey,
    updateAuthority: payer.publicKey,
  });

  const updateMetadataFieldInstructions = createUpdateFieldInstruction({
    metadata: mint.publicKey,
    updateAuthority: payer.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    field: metadata.additionalMetadata[0][0],
    value: metadata.additionalMetadata[0][1],
  });

  // we will need this to mint our NFT to it
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const mintIX = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const setMintTokenAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const transaction = new web3.Transaction().add(
    createMintAccountInstructions,
    // We should always init the metadata pointer before the mint, otherwise it will error
    initMetadataPointerInstructions,
    initMintInstructions,
    initMetadataInstructions,
    updateMetadataFieldInstructions,
    createATAInstructions,
    mintIX,
    setMintTokenAuthorityInstructions,
  );
  const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);
  console.log(`Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);

  // Now we can fetch the account and the mint and look at the details

  // Fetching the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Fetching the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // Since the mint stores the metadata in itself, we can just get it like this
  const onChainMetadata = await getTokenMetadata(connection, mint.publicKey);
  // Now we can see the metadata coming with the mint
  console.log('On-chain metadata =====>', onChainMetadata);

  // And we can even get the off-chain json now
  if (onChainMetadata && onChainMetadata.uri) {
    const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
    console.log('Mint off-chain metadata =====>', offChainMetadata);
  }
}
```

So let's go over the code and see what we are doing here:
- we are creating a new keypair for the mint
```ts
const mint = web3.Keypair.generate();
```
- we are creating the metadata object, and we are setting the mint to the mint public key, and we are setting the name, symbol, uri, and additional metadata, and we are setting the decimals to 0, because NFTs should have 0 decimals
```ts
const metadata: TokenMetadata = {
  mint: mint.publicKey,
  name: tokenName,
  symbol: tokenSymbol,
  uri: tokenUri,
  additionalMetadata: [['customField', 'customValue']],
};

// NFT should have 0 decimals
const decimals = 0;
```
the metadata extension let us set some basic defined metadata, such as name, symbol, and uri
at the same time it gives us the flexiblity to add custom metadata fields, so we can any metadata we want, to do so we will have to put them inside a nested array, where the outer array will contain sub arrays, each will have only two elements, the first one will be the field name, and the second one will be the field value.

- we are calculating the rent fee for the mint, and we are calculating the metadata length, and we are calculating the total rent fee
```ts
const mintLen = getMintLen([ExtensionType.MetadataPointer]);
const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);
```
in the code above we are using the `getMintLen` function to calculate the rent fee for the mint, notice here that we are still using the `metadataPointer` extension, we will talk about that soon, but for now keep in mind that we have to use it, also we are calculating the metadata length by using the `pack` function to pack the metadata object into a byte array, and we are adding the type size and the length size to it, these two constant values are going to get stored in the mint account to make it easier to process the mint data and to know where the metadata starts and ends, so they are additional data that we have to pay for when we create the mint account, and finally we are calculating the total rent fee by adding the mint rent fee and the metadata rent fee together.

- we are creating the mint account, and we are setting the rent fee, and we are setting the space to the mint length, you should be familiar with this step by now
```ts
const createMintAccountInstructions = web3.SystemProgram.createAccount({
  fromPubkey: payer.publicKey,
  lamports,
  newAccountPubkey: mint.publicKey,
  programId: TOKEN_2022_PROGRAM_ID,
  space: mintLen,
});
```
- we are creating the metadata pointer instruction, event if we are using the metadata extension, we still have to use the metadata pointer extension, but we will point to the mint it self, this is how the system works to insure consistency and to make it easier to process the mint data
```ts
const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
  mint.publicKey,
  payer.publicKey,
  mint.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```
- create initialize mint instruction
```ts
const initMintInstructions = createInitializeMintInstruction(
  mint.publicKey,
  decimals,
  payer.publicKey,
  payer.publicKey,
  TOKEN_2022_PROGRAM_ID,
);
```
- create initialize metadata instruction, this instruction is going to resize the mint account and add the basic metadata to it, without any additional metadata, we will handle the additional metadata in the next step
```ts
const initMetadataInstructions = createInitializeInstruction({
  programId: TOKEN_2022_PROGRAM_ID,
  // metadata account address is the same as the mint address
  metadata: mint.publicKey, 
  mint: mint.publicKey,
  name: metadata.name,
  symbol: metadata.symbol,
  uri: metadata.uri,
  mintAuthority: payer.publicKey,
  updateAuthority: payer.publicKey,
});
```

- create update field instruction, this instruction is going to add the additional metadata to the mint account, and since we are already have the metadata so we will treat it as we are updating the metadata and we can add any additional metadata we want
```ts
const updateMetadataFieldInstructions = createUpdateFieldInstruction({
  metadata: mint.publicKey, // metadata account address, which is the same as the mint address for this time
  updateAuthority: payer.publicKey, // who has the authority to update the metadata
  programId: TOKEN_2022_PROGRAM_ID,
  field: metadata.additionalMetadata[0][0], // the field name
  value: metadata.additionalMetadata[0][1], // the field value
});
```
notice here that we are only updating the metadata for one field, if we have another field we will have to add another instruction to update it, and we should do the same for all the additional metadata fields we have, at the same time if we wanted to update a built-in metadata field, we can do that using the same instruction but we will have to ass the field name in the field param and the new value in the value param

- then we will create the associated token account, and mint the NFT to it, and then remove the mint authority
```ts
// we will need this to mint our NFT to it
const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
const createATAInstructions = createAssociatedTokenAccountInstruction(
  payer.publicKey,
  ata,
  payer.publicKey,
  mint.publicKey,
  TOKEN_2022_PROGRAM_ID,
);

const mintIX = createMintToCheckedInstruction(
  mint.publicKey,
  ata,
  payer.publicKey,
  // NFTs should have a supply of one
  1,
  decimals,
  undefined,
  TOKEN_2022_PROGRAM_ID,
);

// NFTs should have no mint authority so no one can mint any more of the same NFT
const setMintTokenAuthorityInstructions = createSetAuthorityInstruction(
  mint.publicKey,
  payer.publicKey,
  AuthorityType.MintTokens,
  null,
  undefined,
  TOKEN_2022_PROGRAM_ID,
);
```
- now we just need to made the transaction, pass all the instruction to it, and send it to the network
```ts
const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);
console.log(`Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
```
And we are done with creating the NFT with the embedded metadata, and in order to make sure that everything is alright we are going to add some code to fetch the NFT and the metadata and the associated token account, and print them to the console
```ts
  // Fetching the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Fetching the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // Since the mint stores the metadata in itself, we can just get it like this
  const onChainMetadata = await getTokenMetadata(connection, mint.publicKey);
  // Now we can see the metadata coming with the mint
  console.log('On-chain metadata =====>', onChainMetadata);

  // And we can even get the off-chain json now
  if (onChainMetadata && onChainMetadata.uri) {
    const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
    console.log('Mint off-chain metadata =====>', offChainMetadata);
  }
}
```

our file is ready now and it should look like this:
```ts
import * as web3 from '@solana/web3.js';
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  getMintLen,
  getTokenMetadata,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import { CreateNFTInputs } from './helpers';

export default async function createNFTWithEmbeddedMetadata(inputs: CreateNFTInputs) {
  const { payer, connection, tokenName, tokenSymbol, tokenUri } = inputs;

  const mint = web3.Keypair.generate();

  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: tokenName,
    symbol: tokenSymbol,
    uri: tokenUri,
    additionalMetadata: [['customField', 'customValue']],
  };

  // NFT should have 0 decimals
  const decimals = 0;

  // When we init the mint we need to count for all the metadata that will get stored in it so we pay the right amount of rent
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  // Solana Token22 program needs to store some extra information other than the metadata it self in the mint account
  // this data is the size of the type and the total length of the metadata
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metadataLen);

  const createMintAccountInstructions = web3.SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    space: mintLen,
  });

  // Even if we want to use the metadata-extension, we still need to use the metadata-pointer-extension but it will point to the mint it self
  const initMetadataPointerInstructions = createInitializeMetadataPointerInstruction(
    mint.publicKey,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMintInstructions = createInitializeMintInstruction(
    mint.publicKey,
    decimals,
    payer.publicKey,
    payer.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const initMetadataInstructions = createInitializeInstruction({
    programId: TOKEN_2022_PROGRAM_ID,
    mint: mint.publicKey,
    metadata: mint.publicKey,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    mintAuthority: payer.publicKey,
    updateAuthority: payer.publicKey,
  });

  const updateMetadataFieldInstructions = createUpdateFieldInstruction({
    metadata: mint.publicKey,
    updateAuthority: payer.publicKey,
    programId: TOKEN_2022_PROGRAM_ID,
    field: metadata.additionalMetadata[0][0],
    value: metadata.additionalMetadata[0][1],
  });

  // we will need this to mint our NFT to it
  const ata = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const createATAInstructions = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    mint.publicKey,
    TOKEN_2022_PROGRAM_ID,
  );

  const mintIX = createMintToCheckedInstruction(
    mint.publicKey,
    ata,
    payer.publicKey,
    // NFTs should have a supply of one
    1,
    decimals,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  // NFTs should have no mint authority so no one can mint any more of the same NFT
  const setMintTokenAuthorityInstructions = createSetAuthorityInstruction(
    mint.publicKey,
    payer.publicKey,
    AuthorityType.MintTokens,
    null,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  const transaction = new web3.Transaction().add(
    createMintAccountInstructions,
    // We should always init the metadata pointer before the mint, otherwise it will error
    initMetadataPointerInstructions,
    initMintInstructions,
    initMetadataInstructions,
    updateMetadataFieldInstructions,
    createATAInstructions,
    mintIX,
    setMintTokenAuthorityInstructions,
  );
  const transactionSignature = await web3.sendAndConfirmTransaction(connection, transaction, [payer, mint]);
  console.log(`Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);

  // Now we can fetch the account and the mint and look at the details
  // Fetching the account
  const accountDetails = await getAccount(connection, ata, 'finalized', TOKEN_2022_PROGRAM_ID);
  console.log('Associate Token Account =====>', accountDetails);

  // Fetching the mint
  const mintDetails = await getMint(connection, mint.publicKey, undefined, TOKEN_2022_PROGRAM_ID);
  console.log('Mint =====>', mintDetails);

  // Since the mint stores the metadata in itself, we can just get it like this
  const onChainMetadata = await getTokenMetadata(connection, mint.publicKey);
  // Now we can see the metadata coming with the mint
  console.log('On-chain metadata =====>', onChainMetadata);

  // And we can even get the off-chain json now
  if (onChainMetadata && onChainMetadata.uri) {
    const offChainMetadata = await fetch(onChainMetadata.uri).then((res) => res.json());
    console.log('Mint off-chain metadata =====>', offChainMetadata);
  }
}
```

Now go back to `src/index.ts`, first you will have to import the function `createNFTWithEmbeddedMetadata` from the file we just created, so go ahead and do that 
```ts
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';
```

and then call it at the end of the main function and pass the required params, and you should have something like this
```ts
await createNFTWithEmbeddedMetadata({
  payer,
  connection,
  tokenName,
  tokenSymbol,
  tokenUri,
});
```

the `src/index.ts` file should look like this
```ts 
import { clusterApiUrl, Connection } from '@solana/web3.js';
import { initializeKeypair, uploadOffChainMetadata } from './helpers';
import createNFTWithMetadataPointer from './nft-with-metadata-pointer';
import createNFTWithEmbeddedMetadata from './nft-with-embedded-metadata';

async function main() {
  const connection = new Connection(clusterApiUrl('devnet'), 'finalized');

  const payer = await initializeKeypair(connection, '~/.config/solana/id.json');

  const imagePath = 'cat.jpg';
  const tokenName = 'Cat NFT';
  const tokenDescription = 'This is a cat';
  const tokenSymbol = 'EMB';

  const tokenUri = await uploadOffChainMetadata({
    connection,
    payer,
    tokenName,
    tokenDescription,
    tokenSymbol,
    imagePath,
  });

  await createNFTWithMetadataPointer({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });

  await createNFTWithEmbeddedMetadata({
    payer,
    connection,
    tokenName,
    tokenSymbol,
    tokenUri,
  });
}

main()
  .then(() => {
    console.log('Finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
```





## 5. Run the code for the last time 
```bash
npm run start
```

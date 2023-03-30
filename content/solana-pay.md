---
title: Solana Pay
objectives:
- Use the Solana Pay specification to build payment requests and initiate transactions using URLs encoded as QR codes
- Use the `@solana/pay` library to help with the creation of Solana Pay transaction requests
- Partially sign transactions and implement transaction gating based on certain conditions
---

# TL;DR

-   **Solana Pay** is a specification for encoding Solana transaction requests within URLs, enabling standardized transaction requests across different Solana apps and wallets
-   **Partial signing** of transactions allows for the creation of transactions that require multiple signatures before they are submitted to the network
-   **Transaction gating** involves implementing rules that determine whether certain transactions are allowed to be processed or not, based on certain conditions or the presence of specific data in the transaction

# Overview

The Solana community is continually improving and expanding the network's functionality. But that doesn't always mean developing brand new technology. Sometimes it means leveraging the network's existing features in new and interesting ways.

Solana Pay is a great example of this. Rather than add new functionality to the network, Solana Pay uses the network's existing signing features in a unique way to enable merchants and applications to request transactions and build gating mechanisms for specific transaction types.

Throughout this lesson, you'll learn how to use Solana Pay to create transfer and transaction requests, encode these requests as a QR code, partially sign transactions, and gate transactions based on conditions you choose. Rather than leaving it at that, we hope you'll see this as an example of leveraging existing features in new and interesting ways, using it as a launching pad for your own unique client-side network interactions.

## Solana Pay

The [Solana Pay specification](https://docs.solanapay.com/spec) is a set standards that allow users to request payments and initiate transactions using URLs in a uniform way across various Solana apps and wallets.

Request URLs are prefixed with `solana:` so that platforms can direct the link to the appropriate application. For example, on mobile a URL that starts with `solana:` will be directed to wallet applications that support the Solana Pay specification. From there, the wallet can use the remainder of the URL to appropriately handle the request.

There are two types of requests defined by the Solana Pay specification:

1. Transfer Request: used for simple SOL or SPL Token transfers
2. Transaction Request: used to request any type of Solana transaction

### Transfer requests

The transfer request specification describes a non-interactive request for SOL or SPL token transfer. Transfer request URLs take the following format `solana:<recipient>?<optional-query-params>`.

The value of `recipient` is required and must be a base58-encoded public key of the account from which a transfer is being requested. Additionally, the following optional query parameters are supported:

- `amount` - a non-negative integer or decimal value indicating the amount of tokens to transfer
- `spl-token` - a base58-encoded public key of an SPL Token mint account if the transfer is of an SPL token and not SOL
- `reference` - optional reference values as base58-encoded 32 byte arrays. This can be used by a client for identifying the transaction on-chain since the client will not have a transaction's signature.
- `label` - a URL-encoded UTF-8 string that describes the source of the transfer request
- `message` - a URL-encoded UTF-8 string that describes the nature of the transfer request
- `memo` - a URL-encoded UTF-8 string that must be included in the SPL memo instruction in the payment transaction

By way of example, here is a URL describing a transfer request for 1 SOL:

```text
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish&memo=OrderId12345
```

And here is a URL describing a transfer request for 0.1 USDC:

```text
solana:mvines9iiHiQTysrwkJjGf2gb9Ex9jXJX8ns3qwf2kN?amount=0.01&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

### Transaction requests

The Solana Pay transaction request is similar to a transfer request in that it is simply a URL that can be consumed by a supporting wallet. However, this request is interactive and the format is more open-ended:

```text
solana:<link>
```

The value of `link` should be a URL to which the consuming wallet can make an HTTP request. Rather than containing all the information needed for a transaction, a transaction request uses this URL to fetch the transaction that should be presented to the user.

When a wallet receives a transaction Request URL, four things happen:

1. The wallet sends a GET request to the application at the provided `link` URL to retrieve a label and icon image to display to the user.
2. The wallet then sends a POST request with the public key of the end user.
3. Using the public key of the end user (and any additional information provided in `link`), the application then builds the transaction and responds with a base64-encoded serialized transaction.
4. The wallet decodes and deserializes the transaction, then lets the user sign and send the transaction.

Given that transaction requests are more involved than transfer requests, the remainder of this lesson will focus on creating transaction requests.

## Create a transaction request

### Define the API endpoint

The main thing you, the developer, need to do to make the transaction request flow work is set up a REST API endpoint at the URL you plan to include in the transaction request. In this lesson, we'll be using [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction) for our endpoints, but you're welcome to use whatever stack and tools you're most comfortable with.

In Next.js, you do this by adding a file to the `pages/api` folder and exporting a function that handles the request and response.

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    // Handle the request
}
```

### Handle a GET request

The wallet consuming your transaction request URL will first issue a GET request to this endpoint. You'll want your endpoint to return a JSON object with two fields:

1. `label` - a string that describes the source of the transaction request
2. `icon`- a URL to an image that can be displayed to the user

Building on the empty endpoint from before, that may look like this:

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method === "GET") {
        return get(res)
    } else {
        return res.status(405).json({ error: "Method not allowed" })
    }
}

function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Store Name",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

When the wallet makes a GET request to the API endpoint, the `get` function is called, returning a response with a status code of 200 and the JSON object containing `label` and `icon`.

### Handle a POST request and build the transaction

After issuing a GET request, the wallet will issue a POST request to the same URL. Your endpoint should expect the POST request's `body` to contain a JSON object with an `account` field provided by the requesting wallet. The value of `account` will be a string representing the end user's public key.

With this information and any additional parameters provided, you can build the transaction and return it to the wallet for signing by:

1. Connecting to the Solana network and getting the latest `blockhash`.
2. Creating a new transaction using the `blockhash`.
3. Adding instructions to the transaction
4. Serializing the transaction and returning it in a `PostResponse` object along with a message for the user.

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
) {
    if (req.method === "GET") {
        return get(res)
    } else if (req.method === "POST") {
        return post(req, res)
    } else {
        return res.status(405).json({ error: "Method not allowed" })
    }
}

function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Store Name",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
async function post(
    req: PublicKey,
    res: PublicKey,
) {
    const { account, reference } = req.body

    const connection = new Connection(clusterApiUrl("devnet"));

    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: account,
    });

    const instruction = SystemProgram.transfer({
        fromPubkey: account,
        toPubkey: Keypair.generate().publicKey,
        lamports: 0.001 * LAMPORTS_PER_SOL,
    });

    transaction.add(instruction);

    transaction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    })

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");

    const message = "Simple transfer of 0.001 SOL";

    res.send(200).json({
        transaction: base64,
        message,
    })
}
```

There is nothing too out of the ordinary here. It's the same transaction construction you would use in a standard client-side application. The only difference is that instead of signing and submitting to the network, you send the transaction as a base64-encoded string back in the HTTP response. The wallet that issued the request can then present the transaction to the user for signing.

### Confirm transaction

You may have noticed that the previous example assumed a `reference` was provided as a query parameter. While this is *not* a value provided by the requesting wallet, it *is* useful to set up your initial transaction request URL to contain this query parameter.

Since your application isn't the one submitting a transaction to the network, your code won't have access to a transaction signature. This would typically be how your app can locate a transaction on the network and see its status.

To get around this, you can include a `reference` value as a query parameter for each transaction request. This value should be a base58-encoded 32 byte array that can be included as a non-signer key on the transaction. This allows your app to then use the `getSignaturesForAddress` RPC method to locate the transaction. Your app can then tailor its UI according to a transaction's status.

If you use the `@solana/pay` library, you can use the `findReference` helper function instead of using `getSignaturesForAddress` directly.

## Gated transactions

We've mentioned before how Solana Pay is an example of being able to do cool new things with the network by getting creative with existing functionality. Another small example of doing this within the Solana Pay umbrella is to only make certain transactions available once certain conditions are met.

Since you control the endpoint building the transaction, you can determine what criteria must be met before a transaction is built. For example, you can use the `account` field provided in the POST request to check if the end user holds an NFT from a particular collection or if that public key is on a predetermined list of accounts who can make this particular transaction.

```typescript
// retrieve array of nfts owned by the given wallet
const nfts = await metaplex.nfts().findAllByOwner({ owner: account }).run();

// iterate over the nfts array
for (let i = 0; i < nfts.length; i++) {
    // check if the current nft has a collection field with the desired value
    if (nfts[i].collection?.address.toString() == collection.toString()) {
        // build transaction
    } else {
        // return an error
    }
}
```

### Partial Signing

If you want certain transactions behind some kind of gating mechanism, that functionality will have to be enforced on-chain as well. Returning an error from your Solana Pay endpoint makes it more difficult for end users to do the transaction, but they could still build it manually.

What this means is that the instruction(s) being called should require some type of "admin" signature that only your application can provide. In doing that, however, you'll have made it so that our previous examples don't work. The transaction is built and sent to the requesting wallet for the end user's signature, but the submitted transaction will fail without the admin signature.

Fortunately, Solana enables signature composability with partial signing.

Partially signing a multi-signature transaction allows signers to add their signature before the transaction is broadcast on the network. This can be useful in a number of situations, including:

-   Approving transactions that require the signature of multiple parties, such as a merchant and a buyer who need to confirm the details of a payment.
-   Invoking custom programs that require the signatures of both a user and an administrator. This can help to limit access to the program instructions and ensure that only authorized parties can execute them.

```typescript
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

const transaction = new Transaction({
  feePayer: account,
  blockhash,
  lastValidBlockHeight,
})

...

transaction.partialSign(adminKeypair)
```

The `partialSign` function is used to add a signature to a transaction without overriding any previous signatures on the transaction. If you are building a transaction with multiple signers, it is important to remember that if you don't specify a transaction's `feePayer`, the first signer will be used as the fee payer for the transaction. To avoid any confusion or unexpected behavior, make sure to explicitly set the fee payer when necessary.

In our example of only allowing a transaction request to go through when the end user has a specific NFT, you would simply add your admin signature to the transaction using `partialSign` before encoding the transaction as a base64-encoded string and issuing the HTTP response.

## Solana Pay QR codes

One of the standout features of Solana Pay is its easy integration with QR codes. Since transfer and transaction requests are simply URLs, you can embed them into QR codes that you make available in your application or elsewhere.

The `@solana/pay` library simplifies this with the provided `createQR` helper function. This function needs you to provide the following:

- `url` - the url of the transaction request.
- `size` (optional) - the width and height of the QR code in pixels. Defaults to 512.
- `background` (optional) - the background color. Defaults to white.
- `color` (optional) - the foreground color. Defaults to black.

```typescript
const qr = createQR(url, 400, 'transparent')
```

# Demo

Now that you've got a conceptual grasp on Solana Pay, let's put it into practice. We'll use Solana Pay to generate a series of QR codes for a scavenger hunt. Participants must visit each scavenger hunt location in order. At each location, they'll use the provided QR code to submit the appropriate transaction to the scavenger hunt's smart contract that keeps track of user progress.

### 1. Starter

To get started, download the starter code on the `starter` branch of this [repository](https://github.com/Unboxed-Software/solana-scavenger-hunt-app/tree/starter). The starter code is a Next.js app that displays a Solana Pay QR code. Notice that the menu bar lets you switch between different QR codes. The default option is a simple SOL transfer for illustrative purposes. Throughout  We'll be adding functionality to the location options in the menu bar.

![Screenshot of scavenger hunt app](../assets/scavenger-hunt-screenshot.png)

To do this, we'll be creating a new endpoint for a transaction request that builds a transaction for invoking an Anchor program on Devnet. This program has been made specifically for this "scavenger hunt" app and has two instructions: `initialize` and `check_in`. The `initialize` instruction is used to set up the user's state, while the `check_in` instruction is used to record a check-in at a location in the scavenger hunt. We won't be making any changes to the program in this demo, but feel free to check out the [source code](https://github.com/Unboxed-Software/anchor-scavenger-hunt) if you'd like to familiarize yourself with the program.

Before moving on, make sure you get familiar with the starter code for the Scavenger Hunt app. Looking at `pages/index.tsx`, `utils/createQrCode/simpleTransfer`, and `/utils/checkTransaction` will let you see how the transaction request for sending SOL is set up. We'll be following a similar pattern for the transaction request for checking in at a location.

### 2. Setup

Before we move forward, let's make sure you can run the app locally. Start by renaming the `.env.example` file in the frontend directory to `.env`. This file contains a keypair that will be used in this demo to partially sign transactions.

Next, install dependencies with `yarn`, then use `yarn dev` and open your browser `localhost:3000` (or the port indicated in the console if 3000 was already in use).

Now, if you try to scan the QR code shown on the page from your mobile device, you'll get an error. That's because the QR code is set up to send you to your computer's `localhost:3000`, which isn't an address your phone can get to. Further, Solana Pay needs to use an HTTPS URL to work.

To get around this, you can use [ngrok](https://ngrok.com/). You'll need to install it if you haven't used it before. Once it's installed, run the following command in your terminal, replacing `3000` with whichever port you're using for this project:

```bash
ngrok http 3000
```

This will provide you with a unique URL that you can use to access your local server remotely. The output will look something like this:

```bash
Session Status                online
Account                       your_email@gmail.com (Plan: Free)
Update                        update available (version 3.1.0, Ctrl-U to update)
Version                       3.0.6
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://7761-24-28-107-82.ngrok.io -> http://localhost:3000
```

Now, open the HTTPS ngrok URL shown in your console in the browser (e.g. https://7761-24-28-107-82.ngrok.io). This will allow you to scan QR codes from your mobile device while testing locally.

At the time of writing, this demo works best with Solflare. Some wallets will display an incorrect warning message when scanning a Solana Pay QR code. Regardless of the wallet you use, make sure you switch to devnet in the wallet. Then scan the QR code on the home page labeled “SOL Transfer”. This QR code is a reference implementation for a transaction request that performs a simple SOL transfer. It also calls the `requestAirdrop` function to fund your mobile wallet with Devnet SOL since most people don't have Devnet SOL available for testing.

If you were able to successfully execute the transaction using the QR code, you're good to move on!

### 3. Create a check-in transaction request endpoint

Now that you're up and running, it's time to create an endpoint that supports transaction requests for location check-in using the Scavenger Hunt program.

Start by opening the file at `pages/api/checkIn.ts`. Notice that it has a helper function for initializing `eventOrganizer` from a private key environment variable.  The first thing we'll do in this file is the following:

1. Export a `handler` function to handle an arbitrary HTTP request
2. Add `get` and `post` functions for handling those HTTP methods
3. Add logic to the body of the `handler` function to either call `get`, `post`, or return a 405 error based on the HTTP request method

```typescript
import { NextApiRequest, NextApiResponse } from "next"

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method === "GET") {
        return get(res)
    } else if (req.method === "POST") {
        return await post(req, res)
    } else {
        return res.status(405).json({ error: "Method not allowed" })
    }
}

function get(res: NextApiResponse) {}

async function post(req: NextApiRequest, res: NextApiResponse) {}
```

### 4. Update `get` function

Remember, the first request from a wallet will be a GET request expecting the endpoint to return a label and icon. Update the `get` function to send a response with a "Scavenger Hunt!" label and a Solana logo icon.

```jsx
function get(res: NextApiResponse) {
    res.status(200).json({
        label: "Scavenger Hunt!",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

### 5. Update `post` function

After the GET request, a wallet will issue a POST request to the endpoint. The request's `body` will contain a JSON object with an `account` field representing the end user's public key.

Additionally, the query parameters will contain whatever you encoded into the QR code. If you take a look at `utils/createQrCode/checkIn.ts`, you'll notice that this particular app includes parameters for `reference` and `id` as the following:

1. `reference` - a randomly generated public key used to identify the transaction
2. `id` - the location id as an integer

Go ahead and update the `post` function to extract `account`, `reference`, and `id` from the request. You should respond with an error if any of these is missing.

Next, add a `try catch` statement where the `catch` block responds with an error and the `try` block calls out to a new function `buildTransaction`. If `buildTransaction` is successful, respond with a 200 and a JSON object with the transaction and a message that the user has found the given location. Don't worry about the logic for the `buildTransaction` function just yet - we'll do that next.

Note that you'll need to import `PublicKey` and `Transaction` from `@solana/web3.js` here as well.

```typescript
import { NextApiRequest, NextApiResponse } from "next"
import { PublicKey, Transaction } from "@solana/web3.js"
...

async function post(req: NextApiRequest, res: NextApiResponse) {
    const { account } = req.body
    const { reference, id } = req.query

    if (!account || !reference || !id) {
        res.status(400).json({ error: "Missing required parameter(s)" })
        return
    }

    try {
        const transaction = await buildTransaction(
            new PublicKey(account),
            new PublicKey(reference),
            id.toString()
        )

        res.status(200).json({
            transaction: transaction,
            message: `You've found location ${id}!`,
        })
    } catch (err) {
        console.log(err)
        let error = err as any
        if (error.message) {
            res.status(200).json({ transaction: "", message: error.message })
        } else {
            res.status(500).json({ error: "error creating transaction" })
        }
    }
}

async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
    id: string
): Promise<string> {
    return new Transaction()
}
```

### 6. Implement the `buildTransaction` function

Next, let’s implement the `buildTransaction` function. It should build, partially sign, and return the check-in transaction. The sequence of items it needs to perform is:

1. Fetch the user state
2. Use the `locationAtIndex` helper function and the location id to get a Location object
3. Verify that the user is at the correct location
4. Get the current blockhash and last valid block height from the connection
5. Create a new transaction object
6. Add an initialize instruction to the transaction if user state does not exist
7. Add a check-in instruction to the transaction
8. Add the `reference` public key to the check-in instruction
9. Partially sign the transaction with the event organizer's keypair
10. Serialize the transaction with base64 encoding and return the transaction

While each of these steps is straightforward, it's a lot of steps. To simplify the function, we're going to create empty helper functions that we'll fill in later for steps 1, 3, 6, and 7-8. We'll call these `fetchUserState`, `verifyCorrectLocation`, `createInitUserInstruction`, and `createCheckInInstruction`, respectively.

We'll also add the following imports:

```typescript
import { NextApiRequest, NextApiResponse } from "next"
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
import { locationAtIndex, Location, locations } from "../../utils/locations"
import { connection, gameId, program } from "../../utils/programSetup"
```

Using the empty helper functions and the new imports, we can fill in the `buildTransaction` function:

```typescript
async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
    id: string
): Promise<string> {
    const userState = await fetchUserState(account)

    const currentLocation = locationAtIndex(new Number(id).valueOf())

    if (!currentLocation) {
        throw { message: "Invalid location id" }
    }

    if (!verifyCorrectLocation(userState, currentLocation)) {
        throw { message: "You must visit each location in order!" }
    }

    const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash()

    const transaction = new Transaction({
        feePayer: account,
        blockhash,
        lastValidBlockHeight,
    })

    if (!userState) {
        transaction.add(await createInitUserInstruction(account))
    }

    transaction.add(
        await createCheckInInstruction(account, reference, currentLocation)
    )

    transaction.partialSign(eventOrganizer)

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    })

    const base64 = serializedTransaction.toString("base64")

    return base64
}

interface UserState {
    user: PublicKey
    gameId: PublicKey
    lastLocation: PublicKey
}

async function fetchUserState(account: PublicKey): Promise<UserState | null> {
    return null
}

function verifyCorrectLocation(
    userState: UserState | null,
    currentLocation: Location
): boolean {
    return false
}

async function createInitUserInstruction(
    account: PublicKey
): Promise<TransactionInstruction> {
    throw ""
}

async function createCheckInInstruction(
    account: PublicKey,
    reference: PublicKey,
    location: Location
): Promise<TransactionInstruction> {
    throw ""
}
```

### 7. Implement `fetchUserState` function

With the `buildTransaction` function finished, we can start implementing the empty helper functions we created, starting with `fetchUserState`. This function uses the `gameId` and user's `account` to derive the user state PDA, then fetches that account, returning null if it doesn't exist.

```typescript
async function fetchUserState(account: PublicKey): Promise<UserState | null> {
    const userStatePDA = PublicKey.findProgramAddressSync(
        [gameId.toBuffer(), account.toBuffer()],
        program.programId
    )[0]

    try {
        return await program.account.userState.fetch(userStatePDA)
    } catch {
        return null
    }
}
```

### 8. Implement `verifyCorrectLocation` function

Next, let’s implement the `verifyCorrectLocation` helper function. This function is used to verify that a user is at the correct location in a scavenger hunt game.

If `userState` is `null`, that means the user should be visiting the first location. Otherwise, the user should be visiting the location whose index is 1 more than their last visited location.

If these conditions are satisfied, the function will return true. Otherwise, it'll return false.

```typescript
function verifyCorrectLocation(
    userState: UserState | null,
    currentLocation: Location
): boolean {
    if (!userState) {
        return currentLocation.index === 1
    }

    const lastLocation = locations.find(
        (location) => location.key.toString() === userState.lastLocation.toString()
    )

    if (!lastLocation || currentLocation.index !== lastLocation.index + 1) {
        return false
    } else {
        return true
    }
}
```

### 9. Implement the instruction creation functions

Lastly, let's implement `createInitUserInstruction` and `createCheckInInstruction`. These can use Anchor to generate and return the corresponding instructions. The only catch is that `createCheckInInstruction` needs to add `reference` to the instructions list of keys.

```typescript
async function createInitUserInstruction(
    account: PublicKey
): Promise<TransactionInstruction> {
    const initializeInstruction = await program.methods
        .initialize(gameId)
        .accounts({ user: account })
        .instruction()

    return initializeInstruction
}

async function createCheckInInstruction(
    account: PublicKey,
    reference: PublicKey,
    location: Location
): Promise<TransactionInstruction> {
    const checkInInstruction = await program.methods
        .checkIn(gameId, location.key)
        .accounts({
            user: account,
            eventOrganizer: eventOrganizer.publicKey,
        })
        .instruction()

    checkInInstruction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    })

    return checkInInstruction
}
```

### 10. Test the app

At this point your app should be working! Go ahead and test it using your mobile wallet. Start by scanning the QR code for `Location 1`. Remember to make sure your frontend is running using the ngrok URL rather than `localhost`.

After scanning the QR code, you should see a message indicating that you are at location 1. From there, scan the QR code on the `Location 2` page. You may need to wait a few seconds for the previous transaction to finalize before continuing.

Congratulations, you have successfully finished the scavenger hunt demo using Solana Pay! Depending on your background, this may not feel intuitive or straightforward. If that's the case, feel free to go through the demo again or make something on your own. Solana Pay opens a lot of doors for bridging the gap between real life and on-chain interaction.

If you want to take a look at the final solution code you can find it on the solution branch of [the same repository](https://github.com/Unboxed-Software/solana-scavenger-hunt-app/tree/solution).

# Challenge

It's time to try this out on your own. Feel free to build out an idea of your own using Solana Pay. Or, if you need some inspiration, you can use the prompt below.

Build out an app using Solana Pay (or modify the one from the demo) to mint an NFT to users. To take it up a notch, only make the transaction possible if the user meets one or more conditions (e.g. holds an NFT from a specific collection, is already on a pre-determined list, etc.).

Get creative with this! The Solana pay spec opens up a lot of doors for unique use cases.
# Solana Pay

# Lesson Objectives

_By the end of this lesson, you will be able to:_

-   Describe the composability of Solana transactions and how it can be leveraged using Solana Pay
-   Explain the Solana Pay specification for building transaction requests
-   Use the Solana Pay specification to build transaction requests with instructions from an Anchor program
-   Using a server to build and partially sign transaction requests
-   Implement gating for certain transactions based on certain conditions

# TL;DR

-   Composability of Solana transactions allows for the ability to combine multiple instructions from various programs in a single transaction
-   **Solana Pay** is a specification for encoding Solana transaction requests withing URLs

# Overview

Client-side development is a key aspect of creating Solana apps that provide a great user experience. Solana's composable instructions allow developers to construct complex transactions using instructions from various programs.

In this lesson, we will explore how developers can use the Solana Pay specification to creatively incorporate unique features into their app through client-side development. The Solana Pay specification enables the encoding of transactions in URLs for various use cases, allowing developers to leverage the composability of transactions in innovative ways.

## Solana Pay

reference - [https://github.com/ZYJLiu/solana-pay-basic-setup](https://github.com/ZYJLiu/anchor-solana-pay-demo)

Solana Pay is a set of standards that enables users to request payments and execute transactions using URLs in a consistent manner across various Solana apps and wallets.

There are two types of requests defined by the Solana Pay specification:

1. Transfer Request: used for non-interactive SOL or SPL Token transfers.
2. Transaction Request: used for interactive requests for any type of Solana transaction.

In this lesson, we will focus on the Transaction Request, which enables developers to build a wide range of transactions.

### Solana Pay transaction request

The Solana Pay transaction request allows a wallet to request and execute any type of Solana transaction using a standardized URL.

When a wallet receives a Transaction Request URL:

-   The wallet sends a GET request to the URL to retrieve a label and icon image to display to the user.
-   The wallet then sends a POST request with the public key of the account that will sign the transaction.
-   The application responds with a base64-encoded serialized transaction.
-   The wallet decodes and deserializes the transaction, signs it with the provided account, and submits it to the Solana network.

### Define API responses

To set up an API for a Solana Pay transaction request, the first step is to define the possible responses of the API endpoint and the request body for the POST request.

```jsx
type InputData = {
  account: string
}

type GetResponse = {
  label: string
  icon: string
}

export type PostResponse = {
  transaction: string
  message: string
}

export type PostError = {
  error: string
}
```

InputData is an object that represents the request body for the POST request. It has a single field called "account", which is a string representing the public key returned by the wallet scanning a QR code.

GetResponse is an object that represents the response to the GET request. It has two fields: "label", a string describing the source of the transaction request, and "icon", a string representing an absolute HTTP or HTTPS URL of an icon image.

PostResponse is an object that represents the response to the POST request. It has two fields: "transaction", a string representing a base64-encoded serialized transaction, and "message", a string containing any additional information about the transaction.

PostError is an object that represents the response to the POST request when an error occurs. It has a single field called "error", which is a string containing an error message.

### Define API endpoint

To set up an API endpoint for a Solana Pay transaction request, you need to define a function that handles requests from a wallet. This function will have two parameters: a request object and a response object. The request object contains information about the request made by the wallet, such as the HTTP method (GET or POST) and the request body (for POST requests). The response object is used to send a response back to the wallet.

The API endpoint function will check the HTTP method of the request. If it is a GET request, it will call a separate function called **`get`** to handle the request and send a response containing a label and icon image. If it is a POST request, it will call another function called **`post`** to handle the request and send a response with a base64-encoded serialized transaction.

```jsx
// API endpoint
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<GetResponse | PostResponse | PostError>,
) {
    if (req.method === "GET") {
        return get(res);
    } else if (req.method === "POST") {
        return await post(req, res);
    } else {
        return res.status(405).json({ error: "Method not allowed" });
    }
}
```

### GET requests

To handle GET requests to the API endpoint, define a function called **`get`** which takes in a **`NextApiResponse`** object and returns a JSON object with two fields: "label" and "icon".

The "label" field is a string that describes the source of the transaction request, and the "icon" field is a string representing an absolute URL of an image file.

When the wallet makes a GET request to the API endpoint, this function is called and sends a response with a 200 status code and the JSON object containing the label and icon to be displayed to the user.

```jsx
// "res" is Text and Image that displays when wallet first scans
function get(res: NextApiResponse<GetResponse>) {
    res.status(200).json({
        label: "Store Name",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

### POST requests

To set up the function that handles POST requests to the API endpoint, you need to define a function called **`post`**. This function takes in two parameters: a **`NextApiRequest`** object and a **`NextApiResponse`** object. It returns a JSON object with either a "transaction" field or an "error" field.

The function starts by destructuring the "account" field from the request body and storing it in a constant called "account". This "account" field represents the public key of the wallet that is interacting with the transaction request.

The function then destructures the "reference" field from the query string and stores it in a constant called "reference". This "reference" field is a random public key that is generated to uniquely identify each transaction.

After destructuring these fields, the function calls an async helper function called **`buildTransaction`** with "account" and "reference" as arguments. This helper function is responsible for building the transaction using the provided account and reference. We'll discuss this helper function in more detail in the next step.

```jsx
async function post(
  req: NextApiRequest,
  res: NextApiResponse<PostResponse | PostError>
) {
  const { account } = req.body as InputData
  if (!account) {
    res.status(400).json({ error: "No account provided" })
    return
  }

  const { reference } = req.query
  if (!reference) {
    res.status(400).json({ error: "No reference provided" })
    return
  }

  try {
    const postResponse = await buildTransaction(
      new PublicKey(account),
      new PublicKey(reference)
    )
    res.status(200).json(postResponse)
    return
  } catch (error) {
    res.status(500).json({ error: "error creating transaction" })
    return
  }
}
```

### Build transaction

The **`buildTransaction`** function creates a Solana transaction using the provided **`account`** and **`reference`** public keys. It does this by:

-   Connecting to the Solana network and getting the latest blockhash.
-   Creating a new transaction using the blockhash.
-   Adding instructions to the transaction, including the **`reference`** public key as a non-signer key to uniquely identify the transaction.
-   Serializing the transaction and returning it in a **`PostResponse`** object along with a message for the user.

This function is responsible for constructing and returning a Solana transaction as a **`PostResponse`**. It follows the usual process for building a Solana transaction.

```jsx
// build the transaction
async function buildTransaction(
    account: PublicKey,
    reference: PublicKey,
): Promise<PostResponse> {
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

    instruction.keys.push({
        pubkey: reference,
        isSigner: false,
        isWritable: false,
    });

    transaction.add(instruction);

    const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
    });
    const base64 = serializedTransaction.toString("base64");

    const message = "Message To User Before Approving Transaction Here";

    return {
        transaction: base64,
        message,
    };
}
```

### Gated transactions

The public key provided in the request body can be used to perform any necessary checks. For example, you could use this key to determine if the account owns a specific NFT from a particular collection, or if it is on a predetermined white list of accounts. This information can be used to gate transactions, allowing only certain accounts to perform certain actions.

### Partial Signing

Partially signing a multi-signature transaction allows signers to add their signature before the transaction is broadcast on the network.

This can be useful in the following situations:

-   Approving transactions that require the signature of multiple parties, such as a merchant and a buyer who need to confirm the details of a payment.
-   Invoking custom programs that require the signatures of both a user and an administrator. This can help to limit access to the program instructions and ensure that only authorized parties can execute them.

Partially signing a transaction can be a useful way to manage the process of completing a multi-signature transaction, as it allows different parties to contribute their signatures as needed.

```jsx
const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()

const transaction = new Transaction({
  feePayer: account,
  blockhash,
  lastValidBlockHeight,
})

...

transaction.partialSign(Keypair)
```

If you are building a transaction with multiple signers, it is important to remember that if you don't specify a Transaction `feePayer`, the first signer will be used as the fee payer for the transaction. To avoid any confusion or unexpected behavior, make sure to explicitly set the fee payer when necessary.

### Create Solana Pay transaction request encoded QR code

To generate a QR code for a Solana Pay Transaction Request:

Use the Solana Pay API

In your component:

-   Generate a new keypair to use as the reference public key for the transaction
-   Establish a connection to a Solana cluster
-   Create a reference to a div element to store the QR code
-   Return the div element with the qrRef reference

Note: A new reference is generated each time a new transaction is created. The reference public key is added to the transaction to uniquely identify it.

```jsx
import {
  createQR,
  encodeURL,
  findReference,
  FindReferenceError,
  TransactionRequestURLFields,
} from "@solana/pay"
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js"
import { useEffect, useRef, useState } from "react"

export default function Home() {
  const [reference, setReference] = useState(Keypair.generate().publicKey)
  const connection = new Connection(clusterApiUrl("devnet"))
  const qrRef = useRef<HTMLDivElement>(null)

	...

  return <div ref={qrRef} />
}
```

### Create Solana Pay transaction request encoded QR code

The **`updateQRCode`** function generates a QR code for a Solana Pay Transaction Request. It does this by:

-   Getting the current URL of the webpage and creating a **`URLSearchParams`** object to store query parameters
-   Appending the provided **`reference`** public key as a query parameter to the search parameters and adding it to the end of the API URL
-   Creating a **`TransactionRequestURLFields`** object with the API URL as the **`link`** field and using the **`encodeURL`** function to encode it into a Solana Pay URL
-   Using the **`createQR`** function to create a QR code from the Solana Pay URL

The **`useEffect`** hook updates the QR code every time the **`reference`** public key changes by calling the **`updateQRCode`** function and passing in the **`reference`** public key as an argument. The QR code is then set on the **`qrRef`** element by clearing its inner HTML and appending the new QR code to it.

```jsx
const updateQRCode = (reference: PublicKey) => {
    // location contains information about the current URL of the webpage
    const { location } = window;

    // Create URL Search Params
    const params = new URLSearchParams();

    // Append "reference" publickey, used to identify transaction for confirmation
    params.append("reference", reference.toString());
    console.log(reference.toString(), "new reference");

    // Custom Transaction Request API GetResponse
    // Included params to end of URL
    const apiUrl = `${location.protocol}//${
        location.host
    }/api/checkout?${params.toString()}`;

    // Fields of a Solana Pay transaction request URL
    const urlFields: TransactionRequestURLFields = {
        link: new URL(apiUrl),
    };

    // Encode a Solana Pay URL
    const url = encodeURL(urlFields);

    // Create a QR code from a Solana Pay URL
    const qr = createQR(url, 400, "transparent");

    // Set the generated QR code on the QR ref element
    if (qrRef.current) {
        // Clear the inner HTML content of the element, removing any HTML code that was previously contained within it
        qrRef.current.innerHTML = "";
        // Appends the new qr code to the element
        qr.append(qrRef.current);
    }
};

useEffect(() => {
    updateQRCode(reference);
}, [reference]);
```

### Create Solana Pay transaction request encoded QR code

The **`checkTransaction`** function checks if a transaction that includes the given **`reference`** public key has been confirmed on the Solana network. It does this by calling the **`findReference`** function, which sends a request to the Solana network and looks for a transaction that includes the **`reference`** public key and has a finality of "confirmed". If such a transaction is found, the function generates a new **`reference`** public key using the **`Keypair.generate`** function and displays an alert to the user.

The **`useEffect`** hook is used to set up an interval to continuously call the **`checkTransaction`** function every 1.5 seconds. When the component unmounts, the interval is cleared using the **`clearInterval`** function. This allows the component to continually check for confirmed transactions and display an alert to the user if one is found.

```jsx
const checkTransaction = async () => {
    try {
        // Check for transactions including the reference public key
        const confirmedSignatureInfo = await findReference(
            connection,
            reference,
            {
                finality: "confirmed",
            },
        );
        // If a transaction is confirmed, generate a new reference and display an alert
        setReference(Keypair.generate().publicKey);
        console.log(reference.toString(), "confirmed");
        window.alert("Transaction Confirmed");
        return;
    } catch (e) {
        // If current reference not found, ignore error
        if (e instanceof FindReferenceError) {
            console.log("Not Confirmed");
            return;
        }
        console.error("Unknown error", e);
    }
};

useEffect(() => {
    // Start an interval to check for confirmed transaction
    const interval = setInterval(checkTransaction, 1500);
    return () => {
        // Clear the interval when the component unmounts
        clearInterval(interval);
    };
}, [reference]);
```

# Demo

draft - [https://github.com/ZYJLiu/anchor-solana-pay-demo](https://github.com/ZYJLiu/anchor-solana-pay-demo)

Scavenger hunt or other event where participants need to visit a series of locations in a specific order.

### 1. Starter

-   “scavenger hunt” anchor program given
-   explain frontend starter
-   starter includes simple SOL transfer as for reference (also includes requestAirdrop to fund a mobile wallet)
-   go over utils (anchor setup, checktransaction, generate location list)

### 2. location page

```jsx
import { Flex, Heading, VStack } from "@chakra-ui/react"
import { useRouter } from "next/router"
import { Keypair } from "@solana/web3.js"
import { useEffect, useRef, useState } from "react"
import { createQRCode } from "../../utils/createQrCode/checkIn"
import { checkTransaction } from "../../utils/checkTransaction"

const QrCodePage = () => {
  // Get the `id` parameter from the URL
  const router = useRouter()
  const { id } = router.query

  // Create a ref to the QR code element and a state variable for the reference
  const qrRef = useRef<HTMLDivElement>(null)
  const [reference, setReference] = useState(Keypair.generate().publicKey)

  // Create the QR code when the `id` parameter or `reference` changes
  useEffect(() => {
    createQRCode(qrRef, reference, id as string)
  }, [reference])

  // Periodically check the transaction status and reset the `reference` state variable once confirmed
  useEffect(() => {
    // Set an interval to check the transaction status every 1.5 seconds
    const interval = setInterval(() => {
      checkTransaction(reference, setReference)
    }, 1500)

    // Clear the interval when the component unmounts
    return () => {
      clearInterval(interval)
    }
  }, [reference])

  return (
    <VStack justifyContent="center">
      <Heading>Location {id}</Heading>
      <Flex ref={qrRef} />
    </VStack>
  )
}

export default QrCodePage
```

### 3. Generate location check-in QRCode

```jsx
import { createQR, encodeURL, TransactionRequestURLFields } from "@solana/pay";
import { PublicKey } from "@solana/web3.js";
import { RefObject } from "react";

export const createQRCode = (
    qrRef: RefObject<HTMLDivElement>,
    reference: PublicKey,
    id: string,
) => {
    // Create a new URLSearchParams object with the `reference` and `id` parameters
    const searchParams = new URLSearchParams([
        ["reference", reference.toString()],
        ["id", id],
    ]);

    // Create a new URL object using the current origin and the API URL with search parameters
    const apiUrl = new URL(
        `/api/checkIn?${searchParams.toString()}`,
        location.origin,
    );

    // Encode the API URL into a QR code
    const urlFields: TransactionRequestURLFields = {
        link: apiUrl,
    };
    const url = encodeURL(urlFields);
    const qr = createQR(url, 400, "transparent");

    // Append the QR code to the element specified by the `qrRef` ref object
    if (qrRef.current) {
        qrRef.current.innerHTML = "";
        qr.append(qrRef.current);
    }
};
```

### 2. Location check-in API

setup

```jsx
import { ScavengerHunt } from "../../idl/scavenger_hunt"
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey"
import { NextApiRequest, NextApiResponse } from "next"
import { Keypair, PublicKey, Transaction } from "@solana/web3.js"
import { connection, program } from "../../utils/anchorSetup"
import { IdlAccounts } from "@project-serum/anchor"
import { locations } from "../../utils/locations"

// Generate a new public key for the game
const gameId = Keypair.generate().publicKey

// Get the event organizer's secret key from the environment variables
const eventOrganizer = JSON.parse(process.env.EVENT_ORGANIZER ?? "") as number[]

// If the event organizer's secret key is not found, throw an error
if (!eventOrganizer) throw new Error("EVENT_ORGANIZER not found")

// Create a Keypair object from the event organizer's secret key
const eventOrganizerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(eventOrganizer)
)

// Declare type aliases for the user state, input data, and responses
type UserState = IdlAccounts<ScavengerHunt>["userState"]

type InputData = {
  account: string
}
type GetResponse = {
  label: string
  icon: string
}
type PostResponse = {
  transaction: string
  message: string
}
type PostError = {
  error: string
}

// API endpoint function
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | PostResponse | PostError>
) {
  // If the request method is "GET", handle the request with the `get` function
  if (req.method === "GET") {
    return get(res)
  }
  // If the request method is "POST", handle the request asynchronously with the `post` function
  else if (req.method === "POST") {
    return await post(req, res)
  }
  // If the request method is not "GET" or "POST", return a "Method not allowed" error
  else {
    return res.status(405).json({ error: "Method not allowed" })
  }
}
```

get request

```jsx
// Handle a "GET" request
function get(res: NextApiResponse<GetResponse>) {
    // Return a "Scavenger Hunt!" label and Solana logo icon in the response
    res.status(200).json({
        label: "Scavenger Hunt!",
        icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
    });
}
```

post request

```jsx
// Handle a "POST" request
async function post(
  req: NextApiRequest,
  res: NextApiResponse<PostResponse | PostError>
) {
  // Get the "account" from the request body
  // Get the "id" and "reference" parameters from the request query string
  const { account } = req.body as InputData
  const { reference, id } = req.query

  // If any of the required parameters are missing, return a "Missing required parameter(s)" error
  if (!account || !reference || !id) {
    res.status(400).json({ error: "Missing required parameter(s)" })
    return
  }

  try {
    // Attempt to build a transaction using the "account", "reference", and "id" parameters
    const postResponse = await buildTransaction(
      new PublicKey(account),
      new PublicKey(reference),
      id.toString()
    )
    // If the transaction is successful, return the response in the API response
    res.status(200).json(postResponse)
    return
  } catch (error) {
    // If an error occurs, return a "error creating transaction" error in the API response
    res.status(500).json({ error: "error creating transaction" })
    return
  }
}
```

buildTransaction helper function

```jsx
// Build and sign a check-in transaction for the scavenger hunt game
async function buildTransaction(
  account: PublicKey,
  reference: PublicKey,
  id: string
): Promise<PostResponse> {
  // Get the latest blockhash and last valid block height from the connection
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()

  // Create a new transaction object
  const transaction = new Transaction({
    feePayer: account,
    blockhash,
    lastValidBlockHeight,
  })

  // Find the current location based on the "id" parameter
  const currentLocation = locations.find(
    (location) => location.id.toString() === id
  )!

  // Fetch the user state or add the "initialize" instruction if necessary
  const userState = await fetchOrInitializeUserState(account, transaction)

  // Verify that the user is at the correct location
  const errorMessage = verifyCorrectLocation(userState, currentLocation)
  if (errorMessage) {
    return errorMessage
  }

  // Check in at the current location
  const checkInInstruction = await program.methods
    .checkIn(gameId, currentLocation.key)
    .accounts({
      user: account,
      eventOrganizer: eventOrganizerKeypair.publicKey,
    })
    .instruction()

  // Add the reference public key to the instruction
  checkInInstruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  })

  // Add the instruction to the transaction
  transaction.add(checkInInstruction)

  // Sign the transaction with the event organizer's keypair
  transaction.partialSign(eventOrganizerKeypair)

  // Serialize the transaction
  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
  })

  // Encode the serialized transaction in base64 and return it along with a message in the API response
  const base64 = serializedTransaction.toString("base64")
  const message = `You've found location ${currentLocation.id}!`

  return {
    transaction: base64,
    message,
  }
}

```

fetchOrInitializeUserState helper function

```jsx
// Fetch the user state or add the "initialize" instruction if necessary
async function fetchOrInitializeUserState(
    account: PublicKey,
    transaction: Transaction,
): Promise<UserState | void> {
    // Calculate the program derived address for the user state account
    const userStatePDA = findProgramAddressSync(
        [gameId.toBuffer(), account.toBuffer()],
        program.programId,
    )[0];

    try {
        // Try to fetch the user state account
        return await program.account.userState.fetch(userStatePDA);
    } catch (e) {
        // If the user state account does not exist, add an "initialize" instruction to the transaction
        const initializeInstruction = await program.methods
            .initialize(gameId)
            .accounts({ user: account })
            .instruction();
        transaction.add(initializeInstruction);
    }
}
```

verifyCorrectLocation helper function

```jsx
// Verify that the user is at the correct location
function verifyCorrectLocation(
    userState: UserState | void,
    currentLocation: any,
): PostResponse | undefined {
    // If userState is undefined
    if (!userState) {
        // Check if current location is first location
        if (currentLocation.id === 1) {
            // If the user is at the first location, return undefined to continue building transaction
            return;
        } else {
            // If the current location is not the first location, return with an error message
            return {
                transaction: "",
                message: "You missed the first location, go back!",
            };
        }
    }

    // If userState is defined, find the last location based on the user state's "lastLocation" field
    const lastLocation = locations.find(
        (location) =>
            location.key.toString() === userState.lastLocation.toString(),
    );

    // If the last location is not found, return an error message
    if (!lastLocation) {
        return {
            transaction: "",
            message: "Unrecognized previous location, where did you go?",
        };
    }

    // If the current location is not immediately following the last location recorded in the user state, return an error message
    if (currentLocation.id !== lastLocation.id + 1) {
        return {
            transaction: "",
            message: "You're at the wrong location, keep looking!",
        };
    }
}
```

# Challenge

_Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently._

1. Challenge instruction one
2. Challenge instruction two

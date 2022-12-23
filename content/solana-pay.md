# Solana Pay

# Lesson Objectives

*By the end of this lesson, you will be able to:*

- Describe the composability of Solana transactions and how it can be leveraged using Solana Pay
- Explain the Solana Pay specification for building transaction requests
- Use the Solana Pay specification to build transaction requests with instructions from an Anchor program
- Using a server to build and partially sign transaction requests
- Implement gating for certain transactions based on certain conditions

# TL;DR

- Composability of Solana transactions allows for the ability to combine multiple instructions from various programs in a single transaction
- **Solana Pay** is a specification for encoding Solana transaction requests withing URLs

# Overview

Client-side development is a key aspect of creating Solana apps that provide a great user experience. Solana's composable instructions allow developers to construct complex transactions using instructions from various programs. 

In this lesson, we will explore how developers can use the Solana Pay specification to creatively incorporate unique features into their app through client-side development. The Solana Pay specification enables the encoding of transactions in URLs for various use cases, allowing developers to leverage the composability of transactions in innovative ways.

## Solana Pay

explain this

```tsx
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

  const updateQRCode = (reference: PublicKey) => {
    // location contains information about the current URL of the webpage
    const { location } = window

    // Create URL Search Params
    const params = new URLSearchParams()

    // Append "reference" publickey, used to identify transaction for confirmation
    params.append("reference", reference.toString())
    console.log(reference.toString(), "new reference")

    // Custom Transaction Request API GetResponse
    // Included params to end of URL
    const apiUrl = `${location.protocol}//${
      location.host
    }/api/checkout?${params.toString()}`

    // Fields of a Solana Pay transaction request URL
    const urlFields: TransactionRequestURLFields = {
      link: new URL(apiUrl),
    }

    // Encode a Solana Pay URL
    const url = encodeURL(urlFields)

    // Create a QR code from a Solana Pay URL
    const qr = createQR(url, 400, "transparent")

    // Set the generated QR code on the QR ref element
    if (qrRef.current) {
      // Clear the inner HTML content of the element, removing any HTML code that was previously contained within it
      qrRef.current.innerHTML = ""
      // Appends the new qr code to the element
      qr.append(qrRef.current)
    }
  }

  useEffect(() => {
    updateQRCode(reference)
  }, [reference])

  const checkTransaction = async () => {
    try {
      // Check for transactions including the reference public key
      const confirmedSignatureInfo = await findReference(
        connection,
        reference,
        {
          finality: "confirmed",
        }
      )
      // If a transaction is confirmed, generate a new reference and display an alert
      setReference(Keypair.generate().publicKey)
      console.log(reference.toString(), "confirmed")
      window.alert("Transaction Confirmed")
      return
    } catch (e) {
      // If current reference not found, ignore error
      if (e instanceof FindReferenceError) {
        console.log("Not Confirmed")
        return
      }
      console.error("Unknown error", e)
    }
  }

  useEffect(() => {
    // Start an interval to check for confirmed transaction
    const interval = setInterval(checkTransaction, 1500)
    return () => {
      // Clear the interval when the component unmounts
      clearInterval(interval)
    }
  }, [reference])

  return <div ref={qrRef} />
}
```

### Create transaction request

then explain this

```tsx
import { NextApiRequest, NextApiResponse } from "next"
import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js"

// Public key of wallet scanning QR code
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

// API endpoint
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetResponse | PostResponse | PostError>
) {
  if (req.method === "GET") {
    return get(res)
  } else if (req.method === "POST") {
    return await post(req, res)
  } else {
    return res.status(405).json({ error: "Method not allowed" })
  }
}

// "res" is Text and Image that displays when wallet first scans
function get(res: NextApiResponse<GetResponse>) {
  res.status(200).json({
    label: "Store Name",
    icon: "https://solana.com/src/img/branding/solanaLogoMark.svg",
  })
}

// "req" is public key of wallet scanning QR code
// "res" is transaction built for wallet to approve, along with a message
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

// build the transaction
async function buildTransaction(
  account: PublicKey,
  reference: PublicKey
): Promise<PostResponse> {
  const connection = new Connection(clusterApiUrl("devnet"))

  const { blockhash } = await connection.getLatestBlockhash()

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: account,
  })

  const instruction = SystemProgram.transfer({
    fromPubkey: account,
    toPubkey: Keypair.generate().publicKey,
    lamports: 0.001 * LAMPORTS_PER_SOL,
  })

  instruction.keys.push({
    pubkey: reference,
    isSigner: false,
    isWritable: false,
  })

  transaction.add(instruction)

  const serializedTransaction = transaction.serialize({
    requireAllSignatures: false,
  })
  const base64 = serializedTransaction.toString("base64")

  const message = "Message To User Before Approving Transaction Here"

  return {
    transaction: base64,
    message,
  }
}
```

## Solana Pay transaction request

[https://github.com/ZYJLiu/solana-pay-basic-setup](https://github.com/ZYJLiu/anchor-solana-pay-demo)

### Create transaction request

### Use transaction request

### Solana Pay with Anchor

## Transaction Composability (partial signing)

## Gated transactions

### tbd

# Demo

scavenger hunt or other event where participants need to visit a series of locations in a specific order. The logic is ensuring that participants are visiting the locations in the correct order.

[https://github.com/ZYJLiu/anchor-solana-pay-demo](https://github.com/ZYJLiu/anchor-solana-pay-demo)

[https://github.com/ZYJLiu/anchor-solana-pay-chakra](https://github.com/ZYJLiu/anchor-solana-pay-chakra)

Build POS frontend, connected wallet is the “merchant”

Clue

Provide Starter code that includes:

- Complete Anchor program to incorporate with frontend
- Frontend starter code
    - Implement Anchor context hook
    - Use Anchor context hook to invoke instruction on program
    - Use Anchor instruction in transaction request
    - Implement transaction confirmation
    - Implement some sort of gating

### 1. Demo section one

### 2. Demo section two

# Challenge

*Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently.*

1. Challenge instruction one
2. Challenge instruction two

## Anchor context hook

### Create hook

### Use hook
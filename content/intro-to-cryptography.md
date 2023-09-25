---
title: Cryptography and the Solana Network
objectives:
- Understand symmetric and asymmetric cryptography
- Explain keypairs
- Generate a new keypair
- Load a keypair from an env file
---

# TL;DR

- A **keypair** is a matching pair of **public key** and **secret key**. 
- The **public key** is used as an “address” that points to an account on the Solana network. A public key can be shared with anyone.
- The **secret key** is used to verify authority over the account. As the name suggests, you should always keep secret keys *secret*.
- `@solana/web3.js` provides helper functions for creating a brand new keypair, or for constructing a keypair using an existing secret key. 

# Overview

## Symmetric and Asymmetric Cryptography

'Cryptography' is literally the study of hiding information. There's two main types of cryptography you'll encounter day to day:

**Symmetric Cryptography** is where the same key is used to encrypt and decrypt. It's hundreds of years old, and has been used by everyone from the ancient Egyptians to Queen Elizabeth I.

There's a variety of symmetric cryptography algorithms, but the most common you'll see today are AES and Chacha20.

**Asymmetric Cryptography**

- Asymmetric cryptography - also called '[public key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography)' was developed in the 1970s. In asymmetric cryptography, participants have pairs of keys (or **keypairs**). Each keypair consists of a **secret key** and a **public key**. Asymmetric encryption works differently from symmetric encryption, and can do different things:

- **Encryption**: if it's encrypted with a public key, only the secret key from the same keypair can be used to read it
- **Signatures**: if it's encrypted with a secret key, the public key from the same keypair can be used to prove the holder of the secret key signed it.
- You can even use asymmetric cryptography to work out a good key to use for symmetric cryptography! This is called **key exchange** where you use your public keys and a recipients public key to come up with a 'session' key. 
- There's a variety of symmetric cryptography algorithms, but the most common you'll see today are variants of ECC or RSA.

Asymmetric encryption is very popular: 
 - You bank card has a secret key inside it, that's used to sign transactions.

   Your bank can confirm you made the transaction by checking them with the matching public key.
 - Websites include a public key in their certificate, your browser will use this public key to encrypt the data (like personal information, login details, and credit card numbers) it sends to the web page. 

   The website has the matching private key, so the website can read the data. 
 - Your electronic passport was signed by the country that issued it, to ensure the passport isn't forged. 

   The electronic passport gates can confirm this usin the public key of your issuing country.
 - The messaging apps on your phone use key exchange to make a session key. 

In short, cryptography is all around us. Solana, as well as other blockchains, are but one use of cryptography.    

## Solana uses public keys as addresses

![Solana wallet addresses](../assets/wallet-addresses.svg)

People participating in the Solana network have at least one keypair. In Solana:

- The **public key** is used as an “address” that points to an account on the Solana network. Even friendly names - like `example.sol` - point to addresses like `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`

- The **secret key** is used to verify authority over that keypair. If you have the secret key for an address, you control the tokens inside that address. For this reason, as the name suggests, you should always keep secret keys *secret*.
## Using @solana/web3.js to make a keypair

You can use the Solana blockchain from either the browser or node.js with the `@solana/web3.js` npm module.  Set up a project how you normally would, then [use `npm`](https://nodesource.com/blog/an-absolute-beginners-guide-to-using-npm/) to install `@solana/web3.js`

```
npm i @solana/web3.js
```

We’ll cover a lot of the [web3.js](https://docs.solana.com/developing/clients/javascript-reference) gradually throughout this course, but you can also check out the [official web3.js documentation](https://docs.solana.com/developing/clients/javascript-reference).

To send tokens, send NFTS, or read and write data Solana, you'll need your own keypair. To make a new keypair, use the `Keypair.generate()` function from  `@solana/web3.js`: 

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`The public key is: `, keypair.publicKey.toBase58());
console.log(`The secret key is: `, keypair.secretKey);
```

## ⚠️ Don't include secret keys in your source code

Since the keypair can be regenerated from the secret key, we usually only store the secret key, and restore the keypair from the secret key. 

Additionally, since the secret key gives authority over the address, we don't store secret keys in source code. Instead, we:

- Put secret keys in a `.env` file 
- Add  `.env`  to `.gitignore` so the `.env` file is not committed.

## Loading an existing keypair

If you already have a keypair you’d like to use, you can load a `Keypair` from an existing secret key stored in the filesystem or an `.env` file. In node.js, the  `@solana-developers/node-helpers` npm package includes some extra functions:

 - To use an `.env` file use `getKeypairFromEnvironment()`
 - To use a Solana CLI file use `getKeypairFromFile()`

```typescript
import * as dotenv from "dotenv";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers";

dotenv.config();

const keypair = getKeypairFromEnvironment("SECRET_KEY");
```

You know how to make and load keypairs! Let’s practice what we’ve learned.

# Demo

### Installation

Make a new directory, install TypeScript, Solana web3.js and esrun:

```bash
mkdir generate-keypair
cd generate-keypair
npm init -y
npm install typescript @solana/web3.js @digitak/esrun @solana-developers/node-helpers
```

Make a new file called `generate-keypair.ts`

```typescript
import { Keypair } from "@solana/web3.js";
const keypair = Keypair.generate();
console.log(`✅ Generated keypair!`)
```

Run `npx esrun generate-keypair.ts`. You should see the text:

```
✅ Generated keypair!
```

Each `Keypair` has a `publicKey` and `secretKey` property. Update the file:

```typescript
import { Keypair } from "@solana/web3.js";

const keypair = Keypair.generate();

console.log(`The public key is: `, keypair.publicKey.toBase58());
console.log(`The secret key is: `, keypair.secretKey);
console.log(`✅ Finished!`);
```

Run `npx esrun generate-keypair.ts`. You should see the text:

```
The public key is:  764CksEAZvm7C1mg2uFmpeFvifxwgjqxj2bH6Ps7La4F
The secret key is:  Uint8Array(64) [
  (a long series of numbers) 
]
✅ Finished!
```

## Loading an existing keypair from an .env file

To ensure that your secret key stays secure, we recommend injecting the secret key using a `.env` file:

Make a new file called `.env` with the contents of the key you made earlier:

```env
SECRET_KEY="[(a series of numbers)]"
```

We can then load the keypair from the environment. Update `generate-keypair.ts`:

```typescript
import * as dotenv from "dotenv";
import { getKeypairFromEnvironment } from "@solana-developers/node-helpers";

dotenv.config();

const keypair = getKeypairFromEnvironment("SECRET_KEY");

console.log(
  `✅ Finished! We've loaded our secret key securely, using an env file!`
);
```

Run `npx esrun generate-keypair.ts`. You should see the following result:

```text
✅ Finished! We've loaded our secret key securely, using an env file!
```

We've now learnt about keypairs, and how to store secret keys securely on Solana. In the next chapter, we'll use them! 

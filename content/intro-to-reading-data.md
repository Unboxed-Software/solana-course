---
title: Read Data From The Solana Network
objectives:
- Understand accounts and their addresses
- Understand SOL and lamports
- Use web3.js to connect to Solana and read an account balance
---

## TL;DR

- **SOL** is the name of Solana’s native token. Each SOL is made from 1 billion **Lamports**. 
- **Accounts** store tokens, NFTs, programs, and data. For now we’ll focus on accounts that store SOL. 
- **Addresses** point to accounts on the Solana network. Anyone can read the data in a given address. Most addresses are also **public keys**.

# Overview

### Accounts

All data stored on Solana is stored in accounts. Accounts can store: 

- SOL
- Other tokens, like USDC
- NFTs
- Programs, like the film review program we make in this course!
- Program data, like a film review for the program above!

### SOL

SOL is Solana's native token - SOL is used to pay transaction fees, pay rent for accounts, and more. SOL is sometimes shown with the `◎` symbol. Each SOL is made from 1 billion **Lamports**. 

In the same way that finance apps typically do math in cents (for USD), pence (for GBP), Solana apps typically transfer, spend, store and handle SOL as Lamports, only converting to full SOL to display to users. 

### Addresses

Addresses uniquely identify accounts. Addresses are often shown as base-58 encoded strings like `dDCQNnDmNbFVi8cQhKAgXhyhXeJ625tvwsunRyRc7c8`. Most addresses on Solana are also **public keys**. As mentioned in the previous chapter, whoever controls the matching secret key for an address controls the account - for example, the person with the secret key can send tokens from the account.

## Reading from the Solana Blockchain

### Installation

We use an npm package called `@solana/web3.js` to do most of the work with Solana. We'll also install TypeScript and `esrun`, so we can run `.ts` files on the command line:

```bash
npm install typescript @solana/web3.js @digitak/esrun 
```

### Connect to the Network

Every interaction with the Solana network using `@solana/web3.js` is going to happen through a `Connection` object. The `Connection` object establishes a connection with a specific Solana network, called a 'cluster'. 

For now we'll use the `Devnet` cluster rather than `Mainnet`. `Devnet` is designed for developer use and testing, and `DevNet` tokens don't have real value.

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
console.log(`✅ Connected!`)
```

Running this TypeScript (`npx esrun example.ts`) shows:

```
✅ Connected!
```

### Read from the Network

To read the balance of an account:

```typescript
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);

console.log(`The balance of the account at ${address} is ${balance} lamports`); 
console.log(`✅ Finished!`)
```

The balance returned is in *lamports*, as discusssed earlier. Web3.js provides the constant `LAMPORTS_PER_SOL` for showing Lamports as SOL:

```typescript
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(clusterApiUrl("devnet"));
const address = new PublicKey('CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN');
const balance = await connection.getBalance(address);
const balanceInSol = balance / LAMPORTS_PER_SOL;

console.log(`The balance of the account at ${address} is ${balanceInSol} SOL`); 
console.log(`✅ Finished!`)
```

Running `npx esrun example.ts` will show something like:

```
The balance of the account at CenYq6bDRB7p73EjsPEpiYN7uveyPUTdXkDkgUduboaN is 0.00114144 SOL
✅ Finished!
```

...and just like that, we are reading data from the Solana blockchain! 

# Lab

Let’s practice what we’ve learned, and check the balance at a particular address. 

## Load a keypair 

Remember the public key from the previous chapter. 

Make a new file called `check-balance.ts`, substituting your public key in for `<your public key>`.

The script loads the public key, connects to DevNet, and checks the balance:

```
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const publicKey = new PublicKey("<your public key>");

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const balanceInLamports = await connection.getBalance(publicKey);

const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;

console.log(
  `💰 Finished! The balance for the wallet at address ${publicKey} is ${balanceInSOL}!`
);

```

Save this to a file, and `npx esrun check-balance.ts`. You should something like:

```
💰 Finished! The balance for the wallet at address 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 is 0!
```

## Get Devnet Sol

In Devnet you can get free SOL to develop with. Think of Devnet SOL like board game money - it looks like it has value, but it doesn't have value. 

[Get some Devnet SOL](https://faucet.solana.com/) and use the public key of your keypair as the address. 

Pick any amount of SOL you like.

## Check your balance

Re-run the script. You should see your balance updated:

```
💰 Finished! The balance for the wallet at address 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 is 0.5!
```

## Check other student's balances

You can modify the script to check balances on any wallet.

```
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const suppliedPublicKey = process.argv[2];
if (!suppliedPublicKey) {
  throw new Error("Provide a public key to check the balance of!");
}

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const publicKey = new PublicKey(suppliedPublicKey);

const balanceInLamports = await connection.getBalance(publicKey);

const balanceInSOL = balanceInLamports / LAMPORTS_PER_SOL;

console.log(
  `✅ Finished! The balance for the wallet at address ${publicKey} is ${balanceInSOL}!`
);

```

Swap wallet addresses with your classmates in the chat and check their balances.

```
% npx esrun check-balance.ts (some wallet address)
✅ Finished! The balance for the wallet at address 31ZdXAvhRQyzLC2L97PC6Lnf2yWgHhQUKKYoUo9MLQF5 is 3!
```

And check a few of your classmate's balances.

# Challenge

Modify the script as follows:

 - Add instructions to handle invalid wallet addresses.
 - Modify the script to connect to `mainNet` and look up some famous Solana wallets. Try `toly.sol`, `shaq.sol` or `mccann.sol`.

We'll transfer SOL in the next lesson!
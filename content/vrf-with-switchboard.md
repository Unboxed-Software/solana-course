# Verifiable Randomness Function

# Lesson Objectives

_By the end of this lesson, you will be able to:_

- Read a VRF Account
- Create a VRF Account
- Request randomeness from a VRF Account

# TL;DR

- **Verifiable Randomness Functions (VRFs)** are functions where randomness can be generated deterministically while being statistically random and the outputs whom can be verified.
- **Switchboard** is an Oracle protocol that enables developers to source data on-chain for a variety of use cases such as price feeds, NFT floor prices, sport statistics, or even verifiable randomness
- **Oracles** are entities that connect smart contracts to external sources of data like weather, sports data, price feeds, etc.

# Overview

Switchboard offers pseudorandom VRFs that aren't truly random but are still good enough for many use cases. Why are they called pseudorandom? Truly random VRFs require hardware modules and physical equipments to sense randomness in nature like environmental noise but obviously in blockchains these things arent feasible so we have pseudorandom VRFs which can be deterministically generated but are still statistically random.

We can use a cryptographic keypair to generate a random number with a proof, which can then be validated by anyone to ensure the value was calculated correctly without the possibility of leaking the producer’s secret key.

# Reading a VRF Account

```ts
import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import {
  loadSwitchboardProgram,
  VrfAccount,
} from "@switchboard-xyz/switchboard-v2";

let payer: Keypair;
const program = await loadSwitchboardProgram("devnet", undefined, payer);

const vrfAccount = new VrfAccount({
  program,
  publicKey: vrfKey,
});
const vrf = await vrfAccount.loadData();
console.log(vrf.currentRound.result);
```

# Creating a VRF Account

```ts
import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import {
  loadSwitchboardProgram,
  VrfAccount,
} from "@switchboard-xyz/switchboard-v2";

let payer: Keypair;
const program = await loadSwitchboardProgram("devnet", undefined, payer);

const vrfAccount = new VrfAccount({
  program,
  publicKey: vrfKey,
});
const vrf = await vrfAccount.loadData();
console.log(vrf.currentRound.result);
```

# Request Randomness from vrf account

```ts
import * as anchor from "@project-serum/anchor";
import { Keypair } from "@solana/web3.js";
import {
  loadSwitchboardProgram,
  VrfAccount,
} from "@switchboard-xyz/switchboard-v2";

let payer: Keypair;
let authority: Keypair;
const program = await loadSwitchboardProgram("devnet", undefined, payer);

const vrfAccount = new VrfAccount({
  program,
  publicKey: vrfKey,
});
const vrf = await vrfAccount.loadData();

const queueAccount = new OracleQueueAccount({
  program,
  publicKey: vrf.queuePubkey,
});
const queue = await queueAccount.loadData();
const mint = await queueAccount.loadMint();

const payerTokenWallet = (
  await mint.getOrCreateAssociatedAccountInfo(payer.publicKey)
).address;

const signature = await vrfAccount.requestRandomness({
  authority,
  payer: payerTokenWallet,
  payerAuthority: payer,
});
```

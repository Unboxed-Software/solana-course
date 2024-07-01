---
title: Generalized State Compression
objectives:
- Explain the logic flow behind Solana state compression
- Explain the difference between a Merkle tree and a concurrent Merkle tree
- Implement generic state compression in basic Solana programs
---

# Summary
- State Compression on Solana is most commonly used for compressed NFTs, but it's possible to use it for arbitrary data
- State Compression lowers the amount of data you have to store onchain by leveraging Merkle trees.
- Merkle trees store a single hash that represents an entire binary tree of hashes. Each leaf on a Merkle tree is a hash of that leaf's data.
- Concurrent Merkle trees are a specialized version of Merkle trees that allow concurrent updates.
- Because data in a state-compressed program is not stored onchain, you have to user indexers to keep an off-chain cache of the data and then verify that data against the onchain Merkle tree.

# Lesson

Previously, we discussed state compression in the context of compressed NFTs. At the time of writing, compressed NFTs represent the most common use case for state compression, but it’s possible to use state compression within any program. In this lesson, we’ll discuss state compression in more generalized terms so that you can apply it to any of your programs.

## A theoretical overview of state compression

In traditional programs, data is serialized (typically using borsh) and then stored directly in an account. This allows the data to be easily read and written through Solana programs. You can “trust” the data stored in the accounts because it can’t be modified except through the mechanisms surfaced by the program.

State compression effectively asserts that the most important piece of this equation is how “trustworthy” the data is. If all we care about is the ability to trust that data is what it claims to be, then we can actually get away with ***not*** storing the data in an account onchain. Instead, we can store hashes of the data where the hashes can be used to prove or verify the data. The data hash takes up significantly less storage space than the data itself. We can then store the actual data somewhere much cheaper and worry about verifying it against the onchain hash when the data is accessed.

The specific data structure used by the Solana State Compression program is a special binary tree structure known as a **concurrent Merkle tree**. This tree structure hashes pieces of data together in a deterministic way to compute a single, final hash that gets stored onchain. This final hash is significantly smaller in size than all the original data combined, hence the “compression.” The steps to this process are:

1. Take any piece of data
2. Create a hash of this data
3. Store this hash as a “leaf” at the bottom of the tree
4. Each leaf pair is then hashed together, creating a “branch”
5. Each branch is then hashed together
6. Continually climb the tree and hash adjacent branches together
7. Once at the top of the tree, a final ”root hash” is produced
8. Store the root hash onchain as verifiable proof of the data within each leaf
9. Anyone wanting to verify that the data they have matches the “source of truth” can go through the same process and compare the final hash without having to store all the data onchain

This involves a few rather serious development tradeoffs:

1. Since the data is no longer stored in an account onchain, it is more difficult to access.
2. Once the data has been accessed, developers must decide how often their applications will verify the data against the onchain hash.
3. Any changes to the data will require sending the entirety of the previously hashed data *and* the new data into an instruction. Developer may also have to provide additional data relevant to the proofs required to verify the original data against the hash.

Each of these will be a consideration when determining **if**, **when**, and **how** to implement state compression for your program.

### Concurrent Merkle trees

A **Merkle tree** is a binary tree structure represented by a single hash. Every leaf node in the structure is a hash of its inner data while every branch is a hash of its child leaf hashes. In turn, branches are also hashed together until, eventually, one final root hash remains.

Since the Merkle tree is represented as a single hash, any modification to leaf data changes the root hash. This causes an issue when multiple transactions in the same slot are attempting to modify leaf data. Since these transactions must execute in series, all but the first will fail since the root hash and proof passed in will have been invalidated by the first transaction to be executed. In other words, a standard Merkle tree can only modify a single leaf per slot. In a hypothetical state-compressed program that relies on a single Merkle tree for its state, this severely limits throughput.

This can be solved with a **concurrent Merkle tree**. A concurrent Merkle tree is a Merkle tree that stores a secure changelog of the most recent changes along with their root hash and the proof to derive it. When multiple transactions in the same slot try to modify leaf data, the changelog can be used as a source of truth to allow for concurrent changes to be made to the tree.

In other words, while an account storing a Merkle tree would have only the root hash, a concurrent Merkle tree will also contain additional data that allows subsequent writes to successfully occur. This includes:

1. The root hash - The same root hash that a standard Merkle tree has.
2. A changelog buffer - This buffer contains proof data pertinent to recent root hash changes so that subsequent writes in the same slot can still be successful.
3. A canopy - When performing an update action on any given leaf, you need the entire proof path from that leaf to the root hash. The canopy stores intermediate proof nodes along that path so they don’t all have to be passed into the program from the client. 

As a program architect, you control three values directly related to these three items. Your choice determines the size of the tree, the cost to create the tree, and the number of concurrent changes that can be made to the tree:

1. Max depth
2. Max buffer size
3. Canopy depth

The **max depth** is the maximum number of hops to get from any leaf to the root of the tree. Since Merkle trees are binary trees, every leaf is connected only to one other leaf. Max depth can then logically be used to calculate the number of nodes for the tree with `2 ^ maxDepth`.

The **max buffer size** is effectively the maximum number of concurrent changes that you can make to a tree within a single slot with the root hash still being valid. When multiple transactions are submitted in the same slot, each of which is competing to update leafs on a standard Merkle tree, only the first to run will be valid. This is because that “write” operation will modify the hash stored in the account. Subsequent transactions in the same slot will be trying to validate their data against a now-outdated hash. A concurrent Merkle tree has a buffer so that the buffer can keep a running log of these modifications. This allows the State Compression Program to validate multiple data writes in the same slot because it can look up what the previous hashes were in the buffer and compare against the appropriate hash.

The **canopy depth** is the number of proof nodes that are stored onchain for any given proof path. Verifying any leaf requires the complete proof path for the tree. The complete proof path is made up of one proof node for every “layer” of the tree, i.e. a max depth of 14 means there are 14 proof nodes. Every proof node passed into the program adds 32 bytes to a transaction, so large trees would quickly exceed the maximum transaction size limit. Caching proof nodes onchain in the canopy helps improve program composability.

Each of these three values, max depth, max buffer size, and canopy depth, comes with a tradeoff. Increasing the value of any of these values increases the size of the account used to store the tree, thus increasing the cost of creating the tree.

Choosing the max depth is fairly straightforward as it directly relates to the number of leafs and therefore the amount of data you can store. If you need 1 million cNFTs on a single tree where each cNFT is a leaf of the tree, find the max depth that makes the following expression true: `2^maxDepth > 1 million`. The answer is 20.

Choosing a max buffer size is effectively a question of throughput: how many concurrent writes do you need? The larger the buffer, the higher the throughput.

Lastly, the canopy depth will determine your program’s composability. State compression pioneers have made it clear that omitting a canopy is a bad idea. Program A can’t call your state-compressed program B if doing so maxes out the transaction size limits. Remember, program A also has required accounts and data in addition to required proof paths, each of which take up transaction space.

### Data access on a state-compressed program

A state-compressed account doesn’t store the data itself. Rather, it stores the concurrent Merkle tree structure discussed above. The raw data itself lives only in the blockchain’s cheaper **ledger state.** This makes data access somewhat more difficult, but not impossible.

The Solana ledger is a list of entries containing signed transactions. In theory, this can be traced back to the genesis block. This effectively means any data that has ever been put into a transaction exists in the ledger.

Since the state compression hashing process occurs onchain, all the data exists in the ledger state and could theoretically be retrieved from the original transaction by replaying the entire chain state from the beginning. However, it’s much more straightforward (though still complicated) to have an **indexer** track and index this data as the transactions occur. This ensures there is an off-chain “cache” of the data that anyone can access and subsequently verify against the onchain root hash.

This process is complex, but it will make sense after some practice.

## State compression tooling

The theory described above is essential to properly understanding state compression. But you don’t have to implement any of it from scratch. Brilliant engineers have laid most of the groundwork for you in the form of the SPL State Compression Program and the Noop Program.

### SPL State Compression and Noop Programs

The SPL State Compression Program exists to make the process of creating and updating concurrent Merkle trees repeatable and composable throughout the Solana ecosystem. It provides instructions for initializing Merkle trees, managing tree leafs (i.e. add, update, remove data), and verifying leaf data.

The State Compression Program also leverages a separate “no op” program whose primary purpose is to make leaf data easier to index by logging it to the ledger state. When you want to store compressed data, you pass it to the State Compression program where it gets hashed and emitted as an “event” to the Noop program. The hash gets stored in the corresponding concurrent Merkle tree, but the raw data remains accessible through the Noop program’s transaction logs.

### Index data for easy lookup

Under normal conditions, you would typically access onchain data by fetching the appropriate account. When using state compression, however, it’s not so straightforward.

As mentioned above, the data now exists in the ledger state rather than in an account. The easiest place to find the full data is in the logs of the Noop instruction. Unfortunately, while this data will in a sense exist in the ledger state forever, it will likely be inaccessible through validators after a certain period of time.

To save space and be more performant, validators don’t retain every transaction back to the genesis block. The specific amount of time you’ll be able to access the Noop instruction logs related to your data will vary based on the validator. Eventually, you’ll lose access to it if you’re relying directly on instruction logs.

Technically, you *can* replay the transaction state back to the genesis block but the average team isn’t going to do that, and it certainly won’t be performant. The [Digital Asset Standard (DAS)](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) has been adopted by many RPC providers to enable efficient queries of compressed NFTs and other assets. However, at the time of writing, it doesn’t support arbitrary state compression. Instead, you have two primary options:

1. Use an indexing provider that will build a custom indexing solution for your program that observes the events sent to the Noop program and stores the relevant data off-chain.
2. Create your own pseudo-indexing solution that stores transaction data off-chain.

For many dApps, option 2 makes plenty of sense. Larger-scale applications may need to rely on infrastructure providers to handle their indexing.

## State compression development process

### Create Rust types

As with a typical Anchor program, one of the first things you should do is define your program’s Rust types. However, Rust types in a traditional Anchor program often represent accounts. In a state-compressed program, your account state will only store the Merkle tree. The more “usable” data schema will just be serialized and logged to the Noop program.

This type should include all the data stored in the leaf node and any contextual information needed to make sense of the data. For example, if you were to create a simple messaging program, your `Message` struct might look as follows:

```rust
#[derive(AnchorSerialize)]
pub struct MessageLog {
		leaf_node: [u8; 32], // The leaf node hash
    from: Pubkey,        // Pubkey of the message sender
		to: Pubkey,          // Pubkey of the message recipient
    message: String,     // The message to send
}

impl MessageLog {
    // Constructs a new message log from given leaf node and message
    pub fn new(leaf_node: [u8; 32], from: Pubkey, to: Pubkey, message: String) -> Self {
        Self { leaf_node, from, to, message }
    }
}
```

To be abundantly clear, **this is not an account that you will be able to read from**. Your program will be creating an instance of this type from instruction inputs, not constructing an instance of this type from account data that it reads. We’ll discuss how to read data in a later section.

### Initialize a new tree

Clients will create and initialize the Merkle tree account in two separate instructions. The first is simply allocating the account by calling System Program. The second will be an instruction that you create on a custom program that initializes the new account. This initialization is effectively just recording what the max depth and buffer size for the Merkle tree should be.

All this instruction needs to do is build a CPI to invoke the `init_empty_merkle_tree` instruction on the State Compression Program. Since this requires the max depth and max buffer size, these will need to be passed in as arguments to the instruction.

Remember, the max depth refers to the maximum number of hops to get from any leaf to the root of the tree. Max buffer size refers to the amount of space reserved for storing a changelog of tree updates. This changelog is used to ensure that your tree can support concurrent updates within the same block.

For example, if we were initializing a tree for storing messages between users, the instruction might look like this:

```rust
pub fn create_messages_tree(
    ctx: Context<MessageAccounts>,
    max_depth: u32, // Max depth of the Merkle tree
    max_buffer_size: u32 // Max buffer size of the Merkle tree
) -> Result<()> {
    // Get the address for the Merkle tree account
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // Define the seeds for pda signing
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // The address of the Merkle tree account as a seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // The bump seed for the pda
        ],
    ];

    // Create cpi context for init_empty_merkle_tree instruction.
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // The spl account compression program
        Initialize {
            authority: ctx.accounts.tree_authority.to_account_info(), // The authority for the Merkle tree, using a PDA
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be initialized
            noop: ctx.accounts.log_wrapper.to_account_info(), // The noop program to log data
        },
        signer_seeds // The seeds for pda signing
    );

    // CPI to initialize an empty Merkle tree with given max depth and buffer size
    init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;

    Ok(())
}
```

### Add hashes to the tree

With an initialized Merkle tree, it’s possible to start adding data hashes. This involves passing the uncompressed data to an instruction on your program that will hash the data, log it to the Noop program, and use the State Compression Program’s `append` instruction to add the hash to the tree. The following discuss what your instruction needs to do in depth:

1. Use the `hashv` function from the `keccak` crate to hash the data. In most cases, you’ll want to also hash the owner or authority of the data as well to ensure that it can only be modified by the proper authority.
2. Create a log object representing the data you wish to log to the Noop Program, then call `wrap_application_data_v1` to issue a CPI to the Noop program with this object. This ensures that the uncompressed data is readily available to any client looking for it. For broad use cases like cNFTs, that would be indexers. You might also create your own observing client to simulate what indexers are doing but specific to your application.
3. Build and issue a CPI to the State Compression Program’s `append` instruction. This takes the hash computed in step 1 and adds it to the next available leaf on your Merkle tree. Just as before, this requires the Merkle tree address and the tree authority bump as signature seeds.

When all this is put together using the messaging example, it looks something like this:

```rust
// Instruction for appending a message to a tree.
pub fn append_message(ctx: Context<MessageAccounts>, message: String) -> Result<()> {
    // Hash the message + whatever key should have update authority
    let leaf_node = keccak::hashv(&[message.as_bytes(), ctx.accounts.sender.key().as_ref()]).to_bytes();
    // Create a new "message log" using the leaf node hash, sender, receipient, and message
    let message_log = MessageLog::new(leaf_node.clone(), ctx.accounts.sender.key().clone(), ctx.accounts.receipient.key().clone(), message);
    // Log the "message log" data using noop program
    wrap_application_data_v1(message_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;
    // Get the address for the Merkle tree account
    let merkle_tree = ctx.accounts.merkle_tree.key();
    // Define the seeds for pda signing
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // The address of the Merkle tree account as a seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // The bump seed for the pda
        ],
    ];
    // Create a new cpi context and append the leaf node to the Merkle tree.
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.compression_program.to_account_info(), // The spl account compression program
        Modify {
            authority: ctx.accounts.tree_authority.to_account_info(), // The authority for the Merkle tree, using a PDA
            merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be modified
            noop: ctx.accounts.log_wrapper.to_account_info(), // The noop program to log data
        },
        signer_seeds // The seeds for pda signing
    );
    // CPI to append the leaf node to the Merkle tree
    append(cpi_ctx, leaf_node)?;
    Ok(())
}
```

### Update hashes

To update data, you need to create a new hash to replace the hash at the relevant leaf on the Merkle tree. To do this, your program needs access to four things:

1. The index of the leaf to update
2. The root hash of the Merkle tree
3. The original data you wish to modify
4. The updated data

Given access to this data, a program instruction can follow very similar steps as those used to append the initial data to the tree:

1. **Verify update authority** - The first step is new. In most cases, you want to verify update authority. This typically involves proving that the signer of the `update` transaction is the true owner or authority of the leaf at the given index. Since the data is compressed as a hash on the leaf, we can’t simply compare the `authority` public key to a stored value. Instead, we need to compute the previous hash using the old data and the `authority` listed in the account validation struct. We then build and issue a CPI to the State Compression Program’s `verify_leaf` instruction using our computed hash.
2. **Hash the new data** - This step is the same as the first step from appending initial data. Use the `hashv` function from the `keccak` crate to hash the new data and the update authority, each as their corresponding byte representation.
3. **Log the new data** - This step is the same as the second step from appending initial data. Create an instance of the log struct and call `wrap_application_data_v1` to issue a CPI to the Noop program.
4. **Replace the existing leaf hash** - This step is slightly different than the last step of appending initial data. Build and issue a CPI to the State Compression Program’s `replace_leaf` instruction. This uses the old hash, the new hash, and the leaf index to replace the data of the leaf at the given index with the new hash. Just as before, this requires the Merkle tree address and the tree authority bump as signature seeds.

Combined into a single instruction, this process looks as follows:

```rust
pub fn update_message(
    ctx: Context<MessageAccounts>,
    index: u32,
    root: [u8; 32],
    old_message: String,
    new_message: String
) -> Result<()> {
    let old_leaf = keccak
        ::hashv(&[old_message.as_bytes(), ctx.accounts.sender.key().as_ref()])
        .to_bytes();

    let merkle_tree = ctx.accounts.merkle_tree.key();

    // Define the seeds for pda signing
    let signer_seeds: &[&[&[u8]]] = &[
        &[
            merkle_tree.as_ref(), // The address of the Merkle tree account as a seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // The bump seed for the pda
        ],
    ];

    // Verify Leaf
    {
        if old_message == new_message {
            msg!("Messages are the same!");
            return Ok(());
        }

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // The spl account compression program
            VerifyLeaf {
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be modified
            },
            signer_seeds // The seeds for pda signing
        );
        // Verify or Fails
        verify_leaf(cpi_ctx, root, old_leaf, index)?;
    }

    let new_leaf = keccak
        ::hashv(&[new_message.as_bytes(), ctx.accounts.sender.key().as_ref()])
        .to_bytes();

    // Log out for indexers
    let message_log = MessageLog::new(new_leaf.clone(), ctx.accounts.sender.key().clone(), ctx.accounts.recipient.key().clone(), new_message);
    // Log the "message log" data using noop program
    wrap_application_data_v1(message_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;

    // replace leaf
    {
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // The spl account compression program
            Modify {
                authority: ctx.accounts.tree_authority.to_account_info(), // The authority for the Merkle tree, using a PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be modified
                noop: ctx.accounts.log_wrapper.to_account_info(), // The noop program to log data
            },
            signer_seeds // The seeds for pda signing
        );
        // CPI to append the leaf node to the Merkle tree
        replace_leaf(cpi_ctx, root, old_leaf, new_leaf, index)?;
    }

    Ok(())
}
```

### Delete hashes

At the time of writing, the State Compression Program doesn’t provide an explicit `delete` instruction. Instead, you’ll want to update leaf data with data that indicates the data as “deleted.” The specific data will depend on your use case and security concerns. Some may opt to set all data to 0, whereas others might store a static string that all “deleted” items will have in common.

### Access data from a client

The discussion so far has covered 3 of the 4 standard CRUD procedures: Create, Update, and Delete. What’s left is one of the more difficult concepts in state compression: reading data.

Accessing data from a client is tricky primarily because the data isn’t stored in a format that is easy to access. The data hashes stored in the Merkle tree account can’t be used to reconstruct the initial data, and the data logged to the Noop program isn’t available indefinitely.

Your best bet is one of two options:

1. Work with an indexing provider to create a custom indexing solution for your program, then write client-side code based on how the indexer gives you access to the data.
2. Create your own pseudo-indexer as a lighter-weight solution.

If your project is truly decentralized such that many participants will interact with your program through means other than your own frontend, then option 2 might not be sufficient. However, depending on the scale of the project or whether or not you’ll have control over most program access, it can be a viable approach.

There is no “right” way to do this. Two potential approaches are:

1. Store the raw data in a database at the same time as sending it to the program, along with the leaf that the data is hashed and stored to.
2. Create a server that observes your program’s transactions, looks up the associated Noop logs, decodes the logs, and stores them.

We’ll do a little bit of both when writing tests in this lesson’s lab (though we won’t persist data in a db - it will only live in memory for the duration of the tests).

The setup for this is somewhat tedious. Given a particular transaction, you can fetch the transaction from the RPC provider, get the inner instructions associated with the Noop program, use the `deserializeApplicationDataEvent` function from the `@solana/spl-account-compression` JS package to get the logs, then deserialize them using Borsh. Below is an example based on the messaging program used above.

```tsx
export async function getMessageLog(connection: Connection, txSignature: string) {
  // Confirm the transaction, otherwise the getTransaction sometimes returns null
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSignature,
  })

  // Get the transaction info using the tx signature
  const txInfo = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  // Get the inner instructions related to the program instruction at index 0
  // We only send one instruction in test transaction, so we can assume the first
  const innerIx = txInfo!.meta?.innerInstructions?.[0]?.instructions

  // Get the inner instructions that match the SPL_NOOP_PROGRAM_ID
  const noopInnerIx = innerIx.filter(
    (instruction) =>
      txInfo?.transaction.message.staticAccountKeys[
        instruction.programIdIndex
      ].toBase58() === SPL_NOOP_PROGRAM_ID.toBase58()
  )

  let messageLog: MessageLog
  for (let i = noopInnerIx.length - 1; i >= 0; i--) {
    try {
      // Try to decode and deserialize the instruction data
      const applicationDataEvent = deserializeApplicationDataEvent(
        Buffer.from(bs58.decode(noopInnerIx[i]?.data!))
      )

      // Get the application data
      const applicationData = applicationDataEvent.fields[0].applicationData

      // Deserialize the application data into MessageLog instance
      messageLog = deserialize(
        MessageLogBorshSchema,
        MessageLog,
        Buffer.from(applicationData)
      )

      if (messageLog !== undefined) {
        break
      }
    } catch (__) {}
  }

  return messageLog
}
```

## Conclusion

Generalized state compression can be difficult but is absolutely possible to implement with the available tools. Additionally, the tools and programs will only get better over time. If you come up with solutions that improve your development experience, please share with the community!

# Lab

Let’s practice generalized state compression by creating a new Anchor program. This program will use custom state compression to power a simple note-taking app.

### 1. Project setup

Start by initializing an Anchor program:

```bash
anchor init compressed-notes
```

We’ll be using the `spl-account-compression` crate with the `cpi` feature enabled. Let’s add it as a dependency in `programs/compressed-notes/Cargo.toml`.

```toml
[dependencies]
anchor-lang = "0.28.0"
spl-account-compression = { version="0.2.0", features = ["cpi"] }
solana-program = "1.16.0"
```

We’ll be testing locally but we need both the Compression program and the Noop program from Mainnet. We’ll need to add these to the `Anchor.toml` in the root directory so they get cloned to our local cluster.

```toml
[test.validator]
url = "https://api.mainnet-beta.solana.com"

[[test.validator.clone]]
address = "noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV"

[[test.validator.clone]]
address = "cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK"
```

Lastly, let’s prepare the `lib.rs` file for the rest of the Demo. Remove the `initialize` instruction and the `Initialize` accounts struct, then add the imports shown in the code snippet below (be sure to put in ***your*** program id):

```rust
use anchor_lang::{
    prelude::*, 
    solana_program::keccak
};
use spl_account_compression::{
    Noop,
    program::SplAccountCompression,
    cpi::{
        accounts::{Initialize, Modify, VerifyLeaf},
        init_empty_merkle_tree, verify_leaf, replace_leaf, append, 
    },
    wrap_application_data_v1, 
};

declare_id!("YOUR_KEY_GOES_HERE");

// STRUCTS GO HERE

#[program]
pub mod compressed_notes {
    use super::*;

	// FUNCTIONS GO HERE
	
}
```

For the rest of this Demo, we’ll be making updates to the program code directly in the `lib.rs` file. This simplifies the explanations a bit. You’re welcome to modify the structure as you will.

Feel free to build before continuing. This ensures your environment is working properly and shortens future build times.

### 2. Define `Note` schema

Next, we’re going to define what a note looks like within our program. Notes should have the following properties:

- `leaf_node` - this should be a 32-byte array representing the hash stored on the leaf node
- `owner` - the public key of the note owner
- `note` - the string representation of the note

```rust
#[derive(AnchorSerialize)]
pub struct NoteLog {
    leaf_node: [u8; 32],  // The leaf node hash
    owner: Pubkey,        // Pubkey of the note owner
    note: String,         // The note message
}

impl NoteLog {
    // Constructs a new note from given leaf node and message
    pub fn new(leaf_node: [u8; 32], owner: Pubkey, note: String) -> Self {
        Self { leaf_node, owner, note }
    }
}
```

In a traditional Anchor program, this would be an account struct, but since we’re using state compression, our accounts won’t be mirroring our native structures. Since we don’t need all the functionality of an account, we can just use the `AnchorSerialize` derive macro rather than the `account` macro.

### 3. Define input accounts and constraints

As luck would have it, every one of our instructions will be using the same accounts. We’ll create a single `NoteAccounts` struct for our account validation. It’ll need the following accounts:

- `owner` - this is the creator and owner of the note; should be a signer on the transaction
- `tree_authority` - the authority for the Merkle tree; used for signing compression-related CPIs
- `merkle_tree` - the address of the Merkle tree used to store the note hashes; will be unchecked since it is validated by the State Compression Program
- `log_wrapper` - the address of the Noop Program
- `compression_program` - the address of the State Compression Program

```rust
#[derive(Accounts)]
pub struct NoteAccounts<'info> {
    // The payer for the transaction
    #[account(mut)]
    pub owner: Signer<'info>,

    // The pda authority for the Merkle tree, only used for signing
    #[account(
        seeds = [merkle_tree.key().as_ref()],
        bump,
    )]
    pub tree_authority: SystemAccount<'info>,

    // The Merkle tree account
    /// CHECK: This account is validated by the spl account compression program
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    // The noop program to log data
    pub log_wrapper: Program<'info, Noop>,

    // The spl account compression program
    pub compression_program: Program<'info, SplAccountCompression>,
}
```

### 4. Create `create_note_tree` instruction

Next, let’s create our `create_note_tree` instruction. Remember, clients will have already allocated the Merkle tree account but will use this instruction to initialize it.

All this instruction needs to do is build a CPI to invoke the `init_empty_merkle_tree` instruction on the State Compression Program. To do this, it needs the accounts listed in the `NoteAccounts` account validation struct. It also needs two additional arguments:

1. `max_depth` - the max depth of the Merkle tree
2. `max_buffer_size` - the max buffer size of the Merkle tree

These values are required for initializing the data on the Merkle tree account. Remember, the max depth refers to the maximum number of hops to get from any leaf to the root of the tree. Max buffer size refers to the amount of space reserved for storing a changelog of tree updates. This changelog is used to ensure that your tree can support concurrent updates within the same block.

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    // Instruction for creating a new note tree.
    pub fn create_note_tree(
        ctx: Context<NoteAccounts>,
        max_depth: u32,       // Max depth of the Merkle tree
        max_buffer_size: u32, // Max buffer size of the Merkle tree
    ) -> Result<()> {
        // Get the address for the Merkle tree account
        let merkle_tree = ctx.accounts.merkle_tree.key();

        // Define the seeds for pda signing
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // The address of the Merkle tree account as a seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // The bump seed for the pda
        ]];

        // Create cpi context for init_empty_merkle_tree instruction.
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // The spl account compression program
            Initialize {
                authority: ctx.accounts.tree_authority.to_account_info(), // The authority for the Merkle tree, using a PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be initialized
                noop: ctx.accounts.log_wrapper.to_account_info(), // The noop program to log data
            },
            signer_seeds, // The seeds for pda signing
        );

        // CPI to initialize an empty Merkle tree with given max depth and buffer size
        init_empty_merkle_tree(cpi_ctx, max_depth, max_buffer_size)?;
        Ok(())
    }

    //...
}
```

Ensure that your signer seeds on the CPI include both the Merkle tree address and the tree authority bump.

### 5. Create `append_note` instruction

Now, let’s create our `append_note` instruction. This instruction needs to take the raw note as a String and compress it into a hash that we’ll store on the Merkle tree. We’ll also log the note to the Noop program so the entirety of the data exists within the chain’s state.

The steps here are as follows:

1. Use the `hashv` function from the `keccak` crate to hash the note and owner, each as their corresponding byte representation. It’s ***crucial*** that you hash the owner as well as the note. This is how we’ll verify note ownership before updates in the update instruction.
2. Create an instance of the `NoteLog` struct using the hash from step 1, the owner’s public key, and the raw note as a String. Then call `wrap_application_data_v1` to issue a CPI to the Noop program, passing the instance of `NoteLog`. This ensures the entirety of the note (not just the hash) is readily available to any client looking for it. For broad use cases like cNFTs, that would be indexers. You might create your observing client to simulate what indexers are doing but for your own application.
3. Build and issue a CPI to the State Compression Program’s `append` instruction. This takes the hash computed in step 1 and adds it to the next available leaf on your Merkle tree. Just as before, this requires the Merkle tree address and the tree authority bump as signature seeds.

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    //...

    // Instruction for appending a note to a tree.
    pub fn append_note(ctx: Context<NoteAccounts>, note: String) -> Result<()> {
        // Hash the "note message" which will be stored as leaf node in the Merkle tree
        let leaf_node =
            keccak::hashv(&[note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();
        // Create a new "note log" using the leaf node hash and note.
        let note_log = NoteLog::new(leaf_node.clone(), ctx.accounts.owner.key().clone(), note);
        // Log the "note log" data using noop program
        wrap_application_data_v1(note_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;
        // Get the address for the Merkle tree account
        let merkle_tree = ctx.accounts.merkle_tree.key();
        // Define the seeds for pda signing
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // The address of the Merkle tree account as a seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // The bump seed for the pda
        ]];
        // Create a new cpi context and append the leaf node to the Merkle tree.
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.compression_program.to_account_info(), // The spl account compression program
            Modify {
                authority: ctx.accounts.tree_authority.to_account_info(), // The authority for the Merkle tree, using a PDA
                merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be modified
                noop: ctx.accounts.log_wrapper.to_account_info(), // The noop program to log data
            },
            signer_seeds, // The seeds for pda signing
        );
        // CPI to append the leaf node to the Merkle tree
        append(cpi_ctx, leaf_node)?;
        Ok(())
    }

    //...
}
```

### 6. Create `update_note` instruction

The last instruction we’ll make is the `update_note` instruction. This should replace an existing leaf with a new hash representing the new updated note data.

For this to work, we’ll need the following parameters:

1. `index` - the index of the leaf we are going to update
2. `root` - the root hash of the Merkle tree
3. `old_note` - the string representation of the old note we’re updating
4. `new_note` - the string representation of the new note we want to update to

Remember, the steps here are similar to `append_note`, but with some minor additions and modifications:

1. The first step is new. We need to first prove that the `owner` calling this function is the true owner of the leaf at the given index. Since the data is compressed as a hash on the leaf, we can’t simply compare the `owner` public key to a stored value. Instead, we need to compute the previous hash using the old note data and the `owner` listed in the account validation struct. We then build and issue a CPI to the State Compression Program’s `verify_leaf` instruction using our computed hash.
2. This step is the same as the first step from creating the `append_note` instruction. Use the `hashv` function from the `keccak` crate to hash the new note and its owner, each as their corresponding byte representation.
3. This step is the same as the second step from creating the `append_note` instruction. Create an instance of the `NoteLog` struct using the hash from step 2, the owner’s public key, and the new note as a string. Then call `wrap_application_data_v1` to issue a CPI to the Noop program, passing the instance of `NoteLog`
4. This step is slightly different than the last step from creating the `append_note` instruction. Build and issue a CPI to the State Compression Program’s `replace_leaf` instruction. This uses the old hash, the new hash, and the leaf index to replace the data of the leaf at the given index with the new hash. Just as before, this requires the Merkle tree address and the tree authority bump as signature seeds.

```rust
#[program]
pub mod compressed_notes {
    use super::*;

    //...

		pub fn update_note(
        ctx: Context<NoteAccounts>,
        index: u32,
        root: [u8; 32],
        old_note: String,
        new_note: String,
    ) -> Result<()> {
        let old_leaf =
            keccak::hashv(&[old_note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();

        let merkle_tree = ctx.accounts.merkle_tree.key();

        // Define the seeds for pda signing
        let signer_seeds: &[&[&[u8]]] = &[&[
            merkle_tree.as_ref(), // The address of the Merkle tree account as a seed
            &[*ctx.bumps.get("tree_authority").unwrap()], // The bump seed for the pda
        ]];

        // Verify Leaf
        {
            if old_note == new_note {
                msg!("Notes are the same!");
                return Ok(());
            }

            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(), // The spl account compression program
                VerifyLeaf {
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be modified
                },
                signer_seeds, // The seeds for pda signing
            );
            // Verify or Fails
            verify_leaf(cpi_ctx, root, old_leaf, index)?;
        }

        let new_leaf =
            keccak::hashv(&[new_note.as_bytes(), ctx.accounts.owner.key().as_ref()]).to_bytes();

        // Log out for indexers
        let note_log = NoteLog::new(new_leaf.clone(), ctx.accounts.owner.key().clone(), new_note);
        // Log the "note log" data using noop program
        wrap_application_data_v1(note_log.try_to_vec()?, &ctx.accounts.log_wrapper)?;

        // replace leaf
        {
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.compression_program.to_account_info(), // The spl account compression program
                Modify {
                    authority: ctx.accounts.tree_authority.to_account_info(), // The authority for the Merkle tree, using a PDA
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(), // The Merkle tree account to be modified
                    noop: ctx.accounts.log_wrapper.to_account_info(), // The noop program to log data
                },
                signer_seeds, // The seeds for pda signing
            );
            // CPI to append the leaf node to the Merkle tree
            replace_leaf(cpi_ctx, root, old_leaf, new_leaf, index)?;
        }

        Ok(())
    }
}
```

### 7. Client test setup

We’re going to write a few tests to ensure that our program works as expected. First, let’s do some setup.

We’ll be using the `@solana/spl-account-compression` package. Go ahead and install it:

```bash
yarn add @solana/spl-account-compression
```

Next, we’re going to give you the contents of a utility file we’ve created to make testing easier. Create a `utils.ts` file in the `tests` directory, add in the below, then we’ll explain it. 

```tsx
import {
  SPL_NOOP_PROGRAM_ID,
  deserializeApplicationDataEvent,
} from "@solana/spl-account-compression"
import { Connection, PublicKey } from "@solana/web3.js"
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes"
import { deserialize } from "borsh"
import { keccak256 } from "js-sha3"

class NoteLog {
  leafNode: Uint8Array
  owner: PublicKey
  note: string

  constructor(properties: {
    leafNode: Uint8Array
    owner: Uint8Array
    note: string
  }) {
    this.leafNode = properties.leafNode
    this.owner = new PublicKey(properties.owner)
    this.note = properties.note
  }
}

// A map that describes the Note structure for Borsh deserialization
const NoteLogBorshSchema = new Map([
  [
    NoteLog,
    {
      kind: "struct",
      fields: [
        ["leafNode", [32]], // Array of 32 `u8`
        ["owner", [32]], // Pubkey
        ["note", "string"],
      ],
    },
  ],
])

export function getHash(note: string, owner: PublicKey) {
  const noteBuffer = Buffer.from(note)
  const publicKeyBuffer = Buffer.from(owner.toBytes())
  const concatenatedBuffer = Buffer.concat([noteBuffer, publicKeyBuffer])
  const concatenatedUint8Array = new Uint8Array(
    concatenatedBuffer.buffer,
    concatenatedBuffer.byteOffset,
    concatenatedBuffer.byteLength
  )
  return keccak256(concatenatedUint8Array)
}

export async function getNoteLog(connection: Connection, txSignature: string) {
  // Confirm the transaction, otherwise the getTransaction sometimes returns null
  const latestBlockHash = await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: txSignature,
  })

  // Get the transaction info using the tx signature
  const txInfo = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0,
  })

  // Get the inner instructions related to the program instruction at index 0
  // We only send one instruction in test transaction, so we can assume the first
  const innerIx = txInfo!.meta?.innerInstructions?.[0]?.instructions

  // Get the inner instructions that match the SPL_NOOP_PROGRAM_ID
  const noopInnerIx = innerIx.filter(
    (instruction) =>
      txInfo?.transaction.message.staticAccountKeys[
        instruction.programIdIndex
      ].toBase58() === SPL_NOOP_PROGRAM_ID.toBase58()
  )

  let noteLog: NoteLog
  for (let i = noopInnerIx.length - 1; i >= 0; i--) {
    try {
      // Try to decode and deserialize the instruction data
      const applicationDataEvent = deserializeApplicationDataEvent(
        Buffer.from(bs58.decode(noopInnerIx[i]?.data!))
      )

      // Get the application data
      const applicationData = applicationDataEvent.fields[0].applicationData

      // Deserialize the application data into NoteLog instance
      noteLog = deserialize(
        NoteLogBorshSchema,
        NoteLog,
        Buffer.from(applicationData)
      )

      if (noteLog !== undefined) {
        break
      }
    } catch (__) {}
  }

  return noteLog
}
```

There are 3 main things in the above file:

1. `NoteLog` - a class representing the note log we’ll find in the Noop program logs. We’ve also added the borsh schema as `NoteLogBorshSchema` for deserialization.
2. `getHash` - a function that creates a hash of the note and note owner so we can compare it to what we find on the Merkle tree
3. `getNoteLog` - a function that looks through the provided transaction’s logs, finds the Noop program logs, then deserializes and returns the corresponding Note log.

### 8. Write client tests

Now that we’ve got our packages installed and utility file ready, let’s dig into the tests themselves. We’re going to create four of them:

1. Create Note Tree - this will create the Merkle tree we’ll be using to store note hashes
2. Add Note - this will call our `append_note` instruction
3. Add Max Size Note - this will call our `append_note` instruction with a note that maxes out the 1232 bytes allowed in a single transaction
4. Update First Note - this will call our `update_note` instruction to modify the first note we added

The first test is mostly just for setup. In the last three tests, we’ll be asserting each time that the note hash on the tree matches what we would expect given the note text and signer.

Let’s start with our imports. There are quite a few from Anchor, `@solana/web3.js`, `@solana/spl-account-compression`, and our own utils file.

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { CompressedNotes } from "../target/types/compressed_notes"
import {
  Keypair,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
  Connection,
} from "@solana/web3.js"
import {
  ValidDepthSizePair,
  createAllocTreeIx,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  ConcurrentMerkleTreeAccount,
} from "@solana/spl-account-compression"
import { getHash, getNoteLog } from "./utils"
import { assert } from "chai"
```

Next, we’ll want to set up the state variables we’ll be using throughout our tests. This includes the default Anchor setup as well as generating a Merkle tree keypair, the tree authority, and some notes.

```tsx
describe("compressed-notes", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const connection = new Connection(
    provider.connection.rpcEndpoint,
    "confirmed" // has to be confirmed for some of the methods below
  )

  const wallet = provider.wallet as anchor.Wallet
  const program = anchor.workspace.CompressedNotes as Program<CompressedNotes>

  // Generate a new keypair for the Merkle tree account
  const merkleTree = Keypair.generate()

  // Derive the PDA to use as the tree authority for the Merkle tree account
  // This is a PDA derived from the Note program, which allows the program to sign for appends instructions to the tree
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [merkleTree.publicKey.toBuffer()],
    program.programId
  )

	const firstNote = "hello world"
  const secondNote = "0".repeat(917)
  const updatedNote = "updated note"


  // TESTS GO HERE

});
```

Finally, let’s start with the tests themselves. First the `Create Note Tree` test. This test will do two things:

1. Allocate a new account for the Merkle tree with a max depth of 3, max buffer size of 8, and canopy depth of 0
2. Initialize this new account using our program’s `createNoteTree` instruction

```tsx
it("Create Note Tree", async () => {
  const maxDepthSizePair: ValidDepthSizePair = {
    maxDepth: 3,
    maxBufferSize: 8,
  }

  const canopyDepth = 0

  // instruction to create new account with required space for tree
  const allocTreeIx = await createAllocTreeIx(
    connection,
    merkleTree.publicKey,
    wallet.publicKey,
    maxDepthSizePair,
    canopyDepth
  )

  // instruction to initialize the tree through the Note program
  const ix = await program.methods
    .createNoteTree(maxDepthSizePair.maxDepth, maxDepthSizePair.maxBufferSize)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .instruction()

  const tx = new Transaction().add(allocTreeIx, ix)
  await sendAndConfirmTransaction(connection, tx, [wallet.payer, merkleTree])
})
```

Next, we’ll create the `Add Note` test. It should call `append_note` with `firstNote`, then check that the onchain hash matches our computed hash and that the note log matches the text of the note we passed into the instruction.

```tsx
it("Add Note", async () => {
  const txSignature = await program.methods
    .appendNote(firstNote)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .rpc()
  
  const noteLog = await getNoteLog(connection, txSignature)
  const hash = getHash(firstNote, provider.publicKey)
  
  assert(hash === Buffer.from(noteLog.leafNode).toString("hex"))
  assert(firstNote === noteLog.note)
})
```

Next, we’ll create the `Add Max Size Note` test. It is the same as the previous test, but with the second note. 

```tsx
it("Add Max Size Note", async () => {
  // Size of note is limited by max transaction size of 1232 bytes, minus additional data required for the instruction
  const txSignature = await program.methods
    .appendNote(secondNote)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .rpc()
  
  const noteLog = await getNoteLog(connection, txSignature)
  const hash = getHash(secondNote, provider.publicKey)
  
  assert(hash === Buffer.from(noteLog.leafNode).toString("hex"))
  assert(secondNote === noteLog.note)
})
```

Lastly, we’ll create the `Update First Note` test. This is slightly more complex than adding a note. We’ll do the following:

1. Get the Merkle tree root as it’s required by the instruction.
2. Call the `update_note` instruction of our program, passing in the index 0 (for the first note), the Merkle tree root, the first note, and the updated data. Remember, it needs the first note and the root because the program must verify the entire proof path for the note’s leaf before it can be updated. 

```tsx
it("Update First Note", async () => {
  const merkleTreeAccount =
    await ConcurrentMerkleTreeAccount.fromAccountAddress(
      connection,
      merkleTree.publicKey
    )
  
  const rootKey = merkleTreeAccount.tree.changeLogs[0].root
  const root = Array.from(rootKey.toBuffer())

  const txSignature = await program.methods
    .updateNote(0, root, firstNote, updatedNote)
    .accounts({
      merkleTree: merkleTree.publicKey,
      treeAuthority: treeAuthority,
      logWrapper: SPL_NOOP_PROGRAM_ID,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
    })
    .rpc()
  
  const noteLog = await getNoteLog(connection, txSignature)
  const hash = getHash(updatedNote, provider.publicKey)
  
  assert(hash === Buffer.from(noteLog.leafNode).toString("hex"))
  assert(updatedNote === noteLog.note)
})
```

That’s it, congrats! Go ahead and run `anchor test` and you should get four passing tests.

If you’re running into issues, feel free to go back through some of the demo or look at the full solution code in the [Compressed Notes repository](https://github.com/unboxed-software/anchor-compressed-notes). 

# Challenge

Now that you’ve practiced the basics of state compression, add a new instruction to the Compressed Notes program. This new instruction should allow users to delete an existing note. keep in mind that you can’t remove a leaf from the tree, so you’ll need to decide what “deleted” looks like for your program. Good luck!

If you'd like a very simple example of a delete function, check out the [`solution` branch on GitHub](https://github.com/Unboxed-Software/anchor-compressed-notes/tree/solution).

## Completed the lab?

Push your code to GitHub and [tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=60f6b072-eaeb-469c-b32e-5fea4b72d1d1)!
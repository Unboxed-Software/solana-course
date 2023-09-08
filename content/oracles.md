# Oracles

## TL;DR

- Oracles are services that provide external data to a blockchain network
- There are two main Oracle providers on Solana: **Switchboard** and **Pyth**
- You can build your own Oracle to create a custom data feed
- You have to be careful when choosing your data feed providers

## Overview

### What is an Oracle?

Oracles are services that provide external data to a blockchain network. Blockchains by nature are siloed environments that have no knowledge of the outside world. This constraint inherently puts a limit on the use cases for consumer applications built as dApps (decentralized applications). Oracles provide a solution to this limitation by creating a decentralized way to get real-world data on-chain.

Oracles can provide just about any type of data on-chain, for example:

- results of sporting events
- weather data
- political election results
- market data
- randomness

While the exact implementation may differ from blockchain to blockchain, generally Oracles work as follows:

1. Data is sourced off-chain.
2. That data is published on-chain in a transaction and stored in an account.
3. Programs can read the data stored in the account and use it in its logic.

However, Oracles need to be trusted. We need to have confindence in the integrety of the data that they post on-chain. We do this by understanding their decentralized nature, financial incentives and doing our own due-diligence.

### Oracle Network

Since blockchains execute irreversible financial transactions, developers and users must be able to trust the validity and accuracy of the data provided by oracles. The first step in trusting them is understanding how the Oracle Network is implimented. Here are some possible solutions with pros and cons:

1. Single centralized oracle publishes data on-chain.
    1. Pro: It’s simple, one source of truth.
    2. Con: Nothing stopping the oracle provider from providing inaccurate data. 
2. Network of oracles publish data and a consensus mechanism is used to determine the final result.
    1. Pro: Consensus makes it less likely that bad data is pushed to chain. 
    2. Con: There is no way to disincentivize bad actors if they do publish inaccurate data.
3. Require oracles to stake in order to participate in the consensus mechanism. On every response, if an oracle deviates by some threshold from the accepted range of results, their stake is taken by the protocol and can no longer report.
    1. Pro: Ensures no single oracle can influence the final result too drastically, while also incentivizing honest and accurate actions. By introducing a staking mechanism, it’s in the oracle providers best interest to ensure their data is accurate in order to keep their staked funds.
    2. Con: If the total value involved of the downstream applications are greater than the oracle's allocated stake, they could be incentivized to collude.

It is your job to know how the Oracle Network is configured and make a judgement call on if they can be trusted. Generally, Oracles should only be used for non mission-critical functions and worst-case scenarios should be accounted for.

### Oracles on Solana

Pyth and Switchboard are the two main oracle providers on Solana today. They’re each unique and follow slightly different design choices.

**Pyth** is primarily focused on financial data published from top tier financial institutions. Pyth’s data providers publish the market data updates. These updates are then aggregated and published on-chain by the Pyth program. The data sourced from Pyth is not completely decentralized, only approved data providers can publish data. The selling point of Pyth is that its data is vetted directly by the platform and sourced from financial institutions, ensuring higher quality.

**Switchboard** is a completely decentralized oracle network and has data of all kinds available, not just financial data. Check out all of the feeds [here](https://app.switchboard.xyz/solana/devnet/explore) Additonally, anyone can run a Switchboard oracle, and anyone can consume their data. This means you'll have to be dilligent onthe feeds you trust, we'll talk more about what to look for later in the lesson.

Switchboard follows a variation of the stake weighted oracle network described in the third option of the previous section. It does so by introducing what are called TEEs (Trusted Execution Enviroments). TEEs are secure environments isolated from the rest of the system where sensitive code can be executed. In simple terms, given a program and an input, TEEs can execute and generate an output along with a proof. If you’d like to learn more about TEEs, please read [Switchboard’s docs](https://docs.switchboard.xyz/functions).

By introducing TEEs on top of stake weighted oracles, Switchboard is able to verify each oracle’s software to allow participation in the network. If an oracle operator acts maliciously and attempts to change the operation of the approved code, a data quote verification will fail. This allows Switchboard oracles to operate beyond quantitative value reporting, such as functions -- running off-chain custom and confidential computations.

### Switchboard Oracles

Switchboard oracles store data on Solana using data feeds, which are regular Solana accounts called Aggregators managed by the Switchboard program. When an oracle updates, it writes the data directly to these Aggregator accounts. Let's go over this account and other terms to understand how Switchboard works.

- **[Aggregator (Data Feed)](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60)** - Contains the data feed configuration, dictating how data feed updates get requested, updated, and resolved on-chain from it’s assigned source. The Aggregator is the account owned by the Switchboard Solana program and is where the data is published on-chain.
- **[Job](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/job.rs)** - Each data source should correspond to a job account, which is just a collection of Switchboard tasks, used to instruct the oracles on how to fetch and transform data. In other words, it stores the blueprints for how data is fetched off-chain for a particular data source.
- **Oracle -** A separate program that sits between the internet and the blockchain and facilitates the flow of information. An oracle reads in a feed’s job definitions, calculates the result, and submits its response on-chain.
- **Oracle Queue -** A group of oracles that get assigned to update requests in a round-robin fashion. The oracles in the queue must be actively heartbeating on-chain in order to provide updates. Data and configurations for this queue are stored on-chain in an [account owned by the Switchboard program](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/src/generated/oracle-program/accounts/OracleQueueAccountData.ts#L8).
- **Oracle Consensus** - Determines how oracles come to agreement on the accepted on-chain result. Switchboard oracles use the median oracle response as the accepted result. A feed authority can control how many oracles are requested and how many must respond to influence its security.

Switchboard oracles are incentivized to update data feeds because they are rewarded for doing so accurately. Each data feed has a `LeaseContract`, which is a pre-funded escrow account to reward oracles for fulfilling update requests. Only the predefined `leaseAuthority` can withdraw funds from the contract, but anyone can contribute to it. When a new round of updates is requested for a data feed, the user who requested the update is rewarded from the escrow. This is to incentivize users and crank turners (anyone who runs software to systematically send update requests to Oracles) to keep feeds updating based on a feed’s configurations. Once an update request has been successfully fulfilled and submitted on-chain by the oracles in the queue, the oracles are transferred a reward from the escrow as well. This is to incentivize users to keep running the oracles themselves.

Additionally, oracles are required to stake tokens before they can service update requests and submit responses on-chain. If an oracle submits a result on-chain that is outside the queue’s configured parameters, their stake will be slashed ( if the queue has `slashingEnabled` ). This helps ensure that oracles are responding in good faith with accurate information.

Now that we understand the terminology and economics, let’s take a look at how data is published on-chain:

1. Oracle queue is set up. When an update is requested from a queue, the next N oracles are assigned to the update request and cycled to the back of the queue. Each oracle queue in the Switchboard network is independent and maintain their own configurations which influences its level of security. This design choice enables users to tailor the oracle queue's behavior to match their specific use case. An Oracle queue is stored on-chain as an account and contains metadata about the queue. A queue is created by invoking the [oracleQueueInit instruction](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/src/generated/oracle-program/instructions/oracleQueueInit.ts#L13) on the Switchboard Solana program.
    1. Some relevant Oracle Queue configurations:
        1. `oracle_timeout` - Interval when stale oracles will be removed if they fail to heartbeat.
        2. `reward` - Rewards to provide oracles and round openers on this queue.
        3. `min_stake` - The minimum amount of stake oracles must present to remain on the queue.
        4. `size` - Current number of oracles on a queue.
        5. `max_size` - Maximum number of oracles a queue can support.
2. An aggregator/data feed is set up on-chain as an account. A feed belongs to a single oracle queue. The feed’s configs dictate how update requests are invoked and routed through the network.
3. In addition to the feed, a job account for each data source must be set up that will define how oracles can fulfill the feed’s update requests, this includes defining where the oracles should fetch the data the feed is requesting.
4. Once an update has been requested with the feed account, the oracle queue assigns the request to different oracles/nodes in the queue to fulfill. The oracles will fetch the data from the data source defined in each of the feed’s job accounts. Each job account has a weight associated with it. The oracle will calculate the weighted median of the results. 
5. After ***minOracleResults*** responses are received, the on-chain program calculates the result using the median of the oracle responses. Oracles who responded within the queue’s configured parameters are rewarded, while the oracles who respond outside this threshold are slashed (if the queue has `slashingEnabled`).
6. The updated result is stored in the data feed account that can be read/consumed on-chain.

### How to use Switchboard Oracles

To use Switchboard oracles and incorporate off-chain data into a Solana program, we first have to find a feed that provides the data we need. Switchboard feeds are public and there are many [already available that we can pick from](https://app.switchboard.xyz/solana/devnet/explore). When looking for a feed, you have to decide how accurate/reliable you want the feed, where you want to source the data from, as well as the feed’s update cadence. When consuming a publicly available feed, you have no control over these things, so choose carefully!

For example, here is a Switchboard sponsored [BTC_USD feed](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee) available on Solana devnet/mainnet with pubkey `8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee`. This feed provides the current price of Bitcoin in USD on-chain.

The actual on-chain data for a Switchboard feed account looks a little like this:

```rust
// from the switchboard solana program
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60

pub struct AggregatorAccountData {
    /// Name of the aggregator to store on-chain.
    pub name: [u8; 32],
    ...
		...
    /// Pubkey of the queue the aggregator belongs to.
    pub queue_pubkey: Pubkey,
    ...
    /// Minimum number of oracle responses required before a round is validated.
    pub min_oracle_results: u32,
    /// Minimum number of job results before an oracle accepts a result.
    pub min_job_results: u32,
    /// Minimum number of seconds required between aggregator rounds.
    pub min_update_delay_seconds: u32,
    ...
    /// Change percentage required between a previous round and the current round. If variance percentage is not met, reject new oracle responses.
    pub variance_threshold: SwitchboardDecimal,
    ...
		/// Latest confirmed update request result that has been accepted as valid. This is where you will find the data you are requesting in latest_confirmed_round.result
	  pub latest_confirmed_round: AggregatorRound,
		...
    /// The previous confirmed round result.
    pub previous_confirmed_round_result: SwitchboardDecimal,
    /// The slot when the previous confirmed round was opened.
    pub previous_confirmed_round_slot: u64,
		...
}
```

You can view the full code for this data structure in the [Switchboard program here](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60).

Some relevant fields and configurations on the `AggregatorAccountData` type are:

- `min_oracle_results` - Minimum number of oracle responses required before a round is validated.
- `min_job_results` - Minimum number of job results before an oracle accepts a result.
- `variance_threshold` - Change percentage required between a previous round and the current round. If variance percentage is not met, reject new oracle responses.
- `latest_confirmed_round` - Latest confirmed update request result that has been accepted as valid. This is where you will find the data of the feed in `latest_confirmed_round.result`
- `min_update_delay_seconds` - Minimum number of seconds required between aggregator rounds.

The first three configs listed above are directly related to the accuracy and reliability of a data feed. `min_job_results` is the minimum amount of successful responses from data sources an oracle must receive before it can submit its response on-chain. Meaning if `min_job_results` is three, each oracle has to pull from three job sources. The higher this number, the more reliable and accurate the data on the feed will be. This also limits the impact that a single data source can have on the result. `min_oracle_results` is the minimum amount of oracle responses required for a round to be successful. Remember, each oracle in a queue pulls data from each source defined as a job. The oracle then takes the weighted median of the responses from the sources and submits that median on-chain. The program then waits for `min_oracle_results` of weighted medians and takes the median of that, which is the final result stored in the data feed account. `min_update_delay_seconds` is directly related to a feed’s update cadence. `min_update_delay_seconds` must have passed between one round of updates and the next one before the Switchboard program will accept results.

Take a look at the jobs tab at the bottom of the [BTC_USD](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee) feed in the explorer. Each job listed defines the source the oracles will fetch data from and the weighting of each source. You can view the actual API endpoints that provide the data for this specific feed. When determining what data feed to use in your program, things like this are very important to consider.

For example, we can see two of the sources of data for the BTC_USD feed are [MEXC](https://www.mexc.com/) and [Coinbase](https://www.coinbase.com/).

![Oracle Jobs](../assets/oracle-jobs.png)

For some more information about best practices when choosing a feed to consume, please refer to the **Best Practices and Common Pitfalls** seciton.

Once you’ve found the feed for you, it’s time to move on to actually reading the data in that feed. You do this by simply deserializing and reading the state stored in the account. The easiest way to do that is by making use of the `AggregatorAccountData` struct we defined above from the `switchboard_v2` crate in your program. 

```rust
// import anchor and switchboard crates
use {
    anchor_lang::prelude::*,
    switchboard_v2::AggregatorAccountData,
};

...

#[derive(Accounts)]
pub struct ConsumeDataAccounts<'info> {
	// pass in data feed account and deserialize to AggregatorAccountData
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
	...
}
```

Notice that we use the `AccountLoader` here instead of the normal `Account` to deserialize the aggregator account. You probably noticed that the `AggregatorAccountData` is a very large data struct and we only have so much memory on the stack and heap for Solana programs. `AccountLoader` allows us to facilitate on demand zero copy deserialization for very large accounts without worrying about hitting stack or heap limits. When using `AccountLoader` we can access the data stored in the account in one of three ways:

- `load_init` after initializing an account (this will ignore the missing account discriminator that gets added only after the user’s instruction code)
- `load` when the account is not mutable
- `load_mut` when the account is mutable

Refer here for more information on [the `AccountLoader` type](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/account_loader/struct.AccountLoader.html) or [Zero copy deserialization](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html). If you’d like to learn more, check out the [Advance Program Architecture lesson](./program-architecture.md) of this module where we touch on `Zero-Copy` and the `AccountLoader`.

Once you’ve got passed in and deserialized the account, you can use your to utilize some methods defined on the `AggregatorAccountData` to get the most up to date result.

```rust
// inside an Anchor program
...

let feed = &ctx.accounts.feed_aggregator.load()?;
// get result
let val: f64 = feed.get_result()?.try_into()?;
```

We will use the `get_result()` method defined on the `AggregatorAccountData` struct instead of just fetching the data with `latest_confirmed_round.result`. We do this because Switchboard has implemeted some nifty safety checks.

```rust
// from switchboard program
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L195

pub fn get_result(&self) -> anchor_lang::Result<SwitchboardDecimal> {
    if self.resolution_mode == AggregatorResolutionMode::ModeSlidingResolution {
        return Ok(self.latest_confirmed_round.result);
    }
    let min_oracle_results = self.min_oracle_results;
    let latest_confirmed_round_num_success = self.latest_confirmed_round.num_success;
    if min_oracle_results > latest_confirmed_round_num_success {
        return Err(SwitchboardError::InvalidAggregatorRound.into());
    }
    Ok(self.latest_confirmed_round.result)
}
```

You could just use `latest_confirmed_round.result`, but `get_result()` will be safer.

You can also view the current value stored in an `AggregatorAccountData` account client side in Typescript.

```tsx
import { AggregatorAccount, SwitchboardProgram} from '@switchboard-xyz/solana.js'

...
...
// create keypair for test user
let user = new anchor.web3.Keypair()

// fetch switchboard devnet program object
switchboardProgram = await SwitchboardProgram.load(
  "devnet",
  new anchor.web3.Connection("https://api.devnet.solana.com"),
  user
)

// pass switchboard program object and feed pubkey into AggregatorAccount constructor
aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

// fetch latest SOL price
const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
if (solPrice === null) {
  throw new Error('Aggregator holds no value')
}
```

Remember, Switchboard data feeds are just accounts that are updated by third parties (oracles). With that, there is a lot to think about when choosing what feed to use and how your program actually consumes it.

### Best Practices and Common Pitfalls

When incorporating Switchboard feeds into our programs, there are two groups of concerns we need to consider: choosing a feed and actually consuming the data in that feed.

When choosing a feed, we should look at the details of any feed we consider using. For example, you should always audit the configurations of a feed before deciding to incorporate it into a program. Configurations like **Min Update Delay**, **Min job Results**, and **Min Oracle Results** can directly effect the data that is eventually persisted on-chain to the aggregator account. Looking at the config section of the [BTC_USD feed](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee) from earlier we can see its relevant configurations.

![Oracle Configs](../assets/oracle-configs.png)

The BTC_USD feed has Min Update Delay = 6 seconds. This means that the price of BTC is only updated at a minimum of every 6 seconds on this feed. This is probably fine for most use cases, but if you wanted to use this feed for something latency sensitive, it’s probably not a good choice.

It’s also worthwhile to audit the sources the oracles are configured to fetch the data from in the Jobs section of the oracle explorer. Since the value that is persisted on-chain is the weighted median result the oracles pull from each source, the sources directly influence what is stored in the feed. Check for shady links and poteintally run the API's yourself.

Once you have found a feed that fits your needs, there are still some things that you should verify on-chain in your program before consuming the data in the feed. Since the feed is just an account, any account can be passed in the instruction, so we should verify it’s the account we expected it to be. In Anchor, if you deserialize the account to the `AggregatorAccountData` type from the `switchboard_v2` crate, Anchor inherently checks that the account is owned by the Switchboard program. If your program expects that only a specific data feed will be passed in the instruction, then you can also verify the public key of the account passed in matches what it should be. One way to do this is to hard code the address in the program somewhere and use account constraints to verify the address passed in matches what is expected.

```rust
use {
  anchor_lang::prelude::*,
  solana_program::{pubkey, pubkey::Pubkey},
	switchboard_v2::{AggregatorAccountData},
};

pub static BTC_USDC_FEED: Pubkey = pubkey!("8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee");

...
...

#[derive(Accounts)]
pub struct TestInstruction<'info> {
	// Switchboard SOL feed aggregator
	#[account(
	    address = BTC_USDC_FEED
	)]
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
}
```

After auditing the actual data feed you want to use and verifying that the account passed in to your program is what you expect, you can also do some checks on the data stored in the feed in the program logic. Two common things to check for are data staleness and the confidence interval.

Each data feed updates the current value stored in it when triggered by the oracles. This means the updates are dependent on the oracles in the queue that it’s assigned to. Depending on what you intend to use the data feed for, it may be beneficial to verify that the value stored in the account was updated recently. For example, a lending protocol that needs to determine if a loan’s collateral has fallen below a certain level, the most recent update should be within the last few seconds. Luckily, the timestamp of the most recent update is stored on the aggregator account in unix time. The following code snippet checks that the timestamp of the most recent update on the data feed was no more than 30 seconds ago.

```rust
use {
    anchor_lang::prelude::*,
    anchor_lang::solana_program::clock,
    switchboard_v2::{AggregatorAccountData, SwitchboardDecimal},
};

...
...

let feed = &ctx.accounts.feed_aggregator.load()?;
if (clock::Clock::get().unwrap().unix_timestamp - feed.latest_confirmed_round.round_open_timestamp) <= 30{
      valid_transfer = true;
  }
```

The `latest_confirmed_round` field on the `AggregatorAccountData` struct is of type `AggregatorRound` defined as:

```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L17

pub struct AggregatorRound {
    /// Maintains the number of successful responses received from nodes.
    /// Nodes can submit one successful response per round.
    pub num_success: u32,
    /// Number of error responses.
    pub num_error: u32,
    /// Whether an update request round has ended.
    pub is_closed: bool,
    /// Maintains the `solana_program::clock::Slot` that the round was opened at.
    pub round_open_slot: u64,
    /// Maintains the `solana_program::clock::UnixTimestamp;` the round was opened at.
    pub round_open_timestamp: i64,
    /// Maintains the current median of all successful round responses.
    pub result: SwitchboardDecimal,
    /// Standard deviation of the accepted results in the round.
    pub std_deviation: SwitchboardDecimal,
    /// Maintains the minimum node response this round.
    pub min_response: SwitchboardDecimal,
    /// Maintains the maximum node response this round.
    pub max_response: SwitchboardDecimal,
    /// Pubkeys of the oracles fulfilling this round.
    pub oracle_pubkeys_data: [Pubkey; 16],
    /// Represents all successful node responses this round. `NaN` if empty.
    pub medians_data: [SwitchboardDecimal; 16],
    /// Current rewards/slashes oracles have received this round.
    pub current_payout: [i64; 16],
    /// Keep track of which responses are fulfilled here.
    pub medians_fulfilled: [bool; 16],
    /// Keeps track of which errors are fulfilled here.
    pub errors_fulfilled: [bool; 16],
}
```

There are some other relevant fields that may be of interest to you in the Aggregator account like `num_success`,`medians_data`, `std_deviation`, etc. `num_success` is the number of successful responses received from oracles in this round of updates. `medians_data` is an array of all of the successful responses received from oracles this round, this is ultimately the dataset that is used to derive the median and final result. `std_deviation` is the standard deviation of the accepted results in this round. You'd be looking for a low standard deviation, which means that all of the oracle responses were similar. The switchboard program is in charge of updating the relevant fields on this struct every time it receives an update from an oracle.


The `AggregatorAccountData` also has a `check_confidence_interval()` method that you can use as another verification on the data stored in the feed. The method allows you to pass in a `max_confidence_interval` and if the standard deviation of the results received from the oracle is greater than the given `max_confidence_interval`, it returns an error.

```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L228

pub fn check_confidence_interval(
    &self,
    max_confidence_interval: SwitchboardDecimal,
) -> anchor_lang::Result<()> {
    if self.latest_confirmed_round.std_deviation > max_confidence_interval {
        return Err(SwitchboardError::ConfidenceIntervalExceeded.into());
    }
    Ok(())
}
```

You can incorporate this into your program like so:

```rust
use {
    crate::{errors::*},
    anchor_lang::prelude::*,
    std::convert::TryInto,
    switchboard_v2::{AggregatorAccountData, SwitchboardDecimal},
};

...
...

let feed = &ctx.accounts.feed_aggregator.load()?;

// check feed does not exceed max_confidence_interval
feed.check_confidence_interval(SwitchboardDecimal::from_f64(max_confidence_interval))
    .map_err(|_| error!(ErrorCode::ConfidenceIntervalExceeded))?;
```

Lastly, it’ll be important to plan for worst-case scenarios in your programs. Plan for feeds going stale and plan for feed accounts closing. Plan for each edge case, you’re dealing with people’s assets.

### Conclusion

At the end of the day, if you want non-native data on-chain, you’re going to have to use oracles. And though they are usually financially incentivized, you have to do your own diligence trusting them. Fortunately, Switchboard makes that easier for us by providing all of the info we need to make informed decisions. Consuming the data on-chain is fairly straight forward, but make sure to do the right checks.

## Demo

### Program Setup

We’ll be building a ‘Burry Escrow’ program. The goal of this program is to allow users to lock up SOL in an escrow account that does not unlock until the price of SOL is above a certain price in USD. We will be using the devnet [SOL_USD](https://app.switchboard.xyz/solana/devnet/feed/GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR) oracle from switchboard. The program will have two main methods:

- Deposit
- Withdraw

To get started, let’s create the program with

```powershell
anchor init burry-escrow
```

Once you have the project created, add the following to the bottom of your Anchor.toml file. This will tell Anchor how to configure our local testing environment. This will allow us to test our program locally without having to deploy and send transactions to devnet.

```powershell
// bottom of Anchor.toml
[test.validator]
url="https://api.devnet.solana.com"

[test]
startup_wait = 10000

[[test.validator.clone]] # sbv2 devnet programID
address = "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"

[[test.validator.clone]] # sbv2 devnet IDL
address = "Fi8vncGpNKbq62gPo56G4toCehWNy77GgqGkTaAF5Lkk"

[[test.validator.clone]] # sbv2 SOL/USD Feed
address="GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
```

Additionally we will want to import the `switchboard-v2` crate in our `Cargo.toml` file. Make sure your dependancies look like the following:

```rust
[dependencies]
anchor-lang = "0.28.0"
switchboard-v2 = "0.4.0"
```

Before we get started with the logic, let’s go over the structure of our program. With small programs, it’s very easy to add all of the smart contract code to a single `lib.rs` file and call it a day. To keep it more organized though, it’s helpful to break it up across different files. Our program will follow this architecture:

`programs/src`

→ `/instructions`

`deposit.rs`

`withdraw.rs`

`mod.rs`

`errors.rs`

`state.rs`

`lib.rs`

The `lib.rs` file will still serve as the entry point to our program, but the logic for each instruction will be contained in their own separate file. Go ahead and create the program architecture described above and we’ll get started.

### lib.rs

Before we write any logic, we are going to setup all of our boilerplate information. Starting with `lib.rs`. Our actual logic will live in the `/instructions` directory.

The `lib.rs` file will serve as the entrypoint to our program. It will define the API endpoints that all transactions must go through. Be sure to run the command `anchor keys list` from your terminal and copy the resulting key into the `declare_id!` macro.

```rust
use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;
use state::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("YOUR_PROGRAM_KEY_HERE");

#[program]
mod burry_oracle_program {

    use super::*;

    pub fn deposit(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: u64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw_handler(ctx)
    }
}
```

### state.rs

Next, we will define our Data account for this program: `EscrowState`. Our data account will store two pieces of info:

- `unlock_price` - This is the cost per sol in usd ( $21.53 )
- `escrow_amount` - To keep track of how many lamports are stored in the escrow account

We will also be defining our PDA seed of `"MICHAEL BURRY"` and our hardcoded SOL_USD oracle pubkey `SOL_USDC_FEED`.

```rust
// in state.rs
use anchor_lang::prelude::*;

pub const ESCROW_SEED: &[u8] = b"MICHAEL BURRY";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState {
    pub unlock_price: f64,
    pub escrow_amount: u64,
}
```

### Errors

Let’s define the custom errors we’ll use throughout the program. inside the `errors.rs` file paste the following:

```rust
use anchor_lang::prelude::*;

#[error_code]
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode {
    #[msg("Not a valid Switchboard account")]
    InvalidSwitchboardAccount,
    #[msg("Switchboard feed has not been updated in 5 minutes")]
    StaleFeed,
    #[msg("Switchboard feed exceeded provided confidence interval")]
    ConfidenceIntervalExceeded,
    #[msg("Current SOL price is not above Escrow unlock price.")]
    SolPriceAboveUnlockPrice,
}
```

### Mod

We are also going to setup our `instructions/mod.rs` file - to let our programming environment have some context. 

```rust
// inside mod.rs
pub mod deposit;
pub mod withdraw;
```

### **Deposit**

Now that we have all of the boilerplate out of the way, lets move onto our Deposit instruction, which will live in the `/src/instructions/deposit.rs` file. When a user deposits, a PDA should be created with the “MICHAEL BURRY” string and the user’s pubkey as seeds. This inherently means a user can only open one escrow account at a time. The instruction should initialize an account at this PDA and send the amount of SOL that the user wants to lock up to it. This will obviously require the user’s signature to do so. Let’s build the Deposit Context struct first. To do that, we need to think about what accounts will be necessary for this instruction. We start with the following:

```rust
//inside deposit.rs
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

#[derive(Accounts)]
pub struct Deposit<'info> {
    // user account
    pub user: Signer<'info>,
    // account to store SOL in escrow
    pub escrow_account: Account<'info, EscrowState>,
		// system program
    pub system_program: Program<'info, System>,
}
```

Couple things, we’re requiring the `user` be a Signer on this transaction. That is because only someone with access to the User’s private key should be able to initiate an escrow on their behalf. Plus, we have to transfer SOL which requires a signature. We’re deserializing the `escrow_account` to the EscrowState data struct which we defined in the `[state.rs](http://state.rs)` file. Let’s think about some account constraints we can add to this. First and foremost, because we will be transferring SOL from the User account to the `escrow_state` account, they both need to be mutable! If an account is not marked as mutable, we cannot transfer SOL to or from it in the transaction.

```rust
// user account
#[account(mut)]
pub user: Signer<'info>,
// account to store SOL in escrow
#[account(mut)]
pub escrow_account: Account<'info, EscrowState>,
```

Next, we know the `escrow_account` is supposed to be a PDA derived with the “MICHAEL BURRY” string and the user’s pubkey. We can use Anchor account constraints to guarantee that the address passed in actually meets that requirement.

```rust
// account to store SOL in escrow
#[account(
    mut,
    seeds = [ESCROW_SEED, user.key().as_ref()],
    bump,
)]
pub escrow_account: Account<'info, EscrowState>,
```

We also know that we have to initialize an account at this PDA to store some state for the program. So, we can use Anchor constraints to do this.

```rust
// account to store SOL in escrow
#[account(
    init,
    seeds = [ESCROW_SEED, user.key().as_ref()],
    bump,
    payer = user,
    space = std::mem::size_of::<EscrowState>() + 8
)]
pub escrow_account: Account<'info, EscrowState>,
```

Notice that we removed the mut constraint. This is because we used init which inherently means the account must be mutable. Anchor verifies that behind the scenes when we use init. We also specify who pays for the rent/tx fees needed to create this account and the amount of space needed. The amount of space we need is the size of the `EscrowState` struct an an extra 8 bytes for the account discriminator. 

Let’s move onto the actual logic. All we need to do is to initialize the state of the `escrow_state` account and transfer the SOL. We expect the user to pass in the amount of SOL they want to lock up in escrow and the price to unlock it at. We will store these values in the `escrow_state` account.

```rust
pub fn deposit_handler(ctx: Context<Deposit>, escrow_amt: u64, unlock_price: u64) -> Result<()> {
		msg!("Depositing funds in escrow...");

    let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;
}
```

Next, the method should execute the transfer. This program will be locking up native SOL. Because of this we don’t need to use token accounts or the Solana token program. We’ll have to use the `system_program` to transfer the lamports the user wants to lock up in escrow and invoke the transfer instruction.

```rust
let transfer_ix = transfer(
    &ctx.accounts.user.key(),
    &escrow_state.key(),
    escrow_amount
);

invoke(
    &transfer_ix,
    &[
        ctx.accounts.user.to_account_info(),
        ctx.accounts.escrow_account.to_account_info(),
        ctx.accounts.system_program.to_account_info()
    ]
)?;

msg!("Transfer complete. Escrow will unlock SOL at {}", &ctx.accounts.escrow_account.unlock_price);
```

That’s is the jist of the deposit instruction! The final result of the `deposit.rs` file should look like:

```rust
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

pub fn deposit_handler(ctx: Context<Deposit>, escrow_amount: u64, unlock_price: f64) -> Result<()> {
    msg!("Depositing funds in escrow...");

    let escrow_state = &mut ctx.accounts.escrow_account;
    escrow_state.unlock_price = unlock_price;
    escrow_state.escrow_amount = escrow_amount;

    let transfer_ix = transfer(
        &ctx.accounts.user.key(),
        &escrow_state.key(),
        escrow_amount
    );

    invoke(
        &transfer_ix,
        &[
            ctx.accounts.user.to_account_info(),
            ctx.accounts.escrow_account.to_account_info(),
            ctx.accounts.system_program.to_account_info()
        ]
    )?;

    msg!("Transfer complete. Escrow will unlock SOL at {}", &ctx.accounts.escrow_account.unlock_price);

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    // account to store SOL in escrow
    #[account(
        init,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        payer = user,
        space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account: Account<'info, EscrowState>,

    pub system_program: Program<'info, System>,
}
```

**Withdraw**

The withdraw instruction will require the same three accounts as the deposit instruction with the of the sol_usdc Switchboard feed account. This code will go in the `withdraw.rs` file. 

```rust
use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    // escrow account
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        close = user
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // Switchboard SOL feed aggregator
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
}
```

Notice we’re using the close constraint because once the transaction completes, we want to close the `escrow_account`. The sol used as rent in the account will be transferred to the user account. We also use the address constraints to verify that the feed account passed in is actually the `usdc_sol` feed and not some other feed (we have the SOL_USDC_FEED address hard coded). In addition, the AggregatorAccountData struct that we deserialize comes from the Switchboard rust crate. It verifies that the given account is owned by the switchboard program and allows us to easily look at it’s values. You’ll notice it’s wrapped in a `AccountLoader`. This is because the feed is actually a fairly large account and it needs to be zero copied ( more about that in another lesson ). 

Moving on to the logic of the withdraw instruction, there are a few things we will want to do. First we are going to check if the feed is stale. Then we fetch the current price of SOL stored in the `feed_aggregator` account. Then, we’ll want to check that the current price is above the escrow `unlock_price`. If it is, then we transfer the SOL from the escrow account back to the user and close the account. If it isn’t, then the instruction should finish and return an error.

```rust
pub fn withdraw_handler(ctx: Context<Withdraw>, params: WithdrawParams) -> Result<()> {
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    // get result
    let val: f64 = feed.get_result()?.try_into()?;

    // check whether the feed has been updated in the last 300 seconds
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Current feed result is {}!", val);
    msg!("Unlock price is {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }

	....
}
```

To finish the logic off, we will execute the transfer, this time we will have to transfer the funds in a different way. Because we are transferring from an account that also holds data we cannot use the `system_program::transfer` method like before. If we try to, the instruction will fail to execute with the following error.

```powershell
'Transfer: `from` must not carry data'
```

To account for this, we’ll use `try_borrow_mut_lamports()` on each account and add/subtract the amount of lamports stored in each account. 

```rust
// 'Transfer: `from` must not carry data'
  **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
      .to_account_info()
      .lamports()
      .checked_sub(escrow_state.escrow_amount)
      .ok_or(ProgramError::InvalidArgument)?;

  **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
      .to_account_info()
      .lamports()
      .checked_add(escrow_state.escrow_amount)
      .ok_or(ProgramError::InvalidArgument)?;
```

The final withdraw method in the `withdraw.rs` file should look like:

```rust
use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

pub fn withdraw_handler(ctx: Context<Withdraw>) -> Result<()> {
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    // get result
    let val: f64 = feed.get_result()?.try_into()?;

    // check whether the feed has been updated in the last 300 seconds
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Current feed result is {}!", val);
    msg!("Unlock price is {}", escrow_state.unlock_price);

    if val < escrow_state.unlock_price as f64 {
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }

    // 'Transfer: `from` must not carry data'
    **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
        .to_account_info()
        .lamports()
        .checked_sub(escrow_state.escrow_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
        .to_account_info()
        .lamports()
        .checked_add(escrow_state.escrow_amount)
        .ok_or(ProgramError::InvalidArgument)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    // user account
    #[account(mut)]
    pub user: Signer<'info>,
    // escrow account
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        close = user
    )]
    pub escrow_account: Account<'info, EscrowState>,
    // Switchboard SOL feed aggregator
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
    pub system_program: Program<'info, System>,
}
```

And that’s it for the program! Now let’s test it! And the first test is always: does it build!? So run

`anchor build`

It should build without a problem. Well, kinda, you can safely ignore the following problem:

```bash
Compiling switchboard-v2 v0.4.0
Error: Function _ZN86_$LT$switchboard_v2..aggregator..AggregatorAccountData$u20$as$u20$core..fmt..Debug$GT$3fmt17hea9f7644392c2647E Stack offset of 4128 exceeded max offset of 4096 by 32 bytes, please minimize large stack variables
```

### Testing

We’re going to kinda speedrun the tests here. But we will be building 4 tests in the `tests/burry-escrow.ts` file.

- Creating an Escrow with the unlock price ***below*** the current Solana price so we can test withdrawing it
- Withdrawing and closing from the above escrow
- Creating an Escrow with the unlock price ***above*** the current Solana price so we can test withdrawing it
- Withdrawing and failing from the above escrow

Note that there can only be one escrow per user, so the above order matters.

```bash
// tests/burry-escrow.ts

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BurryEscrow } from "../target/types/burry_escrow";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram } from "@switchboard-xyz/solana.js"
import { assert } from "chai";

export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

describe("burry-escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.AnchorProvider.env()
  const program = anchor.workspace.BurryEscrow as Program<BurryEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer

  it("Create Burry Escrow Below Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.minus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("On-chain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data on-chain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Withdraw from escrow", async () => {
    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    const tx = await program.methods.withdraw()
    .accounts({
      user: payer.publicKey,
      escrowAccount: escrowState,
      feedAggregator: solUsedSwitchboardFeed,
      systemProgram: anchor.web3.SystemProgram.programId
  })
    .signers([payer])
    .rpc()

    await provider.connection.confirmTransaction(tx, "confirmed")

    // assert that the escrow account has been closed
    let accountFetchDidFail = false;
    try {
      await program.account.escrowState.fetch(escrowState)
    } catch(e){
      accountFetchDidFail = true;
    }

    assert(accountFetchDidFail)
 
  })

  it("Create Burry Escrow Above Price", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      "devnet",
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Escrow Account: ", escrowState.toBase58())

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    // Send transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

      // Fetch the created account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("On-chain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data on-chain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch (e) {
      console.log(e)
      assert.fail(e)
    }
  })

  it("Attempt to withdraw while price is below UnlockPrice", async () => {
    let didFail = false;

    // derive escrow address
    const [escrowState] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    
    // send tx
    try {
      const tx = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
    })
      .signers([payer])
      .rpc()

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

    } catch (e) {
      // verify tx returns expected error
      didFail = true;
      console.log(e.error.errorMessage)
      assert(e.error.errorMessage == 'Current SOL price is not above Escrow unlock price.')
    }

    assert(didFail)
  })
});
```

With that all written you should be able to run `anchor test` in your terminal and get 4 passing tests!

If you don’t something is wrong, feel free to check the working code [here](https://github.com/CoachChuckFF/Micheal-Burry-Escrow).

## Challenge

As a challenge to take what you’ve learned in this lesson and apply it, create a fallback plan if the data feed ever goes down. If the Oracle queue has not updated the aggregator account in X time or if the data feed account does not exist anymore, withdraw the user’s escrowed funds.

A potential solution to this challenge can be found [here](https://github.com/CoachChuckFF/Micheal-Burry-Escrow/tree/solution).
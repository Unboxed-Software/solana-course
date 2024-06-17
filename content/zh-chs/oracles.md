---
title: 预言机和预言机网络
objectives:
- 解释为什么链上程序无法轻易访问真实世界的数据
- 解释预言机如何解决链上访问真实世界数据的问题
- 解释有奖励的预言机网络如何使数据更可信
- 有效地权衡使用各种类型的预言机的权衡
- 使用预言机从链上程序中访问真实世界的数据
---

**译者**: [ben46](https://github.com/ben46)

# 摘要

- 预言机是为区块链网络提供外部数据的服务
- Solana 上有两大主要预言机提供商：**Switchboard** 和 **Pyth**
- 您可以建立自己的预言机来创建自定义数据源
- 在选择数据源提供商时需要谨慎选择

# 课程

预言机是为区块链网络提供外部数据的服务。区块链本质上是封闭的环境，不了解外部世界。这种限制从根本上对去中心化应用（dApps）的用例设定了限制。预言机通过在链上创建一种去中心化的方法来获取真实世界数据，从而为这种限制提供了解决方案。

预言机可以提供几乎任何类型的链上数据。例如：

- 体育赛事结果
- 天气数据
- 政治选举结果
- 市场数据
- 随机性

虽然确切的实现方式可能因区块链不同而异，但一般来说，预言机的工作方式如下：

1. 数据是链下获取的。
2. 该数据以交易方式发布到链上，并存储在账户中。
3. 程序可以读取存储在账户中的数据并在其逻辑中使用。

本课程将介绍预言机的基本工作原理，在 Solana 上的预言机现状以及如何有效地在 Solana 开发中使用预言机。

## 信任和预言机网络

预言机需要克服的主要障碍是信任。由于区块链执行不可逆转的金融交易，开发人员和用户都需要知道他们能够相信预言机数据的有效性和准确性。信任预言机的第一步是了解其实现方式。

广义上来说，有三种实现类型：

1. 单一的中心化预言机在链上发布数据。
    1. 优势：简单；只有一个真相来源。
    2. 缺点：没有任何阻止预言机提供商提供不准确数据的机制。
2. 一群预言机发布数据，并使用共识机制确定最终结果。
    1. 优势：共识使不良数据进入链上的可能性降低。
    2. 缺点：无法阻止不良行为者发布不良数据并影响共识的机制。
3. 具有某种权益证明机制的预言机网络。即需要预言机押注代币参与共识机制。在每次回应时，如果预言机偏离接受范围的结果，其押金将被协议收走，并且它们将无法再报告。
    1. 优势：确保没有单一预言机能够对最终结果产生太大的影响，同时激励诚实和准确的行为。
    2. 缺点：构建去中心化网络具有挑战性，需要正确设置激励并足够吸引参与等。

根据预言机的用例，上述任何一种解决方案都可能是正确的方法。例如，您可能完全愿意参与一个利用中心化预言机在链上发布游戏信息的基于区块链的游戏。

另一方面，您可能不太愿意信任为交易应用程序提供价格信息的中心化预言机。

对于您自己的应用程序，您可能最终创建了许多独立的预言机，只是为了获取您需要的链下信息。然而，这些预言机不太可能被更广泛的社区使用，因为去中心化是其核心原则。您也应该对使用中心化的第三方预言机持谨慎态度。

在理想的情况下，所有重要和/或有价值的数据都将通过一个高效的预言机网络通过一个值得信赖的权益证明共识机制提供在链上。通过引入押注机制，预言机提供商有充分的动机确保其数据的准确性以保留其抵押资金。

即使预言机网络声称具有此类共识机制，也要了解使用网络时涉及的风险。如果下游应用程序所涉及的总价值大于预言机的分配押金，预言机仍然可能有足够的动机串通。

您的工作是了解预言机网络的配置，并判断其是否值得信赖。一般来说，预言机只应用于非关键功能，并应考虑最坏情况。

## Solana 上的预言机

[Pyth](https://pyth.network) 和 [Switchboard](https://switchboard.xyz) 是当前Solana上的两大主要预言机提供商。它们各具特色并遵循略有不同的设计选择。

**Pyth** 主要专注于来自顶级金融机构发表的金融数据。Pyth 的数据提供商发布市场数据更新。然后 Pyth 程序通过汇总这些数据并在链上发布来获取数据。Pyth 源自的数据并不完全分散，因为只有经批准的数据提供商才能发布数据。Pyth 的卖点是其数据直接由平台审核并来自金融机构，确保更高的质量。

**Switchboard** 是一个完全去中心化的预言机网络，并提供各种类型的数据。您可以在他们的网站上查看所有的信息源[https://app.switchboard.xyz/solana/devnet/explore](https://app.switchboard.xyz/solana/devnet/explore) 此外，任何人都可以运行 Switchboard 预言机，并且任何人都可以使用其数据。这意味着您需要在研究信息源时要谨慎。我们将在本课程的后面更多地讨论要注意的事项。

Switchboard 遵循了上一节中第三种选择的押注权重预言机网络的变种。它通过引入所谓的 TEEs（受信任执行环境）来实现。TEEs 是与系统其余部分隔离的安全环境，在其中可以执行敏感代码。简单来说，给定一个程序和一个输入，TEE 可以执行并生成一个输出以及一个证明。如果您想了解更多关于 TEEs 的信息，请阅读 [Switchboard 的文档](https://docs.switchboard.xyz/functions)。

通过在押注权重预言机之上引入 TEEs，Switchboard 可以验证每个预言机的软件，允许其参与网络。如果预言机运营商恶意行事并试图更改经批准的代码的操作方式，数据引用验证将失败。这使得 Switchboard 预言机能够处理超出量化价值报告的功能，如运行链下自定义和保密计算。

## Switchboard 预言机

Switchboard 预言机使用数据源在 Solana 上存储数据。这些数据源，也称为聚合器，每个都是一组作业，用于聚合生成一个单一的结果。这些聚合器在链上表示为 Switchboard 程序管理的常规 Solana 账户。当预言机更新时，它会直接将数据写入这些账户。让我们了解一些术语，以理解 Switchboard 的工作方式：


- **[收集器（数据源）](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60)** - 包含数据源配置，指示如何从其分配的来源请求、更新和解决数据源更新。收集器是由Switchboard Solana程序拥有的账户，也是数据在链上发布的地方。
- **[工作](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/job.rs)** - 每个数据源应对应一个工作账户。工作账户是一组用于指示预言机如何获取和转换数据的Switchboard任务。换句话说，它存储了如何为特定数据源从链下获取数据的蓝图。
- 预言机 - 位于互联网和区块链之间并促进信息流的一个单独程序。预言机读取数据源的工作定义，计算结果，并提交其响应到链上。
- 预言机队列 - 一组预言机按照轮询方式分配的更新请求。队列中的预言机必须在链上进行主动心跳以提供更新。该队列的数据和配置存储在链上的[由Switchboard程序拥有的账户](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/src/generated/oracle-program/accounts/OracleQueueAccountData.ts#L8)中。
- 预言机共识 - 确定预言机在链上结果上达成的方式。Switchboard预言机使用中位预言机响应作为被接受的结果。数据源权威可以控制请求多少预言机以及需要多少响应来影响其安全性。

Switchboard预言机受到激励来更新数据源，因为他们会因准确更新而受到奖励。每个数据源都有一个`LeaseContract`账户。租约合同是一个预先资助的托管账户，用于奖励预言机履行更新请求。只有预定义的`leaseAuthority`可以从合同中提取资金，但任何人都可以为其做出贡献。当为数据源请求新一轮更新时，请求更新的用户将从托管账户中获得奖励。这是为了激励用户和转动曲柄者（任何以系统方式发送更新请求到预言机的软件）根据数据源的配置保持更新。一旦更新请求成功完成并由队列中的预言机在链上提交，预言机也从托管账户中获得奖励。这些支付确保了积极的参与。

另外，预言机必须在能够为更新请求提供服务和提交响应到链上之前抵押代币。如果一个预言机提交了一个在链上超出队列配置参数范围的结果，其抵押会被扣除（如果队列启用了`slashingEnabled`）。这有助于确保预言机诚实地回应准确的信息。

现在你已经了解了术语和经济学，让我们来看看数据是如何在链上发布的：

1. 预言机队列设置 - 当从队列请求更新时，下一个`N`个预言机被分配到更新请求并循环到队列的后面。Switchboard网络中的每个预言机队列是独立的并维护其自己的配置。此设计选择使用户能够定制预言机队列的行为以匹配其特定的用例。预言机队列作为账户存储在链上，并包含有关队列的元数据。可以通过在Switchboard Solana程序上调用[oracleQueueInit指令](https://github.com/switchboard-xyz/solana-sdk/blob/9dc3df8a5abe261e23d46d14f9e80a7032bb346c/javascript/solana.js/src/generated/oracle-program/instructions/oracleQueueInit.ts#L13) 来创建队列。
    1. 一些相关的预言机队列配置:
        1. `oracle_timeout` - 在此间隔后，如果陈旧的预言机无法进行心跳，则将被移除。
        2. `reward` - 为预言机和轮开放者提供的奖励。
        3. `min_stake` - 预言机必须提供的最低抵押数量，以保持在队列上。
        4. `size` - 队列上的预言机的当前数量。
        5. `max_size` - 队列能够支持的最大预言机数量。
2. 收集器/数据源设置 - 创建了收集器/数据源账户。一个数据源属于单个预言机队列。数据源的配置指示如何通过网络调用更新请求并路由。
3. 工作账户设置 - 除了数据源，必须设置每个数据源的工作账户。这定义了预言机如何履行数据源的更新请求。这包括定义预言机应该从数据源处获取数据。
4. 请求分配 - 一旦使用数据源账户请求了更新，预言机队列将该请求分配给队列中的不同预言机/节点来履行。预言机将从数据源的每个工作账户中定义的数据源中获取数据。每个工作账户都有相关权重。预言机将计算所有工作的结果的加权中位数。
5. 在接收到`minOracleResults`个响应后，链上程序使用预言机响应的中位数计算结果。在队列的配置参数内响应的预言机会受到奖励，而在此阈值外响应的预言机会被扣除（如果队列启用了`slashingEnabled`）。
6. 更新后的结果存储在数据源账户中，以便在链上读取/消耗。

### 如何使用Switchboard预言机

要使用Switchboard预言机并将链下数据纳入Solana程序中，首先必须找到一个提供所需数据的数据源。Switchboard数据源是公开的，有很多[可以选择](https://app.switchboard.xyz/solana/devnet/explore)。在寻找数据源时，您必须决定您需要的数据源的准确性/可靠性，您想要从哪里获取数据，以及数据源的更新节奏。在使用公开可用的数据源时，您无法控制这些事情，因此请谨慎选择！


例如，有一个由Switchboard赞助的[BTC_USD feed](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee)。此feed在Solana开发网/主网上可用，使用公钥`8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee`。它提供了比特币对美元的当前价格的链上数据。

对于Switchboard feed账户的实际链上数据看起来有点像这样：

```rust
// 来自switchboard solana程序
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60

pub struct AggregatorAccountData {
    /// 在链上存储的聚合器的名称。
    pub name: [u8; 32],
    ...
		...
    /// 聚合器所属的队列的公钥。
    pub queue_pubkey: Pubkey,
    ...
    /// 在验证循环之前要求的最低数量的预言机响应。
    pub min_oracle_results: u32,
    /// 在预言机接受结果之前要求的最低数量的作业结果。
    pub min_job_results: u32,
    /// 在聚合器循环之间要求的最低秒数。
    pub min_update_delay_seconds: u32,
    ...
    /// 在前一轮和当前轮之间所需的变化百分比。如果未满足变化百分比要求，则拒绝新预言机响应。
    pub variance_threshold: SwitchboardDecimal,
    ...
		/// 最新经过确认的更新请求结果，已被接受为有效。您将在latest_confirmed_round.result中找到您请求的数据。
	  pub latest_confirmed_round: AggregatorRound,
		...
    /// 之前确认的循环结果。
    pub previous_confirmed_round_result: SwitchboardDecimal,
    /// 之前确认的循环开始时的槽位。
    pub previous_confirmed_round_slot: u64,
		...
}
```

您可以在[此处查看有关此数据结构的完整代码](https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L60)。

`AggregatorAccountData`类型的一些相关字段和配置包括：

- `min_oracle_results` - 在验证循环之前要求的最低数量的预言机响应。
- `min_job_results` - 在预言机接受结果之前要求的最低数量的作业结果。
- `variance_threshold` - 在前一轮和当前轮之间所需的变化百分比。如果未满足变化百分比要求，则拒绝新预言机响应。
- `latest_confirmed_round` - 最新经过确认的更新请求结果，已被接受为有效。在`latest_confirmed_round.result`中找到feed的数据。
- `min_update_delay_seconds` - 在聚合器循环之间要求的最低秒数。

上述前三个配置直接关系到数据feed的准确性和可靠性。

`min_job_results`字段代表预言机必须收到的至少成功响应数量，这些响应来自数据源。这意味着如果`min_job_results`为3，每个预言机必须从三个工作来源获取数据。这个数字越高，数据feed上的数据就越可靠和准确。这也限制了单个数据源对结果的影响。

`min_oracle_results`字段是成功完成一轮所需的最少预言机响应数量。记住，队列中的每个预言机都从定义为作业的每个来源中获取数据。预言机然后取所有来源的响应的加权中位数，并将该中位数提交到链上。程序接着等待`min_oracle_results`个加权中位数并取其中位数，这就是存储在数据feed账户中的最终结果。

`min_update_delay_seconds`字段与feed的更新频率直接相关。在Switchboard程序接受结果之前，必须在更新的两轮之间等待`min_update_delay_seconds`秒。

查看Switchboard探索器中feed的作业选项卡可能会有所帮助。例如，您可以查看[探索器中的BTC_USD feed](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee)。列出的每个作业定义了预言机将从中提取数据以及每个来源的加权。您可以查看提供特定feed数据的实际API端点。在确定要在程序中使用哪个数据feed时，类似这样的事项非常重要。

以下是与BTC_USD feed相关的两个作业。它展示了两个数据来源：[MEXC](https://www.mexc.com/) 和 [Coinbase](https://www.coinbase.com/)。

![预言机作业](../assets/oracle-jobs.png)

一旦选择了要使用的feed，您可以开始读取该feed中的数据。方法是简单地反序列化并读取存储在账户中的状态。最简单的方法是利用我们在程序中定义的`switchboard_v2` crate中的`AggregatorAccountData`结构。

```rust
// 导入anchor和switchboard crates
use {
    anchor_lang::prelude::*,
    switchboard_v2::AggregatorAccountData,
};

...

#[derive(Accounts)]
pub struct ConsumeDataAccounts<'info> {
	// 传入数据feed账户并反序列化为AggregatorAccountData
	pub feed_aggregator: AccountLoader<'info, AggregatorAccountData>,
	...
}
```

请注意，这里我们使用`AccountLoader`类型而不是正常的`Account`类型来反序列化聚合器账户。由于`AggregatorAccountData`的大小，该账户使用了所谓的零拷贝。这与`AccountLoader`结合使用，防止账户被加载到内存中，并让我们的程序直接访问数据。当使用`AccountLoader`时，我们可以通过以下三种方式访问账户中存储的数据：

- 在初始化账户后使用`load_init`（这将忽略用户指令代码之后才添加的缺失账户区分符）
- 当账户不可变时使用`load`
- 当账户可变时使用`load_mut`

如果您想了解更多，请查看[Advance Program Architecture lesson](./program-architecture)，我们在那里讨论了`Zero-Copy`和`AccountLoader`。


使用传递到你的程序的聚合器账户，你可以使用它来获取最新的 Oracle 结果。具体来说，你可以使用 type 的 `get_result()` 方法：

```rust
// 在 Anchor 程序内
...

let feed = &ctx.accounts.feed_aggregator.load()?;
// 获取结果
let val: f64 = feed.get_result()?.try_into()?;
```

`AggregatorAccountData` 结构上定义的 `get_result()` 方法比使用 `latest_confirmed_round.result` 获取数据更为安全，因为 Switchboard 实现了一些巧妙的安全检查。

```rust
// 源自 switchboard 程序
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

你也可以在 Typescript 中查看存储在 `AggregatorAccountData` 账户端的当前值。

```tsx
import { AggregatorAccount, SwitchboardProgram} from '@switchboard-xyz/solana.js'

...
...
// 为测试用户创建密钥对
let user = new anchor.web3.Keypair()

// 获取 switchboard devnet 程序对象
switchboardProgram = await SwitchboardProgram.load(
  "devnet",
  new anchor.web3.Connection("https://api.devnet.solana.com"),
  user
)

// 将 switchboard 程序对象和 feed 公钥传递给 AggregatorAccount 构造函数
aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

// 获取最新的 SOL 价格
const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
if (solPrice === null) {
  throw new Error('Aggregator holds no value')
}
```

请记住，Switchboard 数据源只是由第三方（或acles）更新的账户。考虑到这一点，您可以对账户执行任何操作，就像您通常对程序外部的账户一样。

### 最佳实践和常见陷阱

将 Switchboard 数据源整合到您的程序中时，有两组考虑因素需加以考虑：选择一个数据源以及实际消费数据源。

在决定将某个数据源整合到程序中之前，务必审计该数据源的配置。配置项如**最小更新延迟**、**最小作业结果**和**最小 Oracle 结果**会直接影响最终持久化到聚合器账户上的数据。例如，查看[BTC_USD 数据源](https://app.switchboard.xyz/solana/devnet/feed/8SXvChNYFhRq4EZuZvnhjrB3jJRQCv4k3P4W6hesH3Ee)的配置部分，您可以看到其中的相关配置。

![Oracle 配置](../assets/oracle-configs.png)

BTC_USD 数据源的最小更新延迟 = 6 秒。这意味着 BTC 的价格仅在该数据源上最多每 6 秒更新一次。这在大多数用例中可能没有问题，但如果您想将该数据源用于处理延迟敏感的任务时，它可能不是一个好选择。

审计数据源在 oracle 浏览器的 jobs 部分的来源也是值得的。由于在链上持久化的值是每个源的 oracles 拉取的加权中位数结果，这些源会直接影响存储在数据源中的内容。检查可疑的链接并可能自行运行 API 一段时间以增强信心。

找到符合您需求的数据源之后，您仍然需要确保正确使用该数据源。例如，您仍应对传递到您的指令的账户实施必要的安全检查。任何账户都可以被传递到您程序的指令中，因此您应该验证它是否是您预期的账户。

在 Anchor 中，如果您将账户反序列化为从 `switchboard_v2` crate 中的 `AggregatorAccountData` 类型，则 Anchor 会检查该账户是否由 Switchboard 程序拥有。如果您的程序希望只有特定的数据源会被传入指令中，您还可以验证传入的账户的公钥是否与预期的相匹配。其中一种方法是在程序的某处硬编码该地址，并使用账户限制条件验证传入的地址是否与预期值匹配。

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

确保数据源账户是您期望的账户之外，您还可以在程序的指令逻辑中对数据源中存储的数据执行一些检查。常见要检查的两个事项是数据陈旧性和置信区间。

每个数据源在被 oracles 触发时会更新其中存储的当前值。这意味着更新取决于其所分配的 oracle 队列中的 oracles。根据您打算使用数据源的方式，验证存储在数据源中的值是否最近更新可能是有益的。例如，需要确定贷款抵押品是否已经低于一定水平的借贷协议可能需要数据不超过几秒钟。您可以在代码中检查在数据源中存储的最新更新时间戳。以下代码片段检查了数据源中最近更新的时间戳不超过 30 秒。

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

`AggregatorAccountData` 结构上的 `latest_confirmed_round` 字段的类型是`AggregatorRound`，其定义如下：


```rust
// https://github.com/switchboard-xyz/sbv2-solana/blob/0b5e0911a1851f9ca37042e6ff88db4cd840067b/rust/switchboard-solana/src/oracle_program/accounts/aggregator.rs#L17

pub struct AggregatorRound {
    /// 维护从节点收到的成功响应数量。每轮节点可以提交一个成功的响应。
    pub num_success: u32,
    /// 错误响应的数量。
    pub num_error: u32,
    /// 更新请求轮是否已结束。
    pub is_closed: bool,
    /// 维护此轮开启的 `solana_program::clock::Slot`。
    pub round_open_slot: u64,
    /// 维护此轮开启的 `solana_program::clock::UnixTimestamp;`。
    pub round_open_timestamp: i64,
    /// 维护所有成功轮响应的当前中值。
    pub result: SwitchboardDecimal,
    /// 本轮接受的结果的标准偏差。
    pub std_deviation: SwitchboardDecimal,
    /// 维护本轮的最小节点响应。
    pub min_response: SwitchboardDecimal,
    /// 维护本轮的最大节点响应。
    pub max_response: SwitchboardDecimal,
    /// 满足本轮的预言机的 Pubkeys。
    pub oracle_pubkeys_data: [Pubkey; 16],
    /// 代表本轮的所有成功节点响应。如果为空，则为 `NaN`。
    pub medians_data: [SwitchboardDecimal; 16],
    /// 本轮预言机已收到的当前奖励/处罚。
    pub current_payout: [i64; 16],
    /// 跟踪此处已实现的响应。
    pub medians_fulfilled: [bool; 16],
    /// 记录此处已实现的错误。
    pub errors_fulfilled: [bool; 16],
}
```

以下是`AggregatorAccountData`中可能感兴趣的其他相关字段，如`num_success`，`medians_data`，`std_deviation`等。`num_success`是本轮更​​新中从预言机收到的成功响应的数量。`medians_data`是本轮从预言机收到的所有成功响应的数组。这是用于计算中值和最终结果的数据集。`std_deviation`是本轮接受结果的标准偏差。您可能希望检查标准偏差较低，表示所有预言机响应相似。Switchboard程序负责在每次从预言机接收更新时更新此结构的相关字段。

`AggregatorAccountData`中还有一个名为`check_confidence_interval()`的方法，您可以将其用作对存储在feed中的数据的另一个验证。该方法允许您传入`max_confidence_interval`。如果从预言机接收到的结果的标准偏差大于给定的`max_confidence_interval`，它将返回错误。

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

您可以像这样将其合并到您的程序中：

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

// 检查喂养是否超过 max_confidence_interval
feed.check_confidence_interval(SwitchboardDecimal::from_f64(max_confidence_interval))
    .map_err(|_| error!(ErrorCode::ConfidenceIntervalExceeded))?;
```

最后，对于您的程序来说，规划最坏情况至关重要。为喂养变得陈旧和为喂养账户关闭做好计划。

## 结论

如果您想要根据现实世界的数据执行操作的功能性程序，您将不得不使用预言机。幸运的是，有一些可靠的预言机网络，如Switchboard，使使用预言机变得比原本更容易。然而，请确保对您使用的预言机进行尽职调查。最终，您对程序的行为负责！

# 实验

让我们来练习使用预言机！我们将构建一个“Michael Burry Escrow”程序，将SOL锁定在托管账户中，直到SOL价值超过特定的美元价值。这个名字是根据投资者[Michael Burry](https://en.wikipedia.org/wiki/Michael_Burry)而命名的，他因预测了2008年房地产市场崩溃而著名。

我们将使用switchboard的devnet [SOL_USD](https://app.switchboard.xyz/solana/devnet/feed/GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR)预言机。程序将有两个主要指令：

- 存款 - 锁定SOL并设置解锁时的USD价格。
- 取款 - 检查USD价格并在满足条件时提取SOL。

### 1. 程序设置

要开始，让我们使用以下命令创建程序：

```zsh
anchor init burry-escrow
```

接下来，在`lib.rs`和`Anchor.toml`中用`anchor keys list`显示的程序ID替换程序ID。

然后，在Anchor.toml文件的末尾添加以下内容。这将告诉Anchor如何配置我们的本地测试环境。这将允许我们在本地测试程序，而无需部署和向devnet发送交易。

```zsh
// Anchor.toml的末尾
[test.validator]
    url = "https://api.devnet.solana.com"

[test]
    startup_wait = 10000

[[test.validator.clone]] # sbv2 devnet programID
address = "SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f"

[[test.validator.clone]] # sbv2 devnet IDL
address = "Fi8vncGpNKbq62gPo56G4toCehWNy77GgqGkTaAF5Lkk"

[[test.validator.clone]] # sbv2 SOL/USD Feed
address="GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR"
```


此外，我们希望在 `Cargo.toml` 文件中导入 `switchboard-v2` 箱。确保你的依赖项如下所示:

```toml
[dependencies]
anchor-lang = "0.28.0"
switchboard-v2 = "0.4.0"
```

在我们开始处理逻辑之前，让我们先来看看程序的结构。对于小型程序来说，很容易将所有的智能合约代码添加到一个 `lib.rs` 文件中并完成。但是为了保持更有条理，最好将其分散在不同的文件中。我们的程序将在 `programs/src` 目录中创建以下文件:

`/instructions/deposit.rs`

`/instructions/withdraw.rs`

`/instructions/mod.rs`

`errors.rs`

`state.rs`

`lib.rs`

`lib.rs` 文件仍将作为我们程序的入口点，但每个指令的逻辑将包含在它们自己的单独文件中。请按照上述描述创建程序架构，然后我们将开始。

### 2. `lib.rs`

在我们编写任何逻辑之前，我们将设置所有的样板信息。从 `lib.rs` 开始。我们实际的逻辑将存放在 `/instructions` 目录中。

`lib.rs` 文件将作为我们程序的入口点。它将定义所有交易必须经过的 API 端点。

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

### 3. `state.rs`

接下来，让我们为程序定义数据账户: `EscrowState`。我们的数据账户将存储两个信息:

- `unlock_price` - 以 USD 计价的 SOL 价格，达到此价格即可解锁; 你可以将其硬编码为你想要的任何值 (例如 $21.53)
- `escrow_amount` - 跟踪存储在托管账户中的 lamport 数量

我们还将定义我们的 PDA seed 为 `"MICHAEL BURRY"` 和我们硬编码的 SOL_USD oracle 公钥 `SOL_USDC_FEED`。

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

### 4. 错误

让我们定义程序中将使用的自定义错误。在 `errors.rs` 文件中，粘贴以下内容:

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

### 5. `mod.rs`

让我们设置我们的 `instructions/mod.rs` 文件。

```rust
// inside mod.rs
pub mod deposit;
pub mod withdraw;
```

### 6. **存款**

既然我们已经处理完所有的样板内容，让我们来处理我们的存款指令。这将位于 `/src/instructions/deposit.rs` 文件中。当用户存款时，PDA 应创建带有 "MICHAEL BURRY" 字符串和用户公钥作为种子。这从本质上意味着用户一次只能打开一个托管账户。该指令应初始化此 PDA 上的一个帐户，并将用户想要锁定的 SOL 数量发送到该帐户。用户需要成为签署者。

首先让我们构建存款上下文结构。为此，我们需要考虑为该指令需要哪些账户。我们从以下开始:

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
    // 用户账户
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
      init,
      seeds = [ESCROW_SEED, user.key().as_ref()],
      bump,
      payer = user,
      space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account: Account<'info, EscrowState>,
		// 系统程序
    pub system_program: Program<'info, System>,
}
```
**Withdraw**

提款指令将需要与存款指令相同的三个账户，以及 SOL_USDC Switchboard Feed 账户。这段代码将放在 `withdraw.rs` 文件中。
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

请注意，我们正在使用关闭约束，因为一旦交易完成，我们希望关闭`escrow_account`。存储在账户中的作为租金的SOL将被转移到用户账户。

我们还使用地址约束来验证传入的feed账户实际上是`usdc_sol`的feed，而不是其他feed（我们已经在代码中硬编码了SOL_USDC_FEED地址）。此外，我们反序列化的AggregatorAccountData结构来自Switchboard rust crate。它验证了给定的账户是switchboard程序拥有的，并允许我们轻松查看其数值。您会注意到它被包裹在`AccountLoader`中。这是因为该feed实际上是一个相当大的账户，需要进行零拷贝。

现在让我们实现取款指令的逻辑。首先，我们检查feed是否过时。然后，我们获取存储在`feed_aggregator`账户中的SOL的当前价格。最后，我们希望检查当前价格是否高于escrow的`unlock_price`。如果是，则将SOL从escrow账户转移到用户账户并关闭该账户。如果不是，则该指令应该结束并返回一个错误。

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

为了完成逻辑，我们将执行转账操作，这次我们需要以不同的方式转账资金。由于我们是从一个还存有数据的账户转账，所以不能像之前那样使用 `system_program::transfer` 方法。如果我们尝试这样做，指令将无法执行，并显示以下错误。


```zsh
'Transfer: `from` must not carry data'
```




为了解决这个问题，我们将在每个账户上使用`try_borrow_mut_lamports()`并增加/减少每个账户中存储的lamports数量。
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

在`withdraw.rs`文件中，最终的取款方法应该如下所示：
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
    #[account(mut, close = user)]
    pub escrow_account: Account<'info, EscrowState>,
    // Switchboard SOL feed aggregator
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]
    pub feed_aggregator: Account<'info, AggregatorAccountData>,
    pub system_program: AccountInfo<'info>,
}
```

这就是整个程序的内容！此时，您应该能够在不出现任何错误的情况下运行 `anchor build`。

注意：如果出现下面所示的错误，您可以放心地忽略它。

```bash
Compiling switchboard-v2 v0.4.0
Error: Function _ZN86_$LT$switchboard_v2..aggregator..AggregatorAccountData$u20$as$u20$core..fmt..Debug$GT$3fmt17hea9f7644392c2647E Stack offset of 4128 exceeded max offset of 4096 by 32 bytes, please minimize large stack variables
```

### 7. 测试

让我们写一些测试。我们应该有四个测试：

- 创建一个解锁价格***低于***当前SOL价格的托管，以便进行提现测试
- 从上述托管中进行提现和关闭
- 创建一个解锁价格***高于***当前SOL价格的托管，以便进行提现测试
- 从上述托管中进行提现并失败

请注意，每个用户只能有一个托管，因此上述顺序很重要。

我们将在一个代码片段中提供所有测试代码。在运行 `anchor test` 之前，请仔细阅读以确保您理解它。

```typescript
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
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
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
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
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
如果您对测试逻辑感到有信心，请继续在您选择的Shell中运行`anchor test`。您应该会通过四个测试。

如果出现问题，请返回实验室检查并确保您已正确完成所有步骤。请特别注意代码背后的意图，而不仅仅是复制粘贴。也请随时查看[Github存储库的`main`分支上的工作代码](https://github.com/Unboxed-Software/michael-burry-escrow)。

## Challenge

作为一个独立的挑战，在数据源出现问题时创建一个备用计划。如果Oracle队列在X时间内没有更新聚合器账户，或者数据源账户不再存在，请撤回用户的托管资金。

此挑战的一个潜在解决方案可以在[Github存储库的`challenge-solution`分支](https://github.com/Unboxed-Software/michael-burry-escrow/tree/challenge-solution)中找到。

## 完成实验室了吗？

将您的代码推送到GitHub，然后[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=1a5d266c-f4c1-4c45-b986-2afd4be59991)！
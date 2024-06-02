---
title: 支持链上程序的通证扩展计划
objectives:
- 在您的程序中接受通证程序的账户和铸造
- 解释通证程序和通证扩展程序之间的区别
- 解释如何使用 Anchor 接口
---

# 摘要
- `通证扩展程序`是`通证程序`的超集，具有不同的程序 ID
- `token_program` 是 Anchor 账户约束，允许您验证账户属于特定的通证程序
- Anchor 引入了接口的概念，以便程序可以轻松支持与`通证程序`和`通证扩展程序`的交互

# 概述
`通证扩展程序` 是 Solana mainnet 上的一个程序，为 Solana 通证和铸造提供额外功能。`通证扩展程序`是`通证程序`的超集。本质上，它是一个字节对字节的重建，在最后添加了额外的功能。但它们仍然是不同的程序。有了两种类型的通证程序，我们必须预期在指令中发送程序类型。

在本课程中，您将学习如何设计您的程序以使用 Anchor 接受`通证程序`和`通证扩展程序`账户。您还将学习如何与`通证扩展程序`账户交互，识别账户属于哪种通证程序，以及`通证程序`和`通证扩展程序`链上的一些区别。

## 传统通证程序与通证扩展程序的区别
我们必须澄清`通证扩展程序`与原始`通证程序`是分开的。`通证扩展程序`是原始`通证程序`的一个超集，意味着原始`通证程序`中的所有指令和功能都包含在`通证扩展程序`中。
过去，一个主要程序（`通证程序`）负责创建账户。随着越来越多的用例出现在 Solana 上，出现了对新通证功能的需求。在历史上，添加新的通证功能的唯一方式是创建新类型的通证。新通证需要自己的程序，并且希望使用这种新通证的任何钱包或客户端都必须添加特定的逻辑来支持它。幸运的是，支持不同类型的通证的麻烦并未变得非常普遍。然而，新功能仍然非常需要，`通证扩展程序`就是为了解决这个问题而构建的。

如前所述，`通证扩展程序`是原始通证程序的一个严格的超集，并具有所有先前的功能。`通证扩展程序`开发团队选择了这种方法，以确保对用户、钱包和 DApp 的最小中断，同时添加新功能。`通证扩展程序`支持与通证程序相同的指令集，并且在最后一个指令之前的所有指令都是相同的字节对字节，使得现有程序可以直接支持`通证扩展`。然而，这并不意味着`通证扩展程序`通证和`通证程序`通证是可互操作的 - 它们不是。我们需要分别处理每个通证。

## 确定特定通证属于哪个程序
通过 Anchor 管理两种不同的通证程序相当简单。现在，当我们在程序中处理通证时，我们将检查`token_program`约束。
两种通证程序的 ID 如下：

```rust
use spl_token::ID; // 通证程序
use anchor_spl::token_2022::ID; // 通证扩展程序
```

要检查常规的`通证程序`，您可以使用以下代码：

```rust
use spl_token::ID;

// 验证给定的通证/铸造账户属于 spl-token 程序
#[account(
    mint::token_program = ID,
)]
pub token_a_mint: Box>,
#[account(
    token::token_program = ID,
)]
pub token_a_account: Box>,
```

您也可以使用不同的 ID 来完成对`通证扩展程序`的检查。

```rust
use anchor_spl::token_2022::ID;

// 验证给定的通证/铸造账户属于通证扩展程序
#[account(
    mint::token_program = ID,
)]
pub token_a_mint: Box>,
#[account(
    token::token_program = ID,
)]
pub token_a_account: Box>,
```

如果客户端传入的是错误的通证程序账户，指令将失败。然而，这引发了一个问题，如果我们想要支持`通证程序`和`通证扩展程序`怎么办？如果我们硬编码程序的`ID`检查，我们将需要两倍的指令数量。幸运的是，您可以验证传入您的程序的通证账户属于特定的通证程序。您可以使用与之前示例类似的方法。与传入通证程序的静态`ID`不同，您检查给定的`token_program`。

```rust
// 验证给定的通证和铸造账户与给定的 token_program 匹配
#[account(
    mint::token_program = token_program,
)]
pub token_a_mint: Box>,
#[account(
    token::token_program = token_program,
)]
pub token_a_account: Box>,
pub token_program: Interface<'info, token_interface::TokenInterface>,
```
通过提供特定的通证程序，您也可以对关联的通证账户执行相同的操作。

```rust
#[account(
    associated_token::token_program = token_program
)]
pub associated_token: Box>,
pub token_program: Interface<'info, token_interface::TokenInterface>,
```

如果您想要在程序逻辑中检查通证账户和铸造属于哪个通证程序，您可以参考`AccountInfo`结构的 owner 字段。以下代码将记录拥有程序的 ID。您可以在条件中使用此字段来执行`spl-token`和`通证扩展程序`账户的不同逻辑。

```rust
msg!("Token Program Owner: {}", ctx.accounts.token_account.to_account_info().owner);
```

## Anchor Interfaces
接口是 Anchor 的最新功能，它简化了程序中与`通证扩展`的工作。`anchor_lang` 创建的两个相关接口包装类型如下：

* [`Interface`](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/interface/index.html)
* [`InterfaceAccount`](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/interface_account/index.html)

以及`anchor_spl` 创建的三个相应的账户类型：
* [`Mint`](https://docs.rs/anchor-spl/latest/anchor_spl/token_interface/struct.Mint.html)
* [`TokenAccount`](https://docs.rs/anchor-spl/latest/anchor_spl/token_interface/struct.TokenAccount.html)
* [`TokenInterface`](https://docs.rs/anchor-spl/latest/anchor_spl/token_interface/struct.TokenInterface.html)

在前一节中，我们在示例中定义了`token_program`如下：
```rust
pub token_program: Interface<'info, token_interface::TokenInterface>,
```
这段代码使用了`Interface`和`token_interface::TokenInterface`。

`Interface`是原始`Program`类型的封装，允许使用多个可能的程序ID。它是一种类型验证，用于验证该账户是否是给定程序集合中的一个。`Interface`类型会检查以下内容：
* 给定的账户是否可执行
* 给定的账户是否是给定接口类型的一组期望账户之一

您必须使用特定接口类型的`Interface`包装器。`anchor_lang`和`anchor_spl`包提供了以下`Interface`类型：
* [TokenInterface](https://docs.rs/anchor-spl/latest/anchor_spl/token_interface/struct.TokenInterface.html)

`TokenInterface`提供了一种接口类型，期望传入的账户公钥匹配`spl_token::ID`或`spl_token_2022::ID`。这些程序ID在Anchor的`TokenInterface`类型中是硬编码的。

```rust
static IDS: [Pubkey; 2] = [spl_token::ID, spl_token_2022::ID];

#[derive(Clone)]
pub struct TokenInterface;

impl anchor_lang::Ids for TokenInterface {
    fn ids() -> &'static [Pubkey] {
        &IDS
    }
}
```

Anchor会检查传入的账户ID是否匹配上述两个ID之一。如果给定账户不匹配这两个ID中的任何一个，Anchor将抛出一个`InvalidProgramId`错误，并阻止执行该交易。

```rust
impl<T: Ids> CheckId for T {
    fn check_id(id: &Pubkey) -> Result<()> {
        if !Self::ids().contains(id) {
            Err(error::Error::from(error::ErrorCode::InvalidProgramId).with_account_name(*id))
        } else {
            Ok(())
        }
    }
}

.
.
.

impl<'a, T: CheckId> TryFrom<&'a AccountInfo<'a>> for Interface<'a, T> {
    type Error = Error;
    /// Deserializes the given `info` into a `Program`.
    fn try_from(info: &'a AccountInfo<'a>) -> Result<Self> {
        T::check_id(info.key)?;
        if !info.executable {
            return Err(ErrorCode::InvalidProgramExecutable.into());
        }
        Ok(Self::new(info))
    }
}
```

`InterfaceAccount`类型类似于`Interface`类型，它也是一个封装器，但这次是针对`AccountInfo`。`InterfaceAccount` 用于账户验证程序所有权，并将底层数据反序列化为Rust类型。本课程将专注于在代币和货币账户上使用`InterfaceAccount`。我们可以使用`InterfaceAccount`包装器与我们提到的`anchor_spl::token_interface`包中的`Mint`或`TokenAccount`类型。下面是一个例子：

```rust
use {
    anchor_lang::prelude::*,
    anchor_spl::{token_interface},
};

#[derive(Accounts)]
pub struct Example<'info>{
    // 代币账户
    #[account(
        token::token_program = token_program
    )]
    pub token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    // 货币账户
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub mint_account: InterfaceAccount<'info, token_interface::Mint>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

如果您熟悉Anchor，那么您可能会注意到`TokenAccount`和`Mint`账户类型并非新鲜事。不过新的是它们如何与`InterfaceAccount`封装器一起使用。`InterfaceAccount`封装器允许传入和反序列化`Token Program`或`Token Extensions Program`账户，就像`Interface`和`TokenInterface`类型一样。这些封装器和账户类型一起提供了开发人员简洁直接的开发体验，并且让您有在程序中与`Token Program`和`Token Extensions Program`交互的弹性。

但是，您不能将`token_interface`模块中的这些类型与常规的Anchor`Program`和`Account`封装器一起使用。这些新类型只能与`Interface`或`InterfaceAccount`封装器一起使用。例如，以下内容将是无效的，并且发送到使用此账户反序列化的指令的任何交易都将返回错误。

```rust
// 这是无效的，只做举例。
// 不能将Account包装在token_interface::*类型上。
pub token_account: Account<'info, token_interface::TokenAccount>
```


# 实验

现在让我们通过实现一个通用代币质押程序来在链上使用`Token Extensions Program`，以获取实际操作经验。就质押程序而言，这将是一个简单的实现，具体设计如下：

* 我们将创建一个质押池账户来容纳所有存入的质押代币。对于给定的代币，只会有一个质押池。程序将拥有此账户。
* 每个质押池都会有一个状态账户，其中包含有关在池中质押代币数量等信息。
* 用户可以质押尽可能多的代币，将它们从其代币账户转移到质押池。
* 每个用户为自己在每个质押池中进行质押创建一个状态账户。此状态账户将跟踪他们在该池中质押的代币数量、上次质押时间等。
* 用户将在解除质押时铸造质押奖励代币。无需单独的认领流程。
* 我们将使用简单算法确定用户的质押奖励。
* 该程序将接受`Token Program`和`Token Extensions Program`账户。

该程序将有四个指令：`init_pool`、`init_stake_entry`、`stake`、`unstake`。

此实验将利用我们之前在本课程中介绍过的许多Anchor和Solana API。我们不会花时间来解释我们希望您已经熟悉的一些概念。说了这么多，让我们开始吧。

### 1. 验证Solana/Anchor/Rust版本

在本实验中，我们将与`Token Extension`程序进行交互，这需要您的solana cli版本≥`1.18.0`。

要检查您的版本，请运行：
```bash
solana --version
```

如果运行`solana --version`后打印的版本低于`1.18.0`，您可以手动更新[cli版本](https://docs.solanalabs.com/cli/install)。请注意，在编写本文时，你无法简单地运行`solana-install update`命令。此命令不会为我们更新到正确的CLI版本，因此我们必须显式地下载版本`1.18.0`。您可以使用以下命令下载：

```bash
solana-install init 1.18.0
```

如果在尝试构建程序时遇到以下错误，那很可能是您未安装正确版本的Solana CLI。

```bash
anchor build
错误：无法构建包 `solana-program v1.18.0`，因为它需要 rustc 1.72.0 或更新版本，而当前活跃的 rustc 版本为 1.68.0-dev
要么升级到 rustc 1.72.0 或更高版本，要么使用
cargo update -p solana-program@1.18.0 --precise ver
其中 `ver` 是支持 rustc 1.68.0-dev 的`solana-program` 的最新版本
```

您还希望安装最新版本的 Anchor CLI。您可以按照此处列出的步骤更新通过 avm 安装 https://www.anchor-lang.com/docs/avm 或者简单运行：
```bash
avm install latest
avm use latest
```

撰写本文时，Anchor CLI 的最新版本为 `0.29.0`

现在，我们可以检查我们的 Rust 版本。

```bash
rustc --version
```

在此撰写本文时，Rust 编译器使用的版本是 `1.26.0`。如果您想要更新，可以通过 `rustup` 进行更新
https://doc.rust-lang.org/book/ch01-01-installation.html

```bash
rustup update
```

现在，我们应该已安装所有正确的版本。

### 2. 获取入门代码并添加依赖

让我们获取入门分支。

```bash
git clone https://github.com/Unboxed-Software/token22-staking
cd token22-staking
git checkout starter
```

### 3. 更新程序 ID 和 Anchor 密钥对

一旦进入入门分支，运行 `anchor keys list` 以获取您的程序 ID。

将此程序 ID 复制并粘贴到 `Anchor.toml` 文件中：

```rust
// 在 Anchor.toml 中
[programs.localnet]
token_22_staking = "<YOUR-PROGRAM-ID-HERE>"
```

以及在 `programs/token-22-staking/src/lib.rs` 文件中：

```rust
declare_id!("<YOUR-PROGRAM-ID-HERE>");
```

最后，在 `Anchor.toml` 中设置您的开发者密钥对路径。

```toml
[provider]
cluster = "Localnet"
wallet = "/YOUR/PATH/HERE/id.json"
```

如果您不知道您当前的密钥对路径是什么，您总是可以运行 Solana cli 来查找。

```bash
solana config get
```

### 4. 确认程序构建

让我们构建入门代码以确认我们已正确配置所有内容。如果构建失败，请重新查看上述步骤。

```bash
anchor build
```

您可以安全地忽略构建脚本的警告，这些将在我们添加必要的代码后消失。

随时运行提供的测试以确保其余的开发环境设置正确。您将不得不使用 `npm` 或 `yarn` 安装节点依赖，测试应该运行，但在完成程序之前都会失败。

```bash
yarn install
anchor test
```

### 5. 探索程序设计

现在我们已确认程序构建，让我们看看程序的布局。您会注意到在 `/programs/token22-staking/src` 中有几个不同的文件：
* `lib.rs`
* `error.rs`
* `state.rs`
* `utils.rs`

`errors.rs` 和 `utils.rs` 文件已为您填写好。`errors.rs` 是我们为程序定义自定义错误的地方。要做到这一点，您只需创建一个公共 `enum` 并定义每个错误。

`utils.rs` 是一个只包含一个名为 `check_token_program` 的函数的文件。这只是一个您可以写入辅助函数的文件，如果有需要的话。 这个函数是提前编写的，将用于简单记录传递给指令的特定代币程序。在这个程序中，我们将同时使用 `Token Extensions Program` 和 `spl-token`，因此这个函数将帮助澄清这种区别。

`lib.rs` 是我们程序的入口点，这是所有 Solana 程序的常见做法。在这里，我们使用 `declare_id` Anchor 宏和公共 `token_22_staking` 模块定义我们的程序 ID。这个模块是我们定义公开可调用指令的地方，这可以被视为我们程序的 API。

在这里我们定义了四个独立的指令模块：
* `init_pool`
* `init_stake_entry`
* `stake`
* `unstake`

在这里的每个指令都调用了在其他地方定义的 `handler` 方法。我们这样做是为了使程序模块化，这有助于保持程序的组织。在处理较大的程序时，这通常是一个不错的主意。

每一个这些具体的 `handler` 方法都在 `instructions` 目录下有自己的文件。您会注意到有一个与每个指令相对应的文件，以及一个额外的 `mod.rs` 文件。这些指令文件是我们将为每个单独的指令编写逻辑的地方。`mod.rs` 文件能够使这些 `handler` 方法可从 `lib.rs` 文件中调用。

### 6. 实现 `state.rs`

打开 `/src/state.rs` 文件。在这里，我们将定义一些状态数据结构和我们程序中将需要的一些常量。让我们从引入我们将在此处需要的软件包开始。

```rust
use {
    anchor_lang::prelude::*,
    solana_program::{pubkey::Pubkey},
};
```

接下来，我们将需要定义一些种子，这些种子会在整个程序中被引用。这些种子将被用于派生我们程序将期望收到的不同 PDA。

```rust
pub const STAKE_POOL_STATE_SEED: &str = "state";
pub const VAULT_SEED: &str = "vault";
pub const VAULT_AUTH_SEED: &str = "vault_authority";
pub const STAKE_ENTRY_SEED: &str = "stake_entry";
```

现在，我们将定义两个数据结构，用于定义程序将用于保存状态的两个不同账户的数据。`PoolState`和`StakeEntry`账户。

`PoolState`账户旨在保存关于特定质押池的信息。

```rust
#[account]
pub struct PoolState {
    pub bump: u8,
    pub amount: u64,
    pub token_mint: Pubkey,
    pub staking_token_mint: Pubkey,
    pub staking_token_mint_bump: u8,
    pub vault_bump: u8,
    pub vault_auth_bump: u8,
    pub vault_authority: Pubkey,
}
```

`StakeEntry`账户将保存有关特定用户在该质押池中的质押的信息。

```rust
#[account]
pub struct StakeEntry {
    pub user: Pubkey,
    pub user_stake_token_account: Pubkey,
    pub bump: u8,
    pub balance: u64,
    pub last_staked: i64,
}
```

### 7. `init_pool`指令

现在我们了解了程序的架构，我们开始实现第一个指令`init_pool`。

打开`init_pool.rs`，您应该会看到以下内容：

```rust
use {
    anchor_lang::prelude::*,
    crate::{state::*, utils::*},
    anchor_spl::{token_interface},
    std::mem::size_of
};

pub fn handler(ctx: Context<InitializePool>) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

`handler`方法被定义，`InitializePool`账户结构也是。账户结构只需接收一个`token_program`账户，就完成了。`handler`方法调用了在`utils.rs`文件中定义的`check_token_program`方法。就目前而言，这个指令并没有做太多事情。

为了开始实现该指令的逻辑，让我们首先考虑所需的账户。要初始化质押池，我们将需要以下内容：

* `pool_authority` - 是所有质押池的权限PDA。这将是使用特定种子派生的PDA。
* `pool_state` - 在本指令中创建的状态账户。此账户将保存有关此特定质押池的状态信息，例如质押的代币数量，有多少用户已质押等。
* `token_mint` - 预计在此质押池中质押的代币的铸造。每个代币将有一个独特的质押池。
* `token_vault` - 与`token_mint`具有相同铸造的代币账户。这是一个带有`pool_authority` PDA权限的代币账户。这使程序控制代币账户。在此质押池中质押的所有代币都将存放在此代币账户中。
* `staking_token_mint` - 用于在此质押池中质押的奖励代币铸造。
* `payer` - 负责支付创建质押池所需的租金的账户。
* `token_program` - 与给定代币和铸造账户关联的代币程序。应适用于Token扩展或Token程序。
* `system_program` - 系统程序。
* `rent` - 租金程序。

让我们开始实现此账户结构，首先从`pool_authority`账户及其约束开始。

`pool_authority`账户是使用我们在`state.rs`文件中定义的`VAULT_AUTH_SEED`派生的PDA。此账户不保存任何状态，因此我们不需要将其反序列化为任何特定的账户结构。因此，我们使用`UncheckedAccount` Anchor账户类型。

```rust
#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// CHECK: PDA, auth over all token vaults
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

请注意，`UncheckedAccount`在Anchor中被视为不安全，因为Anchor在幕后不执行任何附加的验证。但是，在这里使用它是可以的，因为我们确实验证了账户是否是预期的PDA，并且我们既不读取也不写入该账户。然而，在使用`UncheckedAccount`或`AccountInfo`结构的账户上方，需要使用`/// CHECK:`注释。如果没有这个注释，构建时程序会出现以下错误：

```bash
Struct field "pool_authority" is unsafe, but is not documented.
Please add a `/// CHECK:` doc comment explaining why no checks through types are necessary.
See https://www.anchor-lang.com/docs/the-accounts-struct#safety-checks for more information.
```

接下来，我们将定义`pool_state`账户。

该账户使用`init`约束，表明我们需要创建该账户。预计此账户将是使用`token_mint`账户键和`STAKE_POOL_STATE_SEED`作为键派生的PDA。`payer`需要支付创建此账户所需的租金。我们分配了足够的空间来存储我们在`state.rs`文件中定义的`PoolState`数据结构。最后，我们使用`Account`包装器将给定账户反序列化为`PoolState`结构。

```rust
// pool state account
#[account(
    init,
    seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
    bump,
    payer = payer,
    space = 8 + size_of::<PoolState>()
)]
pub pool_state: Account<'info, PoolState>,
```

接下来是`token_mint`账户。

我们在`token_mint`账户上使用了两个账户约束。`mint::token_program = <token_program>`验证了给定账户是从给定`<token_program>`创建的铸造。在Token扩展程序之前，这实际上不是一个问题，因为只有一个代币程序。现在，有两个！我们验证给定的`token_mint`账户属于给定的`token_program`的原因是，来自一个程序的代币账户和铸造与来自另一个程序的代币账户和铸造不兼容。因此，在我们的程序的每一条指令中，我们将验证所有给定的代币账户和铸造是否属于相同的`token_program`。

第二个约束`mint::authority = payer`验证对传入的资产进行铸造的权限是`payer`帐户，并且也需要作为签署方。这可能看起来有些违反直觉，但我们之所以这样做是因为目前我们由于使用`pool_state`账户的PDA种子，从根本上限制了程序每个代币只能有一个质押池。我们同时也允许质押池的创建者定义用于该质押池中质押的奖励代币铸造。由于该程序目前限制了每个代币只能有一个质押池，我们不希望任何人都能为一个代币创建质押池。这样一来，质押池的创建者就能够控制在此质押中的奖励是什么。想想看，如果我们不需要`mint::authority`，这将允许任何人为`Token X`创建质押池，并定义每个质押`Token X`的奖励代币是什么。如果他们决定将奖励代币定义为模因币`FooBar`，那么每个人都将被困在这个质押池中。出于这个原因，我们只允许`token_mint`权限为`token_mint`创建质押池。虽然这种程序设计可能不适用于现实世界，因为它的扩展性很差。但它是一个很好的例子，有助于在这个课程中理解重点，同时保持相对简单。这也可以作为程序设计的一个很好练习。你会怎么设计这个程序以使它在主网上更具扩展性呢？

最后，我们利用`InterfaceAccount`结构将给定的账户反序列化为`token_interface::Mint`。

`InterfaceAccount`类型是`AccountInfo`的封装，可以验证程序所有权，并将底层数据反序列化为给定的Rust类型。与`token_interface::Mint`结构一起使用时，Anchor知道将其反序列化为Mint账户。`token_interface::Mint`结构默认支持`Token Program`和`Token Extensions Program`铸造！这种接口概念是专门为这种用例创建的。您可以在[`anchor_lang`文档](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/interface_account/struct.InterfaceAccount.html)中阅读有关`InterfaceAccount`的更多信息。

```rust
// 代币的铸造
#[account(
    mint::token_program = token_program,
    mint::authority = payer
)]
pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

接下来看一下`pool_token_vault`，在这里将保存在该质押池中的代币。

我们使用`init`约束初始化代币账户，创建具有`token_mint`铸造，`pool_authority`权限和`token_program`的代币账户。使用`token_mint`、`pool_authority`和`VAULT_SEED`作为种子，在PDA上创建此代币账户。`pool_authority`被指定为此代币账户的权限，以便程序对其进行控制。

```rust
// 代币铸造的代币账户
    #[account(
        init,
        token::mint = token_mint,
        token::authority = pool_authority,
        token::token_program = token_program,
        // 使用token_mint、pool auth和常量作为代币保管库的种子
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump,
        payer = payer,
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
```


接下来是`staking_token_mint`。

我们只需验证铸造是否属于给定的`token_program`。同样，我们在这里使用`InterfaceAccount`和`token_interface::Mint`。

```rust
// 质押代币的铸造
#[account(
    mut,
    mint::token_program = token_program
)]
pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

最后，我们有几个熟悉的账户。

```rust
// 付款人，将为创建质押池支付费用
#[account(mut)]
pub payer: Signer<'info>',
pub token_program: Interface<'info, token_interface::TokenInterface>,
pub system_program: Program<'info, System>,
pub rent: Sysvar<'info, Rent>
```

现在我们的账户结构应该如下所示：
```rust
#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// CHECK: PDA，对所有代币保管库进行授权
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    // 质押池状态账户
    #[account(
        init,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump,
        payer = payer,
        space = 8 + size_of::<PoolState>()
    )]
    pub pool_state: Account<'info, PoolState>,
    // 代币的铸造
    #[account(
        mint::token_program = token_program,
        mint::authority = payer
    )]
    pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
    // 代币铸造的代币账户
    #[account(
        init,
        token::mint = token_mint,
        token::authority = pool_authority,
        token::token_program = token_program,
        // 使用token_mint、pool auth和常量作为代币保管库的种子
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump,
        payer = payer,
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
    // 质押代币的铸造
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
    // 付款人，将为创建质押池支付费用
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}
```

设置账户结构是这个指令的逻辑主体。在`handler`函数中，我们只需初始化所有`pool_state`字段即可。


函数`handler`应为：
```rust
pub fn handler(ctx: Context<InitializePool>) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());
    
    // 初始化池状态
    let pool_state = &mut ctx.accounts.pool_state;
    pool_state.bump = ctx.bumps.pool_state;
    pool_state.amount = 0;
    pool_state.vault_bump = ctx.bumps.token_vault;
    pool_state.vault_auth_bump = ctx.bumps.pool_authority;
    pool_state.token_mint = ctx.accounts.token_mint.key();
    pool_state.staking_token_mint = ctx.accounts.staking_token_mint.key();
    pool_state.vault_authority = ctx.accounts.pool_authority.key();

    msg!("创建了质押池！");

    Ok(())
}
```

之后，保存您的工作并构建以确保您的程序在此时没有问题。

```bash
anchor build
```

### 8. `init_stake_entry` 指令

现在我们可以继续处理 `init_stake_entry.rs` 文件。此指令为用户创建一个质押账户以跟踪他们的质押代币状态。在用户可以质押代币之前，质押账户 `StakeEntry` 必须存在。`StakeEntry` 账户结构在之前的 `state.rs` 文件中已经定义过了。

让我们从为此指令所需的账户入手。我们将需要以下账户：

* `user` - 创建 `stake_entry` 账户的用户。此账户必须对交易进行签名，并且需要支付创建 `stake_entry` 账户所需的租金。
* `user_stake_entry` - 用户将在此处创建 State 账户，其 PDA 源自用户、为其创建的质押池的主币种（mint）、`STAKE_ENTRY_SEED` 作为种子。
* `user_stake_token_account` - 用户与质押奖励代币关联的代币账户。
* `staking_token_mint` - 此池的质押奖励代币主币种（mint）。
* `pool_state` - 用于此质押池的 `PoolState` 账户。
* `token_program` - 代币程序。
* `associated_token_program` - 关联的代币程序。
* `system_program` - 系统程序。

让我们首先将 `user` 账户添加到 `InitializeStakeEntry` 账户结构中。

有必要验证用户账户具有签名权限，表明所有权，并且是可变的，因为他们是交易的支付方（这将改变其余额）。

```rust
#[derive(Accounts)]
pub struct InitializeStakeEntry<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

`user_stake_entry` 账户需要更多的约束条件。我们需要初始化账户、使用预期的种子派生地址、指定为账户创建者、并为 `StakeEntry` 数据结构分配足够的空间。我们将给定的账户反序列化为 `StakeEntry` 账户。

```rust
#[account(
        init,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump,
        payer = user,
        space = 8 + size_of::<StakeEntry>()
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
```

`user_stake_token_account` 是用户最终将在其中接收质押奖励的代币账户。我们在此指令中创建此账户，这样在分配质押奖励时就不必担心它。由于我们在此指令中初始化了此账户，它限制了用户可以使用相同奖励代币进行质押的池的数量。这种设计限制可能不适用于生产环境。思考一下如何重新设计它。

我们使用了与上一个指令中相似的 Anchor SPL 约束，这次是针对关联的代币程序。通过 `init` 约束，它告诉 Anchor 在初始化此关联代币账户时要使用哪个mint、授权和代币程序。

```rust
#[account(
        init,
        associated_token::mint = staking_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        payer = user,
    )]
    pub user_stake_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
```

注意：我们在这里使用了 `InterfaceAccount` 和 `token_interface::TokenAccount` 类型。`token_interface::TokenAccount` 类型只能与 `InterfaceAccount` 结合使用。

接下来，我们添加了 `staking_token_mint` 账户。请注意，这里我们使用了自定义错误。此约束验证了 `staking_token_mint` 账户的 pubkey 是否等于存储在给定的 `PoolState` 账户的 `staking_token_mint`字段中的 pubkey。此字段在先前步骤的 `inti_pool` 指令中的 `handler` 方法中初始化。

```rust
#[account(
        constraint = staking_token_mint.key() == pool_state.staking_token_mint
        @ StakeError::InvalidStakingTokenMint,
        mint::token_program = token_program
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

`pool_state` 账户在这里与 `init_pool` 指令中的相似。然而，在 `init_pool` 指令中，我们保存了用于派生此账户的bump，因此实际上我们无需每次验证PDA时都重新计算它。我们可以方便地调用 `bump = pool_state.bump`，这将使用存储在此账户中的bump。

```rust
#[account(
        seeds = [pool_state.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,
```

其余的账户已经是我们熟悉的，它们上面没有任何特殊的约束。

```rust
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
```


应该是最终的`InitializeStakeEntry`账户结构：
```rust
#[derive(Accounts)]
pub struct InitializeStakeEntry<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump,
        payer = user,
        space = 8 + size_of::<StakeEntry>()
    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    #[account(
        init,
        associated_token::mint = staking_token_mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
        payer = user,
    )]
    pub user_stake_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        constraint = staking_token_mint.key() == pool_state.staking_token_mint
        @ StakeError::InvalidStakingTokenMint,
        mint::token_program = token_program
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
    #[account(
        seeds = [pool_state.token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump
    )]
    pub pool_state: Account<'info, PoolState>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}
```

`handler`方法在这个说明中也是非常直接的。我们所需要做的就是初始化新创建的`user_stake_entry`账户的状态。
```rust
pub fn handler(ctx: Context<InitializeStakeEntry>) -> Result<()> {
    check_token_program(ctx.accounts.token_program.key());

    // 初始化用户股权条目状态
    let user_entry = &mut ctx.accounts.user_stake_entry;
    user_entry.user = ctx.accounts.user.key();
    user_entry.user_stake_token_account = ctx.accounts.user_stake_token_account.key();
    user_entry.bump = ctx.bumps.user_stake_entry;
    user_entry.balance = 0;

    Ok(())
}
```

保存您的工作并构建以验证是否有编译错误。
```bash
anchor build
```

### 9. `stake`指令

`stake`指令是当用户实际上想要质押他们的代币时调用的。该指令应将用户希望质押的代币数量从他们的代币账户转移到由该程序拥有的池保险库账户。在该指令中存在大量验证，以防止任何潜在的恶意交易成功。

所需的账户包括:
* `pool_state` - 质押池的状态账户。
* `token_mint` - 质押代币的铸造。这对于转账是必需的。
* `pool_authority` - 给予所有质押池管理权限的PDA。
* `token_vault` - 在此池中质押的代币所在的代币保险库账户。
* `user` - 试图质押代币的用户。
* `user_token_account` - 用户拥有的代币账户，用户希望从中转移质押代币的账户。
* `user_stake_entry` - 在上一个指令中创建的用户`StakeEntry`账户
* `token_program`
* `system_program`

同样，首先让我们先构建`Stake`账户结构。

首先看一下`pool_state`账户。这与我们在以前的指令中使用的相同，由相同的seed和bump派生。

```rust
#[derive(Accounts)]
pub struct Stake<'info> {
    // 质押池状态账户
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
}
```

接下来是`token_mint`，在此指令中需要用到该铸造以进行转账CPI。这是正在被质押的代币的铸造。我们验证给定的铸造是否属于给定的`token_program`，以确保我们没有混淆任何`spl-token`和`Token扩展程序`账户。

```rust
// 质押的代币的铸造
#[account(
    mut,
    mint::token_program = token_program
)]
pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
```
`pool_authority`账户再次是对所有质押池具有管理权限的PDA。

```rust
/// 检查: PDA，对所有代币保险库具有权限
#[account(
    seeds = [VAULT_AUTH_SEED.as_bytes()],
    bump
)]
pub pool_authority: UncheckedAccount<'info>,
```

现在我们有了`token_vault`，这是当代币质押时代币将被持有的地方。必须验证此账户，因为这是代币被转移到的地方。在这里，我们验证给定的账户是否是从`token_mint`、`pool_authority`和`VAULT_SEED` seed派生的预期PDA。我们还验证代币账户是否属于给定的`token_program`。我们再次在这里使用`InterfaceAccount`和`token_interface::TokenAccount`来支持`spl-token`或`Token扩展程序`账户。

```rust
// 代币的保险库账户，用于Token Mint
#[account(
    mut,
    // 使用token_mint，pool_auth以及常数作为代币保险库的种子
    seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
    bump = pool_state.vault_bump,
    token::token_program = token_program
)]
pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
```

`user`账户被标记为可变的，并且必须对交易进行签名。他们是发起转账的一方，也是代币的所有者，因此他们的签名是转账发生所必需的。


```rust
#[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
    pub user: Signer<'info>,
```


注：我们也验证给定的用户是否与给定的`user_stake_entry`账户中存储的公钥相同。如果不是，则我们的程序将抛出`InvalidUser`自定义错误。

`user_token_account`是代币账户，应该当前持有要进行质押的代币。该代币账户的货币必须与质押池的货币相匹配。如果不匹配，将抛出自定义的`InvalidMint`错误。我们还验证给定的代币账户是否与给定的`token_program`相匹配。

```rust
#[account(
    mut,
    constraint = user_token_account.mint == pool_state.token_mint
    @ StakeError::InvalidMint,
    token::token_program = token_program
)]
pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
```


最后三个账户我们现在已经熟悉了。

```rust
#[account(
    mut,
    seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
    bump = user_stake_entry.bump,

)]
pub user_stake_entry: Account<'info, StakeEntry>,
pub token_program: Interface<'info, token_interface::TokenInterface>,
pub system_program: Program<'info, System>
```

完整的`Stake`账户结构应该如下所示：

```rust
#[derive(Accounts)]
pub struct Stake<'info> {
    // pool state account
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    // Mint of token to stake
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
    /// CHECK: PDA, auth over all token vaults
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    // pool token account for Token Mint
    #[account(
        mut,
        // use token_mint, pool auth, and constant as seeds for token a vault
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool_state.vault_bump,
        token::token_program = token_program
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == pool_state.token_mint
        @ StakeError::InvalidMint,
        token::token_program = token_program
    )]
    pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump = user_stake_entry.bump,

    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>
}
```

这就是账户结构。保存您的工作并验证您的程序是否仍然可以编译。

```bash
anchor build
```

接下来，我们将实现一个辅助函数来帮助我们进行必须的转账CPI。我们将在刚构建的`Stake`数据结构下面添加一个`transfer_checked_ctx`方法的实现骨架。在刚建立的`Stake`账户结构下面，添加以下内容：

```rust
impl<'info> Stake <'info> {
    // 用于Token2022的transfer_checked
    pub fn transfer_checked_ctx(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        
    }
}
```

该方法以`&self`作为参数，通过调用`self`访问方法内部的`Stake`结构成员。该方法预期返回一个`CpiContext`，[这是Anchor的原始类型](https://docs.rs/anchor-lang/latest/anchor_lang/context/struct.CpiContext.html)之一。

`CpiContext`定义如下：

```rust
pub struct CpiContext<'a, 'b, 'c, 'info, T>
where
    T: ToAccountMetas + ToAccountInfos<'info>,
{
    pub accounts: T,
    pub remaining_accounts: Vec<AccountInfo<'info>>,
    pub program: AccountInfo<'info>,
    pub signer_seeds: &'a [&'b [&'c [u8]]],
}
```

其中`T`是您要调用的指令的账户结构。

这与传统的Anchor指令期望的`Context`对象（即`ctx: Context<Stake>`）非常相似。这里所做的是相同的概念，只是我们为跨程序调用定义了一个！

在我们的情况下，我们将调用`transfer_checked`指令，无论是在代币程序中，因此返回的`CpiContext`类型为`TransferChecked<'info>`，从而确定了`transfer_checked_ctx`方法名。通常的`transfer`指令已经被`Token Extensions Program`弃用，建议你以后使用`transfer_checked`。 
```

现在我们知道了这种方法的目标，我们可以实现它！首先，我们需要定义我们将要调用的程序。这应该是传递到我们账户结构的 `token_program`。

```rust
impl<'info> Stake <'info> {
    // transfer_checked用于spl-token或Token2022
    pub fn transfer_checked_ctx(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_program = self.token_program.to_account_info();
    }
}
```

请注意，我们只需通过调用 `self`，就能够简单地引用 `Stake` 数据结构中的账户。

接着，我们需要定义我们将会传入CPI的账户。我们可以通过顶部文件导入的来自 [`anchor_spl::token_2022` 包](https://docs.rs/anchor-spl/latest/anchor_spl/token_2022/struct.TransferChecked.html)中的 `TransferChecked` 数据类型来实现这一点。这个数据类型被定义为：

```rust
pub struct TransferChecked<'info> {
    pub from: AccountInfo<'info>,
    pub mint: AccountInfo<'info>,
    pub to: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}
```

这个数据类型期望四个不同的 `AccountInfo` 对象，所有这些对象都应该已经被传递到我们的程序中。就像 `cpi_program` 一样，我们可以通过引用 `self` 来构建这个 `TransferChecked` 数据结构，这使我们能够访问到 `Stake` 数据结构中已定义的所有账户。请注意，这种可能性只有因为 `transfer_checked_ctx` 是在 `Stake` 数据类型上实现的，并通过这行代码 `impl<'info> Stake <'info>` 进行实现。如果没有，那就没有 `self` 来引用。

```rust
impl<'info> Stake <'info> {
    // transfer_checked用于spl-token或Token2022
    pub fn transfer_checked_ctx(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: self.user_token_account.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.user.to_account_info(),
            mint: self.token_mint.to_account_info()
        };
    }
}
```

因此，我们已经定义了我们的 `cpi_program` 和 `cpi_accounts`，但这个方法应该返回一个 `CpiContext` 对象。为了做到这一点，我们只需要将这两者传递给 `CpiContext` 构造函数 `CpiContext::new`。

```rust
impl<'info> Stake <'info> {
    // transfer_checked for Token2022
    pub fn transfer_checked_ctx(&self) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = TransferChecked {
            from: self.user_token_account.to_account_info(),
            to: self.token_vault.to_account_info(),
            authority: self.user.to_account_info(),
            mint: self.token_mint.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

有了这个定义，我们可以在我们的 `handler` 方法中的任何时候调用 `transfer_checked_ctx`，它将返回一个 `CpiContext` 对象，我们可以用来执行一个 CPI。

继续进行 `handler` 函数，我们需要在这里做一些事情。首先，我们需要使用我们的 `transfer_checked_ctx` 方法来创建正确的 `CpiContext` 并进行CPI。然后，我们需要对我们的两个状态账户进行一些关键的更新。需要提醒的是，我们有两个状态账户 `PoolState` 和 `StakeEntry`。前者保存关于整个质押池当前状态的信息，而后者负责在某种方式上准确记录特定用户在某个质押池中的质押。考虑到这一点，每当质押池有更新，我们应该在某种方式上同时更新`PoolState`和给定用户的 `StakeEntry` 账户。

首先，让我们实现实际的CPI。由于我们事先在 `transfer_checked_ctx()` 方法中定义了所需的程序和账户进行CPI，实际的CPI非常直截了当。我们将使用 `anchor_spl::token_2022` 包中的另一个辅助函数，特别是 `transfer_checked` 函数。这个 [功能定义如下](https://docs.rs/anchor-spl/latest/anchor_spl/token_2022/fn.transfer_checked.html)：

```rust
pub fn transfer_checked<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, TransferChecked<'info>>,
    amount: u64,
    decimals: u8
) -> Result<()>
```
它包含三个输入参数：
* `CpiContext`
* 金额
* 小数位

`CpiContext` 正是我们在 `transfer_checked_ctx()` 方法中返回的内容，因此对于第一个参数，我们可以简单地调用方法并使用 `ctx.accounts.transfer_checked_ctx()`。

金额只是要转移的代币数量，我们的 `handler` 方法希望作为输入参数得到这个值。

最后，`decimals` 参数是正在转移的代币的代币标的的小数位数。这是转移检查指令的要求。由于已经传递了 `token_mint` 账户，你实际上可以在这个指令中获取代币标的的小数位数。然后，我们就将其作为第三个参数传递进去。

总而言之，它应该看起来像这样：

```rust
pub fn handler(ctx: Context<Stake>, stake_amount: u64) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());

    msg!("Pool initial total: {}", ctx.accounts.pool_state.amount);
    msg!("User entry initial balance: {}", ctx.accounts.user_stake_entry.balance);

    let decimals = ctx.accounts.token_mint.decimals;
    // transfer_checked for either spl-token or the Token Extension program
    transfer_checked(ctx.accounts.transfer_checked_ctx(), stake_amount, decimals)?;
    
    Ok(())
}
```

`transfer_checked` 方法构建了一个 `transfer_checked` 指令对象，并在幕后实际调用了 `CpiContext` 中的程序。我们只是利用了Anchor对这个流程的包装。如果你感兴趣，[这是源代码](https://docs.rs/anchor-spl/latest/src/anchor_spl/token_2022.rs.html#35-61)。


```rust
pub fn transfer_checked<'info>(
    ctx: CpiContext<'_, '_, '_, 'info, TransferChecked<'info>>,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    let ix = spl_token_2022::instruction::transfer_checked(
        ctx.program.key,
        ctx.accounts.from.key,
        ctx.accounts.mint.key,
        ctx.accounts.to.key,
        ctx.accounts.authority.key,
        &[],
        amount,
        decimals,
    )?;
    solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.from,
            ctx.accounts.mint,
            ctx.accounts.to,
            ctx.accounts.authority,
        ],
        ctx.signer_seeds,
    )
    .map_err(Into::into)
}
```

使用Anchor的`CpiContext`包装器更加简洁，并且将许多抽象化，但重要的是你理解底层发生了什么。

一旦`transfer_checked`函数完成，我们就可以开始更新我们的状态账户，因为这意味着转账已经完成。我们想要更新的两个账户是`pool_state`和`user_entry`账户，它们代表了整个质押池数据以及该特定用户在该质押池中的质押数据。

由于这是`stake`指令，用户正在向池中转移代币，因此用户的质押金额和池中的质押总金额的值都应该增加`stake_amount`。

为了做到这一点，我们将将`pool_state`和`user_entry`账户反序列化为可变，并使用`checked_add()`将`pool_state.amount`和`user_enry.balance`字段逐步增加`stake_amount`。`CheckedAdd`是Rust的一个功能，允许你安全地执行数学运算而不必担心缓冲区溢出。`checked_add()`添加两个数字，并检查是否发生溢出。如果发生溢出，将返回`None`。

最后，我们还将使用`Clock`获取当前Unix时间戳更新`user_entry.last_staked`字段。这只是为了跟踪特定用户质押代币的最近时间。

在`handler`函数的`transfer_checked`之后并且`Ok(())`之前添加如下内容：

```rust
let pool_state = &mut ctx.accounts.pool_state;
let user_entry = &mut ctx.accounts.user_stake_entry;

// update pool state amount
pool_state.amount = pool_state.amount.checked_add(stake_amount).unwrap();
msg!("Current pool stake total: {}", pool_state.amount);

// update user stake entry
user_entry.balance = user_entry.balance.checked_add(stake_amount).unwrap();
msg!("User stake balance: {}", user_entry.balance);
user_entry.last_staked = Clock::get().unwrap().unix_timestamp;
```

现在我们讲了很多内容，覆盖了一些新的东西，因此请随时回顾并确保所有内容都说得通。浏览所提供的所有外部资源，了解任何新话题。一旦你准备好继续，保存你的工作并验证程序仍然可以编译！

```bash
anchor build
```

### 10. `unstake`指令

最后，`unstake`交易与`stake`交易非常相似。我们需要将代币从质押池中转出给用户，在此过程中用户将收到他们的质押奖励。他们的质押奖励将在同一交易中被铸造给用户。

需要注意的是，我们不会允许用户确定要取出多少代币，我们将简单地取消他们当前已质押的所有代币。此外，我们不打算实现一个非常现实的算法来确定他们获得的奖励代币数量。我们将简单地以其质押余额乘以10来获得要铸造给他们的奖励代币数量。我们这样做是为了简化程序，保持专注于本课程的目标，即“代币扩展程序”。

账户结构将与`stake`指令非常相似，但有些许不同。我们将需要：
* `pool_state`
* `token_mint`
* `pool_authority`
* `token_vault`
* `user`
* `user_token_account`
* `user_stake_entry`
* `staking_token_mint`
* `user_stake_token_account`
* `token_program`
* `system_program`

`stake`和`unstake`所需账户之间的主要区别在于我们需要`staking_token_mint`和`user_stake_token_account`来铸造用户的质押奖励。我们不会单独讨论每个账户，因为该结构与先前指令完全相同，只是增加了这两个新账户。

首先，`staking_token_mint`账户是质押奖励代币的铸造。该铸币机构必须是`pool_authority` PDA，以便程序有能力向用户铸造代币。给定的`staking_token_mint`账户也必须符合给定的`token_program`。我们将添加一个自定义约束，验证此账户是否与`pool_state`账户的`staking_token_mint`字段中存储的pubkey匹配，如果不匹配将返回自定义的`InvalidStakingTokenMint`错误。

```rust
// 质押代币的铸币
    #[account(
        mut,
        mint::authority = pool_authority,
        mint::token_program = token_program,
        constraint = staking_token_mint.key() == pool_state.staking_token_mint
        @ StakeError::InvalidStakingTokenMint
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
```

`user_stake_token_account`与此相似。它必须与`staking_token_mint`相匹配，`user`必须是授权者，因为这是他们的质押奖励，并且该账户必须与我们在`user_stake_entry`账户中存储的他们的质押代币账户相匹配。

```rust
#[account(
        mut,
        token::mint = staking_token_mint,
        token::authority = user,
        token::token_program = token_program,
        constraint = user_stake_token_account.key() == user_stake_entry.user_stake_token_account
        @ StakeError::InvalidUserStakeTokenAccount
    )]
    pub user_stake_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
```

以下是最终`Unstake`结构应该如下：


```rust
#[derive(Accounts)]
pub struct Unstake<'info> {
    // pool state account
    #[account(
        mut,
        seeds = [token_mint.key().as_ref(), STAKE_POOL_STATE_SEED.as_bytes()],
        bump = pool_state.bump,
    )]
    pub pool_state: Account<'info, PoolState>,
    // Mint of token
    #[account(
        mut,
        mint::token_program = token_program
    )]
    pub token_mint: InterfaceAccount<'info, token_interface::Mint>,
    /// CHECK: PDA, auth over all token vaults
    #[account(
        seeds = [VAULT_AUTH_SEED.as_bytes()],
        bump
    )]
    pub pool_authority: UncheckedAccount<'info>,
    // pool token account for Token Mint
    #[account(
        mut,
        // use token_mint, pool auth, and constant as seeds for token a vault
        seeds = [token_mint.key().as_ref(), pool_authority.key().as_ref(), VAULT_SEED.as_bytes()],
        bump = pool_state.vault_bump,
        token::token_program = token_program
    )]
    pub token_vault: InterfaceAccount<'info, token_interface::TokenAccount>,
    // require a signature because only the user should be able to unstake their tokens
    #[account(
        mut,
        constraint = user.key() == user_stake_entry.user
        @ StakeError::InvalidUser
    )]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == pool_state.token_mint
        @ StakeError::InvalidMint,
        token::token_program = token_program
    )]
    pub user_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    #[account(
        mut,
        seeds = [user.key().as_ref(), pool_state.token_mint.key().as_ref(), STAKE_ENTRY_SEED.as_bytes()],
        bump = user_stake_entry.bump,

    )]
    pub user_stake_entry: Account<'info, StakeEntry>,
    // Mint of staking token
    #[account(
        mut,
        mint::authority = pool_authority,
        mint::token_program = token_program,
        constraint = staking_token_mint.key() == pool_state.staking_token_mint
        @ StakeError::InvalidStakingTokenMint
    )]
    pub staking_token_mint: InterfaceAccount<'info, token_interface::Mint>,
    #[account(
        mut,
        token::mint = staking_token_mint,
        token::authority = user,
        token::token_program = token_program,
        constraint = user_stake_token_account.key() == user_stake_entry.user_stake_token_account
        @ StakeError::InvalidUserStakeTokenAccount
    )]
    pub user_stake_token_account: InterfaceAccount<'info, token_interface::TokenAccount>,
    pub token_program: Interface<'info, token_interface::TokenInterface>,
    pub system_program: Program<'info, System>
}
```

现在，我们有两种不同的CPI需要在该指令中使用——一个是转账，一个是铸造。在该指令中，我们将使用`CpiContext`。但这里有一个问题，在`stake`指令中我们不需要来自PDA的“签名”，但在该指令中，我们需要。因此，我们无法完全遵循之前的相同模式，但我们可以做类似的操作。

同样，让我们在`Unstake`数据结构上实现两个骨架辅助函数：`transfer_checked_ctx`和`mint_to_ctx`。

```rust
impl<'info> Unstake<'info> {
    // transfer_checked for Token2022
    pub fn transfer_checked_ctx<'a>(&'a self, seeds: &'a [&[&[u8]]]) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {

    }

    // mint_to
    pub fn mint_to_ctx<'a>(&'a self, seeds: &'a [&[&[u8]]]) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        
    }
}
```

我们先处理`transfer_checked_ctx`，该方法的实现方式几乎与`stake`指令中的一样。主要区别在于这里有两个参数：`self`和`seeds`。第二个参数将是我们通常自己传递给`invoke_signed`的PDA签名种子向量。由于我们需要使用PDA签名，所以我们将调用`CpiContext::new_with_signer`构造函数，而不是调用`CpiContext::new`构造函数。

`new_with_signer`定义如下:
```rust
pub fn new_with_signer(
    program: AccountInfo<'info>,
    accounts: T,
    signer_seeds: &'a [&'b [&'c [u8]]]
) -> Self
```

此外，我们`TransferChecked`结构中的`from`和`to`账户将与以前相反。

```rust
// transfer_checked for spl-token or Token2022
pub fn transfer_checked_ctx<'a>(&'a self, seeds: &'a [&[&[u8]]]) -> CpiContext<'_, '_, '_, 'info, TransferChecked<'info>> {

    let cpi_program = self.token_program.to_account_info();
    let cpi_accounts = TransferChecked {
        from: self.user_token_account.to_account_info(),
        to: self.token_vault.to_account_info(),
        authority: self.pool_authority.to_account_info(),
        mint: self.token_mint.to_account_info()
    };

    CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
}
```
查看[`anchor_lang` crate文档，以了解更多关于`CpiContext`](https://docs.rs/anchor-lang/latest/anchor_lang/context/struct.CpiContext.html#method.new_with_signer)。

接下来是`mint_to_ctx`函数，我们需要与`transfer_checked_ctx`恰好做同样的事情，但是目标是`mint_to`指令。为了做到这一点，我们需要使用`MintTo`结构，而不是使用`TransferChecked`结构。`MintTo`定义如下:
```rust
pub struct MintTo<'info> {
    pub mint: AccountInfo<'info>,
    pub to: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}
```
[`anchor_spl::token_2022::MintTo` rust crate文档](https://docs.rs/anchor-spl/latest/anchor_spl/token_2022/struct.MintTo.html)。

考虑到这一点，我们可以像之前实现`transfer_checked_ctx`一样实现`mint_to_ctx`。这次应用的对象是完全相同的`token_program`，所以`cpi_program`应该与之前一样。我们构造`MinTo`结构与我们构造`TransferChecked`结构一样，只是在这里传递适当的账户。`mint`是`staking_token_mint`，因为这是我们将要铸造给用户的货币，`to`是用户的`user_stake_token_account`，`authority`是`pool_authority`，因为这个PDA应该对这个货币有唯一的控制权。

最后，这个函数返回一个使用传递进来的签名种子构建的`CpiContext`对象。

```rust
// 铸造货币
pub fn mint_to_ctx<'a>(&'a self, seeds: &'a [&[&[u8]]]) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
    let cpi_program = self.token_program.to_account_info();
    let cpi_accounts = MintTo {
        mint: self.staking_token_mint.to_account_info(),
        to: self.user_stake_token_account.to_account_info(),
        authority: self.pool_authority.to_account_info()
    };

    CpiContext::new_with_signer(cpi_program, cpi_accounts, seeds)
}
```

现在我们可以继续编写我们`handler`函数的逻辑了。这个指令需要更新池和用户的状态账户，转移所有用户投注的货币，并铸造用户的奖励货币。首先，我们需要记录一些信息，并决定要转移给用户多少个货币。

我们已经在`user_stake_entry`账户中跟踪了用户的投注数量，所以我们知道这个用户在这个时候投注了多少货币。我们可以从`user_entry.balance`字段中读取这个数量。接下来，我们会记录一些信息，以便稍后检查。我们还将验证需要转移的数量是否不大于存储在池中的数量，作为额外的安全措施。如果是，我们将返回一个自定义的`OverdrawError`并阻止用户从池中取款。

```rust
pub fn handler(ctx: Context<Unstake>) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());
    
    let user_entry = &ctx.accounts.user_stake_entry;
    let amount = user_entry.balance;
    let decimals = ctx.accounts.token_mint.decimals;

    msg!("用户投注余额: {}", user_entry.balance);
    msg!("提取所有用户投注余额。待提取的货币数量: {}", amount);
    msg!("提取前总的投注数额: {}", ctx.accounts.pool_state.amount);

    // 验证用户和池中是否有足够数量的待转移货币
    if amount > ctx.accounts.pool_state.amount {
        return Err(StakeError::OverdrawError.into())
    }

    // 更多的代码即将到来 

    Ok(())
}
```

接下来，我们将获取PDA签名所需的签名种子。`pool_authority`是需要在这些CPIs中进行签名的，因此我们使用该账户的种子。

```rust
// 程序签名种子
let auth_bump = ctx.accounts.pool_state.vault_auth_bump;
let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
let signer = &[&auth_seeds];
```

一旦我们将这些种子存储在`signer`变量中，我们就可以很容易地将它传递到`transfer_checked_ctx()`方法中。与此同时，我们将从Anchor crate中调用`transfer_checked`辅助函数来实际调用CPI。

```rust
// 转移投注的货币
transfer_checked(ctx.accounts.transfer_checked_ctx(signer), amount, decimals)?;
```

接下来，我们将计算需要铸造给用户的奖励货币数量，并使用我们的`mint_to_ctx`函数调用`mint_to`指令。记住，我们只是取用户投注的货币数量乘以10来得到他们的奖励数量。这是一个非常简单的算法，在生产中没有意义，但在这里作为例子是有效的。

注意我们在这里使用了`checked_mul()`，类似于我们在`stake`指令中使用的`checked_add`。同样，这是为了防止缓冲区溢出。

```rust
// 铸造用户的投注奖励，是投注货币数量的10倍
let stake_rewards = amount.checked_mul(10).unwrap();

// 铸造奖励给用户
mint_to(ctx.accounts.mint_to_ctx(signer), stake_rewards)?;
```

最后，我们需要通过减去从池和用户余额中提取的数量来更新我们的状态账户。我们将使用`checked_sub()`来做这个操作。

```rust
// 借用可变引用
let pool_state = &mut ctx.accounts.pool_state;
let user_entry = &mut ctx.accounts.user_stake_entry;

// 从池的总数中减去转移的数量
pool_state.amount = pool_state.amount.checked_sub(amount).unwrap();
msg!("提取后总的投注数额: {}", pool_state.amount);

// 更新用户投注记录
user_entry.balance = user_entry.balance.checked_sub(amount).unwrap();
user_entry.last_staked = Clock::get().unwrap().unix_timestamp;
```

把这些放到一起就得到了我们最终的`handler`函数：

```rust
pub fn handler(ctx: Context<Unstake>) -> Result <()> {
    check_token_program(ctx.accounts.token_program.key());
    
    let user_entry = &ctx.accounts.user_stake_entry;
    let amount = user_entry.balance;
    let decimals = ctx.accounts.token_mint.decimals;

    msg!("User stake balance: {}", user_entry.balance);
    msg!("Withdrawing all of users stake balance. Tokens to withdraw: {}", amount);
    msg!("Total staked before withdrawal: {}", ctx.accounts.pool_state.amount);

    // verify user and pool have >= requested amount of tokens staked
    if amount > ctx.accounts.pool_state.amount {
        return Err(StakeError::OverdrawError.into())
    }

    // program signer seeds
    let auth_bump = ctx.accounts.pool_state.vault_auth_bump;
    let auth_seeds = &[VAULT_AUTH_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // transfer staked tokens
    transfer_checked(ctx.accounts.transfer_checked_ctx(signer), amount, decimals)?;

    // mint users staking rewards, 10x amount of staked tokens
    let stake_rewards = amount.checked_mul(10).unwrap();

    // mint rewards to user
    mint_to(ctx.accounts.mint_to_ctx(signer), stake_rewards)?;

    // borrow mutable references
    let pool_state = &mut ctx.accounts.pool_state;
    let user_entry = &mut ctx.accounts.user_stake_entry;

    // subtract transferred amount from pool total
    pool_state.amount = pool_state.amount.checked_sub(amount).unwrap();
    msg!("Total staked after withdrawal: {}", pool_state.amount);

    // update user stake entry
    user_entry.balance = user_entry.balance.checked_sub(amount).unwrap();
    user_entry.last_staked = Clock::get().unwrap().unix_timestamp;

    Ok(())
}
```


这就是我们的质押程序！我们提前为您编写了整套测试套件，以便您对该程序进行运行。请安装所需的测试包并运行测试：

```bash
npm install
anchor test
```

如果您遇到任何问题，请随时查看[解决方案分支](https://github.com/Unboxed-Software/token22-staking/tree/solution)。

# 挑战

创建一个您自己的程序，既适用于 Token 程序又适用于 Token 扩展程序。

---
title: Solana 程序中的环境变量
objectives:
- 在 `Cargo.toml` 文件中定义程序特性
- 使用 Rust `cfg` 属性根据启用的特性条件编译代码
- 使用 Rust `cfg!` 宏根据启用的特性条件编译代码
- 创建一个仅由管理员执行的指令，用于设置可以用于存储程序配置数值的程序账户
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- 对于在链上程序中创建不同环境的“开箱即用”解决方案并不存在，但您可以通过创造力实现类似于环境变量的功能。
- 您可以使用 `cfg` 属性与**Rust特性**（`#[cfg(feature = ...)]`）根据提供的 Rust 特性运行不同代码或提供不同的变量数值。_这是在编译时发生的，不允许在部署后交换数值_。
- 同样地，您可以使用 `cfg!` **宏**根据启用的特性条件编译不同的代码路径。
- 或者，您可以通过创建仅可被程序的升级权限访问的账户和指令来实现类似于在部署后可以修改的环境变量。

# 教训

工程师在各种软件开发中面临的一个困难是编写可测试代码以及在本地开发、测试、生产等不同环境中创建不同环境的能力。

在 Solana 程序开发中，这可能特别困难。例如，想象一下创建一个 NFT 质押程序，可用于每个质押的 NFT 每天奖励 10 个代币。您如何测试在几百毫秒内运行的测试中索赔奖励的能力？这远不足以赚取奖励。

传统的网络开发通过环境变量来解决部分问题，这些变量在不同的“环境”中可以有不同的值。目前，在 Solana 程序中并没有形式化的环境变量的概念。如果有的话，您可以轻松地使测试环境中的奖励为每天 10,000,000 个代币，从而更容易地测试索赔奖励的功能。

幸运的是，如果您具有创造力，可以实现类似的功能。最佳方法可能是两种方法的结合：

1. 允许您在编译命令中指定构建的“环境”的 Rust 特性标识，以及相应调整特定数值的代码
2. 仅允许程序的升级权限访问的程序“仅管理员”账户和指令

## Rust 特性标识

创建环境最简单的方法之一是使用 Rust 特性。特性在程序的 `Cargo.toml` 文件的 `[features]` 表中定义。您可以为不同用例定义多个特性。

```toml
[features]
feature-one = []
feature-two = []
```

需要注意的是，上述代码仅仅定义了一个特性。当您测试您的程序时，可以使用 `--features` 标识与 `anchor test` 命令来启用特性。

```bash
anchor test -- --features "feature-one"
```

您还可以通过使用逗号分隔它们来指定多个特性。

```bash
anchor test -- --features "feature-one", "feature-two"
```

### 使用 `cfg` 属性使代码变为条件式

有了定义的特性，您随后可以在您的代码中使用 `cfg` 属性，根据特性是否启用来条件编译代码。这使您可以在程序中包含或排除特定代码。

使用 `cfg` 属性的语法与其他属性宏一样：`#[cfg(feature=[FEATURE_HERE])]`。例如，以下代码在启用了 `testing` 特性时编译 `function_for_testing` 函数，在其他情况下编译 `function_when_not_testing` 函数：

```rust
#[cfg(feature = "testing")]
fn function_for_testing() {
    // 仅当启用了“testing”特性标识时才会包含的代码
}

#[cfg(not(feature = "testing"))]
fn function_when_not_testing() {
    // 仅当未启用“testing”特性标识时才会包含的代码
}
```

这使您可以在编译时通过启用或禁用特性来在 Anchor 程序中启用或禁用某些功能。

可以设想想要使用此功能来创建不同程序部署的不同“环境”。例如，并非所有的代币都在主网和开发网上有部署。因此，您可能会为主网部署硬编码一个代币地址，但为开发网和本地网部署另一个地址。这样，您可以在不需要对代码本身进行任何更改的情况下快速切换不同的环境。

以下代码显示了一个 Anchor 程序的示例，该程序使用 `cfg` 属性为本地测试与其他部署包含不同的代币地址：

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[cfg(feature = "local-testing")]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("WaoKNLQVDyBx388CfjaVeyNbs3MT2mPgAhoCfXyUvg8");
}

#[cfg(not(feature = "local-testing"))]
pub mod constants {
    use solana_program::{pubkey, pubkey::Pubkey};
    pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

#[program]
pub mod test_program {
    use super::*;

    pub fn initialize_usdc_token_account(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = payer,
    )]
    pub token: Account<'info, TokenAccount>,
    #[account(address = constants::USDC_MINT_PUBKEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
```

在此示例中，`cfg` 属性被用于有条件地编译 `constants` 模块的两个不同实现。这使程序可以根据是否启用了 `local-testing` 特性标识使用不同的值来设置 `USDC_MINT_PUBKEY` 常量。

### 使用 `cfg!` 宏使代码变为条件式

类似于 `cfg` 属性，Rust 中的 `cfg!` **宏**允许您在运行时检查某些配置标识的值。如果您希望根据特定配置标识的值来执行不同的代码路径，这将会很有用。


您可以使用此方法绕过或调整我们之前提到的 NFT 抵押应用程序中需要的基于时间的限制。当运行测试时，您可以执行代码，该代码在与运行生产版本相比提供了更高的抵押奖励。

要在 Anchor 程序中使用 `cfg!` 宏，您只需在相关条件语句中添加 `cfg!` 宏调用：

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn test_function(ctx: Context<Test>) -> Result<()> {
        if cfg!(feature = "local-testing") {
            // 仅当启用了 "local-testing" 功能时才执行此代码路径
            // ...
        } else {
            // 仅当未启用 "local-testing" 功能时才执行此代码路径
            // ...
        }
        // 此处包括的应始终包括的代码
        ...
        Ok(())
    }
}
```

在这个示例中，`test_function` 使用 `cfg!` 宏来在运行时检查 `local-testing` 功能的值。如果启用了 `local-testing` 功能，则执行第一个代码路径。如果未启用 `local-testing` 功能，则执行第二个代码路径。

## 仅管理员指令

特性标志非常适用于在编译时调整值和代码路径，但如果在部署程序后需要调整某些内容，则帮助不大。

例如，如果您的 NFT 抵押程序必须转变并使用不同的奖励代币，那么将无法更新该程序。如果只有一种方法让程序管理员更新某些程序值…… 好消息是，这是可能的！

首先，您需要构造程序以将您预期要更改的值存储在账户中，而不要将其硬编码到程序代码中。

接下来，您需要确保只有某个已知的程序授权机构，或者我们所谓的管理员，才能更新此账户。这意味着修改该账户数据的任何指令都需要约束，限制谁可以为指令签名。在理论上，这听起来很简单，但有一个主要问题：程序如何知道谁是授权的管理员？

嗯，有几种解决方案，每种都有其自身的优势和劣势：

1. 在代码中硬编码一个管理员公钥，该公钥可在仅管理员指令约束中使用。
2. 使程序的升级授权机构成为管理员。
3. 将管理员存储在配置账户中，并在 `initialize` 指令中设置第一个管理员。

### 创建配置账户

第一步是向您的程序添加我们将称之为 "配置" 账户。您可以根据需要自定义此功能，但我们建议使用单个全局 PDA。在 Anchor 中，这仅意味着创建一个账户结构并使用单个种子推导出账户地址。

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

上面的示例显示了我们在整个课程中所引用的 NFT 抵押程序示例的假想配置账户。它存储代表应用于奖励的代币以及抵押每天发放的代币数量的数据。

定义配置账户后，只需确保代码的其余部分在使用这些值时引用此账户。这样，如果账户中的数据发生更改，程序会相应地适应。

### 限制配置更新仅限硬编码管理员

您需要一种方法来初始化和更新配置账户数据。这意味着您需要具有一个或多个仅有管理员才能调用的指令。最简单的方法是在代码中硬编码一个管理员的公钥，然后在指令的账户验证中添加一个简单的签名者检查，将签名者与该公钥进行比较。

在 Anchor 中，将 `update_program_config` 指令限制为仅由硬编码管理员使用可能如下所示：

```rust
#[program]
mod my_program {
    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        reward_token: Pubkey,
        rewards_per_day: u64
    ) -> Result<()> {
        ctx.accounts.program_config.reward_token = reward_token;
        ctx.accounts.program_config.rewards_per_day = rewards_per_day;

        Ok(())
    }
}

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN_PUBKEY: Pubkey = pubkey!("ADMIN_WALLET_ADDRESS_HERE");

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == ADMIN_PUBKEY)]
    pub authority: Signer<'info>,
}
```

在指令逻辑执行之前，将执行检查以确保指令的签名者与硬编码的 `ADMIN_PUBKEY` 匹配。请注意，上述示例未显示初始化配置账户的指令，但应具有类似的约束，以确保攻击者无法使用意外值初始化账户。

虽然此方法有效，但这也意味着需要额外跟踪管理员钱包，除了程序的升级授权机构。通过几行额外的代码，您可以简单地限制指令只能由升级授权机构调用。唯一棘手的部分是获取程序的升级授权机构进行比较。

### 限制配置更新仅限程序的升级授权机构

幸运的是，每个程序都有一个程序数据账户，对应于 Anchor 的 `ProgramData` 账户类型，并且在其数据中有 `upgrade_authority_address` 字段。程序本身在其数据中存储此账户的地址，并将其称为 `programdata_address` 字段。

因此，除了硬编码管理员示例中指令所需的两个账户外，此指令还需要 `program` 和 `program_data` 账户。

然后，账户需要以下约束：

1. 对程序的约束，确保提供的 `program_data` 账户与程序的 `programdata_address` 字段匹配
2. 对 `program_data` 账户的约束，确保指令的签名者与 `program_data` 账户的 `upgrade_authority_address` 字段匹配。

完成后，代码如下所示：

```rust
...

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, MyProgram>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub authority: Signer<'info>,
}
```

同样，上面的示例未显示初始化配置账户的指令，但应具有相同的约束，以确保攻击者无法使用意外值初始化账户。

如果这是您第一次听说程序数据帐户，值得阅读一下 [此概念文档](https://www.notion.so/29780c48794c47308d5f138074dd9838) 关于程序部署。

### 限制配置更新为指定管理员

前面的两个选项都相当安全，但也不够灵活。如果您想要将管理员更改为其他人怎么办？为此，您可以将管理员存储在配置帐户上。

```rust
pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[account]
pub struct ProgramConfig {
    admin: Pubkey,
    reward_token: Pubkey,
    rewards_per_day: u64,
}
```

然后，您可以通过对配置帐户的 `admin` 字段进行签名检查来限制“更新”指令。

```rust
...

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = SEED_PROGRAM_CONFIG, bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(constraint = authority.key() == program_config.admin)]
    pub authority: Signer<'info>,
}
```

这里有一个需要注意的地方：在部署程序和初始化配置帐户之间的时间内，_没有管理员_。这意味着初始化配置帐户的指令不能受限于只允许管理员作为调用方。这意味着它可能会被一个试图将自己设置为管理员的攻击者调用。

尽管听起来很糟糕，但实际上这只意味着在您自己初始化配置帐户并验证帐户上列出的管理员是否符合您的预期之前，您不应该将您的程序视为“已初始化”。如果您的部署脚本部署然后立即调用 `initialize`，很有可能攻击者甚至都不知道您的程序的存在，更不用说试图将自己设置为管理员。如果出现不幸运的情况，有人“拦截”您的程序，您可以关闭具有升级权限的程序并重新部署。

# 实验

现在让我们一起尝试一下。在本实验中，我们将使用一个简单的程序，该程序可以启用 USDC 付款。该程序收取少量费用以促进转账。请注意，这有些牵强附会，因为您可以在没有中间合同的情况下进行直接转账，但这模拟了一些复杂的 DeFi 程序工作的方式。

在测试我们的程序时，我们很快就会了解到，它可能从管理员控制的配置帐户和一些特性标志提供的灵活性中受益。

### 1. 初始代码

从 [此存储库的 `starter` 分支](https://github.com/Unboxed-Software/solana-admin-instructions/tree/starter) 下载起始代码。代码包含了一个具有单个指令和`tests` 目录中的单个测试的程序。

让我们快速了解一下程序的工作原理。

`lib.rs` 文件包括用于 USDC 地址的常量和单个 `payment` 指令。`payment` 指令简单地调用 `instructions/payment.rs` 文件中的 `payment_handler` 函数，其中包含指令逻辑。

`instructions/payment.rs` 文件包含 `payment_handler` 函数以及表示 `payment` 指令所需帐户的 `Payment` 帐户验证结构。`payment_handler` 函数从付款金额中计算出 1% 的费用，将费用转移到指定的代币帐户，然后将剩余金额转移到付款接收者。

最后，`tests` 目录包含一个单独的测试文件 `config.ts`，它简单地调用 `payment` 指令并断言相应的代币账户余额已经相应地借记和贷记。

在我们继续之前，请花点时间熟悉这些文件及其内容。

### 2. 运行现有测试

让我们首先运行现有的测试。

确保使用 `yarn` 或 `npm install` 安装 `package.json` 文件中列出的依赖项。然后确保运行 `anchor keys list` 以将您的程序的公钥打印到控制台。这取决于您本地拥有的密钥对而有所不同，因此您需要更新 `lib.rs` 和 `Anchor.toml` 以使用 *您的* 密钥。

最后，运行 `anchor test` 开始测试。它应该会因以下输出而失败：

```
Error: failed to send transaction: Transaction simulation failed: Error processing Instruction 0: incorrect program id for instruction
```

出现此错误的原因是我们尝试使用主网 USDC 铸造地址（如程序的 `lib.rs` 文件中硬编码的那样），但该铸造在本地环境中并不存在。

### 3. 添加 `local-testing` 特性

为了解决这个问题，我们需要一个可以在本地使用的铸造 *并且* 硬编码到程序中。因为在测试期间本地环境经常被重置，所以您需要存储一个可以每次重建相同铸造地址的密钥对。

另外，您不希望在本地和主网构建之间不断地更改硬编码的地址，因为这可能会引入人为错误（而且很烦人）。因此，我们将创建一个 `local-testing` 特性，当启用时，程序将使用我们的本地铸造，否则使用生产 USDC 铸造。

通过运行 `solana-keygen grind` 生成新的密钥对。运行以下命令，生成一个以 "env" 开头的公钥的密钥对。

```
solana-keygen grind --starts-with env:1
```

一旦找到一个密钥对，您应该会看到类似以下的输出：

```
Wrote keypair to env9Y3szLdqMLU9rXpEGPqkjdvVn8YNHtxYNvCKXmHe.json
```

密钥对已写入到您的工作目录中的文件。现在，我们有了一个占位符 USDC 地址，让我们修改 `lib.rs` 文件。使用 `cfg` 属性根据 `local-testing` 特性是否已启用来定义 `USDC_MINT_PUBKEY` 常量。请记住，要为 `local-testing` 设置 `USDC_MINT_PUBKEY` 常量，使用上一步生成的密钥对，而不是复制以下的密钥对。

```rust
use anchor_lang::prelude::*;
use solana_program::{pubkey, pubkey::Pubkey};
mod instructions;
use instructions::*;

declare_id!("BC3RMBvVa88zSDzPXnBXxpnNYCrKsxnhR3HwwHhuKKei");

#[cfg(feature = "local-testing")]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("envgiPXWwmpkHFKdy4QLv2cypgAWmVTVEm71YbNpYRu");

#[cfg(not(feature = "local-testing"))]
#[constant]
pub const USDC_MINT_PUBKEY: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

pub const SEED_PROGRAM_CONFIG: &[u8] = b"program_config";

#[constant]
pub const ADMIN: Pubkey = pubkey!("...");

#[program]
pub mod config {
    use super::*;
    pub fn initialize_program_config(ctx: Context<InitializeProgramConfig>) -> Result<()> {
        instructions::initialize_program_config_handler(ctx)
    }

    pub fn update_program_config(
        ctx: Context<UpdateProgramConfig>,
        new_fee: u64,
    ) -> Result<()> {
        instructions::update_program_config_handler(ctx, new_fee)
    }

    pub fn payment(ctx: Context<Payment>, amount: u64) -> Result<()> {
        instructions::payment_handler(ctx, amount)
    }
}
```

### 5. 程序配置状态

接下来，让我们定义 `ProgramConfig` 状态的结构。此账户将存储管理员、收取手续费的代币账户以及手续费率。我们还会指定存储此结构所需的字节数量。

在 `/src` 目录下创建一个名为 `state.rs` 的新文件，并添加以下代码。

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,
    pub fee_destination: Pubkey,
    pub fee_basis_points: u64,
}

impl ProgramConfig {
    pub const LEN: usize = 8 + 32 + 32 + 8;
}
```

### 6. 添加初始化程序配置账户指令

现在让我们为初始化程序配置账户创建指令逻辑。它只能由使用 `ADMIN` 密钥签名的交易调用，应设置 `ProgramConfig` 账户上的所有属性。

在路径 `/src/instructions/program_config` 下创建一个名为 `program_config` 的文件夹。该文件夹将存储与程序配置账户相关的所有指令。

在 `program_config` 文件夹中，创建一个名为 `initialize_program_config.rs` 的文件，并添加以下代码。

```rust
use crate::state::ProgramConfig;
use crate::ADMIN;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(init, seeds = [SEED_PROGRAM_CONFIG], bump, payer = authority, space = ProgramConfig::LEN)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(mut, address = ADMIN)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_program_config_handler(ctx: Context<InitializeProgramConfig>) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.authority.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = 100;
    Ok(())
}
```
### 7. 添加更新程序配置费指令

接下来，实现更新配置账户的指令逻辑。该指令应要求签署者与存储在`program_config`账户中的`admin`匹配。

在`program_config`文件夹中，创建一个名为`update_program_config.rs`的文件，并添加以下代码。

```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct UpdateProgramConfig<'info> {
    #[account(mut, seeds = [SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,
    #[account( token::mint = USDC_MINT_PUBKEY)]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = program_config.admin,
    )]
    pub admin: Signer<'info>,
    /// CHECK: arbitrarily assigned by existing admin
    pub new_admin: UncheckedAccount<'info>,
}

pub fn update_program_config_handler(
    ctx: Context<UpdateProgramConfig>,
    new_fee: u64,
) -> Result<()> {
    ctx.accounts.program_config.admin = ctx.accounts.new_admin.key();
    ctx.accounts.program_config.fee_destination = ctx.accounts.fee_destination.key();
    ctx.accounts.program_config.fee_basis_points = new_fee;
    Ok(())
}
```

### 8. 添加 mod.rs 并更新 instructions.rs

接下来，让我们公开我们创建的指令处理程序，以便从 `lib.rs` 的调用不显示错误。首先在 `program_config` 文件夹中添加一个名为 `mod.rs` 的文件。添加下面的代码以使两个模块，`initialize_program_config` 和 `update_program_config` 可访问。

```rust
mod initialize_program_config;
pub use initialize_program_config::*;

mod update_program_config;
pub use update_program_config::*;
```

现在，更新 `/src/instructions.rs` 路径下的 `instructions.rs` 文件。添加下面的代码以使两个模块，`program_config` 和 `payment` 可访问。

```rust
mod program_config;
pub use program_config::*;

mod payment;
pub use payment::*;
```

### 9. 更新支付指令

最后，让我们更新支付指令，检查指令中的 `fee_destination` 帐户是否与程序配置帐户中存储的 `fee_destination` 匹配。然后，根据程序配置帐户中存储的 `fee_basis_point` 更新指令的费用计算。


```rust
use crate::state::ProgramConfig;
use crate::SEED_PROGRAM_CONFIG;
use crate::USDC_MINT_PUBKEY;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Payment<'info> {
    #[account(
        seeds = [SEED_PROGRAM_CONFIG],
        bump,
        has_one = fee_destination
    )]
    pub program_config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub fee_destination: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = USDC_MINT_PUBKEY
    )]
    pub receiver_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    #[account(mut)]
    pub sender: Signer<'info>,
}

pub fn payment_handler(ctx: Context<Payment>, amount: u64) -> Result<()> {
    let fee_amount = amount
        .checked_mul(ctx.accounts.program_config.fee_basis_points)
        .unwrap()
        .checked_div(10000)
        .unwrap();
    let remaining_amount = amount.checked_sub(fee_amount).unwrap();

    msg!("Amount: {}", amount);
    msg!("Fee Amount: {}", fee_amount);
    msg!("Remaining Transfer Amount: {}", remaining_amount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.fee_destination.to_account_info(),
            },
        ),
        fee_amount,
    )?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.receiver_token_account.to_account_info(),
            },
        ),
        remaining_amount,
    )?;

    Ok(())
}
```


### 10. 测试

现在，我们完成了实现新程序配置结构和指令，让我们继续测试我们的更新程序。首先，将程序配置帐户的PDA添加到测试文件中。

```typescript
describe("config", () => {
  ...
  const programConfig = findProgramAddressSync(
    [Buffer.from("program_config")],
    program.programId
  )[0]
...
```

接下来，更新测试文件，添加三个更多的测试，测试：

1. 程序配置帐户是否正确初始化
2. 支付指令是否按预期工作
3. 管理员是否可以成功更新配置帐户
4. 除管理员外其他人是否无法更新配置帐户

第一个测试初始化程序配置帐户，并验证设置了正确的费用，以及程序配置帐户上存储了正确的管理员。

```typescript
it("Initialize Program Config Account", async () => {
  const tx = await program.methods
    .initializeProgramConfig()
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      authority: wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    100
  )
  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).admin.toString(),
    wallet.publicKey.toString()
  )
})
```

第二个测试验收支付指令是否正确工作，将费用发送到费用目的地，将剩余余额转移到接收方。在这里，我们更新现有测试，包括 `programConfig` 帐户。

```typescript
it("Payment completes successfully", async () => {
  const tx = await program.methods
    .payment(new anchor.BN(10000))
    .accounts({
      programConfig: programConfig,
      feeDestination: feeDestination,
      senderTokenAccount: senderTokenAccount,
      receiverTokenAccount: receiverTokenAccount,
      sender: sender.publicKey,
    })
    .transaction()

  await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])```

## 翻译 private_upload/default_user/2024-06-02-00-54-02/content copy.zip.extract/content copy/env-variables.md.part-5.md

```typescript
  assert.strictEqual(
    (await connection.getTokenAccountBalance(senderTokenAccount)).value
      .uiAmount,
    0
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(feeDestination)).value.uiAmount,
    100
  )

  assert.strictEqual(
    (await connection.getTokenAccountBalance(receiverTokenAccount)).value
      .uiAmount,
    9900
  )
})
```

第三个测试尝试更新程序配置账户上的费用，应该是成功的。

```typescript
it("Update Program Config Account", async () => {
  const tx = await program.methods
    .updateProgramConfig(new anchor.BN(200))
    .accounts({
      programConfig: programConfig,
      admin: wallet.publicKey,
      feeDestination: feeDestination,
      newAdmin: sender.publicKey,
    })
    .rpc()

  assert.strictEqual(
    (
      await program.account.programConfig.fetch(programConfig)
    ).feeBasisPoints.toNumber(),
    200
  )
})
```

第四个测试尝试更新程序配置账户上的费用，其中管理员不是存储在程序配置账户上的管理员，应该会失败。

```typescript
it("Update Program Config Account with unauthorized admin (expect fail)", async () => {
  try {
    const tx = await program.methods
      .updateProgramConfig(new anchor.BN(300))
      .accounts({
        programConfig: programConfig,
        admin: sender.publicKey,
        feeDestination: feeDestination,
        newAdmin: sender.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [sender])
  } catch (err) {
    expect(err)
  }
})
```

最后，使用以下命令运行测试：

```
anchor test -- --features "local-testing"
```

您应该会看到以下输出：

```
config
  ✔ Initialize Program Config Account (199ms)
  ✔ Payment completes successfully (405ms)
  ✔ Update Program Config Account (403ms)
  ✔ Update Program Config Account with unauthorized admin (expect fail)

4 passing (8s)
```

就是这样！通过这样做，您使程序更容易使用了。如果您想查看最终的解决方案代码，可以在[相同的存储库](https://github.com/Unboxed-Software/solana-admin-instructions/tree/solution)的`solution`分支上找到它。

# 挑战

现在该你自己做点事了。我们提到过可以使用程序的升级权限作为初始管理员。继续更新实验室的`initialize_program_config`，使只有升级权限可以调用它，而不是有一个硬编码`ADMIN`。

请注意，当在本地网络上运行`anchor test`命令时，会启动一个新的测试验证器，该验证器使用`solana-test-validator`。这个测试验证器使用了一个不可升级的加载器。不可升级的加载器使得当验证器启动时，程序的`program_data`账户不会被初始化。从课程中您会记得，这个账户是我们如何从程序中访问升级权限的。

要解决这个问题，可以将`deploy`函数添加到测试文件中，该函数在测试启动后执行带有可升级加载器的程序的deploy命令。要使用它，运行`anchor test --skip-deploy`，并在测试中调用`deploy`函数，以在测试验证器启动后运行deploy命令。

```typescript
import { execSync } from "child_process"

...

const deploy = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/config-keypair.json $(pwd)/target/deploy/config.so`
  execSync(deployCmd)
}

...

before(async () => {
  ...
  deploy()
})
```

例如，运行带有特性的测试的命令将如下所示：

```
anchor test --skip-deploy -- --features "local-testing"
```

尝试自己做这个，但如果遇到困难，随时可以参考[相同存储库](https://github.com/Unboxed-Software/solana-admin-instructions/tree/challenge)的`challenge`分支，看看可能的解决方案之一。


## 完成了实验室吗？

将您的代码推送到GitHub，然后[告诉我们您对本课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=02a7dab7-d9c1-495b-928c-a4412006ec20)！
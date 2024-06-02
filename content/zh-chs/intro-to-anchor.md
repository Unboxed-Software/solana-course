---
title: Anchor开发简介
objectives:
- 使用Anchor框架构建基本程序
- 描述Anchor程序的基本结构
- 解释如何使用Anchor实现基本账户验证和安全检查
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- **Anchor**是用于构建Solana程序的框架
- **Anchor宏**通过抽象掉大量样板代码加快了构建Solana程序的过程
- Anchor允许您更轻松地构建**安全程序**，通过执行特定的安全检查、需要账户验证，以及提供实现额外检查的简单方式。

# 课程

## 什么是Anchor？

Anchor使编写Solana程序变得更加简单、快速和安全，使其成为Solana开发的“首选”框架。它更容易组织和理清代码结构，自动实现常见的安全检查，并消除了与编写Solana程序相关的大量样板代码。

## Anchor程序结构

Anchor使用宏和特征为您生成Rust样板代码。这为您的程序提供了清晰的结构，以便更轻松地理清代码结构。主要的高级宏和属性包括：

- `declare_id` - 用于声明程序的链上地址的宏
- `#[program]` - 属性宏，用于表示包含程序指令逻辑的模块
- `Accounts` - 应用于表示指令所需账户列表的结构的特征
- `#[account]` - 用于定义程序的自定义账户类型的属性宏

在我们将所有组件放在一起之前，让我们先讨论每个组件。

## 声明您的程序ID

`declare_id`宏用于指定程序的链上地址（即`programId`）。当您首次构建Anchor程序时，框架将生成一个新的密钥对。这将成为用于部署程序的默认密钥对，除非另有规定。相应的公钥应作为`declare_id!`宏中指定的`programId`。

```rust
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
```

## 定义指令逻辑

`#[program]`属性宏定义了包含程序指令的模块。在这里，您可以为程序的每个指令实现业务逻辑。

模块中带有`#[program]`属性的每个公共函数将被视为单独的指令。

每个指令函数都需要一个`Context`类型的参数，并可以选择包括额外的函数参数来表示指令数据。Anchor将自动处理指令数据的反序列化，以便您可以将指令数据作为Rust类型处理。

```rust
#[program]
mod program_module_name {
    use super::*;

    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}
```

### 指令`Context`

`Context`类型向您的指令逻辑公开了指令元数据和账户。

```rust
pub struct Context<'a, 'b, 'c, 'info, T> {
    /// 当前执行的程序id。
    pub program_id: &'a Pubkey,
    /// 反序列化的账户。
    pub accounts: &'b mut T,
    /// 已给出但尚未反序列化或验证的剩余账户。
    /// 当您直接使用此属性时请务必小心。
    pub remaining_accounts: &'c [AccountInfo<'info>],
    /// 在约束验证中发现的bump seeds。这是作为便利提供的，以便处理程序不必重新计算bump seeds或将它们作为参数传递。
    pub bumps: BTreeMap<String, u8>,
}
```

`Context`是一个通用类型，其中`T`定义了指令所需的账户列表。当您使用`Context`时，您需要将`T`的具体类型指定为采用`Accounts`特征的结构体（例如`Context<AddMovieReviewAccounts>`）。通过此上下文参数，指令可以访问：

- 传递到指令中的账户（`ctx.accounts`）
- 执行程序的程序ID（`ctx.program_id`）
- 剩余账户（`ctx.remaining_accounts`）。`remaining_accounts`是一个包含所有传递到指令中但未在`Accounts`结构体中声明的账户的向量。
- `Accounts`结构体中任何PDA账户的bump（`ctx.bumps`）


## 定义指令账户

`Accounts`特征定义了已验证账户的数据结构。采用此特征的结构体定义了给定指令所需的账户列表。然后，这些账户通过指令的`Context`公开，因此不再需要手动进行账户迭代和反序列化。

您通常通过派生宏（例如`#[derive(Accounts)]`）应用`Accounts`特征。这会在给定结构上实现一个`Accounts`反序列化器，并消除了手动反序列化每个账户的需要。

`Accounts`特征的实现负责执行所有必要的约束检查，以确保账户满足程序安全运行所需的条件。使用`#account(..)`属性为结构的每个字段指定了约束（稍后详细介绍）。

例如，`instruction_one`需要类型为`InstructionAccounts`的`Context`参数。使用`#[derive(Accounts)]`宏来实现`InstructionAccounts`结构，其中包括三个账户：`account_name`、`user`和`system_program`。

```rust
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
		...
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}
```
当调用`instruction_one`时，程序会：

- 检查传递到指令中的账户是否与`InstructionAccounts`结构中指定的账户类型匹配
- 针对指定的任何额外约束检查账户

如果传递到`instruction_one`的任何账户未通过`InstructionAccounts`结构中指定的账户验证或安全检查，则该指令在达到程序逻辑之前就会失败。

## 账户验证

您可能已经注意到在先前的示例中，`InstructionAccounts`中的一个账户类型为`Account`，一个为`Signer`，一个为`Program`。

Anchor提供了一些可以用来表示账户的账户类型。每种类型实现了不同的账户验证。我们将介绍您可能遇到的一些常见类型，但请务必浏览[账户类型的完整列表](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html)。

### `Account`

`Account`是对`AccountInfo`的包装，用于验证程序所有权并将底层数据反序列化为Rust类型。



```rust
// 反序列化此信息
pub struct AccountInfo<'a> {
    pub key: &'a Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
    pub lamports: Rc<RefCell<&'a mut u64>>,
    pub data: Rc<RefCell<&'a mut [u8]>>,    // <---- 反序列化帐户数据
    pub owner: &'a Pubkey,    // <---- 检查所有者程序
    pub executable: bool,
    pub rent_epoch: u64,
}
```

回想一下之前的例子，`InstructionAccounts`中有一个字段`account_name`：

```rust
pub account_name: Account<'info, AccountStruct>
```

这里的`Account`包装器执行以下操作：

- 以`AccountStruct`类型的格式反序列化帐户`data`
- 检查帐户的程序所有者是否与`AccountStruct`类型指定的程序所有者匹配。

当在相同的crate中使用`#[account]`属性宏定义`Account`包装器中指定的帐户类型时，程序拥有权检查是针对`declare_id!`宏定义中的`programId`。

进行以下检查：

```rust
// 检查
Account.info.owner == T::owner()
!(Account.info.owner == SystemProgram && Account.info.lamports() == 0)
```

### `Signer`

`Signer`类型验证给定的帐户是否对交易进行了签名。不进行其他所有权或类型检查。只有在指令中不需要帐户数据时才应使用`Signer`。

对于之前示例中的`user`帐户，`Signer`类型指定`user`帐户必须是指令的签名者。

为您执行以下检查：

```rust
// 检查
Signer.info.is_signer == true
```

### `Program`

`Program`类型验证帐户是否是特定程序。

对于之前示例中的`system_program`帐户，使用`Program`类型指定程序应为系统程序。Anchor提供一个名为`System`的类型，其中包括要检查的系统程序的`programId`。

为您执行以下检查：

```rust
// 检查
account_info.key == expected_program
account_info.executable == true
```

## 使用`#[account(..)]`添加约束

`#[account(..)]`属性宏用于对帐户应用约束。我们将在本课程和将来的课程中讨论一些约束示例，但在某个时候，确保查看[可能约束的完整列表](https://docs.rs/anchor-lang/latest/anchor_lang/derive.Accounts.html)。

再次回想一下`InstructionAccounts`示例中的`account_name`字段。

```rust
#[account(init, payer = user, space = 8 + 8)]
pub account_name: Account<'info, AccountStruct>,
#[account(mut)]
pub user: Signer<'info>,
```

请注意，`#[account(..)]`属性包含三个逗号分隔的值：

- `init` - 通过对系统程序进行CPI创建帐户并初始化它（设置其帐户辨别器）
- `payer` - 指定为在结构中定义的`user`帐户付款帐户初始化
- `space`- 指定帐户分配的空间应为`8 + 8`字节。前8个字节用于Anchor自动添加的标识符，用于标识帐户类型。接下来的8个字节为`AccountStruct`类型中定义的帐户存储的数据分配空间。

对于`user`，我们使用`#[account(..)]`属性来指定给定的帐户为可变的。`user`帐户必须标记为可变，因为将从该帐户中扣除lamports以支付`account_name`的初始化。

```rust
#[account(mut)]
pub user: Signer<'info>,
```

请注意，对`account_name`施加的`init`约束会自动包含`mut`约束，以便`account_name`和`user`都是可变帐户。

## `#[account]`

`#[account]`属性应用于表示Solana帐户数据结构的结构。它实现以下特性：

- `AccountSerialize`
- `AccountDeserialize`
- `AnchorSerialize`
- `AnchorDeserialize`
- `Clone`
- `Discriminator`
- `Owner`

您可以阅读更多关于[每个特性的细节](https://docs.rs/anchor-lang/latest/anchor_lang/attr.account.html)。但大部分您需要知道的是，`#[account]`属性启用了帐户的序列化和反序列化，并为帐户实现了辨别器和所有者特性。

辨别器是帐户类型的8字节唯一标识符，派生自帐户类型名称的SHA256哈希的前8字节。在实现帐户序列化特性时，第一个8字节保留用于帐户辨别器。因此，对`AccountDeserialize`的`try_deserialize`的任何调用都将检查此辨别器。如果不匹配，则给定了无效帐户，帐户反序列化将以错误退出。

`#[account]`属性还为使用该crate中的`declareId`声明的`programId`的结构实现了`Owner`特性。换句话说，使用`#[account]`属性定义的帐户类型初始化的所有帐户也属于该程序。

举个例子，让我们看一下`InstructionAccounts`的`account_name`所使用的`AccountStruct`：

```rust
#[derive(Accounts)]
pub struct InstructionAccounts {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    ...
}

#[account]
pub struct AccountStruct {
    data: u64
}
```

`#[account]`属性确保它可以用作`InstructionAccounts`中的帐户。

当初始化`account_name`帐户时：

- 第一个8个字节设置为`AccountStruct`的辨别器
- 帐户的数据字段将与`AccountStruct`匹配
- 帐户所有者设置为`declare_id`中的`programId`

## 将所有内容结合在一起

当您将所有这些Anchor类型结合在一起时，您将得到一个完整的程序。以下是一个具有单个指令的基本Anchor程序示例，该指令执行以下操作：

- 初始化一个新帐户
- 使用传递给指令的指令数据更新帐户上的数据字段


```rust
// Use this import to gain access to common anchor features
use anchor_lang::prelude::*;

// Program onchain address
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Instruction logic
#[program]
mod program_module_name {
    use super::*;
    pub fn instruction_one(ctx: Context<InstructionAccounts>, instruction_data: u64) -> Result<()> {
        ctx.accounts.account_name.data = instruction_data;
        Ok(())
    }
}

// Validate incoming accounts for instructions
#[derive(Accounts)]
pub struct InstructionAccounts<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub account_name: Account<'info, AccountStruct>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,

}

// Define custom program account type
#[account]
pub struct AccountStruct {
    data: u64
}
```

现在您已经准备好使用Anchor框架构建自己的Solana程序了！

# 实验

在我们开始之前，请按照Anchor文档中的步骤安装Anchor。

在本实验中，我们将创建一个简单的计数器程序，包含两个指令：
- 第一条指令将初始化一个账户来存储我们的计数器
- 第二条指令将增加计数器中存储的计数。
### 1. Setup
使用`anchor init`命令创建名为`anchor-counter`的新项目：

```console
anchor init anchor-counter
```

切换至新目录，然后运行`anchor build`：

```console
cd anchor-counter
anchor build
```

Anchor build还将为您的新程序生成密钥对-密钥保存在`target/deploy`目录中。

打开文件`lib.rs`，查看`declare_id!`：

```rust
declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");
```

运行`anchor keys sync`


```console
anchor keys sync
```
Anchor 更新包括两个部分：

- 在 `lib.rs` 中用于 `declare_id!()` 的密钥
- 在 `Anchor.toml` 中的密钥

以便与 `anchor build` 期间生成的密钥匹配：
```console
Found incorrect program id declaration in "anchor-counter/programs/anchor-counter/src/lib.rs"
Updated to BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr

Found incorrect program id declaration in Anchor.toml for the program `anchor_counter`
Updated to BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr

All program id declarations are synced.
```

最后，删除`lib.rs`中的默认代码，直到只剩下以下内容：
```rust
use anchor_lang::prelude::*;

declare_id!("your-private-key");

#[program]
pub mod anchor_counter {
    use super::*;

}
```

### 2. Add the `initialize` instruction

首先，在`#[program]`内实现`initialize`指令。该指令需要一个类型为`Initialize`的`Context`，并且不需要额外的指令数据。在指令逻辑中，我们只需要将`counter`账号的`count`字段设置为`0`。
```rust
pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    counter.count = 0;
    msg!("Counter Account Created");
    msg!("Current Count: { }", counter.count);
    Ok(())
}
```

### 3. Implement `Context` type `Initialize`

接下来，使用`#[derive(Accounts)]`宏，让我们实现`Initialize`类型，列出并验证被`initialize`指令使用的账户。它将需要以下账户：

- `counter` - 在指令中初始化的计数器账户
- `user` - 用于初始化的付款人
- `system_program` - 系统程序是初始化任何新账户所必需的。
```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. Implement `Counter`

接下来，使用`＃[账户]`属性来定义一个新的`Counter`账户类型。 `Counter`结构体定义了一个名为`count`的`u64`类型字段。这意味着我们可以期待任何以`Counter`类型初始化的新账户具有相匹配的数据结构。`＃[账户]`属性还会自动为新账户设置鉴别器，并将账户的所有者设为`declare_id!`宏中的`programId`。
```rust
#[account]
pub struct Counter {
    pub count: u64,
}
```

### 5. Add `increment` instruction

在`#[program]`中，让我们添加一个`increment`指令来在第一条指令初始化一个`counter`账户后递增`count`。这个指令需要一个`Update`类型的`Context`（在下一步中实现），并且不需要额外的指令数据。在指令逻辑中，我们只是将现有的`counter`账户的`count`字段递增`1`。

```rust
pub fn increment(ctx: Context<Update>) -> Result<()> {
    let counter = &mut ctx.accounts.counter;
    msg!("Previous counter: {}", counter.count);
    counter.count = counter.count.checked_add(1).unwrap();
    msg!("Counter incremented. Current count: {}", counter.count);
    Ok(())
}
```

### 6. 实现“Context”类型“更新”

最后，再次使用`#[derive(Accounts)]`宏，创建`Update`类型，列出`increment`指令所需的账户。它将需要以下账户：

- `counter` - 用于增加的现有计数器账户
- `user` - 交易费用的支付者

同样，我们需要使用`#[account(..)]`属性来指定任何约束条件：
```rust
#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}
```

### 7. Build

整个程序放在一起会是这样的：
```rust
use anchor_lang::prelude::*;

declare_id!("BouTUP7a3MZLtXqMAm1NrkJSKwAjmid8abqiNjUyBJSr");

#[program]
pub mod anchor_counter {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        counter.count = 0;
        msg!("Counter account created. Current count: {}", counter.count);
        Ok(())
    }

    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;
        msg!("Previous counter: {}", counter.count);
        counter.count = counter.count.checked_add(1).unwrap();
        msg!("Counter incremented. Current count: {}", counter.count);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub counter: Account<'info, Counter>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub counter: Account<'info, Counter>,
    pub user: Signer<'info>,
}

#[account]
pub struct Counter {
    pub count: u64,
}
```

运行 `anchor build` 来构建程序。

### 8. 测试

Anchor 测试通常是使用 mocha 测试框架的 TypeScript 集成测试。我们稍后会更多地了解有关测试，但现在，请转到 `anchor-counter.ts` 并用以下内容替换默认的测试代码：

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { AnchorCounter } from "../target/types/anchor_counter"

describe("anchor-counter", () => {
  // 配置客户端以使用本地集群。
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.AnchorCounter as Program<AnchorCounter>

  const counter = anchor.web3.Keypair.generate()

  it("初始化成功！", async () => {})

  it("增加计数", async () => {})
})
```

上述代码为我们将要初始化的 `counter` 账户生成了一个新的密钥对，并为每个指令的测试创建了占位符。

接下来，创建 `initialize` 指令的第一个测试：

```typescript
it("初始化成功！", async () => {
  // 在这里添加你的测试。
  const tx = await program.methods
    .initialize()
    .accounts({ counter: counter.publicKey })
    .signers([counter])
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber()).to.equal(0)
})
```

接下来，创建 `increment` 指令的第二个测试：

```typescript
it("增加计数", async () => {
  const tx = await program.methods
    .increment()
    .accounts({ counter: counter.publicKey, user: provider.wallet.publicKey })
    .rpc()

  const account = await program.account.counter.fetch(counter.publicKey)
  expect(account.count.toNumber()).to.equal(1)
})
```

最后，运行 `anchor test`，你将看到如下输出：

```console
anchor-counter
✔ 初始化成功！ (290ms)
✔ 增加计数 (403ms)


2 通过 (696ms)
```

运行 `anchor test` 会自动启动一个本地测试验证器，部署你的程序，并对其运行你的 mocha 测试。如果你现在对测试感到困惑，不用担心 - 我们稍后会更深入地研究。

恭喜，您刚刚使用 Anchor 框架构建了 Solana 程序！如果需要更多时间，可以参考[解决方案代码](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-increment)。

# 挑战

现在轮到你独立构建一些东西了。因为我们从简单的程序开始，所以你的程序几乎与我们刚刚创建的程序完全相同。尝试编写新的程序而不参考之前的代码，这是非常有用的，所以尽量不要在这里复制粘贴。

1. 编写一个新的程序，初始化一个 `counter` 账户
2. 实现 `增加` 和 `减少` 指令
3. 像我们在实验室中那样构建和部署你的程序
4. 测试你新部署的程序，并使用 Solana Explorer 检查程序日志

如往常一样，如果愿意，可以在这些挑战中发挥创造力，超出基本指令的范围，玩得开心！

如果可能的话，尽量独立完成！但是如果卡住了，可以参考[解决方案代码](https://github.com/Unboxed-Software/anchor-counter-program/tree/solution-decrement)。


## 完成了实验吗？

将你的代码推送到 GitHub，并[告诉我们你对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=334874b7-b152-4473-b5a5-5474c3f8f3f1)！

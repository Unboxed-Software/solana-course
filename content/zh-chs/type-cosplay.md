---
title: 类型伪装
objectives:
- 解释未检查账户类型带来的安全风险
- 使用长格式 Rust 实现账户类型鉴别器
- 使用 Anchor 的 `init` 约束来初始化账户
- 使用 Anchor 的 `Account` 类型进行账户验证
---
# 摘要

- 使用鉴别器来区分不同的账户类型
- 在 Rust 中实现鉴别器，需要在账户结构体中包含一个字段来代表账户类型

    ```rust
    #[derive(BorshSerialize, BorshDeserialize)]
    pub struct User {
        discriminant: AccountDiscriminant,
        user: Pubkey,
    }

    #[derive(BorshSerialize, BorshDeserialize, PartialEq)]
    pub enum AccountDiscriminant {
        User,
        Admin,
    }
    ```

- 在 Rust 中实现鉴别器检查，验证反序列化的账户数据的鉴别器是否与预期值匹配

    ```rust
    if user.discriminant != AccountDiscriminant::User {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

- 在 Anchor 中，程序账户类型自动实现了 `Discriminator` 特性，为每一种类型创建了一个 8 个字节的唯一标识符
- 使用 Anchor 的 `Account<'info, T>` 类型在反序列化账户数据时自动检查账户的鉴别器

# 课程

“类型伪装”指的是预期账户类型之外意外使用的账户类型。在底层，账户数据只是存储为一个程序可以反序列化为自定义账户类型的字节数组。如果不显式区分账户类型，来自意外账户的账户数据可能导致指令以意想不到的方式使用。

### 未检查的账户

在下面的示例中，`AdminConfig` 和 `UserConfig` 账户类型都存储一个公钥。`admin_instruction` 指令将 `admin_config` 账户反序列化为 `AdminConfig` 类型，然后执行所有者检查和数据验证检查。

然而，`AdminConfig` 和 `UserConfig` 账户类型具有相同的数据结构。这意味着可能将一个 `UserConfig` 账户类型传递给 `admin_config` 账户。只要账户数据中存储的公钥与签署交易的“admin”匹配，`admin_instruction` 指令将继续处理，即使签署者实际上并不是管理员。

请注意，账户类型中字段的名称（`admin` 和 `user`）在反序列化账户数据时并不重要。数据的序列化和反序列化是基于字段的顺序而不是名称。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_insecure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    user: Pubkey,
}
```

### 添加账户鉴别器

为了解决这个问题，可以为每种账户类型添加一个鉴别器字段，并在初始化账户时设置鉴别器。

下面的示例更新了 `AdminConfig` 和 `UserConfig` 账户类型，添加了一个 `discriminant` 字段。`admin_instruction` 指令还包含了对 `discriminant` 字段的额外数据验证检查。

```rust
if account_data.discriminant != AccountDiscriminant::Admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

如果传递给 `admin_config` 账户的账户的 `discriminant` 字段与预期的 `AccountDiscriminant` 不匹配，则交易将失败。只需确保在初始化每个账户时为 `discriminant` 设置适当的值（示例中未显示），然后可以在每个后续指令中包含这些鉴别器检查。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_secure {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        let account_data =
            AdminConfig::try_from_slice(&ctx.accounts.admin_config.data.borrow()).unwrap();
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IllegalOwner.into());
        }
        if account_data.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidAccountData.into());
        }
        if account_data.discriminant != AccountDiscriminant::Admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        msg!("Admin {}", account_data.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    admin_config: UncheckedAccount<'info>,
    admin: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    discriminant: AccountDiscriminant,
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct UserConfig {
    discriminant: AccountDiscriminant,
    user: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize, PartialEq)]
pub enum AccountDiscriminant {
    Admin,
    User,
}
```

### 使用 Anchor 的 `Account` 封装器

为每个指令的每个账户实现这些检查可能会很繁琐。幸运的是，Anchor 提供了一个 `#[account]` 属性宏，用于自动实现每种账户都应该具有的特性。

标记为 `#[account]` 的结构体可以与 `Account` 一起使用，以验证传入账户确实是您预期的类型。当初始化具有 `#[account]` 属性的结构体表示的账户时，前 8 个字节会自动保留给账户类型的唯一鉴别器。在反序列化账户数据时，Anchor 将自动检查账户的鉴别器是否与预期的账户类型匹配，如果不匹配则抛出错误。


在下面的示例中，`Account<'info, AdminConfig>`指定`admin_config`账户应该是`AdminConfig`类型。Anchor然后会自动检查账户数据的前8个字节是否与`AdminConfig`类型的辨别器匹配。

对于`admin`字段的数据验证检查也是通过`has_one`约束从指令逻辑移到账户验证结构。`#[account(has_one = admin)]`指定`admin_config`账户的`admin`字段必须与传递给指令的`admin`账户匹配。请注意，为了使`has_one`约束生效，结构中账户的命名必须与您正在验证的账户的字段的命名相匹配。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod type_cosplay_recommended {
    use super::*;

    pub fn admin_instruction(ctx: Context<AdminInstruction>) -> Result<()> {
        msg!("Admin {}", ctx.accounts.admin_config.admin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct AdminInstruction<'info> {
    #[account(has_one = admin)]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct UserConfig {
    user: Pubkey,
}
```

值得注意的是，当使用Anchor时，这是一个无需担心的漏洞 - 这实际上正是它的初衷！通过学习如何在原生rust程序中处理不当使用时导致的漏洞，希望您对Anchor账户中的账户辨别器的用途有了更好的理解。Anchor自动设置和检查此辨别器的事实意味着开发人员可以花更多时间专注于其产品的开发，但理解Anchor在幕后所做的工作仍然非常重要，以开发出健壮的Solana程序。

# 实验

在本实验中，我们将创建两个程序来演示类型伪装漏洞。

- 第一个程序将初始化没有辨别器的程序账户
- 第二个程序将使用Anchor的`init`约束初始化程序账户并自动设置账户辨别器

### 1. 起始

要开始，请从[此存储库](https://github.com/Unboxed-Software/solana-type-cosplay/tree/starter)的`starter`分支下载起始代码。起始代码包括一个具有三个指令和一些测试的程序。

三个指令是：

1. `initialize_admin` - 初始化admin账户并设置程序的admin权限
2. `initialize_user` - 初始化一个标准用户账户
3. `update_admin` - 允许现有的admin更新程序的admin权限

查看`lib.rs`文件中的这三个指令。最后一个指令只能由使用`initialize_admin`指令初始化的admin账户调用。

### 2. 测试不安全的`update_admin`指令

但是，这两个账户都具有相同的字段和字段类型：

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct AdminConfig {
    admin: Pubkey,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    user: Pubkey,
}
```

因此，有可能在`update_admin`指令中，将`User`账户替代`admin`账户，从而绕过只有admin才能调用此指令的要求。

查看`tests`目录中的`solana-type-cosplay.ts`文件。它包含一些基本设置和两个测试。一个测试初始化一个用户账户，另一个调用`update_admin`并将用户账户替代admin账户。

运行`anchor test`，查看`update_admin`的调用是否成功完成。

```bash
  type-cosplay
    ✔ Initialize User Account (233ms)
    ✔ Invoke update admin instruction with user account (487ms)
```

### 3. 创建`type-checked`程序

现在，我们将通过从现有anchor程序的根目录运行`anchor new type-checked`来创建一个名为`type-checked`的新程序。

现在，您的`programs`文件夹中将有两个程序。运行`anchor keys list`，您应该会看到新程序的程序ID。将其添加到`type-checked`程序的`lib.rs`文件以及`Anchor.toml`文件中的`type_checked`程序。

接下来，更新测试文件的设置，加入新程序以及为将要为新程序初始化的两个账户生成两个新的密钥对。

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { TypeCosplay } from "../target/types/type_cosplay"
import { TypeChecked } from "../target/types/type_checked"
import { expect } from "chai"

describe("type-cosplay", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.TypeCosplay as Program<TypeCosplay>
  const programChecked = anchor.workspace.TypeChecked as Program<TypeChecked>

  const userAccount = anchor.web3.Keypair.generate()
  const newAdmin = anchor.web3.Keypair.generate()

  const userAccountChecked = anchor.web3.Keypair.generate()
  const adminAccountChecked = anchor.web3.Keypair.generate()
})
```

### 4. 实现`type-checked`程序

在`type_checked`程序中，使用`init`约束添加两个指令来初始化`AdminConfig`账户和`User`账户。当使用`init`约束来初始化新的程序账户时，Anchor将自动为账户类型设置唯一的8字节辨别器。

我们还将添加一个`update_admin`指令，该指令使用Anchor的`Account`封装器将`admin_config`账户验证为`AdminConfig`账户类型。对于作为`admin_config`账户传入的任何账户，Anchor将自动检查账户辨别器是否匹配预期的账户类型。


```rust
use anchor_lang::prelude::*;

declare_id!("FZLRa6vX64QL6Vj2JkqY1Uzyzjgi2PYjCABcDabMo8U7");

#[program]
pub mod type_checked {
    use super::*;

    pub fn initialize_admin(ctx: Context<InitializeAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.user_account.user = ctx.accounts.user.key();
        Ok(())
    }

    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAdmin<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32
    )]
    pub user_account: Account<'info, User>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    pub new_admin: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}

#[account]
pub struct User {
    user: Pubkey,
}
```

### 5. 测试安全的 `update_admin` 指令

在测试文件中，我们将从 `type_checked` 程序初始化一个`AdminConfig`账户和一个`User`账户。然后我们将两次调用`updateAdmin`指令，传入新创建的账户。

```tsx
describe("type-cosplay", () => {
	...

  it("初始化经过类型检查的 AdminConfig 账户", async () => {
    await programChecked.methods
      .initializeAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
      })
      .signers([adminAccountType])
      .rpc()
  })

  it("初始化经过类型检查的 User 账户", async () => {
    await programChecked.methods
      .initializeUser()
      .accounts({
        userAccount: userAccountType.publicKey,
        user: provider.wallet.publicKey,
      })
      .signers([userAccountType])
      .rpc()
  })

  it("使用 User 账户调用更新指令", async () => {
    try {
      await programChecked.methods
        .updateAdmin()
        .accounts({
          adminConfig: userAccountType.publicKey,
          newAdmin: newAdmin.publicKey,
          admin: provider.wallet.publicKey,
        })
        .rpc()
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("使用 AdminConfig 账户调用更新指令", async () => {
    await programChecked.methods
      .updateAdmin()
      .accounts({
        adminConfig: adminAccountType.publicKey,
        newAdmin: newAdmin.publicKey,
        admin: provider.wallet.publicKey,
      })
      .rpc()
  })
})
```

运行 `anchor test`。对于通过`User`账户类型传递交易，我们期望该指令返回一个Anchor错误，表示该账户不属于`AdminConfig`类型。

```bash
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 invoke [1]',
'Program log: Instruction: UpdateAdmin',
'Program log: AnchorError caused by account: admin_config. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 consumed 4765 of 200000 compute units',
'Program EU66XDppFCf2Bg7QQr59nyykj9ejWaoW93TSkk1ufXh3 failed: custom program error: 0xbba'
```

按照Anchor的最佳实践和使用Anchor类型，可以确保您的程序避免此漏洞。在创建账户结构时，始终使用`#[account]`属性，在初始化账户时使用`init`约束，并在账户验证结构中使用`Account`类型。

如果您想查看最终解决方案代码，可以在[存储库](https://github.com/Unboxed-Software/solana-type-cosplay/tree/solution)的`solution`分支中找到。

# 挑战

与本单元的其他课程一样，要防范此安全漏洞的机会取决于审计自己或其他程序。

花些时间审查至少一个程序，并确保账户类型具有鉴别器，并对每个账户和指令进行检查。由于标准Anchor类型会自动处理此检查，因此更有可能在本机程序中发现漏洞。

记住，如果您发现别人的程序中有错误或漏洞，请告知他们！如果您发现自己的程序中有错误或漏洞，请立即修补。


## 完成了实验？

将您的代码推送到 GitHub，并[告诉我们您对本课程的想法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=37ebccab-b19a-43c6-a96a-29fa7e80fdec)！
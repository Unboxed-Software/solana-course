---
title: 重新初始化攻击
objectives:
- 解释重新初始化漏洞所涉及的安全风险
- 使用长形式 Rust 检查账户是否已经被初始化
- 使用 Anchor 的 `init` 约束对账户进行初始化，该约束会自动设置一个账户辨别器，用于防止对账户进行重新初始化
---
**译者**: [ben46](https://github.com/ben46)

# 概要

- 使用账户辨别器或初始化标志来检查账户是否已经被初始化，以防止账户被重新初始化并覆盖现有账户数据。
- 为了防止纯 Rust 中的账户重新初始化，在初始化账户时使用 `is_initialized` 标志，并在初始化账户时检查其是否已经设置为 true
  ```rust
  if account.is_initialized {
      return Err(ProgramError::AccountAlreadyInitialized.into());
  }
  ```
- 为了简化此过程，使用 Anchor 的 `init` 约束通过 CPI 创建账户，然后设置其辨别器

# 课程

初始化是指首次设置新账户的数据。在初始化新账户时，您应该实现一种方式来检查账户是否已经被初始化。没有适当的检查，现有的账户可能会被重新初始化，并且现有数据会被覆盖。

注意，创建账户和初始化账户是两个单独的指令。创建账户需要在系统程序上调用 `create_account` 指令，该指令指定了账户所需的空间、分配给账户的兰伯特和账户的程序所有者。初始化是一项指令，它设置了新创建账户的数据。创建和初始化账户可以合并为一个交易。

### 缺少初始化检查

在下面的示例中，`user` 账户并未进行任何检查。`initialize` 指令将 `user` 账户的数据反序列化为 `User` 账户类型，设置了 `authority` 字段，并将更新后的账户数据序列化到 `user` 账户上。

在 `user` 账户上没有检查的情况下，同一个账户可以再次被传入 `initialize` 指令，由另一个实体来覆盖存储在账户数据上的现有 `authority`。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_insecure  {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### 添加 `is_initialized` 检查

解决此问题的一种方法是向 `User` 账户类型添加额外的 `is_initialized` 字段，并将其用作标志来检查账户是否已经被初始化。

```rust
if user.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized.into());
}
```

通过在 `initialize` 指令中包含检查，只有当 `is_initialized` 字段尚未设置为 true 时，`user` 账户才会被初始化。如果 `is_initialized` 字段已经设置，则交易将失败，从而避免了攻击者替换账户授权与其自己的公钥的情况。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_secure {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        if user.is_initialized {
            return Err(ProgramError::AccountAlreadyInitialized.into());
        }

        user.authority = ctx.accounts.authority.key();
        user.is_initialized = true;

        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
		#[account(mut)]
    user: AccountInfo<'info>,
    #[account(mut)]
		authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    is_initialized: bool,
    authority: Pubkey,
}
```

### 使用 Anchor 的 `init` 约束

Anchor 提供了 `init` 约束，可与 `#[account(...)]` 属性一起使用来初始化账户。`init` 约束通过对系统程序进行 CPI 创建账户，并设置账户的辨别器。

`init` 约束必须与 `payer` 和 `space` 约束一起使用。`payer` 指定为初始化新账户付款的账户。`space` 指定了新账户所需的空间，从而确定必须为账户分配的兰伯特数量。数据的前 8 字节被设置为辨别器，Anchor 会自动添加以识别账户类型。

特别是在本课程中，`init` 约束确保此指令每个账户只能调用一次，因此您可以在指令逻辑中设置账户的初始状态，而不必担心攻击者尝试重新初始化账户的情况。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization_recommended {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("GM");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}

#[account]
pub struct User {
    authority: Pubkey,
}
```

### Anchor 的 `init_if_needed` 约束

值得注意的是 Anchor 还有一个 `init_if_needed` 约束。此约束应非常谨慎地使用。事实上，它被封锁在一个功能标志后面，以便您强制有意使用它。

`init_if_needed` 约束与 `init` 约束执行的操作相同，只是如果账户已经被初始化，该指令仍将运行。

鉴于此，当您使用该约束时，***非常***重要的是，您要包含检查，以避免将账户重置为其初始状态。

例如，如果账户存储了一个 `authority` 字段，在指令中使用 `init_if_needed` 约束设置，您需要检查以确保没有攻击者可以在已经初始化并且再次设置了 `authority` 字段的情况下调用该指令。

在大多数情况下，最安全的做法是为初始化账户数据单独创建一条指令。

# 实验室

在本实验中，我们将创建一个简单的程序，它只初始化账户。我们将包括两个指令：

- `insecure_initialization` - 初始化可以重新初始化的账户
- `recommended_initialization` - 使用 Anchor 的 `init` 约束初始化账户

### 1. 起步

要开始实验，请从 [此存储库](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/starter) 的 `starter` 分支下载起始代码。起始代码包括一个带有一条指令的程序以及测试文件的样板设置。

`insecure_initialization` 指令初始化了一个存储 `authority` 公钥的新 `user` 账户。在此指令中，账户预期在客户端分配，然后传入程序指令。一旦传入程序，就没有检查以查看 `user` 账户的初始状态是否已经设置。这意味着同一个账户可以被再次传入，以覆盖现有 `user` 账户上存储的 `authority`。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;

    pub fn insecure_initialization(ctx: Context<Unchecked>) -> Result<()> {
        let mut user = User::try_from_slice(&ctx.accounts.user.data.borrow()).unwrap();
        user.authority = ctx.accounts.authority.key();
        user.serialize(&mut *ctx.accounts.user.data.borrow_mut())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    #[account(mut)]
    /// CHECK:
    user: UncheckedAccount<'info>,
    authority: Signer<'info>,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct User {
    authority: Pubkey,
}
```

### 2. 测试 `insecure_initialization` 指令

测试文件包括设置，通过调用系统程序创建账户，然后使用相同账户两次调用 `insecure_initialization` 指令。

由于没有检查以验证账户数据是否已经初始化，`insecure_initialization` 指令将两次都成功完成，尽管第二次调用提供了*不同的*授权账户。

```tsx
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { Initialization } from "../target/types/initialization"

describe("initialization", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace.Initialization as Program<Initialization>

  const wallet = anchor.workspace.Initialization.provider.wallet
  const walletTwo = anchor.web3.Keypair.generate()

  const userInsecure = anchor.web3.Keypair.generate()
  const userRecommended = anchor.web3.Keypair.generate()

  before(async () => {
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: userInsecure.publicKey,
        space: 32,
        lamports: await provider.connection.getMinimumBalanceForRentExemption(
          32
        ),
        programId: program.programId,
      })
    )

    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      wallet.payer,
      userInsecure,
    ])

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        walletTwo.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    )
  })

  it("Insecure init", async () => {
    await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
      })
      .rpc()
  })

  it("Re-invoke insecure init with different auth", async () => {
    const tx = await program.methods
      .insecureInitialization()
      .accounts({
        user: userInsecure.publicKey,
        authority: walletTwo.publicKey,
      })
      .transaction()
    await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
      walletTwo,
    ])
  })
})
```

运行 `anchor test`，可以看到两个事务都会成功完成。

```bash
initialization
  ✔ Insecure init (478ms)
  ✔ Re-invoke insecure init with different auth (464ms)
```

### 3. 添加 `recommended_initialization` 指令

让我们创建一个名为 `recommended_initialization` 的新指令来修复这个问题。不同于先前的不安全指令，这个指令应处理用户账户的创建和初始化，使用 Anchor 的 `init` 约束。

这个约束指示程序通过 CPI 到系统程序创建账户，因此账户不再需要在客户端创建。这个约束还设置了账户的区分标志。您的指令逻辑随后可以设置账户的初始状态。

通过这样做，确保对同一个用户账户的任何后续调用将会失败，而不是重置账户的初始状态。


```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod initialization {
    use super::*;
		...
    pub fn recommended_initialization(ctx: Context<Checked>) -> Result<()> {
        ctx.accounts.user.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(init, payer = authority, space = 8+32)]
    user: Account<'info, User>,
    #[account(mut)]
    authority: Signer<'info>,
    system_program: Program<'info, System>,
}
```


### 4. 测试 `recommended_initialization` 指令

为了测试 `recommended_initialization` 指令，我们将像之前一样调用该指令两次。这次，当我们尝试第二次初始化相同的账户时，我们预期事务将失败。

```tsx
describe("initialization", () => {
  ...
  it("Recommended init", async () => {
    await program.methods
      .recommendedInitialization()
      .accounts({
        user: userRecommended.publicKey,
      })
      .signers([userRecommended])
      .rpc()
  })

  it("Re-invoke recommended init with different auth, expect error", async () => {
    try {
      // Add your test here.
      const tx = await program.methods
        .recommendedInitialization()
        .accounts({
          user: userRecommended.publicKey,
          authority: walletTwo.publicKey,
        })
        .transaction()
      await anchor.web3.sendAndConfirmTransaction(provider.connection, tx, [
        walletTwo,
        userRecommended,
      ])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

运行 `anchor test`，会发现当第二次尝试初始化相同的账户时，会返回一个错误，指出该账户地址已经在使用。

```bash
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t invoke [1]',
'Program log: Instruction: RecommendedInitialization',
'Program 11111111111111111111111111111111 invoke [2]',
'Allocate: account Address { address: EMvbwzrs4VTR7G1sNUJuQtvRX1EuvLhqs4PFqrtDcCGV, base: None } already in use',
'Program 11111111111111111111111111111111 failed: custom program error: 0x0',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t consumed 4018 of 200000 compute units',
'Program CpozUgSwe9FPLy9BLNhY2LTGqLUk1nirUkMMA5RmDw6t failed: custom program error: 0x0'
```

如果您使用 Anchor 的 `init` 约束，通常只需要这样就能防止重新初始化攻击了！记住，解决这些安全漏洞的方法虽然简单，但同样重要。每次初始化账户时，确保要么使用 `init` 约束，要么有其他检查来避免重置已存在账户的初始状态。

如果您想查看最终解决方案的代码，您可以在[此存储库](https://github.com/Unboxed-Software/solana-reinitialization-attacks/tree/solution)的 `solution` 分支找到它。

# 挑战

与本单元中的其他课程一样，你有机会练习避免这种安全漏洞攻击，方法就是审计自己或其他程序。

花一些时间审查至少一个程序，并确保指令得到了适当的保护，以防止重新初始化攻击。

记住，如果您在别人的程序中发现了漏洞或攻击，请通知他们！如果您在自己的程序中发现了漏洞或攻击，请务必立即修补。

## 完成了实验吗？

将您的代码推送到 GitHub，并[告诉我们您对本课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=652c68aa-18d9-464c-9522-e531fd8738d5)！


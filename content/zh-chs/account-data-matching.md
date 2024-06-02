---
title: 账户数据匹配
objectives:
- 解释与缺少数据验证检查相关的安全风险
- 使用长格式 Rust 实现数据验证检查
- 使用 Anchor 约束实现数据验证检查
---

# 概要

- 使用**数据验证检查**来验证账户数据是否符合预期值。如果没有适当的数据验证检查，可能会在指令中使用意外的账户。
- 要在 Rust 中实施数据验证检查，只需比较存储在账户上的数据与预期值。

    ```rust
    if ctx.accounts.user.key() != ctx.accounts.user_data.user {
        return Err(ProgramError::InvalidAccountData.into());
    }
    ```

- 在 Anchor 中，您可以使用`constraint`来检查给定的表达式是否为真。或者，您可以使用`has_one`来检查存储在账户中的目标账户字段是否与`Accounts`结构中的账户密钥匹配。

# 课程

账户数据匹配指的是用于验证账户上存储的数据是否与预期值匹配的数据验证检查。数据验证检查提供了一种包含额外约束的方法，以确保适当的账户被传递到指令中。

当指令所需的账户依赖于其他账户中存储的值，或者指令依赖于账户中存储的数据时，这将非常有用。

### 缺少数据验证检查

以下示例包括一个`update_admin`指令，该指令更新了存储在`admin_config`账户上的`admin`字段。

该指令缺少一个数据验证检查，以验证签署交易的`admin`账户是否与`admin_config`账户上存储的`admin`匹配。这意味着签署交易并作为`admin`账户传递到指令中的任何账户都可以更新`admin_config`账户。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### 添加数据验证检查

解决这个问题的基本 Rust 方法是简单比较传递的`admin`密钥和存储在`admin_config`账户中的`admin`密钥，如果它们不匹配，则引发错误。

```rust
if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
    return Err(ProgramError::InvalidAccountData.into());
}
```

通过添加数据验证检查，`update_admin`指令将仅在交易的`admin`签署者与`admin_config`账户上的`admin`匹配时才处理。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
      if ctx.accounts.admin.key() != ctx.accounts.admin_config.admin {
            return Err(ProgramError::InvalidAccountData.into());
        }
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### 使用 Anchor 约束

使用`has_one`约束，Anchor 将这一过程简化。您可以使用`has_one`约束，将数据验证检查从指令逻辑移动到`UpdateAdmin`结构中。

在下面的示例中，`has_one = admin`指定签署交易的`admin`账户必须与`admin_config`账户上存储的`admin`字段匹配。要使用`has_one`约束，账户上的数据字段的命名约定必须与账户验证结构中的命名一致。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod data_validation {
    use super::*;
    ...
    pub fn update_admin(ctx: Context<UpdateAdmin>) -> Result<()> {
        ctx.accounts.admin_config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        has_one = admin
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

或者，您可以使用`constraint`手动添加必须评估为真的表达式，以便继续执行。当命名无法保持一致或需要更复杂的表达式来充分验证传入数据时，这将非常有用。

```rust
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        constraint = admin_config.admin == admin.key()
    )]
    pub admin_config: Account<'info, AdminConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub new_admin: SystemAccount<'info>,
}
```

# 实验

在这个实验中，我们将创建一个简单的“保险柜”程序，类似于我们在签署者授权课程和所有者检查课程中使用的程序。与那些实验类似，我们将在这个实验中展示缺少数据验证检查会导致保险柜被清空的情况。

### 1. 起始

要开始，请从[此存储库](https://github.com/Unboxed-Software/solana-account-data-matching)的`starter`分支下载起始代码。起始代码包括一个具有两个指令的程序和测试文件的样板设置。

`initialize_vault`指令初始化一个新的`Vault`账户和一个新的`TokenAccount`。`Vault`账户将存储一个令牌账户的地址，保险柜的权限和提款目的地令牌账户。

新令牌账户的权限将设置为`vault`，即程序的 PDA。这允许`vault`账户对从令牌账户的转账进行签名。

`insecure_withdraw`指令会将`vault`账户中所有代币转移到一个`withdraw_destination`令牌账户中。

注意，此指令确实对`authority`进行了签名检查，对`vault`进行了所有者检查。然而，在账户验证或指令逻辑中，没有代码检查传入指令的`authority`账户是否与`vault`上的`authority`账户匹配。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        ctx.accounts.vault.withdraw_destination = ctx.accounts.withdraw_destination.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InsecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"token"],
        bump,
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
    withdraw_destination: Pubkey,
}
```


### 2. 测试`insecure_withdraw`指令

为了证明这是一个问题，让我们编写一个测试，其中除了`vault`的`authority`之外的账户尝试从`vault`中提取。

测试文件包括使用提供者钱包作为`authority`调用`initialize_vault`指令的代码，然后将100个代币铸造到`vault`代币账户中。

添加一个测试来调用`insecure_withdraw`指令。使用`withdrawDestinationFake`作为`withdrawDestination`账户，`walletFake`作为`authority`。然后使用`walletFake`发送交易。

由于没有检查验证`authority`账户传入指令是否与第一个测试中初始化的`vault`账户上存储的值匹配，指令将成功处理，并且代币将被转移到`withdrawDestinationFake`账户。

```tsx
describe("account-data-matching", () => {
  ...
  it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestinationFake,
        authority: walletFake.publicKey,
      })
      .transaction()

    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

运行`anchor test`以查看这两个交易都将成功完成。

```bash
account-data-matching
  ✔ Initialize Vault (811ms)
  ✔ Insecure withdraw (403ms)
```

### 3. 添加`secure_withdraw`指令

让我们实现一个名为`secure_withdraw`的此指令的安全版本。

此指令将与`insecure_withdraw`指令相同，只是我们将在账户验证结构体（`SecureWithdraw`）中使用`has_one`约束来检查传入指令的`authority`账户是否与`vault`账户上的`authority`账户匹配。这样只有正确的授权账户才能提取vault的代币。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod account_data_matching {
    use super::*;
    ...
    pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[b"vault".as_ref(), &[*ctx.bumps.get("vault").unwrap()]];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
```

### 4. 测试 `secure_withdraw` 操作

现在让我们使用两个测试来测试 `secure_withdraw` 操作：一个使用 `walletFake` 作为权限账户，另一个使用 `wallet` 作为权限账户。我们期望第一次调用会返回错误，而第二次会成功。

```tsx
describe("account-data-matching", () => {
  ...
  it("Secure withdraw, expect error", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenPDA,
          withdrawDestination: withdrawDestinationFake,
          authority: walletFake.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })

  it("Secure withdraw", async () => {
    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      tokenPDA,
      wallet.payer,
      100
    )

    await program.methods
      .secureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenPDA,
        withdrawDestination: withdrawDestination,
        authority: wallet.publicKey,
      })
      .rpc()

    const balance = await connection.getTokenAccountBalance(tokenPDA)
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

运行 `anchor test` 命令来查看使用不正确权限账户的交易会返回 Anchor 错误，而使用正确账户的交易将成功完成。

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: ConstraintHasOne. Error Number: 2001. Error Message: A has one constraint was violated.',
'Program log: Left:',
'Program log: DfLZV18rD7wCQwjYvhTFwuvLh49WSbXFeJFPQb5czifH',
'Program log: Right:',
'Program log: 5ovvmG5ntwUC7uhNWfirjBHbZD96fwuXDMGXiyMwPg87',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 10401 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d1'
```

请注意，Anchor 在日志中指出了导致错误的账户（`AnchorError caused by account: vault`）。

```bash
✔ Secure withdraw, expect error (77ms)
✔ Secure withdraw (10073ms)
```

就是这样，你已经解决了安全漏洞。在这些潜在的漏洞中，大多数都相当简单。但是，随着你的程序范围和复杂性的增加，可能会越来越容易忽略可能的漏洞。养成编写发送 *不应该* 成功的指令的测试的习惯是非常好的。测试越多越好。这样你就能在部署之前发现问题。

如果你想查看最终解决方案的代码，可以在 [此存储库的 `solution` 分支](https://github.com/Unboxed-Software/solana-account-data-matching/tree/solution)中找到。

# 挑战

与本单元的其他课程一样，避免安全漏洞的机会在于审计自己或其他程序。

花些时间审查至少一个程序，并确保设置了适当的数据检查以避免安全漏洞。

请记住，如果你在别人的程序中发现了漏洞或安全漏洞，请告知他们！如果你在自己的程序中发现了bug或漏洞，请立即修补。

## 完成了实验吗？

将你的代码推送到 GitHub 并[告诉我们你对本课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=a107787e-ad33-42bb-96b3-0592efc1b92f)！


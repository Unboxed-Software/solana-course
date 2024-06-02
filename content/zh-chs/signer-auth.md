---
title: 签名者授权
objectives:
- 解释未执行适当签名者检查所带来的安全风险
- 使用长格式的Rust实现签名者检查
- 使用Anchor的`Signer`类型实现签名者检查
- 使用Anchor的`#[account(signer)]`约束实现签名者检查
---

# 摘要

- 使用 **签名者检查** 来验证特定账户是否已签署交易。若未执行适当的签名者检查，账户可能能够执行不应被授权执行的指令。
- 要在Rust中实现签名者检查，只需检查账户的 `is_signer` 属性是否为 `true`
    
    ```rust
    if !ctx.accounts.authority.is_signer {
    	return Err(ProgramError::MissingRequiredSignature.into());
    }
    ```
    
- 在Anchor中，您可以在您的账户验证结构中使用 **`Signer`** 账户类型，让Anchor自动对给定账户进行签名者检查
- Anchor还有一个账户约束会自动验证给定账户是否签署了交易

# 课程

签名者检查用于验证特定账户的所有者是否已授权执行交易。若没有签名者检查，只应被特定账户执行的操作可能会被任何账户执行。在最坏的情况下，这可能导致攻击者通过传递任何他们想要的账户到指令中完全耗尽钱包。

### 缺失的签名者检查

下面的示例显示了一个过于简化的更新存储在程序账户上的 `authority` 字段的指令版本。

请注意，`UpdateAuthority`账户验证结构上的 `authority` 字段的类型为 `AccountInfo`。在Anchor中，`AccountInfo` 账户类型表示在执行指令前不对账户进行任何检查。

虽然 `has_one` 约束用于验证传入指令的 `authority` 账户是否与存储在 `vault` 账户上的 `authority` 字段匹配，但却没有验证 `authority` 账户是否已授权交易。

这意味着攻击者可以简单地传递 `authority` 账户的公钥和他们自己的公钥作为 `new_authority` 账户，以将自己重新分配为 `vault` 账户的新授权者。然后，他们可以作为新授权者与程序交互。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod insecure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
   #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 添加签名者授权检查

要验证 `authority` 账户是否已签名，您只需在指令中添加签名者检查。这意味着检查 `authority.is_signer` 是否为 `true`，如果为 `false`，则返回 `MissingRequiredSignature` 错误。

```tsx
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature.into());
}
```

通过添加签名者检查，指令只会在作为 `authority` 账户传入的账户也签署了交易时才会执行。如果交易未由传入作为 `authority` 账户的账户签名，那么交易将失败。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
            if !ctx.accounts.authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature.into());
        }

        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: AccountInfo<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 使用Anchor的`Signer`账户类型

然而，将此检查放入指令函数中混淆了账户验证和指令逻辑之间的分离。

幸运的是，Anchor通过提供 `Signer` 账户类型轻松实现签名者检查。只需将账户验证结构中的 `authority` 账户类型更改为 `Signer` 类型，Anchor会在运行时检查指定的账户是否是交易的签署者。这是我们通常建议的方法，因为它允许您将签名者检查与指令逻辑分开。

在下面的示例中，如果 `authority` 账户未签署交易，那么交易将在达到指令逻辑之前失败。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

请注意，当使用 `Signer` 类型时，不会执行其他所有权或类型检查。

### 使用Anchor的`#[account(signer)]`约束

在大多数情况下，“签名者（Signer）”账户类型通常足以确保一个账户已签署了交易，但其不执行其他所有权或类型检查的事实意味着该账户实际上无法用于指令中的其他任何用途。

这就是“签名者（signer）”*约束*发挥作用的地方。`#[account(signer)]`约束允许您验证账户是否已签署了交易，同时也获得使用`Account`类型的好处，如果您希望访问其基础数据。

举例来说，想象一下编写一个指令，您期望通过CPI调用，该指令期望传入的账户之一既是******交易的签名者******，又是***********数据源***********。在此使用`Signer`账户类型会移除使用`Account`类型时自动反序列化和类型检查的功能。这既不便利，因为您需要在指令逻辑中手动反序列化账户数据，也可能使您的程序容易受到攻击，因为没有获得`Account`类型执行的所有权和类型检查。

在下面的示例中，您可以安全地编写逻辑来与“authority”账户中存储的数据交互，并验证它签署了交易。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod secure_update{
    use super::*;
        ...
        pub fn update_authority(ctx: Context<UpdateAuthority>) -> Result<()> {
        ctx.accounts.vault.authority = ctx.accounts.new_authority.key();

        // 访问authority中存储的数据
        msg!("存款人总数：{}", ctx.accounts.authority.num_depositors);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    pub new_authority: AccountInfo<'info>,
    #[account(signer)]
    pub authority: Account<'info, AuthState>
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
#[account]
pub struct AuthState{
	amount: u64,
	num_depositors: u64,
	num_vaults: u64
}
```

# 实验

通过创建一个简单的程序来演示缺失签名者检查如何允许攻击者提取并不属于他们的代币，让我们练习一下。

这个程序初始化了一个简化的代币“仓库”账户，并展示了如何通过缺少签名者检查可以允许该仓库被清空。

### 1. 入门

首先，从[这个存储库](https://github.com/Unboxed-Software/solana-signer-auth/tree/starter)的`starter`分支下载起始代码。起始代码包括两个指令的程序和测试文件的样板设置。

`initialize_vault`指令初始化了两个新账户：`Vault`和`TokenAccount`。`Vault`帐户将使用程序派生地址（PDA）进行初始化，并存储代币账户的地址和仓库的权限。代币账户的权限将是`vault` PDA，这使得程序可以为代币转移签名。

`insecure_withdraw`指令将在`vault`账户的代币账户中转移代币到`withdraw_destination`代币账户。然而，在`InsecureWithdraw`结构中的`authority`账户的类型为`UncheckedAccount`。这是`AccountInfo`周围的一个包装器，显式指示这个账户是未经检查的。

没有签名者检查，任何人都可以简单地提供与存储在`vault`账户的`authority`匹配的`authority`账户的公钥，并且`insecure_withdraw`指令将继续进行处理。

尽管这有些牵强，因为任何具有仓库的DeFi程序都比这更复杂，但它会展示缺少签名者检查如何导致代币被错误的实体提取。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
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
        space = 8 + 32 + 32,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = vault,
    )]
    pub token_account: Account<'info, TokenAccount>,
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
        has_one = token_account,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    /// 检查：演示缺失签名者检查
    pub authority: UncheckedAccount<'info>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```


### 2. 测试 `insecure_withdraw` 指令

测试文件包括调用`initialize_vault`指令，在`vault`上以`wallet`为`authority`。然后将100个代币铸造到`vault`代币账户。理论上，`wallet`密钥应该是唯一一个可以从保险库中提取这100个代币的。

现在，我们来添加一个测试，调用程序上的`insecure_withdraw`，显示当前程序版本允许第三方实际提取这100个代币。

在测试中，我们仍然会使用`wallet`的公钥作为`authority`账户，但是我们会使用一个不同的密钥对来签署和发送交易。

```tsx
describe("signer-authorization", () => {
    ...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
      .insecureWithdraw()
      .accounts({
        vault: vaultPDA,
        tokenAccount: tokenAccount.publicKey,
        withdrawDestination: withdrawDestinationFake,
        authority: wallet.publicKey,
      })
      .transaction()

    await anchor.Web3.sendAndConfirmTransaction(connection, tx, [walletFake])

    const balance = await connection.getTokenAccountBalance(
      tokenAccount.publicKey
    )
    expect(balance.value.uiAmount).to.eq(0)
  })
})
```

运行 `anchor test` 查看两个交易是否都能成功完成。

```bash
signer-authorization
  ✔ Initialize Vault (810ms)
  ✔ Insecure withdraw  (405ms)
```

由于对`authority`账户没有进行签名检查，`insecure_withdraw`指令将代币从`vault`代币账户转移到`withdrawDestinationFake`代币账户，只要`authority`账户的公钥与`vault`账户的`authority`字段上存储的公钥匹配。显然，`insecure_withdraw`指令像其名字一样不安全。

### 3. 添加 `secure_withdraw` 指令

让我们在`SecureWithdraw`结构中添加一个新的指令，叫做`secure_withdraw`。这个指令将与`insecure_withdraw`指令相同，只是我们将在Accounts结构中使用`Signer`类型来验证`SecureWithdraw`结构中的`authority`账户。如果`authority`账户不是交易的签名者，那么我们希望交易失败并返回错误。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod signer_authorization {
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

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
        has_one = token_account,
        has_one = authority
    )]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub withdraw_destination: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub authority: Signer<'info>,
}
```

### 4. 测试 `secure_withdraw` 指令

添加了指令后，回到测试文件测试`secure_withdraw`指令。再次调用`secure_withdraw`指令，仍然使用`wallet`的公钥作为`authority`账户，以及`withdrawDestinationFake`密钥对作为签署者和提取目的地。由于使用了`Signer`类型验证`authority`账户，我们期望交易无法通过签名检查并返回错误。

```tsx
describe("signer-authorization", () => {
    ...
	it("Secure withdraw", async () => {
    try {
      const tx = await program.methods
        .secureWithdraw()
        .accounts({
          vault: vaultPDA,
          tokenAccount: tokenAccount.publicKey,
          withdrawDestination: withdrawDestinationFake,
          authority: wallet.publicKey,
        })
        .transaction()

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletFake])
    } catch (err) {
      expect(err)
      console.log(err)
    }
  })
})
```

运行 `anchor test` 查看交易现在是否会返回签名验证错误。

```bash
Error: Signature verification failed
```

以上就是全部！这是一个相当简单的问题，但非常重要。请确保始终考虑应谁授权指令，并确保每个人都是交易的签名者。

如果您想查看最终解决方案的代码，可以在[仓库的`solution`分支](https://github.com/Unboxed-Software/solana-signer-auth/tree/solution)中找到它。

# 挑战

在课程的这一部分，我们希望您已经开始在实验室和课程提供的挑战之外的项目和程序上工作了。因此，本课和随后的课程中的挑战将是对每个课程中讨论的安全漏洞进行自身代码的审计。

或者，您可以查看开源程序并对其进行审计。有很多程序可以供您查看。如果您不介意深入了解原生Rust，那么[Solana程序库](https://github.com/solana-labs/solana-program-library)是一个不错的起点。

因此，在本课程中，您可以查看一个程序（无论是您自己的还是在网上找到的），并对其进行签名者检查的审计。如果您在他人的程序中发现了错误，请通知他们！如果您在自己的程序中发现了错误，请务必立即修复它。

## 完成了实验吗？

将您的代码推送到GitHub，并[告诉我们您对本课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=26b3f41e-8241-416b-9cfa-05c5ab519d80)！

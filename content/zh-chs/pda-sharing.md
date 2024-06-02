---
title: PDA 共享
objectives:
- 解释与 PDA 共享相关的安全风险
- 推导具有离散权限域的 PDA
- 使用 Anchor 的 `seeds` 和 `bump` 约束来验证 PDA 账户
---
**译者**: [ben46](https://github.com/ben46)

# 概要

- 为多个权限域使用相同的 PDA 会使您的程序面临用户访问不属于他们的数据和资金的可能性
- 通过使用特定用户和/或域的种子，防止同一个 PDA 用于多个账户
- 使用 Anchor 的 `seeds` 和 `bump` 约束来验证 PDA 是否是使用期望的种子和 bump 导出的

# 教训

PDA 共享是指在多个用户或域之间使用相同的 PDA 作为签署者。特别是在使用 PDAs 进行签名时，使用全局 PDA 代表程序可能看起来是合适的。然而，这会导致账户验证通过，但用户能够访问不属于他们的资金、转账或数据的可能性。

## 不安全的全局 PDA

在下面的示例中，`vault` 账户的 `authority` 是使用存储在 `pool` 账户上的 `mint` 地址导出的 PDA。将此 PDA 作为 `authority` 账户传递到用于在 `vault` 和 `withdraw_destination` 之间进行代币转账的指令中。

使用 `mint` 地址作为种子派生 PDA 以签署 `vault` 的转账是不安全的，因为可能针对同一个 `vault` 代币账户创建多个 `pool` 账户，但是使用不同的 `withdraw_destination`。通过使用 `mint` 作为种子派生 PDA 以签署代币转账，任何 `pool` 账户都可以签署将代币从 `vault` 代币账户转账到任意 `withdraw_destination`。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_insecure {
    use super::*;

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
        let amount = ctx.accounts.vault.amount;
        let seeds = &[ctx.accounts.pool.mint.as_ref(), &[ctx.accounts.pool.bump]];
        token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
    }
}
...
```

## 安全的账户特定 PDA

创建账户特定的 PDA 的一种方法是使用 `withdraw_destination` 作为种子来派生用作 `vault` 代币账户 `authority` 的 PDA。这确保了用于 `withdraw_tokens` 指令中的 CPI 的签名所派生的 PDA 仅使用最初与 `pool` 账户初始化的 `withdraw_destination` 代币账户。换句话说，只有初始化时与 `pool` 账户关联的 `vault` 代币账户的代币才能转账到原始的 `withdraw_destination`。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod pda_sharing_secure {
  use super::*;
  pub fn withdraw_tokens(ctx: Context<WithdrawTokens>) -> Result<()> {
    let amount = ctx.accounts.vault.amount;
    let seeds = &[
        ctx.accounts.pool.withdraw_destination.as_ref(),
        &[ctx.accounts.pool.bump],
    ];
    token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
  }
}

#[derive(Accounts)]
pub struct WithdrawTokens<'info> {
    #[account(
				has_one = vault,
				has_one = withdraw_destination,
				seeds = [withdraw_destination.key().as_ref()],
				bump = pool.bump,
		)]
    pool: Account<'info, TokenPool>,
    vault: Account<'info, TokenAccount>,
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokens<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}

#[account]
pub struct TokenPool {
    vault: Pubkey,
    mint: Pubkey,
    withdraw_destination: Pubkey,
    bump: u8,
}
```

# 实验室

我们来试验一个简单的程序，以演示共享PDA如何允许攻击者提取不属于他们的代币。这个实验室是在上面的例子上扩展的，包括初始化所需程序账户的说明。

### 1. 起步

首先，下载存储在[此存储库](https://github.com/Unboxed-Software/solana-pda-sharing/tree/starter)的`starter`分支上的起始代码。起始代码包括一个包含两条指令和测试文件的程序，并包含了必要的设置。

`initialize_pool`指令初始化新的`TokenPool`，其中存储了`vault`、`mint`、`withdraw_destination`和`bump`。`vault`是一个代币账户，其权限被设置为使用`mint`地址派生的PDA。

`withdraw_insecure`指令将会把`vault`代币账户中的代币转移到`withdraw_destination`代币账户。

然而，目前代码中用于签名的种子并不特定于vault的提取目的地，因此这使得程序容易遭受安全漏洞。在继续之前，请花一分钟时间熟悉代码。

### 2. 测试 `withdraw_insecure` 指令

测试文件包含调用`initialize_pool`指令的代码，然后往`vault`代币账户铸造了100个代币。测试还包括了调用有意义的`withdraw_insecure`指令的测试。这表明指令可以按预期使用。

之后，有两个测试展示指令如何容易受到攻击。

第一个测试调用`initialize_pool`指令，创建了一个使用相同`vault`代币账户但不同`withdraw_destination`的“伪造”`pool`账户。

第二个测试从该pool中提取，偷窃了来自vault的资金。

运行`anchor test`，可以看到交易成功完成，`withdraw_insecure`指令允许从`vault`代币账户转移资金到存储在伪造`pool`账户上的伪造提取目的地。

### 3. 添加 `initialize_pool_secure` 指令

现在，让我们为程序添加一个新的指令，用于安全地初始化pool。

这个新的`initialize_pool_secure`指令将把`pool`账户初始化为使用`withdraw_destination`派生的PDA。它还会初始化一个`vault`代币账户，权限被设置为`pool` PDA。

```rust
pub fn initialize_pool_secure(ctx: Context<InitializePoolSecure>) -> Result<()> {
    ctx.accounts.pool.vault = ctx.accounts.vault.key();
    ctx.accounts.pool.mint = ctx.accounts.mint.key();
    ctx.accounts.pool.withdraw_destination = ctx.accounts.withdraw_destination.key();
    ctx.accounts.pool.bump = *ctx.bumps.get("pool").unwrap();
    Ok(())
}

...

#[derive(Accounts)]
pub struct InitializePoolSecure<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 32 + 1,
        seeds = [withdraw_destination.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, TokenPool>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = pool,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub withdraw_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
```

### 4. 添加 `withdraw_secure` 指令

接下来，添加一个`withdraw_secure`指令。该指令将从`vault`代币账户提取代币到`withdraw_destination`代币账户。使用`seeds`和`bump`约束验证`pool`账户，确保提供了正确的PDA账户。`has_one`约束会检查提供了正确的`vault`和`withdraw_destination`代币账户。



```rust
pub fn withdraw_secure(ctx: Context<WithdrawTokensSecure>) -> Result<()> {
    let amount = ctx.accounts.vault.amount;
    let seeds = &[
        ctx.accounts.pool.withdraw_destination.as_ref(),
        &[ctx.accounts.pool.bump],
    ];
    token::transfer(ctx.accounts.transfer_ctx().with_signer(&[seeds]), amount)
}

...

#[derive(Accounts)]
pub struct WithdrawTokensSecure<'info> {
    #[account(
        has_one = vault,
        has_one = withdraw_destination,
        seeds = [withdraw_destination.key().as_ref()],
        bump = pool.bump,
    )]
    pool: Account<'info, TokenPool>,
    #[account(mut)]
    vault: Account<'info, TokenAccount>,
    #[account(mut)]
    withdraw_destination: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
}

impl<'info> WithdrawTokensSecure<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.vault.to_account_info(),
            to: self.withdraw_destination.to_account_info(),
            authority: self.pool.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

### 5. 测试 `withdraw_secure` 指令

最后，返回测试文件，测试 `withdraw_secure` 指令，并显示通过缩小我们PDA签名授权的范围，我们已经消除了漏洞。

在展示漏洞已被修复之前，让我们编写一个简单的测试来展示初始化和取款指令的正常工作：

```typescript
it("Secure pool initialization and withdraw works", async () => {
    const withdrawDestinationAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    await program.methods
      .initializePoolSecure()
      .accounts({
        pool: authSecure,
        mint: mint,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .signers([vaultRecommended])
      .rpc()

    await new Promise((x) => setTimeout(x, 1000))

    await spl.mintTo(
      connection,
      wallet.payer,
      mint,
      vaultRecommended.publicKey,
      wallet.payer,
      100
    )

    await program.methods
      .withdrawSecure()
      .accounts({
        pool: authSecure,
        vault: vaultRecommended.publicKey,
        withdrawDestination: withdrawDestination,
      })
      .rpc()

    const afterAccount = await getAccount(
      provider.connection,
      withdrawDestination
    )

    expect(
      Number(afterAccount.amount) - Number(withdrawDestinationAccount.amount)
    ).to.equal(100)
})
```

现在，我们将测试漏洞不再存在。由于`vault`授权是使用预期的`withdraw_destination`代币账户派生的`pool` PDA，现在不再存在向除预期的`withdraw_destination`之外的账户进行取款的可能。

添加一个测试，显示您不能使用错误的取款目的地来调用 `withdraw_secure`。它可以使用前一个测试中创建的 `pool` 和 `vault`。

```typescript
it("Secure withdraw doesn't allow withdraw to wrong destination", async () => {
    try {
      await program.methods
        .withdrawSecure()
        .accounts({
          pool: authSecure,
          vault: vaultRecommended.publicKey,
          withdrawDestination: withdrawDestinationFake,
        })
        .signers([walletFake])
        .rpc()

      assert.fail("expected error")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
  })
```

最后，由于`pool`账户是使用`withdraw_destination`代币账户派生的，我们无法使用相同的PDA创建一个虚假的 `pool` 账户。添加另一个测试，展示新的 `initialize_pool_secure` 指令不会让攻击者输入错误的vault。

```typescript
it("Secure pool initialization doesn't allow wrong vault", async () => {
    try {
      await program.methods
        .initializePoolSecure()
        .accounts({
          pool: authSecure,
          mint: mint,
          vault: vaultInsecure.address,
          withdrawDestination: withdrawDestination,
        })
        .signers([vaultRecommended])
        .rpc()

      assert.fail("expected error")
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

运行 `anchor test`，看看新的指令是否允许攻击者从不属于他们的vault中提款。

```
  pda-sharing
    ✔ Initialize Pool Insecure (981ms)
    ✔ Withdraw (470ms)
    ✔ Insecure initialize allows pool to be initialized with wrong vault (10983ms)
    ✔ Insecure withdraw allows stealing from vault (492ms)
    ✔ Secure pool initialization and withdraw works (2502ms)
unknown signer: ARjxAsEPj6YsAPKaBfd1AzUHbNPtAeUsqusAmBchQTfV
    ✔ Secure withdraw doesn't allow withdraw to wrong destination
unknown signer: GJcHJLot3whbY1aC9PtCsBYk5jWoZnZRJPy5uUwzktAY
    ✔ Secure pool initialization doesn't allow wrong vault
```

就是这样了！与我们讨论过的其他一些安全漏洞不同，这个更多是概念性的，不能简单地使用特定的Anchor类型来修复。您需要仔细考虑程序的架构，确保不会在不同的领域之间共享PDAs。

如果您想查看最终解决方案代码，可以在[同一存储库的解决方案分支](https://github.com/Unboxed-Software/solana-pda-sharing/tree/solution)中找到。

# 挑战

与本单元中的其他课程一样，要避免此安全漏洞的机会在于审计自己或其他程序。

花些时间审查至少一个程序，寻找其PDA结构的潜在漏洞。用于签名的PDA应尽可能窄而专注于单个领域。

请记住，如果您发现某人程序中的错误或漏洞，请通知他们！如果您发现自己的程序中有错误或漏洞，请立即修复。

## 完成实验了吗？

将您的代码推送到GitHub，并[告诉我们您对此课程的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5744079f-9473-4485-9a14-9be4d31b40d1)！

---
title: 关闭账户和复活攻击
objectives:
- 解释与错误关闭程序账户相关的各种安全漏洞
- 使用原生 Rust 安全地关闭程序账户
- 使用 Anchor 的 `close` 约束安全地关闭程序账户
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- **不当关闭账户** 会为重新初始化/复活攻击创造机会
- 当账户不再享受租金时，Solana 运行时会 **垃圾收集账户**。关闭账户涉及将存储在账户中以获得租金豁免的 lamports 转移到您选择的另一个账户。
- 您可以使用 Anchor 的 `#[account(close = <address_to_send_lamports>)]` 约束来安全地关闭账户，并且将账户辨别器设置为 `CLOSED_ACCOUNT_DISCRIMINATOR`
    ```rust
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
    ```

# 课程

尽管听起来很简单，但正确关闭账户可能会有些棘手。如果您不遵循特定步骤，攻击者可能会绕过关闭账户的方式。

为了更好地理解这些攻击向量，让我们深入探讨每种情景。

## 不安全的账户关闭

从根本上说，关闭一个账户涉及将其 lamports 转移到一个单独的账户，从而触发 Solana 运行时垃圾收集第一个账户。这将把所有权者从所属程序更改为系统程序。

看一下下面的示例。该指令需要两个账户：

1. `account_to_close` - 要关闭的账户
2. `destination` - 应该接收关闭账户的 lamports 的账户

该程序逻辑意在通过简单地增加 `destination` 账户中存储的 `account_to_close` 金额，并将 `account_to_close` 的 lamports 置为 0 来关闭一个账户。使用该程序后，整个交易处理后，`account_to_close` 将被运行时垃圾收集。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(ctx.accounts.account_to_close.to_account_info().lamports())
            .unwrap();
        **ctx.accounts.account_to_close.to_account_info().lamports.borrow_mut() = 0;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account_to_close: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

然而，垃圾收集直到交易完成才发生。而且，一个交易中可能存在多个指令，这给攻击者提供了一个机会，即触发指令关闭账户的同时，在交易中包含用于退还账户租金豁免 lamports 的转账。结果是账户 *不会* 被垃圾收集，为攻击者开辟了一条路径，使程序发生意外行为，甚至可能耗尽协议。

## 安全的账户关闭

要消除这种安全漏洞，你可以做两件最重要的事情是将账户数据清零并添加代表账户已关闭的账户辨别器。您需要 *同时* 进行这两个操作，以避免意外的程序行为。

尽管数据被清零的账户仍然可以用于某些事情，特别是如果它是在程序中用于验证目的的地址派生的 PDA。但是如果攻击者无法访问以前存储的数据的话，损害可能会受到限制。

然而，为了进一步保护程序，关闭的账户应该被赋予表明其已“关闭”的账户辨别器，并且所有指令应该对所有传入的账户执行检查，如果账户被标记为已关闭则返回错误。

看下面的示例。该程序将在一个指令中将 lamports 转移到一个账户、清零账户数据，并设置账户辨别器，希望防止在垃圾收集之前再次使用此账户。如果任何一个操作未能执行，都将导致安全漏洞。

```rust
use anchor_lang::prelude::*;
use std::io::Write;
use std::ops::DerefMut;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod closing_accounts_insecure_still_still {
    use super::*;

    pub fn close(ctx: Context<Close>) -> ProgramResult {
        let account = ctx.accounts.account.to_account_info();

        let dest_starting_lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(account.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        let mut data = account.try_borrow_mut_data()?;
        for byte in data.deref_mut().iter_mut() {
            *byte = 0;
        }

        let dst: &mut [u8] = &mut data;
        let mut cursor = std::io::Cursor::new(dst);
        cursor
            .write_all(&anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR)
            .unwrap();

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Close<'info> {
    account: Account<'info, Data>,
    destination: AccountInfo<'info>,
}

#[account]
pub struct Data {
    data: u64,
}
```

请注意，上面的示例中使用了 Anchor 的 `CLOSED_ACCOUNT_DISCRIMINATOR`。这只是一个辨别账户的辨别器，其中每个字节都是 `255`。这个辨别器本身没有任何含义，但是如果将其与账户验证检查结合起来，如果带有此辨别器的账户被传递到一个指令中，你的程序将停止无意中处理带有已关闭账户的指令。

### 手动强制退款

仍然存在一个小问题。尽管清零账户数据和添加“已关闭”账户辨别器的做法可以防止您的程序被利用，用户仍然可以在指令结束之前退还账户的 lamports，从而使账户无法被垃圾收集。这将导致一个或者多个账户存在于一个无法使用但也无法进行垃圾回收的状态。

为了处理这种边缘情况，您可以考虑添加一个允许 *任何人* 退款带有“已关闭”账户辨别器的账户的指令。该指令仅执行一项账户验证，即确保被退款的账户被标记为已关闭。其可能类似于下面这样：



```rust
使用anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
使用anchor_lang::prelude::*;
使用std::io::{Cursor, Write};
使用std::ops::DerefMut;

...

    pub fn force_defund(ctx: Context<ForceDefund>) -> ProgramResult {
        让帐户 = &ctx.accounts.account;

        让数据 = account.try_borrow_data()?;
        断言!(data.len() > 8);

        让mut鉴别器 = [0u8; 8];
        鉴别器.copy_from_slice(&data[0..8]);
        如果鉴别器 != CLOSED_ACCOUNT_DISCRIMINATOR {
            返回错误(ProgramError::InvalidAccount数据);
        }

        让目标起始的lamports = ctx.accounts.destination.lamports();

        **ctx.accounts.destination.lamports.borrow_mut() = 目标起始的lamports
            .checked_add(帐户.lamports())
            .unwrap();
        **account.lamports.borrow_mut() = 0;

        好的(())
    }

...

#[derive(Accounts)]
pub struct ForceDefund<'info> {
    帐户: AccountInfo<'info>,
    目的地: AccountInfo<'info>,
}
```

由于任何人都可以调用这个指令，这可以作为一种对试图复活攻击的威慑，因为攻击者为帐户租金豁免付款，但任何其他人都可以为自己申请一笔退还帐户的lamports。

虽然不是必需的，但这可以帮助消除与这些“地狱”帐户相关的空间和lamports的浪费.

## 使用Anchor `close` 约束

幸运的是，Anchor通过`#[account(close = <target_account>)]`约束使所有这些变得简单得多。这个约束处理了安全关闭帐户所需的一切：

1. 将帐户的lamports转移到给定的`<target_account>`
2. 将帐户数据归零
3. 将帐户鉴别器设置为`CLOSED_ACCOUNT_DISCRIMINATOR`变体

你只需要将它添加到你想关闭的帐户的帐户验证结构中：

```rust
#[derive(Accounts)]
pub struct CloseAccount {
    #[account(
        mut, 
        close = 接收者
    )]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>
}
```

`force_defund` 指令是一个可选的附加项，如果你想使用它，你将不得不自己实现。

# 实验

为了澄清攻击者如何利用复活攻击，让我们使用一个简单的抽奖程序来管理用户参与抽奖的程序帐户状态。

## 1. 设置

首先从[这个仓库](https://github.com/Unboxed-Software/solana-closing-accounts/tree/starter)获取`starter`分支上的代码。

代码包含程序的两个指令和`tests`目录中的两个测试。

程序指令是：

1. `enter_lottery`
2. `redeem_rewards_insecure`

当用户调用`enter_lottery`时，程序将初始化一个帐户来存储有关用户抽奖参与情况的状态。

由于这只是一个简化的示例而不是一个完整的抽奖程序，一旦用户参加了抽奖，他们随时可以调用`redeem_rewards_insecure`指令。该指令将根据用户参与抽奖的次数，向用户产生一定数量的奖励代币。生成奖励后，程序关闭用户的抽奖参与帐户。

请花一点时间熟悉程序代码。`enter_lottery`指令只是在PDA上映射到用户并初始化一些状态。

`redeem_rewards_insecure`指令执行一些帐户和数据验证，向给定的代币账户铸造代币，然后通过移除其lamports关闭用户的抽奖参与帐户。

然而，请注意`redeem_rewards_insecure`指令*只*转移了帐户的lamports，留下该帐户容易受到复活攻击。

## 2. 测试不安全程序

成功使他们的帐户关闭后，攻击者可以多次调用`redeem_rewards_insecure`，索取比他们所欠的奖励更多的奖励。

一些起始测试已经展示了这种漏洞。查看`tests`目录中的`closing-accounts.ts`文件。`before`函数中进行了一些设置，然后有一个测试为`attacker`创建了一个新的抽奖参与。

最后，有一个测试展示了攻击者如何在索取奖励后保持帐户存活，并再次索取奖励。该测试如下所示：

```typescript
it("attacker  can close + refund lottery acct + claim multiple rewards", async () => {
    // claim multiple times
    for (let i = 0; i < 2; i++) {
      const tx = new Transaction()
      // instruction claims rewards, program will try to close account
      tx.add(
        await program.methods
          .redeemWinningsInsecure()
          .accounts({
            lotteryEntry: attackerLotteryEntry,
            user: attacker.publicKey,
            userAta: attackerAta,
            rewardMint: rewardMint,
            mintAuth: mintAuth,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()
      )

      // user adds instruction to refund dataAccount lamports
      const rentExemptLamports =
        await provider.connection.getMinimumBalanceForRentExemption(
          82,
          "confirmed"
        )
      tx.add(
        SystemProgram.transfer({
          fromPubkey: attacker.publicKey,
          toPubkey: attackerLotteryEntry,
          lamports: rentExemptLamports,
        })
      )
      // send tx
      await sendAndConfirmTransaction(provider.connection, tx, [attacker])
      await new Promise((x) => setTimeout(x, 5000))
    }

    const ata = await getAccount(provider.connection, attackerAta)
    const lotteryEntry = await program.account.lotteryAccount.fetch(
      attackerLotteryEntry
    )

    expect(Number(ata.amount)).to.equal(
      lotteryEntry.timestamp.toNumber() * 10 * 2
    )
})
```

该测试执行以下操作：
1. 调用 `redeem_rewards_insecure` 来赎回用户的奖励
2. 在同一个事务中，添加了一个指令，以便在帐户实际关闭之前，给用户的 `lottery_entry` 进行退款
3. 成功重复步骤 1 和 2，第二次赎回奖励。

在理论上，你可以重复步骤 1-2 无限次，直到要么a) 程序没有更多奖励可提供，要么b) 有人注意到并修复了漏洞。这显然是在任何真实程序中都是一个严重的问题，因为它允许一个恶意攻击者耗尽整个奖励池。

## 3. 创建一个 `redeem_rewards_secure` 指令

为防止这种情况发生，我们将创建一个新的指令，使用Anchor的 `close` 约束来安全关闭抽奖帐户。如果愿意，欢迎自行尝试此操作。

名为 `RedeemWinningsSecure` 的新帐户验证结构应如下：


```rust
#[derive(Accounts)]
pub struct RedeemWinningsSecure<'info> {
    // program expects this account to be initialized
    #[account(
        mut,
        seeds = [user.key().as_ref()],
        bump = lottery_entry.bump,
        has_one = user,
        close = user
    )]
    pub lottery_entry: Account<'info, LotteryAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_ata.key() == lottery_entry.user_ata
    )]
    pub user_ata: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reward_mint.key() == user_ata.mint
    )]
    pub reward_mint: Account<'info, Mint>,
    ///CHECK: mint authority
    #[account(
        seeds = [MINT_SEED.as_bytes()],
        bump
    )]
    pub mint_auth: AccountInfo<'info>,
    pub token_program: Program<'info, Token>
}
```

应该与原`RedeemWinnings`账户验证结构完全相同，只是在`lottery_entry`账户上有一个额外的`close = user`约束。这将告诉Anchor关闭该账户，将其预留的lamports转移给`user`账户，并将账户辨别器设置为`CLOSED_ACCOUNT_DISCRIMINATOR`。这最后一步是防止账户在程序试图关闭它时被再次使用。

然后，我们可以在新的`RedeemWinningsSecure`结构上创建一个`mint_ctx`方法，以帮助进行对 Token 程序的铸造 CPI 。

```Rust
impl<'info> RedeemWinningsSecure<'info> {
    pub fn mint_ctx(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_program = self.token_program.to_account_info();
        let cpi_accounts = MintTo {
            mint: self.reward_mint.to_account_info(),
            to: self.user_ata.to_account_info(),
            authority: self.mint_auth.to_account_info()
        };

        CpiContext::new(cpi_program, cpi_accounts)
    }
}
```

最后，新的安全指令的逻辑应该如下：

```rust
pub fn redeem_winnings_secure(ctx: Context<RedeemWinningsSecure>) -> Result<()> {

    msg!("计算奖金");
    let amount = ctx.accounts.lottery_entry.timestamp as u64 * 10;

    msg!("铸造{}个令牌作为奖励", amount);
    // 程序签名种子
    let auth_bump = *ctx.bumps.get("mint_auth").unwrap();
    let auth_seeds = &[MINT_SEED.as_bytes(), &[auth_bump]];
    let signer = &[&auth_seeds[..]];

    // 通过进行铸造来领取奖励
    mint_to(ctx.accounts.mint_ctx().with_signer(signer), amount)?;

    Ok(())
}
```

此逻辑简单地计算了领取用户的奖励并转移了奖励。然而，由于账户验证结构中存在`close`约束，攻击者不应能够多次调用此指令。

## 4. 测试程序

为了测试我们的新安全指令，让我们创建一个新的测试，尝试两次调用`redeemingWinningsSecure`。我们期望第二次调用会抛出一个错误。

```typescript
it("攻击者不能使用安全认领多个奖励", async () => {
    const tx = new Transaction()
    // 指令认领奖励，程序将尝试关闭账户
    tx.add(
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()
    )

    // 用户添加指令以退还 dataAccount 的lamports
    const rentExemptLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        82,
        "confirmed"
      )
    tx.add(
      SystemProgram.transfer({
        fromPubkey: attacker.publicKey,
        toPubkey: attackerLotteryEntry,
        lamports: rentExemptLamports,
      })
    )
    // 发送交易
    await sendAndConfirmTransaction(provider.connection, tx, [attacker])

    try {
      await program.methods
        .redeemWinningsSecure()
        .accounts({
          lotteryEntry: attackerLotteryEntry,
          user: attacker.publicKey,
          userAta: attackerAta,
          rewardMint: rewardMint,
          mintAuth: mintAuth,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      console.log(error.message)
      expect(error)
    }
})
```

运行`anchor test`以查看测试是否通过。输出将类似于：

```bash
  closing-accounts
    ✔ Enter lottery (451ms)
    ✔ attacker can close + refund lottery acct + claim multiple rewards (18760ms)
AnchorError caused by account: lottery_entry. Error Code: AccountDiscriminatorMismatch. Error Number: 3002. Error Message: 8 byte discriminator did not match what was expected.
    ✔ attacker cannot claim multiple rewards with secure claim (414ms)
```

请注意，这并不会阻止恶意用户完全退还他们的账户，它只是保护了我们的程序不会在应该关闭账户时错误地再次使用它。到目前为止，我们还没有实现`force_defund`指令，但我们可以实现。如果你感觉做好了，可以试一试！

最简单和最安全关闭账户的方法是使用Anchor的`close`约束。如果你需要更多定制的行为并且无法使用该约束，务必复制其功能以确保你的程序是安全的。

如果您想查看最终解决方案代码，可以在[同一存储库](https://github.com/Unboxed-Software/solana-closing-accounts/tree/solution)的`solution`分支上找到。

# 挑战

与本单元的其他课程一样，避免此安全漏洞的机会在于审查自己或其他程序。

花些时间审查至少一个程序，并确保关闭帐户时不容易受到复活攻击。

请记住，如果你发现其他人的程序有漏洞或攻击，务必告诉他们！如果你发现自己的程序有漏洞，一定要立即修复它。

## 完成了实验吗？

将你的代码推送到 GitHub，并[告诉我们你对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e6b99d4b-35ed-4fb2-b9cd-73eefc875a0f)！

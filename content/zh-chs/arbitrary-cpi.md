---
title: 任意CPI
objectives:
- 解释调用CPI到未知程序所带来的安全风险
- 展示Anchor的CPI模块如何在从一个Anchor程序到另一个程序进行CPI时防止这种情况发生
- 安全地从一个Anchor程序向任意非-anchor程序进行CPI
---
**译者**: [ben46](https://github.com/ben46)

# 总结 

- 要生成一个CPI，目标程序必须作为账户传递给调用指令。这意味着任何目标程序都可以传递给指令。您的程序应检查不正确或意外的程序。
- 通过简单比较传入程序的公钥和您期望的程序来执行本地程序的程序检查。
- 如果程序是用Anchor编写的，那么它可能有一个公开可用的CPI模块。这使得从另一个Anchor程序调用程序变得简单和安全。 Anchor CPI模块会自动检查传入程序的地址是否与模块中存储的程序地址匹配。

# 课程

跨程序调用（CPI）是一个程序调用另一个程序的指令。 "任意CPI" 是一个程序被构造为向传入指令的任何指定程序发出CPI，而不是期望对一个特定程序执行CPI。鉴于您的程序指令的调用方可以将任何程序传递给指令的账户列表中，未能验证传入程序的地址会导致您的程序执行对任意程序的CPI。

这种缺乏程序检查为恶意用户提供了机会，可以传入一个与预期不同的程序，导致原始程序在这个神秘程序上调用指令。这种CPI可能会带来怎样的后果是无法预知的。这取决于程序逻辑（原始程序和意外程序的逻辑），以及传入原始指令的其他账户。

## 缺少程序检查

以以下程序为例。 `cpi` 指令在`token_program`上调用`transfer`指令，但没有检查传入指令的`token_program`账户是否确实是SPL Token Program。

```rust
use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_insecure {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        solana_program::program::invoke(
            &spl_token::instruction::transfer(
                ctx.accounts.token_program.key,
                ctx.accounts.source.key,
                ctx.accounts.destination.key,
                ctx.accounts.authority.key,
                &[],
                amount,
            )?,
            &[
                ctx.accounts.source.clone(),
                ctx.accounts.destination.clone(),
                ctx.accounts.authority.clone(),
            ],
        )
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: UncheckedAccount<'info>,
    destination: UncheckedAccount<'info>,
    authority: UncheckedAccount<'info>,
    token_program: UncheckedAccount<'info>,
}
```

攻击者可以轻易调用这个指令并传入一个自己创建并控制的重复token程序。

## 增加程序检查

可以通过简单地向`cpi`指令添加几行代码来修复这个漏洞，检查`token_program`的公共键是否属于SPL Token Program。

```rust
pub fn cpi_secure(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
    if &spl_token::ID != ctx.accounts.token_program.key {
        return Err(ProgramError::IncorrectProgramId);
    }
    solana_program::program::invoke(
        &spl_token::instruction::transfer(
            ctx.accounts.token_program.key,
            ctx.accounts.source.key,
            ctx.accounts.destination.key,
            ctx.accounts.authority.key,
            &[],
            amount,
        )?,
        &[
            ctx.accounts.source.clone(),
            ctx.accounts.destination.clone(),
            ctx.accounts.authority.clone(),
        ],
    )
}
```

现在，如果攻击者传入不同的token程序，该指令将返回 `ProgramError::IncorrectProgramId` 错误。

根据您使用CPI调用的程序，您可以对预期程序ID的地址进行硬编码，或者如果可用，使用程序的Rust创建获取程序的地址。在上述示例中，`spl_token` 创建提供了SPL Token Program的地址。

## 使用Anchor CPI模块

处理程序检查的一个更简单的方法是使用Anchor CPI模块。我们在[先前的课程](https://github.com/Unboxed-Software/solana-course/blob/main/content/anchor-cpi)中了解到，Anchor可以自动生成CPI模块，从而使对程序的CPI变得更简单。这些模块还通过验证传入其公共指令的程序的公钥来增强安全性。

每个Anchor程序都使用`declare_id()` 宏来定义程序的地址。当为特定程序生成CPI模块时，它使用该宏传入的地址作为“真相来源”，并将自动验证使用其CPI模块进行的所有CPI是否目标为此程序ID。

虽然在本质上与手动程序检查没有差异，但使用CPI模块避免了执行程序检查的可能性遗漏或在硬编码程序ID时意外输入错误。

下面的程序示例展示了使用SPL Token程序的CPI模块执行之前示例中的转账。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod arbitrary_cpi_recommended {
    use super::*;

    pub fn cpi(ctx: Context<Cpi>, amount: u64) -> ProgramResult {
        token::transfer(ctx.accounts.transfer_ctx(), amount)
    }
}

#[derive(Accounts)]
pub struct Cpi<'info> {
    source: Account<'info, TokenAccount>,
    destination: Account<'info, TokenAccount>,
    authority: Signer<'info>,
    token_program: Program<'info, Token>,
}

impl<'info> Cpi<'info> {
    pub fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, token::Transfer<'info>> {
        let program = self.token_program.to_account_info();
        let accounts = token::Transfer {
            from: self.source.to_account_info(),
            to: self.destination.to_account_info(),
            authority: self.authority.to_account_info(),
        };
        CpiContext::new(program, accounts)
    }
}
```

请注意，与上面的例子类似，Anchor创建了一些[流行本地程序的包装器](https://github.com/coral-xyz/anchor/tree/master/spl/src)，允许您对其进行CPI，就像对Anchor程序一样。


此外，根据你正在制作的CPI，你可能可以使用 Anchor 的 [`Program` 账户类型](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/program/struct.Program.html) 来验证在你的账户验证结构中传入的程序。在 [`anchor_lang`](https://docs.rs/anchor-lang/latest/anchor_lang) 和 [`anchor_spl`](https://docs.rs/anchor-spl/latest/) crate 中，以下 `Program` 类型已经被提供：

- [`System`](https://docs.rs/anchor-lang/latest/anchor_lang/system_program/struct.System.html)
- [`AssociatedToken`](https://docs.rs/anchor-spl/latest/anchor_spl/associated_token/struct.AssociatedToken.html)
- [`Token`](https://docs.rs/anchor-spl/latest/anchor_spl/token/struct.Token.html)

如果你可以访问 Anchor 程序的 CPI 模块，通常可以用以下方式导入它的程序类型，将程序名称替换为实际程序的名称：

```rust
use other_program::program::OtherProgram;
```
# 实验

为了演示检查你用来进行CPI的程序的重要性，我们将使用一个简化的、有些刻意的游戏。这个游戏使用PDA账户来表示角色，并使用一个单独的“元数据”程序来管理角色的元数据和属性，如健康和力量。

虽然这个例子有些刻意，但实际上它和索拉纳上的NFT的架构几乎完全相同：SPL Token 程序管理代币铸造、分配和转移，而一个单独的元数据程序用于给代币分配元数据。因此，我们在这里经历的漏洞也可以应用到真实的代币上。

### 1. 设置

我们将从 [这个存储库](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/starter) 的 `starter` 分支开始。克隆该存储库，然后在 `starter` 分支上打开它。

请注意，这里有三个程序：

1. `gameplay`
2. `character-metadata`
3. `fake-metadata`

此外，在 `tests` 目录中已经有一个测试。

第一个程序 `gameplay` 是我们的测试直接使用的。看一下这个程序。它有两个指令：

1. `create_character_insecure` - 创建一个新角色，并调用元数据程序来设置角色的初始属性。
2. `battle_insecure` - 把两个角色对抗在一起，将“胜利”授予拥有最高属性的角色。

第二个程序 `character-metadata` 的目的是成为处理角色元数据的“核准”程序。看一下这个程序。它有一个用于 `create_metadata` 的单一指令，创建一个新的PDA，并为角色的健康和力量赋予一个介于0和20之间的伪随机数值。

最后一个程序 `fake-metadata` 是一个“伪”元数据程序，旨在说明攻击者可能用来利用我们的 `gameplay` 程序的程序。这个程序几乎和 `character-metadata` 程序完全相同，只是它将角色的初始健康和力量分配为最大允许的值：255。

### 2. 测试 `create_character_insecure` 指令

`tests` 目录中已经有了一个测试。它很长，但在我们一起讨论前花一分钟看一下：

```typescript
it("不安全指令允许攻击者每次获胜", async () => {
    // 使用真的元数据程序初始化玩家一
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: metadataProgram.programId,
        authority: playerOne.publicKey,
      })
      .signers([playerOne])
      .rpc()

    // 使用伪元数据程序初始化攻击者
    await gameplayProgram.methods
      .createCharacterInsecure()
      .accounts({
        metadataProgram: fakeMetadataProgram.programId,
        authority: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    // 获取玩家和攻击者的元数据账户
    const [playerOneMetadataKey] = getMetadataKey(
      playerOne.publicKey,
      gameplayProgram.programId,
      metadataProgram.programId
    )

    const [attackerMetadataKey] = getMetadataKey(
      attacker.publicKey,
      gameplayProgram.programId,
      fakeMetadataProgram.programId
    )

    const playerOneMetadata = await metadataProgram.account.metadata.fetch(
      playerOneMetadataKey
    )

    const attackerMetadata = await fakeMetadataProgram.account.metadata.fetch(
      attackerMetadataKey
    )

    // 正常玩家应该在0到20之间有健康和力量
    expect(playerOneMetadata.health).to.be.lessThan(20)
    expect(playerOneMetadata.power).to.be.lessThan(20)

    // 攻击者的健康和力量将为255
    expect(attackerMetadata.health).to.equal(255)
    expect(attackerMetadata.power).to.equal(255)
})
```

这个测试描述了一种情况，即一个普通玩家和一个攻击者同时创建他们的角色。只有攻击者传递了假元数据程序的程序ID，而不是实际的元数据程序。由于 `create_character_insecure` 指令没有程序检查，它仍然会被执行。

结果是，正常角色有适当数量的健康和力量：分别是0到20之间的值。但攻击者的健康和力量均为255，使得攻击者无敌。

如果还没有这样做，请运行 `anchor test` 来验证这个测试是否像描述的那样运行。

### 3. 创建一个 `create_character_secure` 指令

让我们通过创建一个安全指令来修复这个问题。这个指令应该实现适当的程序检查，并使用 `character-metadata` 程序的 `cpi` crate 来执行CPI，而不仅仅使用 `invoke`。

如果你想测试你的技能，可以在继续之前尝试一下。

我们将从更新 `gameplay` 程序的 `lib.rs` 文件顶部的 `use` 语句开始。我们要给自己在账户验证方面访问程序类型，并在发出 `create_metadata` CPI 的帮助函数中使用：

```rust
use character_metadata::{
    cpi::accounts::CreateMetadata,
    cpi::create_metadata,
    program::CharacterMetadata,
};
```

接下来，让我们创建一个新的账户验证结构，叫做 `CreateCharacterSecure`。这次，我们将把 `metadata_program` 定义为 `Program` 类型：


```rust
#[derive(Accounts)]
pub struct CreateCharacterSecure<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 64,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub character: Account<'info, Character>,
    #[account(
        mut,
        seeds = [character.key().as_ref()],
        seeds::program = metadata_program.key(),
        bump,
    )]
    /// CHECK: manual checks
    pub metadata_account: AccountInfo<'info>,
    pub metadata_program: Program<'info, CharacterMetadata>,
    pub system_program: Program<'info, System>,
}
```

最后，我们添加 `create_character_secure` 指令。这与以前相同，但将使用 Anchor CPI 的全部功能，而不是直接使用 `invoke`：

```rust
pub fn create_character_secure(ctx: Context<CreateCharacterSecure>) -> Result<()> {
    let character = &mut ctx.accounts.character;
    character.metadata = ctx.accounts.metadata_account.key();
    character.auth = ctx.accounts.authority.key();
    character.wins = 0;

    let context = CpiContext::new(
        ctx.accounts.metadata_program.to_account_info(),
        CreateMetadata {
            character: ctx.accounts.character.to_account_info(),
            metadata: ctx.accounts.metadata_account.to_owned(),
            authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
    );

    create_metadata(context)?;

    Ok(())
}
```

### 4. 测试 `create_character_secure`

现在我们有了一种安全的初始化新角色的方法，让我们创建一个新的测试。此测试只需要尝试初始化攻击者的角色，并期望抛出错误。

```typescript
it("安全的角色创建不允许虚假程序", async () => {
    try {
      await gameplayProgram.methods
        .createCharacterSecure()
        .accounts({
          metadataProgram: fakeMetadataProgram.programId,
          authority: attacker.publicKey,
        })
        .signers([attacker])
        .rpc()
    } catch (error) {
      expect(error)
      console.log(error)
    }
})
```

如果您尚未运行 `anchor test`，请运行。请注意，如预期地抛出了错误，详细说明了传入指令的程序ID不是预期的程序ID：

```bash
'程序日志: 由账户引发的 AnchorError: metadata_program。错误代码: InvalidProgramId。错误编号: 3008。错误消息: 程序ID与预期不符。',
'程序日志: 左:',
'程序日志: FKBWhshzcQa29cCyaXc1vfkZ5U985gD5YsqfCzJYUBr',
'程序日志: 右:',
'程序日志: D4hPnYEsAx4u3EQMrKEXsY3MkfLndXbBKTEYTwwm25TE'
```

这就是您需要做的，以防止任意的CPI！

有时您可能希望程序的CPI具有更多的灵活性。我们当然不会阻止您设计自己需要的程序，但请尽可能采取预防措施，确保程序中没有漏洞。

如果您想查看最终解决方案代码，可以在[相同存储库](https://github.com/Unboxed-Software/solana-arbitrary-cpi/tree/solution)的 `solution` 分支中找到。

# 挑战

与本单元的其他课程一样，您避免此安全漏洞的机会在于审计您自己或其他程序。

花些时间审查至少一个程序，并确保为传入指令的每个程序都进行了程序检查，特别是那些通过CPI调用的程序。

请记住，如果您在别人的程序中发现了错误或漏洞，请通知他们！如果您发现自己的程序中有问题，请务必立即修复。

## 完成了实验？

将您的代码推送到 GitHub，并告诉我们您对这节课的看法！ [告诉我们您的想法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5bcaf062-c356-4b58-80a0-12cca99c29b0)！


---
title: 复制可变账户
objectives:
- 解释与需要两个相同类型的可变账户的指令相关的安全风险以及如何避免
- 使用长格式 Rust 实现检查重复可变账户
- 使用 Anchor 约束实现检查重复可变账户
---
**译者**: [ben46](https://github.com/ben46)

# 简介

- 当一个指令需要两个相同类型的可变账户时，攻击者可以两次传递相同的账户，导致账户以意外方式被改变。
- 在 Rust 中，要检查重复可变账户，只需比较这两个账户的公钥，并在它们相同时抛出错误。

  ```rust
  if ctx.accounts.account_one.key() == ctx.accounts.account_two.key() {
      return Err(ProgramError::InvalidArgument)
  }
  ```

- 在 Anchor 中，您可以使用 `constraint` 为账户添加显式约束，以检查它与另一个账户是否相同。

# 课程

复制可变账户指的是一个指令需要两个相同类型的可变账户。在这种情况下，您应该验证两个账户是不同的，以防止相同的账户两次被传递给指令。

由于程序将每个账户视为独立的，两次传递相同的账户可能导致第二个账户意外被改变。可能会导致非常微小的问题，甚至灾难性的问题 - 这取决于代码更改的数据以及这些账户的使用方式。无论如何，这是所有开发人员都应该意识到的一个漏洞。

### 无检查

例如，想象一个程序，它在单个指令中更新 `user_a` 和 `user_b` 的 `data` 字段。指令为 `user_a` 设置的值与 `user_b` 的不同。没有验证 `user_a` 和 `user_b` 不同的程序将更新 `user_a` 账户的 `data` 字段，然后再次更新 `data` 字段，假设 `user_b` 是一个独立的账户。

您可以从下面的代码示例中看到这种情况。没有检查以验证 `user_a` 和 `user_b` 不是同一账户。对 `user_a` 和 `user_b` 传递相同的账户将导致账户的 `data` 字段设置为 `b`，即使意图是在不同的账户上设置值 `a` 和 `b`。根据 `data` 代表什么，这可能是一个微小的意外副作用，或者可能会带来严重的安全风险。允许 `user_a` 和 `user_b` 是同一个账户会导致

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_insecure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### 在指令中添加检查

要纠正使用规划 Rust 的此问题，只需在指令逻辑中添加检查，验证 `user_a` 的公钥是否与 `user_b` 的公钥相同，如果相同则返回错误。

```rust
if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
    return Err(ProgramError::InvalidArgument)
}
```

此检查确保 `user_a` 和 `user_b` 不是同一个账户。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_secure {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        if ctx.accounts.user_a.key() == ctx.accounts.user_b.key() {
            return Err(ProgramError::InvalidArgument.into())
        }
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

### 使用 Anchor `constraint`

如果您正在使用 Anchor，则更好的解决方案是将检查添加到账户验证结构中，而不是指令逻辑中。

您可以使用 `#[account(..)]` 属性宏和 `constraint` 关键字向账户添加手动约束。`constraint` 关键字将检查后面的表达式是否计算为真或假，并在表达式计算为假时返回错误。

下面的示例通过在 `#[account(..)]` 属性中添加 `constraint` 将检查从指令逻辑移至账户验证结构。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts_recommended {
    use super::*;

    pub fn update(ctx: Context<Update>, a: u64, b: u64) -> Result<()> {
        let user_a = &mut ctx.accounts.user_a;
        let user_b = &mut ctx.accounts.user_b;

        user_a.data = a;
        user_b.data = b;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(constraint = user_a.key() != user_b.key())]
    user_a: Account<'info, User>,
    user_b: Account<'info, User>,
}

#[account]
pub struct User {
    data: u64,
}
```

# 实验

我们通过创建一个简单的石头剪刀布程序来练习，以演示不检查重复可变账户可能会导致程序中的未定义行为。

此程序将初始化“player”账户，并有一个单独的指令，需要两个“player”账户来表示开始玩石头剪刀布游戏。


- 一个`initialize`指令来初始化`PlayerState`账户
- 一个`rock_paper_scissors_shoot_insecure`指令需要两个`PlayerState`账户，但不检查传入指令的账户是否不同
- 一个`rock_paper_scissors_shoot_secure`指令与`rock_paper_scissors_shoot_insecure`指令相同，但添加了约束条件以确保两个玩家账户不同

### 1. 起步

要开始，请下载[此仓库](https://github.com/unboxed-software/solana-duplicate-mutable-accounts/tree/starter)的`starter`分支上的起始代码。起始代码包括一个程序以及两条指令和测试文件的模板设置。

`initialize`指令初始化一个新的`PlayerState`账户，其中存储着一个玩家的公钥和一个设置为`None`的`choice`字段。

`rock_paper_scissors_shoot_insecure`指令需要两个`PlayerState`账户，并要求每个玩家做出`RockPaperScissors`枚举中的选择，但不检查传入指令的账户是否不同。这意味着在指令中可以使用单个账户作为两个`PlayerState`账户。

```rust
use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod duplicate_mutable_accounts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ctx.accounts.new_player.player = ctx.accounts.payer.key();
        ctx.accounts.new_player.choice = None;
        Ok(())
    }

    pub fn rock_paper_scissors_shoot_insecure(
        ctx: Context<RockPaperScissorsInsecure>,
        player_one_choice: RockPaperScissors,
        player_two_choice: RockPaperScissors,
    ) -> Result<()> {
        ctx.accounts.player_one.choice = Some(player_one_choice);

        ctx.accounts.player_two.choice = Some(player_two_choice);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8
    )]
    pub new_player: Account<'info, PlayerState>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RockPaperScissorsInsecure<'info> {
    #[account(mut)]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}

#[account]
pub struct PlayerState {
    player: Pubkey,
    choice: Option<RockPaperScissors>,
}

#[derive(Clone, Copy, BorshDeserialize, BorshSerialize)]
pub enum RockPaperScissors {
    Rock,
    Paper,
    Scissors,
}
```

### 2. 测试`rock_paper_scissors_shoot_insecure`指令

测试文件包括代码以调用`initialize`指令两次以创建两个玩家账户。

添加一个测试用例，通过将`playerOne.publicKey`同时传递给`playerOne`和`playerTwo`来调用`rock_paper_scissors_shoot_insecure`指令。

```typescript
describe("duplicate-mutable-accounts", () => {
	...
	it("Invoke insecure instruction", async () => {
        await program.methods
        .rockPaperScissorsShootInsecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerOne.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ scissors: {} }))
        assert.notEqual(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
    })
})
```

运行`anchor test`来验证事务的成功完成，即使在指令中使用相同的账户作为两个账户。由于在指令中`playerOne`账户同时被用作两个玩家，注意到`playerOne`账户上存储的`choice`也被覆盖并错误地设置为`scissors`。

```bash
duplicate-mutable-accounts
  ✔ Initialized Player One (461ms)
  ✔ Initialized Player Two (404ms)
  ✔ Invoke insecure instruction (406ms)
```

不仅允许重复账户对于游戏而言没有多大意义，还会导致未定义的行为。如果我们进一步构建此程序，程序仅有一个选择的选项，因此无法与第二个选项进行比较。游戏每次都将以平局结束。此外，对于人类来说不清楚`playerOne`的选择应该是`rock`还是`scissors`，因此程序行为异常。

### 3. 添加`rock_paper_scissors_shoot_secure`指令

然后返回到`lib.rs`，并添加一个`rock_paper_scissors_shoot_secure`指令，使用`#[account(...)]`宏来添加一个额外的`constraint`以检查`player_one`和`player_two`是否为不同的账户。

```rust
#[program]
pub mod duplicate_mutable_accounts {
    use super::*;
		...
        pub fn rock_paper_scissors_shoot_secure(
            ctx: Context<RockPaperScissorsSecure>,
            player_one_choice: RockPaperScissors,
            player_two_choice: RockPaperScissors,
        ) -> Result<()> {
            ctx.accounts.player_one.choice = Some(player_one_choice);

            ctx.accounts.player_two.choice = Some(player_two_choice);
            Ok(())
        }
}

#[derive(Accounts)]
pub struct RockPaperScissorsSecure<'info> {
    #[account(
        mut,
        constraint = player_one.key() != player_two.key()
    )]
    pub player_one: Account<'info, PlayerState>,
    #[account(mut)]
    pub player_two: Account<'info, PlayerState>,
}
```

### 7. 测试 `rock_paper_scissors_shoot_secure`指令

为了测试`rock_paper_scissors_shoot_secure`指令，我们将两次调用该指令。首先，我们将使用两个不同的玩家账户调用该指令，以检查该指令是否按预期工作。然后，我们将使用`playerOne.publicKey`作为两个玩家账户来调用该指令，我们期望会失败。


```typescript
describe("duplicate-mutable-accounts", () => {
	...
    it("调用安全指令", async () => {
        await program.methods
        .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
        .accounts({
            playerOne: playerOne.publicKey,
            playerTwo: playerTwo.publicKey,
        })
        .rpc()

        const p1 = await program.account.playerState.fetch(playerOne.publicKey)
        const p2 = await program.account.playerState.fetch(playerTwo.publicKey)
        assert.equal(JSON.stringify(p1.choice), JSON.stringify({ rock: {} }))
        assert.equal(JSON.stringify(p2.choice), JSON.stringify({ scissors: {} }))
    })

    it("调用安全指令 - 期望错误", async () => {
        try {
        await program.methods
            .rockPaperScissorsShootSecure({ rock: {} }, { scissors: {} })
            .accounts({
                playerOne: playerOne.publicKey,
                playerTwo: playerOne.publicKey,
            })
            .rpc()
        } catch (err) {
            expect(err)
            console.log(err)
        }
    })
})
```

运行 `anchor test` 以确保指令按预期工作，并且使用 `playerOne` 账户两次会返回预期的错误。

```bash
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS invoke [1]',
'Program log: Instruction: RockPaperScissorsShootSecure',
'Program log: AnchorError caused by account: player_one. Error Code: ConstraintRaw. Error Number: 2003. Error Message: A raw constraint was violated.',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS consumed 5104 of 200000 compute units',
'Program Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS failed: custom program error: 0x7d3'
```

简单的约束就足以消除这个漏洞。虽然有些牵强，但这个示例说明了如果你在编写程序时假设两个相同类型的账户将是不同的账户实例而没有明确将该约束写入程序中，可能会发生奇怪的行为。请始终考虑程序的预期行为以及这是否是显式的。

如果你想查看最终解决方案代码，可以在 [存储库](https://github.com/Unboxed-Software/solana-duplicate-mutable-accounts/tree/solution) 的 `solution` 分支找到它。

# 挑战

和该单元的其他课程一样，要避免这个安全漏洞的机会在于审计您自己或其他程序。

花些时间审查至少一个程序，并确保具有两个相同类型的可变账户的所有指令都受到适当的约束，以避免重复。

请记住，如果您在他人的程序中发现了漏洞或漏洞，请通知他们！ 如果您在自己的程序中发现了漏洞或漏洞，请务必立即修补它。

## 完成了实验吗？

将您的代码推送到 GitHub 并[告诉我们您对这堂课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=9b759e39-7a06-4694-ab6d-e3e7ac266ea7)！

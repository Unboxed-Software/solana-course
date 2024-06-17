---
title: 所有者检查
objectives:
- 解释不执行适当的所有者检查所带来的安全风险
- 使用长格式的 Rust 实施所有者检查
- 使用 Anchor 的 `Account<'info, T>` 封装和账户类型来自动化所有者检查
- 使用 Anchor 的 `#[account(owner = <expr>)]` 约束来明确定义应拥有账户的外部程序
---
**译者**: [ben46](https://github.com/ben46)


# 概要

- 使用 **所有者检查** 来验证账户是否由预期的程序拥有。如果没有适当的所有者检查，被意外程序拥有的账户可能会在指令中被使用。
- 在 Rust 中实施所有者检查，只需检查账户的所有者是否与预期程序 ID 匹配

```rust
if ctx.accounts.account.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

- Anchor 程序账户类型实现了 `Owner` trait，允许 `Account<'info, T>` 封装自动验证程序所有权
- Anchor还提供了一种方式，明确定义账户的所有者，如果它不是当前执行的程序

# 课程

所有者检查用于验证传入指令的账户是否由预期的程序所拥有。这可以防止被意外程序拥有的账户被用于指令中。

作为回顾，`AccountInfo` 结构包含以下字段。所有者检查指的是检查 `AccountInfo` 中的 `owner` 字段是否与预期的程序 ID 匹配。

```rust
/// 账户信息
#[derive(Clone)]
pub struct AccountInfo<'a> {
    /// 账户的公钥
    pub key: &'a Pubkey,
    /// 交易是否由该账户的公钥签名？
    pub is_signer: bool,
    /// 账户是否可写？
    pub is_writable: bool,
    /// 账户中的 lamports。可被程序修改。
    pub lamports: Rc<RefCell<&'a mut u64>>,
    /// 此账户中保存的数据。可被程序修改。
    pub data: Rc<RefCell<&'a mut [u8]>>,
    /// 拥有此账户的程序
    pub owner: &'a Pubkey,
    /// 此账户的数据包含已加载的程序（现在为只读）
    pub executable: bool,
    /// 此账户下次支付租金的纪元
    pub rent_epoch: Epoch,
}
```

### 缺少所有者检查

以下示例显示了一个 `admin_instruction`，其仅希望由存储在 `admin_config` 账户上的 `admin` 账户访问。

尽管该指令检查了`admin`账户是否签署了交易并与存储在 `admin_config` 账户上的 `admin` 字段匹配，但是没有进行所有者检查来验证传入指令的 `admin_config` 账户是否由执行程序所拥有。

由于 `admin_config` 未经检查，即 `AccountInfo` 类型指示的，被属于另一个程序所拥有的伪造 `admin_config` 账户可以在 `admin_instruction` 中使用。这意味着攻击者可以创建一个程序，其`admin_config` 的数据结构与您的程序的 `admin_config` 匹配，将其公钥设为 `admin`，并将其 `admin_config` 账户传入您的程序。这将使他们伪装成您的程序授权的管理程序。

此简化示例仅将`admin`打印到程序日志。但是，您可以想象缺少所有者检查会允许伪造账户利用指令。

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...

    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### 添加所有者检查

在普通的 Rust 中，您可以通过比较帐户上的 `owner` 字段和程序 ID 来解决此问题。如果它们不匹配，您将返回一个 `IncorrectProgramId` 错误。

```rust
if ctx.accounts.admin_config.owner != ctx.program_id {
    return Err(ProgramError::IncorrectProgramId.into());
}
```

添加所有者检查可以防止由意外程序所拥有的账户传递为 `admin_config` 账户。如果在 `admin_instruction` 中使用了伪造的 `admin_config` 账户，则交易将失败。

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Unchecked>) -> Result<()> {
        if ctx.accounts.admin_config.owner != ctx.program_id {
            return Err(ProgramError::IncorrectProgramId.into());
        }

        let account_data = ctx.accounts.admin_config.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = AdminConfig::try_deserialize(&mut account_data_slice)?;

        if account_state.admin != ctx.accounts.admin.key() {
            return Err(ProgramError::InvalidArgument.into());
        }
        msg!("Admin: {}", account_state.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Unchecked<'info> {
    admin_config: AccountInfo<'info>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### 使用 Anchor 的 `Account<'info, T>`

Anchor 可以通过 `Account` 类型使这个过程更简单。

`Account<'info, T>` 是对 `AccountInfo` 的包装，验证程序所有权并将底层数据反序列化为指定的账户类型 `T`。这样可以使用`Account<'info, T>` 轻松验证所有权。

在此情境中，`#[account]` 属性为表示账户的数据结构实现了各种 trait。其中之一是 `Owner` trait，用于定义预期拥有账户的地址。`owner` 是在 `declare_id!` 宏中指定的程序 ID。

在以下示例中，`Account<'info, AdminConfig>` 用于验证 `admin_config`。这将自动执行所有者检查并反序列化账户数据。此外，使用了 `has_one` 约束，用于检查 `admin` 账户是否与存储在 `admin_config` 账户上的 `admin` 字段相匹配。

这样，您就不需要在指令逻辑中混杂所有者检查。

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
	...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

### 使用 Anchor 的 `#[account(owner = <expr>)]` 约束

除了 `Account` 类型之外，您还可以使用 `owner` 约束。`owner` 约束允许您定义应该拥有一个账户的程序，如果它与当前执行的程序不同。例如，如果您正在编写一个指令，期望一个账户是从另一个程序派生而来的PDA，这将非常有用。您可以使用 `seeds` 和 `bump` 约束，并定义 `owner` 来正确派生和验证传入的账户地址。

为了使用 `owner` 约束，您需要访问您期望拥有账户的程序的公钥。您可以将程序作为额外账户传递进来，或者在程序的某个地方将公钥硬编码。

```rust
use anchor_lang::prelude::*;

declare_id!("Cft4eTTrt4sJU4Ar35rUQHx6PSXfJju3dixmvApzhWws");

#[program]
pub mod owner_check {
    use super::*;
    ...
    pub fn admin_instruction(ctx: Context<Checked>) -> Result<()> {
        msg!("Admin: {}", ctx.accounts.admin_config.admin.to_string());
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Checked<'info> {
    #[account(
        has_one = admin,
    )]
    admin_config: Account<'info, AdminConfig>,
    admin: Signer<'info>,
    #[account(
            seeds = b"test-seed",
            bump,
            owner = token_program.key()
    )]
    pda_derived_from_another_program: AccountInfo<'info>,
    token_program: Program<'info, Token>
}

#[account]
pub struct AdminConfig {
    admin: Pubkey,
}
```

# 实验室

在这个实验中，我们将使用两个程序来演示缺失的所有者检查如何允许伪账户从简化的令牌“保险库”账户中取走令牌（请注意，这与签名者授权课程中的实验非常相似）。

为了帮助说明这一点，一个程序将缺少对其提取令牌到保险库账户的所有者检查。

第二个程序将是由一个恶意用户创建的第一个程序的直接克隆，以创建一个与第一个程序的保险库账户相同的账户。

没有所有者检查，这个恶意用户将能够传入由他们“伪造”的程序拥有的保险库账户，而原始程序仍然可以执行。

### 1. 起点

要开始，请从[此存储库](https://github.com/Unboxed-Software/solana-owner-checks/tree/starter)的`starter`分支下载起始代码。起始代码包括两个程序 `clone` 和 `owner_check` 以及测试文件的样板设置。

`owner_check` 程序包括两个指令：

- `initialize_vault` 初始化一个简化的保险库账户，其中存储了一个令牌账户和一个授权账户的地址
- `insecure_withdraw` 从令牌账户中提取令牌，但是对保险库账户缺少所有者检查

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB");

#[program]
pub mod owner_check {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }

    pub fn insecure_withdraw(ctx: Context<InsecureWithdraw>) -> Result<()> {
        let account_data = ctx.accounts.vault.try_borrow_data()?;
        let mut account_data_slice: &[u8] = &account_data;
        let account_state = Vault::try_deserialize(&mut account_data_slice)?;

        if account_state.authority != ctx.accounts.authority.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
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
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = token_account,
        seeds = [b"token"],
        bump,
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
    /// CHECK:
    pub vault: UncheckedAccount<'info>,
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
}
```

`clone` 程序包含一个指令：

- `initialize_vault` 初始化一个“保险库”账户，模仿 `owner_check` 程序的保险库账户。它存储了真实保险库令牌账户地址，但允许恶意用户放入他们自己的权威账户。

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

declare_id!("DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3");

#[program]
pub mod clone {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.token_account = ctx.accounts.token_account.key();
        ctx.accounts.vault.authority = ctx.accounts.authority.key();
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32,
    )]
    pub vault: Account<'info, Vault>,
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

### 2. 测试 `insecure_withdraw` 指令

测试文件包括一项测试，使用提供者钱包作为 `authority` 调用 `owner_check` 程序上的 `initialize_vault` 指令，然后将 100 个代币铸造到代币账户中。

测试文件还包括一项测试，调用 `clone` 程序上的 `initialize_vault` 指令以初始化一个假的 `vault` 账户，存储相同的 `tokenPDA` 账户，但一个不同的 `authority`。请注意，这里没有铸造新代币。

让我们添加一个测试，以调用 `insecure_withdraw` 指令。此测试应该在克隆的保险库和假的权威情况下通过。由于没有所有者检查来验证 `vaultClone` 账户是否由 `owner_check` 程序拥有，该指令的数据验证检查将通过，并显示 `walletFake` 为有效的权威。然后，`tokenPDA` 账户中的代币将被提取到 `withdrawDestinationFake` 账户。

```tsx
describe("owner-check", () => {
	...
    it("Insecure withdraw", async () => {
    const tx = await program.methods
        .insecureWithdraw()
        .accounts({
            vault: vaultClone.publicKey,
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

运行 `anchor test` 看看 `insecure_withdraw` 是否成功完成。

```bash
owner-check
  ✔ Initialize Vault (808ms)
  ✔ Initialize Fake Vault (404ms)
  ✔ Insecure withdraw (409ms)
```

请注意，`vaultClone` 成功反序列化，即使 Anchor 自动初始化新帐户时使用唯一的 8 字节判别器，并在反序列化账户时检查判别器。这是因为判别器是账户类型名称的哈希值。

```rust
#[account]
pub struct Vault {
    token_account: Pubkey,
    authority: Pubkey,
}
```

由于两个程序初始化相同的账户，并且两个结构都被命名为 `Vault`，虽然它们由不同的程序拥有，但账户具有相同的判别器。

### 3. 添加 `secure_withdraw` 指令

让我们封闭这个安全漏洞。

在 `owner_check` 程序的 `lib.rs` 文件中添加一个 `secure_withdraw` 指令和一个 `SecureWithdraw` 账户结构。

在 `SecureWithdraw` 结构中，让我们使用 `Account<'info, Vault>`，以确保对 `vault` 账户执行所有者检查。我们还将使用 `has_one` 约束条件检查传递给指令的 `token_account` 和 `authority` 是否与 `vault` 账户中存储的值匹配。

```rust
#[program]
pub mod owner_check {
    use super::*;
	...

	pub fn secure_withdraw(ctx: Context<SecureWithdraw>) -> Result<()> {
        let amount = ctx.accounts.token_account.amount;

        let seeds = &[
            b"token".as_ref(),
            &[*ctx.bumps.get("token_account").unwrap()],
        ];
        let signer = [&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.token_account.to_account_info(),
                to: ctx.accounts.withdraw_destination.to_account_info(),
            },
            &signer,
        );

        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}
...

#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(
       has_one = token_account,
       has_one = authority
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
```

### 4. 测试 `secure_withdraw` 指令

为了测试 `secure_withdraw` 指令，我们将调用该指令两次。首先，我们将使用 `vaultClone` 账户调用该指令，我们期望操作失败。然后，我们将使用正确的 `vault` 账户调用该指令，以验证该指令是否按预期工作。

```tsx
describe("owner-check", () => {
	...
	it("安全提款，预期出错", async () => {
        try {
            const tx = await program.methods
                .secureWithdraw()
                .accounts({
                    vault: vaultClone.publicKey,
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

    it("安全提款", async () => {
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
            vault: vault.publicKey,
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

运行 `anchor test`，看到使用 `vaultClone` 账户进行的交易将会返回 Anchor 错误，而使用 `vault` 账户进行的交易将会成功完成。

```bash
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB invoke [1]',
'Program log: Instruction: SecureWithdraw',
'Program log: AnchorError caused by account: vault. Error Code: AccountOwnedByWrongProgram. Error Number: 3007. Error Message: The given account is owned by a different program than expected.',
'Program log: Left:',
'Program log: DUN7nniuatsMC7ReCh5eJRQExnutppN1tAfjfXFmGDq3',
'Program log: Right:',
'Program log: HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB consumed 5554 of 200000 compute units',
'Program HQYNznB3XTqxzuEqqKMAD9XkYE5BGrnv8xmkoDNcqHYB failed: custom program error: 0xbbf'
```

在这里，我们看到使用 Anchor 的 `Account<'info, T>` 类型可以简化账户验证流程，实现账户所有权自动检查。此外，注意到 Anchor 错误可以指定引发错误的账户（例如上述日志的第三行指出 `AnchorError caused by account: vault`）。在调试时，这点非常有帮助。

```bash
✔ 安全提款，预期出错 (78毫秒)
✔ 安全提款 (10063毫秒)
```

这就是你需要确保检查账户所有权的所有内容！与本单元的其他课程一样，避免这种安全漏洞的机会在于审计自己或他人的程序。

花些时间至少审查一个程序，并确保在传递给每个指令的账户上执行适当的所有者检查。

记住，如果你发现别人程序中的漏洞或漏洞，请提醒他们！如果你发现了自己程序中的漏洞或漏洞，请务必立即修补。

## 完成了实验？

将你的代码推送到 GitHub，并[告诉我们你对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=e3069010-3038-4984-b9d3-2dc6585147b1)!
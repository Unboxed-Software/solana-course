---
title: 提升种子规范化
objectives:
- 解释使用未经规范化提取的PDA所相关的漏洞
- 利用Anchor的`seeds`和`bump`约束初始化一个PDA，以自动使用规范化提升
- 使用Anchor的`seeds`和`bump`约束，确保在从PDA派生未来指令时总是使用规范化提升
---

# 摘要

- [**`create_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) 函数在不搜索**规范化提升**的情况下派生PDA。这意味着存在多个有效的提升值，所有这些值都会产生不同的地址。
- 使用[**`find_program_address`**](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address)可确保使用了最高有效的提升，或者规范化提升，从而创建了一种确定性的方式，给定特定的种子找到一个地址。
- 在初始化时，您可以使用Anchor的`seeds`和`bump`约束，以确保账户验证结构中的PDA派生总是使用规范化提升。
- Anchor允许您使用`bump = <some_bump>`约束指定一个提升来验证PDA的地址。
- 由于`find_program_address`可能成本较高，最佳实践是将派生的提升存储在账户的数据字段中，以便以后重新派生地址进行验证
    ```rust
    #[derive(Accounts)]
    pub struct VerifyAddress<'info> {
    	#[account(
        	seeds = [DATA_PDA_SEED.as_bytes()],
    	    bump = data.bump
    	)]
    	data: Account<'info, Data>,
    }
    ```

# 课程

提升种子是0到255（包括）之间的数字，用于确保使用 [`create_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.create_program_address) 派生的地址是一个有效的PDA。**规范化提升**是产生有效PDA的最高提升值。Solana的标准是*在派生PDA时始终使用规范化提升*，这样做既为安全，也为方便。

## 使用`create_program_address`不安全的PDA派生

给定一组种子，`create_program_address`函数大约50%的时间会产生一个有效的PDA。提升种子是额外添加的一个字节，作为一种种子来将派生的地址调整为有效领域。由于可能有256种可能的提升种子，且该函数大约50%的时间会产生有效的PDA，因此对于给定的输入种子，可能存在多个有效的提升种子。

你可以想象，这可能会导致在使用种子作为在已知信息和账户之间映射的一种方法时产生混淆。使用规范化提升作为标准可以确保始终可以找到正确的账户。更重要的是，它避免了由允许多个提升引起的安全漏洞的开放性质的利用。

在下面的示例中，`set_value`指令使用了一个作为指令数据传递的`bump`来派生一个PDA。然后，该指令使用`create_program_address`函数派生PDA，并检查`address`是否与`data`账户的公钥匹配。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

虽然该指令会派生PDA并检查传入的账户，这是好的，但它允许调用者传递一个任意的提升。根据程序的上下文，这可能导致不希望的行为或潜在的利用。

例如，如果种子映射旨在强制 PDA 与用户之间的一对一关系，则此程序将无法正确实施。用户可以多次调用该程序，使用许多有效的提升，每个提升产生一个不同的PDA。

## 推荐使用`find_program_address`进行派生

解决这个问题的一个简单方法是让程序只期望规范化提升，并使用`find_program_address`来派生PDA。

[`find_program_address`](https://docs.rs/solana-program/latest/solana_program/pubkey/struct.Pubkey.html#method.find_program_address) *始终使用规范化提升*。此函数通过调用`create_program_address`迭代，从提升255开始，并递减提升一个单位，直到找到有效地址为止，然后函数返回派生的PDA及其派生时所使用的规范化提升。

这确保了你的输入种子与它们产生的地址之间的一对一映射。

```rust
pub fn set_value_secure(
    ctx: Context<BumpSeed>,
    key: u64,
    new_value: u64,
    bump: u8,
) -> Result<()> {
    let (address, expected_bump) =
        Pubkey::find_program_address(&[key.to_le_bytes().as_ref()], ctx.program_id);

    if address != ctx.accounts.data.key() {
        return Err(ProgramError::InvalidArgument.into());
    }
    if expected_bump != bump {
        return Err(ProgramError::InvalidArgument.into());
    }

    ctx.accounts.data.value = new_value;
    Ok(())
}
```

## 使用Anchor的`seeds`和`bump`约束

Anchor提供了一种方便的方法，使用`seeds`和`bump`约束在账户验证结构中派生PDA。这些约束甚至可以与`init`约束组合，以在预期地址初始化账户。为了保护我们在本课程中讨论的漏洞，Anchor甚至不允许您使用除规范化提升以外的任何内容来初始化PDA的账户。相反，它使用`find_program_address`来派生PDA，并随后执行初始化。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod bump_seed_canonicalization_insecure {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, key: u64, new_value: u64, bump: u8) -> Result<()> {
        let address =
            Pubkey::create_program_address(&[key.to_le_bytes().as_ref(), &[bump]], ctx.program_id).unwrap();
        if address != ctx.accounts.data.key() {
            return Err(ProgramError::InvalidArgument.into());
        }

        ctx.accounts.data.value = new_value;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct BumpSeed<'info> {
    data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
}
```

如果您没有初始化账户，仍然可以使用`seeds`和`bump`约束来验证PDA。这简单地重新推导PDA，并将推导出的地址与传入的账户地址进行比较。

在这种情况下，Anchor确实允许您指定用于使用`bump = <some_bump>`来推导PDA。这里的意图并不是让您使用任意的bump，而是让您优化您的程序。`find_program_address`的迭代性质使其成本高昂，所以最佳实践是在初始化PDA时在PDA账户的数据中存储规范的bump，这样您在验证PDA时可以引用存储的bump。

当您指定要使用的bump时，Anchor会使用提供的bump来执行`create_program_address`，而不是`find_program_address`。将bump存储在账户数据中的这种模式确保您的程序始终使用规范的bump而不会降低性能。
```rust
use anchor_lang::prelude::*;

declare_id!("CVwV9RoebTbmzsGg1uqU1s4a3LvTKseewZKmaNLSxTqc");

#[program]
pub mod bump_seed_canonicalization_recommended {
    use super::*;

    pub fn set_value(ctx: Context<BumpSeed>, _key: u64, new_value: u64) -> Result<()> {
        ctx.accounts.data.value = new_value;
        // store the bump on the account
        ctx.accounts.data.bump = *ctx.bumps.get("data").unwrap();
        Ok(())
    }

    pub fn verify_address(ctx: Context<VerifyAddress>, _key: u64) -> Result<()> {
        msg!("PDA confirmed to be derived with canonical bump: {}", ctx.accounts.data.key());
        Ok(())
    }
}

// initialize account at PDA
#[derive(Accounts)]
#[instruction(key: u64)]
pub struct BumpSeed<'info> {
  #[account(mut)]
  payer: Signer<'info>,
  #[account(
    init,
    seeds = [key.to_le_bytes().as_ref()],
    // derives the PDA using the canonical bump
    bump,
    payer = payer,
    space = 8 + 8 + 1
  )]
  data: Account<'info, Data>,
  system_program: Program<'info, System>
}

#[derive(Accounts)]
#[instruction(key: u64)]
pub struct VerifyAddress<'info> {
  #[account(
    seeds = [key.to_le_bytes().as_ref()],
    // guranteed to be the canonical bump every time
    bump = data.bump
  )]
  data: Account<'info, Data>,
}

#[account]
pub struct Data {
    value: u64,
    // bump field
    bump: u8
}
```

如果您不指定“bump”约束上的凸起，Anchor 将仍使用`find_program_address`来使用规范的凸起来推导PDA。 因此，您的指令将产生可变量的计算预算。 已经有可能超出其计算预算的程序应谨慎使用此功能，因为存在可能会偶尔和不可预测地超出程序预算的风险。

另一方面，如果您只需要验证传入的PDA的地址而无需初始化帐户，您将被迫让Anchor推导规范的凸起或使您的程序暴露于不必要的风险中。 在这种情况下，请使用规范的凸起，尽管会稍微影响性能。

# Lab

在不检查规范颠簸时可能出现的安全漏洞示例，让我们来处理一个允许每个程序用户按时“领取”奖励的程序。

### 1. Setup
从[此存储库](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/starter)的`starter`分支获取代码。

请注意，该程序上有两个指令和一个位于`tests`目录中的测试。

程序上的指令为：

1. `create_user_insecure`
2. `claim_insecure`

`create_user_insecure`指令仅仅在一个使用签名者公钥和传入的bump派生的PDA上创建一个新帐户。

`claim_insecure`指令将向用户铸造10个代币，然后标记帐户的奖励已被索取，使他们无法再次索取。

然而，该程序并未显式检查相关的PDA是否使用了规范化的bump。

在继续之前，请查看程序以了解其功能。

### 2. Test insecure instructions

由于指令并未明确要求用户PDA使用规范的bump，攻击者可以针对每个钱包创建多个账户，并申领超出应允许的奖励。

在`tests`目录中的测试会创建一个名为`attacker`的新密钥对，代表一个攻击者。然后它会循环遍历所有可能的bumps，并调用`create_user_insecure`和`claim_insecure`。最终，该测试期望攻击者已经成功多次领取奖励，获得的代币超过每个用户被分配的10个。

```typescript
it("Attacker can claim more than reward limit with insecure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)

    let numClaims = 0

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserInsecure(i)
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()
        await program.methods
          .claimInsecure(i)
          .accounts({
            user: pda,
            mint,
            payer: attacker.publicKey,
            userAta: ataKey,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch (error) {
        if (
          error.message !== "Invalid seeds, address must fall off the curve"
        ) {
          console.log(error)
        }
      }
    }

    const ata = await getAccount(provider.connection, ataKey)

    console.log(
      `Attacker claimed ${numClaims} times and got ${Number(ata.amount)} tokens`
    )

    expect(numClaims).to.be.greaterThan(1)
    expect(Number(ata.amount)).to.be.greaterThan(10)
})
```

运行 `anchor test` 以查看该测试是否通过，表明攻击者取得了成功。由于该测试为每个有效的变化调用指令，因此运行时间较长，请耐心等待。

```bash
  bump-seed-canonicalization
Attacker claimed 129 times and got 1290 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (133840ms)
```
 

### 3. 创建安全指令

让我们通过创建两个新指令来展示修补漏洞：

1. `create_user_secure`
2. `claim_secure`

在编写账户验证或指令逻辑之前，让我们创建一个新的用户类型 `UserSecure`。这个新类型将在结构体中增加规范化的增值字段。

```rust
#[account]
pub struct UserSecure {
    auth: Pubkey,
    bump: u8,
    rewards_claimed: bool,
}
```

接下来，让我们为新指令创建账户验证结构体。它们与非安全版本非常相似，但将让 Anchor 处理PDA的派生和反序列化。

```rust
#[derive(Accounts)]
pub struct CreateUserSecure<'info> {
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init,
        seeds = [payer.key().as_ref()],
        //使用规范化的增值来派生PDA
        bump,
        payer = payer,
        space = 8 + 32 + 1 + 1
    )]
    user: Account<'info, UserSecure>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SecureClaim<'info> {
    #[account(
        seeds = [payer.key().as_ref()],
        bump = user.bump,
        constraint = !user.rewards_claimed @ ClaimError::AlreadyClaimed,
        constraint = user.auth == payer.key()
    )]
    user: Account<'info, UserSecure>,
    #[account(mut)]
    payer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    user_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    mint: Account<'info, Mint>,
    /// CHECK: mint auth PDA
    #[account(seeds = ["mint".as_bytes().as_ref()], bump)]
    pub mint_authority: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    associated_token_program: Program<'info, AssociatedToken>,
    system_program: Program<'info, System>,
    rent: Sysvar<'info, Rent>,
}
```

最后，让我们实现两个新指令的指令逻辑。`create_user_secure`指令只需在`user`账户数据上设置`auth`、`bump`和`rewards_claimed`字段。

```rust
pub fn create_user_secure(ctx: Context<CreateUserSecure>) -> Result<()> {
    ctx.accounts.user.auth = ctx.accounts.payer.key();
    ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
    ctx.accounts.user.rewards_claimed = false;
    Ok(())
}
```

`claim_secure`指令需要向用户分配10个代币，并将`user`账户的`rewards_claimed`字段设置为`true`。

```rust
pub fn claim_secure(ctx: Context<SecureClaim>) -> Result<()> {
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.user_ata.to_account_info(),
                authority: ctx.accounts.mint_authority.to_account_info(),
            },
            &[&[
                    b"mint".as_ref(),
                &[*ctx.bumps.get("mint_authority").unwrap()],
            ]],
        ),
        10,
    )?;

    ctx.accounts.user.rewards_claimed = true;

    Ok(())
}
```

### 4. 测试安全指令

让我们编写一个测试，以显示使用新指令攻击者不再能够多次认领。

值得注意的是，如果您开始使用旧测试修复了漏洞，您甚至无法将非规范化的增值传递给指令。然而，您仍然可以通过各种PDA循环，最终检查只发生了1次认领，共获得了10个代币。您的最终测试结果将如下所示：


```typescript
it.only("Attacker can only claim once with secure instructions", async () => {
    const attacker = Keypair.generate()
    await safeAirdrop(attacker.publicKey, provider.connection)
    const ataKey = await getAssociatedTokenAddress(mint, attacker.publicKey)
    const [userPDA] = findProgramAddressSync(
      [attacker.publicKey.toBuffer()],
      program.programId
    )

    await program.methods
      .createUserSecure()
      .accounts({
        payer: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()

    await program.methods
      .claimSecure()
      .accounts({
        payer: attacker.publicKey,
        userAta: ataKey,
        mint,
        user: userPDA,
      })
      .signers([attacker])
      .rpc()

    let numClaims = 1

    for (let i = 0; i < 256; i++) {
      try {
        const pda = createProgramAddressSync(
          [attacker.publicKey.toBuffer(), Buffer.from([i])],
          program.programId
        )
        await program.methods
          .createUserSecure()
          .accounts({
            user: pda,
            payer: attacker.publicKey,
          })
          .signers([attacker])
          .rpc()

        await program.methods
          .claimSecure()
          .accounts({
            payer: attacker.publicKey,
            userAta: ataKey,
            mint,
            user: pda,
          })
          .signers([attacker])
          .rpc()

        numClaims += 1
      } catch {}
    }

    const ata = await getAccount(provider.connection, ataKey)

    expect(Number(ata.amount)).to.equal(10)
    expect(numClaims).to.equal(1)
})
```

```bash
  bump-seed-canonicalization
Attacker claimed 119 times and got 1190 tokens
    ✔ Attacker can claim more than reward limit with insecure instructions (128493ms)
    ✔ Attacker can only claim once with secure instructions (1448ms)
```
 

如果您对所有 PDA 派生使用 Anchor，那么避免这种特定的漏洞就非常简单。但是，如果您最终使用了任何“非标准”操作，请务必小心设计您的程序以明确使用规范的增量！

如果您想查看最终的解决方案代码，可以在[同一仓库](https://github.com/Unboxed-Software/solana-bump-seed-canonicalization/tree/solution)的`solution`分支中找到。

# 挑战

与本单元的其他课程一样，避免这种安全漏洞的机会在于审核您自己的程序或其他程序。

花些时间审查至少一个程序，并确保所有 PDA 派生和检查都使用规范的增量。

请记住，如果您发现了别人程序中的错误或漏洞，请及时提醒他们！如果您发现了自己程序中的漏洞，请务必立即修补。

## 完成了实验吗？

将您的代码推送到 GitHub，并[告诉我们您对这堂课的感想](https://form.typeform.com/to/IPH0UGz7#answers-lesson=d3f6ca7a-11c8-421f-b7a3-d6c08ef1aa8b)！

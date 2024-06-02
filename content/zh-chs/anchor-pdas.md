---
title: anchorPDA和账户
objectives:
- 使用`seeds`和`bump`约束来处理anchor中的PDA账户
- 启用和使用`init_if_needed`约束
- 使用`realloc`约束对现有账户重新分配空间
- 使用`close`约束关闭现有账户
---

# 摘要

- 使用`seeds`和`bump`约束来初始化和验证Anchor中的PDA账户
- 使用`init_if_needed`约束来有条件地初始化一个新账户
- 使用`realloc`约束对现有账户重新分配空间
- 使用`close`约束关闭账户并退还其租金

# 课程

在本课程中，您将学习如何处理PDAs，重新分配账户以及关闭Anchor中的账户。

回想一下，Anchor程序将指令逻辑与账户验证分离。账户验证主要发生在表示给定指令所需的账户列表的结构中。结构的每个字段表示不同的账户，您可以使用`#[account(...)]`属性宏自定义对账户的验证。

除了使用约束进行账户验证外，一些约束还可以处理一些重复的任务，否则在我们的指令逻辑内将需要大量样板代码。本课程将介绍`seeds`、`bump`、`realloc`和`close`约束，帮助您初始化和验证PDAs，重新分配账户以及关闭账户。

## 使用anchor处理PDAs

回想一下，[PDAs](https://github.com/Unboxed-Software/solana-course/blob/main/content/pda)是使用一组可选种子、一个增量种子以及一个程序ID派生而来的。Anchor提供了一种便捷的方式使用`seeds`和`bump`约束来验证PDA。

```rust
#[derive(Accounts)]
struct ExampleAccounts {
  #[account(
    seeds = [b"example_seed"],
    bump
  )]
  pub pda_account: Account<'info, AccountType>,
}
```

在账户验证期间，Anchor将使用`seeds`约束中指定的种子派生出一个PDA，并验证传递给指令的账户是否与使用指定`seeds`找到的PDA匹配。

当包括`bump`约束但没有指定特定增量时，Anchor将默认使用规范增量（导致有效的PDA的第一个增量）。在大多数情况下，您应该使用规范增量。

您可以在约束中访问来自结构体的其他字段，因此您可以指定依赖于其他账户（如签名者的公钥）的种子。

如果您将`#[instruction(...)]`属性宏添加到结构体中，还可以引用反序列化的指令数据。

例如，以下示例显示了一个包括`pda_account`和`user`的账户列表。对于`pda_account`，约束为必须是字符串“example_seed”，用户的公钥，以及作为`instruction_data`传入指令的字符串。

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct Example<'info> {
    #[account(
        seeds = [b"example_seed", user.key().as_ref(), instruction_data.as_ref()],
        bump
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>
}
```

如果客户端提供的`pda_account`地址与使用指定种子和规范增量派生的PDA不匹配，则账户验证将失败。

### 使用`init`约束处理PDAs

您可以将`seeds`和`bump`约束与`init`约束相结合，使用PDA来初始化一个账户。

请记住，`init`约束必须与`payer`和`space`约束一起使用，以指定将为账户初始化支付的账户和在新账户上分配的空间。此外，您必须将`system_program`作为账户验证结构的字段之一。

```rust
#[derive(Accounts)]
pub struct InitializePda<'info> {
    #[account(
        init,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: u64,
}
```

当用于非PDA账户的`init`时，Anchor默认将初始化账户的所有者设置为当前执行指令的程序。

然而，当将`init`与`seeds`和`bump`相结合使用时，所有者 *必须* 是执行程序。这是因为为PDA初始化账户需要仅执行程序才能提供的签名。换句话说，如果用于派生PDA的程序ID与执行程序的程序ID不匹配，则将失败对PDA账户进行初始化的签名验证。

在确定为由执行Anchor程序初始化并拥有的账户分配多少空间时，请记住前8个字节为账户辨别子保留。这是Anchor计算并用来识别程序账户类型的8字节值。您可以使用这个[参考](https://www.anchor-lang.com/docs/space)来计算为账户分配多少空间。

### 种子推断

一些程序的指令账户列表可能会变得非常长。为了简化调用Anchor程序指令时的客户端体验，我们可以打开种子推断功能。

种子推断会向IDL添加关于PDA种子的信息，以便Anchor可以从现有的调用信息中推断PDA种子。在前一个示例中，种子为`b"example_seed"`和`user.key()`。第一个是静态的，因此是已知的，第二个是已知的，因为`user`是交易签名者。

如果在构建程序时使用了种子推断，则只要您使用Anchor调用程序，您就无需显式派生并传入PDA。相反，Anchor库将为您执行此操作。

您可以在`Anchor.toml`文件中使用`seeds = true`在`[features]`下打开种子推断。

```
[features]
seeds = true
```

### 使用`#[instruction(...)]`属性宏

在继续之前，让我们简要看一下`#[instruction(...)]`属性宏。当使用`#[instruction(...)]`时，在参数列表中提供的指令数据必须与指令参数中的顺序匹配。您可以在列表的末尾省略未使用的参数，但您必须包括直到您将使用的最后一个参数。

例如，假设一条指令具有参数 `input_one`、`input_two` 和 `input_three`。如果您的账户约束需要引用 `input_one` 和 `input_three`，您需要在 `#[instruction(...)]` 属性宏中列出所有三个参数。

然而，如果您的约束只引用 `input_one` 和 `input_two`，则可以省略 `input_three`。

```rust
pub fn example_instruction(
    ctx: Context<Example>,
    input_one: String,
    input_two: String,
    input_three: String,
) -> Result<()> {
    ...
    Ok(())
}

#[derive(Accounts)]
#[instruction(input_one:String, input_two:String)]
pub struct Example<'info> {
    ...
}
```

另外，如果您按照错误的顺序列出输入，则会出现错误：

```rust
#[derive(Accounts)]
#[instruction(input_two:String, input_one:String)]
pub struct Example<'info> {
    ...
}
```

## 如果需要则初始化

Anchor 提供了 `init_if_needed` 约束，可用于初始化帐户，如果帐户尚未被初始化。

这个功能受到特性标志的限制，以确保您有意使用它。出于安全原因，最好避免一个指令分支进入多个逻辑路径。正如名称所示，`init_if_needed` 根据相关帐户的状态执行两个可能的代码路径中的一个。

在使用 `init_if_needed` 时，您需要确保适当地保护您的程序免受重新初始化攻击。您需要在代码中包含检查，以确保初始化后的帐户在第一次初始化后不能被重置为其初始设置。

要使用 `init_if_needed`，必须首先在 `Cargo.toml` 中启用该特性。

```rust
[dependencies]
anchor-lang = { version = "0.25.0", features = ["init-if-needed"] }
```

启用该特性后，您可以在 `#[account(…)]` 属性宏中包含约束。下面的示例演示了如何使用 `init_if_needed` 约束来初始化新的关联代币帐户（如果尚不存在）。

```rust
#[program]
mod example {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
     #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

在前面的示例中，当调用 `initialize` 指令时，Anchor 将检查 `token_account` 是否存在，如果不存在则初始化它。如果已经存在，则指令将继续而不初始化该帐户。就像 `init` 约束一样，如果帐户是 PDA，则可以与 `seeds` 和 `bump` 一起使用 `init_if_needed`。

## 重新分配

`realloc` 约束提供了一种简单的方式来重新分配现有帐户的空间。

`realloc` 约束必须与以下约束结合使用：

- `mut` - 帐户必须被设置为可变
- `realloc::payer` - 根据重新分配是减少还是增加帐户空间，从该帐户减少或添加lamports
- `realloc::zero` - 指定新内存是否应该进行零初始化的布尔值

与 `init` 一样，当使用 `realloc` 时，必须在帐户验证结构中包含 `system_program` 作为其中一个帐户。

下面是一个示例，重新分配存储类型为 `String` 的 `data` 字段的帐户的空间。

```rust
#[derive(Accounts)]
#[instruction(instruction_data: String)]
pub struct ReallocExample<'info> {
    #[account(
        mut,
        seeds = [b"example_seed", user.key().as_ref()],
        bump,
        realloc = 8 + 4 + instruction_data.len(),
        realloc::payer = user,
        realloc::zero = false,
    )]
    pub pda_account: Account<'info, AccountType>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct AccountType {
    pub data: String,
}
```

注意，`realloc` 设置为 `8 + 4 + instruction_data.len()`。这可以分解如下：
- `8` 用于帐户鉴别器
- `4` 用于 BORSH 用于存储字符串长度的 4 字节空间
- `instruction_data.len()` 是字符串本身的长度

如果帐户数据长度的变化是增加的，lamports 将从 `realloc::payer` 转移至帐户以维持租金免除。同样，如果减少，则将从帐户转移回 `realloc::payer`。

`realloc::zero` 约束是必需的，用于确定重新分配后的新内存是否应该进行零初始化。在您预计一个帐户的内存会多次收缩和扩展的情况下，应该将该约束设置为 true。这样，您就可以清除否则会显示为过时数据的空间。

## 关闭

`close` 约束为关闭现有帐户提供了一种简单且安全的方式。

`close` 约束通过将帐户的鉴别器设置为 `CLOSED_ACCOUNT_DISCRIMINATOR`，在指令执行结束时将帐户标记为关闭，并将其 lamports 发送到特定帐户。通过将鉴别器设置为特殊变体，使得帐户复活攻击（随后的指令再次添加租金免除的lamports）变得不可能。如果有人试图重新初始化帐户，则重新初始化将不会通过鉴别器检查，并且程序将认为其无效。

下面的示例使用 `close` 约束关闭 `data_account` 并将为租金分配的 lamports 发送到 `receiver` 帐户。

```rust
pub fn close(ctx: Context<Close>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Close<'info> {
    #[account(mut, close = receiver)]
    pub data_account: Account<'info, AccountType>,
    #[account(mut)]
    pub receiver: Signer<'info>
}
```

# 实验

让我们通过使用 Anchor 框架创建一个电影评论程序来练习我们在本课中学到的概念。

该程序将允许用户：

- 使用 PDA 初始化一个新的电影评论帐户以存储评论
- 更新现有电影评论帐户的内容
- 关闭现有电影评论帐户

### 1. 创建一个新的 Anchor 项目

首先，我们使用 `anchor init` 创建一个新项目。

```console
anchor init anchor-movie-review-program
```



下一步，转到 `programs` 文件夹中的 `lib.rs` 文件，您会看到以下起始代码。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
```

继续并删除 `initialize` 指令和 `Initialize` 类型。

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}
```

### 2. `MovieAccountState`

首先，让我们使用 `#[account]` 属性宏来定义 `MovieAccountState`，它将表示电影评价账户的数据结构。提醒一下，`#[account]` 属性宏实现了各种帮助序列化和反序列化账户的特性，设置账户的鉴别器，并将新账户的所有者设置为 `declare_id!` 宏中定义的程序 ID。

在每个电影评价账户中，我们将存储：

- `reviewer` - 创建评价的用户
- `rating` - 电影评分
- `title` - 电影标题
- `description` - 评价内容

```rust
use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod anchor_movie_review_program {
    use super::*;

}

#[account]
pub struct MovieAccountState {
    pub reviewer: Pubkey,    // 32
    pub rating: u8,          // 1
    pub title: String,       // 4 + len()
    pub description: String, // 4 + len()
}
```

### 3. 添加电影评价

接下来，让我们实现 `add_movie_review` 指令。`add_movie_review` 指令将需要一个我们很快将实现的 `AddMovieReview` 类型的 `Context`。

该指令将需要作为评价者提供的指令数据的三个额外参数：

- `title` - 电影的标题，类型为 `String`
- `description` - 评价的详情，类型为 `String`
- `rating` - 电影的评分，类型为 `u8`

在指令逻辑中，我们将使用指令数据填充新的 `movie_review` 账户的数据。我们还将设置 `reviewer` 字段为指令上下文中的 `initializer` 账户。

```rust
#[program]
pub mod anchor_movie_review_program{
    use super::*;

    pub fn add_movie_review(
        ctx: Context<AddMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("电影评价账户已创建");
        msg!("标题: {}", title);
        msg!("详情: {}", description);
        msg!("评分: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.reviewer = ctx.accounts.initializer.key();
        movie_review.title = title;
        movie_review.rating = rating;
        movie_review.description = description;
        Ok(())
    }
}
```

接下来，让我们创建我们使用为指令上下文中的泛型的 `AddMovieReview` 结构。此结构将列出 `add_movie_review` 指令所需的账户。

记住，您将需要以下宏：

- `#[derive(Accounts)]` 宏用于反序列化和验证在结构中指定的账户列表
- `#[instruction(...)]` 属性宏用于访问传递到指令的指令数据
- 然后，`#[account(...)]` 属性宏指定账户的额外约束

`movie_review` 账户是一个需要初始化的 PDA，因此我们将添加 `seeds` 和 `bump` 约束，以及带有其所需的 `payer` 和 `space` 约束的 `init` 约束。

对于 PDA 种子，我们将使用电影标题和评论者的公钥。初始化的支付方应该是评论者，账户分配的空间应该足以包含账户鉴别器、评论者的公钥以及电影评分、标题和描述。

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct AddMovieReview<'info> {
    #[account(
        init,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        payer = initializer,
        space = 8 + 32 + 1 + 4 + title.len() + 4 + description.len()
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

### 4. 更新电影评价

接下来，让我们实现 `update_movie_review` 指令，其上下文的泛型类型为 `UpdateMovieReview`。

就像之前一样，指令将需要作为评价者提供的指令数据的三个额外参数：

- `title` - 电影的标题
- `description` - 评价的详情
- `rating` - 电影的评分

在指令逻辑中，我们将更新存储在 `movie_review` 账户中的 `rating` 和 `description`。

虽然标题在指令函数本身中没有使用，但我们需要它来验证 `movie_review` 的账户在下一步中。

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn update_movie_review(
        ctx: Context<UpdateMovieReview>,
        title: String,
        description: String,
        rating: u8,
    ) -> Result<()> {
        msg!("电影评价账户空间已重新分配");
        msg!("标题: {}", title);
        msg!("详情: {}", description);
        msg!("评分: {}", rating);

        let movie_review = &mut ctx.accounts.movie_review;
        movie_review.rating = rating;
        movie_review.description = description;

        Ok(())
    }

}
```



接下来，让我们创建`UpdateMovieReview`结构，以定义`update_movie_review`指令所需的账户。

由于此时`movie_review`账户已经被初始化，因此我们不再需要`init`约束。然而，由于`description`的值现在可能不同，我们需要使用`realloc`约束来重新分配账户上的空间。除此之外，我们还需要`mut`、`realloc::payer`和`realloc::zero`约束。

我们仍然需要`seeds`和`bump`约束，因为在`AddMovieReview`中也有。

```rust
#[derive(Accounts)]
#[instruction(title:String, description:String)]
pub struct UpdateMovieReview<'info> {
    #[account(
        mut,
        seeds = [title.as_bytes(), initializer.key().as_ref()],
        bump,
        realloc = 8 + 32 + 1 + 4 + title.len() + 4 + description.len(),
        realloc::payer = initializer,
        realloc::zero = true,
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

请注意，`realloc`约束设置为基于`description`更新值而需要的新空间。

此外，`realloc::payer`约束指定任何所需或退还的附加lamports将来自或发送到`initializer`账户。

最后，我们将`realloc::zero`约束设置为`true`，因为`movie_review`账户可能被多次更新，无论是缩小还是扩展分配给该账户的空间。

### 5. 删除电影评论

最后，让我们实现`delete_movie_review`指令，以关闭现有的`movie_review`账户。

我们将使用上下文，其泛型类型为`DeleteMovieReview`，并且不包含任何额外的指令数据。由于我们只是关闭一个账户，事实上我们不需要在函数体内包含任何指令逻辑。关闭本身将由`DeleteMovieReview`类型中的Anchor约束处理。

```rust
#[program]
pub mod anchor_movie_review_program {
    use super::*;

		...

    pub fn delete_movie_review(_ctx: Context<DeleteMovieReview>, title: String) -> Result<()> {
        msg!("Movie review for {} deleted", title);
        Ok(())
    }

}
```

接下来，让我们实现`DeleteMovieReview`结构。

```rust
#[derive(Accounts)]
#[instruction(title: String)]
pub struct DeleteMovieReview<'info> {
    #[account(
        mut,
        seeds=[title.as_bytes(), initializer.key().as_ref()],
        bump,
        close=initializer
    )]
    pub movie_review: Account<'info, MovieAccountState>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>
}
```

在这里，我们使用`close`约束来指定我们正在关闭`movie_review`账户，并且租金应该退还到`initializer`账户。我们还为`movie_review`账户的验证包括`seeds`和`bump`约束。然后Anchor处理了安全关闭账户所需的其他逻辑。

### 6. 测试

程序应该可以运行了！现在让我们测试一下。导航到`anchor-movie-review-program.ts`并将默认的测试代码替换为以下内容。

这里我们：

- 为电影审查指令数据创建默认值
- 获取电影审查账户PDA
- 为测试创建一个占位符

```typescript
import * as anchor from "@coral-xyz/anchor"
import { Program } from "@coral-xyz/anchor"
import { expect } from "chai"
import { AnchorMovieReviewProgram } from "../target/types/anchor_movie_review_program"

describe("anchor-movie-review-program", () => {
  // 配置客户端以使用本地集群。
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace
    .AnchorMovieReviewProgram as Program<AnchorMovieReviewProgram>

  const movie = {
    title: "Just a test movie",
    description: "Wow what a good movie it was real great",
    rating: 5,
  }

  const [moviePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(movie.title), provider.wallet.publicKey.toBuffer()],
    program.programId
  )

  it("Movie review is added`", async () => {})

  it("Movie review is updated`", async () => {})

  it("Deletes a movie review", async () => {})
})
```

接下来，让我们为`addMovieReview`指令创建第一个测试。请注意，我们没有显式添加`.accounts`。这是因为`AnchorProvider`的`Wallet`会自动作为签名者包括在内，Anchor可以推断某些账户，比如`SystemProgram`，并且Anchor还可以从`title`指令参数和签名者的公钥中推断出`movieReview` PDA。

请注意：不要忘记在`Anchor.toml`文件中打开种子推断，使用`seeds = true`。

一旦指令运行，我们将获取`movieReview`账户并检查账户上存储的数据是否与预期值匹配。

```typescript
it("Movie review is added`", async () => {
  // 在这里添加你的测试。
  const tx = await program.methods
    .addMovieReview(movie.title, movie.description, movie.rating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(account.title).to.equal(movie.title)
  expect(account.rating).to.equal(movie.rating)
  expect(account.description).to.equal(movie.description)
  expect(account.reviewer.toBase58()).to.equal(provider.wallet.publicKey.toBase58())
})
```

接下来，让我们创建`updateMovieReview`指令的测试，遵循与之前相同的过程。 

```typescript
it("Movie review is updated`", async () => {
  const newDescription = "Wow this is new"
  const newRating = 4

  const tx = await program.methods
    .updateMovieReview(movie.title, newDescription, newRating)
    .rpc()

  const account = await program.account.movieAccountState.fetch(moviePda)
  expect(account.title).to.equal(movie.title)
  expect(account.rating).to.equal(newRating)
  expect(account.description).to.equal(newDescription)
  expect(account.reviewer.toBase58()).to.equal(provider.wallet.publicKey.toBase58())
})
```

接下来，创建`deleteMovieReview`指令的测试。



```typescript
it("删除电影评论", async () => {
  const tx = await program.methods
    .deleteMovieReview(movie.title)
    .rpc()
})
```

最后，运行 `anchor test`，你应该在控制台中看到以下输出。

```console
  anchor-movie-review-program
    ✔ 电影评论已添加（139毫秒）
    ✔ 电影评论已更新（404毫秒）
    ✔ 删除电影评论（403毫秒)


  3 通过（950毫秒）
```

如果你需要更多时间来熟悉这些概念，可以随时查看 [解决方案代码](https://github.com/Unboxed-Software/anchor-movie-review-program/tree/solution-pdas)，然后继续进行。

# 挑战

现在轮到你独立构建一些东西了。掌握了本课程引入的概念，尝试使用Anchor框架重新创建我们之前使用的学生介绍程序。

学生介绍程序是一个Solana程序，允许学生介绍自己。该程序使用用户的姓名和简短消息作为指示数据，并创建一个账户用于在链上存储数据。

利用你在本课程中学到的内容，构建这个程序。该程序应包括以下指示：

1. 为每个学生初始化一个PDA账户，存储学生的姓名和简短消息
2. 更新现有账户上的消息
3. 关闭现有账户

如果可以的话，尽量独立完成！但如果遇到困难，可随时参考 [解决方案代码](https://github.com/Unboxed-Software/anchor-student-intro-program)。

## 完成了实验吗？

将你的代码推送到GitHub，并[告诉我们你对这节课的想法](https://form.typeform.com/to/IPH0UGz7＃answers-lesson=f58108e9-94a0-45b2-b0d5-44ada1909105)!
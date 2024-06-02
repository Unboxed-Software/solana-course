---
title: 跨程序调用
objectives:
- 解释跨程序调用（CPI）
- 描述如何构建和使用CPI
- 解释程序如何为PDA提供签名
- 避免与CPI关联的常见陷阱和故障排除
---

# 摘要

- **跨程序调用CPI**是从一个程序调用另一个程序的特定指令的一种调用
- 使用`invoke`或`invoke_signed`命令进行CPI，后者是程序为其拥有的PDA提供签名的方式
- CPI使得Solana生态系统中的所有程序完全互操作，因为一个程序的所有公共指令都可以通过CPI被另一个程序调用
- 由于我们无法控制提交给程序的账户和数据，验证传递到CPI的所有参数以确保程序安全至关重要

# 课程

## 什么是CPI？

跨程序调用（CPI）是一个程序直接调用另一个程序。就像任何客户端都可以使用JSON RPC调用任何程序一样，任何程序都可以直接调用任何其他程序。从程序中调用另一个程序的指令的唯一要求是正确构造指令。您可以向本机程序、您创建的其他程序和第三方程序发起CPI。CPI实质上将整个Solana生态系统转化为一个可供开发人员使用的巨大API。


CPI与您习惯在客户端创建的指令具有相似的构成。具体取决于您使用`invoke`还是`invoke_signed`，可能有一些细微差别。我们稍后将介绍这两者。

## 如何进行CPI

使用`solana_program`包中的[`invoke`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke.html)或[`invoke_signed`](https://docs.rs/solana-program/1.10.19/solana_program/program/fn.invoke_signed.html)函数进行CPI。您可以使用`invoke`来基本传递进入您的程序的原始交易签名。您可以使用`invoke_signed`让您的程序为其PDA“签名”。

```rust
// 当不需要PDA的签名时使用
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult

// 当程序必须为PDA提供“签名”时使用，因此有signers_seeds参数
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

CPI将调用者的权限扩展到被调用者。如果被调用的程序处理的指令中包含一个帐户，而在传递到调用程序时被标记为签名者或可写入，那么在调用的程序中，它也将被视为签名者或可写入账户。

需要注意的是，作为开发人员，您决定要将哪些账户传递给CPI。您可以将CPI视为使用仅仅作为参数传递到您的程序的信息新建另一个指令。

### 使用`invoke`进行CPI

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &account_infos[account1.clone(), account2.clone(), account3.clone()],
)?;
```

- `program_id` - 您将要调用的程序的公钥
- `account` - 作为向量的账户元数据列表。您需要包含调用的程序将读取或写入的每个账户
- `data` - 作为向量传递给被调用程序的数据的字节缓冲区

`Instruction`类型的定义如下：

```rust
pub struct Instruction {
    pub program_id: Pubkey,
    pub accounts: Vec<AccountMeta>,
    pub data: Vec<u8>,
}
```

根据您调用的程序，可能会有一个可用于创建`Instruction`对象的辅助函数的包。许多个人和组织在其程序旁公开提供这些类型的函数的Crate库，以简化调用其程序。这类似于我们在本课程中使用的Typescript库（例如[@solana/web3.js](https://solana-labs.github.io/solana-web3.js/)，[@solana/spl-token](https://solana-labs.github.io/solana-program-library/token/js/)）。例如，在本课程的实验中，我们将使用`spl_token` Crate库来创建铸币指令。如果没有其他情况，则需要从零创建`Instruction`实例。

虽然`program_id`字段相对简单，但`accounts`和`data`字段需要一些解释。

`accounts`和`data`字段都是`Vec`类型，即向量。您可以使用[`vec`](https://doc.rust-lang.org/std/macro.vec.html)宏使用数组表示法构建向量，如:

```rust
let v = vec![1, 2, 3];
assert_eq!(v[0], 1);
assert_eq!(v[1], 2);
assert_eq!(v[2], 3);
```

`Instruction`结构的`accounts`字段预期使用[`AccountMeta`](https://docs.rs/solana-program/latest/solana_program/instruction/struct.AccountMeta.html)类型的向量。`AccountMeta`结构的定义如下：

```rust
pub struct AccountMeta {
    pub pubkey: Pubkey,
    pub is_signer: bool,
    pub is_writable: bool,
}
```

将这两个内容放在一起类似于:

```rust
use solana_program::instruction::AccountMeta;

vec![
    AccountMeta::new(account1_pubkey, true), // 用于可写、签名的帐户的元数据
    AccountMeta::read_only(account2_pubkey, false), // 用于只读、非签名的帐户的元数据
    AccountMeta::read_only(account3_pubkey, true), // 用于只读、签名的帐户的元数据
    AccountMeta::new(account4_pubkey, false), // 用于可写、非签名的帐户的元数据
]
```

指令对象的最后字段是数据，当然是字节缓冲区。您可以再次使用`vec`宏在Rust中创建字节缓冲区，该宏已实现了允许您创建某一长度的向量的函数。一旦初始化了一个空向量，您将构建字节缓冲区，方式类似于客户端端。确定被调用程序所需的数据和使用的序列化格式，并编写与之匹配的代码。欢迎在此处阅读一些[`vec`宏为您提供的功能](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#)。


```rust
let mut vec = Vec::with_capacity(3);
vec.push(1);
vec.push(2);
vec.extend_from_slice(&number_variable.to_le_bytes());
```

[`extend_from_slice`](https://doc.rust-lang.org/alloc/vec/struct.Vec.html#method.extend_from_slice) 方法可能对你来说是新的。它是一个向量上的方法，接受一个片段作为输入，对片段进行迭代，克隆每个元素，然后将其附加到`Vec`中。

### 传递账户列表

除了指令之外，`invoke`和`invoke_signed`还需要一个`account_info`对象的列表。就像你添加到指令中的`AccountMeta`对象的列表一样，你必须包括调用程序将要读取或写入的所有账户。

在调用CPI之前，你应该已经获取了传递到你的程序中的所有`account_info`对象，并将它们存储在变量中。你将通过选择这些账户中的哪些来构建CPI的`account_info`对象列表并传递它们。

你可以使用`solana_program` crate中的`account_info`结构上实现的[`Clone`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html#impl-Clone) trait来复制每个需要传递到CPI中的`account_info`对象。这个`Clone` trait返回一个[`account_info`](https://docs.rs/solana-program/1.10.19/solana_program/account_info/struct.AccountInfo.html)实例的副本。

```rust
&[first_account.clone(), second_account.clone(), third_account.clone()]
```

### 使用`invoke`执行CPI

有了指令和账户列表之后，你就可以执行对`invoke`的调用。

```rust
invoke(
    &Instruction {
        program_id: calling_program_id,
        accounts: accounts_meta,
        data,
    },
    &[account1.clone(), account2.clone(), account3.clone()],
)?;
```

在这里不需要包含签名，因为Solana运行时会传递所传入的原始签名。记住，如果需要PDA的代表签名，`invoke`就行不通了。对于这种情况，你需要使用`invoke_signed`。

### 使用`invoke_signed`执行CPI

使用`invoke_signed`有一点不同，因为这里有一个额外的字段需要提供用于派生任何必须签署交易的PDA的种子。你可能记得之前的课程中提到过，PDA不是Ed25519曲线上的点，因此没有相应的秘密密钥。你已经知道程序可以为他们的PDA提供签名，但是尚未了解如何实际进行。程序使用`invoke_signed`函数为他们的PDA提供签名。`invoke_signed`的前两个字段与`invoke`相同，但在这里有一个额外的`signers_seeds`字段。

```rust
invoke_signed(
    &instruction,
    accounts,
    &[&["第一个地址的种子"],
        &["第二个地址的第一个种子",
        "第二个地址的第二种子"]],
)?;
```

虽然PDA本身没有秘密密钥，但是程序可以使用PDA来发出包括PDA作为签署者的指令。运行时要验证调用程序是否属于该地址唯一方式是让调用程序在`signers_seeds`字段中提供用于生成地址的种子。

Solana运行时将使用提供的种子和调用程序的`program_id`内部调用 [`create_program_address`](https://docs.rs/solana-program/1.4.4/solana_program/pubkey/struct.Pubkey.html#method.create_program_address)。然后它可以将结果与指令中提供的地址进行比较。如果任何地址匹配，那么运行时就知道的确与该地址相关的程序是调用者，因此被授权成为签署者。

## 最佳实践和常见陷阱

### 安全检查

在使用CPI时，有一些关于程序安全性和弹性重要的常见错误和要记住的事情。首先要记住的是，就像我们现在所知，我们对传递给我们的程序的信息没有控制权。因此，重要的是始终验证传递到CPI的`program_id`、账户和数据。如果缺乏这些安全检查，某人可能会提交一个调用完全不同程序的指令的交易，这是不理想的。

幸运的是，在`invoke_signed`函数中标记为签署者的任何PDA的有效性都有内在的检查。在进行CPI之前，任何其他账户和`instruction_data`也应该在你的程序代码的某个位置进行验证。另外，确保你正在目标程序上执行预期的指令同样很重要。最简单的做法是读取要调用的程序的源代码，就像你从客户端构造指令一样。

### 常见错误

在执行CPI时，可能会遇到一些常见错误，它们通常意味着你正在用错误的信息构建CPI。例如，你可能会收到类似以下错误消息：

```text
EF1M4SPfKcchb6scq297y8FPCaLvj5kGjwMzjTM68wjA's signer privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

这个消息有点误导，因为“signer privilege escalated”似乎不是问题，但实际上它意味着你在签名地址时出了问题。如果使用`invoke_signed`并收到此错误，很可能是提供的种子是不正确的。你也可以找到[一个失败并显示此错误的示例交易](https://explorer.solana.com/tx/3mxbShkerH9ZV1rMmvDfaAhLhJJqrmMjcsWzanjkARjBQurhf4dounrDCUkGunH1p9M4jEwef9parueyHVw6r2Et?cluster=devnet)。

另一个类似的错误是，当一个写入的账户在`AccountMeta`结构体中没有被标记为`writable`时会抛出错误。

```text
2qoeXa9fo8xVHzd2h9mVcueh6oK3zmAiJxCTySM5rbLZ's writable privilege escalated
Program returned error: "Cross-program invocation with unauthorized signer or writable account"
```

记住，在程序执行期间可能会发生数据变化的任何账户必须指定为可写。在执行期间，对未指定为可写的账户进行写入将导致交易失败。对于程序未拥有的账户进行写入也将导致交易失败。在程序执行期间，可能会导致余额变化的任何账户必须指定为可写。在执行期间，对未指定为可写的账户进行余额变化将导致交易失败。从未由程序所拥有的账户减去余额将导致交易失败，而向任何账户增加余额是允许的，只要它是可变的。

要查看其实例，请浏览这个[explorer中的交易](https://explorer.solana.com/tx/ExB9YQJiSzTZDBqx4itPaa4TpT8VK4Adk7GU5pSoGEzNz9fa7PPZsUxssHGrBbJRnCvhoKgLCWnAycFB7VYDbBg?cluster=devnet)。

## 为什么CPI很重要？

CPI是Solana生态系统中非常重要的一项功能，它使所有部署的程序均可互操作。有了CPI，无需在开发时重复造轮子。这为在已有基础上构建新协议和应用程序创造了机会，就像搭积木或积木一样。重要的是要记住，CPI是双向的，对于您部署的任何程序都是如此！如果您构建了有用且酷炫的东西，开发者就可以在您的基础上构建新应用或将您的协议插入他们正在构建的任何东西中。可组合性是加密货币如此独特之处的重要组成部分，而CPI正是Solana上实现这一点的关键。

CPI的另一个重要方面是，它允许程序为其PDAs签名。您现在可能已经注意到，PDAs在Solana开发中被非常频繁地使用，因为它们允许程序以这样一种方式控制特定地址，即外部用户无法为这些地址生成有效签名以进行交易。这对Web3中的许多应用程序（例如DeFi、NFT等）非常有用。如果没有CPI，PDAs将不会如此有用，因为没有方法让程序对涉及它们的交易进行签名-基本上将开启黑洞模式（一旦将某物发送到PDA中，将无法再取回，没有CPI的话！）

# 实验

现在让我们通过对电影评论程序做一些增加来亲身体验CPI。如果您没有经历过之前的课程，电影评论程序允许用户提交电影评论并将其存储在PDA账户中。

上一课中，我们添加了使用PDAs对其他电影评论留下评论的功能。在本课程中，我们将努力使程序在提交评论或评论时向评论者或留言者铸造代币。

为了实现这一点，我们将不得不使用CPI调用 SPL Token Program 的 `MintTo` 指令。如果您需要对令牌、令牌铸造和新令牌的铸造进行复习，请在继续本实验之前查看[令牌程序课程](./token-program)。

### 1. 获取初始代码并添加依赖项

为了开始，我们将使用来自上一节PDA课程的电影评论程序的最终状态。因此，如果您刚完成了该课程，那么您已经准备好了。如果您刚开始，则可以放心，您可以[在此处下载初始代码](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments)。我们将使用 `solution-add-comments` 分支作为起点。

### 2. 将依赖项添加到 `Cargo.toml`

在开始之前，我们需要在 `Cargo.toml` 文件的`[dependencies]`部分下添加两个新依赖项。除了现有的依赖关系，我们还将使用 `spl-token` 和 `spl-associated-token-account` 包。

```text
spl-token = { version="~3.2.0", features = [ "no-entrypoint" ] }
spl-associated-token-account = { version="=1.0.5", features = [ "no-entrypoint" ] }
```

添加完上述内容后，在控制台中运行 `cargo check` 来让 cargo 解决您的依赖关系，并确保您已准备好继续。根据您的设置，您可能需要在继续之前修改包版本。

### 3. 将必要的账户添加到 `add_movie_review`

因为我们希望用户在创建评论时授予代币，所以在 `add_movie_review` 函数中添加铸造逻辑是有意义的。由于我们将铸造代币，因此 `add_movie_review` 指令需要传入一些新账户：

- `token_mint` - 代币的铸造地址
- `mint_auth` - 代币铸造的权限地址
- `user_ata` - 该铸造的用户关联代帐户（代币将被铸造在此处）
- `token_program` - 代币程序的地址

我们将从向函数中遍历传入的账户的地方开始添加这些新账户：

```rust
// 在 add_movie_review 中
msg!("正在添加电影评论…");
msg!("标题：{}", title);
msg!("评分：{}", rating);
msg!("描述：{}", description);

let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

新功能不需要额外的 `instruction_data`，因此无需修改数据的反序列化方式。唯一需要的是额外的账户信息。

### 4. 在 `add_movie_review` 中向评论者铸造代币

在我们开始铸造代币之前，让我们首先在文件顶部导入令牌程序的地址和常量 `LAMPORTS_PER_SOL`。

```rust
// 在 processor.rs 中
use solana_program::native_token::LAMPORTS_PER_SOL;
use spl_associated_token_account::get_associated_token_address;
use spl_token::{instruction::initialize_mint, ID as TOKEN_PROGRAM_ID};
```

现在，我们可以继续处理实际的代币铸造逻辑了！我们将把这部分添加在 `add_movie_review` 函数的最后，在返回 `Ok(())` 之前。


造币代币需要铸币机构的签名。由于程序需要能够铸造代币，因此铸币机构需要是程序可以签名的帐户。换句话说，铸币机构需要是程序拥有的PDA帐户。

我们还将构造我们的令牌铸造，使得铸造帐户是我们可以确定地派生的PDA帐户。这样我们就可以始终验证传递给程序的`token_mint`帐户是否是预期的帐户。

让我们继续使用`find_program_address`函数使用种子“token_mint”和“token_auth”分别派生令牌铸造和铸币授权地址。

```rust
// 在此处铸造代币
msg!("派生铸币授权");
let (mint_pda, _mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

接下来，我们将针对传递给程序的每个新帐户执行安全检查。始终记得验证帐户！

```rust
if *token_mint.key != mint_pda {
    msg!("错误的令牌铸币");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("传入的铸币和派生的铸币不匹配");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(initializer.key, token_mint.key) {
    msg!("错误的令牌铸币");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("错误的代币程序");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

最后，我们可以使用`invoke_signed`向令牌程序的`mint_to`函数发出CPI，使用正确的帐户。`spl_token`模块提供了一个`mint_to`辅助函数来创建铸造指令。这很棒，因为这意味着我们不必手动从头构建整个指令。相反，我们只需传递函数所需的参数。以下是函数签名：

```rust
// 在令牌程序内部，返回一个Instruction对象
pub fn mint_to(
    token_program_id: &Pubkey,
    mint_pubkey: &Pubkey,
    account_pubkey: &Pubkey,
    owner_pubkey: &Pubkey,
    signer_pubkeys: &[&Pubkey],
    amount: u64,
) -> Result<Instruction, ProgramError>
```

然后，我们提供`token_mint`，`user_ata`和`mint_auth`帐户的副本。并且，与本课程相关的是，我们提供用于查找`token_mint`地址的种子，包括增量种子。

```rust
msg!("向用户关联的代币帐户铸造10个代币");
invoke_signed(
    // 指令
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        10*LAMPORTS_PER_SOL,
    )?,
    // 帐户信息
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // 种子
    &[&[b"token_auth", &[mint_auth_bump]]],
)?;

Ok(())
```

请注意，这里我们使用`invoke_signed`而不是`invoke`。令牌程序需要`mint_auth`帐户为此交易签名。由于`mint_auth`帐户是PDA，因此只有其派生的程序可以代表其进行签名。调用`invoke_signed`时，Solana运行时使用提供的种子和增量调用`create_program_address`，然后将派生地址与提供的所有`AccountInfo`对象的地址进行比较。如果任何地址与派生地址匹配，运行时会知道匹配的帐户是该程序的PDA，并且该程序正在为该帐户签署此交易。

在这一点上，`add_movie_review`指令应该已经完全可用，并且在创建评论时将向评论者铸造十个代币。

### 5. 重复操作以添加评论

我们对`add_comment`函数的更新几乎与我们对上面的`add_movie_review`函数所做的更新相同。唯一的区别是，我们将修改用于评论的铸造代币数量，将其从十个修改为五个，以便添加评论的权重高于评论。首先，使用与`add_movie_review`函数中相同的四个额外帐户更新帐户。

```rust
// 在add_comment内部
let account_info_iter = &mut accounts.iter();

let commenter = next_account_info(account_info_iter)?;
let pda_review = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let pda_comment = next_account_info(account_info_iter)?;
let token_mint = next_account_info(account_info_iter)?;
let mint_auth = next_account_info(account_info_iter)?;
let user_ata = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
let token_program = next_account_info(account_info_iter)?;
```

接下来，移至`add_comment`函数底部，在`Ok(())`之前，派生令牌铸造和铸币授权帐户。记住，两者都是从种子“token_mint”和“token_authority”派生的PDA。

```rust
// 在此处铸造代币
msg!("派生铸币授权");
let (mint_pda, _mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
let (mint_auth_pda, mint_auth_bump) =
    Pubkey::find_program_address(&[b"token_auth"], program_id);
```

接下来，验证每个新帐户是否为正确帐户。

```rust
if *token_mint.key != mint_pda {
    msg!("错误的令牌铸币");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *mint_auth.key != mint_auth_pda {
    msg!("传入的铸币和派生的铸币不匹配");
    return Err(ReviewError::InvalidPDA.into());
}

if *user_ata.key != get_associated_token_address(commenter.key, token_mint.key) {
    msg!("错误的令牌铸币");
    return Err(ReviewError::IncorrectAccountError.into());
}

if *token_program.key != TOKEN_PROGRAM_ID {
    msg!("错误的代币程序");
    return Err(ReviewError::IncorrectAccountError.into());
}
```

最后，使用`invoke_signed`将`mint_to`指令发送到令牌程序，向评论者发送五个代币。


```rust
msg!("向用户关联的代币账户铸造5个代币");
invoke_signed(
    // 指令
    &spl_token::instruction::mint_to(
        token_program.key,
        token_mint.key,
        user_ata.key,
        mint_auth.key,
        &[],
        5 * LAMPORTS_PER_SOL,
    )?,
    // 账户信息
    &[token_mint.clone(), user_ata.clone(), mint_auth.clone()],
    // 种子
    &[&[b"token_auth", &[mint_auth_bump]]],
)?;

Ok(())
```

### 6. 设置代币铸造

我们已经编写了所有需要的代码，用于向评论者和评论添加代币，但所有这些都假设在使用种子“token_mint”生成的PDA上存在一个代币铸造。为使其正常工作，我们将设置一个额外的指令，用于初始化代币铸造。它将被设计成只能调用一次，由谁调用并不特别重要。

鉴于在本课程中我们已经多次强调了与PDA和CPI相关的所有概念，我们将通过对比之前的步骤来简单地讲解此部分。首先，在`instruction.rs`文件中的`MovieInstruction`枚举中添加第四个指令变量。

```rust
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String,
    },
    AddComment {
        comment: String,
    },
    InitializeMint,
}
```

请务必在同一文件中的`unpack`函数的`match`语句中，将其添加到`variant 3`下。

```rust
impl MovieInstruction {
    // ...
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // ...
        Ok(match variant {
            // ...
            3 => Self::InitializeMint,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
```

在`processor.rs`文件中的`process_instruction`函数中，将新指令添加到`match`语句中，并调用`initialize_token_mint`函数。

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        // ...
        MovieInstruction::InitializeMint => initialize_token_mint(program_id, accounts),
    }
}
```

最后，声明和实现`initialize_token_mint`函数。此函数将派生代币铸造和铸造权限的PDA，创建代币铸造账户，然后初始化代币铸造。我们不会详细解释所有这些，但值得阅读代码，特别是考虑到代币铸造和初始化都涉及CPI。同样，如果您需要复习有关代币和铸造的知识，请参阅[代币程序课程](./token-program)。

```rust
pub fn initialize_token_mint(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let mint_auth = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let sysvar_rent = next_account_info(account_info_iter)?;

    let (mint_pda, mint_bump) = Pubkey::find_program_address(&[b"token_mint"], program_id);
    let (mint_auth_pda, _mint_auth_bump) =
        Pubkey::find_program_address(&[b"token_auth"], program_id);

    msg!("代币铸造：{:?}", mint_pda);
    msg!("铸造权限：{:?}", mint_auth_pda);

    if mint_pda != *token_mint.key {
        msg!("错误的代币铸造账户");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *token_program.key != TOKEN_PROGRAM_ID {
        msg!("错误的代币程序");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    if *mint_auth.key != mint_auth_pda {
        msg!("错误的铸造权限账户");
        return Err(ReviewError::IncorrectAccountError.into());
    }

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(82);

    invoke_signed(
        &system_instruction::create_account(
            initializer.key,
            token_mint.key,
            rent_lamports,
            82,
            token_program.key,
        ),
        &[
            initializer.clone(),
            token_mint.clone(),
            system_program.clone(),
        ],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Created token mint account");

    invoke_signed(
        &initialize_mint(
            token_program.key,
            token_mint.key,
            mint_auth.key,
            Option::None,
            9,
        )?,
        &[token_mint.clone(), sysvar_rent.clone(), mint_auth.clone()],
        &[&[b"token_mint", &[mint_bump]]],
    )?;

    msg!("Initialized token mint");

    Ok(())
}
```

### 7. 构建和部署

现在我们已经准备好构建和部署我们的程序了！您可以通过运行 `cargo build-bpf` 来构建程序，然后运行返回的命令，它应该类似于 `solana program deploy <PATH>`。

在开始测试添加评论是否会发送代币之前，您需要初始化程序的代币铸造。您可以使用[此脚本](https://github.com/Unboxed-Software/solana-movie-token-client)来完成。一旦克隆了该存储库，请将 `index.ts` 中的 `PROGRAM_ID` 替换为您程序的ID。然后运行 `npm install` 然后运行 `npm start`。该脚本假设您正在部署到Devnet。如果您在本地部署，那么请相应地调整脚本。

一旦初始化了您的代币铸造，可以使用[电影评论前端](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-tokens)来测试添加评论。同样，代码假设您在Devnet上，所以请相应地行事。

提交评论后，您应该在您的钱包中看到10枚新代币！当您添加评论时，您应该收到5枚代币。它们不会有华丽的名称或图像，因为我们没有为代币添加任何元数据，但您可以理解这个概念。

如果您需要更多时间来学习此课程中的概念，或者在途中遇到困难，请随时[查看解决方案代码](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-tokens)。请注意，此实验的解决方案在`solution-add-tokens`分支上。

# 挑战

为了应用您在本课程中所学的CPI的知识，思考一下您如何将它们融入到学生介绍程序中。您可以做类似于我们在实验中的操作，当用户介绍自己时，为他们添加一些铸造代币的功能。或者，如果您感到非常雄心勃勃，可以考虑如何将课程中所学的所有知识结合起来，从头开始创建全新的东西。

一个很好的例子是构建一个去中心化的堆栈溢出。该程序可以使用代币来确定用户的整体评级，在问题被正确回答时铸造代币，允许用户给答案投票等。所有这些都是可能的，而您现在具备了独立去构建类似于此的东西所需的技能和知识！

恭喜您完成了第 4 模块！随时[分享一些快速反馈意见](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%204)，以便我们不断改进课程。


## 完成实验了吗？

将您的代码推送到 GitHub 并[告诉我们您对这堂课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=ade5d386-809f-42c2-80eb-a6c04c471f53)!

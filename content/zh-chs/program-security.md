---
title: 创建基础程序，第3部分 - 基本的安全和验证
objectives:
- 解释“像攻击者一样思考”的重要性
- U了解基本的安全实践
- 执行所有者检查
- P执行签名者检查
- 验证传递到程序中的帐户
- 进行基本数据验证
---

# TL;DR

- **像攻击者一样思考** 意味着提出问题：“我怎么破坏这个？”
- 执行**所有者检查**以确保提供的帐户由您期望的公钥拥有，例如确保您期望为 PDA 的帐户由 `program_id` 拥有
- 执行**签名者检查**以确保任何帐户修改都是由正确的一方或多方签名的
- **帐户验证** 包括确保提供的帐户是您期望的帐户，例如使用期望的种子派生 PDA，以确保地址与提供的帐户匹配
- **数据验证** 包括确保提供的任何数据符合程序所需的标准

# 概述

在最近的两节课中，我们一起构建了一个电影评论程序。最终结果相当不错！在新的开发环境中让某些东西运行起来确实令人兴奋。

然而，正确的程序开发并不仅仅止步于“让它运行起来”。重要的是要仔细考虑代码中可能出现的失败点，以便加以修正。失败点是您的代码可能发生不合预期行为的地方。无论不合预期行为是由用户以意外的方式与您的程序交互，还是由恶意行为者故意尝试利用您的程序引起的，预见失败点对于安全的程序开发至关重要。

请记住，**一旦部署，您无法控制将发送到您的程序的交易**。您只能控制您的程序如何处理它们。虽然这节课远不能涵盖程序安全的全面概述，但我们将涉及一些基本的需要注意的陷阱。

## 像攻击者一样思考

[Neodyme](https://workshop.neodyme.io/) 在 Breakpoint 2021 上进行了题为 "Think Like An Attacker: Bringing Smart Contracts to Their Break(ing) Point" 的演讲。如果有一件事您从这节课中学到的，那就是您应该像攻击者一样思考。

当然，在这节课中，我们无法涵盖可能发生在您的程序中的所有问题。最终，每个程序都将与不同的安全风险相关联。虽然了解常见陷阱对于编写良好的程序至关重要，但对于部署安全程序来说，这是不够的。为了实现最广泛的安全覆盖范围，您必须用正确的思维方式来编写代码。

正如 Neodyme 在他们的演讲中提到的，正确的思维方式需要从问题 "这是坏的吗？" 转变为 "我怎么破坏这个？"。这是理解您的代码 *实际上做了什么* 而不是您写代码时希望它做什么的第一步，也是最关键的一步。

### 所有程序都可以被破坏

这不是一个“是否”的问题。

相反，这是一个“需要多少努力和奉献”的问题。

作为开发者，我们的工作是尽力封闭尽可能多的漏洞，并增加破坏我们代码所需的努力和奉献。例如，在过去两节课中我们一起构建的电影评论程序中，我们编写了代码来创建新的帐户以存储电影评论。然而，如果我们仔细查看代码，我们会注意到程序也促使了很多我们可以轻松捕捉到的意外行为，只需问一下“我怎么破坏这个？”我们将在这节课中深入探讨其中一些问题以及如何修复它们，但请记住，记住一些陷阱是不够的。你需要改变对安全的思维方式。

## 错误处理

在我们深入探讨一些常见的安全陷阱以及如何避免它们之前，了解如何在程序中使用错误是非常重要的。尽管您的代码可以优雅地处理一些问题，但其他问题将要求您的程序停止执行并返回程序错误。

### 如何创建错误

虽然 `solana_program` crate 提供了一个包含我们可以使用的一系列通用错误的 `ProgramError` 枚举，但通常创建自己的错误会更有用。您的自定义错误能够在调试代码时提供更多上下文和细节。

我们可以通过创建一个列出我们想使用的错误的枚举类型来定义自己的错误。例如，`NoteError` 包含 `Forbidden` 和 `InvalidLength` 变体。通过使用 `derive` 属性宏来实现 `thiserror` 库中的 `Error` trait，将该枚举转换为 Rust 的 `Error` 类型。每个错误类型还有自己的 `#[error("...")]` 注释。这样，您可以为每个特定的错误类型提供一个错误消息。

```rust
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Error)]
pub enum NoteError {
    #[error("Wrong note owner")]
    Forbidden,

    #[error("Text is too long")]
    InvalidLength,
}
```

### 如何返回错误

编译器期望程序返回的错误类型是来自 `solana_program` crate 的 `ProgramError` 类型。这意味着除非我们有一种将其转换为这种类型的方法，否则我们将无法返回我们的自定义错误。下面的实现处理了我们自定义错误和 `ProgramError` 类型之间的转换。

```rust
impl From<NoteError> for ProgramError {
    fn from(e: NoteError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

要从程序返回自定义错误，只需使用 `into()` 方法将错误转换为 `ProgramError` 的实例。

```rust
if pda != *note_pda.key {
    return Err(NoteError::Forbidden.into());
}
```

## 基本安全检查

虽然这些不能全面确保您的程序安全，但以下是一些安全检查，可以填补代码中的一些较大的漏洞：

- 所有权检查（Owership checks） - 用于验证帐户是否由程序拥有
- 签名者检查（Signer checks） - 用于验证帐户是否已签署交易
- 通用帐户验证（General Account Validator） - 用于验证帐户是否是预期的帐户
- 数据验证（Data Validation） - 用于验证用户提供的输入

### 所有权检查

所有权检查验证帐户是否由预期的公钥拥有。让我们使用我们在之前课程中引用的记笔记应用示例。在这个应用中，用户可以在程序中创建、更新和删除存储在 PDA 账户中的笔记。

当用户调用 `update` 指令时，他们还会提供一个 `pda_account`。我们假设提供的 `pda_account` 是他们想要更新的特定笔记的帐户，但用户可以输入任何他们想要的指令数据。他们甚至可能发送与笔记账户的数据格式匹配但并非由记笔记程序创建的数据。这种安全漏洞是引入恶意代码的一种潜在方式。

避免此问题的最简单方法是始终检查帐户的所有者是否是您期望的公钥。在这种情况下，我们期望笔记账户是由程序本身拥有的 PDA 账户。当情况不符合预期时，我们可以相应地报告为错误。

```rust
if note_pda.owner != program_id {
    return Err(ProgramError::InvalidNoteAccount);
}
```

作为一种附带说明，尽可能使用 PDA 是比信任由交易签署者拥有的外部拥有的账户更安全的做法。程序完全控制的唯一账户是PDA账户，这使它们成为最安全的账户。

### 签名者检查

签名者检查简单地验证了正确的当事人进行了交易的签名。在记笔记应用中，例如，我们希望在处理 `update` 指令之前验证笔记创建者是否签署了该交易。否则，任何人都可以通过将用户的公钥作为 `initializer` 简单地传递，从而更新另一个用户的笔记。

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### 通用帐户验证

除了检查账户的签署者和所有者外，确保提供的帐户与您的代码期望的相符也是很重要的。例如，您希望验证提供的 PDA 账户的地址是否可以使用预期的种子派生。这确保了它是您期望的帐户。

在记笔记应用的例子中，这意味着确保您可以使用笔记创建者的公钥和 ID 作为种子派生出匹配的PDA（我们假设在创建笔记时使用了这些种子）。这样用户就不能意外地为错误的笔记传递一个PDA账户，更重要的是，用户不能传递一个代表其他用户完全不同笔记的PDA账户。

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);

if pda != *note_pda.key {
    msg!("Invalid seeds for PDA");
    return Err(ProgramError::InvalidArgument)
}
```

## 数据验证

类似于验证帐户，您还应验证客户端提供的任何数据。

例如，您可能有一个游戏程序，用户可以将角色属性点分配给各种类别。您可能在每个类别中设置了最大限制为 100，在这种情况下，您将希望验证现有点数分配加上新的分配是否超过了最大限制。

```rust
if character.agility + new_agility > 100 {
    msg!("Attribute points cannot exceed 100");
    return Err(AttributeError::TooHigh.into())
}
```

或者，角色可能有一个他们可以分配的属性点限制，您希望确保他们不超过该限制。

```rust
if attribute_allowance < new_agility {
    msg!("Trying to allocate more points than allowed");
    return Err(AttributeError::ExceedsAllowance.into())
}
```

没有这些检查，程序的行为可能会与您的预期不同。然而，在某些情况下，这不仅仅是未定义行为的问题。有时，未能验证数据可能导致金融上毁灭性的安全漏洞。

例如，想象一下在这些示例中引用的角色是一个 NFT。进一步想象，该程序允许将 NFT 质押以赚取与 NFT 属性点数量成比例的代币奖励。未能实施这些数据验证检查将允许恶意行为者分配过高数量的属性点，并迅速耗尽您的资金池中原本应该更均匀分布在更大的质押者群体中的所有奖励。这可能对您的财务造成巨大损失。

### 整数溢出和下溢

Rust 整数具有固定的大小。这意味着它们只能支持特定范围的数字。导致结果值超出或低于范围支持的范围的算术操作将导致结果值循环。例如，`u8` 仅支持数字 0-255，因此相加的结果如果是256，实际上会变成 0，257 会变成 1，依此类推。

这一点始终值得牢记，尤其是在处理代表真实值的任何代码时，比如存入和取出代币。

为避免整数溢出和下溢，可以采取以下方法之一：

1. 设置逻辑确保溢出或下溢 *不会* 发生，或者
2. 使用 `checked_add` 而不是 `+` 等检查数学操作。

```rust
let first_int: u8 = 5;
let second_int: u8 = 255;
let sum = first_int.checked_add(second_int);
```

# 实验

让我们一起练习之前课程中已经完成的电影评论程序。如果您没有完成上一课程也没关系，您应该可以跟上这节课。

作为复习，电影评论程序允许用户在 PDA 账户中存储电影评论。上一节课，我们完成了添加电影评论的基本功能。现在，我们将在已经创建的功能上添加一些安全检查，并以安全的方式添加更新电影评论的功能。

与之前一样，我们将使用 [Solana Playground](https://beta.solpg.io/) 来编写、构建和部署我们的代码。

## 1. 获取起始代码

首先，您可以找到[电影评论的起始代码](https://beta.solpg.io/62b552f3f6273245aca4f5c9)。如果您一直在参与电影评论实验，您会注意到我们已对程序进行了重构。

重构后的起始代码几乎与之前相同。由于 `lib.rs` 变得相当庞大且难以处理，我们将其代码分为三个文件：`lib.rs`，`entrypoint.rs` 和 `processor.rs`。`lib.rs` 现在*仅*注册代码的模块，`entrypoint.rs` *仅*定义和设置程序的入口点，而 `processor.rs` 则处理指令的程序逻辑。我们还添加了一个 `error.rs` 文件，用于定义自定义错误。完整的文件结构如下：

- **lib.rs** - 注册模块
- **entrypoint.rs** - 程序入口点
- **instruction.rs** - 序列化和反序列化指令数据
- **processor.rs** - 处理指令的程序逻辑
- **state.rs** - 序列化和反序列化状态
- **error.rs** - 自定义程序错误

除了文件结构的一些更改之外，我们还更新了少量代码，使这个实验更加专注于安全性，而不让您写不必要的模板代码。

由于我们将允许更新电影评论，我们还在 `add_movie_review` 函数（现在位于 `processor.rs` 中）中更改了 `account_len`。现在，我们不再计算评论的大小并将账户长度设置为所需的大小，而是简单地为每个评论账户分配 1000 字节。这样，当用户更新其电影评论时，我们不必担心重新分配大小或重新计算租金。

我们以前是这样：

```rust
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
```

现修改为这样：

```rust
let account_len: usize = 1000;
```

`realloc` 方法是最近由 Solana Labs 启用的，它允许您动态更改账户的大小。在这个实验中，我们将不使用这个方法，但这是值得注意的一点。

最后，在 `state.rs` 中，我们还使用 `impl` 关键字为我们的 `MovieAccountState` 结构实现了一些额外的功能。

对于我们的电影评论，我们希望能够检查一个账户是否已经初始化。为此，我们创建了一个 `is_initialized` 函数，该函数检查 `MovieAccountState` 结构中的 `is_initialized` 字段。

`Sealed` 是 Solana 版的 Rust 的 `Sized` 特征。这只是指定 `MovieAccountState` 有一个已知的大小，并提供了一些编译器优化。

```rust
// inside state.rs
impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

在继续之前，请确保您对程序的当前状态有牢固的掌握。查看代码并花一些时间思考对您来说可能令人困惑的任何地方。将起始代码与[上一课的解决方案代码](https://beta.solpg.io/62b23597f6273245aca4f5b4)进行比较可能会有所帮助。

## 2. 自定义错误

让我们首先编写我们的自定义程序错误。我们将需要在以下情况使用这些错误：

- 在尚未初始化的账户上调用了更新指令
- 提供的 PDA 与预期的或派生的 PDA 不匹配
- 输入数据超过了程序允许的大小
- 提供的评分不在 1-5 的范围内

起始代码中包含一个空的`error.rs`文件。打开该文件，并为上述每种情况添加错误。

```rust
// inside error.rs
use solana_program::{program_error::ProgramError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ReviewError{
    // Error 0
    #[error("Account not initialized yet")]
    UninitializedAccount,
    // Error 1
    #[error("PDA derived does not equal PDA passed in")]
    InvalidPDA,
    // Error 2
    #[error("Input data exceeds max length")]
    InvalidDataLength,
    // Error 3
    #[error("Rating greater than 5 or less than 1")]
    InvalidRating,
}

impl From<ReviewError> for ProgramError {
    fn from(e: ReviewError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

请注意，除了添加错误情况，我们还添加了让我们根据需要将错误转换为 `ProgramError` 类型的实现。

在继续之前，让我们在 `processor.rs` 中引入 `ReviewError`，我们将在不久的将来在添加安全检查时使用这些错误。

```rust
// inside processor.rs
use crate::error::ReviewError;
```

## 3. 在 `add_movie_review` 中添加安全检查

既然我们有了可用的错误，让我们给 `add_movie_review` 函数加入一些安全检查。

### 签名者检查

我们首先要做的是确保评价的 `initializer` 也是交易的签名者。这可以确保您不能以他人的身份提交电影评价。我们将在迭代账户之后立即进行这个检查。

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;

if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### 账户验证

接下来，让我们确保用户传入的 `pda_account` 是我们期望的 `pda`。回想一下，我们使用 `initializer` 和 `title` 作为种子来派生电影评价的 `pda`。在我们的指令中，我们将再次派生 `pda`，然后检查它是否与 `pda_account` 匹配。如果地址不匹配，我们将返回我们自定义的 `InvalidPDA` 错误。

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### 数据验证

现在让我们进行一些数据验证。

我们首先要确保 `rating` 在 1 到 5 的范围内。如果用户提供的评分超出此范围，我们将返回我们自定义的 `InvalidRating` 错误。

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}
```

接下来，让我们检查评论的内容是否超过我们为账户分配的 1000 字节。如果大小超过 1000 字节，我们将返回我们自定义的 `InvalidDataLength` 错误。

```rust
let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

最后，让我们通过调用我们为 `MovieAccountState` 实现的 `is_initialized` 函数来检查账户是否已经初始化。如果账户已存在，我们将返回一个错误。

```rust
if account_data.is_initialized() {
    msg!("Account already initialized");
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

所有的加在一起，`add_movie_review` 函数应该如下所示：

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Adding movie review...");
    msg!("Title: {}", title);
    msg!("Rating: {}", rating);
    msg!("Description: {}", description);

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ProgramError::InvalidArgument)
    }

    if rating > 5 || rating < 1 {
        msg!("Rating cannot be higher than 5");
        return Err(ReviewError::InvalidRating.into())
    }

    let total_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());
    if total_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    let account_len: usize = 1000;

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    invoke_signed(
        &system_instruction::create_account(
        initializer.key,
        pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[initializer.clone(), pda_account.clone(), system_program.clone()],
        &[&[initializer.key.as_ref(), title.as_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("PDA created: {}", pda);

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("borrowed account data");

    msg!("checking if movie account is already initialized");
    if account_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    account_data.title = title;
    account_data.rating = rating;
    account_data.description = description;
    account_data.is_initialized = true;

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 4. 在 `MovieInstruction` 中支持电影评价更新

既然 `add_movie_review` 更安全了，让我们把注意力转向支持更新电影评价的功能。

我们将从更新 `instruction.rs` 开始。首先，我们将在 `MovieInstruction` 中添加一个 `UpdateMovieReview` 变体，其中包含新标题、评分和描述的嵌入数据。

```rust
// inside instruction.rs
pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    },
    UpdateMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}
```

嵌入的结构体可以保持不变，因为除了变体类型之外，指令数据与我们用于 `AddMovieReview` 的相同。

最后，在 `unpack` 函数中，我们需要在 match 语句中添加 `UpdateMovieReview`。

```rust
// inside instruction.rs
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            1 => Self::UpdateMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

## 5. 定义 `update_movie_review` 函数

既然我们可以解包我们的 `instruction_data` 并确定程序要运行的指令，我们可以将 `UpdateMovieReview` 添加到 `processor.rs` 文件中的 `process_instruction` 函数的 match 语句中。

```rust
// inside processor.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // unpack instruction data
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        // add UpdateMovieReview to match against our new data structure
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            // make call to update function that we'll define next
            update_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

接下来，我们可以定义新的 `update_movie_review` 函数。该定义应该与 `add_movie_review` 的定义具有相同的参数。

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

}
```

## 6. 实现 `update_movie_review` 函数

现在剩下的就是填写更新电影评论的逻辑。只是让我们从一开始就确保它是安全的。

与 `add_movie_review` 函数一样，让我们从迭代账户开始。我们只需要前两个账户：`initializer` 和 `pda_account`。

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    // Get Account iterator
    let account_info_iter = &mut accounts.iter();

    // Get accounts
    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

}
```

### 所有权检查

在继续之前，让我们实现一些基本的安全检查。我们将首先对 `pda_account` 进行所有权检查，以验证它是否由我们的程序拥有。如果不是，我们将返回一个 `InvalidOwner` 错误。

```rust
if pda_account.owner != program_id {
    return Err(ProgramError::InvalidOwner)
}
```

### 签名者检查

接下来，让我们进行签名者检查，以验证更新指令的 `initializer` 也已签署了交易。由于我们正在更新电影评价的数据，我们希望确保评价的原始 `initializer` 已通过签署交易批准了更改。如果 `initializer` 没有签署交易，我们将返回一个错误。

```rust
if !initializer.is_signer {
    msg!("Missing required signature");
    return Err(ProgramError::MissingRequiredSignature)
}
```

### 账户验证

接下来，让我们通过使用 `initializer` 和 `title` 作为种子来派生 PDA，检查用户传入的 `pda_account` 是否是我们期望的 PDA。如果地址不匹配，我们将返回我们自定义的 `InvalidPDA` 错误。我们将以与 `add_movie_review` 函数相同的方式实现这一点。

```rust
// Derive PDA and check that it matches client
let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);

if pda != *pda_account.key {
    msg!("Invalid seeds for PDA");
    return Err(ReviewError::InvalidPDA.into())
}
```

### 解包 `pda_account` 并进行数据验证

既然我们的代码确保我们可以信任传入的账户，让我们解包 `pda_account` 并进行一些数据验证。我们将从解包 `pda_account` 并将其赋给一个可变变量 `account_data` 开始。

```rust
msg!("unpacking state account");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("borrowed account data");
```

既然我们可以访问账户及其字段，我们首先需要做的是验证该账户是否已经初始化。未初始化的账户不能被更新，因此程序应该返回我们自定义的 `UninitializedAccount` 错误。

```rust
if !account_data.is_initialized() {
    msg!("Account is not initialized");
    return Err(ReviewError::UninitializedAccount.into());
}
```

接下来，我们需要像在 `add_movie_review` 函数中一样验证 `rating`、`title` 和 `description` 数据。我们希望将 `rating` 限制在 1 到 5 的范围内，并将评论的总体大小限制在 1000 字节以下。如果用户提供的评分超出此范围，我们将返回我们自定义的 `InvalidRating` 错误。如果评论太长，那么我们将返回我们自定义的 `InvalidDataLength` 错误。

```rust
if rating > 5 || rating < 1 {
    msg!("Rating cannot be higher than 5");
    return Err(ReviewError::InvalidRating.into())
}

let total_len: usize = 1 + 1 + (4 + account_data.title.len()) + (4 + description.len());
if total_len > 1000 {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into())
}
```

### 更新电影评价账户

现在我们已经实现了所有安全检查，我们最终可以通过更新 `account_data` 并重新序列化它来更新电影评论账户。在这一点上，我们可以从我们的程序中返回 `Ok`。

```rust
account_data.rating = rating;
account_data.description = description;

account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;

Ok(())
```

全在一起，`update_movie_review` 函数应该如下所示的代码片段。我们为可以清晰地调试包含了一些额外的日志。

```rust
pub fn update_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {
    msg!("Updating movie review...");

    let account_info_iter = &mut accounts.iter();

    let initializer = next_account_info(account_info_iter)?;
    let pda_account = next_account_info(account_info_iter)?;

    if pda_account.owner != program_id {
      return Err(ProgramError::IllegalOwner)
    }

    if !initializer.is_signer {
        msg!("Missing required signature");
        return Err(ProgramError::MissingRequiredSignature)
    }

    msg!("unpacking state account");
    let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
    msg!("review title: {}", account_data.title);

    let (pda, _bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), account_data.title.as_bytes().as_ref(),], program_id);
    if pda != *pda_account.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    msg!("checking if movie account is initialized");
    if !account_data.is_initialized() {
        msg!("Account is not initialized");
        return Err(ReviewError::UninitializedAccount.into());
    }

    if rating > 5 || rating < 1 {
        msg!("Invalid Rating");
        return Err(ReviewError::InvalidRating.into())
    }

    let update_len: usize = 1 + 1 + (4 + description.len()) + account_data.title.len();
    if update_len > 1000 {
        msg!("Data length is larger than 1000 bytes");
        return Err(ReviewError::InvalidDataLength.into())
    }

    msg!("Review before update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    account_data.rating = rating;
    account_data.description = description;

    msg!("Review after update:");
    msg!("Title: {}", account_data.title);
    msg!("Rating: {}", account_data.rating);
    msg!("Description: {}", account_data.description);

    msg!("serializing account");
    account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
    msg!("state account serialized");

    Ok(())
}
```

## 7. 构建和升级

我们已经准备好构建和升级我们的程序了！您可以通过提交具有正确指令数据的交易来测试您的程序。为此，请随意使用此 [前端](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews)。请记住，为了确保您正在测试正确的程序，您需要在 `Form.tsx` 和 `MovieCoordinator.ts` 中用您的程序 ID 替换 `MOVIE_REVIEW_PROGRAM_ID`。

如果您需要更多时间来熟悉这些概念，请在继续之前查看 [解决方案代码](https://beta.solpg.io/62c8c6dbf6273245aca4f5e7)。

# 挑战

现在轮到您独立构建一些东西了，可以在之前课程中使用的学生介绍程序的基础上构建。如果您没有一直跟进或没有保存之前的代码，请随时使用 [这个起始代码](https://beta.solpg.io/62b11ce4f6273245aca4f5b2)。

学生介绍程序是一个 Solana 程序，允许学生介绍自己。该程序将用户的姓名和简短介绍作为 instruction_data，并创建一个账户将数据存储在链上。

使用您在本课程中学到的知识，尝试将这些知识应用到学生介绍程序。该程序应该：

1. 添加一个指令，允许学生更新他们的消息。
2. 实现我们在本课程中学到的基本安全检查。

如果可能的话，请尝试独立完成！但是如果遇到困难，请随时参考 [解决方案代码](https://beta.solpg.io/62c9120df6273245aca4f5e8)。请注意，根据您实现的检查和编写的错误，您的代码可能与解决方案代码略有不同。完成第三模块后，我们很想了解更多关于您的经验！随时 [分享一些快速反馈](https://airtable.com/shrOsyopqYlzvmXSC?prefill_Module=Module%203)，以便我们能够持续改进课程。

## 完成了实验吗？

将您的代码推送到 GitHub，并[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=3dfb98cc-7ba9-463d-8065-7bdb1c841d43)！
---
title: PDAs
objectives:
- 解释程序派生地址（PDAs）
- 解释PDAs的各种用途
- 描述PDAs如何派生
- 使用PDA推导来定位和检索数据
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

- **程序派生地址**（PDA）是从**程序ID**和可选的**种子列表**派生出来的
- PDAs由其派生自的程序所拥有和控制
- PDA的派生提供了一种确定性的方式，以种子为基础查找数据
- 种子可以用于映射到存储在单独PDA账户中的数据
- 一个程序可以代表由其ID派生的PDA签署指令

# 课程

## 什么是程序派生地址？

程序派生地址（PDAs）是设计供程序签署而不是使用密钥签署的账户地址。正如名称所示，PDAs是使用程序ID派生的。可选地，这些派生账户也可以使用ID以及一组“种子”来找到。稍后会详细介绍，但这些种子在我们使用PDAs进行数据存储和检索时将发挥重要作用。

PDAs具有两个主要功能：

1. 为程序提供一种确定的方式来查找给定的数据项
2. 授权派生PDA的程序代表其签署，就像用户可以使用他们的密钥签署一样

在本课程中，我们将重点介绍使用PDAs来查找和存储数据。在我们涵盖跨程序调用（CPIs）的未来课程中，我们将更深入地讨论使用PDA签名。

## 查找PDAs

PDAs从技术上并非是创建的。而是基于程序ID和一个或多个输入种子“找到”或“派生”的。

Solana密钥对可以在称为Ed25519椭圆曲线（Ed25519）的地方找到。Ed25519是Solana用来生成相应的公钥和私钥的确定性签名方案。一起，我们称这些密钥对。

相反，PDAs是地址，位于Ed25519曲线之外。这意味着PDAs不是公钥，也没有私钥。PDAs的这一特性对于程序能够代表其签署是至关重要的，但是我们将在未来课程中讨论这一点。

在Solana程序中查找PDA，我们将使用`find_program_address`函数。该函数使用可选的“种子”列表和程序ID作为输入，然后返回PDA和一个颠覆种子。

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[user.key.as_ref(), user_input.as_bytes().as_ref(), "SEED".as_bytes()], program_id)
```

### 种子

“种子”是`find_program_address`函数中用于派生PDA的可选输入。例如，种子可以是由用户提供的任何组合：公钥、用户提供的输入或硬编码值。PDA也可以只使用程序ID而没有额外的种子来派生。然而，使用种子来找到我们的PDAs允许我们创建程序可以拥有任意数量的账户。

虽然您作为开发者确定要传递给`find_program_address`函数的种子，但函数本身提供了一个名为“颠覆种子”的附加种子。用于派生PDA的密码函数大约50%的时间会得到一个位于Ed25519曲线上的密钥。为确保结果不位于Ed25519曲线上，并且因此没有私钥，`find_program_address`函数会添加一个称为颠覆种子的数字种子。

该函数从值`255`开始为“颠覆种子”，然后检查输出是否是有效的PDA。如果结果不是有效的PDA，则减少颠覆种子并再次尝试（`255`，`254`，`253`等）。一旦找到有效的PDA，函数会返回PDA和用于派生PDA的颠覆种子。

### `find_program_address`幕后工作

让我们来看一下`find_program_address`的源代码。

```rust
pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Self::try_find_program_address(seeds, program_id)
        .unwrap_or_else(|| panic!("Unable to find a viable program address bump seed"))
}
```

在幕后，`find_program_address`函数将输入的`seeds`和`program_id`传递给`try_find_program_address`函数。

`try_find_program_address`函数然后引入了“颠覆种子”。颠覆种子是一个值在0到255之间变化的`u8`变量。从255开始的降序范围迭代，将颠覆种子添加到可选输入种子中，然后传递到`create_program_address`函数。如果`create_program_address`的输出不是有效的PDA，则减少“颠覆种子”，循环继续直到找到有效的PDA。

```rust
pub fn try_find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> Option<(Pubkey, u8)> {

    let mut bump_seed = [std::u8::MAX];
    for _ in 0..std::u8::MAX {
        {
            let mut seeds_with_bump = seeds.to_vec();
            seeds_with_bump.push(&bump_seed);
            match Self::create_program_address(&seeds_with_bump, program_id) {
                Ok(address) => return Some((address, bump_seed[0])),
                Err(PubkeyError::InvalidSeeds) => (),
                _ => break,
            }
        }
        bump_seed[0] -= 1;
    }
    None

}
```

`create_program_address`函数执行一系列散列操作，计算出一个密钥，然后验证计算出的密钥是否位于Ed25519椭圆曲线上。如果找到有效的PDA（即*不*位于曲线上的地址），则返回PDA。否则返回错误。

```rust
pub fn create_program_address(
    seeds: &[&[u8]],
    program_id: &Pubkey,
) -> Result<Pubkey, PubkeyError> {

    let mut hasher = crate::hash::Hasher::default();
    for seed in seeds.iter() {
        hasher.hash(seed);
    }
    hasher.hashv(&[program_id.as_ref(), PDA_MARKER]);
    let hash = hasher.result();

    if bytes_are_curve_point(hash) {
        return Err(PubkeyError::InvalidSeeds);
    }

    Ok(Pubkey::new(hash.as_ref()))

}
```



总之，`find_program_address`函数将我们的输入种子和`program_id`传递给`try_find_program_address`函数。`try_find_program_address`函数将一个`bump_seed`（从255开始）加到我们的输入种子中，然后调用`create_program_address`函数，直到找到一个有效的PDA。找到后，返回PDA和`bump_seed`。

请注意，对于相同的输入种子，不同的有效bumps会生成不同的有效PDAs。`find_program_address`返回的`bump_seed`将始终是找到的第一个有效PDA。因为该函数从255的`bump_seed`值开始迭代降至零，最终返回的`bump_seed`将始终是可能的最大有效8位值。这个`bump_seed`通常被称为“*canonical bump*”。为了避免混淆，建议只使用规范的bump，并且*始终验证程序传入的每个PDA*。

需要强调的一点是，`find_program_address`函数只返回一个由程序衍生的地址和使用的bump_seed。`find_program_address`函数*不*初始化新账户，函数返回的任何PDA也不一定与存储数据的账户相关联。

## 使用PDA账户存储数据

由于程序本身是无状态的，程序状态是通过外部账户进行管理的。鉴于可以使用种子进行映射，并且程序可以代表自己签名，使用PDA账户存储与程序相关的数据是一种极为常见的设计选择。虽然程序可以调用系统程序来创建非PDA账户，并使用那些账户来存储数据，但PDAs往往是更好的选择。

如果需要回顾如何在PDA中存储数据，请查看[Create a Basic Program, Part 2 - State Management lesson](./program-state-management)。

## 映射到存储在PDA账户中的数据

在PDA账户中存储数据只是问题的一半。您还需要一种方法来检索这些数据。我们将讨论两种方法：

1. 创建一个存储各种存储数据账户地址的PDA“map”账户
2. 有策略地使用种子来定位适当的PDA账户并检索所需的数据

### 使用PDA“map”账户映射数据

组织数据存储的一种方法是将相关数据群存储在它们自己的PDA中，然后有一个单独的PDA账户存储所有数据位置的映射。

例如，您可能有一个备忘录应用程序，其支持程序使用随机种子生成PDA账户并在每个账户中存储一个备忘录。该程序还将拥有一个单个全局PDA“map”账户，该账户存储用户的公钥映射到存储他们备忘录的PDA的列表。此映射账户将使用静态种子派生，例如“GLOBAL_MAPPING”。

当要检索用户的备忘录时，可以查看映射账户，查看与用户公钥关联的地址列表，然后获取每个地址的账户。

虽然这样的解决方案可能更适合传统的Web开发人员，但它也带有一些特定于web3开发的缺点。由于存储在映射账户中的映射大小会随着时间的推移而增长，您将需要分配比必要更多的账户大小，或者每次创建新备忘录时都需要重新分配空间。而且，最终会达到账户大小限制的10兆字节。

您可以在一定程度上减轻这个问题，即为每个用户创建一个单独的映射账户。例如，而不是为整个程序使用单个PDA映射账户，您可以为每个用户构建PDA映射账户。每个映射账户都可以使用用户的公钥派生。然后，每个备忘录的地址可以存储在相应用户的映射账户中。

这种方法减少了每个映射账户所需的大小，但最终仍会为过程添加一个不必要的要求：在能够找到相关备忘录数据的账户之前，必须*先*读取映射账户上的信息。

也许在某些情况下，使用这种方法是合理的，但我们不建议将其作为您的“首选”策略。

### 使用PDA派生映射数据

如果您对使用来派生PDA的种子进行战略性，您可以将所需的映射嵌入到种子中。这是我们刚才讨论的备忘录应用程序示例的自然演变。如果您开始使用备忘录创建者的公钥作为种子，为每个用户创建一个映射账户，那么为什么不同时使用创建者的公钥和其他已知的信息来衍生备忘录本身的PDA呢？

现在，虽然我们没有明确提到，但在本课程中，我们一直在将种子映射到账户。想想我们在以前的课程中构建的电影评价程序。该程序使用评价创建者的公钥和他们所评价的电影的标题来找到*应该*用于存储评价的地址。这种方法可以让程序为每个新的评价创建一个唯一的地址，并且在需要时轻松地找到评价。当您想要找到用户对“蜘蛛侠”的评论时，您知道它存储在可以使用用户的公钥和文本“蜘蛛侠”作为种子派生的PDA帐户中。

```rust
let (pda, bump_seed) = Pubkey::find_program_address(&[
        initializer.key.as_ref(),
        title.as_bytes().as_ref()
    ],
    program_id)
```

### 关联代币账户地址

这种类型的映射的另一个实际示例是与关联代币账户（ATA）地址的确定方式。代币通常存储在使用钱包地址和特定代币的铸造地址派生的ATA中。ATA的地址是使用`get_associated_token_address`函数找到的，该函数以`wallet_address`和`token_mint_address`作为输入。

```rust
let associated_token_address = get_associated_token_address(&wallet_address, &token_mint_address);
```

在幕后，使用`wallet_address`、`token_program_id`和`token_mint_address`作为种子找到的关联代币地址是一个PDA。这提供了一种确定性的方式，用于找到与特定令牌铸造地址相关的任何钱包地址的代币账户。

```rust
fn get_associated_token_address_and_bump_seed_internal(
    wallet_address: &Pubkey,
    token_mint_address: &Pubkey,
    program_id: &Pubkey,
    token_program_id: &Pubkey,
) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            &wallet_address.to_bytes(),
            &token_program_id.to_bytes(),
            &token_mint_address.to_bytes(),
        ],
        program_id,
    )
}
```

种子和PDA账户之间的映射将高度依赖于您特定的程序。虽然这不是一个关于系统设计或架构的课程，但值得指出一些指导方针：

- 使用在PDA派生时将会知晓的种子
- 深思熟虑地将数据分组存储在单个账户中
- 深思熟虑地设置每个账户内部所使用的数据结构
- 通常简单就是更好的

# 实验

让我们一起练习我们在之前课程中已经开发过的电影评论程序。如果您只是在本课程中开始学习，而之前没有参加过相关课程，也不用担心，您也能够跟得上。

作为复习，电影评论程序允许用户创建电影评论。这些评论存储在一个账户中，使用初始化者的公钥和他们所评论的电影的标题生成的PDA。

在之前，我们已经完成了以安全方式更新电影评论的功能。在本次实验中，我们将增加用户评论电影评论的功能。我们将使用构建此功能作为机会来讨论如何使用PDA账户存储评论的数据结构。

### 1. 获取启动代码

首先，您可以在`启动`分支上找到[电影程序的起始代码](https://github.com/Unboxed-Software/solana-movie-program/tree/starter)。

如果您一直在进行电影评论实验，您会注意到这是我们迄今为止构建的程序。之前，我们使用[Solana Playground](https://beta.solpg.io/)来编写、构建和部署我们的代码。在本课程中，我们将在本地构建和部署该程序。

打开文件夹，然后运行`cargo-build-bpf`来构建该程序。`cargo-build-bpf`命令将输出部署程序的指令。

```sh
cargo-build-bpf
```

通过复制`cargo-build-bpf`的输出并运行`solana program deploy`命令来部署程序。

```sh
solana program deploy <PATH>
```

您可以使用电影评论[前端](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-update-reviews)来测试该程序，并将刚刚部署的程序ID更新到前端代码中。确保使用`solution-update-reviews`分支。

### 2. 计划账户结构

添加评论意味着我们需要对如何存储与每条评论相关的数据做出一些决策。这里的好数据结构标准包括：

- 不要过于复杂
- 数据容易检索
- 每条评论都有某种联系将其与所评论的评论关联起来

为了做到这一点，我们将创建两种新的账户类型：

- 评论计数账户
- 评论账户

每个评论计数账户和每条评论账户将分别与一个评论关联。评论计数账户将使用评论关联的账户地址作为种子来找到评论计数PDA。它也将使用静态字符串"comment"作为种子。

评论账户将以同样的方式与评论关联。然而，它将不包括"comment"字符串作为种子，而是使用*实际评论计数*作为种子。这样客户端便可以轻松地获取给定评论的评论，方法如下：

1. 读取评论计数账户上的数据以确定一篇评论上的评论数量。
2. 其中`n`是评论数量总数，循环`n`次。循环的每次迭代将使用评论地址和当前序号作为种子派生PDA。结果是`n`个PDA，每个都是存储评论的账户地址。
3. 获取每个`n`个PDA的账户并读取其中存储的数据。

这样确保我们的每一个账户都可以通过预先已知的数据确定性地被检索。

为了实现这些变化，我们需要做以下事情：

- 定义表示评论计数和评论账户的结构
- 更新现有的`MovieAccountState`以包含区分器字段（稍后会详细介绍）
- 添加一个指令变体来表示`add_comment`指令
- 更新现有的`add_movie_review`指令处理函数以包括创建评论计数账户
- 创建一个新的`add_comment`指令处理函数

### 3. 定义`MovieCommentCounter`和`MovieComment`结构

回想一下，`state.rs`文件定义了我们的程序用于填充新账户的数据字段的结构。

我们需要定义两种新结构来启用评论功能。

1. `MovieCommentCounter` - 用于存储与评论相关的数量计数器
2. `MovieComment` - 用于存储每条评论相关的数据

让我们开始定义我们程序中将会使用的结构。请注意，我们对每个结构都添加了`discriminator`字段，包括现有的`MovieAccountState`。因为现在我们有多种账户类型，我们需要一种方法来从客户端中只获取我们需要的账户。这个区分器是一个字符串，可以在我们获取程序账户时用于过滤账户。

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub discriminator: String,
    pub is_initialized: bool,
    pub reviewer: Pubkey,
    pub rating: u8,
    pub title: String,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieCommentCounter {
    pub discriminator: String,
    pub is_initialized: bool,
    pub counter: u64
}

#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieComment {
    pub discriminator: String,
    pub is_initialized: bool,
    pub review: Pubkey,
    pub commenter: Pubkey,
    pub comment: String,
    pub count: u64
}

impl Sealed for MovieAccountState {}

impl IsInitialized for MovieAccountState {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieCommentCounter {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl IsInitialized for MovieComment {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}
```

由于我们向现有结构添加了新的`discriminator`字段，账户大小的计算需要发生变化。让我们将这作为一个机会来稍微整理一下我们的代码。我们将为上面的三个结构中的每一个添加一个常量`DISCRIMINATOR`，以及一个常量`SIZE`或函数`get_account_size`的实现，这样我们在初始化账户时能够快速得到所需的大小。



```rust
pub fn get_account_size(title: String, description: String) -> usize {
    return (4 + MovieAccountState::DISCRIMINATOR.len())
        + 1
        + 1
        + (4 + title.len())
        + (4 + description.len());
    }
}

impl MovieCommentCounter {
    pub const DISCRIMINATOR: &'static str = "counter";
    pub const SIZE: usize = (4 + MovieCommentCounter::DISCRIMINATOR.len()) + 1 + 8;
}

impl MovieComment {
    pub const DISCRIMINATOR: &'static str = "comment";

    pub fn get_account_size(comment: String) -> usize {
        return (4 + MovieComment::DISCRIMINATOR.len()) + 1 + 32 + 32 + (4 + comment.len()) + 8;
    }
}
```

现在我们可以使用此实现在需要鉴别器或帐户大小的任何地方，而无需担心无意的拼写错误。

### 4. 创建`AddComment`指令

回顾一下，`instruction.rs`文件定义了我们的程序将接受的指令以及如何为每个指令反序列化数据。我们需要为添加评论添加一个新的指令变体，让我们首先在`MovieInstruction`枚举中添加一个新的变体`AddComment`。

```rust
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
    },
    AddComment {
        comment: String
    }
}
```

接下来，让我们创建一个`CommentPayload`结构体，以表示与此新指令关联的指令数据。我们将包含在帐户中的大多数数据都是与传递给程序的帐户相关的公钥，因此我们实际上唯一需要的东西是一个字段来表示评论文本。

```rust
#[derive(BorshDeserialize)]
struct CommentPayload {
    comment: String
}
```

现在让我们更新如何解压指令数据。请注意，我们已将指令数据的反序列化移动到匹配的每个情况中，使用每个指令的关联负载结构。

```rust
impl MovieInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        Ok(match variant {
            0 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description }
            },
            1 => {
                let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
                Self::UpdateMovieReview {
                    title: payload.title,
                    rating: payload.rating,
                    description: payload.description
                }
            },
            2 => {
                let payload = CommentPayload::try_from_slice(rest).unwrap();
                Self::AddComment {
                    comment: payload.comment
                }
            }
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

最后，让我们更新`processor.rs`中的`process_instruction`函数，以使用我们创建的新指令变体。

在`processor.rs`中，从`state.rs`中引入新的结构体。

```rust
use crate::state::{MovieAccountState, MovieCommentCounter, MovieComment};
```

然后在`process_instruction`中，让我们将反序列化的`AddComment`指令数据与我们即将实现的`add_comment`函数进行匹配。

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    let instruction = MovieInstruction::unpack(instruction_data)?;
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            add_movie_review(program_id, accounts, title, rating, description)
        },
        MovieInstruction::UpdateMovieReview { title, rating, description } => {
            update_movie_review(program_id, accounts, title, rating, description)
        },

        MovieInstruction::AddComment { comment } => {
            add_comment(program_id, accounts, comment)
        }
    }
}
```

### 5. 更新`add_movie_review`以创建评论计数器帐户

在实现`add_comment`函数之前，我们需要更新`add_movie_review`函数以创建评论的计数器帐户。

请记住，此帐户将跟踪与相关评论关联的总评论数量。其地址将是使用电影评论地址和“comment”一词作为种子派生的PDA。请注意，我们存储计数器的方式只是设计选择。我们也可以在原始电影评论帐户中添加“counter”字段。

在`add_movie_review`函数中，让我们添加`pda_counter`，以表示我们将初始化的新计数器帐户，以及电影评论帐户。这意味着我们现在通过`accounts`参数通过`add_movie_review`函数预期传递四个帐户。

```rust
let account_info_iter = &mut accounts.iter();

let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let pda_counter = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

接下来，有一个检查确保`total_len`小于1000字节，但是`total_len`不再准确，因为我们添加了鉴别器。让我们用`MovieAccountState::get_account_size`的调用替换`total_len`：

```rust
let account_len: usize = 1000;

if MovieAccountState::get_account_size(title.clone(), description.clone()) > account_len {
    msg!("Data length is larger than 1000 bytes");
    return Err(ReviewError::InvalidDataLength.into());
}
```

请注意，这也需要在`update_movie_review`函数中进行更新，以使该指令能够正常工作。

初始化评论帐户后，我们还需要更新`account_data`，以包含我们在`MovieAccountState`结构中指定的新字段。


```rust
account_data.discriminator = MovieAccountState::DISCRIMINATOR.to_string();
account_data.reviewer = *initializer.key;
account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```
最后，让我们在`add_movie_review`函数的末尾添加初始化计数器账户的逻辑。这意味着：

1. 计算计数器账户的租金豁免金额
2. 使用评论地址和字符串"comment"作为种子来派生计数器PDA
3. 调用系统程序来创建账户
4. 设置起始计数器值
5. 序列化账户数据并从函数返回

所有这些内容应该在`Ok(())`之前添加到`add_movie_review`函数的末尾。

```rust
msg!("创建评论计数器");
let rent = Rent::get()?;
let counter_rent_lamports = rent.minimum_balance(MovieCommentCounter::SIZE);

let (counter, counter_bump) =
    Pubkey::find_program_address(&[pda.as_ref(), "comment".as_ref()], program_id);
if counter != *pda_counter.key {
    msg!("PDA的种子无效");
    return Err(ProgramError::InvalidArgument);
}

invoke_signed(
    &system_instruction::create_account(
        initializer.key,
        pda_counter.key,
        counter_rent_lamports,
        MovieCommentCounter::SIZE.try_into().unwrap(),
        program_id,
    ),
    &[
        initializer.clone(),
        pda_counter.clone(),
        system_program.clone(),
    ],
    &[&[pda.as_ref(), "comment".as_ref(), &[counter_bump]]],
)?;
msg!("评论计数器已创建");

let mut counter_data =
    try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

msg!("检查计数器账户是否已初始化");
if counter_data.is_initialized() {
    msg!("账户已初始化");
    return Err(ProgramError::AccountAlreadyInitialized);
}

counter_data.discriminator = MovieCommentCounter::DISCRIMINATOR.to_string();
counter_data.counter = 0;
counter_data.is_initialized = true;
msg!("评论计数：{}", counter_data.counter);
counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;
```

现在，当创建新评论时，将初始化两个账户：

1. 第一个是存储评论内容的评论账户，与我们最初开始时的程序版本相同。
2. 第二个账户存储评论计数器

### 6. 实现`add_comment`

最后，让我们实现`add_comment`函数来创建新的评论账户。

当为评论创建新评论时，我们将增加评论计数器PDA账户上的计数，并使用评论地址和当前计数派生评论账户的PDA。

与其他指令处理函数一样，我们将首先遍历传入程序的账户。然后，在执行任何其他操作之前，我们需要反序列化计数器账户，以便可以访问当前的评论计数：

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("添加评论...");
    msg!("评论：{}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    Ok(())
}
```

现在我们已经可以访问计数器数据，接下来可以用剩余步骤继续：

1. 计算新评论账户的租金豁免金额
2. 使用评论地址和当前评论计数作为种子来派生评论账户的PDA
3. 调用系统程序来创建新评论账户
4. 设置新建账户的适当值
5. 序列化账户数据并从函数返回

```rust
pub fn add_comment(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    comment: String
) -> ProgramResult {
    msg!("Adding Comment...");
    msg!("Comment: {}", comment);

    let account_info_iter = &mut accounts.iter();

    let commenter = next_account_info(account_info_iter)?;
    let pda_review = next_account_info(account_info_iter)?;
    let pda_counter = next_account_info(account_info_iter)?;
    let pda_comment = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    let mut counter_data = try_from_slice_unchecked::<MovieCommentCounter>(&pda_counter.data.borrow()).unwrap();

    let account_len = MovieComment::get_account_size(comment.clone());

    let rent = Rent::get()?;
    let rent_lamports = rent.minimum_balance(account_len);

    let (pda, bump_seed) = Pubkey::find_program_address(&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(),], program_id);
    if pda != *pda_comment.key {
        msg!("Invalid seeds for PDA");
        return Err(ReviewError::InvalidPDA.into())
    }

    invoke_signed(
        &system_instruction::create_account(
        commenter.key,
        pda_comment.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
        ),
        &[commenter.clone(), pda_comment.clone(), system_program.clone()],
        &[&[pda_review.key.as_ref(), counter_data.counter.to_be_bytes().as_ref(), &[bump_seed]]],
    )?;

    msg!("Created Comment Account");

    let mut comment_data = try_from_slice_unchecked::<MovieComment>(&pda_comment.data.borrow()).unwrap();

    msg!("checking if comment account is already initialized");
    if comment_data.is_initialized() {
        msg!("Account already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    comment_data.discriminator = MovieComment::DISCRIMINATOR.to_string();
    comment_data.review = *pda_review.key;
    comment_data.commenter = *commenter.key;
    comment_data.comment = comment;
    comment_data.is_initialized = true;
    comment_data.serialize(&mut &mut pda_comment.data.borrow_mut()[..])?;

    msg!("Comment Count: {}", counter_data.counter);
    counter_data.counter += 1;
    counter_data.serialize(&mut &mut pda_counter.data.borrow_mut()[..])?;

    Ok(())
}
```



### 7. 构建和部署

我们已经准备好构建和部署我们的程序！

通过运行 `cargo-build-bpf` 来构建更新后的程序。然后通过运行控制台中打印出的 `solana program deploy` 命令来部署该程序。

您可以通过提交具有正确指令数据的交易来测试您的程序。您可以创建自己的脚本，也可以使用[此前端](https://github.com/Unboxed-Software/solana-movie-frontend/tree/solution-add-comments)。一定要使用 `solution-add-comments` 分支，并在 `utils/constants.ts` 中将 `MOVIE_REVIEW_PROGRAM_ID` 替换为您程序的ID，否则前端将无法与您的程序配合工作。

请记住，我们对评论账户进行了重大更改（即添加了一个鉴别器）。如果您在部署此程序时使用了与之前相同的程序ID，由于数据不匹配，以前创建的任何评论都不会显示在此前端上。

如果您需要更多时间来熟悉这些概念，请在继续之前查看 [解决方案代码](https://github.com/Unboxed-Software/solana-movie-program/tree/solution-add-comments)。请注意，链接存储库的解决方案代码位于所链接存储库的 `solution-add-comments` 分支上。

# 挑战

现在轮到您独立构建一些东西了！继续使用我们在过去课程中使用过的“学生介绍”程序。学生介绍程序是一个Solana程序，允许学生介绍自己。该程序会将用户的姓名和简短消息作为 `instruction_data` 并创建一个用于在链上存储数据的账户。在这个挑战中，您应该：

1. 添加一条指令，允许其他用户回复介绍
2. 在本地构建和部署该程序

如果您之前没有跟着过去的课程进行学习，或者没有保留之前的工作，请随时使用[此存储库](https://github.com/Unboxed-Software/solana-student-intro-program/tree/starter)上的 `starter` 分支上的起始代码。

如果可以的话尽可能独立完成！不过，如果您遇到困难，可以参考[解决方案代码](https://github.com/Unboxed-Software/solana-student-intro-program/tree/solution-add-replies)。请注意，解决方案代码在`solution-add-replies` 分支上，您的代码可能略有不同。


## 完成了这个实验吗？

将您的代码推送到GitHub，并[告诉我们您对这节课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=89d367b4-5102-4237-a7f4-4f96050fe57e)！
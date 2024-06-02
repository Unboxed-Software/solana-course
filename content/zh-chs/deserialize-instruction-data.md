---
title: 创建一个基本程序，第1部分 - 处理指令数据
objectives:
- 在Rust中分配可变和不可变变量
- 创建和使用Rust的struct和enums
- 使用Rust的match语句
- 为Rust类型添加实现
- 将指令数据反序列化为Rust的数据类型
- 根据不同类型的指令执行不同的程序逻辑
- 解释Solana上智能合约的结构
---

# 摘要

- 大多数程序支持**多个离散指令** - 在编写程序时，您可以决定这些指令是什么，以及它们需要携带什么数据
- Rust的**enums**通常用于表示离散程序指令
- 您可以使用`borsh` crate和`derive`属性为Rust的structs提供Borsh反序列化和序列化功能
- Rust的`match`表达式帮助创建基于提供的指令的条件代码路径

# 课程

处理指令数据是Solana程序的最基本要素之一。大多数程序支持多个相关函数，并使用指令数据的不同来确定要执行哪个代码路径。例如，传递给程序的指令数据中的两种不同数据格式可能表示创建新数据和删除相同数据的指令。

由于指令数据以字节数组的形式提供给程序的入口点，通常需要创建一个Rust数据类型来表示指令，以便在整个代码中更方便地使用。本课程将介绍如何设置这种类型，如何将指令数据反序列化为此格式，以及如何根据传递给程序入口点的指令执行正确的代码路径。

## Rust基础知识

在深入了解基本的Solana程序细节之前，让我们谈谈本课程中将使用的Rust基础知识。

### 变量

在Rust中，变量分配使用`let`关键字。

```rust
let age = 33;
```

在Rust中，默认情况下，变量是不可变的，这意味着变量的值一旦设置就无法更改。要创建将来可以修改的变量，我们使用`mut`关键字。使用此关键字定义的变量意味着其中存储的值可以更改。

```rust
// 编译器会报错
let age = 33;
age = 34;

// 允许这样写
let mut mutable_age = 33;
mutable_age = 34;
```

Rust编译器保证不可变的变量确实不能更改，这样你就不必自己跟踪它。这使得你的代码更容易理解，简化了调试过程。

### Structs

结构体（或结构）是一种自定义数据类型，它可以将组成一个有意义的组的多个相关值封装在一起并命名。结构体中的每个数据都可以是不同类型，并且每个都有一个与之关联的名称。这些数据称为**fields**。它们的行为类似于其他语言中的属性。

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

在我们定义了结构体之后，要使用它，我们需要为该结构体的每个字段指定具体的值来创建结构体的实例。

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

要从结构体中获取或设置特定的值，我们使用点表示法。

```rust
user1.age = 37;
```

### 枚举

枚举（或Enums）是一种数据结构，允许您通过列举其可能的变体来定义类型。枚举的示例可能如下所示：

```rust
enum LightStatus {
    On,
    Off
}
```

在这种情况下，`LightStatus`枚举有两种可能的变体：要么是`On`，要么是`Off`。

您还可以将值嵌入到枚举变体中，类似于将字段添加到结构中。

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

在此示例中，将变量设置为`LightStatus`的`On`变体还需要设置`color`的值。

### Match语句

Match语句与C/C++中的`switch`语句非常相似。`match`语句允许您将值与一系列模式进行比较，然后根据匹配的模式执行代码。模式可以由字面值、变量名、通配符等组成。Match语句必须包含所有可能的情况，否则代码将无法编译。

```rust
enum Coin {
    Penny,
    Nickel,
    Dime,
    Quarter
}

fn value_in_cents(coin: Coin) -> u8 {
    match coin {
        Coin::Penny => 1,
        Coin::Nickel => 5,
        Coin::Dime => 10,
        Coin::Quarter => 25
    }
}
```

### 实现

`impl`关键字在Rust中用于定义类型的实现。函数和常量都可以在实现中定义。

```rust
struct Example {
    number: i32
}

impl Example {
    fn boo() {
        println!("boo! Example::boo() was called!");
    }

    fn answer(&mut self) {
        self.number += 42;
    }

## 翻译 private_upload/default_user/2024-06-02-00-54-02/content copy.zip.extract/content copy/deserialize-instruction-data.md.part-1.md

```rust
fn get_number(&self) -> i32 {
    self.number
}
}
```

这里的`boo`函数只能在类型本身上调用，而不能在类型的实例上调用，如下所示：

```rust
Example::boo();
```

与此同时，`answer`需要一个可变的`Example`实例，并且可以使用点语法调用：

```rust
let mut example = Example { number: 3 };
example.answer();
```

### 特性和属性

在这个阶段，您不会创建自己的特性或属性，因此我们不会提供对它们的深入解释。但是，您将使用`derive`属性宏和`borsh`库提供的一些特性，因此您需要对每个特性有一个高层次的理解。

特性描述了类型可以实现的抽象接口。如果一个特性定义了一个`bark()`函数，然后类型采纳了该特性，那么该类型必须实现`bark()`函数。

[属性](https://doc.rust-lang.org/rust-by-example/attribute.html)为类型添加元数据，并且可以用于许多不同的目的。

当您将[`derive`属性](https://doc.rust-lang.org/rust-by-example/trait/derive.html)添加到类型并提供一个或多个支持的特性时，底层会生成代码来自动为该类型实现这些特性。我们很快会提供这方面的具体示例。

## 将指令表示为Rust数据类型

现在我们已经涵盖了Rust的基础知识，让我们将它们应用到Solana程序中。

通常情况下，程序将会有多个函数。例如，您可能有一个充当笔记应用后端的程序。假设这个程序接受用于创建新笔记、更新现有笔记和删除现有笔记的指令。

由于指令具有离散的类型，它们通常非常适合用枚举数据类型表示。

```rust
enum NoteInstruction {
    CreateNote {
        title: String,
        body: String,
        id: u64
    },
    UpdateNote {
        title: String,
        body: String,
        id: u64
    },
    DeleteNote {
        id: u64
    }
}
```

请注意，`NoteInstruction`枚举的每个变体都带有嵌入的数据，这些数据将由程序用于执行创建、更新和删除笔记的任务。

## 反序列化指令数据

指令数据以字节数组的形式传递给程序，因此您需要一种确定性地将该数组转换为指令枚举类型实例的方法。

在之前的单元中，我们在客户端使用了Borsh进行序列化和反序列化。要在程序端使用Borsh，我们使用`borsh`库。此库提供了`BorshDeserialize`和`BorshSerialize`的特性，您可以使用`derive`属性将其应用到您的类型上。

为了简化反序列化指令数据的过程，您可以创建一个代表数据的结构体，并使用`derive`属性将`BorshDeserialize`特性应用到这个结构体上。这样就实现了`BorshDeserialize`中定义的方法，包括我们将使用的`try_from_slice`方法来反序列化指令数据。

请记住，该结构体本身需要与字节数组中的数据结构相匹配。

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

创建了这个结构体后，您可以为您的指令枚举创建一个实现，以处理与反序列化指令数据相关的逻辑。通常会在一个名为`unpack`的函数内执行此操作，其接受指令数据作为参数，然后返回带有反序列化数据的适当枚举实例。

通常的做法是使您的程序期望第一个字节（或其他固定数量的字节）作为指示程序应该运行哪个指令的标识符。这可以是整数或字符串标识符。在本例中，我们将使用第一个字节，并将整数0、1和2映射到分别创建、更新和删除指令。

```rust
impl NoteInstruction {
    // 将输入的缓冲区解包为相应的指令
    // 输入的预期格式是Borsh序列化的向量
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // 取第一个字节作为变体
        // 以确定要执行哪个指令
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // 使用临时的payload结构体进行反序列化
        let payload = NoteInstructionPayload::try_from_slice(rest).unwrap();
        // 匹配变体以确定函数的预期数据结构
        // 并返回TestStruct或错误
        Ok(match variant {
            0 => Self::CreateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            1 => Self::UpdateNote {
                title: payload.title,
                body: payload.body,
                id: payload.id
            },
            2 => Self::DeleteNote {
                id: payload.id
            },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

这个例子中包含了很多内容，因此我们逐步来看：

1. 此函数从`input`参数中使用`split_first`函数返回一个元组。第一个元素`variant`是字节数组的第一个字节，第二个元素`rest`是字节数组的其余部分。
2. 函数然后使用`NoteInstructionPayload`的`try_from_slice`方法将字节数组的其余部分反序列化为名为`payload`的`NoteInstructionPayload`实例。
3. 最后，函数在`variant`上使用`match`语句创建并返回适当的枚举实例，使用来自`payload`的信息。

请注意，这个函数中有我们尚未解释的Rust语法。`ok_or`和`unwrap`函数用于错误处理，我们将在另一个课程中详细讨论它们。

## 程序逻辑

通过将指令数据反序列化为自定义的Rust类型，您可以在程序的入口点基于传入程序的不同指令执行程序中的不同代码路径。

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // 调用unpack来反序列化instruction_data
    let instruction = NoteInstruction::unpack(instruction_data)?;
    // 将返回的数据结构与期望的进行匹配
    match instruction {
        NoteInstruction::CreateNote { title, body, id } => {
            // 执行程序代码以创建注释
        },
        NoteInstruction::UpdateNote { title, body, id } => {
            // 执行程序代码以更新注释
        },
        NoteInstruction::DeleteNote { id } => {
            // 执行程序代码以删除注释
        }
    }
}
```

对于只有一两条指令需要执行的简单程序，将逻辑写在match语句内部可能已经足够。但对于包含许多不同可能匹配的指令的程序，如果对每个指令的逻辑写在一个单独的函数中，并在match语句内部直接调用，你的代码将更易读。

## 程序文件结构

[Hello World课程](hello-world-program)的程序足够简单，可以只用一个文件编写。但随着程序复杂度的增加，保持可读性和可扩展性的项目结构变得重要。这包括将代码封装到函数和数据结构中，就像我们到目前为止所做的那样。但它还包括将相关代码分组到单独的文件中。

例如，到目前为止我们所处理的代码很大一部分是关于定义和反序列化指令的。这些代码应该存在于它自己的文件中，而不是写在与入口点相同的文件中。这样一来，我们将有两个文件，一个带有程序的入口点，另一个有指令代码：

- **lib.rs**
- **instruction.rs**

一旦你开始像这样分开你的程序，你需要确保在一个中心位置注册所有的文件。我们将在`lib.rs`中做这件事。**你必须像这样注册你的程序中的每个文件。**

```rust
// 这将在lib.rs内部
pub mod instruction;
```

此外，任何你希望通过`use`语句在其他文件中使用的声明都需要以`pub`关键字为前缀：

```rust
pub enum NoteInstruction { ... }
```

# 实验

在本课的实验中，我们将继续构建我们在第1模块中使用过的电影评论程序的前半部分。这个程序存储用户提交的电影评论。

现在，我们将专注于反序列化指令数据。下一节课将专注于这个程序的后半部分。

### 1. 入口点

我们将再次使用[Solana Playground](https://beta.solpg.io/)来构建这个程序。Solana Playground 会在浏览器中保存状态，所以你在上一节中所做的一切可能仍然存在。如果存在的话，让我们清除当前`lib.rs`文件中的所有内容。

在lib.rs内部，我们将引入如下的crate，并使用`entrypoint`宏定义程序的入口点位置。

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::AccountInfo,
};

// 入口点是一个名为process_instruction的函数
entrypoint!(process_instruction);

// 在lib.rs内部
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {

    Ok(())
}
```

### 2. 反序列化指令数据

在继续处理器逻辑之前，我们应该定义我们所支持的指令，并实现我们的反序列化函数。

为了可读性，让我们创建一个名为`instruction.rs`的新文件。在这个新文件内，添加针对`BorshDeserialize`和`ProgramError`的`use`语句，然后创建一个`MovieInstruction`枚举，其中包含一个`AddMovieReview`变体。这个变体应该嵌入`title`、`rating`和`description`的值。

```rust
use borsh::{BorshDeserialize};
use solana_program::{program_error::ProgramError};

pub enum MovieInstruction {
    AddMovieReview {
        title: String,
        rating: u8,
        description: String
    }
}
```

接下来，定义一个`MovieReviewPayload`结构体。它将充当反序列化的中间类型，因此应该使用`derive`属性宏为`BorshDeserialize`特性提供默认实现。

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

最后，创建一个对`MovieInstruction`枚举的实现，定义并实现一个名为`unpack`的函数，它以一个字节数组作为参数，并返回一个`Result`类型。这个函数应该：

1. 使用`split_first`函数将数组的第一个字节与其余部分分隔开
2. 将数组的其余部分反序列化为`MovieReviewPayload`的实例
3. 使用`match`语句，如果数组的第一个字节是0，则返回`MovieInstruction`的`AddMovieReview`变体，否则返回一个程序错误

```rust
impl MovieInstruction {
    // 解压入站缓冲到相关指令
    // 输入的预期格式是Borsh序列化的向量
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // 拆分数据的第一个字节
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // `try_from_slice`是BorshDeserialization特性的实现之一
        // 将指令字节数据反序列化为有效载荷结构
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        // 匹配第一个字节并返回AddMovieReview结构
        Ok(match variant {
            0 => Self::AddMovieReview {
                title: payload.title,
                rating: payload.rating,
                description: payload.description },
            _ => return Err(ProgramError::InvalidInstructionData)
        })
    }
}
```

### 3. 程序逻辑

处理指令反序列化后，我们可以返回到`lib.rs`文件来处理一些程序逻辑。

请记住，由于我们在不同的文件中添加了代码，我们需要在`lib.rs`文件中使用`pub mod instruction;`进行注册。然后，我们可以使用`use`语句将`MovieInstruction`类型引入作用域。

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

接下来，让我们定义一个新函数`add_movie_review`，它以`program_id`、`accounts`、`title`、`rating`和`description`作为参数。它还应返回`ProgramResult`实例。在这个函数中，让我们现在只是简单地记录我们的值，到了下一课我们会重新访问该函数的实现的。

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

    // 记录传入的指令数据
    msg!("添加电影评论...");
    msg!("标题: {}", title);
    msg!("评分: {}", rating);
    msg!("描述: {}", description);

    Ok(())
}
```

完成后，我们可以从`process_instruction`（我们设置为入口点的函数）中调用`add_movie_review`。要将所有所需的参数传递给该函数，我们首先需要在`MovieInstruction`上调用`unpack`，然后使用`match`语句确保我们收到的指令是`AddMovieReview`变体。

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // 调用Unpack
    let instruction = MovieInstruction::unpack(instruction_data)?;
    // 与返回到`instruction`变量的数据结构进行匹配
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            // 调用`add_move_review`函数
            add_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

就是这样，当提交事务时，你的程序应该足够功能，可以记录传入的指令数据！

像上一课一样，从Solana Program构建和部署程序。如果自上一课以来你还没有更改程序ID，它将自动部署到相同的ID。如果你希望它具有单独的地址，你可以在部署之前在playground中生成新的程序ID。

你可以通过提交正确的指令数据测试你的程序。为此，可以使用[此脚本](https://github.com/Unboxed-Software/solana-movie-client)或我们在[自定义指令序列化数据课程](serialize-instruction-data)中构建的前端。无论哪种情况，确保你复制并粘贴你的程序ID到源代码的适当位置，以确保你正在测试正确的程序。

如果你需要在继续之前花更多时间来完成实验，请尽管这样做！如果你卡住了，也可以参考[解决方案代码](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b)。

# 挑战

对于本课程的挑战，尝试复制模块1中的Student Intro程序。回想一下，我们创建了一个让学生介绍自己的前端应用程序！该程序将用户的姓名和简短消息作为`instruction_data`，并创建一个账户来在链上存储这些数据。

利用这一课程学到的知识，将Student Intro程序构建到可以在程序被调用时将用户提供的`name`和`message`打印到程序日志的程度。

你可以通过构建[前端应用程序](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data)来测试你的程序，然后在Solana Explorer上检查程序日志。记住用你的部署程序ID替换前端代码中的ID。

如果可以的话，尽量独立完成这个挑战！但如果你卡住了，随时可以参考[解决方案代码](https://beta.solpg.io/62b0ce53f6273245aca4f5b0)。


## 实验完成了吗？

将你的代码推送到GitHub，并[Tell us what you thought of this lesson](https://form.typeform.com/to/IPH0UGz7#answers-lesson=74a157dc-01a7-4b08-9a5f-27aa51a4346c)!

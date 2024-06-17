---
title: Rust 过程宏
objectives:
- 创建和使用 Rust 中的 **过程宏**
- 解释和使用 Rust 抽象语法树（AST）
- 描述过程宏在 Anchor 框架中的使用
---
**译者**: [ben46](https://github.com/ben46)

# 摘要

-   **过程宏** 是 Rust 中一种特殊的宏，允许程序员根据自定义输入在编译时生成代码。
-   在 Anchor 框架中，过程宏用于生成减少编写 Solana 程序时所需的样板代码量的代码。
-   **抽象语法树（AST）** 是传递给过程宏的输入代码的语法和结构表示。在创建宏时，您使用 AST 的元素，如标记和项，生成适当的代码。
-   **标记** 是 Rust 中编译器可以解析的源代码的最小单位。
-   **项**是定义可在 Rust 程序中使用的内容的声明，例如结构、枚举、特质、函数或方法。
-   **TokenStream** 是表示源代码片段的标记序列，并且可以传递给过程宏，使其能够访问和操作代码中的单个标记。

# 课程

在 Rust 中，宏是您可以编写一次，然后“扩展”以在编译时生成代码的代码片段。当您需要生成重复或复杂的代码，或者当您想在程序的多个地方使用相同的代码时，这将非常有用。

有两种不同类型的宏：声明宏和过程宏。

-   使用 `macro_rules!` 宏定义声明宏，该宏允许您与代码模式匹配，并根据匹配模式生成代码。
-   Rust 中的过程宏使用 Rust 代码定义，并且操作输入 TokenStream 的抽象语法树（AST），这使它们能够在更详细的细节级别上操纵和生成代码。

在本课中，我们将着重于过程宏，它在 Anchor 框架中通常被使用。

## Rust 概念

在特定讨论宏之前，让我们讨论一下本课程中将要使用的重要术语、概念和工具。

### 标记

在 Rust 编程的上下文中，[标记](https://doc.rust-lang.org/reference/tokens.html) 是语言语法的基本元素，例如标识符或文字值。标记表示 Rust 编译器可以识别的源代码的最小单位，并且用于在程序中构建更加复杂的表达式和语句。

Rust 标记的示例包括：

-   [关键字](https://doc.rust-lang.org/reference/keywords.html)，例如 `fn`、`let` 和 `match`，它们是 Rust 语言中具有特殊含义的保留字。
-   [标识符](https://doc.rust-lang.org/reference/identifiers.html)，例如变量和函数名称，用于引用值和函数。
-   [标点](https://doc.rust-lang.org/reference/tokens.html#punctuation)标记，例如 `{`、`}` 和 `;`，用于结构化和分隔代码块。
-   [文字值](https://doc.rust-lang.org/reference/tokens.html#literals)，例如数字和字符串，表示 Rust 程序中的常数值。

您可以[阅读更多有关 Rust 标记的信息](https://doc.rust-lang.org/reference/tokens.html)。

### 项目

项目是 Rust 中具名的、独立的代码片段。它们提供一种将相关代码组合在一起并以组名引用的方法，从而可以重复使用和以模块化方式组织代码。

有几种不同类型的项目，例如：

-   函数
-   结构
-   枚举
-   特质
-   模块
-   宏

您可以[阅读更多有关 Rust 项目的信息](https://doc.rust-lang.org/reference/items.html)。

### TokenStream

`TokenStream` 类型是表示标记序列的数据类型。此类型在 `proc_macro` 包中定义，并且作为您编写基于代码库中其他代码的宏的一种方式。

在定义过程宏时，作为 `TokenStream` 传递输入的宏将其解析和转换为必要的形式。然后，生成的 `TokenStream` 可以扩展为宏的最终代码输出。

```rust
use proc_macro::TokenStream;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    ...
}
```

### 抽象语法树

在 Rust 过程宏的上下文中，抽象语法树（AST）是一种表示输入标记的分层结构和它们在 Rust 语言中的含义的数据结构。它通常作为输入的中间表示，可以轻松地由过程宏进行处理和转换。

宏可以使用 AST 分析输入代码并对其进行更改，例如添加或移除标记或以某种方式转换代码的含义。然后，它可以使用这个转换后的 AST 生成新代码，该代码可以作为过程宏的输出返回。

### `syn` 包

`syn` 包可以帮助解析标记序列为宏代码可以遍历和操作的 AST。当 Rust 程序中调用过程宏时，宏函数以标记序列作为输入进行调用。解析此输入是几乎任何宏的第一步。

以一个通过以下方式调用 `my_macro!` 的过程宏为例：

```rust
my_macro!("hello, world");
```

在执行上述代码时，Rust 编译器将输入标记（`"hello, world"`）作为 `TokenStream` 传递给 `my_macro` 过程宏。

```rust
use proc_macro::TokenStream;
use syn::parse_macro_input;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as syn::LitStr);
    eprintln! {"{:#?}", ast};
    ...
}
```

在过程宏内部，代码使用 `syn` 包中的 `parse_macro_input!` 宏来将输入的 `TokenStream` 解析为抽象语法树（AST）。特别是，此示例将其解析为 Rust 中表示字符串文字的 `LitStr` 实例。然后，`eprintln!` 宏用于调试目的打印 `LitStr` AST。

```rust
LitStr {
    token: Literal {
        kind: Str,
        symbol: "hello, world",
        suffix: None,
        span: #0 bytes(172..186),
    },
}
```

`eprintln!` 宏的输出显示了从输入标记生成的 `LitStr` AST 的结构。它显示了字符串文字值（`"hello, world"`）以及关于标记的其他元数据，例如其种类（`Str`）、后缀（`None`）和跨度。

### `quote` 包


另一个重要的板条箱是 `quote` 板条箱。 这个板条箱在宏的代码生成部分起着关键作用。

一旦一个过程宏完成了对 AST 的分析和转换，它可以使用 `quote` 板条箱或类似的代码生成库将 AST 转换回一个令牌流。 然后，它返回 `TokenStream`，Rust 编译器使用它来替换源代码中的原始流。

以 `my_macro` 的以下示例为例：

```rust
use proc_macro::TokenStream;
use syn::parse_macro_input;
use quote::quote;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as syn::LitStr);
    eprintln! {"{:#?}", ast};
    let expanded = {
        quote! {println!("The input is: {}", #ast)}
    };
    expanded.into()
}
```

这个例子使用 `quote!` 宏来生成一个新的 `TokenStream`，其中包含一个 `println!` 宏调用，其参数是 `LitStr` AST。

请注意，`quote!` 宏生成的 `TokenStream` 的类型是 `proc_macro2::TokenStream`。 要将此 `TokenStream` 返回给 Rust 编译器，您需要使用 `.into()` 方法将其转换为 `proc_macro::TokenStream`。 然后，Rust 编译器将使用这个 `TokenStream` 来替换源代码中的原始过程宏调用。

```text
The input is: hello, world
```

这使您能够创建执行强大的代码生成和元编程任务的过程宏。

## 过程宏

Rust 中的过程宏是扩展语言并创建自定义语法的强大方式。这些宏是用 Rust 编写的，并与其余代码一起编译。有三种类型的过程宏：

-   函数式宏 - `custom!(...)`
-   派生宏 - `#[derive(CustomDerive)]`
-   属性宏 - `#[CustomAttribute]`

本节将讨论三种类型的过程宏，并提供一个实现的例子。编写过程宏的过程在这三种类型中都是一致的，因此提供的示例可以适应其他类型。

### 函数式宏

函数式过程宏是三种过程宏中最简单的。这些宏使用一个带有 `#[proc_macro]` 属性的函数来定义。该函数必须接受一个 `TokenStream` 作为输入，并返回一个新的 `TokenStream` 作为输出，以替换原始代码。

```rust
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

这些宏是用函数的名称后跟 `!` 操作符来调用的。它们可以用于 Rust 程序中的各种地方，如表达式、语句和函数定义。

```rust
my_macro!(input);
```

函数式过程宏最适用于只需要单个输入和输出流的简单代码生成任务。它们易于理解和使用，并提供了一种在编译时生成代码的直接方式。

### 属性宏

属性宏定义了附加到 Rust 程序中项（如函数和结构体）上的新属性。

```rust
#[my_macro]
fn my_function() {
	...
}
```

属性宏是使用一个带有 `#[proc_macro_attribute]` 属性的函数来定义。该函数需要两个令牌流作为输入，并返回一个替换原始项的新 `TokenStream`。

```rust
#[proc_macro_attribute]
pub fn my_macro(attr: TokenStream, input: TokenStream) -> TokenStream {
    ...
}
```

第一个令牌流输入代表属性参数。第二个令牌流是附加到属性的项的其余部分，包括可能存在的其他属性。

```rust
#[my_macro(arg1, arg2)]
fn my_function() {
    ...
}
```

例如，属性宏可以处理传递给属性的参数，以启用或禁用某些功能，然后使用第二个令牌流以某种方式修改原始项。通过同时访问两个令牌流，属性宏可以提供比仅使用单个令牌流更灵活和功能更丰富的灵活性。

### 派生宏

派生宏是通过在结构体、枚举或联合上使用 `#[derive]` 属性来调用的。它们通常用于自动为输入类型实现特性。

```rust
#[derive(MyMacro)]
struct Input {
	field: String
}
```

派生宏是由使用 `#[proc_macro_derive]` 属性的函数来定义的。它们被限制为生成结构体、枚举和联合的代码。它们接受一个令牌流作为输入，并返回一个令牌流作为输出。

与其他过程宏不同，返回的令牌流没有替换原始代码。相反，返回的令牌流会追加到原始项所属的模块或块中。这允许开发人员扩展原始项的功能，而无需修改原始代码。

```rust
#[proc_macro_derive(MyMacro)]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

除了实现特性，派生宏还可以定义助手属性。助手属性可以在应用派生宏的项的作用域中使用，并自定义代码生成过程。

```rust
#[proc_macro_derive(MyMacro, attributes(helper))]
pub fn my_macro(body: TokenStream) -> TokenStream {
    ...
}
```

助手属性是没有效果的，这意味着它们本身不具有任何效果，它们的唯一目的是作为输入用于定义它们的派生宏。

```rust
#[derive(MyMacro)]
struct Input {
    #[helper]
    field: String
}
```

例如，派生宏可以定义一个助手属性，以根据属性的存在执行附加操作。这使开发人员能够进一步扩展派生宏的功能，并以更灵活的方式定制所生成的代码。

### 过程宏示例

这个示例展示了如何使用一个派生过程宏自动生成一个结构体的 `describe()` 方法的实现。

```rust
use example_macro::Describe;

#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}

fn main() {
    MyStruct::describe();
}
```

`describe()` 方法将打印结构体字段的描述到控制台。

```text
MyStruct is a struct with these named fields: my_string, my_number.
```

第一步是使用 `#[proc_macro_derive]` 属性定义过程宏。然后，使用 `parse_macro_input!()` 宏解析输入 `TokenStream`，以提取结构体的标识符和数据。

```rust
use proc_macro::{self, TokenStream};
use quote::quote;
use syn::{parse_macro_input, DeriveInput, FieldsNamed};

#[proc_macro_derive(Describe)]
pub fn describe_struct(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);
    ...
}
```


下一步是使用`match`关键字对`data`值进行模式匹配，以提取结构体字段的名称。

第一个`match`有两个分支：一个用于`syn::Data::Struct`变体，另一个用于处理所有其他`syn::Data`变体的“通用”`_`分支。

第二个`match`也有两个分支：一个用于`syn::Fields::Named`变体，另一个用于处理所有其他`syn::Fields`变体的“通用”`_`分支。

`#(#idents), *`语法指定`idents`迭代器将被“展开”以创建迭代器中元素的逗号分隔列表。

```rust
use proc_macro::{self, TokenStream};
use quote::quote;
use syn::{parse_macro_input, DeriveInput, FieldsNamed};

#[proc_macro_derive(Describe)]
pub fn describe_struct(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);

    let field_names = match data {
        syn::Data::Struct(s) => match s.fields {
            syn::Fields::Named(FieldsNamed { named, .. }) => {
                let idents = named.iter().map(|f| &f.ident);
                format!(
                    "a struct with these named fields: {}",
                    quote! {#(#idents), *},
                )
            }
            _ => panic!("The syn::Fields variant is not supported"),
        },
        _ => panic!("The syn::Data variant is not supported"),
    };
    ...
}
```

最后一步是为结构体实现一个`describe()`方法。`expanded`变量是使用`quote!`宏和`impl`关键字定义的，以创建存储在`#ident`变量中的结构体名称的实现。

此实现定义了使用`println!`宏来打印结构体名称及其字段名称的`describe()`方法。

最后，`expanded`变量使用`into()`方法转换为`TokenStream`。

```rust
use proc_macro::{self, TokenStream};
use quote::quote;
use syn::{parse_macro_input, DeriveInput, FieldsNamed};

#[proc_macro_derive(Describe)]
pub fn describe(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);

    let field_names = match data {
        syn::Data::Struct(s) => match s.fields {
            syn::Fields::Named(FieldsNamed { named, .. }) => {
                let idents = named.iter().map(|f| &f.ident);
                format!(
                    "a struct with these named fields: {}",
                    quote! {#(#idents), *},
                )
            }
            _ => panic!("The syn::Fields variant is not supported"),
        },
        _ => panic!("The syn::Data variant is not supported"),
    };

    let expanded = quote! {
        impl #ident {
            fn describe() {
            println!("{} is {}.", stringify!(#ident), #field_names);
            }
        }
    };

    expanded.into()
}
```

现在，当为一个结构体添加`#[derive(Describe)]`属性时，Rust编译器会自动生成一个`describe()`方法的实现，以便调用打印结构体名称及其字段名称。

```rust
#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}
```

可以使用`cargo expand`命令从`cargo-expand`创建的crate展开使用过程宏的Rust代码。例如，使用`#[derive(Describe)]`属性生成的`MyStruct`结构的代码如下:

```rust
struct MyStruct {
    my_string: String,
    my_number: f64,
}
impl MyStruct {
    fn describe() {
        {
            ::std::io::_print(
                ::core::fmt::Arguments::new_v1(
                    &["", " is ", ".\n"],
                    &[
                        ::core::fmt::ArgumentV1::new_display(&"MyStruct"),
                        ::core::fmt::ArgumentV1::new_display(
                            &"a struct with these named fields: my_string, my_number",
                        ),
                    ],
                ),
            );
        };
    }
}
```

## Anchor过程宏

过程宏是Anchor库背后的魔力，它通常用于Solana开发。Anchor宏允许更简洁的代码、常见的安全检查等。让我们通过几个例子看看Anchor如何使用过程宏。

### 函数式宏

`declare_id`宏展示了Anchor中如何使用函数式宏。此宏接受表示程序ID的字符字符串作为输入，并将其转换为Anchor程序中可用的`Pubkey`类型。

```rust
declare_id!("G839pmstFmKKGEVXRGnauXxFgzucvELrzuyk6gHTiK7a");
```

`declare_id`宏使用`#[proc_macro]`属性进行定义，表示它是一个函数式过程宏。

```rust
#[proc_macro]
pub fn declare_id(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let id = parse_macro_input!(input as id::Id);
    proc_macro::TokenStream::from(quote! {#id})
}
```

### 派生宏

`#[derive(Accounts)]`是Anchor中使用的许多派生宏中的一个示例。

`#[derive(Accounts)]`宏生成代码，为给定的结构体实现了`Accounts` trait。该trait实现了多项功能，包括验证和反序列化传递给指令的账户。这使得结构体可以用作Anchor程序中指令所需的账户列表。

结构体字段由`#[account(..)]`属性指定的任何约束在反序列化期间都会被应用。还可以添加`#[instruction(..)]`属性来指定指令的参数并使其可访问给宏。

```rust
#[derive(Accounts)]
#[instruction(input: String)]
pub struct Initialize<'info> {
    #[account(init, payer = payer, space = 8 + input.len())]
    pub data_account: Account<'info, MyData>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}
```

此宏使用`proc_macro_derive`属性进行定义，允许它作为派生宏应用于结构体。此行`#[proc_macro_derive(Accounts, attributes(account, instruction))]`指示这是一个派生宏，处理`account`和`instruction`辅助属性。


```rust
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn derive_anchor_deserialize(item: TokenStream) -> TokenStream {
    parse_macro_input!(item as anchor_syn::AccountsStruct)
        .to_token_stream()
        .into()
}
```

### 属性宏 `#[program]`

属性宏 `#[program]` 是 Anchor 中使用的属性宏的一个示例，用于定义包含 Solana 程序指令处理程序的模块。

```rust
#[program]
pub mod my_program {
use super::*;

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    ...
}
}
```

在此示例中，`#[program]` 属性应用于模块，并且用于指定模块包含 Solana 程序的指令处理程序。

```rust
#[proc_macro_attribute]
pub fn program(
_args: proc_macro::TokenStream,
input: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    parse_macro_input!(input as anchor_syn::Program)
        .to_token_stream()
        .into()
}
```

总的来说，在 Anchor 中使用 proc 宏大大减少了 Solana 开发人员需要编写的重复代码。通过减少样板代码的量，开发者可以专注于其程序的核心功能，并避免手动重复带来的错误。这最终导致更快速和更高效的开发过程。

# 实验

让我们通过创建一个新的衍生宏来练习这一点！我们的新宏将允许我们自动生成 Anchor 程序中更新每个账户字段的指令逻辑。

### 1. 起步

要开始，从[这个存储库](https://github.com/Unboxed-Software/anchor-custom-macro/tree/starter)的 `starter` 分支下载起始代码。

起始代码包含一个简单的 Anchor 程序，允许您初始化和更新 `Config` 账户。这类似于我们在[环境变量课程](./env-variables)中所做的操作。

涉及的账户结构如下：

```rust
use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub auth: Pubkey,
    pub bool: bool,
    pub first_number: u8,
    pub second_number: u64,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 8;
}
```

`programs/admin/src/lib.rs` 文件包含了程序入口点和程序指令的定义。当前，该程序有一个指令来初始化该账户，然后，每个账户字段有一个用于更新字段的指令。

`programs/admin/src/admin_config` 目录包含了程序的指令逻辑和状态。详细查看这些文件。您会注意到，每个字段的指令逻辑在每个指令中都有重复。

此实验的目标是实现一个过程宏，允许我们替换所有指令逻辑函数，并自动生成每个指令的函数。

### 2. 设置自定义宏声明

让我们开始创建一个独立的 crate 用于我们的自定义宏。在项目的根目录下运行 `cargo new custom-macro`。这将创建一个带有自己 `Cargo.toml` 的新 `custom-macro` 目录。更新新的 `Cargo.toml` 文件如下：

```text
[package]
name = "custom-macro"
version = "0.1.0"
edition = "2021"

[lib]
proc-macro = true

[dependencies]
syn = "1.0.105"
quote = "1.0.21"
proc-macro2 = "0.4"
anchor-lang = "0.25.0"
```

`proc-macro = true` 行将此 crate 定义为包含过程宏。依赖项是我们将用于创建衍生宏的所有 crate。

接下来，将 `src/main.rs` 更改为 `src/lib.rs`。

接下来，更新项目根目录的 `Cargo.toml` 文件的 `members` 字段以包括 `"custom-macro"`：

```text
[workspace]
members = [
    "programs/*",
    "custom-macro"
]
```

现在，我们的 crate 已设置好并准备好使用。但在继续之前，让我们在根目录下创建一个更多用于测试我们的宏。使用 `cargo new custom-macro-test` 在项目根目录下创建一个新 crate。然后更新新创建的 `Cargo.toml` 以添加 `anchor-lang` 和 `custom-macro` crate 作为依赖项：

```text
[package]
name = "custom-macro-test"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../custom-macro" }
```

接下来，更新根项目的 `Cargo.toml` 以包含新的 `custom-macro-test` crate，如上所述：

```text
[workspace]
members = [
    "programs/*",
    "custom-macro",
    "custom-macro-test"
]
```

最后，用以下代码替换 `custom-macro-test/src/main.rs` 中的代码。稍后我们将使用此代码进行测试：

```rust
use anchor_lang::prelude::*;
use custom_macro::InstructionBuilder;

#[derive(InstructionBuilder)]
pub struct Config {
    pub auth: Pubkey,
    pub bool: bool,
    pub first_number: u8,
    pub second_number: u64,
}
```

### 3. 定义自定义宏

现在，在 `custom-macro/src/lib.rs` 文件中，让我们添加我们新宏的声明。在此文件中，我们将使用 `parse_macro_input!` 宏解析输入的 `TokenStream`，并从 `DeriveInput` 结构中提取 `ident` 和 `data` 字段。然后，我们将使用 `eprintln!` 宏打印 `ident` 和 `data` 的值。目前，我们将使用 `TokenStream::new()` 返回一个空的 `TokenStream`。

```rust
use proc_macro::TokenStream;
use quote::*;
use syn::*;

#[proc_macro_derive(InstructionBuilder)]
pub fn instruction_builder(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);

    eprintln! {"{:#?}", ident};
    eprintln! {"{:#?}", data};

    TokenStream::new()
}
```

让我们测试下这打印结果。首先，您需要通过运行 `cargo install cargo-expand` 安装 `cargo-expand` 命令。然后，您还需要安装 Rust 的夜版版本，通过运行 `rustup install nightly`。

完成以上步骤后，您可以通过导航到 `custom-macro-test` 目录并运行 `cargo expand` 来查看上述代码的输出。```


这个命令会展开箱子中的宏。由于 `main.rs` 文件使用了新创建的 `InstructionBuilder` 宏，这将打印结构体的 `ident` 和 `data` 的语法树到控制台上。一旦您确认输入的 `TokenStream` 解析正确，可以随意删除 `eprintln!` 语句。

### 4. 获取结构体的字段

接下来，让我们使用 `match` 语句从结构体的 `data` 中获取命名字段。然后我们将使用 `eprintln!` 宏打印字段的值。

```rust
use proc_macro::TokenStream;
use quote::*;
use syn::*;

#[proc_macro_derive(InstructionBuilder)]
pub fn instruction_builder(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);

    let fields = match data {
        syn::Data::Struct(s) => match s.fields {
            syn::Fields::Named(n) => n.named,
            _ => panic!("The syn::Fields variant is not supported: {:#?}", s.fields),
        },
        _ => panic!("The syn::Data variant is not supported: {:#?}", data),
    };

    eprintln! {"{:#?}", fields};

    TokenStream::new()
}
```

一旦再次在终端中使用 `cargo expand` 命令查看此代码的输出。一旦确定字段被正常提取并正确打印，可以删除 `eprintln!` 语句。

### 5. 构建更新指令

接下来，让我们遍历结构体的字段并为每个字段生成更新指令。使用 `quote!` 宏生成指令，包括字段的名称和类型，以及更新指令的新函数名称。

```rust
use proc_macro::TokenStream;
use quote::*;
use syn::*;

#[proc_macro_derive(InstructionBuilder)]
pub fn instruction_builder(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);

    let fields = match data {
        syn::Data::Struct(s) => match s.fields {
            syn::Fields::Named(n) => n.named,
            _ => panic!("The syn::Fields variant is is not supported: {:#?}", s.fields),
        },
        _ => panic!("The syn::Data variant is not supported: {:#?}", data),
    };

    let update_instruction = fields.into_iter().map(|f| {
        let name = &f.ident;
        let ty = &f.ty;
        let fname = format_ident!("update_{}", name.clone().unwrap());

        quote! {
            pub fn #fname(ctx: Context<UpdateAdminAccount>, new_value: #ty) -> Result<()> {
                let admin_account = &mut ctx.accounts.admin_account;
                admin_account.#name = new_value;
                Ok(())
            }
        }
    });

    TokenStream::new()
}
```

### 6. 返回新的 `TokenStream`

最后，让我们使用 `quote!` 宏为由 `ident` 变量指定的结构体生成实现。实现包括为结构体的每个字段生成的更新指令。然后使用 `into()` 方法将生成的代码转换为 `TokenStream`，作为宏的结果返回。

```rust
use proc_macro::TokenStream;
use quote::*;
use syn::*;

#[proc_macro_derive(InstructionBuilder)]
pub fn instruction_builder(input: TokenStream) -> TokenStream {
    let DeriveInput { ident, data, .. } = parse_macro_input!(input);

    let fields = match data {
        syn::Data::Struct(s) => match s.fields {
            syn::Fields::Named(n) => n.named,
            _ => panic!("The syn::Fields variant is is not supported: {:#?}", s.fields),
        },
        _ => panic!("The syn::Data variant is not supported: {:#?}", data),
    };

    let update_instruction = fields.into_iter().map(|f| {
        let name = &f.ident;
        let ty = &f.ty;
        let fname = format_ident!("update_{}", name.clone().unwrap());

        quote! {
            pub fn #fname(ctx: Context<UpdateAdminAccount>, new_value: #ty) -> Result<()> {
                let admin_account = &mut ctx.accounts.admin_account;
                admin_account.#name = new_value;
                Ok(())
            }
        }
    });

    let expanded = quote! {
        impl #ident {
            #(#update_instruction)*
        }
    };
    expanded.into()
}
```

为了验证宏是否生成了正确的代码，请使用 `cargo expand` 命令查看宏的展开形式。此命令会输出以下内容:

```rust
use anchor_lang::prelude::*;
use custom_macro::InstructionBuilder;
pub struct Config {
    pub auth: Pubkey,
    pub bool: bool,
    pub first_number: u8,
    pub second_number: u64,
}
impl Config {
    pub fn update_auth(
        ctx: Context<UpdateAdminAccount>,
        new_value: Pubkey,
    ) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.auth = new_value;
        Ok(())
    }
    pub fn update_bool(ctx: Context<UpdateAdminAccount>, new_value: bool) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.bool = new_value;
        Ok(())
    }
    pub fn update_first_number(
        ctx: Context<UpdateAdminAccount>,
        new_value: u8,
    ) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.first_number = new_value;
        Ok(())
    }
    pub fn update_second_number(
        ctx: Context<UpdateAdminAccount>,
        new_value: u64,
    ) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.second_number = new_value;
        Ok(())
    }
}
```

### 7. 更新程序以使用你的新宏

要使用新宏为 `Config` 结构体生成更新指令，首先需要将 `custom-macro` crate 添加为程序的依赖项，在其 `Cargo.toml` 文件中：

```text
[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../../custom-macro" }
```

然后，转到 Anchor 程序中的 `state.rs` 文件并使用以下代码进行更新：

```rust
use crate::admin_update::UpdateAdminAccount;
use anchor_lang::prelude::*;
use custom_macro::InstructionBuilder;

#[derive(InstructionBuilder)]
#[account]
pub struct Config {
    pub auth: Pubkey,
    pub bool: bool,
    pub first_number: u8,
    pub second_number: u64,
}

impl Config {
    pub const LEN: usize = 8 + 32 + 1 + 1 + 8;
}
```


接下来，导航到 `admin_update.rs` 文件，并删除现有的更新指令。这样文件中应该只剩下 `UpdateAdminAccount` 上下文结构体。

```rust
use crate::state::Config;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateAdminAccount<'info> {
    pub auth: Signer<'info>,
    #[account(
        mut,
        has_one = auth,
    )]
    pub admin_account: Account<'info, Config>,
}
```

然后，更新 Anchor 程序中的 `lib.rs`，以使用由 `InstructionBuilder` 宏生成的更新指令。

```rust
use anchor_lang::prelude::*;
mod admin_config;
use admin_config::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod admin {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Initialize::initialize(ctx)
    }

    pub fn update_auth(ctx: Context<UpdateAdminAccount>, new_value: Pubkey) -> Result<()> {
        Config::update_auth(ctx, new_value)
    }

    pub fn update_bool(ctx: Context<UpdateAdminAccount>, new_value: bool) -> Result<()> {
        Config::update_bool(ctx, new_value)
    }

    pub fn update_first_number(ctx: Context<UpdateAdminAccount>, new_value: u8) -> Result<()> {
        Config::update_first_number(ctx, new_value)
    }

    pub fn update_second_number(ctx: Context<UpdateAdminAccount>, new_value: u64) -> Result<()> {
        Config::update_second_number(ctx, new_value)
    }
}
```

最后，导航到 `admin` 目录，并运行 `anchor test`，以验证 `InstructionBuilder` 宏生成的更新指令是否正常工作。

```
  admin
    ✔ Is initialized! (160ms)
    ✔ Update bool! (409ms)
    ✔ Update u8! (403ms)
    ✔ Update u64! (406ms)
    ✔ Update Admin! (405ms)


  5 passing (2s)
```

做得好！此时，您可以创建过程宏来帮助开发过程。我们鼓励您充分利用 Rust 语言，根据需要使用宏。即使不使用宏，了解它们的工作原理也有助于理解 Anchor 内部发生的事情。

如果您需要花更多时间阅读解决方案代码，请随时参考 [仓库](https://github.com/Unboxed-Software/anchor-custom-macro/tree/solution) 的 `solution` 分支。

# 挑战

为了巩固您学到的知识，试着创建另一个过程宏。想想您编写的代码，看看哪些地方可以通过宏来减少或改进，并尝试一下吧！由于这仍然是练习，如果没能达到您期望的效果也没关系。只要尝试并摸索！

## 完成实验了吗？

将您的代码推送到 GitHub，并[告诉我们您对这堂课的看法](https://form.typeform.com/to/IPH0UGz7#answers-lesson=eb892157-3014-4635-beac-f562af600bf8)！
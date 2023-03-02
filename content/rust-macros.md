# Rust Macros

# Lesson Objectives

_By the end of this lesson, you will be able to:_

-   Understand the concepts of Rust Token, Item, TokenStream, and Abstract Syntax Tree (AST)
-   Explain the basics of procedural macros in Rust
-   Describe how procedural macros are used in the Anchor framework

# TL;DR

-   A **Token** is the smallest unit of source code that can be parsed by the compiler in Rust.
-   An **Item** is a declaration that defines something that can be used in a Rust program, such as a struct, an enum, a trait, a function, or a method.
-   A **TokenStream** is a sequence of tokens that represents a piece of source code, and can be passed to a procedural macro to allow it to access and manipulate the individual tokens in the code.
-   In the context of proc macros in Rust, an **Abstract Syntax Tree (AST)** is a representation of the syntax and structure of the input code that is passed to a procedural macro.
-   **Procedural macros** are a special kind of Rust macro that allow the programmer to generate code at compile time based on custom input.
-   In the Anchor framework, procedural macros are used to generate code that reduces the amount of boilerplate required when writing Solana programs.

# Overview

In Rust, a macro is a piece of code that you can write once and then "expand" to generate code at compile time. This can be useful when you need to generate code that is repetitive or complex, or when you want to use the same code in multiple places in your program.

There are two different types of macros: declarative macros and procedural macros.

-   Declarative macros are defined using the `macro_rules!` macro, which allows you to match against patterns of code and generate code based on the matching pattern.
-   Procedural macros, on the other hand, are defined using Rust code and have access to the Rust abstract syntax tree (AST), allowing them to manipulate and generate code at a finer level of detail.

In this lesson, we'll focus on procedural macros, which are commonly used in the Anchor framework.

## Rust concepts

### Token

In the context of Rust programming, a [token](https://doc.rust-lang.org/reference/tokens.html) is a basic element of the language syntax, such as a keyword, an identifier, a punctuation character, or a literal value. Tokens are the smallest units of source code that are recognized by the Rust compiler, and they are used to build up more complex expressions and statements in a program.

Examples of Rust tokens include:

-   [Keywords](https://doc.rust-lang.org/reference/keywords.html), such as `fn`, `let`, and `match`, which are reserved words in the Rust language that have special meanings.
-   [Identifiers](https://doc.rust-lang.org/reference/identifiers.html), such as variable and function names, which are used to refer to values and functions in a Rust program.
-   [Punctuation](https://doc.rust-lang.org/reference/tokens.html#punctuation) marks, such as `{`, `}`, and `;`, which are used to structure and delimit blocks of code in Rust.
-   [Literals](https://doc.rust-lang.org/reference/tokens.html#literals), such as numbers and strings, which represent constant values in a Rust program.

You can read more about Rust tokens [here](https://doc.rust-lang.org/reference/tokens.html).

### Item

Items are named, self-contained pieces of code in Rust. They provide a way to group related code together and give it a name. This allows you to reuse and organize your code in a modular way.

There are several different kinds of items, including:

-   Functions
-   Structs
-   Enums
-   Traits
-   Modules
-   Macros

You can read more about Rust items [here](https://doc.rust-lang.org/reference/items.html).

### TokenStream

The `TokenStream` type is a data type that represents a sequence of tokens. This type is used to store and manipulate token streams in Rust programs, and it is defined in the `proc_macro` crate.

When defining a procedural macro, the macro input is passed to the macro as a `TokenStream`, which can then be parsed and transformed as needed. The resulting `TokenStream` can then be expanded into the final code output by the macro.

```rust
use proc_macro::TokenStream;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    ...
}
```

### Abstract syntax tree

In the context of a Rust proc macro, an abstract syntax tree (AST) is a data structure that represents the hierarchical structure of the input tokens and their meaning in the Rust language. It is typically used as an intermediate representation of the input that can be easily processed and transformed by the procedural macro.

The proc macro can use the AST to analyze the input code and make changes to it, such as adding or removing tokens, or transforming the meaning of the code in some way. It can then use this transformed AST to generate new code, which can be returned as the output of the proc macro.

### `syn` crate

When a proc macro is invoked in a Rust program, the Rust compiler passes the input tokens of the proc macro call as a stream of tokens to the proc macro. The proc macro can then parse this token stream into an AST, using the `syn` crate or another parser library. Once the proc macro has an AST, it can use traverse and manipulate the AST as needed.

Here is an example of how a proc macro can parse the input tokens of a proc macro call into an abstract syntax tree (AST) in Rust.

```rust
my_macro!("hello, world");
```

The proc macro is invoked using the `my_macro!`, with a string literal argument (`"hello, world"`). The Rust compiler then passes the input tokens of the proc macro call as a `TokenStream` to the `my_macro` proc macro.

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

Inside the proc macro, the `parse_macro_input!` macro is used to parse the input `TokenStream` into an abstract syntax tree (AST), specifically into a `LitStr` that represents a string literal in Rust. The `eprintln!` macro is then used to print the `LitStr` AST for debugging purposes.

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

The printed output of the `eprintln!` macro shows the structure of the `LitStr` AST that was generated from the input tokens. It shows the string literal value (`"hello, world"`) and other details about the token, such as its kind (`Str`).

### `quote` crate

Once the proc macro has finished analyzing and transforming the AST, it can use the `quote` crate or another code generation library to convert the AST back into a stream of tokens. The proc macro then returns this `TokenStream`, which the Rust compiler uses to replace the original proc macro call in the source code.

Here is an example of how a proc macro can generate new code based on an abstract syntax tree (AST) in Rust.

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

In this example, the `quote!` macro is used to generate a new `TokenStream` consisting of a `println!` macro call with the `LitStr`
AST as its argument.

Note that the `quote!` macro generates a `TokenStream` of type `proc_macro2::TokenStream`. To return this `TokenStream` to the Rust compiler, you need to use the `.into()` method to convert it to `proc_macro::TokenStream`. The Rust compiler will then use this `TokenStream` to replace the original proc macro call in the source code.

```bash
The input is: hello, world
```

In this way, proc macros can perform powerful code generation and metaprogramming tasks, by using the AST as an intermediate representation of the input code.

## Procedural Macro

Proc macros in Rust are a powerful way to extend the language and create custom syntax. These macros are written in Rust and are compiled along with the rest of the code. There are three types of procedural macros:

-   Function-like macros - `custom!(...)`
-   Derive macros - `#[derive(CustomDerive)]`
-   Attribute macros - `#[CustomAttribute]`

This section will explain the three types of proc macros and provide an example of writing one. The mechanics of writing a proc macro are the same for all three types, so the example can be applied to any of them.

### Function-like macros

Function-like procedural macros are the simplest of the three types of procedural macros. These macros are defined using the `#[proc_macro]` attribute that takes in a `TokenStream` as input and returns a new `TokenStream` as output to replace the original code.

```rust
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

These macros are invoked using the "!" operator and can be used in various places in a Rust program, such as in expressions, statements, and function definitions.

```rust
my_macro!(input);
```

Function-like procedural macros are best suited for simple code generation tasks that require only a single input and output stream. They are easy to understand and use, and they provide a straightforward way to generate code at compile time.

### Attribute marcos

Attribute macros define new attributes, which are attached to items in a Rust program such as functions and structs.

```rust
#[my_macro]
fn my_function() {
	...
}
```

Attribute macros are defined using the `#[proc_macro_attribute]` attribute that takes in two token streams and returns a `TokenStream` that replaces the original item with an arbitrary number of new items.

```rust
#[proc_macro_attribute]
pub fn my_macro(attr: TokenStream, input: TokenStream) -> TokenStream {
    ...
}
```

These macros take two token streams as input because attributes in Rust can have both a name and arguments. The first token stream is the token stream following the attribute name, and it contains the arguments passed to the attribute. The second token stream is the rest of the item that the attribute is attached to, including any other attributes that may be present.

```rust
#[my_macro(arg1, arg2)]
fn my_function() {
    ...
}
```

For example, an attribute macro could process the arguments passed to the attribute to enable or disable certain features, and then use the second token stream to modify the original item in some way. This allows attribute macros to provide more flexibility and functionality than if they only had access to a single token stream.

### Derive marcos

Derive macros are invoked using the `#[derive]` attribute on a struct, enum, or union are typically used to automatically implement traits for the input types.

```rust
#[derive(MyMacro)]
struct Input {
	field: String
}
```

Derive macros are defined with the `#[proc_macro_derive]` attribute are limited to generating code for structs, enums, and unions. Derive macros do not replace the original code, but rather takes in a `TokenStream` of the original item and returns a new `TokenStream` that is appended to the module or block that the original item is in. This allows developers to extend the functionality of the original item without modifying the original code.

```rust
#[proc_macro_derive(MyMacro)]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

Derive macros can also define helper attributes, which can be used in the scope of the item that the derive macro is applied to and customize the code generation process.

```rust
#[proc_macro_derive(MyMacro, attributes(helper))]
pub fn my_macro(body: TokenStream) -> TokenStream {
    ...
}
```

Helper attributes are inert, which means they do not have any effect on their own, and their only purpose is to be used as input to the derive macro that defined them.

```rust
#[derive(MyMacro)]
struct Input {
    #[helper]
    field: String
}
```

For example, a derive macro could define a helper attribute that specifies the name of a field in a struct, and then use that field name to generate code that accesses or manipulates the value of that field. This allows developers to further extend the functionality of derive macros and customize the code they generate in a more flexible way.

### Example

This example shows how to use a derive procedural macro to automatically generate an implementation of a `describe()` method for a struct.

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

The `describe()` method will print a description of the struct's fields to the console.

```bash
MyStruct is a struct with these named fields: my_string, my_number.
```

The first step is to define the procedural macro using the using the `#[proc_macro_derive]` attribute. The input `TokenStream` is parsed using the `parse_macro_input!()` macro to extract the struct's identifier and data.

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

The next step is to use the `match` keyword to perform pattern matching on the `data` value to extract the names of the fields in the struct.

The first `match` has two arms: one for the `syn::Data::Struct` variant, and one for the "catch-all" `_` arm that handles all other variants of `syn::Data`.

The second `match` has two arms as well: one for the `syn::Fields::Named` variant, and one for the "catch-all" `_` arm that handles all other variants of `syn::Fields`.

The `#(#idents), *` syntax inside the quotation specifies that the `idents` iterator will be "expanded" to create a comma-separated list of the elements in the iterator.

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

The last step is the implementation of a `describe()` method for a struct. The `expanded` variable is defined using the `quote!` macro and the `impl` keyword to create an implementation for the struct name stored in the `#ident` variable.

This implementation defines the `describe()` method that uses the `println!` macro to print the name of the struct and its field names.

Finally, the `expanded` variable is converted into a `TokenStream` using the `into()` method.

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

Now when the `#[derive(Describe)]` attribute is added to a struct, the Rust compiler automatically generates an implementation of the `describe()` method that can be called to print the name of the struct and the names of its fields.

```rust
#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}
```

The `cargo expand` command can be used expand Rust code that uses procedural macros. For example, the code for the `MyStruct` struct generated using the the `#[derive(Describe)]` attribute looks like this:

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

## Procedural Macros used in Anchor

### Function-like macro

The `declare_id` macro is an example of how function-like macros are used in Anchor. This macro takes in a string of characters representing a program's ID as input and converts it into a `Pubkey` type that can be used in the Anchor program.

```rust
declare_id!("G839pmstFmKKGEVXRGnauXxFgzucvELrzuyk6gHTiK7a");
```

The `declare_id` proc macro is defined using the `#[proc_macro]` attribute, which indicates that it is a function-like proc macro.

```rust
#[proc_macro]
pub fn declare_id(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let id = parse_macro_input!(input as id::Id);
    proc_macro::TokenStream::from(quote! {#id})
}
```

The `declare_id` proc macro returns the new `TokenStream` as its output, using the `into()` method. This `TokenStream` replaces the original proc macro call in the source code.

### Derive macro

The `#[derive(Accounts)]` macro is an example of how derive macros are used in Anchor.

In this case, the `#[derive(Accounts)]` macro generates code that implements the `Accounts` trait for a given struct to validate and deserialize the accounts. This allows the struct to be used as a list of accounts required by an instruction in an Anchor program.

Any constraints specified in the `#[account(..)]` attributes are applied during deserialization. The `#[instruction(..)]` attribute is used to specify the instruction's arguments, which can then be accessed by the macro.

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

This macro is defined using the `proc_macro_derive` attribute, which allows it to be used as a derive macro that can be applied to a struct. `#[proc_macro_derive(Accounts, attributes(account, instruction))]` indicates that this is a derive macro that processes `account` and `instruction` attributes.

```rust
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn derive_anchor_deserialize(item: TokenStream) -> TokenStream {
    parse_macro_input!(item as anchor_syn::AccountsStruct)
        .to_token_stream()
        .into()
}
```

The macro takes in a `TokenStream` containing the struct to be processed, and uses the `parse_macro_input!` macro to parse it into an `anchor_syn::AccountsStruct` instance. The `to_token_stream()` method is then called on this instance to generate the code that implements the `Accounts` trait for the struct. This generated code is then returned as a `TokenStream`.

### Attribute macro `#[program]`

The `#[program]` attribute macros an example of is used in the Anchor to define the module containing instruction handlers for a Solana program.

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ...
    }
}
```

In this case, the `#[program]` attribute is applied to a module, and it is used to specify that the module contains instruction handlers for a Solana program.

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

This macro takes two arguments: `_args` and `input`. The `_args` argument is not used in this particular macro, but it is a placeholder for any additional arguments that may be passed to the macro. The `input` argument is the token stream representing the module where the `#[program]` attribute is applied.

The body of the macro uses the `parse_macro_input!` macro to parse the input token stream as a `Program` struct from the `anchor_syn` crate. The `to_token_stream()` method is then called on the `Program` to convert it into a new token stream, which is returned by the macro.

### Attribute macro `#[account]`

The `#[account]` attribute macro is another example of how attribute macros are used in Anchor.

```rust
#[account]
pub struct MyData {
    pub data: String,
}
```

The `account` attribute is a custom attribute that is defined using a `proc_macro_attribute` macro. The generated code will include implementations of various traits that are necessary for a struct used to represent a Solana account. These traits provide various functionality for a Solana account, such as serialization and deserialization, cloning, and verifying ownership

```rust
#[proc_macro_attribute]
pub fn account(
    args: proc_macro::TokenStream,
    input: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    ...
}
```

Using the **`account`** attribute allows developers to easily create structs that can be used as Solana accounts in their Anchor programs, without having to write the trait implementations manually.

Overall, the use of proc macros in Anchor greatly reduces the amount of repetitive code that must be written. By reducing the amount of boilerplate code, developers are able to focus on the core functionality of their application. This ultimately results in a faster and more efficient development process.

# Demo

Let's practice by creating a derive macro that we can use in an Anchor program to automatically generate instructions for updating various fields in an admin `Config` account.

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/ZYJLiu/anchor-custom-macro).

The starter code includes a program with the instructions to initialize an admin `Config` account, as well as the various instructions for updating each field stored on the `Config` account. It also includes the necessary boilerplate setup for the test file.

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
        UpdateAdminAccount::update_auth(ctx, new_value)
    }

    pub fn update_bool(ctx: Context<UpdateAdminAccount>, new_value: bool) -> Result<()> {
        UpdateAdminAccount::update_bool(ctx, new_value)
    }

    pub fn update_first_number(ctx: Context<UpdateAdminAccount>, new_value: u8) -> Result<()> {
        UpdateAdminAccount::update_first_number(ctx, new_value)
    }

    pub fn update_second_number(ctx: Context<UpdateAdminAccount>, new_value: u64) -> Result<()> {
        UpdateAdminAccount::update_second_number(ctx, new_value)
    }
}
```

In the starter code, the update instructions for the admin `Config` account are currently manually implemented in the `admin_update.rs` file.

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

impl UpdateAdminAccount<'_> {
    pub fn update_auth(ctx: Context<UpdateAdminAccount>, new_value: Pubkey) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.auth = new_value;
        Ok(())
    }
    pub fn update_bool(ctx: Context<UpdateAdminAccount>, new_value: bool) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.bool = new_value;
        Ok(())
    }
    pub fn update_first_number(ctx: Context<UpdateAdminAccount>, new_value: u8) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.first_number = new_value;
        Ok(())
    }
    pub fn update_second_number(ctx: Context<UpdateAdminAccount>, new_value: u64) -> Result<()> {
        let admin_account = &mut ctx.accounts.admin_account;
        admin_account.second_number = new_value;
        Ok(())
    }
}
```

The goal of this demo is to implement a procedural macro that will automatically generate an update instruction for each field in the `Config` account struct in `state.rs`.

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

The starter code also includes a `custom-macro` directory with a `lib.rs` setup for implementing a derive procedural macro. This macro will be used to generate the update instructions for the `Config` account struct.

```rust
use proc_macro::TokenStream;
use quote::*;
use syn::*;

#[proc_macro_derive(InstructionBuilder)]
pub fn instruction_builder(input: TokenStream) -> TokenStream {
    unimplemented!()
}
```

Lastly, the starter code includes a `main` directory with a `main.rs` file, where you can use the `cargo expand` command to see the expanded macro throughout the demo. This will allow you to verify that the macro is generating the expected output.

To use `cargo expand`, you first need to install it by running `cargo install cargo-expand`, and you also need to install the nightly version of Rust running `rustup install nightly`.

### 2. `parse_macro_input!`

To start, navigate to the `lib.rs` file in the `custom-macro` directory. In this file, we’ll use the `parse_macro_input!` macro to parse the input `TokenStream` and extract the `ident` and `data` fields from a `DeriveInput` struct. Then, we’ll use the `eprintln!` macro to print the values of `ident` and `data`. For now, we will use `TokenStream::new()` to return an empty `TokenStream`.

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

To see the output of the code described above, navigate to the `main` directory and then run `cargo expand`. This will print the syntax tree for the `ident` and `data` of the struct to the console. Once you have confirmed that the input `TokenStream` is parsing correctly, feel free to remove the `eprintln!` statements.

### 3. Get struct fields

Next, let’s use `match` statements to get the named fields from the `data` of the struct. Then, use the `eprintln!` macro to print the values of the fields.

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

Once again, let’s use `cargo expand` in the terminal to see the output of this code. Once you have confirmed that the fields are being extracted and printed correctly, you can remove the `eprintln!` statement.

### 3. Build update instructions

Next, let’s iterate over the fields of the struct and generate an update instruction for each field. The instruction will be generated using the `quote!` macro and will include the field's name and type, as well as a new function name for the update instruction.

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

### 4. Return new `TokenStream`

Lastly, let’s use the `quote!` macro to generate an implementation for the struct with the name specified by the `ident` variable. The implementation includes the update instructions that were generated for each field in the struct. The generated code is then converted to a `TokenStream` using the `into()` method and returned as the result of the macro.

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

To verify that the macro is generating the correct code, use the `cargo expand` command to see the expanded form of the macro. The output of this look like the following:

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
fn main() {}
```

### 5. Update Anchor

To use the new macro to generate update instructions for the `Config` struct, navigate to the `state.rs` file in the Anchor program and update it with the following code:

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

Next, navigate to the `admin_update.rs` file and delete the existing update instructions. This should leave only the `UpdateAdminAccount` context struct in the file.

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

Next, update `lib.rs` in the Anchor program to use the update instructions generated by the `InstructionBuilder` macro.

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

Lastly, navigate to the `admin` directory and run `anchor test` to verify that the update instructions generated by the `InstructionBuilder` macro are working correctly.

```
  admin
    ✔ Is initialized! (160ms)
    ✔ Update bool! (409ms)
    ✔ Update u8! (403ms)
    ✔ Update u64! (406ms)
    ✔ Update Admin! (405ms)


  5 passing (2s)
```

# Challenge

_Short, numbered instructions for readers to do a project similar to the demo, only this time independently. Gives them a chance to know for sure that they feel solid about the lesson. We can provide starter and solution code but the expectation is the solution code is for reference and comparison after they’ve done the challenge independently._

1. Challenge instruction one
2. Challenge instruction two

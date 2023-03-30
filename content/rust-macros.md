---
title: Rust Procedural Macros
objectives:
- Create and use **Procedural Macros** in Rust
- Explain and work with a Rust Abstract Syntax Tree (AST)
- Describe how procedural macros are used in the Anchor framework
---

# TL;DR

-   **Procedural macros** are a special kind of Rust macro that allow the programmer to generate code at compile time based on custom input.
-   In the Anchor framework, procedural macros are used to generate code that reduces the amount of boilerplate required when writing Solana programs.
-   An **Abstract Syntax Tree (AST)** is a representation of the syntax and structure of the input code that is passed to a procedural macro. When creating a macro, you use elements of the AST like tokens and items to generate the appropriate code.
-   A **Token** is the smallest unit of source code that can be parsed by the compiler in Rust.
-   An **Item** is a declaration that defines something that can be used in a Rust program, such as a struct, an enum, a trait, a function, or a method.
-   A **TokenStream** is a sequence of tokens that represents a piece of source code, and can be passed to a procedural macro to allow it to access and manipulate the individual tokens in the code.

# Overview

In Rust, a macro is a piece of code that you can write once and then "expand" to generate code at compile time. This can be useful when you need to generate code that is repetitive or complex, or when you want to use the same code in multiple places in your program.

There are two different types of macros: declarative macros and procedural macros.

-   Declarative macros are defined using the `macro_rules!` macro, which allows you to match against patterns of code and generate code based on the matching pattern.
-   Procedural macros in Rust are defined using Rust code and operate on the abstract syntax tree (AST) of the input TokenStream, which allows them to manipulate and generate code at a finer level of detail.

In this lesson, we'll focus on procedural macros, which are commonly used in the Anchor framework.

## Rust concepts

Before we dig into macros, specifically, let's talk about some of the important terminology, concepts, and tools we'll be using throughout the lesson.

### Token

In the context of Rust programming, a [token](https://doc.rust-lang.org/reference/tokens.html) is a basic element of the language syntax like an identifier or literal value. Tokens represent the smallest unit of source code that are recognized by the Rust compiler, and they are used to build up more complex expressions and statements in a program.

Examples of Rust tokens include:

-   [Keywords](https://doc.rust-lang.org/reference/keywords.html), such as `fn`, `let`, and `match`, are reserved words in the Rust language that have special meanings.
-   [Identifiers](https://doc.rust-lang.org/reference/identifiers.html), such as variable and function names, are used to refer to values and functions.
-   [Punctuation](https://doc.rust-lang.org/reference/tokens.html#punctuation) marks, such as `{`, `}`, and `;`, are used to structure and delimit blocks of code.
-   [Literals](https://doc.rust-lang.org/reference/tokens.html#literals), such as numbers and strings, represent constant values in a Rust program.

You can read more about Rust tokens [here](https://doc.rust-lang.org/reference/tokens.html).

### Item

Items are named, self-contained pieces of code in Rust. They provide a way to group related code together and give it a name by which the group can be referenced. This allows you to reuse and organize your code in a modular way.

There are several different kinds of items, such as:

-   Functions
-   Structs
-   Enums
-   Traits
-   Modules
-   Macros

You can read more about Rust items [here](https://doc.rust-lang.org/reference/items.html).

### Token Streams

The `TokenStream` type is a data type that represents a sequence of tokens. This type is defined in the `proc_macro` crate and is surfaced as a way for you write macros based on other code in the codebase.

When defining a procedural macro, the macro input is passed to the macro as a `TokenStream`, which can then be parsed and transformed as needed. The resulting `TokenStream` can then be expanded into the final code output by the macro.

```rust
use proc_macro::TokenStream;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    ...
}
```

### Abstract syntax tree

In the context of a Rust procedural macro, an abstract syntax tree (AST) is a data structure that represents the hierarchical structure of the input tokens and their meaning in the Rust language. It's typically used as an intermediate representation of the input that can be easily processed and transformed by the procedural macro.

The macro can use the AST to analyze the input code and make changes to it, such as adding or removing tokens, or transforming the meaning of the code in some way. It can then use this transformed AST to generate new code, which can be returned as the output of the proc macro.

### The `syn` crate

The `syn` crate is available to help parse a token stream into an AST that macro code can traverse and manipulate. When a procedural macro is invoked in a Rust program, the macro function is called with the a token stream as the input. Parsing this input is the first step to virtually any macro.

Take as an example a proc macro that you invoke using `my_macro!`as follows:

```rust
my_macro!("hello, world");
```

When the above code is executed, the Rust compiler passes the input tokens (`"hello, world"`) as a `TokenStream` to the `my_macro` proc macro.

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

Inside the proc macro, the code uses the `parse_macro_input!` macro from the `syn` crate to parse the input `TokenStream` into an abstract syntax tree (AST). Specifically, this example parses it as an instance of `LitStr` that represents a string literal in Rust. The `eprintln!` macro is then used to print the `LitStr` AST for debugging purposes.

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

The output of the `eprintln!` macro shows the structure of the `LitStr` AST that was generated from the input tokens. It shows the string literal value (`"hello, world"`) and other metadata about the token, such as its kind (`Str`), suffix (`None`), and span.

### The `quote` crate

Another important crate is the `quote` crate. This crate is pivotal in the code generation portion of the macro.

Once a proc macro has finished analyzing and transforming the AST, it can use the `quote` crate or a similar code generation library to convert the AST back into a token stream. After that, it returns the `TokenStream`, which the Rust compiler uses to replace the original stream in the source code.

Take the below example of `my_macro`:

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

This example uses the `quote!` macro to generate a new `TokenStream` consisting of a `println!` macro call with the `LitStr` AST as its argument.

Note that the `quote!` macro generates a `TokenStream` of type `proc_macro2::TokenStream`. To return this `TokenStream` to the Rust compiler, you need to use the `.into()` method to convert it to `proc_macro::TokenStream`. The Rust compiler will then use this `TokenStream` to replace the original proc macro call in the source code.

```text
The input is: hello, world
```

This allows you to create procedural macros that perform powerful code generation and metaprogramming tasks.

## Procedural Macro

Procedural macros in Rust are a powerful way to extend the language and create custom syntax. These macros are written in Rust and are compiled along with the rest of the code. There are three types of procedural macros:

-   Function-like macros - `custom!(...)`
-   Derive macros - `#[derive(CustomDerive)]`
-   Attribute macros - `#[CustomAttribute]`

This section will discuss the three types of procedural macros and provide an example implementation of one. The process of writing a procedural macro is consistent across all three types, so the example provided can be adapted to the other types.

### Function-like macros

Function-like procedural macros are the simplest of the three types of procedural macros. These macros are defined using a function preceded by the `#[proc_macro]` attribute. The function must take a `TokenStream` as input and return a new `TokenStream` as output to replace the original code.

```rust
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

These macros are invoked using the name of the function followed by the `!` operator. They can be used in various places in a Rust program, such as in expressions, statements, and function definitions.

```rust
my_macro!(input);
```

Function-like procedural macros are best suited for simple code generation tasks that require only a single input and output stream. They are easy to understand and use, and they provide a straightforward way to generate code at compile time.

### Attribute macros

Attribute macros define new attributes that are attached to items in a Rust program such as functions and structs.

```rust
#[my_macro]
fn my_function() {
	...
}
```

Attribute macros are defined with a function preceded by the `#[proc_macro_attribute]` attribute. The function requires two token streams as input and returns a single `TokenStream` as output that replaces the original item with an arbitrary number of new items.

```rust
#[proc_macro_attribute]
pub fn my_macro(attr: TokenStream, input: TokenStream) -> TokenStream {
    ...
}
```

The first token stream input represents attribute arguments. The second token stream is the rest of the item that the attribute is attached to, including any other attributes that may be present.

```rust
#[my_macro(arg1, arg2)]
fn my_function() {
    ...
}
```

For example, an attribute macro could process the arguments passed to the attribute to enable or disable certain features, and then use the second token stream to modify the original item in some way. By having access to both token streams, attribute macros can provide greater flexibility and functionality compared to using only a single token stream.

### Derive macros

Derive macros are invoked using the `#[derive]` attribute on a struct, enum, or union are typically used to automatically implement traits for the input types.

```rust
#[derive(MyMacro)]
struct Input {
	field: String
}
```

Derive macros are defined with a function preceded by the `#[proc_macro_derive]` attribute. They're limited to generating code for structs, enums, and unions. They take a single token stream as input and return a single token stream as output.

Unlike the other procedural macros, the returned token stream doesn't replace the original code. Rather, the returned token stream gets appended to the module or block that the original item belongs to. This allows developers to extend the functionality of the original item without modifying the original code.

```rust
#[proc_macro_derive(MyMacro)]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

In addition to implementing traits, derive macros can define helper attributes. Helper attributes can be used in the scope of the item that the derive macro is applied to and customize the code generation process.

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

For example, a derive macro could define a helper attribute to perform additional operations depending on the presence of the attribute. This allows developers to further extend the functionality of derive macros and customize the code they generate in a more flexible way.

### Example of a procedural macro

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

```text
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

The `#(#idents), *` syntax specifies that the `idents` iterator will be "expanded" to create a comma-separated list of the elements in the iterator.

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

The last step is to implement a `describe()` method for a struct. The `expanded` variable is defined using the `quote!` macro and the `impl` keyword to create an implementation for the struct name stored in the `#ident` variable.

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

Now, when the `#[derive(Describe)]` attribute is added to a struct, the Rust compiler automatically generates an implementation of the `describe()` method that can be called to print the name of the struct and the names of its fields.

```rust
#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}
```

The `cargo expand` command from the `cargo-expand` crate can be used to expand Rust code that uses procedural macros. For example, the code for the `MyStruct` struct generated using the the `#[derive(Describe)]` attribute looks like this:

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

## Anchor procedural macros

Procedural macros are the magic behind the Anchor library that is commonly used in Solana development. Anchor macros allow for more succinct code, common security checks, and more. Let's go through a few examples of how Anchor uses procedural macros.

### Function-like macro

The `declare_id` macro shows how function-like macros are used in Anchor. This macro takes in a string of characters representing a program's ID as input and converts it into a `Pubkey` type that can be used in the Anchor program.

```rust
declare_id!("G839pmstFmKKGEVXRGnauXxFgzucvELrzuyk6gHTiK7a");
```

The `declare_id` macro is defined using the `#[proc_macro]` attribute, indicating that it's a function-like proc macro.

```rust
#[proc_macro]
pub fn declare_id(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let id = parse_macro_input!(input as id::Id);
    proc_macro::TokenStream::from(quote! {#id})
}
```

### Derive macro

The `#[derive(Accounts)]` is an example of just one of many derive macros that are used in Anchor.

The `#[derive(Accounts)]` macro generates code that implements the `Accounts` trait for the given struct. This trait does a number of things, including validating and deserializing the accounts passed into an instruction. This allows the struct to be used as a list of accounts required by an instruction in an Anchor program.

Any constraints specified on fields by the `#[account(..)]` attribute are applied during deserialization. The `#[instruction(..)]` attribute can also be added to specify the instruction's arguments and make them accessible to the macro.

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

This macro is defined using the `proc_macro_derive` attribute, which allows it to be used as a derive macro that can be applied to a struct. The line `#[proc_macro_derive(Accounts, attributes(account, instruction))]` indicates that this is a derive macro that processes `account` and `instruction` helper attributes.

```rust
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn derive_anchor_deserialize(item: TokenStream) -> TokenStream {
    parse_macro_input!(item as anchor_syn::AccountsStruct)
        .to_token_stream()
        .into()
}
```

### Attribute macro `#[program]`

The `#[program]` attribute macro is an example of an attribute macro used in the Anchor to define the module containing instruction handlers for a Solana program.

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

Overall, the use of proc macros in Anchor greatly reduces the amount of repetitive code that Solana developers have to write. By reducing the amount of boilerplate code, developers can focus on their program's core functionality and avoid mistakes caused by manual repetition. This ultimately results in a faster and more efficient development process.

# Demo

Let's practice this by creating a new derive macro! Our new macro will let us automatically generate instruction logic for updating each field on an account in an Anchor program.

### 1. Starter

To get started, download the starter code from the `starter` branch of [this repository](https://github.com/Unboxed-Software/anchor-custom-macro/tree/starter).

The starter code includes a simple Anchor program that allows you to initialize and update a `Config` account. This is similar to what we did with the [Environment Variables lesson](./env-variables.md).

The account in question is structured as follows:

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

The `programs/admin/src/lib.rs` file contains the program entrypoint with the definitions of the program's instructions. Currently, the program has instructions to initialize this account and then one instruction per account field for updating the field.

The `programs/admin/src/admin_config` directory contains the program's instruction logic and state. Take a look through each of these files. You'll notice that instruction logic for each field is effectively duplicated for each instruction.

The goal of this demo is to implement a procedural macro that will allow us to replace all of the instruction logic functions and automatically generate functions for each instruction.

### 2. Set up the custom macro declaration

Let's get started by creating a separate crate for our custom macro. In the project's root directory, run `cargo new custom-macro`. This will create a new `custom-macro` directory with its own `Cargo.toml`. Update the new `Cargo.toml` file to be the following:

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

The `proc-macro = true` line defines this crate as containing a procedural macro. The dependencies are all crates we'll be using to create our derive macro.

Next, change `src/main.rs` to `src/lib.rs`.

Next, update the project root's `Cargo.toml` file's `members` field to include `"custom-macro"`:

```text
[workspace]
members = [
    "programs/*",
    "custom-macro"
]
```

Now our crate is set up and ready to go. But before we move on, let's create one more crate at the root level that we can use to test out our macro as we create it. Use `cargo new custom-macro-test` at the project root. Then update the newly created `Cargo.toml` to add `anchor-lang` and the `custom-macro` crates as dependencies:

```text
[package]
name = "custom-macro-test"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../custom-macro" }
```

Next, update the root project's `Cargo.toml` to include the new `custom-macro-test` crate as before:

```text
[workspace]
members = [
    "programs/*",
    "custom-macro",
    "custom-macro-test"
]
```

Finally, replace the code in `custom-macro-test/src/main.rs` with the following code. We'll use this later for testing:

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

### 3. Define the custom macro

Now, in the `custom-macro/src/lib.rs` file, let's add our new macro's declaration. In this file, we’ll use the `parse_macro_input!` macro to parse the input `TokenStream` and extract the `ident` and `data` fields from a `DeriveInput` struct. Then, we’ll use the `eprintln!` macro to print the values of `ident` and `data`. For now, we will use `TokenStream::new()` to return an empty `TokenStream`.

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

Let's test what this prints. To do this, you first need to install the `cargo-expand` command by running `cargo install cargo-expand`. You'll also need to install the nightly version of Rust by running `rustup install nightly`.

Once you've done this, you can see the output of the code described above by navigating to the `custom-macro-test` directory and running `cargo expand`.

This command expands macros in the crate. Since the `main.rs` file uses the newly created `InstructionBuilder` macro, this will print the syntax tree for the `ident` and `data` of the struct to the console. Once you have confirmed that the input `TokenStream` is parsing correctly, feel free to remove the `eprintln!` statements.

### 4. Get the struct's fields

Next, let’s use `match` statements to get the named fields from the `data` of the struct. Then we'll use the `eprintln!` macro to print the values of the fields.

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

Once again, use `cargo expand` in the terminal to see the output of this code. Once you have confirmed that the fields are being extracted and printed correctly, you can remove the `eprintln!` statement.

### 5. Build update instructions

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

### 6. Return new `TokenStream`

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
```

### 7. Update the program to use your new macro

To use the new macro to generate update instructions for the `Config` struct, first add the `custom-macro` crate as a dependency to the program in its `Cargo.toml`:

```text
[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../../custom-macro" }
```

Then, navigate to the `state.rs` file in the Anchor program and update it with the following code:

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

Nice work! At this point, you can create procedural macros to help in your development process. We encourage you to make the most of the Rust language and use macros where they make sense. But even if you don't, knowing how they work helps to understand what's happening with Anchor under the hood.

If you need to spend more time with the solution code, feel free to reference the `solution` branch of [the repository](https://github.com/Unboxed-Software/anchor-custom-macro/tree/solution).

# Challenge

To solidify what you've learned, go ahead and create another procedural macro on your own. Think about code you've written that could be reduced or improved by a macro and try it out! Since this is still practice, it's okay if it doesn't work out the way you want or expect. Just jump in and experiment!
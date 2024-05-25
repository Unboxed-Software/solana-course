---
title: Rust Procedural Macros
objectives:
- Create and use **Procedural Macros** in Rust
- Explain and work with a Rust Abstract Syntax Tree (AST)
- Describe how procedural macros are used in the Anchor framework
---

# TL;DR

- **Procedural macros** ay isang espesyal na uri ng Rust macro na nagpapahintulot sa programmer na bumuo ng code sa oras ng pag-compile batay sa custom na input.
- Sa balangkas ng Anchor, ginagamit ang mga procedural macro upang bumuo ng code na nagpapababa sa dami ng boilerplate na kinakailangan kapag nagsusulat ng mga programang Solana.
- Ang **Abstract Syntax Tree (AST)** ay isang representasyon ng syntax at istraktura ng input code na ipinapasa sa isang procedural macro. Kapag gumagawa ng macro, gumagamit ka ng mga elemento ng AST tulad ng mga token at item upang makabuo ng naaangkop na code.
- Ang **Token** ay ang pinakamaliit na unit ng source code na maaaring i-parse ng compiler sa Rust.
- Ang **Item** ay isang deklarasyon na tumutukoy sa isang bagay na maaaring gamitin sa isang Rust program, gaya ng isang struct, isang enum, isang katangian, isang function, o isang paraan.
- Ang **TokenStream** ay isang sequence ng mga token na kumakatawan sa isang piraso ng source code, at maaaring ipasa sa isang procedural macro upang payagan itong ma-access at manipulahin ang mga indibidwal na token sa code.

# Lesson

Sa Rust, ang macro ay isang piraso ng code na maaari mong isulat nang isang beses at pagkatapos ay "palawakin" upang makabuo ng code sa oras ng pag-compile. Maaari itong maging kapaki-pakinabang kapag kailangan mong bumuo ng code na paulit-ulit o kumplikado, o kapag gusto mong gamitin ang parehong code sa maraming lugar sa iyong programa.

Mayroong dalawang iba't ibang uri ng macros: declarative macros at procedural macros.

- Ang mga deklaratibong macro ay tinukoy gamit ang `macro_rules!` na macro, na nagbibigay-daan sa iyong tumugma sa mga pattern ng code at bumuo ng code batay sa pagtutugma ng pattern.
- Ang mga procedural macro sa Rust ay tinukoy gamit ang Rust code at gumagana sa abstract syntax tree (AST) ng input na TokenStream, na nagpapahintulot sa kanila na manipulahin at bumuo ng code sa mas pinong antas ng detalye.

Sa araling ito, magtutuon tayo sa mga procedural macro, na karaniwang ginagamit sa framework ng Anchor.

## Rust concepts

Bago tayo maghukay sa mga macro, partikular, pag-usapan natin ang ilan sa mahahalagang terminolohiya, konsepto, at tool na gagamitin natin sa buong aralin.

### Token

Sa konteksto ng Rust programming, ang isang [token](https://doc.rust-lang.org/reference/tokens.html) ay isang pangunahing elemento ng syntax ng wika tulad ng isang identifier o literal na halaga. Ang mga token ay kumakatawan sa pinakamaliit na yunit ng source code na kinikilala ng Rust compiler, at ginagamit ang mga ito upang bumuo ng mas kumplikadong mga expression at pahayag sa isang programa.

Kasama sa mga halimbawa ng mga Rust token ang:

- [Mga Keyword](https://doc.rust-lang.org/reference/keywords.html), gaya ng `fn`, `let`, at `match`, ay mga nakalaan na salita sa Rust language na may mga espesyal na kahulugan .
- [Mga Identifier](https://doc.rust-lang.org/reference/identifiers.html), gaya ng mga pangalan ng variable at function, ay ginagamit upang sumangguni sa mga value at function.
- Ang [Bantas](https://doc.rust-lang.org/reference/tokens.html#punctuation) na mga marka, gaya ng `{`, `}`, at `;`, ay ginagamit upang buuin at limitahan ang mga bloke ng code.
- [Mga Literal](https://doc.rust-lang.org/reference/tokens.html#literals), tulad ng mga numero at string, ay kumakatawan sa mga pare-parehong halaga sa isang Rust program.

Maaari kang [magbasa nang higit pa tungkol sa mga Rust token](https://doc.rust-lang.org/reference/tokens.html).

### Item

Ang mga item ay pinangalanan, self-contained na mga piraso ng code sa Rust. Nagbibigay ang mga ito ng paraan upang igrupo ang magkakaugnay na code at bigyan ito ng pangalan kung saan maaaring i-reference ang grupo. Binibigyang-daan ka nitong muling gamitin at ayusin ang iyong code sa modular na paraan.

Mayroong ilang iba't ibang uri ng mga item, tulad ng:

-   Functions
-   Structs
-   Enums
-   Traits
-   Modules
-   Macros

Maaari kang [magbasa nang higit pa tungkol sa Rust item](https://doc.rust-lang.org/reference/items.html).

### Mga Token Stream

Ang uri ng `TokenStream` ay isang uri ng data na kumakatawan sa isang sequence ng mga token. Ang uri na ito ay tinukoy sa `proc_macro` crate at lumalabas bilang isang paraan para magsulat ka ng mga macro batay sa iba pang code sa codebase.

Kapag tumukoy ng procedural macro, ang macro input ay ipinapasa sa macro bilang isang `TokenStream`, na maaaring ma-parse at mabago kung kinakailangan. Ang resultang `TokenStream` ay maaaring palawakin sa huling code na output ng macro.

```rust
use proc_macro::TokenStream;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    ...
}
```

### Abstract syntax tree

Sa konteksto ng Rust procedural macro, ang abstract syntax tree (AST) ay isang istraktura ng data na kumakatawan sa hierarchical na istraktura ng mga input token at ang kahulugan ng mga ito sa Rust na wika. Karaniwan itong ginagamit bilang isang intermediate na representasyon ng input na madaling maproseso at mabago ng procedural macro.

Maaaring gamitin ng macro ang AST upang suriin ang input code at gumawa ng mga pagbabago dito, tulad ng pagdaragdag o pag-alis ng mga token, o pagbabago ng kahulugan ng code sa ilang paraan. Maaari nitong gamitin ang binagong AST na ito upang bumuo ng bagong code, na maaaring ibalik bilang output ng proc macro.

### The `syn` crate

Available ang `syn` na crate upang tumulong sa pag-parse ng token stream sa isang AST na maaaring lampasan at manipulahin ng macro code. Kapag ang isang procedural macro ay na-invoke sa isang Rust program, ang macro function ay tinatawag na may token stream bilang input. Ang pag-parse sa input na ito ay ang unang hakbang sa halos anumang macro.

Kunin bilang isang halimbawa ang isang proc macro na ginagamit mo gamit ang `my_macro!`tulad ng sumusunod:

```rust
my_macro!("hello, world");
```

Kapag naisakatuparan ang code sa itaas, ipinapasa ng Rust compiler ang mga input token (`"hello, world"`) bilang `TokenStream` sa `my_macro` proc macro.

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

Sa loob ng proc macro, ginagamit ng code ang `parse_macro_input!` macro mula sa `syn` crate para i-parse ang input na `TokenStream` sa abstract syntax tree (AST). Sa partikular, pina-parse ito ng halimbawang ito bilang isang instance ng `LitStr` na kumakatawan sa literal na string sa Rust. Ang `eprintln!` macro ay pagkatapos ay ginagamit upang i-print ang `LitStr` AST para sa mga layunin ng pag-debug.

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

Ang output ng `eprintln!` macro ay nagpapakita ng istraktura ng `LitStr` AST na nabuo mula sa mga input token. Ipinapakita nito ang literal na value ng string (`"hello, world"`) at iba pang metadata tungkol sa token, gaya ng uri nito (`Str`), suffix (`Wala`), at span.

### The `quote` crate

Ang isa pang mahalagang crate ay ang `quote` crate. Ang crate na ito ay mahalaga sa bahagi ng pagbuo ng code ng macro.

Kapag natapos na ang isang proc macro sa pagsusuri at pagbabago sa AST, maaari nitong gamitin ang `quote` crate o isang katulad na library ng pagbuo ng code upang i-convert ang AST pabalik sa isang token stream. Pagkatapos nito, ibinabalik nito ang `TokenStream`, na ginagamit ng Rust compiler upang palitan ang orihinal na stream sa source code.

Kunin ang halimbawa sa ibaba ng `my_macro`:

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

Ginagamit ng halimbawang ito ang macro na `quote!` upang makabuo ng bagong `TokenStream` na binubuo ng `println!` na macro call na may `LitStr` AST bilang argument nito.

Tandaan na ang `quote!` na macro ay bumubuo ng `TokenStream` na may uri na `proc_macro2::TokenStream`. Upang ibalik ang `TokenStream` na ito sa Rust compiler, kailangan mong gamitin ang paraan ng `.into()` para i-convert ito sa `proc_macro::TokenStream`. Gagamitin ng Rust compiler itong `TokenStream` para palitan ang orihinal na proc macro na tawag sa source code.

```text
The input is: hello, world
```

Nagbibigay-daan ito sa iyo na lumikha ng mga procedural macro na gumaganap ng makapangyarihang paggawa ng code at mga gawain sa metaprogramming.

## Procedural Macro

Ang mga procedural macro sa Rust ay isang mahusay na paraan upang palawigin ang wika at gumawa ng custom na syntax. Ang mga macro na ito ay nakasulat sa Rust at pinagsama-sama kasama ang natitirang code. May tatlong uri ng procedural macros:

- Mga macro na parang function - `custom!(...)`
- Kumuha ng mga macro - `#[derive(CustomDerive)]`
- Mga macro ng katangian - `#[CustomAttribute]`

Tatalakayin ng seksyong ito ang tatlong uri ng procedural macros at magbibigay ng halimbawa ng pagpapatupad ng isa. Ang proseso ng pagsulat ng procedural macro ay pare-pareho sa lahat ng tatlong uri, kaya ang halimbawang ibinigay ay maaaring iakma sa iba pang mga uri.

### Function-like macros

Ang mga tulad-function na procedural macro ay ang pinakasimple sa tatlong uri ng procedural macros. Ang mga macro na ito ay tinukoy gamit ang isang function na sinusundan ng `#[proc_macro]` attribute. Ang function ay dapat kumuha ng `TokenStream` bilang input at magbalik ng bagong `TokenStream` bilang output upang palitan ang orihinal na code.

```rust
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

Ang mga macro na ito ay ginagamit gamit ang pangalan ng function na sinusundan ng `!` operator. Magagamit ang mga ito sa iba't ibang lugar sa isang Rust program, tulad ng sa mga expression, statement, at mga kahulugan ng function.

```rust
my_macro!(input);
```

Ang mga tulad-function na procedural macro ay pinakaangkop para sa mga simpleng gawain sa pagbuo ng code na nangangailangan lamang ng isang input at output stream. Ang mga ito ay madaling maunawaan at gamitin, at nagbibigay sila ng isang tuwirang paraan upang makabuo ng code sa oras ng pag-compile.

### Attribute macros

Tinutukoy ng mga macro ng katangian ang mga bagong attribute na naka-attach sa mga item sa isang Rust program gaya ng mga function at struct.

```rust
#[my_macro]
fn my_function() {
	...
}
```

Ang mga macro ng katangian ay tinukoy gamit ang isang function na sinusundan ng attribute na `#[proc_macro_attribute]`. Ang function ay nangangailangan ng dalawang token stream bilang input at nagbabalik ng isang `TokenStream` bilang output na pumapalit sa orihinal na item ng arbitrary na bilang ng mga bagong item.

```rust
#[proc_macro_attribute]
pub fn my_macro(attr: TokenStream, input: TokenStream) -> TokenStream {
    ...
}
```

Ang unang input ng token stream ay kumakatawan sa mga argumento ng katangian. Ang pangalawang stream ng token ay ang natitirang item kung saan naka-attach ang attribute, kasama ang anumang iba pang attribute na maaaring naroroon.

```rust
#[my_macro(arg1, arg2)]
fn my_function() {
    ...
}
```

Halimbawa, maaaring iproseso ng macro ng attribute ang mga argumentong ipinasa sa attribute upang paganahin o huwag paganahin ang ilang partikular na feature, at pagkatapos ay gamitin ang pangalawang stream ng token upang baguhin ang orihinal na item sa ilang paraan. Sa pamamagitan ng pagkakaroon ng access sa parehong token stream, ang attribute macros ay makakapagbigay ng higit na flexibility at functionality kumpara sa paggamit lamang ng isang token stream.

### Derive macros

Ang mga deive na macro ay ginagamit gamit ang attribute na `#[derive]` sa isang struct, enum, o union ay karaniwang ginagamit upang awtomatikong ipatupad ang mga katangian para sa mga uri ng input.

```rust
#[derive(MyMacro)]
struct Input {
	field: String
}
```

Tinutukoy ang mga deive macro na may isang function na pinangungunahan ng `#[proc_macro_derive]` attribute. Ang mga ito ay limitado sa pagbuo ng code para sa mga struct, enum, at unyon. Kumuha sila ng isang stream ng token bilang input at nagbabalik ng isang stream ng token bilang output.

Hindi tulad ng iba pang mga procedural macro, hindi pinapalitan ng ibinalik na token stream ang orihinal na code. Sa halip, ang ibinalik na stream ng token ay idaragdag sa module o block kung saan kabilang ang orihinal na item. Nagbibigay-daan ito sa mga developer na palawigin ang functionality ng orihinal na item nang hindi binabago ang orihinal na code.

```rust
#[proc_macro_derive(MyMacro)]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

Bilang karagdagan sa pagpapatupad ng mga katangian, maaaring tukuyin ng mga derive macro ang mga katangian ng katulong. Maaaring gamitin ang mga katangian ng Helper sa saklaw ng item kung saan inilalapat ang derive macro at i-customize ang proseso ng pagbuo ng code.

```rust
#[proc_macro_derive(MyMacro, attributes(helper))]
pub fn my_macro(body: TokenStream) -> TokenStream {
    ...
}
```

Ang mga katangian ng Helper ay hindi gumagalaw, na nangangahulugang wala silang anumang epekto sa kanilang sarili, at ang kanilang tanging layunin ay gamitin bilang input sa derive macro na tinukoy ang mga ito.

```rust
#[derive(MyMacro)]
struct Input {
    #[helper]
    field: String
}
```

Halimbawa, maaaring tukuyin ng derive macro ang isang helper attribute para magsagawa ng mga karagdagang operasyon depende sa presensya ng attribute. Nagbibigay-daan ito sa mga developer na palawigin pa ang functionality ng derive macros at i-customize ang code na nabuo nila sa mas nababaluktot na paraan.

### Example of a procedural macro

Ipinapakita ng halimbawang ito kung paano gumamit ng derive procedural macro para awtomatikong makabuo ng pagpapatupad ng `describe()` na paraan para sa isang struct.

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

Ang pamamaraang `describe()` ay magpi-print ng paglalarawan ng mga field ng struct sa console.

```text
MyStruct is a struct with these named fields: my_string, my_number.
```

Ang unang hakbang ay tukuyin ang procedural macro gamit ang paggamit ng `#[proc_macro_derive]` attribute. Ang input na `TokenStream` ay na-parse gamit ang `parse_macro_input!()` macro upang i-extract ang identifier at data ng struct.

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

Ang susunod na hakbang ay ang paggamit ng keyword na `match` upang magsagawa ng pagtutugma ng pattern sa halaga ng `data` upang i-extract ang mga pangalan ng mga field sa struct.

Ang unang `match` ay may dalawang arm: isa para sa `syn::Data::Struct` na variant, at isa para sa "catch-all" na `_` arm na humahawak sa lahat ng iba pang variant ng `syn::Data`.

Ang pangalawang `match` ay mayroon ding dalawang arm: isa para sa `syn::Fields::Named` na variant, at isa para sa "catch-all" `_` arm na humahawak sa lahat ng iba pang variant ng `syn::Fields` .

Ang `#(#idents), *` syntax ay tumutukoy na ang `idents` iterator ay "papalawakin" upang lumikha ng comma-separated list ng mga elemento sa iterator.

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

Ang huling hakbang ay ang magpatupad ng `describe()` method para sa isang struct. Tinutukoy ang variable na `pinalawak` gamit ang macro na `quote!` at ang keyword na `impl` para gumawa ng pagpapatupad para sa pangalan ng struct na naka-store sa variable na `#ident`.

Ang pagpapatupad na ito ay tumutukoy sa `describe()` na paraan na gumagamit ng `println!` na macro upang i-print ang pangalan ng struct at ang mga pangalan ng field nito.

Panghuli, ang variable na `pinalawak` ay na-convert sa isang `TokenStream` gamit ang pamamaraang `into()`.

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

Ngayon, kapag ang attribute na `#[derive(Describe)]` ay idinagdag sa isang struct, ang Rust compiler ay awtomatikong bubuo ng pagpapatupad ng `describe()` na paraan na maaaring tawagan upang i-print ang pangalan ng struct at ang mga pangalan ng mga patlang nito.

```rust
#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}
```

Ang command na `cargo expand` mula sa `cargo-expand` na crate ay maaaring gamitin upang palawakin ang Rust code na gumagamit ng procedural macros. Halimbawa, ang code para sa `MyStruct` struct na nabuo gamit ang `#[derive(Describe)]` attribute ay ganito ang hitsura:

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

Ang mga procedural macro ay ang magic sa likod ng Anchor library na karaniwang ginagamit sa pagbuo ng Solana. Nagbibigay-daan ang mga anchor macro para sa mas maikling code, karaniwang mga pagsusuri sa seguridad, at higit pa. Suriin natin ang ilang halimbawa kung paano gumagamit ang Anchor ng mga procedural macro.

### Function-like macro

Ipinapakita ng macro na `declare_id` kung paano ginagamit ang mga macro na tulad ng function sa Anchor. Kinukuha ng macro na ito ang isang string ng mga character na kumakatawan sa ID ng isang program bilang input at kino-convert ito sa isang uri ng `Pubkey` na maaaring magamit sa Anchor program.

```rust
declare_id!("G839pmstFmKKGEVXRGnauXxFgzucvELrzuyk6gHTiK7a");
```

Ang `declare_id` macro ay tinukoy gamit ang `#[proc_macro]` attribute, na nagsasaad na ito ay isang function-like proc macro.

```rust
#[proc_macro]
pub fn declare_id(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let id = parse_macro_input!(input as id::Id);
    proc_macro::TokenStream::from(quote! {#id})
}
```

### Derive macro

Ang `#[derive(Accounts)]` ay isang halimbawa ng isa lang sa maraming derive macro na ginagamit sa Anchor.

Ang `#[derive(Accounts)]` macro ay bumubuo ng code na nagpapatupad ng `Accounts` na katangian para sa ibinigay na struct. Ang katangiang ito ay gumagawa ng ilang bagay, kabilang ang pagpapatunay at pag-deserialize sa mga account na ipinasa sa isang pagtuturo. Pinapayagan nito ang struct na magamit bilang isang listahan ng mga account na kinakailangan ng isang pagtuturo sa isang Anchor program.

Ang anumang mga hadlang na tinukoy sa mga field ng `#[account(..)]` attribute ay inilalapat sa panahon ng deserialization. Ang katangiang `#[instruction(..)]` ay maaari ding idagdag upang tukuyin ang mga argumento ng pagtuturo at gawing naa-access ang mga ito sa macro.

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

Tang kanyang macro ay tinukoy gamit ang `proc_macro_derive` attribute, na nagbibigay-daan dito na magamit bilang isang derive macro na maaaring ilapat sa isang struct. Ang linyang `#[proc_macro_derive(Accounts, attributes(account, instruction))]` ay nagpapahiwatig na ito ay isang derive macro na nagpoproseso ng `account` at `instruction` helper attributes.

```rust
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn derive_anchor_deserialize(item: TokenStream) -> TokenStream {
    parse_macro_input!(item as anchor_syn::AccountsStruct)
        .to_token_stream()
        .into()
}
```

### Attribute macro `#[program]`

Ang `#[program]` attribute macro ay isang halimbawa ng attribute macro na ginamit sa Anchor upang tukuyin ang module na naglalaman ng mga tagapangasiwa ng pagtuturo para sa isang Solana program.

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ...
    }
}
```

Sa kasong ito, ang attribute na `#[program]` ay inilapat sa isang module, at ginagamit ito upang tukuyin na naglalaman ang module ng mga tagapangasiwa ng pagtuturo para sa isang Solana program.

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

Sa pangkalahatan, ang paggamit ng mga proc macro sa Anchor ay lubos na nakakabawas sa dami ng paulit-ulit na code na kailangang isulat ng mga developer ng Solana. Sa pamamagitan ng pagbawas sa dami ng boilerplate code, maaaring tumuon ang mga developer sa pangunahing functionality ng kanilang programa at maiwasan ang mga pagkakamaling dulot ng manu-manong pag-uulit. Ito sa huli ay nagreresulta sa isang mas mabilis at mas mahusay na proseso ng pag-unlad.

# Demo

Sanayin natin ito sa pamamagitan ng paggawa ng bagong derive macro! Ang aming bagong macro ay hahayaan kaming awtomatikong bumuo ng lohika ng pagtuturo para sa pag-update ng bawat field sa isang account sa isang Anchor program.

### 1. Starter

Para makapagsimula, i-download ang starter code mula sa `starter` branch ng [repository na ito](https://github.com/Unboxed-Software/anchor-custom-macro/tree/starter).

Kasama sa starter code ang isang simpleng Anchor program na nagbibigay-daan sa iyong magsimula at mag-update ng `Config` account. Ito ay katulad ng ginawa namin sa [Environment Variables lesson](../env-variables.md).

Ang account na pinag-uusapan ay nakaayos tulad ng sumusunod:

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

Ang file na `programs/admin/src/lib.rs` ay naglalaman ng entrypoint ng program na may mga kahulugan ng mga tagubilin ng program. Sa kasalukuyan, ang programa ay may mga tagubilin upang simulan ang account na ito at pagkatapos ay isang tagubilin sa bawat field ng account para sa pag-update ng field.

Ang direktoryo ng `programs/admin/src/admin_config` ay naglalaman ng lohika at estado ng pagtuturo ng programa. Tingnan ang bawat isa sa mga file na ito. Mapapansin mo na ang lohika ng pagtuturo para sa bawat field ay nadoble para sa bawat pagtuturo.

Ang layunin ng demo na ito ay magpatupad ng procedural macro na magpapahintulot sa amin na palitan ang lahat ng mga function ng logic ng pagtuturo at awtomatikong bumuo ng mga function para sa bawat pagtuturo.

### 2. Set up the custom macro declaration

Magsimula tayo sa pamamagitan ng paggawa ng hiwalay na crate para sa aming custom na macro. Sa root directory ng proyekto, patakbuhin ang `cargo new custom-macro`. Gagawa ito ng bagong `custom-macro` na direktoryo na may sarili nitong `Cargo.toml`. I-update ang bagong `Cargo.toml` file upang maging sumusunod:

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

Tinutukoy ng `proc-macro = true` na linya ang crate na ito bilang naglalaman ng procedural macro. Ang mga dependency ay ang lahat ng crates na gagamitin namin para gawin ang aming derive macro.

Susunod, baguhin ang `src/main.rs` sa `src/lib.rs`.

Susunod, i-update ang `Cargo.toml` file ng `members` field ng root ng proyekto upang isama ang `"custom-macro"`:

```text
[workspace]
members = [
    "programs/*",
    "custom-macro"
]
```

Now ang aming crate ay naka-set up at handa nang umalis. Ngunit bago tayo magpatuloy, gumawa tayo ng isa pang crate sa antas ng ugat na magagamit natin upang subukan ang ating macro habang ginagawa natin ito. Gumamit ng `cargo new custom-macro-test` sa root ng proyekto. Pagkatapos ay i-update ang bagong likhang `Cargo.toml` upang magdagdag ng `anchor-lang` at ang `custom-macro` crates bilang dependencies:

```text
[package]
name = "custom-macro-test"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../custom-macro" }
```

Susunod, i-update ang `Cargo.toml` ng root project para isama ang bagong `custom-macro-test` crate tulad ng dati:

```text
[workspace]
members = [
    "programs/*",
    "custom-macro",
    "custom-macro-test"
]
```

Panghuli, palitan ang code sa `custom-macro-test/src/main.rs` ng sumusunod na code. Gagamitin namin ito mamaya para sa pagsubok:

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

Ngayon, sa `custom-macro/src/lib.rs` file, idagdag natin ang ating bagong deklarasyon ng macro. Sa file na ito, gagamitin namin ang macro na `parse_macro_input!` para i-parse ang input na `TokenStream` at i-extract ang mga field ng `ident` at `data` mula sa isang struct ng `DeriveInput`. Pagkatapos, gagamitin namin ang macro na `eprintln!` para i-print ang mga value ng `identity` at `data`. Sa ngayon, gagamitin namin ang `TokenStream::new()` para magbalik ng walang laman na `TokenStream`.

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

Subukan natin kung ano ang na-print nito. Upang gawin ito, kailangan mo munang i-install ang command na `cargo-expand` sa pamamagitan ng pagpapatakbo ng `cargo install cargo-expand`. Kakailanganin mo ring i-install ang gabi-gabi na bersyon ng Rust sa pamamagitan ng pagpapatakbo ng `rustup install nightly`.

Kapag nagawa mo na ito, makikita mo ang output ng code na inilarawan sa itaas sa pamamagitan ng pag-navigate sa `custom-macro-test` na direktoryo at pagpapatakbo ng `cargo expand`.

Pinapalawak ng command na ito ang mga macro sa crate. Dahil ang `main.rs` file ay gumagamit ng bagong likhang `InstructionBuilder` na macro, ipi-print nito ang syntax tree para sa `ident` at `data` ng struct sa console. Kapag nakumpirma mo na ang input na `TokenStream` ay na-parse nang tama, huwag mag-atubiling tanggalin ang `eprintln!` na mga pahayag.

### 4. Get the struct's fields

Susunod, gamitin natin ang mga statement na `match` para makuha ang mga pinangalanang field mula sa `data` ng struct. Pagkatapos ay gagamitin namin ang macro na `eprintln!` upang i-print ang mga halaga ng mga field.

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

Muli, gamitin ang `cargo expand` sa terminal upang makita ang output ng code na ito. Kapag nakumpirma mo na ang mga field ay kinukuha at nai-print nang tama, maaari mong alisin ang `eprintln!` na pahayag.

### 5. Build update instructions

Susunod, ulitin natin ang mga patlang ng struct at bumuo ng pagtuturo sa pag-update para sa bawat field. Ang pagtuturo ay bubuo gamit ang `quote!` na macro at isasama ang pangalan at uri ng field, pati na rin ang isang bagong pangalan ng function para sa pagtuturo sa pag-update.

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

Panghuli, gamitin natin ang macro na `quote!` para bumuo ng pagpapatupad para sa struct na may pangalang tinukoy ng variable na `identity`. Kasama sa pagpapatupad ang mga tagubilin sa pag-update na nabuo para sa bawat field sa struct. Ang nabuong code ay iko-convert sa isang `TokenStream` gamit ang `into()` na paraan at ibabalik bilang resulta ng macro.

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

Upang i-verify na ang macro ay bumubuo ng tamang code, gamitin ang command na `cargo expand` upang makita ang pinalawak na anyo ng macro. Ang output nito ay ganito ang hitsura:

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

Upang gamitin ang bagong macro upang bumuo ng mga tagubilin sa pag-update para sa `Config` struct, idagdag muna ang `custom-macro` crate bilang dependency sa program sa `Cargo.toml` nito:

```text
[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../../custom-macro" }
```

Pagkatapos, mag-navigate sa `state.rs` file sa Anchor program at i-update ito gamit ang sumusunod na code:

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

Susunod, mag-navigate sa `admin_update.rs` file at tanggalin ang mga kasalukuyang tagubilin sa pag-update. Dapat lang itong mag-iwan ng `UpdateAdminAccount` na context struct sa file.

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

Susunod, i-update ang `lib.rs` sa Anchor program upang magamit ang mga tagubilin sa pag-update na nabuo ng macro ng `InstructionBuilder`.

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

Panghuli, mag-navigate sa direktoryo ng `admin` at patakbuhin ang `anchor test` upang i-verify na gumagana nang tama ang mga tagubilin sa pag-update na nabuo ng macro ng `InstructionBuilder`.

```
  admin
    ✔ Is initialized! (160ms)
    ✔ Update bool! (409ms)
    ✔ Update u8! (403ms)
    ✔ Update u64! (406ms)
    ✔ Update Admin! (405ms)


  5 passing (2s)
```

Magaling! Sa puntong ito, maaari kang lumikha ng mga procedural macro upang makatulong sa iyong proseso ng pag-unlad. Hinihikayat ka naming sulitin ang Rust na wika at gumamit ng mga macro kung saan may katuturan ang mga ito. Ngunit kahit na hindi mo gagawin, ang pag-alam kung paano gumagana ang mga ito ay nakakatulong upang maunawaan kung ano ang nangyayari sa Anchor sa ilalim ng hood.

Kung kailangan mong gumugol ng mas maraming oras sa code ng solusyon, huwag mag-atubiling sumangguni sa `solution` branch ng [repository](https://github.com/Unboxed-Software/anchor-custom-macro/tree/solution).

# Challenge

Upang patatagin ang iyong natutunan, magpatuloy at gumawa ng isa pang procedural macro sa iyong sarili. Mag-isip tungkol sa code na iyong isinulat na maaaring bawasan o pagbutihin ng isang macro at subukan ito! Dahil practice pa rin ito, okay lang kung hindi ito gagana sa paraang gusto o inaasahan mo. Tumalon lang at mag-eksperimento!
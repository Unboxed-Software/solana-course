---
title: Macros Procedurais em Rust
objectives:
- Criar e usar Macros Procedurais em Rust
- Explicar e trabalhar com uma Árvore de Sintaxe Abstrata (AST) em Rust
- Descrever como macros procedurais são usadas no framework Anchor
---

# Resumo

-   **Macros Procedurais** são um tipo especial de macro em Rust que permitem ao programador gerar código em tempo de compilação com base em entradas personalizadas.
-   No framework Anchor, macros procedurais são usadas para gerar código que reduz a quantidade de código repetitivo necessário ao escrever programas na Solana.
-   Uma **Árvore de Sintaxe Abstrata (Abstract Syntax Tree, ou AST)** é uma representação da sintaxe e estrutura do código de entrada que é passada para uma macro procedural. Ao criar uma macro, você usa elementos da AST, como tokens e itens, para gerar o código apropriado.
-   Um **Token** é a menor unidade de código-fonte que pode ser analisada pelo compilador em Rust.
-   Um **Item** é uma declaração que define algo que pode ser usado em um programa Rust, como uma struct, enum, trait, função ou método.
-   Um **TokenStream** é uma sequência de tokens que representa um pedaço de código-fonte, que pode ser passado para uma macro procedural para permitir que ela acesse e manipule os tokens individuais no código.

# Visão Geral

Em Rust, uma macro é um pedaço de código que você escreve uma vez e depois "expande" para gerar código em tempo de compilação. Isso pode ser útil quando você precisa gerar código que é repetitivo ou complexo, ou quando você quer usar o mesmo código em vários lugares no seu programa.

Existem dois tipos diferentes de macros: macros declarativas e macros procedurais.

-   Macros declarativas são definidas usando a macro `macro_rules!`, que permite combinar padrões de código e gerar código baseado no padrão correspondente.
-   Macros procedurais em Rust são definidas usando código Rust e operam na árvore de sintaxe abstrata (AST) do TokenStream de entrada, o que permite que elas manipulem e gerem código em um nível de detalhe mais preciso.

Nesta lição, vamos nos concentrar em macros procedurais, que são comumente usadas no framework Anchor.

## Conceitos de Rust

Antes de nos aprofundarmos nas macros, especificamente, vamos falar sobre alguns dos termos importantes, conceitos e ferramentas que estaremos usando ao longo da lição.

### Token

No contexto da programação em Rust, um [token](https://doc.rust-lang.org/reference/tokens.html) é um elemento básico da sintaxe da linguagem, como um identificador ou valor literal. Tokens representam a menor unidade de código-fonte reconhecida pelo compilador do Rust, e são usados para construir expressões e declarações mais complexas em um programa.

Exemplos de tokens Rust incluem:

- [Palavras-chave](https://doc.rust-lang.org/reference/keywords.html), como `fn`, `let` e `match`, são palavras reservadas na linguagem Rust que têm significados especiais.
- [Identificadores](https://doc.rust-lang.org/reference/identifiers.html), como nomes de variáveis e funções, são usados para referenciar valores e funções.
- Marcas de [pontuação](https://doc.rust-lang.org/reference/tokens.html#punctuation), como `{`, `}`, e `;`, são usadas para estruturar e delimitar blocos de código.
- [Literais](https://doc.rust-lang.org/reference/tokens.html#literals), como números e strings, representam valores constantes em um programa Rust.

Você pode [ler mais sobre tokens do Rust aqui](https://doc.rust-lang.org/reference/tokens.html).

### Item

Itens são pedaços de código nomeados e autocontidos em Rust. Eles fornecem uma maneira de agrupar código relacionado e dar-lhe um nome pelo qual o grupo pode ser referenciado. Isso permite reutilizar e organizar seu código de maneira modular.

Existem vários tipos diferentes de itens, como:

- Funções
- Structs
- Enums
- Traits
- Módulos
- Macros

Você pode [ler mais sobre os itens do Rust aqui](https://doc.rust-lang.org/reference/items.html).

### Sequências de Tokens

O tipo `TokenStream` é um tipo de dado que representa uma sequência de tokens. Este tipo é definido no crate `proc_macro` e é apresentado como uma maneira de você escrever macros baseadas em outro código no código-fonte.

Ao definir uma macro procedural, a entrada da macro é passada para a macro como um tipo `TokenStream`, que pode então ser analisado e transformado conforme necessário. O `TokenStream` resultante pode então ser expandido

```rust
use proc_macro::TokenStream;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    ...
}
```

### Árvore de Sintaxe Abstrata

No contexto de uma macro procedural em Rust, uma árvore de sintaxe abstrata (AST) é uma estrutura de dados que representa a estrutura hierárquica dos tokens de entrada e seu significado na linguagem Rust. Ela é tipicamente usada como uma representação intermediária da entrada que pode ser facilmente processada e transformada pela macro procedural.

A macro pode usar a AST para analisar o código de entrada e fazer alterações nele, como adicionar ou remover tokens, ou transformar o significado do código de alguma forma. Ela pode então usar esta AST transformada para gerar um novo código, que pode ser retornado como a saída da macro procedural.

### Crate `syn`

O crate `syn` está disponível para ajudar a analisar uma sequência de tokens em uma AST que o código macro pode percorrer e manipular. Quando uma macro procedural é invocada em um programa Rust, a função macro é chamada com uma sequência de tokens como entrada. Analisar essa entrada é o primeiro passo para praticamente qualquer macro.

Tome como exemplo uma macro procedural que você invoca usando `my_macro!` da seguinte forma:

```rust
my_macro!("hello, world");
```

Quando o código acima é executado, o compilador Rust passa os tokens de entrada (`"hello, world"`) como um `TokenStream` para a macro procedural `my_macro`.

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

Dentro da macro procedural, o código usa a macro `parse_macro_input!` do crate `syn` para analisar o `TokenStream` de entrada em uma árvore de sintaxe abstrata (AST). Especificamente, este exemplo a analisa como uma instância de `LitStr` que representa um literal de string em Rust. A macro `eprintln!` é então usada para imprimir a AST `LitStr` para fins de depuração.

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

A saída da macro `eprintln!` mostra a estrutura da AST `LitStr` que foi gerada a partir dos tokens de entrada. Ela mostra o valor literal da string (`"hello, world"`) e outros metadados sobre o token, como seu tipo (`Str`), sufixo (`None`) e intervalo.

### Crate `quote`

Outro crate importante é o `quote`. Este crate é fundamental na parte de geração de código da macro.

Uma vez que uma macro procedural terminou de analisar e transformar a AST, ela pode usar o crate `quote` ou uma biblioteca similar de geração de código para converter a AST de volta em uma sequência de tokens. Depois disso, ela retorna o `TokenStream`, que o compilador Rust usa para substituir a sequência original no código-fonte.

Tome o exemplo abaixo de `my_macro`:

```rust
use proc_macro::TokenStream;
use syn::parse_macro_input;
use quote::quote;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    let ast = parse_macro_input!(input as syn::LitStr);
    eprintln! {"{:#?}", ast};
    let expanded = {
        quote! {println!("A entrada é: {}", #ast)}
    };
    expanded.into()
}
```

Este exemplo usa a macro `quote!` para gerar um novo `TokenStream` consistindo de uma chamada da macro `println!` com a AST `LitStr` como seu argumento.

Observe que a macro `quote!` gera um `TokenStream` do tipo `proc_macro2::TokenStream`. Para retornar este `TokenStream` ao compilador Rust, você precisa usar o método `.into()` para convertê-lo em `proc_macro::TokenStream`. O compilador Rust então usará este `TokenStream` para substituir a chamada original da macro procedural no código-fonte.

```text
The input is: hello, world
```

Isso permite que você crie macros procedurais que realizam poderosas tarefas de geração de código e metaprogramação.

## Macro Procedural

Macros procedurais em Rust são uma maneira poderosa de estender a linguagem e criar sintaxe personalizada. Essas macros são escritas em Rust e são compiladas junto com o restante do código. Existem três tipos de macros procedurais:

- Macros do tipo função - `custom!(...)`
- Macros de Derivação - `#[derive(CustomDerive)]`
- Macros de Atributo - `#[CustomAttribute]`

Esta seção discutirá os três tipos de macros procedurais e fornecerá um exemplo de implementação de uma. O processo de escrever uma macro procedural é consistente em todos os três tipos, então o exemplo fornecido pode ser adaptado para os outros tipos.

### Macros do tipo função

Macros procedurais do tipo função são as mais simples dos três tipos de macros procedurais. Essas macros são definidas usando uma função precedida pelo atributo `#[proc_macro]`. A função deve receber um `TokenStream` como entrada e retornar um novo `TokenStream` como saída para substituir o código original.

```rust
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

Essas macros são invocadas usando o nome da função seguido do operador `!`. Elas podem ser usadas em vários lugares em um programa Rust, como em expressões, declarações e definições de funções.

```rust
my_macro!(input);
```

Macros do tipo função são mais adequadas para tarefas simples de geração de código que requerem apenas uma única entrada e saída. Elas são fáceis de entender e usar, e fornecem uma maneira direta de gerar código em tempo de compilação.

### Macros de Atributo

Macros de atributo definem novos atributos que são anexados a itens em um programa Rust, como funções e structs.

```rust
#[my_macro]
fn my_function() {
	...
}
```

Macros de atributo são definidas com uma função precedida pelo atributo `#[proc_macro_attribute]`. A função requer duas sequências de tokens como entrada e retorna um único `TokenStream` como saída que substitui o item original com um número arbitrário de novos itens.

```rust
#[proc_macro_attribute]
pub fn my_macro(attr: TokenStream, input: TokenStream) -> TokenStream {
    ...
}
```

A primeira entrada da sequência de tokens representa os argumentos do atributo. A segunda sequência de tokens é o restante do item ao qual o atributo está anexado, incluindo quaisquer outros atributos que possam estar presentes.

```rust
#[my_macro(arg1, arg2)]
fn my_function() {
    ...
}
```

Por exemplo, uma macro de atributo pode processar os argumentos passados para o atributo para habilitar ou desabilitar certos recursos e, em seguida, usar a segunda sequência de tokens para modificar o item original de alguma forma. Ao ter acesso a ambas as sequências de tokens, macros de atributo podem fornecer maior flexibilidade e funcionalidade em comparação com o uso de apenas uma única sequência de tokens.

### Macros de Derivação

Macros de derivação são invocadas usando o atributo `#[derive]` em uma struct, enum ou union, e são tipicamente usadas para implementar automaticamente traits para os tipos de entrada.

```rust
#[derive(MyMacro)]
struct Input {
	field: String
}
```

Macros de derivação são definidas com uma função precedida pelo atributo `#[proc_macro_derive]`. Elas são limitadas a gerar código para structs, enums e unions. Elas recebem uma única sequência de tokens como entrada e retornam uma única sequência de tokens como saída.

Ao contrário das outras macros procedurais, a sequência de tokens retornada não substitui o código original. Em vez disso, a sequência de tokens retornada é anexada ao módulo ou bloco ao qual o item original pertence. Isso permite que os desenvolvedores estendam a funcionalidade do item original sem modificar o código original.

```rust
#[proc_macro_derive(MyMacro)]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

Além de implementar traits, macros de derivação podem definir atributos auxiliares. Atributos auxiliares podem ser usados no escopo do item ao qual a macro de derivação é aplicada e personalizar o processo de geração de código.

```rust
#[proc_macro_derive(MyMacro, attributes(helper))]
pub fn my_macro(body: TokenStream) -> TokenStream {
    ...
}
```

Atributos auxiliares são inertes, o que significa que eles não têm nenhum efeito por si só, e seu único propósito é serem usados como entrada para a macro de derivação que os definiu.

```rust
#[derive(MyMacro)]
struct Input {
    #[helper]
    field: String
}
```

Por exemplo, uma macro de derivação pode definir um atributo auxiliar para realizar operações adicionais dependendo da presença do atributo. Isso permite que os desenvolvedores ampliem ainda mais a funcionalidade das macros de derivação e personalizem o código que elas geram de uma maneira mais flexível.

### Exemplo de uma Macro Procedural

Este exemplo mostra como usar uma macro procedural de derivação para gerar automaticamente uma implementação do método `describe()`

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

O método `describe()` imprimirá uma descrição dos campos da struct no console.

```text
MyStruct is a struct with these named fields: my_string, my_number.
```

O primeiro passo é definir a macro procedural usando o atributo `#[proc_macro_derive]`. O `TokenStream` de entrada é analisado usando a macro `parse_macro_input!()` para extrair o identificador da struct e os dados.

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

O próximo passo é usar a palavra-chave `match` para realizar a correspondência de padrões no valor `data` para extrair os nomes dos campos na struct.

O primeiro `match` tem dois braços: um para a variante `syn::Data::Struct`, e outro para o braço "coringa" `_`, que lida com todas as outras variantes de `syn::Data`.

O segundo `match` também tem dois braços: um para a variante `syn::Fields::Named`, e outro para o braço "coringa" `_`, que lida com todas as outras variantes de `syn::Fields`.

A sintaxe `#(#idents), *` especifica que o iterador `idents` será "expandido" para criar uma lista separada por vírgulas dos elementos no iterador.

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
                    "uma struct com estes campos nomeados: {}",
                    quote! {#(#idents), *},
                )
            }
            _ => panic!("A variante syn::Fields não é suportada"),
        },
        _ => panic!("A variante syn::Data não é suportada"),
    };
    ...
}
```

O último passo é implementar um método `describe()` para uma struct. A variável `expanded` é definida usando a macro `quote!` e a palavra-chave `impl` para criar uma implementação para o nome da struct armazenado na variável `#ident`.

Esta implementação define o método `describe()` que usa a macro `println!` para imprimir o nome da struct e os nomes de seus campos.

Finalmente, a variável `expanded` é convertida em um `TokenStream` usando o método `into()`.

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
                    "uma struct com estes campos nomeados: {}",
                    quote! {#(#idents), *},
                )
            }
            _ => panic!("A variante syn::Fields não é suportada"),
        },
        _ => panic!("A variante syn::Data não é suportada"),
    };

    let expanded = quote! {
        impl #ident {
            fn describe() {
            println!("{} é {}.", stringify!(#ident), #field_names);
            }
        }
    };

    expanded.into()
}
```

Agora, quando o atributo `#[derive(Describe)]` é adicionado a uma struct, o compilador Rust gera automaticamente uma implementação do método `describe()` que pode ser chamado para imprimir o nome da struct e os nomes de seus campos.

```rust
#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}
```

O comando `cargo expand` do crate `cargo-expand` pode ser usado para expandir código Rust que usa macros procedurais. Por exemplo, o código para a struct `MyStruct` gerado usando o atributo `#[derive(Describe)]` se parece com isto:

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
                    &["", " é ", ".\n"],
                    &[
                        ::core::fmt::ArgumentV1::new_display(&"MyStruct"),
                        ::core::fmt::ArgumentV1::new_display(
                            &"uma struct com estes campos nomeados: my_string, my_number",
                        ),
                    ],
                ),
            );
        };
    }
}
```

## Macros Procedurais do Anchor

Macros procedurais são a magia por trás da biblioteca Anchor, comumente usada no desenvolvimento Solana. Macros Anchor permitem um código mais sucinto, verificações de segurança comuns e mais. Vamos passar por alguns exemplos de como o Anchor usa macros procedurais.

### Macro do tipo função

A macro `declare_id` mostra como macros do tipo função são usadas no Anchor. Esta macro recebe uma string de caracteres representando um ID de programa como entrada e a converte em um tipo `Pubkey` que pode ser usado no programa Anchor.

```rust
declare_id!("G839pmstFmKKGEVXRGnauXxFgzucvELrzuyk6gHTiK7a");
```

A macro `declare_id` é definida usando o atributo `#[proc_macro]`, indicando que é uma macro procedural do tipo função.

```rust
#[proc_macro]
pub fn declare_id(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let id = parse_macro_input!(input as id::Id);
    proc_macro::TokenStream::from(quote! {#id})
}
```

### Macro de Derivação

A macro `#[derive(Accounts)]` é um exemplo de apenas uma das muitas macros derive usadas no Anchor.

A macro `#[derive(Accounts)]` gera código que implementa o trait `Accounts` para a struct dada. Este trait faz várias coisas, incluindo validar e desserializar as contas passadas para uma instrução. Isso permite que a struct seja usada como uma lista de contas necessárias por uma instrução em um programa Anchor.

Quaisquer restrições especificadas nos campos pelo atributo `#[account(..)]` são aplicadas durante a desserialização. O atributo `#[instruction(..)]` também pode ser adicionado para especificar os argumentos da instrução e torná-los acessíveis à macro.

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

Esta macro é definida usando o atributo `proc_macro_derive`, o que permite que ela seja usada como uma macro de derivação que pode ser aplicada a uma struct. A linha `#[proc_macro_derive(Accounts, attributes(account, instruction))]` indica que esta é uma macro de derivação que processa os atributos auxiliares `account` e `instruction`.

```rust
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn derive_anchor_deserialize(item: TokenStream) -> TokenStream {
    parse_macro_input!(item as anchor_syn::AccountsStruct)
        .to_token_stream()
        .into()
}
```

### Macro de Atributo `#[program]`

A macro de atributo `#[program]` é um exemplo de uma macro de atributo usada no Anchor para definir o módulo contendo manipuladores de instruções para um programa Solana.

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ...
    }
}
```

Neste caso, o atributo `#[program]` é aplicado a um módulo e é usado para especificar que o módulo contém manipuladores de instruções para um programa Solana.

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

Em geral, o uso de macros procedurais no Anchor reduz imensamente a quantidade de código repetitivo que os desenvolvedores Solana têm que escrever. Ao reduzir a quantidade de código repetitivo, os desenvolvedores podem se concentrar na funcionalidade central do seu programa e evitar erros causados pela repetição manual. Isso resulta em um processo de desenvolvimento mais rápido e eficiente.

# Demonstração

Vamos praticar isso criando uma nova macro de derivação! Nossa nova macro nos permitirá gerar automaticamente lógica de instrução para atualizar cada campo em uma conta em um programa Anchor.

### 1. Código inicial

Para começar, baixe o código inicial da branch `starter` deste [repositório](https://github.com/Unboxed-Software/anchor-custom-macro/tree/starter).

O código inicial inclui um simples programa Anchor que permite inicializar e atualizar uma conta `Config`. Isso é semelhante ao que fizemos na [lição de Variáveis de Ambiente](./env-variables.md).

A conta em questão é estruturada da seguinte forma:

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

O arquivo `programs/admin/src/lib.rs` contém o ponto de entrada do programa com as definições das instruções do programa. Atualmente, o programa tem instruções para inicializar esta conta e depois uma instrução por campo da conta para atualizar o campo.

O diretório `programs/admin/src/admin_config` contém a lógica de instrução e estado do programa. Dê uma olhada em cada um desses arquivos. Você notará que a lógica de instrução para cada campo é duplicada para cada instrução.

O objetivo desta demonstração é implementar uma macro procedural que nos permitirá substituir todas as funções de lógica de instrução e gerar automaticamente funções para cada instrução.

### 2. Configurando a declaração da macro personalizada

Vamos começar criando um crate separado para nossa macro personalizada. No diretório raiz do projeto, execute `cargo new custom-macro`. Isso criará um novo diretório `custom-macro` com seu próprio `Cargo.toml`. Atualize o novo arquivo `Cargo.toml` para ser o seguinte:

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

A linha `proc-macro = true` define esse crate como contendo uma macro procedural. As dependências são todos os crates que usaremos para criar nossa macro de derivação.

Em seguida, mude `src/main.rs` para `src/lib.rs`.

Logo depois, atualize o arquivo `Cargo.toml` na raiz do projeto no campo `members` para incluir `"custom-macro"`:

```text
[workspace]
members = [
    "programs/*",
    "custom-macro"
]
```

Agora nosso crate está configurado e pronto para uso. Mas antes de prosseguir, vamos criar mais um crate no nível raiz que podemos usar para testar nossa macro conforme a criamos. Use `cargo new custom-macro-test` na raiz do projeto. Depois, atualize o recém-criado `Cargo.toml` para adicionar os crates `anchor-lang` e `custom-macro` como dependências:

```text
[package]
name = "custom-macro-test"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../custom-macro" }
```

Em seguida, atualize o `Cargo.toml` do projeto raiz para incluir o novo crate `custom-macro-test` como antes:

```text
[workspace]
members = [
    "programs/*",
    "custom-macro",
    "custom-macro-test"
]
```

Finalmente, substitua o código em `custom-macro-test/src/main.rs` pelo seguinte código. Usaremos isso mais tarde para testar:

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

### 3. Definindo a macro personalizada

Agora, no arquivo `custom-macro/src/lib.rs`, vamos adicionar a declaração da nossa nova macro. Neste arquivo, usaremos a macro `parse_macro_input!` para analisar o `TokenStream` de entrada e extrair os campos `ident` e `data` de uma struct `DeriveInput`. Em seguida, usaremos a macro `eprintln!` para imprimir os valores de `ident` e `data`. Por enquanto, usaremos `TokenStream::new()` para retornar um `TokenStream` vazio.

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

Vamos testar para ver o que isso imprime. Para fazer isso, você primeiro precisa instalar o comando `cargo-expand` executando `cargo install cargo-expand`. Você também precisará instalar a versão nightly do Rust executando `rustup install nightly`.

Uma vez feito isso, você pode ver a saída do código descrito acima navegando até o diretório `custom-macro-test` e executando `cargo expand`.

Este comando expande macros no crate. Como o arquivo `main.rs` usa a macro `InstructionBuilder` recém-criada, isso imprimirá a árvore sintática para os campos `ident` e `data` da struct no console. Uma vez confirmado que o `TokenStream` de entrada está sendo analisado corretamente, sinta-se à vontade para remover as declarações `eprintln!`.

### 4. Obtendo os campos da struct

Em seguida, vamos usar declarações `match` para obter os campos nomeados de `data` da struct. Em seguida, usaremos a macro `eprintln!` para imprimir os valores dos campos.

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
            _ => panic!("A variante syn::Fields não é suportada: {:#?}", s.fields),
        },
        _ => panic!("A variante syn::Data não é suportada: {:#?}", data),
    };

    eprintln! {"{:#?}", fields};

    TokenStream::new()
}
```

Mais uma vez, use `cargo expand` no terminal para ver a saída deste código. Uma vez confirmado que os campos estão sendo extraídos e impressos corretamente, você pode remover a declaração `eprintln!`.

### 5. Construindo instruções de atualização

Em seguida, vamos iterar sobre os campos da struct e gerar uma instrução de atualização para cada campo. A instrução será gerada usando a macro `quote!` e incluirá o nome e o tipo do campo, bem como um novo nome de função para a instrução de atualização.

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
            _ => panic!("A variante syn::Fields não é suportada: {:#?}", s.fields),
        },
        _ => panic!("A variante syn::Data não é suportada: {:#?}", data),
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

### 6. Retornando um novo `TokenStream`

Por último, vamos usar a macro `quote!` para gerar uma implementação para a struct com o nome especificado pela variável `ident`. A implementação inclui as instruções de atualização que foram geradas para cada campo da struct. O código gerado é então convertido em um tipo `TokenStream` usando o método `into()` e retornado como o resultado da macro.

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
            _ => panic!("A variante syn::Fields não é suportada: {:#?}", s.fields),
        },
        _ => panic!("A variante syn::Data não é suportada: {:#?}", data),
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

Para verificar se a macro está gerando o código correto, use o comando `cargo expand` para ver a forma expandida da macro. A saída disso deve se parecer com o seguinte:

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

### 7. Atualizando o programa para usar sua nova macro

Para usar a nova macro para gerar instruções de atualização para a struct `Config`, primeiro adicione o crate `custom-macro` como uma dependência ao programa em seu `Cargo.toml`:

```text
[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../../custom-macro" }
```

Em seguida, navegue até o arquivo `state.rs` no programa Anchor e atualize-o com o seguinte código:

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

Logo depois, navegue até o arquivo `admin_update.rs` e delete as instruções de atualização existentes. Isso deve deixar apenas a struct de contexto `UpdateAdminAccount` no arquivo.

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

Em seguida, atualize `lib.rs` no programa Anchor para usar as instruções de atualização geradas pela macro `InstructionBuilder`.

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

Por último, navegue até o diretório `admin` e execute `anchor test` para verificar se as instruções de atualização geradas pela macro `InstructionBuilder` estão funcionando corretamente.

```
  admin
    ✔ Is initialized! (160ms)
    ✔ Update bool! (409ms)
    ✔ Update u8! (403ms)
    ✔ Update u64! (406ms)
    ✔ Update Admin! (405ms)


  5 passing (2s)
```

Excelente trabalho! Neste ponto, você pode criar macros procedurais para ajudar no seu processo de desenvolvimento. Encorajamos você a fazer o máximo uso da linguagem Rust e usar macros onde fizerem sentido. Mas mesmo que você não o faça, saber como elas funcionam ajuda a entender o que está acontecendo com o Anchor internamente.

Se precisar passar mais tempo com o código da solução, sinta-se à vontade para consultar a branch `solution` deste [repositório](https://github.com/Unboxed-Software/anchor-custom-macro/tree/solution).

# Desafio

Para consolidar o que você aprendeu, vá em frente e crie outra macro procedural por conta própria. Pense em códigos que você escreveu que poderiam ser reduzidos ou melhorados por uma macro e experimente! Como ainda estamos praticando, não tem problema se não funcionar da maneira que você quer ou espera. Apenas mergulhe e experimente!
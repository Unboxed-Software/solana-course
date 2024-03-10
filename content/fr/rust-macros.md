---
title: Macros procédurales en Rust
objectives:
- Créer et utiliser des **macros procédurales** en Rust
- Expliquer et travailler avec un Abstract Syntax Tree (AST) en Rust
- Décrire comment les macros procédurales sont utilisées dans le framework Anchor
---

# Résumé

- Les **macros procédurales** sont une sorte spéciale de macro Rust qui permet au programmeur de générer du code au moment de la compilation en fonction d'une entrée personnalisée.
- Dans le framework Anchor, les macros procédurales sont utilisées pour générer du code qui réduit la quantité de code répétitif nécessaire lors de l'écriture de programmes Solana.
- Un **Abstract Syntax Tree (AST)** est une représentation de la syntaxe et de la structure du code d'entrée qui est transmis à une macro procédurale. Lors de la création d'une macro, vous utilisez des éléments de l'AST tels que des tokens et des items pour générer le code approprié.
- Un **Token** est l'unité la plus petite de code source pouvant être analysée par le compilateur Rust.
- Un **Item** est une déclaration qui définit quelque chose pouvant être utilisé dans un programme Rust, tel qu'une struct, une énumération, un trait, une fonction ou une méthode.
- Un **TokenStream** est une séquence de tokens qui représente un morceau de code source et peut être transmis à une macro procédurale pour lui permettre d'accéder et de manipuler les tokens individuels dans le code.

# Aperçu général

En Rust, une macro est un morceau de code que vous pouvez écrire une fois et ensuite "développer" pour générer du code au moment de la compilation. Cela peut être utile lorsque vous devez générer du code répétitif ou complexe, ou lorsque vous souhaitez utiliser le même code à plusieurs endroits dans votre programme.

Il existe deux types de macros différents : les macros déclaratives et les macros procédurales.

- Les macros déclaratives sont définies à l'aide de la macro `macro_rules!`, qui vous permet de faire correspondre des motifs de code et de générer du code en fonction du motif correspondant.
- Les macros procédurales en Rust sont définies à l'aide de code Rust et opèrent sur l'Abstract Syntax Tree (AST) du TokenStream d'entrée, ce qui leur permet de manipuler et de générer du code à un niveau de détail plus fin.

Dans cette leçon, nous nous concentrerons sur les macros procédurales, qui sont couramment utilisées dans le framework Anchor.

## Concepts Rust

Avant de plonger dans les macros, parlons de certains des termes, concepts et outils importants que nous utiliserons tout au long de la leçon.

### Token

Dans le contexte de la programmation Rust, un [token](https://doc.rust-lang.org/reference/tokens.html) est un élément de base de la syntaxe du langage, tel qu'un identifiant ou une valeur littérale. Les tokens représentent l'unité la plus petite de code source reconnue par le compilateur Rust, et ils sont utilisés pour construire des expressions et des instructions plus complexes dans un programme.

Des exemples de tokens Rust incluent :

- [Mots-clés](https://doc.rust-lang.org/reference/keywords.html), tels que `fn`, `let` et `match`, sont des mots réservés dans le langage Rust ayant des significations spéciales.
- [Identifiants](https://doc.rust-lang.org/reference/identifiers.html), tels que les noms de variables et de fonctions, sont utilisés pour faire référence à des valeurs et des fonctions.
- [Marques de ponctuation](https://doc.rust-lang.org/reference/tokens.html#punctuation), telles que `{`, `}` et `;`, sont utilisées pour structurer et délimiter des blocs de code.
- [Littéraux](https://doc.rust-lang.org/reference/tokens.html#literals), tels que des nombres et des chaînes, représentent des valeurs constantes dans un programme Rust.

Vous pouvez [en savoir plus sur les tokens Rust ici](https://doc.rust-lang.org/reference/tokens.html).

### Item

Les items sont des morceaux de code nommés et indépendants en Rust. Ils fournissent un moyen de regrouper du code connexe et de lui donner un nom par lequel le groupe peut être référencé. Cela vous permet de réutiliser et d'organiser votre code de manière modulaire.

Il existe plusieurs types d'items, tels que :

- Fonctions
- Structs
- Enums
- Traits
- Modules
- Macros

Vous pouvez [en savoir plus sur les items Rust ici](https://doc.rust-lang.org/reference/items.html).

### Token Streams

Le type `TokenStream` est un type de données qui représente une séquence de tokens. Ce type est défini dans la crate `proc_macro` et est exposé comme une manière pour vous d'écrire des macros basées sur d'autres codes dans la base de code.

Lors de la définition d'une macro procédurale, l'entrée de la macro est transmise à la macro sous forme de `TokenStream`, qui peut ensuite être analysé et transformé selon les besoins. Le `TokenStream` résultant peut ensuite être développé pour produire le code final généré par la macro.

```rust
use proc_macro::TokenStream;

#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
    ...
}
```

### Abstract Syntax Tree

Dans le contexte d'une macro procédurale Rust, un abstract syntax tree (AST) est une structure de données qui représente la structure hiérarchique des tokens d'entrée et leur signification dans le langage Rust. Il est généralement utilisé comme une représentation intermédiaire de l'entrée qui peut être facilement traitée et transformée par la macro procédurale.

La macro peut utiliser l'AST pour analyser le code d'entrée et y apporter des modifications, telles que l'ajout ou la suppression de tokens, ou la transformation de la signification du code d'une manière ou d'une autre. Elle peut ensuite utiliser cet AST transformé pour générer un nouveau code, qui peut être renvoyé en sortie de la macro procédurale.

### La crate `syn`

La crate `syn` est disponible pour aider à analyser un token stream en un AST que le code de la macro peut traverser et manipuler. Lorsqu'une macro procédurale est invoquée dans un programme Rust, la fonction macro est appelée avec un token stream en entrée. L'analyse de cette entrée est la première étape pour pratiquement n'importe quelle macro.

Prenons comme exemple une macro procédurale que vous invoquez avec `my_macro!` comme suit :

```rust
my_macro!("hello, world");
```

Lorsque le code ci-dessus est exécuté, le compilateur Rust passe les tokens d'entrée (`"hello, world"`) en tant que `TokenStream` à la macro procédurale `my_macro`.

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

À l'intérieur de la macro procédurale, le code utilise la macro `parse_macro_input!` de la crate `syn` pour analyser le `TokenStream` d'entrée en tant qu'abstract syntax tree (AST). Plus précisément, cet exemple l'analyse en tant qu'instance de `LitStr` qui représente une chaîne littérale en Rust. La macro `eprintln!` est ensuite utilisée pour imprimer l'AST `LitStr` à des fins de débogage.

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

La sortie de la macro `eprintln!` montre la structure de l'AST `LitStr` qui a été générée à partir des tokens d'entrée. Elle montre la valeur de la chaîne littérale (`"hello, world"`) et d'autres métadonnées sur le token, telles que son type (`Str`), son suffixe (`None`) et sa portée (`span`).

### La crate `quote`

Une autre crate importante est la crate `quote`. Cette crate est cruciale dans la partie de génération de code de la macro.

Une fois qu'une macro procédurale a fini d'analyser et de transformer l'AST, elle peut utiliser la crate `quote` ou une bibliothèque similaire de génération de code pour convertir l'AST en un token stream. Ensuite, elle renvoie le `TokenStream`, que le compilateur Rust utilise pour remplacer le stream original dans le code source.

Prenons l'exemple suivant de `my_macro` :

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

Cet exemple utilise la macro `quote!` pour générer un nouveau `TokenStream` composé d'un appel à la macro `println!` avec l'AST `LitStr` comme argument.

Remarquez que la macro `quote!` génère un `TokenStream` de type `proc_macro2::TokenStream`. Pour renvoyer ce `TokenStream` au compilateur Rust, vous devez utiliser la méthode `.into()` pour le convertir en `proc_macro::TokenStream`. Le compilateur Rust utilisera ensuite ce `TokenStream` pour remplacer l'appel original de la macro procédurale dans le code source.

```text
The input is: hello, world
```

Cela vous permet de créer des macros procédurales qui effectuent des tâches puissantes de génération de code et de métaprogrammation.

## Macro Procédurale

Les macros procédurales en Rust sont un moyen puissant d'étendre le langage et de créer une syntaxe personnalisée. Ces macros sont écrites en Rust et sont compilées avec le reste du code. Il existe trois types de macros procédurales :

- Macros de type fonction - `custom!(...)`
- Macros dérivées - `#[derive(CustomDerive)]`
- Macros attributaires - `#[CustomAttribute]`

Cette section discutera des trois types de macros procédurales et fournira un exemple d'implémentation. Le processus d'écriture d'une macro procédurale est cohérent pour les trois types, donc l'exemple fourni peut être adapté aux autres types.

### Macros de type fonction

Les macros procédurales de type fonction sont les plus simples des trois types de macros procédurales. Ces macros sont définies à l'aide d'une fonction précédée de l'attribut `#[proc_macro]`. La fonction doit prendre un `TokenStream` en entrée et renvoyer un nouveau `TokenStream` en sortie pour remplacer le code original.

```rust
#[proc_macro]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

Ces macros sont invoquées en utilisant le nom de la fonction suivi de l'opérateur `!`. Elles peuvent être utilisées à divers endroits dans un programme Rust, tels que dans des expressions, des déclarations et des définitions de fonctions.

```rust
my_macro!(input);
```

Les macros procédurales de type fonction sont les mieux adaptées aux tâches simples de génération de code nécessitant un seul flux d'entrée et de sortie. Elles sont faciles à comprendre et à utiliser, et elles fournissent un moyen simple de générer du code au moment de la compilation.

### Macros attributaires

Les macros attributaires définissent de nouveaux attributs qui sont attachés à des éléments dans un programme Rust tels que des fonctions et des structs.

```rust
#[my_macro]
fn my_function() {
	...
}
```

Les macros attributaires sont définies avec une fonction précédée de l'attribut `#[proc_macro_attribute]`. La fonction prend deux flux de tokens en entrée et renvoie un seul `TokenStream` en sortie qui remplace l'élément original par un nombre arbitraire de nouveaux éléments.

```rust
#[proc_macro_attribute]
pub fn my_macro(attr: TokenStream, input: TokenStream) -> TokenStream {
    ...
}
```

Le premier flux de tokens en entrée représente les arguments de l'attribut. Le deuxième flux de tokens est le reste de l'élément auquel l'attribut est attaché, y compris tout autre attribut qui pourrait être présent.

```rust
#[my_macro(arg1, arg2)]
fn my_function() {
    ...
}
```

Par exemple, une macro attributaire pourrait traiter les arguments passés à l'attribut pour activer ou désactiver certaines fonctionnalités, puis utiliser le deuxième flux de tokens pour modifier l'élément original d'une manière ou d'une autre. En ayant accès aux deux flux de tokens, les macros attributaires peuvent offrir une plus grande flexibilité et fonctionnalité par rapport à l'utilisation d'un seul flux de tokens.

### Macros dérivées

Les macros dérivées sont invoquées à l'aide de l'attribut `#[derive]` sur une struct, une énumération ou une union, et sont généralement utilisées pour implémenter automatiquement des traits pour les types d'entrée.

```rust
#[derive(MyMacro)]
struct Input {
	field: String
}
```

Les macros dérivées sont définies avec une fonction précédée de l'attribut `#[proc_macro_derive]`. Elles sont limitées à la génération de code pour les structs, les énumérations et les unions. Elles prennent un seul flux de tokens en entrée et renvoient un seul flux de tokens en sortie.

Contrairement aux autres macros procédurales, le flux de tokens renvoyé ne remplace pas le code original. Il est plutôt ajouté au module ou au bloc auquel appartient l'élément original. Cela permet aux développeurs d'étendre la fonctionnalité de l'élément original sans modifier le code original.

```rust
#[proc_macro_derive(MyMacro)]
pub fn my_macro(input: TokenStream) -> TokenStream {
	...
}
```

En plus d'implémenter des traits, les macros dérivées peuvent définir des attributs d'aide. Les attributs d'aide peuvent être utilisés dans la portée de l'élément auquel la macro dérivée est appliquée et personnaliser le processus de génération de code.

```rust
#[proc_macro_derive(MyMacro, attributes(helper))]
pub fn my_macro(body: TokenStream) -> TokenStream {
    ...
}
```

Les attributs d'aide sont inertes, ce qui signifie qu'ils n'ont aucun effet par eux-mêmes, et leur seule utilité est d'être utilisés comme entrée pour la macro dérivée qui les a définis.

```rust
#[derive(MyMacro)]
struct Input {
    #[helper]
    field: String
}
```

Par exemple, une macro dérivée pourrait définir un attribut d'aide pour effectuer des opérations supplémentaires en fonction de la présence de l'attribut. Cela permet aux développeurs d'étendre davantage la fonctionnalité des macros dérivées et de personnaliser le code qu'elles génèrent de manière plus flexible.

### Exemple d'une macro procédurale

Cet exemple montre comment utiliser une macro procédurale dérivée pour générer automatiquement une implémentation d'une méthode `describe()` pour une struct.

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

La méthode `describe()` affichera une description des champs de la struct sur la console.

```text
MyStruct is a struct with these named fields: my_string, my_number.
```

La première étape est de définir la macro procédurale en utilisant l'attribut `#[proc_macro_derive]`. L'entrée `TokenStream` est analysée en utilisant la macro `parse_macro_input!()` pour extraire l'identifiant et les données de la struct.

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

La prochaine étape est d'utiliser le mot-clé `match` pour effectuer une correspondance de motifs sur la valeur `data` afin d'extraire les noms des champs de la struct.

Le premier `match` a deux branches : une pour la variante `syn::Data::Struct`, et une pour la branche "catch-all" `_` qui gère toutes les autres variantes de `syn::Data`.

Le deuxième `match` a également deux branches : une pour la variante `syn::Fields::Named`, et une pour la branche "catch-all" `_` qui gère toutes les autres variantes de `syn::Fields`.

La syntaxe `#(#idents), *` spécifie que l'itérateur `idents` sera "étendu" pour créer une liste séparée par des virgules des éléments dans l'itérateur.

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

La dernière étape est d'implémenter une méthode `describe()` pour une struct. La variable `expanded` est définie en utilisant la macro `quote!` et le mot-clé `impl` pour créer une implémentation pour le nom de la struct stocké dans `#ident`.

Cette implémentation définit la méthode `describe()` qui utilise la macro `println!` pour afficher le nom de la struct et ses noms de champs.

Enfin, la variable `expanded` est convertie en un `TokenStream` en utilisant la méthode `into()`.

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

Maintenant, lorsque l'attribut `#[derive(Describe)]` est ajouté à une structure, le compilateur Rust génère automatiquement une implémentation de la méthode `describe()` qui peut être appelée pour afficher le nom de la structure et les noms de ses champs.

```rust
#[derive(Describe)]
struct MyStruct {
    my_string: String,
    my_number: u64,
}
```

La commande `cargo expand` du crate `cargo-expand` peut être utilisée pour étendre le code Rust qui utilise des macros procédurales. Par exemple, le code de la structure `MyStruct` généré en utilisant l'attribut `#[derive(Describe)]` ressemble à ceci :

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

## Macros procédurales Anchor

Les macros procédurales sont la magie derrière la bibliothèque Anchor largement utilisée dans le développement Solana. Les macros Anchor permettent un code plus succinct, des vérifications de sécurité courantes, et bien plus. Examinons quelques exemples de la façon dont Anchor utilise les macros procédurales.

### Macro de type fonction

La macro `declare_id` montre comment les macros de type fonction sont utilisées dans Anchor. Cette macro prend en entrée une chaîne de caractères représentant l'ID d'un programme et la convertit en un type `Pubkey` qui peut être utilisé dans le programme Anchor.

```rust
declare_id!("G839pmstFmKKGEVXRGnauXxFgzucvELrzuyk6gHTiK7a");
```

La macro `declare_id` est définie avec l'attribut `#[proc_macro]`, indiquant qu'il s'agit d'une macro procédurale de type fonction.

```rust
#[proc_macro]
pub fn declare_id(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let id = parse_macro_input!(input as id::Id);
    proc_macro::TokenStream::from(quote! {#id})
}
```

### Macro dérivée

L'attribut `#[derive(Accounts)]` est un exemple parmi tant d'autres de macros dérivées utilisées dans Anchor.

La macro `#[derive(Accounts)]` génère du code qui implémente le trait `Accounts` pour la structure donnée. Ce trait effectue plusieurs tâches, notamment la validation et la désérialisation des comptes passés à une instruction. Cela permet d'utiliser la structure comme une liste de comptes requise par une instruction dans un programme Anchor.

Toutes les contraintes spécifiées sur les champs par l'attribut `#[account(..)]` sont appliquées lors de la désérialisation. L'attribut `#[instruction(..)]` peut également être ajouté pour spécifier les arguments de l'instruction et les rendre accessibles à la macro.

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

Cette macro est définie avec l'attribut `#[proc_macro_derive(Accounts, attributes(account, instruction))]`, indiquant qu'il s'agit d'une macro dérivée qui traite les attributs d'aide `account` et `instruction`.

```rust
#[proc_macro_derive(Accounts, attributes(account, instruction))]
pub fn derive_anchor_deserialize(item: TokenStream) -> TokenStream {
    parse_macro_input!(item as anchor_syn::AccountsStruct)
        .to_token_stream()
        .into()
}
```

### Macro attributaire `#[program]`

La macro attributaire `#[program]` est un exemple de macro attributaire utilisée dans Anchor pour définir le module contenant les gestionnaires d'instructions pour un programme Solana.

```rust
#[program]
pub mod my_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        ...
    }
}
```

Dans ce cas, l'attribut `#[program]` est appliqué à un module, et il est utilisé pour spécifier que le module contient les gestionnaires d'instructions pour un programme Solana.

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

Dans l'ensemble, l'utilisation de macros procédurales dans Anchor réduit considérablement la quantité de code répétitif que les développeurs Solana doivent écrire. En réduisant la quantité de code redondant, les développeurs peuvent se concentrer sur la fonctionnalité centrale de leur programme et éviter les erreurs causées par la répétition manuelle. Cela se traduit finalement par un processus de développement plus rapide et plus efficace.

# Laboratoire

Pratiquons cela en créant une nouvelle macro dérivée ! Notre nouvelle macro nous permettra de générer automatiquement la logique des instructions pour mettre à jour chaque champ d'un compte dans un programme Anchor.

### 1. Débutant

Pour commencer, téléchargez le code de départ depuis la branche `starter` de [ce dépôt](https://github.com/Unboxed-Software/anchor-custom-macro/tree/starter).

Le code de départ comprend un programme Anchor simple qui vous permet d'initialiser et de mettre à jour un compte `Config`. C'est similaire à ce que nous avons fait avec la [leçon sur les variables d'environnement](./env-variables).

Le compte en question est structuré comme suit :

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

Le fichier `programs/admin/src/lib.rs` contient le point d'entrée du programme avec les définitions des instructions du programme. Actuellement, le programme a des instructions pour initialiser ce compte, puis une instruction par champ de compte pour mettre à jour le champ.

Le répertoire `programs/admin/src/admin_config` contient la logique et l'état des instructions du programme. Parcourez chacun de ces fichiers. Vous remarquerez que la logique des instructions pour chaque champ est dupliquée pour chaque instruction.

L'objectif de ce laboratoire est de mettre en œuvre une macro procédurale qui nous permettra de remplacer toutes les fonctions de logique d'instruction et de générer automatiquement des fonctions pour chaque instruction.

### 2. Configuration de la déclaration de la macro personnalisée

Commençons par créer une crate séparée pour notre macro personnalisée. Dans le répertoire racine du projet, exécutez `cargo new custom-macro`. Cela créera un nouveau répertoire `custom-macro` avec son propre `Cargo.toml`. Mettez à jour le nouveau fichier `Cargo.toml` comme suit :

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

La ligne `proc-macro = true` définit cette crate comme contenant une macro procédurale. Les dépendances sont toutes les crates que nous utiliserons pour créer notre macro dérivée.

Ensuite, renommez `src/main.rs` en `src/lib.rs`.

Ensuite, mettez à jour le champ `members` du fichier `Cargo.toml` du projet racine pour inclure `"custom-macro"` :

```text
[workspace]
members = [
    "programs/*",
    "custom-macro"
]
```

Maintenant, notre crate est configurée et prête à être utilisée. Mais avant de passer à autre chose, créons une autre crate au niveau de la racine que nous pourrons utiliser pour tester notre macro au fur et à mesure que nous la créons. Utilisez `cargo new custom-macro-test` à la racine du projet. Mettez ensuite à jour le fichier `Cargo.toml` nouvellement créé pour ajouter `anchor-lang` et les crates `custom-macro` en tant que dépendances :

```text
[package]
name = "custom-macro-test"
version = "0.1.0"
edition = "2021"

[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../custom-macro" }
```

Ensuite, mettez à jour le fichier `Cargo.toml` du projet racine pour inclure la nouvelle crate `custom-macro-test` comme précédemment :

```text
[workspace]
members = [
    "programs/*",
    "custom-macro",
    "custom-macro-test"
]
```

Enfin, remplacez le code dans `custom-macro-test/src/main.rs` par le code suivant. Nous l'utiliserons plus tard pour les tests :

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

### 3. Définir la macro personnalisée

Maintenant, dans le fichier `custom-macro/src/lib.rs`, ajoutons la déclaration de notre nouvelle macro. Dans ce fichier, nous utiliserons la macro `parse_macro_input!` pour analyser le `TokenStream` d'entrée et extraire les champs `ident` et `data` d'une struct `DeriveInput`. Ensuite, nous utiliserons la macro `eprintln!` pour imprimer les valeurs de `ident` et `data`. Pour l'instant, nous utiliserons `TokenStream::new()` pour renvoyer un `TokenStream` vide.

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

Testons ce que cela imprime. Pour ce faire, vous devez d'abord installer la commande `cargo-expand` en exécutant `cargo install cargo-expand`. Vous devrez également installer la version nightly de Rust en exécutant `rustup install nightly`.

Une fois cela fait, vous pouvez voir la sortie du code décrit ci-dessus en vous rendant dans le répertoire `custom-macro-test` et en exécutant `cargo expand`.

Cette commande développe les macros dans la crate. Étant donné que le fichier `main.rs` utilise la nouvelle macro `InstructionBuilder`, cela affichera l'arbre syntaxique pour `ident` et `data` de la struct dans la console. Une fois que vous avez confirmé que le `TokenStream` d'entrée est correctement analysé, n'hésitez pas à supprimer les déclarations `eprintln!`.

### 4. Obtenir les champs de la struct

Ensuite, utilisons des déclarations `match` pour obtenir les champs nommés de `data` de la struct. Ensuite, utilisons la macro `eprintln!` pour imprimer les valeurs des champs.

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

Utilisez à nouveau `cargo expand` dans le terminal pour voir la sortie de ce code. Une fois que vous avez confirmé que les champs sont extraits et imprimés correctement, vous pouvez supprimer l'instruction `eprintln!`.

### 5. Construire les instructions de mise à jour

Ensuite, itérons sur les champs de la struct et générons une instruction de mise à jour pour chaque champ. L'instruction sera générée à l'aide de la macro `quote!` et inclura le nom et le type du champ, ainsi qu'un nouveau nom de fonction pour l'instruction de mise à jour.

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

### 6. Renvoyer un nouveau `TokenStream`

Enfin, utilisons la macro `quote!` pour générer une implémentation pour la struct avec le nom spécifié par la variable `ident`. L'implémentation inclut les instructions de mise à jour qui ont été générées pour chaque champ de la struct. Le code généré est ensuite converti en `TokenStream` à l'aide de la méthode `into()` et renvoyé en tant que résultat de la macro.

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

Pour vérifier que la macro génère le code correct, utilisez la commande `cargo expand` pour voir la forme développée de la macro. La sortie de ceci ressemblera à ce qui suit :

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

### 7. Mettez à jour le programme pour utiliser votre nouvelle macro

Pour utiliser la nouvelle macro pour générer des instructions de mise à jour pour la struct `Config`, ajoutez d'abord la crate `custom-macro` en tant que dépendance au programme dans son `Cargo.toml` :

```text
[dependencies]
anchor-lang = "0.25.0"
custom-macro = { path = "../../custom-macro" }
```

Ensuite, accédez au fichier `state.rs` dans le programme Anchor et mettez-le à jour avec le code suivant :

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

Ensuite, accédez au fichier `admin_update.rs` et supprimez les instructions de mise à jour existantes. Cela ne devrait laisser que la struct de contexte `UpdateAdminAccount` dans le fichier.

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

Ensuite, mettez à jour `lib.rs` dans le programme Anchor pour utiliser les instructions de mise à jour générées par la macro `InstructionBuilder`.

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

Enfin, accédez au répertoire `admin` et exécutez `anchor test` pour vérifier que les instructions de mise à jour générées par la macro `InstructionBuilder` fonctionnent correctement.

```
  admin
    ✔ Is initialized! (160ms)
    ✔ Update bool! (409ms)
    ✔ Update u8! (403ms)
    ✔ Update u64! (406ms)
    ✔ Update Admin! (405ms)


  5 passing (2s)
```

Excellent travail ! À ce stade, vous pouvez créer des macros procédurales pour vous aider dans votre processus de développement. Nous vous encourageons à tirer le meilleur parti du langage Rust et à utiliser des macros là où elles ont du sens. Mais même si ce n'est pas le cas, savoir comment elles fonctionnent aide à comprendre ce qui se passe avec Anchor sous le capot.

Si vous avez besoin de passer plus de temps avec le code de solution, n'hésitez pas à consulter la branche `solution` du [dépôt](https://github.com/Unboxed-Software/anchor-custom-macro/tree/solution).

# Défi

Pour consolider ce que vous avez appris, allez-y et créez une autre macro procédurale par vous-même. Pensez au code que vous avez écrit qui pourrait être réduit ou amélioré par une macro et essayez ! Comme il s'agit toujours d'un exercice, ce n'est pas grave si cela ne fonctionne pas comme vous le souhaitez ou l'attendez. Lancez-vous et expérimentez !

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=eb892157-3014-4635-beac-f562af600bf8) !
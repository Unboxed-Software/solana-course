---
title: Créer un programme de base, Partie 1 - Gérer les données d'instruction
objectives:
- Attribuer des variables mutables et immuables en Rust
- Créer et utiliser des structures et énumérations Rust
- Utiliser des déclarations de correspondance (match) Rust
- Ajouter des implémentations aux types Rust
- Désérialiser les données d'instruction en types de données Rust
- Exécuter une logique de programme différente pour différents types d'instructions
- Expliquer la structure d'un smart contract sur Solana
---

# Résumé

- La plupart des programmes prennent en charge **plusieurs instructions discrètes** - vous décidez, en écrivant votre programme, de quelles instructions il s'agit et des données qui doivent les accompagner.
- Les énumérations Rust sont souvent utilisées pour représenter des instructions discrètes de programme.
- Vous pouvez utiliser la crate `borsh` et l'attribut `derive` pour fournir des fonctionnalités de désérialisation et de sérialisation Borsh aux structures Rust.
- Les expressions `match` de Rust aident à créer des chemins de code conditionnels en fonction de l'instruction fournie.

# Aperçu général

L'un des éléments les plus basiques d'un programme Solana est la logique de gestion des données d'instruction. La plupart des programmes prennent en charge plusieurs fonctions connexes et utilisent des différences dans les données d'instruction pour déterminer quel chemin de code exécuter. Par exemple, deux formats de données différents dans les données d'instruction transmises au programme peuvent représenter des instructions pour créer une nouvelle pièce de données ou pour supprimer la même pièce de données.

Étant donné que les données d'instruction sont fournies à la fonction d'entrée de votre programme sous la forme d'un tableau d'octets, il est courant de créer un type de données Rust pour représenter les instructions d'une manière plus utilisable dans votre code. Cette leçon vous guidera sur la manière de configurer un tel type, de désérialiser les données d'instruction dans ce format, et d'exécuter le chemin de code approprié en fonction de l'instruction transmise à la fonction d'entrée du programme.

## Notions de base de Rust

Avant de plonger dans les détails d'un programme Solana de base, parlons des notions de base de Rust que nous utiliserons tout au long de cette leçon.

### Variables

L'assignation de variables en Rust se fait avec le mot-clé `let`.

```rust
let age = 33;
```

Les variables en Rust sont immuables par défaut, ce qui signifie que la valeur d'une variable ne peut pas être modifiée une fois qu'elle a été définie. Pour créer une variable que l'on souhaite modifier à un moment donné, on utilise le mot-clé `mut`. La définition d'une variable avec ce mot-clé signifie que la valeur stockée peut changer.

```rust
// le compilateur renverra une erreur
let age = 33;
age = 34;

// ceci est autorisé
let mut mutable_age = 33;
mutable_age = 34;
```

Le compilateur Rust garantit que les variables immuables ne peuvent pas changer pour que vous n'ayez pas à le surveiller vous-même. Cela rend votre code plus facile à comprendre et simplifie le débogage.

### Structs

Une struct, ou structure, est un type de données personnalisé qui vous permet de regrouper et de nommer plusieurs valeurs liées qui constituent un groupe significatif. Chaque donnée dans une struct peut être de type différent et chacune a un nom qui lui est associé. Ces données sont appelées **champs**. Elles se comportent de manière similaire aux propriétés dans d'autres langages.

```rust
struct User {
    active: bool,
    email: String,
    age: u64
}
```

Pour utiliser une struct après l'avoir définie, on crée une instance de cette struct en spécifiant des valeurs concrètes pour chacun des champs.

```rust
let mut user1 = User {
    active: true,
    email: String::from("test@test.com"),
    age: 36
};
```

Pour obtenir ou définir une valeur spécifique dans une struct, on utilise la notation par point.

```rust
user1.age = 37;
```

### Énumérations

Les énumérations (ou Enums) sont une structure de données qui vous permet de définir un type en énumérant ses variantes possibles. Un exemple d'une énumération peut ressembler à ceci :

```rust
enum LightStatus {
    On,
    Off
}
```

L'énumération `LightStatus` a deux variantes possibles dans cette situation : soit `On`, soit `Off`.

On peut également incorporer des valeurs dans les variantes d'une énumération, tout comme on ajoute des champs à une struct.

```rust
enum LightStatus {
    On {
        color: String
    },
    Off
}

let light_status = LightStatus::On { color: String::from("red") };
```

Dans cet exemple, définir une variable sur la variante `On` de `LightStatus` nécessite également de définir la valeur de `color`.

### Instructions Match

Les instructions de correspondance (`match`) sont très similaires aux instructions `switch` en C/C++. L'instruction `match` permet de comparer une valeur avec une série de motifs, puis d'exécuter un code en fonction du motif qui correspond à la valeur. Les motifs peuvent être constitués de valeurs littérales, de noms de variables, de caractères génériques, etc. L'instruction de correspondance doit inclure tous les scénarios possibles, sinon le code ne se compilera pas.

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

### Implémentations

Le mot-clé `impl` est utilisé en Rust pour définir les implémentations d'un type. Les fonctions et les constantes peuvent toutes deux être définies dans une implémentation.

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

    fn get_number(&self) -> i32 {
        self.number
    }
}
```

La fonction `boo` ici peut uniquement être appelée sur le type lui-même plutôt que sur une instance du type, comme ceci :

```rust
Example::boo();
```

Pendant ce temps, `answer` nécessite une instance mutable de `Example` et peut être appelée avec la syntaxe des points :

```rust
let mut example = Example { number: 3 };
example.answer();
```

### Traits et attributs

Vous ne créerez pas vos propres traits ou attributs à ce stade, donc nous ne fournirons pas d'explication approfondie de l'un ou l'autre. Cependant, vous utiliserez l'attribut `derive` et certains traits fournis par la crate `borsh`, il est donc important que vous ayez une compréhension globale de chacun.

Les traits décrivent une interface abstraite que les types peuvent implémenter. Si un trait définit une fonction `bark()` et qu'un type adopte ensuite ce trait, le type doit alors implémenter la fonction `bark()`.

Les attributs ajoutent des métadonnées à un type et peuvent être utilisés à de nombreuses fins différentes.

Lorsque vous ajoutez l'attribut [`derive`](https://doc.rust-lang.org/rust-by-example/trait/derive.html) à un type et que vous fournissez un ou plusieurs traits pris en charge, du code est généré en interne pour implémenter automatiquement les traits pour ce type. Nous fournirons un exemple concret de ceci sous peu.

## Représentation des instructions en tant que type de données Rust

Maintenant que nous avons abordé les bases de Rust, appliquons-les aux programmes Solana.

Dans la plupart des cas, les programmes auront plus d'une fonction. Par exemple, vous pouvez avoir un programme qui agit comme backend pour une application de prise de notes. Supposons que ce programme accepte des instructions pour créer une nouvelle note, mettre à jour une note existante et supprimer une note existante.

Comme les instructions ont des types distincts, elles conviennent généralement bien à un type de données enum.

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

Remarquez que chaque variante de l'enum `NoteInstruction` est accompagnée de données incorporées qui seront utilisées par le programme pour accomplir les tâches de création, de mise à jour et de suppression d'une note, respectivement.

## Désérialiser les données d'instruction

Les données d'instruction sont transmises au programme sous forme d'un tableau d'octets, il est donc nécessaire de convertir de manière déterministe ce tableau en une instance du type enum d'instruction.

Dans les unités précédentes, nous avons utilisé Borsh pour la sérialisation et la désérialisation côté client. Pour utiliser Borsh côté programme, nous utilisons la crate `borsh`. Cette crate fournit les traits `BorshDeserialize` et `BorshSerialize` que vous pouvez appliquer à vos types à l'aide de l'attribut `derive`.

Pour simplifier la désérialisation des données d'instruction, vous pouvez créer une struct représentant les données et utiliser l'attribut `derive` pour appliquer le trait `BorshDeserialize` à la struct. Cela implémente les méthodes définies dans `BorshDeserialize`, y compris la méthode `try_from_slice` que nous utiliserons pour désérialiser les données d'instruction.

N'oubliez pas que la struct elle-même doit correspondre à la structure des données dans le tableau d'octets.

```rust
#[derive(BorshDeserialize)]
struct NoteInstructionPayload {
    id: u64,
    title: String,
    body: String
}
```

Une fois cette struct créée, vous pouvez créer une implémentation pour votre enum d'instruction pour gérer la logique associée à la désérialisation des données d'instruction. Il est courant de voir cela fait à l'intérieur d'une fonction appelée `unpack` qui accepte les données d'instruction en tant qu'argument et renvoie l'instance appropriée de l'enum avec les données désérialisées.

Il est d'usage standard de structurer votre programme pour s'attendre à ce que le premier octet (ou un autre nombre fixe d'octets) soit un identifiant pour indiquer quelle instruction le programme doit exécuter. Cela pourrait être un entier ou un identifiant de chaîne. Pour cet exemple, nous utiliserons le premier octet et mapperons les entiers 0, 1 et 2 aux instructions de création, de mise à jour et de suppression, respectivement.

```rust
impl NoteInstruction {
    // Déballer le tampon d'entrée pour obtenir l'instruction associée
    // Le format attendu en entrée est un vecteur sérialisé Borsh
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Prendre le premier octet comme variant pour
        // déterminer quelle instruction exécuter
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // Utiliser la struct temporaire pour désérialiser
        let payload = NoteInstructionPayload::try_from_slice(rest).unwrap();
        // Faire correspondre la variante pour déterminer quelle struct de données est attendue par
        // la fonction et renvoyer l'instance de la struct de test ou une erreur
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

Il y a beaucoup dans cet exemple, prenons cela une étape à la fois :

1. Cette fonction commence par utiliser la fonction `split_first` sur le paramètre `input` pour renvoyer un tuple. Le premier élément, `variant`, est le premier octet du tableau d'octets et le deuxième élément, `rest`, est le reste du tableau d'octets.
2. La fonction utilise ensuite la méthode `try_from_slice` sur `NoteInstructionPayload` pour désérialiser le reste du tableau d'octets en une instance de `NoteInstructionPayload` appelée `payload`.
3. Enfin, la fonction utilise une instruction `match` sur `variant` pour créer et renvoyer l'instance d'enum appropriée en utilisant les informations de `payload`.

Notez qu'il y a une syntaxe Rust dans cette fonction que nous n'avons pas expliquée encore. Les fonctions `ok_or` et `unwrap` sont utilisées pour la gestion des erreurs et seront discutées en détail dans une autre leçon.

## Logique du programme

Avec une façon de désérialiser les données d'instruction en un type Rust personnalisé, vous pouvez ensuite utiliser un flux de contrôle approprié pour exécuter des chemins de code différents dans votre programme en fonction de l'instruction passée dans le point d'entrée de votre programme.

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Appeler unpack pour désérialiser instruction_data
    let instruction = NoteInstruction::unpack(instruction_data)?;
    // Faire correspondre la struct de données renvoyée à ce que vous attendez
    match instruction {
        NoteInstruction::CreateNote { title, body, id } => {
            // Exécuter le code du programme pour créer une note
        },
        NoteInstruction::UpdateNote { title, body, id } => {
            // Exécuter le code du programme pour mettre à jour une note
        },
        NoteInstruction::DeleteNote { id } => {
            // Exécuter le code du programme pour supprimer une note
        }
    }
}
```

Pour les programmes simples où il n'y a qu'une ou deux instructions à exécuter, il peut être acceptable d'écrire la logique à l'intérieur de l'instruction `match`. Pour les programmes avec de nombreuses instructions possibles à tester, votre code sera beaucoup plus lisible si la logique pour chaque instruction est écrite dans une fonction distincte et simplement appelée depuis l'instruction `match`.

## Structure du fichier du programme

Le [programme de la leçon Hello World](hello-world-program) était assez simple pour qu'il puisse être contenu dans un seul fichier. Mais à mesure que la complexité d'un programme augmente, il est important de maintenir une structure de projet lisible et extensible. Cela implique d'encapsuler le code dans des fonctions et des structures de données comme nous l'avons fait jusqu'à présent. Mais cela implique également de regrouper le code connexe dans des fichiers séparés.

Par exemple, une bonne partie du code que nous avons examiné jusqu'à présent concerne la définition et la désérialisation des instructions. Ce code devrait vivre dans son propre fichier plutôt que d'être écrit dans le même fichier que le point d'entrée. En le faisant, nous aurions alors 2 fichiers, l'un avec le point d'entrée du programme et l'autre avec le code d'instruction :

- **lib.rs**
- **instruction.rs**

Une fois que vous commencez à diviser votre programme de cette manière, vous devrez vous assurer de répertorier tous les fichiers dans un emplacement central. Nous le ferons dans `lib.rs`. **Vous devez enregistrer chaque fichier de votre programme de cette manière.**

```rust
// Ceci serait à l'intérieur de lib.rs
pub mod instruction;
```

De plus, toutes les déclarations que vous souhaitez rendre disponibles via des déclarations `use` dans d'autres fichiers devront être préfixées par le mot-clé `pub` :

```rust
pub enum NoteInstruction { ... }
```

# Laboratoire

Pour le laboratoire de cette leçon, nous allons développer la première moitié du programme de critique de film sur lequel nous avons travaillé dans le Module 1. Ce programme stocke les critiques de film soumis par les utilisateurs.

Pour l'instant, nous nous concentrerons sur la désérialisation des données d'instruction. La leçon suivante se concentrera sur la deuxième moitié de ce programme.

### 1. Point d'entrée

Nous allons utiliser à nouveau [Solana Playground](https://beta.solpg.io/) pour développer ce programme. Solana Playground enregistre l'état dans votre navigateur, donc tout ce que vous avez fait dans la leçon précédente peut toujours être là. Si c'est le cas, effaçons tout du fichier `lib.rs` actuel.

À l'intérieur de lib.rs, nous allons importer les crates suivantes et définir où nous voulons que notre point d'entrée du programme soit avec la macro `entrypoint`.

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::AccountInfo,
};

// Le point d'entrée est une fonction appelée process_instruction
entrypoint!(process_instruction);

// À l'intérieur de lib.rs
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {

    Ok(())
}
```

### 2. Désérialiser les données d'instruction

Avant de continuer avec la logique du processeur, nous devrions définir nos instructions prises en charge et implémenter notre fonction de désérialisation.

Pour plus de lisibilité, créons un nouveau fichier appelé `instruction.rs`. À l'intérieur de ce nouveau fichier, ajoutez les déclarations `use` pour `BorshDeserialize` et `ProgramError`, puis créez un enum `MovieInstruction` avec une variante `AddMovieReview`. Cette variante doit avoir des valeurs intégrées pour `title`, `rating` et `description`.

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

Ensuite, définissez une struct `MovieReviewPayload`. Cela agira comme un type intermédiaire pour la désérialisation, donc il devrait utiliser l'attribut `derive` pour fournir une implémentation par défaut du trait `BorshDeserialize`.

```rust
#[derive(BorshDeserialize)]
struct MovieReviewPayload {
    title: String,
    rating: u8,
    description: String
}
```

Enfin, créez une implémentation pour l'enum `MovieInstruction` qui définit et implémente une fonction appelée `unpack` qui prend un tableau d'octets en argument et renvoie un type `Result`. Cette fonction doit :

1. Utiliser la fonction `split_first` pour séparer le premier octet du tableau du reste du tableau.
2. Désérialiser le reste du tableau en une instance de `MovieReviewPayload`.
3. Utiliser une instruction `match` pour renvoyer la variante `AddMovieReview` de `MovieInstruction` si le premier octet du tableau était un 0, sinon renvoyer une erreur de programme.

```rust
impl MovieInstruction {
    // Déballer le tampon d'entrée pour obtenir l'instruction associée
    // Le format attendu en entrée est un vecteur sérialisé Borsh
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        // Séparer le premier octet des données
        let (&variant, rest) = input.split_first().ok_or(ProgramError::InvalidInstructionData)?;
        // `try_from_slice` est l'une des implémentations du trait BorshDeserialization
        // Désérialise les données d'instruction octet par octet dans la struct de charge utile
        let payload = MovieReviewPayload::try_from_slice(rest).unwrap();
        // Faire correspondre le premier octet et renvoyer la struct AddMovieReview
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

### 3. Logique du programme

Avec la désérialisation de l'instruction traitée, nous pouvons retourner au fichier `lib.rs` pour gérer une partie de la logique de notre programme.

N'oubliez pas, comme nous avons ajouté du code dans un fichier différent, nous devons l'enregistrer dans le fichier `lib.rs` en utilisant `pub mod instruction;`. Ensuite, nous pouvons ajouter une instruction `use` pour amener le type `MovieInstruction` dans la portée.

```rust
pub mod instruction;
use instruction::{MovieInstruction};
```

Ensuite, définissons une nouvelle fonction `add_movie_review` qui prend comme arguments `program_id`, `accounts`, `title`, `rating`, et `description`. Elle devrait également renvoyer une instance de `ProgramResult`. À l'intérieur de cette fonction, commençons par simplement afficher nos valeurs pour le moment, et nous revisiterons le reste de l'implémentation de la fonction dans la leçon suivante.

```rust
pub fn add_movie_review(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    title: String,
    rating: u8,
    description: String
) -> ProgramResult {

    // Enregistrement des données d'instruction qui ont été transmises
    msg!("Ajout d'une critique de film...");
    msg!("Titre : {}", title);
    msg!("Note : {}", rating);
    msg!("Description : {}", description);

    Ok(())
}
```

Avec cela fait, nous pouvons appeler `add_movie_review` depuis `process_instruction` (la fonction que nous avons définie comme notre point d'entrée). Afin de passer tous les arguments requis à la fonction, nous devons d'abord appeler `unpack` sur `MovieInstruction`, puis utiliser une instruction `match` pour nous assurer que l'instruction que nous avons reçue est de la variante `AddMovieReview`.

```rust
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult {
    // Appel à unpack
    let instruction = MovieInstruction::unpack(instruction_data)?;
    // Correspondance avec la struct de données renvoyée dans la variable `instruction`
    match instruction {
        MovieInstruction::AddMovieReview { title, rating, description } => {
            // Appel à la fonction `add_move_review`
            add_movie_review(program_id, accounts, title, rating, description)
        }
    }
}
```

Et voilà, votre programme devrait être suffisamment fonctionnel pour enregistrer les données d'instruction transmises lorsqu'une transaction est soumise !

Compilez et déployez votre programme depuis Solana Program, tout comme dans la leçon précédente. Si vous n'avez pas changé l'ID du programme depuis la dernière leçon, il se déploiera automatiquement avec le même ID. Si vous souhaitez qu'il ait une adresse séparée, vous pouvez générer un nouvel ID de programme à partir de la plateforme avant de le déployer.

Vous pouvez tester votre programme en soumettant une transaction avec les bonnes données d'instruction. Pour cela, n'hésitez pas à utiliser [ce script](https://github.com/Unboxed-Software/solana-movie-client) ou [l'interface utilisateur](https://github.com/Unboxed-Software/solana-movie-frontend) que nous avons créée dans la leçon sur la sérialisation des données d'instruction. Dans les deux cas, assurez-vous de copier et coller l'ID du programme dans le code source approprié pour vous assurer que vous testez le bon programme.

Si vous avez besoin de passer un peu plus de temps sur ce laboratoire avant de passer à la suite, n'hésitez pas ! Vous pouvez également consulter le [code de solution du programme](https://beta.solpg.io/62aa9ba3b5e36a8f6716d45b) si vous êtes bloqué.

# Défi

Pour le défi de cette leçon, essayez de reproduire le programme d'introduction des étudiants du Module 1. Rappelez-vous que nous avons créé une application frontend qui permet aux étudiants de se présenter ! Le programme prend le nom de l'utilisateur et un court message comme `instruction_data` et crée un compte pour stocker les données onchain.

En utilisant ce que vous avez appris dans cette leçon, construisez le programme d'introduction des étudiants jusqu'à ce que vous puissiez imprimer les `name` et `message` fournis par l'utilisateur dans les logs du programme lorsque le programme est invoqué.

Vous pouvez tester votre programme en utilisant le [frontend](https://github.com/Unboxed-Software/solana-student-intros-frontend/tree/solution-serialize-instruction-data) que nous avons créé dans la [leçon sur la sérialisation des données d'instruction](serialize-instruction-data), puis en vérifiant les logs du programme sur Solana Explorer. N'oubliez pas de remplacer l'ID du programme dans le code frontend par celui que vous avez déployé.

Essayez de le faire de manière indépendante si vous le pouvez ! Mais si vous êtes bloqué, n'hésitez pas à consulter le [code de solution](https://beta.solpg.io/62b0ce53f6273245aca4f5b0).


## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=74a157dc-01a7-4b08-9a5f-27aa51a4346c) !
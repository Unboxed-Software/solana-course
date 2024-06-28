---
title: Créer un programme de base, Partie 2 - Gestion de l'état
objectives:
- Décrire le processus de création d'un nouveau compte à l'aide d'une adresse dérivée de programme (PDA)
- Utiliser des seeds pour dériver une PDA
- Utiliser l'espace requis par un compte pour calculer le montant de la location (en lamports) qu'un utilisateur doit allouer
- Utiliser une Invocation Croisée de Programme (CPI) pour initialiser un compte avec une PDA comme adresse du nouveau compte
- Expliquer comment mettre à jour les données stockées sur un nouveau compte
---

# Résumé

- L'état du programme est stocké dans d'autres comptes plutôt que dans le programme lui-même
- Une adresse dérivée du programme (PDA) est dérivée d'un ID de programme et d'une liste facultative de seeds. Une fois dérivées, les PDAs sont ensuite utilisées comme adresse pour un compte de stockage.
- La création d'un compte nécessite que nous calculions l'espace requis et le loyer correspondant à allouer pour le nouveau compte
- La création d'un nouveau compte nécessite une Invocation Croisée de Programme (CPI) vers l'instruction `create_account` sur le Programme Système
- La mise à jour du champ de données d'un compte nécessite que nous sérialisions (convertissions en tableau de bytes) les données dans le compte

# Aperçu général

Solana maintient la rapidité, l'efficacité et l'extensibilité en partie en rendant les programmes sans état. Au lieu d'avoir l'état stocké dans le programme lui-même, les programmes utilisent le modèle de compte de Solana pour lire l'état à partir de comptes séparés et écrire l'état dans ces comptes.

Bien que cela soit un modèle extrêmement flexible, c'est aussi un paradigme qui peut être difficile à manipuler s'il est peu familier. Mais ne vous inquiétez pas ! Nous commencerons simplement dans cette leçon et passerons à des programmes plus complexes dans la prochaine leçon.

Dans cette leçon, nous apprendrons les bases de la gestion de l'état pour un programme Solana, y compris la représentation de l'état en tant que type Rust, la création de comptes à l'aide d'adresses dérivées de programme et la sérialisation des données de compte.

## État du programme

Tous les comptes Solana ont un champ `data` qui contient un tableau de bytes. Cela rend les comptes aussi flexibles que les fichiers sur un ordinateur. Vous pouvez stocker littéralement n'importe quoi dans un compte (tant que le compte a l'espace de stockage nécessaire).

Tout comme les fichiers dans un système de fichiers traditionnel suivent des formats de données spécifiques tels que PDF ou MP3, les données stockées dans un compte Solana doivent suivre une sorte de modèle afin que les données puissent être récupérées et désérialisées en quelque chose d'utilisable.

### Représentation de l'état en tant que type Rust

Lorsque vous écrivez un programme en Rust, vous créez généralement ce "format" en définissant un type de données Rust. Si vous avez suivi [la première partie de cette leçon](basic-program-pt-1), c'est très similaire à ce que nous avons fait lorsque nous avons créé une énumération pour représenter des instructions discrètes.

Bien que ce type doive refléter la structure de vos données, pour la plupart des cas d'utilisation, une structure simple est suffisante. Par exemple, un programme de prise de notes qui stocke des notes dans des comptes distincts aurait probablement des données pour un titre, un corps, et peut-être un identifiant quelconque. Nous pourrions créer une structure pour le représenter comme suit :

```rust
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

### Utilisation de Borsh pour la sérialisation et la désérialisation

Tout comme pour les données d'instruction, nous avons besoin d'un mécanisme pour convertir notre type de données Rust en tableau de bytes, et vice versa. La **sérialisation** est le processus de conversion d'un objet en tableau de bytes. La **désérialisation** est le processus de reconstruction d'un objet à partir d'un tableau de bytes.

Nous continuerons d'utiliser Borsh pour la sérialisation et la désérialisation. En Rust, nous pouvons utiliser la crate `borsh` pour obtenir accès aux traits `BorshSerialize` et `BorshDeserialize`. Nous pouvons ensuite appliquer ces traits à l'aide de l'attribut de macro `derive`.

```rust
use borsh::{BorshSerialize, BorshDeserialize};

#[derive(BorshSerialize, BorshDeserialize)]
struct NoteState {
    title: String,
    body: String,
    id: u64
}
```

Ces traits fourniront des méthodes sur `NoteState` que nous pouvons utiliser pour sérialiser et désérialiser les données au besoin.

## Création de comptes

Avant de pouvoir mettre à jour le champ de données d'un compte, nous devons d'abord créer ce compte.

Pour créer un nouveau compte au sein de notre programme, nous devons :

1. Calculer l'espace et le loyer requis pour le compte
2. Avoir une adresse à attribuer au nouveau compte
3. Invoquer le programme système pour créer le nouveau compte

### Espace et loyer

Rappelez-vous que stocker des données sur le réseau Solana nécessite que les utilisateurs allouent un loyer sous forme de lamports. Le montant du loyer requis pour un nouveau compte dépend de la quantité d'espace que vous souhaitez allouer à ce compte. Cela signifie que nous devons savoir avant de créer le compte combien d'espace allouer.

Notez que le loyer est plus comme un dépôt. Tous les lamports alloués pour le loyer peuvent être entièrement remboursés lorsque le compte est fermé. De plus, tous les nouveaux comptes doivent désormais être [exemptés de loyer](https://twitter.com/jacobvcreech/status/1524790032938287105), ce qui signifie que les lamports ne sont pas déduits du compte au fil du temps. Un compte est considéré comme exempté de loyer s'il détient au moins 2 ans de loyer. En d'autres termes, les comptes sont stockés en chaîne de manière permanente jusqu'à ce que le propriétaire ferme le compte et récupère le loyer.

Dans notre exemple d'application de prise de notes, la structure `NoteState` spécifie trois champs qui doivent être stockés dans un compte : `title`, `body` et `id`. Pour calculer la taille que le compte doit avoir, il suffit d'additionner la taille requise pour stocker les données dans chaque champ.

Pour les données dynamiques, comme les chaînes, Borsh ajoute 4 octets supplémentaires au début pour stocker la longueur de ce champ particulier. Cela signifie que `title` et `body` ont chacun 4 octets plus leurs tailles respectives. Le champ `id` est un entier 64 bits, soit 8 octets.

Vous pouvez additionner ces longueurs, puis calculer le loyer requis pour cette quantité d'espace en utilisant la fonction `minimum_balance` du module `rent` de la crate `solana_program`.

```rust
// Calculer la taille du compte requise pour la structure NoteState
let account_len: usize = (4 + title.len()) + (4 + body.len()) + 8;

// Calculer le loyer requis
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### Adresses dérivées du programme (PDA)

Avant de créer un compte, nous devons également avoir une adresse à attribuer au compte. Pour les comptes détenus par le programme, il s'agira d'une adresse dérivée du programme (PDA) trouvée à l'aide de la fonction `find_program_address`. 

Comme son nom l'indique, les PDAs sont dérivées en utilisant l'ID du programme (adresse du programme créant le compte) et une liste facultative de "seeds". Les seeds facultatives sont des entrées supplémentaires utilisées dans la fonction `find_program_address` pour dériver la PDA. La fonction utilisée pour dériver les PDAs renverra la même adresse chaque fois qu'elle recevra les mêmes entrées. Cela nous donne la possibilité de créer un nombre illimité de comptes PDA et une façon déterministe de trouver chaque compte.

En plus des seeds que vous fournissez pour dériver une PDA, la fonction `find_program_address` fournira une "bump seed" supplémentaire. Ce qui rend les PDAs uniques par rapport aux autres adresses de compte Solana est qu'elles n'ont pas de clé secrète correspondante. Cela garantit que seul le programme qui possède l'adresse peut signer au nom de la PDA. Lorsque la fonction `find_program_address` tente de dériver une PDA en utilisant les seeds fournies, elle utilise le nombre 255 comme "bump seed". Si l'adresse résultante est invalide (c'est-à-dire qu'elle a une clé secrète correspondante), la fonction diminue la bump seed de 1 et dérive une nouvelle PDA avec cette bump seed. Une fois qu'une PDA valide est trouvée, la fonction renvoie à la fois la PDA et le bump qui a été utilisé pour dériver la PDA.

Pour notre programme de prise de notes, nous utiliserons la clé publique du créateur de la note et l'ID comme seeds facultatifs pour dériver la PDA. Dériver la PDA ainsi nous permet de trouver de manière déterministe le compte pour chaque note.

```rust
let (note_pda_account, bump_seed) = Pubkey::find_program_address(&[note_creator.key.as_ref(), id.as_bytes().as_ref(),], program_id);
```

### Invocation Croisée de Programme (CPI)

Une fois que nous avons calculé le loyer requis pour notre compte et trouvé une PDA valide à attribuer comme adresse du nouveau compte, nous sommes enfin prêts à créer le compte. La création d'un nouveau compte au sein de notre programme nécessite une Invocation Croisée de Programme (CPI). Une CPI est lorsque un programme invoque une instruction sur un autre programme. Pour créer un nouveau compte au sein de notre programme, nous invoquerons l'instruction `create_account` sur le programme système.

Les CPI peuvent être effectuées à l'aide de `invoke` ou `invoke_signed`.

```rust
pub fn invoke(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>]
) -> ProgramResult
```

```rust
pub fn invoke_signed(
    instruction: &Instruction,
    account_infos: &[AccountInfo<'_>],
    signers_seeds: &[&[&[u8]]]
) -> ProgramResult
```

Pour cette leçon, nous utiliserons `invoke_signed`. Contrairement à une signature régulière où une clé secrète est utilisée pour signer, `invoke_signed` utilise les seeds facultatives, la bump seed et l'ID du programme pour dériver une PDA et signer une instruction. Cela se fait en comparant la PDA dérivée par rapport à tous les comptes passés dans l'instruction. Si l'un des comptes correspond à la PDA, le champ de signataire pour ce compte est défini sur vrai.

Un programme peut signer des transactions de manière sécurisée de cette manière car `invoke_signed` génère la PDA utilisée pour signer avec l'ID du programme invoquant l'instruction. Il n'est donc pas possible pour un programme de générer une PDA correspondante pour signer un compte avec une PDA dérivée utilisant un autre ID de programme.

```rust
invoke_signed(
    // instruction
    &system_instruction::create_account(
        note_creator.key,
        note_pda_account.key,
        rent_lamports,
        account_len.try_into().unwrap(),
        program_id,
    ),
    // account_infos
    &[note_creator.clone(), note_pda_account.clone(), system_program.clone()],
    // signers_seeds
    &[&[note_creator.key.as_ref(), note_id.as_bytes().as_ref(), &[bump_seed]]],
)?;
```

## Sérialisation et désérialisation des données du compte

Une fois que nous avons créé un nouveau compte, nous devons accéder et mettre à jour le champ de données du compte. Cela signifie désérialiser son tableau d'octets en une instance du type que nous avons créé, mettre à jour les champs de cette instance, puis sérialiser cette instance à nouveau en un tableau d'octets.

### Désérialiser les données du compte

La première étape pour mettre à jour les données d'un compte est de désérialiser son tableau d'octets `data` en son type Rust. Vous pouvez le faire en empruntant d'abord le champ de données du compte. Cela vous permet d'accéder aux données sans en prendre possession.

Vous pouvez ensuite utiliser la fonction `try_from_slice_unchecked` pour désérialiser le champ de données du compte emprunté en utilisant le format du type que vous avez créé pour représenter les données. Cela vous donne une instance de votre type Rust afin que vous puissiez facilement mettre à jour les champs en utilisant la notation point.

Si nous devions le faire avec l'exemple d'application de prise de notes que nous avons utilisé, cela ressemblerait à ceci :

```rust
let mut account_data = try_from_slice_unchecked::<NoteState>(note_pda_account.data.borrow()).unwrap();

account_data.title = title;
account_data.body = rating;
account_data.id = id;
```

### Sérialiser les données du compte

Une fois que l'instance Rust représentant les données du compte a été mise à jour avec les valeurs appropriées, vous pouvez "sauvegarder" les données sur le compte.

Cela se fait avec la fonction `serialize` sur l'instance du type Rust que vous avez créé. Vous devrez passer une référence mutable aux données du compte. La syntaxe ici est délicate, donc ne vous inquiétez pas si vous ne la comprenez pas complètement. L'emprunt et les références sont deux des concepts les plus difficiles en Rust.

```rust
account_data.serialize(&mut &mut note_pda_account.data.borrow_mut()[..])?;
```

L'exemple ci-dessus convertit l'objet `account_data` en un tableau d'octets et le définit sur la propriété `data` de `note_pda_account`. Cela sauvegarde la variable `account_data` mise à jour dans le champ de données du nouveau compte. Maintenant, lorsque l'utilisateur récupère le `note_pda_account` et désérialise les données, il affichera les données mises à jour que nous avons sérialisées dans le compte.

## Itérateurs

Vous avez peut-être remarqué dans les exemples précédents que nous avons référencé `note_creator` et n'avons pas montré d'où cela venait.

Pour accéder à ce compte et à d'autres comptes, nous utilisons un [itérateur](https://doc.rust-lang.org/std/iter/trait.Iterator.html). Un itérateur est un trait Rust utilisé pour donner un accès séquentiel à chaque élément dans une collection de valeurs. Les itérateurs sont utilisés dans les programmes Solana pour itérer en toute sécurité sur la liste des comptes passés dans le point d'entrée du programme via l'argument `accounts`.

### Itérateur Rust

Le modèle d'itérateur vous permet d'effectuer une tâche sur une séquence d'éléments. La méthode `iter()` crée un objet itérateur qui fait référence à une collection. Un itérateur est responsable de la logique de l'itération sur chaque élément et de déterminer quand la séquence est terminée. En Rust, les itérateurs sont paresseux, ce qui signifie qu'ils n'ont aucun effet jusqu'à ce que vous appeliez des méthodes qui consomment l'itérateur pour l'utiliser. Une fois que vous avez créé un itérateur, vous devez appeler la fonction `next()` dessus pour obtenir l'élément suivant.

```rust
let v1 = vec![1, 2, 3];

// créez l'itérateur sur le vec
let v1_iter = v1.iter();

// utilisez l'itérateur pour obtenir le premier élément
let first_item = v1_iter.next();

// utilisez l'itérateur pour obtenir le deuxième élément
let second_item = v1_iter.next();
```

### Itérateur de comptes Solana

Rappelez-vous que l'`AccountInfo` de tous les comptes requis par une instruction passe par un seul argument `accounts`. Afin de parcourir les comptes et de les utiliser dans notre instruction, nous devrons créer un itérateur avec une référence mutable à `accounts`.

À ce stade, au lieu d'utiliser l'itérateur directement, nous le passons à la fonction `next_account_info` du module `account_info` fourni par la crate `solana_program`.

Par exemple, l'instruction pour créer une nouvelle note dans un programme de prise de notes nécessiterait au minimum les comptes pour l'utilisateur créant la note, une PDA pour stocker la note, et le `system_program` pour initialiser un nouveau compte. Les trois comptes seraient passés dans le point d'entrée du programme via l'argument `accounts`. Un itérateur d'`accounts` est ensuite utilisé pour séparer l'`AccountInfo` associé à chaque compte pour traiter l'instruction.

Notez que `&mut` signifie une référence mutable à l'argument `accounts`. Vous pouvez en savoir plus sur [les références en Rust](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html) et [le mot-clé `mut`](https://doc.rust-lang.org/std/keyword.mut.html).

```rust
// Obtenez un itérateur de compte
let account_info_iter = &mut accounts.iter();

// Obtenez les comptes
let note_creator = next_account_info(account_info_iter)?;
let note_pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

# Laboratoire

Cette vue d'ensemble a couvert de nombreux nouveaux concepts. Pratiquons-les ensemble en continuant à travailler sur le programme de critiques de films de la leçon précédente. Pas d'inquiétude si vous commencez simplement cette leçon sans avoir suivi la leçon précédente - il devrait être possible de suivre dans les deux cas. Nous utiliserons le [Solana Playground](https://beta.solpg.io) pour écrire, compiler et déployer notre code.

Pour rappel, nous construisons un programme Solana qui permet aux utilisateurs de donner des avis sur des films. Dans la dernière leçon, nous avons désérialisé les données d'instruction transmises par l'utilisateur, mais nous n'avons pas encore stocké ces données dans un compte. Mettons à jour notre programme pour créer de nouveaux comptes afin de stocker l'avis sur un film de l'utilisateur.

### 1. Obtenir le code de départ

Si vous n'avez pas terminé le laboratoire de la dernière leçon ou si vous voulez simplement vous assurer de ne rien avoir manqué, vous pouvez consulter [le code de départ](https://beta.solpg.io/6295b25b0e6ab1eb92d947f7).

Notre programme comprend actuellement le fichier `instruction.rs` que nous utilisons pour désérialiser les `instruction_data` transmises au point d'entrée du programme. Nous avons également complété le fichier `lib.rs` jusqu'au point où nous pouvons afficher nos données d'instruction désérialisées dans le journal du programme en utilisant la macro `msg!`.

### 2. Créer une structure pour représenter les données du compte

Commençons par créer un nouveau fichier appelé `state.rs`.

Ce fichier devra :

1. Définir la structure que notre programme utilise pour remplir le champ de données d'un nouveau compte.
2. Ajouter les traits `BorshSerialize` et `BorshDeserialize` à cette structure.

Tout d'abord, amenons tout ce dont nous aurons besoin de la crate `borsh`.

```rust
use borsh::{BorshSerialize, BorshDeserialize};
```

Ensuite, créons notre structure `MovieAccountState`. Cette structure définira les paramètres que chaque nouveau compte d'avis de film stockera dans son champ de données. Notre structure `MovieAccountState` nécessitera les paramètres suivants :

- `is_initialized` - indique si le compte a été initialisé ou non
- `rating` - note donnée par l'utilisateur pour le film
- `description` - description du film donnée par l'utilisateur
- `title` - titre du film que l'utilisateur critique

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct MovieAccountState {
    pub is_initialized: bool,
    pub rating: u8,
    pub title: String,
    pub description: String  
}
```

### 3. Mettre à jour `lib.rs`

Ensuite, mettons à jour notre fichier `lib.rs`. Tout d'abord, amenons tout ce dont nous aurons besoin pour compléter notre programme Movie Review. Vous pouvez en savoir plus sur les détails de chaque élément que nous utilisons dans [la crate `solana_program`](https://docs.rs/solana-program/latest/solana_program/).

```rust
use solana_program::{
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg,
    account_info::{next_account_info, AccountInfo},
    system_instruction,
    program_error::ProgramError,
    sysvar::{rent::Rent, Sysvar},
    program::{invoke_signed},
    borsh::try_from_slice_unchecked,
};
use std::convert::TryInto;
pub mod instruction;
pub mod state;
use instruction::MovieInstruction;
use state::MovieAccountState;
use borsh::BorshSerialize;
```

### 4. Itérer à travers les `accounts`

Ensuite, continuons à construire notre fonction `add_movie_review`. Rappelons qu'un tableau de comptes est passé à la fonction `add_movie_review` via un seul argument `accounts`. Pour traiter notre instruction, nous devrons itérer à travers les `accounts` et assigner le `AccountInfo` de chaque compte à sa propre variable.

```rust
// Obtenir un itérateur de compte
let account_info_iter = &mut accounts.iter();

// Obtenir les comptes
let initializer = next_account_info(account_info_iter)?;
let pda_account = next_account_info(account_info_iter)?;
let system_program = next_account_info(account_info_iter)?;
```

### 5. Dérivation de la PDA

Ensuite, dans notre fonction `add_movie_review`, dérivons indépendamment la PDA que l'utilisateur est censé avoir passé. Nous devrons fournir la bump seed pour la dérivation plus tard, donc même si `pda_account` devrait référencer le même compte, nous devons toujours appeler `find_program_address`.

Notez que nous dérivons la PDA pour chaque nouveau compte en utilisant la clé publique de l'initialisateur et le titre du film en tant que seeds facultatives. La mise en place de la PDA de cette manière limite chaque utilisateur à un seul avis pour un titre de film donné. Cependant, elle permet toujours au même utilisateur de donner son avis sur des films avec des titres différents et à différents utilisateurs de donner leur avis sur des films avec le même titre.

```rust
// Dérivation de la PDA
let (pda, bump_seed) = Pubkey::find_program_address(&[initializer.key.as_ref(), title.as_bytes().as_ref()], program_id);
```

### 6. Calcul de l'espace et du loyer

Ensuite, calculons le loyer dont notre nouveau compte aura besoin. Rappelons que le loyer est le montant de lamports qu'un utilisateur doit allouer à un compte pour stocker des données sur le réseau Solana. Pour calculer le loyer, nous devons d'abord calculer la quantité d'espace que notre nouveau compte nécessite.

La structure `MovieAccountState` a quatre champs. Nous allouerons 1 octet chacun pour `rating` et `is_initialized`. Pour `title` et `description`, nous allouerons de l'espace égal à 4 octets plus la longueur de la chaîne.

```rust
// Calculer la taille du compte requise
let account_len: usize = 1 + 1 + (4 + title.len()) + (4 + description.len());

// Calculer le loyer requis
let rent = Rent::get()?;
let rent_lamports = rent.minimum_balance(account_len);
```

### 7. Création d'un nouveau compte

Une fois que nous avons calculé le loyer et vérifié la PDA, nous sommes prêts à créer notre nouveau compte. Pour créer un nouveau compte, nous devons appeler l'instruction `create_account` du programme système. Nous le faisons avec une Invocation de Programme Croisé (CPI) en utilisant la fonction `invoke_signed`. Nous utilisons `invoke_signed` car nous créons le compte en utilisant une PDA et avons besoin que le programme d'avis de film "signe" l'instruction.

```rust
// Créer le compte
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

msg!("PDA créée : {}", pda);
```

### 8. Mettre à jour les données du compte

Maintenant que nous avons créé un nouveau compte, nous sommes prêts à mettre à jour le champ de données du nouveau compte en utilisant le format de la structure `MovieAccountState` de notre fichier `state.rs`. Nous désérialisons d'abord les données du compte `pda_account` en utilisant `try_from_slice_unchecked`, puis nous définissons les valeurs de chaque champ.

```rust
msg!("déballage des données du compte état");
let mut account_data = try_from_slice_unchecked::<MovieAccountState>(&pda_account.data.borrow()).unwrap();
msg!("données du compte empruntées");

account_data.title = title;
account_data.rating = rating;
account_data.description = description;
account_data.is_initialized = true;
```

Enfin, nous sérialisons les données mises à jour de `account_data` dans le champ de données de notre `pda_account`.

```rust
msg!("sérialisation du compte");
account_data.serialize(&mut &mut pda_account.data.borrow_mut()[..])?;
msg!("compte d'état sérialisé");
```

### 9. Construire et déployer

Nous sommes prêts à construire et déployer notre programme !

![Gif Construction et Déploiement du Programme](../assets/movie-review-pt2-build-deploy.gif)

Vous pouvez tester votre programme en soumettant une transaction avec les bonnes données d'instruction. Pour cela, n'hésitez pas à utiliser [ce script](https://github.com/Unboxed-Software/solana-movie-client) ou [l'interface](https://github.com/Unboxed-Software/solana-movie-frontend) que nous avons construite dans la [leçon sur la désérialisation des données personnalisées](deserialize-custom-data). Dans les deux cas, assurez-vous de copier et coller l'ID de votre programme dans la zone appropriée du code source pour vous assurer de tester le bon programme.

Si vous utilisez l'interface, remplacez simplement `MOVIE_REVIEW_PROGRAM_ID` dans les composants `MovieList.tsx` et `Form.tsx` par l'adresse du programme que vous avez déployé. Ensuite, exécutez l'interface, soumettez une critique, et actualisez le navigateur pour voir l'avis.

Si vous avez besoin de plus de temps avec ce projet pour vous sentir à l'aise avec ces concepts, jetez un œil au [code de solution](https://beta.solpg.io/62b23597f6273245aca4f5b4) avant de continuer.

# Défi

Maintenant, c'est à vous de construire quelque chose de manière indépendante. Équipé des concepts introduits dans cette leçon, vous savez maintenant tout ce dont vous aurez besoin pour recréer l'intégralité du programme Student Intro du Module 1.

Le programme Student Intro est un programme Solana qui permet aux étudiants de se présenter. Le programme prend le nom de l'utilisateur et un court message en tant que `instruction_data` et crée un compte pour stocker les données onchain.

En utilisant ce que vous avez appris dans cette leçon, développez ce programme. En plus de prendre un nom et un court message en tant que données d'instruction, le programme devrait :

1. Créer un compte séparé pour chaque étudiant.
2. Stocker `is_initialized` en tant que booléen, `name` en tant que chaîne et `msg` en tant que chaîne dans chaque compte.

Vous pouvez tester votre programme en construisant l'[interface](https://github.com/Unboxed-Software/solana-student-intros-frontend) que nous avons créée dans la [leçon sur le regroupement, l'ordonnancement et la filtration des données du programme](./paging-ordering-filtering-data). N'oubliez pas de remplacer l'ID du programme dans le code de l'interface par celui que vous avez déployé.

Essayez de le faire de manière indépendante si vous le pouvez ! Mais si vous êtes bloqué, n'hésitez pas à consulter le [code de solution](https://beta.solpg.io/62b11ce4f6273245aca4f5b2).

## Vous avez fini le laboratoire ?

Envoyez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=8320fc87-2b6d-4b3a-8b1a-54b55afed781) !
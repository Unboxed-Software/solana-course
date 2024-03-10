---
title: Hello World
objectives:
- Savoir utiliser le système de modules de Rust
- Définir une fonction en Rust
- Expliquer le type `Result`
- Expliquer le point d'entrée d'un programme Solana
- Construire et déployer un programme Solana de base
- Soumettre une transaction pour invoquer notre programme "Hello, world!"
---

# Résumé

- Les **programmes** sur Solana sont un type particulier de compte qui stocke et exécute la logique des instructions.
- Les programmes Solana ont un seul **point d'entrée** pour traiter les instructions.
- Un programme traite une instruction en utilisant l'**ID du programme**, la liste des **comptes** et les **données d'instruction** incluses avec l'instruction.

# Aperçu général

La capacité de Solana à exécuter un code quelconque est en partie ce qui le rend si puissant. Les programmes Solana, similaires aux "contrats intelligents" dans d'autres environnements blockchain, sont littéralement l'épine dorsale de l'écosystème Solana. Et la collection de programmes ne cesse de croître chaque jour à mesure que les développeurs et les créateurs imaginent et déploient de nouveaux programmes.

Cette leçon vous donnera une introduction de base à l'écriture et au déploiement d'un programme Solana en utilisant le langage de programmation Rust. Pour éviter la distraction de la mise en place d'un environnement de développement local, nous utiliserons un IDE basé sur le navigateur appelé Solana Playground.

## Bases de Rust

Avant de plonger dans la construction de notre programme "Hello, word!", passons d'abord en revue certaines bases de Rust. Si vous souhaitez approfondir Rust, consultez le [livre sur le langage Rust](https://doc.rust-lang.org/book/ch00-00-introduction.html).

### Système de modules

Rust organise le code en utilisant ce qui est collectivement appelé le "système de modules".

Cela inclut :

- **Modules** - Un module sépare le code en unités logiques pour fournir des espaces de noms isolés pour l'organisation, la portée et la confidentialité des chemins.
- **Crates** - Une crate est soit une bibliothèque, soit un programme exécutable. Le code source d'une crate est généralement subdivisé en plusieurs modules.
- **Paquets** - Un paquet contient une collection de crates ainsi qu'un fichier manifest pour spécifier les métadonnées et les dépendances entre les paquets.

Tout au long de cette leçon, nous nous concentrerons sur l'utilisation de crates et de modules.

### Chemins et portée

Les crates en Rust contiennent des modules qui définissent des fonctionnalités pouvant être partagées avec plusieurs projets. Si nous voulons accéder à un élément dans un module, nous devons connaître son "chemin" (comme lorsque nous naviguons dans un système de fichiers).

Pensez à la structure d'une crate comme à un arbre où la crate est la base et les modules sont des branches, chacune pouvant avoir des sous-modules ou des éléments qui sont des branches supplémentaires.

Le chemin vers un module ou un élément particulier est le nom de chaque étape de la crate à ce module où chacun est séparé par `::`. Par exemple, regardons la structure suivante :

1. la crate de base est `solana_program`
2. `solana_program` contient un module appelé `account_info`
3. `account_info` contient une structure appelée `AccountInfo`

Le chemin vers `AccountInfo` serait `solana_program::account_info::AccountInfo`.

En l'absence de tout autre mot-clé, nous devrions faire référence à l'ensemble de ce chemin pour utiliser `AccountInfo` dans notre code.

Cependant, avec le mot-clé [`use`](https://doc.rust-lang.org/stable/book/ch07-04-bringing-paths-into-scope-with-the-use-keyword.html), nous pouvons amener un élément dans la portée pour qu'il puisse être réutilisé dans tout un fichier sans spécifier le chemin complet à chaque fois. Il est courant de voir une série de commandes `use` en haut d'un fichier Rust.

```rust
use solana_program::account_info::AccountInfo
```

### Déclaration de fonctions en Rust

Nous définissons une fonction en Rust en utilisant le mot-clé `fn` suivi d'un nom de fonction et d'un ensemble de parenthèses.

```rust
fn process_instruction()
```

Nous pouvons ensuite ajouter des arguments à notre fonction en incluant des noms de variables et en spécifiant leur type de données correspondant entre parenthèses.

Rust est connu comme un langage "à typage statique" et chaque valeur en Rust est d'un certain "type de données". Cela signifie que Rust doit connaître les types de toutes les variables au moment de la compilation. Dans les cas où plusieurs types sont possibles, nous devons ajouter une annotation de type à nos variables.

Dans l'exemple ci-dessous, nous créons une fonction appelée `process_instruction` qui nécessite les arguments suivants :

- `program_id` - doit être de type `&Pubkey`
- `accounts` - doit être de type `&[AccountInfo]`
- `instruction_data` - doit être de type `&[u8]`

Notez le `&` devant le type de chaque argument listé dans la fonction `process_instruction`. En Rust, `&` représente une "référence" à une autre variable. Cela vous permet de faire référence à une valeur sans en prendre possession. La "référence" est garantie de pointer vers une valeur valide d'un certain type. L'action de créer une référence en Rust s'appelle "emprunter".

Dans cet exemple, lorsque la fonction `process_instruction` est appelée, un utilisateur doit fournir des valeurs pour les arguments requis. La fonction `process_instruction` fait ensuite référence aux valeurs fournies par l'utilisateur et garantit que chaque valeur est du type de données correct spécifié dans la fonction `process_instruction`.

De plus, notez les crochets `[]` autour de `&[AccountInfo]` et `&[u8]`. Cela signifie que les arguments `accounts` et `instruction_data` attendent des "slices" (ou tranches) de types `AccountInfo` et `u8`, respectivement. Une "slice" est similaire à un tableau (une collection d'objets du même type), sauf que la longueur n'est pas connue au moment de la compilation. En d'autres termes, les arguments `accounts` et `instruction_data` attendent des entrées de longueur inconnue.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
)
```

Nous pouvons ensuite faire en sorte que nos fonctions retournent des valeurs en déclarant le type de retour en utilisant une flèche `->` après la fonction.

Dans l'exemple ci-dessous, la fonction `process_instruction` retournera maintenant une valeur de type `ProgramResult`. Nous aborderons cela dans la section suivante.

```rust
fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult
```

### Énumération `Result`

`Result` est un type de la bibliothèque standard qui représente deux résultats distincts : succès (`Ok`) ou échec (`Err`). Nous parlerons plus des énumérations dans une leçon future, mais vous verrez `Ok` utilisé plus tard dans cette leçon, il est donc important de couvrir les bases.

Lorsque vous utilisez `Ok` ou `Err`, vous devez inclure une valeur, dont le type est déterminé par le contexte du code. Par exemple, une fonction qui nécessite une valeur de retour de type `Result<String, i64>` signifie que la fonction peut soit retourner `Ok` avec une valeur de chaîne incorporée, soit `Err` avec un entier incorporé. Dans cet exemple, l'entier est un code d'erreur qui peut être utilisé pour gérer correctement l'erreur.

Pour retourner un cas de succès avec une valeur de chaîne, vous feriez ce qui suit :

```rust
Ok(String::from("Succès !"));
```

Pour retourner une erreur avec un entier, vous feriez ce qui suit :

```rust
Err(404);
```

## Programmes Solana

Rappelez-vous que toutes les données stockées sur le réseau Solana sont contenues dans ce qu'on appelle des comptes. Chaque compte a sa propre adresse unique qui est utilisée pour identifier et accéder aux données du compte. Les programmes Solana ne sont qu'un type particulier de compte Solana qui stocke et exécute des instructions.

### La crate Solana Program

Pour écrire des programmes Solana avec Rust, nous utilisons la crate `solana_program`. La crate `solana_program` agit comme une bibliothèque standard pour les programmes Solana. Cette bibliothèque standard contient les modules et les macros que nous utiliserons pour développer nos programmes Solana. Si vous souhaitez approfondir la crate `solana_program`, consultez [la documentation de la crate `solana_program`](https://docs.rs/solana-program/latest/solana_program/index.html).

Pour un programme de base, nous devrons amener dans la portée les éléments suivants de la crate `solana_program` :

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

- `AccountInfo` - une structure dans le module `account_info` qui nous permet d'accéder aux informations du compte
- `entrypoint` - une macro qui déclare le point d'entrée du programme
- `ProgramResult` - un type dans le module `entrypoint` qui renvoie soit un `Result`, soit une `ProgramError`
- `Pubkey` - une structure dans le module `pubkey` qui nous permet d'accéder aux adresses sous forme de clé publique
- `msg` - une macro qui nous permet d'afficher des messages dans le journal du programme

### Point d'entrée du Programme Solana

Les programmes Solana nécessitent un seul point d'entrée pour traiter les instructions du programme. Le point d'entrée est déclaré à l'aide de la macro `entrypoint!`.

Le point d'entrée d'un programme Solana nécessite une fonction `process_instruction` avec les arguments suivants :

- `program_id` - l'adresse du compte où le programme est stocké
- `accounts` - la liste des comptes nécessaires pour traiter l'instruction
- `instruction_data` - les données d'instruction spécifiques sérialisées

```rust
entrypoint!(process_instruction);

fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult;
```

Rappelez-vous que les comptes des programmes Solana stockent uniquement la logique pour traiter les instructions. Cela signifie que les comptes de programme sont "en lecture seule" et "sans état". L'"état" (l'ensemble des données) qu'un programme nécessite pour traiter une instruction est stocké dans des comptes de données (distincts du compte de programme).

Pour traiter une instruction, les comptes de données nécessaires à une instruction doivent être explicitement transmis au programme via l'argument `accounts`. Toutes les entrées supplémentaires doivent être transmises via l'argument `instruction_data`.

Après l'exécution du programme, le programme doit retourner une valeur de type `ProgramResult`. Ce type est un `Result` où la valeur incorporée d'un cas de succès est `()` et la valeur incorporée d'un cas d'échec est `ProgramError`. `()` est une valeur vide et `ProgramError` est un type d'erreur défini dans la crate `solana_program`.

... et voilà - vous connaissez maintenant toutes les choses nécessaires pour les bases de la création d'un programme Solana en utilisant Rust. Pratiquons ce que nous avons appris jusqu'à présent !

# Laboratoire

Nous allons construire un programme "Hello, word!" en utilisant Solana Playground. Solana Playground est un outil qui vous permet d'écrire et de déployer des programmes Solana depuis le navigateur.

### 1. Configuration

Ouvrez le [Solana Playground](https://beta.solpg.io/). Ensuite, supprimez tout dans le fichier `lib.rs` par défaut et créez un portefeuille Playground.

![Gif Solana Playground Create Wallet](../assets/hello-world-create-wallet.gif)

### 2. La crate Programme Solana

Tout d'abord, amenons dans la portée tout ce dont nous aurons besoin de la crate `solana_program`.

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};
```

Ensuite, configurons le point d'entrée de notre programme en utilisant la macro `entrypoint!` et créons la fonction `process_instruction`. La macro `msg!` nous permet ensuite d'afficher "Hello, word!" dans le journal du programme lorsque le programme est invoqué.

###

 3. Point d'Entrée

```rust
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, word!");

    Ok(())
}
```

Dans l'ensemble, le programme "Hello, word!" ressemblera à ceci :

```rust
use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    msg
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8]
) -> ProgramResult{
    msg!("Hello, word!");

    Ok(())
}
```

### 4. Construction et Déploiement

Maintenant construisons et déployons notre programme en utilisant Solana Playground.

![Gif Solana Playground Build and Deploy](../assets/hello-world-build-deploy.gif)

### 5. Invoquer le Programme

Enfin, invoquons notre programme côté client. L'objectif de cette leçon est de construire notre programme Solana, nous avons donc fourni [le code client pour invoquer notre programme "Hello, word!"](https://github.com/Unboxed-Software/solana-hello-world-client) que vous pouvez télécharger.

Le code fourni comprend une fonction d'aide `sayHello` qui construit et soumet notre transaction. Nous appelons ensuite `sayHello` dans la fonction principale et affichons une URL Solana Explorer pour voir les détails de notre transaction dans le navigateur.

Ouvrez le fichier `index.ts`, vous devriez voir une variable nommée `programId`. Mettez à jour cela avec l'ID du programme du programme "Hello, word!" que vous venez de déployer en utilisant Solana Playground.

```tsx
let programId = new web3.PublicKey("<VOTRE_PROGRAM_ID>");
```

Vous pouvez trouver l'ID du programme sur Solana Playground en référençant l'image ci-dessous.

![Gif Solana Playground Program ID](../assets/hello-world-program-id.gif)

Ensuite, installez les modules Node avec `npm i`.

Maintenant, lancez `npm start`. Cette commande effectuera les opérations suivantes :
1. Générer une nouvelle paire de clés et créer un fichier `.env` s'il n'existe pas déjà.
2. Déposer dessus des SOL devnet
3. Invoquer le programme "Hello, word!"
4. Afficher l'URL de transaction pour la voir sur Solana Explorer

Copiez l'URL de transaction imprimée dans la console dans votre navigateur. Faites défiler vers le bas pour voir "Hello, word!" sous "Program Instruction Logs".

![Screenshot Solana Explorer Program Log](../assets/hello-world-program-log.png)

Félicitations, vous venez de construire et de déployer avec succès un programme Solana !

# Défi

Maintenant, c'est à votre tour de construire quelque chose de manière indépendante. Parce que nous commençons avec des programmes très simples, le vôtre ressemblera presque identique à celui que nous venons de créer. Il est utile d'essayer d'arriver au point où vous pouvez l'écrire de zéro sans consulter le code précédent, alors essayez de ne pas copier-coller ici.

1. Écrivez un nouveau programme qui utilise la macro `msg!` pour imprimer votre propre message dans le journal du programme.
2. Construisez et déployez votre programme comme nous l'avons fait dans le laboratoire.
3. Invoquez votre programme nouvellement déployé et utilisez Solana Explorer pour vérifier que votre message a été imprimé dans le journal du programme.

Comme toujours, soyez créatif avec ces défis et allez au-delà des instructions de base si vous le souhaitez - et amusez-vous !

## Vous avez fini le laboratoire ?

Poussez votre code sur GitHub et [dites-nous ce que vous avez pensé de cette leçon](https://form.typeform.com/to/IPH0UGz7#answers-lesson=5b56c69c-1490-46e4-850f-a7e37bbd79c2) !